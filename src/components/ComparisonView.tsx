import { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AXIS_LABELS, AXIS_SHORT_LABELS, Axis, CaseRecord, DOMAIN_LABELS } from "../types";
import { RiskIndicator } from "./RiskIndicator";

interface ComparisonViewProps {
  records: CaseRecord[];
  isDark: boolean;
  onGoToLibrary: () => void;
}

export default function ComparisonView({
  records,
  isDark,
  onGoToLibrary,
}: ComparisonViewProps) {
  const analyzed = useMemo(
    () => records.filter((r) => r.versions.length > 0),
    [records]
  );

  const [caseAId, setCaseAId] = useState<string>(() => analyzed[0]?.caseData.id || "");
  const [caseBId, setCaseBId] = useState<string>(
    () => analyzed[1]?.caseData.id || analyzed[0]?.caseData.id || ""
  );

  const recordA = analyzed.find((r) => r.caseData.id === caseAId) || analyzed[0];
  const recordB = analyzed.find((r) => r.caseData.id === caseBId) || analyzed[1] || analyzed[0];

  const reportA = recordA?.versions[recordA.versions.length - 1]?.report;
  const reportB = recordB?.versions[recordB.versions.length - 1]?.report;

  if (analyzed.length < 2 || !recordA || !recordB || !reportA || !reportB) {
    return (
      <div className="max-w-2xl mx-auto p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center space-y-4">
        <GitCompare className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Side-by-Side Case Comparison
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          At least two analyzed cases are required to compare ethical risk profiles, radar overlays,
          and regulatory tiers. Currently {analyzed.length} case
          {analyzed.length === 1 ? " is" : "s are"} analyzed.
        </p>
        <button
          type="button"
          onClick={onGoToLibrary}
          className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium"
        >
          Open Case Library to Run Analyses
        </button>
      </div>
    );
  }

  const axes: Axis[] = ["fairness", "privacy", "transparency", "safety", "human_agency"];
  const radarData = axes.map((ax) => {
    const scoreA = reportA.axisScores.find((s) => s.axis === ax)?.score ?? 0;
    const scoreB = reportB.axisScores.find((s) => s.axis === ax)?.score ?? 0;
    return {
      axis: AXIS_SHORT_LABELS[ax],
      fullAxis: AXIS_LABELS[ax],
      caseA: scoreA,
      caseB: scoreB,
      delta: scoreA - scoreB,
    };
  });

  const overallDelta = reportA.overallRiskScore - reportB.overallRiskScore;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Case Comparison &amp; Radar Overlay
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Compare overall risk scores, five-axis ethics profiles, normative verdicts, and EU AI Act
          tiers side by side.
        </p>
      </div>

      {/* Case Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
          <label
            htmlFor="compare-case-a"
            className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400"
          >
            Case A (Primary)
          </label>
          <select
            id="compare-case-a"
            value={recordA.caseData.id}
            onChange={(e) => setCaseAId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
          >
            {analyzed.map((r) => (
              <option key={r.caseData.id} value={r.caseData.id}>
                {r.caseData.title}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>{DOMAIN_LABELS[recordA.caseData.domain] || recordA.caseData.domain}</span>
            <RiskIndicator level={reportA.overallRiskLevel} score={reportA.overallRiskScore} />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
          <label
            htmlFor="compare-case-b"
            className="block text-xs font-semibold text-teal-700 dark:text-teal-400"
          >
            Case B (Baseline)
          </label>
          <select
            id="compare-case-b"
            value={recordB.caseData.id}
            onChange={(e) => setCaseBId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
          >
            {analyzed.map((r) => (
              <option key={r.caseData.id} value={r.caseData.id}>
                {r.caseData.title}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>{DOMAIN_LABELS[recordB.caseData.domain] || recordB.caseData.domain}</span>
            <RiskIndicator level={reportB.overallRiskLevel} score={reportB.overallRiskScore} />
          </div>
        </div>
      </div>

      {/* Radar Overlay + Delta Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            5-Axis Risk Radar Overlay
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Higher values indicate higher ethical risk (0–100 scale).
          </p>
          <div
            className="h-80 w-full"
            role="img"
            aria-label="Radar chart comparing Case A and Case B across 5 ethics axes"
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
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
                  name={recordA.caseData.title.slice(0, 28)}
                  dataKey="caseA"
                  stroke="#4f46e5"
                  fill="#4f46e5"
                  fillOpacity={0.25}
                />
                <Radar
                  name={recordB.caseData.title.slice(0, 28)}
                  dataKey="caseB"
                  stroke="#0d9488"
                  fill="#0d9488"
                  fillOpacity={0.2}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Tooltip
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
        </div>

        <div className="lg:col-span-6 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Quantitative Delta Matrix
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              Overall Delta (A − B): {overallDelta > 0 ? `+${overallDelta}` : overallDelta} pts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3">Dimension</th>
                  <th className="py-2 px-3 text-right">Case A</th>
                  <th className="py-2 px-3 text-right">Case B</th>
                  <th className="py-2 pl-3 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {radarData.map((row) => (
                  <tr key={row.axis}>
                    <td className="py-2.5 pr-3 text-slate-800 dark:text-slate-200">
                      {row.fullAxis}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-700 dark:text-indigo-400">
                      {row.caseA}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-teal-700 dark:text-teal-400">
                      {row.caseB}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-900/80 font-medium">
                  <td className="py-2.5 pr-3 text-slate-900 dark:text-slate-100">
                    EU AI Act Risk Tier
                  </td>
                  <td className="py-2.5 px-3 text-right uppercase text-xs">
                    {reportA.standards.euAiAct.riskTier}
                  </td>
                  <td className="py-2.5 px-3 text-right uppercase text-xs">
                    {reportB.standards.euAiAct.riskTier}
                  </td>
                  <td className="py-2.5 pl-3 text-right text-xs text-slate-500">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 text-slate-800 dark:text-slate-200">
                    NIST RMF Avg Risk
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {Math.round(
                      (reportA.standards.nistRmf.govern +
                        reportA.standards.nistRmf.map +
                        reportA.standards.nistRmf.measure +
                        reportA.standards.nistRmf.manage) /
                        4
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {Math.round(
                      (reportB.standards.nistRmf.govern +
                        reportB.standards.nistRmf.map +
                        reportB.standards.nistRmf.measure +
                        reportB.standards.nistRmf.manage) /
                        4
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono text-slate-500">
                    {Math.round(
                      (reportA.standards.nistRmf.govern +
                        reportA.standards.nistRmf.map +
                        reportA.standards.nistRmf.measure +
                        reportA.standards.nistRmf.manage) /
                        4 -
                        (reportB.standards.nistRmf.govern +
                          reportB.standards.nistRmf.map +
                          reportB.standards.nistRmf.measure +
                          reportB.standards.nistRmf.manage) /
                          4
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
