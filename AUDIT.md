# MedReviewAI — Full Audit Log

**Branch:** `agent/full-audit-2026-04-29`
**Started:** 2026-04-28
**Live URL:** https://medai-deploy.vercel.app

---

## Stack Summary

- **Framework:** Vite 5 + React 18 + TypeScript SPA (client-rendered, no SSR).
- **Routing:** `react-router-dom` v6.
- **Styling:** Tailwind CSS + `@tailwindcss/typography` + custom utilities in `src/index.css`. shadcn/ui primitives via `@radix-ui/*`. CSS-variable token system for light/dark.
- **State:** React Query (`@tanstack/react-query`) for server state; React local state otherwise. No global store.
- **Auth:** Clerk (`@clerk/clerk-react`, `@clerk/themes`). JWT verified server-side via JWKS.
- **API client:** Hand-rolled `src/lib/api.ts` with token-getter singleton (`ApiAuthBinder` registers on mount).
- **Backend:** FastAPI (Python 3.12) at `api/index.py`, deployed as Vercel serverless function.
- **External integrations:** 13 academic sources (PubMed, PMC, Europe PMC, ClinicalTrials.gov, PLOS, OpenAIRE, NIH RePORTER, Semantic Scholar, OpenAlex, CrossRef, DOAJ, arXiv, bioRxiv via Europe PMC).
- **LLM:** Groq SDK → Llama 3.3 70B Versatile, JSON mode, temp 0.15.
- **PDF:** PyMuPDF (fitz) — section-aware extraction with 18 standard headers.
- **DB:** Neon Postgres, accessed via `psycopg` 3 (binary).
- **Theming:** `next-themes` + class-based dark mode.
- **Animation:** `framer-motion` + Tailwind-animate.
- **Deploy:** Vercel — single domain (`medai-deploy.vercel.app`), 60 s function timeout, single SPA static + Python serverless.
- **Tests:** Vitest scaffolded (`vitest.config.ts`, `src/test/example.test.ts` only) — no real coverage yet.

---

## Page Inventory

| Route | Component | Auth | Status |
|---|---|---|---|
| `/` | `LandingPage` | public | pending |
| `/about` | `AboutPage` | public | pending |
| `/analyzer` | `AnalyzerPage` (in `DashboardLayout`) | JWT | pending |
| `/search` | `SearchScreeningPage` (in `DashboardLayout`) | JWT | pending |
| `/dashboard` | `ResultsDashboardPage` (in `DashboardLayout`) | JWT | pending |
| `/viewer` | `DocumentViewerPage` no-id (in `DashboardLayout`) | JWT | pending |
| `/viewer/:analysisId` | `DocumentViewerPage` (in `DashboardLayout`) | JWT | pending |
| `*` | `NotFound` | public | pending |

Layout wrappers:
- `DashboardLayout` — sidebar nav (5 items: Analyzer / Search & Screen / Results / Document Viewer / About), top header, theme toggle, Clerk `UserButton`. Mobile burger menu.

---

## Component Inventory (top-level src/components/)

- `ApiAuthBinder` — registers Clerk `getToken` into `api.ts` token-getter singleton.
- `ConfidenceGauge` — circular gauge + per-field score bars + grounding chip.
- `DashboardLayout` — sidebar + header for protected routes.
- `DetailedAnalysis` — Executive Summary / Bottom Line / Key Findings / Critical Appraisal blocks.
- `ExtractionCards` — Demographics + Methodology + Outcomes 3-column.
- `LoadingScreen` — full-screen splash for Clerk bootstrap.
- `NavLink` — sidebar nav item.
- `PageTransition` — framer-motion fade for route transitions (currently unused but available).
- `PicoTable` — Population/Intervention/Comparison/Outcome 4-cell card grid.
- `SourceReferences` — expandable refs with grounded/unverified badge + "Open original" link.
- `ThemeToggle` — Sun/Moon toggle wired to `next-themes`.
- `ui/*` — shadcn primitives (button, card, dialog, etc.).

---

## API Endpoint Inventory

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/health` | public | uptime |
| POST | `/api/search` | JWT | 13-source dispatch |
| POST | `/api/fetch-by-id` | JWT | PMID/DOI fetch (PubMed only currently) |
| POST | `/api/analyze` | JWT | PDF or text → Groq → grounding → DB |
| GET  | `/api/analyses` | JWT | List user's analyses |
| GET  | `/api/analyses/{id}` | JWT | Single analysis |
| DELETE | `/api/analyses/{id}` | JWT | Delete one |
| DELETE | `/api/analyses` | JWT | Clear all (per user) |

Auth dep: `verify_clerk_token` — RS256 JWKS verify, returns `sub` claim used as DB partition key.

---

## Shared State Inventory

- React Query (`QueryClient`) configured but most pages call `api.*` directly via `useEffect`/`useState`. Cache layer largely unused — opportunity but out of scope unless impacting UX.
- `next-themes` — single global theme.
- Clerk SDK — auth/user state.
- `api.ts` token-getter singleton — set once at mount via `ApiAuthBinder`.

---

## Third-Party Integrations

- Clerk (auth) — dev keys (`pk_test_*`).
- Groq (LLM).
- Neon Postgres (DB).
- 13 academic-search APIs (none require keys; PubMed key used if present).

---

## Open Questions

1. Should `useEffect` data-fetches migrate to `useQuery`? (out of scope unless persona pass forces it).
2. Clerk dev key showing "Development mode" badge — switch to live key requires user action (prod billing setup); not blocking demo.
3. ClinicalTrials.gov has no abstracts in some results — model returns `null` correctly; UX of "Analyze" on those results currently shows error. Consider disabling Analyze button when abstract empty.
4. Semantic Scholar rate-limited from Vercel IPs intermittently — graceful empty result already; consider a per-source health indicator.

---

## Progress Log

- **2026-04-28 / pass 1.** Branch `agent/full-audit-2026-04-29` created off `main`. Inventory completed. Stack confirmed: Vite SPA + FastAPI on Vercel + Clerk + Groq + Neon. 13 sources operational. Next: Pass 2 (static analysis).

---

## Blocked Items

(none yet)

---

## Persona Pass

(pending)
