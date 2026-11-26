import { AnalysisReport, Case, CaseRecord } from "../types";
import { SAMPLE_CASES } from "../data/sampleCases";

const LIBRARY_KEY = "ai_ethics_analyzer_library_v1";
const DRAFT_KEY = "ai_ethics_analyzer_draft_v1";
const THEME_KEY = "ai_ethics_analyzer_theme_v1";

function createSeededRecords(): CaseRecord[] {
  return SAMPLE_CASES.map((sample) => ({
    caseData: sample,
    versions: [],
    completedMitigationIds: [],
  }));
}

export function loadLibrary(): CaseRecord[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) {
      const seeded = createSeededRecords();
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = createSeededRecords();
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    return createSeededRecords();
  }
}

export function saveLibrary(records: CaseRecord[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota issues gracefully
  }
}

export function upsertCaseRecord(
  records: CaseRecord[],
  caseData: Case,
  newReport?: AnalysisReport
): CaseRecord[] {
  const existingIdx = records.findIndex((r) => r.caseData.id === caseData.id);
  const now = new Date().toISOString();
  const updatedCase: Case = { ...caseData, updatedAt: now };

  if (existingIdx >= 0) {
    const existing = records[existingIdx];
    const nextVersionNumber =
      existing.versions.length > 0
        ? Math.max(...existing.versions.map((v) => v.version)) + 1
        : 1;
    const versions = newReport
      ? [...existing.versions, { version: nextVersionNumber, report: newReport }]
      : existing.versions;

    const updatedRecord: CaseRecord = {
      ...existing,
      caseData: updatedCase,
      versions,
    };
    const next = [...records];
    next[existingIdx] = updatedRecord;
    saveLibrary(next);
    return next;
  }

  const created: CaseRecord = {
    caseData: { ...updatedCase, createdAt: updatedCase.createdAt || now },
    versions: newReport ? [{ version: 1, report: newReport }] : [],
    completedMitigationIds: [],
  };
  const next = [created, ...records];
  saveLibrary(next);
  return next;
}

export function duplicateCaseRecord(
  records: CaseRecord[],
  caseId: string
): { nextRecords: CaseRecord[]; duplicated: CaseRecord | null } {
  const source = records.find((r) => r.caseData.id === caseId);
  if (!source) return { nextRecords: records, duplicated: null };

  const now = new Date().toISOString();
  const newId = `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const duplicated: CaseRecord = {
    caseData: {
      ...structuredClone(source.caseData),
      id: newId,
      title: `${source.caseData.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
    },
    versions: source.versions.map((v) => ({
      version: v.version,
      report: {
        ...structuredClone(v.report),
        caseId: newId,
      },
    })),
    completedMitigationIds: [...source.completedMitigationIds],
  };

  const nextRecords = [duplicated, ...records];
  saveLibrary(nextRecords);
  return { nextRecords, duplicated };
}

export function deleteCaseRecord(records: CaseRecord[], caseId: string): CaseRecord[] {
  const next = records.filter((r) => r.caseData.id !== caseId);
  saveLibrary(next);
  return next;
}

export function toggleMitigationDone(
  records: CaseRecord[],
  caseId: string,
  mitigationId: string
): CaseRecord[] {
  const next = records.map((r) => {
    if (r.caseData.id !== caseId) return r;
    const exists = r.completedMitigationIds.includes(mitigationId);
    const completedMitigationIds = exists
      ? r.completedMitigationIds.filter((id) => id !== mitigationId)
      : [...r.completedMitigationIds, mitigationId];
    return { ...r, completedMitigationIds };
  });
  saveLibrary(next);
  return next;
}

export function restoreSampleCases(records: CaseRecord[]): CaseRecord[] {
  const existingIds = new Set(records.map((r) => r.caseData.id));
  const missing = SAMPLE_CASES.filter((s) => !existingIds.has(s.id)).map((sample) => ({
    caseData: sample,
    versions: [],
    completedMitigationIds: [],
  }));
  const next = [...records, ...missing];
  saveLibrary(next);
  return next;
}

export interface DraftState {
  step: number;
  caseData: Case;
  savedAt: string;
}

export function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

export function saveDraft(step: number, caseData: Case): void {
  try {
    const payload: DraftState = {
      step,
      caseData,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore
  }
}

export function loadTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  } catch {
    return "light";
  }
}

export function saveTheme(theme: "light" | "dark"): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore
  }
}

export function createEmptyCase(): Case {
  const now = new Date().toISOString();
  return {
    id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "",
    description: "",
    domain: "healthcare",
    system: {
      modelType: "classifier",
      automationLevel: "human_in_loop",
      dataSources: [],
      dataSensitivity: [],
      trainingDataOrigin: "",
      existingSafeguards: "",
    },
    impact: {
      affectedGroups: [],
      scope: "individual",
      reversibility: "partially",
      regions: [],
      scaleEstimate: "",
    },
    createdAt: now,
    updatedAt: now,
  };
}
