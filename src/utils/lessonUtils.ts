import { Group, GradeLevel, Lesson, LessonReport, PaymentRecord, Student } from '../types';
import { normalizeDateToISO } from './timeUtils';
import { isDateMatchingGroupRecurrence } from './scheduleUtils';

export interface GroupCycleInfo {
  sessionCount: number;
  currentSessionNumber: number;
  completedInCycle: number;
  totalCompletedAllTime: number;
  isPerLesson: boolean;
  progressPercent: number;
  cycleNumber: number;
  label: string;
}

/**
 * Single source of truth for group cycle session calculations across the application.
 */
export function isGroupPerLesson(group?: Partial<Group> | null): boolean {
  if (!group) return false;
  const gName = (group.name || '').toLowerCase();
  const gNotes = ((group as any).notes || '').toLowerCase();
  const pCycle = String(group.paymentCycle || '').toLowerCase();
  const pModel = String(group.paymentModel || '').toLowerCase();
  const pType = String((group as any).paymentType || (group as any).payment_type || '').toLowerCase();
  const bType = String((group as any).billingType || (group as any).billingModel || '').toLowerCase();
  const pPlan = String((group as any).paymentPlan || (group as any).payment_plan || '').toLowerCase();

  return Boolean(
    pCycle === 'per_lesson' ||
    pCycle === 'per_session' ||
    pCycle === 'حصة' ||
    pCycle === 'بالحصة' ||
    pCycle.includes('per_lesson') ||
    pCycle.includes('per_session') ||
    pCycle.includes('بالحصة') ||
    pModel === 'per_session' ||
    pModel === 'per_lesson' ||
    pType === 'per_lesson' ||
    pType === 'per_session' ||
    pType.includes('per_lesson') ||
    pType.includes('per_session') ||
    pType.includes('بالحصة') ||
    bType === 'per_lesson' ||
    bType === 'per_session' ||
    pPlan === 'per_lesson' ||
    pPlan === 'per_session' ||
    (group.sessionCount !== undefined && group.sessionCount <= 1) ||
    gName.includes('بالحصة') ||
    gName.includes('حصة بحصة') ||
    gName.includes('لكل حصة') ||
    gNotes.includes('بالحصة') ||
    gNotes.includes('حصة بحصة')
  );
}

/**
 * Default grade, derived from context — never a hardcoded grade.
 * Priority: the teacher profile's own defaultGrade (when the teacher set one)
 * → the most common grade among the teacher's groups (their real classes)
 * → the first group's grade → the first option of the grade list.
 */
export function resolveDefaultGrade(
  groups: Array<{ grade?: GradeLevel | string } | null | undefined>,
  profileDefaultGrade?: GradeLevel | string | null
): GradeLevel {
  if (profileDefaultGrade) return profileDefaultGrade as GradeLevel;
  const counts = new Map<string, number>();
  let firstGrade: string | null = null;
  for (const g of groups || []) {
    const grade = g?.grade;
    if (!grade) continue;
    if (!firstGrade) firstGrade = grade;
    counts.set(grade, (counts.get(grade) || 0) + 1);
  }
  let bestGrade: string | null = null;
  let bestCount = 0;
  counts.forEach((count, grade) => {
    if (count > bestCount) {
      bestCount = count;
      bestGrade = grade;
    }
  });
  if (bestGrade) return bestGrade as GradeLevel;
  if (firstGrade) return firstGrade as GradeLevel;
  return 'A1';
}


export interface LessonCycleResolution {
  sessionNumber: number;
  totalCycleSessions: number;
  cycleIndex: number;
  sequenceIndex: number;
  isPerLesson: boolean;
  isExcluded: boolean;
}

export interface LessonCycleOptions {
  group?: Partial<Group> | null;
  student?: { id?: string; name?: string; groupId?: string; paymentPlan?: string; bundleSize?: number } | null;
  students?: Array<{ id: string; name: string; groupId?: string; paymentPlan?: string; bundleSize?: number }>;
  forceRecalculate?: boolean;
}

/**
 * Deterministic chronological comparator for lessons:
 * 1. Date (YYYY-MM-DD) + normalized time (HH:MM, fallback '00:00')
 * 2. createdAt timestamp (if present on both records)
 * 3. Lexical lesson ID tie-breaker
 */
export const compareLessonsChronologically = (
  a: Partial<Lesson>,
  b: Partial<Lesson>
): number => {
  const dateA = (a.date || '').trim();
  const dateB = (b.date || '').trim();
  const timeA = `${dateA}T${normalizeTime(a.time) || '00:00'}`;
  const timeB = `${dateB}T${normalizeTime(b.time) || '00:00'}`;
  if (timeA !== timeB) {
    return timeA.localeCompare(timeB);
  }

  const rawCreatedA = (a as any).createdAt;
  const rawCreatedB = (b as any).createdAt;
  const createdA = typeof rawCreatedA === 'number' ? rawCreatedA : (rawCreatedA ? Date.parse(String(rawCreatedA)) : NaN);
  const createdB = typeof rawCreatedB === 'number' ? rawCreatedB : (rawCreatedB ? Date.parse(String(rawCreatedB)) : NaN);
  if (!Number.isNaN(createdA) && !Number.isNaN(createdB) && createdA !== createdB) {
    return createdA - createdB;
  }

  return String(a.id || '').localeCompare(String(b.id || ''));
};

const doesLessonMatchScope = (
  candidate: Partial<Lesson>,
  targetLesson: Partial<Lesson>,
  options?: LessonCycleOptions
): boolean => {
  const targetGroupId = (targetLesson.groupId || options?.group?.id || '').trim();
  const targetGroupName = (options?.group?.name || targetLesson.groupName || '').trim().toLowerCase();
  const targetStudentId = (targetLesson.studentId || options?.student?.id || '').trim();
  const rawTargetStudentName = targetLesson.studentName || (targetLesson as any).quickStudentName || options?.student?.name;
  const targetStudentName = rawTargetStudentName ? normalizeName(rawTargetStudentName) : '';

  if (targetGroupId) {
    if ((candidate.groupId || '').trim() === targetGroupId) return true;
    if (!candidate.groupId && targetGroupName) {
      const cGroupName = (candidate.groupName || '').trim().toLowerCase();
      if (cGroupName && cGroupName === targetGroupName) return true;
    }
    return false;
  }

  if (targetGroupName) {
    const cGroupName = (candidate.groupName || '').trim().toLowerCase();
    if (cGroupName && cGroupName === targetGroupName) return true;
  }

  // Individual / private student scope (no group)
  if (targetStudentId) {
    if (!candidate.groupId && (candidate.studentId || '').trim() === targetStudentId) {
      return true;
    }
    if (options?.students && candidate.groupId) {
      const st = options.students.find(s => s.id === targetStudentId);
      if (st?.groupId && st.groupId === candidate.groupId) {
        return true;
      }
    }
  }

  if (targetStudentName && !candidate.groupId) {
    const cName = normalizeName(candidate.studentName || (candidate as any).quickStudentName);
    if (cName && (cName === targetStudentName || cName.includes(targetStudentName) || targetStudentName.includes(cName))) {
      return true;
    }
  }

  return false;
};

/**
 * Single authoritative source of truth for resolving a lesson's sequential cycle number.
 * Strictly excludes cancelled (status === 'cancelled') and deleted (deleted === true) lessons,
 * orders active lessons deterministically by date/time/createdAt/id, and computes:
 *   sessionNumber = ((startingSessionNumber - 1 + sequenceIndex) % totalCycleSessions) + 1
 */
