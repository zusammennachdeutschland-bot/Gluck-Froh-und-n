import assert from 'node:assert/strict';
import { Group, GroupWeeklySession, ZoomMeetingHistory, ZoomMeetingRecord } from '../types';
import {
  __resetZoomServiceMemoryForTesting,
  __setZoomProxyFetchForTesting,
  deleteZoomMeetingSeriesRemote,
  listAllZoomScheduledMeetings,
  saveZoomUiMeta
} from '../services/zoomService';
import {
  __resetCalendarOAuthStateForTesting,
  __setCalendarFetchForTesting,
  deleteGoogleCalendarEventForCleanup,
  matchGoogleCalendarEventsToZoomCleanup
} from '../services/calendarSyncService';
import {
  CLEANUP_RECOVERY_SNAPSHOTS_STORAGE_KEY,
  CLEANUP_REBUILD_OPERATION_STORAGE_KEY,
  __resetCleanupRebuildMemoryForTesting,
  __setCleanupStorageAdapterForTesting,
  __simulateCleanupProcessDeathForTesting,
  executeZoomCalendarCleanupRebuild,
  loadCleanupRebuildOperation,
  loadCleanupRecoverySnapshots,
  previewZoomCalendarCleanupRebuild
} from '../services/zoomCalendarCleanupRebuildService';
import {
  deriveDeterministicGoogleEventId,
  reconcileGroupWeeklySessions
} from '../services/zoomSessionStandardizer';

interface MockZoomMeeting {
  id: string;
  uuid?: string;
  topic: string;
  type: number;
  start_time?: string;
  duration?: number;
  timezone?: string;
  join_url: string;
  status?: string;
  isLive?: boolean;
}

interface MockCalendarEvent {
  id: string;
  iCalUID?: string;
  summary: string;
  location?: string;
  description?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  recurrence?: string[];
  extendedProperties?: { private?: Record<string, string> };
}

function makeFakeResponse(status: number, body: any, headers: Record<string, string> = {}) {
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lowerHeaders[k.toLowerCase()] = v;
  const textBody = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => lowerHeaders[k.toLowerCase()] ?? null
    },
    json: async () => (typeof body === 'string' ? JSON.parse(body || '{}') : body),
    text: async () => textBody
  } as unknown as Response;
}

function makeTestGroups(): Group[] {
  return [
    {
      id: 'grp_b1_1',
      name: 'B1.1 Evening',
      grade: 'B1',
      type: 'online',
      status: 'active',
      monthlyPackagePrice: 1500,
      sessionCount: 8,
      color: '#2563eb',
      lessonDurationMinutes: 90,
      schedules: [
        { day: 'Monday', time: '18:00' },
        { day: 'Thursday', time: '20:00' }
      ],
      zoomLink: 'https://us05web.zoom.us/j/99112233445'
    },
    {
      id: 'grp_a2_2',
      name: 'A2.2 Morning',
      grade: 'A2',
      type: 'online',
      status: 'active',
      monthlyPackagePrice: 1200,
      sessionCount: 8,
      color: '#059669',
      lessonDurationMinutes: 120,
      schedules: [{ day: 'Wednesday', time: '10:30' }]
    },
    {
      id: 'grp_offline',
      name: 'Offline Cairo Center',
      grade: 'B2',
      type: 'offline',
      status: 'active',
      monthlyPackagePrice: 1000,
      sessionCount: 8,
      color: '#d97706',
      lessonDurationMinutes: 90,
      schedules: [{ day: 'Tuesday', time: '15:00' }]
    },
    {
      id: 'grp_archived',
      name: 'Archived A1',
      grade: 'A1',
      type: 'online',
      status: 'archived',
      monthlyPackagePrice: 1000,
      sessionCount: 8,
      color: '#64748b',
      lessonDurationMinutes: 60,
      schedules: [{ day: 'Friday', time: '14:00' }]
    }
  ];
}

function createPersistentTestStore() {
  const map = new Map<string, any>();
  return {
    map,
    adapter: {
      getItem: async (k: string) => (map.has(k) ? JSON.parse(JSON.stringify(map.get(k))) : null),
      setItem: async (k: string, v: any) => {
        map.set(k, JSON.parse(JSON.stringify(v)));
      },
      removeItem: async (k: string) => {
        map.delete(k);
      }
    }
  };
}

