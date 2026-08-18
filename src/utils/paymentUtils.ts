import { Student, Group, Lesson, PaymentRecord } from '../types';

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

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
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

  // Map studentId -> Set of paid lesson IDs for fast lookup
  const studentPaidLessons = new Map<string, Set<string>>();
  activePayments.forEach(p => {
    if (p.status === 'paid' && p.lessonIds && p.lessonIds.length > 0) {
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

    // Collect all completed attended lessons for this student that have NOT been paid for
    const stCompletedLessons = activeLessons.filter(l => {
      if (l.status !== 'completed') return false;
      const matchesGroup = grp ? l.groupId === grp.id : false;
      const matchesStudent = l.studentId ? l.studentId === st.id : (!!l.studentName && l.studentName === st.name);
      if (!matchesGroup && !matchesStudent) return false;

      const att = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || 'present';
      if (att === 'absent') return false;

      if (paidIds.has(l.id)) return false;

      return true;
    });

    stCompletedLessons.sort((a, b) => a.date.localeCompare(b.date));

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
    
    // Add virtual lessons
    for (let i = 1; i <= virtualOffset; i++) {
      processedLessons.push({
        id: `virtual_${st.id}_sess_${i}`,
        dateLabel: `Offline (Session ${i}/${cycleLength})`,
        isVirtual: true
      });
    }

    // Add actual completed lessons
    stCompletedLessons.forEach(l => {
      processedLessons.push({
        id: l.id,
        dateLabel: `${formatDateDisplay(l.date)} (Session ${l.sessionNumber || 1}/${cycleLength})`,
        isVirtual: false
      });
    });

    // Unpaid record in payments
    const unpaidRec = activePayments.find(p => p.studentId === st.id && p.status !== 'paid');

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
    } else if (unpaidRec) {
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

  // Also include standalone unpaid payment records from payments table
  const addedPaymentRecordIds = new Set(list.map(item => item.existingPaymentRecordId).filter(Boolean));
  activePayments.forEach(p => {
    if (p.status !== 'paid' && !addedPaymentRecordIds.has(p.id)) {
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

  return list;
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



export const getPaymentsForPeriod = (payments: PaymentRecord[], startDateStr: string, endDateStr: string) => {
  return payments.filter(p => {
    if (p.deleted) return false;
    const dStr = p.paidDate || p.dueDate;
    if (!dStr) return false;
    // Extract YYYY-MM-DD
    const d = dStr.substring(0, 10);
    return d >= startDateStr && d <= endDateStr;
  });
};

export const getPaymentsForMonth = (payments: PaymentRecord[], monthPrefix: string) => {
  return payments.filter(p => {
    if (p.deleted) return false;
    const dStr = p.paidDate || p.dueDate;
    if (!dStr) return false;
    return dStr.startsWith(monthPrefix);
  });
};

export const getPaymentsForDay = (payments: PaymentRecord[], dayStr: string) => {
  return payments.filter(p => {
    if (p.deleted) return false;
    const dStr = p.paidDate || p.dueDate;
    if (!dStr) return false;
    return dStr.startsWith(dayStr);
  });
};

export const sumPayments = (list: PaymentRecord[]) => list.filter(p => !p.deleted).reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);
