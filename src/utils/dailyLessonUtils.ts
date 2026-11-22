import { useState, useEffect } from 'react';
import { Lesson, Group, GroupWeeklySession } from '../types';
import { formatLocalDate, normalizeDateToISO, parseLocalDate } from './timeUtils';
import { getGroupScheduleSlots, getDayNumber, getProjectedLessonsForRange, isDateMatchingGroupRecurrence } from './scheduleUtils';
import { normalizeTime, pickAuthoritativeLesson } from './lessonUtils';

/**
 * React hook that keeps a canonical local YYYY-MM-DD date string updated across midnight boundaries.
 */
export function useLocalDateKey(offsetDays: number = 0, intervalMs: number = 30000): string {
  const computeDateKey = () => {
    const d = new Date();
    if (offsetDays !== 0) {
      d.setDate(d.getDate() + offsetDays);
    }
    return formatLocalDate(d);
  };

  const [dateKey, setDateKey] = useState<string>(computeDateKey);

  useEffect(() => {
    const check = () => {
      const next = computeDateKey();
      setDateKey((prev) => (prev !== next ? next : prev));
    };
    check();
    const timer = setInterval(check, intervalMs);
    return () => clearInterval(timer);
  }, [offsetDays, intervalMs]);

  return dateKey;
}

export interface GetLessonsForDateOptions {
  includeCancelled?: boolean;
  dismissedLessonIds?: string[];
  defaultZoomLink?: string;
}

export function isLessonCompatibleWithGroupSchedule(
  lesson: Partial<Lesson> | null | undefined,
  group?: Partial<Group> | null
): boolean {
  if (!lesson || lesson.deleted) return false;
  if (!lesson.groupId || lesson.groupId === 'quick_group') return true;
  if (!group) return false;
  if (group.deleted || group.status === 'archived') return false;
  if (lesson.status && lesson.status !== 'scheduled') return true;
  if (
    lesson.report &&
    (lesson.report.attendanceStatus ||
      lesson.report.teacherNotes ||
      lesson.report.homeworkTitle ||
      lesson.report.quizScore !== undefined)
  ) {
    return true;
  }
  if ((lesson.amountPaid && lesson.amountPaid > 0) || (lesson.studentPayments && Object.keys(lesson.studentPayments).length > 0)) {
    return true;
  }
  if (lesson.id?.startsWith('l_auto_') && group.scheduleRecurrence && group.scheduleRecurrence !== 'weekly' && lesson.date) {
    const isoDate = normalizeDateToISO(lesson.date);
    if (isoDate && !isDateMatchingGroupRecurrence(group.scheduleRecurrence, isoDate)) {
      return false;
    }
  }
  return true;
}

/**
 * Canonical resilient daily lesson resolver for Dashboard widgets (Today, Tomorrow, Smart Summary, Header).
 * - Uses getProjectedLessonsForRange so recurring active groups always project on their scheduled days
 *   even if future stored auto lessons were pruned or not yet generated.
 * - Compares dates strictly after normalizeDateToISO(l.date) === targetIsoDate.
 * - Deduplicates by `${groupId}_${isoDate}_${normalizeTime(time)}` using pickAuthoritativeLesson.
 * - Skips deleted lessons and (by default) cancelled lessons.
 */
