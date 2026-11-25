import assert from 'node:assert/strict';
import {
  buildAllMeetingsExportForAi,
  formatMeetingsExportJson,
  formatMeetingsExportMarkdown
} from '../services/aiMeetingExportService';
import { Group, GroupWeeklySession, Lesson, Student, ZoomMeetingRecord } from '../types';

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'grp-online-1',
    name: 'B1.1 Intensive',
    type: 'online',
    status: 'active',
    schedules: [{ day: 'Mo', time: '18:00' }],
    lessonDurationMinutes: 90,
    scheduleRecurrence: 'weekly',
    ...overrides
  } as Group;
}

async function runAiMeetingExportTests() {
  console.log('=== Starting P0 Full Meeting Data Export for AI Regression Suite ===');

  // Fixed Monday reference date: 2026-06-01 (Monday)
  const referenceDate = new Date(2026, 5, 1, 8, 0, 0, 0);

  const onlineGroup = makeGroup({
    id: 'grp-online-1',
    name: 'B1.1 Intensive',
    type: 'online',
    schedules: [
      { day: 'Mo', time: '18:00' },
      { day: 'Mi', time: '20:00' }
    ],
    lessonDurationMinutes: 90,
    scheduleRecurrence: 'weekly'
  });

  const biweeklyGroup = makeGroup({
    id: 'grp-biweekly-2',
    name: 'A2 Biweekly',
    type: 'online',
    schedules: [{ day: 'Di', time: '16:30' }],
    lessonDurationMinutes: 60,
    scheduleRecurrence: 'biweekly_a'
  });

  const offlineGroup = makeGroup({
    id: 'grp-offline-3',
    name: 'A1 Cairo Center',
    type: 'offline',
    address: 'Dokki Branch Room 4',
    schedules: [{ day: 'Do', time: '17:00' }],
    lessonDurationMinutes: 120,
    scheduleRecurrence: 'weekly'
  });

  const missingZoomGroup = makeGroup({
    id: 'grp-no-zoom-4',
    name: 'C1 Conversation',
    type: 'online',
    schedules: [{ day: 'Fr', time: '19:00' }],
    lessonDurationMinutes: 60,
    scheduleRecurrence: 'weekly'
  });

  const archivedGroup = makeGroup({
    id: 'grp-archived-5',
    name: 'Archived Old Group',
    type: 'online',
    status: 'archived',
    schedules: [{ day: 'Sa', time: '12:00' }]
  });

  const deletedGroup = makeGroup({
    id: 'grp-deleted-6',
    name: 'Deleted Group',
    type: 'online',
    deleted: true,
    schedules: [{ day: 'So', time: '12:00' }]
  });

  const students: Student[] = [
    { id: 'st-1', name: 'Ahmed Ali', groupId: 'grp-online-1' } as Student,
    { id: 'st-2', name: 'Sara Hassan', groupId: 'grp-online-1' } as Student,
    { id: 'st-3', name: 'Omar Nabil', groupId: 'grp-offline-3' } as Student,
    { id: 'st-4', name: 'Deleted Student', groupId: 'grp-online-1', deleted: true } as Student
  ];

  const weeklySessions: GroupWeeklySession[] = [
    {
      id: 'ws-mon-1800',
      sessionCode: 'B1G1-MON-1800',
      groupId: 'grp-online-1',
      groupNameSnapshot: 'B1.1 Intensive',
      weekday: 1,
      weekdayName: 'Monday',
      startTime: '18:00',
      durationMinutes: 90,
      timezone: 'Europe/Berlin',
      recurrence: 'weekly',
      standardizedTitle: 'Monday - 18:00 - B1.1 Intensive',
      calendarEventUid: 'gluck-session-ws-mon-1800@glueck.app',
      meetingSource: 'zoom_api',
      syncState: 'synced',
      zoomMeetingId: '88123456789',
      zoomJoinUrl: 'https://zoom.us/j/88123456789?pwd=xyz',
      zoomPasscode: 'PASS42',
      calendarSyncStatus: 'synced',
      version: 1,
      updatedAt: 1000
    }
  ];

  const zoomRecords: ZoomMeetingRecord[] = [
    {
      id: 'rec-1',
      sessionId: 'ws-mon-1800',
      groupId: 'grp-online-1',
      zoomMeetingId: '88123456789',
      topic: 'Monday - 18:00 - B1.1 Intensive',
      joinUrl: 'https://zoom.us/j/88123456789?pwd=xyz',
      meetingPasscode: 'PASS42',
      startTime: '18:00',
      durationMinutes: 90,
      meetingType: 8,
      recurrenceWeeklyDay: 2,
      timezone: 'Europe/Berlin',
      status: 'active',
      createdAt: 1000,
      updatedAt: 1000
    } as unknown as ZoomMeetingRecord
  ];

  const explicitLessons: Lesson[] = [
    // Edited recurring session (Monday 2026-06-08 moved from 18:00 to 19:15 with custom notes)
    {
      id: 'l_auto_grp-online-1_2026-06-08_1800',
      groupId: 'grp-online-1',
      groupName: 'B1.1 Intensive',
      title: 'B1.1 Exam Review (Rescheduled)',
      date: '2026-06-08',
      time: '19:15',
      durationMinutes: 90,
      type: 'online',
      status: 'scheduled',
      notes: 'Focus on Konjunktiv II'
    } as Lesson,
    // Cancelled recurring session (Wednesday 2026-06-03 20:00) -> must be excluded AND not projected
    {
      id: 'l_auto_grp-online-1_2026-06-03_2000',
      groupId: 'grp-online-1',
      groupName: 'B1.1 Intensive',
      title: 'Cancelled Class',
      date: '2026-06-03',
      time: '20:00',
      durationMinutes: 90,
      type: 'online',
      status: 'cancelled'
    } as Lesson,
    // Soft-deleted session (Thursday 2026-06-04 17:00) -> must be excluded AND not projected
    {
      id: 'l_auto_grp-offline-3_2026-06-04_1700',
      groupId: 'grp-offline-3',
      groupName: 'A1 Cairo Center',
      title: 'Deleted Offline Class',
      date: '2026-06-04',
      time: '17:00',
      durationMinutes: 120,
      type: 'offline',
      status: 'scheduled',
      deleted: true
    } as Lesson,
    // Explicit duplicate on Monday 2026-06-01 18:00 (must merge cleanly with projected slot, zero duplicate!)
    {
      id: 'l_manual_mon_dup',
      groupId: 'grp-online-1',
      groupName: 'B1.1 Intensive',
      title: 'B1.1 Intensive Explicit',
      date: '2026-06-01',
      time: '18:00',
      durationMinutes: 90,
      type: 'online',
      status: 'scheduled',
      notes: 'Explicitly tracked lesson'
    } as Lesson,
    // Past lesson before referenceDate -> excluded from upcoming export
    {
      id: 'l_past_1',
      groupId: 'grp-online-1',
      groupName: 'B1.1 Intensive',
      title: 'Past Session',
      date: '2026-05-25',
      time: '18:00',
      durationMinutes: 90,
      type: 'online',
      status: 'completed'
    } as Lesson
  ];

  // Export 14-day window (2026-06-01 to 2026-06-15)
  const payload = buildAllMeetingsExportForAi({
    groups: [onlineGroup, biweeklyGroup, offlineGroup, missingZoomGroup, archivedGroup, deletedGroup],
    lessons: explicitLessons,
    students,
    groupWeeklySessions: weeklySessions,
    zoomMeetingRecords: zoomRecords,
    profile: { defaultZoomTimezone: 'Africa/Cairo' },
    zoomHostEmail: 'host@glueck.app',
    referenceDate,
    horizonDays: 14,
    includeOffline: true
  });

  // 1. Structural JSON validation
  console.log('1. Validating structured JSON metadata and schema...');
  assert.equal(payload.formatVersion, 1);
  assert.equal(payload.timeZone, 'Africa/Cairo');
  assert.equal(payload.rangeStartDate, '2026-06-01');
  assert.equal(payload.rangeEndDate, '2026-06-15');
  assert.equal(payload.meetingCount, payload.meetings.length);
  assert.ok(payload.meetingCount >= 8, `Expected multiple projected recurring meetings, got ${payload.meetingCount}`);

  const jsonStr = formatMeetingsExportJson(payload);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.meetingCount, payload.meetingCount);
  assert.equal(parsed.meetings.length, payload.meetingCount);

  // 2. Duplicate prevention on 2026-06-01 18:00
  console.log('2. Verifying duplicate prevention and explicit session enrichment...');
  const june1Online = payload.meetings.filter(
    (m) => m.groupName === 'B1.1 Intensive' && m.date === '2026-06-01' && m.startTime === '18:00'
  );
  assert.equal(june1Online.length, 1, 'Explicit + projected lesson on same slot MUST NOT produce duplicates');
  assert.equal(june1Online[0].endTime, '19:30');
  assert.equal(june1Online[0].timeZone, 'Europe/Berlin', 'Session timezone must override default profile timezone');
  assert.equal(june1Online[0].zoomMeetingId, '88123456789');
  assert.equal(june1Online[0].zoomJoinUrl, 'https://zoom.us/j/88123456789?pwd=xyz');
  assert.equal(june1Online[0].zoomPasscode, 'PASS42');
  assert.equal(june1Online[0].zoomHostEmail, 'host@glueck.app');
  assert.equal(june1Online[0].sessionCode, 'B1G1-MON-1800');
  assert.equal(june1Online[0].studentName, 'Ahmed Ali, Sara Hassan', 'Deleted students must be excluded');
  assert.equal(june1Online[0].notes, 'Explicitly tracked lesson');

  // 3. Edited recurring session (2026-06-08 moved to 19:15, no duplicate at 18:00)
  console.log('3. Verifying edited recurring session preserves new time/notes without duplicating original slot...');
  const june8B1 = payload.meetings.filter((m) => m.groupName === 'B1.1 Intensive' && m.date === '2026-06-08');
  assert.equal(june8B1.length, 1, 'Edited recurring l_auto_ lesson must not also project an unedited duplicate');
  assert.equal(june8B1[0].startTime, '19:15');
  assert.equal(june8B1[0].endTime, '20:45');
  assert.equal(june8B1[0].notes, 'Focus on Konjunktiv II');

  // 4. Cancelled & deleted sessions excluded and NOT re-projected
  console.log('4. Verifying cancelled and deleted sessions/groups are excluded...');
  const cancelledSlot = payload.meetings.filter((m) => m.groupName === 'B1.1 Intensive' && m.date === '2026-06-03');
  assert.equal(cancelledSlot.length, 0, 'Cancelled session must be excluded and not re-projected');

  const deletedSlot = payload.meetings.filter((m) => m.groupName === 'A1 Cairo Center' && m.date === '2026-06-04');
  assert.equal(deletedSlot.length, 0, 'Deleted session must be excluded and not re-projected');

  assert.equal(
    payload.meetings.some((m) => m.groupName === 'Archived Old Group' || m.groupName === 'Deleted Group'),
    false,
    'Archived and deleted groups must be excluded'
  );
  assert.equal(
    payload.meetings.some((m) => m.date < '2026-06-01'),
    false,
    'Past lessons before referenceDate must be excluded'
  );

  // 5. Offline meeting next week (2026-06-11) has location and explicit null Zoom fields
  console.log('5. Verifying online + offline separation and explicit nulls for missing Zoom data...');
  const june11Offline = payload.meetings.find((m) => m.groupName === 'A1 Cairo Center' && m.date === '2026-06-11');
  assert.ok(june11Offline, 'Upcoming recurring offline meeting should be projected');
  assert.equal(june11Offline!.type, 'offline');
  assert.equal(june11Offline!.startTime, '17:00');
  assert.equal(june11Offline!.endTime, '19:00');
  assert.equal(june11Offline!.location, 'Dokki Branch Room 4');
  assert.equal(june11Offline!.studentName, 'Omar Nabil');
  assert.equal(june11Offline!.zoomMeetingId, null);
  assert.equal(june11Offline!.zoomJoinUrl, null);
  assert.equal(june11Offline!.zoomPasscode, null);
  assert.equal(june11Offline!.zoomHostEmail, null);

  // 6. Online group with missing Zoom data MUST emit explicit null (never fabricated!)
  const noZoomMeeting = payload.meetings.find((m) => m.groupName === 'C1 Conversation');
  assert.ok(noZoomMeeting, 'Online group without Zoom link must still be exported');
  assert.equal(noZoomMeeting!.type, 'online');
  assert.equal(noZoomMeeting!.timeZone, 'Africa/Cairo');
  assert.equal(noZoomMeeting!.zoomMeetingId, null);
  assert.equal(noZoomMeeting!.zoomJoinUrl, null);
  assert.equal(noZoomMeeting!.zoomPasscode, null);
  assert.equal(noZoomMeeting!.zoomHostEmail, null);
  assert.equal(noZoomMeeting!.location, null);

  // 7. Biweekly recurrence produces at most 1 occurrence across 14 days (alternating week A only)
  console.log('6. Verifying biweekly recurrence projection and includeOffline=false filter...');
  const biweeklyOccurrences = payload.meetings.filter((m) => m.groupName === 'A2 Biweekly');
  assert.equal(biweeklyOccurrences.length, 1, 'Biweekly group must project once in a 14-day window');
  assert.equal(biweeklyOccurrences[0].recurrence, 'biweekly_a');

  const onlineOnlyPayload = buildAllMeetingsExportForAi({
    groups: [onlineGroup, offlineGroup],
    lessons: [],
    referenceDate,
    horizonDays: 14,
    includeOffline: false
  });
  assert.equal(onlineOnlyPayload.meetings.some((m) => m.type === 'offline'), false);

  // 8. Markdown export generated from exact same dataset
  console.log('7. Verifying Markdown export matches JSON dataset...');
  const md = formatMeetingsExportMarkdown(payload);
  assert.ok(md.includes(`- Meeting Count: ${payload.meetingCount}`));
  assert.ok(md.includes('https://zoom.us/j/88123456789?pwd=xyz'));
  assert.ok(md.includes('Dokki Branch Room 4'));
  assert.ok(md.includes('Focus on Konjunktiv II'));

  console.log('ALL P0 FULL MEETING DATA EXPORT FOR AI TESTS PASSED!');
}

runAiMeetingExportTests().catch((err) => {
  console.error('AI meeting export tests failed:', err);
  process.exit(1);
});
