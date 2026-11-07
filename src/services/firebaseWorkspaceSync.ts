import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  db,
  auth,
  OperationType,
  handleFirestoreError,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth,
  saveLernstudioSetToFirestore,
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN,
  signInTeacherWithEmailPassword,
  signInWithGoogleIdToken,
  emailToWorkspaceId,
  getActiveCloudUser,
  isFirestoreWriteQuotaExhaustedToday,
  clearFirestoreWriteQuotaFlag,
  executeSafeFirestoreWrite
} from '../shared/firebaseCloudSync';

export {
  signInTeacherWithGoogle,
  signInTeacherWithEmailPassword,
  signInWithGoogleIdToken,
  signOutTeacherFirebase,
  subscribeTeacherAuth,
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN,
  emailToWorkspaceId,
  getActiveCloudUser,
  isFirestoreWriteQuotaExhaustedToday,
  clearFirestoreWriteQuotaFlag
};

export function getPrimaryWorkspaceId(user: { uid: string; email?: string | null }): string {
  if (!user || !user.uid) {
    throw new Error('Authenticated user with valid UID is required to resolve workspace.');
  }
  if (user.email) {
    return emailToWorkspaceId(user.email);
  }
  return user.uid;
}

/**
 * Verifies that the active user is genuinely authenticated via Firebase Auth
 * and owns the workspace document being accessed.
 */
export function verifyWorkspaceOwnership(
  user: User | null,
  docData?: { ownerUid?: string; ownerEmail?: string } | null,
  workspaceId?: string
): boolean {
  const current = auth.currentUser;
  if (!user || !current || user.uid !== current.uid) {
    return false;
  }

  const allowedWorkspaceIds = new Set<string>([current.uid]);
  if (current.email) {
    try {
      allowedWorkspaceIds.add(emailToWorkspaceId(current.email));
    } catch {
      // Ignore invalid email format
    }
  }

  if (workspaceId && !allowedWorkspaceIds.has(workspaceId)) {
    return false;
  }

  if (docData) {
    if (docData.ownerUid && docData.ownerUid !== current.uid) {
      // Allow only if the verified email matches
      const docEmail = (docData.ownerEmail || '').trim().toLowerCase();
      const userEmail = (current.email || '').trim().toLowerCase();
      if (!docEmail || !userEmail || docEmail !== userEmail) {
        return false;
      }
    }
    if (docData.ownerEmail && current.email) {
      const docEmail = docData.ownerEmail.trim().toLowerCase();
      const userEmail = current.email.trim().toLowerCase();
      if (docEmail !== userEmail) {
        return false;
      }
    }
  }

  return true;
}

const AUTO_SYNC_KEY = 'gluck_google_auto_sync_enabled';
const LAST_SYNC_TIME_KEY = 'gluck_google_last_sync_time';
const DEVICE_ID_KEY = 'gluck_cloud_device_id';
const CHUNK_MAX_CHARS = 550000; // Safe margin below 750KB rule & 1MB Firestore limit

export type WorkspaceCategoryKey =
  | 'core_crm'
  | 'finance_gold'
  | 'school_hod'
  | 'profile_settings'
  | 'lernstudio_data';

export const WORKSPACE_CATEGORY_KEYS: WorkspaceCategoryKey[] = [
  'core_crm',
  'finance_gold',
  'school_hod',
  'profile_settings',
  'lernstudio_data'
];

export interface CloudSyncSummary {
  studentsCount: number;
  groupsCount: number;
  lessonsCount: number;
  paymentsCount: number;
  financeTransactionsCount: number;
  lernstudioSetsCount: number;
  hodRecordsCount: number;
  updatedAtIso: string | null;
}

export function getCloudDeviceId(): string {
  if (typeof window === 'undefined') return 'server_node';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_fallback';
  }
}

export function isAutoCloudSyncEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(AUTO_SYNC_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setAutoCloudSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('gluck-cloud-sync-config-changed'));
  } catch {
    // Ignore
  }
}

export function getLastCloudSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_SYNC_TIME_KEY);
  } catch {
    return null;
  }
}

