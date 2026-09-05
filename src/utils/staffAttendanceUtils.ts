import { 
  StaffAttendanceRecord, 
  StaffAttendanceType, 
  Teacher, 
  SchoolSettings, 
  StageManager, 
  StageSecretary 
} from '../types';

/**
 * Calculates delay in minutes between scheduled and actual arrival time (HH:MM).
 */
export function calculateDelayMinutes(scheduled: string, actual: string): number {
  if (!scheduled || !actual) return 0;
  const [sH, sM] = scheduled.split(':').map(Number);
  const [aH, aM] = actual.split(':').map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(aH) || isNaN(aM)) return 0;

  const scheduledTotal = sH * 60 + sM;
  const actualTotal = aH * 60 + aM;
  const diff = actualTotal - scheduledTotal;
  return diff > 0 ? diff : 0;
}

/**
 * Calculates lost minutes between scheduled departure and actual early leave time (HH:MM).
 */
export function calculateLostMinutes(scheduled: string, actual: string): number {
  if (!scheduled || !actual) return 0;
  const [sH, sM] = scheduled.split(':').map(Number);
  const [aH, aM] = actual.split(':').map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(aH) || isNaN(aM)) return 0;

  const scheduledTotal = sH * 60 + sM;
  const actualTotal = aH * 60 + aM;
  const diff = scheduledTotal - actualTotal;
  return diff > 0 ? diff : 0;
}

/**
 * Calculates teacher discipline score out of 100 based on infractions.
 */
