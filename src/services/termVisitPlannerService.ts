import { 
  SchoolSettings, VisitRecord, Teacher, SchoolPeriodRecord,
  PlannedVisitRecord, TermVisitRequirement, TermVisitPlannerSettings, VisitPlannerStatus
} from '../types';
import { calculatePeriodsTimings, parseTimeToMinutes, getSchoolSettings } from '../utils/schoolUtils';
import { normalizeClassCode } from '../utils/classNormalizer';
import { formatLocalDate } from '../utils/timeUtils';

export interface GenerationResult {
  settings: TermVisitPlannerSettings;
  plannedVisits: PlannedVisitRecord[];
  requirements: TermVisitRequirement[];
  summary: {
    totalRequirements: number;
    completedCount: number;
    plannedCount: number;
    rescheduledCount: number;
    cancelledCount: number;
    unscheduledCount: number;
    coveragePercentage: number;
  };
  conflicts: Array<{ teacherName: string; className: string; reason: string }>;
}

const WEEKDAY_NAMES_AR: Record<string, string> = {
  '0': 'الأحد',
  '1': 'الإثنين',
  '2': 'الثلاثاء',
  '3': 'الأربعاء',
  '4': 'الخميس',
  '5': 'الجمعة',
  '6': 'السبت'
};

const WEEKDAY_NAMES_EN: Record<string, string> = {
  '0': 'Sunday',
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday'
};

/**
 * Gets default term dates if not provided
 */
export function getDefaultTermDates(currentTerm?: string): { startDate: string; endDate: string; term: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  // Default Term 1 (Sep - Jan) or Term 2 (Feb - May)
  let term = currentTerm || 'الفصل الدراسي الأول';
  let startYear = year;
  let endYear = year;

  if (month >= 8 || month <= 0) {
    // Term 1: Sep 15 to Jan 25
    if (month === 0) startYear = year - 1;
    return {
      term,
      startDate: `${startYear}-09-15`,
      endDate: `${endYear}-01-25`
    };
  } else {
    // Term 2: Feb 01 to May 31
    return {
      term: currentTerm || 'الفصل الدراسي الثاني',
      startDate: `${year}-02-01`,
      endDate: `${year}-05-31`
    };
  }
}

/**
 * Helper to normalize class codes for matching (e.g. "5A", "Grade 5 - 5A", "Grade 5")
 */
export function isMatchingClass(classA?: string, classB?: string): boolean {
  if (!classA || !classB) return false;
  const cleanA = classA.trim().toLowerCase();
  const cleanB = classB.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const normA = normalizeClassCode(classA);
  const normB = normalizeClassCode(classB);
  if (normA && normB) {
    return normA.toLowerCase() === normB.toLowerCase();
  }

  return false;
}

/**
 * Main Deterministic Term Visit Schedule Generator & Reconciler
 */
