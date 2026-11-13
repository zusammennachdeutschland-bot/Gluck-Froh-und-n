import { useCallback, useEffect, useState } from 'react';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  applyCloudAssignmentsSnapshot,
  getCurrentHomeworkOwnerUid,
  getLocalAssignments,
  getLocalSubmissions,
  isAssignmentDeletedLocally,
  sanitizeDocId,
  saveLocalSubmission,
  subscribeAssignmentsFromFirestore,
  subscribeSubmissionsFromFirestore,
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
 * Shared React hook providing live-synced, account-isolated HomeworkAssignments
 * and HomeworkSubmissions for reports, widgets, and follow-up components.
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
      // Immediately re-scope / clear previous account data before syncing
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

    let unsubAssignments = () => {};
    let unsubSubmissions = () => {};

    if (ownerUid) {
      syncAndFetchTeacherAssignments()
        .then(() => reloadLocalSnapshot(ownerUid))
        .catch(() => {});

      unsubAssignments = subscribeAssignmentsFromFirestore((cloudHwList) => {
        applyCloudAssignmentsSnapshot(cloudHwList, ownerUid, ownerUid);
        reloadLocalSnapshot(ownerUid);
      }, ownerUid);

      unsubSubmissions = subscribeSubmissionsFromFirestore(
        null,
        (cloudSubs) => {
          const activeIds = new Set(
            getLocalAssignments(ownerUid).flatMap((a) => [a.id, sanitizeDocId(a.id)])
          );
          cloudSubs.forEach((sub) => {
            if (sub.ownerUid && sub.ownerUid !== ownerUid) return;
            if (
              !isAssignmentDeletedLocally(sub.assignmentId, ownerUid) &&
              (activeIds.has(sub.assignmentId) || activeIds.has(sanitizeDocId(sub.assignmentId)))
            ) {
              saveLocalSubmission({ ...sub, ownerUid, cloudSynced: true }, false);
            }
          });
          reloadLocalSnapshot(ownerUid);
        },
        ownerUid
      );
    }

    return () => {
      window.removeEventListener('glueck-homework-sync-updated', handleLocalMutation);
      window.removeEventListener('gluck-homework-deleted', handleLocalMutation);
      window.removeEventListener('gluck-homework-restored', handleLocalMutation);
      window.removeEventListener('storage', handleLocalMutation);
      unsubAssignments();
      unsubSubmissions();
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
