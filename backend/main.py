import os
import json
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fitz  # PyMuPDF
import requests
import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extras import RealDictCursor
from groq import Groq
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from root .env
load_dotenv(dotenv_path="../.env")

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PUBMED_API_KEY = os.getenv("PUBMED_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# Initialize AI Clients
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)

# ─── Database Helpers ────────────────────────────────────────────────────────

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT,
                year TEXT,
                pico JSONB,
                demographics JSONB,
                methodology JSONB,
                outcomes JSONB,
                confidence JSONB,
                source_refs JSONB,
                input_type TEXT,
                input_label TEXT,
                abstract_text TEXT,
                analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Ensure analyzed_at column exists if table was created previously without it
        cur.execute("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='analyzed_at') THEN
                    ALTER TABLE analyses ADD COLUMN analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='summary') THEN
                    ALTER TABLE analyses ADD COLUMN summary TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='key_findings') THEN
                    ALTER TABLE analyses ADD COLUMN key_findings JSONB;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='clinical_significance') THEN
                    ALTER TABLE analyses ADD COLUMN clinical_significance TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='critical_appraisal') THEN
                    ALTER TABLE analyses ADD COLUMN critical_appraisal JSONB;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='takeaway_message') THEN
                    ALTER TABLE analyses ADD COLUMN takeaway_message TEXT;
                END IF;
            END $$;
        """)
        conn.commit()
        cur.close()
        conn.close()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

@app.on_event("startup")
async def startup_event():
    init_db()

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class SearchQuery(BaseModel):
    query: str

class IdQuery(BaseModel):
    identifier: str

# ─── AI Analysis Logic ────────────────────────────────────────────────────────

ANALYSIS_PROMPT = """
You are an expert medical research reviewer. Analyze the provided medical text thoroughly and extract structured data alongside high-level qualitative insights.
Your goal is to provide a comprehensive review that helps a clinician or researcher quickly understand the study's value, quality, and implications.

Return ONLY a JSON object with this exact structure:
{
  "title": "...",
  "year": "...",
  "summary": "A 3-4 sentence comprehensive overview of the study's objective, methodology, and core results.",
  "pico": { 
    "population": "Detailed description of the participants", 
    "intervention": "The specific treatment or exposure studied", 
    "comparison": "What the intervention was compared against", 
    "outcome": "The primary measures of interest" 
  },
  "demographics": { 
    "sample_size": "...", 
    "age_range": "...", 
    "sex_ratio": "...", 
    "conditions": "..." 
  },
  "methodology": { 
    "study_design": "e.g., Double-blind RCT, Systematic Review", 
    "duration": "...", 
    "randomization": "...", 
    "blinding": "...", 
    "setting": "..." 
  },
  "outcomes": { 
    "primary": "Detailed primary outcome results", 
    "secondary": ["Secondary finding 1", "Secondary finding 2"], 
    "statistics": "Key statistical findings (p-values, CI, etc.)" 
  },
  "key_findings": [
    "Most significant discovery 1",
    "Most significant discovery 2"
  ],
  "clinical_significance": "Explain how these findings impact clinical practice or future research.",
  "critical_appraisal": {
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"]
  },
  "takeaway_message": "A one-sentence 'bottom line' for the reader.",
  "confidence": { 
    "overall": 0.95, 
    "population_score": 0.9, 
    "intervention_score": 0.95, 
    "outcome_score": 0.9, 
    "methodology_score": 0.9, 
    "evidence_quality": "High/Moderate/Low", 
    "limitations": "..." 
  },
  "source_refs": [ 
    { "field": "...", "snippet": "...", "location": "..." } 
  ]
}

