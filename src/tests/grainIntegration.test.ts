import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  redactGrainSecrets,
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
  __setGrainServiceTestAdapter
} from '../services/grainService';
import {
  buildWhitelistedGrainTarget,
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
      title: 'Deutschstunde',
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
  assert.equal(
    matchNoZoom.matchStatus === 'strong_match' || matchNoZoom.matchStatus === 'suggested_match',
    true,
    'Recording without Zoom link must match on date + start time + student-group evidence'
  );
  assert.equal(matchNoZoom.suggestedLessonId, 'lesson_no_zoom_1');

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

  __setGrainServiceTestAdapter(null);
  __setGrainServerUpstreamFetchForTesting(null);

  console.log('=== All Glück × Grain Integration Tests Passed Successfully! ===');
}

runGrainIntegrationTests().catch((err) => {
  console.error('Grain Integration Test Failed:', err);
  process.exit(1);
});
