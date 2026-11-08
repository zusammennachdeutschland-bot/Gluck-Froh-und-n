import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  onSnapshot,
  runTransaction
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
import {
  mergeEntities,
  mergeRecentlyDeleted,
  mergeDismissedDashboardLessons,
  enforcePurgedTombstonesOnWorkspace
} from './sync/mergeEngine';
import { RecentlyDeletedData } from '../types';

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
  clearFirestoreWriteQuotaFlag,
  DEFAULT_LERNSTUDIO_SETS
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

export const SYNC_CONTROL_DOC_ID = 'sync_control_chunk_0';
export const LOCAL_ACTIVE_GENERATION_KEY = 'gluck_cloud_active_generation';

export interface CloudSyncControlState {
  isPaused: boolean;
  syncGeneration: string;
  updatedAtIso: string;
  updatedAtMs: number;
  pausedByDeviceId?: string;
  reason?: string;
}

export function getLocalActiveGeneration(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LOCAL_ACTIVE_GENERATION_KEY);
  } catch {
    return null;
  }
}

export function setLocalActiveGeneration(gen: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (gen) {
      localStorage.setItem(LOCAL_ACTIVE_GENERATION_KEY, gen);
    } else {
      localStorage.removeItem(LOCAL_ACTIVE_GENERATION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reads the cloud-side synchronization control state (/user_workspaces/{uid}/categories/sync_control_chunk_0).
 * Fail-safe: Returns { isPaused: true, isError: true } if network/firestore fails.
 */
export async function getCloudSyncControlState(workspaceId: string): Promise<{
  isPaused: boolean;
  syncGeneration: string;
  isError?: boolean;
  rawDoc?: any;
}> {
  try {
    const docRef = doc(db, 'user_workspaces', workspaceId, 'categories', SYNC_CONTROL_DOC_ID);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { isPaused: false, syncGeneration: 'gen_initial' };
    }
    const d = snap.data();
    let parsedPayload: any = {};
    if (d && typeof d.payloadChunk === 'string') {
      try {
        parsedPayload = JSON.parse(d.payloadChunk);
      } catch {
        parsedPayload = {};
      }
    }
    return {
      isPaused: Boolean(parsedPayload.isPaused),
      syncGeneration: parsedPayload.syncGeneration || 'gen_initial',
      rawDoc: d
    };
  } catch (err) {
    console.warn('Fail-safe: Failed to read cloud sync control state:', err);
    return { isPaused: true, syncGeneration: '', isError: true };
  }
}

/**
 * Manually reactivates cloud synchronization by creating a deliberate new synchronization generation.
 */
export async function reactivateCloudSync(workspaceId: string): Promise<{ success: boolean; newGeneration: string; error?: string }> {
  const user = getActiveCloudUser();
  if (!user || !verifyWorkspaceOwnership(user)) {
    return { success: false, newGeneration: '', error: 'User not authenticated' };
  }
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const newGen = `gen_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
  const deviceId = getCloudDeviceId();

  const controlPayload = JSON.stringify({
    isPaused: false,
    syncGeneration: newGen,
    updatedAtIso: nowIso,
    updatedAtMs: nowMs,
    reactivatedByDeviceId: deviceId,
    reason: 'manual_reactivation'
  });

  const chunkObj = {
    id: SYNC_CONTROL_DOC_ID,
    categoryKey: 'core_crm',
    chunkIndex: 0,
    totalChunks: 1,
    updatedAtMs: nowMs,
    updatedAtIso: nowIso,
    deviceId,
    payloadChunk: controlPayload,
    ownerUid: user.uid,
    ...(user.email ? { ownerEmail: user.email.trim().toLowerCase().slice(0, 120) } : {})
  };

  try {
    await executeSafeFirestoreWrite(() =>
      setDoc(doc(db, 'user_workspaces', workspaceId, 'categories', SYNC_CONTROL_DOC_ID), chunkObj)
    );
    setLocalActiveGeneration(newGen);
    setAutoCloudSyncEnabled(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gluck-cloud-sync-config-changed'));
    }
    return { success: true, newGeneration: newGen };
  } catch (err: any) {
    return { success: false, newGeneration: '', error: err?.message || 'Failed to reactivate cloud sync' };
  }
}

/**
 * Executes a write within a Firestore transaction that validates the cloud generation state
 * (/user_workspaces/{workspaceId}/categories/sync_control_chunk_0).
 * Prevents writes from committing if the workspace was cleared (paused) or if the cloud generation
 * was modified after the caller's initial generation check.
 */
export async function executeGenerationGuardedWrite(
  workspaceId: string,
  expectedGeneration: string,
  chunkDocId: string,
  chunkObj: any
): Promise<void> {
  const controlDocRef = doc(db, 'user_workspaces', workspaceId, 'categories', SYNC_CONTROL_DOC_ID);
  const targetDocRef = doc(db, 'user_workspaces', workspaceId, 'categories', chunkDocId);

  await executeSafeFirestoreWrite(async () => {
    await runTransaction(db, async (transaction) => {
      const controlSnap = await transaction.get(controlDocRef);
      if (controlSnap.exists()) {
        const d = controlSnap.data();
        let parsed: any = {};
        if (d && typeof d.payloadChunk === 'string') {
          try {
            parsed = JSON.parse(d.payloadChunk);
          } catch {
            parsed = {};
          }
        }
        if (parsed.isPaused) {
          throw new Error('SYNC_ABORTED_PAUSED: Cloud synchronization is paused for this workspace.');
        }
        const activeCloudGen = parsed.syncGeneration || 'gen_initial';
        if (expectedGeneration && activeCloudGen !== expectedGeneration) {
          throw new Error(
            `SYNC_ABORTED_GENERATION_MISMATCH: Cloud generation changed from ${expectedGeneration} to ${activeCloudGen}`
          );
        }
      }
      transaction.set(targetDocRef, chunkObj);
    });
  });
}

/**
 * Executes a stale chunk deletion within a Firestore transaction that validates the cloud generation state.
 */
export async function executeGenerationGuardedDelete(
  workspaceId: string,
  expectedGeneration: string,
  chunkDocId: string
): Promise<void> {
  const controlDocRef = doc(db, 'user_workspaces', workspaceId, 'categories', SYNC_CONTROL_DOC_ID);
  const targetDocRef = doc(db, 'user_workspaces', workspaceId, 'categories', chunkDocId);

  await executeSafeFirestoreWrite(async () => {
    await runTransaction(db, async (transaction) => {
      const controlSnap = await transaction.get(controlDocRef);
      if (controlSnap.exists()) {
        const d = controlSnap.data();
        let parsed: any = {};
        if (d && typeof d.payloadChunk === 'string') {
          try {
            parsed = JSON.parse(d.payloadChunk);
          } catch {
            parsed = {};
          }
        }
        if (parsed.isPaused) {
          throw new Error('SYNC_ABORTED_PAUSED: Cloud synchronization is paused for this workspace.');
        }
        const activeCloudGen = parsed.syncGeneration || 'gen_initial';
        if (expectedGeneration && activeCloudGen !== expectedGeneration) {
          throw new Error('SYNC_ABORTED_GENERATION_MISMATCH: Cloud generation changed.');
        }
      }
      transaction.delete(targetDocRef);
    });
  });
}

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

export const ENTITY_COLLECTION_KEYS = [
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
  'financeNotifications',
  'goldHoldings',
  'lernstudioSets',
  'homeworkAssignments',
  'homeworkSubmissions'
] as const;

export const SINGLETON_KEYS = [
  'profile',
  'schoolSettings',
  'theme',
  'accentColor',
  'notificationSettings',
  'inspirationSettings',
  'inspirationMessages',
  'customAiBackgrounds',
  'pickerNames',
  'prunedLessonIds',
  'recentlyDeleted',
  'dismissedDashboardLessons'
] as const;

// Pre-compute built-in Lernstudio sets lookup so we NEVER sync or duplicate built-in sets!
export const BUILTIN_LERNSTUDIO_MAP = new Map<string, string>();
for (const s of DEFAULT_LERNSTUDIO_SETS) {
  if (s && s.id) {
    BUILTIN_LERNSTUDIO_MAP.set(
      s.id,
      `${s.title || ''}|${Array.isArray(s.items) ? s.items.length : 0}`
    );
  }
}

/**
 * Strictly filters sets so built-in sets (DEFAULT_LERNSTUDIO_SETS) are NEVER uploaded.
 * Only custom teacher-created sets (!BUILTIN_LERNSTUDIO_MAP.has(id)) are synced.
 * Also preserves tombstones for custom sets when deleted: true.
 */
export function filterCustomOrModifiedLernstudioSets(sets: any[]): any[] {
  if (!Array.isArray(sets)) return [];
  return sets.filter((s) => {
    if (!s || !s.id) return false;
    // Built-in sets are NEVER uploaded to cloud workspace!
    if (BUILTIN_LERNSTUDIO_MAP.has(s.id)) {
      return false;
    }
    // Only teacher's custom sets (or deleted custom sets) are synced
    return true;
  });
}

/**
 * On download/restore, preserves all bundled DEFAULT_LERNSTUDIO_SETS
 * and layers custom sets (and updates) on top.
 */
export function mergeWithBuiltinLernstudioSets(customSets: any[]): any[] {
  const incoming = Array.isArray(customSets) ? customSets : [];
  const byId = new Map<string, any>();
  for (const s of incoming) {
    if (s && s.id) {
      byId.set(s.id, s);
    }
  }
  // Start with incoming custom sets that are not deleted
  const combined: any[] = [...incoming.filter((s) => s && !s.deleted && !BUILTIN_LERNSTUDIO_MAP.has(s.id))];
  // Always attach built-in curriculum sets from the local app bundle
  for (const defSet of DEFAULT_LERNSTUDIO_SETS) {
    if (!defSet || !defSet.id) continue;
    combined.push(defSet);
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
      financeNotifications: fullData.financeNotifications || [],
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
      inspirationMessages: fullData.inspirationMessages || [],
      customAiBackgrounds: fullData.customAiBackgrounds || fullData.profile?.customAiBackgrounds || [],
      recentlyDeleted: fullData.recentlyDeleted || { students: [], groups: [], lessons: [] },
      dismissedDashboardLessons: fullData.dismissedDashboardLessons || []
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

async function postChunksToRelayServer(workspaceId: string, chunks: any[]): Promise<boolean> {
  if (typeof window === 'undefined' || chunks.length === 0) return true;
  try {
    let authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        if (token) {
          authHeaders['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Ignore token error, relay is disposable cache
      }
    }
    const res = await fetch('/api/workspace/delta', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ workspaceId, chunks })
    });
    if (!res.ok) {
      console.warn(`Relay server returned HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    // Relay is a disposable cache: failure does not affect Firestore truth
    console.warn('Relay server post error:', err);
    return false;
  }
}

async function fetchChunksFromRelayServer(workspaceId: string): Promise<any[]> {
  if (typeof window === 'undefined') return [];
  try {
    let authHeaders: Record<string, string> = {};
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        if (token) {
          authHeaders['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Ignore
      }
    }
    const res = await fetch(`/api/workspace/delta?workspaceId=${encodeURIComponent(workspaceId)}`, {
      headers: authHeaders
    });
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
    // Check Cloud-side pause and generation marker first (cross-device protection)
    const controlState = await getCloudSyncControlState(uid);
    if (controlState.isPaused) {
      return {
        success: false,
        syncedAtIso: nowIso,
        error: 'Cloud synchronization is currently paused for this workspace. Use explicit manual reactivation.'
      };
    }
    const localActiveGen = getLocalActiveGeneration();
    if (localActiveGen && controlState.syncGeneration && localActiveGen !== controlState.syncGeneration) {
      return {
        success: false,
        syncedAtIso: nowIso,
        error: 'Stale sync generation detected. Cloud workspace generation mismatch. Sync paused for safety.'
      };
    }
    const targetGeneration = controlState.syncGeneration || 'gen_initial';
    if (!localActiveGen && controlState.syncGeneration) {
      setLocalActiveGeneration(controlState.syncGeneration);
    }

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

      // Merge changed singletons into the rolling delta accumulator
      for (const [sKey, sVal] of Object.entries(changedSingletons)) {
        if (sKey === 'prunedLessonIds' && Array.isArray(sVal)) {
          const prevPruned = Array.isArray(nextAcc.prunedLessonIds) ? nextAcc.prunedLessonIds : [];
          nextAcc.prunedLessonIds = Array.from(new Set([...prevPruned, ...sVal]));
        } else if (sKey === 'recentlyDeleted') {
          nextAcc.recentlyDeleted = mergeRecentlyDeleted(nextAcc.recentlyDeleted, sVal);
        } else if (sKey === 'dismissedDashboardLessons' && Array.isArray(sVal)) {
          nextAcc.dismissedDashboardLessons = mergeDismissedDashboardLessons(nextAcc.dismissedDashboardLessons, sVal, true);
        } else {
          nextAcc[sKey] = sVal;
        }
      }

      // Mergechanged entities into the rolling delta accumulator and sweep purged items so purged records cannot linger in nextAcc
      const accPurged = nextAcc.recentlyDeleted?.purgedRecords || parsed.recentlyDeleted?.purgedRecords || [];
      for (const [colKey, deltaItems] of Object.entries(changedEntities)) {
        const existingDeltaItems = Array.isArray(nextAcc[colKey]) ? nextAcc[colKey] : [];
        nextAcc[colKey] = mergeEntities(existingDeltaItems, deltaItems, {
          entityTypeName: colKey,
          purgedRecords: accPurged
        }).merged;
      }

      // Sweep any pre-existing entity arrays in the rolling delta accumulator against current tombstones
      enforcePurgedTombstonesOnWorkspace(nextAcc, accPurged);

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

        if (isFirestoreWriteQuotaExhaustedToday()) {
          return {
            success: false,
            syncedAtIso: nowIso,
            error: 'Quota exceeded: تم بلوغ الحد اليومي المجاني لكتابة Firestore، ستُستأنف المزامنة تلقائياً.'
          };
        }

        // CONFIRM FIRESTORE WRITE FIRST with Server-Enforced Generation Validation
        await executeGenerationGuardedWrite(uid, targetGeneration, docId, chunkObj);

        // ONLY post to Relay cache after Firestore write is confirmed
        await postChunksToRelayServer(uid, [chunkObj]);

        saveDeltaAccumulator(uid, nextAcc);
        saveWatermarks(uid, nextWatermarks);
        setLastCloudSyncTime(nowIso);
        return { success: true, syncedAtIso: nowIso, deltaCount: totalChangedCount };
      }
    }

    // 3. Category-Level Sync (Initial baseline seed or when delta accumulator compacts into categories)
    const categories = partitionBackupPayload(parsed);
    const relayChunks: any[] = [];

    if (isFirestoreWriteQuotaExhaustedToday()) {
      return {
        success: false,
        syncedAtIso: nowIso,
        error: 'Quota exceeded: تم بلوغ الحد اليومي المجاني لكتابة Firestore، ستُستأنف المزامنة تلقائياً.'
      };
    }

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

        // Write sequentially with Server-Enforced Generation Validation
        await executeGenerationGuardedWrite(uid, targetGeneration, docId, chunkObj);
        lastUploadedChunkCache.set(cacheKey, chunkData);
      }

      if (previousChunkCount > chunks.length && !isFirestoreWriteQuotaExhaustedToday()) {
        for (let staleIdx = chunks.length; staleIdx < previousChunkCount; staleIdx++) {
          const staleDocId = `${categoryKey}_chunk_${staleIdx}`;
          await executeGenerationGuardedDelete(uid, targetGeneration, staleDocId).catch(() => {});
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
    console.warn('Workspace upload notice:', errMsg);
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
 * Applies a P2P/Cloud delta payload on top of a base workspace object using `mergeEntities`
 * and `enforcePurgedTombstonesOnWorkspace`.
 * Handles both directions:
 * - Incoming active records are checked against base + delta tombstones.
 * - Incoming tombstones immediately remove existing active records from `baseObj` even when
 *   the delta does not contain a non-empty array for that entity collection.
 */
export function applyDeltaOnWorkspace(baseObj: any, deltaObj: any): any {
  if (!baseObj || typeof baseObj !== 'object') return baseObj;
  if (!deltaObj || typeof deltaObj !== 'object') {
    enforcePurgedTombstonesOnWorkspace(baseObj);
    return baseObj;
  }

  // 1. First merge recentlyDeleted and singletons so authoritative purge tombstones are available
  if (deltaObj.recentlyDeleted || baseObj.recentlyDeleted) {
    baseObj.recentlyDeleted = mergeRecentlyDeleted(baseObj.recentlyDeleted, deltaObj.recentlyDeleted);
  }
  if (Array.isArray(deltaObj.purgedRecords) && deltaObj.purgedRecords.length > 0) {
    baseObj.recentlyDeleted = mergeRecentlyDeleted(baseObj.recentlyDeleted, {
      students: [],
      groups: [],
      lessons: [],
      purgedRecords: deltaObj.purgedRecords
    });
  }
  if (deltaObj.dismissedDashboardLessons !== undefined) {
    baseObj.dismissedDashboardLessons = mergeDismissedDashboardLessons(
      baseObj.dismissedDashboardLessons,
      deltaObj.dismissedDashboardLessons,
      true
    );
  }
  if (Array.isArray(deltaObj.prunedLessonIds)) {
    const existingPruned = Array.isArray(baseObj.prunedLessonIds) ? baseObj.prunedLessonIds : [];
    baseObj.prunedLessonIds = Array.from(new Set([...existingPruned, ...deltaObj.prunedLessonIds]));
  }

  for (const sKey of SINGLETON_KEYS) {
    if (sKey !== 'recentlyDeleted' && sKey !== 'dismissedDashboardLessons' && sKey !== 'prunedLessonIds') {
      if (deltaObj[sKey] !== undefined) {
        baseObj[sKey] = deltaObj[sKey];
      }
    }
  }

  // 2. Sweep existing baseObj collections immediately against merged tombstones (handles tombstone-only deltas!)
  enforcePurgedTombstonesOnWorkspace(baseObj);
  const purgedList = baseObj.recentlyDeleted?.purgedRecords || [];

  // 3. Process entity collections with centralized purge tombstone protection
  for (const colKey of ENTITY_COLLECTION_KEYS) {
    const incomingItems = deltaObj[colKey];
    const existingItems = Array.isArray(baseObj[colKey]) ? baseObj[colKey] : [];
    if (Array.isArray(incomingItems) && incomingItems.length > 0) {
      baseObj[colKey] = mergeEntities(existingItems, incomingItems, {
        entityTypeName: colKey,
        purgedRecords: purgedList
      }).merged;
    } else if (existingItems.length > 0 && purgedList.length > 0) {
      baseObj[colKey] = mergeEntities(existingItems, [], {
        entityTypeName: colKey,
        purgedRecords: purgedList
      }).merged;
    }
  }

  // 4. Final sweep to ensure cascade referential integrity across all collections
  enforcePurgedTombstonesOnWorkspace(baseObj);
  return baseObj;
}

function getLocalStoredRecentlyDeleted(): RecentlyDeletedData | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('dl_recently_deleted');
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function getLocalKnownIdsForCollection(colKey: string): Set<string> {
  const keyMap: Record<string, string> = {
    groups: 'dl_groups',
    students: 'dl_students',
    lessons: 'dl_lessons',
    payments: 'dl_payments'
  };
  const storageKey = keyMap[colKey];
  if (!storageKey || typeof window === 'undefined') return new Set<string>();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((x: any) => x && typeof x.id === 'string').map((x: any) => x.id.trim()));
  } catch {
    return new Set<string>();
  }
}

