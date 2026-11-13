import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import expressApp, {
  resetHomeworkStoresForTesting,
  setGooglePublicCertsCacheForTesting
} from '../api/expressApp';
import {
  BONUS_CARD_DEFINITIONS,
  BONUS_CARD_LIST,
  POINTS_CORRECT_ANSWER,
  POINTS_WRONG_ANSWER,
  STREAK_TRIGGER_THRESHOLD,
  applyAnswerGamification,
  applyBonusCardSelection,
  clearActiveHomeworkSession,
  computeDefaultQuizDurationSeconds,
  createInitialGamificationState,
  formatHudTimer,
  generateBalancedBonusDeck,
  loadActiveHomeworkSession,
  restoreGamificationStateFromSnapshot,
  saveActiveHomeworkSession,
  tickGamificationTimer,
  toGamificationSnapshot
} from '../shared/homeworkGamification';
import { createHomeworkAssignmentId, createHomeworkShareToken, createHomeworkShortId } from '../shared/homeworkStorageSync';

(globalThis as any).__TEST_ENV__ = true;

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

console.log('Running Homework Gamification & Bonus Card Rewards Tests...');

// Scenario 1 & 2: 10 consecutive correct answers trigger Bonus Round; wrong answer resets streak cleanly
{
  let state = createInitialGamificationState(25);
  assert.equal(state.points, 0);
  assert.equal(state.streak, 0);
  assert.equal(state.timeRemainingSeconds, 25 * 15);
  assert.equal(formatHudTimer(state.timeRemainingSeconds), '06:15');

  // 9 correct answers -> streak 9, points 90, no bonus round yet
  for (let i = 0; i < 9; i++) {
    const res = applyAnswerGamification(state, {
      questionId: `q_${i}`,
      questionIndex: i,
      isCorrect: true
    });
    assert.equal(res.pointsDelta, POINTS_CORRECT_ANSWER);
    assert.equal(res.triggeredBonusRound, false);
    state = res.nextState;
  }
  assert.equal(state.streak, 9);
  assert.equal(state.points, 90);
  assert.equal(state.pendingBonusRound, null);

  // Wrong answer resets streak to 0 and subtracts 5 points
  const wrongRes = applyAnswerGamification(state, {
    questionId: 'q_wrong_mid',
    questionIndex: 9,
    isCorrect: false
  });
  assert.equal(wrongRes.pointsDelta, -POINTS_WRONG_ANSWER);
  assert.equal(wrongRes.triggeredBonusRound, false);
  state = wrongRes.nextState;
  assert.equal(state.streak, 0);
  assert.equal(state.points, 85);
  assert.equal(state.maxStreak, 9);

  // Next 9 correct answers build streak back to 9 without triggering prematurely
  for (let i = 10; i < 19; i++) {
    const res = applyAnswerGamification(state, {
      questionId: `q_${i}`,
      questionIndex: i,
      isCorrect: true
    });
    assert.equal(res.triggeredBonusRound, false);
    state = res.nextState;
  }
  assert.equal(state.streak, 9);

  // 10th consecutive correct answer triggers the Bonus Card Round cleanly
  const triggerRes = applyAnswerGamification(state, {
    questionId: 'q_19',
    questionIndex: 19,
    isCorrect: true
  });
  assert.equal(triggerRes.triggeredBonusRound, true);
  assert.equal(triggerRes.nextState.streak, STREAK_TRIGGER_THRESHOLD);
  assert.equal(triggerRes.nextState.maxStreak, STREAK_TRIGGER_THRESHOLD);
  assert.ok(triggerRes.nextState.pendingBonusRound, 'Pending Bonus Card Round should be populated');
  assert.equal(triggerRes.nextState.pendingBonusRound!.cards.length, 6);
}

