import {
  Group,
  GroupWeeklySession,
  Lesson,
  Student,
  TeacherProfile,
  ZoomMeetingRecord
} from '../types';
import {
  getDayNumber,
  getGroupScheduleSlots,
  getProjectedLessonsForRange,
  NUM_TO_ENGLISH_DAY
} from '../utils/scheduleUtils';
import { formatLocalDate, normalizeDateToISO, parseLocalDate } from '../utils/timeUtils';
import {
  DEFAULT_ZOOM_TIMEZONE,
  resolveActiveWeeklySessionForLesson,
  resolveActiveZoomLinkForLesson
} from './zoomSessionStandardizer';

export interface AiExportedOriginalSchedule {
  weekday: string;
  startTime: string;
  recurrence: string;
}

export interface AiExportedMeeting {
  id: string;
  title: string;
  studentName: string | null;
  groupName: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  timeZone: string;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomPasscode: string | null;
  zoomHostEmail: string | null;
  location: string | null;
  type: 'online' | 'offline';
  recurrence: string | null;
  originalSchedule: AiExportedOriginalSchedule | null;
  notes: string | null;
  status: string;
  sessionCode: string | null;
}

export interface AiMeetingsExportPayload {
  formatVersion: 1;
  exportedAt: string;
  timeZone: string;
  rangeStartDate: string;
  rangeEndDate: string;
  meetingCount: number;
  meetings: AiExportedMeeting[];
}

export interface BuildAiMeetingsExportParams {
  groups: Group[];
  lessons: Lesson[];
  students?: Student[];
  groupWeeklySessions?: GroupWeeklySession[];
  zoomMeetingRecords?: ZoomMeetingRecord[];
  profile?: Partial<TeacherProfile>;
  zoomHostEmail?: string | null;
  referenceDate?: Date;
  horizonDays?: number;
  includeOffline?: boolean;
  includeCompleted?: boolean;
  includeCancelled?: boolean;
}

function normalizeTimeHHMM(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(AM|PM|ص|م)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm === 'PM' || ampm === 'م') {
    if (hours < 12) hours += 12;
  } else if (ampm === 'AM' || ampm === 'ص') {
    if (hours === 12) hours = 0;
  }
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function computeEndTimeHHMM(startTime: string | null, durationMinutes: number | null): string | null {
  if (!startTime || !durationMinutes || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null;
  }
  const [hh, mm] = startTime.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const totalMins = (hh * 60 + mm + Math.round(durationMinutes)) % (24 * 60);
  const endH = Math.floor(totalMins / 60);
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function nonEmptyOrNull(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractZoomMeetingIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/j\/(\d{8,14})/i);
  return match ? match[1] : null;
}

function resolveOriginalSchedule(
  lesson: Lesson,
  group: Group | undefined,
  matchedSession: GroupWeeklySession | null
): AiExportedOriginalSchedule | null {
  if (matchedSession) {
    return {
      weekday: matchedSession.weekdayName || NUM_TO_ENGLISH_DAY[matchedSession.weekday] || String(matchedSession.weekday),
      startTime: normalizeTimeHHMM(matchedSession.startTime) || matchedSession.startTime,
      recurrence: matchedSession.recurrence || group?.scheduleRecurrence || 'weekly'
    };
  }
  if (!group) return null;
  const slots = getGroupScheduleSlots(group);
  if (slots.length === 0) return null;

  // Match by lesson's weekday if possible, otherwise fall back to first configured slot
  const lessonDate = lesson.date ? parseLocalDate(lesson.date) : null;
  const lessonDayNum = lessonDate && !Number.isNaN(lessonDate.getTime()) ? lessonDate.getDay() : -1;
  const matchingSlot =
    slots.find((s) => getDayNumber(s.day) === lessonDayNum) ||
    slots[0];

  if (!matchingSlot) return null;
  const slotDayNum = getDayNumber(matchingSlot.day);
  return {
    weekday: slotDayNum !== -1 ? NUM_TO_ENGLISH_DAY[slotDayNum] : matchingSlot.day,
    startTime: normalizeTimeHHMM(matchingSlot.time) || matchingSlot.time,
    recurrence: group.scheduleRecurrence || lesson.scheduleRecurrence || 'weekly'
  };
}

/**
 * Builds the authoritative full upcoming meetings export for AI tools.
 * Uses the real schedule projection engine (`getProjectedLessonsForRange`) combined with
 * `groups`, `students`, `lessons`, `groupWeeklySessions`, and `zoomMeetingRecords` so
 * recurring, edited, online, and offline meetings are exported completely without duplicates
 * and without inventing missing fields.
 */
