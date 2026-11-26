export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type Axis = "fairness" | "privacy" | "transparency" | "safety" | "human_agency";

export type AutomationLevel = "human_in_loop" | "human_on_loop" | "fully_automated";
export type ImpactScope = "individual" | "group" | "societal";
export type Reversibility = "reversible" | "partially" | "irreversible";

export interface Case {
  id: string;
  title: string;
  description: string;
  domain: string;
  system: {
    modelType: string;
    automationLevel: AutomationLevel;
    dataSources: string[];
    dataSensitivity: string[];
    trainingDataOrigin: string;
    existingSafeguards: string;
  };
  impact: {
    affectedGroups: string[];
    scope: ImpactScope;
    reversibility: Reversibility;
    regions: string[];
    scaleEstimate: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AxisScore {
  axis: Axis;
  score: number; // 0-100 risk
  level: RiskLevel;
  rationale: string;
  confidence: number; // 0-1
  drivers: string[];
}

export interface TheoryStakeholder {
  name: string;
  benefits: string[];
  harms: string[];
}

export interface TheoryAnalysis {
  theory: "utilitarian" | "deontological" | "virtue_care";
  verdict: "acceptable" | "acceptable_with_conditions" | "problematic" | "unacceptable";
  score: number;
  confidence?: number;
  summary: string;
  keyFindings: string[];
  stakeholders?: TheoryStakeholder[];
  rightsAtStake?: string[];
  violatedConstraints?: string[];
  flourishingImpacts?: string[];
}

export interface StandardsAssessment {
  nistRmf: {
    govern: number;
    map: number;
    measure: number;
    manage: number;
    gaps: string[];
    rationale?: string;
    confidence?: number;
  };
  ieee7000: {
    valuesElicited: string[];
    ethicalValueRequirements: string[];
    traceabilityGaps: string[];
    confidence?: number;
  };
  euAiAct: {
    riskTier: "unacceptable" | "high" | "limited" | "minimal";
    reasoning: string;
    obligations: string[];
    confidence?: number;
  };
  altai: {
    requirement: string;
    score: number;
    note: string;
  }[];
  unesco: {
    principle: string;
    alignment: "aligned" | "partial" | "misaligned";
    note: string;
  }[];
  oecd: {
    principle: string;
    alignment: "aligned" | "partial" | "misaligned";
    note: string;
  }[];
}

export interface Risk {
  id: string;
  title: string;
  axis: Axis;
  likelihood: 1 | 2 | 3 | 4 | 5;
  severity: 1 | 2 | 3 | 4 | 5;
  description: string;
  affected: string[];
}

export interface TradeOff {
  id: string;
  a: string;
  b: string;
  tensionSeverity: RiskLevel;
  description: string;
  whoBearsCost: string;
  recommendedBalance: string;
}

export interface MitigationItem {
  id: string;
  priority: "P0" | "P1" | "P2";
  title: string;
  steps: string[];
  ownerRole: string;
  effort: "S" | "M" | "L";
  expectedRiskReduction: number;
  linkedRiskIds: string[];
  frameworkRefs: string[];
}

export interface AnalysisReport {
  reportId: string;
  caseId: string;
  schemaVersion: "1.0";
  modelVersion: string;
  generatedAt: string;
  executiveSummary: string;
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  axisScores: AxisScore[];
  theories: TheoryAnalysis[];
  standards: StandardsAssessment;
  risks: Risk[];
  tradeOffs: TradeOff[];
  roadmap: MitigationItem[];
  assumptions: string[];
  limitations: string[];
  humanReviewRecommended: boolean;
}

export interface ReportVersion {
  version: number;
  report: AnalysisReport;
}

export interface CaseRecord {
  caseData: Case;
  versions: ReportVersion[];
  completedMitigationIds: string[];
}

export type AppScreen =
  | "landing"
  | "wizard"
  | "analyzing"
  | "dashboard"
  | "library"
  | "compare";

export type LayerNumber = 1 | 2 | 3 | 4;

export interface LayerStepState {
  layer: LayerNumber;
  title: string;
  subtitle: string;
  status: "pending" | "running" | "completed" | "error";
  error?: string;
  durationMs?: number;
}

export const AXIS_LABELS: Record<Axis, string> = {
  fairness: "Fairness & Non-Discrimination",
  privacy: "Privacy & Data Governance",
  transparency: "Transparency & Explainability",
  safety: "Safety & Robustness",
  human_agency: "Human Agency & Oversight",
};

export const AXIS_SHORT_LABELS: Record<Axis, string> = {
  fairness: "Fairness",
  privacy: "Privacy",
  transparency: "Transparency",
  safety: "Safety",
  human_agency: "Human Agency",
};

export const DOMAIN_LABELS: Record<string, string> = {
  healthcare: "Healthcare",
  finance: "Finance & Credit",
  hiring_hr: "Hiring & HR",
  education: "Education",
  law_enforcement: "Law Enforcement",
  social_media: "Social Media & Content",
  autonomous_systems: "Autonomous Systems",
  public_services: "Public Services",
  other: "Other",
};

export const MODEL_TYPE_LABELS: Record<string, string> = {
  classifier: "Tabular / Predictive Classifier",
  llm_generative: "LLM / Generative AI",
  recommender: "Recommender System",
  computer_vision: "Computer Vision",
  reinforcement_learning: "Reinforcement Learning",
  other: "Other / Hybrid",
};

export const AUTOMATION_LABELS: Record<AutomationLevel, string> = {
  human_in_loop: "Human-in-the-loop",
  human_on_loop: "Human-on-the-loop",
  fully_automated: "Fully automated",
};

export const SCOPE_LABELS: Record<ImpactScope, string> = {
  individual: "Individual",
  group: "Group / Cohort",
  societal: "Societal",
};

export const REVERSIBILITY_LABELS: Record<Reversibility, string> = {
  reversible: "Reversible",
  partially: "Partially reversible",
  irreversible: "Irreversible",
};

export const SENSITIVITY_OPTIONS = [
  { id: "personal", label: "Personal identifiers (PII)" },
  { id: "biometric", label: "Biometric data" },
  { id: "health", label: "Health & medical records" },
  { id: "financial", label: "Financial & credit data" },
  { id: "childrens_data", label: "Children's / minors' data" },
  { id: "public", label: "Publicly available data" },
];