export function generateTermVisitPlan(
  schoolSettingsRaw: SchoolSettings,
  hodLessons: any[] = [],
  customPlannerSettings?: Partial<TermVisitPlannerSettings>
): GenerationResult {
  const schoolSettingsObj = (schoolSettingsRaw as any)?.schoolSettings || schoolSettingsRaw || {};
  const schoolSettings = getSchoolSettings({ schoolSettings: schoolSettingsObj } as any);
  const periodTimings = calculatePeriodsTimings(schoolSettings.periodSettings);
  const periodsCount = periodTimings.length || 7;

  // Preserve arrays and records if directly on schoolSettingsRaw
  const teachers = schoolSettingsRaw?.teachers || schoolSettings.teachers || [];
  const teacherSchedules = schoolSettingsRaw?.teacherSchedules || schoolSettings.teacherSchedules || {};
  
  // Combine all sources of visit records (visitRecords, hodVisits) to ensure zero data loss
  const rawVisits = [
    ...(schoolSettingsRaw?.visitRecords || schoolSettings.visitRecords || []),
    ...((schoolSettingsRaw as any)?.hodVisits || (schoolSettings as any)?.hodVisits || [])
  ];
  const visitMap = new Map<string, any>();
  rawVisits.forEach(v => {
    if (v && typeof v === 'object') {
      const key = v.id || `${v.teacherId || v.teacherName}_${v.className || v.gradeClass}_${v.visitedDate || v.date || v.visitedAt}`;
      visitMap.set(key, v);
    }
  });
  const historicalVisits = Array.from(visitMap.values());
  const customTimedSessions = schoolSettingsRaw?.customTimedSessions || schoolSettings.customTimedSessions || [];

  // 1. Resolve Term & Dates
  const defaultDates = getDefaultTermDates(schoolSettingsRaw?.currentTerm || schoolSettings.currentTerm);
  const existingSettings = schoolSettingsRaw?.termVisitPlannerSettings || schoolSettings.termVisitPlannerSettings;

  const term = customPlannerSettings?.term || existingSettings?.term || defaultDates.term;
  const startDate = customPlannerSettings?.startDate || existingSettings?.startDate || defaultDates.startDate;
  const endDate = customPlannerSettings?.endDate || existingSettings?.endDate || defaultDates.endDate;
  const workingDays = customPlannerSettings?.workingDays || existingSettings?.workingDays || ['0', '1', '2', '3', '4'];
  const visitsPerTeacherPerClass = customPlannerSettings?.visitsPerTeacherPerClass || existingSettings?.visitsPerTeacherPerClass || 1;

  // 2. Identify All Teachers & Their Assigned Classes/Sections
  const activeTeachers = teachers.filter(t => t.isActive && !t.isHod);

  // Build requirements for each teacher + class pair
  const requirementsMap = new Map<string, TermVisitRequirement>();

  activeTeachers.forEach(teacher => {
    const tSchedule = teacherSchedules[teacher.id] || {};
    const classesSet = new Set<string>();

    // Check standard teacher schedule
    Object.keys(tSchedule).forEach(dayKey => {
      const records = tSchedule[dayKey] || [];
      records.forEach(rec => {
        if (rec.className && rec.className.trim()) {
          classesSet.add(rec.className.trim());
        }
      });
    });

    // Check custom timed sessions for teacher
    customTimedSessions.forEach(cs => {
      if (cs.teacherId === teacher.id && cs.className && cs.className.trim()) {
        classesSet.add(cs.className.trim());
      }
    });

    // Create a requirement item per teacher-class
    classesSet.forEach(className => {
      const reqId = `req_${teacher.id}_${className.replace(/\s+/g, '_')}`;
      requirementsMap.set(reqId, {
        id: reqId,
        teacherId: teacher.id,
        teacherName: teacher.name,
        gradeClass: className,
        requiredVisitsCount: visitsPerTeacherPerClass,
        completedVisitsCount: 0,
        plannedVisitsCount: 0,
        isSatisfied: false,
        availableSlotCount: 0
      });
    });
  });

  // 3. Reconcile Historical Visit Records (Source of Truth)
  const termVisits = historicalVisits.filter(v => {
    if (!v) return false;

    // Exclude cancelled visits
    const statusLower = ((v as any).status || '').toString().toLowerCase();
    if (statusLower.includes('cancel') || statusLower.includes('ملغ')) return false;

    const vDate = v.visitedDate || v.date || v.visitedAt || (v as any).createdAt;

    // Term name check (flexible)
    const vTermClean = (v.term || '').toString().trim().toLowerCase();
    const currentTermClean = (term || '').toString().trim().toLowerCase();
    const matchesTermName = !v.term || 
                            vTermClean === currentTermClean || 
                            vTermClean.includes('term') || 
                            vTermClean.includes('الفصل') || 
                            currentTermClean.includes('term');

    // Date range check
    let withinTermDates = true;
    if (vDate) {
      const dateStr = String(vDate).split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        withinTermDates = dateStr >= startDate && dateStr <= endDate;
      }
    }

    return matchesTermName || withinTermDates;
  });

  // Mark completed requirements
  termVisits.forEach(v => {
    const vClass = v.className || v.gradeClass || v.class;
    const vTeacherId = v.teacherId;
    const vTeacherName = (v.teacherName || '').toString().trim().toLowerCase();

    requirementsMap.forEach(req => {
      const reqTeacherName = (req.teacherName || '').toString().trim().toLowerCase();
      const teacherMatches = (vTeacherId && req.teacherId === vTeacherId) || 
                             (vTeacherName && reqTeacherName && (
                               vTeacherName === reqTeacherName || 
                               vTeacherName.includes(reqTeacherName) || 
                               reqTeacherName.includes(vTeacherName)
                             ));

      if (teacherMatches && isMatchingClass(req.gradeClass, vClass)) {
        req.completedVisitsCount += 1;
        if (req.completedVisitsCount >= req.requiredVisitsCount) {
          req.isSatisfied = true;
        }
      }
    });
  });

  // 4. Build List of Term Working Dates
  const termDates: Array<{ dateStr: string; dayKey: string; weekIndex: number }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
    const curr = new Date(start);
    let weekCounter = 0;
    let prevWeekNum = -1;

    while (curr <= end) {
      const dayKey = curr.getDay().toString();
      const dateStr = formatLocalDate(curr);

      // Track calendar week index
      const jan1 = new Date(curr.getFullYear(), 0, 1);
      const weekNum = Math.ceil((((curr.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7);
      if (prevWeekNum !== -1 && weekNum !== prevWeekNum) {
        weekCounter++;
      }
      prevWeekNum = weekNum;

      if (workingDays.includes(dayKey)) {
        termDates.push({ dateStr, dayKey, weekIndex: weekCounter });
      }

      curr.setDate(curr.getDate() + 1);
    }
  }

  // 5. Build HOD Busy Slots Set: `${dateStr}_${periodNumber}`
  const hodBusySlots = new Set<string>();
  const hodSchedule = schoolSettingsRaw?.schedule || schoolSettings.schedule || {};

  termDates.forEach(({ dateStr, dayKey }) => {
    // Master schedule HOD periods
    const dayRecords = hodSchedule[dayKey] || [];
    dayRecords.forEach(rec => {
      if (rec.subjectName || rec.className) {
        // HOD is teaching
        hodBusySlots.add(`${dateStr}_${rec.periodNumber}`);
      }
    });

    // Active App lessons for HOD on this date
    (hodLessons || []).forEach(l => {
      if (l.date === dateStr && l.time && l.status !== 'cancelled') {
        const [lHrs, lMins] = l.time.split(':').map(Number);
        if (!isNaN(lHrs) && !isNaN(lMins)) {
          const lTotalMin = lHrs * 60 + lMins;
          periodTimings.forEach(p => {
            const pStart = parseTimeToMinutes(p.startTime);
            const pEnd = parseTimeToMinutes(p.endTime);
            if (lTotalMin >= pStart - 10 && lTotalMin < pEnd) {
              hodBusySlots.add(`${dateStr}_${p.periodNumber}`);
            }
          });
        }
      }
    });

    // Custom timed sessions for HOD
    customTimedSessions.forEach(cs => {
      if (cs.dayKey === dayKey && (!cs.teacherId || cs.teacherId === 'hod')) {
        const startMin = parseTimeToMinutes(cs.startTime);
        periodTimings.forEach(p => {
          const pStart = parseTimeToMinutes(p.startTime);
          const pEnd = parseTimeToMinutes(p.endTime);
          if (startMin >= pStart - 10 && startMin < pEnd) {
            hodBusySlots.add(`${dateStr}_${p.periodNumber}`);
          }
        });
      }
    });
  });

  // 6. Map Teacher Teaching Slots: `${teacherId}_${dayKey}_${periodNumber}` => `className`
  const teacherTeachingMap = new Map<string, string>(); // key: `${teacherId}_${dayKey}_${periodNumber}`, val: className

  Object.keys(teacherSchedules).forEach(teacherId => {
    const tSched = teacherSchedules[teacherId] || {};
    Object.keys(tSched).forEach(dayKey => {
      const records = tSched[dayKey] || [];
      records.forEach(rec => {
        if (rec.className && rec.className.trim()) {
          teacherTeachingMap.set(`${teacherId}_${dayKey}_${rec.periodNumber}`, rec.className.trim());
        }
      });
    });
  });

  // Add custom timed sessions for teachers
  customTimedSessions.forEach(cs => {
    if (cs.teacherId && cs.className) {
      const startMin = parseTimeToMinutes(cs.startTime);
      periodTimings.forEach(p => {
        const pStart = parseTimeToMinutes(p.startTime);
        const pEnd = parseTimeToMinutes(p.endTime);
        if (startMin >= pStart - 10 && startMin < pEnd) {
          teacherTeachingMap.set(`${cs.teacherId}_${cs.dayKey}_${p.periodNumber}`, cs.className.trim());
        }
      });
    }
  });

  // 7. Find Candidate Slots for Each Unsatisfied Requirement
  const candidateSlotsMap = new Map<string, Array<{ dateStr: string; dayKey: string; periodNumber: number; weekIndex: number }>>();

  requirementsMap.forEach(req => {
    if (req.isSatisfied) return;

    const slots: Array<{ dateStr: string; dayKey: string; periodNumber: number; weekIndex: number }> = [];

    termDates.forEach(({ dateStr, dayKey, weekIndex }) => {
      for (let pNum = 1; pNum <= periodsCount; pNum++) {
        const slotKey = `${dateStr}_${pNum}`;
        // Must NOT be HOD busy
        if (hodBusySlots.has(slotKey)) continue;

        // Teacher MUST be teaching this exact class at this dayKey & periodNumber
        const taughtClass = teacherTeachingMap.get(`${req.teacherId}_${dayKey}_${pNum}`);
        if (taughtClass && isMatchingClass(taughtClass, req.gradeClass)) {
          slots.push({ dateStr, dayKey, periodNumber: pNum, weekIndex });
        }
      }
    });

    req.availableSlotCount = slots.length;
    candidateSlotsMap.set(req.id, slots);
  });

  // 8. Deterministic Constrained-First Scheduling
  const plannedVisits: PlannedVisitRecord[] = [];
  const conflicts: Array<{ teacherName: string; className: string; reason: string }> = [];

  // Convert unsatisfied requirements to array and sort by candidate slot count (ascending)
  const unsatisfiedReqs = Array.from(requirementsMap.values())
    .filter(req => !req.isSatisfied)
    .sort((a, b) => a.availableSlotCount - b.availableSlotCount);

  // Track planned visits per week to distribute evenly across term
  const visitsPerWeekCount = new Map<number, number>();

  unsatisfiedReqs.forEach(req => {
    const candidateSlots = candidateSlotsMap.get(req.id) || [];

    if (candidateSlots.length === 0) {
      req.conflictReason = 'لا يوجد أوقات تقاطع بين جدول المعلم المتاح وجدول رئيس القسم بدون تعارض';
      conflicts.push({
        teacherName: req.teacherName,
        className: req.gradeClass,
        reason: req.conflictReason
      });
      return;
    }

    // Filter slots that are still available (not taken by another visit scheduled earlier)
    const availableSlots = candidateSlots.filter(s => !hodBusySlots.has(`${s.dateStr}_${s.periodNumber}`));

    if (availableSlots.length === 0) {
      req.conflictReason = 'تم حجز جميع الفترات المتاحة لهذا المعلم لزيارات معلمين آخرين';
      conflicts.push({
        teacherName: req.teacherName,
        className: req.gradeClass,
        reason: req.conflictReason
      });
      return;
    }

    // Pick best slot: prefer week with lowest current visits count to balance across term
    availableSlots.sort((a, b) => {
      const countA = visitsPerWeekCount.get(a.weekIndex) || 0;
      const countB = visitsPerWeekCount.get(b.weekIndex) || 0;
      if (countA !== countB) return countA - countB;
      // If same week count, pick earlier date
      return a.dateStr.localeCompare(b.dateStr);
    });

    const chosenSlot = availableSlots[0];
    const slotKey = `${chosenSlot.dateStr}_${chosenSlot.periodNumber}`;

    // Mark slot as busy for HOD
    hodBusySlots.add(slotKey);
    visitsPerWeekCount.set(chosenSlot.weekIndex, (visitsPerWeekCount.get(chosenSlot.weekIndex) || 0) + 1);

    const pTiming = periodTimings.find(p => p.periodNumber === chosenSlot.periodNumber);

    const newVisit: PlannedVisitRecord = {
      id: `plan_${req.teacherId}_${chosenSlot.dateStr}_${chosenSlot.periodNumber}`,
      term,
      teacherId: req.teacherId,
      teacherName: req.teacherName,
      gradeClass: req.gradeClass,
      date: chosenSlot.dateStr,
      dayKey: chosenSlot.dayKey,
      weekdayNameAr: WEEKDAY_NAMES_AR[chosenSlot.dayKey],
      weekdayNameEn: WEEKDAY_NAMES_EN[chosenSlot.dayKey],
      periodNumber: chosenSlot.periodNumber,
      startTime: pTiming?.startTime,
      endTime: pTiming?.endTime,
      status: 'planned',
      notes: `زيارة صفية مجدولة - ${req.gradeClass}`
    };

    plannedVisits.push(newVisit);
    req.plannedVisitsCount += 1;
  });

  // Add historical completed visits to the plannedVisits array as 'completed'
  termVisits.forEach(v => {
    const dayObj = new Date(v.visitedDate);
    const dayKey = !isNaN(dayObj.getTime()) ? dayObj.getDay().toString() : '0';
    const pNum = Number(v.periodNumber) || 1;
    const pTiming = periodTimings.find(p => p.periodNumber === pNum);

    plannedVisits.push({
      id: `completed_${v.id}`,
      term,
      teacherId: v.teacherId,
      teacherName: v.teacherName,
      gradeClass: v.className,
      date: v.visitedDate,
      dayKey,
      weekdayNameAr: WEEKDAY_NAMES_AR[dayKey],
      weekdayNameEn: WEEKDAY_NAMES_EN[dayKey],
      periodNumber: pNum,
      startTime: pTiming?.startTime,
      endTime: pTiming?.endTime,
      status: 'completed',
      actualVisitRecordId: v.id,
      notes: `زيارة مكتملة - التقييم: ${v.overallCategory || 'مكتمل'}`
    });
  });

  // Sort visits chronologically
  plannedVisits.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.periodNumber - b.periodNumber;
  });

  // 9. Calculate Final Summary KPIs
  const totalRequirements = Array.from(requirementsMap.values()).length;
  const completedCount = Array.from(requirementsMap.values()).filter(r => r.isSatisfied).length;
  const plannedCount = plannedVisits.filter(v => v.status === 'planned' || v.status === 'rescheduled').length;
  const unscheduledCount = Array.from(requirementsMap.values()).filter(r => !r.isSatisfied && r.plannedVisitsCount === 0).length;

  const coveragePercentage = totalRequirements > 0 
    ? Math.round((completedCount / totalRequirements) * 100) 
    : 100;

  const updatedSettings: TermVisitPlannerSettings = {
    term,
    startDate,
    endDate,
    workingDays,
    visitsPerTeacherPerClass,
    plannedVisits,
    requirements: Array.from(requirementsMap.values()),
    lastGeneratedAt: existingSettings?.lastGeneratedAt || new Date().toISOString()
  };

  return {
    settings: updatedSettings,
    plannedVisits,
    requirements: Array.from(requirementsMap.values()),
    summary: {
      totalRequirements,
      completedCount,
      plannedCount,
      rescheduledCount: plannedVisits.filter(v => v.status === 'rescheduled').length,
      cancelledCount: plannedVisits.filter(v => v.status === 'cancelled').length,
      unscheduledCount,
      coveragePercentage
    },
    conflicts
  };
}
