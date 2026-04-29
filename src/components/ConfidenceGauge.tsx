import { motion } from "framer-motion";
import type { Confidence } from "@/lib/api";

function GaugeRing({ value, size = 80, strokeWidth = 7 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value));
  const offset = circumference * (1 - pct);
  const color = pct >= 0.8 ? "stroke-emerald-400" : pct >= 0.5 ? "stroke-amber-400" : "stroke-rose-400";
  const bgColor = pct >= 0.8 ? "stroke-emerald-400/15" : pct >= 0.5 ? "stroke-amber-400/15" : "stroke-rose-400/15";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className={bgColor} strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-sm font-extrabold text-foreground">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className="text-xs font-bold text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const styles: Record<string, string> = {
    High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    Moderate: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    Low: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[quality] || styles.Low}`}>
      {quality === "High" ? "✅" : quality === "Moderate" ? "⚠️" : "🚨"} {quality} Evidence
    </span>
  );
}

export default function ConfidenceGauge({ data }: { data: Confidence }) {
  const isLowConfidence = data.overall < 0.5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Confidence Analysis</h3>
        <QualityBadge quality={data.evidence_quality} />
      </div>

      {isLowConfidence && (
        <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm text-rose-300 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span>Low confidence — extracted data may be incomplete or unreliable. Verify manually.</span>
        </div>
      )}

      <div className="flex items-center gap-6">
        <GaugeRing value={data.overall} size={90} strokeWidth={8} />
        <div className="flex-1 space-y-2.5">
          <ScoreBar label="Population" value={data.population_score} />
          <ScoreBar label="Intervention" value={data.intervention_score} />
          <ScoreBar label="Outcome" value={data.outcome_score} />
          <ScoreBar label="Methodology" value={data.methodology_score} />
        </div>
      </div>

      {typeof data.grounding_score === "number" && (
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Source Grounding</p>
            <p className="text-xs text-muted-foreground">% of refs verified verbatim in source text</p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
              data.grounding_score >= 0.8
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                : data.grounding_score >= 0.5
                ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                : "bg-rose-500/15 text-rose-400 border-rose-500/25"
            }`}
          >
            {Math.round(data.grounding_score * 100)}%
          </span>
        </div>
      )}

      {data.limitations && (
        <div className="pt-3 border-t border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Limitations</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.limitations}</p>
        </div>
      )}
    </motion.div>
  );
}