/**
 * Reassembles a complete or partial Cloud workspace snapshot from category chunk documents.
 * - Reassembles `profile_settings` FIRST so authoritative `recentlyDeleted.purgedRecords` tombstones are known before any entity category (`core_crm`, `school_hod`, etc.) is merged.
 * - Always merges local `recentlyDeleted.purgedRecords` tombstones so local permanent deletions are enforced immediately.
 * - If `profile_settings` is missing or incomplete in a partial snapshot, defers unknown conflicting remote active records until tombstone state is known, or filters them when `knownLocalIdsByCollection` is provided.
 * - Never overwrites a category when its chunks are incomplete (`reassembleCategoryChunks` returns null).
 */
export function reassembleWorkspaceSnapshot(
  docsByCategory: Map<string, any[]> | Record<string, any[]>,
  options?: {
    primaryId?: string;
    maxUpdatedAtIso?: string | null;
    localRecentlyDeleted?: RecentlyDeletedData;
    localWorkspace?: Record<string, any>;
    knownLocalIdsByCollection?: Record<string, Set<string>>;
    deferUnknownWhenProfileSettingsMissing?: boolean;
  }
): {
  reassembled: any;
  workspace: any;
  hasCompleteProfileSettings: boolean;
  hasAuthoritativeTombstones: boolean;
  deferredEntityIds: Record<string, string[]>;
  deferredIds: string[];
  skippedIncompleteCategories: string[];
} {
  const categoryMap: Map<string, any[]> =
    docsByCategory instanceof Map
      ? docsByCategory
      : new Map<string, any[]>(Object.entries(docsByCategory || {}));

  const primaryId = options?.primaryId || '';
  const reassembled: any = {
    timestamp: options?.maxUpdatedAtIso || new Date().toISOString(),
    version: '2.0.0',
    isCloudDelta: true
  };

  const skippedIncompleteCategories: string[] = [];
  const deferredEntityIds: Record<string, string[]> = {};

  // 1. Reassemble `profile_settings` FIRST so remote tombstones are loaded before any entity categories
  let hasCompleteProfileSettings = false;
  const profileChunks = categoryMap.get('profile_settings');
  if (profileChunks && profileChunks.length > 0) {
    try {
      const parsedProfileCat = reassembleCategoryChunks(profileChunks);
      if (parsedProfileCat && typeof parsedProfileCat === 'object') {
        Object.assign(reassembled, parsedProfileCat);
        hasCompleteProfileSettings = Boolean(parsedProfileCat.recentlyDeleted);
        if (primaryId) {
          const catStr = JSON.stringify(parsedProfileCat);
          const chunks = splitStringIntoChunks(catStr, CHUNK_MAX_CHARS);
          lastUploadedChunkCount.set(`${primaryId}:profile_settings`, chunks.length);
          chunks.forEach((c, idx) => {
            lastUploadedChunkCache.set(`${primaryId}:profile_settings_chunk_${idx}:${chunks.length}`, c);
          });
        }
      } else {
        skippedIncompleteCategories.push('profile_settings');
      }
    } catch (err) {
      skippedIncompleteCategories.push('profile_settings');
      console.warn('Failed to parse cloud profile_settings category:', err);
    }
  }

  // Merge local tombstones immediately so local permanent deletions always take precedence
  const localRec = options?.localRecentlyDeleted ?? getLocalStoredRecentlyDeleted();
  reassembled.recentlyDeleted = mergeRecentlyDeleted(localRec, reassembled.recentlyDeleted);

  // 2. Reassemble remaining baseline categories in deterministic order
  const remainingCategories = WORKSPACE_CATEGORY_KEYS.filter(k => k !== 'profile_settings');
  for (const categoryKey of remainingCategories) {
    const chunkDocs = categoryMap.get(categoryKey);
    if (!chunkDocs || chunkDocs.length === 0) continue;
    try {
      const parsedCat = reassembleCategoryChunks(chunkDocs);
      if (parsedCat && typeof parsedCat === 'object') {
        Object.assign(reassembled, parsedCat);
        if (primaryId) {
          const catStr = JSON.stringify(parsedCat);
          const chunks = splitStringIntoChunks(catStr, CHUNK_MAX_CHARS);
          lastUploadedChunkCount.set(`${primaryId}:${categoryKey}`, chunks.length);
          chunks.forEach((c, idx) => {
            lastUploadedChunkCache.set(`${primaryId}:category_${categoryKey}_chunk_${idx}:${chunks.length}`, c);
          });
        }
      } else {
        skippedIncompleteCategories.push(categoryKey);
      }
    } catch (parseErr) {
      skippedIncompleteCategories.push(categoryKey);
      console.warn('Failed to parse reassembled cloud category:', parseErr);
    }
  }

  // Also support category maps keyed by direct entity collection name (e.g., `lessons`, `students`, `groups`)
  for (const [customKey, chunkDocs] of categoryMap.entries()) {
    if (customKey === 'profile_settings' || customKey === 'delta_log' || WORKSPACE_CATEGORY_KEYS.includes(customKey as any)) {
      continue;
    }
    if (!chunkDocs || chunkDocs.length === 0) continue;
    try {
      const parsedCat = reassembleCategoryChunks(chunkDocs);
      if (parsedCat && typeof parsedCat === 'object') {
        Object.assign(reassembled, parsedCat);
      }
    } catch {
      skippedIncompleteCategories.push(customKey);
    }
  }

  // 3. Apply P2P delta_log on top of baseline categories using applyDeltaOnWorkspace
  const deltaChunks = categoryMap.get('delta_log');
  if (deltaChunks && deltaChunks.length > 0) {
    try {
      const parsedDelta = reassembleCategoryChunks(deltaChunks);
      if (parsedDelta && typeof parsedDelta === 'object') {
        if (parsedDelta.recentlyDeleted) {
          hasCompleteProfileSettings = true;
        }
        applyDeltaOnWorkspace(reassembled, parsedDelta);
        if (primaryId) {
          saveDeltaAccumulator(primaryId, parsedDelta);
        }
      } else {
        skippedIncompleteCategories.push('delta_log');
      }
    } catch (deltaErr) {
      skippedIncompleteCategories.push('delta_log');
      console.warn('Failed to parse cloud delta_log:', deltaErr);
    }
  }

  // 4. If tombstone metadata (`profile_settings`) was missing/incomplete in a partial snapshot,
  // apply local tombstones immediately and defer unknown conflicting remote active records
  const activePurged = reassembled.recentlyDeleted?.purgedRecords || [];
  if (!hasCompleteProfileSettings) {
    for (const colKey of ['groups', 'students', 'lessons'] as const) {
      if (Array.isArray(reassembled[colKey]) && reassembled[colKey].length > 0) {
        let knownIds = options?.knownLocalIdsByCollection?.[colKey];
        if (!knownIds && options?.localWorkspace && Array.isArray(options.localWorkspace[colKey])) {
          knownIds = new Set<string>(
            options.localWorkspace[colKey]
              .filter((item: any) => item && typeof item.id === 'string')
              .map((item: any) => item.id.trim())
          );
        }
        if (!knownIds) {
          knownIds = getLocalKnownIdsForCollection(colKey);
        }
        const res = mergeEntities([], reassembled[colKey], {
          entityTypeName: colKey,
          purgedRecords: activePurged,
          deferUnknownActiveIds: true,
          knownLocalIds: knownIds
        });
        reassembled[colKey] = res.merged;
        if (res.deferredIds && res.deferredIds.length > 0) {
          deferredEntityIds[colKey] = res.deferredIds;
        }
      }
    }
  }

  // 5. Enforce reverse-direction tombstones and cascade integrity across the entire reassembled snapshot
  enforcePurgedTombstonesOnWorkspace(reassembled, activePurged);

  // 6. Re-attach built-in Lernstudio sets so the full 297+ curriculum is preserved locally
  reassembled.lernstudioSets = mergeWithBuiltinLernstudioSets(reassembled.lernstudioSets || []);

  const flatDeferredIds = Object.values(deferredEntityIds).flat();
  return {
    reassembled,
    workspace: reassembled,
    hasCompleteProfileSettings,
    hasAuthoritativeTombstones: hasCompleteProfileSettings,
    deferredEntityIds,
    deferredIds: flatDeferredIds,
    skippedIncompleteCategories
  };
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

    const { reassembled } = reassembleWorkspaceSnapshot(docsByCategory, {
      primaryId,
      maxUpdatedAtIso
    });

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
    if (isLegacyPath && legacyId && reassembled && !isFirestoreWriteQuotaExhaustedToday()) {
      const migrationRes = await uploadWorkspaceToGoogleCloud(JSON.stringify(reassembled), {
        forceFullBaseline: true
      });
      if (migrationRes.success) {
        try {
          const verifySnap = await getDocs(collection(db, 'user_workspaces', primaryId, 'categories'));
          if (!verifySnap.empty && verifySnap.size >= WORKSPACE_CATEGORY_KEYS.length) {
            const legacyDocs = Array.from(rawDocsMap.keys());
            for (const docId of legacyDocs) {
              await executeSafeFirestoreWrite(() =>
                deleteDoc(doc(db, 'user_workspaces', legacyId, 'categories', docId))
              ).catch(() => {});
            }
          }
        } catch {
          // Retain legacy data if verification read fails
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

/**
 * Wipes remote cloud workspace data from Google Cloud Firestore and Relay Server:
 * 1. Verifies ownership of the active Google account.
 * 2. Deletes all docs in `user_workspaces/{uid}/categories`.
 * 3. Checks and deletes legacy email-derived path `user_workspaces/{legacyEmailId}/categories`.
 * 4. Calls DELETE on `/api/workspace/delta` for both UID and legacy IDs.
 * 5. Clears local sync metadata for this account (watermarks, delta accumulator, caches).
 * 6. Disables auto-sync immediately so local data is NOT re-uploaded seconds later.
 * 7. Leaves local app data, local backups, and Firebase Auth user completely untouched.
 */
export async function clearCloudWorkspaceData(): Promise<{
  success: boolean;
  deletedCount: number;
  clearedRelay: boolean;
  clearedLegacy: boolean;
  error?: string;
}> {
  const user = getActiveCloudUser();
  if (!user || !verifyWorkspaceOwnership(user)) {
    return {
      success: false,
      deletedCount: 0,
      clearedRelay: false,
      clearedLegacy: false,
      error: 'يرجى تسجيل الدخول بحساب Google الموثق أولاً لتنفيذ عملية التنظيف.'
    };
  }

  const primaryId = getPrimaryWorkspaceId(user);
  const legacyId = user.email ? emailToWorkspaceId(user.email) : null;
  let deletedCount = 0;
  let clearedLegacy = false;
  let clearedRelay = false;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const clearedGen = `gen_cleared_${nowMs}`;
  const deviceId = getCloudDeviceId();

  try {
    // 1. Immediately pause local auto-sync and invalidate local active generation
    setAutoCloudSyncEnabled(false);
    setLocalActiveGeneration(null);

    // 2. Write persistent CLOUD-SIDE PAUSE doc so all connected devices recognize the pause
    const pausedControlPayload = JSON.stringify({
      isPaused: true,
      syncGeneration: clearedGen,
      updatedAtIso: nowIso,
      updatedAtMs: nowMs,
      pausedByDeviceId: deviceId,
      reason: 'cleared_cloud_data',
      lastClearedAtIso: nowIso
    });

    const controlChunkObj = {
      id: SYNC_CONTROL_DOC_ID,
      categoryKey: 'core_crm',
      chunkIndex: 0,
      totalChunks: 1,
      updatedAtMs: nowMs,
      updatedAtIso: nowIso,
      deviceId,
      payloadChunk: pausedControlPayload,
      ownerUid: user.uid,
      ...(user.email ? { ownerEmail: user.email.trim().toLowerCase().slice(0, 120) } : {})
    };

    // Ensure the pause document is persisted to Firestore FIRST
    await executeSafeFirestoreWrite(() =>
      setDoc(doc(db, 'user_workspaces', primaryId, 'categories', SYNC_CONTROL_DOC_ID), controlChunkObj)
    );

    // 3. Delete all category/chunk documents in primary UID workspace (except sync_control which holds the pause state)
    const uidSnap = await getDocs(collection(db, 'user_workspaces', primaryId, 'categories'));
    if (!uidSnap.empty) {
      for (const docSnap of uidSnap.docs) {
        if (docSnap.id === SYNC_CONTROL_DOC_ID) continue; // Keep the pause state marker!
        await executeSafeFirestoreWrite(() =>
          deleteDoc(doc(db, 'user_workspaces', primaryId, 'categories', docSnap.id))
        );
        deletedCount++;
      }
    }

    // 4. Check and delete legacy email workspace documents if existing
    if (legacyId && legacyId !== primaryId) {
      try {
        const legacySnap = await getDocs(collection(db, 'user_workspaces', legacyId, 'categories'));
        if (!legacySnap.empty) {
          for (const docSnap of legacySnap.docs) {
            await executeSafeFirestoreWrite(() =>
              deleteDoc(doc(db, 'user_workspaces', legacyId, 'categories', docSnap.id))
            );
            deletedCount++;
          }
          clearedLegacy = true;
        }
      } catch (legacyErr: any) {
        console.warn('Notice while cleaning legacy cloud workspace:', legacyErr);
        return {
          success: false,
          deletedCount,
          clearedRelay: false,
          clearedLegacy: false,
          error: `فشل مسح مساحة العمل القديمة: ${legacyErr?.message || 'خطأ غير متوقع'}`
        };
      }
    }

    // 5. Delete and verify relay server cached chunks
    if (typeof window !== 'undefined') {
      try {
        let relayAuthHeaders: Record<string, string> = {};
        if (user) {
          try {
            const token = await user.getIdToken();
            if (token) relayAuthHeaders['Authorization'] = `Bearer ${token}`;
          } catch {}
        }

        const relayRes1 = await fetch(`/api/workspace/delta?workspaceId=${encodeURIComponent(primaryId)}`, {
          method: 'DELETE',
          headers: relayAuthHeaders
        });
        if (!relayRes1.ok) {
          return {
            success: false,
            deletedCount,
            clearedRelay: false,
            clearedLegacy,
            error: `تعذر مسح ذاكرة الـ Relay المؤقتة (HTTP ${relayRes1.status})`
          };
        }

        if (legacyId && legacyId !== primaryId) {
          const relayRes2 = await fetch(`/api/workspace/delta?workspaceId=${encodeURIComponent(legacyId)}`, {
            method: 'DELETE',
            headers: relayAuthHeaders
          });
          if (!relayRes2.ok) {
            return {
              success: false,
              deletedCount,
              clearedRelay: false,
              clearedLegacy,
              error: `تعذر مسح ذاكرة الـ Relay القديمة (HTTP ${relayRes2.status})`
            };
          }
        }

        // Verify Relay cleanup
        const verifyRelay = await fetch(`/api/workspace/delta?workspaceId=${encodeURIComponent(primaryId)}`, {
          headers: relayAuthHeaders
        });
        if (verifyRelay.ok) {
          const vData = await verifyRelay.json();
          if (Array.isArray(vData?.docs) && vData.docs.length > 0) {
            return {
              success: false,
              deletedCount,
              clearedRelay: false,
              clearedLegacy,
              error: 'فشل التحقق من مسح خادم الـ Relay (لا تزال هناك مستندات موجودة)'
            };
          }
        }
        clearedRelay = true;
      } catch (relayErr: any) {
        return {
          success: false,
          deletedCount,
          clearedRelay: false,
          clearedLegacy,
          error: `تعذر الاتصال بخادم الـ Relay للتنظيف: ${relayErr?.message || 'خطأ شبكة'}`
        };
      }
    }

    // 6. Clear local sync watermarks and cache for this account
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`gluck_cloud_watermarks_v2_${primaryId}`);
        localStorage.removeItem(`gluck_cloud_delta_acc_v2_${primaryId}`);
        if (legacyId) {
          localStorage.removeItem(`gluck_cloud_watermarks_v2_${legacyId}`);
          localStorage.removeItem(`gluck_cloud_delta_acc_v2_${legacyId}`);
        }
        localStorage.removeItem(LAST_SYNC_TIME_KEY);
      } catch {
        // Ignore localStorage error
      }
    }

    // Clear memory caches
    lastUploadedChunkCache.clear();
    lastUploadedChunkCount.clear();

    // 7. Verification check: ensure Firestore primary collection contains ONLY sync_control
    const verifySnap = await getDocs(collection(db, 'user_workspaces', primaryId, 'categories'));
    const remainingDocs = verifySnap.docs.filter((d) => d.id !== SYNC_CONTROL_DOC_ID);
    if (remainingDocs.length > 0) {
      return {
        success: false,
        deletedCount,
        clearedRelay,
        clearedLegacy,
        error: `لم تكتمل عملية التنظيف بالكامل، لا تزال هناك ${remainingDocs.length} أجزاء موجودة بالسحابة.`
      };
    }

    // Dispatch event so UI cards update immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gluck-cloud-sync-config-changed'));
    }

    return {
      success: true,
      deletedCount,
      clearedRelay,
      clearedLegacy
    };
  } catch (err: any) {
    const errMsg = err?.message || 'تعذر تنظيف بيانات السحابة.';
    console.error('Clear cloud workspace error:', err);
    return {
      success: false,
      deletedCount,
      clearedRelay,
      clearedLegacy,
      error: errMsg
    };
  }
}

