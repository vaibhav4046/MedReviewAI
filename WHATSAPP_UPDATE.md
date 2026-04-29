🚀 *MedReviewAI — Big Update*

🔗 *https://medai-deploy.vercel.app*

Sign in with any email (dev mode = no verification needed) and please test below. Reply with any bug / weirdness.

━━━━━━━━━━━━━━━━━━━━━━

*✨ NEW FEATURES SHIPPED*

*1. 13 Free Academic Sources* (was: only PubMed)
PubMed · PMC Full-Text · Europe PMC · ClinicalTrials.gov · PLOS · OpenAIRE · NIH RePORTER · Semantic Scholar · OpenAlex · CrossRef · DOAJ · arXiv · bioRxiv/medRxiv

Switch sources from chips on the Search page or Analyzer → Search PubMed tab.

*2. Source-Grounded Extraction*
Every claim the AI makes now includes a verbatim quote from the paper. Backend verifies each quote is a real substring of the source. UI shows green ✓ "grounded" or amber ⚠ "unverified" per ref.

*3. Source URLs on Every Paper*
Each result card shows source badge + "open source ↗" link. References inside analysis link back to PubMed / DOI / etc.

*4. PDF Pipeline Upgraded*
Section-aware extraction — detects 18 standard medical-paper headers (Abstract, Methods, Results, Discussion, etc.) and feeds tagged text to the LLM. Returns `pdf_meta` with detected sections + page count.

*5. Hallucination-Proof Prompt*
Model now returns `null` instead of guessing when evidence is missing. Strict closed-enum study designs (RCT, Cohort, Meta-analysis, etc.). Verbatim-only references.

*6. JWT Auth on Every API Route*
Backend verifies Clerk JWT (RS256 + JWKS) on every protected endpoint. No bearer = 401. User data partitioned by verified Clerk `sub`.

*7. Light + Dark Mode*
Toggle in nav. Clerk modal auto-switches with site theme.

*8. Grounding Score in Confidence Panel*
Shows % of refs verified verbatim. Color-coded.

*9. Loading States Per Source*
Now says "Searching ClinicalTrials.gov…" / "Searching PLOS…" instead of always "Searching PubMed…"

*10. Sleek New Logo + Animations*
Transparent gradient PDF+pulse logo. Animated hero gradient. Page transitions. Float-in cards.

━━━━━━━━━━━━━━━━━━━━━━

*🧪 PLEASE TEST THESE PATHS*

1. Sign in → Search & Screen → switch source chips → click *open source ↗* on a result → confirm it opens the paper at the real database
2. Click *Analyze* on a paper → wait 2-5s → check PICO + Demographics + Statistics fields filled correctly
3. Open Source References → confirm each ref shows green ✓ grounded → click *Open original on PubMed* → opens correct paper
4. Upload a small PDF (<4MB) on the Upload PDF tab → verify analysis returns
5. Toggle Sun/Moon icon → both light + dark modes readable
6. Resize browser to phone width → check responsive layout
7. Sign out → site shows landing with Sign In + Get Started

━━━━━━━━━━━━━━━━━━━━━━

*📊 FOR THE FINAL REPORT — Key Numbers*

▪ *13 free academic sources* — zero API keys, zero cost
▪ *94.4% field-level accuracy* on benchmark RCT (synthetic ground-truth test)
▪ *100% verbatim grounding* on 3 separate authentic-paper tests
▪ *0% hallucination* observed in tests (returns null, not fabricated text)
▪ *<2s* search-to-analysis on PubMed abstract
▪ *<5s* PDF analysis (11-page paper, sections detected)
▪ *13/13 sources* return 10 papers each per query
▪ *Sub-200KB* gzipped frontend bundle
▪ *Production-grade JWT auth* on all 7 protected endpoints
▪ *Per-user data isolation* via verified Clerk `sub`

━━━━━━━━━━━━━━━━━━━━━━

*🛠 Tech Stack (one-liner)*
React 18 + TypeScript + Vite + Tailwind frontend. Python 3.12 FastAPI on Vercel serverless. Groq Llama 3.3 70B for extraction. Neon Postgres + Clerk auth.

*🏗 Architecture*
SPA on Vercel with `/api/*` rewrites to Python serverless functions. Frontend `ApiAuthBinder` auto-attaches Clerk JWT to every request. Backend `verify_clerk_token` dependency validates RS256 against Clerk JWKS (1h cache). All DB queries partitioned by verified user.

━━━━━━━━━━━━━━━━━━━━━━

*📄 Full audit report:* `INTERNAL_AUDIT.md` in project root — has all metrics, security tests, performance numbers, and architecture details for the final report PDF.

Test it. Break it if you can. Send screenshots/issues here. 🙏

🔗 *https://medai-deploy.vercel.app*
