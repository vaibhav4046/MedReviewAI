import os
import json
import logging
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fitz  # PyMuPDF
import re
import requests
import xml.etree.ElementTree as ET
import psycopg
from psycopg.rows import dict_row
from groq import Groq
import jwt
from jwt import PyJWKClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PUBMED_API_KEY = os.getenv("PUBMED_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "https://fond-boa-73.clerk.accounts.dev")
CLERK_JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

_jwks_client = PyJWKClient(CLERK_JWKS_URL, cache_keys=True, lifespan=3600)


def verify_clerk_token(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False, "require": ["exp", "iat", "sub", "iss"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session token")
    sub = claims.get("sub")
    if not sub or not isinstance(sub, str) or not sub.startswith("user_"):
        raise HTTPException(status_code=401, detail="Token missing valid subject")
    return sub


def get_db_connection():
    try:
        return psycopg.connect(DATABASE_URL)
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None


_db_initialised = False


def ensure_db():
    global _db_initialised
    if _db_initialised:
        return
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
        _db_initialised = True
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")


class SearchQuery(BaseModel):
    query: str
    source: Optional[str] = "pubmed"


class IdQuery(BaseModel):
    identifier: str
    source: Optional[str] = "pubmed"


ANALYSIS_PROMPT = """
You are a careful, evidence-grounded medical research evaluator. Your single goal is faithful extraction from the provided text. Never fabricate. Never infer beyond what is stated.

STRICT RULES (must follow):
1. If a field is not directly supported by evidence in the text, return null for that field. Do NOT guess. Do NOT write placeholders like "Not specified" or "N/A".
2. For EVERY non-null field in pico, demographics, methodology, outcomes, and key_findings, add a source_refs entry that grounds it.
3. The snippet in each source_refs entry MUST be a verbatim substring of the input text (copy-paste, not paraphrase). Snippets <= 240 chars.
4. The field name in source_refs MUST be a dotted path: "pico.population", "demographics.sample_size", "methodology.study_design", "outcomes.primary", "outcomes.statistics", "key_findings.0", etc.
5. Numbers, p-values, CIs, doses must be copied EXACTLY as they appear (preserve units).
6. study_design must be ONE of: "RCT" | "Cohort" | "Case-Control" | "Cross-sectional" | "Systematic Review" | "Meta-analysis" | "Qualitative" | "Case Report" | "Other". Pick the closest single match.
7. blinding must be ONE of: "Single-blind" | "Double-blind" | "Triple-blind" | "Open-label" | "Not applicable" | null.
8. evidence_quality calibration:
   - "High": RCT or Systematic Review/Meta-analysis with explicit methodology, allocation concealment, and outcome assessor blinding.
   - "Moderate": Cohort/observational with strong design, large N, or RCT with limitations.
   - "Low": Case reports, small uncontrolled studies, narrative reviews, missing critical methodology details.
9. confidence scores per field reflect grounding strength (0.0-1.0):
   - 0.9-1.0: explicit, unambiguous statement.
   - 0.7-0.89: clearly implied but not verbatim.
   - 0.5-0.69: weakly supported.
   - <0.5: speculative — prefer null over keeping the field.
10. critical_appraisal must reference specific issues observed (sample size, randomization quality, follow-up rate, conflicts of interest, etc.). Generic strengths/weaknesses are unacceptable.
11. summary must include the actual numeric primary outcome result if reported.
12. Return ONLY valid JSON. No prose outside JSON.

OUTPUT JSON SCHEMA:
{
  "title": "string or null",
  "year": "string (YYYY) or null",
  "summary": "string — 3-4 sentences with concrete numeric result",
  "pico": {
    "population": "string or null",
    "intervention": "string or null",
    "comparison": "string or null",
    "outcome": "string or null"
  },
  "demographics": {
    "sample_size": "string with N or null",
    "age_range": "string or null",
    "sex_ratio": "string or null",
    "conditions": "string or null"
  },
  "methodology": {
    "study_design": "one of allowed types",
    "duration": "string or null",
    "randomization": "string or null",
    "blinding": "one of allowed values",
    "setting": "string or null"
  },
  "outcomes": {
    "primary": "string or null",
    "secondary": ["string", ...],
    "statistics": "string or null (p-values, CI, effect size)"
  },
  "key_findings": ["string", ...],
  "clinical_significance": "string or null",
  "critical_appraisal": {
    "strengths": ["specific concrete strength", ...],
    "weaknesses": ["specific concrete weakness", ...]
  },
  "takeaway_message": "one-sentence bottom line",
  "confidence": {
    "overall": 0.0-1.0,
    "population_score": 0.0-1.0,
    "intervention_score": 0.0-1.0,
    "outcome_score": 0.0-1.0,
    "methodology_score": 0.0-1.0,
    "evidence_quality": "High|Moderate|Low",
    "limitations": "string"
  },
  "source_refs": [
    { "field": "dotted.path", "snippet": "VERBATIM SUBSTRING", "location": "abstract|introduction|methods|results|discussion|conclusion" }
  ]
}

Text to analyze:
"""


def analyze_with_groq(text: str):
    if not groq_client:
        return None
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.15,
            messages=[
                {"role": "system", "content": "You are a careful, evidence-grounded medical research evaluator. Respond only in valid JSON. Never fabricate. Use null when evidence is missing."},
                {"role": "user", "content": ANALYSIS_PROMPT + text[:15000]}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"Groq parsing error: {e}")
        return None


SECTION_HEADERS = [
    "abstract", "introduction", "background", "objectives", "methods",
    "materials and methods", "study design", "participants", "results",
    "findings", "discussion", "conclusion", "conclusions", "limitations",
    "references", "acknowledgments", "funding", "conflicts of interest",
    "supplementary"
]


def extract_structured_text_from_pdf(content: bytes):
    """
    Extract PDF text with section-aware tagging.
    Returns (full_text, sections_dict, page_count).
    """
    doc = fitz.open(stream=content, filetype="pdf")
    page_count = len(doc)
    raw_pages = []
    for page in doc:
        raw_pages.append(page.get_text("text"))
    doc.close()

    full = "\n".join(raw_pages)
    # Normalize whitespace, strip ligature artifacts
    full = full.replace("‐", "-").replace("–", "-").replace("—", "-")
    full = full.replace("ﬁ", "fi").replace("ﬂ", "fl")
    full = re.sub(r"-\n", "", full)  # de-hyphenate line wraps
    full = re.sub(r"[ \t]+", " ", full)
    full = re.sub(r"\n{3,}", "\n\n", full)

    # Detect sections by header lines
    pattern = re.compile(
        r"^\s*(?:\d+\.?\s+)?(" + "|".join([re.escape(h) for h in SECTION_HEADERS]) + r")\s*[:\.]?\s*$",
        re.IGNORECASE | re.MULTILINE,
    )
    sections = {}
    matches = list(pattern.finditer(full))
    if matches:
        for i, m in enumerate(matches):
            header = m.group(1).lower().strip()
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(full)
            body = full[start:end].strip()
            if body and len(body) > 30:
                sections.setdefault(header, []).append(body)

    return full, {k: "\n".join(v) for k, v in sections.items()}, page_count


def build_tagged_text(full_text, sections):
    """Build a section-tagged version of text for the LLM (max ~12000 chars)."""
    if not sections:
        return full_text[:14000]
    parts = []
    priority_order = [
        "abstract", "introduction", "background", "objectives",
        "methods", "materials and methods", "study design", "participants",
        "results", "findings", "discussion", "conclusion", "conclusions",
        "limitations"
    ]
    for key in priority_order:
        if key in sections:
            content = sections[key][:3500]  # cap each section
            parts.append(f"\n[SECTION: {key.upper()}]\n{content}")
    tagged = "".join(parts)
    if len(tagged) < 4000:
        # Sections found but sparse — append start of full text
        tagged += "\n[FULL TEXT]\n" + full_text[: 10000 - len(tagged)]
    return tagged[:14000]


def validate_grounding(analysis_data, source_text):
    """Mark each source_ref with whether snippet appears (≥60% word overlap) in source."""
    if not analysis_data or not source_text:
        return analysis_data
    refs = analysis_data.get("source_refs") or []
    src_lower = source_text.lower()
    for ref in refs:
        snippet = (ref.get("snippet") or "").strip().strip('"').lower()
        if not snippet or len(snippet) < 8:
            ref["grounded"] = True
            continue
        if snippet in src_lower:
            ref["grounded"] = True
            continue
        words = [w for w in snippet.replace(",", " ").replace(".", " ").split() if len(w) > 3]
        if not words:
            ref["grounded"] = True
            continue
        hits = sum(1 for w in words if w in src_lower)
        ref["grounded"] = hits / len(words) >= 0.6
    analysis_data["source_refs"] = refs
    grounded_count = sum(1 for r in refs if r.get("grounded"))
    if refs:
        analysis_data.setdefault("confidence", {})["grounding_score"] = round(grounded_count / len(refs), 2)
    return analysis_data


# ─── Multi-Source Search ─────────────────────────────────────────────────────

def _normalize_paper(item):
    """Ensure all required Paper fields exist with safe defaults."""
    return {
        "id": str(item.get("id") or ""),
        "pmid": str(item.get("pmid") or item.get("doi") or item.get("id") or ""),
        "title": item.get("title") or "Untitled",
        "authors": item.get("authors") or "",
        "journal": item.get("journal") or "",
        "year": str(item.get("year") or "N/A"),
        "abstract": item.get("abstract") or "",
        "source": item.get("source") or "",
        "url": item.get("url") or "",
        "doi": item.get("doi") or "",
        "pico": {"P": "", "I": "", "C": "", "O": ""},
    }


def search_pubmed_papers(query: str):
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmax=10&retmode=json"
    if PUBMED_API_KEY:
        url += f"&api_key={PUBMED_API_KEY}"
    r = requests.get(url, timeout=20)
    if r.status_code != 200:
        return []
    id_list = r.json().get("esearchresult", {}).get("idlist", [])
    if not id_list:
        return []
    fetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={','.join(id_list)}&retmode=xml"
    if PUBMED_API_KEY:
        fetch_url += f"&api_key={PUBMED_API_KEY}"
    xml_raw = requests.get(fetch_url, timeout=30)
    if xml_raw.status_code != 200:
        return []
    root = ET.fromstring(xml_raw.text)
    papers = []
    for article in root.findall(".//PubmedArticle"):
        pmid_el = article.find(".//PMID")
        pmid = pmid_el.text if pmid_el is not None else ""
        title_el = article.find(".//ArticleTitle")
        title = title_el.text if title_el is not None else "Untitled"
        year_el = article.find(".//PubDate/Year")
        year = year_el.text if year_el is not None else "N/A"
        journal_el = article.find(".//Title")
        journal = journal_el.text if journal_el is not None else ""
        abstract_node = article.find(".//AbstractText")
        abstract = abstract_node.text if abstract_node is not None else ""
        authors = []
        for author in article.findall(".//Author"):
            last = author.find("LastName")
            initials = author.find("Initials")
            if last is not None and initials is not None:
                authors.append(f"{last.text} {initials.text}")
        papers.append(_normalize_paper({
            "id": pmid,
            "pmid": pmid,
            "title": title,
            "authors": ", ".join(authors[:3]) + ("..." if len(authors) > 3 else ""),
            "journal": journal,
            "year": year,
            "abstract": abstract,
            "source": "pubmed",
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}",
        }))
    return papers


def search_europe_pmc(query: str):
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
    params = {"query": query, "format": "json", "pageSize": 10, "resultType": "core"}
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    papers = []
    for item in r.json().get("resultList", {}).get("result", []):
        pmid = item.get("pmid") or item.get("id") or ""
        doi = item.get("doi") or ""
        link = ""
        if pmid:
            link = f"https://europepmc.org/article/MED/{pmid}"
        elif doi:
            link = f"https://doi.org/{doi}"
        papers.append(_normalize_paper({
            "id": item.get("id"),
            "pmid": pmid,
            "title": item.get("title"),
            "authors": item.get("authorString") or "",
            "journal": item.get("journalTitle") or "",
            "year": item.get("pubYear"),
            "abstract": item.get("abstractText") or "",
            "doi": doi,
            "source": "europepmc",
            "url": link,
        }))
    return papers


def search_semantic_scholar(query: str):
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": query,
        "limit": 10,
        "fields": "title,abstract,authors,year,venue,externalIds,tldr,citationCount,openAccessPdf",
    }
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    papers = []
    for item in r.json().get("data", []):
        authors_arr = item.get("authors") or []
        authors = ", ".join([a.get("name", "") for a in authors_arr[:3]])
        if len(authors_arr) > 3:
            authors += "..."
        ext = item.get("externalIds") or {}
        pmid = ext.get("PubMed") or ""
        doi = ext.get("DOI") or ""
        abstract = item.get("abstract") or ((item.get("tldr") or {}).get("text") or "")
        link = ""
        if pmid:
            link = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}"
        elif doi:
            link = f"https://doi.org/{doi}"
        elif item.get("paperId"):
            link = f"https://www.semanticscholar.org/paper/{item.get('paperId')}"
        papers.append(_normalize_paper({
            "id": item.get("paperId"),
            "pmid": pmid or doi or item.get("paperId"),
            "title": item.get("title"),
            "authors": authors,
            "journal": item.get("venue") or "",
            "year": item.get("year"),
            "abstract": abstract,
            "doi": doi,
            "source": "semantic",
            "url": link,
        }))
    return papers


