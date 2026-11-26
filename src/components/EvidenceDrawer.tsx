import { useEffect } from "react";
import { X } from "lucide-react";

export interface EvidencePayload {
  title: string;
  subtitle?: string;
  score?: number;
  confidence?: number;
  rationale: string;
  drivers?: string[];
  extraSections?: { heading: string; items: string[] }[];
}

interface EvidenceDrawerProps {
  evidence: EvidencePayload | null;
  onClose: () => void;
}

export function EvidenceDrawer({ evidence, onClose }: EvidenceDrawerProps) {
  useEffect(() => {
    if (!evidence) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [evidence, onClose]);

  if (!evidence) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-drawer-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            {evidence.subtitle && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {evidence.subtitle}
              </p>
            )}
            <h3
              id="evidence-drawer-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {evidence.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence drawer"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {(typeof evidence.score === "number" || typeof evidence.confidence === "number") && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              {typeof evidence.score === "number" && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Risk Score</div>
                  <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {evidence.score}
                    <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                      /100
                    </span>
                  </div>
                </div>
              )}
              {typeof evidence.confidence === "number" && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Model Confidence</div>
                  <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {Math.round(evidence.confidence * 100)}%
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Assessment Rationale
            </h4>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {evidence.rationale}
            </p>
          </div>

          {evidence.drivers && evidence.drivers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Case Input Drivers
              </h4>
              <ul className="space-y-2">
                {evidence.drivers.map((driver, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-slate-700 dark:text-slate-300 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"
                  >
                    {driver}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evidence.extraSections?.map((sec, idx) =>
            sec.items.length > 0 ? (
              <div key={idx}>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {sec.heading}
                </h4>
                <ul className="space-y-1.5 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                  {sec.items.map((item, itemIdx) => (
                    <li key={itemIdx}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
