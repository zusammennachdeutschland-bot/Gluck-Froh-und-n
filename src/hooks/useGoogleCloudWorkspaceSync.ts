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
    const p = JSON.parse(jsonStr);
    if (!p || typeof p !== 'object') return false;

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
      'inspirationMessages'
    ];

    for (const key of collectionKeys) {
      if (Array.isArray(p[key]) && p[key].length > 0) {
        return true;
      }
    }

    // 2. Check Custom Lernstudio Sets created by teacher
    if (Array.isArray(p.lernstudioSets)) {
      const hasCustomSet = p.lernstudioSets.some(
        (s: any) => s && s.id && !BUILTIN_LERNSTUDIO_MAP.has(s.id)
      );
      if (hasCustomSet) return true;
    }

    // 3. Check custom AI backgrounds
    if (
      (Array.isArray(p.customAiBackgrounds) && p.customAiBackgrounds.length > 0) ||
      (Array.isArray(p.profile?.customAiBackgrounds) && p.profile.customAiBackgrounds.length > 0)
    ) {
      return true;
    }

    // 4. Check teacher profile customization
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

    // 5. Check schoolSettings customization
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
    goldHoldings,
    lernstudioSets,
    performBackup,
    importBackupFile
  } = useApp();

  const currentUserUidRef = useRef<string | null>(null);
  const isSyncInFlightRef = useRef<boolean>(false);
  const hasCompletedInitialCheckRef = useRef<boolean>(false);
  const autoPushTimerRef = useRef<any>(null);
  const lastUploadedSnapshotRef = useRef<string | null>(null);
  const [localMutationTick, setLocalMutationTick] = useState<number>(0);

  // Listen to unified local data mutations (like homework, picker names, custom backgrounds saved directly)
  useEffect(() => {
    const handleLocalMutation = () => {
      setLocalMutationTick((t) => t + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('gluck-local-data-mutated', handleLocalMutation);
      return () => {
        window.removeEventListener('gluck-local-data-mutated', handleLocalMutation);
      };
    }
  }, []);

  // 1. Auth listener + real-time remote changes listener (`onSnapshot`) + initial cloud bootstrap with Exponential Backoff
  useEffect(() => {
    let unsubRemote: (() => void) | null = null;
    let isCancelled = false;
    let retryTimeoutId: any = null;

    const runBootstrap = async (uid: string, attempt = 1) => {
      if (isCancelled || hasCompletedInitialCheckRef.current || !isAutoCloudSyncEnabled() || isSyncInFlightRef.current) {
        return;
      }

      isSyncInFlightRef.current = true;
      try {
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
        );

        // Check Cloud-side pause and generation marker FIRST
        const controlState = await getCloudSyncControlState(uid);
        if (controlState.isPaused) {
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', {
              detail: { status: 'idle', error: 'المزامنة السحابية متوقفة مؤقتاً لهذا الحساب.' }
            })
          );
          return;
        }

        const cloudRes = await downloadWorkspaceFromGoogleCloud();
        if (cloudRes.error) {
          // Network or permission failure: do NOT mark initial check completed!
          // Never interpret a network error as an empty workspace!
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', {
              detail: { status: 'error', error: cloudRes.error }
            })
          );

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

        const localSnapStr = await performBackup();
        const localHasData = hasAnyWorkspaceData(localSnapStr);
        const remoteHasActualData = cloudRes.hasRemoteData && hasAnyWorkspaceData(cloudRes.backupJsonStr);

        let finalStatus: 'synced' | 'error' = 'synced';
        let finalError: string | undefined;

        if (remoteHasActualData && !localHasData && cloudRes.backupJsonStr) {
          // Fresh device: automatically restore from Google Cloud
          const success = await importBackupFile(cloudRes.backupJsonStr);
          if (success) {
            try {
              localStorage.setItem('dl_setup_completed', 'true');
              window.dispatchEvent(new CustomEvent('close-setup-wizard'));
            } catch {}
            const postImportSnap = await performBackup();
            lastUploadedSnapshotRef.current = stripSnapshotTimestamp(postImportSnap);
          } else {
            finalStatus = 'error';
            finalError = 'تعذر استيراد البيانات السحابية.';
          }
        } else if (!remoteHasActualData && localHasData && !isFirestoreWriteQuotaExhaustedToday()) {
          // Cloud is genuinely verified as completely empty and local has data: seed cloud once
          const res = await uploadWorkspaceToGoogleCloud(localSnapStr, { forceFullBaseline: true });
          if (res.success) {
            lastUploadedSnapshotRef.current = stripSnapshotTimestamp(localSnapStr);
          } else {
            finalStatus = 'error';
            finalError = res.error;
          }
        } else if (localHasData && remoteHasActualData && cloudRes.backupJsonStr) {
          // Both have data: Perform a real two-way merge
          const success = await importBackupFile(cloudRes.backupJsonStr);
          if (!success) {
            finalStatus = 'error';
            finalError = 'تعذر دمج البيانات السحابية.';
          } else if (!isFirestoreWriteQuotaExhaustedToday()) {
            const mergedSnapStr = await performBackup();
            const uploadRes = await uploadWorkspaceToGoogleCloud(mergedSnapStr);
            if (uploadRes.success) {
              lastUploadedSnapshotRef.current = stripSnapshotTimestamp(mergedSnapStr);
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

        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', {
            detail: { status: finalStatus, error: finalError }
          })
        );
      } catch (err: any) {
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', {
            detail: { status: 'error', error: err?.message }
          })
        );
        if (!isCancelled && attempt <= 5) {
          const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
          retryTimeoutId = setTimeout(() => {
            if (!isCancelled && !hasCompletedInitialCheckRef.current) {
              runBootstrap(uid, attempt + 1);
            }
          }, delay);
        }
      } finally {
        isSyncInFlightRef.current = false;
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

      // Attach live `onSnapshot` listener for real-time multi-device sync
      unsubRemote = subscribeToRemoteWorkspaceChanges(
        user.uid,
        async (remoteBackupJson) => {
          if (!isAutoCloudSyncEnabled() || isSyncInFlightRef.current || isCancelled) return;
          isSyncInFlightRef.current = true;
          try {
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
            );
            const success = await importBackupFile(remoteBackupJson);
            if (success) {
              const postSnap = await performBackup();
              lastUploadedSnapshotRef.current = stripSnapshotTimestamp(postSnap);
            }
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', {
                detail: { status: success ? 'synced' : 'error' }
              })
            );
          } finally {
            isSyncInFlightRef.current = false;
          }
        }
      );
    });

    const handleOnline = () => {
      if (currentUserUidRef.current && !hasCompletedInitialCheckRef.current) {
        runBootstrap(currentUserUidRef.current);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      isCancelled = true;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      unsubAuth();
      if (unsubRemote) unsubRemote();
    };
  }, [importBackupFile, performBackup]);

  // 2. Debounced Auto-Push (15s debounce) whenever app data changes locally
  useEffect(() => {
    // CRITICAL: Never allow Auto-Push to seed the cloud while the initial cloud state is unknown!
    if (
      !currentUserUidRef.current ||
      !hasCompletedInitialCheckRef.current ||
      !isAutoCloudSyncEnabled() ||
      isSyncInFlightRef.current ||
      isFirestoreWriteQuotaExhaustedToday()
    ) {
      return;
    }

    if (autoPushTimerRef.current) {
      clearTimeout(autoPushTimerRef.current);
    }

    // 15 seconds debounce as selected to preserve daily Firestore quota
    autoPushTimerRef.current = setTimeout(async () => {
      if (
        !currentUserUidRef.current ||
        !hasCompletedInitialCheckRef.current ||
        !isAutoCloudSyncEnabled() ||
        isSyncInFlightRef.current ||
        isFirestoreWriteQuotaExhaustedToday()
      ) {
        return;
      }

      isSyncInFlightRef.current = true;
      try {
        const snapStr = await performBackup();
        const normalizedSnap = stripSnapshotTimestamp(snapStr);
        if (normalizedSnap === lastUploadedSnapshotRef.current) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
        );
        const res = await uploadWorkspaceToGoogleCloud(snapStr);
        if (res.success) {
          lastUploadedSnapshotRef.current = normalizedSnap;
        }

        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', {
            detail: { status: res.success ? 'synced' : 'error', error: res.error }
          })
        );
      } catch (err: any) {
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', {
            detail: { status: 'error', error: err?.message }
          })
        );
      } finally {
        isSyncInFlightRef.current = false;
      }
    }, 15000);

    return () => {
      if (autoPushTimerRef.current) {
        clearTimeout(autoPushTimerRef.current);
      }
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
    goldHoldings,
    lernstudioSets,
    localMutationTick,
    performBackup
  ]);
}
