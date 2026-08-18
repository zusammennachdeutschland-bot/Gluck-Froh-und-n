import { Group, GroupScheduleSlot } from '../types';

export const DAY_NAME_TO_NUM: Record<string, number> = {
  'so': 0, 'sonntag': 0, 'sun': 0, 'sunday': 0, 'الأحد': 0, 'الاحد': 0, '0': 0,
  'mo': 1, 'montag': 1, 'mon': 1, 'monday': 1, 'الإثنين': 1, 'الاثنين': 1, '1': 1,
  'di': 2, 'dienstag': 2, 'tue': 2, 'tuesday': 2, 'الثلاثاء': 2, '2': 2,
  'mi': 3, 'mittwoch': 3, 'wed': 3, 'wednesday': 3, 'الأربعاء': 3, 'الاربعاء': 3, '3': 3,
  'do': 4, 'donnerstag': 4, 'thu': 4, 'thursday': 4, 'الخميس': 4, '4': 4,
  'fr': 5, 'freitag': 5, 'fri': 5, 'friday': 5, 'الجمعة': 5, '5': 5,
  'sa': 6, 'samstag': 6, 'sat': 6, 'saturday': 6, 'السبت': 6, '6': 6,
};

export const NUM_TO_SHORT_DAY: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa'
};

export const NUM_TO_ENGLISH_DAY: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday'
};

export const NUM_TO_ARABIC_DAY: Record<number, string> = {
  0: 'الأحد', 1: 'الإثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت'
};

export function getDayNumber(dayName: string): number {
  if (!dayName) return -1;
  const normalized = dayName.trim().toLowerCase();
  return DAY_NAME_TO_NUM[normalized] !== undefined ? DAY_NAME_TO_NUM[normalized] : -1;
}

/**
 * Normalizes any day name (e.g. "Saturday", "sat", "السبت", "Samstag") to standard UI short key ("Sa", "Mi", "Mo", etc.)
 */
export function normalizeDayToShortKey(dayName: string): string {
  const num = getDayNumber(dayName);
  if (num !== -1) {
    return NUM_TO_SHORT_DAY[num];
  }
  return dayName.trim();
}

/**
 * Gets localized day display name (e.g. "Saturday" -> "السبت" in AR)
 */
export function normalizeDayToDisplay(dayName: string, lang: 'ar' | 'en' | 'de' = 'ar'): string {
  const num = getDayNumber(dayName);
  if (num === -1) return dayName;

  if (lang === 'ar') {
    return NUM_TO_ARABIC_DAY[num];
  } else if (lang === 'en') {
    return NUM_TO_ENGLISH_DAY[num];
  }
  return NUM_TO_SHORT_DAY[num];
}

/**
 * Returns normalized GroupScheduleSlot[] for any group.
 * Guarantees day short key normalization so UI buttons, filters, and auto-generated schedules stay in sync.
 */
export function getGroupScheduleSlots(group: Partial<Group>): GroupScheduleSlot[] {
  const slots: GroupScheduleSlot[] = [];
  const defaultTime = group.scheduleTime || '17:00';

  if (group.schedules && group.schedules.length > 0) {
    group.schedules.forEach((s) => {
      const shortKey = normalizeDayToShortKey(s.day);
      slots.push({
        day: shortKey,
        time: s.time || defaultTime
      });
    });
    return slots;
  }

  const days = group.scheduleDays || [];
  const dayTimes = group.scheduleDayTimes || {};

  days.forEach((day) => {
    const shortKey = normalizeDayToShortKey(day);
    const time = dayTimes[shortKey] || dayTimes[day] || defaultTime;
    slots.push({ day: shortKey, time });
  });

  return slots;
}

/**
 * Formats group schedule slots for display in UI.
 * e.g., "السبت @ 15:00 | الأربعاء @ 19:00"
 */
export function formatGroupScheduleDisplay(group: Partial<Group>, lang: 'ar' | 'en' | 'de' = 'ar'): string {
  const slots = getGroupScheduleSlots(group);
  if (slots.length === 0) {
    return lang === 'ar' ? 'بدون مواعيد محددة' : 'No schedule set';
  }

  const firstTime = slots[0].time;
  const allSameTime = slots.every(s => s.time === firstTime);

  if (allSameTime) {
    const daysStr = slots.map(s => normalizeDayToDisplay(s.day, lang)).join(', ');
    return `${daysStr} @ ${firstTime}`;
  }

  return slots.map(s => `${normalizeDayToDisplay(s.day, lang)} @ ${s.time}`).join(' | ');
}

/**
 * Single source of truth for group's next upcoming schedule.
 * Calculates the exact day and time based ONLY on the group's saved settings.
 */
export function getUpcomingGroupSchedule(group: Partial<Group>): { day: string; time: string; dayDisplay: string } | null {
  const slots = getGroupScheduleSlots(group);
  if (slots.length === 0) return null;

  // Find the closest upcoming slot
  const now = new Date();
  const currentDayNum = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  let nextSlot = slots[0];
  let minDaysDiff = 999;
  let nextSlotDayNum = -1;

  for (const slot of slots) {
    const slotDayNum = getDayNumber(slot.day);
    if (slotDayNum === -1) continue;

    let daysDiff = slotDayNum - currentDayNum;
    if (daysDiff < 0) daysDiff += 7;

    const [hStr, mStr] = slot.time.split(':');
    const slotTotalMinutes = parseInt(hStr || '0', 10) * 60 + parseInt(mStr || '0', 10);

    // If it's today but the time has passed, it will be next week
    if (daysDiff === 0 && slotTotalMinutes <= currentTotalMinutes) {
      daysDiff += 7;
    }

    if (daysDiff < minDaysDiff) {
      minDaysDiff = daysDiff;
      nextSlot = slot;
      nextSlotDayNum = slotDayNum;
    } else if (daysDiff === minDaysDiff) {
      // If same day difference, pick the earlier one
      const [nH, nM] = nextSlot.time.split(':');
      const nTotal = parseInt(nH || '0', 10) * 60 + parseInt(nM || '0', 10);
      if (slotTotalMinutes < nTotal) {
        nextSlot = slot;
        nextSlotDayNum = slotDayNum;
      }
    }
  }

  return {
    day: nextSlot.day,
    time: nextSlot.time,
    dayDisplay: nextSlotDayNum !== -1 ? NUM_TO_ARABIC_DAY[nextSlotDayNum] : nextSlot.day
  };
}
