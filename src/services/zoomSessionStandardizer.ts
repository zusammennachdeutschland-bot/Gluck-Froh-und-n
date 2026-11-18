import {
  Group,
  GroupScheduleSlot,
  GroupWeeklySession,
  ScheduleRecurrence,
  ZoomMeetingHistory,
  ZoomMeetingRecord
} from '../types';
import { getDayNumber, getGroupScheduleSlots } from '../utils/scheduleUtils';

export const DEFAULT_ZOOM_TIMEZONE = 'Africa/Cairo';
export const ZOOM_MAX_TOPIC_LENGTH = 200;

const ENGLISH_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

const WEEKDAY_SHORT_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const RRULE_BYDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * Normalizes any weekday input (number 0..6, English, short key, German, or Arabic) to 0..6 (Sunday..Saturday).
 */
export function normalizeWeekdayIndex(dayInput: string | number | undefined | null): number {
  if (typeof dayInput === 'number' && Number.isInteger(dayInput) && dayInput >= 0 && dayInput <= 6) {
    return dayInput;
  }
  const str = String(dayInput ?? '').trim();
  if (!str) return -1;
  if (/^[0-6]$/.test(str)) {
    return parseInt(str, 10);
  }
  return getDayNumber(str);
}

/**
 * Returns the strict English weekday name required in standardized Zoom meeting titles.
 */
export function formatEnglishWeekday(dayInput: string | number): string {
  const idx = normalizeWeekdayIndex(dayInput);
  if (idx < 0 || idx > 6) return 'Monday';
  return ENGLISH_WEEKDAYS[idx];
}

/**
 * Returns the 3-letter uppercase weekday code for Session IDs (`MON`, `WED`, etc.).
 */
export function formatWeekdayShortCode(dayInput: string | number): string {
  const idx = normalizeWeekdayIndex(dayInput);
  if (idx < 0 || idx > 6) return 'MON';
  return WEEKDAY_SHORT_CODES[idx];
}

/**
 * Zoom API v2 `weekly_days` mapping: 1 = Sunday .. 7 = Saturday.
 */
export function toZoomWeeklyDayNumber(dayInput: string | number): number {
  const idx = normalizeWeekdayIndex(dayInput);
  return idx >= 0 && idx <= 6 ? idx + 1 : 2;
}

/**
 * RFC 5545 / Google Calendar RRULE BYDAY code (`SU` .. `SA`).
 */
export function toRRuleByDay(dayInput: string | number): string {
  const idx = normalizeWeekdayIndex(dayInput);
  return idx >= 0 && idx <= 6 ? RRULE_BYDAY_CODES[idx] : 'MO';
}

/**
 * Normalizes any time string (including 12h AM/PM or Arabic ص/م) to strict 24-hour `HH:mm`.
 */
export function normalize24HourTime(timeInput?: string | null, fallback = '17:00'): string {
  const raw = String(timeInput || '').trim();
  if (!raw) return fallback;

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|ص|م)?$/i.exec(raw);
  if (!match) return fallback;

  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const meridiem = (match[3] || '').toUpperCase();

  if (meridiem === 'PM' || meridiem === 'م') {
    if (hours < 12) hours += 12;
  } else if (meridiem === 'AM' || meridiem === 'ص') {
    if (hours === 12) hours = 0;
  }

  if (isNaN(hours) || isNaN(mins) || hours < 0 || hours > 23 || mins < 0 || mins > 59) {
    return fallback;
  }

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Builds the canonical standardized Zoom meeting title:
 * `"{Weekday} - {HH:mm} - {GroupName}"`
 * Examples:
 * - `"Monday - 19:00 - Grade 8 A1"`
 * - `"Wednesday - 15:00 - Grade 8 A1"`
 * Never includes student names.
 */
