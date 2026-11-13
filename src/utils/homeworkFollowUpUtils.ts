import { Lesson, Group, Student } from '../types';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import { parseLocalDate, formatLocalDate } from './timeUtils';
import {
  OnlineHomeworkFollowUpSummary,
  OnlineHomeworkValidationResult,
  evaluateOnlineHomeworkFollowUp,
  resolveLinkedOnlineHomeworkForLesson
} from './lessonHomeworkLinkUtils';
import { compareLessonsChronologically, normalizeName } from './lessonUtils';

export interface PendingFollowUp {
  scopeType?: 'group' | 'student';
  groupId: string;
  groupName: string;
  studentId?: string;
  latestCompletedLesson: Lesson;
  nextLessonDateStr: string;
  nextLessonTimeStr: string;
  isToday: boolean;
  isTomorrow: boolean;
  hasOnlineHomework?: boolean;
  onlineLinkValidation?: OnlineHomeworkValidationResult | null;
  onlineFollowUpSummary?: OnlineHomeworkFollowUpSummary | null;
  needsFollowUpCount?: number;
}

export function getPendingHomeworkFollowUps(lessons: Lesson[], groups: Group[]): PendingFollowUp[] {
  const pending: PendingFollowUp[] = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const group of groups) {
    if (!group || group.deleted || group.status === 'archived') continue;
    const groupLessons = lessons.filter(
      (l) => l && !l.deleted && l.status !== 'cancelled' && l.groupId === group.id
    );

    // 1. Find the latest completed lesson
    const completedLessons = groupLessons
      .filter((l) => l.status === 'completed')
      .sort((a, b) => compareLessonsChronologically(b, a));

    if (completedLessons.length === 0) continue;

    const latestCompleted = completedLessons[0];

    // If follow-up was already sent or marked done, skip
    if (latestCompleted.homeworkFollowUpSentAt) continue;

    // 2. Find the next scheduled lesson
    const upcomingLessons = groupLessons
      .filter((l) => l.status !== 'completed' && l.status !== 'cancelled')
      .filter((l) => {
        const lDate = parseLocalDate(l.date);
        return lDate >= todayStart;
      })
      .sort((a, b) => compareLessonsChronologically(a, b));

    if (upcomingLessons.length === 0) continue;

    const nextLesson = upcomingLessons[0];
    const nextLessonDate = parseLocalDate(nextLesson.date);

    // The follow-up becomes visible: 12:00 AM the day before next lesson
    const visibilityStart = new Date(nextLessonDate);
    visibilityStart.setDate(visibilityStart.getDate() - 1);
    visibilityStart.setHours(0, 0, 0, 0);

    // Stop being visible when the next lesson starts
    const [h, m] = (nextLesson.time || '00:00').split(':').map(Number);
    const lessonStart = new Date(nextLessonDate);
    lessonStart.setHours(h || 0, m || 0, 0, 0);

    if (now >= visibilityStart && now < lessonStart) {
      const diffTime = nextLessonDate.getTime() - todayStart.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      pending.push({
        scopeType: 'group',
        groupId: group.id,
        groupName: group.name,
        latestCompletedLesson: latestCompleted,
        nextLessonDateStr: nextLesson.date,
        nextLessonTimeStr: nextLesson.time,
        isToday: diffDays === 0,
        isTomorrow: diffDays === 1
      });
    }
  }

  return pending;
}

/**
 * Builds unified Homework Follow-Up items combining traditional schedule reminders and
 * Online Homework status/results from the most recent eligible previous lesson per group or private student.
 */
