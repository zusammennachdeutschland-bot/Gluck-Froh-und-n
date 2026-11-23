import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import expressApp from '../api/expressApp';
import {
  DEFAULT_ZOOM_TIMEZONE,
  isApprovedSyncedZoomSession,
  parseIsoDateWeekday,
  reconcileGroupWeeklySessions,
  resolveActiveZoomLinkForLesson,
  resolveCanonicalZoomLinkStatus
} from '../services/zoomSessionStandardizer';
import {
  __resetZoomServerVaultForTesting,
  __setZoomServerUpstreamFetchForTesting
} from '../server/zoomServerProxy';
import {
  __resetZoomServiceMemoryForTesting,
  __setZoomProxyFetchForTesting,
  buildZoomMigrationPreview,
  connectZoomAccount,
  createOrReplaceZoomMeetingForSession,
  executeBulkZoomMigration,
  linkVerifiedZoomMeetingToSession,
  loadGroupWeeklySessions,
  persistZoomWorkspaceDurably,
  syncOrRecoverZoomSession,
  updateZoomMeetingForSession
} from '../services/zoomService';
import {
  __clearMemoryStoreOnlyForTests,
  __setSimulatePrimaryDbForTests,
  __setStorageFailureHookForTests
} from '../services/storageService';
import { mergeEntities } from '../services/sync/mergeEngine';
import { getProjectedLessonsForRange } from '../utils/scheduleUtils';
import { sanitizeInitialData, ZOOM_STORAGE_KEYS } from '../services/dataSanitizer';
import {
  diagnoseZoomReminderResolution,
  shouldShowZoomSyncWarning
} from '../utils/zoomReminderDiagnostics';
import { Group, GroupWeeklySession, Lesson } from '../types';