// Scenario 3: Prevent duplicate scoring & ignore unanswered/skipped questions; clamp points >= 0
{
  let state = createInitialGamificationState(12);

  // Wrong answer at 0 points clamps safely to 0
  const wrongAtZero = applyAnswerGamification(state, {
    questionId: 'q_zero',
    questionIndex: 0,
    isCorrect: false
  });
  assert.equal(wrongAtZero.nextState.points, 0);
  state = wrongAtZero.nextState;

  // Duplicate callback for same questionId is completely ignored
  const dupWrong = applyAnswerGamification(state, {
    questionId: 'q_zero',
    questionIndex: 0,
    isCorrect: true
  });
  assert.equal(dupWrong.ignoredDuplicate, true);
  assert.equal(dupWrong.pointsDelta, 0);
  assert.equal(dupWrong.nextState.streak, 0);

  // Unanswered / skipped question does not increment streak or award points
  const unanswered = applyAnswerGamification(state, {
    questionId: 'q_skipped',
    questionIndex: 1,
    isCorrect: true,
    isAnswered: false
  });
  assert.equal(unanswered.pointsDelta, 0);
  assert.equal(unanswered.nextState.streak, 0);
  assert.ok(!unanswered.nextState.processedQuestionIds.includes('q_skipped'));

  // Valid correct answer gives +10 once; duplicate callback gives 0
  const valid = applyAnswerGamification(state, {
    questionId: 'q_valid',
    questionIndex: 1,
    isCorrect: true
  });
  assert.equal(valid.pointsDelta, 10);
  assert.equal(valid.nextState.points, 10);
  const dupValid = applyAnswerGamification(valid.nextState, {
    questionId: 'q_valid',
    questionIndex: 1,
    isCorrect: true
  });
  assert.equal(dupValid.ignoredDuplicate, true);
  assert.equal(dupValid.nextState.points, 10);
}

// Scenario 4 & 5: Bonus Card effects (Gold, Lucky, Double Points x2 only next correct, Time Bonus, Freeze, Slow Motion, Oops, Bad Luck) & one-card guard
{
  // Helper creating an active bonus round with a chosen card in slot 0
  function makeRoundWithCard(cardType: keyof typeof BONUS_CARD_DEFINITIONS, basePoints = 100, baseTime = 120) {
    const base = createInitialGamificationState(10);
    const cardDef = BONUS_CARD_DEFINITIONS[cardType];
    const round = {
      roundId: `round_${cardType}`,
      triggerQuestionId: 'q_9',
      triggerQuestionIndex: 9,
      cards: [{ ...cardDef, instanceId: `inst_${cardType}`, slotIndex: 0 }]
    };
    return {
      ...base,
      points: basePoints,
      streak: 10,
      maxStreak: 10,
      timeRemainingSeconds: baseTime,
      pendingBonusRound: round
    };
  }

  // Gold Bonus (+30) & one-time pick lock + streak reset
  const goldStart = makeRoundWithCard('gold_bonus', 100, 120);
  const goldPick = applyBonusCardSelection(goldStart, 'inst_gold_bonus');
  assert.equal(goldPick.alreadyApplied, false);
  assert.equal(goldPick.nextState.points, 130);
  assert.equal(goldPick.nextState.streak, 0);
  assert.equal(goldPick.nextState.pendingBonusRound, null);
  assert.equal(goldPick.nextState.bonusHistory.length, 1);

  // Attempting to pick a second time on the same round is blocked
  const secondPick = applyBonusCardSelection(goldPick.nextState, 'inst_gold_bonus');
  assert.equal(secondPick.alreadyApplied, true);
  assert.equal(secondPick.nextState.points, 130);

  // Lucky Card (+15)
  const luckyPick = applyBonusCardSelection(makeRoundWithCard('lucky_card', 50, 90), 'inst_lucky_card');
  assert.equal(luckyPick.nextState.points, 65);
  assert.equal(luckyPick.nextState.streak, 0);

  // Time Bonus (+20s)
  const timePick = applyBonusCardSelection(makeRoundWithCard('time_bonus', 50, 90), 'inst_time_bonus');
  assert.equal(timePick.nextState.timeRemainingSeconds, 110);

  // Oops! (-15 pts)
  const oopsPick = applyBonusCardSelection(makeRoundWithCard('oops', 40, 90), 'inst_oops');
  assert.equal(oopsPick.nextState.points, 25);

  // Bad Luck (-10 pts, -5s)
  const badLuckPick = applyBonusCardSelection(makeRoundWithCard('bad_luck', 40, 90), 'inst_bad_luck');
  assert.equal(badLuckPick.nextState.points, 30);
  assert.equal(badLuckPick.nextState.timeRemainingSeconds, 85);

  // Double Points: doubles ONLY next correct answer (+20), then returns to normal (+10)
  const doublePick = applyBonusCardSelection(makeRoundWithCard('double_points', 100, 120), 'inst_double_points');
  assert.equal(doublePick.nextState.doublePointsActive, true);

  const afterDoubleQ = applyAnswerGamification(doublePick.nextState, {
    questionId: 'q_after_double_1',
    questionIndex: 10,
    isCorrect: true
  });
  assert.equal(afterDoubleQ.doubledApplied, true);
  assert.equal(afterDoubleQ.pointsDelta, 20);
  assert.equal(afterDoubleQ.nextState.points, 120);
  assert.equal(afterDoubleQ.nextState.doublePointsActive, false);

  const afterNormalQ = applyAnswerGamification(afterDoubleQ.nextState, {
    questionId: 'q_after_double_2',
    questionIndex: 11,
    isCorrect: true
  });
  assert.equal(afterNormalQ.doubledApplied, false);
  assert.equal(afterNormalQ.pointsDelta, 10);
  assert.equal(afterNormalQ.nextState.points, 130);
}

