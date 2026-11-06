import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Clock,
  Sparkles,
  Flame,
  Coins,
  GraduationCap,
  Gift,
  Check,
  X,
  HelpCircle,
  Award
} from 'lucide-react';
import { speakGermanText } from '../shared/audioSpeechUtils';
import { playLernstudioSound, playGermanVoiceFeedback } from '../shared/lernstudioAudioUtils';
import {
  HomeworkAssignment,
  HomeworkQuestionResponse,
  HomeworkQuestionType,
  HomeworkFlowMode,
  HomeworkBlooketMode,
  HomeworkSubmission
} from '../shared/homeworkTypes';
import { DEFAULT_LERNSTUDIO_SETS } from '../shared/defaultLernstudioSets';
import {
  getLocalAssignments,
  saveLocalAssignment,
  saveLocalSubmission,
  QUESTION_TYPE_META,
  fetchAssignmentFromFirestore,
  saveAssignmentToFirestore,
  saveSubmissionToFirestore,
  subscribeSubmissionsFromFirestore
} from '../shared/homeworkStorageSync';

interface Props {
  assignmentId?: string;
}

interface GeneratedQuizQuestion {
  id: string;
  itemId: string;
  type: HomeworkQuestionType;
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
}

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

function buildMaskedWord(baseWord: string): { masked: string; missingChar: string } {
  const clean = baseWord.trim();
  if (clean.length <= 2) {
    return { masked: clean[0] + '_', missingChar: clean[clean.length - 1] || 'e' };
  }
  const idx = Math.max(1, Math.min(clean.length - 2, Math.floor(clean.length / 2)));
  const missingChar = clean[idx];
  const masked = clean.slice(0, idx) + ' _ ' + clean.slice(idx + 1);
  return { masked, missingChar };
}