export const resolveLessonCycleNumber = (
  lesson: Partial<Lesson> | null | undefined,
  allLessons: Lesson[],
  options?: LessonCycleOptions
): LessonCycleResolution => {
  const isPerLesson = Boolean(
    isGroupPerLesson(options?.group) ||
    (!options?.group && options?.student && (options.student.paymentPlan === 'per_lesson' || options.student.bundleSize === 1)) ||
    (!options?.group && !options?.student && lesson?.totalSessionsInPackage === 1)
  );

  const totalCycleSessions = isPerLesson
    ? 1
    : (options?.group?.sessionCount && options.group.sessionCount > 1)
      ? options.group.sessionCount
      : (options?.student?.bundleSize && options.student.bundleSize > 1)
        ? options.student.bundleSize
        : (lesson?.totalSessionsInPackage && lesson.totalSessionsInPackage > 1)
          ? lesson.totalSessionsInPackage
          : 4;

  if (!lesson) {
    return {
      sessionNumber: 1,
      totalCycleSessions,
      cycleIndex: 0,
      sequenceIndex: 0,
      isPerLesson,
      isExcluded: false
    };
  }

  const isExcluded = Boolean(lesson.deleted || lesson.status === 'cancelled');

  if (isPerLesson) {
    return {
      sessionNumber: isExcluded ? 0 : 1,
      totalCycleSessions: 1,
      cycleIndex: 0,
      sequenceIndex: isExcluded ? -1 : 0,
      isPerLesson: true,
      isExcluded
    };
  }

  if (isExcluded) {
    return {
      sessionNumber: 0,
      totalCycleSessions,
      cycleIndex: -1,
      sequenceIndex: -1,
      isPerLesson: false,
      isExcluded: true
    };
  }

  const startingSessionNumber = Math.min(
    totalCycleSessions,
    Math.max(1, options?.group?.startingSessionNumber || 1)
  );

  const safeAllLessons = Array.isArray(allLessons) ? allLessons : [];
  const scopeLessons = safeAllLessons.filter(l => l && doesLessonMatchScope(l, lesson, options));

  // Fallback only when no lesson collection was supplied at all (e.g. isolated preview with empty array)
  if (scopeLessons.length === 0 && safeAllLessons.length === 0) {
    const fallbackNum = (typeof lesson.sessionNumber === 'number' && lesson.sessionNumber >= 1)
      ? (((lesson.sessionNumber - 1) % totalCycleSessions) + 1)
      : startingSessionNumber;
    return {
      sessionNumber: fallbackNum,
      totalCycleSessions,
      cycleIndex: 0,
      sequenceIndex: 0,
      isPerLesson: false,
      isExcluded: false
    };
  }

  const activeScopeLessons = scopeLessons.filter(l => !l.deleted && l.status !== 'cancelled');

  // Ensure the target lesson is represented in the chronological list even if it's an unsaved draft/probe
  const hasTargetInList = Boolean(
    lesson.id && activeScopeLessons.some(l => l.id === lesson.id)
  );
  const chronologicalList: Array<Partial<Lesson>> = hasTargetInList
    ? [...activeScopeLessons]
    : [...activeScopeLessons, lesson];

  chronologicalList.sort(compareLessonsChronologically);

  let sequenceIndex = -1;
  if (lesson.id) {
    sequenceIndex = chronologicalList.findIndex(l => l.id === lesson.id);
  }
  if (sequenceIndex === -1) {
    sequenceIndex = chronologicalList.findIndex(l => l === lesson);
  }
  if (sequenceIndex === -1) {
    sequenceIndex = 0;
  }

  const hasValidAnchor = Boolean(
    options?.group?.cycleAnchorSessionNumber &&
    options.group.cycleAnchorSessionNumber >= 1 &&
    (options.group.cycleAnchorLessonId || options.group.cycleAnchorDate)
  );

  let sessionNumber: number;
  let cycleIndex: number;

  if (hasValidAnchor && options?.group) {
    const anchorSessionNum = Math.min(
      totalCycleSessions,
      Math.max(1, Math.floor(options.group.cycleAnchorSessionNumber!))
    );
    let anchorIndex = -1;
    if (options.group.cycleAnchorLessonId) {
      anchorIndex = chronologicalList.findIndex(l => l.id === options.group!.cycleAnchorLessonId);
    }
    if (anchorIndex === -1 && options.group.cycleAnchorDate) {
      const anchorProbe: Partial<Lesson> = {
        id: options.group.cycleAnchorLessonId || '',
        date: options.group.cycleAnchorDate,
        time: normalizeTime(options.group.cycleAnchorTime) || options.group.cycleAnchorTime || '00:00'
      };
      const firstAtOrAfter = chronologicalList.findIndex(
        l => compareLessonsChronologically(l, anchorProbe) >= 0
      );
      anchorIndex = firstAtOrAfter === -1 ? chronologicalList.length : firstAtOrAfter;
    }
    if (anchorIndex !== -1) {
      const delta = sequenceIndex - anchorIndex;
      sessionNumber = ((((anchorSessionNum - 1 + delta) % totalCycleSessions) + totalCycleSessions) % totalCycleSessions) + 1;
      cycleIndex = Math.floor(((startingSessionNumber - 1) + sequenceIndex) / totalCycleSessions);
    } else {
      const absoluteOffset = (startingSessionNumber - 1) + sequenceIndex;
      sessionNumber = (absoluteOffset % totalCycleSessions) + 1;
      cycleIndex = Math.floor(absoluteOffset / totalCycleSessions);
    }
  } else {
    const absoluteOffset = (startingSessionNumber - 1) + sequenceIndex;
    sessionNumber = (absoluteOffset % totalCycleSessions) + 1;
    cycleIndex = Math.floor(absoluteOffset / totalCycleSessions);
  }

  return {
    sessionNumber,
    totalCycleSessions,
    cycleIndex,
    sequenceIndex,
    isPerLesson: false,
    isExcluded: false
  };
};

/**
 * Given a target lesson and a teacher-selected session number M (1..totalCycleSessions),
 * calculates the exact startingSessionNumber for the group so that the target lesson at
 * chronological sequenceIndex k resolves to M and all other lessons stay in continuous sequence.
 */
export const computeStartingSessionNumberForTargetLesson = (
  targetLesson: Partial<Lesson>,
  desiredSessionNumber: number,
  allLessons: Lesson[],
  options?: LessonCycleOptions
): number => {
  const resolution = resolveLessonCycleNumber(targetLesson, allLessons, options);
  if (resolution.isPerLesson || resolution.totalCycleSessions <= 1) return 1;
  const S = resolution.totalCycleSessions;
  const clampedDesired = Math.min(S, Math.max(1, desiredSessionNumber));
  const k = Math.max(0, resolution.sequenceIndex);
  return ((((clampedDesired - 1 - k) % S) + S) % S) + 1;
};

/**
 * Builds the stable cycle anchor fields + synchronized startingSessionNumber for a group
 * when the teacher explicitly sets a target lesson to a specific session number (1..S).
 * Anchoring to the lesson's ID + date/time makes numbering immune to 60-day RAM window
 * pruning and historical deletions/merges before the anchor.
 */
export const buildGroupCycleAnchorFields = (
  targetLesson: Partial<Lesson>,
  desiredSessionNumber: number,
  allLessons: Lesson[],
  options?: LessonCycleOptions
): Pick<
  Group,
  | 'startingSessionNumber'
  | 'cycleAnchorLessonId'
  | 'cycleAnchorDate'
  | 'cycleAnchorTime'
  | 'cycleAnchorSessionNumber'
> => {
  const resolution = resolveLessonCycleNumber(targetLesson, allLessons, options);
  if (resolution.isPerLesson || resolution.totalCycleSessions <= 1) {
    return {
      startingSessionNumber: 1,
      cycleAnchorLessonId: undefined,
      cycleAnchorDate: undefined,
      cycleAnchorTime: undefined,
      cycleAnchorSessionNumber: undefined
    };
  }
  const S = resolution.totalCycleSessions;
  const clampedDesired = Math.min(S, Math.max(1, Math.floor(desiredSessionNumber)));
  const startingSessionNumber = computeStartingSessionNumberForTargetLesson(
    targetLesson,
    clampedDesired,
    allLessons,
    options
  );
  return {
    startingSessionNumber,
    cycleAnchorLessonId: targetLesson.id || undefined,
    cycleAnchorDate: targetLesson.date || undefined,
    cycleAnchorTime: normalizeTime(targetLesson.time) || targetLesson.time || '00:00',
    cycleAnchorSessionNumber: clampedDesired
  };
};

