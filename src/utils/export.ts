import { jsPDF } from "jspdf";
import {
  AnalysisReport,
  AUTOMATION_LABELS,
  AXIS_LABELS,
  Case,
  DOMAIN_LABELS,
  MODEL_TYPE_LABELS,
  REVERSIBILITY_LABELS,
  SCOPE_LABELS,
} from "../types";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "ethics-case"
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildMarkdownReport(
  caseData: Case,
  report: AnalysisReport,
  completedMitigationIds: string[] = []
): string {
  const lines: string[] = [];
  lines.push(`# AI Ethics Assessment Report: ${caseData.title}`);
  lines.push("");
  lines.push(
    `> **Notice:** AI-assisted analysis. It supports, and does not replace, human ethics review and legal counsel.`
  );
  lines.push("");
  lines.push(`- **Report ID:** \`${report.reportId}\``);
  lines.push(`- **Case ID:** \`${caseData.id}\``);
  lines.push(`- **Generated At:** ${new Date(report.generatedAt).toISOString()}`);
  lines.push(`- **Model Version:** \`${report.modelVersion}\``);
  lines.push(`- **Schema Version:** \`${report.schemaVersion}\``);
  lines.push(
    `- **Overall Risk Score:** **${report.overallRiskScore}/100** (${report.overallRiskLevel.toUpperCase()})`
  );
  lines.push(
    `- **Human Review Recommended:** ${report.humanReviewRecommended ? "Yes" : "No"}`
  );
  lines.push("");
  lines.push("## 1. Executive Summary");
  lines.push(report.executiveSummary);
  lines.push("");
  lines.push("## 2. Case Profile");
  lines.push(`- **Domain:** ${DOMAIN_LABELS[caseData.domain] || caseData.domain}`);
  lines.push(
    `- **Model Type:** ${MODEL_TYPE_LABELS[caseData.system.modelType] || caseData.system.modelType}`
  );
  lines.push(`- **Automation Level:** ${AUTOMATION_LABELS[caseData.system.automationLevel]}`);
  lines.push(`- **Impact Scope:** ${SCOPE_LABELS[caseData.impact.scope]}`);
  lines.push(`- **Reversibility:** ${REVERSIBILITY_LABELS[caseData.impact.reversibility]}`);
  lines.push(`- **Deployment Regions:** ${caseData.impact.regions.join(", ") || "Unspecified"}`);
  lines.push(`- **Scale Estimate:** ${caseData.impact.scaleEstimate || "Unspecified"}`);
  lines.push(`- **Affected Groups:** ${caseData.impact.affectedGroups.join(", ") || "Unspecified"}`);
  lines.push(`- **Data Sensitivity:** ${caseData.system.dataSensitivity.join(", ") || "None listed"}`);
  lines.push("");
  lines.push("**Scenario Description:**");
  lines.push(caseData.description);
  lines.push("");
  lines.push("## 3. Five-Axis Risk Scores");
  lines.push("| Axis | Risk Score | Level | Confidence | Rationale |");
  lines.push("| --- | ---: | --- | ---: | --- |");
  for (const ax of report.axisScores) {
    lines.push(
      `| ${AXIS_LABELS[ax.axis]} | ${ax.score}/100 | ${ax.level.toUpperCase()} | ${Math.round(ax.confidence * 100)}% | ${ax.rationale.replace(/\|/g, "\\|")} |`
    );
  }
  lines.push("");
  lines.push("## 4. Normative Ethical Theories");
  for (const t of report.theories) {
    const label =
      t.theory === "utilitarian"
        ? "Consequentialism / Utilitarianism"
        : t.theory === "deontological"
        ? "Deontology"
        : "Virtue & Care Ethics";
    lines.push(`### ${label} — ${t.verdict.replace(/_/g, " ").toUpperCase()} (${t.score}/100)`);
    lines.push(t.summary);
    if (t.keyFindings.length > 0) {
      lines.push("");
      lines.push("**Key Findings:**");
      t.keyFindings.forEach((f) => lines.push(`- ${f}`));
    }
    lines.push("");
  }

  lines.push("## 5. Standards & Governance Mapping");
  lines.push("### NIST AI RMF 1.0 (0–100 Risk Scale)");
  lines.push(
    `- Govern: ${report.standards.nistRmf.govern}/100 | Map: ${report.standards.nistRmf.map}/100 | Measure: ${report.standards.nistRmf.measure}/100 | Manage: ${report.standards.nistRmf.manage}/100`
  );
  report.standards.nistRmf.gaps.forEach((g) => lines.push(`- Gap: ${g}`));
  lines.push("");
  lines.push(`### EU AI Act Tier: ${report.standards.euAiAct.riskTier.toUpperCase()}`);
  lines.push(report.standards.euAiAct.reasoning);
  report.standards.euAiAct.obligations.forEach((o) => lines.push(`- Obligation: ${o}`));
  lines.push("");
  lines.push("### IEEE 7000-2021 Traceability");
  lines.push(`- **Values Elicited:** ${report.standards.ieee7000.valuesElicited.join("; ")}`);
  lines.push(
    `- **Ethical Value Requirements:** ${report.standards.ieee7000.ethicalValueRequirements.join("; ")}`
  );
  lines.push(
    `- **Traceability Gaps:** ${report.standards.ieee7000.traceabilityGaps.join("; ")}`
  );
  lines.push("");
  lines.push("### ALTAI 7 Requirements");
  report.standards.altai.forEach((a) =>
    lines.push(`- **${a.requirement}** (${a.score}/100 risk): ${a.note}`)
  );
  lines.push("");
  lines.push("### UNESCO Recommendation on the Ethics of AI");
  report.standards.unesco.forEach((u) =>
    lines.push(`- **${u.principle}** [${u.alignment.toUpperCase()}]: ${u.note}`)
  );
  lines.push("");
  lines.push("### OECD AI Principles");
  report.standards.oecd.forEach((o) =>
    lines.push(`- **${o.principle}** [${o.alignment.toUpperCase()}]: ${o.note}`)
  );
  lines.push("");

  lines.push("## 6. Identified Risks");
  for (const r of report.risks) {
    lines.push(
      `- **[${r.id}] ${r.title}** (${AXIS_LABELS[r.axis]}, L:${r.likelihood}/5 × S:${r.severity}/5): ${r.description}`
    );
  }
  lines.push("");

  lines.push("## 7. Ethical Trade-Offs");
  for (const tr of report.tradeOffs) {
    lines.push(`### ${tr.a} vs. ${tr.b} (Severity: ${tr.tensionSeverity.toUpperCase()})`);
    lines.push(`- **Tension:** ${tr.description}`);
    lines.push(`- **Who Bears Cost:** ${tr.whoBearsCost}`);
    lines.push(`- **Recommended Balance:** ${tr.recommendedBalance}`);
    lines.push("");
  }

  lines.push("## 8. Prioritized Mitigation Roadmap");
  for (const m of report.roadmap) {
    const done = completedMitigationIds.includes(m.id) ? "[x]" : "[ ]";
    lines.push(
      `### ${done} [${m.priority}] ${m.title} (Effort: ${m.effort} | Owner: ${m.ownerRole} | -${m.expectedRiskReduction} risk pts)`
    );
    m.steps.forEach((s) => lines.push(`- ${s}`));
    lines.push(`- *Linked Risks:* ${m.linkedRiskIds.join(", ") || "None"}`);
    lines.push(`- *Frameworks:* ${m.frameworkRefs.join(", ") || "None"}`);
    lines.push("");
  }

  lines.push("## 9. Assumptions & Limitations");
  lines.push("**Assumptions:**");
  report.assumptions.forEach((a) => lines.push(`- ${a}`));
  lines.push("");
  lines.push("**Limitations:**");
  report.limitations.forEach((l) => lines.push(`- ${l}`));
  lines.push("");

  return lines.join("\n");
}