Text to analyze:
"""

def analyze_with_gemini(text: str):
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(ANALYSIS_PROMPT + text)
    try:
        # Clean response if it contains markdown code blocks
        content = response.text.strip()
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]
        return json.loads(content)
    except Exception as e:
        logger.error(f"Gemini parsing error: {e}")
        return None

def analyze_with_groq(text: str):
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an expert medical research reviewer. Respond only in valid JSON."},
                {"role": "user", "content": ANALYSIS_PROMPT + text[:15000]} # Limit text length
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"Groq parsing error: {e}")
        return None

# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/search")
async def search_pubmed(query_data: SearchQuery):
    try:
        url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query_data.query}&retmax=10&retmode=json"
        if PUBMED_API_KEY:
            url += f"&api_key={PUBMED_API_KEY}"
        
        response = requests.get(url)
        if response.status_code != 200:
            logger.error(f"PubMed search failed with status {response.status_code}")
            return {"papers": []}
            
        res = response.json()
        id_list = res.get("esearchresult", {}).get("idlist", [])
        
        if not id_list:
            return {"papers": []}
        
        fetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={','.join(id_list)}&retmode=xml"
        if PUBMED_API_KEY:
            fetch_url += f"&api_key={PUBMED_API_KEY}"
            
        xml_res_raw = requests.get(fetch_url)
        if xml_res_raw.status_code != 200:
            logger.error(f"PubMed fetch failed with status {xml_res_raw.status_code}")
            return {"papers": []}
            
        xml_res = xml_res_raw.text
        root = ET.fromstring(xml_res)
        
        papers = []
        for article in root.findall(".//PubmedArticle"):
            pmid = article.find(".//PMID").text
            title = article.find(".//ArticleTitle").text
            year = article.find(".//PubDate/Year")
            year = year.text if year is not None else "N/A"
            journal = article.find(".//Title").text
            
            abstract_node = article.find(".//AbstractText")
            abstract = abstract_node.text if abstract_node is not None else ""
            
            authors = []
            for author in article.findall(".//Author"):
                last = author.find("LastName")
                initials = author.find("Initials")
                if last is not None and initials is not None:
                    authors.append(f"{last.text} {initials.text}")
            
            papers.append({
                "id": pmid,
                "pmid": pmid,
                "title": title,
                "authors": ", ".join(authors[:3]) + ("..." if len(authors) > 3 else ""),
                "journal": journal,
                "year": year,
                "abstract": abstract,
                "pico": {"P": "", "I": "", "C": "", "O": ""}
            })
            
        return {"papers": papers}
    except Exception as e:
        logger.error(f"PubMed search failed: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

@app.post("/api/fetch-by-id")
async def fetch_by_id(data: IdQuery):
    # Simplified version, reuse logic from search or just call efetch
    try:
        fetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={data.identifier}&retmode=xml"
        if PUBMED_API_KEY:
            fetch_url += f"&api_key={PUBMED_API_KEY}"
        xml_res = requests.get(fetch_url).text
        root = ET.fromstring(xml_res)
        article = root.find(".//PubmedArticle")
        if article is None:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        pmid = article.find(".//PMID").text
        title = article.find(".//ArticleTitle").text
        year = article.find(".//PubDate/Year")
        year = year.text if year is not None else "N/A"
        
        return {
            "id": pmid,
            "pmid": pmid,
            "title": title,
            "year": year,
            "abstract": ET.tostring(article.find(".//Abstract"), encoding='unicode', method='text') if article.find(".//Abstract") else ""
        }
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Fetch failed")

@app.post("/api/analyze")
async def analyze(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    x_user_id: str = Header(...)
):
    analysis_data = None
    input_type = "text"
    input_label = "Snippet"
    abstract_text = ""

    if file:
        input_type = "pdf"
        input_label = file.filename
        try:
            content = await file.read()
            doc = fitz.open(stream=content, filetype="pdf")
            extracted_text = ""
            for page in doc:
                extracted_text += page.get_text()
            abstract_text = extracted_text[:2000] # Save first part as abstract
            # Use Groq for all analysis due to Gemini quota issues
            analysis_data = analyze_with_groq(extracted_text)
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to process PDF")
    elif text:
        input_type = "text"
        input_label = "Pasted Text"
        abstract_text = text[:1000]
        # Use Groq for all analysis due to Gemini quota issues
        analysis_data = analyze_with_groq(text)
    
    if not analysis_data:
        raise HTTPException(status_code=500, detail="AI Analysis failed")

    # Save to database
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO analyses 
                (user_id, title, year, pico, demographics, methodology, outcomes, confidence, source_refs, input_type, input_label, abstract_text, summary, key_findings, clinical_significance, critical_appraisal, takeaway_message)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                x_user_id,
                analysis_data.get("title"),
                analysis_data.get("year"),
                json.dumps(analysis_data.get("pico")),
                json.dumps(analysis_data.get("demographics")),
                json.dumps(analysis_data.get("methodology")),
                json.dumps(analysis_data.get("outcomes")),
                json.dumps(analysis_data.get("confidence")),
                json.dumps(analysis_data.get("source_refs")),
                input_type,
                input_label,
                abstract_text,
                analysis_data.get("summary"),
                json.dumps(analysis_data.get("key_findings")),
                analysis_data.get("clinical_significance"),
                json.dumps(analysis_data.get("critical_appraisal")),
                analysis_data.get("takeaway_message")
            ))
            analysis_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            conn.close()
            analysis_data["id"] = str(analysis_id)
        except Exception as e:
            logger.error(f"Database save failed: {e}")

    return analysis_data

@app.get("/api/analyses")
async def get_analyses(x_user_id: str = Header(...)):
    conn = get_db_connection()
    if not conn:
        return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM analyses WHERE user_id = %s ORDER BY analyzed_at DESC", (x_user_id,))
        rows = cur.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "id": str(row["id"]),
                "inputType": row["input_type"],
                "inputLabel": row["input_label"],
                "abstractText": row["abstract_text"],
                "analyzedAt": row["analyzed_at"].isoformat(),
                "result": {
                    "id": str(row["id"]),
                    "title": row["title"],
                    "year": row["year"],
                    "pico": row["pico"],
                    "demographics": row["demographics"],
                    "methodology": row["methodology"],
                    "outcomes": row["outcomes"],
                    "confidence": row["confidence"],
                    "source_refs": row["source_refs"],
                    "summary": row["summary"],
                    "key_findings": row["key_findings"],
                    "clinical_significance": row["clinical_significance"],
                    "critical_appraisal": row["critical_appraisal"],
                    "takeaway_message": row["takeaway_message"]
                }
            })
        cur.close()
        conn.close()
        return results
    except Exception as e:
        logger.error(f"Fetch analyses failed: {e}")
        return []

@app.get("/api/analyses/{analysis_id}")
async def get_analysis(analysis_id: int, x_user_id: str = Header(...)):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="DB Connection failed")
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM analyses WHERE id = %s AND user_id = %s", (analysis_id, x_user_id))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        return {
            "id": str(row["id"]),
            "inputType": row["input_type"],
            "inputLabel": row["input_label"],
            "abstractText": row["abstract_text"],
            "analyzedAt": row["analyzed_at"].isoformat(),
            "result": {
                "id": str(row["id"]),
                "title": row["title"],
                "year": row["year"],
                "pico": row["pico"],
                "demographics": row["demographics"],
                "methodology": row["methodology"],
                "outcomes": row["outcomes"],
                "confidence": row["confidence"],
                "source_refs": row["source_refs"],
                "summary": row["summary"],
                "key_findings": row["key_findings"],
                "clinical_significance": row["clinical_significance"],
                "critical_appraisal": row["critical_appraisal"],
                "takeaway_message": row["takeaway_message"]
            }
        }
    except Exception as e:
        logger.error(f"Fetch analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Fetch failed")

@app.delete("/api/analyses/{analysis_id}")
async def delete_analysis(analysis_id: int, x_user_id: str = Header(...)):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="DB Connection failed")
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM analyses WHERE id = %s AND user_id = %s", (analysis_id, x_user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "deleted"}
    except Exception as e:
        logger.error(f"Delete analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Delete failed")

@app.delete("/api/analyses")
async def clear_analyses(x_user_id: str = Header(...)):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="DB Connection failed")
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM analyses WHERE user_id = %s", (x_user_id,))
        count = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "success", "deleted": count}
    except Exception as e:
        logger.error(f"Clear analyses failed: {e}")
        raise HTTPException(status_code=500, detail="Clear failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
