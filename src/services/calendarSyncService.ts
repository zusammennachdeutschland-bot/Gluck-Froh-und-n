import { GoogleAuthProvider, linkWithPopup, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth';
import { auth } from '../shared/firebaseCloudSync';
import { GroupWeeklySession } from '../types';
import {
  DEFAULT_ZOOM_TIMEZONE,
  computeNextSessionStartWallTime,
  deriveDeterministicGoogleEventId,
  generateStableCalendarUid,
  toRRuleByDay
} from './zoomSessionStandardizer';

export interface CalendarSyncPreviewItem {
  sessionId: string;
  sessionCode: string;
  standardizedTitle: string;
  calendarEventUid: string;
  deterministicGoogleEventId: string;
  googleCalendarEventId?: string;
  googleCalendarIcalUid?: string;
  weekdayName: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  recurrence: GroupWeeklySession['recurrence'];
  zoomJoinUrl?: string;
  action: 'create' | 'update' | 'skip_synced';
}

export interface CalendarSyncResult {
  success: boolean;
  authExpired?: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  sessions: GroupWeeklySession[];
  errors: Array<{ sessionId: string; title: string; error: string; status?: number }>;
}

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// Strictly in-memory Google Calendar OAuth token (never written to localStorage/IndexedDB)
let inMemoryGoogleCalendarAccessToken: string | null = null;
let inMemoryTokenExpiresAtMs = 0;

export type CalendarFetchFn = typeof fetch;
let customCalendarFetchForTesting: CalendarFetchFn | null = null;

export function __setCalendarFetchForTesting(fn: CalendarFetchFn | null): void {
  customCalendarFetchForTesting = fn;
}

export function clearInMemoryGoogleCalendarToken(): void {
  inMemoryGoogleCalendarAccessToken = null;
  inMemoryTokenExpiresAtMs = 0;
}

export function getInMemoryGoogleCalendarToken(): string | null {
  if (!inMemoryGoogleCalendarAccessToken) return null;
  if (inMemoryTokenExpiresAtMs > 0 && Date.now() >= inMemoryTokenExpiresAtMs) {
    inMemoryGoogleCalendarAccessToken = null;
    inMemoryTokenExpiresAtMs = 0;
    return null;
  }
  return inMemoryGoogleCalendarAccessToken;
}

/**
 * Acquires a client-side Google Calendar OAuth access token via Firebase Auth GoogleAuthProvider popup
 * (reusing the single initialized Firebase app/auth instance).
 */
export async function requestGoogleCalendarAccessToken(forcePrompt = false): Promise<{
  ok: boolean;
  accessToken?: string;
  error?: string;
}> {
  if (!forcePrompt) {
    const existing = getInMemoryGoogleCalendarToken();
    if (existing) {
      return { ok: true, accessToken: existing };
    }
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope(GOOGLE_CALENDAR_SCOPE);
    provider.setCustomParameters({
      prompt: forcePrompt ? 'consent select_account' : 'consent'
    });

    let result;
    if (auth.currentUser) {
      const hasGoogleLinked = (auth.currentUser.providerData || []).some(
        (p) => p?.providerId === 'google.com'
      );
      if (hasGoogleLinked) {
        result = await reauthenticateWithPopup(auth.currentUser, provider);
      } else {
        try {
          result = await linkWithPopup(auth.currentUser, provider);
        } catch (linkErr: any) {
          if (linkErr?.code === 'auth/credential-already-in-use' || linkErr?.code === 'auth/provider-already-linked') {
            result = await signInWithPopup(auth, provider);
          } else {
            throw linkErr;
          }
        }
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      return {
        ok: false,
        error: 'Google authorization completed, but no Calendar access token was granted.'
      };
    }

    inMemoryGoogleCalendarAccessToken = accessToken;
    inMemoryTokenExpiresAtMs = Date.now() + 50 * 60 * 1000;
    return { ok: true, accessToken };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Google Calendar authorization failed or was cancelled.'
    };
  }
}

function escapeIcsText(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldIcsLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let idx = 0;
  while (idx < line.length) {
    const chunkSize = idx === 0 ? 74 : 73;
    parts.push((idx === 0 ? '' : ' ') + line.slice(idx, idx + chunkSize));
    idx += chunkSize;
  }
  return parts.join('\r\n');
}

function formatIcsLocalDateTime(dateYmd: string, startTimeHm: string, addMinutes = 0): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const [hh, mm] = startTimeHm.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + addMinutes, 0));
  const yy = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  const ho = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${yy}${mo}${da}T${ho}${mi}00`;
}

function formatIcsUtcStamp(date: Date = new Date()): string {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generates an RFC 5545 compliant `.ics` calendar file for one or more weekly sessions.
 * Uses immutable `session.calendarEventUid` (`gluck-session-{id}@glueck.app`) so re-importing
 * updates existing calendar events rather than creating duplicates.
 */
export function generateSessionsIcsContent(
  sessions: GroupWeeklySession[],
  options: { calendarName?: string; referenceDate?: Date } = {}
): string {
  const activeSessions = (sessions || []).filter((s) => s && !s.deleted);
  const calName = escapeIcsText(options.calendarName || 'Glück Weekly Zoom Sessions');
  const refDate = options.referenceDate || new Date();
  const dtStamp = formatIcsUtcStamp(refDate);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Glueck//Zoom Session Manager v2//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${calName}`)
  ];

  for (const s of activeSessions) {
    const uid = s.calendarEventUid || generateStableCalendarUid(s.id);
    const tz = s.timezone || DEFAULT_ZOOM_TIMEZONE;
    const { dateYmd } = computeNextSessionStartWallTime(s.weekday, s.startTime, tz, refDate, s.recurrence);
    const duration = Math.max(15, Number(s.durationMinutes) || 60);
    const dtStart = formatIcsLocalDateTime(dateYmd, s.startTime, 0);
    const dtEnd = formatIcsLocalDateTime(dateYmd, s.startTime, duration);
    const byDay = toRRuleByDay(s.weekday);
    const interval = s.recurrence === 'biweekly_a' || s.recurrence === 'biweekly_b' ? 2 : 1;
    const joinUrl = s.zoomJoinUrl || s.manualFallbackUrl || '';

    const descriptionLines = [
      `Group: ${s.groupNameSnapshot}`,
      `Session ID: ${s.sessionCode}`,
      `Standardized Title: ${s.standardizedTitle}`,
      joinUrl ? `Zoom Link: ${joinUrl}` : 'Zoom Link: Pending sync',
      s.zoomMeetingId ? `Zoom Meeting ID: ${s.zoomMeetingId}` : '',
      s.zoomPasscode ? `Passcode: ${s.zoomPasscode}` : '',
      `Timezone: ${tz}`
    ].filter(Boolean);

    lines.push('BEGIN:VEVENT');
    lines.push(foldIcsLine(`UID:${uid}`));
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(s.standardizedTitle)}`));
    lines.push(foldIcsLine(`DTSTART;TZID=${tz}:${dtStart}`));
    lines.push(foldIcsLine(`DTEND;TZID=${tz}:${dtEnd}`));
    lines.push(`RRULE:FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`);
    if (joinUrl) {
      lines.push(foldIcsLine(`LOCATION:${escapeIcsText(joinUrl)}`));
      lines.push(foldIcsLine(`URL:${joinUrl}`));
    }
    lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(descriptionLines.join('\n'))}`));
    lines.push(`SEQUENCE:${Math.max(0, Number(s.version || 1) - 1)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldIcsLine(`DESCRIPTION:Upcoming class: ${escapeIcsText(s.standardizedTitle)}`));
    lines.push('TRIGGER:-PT15M');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadSessionsIcsFile(
  sessions: GroupWeeklySession[],
  filename = 'glueck_zoom_schedule.ics'
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const icsContent = generateSessionsIcsContent(sessions);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Builds an explicit preview of Google Calendar mutations BEFORE calling write endpoints.
 */
export function buildGoogleCalendarSyncPreview(
  sessions: GroupWeeklySession[]
): {
  items: CalendarSyncPreviewItem[];
  createCount: number;
  updateCount: number;
  skipSyncedCount: number;
} {
  const active = (sessions || []).filter((s) => s && !s.deleted);
  const items: CalendarSyncPreviewItem[] = active.map((s) => {
    const uid = s.calendarEventUid || generateStableCalendarUid(s.id);
    const deterministicGoogleEventId = deriveDeterministicGoogleEventId(s.id);
    let action: CalendarSyncPreviewItem['action'] = 'create';
    if (s.googleCalendarEventId) {
      action = s.calendarSyncStatus === 'synced' ? 'skip_synced' : 'update';
    }
    return {
      sessionId: s.id,
      sessionCode: s.sessionCode,
      standardizedTitle: s.standardizedTitle,
      calendarEventUid: uid,
      deterministicGoogleEventId,
      googleCalendarEventId: s.googleCalendarEventId,
      googleCalendarIcalUid: s.googleCalendarIcalUid,
      weekdayName: s.weekdayName,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      timezone: s.timezone || DEFAULT_ZOOM_TIMEZONE,
      recurrence: s.recurrence,
      zoomJoinUrl: s.zoomJoinUrl || s.manualFallbackUrl,
      action
    };
  });

  return {
    items,
    createCount: items.filter((i) => i.action === 'create').length,
    updateCount: items.filter((i) => i.action === 'update').length,
    skipSyncedCount: items.filter((i) => i.action === 'skip_synced').length
  };
}

function addMinutesToIsoWallClock(startIsoLocal: string, minutes: number): string {
  const [datePart, timePart] = startIsoLocal.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes, 0));
  const yy = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  const ho = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${yy}-${mo}-${da}T${ho}:${mi}:00`;
}

