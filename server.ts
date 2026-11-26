import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Never collide with nginx's proxy port (8080); default to 3000 behind nginx
const PORT =
  process.env.NGINX_PORT && process.env.PORT === process.env.NGINX_PORT
    ? Number(process.env.DEFAULT_APP_PORT) || 3000
    : Number(process.env.PORT) || Number(process.env.DEFAULT_APP_PORT) || 3000;

const MODEL_CANDIDATES = [
  "gemini-4-hydrogen",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
] as const;

const CORE_SYSTEM_INSTRUCTION = `You are a senior AI ethics assessor combining expertise in moral philosophy, AI governance, and ML engineering. You evaluate AI deployment cases against: (1) utilitarian, deontological and virtue/care ethics; (2) NIST AI RMF 1.0 (Govern, Map, Measure, Manage) and IEEE 7000-2021; (3) the UNESCO Recommendation on the Ethics of AI, the EU AI Act and ALTAI, and the OECD AI Principles.
Rules: Base every judgment only on the case facts provided; if information is missing, state the assumption explicitly and lower your confidence. Never invent legal citations, statistics or standards clauses. Score on a 0–100 RISK scale (higher = riskier). Give a rationale and a confidence (0–1) for every score. Consider vulnerable groups, power asymmetries, reversibility and scale. Identify genuine trade-offs rather than pretending all values can be maximized; say who bears the cost of each. Make mitigations specific, actionable, prioritized, and tied to risks and framework references. Be balanced: acknowledge benefits as well as harms. Do not give legal advice; flag where legal review is needed. Return ONLY JSON matching the provided schema.`;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw Object.assign(new Error("Gemini API key is not configured on the server."), {
      statusCode: 500,
    });
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function repairJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else {
    startIdx = Math.max(firstBrace, firstBracket);
  }
  if (startIdx > 0) {
    cleaned = cleaned.slice(startIdx);
  }
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const endIdx = Math.max(lastBrace, lastBracket);
  if (endIdx > 0 && endIdx < cleaned.length - 1) {
    cleaned = cleaned.slice(0, endIdx + 1);
  }
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  return cleaned;
}

function parseJsonSafe<T>(raw: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const repaired = repairJsonString(raw);
    parsed = JSON.parse(repaired);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model returned non-object JSON payload.");
  }
  return parsed as T;
}

function isTransientError(err: unknown): boolean {
  const msg = ((err as { message?: string })?.message || "").toLowerCase();
  const status = (err as { status?: number; statusCode?: number })?.statusCode ||
    (err as { status?: number })?.status;
  return (
    status === 503 ||
    status === 429 ||
    status === 502 ||
    status === 504 ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("resource_exhausted")
  );
}

function buildConfigForModel(
  model: string,
  layerFocus: string,
  responseSchema: Record<string, unknown>
): Record<string, unknown> {
  const baseConfig: Record<string, unknown> = {
    systemInstruction: `${CORE_SYSTEM_INSTRUCTION}\n\nCurrent Layer Task: ${layerFocus}`,
    responseMimeType: "application/json",
    responseSchema: responseSchema as never,
    seed: 42,
  };

  if (model.startsWith("gemini-4") || model.startsWith("gemini-3")) {
    baseConfig.thinkingConfig = {
      thinkingLevel: ThinkingLevel.LOW,
    };
  } else {
    baseConfig.temperature = 0.2;
  }

  return baseConfig;
}

async function generateStructuredWithRetry<T>(
  taskPrompt: string,
  layerFocus: string,
  responseSchema: Record<string, unknown>
): Promise<{ data: T; modelVersion: string }> {
  const ai = getAiClient();
  let lastError: unknown = null;

  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: taskPrompt,
          config: buildConfigForModel(model, layerFocus, responseSchema) as never,
        });

        const text = response.text;
        if (!text || !text.trim()) {
          throw new Error("Empty JSON response received from model.");
        }
        const data = parseJsonSafe<T>(text);
        return { data, modelVersion: model };
      } catch (err) {
        lastError = err;
        const msg = ((err as { message?: string })?.message || "").toLowerCase();
        // If auth error, don't loop other models
        if (msg.includes("api_key_invalid") || msg.includes("permission_denied")) {
          throw err;
        }
        // If transient 503/429, pause briefly before retry or falling back to next model
        if (attempt === 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, isTransientError(err) ? 1000 : 500)
          );
        }
      }
    }
  }

  throw lastError;
}

function formatCaseForPrompt(caseData: Record<string, unknown>): string {
  return JSON.stringify(caseData, null, 2);
}

function validateCasePayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const caseData = record.caseData;
  if (!caseData || typeof caseData !== "object") return null;
  const c = caseData as Record<string, unknown>;
  if (typeof c.title !== "string" || typeof c.description !== "string") return null;
  if (!c.title.trim() || !c.description.trim()) return null;
  if (c.title.length > 500 || c.description.length > 10000) return null;
  return c;
}

