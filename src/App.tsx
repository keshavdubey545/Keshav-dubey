import { Suspense, lazy, useEffect, useState } from "react";
import { Info, Moon, Sun } from "lucide-react";
import { runFourLayerAnalysis } from "./services/geminiService";
import { AppScreen, Case, CaseRecord, LayerNumber, LayerStepState } from "./types";
import {
  deleteCaseRecord,
  duplicateCaseRecord,
  loadLibrary,
  loadTheme,
  restoreSampleCases,
  saveTheme,
  toggleMitigationDone,
  upsertCaseRecord,
} from "./utils/storage";

// Code-split every primary screen
const LandingPage = lazy(() => import("./components/LandingPage"));
const CaseWizard = lazy(() => import("./components/CaseWizard"));
const AnalysisProgress = lazy(() => import("./components/AnalysisProgress"));
const RiskDashboard = lazy(() => import("./components/RiskDashboard"));
const CaseLibrary = lazy(() => import("./components/CaseLibrary"));
const ComparisonView = lazy(() => import("./components/ComparisonView"));

function createInitialLayerSteps(): LayerStepState[] {
  return [
    {
      layer: 1,
      title: "Normative Ethical Theories",
      subtitle: "Utilitarian harm-benefit balance, deontological rights & duties, virtue/care impacts",
      status: "pending",
    },
    {
      layer: 2,
      title: "Operational Standards",
      subtitle: "NIST AI RMF 1.0 (Govern, Map, Measure, Manage) and IEEE 7000-2021 traceability",
      status: "pending",
    },
    {
      layer: 3,
      title: "Global Governance Principles",
      subtitle: "EU AI Act risk tiering, ALTAI 7 requirements, UNESCO & OECD AI Principles",
      status: "pending",
    },
    {
      layer: 4,
      title: "Risk Synthesis & Roadmap",
      subtitle: "5-axis risk scoring, likelihood × severity matrix, trade-offs, and P0–P2 mitigations",
      status: "pending",
    },
  ];
}

function ScreenSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading screen">
      <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="h-48 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => loadTheme());
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [records, setRecords] = useState<CaseRecord[]>(() => loadLibrary());
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);

  // Analysis execution state
  const [analyzingCase, setAnalyzingCase] = useState<Case | null>(null);
  const [layerSteps, setLayerSteps] = useState<LayerStepState[]>(createInitialLayerSteps);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    saveTheme(theme);
  }, [theme]);

  const isDark = theme === "dark";
  const analyzedCount = records.filter((r) => r.versions.length > 0).length;
  const activeRecord = records.find((r) => r.caseData.id === activeCaseId) || null;

  const startAnalysis = async (caseData: Case) => {
    // Save case immediately in library so it persists even if user navigates back
    setRecords((prev) => upsertCaseRecord(prev, caseData));
    setAnalyzingCase(caseData);
    setLayerSteps(createInitialLayerSteps());
    setAnalysisError(null);
    setScreen("analyzing");

    try {
      const report = await runFourLayerAnalysis(caseData, {
        onLayerStart: (layer: LayerNumber) => {
          setLayerSteps((prev) =>
            prev.map((s) => (s.layer === layer ? { ...s, status: "running", error: undefined } : s))
          );
        },
        onLayerComplete: (layer: LayerNumber, durationMs: number) => {
          setLayerSteps((prev) =>
            prev.map((s) =>
              s.layer === layer ? { ...s, status: "completed", durationMs } : s
            )
          );
        },
        onLayerError: (layer: LayerNumber, errorMessage: string) => {
          setLayerSteps((prev) =>
            prev.map((s) =>
              s.layer === layer ? { ...s, status: "error", error: errorMessage } : s
            )
          );
        },
      });

      setRecords((prev) => upsertCaseRecord(prev, caseData, report));
      setActiveCaseId(caseData.id);
      setScreen("dashboard");
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "An unexpected error occurred during analysis."
      );
    }
  };

  const handleOpenNewWizard = () => {
    setEditingCase(null);
    setScreen("wizard");
  };

  const handleRunSample = (sample: Case) => {
    const existing = records.find((r) => r.caseData.id === sample.id);
    if (existing && existing.versions.length > 0) {
      setActiveCaseId(existing.caseData.id);
      setScreen("dashboard");
      return;
    }
    void startAnalysis(sample);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Contract: Brand wordmark — Nav links — Primary action */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setScreen("landing")}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
          >
            AI Ethics Case Analyzer
          </button>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setScreen("landing")}
              className={`whitespace-nowrap shrink-0 transition-colors hover:underline underline-offset-4 ${
                screen === "landing"
                  ? "text-slate-900 dark:text-slate-50 underline"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setScreen("library")}
              className={`whitespace-nowrap shrink-0 transition-colors hover:underline underline-offset-4 ${
                screen === "library"
                  ? "text-slate-900 dark:text-slate-50 underline"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Case Library
            </button>
            <button
              type="button"
              onClick={() => setScreen("compare")}
              className={`whitespace-nowrap shrink-0 transition-colors hover:underline underline-offset-4 ${
                screen === "compare"
                  ? "text-slate-900 dark:text-slate-50 underline"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Compare Cases
            </button>
            {activeRecord && activeRecord.versions.length > 0 && (
              <button
                type="button"
                onClick={() => setScreen("dashboard")}
                className={`whitespace-nowrap shrink-0 transition-colors hover:underline underline-offset-4 ${
                  screen === "dashboard"
                    ? "text-slate-900 dark:text-slate-50 underline"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                Active Report
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleOpenNewWizard}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              Start New Case
            </button>
          </div>
        </div>

        {/* Mobile Secondary Nav */}
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setScreen("landing")}
            className="whitespace-nowrap shrink-0 text-slate-700 dark:text-slate-300"
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setScreen("library")}
            className="whitespace-nowrap shrink-0 text-slate-700 dark:text-slate-300"
          >
            Case Library
          </button>
          <button
            type="button"
            onClick={() => setScreen("compare")}
            className="whitespace-nowrap shrink-0 text-slate-700 dark:text-slate-300"
          >
            Compare Cases
          </button>
          {activeRecord && activeRecord.versions.length > 0 && (
            <button
              type="button"
              onClick={() => setScreen("dashboard")}
              className="whitespace-nowrap shrink-0 text-indigo-700 dark:text-indigo-400"
            >
              Active Report
            </button>
          )}
        </div>
      </header>

      {/* Transparent Limitations & Privacy Notice Banner */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-start sm:items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
          <p>
            <strong>AI-assisted analysis.</strong> It supports, and does not replace, human ethics
            review and legal counsel. Do not enter personal data; records remain in browser
            localStorage except analysis requests sent to the Gemini API.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<ScreenSkeleton />}>
          {screen === "landing" && (
            <LandingPage
              libraryCount={records.length}
              analyzedCount={analyzedCount}
              onStartNewCase={handleOpenNewWizard}
              onOpenLibrary={() => setScreen("library")}
              onRunSampleCase={handleRunSample}
            />
          )}

          {screen === "wizard" && (
            <CaseWizard
              initialCase={editingCase}
              onSubmit={(caseData) => void startAnalysis(caseData)}
              onCancel={() => setScreen(records.length > 0 ? "library" : "landing")}
            />
          )}

          {screen === "analyzing" && analyzingCase && (
            <AnalysisProgress
              caseData={analyzingCase}
              steps={layerSteps}
              error={analysisError}
              onRetry={() => void startAnalysis(analyzingCase)}
              onCancel={() => {
                setEditingCase(analyzingCase);
                setScreen("wizard");
              }}
            />
          )}

          {screen === "dashboard" && activeRecord && (
            <RiskDashboard
              key={`${activeRecord.caseData.id}-${activeRecord.versions.length}`}
              record={activeRecord}
              isDark={isDark}
              onToggleMitigation={(cid, mid) =>
                setRecords((prev) => toggleMitigationDone(prev, cid, mid))
              }
              onRerunAnalysis={(rec) => void startAnalysis(rec.caseData)}
              onEditCase={(rec) => {
                setEditingCase(rec.caseData);
                setScreen("wizard");
              }}
            />
          )}

          {screen === "library" && (
            <CaseLibrary
              records={records}
              onNewCase={handleOpenNewWizard}
              onOpenReport={(id) => {
                setActiveCaseId(id);
                setScreen("dashboard");
              }}
              onRunAnalysis={(rec) => void startAnalysis(rec.caseData)}
              onEditCase={(rec) => {
                setEditingCase(rec.caseData);
                setScreen("wizard");
              }}
              onDuplicateCase={(id) =>
                setRecords((prev) => duplicateCaseRecord(prev, id).nextRecords)
              }
              onDeleteCase={(id) => {
                setRecords((prev) => deleteCaseRecord(prev, id));
                if (activeCaseId === id) setActiveCaseId(null);
              }}
              onRestoreSamples={() => setRecords((prev) => restoreSampleCases(prev))}
              onCompareCases={() => setScreen("compare")}
            />
          )}

          {screen === "compare" && (
            <ComparisonView
              records={records}
              isDark={isDark}
              onGoToLibrary={() => setScreen("library")}
            />
          )}
        </Suspense>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-4 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>AI Ethics Case Analyzer · Schema v1.0</span>
          <span>Normative Theories · NIST AI RMF 1.0 · IEEE 7000 · EU AI Act · ALTAI · UNESCO · OECD</span>
        </div>
      </footer>
    </div>
  );
}
