import { Case } from "../types";

export const SAMPLE_CASES: Case[] = [
  {
    id: "sample-resume-screener",
    title: "Automated Enterprise Resume Screening & Candidate Ranking",
    description:
      "An enterprise recruitment platform deploys an automated screening model that parses applicant CVs, extracts skill embeddings, predicts 12-month job performance, and ranks candidates for hiring managers. Candidates scoring below the 40th percentile are automatically rejected prior to human review during high-volume hiring cycles.",
    domain: "hiring_hr",
    system: {
      modelType: "llm_generative",
      automationLevel: "fully_automated",
      dataSources: [
        "Applicant PDF resumes and cover letters",
        "Historical HR performance ratings (2018–2024)",
        "LinkedIn public profile text",
        "University prestige & employment gap heuristics",
      ],
      dataSensitivity: ["personal"],
      trainingDataOrigin:
        "Fine-tuned on 140,000 historical job applications and internal manager promotion reviews from the company's North American engineering and sales divisions.",
      existingSafeguards:
        "Explicit gender, race, and age fields are stripped before inference. Quarterly aggregate pass-through rate checks exist, though proxy features such as zip code, university names, and career-gap durations remain in the text embeddings.",
    },
    impact: {
      affectedGroups: [
        "External job applicants",
        "Career returners & caregivers",
        "Underrepresented minorities in tech",
        "Non-traditional / bootcamp graduates",
      ],
      scope: "group",
      reversibility: "partially",
      regions: ["United States", "European Union", "United Kingdom"],
      scaleEstimate: "120,000+ applicants screened annually across 450 open roles",
    },
    createdAt: "2026-11-10T09:30:00.000Z",
    updatedAt: "2026-11-10T09:30:00.000Z",
  },
  {
    id: "sample-hospital-triage",
    title: "Emergency Department Sepsis & Acuity Triage Prioritization",
    description:
      "A regional hospital network integrates a gradient-boosted clinical decision support model into its Emergency Department intake workflow. It ingests triage vitals, nursing intake notes, and prior EHR utilization to output an acuity priority score (1–5) and recommend ICU bed reservation or fast-track discharge.",
    domain: "healthcare",
    system: {
      modelType: "classifier",
      automationLevel: "human_in_loop",
      dataSources: [
        "Real-time vital signs (BP, SpO2, heart rate, temperature)",
        "Electronic Health Records (EHR) & prior billing codes",
        "Unstructured triage nurse notes",
        "Lab blood panel results",
      ],
      dataSensitivity: ["personal", "health"],
      trainingDataOrigin:
        "Trained on 5 years of retrospective EHR encounters from 4 urban tertiary hospitals, using historical ICU admission and healthcare expenditure as target proxies for illness severity.",
      existingSafeguards:
        "Attending physicians must confirm bed assignments and can override scores. Model calibration is checked annually on aggregate mortality, but subgroup calibration by race, language proficiency, and uninsured status has not been audited.",
    },
    impact: {
      affectedGroups: [
        "Emergency department patients",
        "Uninsured & underinsured patients",
        "Non-native English speaking patients",
        "Elderly & multi-morbid patients",
      ],
      scope: "individual",
      reversibility: "irreversible",
      regions: ["United States"],
      scaleEstimate: "280,000 ED visits per year across 12 regional clinics",
    },
    createdAt: "2026-11-14T14:15:00.000Z",
    updatedAt: "2026-11-14T14:15:00.000Z",
  },
  {
    id: "sample-predictive-policing",
    title: "Spatiotemporal Predictive Policing & Patrol Dispatch System",
    description:
      "A municipal police department proposes deploying a place-based and hotspot forecasting model that predicts daily street-crime risk across 250m x 250m city grid cells. Outputs directly adjust morning shift patrol routing, stop-and-frisk saturation zones, and mobile license plate reader deployments.",
    domain: "law_enforcement",
    system: {
      modelType: "classifier",
      automationLevel: "human_on_loop",
      dataSources: [
        "Historical arrest & stop-and-frisk logs (10 years)",
        "911 & 311 calls for service",
        "Municipal transit & commercial density data",
        "Automated license plate reader (ALPR) hits",
      ],
      dataSensitivity: ["personal", "public"],
      trainingDataOrigin:
        "Trained on 10 years of municipal police arrest and citation records rather than victimization surveys, reflecting historical enforcement patterns across neighborhoods.",
      existingSafeguards:
        "Commanders review morning hotspot maps before shift briefings; individual suspect scoring is disabled. No independent civilian oversight board or feedback-loop dampening mechanism is currently implemented.",
    },
    impact: {
      affectedGroups: [
        "Residents of historically over-policed neighborhoods",
        "Racial and ethnic minorities",
        "Unhoused individuals",
        "Municipal commuters & motorists",
      ],
      scope: "societal",
      reversibility: "irreversible",
      regions: ["United States", "Canada"],
      scaleEstimate: "1.4 million municipal residents under active patrol coverage",
    },
    createdAt: "2026-11-18T11:00:00.000Z",
    updatedAt: "2026-11-18T11:00:00.000Z",
  },
];
