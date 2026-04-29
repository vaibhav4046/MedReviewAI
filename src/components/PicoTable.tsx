import { motion } from "framer-motion";
import type { PicoData } from "@/lib/api";

const picoLabels: { key: keyof PicoData; label: string; color: string; icon: string }[] = [
  { key: "population", label: "Population", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30", icon: "👥" },
  { key: "intervention", label: "Intervention", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30", icon: "💊" },
  { key: "comparison", label: "Comparison", color: "from-amber-500/20 to-amber-600/10 border-amber-500/30", icon: "⚖️" },
  { key: "outcome", label: "Outcome", color: "from-violet-500/20 to-violet-600/10 border-violet-500/30", icon: "🎯" },
];

export default function PicoTable({ data }: { data: PicoData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {picoLabels.map((item, i) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className={`rounded-xl border bg-gradient-to-br p-4 ${item.color}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{item.icon}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {data[item.key] || "Not identified"}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
