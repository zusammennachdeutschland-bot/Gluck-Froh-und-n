import { SchoolSettings, SchoolPeriodSettings, SchoolPeriodRecord, TeacherProfile, CustomTimedSession } from '../types';

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  presence: {
    '0': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
    '1': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
    '2': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
    '3': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
    '4': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
    '5': { active: false, arrivalTime: '07:30', departureTime: '14:30' },
    '6': { active: false, arrivalTime: '07:30', departureTime: '14:30' }
  },
  periodSettings: {
    periodsCount: 7,
    firstPeriodStart: '08:00',
    defaultDuration: 45,
    customDurations: {}
  },
  schedule: {
    '0': [],
    '1': [],
    '2': [],
    '3': [],
    '4': [],
    '5': [],
    '6': []
  }
};

/**
 * Helper to get the school settings with robust fallback support
 */
export function getSchoolSettings(profile: TeacherProfile | null | undefined): SchoolSettings {
  if (!profile || !profile.schoolSettings) {
    return DEFAULT_SCHOOL_SETTINGS;
  }
  
  const scheduleObj = { ...DEFAULT_SCHOOL_SETTINGS.schedule, ...profile.schoolSettings.schedule };
  
  // Ensure stable IDs and source metadata are present for each record
  const migratedSchedule: Record<string, SchoolPeriodRecord[]> = {};
  for (const dayKey of Object.keys(scheduleObj)) {
    migratedSchedule[dayKey] = (scheduleObj[dayKey] || []).map(record => ({
      ...record,
      id: record.id || `school_${dayKey}_${record.periodNumber}`,
      source: record.source || 'school_schedule'
    }));
  }

  // Merge to ensure no missing keys
  return {
    ...profile.schoolSettings,
    presence: { ...DEFAULT_SCHOOL_SETTINGS.presence, ...profile.schoolSettings.presence },
    periodSettings: { 
      ...DEFAULT_SCHOOL_SETTINGS.periodSettings, 
      ...profile.schoolSettings.periodSettings,
      customDurations: profile.schoolSettings.periodSettings?.customDurations || {}
    },
    schedule: migratedSchedule,
    customTimedSessions: profile.schoolSettings.customTimedSessions || []
  };
}

/**
 * Parses time string "HH:MM" to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Formats minutes from midnight into "HH:MM" string format
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = (totalMinutes + 1440) % 1440; // wrap around 24h
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculates start and end times for all school periods
 */
export interface CalculatedPeriod {
  periodNumber: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  duration: number; // minutes
  isCustom: boolean;
}

export function calculatePeriodsTimings(periodSettings: SchoolPeriodSettings): CalculatedPeriod[] {
  const { periodsCount, firstPeriodStart, defaultDuration, customDurations = {} } = periodSettings;
  const list: CalculatedPeriod[] = [];
  
  let currentMinutes = parseTimeToMinutes(firstPeriodStart);
  
  for (let i = 1; i <= periodsCount; i++) {
    const isCustom = customDurations[i] !== undefined;
    const duration = isCustom ? customDurations[i] : defaultDuration;
    
    const startTimeStr = formatMinutesToTime(currentMinutes);
    const endTimeStr = formatMinutesToTime(currentMinutes + duration);
    
    list.push({
      periodNumber: i,
      startTime: startTimeStr,
      endTime: endTimeStr,
      duration,
      isCustom
    });
    
    currentMinutes += duration;
  }
  
  return list;
}

/**
 * Finds which standard period number matches a custom timed session based on its start and end times.
 * If the session falls within school hours, returns the period whose time range contains startTime
 * or is closest to startTime. If session is strictly after all periods or before the first period, returns null.
 */
export function findMatchingPeriodNumber(
  sessionStartTime: string,
  sessionEndTime: string | undefined,
  periods: CalculatedPeriod[]
): number | null {
  if (!periods || periods.length === 0 || !sessionStartTime) return null;

  const sessionStartMin = parseTimeToMinutes(sessionStartTime);
  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];

  const firstStartMin = parseTimeToMinutes(firstPeriod.startTime);
  const lastEndMin = parseTimeToMinutes(lastPeriod.endTime);

  // If session is more than 30 mins after the last period ends, treat as post-school/afternoon session
  if (sessionStartMin >= lastEndMin) {
    return null;
  }

  // If session is more than 30 mins before first period starts, treat as pre-school session
  if (sessionStartMin < firstStartMin - 30) {
    return null;
  }

  // 1. Direct containment: [p.startTime, p.endTime)
  for (const p of periods) {
    const pStart = parseTimeToMinutes(p.startTime);
    const pEnd = parseTimeToMinutes(p.endTime);
    if (sessionStartMin >= pStart && sessionStartMin < pEnd) {
      return p.periodNumber;
    }
  }

  // 2. Proximity: find the period whose start time is closest to sessionStartMin
  let bestPeriod = periods[0].periodNumber;
  let minDiff = Infinity;
  for (const p of periods) {
    const pStart = parseTimeToMinutes(p.startTime);
    const diff = Math.abs(pStart - sessionStartMin);
    if (diff < minDiff) {
      minDiff = diff;
      bestPeriod = p.periodNumber;
    }
  }

  return bestPeriod;
}

