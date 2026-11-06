import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  subscribeTeacherAuth,
  isAutoCloudSyncEnabled,
  uploadWorkspaceToGoogleCloud,
  downloadWorkspaceFromGoogleCloud,
  subscribeToRemoteWorkspaceChanges
} from '../services/firebaseWorkspaceSync';

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

          if (cloudRes.hasRemoteData && cloudRes.backupJsonStr && !localHasData) {
            // Fresh device / browser: automatically pull everything from Google Cloud!
            isApplyingRemoteRef.current = true;
            await importBackupFile(cloudRes.backupJsonStr);
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 2500);
          } else if (!cloudRes.hasRemoteData && localHasData) {
            // First time linking Google account on a populated device: push everything to Cloud!
            const snapStr = await performBackup();
            await uploadWorkspaceToGoogleCloud(snapStr);
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
            await importBackupFile(remoteBackupJson);
            window.dispatchEvent(
              new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'synced' } })
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
    if (!currentUserUidRef.current || !isAutoCloudSyncEnabled() || isApplyingRemoteRef.current) {
      return;
    }

    if (autoPushTimerRef.current) {
      clearTimeout(autoPushTimerRef.current);
    }

    autoPushTimerRef.current = setTimeout(async () => {
      if (!currentUserUidRef.current || !isAutoCloudSyncEnabled() || isApplyingRemoteRef.current) {
        return;
      }
      try {
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'syncing' } })
        );
        const snapStr = await performBackup();
        const res = await uploadWorkspaceToGoogleCloud(snapStr);
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', {
            detail: { status: res.success ? 'synced' : 'error', error: res.error }
          })
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent('gluck-cloud-sync-status', { detail: { status: 'error' } })
        );
      }
    }, 3500);

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
