import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { AnalysisReport, Case, CaseRecord, ReportVersion } from "../types";

export interface UserPreferences {
  theme: "light" | "dark";
  lastActiveCaseId: string | null;
  recentAction: string | null;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

function clipStr(value: string, max: number): string {
  return (value || "").slice(0, max);
}

function clipList(items: string[], maxItems: number, maxLen = 240): string[] {
  return (Array.isArray(items) ? items : [])
    .filter((v) => typeof v === "string" && v.trim().length > 0)
    .slice(0, maxItems)
    .map((v) => v.slice(0, maxLen));
}

function sanitizeCasePayload(caseData: Case): Case {
  return {
    id: sanitizeId(caseData.id),
    title: clipStr(caseData.title.trim() || "Untitled Case", 500),
    description: clipStr(caseData.description.trim() || "No description provided.", 10000),
    domain: clipStr(caseData.domain || "other", 64),
    system: {
      modelType: clipStr(caseData.system.modelType || "other", 64),
      automationLevel: caseData.system.automationLevel,
      dataSources: clipList(caseData.system.dataSources, 30),
      dataSensitivity: clipList(caseData.system.dataSensitivity, 15),
      trainingDataOrigin: clipStr(caseData.system.trainingDataOrigin || "", 4000),
      existingSafeguards: clipStr(caseData.system.existingSafeguards || "", 4000),
    },
    impact: {
      affectedGroups: clipList(caseData.impact.affectedGroups, 30),
      scope: caseData.impact.scope,
      reversibility: caseData.impact.reversibility,
      regions: clipList(caseData.impact.regions, 30),
      scaleEstimate: clipStr(caseData.impact.scaleEstimate || "", 500),
    },
    createdAt: caseData.createdAt || new Date().toISOString(),
    updatedAt: caseData.updatedAt || new Date().toISOString(),
  };
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === "string") return val;
  return new Date().toISOString();
}

