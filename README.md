# MedReviewAI

> AI-powered medical paper analysis. Compress scoping-review work from weeks to seconds.

**Live demo:** https://medai-deploy.vercel.app
**Status:** Production-ready · College final-year project · Fully open data sources · Zero recurring API cost

---

## What it does

Upload a medical research paper (PDF / paste / search across 13 academic databases) → AI extracts:

- **PICO** framework (Population, Intervention, Comparison, Outcome)
- **Demographics** (sample size, age range, sex ratio, conditions)
- **Methodology** (study design, duration, randomization, blinding, setting)
- **Outcomes** (primary, secondary, statistics with p-values / CIs)
- **Confidence scoring** (per-field 0-100 % calibrated to evidence strength)
- **Source-grounded references** (every claim verified verbatim against the paper)

All results auto-save per user, exportable as JSON or CSV.

---

## Demo URL

**https://medai-deploy.vercel.app**

Sign in with any email (Clerk dev mode, no email-verification required for testing).

---

## Architecture

```mermaid
flowchart LR
  U[User Browser] -->|HTTPS| V[Vercel Edge]
  V -->|/api/*| F[FastAPI<br/>api/index.py<br/>Python 3.12 serverless]
  V -->|/* fallback| S[Static SPA<br/>React + Vite]

  F -->|verify_clerk_token| J[Clerk JWKS<br/>RS256 cached 1h]
  F -->|13 free APIs| EXT[External Sources]
  F -->|psycopg3| DB[(Neon Postgres<br/>analyses)]
  F -->|Llama 3.3 70B| GR[Groq API]

  subgraph EXT [13 academic sources]
    P1[PubMed]
    P2[PMC]
    P3[Europe PMC]
    P4[ClinicalTrials.gov]
    P5[PLOS]
    P6[OpenAIRE]
    P7[NIH RePORTER]
    P8[Semantic Scholar]
    P9[OpenAlex]
    P10[CrossRef]
    P11[DOAJ]
    P12[arXiv]
    P13[bioRxiv/medRxiv]
  end

  S -->|Clerk SDK| CL[Clerk Auth]
  S -->|Authorization Bearer JWT| F
```

## Data flow — analyze a paper

```mermaid
sequenceDiagram
  participant U as User
  participant SPA as React SPA
  participant CL as Clerk
  participant API as FastAPI /api/analyze
  participant V as validate_grounding
  participant LLM as Groq Llama 3.3 70B
  participant DB as Neon Postgres

  U->>SPA: Click Analyze on paper
  SPA->>CL: getToken()
  CL-->>SPA: JWT
  SPA->>API: POST /api/analyze + Bearer JWT + (text | PDF)
  API->>CL: verify_clerk_token (JWKS)
  CL-->>API: sub claim (user_id)
  alt PDF input
    API->>API: extract_structured_text_from_pdf()<br/>section detect, dehyphenate
    API->>API: build_tagged_text() [SECTION: METHODS] etc
  end
  API->>LLM: prompt + tagged text (temp 0.15 JSON mode)
  LLM-->>API: structured JSON (PICO, demographics, ...)
  API->>V: verify each ref snippet against full text
  V-->>API: refs[].grounded + grounding_score
  API->>DB: INSERT into analyses (user_id = sub)
  DB-->>API: id
  API-->>SPA: JSON result
  SPA->>U: render PICO + Confidence + Source Refs
```

## Screenshots

> Live demo carries the latest UI: **https://medai-deploy.vercel.app**

Key screens:

- **Landing page** — animated hero gradient, sleek pills, 3-step flow, dark/light mode
- **Search & Screen** — 13-source picker chips, result cards with source badge + "open original" link
- **Analyzer** — Upload PDF / URL-DOI / Search PubMed tabs; PICO table, demographics, methodology, outcomes, confidence gauge, grounded source refs
- **Results Dashboard** — paper count, avg confidence, evidence-quality breakdown, JSON/CSV export
- **Document Viewer** — split-pane source-vs-extracted-data, resizable, clickable PubMed/DOI links
- **Clerk modal** — auto-themed (dark on dark site, light on light)

(Image files in `docs/screenshots/` to be added by team during final-report compile.)

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Animations | framer-motion + next-themes (light/dark) |
| Auth | Clerk (`@clerk/clerk-react` + `@clerk/themes`), JWT via JWKS |
| Backend | Python 3.12 FastAPI on Vercel serverless functions |
| LLM | Groq API — Llama 3.3 70B Versatile (temp 0.15, JSON mode) |
| PDF | PyMuPDF (fitz) — section-aware extraction |
| DB | Neon Postgres (psycopg3), per-user partition |
| Hosting | Vercel — single domain, 60 s function timeout |

