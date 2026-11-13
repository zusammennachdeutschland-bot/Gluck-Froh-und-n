import {
  HomeworkAppliedBonusCard,
  HomeworkBonusCardType,
  HomeworkGamificationSnapshot,
  HomeworkQuestionResponse
} from './homeworkTypes';
import { LernstudioSoundType } from './lernstudioAudioUtils';

export const STREAK_TRIGGER_THRESHOLD = 10;
export const POINTS_CORRECT_ANSWER = 10;
export const POINTS_WRONG_ANSWER = 5;
export const DEFAULT_SECONDS_PER_QUESTION = 15;
export const MIN_QUIZ_TIMER_SECONDS = 120;
export const BONUS_CARD_COUNT_PER_ROUND = 6;

export type BonusCardTone = 'gold' | 'emerald' | 'violet' | 'sky' | 'cyan' | 'indigo' | 'rose' | 'amber';

export interface BonusCardDefinition {
  type: HomeworkBonusCardType;
  titleEn: string;
  titleAr: string;
  descriptionAr: string;
  effectBadgeAr: string;
  emoji: string;
  tone: BonusCardTone;
  weight: number;
  isPositive: boolean;
  pointsDelta: number;
  timeDeltaSeconds: number;
  doubleNextCorrect?: boolean;
  freezeSeconds?: number;
  slowMotionSeconds?: number;
  soundEffect: LernstudioSoundType;
}

/**
 * Centralized, configurable Bonus Card catalog.
 * Adjust weights, deltas, or labels here to rebalance rewards globally.
 */
export const BONUS_CARD_DEFINITIONS: Record<HomeworkBonusCardType, BonusCardDefinition> = {
  gold_bonus: {
    type: 'gold_bonus',
    titleEn: 'Gold Bonus',
    titleAr: 'مكافأة ذهبية',
    descriptionAr: 'تُضاف 30 نقطة فوراً إلى رصيدك!',
    effectBadgeAr: '+30 نقطة',
    emoji: '🪙',
    tone: 'gold',
    weight: 14,
    isPositive: true,
    pointsDelta: 30,
    timeDeltaSeconds: 0,
    soundEffect: 'coin_drop'
  },
  lucky_card: {
    type: 'lucky_card',
    titleEn: 'Lucky Card',
    titleAr: 'بطاقة الحظ',
    descriptionAr: 'حصلت على 15 نقطة إضافية!',
    effectBadgeAr: '+15 نقطة',
    emoji: '🍀',
    tone: 'emerald',
    weight: 20,
    isPositive: true,
    pointsDelta: 15,
    timeDeltaSeconds: 0,
    soundEffect: 'powerup_gift'
  },
  double_points: {
    type: 'double_points',
    titleEn: 'Double Points',
    titleAr: 'نقاط مضاعفة ×2',
    descriptionAr: 'مضاعفة نقاط الإجابة الصحيحة القادمة (×2)!',
    effectBadgeAr: '×2 للسؤال القادم',
    emoji: '⚡',
    tone: 'violet',
    weight: 16,
    isPositive: true,
    pointsDelta: 0,
    timeDeltaSeconds: 0,
    doubleNextCorrect: true,
    soundEffect: 'powerup_star'
  },
  time_bonus: {
    type: 'time_bonus',
    titleEn: 'Time Bonus',
    titleAr: 'وقت إضافي',
    descriptionAr: 'تمت إضافة 20 ثانية إلى مؤقت الواجب!',
    effectBadgeAr: '+20 ثانية',
    emoji: '⏱️',
    tone: 'sky',
    weight: 16,
    isPositive: true,
    pointsDelta: 0,
    timeDeltaSeconds: 20,
    soundEffect: 'powerup_rocket'
  },
  time_freeze: {
    type: 'time_freeze',
    titleEn: 'Time Freeze',
    titleAr: 'تجميد المؤقت',
    descriptionAr: 'يتوقف المؤقت عن العد لمدة 5 ثوانٍ!',
    effectBadgeAr: 'تجميد 5 ثوانٍ',
    emoji: '❄️',
    tone: 'cyan',
    weight: 12,
    isPositive: true,
    pointsDelta: 0,
    timeDeltaSeconds: 0,
    freezeSeconds: 5,
    soundEffect: 'sonar_ping'
  },
  slow_motion: {
    type: 'slow_motion',
    titleEn: 'Slow Motion',
    titleAr: 'حركة بطيئة',
    descriptionAr: 'يصبح المؤقت أبطأ بنصف السرعة لمدة 10 ثوانٍ!',
    effectBadgeAr: 'إبطاء 10 ثوانٍ',
    emoji: '🐢',
    tone: 'indigo',
    weight: 10,
    isPositive: true,
    pointsDelta: 0,
    timeDeltaSeconds: 0,
    slowMotionSeconds: 10,
    soundEffect: 'bubble_wash'
  },
  oops: {
    type: 'oops',
    titleEn: 'Oops!',
    titleAr: 'أوبس!',
    descriptionAr: 'للأسف! تم خصم 15 نقطة من الرصيد.',
    effectBadgeAr: '-15 نقطة',
    emoji: '💥',
    tone: 'rose',
    weight: 7,
    isPositive: false,
    pointsDelta: -15,
    timeDeltaSeconds: 0,
    soundEffect: 'powerup_boom'
  },
  bad_luck: {
    type: 'bad_luck',
    titleEn: 'Bad Luck',
    titleAr: 'حظ سيئ',
    descriptionAr: 'خصم 10 نقاط و5 ثوانٍ من الوقت!',
    effectBadgeAr: '-10 نقاط · -5 ث',
    emoji: '🌩️',
    tone: 'amber',
    weight: 5,
    isPositive: false,
    pointsDelta: -10,
    timeDeltaSeconds: -5,
    soundEffect: 'wrong'
  }
};

