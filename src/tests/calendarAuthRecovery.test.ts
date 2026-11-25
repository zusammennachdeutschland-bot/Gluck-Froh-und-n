import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { __setNativeAuthTestAdapter } from '../shared/googleCredentialAuthPlugin';
import {
  __resetCalendarOAuthStateForTesting,
  __setCalendarAuthTimeoutsForTesting,
  __setCalendarFetchForTesting,
  __setWebCalendarAuthTestAdapter,
  __simulateColdRestartForTesting,
  disconnectGoogleCalendar,
  getGoogleCalendarConnectionState,
  getInMemoryGoogleCalendarToken,
  requestGoogleCalendarAccessToken,
  subscribeGoogleCalendarConnectionState,
  verifyOrSilentlyReauthorizeGoogleCalendar
} from '../services/calendarSyncService';

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

function makeHealthyCalendarFetch(email = 'teacher.recovery@gmail.com') {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/calendars/primary/events') && url.includes('maxResults=1')) {
      return new Response(
        JSON.stringify({
          summary: email,
          timeZone: 'Africa/Cairo',
          accessRole: 'owner',
          items: []
        }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  };
}

async function runCalendarAuthRecoveryTests() {
  console.log('=== Starting P0 Google Calendar Auth & Connection Recovery Suite ===');
  const { localMap } = installMockBrowserStorage();

  try {
    // -------------------------------------------------------------------------
    // 1. VERIFICATION TIMEOUT (never stuck in "Verifying")
    // -------------------------------------------------------------------------
    console.log('1. Testing Calendar API verification timeout exits verifying cleanly...');
    __resetCalendarOAuthStateForTesting();
    __setCalendarAuthTimeoutsForTesting({ verifyFetchMs: 60, silentNativeMs: 80, nativeCleanupMs: 60 });

    let fetchAborted = false;
    __setCalendarFetchForTesting(async (_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          fetchAborted = true;
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      });
    });

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: false,
        accessToken: 'ya29.TIMEOUT_VERIFY_TOKEN',
        grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
        scopeVerified: true,
        email: 'teacher.recovery@gmail.com'
      })
    });

    const verifyTimeoutRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(verifyTimeoutRes.ok, false);
    assert.equal(verifyTimeoutRes.code, 'VERIFY_TIMEOUT');
    assert.equal(fetchAborted, true, 'Timed-out verification fetch must abort via AbortController');
    assert.equal(getGoogleCalendarConnectionState().status, 'error');
    assert.equal(getGoogleCalendarConnectionState().lastErrorCode, 'VERIFY_TIMEOUT');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // -------------------------------------------------------------------------
    // 2. SILENT NATIVE AUTH HANG TIMEOUT -> RECONNECT_REQUIRED + NATIVE CANCEL
    // -------------------------------------------------------------------------
    console.log('2. Testing hung silent native authorization times out and calls cancelCalendarAuthorization...');
    __resetCalendarOAuthStateForTesting();
    __setCalendarAuthTimeoutsForTesting({ silentNativeMs: 60, nativeCleanupMs: 50 });

    localMap.set(
      'glueck_google_calendar_connection_meta_v1',
      JSON.stringify({
        status: 'connected',
        accountEmail: 'teacher.recovery@gmail.com',
        scopeVerified: true
      })
    );
    const coldState = __simulateColdRestartForTesting();
    assert.equal(coldState.status, 'needs_verification', 'Stale persisted connected state must downgrade to needs_verification');

    let cancelCalledCount = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => new Promise(() => {}), // hangs indefinitely
      cancelCalendarAuthorization: async () => {
        cancelCalledCount++;
        return { cancelled: true };
      }
    });

    const silentTimeoutRes = await verifyOrSilentlyReauthorizeGoogleCalendar();
    assert.equal(silentTimeoutRes.ok, false);
    assert.equal(silentTimeoutRes.code, 'AUTH_TIMEOUT');
    assert.equal(getGoogleCalendarConnectionState().status, 'reconnect_required');
    assert.ok(cancelCalledCount >= 1, 'Timed-out silent native auth must invoke native cancelCalendarAuthorization');

    // -------------------------------------------------------------------------
    // 3. NATIVE AUTH CANCELLATION & NATIVE AUTH FAILURE
    // -------------------------------------------------------------------------
    console.log('3. Testing native auth cancellation and native auth failure transitions...');
    __resetCalendarOAuthStateForTesting();
    __setCalendarFetchForTesting(makeHealthyCalendarFetch());

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: true,
        reason: 'User dismissed consent sheet'
      })
    });
    const cancelRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(cancelRes.ok, false);
    assert.equal(cancelRes.cancelled, true);
    assert.equal(getGoogleCalendarConnectionState().status, 'cancelled');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => {
        throw Object.assign(new Error('Play Services unavailable'), { code: 'PLAY_SERVICES_ERROR' });
      }
    });
    const failRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(failRes.ok, false);
    assert.equal(failRes.code, 'PLAY_SERVICES_ERROR');
    assert.equal(getGoogleCalendarConnectionState().status, 'error');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // -------------------------------------------------------------------------
    // 4. DISCONNECT DURING VERIFYING + LATE NATIVE CALLBACK DROPPED
    // -------------------------------------------------------------------------
    console.log('4. Testing disconnect during active verification and dropping late native callback...');
    __resetCalendarOAuthStateForTesting();
    __setCalendarAuthTimeoutsForTesting({ silentNativeMs: 5000, interactiveNativeMs: 5000, nativeCleanupMs: 50 });
    __setCalendarFetchForTesting(makeHealthyCalendarFetch());

    let resolveLateNativeAuth!: (val: any) => void;
    let disconnectNativeCancelCount = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: () =>
        new Promise((resolve) => {
          resolveLateNativeAuth = resolve;
        }),
      cancelCalendarAuthorization: async () => {
        disconnectNativeCancelCount++;
        return { cancelled: true };
      },
      clearCalendarToken: async () => new Promise(() => {}), // simulate hung native cleanup to ensure bounded timeout!
      revokeCalendarAccess: async () => new Promise(() => {})
    });

    const inFlightAuth = requestGoogleCalendarAccessToken(false);
    // Let it enter 'connecting'
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(getGoogleCalendarConnectionState().status, 'connecting');

    // User taps Disconnect while auth is hanging!
    await disconnectGoogleCalendar();
    assert.equal(getGoogleCalendarConnectionState().status, 'disconnected');
    assert.equal(getInMemoryGoogleCalendarToken(), null);
    assert.ok(disconnectNativeCancelCount >= 1, 'Disconnect must cancel in-flight native authorization');

    // Now the stale native callback arrives LATE with a valid token!
    resolveLateNativeAuth({
      cancelled: false,
      accessToken: 'ya29.LATE_GHOST_TOKEN_AFTER_DISCONNECT',
      grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
      scopeVerified: true,
      email: 'ghost@gmail.com'
    });

    const lateOutcome = await inFlightAuth;
    assert.equal(lateOutcome.ok, false);
    assert.equal(lateOutcome.code, 'DISCONNECTED_DURING_AUTH');
    assert.equal(
      getGoogleCalendarConnectionState().status,
      'disconnected',
      'Late native callback after disconnect MUST NEVER resurrect connected state'
    );
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // -------------------------------------------------------------------------
    // 5. RECONNECT IMMEDIATELY AFTER DISCONNECT + STATE TRANSITIONS
    // -------------------------------------------------------------------------
    console.log('5. Testing immediate reconnect after disconnect with explicit connecting -> verifying -> connected transitions...');
    const observedStatuses: string[] = [];
    const unsub = subscribeGoogleCalendarConnectionState((s) => {
      observedStatuses.push(s.status);
    });

    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: false,
        accessToken: 'ya29.FRESH_RECONNECT_TOKEN',
        grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
        scopeVerified: true,
        email: 'teacher.recovery@gmail.com'
      })
    });

    const reconnected = await requestGoogleCalendarAccessToken(true);
    unsub();

    assert.equal(reconnected.ok, true);
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getGoogleCalendarConnectionState().readVerified, true);
    assert.equal(getGoogleCalendarConnectionState().hasInMemoryToken, true);
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.FRESH_RECONNECT_TOKEN');
    assert.ok(observedStatuses.includes('connecting'), `Expected connecting in ${observedStatuses.join(',')}`);
    assert.ok(observedStatuses.includes('verifying'), `Expected verifying in ${observedStatuses.join(',')}`);
    assert.equal(observedStatuses[observedStatuses.length - 1], 'connected');

    // -------------------------------------------------------------------------
    // 6. INTERACTIVE CONNECT SUPERSEDES STUCK SILENT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('6. Testing interactive reconnect supersedes stuck silent verification without blocking...');
    __resetCalendarOAuthStateForTesting();
    __setCalendarAuthTimeoutsForTesting({ silentNativeMs: 5000, interactiveNativeMs: 5000, nativeCleanupMs: 50 });
    __setCalendarFetchForTesting(makeHealthyCalendarFetch());

    localMap.set(
      'glueck_google_calendar_connection_meta_v1',
      JSON.stringify({ status: 'verifying', accountEmail: 'teacher.recovery@gmail.com' })
    );
    const restartedFromVerifying = __simulateColdRestartForTesting();
    assert.equal(restartedFromVerifying.status, 'needs_verification');

    let resolveStuckSilent!: (v: any) => void;
    let interactiveCallCount = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: (opts) => {
        if (opts.silentOnly) {
          return new Promise((resolve) => {
            resolveStuckSilent = resolve;
          });
        }
        interactiveCallCount++;
        return Promise.resolve({
          cancelled: false,
          accessToken: 'ya29.INTERACTIVE_SUPERSEDE_TOKEN',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher.recovery@gmail.com'
        });
      },
      cancelCalendarAuthorization: async () => ({ cancelled: true })
    });

    const stuckSilentPromise = verifyOrSilentlyReauthorizeGoogleCalendar();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(getGoogleCalendarConnectionState().status, 'verifying');

    // User clicks Reconnect / Connect while silent verification is stuck!
    const interactiveRes = await requestGoogleCalendarAccessToken(false);
    assert.equal(interactiveRes.ok, true);
    assert.equal(interactiveCallCount, 1);
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.INTERACTIVE_SUPERSEDE_TOKEN');

    // Late resolution of the superseded silent call must not clobber the active interactive session
    resolveStuckSilent({
      cancelled: false,
      resolutionRequired: true,
      reason: 'Late silent failure'
    });
    const staleSilentRes = await stuckSilentPromise;
    assert.equal(staleSilentRes.ok, false);
    assert.equal(getGoogleCalendarConnectionState().status, 'connected');
    assert.equal(getInMemoryGoogleCalendarToken(), 'ya29.INTERACTIVE_SUPERSEDE_TOKEN');

    // -------------------------------------------------------------------------
    // 7. APP RESTART WITH EXPIRED CREDENTIALS (401 -> clearToken -> retry 401 -> expired)
    // -------------------------------------------------------------------------
    console.log('7. Testing app restart with expired credentials never reports connected...');
    __resetCalendarOAuthStateForTesting();
    localMap.set(
      'glueck_google_calendar_connection_meta_v1',
      JSON.stringify({ status: 'connected', accountEmail: 'expired@gmail.com', scopeVerified: true })
    );
    __simulateColdRestartForTesting();
    assert.equal(getGoogleCalendarConnectionState().status, 'needs_verification');

    __setCalendarFetchForTesting(async () => new Response(JSON.stringify({ error: { code: 401 } }), { status: 401 }));
    let clearCalled = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => ({
        cancelled: false,
        accessToken: 'ya29.PERMANENTLY_EXPIRED',
        grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
        scopeVerified: true,
        email: 'expired@gmail.com'
      }),
      clearCalendarToken: async () => {
        clearCalled++;
        return { cleared: true };
      }
    });

    const expiredRestartRes = await verifyOrSilentlyReauthorizeGoogleCalendar();
    assert.equal(expiredRestartRes.ok, false);
    assert.equal(clearCalled, 1);
    assert.equal(getGoogleCalendarConnectionState().status, 'expired');
    assert.equal(getInMemoryGoogleCalendarToken(), null);

    // -------------------------------------------------------------------------
    // 8. CONCURRENT INTERACTIVE AUTH ATTEMPTS DEDUPLICATE SAFELY
    // -------------------------------------------------------------------------
    console.log('8. Testing concurrent non-forced interactive auth attempts deduplicate cleanly...');
    __resetCalendarOAuthStateForTesting();
    __setCalendarFetchForTesting(makeHealthyCalendarFetch());
    let concurrentNativeCalls = 0;
    __setNativeAuthTestAdapter({
      isAndroidNative: () => true,
      authorizeCalendar: async () => {
        concurrentNativeCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          cancelled: false,
          accessToken: 'ya29.CONCURRENT_SHARED_TOKEN',
          grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
          scopeVerified: true,
          email: 'teacher.recovery@gmail.com'
        };
      }
    });

    const [c1, c2, c3] = await Promise.all([
      requestGoogleCalendarAccessToken(false),
      requestGoogleCalendarAccessToken(false),
      requestGoogleCalendarAccessToken(false)
    ]);
    assert.equal(concurrentNativeCalls, 1);
    assert.equal(c1.ok, true);
    assert.equal(c2.ok, true);
    assert.equal(c3.ok, true);

    // -------------------------------------------------------------------------
    // 9. UI & ANDROID NATIVE PLUGIN STRUCTURAL GUARANTEES
    // -------------------------------------------------------------------------
    console.log('9. Auditing ZoomIntegrationsManager UI controls & GoogleCredentialAuthPlugin native watchdogs...');
    const rootDir = process.cwd();
    const uiSrc = fs.readFileSync(path.join(rootDir, 'src/components/ZoomIntegrationsManager.tsx'), 'utf8');
    const javaSrc = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/java/com/glueck/app/GoogleCredentialAuthPlugin.java'),
      'utf8'
    );

    // Permanent, always-enabled Disconnect Google Calendar button
    assert.ok(
      uiSrc.includes('data-testid="disconnect-google-calendar-btn"'),
      'ZoomIntegrationsManager must render a permanent Disconnect Google Calendar button'
    );
    const disconnectBlockMatch = uiSrc.match(/data-testid="disconnect-google-calendar-btn"[\s\S]*?<\/button>/);
    assert.ok(disconnectBlockMatch, 'Could not locate Disconnect Google Calendar button block');
    assert.equal(
      disconnectBlockMatch[0].includes('disabled='),
      false,
      'Disconnect Google Calendar button MUST NEVER be disabled'
    );

    // Connect / Reconnect button must NOT be disabled while verifying/connecting
    const connectBlockMatch = uiSrc.match(/data-testid="connect-google-calendar-btn"[\s\S]*?<\/button>/);
    assert.ok(connectBlockMatch, 'Could not locate Connect/Reconnect Google Calendar button block');
    assert.equal(
      connectBlockMatch[0].includes('disabled={isConnectingCalendar}'),
      false,
      'Connect/Reconnect button must remain clickable to supersede stuck verification'
    );

    // Native Java plugin must not use activity-scoped Task listeners that drop callbacks on pause/stop
    assert.equal(
      javaSrc.includes('.addOnSuccessListener(activity,'),
      false,
      'GoogleCredentialAuthPlugin must NOT use activity-scoped addOnSuccessListener'
    );
    assert.equal(
      javaSrc.includes('.addOnFailureListener(activity,'),
      false,
      'GoogleCredentialAuthPlugin must NOT use activity-scoped addOnFailureListener'
    );
    assert.ok(javaSrc.includes('addOnCanceledListener('), 'Java plugin must handle Task cancellation');
    assert.ok(javaSrc.includes('public void cancelCalendarAuthorization('), 'Java plugin must expose cancelCalendarAuthorization');
    assert.ok(javaSrc.includes('scheduleCalendarTimeoutWatchdog('), 'Java plugin must enforce native watchdog timeouts');
    assert.ok(javaSrc.includes('handleOnDestroy()'), 'Java plugin must release pending state on destroy');

    console.log('ALL P0 GOOGLE CALENDAR AUTH & CONNECTION RECOVERY TESTS PASSED!');
  } finally {
    __setCalendarFetchForTesting(null);
    __setNativeAuthTestAdapter(null);
    __setWebCalendarAuthTestAdapter(null);
    __setCalendarAuthTimeoutsForTesting(null);
    __resetCalendarOAuthStateForTesting();
  }
}

runCalendarAuthRecoveryTests().catch((err) => {
  console.error('P0 Google Calendar recovery tests failed:', err);
  process.exit(1);
});
