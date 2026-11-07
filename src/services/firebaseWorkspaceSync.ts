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
import { DEFAULT_LERNSTUDIO_SETS } from '../data/defaultLernstudioSets';
import { mergeEntities } from './sync/mergeEngine';

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
const DELTA_MAX_COMPACT_CHARS = 180000; // Compact delta threshold before folding into category

export type WorkspaceCategoryKey =
  | 'core_crm'
  | 'finance_gold'
  | 'school_hod'
  | 'profile_settings'
  | 'lernstudio_data'
  | 'delta_log';

export const WORKSPACE_CATEGORY_KEYS: WorkspaceCategoryKey[] = [
  'core_crm',
  'finance_gold',
  'school_hod',
  'profile_settings',
  'lernstudio_data'
];

const ENTITY_COLLECTION_KEYS = [
  'groups',
  'students',
  'lessons',
  'payments',
  'certificates',
  'notifications',
  'todos',
  'hodStudents',
  'hodComplaints',
  'hodActionPlans',
  'hodVisits',
  'schoolNotes',
  'financeAccounts',
  'financeCategories',
  'financeTransactions',
  'financeRecurring',
  'financeInstallments',
  'goldHoldings',
  'lernstudioSets',
  'homeworkAssignments',
  'homeworkSubmissions'
] as const;

const SINGLETON_KEYS = [
  'profile',
  'schoolSettings',
  'theme',
  'accentColor',
  'notificationSettings',
  'inspirationSettings',
  'inspirationMessages',
  'pickerNames',
  'prunedLessonIds'
] as const;

// Pre-compute built-in Lernstudio sets lookup so we never waste bandwidth syncing 277 static sets
const BUILTIN_LERNSTUDIO_MAP = new Map<string, string>();
for (const s of DEFAULT_LERNSTUDIO_SETS) {
  if (s && s.id) {
    BUILTIN_LERNSTUDIO_MAP.set(
      s.id,
      `${s.title || ''}|${Array.isArray(s.items) ? s.items.length : 0}`
    );
  }
}

function filterCustomOrModifiedLernstudioSets(sets: any[]): any[] {
  if (!Array.isArray(sets)) return [];
  return sets.filter((s) => {
    if (!s || !s.id) return false;
    const builtinSig = BUILTIN_LERNSTUDIO_MAP.get(s.id);
    if (!builtinSig) {
      return true; // Teacher's custom set -> always sync
    }
    if (s.deleted || s.updatedAt) {
      const currentSig = `${s.title || ''}|${Array.isArray(s.items) ? s.items.length : 0}`;
      if (s.deleted || currentSig !== builtinSig) {
        return true; // Modified or deleted built-in set -> sync
      }
    }
    return false; // Unmodified built-in set -> already bundled in app code!
  });
}

function mergeWithBuiltinLernstudioSets(customOrModifiedSets: any[]): any[] {
  const incoming = Array.isArray(customOrModifiedSets) ? customOrModifiedSets : [];
  const byId = new Map<string, any>();
  for (const s of incoming) {
    if (s && s.id) {
      byId.set(s.id, s);
    }
  }
  const combined: any[] = [...incoming.filter((s) => s && !s.deleted)];
  for (const defSet of DEFAULT_LERNSTUDIO_SETS) {
    if (!defSet || !defSet.id) continue;
    if (!byId.has(defSet.id)) {
      combined.push(defSet);
    }
  }
  return combined;
}

function sanitizeHeavyInlineMedia(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  if (Array.isArray(clone.students)) {
    clone.students = clone.students.map((s: any) => {
      if (!s || typeof s !== 'object') return s;
      let next = s;
      if (typeof s.avatarUrl === 'string' && s.avatarUrl.length > 90000) {
        next = { ...next, avatarUrl: '' };
      }
      if (Array.isArray(s.documents) && s.documents.some((d: any) => d?.dataUrl?.length > 90000)) {
        next = {
          ...next,
          documents: s.documents.map((d: any) =>
            d?.dataUrl?.length > 90000 ? { ...d, dataUrl: '' } : d
          )
        };
      }
      return next;
    });
  }
  if (clone.profile && typeof clone.profile === 'object') {
    const prof = { ...clone.profile };
    if (typeof prof.avatarUrl === 'string' && prof.avatarUrl.length > 90000) {
      prof.avatarUrl = '';
    }
    if (Array.isArray(prof.customAiBackgrounds)) {
      prof.customAiBackgrounds = prof.customAiBackgrounds.filter(
        (bg: any) => typeof bg === 'string' && bg.length <= 90000
      );
    }
    clone.profile = prof;
  }
  return clone;
}

