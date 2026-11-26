import {
  AnalysisReport,
  Axis,
  AxisScore,
  Case,
  LayerNumber,
  MitigationItem,
  Risk,
  RiskLevel,
  StandardsAssessment,
  TheoryAnalysis,
  TradeOff,
} from "../types";

export interface LayerCallbacks {
  onLayerStart: (layer: LayerNumber) => void;
  onLayerComplete: (layer: LayerNumber, durationMs: number) => void;
  onLayerError: (layer: LayerNumber, errorMessage: string) => void;
}

const ALL_AXES: Axis[] = ["fairness", "privacy", "transparency", "safety", "human_agency"];

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

function normalizeRiskLevel(level: unknown, score: number): RiskLevel {
  if (level === "low" || level === "moderate" || level === "high" || level === "critical") {
    return level;
  }
  return scoreToRiskLevel(score);
}

function generateReportId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ETH-${ts}-${rand}`;
}

async function postLayer<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<{ data: T; modelVersion: string }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let json: {
    data?: T;
    modelVersion?: string;
    error?: string;
  } = {};

  if (rawText.trim()) {
    try {
      json = JSON.parse(rawText) as typeof json;
    } catch {
      const trimmed = rawText.trim().toLowerCase();
      if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
        throw new Error(
          `Server returned an HTML page instead of JSON for ${endpoint} (status ${response.status}). Please refresh the page or verify the backend server is running.`
        );
      }
      throw new Error(
        `Invalid JSON response from ${endpoint} (status ${response.status}).`
      );
    }
  }

  if (!response.ok || !json.data) {
    throw new Error(json.error || `Request to ${endpoint} failed (${response.status})`);
  }

  return {
    data: json.data,
    modelVersion: json.modelVersion || "gemini-4-hydrogen",
  };
}

function normalizeTheories(raw: unknown): TheoryAnalysis[] {
  const list = Array.isArray(raw) ? raw : [];
  const order: Array<"utilitarian" | "deontological" | "virtue_care"> = [
    "utilitarian",
    "deontological",
    "virtue_care",
  ];

  return order.map((theoryName) => {
    const found = list.find(
      (item) => item && typeof item === "object" && (item as TheoryAnalysis).theory === theoryName
    ) as Partial<TheoryAnalysis> | undefined;

    const score = Math.round(clamp(found?.score, 0, 100, 50));
    const verdict =
      found?.verdict === "acceptable" ||
      found?.verdict === "acceptable_with_conditions" ||
      found?.verdict === "problematic" ||
      found?.verdict === "unacceptable"
        ? found.verdict
        : score >= 75
        ? "unacceptable"
        : score >= 55
        ? "problematic"
        : "acceptable_with_conditions";

    return {
      theory: theoryName,
      verdict,
      score,
      confidence: clamp(found?.confidence, 0, 1, 0.7),
      summary:
        typeof found?.summary === "string" && found.summary.trim()
          ? found.summary
          : "Evaluation generated with limited case specification.",
      keyFindings: Array.isArray(found?.keyFindings) ? found.keyFindings.map(String) : [],
      stakeholders: Array.isArray(found?.stakeholders) ? found.stakeholders : undefined,
      rightsAtStake: Array.isArray(found?.rightsAtStake)
        ? found.rightsAtStake.map(String)
        : undefined,
      violatedConstraints: Array.isArray(found?.violatedConstraints)
        ? found.violatedConstraints.map(String)
        : undefined,
      flourishingImpacts: Array.isArray(found?.flourishingImpacts)
        ? found.flourishingImpacts.map(String)
        : undefined,
    };
  });
}

function normalizeStandards(
  layer2: Partial<StandardsAssessment>,
  layer3: Partial<StandardsAssessment>
): StandardsAssessment {
  const nist = layer2.nistRmf || ({} as StandardsAssessment["nistRmf"]);
  const ieee = layer2.ieee7000 || ({} as StandardsAssessment["ieee7000"]);
  const eu = layer3.euAiAct || ({} as StandardsAssessment["euAiAct"]);

  return {
    nistRmf: {
      govern: Math.round(clamp(nist.govern, 0, 100, 50)),
      map: Math.round(clamp(nist.map, 0, 100, 50)),
      measure: Math.round(clamp(nist.measure, 0, 100, 50)),
      manage: Math.round(clamp(nist.manage, 0, 100, 50)),
      gaps: Array.isArray(nist.gaps) ? nist.gaps.map(String) : [],
      rationale: typeof nist.rationale === "string" ? nist.rationale : undefined,
      confidence: clamp(nist.confidence, 0, 1, 0.7),
    },
    ieee7000: {
      valuesElicited: Array.isArray(ieee.valuesElicited) ? ieee.valuesElicited.map(String) : [],
      ethicalValueRequirements: Array.isArray(ieee.ethicalValueRequirements)
        ? ieee.ethicalValueRequirements.map(String)
        : [],
      traceabilityGaps: Array.isArray(ieee.traceabilityGaps)
        ? ieee.traceabilityGaps.map(String)
        : [],
      confidence: clamp(ieee.confidence, 0, 1, 0.7),
    },
    euAiAct: {
      riskTier:
        eu.riskTier === "unacceptable" ||
        eu.riskTier === "high" ||
        eu.riskTier === "limited" ||
        eu.riskTier === "minimal"
          ? eu.riskTier
          : "high",
      reasoning: typeof eu.reasoning === "string" ? eu.reasoning : "",
      obligations: Array.isArray(eu.obligations) ? eu.obligations.map(String) : [],
      confidence: clamp(eu.confidence, 0, 1, 0.7),
    },
    altai: Array.isArray(layer3.altai)
      ? layer3.altai.map((a) => ({
          requirement: String(a.requirement || "Requirement"),
          score: Math.round(clamp(a.score, 0, 100, 50)),
          note: String(a.note || ""),
        }))
      : [],
    unesco: Array.isArray(layer3.unesco)
      ? layer3.unesco.map((u) => ({
          principle: String(u.principle || "Principle"),
          alignment:
            u.alignment === "aligned" || u.alignment === "partial" || u.alignment === "misaligned"
              ? u.alignment
              : "partial",
          note: String(u.note || ""),
        }))
      : [],
    oecd: Array.isArray(layer3.oecd)
      ? layer3.oecd.map((o) => ({
          principle: String(o.principle || "Principle"),
          alignment:
            o.alignment === "aligned" || o.alignment === "partial" || o.alignment === "misaligned"
              ? o.alignment
              : "partial",
          note: String(o.note || ""),
        }))
      : [],
  };
}

function normalizeAxisScores(raw: unknown): AxisScore[] {
  const list = Array.isArray(raw) ? raw : [];
  return ALL_AXES.map((axis) => {
    const found = list.find(
      (item) => item && typeof item === "object" && (item as AxisScore).axis === axis
    ) as Partial<AxisScore> | undefined;
    const score = Math.round(clamp(found?.score, 0, 100, 50));
    return {
      axis,
      score,
      level: normalizeRiskLevel(found?.level, score),
      rationale:
        typeof found?.rationale === "string" && found.rationale.trim()
          ? found.rationale
          : "No specific rationale returned for this axis.",
      confidence: Number(clamp(found?.confidence, 0, 1, 0.7).toFixed(2)),
      drivers: Array.isArray(found?.drivers) ? found.drivers.map(String) : [],
    };
  });
}

function normalizeRisks(raw: unknown): Risk[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((r, idx) => {
    const item = (r || {}) as Partial<Risk>;
    const axis = ALL_AXES.includes(item.axis as Axis) ? (item.axis as Axis) : "fairness";
    const likelihood = Math.round(clamp(item.likelihood, 1, 5, 3)) as 1 | 2 | 3 | 4 | 5;
    const severity = Math.round(clamp(item.severity, 1, 5, 3)) as 1 | 2 | 3 | 4 | 5;
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id : `R${idx + 1}`,
      title: typeof item.title === "string" ? item.title : `Identified Risk ${idx + 1}`,
      axis,
      likelihood,
      severity,
      description: typeof item.description === "string" ? item.description : "",
      affected: Array.isArray(item.affected) ? item.affected.map(String) : [],
    };
  });
}

function normalizeTradeOffs(raw: unknown): TradeOff[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((t, idx) => {
    const item = (t || {}) as Partial<TradeOff>;
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id : `T${idx + 1}`,
      a: String(item.a || "Primary Value"),
      b: String(item.b || "Competing Value"),
      tensionSeverity: normalizeRiskLevel(item.tensionSeverity, 60),
      description: String(item.description || ""),
      whoBearsCost: String(item.whoBearsCost || "Affected end-users"),
      recommendedBalance: String(item.recommendedBalance || ""),
    };
  });
}

function normalizeRoadmap(raw: unknown): MitigationItem[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((m, idx) => {
    const item = (m || {}) as Partial<MitigationItem>;
    const priority =
      item.priority === "P0" || item.priority === "P1" || item.priority === "P2"
        ? item.priority
        : "P1";
    const effort = item.effort === "S" || item.effort === "M" || item.effort === "L" ? item.effort : "M";
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id : `M${idx + 1}`,
      priority,
      title: String(item.title || `Mitigation Action ${idx + 1}`),
      steps: Array.isArray(item.steps) ? item.steps.map(String) : [],
      ownerRole: String(item.ownerRole || "AI Governance Lead"),
      effort,
      expectedRiskReduction: Math.round(clamp(item.expectedRiskReduction, 1, 25, 6)),
      linkedRiskIds: Array.isArray(item.linkedRiskIds) ? item.linkedRiskIds.map(String) : [],
      frameworkRefs: Array.isArray(item.frameworkRefs) ? item.frameworkRefs.map(String) : [],
    };
  });
}

export async function runFourLayerAnalysis(
  caseData: Case,
  callbacks: LayerCallbacks
): Promise<AnalysisReport> {
  // Layer 1
  callbacks.onLayerStart(1);
  const t1 = performance.now();
  let layer1Result: { data: { theories: unknown[] }; modelVersion: string };
  try {
    layer1Result = await postLayer<{ theories: unknown[] }>("/api/analyze/layer1", { caseData });
    callbacks.onLayerComplete(1, Math.round(performance.now() - t1));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Layer 1 failed";
    callbacks.onLayerError(1, msg);
    throw err;
  }

  // Layer 2
  callbacks.onLayerStart(2);
  const t2 = performance.now();
  let layer2Result: { data: Partial<StandardsAssessment>; modelVersion: string };
  try {
    layer2Result = await postLayer<Partial<StandardsAssessment>>("/api/analyze/layer2", {
      caseData,
      layer1: layer1Result.data,
    });
    callbacks.onLayerComplete(2, Math.round(performance.now() - t2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Layer 2 failed";
    callbacks.onLayerError(2, msg);
    throw err;
  }

  // Layer 3
  callbacks.onLayerStart(3);
  const t3 = performance.now();
  let layer3Result: { data: Partial<StandardsAssessment>; modelVersion: string };
  try {
    layer3Result = await postLayer<Partial<StandardsAssessment>>("/api/analyze/layer3", {
      caseData,
      layer1: layer1Result.data,
      layer2: layer2Result.data,
    });
    callbacks.onLayerComplete(3, Math.round(performance.now() - t3));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Layer 3 failed";
    callbacks.onLayerError(3, msg);
    throw err;
  }

  // Layer 4
  callbacks.onLayerStart(4);
  const t4 = performance.now();
  let layer4Result: {
    data: {
      executiveSummary?: string;
      overallRiskScore?: number;
      overallRiskLevel?: RiskLevel;
      humanReviewRecommended?: boolean;
      axisScores?: unknown[];
      risks?: unknown[];
      tradeOffs?: unknown[];
      roadmap?: unknown[];
      assumptions?: unknown[];
      limitations?: unknown[];
    };
    modelVersion: string;
  };
  try {
    layer4Result = await postLayer("/api/analyze/layer4", {
      caseData,
      layer1: layer1Result.data,
      layer2: layer2Result.data,
      layer3: layer3Result.data,
    });
    callbacks.onLayerComplete(4, Math.round(performance.now() - t4));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Layer 4 failed";
    callbacks.onLayerError(4, msg);
    throw err;
  }

  const axisScores = normalizeAxisScores(layer4Result.data.axisScores);
  const avgAxis =
    axisScores.reduce((acc, a) => acc + a.score, 0) / Math.max(1, axisScores.length);
  const overallRiskScore = Math.round(
    clamp(layer4Result.data.overallRiskScore, 0, 100, Math.round(avgAxis))
  );

  return {
    reportId: generateReportId(),
    caseId: caseData.id,
    schemaVersion: "1.0",
    modelVersion: layer4Result.modelVersion || layer1Result.modelVersion || "gemini-4-hydrogen",
    generatedAt: new Date().toISOString(),
    executiveSummary:
      typeof layer4Result.data.executiveSummary === "string" &&
      layer4Result.data.executiveSummary.trim()
        ? layer4Result.data.executiveSummary
        : "Ethics assessment completed across normative theories, operational standards, and regulatory governance frameworks.",
    overallRiskScore,
    overallRiskLevel: normalizeRiskLevel(layer4Result.data.overallRiskLevel, overallRiskScore),
    axisScores,
    theories: normalizeTheories(layer1Result.data.theories),
    standards: normalizeStandards(layer2Result.data, layer3Result.data),
    risks: normalizeRisks(layer4Result.data.risks),
    tradeOffs: normalizeTradeOffs(layer4Result.data.tradeOffs),
    roadmap: normalizeRoadmap(layer4Result.data.roadmap),
    assumptions: Array.isArray(layer4Result.data.assumptions)
      ? layer4Result.data.assumptions.map(String)
      : [],
    limitations: Array.isArray(layer4Result.data.limitations)
      ? layer4Result.data.limitations.map(String)
      : [],
    humanReviewRecommended: Boolean(
      layer4Result.data.humanReviewRecommended ?? overallRiskScore >= 40
    ),
  };
}
