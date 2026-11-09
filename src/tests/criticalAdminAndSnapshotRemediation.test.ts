import assert from 'node:assert/strict';
import expressApp, {
  resetHomeworkStoresForTesting,
  toPublicAssignmentDto,
  sanitizePublicSetSnapshot
} from '../api/expressApp';
import {
  getAuthoritativeFirestore,
  getInMemoryAdminFirestore,
  setAdminFirestoreOverrideForTesting,
  resetAdminFirestoreForTesting,
  isExplicitTestEnvironment,
  isNonTestDeploymentOrVercel
} from '../server/firebaseAdmin';

// Set test environment flag for the test runner
(globalThis as any).__TEST_ENV__ = true;

async function runCriticalRemediationTests() {
  console.log('================================================================================');
  console.log('CRITICAL REMEDIATION TEST SUITE: ADMIN OVERRIDE & SET SNAPSHOT SANITIZATION');
  console.log('================================================================================');

  const server = expressApp.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const inMemDb = getInMemoryAdminFirestore();

  try {
    resetHomeworkStoresForTesting();

    function restoreEnv(key: string, val: string | undefined) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }

    // =========================================================================
    // PART A: ADMIN OVERRIDE ISOLATION & FAIL-CLOSED PROTECTION
    // =========================================================================

    // Test A-01: Vercel production rejects test override injection
    console.log('Testing [AO-01] Vercel production rejects test override injection...');
    const prevVercel = process.env.VERCEL;
    const prevVercelEnv = process.env.VERCEL_ENV;
    const prevNodeEnv = process.env.NODE_ENV;

    try {
      process.env.VERCEL = '1';
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'production';
      assert.equal(isNonTestDeploymentOrVercel(), true);

      assert.throws(
        () => {
          setAdminFirestoreOverrideForTesting({ fake: 'db' });
        },
        /Forbidden: Cannot set test database override in production/,
        'Vercel production must reject setAdminFirestoreOverrideForTesting'
      );
    } finally {
      restoreEnv('VERCEL', prevVercel);
      restoreEnv('VERCEL_ENV', prevVercelEnv);
      restoreEnv('NODE_ENV', prevNodeEnv);
    }
    console.log('✅ [AO-01] Vercel production strictly rejects test override injection');

    // Test A-02: Vercel preview rejects test override injection
    console.log('Testing [AO-02] Vercel preview rejects test override injection...');
    try {
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'preview';
      assert.equal(isNonTestDeploymentOrVercel(), true);

      assert.throws(
        () => {
          setAdminFirestoreOverrideForTesting({ fake: 'db' });
        },
        /Forbidden: Cannot set test database override in production/,
        'Vercel preview must reject setAdminFirestoreOverrideForTesting'
      );
    } finally {
      restoreEnv('VERCEL', prevVercel);
      restoreEnv('VERCEL_ENV', prevVercelEnv);
      restoreEnv('NODE_ENV', prevNodeEnv);
    }
    console.log('✅ [AO-02] Vercel preview strictly rejects test override injection');

    // Test A-03: Vercel staging rejects test override injection
    console.log('Testing [AO-03] Vercel staging rejects test override injection...');
    try {
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'staging';
      assert.equal(isNonTestDeploymentOrVercel(), true);

      assert.throws(
        () => {
          setAdminFirestoreOverrideForTesting({ fake: 'db' });
        },
        /Forbidden: Cannot set test database override in production/,
        'Vercel staging must reject setAdminFirestoreOverrideForTesting'
      );
    } finally {
      restoreEnv('VERCEL', prevVercel);
      restoreEnv('VERCEL_ENV', prevVercelEnv);
      restoreEnv('NODE_ENV', prevNodeEnv);
    }
    console.log('✅ [AO-03] Vercel staging strictly rejects test override injection');

    // Test A-04: Non-test local runtime rejects test override injection
    console.log('Testing [AO-04] Non-test local runtime rejects test override injection...');
    try {
      (globalThis as any).__TEST_ENV__ = false;
      delete process.env.NODE_ENV;
      delete process.env.IS_TEST_SUITE;
      delete process.env.VITEST;

      assert.throws(
        () => {
          setAdminFirestoreOverrideForTesting({ fake: 'db' });
        },
        /Forbidden: Test database override can only be set in an explicit test environment/,
        'Non-test runtime must reject test override injection'
      );
    } finally {
      (globalThis as any).__TEST_ENV__ = true;
    }
    console.log('✅ [AO-04] Non-test local runtime strictly rejects test override injection');

    // Test A-05: Explicit test environment allows override injection
    console.log('Testing [AO-05] Explicit test environment allows override injection...');
    const mockDb = { customMockMarker: 'test_123' };
    setAdminFirestoreOverrideForTesting(mockDb);
    const returnedDb = getAuthoritativeFirestore();
    assert.equal(returnedDb.customMockMarker, 'test_123');
    resetAdminFirestoreForTesting();
    console.log('✅ [AO-05] Explicit test environment allows override injection');

    // Test A-06: Vercel environment purges any stale override and fails closed without credentials
    console.log('Testing [AO-06] Vercel environment purges stale override and fails closed without credentials...');
    try {
      // Simulate test leaving override behind
      (globalThis as any).__TEST_ENV__ = true;
      setAdminFirestoreOverrideForTesting({ leaked: 'db' });

      // Now enter Vercel production runtime
      process.env.VERCEL = '1';
      process.env.NODE_ENV = 'production';
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;

      assert.throws(
        () => {
          getAuthoritativeFirestore();
        },
        /Firebase Admin credentials missing/,
        'Vercel must purge stale override and fail closed when credentials missing'
      );
    } finally {
      restoreEnv('VERCEL', prevVercel);
      restoreEnv('NODE_ENV', prevNodeEnv);
      resetAdminFirestoreForTesting();
    }
    console.log('✅ [AO-06] Vercel purges stale test overrides and strictly fails closed');

    // =========================================================================
    // PART B: PUBLIC SET SNAPSHOT SANITIZATION & ANSWER-KEY LEAK PREVENTION
    // =========================================================================

    // Test B-01: sanitizePublicSetSnapshot strips correctAnswer and explanation
    console.log('Testing [SS-01] sanitizePublicSetSnapshot strips correctAnswer and explanation...');
    const rawSetSnapshot = {
      id: 'set-animals-a1',
      title: 'Tiere A1',
      topic: 'Animals',
      category: 'vocabulary',
      level: 'A1',
      difficulty: 'easy',
      ownerUid: 'teacher_secret_uid_888',
      ownerEmail: 'teacher@private.de',
      assignedGroupId: 'group_secret_999',
      isArchived: false,
      items: [
        {
          id: 'item-1',
          german: 'der Hund',
          arabic: 'الكلب',
          article: 'der',
          plural: 'die Hunde',
          emoji: '🐶',
          exampleSentenceGerman: 'Der Hund bellt.',
          exampleSentenceArabic: 'الكلب ينبح.',
          secretTeacherNote: 'Do not share with students'
        }
      ],
      customExercises: [
        {
          id: 'ex-1',
          type: 'multiple_choice',
          question: 'Welches Tier bellt?',
          options: ['der Hund', 'die Katze', 'das Pferd', 'die Maus'],
          correctAnswer: 'der Hund',
          explanation: 'Weil Hunde bellen, ist der Hund die richtige Antwort.'
        }
      ]
    };

    const sanitized = sanitizePublicSetSnapshot(rawSetSnapshot);
    assert.ok(sanitized);
    assert.equal(sanitized.id, 'set-animals-a1');
    assert.equal(sanitized.title, 'Tiere A1');
    assert.equal(sanitized.ownerUid, undefined, 'ownerUid must be stripped');
    assert.equal(sanitized.ownerEmail, undefined, 'ownerEmail must be stripped');
    assert.equal(sanitized.assignedGroupId, undefined, 'assignedGroupId must be stripped');

    // Verify items
    assert.equal(sanitized.items.length, 1);
    assert.equal(sanitized.items[0].german, 'der Hund');
    assert.equal(sanitized.items[0].arabic, 'الكلب');
    assert.equal(sanitized.items[0].secretTeacherNote, undefined, 'secretTeacherNote must be stripped');

    // Verify custom exercises
    assert.equal(sanitized.customExercises.length, 1);
    assert.equal(sanitized.customExercises[0].id, 'ex-1');
    assert.equal(sanitized.customExercises[0].question, 'Welches Tier bellt?');
    assert.deepEqual(sanitized.customExercises[0].options, ['der Hund', 'die Katze', 'das Pferd', 'die Maus']);
    assert.equal(sanitized.customExercises[0].correctAnswer, undefined, 'correctAnswer MUST NOT be in public snapshot');
    assert.equal(sanitized.customExercises[0].explanation, undefined, 'explanation MUST NOT be in public snapshot');

    // Verify original object was NOT mutated
    assert.equal(rawSetSnapshot.customExercises[0].correctAnswer, 'der Hund');
    assert.equal(rawSetSnapshot.ownerUid, 'teacher_secret_uid_888');
    console.log('✅ [SS-01] Public snapshot strips correctAnswer, explanation, and owner metadata without mutating source');

    // Test B-02: Public homework info endpoint strips answer keys from setSnapshot
    console.log('Testing [SS-02] GET /api/homework/info returns sanitized setSnapshot without answer keys...');
    const hwWithExercisesId = `hw_ex_${Date.now()}`;
    await inMemDb.collection('homework_assignments').doc(hwWithExercisesId).set({
      id: hwWithExercisesId,
      ownerUid: 'teacher_uid_999',
      title: 'Vocabulary with Custom Exercises',
      createdAt: new Date().toISOString(),
      isActive: true,
      audienceMode: 'open',
      setSnapshot: rawSetSnapshot
    });

    const infoRes = await fetch(`${baseUrl}/api/homework/info?id=${hwWithExercisesId}`);
    assert.equal(infoRes.status, 200);
    const infoData = (await infoRes.json()) as any;
    assert.ok(infoData.setSnapshot);
    assert.equal(infoData.setSnapshot.ownerUid, undefined);
    assert.ok(Array.isArray(infoData.setSnapshot.customExercises));
    assert.equal(infoData.setSnapshot.customExercises.length, 1);
    assert.equal(
      infoData.setSnapshot.customExercises[0].correctAnswer,
      undefined,
      'Endpoint must not return correctAnswer'
    );
    assert.equal(
      infoData.setSnapshot.customExercises[0].explanation,
      undefined,
      'Endpoint must not return explanation'
    );
    console.log('✅ [SS-02] GET /api/homework/info strictly conceals answer keys and explanations');

    // Test B-03: Server-side authoritative grading verifies custom exercises
    console.log('Testing [SS-03] Server-side authoritative grading prevents answer tampering...');
    // Case 1: Student submits answer that is actually WRONG but sends isCorrect: true
    const forgedSubmitRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `sub_forged_${Date.now()}`,
        assignmentId: hwWithExercisesId,
        studentName: 'HonestStudent',
        responses: [
          {
            exerciseId: 'ex-1',
            selectedAnswer: 'die Katze', // WRONG ANSWER
            isCorrect: true // CHEATING ATTEMPT
          }
        ]
      })
    });
    assert.equal(forgedSubmitRes.status, 200);
    const forgedData = (await forgedSubmitRes.json()) as any;
    assert.equal(forgedData.submission.score, 0, 'Server-side grading must reject forged isCorrect');
    assert.equal(forgedData.submission.scorePercentage, 0);
    assert.equal(forgedData.submission.responses[0].isCorrect, false);

    // Case 2: Student submits answer that is CORRECT
    const honestSubmitRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `sub_correct_${Date.now()}`,
        assignmentId: hwWithExercisesId,
        studentName: 'SmartStudent',
        responses: [
          {
            exerciseId: 'ex-1',
            selectedAnswer: 'der Hund', // CORRECT ANSWER
            isCorrect: false // Student didn't claim it, but server awards it
          }
        ]
      })
    });
    assert.equal(honestSubmitRes.status, 200);
    const honestData = (await honestSubmitRes.json()) as any;
    assert.equal(honestData.submission.score, 1, 'Server awards correct score');
    assert.equal(honestData.submission.scorePercentage, 100);
    assert.equal(honestData.submission.responses[0].isCorrect, true);
    console.log('✅ [SS-03] Server authoritatively grades custom exercises against stored answer keys');

    console.log('\n================================================================================');
    console.log('🎉 ALL CRITICAL ADMIN OVERRIDE & SET SNAPSHOT REMEDIATION TESTS PASSED!');
    console.log('================================================================================');
    process.exit(0);
  } finally {
    server.close();
  }
}

runCriticalRemediationTests().catch((err) => {
  console.error('Critical remediation tests failed:', err);
  process.exit(1);
});
