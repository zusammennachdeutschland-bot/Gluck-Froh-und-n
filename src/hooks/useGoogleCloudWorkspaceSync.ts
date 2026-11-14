import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  subscribeTeacherAuth,
  isAutoCloudSyncEnabled,
  uploadWorkspaceToGoogleCloud,
  downloadWorkspaceFromGoogleCloud,
  subscribeToRemoteWorkspaceChanges,
  isFirestoreWriteQuotaExhaustedToday,
  isFirestoreReadQuotaExhausted,
  isQuotaErrorLike,
  BUILTIN_LERNSTUDIO_MAP,
  getCloudSyncControlState,
  acknowledgeAppliedRemoteRevisions,
  extractDocTokensFromBackupJson,
  setLastCloudSyncTime
} from '../services/firebaseWorkspaceSync';
import { storage } from '../services/storageService';

function stripSnapshotTimestamp(jsonStr: string): string {
  return (jsonStr || '')
    .replace(/"timestamp":"[^"]*",?/, '')
    .replace(/,"_cloudDocTokens":\{[^}]*\}/, '')
    .replace(/,"_cloudWorkspaceId":"[^"]*"/, '');
}

/**
 * Checks whether the given JSON backup has any meaningful application workspace data.
 * Checks ALL backup sections:
 * - Core CRM: students, groups, lessons, payments, certificates, notifications, prunedLessonIds
 * - School & HOD: hodStudents, hodComplaints, hodActionPlans, hodVisits, schoolNotes
 * - Finance: financeAccounts, financeCategories, financeTransactions, financeRecurring, financeInstallments, financeNotifications, goldHoldings
 * - Homework: homeworkAssignments, homeworkSubmissions
 * - Lernstudio: CUSTOM sets created by teacher (!BUILTIN_LERNSTUDIO_MAP.has(s.id))
 * - Singletons: custom pickerNames, customAiBackgrounds, todos, non-default profile or schoolSettings
 */
