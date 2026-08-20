import { SchoolSettings, TeacherProfile, SchoolPeriodRecord } from '../types';
import { getSchoolSettings, calculatePeriodsTimings, CalculatedPeriod } from './schoolUtils';

export interface SchoolIcsEventItem {
  uid: string;
  summary: string;
  description: string;
  location: string;
  startDT: string;
  endDT: string;
  rrule?: string;
  type: 'period' | 'presence';
  periodNumber?: number;
  dayKey: string;
  dateStr?: string;
}

export const DAY_KEY_TO_RRULE_BYDAY: Record<string, string> = {
  '0': 'SU',
  '1': 'MO',
  '2': 'TU',
  '3': 'WE',
  '4': 'TH',
  '5': 'FR',
  '6': 'SA',
};

export const DAY_KEY_TO_NAME: Record<string, { ar: string; en: string; de: string }> = {
  '0': { ar: 'الأحد', en: 'Sunday', de: 'Sonntag' },
  '1': { ar: 'الإثنين', en: 'Monday', de: 'Montag' },
  '2': { ar: 'الثلاثاء', en: 'Tuesday', de: 'Dienstag' },
  '3': { ar: 'الأربعاء', en: 'Wednesday', de: 'Mittwoch' },
  '4': { ar: 'الخميس', en: 'Thursday', de: 'Donnerstag' },
  '5': { ar: 'الجمعة', en: 'Friday', de: 'Freitag' },
  '6': { ar: 'السبت', en: 'Saturday', de: 'Samstag' },
};

function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Calculates the date of the nearest matching day of week for startDT in recurring events
 */