def search_openalex(query: str):
    url = "https://api.openalex.org/works"
    params = {"search": query, "per_page": 10, "filter": "type:article"}
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    papers = []
    for item in r.json().get("results", []):
        authorships = item.get("authorships") or []
        authors = ", ".join([(a.get("author") or {}).get("display_name", "") for a in authorships[:3]])
        if len(authorships) > 3:
            authors += "..."
        inv = item.get("abstract_inverted_index") or {}
        if inv:
            tokens = []
            for word, positions in inv.items():
                for pos in positions:
                    tokens.append((pos, word))
            tokens.sort()
            abstract = " ".join(w for _, w in tokens)
        else:
            abstract = ""
        doi = (item.get("doi") or "").replace("https://doi.org/", "")
        oa_id = (item.get("id") or "").rsplit("/", 1)[-1]
        link = item.get("doi") or f"https://api.openalex.org/works/{oa_id}"
        primary = item.get("primary_location") or {}
        source_obj = primary.get("source") or {}
        papers.append(_normalize_paper({
            "id": oa_id,
            "pmid": doi or oa_id,
            "title": item.get("title"),
            "authors": authors,
            "journal": source_obj.get("display_name") or "",
            "year": item.get("publication_year"),
            "abstract": abstract,
            "doi": doi,
            "source": "openalex",
            "url": link,
        }))
    return papers