export function setLastCloudSyncTime(iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_SYNC_TIME_KEY, iso);
    window.dispatchEvent(new CustomEvent('gluck-cloud-sync-config-changed'));
  } catch {
    // Ignore
  }
}

let lastLocalPushTimestampMs = 0;

function splitStringIntoChunks(str: string, maxChars: number): string[] {
  if (!str || str.length <= maxChars) return [str || '{}'];
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += maxChars) {
    chunks.push(str.slice(i, i + maxChars));
  }
  return chunks;
}

function partitionBackupPayload(fullData: any): Record<WorkspaceCategoryKey, any> {
  return {
    core_crm: {
      groups: fullData.groups || [],
      students: fullData.students || [],
      lessons: fullData.lessons || [],
      payments: fullData.payments || [],
      certificates: fullData.certificates || [],
      notifications: fullData.notifications || [],
      prunedLessonIds: fullData.prunedLessonIds || []
    },
    finance_gold: {
      financeAccounts: fullData.financeAccounts || [],
      financeCategories: fullData.financeCategories || [],
      financeTransactions: fullData.financeTransactions || [],
      financeRecurring: fullData.financeRecurring || [],
      financeInstallments: fullData.financeInstallments || [],
      goldHoldings: fullData.goldHoldings || []
    },
    school_hod: {
      hodStudents: fullData.hodStudents || [],
      hodComplaints: fullData.hodComplaints || [],
      hodActionPlans: fullData.hodActionPlans || [],
      hodVisits: fullData.hodVisits || [],
      schoolNotes: fullData.schoolNotes || []
    },
    profile_settings: {
      profile: fullData.profile || {},
      schoolSettings: fullData.schoolSettings || fullData.profile?.schoolSettings || {},
      todos: fullData.todos || [],
      theme: fullData.theme || 'dark',
      accentColor: fullData.accentColor || '#6366f1',
      notificationSettings: fullData.notificationSettings || {},
      inspirationSettings: fullData.inspirationSettings || {},
      inspirationMessages: fullData.inspirationMessages || []
    },
    lernstudio_data: {
      lernstudioSets: fullData.lernstudioSets || [],
      homeworkAssignments: fullData.homeworkAssignments || [],
      homeworkSubmissions: fullData.homeworkSubmissions || [],
      pickerNames: fullData.pickerNames || []
    }
  };
}

const lastUploadedChunkCache = new Map<string, string>();
const lastUploadedChunkCount = new Map<string, number>();

/**
 * Uploads the entire application state (only modified categories & chunks) to the signed-in
 * teacher's Google Cloud Firestore workspace (`/user_workspaces/{uid}/categories/{docId}`).
 */
