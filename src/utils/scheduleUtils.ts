import { Group, GroupScheduleSlot, GroupWeeklySession, Lesson, ScheduleRecurrence } from '../types';
import { parseLocalDate, formatLocalDate, normalizeDateToISO } from './timeUtils';
import { resolveActiveMeetingLinkForLesson } from '../services/zoomSessionStandardizer';
import { getGroupMeetingLink, isMeetGroup } from './groupPlatformUtils';

const normalizeTime = (t?: string): string => {
  if (!t || typeof t !== 'string') return '';
  const clean = t.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(AM|PM|ص|م)?$/i);
  if (!match) return clean;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm === 'PM' || ampm === 'م') {
    if (hours < 12) hours += 12;
  } else if (ampm === 'AM' || ampm === 'ص') {
    if (hours === 12) hours = 0;
  }
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

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

/**
 * Reference anchor Monday: 2026-01-05 (Week 1 of 2026)
 * Calculates which alternating week cycle a date falls into ('A' or 'B').
 */
export function getAlternatingWeek(dateInput: Date | string): 'A' | 'B' {
  const d = typeof dateInput === 'string' ? parseLocalDate(dateInput) : new Date(dateInput);
  const day = d.getDay();
  // Monday of this week
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // Fixed reference Monday: 2026-01-05
  const refMonday = new Date(2026, 0, 5, 0, 0, 0, 0);
  const diffMs = monday.getTime() - refMonday.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  
  // Even weeks -> 'A', odd weeks -> 'B'
  const isEven = Math.abs(diffWeeks) % 2 === 0;
  return isEven ? 'A' : 'B';
}

/**
 * Returns whether a date matches the group's schedule recurrence
 */
export function isDateMatchingGroupRecurrence(
  recurrence: ScheduleRecurrence | undefined,
  dateInput: Date | string
): boolean {
  if (!recurrence || recurrence === 'weekly') return true;
  const currentWeek = getAlternatingWeek(dateInput);
  if (recurrence === 'biweekly_a') return currentWeek === 'A';
  if (recurrence === 'biweekly_b') return currentWeek === 'B';
  return true;
}

/**
 * Determines whether a student is scheduled to attend on a given lesson date based on alternating week schedule.
 * - 'weekly' (or undefined): attends every scheduled week
 * - 'biweekly_a': attends only on Week A (أسبوع أ)
 * - 'biweekly_b': attends only on Week B (أسبوع ب)
 */
export function isStudentMatchingLessonWeek(
  studentRecurrence: ScheduleRecurrence | undefined,
  dateInput: Date | string
): boolean {
  if (!studentRecurrence || studentRecurrence === 'weekly') return true;
  const currentWeek = getAlternatingWeek(dateInput);
  if (studentRecurrence === 'biweekly_a') return currentWeek === 'A';
  if (studentRecurrence === 'biweekly_b') return currentWeek === 'B';
  return true;
}

/**
 * Returns human-readable recurrence label
 */
export function getRecurrenceLabel(
  recurrence: ScheduleRecurrence | undefined,
  lang: 'ar' | 'en' | 'de' = 'ar'
): string {
  if (!recurrence || recurrence === 'weekly') {
    return lang === 'ar' ? 'أسبوعي' : lang === 'de' ? 'Wöchentlich' : 'Weekly';
  }
  if (recurrence === 'biweekly_a') {
    return lang === 'ar' ? 'أسبوع وأسبوع (أ)' : lang === 'de' ? 'Alle 2 Wochen (A)' : 'Bi-weekly (A)';
  }
  if (recurrence === 'biweekly_b') {
    return lang === 'ar' ? 'أسبوع وأسبوع (ب)' : lang === 'de' ? 'Alle 2 Wochen (B)' : 'Bi-weekly (B)';
  }
  return '';
}

/**
 * Returns current week alternating cycle ('A' or 'B') for today
 */