export const getGroupCycleInfo = (
  group: Partial<Group> | null | undefined,
  lessons?: Lesson[],
  language: 'ar' | 'en' | 'de' = 'ar'
): GroupCycleInfo => {
  if (!group) {
    return {
      sessionCount: 4,
      currentSessionNumber: 1,
      completedInCycle: 0,
      totalCompletedAllTime: 0,
      isPerLesson: false,
      progressPercent: 0,
      cycleNumber: 1,
      label: language === 'ar' ? 'الحصة 1 من 4' : language === 'de' ? 'Sitzung 1 von 4' : 'Session 1 of 4'
    };
  }

  const isPerLesson = isGroupPerLesson(group);

  if (isPerLesson) {
    const label = language === 'ar' 
      ? 'محاسبة بالحصة' 
      : language === 'de' 
        ? 'Pro Sitzung' 
        : 'Per Session';
    const totalCompleted = (lessons || []).filter(l => l.groupId === group.id && !l.deleted && l.status === 'completed').length;
    return {
      sessionCount: 1,
      currentSessionNumber: 1,
      completedInCycle: 0,
      totalCompletedAllTime: totalCompleted,
      isPerLesson: true,
      progressPercent: 100,
      cycleNumber: 1,
      label
    };
  }

  const sessionCount = (group.sessionCount && group.sessionCount > 1) ? group.sessionCount : 4;
  const startingSessionNumber = Math.min(
    sessionCount,
    Math.max(1, group.startingSessionNumber || 1)
  );

  const groupLessons = (lessons || [])
    .filter(l => (l.groupId === group.id || (!l.groupId && group.name && l.groupName && l.groupName.trim().toLowerCase() === group.name.trim().toLowerCase())) && !l.deleted && l.status !== 'cancelled')
    .sort(compareLessonsChronologically);

  const completedLessons = groupLessons.filter(l => l.status === 'completed');
  const inProgressLesson = groupLessons.find(l => l.status === 'in_progress');
  const upcomingScheduled = groupLessons.filter(l => l.status === 'scheduled');

  let currentSessionNumber = startingSessionNumber;
  if (inProgressLesson) {
    currentSessionNumber = resolveLessonCycleNumber(inProgressLesson, groupLessons, { group }).sessionNumber;
  } else if (upcomingScheduled.length > 0) {
    currentSessionNumber = resolveLessonCycleNumber(upcomingScheduled[0], groupLessons, { group }).sessionNumber;
  } else if (completedLessons.length > 0) {
    const lastCompleted = completedLessons[completedLessons.length - 1];
    const lastRes = resolveLessonCycleNumber(lastCompleted, groupLessons, { group });
    currentSessionNumber = (lastRes.sessionNumber % sessionCount) + 1;
  }

  const completedInCycle = currentSessionNumber - 1;
  const progressPercent = Math.min(100, Math.round((completedInCycle / sessionCount) * 100));
  const cycleNumber = Math.floor(((startingSessionNumber - 1) + completedLessons.length) / sessionCount) + 1;

  const label = language === 'ar'
    ? `الحصة ${currentSessionNumber} من ${sessionCount}`
    : language === 'de'
      ? `Sitzung ${currentSessionNumber} von ${sessionCount}`
      : `Session ${currentSessionNumber} of ${sessionCount}`;

  return {
    sessionCount,
    currentSessionNumber,
    completedInCycle,
    totalCompletedAllTime: completedLessons.length,
    isPerLesson: false,
    progressPercent,
    cycleNumber,
    label
  };
};

export const isPendingStatus = (status: string) => {
  return status !== 'completed' && status !== 'cancelled';
};

/**
 * Calculates the exact sequential session number for any lesson using the single
 * authoritative chronological numbering engine (resolveLessonCycleNumber).
 * Cancelled and deleted lessons never consume a session number.
 */
export const calculateSequentialSessionNumber = (
  lesson: Partial<Lesson> | null | undefined,
  allLessons: Lesson[],
  options?: LessonCycleOptions
): number => {
  if (!lesson) return 1;
  const resolution = resolveLessonCycleNumber(lesson, allLessons, options);
  return resolution.sessionNumber >= 1 ? resolution.sessionNumber : 1;
};

/**
 * Re-calculates and synchronizes sessionNumber and totalSessionsInPackage across all
 * non-deleted, non-cancelled lessons of the same group (or private student) in chronological order.
 */
export const resequenceScheduledLessonsAfterChange = (
  allLessons: Lesson[],
  changedLesson: Partial<Lesson> | null | undefined,
  options?: {
    group?: Partial<Group> | null;
    student?: { id?: string; name?: string; groupId?: string; paymentPlan?: string; bundleSize?: number } | null;
    students?: Array<{ id: string; name: string; groupId?: string; paymentPlan?: string; bundleSize?: number }>;
    wrapMutation?: <T>(item: T) => T;
  }
): Lesson[] => {
  if (!changedLesson || !Array.isArray(allLessons) || allLessons.length === 0) return allLessons;

  const grp = options?.group;
  const st = options?.student;
  const wrap = options?.wrapMutation || (<T>(item: T) => item);

  const scopeIndices: number[] = [];

  for (let idx = 0; idx < allLessons.length; idx++) {
    const l = allLessons[idx];
    if (!l || l.deleted || l.status === 'cancelled') continue;
    if (doesLessonMatchScope(l, changedLesson, { group: grp, student: st, students: options?.students })) {
      scopeIndices.push(idx);
    }
  }

  if (scopeIndices.length === 0) return allLessons;

  scopeIndices.sort((idxA, idxB) => compareLessonsChronologically(allLessons[idxA], allLessons[idxB]));

  const sampleLesson = allLessons[scopeIndices[0]] || changedLesson;
  const isPerLesson = Boolean(
    isGroupPerLesson(grp) ||
    (!grp && st && (st.paymentPlan === 'per_lesson' || st.bundleSize === 1)) ||
    (!grp && !st && sampleLesson?.totalSessionsInPackage === 1)
  );

  const totalCycleSessions = isPerLesson
    ? 1
    : (grp?.sessionCount && grp.sessionCount > 1)
      ? grp.sessionCount
      : (st?.bundleSize && st.bundleSize > 1)
        ? st.bundleSize
        : (sampleLesson?.totalSessionsInPackage && sampleLesson.totalSessionsInPackage > 1)
          ? sampleLesson.totalSessionsInPackage
          : 4;

  const startingSessionNumber = Math.min(
    totalCycleSessions,
    Math.max(1, grp?.startingSessionNumber || 1)
  );

  const hasValidAnchor = Boolean(
    !isPerLesson &&
    grp?.cycleAnchorSessionNumber &&
    grp.cycleAnchorSessionNumber >= 1 &&
    (grp.cycleAnchorLessonId || grp.cycleAnchorDate)
  );

  let anchorIndex = -1;
  let anchorSessionNum = 1;
  if (hasValidAnchor && grp) {
    anchorSessionNum = Math.min(
      totalCycleSessions,
      Math.max(1, Math.floor(grp.cycleAnchorSessionNumber!))
    );
    if (grp.cycleAnchorLessonId) {
      anchorIndex = scopeIndices.findIndex(idx => allLessons[idx].id === grp.cycleAnchorLessonId);
    }
    if (anchorIndex === -1 && grp.cycleAnchorDate) {
      const anchorProbe: Partial<Lesson> = {
        id: grp.cycleAnchorLessonId || '',
        date: grp.cycleAnchorDate,
        time: normalizeTime(grp.cycleAnchorTime) || grp.cycleAnchorTime || '00:00'
      };
      const firstAtOrAfter = scopeIndices.findIndex(
        idx => compareLessonsChronologically(allLessons[idx], anchorProbe) >= 0
      );
      anchorIndex = firstAtOrAfter === -1 ? scopeIndices.length : firstAtOrAfter;
    }
  }

  let result: Lesson[] | null = null;

  for (let sequenceIndex = 0; sequenceIndex < scopeIndices.length; sequenceIndex++) {
    const idx = scopeIndices[sequenceIndex];
    const l = allLessons[idx];
    let sessionNumber = 1;

    if (!isPerLesson) {
      if (hasValidAnchor && anchorIndex !== -1) {
        const delta = sequenceIndex - anchorIndex;
        sessionNumber = ((((anchorSessionNum - 1 + delta) % totalCycleSessions) + totalCycleSessions) % totalCycleSessions) + 1;
      } else {
        const absoluteOffset = (startingSessionNumber - 1) + sequenceIndex;
        sessionNumber = (absoluteOffset % totalCycleSessions) + 1;
      }
    }

    if (
      l.sessionNumber !== sessionNumber ||
      l.totalSessionsInPackage !== totalCycleSessions
    ) {
      if (!result) {
        result = [...allLessons];
      }
      result[idx] = wrap({
        ...l,
        sessionNumber,
        totalSessionsInPackage: totalCycleSessions,
      });
    }
  }

  return result || allLessons;
};

