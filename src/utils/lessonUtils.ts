import { Group, Lesson } from '../types';
import { normalizeDateToISO } from './timeUtils';

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

  const groupLessons = (lessons || []).filter(l => l.groupId === group.id && !l.deleted && l.status !== 'cancelled');

  const completedLessons = groupLessons
    .filter(l => l.status === 'completed')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  const inProgressLesson = groupLessons.find(l => l.status === 'in_progress');

  const upcomingScheduled = groupLessons
    .filter(l => l.status === 'scheduled')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  let currentSessionNumber = startingSessionNumber;

  if (inProgressLesson && typeof inProgressLesson.sessionNumber === 'number' && inProgressLesson.sessionNumber >= 1) {
    currentSessionNumber = ((inProgressLesson.sessionNumber - 1) % sessionCount) + 1;
  } else if (upcomingScheduled.length > 0 && typeof upcomingScheduled[0].sessionNumber === 'number' && upcomingScheduled[0].sessionNumber >= 1) {
    currentSessionNumber = ((upcomingScheduled[0].sessionNumber - 1) % sessionCount) + 1;
  } else if (inProgressLesson) {
    currentSessionNumber = ((startingSessionNumber - 1 + completedLessons.length) % sessionCount) + 1;
  } else if (completedLessons.length > 0) {
    const lastCompleted = completedLessons[completedLessons.length - 1];
    if (typeof lastCompleted?.sessionNumber === 'number' && lastCompleted.sessionNumber >= 1) {
      currentSessionNumber = (lastCompleted.sessionNumber % sessionCount) + 1;
    } else {
      currentSessionNumber = ((startingSessionNumber - 1 + completedLessons.length) % sessionCount) + 1;
    }
  }

  const completedInCycle = currentSessionNumber - 1;
  const progressPercent = Math.min(100, Math.round((completedInCycle / sessionCount) * 100));
  const cycleNumber = Math.floor(completedLessons.length / sessionCount) + 1;

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
 * Calculates the exact sequential session number for any lesson,
 * strictly prioritizing explicit lesson.sessionNumber when present,
 * and strictly excluding cancelled lessons (status === 'cancelled') and deleted lessons.
 * This guarantees consistent cycle numbers across Finance, Reports, History, and Modals.
 */
export const calculateSequentialSessionNumber = (
  lesson: Partial<Lesson> | null | undefined,
  allLessons: Lesson[],
  options?: {
    group?: Partial<Group> | null;
    student?: { id?: string; name?: string; groupId?: string } | null;
    students?: Array<{ id: string; name: string; groupId?: string }>;
    forceRecalculate?: boolean;
  }
): number => {
  if (!lesson) return 1;

  // Single lesson groups / per-lesson payments always have session number 1
  const isPerLesson = isGroupPerLesson(options?.group);
  if (isPerLesson) return 1;

  const cycleTotalSessions = (options?.group?.sessionCount && options.group.sessionCount > 1)
    ? options.group.sessionCount
    : (lesson.totalSessionsInPackage && lesson.totalSessionsInPackage > 1 ? lesson.totalSessionsInPackage : 4);

  // Priority 1: If the lesson ALREADY has a valid session number explicitly set, respect it!
  if (
    !options?.forceRecalculate &&
    typeof lesson.sessionNumber === 'number' &&
    lesson.sessionNumber >= 1 &&
    lesson.sessionNumber <= cycleTotalSessions
  ) {
    return lesson.sessionNumber;
  }

  const startingSessionNumber = Math.min(
    cycleTotalSessions,
    Math.max(1, options?.group?.startingSessionNumber || 1)
  );

  const targetGroupId = lesson.groupId || options?.group?.id || options?.student?.groupId;
  const targetStudentId = lesson.studentId || options?.student?.id;
  const rawTargetName = lesson.studentName || options?.student?.name;
  const targetStudentName = rawTargetName ? normalizeName(rawTargetName) : '';

  // Filter lessons belonging to this entity, EXCLUDING cancelled and deleted
  const nonCancelledLessons = (allLessons || []).filter(l => {
    if (l.deleted || l.status === 'cancelled') return false;

    if (targetGroupId && l.groupId === targetGroupId) {
      return true;
    }
    if (options?.group?.name) {
      const gName = options.group.name.trim().toLowerCase();
      if (l.groupName && l.groupName.trim().toLowerCase() === gName) return true;
      if (l.title && l.title.toLowerCase().includes(gName)) return true;
    }
    if (!targetGroupId && targetStudentId && l.studentId === targetStudentId) {
      return true;
    }
    if (!targetGroupId && targetStudentName) {
      const lName = normalizeName(l.studentName || l.quickStudentName);
      if (lName && (lName === targetStudentName || lName.includes(targetStudentName) || targetStudentName.includes(lName))) {
        return true;
      }
    }
    if (options?.students && targetStudentId && l.groupId) {
      const st = options.students.find(s => s.id === targetStudentId);
      if (st && st.groupId === l.groupId && (!targetGroupId || l.groupId === targetGroupId)) return true;
    }
    return false;
  });

  // Sort chronologically by date and normalized time
  nonCancelledLessons.sort((a, b) => {
    const timeA = `${a.date || ''}T${normalizeTime(a.time) || '00:00'}`;
    const timeB = `${b.date || ''}T${normalizeTime(b.time) || '00:00'}`;
    return timeA.localeCompare(timeB);
  });

  let index = -1;
  if (lesson.id) {
    index = nonCancelledLessons.findIndex(l => l.id === lesson.id);
  }

  // If lesson is not in the list (e.g. unsaved draft, in-progress modal, probe)
  if (index === -1) {
    const currentLessonTime = `${lesson.date || ''}T${normalizeTime(lesson.time) || '00:00'}`;
    index = nonCancelledLessons.filter(l => {
      const lTime = `${l.date || ''}T${normalizeTime(l.time) || '00:00'}`;
      return lTime < currentLessonTime;
    }).length;
  }

  // Check if any preceding lesson in the chain has a known sessionNumber
  if (index > 0) {
    for (let i = index - 1; i >= 0; i--) {
      const prev = nonCancelledLessons[i];
      if (typeof prev.sessionNumber === 'number' && prev.sessionNumber >= 1 && prev.id !== lesson.id) {
        const offset = index - i;
        const computed = ((prev.sessionNumber - 1 + offset) % cycleTotalSessions) + 1;
        return Math.max(1, Math.min(cycleTotalSessions, computed));
      }
    }
  }

  const computedNum = ((startingSessionNumber - 1 + Math.max(0, index)) % cycleTotalSessions) + 1;
  return Math.max(1, Math.min(cycleTotalSessions, computedNum));
};