export function buildOnlineAwareHomeworkFollowUps(params: {
  lessons: Lesson[];
  groups: Group[];
  students: Student[];
  assignments: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  currentOwnerUid?: string | null;
  deletedAssignmentIds?: Set<string>;
  revokedShortIds?: Set<string>;
  ignoreBrowserLocalFlags?: boolean;
  now?: Date;
}): PendingFollowUp[] {
  const {
    lessons,
    groups,
    students,
    assignments,
    submissions,
    currentOwnerUid,
    deletedAssignmentIds,
    revokedShortIds,
    ignoreBrowserLocalFlags = false,
    now = new Date()
  } = params;

  const todayStr = formatLocalDate(now);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activeStudents = (students || []).filter((s) => s && !s.deleted && s.status !== 'archived');
  const activeGroups = (groups || []).filter((g) => g && !g.deleted && g.status !== 'archived');

  const resultsByKey = new Map<string, PendingFollowUp>();

  // 1. Seed with traditional schedule-window pending follow-ups for groups
  const traditionalItems = getPendingHomeworkFollowUps(lessons, activeGroups);
  for (const item of traditionalItems) {
    const linkInfo = resolveLinkedOnlineHomeworkForLesson(item.latestCompletedLesson, assignments, {
      currentOwnerUid,
      deletedIds: deletedAssignmentIds,
      revokedShortIds,
      ignoreBrowserLocalFlags
    });

    const summary =
      linkInfo?.assignment && linkInfo.status !== 'unauthorized' && linkInfo.status !== 'deleted'
        ? evaluateOnlineHomeworkFollowUp(
            linkInfo.assignment,
            submissions,
            activeStudents,
            item.latestCompletedLesson
          )
        : null;

    resultsByKey.set(`group::${item.groupId}`, {
      ...item,
      scopeType: 'group',
      hasOnlineHomework: Boolean(linkInfo),
      onlineLinkValidation: linkInfo,
      onlineFollowUpSummary: summary,
      needsFollowUpCount: summary?.needsFollowUpCount || 0
    });
  }

  // 2. Check all active groups whose most recent eligible previous lesson has linked Online Homework
  for (const group of activeGroups) {
    const mapKey = `group::${group.id}`;
    if (resultsByKey.has(mapKey)) continue;

    const eligiblePrev = (lessons || [])
      .filter(
        (l) =>
          l &&
          !l.deleted &&
          l.status !== 'cancelled' &&
          l.groupId === group.id &&
          (l.status === 'completed' || (Boolean(l.report) && (!l.date || l.date <= todayStr)))
      )
      .sort((a, b) => compareLessonsChronologically(b, a));

    const latestPrev = eligiblePrev[0];
    if (!latestPrev || latestPrev.homeworkFollowUpSentAt) continue;
    if (!latestPrev.report?.onlineHomeworkAssignmentId?.trim()) continue;

    const linkInfo = resolveLinkedOnlineHomeworkForLesson(latestPrev, assignments, {
      currentOwnerUid,
      deletedIds: deletedAssignmentIds,
      revokedShortIds,
      ignoreBrowserLocalFlags
    });
    if (!linkInfo) continue;

    const summary =
      linkInfo.assignment && linkInfo.status !== 'unauthorized' && linkInfo.status !== 'deleted'
        ? evaluateOnlineHomeworkFollowUp(linkInfo.assignment, submissions, activeStudents, latestPrev)
        : null;

    const upcomingLessons = (lessons || [])
      .filter(
        (l) =>
          l &&
          !l.deleted &&
          l.status !== 'completed' &&
          l.status !== 'cancelled' &&
          l.groupId === group.id &&
          l.date >= todayStr
      )
      .sort((a, b) => compareLessonsChronologically(a, b));

    const nextLesson = upcomingLessons[0];
    const nextDateObj = nextLesson ? parseLocalDate(nextLesson.date) : null;
    const diffDays = nextDateObj
      ? Math.round((nextDateObj.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    resultsByKey.set(mapKey, {
      scopeType: 'group',
      groupId: group.id,
      groupName: group.name,
      latestCompletedLesson: latestPrev,
      nextLessonDateStr: nextLesson?.date || '',
      nextLessonTimeStr: nextLesson?.time || '',
      isToday: diffDays === 0,
      isTomorrow: diffDays === 1,
      hasOnlineHomework: true,
      onlineLinkValidation: linkInfo,
      onlineFollowUpSummary: summary,
      needsFollowUpCount: summary?.needsFollowUpCount || 0
    });
  }

  // 3. Check individual/private students whose most recent eligible previous lesson has linked Online Homework
  const privateLessonsWithOnlineHw = (lessons || [])
    .filter(
      (l) =>
        l &&
        !l.deleted &&
        l.status !== 'cancelled' &&
        (!l.groupId || l.groupId === 'quick_group') &&
        (l.status === 'completed' || (Boolean(l.report) && (!l.date || l.date <= todayStr)))
    )
    .sort((a, b) => compareLessonsChronologically(b, a));

  const seenPrivateKeys = new Set<string>();
  for (const lesson of privateLessonsWithOnlineHw) {
    const matchedStudent = activeStudents.find(
      (s) =>
        (lesson.studentId && s.id === lesson.studentId) ||
        (lesson.studentName && normalizeName(s.name) === normalizeName(lesson.studentName))
    );
    const scopeId = matchedStudent?.id || lesson.studentId || normalizeName(lesson.studentName) || lesson.id;
    const scopeKey = `student::${scopeId}`;
    if (seenPrivateKeys.has(scopeKey)) continue;
    seenPrivateKeys.add(scopeKey);

    if (lesson.homeworkFollowUpSentAt) continue;
    if (!lesson.report?.onlineHomeworkAssignmentId?.trim()) continue;

    // Ensure student hasn't been deleted/archived if known
    if (lesson.studentId && !matchedStudent) {
      const explicitDeleted = (students || []).some(
        (s) => s.id === lesson.studentId && (s.deleted || s.status === 'archived')
      );
      if (explicitDeleted) continue;
    }

    const linkInfo = resolveLinkedOnlineHomeworkForLesson(lesson, assignments, {
      currentOwnerUid,
      deletedIds: deletedAssignmentIds,
      revokedShortIds,
      ignoreBrowserLocalFlags
    });
    if (!linkInfo) continue;

    const summary =
      linkInfo.assignment && linkInfo.status !== 'unauthorized' && linkInfo.status !== 'deleted'
        ? evaluateOnlineHomeworkFollowUp(linkInfo.assignment, submissions, activeStudents, lesson)
        : null;

    const upcomingPrivate = (lessons || [])
      .filter(
        (l) =>
          l &&
          !l.deleted &&
          l.status !== 'completed' &&
          l.status !== 'cancelled' &&
          (!l.groupId || l.groupId === 'quick_group') &&
          l.date >= todayStr &&
          ((matchedStudent?.id && l.studentId === matchedStudent.id) ||
            (lesson.studentId && l.studentId === lesson.studentId) ||
            (lesson.studentName && normalizeName(l.studentName) === normalizeName(lesson.studentName)))
      )
      .sort((a, b) => compareLessonsChronologically(a, b));

    const nextLesson = upcomingPrivate[0];
    const nextDateObj = nextLesson ? parseLocalDate(nextLesson.date) : null;
    const diffDays = nextDateObj
      ? Math.round((nextDateObj.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    resultsByKey.set(scopeKey, {
      scopeType: 'student',
      groupId: `student_${scopeId}`,
      groupName: matchedStudent?.name || lesson.studentName || lesson.quickStudentName || lesson.title,
      studentId: matchedStudent?.id || lesson.studentId,
      latestCompletedLesson: lesson,
      nextLessonDateStr: nextLesson?.date || '',
      nextLessonTimeStr: nextLesson?.time || '',
      isToday: diffDays === 0,
      isTomorrow: diffDays === 1,
      hasOnlineHomework: true,
      onlineLinkValidation: linkInfo,
      onlineFollowUpSummary: summary,
      needsFollowUpCount: summary?.needsFollowUpCount || 0
    });
  }

  return Array.from(resultsByKey.values()).sort((a, b) => {
    const aPriority = (a.needsFollowUpCount || 0) > 0 ? 1 : 0;
    const bPriority = (b.needsFollowUpCount || 0) > 0 ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return (b.needsFollowUpCount || 0) - (a.needsFollowUpCount || 0);
  });
}
