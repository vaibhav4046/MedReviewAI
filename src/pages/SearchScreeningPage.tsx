import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import { Search, Loader2, Sparkles, ArrowUpDown, Filter, ChevronDown, ChevronUp, ClipboardList, BarChart3 } from "lucide-react";
import { api, type Paper, type AnalysisResult, type SearchSource, SEARCH_SOURCES } from "@/lib/api";
import PicoTable from "@/components/PicoTable";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import ExtractionCards from "@/components/ExtractionCards";
import SourceReferences from "@/components/SourceReferences";

type SortKey = "title" | "year" | "journal";

export default function SearchScreeningPage() {
  const { userId } = useAuth();
  const [query, setQuery] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [viewingResult, setViewingResult] = useState<string | null>(null);
  const [source, setSource] = useState<SearchSource>("pubmed");

  const doSearch = async (sourceOverride?: SearchSource) => {
    if (!query.trim()) return;
    const activeSource = sourceOverride ?? source;
    setLoading(true);
    setError("");
    setPapers([]);
    setAnalysisResults({});
    setViewingResult(null);
    try {
      const data = await api.searchPubMed(query.trim(), activeSource);
      setPapers(data.papers);
      if (data.papers.length === 0) setError(`No results found in ${SEARCH_SOURCES.find(s => s.id === activeSource)?.label}. Try different keywords or another source.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const switchSource = (next: SearchSource) => {
    setSource(next);
    if (query.trim()) doSearch(next);
  };

  const analyzePaper = async (paper: Paper) => {
    if (!paper.abstract || paper.abstract === "No abstract available.") {
      setError("This paper has no abstract available for analysis.");
      return;
    }
    if (!userId) return;

    setAnalyzingId(paper.id);
    setError("");
    try {
      const r = await api.analyzeText(paper.abstract, userId, paper.pmid);
      setAnalysisResults((prev) => ({ ...prev, [paper.id]: r }));
      setViewingResult(paper.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "title" ? "asc" : "desc"); }
  };

  const sorted = [...papers].sort((a, b) => {
    let r = 0;
    if (sortKey === "title") r = a.title.localeCompare(b.title);
    else if (sortKey === "year") r = a.year.localeCompare(b.year);
    else if (sortKey === "journal") r = a.journal.localeCompare(b.journal);
    return sortDir === "asc" ? r : -r;
  });

  // ─── Viewing analysis result ────────────────────────────
  if (viewingResult && analysisResults[viewingResult]) {
    const res = analysisResults[viewingResult];
    const paper = papers.find((p) => p.id === viewingResult);
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => setViewingResult(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 flex items-center gap-1">
            ← Back to search results
          </button>
          <h1 className="text-2xl font-extrabold text-foreground">{res.title}</h1>
          {paper && <p className="text-sm text-muted-foreground mt-1">{paper.authors} • {paper.journal} ({paper.year})</p>}
        </motion.div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 inline-flex items-center gap-1.5"><ClipboardList className="w-3 h-3" aria-hidden="true" /> PICO Framework</p>
          <PicoTable data={res.pico} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 inline-flex items-center gap-1.5"><BarChart3 className="w-3 h-3" aria-hidden="true" /> Extracted Data</p>
          <ExtractionCards demographics={res.demographics} methodology={res.methodology} outcomes={res.outcomes} />
        </div>
        <ConfidenceGauge data={res.confidence} />
        <SourceReferences refs={res.source_refs || []} inputLabel={res.input_label || `PMID:${papers.find(p => p.id === viewingResult)?.pmid || ""}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="section-label mb-4"><Search className="w-3 h-3" aria-hidden="true" /> Search & Screen</span>
        <h1 className="text-2xl font-extrabold text-foreground mt-3 mb-2">Multi-Source Literature Search</h1>
        <p className="text-sm text-muted-foreground">Search across PubMed, Europe PMC, Semantic Scholar, OpenAlex, and preprints — analyze any paper with AI.</p>
      </motion.div>

      {/* Source picker */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex flex-wrap gap-2">
        {SEARCH_SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => switchSource(s.id)}
            title={s.description}
            aria-pressed={source === s.id}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
              source === s.id
                ? "bg-primary/15 text-primary border-primary/40 shadow-sm"
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </motion.div>

      {/* Search bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="pubmed-search-input"
            name="pubmed-search"
            type="text"
            className="input-field pl-10"
            placeholder="e.g., diabetes mellitus type 2 AND metformin AND randomized controlled trial"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
        </div>
        <button onClick={() => doSearch()} disabled={!query.trim() || loading} className="btn-glow shrink-0 flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-sm text-destructive">{error}</div>
      )}

      {/* Results */}
      {papers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{papers.length} results</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              Sort:
              {(["title", "year", "journal"] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => toggleSort(k)}
                  className={`px-2 py-1 rounded-md transition-colors ${sortKey === k ? "bg-primary/15 text-primary font-semibold" : "hover:text-foreground"}`}
                >
                  {k} {sortKey === k && (sortDir === "asc" ? "↑" : "↓")}
                </button>
              ))}
            </div>
          </div>

          {/* Papers list */}
          <div className="divide-y divide-border/50">
            {sorted.map((paper) => (
              <div key={paper.id} className="hover:bg-muted/10 transition-colors">
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {paper.source && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25">
                          {paper.source}
                        </span>
                      )}
                      {paper.url && (
                        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                          open source ↗
                        </a>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{paper.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{paper.authors}</p>
                    <p className="text-xs text-muted-foreground">{paper.journal} ({paper.year}){paper.pmid ? ` • ID: ${paper.pmid}` : ""}</p>

                    {/* Expandable abstract */}
                    {expandedId === paper.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 p-3 rounded-lg bg-muted/20 border border-border">
                        <p className="text-xs text-muted-foreground leading-relaxed">{paper.abstract}</p>
                      </motion.div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === paper.id ? null : paper.id)}
                      aria-label={expandedId === paper.id ? "Hide abstract" : "Show abstract"}
                      aria-expanded={expandedId === paper.id}
                      className="p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                      title="Toggle abstract"
                    >
                      {expandedId === paper.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => analyzePaper(paper)}
                      disabled={analyzingId === paper.id}
                      className="px-3 py-2 rounded-lg bg-primary/15 border border-primary/25 text-xs font-semibold text-primary hover:bg-primary/25 transition-all flex items-center gap-1.5"
                    >
                      {analyzingId === paper.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {analysisResults[paper.id] ? "View" : "Analyze"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="glass-card p-8 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Searching {SEARCH_SOURCES.find(s => s.id === source)?.label || source}…</p>
        </div>
      )}
    </div>
  );
}
