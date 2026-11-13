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
  createTeacherWithEmailPassword,
  signInWithGoogleIdToken,
  emailToWorkspaceId,
  getActiveCloudUser,
  isFirestoreWriteQuotaExhaustedToday,
  clearFirestoreWriteQuotaFlag,
  isFirestoreReadQuotaExhausted,
  markFirestoreReadQuotaExhausted,
  clearFirestoreReadQuotaFlag,
  isQuotaErrorLike,
  executeSafeFirestoreWrite,
  isAndroidNativePlatform,
  getLastAndroidAuthDiagnostic,
  clearLastAndroidAuthDiagnostic,
  getAndroidApkSigningInfo,
  AndroidApkSigningInfo,
  AndroidAuthDiagnostic
} from '../shared/firebaseCloudSync';
import { DEFAULT_LERNSTUDIO_SETS } from '../data/defaultLernstudioSets';
import {
  mergeEntities,
  mergeRecentlyDeleted,
  mergeDismissedDashboardLessons,
  enforcePurgedTombstonesOnWorkspace,
  stampFieldTimestamps,
  mergeTeacherSettings
} from './sync/mergeEngine';
import { RecentlyDeletedData } from '../types';

export {
  signInTeacherWithGoogle,
  signInTeacherWithEmailPassword,
  createTeacherWithEmailPassword,
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
  isFirestoreReadQuotaExhausted,
  clearFirestoreReadQuotaFlag,
  isQuotaErrorLike,
  DEFAULT_LERNSTUDIO_SETS,
  isAndroidNativePlatform,
  getLastAndroidAuthDiagnostic,
  clearLastAndroidAuthDiagnostic,
  getAndroidApkSigningInfo
};
export type { AndroidApkSigningInfo, AndroidAuthDiagnostic };

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
export const SYNC_CONTROL_CATEGORY_KEY = 'sync_control';
export const LOCAL_ACTIVE_GENERATION_KEY = 'gluck_cloud_active_generation';

/**
 * Identifies synchronization control documents (`sync_control_chunk_0` or `categoryKey === 'sync_control'`)
 * including legacy control documents that were previously written with `categoryKey: 'core_crm'`.
 * Ensures control metadata is strictly isolated and never merged into user workspace categories.
 */
export function isSyncControlDocument(docOrData: any): boolean {
  if (!docOrData || typeof docOrData !== 'object') return false;
  const id = typeof docOrData.id === 'string' ? docOrData.id.trim() : '';
  const categoryKey = typeof docOrData.categoryKey === 'string' ? docOrData.categoryKey.trim() : '';
  if (
    id === SYNC_CONTROL_DOC_ID ||
    id.startsWith('sync_control') ||
    categoryKey === SYNC_CONTROL_CATEGORY_KEY
  ) {
    return true;
  }
  if (typeof docOrData.payloadChunk === 'string' && docOrData.payloadChunk.length < 1024) {
    try {
      const parsed = JSON.parse(docOrData.payloadChunk);
      if (
        parsed &&
        typeof parsed === 'object' &&
        ('isPaused' in parsed || 'syncGeneration' in parsed) &&
        !('students' in parsed) &&
        !('groups' in parsed) &&
        !('lessons' in parsed) &&
        !('payments' in parsed)
      ) {
        return true;
      }
    } catch {
      // Ignore malformed JSON
    }
  }
  return false;
}

export function sanitizeDeviceIdForDocId(deviceId: string): string {
  const cleaned = String(deviceId || 'default_dev')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
  return cleaned || 'default_dev';
}

export function getDeviceDeltaDocId(deviceId: string): string {
  return `delta_log_${sanitizeDeviceIdForDocId(deviceId)}_chunk_0`;
}

const inMemoryOpSeqByKey = new Map<string, number>();

export function nextDeviceOperationMetadata(
  uid: string,
  deviceId: string,
  nowMs: number = Date.now()
): { opId: string; opSeq: number; deviceId: string; timestampMs: number } {
  const safeDev = sanitizeDeviceIdForDocId(deviceId);
  const storageKey = `gluck_cloud_op_seq_v2_${uid}_${safeDev}`;
  let currentSeq = inMemoryOpSeqByKey.get(storageKey) || 0;
  if (typeof window !== 'undefined') {
    try {
      const stored = parseInt(localStorage.getItem(storageKey) || '0', 10);
      if (!isNaN(stored) && stored > currentSeq) {
        currentSeq = stored;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  const nextSeq = currentSeq + 1;
  inMemoryOpSeqByKey.set(storageKey, nextSeq);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey, String(nextSeq));
    } catch {
      // Ignore storage quota errors
    }
  }
  const rand = Math.random().toString(36).substring(2, 8);
  const opId = `op_${safeDev}_${nextSeq}_${nowMs.toString(36)}_${rand}`;
  return {
    opId,
    opSeq: nextSeq,
    deviceId,
    timestampMs: nowMs
  };
}

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
  isQuotaExceeded?: boolean;
  rawDoc?: any;
}> {
  if (isFirestoreReadQuotaExhausted()) {
    return { isPaused: true, syncGeneration: '', isError: true, isQuotaExceeded: true };
  }
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
    const isQuota = isQuotaErrorLike(err);
    if (isQuota) {
      markFirestoreReadQuotaExhausted();
    }
    console.warn('Fail-safe: Failed to read cloud sync control state:', err);
    return { isPaused: true, syncGeneration: '', isError: true, isQuotaExceeded: isQuota };
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
    categoryKey: SYNC_CONTROL_CATEGORY_KEY,
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
    if (isFirestoreReadQuotaExhausted()) {
      await setDoc(targetDocRef, chunkObj);
      return;
    }
    try {
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
    } catch (txErr: any) {
      if (isQuotaErrorLike(txErr) && !isFirestoreWriteQuotaExhaustedToday()) {
        markFirestoreReadQuotaExhausted();
        await setDoc(targetDocRef, chunkObj);
        return;
      }
      throw txErr;
    }
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
  'dismissedDashboardLessons',
  'activeLessonSessionState'
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
  // Keep deletion tombstones in the cloud snapshot so every account can apply them.
  // The app import layer filters tombstones from the visible library after merge.
  const combined: any[] = [...incoming.filter((s) => s && !BUILTIN_LERNSTUDIO_MAP.has(s.id))];
  // Always attach built-in curriculum sets from the local app bundle
  for (const defSet of DEFAULT_LERNSTUDIO_SETS) {
    if (!defSet || !defSet.id) continue;
    combined.push(defSet);
  }
  return combined;
}

/**
 * Lernstudio custom sets are intentionally global across teacher accounts.
 * Only this collection is shared; teacher CRM, homework and finance remain in UID workspaces.
 */
const SHARED_SETS_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedSharedLernstudioSets: any[] | null = null;
let cachedSharedLernstudioSetsAtMs = 0;
let inFlightSharedSetsPromise: Promise<any[]> | null = null;

function invalidateSharedLernstudioSetsCache(): void {
  cachedSharedLernstudioSets = null;
  cachedSharedLernstudioSetsAtMs = 0;
}

async function readSharedLernstudioSets(options?: { forceRefresh?: boolean }): Promise<any[]> {
  if (
    !options?.forceRefresh &&
    cachedSharedLernstudioSets !== null &&
    Date.now() - cachedSharedLernstudioSetsAtMs < SHARED_SETS_CACHE_TTL_MS
  ) {
    return cachedSharedLernstudioSets;
  }
  if (isFirestoreReadQuotaExhausted()) {
    return cachedSharedLernstudioSets || [];
  }
  if (inFlightSharedSetsPromise) {
    return inFlightSharedSetsPromise;
  }

  inFlightSharedSetsPromise = (async () => {
    const snap = await getDocs(collection(db, 'lernstudio_sets'));
    const byId = new Map<string, any>();
    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      if (!data || typeof data.payloadJson !== 'string') return;
      try {
        const parsed = JSON.parse(data.payloadJson);
        if (!parsed || typeof parsed !== 'object' || !parsed.id) return;
        if (data.deleted === true || parsed.deleted === true) {
          byId.set(String(parsed.id), { ...parsed, deleted: true });
          return;
        }
        byId.set(String(parsed.id), parsed);
      } catch {
        // Ignore malformed shared set documents without affecting the teacher workspace.
      }
    });
    const list = Array.from(byId.values());
    cachedSharedLernstudioSets = list;
    cachedSharedLernstudioSetsAtMs = Date.now();
    return list;
  })().finally(() => {
    inFlightSharedSetsPromise = null;
  });

  return inFlightSharedSetsPromise;
}

