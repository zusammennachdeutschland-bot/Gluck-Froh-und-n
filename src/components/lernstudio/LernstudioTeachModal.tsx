import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LernstudioSet, LernstudioItem, LernstudioGameMode } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../utils/lernstudioTranslations';
import { speakGermanText } from '../../utils/audioSpeechUtils';
import {
  X,
  Volume2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  CheckCircle2,
  XCircle,
  Trophy,
  Star,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  set: LernstudioSet;
  language?: string;
  onClose: () => void;
  onLaunchGame?: (gameMode: LernstudioGameMode) => void;
}

interface TrueFalseQuestion {
  targetItem: LernstudioItem;
  displayedItem: LernstudioItem;
  isMatch: boolean;
}

interface Choice2Question {
  targetItem: LernstudioItem;
  choices: LernstudioItem[];
}

interface ChoiceAllQuestion {
  targetItem: LernstudioItem;
  choices: LernstudioItem[];
}

export const LernstudioTeachModal: React.FC<Props> = ({
  isOpen,
  set,
  language = 'ar',
  onClose,
  onLaunchGame
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);

  const STORAGE_KEY = `lernstudio_teach_progress_${set?.id || 'default'}`;
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [stageQuestionIndex, setStageQuestionIndex] = useState<number>(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [stars, setStars] = useState<number>(0);

  // Exercise interaction state
  const [selectedAnswer, setSelectedAnswer] = useState<string | boolean | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  // Load progress from localStorage
  useEffect(() => {
    if (!isOpen || !set) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.stage === 'number') {
          setCurrentStage(Math.min(Math.max(parsed.stage, 1), 5));
          setStageQuestionIndex(parsed.itemIndex || 0);
          setCompletedStages(parsed.completedStages || []);
          setStars(parsed.stars || 0);
        }
      }
    } catch (e) {
      console.warn('Could not load teach progress', e);
    }
  }, [isOpen, set?.id]);

  // Clean timer on unmount or modal close
  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, []);

  // Save progress
  const saveProgress = (stage: number, itemIndex: number, completed: number[], newStars: number) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          stage,
          itemIndex,
          completedStages: completed,
          stars: newStars,
          updatedAt: Date.now()
        })
      );
    } catch (e) {
      console.warn('Could not save teach progress', e);
    }
  };

  const handleResetProgress = () => {
    clearAutoAdvanceTimer();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    setCurrentStage(1);
    setStageQuestionIndex(0);
    setCompletedStages([]);
    setStars(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setFeedbackMessage('');
  };

  if (!isOpen || !set || !set.items || set.items.length === 0) return null;

  const items = set.items;

  // German Speech Synthesis (Android & Mobile Cross-Platform)
  const handleSpeakGerman = (text: string) => {
    speakGermanText(text);
  };

  // Auto-speak word in Stage 1 whenever item changes
  useEffect(() => {
    if (currentStage === 1 && items[stageQuestionIndex]) {
      const timer = setTimeout(() => {
        handleSpeakGerman(items[stageQuestionIndex].german);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentStage, stageQuestionIndex, items]);

  // Generate Questions for Stage 2 (True / False)
  const stage2Questions = useMemo<TrueFalseQuestion[]>(() => {
    return items.map((target, idx) => {
      const isMatch = items.length === 1 ? true : idx % 2 === 0;
      let displayed = target;
      if (!isMatch) {
        const distractors = items.filter((it) => it.id !== target.id);
        displayed = distractors[Math.floor(Math.random() * distractors.length)] || target;
      }
      return { targetItem: target, displayedItem: displayed, isMatch };
    });
  }, [items]);

  // Generate Questions for Stage 3 (2 Options Choice)
  const stage3Questions = useMemo<Choice2Question[]>(() => {
    return items.map((target) => {
      const distractors = items.filter((it) => it.id !== target.id);
      const distractor =
        distractors.length > 0
          ? distractors[Math.floor(Math.random() * distractors.length)]
          : { ...target, german: target.german + ' (آخرى)', arabic: 'اختيار آخر' };

      const choices = [target, distractor].sort(() => Math.random() - 0.5);
      return { targetItem: target, choices };
    });
  }, [items]);

  // Generate Questions for Stage 4 (Full Set Choice)
  const stage4Questions = useMemo<ChoiceAllQuestion[]>(() => {
    return items.map((target) => {
      const choices = [...items].sort(() => Math.random() - 0.5);
      return { targetItem: target, choices };
    });
  }, [items]);

  // Reset answer state when question index or stage changes
  const resetAnswerState = () => {
    clearAutoAdvanceTimer();
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setFeedbackMessage('');
  };

  // Stage Transitions
  const handleNextStage = (nextStageNum: number) => {
    clearAutoAdvanceTimer();
    const updatedCompleted = Array.from(new Set([...completedStages, currentStage]));
    setCompletedStages(updatedCompleted);
    setCurrentStage(nextStageNum);
    setStageQuestionIndex(0);
    resetAnswerState();
    saveProgress(nextStageNum, 0, updatedCompleted, stars + 2);
  };

  // --- Handlers for Stage 1 (Showcase) ---
  const handleStage1Next = () => {
    if (stageQuestionIndex + 1 < items.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      saveProgress(1, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 1 -> move to Stage 2 automatically
      handleNextStage(2);
    }
  };

  const handleStage1Prev = () => {
    if (stageQuestionIndex > 0) {
      const prevIdx = stageQuestionIndex - 1;
      setStageQuestionIndex(prevIdx);
      saveProgress(1, prevIdx, completedStages, stars);
    }
  };

  // --- Handlers for Stage 2 (True / False) ---
  const handleStage2NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage2Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(2, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 2 -> move to Stage 3
      handleNextStage(3);
    }
  };

  const handleStage2Answer = (userChoice: boolean) => {
    if (isAnswerSubmitted) return;
    const currentQ = stage2Questions[stageQuestionIndex];
    const correct = userChoice === currentQ.isMatch;

    setSelectedAnswer(userChoice);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);

    if (correct) {
      setStars((prev) => prev + 1);
      setFeedbackMessage('ممتاز! إجابة صحيحة 🌟');
      handleSpeakGerman(currentQ.targetItem.german);

      // Auto advance immediately after short success feedback
      clearAutoAdvanceTimer();
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleStage2NextQuestion();
      }, 800);
    } else {
      setFeedbackMessage(
        `إجابة خاطئة! الإجابة الصحيحة هي: الكلمة ${
          currentQ.isMatch ? 'مطابقة بالفعل' : 'غير مطابقة'
        } (${currentQ.targetItem.german} = ${currentQ.targetItem.arabic})`
      );
    }
  };

  // --- Handlers for Stage 3 (2 Choices) ---
  const handleStage3NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage3Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(3, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 3 -> move to Stage 4
      handleNextStage(4);
    }
  };

  const handleStage3Answer = (chosenItem: LernstudioItem) => {
    if (isAnswerSubmitted) return;
    const currentQ = stage3Questions[stageQuestionIndex];
    const correct = chosenItem.id === currentQ.targetItem.id;

    setSelectedAnswer(chosenItem.id);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);

    if (correct) {
      setStars((prev) => prev + 1);
      setFeedbackMessage('رائع جداً! إجابة صحيحة 👏');
      handleSpeakGerman(currentQ.targetItem.german);

      // Auto advance immediately after short success feedback
      clearAutoAdvanceTimer();
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleStage3NextQuestion();
      }, 800);
    } else {
      setFeedbackMessage(
        `اختيار خاطئ! الاختيار الصحيح هو: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
      );
    }
  };

  // --- Handlers for Stage 4 (Full Set Choices) ---
  const handleStage4NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage4Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(4, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 4 -> move to Stage 5
      handleNextStage(5);
    }
  };

  const handleStage4Answer = (chosenItem: LernstudioItem) => {
    if (isAnswerSubmitted && isCorrectAnswer) return; // allow retry if incorrect
    const currentQ = stage4Questions[stageQuestionIndex];
    const correct = chosenItem.id === currentQ.targetItem.id;

    setSelectedAnswer(chosenItem.id);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);

    if (correct) {
      setStars((prev) => prev + 1);
      setFeedbackMessage('بطل! إجابة صحيحة من بين كل الكلمات 🌟');
      handleSpeakGerman(currentQ.targetItem.german);

      // Auto advance immediately after short success feedback
      clearAutoAdvanceTimer();
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleStage4NextQuestion();
      }, 800);
    } else {
      setFeedbackMessage(
        `حاول مرة أخرى! الإجابة الصحيحة هي: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
      );
    }
  };

  // Stage Stepper Configuration
  const stagesList = useMemo(() => {
    if (language === 'de') {
      return [
        { num: 1, title: '1. Lernen', icon: '📖', desc: 'Vokabeln & Wiederholung' },
        { num: 2, title: '2. Richtig / Falsch', icon: '✔️', desc: 'Einfaches Zuordnen' },
        { num: 3, title: '3. Zwei Optionen', icon: '✌️', desc: 'Auswahl aus zwei Optionen' },
        { num: 4, title: '4. Alle Wörter', icon: '🎯', desc: 'Gesamten Wortschatz üben' },
        { num: 5, title: '5. Spiele', icon: '🏆', desc: 'Glückwunsch & Spiele' }
      ];
    } else if (language === 'en') {
      return [
        { num: 1, title: '1. Learning', icon: '📖', desc: 'Vocabulary & repetition' },
        { num: 2, title: '2. True / False', icon: '✔️', desc: 'Simple matching practice' },
        { num: 3, title: '3. Two Options', icon: '✌️', desc: 'Choose from two choices' },
        { num: 4, title: '4. All Words', icon: '🎯', desc: 'Practice all vocabulary' },
        { num: 5, title: '5. Games', icon: '🏆', desc: 'Congratulations & games' }
      ];
    }
    return [
      { num: 1, title: '١. التعلم', icon: '📖', desc: 'عرض الكلمات والتكرار' },
      { num: 2, title: '٢. صح أم غلط', icon: '✔️', desc: 'تمرين المطابقة البسيط' },
      { num: 3, title: '٣. إجابتين', icon: '✌️', desc: 'الاختيار من إجابتين' },
      { num: 4, title: '٤. كل الكلمات', icon: '🎯', desc: 'الاختيار من كل المجموعة' },
      { num: 5, title: '٥. الألعاب', icon: '🏆', desc: 'تهانينا واختيار اللعبة' }
    ];
  }, [language]);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fade-in"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up">
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between bg-surface shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-text-main truncate">
                  {t.teachModeTitle} - {displaySetTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold inline-flex items-center gap-1 shrink-0">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                  {stars}
                </span>
              </div>
              <p className="text-[11px] font-bold text-text-muted truncate">
                {set.topic} • {items.length} كلمات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleResetProgress}
              className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="إعادة التقدّم من البداية"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stages Stepper Nav */}
        <div className="bg-surface-hover/60 border-b border-surface-border px-3 py-2 overflow-x-auto shrink-0 scrollbar-none">
          <div className="flex items-center justify-between min-w-[500px] gap-1">
            {stagesList.map((stg) => {
              const isActive = currentStage === stg.num;
              const isDone = completedStages.includes(stg.num);

              return (
                <button
                  key={stg.num}
                  type="button"
                  onClick={() => {
                    setCurrentStage(stg.num);
                    setStageQuestionIndex(0);
                    resetAnswerState();
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate border ${
                    isActive
                      ? 'bg-primary text-white border-primary shadow-sm scale-[1.02]'
                      : isDone
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-surface/80 text-text-muted hover:bg-surface border-surface-border'
                  }`}
                >
                  <span className="text-sm">{isDone ? '✔️' : stg.icon}</span>
                  <span className="truncate">{stg.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-between text-center space-y-4">
          {/* ================= STAGE 1: Word Showcase & Auto Speech ================= */}
          {currentStage === 1 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-gradient-to-b from-primary-soft/30 to-surface border border-primary-border/30 rounded-3xl p-5 sm:p-8 space-y-4 shadow-xs relative">
                <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-black">
                  كلمة {stageQuestionIndex + 1} من {items.length}
                </span>

                {/* Emoji Display */}
                <div className="text-7xl sm:text-8xl pt-2 select-none">
                  {items[stageQuestionIndex].emoji || '🇩🇪'}
                </div>

                {/* German Word */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <h3 className="text-2xl sm:text-4xl font-black text-text-main tracking-tight font-mono" dir="ltr">
                      {items[stageQuestionIndex].german}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSpeakGerman(items[stageQuestionIndex].german)}
                      className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-2xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center active:scale-95"
                      title={t.listenAudio}
                    >
                      <Volume2 className="w-6 h-6" />
                    </button>
                  </div>

                  {items[stageQuestionIndex].plural && (
                    <p className="text-xs font-bold text-text-muted font-mono" dir="ltr">
                      Plural: <span className="text-text-main">{items[stageQuestionIndex].plural}</span>
                    </p>
                  )}
                </div>

                {/* Translation */}
                <div className="py-2 px-5 bg-surface rounded-2xl border border-surface-border inline-block shadow-2xs">
                  <span className="text-lg sm:text-xl font-black text-primary">
                    {getItemTranslation(items[stageQuestionIndex], language)}
                  </span>
                </div>

                {/* Example Sentence */}
                {(items[stageQuestionIndex].exampleSentenceGerman || items[stageQuestionIndex].exampleSentenceArabic) && (
                  <div className="p-3.5 bg-surface/90 border border-surface-border rounded-2xl space-y-1 text-right max-w-lg mx-auto">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      جملة توضيحية:
                    </span>
                    {items[stageQuestionIndex].exampleSentenceGerman && (
                      <div className="text-xs font-bold text-text-main font-mono flex items-center justify-between gap-2" dir="ltr">
                        <span>{items[stageQuestionIndex].exampleSentenceGerman}</span>
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(items[stageQuestionIndex].exampleSentenceGerman!)}
                          className="p-1 bg-surface-hover hover:bg-primary-soft text-primary rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {items[stageQuestionIndex].exampleSentenceArabic && (
                      <div className="text-xs font-bold text-text-muted">
                        {items[stageQuestionIndex].exampleSentenceArabic}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 2: True / False ================= */}
          {currentStage === 2 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الثانية: اختبار صح أم غلط</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage2Questions.length}
                  </span>
                </div>

                {/* Question Prompt */}
                <div className="space-y-3 py-2">
                  <div className="text-6xl sm:text-7xl select-none">
                    {stage2Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-text-muted">
                      ({getItemTranslation(stage2Questions[stageQuestionIndex].targetItem, language)})
                    </p>
                    <p className="text-sm font-bold text-text-main">
                      هل الكلمة الألمانية المطابقة هي:
                    </p>
                    <div className="text-2xl sm:text-3xl font-black text-primary font-mono py-1" dir="ltr">
                      "{stage2Questions[stageQuestionIndex].displayedItem.german}"
                    </div>
                  </div>
                </div>

                {/* True / False Choice Buttons */}
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                  <button
                    type="button"
                    disabled={isAnswerSubmitted}
                    onClick={() => handleStage2Answer(true)}
                    className={`py-3.5 px-4 rounded-2xl text-base sm:text-lg font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-sm ${
                      isAnswerSubmitted && selectedAnswer === true
                        ? isCorrectAnswer
                          ? 'bg-emerald-500 text-white border-emerald-500 scale-105'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span>صح (Richtig)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isAnswerSubmitted}
                    onClick={() => handleStage2Answer(false)}
                    className={`py-3.5 px-4 rounded-2xl text-base sm:text-lg font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-sm ${
                      isAnswerSubmitted && selectedAnswer === false
                        ? isCorrectAnswer
                          ? 'bg-emerald-500 text-white border-emerald-500 scale-105'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
                    }`}
                  >
                    <XCircle className="w-6 h-6" />
                    <span>غلط (Falsch)</span>
                  </button>
                </div>

                {/* Feedback Message */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {feedbackMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 3: 2 Choices Multiple Choice ================= */}
          {currentStage === 3 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الثالثة: الاختيار من إجابتين</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage3Questions.length}
                  </span>
                </div>

                {/* Target Item Display */}
                <div className="space-y-2 py-2">
                  <div className="text-6xl sm:text-7xl select-none">
                    {stage3Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-text-main">
                    {getItemTranslation(stage3Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">اختر الكلمة الألمانية المناسبة:</p>
                </div>

                {/* 2 Choice Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                  {stage3Questions[stageQuestionIndex].choices.map((choice) => {
                    const isSelected = selectedAnswer === choice.id;
                    const isTarget = choice.id === stage3Questions[stageQuestionIndex].targetItem.id;

                    let btnClass =
                      'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40';

                    if (isAnswerSubmitted) {
                      if (isTarget) {
                        btnClass = 'bg-emerald-500 text-white border-emerald-500 scale-[1.02] shadow-md';
                      } else if (isSelected && !isCorrectAnswer) {
                        btnClass = 'bg-red-500 text-white border-red-500';
                      } else {
                        btnClass = 'bg-surface/50 text-text-muted border-surface-border opacity-50';
                      }
                    }

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={isAnswerSubmitted}
                        onClick={() => handleStage3Answer(choice)}
                        className={`py-4 px-5 rounded-2xl text-lg font-black font-mono border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs ${btnClass}`}
                        dir="ltr"
                      >
                        <span>{choice.german}</span>
                        <Volume2
                          className="w-4 h-4 shrink-0 opacity-60 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeakGerman(choice.german);
                          }}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {feedbackMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 4: Full Set Choice ================= */}
          {currentStage === 4 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الرابعة: الاختيار من جميع كلمات الـ Set</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage4Questions.length}
                  </span>
                </div>

                {/* Target Item Display */}
                <div className="space-y-1 py-1">
                  <div className="text-5xl sm:text-6xl select-none">
                    {stage4Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-text-main">
                    {getItemTranslation(stage4Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">ابحث عن الكلمة الصحيحة بين جميع الخيارات:</p>
                </div>

                {/* All Options Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl mx-auto max-h-[220px] overflow-y-auto p-1">
                  {stage4Questions[stageQuestionIndex].choices.map((choice) => {
                    const isSelected = selectedAnswer === choice.id;
                    const isTarget = choice.id === stage4Questions[stageQuestionIndex].targetItem.id;

                    let btnClass =
                      'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40';

                    if (isAnswerSubmitted) {
                      if (isTarget) {
                        btnClass = 'bg-emerald-500 text-white border-emerald-500 scale-[1.02] shadow-md';
                      } else if (isSelected && !isCorrectAnswer) {
                        btnClass = 'bg-red-500 text-white border-red-500';
                      }
                    }

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => handleStage4Answer(choice)}
                        className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black font-mono border transition-all cursor-pointer flex items-center justify-center text-center gap-1.5 shadow-2xs ${btnClass}`}
                        dir="ltr"
                      >
                        <span className="truncate">{choice.german}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {feedbackMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 5: Game Suggestions & Victory ================= */}
          {currentStage === 5 && (
            <div className="w-full space-y-5 flex-1 flex flex-col items-center justify-center py-2 animate-scale-up">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-3xl text-center space-y-3 max-w-lg w-full">
                <div className="inline-flex p-3 bg-amber-500 text-white rounded-2xl shadow-lg">
                  <Trophy className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-text-main">
                    تهانينا يا بطل! 🏆🎉
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-text-muted mt-1">
                    أكملت جميع مراحل التعلّم والتمارين لـ ({displaySetTitle}) بنجاح! جمعت {stars} نجمة 🌟
                  </p>
                </div>
              </div>

              {/* Game Mode Recommendations Grid */}
              <div className="w-full space-y-2">
                <h4 className="text-xs font-black text-text-muted uppercase tracking-wider text-right">
                  اختر لعبة لمراجعة الكلمات:
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('wheel')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🎡</div>
                    <div className="text-xs font-black text-text-main">عجلة الحظ</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تدوير العجلة والأسئلة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('race')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🏎️</div>
                    <div className="text-xs font-black text-text-main">سباق السيارات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">التنافس بالإجابة السريعة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('memory')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🧠</div>
                    <div className="text-xs font-black text-text-main">لعبة الذاكرة</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">مطابقة البطاقات المفردة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('sorting')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🧩</div>
                    <div className="text-xs font-black text-text-main">ترتيب الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">سحب وإفلات العناصر</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('sentence_builder')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">📝</div>
                    <div className="text-xs font-black text-text-main">تكوين الجمل</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تركيب العناصر ٤ جمل</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('balloon_pop')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🎈</div>
                    <div className="text-xs font-black text-text-main">فرقعة البالونات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تحدي السرعة الفردي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('tictactoe')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">❌⭕</div>
                    <div className="text-xs font-black text-text-main">لعبة X-O الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">مواجهة فرق أو ضد الحاسوب</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('basket_catch')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🧺</div>
                    <div className="text-xs font-black text-text-main">سلة التقاط الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">التقاط المطر الصوتي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('tug_of_war')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🪢</div>
                    <div className="text-xs font-black text-text-main">تحدي شد الحبل</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تنافس فرق حماسي أو آلي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('word_ninja')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🥷</div>
                    <div className="text-xs font-black text-text-main">نينجا الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تقطيع الكلمات بالسيف</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('space_defense')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🚀</div>
                    <div className="text-xs font-black text-text-main">الدفاع الفضائي</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">معركة السفن والتصويب</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('whack_a_mole')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🔨</div>
                    <div className="text-xs font-black text-text-main">اضرب الخلد</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تحدي المطرقة السريعة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('word_detective')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🕵️‍♂️</div>
                    <div className="text-xs font-black text-text-main">المحقق وكلمة السر</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تخمين حروف الكلمة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('games_portal')}
                    className="p-3 bg-primary text-white border border-primary/20 rounded-2xl text-right transition-all hover:scale-[1.02] shadow-sm group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🎮</div>
                    <div className="text-xs font-black">بوابة الألعاب</div>
                    <div className="text-[10px] opacity-80 font-bold truncate">جميع وضعيات التحدي</div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="px-5 py-3.5 border-t border-surface-border bg-surface flex items-center justify-between shrink-0">
          {currentStage === 1 && (
            <>
              <button
                type="button"
                onClick={handleStage1Prev}
                disabled={stageQuestionIndex === 0}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-border disabled:opacity-40 text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <ChevronRight className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
                <span>الكلمة السابقة</span>
              </button>

              <span className="text-xs font-black text-text-muted font-mono">
                {stageQuestionIndex + 1} / {items.length}
              </span>

              <button
                type="button"
                onClick={handleStage1Next}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>{stageQuestionIndex + 1 < items.length ? 'الكلمة التالية' : 'الانتقال لـ صح أم غلط 🚀'}</span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 2 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'تحديد الإجابة الصحيحة') : 'اختر صح أو غلط'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage2NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage2Questions.length ? 'السؤال التالي' : 'الانتقال للمرحلة الثالثة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 3 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'تحديد الاختيار الصحيح') : 'اختر الإجابة المناسبة'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage3NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage3Questions.length ? 'السؤال التالي' : 'الانتقال للمرحلة الرابعة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 4 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'التعلم والاستمرار') : 'اختر من كل المجموعات'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage4NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage4Questions.length ? 'السؤال التالي' : 'إكمال التعلم والألعاب 🏆'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 5 && (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetProgress}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-primary" />
                <span>إعادة الدراسة من البداية</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
