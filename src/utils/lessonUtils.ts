import { Group, Lesson } from '../types';

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

  const isPerLesson = Boolean(
    group.paymentCycle === 'per_lesson' || 
    group.paymentModel === 'per_session' || 
    (group.sessionCount !== undefined && group.sessionCount <= 1)
  );

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

  const groupLessons = (lessons || []).filter(l => l.groupId === group.id && !l.deleted);

  const completedLessons = groupLessons
    .filter(l => l.status === 'completed')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  const inProgressLesson = groupLessons.find(l => l.status === 'in_progress');

  const upcomingScheduled = groupLessons
    .filter(l => l.status === 'scheduled')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  let currentSessionNumber = startingSessionNumber;

  if (inProgressLesson && inProgressLesson.sessionNumber && inProgressLesson.sessionNumber >= 1) {
    currentSessionNumber = ((inProgressLesson.sessionNumber - 1) % sessionCount) + 1;
  } else if (upcomingScheduled.length > 0 && upcomingScheduled[0].sessionNumber && upcomingScheduled[0].sessionNumber >= 1) {
    currentSessionNumber = ((upcomingScheduled[0].sessionNumber - 1) % sessionCount) + 1;
  } else if (completedLessons.length > 0) {
    const lastCompleted = completedLessons[completedLessons.length - 1];
    if (lastCompleted.sessionNumber && lastCompleted.sessionNumber >= 1) {
      const lastNum = ((lastCompleted.sessionNumber - 1) % sessionCount) + 1;
      currentSessionNumber = (lastNum % sessionCount) + 1;
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

  const score1 = statusScore(l1.status) + (l1.report ? 50 : 0) + ((l1.amountPaid || 0) > 0 ? 20 : 0);
  const score2 = statusScore(l2.status) + (l2.report ? 50 : 0) + ((l2.amountPaid || 0) > 0 ? 20 : 0);

  let survivor = score1 >= score2 ? { ...l1 } : { ...l2 };
  let duplicate = score1 >= score2 ? { ...l2 } : { ...l1 };

  // Merge valuable report data if survivor is missing it
  if (!survivor.report && duplicate.report) {
    survivor.report = duplicate.report;
  }
  if (!survivor.studentPayments && duplicate.studentPayments) {
    survivor.studentPayments = duplicate.studentPayments;
  }
  if ((duplicate.amountPaid || 0) > (survivor.amountPaid || 0)) {
    survivor.amountPaid = duplicate.amountPaid;
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
  const cleaned: any[] = [];
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

  // 2. Identify duplicate pending payments for the same student
  for (const p of mappedPayments) {
    if (!p || !p.id || p.deleted) continue;

    if (p.status !== 'paid') {
      // Look for an existing pending payment for this student with same cycle / date / amount
      const existingMatchIndex = cleaned.findIndex(c => {
        if (c.studentId !== p.studentId || c.status === 'paid') return false;
        // Same due date and same amount
        if (c.dueDate === p.dueDate && c.amountDue === p.amountDue) return true;
        // Or overlapping lesson IDs
        if (Array.isArray(c.lessonIds) && Array.isArray(p.lessonIds) && c.lessonIds.length > 0 && p.lessonIds.length > 0) {
          if (c.lessonIds.some((lid: string) => p.lessonIds.includes(lid))) return true;
        }
        return false;
      });

      if (existingMatchIndex >= 0) {
        // We found a duplicate pending payment record!
        const existing = cleaned[existingMatchIndex];
        // Keep the one with more information or higher amount paid
        const winner = (p.amountPaid || 0) > (existing.amountPaid || 0) ? p : existing;
        const loser = winner === p ? existing : p;
        cleaned[existingMatchIndex] = winner;
        removedIds.add(loser.id);
        modified = true;
        continue;
      }
    }

    cleaned.push(p);
  }

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