export function formatStandardizedZoomTopic(
  weekdayInput: string | number,
  startTimeInput: string,
  groupName: string
): string {
  const weekday = formatEnglishWeekday(weekdayInput);
  const timeHm = normalize24HourTime(startTimeInput);
  const cleanGroup = String(groupName || 'Online Group')
    .replace(/\s+/g, ' ')
    .trim() || 'Online Group';

  const prefix = `${weekday} - ${timeHm} - `;
  const maxGroupLen = Math.max(10, ZOOM_MAX_TOPIC_LENGTH - prefix.length);
  const truncatedGroup = cleanGroup.length > maxGroupLen
    ? `${cleanGroup.slice(0, maxGroupLen - 1).trim()}…`
    : cleanGroup;

  return `${prefix}${truncatedGroup}`;
}

/**
 * Parses a standardized Zoom/Grain topic back into its structural parts if it conforms to
 * `"{Weekday} - {HH:mm} - {GroupName}"`.
 */
export function parseStandardizedZoomTopic(topic?: string | null): {
  weekdayIndex: number;
  weekdayName: string;
  startTime: string;
  groupName: string;
} | null {
  const raw = String(topic || '').trim();
  if (!raw) return null;
  const match =
    /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*[-–—]\s*(\d{1,2}:\d{2})\s*[-–—]\s*(.+)$/i.exec(raw);
  if (!match) return null;
  const weekdayIndex = normalizeWeekdayIndex(match[1]);
  if (weekdayIndex < 0) return null;
  const startTime = normalize24HourTime(match[2], '');
  if (!startTime) return null;
  const groupName = match[3].trim();
  if (!groupName) return null;
  return {
    weekdayIndex,
    weekdayName: ENGLISH_WEEKDAYS[weekdayIndex],
    startTime,
    groupName
  };
}

/**
 * Generates a compact, human-readable prefix from a group name for Session Codes.
 * E.g. `"Grade 8 A1"` -> `"GR8A1"`, `"Deutsch Kurs B1"` -> `"DEUTB1"`.
 */
export function buildGroupPrefixCode(groupName: string, fallbackId?: string): string {
  const clean = String(groupName || '').trim();
  if (!clean) {
    const fb = String(fallbackId || 'GRP').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return fb.slice(0, 6) || 'GRP';
  }

  // Prefer extracting ASCII letters/numbers cleanly first
  const words = clean
    .replace(/grade\s*/gi, 'GR')
    .replace(/klasse\s*/gi, 'KL')
    .replace(/group\s*/gi, 'G')
    .split(/[^a-zA-Z0-9\u0600-\u06FF]+/)
    .filter(Boolean);

  let code = '';
  for (const w of words) {
    const ascii = w.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!ascii) continue;
    if (/^\d+$/.test(ascii) || /^[A-C][12]$/i.test(ascii) || /^GR\d+$/i.test(ascii)) {
      code += ascii;
    } else if (code.length < 4) {
      code += ascii.slice(0, Math.max(2, 5 - code.length));
    } else {
      code += ascii.slice(0, 2);
    }
    if (code.length >= 8) break;
  }

  code = code.replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (code.length >= 3) {
    return code;
  }

  // Deterministic short hash for purely Arabic or symbolic group names
  const fb = String(fallbackId || 'GRP').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hashTag = (hash >>> 0).toString(36).toUpperCase().slice(0, 4).padStart(4, '0');
  return `${code || fb.slice(0, 2) || 'GR'}${hashTag}`.slice(0, 8);
}

/**
 * Generates a unique readable Session Code (e.g. `GR8A1-MON-1900`).
 */
export function generateReadableSessionCode(
  groupName: string,
  weekdayInput: string | number,
  startTimeInput: string,
  existingCodes?: Set<string>,
  fallbackGroupId?: string
): string {
  const prefix = buildGroupPrefixCode(groupName, fallbackGroupId);
  const dayCode = formatWeekdayShortCode(weekdayInput);
  const timeCode = normalize24HourTime(startTimeInput).replace(':', '');
  const baseCode = `${prefix}-${dayCode}-${timeCode}`;

  if (!existingCodes || !existingCodes.has(baseCode)) {
    return baseCode;
  }

  let suffix = 2;
  while (existingCodes.has(`${baseCode}-${suffix}`)) {
    suffix++;
  }
  return `${baseCode}-${suffix}`;
}

