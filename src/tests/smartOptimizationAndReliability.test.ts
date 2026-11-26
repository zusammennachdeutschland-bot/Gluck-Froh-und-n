import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import expressApp, { setGooglePublicCertsCacheForTesting } from '../api/expressApp';
import {
  InMemoryAdminFirestore,
  setAdminFirestoreOverrideForTesting,
  resetAdminFirestoreForTesting,
  saveAuthoritativeAssignment,
  getAuthoritativeAssignment,
  getAuthoritativeShortLink,
  deleteAuthoritativeAssignmentCanonical,
  saveAuthoritativeSubmission,
  saveAuthoritativePublishedSet,
  listAuthoritativePublishedSets
} from '../server/firebaseAdmin';
import {
  shouldSendProgressCheckpoint,
  buildInProgressCheckpointSubmission,
  sendExitProgressCheckpointKeepalive,
  serializeKeepaliveCheckpointBody,
  resetExitCheckpointDedupeForTesting,
  MAX_KEEPALIVE_PAYLOAD_BYTES
} from '../shared/homeworkCheckpointSync';
import {
  resetFirestoreSubscriptionMultiplexers,
  __setHomeworkAuthUserForTests,
  saveSubmissionToFirestoreWithDetails,
  publishCustomLernstudioSetOnce,
  DEFAULT_VERCEL_DOMAIN
} from '../shared/firebaseCloudSync';
import {
  saveSubmissionWithConfirmation,
  syncAndFetchTeacherAssignments,
  fetchAssignmentDetailsWithSync,
  deleteHomeworkAssignmentWithConfirmation,
  getPreservedSubmissionsForDeletedAssignments,
  restoreArchivedSubmissionsFromCloud,
  flushPendingHomeworkCloudWrites,
  saveLocalAssignment,
  __setHomeworkSyncTransportForTests
} from '../shared/homeworkStorageSync';
import { DEFAULT_LERNSTUDIO_SETS } from '../shared/defaultLernstudioSets';
import type { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import type { LernstudioSet } from '../types/lernstudio';

const testRsaKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

setGooglePublicCertsCacheForTesting(
  { valid_test_kid_smart_opt: testRsaKeyPair.publicKey },
  Date.now() + 86400000
);

class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

function makeTestBearerToken(uid: string, email: string, name = 'Test Teacher'): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', kid: 'valid_test_kid_smart_opt', typ: 'JWT' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'https://securetoken.google.com/glueck-c8621',
      aud: 'glueck-c8621',
      user_id: uid,
      sub: uid,
      email,
      name,
      iat: nowSec - 10,
      auth_time: nowSec - 10,
      exp: nowSec + 3600
    })
  ).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(testRsaKeyPair.privateKey, 'base64url');
  return `${unsigned}.${signature}`;
}

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function makeLocalExpressFetch(baseUrl: string, originalFetch: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input.toString();
    if (raw.startsWith('/api/')) {
      return originalFetch(`${baseUrl}${raw}`, init);
    }
    if (raw.startsWith(`${DEFAULT_VERCEL_DOMAIN}/api/`)) {
      const suffix = raw.slice(DEFAULT_VERCEL_DOMAIN.length);
      return originalFetch(`${baseUrl}${suffix}`, init);
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}

async function runTests(): Promise<void> {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const originalFetch = globalThis.fetch;
  const localStorageMock = new MemoryStorage();
  const sessionStorageMock = new MemoryStorage();
  const listeners = new Map<string, Set<Function>>();

  (globalThis as any).localStorage = localStorageMock;
  (globalThis as any).sessionStorage = sessionStorageMock;
  (globalThis as any).CustomEvent = class CustomEventShim {
    type: string;
    detail: any;
    constructor(type: string, opts?: any) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
  (globalThis as any).window = {
    location: { origin: DEFAULT_VERCEL_DOMAIN, pathname: '/', protocol: 'https:', search: '' },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    addEventListener: (t: string, cb: Function) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(cb);
    },
    removeEventListener: (t: string, cb: Function) => {
      listeners.get(t)?.delete(cb);
    },
    dispatchEvent: () => true
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true
  });

  const memoryDb = new InMemoryAdminFirestore();
  setAdminFirestoreOverrideForTesting(memoryDb);

  const server = expressApp.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  const expressFetch = makeLocalExpressFetch(baseUrl, originalFetch);
  (globalThis as any).fetch = expressFetch;

  const teacherA = { uid: 'teacher_opt_a', email: 'teacher.a@glueck.test', token: makeTestBearerToken('teacher_opt_a', 'teacher.a@glueck.test', 'أ. عبد الرحمن') };
  const teacherB = { uid: 'teacher_opt_b', email: 'teacher.b@glueck.test', token: makeTestBearerToken('teacher_opt_b', 'teacher.b@glueck.test', 'أ. سارة') };

  let passed = 0;
  const pass = (name: string) => {
    passed++;
    console.log(`[PASS] ${name}`);
  };

  try {
    // =========================================================================
    // TEST 1: Static Architecture Audit — Zero Redundant Final Submit, Zero Auto Reads
    // =========================================================================
    {
      const playerSrc = readSource('src/pages/HomeworkPlayerPage.tsx');
      const modalSrc = readSource('src/shared/components/LernstudioHomeworkModal.tsx');
      const lernstudioSrc = readSource('src/shared/components/LernstudioView.tsx');

      // Eliminate redundant explicit /api/homework/submit fetch inside HomeworkPlayerPage
      assert.equal(playerSrc.includes("fetch('/api/homework/submit'"), false, 'HomeworkPlayerPage must NOT contain redundant fetch("/api/homework/submit")');
      assert.equal(playerSrc.includes('fetchSubmissionsForAssignmentFromFirestore'), false, 'HomeworkPlayerPage must NOT auto-read teacher leaderboard');
      assert.ok(playerSrc.includes('shouldSendProgressCheckpoint'), 'HomeworkPlayerPage must gate progress syncs by 10-question checkpoint helper');
      assert.ok(playerSrc.includes('sendExitProgressCheckpointKeepalive'), 'HomeworkPlayerPage must send keepalive checkpoint on exit/hide');
      assert.ok(playerSrc.includes('!isFinalQuestion && transition.triggeredBonusRound'), 'Final question must never open a bonus modal that blocks automatic completion');
      assert.ok(playerSrc.includes('flushExitCheckpointRef'), 'Exit listeners must use a ref inside a mount-only useEffect([], ...) to avoid premature cleanup');

      // Strict manual teacher sync: no auto force-cloud load on modal open, no mount backfill
      assert.equal(modalSrc.includes('loadAllAssignments(true)'), true, 'Main Refresh button calls loadAllAssignments(true)');
      const openEffectMatch = modalSrc.match(/useEffect\(\(\) => \{\s*if \(!isOpen\) return;\s*loadAllAssignments\(([^)]+)\)/);
      assert.ok(openEffectMatch && openEffectMatch[1].trim() === 'false', 'Opening LernstudioHomeworkModal must load from local cache ONLY (loadAllAssignments(false))');
      assert.equal(lernstudioSrc.includes('backfillLegacyCloudHomeworkForAccount'), false, 'LernstudioView must NOT auto-backfill from cloud on mount');
      assert.equal(lernstudioSrc.includes('publishCustomLernstudioSetOnce'), false, 'LernstudioView must NOT publish sets to Firestore (P2P only)');
      assert.equal(lernstudioSrc.includes('fetchPublishedCustomLernstudioSetsFromFirestore'), false, 'LernstudioView must NOT poll Firestore for shared sets');
      assert.equal(modalSrc.includes('publishCustomLernstudioSetOnce'), false, 'LernstudioHomeworkModal must NOT publish sets to Firestore');

      pass('1. Static audit confirms single final submit path, final-question auto-completion guard, 10Q checkpoint + exit keepalive, and zero auto teacher reads');
    }

    // =========================================================================
    // TEST 2: 40-Question Flow (1 Start + 3 Checkpoints + 1 Final) & 10-Question Flow
    // =========================================================================
    {
      resetFirestoreSubscriptionMultiplexers();
      __setHomeworkAuthUserForTests(null);
      __setHomeworkSyncTransportForTests(null);
      localStorageMock.clear();

      // Create 40-item assignment on server
      const fortyItems = Array.from({ length: 40 }, (_, i) => ({
        id: `w40_${i + 1}`,
        german: `Wort_${i + 1}`,
        arabic: `كلمة_${i + 1}`,
        emoji: '📘'
      }));
      const hw40Res = await expressFetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherA.token}` },
        body: JSON.stringify({
          id: 'hw_40_checkpoint_test',
          shortId: 'CkPt40A',
          ownerUid: teacherA.uid,
          title: 'واجب 40 سؤال',
          audienceMode: 'open',
          questionTypes: ['choice_all'],
          questionCount: 40,
          targetQuestionCount: 40,
          setSnapshot: { id: 'set_40', title: '40 Words', category: 'A1', items: fortyItems }
        })
      });
      assert.equal(hw40Res.status, 200);
      const { assignment: hw40 } = await hw40Res.json();

      // Count network POST /api/homework/submit calls across 40-question simulation
      let submitPostCount = 0;
      (globalThis as any).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/homework/submit')) {
          submitPostCount++;
        }
        return expressFetch(input, init);
      }) as typeof fetch;

      const subId40 = 'sub_40_attempt_1';
      // 1) Start attempt (1 write)
      await saveSubmissionWithConfirmation(
        {
          id: subId40,
          assignmentId: hw40.id,
          ownerUid: teacherA.uid,
          attemptSecret: 'sec_40_1',
          audienceMode: 'open',
          participantId: 'p_40_1',
          studentName: 'عمر',
          attemptNumber: 1,
          status: 'in_progress',
          startedAt: '2026-11-14T10:00:00.000Z',
          completedAt: '',
          timeSpentSeconds: 0,
          totalQuestions: 40,
          correctAnswersCount: 0,
          scorePercentage: 0,
          score: 0,
          accuracyPercent: 0,
          goldEarned: 0,
          maxStreak: 0,
          responses: []
        },
        hw40
      );
      assert.equal(submitPostCount, 1);

      let lastSynced = 0;
      const responses40: any[] = [];
      for (let q = 1; q <= 40; q++) {
        responses40.push({
          questionId: `q_${q}`,
          questionType: 'choice_all',
          germanWord: `Wort_${q}`,
          studentAnswer: `كلمة_${q}`,
          correctAnswer: `كلمة_${q}`,
          isCorrect: true,
          timeSpentSeconds: 2
        });
        if (shouldSendProgressCheckpoint({ answeredCount: q, totalQuestions: 40, lastSyncedAnsweredCount: lastSynced })) {
          lastSynced = q;
          await saveSubmissionWithConfirmation(
            buildInProgressCheckpointSubmission({
              id: subId40,
              assignmentId: hw40.id,
              ownerUid: teacherA.uid,
              attemptSecret: 'sec_40_1',
              audienceMode: 'open',
              participantId: 'p_40_1',
              studentName: 'عمر',
              attemptNumber: 1,
              status: 'in_progress',
              startedAt: '2026-11-14T10:00:00.000Z',
              completedAt: '',
              timeSpentSeconds: q * 2,
              totalQuestions: 40,
              correctAnswersCount: responses40.length,
              scorePercentage: Math.round((responses40.length / 40) * 100),
              score: responses40.length,
              accuracyPercent: Math.round((responses40.length / 40) * 100),
              goldEarned: q * 50,
              maxStreak: q,
              responses: [...responses40]
            }),
            hw40
          );
        }
      }
      // After 40 questions (before final completion): Q10, Q20, Q30 sent = 3 checkpoints + 1 start = 4; Q40 MUST NOT fire a checkpoint
      assert.equal(lastSynced, 30, 'Q40 must NOT fire a 4th in_progress checkpoint');
      assert.equal(submitPostCount, 4);

      // Final completion sends 1 authoritative POST (total = 5)
      const finalRes = await saveSubmissionWithConfirmation(
        {
          id: subId40,
          assignmentId: hw40.id,
          ownerUid: teacherA.uid,
          attemptSecret: 'sec_40_1',
          audienceMode: 'open',
          participantId: 'p_40_1',
          studentName: 'عمر',
          attemptNumber: 1,
          status: 'completed',
          startedAt: '2026-11-14T10:00:00.000Z',
          completedAt: '2026-11-14T10:02:00.000Z',
          timeSpentSeconds: 120,
          totalQuestions: 40,
          correctAnswersCount: 40,
          scorePercentage: 100,
          score: 40,
          accuracyPercent: 100,
          goldEarned: 2400,
          maxStreak: 40,
          responses: responses40
        },
        hw40
      );
      assert.equal(finalRes.cloudSynced, true);
      assert.equal(submitPostCount, 5, '40-question quiz must emit exactly 1 start + 3 checkpoints + 1 final = 5 requests');

      // 10-question quiz: Q10 is final, so 0 mid checkpoints (1 start + 1 final = 2)
      assert.equal(shouldSendProgressCheckpoint({ answeredCount: 10, totalQuestions: 10, lastSyncedAnsweredCount: 0 }), false);

      // Mid-quiz exit keepalive sends 1 keepalive POST with status 'in_progress'
      resetExitCheckpointDedupeForTesting();
      let keepaliveCount = 0;
      let keepaliveBody: any = null;
      (globalThis as any).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/homework/submit') && init?.keepalive === true) {
          keepaliveCount++;
          keepaliveBody = JSON.parse(String(init.body || '{}'));
        }
        return expressFetch(input, init);
      }) as typeof fetch;

      const exitPayload: HomeworkSubmission = {
        id: 'sub_exit_mid_1',
        assignmentId: hw40.id,
        ownerUid: teacherA.uid,
        attemptSecret: 'sec_exit_1',
        audienceMode: 'open',
        participantId: 'p_exit_1',
        studentName: 'سلمى',
        attemptNumber: 1,
        status: 'in_progress',
        startedAt: '2026-11-14T10:00:00.000Z',
        completedAt: '',
        timeSpentSeconds: 15,
        totalQuestions: 40,
        correctAnswersCount: 3,
        scorePercentage: 8,
        score: 3,
        accuracyPercent: 8,
        responses: responses40.slice(0, 4)
      };

      const sentExit1 = await sendExitProgressCheckpointKeepalive(exitPayload, { shortId: 'CkPt40A' });
      // Simulate visibilitychange + pagehide + unmount firing consecutively for the same unchanged progress
      const sentExit2 = await sendExitProgressCheckpointKeepalive(exitPayload, { shortId: 'CkPt40A' });
      const sentExit3 = await sendExitProgressCheckpointKeepalive(exitPayload, { shortId: 'CkPt40A' });
      assert.equal(sentExit1, true);
      assert.equal(sentExit2, false, 'Second exit event with unchanged progress must be deduplicated');
      assert.equal(sentExit3, false, 'Third exit event with unchanged progress must be deduplicated');
      assert.equal(keepaliveCount, 1, 'Multiple exit events must emit at most 1 keepalive request');
      assert.equal(keepaliveBody?.status, 'in_progress');
      assert.equal(keepaliveBody?.responses?.length, 4);

      // Exit keepalive must NOT fire when 0 questions answered or when all questions answered (final question)
      assert.equal(
        await sendExitProgressCheckpointKeepalive({ ...exitPayload, id: 'sub_exit_0q', responses: [] }),
        false,
        '0-answer attempt must not emit exit checkpoint'
      );
      assert.equal(
        await sendExitProgressCheckpointKeepalive({
          ...exitPayload,
          id: 'sub_exit_finalq',
          totalQuestions: 40,
          responses: responses40
        }),
        false,
        'Final question must not emit exit checkpoint (final submission replaces checkpoint)'
      );

      // Verify keepalive 64 KB browser payload limit protection
      const hugeResponses = Array.from({ length: 40 }, (_, i) => ({
        questionId: `q_huge_${i + 1}`,
        questionType: 'verb_sentence',
        germanWord: `Wort_${i + 1}`,
        promptText: 'شرح طويل جداً '.repeat(150),
        sentence: 'Beispielsatz mit vielen Wörtern '.repeat(80),
        studentAnswer: `كلمة_${i + 1}`,
        correctAnswer: `كلمة_${i + 1}`,
        isCorrect: true,
        timeSpentSeconds: 3
      }));
      const rawHugeSize = Buffer.byteLength(JSON.stringify({ ...exitPayload, responses: hugeResponses }), 'utf8');
      assert.ok(rawHugeSize > 64 * 1024, 'Raw uncompacted payload exceeds 64 KB browser keepalive limit');
      const compactedJson = serializeKeepaliveCheckpointBody({ ...exitPayload, responses: hugeResponses });
      const compactedSize = Buffer.byteLength(compactedJson, 'utf8');
      assert.ok(compactedSize <= MAX_KEEPALIVE_PAYLOAD_BYTES, `Compacted keepalive body (${compactedSize}B) must be <= ${MAX_KEEPALIVE_PAYLOAD_BYTES}B`);
      const compactedParsed = JSON.parse(compactedJson);
      assert.equal(compactedParsed.responses.length, 40, 'Compacted keepalive payload must preserve all 40 answers');
      assert.equal(compactedParsed.responses[0].studentAnswer, 'كلمة_1');

      (globalThis as any).fetch = expressFetch;
      pass('2. 40Q quiz sends 1 start + 3 checkpoints + 1 final (Q40 replaces checkpoint); multiple exit events deduplicate to 1 keepalive (<56KB)');
    }

    // =========================================================================
    // TEST 3: Strict Completed Submission Immutability & 409 Conflict Rejection
    // =========================================================================
    {
      resetFirestoreSubscriptionMultiplexers();
      (globalThis as any).fetch = expressFetch;

      const hw = await saveAuthoritativeAssignment(
        {
          id: 'hw_immut_1',
          shortId: 'Immut01',
          ownerUid: teacherA.uid,
          title: 'واجب الحماية الصارمة',
          audienceMode: 'open',
          questionTypes: ['choice_all'],
          questionCount: 2,
          setSnapshot: {
            id: 'set_immut',
            title: 'Set',
            category: 'A1',
            items: [
              { id: 'i1', german: 'Hund', arabic: 'كلب' },
              { id: 'i2', german: 'Katze', arabic: 'قطة' }
            ]
          }
        },
        teacherA.uid
      );

      const completedSub: HomeworkSubmission = {
        id: 'sub_immut_1',
        assignmentId: hw.id,
        ownerUid: teacherA.uid,
        attemptSecret: 'sec_immut_1',
        audienceMode: 'open',
        participantId: 'p_immut_1',
        studentName: 'يوسف',
        attemptNumber: 1,
        status: 'completed',
        startedAt: '2026-11-14T10:00:00.000Z',
        completedAt: '2026-11-14T10:01:00.000Z',
        timeSpentSeconds: 60,
        totalQuestions: 2,
        correctAnswersCount: 2,
        scorePercentage: 100,
        score: 2,
        accuracyPercent: 100,
        goldEarned: 250,
        maxStreak: 2,
        gamification: {
          points: 250,
          streak: 2,
          maxStreak: 2,
          doublePointsActive: false,
          timeRemainingSeconds: 60,
          initialTimerSeconds: 120,
          freezeRemainingSeconds: 0,
          slowMotionRemainingSeconds: 0,
          bonusHistory: [],
          processedQuestionIds: ['q1', 'q2'],
          appliedBonusRoundIds: []
        },
        responses: [
          { questionId: 'q1', questionType: 'choice_all', germanWord: 'Hund', studentAnswer: 'كلب', correctAnswer: 'كلب', isCorrect: true, timeSpentSeconds: 2 },
          { questionId: 'q2', questionType: 'choice_all', germanWord: 'Katze', studentAnswer: 'قطة', correctAnswer: 'قطة', isCorrect: true, timeSpentSeconds: 3 }
        ]
      };

      const firstRes = await saveAuthoritativeSubmission(completedSub, hw);
      assert.equal(firstRes.isIdempotentRetry, false);

      // Identical semantic retry -> 200 isIdempotentRetry: true
      const exactRetryRes = await saveSubmissionToFirestoreWithDetails({ ...completedSub });
      // Client dedupe cache prevents unnecessary network write; also verify API directly returns 200 idempotent retry
      const apiRetry = await expressFetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completedSub)
      });
      assert.equal(apiRetry.status, 200);
      const retryData = await apiRetry.json();
      assert.equal(retryData.isIdempotentRetry, true);
      assert.equal(exactRetryRes.synced, true);

      // Changed goldEarned -> 409 Conflict
      const goldConflict = await expressFetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...completedSub, goldEarned: 999 })
      });
      assert.equal(goldConflict.status, 409);

      // Changed responses content -> 409 Conflict
      const respConflict = await expressFetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...completedSub,
          responses: [{ ...completedSub.responses[0], studentAnswer: 'ذئب' }, completedSub.responses[1]]
        })
      });
      assert.equal(respConflict.status, 409);

      // Changed gamification / bonusHistory -> 409 Conflict
      const gamConflict = await expressFetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...completedSub,
          gamification: { ...completedSub.gamification!, doublePointsActive: true }
        })
      });
      assert.equal(gamConflict.status, 409);

      // Downgrade to in_progress -> 409 Conflict
      const downgradeConflict = await expressFetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...completedSub, status: 'in_progress', completedAt: '' })
      });
      assert.equal(downgradeConflict.status, 409);

      // Client helper fail-closed on 409 (never falls back to Firestore setDoc, rejects cleanly)
      let firestoreWritesAttempted = 0;
      (globalThis as any).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('firestore.googleapis.com')) firestoreWritesAttempted++;
        return expressFetch(input, init);
      }) as typeof fetch;

      await assert.rejects(
        () => saveSubmissionWithConfirmation({ ...completedSub, goldEarned: 777 }, hw),
        (err: any) => err?.status === 409
      );
      assert.equal(firestoreWritesAttempted, 0, 'Server 409 Conflict must NEVER fall back to client Firestore setDoc');
      (globalThis as any).fetch = expressFetch;

      // Offline/transient failure queue backoff & 409 permanent drop in flushPendingHomeworkCloudWrites
      localStorageMock.clear();
      const pendingConflictSub: HomeworkSubmission = { ...completedSub, goldEarned: 888, cloudSynced: false };
      saveLocalAssignment(hw, true);
      const storageKey = `glueck_hw_submissions_v3_local_unauthenticated`;
      localStorageMock.setItem(storageKey, JSON.stringify([pendingConflictSub]));
      const flush1 = await flushPendingHomeworkCloudWrites();
      assert.equal(flush1.syncedSubmissions, 0);
      // After 409 drop, second flush makes 0 POST calls for that dropped sub
      let retryPostCalls = 0;
      (globalThis as any).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/homework/submit')) retryPostCalls++;
        return expressFetch(input, init);
      }) as typeof fetch;
      await flushPendingHomeworkCloudWrites();
      assert.equal(retryPostCalls, 0, 'Dropped 409 submission must not be retried');
      (globalThis as any).fetch = expressFetch;

      pass('3. Strict completed submission immutability: exact retry 200, changed fields 409 Conflict, zero silent overwrite');
    }

    // =========================================================================
    // TEST 4: Canonical Deletion Order & Preserved Historical Submissions
    // =========================================================================
    {
      const opOrder: string[] = [];
      const baseDb = new InMemoryAdminFirestore();
      const trackingDb = new Proxy(baseDb as any, {
        get(target, prop, receiver) {
          if (prop === 'collection') {
            return (name: string) => {
              const colRef = target.collection(name);
              return new Proxy(colRef, {
                get(cTarget, cProp) {
                  if (cProp === 'doc') {
                    return (docId: string) => {
                      const dRef = cTarget.doc(docId);
                      return new Proxy(dRef, {
                        get(dTarget, dProp) {
                          if (dProp === 'set') {
                            return async (data: any) => {
                              opOrder.push(`set:${name}:${docId}:revoked=${data?.deleted === true && data?.isActive === false}`);
                              return dTarget.set(data);
                            };
                          }
                          if (dProp === 'delete') {
                            return async () => {
                              opOrder.push(`delete:${name}:${docId}`);
                              return dTarget.delete();
                            };
                          }
                          const val = dTarget[dProp];
                          return typeof val === 'function' ? val.bind(dTarget) : val;
                        }
                      });
                    };
                  }
                  const val = cTarget[cProp];
                  return typeof val === 'function' ? val.bind(cTarget) : val;
                }
              });
            };
          }
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
      setAdminFirestoreOverrideForTesting(trackingDb);

      const delHw = await saveAuthoritativeAssignment(
        {
          id: 'hw_canon_del_1',
          shortId: 'CanDel1',
          ownerUid: teacherA.uid,
          title: 'واجب الحذف المنظم',
          audienceMode: 'open',
          questionTypes: ['choice_all'],
          questionCount: 1,
          setSnapshot: { id: 's_can', title: 'S', category: 'A1', items: [{ id: 'w1', german: 'Haus', arabic: 'منزل' }] }
        },
        teacherA.uid
      );

      await saveAuthoritativeSubmission(
        {
          id: 'sub_preserved_hist_1',
          assignmentId: delHw.id,
          ownerUid: teacherA.uid,
          attemptSecret: 'sec_hist_1',
          audienceMode: 'open',
          participantId: 'p_hist_1',
          studentName: 'ليلى',
          attemptNumber: 1,
          status: 'completed',
          startedAt: '2026-11-14T10:00:00.000Z',
          completedAt: '2026-11-14T10:01:00.000Z',
          timeSpentSeconds: 30,
          totalQuestions: 1,
          correctAnswersCount: 1,
          scorePercentage: 100,
          score: 1,
          accuracyPercent: 100,
          responses: [{ questionId: 'q1', germanWord: 'Haus', studentAnswer: 'منزل', correctAnswer: 'منزل', isCorrect: true }]
        },
        delHw
      );

      opOrder.length = 0;
      const delOutcome = await deleteAuthoritativeAssignmentCanonical(delHw.id, teacherA.uid);
      assert.equal(delOutcome.deleted, true);
      assert.deepEqual(delOutcome.revokedShortIds, ['CanDel1']);

      // Verify strict canonical order: short link revoked BEFORE assignment deleted, and 0 submission deletes
      const revokeIdx = opOrder.indexOf('set:homework_short_links:CanDel1:revoked=true');
      const hwDeleteIdx = opOrder.indexOf('delete:homework_assignments:hw_canon_del_1');
      assert.ok(revokeIdx >= 0, 'Short link must be revoked');
      assert.ok(hwDeleteIdx > revokeIdx, 'Assignment doc MUST be deleted strictly AFTER short link revocation');
      assert.equal(opOrder.some((op) => op.startsWith('delete:homework_submissions:')), false, 'Submissions must NEVER be deleted');

      // Assignment document deleted, short link revoked
      assert.equal(await getAuthoritativeAssignment(delHw.id), null);
      const shortAfter = await getAuthoritativeShortLink('CanDel1');
      assert.equal(shortAfter.status, 'revoked');
      assert.equal(shortAfter.assignmentId, delHw.id);

      // Historical submission preserved & still readable by owning teacher, blocked for other teachers
      const subsAfterDel = await expressFetch(`${baseUrl}/api/homework/submissions?assignmentId=${delHw.id}`, {
        headers: { Authorization: `Bearer ${teacherA.token}` }
      });
      assert.equal(subsAfterDel.status, 200);
      const subsBody = await subsAfterDel.json();
      assert.equal(subsBody.submissions.length, 1);
      assert.equal(subsBody.submissions[0].studentName, 'ليلى');

      // New student submission to deleted assignment still rejected (403)
      const submitAfterDel = await expressFetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'sub_new_after_del',
          assignmentId: delHw.id,
          shortId: 'CanDel1',
          studentName: 'متطفل',
          responses: []
        })
      });
      assert.equal(submitAfterDel.status, 403);

      // Client local deletion also preserves local submissions under archived metadata
      localStorageMock.clear();
      __setHomeworkAuthUserForTests({ uid: teacherA.uid, email: teacherA.email, getIdToken: async () => teacherA.token });
      __setHomeworkSyncTransportForTests({
        saveAssignment: async () => true,
        deleteAssignment: async () => true,
        fetchAllSubmissions: async () => subsBody.submissions
      });
      saveLocalAssignment(delHw, true);
      localStorageMock.setItem(
        `glueck_hw_submissions_v3_${teacherA.uid}`,
        JSON.stringify([
          {
            id: 'sub_loc_pres_1',
            assignmentId: delHw.id,
            assignmentTitle: delHw.title,
            ownerUid: teacherA.uid,
            studentName: 'كريم',
            scorePercentage: 90,
            totalQuestions: 1,
            responses: [],
            completedAt: '2026-11-14T10:02:00.000Z',
            status: 'completed'
          }
        ])
      );
      await deleteHomeworkAssignmentWithConfirmation(delHw.id);
      const archived = getPreservedSubmissionsForDeletedAssignments(teacherA.uid);
      assert.equal(archived.length, 1);
      assert.equal(archived[0].assignmentMeta.title, 'واجب الحذف المنظم');
      assert.equal(archived[0].submissions[0].studentName, 'كريم');

      // Simulate reinstalling the app or clearing localStorage completely:
      // restoreArchivedSubmissionsFromCloud recovers preserved submissions from Firestore and reconstructs original assignment title & metadata!
      localStorageMock.clear();
      const restoredAfterReinstall = await restoreArchivedSubmissionsFromCloud(teacherA.uid);
      assert.equal(restoredAfterReinstall.length, 1, 'Archived submissions must be recoverable after app reinstall / localStorage clear');
      assert.equal(
        restoredAfterReinstall[0].assignmentMeta.title,
        'واجب الحذف المنظم',
        'Archived report must identify the original assignment title even after clearing localStorage'
      );
      assert.equal(restoredAfterReinstall[0].assignmentMeta.questionCount, 1);
      assert.equal(restoredAfterReinstall[0].submissions[0].studentName, 'ليلى');

      // Stale local cache cannot recreate a canonically deleted assignment on server (410 Gone)
      const recreateRes = await expressFetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherA.token}` },
        body: JSON.stringify(delHw)
      });
      assert.equal(recreateRes.status, 410, 'Recreating a canonically deleted assignment must be rejected with 410 Gone');

      setAdminFirestoreOverrideForTesting(memoryDb);
      __setHomeworkSyncTransportForTests(null);
      pass('4. Canonical delete revokes short links BEFORE deleting doc, preserves historical submissions & recovers metadata after localStorage clear/reinstall');
    }

    // =========================================================================
    // TEST 5: Strict Manual Teacher Sync (Zero Reads on localOnly, Assignments-Only Refresh, Paginated Report)
    // =========================================================================
    {
      resetFirestoreSubscriptionMultiplexers();
      localStorageMock.clear();
      __setHomeworkAuthUserForTests({ uid: teacherA.uid, email: teacherA.email, getIdToken: async () => teacherA.token });

      let hwListCalls = 0;
      let singleHwCalls = 0;
      let subListCalls = 0;
      let subSingleCalls = 0;

      const seededHw: HomeworkAssignment = {
        id: 'hw_manual_page_1',
        shortId: 'ManPg01',
        ownerUid: teacherA.uid,
        title: 'واجب المراجعة اليدوية',
        audienceMode: 'open',
        allowedGameModes: ['classic_quiz'],
        maxAttempts: 2,
        allowReplay: true,
        createdBy: 'أ. عبد الرحمن',
        questionTypes: ['choice_all'],
        questionCount: 1,
        isActive: true,
        status: 'active',
        createdAt: '2026-11-14T10:00:00.000Z',
        setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [{ id: 'i1', german: 'Buch', arabic: 'كتاب' }] }
      };

      const seededSubs: HomeworkSubmission[] = [1, 2, 3].map((idx) => ({
        id: `sub_pg_${idx}`,
        assignmentId: seededHw.id,
        ownerUid: teacherA.uid,
        studentName: `طالب ${idx}`,
        attemptNumber: 1,
        status: 'completed',
        startedAt: '2026-11-14T10:00:00.000Z',
        completedAt: `2026-11-14T10:0${idx}:00.000Z`,
        timeSpentSeconds: 30,
        totalQuestions: 1,
        correctAnswersCount: 1,
        scorePercentage: 100,
        score: 1,
        accuracyPercent: 100,
        responses: []
      }));

      __setHomeworkSyncTransportForTests({
        fetchAssignment: async (id) => {
          singleHwCalls++;
          return id === seededHw.id ? seededHw : null;
        },
        fetchAllAssignments: async () => {
          hwListCalls++;
          return [seededHw];
        },
        fetchAllSubmissions: async () => {
          subListCalls++;
          return [];
        },
        fetchSubmissionsForAssignment: async () => {
          subSingleCalls++;
          return seededSubs;
        }
      });

      // 1) localOnly -> 0 cloud reads
      const localRes = await syncAndFetchTeacherAssignments([], { localOnly: true });
      assert.equal(localRes.length, 0);
      assert.equal(hwListCalls + subListCalls + subSingleCalls + singleHwCalls, 0);

      // 2) Main Refresh -> assignmentsOnly: true -> fetches assignments ONLY, 0 submission calls
      const refreshList = await syncAndFetchTeacherAssignments([], { force: true, assignmentsOnly: true });
      assert.equal(refreshList.length, 1);
      assert.equal(hwListCalls, 1);
      assert.equal(subListCalls, 0, 'Main Refresh must perform 0 submission reads');

      // 3) Returning to list uses localOnly -> 0 extra cloud reads
      await syncAndFetchTeacherAssignments([], { localOnly: true });
      assert.equal(hwListCalls, 1);

      // 4) Report Refresh fetches ONLY that assignment + its submissions and records timestamp
      const details = await fetchAssignmentDetailsWithSync(seededHw.id, [], seededHw);
      assert.equal(singleHwCalls, 1);
      assert.equal(subSingleCalls, 1);
      assert.equal(subListCalls, 0, 'Report refresh must never scan all submissions globally');
      assert.equal(details?.submissions?.length, 3);
      assert.ok(details?.lastRefreshedAtMs > 0);

      // Also test Express endpoint pagination (?limit=2&cursor=...)
      await saveAuthoritativeAssignment(seededHw, teacherA.uid);
      for (const s of seededSubs) {
        await saveAuthoritativeSubmission(s, seededHw);
      }
      const p1Res = await expressFetch(`${baseUrl}/api/homework/submissions?assignmentId=${seededHw.id}&limit=2`, {
        headers: { Authorization: `Bearer ${teacherA.token}` }
      });
      assert.equal(p1Res.status, 200);
      const p1 = await p1Res.json();
      assert.equal(p1.submissions.length, 2);
      assert.equal(p1.hasMore, true);
      assert.ok(p1.nextCursor);

      const p2Res = await expressFetch(`${baseUrl}/api/homework/submissions?assignmentId=${seededHw.id}&limit=2&cursor=${p1.nextCursor}`, {
        headers: { Authorization: `Bearer ${teacherA.token}` }
      });
      assert.equal(p2Res.status, 200);
      const p2 = await p2Res.json();
      assert.equal(p2.submissions.length, 1);
      assert.equal(p2.hasMore, false);
      // Verify pagination does not duplicate or skip records across pages
      const combinedIds = [...p1.submissions.map((s: any) => s.id), ...p2.submissions.map((s: any) => s.id)];
      assert.equal(new Set(combinedIds).size, 3, 'Paginated pages must not duplicate or skip submissions');

      // 5) Production Report Refresh when assignment is already cached locally performs 0 assignment reads (only fetches submissions)
      __setHomeworkSyncTransportForTests({
        fetchSubmissionsForAssignment: async () => {
          subSingleCalls++;
          return seededSubs;
        }
      });
      const prevSingleHwCalls = singleHwCalls;
      const cachedReportDetails = await fetchAssignmentDetailsWithSync(seededHw.id, [], seededHw);
      assert.equal(singleHwCalls, prevSingleHwCalls, 'Report Refresh must NOT re-read assignment doc when already cached locally');
      assert.equal(cachedReportDetails?.submissions?.length, 3);

      // 6) Successful empty result does not trigger another query, and offline refresh preserves cached results
      let emptyAssignmentQueries = 0;
      __setHomeworkSyncTransportForTests({
        fetchAllAssignments: async () => {
          emptyAssignmentQueries++;
          return [];
        }
      });
      localStorageMock.clear();
      const emptyRes = await syncAndFetchTeacherAssignments([], { force: true, assignmentsOnly: true });
      assert.equal(emptyRes.length, 0);
      assert.equal(emptyAssignmentQueries, 1, 'Successful empty result must NOT trigger fallback queries');

      // Seed local assignment, go offline, verify cached assignment stays visible
      saveLocalAssignment(seededHw, false);
      Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true, writable: true });
      const offlineList = await syncAndFetchTeacherAssignments([], { localOnly: true });
      assert.equal(offlineList.length, 1, 'Cached assignments must stay visible while offline');
      Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

      __setHomeworkSyncTransportForTests(null);
      pass('5. Strict manual teacher sync: 0 auto reads, assignments-only main refresh, 0 extra assignment reads on report refresh, no duplicate pagination');
    }

    // =========================================================================
    // TEST 6: Custom Sets 1-Shot Deduplication, Sharing Across Teachers & Server Hydration
    // =========================================================================
    {
      resetFirestoreSubscriptionMultiplexers();
      localStorageMock.clear();
      __setHomeworkAuthUserForTests({ uid: teacherA.uid, email: teacherA.email, getIdToken: async () => teacherA.token });

      // 1) Built-in set MUST be skipped with 0 writes
      const builtinSet = DEFAULT_LERNSTUDIO_SETS[0];
      const builtinPubRes = await publishCustomLernstudioSetOnce(builtinSet, teacherA.uid);
      assert.equal(builtinPubRes.skippedBuiltinOrArchived, true);
      assert.equal(builtinPubRes.wrote, false);

      // 2) Custom set publishes once via /api/homework/sets when Firestore client SDK is offline/mocked
      let setPostCount = 0;
      (globalThis as any).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/homework/sets') && (init?.method || 'GET').toUpperCase() === 'POST') {
          setPostCount++;
        }
        if (url.includes('firestore.googleapis.com')) {
          return new Response('mock-offline-for-rest-so-express-handles-set', { status: 503 });
        }
        return expressFetch(input, init);
      }) as typeof fetch;

      const customSet: LernstudioSet = {
        id: 'custom_set_shared_01',
        title: 'مفردات السفر',
        topic: 'Reisen',
        level: 'A1',
        difficulty: 'medium',
        published: true,
        createdByUid: teacherA.uid,
        createdByTeacherName: 'أ. عبد الرحمن',
        items: [
          { id: 'cs_1', german: 'der Zug', arabic: 'القطار', emoji: '🚆' },
          { id: 'cs_2', german: 'das Ticket', arabic: 'التذكرة', emoji: '🎫' }
        ],
        createdAt: '2026-11-14T10:00:00.000Z',
        updatedAt: 1700000000000
      };

      const pub1 = await publishCustomLernstudioSetOnce(customSet, teacherA.uid);
      assert.equal(pub1.synced, true);
      assert.equal(pub1.wrote, true);
      assert.equal(pub1.deduplicated, false);
      assert.equal(setPostCount, 1);

      // Re-publishing unchanged custom set -> deduplicated with 0 writes!
      const pub2 = await publishCustomLernstudioSetOnce({ ...customSet }, teacherA.uid);
      assert.equal(pub2.synced, true);
      assert.equal(pub2.deduplicated, true);
      assert.equal(pub2.wrote, false);
      assert.equal(setPostCount, 1, 'Unchanged custom set must not write again');

      // Modifying custom set content -> publishes updated version cleanly
      const updatedCustomSet: LernstudioSet = {
        ...customSet,
        items: [...customSet.items, { id: 'cs_3', german: 'der Bahnhof', arabic: 'المحطة', emoji: '🚉' }],
        updatedAt: 1700000001000
      };
      const pub3 = await publishCustomLernstudioSetOnce(updatedCustomSet, teacherA.uid);
      assert.equal(pub3.synced, true);
      assert.equal(pub3.wrote, true);
      assert.equal(setPostCount, 2);

      // 3) Teacher B can read Teacher A's published custom set; unauthenticated list returns 401
      const unauthSetsRes = await expressFetch(`${baseUrl}/api/homework/sets`);
      assert.equal(unauthSetsRes.status, 401);

      const teacherBListRes = await expressFetch(`${baseUrl}/api/homework/sets`, {
        headers: { Authorization: `Bearer ${teacherB.token}` }
      });
      assert.equal(teacherBListRes.status, 200);
      const teacherBList = await teacherBListRes.json();
      assert.ok(teacherBList.sets.some((s: any) => s.id === customSet.id && s.items?.length === 3));

      // 4) Direct retrieval by setId from Vercel (GET /api/homework/sets/:setId)
      const getByIdRes = await expressFetch(`${baseUrl}/api/homework/sets/${customSet.id}`, {
        headers: { Authorization: `Bearer ${teacherB.token}` }
      });
      assert.equal(getByIdRes.status, 200);
      const getByIdBody = await getByIdRes.json();
      assert.equal(getByIdBody.set?.id, customSet.id);
      assert.equal(getByIdBody.set?.published, true);
      assert.equal(getByIdBody.set?.items?.length, 3);

      // 5) Vercel assignment creation referencing { setId } hydrates setSnapshot server-side from published set
      const hydratedHwRes = await expressFetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherB.token}` },
        body: JSON.stringify({
          id: 'hw_from_published_set_1',
          shortId: 'PubSet1',
          ownerUid: teacherB.uid,
          setId: customSet.id,
          questionTypes: ['choice_all'],
          audienceMode: 'open',
          maxAttempts: 2
        })
      });
      assert.equal(hydratedHwRes.status, 200);
      const { assignment: hydratedHw } = await hydratedHwRes.json();
      assert.equal(hydratedHw.setId, customSet.id);
      assert.equal(hydratedHw.setSnapshot?.items?.length, 3);
      assert.equal(hydratedHw.questionCount, 3);

      // 6) Student loading the generated homework receives the exact custom set content
      const studentInfoRes = await expressFetch(`${baseUrl}/api/homework/info?shortId=PubSet1`);
      assert.equal(studentInfoRes.status, 200);
      const studentInfo = await studentInfoRes.json();
      const resolvedStudentHw = studentInfo.assignment || studentInfo;
      assert.equal(resolvedStudentHw?.id, 'hw_from_published_set_1');
      assert.equal(resolvedStudentHw?.setSnapshot?.items?.length, 3);
      assert.equal(resolvedStudentHw?.setSnapshot?.items?.[2]?.german, 'der Bahnhof');

      // 7) Access restrictions: private/unpublished set owned by Teacher A returns 403 for Teacher B, 200 for Teacher A; unknown setId returns 404
      await saveAuthoritativePublishedSet(
        {
          id: 'private_set_teacher_a',
          title: 'مجموعة خاصة غير منشورة',
          topic: 'Privat',
          published: false,
          createdByUid: teacherA.uid,
          items: [{ id: 'p1', german: 'Geheim', arabic: 'سري' }]
        },
        teacherA.uid
      );

      const ownerPrivateRes = await expressFetch(`${baseUrl}/api/homework/sets/private_set_teacher_a`, {
        headers: { Authorization: `Bearer ${teacherA.token}` }
      });
      assert.equal(ownerPrivateRes.status, 200, 'Creator can read their own unpublished set');

      const otherTeacherPrivateRes = await expressFetch(`${baseUrl}/api/homework/sets/private_set_teacher_a`, {
        headers: { Authorization: `Bearer ${teacherB.token}` }
      });
      assert.equal(otherTeacherPrivateRes.status, 403, 'Other teacher must receive 403 Forbidden for unpublished set');

      const otherTeacherHwFromPrivateRes = await expressFetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherB.token}` },
        body: JSON.stringify({
          id: 'hw_illegal_private_set',
          ownerUid: teacherB.uid,
          setId: 'private_set_teacher_a',
          questionTypes: ['choice_all'],
          audienceMode: 'open'
        })
      });
      assert.equal(otherTeacherHwFromPrivateRes.status, 403, 'Creating homework from another teacher unpublished set must return 403');

      const unknownSetRes = await expressFetch(`${baseUrl}/api/homework/sets/non_existent_set_id_999`, {
        headers: { Authorization: `Bearer ${teacherA.token}` }
      });
      assert.equal(unknownSetRes.status, 404, 'Non-existent setId must return 404 Not Found');

      const unknownHwSetRes = await expressFetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherA.token}` },
        body: JSON.stringify({
          id: 'hw_unknown_set_id',
          ownerUid: teacherA.uid,
          setId: 'non_existent_set_id_999',
          questionTypes: ['choice_all'],
          audienceMode: 'open'
        })
      });
      assert.equal(unknownHwSetRes.status, 404, 'Creating homework from non-existent setId must return 404');

      // Confirm listAuthoritativePublishedSets & saveAuthoritativePublishedSet helpers work cleanly on server
      const serverSets = await listAuthoritativePublishedSets({ limit: 10 });
      assert.ok(serverSets.sets.some((s: any) => s.id === customSet.id));
      assert.equal(
        serverSets.sets.some((s: any) => s.id === 'private_set_teacher_a'),
        false,
        'Unpublished sets must not appear in shared published sets listing'
      );
      await assert.rejects(
        () => saveAuthoritativePublishedSet(builtinSet as any, teacherA.uid),
        (err: any) => err?.status === 400
      );

      (globalThis as any).fetch = expressFetch;
      pass('6. Built-ins skip Firestore (0 writes), custom sets sync once deduplicated, shared across teachers, Vercel hydrates by setId, and 401/403/404 access restrictions hold');
    }

    console.log(`\n🎉 ALL ${passed} SMART OPTIMIZATION & RELIABILITY TESTS PASSED!`);
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
    __setHomeworkSyncTransportForTests(null);
    __setHomeworkAuthUserForTests(null);
    resetAdminFirestoreForTesting();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Smart Optimization & Reliability Test Failed:', err);
    process.exit(1);
  });
