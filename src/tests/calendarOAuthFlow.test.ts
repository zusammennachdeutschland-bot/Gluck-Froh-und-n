import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { __setNativeAuthTestAdapter } from '../shared/googleCredentialAuthPlugin';
import {
  __resetCalendarOAuthStateForTesting,
  __setCalendarFetchForTesting,
  __setInMemoryTokenExpiryForTesting,
  __setWebCalendarAuthTestAdapter,
  __simulateColdRestartForTesting,
  __simulateFirebaseAccountChangeForTesting,
  clearInMemoryGoogleCalendarToken,
  disconnectGoogleCalendar,
  getCalendarOAuthDiagnostics,
  getGoogleCalendarConnectionState,
  getInMemoryGoogleCalendarToken,
  handleCalendarOAuthDeepLinkCallback,
  processPendingWebCalendarRedirectResult,
  requestGoogleCalendarAccessToken,
  syncSessionsToGoogleCalendar,
  verifyOrSilentlyReauthorizeGoogleCalendar
} from '../services/calendarSyncService';
import { GroupWeeklySession } from '../types';

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

  (globalThis as any).window = {
    localStorage: makeStorage(localMap),
    sessionStorage: makeStorage(sessionMap),
    location: { protocol: 'https:', origin: 'https://glueck-c8621.firebaseapp.com' }
  };

  return { localMap, sessionMap };
}

function assertNoSecretsInDiagnosticsOrStorage(
  secrets: string[],
  localMap: Map<string, string>,
  sessionMap: Map<string, string>
) {
  const diagDump = JSON.stringify(getCalendarOAuthDiagnostics());
  const localDump = JSON.stringify(Object.fromEntries(localMap.entries()));
  const sessionDump = JSON.stringify(Object.fromEntries(sessionMap.entries()));

  for (const secret of secrets) {
    assert.equal(diagDump.includes(secret), false, `Secret leaked into Calendar OAuth diagnostics: ${secret}`);
    assert.equal(localDump.includes(secret), false, `Secret leaked into localStorage: ${secret}`);
    assert.equal(sessionDump.includes(secret), false, `Secret leaked into sessionStorage: ${secret}`);
  }
}

function makeSampleSession(): GroupWeeklySession {
  const now = Date.now();
  return {
    id: 'sess-oauth-audit-1',
    sessionCode: 'B1G1-MON-1900',
    groupId: 'grp-b1-1',
    groupNameSnapshot: 'B1.1 Group 1',
    weekday: 1,
    weekdayName: 'Monday',
    startTime: '19:00',
    durationMinutes: 60,
    timezone: 'Africa/Cairo',
    recurrence: 'weekly',
    standardizedTitle: 'Monday - 19:00 - B1.1 Group 1',
    calendarEventUid: 'gluck-session-sess-oauth-audit-1@glueck.app',
    meetingSource: 'zoom_api',
    syncState: 'synced',
    zoomJoinUrl: 'https://zoom.us/j/123456789',
    calendarSyncStatus: 'not_synced',
    version: 1,
    updatedAt: now
  };
}