def search_biorxiv(query: str):
    """bioRxiv via Europe PMC filter (Europe PMC indexes bioRxiv preprints)."""
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
    params = {
        "query": f"{query} AND (SRC:PPR)",
        "format": "json",
        "pageSize": 10,
        "resultType": "core",
    }
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    papers = []
    for item in r.json().get("resultList", {}).get("result", []):
        doi = item.get("doi") or ""
        link = f"https://doi.org/{doi}" if doi else ""
        papers.append(_normalize_paper({
            "id": item.get("id"),
            "pmid": item.get("pmid") or doi or item.get("id"),
            "title": item.get("title"),
            "authors": item.get("authorString") or "",
            "journal": "Preprint",
            "year": item.get("pubYear"),
            "abstract": item.get("abstractText") or "",
            "doi": doi,
            "source": "biorxiv",
            "url": link,
        }))
    return papers


def search_crossref(query: str):
    url = "https://api.crossref.org/works"
    params = {"query": query, "rows": 10, "select": "DOI,title,author,container-title,published-print,published-online,abstract,issued,publisher", "filter": "type:journal-article,has-abstract:true"}
    headers = {"User-Agent": "MedReviewAI/1.0 (mailto:contact@medreviewai.app)"}
    r = requests.get(url, params=params, headers=headers, timeout=20)
    if r.status_code != 200:
        return []
    items = r.json().get("message", {}).get("items", [])
    papers = []
    for item in items:
        authors_arr = item.get("author") or []
        authors = ", ".join([f"{a.get('family','')} {a.get('given','')[0:1]}".strip() for a in authors_arr[:3] if a.get("family")])
        if len(authors_arr) > 3:
            authors += "..."
        title = (item.get("title") or [""])[0]
        journal = (item.get("container-title") or [""])[0]
        date_parts = (item.get("published-print") or item.get("published-online") or item.get("issued") or {}).get("date-parts") or [[None]]
        year = str(date_parts[0][0]) if date_parts and date_parts[0] and date_parts[0][0] else "N/A"
        # Crossref abstracts often wrapped in <jats:p> tags
        abstract = item.get("abstract") or ""
        abstract = re.sub(r"<[^>]+>", "", abstract).strip() if abstract else ""
        doi = item.get("DOI") or ""
        papers.append(_normalize_paper({
            "id": doi,
            "pmid": doi,
            "title": title,
            "authors": authors,
            "journal": journal,
            "year": year,
            "abstract": abstract,
            "doi": doi,
            "source": "crossref",
            "url": f"https://doi.org/{doi}" if doi else "",
        }))
    return papers


