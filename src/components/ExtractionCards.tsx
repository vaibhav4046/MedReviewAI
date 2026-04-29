import { motion } from "framer-motion";
import { Users, FlaskConical, Stethoscope, BarChart3 } from "lucide-react";
import type { Demographics, Methodology, OutcomeData } from "@/lib/api";

function DataRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground font-medium shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right">{value || "N/A"}</span>
    </div>
  );
}

function CardHeader({ icon: Icon, title, accent }: { icon: React.ElementType; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-muted/60 ${accent}`}>
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

export function DemographicsCard({ data }: { data: Demographics }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
      <CardHeader icon={Users} title="Demographics & Cohort" accent="text-blue-400" />
      <DataRow label="Sample Size" value={data.sample_size} />
      <DataRow label="Age Range" value={data.age_range} />
      <DataRow label="Sex Ratio" value={data.sex_ratio} />
      <DataRow label="Conditions" value={data.conditions} />
    </motion.div>
  );
}

export function MethodologyCard({ data }: { data: Methodology }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
      <CardHeader icon={FlaskConical} title="Methodology" accent="text-violet-400" />
      <DataRow label="Study Design" value={data.study_design} />
      <DataRow label="Duration" value={data.duration} />
      <DataRow label="Randomization" value={data.randomization} />
      <DataRow label="Blinding" value={data.blinding} />
      <DataRow label="Setting" value={data.setting} />
    </motion.div>
  );
}

export function OutcomesCard({ data }: { data: OutcomeData }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
      <CardHeader icon={Stethoscope} title="Outcome Measures" accent="text-emerald-400" />
      <DataRow label="Primary Outcome" value={data.primary} />
      {data.secondary && data.secondary.length > 0 && (
        <div className="py-2 border-b border-border/40">
          <span className="text-xs text-muted-foreground font-medium">Secondary Outcomes</span>
          <ul className="mt-1 space-y-1">
            {data.secondary.map((s, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <DataRow label="Statistics" value={data.statistics} />
    </motion.div>
  );
}

export default function ExtractionCards({ demographics, methodology, outcomes }: {
  demographics: Demographics;
  methodology: Methodology;
  outcomes: OutcomeData;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <DemographicsCard data={demographics} />
      <MethodologyCard data={methodology} />
      <OutcomesCard data={outcomes} />
    </div>
  );
}
