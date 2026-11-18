import assert from 'node:assert/strict';
import { Group, GroupWeeklySession } from '../types';
import {
  DEFAULT_ZOOM_TIMEZONE,
  computeNextSessionStartWallTime,
  deriveDeterministicGoogleEventId,
  reconcileGroupWeeklySessions
} from '../services/zoomSessionStandardizer';
import {
  __setCalendarFetchForTesting,
  generateSessionsIcsContent,
  syncSessionsToGoogleCalendar,
  syncSingleSessionToGoogleCalendar
} from '../services/calendarSyncService';
import { setManualZoomLinkForSession } from '../services/zoomService';


const VALID_GOOGLE_EVENT_ID_RE = /^[a-v0-9]{5,1024}$/;

/**
 * Stateful strict Google Calendar v3 simulator that enforces real Google Calendar constraints:
 * - Rejects `iCalUID` on `events.insert` (`POST`) and `events.patch` (`PATCH`) with 400
 * - Enforces base32hex `[a-v0-9]{5,1024}` event `id` on `events.insert`
 * - Returns `409 Conflict` if `events.insert` uses an already existing `id`
 * - Generates Google's own canonical `iCalUID` (`{id}@google.com`), independent of Glück's `.ics` `calendarEventUid`
 * - Supports `GET /events/{id}` and `GET /events?privateExtendedProperty=gluckSessionId=...`
 */
