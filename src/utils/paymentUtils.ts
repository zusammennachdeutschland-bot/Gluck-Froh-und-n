import { Student, Group, Lesson, PaymentRecord, ScheduleRecurrence } from '../types';
import { areDuplicateLessons, compareLessonsChronologically, isGroupPerLesson } from './lessonUtils';
import { resolveStudentWhatsAppContact } from './phoneUtils';
import { normalizeDateToISO, formatLocalDate } from './timeUtils';
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
  amountDue: number; // Net remaining amount due after any partial payment or discount
  originalAmountDue?: number;
  amountPaid?: number;
  discountAmount?: number;
  lessonDates: string[];
  lessonIds: string[];
  status: 'due' | 'not_yet';
  parentPhone?: string;
  existingPaymentRecordId?: string;
  needsPricingReview?: boolean;
  pricingReviewReason?: string;
}

export interface UnresolvedHistoricalLessonDebt {
  lessonId: string;
  lessonDate: string;
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  reason: string;
}

let lastUnresolvedHistoricalLessonDebts: UnresolvedHistoricalLessonDebt[] = [];

export const getUnresolvedHistoricalLessonDebts = (): UnresolvedHistoricalLessonDebt[] => {
  return [...lastUnresolvedHistoricalLessonDebts];
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

export const doesLessonIncludeMovedStudent = (lesson: Lesson, student: Student): boolean => {
  if (!lesson || !student) return false;
  if (lesson.studentId && lesson.studentId === student.id) return true;
  if (!lesson.studentId && lesson.studentName && lesson.studentName === student.name) return true;
  if (lesson.studentPayments && Object.prototype.hasOwnProperty.call(lesson.studentPayments, student.id)) return true;
  if (lesson.report?.studentPayments && Object.prototype.hasOwnProperty.call(lesson.report.studentPayments, student.id)) return true;
  if (lesson.report?.studentAttendance && Object.prototype.hasOwnProperty.call(lesson.report.studentAttendance, student.id)) return true;
  if (lesson.report?.studentHomeworkDone && Object.prototype.hasOwnProperty.call(lesson.report.studentHomeworkDone, student.id)) return true;
  if (lesson.report?.studentDictationGrade && Object.prototype.hasOwnProperty.call(lesson.report.studentDictationGrade, student.id)) return true;
  if (lesson.report?.studentExamGrade && Object.prototype.hasOwnProperty.call(lesson.report.studentExamGrade, student.id)) return true;
  if (lesson.report?.studentNotes && Object.prototype.hasOwnProperty.call(lesson.report.studentNotes, student.id)) return true;
  if (lesson.report?.studentPerformance && Object.prototype.hasOwnProperty.call(lesson.report.studentPerformance, student.id)) return true;
  if (lesson.report?.studentScores && Object.prototype.hasOwnProperty.call(lesson.report.studentScores, student.id)) return true;
  if (lesson.attendance && Object.prototype.hasOwnProperty.call(lesson.attendance, student.id)) return true;

  if (lesson.groupId) {
    if (Array.isArray(student.previousGroupIds) && student.previousGroupIds.includes(lesson.groupId)) {
      return true;
    }
    if (student.archivedGroupId && student.archivedGroupId === lesson.groupId) {
      return true;
    }
    if (Array.isArray(student.groupHistory)) {
      const histEntry = student.groupHistory.find(h => h && h.groupId === lesson.groupId);
      if (histEntry) {
        const lessonIso = normalizeDateToISO(lesson.date);
        if (!histEntry.leftDate || !lessonIso || lessonIso <= normalizeDateToISO(histEntry.leftDate)) {
          return true;
        }
      }
    }
  }
  return false;
};

export const resolveHistoricalLessonFeeForStudent = (
  lesson: Lesson,
  student: Student,
  lessonGroup?: Group
): { fee: number | null; reason?: string } => {
  const sp = lesson.studentPayments?.[student.id];
  if (sp && typeof sp.amountDue === 'number' && sp.amountDue > 0) {
    const paidOnSp = typeof sp.amountPaid === 'number' ? sp.amountPaid : 0;
    return { fee: Math.max(0, sp.amountDue - paidOnSp) };
  }
  const repSp = (lesson.report?.studentPayments?.[student.id] as any);
  if (repSp && typeof repSp.amountDue === 'number' && repSp.amountDue > 0) {
    const paidOnRep = typeof repSp.amountPaid === 'number' ? repSp.amountPaid : (typeof repSp.amount === 'number' && repSp.status === 'paid' ? repSp.amount : 0);
    return { fee: Math.max(0, repSp.amountDue - paidOnRep) };
  }

  // Check if student groupHistory recorded the historical price per session or package for this group
  if (lesson.groupId && Array.isArray(student.groupHistory)) {
    const hist = student.groupHistory.find((h: any) => h && h.groupId === lesson.groupId);
    if (hist && typeof (hist as any).pricePerSession === 'number' && (hist as any).pricePerSession > 0) {
      return { fee: (hist as any).pricePerSession };
    }
  }

  if (typeof lesson.amountDue === 'number' && lesson.amountDue > 0) {
    return { fee: lesson.amountDue };
  }

  if (lessonGroup) {
    const isPerLesson = isGroupPerLesson(lessonGroup);
    if (isPerLesson && typeof lessonGroup.pricePerSession === 'number' && lessonGroup.pricePerSession > 0) {
      return { fee: lessonGroup.pricePerSession };
    }
    if (typeof lessonGroup.monthlyPackagePrice === 'number' && lessonGroup.monthlyPackagePrice > 0) {
      const count = Math.max(1, lessonGroup.sessionCount || lesson.totalSessionsInPackage || 4);
      return { fee: Math.round(lessonGroup.monthlyPackagePrice / count) };
    }
    if (typeof lessonGroup.pricePerSession === 'number' && lessonGroup.pricePerSession > 0) {
      return { fee: lessonGroup.pricePerSession };
    }
  }

  return {
    fee: null,
    reason: `سعر الحصة التاريخي أو نسبة الطالب غير معروفين للحصة (${lesson.id}) بتاريخ ${lesson.date || 'غير محدد'} في المجموعة (${lesson.groupName || lesson.groupId || 'غير معروفة'})`
  };
};

export const calculateDuePaymentCycles = (
  students: Student[],
  groups: Group[],
  lessons: Lesson[],
  payments: PaymentRecord[]
): DuePaymentCycle[] => {
  const list: DuePaymentCycle[] = [];
  const unresolvedDebts: UnresolvedHistoricalLessonDebt[] = [];

  const activeStudents = students.filter(s => !s.deleted && s.status !== 'archived');
  const activeGroups = groups.filter(g => !g.deleted && g.status !== 'archived');
  const activeLessons = lessons.filter(l => !l.deleted);
  const activePayments = payments.filter(p => !p.deleted);

  // Map studentId -> Set of paid or exempted lesson IDs for fast lookup
  const studentPaidLessons = new Map<string, Set<string>>();
  // Map studentId -> Set of lesson IDs already attached to an existing open/partial PaymentRecord
  const studentBilledPendingLessons = new Map<string, Set<string>>();

  activePayments.forEach(p => {
    const ids: string[] = [];
    if (p.lessonIds && p.lessonIds.length > 0) {
      ids.push(...p.lessonIds);
    }
    if (p.lessonId && !ids.includes(p.lessonId)) {
      ids.push(p.lessonId);
    }

    // Only fall back to lessonDates when the payment record has no explicit lessonIds
    if (ids.length === 0 && p.lessonDates && Array.isArray(p.lessonDates)) {
      p.lessonDates.forEach(dStr => {
        if (!dStr || typeof dStr !== 'string') return;
        const match = dStr.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/);
        if (match) {
          const dateNormalized = normalizeDateToISO(match[1]);
          const matchedLessons = activeLessons.filter(l => 
            l.date === dateNormalized && 
            ((p.studentId && (l.studentId === p.studentId || l.studentName === p.studentName)) || (p.groupId && l.groupId === p.groupId))
          );
          matchedLessons.forEach(ml => {
            if (!ids.includes(ml.id)) ids.push(ml.id);
          });
        }
      });
    }

    if ((p.status === 'paid' || p.status === 'exempted' || p.paymentType === 'exemption')) {
      if (ids.length > 0) {
        const stId = p.studentId;
        if (stId) {
          if (!studentPaidLessons.has(stId)) {
            studentPaidLessons.set(stId, new Set<string>());
          }
          ids.forEach(id => studentPaidLessons.get(stId)!.add(id));
        }
      }
    } else if (p.studentId && ids.length > 0) {
      if (!studentBilledPendingLessons.has(p.studentId)) {
        studentBilledPendingLessons.set(p.studentId, new Set<string>());
      }
      ids.filter(id => id && !id.startsWith('virtual_')).forEach(id => {
        studentBilledPendingLessons.get(p.studentId)!.add(id);
      });
    }
  });

  // Also collect all lessons that are directly marked as paid or studentPayments paid
  activeLessons.forEach(l => {
    // 1-on-1 private lesson with explicit studentId (strictly when NOT a group lesson)
    if (!l.groupId && (l.paymentStatus === 'paid' || l.report?.paymentStatus === 'paid') && l.studentId) {
      if (!studentPaidLessons.has(l.studentId)) studentPaidLessons.set(l.studentId, new Set<string>());
      studentPaidLessons.get(l.studentId)!.add(l.id);
    }
    // Individual student payments on the lesson
    if (l.studentPayments && typeof l.studentPayments === 'object') {
      Object.entries(l.studentPayments).forEach(([stId, sp]: [string, any]) => {
        if (sp?.paymentStatus === 'paid' || sp?.status === 'paid') {
          if (!studentPaidLessons.has(stId)) studentPaidLessons.set(stId, new Set<string>());
          studentPaidLessons.get(stId)!.add(l.id);
        }
      });
    }
    // Individual student payments in the lesson report
    if (l.report?.studentPayments && typeof l.report.studentPayments === 'object') {
      Object.entries(l.report.studentPayments).forEach(([stId, sp]: [string, any]) => {
        if (sp?.paymentStatus === 'paid' || sp?.status === 'paid') {
          if (!studentPaidLessons.has(stId)) studentPaidLessons.set(stId, new Set<string>());
          studentPaidLessons.get(stId)!.add(l.id);
        }
      });
    }
  });

  const getNetPaymentRecordBalance = (p: PaymentRecord, fallbackDue?: number): number => {
    const gross = typeof p.amountDue === 'number' && p.amountDue > 0 ? p.amountDue : (fallbackDue ?? 0);
    const paid = Number(p.amountPaid || 0);
    const discount = Number(p.discountAmount || 0);
    const computed = Math.max(0, gross - paid - discount);
    if (typeof p.remainingBalance === 'number' && p.remainingBalance >= 0 && (paid > 0 || discount > 0)) {
      return Math.min(gross, p.remainingBalance);
    }
    return computed;
  };

  activeStudents.forEach(st => {
    const grp = activeGroups.find(g => g.id === st.groupId || (st.groupId && g.name && g.name.trim().toLowerCase() === st.groupId.trim().toLowerCase()) || (g.name && st.groupId && st.groupId.trim().toLowerCase().includes(g.name.trim().toLowerCase())))
      || groups.find(g => g.id === st.groupId || (st.groupId && g.name && g.name.trim().toLowerCase() === st.groupId.trim().toLowerCase()));
    const { cycleLength, amountDue } = getStudentCyclePricing(st, grp);
    const paidIds = studentPaidLessons.get(st.id) || new Set<string>();

    // Collect all completed attended lessons for this student in their CURRENT group (or 1-on-1) that have NOT been paid or exempted
    const rawCompletedLessons = activeLessons.filter(l => {
      if (l.status !== 'completed') return false;
      if (l.paymentStatus === 'exempted') return false;
      const matchesGroup = grp ? l.groupId === grp.id : (Boolean(st.groupId) && l.groupId === st.groupId);
      const matchesStudent = !l.groupId && (l.studentId ? l.studentId === st.id : (!!l.studentName && l.studentName === st.name));
      const matchesStudentInCurrentGroup = matchesGroup || matchesStudent || (Boolean(l.studentId && l.studentId === st.id) && (!l.groupId || l.groupId === (grp?.id || st.groupId)));
      if (!matchesStudentInCurrentGroup) return false;

      const att = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || 'present';
      if (att === 'absent') return false;

      if (paidIds.has(l.id)) return false;

      const stPaymentObj = l.studentPayments?.[st.id];
      const repPaymentObj = l.report?.studentPayments?.[st.id] as any;
      const isStudentPaidInLesson = (stPaymentObj?.paymentStatus === 'paid' || (stPaymentObj as any)?.status === 'paid' || stPaymentObj?.paymentStatus === 'exempted') || 
                                    (repPaymentObj?.paymentStatus === 'paid' || repPaymentObj?.status === 'paid' || repPaymentObj?.paymentStatus === 'exempted' || repPaymentObj?.status === 'exempted');
      
      const isPrivateLessonForStudent = !l.groupId && Boolean(l.studentId && l.studentId === st.id);
      const isPrivateLessonPaid = isPrivateLessonForStudent && (l.paymentStatus === 'paid' || l.report?.paymentStatus === 'paid');

      if (isStudentPaidInLesson || isPrivateLessonPaid) {
        return false;
      }

      return true;
    });

    // P19: Collect completed attended unpaid lessons from OLD groups after a student move!
    const currentGroupId = grp?.id || st.groupId || '';
    const billedPendingSet = studentBilledPendingLessons.get(st.id) || new Set<string>();
    const rawOldGroupCompletedLessons = activeLessons.filter(l => {
      if (l.status !== 'completed') return false;
      if (l.paymentStatus === 'exempted') return false;
      if (!l.groupId || l.groupId === currentGroupId) return false;
      if (paidIds.has(l.id) || billedPendingSet.has(l.id)) return false;

      if (!doesLessonIncludeMovedStudent(l, st)) return false;

      const att = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || 'present';
      if (att === 'absent') return false;

      const stPaymentObj = l.studentPayments?.[st.id];
      const repPaymentObj = l.report?.studentPayments?.[st.id] as any;
      const isStudentPaidOrExemptInLesson =
        stPaymentObj?.paymentStatus === 'paid' ||
        (stPaymentObj as any)?.status === 'paid' ||
        stPaymentObj?.paymentStatus === 'exempted' ||
        (stPaymentObj as any)?.status === 'exempted' ||
        repPaymentObj?.paymentStatus === 'paid' ||
        repPaymentObj?.status === 'paid' ||
        repPaymentObj?.paymentStatus === 'exempted' ||
        repPaymentObj?.status === 'exempted';
      if (isStudentPaidOrExemptInLesson) return false;

      return true;
    });

    // Group old-group lessons by their historical groupId so each old group is priced strictly by its historical recorded price
    if (rawOldGroupCompletedLessons.length > 0) {
      const oldLessonsByGroup = new Map<string, Lesson[]>();
      const seenOldIds = new Set<string>();
      rawOldGroupCompletedLessons
        .slice()
        .sort(compareLessonsChronologically)
        .forEach(l => {
          if (!l.id || seenOldIds.has(l.id)) return;
          seenOldIds.add(l.id);
          const gKey = l.groupId;
          if (!oldLessonsByGroup.has(gKey)) oldLessonsByGroup.set(gKey, []);
          oldLessonsByGroup.get(gKey)!.push(l);
        });

      oldLessonsByGroup.forEach((oldLessons, oldGrpId) => {
        const oldGrp = groups.find(g => g.id === oldGrpId || (g.name && lGroupMatches(g.name, oldGrpId)));
        let totalHistoricalDue = 0;
        let hasUnresolvedFee = false;
        const unresolvedReasons: string[] = [];

        oldLessons.forEach(ol => {
          const resolved = resolveHistoricalLessonFeeForStudent(ol, st, oldGrp);
          if (resolved.fee === null) {
            hasUnresolvedFee = true;
            const reason = resolved.reason || `سعر الحصة التاريخي غير معروف للحصة ${ol.id}`;
            unresolvedReasons.push(reason);
            unresolvedDebts.push({
              lessonId: ol.id,
              lessonDate: ol.date,
              studentId: st.id,
              studentName: st.name,
              groupId: oldGrpId,
              groupName: oldGrp?.name || ol.groupName || oldGrpId,
              reason
            });
          } else {
            totalHistoricalDue += resolved.fee;
          }
        });

        const oldCycleLen = oldLessons.length;
        const lessonDates = oldLessons.map((ol, idx) => `${formatDateDisplay(ol.date)} (Session ${ol.sessionNumber || (idx + 1)}/${ol.totalSessionsInPackage || oldGrp?.sessionCount || oldCycleLen})`);
        const lessonIds = oldLessons.map(ol => ol.id);

        list.push({
          id: `due_hist_${st.id}_${oldGrpId}_${oldLessons[0].id}`,
          studentId: st.id,
          studentName: st.name,
          groupId: oldGrpId,
          groupName: oldGrp?.name || oldLessons[0].groupName || 'Gruppe',
          cycleLength: oldCycleLen,
          amountDue: Math.round(totalHistoricalDue * 100) / 100,
          originalAmountDue: Math.round(totalHistoricalDue * 100) / 100,
          lessonDates,
          lessonIds,
          status: 'due',
          parentPhone: resolveStudentWhatsAppContact(st).contact || '',
          needsPricingReview: hasUnresolvedFee,
          pricingReviewReason: hasUnresolvedFee ? unresolvedReasons.join(' | ') : undefined
        });
      });
    }

    // P9: Key completed lessons strictly by lesson ID so two lessons on the same day with the same sessionNumber are both counted
    const stCompletedLessons: Lesson[] = [];
    const seenLessonIds = new Set<string>();
    rawCompletedLessons.forEach(l => {
      if (!l.id) return;
      if (!seenLessonIds.has(l.id)) {
        seenLessonIds.add(l.id);
        stCompletedLessons.push(l);
      }
    });

    // P10: Order completed lessons chronologically using date, normalized time, and ID tiebreakers
    stCompletedLessons.sort(compareLessonsChronologically);

    // Handle advance prepaid lessons (only remaining advance lessons not already consumed by debt settlement)
    const advancePayments = activePayments.filter(p => 
      p.studentId === st.id && 
      p.status === 'paid' && 
      (p.paymentType === 'advance_payment' || (p.bundleSize && p.bundleSize > 0 && p.notes?.includes('مقدم')))
    );
    const totalAdvanceLessonsCount = advancePayments.reduce((sum, p) => sum + Math.max(0, Number(p.bundleSize) || 0), 0);
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
    const latestLessonDate = billableCompletedLessons[billableCompletedLessons.length - 1]?.date || formatLocalDate();
    const maxCompletedSessionNum = Math.max(0, ...billableCompletedLessons.map(l => l.sessionNumber || 0));
    const anchorSessionNum = maxCompletedSessionNum > 0 ? maxCompletedSessionNum : cycleLength;
    
    // Add virtual lessons with estimated past dates
    for (let i = 1; i <= virtualOffset; i++) {
      const matched = (activeLessons || []).find(l => 
        ((st.groupId && l.groupId === st.groupId) || (l.studentId && l.studentId === st.id)) && 
        l.sessionNumber === i
      );
      const pastDate = matched?.date || calculateEstimatedPastDate(latestLessonDate, i, anchorSessionNum, grp?.scheduleDays, st.scheduleRecurrence || grp?.scheduleRecurrence);
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
          const pastDate = matched?.date || calculateEstimatedPastDate(latestLessonDate, s, anchorSessionNum, grp?.scheduleDays, st.scheduleRecurrence || grp?.scheduleRecurrence);
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

    // Unpaid record in payments for the student's current group (excluding exempted or paid)
    const unpaidRecCandidate = activePayments.find(p => 
      p.studentId === st.id && 
      (!p.groupId || !currentGroupId || p.groupId === currentGroupId) &&
      p.status !== 'paid' && 
      p.status !== 'exempted' && 
      p.paymentType !== 'exemption'
    );

    // P2: Verify unpaidRecCandidate is truly unpaid and not already covered by paid lesson IDs
    let isCandidateCovered = false;
    if (unpaidRecCandidate) {
      const uLessonIds = [
        ...(unpaidRecCandidate.lessonIds || []),
        ...(unpaidRecCandidate.lessonId ? [unpaidRecCandidate.lessonId] : [])
      ].filter(id => id && !id.startsWith('virtual_'));
      if (uLessonIds.length > 0 && uLessonIds.every(id => paidIds.has(id))) {
        isCandidateCovered = true;
      }
    }
    const unpaidRec = isCandidateCovered ? undefined : unpaidRecCandidate;

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
          const pricePerSession = amountDue / cycleLength;
          const grossAmountDue = (chunkIndex === 0 && virtualOffset > 0)
            ? Math.round(pricePerSession * actualCount)
            : amountDue;
          const linkedRec = chunkIndex === 0 ? unpaidRec : undefined;
          const netAmountDue = linkedRec
            ? getNetPaymentRecordBalance(linkedRec, grossAmountDue)
            : grossAmountDue;

          if (netAmountDue > 0) {
            list.push({
              id: linkedRec?.id ? linkedRec.id : `due_cycle_${st.id}_${currentChunk.find(cl => !cl.isVirtual)?.id || Date.now()}_chunk_${chunkIndex}`,
              studentId: st.id,
              studentName: st.name,
              groupId: st.groupId || grp?.id || '',
              groupName: grp?.name || 'Gruppe',
              cycleLength,
              amountDue: netAmountDue,
              originalAmountDue: linkedRec?.amountDue || grossAmountDue,
              amountPaid: linkedRec?.amountPaid || 0,
              discountAmount: linkedRec?.discountAmount || 0,
              lessonDates,
              lessonIds,
              status: linkedRec ? 'not_yet' : 'due',
              parentPhone: resolveStudentWhatsAppContact(st).contact || '',
              existingPaymentRecordId: linkedRec?.id
            });
          }
        }

        remaining = remaining.slice(cycleLength);
        chunkIndex++;
      }
    } else if (unpaidRec && unlinkedAdvanceLessons === 0 && stCompletedLessons.length > 0) {
      const lessonDates = (unpaidRec.lessonDates || []).map((d, idx) => {
        if (d.includes('Session')) return d;
        return `${d} (Session ${idx + 1}/${unpaidRec.bundleSize || cycleLength})`;
      });

      const recStatusStr = String(unpaidRec.status || '');
      const isExplicitlyDue = recStatusStr === 'due' || recStatusStr === 'overdue' || recStatusStr === 'partial';
      const isFullCycleCompleted = cycleLength === 1 || stCompletedLessons.length >= cycleLength || maxCompletedSessionNum >= cycleLength;

      if (isExplicitlyDue || isFullCycleCompleted) {
        const netDue = getNetPaymentRecordBalance(unpaidRec, unpaidRec.amountDue || amountDue);
        if (netDue > 0) {
          list.push({
            id: unpaidRec.id,
            studentId: st.id,
            studentName: st.name,
            groupId: st.groupId || grp?.id || '',
            groupName: grp?.name || unpaidRec.groupName || 'Gruppe',
            cycleLength: unpaidRec.bundleSize || cycleLength,
            amountDue: netDue,
            originalAmountDue: unpaidRec.amountDue || amountDue,
            amountPaid: unpaidRec.amountPaid || 0,
            discountAmount: unpaidRec.discountAmount || 0,
            lessonDates,
            lessonIds: unpaidRec.lessonIds || [],
            status: isExplicitlyDue ? 'due' : 'not_yet',
            parentPhone: resolveStudentWhatsAppContact(st).contact || '',
            existingPaymentRecordId: unpaidRec.id
          });
        }
      }
    }
  });

  // Also include standalone unpaid payment records from payments table (including old-group pending/partial invoices)
  const addedPaymentRecordIds = new Set(list.map(item => item.existingPaymentRecordId).filter(Boolean));
  activePayments.forEach(p => {
    if (p.status !== 'paid' && p.status !== 'exempted' && p.paymentType !== 'exemption' && !addedPaymentRecordIds.has(p.id)) {
      const pLessonIds = [
        ...(p.lessonIds || []),
        ...(p.lessonId ? [p.lessonId] : [])
      ].filter(id => id && !id.startsWith('virtual_'));
      const isIdsCovered = pLessonIds.length > 0 && pLessonIds.every(id => {
        const paidSet = p.studentId ? studentPaidLessons.get(p.studentId) : null;
        return paidSet ? paidSet.has(id) : false;
      });
      if (isIdsCovered) return;

      const isCoveredByPaidPayment = activePayments.some(paid => {
        if (paid.studentId !== p.studentId || paid.status !== 'paid') return false;
        const paidLessonIds = new Set(
          [
            ...(paid.lessonIds || []),
            ...(paid.lessonId ? [paid.lessonId] : [])
          ].filter(id => id && !id.startsWith('virtual_'))
        );
        if (pLessonIds.length > 0 && paidLessonIds.size > 0) {
          return pLessonIds.every(id => paidLessonIds.has(id));
        }
        return false;
      });
      if (isCoveredByPaidPayment) return;

      const st = students.find(s => s.id === p.studentId);
      const isMovedOldGroupRecord = Boolean(st && p.groupId && st.groupId && p.groupId !== st.groupId);
      const grp = groups.find(g => g.id === (p.groupId || st?.groupId) || (g.name && p.groupId && g.name.trim().toLowerCase() === p.groupId.trim().toLowerCase()) || (p.groupName && g.name && g.name.trim().toLowerCase() === p.groupName.trim().toLowerCase()));
      const isGrpPerLesson = grp ? isGroupPerLesson(grp) : false;
      // P19: For old-group payment records after a student move, preserve the historical recorded amountDue/bundleSize on `p`
      const pricing = (!isMovedOldGroupRecord && st) ? getStudentCyclePricing(st, grp) : null;
      const effectiveCycleLength = isMovedOldGroupRecord
        ? (p.bundleSize || (grp ? (isGrpPerLesson ? 1 : (grp.sessionCount || 4)) : 1))
        : (isGrpPerLesson ? 1 : (pricing ? pricing.cycleLength : (p.bundleSize || 1)));
      const grossAmountDue = isMovedOldGroupRecord
        ? (typeof p.amountDue === 'number' && p.amountDue > 0 ? p.amountDue : (grp?.monthlyPackagePrice || grp?.pricePerSession || 0))
        : (typeof p.amountDue === 'number' && p.amountDue > 0 ? p.amountDue : (pricing ? pricing.amountDue : (isGrpPerLesson && grp?.pricePerSession ? grp.pricePerSession : 0)));
      const effectiveAmountDue = getNetPaymentRecordBalance(p, grossAmountDue);
      if (effectiveAmountDue <= 0) return;

      const lastDateStr = (p.lessonDates && p.lessonDates.length > 0) ? p.lessonDates[p.lessonDates.length - 1] : '';
      const sessionMatch = lastDateStr ? lastDateStr.match(/Session (\d+)\//) : null;
      const sessNum = sessionMatch ? parseInt(sessionMatch[1], 10) : (p.lessonDates?.length || 0);
      const isFullCycleCompleted = isMovedOldGroupRecord || effectiveCycleLength === 1 || sessNum >= effectiveCycleLength || (p.lessonDates?.length || 0) >= effectiveCycleLength;
      const pStatusStr = String(p.status || '');
      const isExplicitlyDue = pStatusStr === 'due' || pStatusStr === 'overdue' || pStatusStr === 'partial';

      if (!isFullCycleCompleted && !isExplicitlyDue) {
        return;
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
        originalAmountDue: grossAmountDue,
        amountPaid: p.amountPaid || 0,
        discountAmount: p.discountAmount || 0,
        lessonDates: sanitizedLessonDates,
        lessonIds: p.lessonIds || [],
        status: 'not_yet',
        parentPhone: st ? resolveStudentWhatsAppContact(st).contact : '',
        existingPaymentRecordId: p.id
      });
    }
  });

  lastUnresolvedHistoricalLessonDebts = unresolvedDebts;

  // Deduplicate list by studentId and lessonIds (or lessonDates / amount fallback)
  const uniqueList: DuePaymentCycle[] = [];
  const seenCycleSignatures = new Set<string>();

  list.forEach(cycle => {
    const idsSig = (cycle.lessonIds || []).filter(Boolean).slice().sort().join('|');
    const datesSig = (cycle.lessonDates || []).slice().sort().join('|');
    const sig = `${cycle.studentId}_${idsSig || datesSig || cycle.amountDue}_${cycle.existingPaymentRecordId || ''}`;
    if (!seenCycleSignatures.has(sig)) {
      seenCycleSignatures.add(sig);
      uniqueList.push(cycle);
    }
  });

  return uniqueList;
};

