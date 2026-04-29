const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

// ─── Auth Token Getter Singleton ─────────────────────────────────────────────

let tokenGetter: (() => Promise<string | null>) | null = null;

export function configureAuth(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!tokenGetter) return {};
  try {
    const token = await tokenGetter();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Paper {
  id: string;
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  abstract: string;
  status: string | null;
  pico: { P: string; I: string; C: string; O: string };
  source?: string;
  url?: string;
  doi?: string;
}

export interface PicoData {
  population: string;
  intervention: string;
  comparison: string;
  outcome: string;
}

export interface Demographics {
  sample_size: string;
  age_range: string;
  sex_ratio: string;
  conditions: string;
}

export interface Methodology {
  study_design: string;
  duration: string;
  randomization: string;
  blinding: string;
  setting: string;
}

export interface OutcomeData {
  primary: string;
  secondary: string[];
  statistics: string;
}

export interface Confidence {
  overall: number;
  population_score: number;
  intervention_score: number;
  outcome_score: number;
  methodology_score: number;
  evidence_quality: "High" | "Moderate" | "Low";
  limitations: string;
  grounding_score?: number;
}

export interface SourceRef {
  field: string;
  snippet: string;
  location: string;
  grounded?: boolean;
}

export type SearchSource =
  | "pubmed"
  | "europepmc"
  | "semantic"
  | "openalex"
  | "biorxiv"
  | "crossref"
  | "doaj"
  | "arxiv"
  | "pmc"
  | "clinicaltrials"
  | "plos"
  | "openaire"
  | "nih";

export interface SearchSourceMeta {
  id: SearchSource;
  label: string;
  description: string;
}

export const SEARCH_SOURCES: SearchSourceMeta[] = [
  { id: "pubmed", label: "PubMed", description: "NIH/NLM biomedical literature (35M+ citations)" },
  { id: "pmc", label: "PMC Full-Text", description: "PubMed Central — full-text open-access medical articles" },
  { id: "europepmc", label: "Europe PMC", description: "Broader open biomedical literature + preprints" },
  { id: "clinicaltrials", label: "ClinicalTrials.gov", description: "NIH registry of 480k+ trial protocols + results" },
  { id: "plos", label: "PLOS", description: "Open-access journals: PLOS ONE / Medicine / Biology / etc." },
  { id: "openaire", label: "OpenAIRE", description: "EU scholarly aggregator — 250M+ research products" },
  { id: "nih", label: "NIH RePORTER", description: "NIH-funded project abstracts + investigators" },
  { id: "semantic", label: "Semantic Scholar", description: "AI citation graph + TLDR (occasional rate limit)" },
  { id: "openalex", label: "OpenAlex", description: "240M+ scholarly works, all disciplines" },
  { id: "crossref", label: "CrossRef", description: "Authoritative DOI metadata + abstracts (130M+)" },
  { id: "doaj", label: "DOAJ", description: "Directory of Open Access Journals — fully OA" },
  { id: "arxiv", label: "arXiv", description: "Preprints (incl. quantitative biology, bioinformatics)" },
  { id: "biorxiv", label: "bioRxiv / medRxiv", description: "Biology + medical preprints" },
];

export interface CriticalAppraisal {
  strengths: string[];
  weaknesses: string[];
}

export interface AnalysisResult {
  id?: string;
  title: string;
  year: string;
  summary?: string;
  pico: PicoData;
  demographics: Demographics;
  methodology: Methodology;
  outcomes: OutcomeData;
  key_findings?: string[];
  clinical_significance?: string;
  critical_appraisal?: CriticalAppraisal;
  takeaway_message?: string;
  confidence: Confidence;
  source_refs: SourceRef[];
  input_type?: string;
  input_label?: string;
}

export interface HistoryEntry {
  id: string;
  result: AnalysisResult;
  inputType: string;
  inputLabel: string;
  abstractText?: string;
  analyzedAt: string;
}

// ─── Internal fetch helpers ──────────────────────────────────────────────────

async function authedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...auth },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export const api = {
  health: () => authedRequest<{ status: string }>("/api/health"),

  searchPubMed: (query: string, source: SearchSource = "pubmed") =>
    authedRequest<{ papers: Paper[]; source: string; count: number }>("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, source }),
    }),

  fetchByPmid: (identifier: string) =>
    authedRequest<Paper>("/api/fetch-by-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    }),

  analyzePdf: async (file: File, _userId?: string | null): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append("file", file);
    return authedRequest<AnalysisResult>("/api/analyze", {
      method: "POST",
      body: formData,
    });
  },

  analyzeText: async (text: string, _userId?: string | null, pmid?: string): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append("text", text);
    if (pmid) formData.append("pmid", pmid);
    return authedRequest<AnalysisResult>("/api/analyze", {
      method: "POST",
      body: formData,
    });
  },

  getAnalyses: (_userId?: string | null) =>
    authedRequest<HistoryEntry[]>("/api/analyses"),

  getAnalysis: (id: string, _userId?: string | null) =>
    authedRequest<HistoryEntry>(`/api/analyses/${id}`),

  deleteAnalysis: (id: string, _userId?: string | null) =>
    authedRequest<{ status: string }>(`/api/analyses/${id}`, { method: "DELETE" }),

  clearAnalyses: (_userId?: string | null) =>
    authedRequest<{ status: string; deleted: number }>("/api/analyses", { method: "DELETE" }),
};

// ─── Export Utilities ────────────────────────────────────────────────────────

export const exportUtils = {
  exportJson: (entries: HistoryEntry[]): string => {
    return JSON.stringify(entries, null, 2);
  },

  exportCsv: (entries: HistoryEntry[]): string => {
    if (entries.length === 0) return "";
    const headers = [
      "Title", "Year", "Input Type", "Analyzed At",
      "Summary", "Key Findings", "Clinical Significance", "Takeaway",
      "Population", "Intervention", "Comparison", "Outcome",
      "Sample Size", "Study Design", "Overall Confidence", "Evidence Quality",
    ];
    const rows = entries.map((e) => [
      e.result.title,
      e.result.year,
      e.inputType,
      e.analyzedAt,
      e.result.summary || "",
      (e.result.key_findings || []).join("; "),
      e.result.clinical_significance || "",
      e.result.takeaway_message || "",
      e.result.pico?.population || "",
      e.result.pico?.intervention || "",
      e.result.pico?.comparison || "",
      e.result.pico?.outcome || "",
      e.result.demographics?.sample_size || "",
      e.result.methodology?.study_design || "",
      String(e.result.confidence?.overall || 0),
      e.result.confidence?.evidence_quality || "",
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  },
};