def search_doaj(query: str):
    url = f"https://doaj.org/api/search/articles/{requests.utils.quote(query)}"
    params = {"pageSize": 10}
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    items = r.json().get("results", [])
    papers = []
    for item in items:
        bib = item.get("bibjson") or {}
        authors_arr = bib.get("author") or []
        authors = ", ".join([a.get("name", "") for a in authors_arr[:3]])
        if len(authors_arr) > 3:
            authors += "..."
        journal = (bib.get("journal") or {}).get("title") or ""
        year = str(bib.get("year") or "N/A")
        title = bib.get("title") or "Untitled"
        abstract = bib.get("abstract") or ""
        identifiers = bib.get("identifier") or []
        doi = next((i.get("id") for i in identifiers if i.get("type") == "doi"), "")
        link_obj = next((l for l in (bib.get("link") or []) if l.get("type") == "fulltext"), None)
        link = (link_obj or {}).get("url") or (f"https://doi.org/{doi}" if doi else "")
        papers.append(_normalize_paper({
            "id": item.get("id"),
            "pmid": doi or item.get("id"),
            "title": title,
            "authors": authors,
            "journal": journal,
            "year": year,
            "abstract": abstract,
            "doi": doi,
            "source": "doaj",
            "url": link,
        }))
    return papers


