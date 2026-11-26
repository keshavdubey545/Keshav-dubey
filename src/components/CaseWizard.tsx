import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Play, Plus, Trash2, X } from "lucide-react";
import { SAMPLE_CASES } from "../data/sampleCases";
import {
  AUTOMATION_LABELS,
  AutomationLevel,
  Case,
  DOMAIN_LABELS,
  ImpactScope,
  MODEL_TYPE_LABELS,
  REVERSIBILITY_LABELS,
  Reversibility,
  SCOPE_LABELS,
  SENSITIVITY_OPTIONS,
} from "../types";
import { clearDraft, createEmptyCase, loadDraft, saveDraft } from "../utils/storage";

interface CaseWizardProps {
  initialCase?: Case | null;
  cloudDraft?: { step: number; caseData: Case } | null;
  onDraftChange?: (step: number, caseData: Case) => void;
  onDraftClear?: () => void;
  onSubmit: (caseData: Case) => void;
  onCancel: () => void;
}

const STEPS = [
  { num: 1, label: "Basics" },
  { num: 2, label: "System" },
  { num: 3, label: "Impact" },
  { num: 4, label: "Review & Submit" },
];

interface StringListInputProps {
  id: string;
  label: string;
  placeholder: string;
  values: string[];
  suggestions?: string[];
  onChange: (next: string[]) => void;
}

