import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  subscribeTeacherAuth,
  isAutoCloudSyncEnabled,
  uploadWorkspaceToGoogleCloud,
  downloadWorkspaceFromGoogleCloud,
  subscribeToRemoteWorkspaceChanges,
  isFirestoreWriteQuotaExhaustedToday,
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

export async function saveDurablePendingRemoteQueue(
  uid: string,
  queue: PendingRemoteQueueItem[]
): Promise<boolean> {
  if (!uid) return false;
  const key = `${PENDING_REMOTE_QUEUE_KEY_PREFIX}${uid}`;
  if (!Array.isArray(queue) || queue.length === 0) {
    try {
      await storage.removeItem(key);
      const isRemoved = await storage.verifyDurableRemoved(key);
      if (!isRemoved) {
        return false;
      }
      inMemoryDurablePendingQueueByUid.delete(uid);
      inMemoryDurableStorageFallback.delete(key);
      if (hasLocalStorageRuntime()) {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  try {
    // 1. Persist pending remote queue payloads using existing IndexedDB/localforage-backed storageService
    await storage.setItem(key, queue);

    // 2. Await writes and verify actual read-back equality before reporting persistence success
    const verified = await storage.verifyDurableReadBackValue(key, queue);
    if (!verified) {
      console.warn(`[saveDurablePendingRemoteQueue] Read-back verification failed for ${key}`);
      return false;
    }

    inMemoryDurablePendingQueueByUid.set(
      uid,
      queue.map((item) => ({ ...item }))
    );
    inMemoryDurableStorageFallback.set(key, JSON.stringify(queue));
    return true;
  } catch (err) {
    console.warn(`[saveDurablePendingRemoteQueue] Failed to persist queue for ${key}:`, err);
    return false;
  }
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

const AUTO_PUSH_DEBOUNCE_MS = 2500;

export function useGoogleCloudWorkspaceSync(): void {
  const {
    students,
    groups,
    lessons,
    payments,
    certificates,
    todos,
    profile,
    theme,
    accentColor,
    notificationSettings,
    inspirationSettings,
    inspirationMessages,
    hodStudents,
    hodComplaints,
    hodActionPlans,
    hodVisits,
    schoolNotes,
    financeAccounts,
    financeCategories,
    financeTransactions,
    financeRecurring,
    financeInstallments,
    financeNotifications,
    goldHoldings,
    lernstudioSets,
    recentlyDeleted,
    dismissedDashboardLessonIds,
    performBackup,
    importBackupFile
  } = useApp();

  const currentUserUidRef = useRef<string | null>(null);
  const hasCompletedInitialCheckRef = useRef<boolean>(false);
  const isBootstrapInFlightRef = useRef<boolean>(false);
  const autoPushTimerRef = useRef<any>(null);
  const lastUploadedSnapshotRef = useRef<string | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const syncBaselineAfterRemoteImportRef = useRef<boolean>(false);
  const coordinatorRef = useRef<SerializedSyncCoordinator | null>(null);

  // Keep latest performBackup and importBackupFile in refs so React state updates never tear down the Firestore onSnapshot listener
  const performBackupRef = useRef(performBackup);
  const importBackupFileRef = useRef(importBackupFile);
  useEffect(() => {
    performBackupRef.current = performBackup;
    importBackupFileRef.current = importBackupFile;
  }, [performBackup, importBackupFile]);

  const [localMutationTick, setLocalMutationTick] = useState<number>(0);

  // Listen to unified local data mutations (like homework, picker names, custom backgrounds saved directly)
  useEffect(() => {
    const handleLocalMutation = () => {
      const uid = currentUserUidRef.current;
      if (uid && !isApplyingRemoteRef.current) {
        setPendingLocalPushFlag(uid, true);
      }
      setLocalMutationTick((t) => t + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('gluck-local-data-mutated', handleLocalMutation);
      return () => {
        window.removeEventListener('gluck-local-data-mutated', handleLocalMutation);
      };
    }
  }, []);

  const executeLocalPushPass = useCallback(async (): Promise<boolean> => {
    const uid = currentUserUidRef.current;
    if (
      !uid ||
      !hasCompletedInitialCheckRef.current ||
      !isAutoCloudSyncEnabled() ||
      isFirestoreWriteQuotaExhaustedToday()
    ) {
      return false;
    }

    const snapStr = await performBackupRef.current();
    const normalizedSnap = stripSnapshotTimestamp(snapStr);
    if (
      normalizedSnap === lastUploadedSnapshotRef.current &&
      !hasPendingLocalPushFlag(uid)
    ) {
      return true;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
      );
    }

    const res = await uploadWorkspaceToGoogleCloud(snapStr);
    if (res.success) {
      lastUploadedSnapshotRef.current = normalizedSnap;
      clearPendingLocalPushFlag(uid);
    } else {
      setPendingLocalPushFlag(uid, true);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gluck-cloud-sync-status', {
          detail: { status: res.success ? 'synced' : 'error', error: res.error }
        })
      );
    }

    return res.success;
  }, []);

  const applyRemoteSnapshotPass = useCallback(
    async (
      remoteBackupJson: string,
      explicitDocTokens?: Record<string, string>
    ): Promise<boolean> => {
      const uid = currentUserUidRef.current;
      if (!uid || !isAutoCloudSyncEnabled()) return false;

      const extracted = extractDocTokensFromBackupJson(remoteBackupJson);
      const effectiveDocTokens = explicitDocTokens || extracted.docTokens;
      const targetAckId = extracted.workspaceId || uid;

      const preImportSnap = await performBackupRef.current();
      const preImportNormalized = stripSnapshotTimestamp(preImportSnap);
      const hadUnpushedLocalChanges =
        hasPendingLocalPushFlag(uid) ||
        (lastUploadedSnapshotRef.current !== null &&
          preImportNormalized !== lastUploadedSnapshotRef.current);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
        );
      }

      isApplyingRemoteRef.current = true;
      let success = false;
      try {
        const importOk = await importBackupFileRef.current(remoteBackupJson);
        if (importOk) {
          const postSnap = await performBackupRef.current();
          const postNormalized = stripSnapshotTimestamp(postSnap);

          // Explicitly acknowledge remote revisions ONLY after local merge and durable storage persistence succeeded
          let ackOk = true;
          if (effectiveDocTokens && Object.keys(effectiveDocTokens).length > 0) {
            ackOk = acknowledgeAppliedRemoteRevisions(
              targetAckId,
              effectiveDocTokens,
              postSnap
            );
          }

          if (ackOk) {
            success = true;
            setLastCloudSyncTime(new Date().toISOString());
            if (!hadUnpushedLocalChanges) {
              lastUploadedSnapshotRef.current = postNormalized;
              syncBaselineAfterRemoteImportRef.current = true;
              clearPendingLocalPushFlag(uid);
            } else {
              // Local had unpushed changes that were merged with remote; ensure merged result is pushed
              setPendingLocalPushFlag(uid, true);
            }
          } else {
            success = false;
          }
        }
      } finally {
        isApplyingRemoteRef.current = false;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', {
            detail: { status: success ? 'synced' : 'error' }
          })
        );
      }

      if (success && hadUnpushedLocalChanges && coordinatorRef.current) {
        coordinatorRef.current.enqueueLocalPush();
      }

      return success;
    },
    []
  );

  // 1. Auth listener + real-time remote changes listener (`onSnapshot`) + initial cloud bootstrap + Android/WebView lifecycle handlers
  useEffect(() => {
    let unsubRemote: (() => void) | null = null;
    let isCancelled = false;
    let retryTimeoutId: any = null;

    const createCoordinatorForUser = (uid?: string) => {
      if (coordinatorRef.current) {
        coordinatorRef.current.dispose();
      }
      const coord = createSerializedSyncCoordinator({
        uid,
        onApplyRemotePayload: applyRemoteSnapshotPass,
        onExecuteLocalPush: executeLocalPushPass,
        onError: (err) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', {
                detail: { status: 'error', error: (err as any)?.message || String(err) }
              })
            );
          }
        }
      });
      coordinatorRef.current = coord;
      return coord;
    };

    let coordinator = createCoordinatorForUser();

    const runBootstrap = async (uid: string, attempt = 1) => {
      if (
        isCancelled ||
        hasCompletedInitialCheckRef.current ||
        !isAutoCloudSyncEnabled() ||
        isBootstrapInFlightRef.current
      ) {
        return;
      }

      isBootstrapInFlightRef.current = true;
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
          );
        }

        // First: if there are unacknowledged remote revisions persisted from a prior session/crash, drain them now
        const persistedAtStart = await loadDurablePendingRemoteQueueAsync(uid);
        if (persistedAtStart.length > 0) {
          await coordinator.resumePendingWork();
        }

        // Check Cloud-side pause and generation marker FIRST
        const controlState = await getCloudSyncControlState(uid);
        if (controlState.isPaused) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', {
                detail: { status: 'idle', error: 'المزامنة السحابية متوقفة مؤقتاً لهذا الحساب.' }
              })
            );
          }
          return;
        }

        const cloudRes = await downloadWorkspaceFromGoogleCloud();
        if (cloudRes.error) {
          // Network or permission failure: do NOT mark initial check completed!
          // Never interpret a network error as an empty workspace!
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', {
                detail: { status: 'error', error: cloudRes.error }
              })
            );
          }

          // Retry with exponential backoff if not cancelled
          if (!isCancelled && attempt <= 5) {
            const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
            retryTimeoutId = setTimeout(() => {
              if (!isCancelled && !hasCompletedInitialCheckRef.current) {
                runBootstrap(uid, attempt + 1);
              }
            }, delay);
          }
          return;
        }

        const localSnapStr = await performBackupRef.current();
        const localHasData = hasAnyWorkspaceData(localSnapStr);
        const remoteHasActualData =
          cloudRes.hasRemoteData && hasAnyWorkspaceData(cloudRes.backupJsonStr);

        let finalStatus: 'synced' | 'error' = 'synced';
        let finalError: string | undefined;

        if (remoteHasActualData && !localHasData && cloudRes.backupJsonStr) {
          // Fresh device: persist in durable queue first, then import, verify, and acknowledge
          const queuedItem = await enqueueDurablePendingRemoteItem(
            uid,
            cloudRes.backupJsonStr,
            cloudRes.docTokens
          );
          if (!queuedItem) {
            finalStatus = 'error';
            finalError = 'تعذر حفظ البيانات في التخزين الدائم.';
          } else {
            const success = await applyRemoteSnapshotPass(
              cloudRes.backupJsonStr,
              cloudRes.docTokens
            );
            if (success) {
              await removeDurablePendingRemoteItem(uid, queuedItem.id);
              try {
                localStorage.setItem('dl_setup_completed', 'true');
                window.dispatchEvent(new CustomEvent('close-setup-wizard'));
              } catch {}
            } else {
              finalStatus = 'error';
              finalError = 'تعذر استيراد البيانات السحابية.';
            }
          }
        } else if (!remoteHasActualData && localHasData && !isFirestoreWriteQuotaExhaustedToday()) {
          // Cloud is genuinely verified as completely empty and local has data: seed cloud once
          const res = await uploadWorkspaceToGoogleCloud(localSnapStr, { forceFullBaseline: true });
          if (res.success) {
            lastUploadedSnapshotRef.current = stripSnapshotTimestamp(localSnapStr);
            clearPendingLocalPushFlag(uid);
          } else {
            finalStatus = 'error';
            finalError = res.error;
          }
        } else if (localHasData && remoteHasActualData && cloudRes.backupJsonStr) {
          // Both have data: persist in durable queue first, perform two-way merge, verify, and acknowledge
          const queuedItem = await enqueueDurablePendingRemoteItem(
            uid,
            cloudRes.backupJsonStr,
            cloudRes.docTokens
          );
          if (!queuedItem) {
            finalStatus = 'error';
            finalError = 'تعذر حفظ البيانات في التخزين الدائم.';
          } else {
            const success = await applyRemoteSnapshotPass(
              cloudRes.backupJsonStr,
              cloudRes.docTokens
            );
            if (!success) {
              finalStatus = 'error';
              finalError = 'تعذر دمج البيانات السحابية.';
            } else {
              await removeDurablePendingRemoteItem(uid, queuedItem.id);
              if (!isFirestoreWriteQuotaExhaustedToday()) {
                const mergedSnapStr = await performBackupRef.current();
                const uploadRes = await uploadWorkspaceToGoogleCloud(mergedSnapStr);
                if (uploadRes.success) {
                  lastUploadedSnapshotRef.current = stripSnapshotTimestamp(mergedSnapStr);
                  syncBaselineAfterRemoteImportRef.current = true;
                  clearPendingLocalPushFlag(uid);
                } else {
                  finalStatus = 'error';
                  finalError = uploadRes.error;
                }
              }
            }
          }
        } else if (localHasData) {
          lastUploadedSnapshotRef.current = stripSnapshotTimestamp(localSnapStr);
        }

        // Only mark initial check completed if bootstrap actually completed without error
        if (finalStatus === 'synced') {
          hasCompletedInitialCheckRef.current = true;
        } else if (!isCancelled && attempt <= 5) {
          const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
          retryTimeoutId = setTimeout(() => {
            if (!isCancelled && !hasCompletedInitialCheckRef.current) {
              runBootstrap(uid, attempt + 1);
            }
          }, delay);
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', {
              detail: { status: finalStatus, error: finalError }
            })
          );
        }
      } catch (err: any) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', {
              detail: { status: 'error', error: err?.message }
            })
          );
        }
        if (!isCancelled && attempt <= 5) {
          const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
          retryTimeoutId = setTimeout(() => {
            if (!isCancelled && !hasCompletedInitialCheckRef.current) {
              runBootstrap(uid, attempt + 1);
            }
          }, delay);
        }
      } finally {
        isBootstrapInFlightRef.current = false;
        // If any pending remote or local work remains after bootstrap, drain it via the coordinator
        if (!isCancelled && currentUserUidRef.current) {
          coordinator.resumePendingWork();
        }
      }
    };

    const unsubAuth = subscribeTeacherAuth(async (user) => {
      if (unsubRemote) {
        unsubRemote();
        unsubRemote = null;
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }

      if (!user) {
        currentUserUidRef.current = null;
        hasCompletedInitialCheckRef.current = false;
        coordinator = createCoordinatorForUser(undefined);
        return;
      }

      currentUserUidRef.current = user.uid;
      coordinator = createCoordinatorForUser(user.uid);
      await runBootstrap(user.uid);
      if (isCancelled) return;

      // Attach live `onSnapshot` listener for real-time multi-device sync
      // Never drops snapshots when busy: enqueues into the durable serialized coordinator!
      unsubRemote = subscribeToRemoteWorkspaceChanges(
        user.uid,
        async (remoteBackupJson, _updatedAtIso, _summary, docTokens) => {
          if (isCancelled || !isAutoCloudSyncEnabled()) return;
          await coordinator.enqueueRemoteSnapshot(remoteBackupJson, docTokens);
        }
      );
    });

    // Android WebView / Vercel lifecycle & network recovery handlers
    const handleResumeOrOnline = async () => {
      const uid = currentUserUidRef.current;
      if (!uid || isCancelled || !isAutoCloudSyncEnabled()) return;

      // Always resume any durable pending remote work first
      await coordinator.resumePendingWork();

      if (!hasCompletedInitialCheckRef.current) {
        await runBootstrap(uid);
        return;
      }

      // On network reconnect or foreground resume, check for any missed remote updates and flush pending local edits
      try {
        const remoteRes = await downloadWorkspaceFromGoogleCloud();
        if (!isCancelled && remoteRes.hasRemoteData && remoteRes.backupJsonStr) {
          await coordinator.enqueueRemoteSnapshot(
            remoteRes.backupJsonStr,
            remoteRes.docTokens
          );
        }
      } catch {
        // Ignore transient offline read error
      }

      if (!isCancelled && hasPendingLocalPushFlag(uid)) {
        if (autoPushTimerRef.current) {
          clearTimeout(autoPushTimerRef.current);
          autoPushTimerRef.current = null;
        }
        coordinator.enqueueLocalPush();
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      const uid = currentUserUidRef.current;
      if (!uid || isCancelled || !isAutoCloudSyncEnabled()) return;

      if (document.visibilityState === 'hidden') {
        // When Android WebView or browser tab moves to background, immediately flush any pending debounced local changes
        if (autoPushTimerRef.current) {
          clearTimeout(autoPushTimerRef.current);
          autoPushTimerRef.current = null;
        }
        if (hasCompletedInitialCheckRef.current && hasPendingLocalPushFlag(uid)) {
          coordinator.enqueueLocalPush();
        }
      } else if (document.visibilityState === 'visible') {
        handleResumeOrOnline();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleResumeOrOnline);
      window.addEventListener('focus', handleResumeOrOnline);
      window.addEventListener('pageshow', handleResumeOrOnline);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    }

    return () => {
      isCancelled = true;
      coordinator.dispose();
      coordinatorRef.current = null;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (autoPushTimerRef.current) clearTimeout(autoPushTimerRef.current);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleResumeOrOnline);
        window.removeEventListener('focus', handleResumeOrOnline);
        window.removeEventListener('pageshow', handleResumeOrOnline);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      }
      unsubAuth();
      if (unsubRemote) unsubRemote();
    };
  }, [applyRemoteSnapshotPass, executeLocalPushPass]);

  // 2. Debounced Auto-Push whenever app data changes locally
  useEffect(() => {
    const uid = currentUserUidRef.current;
    if (!uid || !hasCompletedInitialCheckRef.current || !isAutoCloudSyncEnabled()) {
      return;
    }

    // If this state change was produced by importing a remote snapshot with no prior local dirty state,
    // refresh lastUploadedSnapshotRef with the post-render snapshot and do not trigger an echo upload.
    if (syncBaselineAfterRemoteImportRef.current) {
      syncBaselineAfterRemoteImportRef.current = false;
      performBackupRef
        .current()
        .then((snapStr) => {
          lastUploadedSnapshotRef.current = stripSnapshotTimestamp(snapStr);
        })
        .catch(() => {});
      return;
    }

    if (isApplyingRemoteRef.current) {
      return;
    }

    let isEffectCancelled = false;

    performBackupRef
      .current()
      .then((snapStr) => {
        if (isEffectCancelled) return;
        const normalizedSnap = stripSnapshotTimestamp(snapStr);
        if (normalizedSnap === lastUploadedSnapshotRef.current && !hasPendingLocalPushFlag(uid)) {
          return;
        }

        // Persist dirty flag immediately so Android backgrounding/reload or offline state never loses this pending push
        setPendingLocalPushFlag(uid, true);

        if (isFirestoreWriteQuotaExhaustedToday()) {
          return;
        }

        if (autoPushTimerRef.current) {
          clearTimeout(autoPushTimerRef.current);
        }

        autoPushTimerRef.current = setTimeout(() => {
          autoPushTimerRef.current = null;
          if (
            !currentUserUidRef.current ||
            !hasCompletedInitialCheckRef.current ||
            !isAutoCloudSyncEnabled() ||
            isFirestoreWriteQuotaExhaustedToday()
          ) {
            return;
          }
          coordinatorRef.current?.enqueueLocalPush();
        }, AUTO_PUSH_DEBOUNCE_MS);
      })
      .catch(() => {});

    return () => {
      isEffectCancelled = true;
    };
  }, [
    students,
    groups,
    lessons,
    payments,
    certificates,
    todos,
    profile,
    theme,
    accentColor,
    notificationSettings,
    inspirationSettings,
    inspirationMessages,
    hodStudents,
    hodComplaints,
    hodActionPlans,
    hodVisits,
    schoolNotes,
    financeAccounts,
    financeCategories,
    financeTransactions,
    financeRecurring,
    financeInstallments,
    financeNotifications,
    goldHoldings,
    lernstudioSets,
    recentlyDeleted,
    dismissedDashboardLessonIds,
    localMutationTick
  ]);
}