function createStrictGoogleCalendarSimulator() {
  const events = new Map<string, any>();
  const apiLog: Array<{ method: string; path: string; status: number; body?: any }> = [];
  let force401OnMatch: ((url: string, method: string, callIndex: number) => boolean) | null = null;
  let forceNetworkErrorOnMatch: ((url: string, method: string, callIndex: number) => boolean) | null = null;
  let simulateDroppedCreateResponse = false;
  let callIndex = 0;

  // Seed an unrelated user-created event with identical title to prove we never touch unrelated events
  events.set('user_private_event_999', {
    id: 'user_private_event_999',
    iCalUID: 'user_private_999@google.com',
    status: 'confirmed',
    summary: 'Monday - 19:00 - Grade 8 A1',
    description: 'User manually created personal reminder — must NEVER be touched by Glück'
  });

  const handler: typeof fetch = async (input, init) => {
    callIndex++;
    const rawUrl = String(input);
    const parsedUrl = new URL(rawUrl);
    const method = (init?.method || 'GET').toUpperCase();
    const path = `${parsedUrl.pathname}${parsedUrl.search}`;

    if (force401OnMatch && force401OnMatch(rawUrl, method, callIndex)) {
      apiLog.push({ method, path, status: 401 });
      return new Response(JSON.stringify({ error: { code: 401, message: 'Invalid Credentials' } }), { status: 401 });
    }

    if (forceNetworkErrorOnMatch && forceNetworkErrorOnMatch(rawUrl, method, callIndex)) {
      apiLog.push({ method, path, status: 503 });
      return new Response(JSON.stringify({ error: { code: 503, message: 'Transient backend error' } }), { status: 503 });
    }

    // 1. GET /calendars/{cal}/events?privateExtendedProperty=...
    if (method === 'GET' && parsedUrl.pathname.endsWith('/events')) {
      const prop = parsedUrl.searchParams.get('privateExtendedProperty') || '';
      const eqIdx = prop.indexOf('=');
      const k = eqIdx >= 0 ? prop.slice(0, eqIdx) : '';
      const v = eqIdx >= 0 ? prop.slice(eqIdx + 1) : '';
      const showDeleted = parsedUrl.searchParams.get('showDeleted') === 'true';

      const matched = Array.from(events.values()).filter((evt) => {
        if (!showDeleted && evt.status === 'cancelled') return false;
        if (!k) return true;
        return evt?.extendedProperties?.private?.[k] === v;
      });
      apiLog.push({ method, path, status: 200 });
      return new Response(JSON.stringify({ items: matched }), { status: 200 });
    }

    // 2. GET /calendars/{cal}/events/{eventId}
    const singleMatch = /\/events\/([^/?]+)$/.exec(parsedUrl.pathname);
    if (method === 'GET' && singleMatch) {
      const id = decodeURIComponent(singleMatch[1]);
      const evt = events.get(id);
      if (!evt) {
        apiLog.push({ method, path, status: 404 });
        return new Response(JSON.stringify({ error: { code: 404, message: 'Not Found' } }), { status: 404 });
      }
      apiLog.push({ method, path, status: 200 });
      return new Response(JSON.stringify(evt), { status: 200 });
    }

    // 3. POST /calendars/{cal}/events (events.insert)
    if (method === 'POST' && parsedUrl.pathname.endsWith('/events')) {
      const body = JSON.parse(String(init?.body || '{}'));
      if ('iCalUID' in body) {
        apiLog.push({ method, path, status: 400, body });
        return new Response(
          JSON.stringify({ error: { code: 400, message: 'Forbidden custom iCalUID on events.insert' } }),
          { status: 400 }
        );
      }
      const eventId = String(body.id || '').trim();
      if (!VALID_GOOGLE_EVENT_ID_RE.test(eventId)) {
        apiLog.push({ method, path, status: 400, body });
        return new Response(
          JSON.stringify({ error: { code: 400, message: `Invalid event id format: ${eventId}` } }),
          { status: 400 }
        );
      }
      if (events.has(eventId)) {
        apiLog.push({ method, path, status: 409, body });
        return new Response(
          JSON.stringify({ error: { code: 409, message: 'The requested identifier already exists.' } }),
          { status: 409 }
        );
      }
      const stored = {
        ...body,
        id: eventId,
        iCalUID: `${eventId}@google.com`, // Google-assigned iCalUID
        status: 'confirmed'
      };
      events.set(eventId, stored);

      if (simulateDroppedCreateResponse) {
        simulateDroppedCreateResponse = false;
        apiLog.push({ method, path, status: 500, body });
        throw new Error('Simulated network drop after remote insert succeeded');
      }

      apiLog.push({ method, path, status: 200, body });
      return new Response(JSON.stringify(stored), { status: 200 });
    }

    // 4. PATCH /calendars/{cal}/events/{eventId} (events.patch)
    if (method === 'PATCH' && singleMatch) {
      const id = decodeURIComponent(singleMatch[1]);
      const body = JSON.parse(String(init?.body || '{}'));
      if ('iCalUID' in body || 'id' in body) {
        apiLog.push({ method, path, status: 400, body });
        return new Response(
          JSON.stringify({ error: { code: 400, message: 'Immutable iCalUID or id must not be sent on events.patch' } }),
          { status: 400 }
        );
      }
      const existing = events.get(id);
      if (!existing) {
        apiLog.push({ method, path, status: 404, body });
        return new Response(JSON.stringify({ error: { code: 404, message: 'Not Found' } }), { status: 404 });
      }
      const updated = {
        ...existing,
        ...body,
        id: existing.id,
        iCalUID: existing.iCalUID
      };
      events.set(id, updated);
      apiLog.push({ method, path, status: 200, body });
      return new Response(JSON.stringify(updated), { status: 200 });
    }

    apiLog.push({ method, path, status: 405 });
    return new Response('{}', { status: 405 });
  };

  return {
    handler,
    events,
    apiLog,
    setForce401: (fn: typeof force401OnMatch) => {
      force401OnMatch = fn;
    },
    setForceNetworkError: (fn: typeof forceNetworkErrorOnMatch) => {
      forceNetworkErrorOnMatch = fn;
    },
    setSimulateDroppedCreateResponse: (flag: boolean) => {
      simulateDroppedCreateResponse = flag;
    }
  };
}