export function exportMarkdown(
  caseData: Case,
  report: AnalysisReport,
  completedMitigationIds: string[] = []
): void {
  const md = buildMarkdownReport(caseData, report, completedMitigationIds);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${slugify(caseData.title)}-${report.reportId}.md`);
}

export function exportJsonAudit(
  caseData: Case,
  report: AnalysisReport,
  completedMitigationIds: string[] = []
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    disclaimer:
      "AI-assisted analysis. It supports, and does not replace, human ethics review and legal counsel.",
    case: caseData,
    report,
    mitigationProgress: {
      completedIds: completedMitigationIds,
      projectedRiskReduction: report.roadmap
        .filter((m) => completedMitigationIds.includes(m.id))
        .reduce((acc, m) => acc + m.expectedRiskReduction, 0),
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, `${slugify(caseData.title)}-${report.reportId}.json`);
}

export function exportPdfReport(
  caseData: Case,
  report: AnalysisReport,
  completedMitigationIds: string[] = []
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  };

  const addHeading = (text: string, size = 13) => {
    ensureSpace(28);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(15, 23, 42);
    doc.text(text, margin, y);
    y += 16;
  };

  const addWrapped = (text: string, size = 9.5, bold = false, color: [number, number, number] = [30, 41, 59]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13;
    }
  };

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(caseData.title, maxWidth) as string[];
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 20;
  }

  addWrapped(
    `Report ID: ${report.reportId}  |  Generated: ${new Date(report.generatedAt).toLocaleString()}  |  Model: ${report.modelVersion}  |  Schema: v${report.schemaVersion}`,
    8.5,
    false,
    [100, 116, 139]
  );
  y += 4;
  addWrapped(
    "Notice: AI-assisted analysis. It supports, and does not replace, human ethics review and legal counsel.",
    8.5,
    true,
    [180, 83, 9]
  );
  y += 6;

  addWrapped(
    `Overall Risk Score: ${report.overallRiskScore}/100 (${report.overallRiskLevel.toUpperCase()})  |  Human Review Recommended: ${report.humanReviewRecommended ? "Yes" : "No"}`,
    11,
    true,
    [15, 23, 42]
  );

  addHeading("1. Executive Summary");
  addWrapped(report.executiveSummary);

  addHeading("2. Case Overview");
  addWrapped(
    `Domain: ${DOMAIN_LABELS[caseData.domain] || caseData.domain} | Model: ${MODEL_TYPE_LABELS[caseData.system.modelType] || caseData.system.modelType} | Automation: ${AUTOMATION_LABELS[caseData.system.automationLevel]}`
  );
  addWrapped(
    `Scope: ${SCOPE_LABELS[caseData.impact.scope]} | Reversibility: ${REVERSIBILITY_LABELS[caseData.impact.reversibility]} | Scale: ${caseData.impact.scaleEstimate || "Unspecified"}`
  );
  addWrapped(caseData.description);

  addHeading("3. Five-Axis Risk Breakdown");
  for (const ax of report.axisScores) {
    addWrapped(
      `${AXIS_LABELS[ax.axis]} — ${ax.score}/100 (${ax.level.toUpperCase()}, confidence ${Math.round(ax.confidence * 100)}%)`,
      9.5,
      true
    );
    addWrapped(ax.rationale, 9);
    y += 3;
  }

  addHeading("4. Normative Ethical Theories");
  for (const t of report.theories) {
    const label =
      t.theory === "utilitarian"
        ? "Consequentialism / Utilitarianism"
        : t.theory === "deontological"
        ? "Deontology"
        : "Virtue & Care Ethics";
    addWrapped(
      `${label}: ${t.verdict.replace(/_/g, " ").toUpperCase()} (${t.score}/100 risk)`,
      9.5,
      true
    );
    addWrapped(t.summary, 9);
    y += 3;
  }

  addHeading("5. Standards & Governance Mapping");
  addWrapped(
    `NIST AI RMF 1.0 (Risk): Govern ${report.standards.nistRmf.govern}/100 | Map ${report.standards.nistRmf.map}/100 | Measure ${report.standards.nistRmf.measure}/100 | Manage ${report.standards.nistRmf.manage}/100`,
    9.5,
    true
  );
  addWrapped(
    `EU AI Act Risk Tier: ${report.standards.euAiAct.riskTier.toUpperCase()} — ${report.standards.euAiAct.reasoning}`,
    9
  );
  addWrapped(
    `IEEE 7000 Traceability Gaps: ${report.standards.ieee7000.traceabilityGaps.join("; ")}`,
    9
  );

  addHeading("6. Ethical Trade-Offs");
  for (const tr of report.tradeOffs) {
    addWrapped(
      `${tr.a} vs. ${tr.b} (${tr.tensionSeverity.toUpperCase()}) — Cost borne by: ${tr.whoBearsCost}`,
      9.5,
      true
    );
    addWrapped(`${tr.description} Recommended balance: ${tr.recommendedBalance}`, 9);
    y += 2;
  }

  addHeading("7. Mitigation Roadmap");
  for (const m of report.roadmap) {
    const status = completedMitigationIds.includes(m.id) ? "[DONE]" : "[OPEN]";
    addWrapped(
      `${status} [${m.priority}] ${m.title} (Owner: ${m.ownerRole}, Effort: ${m.effort}, Reduction: -${m.expectedRiskReduction} pts)`,
      9.5,
      true
    );
    addWrapped(`Steps: ${m.steps.join(" | ")}`, 9);
    y += 2;
  }

  addHeading("8. Assumptions & Limitations");
  addWrapped(`Assumptions: ${report.assumptions.join(" | ")}`, 9);
  addWrapped(`Limitations: ${report.limitations.join(" | ")}`, 9);

  doc.save(`${slugify(caseData.title)}-${report.reportId}.pdf`);
}
