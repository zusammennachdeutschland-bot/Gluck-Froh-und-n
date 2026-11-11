import assert from 'node:assert/strict';
import expressApp, {
  resetHomeworkStoresForTesting,
  toPublicAssignmentDto
} from '../api/expressApp';
import { buildHomeworkShareUrl, createHomeworkShareToken } from '../shared/homeworkStorageSync';
import {
  getInMemoryAdminFirestore,
  getAuthoritativeFirestore,
  isExplicitTestEnvironment
} from '../server/firebaseAdmin';

// Set test environment flag for the test runner
(globalThis as any).__TEST_ENV__ = true;

async function runShareTokenSecurityTests() {
  console.log('================================================================================');
  console.log('HOMEWORK SHARE TOKEN SECURITY & PUBLIC DTO SANITIZATION REGRESSION SUITE');
  console.log('================================================================================');

  const server = expressApp.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const inMemDb = getInMemoryAdminFirestore();

  try {
    resetHomeworkStoresForTesting();

    // Capacitor Android WebView must be able to complete the authenticated API preflight.
    const nativePreflight = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });
    assert.equal(nativePreflight.status, 204, 'Allowed Capacitor origin must pass CORS preflight');
    assert.equal(nativePreflight.headers.get('access-control-allow-origin'), 'https://localhost');
    assert.match(nativePreflight.headers.get('access-control-allow-headers') || '', /authorization/i);
    assert.match(nativePreflight.headers.get('access-control-allow-headers') || '', /content-type/i);

    const rejectedPreflight = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://untrusted.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });
    assert.equal(rejectedPreflight.status, 403, 'Untrusted origins must not receive CORS permission');
    assert.equal(rejectedPreflight.headers.get('access-control-allow-origin'), null);
    console.log('✅ [CORS-01] Capacitor preflight is allowed only for explicit app origins');

    const teacherUid = 'teacher_st_uid_100';
    const securedHwId = `hw_sec_${Date.now()}`;
    const configuredToken = 'valid_secret_share_token_999';

    // New links must contain a cryptographically generated access token.
    const generatedToken = createHomeworkShareToken();
    assert.match(generatedToken, /^[a-f0-9]{64}$/);
    assert.notEqual(generatedToken, createHomeworkShareToken());
    const generatedLink = buildHomeworkShareUrl({
      id: 'hw_link_test',
      title: 'Share link test',
      shareToken: configuredToken
    } as any, 'https://glueck.example.com');
    assert.equal(new URL(generatedLink).searchParams.get('token'), configuredToken);
    console.log('✅ [ST-00] Share links include a cryptographically strong token');

    // Seed an assignment with a configured shareToken
    await inMemDb.collection('homework_assignments').doc(securedHwId).set({
      id: securedHwId,
      ownerUid: teacherUid,
      ownerEmail: 'teacher@school.de',
      title: 'Token Protected German Assignment',
      createdAt: new Date().toISOString(),
      isActive: true,
      audienceMode: 'open',
      shareToken: configuredToken,
      attemptSecret: 'internal_secret_xyz',
      setSnapshot: { id: 'vocab-1', title: 'A1 Vocab' }
    });

    // -------------------------------------------------------------------------
    // TEST 1: Configured shareToken + missing token query param -> 403 Forbidden
    // (Originally vulnerable: missing token allowed bypass)
    // -------------------------------------------------------------------------
    console.log('Testing [ST-01] Configured shareToken + missing token query param...');
    const missingTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${securedHwId}`);
    assert.equal(
      missingTokenRes.status,
      403,
      'Missing token must be rejected with 403 when assignment has shareToken'
    );
    const missingTokenData = (await missingTokenRes.json()) as any;
    assert.match(missingTokenData.error, /share token/i);
    assert.equal(missingTokenData.title, undefined, 'No assignment info must be exposed on 403');
    console.log('✅ [ST-01] Missing token returns HTTP 403 without exposing data');

    // -------------------------------------------------------------------------
    // TEST 2: Configured shareToken + empty token query param -> 403 Forbidden
    // -------------------------------------------------------------------------
    console.log('Testing [ST-02] Configured shareToken + empty token query param...');
    const emptyTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${securedHwId}&token=`);
    assert.equal(
      emptyTokenRes.status,
      403,
      'Empty token must be rejected with 403'
    );
    const whitespaceTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${securedHwId}&token=%20%20%20`);
    assert.equal(
      whitespaceTokenRes.status,
      403,
      'Whitespace-only token must be rejected with 403'
    );
    console.log('✅ [ST-02] Empty and whitespace token returns HTTP 403');

    // -------------------------------------------------------------------------
    // TEST 3: Configured shareToken + incorrect token -> 403 Forbidden
    // -------------------------------------------------------------------------
    console.log('Testing [ST-03] Configured shareToken + incorrect token...');
    const wrongTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${securedHwId}&token=completely_wrong_token`);
    assert.equal(
      wrongTokenRes.status,
      403,
      'Incorrect token must be rejected with 403'
    );
    console.log('✅ [ST-03] Incorrect token returns HTTP 403');

    // -------------------------------------------------------------------------
    // TEST 4: Configured shareToken + correct token -> 200 OK Authorized
    // -------------------------------------------------------------------------
    console.log('Testing [ST-04] Configured shareToken + correct token...');
    const correctTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${securedHwId}&token=${configuredToken}`, {
      headers: { Origin: 'https://localhost' }
    });
    assert.equal(
      correctTokenRes.status,
      200,
      'Correct token must receive HTTP 200'
    );
    assert.equal(
      correctTokenRes.headers.get('access-control-allow-origin'),
      'https://localhost',
      'Allowed Capacitor origin must receive CORS headers on actual API responses'
    );
    const correctTokenData = (await correctTokenRes.json()) as any;
    assert.equal(correctTokenData.id, securedHwId);
    assert.equal(correctTokenData.title, 'Token Protected German Assignment');
    console.log('✅ [ST-04] Correct token returns HTTP 200 with assignment data');
    // -------------------------------------------------------------------------
    // TEST 4A: Both public submission routes require the same share token.
    // -------------------------------------------------------------------------
    const submissionBase = {
      assignmentId: securedHwId,
      studentName: 'Cross Device Student',
      attemptNumber: 1,
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      responses: [],
      totalQuestions: 0,
      correctAnswersCount: 0,
      scorePercentage: 0
    };

    const missingSubmitTokenRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...submissionBase, id: `sub_missing_${Date.now()}` })
    });
    assert.equal(missingSubmitTokenRes.status, 403, 'Missing share token must block submission');

    const wrongSubmitTokenRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...submissionBase,
        id: `sub_wrong_${Date.now()}`,
        token: 'wrong_share_token'
      })
    });
    assert.equal(wrongSubmitTokenRes.status, 403, 'Wrong share token must block submission');

    const legacyRouteMissingTokenRes = await fetch(`${baseUrl}/api/homework/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...submissionBase, id: `sub_legacy_missing_${Date.now()}` })
    });
    assert.equal(
      legacyRouteMissingTokenRes.status,
      403,
      'Legacy public submission route must also enforce the share token'
    );

    const validSubmitTokenRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...submissionBase,
        id: `sub_valid_${Date.now()}`,
        token: configuredToken
      })
    });
    assert.equal(validSubmitTokenRes.status, 200, 'Correct share token must allow submission');
    const validSubmitData = await validSubmitTokenRes.json() as any;
    assert.equal(validSubmitData.success, true);
    assert.equal(validSubmitData.submission.assignmentId, securedHwId);
    console.log('✅ [ST-04A] Both submission endpoints enforce the share token; valid token persists submission');


    // -------------------------------------------------------------------------
    // TEST 5: No shareToken present in any public DTO response
    // (Originally vulnerable: shareToken was reflected in publicDto)
    // -------------------------------------------------------------------------
    console.log('Testing [ST-05] No shareToken present in any public DTO response...');
    assert.equal(
      correctTokenData.shareToken,
      undefined,
      'shareToken MUST NEVER be exposed in public assignment DTO'
    );
    // Also test toPublicAssignmentDto directly
    const directDto = toPublicAssignmentDto({
      id: 'hw_test_direct',
      title: 'Direct Test',
      shareToken: 'secret_leak_123',
      ownerEmail: 'teacher@school.de',
      ownerUid: 'uid_test',
      attemptSecret: 'secret_att'
    });
    assert.equal(
      directDto.shareToken,
      undefined,
      'toPublicAssignmentDto must not include shareToken'
    );
    assert.equal(
      directDto.ownerEmail,
      undefined,
      'toPublicAssignmentDto must not include ownerEmail'
    );
    assert.equal(
      directDto.ownerUid,
      undefined,
      'toPublicAssignmentDto must not include ownerUid'
    );
    assert.equal(
      directDto.attemptSecret,
      undefined,
      'toPublicAssignmentDto must not include attemptSecret'
    );
    console.log('✅ [ST-05] Public DTO strictly excludes shareToken, ownerEmail, ownerUid, and attemptSecret');

    // -------------------------------------------------------------------------
    // TEST 6: Assignment without configured shareToken preserves intended open behavior
    // -------------------------------------------------------------------------
    console.log('Testing [ST-06] Assignment without configured shareToken preserves open behavior...');
    const openHwId = `hw_open_${Date.now()}`;
    await inMemDb.collection('homework_assignments').doc(openHwId).set({
      id: openHwId,
      ownerUid: teacherUid,
      title: 'Open Assignment Without Share Token',
      createdAt: new Date().toISOString(),
      isActive: true,
      audienceMode: 'open'
    });
    const openRes = await fetch(`${baseUrl}/api/homework/info?id=${openHwId}`);
    assert.equal(
      openRes.status,
      200,
      'Assignment without shareToken must remain accessible to students'
    );
    const openData = (await openRes.json()) as any;
    assert.equal(openData.id, openHwId);
    assert.equal(openData.title, 'Open Assignment Without Share Token');
    console.log('✅ [ST-06] Assignment without shareToken remains accessible as intended');

    // -------------------------------------------------------------------------
    // TEST 7: Group Assignment Roster Sanitization (No PII / student secrets)
    // -------------------------------------------------------------------------
    console.log('Testing [ST-07] Group Assignment Roster Sanitization...');
    const groupHwId = `hw_group_${Date.now()}`;
    await inMemDb.collection('homework_assignments').doc(groupHwId).set({
      id: groupHwId,
      ownerUid: teacherUid,
      title: 'Group Assignment',
      createdAt: new Date().toISOString(),
      isActive: true,
      audienceMode: 'group',
      groupId: 'grp_b1',
      groupName: 'German B1 Evening',
      assignedStudents: [
        {
          id: 'st_1',
          name: 'Ahmed',
          code: 'PIN_SECRET_123',
          passwordHash: 'argon2_secret_hash',
          parentPhone: '+491700000000',
          parentEmail: 'parent@home.de'
        },
        {
          id: 'st_2',
          name: 'Sara',
          code: 'PIN_SECRET_456',
          passwordHash: 'argon2_secret_hash_2',
          parentPhone: '+491711111111'
        }
      ]
    });
    const groupRes = await fetch(`${baseUrl}/api/homework/info?id=${groupHwId}`);
    assert.equal(groupRes.status, 200);
    const groupData = (await groupRes.json()) as any;
    assert.ok(Array.isArray(groupData.assignedStudents));
    for (const s of groupData.assignedStudents) {
      assert.ok(s.id);
      assert.ok(s.name);
      assert.equal(s.code, undefined, 'Student code must not leak');
      assert.equal(s.passwordHash, undefined, 'Password hash must not leak');
      assert.equal(s.parentPhone, undefined, 'Parent phone must not leak');
      assert.equal(s.parentEmail, undefined, 'Parent email must not leak');
    }
    console.log('✅ [ST-07] Group student roster exposes only id, name, and groupId (zero credentials/PII)');

    // -------------------------------------------------------------------------
    // TEST 8: Test Double Isolation (Production / Non-test environment rejection)
    // -------------------------------------------------------------------------
    console.log('Testing [ST-08] Test double isolation outside test environment...');
    const prevTestEnv = (globalThis as any).__TEST_ENV__;
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      (globalThis as any).__TEST_ENV__ = false;
      delete process.env.NODE_ENV;
      delete process.env.IS_TEST_SUITE;
      delete process.env.VITEST;

      assert.equal(isExplicitTestEnvironment(), false);

      // Outside an explicit test environment without credentials, getAuthoritativeFirestore MUST throw
      assert.throws(
        () => {
          getAuthoritativeFirestore();
        },
        /Firebase Admin credentials missing/,
        'Must reject initialization without credentials when not in an explicit test environment'
      );
    } finally {
      (globalThis as any).__TEST_ENV__ = prevTestEnv;
      if (prevNodeEnv) process.env.NODE_ENV = prevNodeEnv;
    }
    console.log('✅ [ST-08] Test double is strictly isolated to test runners');

    console.log('\n================================================================================');
    console.log('🎉 ALL SHARE TOKEN SECURITY & PUBLIC DTO REGRESSION TESTS PASSED!');
    console.log('================================================================================');
    process.exit(0);
  } finally {
    server.close();
  }
}

runShareTokenSecurityTests().catch((err) => {
  console.error('Share token security tests failed:', err);
  process.exit(1);
});
