import { Student, Group, Lesson, PaymentRecord, ScheduleRecurrence } from '../types';
import { areDuplicateLessons, isGroupPerLesson } from './lessonUtils';
import { resolveStudentWhatsAppContact } from './phoneUtils';
import { normalizeDateToISO, formatLocalDate, parseTimeForSort } from './timeUtils';
import { isDateMatchingGroupRecurrence } from './scheduleUtils';

export interface CyclePricingResult {
  cycleLength: number;
  amountDue: number;
  pricePerSession: number;
  isCustomOverride: boolean;
}

export interface DuePaymentCycle {
  id: string; // unique key
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  cycleLength: number; // e.g. 4
  amountDue: number; // e.g. 400
  lessonDates: string[];
  lessonIds: string[];
  status: 'due' | 'not_yet';
  parentPhone?: string;
  existingPaymentRecordId?: string;
}

const extractRealIdsFromPayment = (p: Partial<PaymentRecord>): string[] => {
  const ids: string[] = [];
  if (p.lessonId && !p.lessonId.startsWith('virtual_')) {
    ids.push(p.lessonId);
  }
  if (Array.isArray(p.lessonIds)) {
    for (const id of p.lessonIds) {
      if (id && !id.startsWith('virtual_') && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
};

const extractISODatesFromStrings = (dates?: string[]): string[] => {
  if (!Array.isArray(dates) || dates.length === 0) return [];
  const out: string[] = [];
  for (const dStr of dates) {
    if (!dStr || typeof dStr !== 'string') continue;
    const match = dStr.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/);
    if (match) {
      const iso = normalizeDateToISO(match[1]);
      if (iso) out.push(iso);
    }
  }
  return out;
};

export const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

/**
 * Computes realistic past calendar dates for earlier sessions in a package cycle.
 * Walks backwards from baseDate using scheduleDays if available, or 3-4 day / weekly intervals.
 */
export const calculateEstimatedPastDate = (
  baseDateStr: string,
  targetSessionNum: number,
  currentSessionNum: number,
  scheduleDays?: string[],
  scheduleRecurrence?: ScheduleRecurrence
): string => {
  if (targetSessionNum === currentSessionNum) {
    return baseDateStr;
  }
  
  const baseParts = (baseDateStr || '').split('-');
  const baseDate = baseParts.length === 3 
    ? new Date(parseInt(baseParts[0], 10), parseInt(baseParts[1], 10) - 1, parseInt(baseParts[2], 10))
    : new Date();

  const sessionsDiff = currentSessionNum - targetSessionNum;
  if (sessionsDiff <= 0) return baseDateStr;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const validScheduleDays = (scheduleDays || []).map(d => d.toLowerCase());

  if (validScheduleDays.length > 0) {
    let foundCount = 0;
    const cursor = new Date(baseDate.getTime());
    for (let dayOffset = 1; dayOffset <= 240; dayOffset++) {
      cursor.setDate(cursor.getDate() - 1);
      const dayName = dayNames[cursor.getDay()].toLowerCase();
      if (validScheduleDays.includes(dayName)) {
        if (scheduleRecurrence && scheduleRecurrence !== 'weekly' && !isDateMatchingGroupRecurrence(scheduleRecurrence, cursor)) {
          continue;
        }
        foundCount++;
        if (foundCount === sessionsDiff) {
          const y = cursor.getFullYear();
          const m = String(cursor.getMonth() + 1).padStart(2, '0');
          const d = String(cursor.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      }
    }
  }

  // Fallback: step backwards by ~3.5 days (or 7 days if biweekly)
  const isBiweekly = scheduleRecurrence && scheduleRecurrence !== 'weekly';
  const daysToSubtract = Math.max(1, Math.round(sessionsDiff * (isBiweekly ? 7 : 3.5)));
  const targetDate = new Date(baseDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Sanitizes an array of lesson date strings so any placeholder ("Offline", "حصة سابقة")
 * is replaced with a real estimated past date.
 */
export const sanitizePaymentLessonDates = (
  lessonDates: string[] | undefined,
  baseDateStr: string,
  bundleSize: number,
  scheduleDays?: string[],
  scheduleRecurrence?: ScheduleRecurrence
): string[] => {
  if (!lessonDates || lessonDates.length === 0) return [];
  return lessonDates.map(item => {
    if (/\d{2}\/\d{2}\/\d{4}/.test(item)) {
      return item;
    }
    const match = item.match(/Session (\d+)\/(\d+)/i);
    if (match) {
      const sessNum = parseInt(match[1], 10);
      const totalSess = bundleSize || parseInt(match[2], 10) || 1;
      const pastDate = calculateEstimatedPastDate(baseDateStr, sessNum, totalSess, scheduleDays, scheduleRecurrence);
      return `${formatDateDisplay(pastDate)} (Session ${sessNum}/${totalSess})`;
    }
    return item;
  });
};

export const calculateDuePaymentCycles = (
  students: Student[],
  groups: Group[],
  lessons: Lesson[],
  payments: PaymentRecord[]
): DuePaymentCycle[] => {
  const list: DuePaymentCycle[] = [];

  const activeStudents = students.filter(s => !s.deleted && s.status !== 'archived');
  const activeGroups = groups.filter(g => !g.deleted && g.status !== 'archived');
  const activeLessons = lessons.filter(l => !l.deleted);
  const activePayments = payments.filter(p => !p.deleted);

  // Pre-index groups by ID and normalized name for O(1) lookup
  const activeGroupsById = new Map<string, Group>();
  const activeGroupsByLowerName = new Map<string, Group>();
  for (const g of activeGroups) {
    activeGroupsById.set(g.id, g);
    if (g.name) activeGroupsByLowerName.set(g.name.trim().toLowerCase(), g);
  }
  const allGroupsById = new Map<string, Group>();
  const allGroupsByLowerName = new Map<string, Group>();
  for (const g of groups) {
    allGroupsById.set(g.id, g);
    if (g.name) allGroupsByLowerName.set(g.name.trim().toLowerCase(), g);
  }
  const findGroupFast = (groupId?: string, groupName?: string, preferActive = false): Group | undefined => {
    const idMap = preferActive ? activeGroupsById : allGroupsById;
    const nameMap = preferActive ? activeGroupsByLowerName : allGroupsByLowerName;
    if (groupId) {
      const byId = idMap.get(groupId);
      if (byId) return byId;
      const byNorm = nameMap.get(groupId.trim().toLowerCase());
      if (byNorm) return byNorm;
    }
    if (groupName) {
      const byGName = nameMap.get(groupName.trim().toLowerCase());
      if (byGName) return byGName;
    }
    return undefined;
  };

  // Pre-index active students by ID and name (for private lessons missing studentId)
  const studentById = new Map<string, Student>();
  for (const st of activeStudents) {
    studentById.set(st.id, st);
  }

  // Pre-index active lessons once in O(L)
  const activeLessonsById = new Map<string, Lesson>();
  const activeLessonsByDate = new Map<string, Lesson[]>();
  const activeLessonsByGroupId = new Map<string, Lesson[]>();
  const activeLessonsByStudentId = new Map<string, Lesson[]>();
  const activeLessonsByStudentName = new Map<string, Lesson[]>();
  const explicitAttendedByStudentId = new Map<string, Lesson[]>();
  const studentPaidLessons = new Map<string, Set<string>>();

  const addLessonToMap = (map: Map<string, Lesson[]>, key: string, lesson: Lesson) => {
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(lesson);
  };

  const addPaidLessonForStudent = (stId: string, lessonId: string) => {
    let set = studentPaidLessons.get(stId);
    if (!set) {
      set = new Set<string>();
      studentPaidLessons.set(stId, set);
    }
    set.add(lessonId);
  };

  for (const l of activeLessons) {
    activeLessonsById.set(l.id, l);
    const dIso = normalizeDateToISO(l.date);
    if (dIso) addLessonToMap(activeLessonsByDate, dIso, l);
    if (l.groupId) addLessonToMap(activeLessonsByGroupId, l.groupId, l);
    if (l.studentId) {
      addLessonToMap(activeLessonsByStudentId, l.studentId, l);
    } else if (l.studentName) {
      addLessonToMap(activeLessonsByStudentName, l.studentName, l);
    }

    // Track explicit attendance/payment links per student (essential after student moves between groups)
    if (l.status === 'completed' && l.paymentStatus !== 'exempted') {
      const repAtt = l.report?.studentAttendance;
      if (repAtt && typeof repAtt === 'object') {
        for (const [stId, attStatus] of Object.entries(repAtt)) {
          if (attStatus && attStatus !== 'absent') {
            addLessonToMap(explicitAttendedByStudentId, stId, l);
          }
        }
      }
      if (l.studentPayments && typeof l.studentPayments === 'object') {
        for (const [stId, sp] of Object.entries(l.studentPayments)) {
          if (sp && (sp.paymentStatus === 'paid' || (sp as any).status === 'paid')) {
            addPaidLessonForStudent(stId, l.id);
          } else if (sp) {
            addLessonToMap(explicitAttendedByStudentId, stId, l);
          }
        }
      }
      if (l.report?.studentPayments && typeof l.report.studentPayments === 'object') {
        for (const [stId, sp] of Object.entries(l.report.studentPayments)) {
          if (sp && ((sp as any).paymentStatus === 'paid' || (sp as any).status === 'paid')) {
            addPaidLessonForStudent(stId, l.id);
          } else if (sp) {
            addLessonToMap(explicitAttendedByStudentId, stId, l);
          }
        }
      }
    }

    // Direct 1-on-1 private lesson marked paid
    if (!l.groupId && (l.paymentStatus === 'paid' || l.report?.paymentStatus === 'paid') && l.studentId) {
      addPaidLessonForStudent(l.studentId, l.id);
    }
  }

  // Pre-index payments by student and build paid lesson sets & legacy paid date signatures
  const activePaymentsByStudentId = new Map<string, PaymentRecord[]>();
  const studentLegacyPaidDates = new Map<string, Set<string>>();

  for (const p of activePayments) {
    if (p.studentId) {
      let arr = activePaymentsByStudentId.get(p.studentId);
      if (!arr) {
        arr = [];
        activePaymentsByStudentId.set(p.studentId, arr);
      }
      arr.push(p);
    }

    if (p.status === 'paid' || p.status === 'exempted' || p.paymentType === 'exemption') {
      const realIds = extractRealIdsFromPayment(p);
      const stId = p.studentId;
      if (realIds.length > 0 && stId) {
        for (const id of realIds) {
          addPaidLessonForStudent(stId, id);
        }
      } else if (stId && Array.isArray(p.lessonDates) && p.lessonDates.length > 0) {
        // Legacy fallback ONLY when payment record lacks non-virtual lessonIds
        const isoDates = extractISODatesFromStrings(p.lessonDates);
        let legacySet = studentLegacyPaidDates.get(stId);
        if (!legacySet) {
          legacySet = new Set<string>();
          studentLegacyPaidDates.set(stId, legacySet);
        }
        for (const dIso of isoDates) {
          legacySet.add(`${dIso}::${p.groupId || ''}`);
          legacySet.add(`${dIso}::`);
          const sameDayLessons = activeLessonsByDate.get(dIso) || [];
          for (const ml of sameDayLessons) {
            const matchesRecStudent = ml.studentId === stId || (!ml.studentId && ml.studentName === p.studentName);
            const matchesRecGroup = p.groupId && ml.groupId === p.groupId;
            if (matchesRecStudent || matchesRecGroup) {
              addPaidLessonForStudent(stId, ml.id);
            }
          }
        }
      }
    }
  }

  const matchedPendingRecordIds = new Set<string>();

  for (const st of activeStudents) {
    const grp = findGroupFast(st.groupId, undefined, true) || findGroupFast(st.groupId, undefined, false);
    const { cycleLength, amountDue } = getStudentCyclePricing(st, grp);
    const paidIds = studentPaidLessons.get(st.id) || new Set<string>();
    const legacyPaidDates = studentLegacyPaidDates.get(st.id);
    const stPayments = activePaymentsByStudentId.get(st.id) || [];

    // Collect unpaid/pending records for this student, filtering out genuinely settled ones
    const studentUnpaidRecs: PaymentRecord[] = [];
    for (const p of stPayments) {
      if (p.status === 'paid' || p.status === 'exempted' || p.paymentType === 'exemption' || p.paymentType === 'advance_payment') {
        continue;
      }
      const uLessonIds = extractRealIdsFromPayment(p);
      let isCandidateCovered = false;
      if (uLessonIds.length > 0) {
        isCandidateCovered = uLessonIds.every(id => paidIds.has(id));
      } else if (legacyPaidDates && Array.isArray(p.lessonDates) && p.lessonDates.length > 0) {
        const uDates = extractISODatesFromStrings(p.lessonDates);
        if (
          uDates.length > 0 &&
          uDates.every(dIso => legacyPaidDates.has(`${dIso}::${p.groupId || ''}`) || (!p.groupId && legacyPaidDates.has(`${dIso}::`)))
        ) {
          isCandidateCovered = true;
        }
      }
      if (!isCandidateCovered) {
        studentUnpaidRecs.push(p);
      }
    }

    // Gather candidate completed lessons using pre-indexed buckets (O(1) per student)
    const candidateLessonsMap = new Map<string, Lesson>();
    const addCandidate = (l: Lesson) => {
      if (!candidateLessonsMap.has(l.id)) candidateLessonsMap.set(l.id, l);
    };

    if (grp) {
      for (const l of activeLessonsByGroupId.get(grp.id) || []) addCandidate(l);
    }
    // Include historical groups the student moved out of (Group #7)
    const stExt = st as Student & { previousGroupIds?: string[]; groupHistory?: { groupId: string; leftDate?: string }[] };
    const historicalGroupLeftDate = new Map<string, string>();
    if (Array.isArray(stExt.groupHistory)) {
      for (const entry of stExt.groupHistory) {
        if (entry?.groupId && entry.groupId !== grp?.id) {
          historicalGroupLeftDate.set(entry.groupId, entry.leftDate || '');
          for (const l of activeLessonsByGroupId.get(entry.groupId) || []) addCandidate(l);
        }
      }
    }
    if (Array.isArray(stExt.previousGroupIds)) {
      for (const prevGid of stExt.previousGroupIds) {
        if (prevGid && prevGid !== grp?.id) {
          for (const l of activeLessonsByGroupId.get(prevGid) || []) addCandidate(l);
        }
      }
    }
    for (const l of activeLessonsByStudentId.get(st.id) || []) addCandidate(l);
    if (st.name) {
      for (const l of activeLessonsByStudentName.get(st.name) || []) addCandidate(l);
    }
    for (const l of explicitAttendedByStudentId.get(st.id) || []) addCandidate(l);
    for (const up of studentUnpaidRecs) {
      for (const lid of extractRealIdsFromPayment(up)) {
        const l = activeLessonsById.get(lid);
        if (l) addCandidate(l);
      }
    }

    const rawCompletedLessons: Lesson[] = [];
    candidateLessonsMap.forEach(l => {
      if (l.status !== 'completed') return;
      if (l.paymentStatus === 'exempted') return;
      if (paidIds.has(l.id)) return;

      const isCurrentGroup = Boolean(grp && l.groupId === grp.id);
      const isDirectStudent = l.studentId ? l.studentId === st.id : (!l.groupId && !!l.studentName && l.studentName === st.name);
      const hasExplicitStudentAttendance = Boolean(l.report?.studentAttendance && Object.prototype.hasOwnProperty.call(l.report.studentAttendance, st.id));
      const explicitAttVal = hasExplicitStudentAttendance ? l.report!.studentAttendance![st.id] : undefined;
      const isHistoricalAttendedGroupLesson = Boolean(
        l.groupId &&
        !isCurrentGroup &&
        (
          (hasExplicitStudentAttendance && explicitAttVal !== 'absent') ||
          Boolean(l.studentPayments?.[st.id]) ||
          Boolean(l.report?.studentPayments?.[st.id]) ||
          (historicalGroupLeftDate.has(l.groupId) && (!historicalGroupLeftDate.get(l.groupId) || normalizeDateToISO(l.date) <= historicalGroupLeftDate.get(l.groupId)!)) ||
          (Array.isArray(stExt.previousGroupIds) && stExt.previousGroupIds.includes(l.groupId))
        )
      );

      if (!isCurrentGroup && !isDirectStudent && !isHistoricalAttendedGroupLesson) return;

      const att = explicitAttVal || l.report?.attendanceStatus || 'present';
      if (att === 'absent') return;

      const stPaymentObj = l.studentPayments?.[st.id];
      const repPaymentObj = l.report?.studentPayments?.[st.id] as any;
      const isStudentPaidInLesson =
        (stPaymentObj?.paymentStatus === 'paid' || (stPaymentObj as any)?.status === 'paid') ||
        (repPaymentObj?.paymentStatus === 'paid' || repPaymentObj?.status === 'paid');
      const isPrivateLessonForStudent = !l.groupId && Boolean(l.studentId && l.studentId === st.id);
      const isPrivateLessonPaid = isPrivateLessonForStudent && (l.paymentStatus === 'paid' || l.report?.paymentStatus === 'paid');

      if (isStudentPaidInLesson || isPrivateLessonPaid) return;

      rawCompletedLessons.push(l);
    });

    // Finance #8: Deduplicate strictly by canonical lesson ID and real (date, time) overlap,
    // NEVER collapsing distinct same-day lessons merely by sessionNumber coincidence.
    const stCompletedLessons: Lesson[] = [];
    const seenLessonIds = new Set<string>();
    rawCompletedLessons.forEach(l => {
      if (seenLessonIds.has(l.id)) return;
      const lDateIso = normalizeDateToISO(l.date);
      const lTime = (l.time || '').trim();
      const isDupe = stCompletedLessons.some(existing =>
        areDuplicateLessons(existing, l) ||
        (
          Boolean(lDateIso) &&
          normalizeDateToISO(existing.date) === lDateIso &&
          Boolean(lTime) &&
          Boolean((existing.time || '').trim()) &&
          (existing.time || '').trim() === lTime
        )
      );
      if (!isDupe) {
        seenLessonIds.add(l.id);
        stCompletedLessons.push(l);
      }
    });

    // Finance #9: Chronological ordering by local date, then time of day, then deterministic ID tie-breaker
    stCompletedLessons.sort((a, b) => {
      const da = normalizeDateToISO(a.date);
      const db = normalizeDateToISO(b.date);
      if (da !== db) return da.localeCompare(db);
      const ta = parseTimeForSort(a.time);
      const tb = parseTimeForSort(b.time);
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

    // Handle advance prepaid lessons
    const advancePayments = stPayments.filter(p =>
      p.status === 'paid' &&
      (p.paymentType === 'advance_payment' || (p.bundleSize && p.bundleSize > 0 && p.notes?.includes('مقدم')))
    );
    const totalAdvanceLessonsCount = advancePayments.reduce((sum, p) => sum + (p.bundleSize || 0), 0);
    const explicitlyLinkedCount = advancePayments.reduce((sum, p) => sum + (p.lessonIds ? p.lessonIds.filter(id => !id.startsWith('virtual_')).length : 0), 0);
    const unlinkedAdvanceLessons = Math.max(0, totalAdvanceLessonsCount - explicitlyLinkedCount);

    const billableCompletedLessons = unlinkedAdvanceLessons > 0
      ? stCompletedLessons.slice(unlinkedAdvanceLessons)
      : stCompletedLessons;

    const hasPaidPayments = stPayments.some(p => p.status === 'paid');
    const startSess = grp?.startingSessionNumber || 1;
    const virtualOffset = !hasPaidPayments && startSess > 1 && cycleLength > 1 ? (startSess - 1) : 0;

    interface ProcessedLesson {
      id: string;
      dateIso: string;
      timeMin: number;
      dateLabel: string;
      isVirtual: boolean;
    }

    const processedLessons: ProcessedLesson[] = [];
    const latestLessonDate = billableCompletedLessons[billableCompletedLessons.length - 1]?.date || formatLocalDate();
    const maxCompletedSessionNum = Math.max(0, ...billableCompletedLessons.map(l => l.sessionNumber || 0));
    const anchorSessionNum = maxCompletedSessionNum > 0 ? maxCompletedSessionNum : cycleLength;

    const findGroupOrStudentLessonBySession = (sessNum: number): Lesson | undefined => {
      if (st.groupId) {
        const gMatch = (activeLessonsByGroupId.get(st.groupId) || []).find(l => l.sessionNumber === sessNum);
        if (gMatch) return gMatch;
      }
      return (activeLessonsByStudentId.get(st.id) || []).find(l => l.sessionNumber === sessNum);
    };

    for (let i = 1; i <= virtualOffset; i++) {
      const matched = findGroupOrStudentLessonBySession(i);
      const pastDate = matched?.date || calculateEstimatedPastDate(latestLessonDate, i, anchorSessionNum, grp?.scheduleDays, st.scheduleRecurrence || grp?.scheduleRecurrence);
      const dLabel = `${formatDateDisplay(pastDate)} (Session ${i}/${cycleLength})`;
      processedLessons.push({
        id: matched ? matched.id : `virtual_${st.id}_sess_${i}`,
        dateIso: normalizeDateToISO(pastDate),
        timeMin: matched ? parseTimeForSort(matched.time) : 0,
        dateLabel: dLabel,
        isVirtual: !matched
      });
    }

    billableCompletedLessons.forEach(l => {
      processedLessons.push({
        id: l.id,
        dateIso: normalizeDateToISO(l.date),
        timeMin: parseTimeForSort(l.time),
        dateLabel: `${formatDateDisplay(l.date)} (Session ${l.sessionNumber || 1}/${cycleLength})`,
        isVirtual: false
      });
    });

    const reachedCycleBySessionNum = maxCompletedSessionNum > 0 && cycleLength > 1 && (maxCompletedSessionNum >= cycleLength || maxCompletedSessionNum % cycleLength === 0);

    if (reachedCycleBySessionNum && processedLessons.length < cycleLength) {
      const existingSessionNums = new Set<number>();
      processedLessons.forEach(pl => {
        const match = pl.dateLabel.match(/Session (\d+)\//);
        if (match) existingSessionNums.add(parseInt(match[1], 10));
      });
      const cycleStart = Math.floor((maxCompletedSessionNum - 1) / cycleLength) * cycleLength + 1;
      const cycleEnd = cycleStart + cycleLength - 1;
      for (let s = cycleStart; s <= cycleEnd; s++) {
        if (!existingSessionNums.has(s)) {
          const matched = findGroupOrStudentLessonBySession(s);
          const pastDate = matched?.date || calculateEstimatedPastDate(latestLessonDate, s, anchorSessionNum, grp?.scheduleDays, st.scheduleRecurrence || grp?.scheduleRecurrence);
          const dLabel = `${formatDateDisplay(pastDate)} (Session ${s}/${cycleLength})`;
          processedLessons.push({
            id: matched ? matched.id : `virtual_${st.id}_sess_${s}`,
            dateIso: normalizeDateToISO(pastDate),
            timeMin: matched ? parseTimeForSort(matched.time) : 0,
            dateLabel: dLabel,
            isVirtual: !matched
          });
        }
      }
      processedLessons.sort((a, b) => {
        const na = parseInt(a.dateLabel.match(/Session (\d+)\//)?.[1] || '0', 10);
        const nb = parseInt(b.dateLabel.match(/Session (\d+)\//)?.[1] || '0', 10);
        if (na !== nb) return na - nb;
        if (a.dateIso !== b.dateIso) return a.dateIso.localeCompare(b.dateIso);
        if (a.timeMin !== b.timeMin) return a.timeMin - b.timeMin;
        return a.id.localeCompare(b.id);
      });
    }

    const matchUnpaidRecordForChunk = (chunkLessonIds: string[], allowLegacyUnlinked: boolean): PaymentRecord | undefined => {
      if (chunkLessonIds.length > 0) {
        const idSet = new Set(chunkLessonIds);
        const byId = studentUnpaidRecs.find(rec =>
          !matchedPendingRecordIds.has(rec.id) &&
          extractRealIdsFromPayment(rec).some(rid => idSet.has(rid))
        );
        if (byId) return byId;
      }
      if (allowLegacyUnlinked) {
        return studentUnpaidRecs.find(rec =>
          !matchedPendingRecordIds.has(rec.id) &&
          extractRealIdsFromPayment(rec).length === 0
        );
      }
      return undefined;
    };

    if (processedLessons.length >= cycleLength) {
      let remaining = [...processedLessons];
      let chunkIndex = 0;

      while (remaining.length >= cycleLength) {
        const currentChunk = remaining.slice(0, cycleLength);
        const lessonDates = currentChunk.map(cl => cl.dateLabel);
        const lessonIds = currentChunk.filter(cl => !cl.isVirtual).map(cl => cl.id);
        const matchedUnpaid = matchUnpaidRecordForChunk(lessonIds, chunkIndex === 0);

        const actualCount = currentChunk.filter(cl => !cl.isVirtual).length;
        if (actualCount > 0 || matchedUnpaid) {
          if (matchedUnpaid) matchedPendingRecordIds.add(matchedUnpaid.id);
          const pricePerSession = amountDue / cycleLength;
          const adjustedAmountDue = matchedUnpaid && matchedUnpaid.amountDue > 0
            ? matchedUnpaid.amountDue
            : (chunkIndex === 0 && virtualOffset > 0)
              ? Math.round(pricePerSession * actualCount)
              : amountDue;

          const firstRealId = currentChunk.find(cl => !cl.isVirtual)?.id || currentChunk[0]?.id || `c${chunkIndex}`;
          list.push({
            id: matchedUnpaid?.id || `due_cycle_${st.id}_${firstRealId}_chunk_${chunkIndex}`,
            studentId: st.id,
            studentName: st.name,
            groupId: st.groupId || grp?.id || '',
            groupName: grp?.name || matchedUnpaid?.groupName || 'Gruppe',
            cycleLength,
            amountDue: adjustedAmountDue,
            lessonDates,
            lessonIds,
            status: matchedUnpaid ? 'not_yet' : 'due',
            parentPhone: resolveStudentWhatsAppContact(st).contact || '',
            existingPaymentRecordId: matchedUnpaid?.id
          });
        }

        remaining = remaining.slice(cycleLength);
        chunkIndex++;
      }
    } else if (studentUnpaidRecs.length > 0 && unlinkedAdvanceLessons === 0 && stCompletedLessons.length > 0) {
      const unpaidRec = studentUnpaidRecs[0];
      const lessonDates = (unpaidRec.lessonDates || []).map((d, idx) => {
        if (d.includes('Session')) return d;
        return `${d} (Session ${idx + 1}/${unpaidRec.bundleSize || cycleLength})`;
      });

      const recStatusStr = String(unpaidRec.status || '');
      const isExplicitlyDue = recStatusStr === 'due' || recStatusStr === 'overdue';
      const isFullCycleCompleted = cycleLength === 1 || stCompletedLessons.length >= cycleLength || maxCompletedSessionNum >= cycleLength;

      if (isExplicitlyDue || isFullCycleCompleted) {
        matchedPendingRecordIds.add(unpaidRec.id);
        list.push({
          id: unpaidRec.id,
          studentId: st.id,
          studentName: st.name,
          groupId: st.groupId || grp?.id || '',
          groupName: grp?.name || unpaidRec.groupName || 'Gruppe',
          cycleLength: unpaidRec.bundleSize || cycleLength,
          amountDue: unpaidRec.amountDue || amountDue,
          lessonDates,
          lessonIds: unpaidRec.lessonIds || [],
          status: isExplicitlyDue ? 'due' : 'not_yet',
          parentPhone: resolveStudentWhatsAppContact(st).contact || '',
          existingPaymentRecordId: unpaidRec.id
        });
      }
    }
  }

  // Also include standalone unpaid payment records from payments table (excluding paid/exempted/settled)
  const addedPaymentRecordIds = new Set<string>(matchedPendingRecordIds);
  for (const item of list) {
    if (item.existingPaymentRecordId) addedPaymentRecordIds.add(item.existingPaymentRecordId);
  }

  for (const p of activePayments) {
    if (
      p.status === 'paid' ||
      p.status === 'exempted' ||
      p.paymentType === 'exemption' ||
      p.paymentType === 'advance_payment' ||
      addedPaymentRecordIds.has(p.id)
    ) {
      continue;
    }

    const pLessonIds = extractRealIdsFromPayment(p);
    const paidSet = p.studentId ? studentPaidLessons.get(p.studentId) : undefined;
    const isIdsCovered = Boolean(pLessonIds.length > 0 && paidSet && pLessonIds.every(id => paidSet.has(id)));
    if (isIdsCovered) continue;

    // Legacy coverage fallback ONLY when record lacks real lessonIds; NEVER collapse by bare (dueDate, amountDue)
    if (pLessonIds.length === 0 && p.studentId) {
      const legacyDates = studentLegacyPaidDates.get(p.studentId);
      const pIsoDates = extractISODatesFromStrings(p.lessonDates);
      if (
        legacyDates &&
        pIsoDates.length > 0 &&
        pIsoDates.every(dIso => legacyDates.has(`${dIso}::${p.groupId || ''}`) || (!p.groupId && legacyDates.has(`${dIso}::`)))
      ) {
        continue;
      }
    }

    const st = p.studentId ? studentById.get(p.studentId) || students.find(s => s.id === p.studentId) : undefined;
    const grp = findGroupFast(p.groupId || st?.groupId, p.groupName, false);
    const isGrpPerLesson = grp ? isGroupPerLesson(grp) : false;
    const pricing = st ? getStudentCyclePricing(st, grp) : null;
    const effectiveCycleLength = p.bundleSize && p.bundleSize > 0
      ? p.bundleSize
      : (isGrpPerLesson ? 1 : (pricing ? pricing.cycleLength : 1));
    const effectiveAmountDue = p.amountDue && p.amountDue > 0
      ? p.amountDue
      : (pricing ? pricing.amountDue : (isGrpPerLesson && grp?.pricePerSession ? grp.pricePerSession : 0));

    const lastDateStr = (p.lessonDates && p.lessonDates.length > 0) ? p.lessonDates[p.lessonDates.length - 1] : '';
    const sessionMatch = lastDateStr ? lastDateStr.match(/Session (\d+)\//) : null;
    const sessNum = sessionMatch ? parseInt(sessionMatch[1], 10) : (p.lessonDates?.length || 0);
    const isFullCycleCompleted = effectiveCycleLength === 1 || sessNum >= effectiveCycleLength || (p.lessonDates?.length || 0) >= effectiveCycleLength;
    const pStatusStr = String(p.status || '');
    const isExplicitlyDue = pStatusStr === 'due' || pStatusStr === 'overdue' || pStatusStr === 'partial';

    if (!isFullCycleCompleted && !isExplicitlyDue) {
      continue;
    }

    const sanitizedLessonDates = (p.lessonDates || []).map(d => {
      if (effectiveCycleLength === 1) {
        return d.replace(/Session (\d+)\/(\d+)/g, 'Session 1/1');
      }
      return d.replace(/Session (\d+)\/(\d+)/g, `Session $1/${effectiveCycleLength}`);
    });

    list.push({
      id: p.id,
      studentId: p.studentId || '',
      studentName: p.studentName || st?.name || 'Schüler',
      groupId: p.groupId || grp?.id || '',
      groupName: p.groupName || grp?.name || 'Gruppe',
      cycleLength: effectiveCycleLength,
      amountDue: effectiveAmountDue,
      lessonDates: sanitizedLessonDates,
      lessonIds: p.lessonIds || [],
      status: 'not_yet',
      parentPhone: st ? resolveStudentWhatsAppContact(st).contact : '',
      existingPaymentRecordId: p.id
    });
  }

  // Finance #2 & #3: Deduplicate pending cycles strictly by sorted non-virtual lesson IDs
  // (with safe per-record fallback for legacy records lacking lesson IDs).
  const uniqueList: DuePaymentCycle[] = [];
  const seenCycleSignatures = new Set<string>();

  for (const cycle of list) {
    const realIds = (cycle.lessonIds || [])
      .filter(id => Boolean(id) && !id.startsWith('virtual_'))
      .slice()
      .sort();

    let sig: string;
    if (realIds.length > 0) {
      sig = `ids::${cycle.studentId}::${realIds.join('|')}`;
    } else {
      const legacyKey = cycle.existingPaymentRecordId || cycle.id;
      const datesSig = (cycle.lessonDates || []).slice().sort().join('|');
      sig = `legacy::${cycle.studentId}::${legacyKey}::${datesSig}::${cycle.amountDue}`;
    }

    if (!seenCycleSignatures.has(sig)) {
      seenCycleSignatures.add(sig);
      uniqueList.push(cycle);
    }
  }

  return uniqueList;
};

/**
 * Single Source of Truth for Student & Group Payment Calculation.
 */
export const getStudentCyclePricing = (
  student: Student,
  group?: Group
): CyclePricingResult => {
  const isGroupPerLessonFlag = group ? isGroupPerLesson(group) : false;
  const isStudentExplicitPerLesson = student.paymentPlan === 'per_lesson' || student.bundleSize === 1;

  if (group) {
    const hasExplicitStudentCustomOverride =
      student.paymentPlan === 'custom_bundle' &&
      student.customBundlePrice !== undefined &&
      student.customBundlePrice !== null &&
      student.customBundlePrice > 0;

    if (hasExplicitStudentCustomOverride) {
      const cycleLength = student.bundleSize || group.sessionCount || 4;
      const amountDue = student.customBundlePrice!;
      const pricePerSession = Math.round(amountDue / (cycleLength || 1));
      return { cycleLength, amountDue, pricePerSession, isCustomOverride: true };
    }

    if (isGroupPerLessonFlag || isStudentExplicitPerLesson) {
      const cycleLength = 1;
      const pricePerSession = group.pricePerSession || (group.monthlyPackagePrice && group.sessionCount && group.sessionCount > 1 ? Math.round(group.monthlyPackagePrice / group.sessionCount) : (group.monthlyPackagePrice || student.pricePerLesson || 300));
      const amountDue = pricePerSession;
      return { cycleLength, amountDue, pricePerSession, isCustomOverride: false };
    } else {
      const cycleLength = Math.max(2, group.sessionCount || 4);
      const amountDue = group.monthlyPackagePrice || (group.pricePerSession ? group.pricePerSession * cycleLength : 2400);
      const pricePerSession = Math.round(amountDue / (cycleLength || 1));
      return { cycleLength, amountDue, pricePerSession, isCustomOverride: false };
    }
  }

  // 2. Individual student without group assignment
  if (
    student.paymentPlan === 'per_lesson' ||
    student.bundleSize === 1 ||
    (student.groupId && (student.groupId.includes('بالحصة') || student.groupId.toLowerCase().includes('per_lesson'))) ||
    (student.name && (student.name.includes('بالحصة') || student.name.toLowerCase().includes('per_lesson'))) ||
    (student.notes && (student.notes.includes('بالحصة') || student.notes.toLowerCase().includes('per_lesson')))
  ) {
    const cycleLength = 1;
    const pricePerSession = student.pricePerLesson || 300;
    const amountDue = pricePerSession;
    return { cycleLength, amountDue, pricePerSession, isCustomOverride: true };
  }

  const hasExplicitCustomBundle = student.paymentPlan === 'custom_bundle' ||
                                  (student.customBundlePrice !== undefined && student.customBundlePrice !== null && student.customBundlePrice > 0);

  if (hasExplicitCustomBundle) {
    const cycleLength = student.bundleSize || 4;
    const amountDue = student.customBundlePrice || (student.pricePerLesson ? student.pricePerLesson * cycleLength : 2400);
    const pricePerSession = Math.round(amountDue / (cycleLength || 1));
    return { cycleLength, amountDue, pricePerSession, isCustomOverride: true };
  }

  // Individual student fallback
  const plan = student.paymentPlan || (student.bundleSize === 8 ? '8_lessons' : student.bundleSize === 12 ? '12_lessons' : '4_lessons');
  const isPerLesson = (plan as string) === 'per_lesson';
  const cycleLength = isPerLesson ? 1 : (student.bundleSize || (
    plan === '4_lessons' ? 4 :
    plan === '8_lessons' ? 8 :
    plan === '12_lessons' ? 12 : 4
  ));
  const pricePerSession = student.pricePerLesson || 300;
  const amountDue = isPerLesson ? pricePerSession : (
    student.customBundlePrice !== undefined && student.customBundlePrice !== null && student.customBundlePrice > 0
      ? student.customBundlePrice
      : pricePerSession * cycleLength
  );

  return { cycleLength, amountDue, pricePerSession, isCustomOverride: false };
};

/**
 * Calculates prepaid/advance lesson credits for a student.
 */
export const getStudentAdvanceLessonCredits = (
  studentId: string,
  payments: PaymentRecord[],
  lessons: Lesson[],
  studentName?: string
): { totalAdvanceLessons: number; usedLessons: number; remainingAdvanceLessons: number } => {
  const activePayments = payments.filter(p =>
    !p.deleted &&
    (p.studentId === studentId || (!p.studentId && !!studentName && p.studentName === studentName)) &&
    p.status === 'paid'
  );
  const advancePayments = activePayments.filter(p =>
    p.paymentType === 'advance_payment' || (p.bundleSize && p.bundleSize > 0 && p.notes?.includes('مقدم'))
  );

  const totalAdvanceLessons = advancePayments.reduce((sum, p) => sum + (p.bundleSize || 0), 0);
  if (totalAdvanceLessons <= 0) {
    return { totalAdvanceLessons: 0, usedLessons: 0, remainingAdvanceLessons: 0 };
  }

  const earliestAdvancePayment = advancePayments.reduce((earliest, p) => {
    const pDate = p.paidDate || p.createdAt || '';
    if (!earliest || (pDate && pDate < earliest)) return pDate;
    return earliest;
  }, '');

  const completedLessons = lessons.filter(l => {
    if (l.deleted) return false;
    if (l.status !== 'completed') return false;
    if (l.paymentStatus === 'exempted') return false;
    const matchesStudent = l.studentId === studentId || (!l.studentId && !!studentName && l.studentName === studentName);
    if (!matchesStudent) return false;
    const att = l.report?.studentAttendance?.[studentId] || l.report?.attendanceStatus || 'present';
    if (att === 'absent') return false;
    if (earliestAdvancePayment && l.date && normalizeDateToISO(l.date) < normalizeDateToISO(earliestAdvancePayment)) {
      return false;
    }
    return true;
  });

  const usedLessons = Math.min(totalAdvanceLessons, completedLessons.length);
  const remainingAdvanceLessons = Math.max(0, totalAdvanceLessons - usedLessons);

  return { totalAdvanceLessons, usedLessons, remainingAdvanceLessons };
};

/**
 * Batch O(P + L) computation of advance lesson credits across all students.
 */
export const computeStudentAdvanceCreditsMap = (
  payments: PaymentRecord[],
  lessons: Lesson[]
): Map<string, { totalAdvanceLessons: number; usedLessons: number; remainingAdvanceLessons: number }> => {
  const advByStudent = new Map<string, PaymentRecord[]>();
  for (const p of payments) {
    if (p.deleted || !p.studentId || p.status !== 'paid') continue;
    if (p.paymentType === 'advance_payment' || (p.bundleSize && p.bundleSize > 0 && p.notes?.includes('مقدم'))) {
      let arr = advByStudent.get(p.studentId);
      if (!arr) {
        arr = [];
        advByStudent.set(p.studentId, arr);
      }
      arr.push(p);
    }
  }

  const result = new Map<string, { totalAdvanceLessons: number; usedLessons: number; remainingAdvanceLessons: number }>();
  if (advByStudent.size === 0) return result;

  const earliestByStudent = new Map<string, string>();
  const totalByStudent = new Map<string, number>();
  advByStudent.forEach((recs, stId) => {
    let total = 0;
    let earliest = '';
    for (const p of recs) {
      total += p.bundleSize || 0;
      const pDate = p.paidDate || p.createdAt || '';
      if (!earliest || (pDate && pDate < earliest)) earliest = pDate;
    }
    if (total > 0) {
      totalByStudent.set(stId, total);
      earliestByStudent.set(stId, earliest ? normalizeDateToISO(earliest) : '');
    }
  });

  const usedCountByStudent = new Map<string, number>();
  for (const l of lessons) {
    if (l.deleted || l.status !== 'completed' || l.paymentStatus === 'exempted' || !l.studentId) continue;
    if (!totalByStudent.has(l.studentId)) continue;
    const att = l.report?.studentAttendance?.[l.studentId] || l.report?.attendanceStatus || 'present';
    if (att === 'absent') continue;
    const earliest = earliestByStudent.get(l.studentId) || '';
    if (earliest && l.date && normalizeDateToISO(l.date) < earliest) continue;
    usedCountByStudent.set(l.studentId, (usedCountByStudent.get(l.studentId) || 0) + 1);
  }

  totalByStudent.forEach((totalAdvanceLessons, stId) => {
    const usedLessons = Math.min(totalAdvanceLessons, usedCountByStudent.get(stId) || 0);
    result.set(stId, {
      totalAdvanceLessons,
      usedLessons,
      remainingAdvanceLessons: Math.max(0, totalAdvanceLessons - usedLessons)
    });
  });

  return result;
};

