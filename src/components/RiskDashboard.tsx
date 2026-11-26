import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  Info,
  MinusCircle,
  Pencil,
  Printer,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AXIS_LABELS,
  AXIS_SHORT_LABELS,
  AUTOMATION_LABELS,
  CaseRecord,
  DOMAIN_LABELS,
  MitigationItem,
  Risk,
  RiskLevel,
} from "../types";
import {
  buildMarkdownReport,
  exportJsonAudit,
  exportMarkdown,
  exportPdfReport,
} from "../utils/export";
import { EvidenceDrawer, EvidencePayload } from "./EvidenceDrawer";
import { getScoreBarColor, getScoreTextColor, RiskIndicator } from "./RiskIndicator";

type DashboardTab =
  | "overview"
  | "theories"
  | "standards"
  | "risks"
  | "roadmap"
  | "export";

interface RiskDashboardProps {
  record: CaseRecord;
  isDark: boolean;
  onToggleMitigation: (caseId: string, mitigationId: string) => void;
  onRerunAnalysis: (record: CaseRecord) => void;
  onEditCase: (record: CaseRecord) => void;
}

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "theories", label: "Theories" },
  { id: "standards", label: "Standards" },
  { id: "risks", label: "Risks & Trade-offs" },
  { id: "roadmap", label: "Roadmap" },
  { id: "export", label: "Export" },
];

