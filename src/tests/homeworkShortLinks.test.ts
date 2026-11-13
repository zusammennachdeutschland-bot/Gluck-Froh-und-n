import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import expressApp, {
  resetHomeworkStoresForTesting,
  setGooglePublicCertsCacheForTesting
} from '../api/expressApp';
import {
  buildHomeworkShareUrl,
  buildShortHomeworkShareUrl,
  buildLegacyHomeworkShareUrl,
  createHomeworkShortId,
  createHomeworkAssignmentId,
  createHomeworkShareToken,
  extractShortIdFromPathname,
  isValidHomeworkShortId,
  resolveHomeworkShortLink,
  saveAssignmentWithConfirmation,
  __setHomeworkSyncTransportForTests,
  __setHomeworkAuthUserForTests,
  getLocalAssignments,
  getAuthorizedGroupStudentsForAssignment,
  validateHomeworkSubmissionIdentity
} from '../shared/homeworkStorageSync';
import { getInMemoryAdminFirestore } from '../server/firebaseAdmin';
import { HomeworkAssignment } from '../shared/homeworkTypes';

(globalThis as any).__TEST_ENV__ = true;

const testRsaKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

setGooglePublicCertsCacheForTesting(
  { valid_test_kid_shortlinks: testRsaKeyPair.publicKey },
  Date.now() + 86400000
);