// Scenario 6: Time Freeze (5s pause), Slow Motion (half speed for 10s), and Overlay Pause
{
  let frozen = {
    ...createInitialGamificationState(10),
    timeRemainingSeconds: 100,
    freezeRemainingSeconds: 5
  };

  // Timer is frozen for 5 ticks
  for (let i = 0; i < 5; i++) {
    frozen = tickGamificationTimer(frozen, false);
    assert.equal(frozen.timeRemainingSeconds, 100);
  }
  assert.equal(frozen.freezeRemainingSeconds, 0);

  // 6th tick resumes normal countdown
  frozen = tickGamificationTimer(frozen, false);
  assert.equal(frozen.timeRemainingSeconds, 99);

  // Slow Motion (10 real ticks deduct only 5 timer seconds)
  let slow = {
    ...createInitialGamificationState(10),
    timeRemainingSeconds: 100,
    slowMotionRemainingSeconds: 10
  };
  for (let i = 0; i < 10; i++) {
    slow = tickGamificationTimer(slow, false);
  }
  assert.equal(slow.slowMotionRemainingSeconds, 0);
  assert.equal(slow.timeRemainingSeconds, 95);

  // While overlay is open or pendingBonusRound is non-null, timer is paused completely
  const pausedOverlay = tickGamificationTimer(slow, true);
  assert.equal(pausedOverlay.timeRemainingSeconds, 95);
}

// Scenario 7: Active session save/restore & snapshot restoration without duplicating rewards
{
  const prevWindow = (globalThis as any).window;
  const prevLocalStorage = (globalThis as any).localStorage;
  const memStorage = new MemoryLocalStorage();
  (globalThis as any).window = { localStorage: memStorage };
  (globalThis as any).localStorage = memStorage;

  try {
    let st = createInitialGamificationState(15, 4);
    assert.equal(computeDefaultQuizDurationSeconds(15, 4), 240);

    st = applyAnswerGamification(st, { questionId: 'q_a', questionIndex: 0, isCorrect: true }).nextState;
    st = applyAnswerGamification(st, { questionId: 'q_b', questionIndex: 1, isCorrect: true }).nextState;

    saveActiveHomeworkSession({
      version: 1,
      assignmentId: 'hw_session_1',
      submissionId: 'sub_1',
      attemptNumber: 1,
      studentName: 'Omar',
      selectedStudentId: '',
      openParticipantId: 'open_omar',
      phase: 'quiz',
      studyIndex: 0,
      currentIdx: 2,
      completedStudyPhase: true,
      startTime: '2026-11-12T10:00:00.000Z',
      responses: [
        {
          questionId: 'q_a',
          questionType: 'choice_2',
          germanWord: 'das Buch',
          promptText: 'das Buch',
          studentAnswer: 'das Buch',
          correctAnswer: 'das Buch',
          isCorrect: true,
          timeSpentSeconds: 3
        }
      ],
      gamification: st,
      updatedAtMs: Date.now()
    });

    const loaded = loadActiveHomeworkSession('hw_session_1');
    assert.ok(loaded);
    assert.equal(loaded!.currentIdx, 2);
    assert.equal(loaded!.gamification.points, 20);
    assert.equal(loaded!.gamification.streak, 2);

    const restoredFromSnap = restoreGamificationStateFromSnapshot(toGamificationSnapshot(st), 15, 4);
    // Re-triggering an already processed question ID after refresh does NOT double-score
    const replayDup = applyAnswerGamification(restoredFromSnap, {
      questionId: 'q_a',
      questionIndex: 0,
      isCorrect: true
    });
    assert.equal(replayDup.ignoredDuplicate, true);
    assert.equal(replayDup.nextState.points, 20);

    clearActiveHomeworkSession('hw_session_1');
    assert.equal(loadActiveHomeworkSession('hw_session_1'), null);
  } finally {
    (globalThis as any).window = prevWindow;
    (globalThis as any).localStorage = prevLocalStorage;
  }
}