function fastHash(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '_' + str.length.toString(36);
}

function loadWatermarks(uid: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`gluck_cloud_watermarks_v2_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWatermarks(uid: string, watermarks: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`gluck_cloud_watermarks_v2_${uid}`, JSON.stringify(watermarks));
  } catch {
    // Ignore storage quota errors
  }
}

function loadDeltaAccumulator(uid: string): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`gluck_cloud_delta_acc_v2_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDeltaAccumulator(uid: string, acc: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`gluck_cloud_delta_acc_v2_${uid}`, JSON.stringify(acc));
  } catch {
    // Ignore
  }
}

/**
 * Computes P2P-style record-level delta between current state and last synced watermarks.
 */
function computeWorkspaceDelta(
  uid: string,
  sanitizedData: any
): {
  changedEntities: Record<string, any[]>;
  changedSingletons: Record<string, any>;
  nextWatermarks: Record<string, string>;
  totalChangedCount: number;
  hasBaselineSeeded: boolean;
} {
  const prevWatermarks = loadWatermarks(uid);
  const hasBaselineSeeded = prevWatermarks['__baseline_seeded__'] === '1';
  const nextWatermarks: Record<string, string> = {
    __baseline_seeded__: '1'
  };

  const changedEntities: Record<string, any[]> = {};
  const changedSingletons: Record<string, any> = {};
  let totalChangedCount = 0;
  const nowMs = Date.now();

  for (const colKey of ENTITY_COLLECTION_KEYS) {
    const rawArr: any[] =
      colKey === 'lernstudioSets'
        ? filterCustomOrModifiedLernstudioSets(sanitizedData.lernstudioSets || [])
        : Array.isArray(sanitizedData[colKey])
        ? sanitizedData[colKey]
        : [];

    const currentIds = new Set<string>();
    const colChanged: any[] = [];

    for (const item of rawArr) {
      if (!item || typeof item !== 'object' || !item.id) continue;
      const id = String(item.id);
      currentIds.add(id);
      const wmKey = `e:${colKey}:${id}`;
      const itemHash = fastHash(JSON.stringify(item));
      nextWatermarks[wmKey] = itemHash;

      if (prevWatermarks[wmKey] !== itemHash) {
        colChanged.push(item);
        totalChangedCount++;
      }
    }

    // Detect records that existed in prevWatermarks for this collection but were hard-deleted locally
    const prefix = `e:${colKey}:`;
    for (const prevKey of Object.keys(prevWatermarks)) {
      if (prevKey.startsWith(prefix)) {
        const oldId = prevKey.slice(prefix.length);
        if (oldId && !currentIds.has(oldId)) {
          const tombstone = {
            id: oldId,
            deleted: true,
            updatedAt: nowMs,
            version: 999
          };
          const wmKey = `e:${colKey}:${oldId}`;
          const tombHash = fastHash(JSON.stringify(tombstone));
          nextWatermarks[wmKey] = tombHash;
          if (prevWatermarks[wmKey] !== tombHash) {
            colChanged.push(tombstone);
            totalChangedCount++;
          }
        }
      }
    }

    if (colChanged.length > 0) {
      changedEntities[colKey] = colChanged;
    }
  }

  for (const sKey of SINGLETON_KEYS) {
    const val =
      sKey === 'schoolSettings'
        ? sanitizedData.schoolSettings || sanitizedData.profile?.schoolSettings || {}
        : sanitizedData[sKey];
    if (val === undefined) continue;
    const wmKey = `s:${sKey}`;
    const sHash = fastHash(JSON.stringify(val));
    nextWatermarks[wmKey] = sHash;
    if (prevWatermarks[wmKey] !== sHash) {
      changedSingletons[sKey] = val;
      totalChangedCount++;
    }
  }

  return {
    changedEntities,
    changedSingletons,
    nextWatermarks,
    totalChangedCount,
    hasBaselineSeeded
  };
}