def search_arxiv(query: str):
    url = "http://export.arxiv.org/api/query"
    params = {"search_query": f"all:{query}", "max_results": 10, "sortBy": "relevance"}
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(r.text)
    papers = []
    for entry in root.findall("a:entry", ns):
        arxiv_id = (entry.findtext("a:id", "", ns) or "").rsplit("/", 1)[-1]
        title = (entry.findtext("a:title", "", ns) or "").strip()
        summary = (entry.findtext("a:summary", "", ns) or "").strip()
        published = entry.findtext("a:published", "", ns) or ""
        year = published[:4] if len(published) >= 4 else "N/A"
        authors_arr = entry.findall("a:author", ns)
        authors_names = [(a.findtext("a:name", "", ns) or "").strip() for a in authors_arr]
        authors = ", ".join(authors_names[:3]) + ("..." if len(authors_names) > 3 else "")
        link = f"https://arxiv.org/abs/{arxiv_id}"
        papers.append(_normalize_paper({
            "id": arxiv_id,
            "pmid": arxiv_id,
            "title": title,
            "authors": authors,
            "journal": "arXiv preprint",
            "year": year,
            "abstract": summary,
            "source": "arxiv",
            "url": link,
        }))
    return papers


def search_pmc(query: str):
    """PubMed Central — full-text open access subset."""
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term={query}&retmax=10&retmode=json"
    if PUBMED_API_KEY:
        url += f"&api_key={PUBMED_API_KEY}"
    r = requests.get(url, timeout=20)
    if r.status_code != 200:
        return []
    id_list = r.json().get("esearchresult", {}).get("idlist", [])
    if not id_list:
        return []
    summary_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id={','.join(id_list)}&retmode=json"
    if PUBMED_API_KEY:
        summary_url += f"&api_key={PUBMED_API_KEY}"
    s = requests.get(summary_url, timeout=20)
    if s.status_code != 200:
        return []
    data = s.json().get("result", {})
    papers = []
    for pmcid in id_list:
        item = data.get(pmcid, {})
        if not item:
            continue
        authors_arr = item.get("authors") or []
        authors = ", ".join([a.get("name", "") for a in authors_arr[:3]])
        if len(authors_arr) > 3:
            authors += "..."
        papers.append(_normalize_paper({
            "id": pmcid,
            "pmid": item.get("articleids", [{}])[0].get("value", pmcid),
            "title": item.get("title") or "Untitled",
            "authors": authors,
            "journal": item.get("fulljournalname") or item.get("source") or "",
            "year": (item.get("pubdate") or "")[:4] or "N/A",
            "abstract": "",  # PMC summary doesn't include abstract; use PubMed for that
            "source": "pmc",
            "url": f"https://www.ncbi.nlm.nih.gov/pmc/articles/PMC{pmcid}/",
        }))
    return papers


