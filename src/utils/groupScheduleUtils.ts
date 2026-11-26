import { Group, Student } from '../types';

export interface GroupScheduleMatchResult {
  group: Group | null;
  reason: string;
  isExactTime: boolean;
}

const DAY_NAME_MAP: Record<string, string[]> = {
  sunday: ['sunday', 'أحد', 'الأحد', 'sun', 'so', 'sonntag'],
  monday: ['monday', 'إثنين', 'الإثنين', 'mon', 'mo', 'montag'],
  tuesday: ['tuesday', 'ثلاثاء', 'الثلاثاء', 'tue', 'di', 'dienstag'],
  wednesday: ['wednesday', 'أربعاء', 'الأربعاء', 'wed', 'mi', 'mittwoch'],
  thursday: ['thursday', 'خميس', 'الخميس', 'thu', 'do', 'donnerstag'],
  friday: ['friday', 'جمعة', 'الجمعة', 'fri', 'fr', 'freitag'],
  saturday: ['saturday', 'سبت', 'السبت', 'sat', 'sa', 'samstag']
};

export function getDayKeyFromDate(date: Date = new Date()): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return -1;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return -1;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function groupHasDay(group: Group, dayKey: string): boolean {
  if (!group || group.status === 'archived') return false;

  // 1. Check schedules array
  if (Array.isArray(group.schedules) && group.schedules.length > 0) {
    const hasMatch = group.schedules.some((s) => {
      const sDay = (s.day || '').toLowerCase();
      const matchAliases = DAY_NAME_MAP[dayKey] || [];
      return matchAliases.some((alias) => sDay.includes(alias));
    });
    if (hasMatch) return true;
  }

  // 2. Check scheduleDays
  if (Array.isArray(group.scheduleDays) && group.scheduleDays.length > 0) {
    const matchAliases = DAY_NAME_MAP[dayKey] || [];
    const hasMatch = group.scheduleDays.some((sd) => {
      const lower = sd.toLowerCase();
      return matchAliases.some((alias) => lower.includes(alias));
    });
    if (hasMatch) return true;
  }

  // 3. Check scheduleDayTimes
  if (group.scheduleDayTimes && typeof group.scheduleDayTimes === 'object') {
    const matchAliases = DAY_NAME_MAP[dayKey] || [];
    const keys = Object.keys(group.scheduleDayTimes);
    const hasMatch = keys.some((k) => {
      const lower = k.toLowerCase();
      return matchAliases.some((alias) => lower.includes(alias));
    });
    if (hasMatch) return true;
  }

  return false;
}

function getGroupDayTimeMinutes(group: Group, dayKey: string): number {
  if (group.schedules && group.schedules.length > 0) {
    const matchAliases = DAY_NAME_MAP[dayKey] || [];
    const slot = group.schedules.find((s) => {
      const sDay = (s.day || '').toLowerCase();
      return matchAliases.some((alias) => sDay.includes(alias));
    });
    if (slot && slot.time) return timeToMinutes(slot.time);
  }

  if (group.scheduleDayTimes) {
    const matchAliases = DAY_NAME_MAP[dayKey] || [];
    const keys = Object.keys(group.scheduleDayTimes);
    const key = keys.find((k) => matchAliases.some((alias) => k.toLowerCase().includes(alias)));
    if (key && group.scheduleDayTimes[key]) {
      return timeToMinutes(group.scheduleDayTimes[key]);
    }
  }

  if (group.scheduleTime) {
    return timeToMinutes(group.scheduleTime);
  }

  return -1;
}

export function detectCurrentScheduledGroup(
  groups: Group[] = [],
  nowDate: Date = new Date()
): GroupScheduleMatchResult {
  const activeGroups = groups.filter((g) => g.status !== 'archived');
  if (activeGroups.length === 0) {
    return { group: null, reason: 'no_groups', isExactTime: false };
  }

  const currentDayKey = getDayKeyFromDate(nowDate);
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  // 1. Find exact current time match (within -20 mins to +75 mins)
  const todayGroups = activeGroups.filter((g) => groupHasDay(g, currentDayKey));

  for (const group of todayGroups) {
    const timeMins = getGroupDayTimeMinutes(group, currentDayKey);
    if (timeMins >= 0) {
      // If current time is between timeMins - 20 and timeMins + 75
      const startWindow = timeMins - 20;
      const endWindow = timeMins + (group.lessonDurationMinutes || 60) + 15;

      if (currentMinutes >= startWindow && currentMinutes <= endWindow) {
        return {
          group,
          reason: `الجروب النشط حالياً بحسب الجدول (${group.name})`,
          isExactTime: true
        };
      }
    }
  }

  // No group is scheduled at the current time: report the slot as free
  // instead of guessing. The old fallbacks (closest group today / first
  // group today / first active group) wrongly presented a group that is
  // not on now as the "current" group — e.g. Kinda and Judy at 08:38 on a
  // Thursday when their lesson is at another time. Both callers already
  // handle group === null by showing "no class scheduled right now" and
  // selecting nothing.
  return {
    group: null,
    reason: 'no_current_group',
    isExactTime: false
  };
}

export function filterGroupsByDayAndTime(
  groups: Group[] = [],
  filterDay: string = 'all',
  filterTime: string = 'all'
): Group[] {
  return groups.filter((g) => {
    if (g.status === 'archived') return false;

    // Day filter
    if (filterDay !== 'all') {
      if (!groupHasDay(g, filterDay)) return false;
    }

    // Time filter ('morning': 8-12, 'afternoon': 12-17, 'evening': 17+)
    if (filterTime !== 'all') {
      const mins = getGroupDayTimeMinutes(g, filterDay !== 'all' ? filterDay : getDayKeyFromDate());
      if (mins >= 0) {
        const hours = mins / 60;
        if (filterTime === 'morning' && (hours < 8 || hours >= 12)) return false;
        if (filterTime === 'afternoon' && (hours < 12 || hours >= 17)) return false;
        if (filterTime === 'evening' && hours < 17) return false;
      }
    }

    return true;
  });
}

export function getStudentsForGroup(students: Student[] = [], groupId?: string): Student[] {
  if (!groupId) return [];
  return students.filter(
    (s) => s.groupId === groupId && s.status !== 'archived'
  );
}