async function resolveExistingGoogleEventId(params: {
  fetchFn: CalendarFetchFn;
  calendarId: string;
  accessToken: string;
  deterministicEventId: string;
  sessionId: string;
}): Promise<{ eventId?: string; iCalUID?: string; authExpired?: boolean }> {
  const headers = {
    Authorization: `Bearer ${params.accessToken}`,
    Accept: 'application/json'
  };

  // 1. Direct lookup using deterministic Google Calendar event.id (zero scanning of unrelated events)
  const directUrl = `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events/${encodeURIComponent(params.deterministicEventId)}`;
  const directRes = await params.fetchFn(directUrl, { method: 'GET', headers });
  if (directRes.status === 401) {
    return { authExpired: true };
  }
  if (directRes.ok) {
    const evt = await directRes.json();
    const ownerSessionId = evt?.extendedProperties?.private?.gluckSessionId;
    if (evt?.id && (!ownerSessionId || ownerSessionId === params.sessionId)) {
      return {
        eventId: String(evt.id),
        iCalUID: typeof evt.iCalUID === 'string' ? evt.iCalUID : undefined
      };
    }
  }

  // 2. Fallback lookup via supported privateExtendedProperty query parameter
  const propFilter = encodeURIComponent(`gluckSessionId=${params.sessionId}`);
  const propUrl = `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events?privateExtendedProperty=${propFilter}&showDeleted=true&maxResults=10`;
  const propRes = await params.fetchFn(propUrl, { method: 'GET', headers });
  if (propRes.status === 401) {
    return { authExpired: true };
  }
  if (propRes.ok) {
    const json = await propRes.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    const exactMatch = items.find(
      (item: any) =>
        item &&
        item.id &&
        item.extendedProperties?.private?.gluckSessionId === params.sessionId
    );
    if (exactMatch) {
      return {
        eventId: String(exactMatch.id),
        iCalUID: typeof exactMatch.iCalUID === 'string' ? exactMatch.iCalUID : undefined
      };
    }
  }

  return {};
}

