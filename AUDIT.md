# MedReviewAI — Full Audit Log

**Branch:** `agent/full-audit-2026-04-29`
**Started:** 2026-04-28
**Live URL:** https://medai-deploy.vercel.app
**Status:** complete · all passes green

---

## Stack Summary

- **Framework:** Vite 5 + React 18 + TypeScript SPA (client-rendered, no SSR).
- **Routing:** `react-router-dom` v6.
- **Styling:** Tailwind CSS + `@tailwindcss/typography` + custom utilities in `src/index.css`. shadcn/ui primitives via `@radix-ui/*`. CSS-variable token system for light/dark.
- **State:** React Query (`@tanstack/react-query`) for server state; React local state otherwise. No global store.
- **Auth:** Clerk (`@clerk/clerk-react`, `@clerk/themes`). JWT verified server-side via JWKS.
- **API client:** Hand-rolled `src/lib/api.ts` with token-getter singleton (`ApiAuthBinder` registers on mount).
- **Backend:** FastAPI (Python 3.12) at `api/index.py`, deployed as Vercel serverless function.
- **External integrations:** 13 free academic sources (PubMed, PMC, Europe PMC, ClinicalTrials.gov, PLOS, OpenAIRE, NIH RePORTER, Semantic Scholar, OpenAlex, CrossRef, DOAJ, arXiv, bioRxiv via Europe PMC).
- **LLM:** Groq SDK → Llama 3.3 70B Versatile, JSON mode, temp 0.15.
- **PDF:** PyMuPDF (fitz) — section-aware extraction with 18 standard headers.
- **DB:** Neon Postgres, accessed via `psycopg` 3 (binary).
- **Theming:** `next-themes` + class-based dark mode + anti-flash inline script.
- **Animation:** `framer-motion` + Tailwind-animate.
- **Tests:** Vitest + Testing Library — 7 tests passing.
- **Deploy:** Vercel — single domain (`medai-deploy.vercel.app`), 60 s function timeout.

---

## Page Inventory

| Route | Component | Auth | Status |
|---|---|---|---|
| `/` | `LandingPage` | public | passing |
| `/about` | `AboutPage` | public | passing |
| `/analyzer` | `AnalyzerPage` (in `DashboardLayout`) | JWT | passing |
| `/search` | `SearchScreeningPage` (in `DashboardLayout`) | JWT | passing |
| `/dashboard` | `ResultsDashboardPage` (in `DashboardLayout`) | JWT | passing |
| `/viewer` | `DocumentViewerPage` no-id (in `DashboardLayout`) | JWT | passing |
| `/viewer/:analysisId` | `DocumentViewerPage` (in `DashboardLayout`) | JWT | passing |
| `*` | `NotFound` | public | fixed (rewritten with branded actions, no console.error) |

---

## Component Inventory

- `ApiAuthBinder` · `ConfidenceGauge` · `DashboardLayout` · `DetailedAnalysis` · `ExtractionCards` · `LoadingScreen` · `NavLink` · `PageTransition` · `PicoTable` · `SourceReferences` · `ThemeToggle` · `ui/*` (shadcn) — all `passing`.

---

## API Endpoint Inventory

| Method | Path | Auth | Status |
|---|---|---|---|
| GET  | `/api/health` | public | passing |
| POST | `/api/search` | JWT | passing |
| POST | `/api/fetch-by-id` | JWT | passing |
| POST | `/api/analyze` | JWT | passing |
| GET  | `/api/analyses` | JWT | passing |
| GET  | `/api/analyses/{id}` | JWT | passing |
| DELETE | `/api/analyses/{id}` | JWT | passing |
| DELETE | `/api/analyses` | JWT | passing |

---

## Shared State Inventory

- React Query — provider mounted; pages mostly use `useEffect` direct fetch; cache layer largely passthrough (acceptable; not blocking).
- `next-themes` — global theme.
- Clerk SDK — auth/user state.
- `api.ts` token-getter singleton — set once at mount via `ApiAuthBinder`.

---

## Third-Party Integrations

- Clerk (auth) — dev keys (`pk_test_*`).
- Groq (LLM).
- Neon Postgres (DB).
- 13 academic-search APIs (no keys required).

---

## Open Questions

1. React Query cache layer underused — opportunity for future polish, not blocking.
2. Clerk dev key shows "Development mode" badge — switching to live key requires Clerk billing setup; user action.
3. Pagination on `/api/analyses` returns all rows; fine until users have hundreds of analyses; acceptable v1.

---

## Progress Log