async function runTests() {
  let passed = 0;

  // ==========================================================================
  // TEST 1: Multi-page Zoom pagination + 64-bit string IDs + Live detection
  // ==========================================================================
  {
    __resetZoomServiceMemoryForTesting();
    const seenUrls: string[] = [];
    const page1Meetings: MockZoomMeeting[] = [
      {
        id: '91234567890123456', // > Number.MAX_SAFE_INTEGER to verify exact string preservation
        topic: 'Manual Meeting Page 1',
        type: 2,
        start_time: '2026-12-01T10:00:00Z',
        join_url: 'https://zoom.us/j/91234567890123456'
      }
    ];
    const page2Meetings: MockZoomMeeting[] = [
      {
        id: '88441122334',
        topic: 'Old Recurring Series Page 2',
        type: 8,
        start_time: '2026-12-02T18:00:00Z',
        join_url: 'https://zoom.us/j/88441122334'
      }
    ];

    __setZoomProxyFetchForTesting(async (url) => {
      seenUrls.push(url);
      if (url === '/api/zoom/session') return makeFakeResponse(200, { sessionToken: 'sess_tok' });
      const u = new URL(url, 'http://localhost');
      const listType = u.searchParams.get('type');
      const pageSize = u.searchParams.get('page_size');
      const token = u.searchParams.get('next_page_token') || '';
      assert.equal(pageSize, '300', 'page_size=300 must be preserved on every page');

      if (listType === 'scheduled') {
        if (!token) {
          return makeFakeResponse(200, {
            ok: true,
            meetings: page1Meetings,
            nextPageToken: 'tok_page_2',
            pageCount: 2,
            pageSize: 300,
            totalRecords: 2,
            hostEmail: 'teacher@glueck.edu',
            hostScope: 'single_connected_host'
          });
        }
        assert.equal(token, 'tok_page_2');
        return makeFakeResponse(200, {
          ok: true,
          meetings: page2Meetings,
          nextPageToken: '',
          pageCount: 2,
          pageSize: 300,
          totalRecords: 2,
          hostEmail: 'teacher@glueck.edu',
          hostScope: 'single_connected_host'
        });
      }
      if (listType === 'live') {
        return makeFakeResponse(200, {
          ok: true,
          meetings: [],
          nextPageToken: '',
          hostEmail: 'teacher@glueck.edu',
          hostScope: 'single_connected_host'
        });
      }
      return makeFakeResponse(404, { error: 'Unexpected URL ' + url });
    });

    const inv = await listAllZoomScheduledMeetings({ includeLiveCheck: true, retryDelayMs: 0 });
    assert.equal(inv.ok, true);
    assert.equal(inv.pagesFetched, 2);
    assert.equal(inv.meetings.length, 2);
    assert.equal(inv.meetings[0].id, '91234567890123456', '64-bit Zoom meeting ID must stay exact string');
    assert.equal(inv.meetings[1].isRecurring, true);
    assert.equal(inv.hostScope, 'single_connected_host');
    assert.ok(seenUrls.some((u) => u.includes('type=scheduled') && u.includes('next_page_token=tok_page_2')));
    passed++;
    console.log('✓ Test 1: Multi-page Zoom pagination & 64-bit string ID preservation');
  }

  // ==========================================================================
  // TEST 2: Zoom DELETE edge cases: no occurrence_id, 404 GET-verified, 401/403 refused, 429 & 5xx retried
  // ==========================================================================
  {
    __resetZoomServiceMemoryForTesting();
    const deleteCalls: string[] = [];
    let rateLimitCount = 0;
    let server500Count = 0;

    __setZoomProxyFetchForTesting(async (url, init) => {
      if (url === '/api/zoom/session') return makeFakeResponse(200, { sessionToken: 'sess_tok' });
      const method = (init?.method || 'GET').toUpperCase();
      if (method === 'DELETE') {
        deleteCalls.push(url);
        assert.equal(url.includes('occurrence_id'), false, 'DELETE must NEVER pass occurrence_id');
      }
      if (url === '/api/zoom/meetings/10000000001' && method === 'DELETE') {
        return makeFakeResponse(404, { deleted: false, alreadyDeletedCandidate: true, error: 'Not found' });
      }
      if (url === '/api/zoom/meetings/10000000001' && method === 'GET') {
        return makeFakeResponse(404, { exists: false, error: 'Not found' });
      }
      if (url === '/api/zoom/meetings/10000000002' && method === 'DELETE') {
        return makeFakeResponse(404, { deleted: false, alreadyDeletedCandidate: true });
      }
      if (url === '/api/zoom/meetings/10000000002' && method === 'GET') {
        // Still exists despite 404 on DELETE -> must NOT claim deleted!
        return makeFakeResponse(200, { ok: true, exists: true, zoomMeetingId: '10000000002', topic: 'Ghost' });
      }
      if (url === '/api/zoom/meetings/10000000003' && method === 'DELETE') {
        return makeFakeResponse(401, { error: 'Unauthorized' });
      }
      if (url === '/api/zoom/meetings/10000000004' && method === 'DELETE') {
        return makeFakeResponse(403, { error: 'Forbidden missing scope' });
      }
      if (url === '/api/zoom/meetings/10000000005' && method === 'DELETE') {
        rateLimitCount++;
        if (rateLimitCount <= 2) return makeFakeResponse(429, { error: 'Rate limit' }, { 'Retry-After': '0' });
        return makeFakeResponse(200, { ok: true, deleted: true, zoomMeetingId: '10000000005' });
      }
      if (url === '/api/zoom/meetings/10000000006' && method === 'DELETE') {
        server500Count++;
        if (server500Count === 1) return makeFakeResponse(503, { error: 'Service unavailable' });
        return makeFakeResponse(200, { ok: true, deleted: true, zoomMeetingId: '10000000006' });
      }
      return makeFakeResponse(500, { error: 'Unhandled ' + method + ' ' + url });
    });

    const r404Verified = await deleteZoomMeetingSeriesRemote('10000000001', { retryDelayMs: 0 });
    assert.equal(r404Verified.ok, true);
    assert.equal(r404Verified.alreadyDeleted, true);

    const r404StillExists = await deleteZoomMeetingSeriesRemote('10000000002', { retryDelayMs: 0 });
    assert.equal(r404StillExists.ok, false);
    assert.equal(r404StillExists.deleted, false);

    const r401 = await deleteZoomMeetingSeriesRemote('10000000003', { retryDelayMs: 0 });
    assert.equal(r401.ok, false);
    assert.equal(r401.authError, true);
    assert.equal(r401.deleted, false);

    const r403 = await deleteZoomMeetingSeriesRemote('10000000004', { retryDelayMs: 0 });
    assert.equal(r403.ok, false);
    assert.equal(r403.permissionError, true);
    assert.equal(r403.deleted, false);

    const r429 = await deleteZoomMeetingSeriesRemote('10000000005', { retryDelayMs: 0 });
    assert.equal(r429.ok, true);
    assert.equal(r429.deleted, true);
    assert.equal(rateLimitCount, 3);

    const r503 = await deleteZoomMeetingSeriesRemote('10000000006', { retryDelayMs: 0 });
    assert.equal(r503.ok, true);
    assert.equal(r503.deleted, true);
    assert.equal(server500Count, 2);

    passed++;
    console.log('✓ Test 2: Zoom DELETE handles no occurrence_id, GET-verified 404, 401/403 failure, 429 & 5xx retries');
  }

  // ==========================================================================
  // TEST 3: Google Calendar 6-signal matching & protecting unrelated/similar-title events
  // ==========================================================================
  {
    const groups = makeTestGroups();
    const rec = reconcileGroupWeeklySessions({ group: groups[0], existingSessions: [] });
    const session0: GroupWeeklySession = {
      ...rec.sessions[0],
      zoomMeetingId: '55500011122',
      zoomJoinUrl: 'https://zoom.us/j/55500011122',
      googleCalendarEventId: 'storedcalid001'
    };
    const detId = deriveDeterministicGoogleEventId(rec.sessions[1].id);

    const calEvents = [
      // Signal 1: stored googleCalendarEventId
      {
        id: 'storedcalid001',
        summary: 'Old B1.1 Stored ID Event',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: [],
        extractedZoomJoinUrls: []
      },
      // Signal 2: deterministic Glück event ID
      {
        id: detId,
        summary: 'Deterministic ID Event',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TH'],
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: [],
        extractedZoomJoinUrls: []
      },
      // Signal 3: privateExtendedProperties.gluckSessionId
      {
        id: 'extprop_event_03',
        summary: 'Tagged Session Event',
        conferenceJoinUrls: [],
        privateExtendedProperties: { gluckSessionId: rec.sessions[0].id },
        extractedZoomMeetingIds: [],
        extractedZoomJoinUrls: []
      },
      // Signal 4: deleted Zoom meeting ID in event
      {
        id: 'zoom_id_match_04',
        summary: 'Manual Zoom Class',
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: ['77788899900'],
        extractedZoomJoinUrls: []
      },
      // Signal 5: exact deleted Zoom join URL
      {
        id: 'zoom_url_match_05',
        summary: 'Old Link Class',
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: [],
        extractedZoomJoinUrls: ['https://zoom.us/j/66655544433?pwd=abc']
      },
      // Signal 6: historical session/history Zoom ID
      {
        id: 'hist_match_06',
        summary: 'Legacy Migration Event',
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: ['99112233445'],
        extractedZoomJoinUrls: []
      },
      // UNRELATED 1: Personal doctor appointment (NO Zoom link)
      {
        id: 'personal_dentist',
        summary: 'Dentist Appointment',
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: [],
        extractedZoomJoinUrls: []
      },
      // UNRELATED 2: Same title as a Glück group, same day/time, NO Zoom/Glück signal -> MUST NOT DELETE!
      {
        id: 'school_same_title',
        summary: session0.standardizedTitle,
        startDateTime: '2026-12-07T18:00:00+02:00',
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: [],
        extractedZoomJoinUrls: []
      },
      // UNRELATED 3: External Zoom meeting from another host (not in deleted set or Glück history) -> untouched & ambiguous
      {
        id: 'external_other_host_zoom',
        summary: 'University Webinar',
        conferenceJoinUrls: [],
        privateExtendedProperties: {},
        extractedZoomMeetingIds: ['44433322211'],
        extractedZoomJoinUrls: ['https://zoom.us/j/44433322211']
      }
    ];

    const summary = matchGoogleCalendarEventsToZoomCleanup({
      calendarEvents: calEvents,
      targetZoomMeetingIds: new Set(['77788899900']),
      targetZoomJoinUrls: new Set(['https://zoom.us/j/66655544433?pwd=abc']),
      sessions: [session0, rec.sessions[1]],
      historicalZoomMeetingIds: new Set(['99112233445']),
      historicalZoomJoinUrls: new Set([]),
      storedCalendarEventIds: new Set(['storedcalid001'])
    });

    const deletedIds = summary.matchedToDelete.map((m) => m.eventId).sort();
    assert.deepEqual(
      deletedIds,
      ['extprop_event_03', 'hist_match_06', 'storedcalid001', 'zoom_id_match_04', 'zoom_url_match_05', detId].sort()
    );
    assert.equal(summary.untouchedEventsCount, 3);
    assert.equal(summary.ambiguousEvents.length, 1);
    assert.equal(summary.ambiguousEvents[0].eventId, 'external_other_host_zoom');
    assert.equal(deletedIds.includes('personal_dentist'), false);
    assert.equal(deletedIds.includes('school_same_title'), false);
    passed++;
    console.log('✓ Test 3: Google Calendar 6-signal confident matching & unrelated/similar-title protection');
  }

  // ==========================================================================
  // TEST 4: Google Calendar DELETE 401 renewal, 403 failure, and GET-verified 404/410
  // ==========================================================================
  {
    __resetCalendarOAuthStateForTesting();
    let renewed = false;
    __setCalendarFetchForTesting(async (url, init) => {
      const u = String(url);
      const method = (init?.method || 'GET').toUpperCase();
      const authHeader = (init?.headers as Record<string, string>)?.Authorization || '';
      if (u.includes('/events/evt_401') && method === 'DELETE') {
        if (authHeader === 'Bearer expired_tok') return makeFakeResponse(401, { error: 'Expired' });
        if (authHeader === 'Bearer fresh_tok') return makeFakeResponse(204, '');
      }
      if (u.includes('/events/evt_403') && method === 'DELETE') {
        return makeFakeResponse(403, { error: 'Forbidden' });
      }
      if (u.includes('/events/evt_410') && method === 'DELETE') {
        return makeFakeResponse(410, { error: 'Gone' });
      }
      if (u.includes('/events/evt_410') && method === 'GET') {
        return makeFakeResponse(200, { id: 'evt_410', status: 'cancelled' });
      }
      return makeFakeResponse(500, {});
    });

    const d401 = await deleteGoogleCalendarEventForCleanup({
      eventId: 'evt_401',
      accessToken: 'expired_tok',
      retryDelayMs: 0,
      onAuthExpiredRenew: async () => {
        renewed = true;
        return 'fresh_tok';
      }
    });
    assert.equal(renewed, true);
    assert.equal(d401.ok, true);
    assert.equal(d401.deleted, true);

    const d403 = await deleteGoogleCalendarEventForCleanup({
      eventId: 'evt_403',
      accessToken: 'fresh_tok',
      retryDelayMs: 0
    });
    assert.equal(d403.ok, false);
    assert.equal(d403.permissionDenied, true);

    const d410 = await deleteGoogleCalendarEventForCleanup({
      eventId: 'evt_410',
      accessToken: 'fresh_tok',
      retryDelayMs: 0
    });
    assert.equal(d410.ok, true);
    assert.equal(d410.alreadyDeleted, true);
    passed++;
    console.log('✓ Test 4: Google Calendar DELETE handles 401 token renewal, 403 failure, and GET-verified 404/410');
  }

  // ==========================================================================
  // TEST 5: Full End-to-End Clean & Rebuild + Exact Durations + Final Verification + Zero Secrets
  // ==========================================================================
  {
    __resetZoomServiceMemoryForTesting();
    __resetCalendarOAuthStateForTesting();
    __resetCleanupRebuildMemoryForTesting();
    const store = createPersistentTestStore();
    __setCleanupStorageAdapterForTesting(store.adapter);
    saveZoomUiMeta({ connected: true, hasCredentials: true, isBasicPlan: true, planType: 'basic', hostEmail: 'host@glueck.de' });

    const groups = makeTestGroups();
    const zoomState = new Map<string, MockZoomMeeting>([
      [
        '99112233445',
        { id: '99112233445', topic: 'Old Glück B1.1', type: 8, join_url: 'https://us05web.zoom.us/j/99112233445' }
      ],
      [
        '88001122334',
        { id: '88001122334', topic: 'Manual Coffee Chat', type: 2, join_url: 'https://zoom.us/j/88001122334' }
      ],
      [
        '88009988776',
        { id: '88009988776', topic: 'Other App Recurring', type: 8, join_url: 'https://zoom.us/j/88009988776' }
      ]
    ]);

    const calState = new Map<string, MockCalendarEvent>([
      [
        'old_cal_gluck_series',
        {
          id: 'old_cal_gluck_series',
          summary: 'Old B1.1 Series',
          location: 'https://us05web.zoom.us/j/99112233445',
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
          extendedProperties: { private: { gluckSessionId: 'legacy_sess' } }
        }
      ],
      [
        'old_cal_manual_zoom',
        {
          id: 'old_cal_manual_zoom',
          summary: 'Coffee Chat',
          description: 'Join Zoom: https://zoom.us/j/88001122334'
        }
      ],
      [
        'unrelated_personal_birthday',
        {
          id: 'unrelated_personal_birthday',
          summary: 'Mom Birthday Dinner',
          description: 'Family restaurant downtown'
        }
      ]
    ]);

    let nextNewMeetingNum = 70000000001;
    const createdDurations: number[] = [];
    const createdPayloads: any[] = [];

    __setZoomProxyFetchForTesting(async (url, init) => {
      if (url === '/api/zoom/session') return makeFakeResponse(200, { sessionToken: 'sess_tok' });
      const method = (init?.method || 'GET').toUpperCase();
      if (url.startsWith('/api/zoom/meetings?') && method === 'GET') {
        const u = new URL(url, 'http://localhost');
        const listType = u.searchParams.get('type');
        if (listType === 'live') {
          return makeFakeResponse(200, { ok: true, meetings: [], nextPageToken: '', hostEmail: 'host@glueck.de', hostScope: 'single_connected_host' });
        }
        return makeFakeResponse(200, {
          ok: true,
          meetings: Array.from(zoomState.values()),
          nextPageToken: '',
          hostEmail: 'host@glueck.de',
          hostScope: 'single_connected_host'
        });
      }
      if (url.startsWith('/api/zoom/meetings/') && method === 'DELETE') {
        assert.equal(url.includes('occurrence_id'), false);
        const id = decodeURIComponent(url.split('/').pop()!);
        zoomState.delete(id);
        return makeFakeResponse(200, { ok: true, deleted: true, zoomMeetingId: id });
      }
      if (url === '/api/zoom/meetings/create' && method === 'POST') {
        const body = JSON.parse(String(init?.body || '{}'));
        createdPayloads.push(body);
        createdDurations.push(body.duration);
        const id = String(nextNewMeetingNum++);
        const joinUrl = `https://zoom.us/j/${id}?pwd=clean`;
        zoomState.set(id, {
          id,
          topic: body.topic,
          type: 8,
          duration: body.duration,
          timezone: body.timezone,
          join_url: joinUrl
        });
        // Include a secret start_url with zak token to verify it NEVER gets stored in snapshots/operations!
        return makeFakeResponse(200, {
          ok: true,
          zoomMeetingId: id,
          joinUrl,
          startUrl: `https://zoom.us/s/${id}?zak=SECRET_ZAK_TOKEN_999`,
          topic: body.topic,
          timezone: body.timezone,
          hostEmail: 'host@glueck.de',
          planWarning40Min: body.duration >= 41
        });
      }
      return makeFakeResponse(404, { error: 'Not found ' + url });
    });

    __setCalendarFetchForTesting(async (url, init) => {
      const u = String(url);
      const method = (init?.method || 'GET').toUpperCase();
      if (method === 'GET' && u.includes('/calendars/primary/events?')) {
        return makeFakeResponse(200, { items: Array.from(calState.values()) });
      }
      if (method === 'GET' && /\/calendars\/primary\/events\/([^/?]+)/.test(u)) {
        const eventId = decodeURIComponent(u.match(/\/events\/([^/?]+)/)![1]);
        const found = calState.get(eventId);
        return found ? makeFakeResponse(200, found) : makeFakeResponse(404, { error: 'Not found' });
      }
      if (method === 'DELETE' && /\/calendars\/primary\/events\/([^/?]+)/.test(u)) {
        const eventId = decodeURIComponent(u.match(/\/events\/([^/?]+)/)![1]);
        calState.delete(eventId);
        return makeFakeResponse(204, '');
      }
      if (method === 'POST' && u.endsWith('/calendars/primary/events')) {
        const body = JSON.parse(String(init?.body || '{}'));
        assert.equal('iCalUID' in body, false, 'NEVER send custom iCalUID on events.insert');
        const evt: MockCalendarEvent = { ...body, iCalUID: `${body.id}@google.com` };
        calState.set(evt.id, evt);
        return makeFakeResponse(200, evt);
      }
      if (method === 'PATCH' && /\/calendars\/primary\/events\/([^/?]+)/.test(u)) {
        const eventId = decodeURIComponent(u.match(/\/events\/([^/?]+)/)![1]);
        const body = JSON.parse(String(init?.body || '{}'));
        const evt: MockCalendarEvent = { ...body, id: eventId, iCalUID: `${eventId}@google.com` };
        calState.set(eventId, evt);
        return makeFakeResponse(200, evt);
      }
      return makeFakeResponse(500, {});
    });

    // Step 1: Preview (read-only)
    const prevRes = await previewZoomCalendarCleanupRebuild({
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      timezone: 'Africa/Cairo',
      calendarAccessToken: 'cal_secret_token_do_not_store',
      retryDelayMs: 0
    });
    assert.equal(prevRes.ok, true);
    assert.equal(prevRes.preview!.totalScheduledZoomMeetingsFound, 3);
    assert.equal(prevRes.preview!.zoomMeetingsToDeleteCount, 3);
    assert.equal(prevRes.preview!.activeGluckOnlineSessionsCount, 3, '2 sessions in B1.1 + 1 in A2.2; offline & archived excluded');
    assert.equal(prevRes.preview!.calendarEventsToDeleteCount, 2);
    assert.equal(prevRes.preview!.calendarEventsUntouchedCount, 1);
    assert.equal(zoomState.size, 3, 'Preview must NOT delete anything');

    // Step 2: Execute Clean & Rebuild
    const execRes = await executeZoomCalendarCleanupRebuild({
      mode: 'start',
      preview: prevRes.preview!,
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      includeGoogleCalendar: true,
      calendarAccessToken: 'cal_secret_token_do_not_store',
      pacingDelayMs: 0,
      retryDelayMs: 0
    });

    assert.equal(
      execRes.ok,
      true,
      `Expected ok=true, got state=${execRes.operation.state}, problems=${JSON.stringify(execRes.operation.report.remainingProblems)}`
    );
    assert.equal(execRes.operation.state, 'completed');
    assert.equal(execRes.operation.report.zoomMeetingsFoundBeforeCleanup, 3);
    assert.equal(execRes.operation.report.zoomMeetingsDeleted, 3);
    assert.equal(execRes.operation.report.zoomMeetingsSkippedOrFailed, 0);
    assert.equal(execRes.operation.report.calendarEventsDeleted, 2);
    assert.equal(execRes.operation.report.calendarEventsUntouched, 1);
    assert.equal(execRes.operation.report.newGluckZoomMeetingsCreated, 3);
    assert.equal(execRes.operation.report.calendarEventsRecreatedOrUpdated, 3);
    assert.equal(execRes.operation.report.failedItemsCount, 0);
    assert.equal(execRes.operation.report.verificationPassed, true);

    // Exact configured durations preserved (90, 90, 120) — NOT truncated to 40!
    assert.deepEqual([...createdDurations].sort((a, b) => a - b), [90, 90, 120]);
    assert.ok(createdPayloads.every((p) => p.timezone === 'Africa/Cairo'));

    // Zoom now has ONLY the 3 new Glück meetings
    assert.equal(zoomState.size, 3);
    assert.equal(zoomState.has('99112233445'), false);
    assert.equal(zoomState.has('88001122334'), false);
    assert.equal(zoomState.has('88009988776'), false);

    // Unrelated personal Calendar event is strictly untouched; 3 new Calendar events exist
    assert.equal(calState.has('unrelated_personal_birthday'), true);
    assert.equal(calState.has('old_cal_gluck_series'), false);
    assert.equal(calState.has('old_cal_manual_zoom'), false);
    assert.equal(calState.size, 4);

    // Recovery snapshot persisted & ZERO secrets in snapshot, operation record, or stored sessions
    const snapshots = await loadCleanupRecoverySnapshots();
    assert.equal(snapshots.length, 1);
    const serializedAll = JSON.stringify({
      snapshot: snapshots[0],
      operation: store.map.get(CLEANUP_REBUILD_OPERATION_STORAGE_KEY),
      sessions: execRes.sessions,
      records: execRes.records,
      history: execRes.history
    });
    assert.equal(serializedAll.includes('SECRET_ZAK_TOKEN_999'), false, 'ZAK token must NEVER be persisted');
    assert.equal(serializedAll.includes('cal_secret_token_do_not_store'), false, 'Calendar OAuth token must NEVER be persisted');
    assert.equal(serializedAll.includes('startUrl'), false, 'startUrl must NEVER be persisted');
    passed++;
    console.log('✓ Test 5: Full Clean & Rebuild, exact durations, unrelated Calendar preserved, final verification & zero secrets');
  }

  // ==========================================================================
  // TEST 6: Live meeting skipped & refuses to mark cleanup complete while old meeting remains
  // ==========================================================================
  {
    __resetZoomServiceMemoryForTesting();
    __resetCleanupRebuildMemoryForTesting();
    const store = createPersistentTestStore();
    __setCleanupStorageAdapterForTesting(store.adapter);

    const zoomState = new Map<string, MockZoomMeeting>([
      ['33300011101', { id: '33300011101', topic: 'Old Scheduled', type: 2, join_url: 'https://zoom.us/j/33300011101' }],
      ['33300011102', { id: '33300011102', topic: 'Currently Live Class', type: 8, join_url: 'https://zoom.us/j/33300011102', status: 'started', isLive: true }]
    ]);
    const deletedZoomIds: string[] = [];

    __setZoomProxyFetchForTesting(async (url, init) => {
      if (url === '/api/zoom/session') return makeFakeResponse(200, { sessionToken: 'sess_tok' });
      const method = (init?.method || 'GET').toUpperCase();
      if (url.startsWith('/api/zoom/meetings?') && method === 'GET') {
        const u = new URL(url, 'http://localhost');
        if (u.searchParams.get('type') === 'live') {
          return makeFakeResponse(200, {
            ok: true,
            meetings: [zoomState.get('33300011102')],
            nextPageToken: '',
            hostScope: 'single_connected_host'
          });
        }
        return makeFakeResponse(200, {
          ok: true,
          meetings: Array.from(zoomState.values()),
          nextPageToken: '',
          hostScope: 'single_connected_host'
        });
      }
      if (url.startsWith('/api/zoom/meetings/') && method === 'DELETE') {
        const id = decodeURIComponent(url.split('/').pop()!);
        deletedZoomIds.push(id);
        zoomState.delete(id);
        return makeFakeResponse(200, { ok: true, deleted: true, zoomMeetingId: id });
      }
      return makeFakeResponse(404, {});
    });

    const groups = makeTestGroups();
    const prev = await previewZoomCalendarCleanupRebuild({
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      calendarAccessToken: null,
      retryDelayMs: 0
    });
    assert.equal(prev.ok, true);
    assert.equal(prev.preview!.liveMeetingsBlockedCount, 1);
    assert.equal(prev.preview!.zoomMeetingsToDeleteCount, 1);

    const exec = await executeZoomCalendarCleanupRebuild({
      mode: 'start',
      preview: prev.preview!,
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      includeGoogleCalendar: false,
      pacingDelayMs: 0,
      retryDelayMs: 0
    });

    assert.equal(deletedZoomIds.includes('33300011102'), false, 'Live meeting MUST NOT be deleted');
    assert.equal(deletedZoomIds.includes('33300011101'), true);
    assert.equal(exec.ok, false);
    assert.notEqual(exec.operation.state, 'completed', 'Must REFUSE to mark completed while live/old meeting remains');
    assert.equal(exec.operation.state, 'completed_with_errors');
    assert.equal(exec.operation.obsoleteReferencesCleared, false, 'Must NOT clear obsolete refs before old meetings verified empty');
    assert.equal(exec.operation.report.verificationPassed, false);
    passed++;
    console.log('✓ Test 6: Skips live meetings & refuses to mark complete while an old meeting remains');
  }

  // ==========================================================================
  // TEST 7: Recovery after simulated process death mid-deletion AND mid-rebuild (zero duplicates)
  // ==========================================================================
  {
    __resetZoomServiceMemoryForTesting();
    __resetCleanupRebuildMemoryForTesting();
    const store = createPersistentTestStore();
    __setCleanupStorageAdapterForTesting(store.adapter);

    const groups = makeTestGroups(); // 3 active online sessions
    const zoomState = new Map<string, MockZoomMeeting>([
      ['50000000001', { id: '50000000001', topic: 'Old 1', type: 2, join_url: 'https://zoom.us/j/50000000001' }],
      ['50000000002', { id: '50000000002', topic: 'Old 2', type: 2, join_url: 'https://zoom.us/j/50000000002' }]
    ]);
    let deleteCount = 0;
    let createCount = 0;
    let nextId = 80000000001;

    __setZoomProxyFetchForTesting(async (url, init) => {
      if (url === '/api/zoom/session') return makeFakeResponse(200, { sessionToken: 'sess_tok' });
      const method = (init?.method || 'GET').toUpperCase();
      if (url.startsWith('/api/zoom/meetings?') && method === 'GET') {
        const u = new URL(url, 'http://localhost');
        if (u.searchParams.get('type') === 'live') return makeFakeResponse(200, { ok: true, meetings: [], nextPageToken: '', hostScope: 'single_connected_host' });
        return makeFakeResponse(200, { ok: true, meetings: Array.from(zoomState.values()), nextPageToken: '', hostScope: 'single_connected_host' });
      }
      if (url.startsWith('/api/zoom/meetings/') && method === 'DELETE') {
        deleteCount++;
        const id = decodeURIComponent(url.split('/').pop()!);
        zoomState.delete(id);
        return makeFakeResponse(200, { ok: true, deleted: true, zoomMeetingId: id });
      }
      if (url === '/api/zoom/meetings/create' && method === 'POST') {
        createCount++;
        const body = JSON.parse(String(init?.body || '{}'));
        const id = String(nextId++);
        const joinUrl = `https://zoom.us/j/${id}`;
        zoomState.set(id, { id, topic: body.topic, type: 8, join_url: joinUrl });
        return makeFakeResponse(200, { ok: true, zoomMeetingId: id, joinUrl, topic: body.topic, timezone: body.timezone });
      }
      return makeFakeResponse(404, {});
    });

    const prev = await previewZoomCalendarCleanupRebuild({
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      calendarAccessToken: null,
      retryDelayMs: 0
    });

    // Run 1: Pause right after 1st deletion (simulating interruption mid-deletion)
    let latestSessions: GroupWeeklySession[] = [];
    let latestRecords: ZoomMeetingRecord[] = [];
    let latestHistory: ZoomMeetingHistory[] = [];
    const run1 = await executeZoomCalendarCleanupRebuild({
      mode: 'start',
      preview: prev.preview!,
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      includeGoogleCalendar: false,
      shouldPause: () => deleteCount >= 1,
      onWorkspaceUpdate: (snap) => {
        latestSessions = snap.sessions;
        latestRecords = snap.records;
        latestHistory = snap.history;
      },
      pacingDelayMs: 0,
      retryDelayMs: 0
    });
    assert.equal(run1.operation.state, 'paused');
    assert.equal(deleteCount, 1);

    // Simulate full app process death (clears all in-memory state!)
    __simulateCleanupProcessDeathForTesting();
    const reloadedMidDelete = await loadCleanupRebuildOperation();
    assert.ok(reloadedMidDelete);
    assert.equal(reloadedMidDelete!.state, 'paused');

    // Run 2: Resume and pause right after 1st Zoom creation (simulating crash mid-rebuild)
    const run2 = await executeZoomCalendarCleanupRebuild({
      mode: 'resume',
      groups,
      existingSessions: latestSessions,
      existingRecords: latestRecords,
      existingHistory: latestHistory,
      shouldPause: () => createCount >= 1,
      onWorkspaceUpdate: (snap) => {
        latestSessions = snap.sessions;
        latestRecords = snap.records;
        latestHistory = snap.history;
      },
      pacingDelayMs: 0,
      retryDelayMs: 0
    });
    assert.equal(run2.operation.state, 'paused');
    assert.equal(deleteCount, 2, 'Should delete only the remaining 2nd old meeting');
    assert.equal(createCount, 1);

    // Simulate second process death mid-rebuild!
    __simulateCleanupProcessDeathForTesting();

    // Run 3: Resume to completion
    const run3 = await executeZoomCalendarCleanupRebuild({
      mode: 'resume',
      groups,
      existingSessions: latestSessions,
      existingRecords: latestRecords,
      existingHistory: latestHistory,
      onWorkspaceUpdate: (snap) => {
        latestSessions = snap.sessions;
        latestRecords = snap.records;
        latestHistory = snap.history;
      },
      pacingDelayMs: 0,
      retryDelayMs: 0
    });

    assert.equal(run3.ok, true);
    assert.equal(run3.operation.state, 'completed');
    assert.equal(deleteCount, 2);
    assert.equal(createCount, 3, 'MUST create exactly 3 meetings total across crashes — ZERO duplicates!');
    assert.equal(zoomState.size, 3);
    assert.equal(run3.operation.report.verificationPassed, true);
    passed++;
    console.log('✓ Test 7: Resumable recovery after simulated process death mid-delete & mid-rebuild (zero duplicates)');
  }

  // ==========================================================================
  // TEST 8: Partial Zoom success + Calendar failure -> Calendar-only retry (keeps Zoom) + Zoom failure skips Calendar
  // ==========================================================================
  {
    __resetZoomServiceMemoryForTesting();
    __resetCalendarOAuthStateForTesting();
    __resetCleanupRebuildMemoryForTesting();
    const store = createPersistentTestStore();
    __setCleanupStorageAdapterForTesting(store.adapter);

    const groups = makeTestGroups(); // 3 active online sessions
    const zoomState = new Map<string, MockZoomMeeting>();
    const calState = new Map<string, MockCalendarEvent>([
      ['keep_personal_1', { id: 'keep_personal_1', summary: 'Personal Event' }]
    ]);

    let zoomCreateCalls = 0;
    let failSecondZoomCreate = true;
    let failCalendarInsert = true;
    const calendarInsertAttemptedSessionIds: string[] = [];

    __setZoomProxyFetchForTesting(async (url, init) => {
      if (url === '/api/zoom/session') return makeFakeResponse(200, { sessionToken: 'sess_tok' });
      const method = (init?.method || 'GET').toUpperCase();
      if (url.startsWith('/api/zoom/meetings?') && method === 'GET') {
        const u = new URL(url, 'http://localhost');
        if (u.searchParams.get('type') === 'live') return makeFakeResponse(200, { ok: true, meetings: [], nextPageToken: '', hostScope: 'single_connected_host' });
        return makeFakeResponse(200, { ok: true, meetings: Array.from(zoomState.values()), nextPageToken: '', hostScope: 'single_connected_host' });
      }
      if (url === '/api/zoom/meetings/create' && method === 'POST') {
        zoomCreateCalls++;
        const body = JSON.parse(String(init?.body || '{}'));
        if (failSecondZoomCreate && zoomCreateCalls === 2) {
          return makeFakeResponse(500, { error: 'Temporary Zoom outage on session 2' });
        }
        const id = String(90000000000 + zoomCreateCalls);
        const joinUrl = `https://zoom.us/j/${id}`;
        zoomState.set(id, { id, topic: body.topic, type: 8, join_url: joinUrl });
        return makeFakeResponse(200, { ok: true, zoomMeetingId: id, joinUrl, topic: body.topic, timezone: body.timezone });
      }
      return makeFakeResponse(404, {});
    });

    __setCalendarFetchForTesting(async (url, init) => {
      const u = String(url);
      const method = (init?.method || 'GET').toUpperCase();
      if (method === 'GET' && u.includes('/calendars/primary/events?')) {
        return makeFakeResponse(200, { items: Array.from(calState.values()) });
      }
      if (method === 'GET' && /\/calendars\/primary\/events\/([^/?]+)/.test(u)) {
        const eventId = decodeURIComponent(u.match(/\/events\/([^/?]+)/)![1]);
        const found = calState.get(eventId);
        return found ? makeFakeResponse(200, found) : makeFakeResponse(404, { error: 'Not found' });
      }
      if (method === 'POST' && u.endsWith('/calendars/primary/events')) {
        const body = JSON.parse(String(init?.body || '{}'));
        const sid = body.extendedProperties?.private?.gluckSessionId;
        if (sid) calendarInsertAttemptedSessionIds.push(sid);
        if (failCalendarInsert) {
          return makeFakeResponse(500, { error: 'Temporary Google Calendar failure' });
        }
        const evt: MockCalendarEvent = { ...body, iCalUID: `${body.id}@google.com` };
        calState.set(evt.id, evt);
        return makeFakeResponse(200, evt);
      }
      return makeFakeResponse(404, {});
    });

    const prev = await previewZoomCalendarCleanupRebuild({
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      calendarAccessToken: 'tok_cal_ok',
      retryDelayMs: 0
    });

    const firstRun = await executeZoomCalendarCleanupRebuild({
      mode: 'start',
      preview: prev.preview!,
      groups,
      existingSessions: [],
      existingRecords: [],
      existingHistory: [],
      includeGoogleCalendar: true,
      calendarAccessToken: 'tok_cal_ok',
      pacingDelayMs: 0,
      retryDelayMs: 0
    });

    assert.equal(firstRun.ok, false);
    assert.equal(firstRun.operation.state, 'completed_with_errors');
    assert.equal(firstRun.operation.report.newGluckZoomMeetingsCreated, 2, '2 Zoom succeeded, 1 failed');
    assert.equal(firstRun.operation.report.calendarEventsRecreatedOrUpdated, 0, 'All Calendar inserts failed');

    // Verify failed Zoom session was NEVER sent to Google Calendar!
    const failedZoomSession = firstRun.operation.rebuilds.find((r) => r.zoomStatus === 'failed')!;
    assert.equal(failedZoomSession.calendarStatus, 'skipped_zoom_failed');
    assert.equal(
      calendarInsertAttemptedSessionIds.includes(failedZoomSession.sessionId),
      false,
      'Must NEVER create Calendar event when Zoom creation failed'
    );

    const firstSucceededZoomIds = firstRun.operation.rebuilds
      .filter((r) => r.zoomStatus === 'succeeded')
      .map((r) => r.newZoomMeetingId);
    assert.equal(firstSucceededZoomIds.length, 2);

    // Now heal failures and run Retry Failed Operations
    failSecondZoomCreate = false;
    failCalendarInsert = false;
    const retryRun = await executeZoomCalendarCleanupRebuild({
      mode: 'retry_failed',
      groups,
      existingSessions: firstRun.sessions,
      existingRecords: firstRun.records,
      existingHistory: firstRun.history,
      calendarAccessToken: 'tok_cal_ok',
      pacingDelayMs: 0,
      retryDelayMs: 0
    });

    assert.equal(retryRun.ok, true);
    assert.equal(retryRun.operation.state, 'completed');
    assert.equal(retryRun.operation.report.verificationPassed, true);
    assert.equal(zoomCreateCalls, 4, '3 initial calls (1 failed) + 1 retry for failed session ONLY (zero duplicates for the 2 already-succeeded Zoom meetings!)');
    assert.equal(zoomState.size, 3);
    // The 2 originally created Zoom meetings were KEPT unchanged!
    for (const keptId of firstSucceededZoomIds) {
      assert.equal(zoomState.has(keptId!), true, `Previously created Zoom meeting ${keptId} must be kept`);
    }
    assert.equal(calState.has('keep_personal_1'), true);
    assert.equal(calState.size, 4);
    passed++;
    console.log('✓ Test 8: Partial Zoom success + Calendar failure -> Retry Failed keeps Zoom meetings, skips Calendar on Zoom fail, passes verification');
  }

  // Cleanup test hooks
  __setZoomProxyFetchForTesting(null);
  __setCalendarFetchForTesting(null);
  __setCleanupStorageAdapterForTesting(null);

  console.log(`\nALL ${passed} ZOOM & GOOGLE CALENDAR CLEANUP/REBUILD TESTS PASSED!`);
}

runTests().catch((err) => {
  console.error('CLEANUP & REBUILD TEST FAILED:', err);
  process.exit(1);
});