def search_clinicaltrials(query: str):
    """ClinicalTrials.gov v2 API."""
    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {"query.term": query, "pageSize": 10, "format": "json"}
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    studies = r.json().get("studies", [])
    papers = []
    for s in studies:
        proto = s.get("protocolSection") or {}
        ident = proto.get("identificationModule") or {}
        desc = proto.get("descriptionModule") or {}
        design = proto.get("designModule") or {}
        status_mod = proto.get("statusModule") or {}
        sponsor = proto.get("sponsorCollaboratorsModule") or {}
        nct = ident.get("nctId", "")
        title = ident.get("officialTitle") or ident.get("briefTitle") or "Untitled"
        brief = desc.get("briefSummary") or ""
        detail = desc.get("detailedDescription") or ""
        abstract = brief + ("\n\n" + detail if detail else "")
        lead_sponsor = (sponsor.get("leadSponsor") or {}).get("name") or ""
        study_type = design.get("studyType") or ""
        start_date = (status_mod.get("startDateStruct") or {}).get("date") or ""
        year = start_date[:4] if start_date else "N/A"
        papers.append(_normalize_paper({
            "id": nct,
            "pmid": nct,
            "title": title,
            "authors": lead_sponsor,
            "journal": f"ClinicalTrials.gov ({study_type})" if study_type else "ClinicalTrials.gov",
            "year": year,
            "abstract": abstract,
            "source": "clinicaltrials",
            "url": f"https://clinicaltrials.gov/study/{nct}" if nct else "",
        }))
    return papers


def search_plos(query: str):
    """PLOS Solr-backed search across all PLOS journals."""
    url = "https://api.plos.org/search"
    params = {
        "q": query,
        "rows": 10,
        "fl": "id,title_display,abstract,author_display,journal,publication_date",
        "wt": "json",
    }
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    docs = (r.json().get("response") or {}).get("docs", [])
    papers = []
    for d in docs:
        doi = d.get("id") or ""
        title = d.get("title_display") or "Untitled"
        abstract_arr = d.get("abstract") or []
        abstract = " ".join(abstract_arr) if isinstance(abstract_arr, list) else str(abstract_arr)
        authors_arr = d.get("author_display") or []
        authors = ", ".join(authors_arr[:3]) + ("..." if len(authors_arr) > 3 else "")
        journal = d.get("journal") or "PLOS"
        date = d.get("publication_date") or ""
        year = date[:4] if date else "N/A"
        papers.append(_normalize_paper({
            "id": doi,
            "pmid": doi,
            "title": title,
            "authors": authors,
            "journal": journal,
            "year": year,
            "abstract": abstract,
            "doi": doi,
            "source": "plos",
            "url": f"https://doi.org/{doi}" if doi else "",
        }))
    return papers