// Firestore rejects `undefined` values inside nested maps
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export async function syncUserProfileOnLogin(
  user: User,
  fallbackTheme: "light" | "dark"
): Promise<UserPreferences> {
  const path = `users/${user.uid}`;
  const ref = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const payload = {
        ownerId: user.uid,
        displayName: clipStr(user.displayName || "Researcher", 120),
        email: clipStr(user.email || "", 254),
        theme: fallbackTheme,
        lastActiveCaseId: null,
        recentAction: "Signed in to AI Ethics Case Analyzer",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      return {
        theme: fallbackTheme,
        lastActiveCaseId: null,
        recentAction: payload.recentAction,
      };
    }

    const data = snap.data();
    await updateDoc(ref, {
      displayName: clipStr(user.displayName || String(data.displayName || "Researcher"), 120),
      email: clipStr(user.email || String(data.email || ""), 254),
      theme: data.theme === "dark" || data.theme === "light" ? data.theme : fallbackTheme,
      lastActiveCaseId: data.lastActiveCaseId ?? null,
      recentAction: data.recentAction ?? null,
      updatedAt: serverTimestamp(),
    });

    return {
      theme: data.theme === "dark" || data.theme === "light" ? data.theme : fallbackTheme,
      lastActiveCaseId: typeof data.lastActiveCaseId === "string" ? data.lastActiveCaseId : null,
      recentAction: typeof data.recentAction === "string" ? data.recentAction : null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserThemeInFirestore(
  uid: string,
  theme: "light" | "dark"
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, "users", uid), {
      theme,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function recordUserRecentAction(
  uid: string,
  lastActiveCaseId: string | null,
  recentAction: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, "users", uid), {
      lastActiveCaseId: lastActiveCaseId ? sanitizeId(lastActiveCaseId) : null,
      recentAction: clipStr(recentAction, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

async function fetchCaseVersions(uid: string, caseId: string): Promise<ReportVersion[]> {
  const versionsPath = `users/${uid}/cases/${caseId}/versions`;
  try {
    const q = query(collection(db, "users", uid, "cases", caseId, "versions"), where("ownerId", "==", uid));
    const snap = await getDocs(q);
    const list: ReportVersion[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d && typeof d.version === "number" && d.report) {
        list.push({
          version: d.version,
          report: d.report as AnalysisReport,
        });
      }
    });
    return list.sort((a, b) => a.version - b.version);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, versionsPath);
  }
}

export function subscribeUserCases(
  uid: string,
  onRecords: (records: CaseRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const casesPath = `users/${uid}/cases`;
  const q = query(collection(db, "users", uid, "cases"), where("ownerId", "==", uid));

  return onSnapshot(
    q,
    async (snapshot) => {
      try {
        const records = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const d = docSnap.data();
            const versions = await fetchCaseVersions(uid, docSnap.id);
            const caseData: Case = {
              id: String(d.id || docSnap.id),
              title: String(d.title || "Untitled Case"),
              description: String(d.description || ""),
              domain: String(d.domain || "other"),
              system: d.system as Case["system"],
              impact: d.impact as Case["impact"],
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
            const completedMitigationIds = Array.isArray(d.completedMitigationIds)
              ? d.completedMitigationIds.map(String)
              : [];

            return {
              caseData,
              versions,
              completedMitigationIds,
            } satisfies CaseRecord;
          })
        );

        records.sort(
          (a, b) =>
            new Date(b.caseData.updatedAt).getTime() - new Date(a.caseData.updatedAt).getTime()
        );
        onRecords(records);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, casesPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveCaseToFirestore(
  uid: string,
  rawCase: Case,
  newReport?: AnalysisReport,
  completedMitigationIds: string[] = []
): Promise<Case> {
  const sanitized = sanitizeCasePayload(rawCase);
  const casePath = `users/${uid}/cases/${sanitized.id}`;
  const caseRef = doc(db, "users", uid, "cases", sanitized.id);

  try {
    const existingSnap = await getDoc(caseRef);
    const batch = writeBatch(db);

    if (!existingSnap.exists()) {
      const nextVersion = newReport ? 1 : 0;
      batch.set(caseRef, {
        ownerId: uid,
        id: sanitized.id,
        title: sanitized.title,
        description: sanitized.description,
        domain: sanitized.domain,
        system: stripUndefined(sanitized.system),
        impact: stripUndefined(sanitized.impact),
        completedMitigationIds: clipList(completedMitigationIds, 50, 64),
        latestVersion: nextVersion,
        latestRiskScore: newReport ? newReport.overallRiskScore : null,
        latestRiskLevel: newReport ? newReport.overallRiskLevel : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (newReport) {
        const versionId = `v1`;
        const versionRef = doc(db, "users", uid, "cases", sanitized.id, "versions", versionId);
        const cleanReport: AnalysisReport = stripUndefined({
          ...newReport,
          caseId: sanitized.id,
        });
        batch.set(versionRef, {
          ownerId: uid,
          caseId: sanitized.id,
          version: 1,
          report: cleanReport,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      const existingData = existingSnap.data();
      const prevVersion =
        typeof existingData.latestVersion === "number" ? existingData.latestVersion : 0;
      const nextVersion = newReport ? prevVersion + 1 : prevVersion;

      batch.update(caseRef, {
        title: sanitized.title,
        description: sanitized.description,
        domain: sanitized.domain,
        system: stripUndefined(sanitized.system),
        impact: stripUndefined(sanitized.impact),
        latestVersion: nextVersion,
        latestRiskScore: newReport
          ? newReport.overallRiskScore
          : existingData.latestRiskScore ?? null,
        latestRiskLevel: newReport
          ? newReport.overallRiskLevel
          : existingData.latestRiskLevel ?? null,
        updatedAt: serverTimestamp(),
      });

      if (newReport) {
        const versionId = `v${nextVersion}`;
        const versionRef = doc(db, "users", uid, "cases", sanitized.id, "versions", versionId);
        const cleanReport: AnalysisReport = stripUndefined({
          ...newReport,
          caseId: sanitized.id,
        });
        batch.set(versionRef, {
          ownerId: uid,
          caseId: sanitized.id,
          version: nextVersion,
          report: cleanReport,
          createdAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
    return sanitized;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, casePath);
  }
}

export async function duplicateCaseInFirestore(
  uid: string,
  sourceRecord: CaseRecord
): Promise<Case> {
  const newId = sanitizeId(`case_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const duplicatedCase: Case = sanitizeCasePayload({
    ...structuredClone(sourceRecord.caseData),
    id: newId,
    title: `${sourceRecord.caseData.title} (Copy)`,
  });
  const casePath = `users/${uid}/cases/${newId}`;
  const caseRef = doc(db, "users", uid, "cases", newId);
  const latestReport = sourceRecord.versions[sourceRecord.versions.length - 1]?.report;

  try {
    const batch = writeBatch(db);
    batch.set(caseRef, {
      ownerId: uid,
      id: newId,
      title: duplicatedCase.title,
      description: duplicatedCase.description,
      domain: duplicatedCase.domain,
      system: stripUndefined(duplicatedCase.system),
      impact: stripUndefined(duplicatedCase.impact),
      completedMitigationIds: clipList(sourceRecord.completedMitigationIds, 50, 64),
      latestVersion: sourceRecord.versions.length,
      latestRiskScore: latestReport ? latestReport.overallRiskScore : null,
      latestRiskLevel: latestReport ? latestReport.overallRiskLevel : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const v of sourceRecord.versions) {
      const versionRef = doc(db, "users", uid, "cases", newId, "versions", `v${v.version}`);
      batch.set(versionRef, {
        ownerId: uid,
        caseId: newId,
        version: v.version,
        report: stripUndefined({ ...v.report, caseId: newId }),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return duplicatedCase;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, casePath);
  }
}

export async function toggleMitigationInFirestore(
  uid: string,
  caseId: string,
  currentCompletedIds: string[],
  mitigationId: string
): Promise<void> {
  const safeId = sanitizeId(caseId);
  const path = `users/${uid}/cases/${safeId}`;
  const exists = currentCompletedIds.includes(mitigationId);
  const nextIds = exists
    ? currentCompletedIds.filter((id) => id !== mitigationId)
    : [...currentCompletedIds, mitigationId];

  try {
    await updateDoc(doc(db, "users", uid, "cases", safeId), {
      completedMitigationIds: clipList(nextIds, 50, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCaseFromFirestore(uid: string, caseId: string): Promise<void> {
  const safeId = sanitizeId(caseId);
  const path = `users/${uid}/cases/${safeId}`;
  try {
    const q = query(
      collection(db, "users", uid, "cases", safeId, "versions"),
      where("ownerId", "==", uid)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((docSnap) => batch.delete(docSnap.ref));
    batch.delete(doc(db, "users", uid, "cases", safeId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveWizardDraftToFirestore(
  uid: string,
  step: number,
  caseData: Case
): Promise<void> {
  const path = `users/${uid}/drafts/wizard`;
  const ref = doc(db, "users", uid, "drafts", "wizard");
  const safeStep = Math.min(4, Math.max(1, Math.round(step)));
  const sanitizedDraft = {
    ...stripUndefined(caseData),
    title: clipStr(caseData.title || "", 500),
    description: clipStr(caseData.description || "", 10000),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        step: safeStep,
        caseData: sanitizedDraft,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        step: safeStep,
        caseData: sanitizedDraft,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadWizardDraftFromFirestore(
  uid: string
): Promise<{ step: number; caseData: Case } | null> {
  const path = `users/${uid}/drafts/wizard`;
  try {
    const snap = await getDoc(doc(db, "users", uid, "drafts", "wizard"));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      step: typeof d.step === "number" ? d.step : 1,
      caseData: d.caseData as Case,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function clearWizardDraftFromFirestore(uid: string): Promise<void> {
  const path = `users/${uid}/drafts/wizard`;
  try {
    await deleteDoc(doc(db, "users", uid, "drafts", "wizard"));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function migrateLocalCasesToFirestore(
  uid: string,
  localRecords: CaseRecord[]
): Promise<void> {
  if (localRecords.length === 0) return;
  const casesPath = `users/${uid}/cases`;
  try {
    const existingSnap = await getDocs(
      query(collection(db, "users", uid, "cases"), where("ownerId", "==", uid))
    );
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    for (const rec of localRecords) {
      const safeId = sanitizeId(rec.caseData.id);
      if (existingIds.has(safeId)) continue;
      // Only migrate custom cases or analyzed cases automatically; if Firestore is completely empty, seed all local records
      const shouldMigrate =
        existingIds.size === 0 ||
        rec.versions.length > 0 ||
        !rec.caseData.id.startsWith("sample-");
      if (!shouldMigrate) continue;

      const batch = writeBatch(db);
      const sanitized = sanitizeCasePayload(rec.caseData);
      const caseRef = doc(db, "users", uid, "cases", sanitized.id);
      const latestReport = rec.versions[rec.versions.length - 1]?.report;

      batch.set(caseRef, {
        ownerId: uid,
        id: sanitized.id,
        title: sanitized.title,
        description: sanitized.description,
        domain: sanitized.domain,
        system: stripUndefined(sanitized.system),
        impact: stripUndefined(sanitized.impact),
        completedMitigationIds: clipList(rec.completedMitigationIds, 50, 64),
        latestVersion: rec.versions.length,
        latestRiskScore: latestReport ? latestReport.overallRiskScore : null,
        latestRiskLevel: latestReport ? latestReport.overallRiskLevel : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const v of rec.versions) {
        const versionRef = doc(
          db,
          "users",
          uid,
          "cases",
          sanitized.id,
          "versions",
          `v${v.version}`
        );
        batch.set(versionRef, {
          ownerId: uid,
          caseId: sanitized.id,
          version: v.version,
          report: stripUndefined({ ...v.report, caseId: sanitized.id }),
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      existingIds.add(sanitized.id);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, casesPath);
  }
}
