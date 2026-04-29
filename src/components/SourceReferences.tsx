import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Quote, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import type { SourceRef } from "@/lib/api";

function sourceUrlFromLabel(label?: string): { url: string; kind: string } | null {
  if (!label) return null;
  const pm = label.match(/PMID[:\s]*(\d{4,})/i);
  if (pm) return { url: `https://pubmed.ncbi.nlm.nih.gov/${pm[1]}`, kind: "PubMed" };
  if (/^https?:\/\//i.test(label.trim())) return { url: label.trim(), kind: "Source URL" };
  const doi = label.match(/(10\.\d{4,}\/\S+)/);
  if (doi) return { url: `https://doi.org/${doi[1]}`, kind: "DOI" };
  return null;
}

function RefItem({ sourceRef, index, sourceUrl, sourceKind }: { sourceRef: SourceRef; index: number; sourceUrl?: string; sourceKind?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border border-border rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <Quote className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground flex-1">{sourceRef.field}</span>
        {sourceRef.grounded === false ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0" title="Quote not found verbatim in source — flag as low-confidence">
            <AlertTriangle className="w-2.5 h-2.5" />
            unverified
          </span>
        ) : sourceRef.grounded === true ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shrink-0" title="Quote verified verbatim in source text">
            <ShieldCheck className="w-2.5 h-2.5" />
            grounded
          </span>
        ) : null}
        <span className="text-[10px] text-muted-foreground shrink-0">{sourceRef.location}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-3">
                "{sourceRef.snippet}"
              </p>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View in source on {sourceKind}
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SourceReferences({ refs, inputLabel }: { refs: SourceRef[]; inputLabel?: string }) {
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? refs : refs.slice(0, 4);
  const sourceLink = sourceUrlFromLabel(inputLabel);

  if (refs.length === 0 && !sourceLink) {
    return (
      <div className="glass-card p-5 text-center">
        <p className="text-sm text-muted-foreground">No source references available.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Source References</h3>
        <span className="text-xs text-muted-foreground">{refs.length} references</span>
      </div>
      {sourceLink && (
        <a
          href={sourceLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground">Open original on {sourceLink.kind}</span>
          </div>
          <span className="text-[10px] text-muted-foreground truncate max-w-[55%]">{sourceLink.url}</span>
        </a>
      )}
      <div className="space-y-2">
        {display.map((r, i) => (
          <RefItem
            key={`${r.field}-${i}`}
            sourceRef={r}
            index={i}
            sourceUrl={sourceLink?.url}
            sourceKind={sourceLink?.kind}
          />
        ))}
      </div>
      {refs.length > 4 && (
        <button
          onClick={() => setShowAll((p) => !p)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          {showAll ? "Show less" : `Show all ${refs.length} references`}
        </button>
      )}
    </motion.div>
  );
}
