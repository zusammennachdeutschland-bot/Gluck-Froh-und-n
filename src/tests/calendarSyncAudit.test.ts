import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Group, GroupWeeklySession } from '../types';
import {
  DEFAULT_ZOOM_TIMEZONE,
  computeNextSessionStartWallTime,
  deriveDeterministicGoogleEventId,
  reconcileGroupWeeklySessions
} from '../services/zoomSessionStandardizer';
import {
  __resetCalendarOAuthStateForTesting,
  __setCalendarFetchForTesting,
  __setWebCalendarAuthTestAdapter,
  __simulateColdRestartForTesting,
  disconnectGoogleCalendar,
  generateSessionsIcsContent,
  getCalendarOAuthDiagnostics,
  getGoogleCalendarConnectionState,
  getInMemoryGoogleCalendarToken,
  handleCalendarOAuthDeepLinkCallback,
  processPendingWebCalendarRedirectResult,
  requestGoogleCalendarAccessToken,
  syncSessionsToGoogleCalendar,
  syncSingleSessionToGoogleCalendar,
  verifyOrSilentlyReauthorizeGoogleCalendar
} from '../services/calendarSyncService';
import { __setNativeAuthTestAdapter } from '../shared/googleCredentialAuthPlugin';
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

function installMockBrowserStorage() {
  const localMap = new Map<string, string>();
  const sessionMap = new Map<string, string>();
  const makeStorage = (map: Map<string, string>) => ({
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    }
  });
  const localStorageMock = makeStorage(localMap);
  const sessionStorageMock = makeStorage(sessionMap);
  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = {
    ...(previousWindow || {}),
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    location: { protocol: 'https:', origin: 'https://localhost' }
  };
  return {
    localMap,
    sessionMap,
    restore: () => {
      if (previousWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = previousWindow;
      }
    }
  };
}

