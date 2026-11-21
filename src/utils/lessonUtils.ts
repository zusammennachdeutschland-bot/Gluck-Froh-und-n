import { Group, Lesson, LessonReport, PaymentPlanType, PaymentRecord, Student } from '../types';
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

interface LessonChronoKey {
  dateTime: string;
  createdAt: number;
  id: string;
}

const buildLessonChronoKey = (lesson: Partial<Lesson>): LessonChronoKey => {
  const dateStr = (lesson.date || '').trim();
  const timeStr = normalizeTime(lesson.time) || '00:00';
  const rawCreated = (lesson as any).createdAt;
  const createdAt = typeof rawCreated === 'number'
    ? rawCreated
    : (rawCreated ? Date.parse(String(rawCreated)) : NaN);
  return {
    dateTime: `${dateStr}T${timeStr}`,
    createdAt,
    id: String(lesson.id || '')
  };
};

const compareChronoKeys = (a: LessonChronoKey, b: LessonChronoKey): number => {
  if (a.dateTime !== b.dateTime) {
    return a.dateTime < b.dateTime ? -1 : 1;
  }
  if (Number.isFinite(a.createdAt) && Number.isFinite(b.createdAt) && a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }
  if (a.id === b.id) return 0;
  return a.id.localeCompare(b.id);
};

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
    return timeA < timeB ? -1 : 1;
  }

  const rawCreatedA = (a as any).createdAt;
  const rawCreatedB = (b as any).createdAt;
  const createdA = typeof rawCreatedA === 'number' ? rawCreatedA : (rawCreatedA ? Date.parse(String(rawCreatedA)) : NaN);
  const createdB = typeof rawCreatedB === 'number' ? rawCreatedB : (rawCreatedB ? Date.parse(String(rawCreatedB)) : NaN);
  if (!Number.isNaN(createdA) && !Number.isNaN(createdB) && createdA !== createdB) {
    return createdA - createdB;
  }

  const idA = String(a.id || '');
  const idB = String(b.id || '');
  return idA === idB ? 0 : idA.localeCompare(idB);
};

interface CompiledScopeMatcher {
  targetGroupId: string;
  targetGroupName: string;
  targetStudentId: string;
  targetStudentName: string;
  resolvedTargetStudentGroupId: string;
  match: (candidate: Partial<Lesson>) => boolean;
}