/**
 * Generates an immutable RFC 5545 / ICS stable UID for a weekly session.
 * Independent of Google Calendar's internal event.id or server-generated iCalUID.
 */
export function generateStableCalendarUid(sessionId: string): string {
  const cleanId = String(sessionId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  return `gluck-session-${cleanId}@glueck.app`;
}

/**
 * Derives a deterministic, strictly valid Google Calendar API `event.id` from a Glück session ID.
 * Google Calendar v3 requires:
 * - Lowercase base32hex characters ONLY: `[0-9a-v]`
 * - Length between 5 and 1024 characters.
 * Encodes `glueck:${sessionId}` into lowercase hex `[0-9a-f]` (a strict subset of `[0-9a-v]`),
 * hashing deterministically only if the raw encoding would exceed 512 chars.
 */
export function deriveDeterministicGoogleEventId(sessionId: string): string {
  const cleanId = String(sessionId || '').trim() || 'session';
  const payload = `glueck:${cleanId}`;
  let hex = '';
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    if (code <= 0xff) {
      hex += code.toString(16).padStart(2, '0');
    } else {
      hex += code.toString(16).padStart(4, '0');
    }
  }
  if (hex.length >= 5 && hex.length <= 240) {
    return hex;
  }
  // Fallback deterministic multi-round FNV-1a 128-bit hex digest for unusually long IDs
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < payload.length; i++) {
    h1 ^= payload.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= payload.charCodeAt(i) + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${hex.slice(0, 64)}${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function getAlternatingWeekFromYmdUtc(dateYmd: string): 'A' | 'B' {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayMs = Date.UTC(y, m - 1, d + diffToMonday);
  const refMondayMs = Date.UTC(2026, 0, 5); // Anchor Monday: 2026-01-05 (Week A)
  const diffWeeks = Math.round((mondayMs - refMondayMs) / (7 * 24 * 60 * 60 * 1000));
  return Math.abs(diffWeeks) % 2 === 0 ? 'A' : 'B';
}

/**
 * Computes the next upcoming date YYYY-MM-DD for a weekly session weekday (and time)
 * in the configured timezone, returning an ISO-like wall-clock string `YYYY-MM-DDTHH:mm:00`
 * appropriate for Zoom `start_time` and Google Calendar `start.dateTime` when paired with `timeZone`.
 * Respects `biweekly_a` / `biweekly_b` alternating week parity relative to anchor Monday 2026-01-05.
 */
export function computeNextSessionStartWallTime(
  weekdayIdx: number,
  startTimeHm: string,
  timezone: string = DEFAULT_ZOOM_TIMEZONE,
  referenceDate: Date = new Date(),
  recurrence?: ScheduleRecurrence
): { dateYmd: string; startTimeIsoLocal: string } {
  const cleanTime = normalize24HourTime(startTimeHm);
  const safeIdx = weekdayIdx >= 0 && weekdayIdx <= 6 ? weekdayIdx : 1;

  // Format today's date in the target timezone using Intl
  let localYmd = '';
  let localWeekday = referenceDate.getDay();
  let localHm = '00:00';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || DEFAULT_ZOOM_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long'
    }).formatToParts(referenceDate);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    const hh = map.hour === '24' ? '00' : (map.hour || '00');
    localYmd = `${map.year}-${map.month}-${map.day}`;
    localHm = `${hh}:${map.minute || '00'}`;
    const parsedDay = normalizeWeekdayIndex(map.weekday);
    if (parsedDay >= 0) localWeekday = parsedDay;
  } catch {
    const y = referenceDate.getFullYear();
    const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const d = String(referenceDate.getDate()).padStart(2, '0');
    localYmd = `${y}-${m}-${d}`;
    localHm = `${String(referenceDate.getHours()).padStart(2, '0')}:${String(referenceDate.getMinutes()).padStart(2, '0')}`;
  }

  let dayDiff = safeIdx - localWeekday;
  if (dayDiff < 0 || (dayDiff === 0 && cleanTime <= localHm)) {
    dayDiff += 7;
  }

  const [y, m, d] = localYmd.split('-').map(Number);
  let targetUtc = new Date(Date.UTC(y, m - 1, d + dayDiff));
  let dateYmd = `${targetUtc.getUTCFullYear()}-${String(targetUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(targetUtc.getUTCDate()).padStart(2, '0')}`;

  if (recurrence === 'biweekly_a' || recurrence === 'biweekly_b') {
    const expectedWeek = recurrence === 'biweekly_a' ? 'A' : 'B';
    if (getAlternatingWeekFromYmdUtc(dateYmd) !== expectedWeek) {
      targetUtc = new Date(Date.UTC(y, m - 1, d + dayDiff + 7));
      dateYmd = `${targetUtc.getUTCFullYear()}-${String(targetUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(targetUtc.getUTCDate()).padStart(2, '0')}`;
    }
  }

  return {
    dateYmd,
    startTimeIsoLocal: `${dateYmd}T${cleanTime}:00`
  };
}

