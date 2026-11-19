import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  Group,
  GroupWeeklySession,
  Lesson,
  Student,
  ZoomMeetingHistory,
  GrainDiscoveredRecording
} from '../types';
import {
  evaluateRecordingMatchAgainstLessons,
  detectGrainTwoPartRecordingPairs,
  applyAutomaticGrainMatchesAndTwoPartPairs,
  extractStructuredLessonContentForLesson,
  applyExtractedLessonContentToLesson,
  saveTeacherEditedGrainLessonContent,
  acceptPendingUpdatedLessonExtraction,
  dismissPendingUpdatedLessonExtraction,
  syncGrainRecordingsIncrementally,
  __setGrainServiceTestAdapter,
  saveGrainIntegrationMeta
} from '../services/grainService';
import {
  buildGrainLibraryEntries,
  computeGrainLibraryStats,
  filterGrainLibraryEntries
} from '../services/grainRecordingStatus';

function toLocalIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  return dt.toISOString();
}

// Lightweight in-memory window + localStorage shim for Node test execution
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    }
  };
}

async function runTests() {
  console.log('Running Grain Recordings Modernization Acceptance Tests...');
  let passed = 0;

  const groupA: Group = {
    id: 'grp_julia_a1',
    name: 'Julia Ali A1',
    grade: 'Grade 8',
    type: 'online',
    lessonDurationMinutes: 60,
    monthlyPackagePrice: 800,
    sessionCount: 8,
    color: '#6366F1',
    schedules: [
      { day: 'Monday', time: '16:00' },
      { day: 'Thursday', time: '18:00' }
    ]
  };

  const groupB: Group = {
    id: 'grp_julia_b1',
    name: 'Julia Ali B1',
    grade: 'Grade 10',
    type: 'online',
    lessonDurationMinutes: 60,
    monthlyPackagePrice: 900,
    sessionCount: 4,
    color: '#10B981',
    schedules: [{ day: 'Monday', time: '16:00' }]
  };

  const students: Student[] = [
    {
      id: 'stu_julia',
      name: 'Julia Ali',
      grade: 'Grade 8',
      parentName: 'Ali',
      parentPhone: '01011111111',
      studentPhone: '01022222222',
      groupId: groupA.id,
      paymentPlan: '4_lessons',
      documents: [],
      joinedDate: '2026-01-01'
    },
    {
      id: 'stu_omar',
      name: 'Omar Hassan',
      grade: 'Grade 10',
      parentName: 'Hassan',
      parentPhone: '01033333333',
      studentPhone: '01044444444',
      groupId: groupB.id,
      paymentPlan: '4_lessons',
      documents: [],
      joinedDate: '2026-01-01'
    }
  ];

  const sessions: GroupWeeklySession[] = [
    {
      id: 'sess_a_mon',
      groupId: groupA.id,
      groupNameSnapshot: groupA.name,
      weekday: 1,
      weekdayName: 'Monday',
      startTime: '16:00',
      durationMinutes: 60,
      timezone: 'Africa/Cairo',
      recurrence: 'weekly',
      sessionCode: 'JULIAA1-MON-1600',
      standardizedTitle: 'Monday - 16:00 - Julia Ali A1',
      zoomMeetingId: '81122334455',
      zoomJoinUrl: 'https://zoom.us/j/81122334455',
      meetingSource: 'zoom_api',
      syncState: 'synced',
      calendarEventUid: 'gluck-session-sess_a_mon@glueck.app',
      planWarning40Min: true,
      updatedAt: Date.now()
    },
    {
      id: 'sess_a_thu',
      groupId: groupA.id,
      groupNameSnapshot: groupA.name,
      weekday: 4,
      weekdayName: 'Thursday',
      startTime: '18:00',
      durationMinutes: 60,
      timezone: 'Africa/Cairo',
      recurrence: 'weekly',
      sessionCode: 'JULIAA1-THU-1800',
      standardizedTitle: 'Thursday - 18:00 - Julia Ali A1',
      zoomMeetingId: '89988776655',
      zoomJoinUrl: 'https://zoom.us/j/89988776655',
      meetingSource: 'zoom_api',
      syncState: 'synced',
      calendarEventUid: 'gluck-session-sess_a_thu@glueck.app',
      updatedAt: Date.now()
    },
    {
      id: 'sess_b_mon',
      groupId: groupB.id,
      groupNameSnapshot: groupB.name,
      weekday: 1,
      weekdayName: 'Monday',
      startTime: '16:00',
      durationMinutes: 60,
      timezone: 'Africa/Cairo',
      recurrence: 'weekly',
      sessionCode: 'JULIAB1-MON-1600',
      standardizedTitle: 'Monday - 16:00 - Julia Ali B1',
      zoomMeetingId: '85544332211',
      zoomJoinUrl: 'https://zoom.us/j/85544332211',
      meetingSource: 'zoom_api',
      syncState: 'synced',
      calendarEventUid: 'gluck-session-sess_b_mon@glueck.app',
      updatedAt: Date.now()
    }
  ];

  const zoomHistory: ZoomMeetingHistory[] = [
    {
      id: 'hist_a_mon_old',
      sessionId: 'sess_a_mon',
      groupId: groupA.id,
      action: 'cleanup_archived',
      previousZoomMeetingId: '70011223344',
      previousJoinUrl: 'https://zoom.us/j/70011223344',
      newZoomMeetingId: '81122334455',
      newJoinUrl: 'https://zoom.us/j/81122334455',
      previousTopic: 'Old Monday Room',
      newTopic: 'Monday - 16:00 - Julia Ali A1',
      recordedAt: '2026-10-01T10:00:00.000Z',
      updatedAt: Date.now()
    }
  ];

  const lessonAMon: Lesson = {
    id: 'les_a_mon',
    groupId: groupA.id,
    groupName: groupA.name,
    grade: 'Grade 8',
    title: 'Monday A1 Lesson',
    date: '2026-11-16',
    time: '16:00',
    durationMinutes: 60,
    type: 'online',
    status: 'scheduled',
    paymentStatus: 'pending',
    amountDue: 300,
    amountPaid: 0,
    sessionNumber: 1,
    totalSessionsInPackage: 4
  };

  const lessonAThu: Lesson = {
    id: 'les_a_thu',
    groupId: groupA.id,
    groupName: groupA.name,
    grade: 'Grade 8',
    title: 'Thursday A1 Lesson',
    date: '2026-11-19',
    time: '18:00',
    durationMinutes: 60,
    type: 'online',
    status: 'scheduled',
    paymentStatus: 'pending',
    amountDue: 300,
    amountPaid: 0,
    sessionNumber: 2,
    totalSessionsInPackage: 4
  };

  const lessonBMon: Lesson = {
    id: 'les_b_mon',
    groupId: groupB.id,
    groupName: groupB.name,
    grade: 'Grade 10',
    title: 'Monday B1 Lesson',
    date: '2026-11-16',
    time: '16:00',
    durationMinutes: 60,
    type: 'online',
    status: 'scheduled',
    paymentStatus: 'pending',
    amountDue: 350,
    amountPaid: 0,
    sessionNumber: 1,
    totalSessionsInPackage: 4
  };

  // =========================================================================
  // TEST 1: Automatic recognition via active Zoom meeting ID & zero Match/Confirm actions
  // =========================================================================
  {
    const rec: GrainDiscoveredRecording = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_std_active',
        title: 'Monday - 16:00 - Julia Ali A1',
        startDatetime: toLocalIso(2026, 11, 16, 16, 1),
        durationSeconds: 58 * 60,
        recordingUrl: 'https://grain.com/share/recording/std_active',
        sourcePlatform: 'zoom',
        zoomMeetingId: '81122334455',
        zoomMeetingUrl: 'https://zoom.us/j/81122334455',
        hasAiSummary: true
      },
      [lessonAMon, lessonBMon, lessonAThu],
      [groupA, groupB],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );

    assert.equal(rec.matchStatus, 'automatically_matched');
    assert.equal(rec.matchedGroupId, groupA.id);
    assert.equal(rec.matchedSessionId, 'sess_a_mon');
    assert.equal(rec.suggestedLessonId, lessonAMon.id);

    // Ensure applyAutomaticGrainMatchesAndTwoPartPairs preserves weeklySessions/zoomHistory & auto-links!
    const autoApplied = applyAutomaticGrainMatchesAndTwoPartPairs({
      recordings: [rec],
      lessons: [lessonAMon, lessonBMon, lessonAThu],
      groups: [groupA, groupB],
      students,
      learningRecords: [],
      weeklySessions: sessions,
      zoomMeetingHistory: zoomHistory
    });

    assert.ok(autoApplied.lessonPatches[lessonAMon.id], 'Standardized recording must auto-attach to lesson without confirmation');
    assert.equal(autoApplied.lessonPatches[lessonBMon.id], undefined, 'Must not confuse similarly named Group B');

    const entries = buildGrainLibraryEntries({
      recordings: autoApplied.recordings,
      lessons: autoApplied.updatedLessons,
      groups: [groupA, groupB],
      weeklySessions: sessions,
      zoomHistory
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].recognition.status, 'recognized');
    assert.equal(entries[0].recognition.group?.id, groupA.id);
    assert.equal(entries[0].recognition.session?.id, 'sess_a_mon');
    assert.equal(entries[0].primaryAction, 'view_details');
    assert.equal(entries[0].lifecycleStatus, 'ai_notes_available');
    assert.ok(!entries[0].secondaryActions.includes('match' as any));
    assert.ok(!entries[0].secondaryActions.includes('confirm' as any));
    passed++;
    console.log('✓ Test 1: Standardized Zoom meeting auto-recognizes group & session with zero Match/Confirm actions');
  }

  // =========================================================================
  // TEST 2: Historical recordings remain recognizable through archived Zoom IDs
  // =========================================================================
  {
    const histEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_hist_old',
        title: 'Old Monday Room Recording',
        startDatetime: toLocalIso(2026, 11, 16, 16, 2),
        durationSeconds: 55 * 60,
        recordingUrl: 'https://grain.com/share/recording/hist_old',
        sourcePlatform: 'zoom',
        zoomMeetingId: '70011223344',
        zoomMeetingUrl: 'https://zoom.us/j/70011223344'
      },
      [lessonAMon, lessonBMon],
      [groupA, groupB],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );

    assert.equal(histEval.matchStatus, 'automatically_matched');
    assert.equal(histEval.matchedGroupId, groupA.id);
    assert.equal(histEval.matchedSessionId, 'sess_a_mon');
    assert.equal(histEval.evidence?.matchedFromHistory, true);

    const entries = buildGrainLibraryEntries({
      recordings: [histEval],
      lessons: [lessonAMon, lessonBMon],
      groups: [groupA, groupB],
      weeklySessions: sessions,
      zoomHistory
    });
    assert.equal(entries[0].recognition.status, 'recognized');
    assert.equal(entries[0].recognition.source, 'historical_zoom_id');
    passed++;
    console.log('✓ Test 2: Historical recordings recognized automatically via archived ZoomMeetingHistory');
  }

  // =========================================================================
  // TEST 3: Conflicting identifiers & student-names-only never auto-assign (Review Required only)
  // =========================================================================
  {
    // Case 3a: Zoom ID belongs to Group A, standardized topic says Group B -> conflicting identifiers!
    const conflictEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_conflict',
        title: 'Monday - 16:00 - Julia Ali B1',
        startDatetime: toLocalIso(2026, 11, 16, 16, 0),
        durationSeconds: 50 * 60,
        recordingUrl: 'https://grain.com/share/recording/conflict',
        sourcePlatform: 'zoom',
        zoomMeetingId: '81122334455',
        zoomMeetingUrl: 'https://zoom.us/j/81122334455'
      },
      [lessonAMon, lessonBMon],
      [groupA, groupB],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );

    assert.notEqual(conflictEval.matchStatus, 'automatically_matched', 'Conflicting identifiers must NEVER auto-match');

    // Case 3b: Student name alone (wrong date/time OR without standardized Zoom/topic identity) must NEVER auto-assign
    const studentNameOnlyEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_student_only',
        title: 'Quick chat with Julia Ali',
        startDatetime: toLocalIso(2026, 11, 16, 16, 0),
        durationSeconds: 30 * 60,
        recordingUrl: 'https://grain.com/share/recording/student_only',
        sourcePlatform: 'zoom',
        participantNames: ['Julia Ali']
      },
      [lessonAMon, lessonBMon],
      [groupA, groupB],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );
    assert.notEqual(studentNameOnlyEval.matchStatus, 'automatically_matched', 'Student names alone must NEVER auto-assign');

    const entries = buildGrainLibraryEntries({
      recordings: [conflictEval, studentNameOnlyEval],
      lessons: [lessonAMon, lessonBMon],
      groups: [groupA, groupB],
      weeklySessions: sessions,
      zoomHistory
    });

    for (const e of entries) {
      assert.equal(e.recognition.status, 'review_required');
      assert.equal(e.lifecycleStatus, 'review_required');
      assert.equal(e.primaryAction, 'resolve_issue');
      assert.ok(e.recognition.reviewReasonDetail && e.recognition.reviewReasonDetail.length > 10);
    }
    passed++;
    console.log('✓ Test 3: Conflicting identifiers & student-name-only recordings require review and never auto-assign');
  }

  // =========================================================================
  // TEST 4: Multiple weekly sessions of the same group stay distinguishable
  // =========================================================================
  {
    const thuEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_thu_sess',
        title: 'Thursday - 18:00 - Julia Ali A1',
        startDatetime: toLocalIso(2026, 11, 19, 18, 1),
        durationSeconds: 58 * 60,
        recordingUrl: 'https://grain.com/share/recording/thu_sess',
        sourcePlatform: 'zoom',
        zoomMeetingId: '89988776655',
        zoomMeetingUrl: 'https://zoom.us/j/89988776655'
      },
      [lessonAMon, lessonAThu],
      [groupA],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );
    assert.equal(thuEval.matchStatus, 'automatically_matched');
    assert.equal(thuEval.matchedSessionId, 'sess_a_thu');
    assert.equal(thuEval.suggestedLessonId, lessonAThu.id);

    // Wrong session Zoom ID (Monday's ID) on Thursday's lesson must be flagged as conflict, NOT auto-matched to Thursday!
    const wrongSessionEval = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_wrong_slot',
        title: 'Thursday - 18:00 - Julia Ali A1',
        startDatetime: toLocalIso(2026, 11, 19, 18, 1),
        durationSeconds: 58 * 60,
        recordingUrl: 'https://grain.com/share/recording/wrong_slot',
        sourcePlatform: 'zoom',
        zoomMeetingId: '81122334455', // Monday's Zoom ID on Thursday!
        zoomMeetingUrl: 'https://zoom.us/j/81122334455'
      },
      [lessonAMon, lessonAThu],
      [groupA],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );
    assert.notEqual(wrongSessionEval.matchStatus, 'automatically_matched');
    passed++;
    console.log('✓ Test 4: Multiple weekly sessions of the same group remain cleanly distinguishable');
  }

  // =========================================================================
  // TEST 5: Part 1 / Pending Part 2 -> Part 2 arrival -> 2 segments paired + 7-section extraction + teacher edit protection
  // =========================================================================
  {
    const p1 = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_split_p1',
        title: 'Monday - 16:00 - Julia Ali A1',
        startDatetime: toLocalIso(2026, 11, 16, 16, 0),
        durationSeconds: 40 * 60,
        recordingUrl: 'https://grain.com/share/recording/split_p1',
        sourcePlatform: 'zoom',
        zoomMeetingId: '81122334455',
        zoomMeetingUrl: 'https://zoom.us/j/81122334455'
      },
      [lessonAMon],
      [groupA],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );

    const step1Auto = applyAutomaticGrainMatchesAndTwoPartPairs({
      recordings: [p1],
      lessons: [lessonAMon],
      groups: [groupA],
      students,
      learningRecords: [],
      weeklySessions: sessions,
      zoomMeetingHistory: zoomHistory
    });

    const entriesPendingP2 = buildGrainLibraryEntries({
      recordings: step1Auto.recordings,
      lessons: step1Auto.updatedLessons,
      groups: [groupA],
      weeklySessions: sessions,
      zoomHistory
    });
    assert.equal(entriesPendingP2.length, 1);
    assert.equal(entriesPendingP2[0].lifecycleStatus, 'pending_part2', '40m Part 1 of 60m lesson must show Pending Part 2');
    assert.equal(entriesPendingP2[0].primaryAction, 'view_progress');
    assert.equal(entriesPendingP2[0].segmentCount, 1);

    // Teacher edits Part 1 extraction first
    const ext1 = await extractStructuredLessonContentForLesson({
      lesson: step1Auto.updatedLessons[0],
      recordings: step1Auto.recordings,
      providedPart1Transcript:
        'Thema: Perfekt im Alltag. Neue Wörter: der Bahnhof, fahren. Beispiel: Ich bin nach Berlin gefahren.'
    });
    const app1 = applyExtractedLessonContentToLesson(step1Auto.updatedLessons[0], ext1);
    let workingLesson: Lesson = { ...step1Auto.updatedLessons[0], ...app1.lessonPatch };

    const teacherEditPatch = saveTeacherEditedGrainLessonContent(workingLesson, {
      themaDerStunde: 'Perfekt — Eigene Notizen des Lehrers'
    });
    workingLesson = { ...workingLesson, ...teacherEditPatch };
    assert.equal(workingLesson.grainMeta?.extractedLessonContent?.teacherEdited, true);

    // Part 2 arrives 42 minutes later!
    const p2 = evaluateRecordingMatchAgainstLessons(
      {
        id: 'rec_split_p2',
        title: 'Monday - 16:00 - Julia Ali A1',
        startDatetime: toLocalIso(2026, 11, 16, 16, 42),
        durationSeconds: 22 * 60,
        recordingUrl: 'https://grain.com/share/recording/split_p2',
        sourcePlatform: 'zoom',
        zoomMeetingId: '81122334455',
        zoomMeetingUrl: 'https://zoom.us/j/81122334455'
      },
      [workingLesson],
      [groupA],
      students,
      [],
      undefined,
      sessions,
      zoomHistory
    );

    const step2Auto = applyAutomaticGrainMatchesAndTwoPartPairs({
      recordings: [...step1Auto.recordings, p2],
      lessons: [workingLesson],
      groups: [groupA],
      students,
      learningRecords: [],
      weeklySessions: sessions,
      zoomMeetingHistory: zoomHistory
    });

    workingLesson = step2Auto.updatedLessons[0];
    assert.equal(workingLesson.recordingLink, 'https://grain.com/share/recording/split_p1');
    assert.equal(workingLesson.recordingLink2, 'https://grain.com/share/recording/split_p2');

    // Reprocess combined Part 1 + Part 2 -> teacher edits MUST remain protected and pendingUpdatedExtraction queued!
    const ext2 = await extractStructuredLessonContentForLesson({
      lesson: workingLesson,
      recordings: step2Auto.recordings,
      providedPart1Transcript:
        'Thema: Perfekt im Alltag. Neue Wörter: der Bahnhof, fahren. Beispiel: Ich bin nach Berlin gefahren.',
      providedPart2Transcript:
        'Grammatik: Dativ mit dem Zug. Übung: Dialog am Bahnhof. Hausaufgabe: Arbeitsbuch Seite 18.'
    });
    const app2 = applyExtractedLessonContentToLesson(workingLesson, ext2);
    assert.equal(app2.preservedTeacherEdits, true);
    workingLesson = { ...workingLesson, ...app2.lessonPatch };
    assert.equal(
      workingLesson.grainMeta?.extractedLessonContent?.themaDerStunde,
      'Perfekt — Eigene Notizen des Lehrers',
      'Teacher-edited content must NEVER be overwritten automatically'
    );
    assert.ok(
      workingLesson.grainMeta?.extractedLessonContent?.pendingUpdatedExtraction,
      'Pending updated extraction must be queued for teacher review'
    );

    const entriesPaired = buildGrainLibraryEntries({
      recordings: step2Auto.recordings,
      lessons: [workingLesson],
      groups: [groupA],
      weeklySessions: sessions,
      zoomHistory
    });

    assert.equal(entriesPaired.length, 1, 'Part 1 and Part 2 must collapse into ONE logical lesson entry (zero duplicates)');
    assert.equal(entriesPaired[0].segmentCount, 2);
    assert.equal(entriesPaired[0].totalDurationMinutes, 62);
    assert.equal(entriesPaired[0].lifecycleStatus, 'lesson_extraction_completed');
    assert.equal(entriesPaired[0].extraction.teacherEdited, true);
    assert.equal(entriesPaired[0].extraction.hasPendingUpdatedExtraction, true);

    // Dismiss & Accept pending update both preserve attendance and work cleanly
    const dismissedPatch = dismissPendingUpdatedLessonExtraction(workingLesson);
    assert.equal(dismissedPatch.grainMeta?.extractedLessonContent?.pendingUpdatedExtraction, undefined);
    assert.equal(
      dismissedPatch.grainMeta?.extractedLessonContent?.themaDerStunde,
      'Perfekt — Eigene Notizen des Lehrers'
    );

    const acceptedPatch = acceptPendingUpdatedLessonExtraction(workingLesson);
    assert.equal(acceptedPatch.grainMeta?.extractedLessonContent?.pendingUpdatedExtraction, undefined);
    assert.equal(acceptedPatch.grainMeta?.extractedLessonContent?.teacherEdited, true);
    passed++;
    console.log('✓ Test 5: Pending Part 2, 2-segment pairing without duplicates, 7-section extraction & teacher-edit protection');
  }

  // =========================================================================
  // TEST 6: Processing failures, retry actions, search, filters, stats & 500-recording performance
  // =========================================================================
  {
    const syntheticRecordings: GrainDiscoveredRecording[] = [];
    const syntheticLessons: Lesson[] = [];
    for (let i = 0; i < 500; i++) {
      const day = (i % 28) + 1;
      const month = ((Math.floor(i / 28) % 11) + 1);
      const ymd = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const lesId = `perf_les_${i}`;
      const recId = `perf_rec_${i}`;
      const isExtracted = i % 3 === 0;
      const isReview = i % 10 === 1;
      const isFailed = i % 25 === 2;

      syntheticLessons.push({
        id: lesId,
        groupId: i % 2 === 0 ? groupA.id : groupB.id,
        groupName: i % 2 === 0 ? groupA.name : groupB.name,
        grade: 'Grade 8',
        title: `Lektion ${i}`,
        date: ymd,
        time: '16:00',
        durationMinutes: 60,
        type: 'online',
        status: 'completed',
        paymentStatus: 'paid',
        amountDue: 300,
        amountPaid: 300,
        sessionNumber: 1,
        totalSessionsInPackage: 4,
        ...(isExtracted
          ? {
              grainMeta: {
                recordingId: recId,
                recordingTitle: `Monday - 16:00 - ${i % 2 === 0 ? groupA.name : groupB.name}`,
                startTimestamp: `${ymd}T16:00:00.000Z`,
                durationMinutes: 58,
                recordingUrl: `https://grain.com/share/recording/${recId}`,
                source: 'zoom',
                matchingStatus: 'confirmed',
                confirmedLessonId: lesId,
                lastSyncedAt: '2026-11-16T17:00:00.000Z',
                extractedLessonContent: {
                  themaDerStunde: `Thema ${i}`,
                  behandelteInhalte: ['Dialog'],
                  neueWoerterUndRedemittel: [],
                  grammatik: [],
                  beispiele: [],
                  uebungenUndAktivitaeten: [],
                  offenePunkte: [],
                  formattedLessonSummaryDe: `Thema ${i}`,
                  sourceRecordingIds: [recId],
                  partCount: 1,
                  sourceContentFingerprint: `fp_${i}`,
                  extractedAt: '2026-11-16T17:00:00.000Z',
                  origin: 'grain_transcript_and_notes',
                  sourceKinds: ['transcript', 'ai_notes'],
                  transcriptStatus: 'complete'
                }
              }
            }
          : {})
      });

      syntheticRecordings.push({
        id: recId,
        title: `Monday - 16:00 - ${i % 2 === 0 ? groupA.name : groupB.name} #${i}`,
        startDatetime: `${ymd}T16:00:00.000Z`,
        durationSeconds: 58 * 60,
        durationMinutes: 58,
        recordingUrl: isFailed ? '' : `https://grain.com/share/recording/${recId}`,
        sourcePlatform: 'zoom',
        matchStatus: isFailed ? 'inaccessible' : isReview ? 'multiple_possible_lessons' : 'already_linked',
        confirmedLessonId: isFailed || isReview ? undefined : lesId,
        matchedGroupId: isFailed || isReview ? undefined : i % 2 === 0 ? groupA.id : groupB.id,
        confidenceScore: isFailed || isReview ? 0 : 100,
        matchReasons: isReview ? ['Multiple overlapping lessons'] : [],
        candidates: [],
        lastSyncedAt: '2026-11-16T17:00:00.000Z'
      });
    }

    const t0 = Date.now();
    const entries = buildGrainLibraryEntries({
      recordings: syntheticRecordings,
      lessons: syntheticLessons,
      groups: [groupA, groupB],
      weeklySessions: sessions,
      zoomHistory,
      failedRecordingErrors: { perf_rec_3: 'Temporary Grain network timeout' }
    });
    const stats = computeGrainLibraryStats(entries);
    const completedOnly = filterGrainLibraryEntries(entries, { statusFilter: 'completed' });
    const reviewOnly = filterGrainLibraryEntries(entries, { statusFilter: 'review_required' });
    const failedOnly = filterGrainLibraryEntries(entries, { statusFilter: 'processing_failed' });
    const searchHit = filterGrainLibraryEntries(entries, { searchQuery: '#499' });
    const groupAHits = filterGrainLibraryEntries(entries, { groupFilter: groupA.id });
    const elapsedMs = Date.now() - t0;

    assert.equal(entries.length, 500);
    assert.equal(stats.total, 500);
    assert.equal(completedOnly.length, stats.completed);
    assert.equal(reviewOnly.length, stats.reviewRequired);
    assert.equal(failedOnly.length, stats.failed);
    assert.equal(searchHit.length, 1);
    assert.ok(groupAHits.length > 0 && groupAHits.every((e) => e.recognition.group?.id === groupA.id));
    const failedEntry = entries.find((e) => e.id === 'perf_rec_3')!;
    assert.equal(failedEntry.lifecycleStatus, 'processing_failed');
    assert.equal(failedEntry.primaryAction, 'retry');
    assert.ok(failedEntry.secondaryActions.includes('retry_processing'));
    assert.ok(elapsedMs < 500, `Expected 500-recording library processing < 500ms, took ${elapsedMs}ms`);
    passed++;
    console.log(`✓ Test 6: 500-recording scale, filters, stats & retry status verified in ${elapsedMs}ms`);
  }

  // =========================================================================
  // TEST 7: syncGrainRecordingsIncrementally forwards standardized weeklySessions end-to-end
  // =========================================================================
  {
    saveGrainIntegrationMeta({ enabled: true, hasToken: true, connected: true });
    __setGrainServiceTestAdapter({
      runtime: 'web',
      executeOperation: async (req) => {
        if (req.operation === 'list_recordings') {
          return {
            ok: true,
            httpStatus: 200,
            bodyText: JSON.stringify({
              recordings: [
                {
                  id: 'sync_std_1',
                  title: 'Monday - 16:00 - Julia Ali A1',
                  start_datetime: toLocalIso(2026, 11, 16, 16, 0),
                  duration_seconds: 55 * 60,
                  share_url: 'https://grain.com/share/recording/sync_std_1',
                  share_state: 'public',
                  source: 'zoom',
                  zoom_meeting_url: 'https://zoom.us/j/81122334455',
                  ai_summary: 'Thema: Perfekt. Neue Wörter: lernen.'
                }
              ]
            })
          };
        }
        return { ok: false, httpStatus: 404, bodyText: '{}' };
      }
    });

    const patchedLessons: Record<string, Partial<Lesson>> = {};
    const syncRes = await syncGrainRecordingsIncrementally({
      lessons: [lessonAMon, lessonBMon],
      groups: [groupA, groupB],
      students,
      weeklySessions: sessions,
      zoomMeetingHistory: zoomHistory,
      autoExtractContent: false,
      onUpdateLesson: (id, patch) => {
        patchedLessons[id] = patch;
      }
    });

    __setGrainServiceTestAdapter(null);
    assert.equal(syncRes.success, true);
    assert.ok(patchedLessons[lessonAMon.id], 'syncGrainRecordingsIncrementally must auto-link standardized Zoom meeting');
    assert.equal(patchedLessons[lessonBMon.id], undefined);
    passed++;
    console.log('✓ Test 7: syncGrainRecordingsIncrementally end-to-end auto-recognition with standardized Zoom sessions');
  }

  // =========================================================================
  // TEST 8: Source-code audit ensuring obsolete manual matching & Smart Group Learning UI are removed
  // =========================================================================
  {
    const viewSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GrainRecordingsLibraryView.tsx'),
      'utf8'
    );
    assert.ok(!viewSrc.includes('showLearnedRulesPanel'), 'Smart Group Learning panel state must be removed');
    assert.ok(!viewSrc.includes('setGrainLearningRuleEnabled'), 'Smart Group Learning rule controls must be removed');
    assert.ok(!viewSrc.includes('Learned Recurring Matching Rules'), 'Smart Group Learning UI text must be removed');
    assert.ok(!viewSrc.includes('renderMatchStatusBadge'), 'Old confidence/match badge renderer must be removed');
    assert.ok(!viewSrc.includes('Confirm Match'), 'Manual Confirm Match button must be removed');
    assert.ok(!viewSrc.includes('Has Smart Suggestions'), 'Obsolete matching filter must be removed');
    assert.ok(viewSrc.includes('env(safe-area-inset-bottom'), 'Safe-area bottom inset padding must be present');
    assert.ok(viewSrc.includes('md:hidden'), 'Dedicated mobile single-column list layout must be present');
    assert.ok(viewSrc.includes('hidden md:block'), 'Dedicated tablet/desktop structured table must be present');
    passed++;
    console.log('✓ Test 8: UI source audit confirmed zero obsolete Match/Confirm or Smart Group Learning UI');
  }

  console.log(`\nALL ${passed}/8 GRAIN RECORDINGS MODERNIZATION ACCEPTANCE TESTS PASSED!`);
}

runTests().catch((err) => {
  console.error('Grain Recordings Modernization test failed:', err);
  process.exit(1);
});