def search_openaire(query: str):
    """OpenAIRE Scholarly Search API."""
    url = "https://api.openaire.eu/search/publications"
    params = {"keywords": query, "size": 10, "format": "json"}
    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        return []
    try:
        data = r.json()
    except Exception:
        return []
    results = ((data.get("response") or {}).get("results") or {}).get("result") or []
    papers = []
    for item in results:
        meta = (((item.get("metadata") or {}).get("oaf:entity") or {}).get("oaf:result")) or {}
        title_obj = meta.get("title")
        if isinstance(title_obj, list):
            title_obj = title_obj[0] if title_obj else {}
        title = (title_obj or {}).get("$") if isinstance(title_obj, dict) else str(title_obj or "Untitled")
        creators = meta.get("creator") or []
        if not isinstance(creators, list):
            creators = [creators]
        authors = ", ".join([(c or {}).get("$", "") for c in creators[:3] if isinstance(c, dict)])
        if len(creators) > 3:
            authors += "..."
        date_obj = meta.get("dateofacceptance") or {}
        date_str = date_obj.get("$") if isinstance(date_obj, dict) else str(date_obj)
        year = (date_str or "")[:4] or "N/A"
        desc_obj = meta.get("description")
        if isinstance(desc_obj, list):
            desc_obj = desc_obj[0] if desc_obj else {}
        abstract = (desc_obj or {}).get("$") if isinstance(desc_obj, dict) else str(desc_obj or "")
        pids = meta.get("pid") or []
        if not isinstance(pids, list):
            pids = [pids]
        doi = ""
        for pid in pids:
            if isinstance(pid, dict) and (pid.get("@classid") == "doi"):
                doi = pid.get("$", "")
                break
        oa_id = (item.get("header") or {}).get("dri:objIdentifier", {}).get("$", "") if isinstance(item.get("header"), dict) else ""
        papers.append(_normalize_paper({
            "id": oa_id or doi,
            "pmid": doi or oa_id,
            "title": title or "Untitled",
            "authors": authors,
            "journal": "",
            "year": year,
            "abstract": (abstract or "")[:5000],
            "doi": doi,
            "source": "openaire",
            "url": f"https://doi.org/{doi}" if doi else (f"https://explore.openaire.eu/search/publication?pid={oa_id}" if oa_id else ""),
        }))
    return papers


def search_nih_reporter(query: str):
    """NIH RePORTER funded-project search."""
    url = "https://api.reporter.nih.gov/v2/projects/search"
    payload = {
        "criteria": {"advanced_text_search": {"operator": "and", "search_field": "all", "search_text": query}},
        "limit": 10,
        "offset": 0,
        "include_fields": [
            "ProjectNum", "ProjectTitle", "AbstractText", "ContactPiName", "OrgName",
            "FiscalYear", "ProjectStartDate"
        ],
    }
    r = requests.post(url, json=payload, timeout=25)
    if r.status_code != 200:
        return []
    results = r.json().get("results", [])
    papers = []
    for item in results:
        pn = item.get("project_num") or ""
        title = item.get("project_title") or "Untitled"
        abstract = (item.get("abstract_text") or "").strip()
        pi = item.get("contact_pi_name") or ""
        org = item.get("org_name") or ""
        year = str(item.get("fiscal_year") or "N/A")
        papers.append(_normalize_paper({
            "id": pn,
            "pmid": pn,
            "title": title,
            "authors": pi,
            "journal": f"NIH-funded · {org}" if org else "NIH RePORTER",
            "year": year,
            "abstract": abstract,
            "source": "nih",
            "url": f"https://reporter.nih.gov/search/?term={pn}" if pn else "https://reporter.nih.gov",
        }))
    return papers


def dispatch_search(query: str, source: str):
    src = (source or "pubmed").lower()
    if src == "europepmc":
        return search_europe_pmc(query)
    if src == "semantic":
        return search_semantic_scholar(query)
    if src == "openalex":
        return search_openalex(query)
    if src in ("biorxiv", "preprints"):
        return search_biorxiv(query)
    if src == "crossref":
        return search_crossref(query)
    if src == "doaj":
        return search_doaj(query)
    if src == "arxiv":
        return search_arxiv(query)
    if src == "pmc":
        return search_pmc(query)
    if src in ("clinicaltrials", "trials"):
        return search_clinicaltrials(query)
    if src == "plos":
        return search_plos(query)
    if src == "openaire":
        return search_openaire(query)
    if src in ("nih", "reporter"):
        return search_nih_reporter(query)
    return search_pubmed_papers(query)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/search")
async def search_papers(query_data: SearchQuery, user_id: str = Depends(verify_clerk_token)):
    try:
        papers = dispatch_search(query_data.query, query_data.source or "pubmed")
        return {"papers": papers, "source": query_data.source or "pubmed", "count": len(papers)}
    except Exception as e:
        logger.error(f"Search failed [{query_data.source}]: {e}")
        raise HTTPException(status_code=500, detail="Search failed")


