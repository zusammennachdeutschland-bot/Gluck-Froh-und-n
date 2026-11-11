import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import expressApp, {
  resetHomeworkStoresForTesting,
  resetServerMemoryCacheOnly,
  setGooglePublicCertsCacheForTesting,
  toPublicAssignmentDto
} from '../api/expressApp';
import {
  getAuthoritativeFirestore,
  getInMemoryAdminFirestore,
  cleanForFirestore,
  hasFirebaseAdminCredentials
} from '../server/firebaseAdmin';

const testRsaKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

setGooglePublicCertsCacheForTesting(
  { valid_test_kid_serverless: testRsaKeyPair.publicKey },
  Date.now() + 86400000
);

function makeServerlessTestBearerToken(uid: string, email?: string): string {
  const header = { alg: 'RS256', kid: 'valid_test_kid_serverless', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/glueck-c8621',
    aud: 'glueck-c8621',
    sub: uid,
    email: email || 'teacher@glueck.de',
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

async function runAll18ServerlessPersistenceTests() {
  console.log('================================================================================');
  console.log('VERCEL SERVERLESS PERSISTENCE & COLD-START RETRIEVAL SUITE (HW-P01 .. HW-P18)');
  console.log('================================================================================');

  const server = expressApp.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const teacherA_Uid = 'uid_serverless_teacher_A';
  const tokenA = makeServerlessTestBearerToken(teacherA_Uid, 'teacherA@school.de');

  const teacherB_Uid = 'uid_serverless_teacher_B';
  const tokenB = makeServerlessTestBearerToken(teacherB_Uid, 'teacherB@other.de');

  const inMemDb = getInMemoryAdminFirestore();

  try {
    // -------------------------------------------------------------------------
    // HW-P01: Admin SDK initialization & missing credentials handling
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P01] Admin SDK initialization and missing credentials handling...');
    const prevVercelEnv = process.env.VERCEL;
    try {
      process.env.VERCEL = '1';
      // In production mode without credentials, it must throw an explicit error
      assert.throws(
        () => {
          // Temporarily test what happens if credentials are missing in production mode
          const savedCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
          delete process.env.FIREBASE_SERVICE_ACCOUNT;
          delete process.env.FIREBASE_CLIENT_EMAIL;
          delete process.env.FIREBASE_PRIVATE_KEY;
          try {
            getAuthoritativeFirestore();
          } finally {
            if (savedCreds) process.env.FIREBASE_SERVICE_ACCOUNT = savedCreds;
          }
        },
        /Firebase Admin credentials missing/,
        'Must explicitly reject unconfigured production environment'
      );
    } finally {
      process.env.VERCEL = prevVercelEnv;
    }
    console.log('✅ [HW-P01] Admin SDK handles credentials and rejects unconfigured production');

    // -------------------------------------------------------------------------
    // HW-P02: Assignment creation with durable Firestore write
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P02] Assignment creation with durable Firestore write...');
    resetHomeworkStoresForTesting();
    const hwId1 = `hw_p02_${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        id: hwId1,
        title: 'Durable Assignment 1',
        createdAt: new Date().toISOString(),
        isActive: true,
        audienceMode: 'open',
        shareToken: 'tok_valid_p02',
        setSnapshot: { id: 's1', title: 'A1 Vocab' }
      })
    });
    assert.equal(createRes.status, 200);
    const createData = (await createRes.json()) as any;
    assert.equal(createData.success, true);
    assert.equal(createData.assignment.ownerUid, teacherA_Uid);

    // Verify it exists in Firestore backing store
    const docSnap1 = await inMemDb.collection('homework_assignments').doc(hwId1).get();
    assert.equal(docSnap1.exists, true);
    assert.equal(docSnap1.data().ownerUid, teacherA_Uid);
    console.log('✅ [HW-P02] Assignment creation awaits durable Firestore write before returning HTTP 200');

    // -------------------------------------------------------------------------
    // HW-P03: Assignment write failure must not return success
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P03] Assignment write failure must not return success...');
    inMemDb.setSimulateFailure(true, 'Firestore connection timeout');
    const failedCreateRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        id: `hw_fail_${Date.now()}`,
        title: 'Should Fail',
        isActive: true,
        audienceMode: 'open'
      })
    });
    inMemDb.setSimulateFailure(false);
    assert.equal(failedCreateRes.status, 500);
    const failedCreateData = (await failedCreateRes.json()) as any;
    assert.equal(failedCreateData.success, false);
    assert.match(failedCreateData.error, /Firestore connection timeout/);
    console.log('✅ [HW-P03] Firestore write failure returns HTTP 500 and does NOT claim success');

    // -------------------------------------------------------------------------
    // HW-P04: Cold-start assignment retrieval (empty in-memory cache)
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P04] Cold-start assignment retrieval...');
    // Seed Firestore directly
    const hwColdId = `hw_cold_${Date.now()}`;
    await inMemDb.collection('homework_assignments').doc(hwColdId).set({
      id: hwColdId,
      ownerUid: teacherA_Uid,
      title: 'Cold Start Homework',
      createdAt: new Date().toISOString(),
      isActive: true,
      audienceMode: 'open',
      setSnapshot: { id: 's2', title: 'German Food' }
    });
    // Wipe server memory cache completely (simulating cold serverless instance restart)
    resetServerMemoryCacheOnly();

    const coldInfoRes = await fetch(`${baseUrl}/api/homework/info?id=${hwColdId}`);
    assert.equal(coldInfoRes.status, 200);
    const coldInfoData = (await coldInfoRes.json()) as any;
    assert.equal(coldInfoData.id, hwColdId);
    assert.equal(coldInfoData.title, 'Cold Start Homework');
    console.log('✅ [HW-P04] Cold-start serverless instance retrieves assignment from Firestore without cache');

    // -------------------------------------------------------------------------
    // HW-P05: Independent instance A/B assignment retrieval
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P05] Independent instance A/B assignment retrieval...');
    // Instance A writes
    const hwInstanceAId = `hw_instance_a_${Date.now()}`;
    const instACreate = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        id: hwInstanceAId,
        title: 'Instance A Assignment',
        isActive: true,
        audienceMode: 'open'
      })
    });
    assert.equal(instACreate.status, 200);

    // Simulate separate Instance B memory
    resetServerMemoryCacheOnly();

    const instBGet = await fetch(`${baseUrl}/api/homework/info?id=${hwInstanceAId}`);
    assert.equal(instBGet.status, 200);
    const instBData = (await instBGet.json()) as any;
    assert.equal(instBData.title, 'Instance A Assignment');
    console.log('✅ [HW-P05] Assignment created on Instance A is retrievable on independent Instance B');

    // -------------------------------------------------------------------------
    // HW-P06: Instance restart followed by retrieval
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P06] Instance restart followed by retrieval...');
    resetServerMemoryCacheOnly();
    const restartGet = await fetch(`${baseUrl}/api/homework/info?id=${hwId1}&token=tok_valid_p02`);
    assert.equal(restartGet.status, 200);
    console.log('✅ [HW-P06] Instance restart does not lose assignment availability');

    // -------------------------------------------------------------------------
    // HW-P07: Student submission from a different instance
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P07] Student submission from a different instance...');
    resetServerMemoryCacheOnly();
    const subP07Id = `sub_p07_${Date.now()}`;
    const subP07Res = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: subP07Id,
        assignmentId: hwId1,
        studentName: 'Amina Youssef',
        responses: [{ questionId: 'q1', selectedOption: 'B', isCorrect: true }]
      })
    });
    assert.equal(subP07Res.status, 200);
    const subP07Data = (await subP07Res.json()) as any;
    assert.equal(subP07Data.success, true);
    assert.equal(subP07Data.submission.studentName, 'Amina Youssef');

    // Check Firestore doc
    const subDoc = await inMemDb.collection('homework_submissions').doc(subP07Id).get();
    assert.equal(subDoc.exists, true);
    assert.equal(subDoc.data().ownerUid, teacherA_Uid);
    console.log('✅ [HW-P07] Student submission writes durably to Firestore on a fresh instance');

    // -------------------------------------------------------------------------
    // HW-P08: Teacher submission retrieval from another instance
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P08] Teacher submission retrieval from another instance...');
    resetServerMemoryCacheOnly();
    const listSubsRes = await fetch(`${baseUrl}/api/homework/submissions?assignmentId=${hwId1}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(listSubsRes.status, 200);
    const listSubsData = (await listSubsRes.json()) as any;
    assert.ok(Array.isArray(listSubsData.submissions));
    assert.ok(listSubsData.submissions.some((s: any) => s.id === subP07Id));
    console.log('✅ [HW-P08] Teacher retrieves submissions from Firestore across instance restarts');

    // -------------------------------------------------------------------------
    // HW-P09: Firestore submission failure must not return success
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P09] Firestore submission failure must not return success...');
    inMemDb.setSimulateFailure(true, 'Firestore disk quota exceeded');
    const failedSubRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `sub_fail_${Date.now()}`,
        assignmentId: hwId1,
        studentName: 'Tariq',
        responses: []
      })
    });
    inMemDb.setSimulateFailure(false);
    assert.equal(failedSubRes.status, 500);
    const failedSubData = (await failedSubRes.json()) as any;
    assert.equal(failedSubData.success, false);
    assert.match(failedSubData.error, /Firestore disk quota exceeded/);
    console.log('✅ [HW-P09] Submission failure in Firestore returns HTTP 500 without false success');

    // -------------------------------------------------------------------------
    // HW-P10: Cross-account assignment access rejection
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P10] Cross-account assignment access rejection...');
    const crossOverwriteRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({
        id: hwId1,
        title: 'Hacked by Teacher B',
        isActive: true,
        audienceMode: 'open'
      })
    });
    assert.equal(crossOverwriteRes.status, 403);
    console.log('✅ [HW-P10] Teacher B cannot overwrite Teacher A assignment in Firestore');

    // -------------------------------------------------------------------------
    // HW-P11: Cross-account submission access rejection
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P11] Cross-account submission access rejection...');
    const crossListSubsRes = await fetch(`${baseUrl}/api/homework/submissions?assignmentId=${hwId1}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.equal(crossListSubsRes.status, 403);
    console.log('✅ [HW-P11] Teacher B cannot access Teacher A submissions');

    // -------------------------------------------------------------------------
    // HW-P12: Invalid, missing, and empty share tokens
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P12] Invalid, missing, and empty share tokens...');
    const badTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${hwId1}&token=wrong_token`);
    assert.equal(badTokenRes.status, 403);
    const missingTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${hwId1}`);
    assert.equal(missingTokenRes.status, 403, 'Missing token must be rejected with 403');
    const emptyTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${hwId1}&token=`);
    assert.equal(emptyTokenRes.status, 403, 'Empty token must be rejected with 403');
    const goodTokenRes = await fetch(`${baseUrl}/api/homework/info?id=${hwId1}&token=tok_valid_p02`);
    assert.equal(goodTokenRes.status, 200);
    const goodData = (await goodTokenRes.json()) as any;
    assert.equal(goodData.shareToken, undefined, 'shareToken must not be exposed in DTO');
    console.log('✅ [HW-P12] Share token validation strictly protects assignment access');

    // -------------------------------------------------------------------------
    // HW-P13: Inactive assignment rejection
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P13] Inactive assignment rejection...');
    const inactiveHwId = `hw_inactive_${Date.now()}`;
    await inMemDb.collection('homework_assignments').doc(inactiveHwId).set({
      id: inactiveHwId,
      ownerUid: teacherA_Uid,
      title: 'Closed Homework',
      isActive: false,
      status: 'closed',
      audienceMode: 'open'
    });
    resetServerMemoryCacheOnly();
    const inactiveInfoRes = await fetch(`${baseUrl}/api/homework/info?id=${inactiveHwId}`);
    assert.equal(inactiveInfoRes.status, 403);
    const inactiveSubRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `sub_inact_${Date.now()}`,
        assignmentId: inactiveHwId,
        studentName: 'Karim'
      })
    });
    assert.equal(inactiveSubRes.status, 403);
    console.log('✅ [HW-P13] Inactive assignments reject info reads and submissions');

    // -------------------------------------------------------------------------
    // HW-P14: DTO private-field leakage checks
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P14] DTO private-field leakage checks...');
    const groupHwId = `hw_grp_p14_${Date.now()}`;
    await inMemDb.collection('homework_assignments').doc(groupHwId).set({
      id: groupHwId,
      ownerUid: teacherA_Uid,
      ownerEmail: 'secret.teacher@domain.com',
      title: 'Group Vocabulary',
      isActive: true,
      audienceMode: 'group',
      groupId: 'grp-a1',
      groupName: 'Group A1',
      assignedStudents: [
        { id: 'st-1', name: 'Leila', code: 'PIN_9999', passwordHash: 'hash_secret', parentPhone: '+49123456' },
        { id: 'st-2', name: 'Omar', code: 'PIN_8888', passwordHash: 'hash_secret', parentPhone: '+49987654' }
      ]
    });
    resetServerMemoryCacheOnly();
    const groupInfoRes = await fetch(`${baseUrl}/api/homework/info?id=${groupHwId}`);
    assert.equal(groupInfoRes.status, 200);
    const groupInfoData = (await groupInfoRes.json()) as any;
    assert.equal(groupInfoData.ownerUid, undefined, 'ownerUid must not be exposed');
    assert.equal(groupInfoData.ownerEmail, undefined, 'ownerEmail must not be exposed');
    for (const st of groupInfoData.assignedStudents) {
      assert.equal(st.code, undefined, 'student access code must not be exposed');
      assert.equal(st.passwordHash, undefined, 'password must not be exposed');
      assert.equal(st.parentPhone, undefined, 'parent phone must not be exposed');
    }
    console.log('✅ [HW-P14] Public DTO strictly sanitizes all private teacher and student fields');

    // -------------------------------------------------------------------------
    // HW-P15: Attempt-secret validation
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P15] Attempt-secret validation...');
    const subSecretId = `sub_secret_${Date.now()}`;
    // First attempt creates with secret
    const subSec1Res = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: subSecretId,
        assignmentId: hwId1,
        studentName: 'Zainab',
        attemptSecret: 'sec_original_123',
        status: 'in_progress'
      })
    });
    assert.equal(subSec1Res.status, 200);

    // Mismatched secret attempt to hijack the in-progress submission
    const hijackRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: subSecretId,
        assignmentId: hwId1,
        studentName: 'Zainab',
        attemptSecret: 'sec_attacker_456'
      })
    });
    assert.equal(hijackRes.status, 403);
    console.log('✅ [HW-P15] Attempt-secret validation rejects forged attempt modifications');

    // -------------------------------------------------------------------------
    // HW-P16: Duplicate submission retry handling (Idempotent)
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P16] Duplicate submission retry handling...');
    const retrySubId = `sub_retry_${Date.now()}`;
    const retryPayload = {
      id: retrySubId,
      assignmentId: hwId1,
      studentName: 'Nadia',
      status: 'completed',
      responses: [
        { questionId: 'q1', selectedOption: 'A', isCorrect: true },
        { questionId: 'q2', selectedOption: 'B', isCorrect: true }
      ]
    };
    const firstSub = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retryPayload)
    });
    assert.equal(firstSub.status, 200);

    // Identical duplicate network retry
    const secondSub = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retryPayload)
    });
    assert.equal(secondSub.status, 200);
    const secondSubData = (await secondSub.json()) as any;
    assert.equal(secondSubData.success, true);
    console.log('✅ [HW-P16] Duplicate submission retry handled idempotently without error');

    // -------------------------------------------------------------------------
    // HW-P17: Concurrent submission race conditions (Atomic Transactions)
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P17] Concurrent submission race conditions...');
    const concurrentIds = Array.from({ length: 5 }, (_, i) => `sub_conc_${Date.now()}_${i}`);
    const results = await Promise.all(
      concurrentIds.map((id, i) =>
        fetch(`${baseUrl}/api/homework/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            assignmentId: hwId1,
            studentName: `Student ${i}`,
            responses: [{ questionId: 'q1', isCorrect: true }]
          })
        }).then((r) => r.json() as any)
      )
    );
    for (const r of results) {
      assert.equal(r.success, true);
    }
    console.log('✅ [HW-P17] Concurrent submissions handled atomically without collision');

    // -------------------------------------------------------------------------
    // HW-P18: Completed submission overwrite rejection
    // -------------------------------------------------------------------------
    console.log('Testing [HW-P18] Completed submission overwrite rejection...');
    const overwriteRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: retrySubId,
        assignmentId: hwId1,
        studentName: 'Nadia',
        responses: [
          { questionId: 'q1', selectedOption: 'A', isCorrect: false },
          { questionId: 'q2', selectedOption: 'B', isCorrect: false }
        ]
      })
    });
    assert.equal(overwriteRes.status, 409);
    console.log('✅ [HW-P18] Completed submission is locked and overwrite attempts return HTTP 409');

    console.log('\n================================================================================');
    console.log('🎉 ALL 18 VERCEL SERVERLESS PERSISTENCE & COLD-START TESTS (HW-P01..HW-P18) PASSED!');
    console.log('================================================================================');
    process.exit(0);
  } finally {
    server.close();
  }
}

runAll18ServerlessPersistenceTests().catch((err) => {
  console.error('Serverless persistence tests failed:', err);
  process.exit(1);
});
