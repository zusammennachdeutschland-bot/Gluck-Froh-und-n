import { useCallback, useEffect, useState } from 'react';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  getCurrentHomeworkOwnerUid,
  getLocalAssignments,
  getLocalSubmissions,
  subscribeTeacherAuth,
  syncAndFetchTeacherAssignments
} from '../shared/homeworkStorageSync';

export interface SyncedHomeworkDataState {
  assignments: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  loading: boolean;
  isAuthenticated: boolean;
  currentOwnerUid: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared React hook providing account-isolated HomeworkAssignments and HomeworkSubmissions.
 * Quota-optimized: reads from local authoritative storage and P2P sync events by default,
 * and fetches from Homework Cloud on-demand when `refresh()` is explicitly invoked.
 */
export function useSyncedHomeworkData(): SyncedHomeworkDataState {
  const [ownerUid, setOwnerUid] = useState<string | null>(() => getCurrentHomeworkOwnerUid());
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>(() =>
    getLocalAssignments(ownerUid)
  );
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>(() =>
    getLocalSubmissions(ownerUid)
  );
  const [loading, setLoading] = useState<boolean>(false);

  const reloadLocalSnapshot = useCallback((uidOverride?: string | null) => {
    const activeUid = uidOverride !== undefined ? uidOverride : getCurrentHomeworkOwnerUid();
    setAssignments(getLocalAssignments(activeUid));
    setSubmissions(getLocalSubmissions(activeUid));
  }, []);

  const refresh = useCallback(async () => {
    const uid = getCurrentHomeworkOwnerUid();
    setLoading(true);
    try {
      await syncAndFetchTeacherAssignments(undefined, { force: true });
    } catch {
      // Keep local snapshot if offline
    } finally {
      reloadLocalSnapshot(uid);
      setLoading(false);
    }
  }, [reloadLocalSnapshot]);

  useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((user) => {
      const nextUid = user?.uid?.trim() || null;
      setOwnerUid(nextUid);
      setAssignments(getLocalAssignments(nextUid));
      setSubmissions(getLocalSubmissions(nextUid));
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    reloadLocalSnapshot(ownerUid);

    const handleLocalMutation = () => {
      reloadLocalSnapshot(getCurrentHomeworkOwnerUid());
    };

    window.addEventListener('glueck-homework-sync-updated', handleLocalMutation);
    window.addEventListener('gluck-homework-deleted', handleLocalMutation);
    window.addEventListener('gluck-homework-restored', handleLocalMutation);
    window.addEventListener('storage', handleLocalMutation);

    return () => {
      window.removeEventListener('glueck-homework-sync-updated', handleLocalMutation);
      window.removeEventListener('gluck-homework-deleted', handleLocalMutation);
      window.removeEventListener('gluck-homework-restored', handleLocalMutation);
      window.removeEventListener('storage', handleLocalMutation);
    };
  }, [ownerUid, reloadLocalSnapshot]);

  return {
    assignments,
    submissions,
    loading,
    isAuthenticated: Boolean(ownerUid),
    currentOwnerUid: ownerUid,
    refresh
  };
}