export const normalizeTime = (t?: string): string => {
  if (!t || typeof t !== 'string') return '';
  const clean = t.trim();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm|ص|م)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2].padStart(2, '0');
    const period = ampmMatch[3].toLowerCase();
    if ((period === 'pm' || period === 'م') && h < 12) h += 12;
    if ((period === 'am' || period === 'ص') && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const parts = clean.split(':');
  if (parts.length === 2 && /^\d{1,2}$/.test(parts[0].trim()) && /^\d{1,2}$/.test(parts[1].trim())) {
    return `${parts[0].trim().padStart(2, '0')}:${parts[1].trim().padStart(2, '0')}`;
  }
  return clean;
};

export const normalizeName = (name?: string): string => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[_–—\-]+/g, ' ').replace(/\s+/g, ' ');
};

export const checkOverlap = (l1: any, l2: any) => {
  if (!l1 || !l2) return false;
  if (l1.id === l2.id) return false;
  if (l1.date !== l2.date) return false;
  
  // Completed and cancelled sessions have already concluded or been voided; they must NEVER trigger active schedule conflicts
  const isL1Done = l1.status === 'completed' || l1.status === 'cancelled' || (l1.report && l1.report.attendanceStatus === 'completed');
  const isL2Done = l2.status === 'completed' || l2.status === 'cancelled' || (l2.report && l2.report.attendanceStatus === 'completed');
  if (isL1Done || isL2Done) {
    return false;
  }

  // If both lessons belong to the exact same group, it's a duplicate record of the same group session, not a schedule conflict between different groups
  if (l1.groupId && l2.groupId && l1.groupId !== 'quick_group' && l1.groupId === l2.groupId) {
    return false;
  }

  // If one lesson is strictly Week A and the other is strictly Week B, they occur in alternate weeks and never conflict!
  const rec1 = l1.scheduleRecurrence;
  const rec2 = l2.scheduleRecurrence;
  if (
    (rec1 === 'biweekly_a' && rec2 === 'biweekly_b') ||
    (rec1 === 'biweekly_b' && rec2 === 'biweekly_a')
  ) {
    return false;
  }

  const getMins = (t: string) => {
    if (!t) return 0;
    const parts = t.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  };
  const s1 = getMins(l1.time);
  const e1 = s1 + (l1.durationMinutes || 60);
  const s2 = getMins(l2.time);
  const e2 = s2 + (l2.durationMinutes || 60);
  return s1 < e2 && s2 < e1;
};

export const isSameLessonTarget = (l1: any, l2: any, students?: any[], studentsById?: Map<string, any>): boolean => {
  if (!l1 || !l2) return false;
  // If both belong to the exact same group
  if (l1.groupId && l2.groupId && l1.groupId !== 'quick_group' && l1.groupId === l2.groupId) {
    return true;
  }
  if (l1.groupId && l2.groupId && l1.groupId !== 'quick_group' && l2.groupId !== 'quick_group' && l1.groupId !== l2.groupId) {
    return false;
  }
  // If both belong to the exact same student ID (never merge by student name!)
  if (l1.studentId && l2.studentId) {
    return l1.studentId === l2.studentId;
  }
  // Cross check if student belongs to the group
  const stId = l1.studentId || l2.studentId;
  const grpId = l1.groupId || l2.groupId;
  if (stId && grpId && grpId !== 'quick_group') {
    const st = studentsById ? studentsById.get(stId) : (Array.isArray(students) ? students.find(s => s.id === stId) : undefined);
    if (st && st.groupId === grpId) {
      return true;
    }
  }
  return false;
};

export const areDuplicateLessons = (l1: any, l2: any, students?: any[], studentsById?: Map<string, any>): boolean => {
  if (!l1 || !l2 || l1.id === l2.id) return false;
  if (l1.deleted || l2.deleted) return false;
  if (l1.date !== l2.date) return false;

  if (!isSameLessonTarget(l1, l2, students, studentsById)) return false;

  const t1 = normalizeTime(l1.time);
  const t2 = normalizeTime(l2.time);

  // Distinct non-overlapping times on the same date are separate lessons (e.g. 16:00 and 19:00),
  // even when both share sessionNumber === 1 (per-lesson groups or pre-resequencing).
  if (t1 && t2 && t1 !== t2) {
    if (l1.status === 'completed' && l2.status === 'completed') {
      return false;
    }
    return checkOverlap(l1, l2);
  }

  // Exact same normalized start time on the same date for the same target -> true duplicate
  if (t1 && t2 && t1 === t2) {
    return true;
  }

  // Both lack a valid start time
  if (!t1 && !t2) {
    const sameSession = Boolean(l1.sessionNumber && l2.sessionNumber && l1.sessionNumber === l2.sessionNumber);
    if (l1.status === 'completed' && l2.status === 'completed' && !sameSession) {
      return false;
    }
    return true;
  }

  // One has a start time and one does not: never merge two distinct completed/cancelled lessons
  const hasEngagement = (l: any) =>
    l.status === 'completed' ||
    l.status === 'cancelled' ||
    Boolean(l.report?.attendanceStatus || l.report?.teacherNotes) ||
    (l.amountPaid || 0) > 0;
  if (hasEngagement(l1) && hasEngagement(l2)) {
    return false;
  }
  return Boolean(l1.sessionNumber && l2.sessionNumber && l1.sessionNumber === l2.sessionNumber);
};