---

## Features

### 1 · Search & Discovery — 13 free academic data sources

| # | Source | Coverage | Auth |
|---|---|---|---|
| 1 | **PubMed** | NIH/NLM biomedical · 35 M+ citations | none |
| 2 | **PMC Full-Text** | Open-access medical full-text | none |
| 3 | **Europe PMC** | Broader OA biomedical + preprints | none |
| 4 | **ClinicalTrials.gov** | NIH registry · 480 k+ trial protocols | none |
| 5 | **PLOS** | Open-access journals (PLOS ONE / Medicine / Biology) | none |
| 6 | **OpenAIRE** | EU aggregator · 250 M+ research products | none |
| 7 | **NIH RePORTER** | NIH-funded project abstracts + investigators | none |
| 8 | **Semantic Scholar** | AI citation graph + TLDR summaries | none |
| 9 | **OpenAlex** | 240 M+ scholarly works, all disciplines | none |
| 10 | **CrossRef** | DOI metadata + abstracts (130 M+) | none |
| 11 | **DOAJ** | Directory of Open Access Journals | none |
| 12 | **arXiv** | Preprints (incl. quantitative biology) | none |
| 13 | **bioRxiv / medRxiv** | Biology + medical preprints | none |

Source-picker chips in the UI; each result card shows a source badge and an "open original" link.

### 2 · AI extraction (anti-hallucination)

- **Strict null-over-guess** — model returns `null` instead of fabricating when evidence is missing
- **Verbatim-only source refs** — every claim must include an exact substring quote from the source
- **Closed-enum study design** — RCT / Cohort / Case-Control / Cross-sectional / Systematic Review / Meta-analysis / Qualitative / Case Report / Other
- **Closed-enum blinding** — Single / Double / Triple / Open-label / Not applicable
- **Calibrated confidence** — explicit 0.0–1.0 ranges with grounding-strength rules

### 3 · Source-grounding validation

- Backend checks each LLM-produced quote against the source text (verbatim or ≥ 60 % word-overlap fallback)
- Returns a per-paper **grounding score** (% of refs verified)
- UI shows green ✓ "grounded" or amber ⚠ "unverified" badge per ref

### 4 · Section-aware PDF pipeline

- PyMuPDF text extraction → de-hyphenate line wraps → strip ligatures (`ﬁ`, `ﬂ`) → normalize whitespace
- Regex-detect 18 standard medical-paper headers (Abstract, Methods, Results, Discussion, Limitations, etc.)
- Build section-tagged input (`[SECTION: METHODS]`, `[SECTION: RESULTS]`, …) for the LLM, capped at ~14000 chars
- Returns `pdf_meta: { pages, sections_detected }` for the UI

### 5 · Auth & security

