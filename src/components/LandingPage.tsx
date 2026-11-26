import { ArrowRight, BookOpen, FolderOpen, Play, Scale } from "lucide-react";
import { useState } from "react";
import { SAMPLE_CASES } from "../data/sampleCases";
import { AUTOMATION_LABELS, Case, DOMAIN_LABELS } from "../types";

interface LandingPageProps {
  libraryCount: number;
  analyzedCount: number;
  resumeTarget?: { caseId: string; title: string; recentAction: string | null } | null;
  onResumeCase?: (caseId: string) => void;
  onStartNewCase: () => void;
  onOpenLibrary: () => void;
  onRunSampleCase: (sample: Case) => void;
}

export default function LandingPage({
  libraryCount,
  analyzedCount,
  resumeTarget,
  onResumeCase,
  onStartNewCase,
  onOpenLibrary,
  onRunSampleCase,
}: LandingPageProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-12">
      {resumeTarget && onResumeCase && (
        <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/50 dark:bg-indigo-950/30 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
              Previous Session Memory
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {resumeTarget.title}
            </p>
            {resumeTarget.recentAction && (
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                Last action: {resumeTarget.recentAction}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onResumeCase(resumeTarget.caseId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 whitespace-nowrap shrink-0"
          >
            <span>Resume Case</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Split Architectural Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-2">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6 py-2">
          <div className="space-y-4">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
              Multi-Layer AI Governance &amp; Moral Philosophy Workbench
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.12]">
              Structured Ethics &amp; Risk Assessment for AI Deployments
            </h1>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
              Evaluate real-world AI systems through four sequential analytical layers: normative
              ethical theories, operational engineering standards, international governance
              frameworks, and an actionable mitigation roadmap.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartNewCase}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
            >
              <span>Start New Case</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Case Library ({libraryCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 tabular-nums">
            <span>{libraryCount} saved cases</span>
            <span aria-hidden="true">·</span>
            <span>{analyzedCount} completed reports</span>
            <span aria-hidden="true">·</span>
            <span>Local browser storage</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative h-full min-h-[260px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
            {!imgError ? (
              <img
                src="/src/assets/images/ethics_governance_architecture_1795672281747.jpg"
                alt="Architectural stone and brushed steel balance scales representing proportional AI governance"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover aspect-[4/3] lg:aspect-auto"
              />
            ) : (
              <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
                <Scale className="w-12 h-12 text-slate-500 dark:text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Normative, Operational &amp; Regulatory Alignment
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4-Layer Evaluation Architecture */}
      <section aria-labelledby="methodology-heading" className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2
            id="methodology-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Four-Layer Assessment Pipeline
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sequential structured analysis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: "01. Normative Theories",
              desc: "Consequentialist harm-benefit distribution, deontological rights & duties, and virtue/care power-asymmetry impacts.",
            },
            {
              step: "02. Operational Standards",
              desc: "NIST AI RMF 1.0 (Govern, Map, Measure, Manage) gap scoring and IEEE 7000-2021 ethical value traceability.",
            },
            {
              step: "03. Global Governance",
              desc: "EU AI Act risk tier classification, ALTAI 7 requirements, UNESCO Ethics Recommendation, and OECD AI Principles.",
            },
            {
              step: "04. Synthesis & Roadmap",
              desc: "Five-axis risk scoring, likelihood-severity matrix, trade-off tension mapping, and P0–P2 mitigation roadmap.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.step}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Immediate Sample Cases */}
      <section aria-labelledby="samples-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <h2
              id="samples-heading"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Ready-to-Run Sample Scenarios
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Launch an end-to-end 4-layer evaluation immediately
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_CASES.map((sample) => (
            <article
              key={sample.id}
              className="flex flex-col justify-between p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4"
            >
              <div className="space-y-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span>{DOMAIN_LABELS[sample.domain] || sample.domain}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{AUTOMATION_LABELS[sample.system.automationLevel]}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                  {sample.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {sample.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {sample.impact.regions.join(", ")}
                </span>
                <button
                  type="button"
                  onClick={() => onRunSampleCase(sample)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Analyze Case</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
