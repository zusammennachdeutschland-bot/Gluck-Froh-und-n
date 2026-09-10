import { Student, Group, Lesson, PaymentRecord } from '../types';
import { areDuplicateLessons } from './lessonUtils';

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
  scheduleDays?: string[]
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
    for (let dayOffset = 1; dayOffset <= 120; dayOffset++) {
      cursor.setDate(cursor.getDate() - 1);
      const dayName = dayNames[cursor.getDay()].toLowerCase();
      if (validScheduleDays.includes(dayName)) {
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

  // Fallback: step backwards by ~3.5 days (average 2 sessions per week)
  const daysToSubtract = Math.max(1, Math.round(sessionsDiff * 3.5));
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
  scheduleDays?: string[]
): string[] => {
  if (!lessonDates || lessonDates.length === 0) return [];
  return lessonDates.map(item => {
    if (/\d{2}\/\d{2}\/\d{4}/.test(item)) {
      return item;
    }
    const match = item.match(/Session (\d+)\/(\d+)/i);
    if (match) {
      const sessNum = parseInt(match[1], 10);
      const totalSess = parseInt(match[2], 10) || bundleSize;
      const pastDate = calculateEstimatedPastDate(baseDateStr, sessNum, totalSess, scheduleDays);
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

  // Map studentId -> Set of paid or exempted lesson IDs for fast lookup
  const studentPaidLessons = new Map<string, Set<string>>();
  activePayments.forEach(p => {
    if ((p.status === 'paid' || p.status === 'exempted' || p.paymentType === 'exemption') && p.lessonIds && p.lessonIds.length > 0) {
      const stId = p.studentId;
      if (stId) {
        if (!studentPaidLessons.has(stId)) {
          studentPaidLessons.set(stId, new Set<string>());
        }
        p.lessonIds.forEach(id => studentPaidLessons.get(stId)!.add(id));
      }
    }
  });

  activeStudents.forEach(st => {
    const grp = activeGroups.find(g => g.id === st.groupId);
    const { cycleLength, amountDue } = getStudentCyclePricing(st, grp);
    const paidIds = studentPaidLessons.get(st.id) || new Set<string>();

    // Collect all completed attended lessons for this student that have NOT been paid or exempted
    const rawCompletedLessons = activeLessons.filter(l => {
      if (l.status !== 'completed') return false;
      if (l.paymentStatus === 'exempted') return false;
      const matchesGroup = grp ? l.groupId === grp.id : false;
      const matchesStudent = l.studentId ? l.studentId === st.id : (!!l.studentName && l.studentName === st.name);
      if (!matchesGroup && !matchesStudent) return false;

      const att = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || 'present';
      if (att === 'absent') return false;

      if (paidIds.has(l.id)) return false;

      return true;
    });

    // Strictly deduplicate lessons: a student cannot take two lessons on the same day at the same time
    const stCompletedLessons: Lesson[] = [];
    rawCompletedLessons.forEach(l => {
      const isDupe = stCompletedLessons.some(existing => 
        areDuplicateLessons(existing, l) ||
        (existing.date === l.date && (existing.time === l.time || (existing.sessionNumber && existing.sessionNumber === l.sessionNumber)))
      );
      if (!isDupe) {
        stCompletedLessons.push(l);
      }
    });

    stCompletedLessons.sort((a, b) => a.date.localeCompare(b.date));

    // Handle advance prepaid lessons
    const advancePayments = activePayments.filter(p => 
      p.studentId === st.id && 
      p.status === 'paid' && 
      (p.paymentType === 'advance_payment' || (p.bundleSize && p.bundleSize > 0 && p.notes?.includes('مقدم')))
    );
    const totalAdvanceLessonsCount = advancePayments.reduce((sum, p) => sum + (p.bundleSize || 0), 0);
    const explicitlyLinkedCount = advancePayments.reduce((sum, p) => sum + (p.lessonIds ? p.lessonIds.filter(id => !id.startsWith('virtual_')).length : 0), 0);
    const unlinkedAdvanceLessons = Math.max(0, totalAdvanceLessonsCount - explicitlyLinkedCount);

    const billableCompletedLessons = unlinkedAdvanceLessons > 0 
      ? stCompletedLessons.slice(unlinkedAdvanceLessons) 
      : stCompletedLessons;

    // Determine if we need to apply starting session number offset
    // Offset is applied ONLY for the first cycle if startingSessionNumber > 1, cycleLength > 1, and student has no paid payments
    const hasPaidPayments = activePayments.some(p => p.studentId === st.id && p.status === 'paid');
    const startSess = grp?.startingSessionNumber || 1;
    const virtualOffset = !hasPaidPayments && startSess > 1 && cycleLength > 1 ? (startSess - 1) : 0;

    interface ProcessedLesson {
      id: string;
      dateLabel: string;
      isVirtual: boolean;
    }

    const processedLessons: ProcessedLesson[] = [];
    const latestLessonDate = billableCompletedLessons[billableCompletedLessons.length - 1]?.date || new Date().toISOString().split('T')[0];
    const maxCompletedSessionNum = Math.max(0, ...billableCompletedLessons.map(l => l.sessionNumber || 0));
    const anchorSessionNum = maxCompletedSessionNum > 0 ? maxCompletedSessionNum : cycleLength;
    
    // Add virtual lessons with estimated past dates
    for (let i = 1; i <= virtualOffset; i++) {
      const matched = (activeLessons || []).find(l => 
        ((st.groupId && l.groupId === st.groupId) || (l.studentId && l.studentId === st.id)) && 
        l.sessionNumber === i
      );
      const pastDate = matched?.date || calculateEstimatedPastDate(latestLessonDate, i, anchorSessionNum, grp?.scheduleDays);
      const dLabel = `${formatDateDisplay(pastDate)} (Session ${i}/${cycleLength})`;
      processedLessons.push({
        id: matched ? matched.id : `virtual_${st.id}_sess_${i}`,
        dateLabel: dLabel,
        isVirtual: !matched
      });
    }

    // Add actual completed lessons that are billable
    billableCompletedLessons.forEach(l => {
      processedLessons.push({
        id: l.id,
        dateLabel: `${formatDateDisplay(l.date)} (Session ${l.sessionNumber || 1}/${cycleLength})`,
        isVirtual: false
      });
    });

    // Check if any billable completed lesson has reached the cycle limit or cycle boundary (e.g. session 8 of 8)
    const reachedCycleBySessionNum = maxCompletedSessionNum > 0 && cycleLength > 1 && (maxCompletedSessionNum >= cycleLength || maxCompletedSessionNum % cycleLength === 0);

    // If reachedCycleBySessionNum is true but processedLessons.length < cycleLength (e.g. teacher completed session 8 directly)
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
          const matched = (activeLessons || []).find(l => 
            ((st.groupId && l.groupId === st.groupId) || (l.studentId && l.studentId === st.id)) && 
            l.sessionNumber === s
          );
          const pastDate = matched?.date || calculateEstimatedPastDate(latestLessonDate, s, anchorSessionNum, grp?.scheduleDays);
          const dLabel = `${formatDateDisplay(pastDate)} (Session ${s}/${cycleLength})`;
          processedLessons.push({
            id: matched ? matched.id : `virtual_${st.id}_sess_${s}`,
            dateLabel: dLabel,
            isVirtual: !matched
          });
        }
      }
      processedLessons.sort((a, b) => {
        const na = parseInt(a.dateLabel.match(/Session (\d+)\//)?.[1] || '0', 10);
        const nb = parseInt(b.dateLabel.match(/Session (\d+)\//)?.[1] || '0', 10);
        return na - nb;
      });
    }

    // Unpaid record in payments (excluding exempted or paid)
    const unpaidRec = activePayments.find(p => 
      p.studentId === st.id && 
      p.status !== 'paid' && 
      p.status !== 'exempted' && 
      p.paymentType !== 'exemption'
    );

    if (processedLessons.length >= cycleLength) {
      let remaining = [...processedLessons];
      let chunkIndex = 0;

      while (remaining.length >= cycleLength) {
        const currentChunk = remaining.slice(0, cycleLength);
        const lessonDates = currentChunk.map(cl => cl.dateLabel);
        const lessonIds = currentChunk.filter(cl => !cl.isVirtual).map(cl => cl.id);

        // Only create a cycle if there is at least one actual lesson in it, OR if we need to align with unpaidRec
        const actualCount = currentChunk.filter(cl => !cl.isVirtual).length;
        if (actualCount > 0 || (chunkIndex === 0 && unpaidRec)) {
          // Adjust price for the first cycle if it's partially virtual!
          const pricePerSession = amountDue / cycleLength;
          const adjustedAmountDue = (chunkIndex === 0 && virtualOffset > 0)
            ? Math.round(pricePerSession * actualCount)
            : amountDue;

          list.push({
            id: (chunkIndex === 0 && unpaidRec?.id) ? unpaidRec.id : `due_cycle_${st.id}_${currentChunk.find(cl => !cl.isVirtual)?.id || Date.now()}_chunk_${chunkIndex}`,
            studentId: st.id,
            studentName: st.name,
            groupId: st.groupId || grp?.id || '',
            groupName: grp?.name || 'Gruppe',
            cycleLength,
            amountDue: adjustedAmountDue,
            lessonDates,
            lessonIds,
            status: (chunkIndex === 0 && unpaidRec) ? 'not_yet' : 'due',
            parentPhone: st.parentPhone || st.studentPhone || '',
            existingPaymentRecordId: chunkIndex === 0 ? unpaidRec?.id : undefined
          });
        }

        remaining = remaining.slice(cycleLength);
        chunkIndex++;
      }
    } else if (unpaidRec && unlinkedAdvanceLessons === 0) {
      // Format unpaid rec lesson dates if they don't have session numbers yet
      const lessonDates = (unpaidRec.lessonDates || []).map((d, idx) => {
        if (d.includes('Session')) return d;
        return `${d} (Session ${idx + 1}/${unpaidRec.bundleSize || cycleLength})`;
      });

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
        status: 'not_yet',
        parentPhone: st.parentPhone || st.studentPhone || '',
        existingPaymentRecordId: unpaidRec.id
      });
    }
  });

  // Also include standalone unpaid payment records from payments table (excluding exempted and students with advance credit)
  const addedPaymentRecordIds = new Set(list.map(item => item.existingPaymentRecordId).filter(Boolean));
  activePayments.forEach(p => {
    if (p.status !== 'paid' && p.status !== 'exempted' && p.paymentType !== 'exemption' && !addedPaymentRecordIds.has(p.id)) {
      // If this student has prepaid advance lessons, do not create an unpaid card
      const hasAdvanceCredit = activePayments.some(adv => 
        adv.studentId === p.studentId && 
        adv.status === 'paid' && 
        (adv.paymentType === 'advance_payment' || (adv.bundleSize && adv.bundleSize > 0 && adv.notes?.includes('مقدم')))
      );
      if (hasAdvanceCredit) {
        return;
      }

      list.push({
        id: p.id,
        studentId: p.studentId || '',
        studentName: p.studentName || 'Schüler',
        groupId: p.groupId || '',
        groupName: p.groupName || 'Gruppe',
        cycleLength: p.bundleSize || 1,
        amountDue: p.amountDue || 0,
        lessonDates: p.lessonDates || [],
        lessonIds: p.lessonIds || [],
        status: 'not_yet',
        parentPhone: '',
        existingPaymentRecordId: p.id
      });
    }
  });

  // Deduplicate list by studentId and lessonDates / amount to prevent duplicate cards
  const uniqueList: DuePaymentCycle[] = [];
  const seenCycleSignatures = new Set<string>();

  list.forEach(cycle => {
    const datesSig = (cycle.lessonDates || []).sort().join('|');
    const sig = `${cycle.studentId}_${datesSig || cycle.amountDue}`;
    if (!seenCycleSignatures.has(sig)) {
      seenCycleSignatures.add(sig);
      uniqueList.push(cycle);
    }
  });

  return uniqueList;
};

/**
 * Single Source of Truth for Student & Group Payment Calculation.
 * 
 * Rules:
 * 1. Explicit Student Override:
 *    - If student has `paymentPlan === 'per_lesson'`, cycleLength = 1, amountDue = student.pricePerLesson || 300.
 *    - If student has custom bundle/package, use student's custom settings.
 * 
 * 2. Group Settings (Takes precedence if no explicit student override):
 *    - Mode 1: Per Session (دفع بالحصة): group.paymentCycle === 'per_lesson'
 *      cycleLength = 1
 *      pricePerSession = group.pricePerSession || 300
 *      amountDue = pricePerSession
 * 
 *    - Mode 2: Package Cycle (دفع بالدورة كل 4 أو 8 حصص): group.paymentCycle === 'monthly' or package
 *      cycleLength = group.sessionCount || 8
 *      amountDue = group.monthlyPackagePrice || (group.pricePerSession ? group.pricePerSession * cycleLength : 2400)
 *      pricePerSession = Math.round(amountDue / (cycleLength || 1))
 * 
 * 3. Fallback (Individual student without group):
 *    - Use student-level plan or defaults.
 */
export const getStudentCyclePricing = (
  student: Student,
  group?: Group
): CyclePricingResult => {
  // Check if student has explicit custom override
  if (student.paymentPlan === 'per_lesson') {
    const cycleLength = 1;
    const pricePerSession = student.pricePerLesson || 300;
    const amountDue = pricePerSession;
    return { cycleLength, amountDue, pricePerSession, isCustomOverride: true };
  }

  const hasExplicitCustomBundle = student.paymentPlan === 'custom_bundle' || 
                                  (student.customBundlePrice !== undefined && student.customBundlePrice !== null && student.customBundlePrice > 0);

  if (hasExplicitCustomBundle) {
    const cycleLength = student.bundleSize || 8;
    const amountDue = student.customBundlePrice || (student.pricePerLesson ? student.pricePerLesson * cycleLength : 2400);
    const pricePerSession = Math.round(amountDue / (cycleLength || 1));
    return { cycleLength, amountDue, pricePerSession, isCustomOverride: true };
  }

  // Group settings take precedence
  if (group) {
    const isPerLesson = group.paymentCycle === 'per_lesson' || group.paymentModel === 'per_session';

    if (isPerLesson) {
      const cycleLength = 1;
      const pricePerSession = group.pricePerSession || (group.monthlyPackagePrice && group.sessionCount ? Math.round(group.monthlyPackagePrice / group.sessionCount) : 300);
      const amountDue = pricePerSession;
      return { cycleLength, amountDue, pricePerSession, isCustomOverride: false };
    } else {
      const cycleLength = group.sessionCount || 8;
      const amountDue = group.monthlyPackagePrice || (group.pricePerSession ? group.pricePerSession * cycleLength : 2400);
      const pricePerSession = Math.round(amountDue / (cycleLength || 1));
      return { cycleLength, amountDue, pricePerSession, isCustomOverride: false };
    }
  }

  // Individual student without group assignment
  const plan = student.paymentPlan || '8_lessons';
  const isPerLesson = (plan as string) === 'per_lesson';
  const cycleLength = isPerLesson ? 1 : (student.bundleSize || (
    plan === '4_lessons' ? 4 : 
    plan === '8_lessons' ? 8 : 
    plan === '12_lessons' ? 12 : 8
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
    (p.studentId === studentId || (!!studentName && p.studentName === studentName)) && 
    p.status === 'paid'
  );
  const advancePayments = activePayments.filter(p => 
    p.paymentType === 'advance_payment' || (p.bundleSize && p.bundleSize > 0 && p.notes?.includes('مقدم'))
  );
  
  const totalAdvanceLessons = advancePayments.reduce((sum, p) => sum + (p.bundleSize || 0), 0);
  if (totalAdvanceLessons <= 0) {
    return { totalAdvanceLessons: 0, usedLessons: 0, remainingAdvanceLessons: 0 };
  }

  // Find the earliest advance payment date/timestamp
  const earliestAdvancePayment = advancePayments.reduce((earliest, p) => {
    const pDate = p.paidDate || p.createdAt || '';
    if (!earliest || (pDate && pDate < earliest)) return pDate;
    return earliest;
  }, '');

  // Count attended completed lessons strictly for THIS student on or after the advance payment date
  const completedLessons = lessons.filter(l => {
    if (l.deleted) return false;
    if (l.status !== 'completed') return false;
    if (l.paymentStatus === 'exempted') return false;
    const matchesStudent = l.studentId === studentId || (!!studentName && l.studentName === studentName);
    if (!matchesStudent) return false;
    const att = l.report?.studentAttendance?.[studentId] || l.report?.attendanceStatus || 'present';
    if (att === 'absent') return false;
    if (earliestAdvancePayment && l.date && l.date < earliestAdvancePayment.substring(0, 10)) {
      return false;
    }
    return true;
  });

  const usedLessons = Math.min(totalAdvanceLessons, completedLessons.length);
  const remainingAdvanceLessons = Math.max(0, totalAdvanceLessons - usedLessons);

  return { totalAdvanceLessons, usedLessons, remainingAdvanceLessons };
};