@app.post("/api/fetch-by-id")
async def fetch_by_id(data: IdQuery, user_id: str = Depends(verify_clerk_token)):
    try:
        fetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={data.identifier}&retmode=xml"
        if PUBMED_API_KEY:
            fetch_url += f"&api_key={PUBMED_API_KEY}"
        xml_res = requests.get(fetch_url, timeout=20).text
        root = ET.fromstring(xml_res)
        article = root.find(".//PubmedArticle")
        if article is None:
            raise HTTPException(status_code=404, detail="Paper not found")
        pmid = article.find(".//PMID").text
        title_el = article.find(".//ArticleTitle")
        title = title_el.text if title_el is not None else "Untitled"
        year = article.find(".//PubDate/Year")
        year = year.text if year is not None else "N/A"
        abstract_node = article.find(".//Abstract")
        abstract = ET.tostring(abstract_node, encoding='unicode', method='text') if abstract_node is not None else ""
        return {"id": pmid, "pmid": pmid, "title": title, "year": year, "abstract": abstract}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Fetch failed")


@app.post("/api/analyze")
async def analyze(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    pmid: Optional[str] = Form(None),
    user_id: str = Depends(verify_clerk_token),
):
    x_user_id = user_id
    ensure_db()
    analysis_data = None
    input_type = "text"
    input_label = "Snippet"
    abstract_text = ""

    if file:
        input_type = "pdf"
        input_label = file.filename
        try:
            content = await file.read()
            full_text, sections, page_count = extract_structured_text_from_pdf(content)
            if not full_text or len(full_text) < 100:
                raise HTTPException(status_code=422, detail="PDF appears empty or unreadable. Try a text-based PDF (not scanned image).")
            tagged = build_tagged_text(full_text, sections)
            abstract_text = (sections.get("abstract") or full_text)[:2000]
            analysis_data = analyze_with_groq(tagged)
            analysis_data = validate_grounding(analysis_data, full_text)
            if analysis_data is not None:
                analysis_data["pdf_meta"] = {
                    "pages": page_count,
                    "sections_detected": list(sections.keys()),
                }
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to process PDF")
    elif text:
        input_type = "pubmed" if pmid else "text"
        input_label = f"PMID:{pmid}" if pmid else "Pasted Text"
        abstract_text = text[:1000]
        analysis_data = analyze_with_groq(text)
        analysis_data = validate_grounding(analysis_data, text)

    if not analysis_data:
        raise HTTPException(status_code=500, detail="AI Analysis failed")

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

    analysis_data["input_label"] = input_label
    analysis_data["input_type"] = input_type
    return analysis_data


@app.get("/api/analyses")
async def get_analyses(user_id: str = Depends(verify_clerk_token)):
    x_user_id = user_id
    ensure_db()
    conn = get_db_connection()
    if not conn:
        return []
    try:
        cur = conn.cursor(row_factory=dict_row)
        cur.execute("SELECT * FROM analyses WHERE user_id = %s ORDER BY analyzed_at DESC", (x_user_id,))
        rows = cur.fetchall()
        results = []
        for row in rows:
            results.append({
                "id": str(row["id"]),
                "inputType": row["input_type"],
                "inputLabel": row["input_label"],
                "abstractText": row["abstract_text"],
                "analyzedAt": row["analyzed_at"].isoformat() if row["analyzed_at"] else None,
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
async def get_analysis(analysis_id: int, user_id: str = Depends(verify_clerk_token)):
    x_user_id = user_id
    ensure_db()
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="DB Connection failed")
    try:
        cur = conn.cursor(row_factory=dict_row)
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
            "analyzedAt": row["analyzed_at"].isoformat() if row["analyzed_at"] else None,
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fetch analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Fetch failed")


@app.delete("/api/analyses/{analysis_id}")
async def delete_analysis(analysis_id: int, user_id: str = Depends(verify_clerk_token)):
    x_user_id = user_id
    ensure_db()
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
async def clear_analyses(user_id: str = Depends(verify_clerk_token)):
    x_user_id = user_id
    ensure_db()
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
