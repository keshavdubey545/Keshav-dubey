import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { RiskLevel } from "../types";

interface RiskIndicatorProps {
  level: RiskLevel;
  score?: number;
  size?: "sm" | "md";
}

const LEVEL_CONFIG: Record<
  RiskLevel,
  {
    label: string;
    classes: string;
    Icon: typeof CheckCircle2;
  }
> = {
  low: {
    label: "Low Risk",
    classes:
      "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/80",
    Icon: CheckCircle2,
  },
  moderate: {
    label: "Moderate Risk",
    classes:
      "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80",
    Icon: Info,
  },
  high: {
    label: "High Risk",
    classes:
      "text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800/80",
    Icon: AlertTriangle,
  },
  critical: {
    label: "Critical Risk",
    classes:
      "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/80",
    Icon: AlertOctagon,
  },
};

export function RiskIndicator({ level, score, size = "sm" }: RiskIndicatorProps) {
  const cfg = LEVEL_CONFIG[level];
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap shrink-0 tabular-nums ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
      } ${cfg.classes}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
      {typeof score === "number" && <span className="font-mono">({score}/100)</span>}
    </span>
  );
}

export function getScoreBarColor(score: number): string {
  if (score >= 75) return "bg-red-600 dark:bg-red-500";
  if (score >= 55) return "bg-orange-600 dark:bg-orange-500";
  if (score >= 30) return "bg-amber-600 dark:bg-amber-500";
  return "bg-emerald-600 dark:bg-emerald-500";
}

export function getScoreTextColor(score: number): string {
  if (score >= 75) return "text-red-700 dark:text-red-400";
  if (score >= 55) return "text-orange-700 dark:text-orange-400";
  if (score >= 30) return "text-amber-700 dark:text-amber-400";
  return "text-emerald-700 dark:text-emerald-400";
}