export const BONUS_CARD_LIST: BonusCardDefinition[] = Object.values(BONUS_CARD_DEFINITIONS);

export interface BonusCardInstance extends BonusCardDefinition {
  instanceId: string;
  slotIndex: number;
}

export interface PendingBonusRound {
  roundId: string;
  triggerQuestionId: string;
  triggerQuestionIndex: number;
  cards: BonusCardInstance[];
}

export interface HomeworkGamificationState {
  points: number;
  streak: number;
  maxStreak: number;
  doublePointsActive: boolean;
  timeRemainingSeconds: number;
  initialTimerSeconds: number;
  freezeRemainingSeconds: number;
  slowMotionRemainingSeconds: number;
  slowMotionTickParity: number;
  pendingBonusRound: PendingBonusRound | null;
  processedQuestionIds: string[];
  appliedBonusRoundIds: string[];
  bonusHistory: HomeworkAppliedBonusCard[];
}

export function computeDefaultQuizDurationSeconds(
  questionCount: number,
  timeLimitMinutes?: number
): number {
  if (typeof timeLimitMinutes === 'number' && Number.isFinite(timeLimitMinutes) && timeLimitMinutes > 0) {
    return Math.max(30, Math.round(timeLimitMinutes * 60));
  }
  const safeCount = Math.max(1, Math.round(questionCount || 1));
  return Math.max(MIN_QUIZ_TIMER_SECONDS, safeCount * DEFAULT_SECONDS_PER_QUESTION);
}

export function createInitialGamificationState(
  questionCount: number,
  timeLimitMinutes?: number
): HomeworkGamificationState {
  const initialTimerSeconds = computeDefaultQuizDurationSeconds(questionCount, timeLimitMinutes);
  return {
    points: 0,
    streak: 0,
    maxStreak: 0,
    doublePointsActive: false,
    timeRemainingSeconds: initialTimerSeconds,
    initialTimerSeconds,
    freezeRemainingSeconds: 0,
    slowMotionRemainingSeconds: 0,
    slowMotionTickParity: 0,
    pendingBonusRound: null,
    processedQuestionIds: [],
    appliedBonusRoundIds: [],
    bonusHistory: []
  };
}

export function toGamificationSnapshot(
  state: HomeworkGamificationState
): HomeworkGamificationSnapshot {
  return {
    points: state.points,
    streak: state.streak,
    maxStreak: state.maxStreak,
    doublePointsActive: state.doublePointsActive,
    timeRemainingSeconds: state.timeRemainingSeconds,
    initialTimerSeconds: state.initialTimerSeconds,
    freezeRemainingSeconds: state.freezeRemainingSeconds,
    slowMotionRemainingSeconds: state.slowMotionRemainingSeconds,
    slowMotionTickParity: state.slowMotionTickParity,
    processedQuestionIds: [...state.processedQuestionIds],
    appliedBonusRoundIds: [...state.appliedBonusRoundIds],
    bonusHistory: [...state.bonusHistory]
  };
}