export function buildAllMeetingsExportForAi(params: BuildAiMeetingsExportParams): AiMeetingsExportPayload {
  const referenceDate = params.referenceDate ? new Date(params.referenceDate.getTime()) : new Date();
  const horizonDays = Math.max(1, Math.min(365, Math.floor(params.horizonDays ?? 90)));
  const includeOffline = params.includeOffline !== false;
  const includeCompleted = Boolean(params.includeCompleted);
  const includeCancelled = Boolean(params.includeCancelled);

  const rangeStartDate = formatLocalDate(referenceDate);
  const endDateObj = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + horizonDays
  );
  const rangeEndDate = formatLocalDate(endDateObj);

  const defaultTimeZone =
    nonEmptyOrNull(params.profile?.defaultZoomTimezone) || DEFAULT_ZOOM_TIMEZONE;
  const hostEmail = nonEmptyOrNull(params.zoomHostEmail);

  const allGroups = Array.isArray(params.groups) ? params.groups : [];
  const activeGroups = allGroups.filter((g) => g && !g.deleted && g.status !== 'archived');
  const groupsById = new Map<string, Group>(activeGroups.map((g) => [g.id, g]));

  const allLessons = Array.isArray(params.lessons) ? params.lessons : [];
  const allStudents = Array.isArray(params.students) ? params.students.filter((s) => s && !s.deleted) : [];
  const weeklySessions = Array.isArray(params.groupWeeklySessions)
    ? params.groupWeeklySessions.filter((s) => s && !s.deleted)
    : [];
  const zoomRecords = Array.isArray(params.zoomMeetingRecords) ? params.zoomMeetingRecords : [];
  const recordsBySessionId = new Map<string, ZoomMeetingRecord>();
  const recordsByMeetingId = new Map<string, ZoomMeetingRecord>();
  for (const rec of zoomRecords) {
    if (!rec || rec.status === 'deleted' || rec.status === 'replaced' || rec.status === 'superseded') continue;
    if (rec.sessionId && !recordsBySessionId.has(rec.sessionId)) {
      recordsBySessionId.set(rec.sessionId, rec);
    }
    if (rec.zoomMeetingId && !recordsByMeetingId.has(rec.zoomMeetingId)) {
      recordsByMeetingId.set(rec.zoomMeetingId, rec);
    }
  }

  // Group -> active student names map
  const studentsByGroupId = new Map<string, string[]>();
  for (const student of allStudents) {
    const cleanName = nonEmptyOrNull(student.name);
    if (!cleanName) continue;
    const gIds = new Set<string>();
    if (student.groupId) gIds.add(student.groupId);
    const extraGroupIds = (student as any).groupIds;
    if (Array.isArray(extraGroupIds)) {
      for (const gid of extraGroupIds) {
        if (gid) gIds.add(gid);
      }
    }
    gIds.forEach((gid) => {
      if (!studentsByGroupId.has(gid)) studentsByGroupId.set(gid, []);
      const list = studentsByGroupId.get(gid)!;
      if (!list.includes(cleanName)) list.push(cleanName);
    });
  }

  // Authoritative schedule + recurring occurrence projection
  const projectedPool = getProjectedLessonsForRange(
    rangeStartDate,
    rangeEndDate,
    allGroups,
    allLessons,
    undefined,
    params.groupWeeklySessions,
    allLessons
  );

  // Build explicit lesson ID set so explicit records always win if any slot overlaps
  const explicitIds = new Set(allLessons.filter((l) => l && !l.deleted).map((l) => l.id));

  // Filter to upcoming range, non-deleted, active groups, and respect status/type filters
  const candidates = projectedPool.filter((lesson) => {
    if (!lesson || lesson.deleted) return false;
    const isoDate = normalizeDateToISO(lesson.date) || (lesson.date || '').trim();
    if (!isoDate) return false;
    if (isoDate < rangeStartDate) return false;
    if (lesson.groupId && lesson.groupId !== 'quick_group' && !groupsById.has(lesson.groupId)) {
      return false;
    }
    if (!includeCancelled && lesson.status === 'cancelled') return false;
    if (!includeCompleted && lesson.status === 'completed') return false;

    const grp = lesson.groupId ? groupsById.get(lesson.groupId) : undefined;
    const effectiveType: 'online' | 'offline' =
      lesson.type === 'offline' || (!lesson.type && grp?.type === 'offline') ? 'offline' : 'online';
    if (!includeOffline && effectiveType === 'offline') return false;

    return true;
  });

  // Deduplicate strictly by ID and by (groupId, date, startTime), prioritizing explicit edited lessons over projected ones
  const dedupedById = new Map<string, Lesson>();
  for (const lesson of candidates) {
    const existing = dedupedById.get(lesson.id);
    if (!existing) {
      dedupedById.set(lesson.id, lesson);
    } else if (explicitIds.has(lesson.id) && !explicitIds.has(existing.id)) {
      dedupedById.set(lesson.id, lesson);
    }
  }

  const dedupedBySlot = new Map<string, Lesson>();
  for (const lesson of dedupedById.values()) {
    const isoDate = normalizeDateToISO(lesson.date) || lesson.date.trim();
    const normTime = normalizeTimeHHMM(lesson.time) || 'no_time';
    const slotKey = lesson.groupId
      ? `${lesson.groupId}__${isoDate}__${normTime}`
      : `standalone__${lesson.id}`;
    const existing = dedupedBySlot.get(slotKey);
    if (!existing) {
      dedupedBySlot.set(slotKey, lesson);
    } else {
      const incomingIsExplicit = explicitIds.has(lesson.id);
      const existingIsExplicit = explicitIds.has(existing.id);
      if (incomingIsExplicit && !existingIsExplicit) {
        dedupedBySlot.set(slotKey, lesson);
      } else if (incomingIsExplicit === existingIsExplicit) {
        const incUpdated = Number(lesson.updatedAt || 0);
        const exUpdated = Number(existing.updatedAt || 0);
        if (incUpdated > exUpdated) {
          dedupedBySlot.set(slotKey, lesson);
        }
      }
    }
  }

  const meetings: AiExportedMeeting[] = Array.from(dedupedBySlot.values()).map((lesson) => {
    const isoDate = normalizeDateToISO(lesson.date) || lesson.date.trim();
    const grp = lesson.groupId ? groupsById.get(lesson.groupId) : undefined;
    const effectiveType: 'online' | 'offline' =
      lesson.type === 'offline' || (!lesson.type && grp?.type === 'offline') ? 'offline' : 'online';

    const startTime = normalizeTimeHHMM(lesson.time);
    const rawDuration = Number(lesson.durationMinutes || grp?.lessonDurationMinutes || 0);
    const durationMinutes = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : null;
    const endTime = computeEndTimeHHMM(startTime, durationMinutes);

    const matchedSession =
      lesson.groupId && weeklySessions.length > 0
        ? resolveActiveWeeklySessionForLesson({
            group: grp,
            groupId: lesson.groupId,
            lesson,
            groupWeeklySessions: weeklySessions
          })
        : null;

    const matchedRecord = matchedSession
      ? recordsBySessionId.get(matchedSession.id) ||
        (matchedSession.zoomMeetingId ? recordsByMeetingId.get(matchedSession.zoomMeetingId) : undefined)
      : undefined;

    const timeZone =
      nonEmptyOrNull(matchedSession?.timezone) ||
      nonEmptyOrNull(matchedRecord?.timezone) ||
      defaultTimeZone;

    // Strictly resolve Zoom data ONLY for online lessons; never fabricate missing links/IDs/passcodes
    let zoomJoinUrl: string | null = null;
    let zoomMeetingId: string | null = null;
    let zoomPasscode: string | null = null;
    let effectiveHostEmail: string | null = null;

    if (effectiveType === 'online') {
      const canonicalResolved = resolveActiveZoomLinkForLesson({
        group: grp,
        groupId: lesson.groupId,
        lesson,
        groupWeeklySessions: weeklySessions
      });
      zoomJoinUrl =
        nonEmptyOrNull(canonicalResolved) ||
        nonEmptyOrNull(matchedSession?.zoomJoinUrl) ||
        nonEmptyOrNull(matchedRecord?.joinUrl) ||
        nonEmptyOrNull(lesson.meetingLink) ||
        nonEmptyOrNull(grp?.zoomLink) ||
        nonEmptyOrNull(grp?.meetLink);

      zoomMeetingId =
        nonEmptyOrNull(matchedSession?.zoomMeetingId) ||
        nonEmptyOrNull(matchedRecord?.zoomMeetingId) ||
        extractZoomMeetingIdFromUrl(zoomJoinUrl);

      zoomPasscode =
        nonEmptyOrNull(matchedSession?.zoomPasscode) ||
        nonEmptyOrNull(matchedRecord?.meetingPasscode);

      effectiveHostEmail = zoomJoinUrl || zoomMeetingId ? hostEmail : null;
    }

    const location =
      effectiveType === 'offline'
        ? nonEmptyOrNull(lesson.locationAddress) ||
          nonEmptyOrNull(matchedSession?.locationAddress) ||
          nonEmptyOrNull(grp?.address)
        : zoomJoinUrl;

    const groupStudents = lesson.groupId ? studentsByGroupId.get(lesson.groupId) || [] : [];
    const studentName =
      groupStudents.length > 0
        ? groupStudents.join(', ')
        : nonEmptyOrNull((lesson as any).studentName);

    const groupName = nonEmptyOrNull(lesson.groupName) || nonEmptyOrNull(grp?.name);
    const title =
      nonEmptyOrNull(matchedSession?.standardizedTitle) ||
      nonEmptyOrNull(lesson.title) ||
      (groupName ? `${groupName} Lesson` : 'Lesson');

    const recurrence =
      nonEmptyOrNull(matchedSession?.recurrence) ||
      nonEmptyOrNull(grp?.scheduleRecurrence) ||
      nonEmptyOrNull(lesson.scheduleRecurrence);

    const notes =
      nonEmptyOrNull(lesson.notes) ||
      nonEmptyOrNull(lesson.report?.teacherNotes) ||
      nonEmptyOrNull(lesson.topic);

    const sessionCode = nonEmptyOrNull(matchedSession?.sessionCode);

    return {
      id: lesson.id,
      title,
      studentName,
      groupName,
      date: isoDate,
      startTime,
      endTime,
      durationMinutes,
      timeZone,
      zoomMeetingId,
      zoomJoinUrl,
      zoomPasscode,
      zoomHostEmail: effectiveHostEmail,
      location,
      type: effectiveType,
      recurrence,
      originalSchedule: resolveOriginalSchedule(lesson, grp, matchedSession),
      notes,
      status: lesson.status || 'scheduled',
      sessionCode
    };
  });

  meetings.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    if (timeCmp !== 0) return timeCmp;
    const titleCmp = a.title.localeCompare(b.title);
    if (titleCmp !== 0) return titleCmp;
    return a.id.localeCompare(b.id);
  });

  return {
    formatVersion: 1,
    exportedAt: referenceDate.toISOString(),
    timeZone: defaultTimeZone,
    rangeStartDate,
    rangeEndDate,
    meetingCount: meetings.length,
    meetings
  };
}