function OverallGauge({ score, level }: { score: number; level: RiskLevel }) {
  const radius = 74;
  const circumference = Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    level === "critical"
      ? "#dc2626"
      : level === "high"
      ? "#ea580c"
      : level === "moderate"
      ? "#d97706"
      : "#16a34a";

  return (
    <div
      className="flex flex-col items-center justify-center py-2"
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Overall ethical risk score: ${clamped} out of 100 (${level})`}
    >
      <svg viewBox="0 0 180 106" className="w-52 h-32 overflow-visible" aria-hidden="true">
        <path
          d="M 16 90 A 74 74 0 0 1 164 90"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          className="text-slate-200 dark:text-slate-800"
        />
        <path
          d="M 16 90 A 74 74 0 0 1 164 90"
          fill="none"
          stroke={strokeColor}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
        <text
          x="90"
          y="74"
          textAnchor="middle"
          className="fill-slate-900 dark:fill-slate-100 font-mono text-3xl font-bold"
          style={{ fontSize: "28px" }}
        >
          {clamped}
        </text>
        <text
          x="90"
          y="94"
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 text-xs"
          style={{ fontSize: "11px" }}
        >
          of 100 risk
        </text>
      </svg>
      <div className="mt-1">
        <RiskIndicator level={level} size="md" />
      </div>
    </div>
  );
}

function AlignmentStatus({
  alignment,
}: {
  alignment: "aligned" | "partial" | "misaligned";
}) {
  if (alignment === "aligned") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Aligned</span>
      </span>
    );
  }
  if (alignment === "partial") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-medium whitespace-nowrap">
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Partial</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs font-medium whitespace-nowrap">
      <MinusCircle className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Misaligned</span>
    </span>
  );
}

function verdictMeta(verdict: string): { label: string; classes: string } {
  switch (verdict) {
    case "acceptable":
      return {
        label: "Acceptable",
        classes:
          "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
      };
    case "acceptable_with_conditions":
      return {
        label: "Acceptable with Conditions",
        classes:
          "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
      };
    case "problematic":
      return {
        label: "Problematic",
        classes:
          "text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800",
      };
    default:
      return {
        label: "Unacceptable",
        classes:
          "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800",
      };
  }
}

function euTierMeta(tier: string): { label: string; classes: string } {
  switch (tier) {
    case "unacceptable":
      return {
        label: "Unacceptable Risk (Prohibited)",
        classes:
          "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800",
      };
    case "high":
      return {
        label: "High-Risk AI System",
        classes:
          "text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800",
      };
    case "limited":
      return {
        label: "Limited Risk (Transparency Obligations)",
        classes:
          "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800",
      };
    default:
      return {
        label: "Minimal Risk",
        classes:
          "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800",
      };
  }
}

export default function RiskDashboard({
  record,
  isDark,
  onToggleMitigation,
  onRerunAnalysis,
  onEditCase,
}: RiskDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(() => {
    const latest = record.versions[record.versions.length - 1];
    return latest?.version ?? 1;
  });
  const [evidence, setEvidence] = useState<EvidencePayload | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "P0" | "P1" | "P2">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "DONE">("ALL");
  const [showRadarTable, setShowRadarTable] = useState(false);

  const currentVersionObj =
    record.versions.find((v) => v.version === selectedVersionNum) ||
    record.versions[record.versions.length - 1];

  const prevVersionObj = useMemo(() => {
    if (!currentVersionObj) return null;
    const idx = record.versions.findIndex((v) => v.version === currentVersionObj.version);
    return idx > 0 ? record.versions[idx - 1] : null;
  }, [record.versions, currentVersionObj]);

  if (!currentVersionObj) {
    return (
      <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center space-y-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {record.caseData.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This case does not have an analysis report yet.
        </p>
        <button
          type="button"
          onClick={() => onRerunAnalysis(record)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium"
        >
          Run 4-Layer Ethics Analysis
        </button>
      </div>
    );
  }

  const report = currentVersionObj.report;
  const scoreDelta = prevVersionObj
    ? report.overallRiskScore - prevVersionObj.report.overallRiskScore
    : null;

  const radarData = report.axisScores.map((ax) => ({
    axis: AXIS_SHORT_LABELS[ax.axis],
    fullAxis: AXIS_LABELS[ax.axis],
    score: ax.score,
    confidence: Math.round(ax.confidence * 100),
  }));

  // Projected residual risk calculation
  const completedReduction = report.roadmap
    .filter((m) => record.completedMitigationIds.includes(m.id))
    .reduce((sum, m) => sum + m.expectedRiskReduction, 0);
  const residualRisk = Math.max(5, report.overallRiskScore - completedReduction);

  const filteredRoadmap = report.roadmap.filter((item) => {
    const matchesPriority = priorityFilter === "ALL" || item.priority === priorityFilter;
    const isDone = record.completedMitigationIds.includes(item.id);
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "DONE" && isDone) ||
      (statusFilter === "OPEN" && !isDone);
    return matchesPriority && matchesStatus;
  });

  const openRiskEvidence = (risk: Risk) => {
    const linkedMitigations = report.roadmap
      .filter((m) => m.linkedRiskIds.includes(risk.id))
      .map((m) => `[${m.priority}] ${m.title}`);
    setEvidence({
      title: `${risk.id}: ${risk.title}`,
      subtitle: `${AXIS_LABELS[risk.axis]} · Likelihood ${risk.likelihood}/5 × Severity ${risk.severity}/5`,
      score: risk.likelihood * risk.severity * 4,
      rationale: risk.description,
      drivers: risk.affected.map((a) => `Affected group: ${a}`),
      extraSections: [
        {
          heading: "Linked Mitigations",
          items:
            linkedMitigations.length > 0
              ? linkedMitigations
              : ["No directly linked roadmap item; review general P0/P1 safeguards."],
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{DOMAIN_LABELS[record.caseData.domain] || record.caseData.domain}</span>
              <span aria-hidden="true">·</span>
              <span>{AUTOMATION_LABELS[record.caseData.system.automationLevel]}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{report.reportId}</span>
              <span aria-hidden="true">·</span>
              <span>{new Date(report.generatedAt).toLocaleString()}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {record.caseData.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
            {record.versions.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="version-select" className="sr-only">
                  Report version
                </label>
                <select
                  id="version-select"
                  value={currentVersionObj.version}
                  onChange={(e) => setSelectedVersionNum(Number(e.target.value))}
                  className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200"
                >
                  {record.versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version} ({v.report.overallRiskScore}/100)
                    </option>
                  ))}
                </select>
                {scoreDelta !== null && (
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} vs v
                    {prevVersionObj?.version}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => onEditCase(record)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Case</span>
            </button>

            <button
              type="button"
              onClick={() => onRerunAnalysis(record)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-run Analysis</span>
            </button>
          </div>
        </div>

        {report.humanReviewRecommended && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>
              <strong>Human Ethics &amp; Legal Review Recommended:</strong> Risk profile or
              regulatory tier indicates formal governance committee sign-off and legal counsel
              review before deployment.
            </span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-slate-200 dark:border-slate-800 no-print"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  active
                    ? "bg-slate-900 dark:bg-indigo-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Overall Risk Gauge + Executive Summary */}
            <div className="lg:col-span-5 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Overall Risk Assessment
                </h2>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Schema v{report.schemaVersion}
                </span>
              </div>
              <OverallGauge score={report.overallRiskScore} level={report.overallRiskLevel} />
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Executive Summary
                </h3>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {report.executiveSummary}
                </p>
              </div>
            </div>

            {/* 5-Axis Ethics Radar Chart */}
            <div className="lg:col-span-7 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Five-Axis Ethics Risk Profile
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    0–100 risk scale (outer ring = higher risk)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRadarTable((v) => !v)}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  {showRadarTable ? "Show Radar Chart" : "Show Accessible Table"}
                </button>
              </div>

              {!showRadarTable ? (
                <div
                  className="h-72 w-full"
                  role="img"
                  aria-label="Five-axis ethics risk radar chart"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="74%">
                      <PolarGrid stroke={isDark ? "#334155" : "#cbd5e1"} />
                      <PolarAngleAxis
                        dataKey="axis"
                        tick={{ fill: isDark ? "#cbd5e1" : "#334155", fontSize: 12 }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
                      />
                      <Radar
                        name="Risk Score"
                        dataKey="score"
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.28}
                      />
                      <Tooltip
                        formatter={(val) => [`${val ?? 0}/100`, "Risk"]}
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#ffffff",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                          color: isDark ? "#f1f5f9" : "#0f172a",
                          fontSize: "12px",
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        <th className="py-2">Axis</th>
                        <th className="py-2 text-right">Risk Score</th>
                        <th className="py-2 text-right">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {radarData.map((row) => (
                        <tr key={row.axis}>
                          <td className="py-2.5 text-slate-800 dark:text-slate-200">
                            {row.fullAxis}
                          </td>
                          <td className="py-2.5 text-right font-mono">{row.score}/100</td>
                          <td className="py-2.5 text-right font-mono">{row.confidence}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Clickable Axis Breakdown with Evidence Drawers */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Axis Scores &amp; Evidence Rationale
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Select any axis to inspect rationale, confidence, and case drivers
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {report.axisScores.map((ax) => (
                <button
                  key={ax.axis}
                  type="button"
                  onClick={() =>
                    setEvidence({
                      title: AXIS_LABELS[ax.axis],
                      subtitle: `Five-Axis Risk Breakdown · ${ax.level.toUpperCase()}`,
                      score: ax.score,
                      confidence: ax.confidence,
                      rationale: ax.rationale,
                      drivers: ax.drivers,
                    })
                  }
                  className="w-full py-3.5 px-2 -mx-2 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {AXIS_LABELS[ax.axis]}
                      </span>
                      <RiskIndicator level={ax.level} />
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        Confidence {Math.round(ax.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {ax.rationale}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-28 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${getScoreBarColor(ax.score)}`}
                        style={{ width: `${ax.score}%` }}
                      />
                    </div>
                    <span
                      className={`w-12 text-right font-mono tabular-nums text-sm font-semibold ${getScoreTextColor(
                        ax.score
                      )}`}
                    >
                      {ax.score}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Assumptions & Limitations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Explicit Model Assumptions
              </h3>
              <ul className="space-y-1.5 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                {report.assumptions.length > 0 ? (
                  report.assumptions.map((a, i) => <li key={i}>{a}</li>)
                ) : (
                  <li>No additional assumptions recorded.</li>
                )}
              </ul>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Assessment Limitations
              </h3>
              <ul className="space-y-1.5 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                {report.limitations.length > 0 ? (
                  report.limitations.map((l, i) => <li key={i}>{l}</li>)
                ) : (
                  <li>Assessment reflects submitted case facts only.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: THEORIES */}
      {activeTab === "theories" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {report.theories.map((t) => {
            const title =
              t.theory === "utilitarian"
                ? "Consequentialism / Utilitarianism"
                : t.theory === "deontological"
                ? "Deontological Ethics"
                : "Virtue & Care Ethics";
            const meta = verdictMeta(t.verdict);

            return (
              <article
                key={t.theory}
                className="flex flex-col justify-between p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {title}
                    </h2>
                    <span className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-slate-100">
                      {t.score}
                      <span className="text-xs font-normal text-slate-500">/100</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${meta.classes}`}
                    >
                      {meta.label}
                    </span>
                    {typeof t.confidence === "number" && (
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        Confidence {Math.round(t.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {t.summary}
                  </p>

                  {t.keyFindings.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Key Findings
                      </h3>
                      <ul className="space-y-1 list-disc pl-4 text-xs text-slate-600 dark:text-slate-300">
                        {t.keyFindings.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {t.stakeholders && t.stakeholders.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Stakeholder Harm vs. Benefit
                      </h3>
                      <div className="space-y-2">
                        {t.stakeholders.map((st, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs space-y-1"
                          >
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {st.name}
                            </div>
                            <div className="text-emerald-700 dark:text-emerald-400">
                              Benefits: {st.benefits.join("; ") || "None noted"}
                            </div>
                            <div className="text-red-700 dark:text-red-400">
                              Harms: {st.harms.join("; ") || "None noted"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {t.rightsAtStake && t.rightsAtStake.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Rights at Stake
                      </h3>
                      <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        {t.rightsAtStake.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {t.violatedConstraints && t.violatedConstraints.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Duties &amp; Constraints Tested
                      </h3>
                      <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        {t.violatedConstraints.map((c, idx) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {t.flourishingImpacts && t.flourishingImpacts.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Flourishing &amp; Power Asymmetry
                      </h3>
                      <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        {t.flourishingImpacts.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEvidence({
                      title,
                      subtitle: `Normative Theory Assessment · ${meta.label}`,
                      score: t.score,
                      confidence: t.confidence,
                      rationale: t.summary,
                      extraSections: [
                        { heading: "Key Findings", items: t.keyFindings },
                        ...(t.rightsAtStake
                          ? [{ heading: "Rights at Stake", items: t.rightsAtStake }]
                          : []),
                        ...(t.violatedConstraints
                          ? [{ heading: "Constraints & Duties", items: t.violatedConstraints }]
                          : []),
                        ...(t.flourishingImpacts
                          ? [{ heading: "Flourishing Impacts", items: t.flourishingImpacts }]
                          : []),
                      ],
                    })
                  }
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Inspect Full Rationale
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 3: STANDARDS */}
      {activeTab === "standards" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* NIST AI RMF 1.0 */}
            <div className="lg:col-span-6 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    NIST AI RMF 1.0
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Function risk scores (higher = larger operational gap)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEvidence({
                      title: "NIST AI RMF 1.0 Assessment",
                      subtitle: "Govern · Map · Measure · Manage",
                      confidence: report.standards.nistRmf.confidence,
                      rationale:
                        report.standards.nistRmf.rationale ||
                        "Scores reflect operational governance gaps identified across NIST AI RMF functions.",
                      drivers: report.standards.nistRmf.gaps,
                    })
                  }
                  className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap"
                >
                  Evidence
                </button>
              </div>

              <div className="space-y-3">
                {(
                  [
                    { label: "Govern", value: report.standards.nistRmf.govern },
                    { label: "Map", value: report.standards.nistRmf.map },
                    { label: "Measure", value: report.standards.nistRmf.measure },
                    { label: "Manage", value: report.standards.nistRmf.manage },
                  ] as const
                ).map((fn) => (
                  <div key={fn.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800 dark:text-slate-200">{fn.label}</span>
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {fn.value}/100 risk
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${getScoreBarColor(fn.value)}`}
                        style={{ width: `${fn.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {report.standards.nistRmf.gaps.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Identified RMF Gaps
                  </h3>
                  <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {report.standards.nistRmf.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* EU AI Act + IEEE 7000 */}
            <div className="lg:col-span-6 space-y-6">
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    EU AI Act Classification
                  </h2>
                  <span
                    className={`px-2.5 py-1 rounded-md border text-xs font-semibold ${
                      euTierMeta(report.standards.euAiAct.riskTier).classes
                    }`}
                  >
                    {euTierMeta(report.standards.euAiAct.riskTier).label}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {report.standards.euAiAct.reasoning}
                </p>
                {report.standards.euAiAct.obligations.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                      Likely Regulatory Obligations (Verify with Legal Counsel)
                    </h3>
                    <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      {report.standards.euAiAct.obligations.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    IEEE 7000-2021 Value Traceability
                  </h2>
                  {typeof report.standards.ieee7000.confidence === "number" && (
                    <span className="text-xs font-mono text-slate-500">
                      Conf {Math.round(report.standards.ieee7000.confidence * 100)}%
                    </span>
                  )}
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Stakeholder Values Elicited
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300">
                      {report.standards.ieee7000.valuesElicited.join(" · ") || "None specified"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Ethical Value Requirements
                    </h3>
                    <ul className="list-disc pl-4 text-slate-600 dark:text-slate-300 space-y-1">
                      {report.standards.ieee7000.ethicalValueRequirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                      Traceability Gaps
                    </h3>
                    <ul className="list-disc pl-4 text-slate-600 dark:text-slate-300 space-y-1">
                      {report.standards.ieee7000.traceabilityGaps.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ALTAI 7 Requirements */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ALTAI — 7 Requirements for Trustworthy AI
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-4">Requirement</th>
                    <th className="py-2.5 px-4 text-right">Risk Score</th>
                    <th className="py-2.5 pl-4">Assessment Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {report.standards.altai.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.requirement}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${getScoreTextColor(
                          item.score
                        )}`}
                      >
                        {item.score}/100
                      </td>
                      <td className="py-3 pl-4 text-xs text-slate-600 dark:text-slate-300">
                        {item.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* UNESCO & OECD Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                UNESCO Recommendation on Ethics of AI
              </h2>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3">Principle</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 pl-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {report.standards.unesco.map((u, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                        {u.principle}
                      </td>
                      <td className="py-2.5 px-2">
                        <AlignmentStatus alignment={u.alignment} />
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600 dark:text-slate-300">{u.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                OECD AI Principles
              </h2>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3">Principle</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 pl-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {report.standards.oecd.map((o, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                        {o.principle}
                      </td>
                      <td className="py-2.5 px-2">
                        <AlignmentStatus alignment={o.alignment} />
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600 dark:text-slate-300">{o.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RISKS & TRADE-OFFS */}
      {activeTab === "risks" && (
        <div className="space-y-6">
          {/* 5x5 Heatmap Risk Matrix */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Risk Heatmap Matrix (Likelihood × Severity)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any plotted risk identifier to inspect affected groups and linked
                  mitigations.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {report.risks.length} identified risks
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[540px]">
                <div className="grid grid-cols-6 gap-1.5 text-xs">
                  <div className="flex items-end justify-center pb-1 font-medium text-slate-500 dark:text-slate-400">
                    L \ S
                  </div>
                  {[1, 2, 3, 4, 5].map((sev) => (
                    <div
                      key={sev}
                      className="text-center font-mono font-medium text-slate-600 dark:text-slate-300 pb-1"
                    >
                      Sev {sev}
                    </div>
                  ))}

                  {[5, 4, 3, 2, 1].map((lik) => (
                    <div key={lik} className="contents">
                      <div className="flex items-center justify-center font-mono font-medium text-slate-600 dark:text-slate-300">
                        Lik {lik}
                      </div>
                      {[1, 2, 3, 4, 5].map((sev) => {
                        const cellScore = lik * sev;
                        const cellBg =
                          cellScore >= 16
                            ? "bg-red-100/80 dark:bg-red-950/60 border-red-200 dark:border-red-900"
                            : cellScore >= 10
                            ? "bg-orange-100/70 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900"
                            : cellScore >= 5
                            ? "bg-amber-100/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900"
                            : "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900";

                        const cellRisks = report.risks.filter(
                          (r) => r.likelihood === lik && r.severity === sev
                        );

                        return (
                          <div
                            key={`${lik}-${sev}`}
                            className={`min-h-[54px] p-1.5 rounded-lg border flex flex-wrap gap-1 items-start content-start ${cellBg}`}
                          >
                            {cellRisks.map((risk) => (
                              <button
                                key={risk.id}
                                type="button"
                                onClick={() => openRiskEvidence(risk)}
                                title={risk.title}
                                className="px-2 py-1 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[11px] font-semibold hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                              >
                                {risk.id}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Accessible Risk Register Table */}
            <div className="overflow-x-auto pt-2 border-t border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 px-3">Risk</th>
                    <th className="py-2 px-3">Axis</th>
                    <th className="py-2 px-3 text-right">L × S</th>
                    <th className="py-2 pl-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {report.risks.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {r.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {r.title}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                          {r.description}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {AXIS_SHORT_LABELS[r.axis]}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">
                        {r.likelihood} × {r.severity} ({r.likelihood * r.severity})
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => openRiskEvidence(r)}
                          className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trade-off Matrix */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Ethical Trade-Off Matrix
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Irreducible value tensions identified in this deployment, cost allocation, and
                mitigation balance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.tradeOffs.map((tr) => (
                <div
                  key={tr.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {tr.a} vs. {tr.b}
                    </h3>
                    <RiskIndicator level={tr.tensionSeverity} />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {tr.description}
                  </p>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Who bears the cost:{" "}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">{tr.whoBearsCost}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Recommended balance:{" "}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {tr.recommendedBalance}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ROADMAP */}
      {activeTab === "roadmap" && (
        <div className="space-y-6">
          {/* Projected Residual Risk Bar */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Baseline Overall Risk
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {report.overallRiskScore}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Checked Mitigation Reduction
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  −{completedReduction} pts
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Projected Residual Risk
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
                    {residualRisk}
                    <span className="text-sm font-normal text-slate-500">/100</span>
                  </span>
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </div>

            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getScoreBarColor(residualRisk)}`}
                style={{ width: `${residualRisk}%` }}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(["ALL", "P0", "P1", "P2"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriorityFilter(p)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      priorityFilter === p
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {p === "ALL" ? "All Priorities" : p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(["ALL", "OPEN", "DONE"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      statusFilter === s
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {s === "ALL" ? "All Statuses" : s === "OPEN" ? "Open" : "Completed"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mitigation Cards */}
          <div className="space-y-3">
            {filteredRoadmap.map((item: MitigationItem) => {
              const checked = record.completedMitigationIds.includes(item.id);
              const priorityStyle =
                item.priority === "P0"
                  ? "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800"
                  : item.priority === "P1"
                  ? "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800"
                  : "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700";

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-xl border transition-colors ${
                    checked
                      ? "border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/30 dark:bg-emerald-950/10"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      id={`mitigation-${item.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleMitigation(record.caseData.id, item.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor={`mitigation-${item.id}`}
                          className={`text-base font-semibold cursor-pointer ${
                            checked
                              ? "line-through text-slate-500 dark:text-slate-400"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {item.title}
                        </label>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded border font-mono font-semibold ${priorityStyle}`}
                          >
                            {item.priority}
                          </span>
                          <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                            −{item.expectedRiskReduction} pts
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>Owner: {item.ownerRole}</span>
                        <span aria-hidden="true">·</span>
                        <span>Effort: {item.effort}</span>
                        {item.frameworkRefs.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Refs: {item.frameworkRefs.join(", ")}</span>
                          </>
                        )}
                      </div>

                      {item.steps.length > 0 && (
                        <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                          {item.steps.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      )}

                      {item.linkedRiskIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Linked risks:</span>
                          {item.linkedRiskIds.map((rid) => {
                            const foundRisk = report.risks.find((r) => r.id === rid);
                            return foundRisk ? (
                              <button
                                key={rid}
                                type="button"
                                onClick={() => openRiskEvidence(foundRisk)}
                                className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-200 hover:border-indigo-500"
                              >
                                {rid}
                              </button>
                            ) : (
                              <span
                                key={rid}
                                className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-mono text-slate-500"
                              >
                                {rid}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: EXPORT */}
      {activeTab === "export" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Audit &amp; Compliance Report Export
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Report ID <span className="font-mono">{report.reportId}</span> · Model{" "}
                  <span className="font-mono">{report.modelVersion}</span> · Schema v
                  {report.schemaVersion}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() =>
                    exportMarkdown(record.caseData, report, record.completedMitigationIds)
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportPdfReport(record.caseData, report, record.completedMitigationIds)
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportJsonAudit(record.caseData, report, record.completedMitigationIds)
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Every export includes explicit assumptions, limitations, timestamp, model version,
                  and report ID for governance audit trails.
                </span>
              </div>
              <pre className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[460px] whitespace-pre-wrap leading-relaxed">
                {buildMarkdownReport(record.caseData, report, record.completedMitigationIds)}
              </pre>
            </div>
          </div>
        </div>
      )}

      <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />
    </div>
  );
}