export function calculateTeacherDisciplineScore(records: StaffAttendanceRecord[]): number {
  const activeRecords = records.filter(r => !r.deleted);
  if (activeRecords.length === 0) return 100;

  let score = 100;
  for (const r of activeRecords) {
    if (r.type === 'absence') {
      if (r.absenceScope === 'lesson_based') {
        score -= r.absenceStatus === 'unexcused' ? 8 : 3;
      } else {
        score -= r.absenceStatus === 'unexcused' ? 15 : 5;
      }
    } else if (r.type === 'late_arrival') {
      const delay = r.delayMinutes || 0;
      score -= Math.min(15, 3 + Math.floor(delay / 15) * 2);
    } else if (r.type === 'early_leave') {
      const lost = r.lostMinutes || 0;
      score -= Math.min(15, 3 + Math.floor(lost / 20) * 2);
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Standard stages in the education system.
 */
export const SYSTEM_STAGES = [
  { id: 'KG', nameAr: 'رياض أطفال (KG)', nameEn: 'Kindergarten (KG)' },
  { id: 'Primary', nameAr: 'المرحلة الابتدائية', nameEn: 'Primary Stage' },
  { id: 'Prep', nameAr: 'المرحلة الإعدادية', nameEn: 'Preparatory Stage' },
  { id: 'Secondary', nameAr: 'المرحلة الثانوية', nameEn: 'Secondary Stage' }
];

/**
 * Infers or returns the stage name for a given teacher based on existing system data.
 */
export function getTeacherStageName(
  teacher: Teacher, 
  schoolSettings?: SchoolSettings, 
  matchedManager?: StageManager
): string {
  if (teacher.stage) return teacher.stage;

  if (matchedManager?.gradeBand) {
    const band = matchedManager.gradeBand.toLowerCase();
    if (band.includes('kg') || band.includes('kindergarten')) return 'KG';
    if (band.includes('1–3') || band.includes('1-3') || band.includes('4–6') || band.includes('4-6') || band.includes('prim')) return 'Primary';
    if (band.includes('7–9') || band.includes('7-9') || band.includes('prep')) return 'Prep';
    if (band.includes('10–12') || band.includes('10-12') || band.includes('sec')) return 'Secondary';
    return matchedManager.gradeBand;
  }

  const classes = (teacher as any).assignedClasses || [];
  for (const c of classes) {
    const str = String(c).toLowerCase();
    if (str.includes('kg')) return 'KG';
    if (/\b([1-6])\b|prim|p[1-6]/i.test(str)) return 'Primary';
    if (/\b([7-9])\b|prep|m[1-3]/i.test(str)) return 'Prep';
    if (/\b(1[0-2])\b|sec|g1[0-2]/i.test(str)) return 'Secondary';
  }

  return 'Primary';
}

/**
 * Finds the Stage Secretary linked to a teacher or stage.
 */
export function getStageSecretary(
  stageName: string, 
  schoolSettings: SchoolSettings, 
  stageManagerId?: string
): StageSecretary | null {
  const secretaries = schoolSettings.stageSecretaries || [];
  if (secretaries.length === 0) return null;

  if (stageManagerId) {
    const found = secretaries.find(s => s.stageManagerId === stageManagerId);
    if (found) return found;
  }

  const managers = schoolSettings.stageManagers || [];
  const matchedManager = managers.find(m => {
    const band = (m.gradeBand || '').toLowerCase();
    if (stageName === 'KG' && band.includes('kg')) return true;
    if (stageName === 'Primary' && (band.includes('1–3') || band.includes('4–6') || band.includes('prim'))) return true;
    if (stageName === 'Prep' && (band.includes('7–9') || band.includes('prep'))) return true;
    if (stageName === 'Secondary' && (band.includes('10–12') || band.includes('sec'))) return true;
    return false;
  });

  if (matchedManager) {
    const found = secretaries.find(s => s.stageManagerId === matchedManager.id);
    if (found) return found;
  }

  return secretaries[0] || null;
}

export interface ReplacementAssignment {
  periodNumber: number;
  className: string;
  replacementTeacherId?: string;
  replacementTeacherName?: string;
}

/**
 * Checks whether a teacher is busy with a class during a specific period on a specific dayKey.
 */
export function isTeacherBusyInPeriod(
  teacherId: string,
  dayKey: string,
  periodNumber: number,
  schoolSettings?: SchoolSettings
): { isBusy: boolean; busyClassName?: string } {
  if (!schoolSettings || !teacherId) return { isBusy: false };

  const schedules = teacherId === 'hod'
    ? schoolSettings.schedule
    : schoolSettings.teacherSchedules?.[teacherId];

  const daySchedule = schedules?.[dayKey] || [];
  const found = daySchedule.find(
    (l: any) => l && Number(l.periodNumber) === Number(periodNumber) && (l.className || l.subjectName)
  );

  if (found) {
    return {
      isBusy: true,
      busyClassName: found.className || found.subjectName || 'حصة مجدولة'
    };
  }

  return { isBusy: false };
}

/**
 * Automatically suggests replacement teachers for the absent teacher's periods.
 * - Respects each candidate teacher's schedule to avoid period conflicts.
 * - Distributes replacement classes fairly among available teachers (one period each where possible).
 */
export function autoSuggestReplacements(
  absentTeacherId: string,
  dayKey: string,
  periods: Array<{ periodNumber: number; className: string }>,
  teachers: Teacher[],
  schoolSettings?: SchoolSettings
): ReplacementAssignment[] {
  const eligibleTeachers = (teachers || []).filter(
    t => t.id !== absentTeacherId && t.isActive !== false
  );

  const assignedCounts = new Map<string, number>();
  eligibleTeachers.forEach(t => assignedCounts.set(t.id, 0));

  return (periods || []).map(p => {
    // Find teachers who do not have a conflict in this period
    const available = eligibleTeachers.filter(t => {
      const { isBusy } = isTeacherBusyInPeriod(t.id, dayKey, p.periodNumber, schoolSettings);
      return !isBusy;
    });

    if (available.length === 0) {
      return {
        periodNumber: p.periodNumber,
        className: p.className,
        replacementTeacherId: '',
        replacementTeacherName: ''
      };
    }

    // Sort by fewest replacement assignments already given today
    available.sort((a, b) => {
      const countA = assignedCounts.get(a.id) || 0;
      const countB = assignedCounts.get(b.id) || 0;
      return countA - countB;
    });

    const chosen = available[0];
    assignedCounts.set(chosen.id, (assignedCounts.get(chosen.id) || 0) + 1);

    return {
      periodNumber: p.periodNumber,
      className: p.className,
      replacementTeacherId: chosen.id,
      replacementTeacherName: chosen.name
    };
  });
}

/**
 * Formats the absence replacement message exactly as requested by the user:
 * 
 * صباح الخير.....
 * النهاردة في غياب [اسم المدرس]
 * الاحتياطي هيبقى
 * [الفصل و رقم الحصة و جنبها المدرس إللي هيعوض مكان إللي غايب أو لو مفيش سيبها فاضية]
 */
export function formatAbsenceReplacementMessage(
  teacherName: string,
  replacements: ReplacementAssignment[]
): string {
  let msg = `صباح الخير.....\nالنهاردة في غياب ${teacherName || ''}\nالاحتياطي هيبقى\n`;

  if (!replacements || replacements.length === 0) {
    msg += `(لا توجد حصص مسجلة اليوم)`;
    return msg;
  }

  const lines = replacements.map(r => {
    const classStr = r.className ? `فصل ${r.className}` : '';
    const periodStr = `الحصة ${r.periodNumber}`;
    const prefix = [classStr, periodStr].filter(Boolean).join(' - ');
    const substitute = (r.replacementTeacherName || '').trim();

    if (substitute) {
      return `${prefix}: ${substitute}`;
    } else {
      return `${prefix}:`;
    }
  });

  msg += lines.join('\n');
  return msg;
}

/**
 * Formats notification messages for the Stage Secretary according to requirements:
 * Example 1: تم تسجيل غياب للمدرس أحمد محمد بتاريخ 03/09/2026.
 * Example 2: تم تسجيل تأخير صباحي للمدرس أحمد محمد بمقدار 20 دقيقة.
 * Example 3: تم تسجيل انصراف مبكر للمدرس أحمد محمد بمقدار 90 دقيقة.
 */
export function formatSecretaryNotification(
  type: StaffAttendanceType, 
  teacherName: string, 
  dateStr: string, 
  minutes?: number
): string {
  const [y, m, d] = dateStr.split('-');
  const formattedDate = d && m && y ? `${d}/${m}/${y}` : dateStr;

  if (type === 'absence') {
    return `تم تسجيل غياب للمدرس ${teacherName} بتاريخ ${formattedDate}.`;
  }
  if (type === 'late_arrival') {
    return `تم تسجيل تأخير صباحي للمدرس ${teacherName} بمقدار ${minutes || 0} دقيقة.`;
  }
  if (type === 'early_leave') {
    return `تم تسجيل انصراف مبكر للمدرس ${teacherName} بمقدار ${minutes || 0} دقيقة.`;
  }
  return `تم تسجيل ملاحظة انضباط للمدرس ${teacherName} بتاريخ ${formattedDate}.`;
}

/**
 * Checks if a date string (YYYY-MM-DD) falls within the current week (Mon-Sun or Sun-Sat).
 */
export function isDateInCurrentWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return false;

  const now = new Date();
  const day = now.getDay();
  // Saturday/Sunday adjust: start week on Saturday or Sunday
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return target >= startOfWeek && target <= endOfWeek;
}

/**
 * Checks if a date string falls within the current month.
 */
export function isDateInCurrentMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return false;
  const now = new Date();
  return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
}

export interface TeacherAttendanceStats {
  teacherId: string;
  teacherName: string;
  stageName: string;
  absences: number;
  unexcusedAbsences: number;
  excusedAbsences: number;
  lessonAbsences: number;
  lateArrivals: number;
  earlyLeaves: number;
  delayMinutes: number;
  lostMinutes: number;
  totalViolations: number;
  disciplineScore: number;
  records: StaffAttendanceRecord[];
}

export interface StaffAttendanceMetrics {
  // Weekly Metrics (for HOD Dashboard Compact Card)
  absencesThisWeek: number;
  lateArrivalsThisWeek: number;
  earlyLeavesThisWeek: number;
  teachersWithViolationsCount: number;
  averageAttendanceRate: number; // e.g. 96.5

  // Overall / Filtered Period Metrics
  totalAbsences: number;
  totalLateArrivals: number;
  totalEarlyLeaves: number;
  totalDelayMinutes: number;
  totalLostHours: number;

  // Rankings
  teacherStats: TeacherAttendanceStats[];
  mostAbsentTeachers: { name: string; count: number }[];
  mostLateTeachers: { name: string; minutes: number; count: number }[];
  mostEarlyLeaveTeachers: { name: string; minutes: number; count: number }[];
}

/**
 * Computes full attendance and discipline metrics for HOD Dashboard, Weekly & Monthly Reports.
 */
export function calculateStaffAttendanceMetrics(
  allRecords: StaffAttendanceRecord[],
  teachers: Teacher[],
  schoolSettings: SchoolSettings,
  filterRange: 'this_week' | 'this_month' | 'all' = 'all',
  stageFilter: string = 'all'
): StaffAttendanceMetrics {
  const activeRecords = (allRecords || []).filter(r => !r.deleted);

  // Filter records by time period
  const filteredRecords = activeRecords.filter(r => {
    if (stageFilter !== 'all' && r.stageName && r.stageName !== stageFilter) {
      return false;
    }
    if (filterRange === 'this_week') {
      return isDateInCurrentWeek(r.date);
    }
    if (filterRange === 'this_month') {
      return isDateInCurrentMonth(r.date);
    }
    return true;
  });

  // Calculate current week metrics specifically for the compact card
  const thisWeekRecords = activeRecords.filter(r => isDateInCurrentWeek(r.date));
  const weekAbsences = thisWeekRecords.filter(r => r.type === 'absence').length;
  const weekLate = thisWeekRecords.filter(r => r.type === 'late_arrival').length;
  const weekEarly = thisWeekRecords.filter(r => r.type === 'early_leave').length;
  const weekViolatorsSet = new Set(thisWeekRecords.map(r => r.teacherId));
  const weekTeachersWithViolations = weekViolatorsSet.size;

  // Average attendance rate estimation
  const totalActiveTeachers = Math.max(1, teachers.filter(t => t.isActive).length);
  // Assuming 5 working days a week per teacher:
  const possibleDays = totalActiveTeachers * 5;
  const attendedDays = Math.max(0, possibleDays - weekAbsences);
  const rawRate = (attendedDays / possibleDays) * 100;
  const averageAttendanceRate = Math.min(100, Math.max(0, Math.round(rawRate * 10) / 10));

  // Period stats per teacher
  const statsMap = new Map<string, TeacherAttendanceStats>();

  // Initialize for all teachers
  teachers.forEach(t => {
    if (stageFilter !== 'all' && t.stage && t.stage !== stageFilter) return;
    statsMap.set(t.id, {
      teacherId: t.id,
      teacherName: t.name,
      stageName: t.stage || getTeacherStageName(t, schoolSettings),
      absences: 0,
      unexcusedAbsences: 0,
      excusedAbsences: 0,
      lessonAbsences: 0,
      lateArrivals: 0,
      earlyLeaves: 0,
      delayMinutes: 0,
      lostMinutes: 0,
      totalViolations: 0,
      disciplineScore: 100,
      records: []
    });
  });

  let totalAbsences = 0;
  let totalLateArrivals = 0;
  let totalEarlyLeaves = 0;
  let totalDelayMinutes = 0;
  let totalLostMinutes = 0;

  filteredRecords.forEach(r => {
    let stat = statsMap.get(r.teacherId);
    if (!stat) {
      stat = {
        teacherId: r.teacherId,
        teacherName: r.teacherName,
        stageName: r.stageName || 'Primary',
        absences: 0,
        unexcusedAbsences: 0,
        excusedAbsences: 0,
        lessonAbsences: 0,
        lateArrivals: 0,
        earlyLeaves: 0,
        delayMinutes: 0,
        lostMinutes: 0,
        totalViolations: 0,
        disciplineScore: 100,
        records: []
      };
      statsMap.set(r.teacherId, stat);
    }

    stat.records.push(r);
    stat.totalViolations += 1;

    if (r.type === 'absence') {
      totalAbsences += 1;
      stat.absences += 1;
      if (r.absenceScope === 'lesson_based') {
        stat.lessonAbsences += 1;
      }
      if (r.absenceStatus === 'unexcused') {
        stat.unexcusedAbsences += 1;
      } else {
        stat.excusedAbsences += 1;
      }
    } else if (r.type === 'late_arrival') {
      totalLateArrivals += 1;
      stat.lateArrivals += 1;
      const delay = r.delayMinutes || 0;
      stat.delayMinutes += delay;
      totalDelayMinutes += delay;
    } else if (r.type === 'early_leave') {
      totalEarlyLeaves += 1;
      stat.earlyLeaves += 1;
      const lost = r.lostMinutes || 0;
      stat.lostMinutes += lost;
      totalLostMinutes += lost;
    }
  });

  // Calculate discipline score for each teacher based on their records
  statsMap.forEach(stat => {
    stat.disciplineScore = calculateTeacherDisciplineScore(stat.records);
  });

  // Sort teachers by total violations descending (Requirement 6: مع ترتيب المدرسين حسب عدد المخالفات)
  const teacherStats = Array.from(statsMap.values()).sort((a, b) => {
    if (b.totalViolations !== a.totalViolations) {
      return b.totalViolations - a.totalViolations;
    }
    return a.disciplineScore - b.disciplineScore;
  });

  const totalLostHours = Math.round(((totalDelayMinutes + totalLostMinutes) / 60) * 10) / 10;

  // Monthly Rankings (Requirement 7)
  const mostAbsentTeachers = teacherStats
    .filter(t => t.absences > 0)
    .sort((a, b) => b.absences - a.absences)
    .slice(0, 5)
    .map(t => ({ name: t.teacherName, count: t.absences }));

  const mostLateTeachers = teacherStats
    .filter(t => t.lateArrivals > 0)
    .sort((a, b) => b.delayMinutes - a.delayMinutes)
    .slice(0, 5)
    .map(t => ({ name: t.teacherName, minutes: t.delayMinutes, count: t.lateArrivals }));

  const mostEarlyLeaveTeachers = teacherStats
    .filter(t => t.earlyLeaves > 0)
    .sort((a, b) => b.lostMinutes - a.lostMinutes)
    .slice(0, 5)
    .map(t => ({ name: t.teacherName, minutes: t.lostMinutes, count: t.earlyLeaves }));

  return {
    absencesThisWeek: weekAbsences,
    lateArrivalsThisWeek: weekLate,
    earlyLeavesThisWeek: weekEarly,
    teachersWithViolationsCount: weekTeachersWithViolations,
    averageAttendanceRate,
    totalAbsences,
    totalLateArrivals,
    totalEarlyLeaves,
    totalDelayMinutes,
    totalLostHours,
    teacherStats,
    mostAbsentTeachers,
    mostLateTeachers,
    mostEarlyLeaveTeachers
  };
}
