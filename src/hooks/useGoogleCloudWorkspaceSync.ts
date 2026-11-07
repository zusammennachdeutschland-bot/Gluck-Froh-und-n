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
          const localHasData =
            students.length > 0 ||
            groups.length > 0 ||
            lessons.length > 0 ||
            payments.length > 0 ||
            financeTransactions.length > 0;

          const remoteHasActualData = cloudRes.hasRemoteData && cloudRes.backupJsonStr && (() => {
            try {
              const p = JSON.parse(cloudRes.backupJsonStr);
              return (p.students?.length > 0 || p.groups?.length > 0 || p.lessons?.length > 0);
            } catch {
              return false;
            }
          })();

          if (remoteHasActualData && !localHasData) {
            // Fresh device / browser: automatically pull everything from Google Cloud!
            isApplyingRemoteRef.current = true;
            const success = await importBackupFile(cloudRes.backupJsonStr);
            if (success) {
              try {
                localStorage.setItem('dl_setup_completed', 'true');
                window.dispatchEvent(new CustomEvent('close-setup-wizard'));
              } catch {}
            }
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 2500);
          } else if (!remoteHasActualData && localHasData && !isFirestoreWriteQuotaExhaustedToday()) {
            // Cloud is completely empty and local has data: seed cloud once
            const snapStr = await performBackup();
            const res = await uploadWorkspaceToGoogleCloud(snapStr);
            if (res.success) {
              lastUploadedSnapshotRef.current = stripSnapshotTimestamp(snapStr);
            }
          } else if (localHasData && remoteHasActualData) {
            // Both local and cloud have data on boot: Perform a two-way merge
            console.log('Synchronizing: Both local and cloud have data. Merging...');
            isApplyingRemoteRef.current = true;
            const success = await importBackupFile(cloudRes.backupJsonStr);
            
            // After merging (which updates local state), push the merged state back to cloud
            if (success && !isFirestoreWriteQuotaExhaustedToday()) {
              const mergedSnapStr = await performBackup();
              const uploadRes = await uploadWorkspaceToGoogleCloud(mergedSnapStr);
              if (uploadRes.success) {
                lastUploadedSnapshotRef.current = stripSnapshotTimestamp(mergedSnapStr);
              }
            }

            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 2500);
          } else if (localHasData) {
            // Local data exists but cloud check failed or is empty/invalid
            const snapStr = await performBackup();
            lastUploadedSnapshotRef.current = stripSnapshotTimestamp(snapStr);
          }
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'synced' } })
          );
        } catch {
          window.dispatchEvent(
            new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'error' } })
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
      quotaExceededRef.current ||
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
        quotaExceededRef.current ||
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
        } else if (res.error && (res.error.includes('resource-exhausted') || res.error.includes('Quota'))) {
          quotaExceededRef.current = true;
          setAutoCloudSyncEnabled(false);
          console.warn('Firestore free tier quota exceeded. Auto-sync paused to protect quota.');
        }

        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', {
            detail: { status: res.success ? 'synced' : 'error', error: res.error }
          })
        );
      } catch (err: any) {
        if (err?.message?.includes('resource-exhausted') || err?.message?.includes('Quota')) {
          quotaExceededRef.current = true;
          setAutoCloudSyncEnabled(false);
        }
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'error' } })
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
