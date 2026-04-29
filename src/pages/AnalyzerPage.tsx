import { useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Link2, Search, FileText, Loader2, X, Sparkles, ArrowRight } from "lucide-react";
import { api, type AnalysisResult, type Paper, type SearchSource, SEARCH_SOURCES } from "@/lib/api";
import PicoTable from "@/components/PicoTable";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import SourceReferences from "@/components/SourceReferences";
import ExtractionCards from "@/components/ExtractionCards";

type Tab = "upload" | "url" | "search";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "upload", label: "Upload PDF", icon: Upload },
  { id: "url", label: "URL / DOI", icon: Link2 },
  { id: "search", label: "Search PubMed", icon: Search },
];

export default function AnalyzerPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState<SearchSource>("pubmed");
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── PDF upload ─────────────────────────────────────────
  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    const MAX_PDF_BYTES = 4 * 1024 * 1024;
    if (f.size > MAX_PDF_BYTES) {
      setError(`PDF is ${(f.size / 1024 / 1024).toFixed(2)} MB. Max is 4 MB. Please upload a smaller file.`);
      return;
    }
    setFile(f);
    setError("");
  };

  const analyzePdf = async () => {
    if (!file || !userId) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const r = await api.analyzePdf(file, userId);
      setResult(r);
      // Result is auto-saved to DB by the backend
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── URL / DOI ──────────────────────────────────────────
  const analyzeUrl = async () => {
    if (!urlInput.trim() || !userId) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const paper = await api.fetchByPmid(urlInput.trim());
      if (!paper.abstract || paper.abstract === "No abstract available.") {
        throw new Error("This paper has no abstract available for analysis.");
      }
      const r = await api.analyzeText(paper.abstract, userId, paper.pmid);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch or analyze paper");
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── PubMed search ─────────────────────────────────────
  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError("");
    setSearchResults([]);
    try {
      const data = await api.searchPubMed(searchQuery.trim(), searchSource);
      setSearchResults(data.papers);
      if (data.papers.length === 0) setError("No results found.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const analyzeSearchResult = async (paper: Paper) => {
    if (!paper.abstract || paper.abstract === "No abstract available.") {
      setError("This paper has no abstract available for analysis.");
      return;
    }
    if (!userId) return;
    
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const r = await api.analyzeText(paper.abstract, userId, paper.pmid);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Drag & drop ────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const clearResult = () => {
    setResult(null);
    setFile(null);
    setUrlInput("");
    setError("");
  };

  // ─── Results view ───────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{result.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{result.year}</p>
          </div>
          <div className="flex gap-3">
            {result.id && (
              <button
                onClick={() => navigate(`/viewer/${result.id}`)}
                className="px-4 py-2 rounded-xl border border-border bg-muted/30 text-sm font-semibold text-foreground hover:bg-muted/60 transition-all flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> View in Document Viewer
              </button>
            )}
            <button onClick={clearResult} className="px-4 py-2 rounded-xl border border-border bg-muted/30 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all">
              Analyze Another
            </button>
          </div>
        </motion.div>

        {/* PICO */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">📋 PICO Framework</p>
          <PicoTable data={result.pico} />
        </div>

        {/* Extraction cards */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">📊 Extracted Data</p>
          <ExtractionCards demographics={result.demographics} methodology={result.methodology} outcomes={result.outcomes} />
        </div>

        {/* Confidence */}
        <ConfidenceGauge data={result.confidence} />

        {/* Source refs */}
        <SourceReferences refs={result.source_refs || []} inputLabel={result.input_label} />
      </div>
    );
  }

  // ─── Input view ─────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="section-label mb-4">📄 Paper Analyzer</span>
        <h1 className="text-2xl font-extrabold text-foreground mt-3 mb-2">Analyze a Medical Paper</h1>
        <p className="text-sm text-muted-foreground">
          Upload a PDF, paste a PubMed URL or DOI, or search by keyword to extract structured data.
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                ${activeTab === tab.id
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab content */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6">
        <AnimatePresence mode="wait">
          {activeTab === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`drop-zone cursor-pointer ${dragOver ? "drop-zone-active" : ""}`}
              >
                <input
                  ref={fileRef}
                  id="pdf-upload-input"
                  name="pdf-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Upload className={`w-10 h-10 mb-3 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-semibold text-foreground mb-1">
                  {file ? file.name : "Drop a PDF here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Supports .pdf files up to 4MB"}
                </p>
                {file && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>
              <button onClick={analyzePdf} disabled={!file || analyzing} className="btn-glow w-full mt-4 flex items-center justify-center gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "Analyze PDF"}
              </button>
            </motion.div>
          )}

          {activeTab === "url" && (
            <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">PubMed URL, PMID, or DOI</label>
                <input
                  id="pubmed-url-input"
                  name="pubmed-url"
                  type="text"
                  className="input-field"
                  placeholder="e.g., 12345678, https://pubmed.ncbi.nlm.nih.gov/12345678/, or 10.1234/example"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyzeUrl()}
                />
              </div>
              <button onClick={analyzeUrl} disabled={!urlInput.trim() || analyzing} className="btn-glow w-full flex items-center justify-center gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "Fetch & Analyze"}
              </button>
            </motion.div>
          )}

          {activeTab === "search" && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {SEARCH_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSearchSource(s.id)}
                    title={s.description}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                      searchSource === s.id
                        ? "bg-primary/15 text-primary border-primary/40"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    className="input-field pl-10"
                    placeholder="e.g., pancreatic cancer survival rate"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  />
                </div>
                <button onClick={doSearch} disabled={!searchQuery.trim() || searchLoading} className="btn-glow shrink-0 flex items-center gap-2">
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {searchResults.map((paper) => (
                    <div key={paper.id} className="p-4 rounded-xl border border-border bg-card/40 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {paper.source && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25">
                                {paper.source}
                              </span>
                            )}
                            {paper.url && (
                              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                open source ↗
                              </a>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-foreground leading-snug">{paper.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{paper.authors} • {paper.journal} ({paper.year})</p>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{paper.abstract}</p>
                        </div>
                        <button
                          onClick={() => analyzeSearchResult(paper)}
                          disabled={analyzing}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/25 text-xs font-semibold text-primary hover:bg-primary/25 transition-all flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3 h-3" /> Analyze
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-sm text-destructive">
          {error}
        </motion.div>
      )}

      {analyzing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 text-center animate-pulse-glow">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Analyzing paper with AI...</p>
          <p className="text-xs text-muted-foreground mt-1">Extracting PICO, demographics, methodology, and outcomes</p>
        </motion.div>
      )}
    </div>
  );
}
