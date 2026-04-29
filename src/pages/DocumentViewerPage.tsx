import { useEffect, useState, useLayoutEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, type HistoryEntry } from "@/lib/api";
import { ArrowLeft, FileText, Loader2, BarChart3 } from "lucide-react";
import PicoTable from "@/components/PicoTable";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import SourceReferences from "@/components/SourceReferences";
import ExtractionCards from "@/components/ExtractionCards";
import DetailedAnalysis from "@/components/DetailedAnalysis";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function DocumentViewerPage() {
  const { userId } = useAuth();
  const { analysisId } = useParams<{ analysisId: string }>();
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [panelDir, setPanelDir] = useState<"horizontal" | "vertical">(
    typeof window !== "undefined" && window.innerWidth >= 768 ? "horizontal" : "vertical"
  );

  useLayoutEffect(() => {
    const onResize = () => setPanelDir(window.innerWidth >= 768 ? "horizontal" : "vertical");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!analysisId || !userId) return;
    setLoading(true);
    api.getAnalysis(analysisId, userId)
      .then(setEntry)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analysis"))
      .finally(() => setLoading(false));
  }, [analysisId, userId]);

  if (!analysisId) {
    return (
      <div className="text-center py-20">
        <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1.5} aria-hidden="true" />
        <div className="text-sm font-semibold text-foreground mb-1">No document selected</div>
        <div className="text-xs text-muted-foreground mb-4">
          Analyze a paper first, then view it here.
        </div>
        <Link to="/analyzer" className="btn-glow text-sm inline-flex items-center gap-2">
          <FileText className="w-4 h-4" /> Go to Analyzer
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-3">❌</div>
        <div className="text-sm font-semibold text-foreground mb-1">{error || "Analysis not found"}</div>
        <Link to="/dashboard" className="text-sm text-primary hover:underline mt-2 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  const { result, abstractText, inputType } = entry;

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)]">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-foreground truncate">{result.title}</h1>
            <p className="text-xs text-muted-foreground">{result.year} • {inputType?.toUpperCase()} input</p>
          </div>
        </div>
      </motion.div>

      <ResizablePanelGroup direction={panelDir} className="rounded-xl border border-border overflow-hidden flex-1 min-h-0" style={{ height: panelDir === "horizontal" ? "calc(100vh - 12rem)" : "auto", minHeight: panelDir === "vertical" ? "150vh" : undefined }}>
        {/* Left panel: Source text */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="h-full flex flex-col bg-card/40">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Source Document
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {abstractText ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Abstract</p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{abstractText}</p>
                  </div>

                  {result.source_refs && result.source_refs.length > 0 && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Referenced Snippets</p>
                      <div className="space-y-2">
                        {result.source_refs.map((ref, i) => (
                          <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <span className="text-[10px] font-semibold text-primary uppercase">{ref.field}</span>
                            <p className="text-xs text-foreground mt-1 italic">"{ref.snippet}"</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{ref.location}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">PDF uploaded — text preview not available.</p>
                  <p className="text-xs text-muted-foreground mt-1">The extracted data is shown on the right panel.</p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel: Extracted data */}
        <ResizablePanel defaultSize={60} minSize={35}>
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
<BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> Extracted Data
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <DetailedAnalysis result={result} />

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">PICO Framework</p>
                <PicoTable data={result.pico} />
              </div>

              <ExtractionCards
                demographics={result.demographics}
                methodology={result.methodology}
                outcomes={result.outcomes}
              />

              <ConfidenceGauge data={result.confidence} />

              <SourceReferences refs={result.source_refs || []} inputLabel={entry.inputLabel} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