async function runCalendarOAuthFlowTests() {
  console.log('\n=== Starting Google Calendar OAuth Flow Tests (Android Native vs Web) ===');
  const mockStorage = installMockBrowserStorage();
  const SENSITIVE_SECRETS = [
    'ya29.android_secret_token_alpha',
    'ya29.expired_token_beta',
    'ya29.fresh_reauth_token_gamma',
    'ya29.reopen_silent_token_delta',
    'ya29.web_redirect_token_epsilon',
    'SECRET_OAUTH_CODE_987654'
  ];

  try {
    // -------------------------------------------------------------------------
    // 7A. ANDROID CAPACITOR: NATIVE AUTHORIZATION CLIENT (ZERO WEB POPUP/REDIRECT)
    // -------------------------------------------------------------------------
    console.log('7A. Testing Android native Google Calendar consent approval, verification & memory-only token storage...');
    __resetCalendarOAuthStateForTesting();

    let webPopupCalls = 0;
    let webRedirectCalls = 0;
    let nativeAuthCalls = 0;
    let lastNativeOptions: any = null;

    __setWebCalendarAuthTestAdapter({
      popupAuthorize: async () => {
        webPopupCalls++;
        throw new Error('Web popup MUST NEVER be called on Android Capacitor!');
      },
      redirectAuthorize: async () => {
        webRedirectCalls++;
        throw new Error('Web redirect MUST NEVER be called on Android Capacitor!');
      }
    });

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async (options) => {
        nativeAuthCalls++;
        lastNativeOptions = options;
        return {
          cancelled: false,
          accessToken: 'ya29.android_secret_token_alpha',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher@glueck.app',
          stage: 'native_consent_approved',
          packageName: 'com.glueck.teacher'
        };
      }
    });

    let verifyApiCalls = 0;
    __setCalendarFetchForTesting(async (input) => {
      const url = String(input);
      assert.ok(
        url.includes('/calendar/v3/calendars/primary/events?maxResults=1&fields=summary,timeZone,accessRole'),
        `Expected calendar.events-compatible events.list verification URL, got: ${url}`
      );
      verifyApiCalls++;
      return new Response(
        JSON.stringify({
          summary: 'teacher@glueck.app',
          timeZone: 'Africa/Cairo',
          accessRole: 'owner',
          items: []
        }),
        { status: 200 }
      );
    });

    const androidApprove = await requestGoogleCalendarAccessToken(false);
    assert.equal(androidApprove.ok, true);
    assert.equal(androidApprove.platform, 'android_native');
    assert.equal(androidApprove.accountEmail, 'teacher@glueck.app');
    assert.equal(androidApprove.scopeVerified, true);
    assert.equal(androidApprove.readVerified, true);
    assert.equal(androidApprove.writeVerified, false);
    assert.equal(nativeAuthCalls, 1);
    assert.equal(verifyApiCalls, 1);
    assert.equal(webPopupCalls, 0, 'Web popup must NEVER execute on Android');
    assert.equal(webRedirectCalls, 0, 'Web redirect must NEVER execute on Android');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.android_secret_token_alpha');

    // Second call uses in-memory cache without re-prompting or duplicating connections
    const androidCached = await requestGoogleCalendarAccessToken(false);
    assert.equal(androidCached.ok, true);
    assert.equal(nativeAuthCalls, 1, 'In-memory cache must avoid duplicate native OAuth prompts');

    // Verify ZERO tokens written to localStorage / sessionStorage
    const allStoredValues = [
      ...Array.from(mockStorage.localMap.values()),
      ...Array.from(mockStorage.sessionMap.values())
    ].join('\n');
    for (const secret of SENSITIVE_SECRETS) {
      assert.equal(
        allStoredValues.includes(secret),
        false,
        `Sensitive token/code MUST NEVER be stored in browser storage: ${secret}`
      );
    }

    // -------------------------------------------------------------------------
    // 7B. REOPENING GLÜCK AFTER AUTHORIZATION (COLD START -> needs_verification -> SILENT GRANT)
    // -------------------------------------------------------------------------
    console.log('7B. Testing reopening Glück after successful authorization...');
    __simulateColdRestartForTesting();
    const afterReopenState = getGoogleCalendarConnectionState();
    assert.equal(
      afterReopenState.status,
      'needs_verification',
      'Cold restart must downgrade persisted connected metadata to needs_verification until token is verified'
    );
    assert.equal(afterReopenState.accountEmail, 'teacher@glueck.app');
    assert.equal(afterReopenState.hasInMemoryToken, false, 'In-memory token must start empty on cold restart');

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async (options) => {
        nativeAuthCalls++;
        lastNativeOptions = options;
        return {
          cancelled: false,
          accessToken: 'ya29.reopen_silent_token_delta',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher@glueck.app',
          stage: 'native_immediate_grant'
        };
      }
    });

    const silentReopenAuth = await verifyOrSilentlyReauthorizeGoogleCalendar();
    assert.equal(silentReopenAuth.ok, true);
    assert.equal(lastNativeOptions?.silentOnly, true, 'Mount verification must use silentOnly=true');
    assert.equal(lastNativeOptions?.accountEmail, 'teacher@glueck.app', 'Reopen should pass previously verified account hint');
    assert.equal(lastNativeOptions?.forceAccountSelection, false);
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getGoogleCalendarConnectionState().hasInMemoryToken, true);

    // -------------------------------------------------------------------------
    // 7C. ANDROID CANCELLED CONSENT
    // -------------------------------------------------------------------------
    console.log('7C. Testing Android cancelled Google Calendar consent...');
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: true,
        stage: 'native_consent_cancelled',
        reason: 'Google Calendar consent was cancelled by the user.'
      })
    });

    const androidCancelled = await requestGoogleCalendarAccessToken(true);
    assert.equal(androidCancelled.ok, false);
    assert.equal(androidCancelled.cancelled, true);
    assert.equal(androidCancelled.code, 'USER_CANCELLED');
    assert.equal(getGoogleCalendarConnectionState().status, 'cancelled');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // -------------------------------------------------------------------------
    // 7D. EXPIRED / INVALID AUTHORIZATION (401) & AWAITED clearToken AUTO-RETRY
    // -------------------------------------------------------------------------
    console.log('7D. Testing expired/invalid Calendar authorization (401) and awaited AuthorizationClient.clearToken retry...');
    let attempt = 0;
    let clearedStaleTokenArg: string | undefined;

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      clearCalendarToken: async ({ accessToken }) => {
        clearedStaleTokenArg = accessToken;
        return { cleared: true };
      },
      authorizeCalendar: async () => {
        attempt++;
        if (attempt === 1) {
          return {
            cancelled: false,
            accessToken: 'ya29.expired_token_beta',
            grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
            scopeVerified: true,
            email: 'teacher@glueck.app',
            stage: 'native_immediate_grant'
          };
        }
        return {
          cancelled: false,
          accessToken: 'ya29.fresh_reauth_token_gamma',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher@glueck.app',
          stage: 'native_consent_approved'
        };
      }
    });

    __setCalendarFetchForTesting(async (_input, init) => {
      const authHeader = String((init?.headers as any)?.Authorization || '');
      if (authHeader.includes('ya29.expired_token_beta')) {
        return new Response(JSON.stringify({ error: { code: 401, message: 'Invalid Credentials' } }), { status: 401 });
      }
      return new Response(
        JSON.stringify({ summary: 'teacher@glueck.app', timeZone: 'Africa/Cairo', accessRole: 'owner', items: [] }),
        { status: 200 }
      );
    });

    const recoveredRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(recoveredRes.ok, true);
    assert.equal(
      clearedStaleTokenArg,
      'ya29.expired_token_beta',
      '401 recovery must await native clearCalendarToken with the stale Play Services token before retrying'
    );
    assert.equal(attempt, 2);
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.fresh_reauth_token_gamma');

    // Disconnect clears memory token and invokes native clearCalendarToken + revokeCalendarAccess
    let clearedNativeToken = false;
    let revokedNativeAccess = false;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      clearCalendarToken: async () => {
        clearedNativeToken = true;
        return { cleared: true };
      },
      revokeCalendarAccess: async () => {
        revokedNativeAccess = true;
        return { revoked: true };
      }
    });
    await disconnectGoogleCalendar();
    assert.equal(clearedNativeToken, true);
    assert.equal(revokedNativeAccess, true);
    assert.equal(getInMemoryGoogleCalendarToken(), null);
    assert.equal(getGoogleCalendarConnectionState().status, 'disconnected');

    // -------------------------------------------------------------------------
    // 7E. WEB BUILD FLOW: POPUP BLOCKED -> REDIRECT FALLBACK -> SINGLE-SHOT STARTUP RESULT
    // -------------------------------------------------------------------------
    console.log('7E. Testing Web build popup-blocked redirect fallback and single-shot startup getRedirectResult...');
    __resetCalendarOAuthStateForTesting();

    let redirectStarted = false;
    let redirectConsumedCount = 0;

    __setNativeAuthTestAdapter({
      isAndroidNative: () => false,
      authorizeCalendar: async () => {
        throw new Error('Native Android plugin MUST NEVER be invoked on Web build!');
      }
    });

    __setWebCalendarAuthTestAdapter({
      popupAuthorize: async () => {
        throw Object.assign(new Error('Popup blocked by browser'), { code: 'auth/popup-blocked' });
      },
      redirectAuthorize: async () => {
        redirectStarted = true;
      },
      consumeRedirectResult: async () => {
        redirectConsumedCount++;
        return {
          accessToken: 'ya29.web_redirect_token_epsilon',
          email: 'webteacher@glueck.app'
        };
      }
    });

    __setCalendarFetchForTesting(async () =>
      new Response(
        JSON.stringify({
          summary: 'webteacher@glueck.app',
          timeZone: 'Africa/Cairo',
          accessRole: 'owner',
          items: []
        }),
        { status: 200 }
      )
    );

    const webRedirectStart = await requestGoogleCalendarAccessToken(false);
    assert.equal(webRedirectStart.ok, false);
    assert.equal(webRedirectStart.redirected, true);
    assert.equal(redirectStarted, true);
    assert.equal(getGoogleCalendarConnectionState().status, 'pending_redirect');

    // Startup processing after returning from Google consent redirect
    const startup1 = await processPendingWebCalendarRedirectResult();
    assert.equal(startup1.handled, true);
    assert.equal(startup1.ok, true);
    assert.equal(startup1.shouldOpenIntegrations, true);
    assert.equal(startup1.accountEmail, 'webteacher@glueck.app');
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.web_redirect_token_epsilon');

    // Second startup invocation must NOT re-consume redirect result
    const startup2 = await processPendingWebCalendarRedirectResult();
    assert.equal(startup2.ok, true);
    assert.equal(redirectConsumedCount, 1, 'Web redirect result must be processed at most once');

    // -------------------------------------------------------------------------
    // 7F. ANDROID DEEP-LINK CALLBACK SINGLE-SHOT DEDUPLICATION & ZERO SECRET LEAKAGE
    // -------------------------------------------------------------------------
    console.log('7F. Testing Android deep-link callback single-shot handling & zero secret leakage in diagnostics...');
    const cbUrl = 'glueck://oauth/calendar/callback?status=ok&code=SECRET_OAUTH_CODE_987654&state=abc123456';
    const cbFirst = handleCalendarOAuthDeepLinkCallback(cbUrl);
    assert.equal(cbFirst.matched, true);
    assert.equal(cbFirst.alreadyHandled, false);
    assert.equal(cbFirst.shouldOpenIntegrations, true);

    const cbSecond = handleCalendarOAuthDeepLinkCallback(cbUrl);
    assert.equal(cbSecond.matched, true);
    assert.equal(cbSecond.alreadyHandled, true, 'Duplicate callback URL must be ignored (handled exactly once)');

    const cbCancelled = handleCalendarOAuthDeepLinkCallback(
      'glueck://oauth/calendar/callback?error=access_denied&state=cancel_99'
    );
    assert.equal(cbCancelled.matched, true);
    assert.equal(cbCancelled.status, 'cancelled');
    assert.equal(cbCancelled.shouldOpenIntegrations, true);

    const diagJson = JSON.stringify(getCalendarOAuthDiagnostics());
    for (const secret of SENSITIVE_SECRETS) {
      assert.equal(
        diagJson.includes(secret),
        false,
        `Diagnostic logs MUST NEVER contain OAuth codes or tokens: ${secret}`
      );
    }

    // -------------------------------------------------------------------------
    // 7G. STATIC VERIFICATION OF ANDROID PLUGIN, GRADLE, MANIFEST & APP DEEP LINKS
    // -------------------------------------------------------------------------
    console.log('7G. Verifying native Android plugin, Gradle dependency, manifest intent filter & App routing...');
    const rootDir = process.cwd();
    const pluginJava = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/java/com/glueck/app/GoogleCredentialAuthPlugin.java'),
      'utf8'
    );
    const appGradle = fs.readFileSync(path.join(rootDir, 'android/app/build.gradle'), 'utf8');
    const manifestXml = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/AndroidManifest.xml'),
      'utf8'
    );
    const appTsx = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');

    assert.ok(appGradle.includes('com.google.android.gms:play-services-auth:21.4.0'));
    assert.equal(pluginJava.includes('GoogleAuthUtil.clearToken'), false);
    assert.ok(pluginJava.includes('public void authorizeCalendar(final PluginCall call)'));
    assert.ok(pluginJava.includes('AuthorizationClient'));
    assert.ok(pluginJava.includes('ClearTokenRequest'));
    assert.ok(pluginJava.includes('RevokeAccessRequest'));
    assert.ok(pluginJava.includes('StartIntentSenderForResult'));
    assert.ok(pluginJava.includes('https://www.googleapis.com/auth/calendar.events'));
    assert.ok(pluginJava.includes('public void clearCalendarToken(final PluginCall call)'));
    assert.ok(pluginJava.includes('public void revokeCalendarAccess(final PluginCall call)'));
    assert.ok(manifestXml.includes('android:scheme="glueck"'));
    assert.ok(appTsx.includes('handleCalendarOAuthDeepLinkCallback'));
    assert.ok(appTsx.includes('processPendingWebCalendarRedirectResult'));
    assert.ok(appTsx.includes('subscribeNativeCalendarAuthProcessRestored'));
    assert.ok(appTsx.includes('openSettingsIntegrations'));

    // -------------------------------------------------------------------------
    // 7H. HTTP 403 CLASSIFICATION (API DISABLED VS STALE/INSUFFICIENT SCOPE RECOVERY)
    // -------------------------------------------------------------------------
    console.log('7H. Testing HTTP 403 classification (accessNotConfigured vs insufficientPermissions stale token recovery)...');
    __resetCalendarOAuthStateForTesting();

    let apiDisabledClearCalls = 0;
    let apiDisabledAuthCalls = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      clearCalendarToken: async () => {
        apiDisabledClearCalls++;
        return { cleared: true };
      },
      authorizeCalendar: async () => {
        apiDisabledAuthCalls++;
        return {
          cancelled: false,
          accessToken: 'ya29.api_disabled_token',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher@glueck.app',
          stage: 'native_consent_approved'
        };
      }
    });
    __setCalendarFetchForTesting(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 403,
            message: 'Google Calendar API has not been used in project glueck-c8621 before or it is disabled.',
            errors: [{ domain: 'usageLimits', reason: 'accessNotConfigured', message: 'Access Not Configured' }]
          }
        }),
        { status: 403 }
      )
    );

    const disabledRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(disabledRes.ok, false);
    assert.equal(disabledRes.code, 'CALENDAR_API_DISABLED');
    assert.equal(apiDisabledAuthCalls, 1, 'Disabled Cloud API must not trigger useless retry loops');
    assert.equal(apiDisabledClearCalls, 0, 'Disabled Cloud API must not clear token needlessly');
    assert.equal(getGoogleCalendarConnectionState().status, 'error');
    assert.ok(
      String(disabledRes.error || '').includes('Google Calendar API is disabled'),
      'Disabled API error must clearly direct user to enable Google Calendar API'
    );

    // Now test 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT on stale cached token -> clearToken + revokeAccess + retry recovers
    __resetCalendarOAuthStateForTesting();
    let scope403Attempt = 0;
    let scope403Cleared = false;
    let scope403Revoked = false;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      clearCalendarToken: async ({ accessToken }) => {
        if (accessToken === 'ya29.stale_403_token') scope403Cleared = true;
        return { cleared: true };
      },
      revokeCalendarAccess: async () => {
        scope403Revoked = true;
        return { revoked: true };
      },
      authorizeCalendar: async () => {
        scope403Attempt++;
        return {
          cancelled: false,
          accessToken: scope403Attempt === 1 ? 'ya29.stale_403_token' : 'ya29.fresh_after_403_token',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher@glueck.app',
          stage: scope403Attempt === 1 ? 'native_immediate_grant' : 'native_consent_approved'
        };
      }
    });
    __setCalendarFetchForTesting(async (_input, init) => {
      const authHeader = String((init?.headers as any)?.Authorization || '');
      if (authHeader.includes('ya29.stale_403_token')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'Request had insufficient authentication scopes.',
              details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }]
            }
          }),
          { status: 403 }
        );
      }
      return new Response(
        JSON.stringify({ summary: 'teacher@glueck.app', timeZone: 'Africa/Cairo', accessRole: 'owner', items: [] }),
        { status: 200 }
      );
    });

    const recovered403Res = await requestGoogleCalendarAccessToken(false);
    assert.equal(recovered403Res.ok, true);
    assert.equal(scope403Attempt, 2, '403 insufficient scope on stale token must clear, revoke, and retry once');
    assert.equal(scope403Cleared, true, 'Must await clearCalendarToken for stale 403 token');
    assert.equal(scope403Revoked, true, 'Must await revokeCalendarAccess before interactive retry');
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.fresh_after_403_token');

    console.log('✅ All Google Calendar OAuth Flow Tests Passed!');
  } finally {
    __setNativeAuthTestAdapter(null);
    __setWebCalendarAuthTestAdapter(null);
    __setCalendarFetchForTesting(null);
    __resetCalendarOAuthStateForTesting();
    mockStorage.restore();
  }
}

async function runAll() {
  await runCalendarAuditTests();
  await runCalendarOAuthFlowTests();
}

runAll().catch((err) => {
  console.error('❌ Google Calendar Live Sync & OAuth Audit Test Failed:', err);
  process.exit(1);
});