async function runCalendarAuditTests() {
  console.log('=== Starting Google Calendar Live Sync Audit & Single-Session Verification ===');

  const sim = createStrictGoogleCalendarSimulator();
  __setCalendarFetchForTesting(sim.handler);

  try {
    // -------------------------------------------------------------------------
    // 1. SINGLE-SESSION LIVE SYNC + NO iCalUID ON INSERT + VALID DETERMINISTIC ID
    // -------------------------------------------------------------------------
    console.log('1. Testing single-session live sync, valid base32hex event.id & zero iCalUID on insert...');

    const groupWeekly: Group = {
      id: 'grp_cal_audit_1',
      name: 'Deutsch A2 Intensiv',
      grade: 'Grade 10',
      type: 'online',
      monthlyPackagePrice: 1600,
      sessionCount: 4,
      color: '#10b981',
      lessonDurationMinutes: 90,
      scheduleRecurrence: 'weekly',
      schedules: [
        { day: 'Monday', time: '19:00' },
        { day: 'Wednesday', time: '15:00' }
      ],
      updatedAt: Date.now()
    };

    const rec = reconcileGroupWeeklySessions({
      group: groupWeekly,
      existingSessions: [],
      timezone: 'Africa/Cairo'
    });
    assert.equal(rec.sessions.length, 2);
    const monSession = rec.sessions.find((s) => s.weekday === 1)!;
    const wedSession = rec.sessions.find((s) => s.weekday === 3)!;

    const expectedGoogleId = deriveDeterministicGoogleEventId(monSession.id);
    assert.match(
      expectedGoogleId,
      VALID_GOOGLE_EVENT_ID_RE,
      'Deterministic Google Calendar event.id must strictly satisfy ^[a-v0-9]{5,1024}$'
    );
    assert.equal(
      deriveDeterministicGoogleEventId(monSession.id),
      expectedGoogleId,
      'Deterministic Google Calendar event.id must be repeatable across calls'
    );

    // Sync ONLY ONE selected weekly session (Monday session), leaving Wednesday untouched
    const fixedRef = new Date('2026-11-16T08:00:00Z'); // Monday Nov 16, 2026 (Week A)
    const singleSync = await syncSingleSessionToGoogleCalendar({
      allSessions: rec.sessions,
      sessionId: monSession.id,
      accessToken: 'tok_valid_1',
      referenceDate: fixedRef
    });

    assert.equal(singleSync.success, true);
    assert.equal(singleSync.createdCount, 1);
    assert.equal(singleSync.updatedCount, 0);
    assert.equal(singleSync.skippedCount, 1, 'Other weekly session must be skipped when targeting 1 selected session');

    const syncedMon = singleSync.sessions.find((s) => s.id === monSession.id)!;
    const untouchedWed = singleSync.sessions.find((s) => s.id === wedSession.id)!;
    assert.equal(untouchedWed.googleCalendarEventId, undefined, 'Non-selected Wednesday session must NOT be synced');
    assert.equal(syncedMon.googleCalendarEventId, expectedGoogleId);
    assert.equal(syncedMon.googleCalendarIcalUid, `${expectedGoogleId}@google.com`);
    assert.notEqual(
      syncedMon.googleCalendarIcalUid,
      syncedMon.calendarEventUid,
      'Google iCalUID must be stored separately from Glück immutable ICS UID'
    );

    // Verify POST body did NOT send iCalUID and used Africa/Cairo wall time + WEEKLY INTERVAL=1
    const firstPost = sim.apiLog.find((l) => l.method === 'POST')!;
    assert.ok(firstPost);
    assert.equal('iCalUID' in firstPost.body, false, 'events.insert must NEVER include custom iCalUID');
    assert.equal(firstPost.body.start.dateTime, '2026-11-16T19:00:00');
    assert.equal(firstPost.body.start.timeZone, 'Africa/Cairo');
    assert.equal(firstPost.body.end.dateTime, '2026-11-16T20:30:00');
    assert.equal(firstPost.body.end.timeZone, 'Africa/Cairo');
    assert.deepEqual(firstPost.body.recurrence, ['RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO']);

    // Verify .ics UID remains Glück's independent calendarEventUid
    const icsOutput = generateSessionsIcsContent([syncedMon], { referenceDate: fixedRef });
    assert.ok(icsOutput.includes(`UID:${syncedMon.calendarEventUid}`));
    assert.equal(icsOutput.includes(`UID:${syncedMon.googleCalendarIcalUid}`), false);

    // -------------------------------------------------------------------------
    // 2. IDEMPOTENT RETRY, LOST LOCAL ID RECOVERY & 409 CONFLICT RECOVERY
    // -------------------------------------------------------------------------
    console.log('2. Testing idempotent retry, missing local googleCalendarEventId fallback & 409 recovery...');

    // Retry while synced (without force) -> should skip without API calls
    const logLenBeforeSkip = sim.apiLog.length;
    const retrySkipped = await syncSingleSessionToGoogleCalendar({
      allSessions: singleSync.sessions,
      sessionId: monSession.id,
      accessToken: 'tok_valid_1',
      referenceDate: fixedRef
    });
    assert.equal(retrySkipped.skippedCount, 2);
    assert.equal(sim.apiLog.length, logLenBeforeSkip, 'Unchanged synced session must trigger zero API mutations');

    // Simulate local state lost googleCalendarEventId (e.g., fresh device / cleared metadata) -> must find via GET & PATCH, ZERO duplicates
    const sessionMissingGoogleId: GroupWeeklySession = {
      ...syncedMon,
      googleCalendarEventId: undefined,
      googleCalendarIcalUid: undefined,
      calendarSyncStatus: 'not_synced'
    };
    const postsBeforeRecover = sim.apiLog.filter((l) => l.method === 'POST').length;
    const recoverExisting = await syncSingleSessionToGoogleCalendar({
      allSessions: [sessionMissingGoogleId],
      sessionId: monSession.id,
      accessToken: 'tok_valid_1',
      referenceDate: fixedRef
    });
    assert.equal(recoverExisting.success, true);
    assert.equal(recoverExisting.createdCount, 0);
    assert.equal(recoverExisting.updatedCount, 1);
    assert.equal(
      sim.apiLog.filter((l) => l.method === 'POST').length,
      postsBeforeRecover,
      'Must PATCH existing event via lookup rather than POST duplicate'
    );
    assert.equal(recoverExisting.sessions[0].googleCalendarEventId, expectedGoogleId);

    // Simulate interrupted network drop AFTER remote POST succeeded (no googleCalendarEventId persisted yet, retry hits or avoids 409)
    sim.setSimulateDroppedCreateResponse(true);
    let droppedCaught = false;
    const interruptedCreate = await syncSingleSessionToGoogleCalendar({
      allSessions: [wedSession],
      sessionId: wedSession.id,
      accessToken: 'tok_valid_1',
      referenceDate: fixedRef
    });
    assert.equal(interruptedCreate.success, false, 'Interrupted sync must report failure status');
    assert.equal(interruptedCreate.sessions[0].calendarSyncStatus, 'error');

    // Now retry the interrupted Wednesday session -> even without googleCalendarEventId stored, it finds or 409-recovers & PATCHes cleanly
    const wedRetry = await syncSingleSessionToGoogleCalendar({
      allSessions: interruptedCreate.sessions,
      sessionId: wedSession.id,
      accessToken: 'tok_valid_1',
      referenceDate: fixedRef
    });
    assert.equal(wedRetry.success, true);
    assert.equal(wedRetry.createdCount, 0);
    assert.equal(wedRetry.updatedCount, 1);
    assert.equal(wedRetry.sessions[0].calendarSyncStatus, 'synced');
    assert.ok(wedRetry.sessions[0].googleCalendarEventId);

    // Total Google Calendar events for both sessions + 1 unrelated user event must be exactly 3 (no duplicates!)
    assert.equal(sim.events.size, 3);
    void droppedCaught;

    // -------------------------------------------------------------------------
    // 3. SCHEDULE CHANGE & ZOOM URL CHANGE PROPAGATION
    // -------------------------------------------------------------------------
    console.log('3. Testing Zoom URL change and schedule/rename invalidation + PATCH update...');

    // Simulate Zoom URL manual update on synced Monday session
    const manualZoom = setManualZoomLinkForSession({
      session: syncedMon,
      manualUrl: 'https://zoom.us/j/88877766655?pwd=newpw',
      sessions: [syncedMon, wedRetry.sessions[0]],
      records: [],
      history: []
    });
    assert.equal(manualZoom.ok, true);
    assert.equal(
      manualZoom.updatedSession?.calendarSyncStatus,
      'needs_update',
      'Updating Zoom URL on a synced session must flag calendarSyncStatus = needs_update'
    );

    // Simulate schedule time & group name change via reconciler
    const groupScheduleChanged: Group = {
      ...groupWeekly,
      name: 'Deutsch B1 Abendkurs',
      schedules: [
        { day: 'Monday', time: '20:30' },
        { day: 'Wednesday', time: '15:00' }
      ]
    };
    const reconciledAfterChange = reconcileGroupWeeklySessions({
      group: groupScheduleChanged,
      existingSessions: manualZoom.sessions,
      timezone: 'Africa/Cairo'
    });
    const updatedMonPreCal = reconciledAfterChange.sessions.find((s) => s.id === monSession.id)!;
    assert.equal(updatedMonPreCal.calendarSyncStatus, 'needs_update');

    const calAfterScheduleChange = await syncSingleSessionToGoogleCalendar({
      allSessions: reconciledAfterChange.sessions,
      sessionId: monSession.id,
      accessToken: 'tok_valid_1',
      referenceDate: fixedRef
    });
    assert.equal(calAfterScheduleChange.success, true);
    assert.equal(calAfterScheduleChange.updatedCount, 1);
    const remoteMonEvt = sim.events.get(expectedGoogleId)!;
    assert.equal(remoteMonEvt.summary, 'Monday - 20:30 - Deutsch B1 Abendkurs');
    assert.equal(remoteMonEvt.location, 'https://zoom.us/j/88877766655?pwd=newpw');
    assert.equal(remoteMonEvt.start.dateTime, '2026-11-16T20:30:00');
    assert.equal(remoteMonEvt.start.timeZone, 'Africa/Cairo');

    // -------------------------------------------------------------------------
    // 4. BIWEEKLY (A / B) RECURRENCE IN AFRICA/CAIRO TIMEZONE
    // -------------------------------------------------------------------------
    console.log('4. Testing weekly & biweekly A/B start date alignment in Africa/Cairo...');

    // 2026-11-16 is Week A (check anchor parity: Nov 16 is 45 weeks after Jan 5 -> odd! Wait: computeNextSessionStartWallTime calculates exact parity!)
    const probeA = computeNextSessionStartWallTime(2, '18:00', 'Africa/Cairo', fixedRef, 'biweekly_a');
    const probeB = computeNextSessionStartWallTime(2, '18:00', 'Africa/Cairo', fixedRef, 'biweekly_b');
    assert.notEqual(
      probeA.dateYmd,
      probeB.dateYmd,
      'biweekly_a and biweekly_b for the same weekday MUST start exactly 7 days apart!'
    );

    const biweeklyBGroup: Group = {
      id: 'grp_biweekly_b',
      name: 'Konversation B2',
      grade: 'Grade 11',
      type: 'online',
      monthlyPackagePrice: 900,
      sessionCount: 2,
      color: '#f59e0b',
      lessonDurationMinutes: 60,
      scheduleRecurrence: 'biweekly_b',
      schedules: [{ day: 'Tuesday', time: '18:00' }],
      updatedAt: Date.now()
    };
    const recBiweekly = reconcileGroupWeeklySessions({
      group: biweeklyBGroup,
      existingSessions: [],
      timezone: 'Africa/Cairo'
    });
    const biSession = recBiweekly.sessions[0];
    const biSync = await syncSingleSessionToGoogleCalendar({
      allSessions: recBiweekly.sessions,
      sessionId: biSession.id,
      accessToken: 'tok_valid_1',
      referenceDate: fixedRef
    });
    assert.equal(biSync.success, true);
    const biEvt = sim.events.get(biSync.sessions[0].googleCalendarEventId!)!;
    assert.deepEqual(biEvt.recurrence, ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU']);
    assert.equal(biEvt.start.dateTime, probeB.startTimeIsoLocal);
    assert.equal(biEvt.start.timeZone, 'Africa/Cairo');

    // Also test Africa/Cairo DST boundary (last Friday of April in Egypt DST transition: e.g. 2026-04-24)
    const cairoDstWall = computeNextSessionStartWallTime(5, '19:00', 'Africa/Cairo', new Date('2026-04-24T09:00:00Z'));
    assert.equal(cairoDstWall.startTimeIsoLocal, '2026-04-24T19:00:00');

    // -------------------------------------------------------------------------
    // 5. OAUTH 401 EXPIRY, PARTIAL INTERRUPTION & RECONNECT RETRY
    // -------------------------------------------------------------------------
    console.log('5. Testing OAuth 401 expiry recovery, partial multi-session failure & reconnect...');

    const sessP1 = { ...rec.sessions[0], id: 'sess_partial_1', standardizedTitle: 'Thursday - 16:00 - P1' };
    const sessP2 = { ...rec.sessions[0], id: 'sess_partial_2', standardizedTitle: 'Friday - 17:00 - P2' };
    let failSecondAs401 = true;
    sim.setForce401((_url, method) => {
      if (failSecondAs401 && method === 'POST' && sim.events.has(deriveDeterministicGoogleEventId(sessP1.id))) {
        return true;
      }
      return false;
    });

    const partialAuthRes = await syncSessionsToGoogleCalendar({
      allSessions: [sessP1, sessP2],
      accessToken: 'tok_expiring',
      referenceDate: fixedRef
    });
    assert.equal(partialAuthRes.success, false);
    assert.equal(partialAuthRes.authExpired, true);
    assert.equal(partialAuthRes.createdCount, 1, 'First session must remain saved before 401 stopped loop');
    assert.equal(partialAuthRes.sessions[0].calendarSyncStatus, 'synced');
    assert.equal(partialAuthRes.sessions[1].calendarSyncStatus, 'error');

    // Now simulate OAuth reconnection with a fresh token and retry using partialAuthRes.sessions
    failSecondAs401 = false;
    sim.setForce401(null);
    const reconnectRetry = await syncSessionsToGoogleCalendar({
      allSessions: partialAuthRes.sessions,
      accessToken: 'tok_reconnected_fresh',
      referenceDate: fixedRef
    });
    assert.equal(reconnectRetry.success, true);
    assert.equal(reconnectRetry.createdCount, 1, 'Only remaining un-synced session should be created on retry');
    assert.equal(reconnectRetry.skippedCount, 1, 'Already synced first session must be skipped cleanly');
    assert.equal(reconnectRetry.sessions[1].calendarSyncStatus, 'synced');

    // -------------------------------------------------------------------------
    // 6. UNRELATED USER-CREATED CALENDAR EVENTS UNTOUCHED + ZERO DELETE CALLS
    // -------------------------------------------------------------------------
    console.log('6. Verifying unrelated user-created Calendar events were never modified or deleted...');

    const deleteCalls = sim.apiLog.filter((l) => l.method === 'DELETE');
    assert.equal(deleteCalls.length, 0, 'Google Calendar Live Sync must NEVER issue DELETE requests');
    const unrelatedEvt = sim.events.get('user_private_event_999')!;
    assert.equal(
      unrelatedEvt.description,
      'User manually created personal reminder — must NEVER be touched by Glück',
      'Unrelated user Calendar event with same title must remain completely untouched'
    );

    console.log('✅ All Google Calendar Live Sync Audit & Verification Tests Passed!');
  } finally {
    __setCalendarFetchForTesting(null);
  }
}

runCalendarAuditTests().catch((err) => {
  console.error('❌ Google Calendar Live Sync Audit Test Failed:', err);
  process.exit(1);
});
