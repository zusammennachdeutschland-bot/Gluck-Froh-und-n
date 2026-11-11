import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Volume2,
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
  RefreshCw
} from 'lucide-react';
import { speakGermanText } from '../shared/audioSpeechUtils';
import { fetchHomeworkApi } from '../shared/firebaseCloudSync';
import { playLernstudioSound, playGermanVoiceFeedback } from '../shared/lernstudioAudioUtils';
import {
  HomeworkAssignment,
  HomeworkAudienceMode,
  HomeworkQuestionResponse,
  HomeworkQuestionType,
  HomeworkFlowMode,
  HomeworkSubmission,
  DEFAULT_HOMEWORK_QUESTION_TYPES
} from '../shared/homeworkTypes';
import { DEFAULT_LERNSTUDIO_SETS } from '../shared/defaultLernstudioSets';
import {
  getLocalAssignments,
  getStudentLocalSubmissions,
  saveLocalAssignment,
  saveLocalSubmission,
  getQuestionTypeMeta,
  fetchLernstudioSetFromFirestore,
  saveAssignmentToFirestore,
  subscribeSubmissionsFromFirestore,
  buildDeterministicSubmissionId,
  getOrCreateStudentAttemptSecret,
  isHomeworkAssignmentOpenForStudents,
  getCurrentHomeworkOwnerUid,
  saveSubmissionWithConfirmation,
  flushPendingHomeworkCloudWrites,
  resolveAssignmentAudienceMode,
  getAuthorizedGroupStudentsForAssignment,
  normalizeHomeworkAssignment,
  getOrCreateOpenParticipantId,
  validateHomeworkSubmissionIdentity,
  resolveStageQuestionCount,
  calculateTotalHomeworkQuestions,
  parseQuestionTypeCountsParam
} from '../shared/homeworkStorageSync';
import {
  splitGermanIntoSyllables,
  splitGermanArticleAndWord
} from '../shared/components/LernstudioTeachModal';