/**
 * Extracts canonical numeric Zoom meeting ID from any Zoom URL or numeric input.
 */
export function extractNumericZoomMeetingId(rawUrlOrId?: string | null): string | null {
  const raw = String(rawUrlOrId || '').trim();
  if (!raw) return null;
  if (/^\d{8,13}$/.test(raw)) return raw;
  const cleaned = raw.replace(/\s+/g, '');
  if (/^\d{8,13}$/.test(cleaned)) return cleaned;
  try {
    const parsed = new URL(raw);
    const pathMatch = /\/(?:j|wc|w|s)\/(\d{8,13})/i.exec(parsed.pathname);
    const confno = parsed.searchParams.get('confno');
    return pathMatch?.[1] || (confno && /^\d{8,13}$/.test(confno) ? confno : null);
  } catch {
    const fallbackMatch = /(\d{9,13})/.exec(cleaned);
    return fallbackMatch ? fallbackMatch[1] : null;
  }
}

/**
 * Builds canonical sanitized Zoom join URL if numeric ID is available, preserving ?pwd= if present.
 */
export function normalizeCanonicalZoomJoinUrl(rawUrl?: string | null): {
  valid: boolean;
  canonicalUrl?: string;
  meetingId?: string;
  passcode?: string;
} {
  const raw = String(rawUrl || '').trim();
  if (!raw) return { valid: false };
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const isZoomHost =
      host === 'zoom.us' ||
      host.endsWith('.zoom.us') ||
      host === 'zoom.com' ||
      host.endsWith('.zoom.com');
    if (!isZoomHost) return { valid: false };

    const meetingId = extractNumericZoomMeetingId(raw);
    const pwd = parsed.searchParams.get('pwd') || undefined;
    if (meetingId) {
      return {
        valid: true,
        canonicalUrl: pwd ? `https://zoom.us/j/${meetingId}?pwd=${encodeURIComponent(pwd)}` : `https://zoom.us/j/${meetingId}`,
        meetingId,
        passcode: pwd
      };
    }

    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (cleanPath && cleanPath !== '/') {
      return {
        valid: true,
        canonicalUrl: `https://${host}${cleanPath}${parsed.search}`,
        passcode: pwd
      };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export interface ReconcileGroupSessionsResult {
  sessions: GroupWeeklySession[];
  addedSessions: GroupWeeklySession[];
  updatedSessions: GroupWeeklySession[];
  archivedSessions: GroupWeeklySession[];
  historyEntries: ZoomMeetingHistory[];
  slotsMissingSchedule: boolean;
}

/**
 * Reconciles a single Group's schedule slots with existing `GroupWeeklySession[]`.
 * - Preserves internal session ID, `sessionCode`, `calendarEventUid`, active Zoom IDs across group renames.
 * - Flags `syncState = 'needs_update'` when an API-managed session's topic/day/time/duration/recurrence changes.
 * - Archives removed slots via `deleted: true` (never destroys ZoomMeetingHistory).
 * - Never touches historical `Lesson`s, attendance, grades, or payments.
 */
export function reconcileGroupWeeklySessions(options: {
  group: Group;
  existingSessions: GroupWeeklySession[];
  timezone?: string;
  nowMs?: number;
  deviceId?: string;
}): ReconcileGroupSessionsResult {
  const {
    group,
    existingSessions,
    timezone = DEFAULT_ZOOM_TIMEZONE,
    nowMs = Date.now(),
    deviceId = 'local_device'
  } = options;

  const nowIso = new Date(nowMs).toISOString();
  const groupSessions = (existingSessions || []).filter((s) => s && s.groupId === group.id && !s.deleted);
  const allActiveCodes = new Set(
    (existingSessions || [])
      .filter((s) => s && !s.deleted && s.sessionCode)
      .map((s) => s.sessionCode.toUpperCase())
  );

  // Offline or deleted groups archive any active weekly sessions softly without deleting history
  if (group.deleted || group.type !== 'online') {
    const archived = groupSessions.map((s) => ({
      ...s,
      deleted: true,
      updatedAt: nowMs,
      version: (s.version || 1) + 1
    }));
    const otherSessions = (existingSessions || []).filter((s) => s && s.groupId !== group.id);
    return {
      sessions: [...otherSessions, ...archived],
      addedSessions: [],
      updatedSessions: [],
      archivedSessions: archived,
      historyEntries: [],
      slotsMissingSchedule: false
    };
  }

  const rawSlots: GroupScheduleSlot[] = getGroupScheduleSlots(group);
  if (rawSlots.length === 0) {
    return {
      sessions: existingSessions || [],
      addedSessions: [],
      updatedSessions: [],
      archivedSessions: [],
      historyEntries: [],
      slotsMissingSchedule: true
    };
  }

  const durationMinutes = Math.max(15, Number(group.lessonDurationMinutes || group.duration || 60));
  const recurrence: ScheduleRecurrence = group.scheduleRecurrence || 'weekly';

  const normalizedSlots = rawSlots.map((slot) => {
    const weekday = normalizeWeekdayIndex(slot.day);
    const safeWeekday = weekday >= 0 ? weekday : 1;
    const startTime = normalize24HourTime(slot.time || group.scheduleTime || '17:00');
    return {
      weekday: safeWeekday,
      weekdayName: ENGLISH_WEEKDAYS[safeWeekday],
      startTime
    };
  });

  // Deduplicate identical day+time slots on the same group
  const dedupedSlots: typeof normalizedSlots = [];
  const seenSlotKeys = new Set<string>();
  for (const sl of normalizedSlots) {
    const key = `${sl.weekday}_${sl.startTime}`;
    if (!seenSlotKeys.has(key)) {
      seenSlotKeys.add(key);
      dedupedSlots.push(sl);
    }
  }

  const matchedExistingIds = new Set<string>();
  const addedSessions: GroupWeeklySession[] = [];
  const updatedSessions: GroupWeeklySession[] = [];
  const historyEntries: ZoomMeetingHistory[] = [];
  const nextGroupSessions: GroupWeeklySession[] = [];

  // Legacy group zoom URL (if present and valid)
  const legacyZoomParsed = normalizeCanonicalZoomJoinUrl(group.zoomLink);

  // Helper to claim best existing session for each normalized slot
  const pool = [...groupSessions];

  for (const slot of dedupedSlots) {
    // 1. Exact weekday + startTime match
    let matchedIdx = pool.findIndex(
      (s) => !matchedExistingIds.has(s.id) && s.weekday === slot.weekday && s.startTime === slot.startTime
    );
    // 2. Same weekday match (time edited)
    if (matchedIdx === -1) {
      matchedIdx = pool.findIndex((s) => !matchedExistingIds.has(s.id) && s.weekday === slot.weekday);
    }
    // 3. Single-to-single slot fallback (weekday & time changed when 1 slot -> 1 slot)
    if (matchedIdx === -1 && dedupedSlots.length === 1 && pool.filter((s) => !matchedExistingIds.has(s.id)).length === 1) {
      matchedIdx = pool.findIndex((s) => !matchedExistingIds.has(s.id));
    }

    const standardizedTitle = formatStandardizedZoomTopic(slot.weekday, slot.startTime, group.name);
    const effectiveTz = timezone || DEFAULT_ZOOM_TIMEZONE;

    if (matchedIdx >= 0) {
      const existing = pool[matchedIdx];
      matchedExistingIds.add(existing.id);

      const groupRenamed =
        Boolean(existing.groupNameSnapshot) && existing.groupNameSnapshot !== group.name;
      const scheduleChanged =
        existing.weekday !== slot.weekday ||
        existing.startTime !== slot.startTime ||
        existing.durationMinutes !== durationMinutes ||
        existing.recurrence !== recurrence;
      const topicChanged = existing.standardizedTitle !== standardizedTitle;

      const needsZoomPatch =
        existing.meetingSource === 'zoom_api' &&
        Boolean(existing.zoomMeetingId) &&
        (groupRenamed || scheduleChanged || topicChanged);
      const needsCalendarPatch =
        Boolean(existing.googleCalendarEventId) && (groupRenamed || scheduleChanged || topicChanged);

      const updated: GroupWeeklySession = {
        ...existing,
        groupNameSnapshot: group.name,
        weekday: slot.weekday,
        weekdayName: slot.weekdayName,
        startTime: slot.startTime,
        durationMinutes,
        timezone: existing.timezone || effectiveTz,
        recurrence,
        standardizedTitle,
        calendarEventUid: existing.calendarEventUid || generateStableCalendarUid(existing.id),
        syncState: needsZoomPatch
          ? 'needs_update'
          : existing.syncState,
        calendarSyncStatus: needsCalendarPatch
          ? 'needs_update'
          : existing.calendarSyncStatus || 'not_synced',
        planWarning40Min: durationMinutes >= 41 ? true : existing.planWarning40Min,
        updatedAt: (groupRenamed || scheduleChanged || topicChanged) ? nowMs : existing.updatedAt,
        version: (groupRenamed || scheduleChanged || topicChanged) ? (existing.version || 1) + 1 : existing.version
      };

      if (groupRenamed || scheduleChanged || topicChanged) {
        updatedSessions.push(updated);
        historyEntries.push({
          id: `zmhist_${existing.id}_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
          sessionId: existing.id,
          groupId: group.id,
          action: groupRenamed ? 'group_renamed' : 'schedule_changed',
          previousZoomMeetingId: existing.zoomMeetingId,
          previousJoinUrl: existing.zoomJoinUrl || existing.manualFallbackUrl,
          previousTopic: existing.standardizedTitle,
          newTopic: standardizedTitle,
          reason: groupRenamed
            ? `Group renamed from "${existing.groupNameSnapshot}" to "${group.name}"`
            : `Schedule slot updated (${existing.weekdayName} ${existing.startTime} -> ${slot.weekdayName} ${slot.startTime})`,
          recordedAt: nowIso,
          updatedAt: nowMs,
          originDeviceId: deviceId,
          originRevision: 1,
          deleted: false
        });
      }

      nextGroupSessions.push(updated);
    } else {
      const id = `gws_${group.id}_${slot.weekday}_${slot.startTime.replace(':', '')}_${Math.random().toString(36).slice(2, 6)}`;
      const sessionCode = generateReadableSessionCode(
        group.name,
        slot.weekday,
        slot.startTime,
        allActiveCodes,
        group.id
      );
      allActiveCodes.add(sessionCode.toUpperCase());

      const hasLegacyUrl = Boolean(legacyZoomParsed.valid && legacyZoomParsed.canonicalUrl);
      const newSession: GroupWeeklySession = {
        id,
        groupId: group.id,
        groupNameSnapshot: group.name,
        weekday: slot.weekday,
        weekdayName: slot.weekdayName,
        startTime: slot.startTime,
        durationMinutes,
        timezone: effectiveTz,
        recurrence,
        sessionCode,
        standardizedTitle,
        zoomMeetingId: legacyZoomParsed.meetingId,
        zoomJoinUrl: hasLegacyUrl ? legacyZoomParsed.canonicalUrl : undefined,
        zoomPasscode: legacyZoomParsed.passcode,
        manualFallbackUrl: hasLegacyUrl ? legacyZoomParsed.canonicalUrl : undefined,
        meetingSource: hasLegacyUrl ? 'legacy_migrated' : 'zoom_api',
        syncState: 'pending',
        calendarEventUid: generateStableCalendarUid(id),
        calendarSyncStatus: 'not_synced',
        planWarning40Min: durationMinutes >= 41 ? true : undefined,
        updatedAt: nowMs,
        originDeviceId: deviceId,
        originRevision: 1,
        deleted: false
      };

      addedSessions.push(newSession);
      nextGroupSessions.push(newSession);
    }
  }

  // Soft-archive unmatched sessions (no longer part of group schedule) while keeping ZoomMeetingHistory intact
  const archivedSessions: GroupWeeklySession[] = [];
  for (const s of groupSessions) {
    if (!matchedExistingIds.has(s.id)) {
      archivedSessions.push({
        ...s,
        deleted: true,
        updatedAt: nowMs,
        version: (s.version || 1) + 1
      });
    }
  }

  const otherSessions = (existingSessions || []).filter((s) => s && s.groupId !== group.id);
  return {
    sessions: [...otherSessions, ...nextGroupSessions, ...archivedSessions],
    addedSessions,
    updatedSessions,
    archivedSessions,
    historyEntries,
    slotsMissingSchedule: false
  };
}

/**
 * Helper to derive a sanitized ZoomMeetingRecord snapshot from an active GroupWeeklySession.
 */
export function buildZoomMeetingRecordFromSession(
  session: GroupWeeklySession,
  params: {
    zoomMeetingId: string;
    joinUrl: string;
    meetingPasscode?: string;
    hostEmail?: string;
    isBasicPlan?: boolean;
    nowMs?: number;
  }
): ZoomMeetingRecord {
  const nowMs = params.nowMs || Date.now();
  return {
    id: `zmr_${session.id}_${params.zoomMeetingId}`,
    sessionId: session.id,
    groupId: session.groupId,
    zoomMeetingId: params.zoomMeetingId,
    joinUrl: params.joinUrl,
    meetingPasscode: params.meetingPasscode,
    topic: session.standardizedTitle,
    startTime: session.startTime,
    durationMinutes: session.durationMinutes,
    timezone: session.timezone || DEFAULT_ZOOM_TIMEZONE,
    meetingType: 8,
    recurrenceWeeklyDay: toZoomWeeklyDayNumber(session.weekday),
    recurrenceRepeatInterval:
      session.recurrence === 'biweekly_a' || session.recurrence === 'biweekly_b' ? 2 : 1,
    hostEmail: params.hostEmail,
    status: 'active',
    planWarning40Min: Boolean(params.isBasicPlan && session.durationMinutes >= 41),
    syncedAt: new Date(nowMs).toISOString(),
    updatedAt: nowMs,
    deleted: false
  };
}