export function hasAnyWorkspaceData(jsonStr: string | null): boolean {
  if (!jsonStr) return false;
  try {
    const raw = JSON.parse(jsonStr);
    if (!raw || typeof raw !== 'object') return false;

    // Support both root-level backup properties and nested `data` properties
    const p = (raw.data && typeof raw.data === 'object' && raw.data !== null)
      ? { ...raw.data, ...raw }
      : raw;

    // 1. Check array collections
    const collectionKeys = [
      'students',
      'groups',
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
      'homeworkAssignments',
      'homeworkSubmissions',
      'pickerNames',
      'prunedLessonIds',
      'inspirationMessages',
      'dismissedDashboardLessons'
    ];

    for (const key of collectionKeys) {
      if (Array.isArray(p[key]) && p[key].length > 0) {
        return true;
      }
    }

    // 2. Check recentlyDeleted (including permanent purge tombstones!)
    const rec = p.recentlyDeleted;
    if (rec && typeof rec === 'object') {
      if (
        (Array.isArray(rec.students) && rec.students.length > 0) ||
        (Array.isArray(rec.groups) && rec.groups.length > 0) ||
        (Array.isArray(rec.lessons) && rec.lessons.length > 0) ||
        (Array.isArray(rec.purgedRecords) && rec.purgedRecords.length > 0)
      ) {
        return true;
      }
    }

    // 3. Check Custom Lernstudio Sets created by teacher
    if (Array.isArray(p.lernstudioSets)) {
      const hasCustomSet = p.lernstudioSets.some(
        (s: any) => s && s.id && !BUILTIN_LERNSTUDIO_MAP.has(s.id)
      );
      if (hasCustomSet) return true;
    }

    // 4. Check custom AI backgrounds
    if (
      (Array.isArray(p.customAiBackgrounds) && p.customAiBackgrounds.length > 0) ||
      (Array.isArray(p.profile?.customAiBackgrounds) && p.profile.customAiBackgrounds.length > 0)
    ) {
      return true;
    }

    // 5. Check teacher profile customization
    if (p.profile && typeof p.profile === 'object') {
      if (
        (p.profile.name && p.profile.name !== 'معلم Glück' && p.profile.name !== 'المعلم') ||
        p.profile.phone ||
        p.profile.email ||
        p.profile.avatarUrl
      ) {
        return true;
      }
    }

    // 6. Check schoolSettings customization
    const sch = p.schoolSettings || p.profile?.schoolSettings;
    if (sch && typeof sch === 'object') {
      if (
        (sch.name && sch.name !== 'Glück Deutsch' && sch.name !== 'مدرستنا') ||
        (Array.isArray(sch.stages) && sch.stages.length > 0)
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function hasLocalStorageRuntime(): boolean {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
  } catch {
    return false;
  }
}

const inMemoryPendingPushByUid = new Map<string, boolean>();
const inMemoryDurableStorageFallback = new Map<string, string>();
const inMemoryDurablePendingQueueByUid = new Map<string, PendingRemoteQueueItem[]>();

function readDurableString(key: string): string | null {
  if (hasLocalStorageRuntime()) {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    } catch {
      // Fall through
    }
  }
  return inMemoryDurableStorageFallback.get(key) ?? null;
}

function writeDurableString(key: string, value: string): void {
  inMemoryDurableStorageFallback.set(key, value);
  if (hasLocalStorageRuntime()) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  }
}

function removeDurableString(key: string): void {
  inMemoryDurableStorageFallback.delete(key);
  if (hasLocalStorageRuntime()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }
}

export function setPendingLocalPushFlag(uid: string, pending: boolean): void {
  if (!uid) return;
  if (pending) {
    inMemoryPendingPushByUid.set(uid, true);
    writeDurableString(`gluck_cloud_pending_local_push_${uid}`, '1');
  } else {
    inMemoryPendingPushByUid.delete(uid);
    removeDurableString(`gluck_cloud_pending_local_push_${uid}`);
  }
}

export function hasPendingLocalPushFlag(uid: string): boolean {
  if (!uid) return false;
  if (inMemoryPendingPushByUid.get(uid)) return true;
  return readDurableString(`gluck_cloud_pending_local_push_${uid}`) === '1';
}

export function clearPendingLocalPushFlag(uid: string): void {
  setPendingLocalPushFlag(uid, false);
}

export interface PendingRemoteQueueItem {
  id: string;
  remoteJsonStr: string;
  docTokens?: Record<string, string>;
  enqueuedAtMs: number;
  attemptCount: number;
}

export const PENDING_REMOTE_QUEUE_KEY_PREFIX = 'gluck_cloud_pending_remote_queue_v2_';

export function loadDurablePendingRemoteQueue(uid: string): PendingRemoteQueueItem[] {
  if (!uid) return [];
  const inMem = inMemoryDurablePendingQueueByUid.get(uid);
  if (inMem && Array.isArray(inMem)) {
    return inMem.map((item) => ({ ...item }));
  }

  const key = `${PENDING_REMOTE_QUEUE_KEY_PREFIX}${uid}`;
  const raw = readDurableString(key);
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (item: any) =>
        item &&
        typeof item === 'object' &&
        typeof item.remoteJsonStr === 'string' &&
        item.remoteJsonStr.length > 0
    );
    inMemoryDurablePendingQueueByUid.set(uid, valid);
    return valid.map((item: any) => ({ ...item }));
  } catch {
    return [];
  }
}

