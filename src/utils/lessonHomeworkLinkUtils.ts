import { Group, Lesson, Student } from '../types';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  buildHomeworkShareUrl,
  deduplicateSubmissions,
  getAuthorizedGroupStudentsForAssignment,
  getSubmissionIdentityKey,
  isAssignmentDeletedLocally,
  isHomeworkAssignmentOpenForStudents,
  isShortIdRevokedLocally,
  isValidHomeworkShortId,
  resolveAssignmentAudienceMode,
  sanitizeDocId
} from '../shared/homeworkStorageSync';
import { compareLessonsChronologically, normalizeName } from './lessonUtils';

export type OnlineHomeworkLinkStatus =
  | 'active'
  | 'deleted'
  | 'revoked'
  | 'closed'
  | 'not_found'
  | 'unauthorized'
  | 'pending_sync';

export interface OnlineHomeworkValidationResult {
  isValid: boolean;
  isAvailableInTeacherReport: boolean;
  isPendingSync: boolean;
  status: OnlineHomeworkLinkStatus;
  assignment: HomeworkAssignment | null;
  assignmentId: string;
  title: string;
  shortId?: string;
  shareUrl: string | null;
  statusLabelAr: string;
  statusLabelEn: string;
  statusLabelDe: string;
}

export interface OnlineHomeworkValidationOptions {
  currentOwnerUid?: string | null;
  deletedIds?: Set<string>;
  revokedShortIds?: Set<string>;
  overrideDomain?: string;
  ignoreBrowserLocalFlags?: boolean;
  lessonGroupId?: string;
  cachedShortId?: string;
  cachedTitle?: string;
}

function isAssignmentCloudCreatePending(hw: Partial<HomeworkAssignment> | null | undefined): boolean {
  if (!hw) return false;
  return hw.cloudSynced === false && Boolean((hw as any).cloudCreatePending);
}

/**
 * Validates whether an Online Homework assignment & its internal Short Link are currently
 * active, synced, owned by the teacher scope, and safe to share with students/parents.
 */
export function isOnlineHomeworkValid(
  assignment: HomeworkAssignment | null | undefined,
  options: OnlineHomeworkValidationOptions = {}
): OnlineHomeworkValidationResult {
  const {
    currentOwnerUid,
    deletedIds,
    revokedShortIds,
    overrideDomain,
    ignoreBrowserLocalFlags = false,
    lessonGroupId,
    cachedShortId,
    cachedTitle
  } = options;

  if (!assignment || !assignment.id) {
    const cleanCachedShortId = (cachedShortId || '').trim();
    const cleanTitle = (cachedTitle || '').trim() || 'واجب أونلاين محذوف أو غير متاح';
    const isRevoked = Boolean(
      cleanCachedShortId &&
        (revokedShortIds?.has(cleanCachedShortId) ||
          (!ignoreBrowserLocalFlags && isShortIdRevokedLocally(cleanCachedShortId)))
    );
    return {
      isValid: false,
      isAvailableInTeacherReport: false,
      isPendingSync: false,
      status: isRevoked ? 'revoked' : 'not_found',
      assignment: null,
      assignmentId: '',
      title: cleanTitle,
      shortId: cleanCachedShortId || undefined,
      shareUrl: null,
      statusLabelAr: isRevoked ? 'تم حذف الواجب أو إيقاف الرابط' : 'الواجب غير موجود أو تم حذفه',
      statusLabelEn: isRevoked ? 'Assignment deleted or link revoked' : 'Assignment not found or deleted',
      statusLabelDe: isRevoked ? 'Aufgabe gelöscht oder Link widerrufen' : 'Aufgabe nicht gefunden oder gelöscht'
    };
  }

  const hwId = assignment.id;
  const safeId = sanitizeDocId(hwId);
  const hwTitle = (assignment.title || cachedTitle || '').trim() || 'واجب أونلاين';
  const rawShortId = (assignment.shortId || cachedShortId || '').trim();

  // 1. Account owner isolation check
  const cleanCurrentUid = (currentOwnerUid || '').trim();
  const cleanRecordUid = (assignment.ownerUid || '').trim();
  if (cleanCurrentUid && cleanRecordUid && cleanCurrentUid !== cleanRecordUid) {
    return {
      isValid: false,
      isAvailableInTeacherReport: false,
      isPendingSync: false,
      status: 'unauthorized',
      assignment: null,
      assignmentId: hwId,
      title: hwTitle,
      shareUrl: null,
      statusLabelAr: 'الواجب غير تابع لهذا الحساب',
      statusLabelEn: 'Assignment belongs to another account',
      statusLabelDe: 'Aufgabe gehört zu einem anderen Konto'
    };
  }

  // 2. Group isolation check when scoped to a group lesson
  const mode = resolveAssignmentAudienceMode(assignment);
  const cleanLessonGroup = (lessonGroupId || '').trim();
  const cleanHwGroup = (assignment.groupId || '').trim();
  if (
    cleanLessonGroup &&
    cleanLessonGroup !== 'quick_group' &&
    mode === 'group' &&
    cleanHwGroup &&
    cleanHwGroup !== 'all' &&
    cleanHwGroup !== cleanLessonGroup
  ) {
    return {
      isValid: false,
      isAvailableInTeacherReport: false,
      isPendingSync: false,
      status: 'unauthorized',
      assignment: null,
      assignmentId: hwId,
      title: hwTitle,
      shareUrl: null,
      statusLabelAr: 'الواجب مخصص لمجموعة أخرى',
      statusLabelEn: 'Assignment belongs to a different group',
      statusLabelDe: 'Aufgabe gehört zu einer anderen Gruppe'
    };
  }

  // 3. Deletion tombstone checks
  const isDeleted = Boolean(
    assignment.deleted ||
      assignment.status === 'deleted' ||
      deletedIds?.has(hwId) ||
      deletedIds?.has(safeId) ||
      (!ignoreBrowserLocalFlags && isAssignmentDeletedLocally(hwId, cleanRecordUid || cleanCurrentUid || null))
  );
  if (isDeleted) {
    return {
      isValid: false,
      isAvailableInTeacherReport: false,
      isPendingSync: false,
      status: 'deleted',
      assignment,
      assignmentId: hwId,
      title: hwTitle,
      shortId: rawShortId || undefined,
      shareUrl: null,
      statusLabelAr: 'تم حذف هذا الواجب',
      statusLabelEn: 'Assignment was deleted',
      statusLabelDe: 'Aufgabe wurde gelöscht'
    };
  }

  // 4. Revoked short ID check
  const isRevoked = Boolean(
    rawShortId &&
      (revokedShortIds?.has(rawShortId) ||
        (!ignoreBrowserLocalFlags && isShortIdRevokedLocally(rawShortId)))
  );
  if (isRevoked) {
    return {
      isValid: false,
      isAvailableInTeacherReport: true,
      isPendingSync: false,
      status: 'revoked',
      assignment,
      assignmentId: hwId,
      title: hwTitle,
      shortId: rawShortId,
      shareUrl: null,
      statusLabelAr: 'تم إيقاف رابط هذا الواجب',
      statusLabelEn: 'Homework link revoked',
      statusLabelDe: 'Aufgabenlink widerrufen'
    };
  }

  // 5. Closed / inactive status check
  if (!isHomeworkAssignmentOpenForStudents(assignment)) {
    return {
      isValid: false,
      isAvailableInTeacherReport: true,
      isPendingSync: false,
      status: 'closed',
      assignment,
      assignmentId: hwId,
      title: hwTitle,
      shortId: rawShortId || undefined,
      shareUrl: null,
      statusLabelAr: 'هذا الواجب مغلق أو موقوف حالياً',
      statusLabelEn: 'Assignment is closed or inactive',
      statusLabelDe: 'Aufgabe ist derzeit geschlossen'
    };
  }

  // 6. Pending cloud confirmation check (link must NOT be shown as ready before Firestore sync)
  if (isAssignmentCloudCreatePending(assignment)) {
    return {
      isValid: false,
      isAvailableInTeacherReport: true,
      isPendingSync: true,
      status: 'pending_sync',
      assignment,
      assignmentId: hwId,
      title: hwTitle,
      shortId: isValidHomeworkShortId(rawShortId) ? rawShortId : undefined,
      shareUrl: null,
      statusLabelAr: 'الواجب محفوظ محلياً وبانتظار مزامنة الرابط السحابية',
      statusLabelEn: 'Saved locally — waiting for cloud link sync',
      statusLabelDe: 'Lokal gespeichert — wartet auf Cloud-Synchronisierung'
    };
  }

  // 7. Build canonical share URL (short link if shortId exists, legacy fallback otherwise)
  let shareUrl: string | null = null;
  try {
    shareUrl = buildHomeworkShareUrl(assignment, overrideDomain);
  } catch {
    shareUrl = null;
  }

  return {
    isValid: Boolean(shareUrl),
    isAvailableInTeacherReport: true,
    isPendingSync: false,
    status: shareUrl ? 'active' : 'not_found',
    assignment,
    assignmentId: hwId,
    title: hwTitle,
    shortId: isValidHomeworkShortId(rawShortId) ? rawShortId : undefined,
    shareUrl,
    statusLabelAr: 'الواجب والرابط متاحان وجاهزان',
    statusLabelEn: 'Assignment & link are active',
    statusLabelDe: 'Aufgabe & Link sind aktiv'
  };
}