interface Props {
  assignmentId?: string;
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
  tileChoices?: HomeworkTileChoice[];
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

export const HomeworkPlayerPage: React.FC<Props> = ({ assignmentId: propId }) => {
  const assignmentId =
    propId ||
    window.location.pathname.replace(/^\/homework\/?/, '').split('/')[0] ||
    '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<HomeworkAssignment | null>(null);
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
  const [, setFeedback] = useState<'correct' | 'wrong' | null>(null);
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

  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<any | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<'idle' | 'syncing' | 'synced' | 'pending_retry'>('idle');
  const [retryingCloudSync, setRetryingCloudSync] = useState(false);
  const activeSubmissionIdRef = React.useRef<string>('sub_' + Math.random().toString(36).substring(2, 9));
  const isSubmittingRef = React.useRef<boolean>(false);

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

  // Subscribe to live Firestore class leaderboard only when authenticated as the owning teacher
  useEffect(() => {
    if (!assignmentId) return;
    const activeTeacherUid = getCurrentHomeworkOwnerUid();
    if (!activeTeacherUid || (assignment?.ownerUid && assignment.ownerUid !== activeTeacherUid)) {
      return;
    }
    const unsub = subscribeSubmissionsFromFirestore(
      assignmentId,
      (subs) => {
        setAllSubmissions(subs);
        if (subs.length > 0) {
          const sorted = [...subs]
            .sort(
              (a, b) =>
                (b.goldEarned || 0) - (a.goldEarned || 0) ||
                (b.scorePercentage || b.accuracyPercent || 0) - (a.scorePercentage || a.accuracyPercent || 0)
            )
            .slice(0, 15)
            .map((s) => ({
              studentName: s.studentName,
              scorePercentage: s.scorePercentage ?? s.accuracyPercent ?? s.accuracy ?? 0,
              correctAnswersCount: s.correctAnswersCount ?? s.score ?? 0,
              totalQuestions: s.totalQuestions || 10,
              timeSpentSeconds: s.timeSpentSeconds || 0,
              goldEarned: s.goldEarned ?? (s.correctAnswersCount || s.score || 0) * 100
            }));
          setLeaderboard(sorted);
        }
      },
      activeTeacherUid
    );
    return () => unsub();
  }, [assignmentId, assignment?.ownerUid]);

  // Load Assignment (Primary: Firebase Firestore -> Secondary: API -> Fallback: Local/URL for open mode only)
  useEffect(() => {
    async function loadHomework() {
      try {
        setLoading(true);
        setError(null);

        const searchParams = new URLSearchParams(window.location.search);
        const urlQtc = parseQuestionTypeCountsParam(searchParams.get('qtc'));
        const hasUrlQtc = Object.keys(urlQtc).length > 0;

        // Public student access always goes through the authoritative server API.
        // Firestore client rules intentionally restrict direct assignment reads to the owning teacher.
        const shareToken = (searchParams.get('token') || '').trim();
        const infoParams = new URLSearchParams({ id: assignmentId });
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

          if (res.status === 403) {
            setError(data?.error || 'هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
            return;
          }

          if (res.ok && data && data.setSnapshot) {
            if (!isHomeworkAssignmentOpenForStudents(data)) {
              setError('هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
              return;
            }
            const mergedApi =
              !data.questionTypeCounts && hasUrlQtc
                ? { ...data, questionTypeCounts: urlQtc }
                : data;
            const normalized = normalizeHomeworkAssignment(mergedApi);
            setAssignment(normalized);
            if (Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
              setLeaderboard(data.leaderboard);
            }
            return;
          }
        }

        // Never use stale local data when the authoritative API is unreachable or fails.
        // This is especially important after a teacher deletes an assignment.
        if (!res) {
          setError('تعذر الاتصال بخادم الواجبات. اتصل بالإنترنت ثم أعد فتح الرابط.');
          return;
        }
        if (!res.ok && res.status !== 404) {
          setError(data?.error || 'تعذر التحقق من حالة الواجب على الخادم. حاول مرة أخرى.');
          return;
        }

        // A tokenized share link must never fall back to local or URL-reconstructed data.
        // Otherwise a server failure could accidentally bypass the share-token gate.
        if (shareToken) {
          setError(data?.error || 'تعذر تحميل الواجب من الخادم. تحقق من اتصال الإنترنت أو أعد إرسال رابط المشاركة.');
          return;
        }

        // 3. Check local assignments cache
        const localFound = getLocalAssignments().find((a) => a.id === assignmentId);
        if (localFound && localFound.setSnapshot) {
          if (!isHomeworkAssignmentOpenForStudents(localFound)) {
            setError('هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.');
            return;
          }
          const mergedLocal =
            !localFound.questionTypeCounts && hasUrlQtc
              ? { ...localFound, questionTypeCounts: urlQtc }
              : localFound;
          setAssignment(normalizeHomeworkAssignment(mergedLocal));
          return;
        }

        // 4. Fallback: Parse query parameters from share URL (ONLY allowed for 'open' assignments)
        const amParam = searchParams.get('am');
        const gidParam = searchParams.get('gid');

        // CRITICAL: Never construct a group-less open fallback assignment when the link belongs to a specific group!
        if (amParam === 'group' || (gidParam && gidParam !== 'all')) {
          setError(
            'هذا الواجب مخصص لمجموعة محددة، وتعذر تحميل قائمة طلاب المجموعة حالياً. يرجى التحقق من اتصال الإنترنت أو التواصل مع المعلم.'
          );
          return;
        }

        const setId = searchParams.get('s');
        if (setId) {
          const titleParam = searchParams.get('t') || 'واجب منزلي تفاعلي';
          const flowModeParam: HomeworkFlowMode = 'teacher_then_quiz';
          const qtParam = searchParams.get('qt');
          const questionTypesParam = qtParam
            ? (qtParam.split(',') as HomeworkQuestionType[])
            : [...DEFAULT_HOMEWORK_QUESTION_TYPES];
          const idsParam = searchParams.get('ids');
          const selectedIds = idsParam ? idsParam.split(',') : [];

          let foundSet: any = DEFAULT_LERNSTUDIO_SETS.find((st) => st.id === setId) || null;
          if (!foundSet) {
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
          if (!foundSet) {
            foundSet = await fetchLernstudioSetFromFirestore(setId).catch(() => null);
          }

          if (foundSet && Array.isArray(foundSet.items) && foundSet.items.length > 0) {
            const items = selectedIds.length > 0
              ? foundSet.items.filter((it: any) => selectedIds.includes(it.id))
              : foundSet.items;
            const resolvedFallbackItems = items.length > 0 ? items : foundSet.items;
            const resolvedTotalQ = calculateTotalHomeworkQuestions(
              resolvedFallbackItems.length,
              questionTypesParam,
              hasUrlQtc ? urlQtc : undefined
            );

            const fallbackHw: HomeworkAssignment = {
              id: assignmentId,
              title: titleParam,
              audienceMode: 'open',
              setSnapshot: {
                id: foundSet.id,
                title: foundSet.title,
                category: (foundSet as any).category || foundSet.topic || '',
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
            setAssignment(fallbackHw);
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
  }, [assignmentId]);

  // Active vocabulary items selected by the teacher
  const studyItems = useMemo(() => {
    if (!assignment?.setSnapshot?.items) return [];
    const all: any[] = assignment.setSnapshot.items;
    if (Array.isArray(assignment.selectedItemIds) && assignment.selectedItemIds.length > 0) {
      const filtered = all.filter((it) => assignment.selectedItemIds.includes(it.id));
      if (filtered.length > 0) return filtered;
    }
    return all;
  }, [assignment]);

  // Active question types ordered as stored on the assignment (or all 7 stages by default)
  const activeQuestionTypes = useMemo<HomeworkQuestionType[]>(() => {
    if (Array.isArray(assignment?.questionTypes) && assignment.questionTypes.length > 0) {
      return assignment.questionTypes;
    }
    return [...DEFAULT_HOMEWORK_QUESTION_TYPES];
  }, [assignment?.questionTypes]);

  // Build progressive multi-stage question list based on teacher's chosen questionTypes
  const quizQuestions = useMemo<GeneratedQuizQuestion[]>(() => {
    if (studyItems.length === 0) return [];
    const allSetItems: any[] = assignment?.setSnapshot?.items || studyItems;
    const types = activeQuestionTypes;

    const list: GeneratedQuizQuestion[] = [];

    types.forEach((qType, stageIdx) => {
      const meta = getQuestionTypeMeta(qType);
      const stageTitle = `المرحلة ${stageIdx + 1}: ${meta?.labelAr || 'سؤال تفاعلي'}`;
      const stageEmoji = meta?.badgeEmoji || '🎯';

      const stageQuestionCount = resolveStageQuestionCount(
        qType,
        studyItems.length,
        assignment?.questionTypeCounts
      );

      // Select `stageQuestionCount` items deterministically, rotating start offset by stageIdx
      // so reduced question counts still test all vocabulary words evenly across stages.
      const stageItems =
        stageQuestionCount >= studyItems.length
          ? studyItems
          : Array.from({ length: stageQuestionCount }, (_, k) => {
              const rotatedIdx = (stageIdx * stageQuestionCount + k) % studyItems.length;
              return studyItems[rotatedIdx];
            });

      stageItems.forEach((item, itemIdx) => {
        const qId = `${item.id}_${qType}_${itemIdx}`;
        const otherItems = allSetItems.filter((x) => x.id !== item.id);
        const seed = stageIdx * 97 + itemIdx * 31 + (item.german?.length || 5);

        // 1. Stage: true_false (صح أم خطأ — Richtig / Falsch)
        if (qType === 'true_false') {
          const isTrue = (itemIdx + stageIdx) % 2 === 0 || otherItems.length === 0;
          const wrongItem = otherItems[(itemIdx + 1) % Math.max(1, otherItems.length)];
          const shownArabic = isTrue ? item.arabic : wrongItem?.arabic || 'المدرسة';
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
            promptTitleAr: 'هل معنى هذه الكلمة الألمانية صحيح أم خطأ؟',
            promptMainText: item.german,
            promptSubText: `المعنى المعروض: « ${shownArabic} »`,
            options: ['صح ✅ (Richtig)', 'خطأ ❌ (Falsch)'],
            correctAnswer: correctLabel
          });
          return;
        }

        // 2. Stage: choice_2 (الاختيار من 2 — Zwei Optionen)
        if (qType === 'choice_2') {
          const correctOpt = item.german;
          const distractorItem = otherItems[(itemIdx + stageIdx) % Math.max(1, otherItems.length)];
          const distractorOpt =
            distractorItem && distractorItem.german !== correctOpt
              ? distractorItem.german
              : correctOpt === 'das Buch'
              ? 'die Schule'
              : 'das Buch';
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
            promptTitleAr: 'اختر الكلمة الألمانية الصحيحة من الاختيارين:',
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
          const fallbacks = ['das Buch', 'der Apfel', 'die Schule', 'das Haus'];
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
            promptTitleAr: 'اختر الكلمة الألمانية الصحيحة من بين جميع كلمات الدرس:',
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
            promptTitleAr: 'اختر الحرف الناقص لإكمال الكلمة الألمانية:',
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
          const startIdx = maxStart > 0 ? (itemIdx + stageIdx) % (maxStart + 1) : 0;

          const missingIndices: number[] = [];
          for (let i = 0; i < seqLen; i++) {
            if (startIdx + i < len) {
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
          const chars = wordOnly.split('');
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
            promptTitleAr: 'رتب حروف الكلمة الألمانية من البداية للنهاية:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options: chars,
            correctAnswer: item.german,
            article,
            wordOnly,
            chars,
            expectedChars: chars,
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
  }, [studyItems, assignment, activeQuestionTypes]);

  const currentQuestion = quizQuestions[currentIdx];
  const currentStudyItem = studyItems[studyIndex];

  // Auto-pronounce word when entering Teacher Study card or Question
  useEffect(() => {
    if (phase === 'teacher_study' && currentStudyItem?.german) {
      const timer = setTimeout(() => {
        speakGermanText(currentStudyItem.german, 0.9);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [phase, studyIndex, currentStudyItem]);

  useEffect(() => {
    if (phase === 'quiz' && currentQuestion) {
      setQuestionStartMs(Date.now());
      setMultiStepIdx(0);
      setFilledSlots({});
      setUsedTileIds([]);
      setErrorTileId(null);
      setWrongStepsCount(0);
      const timer = setTimeout(() => {
        speakGermanText(currentQuestion.germanWord, 0.9);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [phase, currentIdx, currentQuestion]);

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

    const deterministicId = buildDeterministicSubmissionId(
      assignmentId,
      finalStudentId,
      finalStudentName,
      nextAttempt,
      finalParticipantId
    );
    activeSubmissionIdRef.current = deterministicId;
    const attemptSecret = getOrCreateStudentAttemptSecret(deterministicId);

    const nowIso = new Date().toISOString();
    setStartTime(nowIso);
    playLernstudioSound('powerup_star');

    // Immediately record the initial in-progress attempt so the teacher sees "In Progress" in real time
    const initialInProgress: HomeworkSubmission = {
      id: deterministicId,
      assignmentId,
      ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
      attemptSecret,
      audienceMode: check.audienceMode,
      studentId: finalStudentId,
      participantId: finalParticipantId,
      groupId: finalGroupId,
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

    if (studyItems.length > 0) {
      setStudyIndex(0);
      setPhase('teacher_study');
    } else {
      setCurrentIdx(0);
      setPhase('quiz');
    }
  };

  const advanceToNextQuestion = (nextResponses: HomeworkQuestionResponse[], currentGold: number, currentMaxStreak: number) => {
    setSelectedChoice(null);
    setFeedback(null);
    setMultiStepIdx(0);
    setFilledSlots({});
    setUsedTileIds([]);
    setErrorTileId(null);
    setWrongStepsCount(0);

    if (currentIdx + 1 < quizQuestions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      handleFinishHomework(nextResponses, currentGold, currentMaxStreak);
    }
  };

  const recordQuestionCompletion = (studentAnswerStr: string, isCorrect: boolean) => {
    if (!currentQuestion) return;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    let nextGold = gold;
    let nextStreak = streak;
    let nextMaxStreak = maxStreak;

    if (isCorrect) {
      nextStreak = streak + 1;
      nextMaxStreak = Math.max(maxStreak, nextStreak);
      nextGold = gold + 100 * Math.min(3, nextStreak);
      setStreak(nextStreak);
      setMaxStreak(nextMaxStreak);
      setGold(nextGold);
      playLernstudioSound('correct');
      playGermanVoiceFeedback('richtig');
    } else {
      setStreak(0);
      playLernstudioSound('wrong');
      playGermanVoiceFeedback('noch_einmal');
    }

    speakGermanText(currentQuestion.germanWord, 0.9);

    const elapsedSec = Math.max(1, Math.round((Date.now() - questionStartMs) / 1000));
    const newResponse: HomeworkQuestionResponse = {
      questionId: currentQuestion.id,
      questionType: currentQuestion.type,
      germanWord: currentQuestion.germanWord,
      promptText: `${currentQuestion.stageLabelAr} — ${currentQuestion.germanWord}`,
      studentAnswer: studentAnswerStr,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      timeSpentSeconds: elapsedSec
    };

    const nextResponses = [...responses, newResponse];
    setResponses(nextResponses);

    // Sync progress answer-by-answer in real-time to Firestore so the teacher sees live question-by-question student progress
    syncLiveProgressToFirestore(nextResponses, nextGold, nextMaxStreak);

    setTimeout(() => {
      advanceToNextQuestion(nextResponses, nextGold, nextMaxStreak);
    }, 1050);
  };

  const handleSelectOption = (chosenOption: string) => {
    if (selectedChoice !== null || !currentQuestion) return;
    setSelectedChoice(chosenOption);
    const isCorrect = chosenOption.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    recordQuestionCompletion(chosenOption, isCorrect);
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
          recordQuestionCompletion(currentQuestion.germanWord, wrongStepsCount === 0);
        } else {
          playLernstudioSound('correct');
        }
      } else {
        setWrongStepsCount((c) => c + 1);
        playLernstudioSound('wrong');
        setErrorTileId(tile.id);
        setTimeout(() => setErrorTileId(null), 550);
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
          recordQuestionCompletion(currentQuestion.germanWord, wrongStepsCount === 0);
        } else {
          playLernstudioSound('correct');
        }
      } else {
        setWrongStepsCount((c) => c + 1);
        playLernstudioSound('wrong');
        setErrorTileId(tile.id);
        setTimeout(() => setErrorTileId(null), 550);
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
          recordQuestionCompletion(currentQuestion.germanWord, wrongStepsCount === 0);
        } else {
          playLernstudioSound('correct');
        }
      } else {
        setWrongStepsCount((c) => c + 1);
        playLernstudioSound('wrong');
        setErrorTileId(tile.id);
        setTimeout(() => setErrorTileId(null), 550);
      }
    }
  };

  const syncLiveProgressToFirestore = (
    currResponses: HomeworkQuestionResponse[],
    currGold: number,
    currMaxStreak: number
  ) => {
    if (!assignmentId || !studentName.trim()) return;
    const correctCount = currResponses.filter((r) => r.isCorrect).length;
    const totalQ = quizQuestions.length || currResponses.length;
    const localScorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const nowIso = new Date().toISOString();
    const startMs = startTime ? new Date(startTime).getTime() : Date.now() - currResponses.length * 4000;
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startMs) / 1000));

    const attemptSecret = getOrCreateStudentAttemptSecret(activeSubmissionIdRef.current);

    const liveSubmissionObj: HomeworkSubmission = {
      id: activeSubmissionIdRef.current,
      assignmentId,
      ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
      attemptSecret,
      audienceMode,
      studentId: audienceMode === 'group' ? selectedStudentId || undefined : undefined,
      participantId: audienceMode === 'open' ? resolvedOpenPid || undefined : undefined,
      groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
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
      completedStudyPhase,
      responses: currResponses
    };

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

    setPhase('completed');
    setSubmitting(true);
    setCloudSyncState('syncing');
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });

    const correctCount = allResponses.filter((r) => r.isCorrect).length;
    const totalQ = allResponses.length;
    const localScorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const completedAtIso = new Date().toISOString();
    const startMs = startTime ? new Date(startTime).getTime() : Date.now() - totalQ * 4000;
    const timeSpentSeconds = Math.max(5, Math.round((Date.now() - startMs) / 1000));
    const attemptSecret = getOrCreateStudentAttemptSecret(activeSubmissionIdRef.current);

    const localSubmissionObj: HomeworkSubmission = {
      id: activeSubmissionIdRef.current,
      assignmentId,
      ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
      attemptSecret,
      audienceMode,
      studentId: audienceMode === 'group' ? selectedStudentId || undefined : undefined,
      participantId: audienceMode === 'open' ? resolvedOpenPid || undefined : undefined,
      groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
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
      responses: allResponses
    };

    // 1. Save immediately to localStorage AND verify Firebase Firestore persistence
    const confirmRes = await saveSubmissionWithConfirmation(localSubmissionObj, assignment);
    const syncedSubmissionObj: HomeworkSubmission = {
      ...confirmRes.submission,
      cloudSynced: confirmRes.cloudSynced
    };
    setCloudSyncState(confirmRes.cloudSynced ? 'synced' : 'pending_retry');
    setFinalScore(syncedSubmissionObj);

    try {
      const res = await fetchHomeworkApi('/api/homework/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeSubmissionIdRef.current,
          assignmentId,
          ...(new URLSearchParams(window.location.search).get('token')?.trim()
            ? { token: new URLSearchParams(window.location.search).get('token')!.trim() }
            : {}),
          ...(assignment?.ownerUid ? { ownerUid: assignment.ownerUid } : {}),
          attemptSecret,
          audienceMode,
          studentId: audienceMode === 'group' ? selectedStudentId || undefined : undefined,
          participantId: audienceMode === 'open' ? resolvedOpenPid || undefined : undefined,
          groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
          studentName: studentName.trim(),
          attemptNumber: currentAttemptNumber,
          responses: allResponses,
          startedAt: startTime,
          completedAt: completedAtIso,
          goldEarned: finalGoldValue,
          maxStreak: finalMaxStreak,
          completedStudyPhase
        })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.ok && data.submission) {
        const mergedFinal: HomeworkSubmission = {
          ...syncedSubmissionObj,
          ...data.submission,
          id: activeSubmissionIdRef.current,
          audienceMode,
          studentId: audienceMode === 'group' ? selectedStudentId || data.submission.studentId || undefined : undefined,
          participantId: audienceMode === 'open' ? resolvedOpenPid || data.submission.participantId || undefined : undefined,
          groupId: audienceMode === 'group' ? assignment?.groupId : undefined,
          attemptNumber: currentAttemptNumber,
          status: 'completed',
          completedAt: completedAtIso,
          cloudSynced: confirmRes.cloudSynced
        };
        saveLocalSubmission(mergedFinal, !confirmRes.cloudSynced);
        setFinalScore(mergedFinal);
        playLernstudioSound('fanfare_victory');
      } else {
        setFinalScore(syncedSubmissionObj);
        playLernstudioSound('fanfare_victory');
      }
    } catch {
      setFinalScore(syncedSubmissionObj);
      playLernstudioSound('fanfare_victory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualRetryCloudSync = async () => {
    setRetryingCloudSync(true);
    setCloudSyncState('syncing');
    try {
      if (finalScore) {
        const res = await saveSubmissionWithConfirmation(finalScore);
        if (res.cloudSynced) {
          setCloudSyncState('synced');
          setFinalScore((prev: any) => (prev ? { ...prev, cloudSynced: true } : prev));
          return;
        }
      }
      const flushRes = await flushPendingHomeworkCloudWrites();
      setCloudSyncState(flushRes.remainingPending === 0 ? 'synced' : 'pending_retry');
    } finally {
      setRetryingCloudSync(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text-main flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-text-muted">جاري تحضير الواجب...</p>
        </div>
      </div>
    );
  }

  if (error && phase === 'lobby') {
    return (
      <div className="min-h-screen bg-background text-text-main flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="max-w-md w-full bg-surface border border-surface-border p-6 rounded-2xl text-center space-y-4 shadow-xs">
          <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-text-main">تنبيه بخصوص الواجب</h2>
          <p className="text-xs text-text-muted">{error}</p>
          <button
            type="button"
            onClick={() => {
              try { window.close(); } catch {}
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main font-bold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <span>إغلاق الصفحة</span>
          </button>
          <p className="text-[11px] text-text-muted pt-2 select-none">
            von Herr Abdul-rahman
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 0: LOBBY & STUDENT NAME ENTRY (Glück Design System)
  // ============================================================================
  // ============================================================================
  // PHASE 0: LOBBY & STUDENT NAME ENTRY (Glück Minimal Student Landing Page)
  // ============================================================================
  if (phase === 'lobby') {
    const flowMode: HomeworkFlowMode = 'teacher_then_quiz';

    return (
      <div className="min-h-screen bg-background text-text-main flex flex-col justify-between p-4 sm:p-6 font-sans" dir="rtl">
        {/* Main Card */}
        <div className="max-w-md w-full bg-surface border border-surface-border p-5 sm:p-7 rounded-2xl space-y-6 shadow-xs mx-auto my-auto">
          {/* Glück Heading */}
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-text-main">
              {assignment?.title || 'واجب Glück التفاعلي'}
            </h1>
            {audienceMode === 'group' && assignment?.groupName && (
              <p className="text-xs text-primary font-bold">🏫 {assignment.groupName}</p>
            )}
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
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold text-center">
                    لقد أتممت المحاولات المسموحة لهذا الواجب ({studentCompletedAttempts.length} /{' '}
                    {assignment?.allowReplay === false ? 1 : assignment?.maxAttempts}).
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
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold text-center">
                  لقد أتممت المحاولات المسموحة لهذا الواجب ({studentCompletedAttempts.length} /{' '}
                  {assignment?.allowReplay === false ? 1 : assignment?.maxAttempts}).
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

        {/* Teacher Signature Footer at the VERY BOTTOM of the page */}
        <footer className="text-center text-xs text-text-muted font-normal py-4 select-none">
          von Herr Abdul-rahman
        </footer>
      </div>
    );
  }

  // ============================================================================
  // PHASE 1: TEACHER PRONUNCIATION & FLASHCARD STUDY ("يبدأ بالمعلم اللي هو نطق الكلمة")
  // ============================================================================
  if (phase === 'teacher_study' && currentStudyItem) {
    const parsed = stripLeadingArticle(currentStudyItem.german);
    const article = currentStudyItem.article || parsed.article;
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

        {/* Top Bar */}
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-surface border border-surface-border text-primary text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <span>📖</span>
              <span>التعلم والنطق: {studyIndex + 1} / {studyItems.length}</span>
            </span>
          </div>
          <span className="text-xs font-medium text-text-muted">👤 {studentName}</span>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl w-full mx-auto h-2 bg-surface-border rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((studyIndex + 1) / studyItems.length) * 100}%` }}
          />
        </div>

        {/* Teacher Study Card */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto">
          <motion.div
            key={currentStudyItem.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-surface border border-surface-border rounded-2xl p-5 sm:p-7 text-center space-y-4 shadow-xs"
          >
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

            {(currentStudyItem.exampleSentenceGerman || currentStudyItem.example) && (
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
                onClick={() => speakGermanText(currentStudyItem.german, 0.9)}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs cursor-pointer transition-all"
              >
                <Volume2 className="w-4 h-4" />
                <span>🔊 استمع للنطق</span>
              </button>
              <button
                type="button"
                onClick={() => speakGermanText(currentStudyItem.german, 0.55)}
                className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-2xs"
              >
                <Snail className="w-4 h-4 text-primary" />
                <span>🐢 نطق بطيء</span>
              </button>
            </div>

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

              {studyIndex + 1 < studyItems.length ? (
                <button
                  type="button"
                  onClick={() => {
                    playLernstudioSound('pop');
                    setStudyIndex((i) => i + 1);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <span>الكلمة التالية</span>
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
            className="bg-surface border border-surface-border p-5 sm:p-7 rounded-2xl text-center space-y-4 shadow-xs"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
              <Trophy className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              {cloudSyncState === 'synced' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم حفظ نتيجتك ومزامنتها سحابياً مع المعلم ✓</span>
                </div>
              ) : cloudSyncState === 'syncing' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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

            {/* Detailed Question Review */}
            <div className="text-right space-y-2 pt-2">
              <h3 className="text-xs font-bold text-text-main">مراجعة الإجابات ({responses.length}):</h3>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                {responses.map((r, i) => (
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
                      {r.isCorrect ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ صحيح</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">الصواب: {r.correctAnswer}</span>
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
                    const nextAttempt = Math.max(currentAttemptNumber + 1, studentCompletedAttempts.length + 1);
                    isSubmittingRef.current = false;
                    activeSubmissionIdRef.current = buildDeterministicSubmissionId(
                      assignmentId,
                      audienceMode === 'group' ? selectedStudentId : undefined,
                      studentName.trim(),
                      nextAttempt,
                      audienceMode === 'open' ? resolvedOpenPid : undefined
                    );
                    setCurrentAttemptNumber(nextAttempt);
                    setCurrentIdx(0);
                    setStudyIndex(0);
                    setResponses([]);
                    setGold(0);
                    setStreak(0);
                    setFinalScore(null);
                    const nowIso = new Date().toISOString();
                    setStartTime(nowIso);
                    setPhase(studyItems.length > 0 ? 'teacher_study' : 'quiz');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-primary" />
                  <span>إعادة المحاولة لتحسين النتيجة</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 2: MULTI-STAGE QUIZ & EVALUATION (7 Progressive Stages + Icon-Only Stage Bar)
  // ============================================================================
  const hasStudyStage = studyItems.length > 0;
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
      {/* Icon-Only Sequential Stage Bar (Zero Horizontal Side-Scrolling) */}
      <div className="max-w-3xl w-full mx-auto bg-surface border border-surface-border rounded-2xl p-1.5 mb-3 shadow-2xs">
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

      {/* Top HUD Bar */}
      <div className="max-w-3xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-surface border border-surface-border text-primary text-xs font-bold shadow-2xs">
            {currentQuestion?.stageBadgeEmoji} {currentQuestion?.stageLabelAr}
          </span>
          <span className="px-3 py-1 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main tabular-nums">
            السؤال {currentIdx + 1} / {quizQuestions.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {streak > 1 && (
            <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> x{Math.min(3, streak)}
            </span>
          )}
          <span className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 tabular-nums">
            <Coins className="w-3.5 h-3.5" />
            <span>{gold} نقطة</span>
          </span>
          <span className="text-xs font-medium text-text-muted hidden sm:inline">👤 {studentName}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-3xl w-full mx-auto h-2 bg-surface-border rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / Math.max(1, quizQuestions.length)) * 100}%` }}
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
            ) : (
              <h2
                className="text-xl sm:text-3xl font-bold text-text-main tracking-wide"
                dir={currentQuestion.hideGermanText ? 'rtl' : 'ltr'}
              >
                {currentQuestion.promptMainText}
              </h2>
            )}

            {currentQuestion.promptSubText && (
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
                  return (
                    <span
                      key={slotIdx}
                      className={`inline-flex items-center justify-center w-9 h-11 sm:w-11 sm:h-13 rounded-xl border-2 font-black transition-all ${
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
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => speakGermanText(currentQuestion.germanWord, 0.9)}
                className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5 text-primary" />
                <span>استمع</span>
              </button>
              <button
                type="button"
                onClick={() => speakGermanText(currentQuestion.germanWord, 0.55)}
                className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-text-muted hover:text-text-main font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Snail className="w-3.5 h-3.5" />
                <span>بطيء</span>
              </button>
            </div>
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
                const isRightOption = choice.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

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
                    key={idx}
                    type="button"
                    disabled={selectedChoice !== null}
                    onClick={() => handleSelectOption(choice)}
                    dir="auto"
                    className={`p-3.5 rounded-xl border font-bold text-sm sm:text-base text-center transition-all flex items-center justify-between gap-2.5 cursor-pointer active:scale-95 shadow-2xs ${btnStyle}`}
                  >
                    <span className="flex-1 text-center truncate">{choice}</span>
                    {selectedChoice !== null && isRightOption && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {selectedChoice !== null && isSelected && !isRightOption && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
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