function extractReadableErrorMessage(rawMessage: string): string {
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // Keep original message
  }
  return rawMessage;
}

function sendApiError(res: Response, err: unknown): void {
  const errorObj = err as { status?: number; statusCode?: number; message?: string };
  const rawMessage = errorObj?.message || "Analysis request failed.";
  const readable = extractReadableErrorMessage(rawMessage);
  const lower = readable.toLowerCase();

  let status = errorObj?.statusCode || errorObj?.status || 500;
  let userMessage = "Failed to complete AI ethics evaluation layer.";

  if (lower.includes("api_key_invalid") || lower.includes("permission_denied") || status === 403) {
    status = 403;
    userMessage =
      "Gemini API key is missing or invalid. Please check your key in the Settings > Secrets panel.";
  } else if (lower.includes("resource_exhausted") || status === 429) {
    status = 429;
    userMessage =
      "Gemini API rate limit or quota reached. Please wait a moment and retry, or check your quota in Settings > Secrets.";
  } else if (lower.includes("high demand") || lower.includes("unavailable") || status === 503) {
    status = 503;
    userMessage =
      "The Gemini API is temporarily experiencing high demand. Please click Retry Analysis in a moment.";
  } else if (lower.includes("not_found") || status === 404) {
    status = 404;
    userMessage = "Requested Gemini model was unavailable.";
  } else if (lower.includes("not configured")) {
    status = 500;
    userMessage =
      "Server Gemini API key is not configured. Add GEMINI_API_KEY in the Settings > Secrets panel.";
  } else if (readable) {
    userMessage = readable;
  }

  res.status(status).json({ error: userMessage });
}

// Schemas for the 4 sequential layers
const layer1Schema = {
  type: Type.OBJECT,
  properties: {
    theories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          theory: {
            type: Type.STRING,
            enum: ["utilitarian", "deontological", "virtue_care"],
          },
          verdict: {
            type: Type.STRING,
            enum: ["acceptable", "acceptable_with_conditions", "problematic", "unacceptable"],
          },
          score: {
            type: Type.NUMBER,
            description: "0-100 risk score (higher = riskier)",
          },
          confidence: {
            type: Type.NUMBER,
            description: "0-1 confidence score based on completeness of case facts",
          },
          summary: { type: Type.STRING },
          keyFindings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          stakeholders: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
                harms: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["name", "benefits", "harms"],
            },
          },
          rightsAtStake: { type: Type.ARRAY, items: { type: Type.STRING } },
          violatedConstraints: { type: Type.ARRAY, items: { type: Type.STRING } },
          flourishingImpacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["theory", "verdict", "score", "confidence", "summary", "keyFindings"],
      },
    },
  },
  required: ["theories"],
};

const layer2Schema = {
  type: Type.OBJECT,
  properties: {
    nistRmf: {
      type: Type.OBJECT,
      properties: {
        govern: { type: Type.NUMBER, description: "0-100 risk score for Govern function" },
        map: { type: Type.NUMBER, description: "0-100 risk score for Map function" },
        measure: { type: Type.NUMBER, description: "0-100 risk score for Measure function" },
        manage: { type: Type.NUMBER, description: "0-100 risk score for Manage function" },
        gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        rationale: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
      },
      required: ["govern", "map", "measure", "manage", "gaps", "rationale", "confidence"],
    },
    ieee7000: {
      type: Type.OBJECT,
      properties: {
        valuesElicited: { type: Type.ARRAY, items: { type: Type.STRING } },
        ethicalValueRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        traceabilityGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        confidence: { type: Type.NUMBER },
      },
      required: ["valuesElicited", "ethicalValueRequirements", "traceabilityGaps", "confidence"],
    },
  },
  required: ["nistRmf", "ieee7000"],
};

const layer3Schema = {
  type: Type.OBJECT,
  properties: {
    euAiAct: {
      type: Type.OBJECT,
      properties: {
        riskTier: {
          type: Type.STRING,
          enum: ["unacceptable", "high", "limited", "minimal"],
        },
        reasoning: { type: Type.STRING },
        obligations: { type: Type.ARRAY, items: { type: Type.STRING } },
        confidence: { type: Type.NUMBER },
      },
      required: ["riskTier", "reasoning", "obligations", "confidence"],
    },
    altai: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          requirement: { type: Type.STRING },
          score: { type: Type.NUMBER, description: "0-100 risk score" },
          note: { type: Type.STRING },
        },
        required: ["requirement", "score", "note"],
      },
    },
    unesco: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          principle: { type: Type.STRING },
          alignment: { type: Type.STRING, enum: ["aligned", "partial", "misaligned"] },
          note: { type: Type.STRING },
        },
        required: ["principle", "alignment", "note"],
      },
    },
    oecd: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          principle: { type: Type.STRING },
          alignment: { type: Type.STRING, enum: ["aligned", "partial", "misaligned"] },
          note: { type: Type.STRING },
        },
        required: ["principle", "alignment", "note"],
      },
    },
  },
  required: ["euAiAct", "altai", "unesco", "oecd"],
};