const compileScopeMatcher = (
  targetLesson: Partial<Lesson>,
  options?: LessonCycleOptions,
  studentGroupById?: Map<string, string>
): CompiledScopeMatcher => {
  const targetGroupId = (targetLesson.groupId || options?.group?.id || '').trim();
  const targetGroupName = (options?.group?.name || targetLesson.groupName || '').trim().toLowerCase();
  const targetStudentId = (targetLesson.studentId || options?.student?.id || '').trim();
  const rawTargetStudentName = targetLesson.studentName || (targetLesson as any).quickStudentName || options?.student?.name;
  const targetStudentName = rawTargetStudentName ? normalizeName(rawTargetStudentName) : '';
  let resolvedTargetStudentGroupId = '';
  if (targetStudentId) {
    resolvedTargetStudentGroupId =
      studentGroupById?.get(targetStudentId) ??
      options?.students?.find(s => s.id === targetStudentId)?.groupId ??
      '';
  }

  const match = (candidate: Partial<Lesson>): boolean => {
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
      if (resolvedTargetStudentGroupId && candidate.groupId && resolvedTargetStudentGroupId === candidate.groupId) {
        return true;
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

  return {
    targetGroupId,
    targetGroupName,
    targetStudentId,
    targetStudentName,
    resolvedTargetStudentGroupId,
    match
  };
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

  // Fallback only when no lesson collection was supplied at all (e.g. isolated preview with empty array)
  if (safeAllLessons.length === 0) {
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

  // One-pass O(n) rank computation: count active in-scope lessons strictly before target (and anchor)
  // without sorting allLessons.
  const scopeMatcher = compileScopeMatcher(lesson, options);
  const targetKey = buildLessonChronoKey(lesson);
  const targetId = lesson.id || '';
  const hasValidAnchor = Boolean(
    options?.group?.cycleAnchorSessionNumber &&
    options.group.cycleAnchorSessionNumber >= 1 &&
    (options.group.cycleAnchorLessonId || options.group.cycleAnchorDate)
  );
  const anchorLessonId = hasValidAnchor ? options?.group?.cycleAnchorLessonId : undefined;

  let hasTargetInList = false;
  let beforeTargetCount = 0;
  let anchorKeyFromId: LessonChronoKey | null = null;
  const activeKeys: LessonChronoKey[] | null = hasValidAnchor ? [] : null;

  for (let i = 0; i < safeAllLessons.length; i++) {
    const l = safeAllLessons[i];
    if (!l || l.deleted || l.status === 'cancelled') continue;
    if (!scopeMatcher.match(l)) continue;

    if (targetId && l.id === targetId) {
      hasTargetInList = true;
    }

    const key = buildLessonChronoKey(l);
    if (activeKeys) {
      activeKeys.push(key);
      if (anchorLessonId && !anchorKeyFromId && l.id === anchorLessonId) {
        anchorKeyFromId = key;
      }
    }

    if (compareChronoKeys(key, targetKey) < 0) {
      beforeTargetCount++;
    }
  }

  const sequenceIndex = beforeTargetCount;

  let sessionNumber: number;
  let cycleIndex: number;

  if (hasValidAnchor && options?.group) {
    const anchorSessionNum = Math.min(
      totalCycleSessions,
      Math.max(1, Math.floor(options.group.cycleAnchorSessionNumber!))
    );
    let anchorIndex = -1;
    let anchorRefKey: LessonChronoKey | null = anchorKeyFromId;

    if (!anchorRefKey && options.group.cycleAnchorDate) {
      anchorRefKey = {
        dateTime: `${options.group.cycleAnchorDate.trim()}T${normalizeTime(options.group.cycleAnchorTime) || options.group.cycleAnchorTime || '00:00'}`,
        createdAt: NaN,
        id: options.group.cycleAnchorLessonId || ''
      };
    }

    if (anchorRefKey && activeKeys) {
      let beforeAnchorCount = 0;
      for (let i = 0; i < activeKeys.length; i++) {
        if (compareChronoKeys(activeKeys[i], anchorRefKey) < 0) {
          beforeAnchorCount++;
        }
      }
      if (!hasTargetInList && compareChronoKeys(targetKey, anchorRefKey) < 0) {
        beforeAnchorCount++;
      }
      anchorIndex = beforeAnchorCount;
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
/**
 * Shared completion mutation used by the dashboard checkmark and persistence tests.
 * Keeping the lookup/fallback behavior here prevents the UI handler and regression
 * coverage from implementing subtly different completion paths.
 */
export const applyLessonCompletionMutation = (
  allLessons: Lesson[],
  lessonId: string,
  createCompletedLesson: (lesson: Lesson) => Lesson,
  fallbackLesson?: Lesson
): { lessons: Lesson[]; found: boolean } => {
  let found = false;
  const updated = (Array.isArray(allLessons) ? allLessons : []).map(lesson => {
    if (lesson?.id !== lessonId) return lesson;
    found = true;
    return createCompletedLesson(lesson);
  });
  if (!found && fallbackLesson?.id === lessonId) {
    return { lessons: [createCompletedLesson(fallbackLesson), ...updated], found: false };
  }
  return { lessons: updated, found };
};

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
  if (!changedLesson || !Array.isArray(allLessons)) return allLessons;

  const grp = options?.group;
  const st = options?.student;
  const wrap = options?.wrapMutation || (<T>(item: T) => item);

  const studentGroupById = new Map<string, string>();
  for (const student of options?.students || []) {
    if (student?.id && student.groupId) studentGroupById.set(student.id, student.groupId);
  }
  const scopeMatcher = compileScopeMatcher(changedLesson, { group: grp, student: st, students: options?.students }, studentGroupById);

  const hasValidAnchor = Boolean(
    grp?.cycleAnchorSessionNumber && grp.cycleAnchorSessionNumber >= 1 &&
    (grp.cycleAnchorLessonId || grp.cycleAnchorDate)
  );
  const anchorLessonId = hasValidAnchor ? grp?.cycleAnchorLessonId : undefined;

  const scopeIndices: number[] = [];
  const scopeKeys: LessonChronoKey[] = [];
  let isAlreadySorted = true;
  let prevKey: LessonChronoKey | null = null;
  let anchorSlot = -1;

  for (let idx = 0; idx < allLessons.length; idx++) {
    const lesson = allLessons[idx];
    if (!lesson || lesson.deleted || lesson.status === 'cancelled') continue;
    if (!scopeMatcher.match(lesson)) continue;

    const key = buildLessonChronoKey(lesson);
    const slot = scopeIndices.length;
    scopeIndices.push(idx);
    scopeKeys.push(key);

    if (prevKey !== null && compareChronoKeys(prevKey, key) > 0) {
      isAlreadySorted = false;
    }
    prevKey = key;

    if (anchorLessonId && anchorSlot === -1 && lesson.id === anchorLessonId) {
      anchorSlot = slot;
    }
  }

  const scopeCount = scopeIndices.length;
  if (scopeCount === 0) return allLessons;

  let orderedSlots: number[] | null = null;
  if (!isAlreadySorted) {
    orderedSlots = new Array<number>(scopeCount);
    for (let i = 0; i < scopeCount; i++) orderedSlots[i] = i;
    orderedSlots.sort((slotA, slotB) => compareChronoKeys(scopeKeys[slotA], scopeKeys[slotB]));
    if (anchorLessonId && anchorSlot !== -1) {
      for (let i = 0; i < scopeCount; i++) {
        if (orderedSlots[i] === anchorSlot) {
          anchorSlot = i;
          break;
        }
      }
    }
  }

  let anchorIndex = -1;
  if (hasValidAnchor && grp) {
    anchorIndex = anchorSlot;
    if (anchorIndex === -1 && grp.cycleAnchorDate) {
      const anchorKey: LessonChronoKey = {
        dateTime: `${grp.cycleAnchorDate.trim()}T${normalizeTime(grp.cycleAnchorTime) || grp.cycleAnchorTime || '00:00'}`,
        createdAt: NaN,
        id: grp.cycleAnchorLessonId || ''
      };
      let low = 0;
      let high = scopeCount;
      while (low < high) {
        const mid = (low + high) >>> 1;
        const key = scopeKeys[orderedSlots ? orderedSlots[mid] : mid];
        if (compareChronoKeys(key, anchorKey) < 0) low = mid + 1;
        else high = mid;
      }
      anchorIndex = low;
    }
  }

  // Hoist cycle invariants outside the sequencing pass
  const grpIsPerLesson = isGroupPerLesson(grp);
  const hasGroupOrStudent = Boolean(grp || st);
  const fixedIsPerLesson = hasGroupOrStudent
    ? Boolean(grpIsPerLesson || (!grp && st && (st.paymentPlan === 'per_lesson' || st.bundleSize === 1)))
    : false;
  const fixedGroupOrStudentTotal = fixedIsPerLesson
    ? 1
    : (grp?.sessionCount && grp.sessionCount > 1)
      ? grp.sessionCount
      : (st?.bundleSize && st.bundleSize > 1)
        ? st.bundleSize
        : 0;
  const rawStartingSession = grp?.startingSessionNumber || 1;
  const rawAnchorSession = Math.floor(grp?.cycleAnchorSessionNumber || 1);
  const useAnchor = Boolean(hasValidAnchor && grp && anchorIndex !== -1);

  let result: Lesson[] | null = null;
  for (let sequenceIndex = 0; sequenceIndex < scopeCount; sequenceIndex++) {
    const slot = orderedSlots ? orderedSlots[sequenceIndex] : sequenceIndex;
    const idx = scopeIndices[slot];
    const lesson = allLessons[idx];

    const isPerLesson = hasGroupOrStudent
      ? fixedIsPerLesson
      : lesson.totalSessionsInPackage === 1;
    const totalCycleSessions = isPerLesson
      ? 1
      : fixedGroupOrStudentTotal > 0
        ? fixedGroupOrStudentTotal
        : (lesson.totalSessionsInPackage && lesson.totalSessionsInPackage > 1)
          ? lesson.totalSessionsInPackage
          : 4;

    let sessionNumber = 1;
    if (!isPerLesson) {
      const startingSessionNumber = Math.min(totalCycleSessions, Math.max(1, rawStartingSession));
      if (useAnchor) {
        const anchorSessionNumber = Math.min(totalCycleSessions, Math.max(1, rawAnchorSession));
        const delta = sequenceIndex - anchorIndex;
        sessionNumber = ((((anchorSessionNumber - 1 + delta) % totalCycleSessions) + totalCycleSessions) % totalCycleSessions) + 1;
      } else {
        sessionNumber = ((startingSessionNumber - 1 + sequenceIndex) % totalCycleSessions) + 1;
      }
    }

    if (lesson.sessionNumber !== sessionNumber || lesson.totalSessionsInPackage !== totalCycleSessions) {
      if (!result) result = [...allLessons];
      result[idx] = wrap({ ...lesson, sessionNumber, totalSessionsInPackage: totalCycleSessions });
    }
  }

  return result || allLessons;
};

export const normalizeTime = (t?: string): string => {
  if (!t || typeof t !== 'string') return '';
  if (t.length === 5 && t.charCodeAt(2) === 58) {
    const c0 = t.charCodeAt(0);
    const c1 = t.charCodeAt(1);
    const c3 = t.charCodeAt(3);
    const c4 = t.charCodeAt(4);
    if (c0 >= 48 && c0 <= 57 && c1 >= 48 && c1 <= 57 && c3 >= 48 && c3 <= 57 && c4 >= 48 && c4 <= 57) {
      return t;
    }
  }
  const clean = t.trim();
  if (clean.length === 5 && clean.charCodeAt(2) === 58) {
    const c0 = clean.charCodeAt(0);
    const c1 = clean.charCodeAt(1);
    const c3 = clean.charCodeAt(3);
    const c4 = clean.charCodeAt(4);
    if (c0 >= 48 && c0 <= 57 && c1 >= 48 && c1 <= 57 && c3 >= 48 && c3 <= 57 && c4 >= 48 && c4 <= 57) {
      return clean;
    }
  }
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

const getRawTimeMinutes = (t: string): number => {
  if (!t) return 0;
  if (t.length === 5 && t.charCodeAt(2) === 58) {
    const h0 = t.charCodeAt(0) - 48;
    const h1 = t.charCodeAt(1) - 48;
    const m0 = t.charCodeAt(3) - 48;
    const m1 = t.charCodeAt(4) - 48;
    if (h0 >= 0 && h0 <= 9 && h1 >= 0 && h1 <= 9 && m0 >= 0 && m0 <= 9 && m1 >= 0 && m1 <= 9) {
      return (h0 * 10 + h1) * 60 + (m0 * 10 + m1);
    }
  }
  const colonIdx = t.indexOf(':');
  if (colonIdx === -1) {
    const h = Number(t) || 0;
    return h * 60;
  }
  const h = Number(t.slice(0, colonIdx)) || 0;
  const rest = t.slice(colonIdx + 1);
  const nextColon = rest.indexOf(':');
  const m = Number(nextColon === -1 ? rest : rest.slice(0, nextColon)) || 0;
  return h * 60 + m;
};

export const checkOverlap = (l1: any, l2: any) => {
  if (!l1 || !l2) return false;
  if (l1.id === l2.id) return false;
  if (normalizeDateToISO(l1.date) !== normalizeDateToISO(l2.date)) return false;
  
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

  const s1 = getRawTimeMinutes(l1.time);
  const e1 = s1 + (l1.durationMinutes || 60);
  const s2 = getRawTimeMinutes(l2.time);
  const e2 = s2 + (l2.durationMinutes || 60);
  return s1 < e2 && s2 < e1;
};

export const isSameLessonTarget = (l1: any, l2: any, students?: any[]): boolean => {
  if (!l1 || !l2) return false;
  // If both belong to the exact same group
  if (l1.groupId && l2.groupId && l1.groupId !== 'quick_group' && l1.groupId === l2.groupId) {
    return true;
  }
  // If both belong to the exact same student ID
  if (l1.studentId && l2.studentId && l1.studentId === l2.studentId) {
    return true;
  }
  // If student names match
  const n1 = normalizeName(l1.studentName || l1.quickStudentName);
  const n2 = normalizeName(l2.studentName || l2.quickStudentName);
  if (n1 && n2 && (n1 === n2 || n1.includes(n2) || n2.includes(n1))) {
    return true;
  }
  // Cross check if student belongs to the group
  if (students && Array.isArray(students)) {
    const stId = l1.studentId || l2.studentId;
    const grpId = l1.groupId || l2.groupId;
    if (stId && grpId && grpId !== 'quick_group') {
      const st = students.find(s => s.id === stId);
      if (st && st.groupId === grpId) {
        return true;
      }
    }
  }
  // Title comparison for individual sessions (e.g., "Einzelunterricht - Asser_Samy")
  const t1 = normalizeName(l1.title);
  const t2 = normalizeName(l2.title);
  if (t1 && t2 && t1 === t2 && t1.length > 5) {
    return true;
  }
  return false;
};

export const areDuplicateLessons = (l1: any, l2: any, students?: any[]): boolean => {
  if (!l1 || !l2 || l1.id === l2.id) return false;
  if (l1.deleted || l2.deleted) return false;
  if (normalizeDateToISO(l1.date) !== normalizeDateToISO(l2.date)) return false;
  
  if (!isSameLessonTarget(l1, l2, students)) return false;

  const t1 = normalizeTime(l1.time);
  const t2 = normalizeTime(l2.time);
  const sameTime = !t1 || !t2 || t1 === t2;
  const overlaps = checkOverlap(l1, l2);
  // Session numbers are cycle labels, not unique lesson identities. Different time slots
  // on the same date may legitimately share a session number (especially projected
  // recurring slots, which are resequenced only after a real lesson is saved).
  // Only the same slot or an overlapping slot is a duplicate occurrence.
  return sameTime || overlaps;
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

interface IndexedLessonMeta {
  id: string;
  normDate: string;
  normTime: string;
  rawStartMin: number;
  rawEndMin: number;
  isDone: boolean;
  rawGroupId: string;
  groupId: string;
  studentId: string;
  studentGroupId: string;
  normName: string;
  nameTokens: string[];
  normTitle: string;
  recurrence: string;
}

interface HotIdentityBucket {
  kind: 'hot';
  all: number[];
  byTime: Map<string, number[]>;
  noTime: number[];
  overlapTimed: number[];
}

type IdentityBucket = number[] | HotIdentityBucket;

const HOT_BUCKET_THRESHOLD = 48;

const extractLessonMeta = (lesson: any, studentsById: Map<string, any>): IndexedLessonMeta => {
  const normDate = normalizeDateToISO(lesson.date);
  const normTime = normalizeTime(lesson.time);
  const rawStartMin = getRawTimeMinutes(lesson.time);
  const rawEndMin = rawStartMin + (lesson.durationMinutes || 60);
  const isDone = Boolean(
    lesson.status === 'completed' ||
    lesson.status === 'cancelled' ||
    (lesson.report && lesson.report.attendanceStatus === 'completed')
  );
  const rawGroupId = lesson.groupId || '';
  const groupId = rawGroupId && rawGroupId !== 'quick_group' ? rawGroupId : '';
  const studentId = lesson.studentId || '';
  const studentGroupRaw = studentId ? (studentsById.get(studentId)?.groupId || '') : '';
  const studentGroupId = studentGroupRaw && studentGroupRaw !== 'quick_group' ? studentGroupRaw : '';
  const normName = normalizeName(lesson.studentName || lesson.quickStudentName);
  const nameTokens = normName ? normName.split(/\s+/).filter(Boolean) : [];
  const normTitle = normalizeName(lesson.title);
  return {
    id: lesson.id,
    normDate,
    normTime,
    rawStartMin,
    rawEndMin,
    isDone,
    rawGroupId,
    groupId,
    studentId,
    studentGroupId,
    normName,
    nameTokens,
    normTitle: normTitle.length > 5 ? normTitle : '',
    recurrence: lesson.scheduleRecurrence || ''
  };
};

const areDuplicateLessonMetas = (a: IndexedLessonMeta, b: IndexedLessonMeta): boolean => {
  if (a.id === b.id) return false;
  if (a.normDate !== b.normDate) return false;

  // Target equivalence (exact match to isSameLessonTarget)
  let sameTarget = false;
  if (a.groupId && b.groupId && a.groupId === b.groupId) {
    sameTarget = true;
  } else if (a.studentId && b.studentId && a.studentId === b.studentId) {
    sameTarget = true;
  } else if (a.normName && b.normName && (a.normName === b.normName || a.normName.includes(b.normName) || b.normName.includes(a.normName))) {
    sameTarget = true;
  } else {
    const stId = a.studentId || b.studentId;
    const rawGrpId = a.rawGroupId || b.rawGroupId;
    if (stId && rawGrpId && rawGrpId !== 'quick_group') {
      const stGroupId = a.studentId ? a.studentGroupId : b.studentGroupId;
      if (stGroupId === rawGrpId) {
        sameTarget = true;
      }
    }
    if (!sameTarget && a.normTitle && b.normTitle && a.normTitle === b.normTitle) {
      sameTarget = true;
    }
  }
  if (!sameTarget) return false;

  // Time / overlap equivalence (exact match to areDuplicateLessons + checkOverlap)
  if (!a.normTime || !b.normTime || a.normTime === b.normTime) {
    return true;
  }
  if (a.isDone || b.isDone) {
    return false;
  }
  if (a.groupId && b.groupId && a.groupId === b.groupId) {
    return false;
  }
  if (
    (a.recurrence === 'biweekly_a' && b.recurrence === 'biweekly_b') ||
    (a.recurrence === 'biweekly_b' && b.recurrence === 'biweekly_a')
  ) {
    return false;
  }
  return a.rawStartMin < b.rawEndMin && b.rawStartMin < a.rawEndMin;
};

const insertIntoHotBucket = (bucket: HotIdentityBucket, index: number, meta: IndexedLessonMeta) => {
  bucket.all.push(index);
  if (!meta.normTime) {
    bucket.noTime.push(index);
  } else {
    let timeList = bucket.byTime.get(meta.normTime);
    if (!timeList) bucket.byTime.set(meta.normTime, (timeList = []));
    timeList.push(index);
    if (!meta.isDone) {
      bucket.overlapTimed.push(index);
    }
  }
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
  const studentsById = new Map<string, any>();
  for (const student of students || []) {
    if ((student as any)?.id) studentsById.set((student as any).id, student);
  }

  const activeList: any[] = [];
  const activeMetas: IndexedLessonMeta[] = [];
  const deletedList: any[] = [];
  const nameTokenFrequency = new Map<string, number>();

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    if (!lesson?.id) continue;
    if (lesson.deleted) {
      deletedList.push(lesson);
      continue;
    }
    const meta = extractLessonMeta(lesson, studentsById);
    activeList.push(lesson);
    activeMetas.push(meta);

    const tokens = meta.nameTokens;
    const tokenCount = tokens.length;
    if (tokenCount === 1) {
      const tok = tokens[0];
      nameTokenFrequency.set(tok, (nameTokenFrequency.get(tok) || 0) + 1);
    } else if (tokenCount > 1) {
      const seenTok = new Set<string>();
      for (let t = 0; t < tokenCount; t++) {
        const tok = tokens[t];
        if (!seenTok.has(tok)) {
          seenTok.add(tok);
          nameTokenFrequency.set(tok, (nameTokenFrequency.get(tok) || 0) + 1);
        }
      }
    }
  }

  const survivors: any[] = [];
  const survivorMetas: IndexedLessonMeta[] = [];
  const byDate = new Map<string, Map<string, IdentityBucket>>();
  const seenStamp = new Uint32Array(activeList.length);
  let scanGen = 0;

  const getIdentityKeys = (meta: IndexedLessonMeta): string[] => {
    const keys: string[] = [];
    if (meta.groupId) keys.push(`g:${meta.groupId}`);
    if (meta.studentId) {
      keys.push(`s:${meta.studentId}`);
      if (meta.studentGroupId && meta.studentGroupId !== meta.groupId) {
        keys.push(`g:${meta.studentGroupId}`);
      }
    }
    if (meta.normName) {
      keys.push(`n:${meta.normName}`);
      const tokens = meta.nameTokens;
      for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        if ((nameTokenFrequency.get(tok) || 0) <= 64) {
          keys.push(`w:${tok}`);
        }
      }
    }
    if (meta.normTitle) {
      keys.push(`t:${meta.normTitle}`);
    }
    return keys;
  };

  const addIndexEntry = (dateBuckets: Map<string, IdentityBucket>, key: string, index: number, meta: IndexedLessonMeta) => {
    const existing = dateBuckets.get(key);
    if (!existing) {
      dateBuckets.set(key, [index]);
      return;
    }
    if (Array.isArray(existing)) {
      existing.push(index);
      if (existing.length >= HOT_BUCKET_THRESHOLD) {
        const hot: HotIdentityBucket = {
          kind: 'hot',
          all: existing,
          byTime: new Map(),
          noTime: [],
          overlapTimed: []
        };
        for (let j = 0; j < existing.length; j++) {
          const sIdx = existing[j];
          const sMeta = survivorMetas[sIdx];
          if (!sMeta.normTime) {
            hot.noTime.push(sIdx);
          } else {
            let timeList = hot.byTime.get(sMeta.normTime);
            if (!timeList) hot.byTime.set(sMeta.normTime, (timeList = []));
            timeList.push(sIdx);
            if (!sMeta.isDone) {
              hot.overlapTimed.push(sIdx);
            }
          }
        }
        dateBuckets.set(key, hot);
      }
      return;
    }
    insertIntoHotBucket(existing, index, meta);
  };

  const scanCandidateIndices = (
    list: number[] | undefined,
    candMeta: IndexedLessonMeta,
    gen: number,
    bestIndex: number
  ): number => {
    if (!list) return bestIndex;
    for (let j = 0; j < list.length; j++) {
      const sIdx = list[j];
      if (sIdx >= bestIndex) continue;
      if (seenStamp[sIdx] === gen) continue;
      seenStamp[sIdx] = gen;
      if (areDuplicateLessonMetas(survivorMetas[sIdx], candMeta)) {
        bestIndex = sIdx;
      }
    }
    return bestIndex;
  };

  for (let i = 0; i < activeList.length; i++) {
    const candidate = activeList[i];
    const candMeta = activeMetas[i];

    if (!candMeta.normDate) {
      survivors.push(candidate);
      survivorMetas.push(candMeta);
      continue;
    }

    let dateBuckets = byDate.get(candMeta.normDate);
    if (!dateBuckets) {
      // First lesson seen on this date: zero lookup overhead
      dateBuckets = new Map();
      byDate.set(candMeta.normDate, dateBuckets);
      const index = survivors.length;
      survivors.push(candidate);
      survivorMetas.push(candMeta);
      const keys = getIdentityKeys(candMeta);
      for (let k = 0; k < keys.length; k++) {
        dateBuckets.set(keys[k], [index]);
      }
      continue;
    }

    const keys = getIdentityKeys(candMeta);
    let existingIndex = activeList.length;
    let gen = 0;

    for (let k = 0; k < keys.length; k++) {
      const bucket = dateBuckets.get(keys[k]);
      if (!bucket) continue;
      if (gen === 0) {
        gen = ++scanGen;
      }
      if (Array.isArray(bucket)) {
        existingIndex = scanCandidateIndices(bucket, candMeta, gen, existingIndex);
      } else if (!candMeta.normTime) {
        existingIndex = scanCandidateIndices(bucket.all, candMeta, gen, existingIndex);
      } else {
        existingIndex = scanCandidateIndices(bucket.byTime.get(candMeta.normTime), candMeta, gen, existingIndex);
        existingIndex = scanCandidateIndices(bucket.noTime, candMeta, gen, existingIndex);
        if (!candMeta.isDone) {
          existingIndex = scanCandidateIndices(bucket.overlapTimed, candMeta, gen, existingIndex);
        }
      }
      if (existingIndex === 0) break;
    }

    if (existingIndex < survivors.length) {
      const { survivor, duplicate } = pickAuthoritativeLesson(survivors[existingIndex], candidate);
      survivors[existingIndex] = survivor;
      removedIds.add(duplicate.id);
      idMap.set(duplicate.id, survivor.id);
      const winnerMeta = survivor.id === candidate.id ? candMeta : extractLessonMeta(survivor, studentsById);
      survivorMetas[existingIndex] = winnerMeta;
      if (winnerMeta.normDate) {
        const winnerDateBuckets = winnerMeta.normDate === candMeta.normDate
          ? dateBuckets
          : (byDate.get(winnerMeta.normDate) || (() => { const m = new Map(); byDate.set(winnerMeta.normDate, m); return m; })());
        const winnerKeys = winnerMeta === candMeta ? keys : getIdentityKeys(winnerMeta);
        for (let k = 0; k < winnerKeys.length; k++) {
          addIndexEntry(winnerDateBuckets, winnerKeys[k], existingIndex, winnerMeta);
        }
      }
    } else {
      const index = survivors.length;
      survivors.push(candidate);
      survivorMetas.push(candMeta);
      for (let k = 0; k < keys.length; k++) {
        addIndexEntry(dateBuckets, keys[k], index, candMeta);
      }
    }
  }

  const deduplicated = [...survivors, ...deletedList.filter(item => !removedIds.has(item.id))];
  return { deduplicated, removedIds, idMap, hasChanges: removedIds.size > 0 };
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

  // Deduplicate paid payments among themselves (indexed by id and studentId for O(n) scaling)
  const dedupedPaid: any[] = [];
  const paidIdxById = new Map<string, number>();
  const paidIndicesByStudent = new Map<string, number[]>();

  const getRealPaymentLessonIds = (p: any): string[] => {
    const ids: string[] = [];
    if (p.lessonId && !String(p.lessonId).startsWith('virtual_')) {
      ids.push(String(p.lessonId));
    }
    if (Array.isArray(p.lessonIds)) {
      for (const id of p.lessonIds) {
        if (typeof id === 'string' && id && !id.startsWith('virtual_') && !ids.includes(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  };

  const getNormalizedPaymentDateSet = (p: any): string[] => {
    if (!Array.isArray(p.lessonDates)) return [];
    const dates: string[] = [];
    for (const dStr of p.lessonDates) {
      if (typeof dStr !== 'string') continue;
      const match = dStr.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/);
      if (match) {
        const iso = normalizeDateToISO(match[1]);
        if (iso && !dates.includes(iso)) dates.push(iso);
      }
    }
    return dates.sort();
  };

  for (const p of paidPayments) {
    let existingIdx = paidIdxById.get(p.id) ?? -1;
    const studentPaidIndices = paidIndicesByStudent.get(p.studentId || '');
    const pRealIds = getRealPaymentLessonIds(p);
    const pNormDates = getNormalizedPaymentDateSet(p);

    if (existingIdx < 0 && studentPaidIndices) {
      for (let i = 0; i < studentPaidIndices.length; i++) {
        const idx = studentPaidIndices[i];
        const d = dedupedPaid[idx];
        const dRealIds = getRealPaymentLessonIds(d);
        let matched = false;
        if (dRealIds.length > 0 && pRealIds.length > 0) {
          if (dRealIds.length === pRealIds.length && dRealIds.every((id: string) => pRealIds.includes(id))) {
            matched = true;
          }
        } else if (dRealIds.length === 0 && pRealIds.length === 0) {
          // Legacy records lacking lessonIds: only collapse when exact group, bundle, dueDate, amountDue AND lessonDates match
          const dNormDates = getNormalizedPaymentDateSet(d);
          const datesMatch = dNormDates.length > 0 && pNormDates.length > 0 &&
            dNormDates.length === pNormDates.length &&
            dNormDates.every((val, di) => val === pNormDates[di]);
          if (
            datesMatch &&
            (d.groupId || '') === (p.groupId || '') &&
            d.dueDate && p.dueDate && d.dueDate === p.dueDate &&
            d.bundleSize === p.bundleSize &&
            d.amountDue === p.amountDue
          ) {
            matched = true;
          }
        }
        if (matched) {
          existingIdx = idx;
          break;
        }
      }
    }

    if (existingIdx >= 0) {
      const existing = dedupedPaid[existingIdx];
      const winner = (p.amountPaid || 0) >= (existing.amountPaid || 0) ? p : existing;
      const loser = winner === p ? existing : p;
      dedupedPaid[existingIdx] = winner;
      if (winner.id !== existing.id) {
        paidIdxById.set(winner.id, existingIdx);
      }
      removedIds.add(loser.id);
      modified = true;
    } else {
      const newIdx = dedupedPaid.length;
      dedupedPaid.push(p);
      if (!paidIdxById.has(p.id)) paidIdxById.set(p.id, newIdx);
      const stKey = p.studentId || '';
      let list = paidIndicesByStudent.get(stKey);
      if (!list) paidIndicesByStudent.set(stKey, (list = []));
      list.push(newIdx);
    }
  }

  // Helper sets from paid records - indexed strictly per student so one student's payment never affects other students
  const paidLessonIdsByStudent = new Map<string, Set<string>>();
  const legacyPaidDateSignaturesByStudent = new Map<string, Set<string>>();

  dedupedPaid.forEach(p => {
    const stId = p.studentId;
    if (!stId) return;

    const realIds = getRealPaymentLessonIds(p);
    if (realIds.length > 0) {
      let stIdsSet = paidLessonIdsByStudent.get(stId);
      if (!stIdsSet) {
        stIdsSet = new Set<string>();
        paidLessonIdsByStudent.set(stId, stIdsSet);
      }
      realIds.forEach(id => stIdsSet!.add(id));
    } else if (Array.isArray(p.lessonDates) && p.lessonDates.length > 0) {
      // Only legacy records without real lessonIds contribute to date-signature fallback
      let stDatesSet = legacyPaidDateSignaturesByStudent.get(stId);
      if (!stDatesSet) {
        stDatesSet = new Set<string>();
        legacyPaidDateSignaturesByStudent.set(stId, stDatesSet);
      }
      getNormalizedPaymentDateSet(p).forEach(iso => {
        stDatesSet!.add(`${stId}_${iso}_${p.groupId || ''}`);
      });
    }
  });

  // Filter and deduplicate pending payments against PAID records of the SAME STUDENT and against each other
  const dedupedPending: any[] = [];
  const pendingIndicesByStudent = new Map<string, number[]>();

  for (const p of pendingPayments) {
    const stId = p.studentId;
    const studentPaidLessonIds = stId ? paidLessonIdsByStudent.get(stId) : undefined;
    const studentLegacyPaidDates = stId ? legacyPaidDateSignaturesByStudent.get(stId) : undefined;

    // Check if this pending payment is ALREADY COVERED by any paid record OF THE SAME STUDENT
    const realLessonIds = getRealPaymentLessonIds(p);
    const isIdsCoveredByPaid = Boolean(
      studentPaidLessonIds &&
      studentPaidLessonIds.size > 0 &&
      realLessonIds.length > 0 &&
      realLessonIds.every((id: string) => Boolean(studentPaidLessonIds.has(id)))
    );

    // Date coverage fallback applies ONLY when pending record has zero real lessonIds (legacy)
    let isDatesCoveredByPaid = false;
    if (realLessonIds.length === 0 && studentLegacyPaidDates && studentLegacyPaidDates.size > 0) {
      const parsedDates = getNormalizedPaymentDateSet(p);
      if (
        parsedDates.length > 0 &&
        parsedDates.every(dIso => Boolean(studentLegacyPaidDates.has(`${stId}_${dIso}_${p.groupId || ''}`)))
      ) {
        isDatesCoveredByPaid = true;
      }
    }

    // Direct overlap with a paid payment of the EXACT SAME student strictly by lesson ID
    const studentPaidIndices = paidIndicesByStudent.get(stId || '');
    let matchesPaidPayment = false;
    if (studentPaidIndices && realLessonIds.length > 0) {
      for (let i = 0; i < studentPaidIndices.length; i++) {
        const paid = dedupedPaid[studentPaidIndices[i]];
        const paidRealIds = getRealPaymentLessonIds(paid);
        if (paidRealIds.length > 0 && paidRealIds.every((id: string) => realLessonIds.includes(id)) && realLessonIds.every((id: string) => paidRealIds.includes(id))) {
          matchesPaidPayment = true;
          break;
        }
      }
    }

    if (isIdsCoveredByPaid || isDatesCoveredByPaid || matchesPaidPayment) {
      removedIds.add(p.id);
      modified = true;
      continue;
    }

    // Deduplicate pending payments against other pending payments of the same student strictly by lessonIds (or legacy context)
    const stKey = stId || '';
    const studentPendingIndices = pendingIndicesByStudent.get(stKey);
    const pNormDates = getNormalizedPaymentDateSet(p);
    let existingPendingIdx = -1;
    if (studentPendingIndices) {
      for (let i = 0; i < studentPendingIndices.length; i++) {
        const idx = studentPendingIndices[i];
        const c = dedupedPending[idx];
        if (c.id === p.id) {
          existingPendingIdx = idx;
          break;
        }
        const cRealIds = getRealPaymentLessonIds(c);
        if (cRealIds.length > 0 && realLessonIds.length > 0) {
          if (cRealIds.some((lid: string) => realLessonIds.includes(lid))) {
            existingPendingIdx = idx;
            break;
          }
        } else if (cRealIds.length === 0 && realLessonIds.length === 0) {
          const cNormDates = getNormalizedPaymentDateSet(c);
          const datesMatch = cNormDates.length > 0 && pNormDates.length > 0 &&
            cNormDates.length === pNormDates.length &&
            cNormDates.every((val, di) => val === pNormDates[di]);
          if (
            datesMatch &&
            (c.groupId || '') === (p.groupId || '') &&
            (c.dueDate || '') === (p.dueDate || '') &&
            (c.amountDue || 0) === (p.amountDue || 0)
          ) {
            existingPendingIdx = idx;
            break;
          }
        }
      }
    }

    if (existingPendingIdx >= 0) {
      const existing = dedupedPending[existingPendingIdx];
      const winner = (p.amountPaid || 0) > (existing.amountPaid || 0) ? p : existing;
      const loser = winner === p ? existing : p;
      dedupedPending[existingPendingIdx] = winner;
      removedIds.add(loser.id);
      modified = true;
    } else {
      const newIdx = dedupedPending.length;
      dedupedPending.push(p);
      let list = pendingIndicesByStudent.get(stKey);
      if (!list) pendingIndicesByStudent.set(stKey, (list = []));
      list.push(newIdx);
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
  const lessonDateKey = normalizeDateToISO(lesson.date);
  if (!lessonDateKey) return true;
  if (lessonDateKey >= normalizeDateToISO(cutoffStr)) return true;
  // Never evict a group's cycle anchor lesson from the active RAM window
  if (lesson.groupId && Array.isArray(groups) && groups.length > 0) {
    const anchorGrp = groups.find(g => g && !g.deleted && g.id === lesson.groupId);
    if (anchorGrp?.cycleAnchorLessonId && anchorGrp.cycleAnchorLessonId === lesson.id) {
      return true;
    }
  }
  if (lesson.status === 'scheduled' || isPendingStatus(lesson.status)) return true;

  if (lesson.status !== 'completed') return false;
  if (lessonDateKey < normalizeDateToISO(maxCutoffStr)) return false;

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
  `${groupId}_${date}_${normalizeTime(time) || time}`;

export const buildLessonSlotSet = (lessons: Lesson[]): Set<string> => {
  const slotSet = new Set<string>();
  for (const l of lessons) {
    if (!l || l.deleted || !l.groupId || !l.date || !l.time) continue;
    slotSet.add(makeLessonSlotKey(l.groupId, l.date, l.time));
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
    if (fromDateStr && normalizeDateToISO(l.date) < normalizeDateToISO(fromDateStr)) return false;

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

export function hasStudentCustomPricingOverride(student: Partial<Student> | null | undefined): boolean {
  if (!student) return false;
  if (student.customBundlePrice !== undefined && student.customBundlePrice !== null && student.customBundlePrice > 0) {
    return true;
  }
  if (
    student.paymentPlan === 'custom_bundle' &&
    ((student.customBundlePrice ?? 0) > 0 || (student.pricePerLesson ?? 0) > 0)
  ) {
    return true;
  }
  return false;
}

export function reconcileStudentForGroupMove(
  student: Student,
  targetGroup: Group | undefined,
  todayIso: string,
  newGroupId: string
): Student {
  const prevGroupId = (student.groupId || '').trim();
  const existingHistory = Array.isArray(student.groupHistory) ? [...student.groupHistory] : [];
  const existingPrevIds = Array.isArray(student.previousGroupIds) ? [...student.previousGroupIds] : [];
  if (prevGroupId && prevGroupId !== newGroupId) {
    existingHistory.push({ groupId: prevGroupId, leftDate: todayIso });
    if (!existingPrevIds.includes(prevGroupId)) {
      existingPrevIds.push(prevGroupId);
    }
  }

  if (!targetGroup) {
    return {
      ...student,
      groupId: newGroupId,
      ...(prevGroupId && prevGroupId !== newGroupId
        ? { groupHistory: existingHistory, previousGroupIds: existingPrevIds }
        : {}),
      updatedAt: Date.now()
    } as Student;
  }

  const isPerLesson = isGroupPerLesson(targetGroup);
  const sessionCount = isPerLesson ? 1 : Math.max(2, targetGroup.sessionCount || 4);
  const newPaymentPlan: PaymentPlanType = isPerLesson
    ? 'per_lesson'
    : sessionCount === 4
    ? '4_lessons'
    : sessionCount === 8
    ? '8_lessons'
    : sessionCount === 12
    ? '12_lessons'
    : 'custom_bundle';
  const effectiveGroupFee = isPerLesson
    ? (targetGroup.pricePerSession ?? targetGroup.monthlyPackagePrice ?? 0)
    : (targetGroup.monthlyPackagePrice || 1200);
  const newPricePerLesson = isPerLesson
    ? effectiveGroupFee
    : Math.round(effectiveGroupFee / sessionCount);

  const hasExplicitCustomBundlePrice =
    student.customBundlePrice !== undefined &&
    student.customBundlePrice !== null &&
    student.customBundlePrice > 0;

  return {
    ...student,
    groupId: newGroupId,
    grade: targetGroup.grade || student.grade,
    paymentPlan: newPaymentPlan,
    bundleSize: sessionCount,
    monthlyFee: effectiveGroupFee,
    pricePerLesson: newPricePerLesson,
    ...(hasExplicitCustomBundlePrice ? { customBundlePrice: student.customBundlePrice } : {}),
    ...(prevGroupId && prevGroupId !== newGroupId
      ? { groupHistory: existingHistory, previousGroupIds: existingPrevIds }
      : {}),
    updatedAt: Date.now()
  } as Student;
}

