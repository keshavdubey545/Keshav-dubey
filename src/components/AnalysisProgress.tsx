import { AlertCircle, CheckCircle2, Circle, Loader2, RotateCcw } from "lucide-react";
import { Case, DOMAIN_LABELS, LayerStepState } from "../types";

interface AnalysisProgressProps {
  caseData: Case;
  steps: LayerStepState[];
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

export default function AnalysisProgress({
  caseData,
  steps,
  error,
  onRetry,
  onCancel,
}: AnalysisProgressProps) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {DOMAIN_LABELS[caseData.domain] || caseData.domain} · Sequential Evaluation Pipeline
            </p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {caseData.title}
            </h1>
          </div>
          <div className="text-right font-mono tabular-nums">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {pct}%
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {completedCount} of {steps.length} layers
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
            style={{ width: `${Math.max(pct, error ? pct : 6)}%` }}
          />
        </div>

        {/* Layer Steps */}
        <ol className="space-y-3" aria-label="Analysis layers">
          {steps.map((step) => {
            const isRunning = step.status === "running";
            const isDone = step.status === "completed";
            const isError = step.status === "error";

            return (
              <li
                key={step.layer}
                className={`flex items-start gap-3.5 p-4 rounded-lg border transition-colors ${
                  isRunning
                    ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30"
                    : isError
                    ? "border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/30"
                    : isDone
                    ? "border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : isRunning ? (
                    <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  ) : isError ? (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Layer {step.layer}: {step.title}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                      {isDone && step.durationMs
                        ? `${(step.durationMs / 1000).toFixed(1)}s`
                        : isRunning
                        ? "Evaluating..."
                        : isError
                        ? "Failed"
                        : "Queued"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {step.subtitle}
                  </p>
                  {isError && step.error && (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-2">{step.error}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <p className="font-semibold">Analysis interrupted</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-medium whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Analysis</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Edit Case Inputs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