export async function uploadWorkspaceToGoogleCloud(
  backupJsonStr: string,
  options?: { isManual?: boolean }
): Promise<{ success: boolean; syncedAtIso: string; error?: string }> {
  const user = getActiveCloudUser();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!user || !verifyWorkspaceOwnership(user)) {
    return {
      success: false,
      syncedAtIso: nowIso,
      error: 'يرجى تسجيل الدخول بحساب Google الموثق أولاً لتفعيل المزامنة السحابية.'
    };
  }

  if (options?.isManual) {
    clearFirestoreWriteQuotaFlag();
  }

  if (isFirestoreWriteQuotaExhaustedToday()) {
    return {
      success: false,
      syncedAtIso: nowIso,
      error: 'تم إيقاف المزامنة التلقائية مؤقتاً لحماية حصة Firestore؛ اضغط «مزامنة الآن» لإعادة المحاولة.'
    };
  }

  const uid = getPrimaryWorkspaceId(user);
  const deviceId = getCloudDeviceId();
  lastLocalPushTimestampMs = nowMs;

  try {
    const parsed = JSON.parse(backupJsonStr);
    const categories = partitionBackupPayload(parsed);

    const writePromises: Promise<any>[] = [];

    for (const categoryKey of WORKSPACE_CATEGORY_KEYS) {
      const catPayloadStr = JSON.stringify(categories[categoryKey] || {});
      const chunks = splitStringIntoChunks(catPayloadStr, CHUNK_MAX_CHARS);
      const countKey = `${uid}:${categoryKey}`;
      const previousChunkCount = lastUploadedChunkCount.get(countKey) || 0;

      for (let idx = 0; idx < chunks.length; idx++) {
        const docId = `${categoryKey}_chunk_${idx}`;
        const cacheKey = `${uid}:${docId}:${chunks.length}`;
        if (lastUploadedChunkCache.get(cacheKey) === chunks[idx]) {
          continue; // Unchanged chunk -> 0 Firestore write units used!
        }
        const path = `user_workspaces/${uid}/categories/${docId}`;
        const chunkData = chunks[idx];
        writePromises.push(
          executeSafeFirestoreWrite(
            () =>
              setDoc(doc(db, 'user_workspaces', uid, 'categories', docId), {
                id: docId,
                categoryKey,
                chunkIndex: idx,
                totalChunks: chunks.length,
                updatedAtMs: nowMs,
                updatedAtIso: nowIso,
                deviceId,
                payloadChunk: chunkData,
                ...(user.email ? { ownerEmail: user.email.trim().toLowerCase().slice(0, 120) } : {})
              })
          )
            .then(() => {
              lastUploadedChunkCache.set(cacheKey, chunkData);
            })
            .catch((err) => {
              handleFirestoreError(err, OperationType.WRITE, path);
              throw err;
            })
        );
      }

      // Clean up stale higher-index chunks if category payload shrank compared to previous upload
      if (previousChunkCount > chunks.length) {
        for (let staleIdx = chunks.length; staleIdx < previousChunkCount; staleIdx++) {
          const staleDocId = `${categoryKey}_chunk_${staleIdx}`;
          writePromises.push(
            executeSafeFirestoreWrite(() =>
              deleteDoc(doc(db, 'user_workspaces', uid, 'categories', staleDocId))
            ).catch(() => {})
          );
        }
      }
      lastUploadedChunkCount.set(countKey, chunks.length);
    }

    if (writePromises.length > 0) {
      await Promise.all(writePromises);
    }

    setLastCloudSyncTime(nowIso);
    return { success: true, syncedAtIso: nowIso };
  } catch (err: any) {
    return {
      success: false,
      syncedAtIso: nowIso,
      error: err?.message || 'حدث خطأ أثناء رفع البيانات إلى سحابة جوجل.'
    };
  }
}

/**
 * Reassembles chunks for a category deterministically without relying on a 5-second clock window.
 */
function reassembleCategoryChunks(chunkDocs: any[]): any | null {
  if (!Array.isArray(chunkDocs) || chunkDocs.length === 0) return null;

  // Group by chunkIndex and keep the newest document per chunkIndex
  const newestByIndex = new Map<number, any>();
  let latestHeaderDoc: any = null;

  for (const docData of chunkDocs) {
    const idx = Number(docData.chunkIndex);
    if (!Number.isInteger(idx) || idx < 0) continue;
    const existing = newestByIndex.get(idx);
    if (!existing || (Number(docData.updatedAtMs) || 0) >= (Number(existing.updatedAtMs) || 0)) {
      newestByIndex.set(idx, docData);
    }
    if (
      !latestHeaderDoc ||
      (Number(docData.updatedAtMs) || 0) > (Number(latestHeaderDoc.updatedAtMs) || 0)
    ) {
      latestHeaderDoc = docData;
    }
  }

  const chunkZero = newestByIndex.get(0);
  const expectedTotalChunks = Math.max(
    1,
    Number(latestHeaderDoc?.totalChunks) || Number(chunkZero?.totalChunks) || 1
  );

  const orderedParts: string[] = [];
  for (let i = 0; i < expectedTotalChunks; i++) {
    const chunkDoc = newestByIndex.get(i);
    if (!chunkDoc || typeof chunkDoc.payloadChunk !== 'string') {
      // Missing chunk in sequence — abort reassembling this category to avoid partial JSON corruption
      return null;
    }
    orderedParts.push(chunkDoc.payloadChunk);
  }

  const joinedStr = orderedParts.join('');
  if (!joinedStr) return null;
  return JSON.parse(joinedStr);
}