const layer4Schema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING },
    overallRiskScore: { type: Type.NUMBER, description: "0-100 overall risk score" },
    overallRiskLevel: {
      type: Type.STRING,
      enum: ["low", "moderate", "high", "critical"],
    },
    humanReviewRecommended: { type: Type.BOOLEAN },
    axisScores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          axis: {
            type: Type.STRING,
            enum: ["fairness", "privacy", "transparency", "safety", "human_agency"],
          },
          score: { type: Type.NUMBER },
          level: { type: Type.STRING, enum: ["low", "moderate", "high", "critical"] },
          rationale: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          drivers: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["axis", "score", "level", "rationale", "confidence", "drivers"],
      },
    },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          axis: {
            type: Type.STRING,
            enum: ["fairness", "privacy", "transparency", "safety", "human_agency"],
          },
          likelihood: { type: Type.INTEGER, description: "1 to 5" },
          severity: { type: Type.INTEGER, description: "1 to 5" },
          description: { type: Type.STRING },
          affected: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["id", "title", "axis", "likelihood", "severity", "description", "affected"],
      },
    },
    tradeOffs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          a: { type: Type.STRING },
          b: { type: Type.STRING },
          tensionSeverity: { type: Type.STRING, enum: ["low", "moderate", "high", "critical"] },
          description: { type: Type.STRING },
          whoBearsCost: { type: Type.STRING },
          recommendedBalance: { type: Type.STRING },
        },
        required: [
          "id",
          "a",
          "b",
          "tensionSeverity",
          "description",
          "whoBearsCost",
          "recommendedBalance",
        ],
      },
    },
    roadmap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ["P0", "P1", "P2"] },
          title: { type: Type.STRING },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          ownerRole: { type: Type.STRING },
          effort: { type: Type.STRING, enum: ["S", "M", "L"] },
          expectedRiskReduction: { type: Type.NUMBER },
          linkedRiskIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          frameworkRefs: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "id",
          "priority",
          "title",
          "steps",
          "ownerRole",
          "effort",
          "expectedRiskReduction",
          "linkedRiskIds",
          "frameworkRefs",
        ],
      },
    },
    assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "executiveSummary",
    "overallRiskScore",
    "overallRiskLevel",
    "humanReviewRecommended",
    "axisScores",
    "risks",
    "tradeOffs",
    "roadmap",
    "assumptions",
    "limitations",
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, model: MODEL_CANDIDATES[0] });
  });

  app.post("/api/analyze/layer1", async (req: Request, res: Response) => {
    try {
      const caseData = validateCasePayload(req.body);
      if (!caseData) {
        res.status(400).json({ error: "Invalid case payload: title and description are required." });
        return;
      }

      const prompt = `Evaluate this AI deployment scenario under Layer 1 (Normative Ethical Theories).
Return exactly 3 entries in "theories": one for "utilitarian", one for "deontological", and one for "virtue_care".
- For "utilitarian": populate stakeholders (name, benefits, harms), magnitude, probability, and distribution in summary/keyFindings.
- For "deontological": populate rightsAtStake and violatedConstraints (duties, consent, dignity, non-instrumentalization).
- For "virtue_care": populate flourishingImpacts (human flourishing, relational/power-asymmetry impacts, vulnerable groups).

CASE DATA:
${formatCaseForPrompt(caseData)}`;

      const result = await generateStructuredWithRetry<{ theories: unknown[] }>(
        prompt,
        "Layer 1: Normative Ethical Theories (Consequentialism/Utilitarianism, Deontology, Virtue/Care Ethics).",
        layer1Schema
      );

      res.json({ data: result.data, modelVersion: result.modelVersion });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post("/api/analyze/layer2", async (req: Request, res: Response) => {
    try {
      const caseData = validateCasePayload(req.body);
      if (!caseData) {
        res.status(400).json({ error: "Invalid case payload: title and description are required." });
        return;
      }
      const layer1 = (req.body as Record<string, unknown>).layer1 ?? {};

      const prompt = `Evaluate this AI deployment scenario under Layer 2 (Operational Standards: NIST AI RMF 1.0 and IEEE 7000-2021).
- For NIST AI RMF 1.0: score each function (govern, map, measure, manage) on a 0-100 RISK scale (higher = greater operational risk/gap) and list specific operational gaps.
- For IEEE 7000-2021: identify core valuesElicited from stakeholders, concrete ethicalValueRequirements, and traceabilityGaps between values and system safeguards.

CASE DATA:
${formatCaseForPrompt(caseData)}

PRIOR LAYER 1 CONTEXT:
${JSON.stringify(layer1)}`;

      const result = await generateStructuredWithRetry<Record<string, unknown>>(
        prompt,
        "Layer 2: Operational Standards (NIST AI RMF 1.0 & IEEE 7000-2021).",
        layer2Schema
      );

      res.json({ data: result.data, modelVersion: result.modelVersion });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post("/api/analyze/layer3", async (req: Request, res: Response) => {
    try {
      const caseData = validateCasePayload(req.body);
      if (!caseData) {
        res.status(400).json({ error: "Invalid case payload: title and description are required." });
        return;
      }
      const { layer1, layer2 } = req.body as Record<string, unknown>;

      const prompt = `Evaluate this AI deployment scenario under Layer 3 (Global AI Governance Principles & Frameworks).
- EU AI Act: classify riskTier ("unacceptable", "high", "limited", or "minimal") with clear reasoning grounded in case domain/impact and list likely compliance obligations (flagging legal counsel review rather than giving legal advice).
- ALTAI (Assessment List for Trustworthy AI): evaluate all 7 requirements (Human Agency & Oversight; Technical Robustness & Safety; Privacy & Data Governance; Transparency; Diversity, Non-discrimination & Fairness; Societal & Environmental Well-being; Accountability) with a 0-100 RISK score and concise note each.
- UNESCO Recommendation on the Ethics of AI: evaluate 5 key principles with alignment ("aligned" | "partial" | "misaligned") and note.
- OECD AI Principles: evaluate 5 key principles with alignment ("aligned" | "partial" | "misaligned") and note.

CASE DATA:
${formatCaseForPrompt(caseData)}

PRIOR LAYERS CONTEXT:
${JSON.stringify({ layer1, layer2 })}`;

      const result = await generateStructuredWithRetry<Record<string, unknown>>(
        prompt,
        "Layer 3: Global Governance (EU AI Act, ALTAI 7 Requirements, UNESCO, OECD AI Principles).",
        layer3Schema
      );

      res.json({ data: result.data, modelVersion: result.modelVersion });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  app.post("/api/analyze/layer4", async (req: Request, res: Response) => {
    try {
      const caseData = validateCasePayload(req.body);
      if (!caseData) {
        res.status(400).json({ error: "Invalid case payload: title and description are required." });
        return;
      }
      const { layer1, layer2, layer3 } = req.body as Record<string, unknown>;

      const prompt = `Synthesize Layers 1–3 into the final Layer 4 Risk Assessment, Trade-off Analysis, and Mitigation Roadmap.
Requirements:
1. "axisScores": provide exactly 5 items covering all 5 axes ("fairness", "privacy", "transparency", "safety", "human_agency"). Each must include score (0-100 risk), level, rationale, confidence (0-1), and "drivers" citing specific case fields/facts that drove the score.
2. "risks": identify 6–9 concrete risks with short IDs ("R1", "R2", ...), axis, likelihood (1–5), severity (1–5), description, and affected groups.
3. "tradeOffs": identify 4–5 genuine value tensions (such as Accuracy vs Explainability, Privacy vs Utility, Fairness vs Accuracy, Autonomy vs Safety, Efficiency vs Human Oversight) with tensionSeverity, description, whoBearsCost, and recommendedBalance.
4. "roadmap": provide 6–8 prioritized mitigations ("P0" immediate, "P1" short-term, "P2" long-term) with concrete steps, ownerRole, effort ("S"|"M"|"L"), expectedRiskReduction (integer points 2–15), linkedRiskIds referencing the risk IDs ("R1", etc.), and frameworkRefs (e.g. "NIST AI RMF Measure", "EU AI Act", "IEEE 7000", "ALTAI").
5. Provide balanced "executiveSummary", explicit "assumptions", explicit "limitations", and "humanReviewRecommended".

CASE DATA:
${formatCaseForPrompt(caseData)}

LAYER 1–3 FINDINGS:
${JSON.stringify({ layer1, layer2, layer3 })}`;

      const result = await generateStructuredWithRetry<Record<string, unknown>>(
        prompt,
        "Layer 4: Synthesis (5-Axis Risk Matrix, Ethical Trade-Offs, Prioritized Mitigation Roadmap, Overall Verdict).",
        layer4Schema
      );

      res.json({ data: result.data, modelVersion: result.modelVersion });
    } catch (err) {
      sendApiError(res, err);
    }
  });

  // Never let unknown /api/* calls fall through to SPA HTML (which returns 200)
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API route not found." });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Ethics Case Analyzer server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