/**
 * Syncs weekly sessions to Google Calendar v3 using a deterministic, valid `event.id` (`^[a-v0-9]{5,1024}$`)
 * and `privateExtendedProperty=gluckSessionId=...` lookups—never assigning custom `iCalUID` on `events.insert`
 * and never patching/deleting unrelated user Calendar events.
 * Stores returned Google `event.id` and Google `iCalUID` separately from Glück's immutable `calendarEventUid`.
 */
export async function syncSessionsToGoogleCalendar(params: {
  allSessions: GroupWeeklySession[];
  targetSessionIds?: Set<string>;
  accessToken: string;
  calendarId?: string;
  forceUpdateSynced?: boolean;
  referenceDate?: Date;
  onProgress?: (completed: number, total: number, title: string) => void;
}): Promise<CalendarSyncResult> {
  const fetchFn = customCalendarFetchForTesting || fetch;
  const calendarId = encodeURIComponent(params.calendarId || 'primary');
  const workingSessions = [...(params.allSessions || [])];

  const targets = workingSessions.filter((s) => {
    if (!s || s.deleted) return false;
    if (params.targetSessionIds && !params.targetSessionIds.has(s.id)) return false;
    if (!params.forceUpdateSynced && s.googleCalendarEventId && s.calendarSyncStatus === 'synced') {
      return false;
    }
    return true;
  });

  let createdCount = 0;
  let updatedCount = 0;
  const skippedCount = workingSessions.filter((s) => !s.deleted).length - targets.length;
  let failedCount = 0;
  let authExpired = false;
  const errors: Array<{ sessionId: string; title: string; error: string; status?: number }> = [];

  for (let i = 0; i < targets.length; i++) {
    const session = targets[i];
    params.onProgress?.(i, targets.length, session.standardizedTitle);

    const uid = session.calendarEventUid || generateStableCalendarUid(session.id);
    const deterministicEventId = deriveDeterministicGoogleEventId(session.id);
    const tz = session.timezone || DEFAULT_ZOOM_TIMEZONE;
    const { startTimeIsoLocal } = computeNextSessionStartWallTime(
      session.weekday,
      session.startTime,
      tz,
      params.referenceDate,
      session.recurrence
    );
    const endTimeIsoLocal = addMinutesToIsoWallClock(startTimeIsoLocal, Math.max(15, Number(session.durationMinutes) || 60));
    const byDay = toRRuleByDay(session.weekday);
    const interval = session.recurrence === 'biweekly_a' || session.recurrence === 'biweekly_b' ? 2 : 1;
    const joinUrl = session.zoomJoinUrl || session.manualFallbackUrl || '';

    const description = [
      `Glück Weekly Online Session`,
      `Session ID: ${session.sessionCode}`,
      `Group: ${session.groupNameSnapshot}`,
      joinUrl ? `Zoom Link: ${joinUrl}` : 'Zoom Link: Not yet generated',
      session.zoomMeetingId ? `Zoom Meeting ID: ${session.zoomMeetingId}` : '',
      session.zoomPasscode ? `Passcode: ${session.zoomPasscode}` : '',
      `Schedule UID: ${uid}`
    ]
      .filter(Boolean)
      .join('\n');

    // Mutable event resource fields (NEVER include iCalUID on insert or patch)
    const mutableEventBody = {
      summary: session.standardizedTitle,
      location: joinUrl || '',
      description,
      start: {
        dateTime: startTimeIsoLocal,
        timeZone: tz
      },
      end: {
        dateTime: endTimeIsoLocal,
        timeZone: tz
      },
      recurrence: [`RRULE:FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`],
      extendedProperties: {
        private: {
          gluckSessionId: session.id,
          gluckSessionCode: session.sessionCode,
          gluckGroupId: session.groupId,
          gluckCalendarUid: uid,
          ...(session.zoomMeetingId ? { zoomMeetingId: session.zoomMeetingId } : {})
        }
      }
    };

    const persistSyncedSession = (savedEvent: any, fallbackEventId: string, nowMs: number) => {
      const idx = workingSessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const returnedId = String(savedEvent?.id || fallbackEventId);
        const returnedIcalUid =
          typeof savedEvent?.iCalUID === 'string' && savedEvent.iCalUID.trim()
            ? savedEvent.iCalUID.trim()
            : workingSessions[idx].googleCalendarIcalUid;
        const isoNow = new Date(nowMs).toISOString();
        workingSessions[idx] = {
          ...workingSessions[idx],
          calendarEventUid: uid, // Remains strictly immutable for ICS & Grain matching
          googleCalendarEventId: returnedId,
          googleCalendarIcalUid: returnedIcalUid,
          calendarSyncStatus: 'synced',
          calendarSyncError: undefined,
          googleCalendarSyncedAt: isoNow,
          lastCalendarSyncedAt: isoNow,
          updatedAt: nowMs
        };
      }
    };

    const runPatch = async (targetEventId: string) => {
      const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(targetEventId)}`;
      return fetchFn(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          ...mutableEventBody,
          status: 'confirmed'
        })
      });
    };

    try {
      let existingEventId = session.googleCalendarEventId;

      if (!existingEventId) {
        const lookup = await resolveExistingGoogleEventId({
          fetchFn,
          calendarId,
          accessToken: params.accessToken,
          deterministicEventId,
          sessionId: session.id
        });
        if (lookup.authExpired) {
          clearInMemoryGoogleCalendarToken();
          authExpired = true;
          throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
            status: 401
          });
        }
        existingEventId = lookup.eventId;
      }

      const nowMs = Date.now();
      if (existingEventId) {
        const patchRes = await runPatch(existingEventId);
        if (patchRes.status === 401) {
          clearInMemoryGoogleCalendarToken();
          authExpired = true;
          throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
            status: 401
          });
        }
        if (patchRes.ok) {
          const updatedEvent = await patchRes.json();
          persistSyncedSession(updatedEvent, existingEventId, nowMs);
          updatedCount++;
          continue;
        }
        // If stored ID returned 404/410, probe via safe deterministic/extended-property lookup before inserting
        if (patchRes.status === 404 || patchRes.status === 410) {
          const fallbackLookup = await resolveExistingGoogleEventId({
            fetchFn,
            calendarId,
            accessToken: params.accessToken,
            deterministicEventId,
            sessionId: session.id
          });
          if (fallbackLookup.eventId && fallbackLookup.eventId !== existingEventId) {
            const retryPatch = await runPatch(fallbackLookup.eventId);
            if (retryPatch.ok) {
              const updatedEvent = await retryPatch.json();
              persistSyncedSession(updatedEvent, fallbackLookup.eventId, nowMs);
              updatedCount++;
              continue;
            }
          }
        } else {
          const errText = await patchRes.text().catch(() => '');
          throw Object.assign(
            new Error(errText || `Google Calendar PATCH returned HTTP ${patchRes.status}`),
            { status: patchRes.status }
          );
        }
      }

      // Create using deterministic valid Google Calendar event.id (`^[a-v0-9]{5,1024}$`), NEVER custom iCalUID
      const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
      const createRes = await fetchFn(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          id: deterministicEventId,
          ...mutableEventBody
        })
      });

      if (createRes.status === 401) {
        clearInMemoryGoogleCalendarToken();
        authExpired = true;
        throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
          status: 401
        });
      }

      // 409 Conflict: idempotent recovery when event with deterministic id already exists remotely (e.g. interrupted prior POST or deleted event)
      if (createRes.status === 409) {
        const conflictLookup = await resolveExistingGoogleEventId({
          fetchFn,
          calendarId,
          accessToken: params.accessToken,
          deterministicEventId,
          sessionId: session.id
        });
        const recoverTargetId = conflictLookup.eventId || deterministicEventId;
        const recoverPatch = await runPatch(recoverTargetId);
        if (recoverPatch.status === 401) {
          clearInMemoryGoogleCalendarToken();
          authExpired = true;
          throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
            status: 401
          });
        }
        if (!recoverPatch.ok) {
          const errText = await recoverPatch.text().catch(() => '');
          throw Object.assign(
            new Error(errText || `Google Calendar 409 recovery PATCH returned HTTP ${recoverPatch.status}`),
            { status: recoverPatch.status }
          );
        }
        const recoveredEvent = await recoverPatch.json();
        persistSyncedSession(recoveredEvent, recoverTargetId, nowMs);
        updatedCount++;
        continue;
      }

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => '');
        throw Object.assign(
          new Error(errText || `Google Calendar POST returned HTTP ${createRes.status}`),
          { status: createRes.status }
        );
      }

      const createdEvent = await createRes.json();
      persistSyncedSession(createdEvent, deterministicEventId, nowMs);
      createdCount++;
    } catch (err: any) {
      failedCount++;
      const errMsg = err?.message || 'Calendar sync failed.';
      errors.push({
        sessionId: session.id,
        title: session.standardizedTitle,
        error: errMsg,
        ...(typeof err?.status === 'number' ? { status: err.status } : {})
      });
      const failIdx = workingSessions.findIndex((s) => s.id === session.id);
      if (failIdx >= 0) {
        const nowFailMs = Date.now();
        workingSessions[failIdx] = {
          ...workingSessions[failIdx],
          calendarSyncStatus: 'error',
          calendarSyncError: errMsg,
          updatedAt: nowFailMs
        };
      }
      if (err?.status === 401) {
        authExpired = true;
        break;
      }
    }
  }

  return {
    success: failedCount === 0,
    ...(authExpired ? { authExpired: true } : {}),
    createdCount,
    updatedCount,
    skippedCount,
    failedCount,
    sessions: workingSessions,
    errors
  };
}

/**
 * Convenience wrapper for syncing or verifying ONE selected weekly session against Google Calendar.
 */
export async function syncSingleSessionToGoogleCalendar(params: {
  allSessions: GroupWeeklySession[];
  sessionId: string;
  accessToken: string;
  calendarId?: string;
  forceUpdateSynced?: boolean;
  referenceDate?: Date;
}): Promise<CalendarSyncResult> {
  return syncSessionsToGoogleCalendar({
    allSessions: params.allSessions,
    targetSessionIds: new Set([params.sessionId]),
    accessToken: params.accessToken,
    calendarId: params.calendarId,
    forceUpdateSynced: params.forceUpdateSynced,
    referenceDate: params.referenceDate
  });
}