/**
 * Gets custom sessions matching a specific period number for a given day and optionally teacher.
 */
export function getCustomSessionsForPeriod(
  customSessions: CustomTimedSession[] | undefined,
  dayKey: string,
  periodNumber: number,
  periods: CalculatedPeriod[],
  teacherId?: string
): CustomTimedSession[] {
  if (!customSessions || customSessions.length === 0) return [];

  return customSessions.filter(cs => {
    if (cs.dayKey !== dayKey) return false;
    if (teacherId && cs.teacherId && cs.teacherId !== teacherId && teacherId !== 'all') return false;
    const matchedPeriod = findMatchingPeriodNumber(cs.startTime, cs.endTime, periods);
    return matchedPeriod === periodNumber;
  });
}

/**
 * Gets custom sessions that fall outside normal school period hours (e.g. afternoon/after-school).
 */
export function getUnmatchedCustomSessions(
  customSessions: CustomTimedSession[] | undefined,
  dayKey: string,
  periods: CalculatedPeriod[],
  teacherId?: string
): CustomTimedSession[] {
  if (!customSessions || customSessions.length === 0) return [];

  return customSessions.filter(cs => {
    if (cs.dayKey !== dayKey) return false;
    if (teacherId && cs.teacherId && cs.teacherId !== teacherId && teacherId !== 'all') return false;
    const matchedPeriod = findMatchingPeriodNumber(cs.startTime, cs.endTime, periods);
    return matchedPeriod === null;
  });
}

/**
 * Unified timeline item for daily schedule view (merging standard periods and custom timed sessions)
 */
export interface UnifiedDayTimelineItem {
  id: string;
  type: 'standard_period' | 'custom_session';
  periodNumber?: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  className?: string;
  subjectName?: string;
  room?: string;
  notes?: string;
  sessionType?: string;
  teacherId?: string;
  teacherName?: string;
  isCustomTime?: boolean;
  rawRecord?: SchoolPeriodRecord;
  rawCustomSession?: CustomTimedSession;
}

/**
 * Merges standard school periods with custom timed sessions for a day, sorted chronologically.
 */
export function getMergedDayScheduleItems(
  schedule: SchoolPeriodRecord[] | undefined,
  customSessions: CustomTimedSession[] | undefined,
  dayKey: string,
  periods: CalculatedPeriod[],
  teacherId?: string
): UnifiedDayTimelineItem[] {
  const items: UnifiedDayTimelineItem[] = [];

  // 1. Add standard scheduled periods with content
  const daySchedule = schedule || [];
  periods.forEach(p => {
    const record = daySchedule.find(r => r.periodNumber === p.periodNumber);
    if (record && (record.subjectName || record.className)) {
      items.push({
        id: record.id || `period_${dayKey}_${p.periodNumber}`,
        type: 'standard_period',
        periodNumber: p.periodNumber,
        startTime: p.startTime,
        endTime: p.endTime,
        durationMinutes: p.duration,
        className: record.className,
        subjectName: record.subjectName,
        room: record.room,
        notes: record.notes,
        sessionType: record.sessionType,
        isCustomTime: false,
        rawRecord: record
      });
    }
  });

  // 2. Add custom timed sessions for this day
  const filteredCustoms = (customSessions || []).filter(cs => {
    if (cs.dayKey !== dayKey) return false;
    if (teacherId && cs.teacherId && cs.teacherId !== teacherId && teacherId !== 'all') return false;
    return true;
  });

  filteredCustoms.forEach(cs => {
    const startMin = parseTimeToMinutes(cs.startTime);
    const endMin = parseTimeToMinutes(cs.endTime);
    const duration = Math.max(15, endMin - startMin);
    const matchedP = findMatchingPeriodNumber(cs.startTime, cs.endTime, periods);

    items.push({
      id: cs.id,
      type: 'custom_session',
      periodNumber: matchedP || undefined,
      startTime: cs.startTime,
      endTime: cs.endTime,
      durationMinutes: duration,
      className: cs.className,
      subjectName: cs.subjectName,
      room: cs.room,
      notes: cs.notes,
      sessionType: cs.sessionType || 'حصة بتوقيت مخصص',
      teacherId: cs.teacherId,
      teacherName: cs.teacherName,
      isCustomTime: true,
      rawCustomSession: cs
    });
  });

  // 3. Sort chronologically by startTime
  items.sort((a, b) => {
    const minA = parseTimeToMinutes(a.startTime);
    const minB = parseTimeToMinutes(b.startTime);
    if (minA !== minB) return minA - minB;
    return (a.periodNumber || 0) - (b.periodNumber || 0);
  });

  return items;
}

/**
 * Holds school statistics and breakdowns
 */
export interface SchoolTimeMetrics {
  totalPresenceMinutes: number; // Entire attendance block
  totalPeriodsMinutes: number;   // Combined active schedules/periods minutes
  freeMinutesInsideSchool: number; // Empty minutes (school presence minus classes)
  lessonsWithSubjectCount: number; // Scheduled non-empty lessons
}
