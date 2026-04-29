import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, exportUtils, type HistoryEntry } from "@/lib/api";
import { BarChart3, Trash2, Download, FileText, Eye, Clock, ShieldCheck, Sparkles, Loader2, RefreshCw } from "lucide-react";
// NOTE: mobile table overflow handled via parent overflow-x-auto wrapper

function QualityBadge({ quality }: { quality: string }) {
  const styles: Record<string, string> = {
    High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    Moderate: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    Low: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[quality] || styles.Low}`}>
      {quality}
    </span>
  );
}

export default function ResultsDashboardPage() {
  const { userId } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.getAnalyses(userId);
      setEntries(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analyses");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchEntries();
  }, [userId, fetchEntries]);

  const stats = useMemo(() => {
    const total = entries.length;
    const avgConfidence = total > 0
      ? entries.reduce((sum, e) => sum + (e.result.confidence?.overall || 0), 0) / total
      : 0;
    const high = entries.filter((e) => e.result.confidence?.evidence_quality === "High").length;
    const moderate = entries.filter((e) => e.result.confidence?.evidence_quality === "Moderate").length;
    const low = entries.filter((e) => e.result.confidence?.evidence_quality === "Low").length;
    return { total, avgConfidence, high, moderate, low };
  }, [entries]);

  const handleClear = async () => {
    if (!userId) return;
    if (window.confirm("Clear all analysis history? This cannot be undone.")) {
      try {
        await api.clearAnalyses(userId);
        setEntries([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear");
      }
    }
  };

  const handleRemove = async (id: string) => {
    if (!userId) return;
    try {
      await api.deleteAnalysis(id, userId);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([exportUtils.exportJson(entries)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medreviewai-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const blob = new Blob([exportUtils.exportCsv(entries)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medreviewai-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Papers Analyzed", value: stats.total, icon: FileText, accent: "text-primary" },
    { label: "Avg Confidence", value: `${Math.round(stats.avgConfidence * 100)}%`, icon: ShieldCheck, accent: "text-emerald-400" },
    { label: "High Quality", value: stats.high, icon: Sparkles, accent: "text-emerald-400" },
    { label: "Needs Review", value: stats.low, icon: Clock, accent: "text-rose-400" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <span className="section-label mb-4">📊 Results Dashboard</span>
          <h1 className="text-2xl font-extrabold text-foreground mt-3 mb-2">Analysis Results</h1>
          <p className="text-sm text-muted-foreground">View and manage all analyzed papers stored in the database.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={fetchEntries} className="px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs font-semibold text-foreground hover:bg-muted/60 transition-all flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={handleExportJson} disabled={entries.length === 0} className="px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs font-semibold text-foreground hover:bg-muted/60 transition-all flex items-center gap-1.5 disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
          <button onClick={handleExportCsv} disabled={entries.length === 0} className="px-3 py-2 rounded-xl border border-border bg-muted/30 text-xs font-semibold text-foreground hover:bg-muted/60 transition-all flex items-center gap-1.5 disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={handleClear} disabled={entries.length === 0} className="px-3 py-2 rounded-xl border border-destructive/20 bg-destructive/10 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all flex items-center gap-1.5 disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-sm text-destructive">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className="stat-card">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-muted/60 ${s.accent}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
              <div className="text-2xl font-extrabold text-foreground">{s.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card overflow-hidden">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📄</div>
            <div className="text-sm font-semibold text-foreground mb-1">No analyses yet</div>
            <div className="text-xs text-muted-foreground mb-4">Analyze a paper to see results here.</div>
            <Link to="/analyzer" className="btn-glow text-sm inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Analyze a Paper
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Input</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confidence</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quality</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const conf = Math.round((entry.result.confidence?.overall || 0) * 100);
                  const confColor = conf >= 80 ? "text-emerald-400" : conf >= 50 ? "text-amber-400" : "text-rose-400";
                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4 max-w-[180px] sm:max-w-[300px]">
                        <span className="font-semibold text-foreground truncate block">{entry.result.title || "Untitled"}</span>
                        <span className="text-xs text-muted-foreground">{entry.result.year}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge-status created">{entry.inputType}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-bold ${confColor}`}>{conf}%</span>
                      </td>
                      <td className="py-3 px-4">
                        <QualityBadge quality={entry.result.confidence?.evidence_quality || "Low"} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {entry.analyzedAt ? new Date(entry.analyzedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/viewer/${entry.id}`}
                            aria-label={`View details for ${entry.result.title || "analysis"}`}
                            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleRemove(entry.id)}
                            aria-label={`Delete ${entry.result.title || "analysis"}`}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:outline-none transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