async function runZoomReminderSyncRegressionTests() {
  console.log('=== Zoom Sync -> Lesson Reminder Alert Regression Tests ===');

  __resetZoomServerVaultForTesting();
  __resetZoomServiceMemoryForTesting();

  let zoomCounter = 9700100100;
  let forceCreateFail = false;

  __setZoomServerUpstreamFetchForTesting(async (url, init) => {
    const jsonResp = (status: number, obj: any) => new Response(JSON.stringify(obj), { status });
    if (url.startsWith('https://zoom.us/oauth/token')) {
      return jsonResp(200, {
        access_token: 'zoom_test_token_regression',
        token_type: 'bearer',
        expires_in: 3600
      });
    }
    if (url === 'https://api.zoom.us/v2/users/me') {
      return jsonResp(200, { id: 'zoom_host_1', email: 'teacher@glueck.app', type: 2 });
    }
    if (url === 'https://api.zoom.us/v2/users/me/meetings' && init?.method === 'POST') {
      if (forceCreateFail) {
        return jsonResp(500, { message: 'Simulated Zoom outage' });
      }
      zoomCounter += 1;
      const parsed = JSON.parse(String(init.body || '{}'));
      return jsonResp(201, {
        id: zoomCounter,
        topic: parsed.topic,
        join_url: `https://zoom.us/j/${zoomCounter}?pwd=PASS${zoomCounter}`,
        start_url: `https://zoom.us/s/${zoomCounter}?zak=SECRET_ZAK`,
        password: `PASS${zoomCounter}`,
        host_email: 'teacher@glueck.app',
        timezone: parsed.timezone || DEFAULT_ZOOM_TIMEZONE
      });
    }
    if (url.startsWith('https://api.zoom.us/v2/meetings/') && init?.method === 'PATCH') {
      return new Response(null, { status: 204 });
    }
    return jsonResp(404, { message: 'Not found' });
  });

  const server = expressApp.listen(0);
  try {
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    __setZoomProxyFetchForTesting(async (reqPath, init) => {
      const r = await fetch(`${baseUrl}${reqPath}`, init);
      return { ok: r.ok, status: r.status, json: () => r.json(), headers: r.headers };
    });

    const connectRes = await connectZoomAccount({
      accountId: 'acc_regression_1234',
      clientId: 'cli_regression_1234',
      clientSecret: 'sec_regression_1234',
      defaultTimezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(connectRes.ok, true);

    const group: Group = {
      id: 'grp_zoom_reminder_fix',
      name: '  Grade 9   B1  ',
      type: 'online',
      grade: 'Grade 9',
      monthlyPackagePrice: 1200,
      sessionCount: 4,
      color: '#6366f1',
      lessonDurationMinutes: 60,
      schedules: [{ day: 'Monday', time: '19:00' }],
      zoomLink: 'https://zoom.us/j/11111111111?pwd=LEGACY_GROUP_LINK',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      updatedAt: Date.now()
    };

    // 1. Reconcile creates a pending session, then Zoom Manager creates/syncs it
    const initialRec = reconcileGroupWeeklySessions({
      group,
      existingSessions: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(initialRec.sessions.length, 1);
    const pendingSession = initialRec.sessions[0];
    assert.equal(pendingSession.syncState, 'pending');

    // Also test upsert safety when the reconciled session wasn't yet in raw stored array (single-row sync path)
    const createRes = await createOrReplaceZoomMeetingForSession({
      session: pendingSession,
      sessions: [],
      records: [],
      history: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(createRes.ok, true);
    assert.equal(createRes.sessions.length, 1, 'Create must upsert the synced session instead of dropping it');
    const syncedSession = createRes.updatedSession!;
    assert.equal(syncedSession.syncState, 'synced');
    assert.equal(syncedSession.meetingSource, 'zoom_api');
    assert.ok(syncedSession.lastSyncedAt, 'Successful sync must save lastSyncedAt');
    const createdUrl = syncedSession.zoomJoinUrl!;
    assert.ok(createdUrl.startsWith('https://zoom.us/j/'));

    // Exact match lesson -> resolved, alert hidden
    const exactLesson: Partial<Lesson> = {
      id: 'lsn_exact',
      groupId: group.id,
      date: '2026-11-16', // Monday
      time: '19:00',
      type: 'online',
      meetingLink: 'https://zoom.us/j/22222222222?pwd=STALE_LESSON_LINK'
    };
    const exactResolved = resolveActiveZoomLinkForLesson({
      group,
      lesson: exactLesson,
      groupWeeklySessions: createRes.sessions
    });
    assert.equal(exactResolved, createdUrl);
    assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: exactResolved }), false);
    const exactDiag = diagnoseZoomReminderResolution({
      targetGroup: group,
      lesson: exactLesson,
      effectiveLesson: exactLesson,
      groupWeeklySessions: createRes.sessions
    });
    assert.equal(exactDiag.reasonCode, 'RESOLVED_EXACT_SLOT');
    assert.equal(exactDiag.normalizedWeekday, 1, 'ISO date must parse weekday cleanly in diagnostics');

    // Update existing Zoom meeting via PATCH -> syncState stays 'synced', new lastSyncedAt, link resolves
    const updateRes = await updateZoomMeetingForSession({
      session: syncedSession,
      sessions: createRes.sessions,
      records: createRes.records,
      history: createRes.history,
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(updateRes.ok, true);
    assert.equal(updateRes.updatedSession?.syncState, 'synced');
    assert.equal(updateRes.updatedSession?.meetingSource, 'zoom_api');
    assert.ok(updateRes.updatedSession?.lastSyncedAt);

    // 2. Lesson whose date & time differ from weekly slot (plus non-ISO / Arabic dates & missing time)
    const shiftedDateAndTimeLesson: Partial<Lesson> = {
      id: 'lsn_shifted',
      groupId: group.id,
      date: '2026-11-20', // Friday (different day)
      time: '21:15', // different time
      type: 'online'
    };
    const shiftedResolved = resolveActiveZoomLinkForLesson({
      group,
      lesson: shiftedDateAndTimeLesson,
      groupWeeklySessions: updateRes.sessions
    });
    assert.equal(shiftedResolved, createdUrl, 'Shifted date/time lesson must still resolve active synced group link');
    assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: shiftedResolved }), false);
    const shiftedDiag = diagnoseZoomReminderResolution({
      targetGroup: group,
      lesson: shiftedDateAndTimeLesson,
      effectiveLesson: shiftedDateAndTimeLesson,
      groupWeeklySessions: updateRes.sessions
    });
    assert.equal(shiftedDiag.reasonCode, 'RESOLVED_GROUP_WIDE_FALLBACK');

    // Non-ISO DD/MM/YYYY, ISO timestamp, Arabic numerals, and missing date/time dimensions
    assert.equal(parseIsoDateWeekday('20/11/2026'), 5);
    assert.equal(parseIsoDateWeekday('2026-11-20T18:30:00.000Z'), 5);
    assert.equal(parseIsoDateWeekday('١٦/١١/٢٠٢٦'), 1);

    for (const variantLesson of [
      { id: 'lsn_dm', groupId: group.id, date: '20/11/2026', time: '20:00', type: 'online' as const },
      { id: 'lsn_ts', groupId: group.id, date: '2026-11-20T18:30:00.000Z', time: '', type: 'online' as const },
      { id: 'lsn_ar', groupId: group.id, date: '٢٠/١١/٢٠٢٦', time: '14:00', type: 'online' as const },
      { id: 'lsn_notime', groupId: group.id, date: '', time: '', type: 'online' as const }
    ]) {
      const link = resolveActiveZoomLinkForLesson({
        group: { ...group, schedules: [], scheduleDays: [] },
        lesson: variantLesson,
        groupWeeklySessions: updateRes.sessions
      });
      assert.equal(link, createdUrl, `Variant lesson ${variantLesson.id} must resolve active synced group link`);
      assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: link }), false);
    }

    // Same-weekday priority when group has two different synced links for two days
    const multiDaySessions: GroupWeeklySession[] = [
      {
        ...updateRes.updatedSession!,
        id: 'gws_mon_slot',
        weekday: 1,
        startTime: '18:00',
        zoomMeetingId: '98000000001',
        zoomJoinUrl: 'https://zoom.us/j/98000000001',
        updatedAt: 1000
      },
      {
        ...updateRes.updatedSession!,
        id: 'gws_thu_slot',
        weekday: 4,
        startTime: '17:30',
        zoomMeetingId: '98000000002',
        zoomJoinUrl: 'https://zoom.us/j/98000000002',
        updatedAt: 2000
      }
    ];
    const shiftedMonLink = resolveActiveZoomLinkForLesson({
      groupId: group.id,
      lesson: { id: 'lsn_mon_shifted', groupId: group.id, date: '2026-11-16', time: '20:00', type: 'online' },
      groupWeeklySessions: multiDaySessions
    });
    assert.equal(shiftedMonLink, 'https://zoom.us/j/98000000001', 'Same weekday must win over newer updatedAt of another day');

    // 3. Reload / Persistence + reconcileGroupWeeklySessions preservation
    const appTsxSource = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    assert.ok(
      appTsxSource.includes('ZOOM_STORAGE_KEYS') ||
        ZOOM_STORAGE_KEYS.every((k) => appTsxSource.includes(k)),
      'App.tsx runDataLoader must load all ZOOM_STORAGE_KEYS on startup/reload'
    );

    const sanitizedReload = sanitizeInitialData({
      glueck_group_weekly_sessions_v1: JSON.parse(JSON.stringify(updateRes.sessions)),
      glueck_zoom_meeting_records_v1: JSON.parse(JSON.stringify(updateRes.records)),
      glueck_zoom_meeting_history_v1: JSON.parse(JSON.stringify(updateRes.history))
    });
    const reloadedSessions = sanitizedReload['glueck_group_weekly_sessions_v1'] as GroupWeeklySession[];
    assert.equal(reloadedSessions.length, 1);
    assert.equal(reloadedSessions[0].syncState, 'synced');
    assert.equal(reloadedSessions[0].lastSyncedAt, updateRes.updatedSession?.lastSyncedAt);

    // Strip optional fields / use non-padded startTime to verify reconciliation does not falsely mark needs_update
    const reloadedWithMissingOptional: GroupWeeklySession = {
      ...reloadedSessions[0],
      startTime: '19:00',
      recurrence: undefined as any,
      durationMinutes: undefined as any,
      groupNameSnapshot: 'Grade 9 B1'
    };
    const recAfterReload = reconcileGroupWeeklySessions({
      group,
      existingSessions: [reloadedWithMissingOptional],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(recAfterReload.sessions.length, 1);
    assert.equal(recAfterReload.sessions[0].syncState, 'synced', 'Reconciliation must NOT revert synced -> needs_update when schedule/group is unchanged');
    assert.equal(recAfterReload.sessions[0].lastSyncedAt, updateRes.updatedSession?.lastSyncedAt);
    const postReloadResolved = resolveActiveZoomLinkForLesson({
      group,
      lesson: shiftedDateAndTimeLesson,
      groupWeeklySessions: recAfterReload.sessions
    });
    assert.equal(postReloadResolved, createdUrl);
    assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: postReloadResolved }), false);

    // Genuine group schedule change MUST still mark needs_update and re-show alert until re-synced
    const recAfterRealScheduleEdit = reconcileGroupWeeklySessions({
      group: { ...group, schedules: [{ day: 'Tuesday', time: '20:00' }] },
      existingSessions: recAfterReload.sessions,
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(recAfterRealScheduleEdit.sessions[0].syncState, 'needs_update');
    const linkWhileNeedsUpdate = resolveActiveZoomLinkForLesson({
      group,
      lesson: exactLesson,
      groupWeeklySessions: recAfterRealScheduleEdit.sessions
    });
    assert.equal(linkWhileNeedsUpdate, '', 'Outdated needs_update session must require re-sync before resolving');
    assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: linkWhileNeedsUpdate }), true);

    // 4. Negative cases: warning MUST remain visible whenever sync failed or no valid active synced link exists
    forceCreateFail = true;
    const failedCreateRes = await createOrReplaceZoomMeetingForSession({
      session: pendingSession,
      sessions: [pendingSession],
      records: [],
      history: []
    });
    assert.equal(failedCreateRes.ok, false);
    const failedLink = resolveActiveZoomLinkForLesson({
      group,
      lesson: exactLesson,
      groupWeeklySessions: failedCreateRes.sessions
    });
    assert.equal(failedLink, '');
    assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: failedLink }), true);

    const negativeSessions: GroupWeeklySession[] = [
      { ...updateRes.updatedSession!, id: 'neg_err', syncState: 'error' },
      { ...updateRes.updatedSession!, id: 'neg_pending', syncState: 'pending' },
      { ...updateRes.updatedSession!, id: 'neg_needs_upd', syncState: 'needs_update' },
      { ...updateRes.updatedSession!, id: 'neg_superseded', syncState: 'superseded' as any },
      { ...updateRes.updatedSession!, id: 'neg_empty_url', syncState: 'synced', zoomJoinUrl: '   ' },
      { ...updateRes.updatedSession!, id: 'neg_deleted', syncState: 'synced', deleted: true },
      { ...updateRes.updatedSession!, id: 'neg_manual', syncState: 'synced', meetingSource: 'manual' },
      { ...updateRes.updatedSession!, id: 'neg_legacy', syncState: 'synced', meetingSource: 'legacy_migrated' },
      { ...updateRes.updatedSession!, id: 'neg_other_grp', groupId: 'grp_other', syncState: 'synced' }
    ];

    for (const badSession of negativeSessions) {
      const resolvedBad = resolveActiveZoomLinkForLesson({
        group,
        lesson: exactLesson,
        groupWeeklySessions: [badSession]
      });
      assert.equal(resolvedBad, '', `Session ${badSession.id} must NOT resolve a Zoom link`);
      assert.equal(
        shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: resolvedBad }),
        true,
        `Warning must stay visible for invalid/blocked session ${badSession.id}`
      );
    }

    // Legacy fallback fields on group/lesson must NEVER silence the warning
    const legacyOnlyResolved = resolveActiveZoomLinkForLesson({
      group,
      lesson: exactLesson,
      groupWeeklySessions: []
    });
    assert.equal(legacyOnlyResolved, '');
    assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: legacyOnlyResolved }), true);

    // Offline lessons never show Zoom warning
    assert.equal(shouldShowZoomSyncWarning({ isOnline: false, resolvedZoomLink: '' }), false);

    // =========================================================================
    // 5. Pending-with-ID-and-Link Recovery, Create Missing, Non-Destructive Ambiguity,
    //    Durable Save Failure/Retry/Reopen, Two-Device Merge, & Canonical Link Consistency
    // =========================================================================
    console.log('--- Testing Pending+ID verification, Create Missing, Ambiguity, Durability, Merge & Canonical Links ---');

    forceCreateFail = false;
    let mockCreateCalls = 0;
    let mockPatchCalls = 0;
    let mockDeleteCalls = 0;
    let remoteMeetingsById: Record<string, any> = {};
    let remoteMeetingsList: any[] = [];

    __setZoomServerUpstreamFetchForTesting(async (url, init) => {
      const method = (init?.method || 'GET').toUpperCase();
      const jsonResp = (status: number, obj: any) => new Response(JSON.stringify(obj), { status });

      if (url.startsWith('https://zoom.us/oauth/token')) {
        return jsonResp(200, {
          access_token: 'zoom_mock_recovery_token',
          token_type: 'bearer',
          expires_in: 3600
        });
      }
      if (url === 'https://api.zoom.us/v2/users/me') {
        return jsonResp(200, { id: 'zoom_host_mock', email: 'teacher@glueck.app', type: 2 });
      }
      if (url.startsWith('https://api.zoom.us/v2/users/me/meetings') && method === 'GET') {
        return jsonResp(200, {
          meetings: remoteMeetingsList,
          next_page_token: ''
        });
      }
      if (url === 'https://api.zoom.us/v2/users/me/meetings' && method === 'POST') {
        mockCreateCalls += 1;
        zoomCounter += 1;
        const parsed = JSON.parse(String(init?.body || '{}'));
        const created = {
          id: zoomCounter,
          topic: parsed.topic,
          type: parsed.type ?? 8,
          start_time: parsed.start_time,
          duration: parsed.duration ?? 60,
          timezone: parsed.timezone || DEFAULT_ZOOM_TIMEZONE,
          recurrence: parsed.recurrence,
          join_url: `https://zoom.us/j/${zoomCounter}?pwd=PASS${zoomCounter}`,
          start_url: `https://zoom.us/s/${zoomCounter}?zak=SECRET_ZAK`,
          password: `PASS${zoomCounter}`,
          host_email: 'teacher@glueck.app'
        };
        remoteMeetingsById[String(zoomCounter)] = created;
        remoteMeetingsList.push(created);
        return jsonResp(201, created);
      }
      if (url.startsWith('https://api.zoom.us/v2/meetings/') && method === 'GET') {
        const meetingId = url.split('/v2/meetings/')[1].split('?')[0];
        const found = remoteMeetingsById[meetingId];
        if (!found) return jsonResp(404, { message: 'Meeting does not exist' });
        return jsonResp(200, found);
      }
      if (url.startsWith('https://api.zoom.us/v2/meetings/') && method === 'PATCH') {
        mockPatchCalls += 1;
        return new Response(null, { status: 204 });
      }
      if (url.startsWith('https://api.zoom.us/v2/meetings/') && method === 'DELETE') {
        mockDeleteCalls += 1;
        return new Response(null, { status: 204 });
      }
      return jsonResp(404, { message: 'Not found' });
    });

    // 5A. Pending session ALREADY HAS Meeting ID + Join URL AND matching recurring Zoom meeting exists on Zoom
    //     -> Create Missing MUST NOT skip it; MUST verify & link WITHOUT creating duplicate, patching, or deleting!
    const recoveryGroup: Group = {
      id: 'grp_recovery_verify',
      name: 'Recovery A2',
      type: 'online',
      grade: 'Grade 10',
      monthlyPackagePrice: 1400,
      sessionCount: 4,
      color: '#10b981',
      lessonDurationMinutes: 60,
      schedules: [{ day: 'Monday', time: '18:00' }],
      zoomLink: 'https://zoom.us/j/11111111111?pwd=OLD_LEGACY',
      updatedAt: Date.now()
    };
    const recInit = reconcileGroupWeeklySessions({
      group: recoveryGroup,
      existingSessions: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    const stuckPendingWithId: GroupWeeklySession = {
      ...recInit.sessions[0],
      meetingSource: 'zoom_api',
      syncState: 'pending',
      zoomMeetingId: '88001122334',
      zoomJoinUrl: 'https://zoom.us/j/88001122334?pwd=EXISTING',
      zoomPasscode: 'EXISTING'
    };
    // Remote Zoom has the exact recurring meeting (type 8, Monday=2 in Zoom weekly_days, 18:00 Africa/Cairo, 60 min)
    remoteMeetingsById['88001122334'] = {
      id: 88001122334,
      topic: stuckPendingWithId.standardizedTitle,
      type: 8,
      start_time: '2026-11-16T16:00:00Z', // 18:00 Africa/Cairo (UTC+2 in Nov)
      duration: 60,
      timezone: DEFAULT_ZOOM_TIMEZONE,
      recurrence: { type: 2, repeat_interval: 1, weekly_days: '2' },
      join_url: 'https://zoom.us/j/88001122334?pwd=EXISTING',
      password: 'EXISTING',
      host_email: 'teacher@glueck.app'
    };
    remoteMeetingsList = [remoteMeetingsById['88001122334']];

    const previewPendingWithId = buildZoomMigrationPreview({
      groups: [recoveryGroup],
      existingSessions: [stuckPendingWithId],
      targetTimezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(
      previewPendingWithId.items[0].action,
      'verify_existing_pending',
      'Pending session with existing ID+URL must be classified as verify_existing_pending, NOT already_standardized'
    );
    assert.equal(previewPendingWithId.counts.verifyExistingPending, 1);

    const createMissingRes = await executeBulkZoomMigration({
      mode: 'create_missing_only',
      preview: previewPendingWithId,
      existingRecords: [],
      existingHistory: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(createMissingRes.completed, true);
    assert.equal(createMissingRes.noOp, false);
    assert.equal(createMissingRes.succeededCount, 1);
    assert.equal(createMissingRes.linkedExistingCount, 1);
    assert.equal(createMissingRes.createdCount, 0, 'Must NOT create duplicate meeting when existing recurring Zoom meeting matches');
    assert.equal(mockCreateCalls, 0, 'Zero POST create calls during verified existing link recovery');
    assert.equal(mockPatchCalls, 0, 'Zero PATCH calls during verified existing link recovery');
    assert.equal(mockDeleteCalls, 0, 'Zero DELETE calls during verified existing link recovery');
    const recoveredSession = createMissingRes.sessions.find((s) => s.id === stuckPendingWithId.id)!;
    assert.equal(recoveredSession.syncState, 'synced');
    assert.equal(recoveredSession.meetingSource, 'zoom_api');
    assert.equal(recoveredSession.zoomMeetingId, '88001122334');
    assert.equal(isApprovedSyncedZoomSession(recoveredSession), true);

    // 5B. Re-running Create Missing when all sessions are already synced -> NO-OP, MUST NOT claim completed/success
    const previewAlreadySynced = buildZoomMigrationPreview({
      groups: [recoveryGroup],
      existingSessions: createMissingRes.sessions,
      targetTimezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(previewAlreadySynced.counts.alreadyStandardized, 1);
    const noOpRes = await executeBulkZoomMigration({
      mode: 'create_missing_only',
      preview: previewAlreadySynced,
      existingRecords: createMissingRes.records,
      existingHistory: createMissingRes.history,
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(noOpRes.noOp, true, 'Must explicitly flag noOp when 0 sessions need processing');
    assert.equal(noOpRes.completed, false, 'Must NOT report completed/success when 0 sessions were processed');
    assert.equal(noOpRes.succeededCount, 0);
    assert.equal(mockCreateCalls, 0);

    // 5C. Name-only match (wrong type / wrong day) & Multiple same-name candidates ->
    //     MUST require explicit user selection, NEVER auto-link blindly, NEVER create duplicate, NEVER delete/modify Zoom!
    const ambiguousGroup: Group = {
      ...recoveryGroup,
      id: 'grp_ambiguous_case',
      name: 'Ambiguous B1',
      schedules: [{ day: 'Wednesday', time: '17:00' }]
    };
    const ambRec = reconcileGroupWeeklySessions({
      group: ambiguousGroup,
      existingSessions: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    const ambSession: GroupWeeklySession = {
      ...ambRec.sessions[0],
      syncState: 'pending',
      meetingSource: 'zoom_api',
      zoomMeetingId: undefined,
      zoomJoinUrl: undefined
    };

    // Case 1: Single meeting with matching topic ONLY, but non-recurring type=2 (name alone is NOT enough!)
    remoteMeetingsById = {
      '88111111111': {
        id: 88111111111,
        topic: ambSession.standardizedTitle,
        type: 2, // non-recurring scheduled meeting
        start_time: '2026-11-18T15:00:00Z',
        duration: 60,
        timezone: DEFAULT_ZOOM_TIMEZONE,
        join_url: 'https://zoom.us/j/88111111111?pwd=ONE_TIME'
      }
    };
    remoteMeetingsList = Object.values(remoteMeetingsById);

    const nameOnlySyncRes = await syncOrRecoverZoomSession({
      session: ambSession,
      sessions: [ambSession],
      records: [],
      history: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(nameOnlySyncRes.ok, false);
    assert.equal(nameOnlySyncRes.outcome, 'ambiguous', 'Name-only match must prompt user selection instead of auto-linking or duplicating');
    assert.equal(nameOnlySyncRes.ambiguousItem?.candidates.length, 1);
    assert.equal(mockCreateCalls, 0, 'Must NOT create duplicate meeting on ambiguous name-only match');
    assert.equal(mockPatchCalls, 0, 'Must NOT patch existing meeting during recovery');
    assert.equal(mockDeleteCalls, 0, 'Must NOT delete existing meeting during recovery');

    // Case 2: Multiple matching recurring meetings with identical topic -> ambiguous candidate list
    remoteMeetingsById = {
      '88222222221': {
        id: 88222222221,
        topic: ambSession.standardizedTitle,
        type: 8,
        start_time: '2026-11-18T15:00:00Z', // 17:00 Africa/Cairo
        duration: 60,
        timezone: DEFAULT_ZOOM_TIMEZONE,
        recurrence: { type: 2, repeat_interval: 1, weekly_days: '4' }, // Wed = 4 in Zoom
        join_url: 'https://zoom.us/j/88222222221?pwd=DUP1'
      },
      '88222222222': {
        id: 88222222222,
        topic: ambSession.standardizedTitle,
        type: 8,
        start_time: '2026-11-18T15:00:00Z',
        duration: 60,
        timezone: DEFAULT_ZOOM_TIMEZONE,
        recurrence: { type: 2, repeat_interval: 1, weekly_days: '4' },
        join_url: 'https://zoom.us/j/88222222222?pwd=DUP2'
      }
    };
    remoteMeetingsList = Object.values(remoteMeetingsById);

    const multiCandRes = await syncOrRecoverZoomSession({
      session: ambSession,
      sessions: [ambSession],
      records: [],
      history: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(multiCandRes.ok, false);
    assert.equal(multiCandRes.outcome, 'ambiguous');
    assert.equal(multiCandRes.ambiguousItem?.candidates.length, 2);
    assert.equal(mockCreateCalls, 0);
    assert.equal(mockPatchCalls, 0);
    assert.equal(mockDeleteCalls, 0);

    // User explicitly selects candidate #2 -> binds cleanly without any Zoom API mutation
    const chosenCandidate = multiCandRes.ambiguousItem!.candidates[1];
    const manualChoice = linkVerifiedZoomMeetingToSession({
      session: ambSession,
      meeting: {
        zoomMeetingId: chosenCandidate.zoomMeetingId,
        joinUrl: chosenCandidate.joinUrl,
        meetingPasscode: chosenCandidate.meetingPasscode,
        topic: chosenCandidate.topic,
        timezone: chosenCandidate.timezone
      },
      sessions: [ambSession],
      records: [],
      history: []
    });
    assert.equal(manualChoice.updatedSession.syncState, 'synced');
    assert.equal(manualChoice.updatedSession.zoomMeetingId, '88222222222');
    assert.equal(mockCreateCalls, 0);
    assert.equal(mockPatchCalls, 0);
    assert.equal(mockDeleteCalls, 0);

    // 5D. Durable Persistence Failure -> Retry without Zoom Duplication -> App Reopen Preservation
    __setSimulatePrimaryDbForTests(true);
    try {
      // Simulate storage write failure
      __setStorageFailureHookForTests((op, key) => {
        if (op === 'set' && key === 'glueck_group_weekly_sessions_v1') {
          throw new Error('Simulated SQLite/IndexedDB disk full');
        }
      });

      const failedPersist = await persistZoomWorkspaceDurably({
        sessions: createMissingRes.sessions,
        records: createMissingRes.records,
        history: createMissingRes.history
      });
      assert.equal(failedPersist.ok, false, 'Must fail when durable storage write fails');
      assert.equal(failedPersist.verified, false, 'Must NOT report verified when save failed');
      assert.ok(failedPersist.error?.includes('disk full'));

      // Clear fault and retry durable save WITHOUT calling Zoom API again
      __setStorageFailureHookForTests(null);
      const retryPersist = await persistZoomWorkspaceDurably({
        sessions: createMissingRes.sessions,
        records: createMissingRes.records,
        history: createMissingRes.history
      });
      assert.equal(retryPersist.ok, true);
      assert.equal(retryPersist.verified, true, 'Retry save must succeed and pass read-back verification');
      assert.equal(mockCreateCalls, 0, 'Retrying failed local save must NEVER call Zoom API or create duplicates');

      // Simulate full app close & reopen (clear in-memory cache, reload from primary DB)
      __clearMemoryStoreOnlyForTests();
      const reopenedSessions = await loadGroupWeeklySessions();
      assert.equal(reopenedSessions.length, 1);
      assert.equal(reopenedSessions[0].id, stuckPendingWithId.id);
      assert.equal(reopenedSessions[0].syncState, 'synced', 'Synced status must survive app close & reopen');
      assert.equal(reopenedSessions[0].zoomMeetingId, '88001122334');
      assert.equal(reopenedSessions[0].zoomJoinUrl, 'https://zoom.us/j/88001122334?pwd=EXISTING');
    } finally {
      __setStorageFailureHookForTests(null);
      __setSimulatePrimaryDbForTests(false);
    }

    // 5E. Two-Device Sync Merge: Deterministic IDs + Protected Verified Binding + Slot Deduplication
    const devARec = reconcileGroupWeeklySessions({
      group: recoveryGroup,
      existingSessions: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    const devBRec = reconcileGroupWeeklySessions({
      group: recoveryGroup,
      existingSessions: [],
      timezone: DEFAULT_ZOOM_TIMEZONE
    });
    assert.equal(
      devARec.sessions[0].id,
      devBRec.sessions[0].id,
      'Two devices reconciling the same group slot must produce the exact same deterministic session ID'
    );

    // Scenario 1: Same ID, Device A has synced zoom_api binding, Device B has NEWER pending placeholder
    const deviceASynced: GroupWeeklySession = {
      ...recoveredSession,
      updatedAt: 5000,
      version: 2
    };
    const deviceBNewerPending: GroupWeeklySession = {
      ...devBRec.sessions[0],
      syncState: 'pending',
      meetingSource: 'zoom_api',
      zoomMeetingId: undefined,
      zoomJoinUrl: undefined,
      updatedAt: 9000,
      version: 3
    };
    const mergedSameId = mergeEntities<GroupWeeklySession>(
      [deviceASynced],
      [deviceBNewerPending],
      'groupWeeklySessions'
    );
    assert.equal(mergedSameId.merged.length, 1);
    assert.equal(mergedSameId.merged[0].syncState, 'synced', 'Newer pending placeholder on Device B must NOT overwrite verified synced binding');
    assert.equal(mergedSameId.merged[0].zoomMeetingId, '88001122334');

    // Scenario 2: Legacy random IDs on Device A vs Device B for the SAME (groupId, weekday, startTime) slot
    const deviceALegacyIdSynced: GroupWeeklySession = {
      ...recoveredSession,
      id: 'gws_random_device_a',
      updatedAt: 5000
    };
    const deviceBLegacyIdPending: GroupWeeklySession = {
      ...devBRec.sessions[0],
      id: 'gws_random_device_b',
      syncState: 'pending',
      meetingSource: 'zoom_api',
      zoomMeetingId: undefined,
      zoomJoinUrl: undefined,
      updatedAt: 8000
    };
    const mergedDiffIds = mergeEntities<GroupWeeklySession>(
      [deviceALegacyIdSynced],
      [deviceBLegacyIdPending],
      'groupWeeklySessions'
    );
    assert.equal(mergedDiffIds.merged.length, 1, 'Two-device merge must deduplicate same (groupId, weekday, startTime) slot without duplicate rows');
    assert.equal(mergedDiffIds.merged[0].syncState, 'synced');
    assert.equal(mergedDiffIds.merged[0].zoomMeetingId, '88001122334');

    // 5F. Canonical Link Consistency across Group, Lesson, Reminder, and Schedule + Warning instead of Silent Fallback
    const multiSlotGroup: Group = {
      id: 'grp_canonical_consistency',
      name: 'Canonical B2',
      type: 'online',
      grade: 'Grade 11',
      monthlyPackagePrice: 1600,
      sessionCount: 8,
      color: '#6366f1',
      lessonDurationMinutes: 60,
      schedules: [
        { day: 'Monday', time: '16:00' },
        { day: 'Thursday', time: '17:30' }
      ],
      zoomLink: 'https://zoom.us/j/10101010101?pwd=OLD_GROUP_FALLBACK',
      updatedAt: Date.now()
    };
    const monSyncedSession: GroupWeeklySession = {
      ...recoveredSession,
      id: 'gws_can_mon',
      groupId: multiSlotGroup.id,
      weekday: 1,
      startTime: '16:00',
      syncState: 'synced',
      meetingSource: 'zoom_api',
      zoomMeetingId: '99111111111',
      zoomJoinUrl: 'https://zoom.us/j/99111111111?pwd=MON_OK'
    };
    const thuNeedsUpdateSession: GroupWeeklySession = {
      ...recoveredSession,
      id: 'gws_can_thu',
      groupId: multiSlotGroup.id,
      weekday: 4,
      startTime: '17:30',
      syncState: 'needs_update',
      meetingSource: 'zoom_api',
      zoomMeetingId: '99222222222',
      zoomJoinUrl: 'https://zoom.us/j/99222222222?pwd=THU_STALE'
    };
    const mixedSlotSessions = [monSyncedSession, thuNeedsUpdateSession];

    // Monday slot: Group, Lesson, Reminder, and Schedule ALL agree on canonical Monday URL
    const monLesson: Partial<Lesson> = {
      id: 'lsn_can_mon',
      groupId: multiSlotGroup.id,
      date: '2026-11-16', // Monday
      time: '16:00',
      type: 'online',
      status: 'scheduled',
      meetingLink: 'https://zoom.us/j/55555555555?pwd=STALE_LESSON'
    };
    const monStatus = resolveCanonicalZoomLinkStatus({
      group: multiSlotGroup,
      lesson: monLesson,
      groupWeeklySessions: mixedSlotSessions
    });
    assert.equal(monStatus.status, 'approved');
    assert.equal(monStatus.shouldWarn, false);
    assert.equal(monStatus.url, 'https://zoom.us/j/99111111111?pwd=MON_OK');

    // Thursday slot (needs_update): MUST warn & return '', NEVER fall back to Monday link or legacy group/lesson/default links!
    const thuLesson: Partial<Lesson> = {
      id: 'lsn_can_thu',
      groupId: multiSlotGroup.id,
      date: '2026-11-19', // Thursday
      time: '17:30',
      type: 'online',
      status: 'scheduled',
      meetingLink: 'https://zoom.us/j/55555555555?pwd=STALE_LESSON'
    };
    const thuStatus = resolveCanonicalZoomLinkStatus({
      group: multiSlotGroup,
      lesson: thuLesson,
      groupWeeklySessions: mixedSlotSessions
    });
    assert.equal(thuStatus.status, 'needs_update');
    assert.equal(thuStatus.shouldWarn, true);
    assert.equal(thuStatus.url, '', 'Blocked Thursday slot must NOT fall back to Monday URL or legacy group/lesson/default URL');
    assert.equal(
      resolveActiveZoomLinkForLesson({
        group: multiSlotGroup,
        lesson: thuLesson,
        groupWeeklySessions: mixedSlotSessions,
        defaultZoomLink: 'https://zoom.us/j/99999999999?pwd=DEFAULT'
      }),
      '',
      'resolveActiveZoomLinkForLesson must also refuse defaultZoomLink fallback on blocked Thursday slot'
    );
    assert.equal(shouldShowZoomSyncWarning({ isOnline: true, resolvedZoomLink: thuStatus.url }), true);

    // Schedule projection (both explicit scheduled lesson and projected lesson) must match canonical status
    const projectedMixed = getProjectedLessonsForRange(
      '2026-11-16',
      '2026-11-22',
      [multiSlotGroup],
      [thuLesson as Lesson],
      'https://zoom.us/j/99999999999?pwd=DEFAULT',
      mixedSlotSessions
    );
    const schedMon = projectedMixed.find((l) => l.date === '2026-11-16');
    const schedThu = projectedMixed.find((l) => l.date === '2026-11-19');
    assert.equal(schedMon?.meetingLink, 'https://zoom.us/j/99111111111?pwd=MON_OK');
    assert.equal(schedThu?.meetingLink, undefined, 'Schedule must clear stale meetingLink when Thursday slot needs_update');

    console.log('✅ All Zoom Sync -> Lesson Reminder regression tests passed!');
  } finally {
    __setZoomProxyFetchForTesting(null);
    __setZoomServerUpstreamFetchForTesting(null);
    __resetZoomServerVaultForTesting();
    server.close();
  }
}

runZoomReminderSyncRegressionTests().catch((err) => {
  console.error('❌ Zoom Reminder Sync Regression tests failed:', err);
  process.exit(1);
});