function StringListInput({
  id,
  label,
  placeholder,
  values,
  suggestions,
  onChange,
}: StringListInputProps) {
  const [draftItem, setDraftItem] = useState("");

  const addItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraftItem("");
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-800 dark:text-slate-200"
      >
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draftItem}
          onChange={(e) => setDraftItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem(draftItem);
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <button
          type="button"
          onClick={() => addItem(draftItem)}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suggestions
            .filter((s) => !values.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addItem(s)}
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                + {s}
              </button>
            ))}
        </div>
      )}

      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {values.map((val) => (
            <li
              key={val}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <span>{val}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== val))}
                aria-label={`Remove ${val}`}
                className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CaseWizard({
  initialCase,
  cloudDraft,
  onDraftChange,
  onDraftClear,
  onSubmit,
  onCancel,
}: CaseWizardProps) {
  const [step, setStep] = useState<number>(() => {
    if (initialCase) return 1;
    if (cloudDraft?.step) return Math.min(4, Math.max(1, cloudDraft.step));
    const draft = loadDraft();
    return draft?.step ? Math.min(4, Math.max(1, draft.step)) : 1;
  });

  const [caseData, setCaseData] = useState<Case>(() => {
    if (initialCase) return structuredClone(initialCase);
    if (cloudDraft?.caseData) return structuredClone(cloudDraft.caseData);
    const draft = loadDraft();
    return draft?.caseData || createEmptyCase();
  });

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Autosave draft locally and to Firestore when authenticated
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(step, caseData);
      onDraftChange?.(step, caseData);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 600);
    return () => clearTimeout(timer);
  }, [step, caseData, onDraftChange]);

  const handleLoadSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    const found = SAMPLE_CASES.find((s) => s.id === sampleId);
    if (!found) return;
    const now = new Date().toISOString();
    setCaseData({
      ...structuredClone(found),
      id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    });
    setValidationError(null);
  };

  const handleClearDraft = () => {
    clearDraft();
    onDraftClear?.();
    setCaseData(createEmptyCase());
    setStep(1);
    setSelectedSampleId("");
    setValidationError(null);
  };

  const validateStep = (targetStep: number): boolean => {
    if (targetStep > 1) {
      if (!caseData.title.trim()) {
        setValidationError("Please enter a concise case title before proceeding.");
        return false;
      }
      if (caseData.description.trim().length < 20) {
        setValidationError(
          "Please provide a short scenario description (at least 20 characters) so the evaluation has sufficient context."
        );
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const goToStep = (next: number) => {
    if (next > step && !validateStep(next)) return;
    setStep(next);
  };

  const handleSubmit = () => {
    if (!validateStep(4)) {
      setStep(1);
      return;
    }
    clearDraft();
    onDraftClear?.();
    onSubmit({ ...caseData, updatedAt: new Date().toISOString() });
  };

  const toggleSensitivity = (id: string) => {
    const exists = caseData.system.dataSensitivity.includes(id);
    const next = exists
      ? caseData.system.dataSensitivity.filter((s) => s !== id)
      : [...caseData.system.dataSensitivity, id];
    setCaseData({
      ...caseData,
      system: { ...caseData.system, dataSensitivity: next },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Wizard Header + Sample Loader */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {initialCase ? "Edit & Re-Evaluate Case" : "New AI Ethics Case Submission"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lastSavedTime ? `Draft autosaved at ${lastSavedTime}` : "Draft autosave active"} · Do
            not enter real personal data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sample-loader-top" className="sr-only">
            Load sample case
          </label>
          <select
            id="sample-loader-top"
            value={selectedSampleId}
            onChange={(e) => handleLoadSample(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">Load sample case...</option>
            {SAMPLE_CASES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleClearDraft}
            title="Reset form fields"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Multi-step Progress Bar */}
      <nav aria-label="Case submission steps" className="space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isCurrent = step === s.num;
            const isCompleted = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => goToStep(s.num)}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  isCurrent
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-slate-100"
                    : isCompleted
                    ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-200"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-500 dark:text-slate-400"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-semibold shrink-0 ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.num}
                </span>
                <span className="text-xs font-semibold truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {validationError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-200"
        >
          {validationError}
        </div>
      )}

      {/* Step Content Container */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Step 1: Deployment Basics
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Describe the AI system, its operational objective, and its primary sector.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="case-title"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Case Title <span className="text-red-600">*</span>
              </label>
              <input
                id="case-title"
                type="text"
                value={caseData.title}
                onChange={(e) => setCaseData({ ...caseData, title: e.target.value })}
                placeholder="e.g., Automated Enterprise Resume Screening Engine"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="case-domain"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Deployment Domain
              </label>
              <select
                id="case-domain"
                value={caseData.domain}
                onChange={(e) => setCaseData({ ...caseData, domain: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="case-description"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Scenario Description <span className="text-red-600">*</span>
              </label>
              <textarea
                id="case-description"
                rows={5}
                value={caseData.description}
                onChange={(e) => setCaseData({ ...caseData, description: e.target.value })}
                placeholder="Explain how the model is used in practice, what decisions or recommendations it drives, and how outcomes affect people. Do not include personal names or confidential client records."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Step 2: System Architecture &amp; Data
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Specify the technical architecture, human oversight level, data provenance, and
                existing safeguards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="model-type"
                  className="block text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  Model Type
                </label>
                <select
                  id="model-type"
                  value={caseData.system.modelType}
                  onChange={(e) =>
                    setCaseData({
                      ...caseData,
                      system: { ...caseData.system, modelType: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {Object.entries(MODEL_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="automation-level"
                  className="block text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  Level of Automation
                </label>
                <select
                  id="automation-level"
                  value={caseData.system.automationLevel}
                  onChange={(e) =>
                    setCaseData({
                      ...caseData,
                      system: {
                        ...caseData.system,
                        automationLevel: e.target.value as AutomationLevel,
                      },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {Object.entries(AUTOMATION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Data Sensitivity Categories
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {SENSITIVITY_OPTIONS.map((opt) => {
                  const checked = caseData.system.dataSensitivity.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer text-sm transition-colors ${
                        checked
                          ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-slate-100"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSensitivity(opt.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <StringListInput
              id="data-sources-input"
              label="Input Data Sources"
              placeholder="Add a data source (press Enter)..."
              values={caseData.system.dataSources}
              suggestions={[
                "Electronic Health Records",
                "Applicant resumes",
                "Transaction logs",
                "Public social profiles",
                "CCTV / video feeds",
              ]}
              onChange={(next) =>
                setCaseData({ ...caseData, system: { ...caseData.system, dataSources: next } })
              }
            />

            <div className="space-y-2">
              <label
                htmlFor="training-origin"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Training Data Origin &amp; Provenance
              </label>
              <textarea
                id="training-origin"
                rows={3}
                value={caseData.system.trainingDataOrigin}
                onChange={(e) =>
                  setCaseData({
                    ...caseData,
                    system: { ...caseData.system, trainingDataOrigin: e.target.value },
                  })
                }
                placeholder="Describe dataset origins, collection timeframe, labeling practices, and known historical biases..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="existing-safeguards"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Existing Technical &amp; Organizational Safeguards
              </label>
              <textarea
                id="existing-safeguards"
                rows={3}
                value={caseData.system.existingSafeguards}
                onChange={(e) =>
                  setCaseData({
                    ...caseData,
                    system: { ...caseData.system, existingSafeguards: e.target.value },
                  })
                }
                placeholder="List current controls (e.g., human review gates, appeal mechanisms, subgroup audits, encryption, rate limits)..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Step 3: Affected Stakeholders &amp; Impact Scope
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Identify impacted communities, decision reversibility, jurisdictions, and deployment
                scale.
              </p>
            </div>

            <StringListInput
              id="affected-groups-input"
              label="User Demographics &amp; Affected Groups"
              placeholder="Add an affected group (press Enter)..."
              values={caseData.impact.affectedGroups}
              suggestions={[
                "Job applicants",
                "Patients",
                "Low-income households",
                "Minors / students",
                "Racial & ethnic minorities",
                "Non-native speakers",
              ]}
              onChange={(next) =>
                setCaseData({
                  ...caseData,
                  impact: { ...caseData.impact, affectedGroups: next },
                })
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="impact-scope"
                  className="block text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  Impact Scope
                </label>
                <select
                  id="impact-scope"
                  value={caseData.impact.scope}
                  onChange={(e) =>
                    setCaseData({
                      ...caseData,
                      impact: { ...caseData.impact, scope: e.target.value as ImpactScope },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="impact-reversibility"
                  className="block text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  Reversibility of Decisions
                </label>
                <select
                  id="impact-reversibility"
                  value={caseData.impact.reversibility}
                  onChange={(e) =>
                    setCaseData({
                      ...caseData,
                      impact: {
                        ...caseData.impact,
                        reversibility: e.target.value as Reversibility,
                      },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {Object.entries(REVERSIBILITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <StringListInput
              id="regions-input"
              label="Deployment Region(s)"
              placeholder="Add jurisdiction or region (press Enter)..."
              values={caseData.impact.regions}
              suggestions={["United States", "European Union", "United Kingdom", "Canada", "Global"]}
              onChange={(next) =>
                setCaseData({ ...caseData, impact: { ...caseData.impact, regions: next } })
              }
            />

            <div className="space-y-2">
              <label
                htmlFor="scale-estimate"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Estimated Scale (People Affected)
              </label>
              <input
                id="scale-estimate"
                type="text"
                value={caseData.impact.scaleEstimate}
                onChange={(e) =>
                  setCaseData({
                    ...caseData,
                    impact: { ...caseData.impact, scaleEstimate: e.target.value },
                  })
                }
                placeholder="e.g., 50,000 borrowers evaluated annually"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Step 4: Review &amp; Submit for Evaluation
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Verify scenario details or load a prefilled sample case before running the
                  4-layer analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="sample-loader-review" className="sr-only">
                  Load sample case in review
                </label>
                <select
                  id="sample-loader-review"
                  value={selectedSampleId}
                  onChange={(e) => handleLoadSample(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Load sample case...</option>
                  {SAMPLE_CASES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-5 divide-y divide-slate-200 dark:divide-slate-800">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    1. Case Basics
                  </h3>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
                  >
                    Edit Basics
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Title</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">
                      {caseData.title || "Untitled case"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Domain</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {DOMAIN_LABELS[caseData.domain] || caseData.domain}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Description</dt>
                    <dd className="text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5">
                      {caseData.description || "No description provided."}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    2. System &amp; Safeguards
                  </h3>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
                  >
                    Edit System
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Model Type</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {MODEL_TYPE_LABELS[caseData.system.modelType] || caseData.system.modelType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Automation</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {AUTOMATION_LABELS[caseData.system.automationLevel]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Sensitivity</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {caseData.system.dataSensitivity.join(", ") || "None specified"}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Data Sources</dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {caseData.system.dataSources.join(" · ") || "Not specified"}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">
                      Training Data Origin
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {caseData.system.trainingDataOrigin || "Not specified"}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">
                      Existing Safeguards
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {caseData.system.existingSafeguards || "Not specified"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    3. Impact &amp; Reach
                  </h3>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
                  >
                    Edit Impact
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Scope</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {SCOPE_LABELS[caseData.impact.scope]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Reversibility</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {REVERSIBILITY_LABELS[caseData.impact.reversibility]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Regions</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {caseData.impact.regions.join(", ") || "Not specified"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Affected Groups</dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {caseData.impact.affectedGroups.join(" · ") || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Scale</dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {caseData.impact.scaleEstimate || "Not specified"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={step === 1 ? onCancel : () => setStep(step - 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{step === 1 ? "Cancel" : "Previous"}</span>
            </button>
          </div>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => goToStep(step + 1)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-indigo-500 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Play className="w-4 h-4" />
              <span>Run 4-Layer Ethics Analysis</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
