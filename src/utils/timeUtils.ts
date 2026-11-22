import { WeeklyWorkingHours, Lesson, Group, TeacherProfile } from '../types';
import { getSchoolSettings, calculatePeriodsTimings, parseTimeToMinutes } from './schoolUtils';
import { normalizeDigits } from './phoneUtils';

export const parseTime = (time: string): number => {
  if (!time) return 0;
  const normalized = normalizeDigits(time.trim());
  const parts = normalized.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

export const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const formatTimeDisplay = (time: string, language: string): string => {
  if (!time) return '';
  const normalized = normalizeDigits(time.trim());
  const [hStr, mStr] = normalized.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? (language === 'ar' ? 'م' : 'PM') : (language === 'ar' ? 'ص' : 'AM');
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${mStr || '00'} ${ampm}`;
};

export const getDayOfWeekIndex = (dateStr: string): number => {
  const d = parseLocalDate(dateStr);
  return d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
};

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12 || day < 1) return false;
  let maxDay = DAYS_IN_MONTH[month];
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
    maxDay = 29;
  }
  return day <= maxDay;
};

/**
 * Normalizes any date string (DD/MM/YYYY, YYYY-MM-DD, ISO string) into canonical YYYY-MM-DD format.
 */
export const normalizeDateToISO = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';

  // Fast path for canonical ASCII YYYY-MM-DD without allocating Date objects or running regexes
  if (
    dateStr.length === 10 &&
    dateStr.charCodeAt(4) === 45 &&
    dateStr.charCodeAt(7) === 45
  ) {
    const c0 = dateStr.charCodeAt(0) - 48;
    const c1 = dateStr.charCodeAt(1) - 48;
    const c2 = dateStr.charCodeAt(2) - 48;
    const c3 = dateStr.charCodeAt(3) - 48;
    const c5 = dateStr.charCodeAt(5) - 48;
    const c6 = dateStr.charCodeAt(6) - 48;
    const c8 = dateStr.charCodeAt(8) - 48;
    const c9 = dateStr.charCodeAt(9) - 48;
    if (
      c0 >= 0 && c0 <= 9 && c1 >= 0 && c1 <= 9 && c2 >= 0 && c2 <= 9 && c3 >= 0 && c3 <= 9 &&
      c5 >= 0 && c5 <= 9 && c6 >= 0 && c6 <= 9 && c8 >= 0 && c8 <= 9 && c9 >= 0 && c9 <= 9
    ) {
      const year = c0 * 1000 + c1 * 100 + c2 * 10 + c3;
      const month = c5 * 10 + c6;
      const day = c8 * 10 + c9;
      return isValidCalendarDate(year, month, day) ? dateStr : '';
    }
  }

  const normalized = normalizeDigits(dateStr.trim());
  if (!normalized) return '';

  const dmMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|[T\s])/);
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  const match = dmMatch
    ? { year: Number(dmMatch[3]), month: Number(dmMatch[2]), day: Number(dmMatch[1]) }
    : isoMatch
      ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
      : null;

  if (match) {
    const { year, month, day } = match;
    if (!isValidCalendarDate(year, month, day)) {
      return '';
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Preserve compatibility with other parseable date formats without slicing arbitrary text.
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return formatLocalDate(parsed);
  return '';
};

/**
 * Safely parses a 'YYYY-MM-DD' or 'DD/MM/YYYY' date string into a local Date object at 00:00:00 local time.
 * Prevents UTC timezone shifting and handles Arabic/Eastern numerals.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const iso = normalizeDateToISO(dateStr);
  const parts = iso.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10) || new Date().getFullYear();
    const m = parseInt(parts[1], 10) || 1;
    const d = parseInt(parts[2], 10) || 1;
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
};

/**
 * Safely formats a Date object into 'YYYY-MM-DD' using local time components.
 * Prevents toISOString() UTC backward/forward day shifts.
 */
export const formatLocalDate = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getLocalDateStr = formatLocalDate;

export interface TimeSlot {
  start: string;
  end: string;
  startMin: number;
  endMin: number;
}

export const getBookedSlotsForDate = (dateStr: string, lessons: Lesson[], groups: Group[]): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  
  // We rely on actual Lesson instances since the system generates them
  lessons.filter(l => normalizeDateToISO(l.date) === normalizeDateToISO(dateStr) && l.status !== 'cancelled').forEach(l => {
    const startMin = parseTime(l.time);
    const endMin = startMin + l.durationMinutes;
    slots.push({ start: l.time, end: formatTime(endMin), startMin, endMin });
  });

  // Merge overlapping slots
  slots.sort((a, b) => a.startMin - b.startMin);
  const merged: TimeSlot[] = [];
  for (const slot of slots) {
    if (merged.length === 0) {
      merged.push(slot);
    } else {
      const last = merged[merged.length - 1];
      if (slot.startMin < last.endMin) { // overlap
        last.endMin = Math.max(last.endMin, slot.endMin);
        last.end = formatTime(last.endMin);
      } else {
        merged.push(slot);
      }
    }
  }
  
  return merged;
};

/**
 * Computes the school day end time for a given day (in minutes from midnight).
 * Returns 0 if school is not active on this day.
 */
export const getEffectiveSchoolEndForDay = (
  dayIndex: number | string,
  profile?: TeacherProfile | null
): number => {
  if (!profile) return 0;
  const schoolSettings = getSchoolSettings(profile);
  const dayKey = String(dayIndex);
  const presence = schoolSettings.presence[dayKey];

  if (!presence || !presence.active) {
    return 0;
  }

  // Check presence departure time
  const departureMinutes = presence.departureTime ? parseTimeToMinutes(presence.departureTime) : 0;

  // Check last period or scheduled period end time
  const daySchedule = schoolSettings.schedule[dayKey] || [];
  const calculatedPeriods = calculatePeriodsTimings(schoolSettings.periodSettings);
  
  let lastLessonEndMinutes = 0;
  const filledPeriods = daySchedule.filter(r => (r.className || r.subjectName));
  
  if (filledPeriods.length > 0) {
    filledPeriods.forEach(r => {
      const timing = calculatedPeriods.find(p => p.periodNumber === r.periodNumber);
      if (timing) {
        lastLessonEndMinutes = Math.max(lastLessonEndMinutes, parseTimeToMinutes(timing.endTime));
      }
    });
  }

  return Math.max(departureMinutes, lastLessonEndMinutes);
};

/**
 * Calculates free continuous periods for a specific date.
 * If the user has an active school schedule on that day, the free time start automatically starts
 * right after the school day ends (effective departure/last period).
 */
export const getFreePeriodsForDate = (
  dateStr: string,
  lessons: Lesson[],
  groups: Group[],
  weeklyWorkingHours: WeeklyWorkingHours,
  profile?: TeacherProfile | null
): TimeSlot[] => {
  const dayIndex = getDayOfWeekIndex(dateStr) as keyof WeeklyWorkingHours;
  const hours = weeklyWorkingHours[dayIndex];
  if (!hours || hours.isOff) return [];
  
  let workStartMin = parseTime(hours.startTime);
  const workEndMin = parseTime(hours.endTime);

  // If school is active on this day, automatically start free time right after school ends
  if (profile) {
    const schoolEndMin = getEffectiveSchoolEndForDay(dayIndex, profile);
    if (schoolEndMin > 0) {
      workStartMin = schoolEndMin;
    }
  }
  
  if (workStartMin >= workEndMin) {
    return [];
  }
  
  const booked = getBookedSlotsForDate(dateStr, lessons, groups);
  
  const free: TimeSlot[] = [];
  let currentMin = workStartMin;
  
  for (const b of booked) {
    if (b.startMin > currentMin) {
      free.push({ start: formatTime(currentMin), end: formatTime(b.startMin), startMin: currentMin, endMin: b.startMin });
    }
    currentMin = Math.max(currentMin, b.endMin);
  }
  
  if (currentMin < workEndMin) {
    free.push({ start: formatTime(currentMin), end: formatTime(workEndMin), startMin: currentMin, endMin: workEndMin });
  }
  
  return free;
};

export const parseTimeForSort = (time?: string): number => {
  if (!time || typeof time !== 'string') return 0;
  const normalized = normalizeDigits(time.trim());
  const match = normalized.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return 0;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  return h * 60 + m;
};

export const advanceDueDateByFrequency = (
  baseDateStr: string,
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | string
): string => {
  const baseDate = parseLocalDate(baseDateStr || formatLocalDate());
  const nextDue = new Date(baseDate.getTime());

  if (frequency === 'daily') {
    nextDue.setDate(nextDue.getDate() + 1);
  } else if (frequency === 'weekly') {
    nextDue.setDate(nextDue.getDate() + 7);
  } else if (frequency === 'yearly') {
    const origMonth = nextDue.getMonth();
    nextDue.setFullYear(nextDue.getFullYear() + 1);
    if (nextDue.getMonth() !== origMonth) {
      nextDue.setDate(0);
    }
  } else if (frequency === 'monthly') {
    const dayOfMonth = nextDue.getDate();
    nextDue.setMonth(nextDue.getMonth() + 1);
    if (nextDue.getDate() !== dayOfMonth) {
      nextDue.setDate(0);
    }
  }

  return formatLocalDate(nextDue);
};


export const getBookableSlots = (freePeriods: TimeSlot[], slotDurationMinutes: number): TimeSlot[] => {
  const bookable: TimeSlot[] = [];
  for (const period of freePeriods) {
    let currentMin = period.startMin;
    while (currentMin + slotDurationMinutes <= period.endMin) {
      bookable.push({
        start: formatTime(currentMin),
        end: formatTime(currentMin + slotDurationMinutes),
        startMin: currentMin,
        endMin: currentMin + slotDurationMinutes
      });
      currentMin += slotDurationMinutes;
    }
  }
  return bookable;
};

/**
 * Computes the nearest rounded hour string "HH:00" from the given date/time (default: current local time).
 * For example: 14:15 -> "14:00", 14:35 -> "15:00", 23:45 -> "00:00".
 */
export const getNearestHourTime = (date: Date = new Date()): string => {
  const d = new Date(date);
  const minutes = d.getMinutes();
  if (minutes >= 30) {
    d.setHours(d.getHours() + 1);
  }
  d.setMinutes(0, 0, 0);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
};
