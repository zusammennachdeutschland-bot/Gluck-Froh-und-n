import assert from 'node:assert/strict';
import expressApp from '../api/expressApp';
import {
  DEFAULT_ZOOM_TIMEZONE,
  normalizeWeekdayIndex,
  formatEnglishWeekday,
  normalize24HourTime,
  formatStandardizedZoomTopic,
  parseStandardizedZoomTopic,
  generateReadableSessionCode,
  generateStableCalendarUid,
  reconcileGroupWeeklySessions,
  resolveActiveZoomLinkForLesson
} from '../services/zoomSessionStandardizer';
import { getProjectedLessonsForRange } from '../utils/scheduleUtils';
import {
  __resetZoomServerVaultForTesting,
  __setZoomServerUpstreamFetchForTesting
} from '../server/zoomServerProxy';
import fs from 'node:fs';
import path from 'node:path';
import {
  __setZoomProxyFetchForTesting,
  __resetZoomServiceMemoryForTesting,
  detectZoomRuntime,
  normalizeZoomCredentialInput,
  connectZoomAccount,
  testZoomConnection,
  getZoomConnectionStatus,
  fetchHostStartUrlForSession,
  createOrReplaceZoomMeetingForSession,
  updateZoomMeetingForSession,
  disconnectZoomAccount,
  buildZoomMigrationPreview,
  executeBulkZoomMigration,
  disableWaitingRoomForExistingZoomMeetings,
  sanitizeZoomRecordForStorage,
  redactZoomSecrets
} from '../services/zoomService';
import { __setZoomNativeTestAdapter } from '../shared/zoomSecureBridgePlugin';
import {
  generateSessionsIcsContent,
  syncSessionsToGoogleCalendar,
  __setCalendarFetchForTesting
} from '../services/calendarSyncService';
import {
  evaluateRecordingMatchAgainstLessons,
  sanitizeEntityForGrainPrivacy,
  detectGrainTwoPartRecordingPairs,
  extractStructuredLessonContentForLesson
} from '../services/grainService';
import { buildOutboundDelta } from '../services/sync/deltaBuilder';
import { partitionBackupPayload } from '../services/firebaseWorkspaceSync';
import { validateAndSanitizeBackupPayload } from '../utils/backupEngine';
import { Group, GroupWeeklySession, Lesson, Student, ZoomMeetingHistory } from '../types';