function mergeSharedLernstudioSets(localSets: any[], sharedSets: any[]): any[] {
  const byId = new Map<string, any>();
  for (const set of Array.isArray(localSets) ? localSets : []) {
    if (set && set.id && !BUILTIN_LERNSTUDIO_MAP.has(set.id)) byId.set(String(set.id), set);
  }
  for (const set of Array.isArray(sharedSets) ? sharedSets : []) {
    if (!set || !set.id || BUILTIN_LERNSTUDIO_MAP.has(set.id)) continue;
    const id = String(set.id);
    const local = byId.get(id);
    const localTime = Number(local?.updatedAt) || Date.parse(local?.updatedAtIso || '') || 0;
    const sharedTime = Number(set.updatedAt) || Date.parse(set.updatedAtIso || '') || 0;
    const creatorName = set.createdByTeacherName?.trim() || local?.createdByTeacherName?.trim() || undefined;
    const creatorUid = set.createdByUid?.trim() || local?.createdByUid?.trim() || undefined;
    if (!local || sharedTime >= localTime) {
      byId.set(id, {
        ...set,
        ...(creatorName ? { createdByTeacherName: creatorName } : {}),
        ...(creatorUid ? { createdByUid: creatorUid } : {})
      });
    } else if (local && (creatorName || creatorUid)) {
      byId.set(id, {
        ...local,
        ...(creatorName ? { createdByTeacherName: creatorName } : {}),
        ...(creatorUid ? { createdByUid: creatorUid } : {})
      });
    }
  }
  return Array.from(byId.values()).filter((set) => !set.deleted);
}

async function writeSharedLernstudioSetChanges(changedSets: any[]): Promise<void> {
  const unique = new Map<string, any>();
  for (const set of Array.isArray(changedSets) ? changedSets : []) {
    if (set && typeof set.id === 'string' && set.id.trim()) unique.set(set.id, set);
  }
  for (const [id, set] of unique) {
    if (BUILTIN_LERNSTUDIO_MAP.has(id)) continue;
    const target = doc(db, 'lernstudio_sets', id);
    const localTime = Number(set.updatedAt) || Date.parse(set.updatedAtIso || '') || Date.now();
    const deleted = set.deleted === true;

    // Transactional read/compare/write prevents a slower device from overwriting a newer shared edit
    // and guarantees createdByTeacherName / createdByUid remain permanently fixed on the set.
    await executeSafeFirestoreWrite(() => runTransaction(db, async (transaction) => {
      const existingSnap = await transaction.get(target);
      let existingSet: any = null;
      let existingData: any = null;
      if (existingSnap.exists()) {
        existingData = existingSnap.data();
        try {
          existingSet = existingData?.payloadJson ? JSON.parse(existingData.payloadJson) : null;
        } catch {
          existingSet = null;
        }
        const remoteTime = Number(existingSet?.updatedAt) || Date.parse(existingData?.updatedAtIso || '') || 0;
        if (remoteTime > localTime) return;
      }

      const payloadSet: any = { ...set };
      delete payloadSet.ownerUid;
      delete payloadSet.ownerEmail;
      if (!payloadSet.createdByTeacherName && existingSet?.createdByTeacherName) {
        payloadSet.createdByTeacherName = existingSet.createdByTeacherName;
      }
      if (!payloadSet.createdByUid && existingSet?.createdByUid) {
        payloadSet.createdByUid = existingSet.createdByUid;
      }

      const payload = JSON.stringify(payloadSet);
      if (payload.length > 500000) {
        throw new Error(`Lernstudio set "${id}" exceeds the shared Firestore document size limit.`);
      }
      if (existingData && existingData.payloadJson === payload && Boolean(existingData.deleted) === deleted) {
        return;
      }

      const docData: any = {
        id,
        title: String(set.title || (deleted ? 'Deleted set' : 'Untitled set')).slice(0, 120),
        payloadJson: payload,
        updatedAtIso: new Date(localTime).toISOString(),
        ...(typeof set.category === 'string' ? { category: set.category.slice(0, 45) } : {}),
        ...(deleted ? { deleted: true } : {})
      };
      transaction.set(target, docData);
    }));
  }
  invalidateSharedLernstudioSetsCache();
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

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
  } catch {
    return false;
  }
}