export const pickAuthoritativeLesson = (l1: any, l2: any): { survivor: any; duplicate: any } => {
  const statusScore = (s: string) => {
    if (s === 'completed') return 100;
    if (s === 'cancelled') return 80;
    if (s === 'in_progress') return 60;
    if (s === 'pending_action') return 40;
    if (s === 'scheduled') return 20;
    return 0;
  };

  const hasPaidSP = (l: any) => {
    if (!l.studentPayments || typeof l.studentPayments !== 'object') return false;
    return Object.values(l.studentPayments).some((sp: any) => sp?.paymentStatus === 'paid' || sp?.status === 'paid');
  };

  const isL1Paid = l1.paymentStatus === 'paid' || l1.report?.paymentStatus === 'paid' || hasPaidSP(l1);
  const isL2Paid = l2.paymentStatus === 'paid' || l2.report?.paymentStatus === 'paid' || hasPaidSP(l2);

  const score1 = statusScore(l1.status) + (l1.report ? 50 : 0) + ((l1.amountPaid || 0) > 0 ? 30 : 0) + (isL1Paid ? 80 : 0);
  const score2 = statusScore(l2.status) + (l2.report ? 50 : 0) + ((l2.amountPaid || 0) > 0 ? 30 : 0) + (isL2Paid ? 80 : 0);

  const t1 = typeof l1.updatedAt === 'number' ? l1.updatedAt : 0;
  const t2 = typeof l2.updatedAt === 'number' ? l2.updatedAt : 0;
  const l1Wins = score1 > score2 || (score1 === score2 && t1 >= t2);

  let survivor = l1Wins ? { ...l1 } : { ...l2 };
  let duplicate = l1Wins ? { ...l2 } : { ...l1 };

  // Merge valuable report data if survivor is missing it
  if (!survivor.report && duplicate.report) {
    survivor.report = duplicate.report;
  }
  
  // Merge studentPayments safely: if ANY student is marked paid in either record, they MUST remain paid!
  const mergedStudentPayments: Record<string, any> = {};
  const allStIds = new Set([
    ...Object.keys(duplicate.studentPayments || {}),
    ...Object.keys(survivor.studentPayments || {})
  ]);
  allStIds.forEach(stId => {
    const spSurv = survivor.studentPayments?.[stId];
    const spDupe = duplicate.studentPayments?.[stId];
    if (spSurv && spDupe) {
      const isPaid = spSurv.paymentStatus === 'paid' || spSurv.status === 'paid' ||
                     spDupe.paymentStatus === 'paid' || spDupe.status === 'paid';
      mergedStudentPayments[stId] = {
        ...spDupe,
        ...spSurv,
        paymentStatus: isPaid ? 'paid' : (spSurv.paymentStatus || spDupe.paymentStatus || 'pending'),
        status: isPaid ? 'paid' : (spSurv.status || spDupe.status || 'pending'),
        amountPaid: Math.max(spSurv.amountPaid || spSurv.amount || 0, spDupe.amountPaid || spDupe.amount || 0)
      };
    } else {
      mergedStudentPayments[stId] = spSurv || spDupe;
    }
  });
  if (allStIds.size > 0) {
    survivor.studentPayments = mergedStudentPayments;
  }

  // Preserve paid status if either record was marked paid
  if (duplicate.paymentStatus === 'paid' || isL1Paid || isL2Paid) {
    survivor.paymentStatus = 'paid';
    if (survivor.report) {
      survivor.report = { ...survivor.report, paymentStatus: 'paid' };
    }
  }

  if ((duplicate.amountPaid || 0) > (survivor.amountPaid || 0)) {
    survivor.amountPaid = duplicate.amountPaid;
    if (survivor.report) {
      survivor.report.amountPaid = duplicate.amountPaid;
    }
  }
  if (duplicate.status === 'completed' && survivor.status !== 'completed') {
    survivor.status = 'completed';
  } else if (
    (duplicate.status === 'cancelled' || duplicate.status === 'in_progress' || duplicate.status === 'pending_action') &&
    (!survivor.status || survivor.status === 'scheduled')
  ) {
    survivor.status = duplicate.status;
  }

  if (Math.max(t1, t2) > 0) {
    survivor.updatedAt = Math.max(t1, t2);
  }
  const maxVer = Math.max(Number(l1.version) || 0, Number(l2.version) || 0);
  if (maxVer > 0) {
    survivor.version = maxVer;
  }
  const maxRev = Math.max(Number(l1.originRevision) || 0, Number(l2.originRevision) || 0);
  if (maxRev > 0) {
    survivor.originRevision = maxRev;
  }

  return { survivor, duplicate };
};

export const deduplicateLessonList = (
  lessons: any[],
  students?: any[]
): { deduplicated: any[]; removedIds: Set<string>; idMap: Map<string, string>; hasChanges: boolean } => {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return { deduplicated: [], removedIds: new Set(), idMap: new Map(), hasChanges: false };
  }

  const removedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const activeList: any[] = [];
  const deletedList: any[] = [];
  const seenExactIds = new Set<string>();

  for (const l of lessons) {
    if (!l || !l.id) continue;
    if (seenExactIds.has(l.id)) {
      removedIds.add(l.id);
      continue;
    }
    seenExactIds.add(l.id);
    if (l.deleted) {
      deletedList.push(l);
    } else {
      activeList.push(l);
    }
  }

  const studentsById = new Map<string, any>();
  if (Array.isArray(students)) {
    for (const st of students) {
      if (st && st.id) studentsById.set(st.id, st);
    }
  }

  const survivors: any[] = [];
  // Bucket survivor indices by lesson.date so duplicate checks are O(1) per date instead of O(N^2)
  const survivorIndicesByDate = new Map<string, number[]>();

  for (const candidate of activeList) {
    if (removedIds.has(candidate.id)) continue;

    const dateKey = String(candidate.date || '');
    const bucket = survivorIndicesByDate.get(dateKey);
    let existingIndex = -1;

    if (bucket) {
      for (let bIdx = 0; bIdx < bucket.length; bIdx++) {
        const sIdx = bucket[bIdx];
        if (areDuplicateLessons(survivors[sIdx], candidate, students, studentsById)) {
          existingIndex = sIdx;
          break;
        }
      }
    }

    if (existingIndex >= 0) {
      const existingSurvivor = survivors[existingIndex];
      const { survivor, duplicate } = pickAuthoritativeLesson(existingSurvivor, candidate);

      survivors[existingIndex] = survivor;
      removedIds.add(duplicate.id);
      idMap.set(duplicate.id, survivor.id);
    } else {
      const newIdx = survivors.length;
      survivors.push(candidate);
      if (bucket) {
        bucket.push(newIdx);
      } else {
        survivorIndicesByDate.set(dateKey, [newIdx]);
      }
    }
  }

  const hasChanges = removedIds.size > 0;
  const deduplicated = [...survivors, ...deletedList.filter(d => !removedIds.has(d.id))];

  return { deduplicated, removedIds, idMap, hasChanges };
};

const extractNonVirtualLessonIds = (payment: any): string[] => {
  const ids: string[] = [];
  if (Array.isArray(payment?.lessonIds)) {
    for (const id of payment.lessonIds) {
      if (typeof id === 'string' && id && !id.startsWith('virtual_')) {
        ids.push(id);
      }
    }
  }
  if (typeof payment?.lessonId === 'string' && payment.lessonId && !payment.lessonId.startsWith('virtual_')) {
    if (!ids.includes(payment.lessonId)) {
      ids.push(payment.lessonId);
    }
  }
  return Array.from(new Set(ids)).sort();
};

const buildInvoiceDedupeKey = (payment: any): string => {
  const studentId = String(payment?.studentId || '');
  const realIds = extractNonVirtualLessonIds(payment);
  const lessonSetOrCycleKey = realIds.length > 0
    ? `lessons:${realIds.join(',')}`
    : `cycle:${payment?.cycleId || payment?.id || ''}`;
  return `${studentId}|${payment?.dueDate || ''}|${payment?.bundleSize || ''}|${payment?.amountDue ?? ''}|${lessonSetOrCycleKey}`;
};

