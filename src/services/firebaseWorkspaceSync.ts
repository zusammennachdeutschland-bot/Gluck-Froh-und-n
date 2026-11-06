import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
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
  signInWithCloudEmailDirect,
  isFirestoreWriteQuotaExhaustedToday,
  executeSafeFirestoreWrite,
  VirtualCloudUser
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
  signInWithCloudEmailDirect,
  isFirestoreWriteQuotaExhaustedToday
};
export type { VirtualCloudUser };

export function getPrimaryWorkspaceId(user: { uid: string; email?: string | null }): string {
  if (user.email) {
    return emailToWorkspaceId(user.email);
  }
  return user.uid;
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
      notifications: fullData.notifications || []
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

/**
 * Uploads the entire application state (only modified categories & chunks) to the signed-in
 * teacher's Google Cloud Firestore workspace (`/user_workspaces/{uid}/categories/{docId}`).
 */
export async function uploadWorkspaceToGoogleCloud(
  backupJsonStr: string
): Promise<{ success: boolean; syncedAtIso: string; error?: string }> {
  const user = getActiveCloudUser();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!user) {
    return {
      success: false,
      syncedAtIso: nowIso,
      error: 'يرجى تسجيل الدخول بحساب Google أولاً لتفعيل المزامنة السحابية.'
    };
  }

  if (isFirestoreWriteQuotaExhaustedToday()) {
    return {
      success: false,
      syncedAtIso: nowIso,
      error: 'Quota exceeded. تم الوصول للحد اليومي المجاني لكتابة Firestore اليوم؛ بياناتك محفوظة محلياً بأمان وستُستأنف المزامنة غداً.'
    };
  }

  const uid = getPrimaryWorkspaceId(user);
  const deviceId = getCloudDeviceId();
  lastLocalPushTimestampMs = nowMs;

  try {
    const parsed = JSON.parse(backupJsonStr);
    const categories = partitionBackupPayload(parsed);

    const writePromises: Promise<any>[] = [];
    let lernstudioChanged = false;

    for (const categoryKey of WORKSPACE_CATEGORY_KEYS) {
      const catPayloadStr = JSON.stringify(categories[categoryKey] || {});
      const chunks = splitStringIntoChunks(catPayloadStr, CHUNK_MAX_CHARS);

      for (let idx = 0; idx < chunks.length; idx++) {
        const docId = `${categoryKey}_chunk_${idx}`;
        const cacheKey = `${uid}:${docId}:${chunks.length}`;
        if (lastUploadedChunkCache.get(cacheKey) === chunks[idx]) {
          continue; // Unchanged chunk -> 0 Firestore write units used!
        }
        if (categoryKey === 'lernstudio_data') {
          lernstudioChanged = true;
        }
        const path = `user_workspaces/${uid}/categories/${docId}`;
        const chunkData = chunks[idx];
        writePromises.push(
          executeSafeFirestoreWrite(
            setDoc(doc(db, 'user_workspaces', uid, 'categories', docId), {
              id: docId,
              categoryKey,
              chunkIndex: idx,
              totalChunks: chunks.length,
              updatedAtMs: nowMs,
              updatedAtIso: nowIso,
              deviceId,
              payloadChunk: chunkData,
              ...(user.email ? { ownerEmail: user.email.slice(0, 120) } : {})
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
    }

    if (writePromises.length > 0) {
      await Promise.all(writePromises);
    }

    // Only sync custom Lernstudio sets if lernstudio_data actually changed
    if (lernstudioChanged && Array.isArray(parsed.lernstudioSets) && !isFirestoreWriteQuotaExhaustedToday()) {
      const customSets = parsed.lernstudioSets.filter(
        (s: any) => s && s.id && !s.id.startsWith('curric_') && !s.id.startsWith('set_def_')
      );
      for (const cs of customSets.slice(0, 15)) {
        saveLernstudioSetToFirestore(cs).catch(() => {});
      }
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
  if (!user) {
    return {
      hasRemoteData: false,
      backupJsonStr: null,
      remoteTimestampMs: 0,
      remoteTimestampIso: null,
      summary: null,
      error: 'يرجى تسجيل الدخول بحساب Google أولاً.'
    };
  }

  const primaryId = getPrimaryWorkspaceId(user);
  const path = `user_workspaces/${primaryId}/categories`;

  try {
    const candidateIds: string[] = [];
    if (primaryId) candidateIds.push(primaryId);
    if (user.uid && !candidateIds.includes(user.uid)) candidateIds.push(user.uid);
    if (user.email) {
      const emailWs = emailToWorkspaceId(user.email);
      if (!candidateIds.includes(emailWs)) candidateIds.push(emailWs);
    }

    let snap: any = null;
    for (const cId of candidateIds) {
      try {
        const s = await getDocs(collection(db, 'user_workspaces', cId, 'categories'));
        if (!s.empty) {
          snap = s;
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

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data || !data.categoryKey) return;
      const list = docsByCategory.get(data.categoryKey) || [];
      list.push(data);
      docsByCategory.set(data.categoryKey, list);
      if (typeof data.updatedAtMs === 'number' && data.updatedAtMs > maxUpdatedAtMs) {
        maxUpdatedAtMs = data.updatedAtMs;
        maxUpdatedAtIso = data.updatedAtIso || new Date(data.updatedAtMs).toISOString();
      }
    });

    const reassembled: any = {
      timestamp: maxUpdatedAtIso || new Date().toISOString(),
      version: '2.0.0'
    };

    docsByCategory.forEach((chunkDocs) => {
      // Find latest updatedAtMs for this category so stale old chunks from a larger previous upload are ignored
      const latestCatMs = Math.max(...chunkDocs.map((c) => Number(c.updatedAtMs) || 0));
      const activeChunks = chunkDocs
        .filter((c) => Math.abs((Number(c.updatedAtMs) || 0) - latestCatMs) < 5000)
        .sort((a, b) => (Number(a.chunkIndex) || 0) - (Number(b.chunkIndex) || 0));

      const joinedStr = activeChunks.map((c) => c.payloadChunk || '').join('');
      if (joinedStr) {
        try {
          const parsedCat = JSON.parse(joinedStr);
          Object.assign(reassembled, parsedCat);
        } catch (parseErr) {
          console.warn('Failed to parse reassembled cloud category:', parseErr);
        }
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
  const deviceId = getCloudDeviceId();
  let debounceTimer: any = null;
  let lastAppliedRemoteMs = 0;
  const activeUser = getActiveCloudUser();
  const targetWorkspaceId = activeUser ? getPrimaryWorkspaceId(activeUser) : uid;

  const colRef = collection(db, 'user_workspaces', targetWorkspaceId, 'categories');
  const unsub = onSnapshot(
    colRef,
    (snap) => {
      if (snap.empty || !isAutoCloudSyncEnabled()) return;

      let newestRemoteMs = 0;
      let fromOtherDevice = false;

      snap.forEach((docSnap) => {
        const d = docSnap.data();
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
      handleFirestoreError(err, OperationType.LIST, `user_workspaces/${uid}/categories`);
    }
  );

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsub();
  };
}