function lGroupMatches(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Single Source of Truth for Student & Group Payment Calculation.
 * 
 * Rules:
 * 1. Group Settings take precedence whenever a student belongs to a group:
 *    - Mode 1: Per Session (دفع بالحصة): group.paymentCycle === 'per_lesson'
 *      cycleLength = 1
 *      pricePerSession = group.pricePerSession || 300
 *      amountDue = pricePerSession
 * 
 *    - Mode 2: Package Cycle (دفع بالدورة كل 4 أو 8 حصص): group.paymentCycle === 'monthly' or package
 *      cycleLength = group.sessionCount || 4
 *      amountDue = group.monthlyPackagePrice || (group.pricePerSession ? group.pricePerSession * cycleLength : 2400)
 *      pricePerSession = Math.round(amountDue / (cycleLength || 1))
 * 
 * 2. Explicit Student Override (individual student or custom bundle with price):
 *    - If student has custom bundle with custom price, use student's custom settings.
 *    - If student without group has paymentPlan === 'per_lesson', cycleLength = 1.
 * 
 * 3. Fallback (Individual student without group):
 *    - Use student-level plan or defaults.
 */
export const getStudentCyclePricing = (
  student: Student,
  group?: Group
): CyclePricingResult => {
  // 1. Group settings take precedence whenever a student belongs to a group
  // UNLESS the student has an explicit custom bundle override with a custom price
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
    (p.studentId === studentId || (!!studentName && p.studentName === studentName)) && 
    p.status === 'paid'
  );
  const advancePayments = activePayments.filter(p => 
    p.paymentType === 'advance_payment' || (p.bundleSize && p.bundleSize > 0 && p.notes?.includes('مقدم'))
  );
  
  const totalAdvanceLessons = advancePayments.reduce((sum, p) => sum + Math.max(0, Number(p.bundleSize) || 0), 0);
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

export interface AdvanceFifoAllocationInput {
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  numberOfLessons: number;
  amount: number;
  accountId?: string;
  notes?: string;
  todayStr?: string;
  paymentId?: string;
}

export interface AdvanceFifoAllocationResult {
  updatedPayments: PaymentRecord[];
  fullySettledLessonIds: string[];
  allocatedToDebtAmount: number;
  excessAdvanceAmount: number;
  excessAdvanceLessons: number;
  advancePaymentRecord: PaymentRecord | null;
  primaryPaymentRecordId: string;
}

/**
 * P6: Allocates an advance payment across the student's oldest due/pending debts first (FIFO),
 * preserving any unpaid remainder on partially settled debts, and converting ONLY the excess
 * cash amount into prepaid advance lesson credit (`bundleSize` & `advanceAmount`).
 * Never deducts the same money from debt AND counts it again as advance lesson credit.
 */
export const allocateAdvancePaymentFifo = (
  input: AdvanceFifoAllocationInput,
  currentPayments: PaymentRecord[],
  students: Student[],
  groups: Group[],
  lessons: Lesson[],
  wrapMutationFn: <T>(item: T) => T = (x) => x
): AdvanceFifoAllocationResult => {
  const today = input.todayStr || formatLocalDate();
  const safeTotalAmount = Math.max(0, Math.round((Number(input.amount) || 0) * 100) / 100);
  const requestedLessons = Math.max(0, Number(input.numberOfLessons) || 0);
  const student = students.find(s => s.id === input.studentId);
  const group = groups.find(g => g.id === (input.groupId || student?.groupId));
  const pricing = student ? getStudentCyclePricing(student, group) : null;
  const fallbackUnitPrice = pricing?.pricePerSession || group?.pricePerSession || 200;
  const unitPrice = requestedLessons > 0 && safeTotalAmount > 0
    ? (safeTotalAmount / requestedLessons)
    : fallbackUnitPrice;

  // Materialize any due cycles that don't yet have an explicit PaymentRecord in currentPayments
  const currentDueCycles = calculateDuePaymentCycles(students, groups, lessons, currentPayments)
    .filter(c => c.studentId === input.studentId && (c.amountDue || 0) > 0);

  let workingPayments = [...currentPayments];
  const existingRecordIds = new Set(workingPayments.map(p => p.id));

  currentDueCycles.forEach((cycle, idx) => {
    if (!cycle.existingPaymentRecordId || !existingRecordIds.has(cycle.existingPaymentRecordId)) {
      // Determine earliest lesson date for deterministic FIFO sorting
      const cycleLessons = lessons
        .filter(l => cycle.lessonIds.includes(l.id))
        .sort(compareLessonsChronologically);
      const earliestDate = cycleLessons[0]?.date || today;
      const matId = cycle.existingPaymentRecordId || `pay_due_${input.studentId}_${cycleLessons[0]?.id || idx}_${Date.now()}`;
      if (!existingRecordIds.has(matId)) {
        existingRecordIds.add(matId);
        workingPayments.push(wrapMutationFn({
          id: matId,
          studentId: input.studentId,
          studentName: input.studentName || student?.name || 'Schüler',
          groupId: cycle.groupId || input.groupId,
          groupName: cycle.groupName || input.groupName,
          bundleSize: cycle.cycleLength,
          amountDue: cycle.originalAmountDue ?? cycle.amountDue,
          amountPaid: cycle.amountPaid ?? 0,
          discountAmount: cycle.discountAmount ?? 0,
          remainingBalance: cycle.amountDue,
          dueDate: earliestDate,
          status: 'pending',
          lessonDates: cycle.lessonDates,
          lessonIds: cycle.lessonIds,
          paymentType: cycle.cycleLength > 1 ? 'package_bundle' : 'lesson_fee',
          notes: 'استحقاق دورة مكتملة',
          createdAt: `${earliestDate}T00:00:00.000Z`
        } as PaymentRecord));
      }
    }
  });

  // Find all unpaid/pending/partial debt records for this student, sorted oldest-first (FIFO)
  const getRecordRemainingDebt = (p: PaymentRecord): number => {
    const gross = Number(p.amountDue || 0);
    const paid = Number(p.amountPaid || 0);
    const discount = Number(p.discountAmount || 0);
    const computed = Math.max(0, Math.round((gross - paid - discount) * 100) / 100);
    if (typeof p.remainingBalance === 'number' && p.remainingBalance >= 0 && (paid > 0 || discount > 0)) {
      return Math.min(gross, Math.round(p.remainingBalance * 100) / 100);
    }
    return computed;
  };

  const getRecordFifoSortKey = (p: PaymentRecord): string => {
    const realLessonIds = [
      ...(p.lessonIds || []),
      ...(p.lessonId ? [p.lessonId] : [])
    ].filter(id => id && !id.startsWith('virtual_'));
    if (realLessonIds.length > 0) {
      const matched = lessons
        .filter(l => realLessonIds.includes(l.id))
        .sort(compareLessonsChronologically);
      if (matched.length > 0) {
        return `${normalizeDateToISO(matched[0].date) || '9999-99-99'}_${matched[0].time || '00:00'}_${p.id}`;
      }
    }
    const isoDue = normalizeDateToISO(p.dueDate || '') || '9999-99-99';
    return `${isoDue}_${p.createdAt || ''}_${p.id}`;
  };

  const debtIndices = workingPayments
    .map((p, idx) => ({ p, idx, rem: getRecordRemainingDebt(p) }))
    .filter(({ p, rem }) => {
      if (!p || p.deleted || p.studentId !== input.studentId) return false;
      const st = String(p.status || '');
      if (st === 'paid' || st === 'exempted' || p.paymentType === 'exemption' || p.paymentType === 'advance_payment') {
        return false;
      }
      return rem > 0;
    })
    .sort((a, b) => getRecordFifoSortKey(a.p).localeCompare(getRecordFifoSortKey(b.p)));

  let remainingToAllocate = safeTotalAmount;
  let allocatedToDebtAmount = 0;
  const fullySettledLessonIds: string[] = [];
  let firstTouchedPaymentId = '';

  for (const item of debtIndices) {
    if (remainingToAllocate <= 0) break;
    const p = workingPayments[item.idx];
    const debtRem = item.rem;
    const applyAmount = Math.min(remainingToAllocate, debtRem);
    if (applyAmount <= 0) continue;

    remainingToAllocate = Math.max(0, Math.round((remainingToAllocate - applyAmount) * 100) / 100);
    allocatedToDebtAmount = Math.round((allocatedToDebtAmount + applyAmount) * 100) / 100;

    const prevPaid = Number(p.amountPaid || 0);
    const discount = Number(p.discountAmount || 0);
    const newPaid = Math.round((prevPaid + applyAmount) * 100) / 100;
    const newRem = Math.max(0, Math.round((Number(p.amountDue || 0) - discount - newPaid) * 100) / 100);
    const isNowFullyPaid = newRem === 0;

    if (!firstTouchedPaymentId) {
      firstTouchedPaymentId = p.id;
    }

    if (isNowFullyPaid) {
      const realIds = [
        ...(p.lessonIds || []),
        ...(p.lessonId ? [p.lessonId] : [])
      ].filter(id => id && !id.startsWith('virtual_'));
      realIds.forEach(id => {
        if (!fullySettledLessonIds.includes(id)) fullySettledLessonIds.push(id);
      });
    }

    workingPayments[item.idx] = wrapMutationFn({
      ...p,
      amountPaid: newPaid,
      remainingBalance: newRem,
      status: isNowFullyPaid ? 'paid' : 'partial',
      paidDate: isNowFullyPaid ? today : (p.paidDate || today),
      financeAccountId: input.accountId || p.financeAccountId,
      notes: isNowFullyPaid
        ? `${p.notes || ''} (تمت التسوية بسداد مقدم)`.trim()
        : `${p.notes || ''} (سداد جزئي من دفعة مقدمة: ${applyAmount})`.trim()
    } as PaymentRecord);
  }

  const excessAdvanceAmount = Math.max(0, Math.round((safeTotalAmount - allocatedToDebtAmount) * 100) / 100);
  const excessAdvanceLessons = excessAdvanceAmount > 0 && unitPrice > 0
    ? Math.max(0, Math.floor((excessAdvanceAmount + 0.0001) / unitPrice))
    : 0;

  const finalPaymentId = input.paymentId || `pay_adv_${input.studentId}_${Date.now()}`;
  let advancePaymentRecord: PaymentRecord | null = null;

  // Create an advance_payment credit record ONLY if there is excess cash after FIFO debt allocation
  if (excessAdvanceAmount > 0) {
    advancePaymentRecord = wrapMutationFn({
      id: finalPaymentId,
      studentId: input.studentId,
      studentName: input.studentName,
      groupId: input.groupId,
      groupName: input.groupName,
      amountDue: excessAdvanceAmount,
      amountPaid: excessAdvanceAmount,
      advanceAmount: excessAdvanceAmount,
      remainingBalance: 0,
      dueDate: today,
      paidDate: today,
      status: 'paid',
      paymentType: 'advance_payment',
      bundleSize: excessAdvanceLessons,
      financeAccountId: input.accountId,
      notes: allocatedToDebtAmount > 0
        ? `${input.notes || 'سداد حصص مقدماً'} (توزيع FIFO: ${allocatedToDebtAmount} للديون المستحقة، والرصيد المقدم المتبقي: ${excessAdvanceAmount} لعدد ${excessAdvanceLessons} حصص)`
        : (input.notes || `سداد حصص مقدماً (عدد ${excessAdvanceLessons} حصص)`),
      lessonDates: [`سداد مقدم (${excessAdvanceLessons} حصص)`],
      lessonIds: [],
      createdAt: new Date().toISOString()
    } as PaymentRecord);
    workingPayments = [advancePaymentRecord, ...workingPayments];
  }

  return {
    updatedPayments: workingPayments,
    fullySettledLessonIds,
    allocatedToDebtAmount,
    excessAdvanceAmount,
    excessAdvanceLessons,
    advancePaymentRecord,
    primaryPaymentRecordId: advancePaymentRecord?.id || firstTouchedPaymentId || finalPaymentId
  };
};