export function getCurrentAlternatingWeek(): 'A' | 'B' {
  return getAlternatingWeek(new Date());
}

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

  const rawSchedules = (group.schedules && group.schedules.length > 0)
    ? group.schedules
    : (Array.isArray((group as any).scheduleSlots) && (group as any).scheduleSlots.length > 0)
      ? ((group as any).scheduleSlots as GroupScheduleSlot[])
      : null;

  if (rawSchedules && rawSchedules.length > 0) {
    rawSchedules.forEach((s) => {
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

  const recBadge = group.scheduleRecurrence && group.scheduleRecurrence !== 'weekly'
    ? ` [${getRecurrenceLabel(group.scheduleRecurrence, lang)}]`
    : '';

  const firstTime = slots[0].time;
  const allSameTime = slots.every(s => s.time === firstTime);

  if (allSameTime) {
    const daysStr = slots.map(s => normalizeDayToDisplay(s.day, lang)).join(', ');
    return `${daysStr} @ ${firstTime}${recBadge}`;
  }

  return `${slots.map(s => `${normalizeDayToDisplay(s.day, lang)} @ ${s.time}`).join(' | ')}${recBadge}`;
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

/**
 * Projects recurring lessons indefinitely for active groups within any requested date range.
 * Merges with explicit stored lessons, giving full priority to explicit records (including past/completed,
 * custom edits, reschedule, attendance, notes, and deletions).
 */
export function getProjectedLessonsForRange(
  startDateStr: string,
  endDateStr: string,
  groups: Group[],
  explicitLessons: Lesson[],
  defaultZoomLink?: string,
  groupWeeklySessions?: GroupWeeklySession[],
  numberingBasisLessons?: Lesson[]
): Lesson[] {
  const activeGroups = (groups || []).filter(g => !g.deleted && g.status !== 'archived');
  const activeGroupIds = new Set(activeGroups.map(g => g.id));
  const groupsById = new Map<string, Group>(activeGroups.map(g => [g.id, g]));

  const explicit = (explicitLessons || []).filter(l => {
    if (l.deleted) return false;
    if (l.groupId && l.groupId !== 'quick_group' && !activeGroupIds.has(l.groupId)) return false;

    // Filter out unstarted scheduled lessons that don't match the active group's alternating recurrence
    if (l.groupId && l.status === 'scheduled') {
      const grp = groupsById.get(l.groupId);
      const effectiveRecurrence = (grp?.scheduleRecurrence && grp.scheduleRecurrence !== 'weekly')
        ? grp.scheduleRecurrence
        : (l.scheduleRecurrence || 'weekly');
      if (effectiveRecurrence !== 'weekly') {
        const hasEngagement = Boolean(
          l.report?.attendanceStatus ||
          l.report?.teacherNotes ||
          (l.amountPaid && l.amountPaid > 0) ||
          (l.studentPayments && Object.keys(l.studentPayments).length > 0)
        );
        if (!hasEngagement && !isDateMatchingGroupRecurrence(effectiveRecurrence, normalizeDateToISO(l.date) || l.date)) {
          return false; // Skip unstarted scheduled lesson on the wrong alternating week!
        }
      }
    }

    return true;
  });
  const explicitKeys = new Set<string>();
  const deletedKeys = new Set<string>();
  const cancelledKeys = new Set<string>();

  (explicitLessons || []).forEach(l => {
    if (l.groupId && l.date && l.time) {
      const normDate = normalizeDateToISO(l.date) || l.date.trim();
      const normTime = normalizeTime(l.time) || l.time.trim();
      const key = `${l.groupId}_${normDate}_${normTime}`;
      if (l.deleted) {
        deletedKeys.add(key);
      } else if (l.status === 'cancelled') {
        cancelledKeys.add(key);
        explicitKeys.add(key);
      } else {
        const grp = groupsById.get(l.groupId);
        const effectiveRecurrence = (grp?.scheduleRecurrence && grp.scheduleRecurrence !== 'weekly')
          ? grp.scheduleRecurrence
          : (l.scheduleRecurrence || 'weekly');
        const hasEngagement = Boolean(
          l.report?.attendanceStatus ||
          l.report?.teacherNotes ||
          (l.amountPaid && l.amountPaid > 0) ||
          (l.studentPayments && Object.keys(l.studentPayments).length > 0)
        );
        if (
          effectiveRecurrence === 'weekly' ||
          l.status !== 'scheduled' ||
          hasEngagement ||
          isDateMatchingGroupRecurrence(effectiveRecurrence, normDate)
        ) {
          explicitKeys.add(key);
        }
      }
    }
  });
  // Map non-deleted explicit lessons by group and normalized date to prevent projecting duplicate sessions
  // when a group has already completed or cancelled its scheduled session(s) on a given date.
  const explicitGroupDateMap = new Map<string, Lesson[]>();
  explicit.forEach(l => {
    if (l.groupId && l.date) {
      const normDate = normalizeDateToISO(l.date) || l.date.trim();
      const gDateKey = `${l.groupId}_${normDate}`;
      if (!explicitGroupDateMap.has(gDateKey)) explicitGroupDateMap.set(gDateKey, []);
      explicitGroupDateMap.get(gDateKey)!.push(l);
    }
  });

  const projected: Lesson[] = [];

  const normalizedEndDateStr = normalizeDateToISO(endDateStr) || endDateStr;
  const startD = parseLocalDate(startDateStr);
  startD.setHours(12, 0, 0, 0);
  const endD = parseLocalDate(normalizedEndDateStr);
  endD.setHours(12, 0, 0, 0);

  activeGroups.forEach(group => {
    const slots = getGroupScheduleSlots(group);
    if (slots.length === 0) return;

    const cursor = new Date(startD);
    cursor.setHours(12, 0, 0, 0);
    while (!isNaN(cursor.getTime()) && !isNaN(endD.getTime()) && formatLocalDate(cursor) <= normalizedEndDateStr) {
      const dayNum = cursor.getDay();
      const dateStr = formatLocalDate(cursor);

      // Check alternating week recurrence (Week A vs Week B)
      if (!isDateMatchingGroupRecurrence(group.scheduleRecurrence, cursor)) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      const matchingSlots = slots.filter(s => getDayNumber(s.day) === dayNum);
      const existingForGroupOnDate = explicitGroupDateMap.get(`${group.id}_${dateStr}`) || [];
      const hasCompletedOnDate = existingForGroupOnDate.some(
        l => l.status === 'completed' || l.status === 'cancelled' || (l.report && l.report.attendanceStatus)
      );

      // If group already held / completed / cancelled its session on this date, do not project redundant unstarted sessions on the same date!
      if (hasCompletedOnDate && existingForGroupOnDate.length >= matchingSlots.length) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      for (const slot of matchingSlots) {
        const sessionTime = slot.time || group.scheduleTime || '17:00';
        const normSessionTime = normalizeTime(sessionTime) || sessionTime.trim();
        const key = `${group.id}_${dateStr}_${normSessionTime}`;

        if (!explicitKeys.has(key) && !deletedKeys.has(key) && !cancelledKeys.has(key)) {
          const isPerLesson = group.paymentCycle === 'per_lesson' || group.paymentModel === 'per_session';
          const perSessionPrice = isPerLesson && group.pricePerSession
            ? group.pricePerSession
            : Math.round((group.monthlyPackagePrice || 1200) / (group.sessionCount || 8));

          const projectedWeekday = cursor.getDay();
          const resolvedSessionLink = Array.isArray(groupWeeklySessions)
            ? resolveActiveMeetingLinkForLesson({
                group,
                groupId: group.id,
                groupWeeklySessions,
                targetDay: projectedWeekday,
                targetTime: sessionTime
              })
            : '';

          projected.push({
            id: `l_auto_${group.id}_${dateStr}_${sessionTime.replace(':', '')}`,
            groupId: group.id,
            groupName: group.name,
            title: `${group.name} Lektion`,
            date: dateStr,
            time: sessionTime,
            durationMinutes: group.lessonDurationMinutes || 60,
            type: group.type,
            grade: group.grade,
            sessionNumber: 1,
            totalSessionsInPackage: group.sessionCount || 4,
            status: 'scheduled',
            paymentStatus: 'pending',
            amountDue: perSessionPrice,
            amountPaid: 0,
            meetingLink:
              group.type === 'online'
                ? Array.isArray(groupWeeklySessions)
                  ? resolvedSessionLink || undefined
                  : getGroupMeetingLink(group) || (isMeetGroup(group) ? undefined : defaultZoomLink)
                : undefined,
            locationAddress: group.type === 'offline' ? (group.address || 'Cairo Center') : undefined,
            scheduleRecurrence: group.scheduleRecurrence || 'weekly',
            biweeklyWeek: getAlternatingWeek(cursor)
          } as Lesson);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const combined = [...explicit, ...projected];
  const projectedIdSet = new Set(projected.map(p => p.id));
  const seenIds = new Set<string>();
  const uniqueLessons: Lesson[] = [];
  for (const l of combined) {
    if (!seenIds.has(l.id)) {
      seenIds.add(l.id);
      const grp = groupsById.get(l.groupId || '');
      const rec = (grp?.scheduleRecurrence && grp.scheduleRecurrence !== 'weekly')
        ? grp.scheduleRecurrence
        : (l.scheduleRecurrence || 'weekly');
      let effectiveMeetingLink = l.meetingLink;
      if (
        (l.type === 'online' || grp?.type === 'online') &&
        l.status !== 'completed' &&
        l.status !== 'cancelled' &&
        l.groupId
      ) {
        if (Array.isArray(groupWeeklySessions)) {
          const canonicalLink = resolveActiveMeetingLinkForLesson({
            group: grp,
            groupId: l.groupId,
            lesson: l,
            groupWeeklySessions
          });
          effectiveMeetingLink = canonicalLink || undefined;
        } else {
          const groupZoomUrl = getGroupMeetingLink(grp);
          const lessonMeetingUrl = (l.meetingLink || '').trim();
          effectiveMeetingLink = groupZoomUrl || lessonMeetingUrl || (isMeetGroup(grp) ? undefined : defaultZoomLink) || undefined;
        }
      }
      const nextLesson: Lesson = {
        ...l,
        scheduleRecurrence: rec,
        biweeklyWeek: l.biweeklyWeek || (l.date ? getAlternatingWeek(l.date) : undefined)
      };
      if (effectiveMeetingLink) {
        nextLesson.meetingLink = effectiveMeetingLink;
      } else if (
        Array.isArray(groupWeeklySessions) &&
        (l.type === 'online' || grp?.type === 'online') &&
        l.status !== 'completed' &&
        l.status !== 'cancelled'
      ) {
        delete nextLesson.meetingLink;
      }
      uniqueLessons.push(nextLesson);
    }
  }

  // Assign accurate sequential session numbers to newly projected lessons using the authoritative full basis
  if (projectedIdSet.size > 0) {
    const basisRaw = Array.isArray(numberingBasisLessons) && numberingBasisLessons.length > 0
      ? numberingBasisLessons
      : explicit;
    const basisById = new Map<string, Lesson>();
    for (const l of basisRaw) {
      if (l && l.id && !l.deleted && l.status !== 'cancelled') {
        basisById.set(l.id, l);
      }
    }
    for (const l of uniqueLessons) {
      if (l && l.id && !l.deleted && l.status !== 'cancelled' && !basisById.has(l.id)) {
        basisById.set(l.id, l);
      }
    }
    const allActiveBasis = Array.from(basisById.values());

    const normalizeTimeLocal = (t?: string): string => {
      if (!t) return '00:00';
      const parts = t.trim().split(':');
      if (parts.length === 2 && /^\d{1,2}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
      return t.trim();
    };
    const cmpChrono = (a: Partial<Lesson>, b: Partial<Lesson>) => {
      const kA = `${(a.date || '').trim()}T${normalizeTimeLocal(a.time)}`;
      const kB = `${(b.date || '').trim()}T${normalizeTimeLocal(b.time)}`;
      if (kA !== kB) return kA.localeCompare(kB);
      return String(a.id || '').localeCompare(String(b.id || ''));
    };

    const computedSessionById = new Map<string, { num: number; total: number }>();
    activeGroups.forEach(grp => {
      const isPerLesson = Boolean(
        grp.paymentCycle === 'per_lesson' ||
        grp.paymentModel === 'per_session' ||
        (grp.sessionCount !== undefined && grp.sessionCount <= 1)
      );
      const total = isPerLesson ? 1 : (grp.sessionCount && grp.sessionCount > 1 ? grp.sessionCount : 4);
      const grpNameLower = (grp.name || '').trim().toLowerCase();
      const grpLessons = allActiveBasis
        .filter(l => l.groupId === grp.id || (!l.groupId && grpNameLower && (l.groupName || '').trim().toLowerCase() === grpNameLower))
        .sort(cmpChrono);
      if (grpLessons.length === 0) return;

      const hasValidAnchor = Boolean(
        !isPerLesson &&
        grp.cycleAnchorSessionNumber &&
        grp.cycleAnchorSessionNumber >= 1 &&
        (grp.cycleAnchorLessonId || grp.cycleAnchorDate)
      );
      let anchorIndex = -1;
      const anchorSessionNum = hasValidAnchor
        ? Math.min(total, Math.max(1, Math.floor(grp.cycleAnchorSessionNumber!)))
        : 1;
      if (hasValidAnchor) {
        if (grp.cycleAnchorLessonId) {
          anchorIndex = grpLessons.findIndex(l => l.id === grp.cycleAnchorLessonId);
        }
        if (anchorIndex === -1 && grp.cycleAnchorDate) {
          const probe = { id: grp.cycleAnchorLessonId || '', date: grp.cycleAnchorDate, time: grp.cycleAnchorTime || '00:00' };
          const firstAtOrAfter = grpLessons.findIndex(l => cmpChrono(l, probe) >= 0);
          anchorIndex = firstAtOrAfter === -1 ? grpLessons.length : firstAtOrAfter;
        }
      }
      const startNum = Math.min(total, Math.max(1, grp.startingSessionNumber || 1));

      grpLessons.forEach((l, idx) => {
        if (!projectedIdSet.has(l.id)) return;
        const num = isPerLesson
          ? 1
          : anchorIndex !== -1
            ? ((((anchorSessionNum - 1 + (idx - anchorIndex)) % total) + total) % total) + 1
            : (((startNum - 1 + idx) % total) + 1);
        computedSessionById.set(l.id, { num, total });
      });
    });

    for (let i = 0; i < uniqueLessons.length; i++) {
      const calc = computedSessionById.get(uniqueLessons[i].id);
      if (calc) {
        uniqueLessons[i] = {
          ...uniqueLessons[i],
          sessionNumber: calc.num,
          totalSessionsInPackage: calc.total
        };
      }
    }
  }

  return uniqueLessons;
}