export function restoreGamificationStateFromSnapshot(
  snapshot: Partial<HomeworkGamificationSnapshot> | null | undefined,
  fallbackQuestionCount: number,
  fallbackTimeLimitMinutes?: number
): HomeworkGamificationState {
  const base = createInitialGamificationState(fallbackQuestionCount, fallbackTimeLimitMinutes);
  if (!snapshot) return base;
  return {
    points: typeof snapshot.points === 'number' && Number.isFinite(snapshot.points) ? Math.max(0, snapshot.points) : base.points,
    streak: typeof snapshot.streak === 'number' && Number.isFinite(snapshot.streak) ? Math.max(0, snapshot.streak) : base.streak,
    maxStreak:
      typeof snapshot.maxStreak === 'number' && Number.isFinite(snapshot.maxStreak)
        ? Math.max(0, snapshot.maxStreak)
        : base.maxStreak,
    doublePointsActive: Boolean(snapshot.doublePointsActive),
    timeRemainingSeconds:
      typeof snapshot.timeRemainingSeconds === 'number' && Number.isFinite(snapshot.timeRemainingSeconds)
        ? Math.max(0, snapshot.timeRemainingSeconds)
        : base.timeRemainingSeconds,
    initialTimerSeconds:
      typeof snapshot.initialTimerSeconds === 'number' && Number.isFinite(snapshot.initialTimerSeconds)
        ? Math.max(30, snapshot.initialTimerSeconds)
        : base.initialTimerSeconds,
    freezeRemainingSeconds:
      typeof snapshot.freezeRemainingSeconds === 'number' && Number.isFinite(snapshot.freezeRemainingSeconds)
        ? Math.max(0, snapshot.freezeRemainingSeconds)
        : 0,
    slowMotionRemainingSeconds:
      typeof snapshot.slowMotionRemainingSeconds === 'number' &&
      Number.isFinite(snapshot.slowMotionRemainingSeconds)
        ? Math.max(0, snapshot.slowMotionRemainingSeconds)
        : 0,
    slowMotionTickParity:
      typeof snapshot.slowMotionTickParity === 'number' ? snapshot.slowMotionTickParity % 2 : 0,
    pendingBonusRound: null,
    processedQuestionIds: Array.isArray(snapshot.processedQuestionIds)
      ? snapshot.processedQuestionIds.filter((x): x is string => typeof x === 'string')
      : [],
    appliedBonusRoundIds: Array.isArray(snapshot.appliedBonusRoundIds)
      ? snapshot.appliedBonusRoundIds.filter((x): x is string => typeof x === 'string')
      : [],
    bonusHistory: Array.isArray(snapshot.bonusHistory) ? snapshot.bonusHistory : []
  };
}

/**
 * Generates a balanced, shuffled deck of face-down cards using weighted sampling
 * without repeating card types inside a single round.
 */
export function generateBalancedBonusDeck(
  cardCount = BONUS_CARD_COUNT_PER_ROUND,
  rng: () => number = Math.random
): BonusCardInstance[] {
  const pool = [...BONUS_CARD_LIST];
  const chosen: BonusCardDefinition[] = [];
  const count = Math.max(3, Math.min(cardCount, pool.length));

  while (chosen.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
    let pick = Math.max(0, Math.min(0.999999, rng())) * totalWeight;
    let pickedIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      pick -= Math.max(1, pool[i].weight);
      if (pick <= 0) {
        pickedIdx = i;
        break;
      }
    }
    const [picked] = pool.splice(pickedIdx, 1);
    chosen.push(picked);
  }

  // Ensure at least 1 positive/reward card is always present
  if (!chosen.some((c) => c.isPositive) && chosen.length > 0) {
    chosen[0] = BONUS_CARD_DEFINITIONS.lucky_card;
  }

  // Fisher-Yates shuffle
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.max(0, Math.min(0.999999, rng())) * (i + 1));
    const tmp = chosen[i];
    chosen[i] = chosen[j];
    chosen[j] = tmp;
  }

  return chosen.map((def, idx) => ({
    ...def,
    instanceId: `card_${idx}_${def.type}`,
    slotIndex: idx
  }));
}

export interface AnswerGamificationTransition {
  nextState: HomeworkGamificationState;
  pointsDelta: number;
  doubledApplied: boolean;
  triggeredBonusRound: boolean;
  ignoredDuplicate: boolean;
}

/**
 * Processes an answered question idempotently:
 * - Ignores unanswered/skipped questions (no streak or score change).
 * - Ignores duplicate callbacks for an already-processed questionId.
 * - Awards +10 (or +20 if Double Points is active) on correct; -5 (clamped >= 0) on wrong.
 * - Triggers the Bonus Card Round when streak reaches 10 consecutive correct answers.
 */
