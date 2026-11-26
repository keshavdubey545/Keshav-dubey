import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { AlertCircle, Cloud, Info, LogIn, LogOut, Moon, Sun, X } from "lucide-react";
import { auth, signInWithGoogle, signOutAccount } from "./firebase";
import {
  clearWizardDraftFromFirestore,
  deleteCaseFromFirestore,
  duplicateCaseInFirestore,
  loadWizardDraftFromFirestore,
  migrateLocalCasesToFirestore,
  recordUserRecentAction,
  saveCaseToFirestore,
  saveWizardDraftToFirestore,
  subscribeUserCases,
  syncUserProfileOnLogin,
  toggleMitigationInFirestore,
  updateUserThemeInFirestore,
  UserPreferences,
} from "./services/firestoreService";
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

function formatReadableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) {
      if (parsed.error.toLowerCase().includes("quota exceeded")) {
        return "Cloud Firestore daily free-tier quota exceeded. Quota resets tomorrow; local browser storage remains active.";
      }
      return parsed.error;
    }
  } catch {
    // keep raw
  }
  return raw;
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
  const [localRecords, setLocalRecords] = useState<CaseRecord[]>(() => loadLibrary());
  const [cloudRecords, setCloudRecords] = useState<CaseRecord[] | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);

  // Firebase Auth & Preferences state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [cloudDraft, setCloudDraft] = useState<{ step: number; caseData: Case } | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Analysis execution state
  const [analyzingCase, setAnalyzingCase] = useState<Case | null>(null);
  const [layerSteps, setLayerSteps] = useState<LayerStepState[]>(createInitialLayerSteps);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const records = user && cloudRecords !== null ? cloudRecords : localRecords;
  const isDark = theme === "dark";
  const analyzedCount = records.filter((r) => r.versions.length > 0).length;
  const activeRecord = records.find((r) => r.caseData.id === activeCaseId) || null;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    saveTheme(theme);
  }, [theme]);

  // Listen to Firebase Auth state and connect Firestore listeners once signed in
  useEffect(() => {
    let unsubscribeCases: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubscribeCases) {
        unsubscribeCases();
        unsubscribeCases = null;
      }

      setUser(nextUser);
      setAuthReady(true);
      setCloudError(null);

      if (!nextUser) {
        setCloudRecords(null);
        setUserPrefs(null);
        setCloudDraft(null);
        return;
      }

      try {
        const prefs = await syncUserProfileOnLogin(nextUser, loadTheme());
        if (cancelled) return;
        setUserPrefs(prefs);
        if (prefs.theme === "dark" || prefs.theme === "light") {
          setTheme(prefs.theme);
        }

        // Migrate any local cases/analyses on first login
        await migrateLocalCasesToFirestore(nextUser.uid, loadLibrary());
        if (cancelled) return;

        // Load cloud wizard draft if present
        const draft = await loadWizardDraftFromFirestore(nextUser.uid);
        if (!cancelled) setCloudDraft(draft);

        // Attach real-time Firestore listener for user's cases
        unsubscribeCases = subscribeUserCases(
          nextUser.uid,
          (nextRecords) => {
            if (!cancelled) setCloudRecords(nextRecords);
          },
          (err) => {
            if (!cancelled) setCloudError(formatReadableError(err));
          }
        );
      } catch (err) {
        if (!cancelled) {
          setCloudError(formatReadableError(err));
        }
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubscribeCases) unsubscribeCases();
    };
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    if (user) {
      void updateUserThemeInFirestore(user.uid, nextTheme).catch((err) =>
        setCloudError(formatReadableError(err))
      );
    }
  };

  const handleSignIn = async () => {
    setAuthBusy(true);
    setCloudError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setCloudError(formatReadableError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    setCloudError(null);
    try {
      await signOutAccount();
    } catch (err) {
      setCloudError(formatReadableError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const trackAction = useCallback(
    (caseId: string | null, description: string) => {
      if (!user) return;
      setUserPrefs((prev) => ({
        theme: prev?.theme || theme,
        lastActiveCaseId: caseId,
        recentAction: description,
      }));
      void recordUserRecentAction(user.uid, caseId, description).catch(() => {
        // Non-blocking telemetry preference update
      });
    },
    [user, theme]
  );

  const handleCloudDraftChange = useCallback(
    (step: number, caseData: Case) => {
      if (!user) return;
      void saveWizardDraftToFirestore(user.uid, step, caseData).catch(() => {
        // Ignore transient draft autosave failure
      });
    },
    [user]
  );

  const handleCloudDraftClear = useCallback(() => {
    setCloudDraft(null);
    if (!user) return;
    void clearWizardDraftFromFirestore(user.uid).catch(() => {
      // Ignore missing draft delete
    });
  }, [user]);

  const startAnalysis = async (caseData: Case) => {
    // Save case draft/metadata immediately
    if (user) {
      try {
        await saveCaseToFirestore(user.uid, caseData);
        trackAction(caseData.id, `Started analysis for "${caseData.title}"`);
      } catch (err) {
        setCloudError(formatReadableError(err));
      }
    } else {
      setLocalRecords((prev) => upsertCaseRecord(prev, caseData));
    }

    setAnalyzingCase(caseData);
    setLayerSteps(createInitialLayerSteps());
    setAnalysisError(null);
    setScreen("analyzing");

    try {
      const report = await runFourLayerAnalysis(caseData, {
        onLayerStart: (layer: LayerNumber) => {
          setLayerSteps((prev) =>
            prev.map((s) =>
              s.layer === layer ? { ...s, status: "running", error: undefined } : s
            )
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

      if (user) {
        const saved = await saveCaseToFirestore(user.uid, caseData, report);
        setActiveCaseId(saved.id);
        trackAction(
          saved.id,
          `Completed evaluation (${report.overallRiskScore}/100 ${report.overallRiskLevel})`
        );
      } else {
        setLocalRecords((prev) => upsertCaseRecord(prev, caseData, report));
        setActiveCaseId(caseData.id);
      }

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

  const handleOpenReport = (caseId: string) => {
    const rec = records.find((r) => r.caseData.id === caseId);
    setActiveCaseId(caseId);
    setScreen("dashboard");
    if (rec) {
      trackAction(caseId, `Reviewed report for "${rec.caseData.title}"`);
    }
  };

  const handleRunSample = (sample: Case) => {
    const existing = records.find((r) => r.caseData.id === sample.id);
    if (existing && existing.versions.length > 0) {
      handleOpenReport(existing.caseData.id);
      return;
    }
    void startAnalysis(sample);
  };

  const handleToggleMitigation = async (caseId: string, mitigationId: string) => {
    if (user) {
      const rec = records.find((r) => r.caseData.id === caseId);
      if (!rec) return;
      try {
        await toggleMitigationInFirestore(
          user.uid,
          caseId,
          rec.completedMitigationIds,
          mitigationId
        );
        trackAction(caseId, `Updated mitigation progress on "${rec.caseData.title}"`);
      } catch (err) {
        setCloudError(formatReadableError(err));
      }
    } else {
      setLocalRecords((prev) => toggleMitigationDone(prev, caseId, mitigationId));
    }
  };

  const handleDuplicateCase = async (caseId: string) => {
    if (user) {
      const rec = records.find((r) => r.caseData.id === caseId);
      if (!rec) return;
      try {
        const dup = await duplicateCaseInFirestore(user.uid, rec);
        trackAction(dup.id, `Duplicated case "${rec.caseData.title}"`);
      } catch (err) {
        setCloudError(formatReadableError(err));
      }
    } else {
      setLocalRecords((prev) => duplicateCaseRecord(prev, caseId).nextRecords);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (user) {
      try {
        await deleteCaseFromFirestore(user.uid, caseId);
        if (activeCaseId === caseId) setActiveCaseId(null);
        trackAction(null, "Deleted a case from library");
      } catch (err) {
        setCloudError(formatReadableError(err));
      }
    } else {
      setLocalRecords((prev) => deleteCaseRecord(prev, caseId));
      if (activeCaseId === caseId) setActiveCaseId(null);
    }
  };

  const handleRestoreSamples = async () => {
    if (user) {
      try {
        const sampleRecords = restoreSampleCases([]);
        await migrateLocalCasesToFirestore(user.uid, sampleRecords);
        trackAction(null, "Restored sample cases");
      } catch (err) {
        setCloudError(formatReadableError(err));
      }
    } else {
      setLocalRecords((prev) => restoreSampleCases(prev));
    }
  };

  const resumeCase = userPrefs?.lastActiveCaseId
    ? records.find((r) => r.caseData.id === userPrefs.lastActiveCaseId)
    : null;

  const resumeTarget =
    user && resumeCase
      ? {
          caseId: resumeCase.caseData.id,
          title: resumeCase.caseData.title,
          recentAction: userPrefs?.recentAction || null,
        }
      : null;

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
              onClick={handleToggleTheme}
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

      {/* Workspace Account & Limitations Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start sm:items-center gap-2">
            <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
            <p>
              <strong>AI-assisted analysis.</strong> It supports, and does not replace, human ethics
              review and legal counsel. Do not enter personal data.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {authReady && user ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                  <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{user.displayName || user.email}</span>
                </span>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleSignOut()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!authReady || authBusy}
                onClick={() => void handleSignIn()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in with Google to Sync</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {cloudError && (
          <div
            role="alert"
            className="mb-6 p-3.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 flex items-start justify-between gap-3 text-xs text-red-800 dark:text-red-200"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cloudError}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloudError(null)}
              aria-label="Dismiss error"
              className="text-red-700 dark:text-red-300 hover:opacity-75"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <Suspense fallback={<ScreenSkeleton />}>
          {screen === "landing" && (
            <LandingPage
              libraryCount={records.length}
              analyzedCount={analyzedCount}
              resumeTarget={resumeTarget}
              onResumeCase={handleOpenReport}
              onStartNewCase={handleOpenNewWizard}
              onOpenLibrary={() => setScreen("library")}
              onRunSampleCase={handleRunSample}
            />
          )}

          {screen === "wizard" && (
            <CaseWizard
              initialCase={editingCase}
              cloudDraft={cloudDraft}
              onDraftChange={handleCloudDraftChange}
              onDraftClear={handleCloudDraftClear}
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
              onToggleMitigation={(cid, mid) => void handleToggleMitigation(cid, mid)}
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
              onOpenReport={handleOpenReport}
              onRunAnalysis={(rec) => void startAnalysis(rec.caseData)}
              onEditCase={(rec) => {
                setEditingCase(rec.caseData);
                setScreen("wizard");
              }}
              onDuplicateCase={(id) => void handleDuplicateCase(id)}
              onDeleteCase={(id) => void handleDeleteCase(id)}
              onRestoreSamples={() => void handleRestoreSamples()}
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
          <span>
            AI Ethics Case Analyzer · Schema v1.0 ·{" "}
            {user ? "Cloud Firestore Synced" : "Browser Local Mode"}
          </span>
          <span>
            Normative Theories · NIST AI RMF 1.0 · IEEE 7000 · EU AI Act · ALTAI · UNESCO · OECD
          </span>
        </div>
      </footer>
    </div>
  );
}
