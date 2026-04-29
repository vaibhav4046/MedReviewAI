import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, AlertCircle, Quote, Lightbulb, ShieldCheck } from "lucide-react";
import type { AnalysisResult } from "@/lib/api";

interface DetailedAnalysisProps {
  result: AnalysisResult;
}

export default function DetailedAnalysis({ result }: DetailedAnalysisProps) {
  const {
    summary,
    key_findings,
    clinical_significance,
    critical_appraisal,
    takeaway_message,
  } = result;

  // If no detailed analysis is available, don't render
  if (!summary && !key_findings && !clinical_significance) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Quote className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" /> Executive Summary
          </h3>
          <p className="text-sm text-foreground leading-relaxed italic">
            "{summary}"
          </p>
        </motion.div>
      )}

      {/* Takeaway Message */}
      {takeaway_message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Bottom Line
          </p>
          <p className="text-sm font-semibold text-foreground italic">
            {takeaway_message}
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Key Findings */}
        {key_findings && key_findings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Findings
            </h3>
            <div className="space-y-2">
              {key_findings.map((finding, i) => (
                <div key={i} className="flex gap-2.5 items-start p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p className="text-xs text-foreground leading-relaxed">{finding}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Clinical Significance */}
        {clinical_significance && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Clinical Significance
            </h3>
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 min-h-[120px]">
              <p className="text-xs text-foreground leading-relaxed">
                {clinical_significance}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Critical Appraisal */}
      {critical_appraisal && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-primary" /> Critical Appraisal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Strengths</p>
              <ul className="space-y-1.5">
                {critical_appraisal.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">+</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
              <p className="text-[10px] font-bold text-rose-400 uppercase mb-2">Weaknesses / Limitations</p>
              <ul className="space-y-1.5">
                {critical_appraisal.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <span className="text-rose-400 font-bold">−</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
