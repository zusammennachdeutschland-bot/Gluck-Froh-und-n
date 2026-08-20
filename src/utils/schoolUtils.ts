import { SchoolSettings, SchoolPeriodSettings, SchoolPeriodRecord, TeacherProfile } from '../types';

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
    presence: { ...DEFAULT_SCHOOL_SETTINGS.presence, ...profile.schoolSettings.presence },
    periodSettings: { 
      ...DEFAULT_SCHOOL_SETTINGS.periodSettings, 
      ...profile.schoolSettings.periodSettings,
      customDurations: profile.schoolSettings.periodSettings?.customDurations || {}
    },
    schedule: migratedSchedule
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
 * Holds school statistics and breakdowns
 */
export interface SchoolTimeMetrics {
  totalPresenceMinutes: number; // Entire attendance block
  totalPeriodsMinutes: number;   // Combined active schedules/periods minutes
  freeMinutesInsideSchool: number; // Empty minutes (school presence minus classes)
  lessonsWithSubjectCount: number; // Scheduled non-empty lessons
}

/**
 * Computes time breakdown for a given active school day
 */
export function calculateSchoolDayMetrics(
  dayPresence: { active: boolean; arrivalTime: string; departureTime: string },
  periodSettings: SchoolPeriodSettings,
  daySchedule: SchoolPeriodRecord[]
): SchoolTimeMetrics {
  if (!dayPresence.active) {
    return {
      totalPresenceMinutes: 0,
      totalPeriodsMinutes: 0,
      freeMinutesInsideSchool: 0,
      lessonsWithSubjectCount: 0
    };
  }

  const arrivalMin = parseTimeToMinutes(dayPresence.arrivalTime);
  const departureMin = parseTimeToMinutes(dayPresence.departureTime);
  let totalPresenceMinutes = departureMin - arrivalMin;
  if (totalPresenceMinutes < 0) totalPresenceMinutes += 1440; // overnight fallback

  const calculatedTimings = calculatePeriodsTimings(periodSettings);
  
  let totalPeriodsMinutes = 0;
  let lessonsWithSubjectCount = 0;

  calculatedTimings.forEach((period) => {
    // Find if scheduled
    const record = daySchedule.find(s => s.periodNumber === period.periodNumber);
    if (record && (record.subjectName || record.className)) {
      totalPeriodsMinutes += period.duration;
      lessonsWithSubjectCount++;
    }
  });

  const freeMinutesInsideSchool = Math.max(0, totalPresenceMinutes - totalPeriodsMinutes);

  return {
    totalPresenceMinutes,
    totalPeriodsMinutes,
    freeMinutesInsideSchool,
    lessonsWithSubjectCount
  };
}