export function getUpcomingDateForDayKey(dayKey: string, baseDate = new Date()): string {
  const targetDay = parseInt(dayKey, 10);
  const currentDay = baseDate.getDay();
  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;

  const targetDate = new Date(baseDate);
  targetDate.setDate(baseDate.getDate() + diff);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Builds ICS VEVENT string from a list of SchoolIcsEventItem objects
 */
export function formatIcsEventBlock(event: SchoolIcsEventItem, reminderMinutes = 15): string[] {
  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${event.uid}`);
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
  lines.push(`DTSTART:${event.startDT}`);
  lines.push(`DTEND:${event.endDT}`);

  if (event.rrule) {
    lines.push(`RRULE:${event.rrule}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  lines.push('CATEGORIES:SCHOOL,EDUCATION');

  // Reminders / Alarms
  if (reminderMinutes > 0) {
    lines.push('BEGIN:VALARM');
    lines.push(`TRIGGER:-PT${reminderMinutes}M`);
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeIcsText(event.summary)} in ${reminderMinutes} minutes`);
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Generates month-expanded school schedule ICS events for a specific month & year
 */
export function generateMonthlySchoolScheduleIcsEvents(
  schoolSettingsInput: SchoolSettings | null | undefined,
  year: number,
  monthIndex: number, // 0-11
  options: {
    includePresence?: boolean;
    language?: 'ar' | 'en' | 'de';
    reminderMinutes?: number;
  } = {}
): {
  events: SchoolIcsEventItem[];
  icsLines: string[];
  totalPeriodsCount: number;
  activeSchoolDaysCount: number;
} {
  const settings = schoolSettingsInput || getSchoolSettings(null);
  const lang = options.language || 'ar';
  const reminderMins = options.reminderMinutes !== undefined ? options.reminderMinutes : 15;
  const includePresence = options.includePresence ?? false;

  const periodsTimings = calculatePeriodsTimings(settings.periodSettings);
  const timingMap = new Map<number, CalculatedPeriod>();
  periodsTimings.forEach(p => timingMap.set(p.periodNumber, p));

  const events: SchoolIcsEventItem[] = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  let activeSchoolDaysCount = 0;
  let totalPeriodsCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, monthIndex, day);
    const dayOfWeek = dateObj.getDay();
    const dayKey = String(dayOfWeek);

    const presence = settings.presence[dayKey];
    const isDayActive = presence ? presence.active : (['0', '1', '2', '3', '4'].includes(dayKey));
    if (!isDayActive) continue;

    activeSchoolDaysCount++;

    const yStr = String(year);
    const mStr = String(monthIndex + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;
    const cleanDate = `${yStr}${mStr}${dStr}`;

    // Optional School Presence Event
    if (includePresence && presence) {
      const arrivalClean = (presence.arrivalTime || '07:30').replace(':', '') + '00';
      const departureClean = (presence.departureTime || '14:30').replace(':', '') + '00';
      const presenceStartDT = `${cleanDate}T${arrivalClean}`;
      const presenceEndDT = `${cleanDate}T${departureClean}`;

      const presenceTitle = lang === 'ar' 
        ? `🏫 دوام المدرسة الأسبوعي (${presence.arrivalTime} - ${presence.departureTime})`
        : (lang === 'de' ? `🏫 Schulzeit (${presence.arrivalTime} - ${presence.departureTime})` : `🏫 School Day Presence (${presence.arrivalTime} - ${presence.departureTime})`);

      events.push({
        uid: `school_presence_${dateStr}@teacherassistant`,
        summary: presenceTitle,
        description: `School Day Attendance: ${presence.arrivalTime} - ${presence.departureTime}`,
        location: 'School',
        startDT: presenceStartDT,
        endDT: presenceEndDT,
        type: 'presence',
        dayKey,
        dateStr
      });
    }

    // School Periods for this day
    const daySchedule = settings.schedule[dayKey] || [];
    daySchedule.forEach((record: SchoolPeriodRecord) => {
      if (!record.subjectName && !record.className) return;

      const timing = timingMap.get(record.periodNumber);
      if (!timing) return;

      totalPeriodsCount++;

      const cleanStartTime = timing.startTime.replace(':', '') + '00';
      const cleanEndTime = timing.endTime.replace(':', '') + '00';
      const startDT = `${cleanDate}T${cleanStartTime}`;
      const endDT = `${cleanDate}T${cleanEndTime}`;

      const subject = record.subjectName || (lang === 'ar' ? 'حصة مدرسية' : (lang === 'de' ? 'Unterricht' : 'School Lesson'));
      const cls = record.className ? `(${record.className})` : '';
      const periodLabel = lang === 'ar' ? `الحصة ${record.periodNumber}` : (lang === 'de' ? `Stunde ${record.periodNumber}` : `Period ${record.periodNumber}`);

      const summary = `🏫 ${subject} ${cls}`.trim();
      const descLines = [
        `School Period: ${record.periodNumber} (${timing.startTime} - ${timing.endTime})`,
        record.className ? `Class / Grade: ${record.className}` : '',
        record.subjectName ? `Subject: ${record.subjectName}` : '',
        record.notes ? `Notes / Room: ${record.notes}` : ''
      ].filter(Boolean);

      events.push({
        uid: `school_period_${dateStr}_p${record.periodNumber}@teacherassistant`,
        summary,
        description: descLines.join('\n'),
        location: record.notes ? `School - ${record.notes}` : 'School',
        startDT,
        endDT,
        type: 'period',
        periodNumber: record.periodNumber,
        dayKey,
        dateStr
      });
    });
  }

  const icsLines: string[] = [];
  events.forEach(evt => {
    icsLines.push(...formatIcsEventBlock(evt, reminderMins));
  });

  return {
    events,
    icsLines,
    totalPeriodsCount,
    activeSchoolDaysCount
  };
}

/**
 * Generates recurring school schedule ICS file (weekly recurring VEVENTs with RRULE)
 */
export function generateRecurringSchoolScheduleIcs(
  settingsInput: SchoolSettings | null | undefined,
  profile: TeacherProfile | null | undefined,
  options: {
    language?: 'ar' | 'en' | 'de';
    includePresence?: boolean;
    calendarName?: string;
  } = {}
): {
  icsContent: string;
  filename: string;
  periodsCount: number;
  activeDaysCount: number;
} {
  const settings = settingsInput || getSchoolSettings(profile);
  const lang = options.language || profile?.language || 'ar';
  const includePresence = options.includePresence ?? false;

  const periodsTimings = calculatePeriodsTimings(settings.periodSettings);
  const timingMap = new Map<number, CalculatedPeriod>();
  periodsTimings.forEach(p => timingMap.set(p.periodNumber, p));

  const calName = options.calendarName || (
    lang === 'ar' 
      ? 'جدول المدرسة الأسبوعي - Glück'
      : (lang === 'de' ? 'Stundenplan - Glück' : 'Weekly School Schedule - Glück')
  );

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Glück//School Schedule Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calName)}`
  ];

  let periodsCount = 0;
  let activeDaysCount = 0;
  const now = new Date();

  Object.entries(settings.presence).forEach(([dayKey, presence]) => {
    if (!presence.active) return;
    activeDaysCount++;

    const byDay = DAY_KEY_TO_RRULE_BYDAY[dayKey] || 'MO';
    const firstOccurDate = getUpcomingDateForDayKey(dayKey, now);
    const cleanDate = firstOccurDate.replace(/-/g, '');

    // Optional weekly presence block
    if (includePresence) {
      const arrivalClean = (presence.arrivalTime || '07:30').replace(':', '') + '00';
      const departureClean = (presence.departureTime || '14:30').replace(':', '') + '00';
      const startDT = `${cleanDate}T${arrivalClean}`;
      const endDT = `${cleanDate}T${departureClean}`;

      const presenceTitle = lang === 'ar' 
        ? `🏫 دوام المدرسة الأسبوعي`
        : (lang === 'de' ? `🏫 Wöchentliche Schulzeit` : `🏫 Weekly School Day Presence`);

      const presenceEvt: SchoolIcsEventItem = {
        uid: `school_presence_rrule_${dayKey}@teacherassistant`,
        summary: presenceTitle,
        description: `Weekly school attendance: ${presence.arrivalTime} - ${presence.departureTime}`,
        location: 'School',
        startDT,
        endDT,
        rrule: `FREQ=WEEKLY;BYDAY=${byDay}`,
        type: 'presence',
        dayKey
      };
      icsLines.push(...formatIcsEventBlock(presenceEvt, 15));
    }

    // Weekly Period Events
    const daySchedule = settings.schedule[dayKey] || [];
    daySchedule.forEach((record: SchoolPeriodRecord) => {
      if (!record.subjectName && !record.className) return;

      const timing = timingMap.get(record.periodNumber);
      if (!timing) return;

      periodsCount++;

      const cleanStartTime = timing.startTime.replace(':', '') + '00';
      const cleanEndTime = timing.endTime.replace(':', '') + '00';
      const startDT = `${cleanDate}T${cleanStartTime}`;
      const endDT = `${cleanDate}T${cleanEndTime}`;

      const subject = record.subjectName || (lang === 'ar' ? 'حصة مدرسية' : 'School Lesson');
      const cls = record.className ? `(${record.className})` : '';

      const summary = `🏫 ${subject} ${cls}`.trim();
      const descLines = [
        `School Period: ${record.periodNumber} (${timing.startTime} - ${timing.endTime})`,
        record.className ? `Class / Grade: ${record.className}` : '',
        record.subjectName ? `Subject: ${record.subjectName}` : '',
        record.notes ? `Notes / Room: ${record.notes}` : ''
      ].filter(Boolean);

      const periodEvt: SchoolIcsEventItem = {
        uid: `school_period_rrule_d${dayKey}_p${record.periodNumber}@teacherassistant`,
        summary,
        description: descLines.join('\n'),
        location: record.notes ? `School - ${record.notes}` : 'School',
        startDT,
        endDT,
        rrule: `FREQ=WEEKLY;BYDAY=${byDay}`,
        type: 'period',
        periodNumber: record.periodNumber,
        dayKey
      };

      icsLines.push(...formatIcsEventBlock(periodEvt, 15));
    });
  });

  icsLines.push('END:VCALENDAR');

  const icsContent = icsLines.join('\r\n');
  const filename = `school_schedule_${now.toISOString().slice(0, 10)}.ics`;

  return {
    icsContent,
    filename,
    periodsCount,
    activeDaysCount
  };
}
