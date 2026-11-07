import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  subscribeTeacherAuth,
  isAutoCloudSyncEnabled,
  setAutoCloudSyncEnabled,
  uploadWorkspaceToGoogleCloud,
  downloadWorkspaceFromGoogleCloud,
  subscribeToRemoteWorkspaceChanges,
  isFirestoreWriteQuotaExhaustedToday
} from '../services/firebaseWorkspaceSync';

function stripSnapshotTimestamp(jsonStr: string): string {
  return (jsonStr || '').replace(/"timestamp":"[^"]*",?/, '');
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
  const isApplyingRemoteRef = useRef<boolean>(false);
  const hasCompletedInitialCheckRef = useRef<boolean>(false);
  const autoPushTimerRef = useRef<any>(null);
  const lastUploadedSnapshotRef = useRef<string | null>(null);
  const quotaExceededRef = useRef<boolean>(false);

  // 1. Auth listener + real-time remote changes listener (`onSnapshot`) + initial cloud bootstrap
  useEffect(() => {
    let unsubRemote: (() => void) | null = null;

    const unsubAuth = subscribeTeacherAuth(async (user) => {
      if (unsubRemote) {
        unsubRemote();
        unsubRemote = null;
      }

      if (!user) {
        currentUserUidRef.current = null;
        hasCompletedInitialCheckRef.current = false;
        return;
      }

      currentUserUidRef.current = user.uid;

      // Initial check on sign-in / boot
      if (!hasCompletedInitialCheckRef.current && isAutoCloudSyncEnabled()) {
        hasCompletedInitialCheckRef.current = true;
        try {
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
          );
          const cloudRes = await downloadWorkspaceFromGoogleCloud();
          const localSnapStr = await performBackup();
          const hasAnyWorkspaceData = (jsonStr: string | null): boolean => {
            if (!jsonStr) return false;
            try {
              const p = JSON.parse(jsonStr);
              const collectionKeys = [
                'students',
                'groups',
                'lessons',
                'payments',
                'certificates',
                'todos',
                'hodStudents',
                'hodComplaints',
                'hodActionPlans',
                'hodVisits',
                'schoolNotes',
                'financeAccounts',
                'financeTransactions',
                'financeRecurring',
                'financeInstallments',
                'goldHoldings',
                'homeworkAssignments',
                'homeworkSubmissions',
                'pickerNames'
              ];
              return collectionKeys.some((k) => Array.isArray(p[k]) && p[k].length > 0);
            } catch {
              return false;
            }
          };

          const localHasData = hasAnyWorkspaceData(localSnapStr);
          const remoteHasActualData = cloudRes.hasRemoteData && hasAnyWorkspaceData(cloudRes.backupJsonStr);

          let finalStatus: 'synced' | 'error' = 'synced';
          let finalError: string | undefined;

          if (remoteHasActualData && !localHasData && cloudRes.backupJsonStr) {
            // Fresh device / browser: automatically pull everything from Google Cloud!
            isApplyingRemoteRef.current = true;
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
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 2500);
          } else if (!remoteHasActualData && localHasData && !isFirestoreWriteQuotaExhaustedToday()) {
            // Cloud is completely empty and local has data: seed cloud once
            const res = await uploadWorkspaceToGoogleCloud(localSnapStr);
            if (res.success) {
              lastUploadedSnapshotRef.current = stripSnapshotTimestamp(localSnapStr);
            } else {
              finalStatus = 'error';
              finalError = res.error;
            }
          } else if (localHasData && remoteHasActualData && cloudRes.backupJsonStr) {
            // Both local and cloud have data on boot: Perform a two-way merge
            isApplyingRemoteRef.current = true;
            const success = await importBackupFile(cloudRes.backupJsonStr);
            if (!success) {
              finalStatus = 'error';
              finalError = 'تعذر دمج البيانات السحابية.';
            } else if (!isFirestoreWriteQuotaExhaustedToday()) {
              // After merging (which updates local storage), push any local-only changes back to cloud
              const mergedSnapStr = await performBackup();
              const uploadRes = await uploadWorkspaceToGoogleCloud(mergedSnapStr);
              if (uploadRes.success) {
                lastUploadedSnapshotRef.current = stripSnapshotTimestamp(mergedSnapStr);
              } else {
                finalStatus = 'error';
                finalError = uploadRes.error;
              }
            }

            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 2500);
          } else if (localHasData) {
            lastUploadedSnapshotRef.current = stripSnapshotTimestamp(localSnapStr);
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
        }
      }

      // Attach live `onSnapshot` listener for changes made on other devices
      unsubRemote = subscribeToRemoteWorkspaceChanges(
        user.uid,
        async (remoteBackupJson) => {
          if (!isAutoCloudSyncEnabled()) return;
          try {
            isApplyingRemoteRef.current = true;
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
            );
            const success = await importBackupFile(remoteBackupJson);
            if (success) {
              const postSnap = await performBackup();
              lastUploadedSnapshotRef.current = stripSnapshotTimestamp(postSnap);
            }
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', { detail: { status: success ? 'synced' : 'error' } })
            );
          } finally {
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 2500);
          }
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubRemote) unsubRemote();
    };
  }, []);

  // 2. Debounced Auto-Push whenever any app data changes locally
  useEffect(() => {
    if (
      !currentUserUidRef.current ||
      !isAutoCloudSyncEnabled() ||
      isApplyingRemoteRef.current ||
      isFirestoreWriteQuotaExhaustedToday()
    ) {
      return;
    }

    if (autoPushTimerRef.current) {
      clearTimeout(autoPushTimerRef.current);
    }

    autoPushTimerRef.current = setTimeout(async () => {
      if (
        !currentUserUidRef.current ||
        !isAutoCloudSyncEnabled() ||
        isApplyingRemoteRef.current ||
        isFirestoreWriteQuotaExhaustedToday()
      ) {
        return;
      }
      try {
        const snapStr = await performBackup();
        const normalizedSnap = stripSnapshotTimestamp(snapStr);
        // Skip upload if snapshot content hasn't changed since last successful upload
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
      }
    }, 45000);

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
    lernstudioSets
  ]);
}
