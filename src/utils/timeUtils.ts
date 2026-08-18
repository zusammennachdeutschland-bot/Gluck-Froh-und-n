import { WeeklyWorkingHours, Lesson, Group } from '../types';

export const parseTime = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const formatTimeDisplay = (time: string, language: string): string => {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? (language === 'ar' ? 'م' : 'PM') : (language === 'ar' ? 'ص' : 'AM');
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${mStr} ${ampm}`;
};

export const getDayOfWeekIndex = (dateStr: string): number => {
  const d = parseLocalDate(dateStr);
  return d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
};

/**
 * Safely parses a 'YYYY-MM-DD' date string into a local Date object at 00:00:00 local time.
 * Prevents UTC timezone shifting.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const [y, m, d] = parts.map(Number);
  return new Date(y, m - 1, d);
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

export interface TimeSlot {
  start: string;
  end: string;
  startMin: number;
  endMin: number;
}

export const getBookedSlotsForDate = (dateStr: string, lessons: Lesson[], groups: Group[]): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  
  // We rely on actual Lesson instances since the system generates them
  lessons.filter(l => l.date === dateStr && l.status !== 'cancelled').forEach(l => {
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
}

export const getFreePeriodsForDate = (dateStr: string, lessons: Lesson[], groups: Group[], weeklyWorkingHours: WeeklyWorkingHours): TimeSlot[] => {
  const dayIndex = getDayOfWeekIndex(dateStr) as keyof WeeklyWorkingHours;
  const hours = weeklyWorkingHours[dayIndex];
  if (!hours || hours.isOff) return [];
  
  const workStartMin = parseTime(hours.startTime);
  const workEndMin = parseTime(hours.endTime);
  
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
}

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
