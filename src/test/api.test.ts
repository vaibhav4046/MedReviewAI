import { describe, it, expect } from "vitest";
import { exportUtils, SEARCH_SOURCES, type HistoryEntry } from "@/lib/api";

const sample: HistoryEntry = {
  id: "1",
  inputType: "pubmed",
  inputLabel: "PMID:12345",
  abstractText: "Sample abstract",
  analyzedAt: "2026-04-28T12:00:00Z",
  result: {
    title: "Test Paper",
    year: "2026",
    summary: "test",
    pico: { population: "P", intervention: "I", comparison: "C", outcome: "O" },
    demographics: { sample_size: "100", age_range: "18-65", sex_ratio: "1:1", conditions: "T2DM" },
    methodology: { study_design: "RCT", duration: "12mo", randomization: "yes", blinding: "Double-blind", setting: "multi-center" },
    outcomes: { primary: "HbA1c", secondary: ["weight"], statistics: "p<0.001" },
    confidence: { overall: 0.9, population_score: 0.9, intervention_score: 0.9, outcome_score: 0.9, methodology_score: 0.9, evidence_quality: "High", limitations: "" },
    source_refs: [],
  },
};

describe("SEARCH_SOURCES", () => {
  it("exposes all 13 free academic data sources", () => {
    expect(SEARCH_SOURCES.length).toBe(13);
    const ids = SEARCH_SOURCES.map((s) => s.id);
    expect(ids).toContain("pubmed");
    expect(ids).toContain("clinicaltrials");
    expect(ids).toContain("plos");
    expect(ids).toContain("openaire");
    expect(ids).toContain("nih");
    expect(ids).toContain("biorxiv");
  });

  it("every source has label and description", () => {
    for (const s of SEARCH_SOURCES) {
      expect(s.label).toBeTruthy();
      expect(s.description.length).toBeGreaterThan(10);
    }
  });
});

describe("exportUtils.exportJson", () => {
  it("returns valid JSON of entries", () => {
    const json = exportUtils.exportJson([sample]);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].result.title).toBe("Test Paper");
  });

  it("returns empty array string when entries empty", () => {
    expect(exportUtils.exportJson([])).toBe("[]");
  });
});

describe("exportUtils.exportCsv", () => {
  it("returns empty string when no entries", () => {
    expect(exportUtils.exportCsv([])).toBe("");
  });

  it("includes a header row and a data row with key fields", () => {
    const csv = exportUtils.exportCsv([sample]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("Title");
    expect(lines[0]).toContain("Population");
    expect(lines[1]).toContain("Test Paper");
    expect(lines[1]).toContain("RCT");
    expect(lines[1]).toContain("p<0.001");
  });

  it("escapes embedded quotes correctly", () => {
    const tricky: HistoryEntry = {
      ...sample,
      result: { ...sample.result, title: 'Paper with "quoted" word' },
    };
    const csv = exportUtils.exportCsv([tricky]);
    expect(csv).toContain('"Paper with ""quoted"" word"');
  });
});
