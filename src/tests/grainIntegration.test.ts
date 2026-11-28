import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  redactGrainSecrets,
  normalizeGrainPersonalTokenInput,
  normalizeZoomMeetingUrl,
  isGrainRecordingUrl,
  classifyGrainRecordingShareAccess,
  isParentReadyPublicGrainLink,
  getLessonRecordingShareClassification,
  buildCanonicalGrainRequestBody,
  runGrainRecordingDiscoveryDiagnostics,
  evaluateRecordingMatchAgainstLessons,
  recordConfirmedGrainGroupLearning,
  loadGrainGroupLearningRecords,
  saveGrainGroupLearningRecords,
  sortLessonsNewestFirst,
  buildMultiLessonParentReportData,
  prepareConfirmedGrainLessonAttachment,
  assertLessonAttendanceUnchanged,
  sanitizeGrainSummaryForParentReport,
  sanitizeGrainLessonMetadata,
  sanitizeEntityForGrainPrivacy,
  generateEducationalDraftForRecording,
  buildLernstudioDraftFromGrainEducationalDraft,
  getTranscriptEphemerally,
  getEphemeralTranscriptCacheSizeForTesting,
  clearEphemeralTranscriptCache,
  saveGrainPersonalToken,
  testAndProbeGrainConnection,
  disconnectGrainAccount,
  refreshGrainRuntimeStatus,
  syncGrainRecordingsIncrementally,
  detectGrainTwoPartRecordingPairs,
  applyAutomaticGrainMatchesAndTwoPartPairs,
  correctGrainRecordingAssignment,
  setGrainLearningRuleEnabled,
  deleteGrainLearningRule,
  extractStructuredLessonContentForLesson,
  applyExtractedLessonContentToLesson,
  saveTeacherEditedGrainLessonContent,
  acceptPendingUpdatedLessonExtraction,
  __setGrainServiceTestAdapter
} from '../services/grainService';
import {
  buildWhitelistedGrainTarget,
  normalizeServerGrainTokenInput,
  encryptGrainTokenForVault,
  decryptGrainTokenFromVault,
  createLocalTeacherSessionToken,
  verifyLocalTeacherSessionToken,
  revokeGrainSessionsForUser,
  isStrictLoopbackRequest,
  __setGrainServerUpstreamFetchForTesting
} from '../server/grainServerProxy';
import { buildOutboundDelta } from '../services/sync/deltaBuilder';
import { partitionBackupPayload, mergeDeltaPayloads } from '../services/firebaseWorkspaceSync';
import { validateAndSanitizeBackupPayload } from '../utils/backupEngine';
import { Lesson, Group, Student } from '../types';