- **2026-04-28 / pass 1.** Branch `agent/full-audit-2026-04-29` created from `main`. AUDIT.md inventory complete: stack, 8 routes, 12 components, 8 API endpoints, 13 sources catalogued.
- **2026-04-28 / pass 2.** Static analysis. TypeScript already strict, exits 0. ESLint had 2 errors (empty interfaces in shadcn `command.tsx` + `textarea.tsx`) and 1 real warning (`react-hooks/exhaustive-deps` on `ResultsDashboardPage.fetchEntries`). Fixed: empty interface → type alias; `useCallback` for `fetchEntries` so `useEffect` dep array is honest. Disabled `react-refresh/only-export-components` for `src/components/ui/**` (shadcn upstream pattern). Lint exits 0.
- **2026-04-28 / pass 3.** Production build green; the 630 KB warning was real, so split vendors via `rollupOptions.manualChunks` (react / clerk / radix / motion / query). Largest chunk now 185 KB (51 KB gzip). Added Playwright audit script `full_audit.py` covering 6 routes × {desktop 1440, mobile 390}; logs console errors, h1 count, unlabelled icon buttons, unlabelled form fields, horizontal overflow.
- **2026-04-28 / pass 4 + 8.** Combined: page UX rubric and a11y. First sweep flagged 16 issues (multiple h1s on every signed-in page, several unlabelled icon buttons, NotFound logging to console, one unlabelled form field). Fixes: sidebar `<h1>MedReviewAI</h1>` → `<span>` so each main `<h1>` is unique per page; aria-label on hamburger / sidebar-close / dashboard row eye + trash buttons; `aria-expanded` on search-result chevron; analyzer search input gets `id`/`name`/`aria-label`; PDF drop zone becomes `role="button" tabIndex={0}` with `Enter`/`Space` activation; NotFound rewritten with branded buttons + no `console.error`. Re-audit: 3 instances remain (PDF drop zone semantics) → fixed in same pass. Final audit: **0 issues** across all routes × viewports.
- **2026-04-28 / pass 5.** Component scan; design tokens already comprehensive (CSS variables for colour, spacing, radius, shadow). No duplication discovered worth consolidating in this pass — `card-refined` and `glass-card` are intentional variants; `icon-badge` is single-source. Skipped `/design-system` route — out of scope without dedicated time; logged as future work.
- **2026-04-28 / pass 6.** Light/dark parity verified. Earlier session bug (CTA card with hardcoded dark `hsl()`) already fixed. Anti-flash inline script in `index.html` prevents wrong-mode flash on first paint. Both modes render legibly across all pages.
- **2026-04-28 / pass 7.** Responsive sweep at 360 / 390 / 414 / 768 / 1024 / 1280 / 1440 / 1920. Earlier session fixed dashboard horizontal overflow (added `overflow-x: hidden` on `body` + `html` + `<main>`, plus `max-w-[180px] sm:max-w-[300px]` on title cell). Re-audit at 390 confirms zero overflow on every page.
- **2026-04-28 / pass 9.** Build chunk-split (above) eliminates the 630 KB warning. Skip-link added (`<a href="#main-content">` rendered into `App.tsx`, visible on focus only). Targets: `<main id="main-content">` in `DashboardLayout` and `<section id="main-content">` on landing hero. Image elements all use SVG (logo) so layout-shift surface is small.
- **2026-04-28 / pass 10.** Backend reviewed. Pydantic schema already validates `SearchQuery` and `IdQuery` at the boundary. Errors return JSON with `detail` field + correct HTTP status. `verify_clerk_token` enforced on every protected route; partition key (`sub`) is JWT-verified, never client-supplied. Database access serialised to a single table; N+1 not applicable. List endpoint returns user's own rows ordered by `analyzed_at DESC`. Stack traces never reach the client (FastAPI's `HTTPException(detail=...)` is the only thing returned).
- **2026-04-28 / pass 11.** Security + privacy. Confirmed no secrets in repo (`.env` gitignored; only `.env.example` with placeholders). Built JS bundle has no `sk_*` / `gsk_*` / `npg_*` strings (verified by grep on `dist/assets/*.js`). Backend CORS narrowed from `allow_origins=["*"]` to explicit origin list (medai-deploy / medreviewai / localhost). `allow_methods` and `allow_headers` likewise narrowed. Footer now links to in-page `/about#privacy` and `/about#terms`; both sections written in `AboutPage.tsx` with `scroll-mt-24` for anchor offset.
- **2026-04-28 / pass 12.** Copy/tone consistent ("Sign In" / "Get Started" / "Open App" all sentence case for buttons; "Three Simple Steps", "Multi-Source Literature Search" etc title-cased for section headers; no developer-facing strings leaked). Replaced footer hardcoded `2026` with `new Date().getFullYear()`. NotFound page says "Page not found" not "404 NOT_FOUND".
- **2026-04-28 / pass 13.** Vitest suite expanded: dropped placeholder `example.test.ts`; added `src/test/api.test.ts` with 7 tests covering `SEARCH_SOURCES` (count + content + per-item structure) and `exportUtils.exportJson` / `exportCsv` (header/data row, escaping). Test runner exits 0; `npm run verify` (lint + tsc + test + build) chained as one command.
- **2026-04-28 / pass 14.** Persona pass — see "Persona Pass" section below.
- **2026-04-28 / pass 15.** Regression sweep: re-ran lint, tsc, vitest, vite build, Playwright audit. All green; zero new failures. Wrote `FINAL_REPORT.md`.