export const HomeworkPlayerPage: React.FC<Props> = ({ assignmentId: propId }) => {
  const assignmentId =
    propId ||
    window.location.pathname.replace(/^\/homework\/?/, '').split('/')[0] ||
    '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Student Flow State
  const [studentName, setStudentName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [cachedStudents, setCachedStudents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dl_students');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed
            .filter((s: any) => !s.deleted && s.status !== 'archived')
            .map((s: any) => ({ id: s.id, name: s.name }));
          setCachedStudents(list);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const displayStudents = useMemo(() => {
    if (Array.isArray(assignment?.assignedStudents) && assignment.assignedStudents.length > 0) {
      return assignment.assignedStudents;
    }
    if (cachedStudents.length > 0) {
      return cachedStudents;
    }
    return [];
  }, [assignment?.assignedStudents, cachedStudents]);

  const [currentAttemptNumber, setCurrentAttemptNumber] = useState<number>(1);
  const [allSubmissions, setAllSubmissions] = useState<HomeworkSubmission[]>([]);
  const [phase, setPhase] = useState<'lobby' | 'teacher_study' | 'quiz' | 'completed'>('lobby');
  const [studyIndex, setStudyIndex] = useState(0);
  const [completedStudyPhase, setCompletedStudyPhase] = useState(false);

  // Quiz & Blooket State
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<HomeworkQuestionResponse[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [gold, setGold] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [questionStartMs, setQuestionStartMs] = useState<number>(Date.now());

  // Blooket Gold Chest Bonus Modal
  const [showChestBonus, setShowChestBonus] = useState(false);
  const [chestOptions, setChestOptions] = useState<{ label: string; apply: (g: number) => number; bonusText: string }[]>([]);
  const [openedChestIndex, setOpenedChestIndex] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<any | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const activeSubmissionIdRef = React.useRef<string>('sub_' + Math.random().toString(36).substring(2, 9));

  // Subscribe to live Firestore class leaderboard for this assignment
  useEffect(() => {
    if (!assignmentId) return;
    const unsub = subscribeSubmissionsFromFirestore(assignmentId, (subs) => {
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
    });
    return () => unsub();
  }, [assignmentId]);

  // Load Assignment (Primary: Firebase Firestore -> Secondary: API -> Fallback: Local/URL)
  useEffect(() => {
    async function loadHomework() {
      try {
        setLoading(true);

        // 1. Check Firebase Firestore first (works seamlessly between Main App & Vercel!)
        const cloudHw = await fetchAssignmentFromFirestore(assignmentId).catch(() => null);
        if (cloudHw && cloudHw.setSnapshot) {
          setAssignment(cloudHw);
          return;
        }

        // 2. Check /api/homework/info
        const res = await fetch(`/api/homework/info?id=${encodeURIComponent(assignmentId)}`).catch(() => null);
        let data: any = {};
        if (res) {
          const text = await res.text();
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            data = {};
          }
          if (res.ok && data && data.setSnapshot) {
            setAssignment(data);
            if (Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
              setLeaderboard(data.leaderboard);
            }
            saveAssignmentToFirestore(data).catch(() => {});
            return;
          }
        }

        // 3. Check local assignments cache
        const localFound = getLocalAssignments().find((a) => a.id === assignmentId);
        if (localFound && localFound.setSnapshot) {
          setAssignment(localFound);
          return;
        }

        // 4. Fallback: Parse query parameters from share URL (e.g. ?s=...&t=...&qt=...) so student never gets "not available"
        const searchParams = new URLSearchParams(window.location.search);
        const setId = searchParams.get('s');
        if (setId) {
          const titleParam = searchParams.get('t') || 'واجب منزلتي تفاعلي';
          const flowModeParam = (searchParams.get('fm') as any) || 'teacher_then_quiz';
          const qtParam = searchParams.get('qt');
          const questionTypesParam = qtParam ? (qtParam.split(',') as any) : ['mc_de_ar', 'true_false'];
          const idsParam = searchParams.get('ids');
          const selectedIds = idsParam ? idsParam.split(',') : [];

          // Find set in DEFAULT_LERNSTUDIO_SETS or local sets
          const foundSet = DEFAULT_LERNSTUDIO_SETS.find((st) => st.id === setId) || DEFAULT_LERNSTUDIO_SETS[0];
          if (foundSet) {
            const items = selectedIds.length > 0
              ? foundSet.items.filter((it) => selectedIds.includes(it.id))
              : foundSet.items;

            const fallbackHw: HomeworkAssignment = {
              id: assignmentId,
              title: titleParam,
              setSnapshot: {
                id: foundSet.id,
                title: foundSet.title,
                category: (foundSet as any).category || foundSet.topic || '',
                items: items.length > 0 ? items : foundSet.items
              },
              selectedItemIds: selectedIds,
              flowMode: flowModeParam,
              questionTypes: questionTypesParam,
              blooketMode: 'gold_quest',
              allowedGameModes: ['gold_quest'],
              questionCount: (items.length > 0 ? items : foundSet.items).length * questionTypesParam.length,
              maxAttempts: 3,
              allowReplay: true,
              isActive: true,
              status: 'active',
              createdAt: new Date().toISOString(),
              createdBy: 'Teacher'
            };
            setAssignment(fallbackHw);
            saveLocalAssignment(fallbackHw, false);
            return;
          }
        }

        // 5. If even default set fallback fails, build a generic set from default vocabulary
        if (DEFAULT_LERNSTUDIO_SETS.length > 0) {
          const defaultSet = DEFAULT_LERNSTUDIO_SETS[0];
          const fallbackHw: HomeworkAssignment = {
            id: assignmentId,
            title: 'واجب Glück التفاعلي',
            setSnapshot: {
              id: defaultSet.id,
              title: defaultSet.title,
              category: defaultSet.topic || '',
              items: defaultSet.items
            },
            flowMode: 'teacher_then_quiz',
            questionTypes: ['mc_de_ar', 'true_false'],
            blooketMode: 'gold_quest',
            allowedGameModes: ['gold_quest'],
            questionCount: defaultSet.items.length * 2,
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

  // Build progressive multi-stage question list based on teacher's chosen questionTypes
  const quizQuestions = useMemo<GeneratedQuizQuestion[]>(() => {
    if (studyItems.length === 0) return [];
    const allSetItems: any[] = assignment?.setSnapshot?.items || studyItems;
    const types: HomeworkQuestionType[] =
      Array.isArray(assignment?.questionTypes) && assignment.questionTypes.length > 0
        ? assignment.questionTypes
        : ['mc_de_ar', 'true_false'];

    const list: GeneratedQuizQuestion[] = [];

    types.forEach((qType, stageIdx) => {
      const meta = QUESTION_TYPE_META.find((m) => m.id === qType);
      const stageTitle = `المرحلة ${stageIdx + 1}: ${meta?.labelAr || 'سؤال تفاعلي'}`;
      const stageEmoji = meta?.badgeEmoji || '🎯';

      studyItems.forEach((item, itemIdx) => {
        const qId = `${item.id}_${qType}_${itemIdx}`;
        const otherItems = allSetItems.filter((x) => x.id !== item.id);

        if (qType === 'true_false') {
          const isTrue = (itemIdx + stageIdx) % 2 === 0 || otherItems.length === 0;
          const wrongItem = otherItems[(itemIdx + 1) % Math.max(1, otherItems.length)];
          const shownArabic = isTrue ? item.arabic : wrongItem?.arabic || 'المدرسة';
          const correctLabel = isTrue ? 'صح ✅ (Richtig)' : 'خطأ ❌ (Falsch)';

          list.push({
            id: qId,
            itemId: item.id,
            type: 'true_false',
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

        if (qType === 'listen_choose') {
          const correctOpt = `${item.german} — (${item.arabic})`;
          const distractors = otherItems
            .slice()
            .sort(() => 0.5 - Math.random())
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
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji || '🔊',
            promptTitleAr: 'استمع جيداً لنطق الكلمة الألمانية واختر الإجابة الصحيحة:',
            promptMainText: '🔊 اضغط للاستماع للكلمة',
            hideGermanText: true,
            options: [correctOpt, ...distractors].sort(() => 0.5 - Math.random()),
            correctAnswer: correctOpt
          });
          return;
        }

        if (qType === 'mc_ar_de') {
          const correctOpt = item.german;
          const distractors = otherItems
            .filter((d) => d.german !== correctOpt)
            .sort(() => 0.5 - Math.random())
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
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: 'اختر الكلمة الألمانية الصحيحة لهذا المعنى:',
            promptMainText: item.arabic,
            hideGermanText: true,
            options: [correctOpt, ...distractors].sort(() => 0.5 - Math.random()),
            correctAnswer: correctOpt
          });
          return;
        }

        if (qType === 'article_quiz') {
          const parsed = stripLeadingArticle(item.german);
          const actualArticle = item.article || parsed.article;
          if (actualArticle) {
            list.push({
              id: qId,
              itemId: item.id,
              type: 'article_quiz',
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

        if (qType === 'missing_letter') {
          const parsed = stripLeadingArticle(item.german);
          const { masked } = buildMaskedWord(parsed.baseWord);
          const fullWord = item.german;
          const distractors = otherItems
            .filter((d) => d.german !== fullWord)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)
            .map((d) => d.german);
          const fallbacks = ['das Buch', 'der Apfel', 'die Schule', 'das Haus'];
          let f = 0;
          while (distractors.length < 3 && f < fallbacks.length) {
            if (fallbacks[f] !== fullWord && !distractors.includes(fallbacks[f])) {
              distractors.push(fallbacks[f]);
            }
            f++;
          }

          list.push({
            id: qId,
            itemId: item.id,
            type: 'missing_letter',
            stageLabelAr: stageTitle,
            stageBadgeEmoji: stageEmoji,
            germanWord: item.german,
            arabicMeaning: item.arabic,
            emoji: item.emoji,
            promptTitleAr: 'أكمل الكلمة الألمانية بالشكل الصحيح:',
            promptMainText: parsed.article ? `${parsed.article} ${masked}` : masked,
            promptSubText: item.arabic,
            options: [fullWord, ...distractors].sort(() => 0.5 - Math.random()),
            correctAnswer: fullWord
          });
          return;
        }

        // Default: mc_de_ar (German -> Arabic)
        const correctOpt = item.arabic;
        const distractors = otherItems
          .filter((d) => d.arabic !== correctOpt)
          .sort(() => 0.5 - Math.random())
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
          stageLabelAr: stageTitle,
          stageBadgeEmoji: stageEmoji,
          germanWord: item.german,
          arabicMeaning: item.arabic,
          emoji: item.emoji,
          promptTitleAr: 'ما معنى هذه الكلمة الألمانية بالعربية؟',
          promptMainText: item.german,
          options: [correctOpt, ...distractors].sort(() => 0.5 - Math.random()),
          correctAnswer: correctOpt
        });
      });
    });

    return list;
  }, [studyItems, assignment]);

  const currentQuestion = quizQuestions[currentIdx];
  const currentStudyItem = studyItems[studyIndex];

  // Auto-pronounce word when entering Teacher Study card or Listening Question
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
      if (currentQuestion.type === 'listen_choose' || currentQuestion.type === 'mc_de_ar' || currentQuestion.type === 'true_false') {
        const timer = setTimeout(() => {
          speakGermanText(currentQuestion.germanWord, 0.9);
        }, 250);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, currentIdx, currentQuestion]);

  const handleStartHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    activeSubmissionIdRef.current = 'sub_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

    const studentSubs = allSubmissions.filter(
      (s) =>
        (selectedStudentId && s.studentId === selectedStudentId) ||
        s.studentName.trim().toLowerCase() === studentName.trim().toLowerCase()
    );
    const nextAttempt = studentSubs.length + 1;
    setCurrentAttemptNumber(nextAttempt);

    setStartTime(new Date().toISOString());
    playLernstudioSound('powerup_star');

    const flowMode: HomeworkFlowMode = assignment?.flowMode || 'teacher_then_quiz';
    if (flowMode === 'teacher_then_quiz' && studyItems.length > 0) {
      setStudyIndex(0);
      setPhase('teacher_study');
    } else {
      setCurrentIdx(0);
      setPhase('quiz');
    }
  };

  const prepareChestBonus = () => {
    const pool = [
      { label: '+100 ذهب 💰', apply: (g: number) => g + 100, bonusText: '+100 ذهب!' },
      { label: '+250 ذهب 🏆', apply: (g: number) => g + 250, bonusText: '+250 ذهب!' },
      { label: 'مضاعفة الذهب x2 ⚡', apply: (g: number) => Math.max(200, g * 2), bonusText: 'مضاعفة الذهب x2!' },
      { label: '+500 كنز ذهبي 👑', apply: (g: number) => g + 500, bonusText: '+500 كنز أسطوري!' }
    ].sort(() => 0.5 - Math.random());

    setChestOptions(pool.slice(0, 3));
    setOpenedChestIndex(null);
    setShowChestBonus(true);
  };

  const advanceToNextQuestion = (nextResponses: HomeworkQuestionResponse[], currentGold: number, currentMaxStreak: number) => {
    setSelectedChoice(null);
    setFeedback(null);
    setShowChestBonus(false);

    if (currentIdx + 1 < quizQuestions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      handleFinishHomework(nextResponses, currentGold, currentMaxStreak);
    }
  };

  const handleSelectOption = (chosenOption: string) => {
    if (selectedChoice !== null || !currentQuestion) return;
    setSelectedChoice(chosenOption);

    const isCorrect = chosenOption.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
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
      studentAnswer: chosenOption,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      timeSpentSeconds: elapsedSec
    };

    const nextResponses = [...responses, newResponse];
    setResponses(nextResponses);

    // Sync progress answer-by-answer in real-time to Firestore so the teacher sees live question-by-question student progress!
    syncLiveProgressToFirestore(nextResponses, nextGold, nextMaxStreak);

    const blooketMode: HomeworkBlooketMode = assignment?.blooketMode || 'gold_quest';
    if (isCorrect && blooketMode === 'gold_quest') {
      setTimeout(() => {
        prepareChestBonus();
      }, 900);
    } else {
      setTimeout(() => {
        advanceToNextQuestion(nextResponses, nextGold, nextMaxStreak);
      }, 1200);
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
    const completedAtIso = new Date().toISOString();
    const startMs = startTime ? new Date(startTime).getTime() : Date.now() - currResponses.length * 4000;
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startMs) / 1000));

    const liveSubmissionObj = {
      id: activeSubmissionIdRef.current,
      assignmentId,
      studentId: selectedStudentId || undefined,
      studentName: studentName.trim(),
      attemptNumber: currentAttemptNumber,
      status: 'in_progress',
      startedAt: startTime || completedAtIso,
      completedAt: completedAtIso,
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

    saveLocalSubmission(liveSubmissionObj as any, false);
    saveSubmissionToFirestore(liveSubmissionObj as any).catch(() => {});
  };

  const handlePickChest = (idx: number) => {
    if (openedChestIndex !== null) return;
    setOpenedChestIndex(idx);
    playLernstudioSound('powerup_star');
    const chosen = chestOptions[idx];
    const updatedGold = chosen ? chosen.apply(gold) : gold + 100;
    setGold(updatedGold);

    setTimeout(() => {
      advanceToNextQuestion(responses, updatedGold, maxStreak);
    }, 1100);
  };

  const handleFinishHomework = async (
    allResponses: HomeworkQuestionResponse[],
    finalGoldValue: number,
    finalMaxStreak: number
  ) => {
    setPhase('completed');
    setSubmitting(true);
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });

    const correctCount = allResponses.filter((r) => r.isCorrect).length;
    const totalQ = allResponses.length;
    const localScorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const completedAtIso = new Date().toISOString();
    const startMs = startTime ? new Date(startTime).getTime() : Date.now() - totalQ * 4000;
    const timeSpentSeconds = Math.max(5, Math.round((Date.now() - startMs) / 1000));

    const localSubmissionObj = {
      id: activeSubmissionIdRef.current,
      assignmentId,
      studentId: selectedStudentId || undefined,
      studentName: studentName.trim(),
      attemptNumber: currentAttemptNumber,
      status: 'completed',
      startedAt: startTime || completedAtIso,
      completedAt: completedAtIso,
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

    // 1. Save immediately to localStorage AND Firebase Firestore so the teacher sees it in real time in the Main App & Vercel!
    saveLocalSubmission(localSubmissionObj, false);
    await saveSubmissionToFirestore(localSubmissionObj as any).catch(() => {});
    setFinalScore(localSubmissionObj);

    try {
      const res = await fetch('/api/homework/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          studentName: studentName.trim(),
          responses: allResponses,
          startedAt: startTime,
          completedAt: completedAtIso,
          goldEarned: finalGoldValue,
          maxStreak: finalMaxStreak,
          completedStudyPhase,
          assignmentFallback: assignment
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
        saveLocalSubmission(data.submission, false);
        setFinalScore(data.submission);
        playLernstudioSound('fanfare_victory');
      } else {
        setFinalScore(localSubmissionObj);
        playLernstudioSound('fanfare_victory');
      }
    } catch {
      setFinalScore(localSubmissionObj);
      playLernstudioSound('fanfare_victory');
    } finally {
      setSubmitting(false);
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
    const flowMode: HomeworkFlowMode = assignment?.flowMode || 'teacher_then_quiz';

    return (
      <div className="min-h-screen bg-background text-text-main flex flex-col justify-between p-4 sm:p-6 font-sans" dir="rtl">
        {/* Main Card */}
        <div className="max-w-md w-full bg-surface border border-surface-border p-5 sm:p-7 rounded-2xl space-y-6 shadow-xs mx-auto my-auto">
          {/* Glück Heading */}
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-text-main">
              {assignment?.title || 'واجب Glück التفاعلي'}
            </h1>
            {assignment?.groupName && (
              <p className="text-xs text-text-muted font-medium">{assignment.groupName}</p>
            )}
          </div>

          {/* Student Names as Selectable Cards (Responsive Grid: 2 cols on mobile, 3 cols on sm) */}
          {displayStudents.length > 0 ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold text-text-muted">
                  اختر اسمك للبدء:
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-0.5">
                {displayStudents.map((st: any) => {
                  const isSelected = selectedStudentId === st.id || studentName.trim().toLowerCase() === st.name.trim().toLowerCase();
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        setStudentName(st.name);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-xs font-semibold ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-xs font-bold scale-[1.02]'
                          : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main hover:border-primary/40'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-surface-hover border border-surface-border text-text-muted'
                      }`}>
                        👤
                      </span>
                      <span className="truncate w-full text-center">{st.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Start Button strictly BELOW student cards */}
              <button
                type="button"
                disabled={!selectedStudentId && studentName.trim().length < 2}
                onClick={handleStartHomework}
                className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <span>
                  {flowMode === 'teacher_then_quiz'
                    ? 'بدء الواجب 🚀'
                    : 'بدء حل الأسئلة 🎯'}
                </span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Legacy Fallback for assignments without student rosters */
            <form onSubmit={handleStartHomework} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5 text-center">
                  اكتب اسمك للبدء وتسجيل نتيجتك:
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="مثال: أحمد محمد / Omar Ali..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-surface-border focus:border-primary text-text-main font-bold text-sm outline-none transition-all text-center"
                />
              </div>

              <button
                type="submit"
                disabled={studentName.trim().length < 2}
                className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {flowMode === 'teacher_then_quiz'
                    ? 'بدء الواجب 🚀'
                    : 'بدء حل الأسئلة 🎯'}
                </span>
                <ArrowLeft className="w-4 h-4" />
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

    return (
      <div className="min-h-screen bg-background text-text-main flex flex-col p-4 sm:p-6 font-sans" dir="rtl">
        {/* Top Bar */}
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-surface border border-surface-border text-primary text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>مرحلة المعلّم الناطق: {studyIndex + 1} / {studyItems.length}</span>
            </span>
          </div>
          <button
            onClick={() => {
              setCompletedStudyPhase(true);
              setCurrentIdx(0);
              setPhase('quiz');
            }}
            className="px-3 py-1 rounded-lg bg-surface-hover hover:bg-surface text-text-muted hover:text-text-main border border-surface-border text-xs font-semibold cursor-pointer transition-colors"
          >
            تخطي للأسئلة ←
          </button>
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

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تم تسجيل نتيجتك بنجاح!</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-text-main">
                أحسنت يا {studentName}! 🎉
              </h2>
              <p className="text-xs font-bold text-primary">{gradeLabel}</p>
            </div>

            {submitting ? (
              <p className="text-xs font-bold text-text-muted animate-pulse">جاري حفظ النتيجة...</p>
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

            {assignment?.allowReplay && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    activeSubmissionIdRef.current = 'sub_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
                    setCurrentIdx(0);
                    setStudyIndex(0);
                    setResponses([]);
                    setGold(0);
                    setStreak(0);
                    setFinalScore(null);
                    setStartTime(new Date().toISOString());
                    setPhase(assignment?.flowMode === 'teacher_then_quiz' ? 'teacher_study' : 'quiz');
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
  // PHASE 2: MULTI-STAGE QUIZ & EVALUATION
  // ============================================================================
  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col p-4 sm:p-6 font-sans" dir="rtl">
      {/* Top HUD Bar */}
      <div className="max-w-3xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-surface border border-surface-border text-primary text-xs font-bold shadow-2xs">
            {currentQuestion?.stageBadgeEmoji} {currentQuestion?.stageLabelAr}
          </span>
          <span className="px-3 py-1 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main">
            السؤال {currentIdx + 1} / {quizQuestions.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {streak > 1 && (
            <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> x{Math.min(3, streak)}
            </span>
          )}
          <span className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            <span>{gold} نقطة</span>
          </span>
          <span className="text-xs font-medium text-text-muted hidden sm:inline">👤 {studentName}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-3xl w-full mx-auto h-2 bg-surface-border rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / Math.max(1, quizQuestions.length)) * 100}%` }}
        />
      </div>

      {/* Question Card */}
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
                dir={currentQuestion.type === 'mc_ar_de' ? 'rtl' : 'ltr'}
              >
                {currentQuestion.promptMainText}
              </h2>
            )}

            {currentQuestion.promptSubText && (
              <div className="py-2 px-4 rounded-xl bg-surface-hover border border-surface-border inline-block">
                <p className="text-base sm:text-xl font-bold text-primary">{currentQuestion.promptSubText}</p>
              </div>
            )}

            {!currentQuestion.hideGermanText && (
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
            )}
          </motion.div>

          {/* Answer Options */}
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
          ) : (
            <div
              className={`grid gap-2.5 ${
                currentQuestion.options.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
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

      {/* Bonus Box Modal */}
      <AnimatePresence>
        {showChestBonus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-xl text-text-main"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <Gift className="w-3.5 h-3.5" />
                <span>إجابة صحيحة! مكافأة إضافية</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold">اختر صندوقاً واحداً لمضاعفة نقاطك! 🎁</h3>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {chestOptions.map((c, i) => {
                  const isOpened = openedChestIndex === i;
                  const isOther = openedChestIndex !== null && openedChestIndex !== i;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={openedChestIndex !== null}
                      onClick={() => handlePickChest(i)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isOpened
                          ? 'bg-primary/10 border-primary scale-105 shadow-xs'
                          : isOther
                          ? 'bg-surface border-surface-border opacity-40'
                          : 'bg-surface hover:bg-surface-hover border-surface-border hover:scale-105'
                      }`}
                    >
                      <span className="text-3xl sm:text-4xl select-none">{isOpened ? '👑' : '🎁'}</span>
                      <span className="text-xs font-bold text-text-main">
                        {openedChestIndex !== null ? c.bonusText : `صندوق ${i + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