export function formatMeetingsExportJson(payload: AiMeetingsExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function formatMeetingsExportMarkdown(payload: AiMeetingsExportPayload): string {
  const lines: string[] = [
    '# Upcoming Meetings Export',
    '',
    `- Exported At: ${payload.exportedAt}`,
    `- Default Time Zone: ${payload.timeZone}`,
    `- Range: ${payload.rangeStartDate} to ${payload.rangeEndDate}`,
    `- Meeting Count: ${payload.meetingCount}`,
    ''
  ];

  if (payload.meetings.length === 0) {
    lines.push('_No upcoming meetings found in this range._');
    return lines.join('\n');
  }

  for (let i = 0; i < payload.meetings.length; i++) {
    const m = payload.meetings[i];
    const timeRange = m.startTime
      ? m.endTime
        ? `${m.startTime}–${m.endTime}`
        : m.startTime
      : 'Time not set';
    lines.push(`## ${i + 1}. ${m.date} ${timeRange} — ${m.title}`);
    lines.push(`- ID: ${m.id}`);
    lines.push(`- Type: ${m.type}`);
    lines.push(`- Status: ${m.status}`);
    if (m.groupName) lines.push(`- Group: ${m.groupName}`);
    if (m.studentName) lines.push(`- Student(s): ${m.studentName}`);
    lines.push(`- Time Zone: ${m.timeZone}`);
    if (m.durationMinutes !== null) lines.push(`- Duration: ${m.durationMinutes} min`);
    if (m.recurrence) lines.push(`- Recurrence: ${m.recurrence}`);
    if (m.sessionCode) lines.push(`- Session Code: ${m.sessionCode}`);
    if (m.zoomMeetingId) lines.push(`- Zoom Meeting ID: ${m.zoomMeetingId}`);
    if (m.zoomJoinUrl) lines.push(`- Zoom Join URL: ${m.zoomJoinUrl}`);
    if (m.zoomPasscode) lines.push(`- Zoom Passcode: ${m.zoomPasscode}`);
    if (m.zoomHostEmail) lines.push(`- Zoom Host Email: ${m.zoomHostEmail}`);
    if (m.location && m.location !== m.zoomJoinUrl) lines.push(`- Location: ${m.location}`);
    if (m.originalSchedule) {
      lines.push(
        `- Original Schedule: ${m.originalSchedule.weekday} ${m.originalSchedule.startTime} (${m.originalSchedule.recurrence})`
      );
    }
    if (m.notes) lines.push(`- Notes: ${m.notes}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadTextFileFallback(content: string, filename: string, mimeType: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