/**
 * Downloads and reassembles the entire application workspace from Google Cloud Firestore
 * for the currently signed-in Google account.
 */
export async function downloadWorkspaceFromGoogleCloud(): Promise<{
  hasRemoteData: boolean;
  backupJsonStr: string | null;
  remoteTimestampMs: number;
  remoteTimestampIso: string | null;
  summary: CloudSyncSummary | null;
  error?: string;
}> {
  const user = getActiveCloudUser();
  if (!user || !verifyWorkspaceOwnership(user)) {
    return {
      hasRemoteData: false,
      backupJsonStr: null,
      remoteTimestampMs: 0,
      remoteTimestampIso: null,
      summary: null,
      error: 'يرجى تسجيل الدخول بحساب Google الموثق أولاً.'
    };
  }

  const primaryId = getPrimaryWorkspaceId(user);
  const path = `user_workspaces/${primaryId}/categories`;

  try {
    const candidateIds: string[] = [primaryId];
    if (user.uid && !candidateIds.includes(user.uid)) {
      candidateIds.push(user.uid);
    }

    let snap: any = null;
    let resolvedWorkspaceId = primaryId;
    for (const cId of candidateIds) {
      if (!verifyWorkspaceOwnership(user, null, cId)) continue;
      try {
        const s = await getDocs(collection(db, 'user_workspaces', cId, 'categories'));
        if (!s.empty) {
          snap = s;
          resolvedWorkspaceId = cId;
          break;
        }
      } catch {
        // try next candidate
      }
    }

    if (!snap || snap.empty) {
      return {
        hasRemoteData: false,
        backupJsonStr: null,
        remoteTimestampMs: 0,
        remoteTimestampIso: null,
        summary: null
      };
    }

    const docsByCategory = new Map<string, any[]>();
    let maxUpdatedAtMs = 0;
    let maxUpdatedAtIso: string | null = null;

    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      if (!data || !data.categoryKey) return;
      if (!verifyWorkspaceOwnership(user, data, resolvedWorkspaceId)) {
        return;
      }
      const list = docsByCategory.get(data.categoryKey) || [];
      list.push(data);
      docsByCategory.set(data.categoryKey, list);
      if (typeof data.updatedAtMs === 'number' && data.updatedAtMs > maxUpdatedAtMs) {
        maxUpdatedAtMs = data.updatedAtMs;
        maxUpdatedAtIso = data.updatedAtIso || new Date(data.updatedAtMs).toISOString();
      }
    });

    if (docsByCategory.size === 0) {
      return {
        hasRemoteData: false,
        backupJsonStr: null,
        remoteTimestampMs: 0,
        remoteTimestampIso: null,
        summary: null
      };
    }

    const reassembled: any = {
      timestamp: maxUpdatedAtIso || new Date().toISOString(),
      version: '2.0.0'
    };

    docsByCategory.forEach((chunkDocs, categoryKey) => {
      try {
        const parsedCat = reassembleCategoryChunks(chunkDocs);
        if (parsedCat && typeof parsedCat === 'object') {
          Object.assign(reassembled, parsedCat);
          // Seed chunk cache from downloaded cloud state so unchanged categories cost 0 writes on next sync
          const catStr = JSON.stringify(parsedCat);
          const chunks = splitStringIntoChunks(catStr, CHUNK_MAX_CHARS);
          lastUploadedChunkCount.set(`${primaryId}:${categoryKey}`, chunks.length);
          chunks.forEach((c, idx) => {
            lastUploadedChunkCache.set(`${primaryId}:${categoryKey}_chunk_${idx}:${chunks.length}`, c);
          });
        }
      } catch (parseErr) {
        console.warn('Failed to parse reassembled cloud category:', parseErr);
      }
    });

    const summary: CloudSyncSummary = {
      studentsCount: Array.isArray(reassembled.students) ? reassembled.students.length : 0,
      groupsCount: Array.isArray(reassembled.groups) ? reassembled.groups.length : 0,
      lessonsCount: Array.isArray(reassembled.lessons) ? reassembled.lessons.length : 0,
      paymentsCount: Array.isArray(reassembled.payments) ? reassembled.payments.length : 0,
      financeTransactionsCount: Array.isArray(reassembled.financeTransactions)
        ? reassembled.financeTransactions.length
        : 0,
      lernstudioSetsCount: Array.isArray(reassembled.lernstudioSets)
        ? reassembled.lernstudioSets.length
        : 0,
      hodRecordsCount:
        (Array.isArray(reassembled.hodStudents) ? reassembled.hodStudents.length : 0) +
        (Array.isArray(reassembled.hodComplaints) ? reassembled.hodComplaints.length : 0) +
        (Array.isArray(reassembled.schoolNotes) ? reassembled.schoolNotes.length : 0),
      updatedAtIso: maxUpdatedAtIso
    };

    return {
      hasRemoteData: true,
      backupJsonStr: JSON.stringify(reassembled),
      remoteTimestampMs: maxUpdatedAtMs,
      remoteTimestampIso: maxUpdatedAtIso,
      summary
    };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, path);
    return {
      hasRemoteData: false,
      backupJsonStr: null,
      remoteTimestampMs: 0,
      remoteTimestampIso: null,
      summary: null,
      error: err?.message || 'تعذر قراءة البيانات السحابية.'
    };
  }
}