export const deduplicatePaymentsList = (
  payments: any[],
  lessonIdMap?: Map<string, string>
): { deduplicated: any[]; removedIds: Set<string>; hasChanges: boolean } => {
  if (!Array.isArray(payments) || payments.length === 0) {
    return { deduplicated: [], removedIds: new Set(), hasChanges: false };
  }

  const removedIds = new Set<string>();
  let modified = false;

  // 1. Remap lesson IDs if needed
  const mappedPayments = payments.map(p => {
    if (!p || !p.id) return p;
    if (lessonIdMap && lessonIdMap.size > 0 && Array.isArray(p.lessonIds)) {
      const nextIds = p.lessonIds.map((lid: string) => lessonIdMap.get(lid) || lid);
      const uniqueIds = Array.from(new Set(nextIds));
      if (uniqueIds.length !== p.lessonIds.length || nextIds.some((id: string, idx: number) => id !== p.lessonIds[idx])) {
        modified = true;
        return { ...p, lessonIds: uniqueIds };
      }
    }
    return p;
  });

  // Separate valid paid and non-paid records
  const paidPayments: any[] = [];
  const pendingPayments: any[] = [];

  for (const p of mappedPayments) {
    if (!p || !p.id || p.deleted) continue;
    if (p.status === 'paid' || p.status === 'exempted' || p.paymentType === 'exemption') {
      paidPayments.push(p);
    } else {
      pendingPayments.push(p);
    }
  }

  // Deduplicate paid payments among themselves in O(N) using Map by ID, lesson-ID set, and full key (P1 & P4)
  const dedupedPaid: any[] = [];
  const paidIndexById = new Map<string, number>();
  const paidIndexByLessonSet = new Map<string, number>();
  const paidIndexByFullKey = new Map<string, number>();

  for (const p of paidPayments) {
    const realIds = extractNonVirtualLessonIds(p);
    const lessonSetKey = realIds.length > 0 ? `${p.studentId || ''}::${realIds.join(',')}` : '';
    const fullKey = buildInvoiceDedupeKey(p);

    let existingIdx = paidIndexById.get(p.id) ?? -1;
    if (existingIdx === -1 && lessonSetKey && paidIndexByLessonSet.has(lessonSetKey)) {
      existingIdx = paidIndexByLessonSet.get(lessonSetKey)!;
    }
    if (existingIdx === -1 && paidIndexByFullKey.has(fullKey)) {
      existingIdx = paidIndexByFullKey.get(fullKey)!;
    }

    if (existingIdx >= 0) {
      const existing = dedupedPaid[existingIdx];
      const winner = (p.amountPaid || 0) >= (existing.amountPaid || 0) ? p : existing;
      const loser = winner === p ? existing : p;
      dedupedPaid[existingIdx] = winner;
      if (loser.id !== winner.id) {
        removedIds.add(loser.id);
      }
      paidIndexById.set(winner.id, existingIdx);
      if (lessonSetKey) paidIndexByLessonSet.set(lessonSetKey, existingIdx);
      paidIndexByFullKey.set(fullKey, existingIdx);
      modified = true;
    } else {
      const newIdx = dedupedPaid.length;
      dedupedPaid.push(p);
      paidIndexById.set(p.id, newIdx);
      if (lessonSetKey) paidIndexByLessonSet.set(lessonSetKey, newIdx);
      paidIndexByFullKey.set(fullKey, newIdx);
    }
  }

  // Index paid lesson IDs strictly per student (P2: match invoices by lesson ID)
  const paidLessonIdsByStudent = new Map<string, Set<string>>();

  for (const p of dedupedPaid) {
    const stId = p.studentId;
    if (!stId) continue;

    let stIdsSet = paidLessonIdsByStudent.get(stId);
    if (!stIdsSet) {
      stIdsSet = new Set<string>();
      paidLessonIdsByStudent.set(stId, stIdsSet);
    }
    for (const lid of extractNonVirtualLessonIds(p)) {
      stIdsSet.add(lid);
    }
  }

  // Filter and deduplicate pending payments against PAID records of the SAME STUDENT and against each other by lesson IDs (P2 & P4)
  const dedupedPending: any[] = [];
  const pendingIndexById = new Map<string, number>();
  const pendingIndexByLessonSet = new Map<string, number>();

  for (const p of pendingPayments) {
    const stId = p.studentId;
    const studentPaidLessonIds = stId ? paidLessonIdsByStudent.get(stId) : undefined;
    const realLessonIds = extractNonVirtualLessonIds(p);

    // Check if this pending payment's lesson IDs are ALREADY COVERED by paid records of the same student
    const isIdsCoveredByPaid = Boolean(
      studentPaidLessonIds &&
      studentPaidLessonIds.size > 0 &&
      realLessonIds.length > 0 &&
      realLessonIds.every((id: string) => studentPaidLessonIds.has(id))
    );

    if (isIdsCoveredByPaid) {
      removedIds.add(p.id);
      modified = true;
      continue;
    }

    const lessonSetKey = realLessonIds.length > 0 ? `${stId || ''}::${realLessonIds.join(',')}` : '';
    let existingPendingIdx = pendingIndexById.get(p.id) ?? -1;
    if (existingPendingIdx === -1 && lessonSetKey && pendingIndexByLessonSet.has(lessonSetKey)) {
      existingPendingIdx = pendingIndexByLessonSet.get(lessonSetKey)!;
    }

    if (existingPendingIdx >= 0) {
      const existing = dedupedPending[existingPendingIdx];
      const winner = (p.amountPaid || 0) > (existing.amountPaid || 0) ? p : existing;
      const loser = winner === p ? existing : p;
      dedupedPending[existingPendingIdx] = winner;
      if (loser.id !== winner.id) {
        removedIds.add(loser.id);
      }
      pendingIndexById.set(winner.id, existingPendingIdx);
      if (lessonSetKey) pendingIndexByLessonSet.set(lessonSetKey, existingPendingIdx);
      modified = true;
    } else {
      const newIdx = dedupedPending.length;
      dedupedPending.push(p);
      pendingIndexById.set(p.id, newIdx);
      if (lessonSetKey) pendingIndexByLessonSet.set(lessonSetKey, newIdx);
    }
  }

  const cleaned = [...dedupedPaid, ...dedupedPending];
  return { deduplicated: cleaned, removedIds, hasChanges: modified || removedIds.size > 0 };
};

export const calculateOverallAttendance = (lessons: any[], students: any[]) => {
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  lessons.forEach(l => {
    if (l.status !== 'completed' || !l.report) return;
    if (l.groupId) {
      const groupStudents = students.filter(s => s.groupId === l.groupId);
      groupStudents.forEach(st => {
        const status = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || 'present';
        if (status === 'present') presentCount++;
        if (status === 'late') lateCount++;
        if (status === 'absent') absentCount++;
      });
    } else {
      const status = l.report.attendanceStatus || 'present';
      if (status === 'present') presentCount++;
      if (status === 'late') lateCount++;
      if (status === 'absent') absentCount++;
    }
  });

  return { presentCount, lateCount, absentCount };
};

/**
 * Determines whether a lesson should be kept in the active RAM window:
 * - Always keeps non-deleted lessons within the 60-day cutoff or in scheduled/pending status.
 * - For completed lessons older than 60 days, keeps them ONLY if:
 *   1. They are at most 365 days old (date >= maxCutoffStr),
 *   2. The lesson itself is not paid or exempted, AND
 *   3. It belongs to at least one paying student (not exempted, not zero-fee) who has not yet paid for this lesson.
 */