function seedWatermarksFromData(uid: string, rawData: any): void {
  const sanitized = sanitizeHeavyInlineMedia(rawData);
  const { nextWatermarks } = computeWorkspaceDelta(uid, sanitized);
  saveWatermarks(uid, nextWatermarks);
}

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

function partitionBackupPayload(fullData: any): Record<Exclude<WorkspaceCategoryKey, 'delta_log'>, any> {
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
      lernstudioSets: filterCustomOrModifiedLernstudioSets(fullData.lernstudioSets || []),
      homeworkAssignments: fullData.homeworkAssignments || [],
      homeworkSubmissions: fullData.homeworkSubmissions || [],
      pickerNames: fullData.pickerNames || []
    }
  };
}

const lastUploadedChunkCache = new Map<string, string>();
const lastUploadedChunkCount = new Map<string, number>();

async function postChunksToRelayServer(workspaceId: string, chunks: any[]): Promise<void> {
  if (typeof window === 'undefined' || chunks.length === 0) return;
  try {
    await fetch('/api/workspace/delta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, chunks })
    });
  } catch {
    // Ignore local relay error when offline
  }
}

async function fetchChunksFromRelayServer(workspaceId: string): Promise<any[]> {
  if (typeof window === 'undefined') return [];
  try {
    const res = await fetch(`/api/workspace/delta?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.docs) ? data.docs : [];
  } catch {
    return [];
  }
}

/**
 * P2P-Style Delta Sync to Google Cloud Firestore (`/user_workspaces/{uid}/categories/{docId}`).
 * Sends ONLY the records that changed since the last sync!
 */
export async function uploadWorkspaceToGoogleCloud(
  backupJsonStr: string,
  options?: { isManual?: boolean; forceFullBaseline?: boolean }
): Promise<{ success: boolean; syncedAtIso: string; deltaCount?: number; error?: string }> {
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

  const uid = getPrimaryWorkspaceId(user);
  const deviceId = getCloudDeviceId();
  lastLocalPushTimestampMs = nowMs;

  try {
    const rawParsed = JSON.parse(backupJsonStr);
    const parsed = sanitizeHeavyInlineMedia(rawParsed);

    // 1. Compute P2P-style record-level delta
    const {
      changedEntities,
      changedSingletons,
      nextWatermarks,
      totalChangedCount,
      hasBaselineSeeded
    } = computeWorkspaceDelta(uid, parsed);

    // If nothing changed at all since last sync, perform 0 network writes!
    if (hasBaselineSeeded && !options?.forceFullBaseline && totalChangedCount === 0) {
      setLastCloudSyncTime(nowIso);
      return { success: true, syncedAtIso: nowIso, deltaCount: 0 };
    }

    const ownerFields = {
      ownerUid: user.uid,
      ...(user.email ? { ownerEmail: user.email.trim().toLowerCase().slice(0, 120) } : {})
    };

    // 2. Fast Incremental P2P Delta Path (when baseline is already seeded)
    if (hasBaselineSeeded && !options?.forceFullBaseline) {
      const prevAcc = loadDeltaAccumulator(uid);
      const nextAcc: Record<string, any> = {
        ...prevAcc,
        isCloudDelta: true,
        updatedAtMs: nowMs,
        updatedAtIso: nowIso,
        deviceId
      };

      // Merge changed entities into the rolling delta accumulator using P2P mergeEngine
      for (const [colKey, deltaItems] of Object.entries(changedEntities)) {
        const existingDeltaItems = Array.isArray(nextAcc[colKey]) ? nextAcc[colKey] : [];
        nextAcc[colKey] = mergeEntities(existingDeltaItems, deltaItems, colKey).merged;
      }

      // Merge changed singletons into the rolling delta accumulator
      for (const [sKey, sVal] of Object.entries(changedSingletons)) {
        if (sKey === 'prunedLessonIds' && Array.isArray(sVal)) {
          const prevPruned = Array.isArray(nextAcc.prunedLessonIds) ? nextAcc.prunedLessonIds : [];
          nextAcc.prunedLessonIds = Array.from(new Set([...prevPruned, ...sVal]));
        } else {
          nextAcc[sKey] = sVal;
        }
      }

      const deltaPayloadStr = JSON.stringify(nextAcc);

      // If compact delta fits comfortably in a single fast packet (<180KB), write ONLY 1 delta doc!
      if (deltaPayloadStr.length <= DELTA_MAX_COMPACT_CHARS) {
        const docId = 'delta_log_chunk_0';
        const chunkObj = {
          id: docId,
          categoryKey: 'delta_log',
          chunkIndex: 0,
          totalChunks: 1,
          updatedAtMs: nowMs,
          updatedAtIso: nowIso,
          deviceId,
          payloadChunk: deltaPayloadStr,
          ...ownerFields
        };

        await postChunksToRelayServer(uid, [chunkObj]);

        if (!isFirestoreWriteQuotaExhaustedToday()) {
          await executeSafeFirestoreWrite(() =>
            setDoc(doc(db, 'user_workspaces', uid, 'categories', docId), chunkObj)
          );
        }

        saveDeltaAccumulator(uid, nextAcc);
        saveWatermarks(uid, nextWatermarks);
        setLastCloudSyncTime(nowIso);
        return { success: true, syncedAtIso: nowIso, deltaCount: totalChangedCount };
      }
    }

    // 3. Category-Level Sync (Initial baseline seed or when delta accumulator compacts into categories)
    const categories = partitionBackupPayload(parsed);
    const relayChunks: any[] = [];

    for (const categoryKey of WORKSPACE_CATEGORY_KEYS) {
      const catPayloadStr = JSON.stringify(categories[categoryKey] || {});
      const chunks = splitStringIntoChunks(catPayloadStr, CHUNK_MAX_CHARS);
      const countKey = `${uid}:${categoryKey}`;
      const previousChunkCount = lastUploadedChunkCount.get(countKey) || 0;

      for (let idx = 0; idx < chunks.length; idx++) {
        const docId = `${categoryKey}_chunk_${idx}`;
        const cacheKey = `${uid}:${docId}:${chunks.length}`;
        const chunkData = chunks[idx];

        if (lastUploadedChunkCache.get(cacheKey) === chunkData) {
          continue; // Unchanged chunk -> 0 Firestore write units used!
        }

        const chunkObj = {
          id: docId,
          categoryKey,
          chunkIndex: idx,
          totalChunks: chunks.length,
          updatedAtMs: nowMs,
          updatedAtIso: nowIso,
          deviceId,
          payloadChunk: chunkData,
          ...ownerFields
        };

        relayChunks.push(chunkObj);

        if (!isFirestoreWriteQuotaExhaustedToday()) {
          const path = `user_workspaces/${uid}/categories/${docId}`;
          // Write sequentially to avoid flooding the Firestore WebChannel stream
          await executeSafeFirestoreWrite(() =>
            setDoc(doc(db, 'user_workspaces', uid, 'categories', docId), chunkObj)
          );
          lastUploadedChunkCache.set(cacheKey, chunkData);
        } else {
          lastUploadedChunkCache.set(cacheKey, chunkData);
        }
      }

      if (previousChunkCount > chunks.length && !isFirestoreWriteQuotaExhaustedToday()) {
        for (let staleIdx = chunks.length; staleIdx < previousChunkCount; staleIdx++) {
          const staleDocId = `${categoryKey}_chunk_${staleIdx}`;
          await executeSafeFirestoreWrite(() =>
            deleteDoc(doc(db, 'user_workspaces', uid, 'categories', staleDocId))
          ).catch(() => {});
        }
      }
      lastUploadedChunkCount.set(countKey, chunks.length);
    }

    if (relayChunks.length > 0) {
      await postChunksToRelayServer(uid, relayChunks);
    }

    // Reset rolling delta accumulator and watermarks ONLY after confirmed category compaction
    saveDeltaAccumulator(uid, {});
    saveWatermarks(uid, nextWatermarks);
    setLastCloudSyncTime(nowIso);
    return { success: true, syncedAtIso: nowIso, deltaCount: totalChangedCount };
  } catch (err: any) {
    const errMsg = err?.message || 'حدث خطأ أثناء مزامنة التغييرات مع السحابة.';
    console.error('Workspace upload error:', errMsg);
    return {
      success: false,
      syncedAtIso: nowIso,
      error: errMsg
    };
  }
}

/**
 * Reassembles chunks for a category deterministically without relying on a 5-second clock window.
 */
function reassembleCategoryChunks(chunkDocs: any[]): any | null {
  if (!Array.isArray(chunkDocs) || chunkDocs.length === 0) return null;

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
      return null;
    }
    orderedParts.push(chunkDoc.payloadChunk);
  }

  const joinedStr = orderedParts.join('');
  if (!joinedStr) return null;
  return JSON.parse(joinedStr);
}

/**
 * Applies a P2P delta payload on top of a base workspace object using `mergeEntities`.
 */
function applyDeltaOnWorkspace(baseObj: any, deltaObj: any): void {
  if (!deltaObj || typeof deltaObj !== 'object') return;

  for (const colKey of ENTITY_COLLECTION_KEYS) {
    const incomingItems = deltaObj[colKey];
    if (Array.isArray(incomingItems) && incomingItems.length > 0) {
      const existingItems = Array.isArray(baseObj[colKey]) ? baseObj[colKey] : [];
      baseObj[colKey] = mergeEntities(existingItems, incomingItems, colKey).merged;
    }
  }

  for (const sKey of SINGLETON_KEYS) {
    if (deltaObj[sKey] !== undefined) {
      if (sKey === 'prunedLessonIds' && Array.isArray(deltaObj.prunedLessonIds)) {
        const existingPruned = Array.isArray(baseObj.prunedLessonIds) ? baseObj.prunedLessonIds : [];
        baseObj.prunedLessonIds = Array.from(new Set([...existingPruned, ...deltaObj.prunedLessonIds]));
      } else {
        baseObj[sKey] = deltaObj[sKey];
      }
    }
  }
}

/**
 * Downloads and reassembles the application workspace (base categories + P2P delta log)
 * from Google Cloud Firestore and relay for the currently signed-in Google account.
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
  const legacyId = user.email ? emailToWorkspaceId(user.email) : null;
  const deviceId = getCloudDeviceId();

  try {
    const rawDocsMap = new Map<string, any>();
    let resolvedWorkspaceId = primaryId;
    let isLegacyPath = false;

    // 1. Try UID path first
    const uidSnap = await getDocs(collection(db, 'user_workspaces', primaryId, 'categories'));
    if (!uidSnap.empty) {
      uidSnap.forEach((docSnap: any) => {
        const d = docSnap.data();
        if (d && d.id && verifyWorkspaceOwnership(user, d, primaryId)) {
          rawDocsMap.set(d.id, d);
        }
      });
    } else if (legacyId && legacyId !== primaryId) {
      // 2. If UID path empty, check legacy email path
      const legacySnap = await getDocs(collection(db, 'user_workspaces', legacyId, 'categories'));
      if (!legacySnap.empty) {
        resolvedWorkspaceId = legacyId;
        isLegacyPath = true;
        legacySnap.forEach((docSnap: any) => {
          const d = docSnap.data();
          if (d && d.id && verifyWorkspaceOwnership(user, d, legacyId)) {
            rawDocsMap.set(d.id, d);
          }
        });
      }
    }

    // Merge any newer chunks/deltas from fast relay server
    const relayDocs = await fetchChunksFromRelayServer(resolvedWorkspaceId);
    for (const rDoc of relayDocs) {
      if (!rDoc || !rDoc.id) continue;
      const existing = rawDocsMap.get(rDoc.id);
      if (!existing || (Number(rDoc.updatedAtMs) || 0) >= (Number(existing.updatedAtMs) || 0)) {
        rawDocsMap.set(rDoc.id, rDoc);
      }
    }

    if (rawDocsMap.size === 0) {
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

    rawDocsMap.forEach((data) => {
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
      version: '2.0.0',
      isCloudDelta: true
    };

    // 1. Reassemble baseline categories first
    for (const categoryKey of WORKSPACE_CATEGORY_KEYS) {
      const chunkDocs = docsByCategory.get(categoryKey);
      if (!chunkDocs) continue;
      try {
        const parsedCat = reassembleCategoryChunks(chunkDocs);
        if (parsedCat && typeof parsedCat === 'object') {
          Object.assign(reassembled, parsedCat);
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
    }

    // 2. Apply P2P delta_log on top of baseline categories using mergeEntities
    const deltaChunks = docsByCategory.get('delta_log');
    if (deltaChunks && deltaChunks.length > 0) {
      try {
        const parsedDelta = reassembleCategoryChunks(deltaChunks);
        if (parsedDelta && typeof parsedDelta === 'object') {
          applyDeltaOnWorkspace(reassembled, parsedDelta);
          saveDeltaAccumulator(primaryId, parsedDelta);
        }
      } catch (deltaErr) {
        console.warn('Failed to parse cloud delta_log:', deltaErr);
      }
    }

    // 3. Re-attach built-in Lernstudio sets so the full 297+ curriculum is preserved locally
    reassembled.lernstudioSets = mergeWithBuiltinLernstudioSets(reassembled.lernstudioSets || []);

    // 4. Seed local watermarks from the downloaded cloud state so unchanged records cost 0 writes
    seedWatermarksFromData(primaryId, reassembled);

    const activeStudents = Array.isArray(reassembled.students)
      ? reassembled.students.filter((s: any) => s && !s.deleted)
      : [];
    const activeGroups = Array.isArray(reassembled.groups)
      ? reassembled.groups.filter((g: any) => g && !g.deleted)
      : [];
    const activeLessons = Array.isArray(reassembled.lessons)
      ? reassembled.lessons.filter((l: any) => l && !l.deleted)
      : [];
    const activePayments = Array.isArray(reassembled.payments)
      ? reassembled.payments.filter((p: any) => p && !p.deleted)
      : [];
    const activeFinanceTx = Array.isArray(reassembled.financeTransactions)
      ? reassembled.financeTransactions.filter((t: any) => t && !t.deleted)
      : [];

    const summary: CloudSyncSummary = {
      studentsCount: activeStudents.length,
      groupsCount: activeGroups.length,
      lessonsCount: activeLessons.length,
      paymentsCount: activePayments.length,
      financeTransactionsCount: activeFinanceTx.length,
      lernstudioSetsCount: Array.isArray(reassembled.lernstudioSets)
        ? reassembled.lernstudioSets.length
        : 0,
      hodRecordsCount:
        (Array.isArray(reassembled.hodStudents) ? reassembled.hodStudents.length : 0) +
        (Array.isArray(reassembled.hodComplaints) ? reassembled.hodComplaints.length : 0) +
        (Array.isArray(reassembled.schoolNotes) ? reassembled.schoolNotes.length : 0),
      updatedAtIso: maxUpdatedAtIso
    };

    // 5. If we loaded from legacy path, migrate to primary UID path now
    if (isLegacyPath && legacyId && reassembled) {
      console.log(`Migrating workspace from legacy ID ${legacyId} to primary ID ${primaryId}`);
      const migrationRes = await uploadWorkspaceToGoogleCloud(JSON.stringify(reassembled), { forceFullBaseline: true });
      if (migrationRes.success) {
        // Cleanup legacy data from Firestore
        const legacyDocs = Array.from(rawDocsMap.keys());
        for (const docId of legacyDocs) {
          await executeSafeFirestoreWrite(() => 
            deleteDoc(doc(db, 'user_workspaces', legacyId, 'categories', docId))
          ).catch(() => {});
        }
      }
    }

    return {
      hasRemoteData: true,
      backupJsonStr: JSON.stringify(reassembled),
      remoteTimestampMs: maxUpdatedAtMs,
      remoteTimestampIso: maxUpdatedAtIso,
      summary
    };
  } catch (err: any) {
    const primaryId = user ? getPrimaryWorkspaceId(user) : 'unknown';
    handleFirestoreError(err, OperationType.LIST, `user_workspaces/${primaryId}/categories`);
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