- Clerk JWT verified server-side via JWKS (RS256); cached 1 hour per Lambda instance
- All 7 protected API endpoints reject without `Authorization: Bearer` → HTTP 401
- Per-user data isolation via verified `sub` claim (used as DB partition key)
- Old `X-User-Id` header path **removed** — clients cannot spoof identity
- PDF size capped at 4 MB client-side (under Vercel's 4.5 MB body limit)

### 6 · UX

- Light + dark mode (Clerk modal auto-syncs)
- Custom logo (transparent PDF + ECG-pulse glyph)
- Animated hero gradient, page transitions, loading screen, sleek pills
- Fully responsive — phones / tablets / desktops
- Document Viewer auto-flips horizontal/vertical at 768 px

---

## Repo layout

```
medai-deploy/
├─ index.html                 # SPA shell, favicon links, anti-flash theme script
├─ src/
│  ├─ App.tsx                 # Routes, ClerkProvider, ThemeProvider, LoadingScreen
│  ├─ main.tsx                # ReactDOM bootstrap
│  ├─ index.css               # Tailwind base + theme tokens (light/dark) + utilities
│  ├─ lib/api.ts              # Typed API client + token-getter singleton + 13-source list
│  ├─ components/
│  │  ├─ ApiAuthBinder.tsx    # Registers Clerk.getToken at mount
│  │  ├─ DashboardLayout.tsx  # Sidebar + header for protected routes
│  │  ├─ ThemeToggle.tsx      # Sun/Moon switcher
│  │  ├─ LoadingScreen.tsx    # Boot-time splash
│  │  ├─ SourceReferences.tsx # Expandable refs with grounded/unverified badges + links
│  │  ├─ PicoTable.tsx, ConfidenceGauge.tsx, ExtractionCards.tsx, DetailedAnalysis.tsx
│  │  └─ ui/*                 # shadcn/ui primitives
│  └─ pages/
│     ├─ LandingPage.tsx
│     ├─ AnalyzerPage.tsx
│     ├─ SearchScreeningPage.tsx
│     ├─ ResultsDashboardPage.tsx
│     ├─ DocumentViewerPage.tsx
│     └─ AboutPage.tsx, NotFound.tsx
├─ api/
│  └─ index.py                # FastAPI app — all /api/* routes
├─ public/                    # favicon (SVG + multi-size PNG), apple-touch-icon
├─ pyproject.toml             # Python deps + requires-python pin
├─ vercel.json                # Rewrites + function config
├─ package.json               # Frontend deps + build scripts
├─ INTERNAL_AUDIT.md          # Full audit, metrics, security tests
├─ WHATSAPP_UPDATE.md         # Shareable team-update message
└─ README.md                  # This file
```

---

## API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | uptime check |
| POST | `/api/search` | JWT | 13-source academic search |
| POST | `/api/fetch-by-id` | JWT | Fetch single paper by PMID/DOI |
| POST | `/api/analyze` | JWT | PDF or text → Groq extraction → save |
| GET | `/api/analyses` | JWT | List user's analyses |
| GET | `/api/analyses/{id}` | JWT | Fetch specific analysis |
| DELETE | `/api/analyses/{id}` | JWT | Delete one |
| DELETE | `/api/analyses` | JWT | Clear all user's analyses |

---

## Database schema (Neon Postgres)

```sql
CREATE TABLE analyses (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,                    -- Clerk verified sub claim
  title           TEXT,
  year            TEXT,
  pico            JSONB,
  demographics    JSONB,
  methodology     JSONB,
  outcomes        JSONB,
  confidence      JSONB,
  source_refs     JSONB,
  input_type      TEXT,                             -- pdf | text | pubmed
  input_label     TEXT,                             -- filename | "PMID:12345" | …
  abstract_text   TEXT,
  summary         TEXT,
  key_findings    JSONB,
  clinical_significance TEXT,
  critical_appraisal    JSONB,
  takeaway_message      TEXT,
  analyzed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

All `SELECT` / `DELETE` statements filter by `user_id = <verified JWT sub>`.

---

## Local development

### Prerequisites

- Node.js 18+
- Python 3.12
- A `.env` file at the repo root with the keys below

### `.env` keys

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
GROQ_API_KEY=gsk_xxx
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
PUBMED_API_KEY=optional
```

> `.env` is gitignored. Never commit it.

### Run frontend (Vite dev server)

```bash
npm install
npm run dev   # → http://localhost:8080
```

### Run backend (local FastAPI)

```bash
cd backend
python -m venv venv
venv/Scripts/activate   # Windows
pip install -r requirements.txt
python main.py          # → http://localhost:8000
```

For local dev pointed at the local backend, set `VITE_API_BASE=http://localhost:8000` in `.env`.

### Deploy to Vercel

```bash
vercel deploy --prod
```

Python backend is auto-detected from `api/index.py` and `pyproject.toml` (Python 3.12 pinned).

---

## QA & accuracy results

See **[INTERNAL_AUDIT.md](./INTERNAL_AUDIT.md)** for the full report.

Headline numbers:

- **13 / 13** sources operational, 130 papers retrievable per query
- **94.4 %** field-level accuracy on synthetic RCT benchmark
- **100 %** verbatim grounding on 3 separate authentic-paper tests
- **0 %** hallucination observed
- **< 2 s** PubMed search → AI analysis
- **< 5 s** PDF analysis (11-page paper)
- **Sub-200 KB** gzipped frontend bundle

---

## Team

This is a college final-year group project. Contributors via GitHub:

- [Vaibhav Lalwani](https://github.com/vaibhav4046)
- [Hitesh Mahajan](https://github.com/hitesh-m-mahajan-AI-DS)
- [Harmeet Kalda](https://github.com/Harmeetkalda)
- [Pranjali Shelke](https://github.com/PranjaliShelke)
- [Yuan Li](https://github.com/yuanlibusiness-beep)
- [Durgesh](https://github.com/durgesh432003)

---

## License

Educational / academic project. Not for redistribution without permission.

---

**Live URL:** https://medai-deploy.vercel.app