export const shouldRetainLessonInActiveWindow = (
  lesson: Lesson,
  cutoffStr: string,
  maxCutoffStr: string,
  students: Student[] = [],
  groups: Group[] = []
): boolean => {
  if (!lesson || lesson.deleted) return false;
  if (!lesson.date || typeof lesson.date !== 'string') return true;
  if (lesson.date >= cutoffStr) return true;
  // Never evict a group's cycle anchor lesson from the active RAM window
  if (lesson.groupId && Array.isArray(groups) && groups.length > 0) {
    const anchorGrp = groups.find(g => g && !g.deleted && g.id === lesson.groupId);
    if (anchorGrp?.cycleAnchorLessonId && anchorGrp.cycleAnchorLessonId === lesson.id) {
      return true;
    }
  }
  if (lesson.status === 'scheduled' || isPendingStatus(lesson.status)) return true;

  if (lesson.status !== 'completed') return false;
  if (lesson.date < maxCutoffStr) return false;

  const lessonPayStatus = String(lesson.paymentStatus || '');
  const reportPayStatus = String(lesson.report?.paymentStatus || '');
  if (
    lessonPayStatus === 'paid' ||
    lessonPayStatus === 'exempted' ||
    reportPayStatus === 'paid' ||
    reportPayStatus === 'exempted'
  ) {
    return false;
  }

  const grp = (groups || []).find(
    g => !g.deleted && g.status !== 'archived' && g.id === lesson.groupId
  );

  const matchedStudents = (students || []).filter(s => {
    if (!s || s.deleted || s.status === 'archived') return false;
    if (lesson.studentId && s.id === lesson.studentId) return true;
    if (!lesson.studentId && lesson.studentName && s.name === lesson.studentName) return true;
    if (lesson.groupId && lesson.groupId !== 'quick_group' && s.groupId === lesson.groupId) return true;
    return false;
  });

  if (matchedStudents.length > 0) {
    return matchedStudents.some(st => {
      // 1. Exclude exempted students
      if (String(st.paymentStatus || '') === 'exempted' || Boolean((st as any).isExempt)) {
        return false;
      }

      // 2. Exclude students/groups with zero payment obligation
      const hasCustomZero = st.customBundlePrice !== undefined && st.customBundlePrice !== null && st.customBundlePrice <= 0;
      const hasPerLessonZero = st.pricePerLesson !== undefined && st.pricePerLesson !== null && st.pricePerLesson <= 0;
      const hasMonthlyZero = st.monthlyFee !== undefined && st.monthlyFee !== null && st.monthlyFee <= 0;
      if (hasCustomZero || (!grp && (hasPerLessonZero || hasMonthlyZero))) {
        return false;
      }
      if (grp) {
        const grpPkg = grp.monthlyPackagePrice ?? 0;
        const grpSess = grp.pricePerSession ?? 0;
        const stCustomPos = (st.customBundlePrice ?? 0) > 0;
        if (grpPkg <= 0 && grpSess <= 0 && !stCustomPos) {
          return false;
        }
      }

      // 3. Exclude if student was absent in this lesson
      const att = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
      if (att === 'absent') return false;

      // 4. Exclude if student already paid or was exempted for this specific lesson
      const spObj = lesson.studentPayments?.[st.id] as any;
      const repSpObj = lesson.report?.studentPayments?.[st.id] as any;
      const stLessonPayStatus = String(
        spObj?.paymentStatus || spObj?.status || repSpObj?.paymentStatus || repSpObj?.status || ''
      );
      if (stLessonPayStatus === 'paid' || stLessonPayStatus === 'exempted') {
        return false;
      }

      return true;
    });
  }

  // Fallback when no student record is linked: require a positive unpaid lesson amountDue
  const due = lesson.amountDue ?? 0;
  const paid = lesson.amountPaid ?? 0;
  return due > 0 && paid < due;
};

/**
 * O(1) slot key builder for 365-day lesson generation loops (#27)
 */
export const makeLessonSlotKey = (groupId: string, date: string, time: string): string =>
  `${groupId}_${normalizeDateToISO(date) || date}_${normalizeTime(time) || time}`;

export const buildLessonSlotSet = (lessons: Lesson[]): Set<string> => {
  const slotSet = new Set<string>();
  for (const l of lessons) {
    if (!l || l.deleted || !l.groupId || !l.date || !l.time) continue;
    slotSet.add(makeLessonSlotKey(l.groupId, l.date, l.time));
  }
  return slotSet;
};

/**
 * Builds a format-normalized slot set of ALL occupied, cancelled, or deleted slots
 * across stored lessons and recently-deleted records so auto-generation never resurrects
 * a deleted or cancelled lesson even when date/time formatting differs.
 */
export const buildBlockedLessonSlotSet = (
  lessons: Lesson[],
  recentlyDeletedLessons?: Array<{ item?: Lesson } | Lesson>
): Set<string> => {
  const slotSet = new Set<string>();
  const addLesson = (l?: Lesson | null) => {
    if (!l || !l.groupId || !l.date || !l.time) return;
    slotSet.add(makeLessonSlotKey(l.groupId, l.date, l.time));
  };
  for (const l of lessons || []) {
    addLesson(l);
  }
  for (const entry of recentlyDeletedLessons || []) {
    if (!entry) continue;
    const item = (entry as any).item && typeof (entry as any).item === 'object' ? (entry as any).item : entry;
    addLesson(item as Lesson);
  }
  return slotSet;
};

/**
 * Finds future/scheduled auto-generated lessons (l_auto_*) that violate their group's
 * biweekly recurrence (biweekly_a / biweekly_b) and have NO attendance, payment, or notes (#7).
 */
export const findInvalidBiweeklyAutoLessons = (
  lessons: Lesson[],
  groups: Group[],
  fromDateStr?: string
): Lesson[] => {
  const groupsMap = new Map<string, Group>();
  for (const g of groups || []) {
    if (g && g.id) groupsMap.set(g.id, g);
  }

  return (lessons || []).filter(l => {
    if (!l || l.deleted) return false;
    if (!String(l.id || '').startsWith('l_auto_')) return false;
    if (l.status !== 'scheduled') return false;
    if (!l.date) return false;
    if (fromDateStr && l.date < fromDateStr) return false;

    const grp = l.groupId ? groupsMap.get(l.groupId) : undefined;
    const effectiveRecurrence =
      grp?.scheduleRecurrence && grp.scheduleRecurrence !== 'weekly'
        ? grp.scheduleRecurrence
        : l.scheduleRecurrence || 'weekly';

    if (effectiveRecurrence !== 'biweekly_a' && effectiveRecurrence !== 'biweekly_b') {
      return false;
    }

    if (isDateMatchingGroupRecurrence(effectiveRecurrence, l.date)) {
      return false;
    }

    // Must NOT have any attendance, payment, or notes/homework/scores
    const hasAttendance = Boolean(
      l.report?.attendanceStatus ||
      (l.report?.studentAttendance && Object.keys(l.report.studentAttendance).length > 0)
    );
    const hasPayment = Boolean(
      (l.amountPaid && l.amountPaid > 0) ||
      l.paymentStatus === 'paid' ||
      l.paymentStatus === 'exempted' ||
      l.report?.paymentStatus === 'paid' ||
      l.report?.paymentStatus === 'exempted' ||
      (l.studentPayments && Object.keys(l.studentPayments).length > 0) ||
      (l.report?.studentPayments && Object.keys(l.report.studentPayments).length > 0)
    );
    const hasNotesOrWork = Boolean(
      (l.quickNotes && l.quickNotes.trim().length > 0) ||
      (l.report?.teacherNotes && l.report.teacherNotes.trim().length > 0) ||
      (l.report?.homeworkTitle && l.report.homeworkTitle.trim().length > 0) ||
      (l.report?.homeworkDescription && l.report.homeworkDescription.trim().length > 0) ||
      l.report?.quizScore !== undefined ||
      l.report?.examScore !== undefined
    );

    return !hasAttendance && !hasPayment && !hasNotesOrWork;
  });
};

/**
 * Filters lessons for ReportsView (#4): excludes soft-deleted lessons, exempted lessons,
 * and lessons belonging to exempted students.
 */
const isStudentExempt = (s?: Student | null): boolean => {
  if (!s) return false;
  return Boolean(
    s.paymentStatus === 'exempted' ||
    (s as any).isExempted ||
    (s as any).isExemptFromPayment ||
    (s.paymentPlan as string) === 'exempt'
  );
};