async function runZoomGrainV2Tests() {
  console.log('=== Starting Glück × Zoom × Grain V2.0 Verification Suite ===');

  // ---------------------------------------------------------------------------
  // 1. STANDARDIZED NAMING, WEEKDAY NORMALIZATION & ZERO STUDENT PRIVACY
  // ---------------------------------------------------------------------------
  console.log('1. Testing standardized naming, session codes & student privacy...');

  assert.equal(normalizeWeekdayIndex('Monday'), 1);
  assert.equal(normalizeWeekdayIndex('الأربعاء'), 3);
  assert.equal(normalizeWeekdayIndex('Mittwoch'), 3);
  assert.equal(normalizeWeekdayIndex('الأحد'), 0);
  assert.equal(formatEnglishWeekday('الأثنين'), 'Monday');
  assert.equal(normalize24HourTime('7:05 PM'), '19:05');
  assert.equal(normalize24HourTime('15:00'), '15:00');

  const topic1 = formatStandardizedZoomTopic('الاثنين', '19:00', '  Grade 8   A1  ');
  assert.equal(topic1, 'Monday - 19:00 - Grade 8 A1');

  const parsedTopic = parseStandardizedZoomTopic('Wednesday - 15:00 - Grade 8 A1');
  assert.ok(parsedTopic, 'parseStandardizedZoomTopic must parse standardized string');
  assert.equal(parsedTopic!.weekdayName, 'Wednesday');
  assert.equal(parsedTopic!.weekdayIndex, 3);
  assert.equal(parsedTopic!.startTime, '15:00');
  assert.equal(parsedTopic!.groupName, 'Grade 8 A1');

  // Collision-safe readable Session Codes
  const usedCodes = new Set<string>();
  const codeA = generateReadableSessionCode('Grade 8 A1', 'Monday', '19:00', usedCodes, 'grp_1');
  usedCodes.add(codeA);
  const codeB = generateReadableSessionCode('Grade 8 A1', 'Monday', '19:00', usedCodes, 'grp_1_dup');
  assert.equal(codeA, 'GR8A1-MON-1900');
  assert.notEqual(codeA, codeB, 'Session codes must remain collision-safe');

  // Stable Calendar UID
  const uid1 = generateStableCalendarUid('sess_abc_123');
  const uid2 = generateStableCalendarUid('sess_abc_123');
  assert.equal(uid1, 'gluck-session-sess_abc_123@glueck.app');
  assert.equal(uid1, uid2);

  // ---------------------------------------------------------------------------
  // 2. MULTI-SLOT RECONCILIATION, RENAMES & HISTORICAL LESSON IMMUTABILITY
  // ---------------------------------------------------------------------------
  console.log('2. Testing group reconciliation across multi-slot schedules & group rename...');

  const groupV1: Group = {
    id: 'grp_grade8_a1',
    name: 'Grade 8 A1',
    type: 'online',
    grade: 'Grade 8',
    monthlyPackagePrice: 1200,
    sessionCount: 4,
    color: '#6366f1',
    lessonDurationMinutes: 60,
    schedules: [
      { day: 'Monday', time: '19:00' },
      { day: 'Wednesday', time: '15:00' }
    ],
    zoomLink: 'https://zoom.us/j/11122233344',
    updatedAt: Date.now()
  };

  const rec1 = reconcileGroupWeeklySessions({
    group: groupV1,
    existingSessions: [],
    timezone: DEFAULT_ZOOM_TIMEZONE
  });

  assert.equal(rec1.sessions.length, 2, 'Online group with 2 weekly days must create 2 independent weekly sessions');
  const monSession = rec1.sessions.find((s) => s.weekday === 1)!;
  const wedSession = rec1.sessions.find((s) => s.weekday === 3)!;
  assert.equal(monSession.standardizedTitle, 'Monday - 19:00 - Grade 8 A1');
  assert.equal(wedSession.standardizedTitle, 'Wednesday - 15:00 - Grade 8 A1');
  assert.equal(monSession.timezone, 'Africa/Cairo');
  assert.notEqual(monSession.id, wedSession.id);
  assert.notEqual(monSession.calendarEventUid, wedSession.calendarEventUid);

  // Zero student names in public topic
  assert.equal(monSession.standardizedTitle.includes('Malak'), false);

  // Simulate API-synced state + rename group -> must preserve IDs, sessionCode, UID and flag needs_update
  const syncedMon: GroupWeeklySession = {
    ...monSession,
    zoomMeetingId: '99887766554',
    zoomJoinUrl: 'https://zoom.us/j/99887766554',
    meetingSource: 'zoom_api',
    syncState: 'synced',
    googleCalendarEventId: 'gcal_evt_mon_1',
    calendarSyncStatus: 'synced'
  };
  const groupRenamed: Group = {
    ...groupV1,
    name: 'Grade 8 B2'
  };
  const historicalLesson: Lesson = {
    id: 'les_hist_1',
    groupId: 'grp_grade8_a1',
    groupName: 'Grade 8 A1',
    grade: 'Grade 8',
    title: 'Past Grammar Lesson',
    date: '2025-02-10',
    time: '19:00',
    durationMinutes: 60,
    type: 'online',
    status: 'completed',
    paymentStatus: 'paid',
    amountDue: 300,
    amountPaid: 300,
    sessionNumber: 1,
    totalSessionsInPackage: 4,
    report: {
      attendanceStatus: 'present',
      studentAttendance: { stu_1: 'present' },
      teacherNotes: 'Immutability test'
    }
  };
  const lessonBeforeSnapshot = JSON.stringify(historicalLesson);

  const recRenamed = reconcileGroupWeeklySessions({
    group: groupRenamed,
    existingSessions: [syncedMon, wedSession]
  });
  const renamedMon = recRenamed.sessions.find((s) => s.id === syncedMon.id)!;
  assert.equal(renamedMon.sessionCode, syncedMon.sessionCode, 'sessionCode must remain immutable on group rename');
  assert.equal(renamedMon.calendarEventUid, syncedMon.calendarEventUid, 'calendarEventUid must stay immutable');
  assert.equal(renamedMon.standardizedTitle, 'Monday - 19:00 - Grade 8 B2');
  assert.equal(renamedMon.syncState, 'needs_update');
  assert.equal(renamedMon.calendarSyncStatus, 'needs_update');
  assert.equal(renamedMon.zoomMeetingId, '99887766554');
  assert.ok(recRenamed.historyEntries.some((h) => h.action === 'group_renamed'));
  assert.equal(JSON.stringify(historicalLesson), lessonBeforeSnapshot, 'Historical lesson must remain completely untouched');

  // ---------------------------------------------------------------------------
  // 3. SERVER VAULT ENCRYPTION, BASIC 40m PLAN & ON-DEMAND START URL
  // ---------------------------------------------------------------------------
  console.log('3. Testing encrypted server S2S OAuth vault, Basic 40m advisory & start_url isolation...');

  __resetZoomServerVaultForTesting();
  __resetZoomServiceMemoryForTesting();

  const createdZoomTopics: string[] = [];
  let zoomCreateCounter = 9500100100;
  __setZoomServerUpstreamFetchForTesting(async (url, init) => {
    const jsonResp = (status: number, obj: any) => new Response(JSON.stringify(obj), { status });
    if (url.startsWith('https://zoom.us/oauth/token')) {
      return jsonResp(200, {
        access_token: 'zoom_s2s_secret_access_token_xyz',
        token_type: 'bearer',
        expires_in: 3600
      });
    }
    if (url === 'https://api.zoom.us/v2/users/me') {
      return jsonResp(200, {
        id: 'zoom_user_1',
        email: 'lehrer@glueck.app',
        type: 1 // Zoom Basic (40m limit)
      });
    }
    if (url === 'https://api.zoom.us/v2/users/me/meetings' && init?.method === 'POST') {
      const parsed = JSON.parse(String(init.body || '{}'));
      assert.equal(parsed.type, 8, 'Recurring meetings must be created with type = 8');
      assert.equal(parsed.duration, 60, 'Requested session duration must NOT be truncated for Basic accounts');
      assert.equal(parsed.settings?.waiting_room, false, 'New Zoom meetings must disable Waiting Room by default');
      createdZoomTopics.push(parsed.topic);
      zoomCreateCounter += 1;
      return jsonResp(201, {
        id: zoomCreateCounter,
        topic: parsed.topic,
        join_url: `https://zoom.us/j/${zoomCreateCounter}?pwd=pass123`,
        start_url: `https://zoom.us/s/${zoomCreateCounter}?zak=SECRET_ZAK_TOKEN_999`,
        password: 'pass123',
        host_email: 'lehrer@glueck.app',
        timezone: parsed.timezone || 'Africa/Cairo'
      });
    }
    if (url.startsWith('https://api.zoom.us/v2/meetings/') && init?.method === 'GET') {
      const mId = url.split('/meetings/')[1];
      return jsonResp(200, {
        id: mId,
        join_url: `https://zoom.us/j/${mId}?pwd=pass123`,
        start_url: `https://zoom.us/s/${mId}?zak=EPHEMERAL_HOST_ZAK_TOKEN`,
        password: 'pass123',
        host_email: 'lehrer@glueck.app'
      });
    }
    if (url.startsWith('https://api.zoom.us/v2/meetings/') && init?.method === 'PATCH') {
      const parsedPatch = JSON.parse(String(init.body || '{}'));
      assert.equal(
        parsedPatch.settings?.waiting_room,
        false,
        'Updated Zoom meetings must explicitly disable Waiting Room by default'
      );
      return new Response(null, { status: 204 });
    }
    return jsonResp(404, { message: 'Not found' });
  });

  const server = expressApp.listen(0);
  try {
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    // Route /api/zoom/* requests through the live Express server over loopback
    __setZoomProxyFetchForTesting(async (path, init) => {
      const r = await fetch(`${baseUrl}${path}`, init);
      return {
        ok: r.ok,
        status: r.status,
        json: () => r.json(),
        headers: r.headers
      };
    });

    const connectRes = await connectZoomAccount({
      accountId: 'acc_secret_987654',
      clientId: 'cli_secret_123456',
      clientSecret: 'super_secret_client_secret_value',
      defaultTimezone: 'Africa/Cairo'
    });
    assert.equal(connectRes.ok, true);
    assert.equal(connectRes.state.isBasicPlan, true);
    assert.equal(connectRes.state.maxMeetingMinutes, 40);
    assert.equal(connectRes.state.hostEmail, 'lehrer@glueck.app');

    // Ensure /api/zoom/status NEVER leaks raw credentials or secrets
    const statusState = await getZoomConnectionStatus();
    const serializedStatus = JSON.stringify(statusState);
    assert.equal(serializedStatus.includes('super_secret_client_secret_value'), false);
    assert.equal(serializedStatus.includes('zoom_s2s_secret_access_token_xyz'), false);
    assert.equal(serializedStatus.includes('acc_secret_987654'), false);
    assert.equal(statusState.hasCredentials, true);

    // Direct regression: creating a Zoom meeting from one slot replaces the
    // canonical URL for every active weekly slot in the same group.
    const groupWideOldMon: GroupWeeklySession = {
      ...monSession,
      zoomMeetingId: '81111111111',
      zoomJoinUrl: 'https://zoom.us/j/81111111111?pwd=OLD_MON',
      meetingSource: 'zoom_api',
      syncState: 'synced'
    };
    const groupWideOldWed: GroupWeeklySession = {
      ...wedSession,
      zoomMeetingId: '82222222222',
      zoomJoinUrl: 'https://zoom.us/j/82222222222?pwd=OLD_WED',
      meetingSource: 'zoom_api',
      syncState: 'synced'
    };
    const groupWideOldRecords = [
      {
        id: 'zoom_record_old_mon',
        sessionId: groupWideOldMon.id,
        groupId: groupV1.id,
        zoomMeetingId: '81111111111',
        joinUrl: groupWideOldMon.zoomJoinUrl!,
        topic: groupWideOldMon.standardizedTitle,
        startTime: groupWideOldMon.startTime,
        durationMinutes: groupWideOldMon.durationMinutes,
        timezone: groupWideOldMon.timezone,
        meetingType: 8,
        recurrenceWeeklyDay: 2,
        recurrenceRepeatInterval: 1,
        status: 'active',
        syncedAt: new Date().toISOString()
      },
      {
        id: 'zoom_record_old_wed',
        sessionId: groupWideOldWed.id,
        groupId: groupV1.id,
        zoomMeetingId: '82222222222',
        joinUrl: groupWideOldWed.zoomJoinUrl!,
        topic: groupWideOldWed.standardizedTitle,
        startTime: groupWideOldWed.startTime,
        durationMinutes: groupWideOldWed.durationMinutes,
        timezone: groupWideOldWed.timezone,
        meetingType: 8,
        recurrenceWeeklyDay: 4,
        recurrenceRepeatInterval: 1,
        status: 'active',
        syncedAt: new Date().toISOString()
      }
    ] as any;
    const groupWideCreate = await createOrReplaceZoomMeetingForSession({
      session: groupWideOldMon,
      sessions: [groupWideOldMon, groupWideOldWed],
      records: groupWideOldRecords,
      history: []
    });
    assert.equal(groupWideCreate.ok, true, 'Creating a meeting for one slot should succeed');
    const canonicalGroupUrl = groupWideCreate.createdRecord?.joinUrl;
    assert.ok(canonicalGroupUrl, 'The create operation must return the new canonical URL');
    assert.equal(groupWideCreate.sessions.length, 2);
    assert.ok(
      groupWideCreate.sessions.every((s) => s.zoomJoinUrl === canonicalGroupUrl),
      'Every active weekly slot in the group must receive the new canonical URL'
    );
    assert.ok(
      groupWideCreate.records.filter((r) => r.groupId === groupV1.id && r.status === 'active')
        .every((r) => r.joinUrl === canonicalGroupUrl),
      'No old active Zoom record may remain selectable after group-wide replacement'
    );
    assert.ok(
      groupWideCreate.records.filter((r) => r.groupId === groupV1.id && r.status === 'superseded').length >= 2,
      'Every previously active group record must be marked superseded'
    );
    const oldLinkLesson = {
      id: 'lesson_group_old_link',
      groupId: groupV1.id,
      date: '2026-11-16',
      time: '19:00',
      type: 'online' as const,
      meetingLink: 'https://zoom.us/j/81111111111?pwd=OLD_MON'
    };
    assert.equal(
      resolveActiveZoomLinkForLesson({
        group: groupV1,
        lesson: oldLinkLesson,
        groupWeeklySessions: groupWideCreate.sessions
      }),
      canonicalGroupUrl,
      'A lesson carrying an old slot URL must resolve only to the new canonical group URL'
    );
    assert.equal(
      groupWideCreate.records.some((r) => r.status === 'active' && r.joinUrl === groupWideOldWed.zoomJoinUrl),
      false,
      'A superseded Wednesday URL must never remain active/selectable'
    );

    // -------------------------------------------------------------------------
    // 4. DRY-RUN PREVIEW & RESUMABLE BULK MIGRATION
    // -------------------------------------------------------------------------
    console.log('4. Testing dry-run migration preview, manual link archiving & checkpoint resume...');

    // The direct group-wide replacement regression above already created one meeting.
    // Measure this migration independently instead of asserting against the shared test counter.
    const createdZoomTopicsBeforeMigration = createdZoomTopics.length;
    const preview = buildZoomMigrationPreview({
      groups: [groupV1],
      existingSessions: []
    });
    assert.equal(preview.totalOnlineGroups, 1);
    assert.equal(preview.items.length, 2);
    assert.equal(preview.counts.replaceManual, 2, 'Manual group.zoomLink sessions must be flagged to archive & replace');
    assert.equal(preview.counts.planWarningCount, 2, 'Basic plan with 60m duration must surface 40m cap warning');

    // Execute bulk migration first checkpoint only (abort after 1st session), then resume
    let checkpointCalls = 0;
    let firstSkipIds: string[] = [];
    const partialRes = await executeBulkZoomMigration({
      mode: 'standardize_all',
      preview,
      existingRecords: [],
      existingHistory: [],
      shouldAbort: () => checkpointCalls >= 1,
      onCheckpoint: (ckpt) => {
        checkpointCalls++;
        firstSkipIds = ckpt.processedSessionIds;
      }
    });
    assert.equal(partialRes.completed, false);
    assert.equal(partialRes.aborted, true);
    assert.equal(partialRes.succeededCount, 1);
    assert.equal(firstSkipIds.length, 1);

    // Resume from checkpoint — the first group-wide creation already supplied the canonical link to every slot
    const resumePreview = buildZoomMigrationPreview({
      groups: [groupV1],
      existingSessions: partialRes.sessions
    });
    const resumedRes = await executeBulkZoomMigration({
      mode: 'standardize_all',
      preview: resumePreview,
      existingRecords: partialRes.records,
      existingHistory: partialRes.history,
      skipSessionIds: new Set(firstSkipIds)
    });
    assert.equal(resumedRes.completed, true);
    assert.equal(resumedRes.succeededCount, 0, 'Resume must not create another meeting after the group already has one canonical URL');
    assert.equal(
      createdZoomTopics.length - createdZoomTopicsBeforeMigration,
      1,
      'Resumable migration must create only one group-wide canonical Zoom meeting for every weekly slot'
    );

    const migratedMon = resumedRes.sessions.find((s) => s.weekday === 1)!;
    assert.equal(migratedMon.meetingSource, 'zoom_api');
    assert.equal(migratedMon.syncState, 'synced');
    const activeGroupSessions = resumedRes.sessions.filter((s) => s.groupId === groupV1.id && !s.deleted);
    assert.equal(new Set(activeGroupSessions.map((s) => s.zoomJoinUrl)).size, 1,
      'Creating a Zoom meeting from the group UI must replace every active slot URL with one canonical group URL');
    assert.ok(activeGroupSessions.every((s) => s.zoomMeetingId === migratedMon.zoomMeetingId),
      'Every active group session must reference the same current Zoom meeting ID');
    assert.equal(resumedRes.records.filter((r) => r.groupId === groupV1.id && r.status === 'active').length, 1,
      'All previous active meeting records across the group must be superseded');
    assert.ok(
      resumedRes.history.some(
        (h) =>
          h.sessionId === migratedMon.id &&
          h.action === 'migrated_replace' &&
          h.previousZoomMeetingId === '11122233344'
      ),
      'Previous manual Zoom meeting ID must be archived in ZoomMeetingHistory before replacement'
    );

    // Verify start_url / zak= is NOT persisted anywhere in session or meeting records
    const serializedMigration = JSON.stringify({
      sessions: resumedRes.sessions,
      records: resumedRes.records,
      history: resumedRes.history
    });
    assert.equal(serializedMigration.includes('SECRET_ZAK_TOKEN_999'), false);
    assert.equal(serializedMigration.includes('start_url'), false);

    // On-demand host start URL fetch works cleanly
    const hostStart = await fetchHostStartUrlForSession(migratedMon.zoomMeetingId!);
    assert.equal(hostStart.ok, true);
    assert.ok(hostStart.startUrl?.includes('EPHEMERAL_HOST_ZAK_TOKEN'));

    // Bulk disable Waiting Room on all existing API-managed meetings (preserves meeting IDs & join URLs)
    const disableWrRes = await disableWaitingRoomForExistingZoomMeetings({
      sessions: resumedRes.sessions,
      records: resumedRes.records,
      history: resumedRes.history
    });
    assert.equal(disableWrRes.totalTargeted, 2);
    assert.equal(disableWrRes.updatedCount, 2);
    assert.equal(disableWrRes.failedCount, 0);
    assert.equal(
      disableWrRes.sessions.find((s) => s.id === migratedMon.id)?.zoomMeetingId,
      migratedMon.zoomMeetingId,
      'Disabling Waiting Room must preserve the exact existing Zoom meeting ID'
    );
    assert.equal(
      disableWrRes.sessions.find((s) => s.id === migratedMon.id)?.zoomJoinUrl,
      migratedMon.zoomJoinUrl,
      'Disabling Waiting Room must preserve the exact existing Zoom join URL'
    );

    // -------------------------------------------------------------------------
    // 5. 5-TIER GRAIN RECOGNITION + PART 1 / PART 2 PAIRING + FALLBACK EXTRACT
    // -------------------------------------------------------------------------
    console.log('5. Testing 5-tier Grain recording recognition & Part 1 / Part 2 preservation...');

    const toLocalIso = (year: number, month1Based: number, day: number, hour: number, minute: number) =>
      new Date(year, month1Based - 1, day, hour, minute, 0, 0).toISOString();

    const lessonMon: Lesson = {
      id: 'les_mon_today',
      groupId: 'grp_grade8_a1',
      groupName: 'Grade 8 A1',
      grade: 'Grade 8',
      title: 'Monday Grammar Session',
      date: '2026-11-16',
      time: '19:00',
      durationMinutes: 80,
      type: 'online',
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 300,
      amountPaid: 0,
      sessionNumber: 2,
      totalSessionsInPackage: 4
    };
    const lessonWed: Lesson = {
      id: 'les_wed_today',
      groupId: 'grp_grade8_a1',
      groupName: 'Grade 8 A1',
      grade: 'Grade 8',
      title: 'Wednesday Speaking Session',
      date: '2026-11-18',
      time: '15:00',
      durationMinutes: 60,
      type: 'online',
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 300,
      amountPaid: 0,
      sessionNumber: 3,
      totalSessionsInPackage: 4
    };
    const studentsList: Student[] = [
      {
        id: 'stu_1',
        name: 'Malak Ahmed',
        grade: 'Grade 8',
        parentName: 'Ahmed',
        parentPhone: '01000000001',
        studentPhone: '01000000002',
        groupId: 'grp_grade8_a1',
        paymentPlan: '4_lessons',
        documents: [],
        joinedDate: '2026-01-01'
      }
    ];

    // Tier 1: Match via HISTORICAL archived Zoom ID after migration
    const tier1HistEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'grec_tier1_hist',
        title: 'Part 1 - Old Zoom Recording',
        startDatetime: toLocalIso(2026, 11, 16, 19, 2),
        durationSeconds: 40 * 60,
        recordingUrl: 'https://grain.com/share/recording/tier1_hist',
        sourcePlatform: 'zoom',
        zoomMeetingId: '11122233344'
      },
      [lessonMon, lessonWed],
      [groupV1],
      studentsList,
      undefined,
      undefined,
      resumedRes.sessions,
      resumedRes.history
    );
    assert.equal(tier1HistEval.matchTier, 'zoom_meeting_id');
    assert.equal(tier1HistEval.candidates[0]?.lessonId, 'les_mon_today');
    assert.ok((tier1HistEval.candidates[0]?.confidenceScore || 0) >= 80);

    // Tier 2: Match via standardized topic ("Wednesday - 15:00 - Grade 8 A1") without zoomMeetingId
    const wedSessionLive = resumedRes.sessions.find((s) => s.weekday === 3)!;
    const tier2TopicEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'grec_tier2_topic',
        title: wedSessionLive.standardizedTitle,
        startDatetime: toLocalIso(2026, 11, 18, 15, 1),
        durationSeconds: 45 * 60,
        recordingUrl: 'https://grain.com/share/recording/tier2_topic',
        sourcePlatform: 'zoom'
      },
      [lessonMon, lessonWed],
      [groupV1],
      studentsList,
      undefined,
      undefined,
      resumedRes.sessions,
      resumedRes.history
    );
    assert.equal(tier2TopicEval.matchTier, 'standardized_topic');
    assert.equal(tier2TopicEval.candidates[0]?.lessonId, 'les_wed_today');
    assert.equal(tier2TopicEval.matchedSessionId, wedSessionLive.id);

    // Tier 4: Match via Google Calendar UID
    const wedWithCal: GroupWeeklySession = {
      ...wedSessionLive,
      calendarEventUid: 'gluck-session-custom-wed@glueck.app'
    };
    const tier4CalEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'grec_tier4_cal',
        title: 'Custom Recording Name',
        startDatetime: toLocalIso(2026, 11, 18, 15, 3),
        durationSeconds: 40 * 60,
        recordingUrl: 'https://grain.com/share/recording/tier4_cal',
        sourcePlatform: 'zoom',
        calendarEventUid: 'gluck-session-custom-wed@glueck.app'
      },
      [lessonWed],
      [groupV1],
      studentsList,
      undefined,
      undefined,
      [wedWithCal],
      []
    );
    assert.equal(tier4CalEval.matchTier, 'calendar_uid');
    assert.equal(tier4CalEval.matchedSessionId, wedWithCal.id);

    // Part 1 + Part 2 detection stays intact (40m + 26m within reconnect window)
    const evaluatedP1 = evaluateRecordingMatchAgainstLessons(
      {
        id: 'grec_p1',
        title: 'Monday - 19:00 - Grade 8 A1',
        recordingUrl: 'https://grain.com/share/recording/p1',
        sourcePlatform: 'zoom',
        startDatetime: toLocalIso(2026, 11, 16, 19, 0),
        endDatetime: toLocalIso(2026, 11, 16, 19, 40),
        durationSeconds: 40 * 60,
        zoomMeetingId: migratedMon.zoomMeetingId,
        participantNames: ['lehrer@glueck.app']
      },
      [lessonMon],
      [groupV1],
      studentsList,
      undefined,
      undefined,
      resumedRes.sessions,
      resumedRes.history
    );
    const evaluatedP2 = evaluateRecordingMatchAgainstLessons(
      {
        id: 'grec_p2',
        title: 'Monday - 19:00 - Grade 8 A1',
        recordingUrl: 'https://grain.com/share/recording/p2',
        sourcePlatform: 'zoom',
        startDatetime: toLocalIso(2026, 11, 16, 19, 44),
        endDatetime: toLocalIso(2026, 11, 16, 20, 10),
        durationSeconds: 26 * 60,
        zoomMeetingId: migratedMon.zoomMeetingId,
        participantNames: ['lehrer@glueck.app']
      },
      [lessonMon],
      [groupV1],
      studentsList,
      undefined,
      undefined,
      resumedRes.sessions,
      resumedRes.history
    );

    const pairedResults = detectGrainTwoPartRecordingPairs({
      recordings: [evaluatedP1, evaluatedP2],
      lessons: [lessonMon],
      groups: [groupV1],
      students: studentsList
    });
    const pairedP1 = pairedResults.find((r) => r.id === 'grec_p1')!;
    const pairedP2 = pairedResults.find((r) => r.id === 'grec_p2')!;
    assert.equal(pairedP1.detectedPartSlot, 'part1', 'First 40m segment must be tagged part1');
    assert.equal(pairedP2.detectedPartSlot, 'part2', 'Reconnect segment 4m later must be tagged part2');
    assert.equal(pairedP2.pairedRecordingId, 'grec_p1', 'Part 2 must pair back to Part 1');

    // Gemini-free 7-section deterministic extraction remains intact
    const extractionRes = await extractStructuredLessonContentForLesson({
      lesson: lessonMon,
      providedPart1Transcript:
        'Thema: Perfekt mit haben und sein. Neue Wörter: fahren, fliegen. Beispiel: Ich bin nach Berlin gefahren.',
      providedPart2Transcript:
        'Übung: Sätze im Perfekt bilden. Hausaufgabe: Arbeitsbuch Seite 14.'
    });
    assert.equal(extractionRes.transcriptStatus, 'complete');
    assert.equal(extractionRes.origin, 'grain_transcript_and_notes');
    assert.equal(extractionRes.partCount, 2);
    assert.ok(extractionRes.themaDerStunde);

    // -------------------------------------------------------------------------
    // 6. ICS EXPORT STABILITY & GOOGLE CALENDAR DUPLICATE PREVENTION
    // -------------------------------------------------------------------------
    console.log('6. Testing .ics stability & Google Calendar iCalUID duplicate prevention...');

    const icsA = generateSessionsIcsContent([migratedMon], { referenceDate: new Date('2026-11-16T08:00:00Z') });
    const icsB = generateSessionsIcsContent([migratedMon], { referenceDate: new Date('2026-11-16T08:00:00Z') });
    assert.equal(icsA, icsB, '.ics generation must be completely deterministic');
    assert.ok(icsA.includes(`UID:${migratedMon.calendarEventUid}`));
    assert.ok(icsA.includes('TZID=Africa/Cairo'));
    assert.ok(icsA.includes('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO'));
    assert.ok(icsA.includes('SUMMARY:Monday - 19:00 - Grade 8 A1'));

    let postCount = 0;
    let patchCount = 0;
    __setCalendarFetchForTesting(async (url, init) => {
      const u = String(url);
      if (init?.method === 'GET' && u.includes('privateExtendedProperty=')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'existing_gcal_evt_77',
                iCalUID: 'existing_gcal_evt_77@google.com',
                extendedProperties: { private: { gluckSessionId: migratedMon.id } }
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (init?.method === 'GET' && u.includes('/events/')) {
        return new Response('{}', { status: 404 });
      }
      if (u.includes('/events/existing_gcal_evt_77') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body || '{}'));
        assert.equal('iCalUID' in body, false, 'PATCH must NEVER send iCalUID');
        patchCount++;
        return new Response(
          JSON.stringify({
            id: 'existing_gcal_evt_77',
            iCalUID: 'existing_gcal_evt_77@google.com'
          }),
          { status: 200 }
        );
      }
      if (init?.method === 'POST') {
        postCount++;
        return new Response(JSON.stringify({ id: 'new_evt_unexpected' }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    const gcalSync = await syncSessionsToGoogleCalendar({
      allSessions: [migratedMon],
      accessToken: 'test_gcal_bearer_token'
    });
    assert.equal(gcalSync.success, true);
    assert.equal(patchCount, 1, 'Existing event matching privateExtendedProperty must be updated via PATCH');
    assert.equal(postCount, 0, 'Duplicate POST must NOT occur when existing event is found');
    assert.equal(gcalSync.sessions[0].googleCalendarEventId, 'existing_gcal_evt_77');
    assert.equal(gcalSync.sessions[0].googleCalendarIcalUid, 'existing_gcal_evt_77@google.com');
    assert.equal(gcalSync.sessions[0].calendarEventUid, migratedMon.calendarEventUid, 'Glück ICS UID must stay independent');
    __setCalendarFetchForTesting(null);

    // -------------------------------------------------------------------------
    // 7. ZERO SECRETS IN STORAGE, BACKUP, P2P DELTAS & FIRESTORE CHUNKS
    // -------------------------------------------------------------------------
    console.log('7. Testing secret stripping across storage, backup, P2P deltas & Firebase sync...');

    const dirtySession: any = {
      ...migratedMon,
      startUrl: 'https://zoom.us/s/999?zak=TOP_SECRET_ZAK',
      clientSecret: 'super_secret_zoom_key',
      zoomAccessToken: 'tok_secret',
      transcript: 'Raw sensitive transcript text'
    };
    const cleanedSession = sanitizeZoomRecordForStorage(dirtySession);
    assert.equal((cleanedSession as any).startUrl, undefined);
    assert.equal((cleanedSession as any).clientSecret, undefined);
    assert.equal((cleanedSession as any).zoomAccessToken, undefined);
    assert.equal((cleanedSession as any).transcript, undefined);

    const privacyStripped = sanitizeEntityForGrainPrivacy(dirtySession);
    assert.equal((privacyStripped as any).startUrl, undefined);
    assert.equal((privacyStripped as any).clientSecret, undefined);
    assert.equal((privacyStripped as any).transcript, undefined);

    assert.equal(redactZoomSecrets('Error https://zoom.us/s/1?zak=abc123SECRET').includes('abc123SECRET'), false);

    // Verify backup sanitization & Firestore partitioning include new collections cleanly & strip secrets
    const backupCheck = validateAndSanitizeBackupPayload({
      timestamp: new Date().toISOString(),
      groups: [groupV1],
      students: studentsList,
      lessons: [lessonMon],
      payments: [],
      groupWeeklySessions: [dirtySession],
      zoomMeetingRecords: resumedRes.records,
      zoomMeetingHistory: resumedRes.history,
      grainRecordingMatches: []
    });
    assert.equal(backupCheck.isValid, true);
    const sanitizedBackupSession = (backupCheck.sanitizedData as any).groupWeeklySessions[0];
    assert.equal(sanitizedBackupSession.startUrl, undefined);
    assert.equal(sanitizedBackupSession.clientSecret, undefined);

    const delta = buildOutboundDelta(
      'peer_1',
      {},
      {
        groupWeeklySessions: [dirtySession],
        zoomMeetingRecords: resumedRes.records,
        zoomMeetingHistory: resumedRes.history
      } as any,
      { id: 'dev_test', name: 'Test Device' },
      { forceFull: true }
    );
    assert.equal(delta.records.groupWeeklySessions?.length, 1);
    assert.equal((delta.records.groupWeeklySessions?.[0] as any).startUrl, undefined);
    assert.equal((delta.records.groupWeeklySessions?.[0] as any).clientSecret, undefined);

    const cloudPartition = partitionBackupPayload({
      timestamp: new Date().toISOString(),
      groups: [groupV1],
      students: studentsList,
      lessons: [lessonMon],
      payments: [],
      groupWeeklySessions: [dirtySession],
      zoomMeetingRecords: resumedRes.records,
      zoomMeetingHistory: resumedRes.history
    } as any);
    assert.equal(cloudPartition.core_crm.groupWeeklySessions.length, 1);
    assert.equal(cloudPartition.core_crm.groupWeeklySessions[0].startUrl, undefined);
    assert.equal(cloudPartition.core_crm.groupWeeklySessions[0].clientSecret, undefined);
    assert.equal(cloudPartition.core_crm.groupWeeklySessions[0].transcript, undefined);

    // -------------------------------------------------------------------------
    // 8. ANDROID NATIVE ZOOM SECURE BRIDGE, CLIPBOARD NORMALIZATION & DIAGNOSTICS
    // -------------------------------------------------------------------------
    console.log('8. Testing Android native ZoomSecureBridge, clipboard normalization & non-JSON diagnostics...');

    // 8a. Clipboard invisible Unicode / RTL mark / quote normalization
    assert.equal(
      normalizeZoomCredentialInput('\u200F "abc123\u200Bdef456" \u00A0'),
      'abc123def456',
      'normalizeZoomCredentialInput must strip RTL/zero-width/quote/whitespace artifacts'
    );

    // 8b. Non-JSON HTML 200 response (such as Capacitor static WebView fallback) must NOT return opaque generic error
    __setZoomProxyFetchForTesting(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      }
    }));
    const htmlErrRes = await connectZoomAccount({
      accountId: 'acc_12345678',
      clientId: 'cli_12345678',
      clientSecret: 'sec_1234567890'
    });
    assert.equal(htmlErrRes.ok, false);
    assert.ok(
      htmlErrRes.error?.includes('non-JSON response'),
      `Expected explicit non-JSON diagnostic error, got: ${htmlErrRes.error}`
    );

    // 8c. Full Android native ZoomSecureBridge lifecycle (no /api/zoom/* HTTP fetch needed!)
    __setZoomProxyFetchForTesting(null);
    let capturedAndroidConnectPayload: any = null;
    let capturedAndroidCreatePayload: any = null;
    let capturedAndroidPatchPayload: any = null;
    let androidDisconnected = false;

    __setZoomNativeTestAdapter({
      isAndroidNative: () => true,
      connect: async (opts) => {
        capturedAndroidConnectPayload = opts;
        return {
          ok: true,
          httpStatus: 200,
          saved: true,
          connected: true,
          maskedAccountId: 'acc••••••••5678',
          maskedClientId: 'cli••••••••5678',
          defaultTimezone: opts.defaultTimezone || 'Africa/Cairo',
          planType: 'basic',
          isBasicPlan: true,
          maxMeetingMinutes: 40,
          hostEmail: 'android-teacher@glueck.app'
        };
      },
      getStatus: async () => ({
        ok: true,
        httpStatus: 200,
        secureStorageAvailable: true,
        hasCredentials: !androidDisconnected,
        maskedAccountId: androidDisconnected ? null : 'acc••••••••5678',
        maskedClientId: androidDisconnected ? null : 'cli••••••••5678',
        defaultTimezone: 'Africa/Cairo',
        planType: 'basic',
        isBasicPlan: true,
        maxMeetingMinutes: 40,
        hostEmail: 'android-teacher@glueck.app'
      }),
      testConnection: async () => ({
        ok: true,
        httpStatus: 200,
        connected: true,
        planType: 'basic',
        isBasicPlan: true,
        maxMeetingMinutes: 40,
        hostEmail: 'android-teacher@glueck.app',
        defaultTimezone: 'Africa/Cairo'
      }),
      createMeeting: async (opts) => {
        capturedAndroidCreatePayload = opts;
        return {
          ok: true,
          httpStatus: 200,
          zoomMeetingId: '98765432109',
          joinUrl: 'https://zoom.us/j/98765432109?pwd=droid',
          startUrl: 'https://zoom.us/s/98765432109?zak=DROID_EPHEMERAL_ZAK',
          meetingPasscode: 'droid',
          topic: opts.topic,
          timezone: opts.timezone || 'Africa/Cairo',
          hostEmail: 'android-teacher@glueck.app',
          planWarning40Min: opts.duration >= 41
        };
      },
      updateMeeting: async (opts) => {
        capturedAndroidPatchPayload = opts;
        return {
          ok: true,
          httpStatus: 200,
          updated: true,
          zoomMeetingId: opts.meetingId,
          topic: opts.topic,
          planWarning40Min: opts.duration >= 41
        };
      },
      getMeeting: async (opts) => ({
        ok: true,
        httpStatus: 200,
        exists: true,
        zoomMeetingId: opts.meetingId,
        joinUrl: `https://zoom.us/j/${opts.meetingId}?pwd=droid`,
        startUrl: `https://zoom.us/s/${opts.meetingId}?zak=FRESH_DROID_ZAK`
      }),
      disconnect: async () => {
        androidDisconnected = true;
        return { ok: true, httpStatus: 200, disconnected: true, hasCredentials: false };
      }
    });

    assert.equal(detectZoomRuntime(), 'android', 'detectZoomRuntime must identify Android native runtime');

    const androidConnectRes = await connectZoomAccount({
      accountId: ' \u200Facc_12345678 ',
      clientId: '"cli_12345678"',
      clientSecret: 'sec_1234567890\u200B',
      defaultTimezone: 'Africa/Cairo'
    });
    assert.equal(androidConnectRes.ok, true, `Android connect failed: ${androidConnectRes.error}`);
    assert.equal(capturedAndroidConnectPayload.accountId, 'acc_12345678');
    assert.equal(capturedAndroidConnectPayload.clientId, 'cli_12345678');
    assert.equal(capturedAndroidConnectPayload.clientSecret, 'sec_1234567890');
    assert.equal(androidConnectRes.state.connected, true);
    assert.equal(androidConnectRes.state.hostEmail, 'android-teacher@glueck.app');

    const androidTestRes = await testZoomConnection();
    assert.equal(androidTestRes.ok, true);
    assert.equal(androidTestRes.state.isBasicPlan, true);

    const androidCreateRes = await createOrReplaceZoomMeetingForSession({
      session: { ...monSession, durationMinutes: 60 },
      sessions: [monSession],
      records: [],
      history: []
    });
    assert.equal(androidCreateRes.ok, true);
    assert.equal(capturedAndroidCreatePayload.duration, 60, 'Android Zoom bridge must preserve full 60m duration');
    assert.equal(capturedAndroidCreatePayload.waitingRoom, false, 'Android Zoom create must disable Waiting Room');
    assert.equal(androidCreateRes.updatedSession?.zoomMeetingId, '98765432109');

    const androidPatchRes = await updateZoomMeetingForSession({
      session: { ...androidCreateRes.updatedSession!, durationMinutes: 90 },
      sessions: androidCreateRes.sessions,
      records: androidCreateRes.records,
      history: androidCreateRes.history
    });
    assert.equal(androidPatchRes.ok, true);
    assert.equal(capturedAndroidPatchPayload.duration, 90, 'Android PATCH must send updated 90m duration');
    assert.equal(capturedAndroidPatchPayload.waitingRoom, false, 'Android PATCH must disable Waiting Room');

    const androidStartRes = await fetchHostStartUrlForSession('98765432109');
    assert.equal(androidStartRes.ok, true);
    assert.ok(androidStartRes.startUrl?.includes('FRESH_DROID_ZAK'));

    const androidDiscState = await disconnectZoomAccount();
    assert.equal(androidDiscState.connected, false);
    assert.equal(androidDisconnected, true);

    // 8d. Unimplemented native plugin in older APK must return actionable update guidance
    __setZoomNativeTestAdapter({
      isAndroidNative: () => true,
      connect: async () => {
        const err: any = new Error('Plugin "ZoomSecureBridge" is not implemented on android');
        err.code = 'UNIMPLEMENTED';
        throw err;
      }
    });
    const staleApkRes = await connectZoomAccount({
      accountId: 'acc_12345678',
      clientId: 'cli_12345678',
      clientSecret: 'sec_1234567890'
    });
    assert.equal(staleApkRes.ok, false);
    assert.ok(
      staleApkRes.error?.includes('ZoomSecureBridgePlugin'),
      `Expected actionable APK update error, got: ${staleApkRes.error}`
    );
    __setZoomNativeTestAdapter(null);

    // 8e. Static verification of native Android plugin registration & backup exclusions
    const rootDir = process.cwd();
    const zoomJava = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/java/com/glueck/app/ZoomSecureBridgePlugin.java'),
      'utf8'
    );
    assert.ok(zoomJava.includes('@CapacitorPlugin(name = "ZoomSecureBridge")'));
    assert.ok(zoomJava.includes('AndroidKeyStore'));
    assert.ok(zoomJava.includes('application/x-www-form-urlencoded'));
    assert.ok(zoomJava.includes('call.getBoolean("waitingRoom", false)'));
    assert.ok(zoomJava.includes('settings.put("waiting_room", waitingRoom)'));

    const mainActivityJava = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/java/com/glueck/app/MainActivity.java'),
      'utf8'
    );
    assert.ok(mainActivityJava.includes('registerPlugin(ZoomSecureBridgePlugin.class)'));

    const backupRulesXml = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/res/xml/backup_rules.xml'),
      'utf8'
    );
    assert.ok(backupRulesXml.includes('com.glueck.app.zoom_secure_vault.xml'));

    const dataExtractXml = fs.readFileSync(
      path.join(rootDir, 'android/app/src/main/res/xml/data_extraction_rules.xml'),
      'utf8'
    );
    assert.ok(dataExtractXml.includes('com.glueck.app.zoom_secure_vault.xml'));

    // -------------------------------------------------------------------------
    // 9. AUTOMATIC STANDARDIZED ZOOM LINK RESOLUTION FOR REMINDERS & PROJECTIONS
    // -------------------------------------------------------------------------
    console.log('9. Testing automatic standardized Zoom link resolution for reminders & projections...');

    const multiSlotGroup: Group = {
      id: 'grp_bana_multi',
      name: 'Bana Arwa Lojain',
      grade: 'Grade 6',
      type: 'online',
      lessonDurationMinutes: 60,
      monthlyPackagePrice: 1200,
      sessionCount: 4,
      color: '#6366F1',
      zoomLink: 'https://zoom.us/j/11111111111?pwd=OLD_DELETED_LINK',
      schedules: [
        { day: 'Monday', time: '16:00' },
        { day: 'Thursday', time: '17:30' }
      ]
    };

    const standardizedSessions: GroupWeeklySession[] = [
      {
        id: 'gws_bana_old_deleted',
        groupId: multiSlotGroup.id,
        groupNameSnapshot: multiSlotGroup.name,
        weekday: 4,
        weekdayName: 'Thursday',
        startTime: '17:30',
        durationMinutes: 60,
        timezone: DEFAULT_ZOOM_TIMEZONE,
        recurrence: 'weekly',
        sessionCode: 'BANA-THU-1730-OLD',
        standardizedTitle: 'Thursday - 17:30 - Bana Arwa Lojain',
        zoomMeetingId: '22222222222',
        zoomJoinUrl: 'https://zoom.us/j/22222222222?pwd=ARCHIVED',
        meetingSource: 'zoom_api',
        syncState: 'synced',
        calendarEventUid: generateStableCalendarUid('gws_bana_old_deleted'),
        updatedAt: Date.now() - 10000,
        deleted: true
      },
      {
        id: 'gws_bana_mon',
        groupId: multiSlotGroup.id,
        groupNameSnapshot: multiSlotGroup.name,
        weekday: 1,
        weekdayName: 'Monday',
        startTime: '16:00',
        durationMinutes: 60,
        timezone: DEFAULT_ZOOM_TIMEZONE,
        recurrence: 'weekly',
        sessionCode: 'BANA-MON-1600',
        standardizedTitle: 'Monday - 16:00 - Bana Arwa Lojain',
        zoomMeetingId: '88811112222',
        zoomJoinUrl: 'https://us05web.zoom.us/j/88811112222?pwd=NEW_MON',
        meetingSource: 'zoom_api',
        syncState: 'synced',
        calendarEventUid: generateStableCalendarUid('gws_bana_mon'),
        updatedAt: Date.now(),
        deleted: false
      },
      {
        id: 'gws_bana_thu',
        groupId: multiSlotGroup.id,
        groupNameSnapshot: multiSlotGroup.name,
        weekday: 4,
        weekdayName: 'Thursday',
        startTime: '17:30',
        durationMinutes: 60,
        timezone: DEFAULT_ZOOM_TIMEZONE,
        recurrence: 'weekly',
        sessionCode: 'BANA-THU-1730',
        standardizedTitle: 'Thursday - 17:30 - Bana Arwa Lojain',
        zoomMeetingId: '88833334444',
        zoomJoinUrl: 'https://us05web.zoom.us/j/88833334444?pwd=NEW_THU',
        meetingSource: 'zoom_api',
        syncState: 'synced',
        calendarEventUid: generateStableCalendarUid('gws_bana_thu'),
        updatedAt: Date.now(),
        deleted: false
      }
    ];

    // Thursday 2026-11-19 17:30 lesson carrying stale meetingLink MUST resolve to new Thursday link
    const staleThuLesson: Partial<Lesson> = {
      id: 'lesson_thu_stale',
      groupId: multiSlotGroup.id,
      date: '2026-11-19', // Thursday
      time: '17:30',
      type: 'online',
      meetingLink: 'https://zoom.us/j/11111111111?pwd=OLD_DELETED_LINK'
    };
    const resolvedThu = resolveActiveZoomLinkForLesson({
      group: multiSlotGroup,
      lesson: staleThuLesson,
      groupWeeklySessions: standardizedSessions,
    });
    assert.equal(
      resolvedThu,
      'https://us05web.zoom.us/j/88833334444?pwd=NEW_THU',
      'Thursday reminder must automatically use the new standardized Thursday Zoom link, not stale group/lesson link'
    );

    // Monday 2026-11-16 16:00 lesson MUST resolve to new Monday link
    const resolvedMon = resolveActiveZoomLinkForLesson({
      group: multiSlotGroup,
      lesson: { id: 'lesson_mon_stale', groupId: multiSlotGroup.id, date: '2026-11-16', time: '16:00', type: 'online', meetingLink: 'https://zoom.us/j/11111111111?pwd=OLD_DELETED_LINK' },
      groupWeeklySessions: standardizedSessions,
    });
    assert.equal(
      resolvedMon,
      'https://us05web.zoom.us/j/88811112222?pwd=NEW_MON',
      'Monday reminder must automatically use the new standardized Monday Zoom link'
    );

    // Group-only reminder (no lesson prop, only targetDay/targetTime) MUST resolve to that slot's new link
    const resolvedGroupOnly = resolveActiveZoomLinkForLesson({
      group: multiSlotGroup,
      groupWeeklySessions: standardizedSessions,
      targetDay: 'Do',
      targetTime: '17:30'
    });
    assert.equal(resolvedGroupOnly, 'https://us05web.zoom.us/j/88833334444?pwd=NEW_THU');

    // Legacy group without a canonical standardized session must not resurrect a stale legacy URL
    const resolvedLegacy = resolveActiveZoomLinkForLesson({
      group: { id: 'grp_legacy', type: 'online', zoomLink: 'https://zoom.us/j/55566677788' },
      groupWeeklySessions: standardizedSessions,
    });
    assert.equal(resolvedLegacy, '', 'Legacy group.zoomLink must not be used as a fallback');

    // Projected lessons automatically embed the exact per-slot standardized Zoom links
    const projectedRange = getProjectedLessonsForRange(
      '2026-11-16',
      '2026-11-22',
      [multiSlotGroup],
      [],
      'https://zoom.us/j/99999999999',
      standardizedSessions
    );
    const projMon = projectedRange.find((l) => l.date === '2026-11-16');
    const projThu = projectedRange.find((l) => l.date === '2026-11-19');
    assert.equal(projMon?.meetingLink, 'https://us05web.zoom.us/j/88811112222?pwd=NEW_MON');
    assert.equal(projThu?.meetingLink, 'https://us05web.zoom.us/j/88833334444?pwd=NEW_THU');

    console.log('✅ All Glück × Zoom × Grain V2.0 tests passed!');
  } finally {
    __setZoomNativeTestAdapter(null);
    __setZoomProxyFetchForTesting(null);
    __setZoomServerUpstreamFetchForTesting(null);
    __setCalendarFetchForTesting(null);
    __resetZoomServerVaultForTesting();
    server.close();
  }
}

runZoomGrainV2Tests().catch((err) => {
  console.error('❌ Zoom × Grain V2.0 Test Suite Failed:', err);
  process.exit(1);
});
