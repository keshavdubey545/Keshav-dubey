import { useMemo, useState } from "react";
import {
  Copy,
  FilePlus2,
  FolderOpen,
  GitCompare,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { CaseRecord, DOMAIN_LABELS } from "../types";
import { RiskIndicator } from "./RiskIndicator";

interface CaseLibraryProps {
  records: CaseRecord[];
  onNewCase: () => void;
  onOpenReport: (caseId: string) => void;
  onRunAnalysis: (record: CaseRecord) => void;
  onEditCase: (record: CaseRecord) => void;
  onDuplicateCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onRestoreSamples: () => void;
  onCompareCases: () => void;
}

export default function CaseLibrary({
  records,
  onNewCase,
  onOpenReport,
  onRunAnalysis,
  onEditCase,
  onDuplicateCase,
  onDeleteCase,
  onRestoreSamples,
  onCompareCases,
}: CaseLibraryProps) {
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"updated" | "risk" | "title">("updated");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const analyzedCount = records.filter((r) => r.versions.length > 0).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records.filter((r) => {
      const matchesDomain = domainFilter === "all" || r.caseData.domain === domainFilter;
      const matchesQuery =
        !q ||
        r.caseData.title.toLowerCase().includes(q) ||
        r.caseData.description.toLowerCase().includes(q);
      return matchesDomain && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "title") {
        return a.caseData.title.localeCompare(b.caseData.title);
      }
      if (sortBy === "risk") {
        const aScore = a.versions[a.versions.length - 1]?.report.overallRiskScore ?? -1;
        const bScore = b.versions[b.versions.length - 1]?.report.overallRiskScore ?? -1;
        return bScore - aScore;
      }
      return (
        new Date(b.caseData.updatedAt).getTime() - new Date(a.caseData.updatedAt).getTime()
      );
    });
  }, [records, query, domainFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Case Library</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {records.length} stored cases · {analyzedCount} analyzed · Saved in browser localStorage
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {analyzedCount >= 2 && (
            <button
              type="button"
              onClick={onCompareCases}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Cases</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRestoreSamples}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Samples</span>
          </button>
          <button
            type="button"
            onClick={onNewCase}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>New Case</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases by title or description..."
            aria-label="Search cases"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          aria-label="Filter by domain"
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <option value="all">All domains</option>
          {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "updated" | "risk" | "title")}
          aria-label="Sort cases"
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <option value="updated">Sort: Recently updated</option>
          <option value="risk">Sort: Highest risk</option>
          <option value="title">Sort: Title A–Z</option>
        </select>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="p-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center space-y-3">
          <FolderOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {records.length === 0 ? "Your case library is empty" : "No matching cases found"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {records.length === 0
              ? "Create a new AI deployment scenario or restore the three prebuilt sample cases to begin."
              : "Try adjusting your search keywords or domain filter."}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onNewCase}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium"
            >
              Start New Case
            </button>
            {records.length === 0 && (
              <button
                type="button"
                onClick={onRestoreSamples}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Restore Sample Cases
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900">
                <th className="py-3 px-4">Case</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Latest Assessment</th>
                <th className="py-3 px-4 text-right">Versions</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filtered.map((record) => {
                const latest = record.versions[record.versions.length - 1]?.report;
                const isConfirming = confirmDeleteId === record.caseData.id;

                return (
                  <tr
                    key={record.caseData.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {record.caseData.title}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {record.caseData.description}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                      {DOMAIN_LABELS[record.caseData.domain] || record.caseData.domain}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {latest ? (
                        <RiskIndicator
                          level={latest.overallRiskLevel}
                          score={latest.overallRiskScore}
                        />
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Not yet analyzed
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
                      v{record.versions.length}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs text-red-700 dark:text-red-400 font-medium">
                            Delete?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCase(record.caseData.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          {latest ? (
                            <button
                              type="button"
                              onClick={() => onOpenReport(record.caseData.id)}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 whitespace-nowrap shrink-0"
                            >
                              Open Report
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onRunAnalysis(record)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium whitespace-nowrap shrink-0"
                            >
                              <Play className="w-3 h-3" />
                              <span>Run Analysis</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onEditCase(record)}
                            aria-label={`Edit ${record.caseData.title}`}
                            title="Edit & Re-run"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateCase(record.caseData.id)}
                            aria-label={`Duplicate ${record.caseData.title}`}
                            title="Duplicate case"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(record.caseData.id)}
                            aria-label={`Delete ${record.caseData.title}`}
                            title="Delete case"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