function loadWatermarks(uid: string): Record<string, string> {
  if (!hasLocalStorage()) return {};
  try {
    const raw = localStorage.getItem(`gluck_cloud_watermarks_v2_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWatermarks(uid: string, watermarks: Record<string, string>): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(`gluck_cloud_watermarks_v2_${uid}`, JSON.stringify(watermarks));
  } catch {
    // Ignore storage quota errors
  }
}

function loadDeltaAccumulator(uid: string): Record<string, any> {
  if (!hasLocalStorage()) return {};
  try {
    const raw = localStorage.getItem(`gluck_cloud_delta_acc_v2_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDeltaAccumulator(uid: string, acc: Record<string, any>): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(`gluck_cloud_delta_acc_v2_${uid}`, JSON.stringify(acc));
  } catch {
    // Ignore
  }
}

const inMemoryEntityBaselineByUid = new Map<string, Record<string, any>>();

function loadEntitySnapshots(uid: string): Record<string, any> {
  return inMemoryEntityBaselineByUid.get(uid) || {};
}

function saveEntitySnapshots(uid: string, snapshots: Record<string, any>): void {
  inMemoryEntityBaselineByUid.set(uid, snapshots);
}

const inMemoryAppliedDocTokensByUid = new Map<string, Map<string, string>>();
const inMemoryLocalWrittenDocTokensByUid = new Map<string, Map<string, string>>();
let acknowledgeStorageFailureForTests = false;

export function __setAcknowledgeStorageFailureForTests(shouldFail: boolean): void {
  acknowledgeStorageFailureForTests = shouldFail;
}

function getAppliedDocTokensMap(uid: string): Map<string, string> {
  let map = inMemoryAppliedDocTokensByUid.get(uid);
  if (!map) {
    map = new Map<string, string>();
    if (hasLocalStorage()) {
      try {
        const raw = localStorage.getItem(`gluck_cloud_applied_tokens_v2_${uid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === 'string') map.set(k, v);
            }
          }
        }
      } catch {
        // Ignore
      }
    }
    inMemoryAppliedDocTokensByUid.set(uid, map);
  }
  return map;
}

function persistAppliedDocTokensMap(uid: string, map: Map<string, string>): boolean {
  if (acknowledgeStorageFailureForTests) {
    return false;
  }
  if (!uid) return false;

  const obj: Record<string, string> = {};
  map.forEach((v, k) => {
    obj[k] = v;
  });
  const serialized = JSON.stringify(obj);

  let persisted = false;
  if (hasLocalStorage()) {
    try {
      const storageKey = `gluck_cloud_applied_tokens_v2_${uid}`;
      localStorage.setItem(storageKey, serialized);
      const readBack = localStorage.getItem(storageKey);
      if (readBack === serialized) {
        persisted = true;
      }
    } catch {
      persisted = false;
    }
  }

  if (!persisted) {
    // Never treat an in-memory-only map as durable acknowledgement
    return false;
  }

  inMemoryAppliedDocTokensByUid.set(uid, new Map(map));
  return true;
}

export function getAppliedDocTokens(uid: string): Record<string, string> {
  const map = getAppliedDocTokensMap(uid);
  const out: Record<string, string> = {};
  map.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export function resetAppliedDocTokensForTests(uid: string): void {
  inMemoryAppliedDocTokensByUid.delete(uid);
  inMemoryLocalWrittenDocTokensByUid.delete(uid);
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(`gluck_cloud_applied_tokens_v2_${uid}`);
    } catch {
      // Ignore
    }
  }
}

function getLocalWrittenDocTokensMap(uid: string): Map<string, string> {
  let map = inMemoryLocalWrittenDocTokensByUid.get(uid);
  if (!map) {
    map = new Map<string, string>();
    inMemoryLocalWrittenDocTokensByUid.set(uid, map);
  }
  return map;
}

export interface ParsedChunkRevisionToken {
  id: string;
  categoryKey: string;
  deviceId: string;
  opId: string;
  opSeq: number | null;
  payloadDigest: string;
  updatedAtMs: number | null;
}

/**
 * Computes a deterministic, clock-skew-safe revision token for a workspace chunk document.
 * Incorporates document ID, categoryKey, deviceId, operation ID / sequence (if present), payload digest, and updatedAtMs.
 */
export function computeChunkRevisionToken(docData: any): string {
  if (!docData || typeof docData !== 'object') return '';
  const id = String(docData.id || '');
  const categoryKey = String(docData.categoryKey || '');
  const deviceId = String(docData.deviceId || '');
  const payloadStr = typeof docData.payloadChunk === 'string' ? docData.payloadChunk : '';
  const payloadDigest = fastHash(payloadStr);

  let opId = typeof docData.opId === 'string' ? docData.opId : '';
  let opSeq = typeof docData.opSeq === 'number' ? String(docData.opSeq) : '';
  if (!opId && categoryKey === 'delta_log' && payloadStr.length > 0 && payloadStr.length < 300000) {
    try {
      const parsed = JSON.parse(payloadStr);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.opId === 'string') opId = parsed.opId;
        if (typeof parsed.opSeq === 'number') opSeq = String(parsed.opSeq);
      }
    } catch {
      // Ignore
    }
  }

  const updatedAtMsStr =
    typeof docData.updatedAtMs === 'number' && Number.isFinite(docData.updatedAtMs)
      ? String(docData.updatedAtMs)
      : '';

  return `${id}|${categoryKey}|${deviceId}|${opId}|${opSeq}|${payloadDigest}|${updatedAtMsStr}`;
}

export function parseChunkRevisionToken(token: string): ParsedChunkRevisionToken {
  const parts = (token || '').split('|');
  const id = parts[0] || '';
  const categoryKey = parts[1] || '';
  const deviceId = parts[2] || '';
  const opId = parts[3] || '';
  const rawSeq = parts[4] || '';
  const payloadDigest = parts[5] || '';
  const rawUpdatedAt = parts[6] || '';

  let opSeq: number | null = rawSeq !== '' && Number.isFinite(Number(rawSeq)) ? Number(rawSeq) : null;
  if (opSeq === null && opId) {
    const m = opId.match(/_(\d+)$/);
    if (m) {
      opSeq = Number(m[1]);
    }
  }
  const updatedAtMs: number | null =
    rawUpdatedAt !== '' && Number.isFinite(Number(rawUpdatedAt)) ? Number(rawUpdatedAt) : null;

  return {
    id,
    categoryKey,
    deviceId,
    opId,
    opSeq,
    payloadDigest,
    updatedAtMs
  };
}

/**
 * Returns true if `candidateToken` is strictly older than `existingToken` for the same document.
 * Prevents an older delayed/retried snapshot from overwriting a newer acknowledged revision.
 */
export function isCandidateTokenOlderThanExisting(
  existingToken: string,
  candidateToken: string
): boolean {
  if (!existingToken || !candidateToken || existingToken === candidateToken) return false;
  const existing = parseChunkRevisionToken(existingToken);
  const candidate = parseChunkRevisionToken(candidateToken);

  if (existing.opSeq !== null && candidate.opSeq !== null) {
    if (candidate.opSeq < existing.opSeq) return true;
    if (candidate.opSeq > existing.opSeq) return false;
  }

  if (
    existing.opSeq === null &&
    candidate.opSeq === null &&
    existing.updatedAtMs !== null &&
    candidate.updatedAtMs !== null
  ) {
    if (candidate.updatedAtMs < existing.updatedAtMs) return true;
    if (candidate.updatedAtMs > existing.updatedAtMs) return false;
  }

  return false;
}

export function extractDocTokensFromBackupJson(backupJsonStr: string | null | undefined): {
  workspaceId?: string;
  docTokens?: Record<string, string>;
} {
  if (!backupJsonStr || typeof backupJsonStr !== 'string') return {};
  try {
    const parsed = JSON.parse(backupJsonStr);
    if (!parsed || typeof parsed !== 'object') return {};
    const docTokens =
      parsed._cloudDocTokens && typeof parsed._cloudDocTokens === 'object'
        ? (parsed._cloudDocTokens as Record<string, string>)
        : undefined;
    const workspaceId =
      typeof parsed._cloudWorkspaceId === 'string' ? parsed._cloudWorkspaceId : undefined;
    return { workspaceId, docTokens };
  } catch {
    return {};
  }
}

/**
 * Explicitly acknowledges remote document revisions ONLY after local import and durable storage persistence have succeeded.
 * - Never overwrites a newer acknowledged revision with an older revision token.
 * - Verifies durable storage write of appliedDocTokens before returning true.
 * - Updates local watermarks and chunk caches only after appliedDocTokens persistence succeeds.
 */
export function acknowledgeAppliedRemoteRevisions(
  uid: string,
  docTokens: Record<string, string> | undefined | null,
  appliedWorkspaceData?: any
): boolean {
  if (!uid || !docTokens || typeof docTokens !== 'object') {
    return false;
  }
  const entries = Object.entries(docTokens).filter(
    ([docId, token]) => Boolean(docId) && typeof token === 'string' && token.length > 0
  );
  if (entries.length === 0) {
    return true;
  }

  const currentMap = new Map(getAppliedDocTokensMap(uid));
  for (const [docId, candidateToken] of entries) {
    const existingToken = currentMap.get(docId);
    if (existingToken && isCandidateTokenOlderThanExisting(existingToken, candidateToken)) {
      // Protect newer acknowledged revision against older snapshot overwrite
      continue;
    }
    currentMap.set(docId, candidateToken);
  }

  const persisted = persistAppliedDocTokensMap(uid, currentMap);
  if (!persisted) {
    return false;
  }

  if (appliedWorkspaceData) {
    try {
      const parsedData =
        typeof appliedWorkspaceData === 'string'
          ? JSON.parse(appliedWorkspaceData)
          : appliedWorkspaceData;
      if (parsedData && typeof parsedData === 'object') {
        seedWatermarksFromData(uid, parsedData);
      }
    } catch {
      // Watermark seeding is secondary to token acknowledgement
    }
  }

  return true;
}

function recordLocalWrittenChunk(uid: string, chunkObj: any): void {
  if (!uid || !chunkObj || !chunkObj.id) return;
  const token = computeChunkRevisionToken(chunkObj);
  if (!token) return;
  const localWritten = getLocalWrittenDocTokensMap(uid);
  localWritten.set(chunkObj.id, token);
  const applied = new Map(getAppliedDocTokensMap(uid));
  applied.set(chunkObj.id, token);
  persistAppliedDocTokensMap(uid, applied);
}

/**
 * Evaluates incoming Firestore snapshot documents without relying on `lastLocalPushTimestampMs + 1500`
 * or wall-clock comparisons that fail under clock skew or rapid cross-device updates.
 * - Strictly ignores `sync_control` documents.
 * - Suppresses exact duplicate snapshots already applied locally (`appliedDocTokens`).
 * - Suppresses older snapshots whose revision is strictly older than an already-acknowledged revision.
 * - Suppresses exact self-written echoes (`localWrittenDocTokens`).
 * - Accepts any unapplied remote document change regardless of device clock skew, <1500ms timing, or out-of-order arrival.
 */
export function evaluateRemoteSnapshotChanges(
  docs: any[],
  options: {
    localDeviceId: string;
    appliedDocTokens: Map<string, string> | Record<string, string>;
    localWrittenDocTokens?: Map<string, string> | Record<string, string>;
  }
): {
  shouldProcess: boolean;
  unappliedDocIds: string[];
  nextDocTokens: Record<string, string>;
  maxRemoteUpdatedAtMs: number;
} {
  const appliedMap =
    options.appliedDocTokens instanceof Map
      ? options.appliedDocTokens
      : new Map<string, string>(Object.entries(options.appliedDocTokens || {}));
  const localWrittenMap =
    options.localWrittenDocTokens instanceof Map
      ? options.localWrittenDocTokens
      : new Map<string, string>(Object.entries(options.localWrittenDocTokens || {}));

  const unappliedDocIds: string[] = [];
  const nextDocTokens: Record<string, string> = {};
  appliedMap.forEach((v, k) => {
    nextDocTokens[k] = v;
  });

  let maxRemoteUpdatedAtMs = 0;
  const safeDocs = Array.isArray(docs) ? docs : [];

  for (const d of safeDocs) {
    if (!d || typeof d !== 'object' || !d.id) continue;
    if (isSyncControlDocument(d)) continue;

    const token = computeChunkRevisionToken(d);
    if (!token) continue;

    const docUpdatedAt = typeof d.updatedAtMs === 'number' ? d.updatedAtMs : 0;
    if (docUpdatedAt > maxRemoteUpdatedAtMs) {
      maxRemoteUpdatedAtMs = docUpdatedAt;
    }

    const prevAppliedToken = appliedMap.get(d.id);
    if (prevAppliedToken === token) {
      // Exact document revision already applied locally (idempotent duplicate suppression)
      nextDocTokens[d.id] = token;
      continue;
    }

    if (prevAppliedToken && isCandidateTokenOlderThanExisting(prevAppliedToken, token)) {
      // Incoming document revision is strictly older than the already-acknowledged revision
      nextDocTokens[d.id] = prevAppliedToken;
      continue;
    }

    const localWrittenToken = localWrittenMap.get(d.id);
    if (d.deviceId && d.deviceId === options.localDeviceId && localWrittenToken === token) {
      // Exact document revision written by this local device instance
      nextDocTokens[d.id] = token;
      continue;
    }

    // Genuine unapplied remote change (clock-skew-safe: accepted even if docUpdatedAt < local clock!)
    nextDocTokens[d.id] = token;
    unappliedDocIds.push(String(d.id));
  }

  return {
    shouldProcess: unappliedDocIds.length > 0,
    unappliedDocIds,
    nextDocTokens,
    maxRemoteUpdatedAtMs
  };
}

/**
 * Computes P2P-style record-level delta between current state and last synced watermarks.
 */
export function computeWorkspaceDelta(
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
  const prevEntitySnapshots = loadEntitySnapshots(uid);
  const nextEntitySnapshots: Record<string, any> = {};
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
        : colKey === 'homeworkAssignments' || colKey === 'homeworkSubmissions'
        ? (Array.isArray(sanitizedData[colKey]) ? sanitizedData[colKey] : [])
            .filter((rec: any) => rec && (!rec.ownerUid || String(rec.ownerUid).trim() === '' || String(rec.ownerUid).trim() === uid))
            .map((rec: any) => ({ ...rec, ownerUid: uid }))
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
        const prevItem = prevEntitySnapshots[wmKey];
        const stampedItem = prevItem ? stampFieldTimestamps(prevItem, item, nowMs) : item;
        nextEntitySnapshots[wmKey] = stampedItem;
        colChanged.push(stampedItem);
        totalChangedCount++;
      } else {
        nextEntitySnapshots[wmKey] = prevEntitySnapshots[wmKey] || item;
      }
    }

    // Detect records that existed in prevWatermarks for this collection but were hard-deleted locally.
    // Homework assignments & submissions have their own dedicated Firestore collections and explicit
    // deletion lifecycle — never synthesize { deleted: true, version: 999 } watermark tombstones for them,
    // since local scope truncation or unhydrated auth state on another device would poison active cloud homework.
    if (colKey !== 'homeworkAssignments' && colKey !== 'homeworkSubmissions') {
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

  saveEntitySnapshots(uid, nextEntitySnapshots);

  return {
    changedEntities,
    changedSingletons,
    nextWatermarks,
    totalChangedCount,
    hasBaselineSeeded
  };
}

export function seedWatermarksFromData(uid: string, rawData: any): void {
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

function splitStringIntoChunks(str: string, maxChars: number): string[] {
  if (!str || str.length <= maxChars) return [str || '{}'];
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += maxChars) {
    chunks.push(str.slice(i, i + maxChars));
  }
  return chunks;
}

function partitionBackupPayload(fullData: any, ownerUid?: string): Record<Exclude<WorkspaceCategoryKey, 'delta_log'>, any> {
  const filterHomeworkForOwner = (items: any[]) => {
    if (!Array.isArray(items)) return [];
    if (!ownerUid) return items;
    return items
      .filter((rec: any) => rec && (!rec.ownerUid || String(rec.ownerUid).trim() === '' || String(rec.ownerUid).trim() === ownerUid))
      .map((rec: any) => ({ ...rec, ownerUid }));
  };
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
      dismissedDashboardLessons: fullData.dismissedDashboardLessons || [],
      ...(fullData.activeLessonSessionState !== undefined ? { activeLessonSessionState: fullData.activeLessonSessionState } : {})
    },
    lernstudio_data: {
      lernstudioSets: filterCustomOrModifiedLernstudioSets(fullData.lernstudioSets || []),
      homeworkAssignments: filterHomeworkForOwner(fullData.homeworkAssignments || []),
      homeworkSubmissions: filterHomeworkForOwner(fullData.homeworkSubmissions || []),
      pickerNames: fullData.pickerNames || []
    }
  };
}

const lastUploadedChunkCache = new Map<string, string>();
const lastUploadedChunkCount = new Map<string, number>();

function getRelayEndpointUrls(pathAndQuery: string): string[] {
  const vercelBase = (getVercelPublicDomain() || DEFAULT_VERCEL_DOMAIN).replace(/\/+$/, '');
  const remoteUrl = `${vercelBase}${pathAndQuery}`;
  if (typeof window === 'undefined') {
    return [remoteUrl];
  }
  const host = (window.location?.hostname || '').toLowerCase();
  const proto = (window.location?.protocol || '').toLowerCase();
  const isNativeOrLocal =
    isAndroidNativePlatform() ||
    proto === 'capacitor:' ||
    proto === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1';

  if (isNativeOrLocal) {
    return [remoteUrl, pathAndQuery];
  }
  const currentOrigin = (window.location?.origin || '').replace(/\/+$/, '');
  if (currentOrigin && currentOrigin !== vercelBase) {
    return [pathAndQuery, remoteUrl];
  }
  return [pathAndQuery];
}

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
    const bodyStr = JSON.stringify({ workspaceId, chunks });
    const urls = getRelayEndpointUrls('/api/workspace/delta');
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: authHeaders,
          body: bodyStr
        });
        if (res.ok) {
          return true;
        }
      } catch {
        // Try next candidate URL
      }
    }
    return false;
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
    const urls = getRelayEndpointUrls(
      `/api/workspace/delta?workspaceId=${encodeURIComponent(workspaceId)}`
    );
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data?.docs)) {
          return data.docs;
        }
      } catch {
        // Try next candidate URL
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Concurrency-safe merger for two delta payloads (e.g. existing remote delta document + incoming delta).
 * Ensures neither device's incremental mutations, tombstones, or operation records are ever lost.
 * Idempotent: if `incomingDelta.opId` is already present in `existingDelta.appliedOpIds`, returns `existingDelta` unchanged.
 */
export function mergeDeltaPayloads(existingDelta: any, incomingDelta: any): any {
  if (!existingDelta || typeof existingDelta !== 'object' || Object.keys(existingDelta).length === 0) {
    if (!incomingDelta || typeof incomingDelta !== 'object') return {};
    const opIds = Array.from(
      new Set([
        ...(Array.isArray(incomingDelta.appliedOpIds) ? incomingDelta.appliedOpIds : []),
        ...(typeof incomingDelta.opId === 'string' && incomingDelta.opId ? [incomingDelta.opId] : [])
      ])
    ).slice(-200);
    return {
      ...incomingDelta,
      isCloudDelta: true,
      appliedOpIds: opIds
    };
  }
  if (!incomingDelta || typeof incomingDelta !== 'object' || Object.keys(incomingDelta).length === 0) {
    return existingDelta;
  }

  const existingOpIds: string[] = Array.isArray(existingDelta.appliedOpIds)
    ? existingDelta.appliedOpIds
    : typeof existingDelta.opId === 'string' && existingDelta.opId
    ? [existingDelta.opId]
    : [];

  // Idempotent guard: if this exact operation ID was already merged into the delta log, do not re-apply
  if (
    typeof incomingDelta.opId === 'string' &&
    incomingDelta.opId &&
    existingOpIds.includes(incomingDelta.opId)
  ) {
    return existingDelta;
  }

  const baseClone = JSON.parse(JSON.stringify(existingDelta));
  applyDeltaOnWorkspace(baseClone, incomingDelta);

  const combinedOpIds = Array.from(
    new Set([
      ...existingOpIds,
      ...(Array.isArray(incomingDelta.appliedOpIds) ? incomingDelta.appliedOpIds : []),
      ...(typeof incomingDelta.opId === 'string' && incomingDelta.opId ? [incomingDelta.opId] : [])
    ])
  ).slice(-200);

  const existingOps = Array.isArray(existingDelta.operations) ? existingDelta.operations : [];
  const incomingOps = Array.isArray(incomingDelta.operations) ? incomingDelta.operations : [];
  const opsById = new Map<string, any>();
  for (const op of [...existingOps, ...incomingOps]) {
    if (op && typeof op.opId === 'string' && op.opId) {
      opsById.set(op.opId, op);
    }
  }

  const maxUpdatedAtMs = Math.max(
    Number(existingDelta.updatedAtMs) || 0,
    Number(incomingDelta.updatedAtMs) || 0,
    Date.now()
  );

  baseClone.isCloudDelta = true;
  baseClone.updatedAtMs = maxUpdatedAtMs;
  baseClone.updatedAtIso = incomingDelta.updatedAtIso || new Date(maxUpdatedAtMs).toISOString();
  baseClone.deviceId = incomingDelta.deviceId || existingDelta.deviceId;
  baseClone.opId = incomingDelta.opId || existingDelta.opId;
  baseClone.opSeq = Math.max(Number(existingDelta.opSeq) || 0, Number(incomingDelta.opSeq) || 0);
  baseClone.appliedOpIds = combinedOpIds;
  baseClone.operations = Array.from(opsById.values()).slice(-100);

  return baseClone;
}

/**
 * Executes a concurrency-safe transactional read-merge-write for a delta document.
 * Reads any existing remote delta document inside the Firestore transaction, merges the incoming
 * delta payload with the remote delta state via `mergeDeltaPayloads`, validates the sync generation,
 * and commits atomically so concurrent Android & Vercel delta writes can never overwrite each other.
 */
export async function executeTransactionalDeltaWrite(
  workspaceId: string,
  expectedGeneration: string,
  deltaDocId: string,
  localDeltaObj: any,
  ownerFields: Record<string, any>
): Promise<{ chunkObj: any; mergedDelta: any }> {
  const controlDocRef = doc(db, 'user_workspaces', workspaceId, 'categories', SYNC_CONTROL_DOC_ID);
  const targetDocRef = doc(db, 'user_workspaces', workspaceId, 'categories', deltaDocId);

  let committedChunkObj: any = null;
  let committedMergedDelta: any = localDeltaObj;

  const buildDirectDeltaChunk = (deltaToWrite: any) => {
    const mergedDelta = mergeDeltaPayloads({}, deltaToWrite);
    const mergedPayloadStr = JSON.stringify(mergedDelta);
    if (mergedPayloadStr.length > CHUNK_MAX_CHARS) {
      throw new Error('DELTA_COMPACTION_REQUIRED: Merged delta exceeds single-chunk threshold.');
    }
    const nowMs = Number(mergedDelta.updatedAtMs) || Date.now();
    const nowIso = mergedDelta.updatedAtIso || new Date(nowMs).toISOString();
    const chunkObj = {
      id: deltaDocId,
      categoryKey: 'delta_log',
      chunkIndex: 0,
      totalChunks: 1,
      updatedAtMs: nowMs,
      updatedAtIso: nowIso,
      deviceId: String(localDeltaObj.deviceId || mergedDelta.deviceId || 'default_dev'),
      payloadChunk: mergedPayloadStr,
      ...ownerFields
    };
    return { chunkObj, mergedDelta };
  };

  await executeSafeFirestoreWrite(async () => {
    // Since deltaDocId (`delta_log_<deviceId>_chunk_0`) is already strictly per-device,
    // if Firestore read quota is on cooldown we can safely commit with a 0-read `setDoc`!
    if (isFirestoreReadQuotaExhausted()) {
      const { chunkObj, mergedDelta } = buildDirectDeltaChunk(localDeltaObj);
      await setDoc(targetDocRef, chunkObj);
      committedChunkObj = chunkObj;
      committedMergedDelta = mergedDelta;
      return;
    }

    try {
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

        const existingSnap = await transaction.get(targetDocRef);
        let existingDeltaObj: any = null;
        if (existingSnap.exists()) {
          const existingData = existingSnap.data();
          if (existingData && typeof existingData.payloadChunk === 'string') {
            try {
              existingDeltaObj = JSON.parse(existingData.payloadChunk);
            } catch {
              existingDeltaObj = null;
            }
          }
        }

        const mergedDelta = existingDeltaObj
          ? mergeDeltaPayloads(existingDeltaObj, localDeltaObj)
          : mergeDeltaPayloads({}, localDeltaObj);

        const mergedPayloadStr = JSON.stringify(mergedDelta);
        if (mergedPayloadStr.length > CHUNK_MAX_CHARS) {
          throw new Error('DELTA_COMPACTION_REQUIRED: Merged delta exceeds single-chunk threshold.');
        }

        const nowMs = Number(mergedDelta.updatedAtMs) || Date.now();
        const nowIso = mergedDelta.updatedAtIso || new Date(nowMs).toISOString();
        const chunkObj = {
          id: deltaDocId,
          categoryKey: 'delta_log',
          chunkIndex: 0,
          totalChunks: 1,
          updatedAtMs: nowMs,
          updatedAtIso: nowIso,
          deviceId: String(localDeltaObj.deviceId || mergedDelta.deviceId || 'default_dev'),
          payloadChunk: mergedPayloadStr,
          ...ownerFields
        };

        transaction.set(targetDocRef, chunkObj);
        committedChunkObj = chunkObj;
        committedMergedDelta = mergedDelta;
      });
    } catch (txErr: any) {
      if (isQuotaErrorLike(txErr) && !isFirestoreWriteQuotaExhaustedToday()) {
        markFirestoreReadQuotaExhausted();
        const { chunkObj, mergedDelta } = buildDirectDeltaChunk(localDeltaObj);
        await setDoc(targetDocRef, chunkObj);
        committedChunkObj = chunkObj;
        committedMergedDelta = mergedDelta;
        return;
      }
      throw txErr;
    }
  });

  return {
    chunkObj: committedChunkObj,
    mergedDelta: committedMergedDelta
  };
}

/**
 * P2P-Style Delta Sync to Google Cloud Firestore (`/user_workspaces/{uid}/categories/{docId}`).
 * Sends ONLY the records that changed since the last sync!
 */
export async function uploadWorkspaceToGoogleCloud(
  backupJsonStr: string,
  options?: { isManual?: boolean; forceFullBaseline?: boolean }
): Promise<{ success: boolean; syncedAtIso: string; deltaCount?: number; opId?: string; error?: string }> {
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

  try {
    // Check Cloud-side pause and generation marker first (cross-device protection)
    const controlState = await getCloudSyncControlState(uid);
    if (controlState.isQuotaExceeded) {
      // Read quota cooldown should not block write-only delta uploads + relay pushes
      controlState.isPaused = false;
      controlState.syncGeneration = getLocalActiveGeneration() || 'gen_initial';
    }
    if (controlState.isPaused) {
      if (options?.isManual && !controlState.isError) {
        const reactRes = await reactivateCloudSync(uid);
        if (reactRes.success) {
          controlState.isPaused = false;
          controlState.syncGeneration = reactRes.newGeneration;
        }
      }
      if (controlState.isPaused) {
        return {
          success: false,
          syncedAtIso: nowIso,
          error: 'Cloud synchronization is currently paused for this workspace. Use explicit manual reactivation.'
        };
      }
    }
    const localActiveGen = getLocalActiveGeneration();
    if (localActiveGen && controlState.syncGeneration && localActiveGen !== controlState.syncGeneration) {
      if (options?.isManual) {
        setLocalActiveGeneration(controlState.syncGeneration);
      } else {
        return {
          success: false,
          syncedAtIso: nowIso,
          error: 'Stale sync generation detected. Cloud workspace generation mismatch. Sync paused for safety.'
        };
      }
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

    // Keep the shared Lernstudio library independent from each teacher's private workspace.
    // Only write when Lernstudio sets actually changed (or on initial baseline seed), and never allow
    // a shared-collection read/write error to block private lesson/workspace synchronization.
    const changedLernstudioSets = Array.isArray(changedEntities.lernstudioSets)
      ? changedEntities.lernstudioSets
      : [];
    const sharedSetChanges =
      !hasBaselineSeeded || options?.forceFullBaseline
        ? [
            ...filterCustomOrModifiedLernstudioSets(parsed.lernstudioSets || []),
            ...changedLernstudioSets.filter((s: any) => s?.deleted)
          ]
        : [
            ...filterCustomOrModifiedLernstudioSets(changedLernstudioSets),
            ...changedLernstudioSets.filter((s: any) => s?.deleted)
          ];
    if (sharedSetChanges.length > 0 && !isFirestoreReadQuotaExhausted()) {
      try {
        await writeSharedLernstudioSetChanges(sharedSetChanges);
      } catch (sharedErr) {
        console.warn('Non-fatal shared Lernstudio sync warning:', sharedErr);
      }
    }

    // If nothing changed at all since last sync, perform 0 network writes!
    if (hasBaselineSeeded && !options?.forceFullBaseline && totalChangedCount === 0) {
      setLastCloudSyncTime(nowIso);
      return { success: true, syncedAtIso: nowIso, deltaCount: 0 };
    }

    const opMeta = nextDeviceOperationMetadata(uid, deviceId, nowMs);

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
        deviceId,
        opId: opMeta.opId,
        opSeq: opMeta.opSeq
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
        } else if (sKey === 'profile' && nextAcc.profile && sVal) {
          nextAcc.profile = { ...nextAcc.profile, ...sVal };
        } else {
          nextAcc[sKey] = sVal;
        }
      }

      // Merge changed entities into the rolling delta accumulator and sweep purged items so purged records cannot linger in nextAcc
      const accPurged = nextAcc.recentlyDeleted?.purgedRecords || parsed.recentlyDeleted?.purgedRecords || [];
      for (const [colKey, deltaItems] of Object.entries(changedEntities)) {
        const existingDeltaItems = Array.isArray(nextAcc[colKey]) ? nextAcc[colKey] : [];
        nextAcc[colKey] = mergeEntities(existingDeltaItems, deltaItems, {
          entityTypeName: colKey,
          purgedRecords: accPurged
        }).merged;
      }

      const prevOps = Array.isArray(nextAcc.operations) ? nextAcc.operations : [];
      nextAcc.operations = [
        ...prevOps.slice(-99),
        {
          opId: opMeta.opId,
          opSeq: opMeta.opSeq,
          deviceId,
          timestampMs: nowMs,
          entityKeys: Object.keys(changedEntities),
          singletonKeys: Object.keys(changedSingletons)
        }
      ];
      const prevAppliedOpIds = Array.isArray(nextAcc.appliedOpIds) ? nextAcc.appliedOpIds : [];
      nextAcc.appliedOpIds = Array.from(new Set([...prevAppliedOpIds, opMeta.opId])).slice(-200);

      // Sweep any pre-existing entity arrays in the rolling delta accumulator against current tombstones
      enforcePurgedTombstonesOnWorkspace(nextAcc, accPurged);

      const deltaPayloadStr = JSON.stringify(nextAcc);

      // If compact delta fits comfortably in a single fast packet (<180KB), write ONLY 1 per-device delta doc transactionally!
      if (deltaPayloadStr.length <= DELTA_MAX_COMPACT_CHARS) {
        const docId = getDeviceDeltaDocId(deviceId);

        if (isFirestoreWriteQuotaExhaustedToday()) {
          return {
            success: false,
            syncedAtIso: nowIso,
            error: 'Quota exceeded: تم بلوغ الحد اليومي المجاني لكتابة Firestore، ستُستأنف المزامنة تلقائياً.'
          };
        }

        try {
          // CONFIRM FIRESTORE WRITE FIRST with Transactional Read-Merge-Write & Server-Enforced Generation Validation
          const { chunkObj, mergedDelta } = await executeTransactionalDeltaWrite(
            uid,
            targetGeneration,
            docId,
            nextAcc,
            ownerFields
          );

          recordLocalWrittenChunk(uid, chunkObj);

          // ONLY post to Relay cache after Firestore write is confirmed
          await postChunksToRelayServer(uid, [chunkObj]);

          saveDeltaAccumulator(uid, mergedDelta);
          saveWatermarks(uid, nextWatermarks);
          setLastCloudSyncTime(nowIso);
          return {
            success: true,
            syncedAtIso: nowIso,
            deltaCount: totalChangedCount,
            opId: opMeta.opId
          };
        } catch (txErr: any) {
          const txMsg = txErr?.message || '';
          // If merged delta exceeded single chunk size, fall through to full category baseline compaction
          if (!txMsg.includes('DELTA_COMPACTION_REQUIRED')) {
            throw txErr;
          }
        }
      }
    }

    // 3. Category-Level Sync (Initial baseline seed or when delta accumulator compacts into categories)
    const categories = partitionBackupPayload(parsed, uid);
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
        recordLocalWrittenChunk(uid, chunkObj);
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

    // Safely clean up THIS device's own delta document after its state has been folded into baseline categories
    const ownDeltaDocId = getDeviceDeltaDocId(deviceId);
    await executeGenerationGuardedDelete(uid, targetGeneration, ownDeltaDocId).catch(() => {});

    if (relayChunks.length > 0) {
      await postChunksToRelayServer(uid, relayChunks);
    }

    // Reset rolling delta accumulator and watermarks ONLY after confirmed category compaction
    saveDeltaAccumulator(uid, {});
    saveWatermarks(uid, nextWatermarks);
    setLastCloudSyncTime(nowIso);
    return {
      success: true,
      syncedAtIso: nowIso,
      deltaCount: totalChangedCount,
      opId: opMeta.opId
    };
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
 * Strictly ignores any `sync_control` documents so control state never contaminates user data.
 */
function reassembleCategoryChunks(chunkDocs: any[]): any | null {
  if (!Array.isArray(chunkDocs) || chunkDocs.length === 0) return null;

  const validDocs = chunkDocs.filter((docData) => docData && !isSyncControlDocument(docData));
  if (validDocs.length === 0) return null;

  const newestByIndex = new Map<number, any>();
  let latestHeaderDoc: any = null;

  for (const docData of validDocs) {
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
 * Reassembles all per-device and legacy `delta_log` documents without dropping concurrent device streams.
 * Groups delta chunks by their stream prefix (e.g. `delta_log_dev_android`, `delta_log_dev_vercel`, `delta_log`),
 * reassembles each stream independently, deduplicates by `opId`, and orders deterministically by
 * `(updatedAtMs, opSeq, deviceId, opId)`.
 */
export function reassembleDeltaLogDocuments(deltaDocs: any[]): {
  deltas: any[];
  hasIncompleteStream: boolean;
} {
  if (!Array.isArray(deltaDocs) || deltaDocs.length === 0) {
    return { deltas: [], hasIncompleteStream: false };
  }

  const streamGroups = new Map<string, any[]>();
  for (const docData of deltaDocs) {
    if (!docData || typeof docData !== 'object' || isSyncControlDocument(docData)) continue;
    const rawId = typeof docData.id === 'string' ? docData.id.trim() : '';
    const streamKey = rawId
      ? rawId.replace(/_chunk_\d+$/, '')
      : typeof docData.deviceId === 'string' && docData.deviceId.trim()
      ? `delta_log_${sanitizeDeviceIdForDocId(docData.deviceId)}`
      : 'delta_log';

    const list = streamGroups.get(streamKey) || [];
    list.push(docData);
    streamGroups.set(streamKey, list);
  }

  const deltas: any[] = [];
  let hasIncompleteStream = false;

  for (const [, groupDocs] of streamGroups.entries()) {
    try {
      const parsed = reassembleCategoryChunks(groupDocs);
      if (parsed && typeof parsed === 'object') {
        deltas.push(parsed);
      } else {
        hasIncompleteStream = true;
      }
    } catch {
      hasIncompleteStream = true;
    }
  }

  deltas.sort((a, b) => {
    const timeDiff = (Number(a.updatedAtMs) || 0) - (Number(b.updatedAtMs) || 0);
    if (timeDiff !== 0) return timeDiff;
    const seqDiff = (Number(a.opSeq) || 0) - (Number(b.opSeq) || 0);
    if (seqDiff !== 0) return seqDiff;
    const devCmp = String(a.deviceId || '').localeCompare(String(b.deviceId || ''));
    if (devCmp !== 0) return devCmp;
    return String(a.opId || '').localeCompare(String(b.opId || ''));
  });

  return { deltas, hasIncompleteStream };
}

/**
 * Applies a P2P/Cloud delta payload on top of a base workspace object using `mergeEntities`
 * and `enforcePurgedTombstonesOnWorkspace`.
 * Handles both directions:
 * - Incoming active records are checked against base + delta tombstones.
 * - Incoming tombstones immediately remove existing active records from `baseObj` even when
 *   the delta does not contain a non-empty array for that entity collection.
 * - Idempotent: tracks applied `opId`s on `baseObj._appliedDeltaOpIds` so duplicate delta deliveries are no-ops.
 */
export function applyDeltaOnWorkspace(baseObj: any, deltaObj: any): any {
  if (!baseObj || typeof baseObj !== 'object') return baseObj;
  if (!deltaObj || typeof deltaObj !== 'object') {
    enforcePurgedTombstonesOnWorkspace(baseObj);
    return baseObj;
  }

  const appliedSet = new Set<string>(
    Array.isArray(baseObj._appliedDeltaOpIds) ? baseObj._appliedDeltaOpIds : []
  );
  if (typeof deltaObj.opId === 'string' && deltaObj.opId && appliedSet.has(deltaObj.opId)) {
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
        if (sKey === 'profile' && baseObj.profile && typeof baseObj.profile === 'object' && typeof deltaObj.profile === 'object') {
          const mergedSettings = mergeTeacherSettings(
            {
              id: 'singleton_teacher_settings',
              profile: baseObj.profile,
              updatedAt: Number(baseObj.updatedAtMs) || 1
            } as any,
            {
              id: 'singleton_teacher_settings',
              profile: deltaObj.profile,
              updatedAt: Number(deltaObj.updatedAtMs) || Date.now()
            } as any
          );
          baseObj.profile = mergedSettings.profile;
        } else if (
          sKey === 'schoolSettings' &&
          baseObj.schoolSettings &&
          typeof baseObj.schoolSettings === 'object' &&
          typeof deltaObj.schoolSettings === 'object'
        ) {
          baseObj.schoolSettings = { ...baseObj.schoolSettings, ...deltaObj.schoolSettings };
          if (baseObj.profile && typeof baseObj.profile === 'object') {
            baseObj.profile = { ...baseObj.profile, schoolSettings: baseObj.schoolSettings };
          }
        } else if (
          sKey === 'activeLessonSessionState' &&
          baseObj.activeLessonSessionState &&
          typeof baseObj.activeLessonSessionState === 'object' &&
          deltaObj.activeLessonSessionState &&
          typeof deltaObj.activeLessonSessionState === 'object'
        ) {
          const baseTs = Number(baseObj.activeLessonSessionState.updatedAt) || 0;
          const deltaTs = Number(deltaObj.activeLessonSessionState.updatedAt) || 0;
          if (deltaTs >= baseTs) {
            baseObj.activeLessonSessionState = deltaObj.activeLessonSessionState;
          }
        } else {
          baseObj[sKey] = deltaObj[sKey];
        }
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

  if (typeof deltaObj.opId === 'string' && deltaObj.opId) {
    appliedSet.add(deltaObj.opId);
    baseObj._appliedDeltaOpIds = Array.from(appliedSet).slice(-200);
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
 * - Strictly excludes `sync_control` documents from all categories.
 * - Reassembles `profile_settings` FIRST so authoritative `recentlyDeleted.purgedRecords` tombstones are known before any entity category (`core_crm`, `school_hod`, etc.) is merged.
 * - Always merges local `recentlyDeleted.purgedRecords` tombstones so local permanent deletions are enforced immediately.
 * - Reassembles ALL per-device and legacy `delta_log` documents in deterministic order so concurrent Android and Vercel deltas never overwrite each other.
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
  const rawCategoryMap: Map<string, any[]> =
    docsByCategory instanceof Map
      ? docsByCategory
      : new Map<string, any[]>(Object.entries(docsByCategory || {}));

  // Strictly strip any synchronization control documents from every category bucket
  const categoryMap = new Map<string, any[]>();
  for (const [catKey, docsList] of rawCategoryMap.entries()) {
    if (catKey === SYNC_CONTROL_CATEGORY_KEY || catKey === SYNC_CONTROL_DOC_ID) continue;
    if (!Array.isArray(docsList)) continue;
    const filtered = docsList.filter((d) => d && !isSyncControlDocument(d));
    if (filtered.length > 0) {
      categoryMap.set(catKey, filtered);
    }
  }

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
      } else {
        skippedIncompleteCategories.push(categoryKey);
      }
    } catch (parseErr) {
      skippedIncompleteCategories.push(categoryKey);
      console.warn('Failed to parse reassembled cloud category:', parseErr);
    }
  }

  // Also support category maps keyed by direct entity collection name or per-device delta keys
  const extraDeltaDocs: any[] = [];
  for (const [customKey, chunkDocs] of categoryMap.entries()) {
    if (
      customKey === 'profile_settings' ||
      customKey === 'delta_log' ||
      customKey === SYNC_CONTROL_CATEGORY_KEY ||
      WORKSPACE_CATEGORY_KEYS.includes(customKey as any)
    ) {
      continue;
    }
    if (!chunkDocs || chunkDocs.length === 0) continue;
    if (customKey.startsWith('delta_log')) {
      extraDeltaDocs.push(...chunkDocs);
      continue;
    }
    try {
      const parsedCat = reassembleCategoryChunks(chunkDocs);
      if (parsedCat && typeof parsedCat === 'object') {
        Object.assign(reassembled, parsedCat);
      }
    } catch {
      skippedIncompleteCategories.push(customKey);
    }
  }

  // 3. Apply ALL P2P/per-device delta_log streams on top of baseline categories using applyDeltaOnWorkspace
  const allDeltaDocs = [...(categoryMap.get('delta_log') || []), ...extraDeltaDocs];
  if (allDeltaDocs.length > 0) {
    const { deltas, hasIncompleteStream } = reassembleDeltaLogDocuments(allDeltaDocs);
    if (hasIncompleteStream) {
      skippedIncompleteCategories.push('delta_log');
    }
    for (const parsedDelta of deltas) {
      if (parsedDelta && typeof parsedDelta === 'object') {
        if (parsedDelta.recentlyDeleted) {
          hasCompleteProfileSettings = true;
        }
        applyDeltaOnWorkspace(reassembled, parsedDelta);
      }
    }
  }

  if (options?.maxUpdatedAtIso) {
    reassembled.timestamp = options.maxUpdatedAtIso;
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
 *
 * CRITICAL GUARANTEE:
 * Downloading a Firestore snapshot NEVER automatically marks its document revisions as applied
 * and NEVER seeds local watermarks before `importBackupFile()` has durably succeeded.
 * Callers must invoke `acknowledgeAppliedRemoteRevisions(uid, docTokens, mergedData)` ONLY after
 * local import and durable storage persistence have succeeded.
 */
export async function downloadWorkspaceFromGoogleCloud(options?: {
  prefetchedDocs?: any[];
  prefetchedWorkspaceId?: string;
}): Promise<{
  hasRemoteData: boolean;
  backupJsonStr: string | null;
  remoteTimestampMs: number;
  remoteTimestampIso: string | null;
  summary: CloudSyncSummary | null;
  docTokens?: Record<string, string>;
  workspaceId?: string;
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

  try {
    const rawDocsMap = new Map<string, any>();
    let resolvedWorkspaceId = options?.prefetchedWorkspaceId || primaryId;
    let isLegacyPath = false;

    if (Array.isArray(options?.prefetchedDocs) && options.prefetchedDocs.length > 0) {
      for (const d of options.prefetchedDocs) {
        if (d && d.id && !isSyncControlDocument(d) && verifyWorkspaceOwnership(user, d, resolvedWorkspaceId)) {
          rawDocsMap.set(d.id, d);
        }
      }
    } else if (!isFirestoreReadQuotaExhausted()) {
      try {
        // 1. Try UID path first
        const uidSnap = await getDocs(collection(db, 'user_workspaces', primaryId, 'categories'));
        if (!uidSnap.empty) {
          uidSnap.forEach((docSnap: any) => {
            const d = docSnap.data();
            if (d && d.id && !isSyncControlDocument(d) && verifyWorkspaceOwnership(user, d, primaryId)) {
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
              if (d && d.id && !isSyncControlDocument(d) && verifyWorkspaceOwnership(user, d, legacyId)) {
                rawDocsMap.set(d.id, d);
              }
            });
          }
        }
      } catch (readErr: any) {
        if (isQuotaErrorLike(readErr)) {
          markFirestoreReadQuotaExhausted();
        } else {
          throw readErr;
        }
      }
    }

    // Read the global Lernstudio library independently of this account's private workspace (cached 5 min TTL).
    let sharedLernstudioSets: any[] = [];
    if (!isFirestoreReadQuotaExhausted()) {
      try {
        sharedLernstudioSets = await readSharedLernstudioSets();
      } catch {
        sharedLernstudioSets = [];
      }
    }

    // Merge any newer chunks/deltas from fast relay server (excluding control docs)
    const relayDocs = await fetchChunksFromRelayServer(resolvedWorkspaceId);
    for (const rDoc of relayDocs) {
      if (!rDoc || !rDoc.id || isSyncControlDocument(rDoc)) continue;
      const existing = rawDocsMap.get(rDoc.id);
      if (!existing || (Number(rDoc.updatedAtMs) || 0) >= (Number(existing.updatedAtMs) || 0)) {
        rawDocsMap.set(rDoc.id, rDoc);
      }
    }

    if (rawDocsMap.size === 0 && sharedLernstudioSets.length === 0) {
      return {
        hasRemoteData: false,
        backupJsonStr: null,
        remoteTimestampMs: 0,
        remoteTimestampIso: null,
        summary: null
      };
    }

    const docsByCategory = new Map<string, any[]>();
    const downloadedDocTokens: Record<string, string> = {};
    let maxUpdatedAtMs = 0;
    let maxUpdatedAtIso: string | null = null;

    rawDocsMap.forEach((data) => {
      if (!data || !data.categoryKey || isSyncControlDocument(data)) return;
      if (!verifyWorkspaceOwnership(user, data, resolvedWorkspaceId)) {
        return;
      }
      const list = docsByCategory.get(data.categoryKey) || [];
      list.push(data);
      docsByCategory.set(data.categoryKey, list);
      const token = computeChunkRevisionToken(data);
      if (data.id && token) {
        downloadedDocTokens[data.id] = token;
      }
      if (typeof data.updatedAtMs === 'number' && data.updatedAtMs > maxUpdatedAtMs) {
        maxUpdatedAtMs = data.updatedAtMs;
        maxUpdatedAtIso = data.updatedAtIso || new Date(data.updatedAtMs).toISOString();
      }
    });

    if (docsByCategory.size === 0 && sharedLernstudioSets.length === 0) {
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
    reassembled.lernstudioSets = mergeWithBuiltinLernstudioSets(
      mergeSharedLernstudioSets(reassembled.lernstudioSets || [], sharedLernstudioSets)
    );

    // Attach downloaded revision tokens and workspaceId inside the snapshot envelope
    // so downstream import coordinators can acknowledge the exact revisions ONLY after durable import succeeds.
    reassembled._cloudDocTokens = downloadedDocTokens;
    reassembled._cloudWorkspaceId = primaryId;

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
      summary,
      docTokens: downloadedDocTokens,
      workspaceId: primaryId
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
 * Uses operation-ID and payload-digest evaluation (`evaluateRemoteSnapshotChanges`) rather than
 * unsafe wall-clock timestamp filtering (`lastLocalPushTimestampMs + 1500`), and serializes
 * downloads so rapid or concurrent remote snapshots are never dropped.
 */
export function subscribeToRemoteWorkspaceChanges(
  uid: string,
  onRemoteWorkspaceReady: (
    backupJsonStr: string,
    updatedAtIso: string,
    summary: CloudSyncSummary,
    docTokens?: Record<string, string>
  ) => Promise<void> | void
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
  let isDisposed = false;
  let isDownloadInFlight = false;
  let hasQueuedSnapshotWhileBusy = false;

  let latestRemoteSnapshotDocs: any[] | null = null;

  const processPendingRemoteDownload = async () => {
    if (isDisposed || !isAutoCloudSyncEnabled()) return;
    if (isDownloadInFlight) {
      hasQueuedSnapshotWhileBusy = true;
      return;
    }

    isDownloadInFlight = true;
    try {
      do {
        hasQueuedSnapshotWhileBusy = false;
        if (isDisposed || !isAutoCloudSyncEnabled()) break;

        const prefetched = latestRemoteSnapshotDocs;
        latestRemoteSnapshotDocs = null;
        const res = await downloadWorkspaceFromGoogleCloud(
          prefetched
            ? { prefetchedDocs: prefetched, prefetchedWorkspaceId: targetWorkspaceId }
            : undefined
        );
        if (isDisposed) break;

        if (res.hasRemoteData && res.backupJsonStr && res.summary) {
          const effectiveIso = res.remoteTimestampIso || new Date().toISOString();
          await Promise.resolve(
            onRemoteWorkspaceReady(res.backupJsonStr, effectiveIso, res.summary, res.docTokens)
          );
        }
      } while (hasQueuedSnapshotWhileBusy && !isDisposed);
    } catch (err) {
      console.warn('Remote workspace listener download error:', err);
    } finally {
      isDownloadInFlight = false;
    }
  };

  const colRef = collection(db, 'user_workspaces', targetWorkspaceId, 'categories');
  const unsub = onSnapshot(
    colRef,
    (snap) => {
      if (isDisposed || snap.empty || !isAutoCloudSyncEnabled()) return;

      const snapshotDocs: any[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || isSyncControlDocument(d)) return;
        if (!verifyWorkspaceOwnership(activeUser, d, targetWorkspaceId)) return;
        snapshotDocs.push(d);
      });

      if (snapshotDocs.length === 0) return;

      const appliedTokens = getAppliedDocTokensMap(targetWorkspaceId);
      const localWrittenTokens = getLocalWrittenDocTokensMap(targetWorkspaceId);
      const evaluation = evaluateRemoteSnapshotChanges(snapshotDocs, {
        localDeviceId: deviceId,
        appliedDocTokens: appliedTokens,
        localWrittenDocTokens: localWrittenTokens
      });

      if (!evaluation.shouldProcess) {
        return;
      }

      latestRemoteSnapshotDocs = snapshotDocs;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        processPendingRemoteDownload();
      }, 350);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `user_workspaces/${targetWorkspaceId}/categories`);
    }
  );

  // Also poll the lightweight Relay cache periodically (0 Firestore reads!) so Android APK and Vercel PWA
  // stay in real-time sync even if Firestore read quota is on cooldown or WebView throttles WebSockets.
  const pollRelayChanges = async () => {
    if (isDisposed || !isAutoCloudSyncEnabled()) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const relayDocs = await fetchChunksFromRelayServer(targetWorkspaceId);
      if (isDisposed || !Array.isArray(relayDocs) || relayDocs.length === 0) return;
      const validRelayDocs = relayDocs.filter(
        (d) => d && !isSyncControlDocument(d) && verifyWorkspaceOwnership(activeUser, d, targetWorkspaceId)
      );
      if (validRelayDocs.length === 0) return;

      const appliedTokens = getAppliedDocTokensMap(targetWorkspaceId);
      const localWrittenTokens = getLocalWrittenDocTokensMap(targetWorkspaceId);
      const evaluation = evaluateRemoteSnapshotChanges(validRelayDocs, {
        localDeviceId: deviceId,
        appliedDocTokens: appliedTokens,
        localWrittenDocTokens: localWrittenTokens
      });
      if (!evaluation.shouldProcess) return;

      latestRemoteSnapshotDocs = validRelayDocs;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        processPendingRemoteDownload();
      }, 200);
    } catch {
      // Ignore relay polling error
    }
  };

  const relayPollInterval = setInterval(pollRelayChanges, 12_000);

  return () => {
    isDisposed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    clearInterval(relayPollInterval);
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
      categoryKey: SYNC_CONTROL_CATEGORY_KEY,
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
        localStorage.removeItem(`gluck_cloud_applied_tokens_v2_${primaryId}`);
        if (legacyId) {
          localStorage.removeItem(`gluck_cloud_watermarks_v2_${legacyId}`);
          localStorage.removeItem(`gluck_cloud_delta_acc_v2_${legacyId}`);
          localStorage.removeItem(`gluck_cloud_applied_tokens_v2_${legacyId}`);
        }
        localStorage.removeItem(LAST_SYNC_TIME_KEY);
      } catch {
        // Ignore localStorage error
      }
    }

    // Clear memory caches
    lastUploadedChunkCache.clear();
    lastUploadedChunkCount.clear();
    inMemoryEntityBaselineByUid.delete(primaryId);
    inMemoryAppliedDocTokensByUid.delete(primaryId);
    inMemoryLocalWrittenDocTokensByUid.delete(primaryId);

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