export function applyAnswerGamification(
  state: HomeworkGamificationState,
  params: {
    questionId: string;
    questionIndex: number;
    isCorrect: boolean;
    isAnswered?: boolean;
    rng?: () => number;
  }
): AnswerGamificationTransition {
  const { questionId, questionIndex, isCorrect, isAnswered = true, rng = Math.random } = params;

  if (!isAnswered || !questionId) {
    return {
      nextState: state,
      pointsDelta: 0,
      doubledApplied: false,
      triggeredBonusRound: false,
      ignoredDuplicate: false
    };
  }

  if (state.processedQuestionIds.includes(questionId)) {
    return {
      nextState: state,
      pointsDelta: 0,
      doubledApplied: false,
      triggeredBonusRound: false,
      ignoredDuplicate: true
    };
  }

  const nextProcessedIds = [...state.processedQuestionIds, questionId];

  if (!isCorrect) {
    const nextPoints = Math.max(0, state.points - POINTS_WRONG_ANSWER);
    const actualDelta = nextPoints - state.points;
    return {
      nextState: {
        ...state,
        points: nextPoints,
        streak: 0,
        processedQuestionIds: nextProcessedIds
      },
      pointsDelta: actualDelta,
      doubledApplied: false,
      triggeredBonusRound: false,
      ignoredDuplicate: false
    };
  }

  const doubledApplied = Boolean(state.doublePointsActive);
  const earned = doubledApplied ? POINTS_CORRECT_ANSWER * 2 : POINTS_CORRECT_ANSWER;
  const nextPoints = state.points + earned;
  const nextStreak = state.streak + 1;
  const nextMaxStreak = Math.max(state.maxStreak, nextStreak);

  const bonusRoundId = `bonus_${questionId}_${state.appliedBonusRoundIds.length + 1}`;
  const shouldTriggerBonus =
    nextStreak >= STREAK_TRIGGER_THRESHOLD &&
    !state.pendingBonusRound &&
    !state.appliedBonusRoundIds.includes(bonusRoundId);

  const nextPendingRound: PendingBonusRound | null = shouldTriggerBonus
    ? {
        roundId: bonusRoundId,
        triggerQuestionId: questionId,
        triggerQuestionIndex: questionIndex,
        cards: generateBalancedBonusDeck(BONUS_CARD_COUNT_PER_ROUND, rng)
      }
    : state.pendingBonusRound;

  return {
    nextState: {
      ...state,
      points: nextPoints,
      streak: nextStreak,
      maxStreak: nextMaxStreak,
      doublePointsActive: false,
      pendingBonusRound: nextPendingRound,
      processedQuestionIds: nextProcessedIds
    },
    pointsDelta: earned,
    doubledApplied,
    triggeredBonusRound: shouldTriggerBonus,
    ignoredDuplicate: false
  };
}

export interface BonusCardSelectionResult {
  nextState: HomeworkGamificationState;
  selectedCard: BonusCardInstance | null;
  alreadyApplied: boolean;
}

/**
 * Applies the selected Bonus Card effect immediately & exactly once,
 * records the applied roundId to block duplicate execution, clears pendingBonusRound,
 * and resets streak back to 0 so counting starts fresh.
 */