/**
 * Subscribes in real time (`onSnapshot`) to the signed-in teacher's Google Cloud workspace.
 * Whenever another device uploads newer changes, triggers `onRemoteWorkspaceReady`.
 */
export function subscribeToRemoteWorkspaceChanges(
  uid: string,
  onRemoteWorkspaceReady: (backupJsonStr: string, updatedAtIso: string, summary: CloudSyncSummary) => void
): () => void {
  const activeUser = getActiveCloudUser();
  if (!activeUser || !verifyWorkspaceOwnership(activeUser)) {
    return () => {};
  }

  const targetWorkspaceId = getPrimaryWorkspaceId(activeUser);
  if (!verifyWorkspaceOwnership(activeUser, null, targetWorkspaceId)) {
    return () => {};
  }

  const deviceId = getCloudDeviceId();
  let debounceTimer: any = null;
  let lastAppliedRemoteMs = 0;

  const colRef = collection(db, 'user_workspaces', targetWorkspaceId, 'categories');
  const unsub = onSnapshot(
    colRef,
    (snap) => {
      if (snap.empty || !isAutoCloudSyncEnabled()) return;

      let newestRemoteMs = 0;
      let fromOtherDevice = false;

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (!verifyWorkspaceOwnership(activeUser, d, targetWorkspaceId)) return;
        if (d && typeof d.updatedAtMs === 'number') {
          if (d.updatedAtMs > newestRemoteMs) {
            newestRemoteMs = d.updatedAtMs;
          }
          if (d.deviceId && d.deviceId !== deviceId && d.updatedAtMs > lastLocalPushTimestampMs + 1500) {
            fromOtherDevice = true;
          }
        }
      });

      // Only pull automatically if the change came from another device or is newer than what we pushed/applied
      if (!fromOtherDevice || newestRemoteMs <= lastAppliedRemoteMs) {
        return;
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const res = await downloadWorkspaceFromGoogleCloud();
        if (res.hasRemoteData && res.backupJsonStr && res.remoteTimestampMs > lastAppliedRemoteMs) {
          lastAppliedRemoteMs = res.remoteTimestampMs;
          setLastCloudSyncTime(res.remoteTimestampIso || new Date().toISOString());
          if (res.summary) {
            onRemoteWorkspaceReady(
              res.backupJsonStr,
              res.remoteTimestampIso || new Date().toISOString(),
              res.summary
            );
          }
        }
      }, 1200);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `user_workspaces/${targetWorkspaceId}/categories`);
    }
  );

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsub();
  };
}