export const filterBillableReportLessons = (
  lessons: Lesson[],
  students: Student[] = []
): Lesson[] => {
  const exemptStudentIds = new Set<string>(
    (students || [])
      .filter(s => s && !s.deleted && isStudentExempt(s))
      .map(s => s.id)
  );

  return (lessons || []).filter(l => {
    if (!l || l.deleted) return false;
    if ((l as any).isExempted || l.paymentStatus === 'exempted' || l.report?.paymentStatus === 'exempted') return false;
    if (l.studentId && exemptStudentIds.has(l.studentId)) return false;
    return true;
  });
};

/**
 * Filters payments for ReportsView (#4): excludes soft-deleted payments, exempted payments,
 * and payments belonging to exempted students.
 */
export const filterBillableReportPayments = (
  payments: PaymentRecord[],
  students: Student[] = []
): PaymentRecord[] => {
  const exemptStudentIds = new Set<string>(
    (students || [])
      .filter(s => s && !s.deleted && isStudentExempt(s))
      .map(s => s.id)
  );

  return (payments || []).filter(p => {
    if (!p || p.deleted) return false;
    if ((p as any).isExempted || p.status === 'exempted') return false;
    if (p.studentId && exemptStudentIds.has(p.studentId)) return false;
    return true;
  });
};

export type StudentReportAttendanceStatus = 'present' | 'absent' | 'late' | 'unrecorded';

/**
 * Task 2.1: Resolves "what was taught today" using ONLY arabicTopicsExplained and lesson.topic.
 * Never falls back to lesson.report.teacherNotes (private internal notes).
 */
export const resolveTaughtTodayTopic = (
  lesson: Partial<Lesson> | null | undefined,
  localReport?: Partial<LessonReport> | null
): { text: string; isMissing: boolean } => {
  const fromLocalReport = (localReport?.arabicTopicsExplained || '').trim();
  const fromLessonReport = (lesson?.report?.arabicTopicsExplained || '').trim();
  const fromLessonTopic = ((lesson as any)?.topic || '').trim();
  const text = fromLocalReport || fromLessonReport || fromLessonTopic;
  return {
    text,
    isMissing: !text,
  };
};

/**
 * Task 2.2: Single shared helper returning 'present' | 'absent' | 'late' | 'unrecorded'.
 * Used identically for both filtering and displaying absent/late students.
 */
export const resolveStudentReportAttendance = (
  studentId: string | undefined,
  lesson: Partial<Lesson> | null | undefined,
  localAttendance?: Record<string, 'present' | 'late' | 'absent'>,
  localReport?: Partial<LessonReport> | null,
  isGroupLesson?: boolean
): StudentReportAttendanceStatus => {
  const checkVal = (val: unknown): 'present' | 'absent' | 'late' | undefined => {
    if (val === 'present' || val === 'absent' || val === 'late') return val;
    return undefined;
  };

  if (studentId) {
    const fromLocal = checkVal(localAttendance?.[studentId]);
    if (fromLocal) return fromLocal;
    const fromLocalReport = checkVal(localReport?.studentAttendance?.[studentId]);
    if (fromLocalReport) return fromLocalReport;
    const fromLessonReport = checkVal(lesson?.report?.studentAttendance?.[studentId]);
    if (fromLessonReport) return fromLessonReport;
  }

  if (!isGroupLesson) {
    const fallbackStId = lesson?.studentId;
    if (fallbackStId) {
      const fromLessonStLocal = checkVal(localAttendance?.[fallbackStId]);
      if (fromLessonStLocal) return fromLessonStLocal;
      const fromLessonStReport = checkVal(
        localReport?.studentAttendance?.[fallbackStId] ?? lesson?.report?.studentAttendance?.[fallbackStId]
      );
      if (fromLessonStReport) return fromLessonStReport;
    }
    const fromSingle = checkVal(
      localAttendance?.['single'] ??
      localReport?.studentAttendance?.['single'] ??
      lesson?.report?.studentAttendance?.['single']
    );
    if (fromSingle) return fromSingle;
    const fromOverall = checkVal(localReport?.attendanceStatus ?? lesson?.report?.attendanceStatus);
    if (fromOverall) return fromOverall;
  }

  return 'unrecorded';
};

/**
 * Task 2.3: Resolves assigned homework text. When homework is not specified ('غير محدد' or empty),
 * does NOT print 'لا يوجد واجب' / 'Keine Hausaufgabe' / 'None assigned' unless 'no homework' was explicitly chosen.
 */
export const resolveReportHomework = (
  report: Partial<LessonReport> | null | undefined,
  localReport?: Partial<LessonReport> | null,
  lang: 'ar' | 'en' | 'de' = 'ar'
): { text: string; isExplicitNone: boolean; isMissing: boolean } => {
  const raw = (
    localReport?.arabicHomeworkRequired ??
    report?.arabicHomeworkRequired ??
    localReport?.homeworkDescription ??
    report?.homeworkDescription ??
    localReport?.homeworkTitle ??
    report?.homeworkTitle ??
    ''
  ).trim();

  const hwStatus = (localReport?.homeworkStatus ?? report?.homeworkStatus) as string | undefined;
  const hwOpt = (localReport?.arabicHomeworkOption ?? report?.arabicHomeworkOption ?? '').trim();

  const explicitNoneLabels = ['لا يوجد واجب', 'لا يوجد', 'none', 'none assigned', 'keine', 'keine hausaufgabe'];
  const isExplicitNone =
    hwStatus === 'none' ||
    hwOpt === 'none' ||
    explicitNoneLabels.includes(raw.toLowerCase()) ||
    explicitNoneLabels.includes(hwOpt.toLowerCase());

  if (isExplicitNone) {
    const noneText = lang === 'ar' ? 'لا يوجد واجب' : lang === 'de' ? 'Keine Hausaufgabe' : 'None assigned';
    return { text: noneText, isExplicitNone: true, isMissing: false };
  }

  if (!raw || raw === 'غير محدد') {
    return { text: '', isExplicitNone: false, isMissing: true };
  }

  return { text: raw, isExplicitNone: false, isMissing: false };
};

/**
 * Task 2.3: Resolves previous-homework completion status text.
 * Only returns 'لا يوجد واجب سابق' / 'Keine Hausaufgabe' / 'None assigned' when hwDone === 'none' was explicitly chosen;
 * returns '' when hwDone is undefined or 'غير محدد'.
 */
export const resolvePreviousHomeworkStatusText = (
  hwDone: 'yes' | 'no' | 'none' | string | undefined,
  lang: 'ar' | 'en' | 'de' = 'ar'
): string => {
  if (hwDone === 'yes') {
    return lang === 'ar' ? 'تم الحل بالكامل 👍' : lang === 'de' ? 'Vollständig erledigt 👍' : 'Completed fully 👍';
  }
  if (hwDone === 'no') {
    return lang === 'ar' ? 'لم يتم الحل 👎' : lang === 'de' ? 'Nicht erledigt 👎' : 'Not completed 👎';
  }
  if (hwDone === 'none') {
    return lang === 'ar' ? 'لا يوجد واجب سابق' : lang === 'de' ? 'Keine Hausaufgabe' : 'None assigned';
  }
  return '';
};

/**
 * Payment collection UI inside LessonControlModal should only be shown when:
 * 1. The lesson is a quick/trial single lesson, OR
 * 2. The group/student is billed per individual session (per_lesson / cycleTotalSessions <= 1), OR
 * 3. The billing cycle has completed on this session (e.g., Session 4 of 4 or Session 8 of 8).
 */
export function shouldShowLessonPaymentCollection(params: {
  isQuick?: boolean;
  isPerLessonGroup?: boolean;
  currentSessionNumber?: number;
  cycleTotalSessions?: number;
}): boolean {
  if (params.isQuick) return true;
  if (params.isPerLessonGroup) return true;
  const total = params.cycleTotalSessions || 0;
  const current = params.currentSessionNumber || 0;
  return total <= 1 || current >= total;
}