export const normalizeTime = (t?: string): string => {
  if (!t) return '';
  const clean = t.trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return clean;
};

export const normalizeName = (name?: string): string => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[_–—\-]+/g, ' ').replace(/\s+/g, ' ');
};

export const checkOverlap = (l1: any, l2: any) => {
  if (l1.date !== l2.date) return false;
  if (l1.id === l2.id) return false;
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
  if (l1.date !== l2.date) return false;
  
  if (!isSameLessonTarget(l1, l2, students)) return false;

  const t1 = normalizeTime(l1.time);
  const t2 = normalizeTime(l2.time);
  const sameTime = !t1 || !t2 || t1 === t2;
  const overlaps = checkOverlap(l1, l2);
  const sameSession = l1.sessionNumber && l2.sessionNumber && l1.sessionNumber === l2.sessionNumber;

  return sameTime || overlaps || sameSession;
};

export const pickAuthoritativeLesson = (l1: any, l2: any): { survivor: any; duplicate: any } => {
  const statusScore = (s: string) => {
    if (s === 'completed') return 100;
    if (s === 'in_progress') return 50;
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

  let survivor = score1 >= score2 ? { ...l1 } : { ...l2 };
  let duplicate = score1 >= score2 ? { ...l2 } : { ...l1 };

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
  const activeList = lessons.filter(l => l && l.id && !l.deleted);
  const deletedList = lessons.filter(l => l && l.id && l.deleted);

  const survivors: any[] = [];

  for (const candidate of activeList) {
    if (removedIds.has(candidate.id)) continue;

    // Check if candidate is duplicate with any already accepted survivor
    const existingIndex = survivors.findIndex(s => areDuplicateLessons(s, candidate, students));

    if (existingIndex >= 0) {
      const existingSurvivor = survivors[existingIndex];
      const { survivor, duplicate } = pickAuthoritativeLesson(existingSurvivor, candidate);

      survivors[existingIndex] = survivor;
      removedIds.add(duplicate.id);
      idMap.set(duplicate.id, survivor.id);
    } else {
      survivors.push(candidate);
    }
  }

  const hasChanges = removedIds.size > 0;
  // Keep deleted list if needed or return only survivors
  const deduplicated = [...survivors, ...deletedList.filter(d => !removedIds.has(d.id))];

  return { deduplicated, removedIds, idMap, hasChanges };
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

  // Deduplicate paid payments among themselves (keeping the most detailed / highest amount)
  const dedupedPaid: any[] = [];
  for (const p of paidPayments) {
    const existingIdx = dedupedPaid.findIndex(d => {
      if (d.id === p.id) return true;
      if (d.studentId !== p.studentId) return false;
      // Check if both reference the exact same lesson IDs
      if (Array.isArray(d.lessonIds) && Array.isArray(p.lessonIds) && d.lessonIds.length > 0 && p.lessonIds.length > 0) {
        const hasSameIds = d.lessonIds.length === p.lessonIds.length && d.lessonIds.every((id: string) => p.lessonIds.includes(id));
        if (hasSameIds) return true;
      }
      if (d.dueDate && p.dueDate && d.dueDate === p.dueDate && d.bundleSize === p.bundleSize && d.amountDue === p.amountDue) {
        return true;
      }
      return false;
    });

    if (existingIdx >= 0) {
      const existing = dedupedPaid[existingIdx];
      const winner = (p.amountPaid || 0) >= (existing.amountPaid || 0) ? p : existing;
      const loser = winner === p ? existing : p;
      dedupedPaid[existingIdx] = winner;
      removedIds.add(loser.id);
      modified = true;
    } else {
      dedupedPaid.push(p);
    }
  }

  // Helper sets from paid records - indexed strictly per student so one student's payment never affects other students
  const paidLessonIdsByStudent = new Map<string, Set<string>>();
  const paidDateSignaturesByStudent = new Map<string, Set<string>>();

  dedupedPaid.forEach(p => {
    const stId = p.studentId;
    if (!stId) return;

    if (!paidLessonIdsByStudent.has(stId)) {
      paidLessonIdsByStudent.set(stId, new Set<string>());
    }
    const stIdsSet = paidLessonIdsByStudent.get(stId)!;
    if (p.lessonId) stIdsSet.add(p.lessonId);
    if (Array.isArray(p.lessonIds)) {
      p.lessonIds.forEach((id: string) => {
        if (!id.startsWith('virtual_')) stIdsSet.add(id);
      });
    }

    if (!paidDateSignaturesByStudent.has(stId)) {
      paidDateSignaturesByStudent.set(stId, new Set<string>());
    }
    const stDatesSet = paidDateSignaturesByStudent.get(stId)!;
    if (Array.isArray(p.lessonDates)) {
      p.lessonDates.forEach((dStr: string) => {
        const match = dStr?.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/);
        if (match) {
          const iso = normalizeDateToISO(match[1]);
          stDatesSet.add(`${stId}_${iso}`);
        }
      });
    }
  });

  // Filter and deduplicate pending payments against PAID records of the SAME STUDENT and against each other
  const dedupedPending: any[] = [];
  for (const p of pendingPayments) {
    const stId = p.studentId;
    const studentPaidLessonIds = stId ? paidLessonIdsByStudent.get(stId) : undefined;
    const studentPaidDateSignatures = stId ? paidDateSignaturesByStudent.get(stId) : undefined;

    // Check if this pending payment is ALREADY COVERED by any paid record OF THE SAME STUDENT
    const realLessonIds = (p.lessonIds || []).filter((id: string) => typeof id === 'string' && !id.startsWith('virtual_'));
    const isIdsCoveredByPaid = Boolean(
      studentPaidLessonIds && 
      studentPaidLessonIds instanceof Set &&
      studentPaidLessonIds.size > 0 &&
      realLessonIds.length > 0 && 
      realLessonIds.every((id: string) => Boolean(studentPaidLessonIds?.has(id)))
    );
    
    // Check if dates are covered by paid records OF THE SAME STUDENT
    let isDatesCoveredByPaid = false;
    if (studentPaidDateSignatures && studentPaidDateSignatures instanceof Set && studentPaidDateSignatures.size > 0 && Array.isArray(p.lessonDates) && p.lessonDates.length > 0) {
      const parsedDates: string[] = [];
      p.lessonDates.forEach((dStr: string) => {
        const match = dStr?.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/);
        if (match) parsedDates.push(normalizeDateToISO(match[1]));
      });
      if (parsedDates.length > 0 && parsedDates.every(dIso => Boolean(studentPaidDateSignatures?.has(`${stId}_${dIso}`)))) {
        isDatesCoveredByPaid = true;
      }
    }

    // Direct overlap with a paid payment of the EXACT SAME student
    const matchesPaidPayment = dedupedPaid.some(paid => {
      if (paid.studentId !== p.studentId) return false;
      if (realLessonIds.length > 0 && paid.lessonIds?.some((id: string) => realLessonIds.includes(id))) return true;
      if (p.lessonId && (paid.lessonId === p.lessonId || paid.lessonIds?.includes(p.lessonId))) return true;
      if (p.dueDate && paid.dueDate && p.dueDate === paid.dueDate && p.amountDue === paid.amountDue) return true;
      return false;
    });

    if (isIdsCoveredByPaid || isDatesCoveredByPaid || matchesPaidPayment) {
      // This pending payment is obsolete / already paid for THIS student!
      removedIds.add(p.id);
      modified = true;
      continue;
    }

    // Deduplicate pending payments against other pending payments
    const existingPendingIdx = dedupedPending.findIndex(c => {
      if (c.studentId !== p.studentId) return false;
      if (c.dueDate === p.dueDate && c.amountDue === p.amountDue) return true;
      if (Array.isArray(c.lessonIds) && Array.isArray(p.lessonIds) && c.lessonIds.length > 0 && p.lessonIds.length > 0) {
        if (c.lessonIds.some((lid: string) => p.lessonIds.includes(lid))) return true;
      }
      return false;
    });

    if (existingPendingIdx >= 0) {
      const existing = dedupedPending[existingPendingIdx];
      const winner = (p.amountPaid || 0) > (existing.amountPaid || 0) ? p : existing;
      const loser = winner === p ? existing : p;
      dedupedPending[existingPendingIdx] = winner;
      removedIds.add(loser.id);
      modified = true;
    } else {
      dedupedPending.push(p);
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