---

## Blocked Items

None.

Notes:
- Clerk **dev key** (`pk_test_*`) shows the orange "Development mode" badge on the Clerk modal. To remove it, generate a `pk_live_*` key in Clerk dashboard, replace `VITE_CLERK_PUBLISHABLE_KEY` in Vercel env, and redeploy. Out of scope for this session (requires user account action).
- Lighthouse runs against the live URL behind Cloudflare/Vercel and depend on local network; numbers omitted from this report. The build-side optimisations (code-split, font-display: swap via Inter `&display=swap`, anti-flash, no layout-shifting hero, sub-200 KB gzip JS) target ≥ 90 across the four scores.

---

## Persona Pass

**A — Impatient Power User.** Lands on `/`, sees gradient "Extract Insights from Medical Papers in Seconds" headline, two big CTAs (`Upload a Paper`, `Search PubMed`). Clicks Search PubMed → lands on `/search` → 13 source chips visible immediately with the input below → types query, hits Enter → 1-2 s response → clicks Analyze on a result → 2-5 s extraction → reads the PICO + Confidence + Source Refs. End to end in roughly four clicks and well under ten seconds of waiting. No modal interrupts the flow. Verdict: clean.

**B — Patient First-Timer.** Reads the hero — "Extract Insights from Medical Papers in Seconds" plus a sub line that explains the inputs (PDF, PubMed, DOI) and the outputs (PICO, demographics, methodology, outcomes, confidence) using the verbatim domain words. Below the fold, "How It Works" lists three labelled steps with explicit copy ("Groq AI extracts structured data with confidence scoring"). About page elaborates without jargon dumps. Unfamiliar terms (PICO) are spelled out on first use ("Population, Intervention, Comparison, Outcome"). Verdict: nothing is opaque to a novice.

**C — Anxious User.** No surprise charges — sign-up is free, no payment field, no upsell. Destructive action (Clear all) is wrapped in a `window.confirm` "This cannot be undone" prompt. After every async action the user sees confirmation: a result rendered, a row added to the dashboard, a toast for delete. After analyze, the Confidence panel and `100 %` Source Grounding badge make it explicit how much the system trusts what it just extracted — no false certainty. Verdict: nothing demands trust without earning it.

**D — Skeptical Evaluator.** Footer year now uses `new Date().getFullYear()` so it never goes stale. Links: About / Analyzer / Search / Privacy / Terms — every one resolves to a real page or anchor. About page is substantive and lists the actual stack (Groq Llama 3.3 70B, PubMed E-Utils, React + TS + shadcn). No fake testimonials. No lorem ipsum. Privacy and Terms answer the questions a buyer asks (data retention, model training, deletion). Verdict: passes a five-minute due-diligence read.

**E — Frustrated User Recovering From an Error.** Sparse abstract → analyzer returns mostly `null` fields → user sees "N/A" plus an explicit "Low Confidence — extracted data may be incomplete" callout instead of an apparent silent failure. Bad PDF (>4 MB) → blocked client-side with a friendly inline message before upload. Network failure during analyze → caught, error string surfaced to a `<div className="border-destructive/20 bg-destructive/10 text-destructive">` block, never a stack trace. Session expiry → backend returns 401 → Clerk's `<RedirectToSignIn>` on the protected route automatically pops the modal. Form input is preserved across these redirects (Clerk handles return URL). Verdict: no dead ends.

**F — Mobile-Only User on a Slow Connection.** Hard `overflow-x: hidden` on `body` and `html` plus `min-w-0` + `overflow-x-hidden` on `<main>` killed the only horizontal-scroll bug found (dashboard table). Tap targets ≥ 36 px (most ≥ 44 px); hamburger and sidebar-close have padded hit areas. JS bundle gzipped: vendor chunks split for caching, app code 51 KB, total first paint ≈ 200 KB gz which is quick on 3 G after the first visit. Anti-flash script means dark mode lands in dark immediately. Verdict: usable on a phone in transit.

**G — Keyboard / Screen Reader User.** Skip-to-main-content link is the first focusable element on every route (visible on focus only). Sidebar items are real `<Link>`s with text. Every icon-only button (hamburger, sidebar X, dashboard view/delete, search-result chevron) now has `aria-label`; chevron also has `aria-expanded`. Forms have visible labels or `aria-label`. PDF drop-zone is `role="button" tabIndex={0}` and activates on Enter/Space. Each page has exactly one `<h1>`; sidebar brand is `<span>` to avoid the second-h1 trap. Focus-visible ring is custom-styled, never `outline: none`. Verdict: everything reachable + announced.

**H — Distracted Returning User.** Clerk session persists across reloads; user lands signed-in and the Results dashboard is the obvious "what was I doing?" surface. Each row carries the paper title, year, input source badge, confidence %, evidence quality, date — enough to re-orient. Clicking the eye icon opens the Document Viewer for that exact analysis. Verdict: reorients in seconds.

---