export function getLessonsForDate(
  dateInput: string,
  allLessons: Lesson[],
  groups: Group[],
  groupWeeklySessions?: GroupWeeklySession[],
  options?: GetLessonsForDateOptions
): Lesson[] {
  const targetDateKey = normalizeDateToISO(dateInput);
  if (!targetDateKey) return [];

  const includeCancelled = Boolean(options?.includeCancelled);
  const dismissedSet = new Set(options?.dismissedLessonIds || []);

  const safeLessons = (Array.isArray(allLessons) ? allLessons : []).map((l) => {
    if (!l || !l.date) return l;
    const normDate = normalizeDateToISO(l.date);
    const normTime = normalizeTime(l.time) || l.time;
    if (normDate !== l.date || normTime !== l.time) {
      return { ...l, date: normDate, time: normTime };
    }
    return l;
  });

  // Track explicitly deleted or cancelled slots on targetDateKey so getProjectedLessonsForRange does not resurrect them
  const suppressedSlotKeys = new Set<string>();
  for (const l of safeLessons) {
    if (!l || normalizeDateToISO(l.date) !== targetDateKey) continue;
    const normTime = normalizeTime(l.time) || l.time || '00:00';
    if (l.deleted) {
      if (l.groupId && l.groupId !== 'quick_group') {
        suppressedSlotKeys.add(`${l.groupId}_${targetDateKey}_${normTime}`);
      }
    } else if (l.status === 'cancelled' && !includeCancelled) {
      if (l.groupId && l.groupId !== 'quick_group') {
        suppressedSlotKeys.add(`${l.groupId}_${targetDateKey}_${normTime}`);
      }
    }
  }

  const projectedAndExplicit = getProjectedLessonsForRange(
    targetDateKey,
    targetDateKey,
    groups || [],
    safeLessons,
    options?.defaultZoomLink,
    groupWeeklySessions,
    safeLessons
  );

  const activeGroupsById = new Map<string, Group>();
  for (const g of groups || []) {
    if (g && g.id && !g.deleted && g.status !== 'archived') {
      activeGroupsById.set(g.id, g);
    }
  }

  const filtered = projectedAndExplicit.filter((l) => {
    if (!l || l.deleted) return false;
    if (dismissedSet.has(l.id)) return false;
    const isoDate = normalizeDateToISO(l.date);
    if (isoDate !== targetDateKey) return false;
    if (!includeCancelled && l.status === 'cancelled') return false;

    const normTime = normalizeTime(l.time) || l.time || '00:00';
    if (l.groupId && l.groupId !== 'quick_group') {
      const slotKey = `${l.groupId}_${targetDateKey}_${normTime}`;
      if (suppressedSlotKeys.has(slotKey) && l.status === 'scheduled') {
        return false;
      }
    }

    // If it's an unstarted scheduled lesson for a group, verify it matches the group's active schedule
    if (
      l.groupId &&
      l.groupId !== 'quick_group' &&
      l.status === 'scheduled' &&
      (!l.report ||
        (!l.report.attendanceStatus &&
          !l.report.teacherNotes &&
          !l.report.homeworkTitle &&
          l.report.quizScore === undefined)) &&
      (!l.studentPayments || Object.keys(l.studentPayments).length === 0) &&
      (!l.amountPaid || l.amountPaid === 0)
    ) {
      const grp = activeGroupsById.get(l.groupId);
      if (!grp) return false;
      if (l.id.startsWith('l_auto_') && grp.scheduleRecurrence && grp.scheduleRecurrence !== 'weekly') {
        if (!isDateMatchingGroupRecurrence(grp.scheduleRecurrence, targetDateKey)) {
          return false;
        }
      }
    }

    return true;
  });

  const slotMap = new Map<string, Lesson>();
  for (const l of filtered) {
    const isoDate = normalizeDateToISO(l.date);
    const normTime = normalizeTime(l.time) || l.time || '00:00';
    const normalizedLesson: Lesson =
      l.date !== isoDate || l.time !== normTime ? { ...l, date: isoDate, time: normTime } : l;

    const key =
      normalizedLesson.groupId && normalizedLesson.groupId !== 'quick_group'
        ? `${normalizedLesson.groupId}_${isoDate}_${normTime}`
        : normalizedLesson.id;

    const existing = slotMap.get(key);
    if (!existing) {
      slotMap.set(key, normalizedLesson);
    } else {
      slotMap.set(key, pickAuthoritativeLesson(existing, normalizedLesson).survivor);
    }
  }

  return Array.from(slotMap.values()).sort((a, b) => {
    const tA = normalizeTime(a.time) || a.time || '00:00';
    const tB = normalizeTime(b.time) || b.time || '00:00';
    return tA.localeCompare(tB) || String(a.id || '').localeCompare(String(b.id || ''));
  });
}