async function runCalendarOAuthFlowTests() {
  console.log('=== Starting Google Calendar OAuth Production-Readiness Audit Suite ===');
  const { localMap, sessionMap } = installMockBrowserStorage();

  const knownSecrets = [
    'ya29.ANDROID_NATIVE_SECRET_TOKEN_001',
    'ya29.ANDROID_NATIVE_REOPEN_TOKEN_002',
    'ya29.ANDROID_NATIVE_EXPIRED_REPLACEMENT_002B',
    'ya29.ANDROID_STALE_401_TOKEN',
    'ya29.ANDROID_NATIVE_REFRESHED_TOKEN_003',
    'ya29.ANDROID_OTHER_ACCOUNT_TOKEN_003B',
    'ya29.ANDROID_WRITE_TEST_TOKEN_003C',
    'ya29.WEB_POPUP_SECRET_TOKEN_004',
    'ya29.WEB_REDIRECT_SECRET_TOKEN_005',
    '4/0AeaYSH_SECRET_OAUTH_CODE_999'
  ];

  let calendarApiCalls: Array<{ url: string; method: string; authHeader: string }> = [];
  let nextEventsListStatus = 200;
  let nextEventsListEmail = 'teacher.glueck@gmail.com';
  let nextEventsListAccessRole = 'owner';
  let nextWriteStatus = 200;

  __setCalendarFetchForTesting(async (input, init) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    const authHeader = String((init?.headers as any)?.Authorization || '');
    calendarApiCalls.push({ url, method, authHeader });

    // Regression guard: calendars.get (/calendars/primary?...) MUST NEVER be called under calendar.events scope
    if (/\/calendars\/primary(\?|$)/.test(url) && !url.includes('/events')) {
      return new Response(
        JSON.stringify({
          error: {
            code: 403,
            message: 'Insufficient Permission: calendars.get requires calendar.readonly or calendar scope'
          }
        }),
        { status: 403 }
      );
    }

    // Verification & lookup endpoint: events.list
    if (url.includes('/calendars/primary/events') && method === 'GET') {
      if (url.includes('maxResults=1') && url.includes('accessRole')) {
        if (nextEventsListStatus !== 200) {
          return new Response(
            JSON.stringify({ error: { code: nextEventsListStatus, message: 'Auth check failed' } }),
            { status: nextEventsListStatus }
          );
        }
        return new Response(
          JSON.stringify({
            summary: nextEventsListEmail,
            timeZone: 'Africa/Cairo',
            accessRole: nextEventsListAccessRole,
            items: []
          }),
          { status: 200 }
        );
      }
      // privateExtendedProperty / event lookup
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }

    // Event ID direct lookup during sync
    if (/\/calendars\/primary\/events\/[^/?]+/.test(url) && method === 'GET') {
      return new Response(JSON.stringify({ error: { code: 404, message: 'Not Found' } }), { status: 404 });
    }

    // Write endpoint: events.insert / events.patch
    if (url.includes('/calendars/primary/events') && (method === 'POST' || method === 'PATCH')) {
      if (nextWriteStatus !== 200) {
        return new Response(
          JSON.stringify({ error: { code: nextWriteStatus, message: 'Write denied' } }),
          { status: nextWriteStatus }
        );
      }
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          id: parsedBody.id || 'gluckeventid12345',
          iCalUID: 'google-generated-ical-uid@google.com',
          summary: parsedBody.summary || 'Session'
        }),
        { status: 200 }
      );
    }

    return new Response('{}', { status: 404 });
  });

  try {
    // -------------------------------------------------------------------------
    // 1. ANDROID CAPACITOR: NATIVE AUTHORIZATION + events.list VERIFICATION
    // -------------------------------------------------------------------------
    console.log('1. Testing Android Capacitor native Calendar authorization & events.list verification...');
    __resetCalendarOAuthStateForTesting();
    calendarApiCalls = [];
    nextEventsListStatus = 200;
    nextEventsListAccessRole = 'owner';

    let webPopupCalls = 0;
    let webRedirectCalls = 0;
    let androidAuthorizeCalls = 0;
    let lastAndroidOptions: any = null;

    __setWebCalendarAuthTestAdapter({
      popupAuthorize: async () => {
        webPopupCalls++;
        throw new Error('Web popup must NEVER be invoked on Capacitor Android');
      },
      redirectAuthorize: async () => {
        webRedirectCalls++;
        throw new Error('Web redirect must NEVER be invoked on Capacitor Android');
      }
    });

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async (opts) => {
        androidAuthorizeCalls++;
        lastAndroidOptions = opts;
        return {
          cancelled: false,
          accessToken: 'ya29.ANDROID_NATIVE_SECRET_TOKEN_001',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher.glueck@gmail.com',
          stage: 'native_consent_approved',
          packageName: 'com.glueck.teacher'
        };
      }
    });

    // Trigger two concurrent calls to verify single-in-flight deduplication
    const [resA, resB] = await Promise.all([
      requestGoogleCalendarAccessToken(false),
      requestGoogleCalendarAccessToken(false)
    ]);

    assert.equal(resA.ok, true);
    assert.equal(resB.ok, true);
    assert.equal(resA.platform, 'android_native');
    assert.equal(resA.accountEmail, 'teacher.glueck@gmail.com');
    assert.equal(resA.scopeVerified, true);
    assert.equal(resA.readVerified, true);
    assert.equal(resA.writeVerified, false, 'Read verification MUST NOT set writeVerified=true');
    assert.equal(androidAuthorizeCalls, 1, 'Concurrent requests must deduplicate to 1 native authorization call');
    assert.equal(webPopupCalls, 0, 'Web popup must NEVER run on Android Capacitor');
    assert.equal(webRedirectCalls, 0, 'Web redirect must NEVER run on Android Capacitor');
    assert.equal(lastAndroidOptions?.scope, 'https://www.googleapis.com/auth/calendar.events');
    assert.equal(lastAndroidOptions?.silentOnly, false);

    // Confirm events.list verification ran (NOT calendars.get)
    assert.equal(calendarApiCalls.length, 1);
    assert.equal(calendarApiCalls[0].method, 'GET');
    assert.ok(
      calendarApiCalls[0].url.includes('/calendars/primary/events?maxResults=1&fields=summary,timeZone,accessRole'),
      `Expected events.list verification endpoint, got: ${calendarApiCalls[0].url}`
    );

    const stateAfterAndroid = getGoogleCalendarConnectionState();
    assert.equal(stateAfterAndroid.status, 'connected');
    assert.equal(stateAfterAndroid.scopeVerified, true);
    assert.equal(stateAfterAndroid.readVerified, true);
    assert.equal(stateAfterAndroid.writeVerified, false, 'writeVerified must stay false until an event write succeeds');
    assert.equal(stateAfterAndroid.hasInMemoryToken, true);
    assert.equal(stateAfterAndroid.accountEmail, 'teacher.glueck@gmail.com');
    assert.equal(stateAfterAndroid.calendarTimeZone, 'Africa/Cairo');
    assert.equal(stateAfterAndroid.calendarAccessRole, 'owner');

    // Confirm memory cache hit on immediate reuse without re-prompting
    const cachedRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(cachedRes.ok, true);
    assert.equal(androidAuthorizeCalls, 1, 'Subsequent call should reuse valid in-memory token');

    // -------------------------------------------------------------------------
    // 2. COLD RESTART / APP PROCESS DEATH: METADATA NEVER TREATED AS PROOF OF TOKEN
    // -------------------------------------------------------------------------
    console.log('2. Testing cold restart (persisted metadata downgraded to needs_verification + silent native reauth)...');
    __simulateColdRestartForTesting();

    const reopenedState = getGoogleCalendarConnectionState();
    assert.equal(
      reopenedState.status,
      'needs_verification',
      'Persisted metadata MUST NEVER report status=connected without a live in-memory token'
    );
    assert.equal(reopenedState.hasInMemoryToken, false);
    assert.equal(reopenedState.readVerified, false);
    assert.equal(reopenedState.writeVerified, false);
    assert.equal(reopenedState.accountEmail, 'teacher.glueck@gmail.com');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // Non-interactive mount check runs silentOnly=true and seamlessly restores token if grant is active
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async (opts) => {
        androidAuthorizeCalls++;
        lastAndroidOptions = opts;
        return {
          cancelled: false,
          accessToken: 'ya29.ANDROID_NATIVE_REOPEN_TOKEN_002',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher.glueck@gmail.com',
          stage: 'native_immediate_grant'
        };
      }
    });

    const silentReopenRes = await verifyOrSilentlyReauthorizeGoogleCalendar();
    assert.equal(silentReopenRes.ok, true);
    assert.equal(lastAndroidOptions?.silentOnly, true, 'Mount verification must pass silentOnly=true');
    assert.equal(lastAndroidOptions?.accountEmail, 'teacher.glueck@gmail.com', 'Should pass account hint on reopen');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.ANDROID_NATIVE_REOPEN_TOKEN_002');
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getGoogleCalendarConnectionState().hasInMemoryToken, true);

    // -------------------------------------------------------------------------
    // 3. TOKEN EXPIRATION: EXPIRED IN-MEMORY TOKEN MUST NEVER BE REUSED
    // -------------------------------------------------------------------------
    console.log('3. Testing expired in-memory token eviction (never reused after expiry)...');
    __setInMemoryTokenExpiryForTesting(Date.now() - 1000);
    assert.equal(getInMemoryGoogleCalendarToken(), null, 'Expired token must be rejected immediately');
    assert.equal(
      getGoogleCalendarConnectionState().status,
      'needs_verification',
      'Expired in-memory token must never show status=connected'
    );
    assert.equal(getGoogleCalendarConnectionState().hasInMemoryToken, false);

    let replacementAuthCalls = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => {
        replacementAuthCalls++;
        return {
          cancelled: false,
          accessToken: 'ya29.ANDROID_NATIVE_EXPIRED_REPLACEMENT_002B',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher.glueck@gmail.com',
          stage: 'native_immediate_grant'
        };
      }
    });

    const refreshedAfterExpiry = await requestGoogleCalendarAccessToken(false);
    assert.equal(refreshedAfterExpiry.ok, true);
    assert.equal(replacementAuthCalls, 1, 'Expired token must trigger a fresh Play Services authorization');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.ANDROID_NATIVE_EXPIRED_REPLACEMENT_002B');

    // -------------------------------------------------------------------------
    // 4. FAILED SILENT REAUTH / REVOKED PERMISSIONS -> CLEAR RECONNECT FLOW
    // -------------------------------------------------------------------------
    console.log('4. Testing revoked permissions / failed silent reauth transitioning cleanly to reconnect_required...');
    __simulateColdRestartForTesting();
    assert.equal(getGoogleCalendarConnectionState().status, 'needs_verification');

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async (opts) => {
        lastAndroidOptions = opts;
        if (opts?.silentOnly) {
          return {
            cancelled: false,
            resolutionRequired: true,
            stage: 'native_resolution_required',
            reason: 'Google Calendar authorization requires user interaction.'
          };
        }
        return {
          cancelled: false,
          accessToken: 'ya29.ANDROID_NATIVE_REOPEN_TOKEN_002',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher.glueck@gmail.com',
          stage: 'native_consent_approved'
        };
      }
    });

    const failedSilent = await verifyOrSilentlyReauthorizeGoogleCalendar();
    assert.equal(failedSilent.ok, false);
    assert.equal(failedSilent.resolutionRequired, true);
    assert.equal(lastAndroidOptions?.silentOnly, true);

    const stateAfterFailedSilent = getGoogleCalendarConnectionState();
    assert.equal(
      stateAfterFailedSilent.status,
      'reconnect_required',
      'Failed silent reauth MUST transition to reconnect_required instead of staying connected'
    );
    assert.equal(stateAfterFailedSilent.hasInMemoryToken, false);
    assert.equal(stateAfterFailedSilent.scopeVerified, false);
    assert.equal(stateAfterFailedSilent.readVerified, false);
    assert.equal(stateAfterFailedSilent.writeVerified, false);

    // User taps explicit Reconnect -> interactive flow (silentOnly=false) recovers cleanly
    const reconnectedInteractive = await requestGoogleCalendarAccessToken(true);
    assert.equal(reconnectedInteractive.ok, true);
    assert.equal(lastAndroidOptions?.silentOnly, false);
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');

    // -------------------------------------------------------------------------
    // 5. STALE 401 PLAY SERVICES TOKEN: AWAITED clearToken BEFORE RETRY
    // -------------------------------------------------------------------------
    console.log('5. Testing stale 401 token recovery with strictly awaited AuthorizationClient.clearToken ordering...');
    clearInMemoryGoogleCalendarToken();
    const timeline: string[] = [];
    let staleAttempt = 0;

    const prevFetch = __setCalendarFetchForTesting;
    // Temporarily wrap fetch to record exact verify_401 / verify_200 ordering
    __setCalendarFetchForTesting(async (input, init) => {
      const url = String(input);
      const authHeader = String((init?.headers as any)?.Authorization || '');
      if (url.includes('/calendars/primary/events') && url.includes('maxResults=1')) {
        if (authHeader.includes('ya29.ANDROID_STALE_401_TOKEN')) {
          timeline.push('verify_401');
          return new Response(JSON.stringify({ error: { code: 401, message: 'Invalid Credentials' } }), { status: 401 });
        }
        timeline.push('verify_200');
        return new Response(
          JSON.stringify({
            summary: 'teacher.glueck@gmail.com',
            timeZone: 'Africa/Cairo',
            accessRole: 'owner',
            items: []
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    });

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      clearCalendarToken: async ({ accessToken }) => {
        assert.equal(accessToken, 'ya29.ANDROID_STALE_401_TOKEN');
        timeline.push('clear_token_start');
        await new Promise((r) => setTimeout(r, 15));
        timeline.push('clear_token_done');
        return { cleared: true };
      },
      authorizeCalendar: async () => {
        staleAttempt++;
        if (staleAttempt === 1) {
          timeline.push('authorize_1');
          return {
            cancelled: false,
            accessToken: 'ya29.ANDROID_STALE_401_TOKEN',
            grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
            scopeVerified: true,
            email: 'teacher.glueck@gmail.com',
            stage: 'native_immediate_grant'
          };
        }
        timeline.push('authorize_2_start');
        return {
          cancelled: false,
          accessToken: 'ya29.ANDROID_NATIVE_REFRESHED_TOKEN_003',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher.glueck@gmail.com',
          stage: 'native_immediate_grant'
        };
      }
    });

    const autoRecovered = await requestGoogleCalendarAccessToken(false);
    assert.equal(autoRecovered.ok, true);
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.ANDROID_NATIVE_REFRESHED_TOKEN_003');
    assert.deepEqual(
      timeline,
      ['authorize_1', 'verify_401', 'clear_token_start', 'clear_token_done', 'authorize_2_start', 'verify_200'],
      'Async clearCalendarToken MUST complete strictly BEFORE retry authorizeCalendar is invoked'
    );
    void prevFetch;

    // Restore standard mock fetch
    __setCalendarFetchForTesting(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      const authHeader = String((init?.headers as any)?.Authorization || '');
      calendarApiCalls.push({ url, method, authHeader });
      if (/\/calendars\/primary(\?|$)/.test(url) && !url.includes('/events')) {
        return new Response(JSON.stringify({ error: { code: 403 } }), { status: 403 });
      }
      if (url.includes('/calendars/primary/events') && method === 'GET') {
        if (url.includes('maxResults=1') && url.includes('accessRole')) {
          if (nextEventsListStatus !== 200) {
            return new Response(JSON.stringify({ error: { code: nextEventsListStatus } }), {
              status: nextEventsListStatus
            });
          }
          return new Response(
            JSON.stringify({
              summary: nextEventsListEmail,
              timeZone: 'Africa/Cairo',
              accessRole: nextEventsListAccessRole,
              items: []
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      if (/\/calendars\/primary\/events\/[^/?]+/.test(url) && method === 'GET') {
        return new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 });
      }
      if (url.includes('/calendars/primary/events') && (method === 'POST' || method === 'PATCH')) {
        if (nextWriteStatus !== 200) {
          return new Response(JSON.stringify({ error: { code: nextWriteStatus } }), { status: nextWriteStatus });
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({ id: body.id || 'gluckeventid12345', iCalUID: 'google-ical@google.com' }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    });

    // -------------------------------------------------------------------------
    // 6. ACCOUNT SWITCHING (LIVE SESSION & ACROSS RESTART)
    // -------------------------------------------------------------------------
    console.log('6. Testing Firebase account switch invalidating prior token & persisted metadata...');
    __simulateFirebaseAccountChangeForTesting('other.teacher@gmail.com');

    assert.equal(getInMemoryGoogleCalendarToken(), null, 'Switching account must clear in-memory token immediately');
    const switchedState = getGoogleCalendarConnectionState();
    assert.equal(switchedState.status, 'reconnect_required');
    assert.equal(switchedState.lastErrorCode, 'ACCOUNT_SWITCHED');
    assert.equal(switchedState.accountEmail, undefined, 'Stale prior account email must be purged on switch');

    nextEventsListEmail = 'other.teacher@gmail.com';
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async (opts) => {
        lastAndroidOptions = opts;
        return {
          cancelled: false,
          accessToken: 'ya29.ANDROID_OTHER_ACCOUNT_TOKEN_003B',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'other.teacher@gmail.com',
          stage: 'native_consent_approved'
        };
      }
    });

    const otherAccountRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(otherAccountRes.ok, true);
    assert.equal(otherAccountRes.accountEmail, 'other.teacher@gmail.com');
    assert.equal(lastAndroidOptions?.accountEmail, 'other.teacher@gmail.com');

    // Simulate restart followed by account switch while in-memory token is already null
    __simulateColdRestartForTesting();
    assert.equal(getGoogleCalendarConnectionState().accountEmail, 'other.teacher@gmail.com');
    __simulateFirebaseAccountChangeForTesting('third.teacher@gmail.com');
    assert.equal(getGoogleCalendarConnectionState().status, 'reconnect_required');
    assert.equal(getGoogleCalendarConnectionState().accountEmail, undefined);
    __simulateFirebaseAccountChangeForTesting(null);
    nextEventsListEmail = 'teacher.glueck@gmail.com';

    // -------------------------------------------------------------------------
    // 7. SCOPE ENFORCEMENT & READ-ONLY VS WRITE PERMISSION SEPARATION
    // -------------------------------------------------------------------------
    console.log('7. Testing scope rejection, read-only accessRole rejection, and 403 vs 200 write verification...');
    // 7a. Native plugin reports scopeVerified: false (e.g. only calendar.readonly granted)
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: false,
        accessToken: 'ya29.ANDROID_WRITE_TEST_TOKEN_003C',
        grantedScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        scopeVerified: false,
        email: 'teacher.glueck@gmail.com',
        stage: 'native_consent_approved'
      })
    });
    const readonlyScopeRes = await requestGoogleCalendarAccessToken(true);
    assert.equal(readonlyScopeRes.ok, false);
    assert.equal(readonlyScopeRes.code, 'SCOPE_NOT_GRANTED');
    assert.equal(getGoogleCalendarConnectionState().status, 'reconnect_required');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // 7b. Calendar events.list returns accessRole='reader' -> rejected
    nextEventsListAccessRole = 'reader';
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: false,
        accessToken: 'ya29.ANDROID_WRITE_TEST_TOKEN_003C',
        grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
        scopeVerified: true,
        email: 'teacher.glueck@gmail.com',
        stage: 'native_consent_approved'
      })
    });
    const readerRoleRes = await requestGoogleCalendarAccessToken(true);
    assert.equal(readerRoleRes.ok, false);
    assert.equal(readerRoleRes.code, 'HTTP_403');
    assert.equal(getGoogleCalendarConnectionState().status, 'reconnect_required');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // 7c. Connect with owner role -> writeVerified stays false until real POST/PATCH; 403 on POST clears token
    nextEventsListAccessRole = 'owner';
    const writeCheckConnect = await requestGoogleCalendarAccessToken(true);
    assert.equal(writeCheckConnect.ok, true);
    assert.equal(getGoogleCalendarConnectionState().readVerified, true);
    assert.equal(getGoogleCalendarConnectionState().writeVerified, false);

    nextWriteStatus = 403;
    const deniedWriteRes = await syncSessionsToGoogleCalendar({
      allSessions: [makeSampleSession()],
      accessToken: writeCheckConnect.accessToken!
    });
    assert.equal(deniedWriteRes.success, false);
    assert.equal(deniedWriteRes.scopeInsufficient, true);
    assert.equal(getInMemoryGoogleCalendarToken(), null, '403 write denial must clear in-memory token');
    assert.equal(getGoogleCalendarConnectionState().status, 'reconnect_required');
    assert.equal(getGoogleCalendarConnectionState().writeVerified, false);

    // 7d. Reconnect and perform a real write (POST 200) -> writeVerified becomes true!
    nextWriteStatus = 200;
    const writeOkConnect = await requestGoogleCalendarAccessToken(true);
    assert.equal(writeOkConnect.ok, true);
    assert.equal(getGoogleCalendarConnectionState().writeVerified, false);

    const okWriteRes = await syncSessionsToGoogleCalendar({
      allSessions: [makeSampleSession()],
      accessToken: writeOkConnect.accessToken!
    });
    assert.equal(okWriteRes.success, true);
    assert.equal(okWriteRes.createdCount, 1);
    assert.equal(
      getGoogleCalendarConnectionState().writeVerified,
      true,
      'writeVerified must become true ONLY after a real events.insert/patch succeeds'
    );

    // -------------------------------------------------------------------------
    // 8. CANCELLED CONSENT & DISCONNECT (CLEAR TOKEN + REVOKE ACCESS)
    // -------------------------------------------------------------------------
    console.log('8. Testing cancelled consent and full disconnect (clearCalendarToken + revokeCalendarAccess)...');
    let nativeClearCalled = false;
    let nativeRevokeCalled = false;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      clearCalendarToken: async () => {
        nativeClearCalled = true;
        return { cleared: true };
      },
      revokeCalendarAccess: async () => {
        nativeRevokeCalled = true;
        return { revoked: true };
      }
    });
    await disconnectGoogleCalendar();
    assert.equal(nativeClearCalled, true, 'Disconnect must call AuthorizationClient.clearToken');
    assert.equal(nativeRevokeCalled, true, 'Disconnect must call AuthorizationClient.revokeAccess');
    assert.equal(getInMemoryGoogleCalendarToken(), null);
    assert.equal(getGoogleCalendarConnectionState().status, 'disconnected');

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: true,
        stage: 'native_consent_cancelled',
        reason: 'Google Calendar consent was cancelled by the user.'
      })
    });
    const cancelRes = await requestGoogleCalendarAccessToken(true);
    assert.equal(cancelRes.ok, false);
    assert.equal(cancelRes.cancelled, true);
    assert.equal(getGoogleCalendarConnectionState().status, 'cancelled');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // -------------------------------------------------------------------------
    // 9. ANDROID DEEP-LINK CALLBACK SINGLE-SHOT HANDLING
    // -------------------------------------------------------------------------
    console.log('9. Testing Android deep-link callback single-shot routing...');
    const cbUrl =
      'glueck://oauth/calendar/callback?status=cancelled&error=access_denied&code=4/0AeaYSH_SECRET_OAUTH_CODE_999&state=abc123';
    const firstCb = handleCalendarOAuthDeepLinkCallback(cbUrl);
    assert.equal(firstCb.matched, true);
    assert.equal(firstCb.alreadyHandled, false);
    assert.equal(firstCb.shouldOpenIntegrations, true);
    assert.equal(firstCb.status, 'cancelled');

    const secondCb = handleCalendarOAuthDeepLinkCallback(cbUrl);
    assert.equal(secondCb.matched, true);
    assert.equal(secondCb.alreadyHandled, true, 'Duplicate callback must be ignored on second delivery');

    const integrationsLink = handleCalendarOAuthDeepLinkCallback('glueck://integrations');
    assert.equal(integrationsLink.matched, true);
    assert.equal(integrationsLink.shouldOpenIntegrations, true);

    // -------------------------------------------------------------------------
    // 10. WEB BUILD: POPUP, REDIRECT FALLBACK, STARTUP getRedirectResult & COLD RELOAD
    // -------------------------------------------------------------------------
    console.log('10. Testing Web build popup flow, redirect fallback, startup getRedirectResult, and reload...');
    __resetCalendarOAuthStateForTesting();
    calendarApiCalls = [];
    nextEventsListStatus = 200;
    nextEventsListAccessRole = 'owner';
    nextEventsListEmail = 'web.teacher@gmail.com';

    let androidCallsOnWeb = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => false,
      authorizeCalendar: async () => {
        androidCallsOnWeb++;
        throw new Error('Android native plugin must NEVER be called on Web');
      }
    });

    __setWebCalendarAuthTestAdapter({
      popupAuthorize: async () => ({
        accessToken: 'ya29.WEB_POPUP_SECRET_TOKEN_004',
        email: 'web.teacher@gmail.com'
      })
    });

    const webPopupRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(webPopupRes.ok, true);
    assert.equal(webPopupRes.platform, 'web');
    assert.equal(webPopupRes.accountEmail, 'web.teacher@gmail.com');
    assert.equal(webPopupRes.readVerified, true);
    assert.equal(webPopupRes.writeVerified, false);
    assert.equal(androidCallsOnWeb, 0, 'Android native plugin must never run on Web');

    // Web cold reload -> non-interactive verification transitions to reconnect_required
    __simulateColdRestartForTesting();
    assert.equal(getGoogleCalendarConnectionState().status, 'needs_verification');
    const webReloadVerify = await verifyOrSilentlyReauthorizeGoogleCalendar();
    assert.equal(webReloadVerify.ok, false);
    assert.equal(getGoogleCalendarConnectionState().status, 'reconnect_required');

    // Web popup cancelled
    __setWebCalendarAuthTestAdapter({
      popupAuthorize: async () => {
        throw Object.assign(new Error('Popup closed'), { code: 'auth/popup-closed-by-user' });
      }
    });
    const webCancelRes = await requestGoogleCalendarAccessToken(true);
    assert.equal(webCancelRes.ok, false);
    assert.equal(webCancelRes.cancelled, true);
    assert.equal(getGoogleCalendarConnectionState().status, 'cancelled');

    // Web popup blocked -> redirect fallback -> startup single-shot getRedirectResult
    let redirectTriggered = false;
    let consumeRedirectCalls = 0;
    __setWebCalendarAuthTestAdapter({
      popupAuthorize: async () => {
        throw Object.assign(new Error('Popup blocked'), { code: 'auth/popup-blocked' });
      },
      redirectAuthorize: async () => {
        redirectTriggered = true;
      },
      consumeRedirectResult: async () => {
        consumeRedirectCalls++;
        return {
          accessToken: 'ya29.WEB_REDIRECT_SECRET_TOKEN_005',
          email: 'web.teacher@gmail.com'
        };
      }
    });

    const webFallbackRes = await requestGoogleCalendarAccessToken(true);
    assert.equal(webFallbackRes.ok, false);
    assert.equal(webFallbackRes.redirected, true);
    assert.equal(redirectTriggered, true);
    assert.equal(getGoogleCalendarConnectionState().status, 'pending_redirect');

    const [startup1, startup2] = await Promise.all([
      processPendingWebCalendarRedirectResult(),
      processPendingWebCalendarRedirectResult()
    ]);
    assert.equal(consumeRedirectCalls, 1, 'getRedirectResult must be processed exactly once on startup');
    assert.equal(startup1.handled, true);
    assert.equal(startup1.ok, true);
    assert.equal(startup1.shouldOpenIntegrations, true);
    assert.equal(startup2.handled, true);
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.WEB_REDIRECT_SECRET_TOKEN_005');

    // -------------------------------------------------------------------------
    // 11. ZERO SECRET LEAKAGE AUDIT
    // -------------------------------------------------------------------------
    console.log('11. Auditing diagnostics, localStorage, and sessionStorage for zero secret leakage...');
    assertNoSecretsInDiagnosticsOrStorage(knownSecrets, localMap, sessionMap);

    // -------------------------------------------------------------------------
    // 12. STATIC ANDROID PLAY SERVICES 21.4.0, JAVA PLUGIN & APP WIRING AUDIT
    // -------------------------------------------------------------------------
    console.log('12. Verifying Android Gradle 21.4.0, AuthorizationClient.clearToken/revokeAccess, and process-death recovery...');
    const rootDir = process.cwd();
    const gradleSrc = fs.readFileSync(path.join(rootDir, 'android/app/build.gradle'), 'utf8');
    const pluginJavaSrc = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/java/com/glueck/app/GoogleCredentialAuthPlugin.java'),
      'utf8'
    );
    const manifestSrc = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/AndroidManifest.xml'),
      'utf8'
    );
    const firebaseSyncSrc = fs.readFileSync(
      path.join(rootDir, 'src/shared/firebaseCloudSync.ts'),
      'utf8'
    );
    const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');

    assert.ok(
      gradleSrc.includes('com.google.android.gms:play-services-auth:21.4.0'),
      'android/app/build.gradle must include play-services-auth:21.4.0 for AuthorizationClient.clearToken & revokeAccess'
    );
    assert.equal(
      pluginJavaSrc.includes('GoogleAuthUtil.clearToken'),
      false,
      'Deprecated GoogleAuthUtil.clearToken MUST NOT be used for AuthorizationClient tokens'
    );
    assert.ok(pluginJavaSrc.includes('ClearTokenRequest.builder()'));
    assert.ok(pluginJavaSrc.includes('RevokeAccessRequest.builder()'));
    assert.ok(pluginJavaSrc.includes('.clearToken(clearRequest)'));
    assert.ok(pluginJavaSrc.includes('.revokeAccess(revokeRequest)'));
    assert.ok(pluginJavaSrc.includes('public void authorizeCalendar('));
    assert.ok(pluginJavaSrc.includes('public void clearCalendarToken('));
    assert.ok(pluginJavaSrc.includes('public void revokeCalendarAccess('));
    assert.ok(pluginJavaSrc.includes('silentOnly'));
    assert.ok(pluginJavaSrc.includes('native_resolution_required'));
    assert.ok(pluginJavaSrc.includes('calendarAuthProcessRestored'));
    assert.ok(pluginJavaSrc.includes('Identity.getAuthorizationClient(activity)'));
    assert.ok(pluginJavaSrc.includes('StartIntentSenderForResult'));
    assert.ok(pluginJavaSrc.includes('calendarAuthInProgress.compareAndSet(false, true)'));
    assert.ok(pluginJavaSrc.includes('getAuthorizationResultFromIntent'));
    assert.ok(manifestSrc.includes('android:scheme="glueck"'));
    assert.ok(manifestSrc.includes('android:launchMode="singleTop"'));
    assert.ok(firebaseSyncSrc.includes('export function consumeFirebaseWebRedirectResultOnce'));
    assert.ok(appSrc.includes('handleCalendarOAuthDeepLinkCallback'));
    assert.ok(appSrc.includes('processPendingWebCalendarRedirectResult'));
    assert.ok(appSrc.includes('subscribeNativeCalendarAuthProcessRestored'));

    console.log('ALL GOOGLE CALENDAR OAUTH PRODUCTION-READINESS AUDIT TESTS PASSED SUCCESSFULLY!');
  } finally {
    __setCalendarFetchForTesting(null);
    __setNativeAuthTestAdapter(null);
    __setWebCalendarAuthTestAdapter(null);
    __resetCalendarOAuthStateForTesting();
  }
}

runCalendarOAuthFlowTests().catch((err) => {
  console.error('Calendar OAuth flow tests failed:', err);
  process.exit(1);
});
