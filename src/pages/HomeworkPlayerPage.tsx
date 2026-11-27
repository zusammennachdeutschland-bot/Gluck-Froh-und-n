import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  Snail,
  CheckCircle2,
  XCircle,
  Trophy,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Flame,
  Coins,
  Check,
  X,
  CloudOff,
  RefreshCw,
  Clock,
  Snowflake,
  Gauge,
  Zap,
  AlertTriangle,
  Eye,
  Pause
} from 'lucide-react';
import { speakGermanText, stopGermanSpeech } from '../shared/audioSpeechUtils';
import { fetchHomeworkApi } from '../shared/firebaseCloudSync';
import {
  playLernstudioSound,
  playGermanVoiceFeedback,
  isSoundMuted,
  setSoundMuted
} from '../shared/lernstudioAudioUtils';
import { useGameEffects } from '../shared/components/effects/useGameEffects';
import { HomeworkBonusCardOverlay } from '../shared/components/HomeworkBonusCardOverlay';
import { TeacherCrestLogo } from '../shared/components/TeacherCrestLogo';
import {
  HomeworkGamificationState,
  ActiveHomeworkSessionState,
  PendingBonusRound,
  BonusCardInstance,
  STREAK_TRIGGER_THRESHOLD,
  createInitialGamificationState,
  toGamificationSnapshot,
  restoreGamificationStateFromSnapshot,
  applyAnswerGamification,
  applyBonusCardSelection,
  tickGamificationTimer,
  formatHudTimer,
  saveActiveHomeworkSession,
  loadActiveHomeworkSession,
  clearActiveHomeworkSession
} from '../shared/homeworkGamification';
import {
  HomeworkAssignment,
  HomeworkAudienceMode,
  HomeworkQuestionResponse,
  HomeworkQuestionType,
  HomeworkFlowMode,
  HomeworkSubmission,
  HomeworkShortLinkResolutionStatus,
  DEFAULT_HOMEWORK_QUESTION_TYPES,
  VERB_HOMEWORK_QUESTION_TYPES,
  GRAMMAR_HOMEWORK_QUESTION_TYPES
} from '../shared/homeworkTypes';
import {
  evaluateNormalizedGrammarAnswer,
  getGrammarLessonExercises,
  normalizeGrammarContent
} from '../shared/grammarEngine';
import type { GrammarExample, GrammarExerciseType, GrammarRule } from '../types/lernstudio';
import { DEFAULT_LERNSTUDIO_SETS } from '../data/defaultLernstudioSets';
import {
  getLocalAssignments,
  getStudentLocalSubmissions,
  saveLocalSubmission,
  getQuestionTypeMeta,
  fetchAssignmentFromFirestore,
  buildDeterministicSubmissionId,
  getOrCreateStudentAttemptSecret,
  isHomeworkAssignmentOpenForStudents,
  saveSubmissionWithConfirmation,
  flushPendingHomeworkCloudWrites,
  resolveAssignmentAudienceMode,
  getAuthorizedGroupStudentsForAssignment,
  normalizeHomeworkAssignment,
  getOrCreateOpenParticipantId,
  validateHomeworkSubmissionIdentity,
  resolveStageQuestionCount,
  calculateTotalHomeworkQuestions,
  parseQuestionTypeCountsParam,
  extractShortIdFromPathname,
  resolveHomeworkShortLink,
  clearFirestoreReadQuotaFlag,
  checkHomeworkAnswerRemotely
} from '../shared/homeworkStorageSync';
import {
  shouldSendProgressCheckpoint,
  sendExitProgressCheckpointKeepalive
} from '../shared/homeworkCheckpointSync';
import {
  splitGermanIntoSyllables,
  splitGermanArticleAndWord
} from '../shared/components/LernstudioTeachModal';
import {
  ALL_VERBS,
  CORE_SIX_SLOT_PROMPTS,
  SUBJECT_PROMPTS,
  PRONOUN_ONLY_SUBJECT_PROMPTS,
  buildTeacherStudySpeechText,
  buildVerbConjugationExercise,
  buildVerbSentenceGapExercise,
  isItemVerb,
  resolveVerbFromLernstudioItem,
  resolveVerbsFromSelection,
  verbEntryToLernstudioItem,
  type VerbSubjectPrompt
} from '../shared/verbEngine';
import type { VerbEntry, VerbPronounSlot } from '../shared/verbLibrary/verbTypes';

interface Props {
  assignmentId?: string;
  shortId?: string;
}

interface HomeworkTileChoice {
  id: string;
  text: string;
}

interface GeneratedQuizQuestion {
  id: string;
  itemId: string;
  type: HomeworkQuestionType;
  stageIndex: number;
  stageLabelAr: string;
  stageBadgeEmoji: string;
  germanWord: string;
  arabicMeaning: string;
  emoji?: string;
  promptTitleAr: string;
  promptMainText: string;
  promptSubText?: string;
  hideGermanText?: boolean;
  options: string[];
  correctAnswer: string;
  // Interactive word/letter/syllable puzzle fields
  article?: string;
  wordOnly?: string;
  chars?: string[];
  missingIndex?: number;
  missingChar?: string;
  missingIndices?: number[];
  expectedChars?: string[];
  expectedSyllables?: string[];
  spaceBeforeIndices?: number[];
  tileChoices?: HomeworkTileChoice[];
  // Unified Verb & Grammar Exercise metadata
  audioPromptText?: string;
  verbId?: string;
  infinitive?: string;
  subject?: string;
  sentence?: string;
  isVerbQuestion?: boolean;
  exerciseId?: string;
  grammarType?: GrammarExerciseType | string;
  acceptedAnswers?: string[];
  explanation?: string;
  hint?: string;
}

const GERMAN_DISTRACTOR_LETTERS = [
  'A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'W', 'Z', 'Ä', 'Ö', 'Ü', 'ß'
];

function stripLeadingArticle(german: string): { article: 'der' | 'die' | 'das' | null; baseWord: string } {
  const trimmed = (german || '').trim();
  const match = trimmed.match(/^(der|die|das)\s+(.+)$/i);
  if (match) {
    return {
      article: match[1].toLowerCase() as 'der' | 'die' | 'das',
      baseWord: match[2].trim()
    };
  }
  return { article: null, baseWord: trimmed };
}

