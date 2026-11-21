import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import expressApp from '../api/expressApp';
import {
  DEFAULT_ZOOM_TIMEZONE,
  parseIsoDateWeekday,
  reconcileGroupWeeklySessions,
  resolveActiveZoomLinkForLesson
} from '../services/zoomSessionStandardizer';
import {
  __resetZoomServerVaultForTesting,
  __setZoomServerUpstreamFetchForTesting
} from '../server/zoomServerProxy';
import {
  __resetZoomServiceMemoryForTesting,
  __setZoomProxyFetchForTesting,
  connectZoomAccount,
  createOrReplaceZoomMeetingForSession,
  updateZoomMeetingForSession
} from '../services/zoomService';
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
