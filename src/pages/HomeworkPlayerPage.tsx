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
  HomeworkQuestionResponse,
  HomeworkQuestionType,
  HomeworkFlowMode,
  HomeworkBlooketMode
} from '../shared/homeworkTypes';
import { DEFAULT_LERNSTUDIO_SETS } from '../shared/defaultLernstudioSets';
import {
  getLocalAssignments,
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
          saveAssignmentToFirestore(localFound).catch(() => {});
          return;
        }

        // 4. Reconstruct from URL query parameters if needed
        const params = new URLSearchParams(window.location.search);
        const setId = params.get('s');
        const fm = (params.get('fm') as HomeworkFlowMode) || 'teacher_then_quiz';
        const qtRaw = params.get('qt');
        const qtList = qtRaw
          ? (qtRaw.split(',').filter(Boolean) as HomeworkQuestionType[])
          : (['mc_de_ar', 'true_false'] as HomeworkQuestionType[]);
        const bm = (params.get('bm') as HomeworkBlooketMode) || 'gold_quest';
        const idsRaw = params.get('ids');
        const selectedIds = idsRaw ? idsRaw.split(',').filter(Boolean) : undefined;
        const customTitle = params.get('t');

        const matchedSet =
          (setId && DEFAULT_LERNSTUDIO_SETS.find((s) => s.id === setId)) ||
          DEFAULT_LERNSTUDIO_SETS[0];

        if (matchedSet) {
          const filteredItems =
            selectedIds && selectedIds.length > 0
              ? matchedSet.items.filter((it) => selectedIds.includes(it.id))
              : matchedSet.items;

          const reconstructed = {
            id: assignmentId,
            title: customTitle || `واجب: ${matchedSet.title}`,
            createdAt: new Date().toISOString(),
            isActive: true,
            flowMode: fm,
            questionTypes: qtList,
            blooketMode: bm,
            selectedItemIds: selectedIds,
            questionCount: (filteredItems.length || matchedSet.items.length) * qtList.length,
            setSnapshot: {
              ...matchedSet,
              items: filteredItems.length > 0 ? filteredItems : matchedSet.items
            },
            maxAttempts: 0,
            allowReplay: true
          };
          setAssignment(reconstructed);
          saveAssignmentToFirestore(reconstructed as any).catch(() => {});
        } else {
          setError(data.error || 'تعذر تحميل الواجب المنزلي');
        }
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
      studentName: studentName.trim(),
      attemptNumber: 1,
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
      studentName: studentName.trim(),
      attemptNumber: 1,
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
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">جاري تحضير الواجب التفاعلي...</p>
        </div>
      </div>
    );
  }

  if (error && phase === 'lobby') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500/40 p-6 sm:p-8 rounded-3xl text-center space-y-4">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-black text-white">تنبيه بخصوص الواجب</h2>
          <p className="text-sm font-medium text-slate-300">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
          >
            <span>العودة للرئيسية</span>
          </a>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 0: LOBBY & STUDENT NAME ENTRY (Blooket Style)
  // ============================================================================
  if (phase === 'lobby') {
    const flowMode: HomeworkFlowMode = assignment?.flowMode || 'teacher_then_quiz';
    const activeTypes: HomeworkQuestionType[] =
      Array.isArray(assignment?.questionTypes) && assignment.questionTypes.length > 0
        ? assignment.questionTypes
        : ['mc_de_ar', 'true_false'];

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-950 to-black text-white flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="max-w-xl w-full bg-slate-900/90 border-2 border-amber-400/40 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black">
              <Sparkles className="w-4 h-4" />
              <span>تحدي الواجب التفاعلي — أسلوب Blooket 🏆</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{assignment?.title}</h1>
            <p className="text-xs sm:text-sm font-bold text-slate-400">
              {assignment?.setSnapshot?.title} • {studyItems.length} كلمات • {quizQuestions.length} سؤال تفاعلي
            </p>
          </div>

          {/* Stages Roadmap */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              <span>خطة سير الواجب المحددة من المعلّم:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              {flowMode === 'teacher_then_quiz' && (
                <>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5">
                    <span>👨‍🏫 1. المعلّم الناطق (سماع ونطق الكلمات)</span>
                  </span>
                  <span className="text-slate-600">←</span>
                </>
              )}
              {activeTypes.map((t, idx) => {
                const meta = QUESTION_TYPE_META.find((m) => m.id === t);
                return (
                  <React.Fragment key={t}>
                    <span className="px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200">
                      {meta?.badgeEmoji} {meta?.labelAr || t}
                    </span>
                    {idx < activeTypes.length - 1 && <span className="text-slate-600">←</span>}
                  </React.Fragment>
                );
              })}
              <span className="text-slate-600">←</span>
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                🏆 التقييم النهائي ولوحة الشرف
              </span>
            </div>
          </div>

          {/* Student Name Input Form */}
          <form onSubmit={handleStartHomework} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-300 mb-2">
                اكتب اسمك الثلاثي أو الثنائي للبدء وتسجيل نتيجتك لدى المعلم:
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="مثال: أحمد محمد / Omar Ali..."
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-800 border-2 border-slate-700 focus:border-amber-400 text-white font-black text-base outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={studentName.trim().length < 2}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <span>
                {flowMode === 'teacher_then_quiz'
                  ? '👨‍🏫 ابدأ مع المعلّم الناطق ثم الأسئلة'
                  : '🎯 ابدأ حل الأسئلة الآن'}
              </span>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </form>

          {/* Mini Leaderboard if classmates already played */}
          {leaderboard.length > 0 && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                <span>لوحة صدارة الأبطال في هذا الواجب ({leaderboard.length}):</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {leaderboard.slice(0, 5).map((entry, i) => (
                  <div
                    key={entry.id || i}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-amber-400 font-black">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <span className="text-white">{entry.studentName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-300 font-black">💰 {entry.goldEarned || 0}</span>
                      <span className="text-emerald-400 font-black">{entry.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
        : article === 'die'
        ? 'bg-rose-500/20 border-rose-400 text-rose-300'
        : article === 'das'
        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
        : 'bg-slate-800 border-slate-700 text-slate-300';

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-950 to-black text-white flex flex-col p-4 sm:p-6 font-sans" dir="rtl">
        {/* Top Bar */}
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              <span>مرحلة المعلّم الناطق: الكلمة {studyIndex + 1} من {studyItems.length}</span>
            </span>
          </div>
          <button
            onClick={() => {
              setCompletedStudyPhase(true);
              setCurrentIdx(0);
              setPhase('quiz');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
          >
            تخطي إلى الأسئلة ←
          </button>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl w-full mx-auto h-2.5 bg-slate-800 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-300"
            style={{ width: `${((studyIndex + 1) / studyItems.length) * 100}%` }}
          />
        </div>

        {/* Teacher Study Card */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto">
          <motion.div
            key={currentStudyItem.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-slate-900/95 border-2 border-emerald-400/40 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black">
              <span>👨‍🏫 استمع لنطق المعلّم وردد الكلمة بصوت واضح</span>
            </div>

            {currentStudyItem.emoji && (
              <div className="text-6xl sm:text-7xl select-none">{currentStudyItem.emoji}</div>
            )}

            <div className="space-y-2" dir="ltr">
              {article && (
                <span className={`inline-block px-3 py-0.5 rounded-full border text-xs font-black uppercase ${articleBadgeClass}`}>
                  {article === 'der' ? 'der (مذكر)' : article === 'die' ? 'die (مؤنث)' : 'das (محايد)'}
                </span>
              )}
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-wide">
                {currentStudyItem.german}
              </h2>
              {currentStudyItem.plural && (
                <p className="text-xs font-bold text-slate-400">الجمع (Plural): {currentStudyItem.plural}</p>
              )}
            </div>

            <div className="py-3 px-6 rounded-2xl bg-slate-950/90 border border-slate-800 inline-block">
              <p className="text-2xl sm:text-3xl font-black text-amber-400">{currentStudyItem.arabic}</p>
            </div>

            {(currentStudyItem.exampleSentenceGerman || currentStudyItem.example) && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-center space-y-1">
                <p className="text-sm font-bold text-slate-200" dir="ltr">
                  „{currentStudyItem.exampleSentenceGerman || currentStudyItem.example}“
                </p>
                {currentStudyItem.exampleSentenceArabic && (
                  <p className="text-xs font-semibold text-slate-400">{currentStudyItem.exampleSentenceArabic}</p>
                )}
              </div>
            )}

            {/* Big Pronunciation Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => speakGermanText(currentStudyItem.german, 0.9)}
                className="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
              >
                <Volume2 className="w-5 h-5" />
                <span>🔊 استمع للنطق الطبيعي</span>
              </button>
              <button
                type="button"
                onClick={() => speakGermanText(currentStudyItem.german, 0.55)}
                className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-black text-sm flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Snail className="w-5 h-5" />
                <span>🐢 نطق بطيء ومفصّل</span>
              </button>
            </div>

            {/* Prev / Next Navigation */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={studyIndex === 0}
                onClick={() => setStudyIndex((i) => Math.max(0, i - 1))}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>الكلمة السابقة</span>
              </button>

              {studyIndex + 1 < studyItems.length ? (
                <button
                  type="button"
                  onClick={() => {
                    playLernstudioSound('pop');
                    setStudyIndex((i) => i + 1);
                  }}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95 transition-all"
                >
                  <span>سمعت ونطقت الكلمة — الكلمة التالية</span>
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
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 cursor-pointer active:scale-95 transition-all"
                >
                  <span>جاهز للأسئلة! ابدأ الاختبار والتقييم الآن 🚀</span>
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
  // PHASE 3: COMPLETED EVALUATION & BLOOKET LEADERBOARD
  // ============================================================================
  if (phase === 'completed') {
    const pct = finalScore?.scorePercentage ?? 0;
    const gradeLabel =
      pct >= 90
        ? 'ممتاز جداً! بطل الألماني 🌟👑'
        : pct >= 75
        ? 'جيد جداً! أداء رائع 👏✨'
        : pct >= 50
        ? 'جيد! استمر في التدريب 💪'
        : 'تحتاج لمراجعة الكلمات والمحاولة مرة أخرى 📚';

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-950 to-black text-white p-4 sm:p-6 font-sans" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-6 py-4">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border-2 border-amber-400/50 p-6 sm:p-8 rounded-3xl text-center space-y-6 shadow-2xl"
          >
            <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center mx-auto">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تم إرسال نتيجتك وتفاصيل إجاباتك إلى المعلّم بنجاح!</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                أحسنت يا {studentName}! 🎉
              </h2>
              <p className="text-sm font-black text-amber-300">{gradeLabel}</p>
            </div>

            {submitting ? (
              <p className="text-sm font-bold text-amber-400 animate-pulse">جاري حفظ النتيجة وإرسالها للمعلم...</p>
            ) : (
              finalScore && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-2xl font-black text-amber-400">{finalScore.scorePercentage}%</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1">التقييم العام</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-2xl font-black text-emerald-400">
                      {finalScore.correctAnswersCount} / {finalScore.totalQuestions}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1">إجابات صحيحة</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-2xl font-black text-yellow-400">💰 {finalScore.goldEarned ?? gold}</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1">ذهب Blooket</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-2xl font-black text-orange-400">🔥 {finalScore.maxStreak ?? maxStreak}</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1">أطول سلسلة</div>
                  </div>
                </div>
              )
            )}

            {/* Detailed Question Review */}
            <div className="text-right space-y-2 pt-2">
              <h3 className="text-sm font-black text-slate-300">مراجعة إجاباتك بالتفصيل ({responses.length}):</h3>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {responses.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold ${
                      r.isCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => speakGermanText(r.germanWord, 0.9)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <div>
                        <div className="font-black text-white">{r.germanWord}</div>
                        <div className="text-[11px] text-slate-400">إجابتك: {r.studentAnswer}</div>
                      </div>
                    </div>
                    <div className="text-left">
                      {r.isCorrect ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">صحيح ✓</span>
                      ) : (
                        <span className="text-rose-300">الصواب: {r.correctAnswer}</span>
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
                    setCurrentIdx(0);
                    setStudyIndex(0);
                    setResponses([]);
                    setGold(0);
                    setStreak(0);
                    setFinalScore(null);
                    setStartTime(new Date().toISOString());
                    setPhase(assignment?.flowMode === 'teacher_then_quiz' ? 'teacher_study' : 'quiz');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة التحدي لتحسين نتيجتك</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 2: MULTI-STAGE QUIZ + BLOOKET GOLD CHESTS
  // ============================================================================
  const cardColors = [
    'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950',
    'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white',
    'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white',
    'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-4 sm:p-6 font-sans" dir="rtl">
      {/* Top Blooket HUD Bar */}
      <div className="max-w-3xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-black">
            {currentQuestion?.stageBadgeEmoji} {currentQuestion?.stageLabelAr}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-black text-amber-400">
            السؤال {currentIdx + 1} / {quizQuestions.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {streak > 1 && (
            <span className="px-3 py-1.5 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-black flex items-center gap-1 animate-bounce">
              <Flame className="w-3.5 h-3.5" /> x{Math.min(3, streak)}
            </span>
          )}
          <span className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{gold} ذهب</span>
          </span>
          <span className="text-xs font-bold text-slate-400 hidden sm:inline">👤 {studentName}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-3xl w-full mx-auto h-2.5 bg-slate-800 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / Math.max(1, quizQuestions.length)) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <div className="flex-1 flex flex-col justify-center max-w-3xl w-full mx-auto space-y-6">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border-2 border-slate-800 p-6 sm:p-8 rounded-3xl text-center space-y-4 shadow-2xl relative"
          >
            <p className="text-xs sm:text-sm font-black text-amber-400">{currentQuestion.promptTitleAr}</p>

            {currentQuestion.emoji && (
              <div className="text-5xl sm:text-6xl select-none">{currentQuestion.emoji}</div>
            )}

            {currentQuestion.type === 'listen_choose' ? (
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => speakGermanText(currentQuestion.germanWord, 0.85)}
                  className="px-8 py-5 rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-lg inline-flex items-center gap-3 shadow-xl shadow-amber-500/25 cursor-pointer active:scale-95 transition-all"
                >
                  <Volume2 className="w-7 h-7 animate-pulse" />
                  <span>🔊 اضغط هنا للاستماع للكلمة</span>
                </button>
              </div>
            ) : (
              <h2
                className="text-2xl sm:text-4xl font-black text-white tracking-wide"
                dir={currentQuestion.type === 'mc_ar_de' ? 'rtl' : 'ltr'}
              >
                {currentQuestion.promptMainText}
              </h2>
            )}

            {currentQuestion.promptSubText && (
              <div className="py-2 px-5 rounded-2xl bg-slate-950/90 border border-slate-800 inline-block">
                <p className="text-lg sm:text-2xl font-black text-amber-300">{currentQuestion.promptSubText}</p>
              </div>
            )}

            {!currentQuestion.hideGermanText && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => speakGermanText(currentQuestion.germanWord, 0.9)}
                  className="px-4 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 font-black text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>استمع للنطق</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakGermanText(currentQuestion.germanWord, 0.55)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-black text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Snail className="w-4 h-4" />
                  <span>بطيء</span>
                </button>
              </div>
            )}
          </motion.div>

          {/* Answer Options */}
          {currentQuestion.type === 'true_false' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedChoice === opt;
                const isRightOption = opt === currentQuestion.correctAnswer;
                const isTrueBtn = idx === 0;

                let btnStyle = isTrueBtn
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white';

                if (selectedChoice !== null) {
                  if (isRightOption) {
                    btnStyle = 'bg-emerald-500 border-emerald-300 text-slate-950 ring-4 ring-emerald-400/40';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-700 border-rose-400 text-white opacity-90';
                  } else {
                    btnStyle = 'bg-slate-900 border-slate-800 text-slate-500 opacity-50';
                  }
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={selectedChoice !== null}
                    onClick={() => handleSelectOption(opt)}
                    className={`p-6 rounded-3xl border-b-4 font-black text-xl sm:text-2xl flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-95 shadow-xl ${btnStyle}`}
                  >
                    {isTrueBtn ? <Check className="w-7 h-7 stroke-[3]" /> : <X className="w-7 h-7 stroke-[3]" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className={`grid gap-3.5 ${
                currentQuestion.options.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
              }`}
            >
              {currentQuestion.options.map((choice, idx) => {
                const isSelected = selectedChoice === choice;
                const isRightOption = choice.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

                let btnStyle = cardColors[idx % cardColors.length];
                if (selectedChoice !== null) {
                  if (isRightOption) {
                    btnStyle = 'bg-emerald-500 border-emerald-300 text-slate-950 ring-4 ring-emerald-400/40';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-600 border-rose-400 text-white';
                  } else {
                    btnStyle = 'bg-slate-900 border-slate-800 text-slate-500 opacity-50';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={selectedChoice !== null}
                    onClick={() => handleSelectOption(choice)}
                    dir="auto"
                    className={`p-5 rounded-2xl border-b-4 font-black text-lg sm:text-xl text-center transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-95 shadow-lg ${btnStyle}`}
                  >
                    <span className="flex-1">{choice}</span>
                    {selectedChoice !== null && isRightOption && <CheckCircle2 className="w-6 h-6 shrink-0" />}
                    {selectedChoice !== null && isSelected && !isRightOption && <XCircle className="w-6 h-6 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Blooket 3-Chest Gold Quest Bonus Modal */}
      <AnimatePresence>
        {showChestBonus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-lg w-full p-6 text-center space-y-5 shadow-2xl"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black">
                <Gift className="w-4 h-4" />
                <span>إجابة صحيحة! مكافأة صناديق الذهب (Blooket Gold Quest)</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">اختر صندوق كنز واحد لزيادة ذهبك! 🎁</h3>

              <div className="grid grid-cols-3 gap-3 pt-2">
                {chestOptions.map((c, i) => {
                  const isOpened = openedChestIndex === i;
                  const isOther = openedChestIndex !== null && openedChestIndex !== i;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={openedChestIndex !== null}
                      onClick={() => handlePickChest(i)}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                        isOpened
                          ? 'bg-amber-400/25 border-amber-300 scale-105 shadow-lg shadow-amber-500/30'
                          : isOther
                          ? 'bg-slate-950 border-slate-800 opacity-50'
                          : 'bg-slate-800 hover:bg-slate-700 border-amber-400/50 hover:scale-105'
                      }`}
                    >
                      <span className="text-4xl sm:text-5xl select-none">{isOpened ? '👑' : '🎁'}</span>
                      <span className="text-xs font-black text-amber-300">
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