// Scenario 8: Weighted distribution & card deck guarantees
{
  assert.equal(BONUS_CARD_LIST.length, 8);
  let positiveTotal = 0;
  let totalDrawn = 0;
  for (let i = 0; i < 60; i++) {
    const deck = generateBalancedBonusDeck(6);
    assert.equal(deck.length, 6);
    const uniqueTypes = new Set(deck.map((c) => c.type));
    assert.equal(uniqueTypes.size, 6, 'Deck should not duplicate card types within a single round');
    assert.ok(deck.some((c) => c.isPositive), 'Every bonus deck must offer positive rewards');
    for (const c of deck) {
      totalDrawn++;
      if (c.isPositive) positiveTotal++;
    }
  }
  assert.ok(positiveTotal / totalDrawn >= 0.75, 'Distribution should remain majority-positive & balanced');
}

// Scenario 9: API submission preserves gamification telemetry & enforces isolation/active status
async function runApiVerification() {
  resetHomeworkStoresForTesting();
  const rsa = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  setGooglePublicCertsCacheForTesting({ gamification_kid: rsa.publicKey }, Date.now() + 86400000);

  const server = expressApp.listen(0);
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const makeToken = (uid: string) => {
    const now = Math.floor(Date.now() / 1000);
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'gamification_kid', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(
      JSON.stringify({
        iss: 'https://securetoken.google.com/glueck-c8621',
        aud: 'glueck-c8621',
        sub: uid,
        email: `${uid}@glueck.de`,
        iat: now - 10,
        auth_time: now - 10,
        exp: now + 3600
      })
    ).toString('base64url');
    const sig = crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(rsa.privateKey, 'base64url');
    return `${h}.${p}.${sig}`;
  };

  try {
    const hwId = createHomeworkAssignmentId();
    const shortId = createHomeworkShortId(7);
    const shareToken = createHomeworkShareToken();
    const teacherJwt = makeToken('teacher_gam_1');

    const createRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherJwt}`
      },
      body: JSON.stringify({
        id: hwId,
        shortId,
        shareToken,
        title: 'واجب المكافآت',
        audienceMode: 'open',
        questionTypes: ['choice_2'],
        setSnapshot: {
          id: 'set_gam',
          title: 'Gamification Set',
          category: 'A1',
          items: [{ id: 'w1', german: 'das Buch', arabic: 'الكتاب' }]
        },
        selectedItemIds: ['w1'],
        questionCount: 10,
        isActive: true,
        status: 'active'
      })
    });
    assert.equal(createRes.status, 200);

    // Submit completed homework including gamification snapshot
    const gamState = applyAnswerGamification(createInitialGamificationState(10), {
      questionId: 'q_1',
      questionIndex: 0,
      isCorrect: true
    }).nextState;

    const submitRes = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `sub_gam_${Date.now()}`,
        assignmentId: hwId,
        shortId,
        token: shareToken,
        audienceMode: 'open',
        studentName: 'Lina',
        participantId: 'open_lina',
        attemptNumber: 1,
        responses: [
          {
            questionId: 'q_1',
            questionType: 'choice_2',
            germanWord: 'das Buch',
            promptText: 'das Buch',
            studentAnswer: 'das Buch',
            correctAnswer: 'das Buch',
            isCorrect: true,
            timeSpentSeconds: 2
          }
        ],
        goldEarned: gamState.points,
        maxStreak: gamState.maxStreak,
        gamification: toGamificationSnapshot(gamState)
      })
    });
    assert.equal(submitRes.status, 200);
    const submitBody: any = await submitRes.json();
    assert.equal(submitBody.submission.goldEarned, 10);
    assert.equal(submitBody.submission.gamification?.points, 10);

    // Revoking / deleting assignment blocks subsequent submissions cleanly
    const revokeRes = await fetch(`${baseUrl}/api/teacher/assignments?id=${encodeURIComponent(hwId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherJwt}`
      }
    });
    assert.equal(revokeRes.status, 200);

    const blockedSubmit = await fetch(`${baseUrl}/api/homework/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentId: hwId,
        shortId,
        token: shareToken,
        studentName: 'Lina',
        responses: []
      })
    });
    assert.ok(blockedSubmit.status === 403 || blockedSubmit.status === 404);
  } finally {
    server.close();
  }
}

await runApiVerification();

console.log('✓ All Homework Gamification & Bonus Card Rewards tests passed!');