function deterministicShuffle<T>(arr: T[], seedOffset: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs((i * 31 + seedOffset * 17 + 7) % (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Map a permanent cloud rejection (server English error + HTTP status) to a
 * clear Arabic message for the student/parent (Q18). Local validation errors
 * are already Arabic and pass through untouched.
 */
function formatSubmissionRejectionMessage(err: any): string {
  const raw = String(err?.message || '').trim();
  const status = Number(err?.status || 0);
  // Already Arabic (e.g. local validation inside saveSubmissionWithConfirmation).
  if (/[\u0600-\u06FF]/.test(raw)) return raw;
  const lower = raw.toLowerCase();
  if (
    status === 409 ||
    lower.includes('already_completed') ||
    lower.includes('already completed') ||
    lower.includes('cannot be modified') ||
    lower.includes('locked')
  ) {
    return 'تم تسجيل حل سابق لهذا الطالب ولا يمكن تعديله.';
  }
  if (status === 404 || lower.includes('not found')) {
    return 'تعذر العثور على هذا الواجب — قد يكون محذوفاً. اطلب رابطاً جديداً من المعلم.';
  }
  if (status === 403 || status === 401) {
    if (lower.includes('closed') || lower.includes('inactive')) {
      return 'هذا الواجب أُغلق ولم يعد يقبل إجابات جديدة.';
    }
    if (lower.includes('token') || lower.includes('share')) {
      return 'رابط الواجب غير صالح — اطلب رابطاً جديداً من المعلم.';
    }
    if (lower.includes('studentname') || lower.includes('student name')) {
      return 'الاسم لا يطابق اسم الطالب المسجّل لهذه المحاولة.';
    }
    if (lower.includes('attemptsecret')) {
      return 'هذه المحاولة مسجّلة من جهاز آخر ولا يمكن تعديلها من هنا.';
    }
    return 'تم رفض هذا التسليم — تواصل مع المعلم ليتحقق من الواجب.';
  }
  return 'تم رفض هذا التسليم من السحابة — تواصل مع المعلم ليتحقق من الواجب.';
}


export const HomeworkPlayerPage: React.FC<Props> = ({
  assignmentId: propId,
  shortId: propShortId
}) => {
  const rawPathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const extractedShortId = extractShortIdFromPathname();
  const isShortRoute = Boolean(
    propShortId ||
      extractedShortId ||
      /(?:^|\/)Herr-Abdul-rahman(\/|$)/i.test(rawPathname)
  );
  const shortIdFromUrl = (propShortId || extractedShortId || '').trim();
  const routeAssignmentId = isShortRoute
    ? ''
    : propId || rawPathname.replace(/^\/homework\/?/, '').split('/')[0] || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<HomeworkShortLinkResolutionStatus | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [assignment, setAssignment] = useState<HomeworkAssignment | null>(null);
  const assignmentId = assignment?.id || routeAssignmentId;
  const [, setLeaderboard] = useState<any[]>([]);

  // Student Flow State (Never reads or falls back to localStorage dl_students)
  const [studentName, setStudentName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [openParticipantId, setOpenParticipantId] = useState<string>('');
  const [identityError, setIdentityError] = useState<string | null>(null);

  const audienceMode: HomeworkAudienceMode = useMemo(
    () => resolveAssignmentAudienceMode(assignment),
    [assignment]
  );

  // Authorized group students strictly from the assignment's group roster (empty in 'open' mode)
  const displayStudents = useMemo(
    () => getAuthorizedGroupStudentsForAssignment(assignment),
    [assignment]
  );

  const [currentAttemptNumber, setCurrentAttemptNumber] = useState<number>(1);
  const [allSubmissions, setAllSubmissions] = useState<HomeworkSubmission[]>([]);
  const [phase, setPhase] = useState<'lobby' | 'teacher_study' | 'quiz' | 'completed'>('lobby');
  const [studyIndex, setStudyIndex] = useState(0);
  const [completedStudyPhase, setCompletedStudyPhase] = useState(false);

  // Quiz & Multi-Step Interactive Stage State
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<HomeworkQuestionResponse[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'submitted' | null>(null);
  const [gold, setGold] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [questionStartMs, setQuestionStartMs] = useState<number>(Date.now());

  // Multi-step puzzle state (for syllables, missing_two_letters, full_word)
  const [multiStepIdx, setMultiStepIdx] = useState<number>(0);
  const [filledSlots, setFilledSlots] = useState<Record<number, string>>({});
  const [usedTileIds, setUsedTileIds] = useState<string[]>([]);
  const [errorTileId, setErrorTileId] = useState<string | null>(null);
  const [wrongStepsCount, setWrongStepsCount] = useState<number>(0);

  // Multi-step tile progress persisted with the active session so a refresh
  // mid-question cannot reset a partially-built (or failed) tile question.
  // NOTE: ActiveHomeworkSessionState does not declare this field yet; it is
  // stored alongside the session object and read back with a local cast.
  type PersistedTileProgress = {
    questionId: string;
    multiStepIdx: number;
    filledSlots: Record<number, string>;
    usedTileIds: string[];
    wrongStepsCount: number;
  };
  // Q20: time-up confirmation dialog + untimed continuation after time runs out
  const [timeUpDialog, setTimeUpDialog] = useState(false);
  const [untimedMode, setUntimedMode] = useState(false);
  // Q25/Q32: final practice retry round with only the wrong questions.
  // Corrected answers here do NOT count toward score/points.
  const [retryQuestions, setRetryQuestions] = useState<GeneratedQuizQuestion[] | null>(null);
  const [retryRoundDone, setRetryRoundDone] = useState(false);
  // Q21: view my last result from the lobby when attempts are exhausted
  const [showLastResult, setShowLastResult] = useState(false);
  // Grammar interactive state (short_answer / sentence_ordering)
  const [grammarTypedInput, setGrammarTypedInput] = useState<string>('');
  const [grammarOrderedTiles, setGrammarOrderedTiles] = useState<HomeworkTileChoice[]>([]);
  const [checkingRemoteAnswer, setCheckingRemoteAnswer] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<any | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<'idle' | 'syncing' | 'synced' | 'pending_retry' | 'rejected'>('idle');
  const [submissionConflictError, setSubmissionConflictError] = useState<string | null>(null);
  const [retryingCloudSync, setRetryingCloudSync] = useState(false);
  const activeSubmissionIdRef = useRef<string>('sub_' + Math.random().toString(36).substring(2, 9));
  const isSubmittingRef = useRef<boolean>(false);
  const hasSentStartRef = useRef<string>('');
  const lastSyncedAnsweredCountRef = useRef<number>(0);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Gamification & Bonus Card Round State
  const [gamification, setGamification] = useState<HomeworkGamificationState>(() =>
    createInitialGamificationState(10)
  );
  const gamificationRef = useRef<HomeworkGamificationState>(gamification);
  const [activeOverlayRound, setActiveOverlayRound] = useState<PendingBonusRound | null>(null);
  const [soundMutedState, setSoundMutedState] = useState<boolean>(() => isSoundMuted());
  const processedQuestionIdsRef = useRef<Set<string>>(new Set());
  const latestResponsesRef = useRef<HomeworkQuestionResponse[]>([]);
  const pendingPostBonusRef = useRef<{
    nextResponses: HomeworkQuestionResponse[];
  } | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest manual-retry handler + auto-retry attempt counter (Q18): the
  // backoff chain must survive the 'pending_retry' -> 'syncing' ->
  // 'pending_retry' state flips between attempts.
  const handleManualRetryCloudSyncRef = useRef<(() => void) | null>(null);
  const autoRetryAttemptsRef = useRef<number>(0);
  const hasRestoredSessionRef = useRef<string>('');
  // Set by the session-restore effect when it restores in-progress tile state,
  // so the quiz effect below does not wipe it on the re-render that follows.
  const restoredTileProgressRef = useRef<boolean>(false);
  const gameEffects = useGameEffects('de');

  const syncGamificationState = useCallback((nextState: HomeworkGamificationState) => {
    gamificationRef.current = nextState;
    setGamification(nextState);
    setGold(nextState.points);
    setStreak(nextState.streak);
    setMaxStreak(nextState.maxStreak);
  }, []);

  const toggleHudMute = useCallback(() => {
    const nextMuted = !soundMutedState;
    setSoundMutedState(nextMuted);
    setSoundMuted(nextMuted);
  }, [soundMutedState]);

  // Automatically flush any pending homework cloud writes when connectivity resumes
  useEffect(() => {
    const handleOnline = async () => {
      const res = await flushPendingHomeworkCloudWrites();
      if (res.remainingPending === 0 && res.syncedSubmissions > 0) {
        setCloudSyncState('synced');
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Warn before closing the tab while the submission is still unsynced (Q18):
  // without this, closing the tab loses a pending_retry submission that the
  // student already saw celebrated as done.
  useEffect(() => {
    if (cloudSyncState !== 'pending_retry') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [cloudSyncState]);

  // Auto-retry a pending submission with exponential backoff while the page
  // stays open (Q18). Stops after 6 attempts; the manual retry button stays
  // available. The `online` listener above still handles reconnects.
  useEffect(() => {
    if (cloudSyncState === 'synced' || cloudSyncState === 'rejected') {
      autoRetryAttemptsRef.current = 0;
      return;
    }
    if (cloudSyncState !== 'pending_retry') return;
    const delaysMs = [5000, 10000, 20000, 40000, 60000, 60000];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNext = () => {
      if (cancelled) return;
      const idx = autoRetryAttemptsRef.current;
      if (idx >= delaysMs.length) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          scheduleNext();
          return;
        }
        autoRetryAttemptsRef.current += 1;
        handleManualRetryCloudSyncRef.current?.();
        scheduleNext();
      }, delaysMs[idx]);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [cloudSyncState]);

  // Load Assignment (Supports both /Herr-Abdul-rahman/{SHORT_ID} and legacy /homework/{assignmentId})
  useEffect(() => {
    async function loadHomework() {
      try {
        setLoading(true);
        setError(null);
        setResolutionStatus(null);

        if (isShortRoute) {
          const resolved = await resolveHomeworkShortLink(shortIdFromUrl);
          setResolutionStatus(resolved.status);
          if (resolved.status === 'resolved' && resolved.assignment) {
            setAssignment(resolved.assignment);
            return;
          }
          setError(
            resolved.error ||
              'تعذر فتح هذا الواجب. قد يكون الرابط غير صالح أو تم إيقافه من قِبل المعلم.'
          );
          return;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const urlQtc = parseQuestionTypeCountsParam(searchParams.get('qtc'));
        const hasUrlQtc = Object.keys(urlQtc).length > 0;
        const shareToken = (searchParams.get('token') || '').trim();
        const urlOwnerUid = (searchParams.get('ou') || '').trim();

        const infoParams = new URLSearchParams({ id: routeAssignmentId });
        if (shareToken) infoParams.set('token', shareToken);

        const res = await fetchHomeworkApi(`/api/homework/info?${infoParams.toString()}`).catch(() => null);
        let data: any = {};
        if (res) {
          const responseText = await res.text();
          try {
            data = responseText ? JSON.parse(responseText) : {};
          } catch {
            data = {};
          }

          if (res.status === 403 || res.status === 410) {
            setError(data?.error || 'هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
            return;
          }

          if (res.ok && data && data.setSnapshot) {
            if (!isHomeworkAssignmentOpenForStudents(data)) {
              setError('هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
              return;
            }
            const localMatch = getLocalAssignments().find((a) => a.id === routeAssignmentId);
            const resolvedOwner = data.ownerUid || urlOwnerUid || localMatch?.ownerUid || undefined;
            const mergedApi = {
              ...data,
              ...(!data.questionTypeCounts && hasUrlQtc ? { questionTypeCounts: urlQtc } : {}),
              ...(resolvedOwner ? { ownerUid: resolvedOwner } : {})
            };
            const normalized = normalizeHomeworkAssignment(mergedApi);
            setAssignment(normalized);
            if (Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
              setLeaderboard(data.leaderboard);
            }
            return;
          }
        }

        // Fail closed when the authoritative API is unreachable or rejects the assignment
        // so deleted/revoked links can never open from stale local cache or URL fragments.
        if (!res) {
          setError('تعذر الاتصال بخادم الواجبات. اتصل بالإنترنت ثم أعد فتح الرابط.');
          return;
        }
        if (!res.ok) {
          setError(
            res.status === 404
              ? 'هذا الواجب غير موجود على الخادم أو تم حذفه. لا يمكن فتح نسخة قديمة من الرابط.'
              : data?.error || 'تعذر التحقق من حالة الواجب على الخادم. حاول مرة أخرى.'
          );
          return;
        }

        // 2. Check local assignments cache (verifying shareToken if configured on the local record)
        const localFound = getLocalAssignments().find((a) => a.id === routeAssignmentId);
        if (localFound && localFound.setSnapshot) {
          const localToken = (localFound.shareToken || '').trim();
          if (localToken && shareToken !== localToken) {
            setError('رابط الواجب غير صالح أو يتطلب رمز مشاركة صحيح من المعلم.');
            return;
          }
          if (!isHomeworkAssignmentOpenForStudents(localFound)) {
            setError('هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
            return;
          }
          const mergedLocal = {
            ...localFound,
            ...(!localFound.questionTypeCounts && hasUrlQtc ? { questionTypeCounts: urlQtc } : {}),
            ...(!localFound.ownerUid && urlOwnerUid ? { ownerUid: urlOwnerUid } : {})
          };
          setAssignment(normalizeHomeworkAssignment(mergedLocal));
          return;
        }

        // 3. No teacher Firestore reads during student link resolution — resolved via Vercel API, local cache, or URL fallback

        // 4. Fallback: Reconstruct assignment from share URL query parameters + vocabulary set
        const amParam = searchParams.get('am');
        const gidParam = (searchParams.get('gid') || '').trim();
        const gnParam = (searchParams.get('gn') || '').trim();
        const stParam = (searchParams.get('st') || '').trim();
        const isGroupUrl = amParam === 'group' || Boolean(gidParam && gidParam !== 'all');

        const parsedUrlGroupStudents = stParam
          ? stParam
              .split('|')
              .map((entry) => {
                const [rawId, ...nameParts] = entry.split('~');
                const id = (rawId || '').trim();
                const name = nameParts.join('~').trim();
                return id && name ? { id, name, groupId: gidParam } : null;
              })
              .filter((x): x is { id: string; name: string; groupId: string } => Boolean(x))
          : [];

        // CRITICAL: Never construct a group-less open fallback assignment when the link belongs to a specific group!
        if (isGroupUrl && (!gidParam || gidParam === 'all' || parsedUrlGroupStudents.length === 0)) {
          setError(
            'هذا الواجب مخصص لمجموعة محددة، وتعذر تحميل قائمة طلاب المجموعة حالياً. يرجى التحقق من اتصال الإنترنت أو التواصل مع المعلم.'
          );
          return;
        }

        const setId = searchParams.get('s');
        const compactWordsParam = (searchParams.get('w') || '').trim();
        const csParam = (searchParams.get('cs') || '').trim() as any;
        const vidsParam = (searchParams.get('vids') || '').trim();
        const gidsParam = (searchParams.get('gids') || '').trim();
        const igsParam = searchParams.get('igs');
        const vspParam = (searchParams.get('vsp') || '').trim() as any;
        const urlVerbIds = vidsParam ? vidsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
        const urlGrammarExIds = gidsParam ? gidsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
        const resolvedUrlVerbs = urlVerbIds.length > 0 ? resolveVerbsFromSelection({ verbIds: urlVerbIds }) : [];

        if (setId || compactWordsParam || resolvedUrlVerbs.length > 0) {
          const titleParam = searchParams.get('t') || 'واجب منزلي تفاعلي';
          const flowModeParam: HomeworkFlowMode = 'teacher_then_quiz';
          const qtParam = searchParams.get('qt');
          const questionTypesParam = qtParam
            ? (qtParam.split(',') as HomeworkQuestionType[])
            : csParam === 'grammar'
            ? [...GRAMMAR_HOMEWORK_QUESTION_TYPES]
            : csParam === 'verb'
            ? [...VERB_HOMEWORK_QUESTION_TYPES]
            : [...DEFAULT_HOMEWORK_QUESTION_TYPES];
          const idsParam = searchParams.get('ids');
          const selectedIds = idsParam ? idsParam.split(',') : [];

          let foundSet: any = setId ? DEFAULT_LERNSTUDIO_SETS.find((st) => st.id === setId) || null : null;
          if (!foundSet && setId) {
            try {
              const rawSets = localStorage.getItem('dl_lernstudio_sets');
              if (rawSets) {
                const parsedSets = JSON.parse(rawSets);
                if (Array.isArray(parsedSets)) {
                  foundSet = parsedSets.find((st: any) => st && st.id === setId) || null;
                }
              }
            } catch {
              // Ignore local parse errors
            }
          }
          if (!foundSet && compactWordsParam) {
            const parsedItems = compactWordsParam
              .split('|')
              .map((entry, idx) => {
                const [rawId, rawDe, rawAr, rawEmoji] = entry.split('~');
                const id = (rawId || `w_${idx + 1}`).trim();
                const german = (rawDe || '').trim();
                const arabic = (rawAr || '').trim();
                const emoji = (rawEmoji || '📘').trim() || '📘';
                return german && arabic
                  ? { id, german, arabic, emoji }
                  : null;
              })
              .filter(Boolean);
            if (parsedItems.length > 0) {
              foundSet = {
                id: setId || `set_${routeAssignmentId}`,
                title: titleParam,
                category: 'general',
                items: parsedItems
              };
            }
          }
          if (!foundSet && resolvedUrlVerbs.length > 0) {
            foundSet = {
              id: setId || 'verb_library_custom',
              title: titleParam,
              category: 'Verben',
              setKind: 'verb_group',
              verbIds: resolvedUrlVerbs.map((v) => v.id),
              items: resolvedUrlVerbs.map((v) => verbEntryToLernstudioItem(v))
            };
          }

          const foundGrammarEx = foundSet ? getGrammarLessonExercises(foundSet) : [];
          if (
            foundSet &&
            ((Array.isArray(foundSet.items) && foundSet.items.length > 0) || foundGrammarEx.length > 0)
          ) {
            const rawSetItems = Array.isArray(foundSet.items) ? foundSet.items : [];
            const items = selectedIds.length > 0
              ? rawSetItems.filter((it: any) => selectedIds.includes(it.id))
              : rawSetItems;
            const resolvedFallbackItems = items.length > 0 ? items : rawSetItems;
            const fallbackVerbItems = resolvedUrlVerbs.length > 0 ? resolvedUrlVerbs : [];
            const fallbackVocabCount =
              csParam === 'verb' || csParam === 'grammar'
                ? 0
                : resolvedFallbackItems.filter((it: any) => !isItemVerb(it)).length ||
                  resolvedFallbackItems.length;
            const activeFallbackGrammarCount =
              urlGrammarExIds.length > 0
                ? foundGrammarEx.filter((ex) => urlGrammarExIds.includes(ex.id)).length || foundGrammarEx.length
                : foundGrammarEx.length;
            const resolvedTotalQ = calculateTotalHomeworkQuestions(
              fallbackVocabCount,
              questionTypesParam,
              hasUrlQtc ? urlQtc : undefined,
              fallbackVerbItems.length,
              activeFallbackGrammarCount
            );

            const fallbackHw: HomeworkAssignment = {
              id: routeAssignmentId,
              title: titleParam,
              ...(shareToken ? { shareToken } : {}),
              ...(urlOwnerUid ? { ownerUid: urlOwnerUid } : {}),
              ...(csParam ? { contentSource: csParam } : {}),
              ...(urlVerbIds.length > 0 ? { selectedVerbIds: urlVerbIds } : {}),
              ...(urlGrammarExIds.length > 0 ? { selectedGrammarExerciseIds: urlGrammarExIds } : {}),
              ...(igsParam === '0' ? { includeGrammarStudy: false } : {}),
              ...(resolvedUrlVerbs.length > 0 ? { verbSnapshot: resolvedUrlVerbs } : {}),
              ...(vspParam ? { verbSubjectPoolMode: vspParam } : {}),
              audienceMode: isGroupUrl ? 'group' : 'open',
              ...(isGroupUrl
                ? {
                    groupId: gidParam,
                    groupName: gnParam || undefined,
                    assignedStudents: parsedUrlGroupStudents
                  }
                : {}),
              setSnapshot: {
                id: foundSet.id,
                title: foundSet.title,
                category: (foundSet as any).category || foundSet.topic || '',
                ...(foundSet.setKind ? { setKind: foundSet.setKind } : {}),
                ...(foundSet.grammarContent ? { grammarContent: foundSet.grammarContent } : {}),
                items: resolvedFallbackItems
              },
              selectedItemIds: selectedIds,
              flowMode: flowModeParam,
              questionTypes: questionTypesParam,
              ...(hasUrlQtc ? { questionTypeCounts: urlQtc } : {}),
              blooketMode: 'classic_quiz',
              allowedGameModes: ['classic_quiz'],
              questionCount: resolvedTotalQ,
              targetQuestionCount: resolvedTotalQ,
              maxAttempts: 3,
              allowReplay: true,
              isActive: true,
              status: 'active',
              createdAt: new Date().toISOString(),
              createdBy: 'Teacher'
            };
            setAssignment(normalizeHomeworkAssignment(fallbackHw));
            return;
          }
        }

        setError('Diese Hausaufgabe ist nicht mehr verfügbar. — تعذر العثور على الواجب أو تم حذفه من قبل المعلم.');
      } catch (err: any) {
        setError(err.message || 'خطأ في الاتصال');
      } finally {
        setLoading(false);
      }
    }
    loadHomework();
  }, [routeAssignmentId, isShortRoute, shortIdFromUrl, reloadNonce]);

  // Resolve immutable verb records captured on assignment first (falls back to shared Verb Library)
  const assignmentVerbs = useMemo<VerbEntry[]>(() => {
    if (Array.isArray(assignment?.verbSnapshot) && assignment.verbSnapshot.length > 0) {
      if (Array.isArray(assignment.selectedVerbIds) && assignment.selectedVerbIds.length > 0) {
        const snapById = new Map(assignment.verbSnapshot.map((v) => [v.id, v]));
        const ordered = assignment.selectedVerbIds
          .map((vid) => snapById.get(vid))
          .filter((v): v is VerbEntry => Boolean(v));
        if (ordered.length > 0) return ordered;
      }
      return assignment.verbSnapshot;
    }
    if (Array.isArray(assignment?.selectedVerbIds) && assignment.selectedVerbIds.length > 0) {
      const fromIds = resolveVerbsFromSelection({ verbIds: assignment.selectedVerbIds });
      if (fromIds.length > 0) return fromIds;
    }
    const items: any[] = assignment?.setSnapshot?.items || [];
    const seen = new Set<string>();
    const fromItems: VerbEntry[] = [];
    for (const it of items) {
      if (!isItemVerb(it)) continue;
      const v = resolveVerbFromLernstudioItem(it);
      if (v && !seen.has(v.id)) {
        seen.add(v.id);
        fromItems.push(v);
      }
    }
    return fromItems;
  }, [assignment]);

  // Active vocabulary + verb study items selected by the teacher
  const studyItems = useMemo(() => {
    const rawItems: any[] = assignment?.setSnapshot?.items || [];
    const filtered =
      Array.isArray(assignment?.selectedItemIds) && assignment.selectedItemIds.length > 0
        ? rawItems.filter((it) => assignment.selectedItemIds!.includes(it.id))
        : rawItems;
    if (filtered.length > 0) return filtered;
    if (assignmentVerbs.length > 0) {
      return assignmentVerbs.map((v) => verbEntryToLernstudioItem(v));
    }
    return [];
  }, [assignment, assignmentVerbs]);

  const assignmentGrammarContent = useMemo(
    () =>
      assignment?.setSnapshot?.grammarContent
        ? normalizeGrammarContent(
            assignment.setSnapshot.grammarContent,
            assignment.setSnapshot.title,
            assignment.setSnapshot.topic,
            'teacher_created',
            { allowAnswerless: true }
          )
        : null,
    [assignment?.setSnapshot?.grammarContent, assignment?.setSnapshot?.title, assignment?.setSnapshot?.topic]
  );

  const assignmentGrammarExercises = useMemo(() => {
    if (!assignment?.setSnapshot) return [];
    const allEx = getGrammarLessonExercises(assignment.setSnapshot, { allowAnswerless: true });
    if (
      Array.isArray(assignment?.selectedGrammarExerciseIds) &&
      assignment.selectedGrammarExerciseIds.length > 0
    ) {
      const allow = new Set(assignment.selectedGrammarExerciseIds);
      const filtered = allEx.filter((ex) => allow.has(ex.id));
      if (filtered.length > 0) return filtered;
    }
    return allEx;
  }, [assignment?.setSnapshot, assignment?.selectedGrammarExerciseIds]);

  const grammarStudyCards = useMemo<
    Array<
      | {
          kind: 'overview';
          id: string;
          title: string;
          summaryAr: string;
          summaryDe: string;
          explanationAr: string;
          explanationDe: string;
          examples: GrammarExample[];
        }
      | { kind: 'rule'; id: string; rule: GrammarRule }
    >
  >(() => {
    if (!assignmentGrammarContent) return [];
    if (assignment?.includeGrammarStudy === false) return [];
    const cards: any[] = [];
    if (
      assignmentGrammarContent.explanationAr ||
      assignmentGrammarContent.explanationDe ||
      assignmentGrammarContent.explanationEn ||
      assignmentGrammarContent.examples.length > 0
    ) {
      cards.push({
        kind: 'overview',
        id: 'gram_overview',
        title: assignmentGrammarContent.lessonTitleAr || assignment?.setSnapshot?.title || 'شرح القاعدة',
        summaryAr: assignmentGrammarContent.explanationAr || '',
        summaryDe: assignmentGrammarContent.explanationDe || '',
        explanationAr: assignmentGrammarContent.explanationAr || '',
        explanationDe: assignmentGrammarContent.explanationDe || '',
        examples: assignmentGrammarContent.examples || []
      });
    }
    for (const rule of assignmentGrammarContent.rules || []) {
      cards.push({ kind: 'rule', id: rule.id || `rule_${cards.length}`, rule });
    }
    return cards;
  }, [assignmentGrammarContent, assignment?.includeGrammarStudy, assignment?.setSnapshot?.title]);

  const totalStudySteps = grammarStudyCards.length + studyItems.length;

  // Active question types ordered as stored on the assignment (or all stages by default)
  const activeQuestionTypes = useMemo<HomeworkQuestionType[]>(() => {
    if (Array.isArray(assignment?.questionTypes) && assignment.questionTypes.length > 0) {
      return assignment.questionTypes;
    }
    if (assignment?.contentSource === 'grammar') {
      return [...GRAMMAR_HOMEWORK_QUESTION_TYPES];
    }
    if (assignment?.contentSource === 'verb') {
      return [...VERB_HOMEWORK_QUESTION_TYPES];
    }
    return [...DEFAULT_HOMEWORK_QUESTION_TYPES];
  }, [assignment?.questionTypes, assignment?.contentSource]);

  // Build progressive multi-stage question list based on teacher's chosen questionTypes
  const quizQuestions = useMemo<GeneratedQuizQuestion[]>(() => {
    if (
      studyItems.length === 0 &&
      assignmentVerbs.length === 0 &&
      assignmentGrammarExercises.length === 0
    ) {
      return [];
    }
    const allSetItems: any[] = assignment?.setSnapshot?.items || studyItems;
    const contentSource = assignment?.contentSource;
    const pureVocabStudyItems =
      contentSource === 'mixed'
        ? studyItems.filter((it) => !isItemVerb(it))
        : studyItems;
    const vocabPoolForStages =
      pureVocabStudyItems.length > 0
        ? pureVocabStudyItems
        : studyItems;
    const vocabPoolForDistractors =
      contentSource === 'mixed'
        ? allSetItems.filter((it) => !isItemVerb(it))
        : allSetItems;
    const types = activeQuestionTypes;

    const list: GeneratedQuizQuestion[] = [];

    types.forEach((qType, stageIdx) => {
      const meta = getQuestionTypeMeta(qType);
      const stageTitle = `المرحلة ${stageIdx + 1}: ${meta?.labelAr || 'سؤال تفاعلي'}`;
      const stageEmoji = meta?.badgeEmoji || '🎯';

      // Unified Verb Stages: verb_conjugation (6 slots per verb) & verb_sentence
      if (qType === 'verb_conjugation') {
        if (assignmentVerbs.length === 0) return;
        const stageQuestionCount = resolveStageQuestionCount(
          qType,
          vocabPoolForStages.length,
          assignment?.questionTypeCounts,
          assignmentVerbs.length
        );
        const poolMode = assignment?.verbSubjectPoolMode || 'pronouns_and_names';
        const allowedPrompts =
          poolMode === 'pronouns_only' ? PRONOUN_ONLY_SUBJECT_PROMPTS : SUBJECT_PROMPTS;
        const promptsBySlot = new Map<VerbPronounSlot, VerbSubjectPrompt[]>();
        for (const p of allowedPrompts) {
          const arr = promptsBySlot.get(p.slot) || [];
          arr.push(p);
          promptsBySlot.set(p.slot, arr);
        }

        const candidatePairs: Array<{ verb: VerbEntry; subjectPrompt: VerbSubjectPrompt }> = [];
        assignmentVerbs.forEach((verb, vIdx) => {
          CORE_SIX_SLOT_PROMPTS.forEach((corePrompt, sIdx) => {
            const slotVariants = promptsBySlot.get(corePrompt.slot) || [corePrompt];
            // Pick deterministically across pronouns/names while ensuring each verb exercises all 6 slots
            const chosenPrompt = slotVariants[(vIdx + sIdx) % slotVariants.length] || corePrompt;
            candidatePairs.push({ verb, subjectPrompt: chosenPrompt });
          });
        });

        const selectedPairs =
          stageQuestionCount >= candidatePairs.length
            ? candidatePairs
            : Array.from({ length: stageQuestionCount }, (_, k) => {
                // Distribute reduced counts across verbs evenly
                const stepIdx = Math.floor((k * candidatePairs.length) / Math.max(1, stageQuestionCount));
                return candidatePairs[stepIdx] || candidatePairs[k % candidatePairs.length];
              });

        selectedPairs.forEach(({ verb, subjectPrompt }, pairIdx) => {
          const ex = buildVerbConjugationExercise(verb, subjectPrompt, 4);
          list.push({
            id: `vconj_${verb.id}_${subjectPrompt.id}_${stageIdx}_${pairIdx}`,
            itemId: verb.id,
            type: 'verb_conjugation',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: `${subjectPrompt.labelDe} ${ex.correctAnswer}`,
            audioPromptText: verb.infinitive,
            arabicMeaning: verb.arabic,
            emoji: '🔤',
            promptTitleAr: ex.promptAr,
            promptMainText: ex.promptDe,
            promptSubText: `${subjectPrompt.displayLabel} · ${verb.arabic}`,
            options: ex.options,
            correctAnswer: ex.correctAnswer,
            verbId: verb.id,
            infinitive: verb.infinitive,
            subject: subjectPrompt.displayLabel,
            isVerbQuestion: true
          });
        });
        return;
      }

      if (qType === 'verb_sentence') {
        if (assignmentVerbs.length === 0) return;
        const stageQuestionCount = resolveStageQuestionCount(
          qType,
          vocabPoolForStages.length,
          assignment?.questionTypeCounts,
          assignmentVerbs.length
        );
        const stageVerbs =
          stageQuestionCount >= assignmentVerbs.length
            ? assignmentVerbs
            : Array.from({ length: stageQuestionCount }, (_, k) => {
                const rotatedIdx = (stageIdx * stageQuestionCount + k) % assignmentVerbs.length;
                return assignmentVerbs[rotatedIdx];
              });

        stageVerbs.forEach((verb, vIdx) => {
          const ex = buildVerbSentenceGapExercise(
            verb,
            assignmentVerbs.length >= 4 ? assignmentVerbs : undefined
          );
          list.push({
            id: `vsent_${verb.id}_${stageIdx}_${vIdx}`,
            itemId: verb.id,
            type: 'verb_sentence',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: ex.sentenceOriginal,
            audioPromptText: verb.infinitive,
            arabicMeaning: verb.arabic,
            emoji: '📝',
            promptTitleAr: `اختر التصريف الصحيح لإكمال الجملة (${verb.infinitive} — ${verb.arabic}):`,
            promptMainText: ex.sentenceWithBlank,
            promptSubText: ex.sentenceArabic || verb.arabic,
            options: ex.options,
            correctAnswer: ex.correctAnswer,
            verbId: verb.id,
            infinitive: verb.infinitive,
            sentence: ex.sentenceOriginal,
            isVerbQuestion: true
          });
        });
        return;
      }

      if (qType === 'grammar_exercise') {
        if (assignmentGrammarExercises.length === 0) return;
        const stageQuestionCount = resolveStageQuestionCount(
          qType,
          vocabPoolForStages.length,
          assignment?.questionTypeCounts,
          assignmentVerbs.length,
          assignmentGrammarExercises.length
        );
        const selectedGramEx =
          stageQuestionCount >= assignmentGrammarExercises.length
            ? assignmentGrammarExercises
            : assignmentGrammarExercises.slice(0, stageQuestionCount);

        selectedGramEx.forEach((ex, exIdx) => {
          const seed = stageIdx * 89 + exIdx * 23 + (ex.question?.length || 7);
          const hasExplicitTokens = Array.isArray(ex.tokens) && ex.tokens.length > 0;
          const baseTokens =
            ex.type === 'sentence_ordering'
              ? hasExplicitTokens
                ? ex.tokens!
                : ex.correctAnswer
                ? ex.correctAnswer.trim().split(/\s+/).filter(Boolean)
                : []
              : [];
          const tileChoices: HomeworkTileChoice[] | undefined =
            ex.type === 'sentence_ordering' && baseTokens.length > 0
              ? hasExplicitTokens && !ex.correctAnswer
                ? baseTokens.map((tok, tIdx) => ({
                    id: `gram_tok_${ex.id}_${tIdx}`,
                    text: tok
                  }))
                : deterministicShuffle(
                    baseTokens.map((tok, tIdx) => ({
                      id: `gram_tok_${ex.id}_${tIdx}`,
                      text: tok
                    })),
                    seed
                  )
              : undefined;

          let finalOptions: string[] = [];
          if (ex.type !== 'sentence_ordering' && ex.type !== 'short_answer') {
            const rawOpts = Array.isArray(ex.options) ? ex.options.filter(Boolean) : [];
            const deduped = Array.from(new Set(rawOpts));
            if (ex.correctAnswer && !deduped.some((o) => evaluateNormalizedGrammarAnswer(o, ex))) {
              deduped.unshift(ex.correctAnswer);
            }
            finalOptions = deduped.length > 1 ? deterministicShuffle(deduped, seed) : deduped;
          }

          const promptTitle =
            ex.prompt ||
            (ex.type === 'fill_blank'
              ? 'أكمل الفراغ بالإجابة الصحيحة:'
              : ex.type === 'correct_mistake'
              ? 'صحّح الخطأ في الجملة التالية:'
              : ex.type === 'choose_correct_sentence'
              ? 'اختر الجملة الألمانية الصحيحة نحوياً:'
              : ex.type === 'sentence_ordering'
              ? 'رتب الكلمات التالية لتكوين جملة ألمانية صحيحة:'
              : ex.type === 'short_answer'
              ? 'اكتب الإجابة الصحيحة بالألمانية:'
              : 'اختر الإجابة الصحيحة:');

          const mainSentenceOrQuestion =
            ex.sentenceWithBlank || ex.faultySentence || ex.question || ex.prompt || '';

          list.push({
            id: `gram_${ex.id}_${stageIdx}_${exIdx}`,
            itemId: ex.id,
            exerciseId: ex.id,
            grammarType: ex.type,
            type: 'grammar_exercise',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: mainSentenceOrQuestion,
            audioPromptText: ex.sentenceWithBlank || ex.faultySentence || ex.question || '',
            arabicMeaning: ex.explanationAr || ex.prompt || '',
            emoji: '📘',
            promptTitleAr: promptTitle,
            promptMainText: mainSentenceOrQuestion,
            promptSubText:
              ex.question && mainSentenceOrQuestion !== ex.question
                ? ex.question
                : ex.uncertaintyReason || undefined,
            options: finalOptions,
            correctAnswer: ex.correctAnswer || '',
            acceptedAnswers: ex.acceptedAnswers,
            explanation: ex.explanationAr || ex.explanationDe || ex.explanation,
            hint: ex.uncertaintyReason,
            ...(tileChoices ? { tileChoices } : {})
          });
        });
        return;
      }

      if (vocabPoolForStages.length === 0) return;

      const stageQuestionCount = resolveStageQuestionCount(
        qType,
        vocabPoolForStages.length,
        assignment?.questionTypeCounts
      );

      // Select `stageQuestionCount` items deterministically, rotating start offset by stageIdx
      // so reduced question counts still test all vocabulary words evenly across stages.
      const stageItems =
        stageQuestionCount >= vocabPoolForStages.length
          ? vocabPoolForStages
          : Array.from({ length: stageQuestionCount }, (_, k) => {
              const rotatedIdx = (stageIdx * stageQuestionCount + k) % vocabPoolForStages.length;
              return vocabPoolForStages[rotatedIdx];
            });

      stageItems.forEach((item, itemIdx) => {
        const qId = `${item.id}_${qType}_${itemIdx}`;
        const isVerbStageItem = isItemVerb(item) || contentSource === 'verb';
        const rawOtherItems = (vocabPoolForDistractors.length > 1 ? vocabPoolForDistractors : allSetItems).filter(
          (x) => x.id !== item.id && x.german !== item.german
        );
        const seed = stageIdx * 97 + itemIdx * 31 + (item.german?.length || 5);
        const otherItems =
          isVerbStageItem && rawOtherItems.length < 4
            ? [
                ...rawOtherItems,
                ...ALL_VERBS.slice(0, 60)
                  .filter(
                    (v) =>
                      v.infinitive !== item.german &&
                      !rawOtherItems.some((o) => o.german === v.infinitive)
                  )
                  .slice(0, 6)
                  .map((v) => ({ id: v.id, german: v.infinitive, arabic: v.arabic }))
              ]
            : rawOtherItems;

        // 1. Stage: true_false (صح أم خطأ — Richtig / Falsch)
        if (qType === 'true_false') {
          const isTrue = (itemIdx + stageIdx) % 2 === 0 || otherItems.length === 0;
          const distinctMeaningOthers = otherItems.filter((o) => o.arabic !== item.arabic);
          const distractorPool = distinctMeaningOthers.length > 0 ? distinctMeaningOthers : otherItems;
          const wrongItem = distractorPool[(itemIdx + 1) % Math.max(1, distractorPool.length)];
          const fallbackWrongGerman = isVerbStageItem
            ? item.german === 'gehen'
              ? 'machen'
              : 'gehen'
            : item.german === 'die Schule'
            ? 'das Buch'
            : 'die Schule';
          const shownGerman = isTrue
            ? item.german
            : wrongItem?.german || fallbackWrongGerman;
          const correctLabel = isTrue ? 'صح ✅ (Richtig)' : 'خطأ ❌ (Falsch)';

          list.push({
            id: qId,
            itemId: item.id,
            type: 'true_false',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: isVerbStageItem
              ? 'هل ترجمة هذا الفعل الألماني صحيحة أم خطأ؟'
              : 'هل الترجمة الألمانية صحيحة أم خطأ؟',
            promptMainText: item.arabic,
            promptSubText: shownGerman,
            options: ['صح ✅ (Richtig)', 'خطأ ❌ (Falsch)'],
            correctAnswer: correctLabel
          });
          return;
        }

        // 2. Stage: choice_2 (الاختيار من 2 — Zwei Optionen)
        if (qType === 'choice_2') {
          const correctOpt = item.german;
          const distractorItem = otherItems[(itemIdx + stageIdx) % Math.max(1, otherItems.length)];
          const fallbackDistractor = isVerbStageItem
            ? correctOpt === 'machen'
              ? 'gehen'
              : 'machen'
            : correctOpt === 'das Buch'
            ? 'die Schule'
            : 'das Buch';
          const distractorOpt =
            distractorItem && distractorItem.german !== correctOpt
              ? distractorItem.german
              : fallbackDistractor;
          const options = deterministicShuffle([correctOpt, distractorOpt], seed);

          list.push({
            id: qId,
            itemId: item.id,
            type: 'choice_2',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: isVerbStageItem
              ? 'اختر الفعل الألماني الصحيح من الاختيارين:'
              : 'اختر الكلمة الألمانية الصحيحة من الاختيارين:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options,
            correctAnswer: correctOpt
          });
          return;
        }

        // 3. Stage: choice_all (الاختيار من الكل — Alle Wörter)
        if (qType === 'choice_all') {
          const correctOpt = item.german;
          const uniqueGermanWords: string[] = [];
          for (const stItem of allSetItems) {
            if (stItem?.german && !uniqueGermanWords.includes(stItem.german)) {
              uniqueGermanWords.push(stItem.german);
            }
          }
          if (!uniqueGermanWords.includes(correctOpt)) {
            uniqueGermanWords.unshift(correctOpt);
          }
          const fallbacks = isVerbStageItem
            ? ['machen', 'gehen', 'kommen', 'lernen']
            : ['das Buch', 'der Apfel', 'die Schule', 'das Haus'];
          for (const fb of fallbacks) {
            if (uniqueGermanWords.length < 3 && !uniqueGermanWords.includes(fb)) {
              uniqueGermanWords.push(fb);
            }
          }
          const options = deterministicShuffle(uniqueGermanWords, seed);

          list.push({
            id: qId,
            itemId: item.id,
            type: 'choice_all',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: isVerbStageItem
              ? 'اختر الفعل الألماني الصحيح من بين جميع أفعال الدرس:'
              : 'اختر الكلمة الألمانية الصحيحة من بين جميع كلمات الدرس:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options,
            correctAnswer: correctOpt
          });
          return;
        }

        // 4. Stage: syllables (النصين والمقاطع — Silben zusammensetzen)
        if (qType === 'syllables') {
          const { article, wordOnly } = splitGermanArticleAndWord(item.german);
          const expectedSyllables =
            item.syllables && Array.isArray(item.syllables) && item.syllables.length >= 2
              ? item.syllables
              : /\s+/.test(wordOnly.trim())
              ? wordOnly
                  .trim()
                  .split(/\s+/)
                  .flatMap((token) =>
                    token.length <= 4 ? [token] : splitGermanIntoSyllables(token)
                  )
              : splitGermanIntoSyllables(wordOnly);

          const tileChoices: HomeworkTileChoice[] = deterministicShuffle(
            expectedSyllables.map((syl: string, idx: number) => ({
              id: `syl_${qId}_${idx}`,
              text: syl
            })),
            seed
          );

          list.push({
            id: qId,
            itemId: item.id,
            type: 'syllables',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: 'اختر نصفي الكلمة أو مقاطعها الصوتية بالترتيب الصحيح:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options: expectedSyllables,
            correctAnswer: item.german,
            article,
            wordOnly,
            expectedSyllables,
            tileChoices
          });
          return;
        }

        // 5. Stage: missing_letter (الحرف الناقص — Fehlender Buchstabe)
        if (qType === 'missing_letter') {
          const { article, wordOnly } = splitGermanArticleAndWord(item.german);
          const chars = wordOnly.split('');
          const validIndices: number[] = [];
          for (let i = 0; i < chars.length; i++) {
            if (/[a-zA-ZäöüÄÖÜß]/.test(chars[i])) {
              validIndices.push(i);
            }
          }
          const missingIndex =
            validIndices.length > 0
              ? validIndices[(itemIdx + stageIdx) % validIndices.length]
              : 0;
          const missingChar = wordOnly[missingIndex] || 'A';
          const correctUpper = missingChar.toUpperCase();
          const distractorPool = GERMAN_DISTRACTOR_LETTERS.filter((c) => c !== correctUpper);
          const distractors = deterministicShuffle(distractorPool, seed).slice(0, 4);
          const options = deterministicShuffle([correctUpper, ...distractors], seed + 3);

          list.push({
            id: qId,
            itemId: item.id,
            type: 'missing_letter',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: isVerbStageItem
              ? 'اختر الحرف الناقص لإكمال الفعل الألماني:'
              : 'اختر الحرف الناقص لإكمال الكلمة الألمانية:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options,
            correctAnswer: correctUpper,
            article,
            wordOnly,
            chars,
            missingIndex,
            missingChar: correctUpper
          });
          return;
        }

        // 6. Stage: missing_two_letters (الحرفين المتتاليين — Buchstabenfolge)
        if (qType === 'missing_two_letters') {
          const { article, wordOnly } = splitGermanArticleAndWord(item.german);
          const chars = wordOnly.split('');
          const len = chars.length;
          const seqLen = len >= 6 ? 3 : len <= 2 ? Math.max(1, len) : 2;
          const maxStart = Math.max(0, len - seqLen);
          const validStarts: number[] = [];
          for (let s = 0; s <= maxStart; s++) {
            let hasSpace = false;
            for (let k = 0; k < seqLen; k++) {
              if (!chars[s + k] || /\s/.test(chars[s + k])) {
                hasSpace = true;
                break;
              }
            }
            if (!hasSpace) validStarts.push(s);
          }
          const startIdx =
            validStarts.length > 0
              ? validStarts[(itemIdx + stageIdx) % validStarts.length]
              : maxStart > 0
              ? (itemIdx + stageIdx) % (maxStart + 1)
              : 0;

          const missingIndices: number[] = [];
          for (let i = 0; i < seqLen; i++) {
            if (startIdx + i < len && !/\s/.test(chars[startIdx + i])) {
              missingIndices.push(startIdx + i);
            }
          }
          const expectedChars = missingIndices.map((idx) => chars[idx]);
          const expectedChoices: HomeworkTileChoice[] = expectedChars.map((ch, idx) => ({
            id: `seq_exp_${qId}_${idx}`,
            text: ch.toUpperCase()
          }));
          const expSet = new Set(expectedChars.map((c) => c.toUpperCase()));
          const distractorPool = GERMAN_DISTRACTOR_LETTERS.filter((c) => !expSet.has(c));
          const distractorChoices: HomeworkTileChoice[] = deterministicShuffle(distractorPool, seed)
            .slice(0, 3)
            .map((ch, idx) => ({
              id: `seq_dist_${qId}_${idx}`,
              text: ch
            }));

          const tileChoices = deterministicShuffle([...expectedChoices, ...distractorChoices], seed + 5);

          list.push({
            id: qId,
            itemId: item.id,
            type: 'missing_two_letters',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: 'اختر الحروف المتتالية الناقصة بالترتيب الصحيح:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options: expectedChars,
            correctAnswer: item.german,
            article,
            wordOnly,
            chars,
            missingIndices,
            expectedChars,
            tileChoices
          });
          return;
        }

        // 7. Stage: full_word (الكلمة كلها — Wort vervollständigen)
        if (qType === 'full_word') {
          const { article, wordOnly } = splitGermanArticleAndWord(item.german);
          const rawChars = wordOnly.split('');
          const chars: string[] = [];
          const spaceBeforeIndices: number[] = [];
          let pendingSpace = false;
          for (const ch of rawChars) {
            if (/\s/.test(ch)) {
              if (chars.length > 0) pendingSpace = true;
            } else {
              if (pendingSpace) {
                spaceBeforeIndices.push(chars.length);
                pendingSpace = false;
              }
              chars.push(ch);
            }
          }
          const tileChoices: HomeworkTileChoice[] = deterministicShuffle(
            chars.map((ch, idx) => ({
              id: `fw_${qId}_${idx}`,
              text: ch.toUpperCase()
            })),
            seed + 11
          );

          list.push({
            id: qId,
            itemId: item.id,
            type: 'full_word',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: isVerbStageItem
              ? 'رتب حروف الفعل الألماني من البداية للنهاية:'
              : 'رتب حروف الكلمة الألمانية من البداية للنهاية:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options: chars,
            correctAnswer: item.german,
            article,
            wordOnly,
            chars,
            expectedChars: chars,
            spaceBeforeIndices,
            tileChoices
          });
          return;
        }

        // Legacy: listen_choose
        if (qType === 'listen_choose') {
          const correctOpt = `${item.german} — (${item.arabic})`;
          const distractors = deterministicShuffle(otherItems, seed)
            .slice(0, 3)
            .map((d) => `${d.german} — (${d.arabic})`);
          const fallbacks = [
            'das Buch — (الكتاب)',
            'der Apfel — (التفاحة)',
            'die Schule — (المدرسة)',
            'das Haus — (المنزل)'
          ];
          let f = 0;
          while (distractors.length < 3 && f < fallbacks.length) {
            if (fallbacks[f] !== correctOpt && !distractors.includes(fallbacks[f])) {
              distractors.push(fallbacks[f]);
            }
            f++;
          }

          list.push({
            id: qId,
            itemId: item.id,
            type: 'listen_choose',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji || '🔊',
            promptTitleAr: 'استمع جيداً لنطق الكلمة الألمانية واختر الإجابة الصحيحة:',
            promptMainText: '🔊 اضغط للاستماع للكلمة',
            hideGermanText: true,
            options: deterministicShuffle([correctOpt, ...distractors], seed),
            correctAnswer: correctOpt
          });
          return;
        }

        // Legacy: mc_ar_de
        if (qType === 'mc_ar_de') {
          const correctOpt = item.german;
          const distractors = deterministicShuffle(
            otherItems.filter((d) => d.german !== correctOpt),
            seed
          )
            .slice(0, 3)
            .map((d) => d.german);
          const fallbacks = ['das Buch', 'der Apfel', 'die Schule', 'das Haus', 'die Katze'];
          let f = 0;
          while (distractors.length < 3 && f < fallbacks.length) {
            if (fallbacks[f] !== correctOpt && !distractors.includes(fallbacks[f])) {
              distractors.push(fallbacks[f]);
            }
            f++;
          }

          list.push({
            id: qId,
            itemId: item.id,
            type: 'mc_ar_de',
            stageIndex: stageIdx,
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: 'اختر الكلمة الألمانية الصحيحة لهذا المعنى:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options: deterministicShuffle([correctOpt, ...distractors], seed),
            correctAnswer: correctOpt
          });
          return;
        }

        // Legacy: article_quiz
        if (qType === 'article_quiz') {
          const parsed = stripLeadingArticle(item.german);
          const actualArticle = item.article || parsed.article;
          if (actualArticle) {
            list.push({
              id: qId,
              itemId: item.id,
              type: 'article_quiz',
              stageIndex: stageIdx,
              stageLabelAr: stageTitle,
              stageBadgeEmoji: stageEmoji,
              germanWord: item.german,
              arabicMeaning: item.arabic,
              emoji: item.emoji,
              promptTitleAr: 'اختر أداة التعريف (Artikel) الصحيحة لهذه الكلمة:',
              promptMainText: `___ ${parsed.baseWord}`,
              promptSubText: item.arabic,
              options: ['der', 'die', 'das'],
              correctAnswer: actualArticle
            });
            return;
          }
        }

        // Legacy fallback: mc_de_ar (German -> Arabic)
        const correctOpt = item.arabic;
        const distractors = deterministicShuffle(
          otherItems.filter((d) => d.arabic !== correctOpt),
          seed
        )
          .slice(0, 3)
          .map((d) => d.arabic);
        const fallbacks = ['الكتاب', 'التفاحة', 'المدرسة', 'المنزل', 'القطة'];
        let f = 0;
        while (distractors.length < 3 && f < fallbacks.length) {
          if (fallbacks[f] !== correctOpt && !distractors.includes(fallbacks[f])) {
            distractors.push(fallbacks[f]);
          }
          f++;
        }

        list.push({
          id: qId,
          itemId: item.id,
          type: 'mc_de_ar',
          stageIndex: stageIdx,
          stageLabelAr: stageTitle,
          stageBadgeEmoji: stageEmoji,
          germanWord: item.german,
          arabicMeaning: item.arabic,
          emoji: item.emoji,
          promptTitleAr: 'ما معنى هذه الكلمة الألمانية بالعربية؟',
          promptMainText: item.german,
          options: deterministicShuffle([correctOpt, ...distractors], seed),
          correctAnswer: correctOpt
        });
      });
    });

    return list;
  }, [studyItems, assignment, assignmentVerbs, assignmentGrammarExercises, activeQuestionTypes]);

  // Q25 retry round: when active, the quiz runs over the wrong questions only.
  // Everything else (totals, restore, replay) keeps using the full quizQuestions.
  const activeQuizQuestions = retryQuestions ?? quizQuestions;
  const currentQuestion = activeQuizQuestions[currentIdx];
  const currentGrammarStudyCard =
    studyIndex < grammarStudyCards.length ? grammarStudyCards[studyIndex] : null;
  const currentStudyItem =
    studyIndex >= grammarStudyCards.length
      ? studyItems[studyIndex - grammarStudyCards.length]
      : undefined;
  const currentStudyVerb = useMemo(() => {
    if (!currentStudyItem) return null;
    const snapshotMatch = assignmentVerbs.find(
      (v) => v.id === (currentStudyItem.verbId || currentStudyItem.id)
    );
    return snapshotMatch || resolveVerbFromLernstudioItem(currentStudyItem);
  }, [currentStudyItem, assignmentVerbs]);
  const currentStudySpeechText = useMemo(() => {
    if (currentGrammarStudyCard) {
      if (currentGrammarStudyCard.kind === 'overview') {
        return currentGrammarStudyCard.examples?.[0]?.german || '';
      }
      return assignmentGrammarContent?.examples?.[0]?.german || '';
    }
    return buildTeacherStudySpeechText(currentStudyItem, currentStudyVerb);
  }, [currentGrammarStudyCard, assignmentGrammarContent, currentStudyItem, currentStudyVerb]);

  // Auto-pronounce word (or verb + all conjugations / grammar example) when entering Teacher Study card
  useEffect(() => {
    if (phase === 'teacher_study' && currentStudySpeechText) {
      const timer = setTimeout(() => {
        if (!isSoundMuted()) {
          speakGermanText(currentStudySpeechText, 0.9);
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [phase, studyIndex, currentStudySpeechText]);

  useEffect(() => {
    if (phase === 'quiz' && currentQuestion) {
      setQuestionStartMs(Date.now());
      if (restoredTileProgressRef.current) {
        // Keep tile progress restored from the saved session (see restore effect).
        restoredTileProgressRef.current = false;
      } else {
        setMultiStepIdx(0);
        setFilledSlots({});
        setUsedTileIds([]);
        setErrorTileId(null);
        setWrongStepsCount(0);
      }
      setGrammarTypedInput('');
      setGrammarOrderedTiles([]);
      if (currentQuestion.type === 'true_false') {
        stopGermanSpeech();
      } else if (!gamificationRef.current.pendingBonusRound && !activeOverlayRound) {
        const timer = setTimeout(() => {
          if (!isSoundMuted()) {
            speakGermanText(currentQuestion.audioPromptText || currentQuestion.germanWord, 0.9);
          }
        }, 250);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, currentIdx, currentQuestion?.id]);

  // Merged submissions (Cloud + Local student scope) for accurate attempt tracking and enforcement
  const mergedSubmissionsForAssignment = useMemo(() => {
    const map = new Map<string, HomeworkSubmission>();
    const localSubs = getStudentLocalSubmissions(assignmentId, assignment?.ownerUid);
    for (const s of localSubs) {
      if (s && s.id) map.set(s.id, s);
    }
    for (const s of allSubmissions) {
      if (s && s.id) map.set(s.id, s);
    }
    return Array.from(map.values());
  }, [allSubmissions, assignmentId, assignment?.ownerUid, phase, finalScore]);

  const resolvedOpenPid = useMemo(() => {
    if (audienceMode !== 'open') return '';
    if (openParticipantId) return openParticipantId;
    const clean = studentName.trim();
    if (!clean || !assignmentId) return '';
    return getOrCreateOpenParticipantId(assignmentId, clean);
  }, [audienceMode, openParticipantId, studentName, assignmentId]);

  const studentCompletedAttempts = useMemo(() => {
    if (audienceMode === 'group') {
      if (!selectedStudentId) return [];
      return mergedSubmissionsForAssignment.filter((s) => {
        if (s.studentId !== selectedStudentId) return false;
        return s.status === 'completed' || (!s.status && Boolean(s.completedAt));
      });
    }

    const trimmedName = studentName.trim().toLowerCase();
    if (!trimmedName || !resolvedOpenPid) return [];
    return mergedSubmissionsForAssignment.filter((s) => {
      const matchesParticipant =
        (s.participantId && s.participantId === resolvedOpenPid) ||
        (!s.participantId && !s.studentId && (s.studentName || '').trim().toLowerCase() === trimmedName);
      if (!matchesParticipant) return false;
      return s.status === 'completed' || (!s.status && Boolean(s.completedAt));
    });
  }, [mergedSubmissionsForAssignment, audienceMode, selectedStudentId, studentName, resolvedOpenPid]);

  const isAttemptLimitReached = useMemo(() => {
    const completedCount = studentCompletedAttempts.length;
    if (completedCount === 0) return false;
    if (assignment?.allowReplay === false && completedCount >= 1) {
      return true;
    }
    const maxAttempts = typeof assignment?.maxAttempts === 'number' ? assignment.maxAttempts : 0;
    if (maxAttempts > 0 && completedCount >= maxAttempts) {
      return true;
    }
    return false;
  }, [assignment?.allowReplay, assignment?.maxAttempts, studentCompletedAttempts.length]);

  // Q21: the most recent completed attempt, for "view my last result" in the lobby
  const lastCompletedAttempt = useMemo(() => {
    if (studentCompletedAttempts.length === 0) return null;
    const sorted = [...studentCompletedAttempts].sort((a, b) => {
      const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return tb - ta;
    });
    return sorted[0] || null;
  }, [studentCompletedAttempts]);

  const handleStartHomework = (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityError(null);
    if (!isHomeworkAssignmentOpenForStudents(assignment)) {
      setIdentityError('هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
      return;
    }
    if (isAttemptLimitReached) return;

    const candidateSub: Partial<HomeworkSubmission> = {
      assignmentId,
      audienceMode,
      studentId: audienceMode === 'group' ? selectedStudentId : undefined,
      participantId: audienceMode === 'open' ? resolvedOpenPid : undefined,
      groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
      studentName: studentName.trim()
    };

    const check = validateHomeworkSubmissionIdentity(assignment, candidateSub);
    if (!check.valid) {
      setIdentityError(check.error || 'يرجى التحقق من اختيار الاسم الصحيح قبل البدء.');
      return;
    }

    const finalStudentId = check.normalizedStudentId;
    const finalParticipantId = check.normalizedParticipantId;
    const finalStudentName = check.normalizedStudentName || studentName.trim();
    const finalGroupId = check.normalizedGroupId;

    if (finalParticipantId) {
      setOpenParticipantId(finalParticipantId);
    }

    const nextAttempt = studentCompletedAttempts.length + 1;
    setCurrentAttemptNumber(nextAttempt);
    isSubmittingRef.current = false;
    lastSyncedAnsweredCountRef.current = 0;
    setSubmissionConflictError(null);

    const deterministicId = buildDeterministicSubmissionId(
      assignmentId,
      finalStudentId,
      finalStudentName,
      nextAttempt,
      finalParticipantId
    );
    activeSubmissionIdRef.current = deterministicId;
    const attemptSecret = getOrCreateStudentAttemptSecret(deterministicId);

    const initialGam = createInitialGamificationState(
      quizQuestions.length,
      assignment?.timeLimitMinutes
    );
    processedQuestionIdsRef.current = new Set();
    pendingPostBonusRef.current = null;
    setActiveOverlayRound(null);
    latestResponsesRef.current = [];
    setRetryQuestions(null);
    setRetryRoundDone(false);
    setTimeUpDialog(false);
    setUntimedMode(false);
    setResponses([]);
    setSelectedChoice(null);
    setFeedback(null);
    syncGamificationState(initialGam);

    const nowIso = new Date().toISOString();
    setStartTime(nowIso);
    playLernstudioSound('powerup_star');

    // Emit 1 deduplicated start event per attempt ID so the teacher can monitor in-progress attempts
    if (hasSentStartRef.current !== deterministicId) {
      hasSentStartRef.current = deterministicId;
      const initialInProgress: HomeworkSubmission = {
        id: deterministicId,
        assignmentId,
        ...(assignment?.title ? { assignmentTitle: assignment.title } : {}),
        ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
        attemptSecret,
        audienceMode: check.audienceMode,
        studentId: finalStudentId,
        participantId: finalParticipantId,
        groupId: finalGroupId,
        ...(check.audienceMode === 'group' && assignment?.groupName ? { groupName: assignment.groupName } : {}),
        studentName: finalStudentName,
        attemptNumber: nextAttempt,
        status: 'in_progress',
        startedAt: nowIso,
        completedAt: '',
        updatedAt: nowIso,
        timeSpentSeconds: 0,
        totalQuestions: quizQuestions.length || assignment?.questionCount || 0,
        correctAnswersCount: 0,
        scorePercentage: 0,
        accuracyPercent: 0,
        score: 0,
        accuracy: 0,
        goldEarned: 0,
        maxStreak: 0,
        completedStudyPhase: false,
        gamification: toGamificationSnapshot(initialGam),
        responses: []
      };
      setCloudSyncState('syncing');
      saveSubmissionWithConfirmation(initialInProgress, assignment)
        .then((res) => {
          setCloudSyncState(res.cloudSynced ? 'synced' : 'pending_retry');
        })
        .catch(() => {
          setCloudSyncState('pending_retry');
        });
    }

    const initialPhase = totalStudySteps > 0 ? 'teacher_study' : 'quiz';
    saveActiveHomeworkSession({
      version: 1,
      assignmentId,
      submissionId: deterministicId,
      attemptNumber: nextAttempt,
      studentName: finalStudentName,
      selectedStudentId: finalStudentId || '',
      openParticipantId: finalParticipantId || '',
      phase: initialPhase,
      studyIndex: 0,
      currentIdx: 0,
      completedStudyPhase: totalStudySteps === 0,
      startTime: nowIso,
      responses: [],
      gamification: initialGam,
      updatedAtMs: Date.now()
    });

    if (totalStudySteps > 0) {
      setStudyIndex(0);
      setPhase('teacher_study');
    } else {
      setCurrentIdx(0);
      setPhase('quiz');
    }
  };

  const persistCurrentActiveSession = useCallback(
    (overrides?: {
      phase?: 'teacher_study' | 'quiz';
      studyIndex?: number;
      currentIdx?: number;
      completedStudyPhase?: boolean;
      responses?: HomeworkQuestionResponse[];
      gamification?: HomeworkGamificationState;
      tileProgress?: PersistedTileProgress | null;
    }) => {
      if (!assignmentId || !studentName.trim()) return;
      const targetPhase = overrides?.phase ?? (phase === 'teacher_study' || phase === 'quiz' ? phase : null);
      if (!targetPhase) return;
      // Persist the in-progress tile state with the session so a refresh cannot
      // reset a partially-built tile question. Explicit null clears it (used
      // when the question is completed or the player advances).
      const isTileQuestion =
        currentQuestion?.type === 'syllables' ||
        currentQuestion?.type === 'missing_two_letters' ||
        currentQuestion?.type === 'full_word';
      const tileProgress: PersistedTileProgress | null =
        overrides && 'tileProgress' in overrides
          ? overrides.tileProgress
          : isTileQuestion && currentQuestion && (multiStepIdx > 0 || Object.keys(filledSlots).length > 0)
            ? {
                questionId: currentQuestion.id,
                multiStepIdx,
                filledSlots,
                usedTileIds,
                wrongStepsCount
              }
            : null;
      const session: ActiveHomeworkSessionState & { tileProgress?: PersistedTileProgress } = {
        version: 1,
        assignmentId,
        submissionId: activeSubmissionIdRef.current,
        attemptNumber: currentAttemptNumber,
        studentName: studentName.trim(),
        selectedStudentId: audienceMode === 'group' ? selectedStudentId : '',
        openParticipantId: audienceMode === 'open' ? resolvedOpenPid : '',
        phase: targetPhase,
        studyIndex: overrides?.studyIndex ?? studyIndex,
        currentIdx: overrides?.currentIdx ?? currentIdx,
        completedStudyPhase: overrides?.completedStudyPhase ?? completedStudyPhase,
        startTime: startTime || new Date().toISOString(),
        responses: overrides?.responses ?? latestResponsesRef.current,
        gamification: overrides?.gamification ?? gamificationRef.current,
        updatedAtMs: Date.now(),
        ...(tileProgress ? { tileProgress } : {})
      };
      saveActiveHomeworkSession(session);
    },
    [
      assignmentId,
      studentName,
      phase,
      currentAttemptNumber,
      audienceMode,
      selectedStudentId,
      resolvedOpenPid,
      studyIndex,
      currentIdx,
      completedStudyPhase,
      startTime,
      currentQuestion,
      multiStepIdx,
      filledSlots,
      usedTileIds,
      wrongStepsCount
    ]
  );

  // Restore unfinished homework session safely on refresh without duplicating points or rewards
  useEffect(() => {
    if (!assignmentId || quizQuestions.length === 0) return;
    if (hasRestoredSessionRef.current === assignmentId) return;
    hasRestoredSessionRef.current = assignmentId;

    const saved = loadActiveHomeworkSession(assignmentId);
    if (!saved) {
      if (phase === 'lobby') {
        const fresh = createInitialGamificationState(quizQuestions.length, assignment?.timeLimitMinutes);
        syncGamificationState(fresh);
      }
      return;
    }

    const alreadySubmitted = mergedSubmissionsForAssignment.some(
      (s) =>
        s.id === saved.submissionId &&
        (s.status === 'completed' || (!s.status && Boolean(s.completedAt)))
    );
    if (alreadySubmitted || !isHomeworkAssignmentOpenForStudents(assignment)) {
      clearActiveHomeworkSession(assignmentId);
      return;
    }

    const restoredSnap = toGamificationSnapshot(saved.gamification);
    const restoredGamBase = restoreGamificationStateFromSnapshot(
      restoredSnap,
      quizQuestions.length,
      assignment?.timeLimitMinutes
    );

    const savedPending = saved.gamification?.pendingBonusRound || null;
    const unappliedPendingRound =
      savedPending && !restoredGamBase.appliedBonusRoundIds.includes(savedPending.roundId)
        ? savedPending
        : null;

    const restoredGam: HomeworkGamificationState = {
      ...restoredGamBase,
      pendingBonusRound: unappliedPendingRound
    };

    processedQuestionIdsRef.current = new Set(restoredGam.processedQuestionIds);
    latestResponsesRef.current = Array.isArray(saved.responses) ? saved.responses : [];
    activeSubmissionIdRef.current = saved.submissionId;
    hasSentStartRef.current = saved.submissionId;
    lastSyncedAnsweredCountRef.current = latestResponsesRef.current.length;
    isSubmittingRef.current = false;

    setStudentName(saved.studentName || '');
    setSelectedStudentId(saved.selectedStudentId || '');
    setOpenParticipantId(saved.openParticipantId || '');
    setCurrentAttemptNumber(saved.attemptNumber || 1);
    setStartTime(saved.startTime || new Date().toISOString());
    setCompletedStudyPhase(Boolean(saved.completedStudyPhase));
    setResponses(latestResponsesRef.current);
    syncGamificationState(restoredGam);

    if (saved.phase === 'teacher_study' && totalStudySteps > 0) {
      setStudyIndex(Math.max(0, Math.min(saved.studyIndex || 0, totalStudySteps - 1)));
      setPhase('teacher_study');
      return;
    }

    const clampedIdx = Math.max(0, Math.min(saved.currentIdx || 0, quizQuestions.length - 1));
    if (unappliedPendingRound) {
      setCurrentIdx(clampedIdx);
      setPhase('quiz');
      pendingPostBonusRef.current = { nextResponses: latestResponsesRef.current };
      setActiveOverlayRound(unappliedPendingRound);
      return;
    }

    // Ensure we land on the first unanswered question if currentIdx was already answered before refresh
    let targetIdx = clampedIdx;
    while (
      targetIdx < quizQuestions.length &&
      restoredGam.processedQuestionIds.includes(quizQuestions[targetIdx].id)
    ) {
      targetIdx++;
    }

    if (targetIdx >= quizQuestions.length && latestResponsesRef.current.length > 0) {
      setPhase('quiz');
      handleFinishHomework(latestResponsesRef.current, restoredGam.points, restoredGam.maxStreak);
    } else {
      const restoredIdx = Math.min(targetIdx, Math.max(0, quizQuestions.length - 1));
      setCurrentIdx(restoredIdx);
      setPhase('quiz');
      // Restore in-progress tile state so a refresh mid-question cannot reset
      // a partially-built tile question (a failed one is already recorded and
      // skipped above via processedQuestionIds).
      const savedTileProgress = (
        saved as ActiveHomeworkSessionState & { tileProgress?: PersistedTileProgress }
      ).tileProgress;
      const restoredQuestion = quizQuestions[restoredIdx];
      if (
        savedTileProgress &&
        restoredQuestion &&
        savedTileProgress.questionId === restoredQuestion.id &&
        !restoredGam.processedQuestionIds.includes(restoredQuestion.id)
      ) {
        setMultiStepIdx(savedTileProgress.multiStepIdx || 0);
        setFilledSlots(savedTileProgress.filledSlots || {});
        setUsedTileIds(savedTileProgress.usedTileIds || []);
        setWrongStepsCount(savedTileProgress.wrongStepsCount || 0);
        restoredTileProgressRef.current = true;
      }
    }
  }, [assignmentId, assignment, quizQuestions, totalStudySteps, mergedSubmissionsForAssignment, phase, syncGamificationState]);

  // Q31: the homework timer pauses while a remote grammar check is running,
  // while the child is reading the post-answer explanation (an answer is
  // selected and feedback is showing), and during the practice retry round.
  const timerPausedRef = useRef(false);
  useEffect(() => {
    timerPausedRef.current =
      checkingRemoteAnswer || selectedChoice !== null || retryQuestions !== null;
  }, [checkingRemoteAnswer, selectedChoice, retryQuestions]);

  // Countdown Timer loop during active Quiz phase (paused while Bonus Card Round is open)
  useEffect(() => {
    if (phase !== 'quiz') return;
    const interval = setInterval(() => {
      if (isSubmittingRef.current) return;
      if (timerPausedRef.current) return;
      if (untimedMode) return;
      const prev = gamificationRef.current;
      if (prev.pendingBonusRound || activeOverlayRound) return;

      if (prev.timeRemainingSeconds <= 0) {
        // Q20: time ran out — ask before finishing instead of ending silently
        if (!timeUpDialog) setTimeUpDialog(true);
        return;
      }

      const next = tickGamificationTimer(prev, false);
      if (next !== prev) {
        syncGamificationState(next);
        if (next.timeRemainingSeconds === 0) {
          setTimeUpDialog(true);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, activeOverlayRound, syncGamificationState, untimedMode, timeUpDialog]);

  // Persist active session periodically & on navigation transitions so page refresh preserves exact timer & state
  useEffect(() => {
    if (phase !== 'teacher_study' && phase !== 'quiz') return;
    persistCurrentActiveSession();
    const saveTick = setInterval(() => {
      persistCurrentActiveSession();
    }, 3000);
    return () => clearInterval(saveTick);
  }, [phase, studyIndex, currentIdx, persistCurrentActiveSession]);

  // Cleanup advance timeouts on unmount
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  const advanceToNextQuestion = (
    nextResponses: HomeworkQuestionResponse[],
    currentGold: number,
    currentMaxStreak: number
  ) => {
    setSelectedChoice(null);
    setFeedback(null);
    setMultiStepIdx(0);
    setFilledSlots({});
    setUsedTileIds([]);
    setErrorTileId(null);
    setWrongStepsCount(0);
    setGrammarTypedInput('');
    setGrammarOrderedTiles([]);

    const activeLen = (retryQuestions ?? quizQuestions).length;
    if (currentIdx + 1 < activeLen) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      if (!retryQuestions) {
        persistCurrentActiveSession({
          phase: 'quiz',
          currentIdx: nextIdx,
          responses: nextResponses,
          gamification: gamificationRef.current,
          tileProgress: null
        });
      }
    } else if (retryQuestions) {
      // End of the practice retry round (Q25/Q32): finish with the ORIGINAL
      // responses — retry answers never change the score or the submission.
      setRetryQuestions(null);
      setRetryRoundDone(true);
      setCurrentIdx(0);
      handleFinishHomework(nextResponses, currentGold, currentMaxStreak);
    } else if (!retryRoundDone) {
      // Q25: the mistakes come back at the very END as a final retry round
      // with only the wrong questions (practice only, Q32).
      const wrongIds = new Set(
        nextResponses
          .filter((r) => !r.isCorrect && !r.pendingServerGrading)
          .map((r) => r.questionId)
      );
      const retryQs = quizQuestions.filter((q) => wrongIds.has(q.id));
      if (retryQs.length > 0) {
        setRetryQuestions(retryQs);
        setCurrentIdx(0);
        return;
      }
      handleFinishHomework(nextResponses, currentGold, currentMaxStreak);
    } else {
      handleFinishHomework(nextResponses, currentGold, currentMaxStreak);
    }
  };

  const handlePickBonusCard = useCallback(
    (cardInstanceId: string): BonusCardInstance | null => {
      const currentGam = gamificationRef.current;
      const res = applyBonusCardSelection(currentGam, cardInstanceId);
      if (res.selectedCard && !res.alreadyApplied) {
        syncGamificationState(res.nextState);
        persistCurrentActiveSession({
          gamification: res.nextState
        });
        if (res.selectedCard.pointsDelta !== 0) {
          gameEffects.triggerScorePopup(
            res.selectedCard.pointsDelta > 0
              ? `+${res.selectedCard.pointsDelta}`
              : `${res.selectedCard.pointsDelta}`,
            50,
            24,
            res.selectedCard.pointsDelta > 0
          );
        }
      }
      return res.selectedCard;
    },
    [syncGamificationState, persistCurrentActiveSession, gameEffects]
  );

  const handleBonusRoundComplete = useCallback(() => {
    setActiveOverlayRound(null);
    const pending = pendingPostBonusRef.current;
    pendingPostBonusRef.current = null;
    const latestGam = gamificationRef.current;
    const targetResponses = pending ? pending.nextResponses : latestResponsesRef.current;
    advanceToNextQuestion(targetResponses, latestGam.points, latestGam.maxStreak);
  }, [currentIdx, quizQuestions.length]);

  const recordQuestionCompletion = (
    studentAnswerStr: string,
    isCorrect: boolean,
    options?: { pendingServerGrading?: boolean }
  ) => {
    if (!currentQuestion) return;
    if (!studentAnswerStr || !studentAnswerStr.trim()) return;

    // Q25/Q32 practice retry round: feedback only — no points, no streak
    // change, no response recording, no sync. The original responses (and
    // score) are kept untouched and submitted when the round ends.
    if (retryQuestions) {
      setFeedback(isCorrect ? 'correct' : 'wrong');
      if (isCorrect) {
        playLernstudioSound('correct');
      } else {
        playLernstudioSound('wrong');
        if (currentQuestion.type !== 'true_false' && currentQuestion.audioPromptText) {
          speakGermanText(currentQuestion.audioPromptText, 0.9);
        }
      }
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
      advanceTimeoutRef.current = setTimeout(() => {
        advanceToNextQuestion(
          latestResponsesRef.current,
          gamificationRef.current.points,
          gamificationRef.current.maxStreak
        );
      }, 950);
      return;
    }

    if (
      processedQuestionIdsRef.current.has(currentQuestion.id) ||
      gamificationRef.current.processedQuestionIds.includes(currentQuestion.id)
    ) {
      return;
    }

    const isPendingGrading = Boolean(options?.pendingServerGrading);
    const transition = applyAnswerGamification(gamificationRef.current, {
      questionId: currentQuestion.id,
      questionIndex: currentIdx,
      isCorrect: isPendingGrading ? true : isCorrect,
      isAnswered: true
    });
    if (transition.ignoredDuplicate) return;

    processedQuestionIdsRef.current.add(currentQuestion.id);
    const nextGam = transition.nextState;
    syncGamificationState(nextGam);
    setFeedback(isPendingGrading ? 'submitted' : isCorrect ? 'correct' : 'wrong');

    if (isPendingGrading) {
      playLernstudioSound('correct');
    } else if (isCorrect) {
      playLernstudioSound(transition.doubledApplied ? 'combo_ding' : 'correct');
      gameEffects.triggerScorePopup(
        transition.doubledApplied ? `+${transition.pointsDelta} (×2!)` : `+${transition.pointsDelta}`,
        50,
        28,
        transition.doubledApplied ? '#8B5CF6' : true
      );
      if (transition.doubledApplied || nextGam.streak >= STREAK_TRIGGER_THRESHOLD) {
        gameEffects.triggerSparkles(50, 32, transition.doubledApplied ? '#8B5CF6' : '#F59E0B');
      }
    } else {
      playLernstudioSound('wrong');
      if (currentQuestion.type !== 'true_false') {
        playGermanVoiceFeedback('noch_einmal');
      }
      gameEffects.triggerScorePopup(`${transition.pointsDelta || -5}`, 50, 28, false);
      if (!isSoundMuted() && currentQuestion.type !== 'true_false' && currentQuestion.audioPromptText) {
        speakGermanText(currentQuestion.audioPromptText, 0.9);
      }
    }

    const elapsedSec = Math.max(1, Math.round((Date.now() - questionStartMs) / 1000));
    const newResponse: HomeworkQuestionResponse = {
      questionId: currentQuestion.id,
      questionType: currentQuestion.type,
      germanWord: currentQuestion.germanWord,
      promptText: `${currentQuestion.stageLabelAr} — ${currentQuestion.promptMainText || currentQuestion.germanWord}`,
      studentAnswer: studentAnswerStr,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      timeSpentSeconds: elapsedSec,
      ...(isPendingGrading ? { pendingServerGrading: true } : {}),
      ...(currentQuestion.isVerbQuestion ? { isVerbQuestion: true } : {}),
      ...(currentQuestion.verbId ? { verbId: currentQuestion.verbId } : {}),
      ...(currentQuestion.infinitive ? { infinitive: currentQuestion.infinitive } : {}),
      ...(currentQuestion.subject ? { subject: currentQuestion.subject } : {}),
      ...(currentQuestion.sentence ? { sentence: currentQuestion.sentence } : {}),
      ...(currentQuestion.exerciseId ? { exerciseId: currentQuestion.exerciseId } : {}),
      ...(currentQuestion.grammarType ? { grammarType: currentQuestion.grammarType } : {}),
      ...(currentQuestion.explanation ? { explanation: currentQuestion.explanation } : {})
    };

    const nextResponses = [...latestResponsesRef.current, newResponse];
    latestResponsesRef.current = nextResponses;
    setResponses(nextResponses);

    const snapshot = toGamificationSnapshot(nextGam);
    persistCurrentActiveSession({
      phase: 'quiz',
      currentIdx,
      responses: nextResponses,
      gamification: nextGam,
      tileProgress: null
    });

    // Checkpoint every 10 newly answered questions (and NEVER on the final question)
    if (
      shouldSendProgressCheckpoint({
        answeredCount: nextResponses.length,
        totalQuestions: quizQuestions.length,
        lastSyncedAnsweredCount: lastSyncedAnsweredCountRef.current
      })
    ) {
      lastSyncedAnsweredCountRef.current = nextResponses.length;
      syncLiveProgressToFirestore(nextResponses, nextGam.points, nextGam.maxStreak, undefined, snapshot);
    }

    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
    }

    const isFinalQuestion =
      currentIdx + 1 >= quizQuestions.length || nextResponses.length >= quizQuestions.length;

    if (!isFinalQuestion && transition.triggeredBonusRound && nextGam.pendingBonusRound) {
      const triggeredRound = nextGam.pendingBonusRound;
      pendingPostBonusRef.current = { nextResponses };
      advanceTimeoutRef.current = setTimeout(() => {
        setActiveOverlayRound(triggeredRound);
      }, 650);
    } else {
      advanceTimeoutRef.current = setTimeout(() => {
        advanceToNextQuestion(nextResponses, nextGam.points, nextGam.maxStreak);
      }, 950);
    }
  };

  const handleSelectOption = async (chosenOption: string) => {
    if (selectedChoice !== null || checkingRemoteAnswer || !currentQuestion || !chosenOption || !chosenOption.trim()) return;
    // In the practice retry round the question was already answered once —
    // that must not block re-answering it for practice (Q25).
    if (!retryQuestions && processedQuestionIdsRef.current.has(currentQuestion.id)) return;
    setSelectedChoice(chosenOption);

    const requiresRemoteCheck =
      !currentQuestion.correctAnswer &&
      (currentQuestion.type === 'grammar_exercise' || Boolean(currentQuestion.exerciseId));

    if (requiresRemoteCheck) {
      setCheckingRemoteAnswer(true);
      try {
        const tokenParam =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '';
        const remoteRes = await checkHomeworkAnswerRemotely({
          assignmentId: assignment?.id || assignmentId,
          shortId: assignment?.shortId || shortIdFromUrl || undefined,
          token: tokenParam || undefined,
          exerciseId: currentQuestion.exerciseId,
          questionId: currentQuestion.id,
          itemId: currentQuestion.itemId,
          questionType: currentQuestion.type,
          grammarType: currentQuestion.grammarType,
          selectedAnswer: chosenOption
        });
        if (remoteRes.checked && typeof remoteRes.isCorrect === 'boolean') {
          recordQuestionCompletion(chosenOption, remoteRes.isCorrect);
        } else {
          recordQuestionCompletion(chosenOption, false, { pendingServerGrading: true });
        }
      } finally {
        setCheckingRemoteAnswer(false);
      }
      return;
    }

    const isCorrect =
      currentQuestion.type === 'grammar_exercise' ||
      (Array.isArray(currentQuestion.acceptedAnswers) && currentQuestion.acceptedAnswers.length > 0)
        ? evaluateNormalizedGrammarAnswer(chosenOption, {
            correctAnswer: currentQuestion.correctAnswer,
            acceptedAnswers: currentQuestion.acceptedAnswers
          })
        : chosenOption.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    recordQuestionCompletion(chosenOption, isCorrect);
  };

  // First wrong tile fails the tile question immediately, like the instant
  // types: lock all tiles, record the actually-attempted tiles as wrong, and
  // auto-advance (recordQuestionCompletion advances after 950 ms).
  const failTileQuestion = (tile: HomeworkTileChoice) => {
    if (!currentQuestion) return;
    const attemptedTiles = [
      ...Object.entries(filledSlots)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, text]) => text),
      tile.text
    ].join('');
    // wrongStepsCount is now diagnostic only; it no longer affects scoring.
    setWrongStepsCount((c) => c + 1);
    setErrorTileId(tile.id);
    setSelectedChoice(currentQuestion.germanWord);
    recordQuestionCompletion(attemptedTiles, false);
  };

  const handleTileClick = (tile: HomeworkTileChoice) => {
    if (!currentQuestion || selectedChoice !== null || usedTileIds.includes(tile.id)) return;

    if (currentQuestion.type === 'syllables') {
      const expectedSyllables = currentQuestion.expectedSyllables || [];
      const expectedSyl = expectedSyllables[multiStepIdx];
      if (!expectedSyl) return;

      if (tile.text === expectedSyl) {
        const nextStep = multiStepIdx + 1;
        const nextUsed = [...usedTileIds, tile.id];
        const nextFilled = { ...filledSlots, [multiStepIdx]: tile.text };
        setUsedTileIds(nextUsed);
        setFilledSlots(nextFilled);
        setMultiStepIdx(nextStep);
        setErrorTileId(null);

        if (nextStep >= expectedSyllables.length) {
          setSelectedChoice(currentQuestion.germanWord);
          recordQuestionCompletion(currentQuestion.germanWord, true);
        } else {
          playLernstudioSound('correct');
        }
      } else {
        failTileQuestion(tile);
      }
      return;
    }

    if (currentQuestion.type === 'missing_two_letters') {
      const expectedChars = currentQuestion.expectedChars || [];
      const missingIndices = currentQuestion.missingIndices || [];
      const expectedChar = expectedChars[multiStepIdx];
      if (!expectedChar) return;

      if (tile.text.toUpperCase() === expectedChar.toUpperCase()) {
        const nextStep = multiStepIdx + 1;
        const nextUsed = [...usedTileIds, tile.id];
        const targetCharIndex = missingIndices[multiStepIdx];
        const nextFilled = { ...filledSlots, [targetCharIndex]: expectedChar };
        setUsedTileIds(nextUsed);
        setFilledSlots(nextFilled);
        setMultiStepIdx(nextStep);
        setErrorTileId(null);

        if (nextStep >= expectedChars.length) {
          setSelectedChoice(currentQuestion.germanWord);
          recordQuestionCompletion(currentQuestion.germanWord, true);
        } else {
          playLernstudioSound('correct');
        }
      } else {
        failTileQuestion(tile);
      }
      return;
    }

    if (currentQuestion.type === 'full_word') {
      const expectedChars = currentQuestion.expectedChars || currentQuestion.chars || [];
      const expectedChar = expectedChars[multiStepIdx];
      if (!expectedChar) return;

      if (tile.text.toUpperCase() === expectedChar.toUpperCase()) {
        const nextStep = multiStepIdx + 1;
        const nextUsed = [...usedTileIds, tile.id];
        const nextFilled = { ...filledSlots, [multiStepIdx]: expectedChar };
        setUsedTileIds(nextUsed);
        setFilledSlots(nextFilled);
        setMultiStepIdx(nextStep);
        setErrorTileId(null);

        if (nextStep >= expectedChars.length) {
          setSelectedChoice(currentQuestion.germanWord);
          recordQuestionCompletion(currentQuestion.germanWord, true);
        } else {
          playLernstudioSound('correct');
        }
      } else {
        failTileQuestion(tile);
      }
    }
  };

  const buildCurrentInProgressSnapshot = useCallback(
    (
      currResponses: HomeworkQuestionResponse[],
      currGold: number,
      currMaxStreak: number,
      studyCompletedOverride?: boolean,
      gamificationSnapshotOverride?: ReturnType<typeof toGamificationSnapshot>
    ): HomeworkSubmission => {
      const correctCount = currResponses.filter((r) => r.isCorrect).length;
      const totalQ = quizQuestions.length || currResponses.length;
      const localScorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
      const nowIso = new Date().toISOString();
      const startMs = startTime ? new Date(startTime).getTime() : Date.now() - currResponses.length * 4000;
      const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startMs) / 1000));
      const attemptSecret = getOrCreateStudentAttemptSecret(activeSubmissionIdRef.current);
      const snap = gamificationSnapshotOverride ?? toGamificationSnapshot(gamificationRef.current);

      return {
        id: activeSubmissionIdRef.current,
        assignmentId,
        ...(assignment?.title ? { assignmentTitle: assignment.title } : {}),
        ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
        attemptSecret,
        audienceMode,
        studentId: audienceMode === 'group' ? selectedStudentId || undefined : undefined,
        participantId: audienceMode === 'open' ? resolvedOpenPid || undefined : undefined,
        groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
        ...(audienceMode === 'group' && assignment?.groupName ? { groupName: assignment.groupName } : {}),
        studentName: studentName.trim(),
        attemptNumber: currentAttemptNumber,
        status: 'in_progress',
        startedAt: startTime || nowIso,
        completedAt: '',
        updatedAt: nowIso,
        timeSpentSeconds,
        totalQuestions: totalQ,
        correctAnswersCount: correctCount,
        scorePercentage: localScorePct,
        accuracyPercent: localScorePct,
        score: correctCount,
        accuracy: localScorePct,
        goldEarned: currGold,
        maxStreak: currMaxStreak,
        completedStudyPhase: studyCompletedOverride ?? completedStudyPhase,
        gamification: snap,
        responses: currResponses
      };
    },
    [
      assignmentId,
      assignment?.title,
      assignment?.ownerUid,
      assignment?.groupId,
      assignment?.groupName,
      audienceMode,
      selectedStudentId,
      resolvedOpenPid,
      studentName,
      currentAttemptNumber,
      startTime,
      completedStudyPhase,
      quizQuestions.length
    ]
  );

  // Best-effort keepalive progress checkpoint if the student hides, leaves, or closes mid-quiz.
  // Stored in a ref so the pagehide/visibilitychange/unmount effect runs cleanup ONLY on actual unmount.
  const flushExitCheckpointRef = useRef<() => void>(() => {});
  flushExitCheckpointRef.current = () => {
    if (phaseRef.current !== 'quiz' || isSubmittingRef.current) return;
    const currResponses = latestResponsesRef.current;
    if (!assignmentId || !studentName.trim()) return;
    if (currResponses.length <= lastSyncedAnsweredCountRef.current) return;
    if (currResponses.length >= quizQuestions.length) return;

    lastSyncedAnsweredCountRef.current = currResponses.length;
    const snap = gamificationRef.current;
    const payload = buildCurrentInProgressSnapshot(
      currResponses,
      snap.points,
      snap.maxStreak,
      undefined,
      toGamificationSnapshot(snap)
    );
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      saveSubmissionWithConfirmation(payload, assignment).catch(() => {});
      return;
    }
    const urlShareToken = new URLSearchParams(window.location.search).get('token')?.trim() || '';
    const activeShortId = (assignment?.shortId || shortIdFromUrl || '').trim();
    sendExitProgressCheckpointKeepalive(payload, {
      shortId: activeShortId,
      shareToken: urlShareToken
    });
  };

  useEffect(() => {
    const handleExit = () => flushExitCheckpointRef.current();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushExitCheckpointRef.current();
      }
    };

    window.addEventListener('pagehide', handleExit);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handleExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushExitCheckpointRef.current();
    };
  }, []);

  const syncLiveProgressToFirestore = (
    currResponses: HomeworkQuestionResponse[],
    currGold: number,
    currMaxStreak: number,
    studyCompletedOverride?: boolean,
    gamificationSnapshotOverride?: ReturnType<typeof toGamificationSnapshot>
  ) => {
    if (!assignmentId || !studentName.trim()) return;
    const liveSubmissionObj = buildCurrentInProgressSnapshot(
      currResponses,
      currGold,
      currMaxStreak,
      studyCompletedOverride,
      gamificationSnapshotOverride
    );

    setCloudSyncState('syncing');
    saveSubmissionWithConfirmation(liveSubmissionObj, assignment)
      .then((res) => {
        setCloudSyncState(res.cloudSynced ? 'synced' : 'pending_retry');
      })
      .catch(() => {
        setCloudSyncState('pending_retry');
      });
  };

  const handleFinishHomework = async (
    allResponses: HomeworkQuestionResponse[],
    finalGoldValue: number,
    finalMaxStreak: number
  ) => {
    if (isSubmittingRef.current) return;
    if (!isHomeworkAssignmentOpenForStudents(assignment)) {
      setError('هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
      return;
    }
    isSubmittingRef.current = true;
    clearActiveHomeworkSession(assignmentId);
    setActiveOverlayRound(null);
    pendingPostBonusRef.current = null;
    setSubmissionConflictError(null);

    setPhase('completed');
    setSubmitting(true);
    setCloudSyncState('syncing');
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });

    const finalSnapshot = toGamificationSnapshot(gamificationRef.current);
    const correctCount = allResponses.filter((r) => r.isCorrect).length;
    const totalQ = Math.max(quizQuestions.length || 0, allResponses.length);
    const localScorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const completedAtIso = new Date().toISOString();
    const startMs = startTime ? new Date(startTime).getTime() : Date.now() - totalQ * 4000;
    const timeSpentSeconds = Math.max(5, Math.round((Date.now() - startMs) / 1000));
    const attemptSecret = getOrCreateStudentAttemptSecret(activeSubmissionIdRef.current);

    const localSubmissionObj: HomeworkSubmission = {
      id: activeSubmissionIdRef.current,
      assignmentId,
      ...(assignment?.title ? { assignmentTitle: assignment.title } : {}),
      ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
      attemptSecret,
      audienceMode,
      studentId: audienceMode === 'group' ? selectedStudentId || undefined : undefined,
      participantId: audienceMode === 'open' ? resolvedOpenPid || undefined : undefined,
      groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
      ...(audienceMode === 'group' && assignment?.groupName ? { groupName: assignment.groupName } : {}),
      studentName: studentName.trim(),
      attemptNumber: currentAttemptNumber,
      status: 'completed',
      startedAt: startTime || completedAtIso,
      completedAt: completedAtIso,
      updatedAt: completedAtIso,
      timeSpentSeconds,
      totalQuestions: totalQ,
      correctAnswersCount: correctCount,
      scorePercentage: localScorePct,
      accuracyPercent: localScorePct,
      score: correctCount,
      accuracy: localScorePct,
      goldEarned: finalGoldValue,
      maxStreak: finalMaxStreak,
      completedStudyPhase,
      gamification: finalSnapshot,
      responses: allResponses
    };

    // Single authoritative final submission path (POST /api/homework/submit once + Firestore fallback if transient)
    try {
      const confirmRes = await saveSubmissionWithConfirmation(localSubmissionObj, assignment);
      const syncedSubmissionObj: HomeworkSubmission = {
        ...confirmRes.submission,
        cloudSynced: confirmRes.cloudSynced
      };
      setCloudSyncState(confirmRes.cloudSynced ? 'synced' : 'pending_retry');
      setFinalScore(syncedSubmissionObj);
      playLernstudioSound('fanfare_victory');
    } catch (err: any) {
      if (err?.rejected || err?.status === 409 || err?.status === 403 || err?.status === 404) {
        setCloudSyncState('rejected');
        setSubmissionConflictError(formatSubmissionRejectionMessage(err));
        setFinalScore({ ...localSubmissionObj, cloudSynced: false });
      } else {
        setCloudSyncState('pending_retry');
        setFinalScore({ ...localSubmissionObj, cloudSynced: false });
        playLernstudioSound('fanfare_victory');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualRetryCloudSync = async () => {
    setRetryingCloudSync(true);
    setCloudSyncState('syncing');
    setSubmissionConflictError(null);
    try {
      if (finalScore) {
        try {
          const res = await saveSubmissionWithConfirmation(finalScore, assignment);
          if (res.cloudSynced) {
            setCloudSyncState('synced');
            setFinalScore((prev: any) =>
              prev ? { ...prev, ...res.submission, cloudSynced: true } : prev
            );
            return;
          }
        } catch (err: any) {
          if (err?.rejected || err?.status === 409 || err?.status === 403 || err?.status === 404) {
            setCloudSyncState('rejected');
            setSubmissionConflictError(formatSubmissionRejectionMessage(err));
            return;
          }
        }
      }
      const flushRes = await flushPendingHomeworkCloudWrites();
      setCloudSyncState(flushRes.remainingPending === 0 ? 'synced' : 'pending_retry');
    } finally {
      setRetryingCloudSync(false);
    }
  };

  // Keep the latest retry handler reachable from the auto-retry effect.
  handleManualRetryCloudSyncRef.current = handleManualRetryCloudSync;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text-main flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-text-muted">جاري تحضير الواجب...</p>
        </div>
      </div>
    );
  }

  if (error && phase === 'lobby') {
    return (
      <div className="min-h-screen bg-background text-text-main flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="max-w-md w-full bg-surface border border-surface-border rounded-2xl overflow-hidden text-center shadow-xs">
          {assignment && (
            <div className="bg-[radial-gradient(circle_at_50%_40%,#242E44_0%,#141A29_68%,#0C101B_100%)] px-6 py-4 flex items-center justify-center gap-3 relative">
              <TeacherCrestLogo size="sm" />
              <div className="text-left" dir="ltr">
                <p className="font-cert-serif text-sm font-bold text-[#F5E1A4] tracking-wide">
                  Herr Abdul-rahman
                </p>
                <p className="text-[11px] text-[#CBD5E1]">Deutschunterricht</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 h-[3px] w-full" aria-hidden="true">
            <span className="bg-[#18181B]" />
            <span className="bg-[#DC2626]" />
            <span className="bg-[#EAB308]" />
          </div>
          <div className="p-6 space-y-4">
            {resolutionStatus === 'network_error' || resolutionStatus === 'quota_exceeded' ? (
              <CloudOff className="w-10 h-10 text-amber-500 mx-auto" />
            ) : (
              <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
            )}
            <h2 className="text-base font-bold text-text-main text-balance">
              {resolutionStatus === 'revoked'
                ? 'تم إيقاف أو حذف هذا الواجب'
                : resolutionStatus === 'invalid_id'
                ? 'رابط الواجب غير صالح'
                : resolutionStatus === 'quota_exceeded'
                ? 'ضغط مؤقت على السحابة'
                : resolutionStatus === 'network_error'
                ? 'تعذر الاتصال بالسحابة'
                : 'تنبيه بخصوص الواجب'}
            </h2>
            <p className="text-xs text-text-muted">{error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(resolutionStatus === 'network_error' ||
                resolutionStatus === 'quota_exceeded' ||
                resolutionStatus === 'not_found') && (
                <button
                  type="button"
                  onClick={() => {
                    clearFirestoreReadQuotaFlag();
                    setReloadNonce((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  try { window.close(); } catch {}
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/');
                    window.dispatchEvent(new Event('glueck-route-change'));
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main font-bold text-xs transition-colors shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>إغلاق الصفحة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 0: LOBBY & STUDENT NAME ENTRY (Signature Overlapping Seal Masthead)
  // ============================================================================
  if (phase === 'lobby') {
    const flowMode: HomeworkFlowMode = 'teacher_then_quiz';

    return (
      <div className="min-h-screen bg-background text-text-main flex flex-col justify-between p-4 sm:p-6 font-sans" dir="rtl">
        {/* Main Editorial Welcome Card */}
        <div className="max-w-lg w-full bg-surface border border-surface-border rounded-2xl shadow-sm overflow-hidden mx-auto my-auto">
          <>
            {/* Dark Obsidian Academy Masthead */}
              <div className="relative bg-[radial-gradient(circle_at_50%_20%,#25324A_0%,#131A29_64%,#0A0E17_100%)] px-6 pt-6 pb-20 text-center overflow-hidden">
                {/* Subtle Concentric Geometric Seal Hairlines */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-64 h-64 rounded-full border border-white/[0.06]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full border border-[#D4AF37]/[0.10]"
                />

                <div className="relative z-10 flex items-center justify-center gap-3 max-w-xs mx-auto" dir="ltr">
                  <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/50" />
                  <span className="font-cert-serif text-xs sm:text-sm font-semibold tracking-wider text-[#F5E1A4] whitespace-nowrap">
                    Deutsch mit Herr Abdul-rahman
                  </span>
                  <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/50" />
                </div>
              </div>

              {/* Crisp 3px German Tricolor Architectural Seam */}
              <div className="grid grid-cols-3 h-[3px] w-full" aria-hidden="true">
                <span className="bg-[#18181B]" />
                <span className="bg-[#DC2626]" />
                <span className="bg-[#EAB308]" />
              </div>

              {/* Overlapping Signature Crest Medallion Straddling the Seam */}
              <div className="-mt-16 sm:-mt-[72px] relative z-20 flex justify-center px-4">
                <TeacherCrestLogo size="lg" className="ring-[5px] ring-surface" />
              </div>
          </>

          {/* Assignment Body */}
          <div className="px-5 pt-4 pb-6 sm:px-7 sm:pb-7 space-y-5">
            {/* Assignment Title & Unboxed Inline Metadata */}
            <div className="text-center space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-bold text-text-main text-balance">
                {assignment?.title || 'واجب Glück التفاعلي'}
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-text-muted tabular-nums">
                {audienceMode === 'group' && assignment?.groupName && (
                  <>
                    <span className="font-bold text-primary">{assignment.groupName}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                {studyItems.length > 0 && (
                  <>
                    <span>{studyItems.length} مفردات للمراجعة</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                {assignmentGrammarExercises.length > 0 && (
                  <>
                    <span>{assignmentGrammarExercises.length} تمرين قواعد</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{quizQuestions.length} سؤال تفاعلي</span>
              </div>
            </div>

          {identityError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold text-center">
              {identityError}
            </div>
          )}

          {audienceMode === 'group' ? (
            /* MODE B: SPECIFIC GROUP ONLY — Display ONLY students from the selected group; fail closed if empty */
            displayStudents.length > 0 ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-bold text-text-muted">
                    اختر اسمك من قائمة المجموعة للبدء:
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-0.5">
                  {displayStudents.map((st) => {
                    const isSelected = selectedStudentId === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(st.id);
                          setStudentName(st.name);
                          setIdentityError(null);
                        }}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-xs font-semibold ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-xs font-bold scale-[1.02]'
                            : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main hover:border-primary/40'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-surface-hover border border-surface-border text-text-muted'
                          }`}
                        >
                          👤
                        </span>
                        <span className="truncate w-full text-center">{st.name}</span>
                      </button>
                    );
                  })}
                </div>

                {isAttemptLimitReached && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold text-center">
                      لقد أتممت المحاولات المسموحة لهذا الواجب ({studentCompletedAttempts.length} /{' '}
                      {assignment?.allowReplay === false ? 1 : assignment?.maxAttempts}).
                    </div>
                    {lastCompletedAttempt && (
                      <button
                        type="button"
                        onClick={() => setShowLastResult(true)}
                        className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                        <span>👁️ عرض نتيجتي الأخيرة</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Start Button strictly BELOW student cards */}
                <button
                  type="button"
                  disabled={!selectedStudentId || isAttemptLimitReached}
                  onClick={handleStartHomework}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <span>
                    {isAttemptLimitReached
                      ? 'تم إتمام الواجب ✓'
                      : flowMode === 'teacher_then_quiz'
                      ? 'بدء الواجب 🚀'
                      : 'بدء حل الأسئلة 🎯'}
                  </span>
                  {!isAttemptLimitReached && <ArrowLeft className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              /* Fail-closed error when a group-restricted homework has no loaded group student list */
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
                <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-xs font-bold text-text-main">
                  تعذر تحميل قائمة طلاب هذه المجموعة حاليًا.
                </p>
                <p className="text-[11px] text-text-muted">
                  هذا الواجب مخصص لطلاب المجموعة فقط ولا يمكن بدء الحل بدون قائمة المجموعة المسجلة. يرجى التحقق من اتصال الإنترنت أو التواصل مع المعلم.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            )
          ) : (
            /* MODE A: OPEN HOMEWORK ("مفتوح لأي اسم") — Manual name input ONLY; never displays any student list */
            <form onSubmit={handleStartHomework} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5 text-center">
                  اكتب اسمك للبدء وتسجيل نتيجتك:
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setSelectedStudentId('');
                    setOpenParticipantId('');
                    setIdentityError(null);
                  }}
                  placeholder="مثال: أحمد محمد / Omar Ali..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-surface-border focus:border-primary text-text-main font-bold text-sm outline-none transition-all text-center"
                />
              </div>

              {isAttemptLimitReached && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold text-center">
                    لقد أتممت المحاولات المسموحة لهذا الواجب ({studentCompletedAttempts.length} /{' '}
                    {assignment?.allowReplay === false ? 1 : assignment?.maxAttempts}).
                  </div>
                  {lastCompletedAttempt && (
                    <button
                      type="button"
                      onClick={() => setShowLastResult(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Eye className="w-4 h-4 text-primary" />
                      <span>👁️ عرض نتيجتي الأخيرة</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={studentName.trim().length < 2 || isAttemptLimitReached}
                className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {isAttemptLimitReached
                    ? 'تم إتمام الواجب ✓'
                    : flowMode === 'teacher_then_quiz'
                    ? 'بدء الواجب 🚀'
                    : 'بدء حل الأسئلة 🎯'}
                </span>
                {!isAttemptLimitReached && <ArrowLeft className="w-4 h-4" />}
              </button>
            </form>
          )}
          </div>
        </div>

        {/* Teacher Signature Footer at the VERY BOTTOM of the page */}
        <footer className="text-center text-[11px] text-text-muted font-medium py-3 select-none" dir="ltr">
          von Herr Abdul-rahman · Glück Deutsch
        </footer>

        {/* Q21: view my last result when attempts are exhausted */}
        {showLastResult && lastCompletedAttempt && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
            <div className="bg-surface border border-surface-border rounded-3xl p-5 max-w-md w-full space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-text-main">📋 نتيجتي الأخيرة</h3>
                <p className="text-xs font-bold text-text-muted">{assignment?.title || 'واجب Glück التفاعلي'}</p>
                {lastCompletedAttempt.completedAt && (
                  <p className="text-[11px] text-text-muted">
                    {new Date(lastCompletedAttempt.completedAt).toLocaleString('ar-EG')}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-surface-hover border border-surface-border">
                  <div className="text-xl font-bold text-primary">{lastCompletedAttempt.scorePercentage ?? 0}%</div>
                  <div className="text-[11px] font-medium text-text-muted mt-0.5">التقييم العام</div>
                </div>
                <div className="p-3 rounded-xl bg-surface-hover border border-surface-border">
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {lastCompletedAttempt.correctAnswersCount ?? 0} / {lastCompletedAttempt.totalQuestions ?? 0}
                  </div>
                  <div className="text-[11px] font-medium text-text-muted mt-0.5">إجابات صحيحة</div>
                </div>
                <div className="p-3 rounded-xl bg-surface-hover border border-surface-border">
                  <div className="text-xl font-bold text-amber-500">💰 {lastCompletedAttempt.goldEarned ?? 0}</div>
                  <div className="text-[11px] font-medium text-text-muted mt-0.5">النقاط</div>
                </div>
              </div>

              {(lastCompletedAttempt.responses || []).length > 0 && (
                <div className="text-right space-y-2">
                  <h4 className="text-xs font-bold text-text-main">
                    مراجعة الإجابات ({(lastCompletedAttempt.responses || []).length}):
                  </h4>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                    {(lastCompletedAttempt.responses || []).map((r: HomeworkQuestionResponse, i: number) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium ${
                          r.isCorrect
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/5 border-rose-500/20 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-text-main">{r.germanWord}</div>
                            <div className="text-[11px] text-text-muted">إجابتك: {r.studentAnswer}</div>
                          </div>
                        </div>
                        <div>
                          {r.isCorrect ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ صحيح</span>
                          ) : r.correctAnswer ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">الصواب: {r.correctAnswer}</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">✕ غير صحيحة</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowLastResult(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs sm:text-sm cursor-pointer transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Reusable compact always-visible HUD (top of homework screen)
  const renderCompactGamificationHud = (isStudyPhase: boolean) => {
    const isFrozen = gamification.freezeRemainingSeconds > 0;
    const isSlowMo = gamification.slowMotionRemainingSeconds > 0;
    const isLowTime = !isStudyPhase && !isFrozen && gamification.timeRemainingSeconds <= 20;
    // Q31: show when the timer is paused (remote check / reading the
    // explanation / practice retry round)
    const isTimerPaused =
      !isStudyPhase && (checkingRemoteAnswer || selectedChoice !== null || retryQuestions !== null);

    return (
      <div className="max-w-3xl w-full mx-auto sticky top-2 z-30 mb-3">
        <div className="bg-surface/95 backdrop-blur-md border border-surface-border rounded-2xl px-3 py-2 shadow-sm flex flex-wrap items-center justify-between gap-2">
          {/* Countdown Timer & Powerup Modifiers */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`px-2.5 py-1 rounded-xl border text-xs font-black font-mono tabular-nums inline-flex items-center gap-1.5 ${
                isFrozen
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-300'
                  : isSlowMo
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-300'
                  : isLowTime
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'bg-surface-hover border-surface-border text-text-main'
              }`}
            >
              {isFrozen ? (
                <Snowflake className="w-3.5 h-3.5 shrink-0" />
              ) : isSlowMo ? (
                <Gauge className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              <span>{formatHudTimer(gamification.timeRemainingSeconds)}</span>
              {isFrozen && (
                <span className="text-[10px] font-sans font-bold">
                  تجميد ({gamification.freezeRemainingSeconds}ث)
                </span>
              )}
              {!isFrozen && isSlowMo && (
                <span className="text-[10px] font-sans font-bold">
                  إبطاء ({gamification.slowMotionRemainingSeconds}ث)
                </span>
              )}
            </span>

            {isTimerPaused && (
              <span className="px-2 py-1 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-600 dark:text-sky-300 text-[10px] font-bold inline-flex items-center gap-1">
                <Pause className="w-3 h-3 shrink-0" />
                <span>المؤقت متوقف مؤقتاً</span>
              </span>
            )}

            {isStudyPhase ? (
              <span className="px-2.5 py-1 rounded-xl bg-surface-hover border border-surface-border text-primary text-xs font-bold tabular-nums">
                📖 {studyIndex + 1} / {Math.max(1, totalStudySteps)}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-surface-hover border border-surface-border text-text-main text-xs font-bold tabular-nums">
                {currentIdx + 1} / {activeQuizQuestions.length}
              </span>
            )}
          </div>

          {/* Points, Streak toward Bonus Card Round, Double Points badge & Audio Mute */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`px-2.5 py-1 rounded-xl border text-xs font-bold inline-flex items-center gap-1 tabular-nums ${
                gamification.streak >= STREAK_TRIGGER_THRESHOLD - 2
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400'
                  : 'bg-surface-hover border-surface-border text-text-muted'
              }`}
              title="أجب 10 إجابات متتالية صحيحة لفتح جولة بطاقات المكافآت"
            >
              <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>
                {gamification.streak}/{STREAK_TRIGGER_THRESHOLD}
              </span>
            </span>

            <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 text-xs font-black inline-flex items-center gap-1 tabular-nums">
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>{gamification.points} نقطة</span>
            </span>

            {gamification.doublePointsActive && (
              <span className="px-2 py-1 rounded-xl bg-violet-500/15 border border-violet-500/40 text-violet-600 dark:text-violet-300 text-[11px] font-black inline-flex items-center gap-1">
                <Zap className="w-3 h-3 shrink-0" />
                <span>×2</span>
              </span>
            )}

            <button
              type="button"
              onClick={toggleHudMute}
              aria-label={soundMutedState ? 'تشغيل الصوت' : 'كتم الصوت'}
              title={soundMutedState ? 'تشغيل الصوت' : 'كتم الصوت'}
              className={`p-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                soundMutedState
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-surface-hover hover:bg-surface border-surface-border text-text-main'
              }`}
            >
              {soundMutedState ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // PHASE 1: TEACHER PRONUNCIATION, GRAMMAR RULES & FLASHCARD STUDY
  // ============================================================================
  if (phase === 'teacher_study' && (currentGrammarStudyCard || currentStudyItem)) {
    const parsed = currentStudyItem ? stripLeadingArticle(currentStudyItem.german) : { article: null, baseWord: '' };
    const article = currentStudyItem?.article || parsed.article;
    const articleBadgeClass =
      article === 'der'
        ? 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400'
        : article === 'die'
        ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        : article === 'das'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
        : 'bg-surface-hover border-surface-border text-text-muted';

    const hasStudyStage = true;
    const stageBarItems = [
      ...(hasStudyStage ? [{ key: 'study', icon: '📖', title: '1. التعلم والنطق (Lernen)', isActive: true, isDone: false }] : []),
      ...activeQuestionTypes.map((qt, idx) => {
        const meta = getQuestionTypeMeta(qt);
        return {
          key: qt,
          icon: meta?.badgeEmoji || '🎯',
          title: `${hasStudyStage ? idx + 2 : idx + 1}. ${meta?.labelAr || qt}`,
          isActive: false,
          isDone: false
        };
      })
    ];

    return (
      <div className="min-h-screen bg-background text-text-main flex flex-col p-4 sm:p-6 font-sans" dir="rtl">
        <gameEffects.EffectsOverlay />

        {/* Slim Brand & Assignment Strip */}
        <div className="max-w-3xl w-full mx-auto flex items-center justify-between gap-2 mb-2.5 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <TeacherCrestLogo size="sm" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-text-main truncate">
                {assignment?.title || 'واجب Glück التفاعلي'}
              </p>
              <p className="text-[11px] text-text-muted truncate" dir="ltr">
                Herr Abdul-rahman · Lernen
              </p>
            </div>
          </div>
          {studentName && (
            <span className="text-xs font-semibold text-text-muted whitespace-nowrap shrink-0">
              {studentName}
            </span>
          )}
        </div>

        {/* Always-Visible Compact HUD */}
        {renderCompactGamificationHud(true)}

        {/* Icon-Only Stage Bar (Zero Side-Scrolling) */}
        <div className="max-w-2xl w-full mx-auto bg-surface border border-surface-border rounded-2xl p-1.5 mb-3 shadow-2xs">
          <div className="flex items-center gap-1 w-full">
            {stageBarItems.map((stg) => (
              <div
                key={stg.key}
                title={stg.title}
                aria-label={stg.title}
                className={`flex-1 h-9 rounded-xl text-sm sm:text-base font-black transition-all flex items-center justify-center border select-none ${
                  stg.isActive
                    ? 'bg-primary text-white border-primary shadow-xs scale-[1.03]'
                    : stg.isDone
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-surface-hover/60 text-text-muted border-surface-border opacity-70'
                }`}
              >
                <span>{stg.isDone ? '✓' : stg.icon}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl w-full mx-auto h-2 bg-surface-border rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((studyIndex + 1) / Math.max(1, totalStudySteps)) * 100}%` }}
          />
        </div>

        {/* Teacher Study Card (Grammar Explanation / Rule OR Vocabulary Item) */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto">
          <motion.div
            key={currentGrammarStudyCard?.id || currentStudyItem?.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-surface border border-surface-border rounded-2xl p-5 sm:p-7 text-center space-y-4 shadow-xs"
          >
            {currentGrammarStudyCard ? (
              <div className="space-y-4 text-right">
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold">
                    <span>📘 شرح القاعدة النحوية قبل بدء الأسئلة</span>
                  </div>
                </div>

                {currentGrammarStudyCard.kind === 'overview' ? (
                  <div className="space-y-3">
                    <h2 className="text-xl sm:text-2xl font-black text-text-main text-center">
                      {currentGrammarStudyCard.title}
                    </h2>
                    {currentGrammarStudyCard.summaryAr && (
                      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-sm font-bold text-text-main">
                        {currentGrammarStudyCard.summaryAr}
                      </div>
                    )}
                    {currentGrammarStudyCard.explanationAr && (
                      <div className="p-3.5 rounded-xl bg-surface-hover border border-surface-border text-xs sm:text-sm text-text-main leading-relaxed whitespace-pre-line">
                        {currentGrammarStudyCard.explanationAr}
                      </div>
                    )}
                    {currentGrammarStudyCard.explanationDe && (
                      <div
                        dir="ltr"
                        className="p-3 rounded-xl bg-surface-hover/50 border border-surface-border text-xs text-text-muted leading-relaxed text-left whitespace-pre-line"
                      >
                        {currentGrammarStudyCard.explanationDe}
                      </div>
                    )}
                    {currentGrammarStudyCard.examples.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-bold text-primary">أمثلة توضيحية (اضغط للاستماع):</p>
                        {currentGrammarStudyCard.examples.slice(0, 6).map((ex) => (
                          <div
                            key={ex.id}
                            className="p-3 rounded-xl bg-surface-hover border border-surface-border flex items-center justify-between gap-2.5"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-text-main" dir="ltr">
                                {ex.german}
                              </p>
                              {ex.arabic && (
                                <p className="text-xs text-text-muted mt-0.5">{ex.arabic}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => speakGermanText(ex.german, 0.9)}
                              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 shrink-0 cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center space-y-1">
                      <h2 className="text-lg sm:text-xl font-black text-text-main" dir="ltr">
                        {currentGrammarStudyCard.rule.titleDe || currentGrammarStudyCard.rule.titleAr}
                      </h2>
                      {currentGrammarStudyCard.rule.titleAr && currentGrammarStudyCard.rule.titleDe && (
                        <p className="text-sm font-bold text-primary">
                          {currentGrammarStudyCard.rule.titleAr}
                        </p>
                      )}
                    </div>
                    {currentGrammarStudyCard.rule.summaryAr && (
                      <div className="p-3.5 rounded-xl bg-surface-hover border border-surface-border text-xs sm:text-sm text-text-main leading-relaxed whitespace-pre-line">
                        {currentGrammarStudyCard.rule.summaryAr}
                      </div>
                    )}
                    {currentGrammarStudyCard.rule.pattern && (
                      <div
                        dir="ltr"
                        className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm font-mono font-bold text-amber-800 dark:text-amber-300 text-center"
                      >
                        {currentGrammarStudyCard.rule.pattern}
                      </div>
                    )}
                    {currentGrammarStudyCard.rule.table &&
                      Array.isArray(currentGrammarStudyCard.rule.table.rows) &&
                      currentGrammarStudyCard.rule.table.rows.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-surface-border" dir="ltr">
                          <table className="w-full text-xs text-left">
                            {Array.isArray(currentGrammarStudyCard.rule.table.headers) &&
                              currentGrammarStudyCard.rule.table.headers.length > 0 && (
                                <thead className="bg-surface-hover text-text-main font-bold">
                                  <tr>
                                    {currentGrammarStudyCard.rule.table.headers.map((h, hi) => (
                                      <th key={hi} className="px-3 py-2 border-b border-surface-border">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                              )}
                            <tbody>
                              {currentGrammarStudyCard.rule.table.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-surface-border last:border-b-0">
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="px-3 py-2 font-medium text-text-main">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    {currentGrammarStudyCard.rule.tipAr && (
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-text-main leading-relaxed">
                        💡 {currentGrammarStudyCard.rule.tipAr}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : currentStudyItem ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-hover border border-surface-border text-text-muted text-xs font-bold">
                  <span>👨‍🏫 استمع لنطق المعلّم وردد الكلمة بصوت واضح</span>
                </div>

                {currentStudyItem.emoji && (
                  <div className="text-5xl sm:text-6xl select-none">{currentStudyItem.emoji}</div>
                )}

                <div className="space-y-1.5" dir="ltr">
                  {article && (
                    <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-bold uppercase ${articleBadgeClass}`}>
                      {article === 'der' ? 'der (مذكر)' : article === 'die' ? 'die (مؤنث)' : 'das (محايد)'}
                    </span>
                  )}
                  <h2 className="text-2xl sm:text-4xl font-bold text-text-main tracking-wide">
                    {currentStudyItem.german}
                  </h2>
                  {currentStudyItem.plural && (
                    <p className="text-xs font-semibold text-text-muted">الجمع: {currentStudyItem.plural}</p>
                  )}
                </div>

                <div className="py-2.5 px-5 rounded-xl bg-surface-hover border border-surface-border inline-block">
                  <p className="text-xl sm:text-2xl font-bold text-primary">{currentStudyItem.arabic}</p>
                </div>

                {(() => {
                  const snapshotMatch = assignmentVerbs.find(
                    (v) => v.id === (currentStudyItem.verbId || currentStudyItem.id)
                  );
                  const studyVerb = snapshotMatch || resolveVerbFromLernstudioItem(currentStudyItem);
                  if (!studyVerb) return null;
                  return (
                    <div className="space-y-2.5 text-right">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                          {studyVerb.level}
                        </span>
                        {studyVerb.classifications.map((cls) => (
                          <span
                            key={cls}
                            className="px-2 py-0.5 rounded-md bg-surface-hover border border-surface-border text-text-main text-[11px] font-semibold"
                          >
                            {cls}
                          </span>
                        ))}
                        {studyVerb.preposition && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold" dir="ltr">
                            +{studyVerb.preposition} ({studyVerb.prepositionCase || 'Akk/Dat'})
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs" dir="ltr">
                        {[
                          ['ich (أنا)', studyVerb.praesens.ich],
                          ['du (أنت)', studyVerb.praesens.du],
                          ['er/sie/es', studyVerb.praesens.er_sie_es],
                          ['wir (نحن)', studyVerb.praesens.wir],
                          ['ihr (أنتم)', studyVerb.praesens.ihr],
                          ['sie/Sie', studyVerb.praesens.sie_Sie]
                        ].map(([pron, form]) => (
                          <div
                            key={pron}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-between gap-2"
                          >
                            <span className="text-[11px] text-text-muted font-semibold">{pron}</span>
                            <span className="font-bold text-text-main">{form}</span>
                          </div>
                        ))}
                      </div>
                      {studyVerb.exampleGerman && (
                        <div className="bg-surface-hover/50 border border-surface-border rounded-xl p-3 text-center space-y-1">
                          <p className="text-xs sm:text-sm font-semibold text-text-main" dir="ltr">
                            „{studyVerb.exampleGerman}“
                          </p>
                          {studyVerb.exampleArabic && (
                            <p className="text-xs text-text-muted">{studyVerb.exampleArabic}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!isItemVerb(currentStudyItem) && (currentStudyItem.exampleSentenceGerman || currentStudyItem.example) && (
                  <div className="bg-surface-hover/50 border border-surface-border rounded-xl p-3 text-center space-y-1">
                    <p className="text-xs sm:text-sm font-semibold text-text-main" dir="ltr">
                      „{currentStudyItem.exampleSentenceGerman || currentStudyItem.example}“
                    </p>
                    {currentStudyItem.exampleSentenceArabic && (
                      <p className="text-xs text-text-muted">{currentStudyItem.exampleSentenceArabic}</p>
                    )}
                  </div>
                )}

                {/* Pronunciation Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => speakGermanText(currentStudySpeechText || currentStudyItem.german, 0.9)}
                    className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>🔊 استمع للنطق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => speakGermanText(currentStudySpeechText || currentStudyItem.german, 0.55)}
                    className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-2xs"
                  >
                    <Snail className="w-4 h-4 text-primary" />
                    <span>🐢 نطق بطيء</span>
                  </button>
                </div>
              </>
            ) : null}

            {/* Prev / Next Navigation */}
            <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-surface-border">
              <button
                type="button"
                disabled={studyIndex === 0}
                onClick={() => setStudyIndex((i) => Math.max(0, i - 1))}
                className="px-3.5 py-2 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border disabled:opacity-30 text-text-muted hover:text-text-main font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>السابقة</span>
              </button>

              {studyIndex + 1 < totalStudySteps ? (
                <button
                  type="button"
                  onClick={() => {
                    playLernstudioSound('pop');
                    setStudyIndex((i) => i + 1);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <span>{currentGrammarStudyCard ? 'التالي في القاعدة' : 'الكلمة التالية'}</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playLernstudioSound('powerup_star');
                    setCompletedStudyPhase(true);
                    setCurrentIdx(0);
                    setPhase('quiz');
                    persistCurrentActiveSession({
                      phase: 'quiz',
                      currentIdx: 0,
                      completedStudyPhase: true
                    });
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <span>جاهز للأسئلة! ابدأ الاختبار الآن 🎯</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 3: COMPLETED EVALUATION & RESULTS
  // ============================================================================
  if (phase === 'completed') {
    const pct = finalScore?.scorePercentage ?? 0;
    const gradeLabel =
      pct >= 90
        ? 'ممتاز جداً! أداء متميز 🌟'
        : pct >= 75
        ? 'جيد جداً! عمل رائع 👏'
        : pct >= 50
        ? 'جيد! استمر في التدريب 💪'
        : 'تحتاج لمراجعة الكلمات والمحاولة مرة أخرى 📚';

    return (
      <div className="min-h-screen bg-background text-text-main p-4 sm:p-6 font-sans" dir="rtl">
        <div className="max-w-2xl mx-auto space-y-4 py-4">
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface border border-surface-border rounded-2xl text-center shadow-xs overflow-hidden"
          >
            {/* Official Completion Certificate Masthead */}
            <div className="relative bg-[radial-gradient(circle_at_50%_35%,#25324A_0%,#131A29_64%,#0A0E17_100%)] px-5 pt-6 pb-5 overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border border-white/[0.06]"
              />
              <div className="relative z-10 inline-flex flex-col items-center gap-2.5">
                <div className="relative">
                  <TeacherCrestLogo size="md" />
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full bg-[#121927] text-[#F3D078] border border-[#D4AF37]/70 shadow-md flex items-center justify-center absolute -bottom-1 -left-1"
                  >
                    <Trophy className="w-4 h-4" />
                  </span>
                </div>
                <p className="font-cert-serif text-xs font-semibold tracking-wider text-[#F5E1A4]" dir="ltr">
                  Herr Abdul-rahman · Zertifikat
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 h-[3px] w-full" aria-hidden="true">
              <span className="bg-[#18181B]" />
              <span className="bg-[#DC2626]" />
              <span className="bg-[#EAB308]" />
            </div>

            <div className="p-5 sm:p-7 space-y-4">

            <div className="space-y-1.5">
              {cloudSyncState === 'rejected' ? (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold space-y-1.5 mb-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{submissionConflictError || 'تعذر حفظ التعديلات لأن هذا الواجب مكتمل ومحمي ضد التعديل.'}</span>
                  </div>
                </div>
              ) : cloudSyncState === 'synced' ? (
                <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>تم حفظ نتيجتك ومزامنتها سحابياً مع المعلم</span>
                </div>
              ) : cloudSyncState === 'syncing' ? (
                <div className="inline-flex items-center gap-1.5 text-primary text-xs font-bold mb-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>تم الحفظ محلياً · جاري المزامنة السحابية...</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold space-y-2 mb-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <CloudOff className="w-4 h-4 shrink-0" />
                    <span>تم حفظ إجابتك محلياً بأمان — بانتظار الإنترنت للمزامنة مع جهاز المعلم</span>
                  </div>
                  <button
                    type="button"
                    disabled={retryingCloudSync}
                    onClick={handleManualRetryCloudSync}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${retryingCloudSync ? 'animate-spin' : ''}`} />
                    <span>{retryingCloudSync ? 'جاري إعادة المحاولة...' : 'إعادة محاولة الإرسال السحابي الآن'}</span>
                  </button>
                </div>
              )}
              <h2 className="text-xl sm:text-2xl font-bold text-text-main">
                أحسنت يا {studentName}! 🎉
              </h2>
              <p className="text-xs font-bold text-primary">{gradeLabel}</p>
            </div>

            {submitting ? (
              <p className="text-xs font-bold text-text-muted animate-pulse">جاري تأكيد حفظ النتيجة...</p>
            ) : (
              finalScore && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border">
                    <div className="text-xl font-bold text-primary">{finalScore.scorePercentage}%</div>
                    <div className="text-[11px] font-medium text-text-muted mt-0.5">التقييم العام</div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border">
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {finalScore.correctAnswersCount} / {finalScore.totalQuestions}
                    </div>
                    <div className="text-[11px] font-medium text-text-muted mt-0.5">إجابات صحيحة</div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border">
                    <div className="text-xl font-bold text-amber-500">💰 {finalScore.goldEarned ?? gold}</div>
                    <div className="text-[11px] font-medium text-text-muted mt-0.5">النقاط</div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border">
                    <div className="text-xl font-bold text-primary">🔥 {finalScore.maxStreak ?? maxStreak}</div>
                    <div className="text-[11px] font-medium text-text-muted mt-0.5">أطول سلسلة</div>
                  </div>
                </div>
              )
            )}

            {/* Earned Bonus Cards Summary (when unlocked via 10-answer streak) */}
            {((finalScore?.gamification?.bonusHistory || gamification.bonusHistory) || []).length > 0 && (
              <div className="text-right space-y-1.5 pt-1">
                <h3 className="text-xs font-bold text-text-main">🃏 بطاقات المكافآت المكتسبة:</h3>
                <div className="flex flex-wrap gap-1.5">
                  {((finalScore?.gamification?.bonusHistory || gamification.bonusHistory) as any[]).map(
                    (cardItem: any, idx: number) => (
                      <span
                        key={cardItem.roundId || idx}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs font-bold text-amber-700 dark:text-amber-300"
                      >
                        {cardItem.titleAr} ({cardItem.effectSummaryAr})
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Detailed Question Review */}
            <div className="text-right space-y-2 pt-2">
              <h3 className="text-xs font-bold text-text-main">
                مراجعة الإجابات ({(finalScore?.responses || responses).length}):
              </h3>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                {(finalScore?.responses || responses).map((r: HomeworkQuestionResponse, i: number) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium ${
                      r.isCorrect
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-500/5 border-rose-500/20 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => speakGermanText(r.germanWord, 0.9)}
                        className="p-1 rounded-md bg-surface border border-surface-border text-text-main cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <div>
                        <div className="font-bold text-text-main">{r.germanWord}</div>
                        <div className="text-[11px] text-text-muted">إجابتك: {r.studentAnswer}</div>
                      </div>
                    </div>
                    <div>
                      {r.pendingServerGrading && !r.isCorrect ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">⏳ بانتظار التصحيح</span>
                      ) : r.isCorrect ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ صحيح</span>
                      ) : r.correctAnswer ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">الصواب: {r.correctAnswer}</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">✕ غير صحيحة</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {assignment?.allowReplay !== false &&
              !(
                typeof assignment?.maxAttempts === 'number' &&
                assignment.maxAttempts > 0 &&
                Math.max(currentAttemptNumber, studentCompletedAttempts.length) >= assignment.maxAttempts
              ) && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (advanceTimeoutRef.current) {
                      clearTimeout(advanceTimeoutRef.current);
                      advanceTimeoutRef.current = null;
                    }
                    clearActiveHomeworkSession(assignmentId);
                    const nextAttempt = Math.max(currentAttemptNumber + 1, studentCompletedAttempts.length + 1);
                    isSubmittingRef.current = false;
                    lastSyncedAnsweredCountRef.current = 0;
                    setSubmissionConflictError(null);
                    activeSubmissionIdRef.current = buildDeterministicSubmissionId(
                      assignmentId,
                      audienceMode === 'group' ? selectedStudentId : undefined,
                      studentName.trim(),
                      nextAttempt,
                      audienceMode === 'open' ? resolvedOpenPid : undefined
                    );
                    hasSentStartRef.current = activeSubmissionIdRef.current;
                    const freshGam = createInitialGamificationState(
                      quizQuestions.length,
                      assignment?.timeLimitMinutes
                    );
                    processedQuestionIdsRef.current = new Set();
                    pendingPostBonusRef.current = null;
                    setActiveOverlayRound(null);
                    latestResponsesRef.current = [];
                    setCurrentAttemptNumber(nextAttempt);
                    setCurrentIdx(0);
                    setStudyIndex(0);
                    setResponses([]);
                    syncGamificationState(freshGam);
                    setFinalScore(null);
                     const nowIso = new Date().toISOString();
                    setStartTime(nowIso);
                    // Q3: retry goes straight to the quiz, skipping the study phase.
                    const replayPhase = 'quiz' as const;
                    const replayAttemptSecret = getOrCreateStudentAttemptSecret(activeSubmissionIdRef.current);
                    const replayStartSubmission: HomeworkSubmission = {
                      id: activeSubmissionIdRef.current,
                      assignmentId,
                      ...(assignment?.title ? { assignmentTitle: assignment.title } : {}),
                      ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
                      attemptSecret: replayAttemptSecret,
                      audienceMode,
                      studentId: audienceMode === 'group' ? selectedStudentId || undefined : undefined,
                      participantId: audienceMode === 'open' ? resolvedOpenPid || undefined : undefined,
                      groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
                      ...(audienceMode === 'group' && assignment?.groupName ? { groupName: assignment.groupName } : {}),
                      studentName: studentName.trim(),
                      attemptNumber: nextAttempt,
                      status: 'in_progress',
                      startedAt: nowIso,
                      completedAt: '',
                      updatedAt: nowIso,
                      timeSpentSeconds: 0,
                      totalQuestions: quizQuestions.length || assignment?.questionCount || 0,
                      correctAnswersCount: 0,
                      scorePercentage: 0,
                      accuracyPercent: 0,
                      score: 0,
                      accuracy: 0,
                      goldEarned: 0,
                      maxStreak: 0,
                      completedStudyPhase: true,
                      gamification: toGamificationSnapshot(freshGam),
                      responses: []
                    };
                    setCloudSyncState('syncing');
                    saveSubmissionWithConfirmation(replayStartSubmission, assignment)
                      .then((res) => {
                        setCloudSyncState(res.cloudSynced ? 'synced' : 'pending_retry');
                      })
                      .catch(() => {
                        setCloudSyncState('pending_retry');
                      });
                    saveActiveHomeworkSession({
                      version: 1,
                      assignmentId,
                      submissionId: activeSubmissionIdRef.current,
                      attemptNumber: nextAttempt,
                      studentName: studentName.trim(),
                      selectedStudentId: audienceMode === 'group' ? selectedStudentId : '',
                      openParticipantId: audienceMode === 'open' ? resolvedOpenPid : '',
                      phase: replayPhase,
                      studyIndex: 0,
                      currentIdx: 0,
                      completedStudyPhase: true,
                      startTime: nowIso,
                      responses: [],
                      gamification: freshGam,
                      updatedAtMs: Date.now()
                    });
                    setCompletedStudyPhase(true);
                    setRetryQuestions(null);
                    setRetryRoundDone(false);
                    setTimeUpDialog(false);
                    setUntimedMode(false);
                    setPhase(replayPhase);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-primary" />
                  <span>إعادة المحاولة لتحسين النتيجة</span>
                </button>
              </div>
            )}
            <p className="text-[11px] text-text-muted pt-1 select-none" dir="ltr">
              Herr Abdul-rahman · Glück Deutschunterricht
            </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 2: MULTI-STAGE QUIZ & EVALUATION (7 Progressive Stages + Icon-Only Stage Bar)
  // ============================================================================
  const hasStudyStage = totalStudySteps > 0;
  const currentStageIdx = currentQuestion?.stageIndex ?? 0;
  const quizStageBarItems = [
    ...(hasStudyStage
      ? [{ key: 'study', icon: '📖', title: '1. التعلم والنطق (Lernen)', isActive: false, isDone: true }]
      : []),
    ...activeQuestionTypes.map((qt, idx) => {
      const meta = getQuestionTypeMeta(qt);
      return {
        key: qt,
        icon: meta?.badgeEmoji || '🎯',
        title: `${hasStudyStage ? idx + 2 : idx + 1}. ${meta?.labelAr || qt}`,
        isActive: idx === currentStageIdx,
        isDone: idx < currentStageIdx
      };
    })
  ];

  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col p-4 sm:p-6 font-sans" dir="rtl">
      <gameEffects.EffectsOverlay />

      {activeOverlayRound && (
        <HomeworkBonusCardOverlay
          round={activeOverlayRound}
          animationIntensity={gameEffects.intensity}
          onPickCard={handlePickBonusCard}
          onCompleteRound={handleBonusRoundComplete}
          onTriggerSparkles={gameEffects.triggerSparkles}
        />
      )}

      {/* Slim Brand & Assignment Strip */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between gap-2 mb-2.5 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeacherCrestLogo size="sm" />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-text-main truncate">
              {assignment?.title || 'واجب Glück التفاعلي'}
            </p>
            <p className="text-[11px] text-text-muted truncate" dir="ltr">
              Herr Abdul-rahman · Glück
            </p>
          </div>
        </div>
        {studentName && (
          <span className="text-xs font-semibold text-text-muted whitespace-nowrap shrink-0">
            {studentName}
          </span>
        )}
      </div>

      {/* Compact, Always-Visible Top HUD (Timer, Points, Streak/10, Effects & Mute) */}
      {renderCompactGamificationHud(false)}

      {/* Q20: visible low-time warning (beyond the red HUD pulse under 20s) */}
      {!retryQuestions && !untimedMode && gamification.timeRemainingSeconds <= 30 && gamification.timeRemainingSeconds > 0 && (
        <div className="max-w-3xl w-full mx-auto mb-2.5 p-3 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-black text-center animate-pulse flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>⏰ انتبه! باقي {gamification.timeRemainingSeconds} ثانية بس — خلّص إجابتك بسرعة قبل ما الوقت يخلص!</span>
        </div>
      )}

      {/* Q25: practice retry round banner — wrong questions return at the very end */}
      {retryQuestions && (
        <div className="max-w-3xl w-full mx-auto mb-2.5 p-3 rounded-2xl bg-sky-500/10 border border-sky-500/40 text-sky-700 dark:text-sky-300 text-xs font-black text-center leading-relaxed">
          🔁 جولة تدريب أخيرة — دي الأسئلة اللي غلطت فيها، جرّب تحلّها تاني. إجاباتك هنا للتدريب بس ومش بتأثر على نتيجتك ولا نقاطك.
        </div>
      )}

      {/* Q20: confirm before finishing when the timer runs out */}
      {timeUpDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-surface border border-surface-border rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-xl">
            <div className="text-4xl">⏰</div>
            <h3 className="text-lg font-black text-text-main">انتهى الوقت!</h3>
            <p className="text-xs font-bold text-text-muted leading-relaxed">
              خلص وقت الواجب. تقدر تنهي دلوقتي وتبعت إجاباتك اللي حلّيتها، أو تكمّل باقي الأسئلة من غير مؤقت — بس الأسئلة اللي مش هتجاوبها هتفضل مش محلولة.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setTimeUpDialog(false);
                  handleFinishHomework(
                    latestResponsesRef.current,
                    gamificationRef.current.points,
                    gamificationRef.current.maxStreak
                  );
                }}
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs sm:text-sm shadow-md cursor-pointer transition-colors"
              >
                إنهاء الواجب وإرسال الإجابات ✓
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeUpDialog(false);
                  setUntimedMode(true);
                }}
                className="w-full py-3 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs sm:text-sm cursor-pointer transition-colors"
              >
                أكمّل باقي الأسئلة من غير مؤقت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Icon-Only Sequential Stage Bar (Zero Horizontal Side-Scrolling) */}
      <div className="max-w-3xl w-full mx-auto bg-surface border border-surface-border rounded-2xl p-1.5 mb-2.5 shadow-2xs">
        <div className="flex items-center gap-1 w-full">
          {quizStageBarItems.map((stg) => (
            <div
              key={stg.key}
              title={stg.title}
              aria-label={stg.title}
              className={`flex-1 h-9 rounded-xl text-sm sm:text-base font-black transition-all flex items-center justify-center border select-none ${
                stg.isActive
                  ? 'bg-primary text-white border-primary shadow-xs scale-[1.03]'
                  : stg.isDone
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-surface-hover/60 text-text-muted border-surface-border opacity-70'
              }`}
            >
              <span>{stg.isDone ? '✓' : stg.icon}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stage Sub-Header & Student Name */}
      <div className="max-w-3xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span className="px-3 py-1 rounded-lg bg-surface border border-surface-border text-primary text-xs font-bold shadow-2xs">
          {currentQuestion?.stageBadgeEmoji} {currentQuestion?.stageLabelAr}
        </span>
        <span className="text-xs font-medium text-text-muted">👤 {studentName}</span>
      </div>

      {/* Progress Bar */}
      <div className="max-w-3xl w-full mx-auto h-2 bg-surface-border rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / Math.max(1, activeQuizQuestions.length)) * 100}%` }}
        />
      </div>

      {/* Question Card & Interactive Stage Controls */}
      {currentQuestion && (
        <div className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto space-y-4">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-surface-border p-5 sm:p-7 rounded-2xl text-center space-y-3.5 shadow-xs relative"
          >
            <p className="text-xs font-bold text-primary">{currentQuestion.promptTitleAr}</p>

            {currentQuestion.emoji && (
              <div className="text-4xl sm:text-5xl select-none">{currentQuestion.emoji}</div>
            )}

            {currentQuestion.type === 'listen_choose' ? (
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => speakGermanText(currentQuestion.germanWord, 0.85)}
                  className="px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-sm inline-flex items-center gap-2.5 shadow-xs cursor-pointer transition-all"
                >
                  <Volume2 className="w-5 h-5 animate-pulse" />
                  <span>🔊 اضغط للاستماع للكلمة</span>
                </button>
              </div>
            ) : currentQuestion.type === 'true_false' ? (
              <div className="space-y-2 py-1">
                <div
                  className="text-2xl sm:text-3xl font-black text-text-main leading-snug"
                  dir="rtl"
                >
                  {currentQuestion.promptMainText}
                </div>
                {currentQuestion.promptSubText && (
                  <div
                    className="text-2xl sm:text-3xl font-black text-primary leading-snug"
                    dir="ltr"
                  >
                    {currentQuestion.promptSubText}
                  </div>
                )}
              </div>
            ) : (
              <h2
                className="text-xl sm:text-3xl font-bold text-text-main tracking-wide"
                dir={currentQuestion.hideGermanText ? 'rtl' : 'ltr'}
              >
                {currentQuestion.promptMainText}
              </h2>
            )}

            {currentQuestion.type !== 'true_false' && currentQuestion.promptSubText && (
              <div className="py-2 px-4 rounded-xl bg-surface-hover border border-surface-border inline-block">
                <p className="text-base sm:text-xl font-bold text-primary">{currentQuestion.promptSubText}</p>
              </div>
            )}

            {/* Stage 5: Syllables Slot Boxes */}
            {currentQuestion.type === 'syllables' && currentQuestion.expectedSyllables && (
              <div className="pt-2 pb-1 flex items-center justify-center gap-2 font-mono text-xl sm:text-2xl font-black tracking-wider flex-wrap" dir="ltr">
                {currentQuestion.article && (
                  <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                    {currentQuestion.article}
                  </span>
                )}
                {currentQuestion.expectedSyllables.map((_, i) => {
                  const filledSyl = filledSlots[i];
                  const isCurrentTarget = i === multiStepIdx && selectedChoice === null;
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center justify-center px-3.5 h-11 sm:h-13 min-w-[3.5rem] rounded-xl border-2 font-black transition-all ${
                        filledSyl
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs scale-105'
                          : isCurrentTarget
                          ? 'bg-amber-500/10 border-amber-500 border-dashed text-amber-500 animate-pulse scale-105'
                          : 'bg-surface-hover/50 border-dashed border-surface-border text-text-muted'
                      }`}
                    >
                      {filledSyl || '...'}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Stage 6: Missing 1 Letter Character Boxes */}
            {currentQuestion.type === 'missing_letter' && currentQuestion.chars && (
              <div className="pt-2 pb-1 flex items-center justify-center gap-1.5 font-mono text-2xl sm:text-3xl font-black tracking-wider flex-wrap" dir="ltr">
                {currentQuestion.article && (
                  <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                    {currentQuestion.article}
                  </span>
                )}
                {currentQuestion.chars.map((ch, i) => {
                  const isMissing = i === currentQuestion.missingIndex;
                  if (isMissing) {
                    const isRight =
                      selectedChoice !== null &&
                      selectedChoice.toUpperCase() === (currentQuestion.missingChar || '').toUpperCase();
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center w-9 h-11 sm:w-11 sm:h-13 rounded-xl border-2 border-dashed font-black transition-all ${
                          selectedChoice !== null
                            ? isRight
                              ? 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-xs'
                              : 'bg-rose-500 text-white border-rose-500'
                            : 'bg-primary/10 border-primary text-primary animate-pulse'
                        }`}
                      >
                        {selectedChoice !== null ? selectedChoice : '_'}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-8 h-10 sm:w-10 sm:h-12 bg-surface-hover/80 text-text-main rounded-xl border border-surface-border"
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Stage 7: Missing Consecutive Letters Character Boxes */}
            {currentQuestion.type === 'missing_two_letters' && currentQuestion.chars && currentQuestion.missingIndices && (
              <div className="pt-2 pb-1 flex items-center justify-center gap-1.5 font-mono text-2xl sm:text-3xl font-black tracking-wider flex-wrap" dir="ltr">
                {currentQuestion.article && (
                  <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                    {currentQuestion.article}
                  </span>
                )}
                {currentQuestion.chars.map((ch, i) => {
                  const isMissingSlot = currentQuestion.missingIndices!.includes(i);
                  const filledChar = filledSlots[i];
                  const isCurrentTarget =
                    currentQuestion.missingIndices![multiStepIdx] === i && selectedChoice === null;

                  if (isMissingSlot) {
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center w-9 h-11 sm:w-11 sm:h-13 rounded-xl border-2 font-black transition-all ${
                          filledChar
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                            : isCurrentTarget
                            ? 'bg-amber-500/10 border-amber-500 border-dashed text-amber-500 animate-pulse scale-105'
                            : 'bg-surface-hover/50 border-dashed border-surface-border text-text-muted'
                        }`}
                      >
                        {filledChar || '_'}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-8 h-10 sm:w-10 sm:h-12 bg-surface-hover/80 text-text-main rounded-xl border border-surface-border"
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Stage 8: Full Word Character Boxes */}
            {currentQuestion.type === 'full_word' && currentQuestion.chars && (
              <div className="pt-2 pb-1 flex items-center justify-center gap-1.5 font-mono text-2xl sm:text-3xl font-black tracking-wider flex-wrap" dir="ltr">
                {currentQuestion.article && (
                  <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                    {currentQuestion.article}
                  </span>
                )}
                {currentQuestion.chars.map((_, slotIdx) => {
                  const filledChar = filledSlots[slotIdx];
                  const isCurrentTarget = multiStepIdx === slotIdx && selectedChoice === null;
                  const hasSpaceBefore = Boolean(
                    currentQuestion.spaceBeforeIndices?.includes(slotIdx)
                  );
                  return (
                    <span
                      key={slotIdx}
                      className={`inline-flex items-center justify-center w-9 h-11 sm:w-11 sm:h-13 rounded-xl border-2 font-black transition-all ${
                        hasSpaceBefore ? 'ml-2.5' : ''
                      } ${
                        filledChar
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                          : isCurrentTarget
                          ? 'bg-primary/10 border-primary border-dashed text-primary animate-pulse scale-105'
                          : 'bg-surface-hover/40 border-dashed border-surface-border text-text-muted'
                      }`}
                    >
                      {filledChar || '_'}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Audio Pronunciation Helper */}
            {currentQuestion.type !== 'true_false' && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => speakGermanText(currentQuestion.audioPromptText || currentQuestion.germanWord, 0.9)}
                  className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  <span>استمع</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakGermanText(currentQuestion.audioPromptText || currentQuestion.germanWord, 0.55)}
                  className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-text-muted hover:text-text-main font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Snail className="w-3.5 h-3.5" />
                  <span>بطيء</span>
                </button>
              </div>
            )}

            {selectedChoice !== null && currentQuestion.explanation && (
              <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/25 text-xs text-text-main font-medium text-right">
                <span className="font-bold text-primary">📘 التفسير: </span>
                <span>{currentQuestion.explanation}</span>
              </div>
            )}
          </motion.div>

          {/* Answer Options by Stage Type */}
          {currentQuestion.type === 'true_false' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedChoice === opt;
                const isRightOption = opt === currentQuestion.correctAnswer;
                const isTrueBtn = idx === 0;

                let btnStyle = 'bg-surface hover:bg-surface-hover border-surface-border text-text-main';

                if (selectedChoice !== null) {
                  if (isRightOption) {
                    btnStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400';
                  } else {
                    btnStyle = 'bg-surface border-surface-border opacity-40';
                  }
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={selectedChoice !== null}
                    onClick={() => handleSelectOption(opt)}
                    className={`p-4 rounded-xl border font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${btnStyle}`}
                  >
                    {isTrueBtn ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          ) : currentQuestion.type === 'grammar_exercise' &&
            currentQuestion.grammarType === 'sentence_ordering' &&
            Array.isArray(currentQuestion.tileChoices) &&
            currentQuestion.tileChoices.length > 0 ? (
            <div className="space-y-3">
              <div
                dir="ltr"
                className="min-h-14 p-3 rounded-xl bg-surface border border-surface-border flex flex-wrap items-center justify-center gap-2"
              >
                {grammarOrderedTiles.length === 0 ? (
                  <span className="text-xs text-text-muted">اضغط على الكلمات بالأسفل لترتيب الجملة...</span>
                ) : (
                  grammarOrderedTiles.map((tok, tIdx) => (
                    <button
                      key={`${tok.id}_${tIdx}`}
                      type="button"
                      disabled={selectedChoice !== null}
                      onClick={() =>
                        setGrammarOrderedTiles((prev) => prev.filter((_, idx) => idx !== tIdx))
                      }
                      className="px-3 py-1.5 rounded-lg bg-primary text-white font-bold text-sm cursor-pointer"
                    >
                      {tok.text}
                    </button>
                  ))
                )}
              </div>
              <div dir="ltr" className="flex flex-wrap items-center justify-center gap-2">
                {currentQuestion.tileChoices.map((tile) => {
                  const used = grammarOrderedTiles.some((t) => t.id === tile.id);
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      disabled={used || selectedChoice !== null}
                      onClick={() => setGrammarOrderedTiles((prev) => [...prev, tile])}
                      className={`px-3.5 py-2 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                        used
                          ? 'opacity-30 bg-surface-hover border-surface-border cursor-not-allowed'
                          : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main hover:border-primary/40'
                      }`}
                    >
                      {tile.text}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  disabled={selectedChoice !== null || grammarOrderedTiles.length === 0}
                  onClick={() => setGrammarOrderedTiles([])}
                  className="px-4 py-2.5 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-muted disabled:opacity-40 cursor-pointer"
                >
                  إعادة
                </button>
                <button
                  type="button"
                  disabled={selectedChoice !== null || checkingRemoteAnswer || grammarOrderedTiles.length === 0}
                  onClick={() =>
                    handleSelectOption(grammarOrderedTiles.map((t) => t.text).join(' '))
                  }
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  {checkingRemoteAnswer ? 'جاري التحقق...' : 'تحقق من الجملة ✓'}
                </button>
              </div>
            </div>
          ) : currentQuestion.type === 'grammar_exercise' &&
            (currentQuestion.grammarType === 'short_answer' || currentQuestion.options.length === 0) ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (grammarTypedInput.trim()) {
                  handleSelectOption(grammarTypedInput.trim());
                }
              }}
              className="space-y-3 max-w-md mx-auto w-full"
            >
              <input
                type="text"
                dir="ltr"
                disabled={selectedChoice !== null}
                value={grammarTypedInput}
                onChange={(e) => setGrammarTypedInput(e.target.value)}
                placeholder="اكتب الإجابة الصحيحة بالألمانية هنا..."
                className="w-full px-4 py-3 rounded-xl bg-surface border border-surface-border focus:border-primary text-text-main font-bold text-base text-center outline-none"
              />
              {selectedChoice !== null && currentQuestion.correctAnswer && (
                <div className="text-xs font-bold text-center text-emerald-600 dark:text-emerald-400">
                  الإجابة النموذجية: <span dir="ltr">{currentQuestion.correctAnswer}</span>
                </div>
              )}
              {selectedChoice !== null && !currentQuestion.correctAnswer && feedback !== null && (
                <div
                  className={`text-xs font-bold text-center ${
                    feedback === 'correct'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : feedback === 'submitted'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {feedback === 'correct'
                    ? '✓ إجابة صحيحة!'
                    : feedback === 'submitted'
                    ? '✓ تم تسجيل إجابتك للمراجعة السحابية'
                    : '✕ إجابة غير صحيحة'}
                </div>
              )}
              <button
                type="submit"
                disabled={selectedChoice !== null || checkingRemoteAnswer || !grammarTypedInput.trim()}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-bold text-sm cursor-pointer shadow-xs"
              >
                {checkingRemoteAnswer ? 'جاري التحقق...' : 'تحقق من الإجابة ✓'}
              </button>
            </form>
          ) : currentQuestion.type === 'missing_letter' ? (
            <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md mx-auto">
              {currentQuestion.options.map((choiceChar, idx) => {
                const isSelected = selectedChoice === choiceChar;
                const isRightOption = choiceChar.toUpperCase() === currentQuestion.correctAnswer.toUpperCase();

                let btnStyle = 'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40';
                if (selectedChoice !== null) {
                  if (isRightOption) {
                    btnStyle = 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-xs';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-500 text-white border-rose-500';
                  } else {
                    btnStyle = 'bg-surface border-surface-border opacity-40';
                  }
                }

                return (
                  <button
                    key={`${choiceChar}_${idx}`}
                    type="button"
                    disabled={selectedChoice !== null}
                    onClick={() => handleSelectOption(choiceChar)}
                    className={`w-12 h-13 sm:w-14 sm:h-15 rounded-2xl text-xl sm:text-2xl font-black font-mono border transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95 ${btnStyle}`}
                  >
                    {choiceChar}
                  </button>
                );
              })}
            </div>
          ) : currentQuestion.type === 'syllables' ||
            currentQuestion.type === 'missing_two_letters' ||
            currentQuestion.type === 'full_word' ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md mx-auto">
                {(currentQuestion.tileChoices || []).map((tile) => {
                  const isUsed = usedTileIds.includes(tile.id);
                  const isError = errorTileId === tile.id;
                  const isSyllable = currentQuestion.type === 'syllables';

                  return (
                    <button
                      key={tile.id}
                      type="button"
                      disabled={isUsed || selectedChoice !== null}
                      onClick={() => handleTileClick(tile)}
                      dir="ltr"
                      className={`${
                        isSyllable ? 'px-4 h-12 sm:h-14 text-lg sm:text-xl' : 'w-12 h-13 sm:w-14 sm:h-15 text-xl sm:text-2xl'
                      } rounded-2xl font-black font-mono border transition-all cursor-pointer flex items-center justify-center shadow-2xs ${
                        isUsed
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 opacity-40 cursor-not-allowed'
                          : isError
                          ? 'bg-rose-500 text-white border-rose-500 animate-bounce'
                          : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40 active:scale-95'
                      }`}
                    >
                      {tile.text}
                    </button>
                  );
                })}
              </div>
              {selectedChoice !== null && feedback === 'wrong' && (
                <div className="text-xs font-bold text-center text-rose-600 dark:text-rose-400 pt-1">
                  ✕ إجابة غير صحيحة — الكلمة الصحيحة: <span dir="ltr">{currentQuestion.germanWord}</span>
                </div>
              )}
            </>
          ) : (
            <div
              className={`grid gap-2.5 ${
                currentQuestion.type === 'choice_all'
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : currentQuestion.options.length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}
            >
              {currentQuestion.options.map((choice, idx) => {
                const isSelected = selectedChoice === choice;
                const hasKnownAnswerKey = Boolean(currentQuestion.correctAnswer);
                const isRightOption = hasKnownAnswerKey
                  ? currentQuestion.type === 'grammar_exercise'
                    ? evaluateNormalizedGrammarAnswer(choice, {
                        correctAnswer: currentQuestion.correctAnswer,
                        acceptedAnswers: currentQuestion.acceptedAnswers
                      })
                    : choice.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()
                  : isSelected && feedback === 'correct';

                let btnStyle = 'bg-surface hover:bg-surface-hover border-surface-border text-text-main';
                if (selectedChoice !== null) {
                  if (hasKnownAnswerKey) {
                    if (isRightOption) {
                      btnStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30';
                    } else if (isSelected) {
                      btnStyle = 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400';
                    } else {
                      btnStyle = 'bg-surface border-surface-border opacity-40';
                    }
                  } else if (isSelected) {
                    btnStyle =
                      feedback === 'correct'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30'
                        : feedback === 'submitted'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                        : feedback === 'wrong'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                        : 'bg-primary/10 border-primary text-primary';
                  } else {
                    btnStyle = 'bg-surface border-surface-border opacity-45';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={selectedChoice !== null || checkingRemoteAnswer}
                    onClick={() => handleSelectOption(choice)}
                    dir="auto"
                    className={`p-3.5 rounded-xl border font-bold text-sm sm:text-base text-center transition-all flex items-center justify-between gap-2.5 cursor-pointer active:scale-95 shadow-2xs ${btnStyle}`}
                  >
                    <span className="flex-1 text-center truncate">{choice}</span>
                    {selectedChoice !== null && isRightOption && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {selectedChoice !== null && isSelected && feedback === 'wrong' && !isRightOption && (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