function makeTestBearerToken(uid: string, email = `${uid}@glueck.de`): string {
  const header = { alg: 'RS256', kid: 'valid_test_kid_shortlinks', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/glueck-c8621',
    aud: 'glueck-c8621',
    sub: uid,
    email,
    iat: nowSec - 10,
    auth_time: nowSec - 10,
    exp: nowSec + 3600
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${b64Header}.${b64Payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(testRsaKeyPair.privateKey, 'base64url');
  return `${unsigned}.${signature}`;
}

class MemoryLocalStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

function createSampleAssignment(overrides: Partial<HomeworkAssignment> = {}): HomeworkAssignment {
  return {
    id: overrides.id || createHomeworkAssignmentId(),
    shortId: overrides.shortId !== undefined ? overrides.shortId : createHomeworkShortId(7),
    shareToken: overrides.shareToken || createHomeworkShareToken(),
    ownerUid: overrides.ownerUid || 'teacher_uid_alpha',
    ownerEmail: overrides.ownerEmail || 'alpha@glueck.de',
    title: overrides.title || 'واجب الدرس الأول',
    setSnapshot: overrides.setSnapshot || {
      id: 'set_a1_1',
      title: 'تحيات وأساسيات',
      category: 'A1',
      items: [
        { id: 'w1', german: 'das Buch', arabic: 'الكتاب', emoji: '📘' },
        { id: 'w2', german: 'die Schule', arabic: 'المدرسة', emoji: '🏫' }
      ]
    },
    selectedItemIds: overrides.selectedItemIds || ['w1', 'w2'],
    flowMode: 'teacher_then_quiz',
    questionTypes: ['true_false', 'choice_2'],
    blooketMode: 'classic_quiz',
    allowedGameModes: ['classic_quiz'],
    questionCount: 4,
    targetQuestionCount: 4,
    audienceMode: overrides.audienceMode || 'open',
    groupId: overrides.groupId,
    groupName: overrides.groupName,
    assignedStudents: overrides.assignedStudents,
    maxAttempts: 3,
    allowReplay: true,
    isActive: overrides.isActive ?? true,
    status: overrides.status || 'active',
    createdAt: new Date().toISOString(),
    createdBy: 'Teacher',
    ...overrides
  };
}

async function runHomeworkShortLinksTests() {
  console.log('================================================================================');
  console.log('HOMEWORK INTERNAL SHORT LINKS (/Herr-Abdul-rahman/{SHORT_ID}) VERIFICATION SUITE');
  console.log('================================================================================');

  const memStorage = new MemoryLocalStorage();
  (globalThis as any).localStorage = memStorage;
  (globalThis as any).window = {
    localStorage: memStorage,
    location: {
      origin: 'https://glueck-lernstudio.vercel.app',
      pathname: '/'
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  if (typeof CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, opts?: any) {
        this.type = type;
        this.detail = opts?.detail;
      }
    };
  }

  const server = expressApp.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const inMemDb = getInMemoryAdminFirestore();

  const tokenAlpha = makeTestBearerToken('teacher_uid_alpha', 'alpha@glueck.de');
  const tokenBeta = makeTestBearerToken('teacher_uid_beta', 'beta@glueck.de');

  try {
    resetHomeworkStoresForTesting();
    memStorage.clear();

    // -------------------------------------------------------------------------
    // TEST 1: Creating and opening a new short homework link
    // -------------------------------------------------------------------------
    console.log('Testing [SL-01] Creating and formatting /Herr-Abdul-rahman/{SHORT_ID} short link...');
    const hw1 = createSampleAssignment({
      id: 'hw_internal_987654',
      ownerUid: 'teacher_uid_alpha'
    });
    assert.ok(hw1.shortId, 'Assignment must have a generated shortId');
    assert.equal(hw1.shortId!.length, 7, 'Generated shortId must be 7 characters');
    assert.ok(isValidHomeworkShortId(hw1.shortId), 'Generated shortId must be URL-safe alphanumeric');
    assert.ok(!hw1.shortId!.includes(hw1.id), 'shortId must never expose internal homework ID');

    const shortUrl = buildHomeworkShareUrl(hw1, 'https://glueck-lernstudio.vercel.app');
    assert.equal(
      shortUrl,
      `https://glueck-lernstudio.vercel.app/Herr-Abdul-rahman/${hw1.shortId}`,
      'Share URL must match https://YOUR_DOMAIN/Herr-Abdul-rahman/{SHORT_ID}'
    );
    assert.ok(!shortUrl.includes('?'), 'Short URL must not contain query parameters or sensitive metadata');
    assert.ok(!shortUrl.includes(hw1.shareToken!), 'Short URL must not expose internal shareToken');
    assert.ok(!shortUrl.includes(hw1.ownerUid!), 'Short URL must not expose teacher ownerUid');

    // Save via authoritative teacher endpoint
    const createRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify(hw1)
    });
    assert.equal(createRes.status, 200, 'Teacher assignment creation must succeed');
    const createdData = (await createRes.json()) as any;
    assert.equal(createdData.assignment.shortId, hw1.shortId);

    // Verify Firestore short-link mapping doc was persisted
    const shortDocSnap = await inMemDb.collection('homework_short_links').doc(hw1.shortId!).get();
    assert.equal(shortDocSnap.exists, true, 'homework_short_links/{shortId} must be persisted in Firestore');
    console.log('✅ [SL-01] Short link created and persisted with exact /Herr-Abdul-rahman/{SHORT_ID} format');

    // -------------------------------------------------------------------------
    // TEST 2: Opening the same link on another device (unauthenticated student) & submitting
    // -------------------------------------------------------------------------
    console.log('Testing [SL-02] Opening short link on another device & submitting homework...');
    memStorage.clear(); // Simulate clean student device with empty localStorage

    const resolveApiRes = await fetch(`${baseUrl}/api/homework/short/${hw1.shortId}`);
    assert.equal(resolveApiRes.status, 200, 'Public short-link resolution must return HTTP 200');
    const resolvedPayload = (await resolveApiRes.json()) as any;
    assert.equal(resolvedPayload.shortId, hw1.shortId);
    assert.equal(resolvedPayload.assignment.id, hw1.id);
    assert.equal(resolvedPayload.assignment.title, hw1.title);
    assert.equal(resolvedPayload.assignment.shareToken, undefined, 'Public DTO must not leak shareToken');
    assert.equal(resolvedPayload.assignment.ownerUid, undefined, 'Public DTO must not leak ownerUid');

    // Student submits homework on the second device using shortId capability
    const submitRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `sub_${hw1.id}_student1`,
        assignmentId: hw1.id,
        shortId: hw1.shortId,
        attemptSecret: 'student_device_secret_12345678',
        audienceMode: 'open',
        participantId: 'pid_omar_1',
        studentName: 'عمر أحمد',
        attemptNumber: 1,
        responses: [
          {
            questionId: 'q1',
            questionType: 'true_false',
            germanWord: 'das Buch',
            studentAnswer: 'صح ✅ (Richtig)',
            correctAnswer: 'صح ✅ (Richtig)',
            isCorrect: true,
            timeSpentSeconds: 4
          }
        ],
        startedAt: new Date(Date.now() - 15000).toISOString(),
        completedAt: new Date().toISOString(),
        goldEarned: 100,
        maxStreak: 1,
        completedStudyPhase: true
      })
    });
    assert.equal(submitRes.status, 200, 'Student submission via shortId must succeed on another device');
    const submitData = (await submitRes.json()) as any;
    assert.equal(submitData.submission.studentName, 'عمر أحمد');
    assert.equal(submitData.submission.scorePercentage, 100);
    console.log('✅ [SL-02] Cross-device short link resolution and student submission succeeded');

    // -------------------------------------------------------------------------
    // TEST 3: Multiple homework links with unique IDs & collision retry handling
    // -------------------------------------------------------------------------
    console.log('Testing [SL-03] Unique IDs across 100 links + collision handling & retry...');
    const generatedSet = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const code = createHomeworkShortId(7, generatedSet);
      assert.equal(code.length, 7);
      assert.ok(isValidHomeworkShortId(code));
      assert.equal(generatedSet.has(code), false, 'Every generated shortId must be unique');
      generatedSet.add(code);
    }

    // Verify server rejects duplicate shortId for a different assignment with 409 SHORT_ID_COLLISION
    const collidingHw = createSampleAssignment({
      id: 'hw_colliding_different_id',
      shortId: hw1.shortId, // Intentional collision with hw1's shortId
      ownerUid: 'teacher_uid_alpha'
    });
    const collisionApiRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify(collidingHw)
    });
    assert.equal(collisionApiRes.status, 409, 'Colliding shortId must return HTTP 409 Conflict');

    // Verify client saveAssignmentWithConfirmation automatically regenerates shortId on SHORT_ID_COLLISION
    __setHomeworkAuthUserForTests({ uid: 'teacher_uid_alpha', email: 'alpha@glueck.de' });
    let saveAttempts = 0;
    const initialForcedShortId = 'Ab3x9Kp';
    __setHomeworkSyncTransportForTests({
      saveAssignment: async (hw) => {
        saveAttempts++;
        if (saveAttempts === 1 && hw.shortId === initialForcedShortId) {
          const err: any = new Error('SHORT_ID_COLLISION');
          err.code = 'SHORT_ID_COLLISION';
          throw err;
        }
        return true;
      },
      fetchAssignment: async (id) => ({
        ...collidingHw,
        id,
        ownerUid: 'teacher_uid_alpha'
      })
    });

    const retryResult = await saveAssignmentWithConfirmation({
      ...collidingHw,
      shortId: initialForcedShortId
    });
    assert.equal(retryResult.cloudSynced, true, 'Save must succeed after collision retry');
    assert.equal(saveAttempts, 2, 'Should retry once after initial collision');
    assert.notEqual(
      retryResult.assignment.shortId,
      initialForcedShortId,
      'Colliding shortId must be replaced with a fresh unique shortId'
    );
    assert.ok(isValidHomeworkShortId(retryResult.assignment.shortId));
    __setHomeworkSyncTransportForTests(null);
    console.log('✅ [SL-03] 100 unique IDs verified and collision retry succeeded');

    // -------------------------------------------------------------------------
    // TEST 4: Deleted and revoked homework links cannot open the homework
    // -------------------------------------------------------------------------
    console.log('Testing [SL-04] Deleting homework automatically revokes its short link...');
    const deleteRes = await fetch(
      `${baseUrl}/api/teacher/assignments?id=${encodeURIComponent(hw1.id)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenAlpha}` }
      }
    );
    assert.equal(deleteRes.status, 200, 'Deleting assignment must succeed');

    const afterDeleteShortRes = await fetch(`${baseUrl}/api/homework/short/${hw1.shortId}`);
    assert.equal(
      afterDeleteShortRes.status,
      410,
      'Deleted homework short link must return HTTP 410 Gone'
    );

    // Submitting to a deleted homework via its shortId must also be rejected
    const submitAfterDeleteRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `sub_${hw1.id}_after_del`,
        assignmentId: hw1.id,
        shortId: hw1.shortId,
        attemptSecret: 'student_device_secret_99999999',
        audienceMode: 'open',
        participantId: 'pid_omar_2',
        studentName: 'عمر أحمد',
        attemptNumber: 1,
        responses: []
      })
    });
    assert.equal(submitAfterDeleteRes.status, 403, 'Deleted homework must reject new submissions');
    console.log('✅ [SL-04] Deleted/revoked homework short links are blocked from opening or submitting');

    // -------------------------------------------------------------------------
    // TEST 5: Invalid, non-existent, and closed/expired links handled gracefully
    // -------------------------------------------------------------------------
    console.log('Testing [SL-05] Invalid, non-existent, and closed links...');
    const invalidFormatRes = await fetch(`${baseUrl}/api/homework/short/bad!`);
    assert.equal(invalidFormatRes.status, 400, 'Malformed shortId must return HTTP 400');

    const localInvalid = await resolveHomeworkShortLink('!!invalid!!');
    assert.equal(localInvalid.status, 'invalid_id');

    const nonExistentRes = await fetch(`${baseUrl}/api/homework/short/Zz9Yx8W`);
    assert.equal(nonExistentRes.status, 404, 'Unknown valid shortId must return HTTP 404');

    // Closed assignment short link must be treated as revoked/unavailable
    const closedHw = createSampleAssignment({
      id: 'hw_closed_test',
      shortId: 'Cl9s3dK',
      ownerUid: 'teacher_uid_alpha',
      isActive: false,
      status: 'closed'
    });
    __setHomeworkSyncTransportForTests({
      fetchShortLink: async (sid) =>
        sid === 'Cl9s3dK'
          ? {
              shortId: 'Cl9s3dK',
              assignmentId: closedHw.id,
              ownerUid: closedHw.ownerUid,
              isActive: false,
              deleted: false,
              status: 'closed',
              assignment: closedHw
            }
          : null
    });
    const closedResolution = await resolveHomeworkShortLink('Cl9s3dK');
    assert.equal(closedResolution.status, 'revoked', 'Closed homework short link must resolve as revoked');
    __setHomeworkSyncTransportForTests(null);
    console.log('✅ [SL-05] Invalid, missing, and closed links handled gracefully');

    // -------------------------------------------------------------------------
    // TEST 6: Firestore offline and synchronization failure scenarios
    // -------------------------------------------------------------------------
    console.log('Testing [SL-06] Firestore offline & sync failure gating...');
    memStorage.clear();
    __setHomeworkAuthUserForTests({ uid: 'teacher_uid_alpha', email: 'alpha@glueck.de' });
    __setHomeworkSyncTransportForTests({
      saveAssignment: async () => false, // Simulate Firestore write failure / offline
      fetchAssignment: async () => null,
      fetchShortLink: async () => {
        throw new Error('Network offline');
      }
    });

    const offlineHw = createSampleAssignment({
      id: 'hw_offline_pending',
      shortId: 'Of7L1nE',
      ownerUid: 'teacher_uid_alpha'
    });
    const offlineSaveRes = await saveAssignmentWithConfirmation(offlineHw);
    assert.equal(
      offlineSaveRes.cloudSynced,
      false,
      'When Firestore write fails, cloudSynced must be false so the UI does not display the short link as cloud-ready'
    );
    const storedLocal = getLocalAssignments('teacher_uid_alpha').find((a) => a.id === offlineHw.id);
    assert.equal(storedLocal?.cloudSynced, false);

    // Simulate another device trying to resolve while network is down
    memStorage.clear();
    const offlineResolve = await resolveHomeworkShortLink('Of7L1nE');
    assert.equal(
      offlineResolve.status,
      'network_error',
      'Offline resolution failure must return network_error status for graceful retry UI'
    );
    __setHomeworkSyncTransportForTests(null);
    console.log('✅ [SL-06] Offline sync gating and network_error recovery verified');

    // -------------------------------------------------------------------------
    // TEST 7: Existing long homework links remain 100% functional
    // -------------------------------------------------------------------------
    console.log('Testing [SL-07] Backward compatibility for existing long homework links...');
    const legacyHw = createSampleAssignment({
      id: 'hw_legacy_long_1',
      shortId: undefined,
      shareToken: 'legacy_share_token_abcdef123456',
      ownerUid: 'teacher_uid_alpha'
    });
    const legacyUrl = buildLegacyHomeworkShareUrl(legacyHw, 'https://glueck-lernstudio.vercel.app');
    assert.ok(
      legacyUrl.startsWith(`https://glueck-lernstudio.vercel.app/homework/${legacyHw.id}?`),
      'Legacy URL builder must preserve /homework/{id}?... format'
    );
    const parsedLegacy = new URL(legacyUrl);
    assert.equal(parsedLegacy.searchParams.get('token'), 'legacy_share_token_abcdef123456');

    await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify({ ...legacyHw, shortId: 'Lg7Cy12' })
    });

    const legacyInfoRes = await fetch(
      `${baseUrl}/api/homework/info?id=${encodeURIComponent(legacyHw.id)}&token=legacy_share_token_abcdef123456`
    );
    assert.equal(legacyInfoRes.status, 200, 'Existing long link with shareToken must still resolve via /api/homework/info');
    console.log('✅ [SL-07] Existing long homework links remain fully functional');

    // -------------------------------------------------------------------------
    // TEST 8: Account and group isolation (no sensitive data in URL, roster enforced)
    // -------------------------------------------------------------------------
    console.log('Testing [SL-08] Account and group isolation on short homework links...');
    const groupHw = createSampleAssignment({
      id: 'hw_group_isolated_1',
      shortId: 'Gr8Up7X',
      ownerUid: 'teacher_uid_alpha',
      audienceMode: 'group',
      groupId: 'grp_b1_stars',
      groupName: 'مجموعة B1 المتفوقين',
      assignedStudents: [
        { id: 'st_1', name: 'سارة محمود', groupId: 'grp_b1_stars' },
        { id: 'st_2', name: 'كريم عادل', groupId: 'grp_b1_stars' }
      ]
    });

    const groupShortUrl = buildShortHomeworkShareUrl(groupHw, 'https://glueck-lernstudio.vercel.app');
    assert.equal(groupShortUrl, 'https://glueck-lernstudio.vercel.app/Herr-Abdul-rahman/Gr8Up7X');
    assert.ok(!groupShortUrl.includes('st_1'), 'Short URL must not expose student IDs');
    assert.ok(!groupShortUrl.includes('grp_b1_stars'), 'Short URL must not expose group IDs');
    assert.ok(!groupShortUrl.includes('سارة'), 'Short URL must not expose student names');

    await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify(groupHw)
    });

    // Teacher Beta must not be able to delete Teacher Alpha's homework or revoke its short link
    const crossTeacherDeleteRes = await fetch(
      `${baseUrl}/api/teacher/assignments?id=${encodeURIComponent(groupHw.id)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenBeta}` }
      }
    );
    assert.equal(crossTeacherDeleteRes.status, 403, 'Another teacher account cannot delete or revoke this homework');

    // Resolve group homework via short link and verify group student isolation
    const resolvedGroupRes = await fetch(`${baseUrl}/api/homework/short/Gr8Up7X`);
    assert.equal(resolvedGroupRes.status, 200);
    const resolvedGroupBody = (await resolvedGroupRes.json()) as any;
    const authorizedStudents = getAuthorizedGroupStudentsForAssignment(resolvedGroupBody.assignment);
    assert.equal(authorizedStudents.length, 2, 'Authorized group roster must be loaded after short link resolution');

    const outsiderCheck = validateHomeworkSubmissionIdentity(resolvedGroupBody.assignment, {
      assignmentId: groupHw.id,
      audienceMode: 'group',
      studentId: 'st_outsider_999',
      groupId: 'grp_b1_stars',
      studentName: 'طالب من خارج المجموعة'
    });
    assert.equal(outsiderCheck.valid, false, 'Student outside the group roster must be rejected');

    const insiderCheck = validateHomeworkSubmissionIdentity(resolvedGroupBody.assignment, {
      assignmentId: groupHw.id,
      audienceMode: 'group',
      studentId: 'st_1',
      groupId: 'grp_b1_stars',
      studentName: 'سارة محمود'
    });
    assert.equal(insiderCheck.valid, true, 'Authorized group student must be accepted');
    console.log('✅ [SL-08] Account and group isolation strictly enforced');

    // -------------------------------------------------------------------------
    // TEST 9: Direct navigation and page refresh on /Herr-Abdul-rahman/{SHORT_ID}
    // -------------------------------------------------------------------------
    console.log('Testing [SL-09] Direct navigation and page refresh on /Herr-Abdul-rahman/{SHORT_ID}...');
    assert.equal(extractShortIdFromPathname('/Herr-Abdul-rahman/Gr8Up7X'), 'Gr8Up7X');
    assert.equal(extractShortIdFromPathname('/Herr-Abdul-rahman/Gr8Up7X/'), 'Gr8Up7X');
    assert.equal(extractShortIdFromPathname('/herr-abdul-rahman/Ab3x9Kp'), 'Ab3x9Kp');
    assert.equal(extractShortIdFromPathname('/homework/hw_123'), '');
    assert.equal(extractShortIdFromPathname('/'), '');

    __setHomeworkSyncTransportForTests({
      fetchShortLink: async (sid) =>
        sid === 'Gr8Up7X'
          ? {
              shortId: 'Gr8Up7X',
              assignmentId: groupHw.id,
              ownerUid: groupHw.ownerUid,
              isActive: true,
              deleted: false,
              status: 'active',
              assignment: groupHw
            }
          : null
    });

    // Simulate initial direct navigation + subsequent page refresh
    const firstNav = await resolveHomeworkShortLink(
      extractShortIdFromPathname('/Herr-Abdul-rahman/Gr8Up7X')
    );
    assert.equal(firstNav.status, 'resolved');
    assert.equal(firstNav.assignment?.id, groupHw.id);

    const refreshNav = await resolveHomeworkShortLink(
      extractShortIdFromPathname('/Herr-Abdul-rahman/Gr8Up7X')
    );
    assert.equal(refreshNav.status, 'resolved');
    assert.equal(refreshNav.assignment?.id, groupHw.id);
    assert.equal(refreshNav.assignment?.shortId, 'Gr8Up7X');
    __setHomeworkSyncTransportForTests(null);
    console.log('✅ [SL-09] Direct navigation and page refresh on /Herr-Abdul-rahman/{SHORT_ID} verified');

    console.log('================================================================================');
    console.log('🎉 ALL 9 HOMEWORK SHORT LINK TESTS PASSED!');
    console.log('================================================================================');
  } finally {
    __setHomeworkSyncTransportForTests(null);
    __setHomeworkAuthUserForTests(null);
    server.close();
  }
}

runHomeworkShortLinksTests().catch((err) => {
  console.error('❌ HOMEWORK SHORT LINK TEST FAILED:', err);
  process.exit(1);
});