/**
 * Resolves the authoritative Online Homework linked to a specific lesson (`report.onlineHomeworkAssignmentId`).
 * Returns `null` if the lesson has no Online Homework attached.
 */
export function resolveLinkedOnlineHomeworkForLesson(
  lesson: Partial<Lesson> | null | undefined,
  assignments: HomeworkAssignment[],
  options: OnlineHomeworkValidationOptions = {}
): OnlineHomeworkValidationResult | null {
  const hwId = (lesson?.report?.onlineHomeworkAssignmentId || '').trim();
  if (!hwId) return null;

  const safeHwId = sanitizeDocId(hwId);
  const matched = (assignments || []).find(
    (a) => a && (a.id === hwId || sanitizeDocId(a.id) === safeHwId)
  );

  const cachedTitle = lesson?.report?.onlineHomeworkTitle;
  const cachedShortId = lesson?.report?.onlineHomeworkShortId;
  const lessonGroupId = lesson?.groupId;

  if (!matched) {
    const cleanDeleted = Boolean(
      options.deletedIds?.has(hwId) ||
        options.deletedIds?.has(safeHwId) ||
        (!options.ignoreBrowserLocalFlags && isAssignmentDeletedLocally(hwId, options.currentOwnerUid))
    );
    const cleanRevoked = Boolean(
      cachedShortId &&
        (options.revokedShortIds?.has(cachedShortId) ||
          (!options.ignoreBrowserLocalFlags && isShortIdRevokedLocally(cachedShortId)))
    );

    const status: OnlineHomeworkLinkStatus = cleanRevoked
      ? 'revoked'
      : cleanDeleted
      ? 'deleted'
      : 'not_found';

    return {
      isValid: false,
      isAvailableInTeacherReport: false,
      isPendingSync: false,
      status,
      assignment: null,
      assignmentId: hwId,
      title: (cachedTitle || '').trim() || 'واجب أونلاين محذوف',
      shortId: cachedShortId,
      shareUrl: null,
      statusLabelAr:
        status === 'revoked'
          ? 'تم إيقاف رابط الواجب'
          : status === 'deleted'
          ? 'تم حذف هذا الواجب من النظام'
          : 'الواجب المرتبط غير موجود أو تم حذفه',
      statusLabelEn:
        status === 'revoked'
          ? 'Homework link was revoked'
          : status === 'deleted'
          ? 'Linked homework was deleted'
          : 'Linked homework not found or deleted',
      statusLabelDe:
        status === 'revoked'
          ? 'Aufgabenlink wurde widerrufen'
          : status === 'deleted'
          ? 'Verknüpfte Aufgabe wurde gelöscht'
          : 'Verknüpfte Aufgabe nicht gefunden'
    };
  }

  return isOnlineHomeworkValid(matched, {
    ...options,
    lessonGroupId,
    cachedShortId,
    cachedTitle
  });
}

export interface PreviousLessonLookupOptions {
  requireCompletedOrReported?: boolean;
  requireOnlineHomework?: boolean;
  excludeLessonIds?: Iterable<string>;
}

/**
 * Finds the most recent prior eligible lesson (`!deleted && status !== 'cancelled'`)
 * strictly belonging to the same group or the same private student.
 * Never returns a lesson from a different group or a different student.
 */