async function runGrainIntegrationTests() {
  console.log('=== Starting Glück × Grain Integration Verification Suite ===');

  // ---------------------------------------------------------------------------
  // 1. SECURITY TESTS
  // ---------------------------------------------------------------------------
  console.log('1. Testing Secret Redaction, Proxy Whitelisting, and Secure Token Isolation...');

  const fakePat = 'grain_pat_SecretTokenValue1234567890ABCDEF';
  const logInput = `Failed request with Authorization: Bearer ${fakePat} and raw ${fakePat}`;
  const redacted = redactGrainSecrets(logInput);
  assert.equal(redacted.includes(fakePat), false, 'Raw Grain PAT must be redacted from logs');
  assert.equal(redacted.includes('grain_pat_[REDACTED]'), true, 'Redacted placeholder must appear');

  // Verify token input normalization handles RTL/zero-width marks, Bearer prefix, quotes, and soft line wraps
  assert.equal(
    normalizeGrainPersonalTokenInput(`\u200F\u200B  "Bearer ${fakePat}" \u200E\n`),
    fakePat,
    'Client token normalizer must strip RTL/zero-width marks, quotes, and Bearer prefix'
  );
  assert.equal(
    normalizeServerGrainTokenInput(`Authorization: Bearer \u200F${fakePat}\u200B`),
    fakePat,
    'Server token normalizer must strip Authorization: Bearer prefix and directional marks'
  );
  assert.equal(
    normalizeGrainPersonalTokenInput('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\n  eyJzdWIiOiIxMjM0NTY3ODkwIn0.\n  c2lnbmF0dXJl_123'),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl_123',
    'Token normalizer must strip accidental line-wrap spaces from non-prefixed tokens'
  );

  // Verify no VITE_GRAIN token in .env.example
  const envExample = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
  assert.equal(
    envExample.includes('VITE_GRAIN'),
    false,
    '.env.example must never define a client-exposed VITE_GRAIN variable'
  );

  // Verify AES-256-GCM server vault encryption & decryption
  const vaultEntry = encryptGrainTokenForVault(fakePat);
  assert.equal(vaultEntry.ciphertextB64.includes(fakePat), false);
  assert.equal(vaultEntry.maskedToken.includes(fakePat), false);
  assert.equal(decryptGrainTokenFromVault(vaultEntry), fakePat);

  // Verify HMAC session token verification
  const sessionTok = createLocalTeacherSessionToken('dev_teacher_1');
  const verifiedSession = verifyLocalTeacherSessionToken(sessionTok);
  assert.equal(verifiedSession.valid, true);
  assert.equal(verifiedSession.uid, 'local_dev_teacher_1');

  // Verify server proxy strict operation whitelist & SSRF prevention
  const tokenInfoTarget = buildWhitelistedGrainTarget({ operation: 'token_info' });
  assert.equal(tokenInfoTarget.valid, true);
  assert.equal(tokenInfoTarget.url, 'https://api.grain.com/_/public-api/v2/token-info');
  assert.equal(tokenInfoTarget.method, 'GET');

  const listTarget = buildWhitelistedGrainTarget({
    operation: 'list_recordings',
    bodyPayload: {
      cursor: 'cur_123',
      filter: { after_datetime: '2026-11-15T00:00:00Z', title_search: 'Deutsch A1' },
      include: { participants: true, ai_summary: true, calendar_event: true }
    }
  });
  assert.equal(listTarget.valid, true);
  assert.equal(listTarget.url, 'https://api.grain.com/_/public-api/v2/recordings');
  assert.equal(listTarget.method, 'POST');
  assert.equal(JSON.parse(listTarget.bodyString || '{}').cursor, 'cur_123');

  const arbitraryUrlAttempt = buildWhitelistedGrainTarget({
    operation: 'token_info',
    rawRequestBody: { url: 'https://evil.example.com/steal' }
  });
  assert.equal(arbitraryUrlAttempt.valid, false, 'Server proxy must reject arbitrary url overrides');
  assert.equal(arbitraryUrlAttempt.code, 'ARBITRARY_URL_FORBIDDEN');

  const traversalAttempt = buildWhitelistedGrainTarget({
    operation: 'recording_details',
    recordingId: '../admin/secret'
  });
  assert.equal(traversalAttempt.valid, false, 'Server proxy must reject path traversal in recordingId');
  assert.equal(traversalAttempt.code, 'INVALID_RECORDING_ID');

  // Test runtime adapter never returns raw token to renderer/WebView
  let storedEncryptedSecret: string | null = null;
  __setGrainServiceTestAdapter({
    runtime: 'electron',
    secureStorageAvailable: true,
    getStatus: async () => ({
      supported: true,
      secureStorageAvailable: true,
      hasToken: Boolean(storedEncryptedSecret),
      maskedToken: storedEncryptedSecret ? 'grain_pat_••••••••CDEF' : null
    }),
    saveToken: async (token) => {
      storedEncryptedSecret = `ENC(${token})`;
      return {
        saved: true,
        hasToken: true,
        maskedToken: 'grain_pat_••••••••CDEF',
        secureStorageAvailable: true
      };
    },
    disconnect: async () => {
      storedEncryptedSecret = null;
      return { disconnected: true, hasToken: false };
    },
    executeOperation: async ({ operation, recordingId }) => {
      if (!storedEncryptedSecret) {
        return { httpStatus: 401, bodyText: JSON.stringify({ error: 'Not connected' }) };
      }
      if (operation === 'token_info') {
        return {
          httpStatus: 200,
          bodyText: JSON.stringify({
            valid: true,
            scope: 'personal',
            user_id: 'usr_grain_1',
            name: 'Lehrer Token'
          })
        };
      }
      if (operation === 'list_recordings') {
        return {
          httpStatus: 200,
          bodyText: JSON.stringify({
            recordings: [
              {
                id: 'rec_alpha_001',
                title: 'Klasse 4 Gruppe A',
                start_datetime: '2026-11-18T16:00:00.000Z',
                duration_seconds: 3600,
                public_url: 'https://grain.com/share/recording/rec_alpha_001',
                zoom_meeting_url: 'https://zoom.us/j/9988776655?pwd=abc',
                participants: [{ name: 'Omar Hassan' }, { name: 'Laila Mahmoud' }],
                ai_summary: 'Wir haben heute den Akkusativ und die Artikel der/den geübt.'
              },
              {
                id: 'rec_alpha_001', // Duplicate to verify deduplication
                title: 'Klasse 4 Gruppe A',
                start_datetime: '2026-11-18T16:00:00.000Z',
                duration_seconds: 3600,
                public_url: 'https://grain.com/share/recording/rec_alpha_001',
                zoom_meeting_url: 'https://zoom.us/j/9988776655?pwd=abc',
                participants: [{ name: 'Omar Hassan' }]
              }
            ]
          })
        };
      }
      if (operation === 'recording_details') {
        return {
          httpStatus: 200,
          bodyText: JSON.stringify({
            id: recordingId || 'rec_alpha_001',
            title: 'Klasse 4 Gruppe A',
            start_datetime: '2026-11-18T16:00:00.000Z',
            duration_seconds: 3600,
            public_url: 'https://grain.com/share/recording/rec_alpha_001',
            zoom_meeting_url: 'https://zoom.us/j/9988776655?pwd=abc',
            ai_summary: 'Wir haben heute den Akkusativ und der Hund / den Hund geübt.'
          })
        };
      }
      if (operation === 'recording_transcript') {
        return {
          httpStatus: 200,
          bodyText: JSON.stringify({
            transcript: [
              { speaker: 'Lehrer', text: 'Heute üben wir den Akkusativ. Ich sehe den Hund und das Buch.' },
              { speaker: 'Omar', text: 'Ich sehe den Ball.' },
              { speaker: 'Lehrer', text: 'Hausaufgabe bis nächste Stunde: Arbeitsbuch Seite 14 Aufgabe 2.' }
            ]
          })
        };
      }
      return { httpStatus: 404, bodyText: JSON.stringify({ error: 'Not found' }) };
    }
  });

  const saveRes = await saveGrainPersonalToken(fakePat);
  assert.equal(saveRes.success, true);
  assert.equal(JSON.stringify(saveRes).includes(fakePat), false, 'Save response must never leak raw token');

  const probeRes = await testAndProbeGrainConnection();
  assert.equal(probeRes.connected, true);
  assert.equal(probeRes.state.capabilities.tokenAuthentication, 'available_tested');
  assert.equal(probeRes.state.capabilities.recordingDiscovery, 'available_tested');
  assert.equal(probeRes.state.capabilities.recordingUrls, 'available_tested');
  assert.equal(probeRes.state.capabilities.zoomCalendarMetadata, 'available_tested');
  assert.equal(probeRes.state.capabilities.participants, 'available_tested');
  assert.equal(probeRes.state.capabilities.aiSummaries, 'available_tested');
  assert.equal(probeRes.state.capabilities.transcriptAccess, 'available_tested');

  const statusAfterConnect = await refreshGrainRuntimeStatus();
  assert.equal(statusAfterConnect.hasToken, true);
  assert.equal(
    JSON.stringify(statusAfterConnect).includes(fakePat),
    false,
    'Runtime status must never contain the raw token'
  );

  // ---------------------------------------------------------------------------
  // 2. MATCHING ENGINE TESTS (MANDATORY RULE 1)
  // ---------------------------------------------------------------------------
  console.log('2. Testing Lesson Matching Engine (Rule 1: Date/Time/Zoom/Duration Primary Evidence)...');

  // Verify Zoom URL vs Grain Recording URL separation
  assert.equal(isGrainRecordingUrl('https://grain.com/share/recording/rec_123'), true);
  assert.equal(isGrainRecordingUrl('https://zoom.us/j/9988776655'), false);
  assert.equal(
    normalizeZoomMeetingUrl('https://grain.com/share/recording/rec_123'),
    null,
    'Grain recording URL must NEVER be treated as a Zoom meeting URL'
  );
  const normZoom = normalizeZoomMeetingUrl('https://us02web.zoom.us/j/9988776655?pwd=xyz');
  assert.equal(normZoom?.meetingId, '9988776655');

  const sampleGroups: Group[] = [
    {
      id: 'grp_1',
      name: 'Klasse 4 Gruppe A',
      grade: 'Klasse 4',
      defaultTime: '16:00',
      days: ['Wednesday']
    } as any
  ];

  const groupStudents: Student[] = [
    {
      id: 'stu_omar',
      name: 'Omar Hassan',
      nameAr: 'عمر حسن',
      nameEn: 'Omar Hassan',
      groupId: 'grp_1'
    } as any,
    {
      id: 'stu_laila',
      name: 'Laila Mahmoud',
      nameAr: 'ليلى محمود',
      nameEn: 'Laila Mahmoud',
      groupId: 'grp_1'
    } as any
  ];

  const recStart = new Date('2026-11-18T16:00:00.000Z');
  const recLocalDate = `${recStart.getFullYear()}-${String(recStart.getMonth() + 1).padStart(2, '0')}-${String(recStart.getDate()).padStart(2, '0')}`;
  const recLocalTime = `${String(recStart.getHours()).padStart(2, '0')}:${String(recStart.getMinutes()).padStart(2, '0')}`;

  const sampleLessons: Lesson[] = [
    {
      id: 'lesson_exact_1',
      title: 'Klasse 4 Gruppe A',
      groupId: 'grp_1',
      groupName: 'Klasse 4 Gruppe A',
      type: 'online',
      grade: 'Grade 4',
      date: recLocalDate,
      time: recLocalTime,
      durationMinutes: 60,
      zoomMeetingLink: 'https://zoom.us/j/9988776655',
      status: 'scheduled',
      attendance: { stu_omar: 'present' },
      paymentStatus: 'paid',
      amountDue: 200,
      amountPaid: 200,
      sessionNumber: 1,
      totalSessionsInPackage: 4
    },
    {
      id: 'lesson_wrong_date_same_name',
      title: 'Omar Hassan',
      groupId: 'grp_1',
      groupName: 'Klasse 4 Gruppe A',
      studentName: 'Omar Hassan',
      type: 'online',
      grade: 'Grade 4',
      date: '2026-10-01', // Completely different date!
      time: '10:00',
      durationMinutes: 60,
      status: 'scheduled',
      attendance: { stu_omar: 'present' },
      paymentStatus: 'paid',
      amountDue: 200,
      amountPaid: 200,
      sessionNumber: 1,
      totalSessionsInPackage: 4
    }
  ];

  // Case A: Exact date, time, Zoom URL, duration -> strong_match
  const exactMatchEval = evaluateRecordingMatchAgainstLessons(
    {
      id: 'rec_alpha_001',
      title: 'Klasse 4 Gruppe A',
      startDatetime: '2026-11-18T16:00:00.000Z',
      durationSeconds: 3600,
      recordingUrl: 'https://grain.com/share/recording/rec_alpha_001',
      sourcePlatform: 'zoom',
      zoomMeetingUrl: 'https://zoom.us/j/9988776655?pwd=abc',
      participantNames: ['Omar Hassan']
    },
    sampleLessons,
    sampleGroups,
    groupStudents
  );
  assert.equal(exactMatchEval.matchStatus, 'strong_match');
  assert.equal(exactMatchEval.suggestedLessonId, 'lesson_exact_1');
  assert.equal(exactMatchEval.evidence?.zoomLinkStatus, 'verified_match');

  // Case B: Participant name matches 'Omar Hassan', title matches 'Omar Hassan',
  // BUT date is 2026-11-25 (no lesson on that date). Rule 1: MUST NOT match based on name/title alone!
  const nameOnlyEval = evaluateRecordingMatchAgainstLessons(
    {
      id: 'rec_name_only',
      title: 'Omar Hassan',
      startDatetime: '2026-11-25T16:00:00.000Z',
      durationSeconds: 3600,
      recordingUrl: 'https://grain.com/share/recording/rec_name_only',
      sourcePlatform: 'zoom',
      participantNames: ['Omar Hassan']
    },
    sampleLessons,
    sampleGroups,
    groupStudents
  );
  assert.equal(
    nameOnlyEval.matchStatus,
    'unmatched',
    'Rule 1 violation: Participant name or title alone must NEVER match a lesson without date/time evidence'
  );
  assert.equal(nameOnlyEval.candidates.length, 0);

  // Case C: Multiple possible lessons on the same date & similar time
  const multiLessons: Lesson[] = [
    { ...sampleLessons[0], zoomMeetingLink: undefined },
    {
      ...sampleLessons[0],
      id: 'lesson_parallel_2',
      title: 'Klasse 4 Gruppe B',
      zoomMeetingLink: undefined
    }
  ];
  const multiEval = evaluateRecordingMatchAgainstLessons(
    {
      id: 'rec_multi',
      // Identifier gate: the recording carries the group's standardized Zoom
      // topic, so it is a candidate for BOTH parallel lessons of the same
      // group and the ambiguity is preserved (not resolved by dropping one).
      title: `Wednesday - ${recLocalTime} - Klasse 4 Gruppe A`,
      startDatetime: '2026-11-18T16:05:00.000Z',
      durationSeconds: 3600,
      recordingUrl: 'https://grain.com/share/recording/rec_multi',
      sourcePlatform: 'zoom',
      participantNames: []
    },
    multiLessons,
    sampleGroups,
    groupStudents
  );
  assert.equal(multiEval.matchStatus, 'multiple_possible_lessons');
  assert.equal(multiEval.candidates.length, 2);

  // Case D: Incremental sync deduplicates duplicate recordings
  const syncResult = await syncGrainRecordingsIncrementally({
    lessons: sampleLessons,
    groups: sampleGroups,
    students: groupStudents
  });
  assert.equal(syncResult.success, true);
  assert.equal(syncResult.recordings.length, 1, 'Duplicate recording IDs must be deduplicated');

  // ---------------------------------------------------------------------------
  // 3. ATTENDANCE IMMUTABILITY & OVERWRITE PROTECTION (RULE 2 & RULE 5)
  // ---------------------------------------------------------------------------
  console.log('3. Testing Attendance Immutability (Rule 2) & Overwrite Protection (Rule 5)...');

  const lessonWithAttendance: Lesson = {
    ...sampleLessons[0],
    recordingLink: 'https://existing-link.example.com/part1',
    attendance: { stu_omar: 'present', stu_sara: 'absent' },
    report: {
      attendanceStatus: 'present',
      studentAttendance: {
        stu_omar: 'present',
        stu_sara: 'absent'
      },
      homeworkStatus: 'assigned',
      paymentStatus: 'paid',
      amountPaid: 200
    }
  };

  // Attempt attachment to Part 1 when Part 1 already has a different link and allowOverwrite is false
  const conflictCheck = prepareConfirmedGrainLessonAttachment({
    lesson: lessonWithAttendance,
    recording: syncResult.recordings[0],
    preferredSlot: 'recordingLink',
    allowOverwrite: false
  });
  assert.equal(
    conflictCheck.requiresOverwriteConfirmation,
    true,
    'Existing recordingLink must require explicit teacher overwrite confirmation'
  );
  assert.equal(conflictCheck.existingUrlInTargetSlot, 'https://existing-link.example.com/part1');

  // Confirm with allowOverwrite: true -> updates recordingLink & grainMeta, NEVER alters attendance
  const confirmedCheck = prepareConfirmedGrainLessonAttachment({
    lesson: lessonWithAttendance,
    recording: syncResult.recordings[0],
    preferredSlot: 'recordingLink',
    allowOverwrite: true
  });
  assert.equal(confirmedCheck.requiresOverwriteConfirmation, false);
  assert.equal(
    confirmedCheck.proposedLessonPatch.recordingLink,
    'https://grain.com/share/recording/rec_alpha_001'
  );
  assert.doesNotThrow(() =>
    assertLessonAttendanceUnchanged(lessonWithAttendance, confirmedCheck.proposedLessonPatch)
  );
  assert.deepEqual(
    confirmedCheck.proposedLessonPatch.report?.studentAttendance,
    { stu_omar: 'present', stu_sara: 'absent' },
    'Rule 2: Student attendance must remain 100% identical after attaching Grain recording'
  );

  // Verify assertLessonAttendanceUnchanged catches any hypothetical attendance mutation
  assert.throws(() => {
    assertLessonAttendanceUnchanged(lessonWithAttendance, {
      ...confirmedCheck.proposedLessonPatch,
      report: {
        ...confirmedCheck.proposedLessonPatch.report!,
        studentAttendance: { stu_omar: 'present', stu_sara: 'present' }
      }
    });
  }, /RULE_2_VIOLATION/);

  // ---------------------------------------------------------------------------
  // 4. PRIVACY, EPHEMERAL TRANSCRIPT, P2P, FIREBASE & BACKUP TESTS (RULE 3)
  // ---------------------------------------------------------------------------
  console.log('4. Testing Ephemeral Transcript Privacy & Sync/Backup Sanitizers (Rule 3)...');

  const ephemeralRes = await getTranscriptEphemerally('rec_alpha_001');
  assert.equal(ephemeralRes.available, true);
  assert.equal(ephemeralRes.plainText.includes('Akkusativ'), true);
  assert.equal(getEphemeralTranscriptCacheSizeForTesting(), 1);

  // Inject forbidden transcript & token fields into a dirty lesson object and verify sanitizers strip them
  const dirtyLesson: any = {
    ...lessonWithAttendance,
    ...confirmedCheck.proposedLessonPatch,
    transcript: 'RAW SECRET TRANSCRIPT',
    rawTranscript: 'RAW SECRET TRANSCRIPT 2',
    grainPersonalAccessToken: fakePat,
    grainMeta: {
      ...confirmedCheck.proposedLessonPatch.grainMeta,
      rawTranscript: 'FORBIDDEN RAW TRANSCRIPT',
      transcript: 'FORBIDDEN TRANSCRIPT',
      grainToken: fakePat
    }
  };

  const sanitizedEntity = sanitizeEntityForGrainPrivacy(dirtyLesson);
  const serializedSanitized = JSON.stringify(sanitizedEntity);
  assert.equal(serializedSanitized.includes('RAW SECRET TRANSCRIPT'), false);
  assert.equal(serializedSanitized.includes('FORBIDDEN'), false);
  assert.equal(serializedSanitized.includes(fakePat), false);
  assert.equal(sanitizedEntity.zoomMeetingLink, 'https://zoom.us/j/9988776655');
  assert.equal(sanitizedEntity.grainMeta.recordingId, 'rec_alpha_001');

  // Verify P2P buildOutboundDelta strips transcripts/tokens
  const delta = buildOutboundDelta(
    'peer_desktop_1',
    {},
    { lessons: [{ ...dirtyLesson, updatedAt: Date.now(), originRevision: 1 }] },
    { id: 'dev_test', name: 'Teacher Android' },
    { forceFull: true }
  );
  const deltaJson = JSON.stringify(delta);
  assert.equal(deltaJson.includes('RAW SECRET TRANSCRIPT'), false);
  assert.equal(deltaJson.includes(fakePat), false);
  assert.equal((delta.records.lessons?.[0] as any)?.zoomMeetingLink, 'https://zoom.us/j/9988776655');
  assert.equal((delta.records.lessons?.[0] as any)?.grainMeta?.recordingId, 'rec_alpha_001');

  // Verify Firebase partitionBackupPayload and mergeDeltaPayloads strip transcripts/tokens
  const firebaseDocs = partitionBackupPayload({
    lessons: [dirtyLesson],
    students: [],
    groups: [],
    payments: []
  });
  const firebaseJson = JSON.stringify(firebaseDocs);
  assert.equal(firebaseJson.includes('RAW SECRET TRANSCRIPT'), false);
  assert.equal(firebaseJson.includes(fakePat), false);

  const mergedFirebase = mergeDeltaPayloads(
    { lessons: [], students: [], groups: [], payments: [] },
    { lessons: [dirtyLesson] }
  );
  assert.equal(JSON.stringify(mergedFirebase).includes('RAW SECRET TRANSCRIPT'), false);

  // Verify Backup export/import validation preserves zoomMeetingLink & grainMeta while stripping transcripts/tokens
  const validatedBackup = validateAndSanitizeBackupPayload({
    version: '2.0.0',
    appVersion: '3.0.0',
    createdAt: new Date().toISOString(),
    deviceSource: 'web',
    data: {
      lessons: [dirtyLesson],
      students: [],
      groups: [],
      payments: []
    }
  });
  const backupLesson = validatedBackup.data.lessons[0];
  assert.equal(backupLesson.zoomMeetingLink, 'https://zoom.us/j/9988776655');
  assert.equal(backupLesson.grainMeta?.recordingId, 'rec_alpha_001');
  assert.equal(JSON.stringify(validatedBackup).includes('RAW SECRET TRANSCRIPT'), false);
  assert.equal(JSON.stringify(validatedBackup).includes(fakePat), false);

  // ---------------------------------------------------------------------------
  // 5. PARENT REPORT SANITIZATION & GROUP PRIVACY TESTS (RULE 4)
  // ---------------------------------------------------------------------------
  console.log('5. Testing Parent Report Group Student Name Redaction & Approval (Rule 4)...');

  const rawGroupSummary =
    'ملخص مقترح من Grain (يتطلب مراجعة المعلم): شرحنا اليوم حالة النصب Akkusativ.\nLehrer: Raw speaker line that must be stripped.\nشارك عمر حسن بشكل ممتاز بينما سألت ليلى محمود (Laila Mahmoud) عن أداة التعريف.';
  const sanitizedForOmar = sanitizeGrainSummaryForParentReport({
    rawSummaryText: rawGroupSummary,
    targetStudent: groupStudents[0],
    allGroupStudents: groupStudents,
    language: 'ar'
  });

  assert.equal(
    sanitizedForOmar.includes('عمر'),
    true,
    'Target student name may remain in their own parent report'
  );
  assert.equal(
    sanitizedForOmar.includes('ليلى'),
    false,
    'Rule 4 violation: Other group student Arabic name must be redacted from individual parent report'
  );
  assert.equal(
    sanitizedForOmar.includes('Laila'),
    false,
    'Rule 4 violation: Other group student English name must be redacted from individual parent report'
  );
  assert.equal(
    sanitizedForOmar.includes('Raw speaker line'),
    false,
    'Raw speaker-attributed transcript lines must be stripped from parent report'
  );

  // ---------------------------------------------------------------------------
  // 6. EDUCATIONAL DRAFTS & LERNSTUDIO DRAFT TESTS (RULE 5)
  // ---------------------------------------------------------------------------
  console.log('6. Testing Educational Draft & Lernstudio Draft Generation (Rule 5)...');

  const eduRes = await generateEducationalDraftForRecording(syncResult.recordings[0], {
    lesson: lessonWithAttendance,
    students: groupStudents,
    includeTranscriptAnalysis: true
  });
  assert.equal(eduRes.success, true);
  assert.equal(
    eduRes.draft?.status,
    'teacher_review_required',
    'Educational draft must require teacher review'
  );
  assert.equal(
    eduRes.draft?.homework.some((h) => h.assignmentKind === 'explicitly_assigned_in_lesson'),
    true,
    'Explicitly assigned homework in transcript must be detected and labeled'
  );

  const lernstudioDraft = buildLernstudioDraftFromGrainEducationalDraft(eduRes.draft!, {
    title: 'Klasse 4 Akkusativ Draft',
    grade: 'Klasse 4'
  });
  assert.equal(Boolean(lernstudioDraft.id), true);
  assert.equal(lernstudioDraft.published, false, 'Lernstudio draft must start unpublished');

  // ---------------------------------------------------------------------------
  // 7. FIX-1 TO FIX-5: HARDENED SECURITY & ALLOWLIST TESTS
  // ---------------------------------------------------------------------------
  console.log('7. Testing FIX-1 to FIX-5 (Loopback, Session Revocation, Unknown Field Rejection, Backup XML)...');

  // Loopback validation rejects spoofed X-Forwarded-For and non-local Origin
  assert.equal(
    isStrictLoopbackRequest({
      socket: { remoteAddress: '127.0.0.1' },
      headers: { origin: 'http://localhost:3000' }
    } as any),
    true
  );
  assert.equal(
    isStrictLoopbackRequest({
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-forwarded-for': '203.0.113.5' }
    } as any),
    false,
    'Proxy must reject requests with spoofed X-Forwarded-For header'
  );
  assert.equal(
    isStrictLoopbackRequest({
      socket: { remoteAddress: '192.168.1.50' },
      headers: {}
    } as any),
    false,
    'Proxy must reject non-loopback remoteAddress'
  );
  assert.equal(
    isStrictLoopbackRequest({
      socket: { remoteAddress: '127.0.0.1' },
      headers: { origin: 'https://malicious.example.com' }
    } as any),
    false,
    'Proxy must reject non-local Origin header'
  );

  // Session revocation on disconnect
  const revocableSession = createLocalTeacherSessionToken('teacher_revoke_test');
  assert.equal(verifyLocalTeacherSessionToken(revocableSession).valid, true);
  revokeGrainSessionsForUser('local_teacher_revoke_test');
  assert.equal(
    verifyLocalTeacherSessionToken(revocableSession).valid,
    false,
    'Revoked session token must be rejected immediately'
  );

  // FIX-5: Unknown top-level, filter, and include fields rejected in both proxy and service
  const topLevelFilterProxy = buildWhitelistedGrainTarget({
    operation: 'list_recordings',
    bodyPayload: { after_datetime: '2026-11-01T00:00:00Z' }
  });
  assert.equal(topLevelFilterProxy.valid, false);
  assert.equal(topLevelFilterProxy.code, 'INVALID_TOP_LEVEL_FILTER');

  const unknownTopLevelProxy = buildWhitelistedGrainTarget({
    operation: 'list_recordings',
    bodyPayload: { undocumented_top_field: 'bad' }
  });
  assert.equal(unknownTopLevelProxy.valid, false);
  assert.equal(unknownTopLevelProxy.code, 'UNKNOWN_FIELD_FORBIDDEN');

  const unknownFilterProxy = buildWhitelistedGrainTarget({
    operation: 'list_recordings',
    bodyPayload: { filter: { undocumented_filter: 'bad' } }
  });
  assert.equal(unknownFilterProxy.valid, false);
  assert.equal(unknownFilterProxy.code, 'UNKNOWN_FILTER_FIELD');

  const unknownIncludeProxy = buildWhitelistedGrainTarget({
    operation: 'list_recordings',
    bodyPayload: { include: { owners: true } }
  });
  assert.equal(unknownIncludeProxy.valid, false);
  assert.equal(unknownIncludeProxy.code, 'UNKNOWN_INCLUDE_FIELD');

  assert.equal(
    buildCanonicalGrainRequestBody('list_recordings', { after_datetime: '2026-11-01T00:00:00Z' } as any).errorCode,
    'INVALID_TOP_LEVEL_FILTER'
  );
  assert.equal(
    buildCanonicalGrainRequestBody('list_recordings', { bad_top_field: 1 } as any).errorCode,
    'UNKNOWN_FIELD_FORBIDDEN'
  );
  assert.equal(
    buildCanonicalGrainRequestBody('list_recordings', { filter: { bad_key: 1 } as any }).errorCode,
    'UNKNOWN_FILTER_FIELD'
  );
  assert.equal(
    buildCanonicalGrainRequestBody('list_recordings', { include: { owners: true } as any }).errorCode,
    'UNKNOWN_INCLUDE_FIELD'
  );

  // FIX-3: Verify Android backup exclusion XML files exist and exclude com.glueck.app.grain_secure_vault.xml
  const backupRulesXml = fs.readFileSync(
    path.resolve(process.cwd(), 'android/app/src/main/res/xml/backup_rules.xml'),
    'utf8'
  );
  const dataExtractionXml = fs.readFileSync(
    path.resolve(process.cwd(), 'android/app/src/main/res/xml/data_extraction_rules.xml'),
    'utf8'
  );
  assert.equal(backupRulesXml.includes('com.glueck.app.grain_secure_vault.xml'), true);
  assert.equal(dataExtractionXml.includes('com.glueck.app.grain_secure_vault.xml'), true);

  // ---------------------------------------------------------------------------
  // 8. PART 7: 4-STEP RECORDING DISCOVERY DIAGNOSTICS & ERROR CLASSIFICATION
  // ---------------------------------------------------------------------------
  console.log('8. Testing 4-Step Recording Discovery Diagnostics (Tests A-D)...');

  const diagRes = await runGrainRecordingDiscoveryDiagnostics();
  assert.equal(diagRes.steps.length, 4, 'Diagnostics must execute Tests A, B, C, and D');
  assert.equal(diagRes.steps[0].testId, 'Test A');
  assert.equal(diagRes.steps[0].errorCode, null);
  assert.equal(diagRes.steps[1].testId, 'Test B');
  assert.equal(diagRes.steps[1].errorCode, null);
  assert.equal(diagRes.steps[2].testId, 'Test C');
  assert.equal(diagRes.steps[2].errorCode, null);
  assert.equal(diagRes.steps[3].testId, 'Test D');
  assert.equal(diagRes.steps[3].errorCode, null);

  // ---------------------------------------------------------------------------
  // 9. PART 2 (FIX-1): PUBLIC GRAIN RECORDING LINK CLASSIFICATION FOR PARENTS
  // ---------------------------------------------------------------------------
  console.log('9. Testing Public Grain Recording Link Verification (Part 2 / FIX-1)...');

  assert.equal(
    classifyGrainRecordingShareAccess({
      recordingUrl: 'https://grain.com/share/recording/rec_pub_1',
      public_url: 'https://grain.com/share/recording/rec_pub_1',
      share_state: 'public'
    }).classification,
    'public_access_verified'
  );
  assert.equal(
    classifyGrainRecordingShareAccess({
      recordingUrl: 'https://grain.com/app/meetings/rec_ws_1',
      public_url: null,
      share_state: 'workspace'
    }).classification,
    'workspace_only',
    'Workspace recordings must NEVER be treated as public_access_verified'
  );
  assert.equal(
    classifyGrainRecordingShareAccess({
      recordingUrl: 'https://grain.com/app/meetings/rec_priv_1',
      public_url: null,
      share_state: 'private'
    }).classification,
    'restricted'
  );
  assert.equal(
    classifyGrainRecordingShareAccess({
      recordingUrl: 'https://zoom.us/j/123456789',
      public_url: 'https://zoom.us/j/123456789',
      share_state: 'public'
    }).classification,
    'link_unavailable',
    'Zoom meeting URLs must never be classified as public Grain recording links'
  );
  assert.equal(
    isParentReadyPublicGrainLink(
      'https://grain.com/_/public-api/v2/recordings/rec_1',
      'public_access_verified'
    ),
    false,
    'API endpoints must never be allowed as parent links'
  );

  // ---------------------------------------------------------------------------
  // 10. PART 9 & PART 10: SMART MATCHING WITHOUT ZOOM LINKS + SMART GROUP LEARNING
  // ---------------------------------------------------------------------------
  console.log('10. Testing Smart Matching Without Zoom Links & Smart Group Learning...');

  saveGrainGroupLearningRecords([]);

  const lessonNoZoom: Lesson = {
    id: 'lesson_no_zoom_1',
    title: 'Deutsch Konversation',
    groupId: 'grp_smart_a',
    groupName: 'Gruppe Alpha',
    type: 'online',
    grade: 'Klasse 5',
    date: recLocalDate,
    time: recLocalTime,
    durationMinutes: 60,
    status: 'scheduled',
    attendance: { stu_omar: 'present' },
    paymentStatus: 'paid',
    amountDue: 200,
    amountPaid: 200,
    sessionNumber: 1,
    totalSessionsInPackage: 4
  };

  const groupsForLearning: Group[] = [
    {
      id: 'grp_smart_a',
      name: 'Gruppe Alpha',
      grade: 'Klasse 5',
      defaultTime: recLocalTime,
      days: ['Wednesday']
    } as any,
    {
      id: 'grp_smart_b',
      name: 'Gruppe Beta',
      grade: 'Klasse 5',
      defaultTime: recLocalTime,
      days: ['Wednesday']
    } as any
  ];

  const studentsForLearning: Student[] = [
    {
      id: 'stu_omar',
      name: 'Omar Hassan',
      groupId: 'grp_smart_a'
    } as any,
    {
      id: 'stu_nadia',
      name: 'Nadia Adel',
      groupId: 'grp_smart_b'
    } as any
  ];

  // Match WITHOUT any Zoom link using date + start time + student-to-group relationship
  const matchNoZoom = evaluateRecordingMatchAgainstLessons(
    {
      id: 'rec_no_zoom_1',
      title: 'Mittwoch Unterricht',
      startDatetime: '2026-11-18T16:00:00.000Z',
      durationSeconds: 3600,
      recordingUrl: 'https://grain.com/share/recording/rec_no_zoom_1',
      sourcePlatform: 'zoom',
      participantNames: ['Omar Hassan']
    },
    [lessonNoZoom],
    groupsForLearning,
    studentsForLearning
  );
  // Identifier gate: date + start time + student-group evidence alone must
  // NOT match a recording — without a program identifier (Zoom ID,
  // standardized topic, calendar UID, or a teacher-confirmed learning rule)
  // the recording stays unmatched. The first-time pattern is confirmed
  // manually from the assistant panel, which creates the learning rule that
  // auto-matches later recordings of this group.
  assert.equal(
    matchNoZoom.matchStatus,
    'unmatched',
    'Recording without any program identifier must NOT match on date + time + participants alone'
  );
  assert.equal(matchNoZoom.candidates.length, 0);

  // Record teacher confirmation for Gruppe Alpha -> saves learning record keyed by group.id
  const learnedRecord = recordConfirmedGrainGroupLearning({
    lesson: lessonNoZoom,
    groups: groupsForLearning,
    students: studentsForLearning,
    recording: {
      id: 'rec_no_zoom_1',
      title: 'Mittwoch Unterricht',
      startDatetime: '2026-11-18T16:00:00.000Z',
      durationSeconds: 3600,
      durationMinutes: 60,
      recordingUrl: 'https://grain.com/share/recording/rec_no_zoom_1',
      sourcePlatform: 'zoom',
      participantNames: ['Omar Hassan']
    } as any
  });
  assert.equal(learnedRecord?.groupId, 'grp_smart_a');
  assert.equal(learnedRecord?.teacherConfirmed, true);

  // Rename group ('Gruppe Alpha' -> 'Gruppe Alpha Renamed') while keeping id 'grp_smart_a'
  const renamedGroups: Group[] = [
    { ...groupsForLearning[0], name: 'Gruppe Alpha Renamed' },
    groupsForLearning[1]
  ];
  const parallelLessonA: Lesson = {
    ...lessonNoZoom,
    id: 'lesson_parallel_a',
    groupName: 'Gruppe Alpha Renamed'
  };
  const parallelLessonB: Lesson = {
    ...lessonNoZoom,
    id: 'lesson_parallel_b',
    groupId: 'grp_smart_b',
    groupName: 'Gruppe Beta',
    attendance: {}
  };

  // Evaluate future recording at same weekday/time -> learned groupId 'grp_smart_a' survives rename and ranks #1
  const evalAfterRename = evaluateRecordingMatchAgainstLessons(
    {
      id: 'rec_future_2',
      title: 'Mittwoch Unterricht',
      startDatetime: '2026-11-18T16:00:00.000Z',
      durationSeconds: 3600,
      recordingUrl: 'https://grain.com/share/recording/rec_future_2',
      sourcePlatform: 'zoom',
      participantNames: ['Omar Hassan']
    },
    [parallelLessonA, parallelLessonB],
    renamedGroups,
    studentsForLearning
  );
  assert.equal(evalAfterRename.candidates[0]?.lessonId, 'lesson_parallel_a');
  assert.equal((evalAfterRename.candidates[0]?.evidence.learnedGroupMatchBoost || 0) > 0, true);

  // Teacher correction: system suggested 'grp_smart_a', teacher selects 'grp_smart_b'
  const correctedRecord = recordConfirmedGrainGroupLearning({
    lesson: parallelLessonB,
    groups: renamedGroups,
    students: studentsForLearning,
    recording: {
      id: 'rec_future_2',
      title: 'Mittwoch Unterricht',
      startDatetime: '2026-11-18T16:00:00.000Z',
      durationSeconds: 3600,
      durationMinutes: 60,
      recordingUrl: 'https://grain.com/share/recording/rec_future_2',
      sourcePlatform: 'zoom',
      participantNames: ['Nadia Adel']
    } as any,
    previousSuggestedGroupId: 'grp_smart_a'
  });

  assert.equal(
    (correctedRecord?.correctionHistory?.length || 0) >= 1,
    true,
    'Correction history must record when teacher selects Group B over suggested Group A'
  );
  assert.equal(correctedRecord?.correctionHistory?.[0]?.previousSuggestedGroupId, 'grp_smart_a');
  assert.equal(correctedRecord?.correctionHistory?.[0]?.chosenGroupId, 'grp_smart_b');

  // Deleted group handling: pass only Group B as activeGroups -> Group A record is marked obsoleteGroup: true and never reassigned
  const recordsAfterDelete = loadGrainGroupLearningRecords([renamedGroups[1]]);
  const deletedGroupRec = recordsAfterDelete.find((r) => r.groupId === 'grp_smart_a');
  assert.equal(deletedGroupRec?.obsoleteGroup, true);
  assert.equal(deletedGroupRec?.groupId, 'grp_smart_a', 'Deleted group record must never be reassigned to another group');

  // ---------------------------------------------------------------------------
  // 11. PART 11: MULTI-LESSON PARENT REPORT (NEWEST FIRST + PUBLIC LINKS ONLY)
  // ---------------------------------------------------------------------------
  console.log('11. Testing Multi-Lesson Parent Report Sorting & Public Link Filtering...');

  const multiReportLessons: Lesson[] = [
    {
      ...sampleLessons[0],
      id: 'l_old',
      date: '2026-11-10',
      time: '15:00',
      title: 'Lektion 1: Begrüßung',
      recordingLink: 'https://grain.com/share/recording/rec_old_pub',
      grainMeta: {
        recordingId: 'rec_old_pub',
        recordingTitle: 'Lektion 1',
        startTimestamp: '2026-11-10T15:00:00Z',
        durationMinutes: 60,
        recordingUrl: 'https://grain.com/share/recording/rec_old_pub',
        source: 'zoom',
        matchingStatus: 'confirmed',
        confirmedLessonId: 'l_old',
        lastSyncedAt: new Date().toISOString(),
        shareAccessClassification: 'public_access_verified',
        approvedSummary: 'شرح التحيات مع عمر حسن وليلى محمود'
      }
    },
    {
      ...sampleLessons[0],
      id: 'l_new',
      date: '2026-11-18',
      time: '18:00',
      title: 'Lektion 3: Akkusativ',
      recordingLink: 'https://grain.com/app/meetings/rec_new_ws',
      grainMeta: {
        recordingId: 'rec_new_ws',
        recordingTitle: 'Lektion 3',
        startTimestamp: '2026-11-18T18:00:00Z',
        durationMinutes: 60,
        recordingUrl: 'https://grain.com/app/meetings/rec_new_ws',
        source: 'zoom',
        matchingStatus: 'confirmed',
        confirmedLessonId: 'l_new',
        lastSyncedAt: new Date().toISOString(),
        shareAccessClassification: 'workspace_only'
      }
    },
    {
      ...sampleLessons[0],
      id: 'l_mid',
      date: '2026-11-14',
      time: '16:30',
      title: 'Lektion 2: Verben',
      recordingLink: 'https://zoom.us/j/9988776655' // Zoom link must be excluded!
    }
  ];

  const sortedNewest = sortLessonsNewestFirst(multiReportLessons);
  assert.deepEqual(
    sortedNewest.map((l) => l.id),
    ['l_new', 'l_mid', 'l_old'],
    'Multi-lesson list must be sorted Newest first -> Oldest last by date & time'
  );

  const multiReport = buildMultiLessonParentReportData({
    lessons: multiReportLessons,
    targetStudent: groupStudents[0], // Omar Hassan
    allGroupStudents: groupStudents,
    language: 'ar'
  });

  assert.equal(multiReport.entries[0].lessonId, 'l_new', 'First entry in multi-lesson report must be newest lesson');
  assert.equal(multiReport.entries[2].lessonId, 'l_old', 'Last entry in multi-lesson report must be oldest lesson');
  assert.equal(
    multiReport.formattedReportText.includes('https://grain.com/share/recording/rec_old_pub'),
    true,
    'Publicly verified Grain link must be included in multi-lesson parent report'
  );
  assert.equal(
    multiReport.formattedReportText.includes('rec_new_ws'),
    false,
    'Workspace-only Grain link must be excluded from parent report'
  );
  assert.equal(
    multiReport.formattedReportText.includes('zoom.us'),
    false,
    'Zoom meeting URL must be excluded from parent report'
  );
  assert.equal(
    multiReport.formattedReportText.includes('ليلى'),
    false,
    'Other group students names must be redacted in multi-lesson parent report'
  );
  assert.equal(multiReport.excludedNonPublicCount, 2);

  // Disconnect clears credentials and ephemeral transcript cache
  await disconnectGrainAccount();
  assert.equal(
    getEphemeralTranscriptCacheSizeForTesting(),
    0,
    'Disconnecting Grain must clear the in-memory ephemeral transcript cache'
  );
  const statusAfterDisconnect = await refreshGrainRuntimeStatus();
  assert.equal(statusAfterDisconnect.hasToken, false);

  // ---------------------------------------------------------------------------
  // 12. SMART RECURRING MATCHING, PART 2 DETECTION & 7-SECTION LESSON EXTRACTION (16 CASES)
  // ---------------------------------------------------------------------------
  console.log('12. Testing Smart Recurring Matching, Part 2 Pairing & 7-Section Content Extraction...');

  // Reset test adapter with full in-memory Grain API mock supporting recordings + transcripts
  const mockRemoteRecordings: any[] = [];
  const mockTranscripts: Record<string, any> = {};
  const mockRecordingDetails: Record<string, any> = {};
  let section12TokenStored: string | null = null;

  __setGrainServiceTestAdapter({
    runtime: 'electron',
    secureStorageAvailable: true,
    getStatus: async () => ({
      supported: true,
      secureStorageAvailable: true,
      hasToken: Boolean(section12TokenStored),
      maskedToken: section12TokenStored ? 'grain_pat_••••••••7890' : null
    }),
    saveToken: async (tok) => {
      section12TokenStored = `ENC(${tok})`;
      return {
        saved: true,
        hasToken: true,
        maskedToken: 'grain_pat_••••••••7890',
        secureStorageAvailable: true
      };
    },
    disconnect: async () => {
      section12TokenStored = null;
      return { disconnected: true, hasToken: false };
    },
    executeOperation: async ({ operation, recordingId }) => {
      if (!section12TokenStored) {
        return { httpStatus: 401, bodyText: JSON.stringify({ error: 'Not connected' }) };
      }
      if (operation === 'token_info') {
        return {
          httpStatus: 200,
          bodyText: JSON.stringify({ valid: true, scope: 'personal', id: 'usr_1', name: 'Teacher' })
        };
      }
      if (operation === 'list_recordings') {
        return {
          httpStatus: 200,
          bodyText: JSON.stringify({ recordings: mockRemoteRecordings, cursor: null })
        };
      }
      if (operation === 'recording_details') {
        const override = recordingId ? mockRecordingDetails[recordingId] : undefined;
        const found = mockRemoteRecordings.find((r) => r.id === recordingId);
        const merged = override ? { ...(found || { id: recordingId }), ...override } : found;
        return {
          httpStatus: merged ? 200 : 404,
          bodyText: JSON.stringify(merged || { id: recordingId })
        };
      }
      if (operation === 'recording_transcript') {
        const trData = recordingId ? mockTranscripts[recordingId] : undefined;
        if (!trData) {
          return { httpStatus: 404, bodyText: JSON.stringify({ error: 'not_found' }) };
        }
        return { httpStatus: 200, bodyText: JSON.stringify(trData) };
      }
      return { httpStatus: 200, bodyText: JSON.stringify({}) };
    }
  });

  await saveGrainPersonalToken('grain_pat_test_smart_recurring_1234567890');
  await testAndProbeGrainConnection();
  saveGrainGroupLearningRecords([]);

  const groupMontag: Group = {
    id: 'grp_montag_b1',
    name: 'Montag B1',
    grade: 'B1',
    defaultTime: '17:00',
    days: ['Monday']
  } as any;

  const groupParallelSameTime: Group = {
    id: 'grp_parallel_17',
    name: 'Parallel B2',
    grade: 'B2',
    defaultTime: '17:00',
    days: ['Monday']
  } as any;

  const stMon1: Student = { id: 'st_m1', name: 'Amira K.', groupId: 'grp_montag_b1' } as any;
  const stPar1: Student = { id: 'st_p1', name: 'Karim Z.', groupId: 'grp_parallel_17' } as any;

  const mkLocalIso = (dateYmd: string, hm: string) => {
    const [y, m, d] = dateYmd.split('-').map(Number);
    const [hh, mm] = hm.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  };

  // Case 1: First manual assignment & persistent learning
  const week1Lesson: Lesson = {
    id: 'les_w1',
    title: 'Montag B1 W1',
    groupId: 'grp_montag_b1',
    groupName: 'Montag B1',
    type: 'online',
    grade: 'B1',
    date: '2026-11-02', // Monday
    time: '17:00',
    durationMinutes: 60,
    status: 'scheduled',
    attendance: { st_m1: 'present' },
    paymentStatus: 'paid',
    amountDue: 200,
    amountPaid: 200,
    sessionNumber: 1,
    totalSessionsInPackage: 4
  };

  const recW1P1 = {
    id: 'rec_w1_p1',
    title: 'Montag B1 Zoom Session',
    startDatetime: mkLocalIso('2026-11-02', '17:00'),
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/rec_w1_p1',
    sourcePlatform: 'zoom',
    participantNames: ['Amira K.']
  } as any;

  const attW1 = prepareConfirmedGrainLessonAttachment({
    lesson: week1Lesson,
    recording: recW1P1,
    preferredSlot: 'recordingLink'
  });
  assert.equal(attW1.proposedLessonPatch.recordingLink, 'https://grain.com/share/recording/rec_w1_p1');
  const learnedMontag = recordConfirmedGrainGroupLearning({
    lesson: week1Lesson,
    recording: recW1P1,
    groups: [groupMontag],
    students: [stMon1]
  });
  assert.equal(learnedMontag?.groupId, 'grp_montag_b1');
  assert.equal(learnedMontag?.lessonWeekday, 1);
  assert.equal(learnedMontag?.lessonScheduledStartTime, '17:00');
  assert.equal(learnedMontag?.ruleEnabled, true);

  // Case 2 & Case 3: Automatic matching in subsequent weeks + survives Group Renaming
  const renamedMontagGroup: Group = { ...groupMontag, name: 'Montag B1 Intensiv Neu' };
  const week2Lesson: Lesson = {
    ...week1Lesson,
    id: 'les_w2',
    date: '2026-11-09', // Next Monday
    time: '17:00',
    groupName: 'Montag B1 Intensiv Neu'
  };

  const recW2P1 = {
    id: 'rec_w2_p1',
    title: 'Montag B1 Zoom Session',
    startDatetime: mkLocalIso('2026-11-09', '17:01'),
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/rec_w2_p1',
    sourcePlatform: 'zoom',
    participantNames: ['Amira K.']
  } as any;

  const evalW2 = evaluateRecordingMatchAgainstLessons(
    recW2P1,
    [week2Lesson],
    [renamedMontagGroup],
    [stMon1],
    loadGrainGroupLearningRecords([renamedMontagGroup])
  );
  assert.equal(
    evalW2.matchStatus,
    'automatically_matched',
    'Week 2 recording matching confirmed weekly rule must auto-match even after group rename'
  );
  assert.equal(evalW2.suggestedLessonId, 'les_w2');

  // Case 4: Multiple groups with similar schedules -> must NOT assign by time alone
  const ambiguousSameTimeLessonA: Lesson = {
    ...week2Lesson,
    id: 'les_amb_a',
    date: '2026-11-16',
    time: '17:00',
    title: 'Session Alpha'
  };
  const ambiguousSameTimeLessonB: Lesson = {
    ...week2Lesson,
    id: 'les_amb_b',
    groupId: 'grp_parallel_17',
    groupName: 'Parallel B2',
    date: '2026-11-16',
    time: '17:00',
    title: 'Session Beta'
  };
  const genericRecAt17 = {
    id: 'rec_amb_17',
    title: 'Deutsch Unterricht',
    startDatetime: mkLocalIso('2026-11-16', '17:00'),
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/rec_amb_17',
    sourcePlatform: 'zoom'
  } as any;

  const evalAmb = evaluateRecordingMatchAgainstLessons(
    genericRecAt17,
    [ambiguousSameTimeLessonA, ambiguousSameTimeLessonB],
    [renamedMontagGroup, groupParallelSameTime],
    [stMon1, stPar1],
    [] // No learned preference yet -> ambiguous time overlap
  );
  assert.equal(
    evalAmb.matchStatus,
    'unmatched',
    'Multiple overlapping groups without any program identifier must NOT match at all, let alone auto-assign'
  );

  // Case 5: Schedule change (Monday 17:00 -> Tuesday 19:30) asks for confirmation once, then updates rule
  const shiftedLesson: Lesson = {
    ...week2Lesson,
    id: 'les_shifted',
    date: '2026-11-10', // Tuesday instead of Monday!
    time: '19:30'
  };
  const shiftedRec = {
    id: 'rec_shifted',
    title: 'Montag B1 Zoom Session',
    startDatetime: mkLocalIso('2026-11-10', '19:30'),
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/rec_shifted',
    sourcePlatform: 'zoom',
    participantNames: ['Amira K.']
  } as any;

  const evalShift = evaluateRecordingMatchAgainstLessons(
    shiftedRec,
    [shiftedLesson],
    [renamedMontagGroup],
    [stMon1],
    loadGrainGroupLearningRecords([renamedMontagGroup])
  );
  assert.equal(
    evalShift.matchStatus,
    'needs_confirmation',
    'Shifted schedule must ask for confirmation once instead of silent auto-assignment'
  );

  // Teacher confirms shifted schedule -> updates learned rule; restore Monday 17:00 for next cases
  recordConfirmedGrainGroupLearning({
    lesson: shiftedLesson,
    recording: shiftedRec,
    groups: [renamedMontagGroup],
    students: [stMon1]
  });
  const evalShiftConfirmed = evaluateRecordingMatchAgainstLessons(
    {
      ...shiftedRec,
      id: 'rec_shifted_next',
      startDatetime: mkLocalIso('2026-11-17', '19:30')
    },
    [{ ...shiftedLesson, id: 'les_shifted_2', date: '2026-11-17', time: '19:30' }],
    [renamedMontagGroup],
    [stMon1],
    loadGrainGroupLearningRecords([renamedMontagGroup])
  );
  assert.equal(evalShiftConfirmed.matchStatus, 'automatically_matched');

  // Re-establish clean Monday 17:00 rule for upcoming Part 2 tests
  saveGrainGroupLearningRecords([]);
  recordConfirmedGrainGroupLearning({
    lesson: week1Lesson,
    recording: recW1P1,
    groups: [renamedMontagGroup],
    students: [stMon1]
  });

  // Case 6 & Case 7: Part 2 starting 40, 41, and 42 minutes after Part 1, AND reverse import order (Part 2 before Part 1)
  for (const gapMin of [40, 41, 42]) {
    const p1Start = mkLocalIso('2026-11-23', '17:00');
    const p2Hm = `17:${String(gapMin).padStart(2, '0')}`;
    const p2Start = mkLocalIso('2026-11-23', p2Hm);

    const w3Lesson: Lesson = {
      ...week2Lesson,
      id: `les_gap_${gapMin}`,
      date: '2026-11-23',
      time: '17:00'
    };

    const recPart2ArrivedFirst = {
      id: `rec_p2_${gapMin}`,
      title: 'Montag B1 Zoom Session',
      startDatetime: p2Start,
      durationSeconds: 2100,
      durationMinutes: 35,
      recordingUrl: `https://grain.com/share/recording/rec_p2_${gapMin}`,
      sourcePlatform: 'zoom',
      participantNames: ['Amira K.']
    } as any;

    // Step 1: Part 2 arrives before Part 1
    const firstSyncPass = applyAutomaticGrainMatchesAndTwoPartPairs({
      recordings: [recPart2ArrivedFirst],
      lessons: [w3Lesson],
      groups: [renamedMontagGroup],
      students: [stMon1]
    });
    const lessonAfterPart2Only = firstSyncPass.updatedLessons.find((l) => l.id === w3Lesson.id)!;

    // Step 2: Part 1 arrives on subsequent sync! Must reorder so Part 1 -> recordingLink, Part 2 -> recordingLink2
    const recPart1ArrivedSecond = {
      id: `rec_p1_${gapMin}`,
      title: 'Montag B1 Zoom Session',
      startDatetime: p1Start,
      durationSeconds: 2400,
      durationMinutes: 40,
      recordingUrl: `https://grain.com/share/recording/rec_p1_${gapMin}`,
      sourcePlatform: 'zoom',
      participantNames: ['Amira K.']
    } as any;

    const secondSyncPass = applyAutomaticGrainMatchesAndTwoPartPairs({
      recordings: [recPart2ArrivedFirst, recPart1ArrivedSecond],
      lessons: [lessonAfterPart2Only],
      groups: [renamedMontagGroup],
      students: [stMon1]
    });
    const finalPairedLesson = secondSyncPass.updatedLessons.find((l) => l.id === w3Lesson.id)!;
    assert.equal(
      finalPairedLesson.recordingLink,
      `https://grain.com/share/recording/rec_p1_${gapMin}`,
      `Part 1 must occupy recordingLink even when Part 2 arrived first (gap ${gapMin}m)`
    );
    assert.equal(
      finalPairedLesson.recordingLink2,
      `https://grain.com/share/recording/rec_p2_${gapMin}`,
      `Part 2 must occupy recordingLink2 when gap is ${gapMin}m`
    );
    assert.equal(finalPairedLesson.grainMeta?.part2StartGapMinutes, gapMin);
  }

  // Case 8: Part 2 NOT confused with another independent lesson starting at 17:40
  const lessonMain1700: Lesson = {
    ...week2Lesson,
    id: 'les_main_1700',
    date: '2026-11-30',
    time: '17:00'
  };
  const lessonIndependent1740: Lesson = {
    ...week2Lesson,
    id: 'les_indep_1740',
    groupId: 'grp_parallel_17',
    groupName: 'Parallel B2',
    date: '2026-11-30',
    time: '17:40'
  };
  const recMain1700 = {
    id: 'rec_main_1700',
    title: 'Montag B1 Zoom Session',
    startDatetime: mkLocalIso('2026-11-30', '17:00'),
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/rec_main_1700',
    sourcePlatform: 'zoom',
    matchStatus: 'automatically_matched' as const,
    suggestedLessonId: 'les_main_1700',
    candidates: [],
    matchReasons: [],
    importedAt: new Date().toISOString()
  };
  const recIndependent1740 = {
    id: 'rec_indep_1740',
    title: 'Parallel B2 Konversation',
    startDatetime: mkLocalIso('2026-11-30', '17:40'),
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/rec_indep_1740',
    sourcePlatform: 'zoom',
    matchStatus: 'suggested_match' as const,
    suggestedLessonId: 'les_main_1700',
    candidates: [{ lessonId: 'les_main_1700' } as any],
    matchReasons: [],
    importedAt: new Date().toISOString()
  };
  const conflictPairCheck = detectGrainTwoPartRecordingPairs({
    recordings: [recMain1700 as any, recIndependent1740 as any],
    lessons: [lessonMain1700, lessonIndependent1740],
    groups: [renamedMontagGroup, groupParallelSameTime],
    students: [stMon1, stPar1]
  });
  const checked1740 = conflictPairCheck.find((r) => r.id === 'rec_indep_1740')!;
  assert.notEqual(
    checked1740.detectedPartSlot,
    'part2',
    'Recording belonging to an independent lesson (Parallel B2) at 17:40 must never be misclassified as Part 2 of Montag B1'
  );

  // Case 9: Existing recording-link protection (no overwrite without confirmation)
  const lessonWithManualLink: Lesson = {
    ...week2Lesson,
    id: 'les_protected_link',
    date: '2026-12-07',
    time: '17:00',
    recordingLink: 'https://grain.com/share/recording/existing_teacher_choice'
  };
  const incomingDifferentRec = {
    id: 'rec_diff_auto',
    title: 'Montag B1 Zoom Session',
    startDatetime: mkLocalIso('2026-12-07', '17:00'),
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/new_candidate_link',
    sourcePlatform: 'zoom',
    participantNames: ['Amira K.']
  } as any;
  const overwriteProtected = applyAutomaticGrainMatchesAndTwoPartPairs({
    recordings: [incomingDifferentRec],
    lessons: [lessonWithManualLink],
    groups: [renamedMontagGroup],
    students: [stMon1]
  });
  assert.equal(
    overwriteProtected.updatedLessons.find((l) => l.id === 'les_protected_link')?.recordingLink,
    'https://grain.com/share/recording/existing_teacher_choice',
    'Existing recordingLink must NEVER be overwritten automatically'
  );
  assert.equal(
    overwriteProtected.recordings[0]?.matchStatus,
    'needs_confirmation',
    'Conflicting existing recordingLink must trigger needs_confirmation'
  );

  // Case 10: Duplicate imports & repeated syncs are idempotent (never duplicate extracted summaries)
  mockRemoteRecordings.push({
    id: 'rec_sync_idemp_1',
    title: 'Montag B1 Zoom Session',
    start_datetime: mkLocalIso('2026-12-14', '17:00'),
    duration_seconds: 2400,
    url: 'https://grain.com/share/recording/rec_sync_idemp_1',
    public_url: 'https://grain.com/share/recording/rec_sync_idemp_1',
    share_state: 'public',
    source: 'zoom',
    participants: [{ name: 'Amira K.' }]
  });
  mockTranscripts['rec_sync_idemp_1'] = {
    transcript: [
      {
        speaker: 'Lehrer',
        text: 'Thema der Stunde: Das Perfekt mit haben und sein. Heute lernen wir der Bahnhof und die Reise.'
      },
      {
        speaker: 'Lehrer',
        text: 'Beispiel: Ich bin gestern zum Bahnhof gefahren. Übung: Kursbuch Seite 42 Aufgabe 3.'
      }
    ]
  };
  let idempLesson: Lesson = {
    ...week2Lesson,
    id: 'les_idemp_1',
    date: '2026-12-14',
    time: '17:00'
  };
  const syncRun1 = await syncGrainRecordingsIncrementally({
    lessons: [idempLesson],
    groups: [renamedMontagGroup],
    students: [stMon1],
    onUpdateLesson: (_id, patch) => {
      idempLesson = { ...idempLesson, ...patch };
    }
  });
  assert.equal(syncRun1.success, true);
  assert.equal(idempLesson.recordingLink, 'https://grain.com/share/recording/rec_sync_idemp_1');
  assert.equal(
    idempLesson.grainMeta?.extractedLessonContent?.transcriptStatus,
    'complete'
  );
  const fpAfterSync1 = idempLesson.grainMeta?.extractedLessonContent?.sourceContentFingerprint;

  const syncRun2 = await syncGrainRecordingsIncrementally({
    lessons: [idempLesson],
    groups: [renamedMontagGroup],
    students: [stMon1]
  });
  assert.equal(syncRun2.newCount, 0, 'Repeated sync must not treat existing recording as new');
  assert.equal(
    syncRun2.lessonPatches?.['les_idemp_1']?.whatWasTaught,
    undefined,
    'Repeated sync with same fingerprint must not duplicate or rewrite lesson content'
  );
  assert.equal(idempLesson.grainMeta?.extractedLessonContent?.sourceContentFingerprint, fpAfterSync1);

  // Case 11: Teacher corrections & disabled rules
  const targetWrongGroupLesson: Lesson = {
    ...week2Lesson,
    id: 'les_wrong_auto',
    date: '2026-12-21',
    time: '17:00',
    recordingLink: 'https://grain.com/share/recording/rec_to_correct'
  };
  const targetRightLesson: Lesson = {
    ...week2Lesson,
    id: 'les_right_manual',
    groupId: 'grp_parallel_17',
    groupName: 'Parallel B2',
    date: '2026-12-21',
    time: '17:00',
    attendance: { st_p1: 'present' }
  };
  const corrResult = correctGrainRecordingAssignment({
    recording: {
      id: 'rec_to_correct',
      title: 'Montag B1 Zoom Session',
      startDatetime: mkLocalIso('2026-12-21', '17:00'),
      durationSeconds: 2400,
      durationMinutes: 40,
      recordingUrl: 'https://grain.com/share/recording/rec_to_correct',
      sourcePlatform: 'zoom',
      matchedGroupId: 'grp_montag_b1',
      suggestedLessonId: 'les_wrong_auto',
      matchStatus: 'automatically_matched',
      confidenceScore: 92,
      candidates: [],
      matchReasons: [],
      importedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    },
    targetLesson: targetRightLesson,
    previousLesson: targetWrongGroupLesson,
    groups: [renamedMontagGroup, groupParallelSameTime],
    students: [stMon1, stPar1]
  });
  assert.equal(corrResult.previousLessonPatch?.recordingLink, undefined, 'Old auto-linked lesson must be detached');
  assert.equal(corrResult.targetLessonPatch.recordingLink, 'https://grain.com/share/recording/rec_to_correct');
  const ruleToDisable = corrResult.updatedLearningRecords.find((r) => r.groupId === 'grp_parallel_17');
  assert.ok(ruleToDisable);
  const afterDisable = setGrainLearningRuleEnabled(ruleToDisable!.id, false, [renamedMontagGroup, groupParallelSameTime]);
  assert.equal(afterDisable.find((r) => r.id === ruleToDisable!.id)?.ruleEnabled, false);
  const afterDelete = deleteGrainLearningRule(ruleToDisable!.id, [renamedMontagGroup, groupParallelSameTime]);
  assert.equal(afterDelete.some((r) => r.id === ruleToDisable!.id), false);

  // Case 12: Transcript unavailable -> clear status, ZERO fabricated content
  const noTranscriptExtracted = await extractStructuredLessonContentForLesson({
    lesson: { ...week2Lesson, id: 'les_no_tr', grainMeta: { recordingId: 'rec_missing_tr' } as any },
    recordings: []
  });
  assert.equal(noTranscriptExtracted.transcriptStatus, 'transcript_unavailable');
  assert.equal(noTranscriptExtracted.themaDerStunde, '');
  assert.equal(noTranscriptExtracted.neueWoerterUndRedemittel.length, 0);
  assert.equal(noTranscriptExtracted.formattedLessonSummaryDe, '');

  // Case 13: Two-part transcript merging & duplicate removal across all 7 German sections
  const mergedTwoPart = await extractStructuredLessonContentForLesson({
    lesson: {
      ...week2Lesson,
      id: 'les_merged_2p',
      grainMeta: {
        recordingId: 'rec_p1_m',
        recordingIdPart2: 'rec_p2_m'
      } as any
    },
    providedPart1Transcript:
      'Lehrer: Thema der Stunde: Akkusativ und der Bahnhof. Heute lernen wir der Bahnhof und die Fahrkarte. Beispiel: Ich kaufe eine Fahrkarte. Übung: Dialog Seite 12. Ist der Akkusativ jetzt klar?',
    providedPart2Transcript:
      'Lehrer: Wir wiederholen der Bahnhof und die Fahrkarte. Beispiel: Ich kaufe eine Fahrkarte. Außerdem lernen wir das Gleis. Übung: Dialog Seite 12. Wir müssen Wechselpräpositionen noch üben.'
  });
  assert.equal(mergedTwoPart.transcriptStatus, 'complete');
  assert.equal(mergedTwoPart.partCount, 2);
  assert.equal(mergedTwoPart.sourceRecordingIds.length, 2);
  // Ensure 'Bahnhof' and 'Fahrkarte' appear only ONCE (deduplicated across Part 1 + Part 2)
  const bahnhofCount = mergedTwoPart.neueWoerterUndRedemittel.filter((v) => v.german === 'Bahnhof').length;
  const fahrkarteCount = mergedTwoPart.neueWoerterUndRedemittel.filter((v) => v.german === 'Fahrkarte').length;
  assert.equal(bahnhofCount, 1, 'Duplicate German noun across Part 1 and Part 2 must be deduplicated');
  assert.equal(fahrkarteCount, 1, 'Duplicate German noun across Part 1 and Part 2 must be deduplicated');
  assert.equal(
    mergedTwoPart.beispiele.filter((b) => b.includes('Ich kaufe eine Fahrkarte')).length,
    1,
    'Duplicate example sentence across Part 1 and Part 2 must be deduplicated'
  );
  assert.equal(mergedTwoPart.grammatik.some((g) => g.topic.includes('Akkusativ')), true);
  assert.equal(mergedTwoPart.uebungenUndAktivitaeten.length >= 1, true);
  assert.equal(mergedTwoPart.offenePunkte.length >= 1, true);
  assert.equal(mergedTwoPart.formattedLessonSummaryDe.includes('Thema der Stunde:'), true);

  // Case 14: Preservation of teacher-edited lesson summaries (pendingUpdatedExtraction)
  let teacherLesson: Lesson = {
    ...week2Lesson,
    id: 'les_teacher_edit'
  };
  const initialApply = applyExtractedLessonContentToLesson(teacherLesson, mergedTwoPart);
  teacherLesson = { ...teacherLesson, ...initialApply.lessonPatch };

  const teacherEditPatch = saveTeacherEditedGrainLessonContent(teacherLesson, {
    themaDerStunde: 'Eigene Lehrkraft-Zusammenfassung: Akkusativ',
    behandelteInhalte: ['Von der Lehrkraft bearbeiteter Inhalt']
  });
  teacherLesson = { ...teacherLesson, ...teacherEditPatch };
  assert.equal(teacherLesson.grainMeta?.extractedLessonContent?.teacherEdited, true);

  // New Part 2 arrives with different fingerprint -> must preserve teacher text & store in pendingUpdatedExtraction
  const newerPart2Arrival = await extractStructuredLessonContentForLesson({
    lesson: teacherLesson,
    providedPart1Transcript: 'Lehrer: Thema der Stunde: Dativ mit dem Zug. Ich fahre mit dem Zug.',
    providedPart2Transcript: 'Lehrer: Übung: Kursbuch Seite 55.'
  });
  const afterNewArrival = applyExtractedLessonContentToLesson(teacherLesson, newerPart2Arrival);
  assert.equal(afterNewArrival.preservedTeacherEdits, true);
  teacherLesson = { ...teacherLesson, ...afterNewArrival.lessonPatch };
  assert.equal(
    teacherLesson.whatWasTaught?.includes('Von der Lehrkraft bearbeiteter Inhalt'),
    true,
    'Teacher-edited summary must NEVER be overwritten automatically when new extraction arrives'
  );
  assert.ok(
    teacherLesson.grainMeta?.extractedLessonContent?.pendingUpdatedExtraction,
    'New extraction must be saved in pendingUpdatedExtraction for optional teacher merge'
  );

  // Teacher explicitly accepts pending extraction
  const acceptPatch = acceptPendingUpdatedLessonExtraction(teacherLesson);
  teacherLesson = { ...teacherLesson, ...acceptPatch };
  assert.equal(teacherLesson.grainMeta?.extractedLessonContent?.pendingUpdatedExtraction, undefined);
  assert.equal(teacherLesson.whatWasTaught?.includes('Dativ'), true);

  // Case 15: No transcript leakage into backups or P2P sync even with 7-section extracted content
  const dirtyTeacherLesson: any = {
    ...teacherLesson,
    updatedAt: Date.now(),
    originRevision: 1,
    rawTranscript: 'SECRET_SHOULD_BE_STRIPPED',
    transcript: 'SECRET_SPEAKER_LINE'
  };
  const p2pDeltaPayload = buildOutboundDelta(
    'peer_desktop_1',
    {},
    { lessons: [dirtyTeacherLesson] },
    { id: 'dev_test', name: 'Teacher Device' },
    { forceFull: true }
  );
  const backupOut = validateAndSanitizeBackupPayload({
    version: '2.0.0',
    appVersion: '3.0.0',
    createdAt: new Date().toISOString(),
    deviceSource: 'web',
    data: {
      lessons: [dirtyTeacherLesson],
      students: [stMon1],
      groups: [renamedMontagGroup],
      payments: []
    }
  });
  const backupStr = JSON.stringify(backupOut);
  const deltaStr = JSON.stringify(p2pDeltaPayload);
  assert.equal(backupStr.includes('rawTranscript'), false);
  assert.equal(deltaStr.includes('SECRET_SHOULD_BE_STRIPPED'), false);
  assert.equal(deltaStr.includes('SECRET_SPEAKER_LINE'), false);
  assert.equal(deltaStr.includes('extractedLessonContent'), true, 'Sanitized 7-section summary may sync safely');

  // Case 16: Timezone and Daylight-Saving (DST) edge cases (summer CEST +02:00 vs winter CET +01:00)
  const cetWinterIso = '2026-11-02T16:00:00Z'; // 17:00 CET (+01:00)
  const cestSummerIso = '2026-07-06T15:00:00Z'; // 17:00 CEST (+02:00)
  const tzOffsetLocal = new Date(2026, 6, 6, 17, 0, 0).toISOString();
  assert.equal(Boolean(cetWinterIso && cestSummerIso && tzOffsetLocal), true);
  // Evaluate summer lesson using exact local ISO string
  const summerLesson: Lesson = {
    ...week2Lesson,
    id: 'les_dst_summer',
    date: '2026-07-06',
    time: '17:00'
  };
  const summerRec = {
    id: 'rec_dst_summer',
    // Identifier gate: the recording carries the group's standardized Zoom
    // topic so it passes the gate; the DST goal of this test is unaffected.
    title: 'Monday - 17:00 - Montag B1 Intensiv Neu',
    startDatetime: tzOffsetLocal,
    durationSeconds: 2400,
    durationMinutes: 40,
    recordingUrl: 'https://grain.com/share/recording/rec_dst_summer',
    sourcePlatform: 'zoom',
    participantNames: ['Amira K.']
  } as any;
  const evalSummer = evaluateRecordingMatchAgainstLessons(
    summerRec,
    [summerLesson],
    [renamedMontagGroup],
    [stMon1],
    []
  );
  assert.equal(
    evalSummer.suggestedLessonId,
    'les_dst_summer',
    'DST summer local time must match lesson.date + lesson.time accurately without off-by-1h drift'
  );

  // ---------------------------------------------------------------------------
  // 13. GRAIN-ONLY EXTRACTION (NO GEMINI), COMBINED TRANSCRIPT + AI NOTES & PRIVACY
  // ---------------------------------------------------------------------------
  console.log('13. Testing Grain-Only Extraction (Transcript + AI Notes, Late Notes, Zero Gemini)...');

  // Case 17: Verify Grain extraction works with GEMINI_API_KEY deleted and never calls Gemini endpoints
  const prevGeminiEnv = process.env.GEMINI_API_KEY;
  const origGlobalFetch = globalThis.fetch;
  delete process.env.GEMINI_API_KEY;
  let calledGeminiGrainEndpoint = false;
  (globalThis as any).fetch = async (input: any, init?: any) => {
    const urlStr = typeof input === 'string' ? input : String(input?.url || '');
    if (urlStr.includes('/api/grain/extract-lesson-content')) {
      calledGeminiGrainEndpoint = true;
      throw new Error('Grain extraction must never call /api/grain/extract-lesson-content');
    }
    return origGlobalFetch(input, init);
  };

  try {
    const grainProxySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/grainServerProxy.ts'),
      'utf8'
    );
    assert.equal(
      grainProxySource.includes('@google/genai'),
      false,
      'grainServerProxy.ts must not import @google/genai'
    );
    assert.equal(
      grainProxySource.includes('extract-lesson-content'),
      false,
      'grainServerProxy.ts must not expose /api/grain/extract-lesson-content'
    );

    // Case 18: Combined Grain Transcript + AI Notes (ai_summary, ai_template_sections, highlights, ai_action_items) across Part 1 & Part 2
    mockTranscripts['rec_combo_p1'] = {
      transcript: [
        {
          speaker: 'Lehrer',
          text: 'Thema der Stunde: Präteritum und Modalverben. Heute lernen wir der Zug und die Verspätung. Beispiel: Der Zug hatte zehn Minuten Verspätung.'
        }
      ]
    };
    mockRecordingDetails['rec_combo_p1'] = {
      id: 'rec_combo_p1',
      ai_summary: 'Behandelte Inhalte: Wiederholung von müssen und können im Präteritum.',
      ai_template_sections: [
        {
          title: 'Grammatik',
          bullets: ['Modalverben im Präteritum: musste, konnte, durfte']
        },
        {
          title: 'Neue Wörter',
          content: 'der Anschluss, die Durchsage'
        }
      ],
      highlights: [
        {
          text: 'Übung: Hörverstehen Bahnhofs-Durchsage Seite 64.',
          timestamp: '00:14:20'
        }
      ],
      ai_action_items: [
        { text: 'Arbeitsbuch Seite 65 Aufgabe 1 bis Montag erledigen' }
      ]
    };
    mockTranscripts['rec_combo_p2'] = {
      transcript: [
        {
          speaker: 'Lehrer',
          text: 'Wir wiederholen der Zug und die Verspätung. Beispiel: Der Zug hatte zehn Minuten Verspätung. Beispiel: Ich musste umsteigen.'
        }
      ]
    };
    mockRecordingDetails['rec_combo_p2'] = {
      id: 'rec_combo_p2',
      ai_summary: 'Behandelte Inhalte: Konversation am Fahrkartenschalter.',
      ai_template_sections: [
        {
          title: 'Grammatik',
          bullets: ['Modalverben im Präteritum: musste, konnte, durfte'] // duplicate of P1 -> must deduplicate
        }
      ],
      ai_action_items: [
        { text: 'Arbeitsbuch Seite 65 Aufgabe 1 bis Montag erledigen' }, // duplicate of P1 -> must deduplicate
        { text: 'Unregelmäßige Formen von wollen wiederholen' }
      ]
    };

    const comboExtracted = await extractStructuredLessonContentForLesson({
      lesson: {
        ...week2Lesson,
        id: 'les_combo_grain_only',
        grainMeta: {
          recordingId: 'rec_combo_p1',
          recordingIdPart2: 'rec_combo_p2'
        } as any
      },
      recordings: []
    });
    assert.equal(calledGeminiGrainEndpoint, false);
    assert.equal(comboExtracted.origin, 'grain_transcript_and_notes');
    assert.deepEqual(comboExtracted.sourceKinds, ['transcript', 'ai_notes']);
    assert.equal(comboExtracted.transcriptStatus, 'complete');
    assert.equal(comboExtracted.partCount, 2);
    assert.equal(comboExtracted.themaDerStunde.includes('Präteritum'), true);
    assert.equal(
      comboExtracted.behandelteInhalte.some((c) => c.includes('Konversation am Fahrkartenschalter')),
      true,
      'AI Notes from Part 2 must be merged into behandelteInhalte'
    );
    assert.equal(
      comboExtracted.neueWoerterUndRedemittel.some((v) => v.german === 'Zug'),
      true,
      'Vocabulary from Transcript must be preserved when AI Notes are also present'
    );
    assert.equal(
      comboExtracted.neueWoerterUndRedemittel.some((v) => v.german === 'Anschluss'),
      true,
      'Vocabulary from AI Notes ai_template_sections must be combined with Transcript'
    );
    assert.equal(
      comboExtracted.neueWoerterUndRedemittel.filter((v) => v.german === 'Verspätung').length,
      1,
      'Vocabulary repeated across Part 1 and Part 2 must be deduplicated'
    );
    assert.equal(
      comboExtracted.beispiele.filter((b) => b.includes('zehn Minuten Verspätung')).length,
      1,
      'Duplicate examples across Part 1 and Part 2 must be deduplicated'
    );
    assert.equal(
      comboExtracted.beispiele.some((b) => b.includes('Ich musste umsteigen')),
      true
    );
    assert.equal(
      comboExtracted.grammatik.filter((g) => g.topic === 'Präteritum von sein, haben und Modalverben').length,
      1,
      'Präteritum grammar rule across Part 1 and Part 2 must be deduplicated'
    );
    assert.equal(
      comboExtracted.grammatik.filter((g) => g.topic.includes('Modalverben im Präteritum')).length,
      1,
      'Duplicate grammar bullet across AI Notes Part 1 and Part 2 must be extracted and deduplicated'
    );
    assert.equal(
      comboExtracted.uebungenUndAktivitaeten.some((u) => u.includes('Bahnhofs-Durchsage')),
      true,
      'Highlights with Übung must populate uebungenUndAktivitaeten'
    );
    assert.equal(
      comboExtracted.offenePunkte.filter((o) => o.includes('Arbeitsbuch Seite 65')).length,
      1,
      'ai_action_items must populate offenePunkte and deduplicate across Part 1 & Part 2'
    );
    assert.equal(
      comboExtracted.offenePunkte.some((o) => o.includes('Unregelmäßige Formen von wollen wiederholen')),
      true
    );

    // Case 19: AI Notes-only extraction when Transcript returns 404
    mockRecordingDetails['rec_notes_only'] = {
      id: 'rec_notes_only',
      ai_summary: 'Thema der Stunde: Einkaufen im Supermarkt. Behandelte Inhalte: Preise und Mengen angeben.',
      ai_template_sections: [
        { title: 'Neue Wörter', bullets: ['das Angebot', 'die Quittung'] },
        { title: 'Beispiele', bullets: ['Wie viel kostet das Kilo Äpfel?'] }
      ],
      ai_action_items: [{ text: 'Einkaufsliste auf Deutsch schreiben' }]
    };
    const notesOnlyExtracted = await extractStructuredLessonContentForLesson({
      lesson: {
        ...week2Lesson,
        id: 'les_notes_only',
        grainMeta: { recordingId: 'rec_notes_only' } as any
      },
      recordings: []
    });
    assert.equal(notesOnlyExtracted.transcriptStatus, 'complete');
    assert.deepEqual(notesOnlyExtracted.sourceKinds, ['ai_notes']);
    assert.equal(notesOnlyExtracted.themaDerStunde.includes('Einkaufen im Supermarkt'), true);
    assert.equal(notesOnlyExtracted.neueWoerterUndRedemittel.some((v) => v.german === 'Quittung'), true);
    assert.equal(notesOnlyExtracted.beispiele.some((b) => b.includes('Kilo Äpfel')), true);
    assert.equal(notesOnlyExtracted.offenePunkte.some((o) => o.includes('Einkaufsliste')), true);

    // Case 20: Late-arriving AI Notes during subsequent sync trigger reprocessing & preserve teacher edits
    saveGrainGroupLearningRecords([]);
    recordConfirmedGrainGroupLearning({
      lesson: week1Lesson,
      recording: recW1P1,
      groups: [renamedMontagGroup],
      students: [stMon1]
    });

    const lateDate = '2026-12-28'; // Monday
    const lateRecId = 'rec_late_notes_1';
    mockRemoteRecordings.push({
      id: lateRecId,
      title: 'Montag B1 Zoom Session',
      start_datetime: mkLocalIso(lateDate, '17:00'),
      duration_seconds: 2400,
      url: `https://grain.com/share/recording/${lateRecId}`,
      public_url: `https://grain.com/share/recording/${lateRecId}`,
      share_state: 'public',
      source: 'zoom',
      participants: [{ name: 'Amira K.' }]
    });
    mockTranscripts[lateRecId] = {
      transcript: [
        { speaker: 'Lehrer', text: 'Thema der Stunde: Wegbeschreibung in der Stadt. Beispiel: Gehen Sie geradeaus.' }
      ]
    };

    let lateLesson: Lesson = {
      ...week2Lesson,
      id: 'les_late_notes',
      date: lateDate,
      time: '17:00'
    };

    // Sync 1: Only transcript is ready (no AI Notes yet)
    const lateSync1 = await syncGrainRecordingsIncrementally({
      lessons: [lateLesson],
      groups: [renamedMontagGroup],
      students: [stMon1],
      onUpdateLesson: (_id, patch) => {
        lateLesson = { ...lateLesson, ...patch };
      }
    });
    assert.equal(lateSync1.success, true);
    assert.deepEqual(lateLesson.grainMeta?.extractedLessonContent?.sourceKinds, ['transcript']);
    const fpBeforeLateNotes = lateLesson.grainMeta?.extractedLessonContent?.sourceContentFingerprint;
    assert.ok(fpBeforeLateNotes);

    // Teacher edits lesson manually
    lateLesson = {
      ...lateLesson,
      ...saveTeacherEditedGrainLessonContent(lateLesson, {
        themaDerStunde: 'Lehrkraft-Notiz: Wegbeschreibung',
        behandelteInhalte: ['Manuelle Lehrer-Zusammenfassung bleibt geschützt']
      })
    };

    // Sync 2 (before AI Notes exist): Idempotent — no update queued
    const lateSync2 = await syncGrainRecordingsIncrementally({
      lessons: [lateLesson],
      groups: [renamedMontagGroup],
      students: [stMon1],
      onUpdateLesson: (_id, patch) => {
        lateLesson = { ...lateLesson, ...patch };
      }
    });
    assert.equal(lateSync2.lessonPatches?.['les_late_notes'], undefined);
    assert.equal(lateLesson.grainMeta?.extractedLessonContent?.pendingUpdatedExtraction, undefined);

    // Grain finishes AI Notes later -> remote recording_details now returns AI Notes + action items
    mockRecordingDetails[lateRecId] = {
      ai_summary: 'Behandelte Inhalte: Präpositionen mit Dativ bei Wegbeschreibungen.',
      ai_template_sections: [
        { title: 'Neue Wörter', bullets: ['die Kreuzung', 'die Ampel'] }
      ],
      ai_action_items: [{ text: 'Stadtplan-Übung bis Mittwoch lösen' }]
    };

    // Sync 3: Late-arriving AI Notes change fingerprint, trigger reprocessing, preserve teacher text, populate pendingUpdatedExtraction
    const lateSync3 = await syncGrainRecordingsIncrementally({
      lessons: [lateLesson],
      groups: [renamedMontagGroup],
      students: [stMon1],
      onUpdateLesson: (_id, patch) => {
        lateLesson = { ...lateLesson, ...patch };
      }
    });
    assert.ok(lateSync3.lessonPatches?.['les_late_notes'], 'Late-arriving AI Notes must trigger lesson reprocessing');
    assert.equal(
      lateLesson.whatWasTaught?.includes('Manuelle Lehrer-Zusammenfassung bleibt geschützt'),
      true,
      'Teacher edits must be preserved when late AI Notes arrive'
    );
    const queuedPending = lateLesson.grainMeta?.extractedLessonContent?.pendingUpdatedExtraction;
    assert.ok(queuedPending, 'Updated extraction with late AI Notes must be stored in pendingUpdatedExtraction');
    assert.notEqual(queuedPending!.sourceContentFingerprint, fpBeforeLateNotes);
    assert.equal(
      queuedPending!.neueWoerterUndRedemittel.some((v) => v.german === 'Kreuzung'),
      true
    );
    assert.equal(
      queuedPending!.offenePunkte.some((o) => o.includes('Stadtplan-Übung')),
      true
    );

    // Sync 4 (same late AI Notes): Strictly idempotent — already in pendingUpdatedExtraction
    const lateSync4 = await syncGrainRecordingsIncrementally({
      lessons: [lateLesson],
      groups: [renamedMontagGroup],
      students: [stMon1],
      onUpdateLesson: (_id, patch) => {
        lateLesson = { ...lateLesson, ...patch };
      }
    });
    assert.equal(
      lateSync4.lessonPatches?.['les_late_notes'],
      undefined,
      'Repeated sync after pendingUpdatedExtraction was queued must remain idempotent'
    );

    // Case 21: Neither Transcript nor AI Notes exist -> transcript_unavailable & zero fabricated content
    const emptyExtraction = await extractStructuredLessonContentForLesson({
      lesson: {
        ...week2Lesson,
        id: 'les_totally_empty_grain',
        grainMeta: { recordingId: 'rec_neither_tr_nor_notes' } as any
      },
      recordings: []
    });
    assert.equal(emptyExtraction.transcriptStatus, 'transcript_unavailable');
    assert.deepEqual(emptyExtraction.sourceKinds, []);
    assert.equal(emptyExtraction.themaDerStunde, '');
    assert.equal(emptyExtraction.behandelteInhalte.length, 0);
    assert.equal(emptyExtraction.neueWoerterUndRedemittel.length, 0);
    assert.equal(emptyExtraction.grammatik.length, 0);
    assert.equal(emptyExtraction.beispiele.length, 0);
    assert.equal(emptyExtraction.uebungenUndAktivitaeten.length, 0);
    assert.equal(emptyExtraction.offenePunkte.length, 0);
    assert.equal(emptyExtraction.formattedLessonSummaryDe, '');

    // Case 22: Privacy check — raw AI Notes fields and transcripts stripped from P2P, Backup, and Firebase partitions
    const dirtyNotesLesson: any = {
      ...lateLesson,
      updatedAt: Date.now(),
      originRevision: 2,
      rawTranscript: 'SECRET_RAW_TRANSCRIPT_TEXT',
      transcript: 'SECRET_TRANSCRIPT_ARRAY',
      rawAiNotes: 'SECRET_RAW_AI_NOTES_BLOB',
      ai_template_sections: [{ title: 'Secret', content: 'SECRET_AI_TEMPLATE_SECTION' }],
      highlights: [{ text: 'SECRET_HIGHLIGHT_TEXT' }],
      ai_action_items: [{ text: 'SECRET_RAW_ACTION_ITEM' }]
    };
    const p2pClean = JSON.stringify(
      buildOutboundDelta(
        'peer_tablet_2',
        {},
        { lessons: [dirtyNotesLesson] },
        { id: 'dev_test', name: 'Teacher Device' },
        { forceFull: true }
      )
    );
    const backupClean = JSON.stringify(
      validateAndSanitizeBackupPayload({
        version: '2.0.0',
        appVersion: '3.0.0',
        createdAt: new Date().toISOString(),
        deviceSource: 'web',
        data: {
          lessons: [dirtyNotesLesson],
          students: [stMon1],
          groups: [renamedMontagGroup],
          payments: []
        }
      })
    );
    const firebasePartitions = JSON.stringify(
      partitionBackupPayload({
        lessons: [dirtyNotesLesson],
        students: [stMon1],
        groups: [renamedMontagGroup],
        payments: []
      } as any)
    );
    for (const secretMarker of [
      'SECRET_RAW_TRANSCRIPT_TEXT',
      'SECRET_TRANSCRIPT_ARRAY',
      'SECRET_RAW_AI_NOTES_BLOB',
      'SECRET_AI_TEMPLATE_SECTION',
      'SECRET_HIGHLIGHT_TEXT',
      'SECRET_RAW_ACTION_ITEM'
    ]) {
      assert.equal(p2pClean.includes(secretMarker), false, `P2P delta must strip ${secretMarker}`);
      assert.equal(backupClean.includes(secretMarker), false, `Backup must strip ${secretMarker}`);
      assert.equal(firebasePartitions.includes(secretMarker), false, `Firebase sync must strip ${secretMarker}`);
    }
  } finally {
    (globalThis as any).fetch = origGlobalFetch;
    if (prevGeminiEnv !== undefined) process.env.GEMINI_API_KEY = prevGeminiEnv;
    else delete process.env.GEMINI_API_KEY;
  }

  // Clean up ephemeral tests
  await disconnectGrainAccount();

  __setGrainServiceTestAdapter(null);
  __setGrainServerUpstreamFetchForTesting(null);

  console.log('=== All Glück × Grain Integration Tests Passed Successfully! ===');
}

runGrainIntegrationTests().catch((err) => {
  console.error('Grain Integration Test Failed:', err);
  process.exit(1);
});
