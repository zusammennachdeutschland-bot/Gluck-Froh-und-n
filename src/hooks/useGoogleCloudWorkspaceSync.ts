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
  getCloudSyncControlState
} from '../services/firebaseWorkspaceSync';

function stripSnapshotTimestamp(jsonStr: string): string {
  return (jsonStr || '').replace(/"timestamp":"[^"]*",?/, '');
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

const inMemoryPendingPushByUid = new Map<string, boolean>();

export function setPendingLocalPushFlag(uid: string, pending: boolean): void {
  if (!uid) return;
  if (pending) {
    inMemoryPendingPushByUid.set(uid, true);
  } else {
    inMemoryPendingPushByUid.delete(uid);
  }
  if (typeof window !== 'undefined') {
    try {
      const key = `gluck_cloud_pending_local_push_${uid}`;
      if (pending) {
        localStorage.setItem(key, '1');
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  }
}

export function hasPendingLocalPushFlag(uid: string): boolean {
  if (!uid) return false;
  if (inMemoryPendingPushByUid.get(uid)) return true;
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(`gluck_cloud_pending_local_push_${uid}`) === '1';
    } catch {
      return false;
    }
  }
  return false;
}

export function clearPendingLocalPushFlag(uid: string): void {
  setPendingLocalPushFlag(uid, false);
}

export interface SerializedSyncCoordinatorOptions {
  onApplyRemotePayload: (remoteJsonStr: string) => Promise<boolean>;
  onExecuteLocalPush: () => Promise<boolean>;
  onError?: (err: unknown, phase: 'remote_pull' | 'local_push') => void;
}

export interface SerializedSyncCoordinator {
  enqueueRemoteSnapshot: (remoteJsonStr: string) => Promise<boolean>;
  enqueueLocalPush: () => Promise<boolean>;
  isBusy: () => boolean;
  getPendingRemoteCount: () => number;
  hasPendingLocal: () => boolean;
  dispose: () => void;
}

/**
 * Serialized, non-dropping synchronization coordinator.
 * Guarantees:
 * - Incoming remote snapshots arriving while another sync is in flight are queued and processed in order immediately after the current operation completes.
 * - Local pushes requested while a remote import or upload is in flight are queued and executed after pending remote snapshots have been merged.
 * - Errors in any single operation are caught and reported via `onError` without permanently blocking the queue.
 * - Disposing the coordinator prevents stale callbacks after unmount.
 */
export function createSerializedSyncCoordinator(
  options: SerializedSyncCoordinatorOptions
): SerializedSyncCoordinator {
  let isRunning = false;
  let isDisposed = false;
  const pendingRemoteQueue: string[] = [];
  let pendingLocalPush = false;
  let activeDrainPromise: Promise<boolean> | null = null;

  const drain = (): Promise<boolean> => {
    if (isDisposed) return Promise.resolve(false);
    if (isRunning && activeDrainPromise) {
      return activeDrainPromise;
    }

    isRunning = true;
    activeDrainPromise = (async () => {
      let lastOutcome = true;
      try {
        while (!isDisposed && (pendingRemoteQueue.length > 0 || pendingLocalPush)) {
          // Always process queued remote snapshots first so local state merges remote changes before pushing
          if (pendingRemoteQueue.length > 0) {
            const nextRemoteJson = pendingRemoteQueue.shift()!;
            try {
              const ok = await options.onApplyRemotePayload(nextRemoteJson);
              if (!ok) lastOutcome = false;
            } catch (err) {
              lastOutcome = false;
              options.onError?.(err, 'remote_pull');
            }
            continue;
          }

          if (pendingLocalPush) {
            pendingLocalPush = false;
            try {
              const ok = await options.onExecuteLocalPush();
              if (!ok) {
                lastOutcome = false;
              }
            } catch (err) {
              lastOutcome = false;
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
    enqueueRemoteSnapshot(remoteJsonStr: string): Promise<boolean> {
      if (isDisposed || !remoteJsonStr) return Promise.resolve(false);
      // Coalesce identical consecutive payloads in the pending queue while preserving distinct snapshots in order
      const lastQueued =
        pendingRemoteQueue.length > 0 ? pendingRemoteQueue[pendingRemoteQueue.length - 1] : null;
      if (lastQueued !== remoteJsonStr) {
        pendingRemoteQueue.push(remoteJsonStr);
      }
      return drain();
    },
    enqueueLocalPush(): Promise<boolean> {
      if (isDisposed) return Promise.resolve(false);
      pendingLocalPush = true;
      return drain();
    },
    isBusy(): boolean {
      return isRunning;
    },
    getPendingRemoteCount(): number {
      return pendingRemoteQueue.length;
    },
    hasPendingLocal(): boolean {
      return pendingLocalPush;
    },
    dispose(): void {
      isDisposed = true;
      pendingRemoteQueue.length = 0;
      pendingLocalPush = false;
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

  const applyRemoteSnapshotPass = useCallback(async (remoteBackupJson: string): Promise<boolean> => {
    const uid = currentUserUidRef.current;
    if (!uid || !isAutoCloudSyncEnabled()) return false;

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
      success = await importBackupFileRef.current(remoteBackupJson);
      if (success) {
        const postSnap = await performBackupRef.current();
        const postNormalized = stripSnapshotTimestamp(postSnap);
        if (!hadUnpushedLocalChanges) {
          lastUploadedSnapshotRef.current = postNormalized;
          syncBaselineAfterRemoteImportRef.current = true;
          clearPendingLocalPushFlag(uid);
        } else {
          // Local had unpushed changes that were merged with remote; ensure merged result is pushed
          setPendingLocalPushFlag(uid, true);
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
  }, []);

  // 1. Auth listener + real-time remote changes listener (`onSnapshot`) + initial cloud bootstrap + Android/WebView lifecycle handlers
  useEffect(() => {
    let unsubRemote: (() => void) | null = null;
    let isCancelled = false;
    let retryTimeoutId: any = null;

    const coordinator = createSerializedSyncCoordinator({
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
    coordinatorRef.current = coordinator;

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
          // Fresh device: automatically restore from Google Cloud
          isApplyingRemoteRef.current = true;
          let success = false;
          try {
            success = await importBackupFileRef.current(cloudRes.backupJsonStr);
          } finally {
            isApplyingRemoteRef.current = false;
          }
          if (success) {
            try {
              localStorage.setItem('dl_setup_completed', 'true');
              window.dispatchEvent(new CustomEvent('close-setup-wizard'));
            } catch {}
            const postImportSnap = await performBackupRef.current();
            lastUploadedSnapshotRef.current = stripSnapshotTimestamp(postImportSnap);
            syncBaselineAfterRemoteImportRef.current = true;
            clearPendingLocalPushFlag(uid);
          } else {
            finalStatus = 'error';
            finalError = 'تعذر استيراد البيانات السحابية.';
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
          // Both have data: Perform a real two-way merge
          isApplyingRemoteRef.current = true;
          let success = false;
          try {
            success = await importBackupFileRef.current(cloudRes.backupJsonStr);
          } finally {
            isApplyingRemoteRef.current = false;
          }
          if (!success) {
            finalStatus = 'error';
            finalError = 'تعذر دمج البيانات السحابية.';
          } else if (!isFirestoreWriteQuotaExhaustedToday()) {
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
        } else if (localHasData) {
          lastUploadedSnapshotRef.current = stripSnapshotTimestamp(localSnapStr);
        }

        // Only mark initial check completed if bootstrap actually completed without error
        if (finalStatus === 'synced') {
          hasCompletedInitialCheckRef.current = true;
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
        // If any local changes were flagged before/during bootstrap, drain them now
        if (
          !isCancelled &&
          hasCompletedInitialCheckRef.current &&
          currentUserUidRef.current &&
          hasPendingLocalPushFlag(currentUserUidRef.current)
        ) {
          coordinator.enqueueLocalPush();
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
        return;
      }

      currentUserUidRef.current = user.uid;
      await runBootstrap(user.uid);
      if (isCancelled) return;

      // Attach live `onSnapshot` listener for real-time multi-device sync
      // Never drops snapshots when busy: enqueues into the serialized coordinator!
      unsubRemote = subscribeToRemoteWorkspaceChanges(
        user.uid,
        async (remoteBackupJson) => {
          if (isCancelled || !isAutoCloudSyncEnabled()) return;
          await coordinator.enqueueRemoteSnapshot(remoteBackupJson);
        }
      );
    });

    // Android WebView / Vercel lifecycle & network recovery handlers
    const handleResumeOrOnline = async () => {
      const uid = currentUserUidRef.current;
      if (!uid || isCancelled || !isAutoCloudSyncEnabled()) return;

      if (!hasCompletedInitialCheckRef.current) {
        await runBootstrap(uid);
        return;
      }

      // On network reconnect or foreground resume, check for any missed remote updates and flush pending local edits
      try {
        const remoteRes = await downloadWorkspaceFromGoogleCloud();
        if (!isCancelled && remoteRes.hasRemoteData && remoteRes.backupJsonStr) {
          await coordinator.enqueueRemoteSnapshot(remoteRes.backupJsonStr);
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