export function applyBonusCardSelection(
  state: HomeworkGamificationState,
  cardInstanceId: string,
  nowIso = new Date().toISOString()
): BonusCardSelectionResult {
  const round = state.pendingBonusRound;
  if (!round || state.appliedBonusRoundIds.includes(round.roundId)) {
    return {
      nextState: state,
      selectedCard: null,
      alreadyApplied: true
    };
  }

  const card = round.cards.find((c) => c.instanceId === cardInstanceId);
  if (!card) {
    return {
      nextState: state,
      selectedCard: null,
      alreadyApplied: false
    };
  }

  const nextPoints = Math.max(0, state.points + card.pointsDelta);
  const nextTime = Math.max(0, state.timeRemainingSeconds + card.timeDeltaSeconds);
  const nextDoublePoints = card.doubleNextCorrect ? true : state.doublePointsActive;
  const nextFreeze =
    card.freezeSeconds && card.freezeSeconds > 0
      ? state.freezeRemainingSeconds + card.freezeSeconds
      : state.freezeRemainingSeconds;
  const nextSlowMotion =
    card.slowMotionSeconds && card.slowMotionSeconds > 0
      ? state.slowMotionRemainingSeconds + card.slowMotionSeconds
      : state.slowMotionRemainingSeconds;

  const historyRecord: HomeworkAppliedBonusCard = {
    roundId: round.roundId,
    cardType: card.type,
    titleEn: card.titleEn,
    titleAr: card.titleAr,
    effectSummaryAr: card.effectBadgeAr,
    pointsDelta: nextPoints - state.points,
    timeDeltaSeconds: nextTime - state.timeRemainingSeconds,
    appliedAt: nowIso,
    triggerQuestionId: round.triggerQuestionId
  };

  return {
    nextState: {
      ...state,
      points: nextPoints,
      streak: 0,
      doublePointsActive: nextDoublePoints,
      timeRemainingSeconds: nextTime,
      freezeRemainingSeconds: nextFreeze,
      slowMotionRemainingSeconds: nextSlowMotion,
      pendingBonusRound: null,
      appliedBonusRoundIds: [...state.appliedBonusRoundIds, round.roundId],
      bonusHistory: [...state.bonusHistory, historyRecord]
    },
    selectedCard: card,
    alreadyApplied: false
  };
}

/**
 * Advances the homework countdown timer by 1 real second, respecting:
 * - Overlay pause (Bonus Card Round open) -> paused completely
 * - Time Freeze -> decrements freeze counter without deducting quiz time
 * - Slow Motion -> half speed (deducts 1 timer second every 2 real seconds)
 */
export function tickGamificationTimer(
  state: HomeworkGamificationState,
  isPausedForOverlay = false
): HomeworkGamificationState {
  if (isPausedForOverlay || state.pendingBonusRound || state.timeRemainingSeconds <= 0) {
    return state;
  }

  if (state.freezeRemainingSeconds > 0) {
    return {
      ...state,
      freezeRemainingSeconds: Math.max(0, state.freezeRemainingSeconds - 1)
    };
  }

  if (state.slowMotionRemainingSeconds > 0) {
    const nextParity = (state.slowMotionTickParity + 1) % 2;
    const shouldDecrementTimer = nextParity === 0;
    return {
      ...state,
      slowMotionRemainingSeconds: Math.max(0, state.slowMotionRemainingSeconds - 1),
      slowMotionTickParity: nextParity,
      timeRemainingSeconds: shouldDecrementTimer
        ? Math.max(0, state.timeRemainingSeconds - 1)
        : state.timeRemainingSeconds
    };
  }

  return {
    ...state,
    timeRemainingSeconds: Math.max(0, state.timeRemainingSeconds - 1)
  };
}

export function formatHudTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// ACTIVE SESSION PERSISTENCE (Safe Refresh & Reconnection Restore)
// ============================================================================

export interface ActiveHomeworkSessionState {
  version: 1;
  assignmentId: string;
  submissionId: string;
  attemptNumber: number;
  studentName: string;
  selectedStudentId: string;
  openParticipantId: string;
  phase: 'teacher_study' | 'quiz';
  studyIndex: number;
  currentIdx: number;
  completedStudyPhase: boolean;
  startTime: string;
  responses: HomeworkQuestionResponse[];
  gamification: HomeworkGamificationState;
  updatedAtMs: number;
}

const ACTIVE_HW_SESSION_PREFIX = 'gluck_hw_active_session_v1_';

function getActiveSessionStorageKey(assignmentId: string): string {
  return `${ACTIVE_HW_SESSION_PREFIX}${assignmentId.trim()}`;
}

export function saveActiveHomeworkSession(session: ActiveHomeworkSessionState): void {
  if (typeof window === 'undefined' || !session?.assignmentId) return;
  try {
    localStorage.setItem(getActiveSessionStorageKey(session.assignmentId), JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadActiveHomeworkSession(assignmentId: string): ActiveHomeworkSessionState | null {
  if (typeof window === 'undefined' || !assignmentId) return null;
  try {
    const raw = localStorage.getItem(getActiveSessionStorageKey(assignmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveHomeworkSessionState;
    if (!parsed || parsed.version !== 1 || parsed.assignmentId !== assignmentId) {
      return null;
    }
    // Expire stale active sessions older than 24 hours
    if (parsed.updatedAtMs && Date.now() - parsed.updatedAtMs > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getActiveSessionStorageKey(assignmentId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveHomeworkSession(assignmentId: string): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    localStorage.removeItem(getActiveSessionStorageKey(assignmentId));
  } catch {
    // Ignore storage errors
  }
}