export async function loadDurablePendingRemoteQueueAsync(
  uid: string
): Promise<PendingRemoteQueueItem[]> {
  if (!uid) return [];
  const key = `${PENDING_REMOTE_QUEUE_KEY_PREFIX}${uid}`;
  try {
    let raw = await storage.getItem<any>(key);

    // Backward compatibility: If not in storageService yet, check legacy localStorage
    if (!raw && hasLocalStorageRuntime()) {
      try {
        const legacyRaw = localStorage.getItem(key);
        if (legacyRaw) {
          raw = JSON.parse(legacyRaw);
          if (raw) {
            await storage.setItem(key, raw);
            try {
              localStorage.removeItem(key);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (!raw) {
      inMemoryDurablePendingQueueByUid.set(uid, []);
      return [];
    }

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) {
      inMemoryDurablePendingQueueByUid.set(uid, []);
      return [];
    }
    const filtered: PendingRemoteQueueItem[] = parsed.filter(
      (item: any) =>
        item &&
        typeof item === 'object' &&
        typeof item.remoteJsonStr === 'string' &&
        item.remoteJsonStr.length > 0
    );
    inMemoryDurablePendingQueueByUid.set(uid, filtered);
    return filtered.map((item) => ({ ...item }));
  } catch (err) {
    console.warn(`[loadDurablePendingRemoteQueueAsync] Failed to load queue for ${key}:`, err);
    return loadDurablePendingRemoteQueue(uid);
  }
}

const saveQueueMutexByUid = new Map<string, Promise<any>>();

async function executeSaveDurablePendingRemoteQueue(
  uid: string,
  queue: PendingRemoteQueueItem[]
): Promise<boolean> {
  if (!uid) return false;
  const key = `${PENDING_REMOTE_QUEUE_KEY_PREFIX}${uid}`;
  const safeQueue = Array.isArray(queue) ? queue : [];

  let previousDurableVal: any = null;
  try {
    previousDurableVal = await storage.getItem<any>(key);
  } catch (readErr) {
    console.warn(`[saveDurablePendingRemoteQueue] Cannot read previous durable queue for ${key}, aborting overwrite:`, readErr);
    return false;
  }

  try {
    // 1. Persist pending remote queue payloads (including empty queue representation []) using IndexedDB/localforage storageService
    await storage.setItem(key, safeQueue);

    // 2. Await writes and verify actual read-back equality before reporting persistence success
    const verified = await storage.verifyDurableReadBackValue(key, safeQueue);
    if (!verified) {
      console.warn(`[saveDurablePendingRemoteQueue] Read-back verification failed for ${key}`);
      if (previousDurableVal !== null && previousDurableVal !== undefined) {
        try {
          await storage.setItem(key, previousDurableVal);
          await storage.verifyDurableReadBackValue(key, previousDurableVal);
        } catch (rollbackErr) {
          console.error(`[saveDurablePendingRemoteQueue] CRITICAL: Rollback persistence failed for ${key}:`, rollbackErr);
        }
      }
      return false;
    }

    if (safeQueue.length === 0) {
      inMemoryDurablePendingQueueByUid.set(uid, []);
      inMemoryDurableStorageFallback.set(key, JSON.stringify([]));
      if (hasLocalStorageRuntime()) {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }
    } else {
      inMemoryDurablePendingQueueByUid.set(
        uid,
        safeQueue.map((item) => ({ ...item }))
      );
      inMemoryDurableStorageFallback.set(key, JSON.stringify(safeQueue));
    }
    return true;
  } catch (err) {
    console.warn(`[saveDurablePendingRemoteQueue] Failed to persist queue for ${key}:`, err);
    if (previousDurableVal !== null && previousDurableVal !== undefined) {
      try {
        await storage.setItem(key, previousDurableVal);
      } catch (rollbackErr) {
        console.error(`[saveDurablePendingRemoteQueue] CRITICAL: Exception rollback failed for ${key}:`, rollbackErr);
      }
    }
    return false;
  }
}

export function saveDurablePendingRemoteQueue(
  uid: string,
  queue: PendingRemoteQueueItem[]
): Promise<boolean> {
  if (!uid) return Promise.resolve(false);
  const prevPromise = saveQueueMutexByUid.get(uid) || Promise.resolve();
  const currentPromise = prevPromise
    .then(() => executeSaveDurablePendingRemoteQueue(uid, queue))
    .catch(() => executeSaveDurablePendingRemoteQueue(uid, queue));

  saveQueueMutexByUid.set(uid, currentPromise);
  return currentPromise;
}

function areDocTokensEqual(
  a?: Record<string, string>,
  b?: Record<string, string>
): boolean {
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length === 0 || aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export async function enqueueDurablePendingRemoteItem(
  uid: string,
  remoteJsonStr: string,
  docTokens?: Record<string, string>
): Promise<PendingRemoteQueueItem | null> {
  if (!uid || !remoteJsonStr) return null;
  const extracted = extractDocTokensFromBackupJson(remoteJsonStr);
  const effectiveTokens = docTokens || extracted.docTokens;

  const inMem = inMemoryDurablePendingQueueByUid.get(uid);
  const queue = inMem ? [...inMem] : await loadDurablePendingRemoteQueueAsync(uid);
  const last = queue.length > 0 ? queue[queue.length - 1] : null;
  if (
    last &&
    (last.remoteJsonStr === remoteJsonStr ||
      (effectiveTokens && areDocTokensEqual(last.docTokens, effectiveTokens)))
  ) {
    if (effectiveTokens) {
      last.docTokens = { ...(last.docTokens || {}), ...effectiveTokens };
    }
    inMemoryDurablePendingQueueByUid.set(uid, queue);
    const saved = await saveDurablePendingRemoteQueue(uid, queue);
    return saved ? last : null;
  }
  const newItem: PendingRemoteQueueItem = {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    remoteJsonStr,
    docTokens: effectiveTokens,
    enqueuedAtMs: Date.now(),
    attemptCount: 0
  };
  queue.push(newItem);
  inMemoryDurablePendingQueueByUid.set(uid, queue);
  const saved = await saveDurablePendingRemoteQueue(uid, queue);
  if (!saved) {
    inMemoryDurablePendingQueueByUid.set(
      uid,
      queue.filter((item) => item.id !== newItem.id)
    );
    return null;
  }
  return newItem;
}

export async function removeDurablePendingRemoteItem(
  uid: string,
  itemId: string
): Promise<boolean> {
  if (!uid || !itemId) return false;
  const queue = await loadDurablePendingRemoteQueueAsync(uid);
  const next = queue.filter((item) => item.id !== itemId);
  return await saveDurablePendingRemoteQueue(uid, next);
}

export function clearDurablePendingRemoteQueueForTests(uid: string): void {
  if (!uid) return;
  const key = `${PENDING_REMOTE_QUEUE_KEY_PREFIX}${uid}`;
  inMemoryDurablePendingQueueByUid.delete(uid);
  inMemoryDurableStorageFallback.delete(key);
  storage.removeItem(key).catch(() => {});
  if (hasLocalStorageRuntime()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
}

export async function clearDurablePendingRemoteQueueForTestsAsync(uid: string): Promise<void> {
  if (!uid) return;
  const key = `${PENDING_REMOTE_QUEUE_KEY_PREFIX}${uid}`;
  inMemoryDurablePendingQueueByUid.delete(uid);
  inMemoryDurableStorageFallback.delete(key);
  await storage.removeItem(key);
  if (hasLocalStorageRuntime()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
}

export function clearInMemorySyncQueueCachesForTests(uid?: string): void {
  if (uid) {
    inMemoryDurablePendingQueueByUid.delete(uid);
    inMemoryDurableStorageFallback.delete(`${PENDING_REMOTE_QUEUE_KEY_PREFIX}${uid}`);
    inMemoryPendingPushByUid.delete(uid);
    saveQueueMutexByUid.delete(uid);
  } else {
    inMemoryDurablePendingQueueByUid.clear();
    inMemoryDurableStorageFallback.clear();
    inMemoryPendingPushByUid.clear();
    saveQueueMutexByUid.clear();
  }
}

export interface SerializedSyncCoordinatorOptions {
  uid?: string;
  onApplyRemotePayload: (
    remoteJsonStr: string,
    docTokens?: Record<string, string>
  ) => Promise<boolean>;
  onExecuteLocalPush: () => Promise<boolean>;
  onError?: (err: unknown, phase: 'remote_pull' | 'local_push') => void;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  maxAutoRetries?: number;
  autoRetryEnabled?: boolean;
}

export interface SerializedSyncCoordinator {
  enqueueRemoteSnapshot: (
    remoteJsonStr: string,
    docTokens?: Record<string, string>
  ) => Promise<boolean>;
  enqueueLocalPush: () => Promise<boolean>;
  resumePendingWork: () => Promise<boolean>;
  isBusy: () => boolean;
  getPendingRemoteCount: () => number;
  getPendingRemoteItems: () => PendingRemoteQueueItem[];
  hasPendingLocal: () => boolean;
  dispose: () => void;
}

/**
 * Serialized, zero-loss synchronization coordinator with durable pending queue and bounded retry.
 * Guarantees:
 * - Never removes a pending remote snapshot before `onApplyRemotePayload` succeeds.
 * - Persists pending remote snapshots durably (when `uid` is provided) so failed or interrupted imports survive app restarts.
 * - Automatically retries failed remote imports with bounded exponential backoff without requiring a new Firestore snapshot.
 * - Does not allow a failed remote import to permanently block unrelated local pushes, and does not allow local push failures to erase pending remote work.
 * - Deduplicates identical snapshots while preserving distinct ordered revisions.
 */
export function createSerializedSyncCoordinator(
  options: SerializedSyncCoordinatorOptions
): SerializedSyncCoordinator {
  const uid = options.uid || '';
  const initialRetryDelayMs = options.initialRetryDelayMs ?? 1000;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 15000;
  const maxAutoRetries = options.maxAutoRetries ?? 5;
  const autoRetryEnabled = options.autoRetryEnabled ?? true;

  let isRunning = false;
  let isDisposed = false;
  const pendingRemoteQueue: PendingRemoteQueueItem[] = uid
    ? loadDurablePendingRemoteQueue(uid)
    : [];
  let pendingLocalPush = uid ? hasPendingLocalPushFlag(uid) : false;
  let activeDrainPromise: Promise<boolean> | null = null;
  let retryTimerId: any = null;

  const persistQueueIfNeeded = async (): Promise<boolean> => {
    if (uid) {
      return await saveDurablePendingRemoteQueue(uid, pendingRemoteQueue);
    }
    return true;
  };

  const clearRetryTimer = () => {
    if (retryTimerId !== null) {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
  };

  const scheduleBoundedRetry = (attemptCount: number) => {
    if (isDisposed || !autoRetryEnabled || attemptCount > maxAutoRetries) {
      return;
    }
    clearRetryTimer();
    const delay = Math.min(
      maxRetryDelayMs,
      initialRetryDelayMs * Math.pow(2, Math.max(0, attemptCount - 1))
    );
    retryTimerId = setTimeout(() => {
      retryTimerId = null;
      if (!isDisposed && pendingRemoteQueue.length > 0) {
        drain().catch(() => {});
      }
    }, delay);
  };

  const drain = (): Promise<boolean> => {
    if (isDisposed) return Promise.resolve(false);
    if (isRunning && activeDrainPromise) {
      return activeDrainPromise;
    }

    clearRetryTimer();
    isRunning = true;
    activeDrainPromise = (async () => {
      let lastOutcome = true;
      try {
        while (!isDisposed && (pendingRemoteQueue.length > 0 || pendingLocalPush)) {
          // Process queued remote snapshots first so local state merges remote changes before pushing
          if (pendingRemoteQueue.length > 0) {
            // CRITICAL: Peek the head item; NEVER remove it until onApplyRemotePayload succeeds!
            const headItem = pendingRemoteQueue[0];
            let appliedOk = false;
            try {
              appliedOk = await options.onApplyRemotePayload(
                headItem.remoteJsonStr,
                headItem.docTokens
              );
            } catch (err) {
              appliedOk = false;
              options.onError?.(err, 'remote_pull');
            }

            if (appliedOk) {
              // Remove ONLY the specific headItem that succeeded, preserving any newer snapshots enqueued during import
              const idx = pendingRemoteQueue.findIndex((item) => item.id === headItem.id);
              if (idx !== -1) {
                pendingRemoteQueue.splice(idx, 1);
              }
              const removalPersisted = await persistQueueIfNeeded();
              if (!removalPersisted) {
                // If durable removal fails, restore the item to queue so it is not lost or corrupt
                if (idx !== -1) {
                  pendingRemoteQueue.splice(idx, 0, headItem);
                }
                lastOutcome = false;
                break;
              }
              continue;
            } else {
              lastOutcome = false;
              headItem.attemptCount += 1;
              await persistQueueIfNeeded();

              // Do NOT allow a failed remote import to permanently block a pending local push
              if (!isDisposed && pendingLocalPush) {
                pendingLocalPush = false;
                try {
                  const pushOk = await options.onExecuteLocalPush();
                  if (!pushOk) {
                    lastOutcome = false;
                    if (uid) setPendingLocalPushFlag(uid, true);
                  }
                } catch (pushErr) {
                  lastOutcome = false;
                  if (uid) setPendingLocalPushFlag(uid, true);
                  options.onError?.(pushErr, 'local_push');
                }
              }

              // Schedule bounded exponential backoff retry for the unapplied remote item
              scheduleBoundedRetry(headItem.attemptCount);
              break;
            }
          }

          if (pendingLocalPush) {
            pendingLocalPush = false;
            try {
              const ok = await options.onExecuteLocalPush();
              if (!ok) {
                lastOutcome = false;
                if (uid) setPendingLocalPushFlag(uid, true);
              }
            } catch (err) {
              lastOutcome = false;
              if (uid) setPendingLocalPushFlag(uid, true);
              options.onError?.(err, 'local_push');
            }
          }
        }
      } finally {
        isRunning = false;
        activeDrainPromise = null;
      }
      return lastOutcome;
    })();

    return activeDrainPromise;
  };

  return {
    async enqueueRemoteSnapshot(
      remoteJsonStr: string,
      docTokens?: Record<string, string>
    ): Promise<boolean> {
      if (isDisposed || !remoteJsonStr) return false;
      const extracted = extractDocTokensFromBackupJson(remoteJsonStr);
      const effectiveTokens = docTokens || extracted.docTokens;

      // Coalesce identical consecutive payloads in the pending queue while preserving distinct revisions in order
      const lastQueued =
        pendingRemoteQueue.length > 0
          ? pendingRemoteQueue[pendingRemoteQueue.length - 1]
          : null;
      const isDuplicateOfTail =
        lastQueued !== null &&
        (lastQueued.remoteJsonStr === remoteJsonStr ||
          (effectiveTokens && areDocTokensEqual(lastQueued.docTokens, effectiveTokens)));

      if (!isDuplicateOfTail) {
        const newItem: PendingRemoteQueueItem = {
          id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          remoteJsonStr,
          docTokens: effectiveTokens,
          enqueuedAtMs: Date.now(),
          attemptCount: 0
        };
        pendingRemoteQueue.push(newItem);
        const persisted = await persistQueueIfNeeded();
        if (!persisted) {
          const idx = pendingRemoteQueue.findIndex((item) => item.id === newItem.id);
          if (idx !== -1) {
            pendingRemoteQueue.splice(idx, 1);
          }
          return false;
        }
      } else if (lastQueued && effectiveTokens) {
        const prevTokens = lastQueued.docTokens;
        lastQueued.docTokens = { ...(lastQueued.docTokens || {}), ...effectiveTokens };
        const persisted = await persistQueueIfNeeded();
        if (!persisted) {
          lastQueued.docTokens = prevTokens;
          return false;
        }
      }

      return drain();
    },
    enqueueLocalPush(): Promise<boolean> {
      if (isDisposed) return Promise.resolve(false);
      pendingLocalPush = true;
      if (uid) {
        setPendingLocalPushFlag(uid, true);
      }
      return drain();
    },
    async resumePendingWork(): Promise<boolean> {
      if (isDisposed) return false;
      if (uid) {
        const persisted = await loadDurablePendingRemoteQueueAsync(uid);
        for (const item of persisted) {
          const exists = pendingRemoteQueue.some(
            (existing) =>
              existing.id === item.id || existing.remoteJsonStr === item.remoteJsonStr
          );
          if (!exists) {
            pendingRemoteQueue.push(item);
          }
        }
        if (hasPendingLocalPushFlag(uid)) {
          pendingLocalPush = true;
        }
      }
      if (pendingRemoteQueue.length === 0 && !pendingLocalPush) {
        return true;
      }
      return drain();
    },
    isBusy(): boolean {
      return isRunning;
    },
    getPendingRemoteCount(): number {
      return pendingRemoteQueue.length;
    },
    getPendingRemoteItems(): PendingRemoteQueueItem[] {
      return pendingRemoteQueue.map((item) => ({ ...item }));
    },
    hasPendingLocal(): boolean {
      return pendingLocalPush;
    },
    dispose(): void {
      isDisposed = true;
      clearRetryTimer();
    }
  };
}

/**
 * Legacy full-workspace cloud sync hook.
 * Disabled in the P2P-first architecture: general application data (students, groups, lessons,
 * attendance, schedules, payments, finance, certificates, HOD, school notes, Lernstudio sets)
 * is stored locally on Android as the primary source of truth and synchronized across the
 * teacher's devices exclusively via P2P. Cloud (Firestore) is dedicated strictly to Online Homework.
 */
export function useGoogleCloudWorkspaceSync(): void {
  // Intentionally disabled in P2P-first architecture.
  return;
}