export function findLatestEligiblePreviousLesson(
  targetLesson: Partial<Lesson> | null | undefined,
  allLessons: Lesson[],
  options: PreviousLessonLookupOptions = {}
): Lesson | null {
  if (!targetLesson || !Array.isArray(allLessons) || allLessons.length === 0) {
    return null;
  }

  const {
    requireCompletedOrReported = false,
    requireOnlineHomework = false,
    excludeLessonIds
  } = options;

  const excluded = new Set<string>();
  if (targetLesson.id) excluded.add(targetLesson.id);
  if (excludeLessonIds) {
    for (const id of excludeLessonIds) {
      if (id) excluded.add(id);
    }
  }

  const targetGroupId = (targetLesson.groupId || '').trim();
  const isTargetGroupLesson = Boolean(targetGroupId && targetGroupId !== 'quick_group');
  const targetStudentId = (targetLesson.studentId || '').trim();
  const targetStudentNameNorm = normalizeName(
    targetLesson.studentName || (targetLesson as any).quickStudentName
  );

  if (!isTargetGroupLesson && !targetStudentId && !targetStudentNameNorm) {
    return null;
  }

  const hasTargetDate = Boolean(targetLesson.date && targetLesson.date.trim());

  const candidates = allLessons.filter((l) => {
    if (!l || !l.id) return false;
    if (l.deleted) return false;
    if (l.status === 'cancelled') return false;
    if (excluded.has(l.id)) return false;

    // Strict target isolation
    if (isTargetGroupLesson) {
      if ((l.groupId || '').trim() !== targetGroupId) return false;
    } else {
      const lGroupId = (l.groupId || '').trim();
      const lIsPrivate = !lGroupId || lGroupId === 'quick_group';
      if (!lIsPrivate) return false;

      const lStudentId = (l.studentId || '').trim();
      const lStudentNameNorm = normalizeName(l.studentName || (l as any).quickStudentName);

      const matchesById = Boolean(targetStudentId && lStudentId && lStudentId === targetStudentId);
      const matchesByName = Boolean(
        !matchesById &&
          targetStudentNameNorm &&
          lStudentNameNorm &&
          lStudentNameNorm === targetStudentNameNorm
      );

      // Avoid matching different IDs that happen to share a name
      if (targetStudentId && lStudentId && targetStudentId !== lStudentId) {
        return false;
      }
      if (!matchesById && !matchesByName) {
        return false;
      }
    }

    // Chronological boundary: must be strictly earlier than targetLesson when targetLesson has date
    if (hasTargetDate) {
      const cmp = compareLessonsChronologically(l, targetLesson);
      if (cmp >= 0) return false;
    }

    if (requireCompletedOrReported) {
      const isDoneOrReported = l.status === 'completed' || Boolean(l.report);
      if (!isDoneOrReported) return false;
    }

    if (requireOnlineHomework) {
      if (!l.report?.onlineHomeworkAssignmentId?.trim()) return false;
    }

    return true;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => compareLessonsChronologically(b, a));
  return candidates[0] || null;
}

export interface StudentFollowUpEvaluation {
  studentId: string;
  studentName: string;
  wasAbsent: boolean;
  status: 'completed' | 'in_progress' | 'not_started' | 'absent';
  rawProgressStatus: 'completed' | 'in_progress' | 'not_started';
  bestAccuracy: number;
  latestAccuracy: number;
  bestCorrectCount: number;
  totalQuestions: number;
  answeredCount: number;
  attemptsCount: number;
  completedAttemptsCount: number;
  needsFollowUp: boolean;
  hasSubmission: boolean;
  lastActivity: string | null;
}

export interface OnlineHomeworkFollowUpSummary {
  assignmentId: string;
  totalTrackedCount: number;
  absentCount: number;
  solvedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  needsFollowUpCount: number;
  averageAccuracy: number | null;
  completionRate: number;
  studentResults: StudentFollowUpEvaluation[];
  solvedStudents: StudentFollowUpEvaluation[];
  notSolvedStudents: StudentFollowUpEvaluation[];
  inProgressStudents: StudentFollowUpEvaluation[];
  absentStudents: StudentFollowUpEvaluation[];
  followUpStudents: StudentFollowUpEvaluation[];
}

function isStudentAbsentInLesson(
  studentId: string | undefined,
  studentName: string | undefined,
  lesson: Partial<Lesson> | null | undefined,
  isSingleStudentContext = false
): boolean {
  if (!lesson?.report) return false;
  const attMap = lesson.report.studentAttendance;
  if (studentId && attMap && attMap[studentId]) {
    return attMap[studentId] === 'absent';
  }
  if (isSingleStudentContext) {
    if (attMap?.['single']) return attMap['single'] === 'absent';
    if (lesson.studentId && attMap?.[lesson.studentId]) return attMap[lesson.studentId] === 'absent';
    if (lesson.report.attendanceStatus) return lesson.report.attendanceStatus === 'absent';
  }
  if (!isSingleStudentContext && studentName && lesson.studentName) {
    if (normalizeName(studentName) === normalizeName(lesson.studentName) && lesson.report.attendanceStatus) {
      return lesson.report.attendanceStatus === 'absent';
    }
  }
  return false;
}

function normalizeAccuracy(sub: Partial<HomeworkSubmission> | null | undefined): number {
  if (!sub) return 0;
  const raw = sub.scorePercentage ?? sub.accuracyPercent ?? sub.accuracy ?? 0;
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function isSubmissionCompleted(sub: Partial<HomeworkSubmission> | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'completed' || (!sub.status && Boolean(sub.completedAt));
}

/**
 * Evaluates all students/participants for an Online Homework assignment linked to a lesson,
 * flagging non-absent students as needing follow-up when `accuracy < 50% OR not completed yet`.
 */
export function evaluateOnlineHomeworkFollowUp(
  assignment: HomeworkAssignment,
  submissions: HomeworkSubmission[],
  rosterStudents: Student[] = [],
  previousLesson?: Partial<Lesson> | null
): OnlineHomeworkFollowUpSummary {
  const hwId = assignment.id;
  const safeHwId = sanitizeDocId(hwId);
  const mode = resolveAssignmentAudienceMode(assignment);

  const relevantSubs = deduplicateSubmissions(
    (submissions || []).filter(
      (s) => s && (s.assignmentId === hwId || sanitizeDocId(s.assignmentId) === safeHwId)
    )
  );

  const studentResults: StudentFollowUpEvaluation[] = [];

  // Build target student list depending on audienceMode & lesson scope
  if (mode === 'group') {
    const activeRoster = rosterStudents.filter((s) => s && !s.deleted && s.status !== 'archived');
    const deletedOrArchivedIds = new Set(
      rosterStudents.filter((s) => s && (s.deleted || s.status === 'archived')).map((s) => s.id)
    );
    const groupRoster = getAuthorizedGroupStudentsForAssignment(assignment, activeRoster).filter(
      (st) => !deletedOrArchivedIds.has(st.id)
    );

    const nameCounts = new Map<string, number>();
    groupRoster.forEach((st) => {
      const k = normalizeName(st.name);
      nameCounts.set(k, (nameCounts.get(k) || 0) + 1);
    });

    for (const st of groupRoster) {
      const stNameNorm = normalizeName(st.name);
      const allowLegacyNameMatch = nameCounts.get(stNameNorm) === 1;

      const stSubs = relevantSubs
        .filter((s) => {
          if (s.studentId && s.studentId.trim() === st.id) return true;
          if (!s.studentId && !s.participantId && allowLegacyNameMatch) {
            return normalizeName(s.studentName) === stNameNorm;
          }
          return false;
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
            new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
        );

      const wasAbsent = isStudentAbsentInLesson(st.id, st.name, previousLesson, false);
      const completedAttempts = stSubs.filter(isSubmissionCompleted);
      const inProgressAttempts = stSubs.filter((s) => !isSubmissionCompleted(s));

      const rawProgressStatus: 'completed' | 'in_progress' | 'not_started' =
        completedAttempts.length > 0
          ? 'completed'
          : inProgressAttempts.length > 0
          ? 'in_progress'
          : 'not_started';

      const sortedByBest = [...(completedAttempts.length > 0 ? completedAttempts : stSubs)].sort(
        (a, b) =>
          normalizeAccuracy(b) - normalizeAccuracy(a) ||
          (a.timeSpentSeconds || 999999) - (b.timeSpentSeconds || 999999)
      );

      const bestAttempt = sortedByBest[0] || null;
      const latestAttempt = stSubs[0] || null;

      const bestAccuracy = bestAttempt ? normalizeAccuracy(bestAttempt) : 0;
      const latestAccuracy = latestAttempt ? normalizeAccuracy(latestAttempt) : 0;
      const bestCorrectCount = bestAttempt
        ? Number(bestAttempt.correctAnswersCount ?? bestAttempt.score ?? 0)
        : 0;
      const totalQuestions =
        latestAttempt?.totalQuestions || assignment.questionCount || assignment.targetQuestionCount || 0;
      const answeredCount = Array.isArray(latestAttempt?.responses)
        ? latestAttempt!.responses.length
        : 0;

      const status: StudentFollowUpEvaluation['status'] =
        wasAbsent && rawProgressStatus === 'not_started' ? 'absent' : rawProgressStatus;

      // Confirmed criterion: accuracy < 50% OR not completed yet (excluding absent students who didn't participate)
      const needsFollowUp = wasAbsent
        ? false
        : rawProgressStatus !== 'completed' || bestAccuracy < 50;

      studentResults.push({
        studentId: st.id,
        studentName: st.name,
        wasAbsent,
        status,
        rawProgressStatus,
        bestAccuracy,
        latestAccuracy,
        bestCorrectCount,
        totalQuestions,
        answeredCount,
        attemptsCount: stSubs.length,
        completedAttemptsCount: completedAttempts.length,
        needsFollowUp,
        hasSubmission: stSubs.length > 0,
        lastActivity: latestAttempt
          ? (typeof latestAttempt.updatedAt === 'number'
              ? new Date(latestAttempt.updatedAt).toISOString()
              : latestAttempt.updatedAt) ||
            latestAttempt.completedAt ||
            latestAttempt.startedAt ||
            null
          : null
      });
    }
  } else {
    // Open mode: could be attached to a private student lesson OR a group lesson
    const isLessonPrivate = Boolean(
      previousLesson && (!previousLesson.groupId || previousLesson.groupId === 'quick_group')
    );

    if (isLessonPrivate && previousLesson) {
      const targetSt = rosterStudents.find(
        (s) =>
          s &&
          !s.deleted &&
          ((previousLesson.studentId && s.id === previousLesson.studentId) ||
            (previousLesson.studentName &&
              normalizeName(s.name) === normalizeName(previousLesson.studentName)))
      );
      const stId = targetSt?.id || previousLesson.studentId || 'private_student';
      const stName = targetSt?.name || previousLesson.studentName || previousLesson.quickStudentName || 'الطالب';
      const stNameNorm = normalizeName(stName);

      const stSubs = relevantSubs
        .filter((s) => {
          if (s.studentId && targetSt?.id && s.studentId === targetSt.id) return true;
          if (s.studentId && previousLesson.studentId && s.studentId === previousLesson.studentId) return true;
          if (!s.studentId && normalizeName(s.studentName) === stNameNorm) return true;
          return false;
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
            new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
        );

      const wasAbsent = isStudentAbsentInLesson(stId, stName, previousLesson, true);
      const completedAttempts = stSubs.filter(isSubmissionCompleted);
      const inProgressAttempts = stSubs.filter((s) => !isSubmissionCompleted(s));
      const rawProgressStatus: 'completed' | 'in_progress' | 'not_started' =
        completedAttempts.length > 0
          ? 'completed'
          : inProgressAttempts.length > 0
          ? 'in_progress'
          : 'not_started';

      const sortedByBest = [...(completedAttempts.length > 0 ? completedAttempts : stSubs)].sort(
        (a, b) => normalizeAccuracy(b) - normalizeAccuracy(a)
      );
      const bestAttempt = sortedByBest[0] || null;
      const latestAttempt = stSubs[0] || null;
      const bestAccuracy = bestAttempt ? normalizeAccuracy(bestAttempt) : 0;
      const latestAccuracy = latestAttempt ? normalizeAccuracy(latestAttempt) : 0;
      const bestCorrectCount = bestAttempt
        ? Number(bestAttempt.correctAnswersCount ?? bestAttempt.score ?? 0)
        : 0;
      const totalQuestions =
        latestAttempt?.totalQuestions || assignment.questionCount || assignment.targetQuestionCount || 0;
      const answeredCount = Array.isArray(latestAttempt?.responses) ? latestAttempt!.responses.length : 0;

      const status: StudentFollowUpEvaluation['status'] =
        wasAbsent && rawProgressStatus === 'not_started' ? 'absent' : rawProgressStatus;
      const needsFollowUp = wasAbsent
        ? false
        : rawProgressStatus !== 'completed' || bestAccuracy < 50;

      studentResults.push({
        studentId: stId,
        studentName: stName,
        wasAbsent,
        status,
        rawProgressStatus,
        bestAccuracy,
        latestAccuracy,
        bestCorrectCount,
        totalQuestions,
        answeredCount,
        attemptsCount: stSubs.length,
        completedAttemptsCount: completedAttempts.length,
        needsFollowUp,
        hasSubmission: stSubs.length > 0,
        lastActivity: latestAttempt
          ? (typeof latestAttempt.updatedAt === 'number'
              ? new Date(latestAttempt.updatedAt).toISOString()
              : latestAttempt.updatedAt) ||
            latestAttempt.completedAt ||
            latestAttempt.startedAt ||
            null
          : null
      });
    } else if (previousLesson?.groupId && previousLesson.groupId !== 'quick_group') {
      // Open assignment attached to a group lesson: track active students in that exact group safely
      const groupRoster = rosterStudents.filter(
        (s) => s && !s.deleted && s.status !== 'archived' && s.groupId === previousLesson.groupId
      );
      const nameCounts = new Map<string, number>();
      groupRoster.forEach((st) => {
        const k = normalizeName(st.name);
        nameCounts.set(k, (nameCounts.get(k) || 0) + 1);
      });

      const matchedSubIds = new Set<string>();
      for (const st of groupRoster) {
        const stNameNorm = normalizeName(st.name);
        const allowUniqueName = nameCounts.get(stNameNorm) === 1;

        const candidateSubs = relevantSubs.filter((s) => {
          if (s.studentId && s.studentId === st.id) return true;
          if (!s.studentId && allowUniqueName && normalizeName(s.studentName) === stNameNorm) {
            return true;
          }
          return false;
        });

        // If open mode has multiple distinct participantIds with the exact same name, avoid ambiguous merge
        const distinctPids = new Set(
          candidateSubs.map((s) => s.participantId).filter((p): p is string => Boolean(p))
        );
        const stSubs = (distinctPids.size <= 1 ? candidateSubs : []).sort(
          (a, b) =>
            new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
            new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
        );
        stSubs.forEach((s) => matchedSubIds.add(s.id));

        const wasAbsent = isStudentAbsentInLesson(st.id, st.name, previousLesson, false);
        const completedAttempts = stSubs.filter(isSubmissionCompleted);
        const inProgressAttempts = stSubs.filter((s) => !isSubmissionCompleted(s));
        const rawProgressStatus: 'completed' | 'in_progress' | 'not_started' =
          completedAttempts.length > 0
            ? 'completed'
            : inProgressAttempts.length > 0
            ? 'in_progress'
            : 'not_started';

        const sortedByBest = [...(completedAttempts.length > 0 ? completedAttempts : stSubs)].sort(
          (a, b) => normalizeAccuracy(b) - normalizeAccuracy(a)
        );
        const bestAttempt = sortedByBest[0] || null;
        const latestAttempt = stSubs[0] || null;
        const bestAccuracy = bestAttempt ? normalizeAccuracy(bestAttempt) : 0;
        const latestAccuracy = latestAttempt ? normalizeAccuracy(latestAttempt) : 0;
        const bestCorrectCount = bestAttempt
          ? Number(bestAttempt.correctAnswersCount ?? bestAttempt.score ?? 0)
          : 0;
        const totalQuestions =
          latestAttempt?.totalQuestions || assignment.questionCount || assignment.targetQuestionCount || 0;
        const answeredCount = Array.isArray(latestAttempt?.responses) ? latestAttempt!.responses.length : 0;

        const status: StudentFollowUpEvaluation['status'] =
          wasAbsent && rawProgressStatus === 'not_started' ? 'absent' : rawProgressStatus;
        const needsFollowUp = wasAbsent
          ? false
          : rawProgressStatus !== 'completed' || bestAccuracy < 50;

        studentResults.push({
          studentId: st.id,
          studentName: st.name,
          wasAbsent,
          status,
          rawProgressStatus,
          bestAccuracy,
          latestAccuracy,
          bestCorrectCount,
          totalQuestions,
          answeredCount,
          attemptsCount: stSubs.length,
          completedAttemptsCount: completedAttempts.length,
          needsFollowUp,
          hasSubmission: stSubs.length > 0,
          lastActivity: latestAttempt
            ? (typeof latestAttempt.updatedAt === 'number'
                ? new Date(latestAttempt.updatedAt).toISOString()
                : latestAttempt.updatedAt) ||
              latestAttempt.completedAt ||
              latestAttempt.startedAt ||
              null
            : null
        });
      }
    } else {
      // Pure open participant evaluation when no roster lesson context exists
      const byParticipant = new Map<string, HomeworkSubmission[]>();
      for (const s of relevantSubs) {
        const key = getSubmissionIdentityKey(s);
        const list = byParticipant.get(key) || [];
        list.push(s);
        byParticipant.set(key, list);
      }

      byParticipant.forEach((pSubs, key) => {
        const sorted = [...pSubs].sort(
          (a, b) =>
            new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
            new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
        );
        const completedAttempts = sorted.filter(isSubmissionCompleted);
        const rawProgressStatus: 'completed' | 'in_progress' | 'not_started' =
          completedAttempts.length > 0 ? 'completed' : 'in_progress';
        const sortedByBest = [...(completedAttempts.length > 0 ? completedAttempts : sorted)].sort(
          (a, b) => normalizeAccuracy(b) - normalizeAccuracy(a)
        );
        const bestAttempt = sortedByBest[0] || null;
        const latestAttempt = sorted[0] || null;
        const bestAccuracy = bestAttempt ? normalizeAccuracy(bestAttempt) : 0;

        studentResults.push({
          studentId: latestAttempt?.participantId || latestAttempt?.studentId || key,
          studentName: (latestAttempt?.studentName || 'مشارك').trim(),
          wasAbsent: false,
          status: rawProgressStatus,
          rawProgressStatus,
          bestAccuracy,
          latestAccuracy: latestAttempt ? normalizeAccuracy(latestAttempt) : 0,
          bestCorrectCount: bestAttempt ? Number(bestAttempt.correctAnswersCount ?? bestAttempt.score ?? 0) : 0,
          totalQuestions:
            latestAttempt?.totalQuestions || assignment.questionCount || assignment.targetQuestionCount || 0,
          answeredCount: Array.isArray(latestAttempt?.responses) ? latestAttempt!.responses.length : 0,
          attemptsCount: sorted.length,
          completedAttemptsCount: completedAttempts.length,
          needsFollowUp: rawProgressStatus !== 'completed' || bestAccuracy < 50,
          hasSubmission: true,
          lastActivity: latestAttempt
            ? (typeof latestAttempt.updatedAt === 'number'
                ? new Date(latestAttempt.updatedAt).toISOString()
                : latestAttempt.updatedAt) ||
              latestAttempt.completedAt ||
              latestAttempt.startedAt ||
              null
            : null
        });
      });
    }
  }

  const solvedStudents = studentResults.filter((s) => s.rawProgressStatus === 'completed');
  const inProgressStudents = studentResults.filter((s) => s.status === 'in_progress');
  const absentStudents = studentResults.filter((s) => s.status === 'absent');
  const notSolvedStudents = studentResults.filter(
    (s) => s.status === 'not_started' || s.status === 'in_progress'
  );
  const followUpStudents = studentResults.filter((s) => s.needsFollowUp);

  const nonAbsentStudents = studentResults.filter((s) => !s.wasAbsent);
  const scoredStudents = studentResults.filter((s) => s.hasSubmission);
  const averageAccuracy =
    scoredStudents.length > 0
      ? Math.round(scoredStudents.reduce((sum, s) => sum + s.bestAccuracy, 0) / scoredStudents.length)
      : null;
  const completionRate =
    nonAbsentStudents.length > 0
      ? Math.round((solvedStudents.filter((s) => !s.wasAbsent).length / nonAbsentStudents.length) * 100)
      : 0;

  return {
    assignmentId: hwId,
    totalTrackedCount: nonAbsentStudents.length,
    absentCount: absentStudents.length,
    solvedCount: solvedStudents.length,
    inProgressCount: inProgressStudents.length,
    notStartedCount: studentResults.filter((s) => s.status === 'not_started').length,
    needsFollowUpCount: followUpStudents.length,
    averageAccuracy,
    completionRate,
    studentResults,
    solvedStudents,
    notSolvedStudents,
    inProgressStudents,
    absentStudents,
    followUpStudents
  };
}

export interface StudentPersonalOnlineHomeworkResult {
  assignmentId: string;
  assignmentTitle: string;
  isAvailable: boolean;
  wasAbsent: boolean;
  status: 'completed' | 'in_progress' | 'not_started' | 'absent';
  isSolved: boolean;
  hasSubmission: boolean;
  bestAccuracy: number | null;
  bestCorrectCount: number | null;
  totalQuestions: number;
  answeredCount: number;
  attemptsCount: number;
  needsFollowUp: boolean;
}

/**
 * Resolves strictly a single student's personal result on an Online Homework assignment
 * so individual/bulk parent reports NEVER leak peer students' scores or names.
 */
export function resolveStudentPersonalOnlineHomeworkResult(
  assignment: HomeworkAssignment | null | undefined,
  submissions: HomeworkSubmission[],
  student: Partial<Student> | null | undefined,
  previousLesson?: Partial<Lesson> | null,
  options: { currentOwnerUid?: string | null; deletedIds?: Set<string> } = {}
): StudentPersonalOnlineHomeworkResult | null {
  if (!assignment || !assignment.id || !student) return null;

  const hwId = assignment.id;
  const safeHwId = sanitizeDocId(hwId);
  const cleanCurrentUid = (options.currentOwnerUid || '').trim();
  const cleanRecordUid = (assignment.ownerUid || '').trim();
  if (cleanCurrentUid && cleanRecordUid && cleanCurrentUid !== cleanRecordUid) {
    return null;
  }

  const isDeleted = Boolean(
    assignment.deleted ||
      assignment.status === 'deleted' ||
      options.deletedIds?.has(hwId) ||
      options.deletedIds?.has(safeHwId)
  );
  if (isDeleted) {
    return {
      assignmentId: hwId,
      assignmentTitle: assignment.title || 'واجب أونلاين',
      isAvailable: false,
      wasAbsent: false,
      status: 'not_started',
      isSolved: false,
      hasSubmission: false,
      bestAccuracy: null,
      bestCorrectCount: null,
      totalQuestions: assignment.questionCount || 0,
      answeredCount: 0,
      attemptsCount: 0,
      needsFollowUp: false
    };
  }

  const mode = resolveAssignmentAudienceMode(assignment);
  const stId = (student.id || '').trim();
  const stNameNorm = normalizeName(student.name);
  const hwGroupId = (assignment.groupId || '').trim();

  // Strictly block cross-group leaks
  if (
    mode === 'group' &&
    hwGroupId &&
    hwGroupId !== 'all' &&
    student.groupId &&
    student.groupId !== 'quick_group' &&
    student.groupId !== hwGroupId
  ) {
    return null;
  }

  const hwSubs = deduplicateSubmissions(
    (submissions || []).filter(
      (s) => s && (s.assignmentId === hwId || sanitizeDocId(s.assignmentId) === safeHwId)
    )
  );

  // Filter strictly for THIS student only
  let studentSubs = hwSubs.filter((s) => {
    if (stId && s.studentId && s.studentId.trim() === stId) {
      return true;
    }
    if (!s.studentId && stNameNorm) {
      if (mode === 'group' && s.groupId && stId) {
        return normalizeName(s.studentName) === stNameNorm;
      }
      if (!s.participantId || mode === 'open') {
        return normalizeName(s.studentName) === stNameNorm;
      }
    }
    return false;
  });

  // In 'open' mode without explicit studentId, guard against multiple distinct devices sharing the same name
  if (mode === 'open' && !studentSubs.some((s) => Boolean(s.studentId))) {
    const distinctPids = new Set(
      studentSubs.map((s) => s.participantId).filter((p): p is string => Boolean(p))
    );
    if (distinctPids.size > 1) {
      studentSubs = [];
    }
  }

  studentSubs.sort(
    (a, b) =>
      new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
      new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
  );

  const isSingleLesson = !previousLesson?.groupId || previousLesson.groupId === 'quick_group';
  const wasAbsent = isStudentAbsentInLesson(student.id, student.name, previousLesson, isSingleLesson);
  const completedAttempts = studentSubs.filter(isSubmissionCompleted);
  const inProgressAttempts = studentSubs.filter((s) => !isSubmissionCompleted(s));

  const rawProgressStatus: 'completed' | 'in_progress' | 'not_started' =
    completedAttempts.length > 0
      ? 'completed'
      : inProgressAttempts.length > 0
      ? 'in_progress'
      : 'not_started';

  const sortedByBest = [...(completedAttempts.length > 0 ? completedAttempts : studentSubs)].sort(
    (a, b) =>
      normalizeAccuracy(b) - normalizeAccuracy(a) ||
      (a.timeSpentSeconds || 999999) - (b.timeSpentSeconds || 999999)
  );

  const bestAttempt = sortedByBest[0] || null;
  const latestAttempt = studentSubs[0] || null;
  const bestAccuracy = bestAttempt ? normalizeAccuracy(bestAttempt) : null;
  const bestCorrectCount = bestAttempt
    ? Number(bestAttempt.correctAnswersCount ?? bestAttempt.score ?? 0)
    : null;
  const totalQuestions =
    latestAttempt?.totalQuestions || assignment.questionCount || assignment.targetQuestionCount || 0;
  const answeredCount = Array.isArray(latestAttempt?.responses)
    ? latestAttempt!.responses.length
    : 0;

  const status: StudentPersonalOnlineHomeworkResult['status'] =
    wasAbsent && rawProgressStatus === 'not_started' ? 'absent' : rawProgressStatus;

  const needsFollowUp = wasAbsent
    ? false
    : rawProgressStatus !== 'completed' || (bestAccuracy !== null && bestAccuracy < 50);

  return {
    assignmentId: hwId,
    assignmentTitle: assignment.title || 'واجب أونلاين',
    isAvailable: true,
    wasAbsent,
    status,
    isSolved: rawProgressStatus === 'completed',
    hasSubmission: studentSubs.length > 0,
    bestAccuracy,
    bestCorrectCount,
    totalQuestions,
    answeredCount,
    attemptsCount: studentSubs.length,
    needsFollowUp
  };
}

/**
 * Formats a student's individual previous-homework evaluation block for Arabic/EN/DE parent reports.
 * Strictly personal to that student; never includes peer names or scores.
 */
export function formatStudentPersonalPreviousHwLines(
  personal: StudentPersonalOnlineHomeworkResult,
  lang: 'ar' | 'en' | 'de' = 'ar'
): string[] {
  if (!personal || personal.wasAbsent) return [];
  const lines: string[] = [];

  if (lang === 'en') {
    lines.push(`• Online HW: ${personal.assignmentTitle}`);
    if (!personal.isAvailable) {
      lines.push(`• Status: Assignment deleted or unavailable`);
      return lines;
    }
    if (personal.status === 'completed') {
      const scoreDetail =
        personal.bestCorrectCount !== null && personal.totalQuestions > 0
          ? `${personal.bestAccuracy}% (${personal.bestCorrectCount}/${personal.totalQuestions})`
          : `${personal.bestAccuracy}%`;
      lines.push(`• Completion: Solved ✅ — Score: ${scoreDetail}`);
      if (personal.attemptsCount > 1) {
        lines.push(`• Attempts: ${personal.attemptsCount}`);
      }
      if (personal.needsFollowUp) {
        lines.push(`• Note: Needs extra practice (score below 50%)`);
      }
    } else if (personal.status === 'in_progress') {
      const prog =
        personal.totalQuestions > 0
          ? `${personal.answeredCount}/${personal.totalQuestions}`
          : `${personal.answeredCount}`;
      lines.push(`• Completion: In progress ⏳ (${prog} answered)`);
    } else {
      lines.push(`• Completion: Not solved yet ❌`);
    }
    return lines;
  }

  if (lang === 'de') {
    lines.push(`• Online-Aufgabe: ${personal.assignmentTitle}`);
    if (!personal.isAvailable) {
      lines.push(`• Status: Aufgabe gelöscht oder nicht verfügbar`);
      return lines;
    }
    if (personal.status === 'completed') {
      const scoreDetail =
        personal.bestCorrectCount !== null && personal.totalQuestions > 0
          ? `${personal.bestAccuracy}% (${personal.bestCorrectCount}/${personal.totalQuestions})`
          : `${personal.bestAccuracy}%`;
      lines.push(`• Status: Erledigt ✅ — Ergebnis: ${scoreDetail}`);
      if (personal.attemptsCount > 1) {
        lines.push(`• Versuche: ${personal.attemptsCount}`);
      }
      if (personal.needsFollowUp) {
        lines.push(`• Hinweis: Benötigt weitere Übung (unter 50%)`);
      }
    } else if (personal.status === 'in_progress') {
      const prog =
        personal.totalQuestions > 0
          ? `${personal.answeredCount}/${personal.totalQuestions}`
          : `${personal.answeredCount}`;
      lines.push(`• Status: Begonnen ⏳ (${prog} Fragen beantwortet)`);
    } else {
      lines.push(`• Status: Noch nicht erledigt ❌`);
    }
    return lines;
  }

  // Arabic
  lines.push(`• الواجب الأونلاين السابق: ${personal.assignmentTitle}`);
  if (!personal.isAvailable) {
    lines.push(`• الحالة: تم حذف الواجب أو لم يعد متاحاً`);
    return lines;
  }
  if (personal.status === 'completed') {
    const scorePart =
      personal.bestCorrectCount !== null && personal.totalQuestions > 0
        ? `${personal.bestAccuracy}% (${personal.bestCorrectCount} من ${personal.totalQuestions})`
        : `${personal.bestAccuracy}%`;
    lines.push(`• حالة الحل: تم الحل ✅ — النتيجة: ${scorePart}`);
    if (personal.attemptsCount > 0) {
      lines.push(`• عدد المحاولات: ${personal.attemptsCount}`);
    }
    if (personal.needsFollowUp) {
      lines.push(`• ملاحظة المتابعة: يحتاج مراجعة إضافية (الدقة أقل من 50%)`);
    }
  } else if (personal.status === 'in_progress') {
    const prog =
      personal.totalQuestions > 0
        ? `${personal.answeredCount} من ${personal.totalQuestions} سؤال`
        : `${personal.answeredCount} سؤال`;
    lines.push(`• حالة الحل: بدأ الحل ولم يكتمل ⏳ (التقدم: ${prog})`);
    if (personal.attemptsCount > 0) {
      lines.push(`• عدد المحاولات: ${personal.attemptsCount}`);
    }
  } else {
    lines.push(`• حالة الحل: لم يحل الواجب بعد ❌`);
  }

  return lines;
}

export interface SmartDailyAlert {
  id: string;
  type: 'missing_report' | 'unsubmitted_hw' | 'needs_followup' | 'revoked_link';
  severity: 'high' | 'medium' | 'info';
  titleAr: string;
  titleEn: string;
  titleDe: string;
  detailAr: string;
  detailEn: string;
  detailDe: string;
  lessonId?: string;
  groupId?: string;
  assignmentId?: string;
}

export interface SmartDailyHomeworkInsights {
  lessonsNeedingReport: Lesson[];
  lessonsNeedingReportCount: number;
  previousLinkedLessonsCount: number;
  activeLinkedHomeworksCount: number;
  invalidLinkedHomeworksCount: number;
  unsubmittedStudentsCount: number;
  followUpStudentsCount: number;
  completedStudentsCount: number;
  totalTrackedStudentsCount: number;
  confirmedAverageAccuracy: number | null;
  alerts: SmartDailyAlert[];
}

/**
 * Computes strictly verified daily alerts & metrics for SmartDailySummaryWidget
 * without fabricating unconfirmed counts or leaking across accounts/groups.
 */
export function buildSmartDailySummaryHomeworkInsights(params: {
  todayStr: string;
  todaysLessons: Lesson[];
  allLessons: Lesson[];
  students: Student[];
  groups: Group[];
  assignments: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  currentOwnerUid?: string | null;
  deletedAssignmentIds?: Set<string>;
  revokedShortIds?: Set<string>;
  ignoreBrowserLocalFlags?: boolean;
}): SmartDailyHomeworkInsights {
  const {
    todaysLessons,
    allLessons,
    students,
    groups,
    assignments,
    submissions,
    currentOwnerUid,
    deletedAssignmentIds,
    revokedShortIds,
    ignoreBrowserLocalFlags
  } = params;

  const activeStudents = (students || []).filter((s) => s && !s.deleted && s.status !== 'archived');
  const activeGroups = (groups || []).filter((g) => g && !g.deleted && g.status !== 'archived');

  // 1. Today's lessons that need a session report
  const lessonsNeedingReport = (todaysLessons || []).filter((l) => {
    if (!l || l.deleted || l.status === 'cancelled') return false;
    const hasMeaningfulReport = Boolean(
      l.report &&
        (l.report.savedAt ||
          l.report.arabicTopicsExplained?.trim() ||
          l.report.teacherNotes?.trim() ||
          l.report.homeworkDescription?.trim() ||
          l.report.onlineHomeworkAssignmentId?.trim())
    );
    return !hasMeaningfulReport;
  });

  // 2. Collect unique most-recent previous lessons with linked Online Homework per group + private student
  const latestPrevLinkedByScope = new Map<string, { scopeLabel: string; lesson: Lesson }>();

  // Scopes from today's lessons first (high relevance today) + all active groups + individual students
  for (const grp of activeGroups) {
    const prev = findLatestEligiblePreviousLesson(
      { groupId: grp.id, groupName: grp.name },
      allLessons,
      { requireOnlineHomework: true }
    );
    if (prev) {
      latestPrevLinkedByScope.set(`group::${grp.id}`, { scopeLabel: grp.name, lesson: prev });
    }
  }

  for (const l of todaysLessons || []) {
    if (!l || l.deleted || l.status === 'cancelled') continue;
    const isGrp = Boolean(l.groupId && l.groupId !== 'quick_group');
    const key = isGrp
      ? `group::${l.groupId}`
      : l.studentId
      ? `student::${l.studentId}`
      : l.studentName
      ? `studentName::${normalizeName(l.studentName)}`
      : '';
    if (!key || latestPrevLinkedByScope.has(key)) continue;

    const prev = findLatestEligiblePreviousLesson(l, allLessons, {
      requireOnlineHomework: true
    });
    if (prev) {
      latestPrevLinkedByScope.set(key, {
        scopeLabel: l.groupName || l.studentName || l.title,
        lesson: prev
      });
    }
  }

  // Also scan recent completed private lessons (not in groups) that have linked online homework
  const recentPrivateWithHw = (allLessons || [])
    .filter(
      (l) =>
        l &&
        !l.deleted &&
        l.status !== 'cancelled' &&
        (!l.groupId || l.groupId === 'quick_group') &&
        Boolean(l.report?.onlineHomeworkAssignmentId?.trim())
    )
    .sort((a, b) => compareLessonsChronologically(b, a));

  for (const privLesson of recentPrivateWithHw) {
    const key = privLesson.studentId
      ? `student::${privLesson.studentId}`
      : privLesson.studentName
      ? `studentName::${normalizeName(privLesson.studentName)}`
      : `lesson::${privLesson.id}`;
    if (!latestPrevLinkedByScope.has(key)) {
      latestPrevLinkedByScope.set(key, {
        scopeLabel: privLesson.studentName || privLesson.title || 'طالب فردي',
        lesson: privLesson
      });
    }
  }

  let activeLinkedHomeworksCount = 0;
  let invalidLinkedHomeworksCount = 0;
  let unsubmittedStudentsCount = 0;
  let followUpStudentsCount = 0;
  let completedStudentsCount = 0;
  let totalTrackedStudentsCount = 0;
  const accuracyPool: number[] = [];
  const alerts: SmartDailyAlert[] = [];

  if (lessonsNeedingReport.length > 0) {
    const names = lessonsNeedingReport.slice(0, 3).map((l) => l.groupName || l.studentName || l.title).join('، ');
    alerts.push({
      id: 'missing_reports_today',
      type: 'missing_report',
      severity: 'high',
      titleAr: `${lessonsNeedingReport.length} حصة اليوم تحتاج إلى تقرير`,
      titleEn: `${lessonsNeedingReport.length} lesson(s) today need a report`,
      titleDe: `${lessonsNeedingReport.length} Stunde(n) heute benötigen Bericht`,
      detailAr: names,
      detailEn: names,
      detailDe: names
    });
  }

  latestPrevLinkedByScope.forEach(({ scopeLabel, lesson }, scopeKey) => {
    const linkInfo = resolveLinkedOnlineHomeworkForLesson(lesson, assignments, {
      currentOwnerUid,
      deletedIds: deletedAssignmentIds,
      revokedShortIds,
      ignoreBrowserLocalFlags
    });
    if (!linkInfo) return;

    if (!linkInfo.isValid || !linkInfo.assignment) {
      invalidLinkedHomeworksCount++;
      alerts.push({
        id: `invalid_${scopeKey}_${lesson.id}`,
        type: 'revoked_link',
        severity: 'medium',
        titleAr: `${scopeLabel}: ${linkInfo.title}`,
        titleEn: `${scopeLabel}: ${linkInfo.title}`,
        titleDe: `${scopeLabel}: ${linkInfo.title}`,
        detailAr: linkInfo.statusLabelAr,
        detailEn: linkInfo.statusLabelEn,
        detailDe: linkInfo.statusLabelDe,
        lessonId: lesson.id,
        groupId: lesson.groupId,
        assignmentId: linkInfo.assignmentId
      });
      return;
    }

    activeLinkedHomeworksCount++;
    const evalSummary = evaluateOnlineHomeworkFollowUp(
      linkInfo.assignment,
      submissions,
      activeStudents,
      lesson
    );

    totalTrackedStudentsCount += evalSummary.totalTrackedCount;
    completedStudentsCount += evalSummary.solvedCount;
    unsubmittedStudentsCount += evalSummary.notStartedCount + evalSummary.inProgressCount;
    followUpStudentsCount += evalSummary.needsFollowUpCount;

    evalSummary.studentResults.forEach((s) => {
      if (s.hasSubmission) {
        accuracyPool.push(s.bestAccuracy);
      }
    });

    const unsubmittedCount = evalSummary.notStartedCount + evalSummary.inProgressCount;
    const lowScoreStudents = evalSummary.studentResults.filter(
      (s) => !s.wasAbsent && s.rawProgressStatus === 'completed' && s.bestAccuracy < 50
    );

    if (evalSummary.needsFollowUpCount > 0) {
      const sampleNames = evalSummary.followUpStudents
        .slice(0, 3)
        .map((s) => s.studentName)
        .join('، ');
      const partsAr: string[] = [];
      if (unsubmittedCount > 0) partsAr.push(`${unsubmittedCount} لم يكتمل`);
      if (lowScoreStudents.length > 0) partsAr.push(`${lowScoreStudents.length} أقل من 50%`);

      alerts.push({
        id: `followup_${scopeKey}_${linkInfo.assignmentId}`,
        type: unsubmittedCount > 0 ? 'unsubmitted_hw' : 'needs_followup',
        severity: lowScoreStudents.length > 0 || unsubmittedCount >= 2 ? 'high' : 'medium',
        titleAr: `${scopeLabel} — ${linkInfo.title}`,
        titleEn: `${scopeLabel} — ${linkInfo.title}`,
        titleDe: `${scopeLabel} — ${linkInfo.title}`,
        detailAr: `${partsAr.join(' • ')}${sampleNames ? ` (${sampleNames})` : ''}`,
        detailEn: `${evalSummary.needsFollowUpCount} student(s) need follow-up${sampleNames ? ` (${sampleNames})` : ''}`,
        detailDe: `${evalSummary.needsFollowUpCount} Schüler brauchen Nachverfolgung${sampleNames ? ` (${sampleNames})` : ''}`,
        lessonId: lesson.id,
        groupId: lesson.groupId,
        assignmentId: linkInfo.assignmentId
      });
    }
  });

  const confirmedAverageAccuracy =
    accuracyPool.length > 0
      ? Math.round(accuracyPool.reduce((sum, v) => sum + v, 0) / accuracyPool.length)
      : null;

  return {
    lessonsNeedingReport,
    lessonsNeedingReportCount: lessonsNeedingReport.length,
    previousLinkedLessonsCount: latestPrevLinkedByScope.size,
    activeLinkedHomeworksCount,
    invalidLinkedHomeworksCount,
    unsubmittedStudentsCount,
    followUpStudentsCount,
    completedStudentsCount,
    totalTrackedStudentsCount,
    confirmedAverageAccuracy,
    alerts
  };
}
