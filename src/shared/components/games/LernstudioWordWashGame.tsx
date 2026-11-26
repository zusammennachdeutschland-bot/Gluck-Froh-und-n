import React, { useState, useEffect } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioGameCompletionPayload } from '../../../types/lernstudio';
import { getLocalizedSetTitle } from '../../../utils/lernstudioTranslations';
import { ArrowLeft, Volume2, RotateCcw, Droplets, Heart, Clock } from 'lucide-react';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import { GameSetupConfig } from '../LernstudioGameSetupScreen';
import { TemplateChoice, useTemplateGameSession } from './useTemplateGameQuestions';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
  onBack: () => void;
}

export const LernstudioWordWashGame: React.FC<Props> = ({
  set,
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay, SettingsBar } = useGameEffects(language);

  const {
    effectiveTimerSeconds,
    maxLives,
    questions,
    scheduleTimeout,
    safePlaySound,
    safePlayVoiceFeedback,
    safeSpeak,
    recordAttempt,
    reportCompletion,
    resetSession
  } = useTemplateGameSession('word_wash', set, language, gameConfig, onGameComplete);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [cleanCount, setCleanCount] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(maxLives);
  const [timeLeft, setTimeLeft] = useState<number>(effectiveTimerSeconds);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isVictory, setIsVictory] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    setLives(maxLives);
  }, [maxLives]);

  useEffect(() => {
    if (currentQuestion && !isVictory && !isGameOver) {
      const timer = scheduleTimeout(() => {
        safeSpeak(currentQuestion.speakText);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isVictory, isGameOver, currentQuestion, scheduleTimeout, safeSpeak]);

  useEffect(() => {
    if (!effectiveTimerSeconds || isVictory || isGameOver || isAnswerSubmitted || !currentQuestion) return;
    setTimeLeft(effectiveTimerSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeoutPenalty();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, effectiveTimerSeconds, isVictory, isGameOver, isAnswerSubmitted]);

  const handleTimeoutPenalty = () => {
    if (isAnswerSubmitted || isVictory || isGameOver) return;
    setIsAnswerSubmitted(true);
    setIsCorrect(false);
    recordAttempt(false);
    safePlaySound('wrong');
    safePlayVoiceFeedback('wrong');

    const nextLives = lives - 1;
    setLives(nextLives);
    scheduleTimeout(() => {
      if (nextLives <= 0) {
        setIsGameOver(true);
        reportCompletion({ score, maxScore: totalQuestions * 100, passed: false });
      } else {
        setIsAnswerSubmitted(false);
        setSelectedChoice(null);
        setIsCorrect(null);
        setTimeLeft(effectiveTimerSeconds);
      }
    }, 1200);
  };

  if (!currentQuestion || totalQuestions === 0) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-text-muted">هذه المجموعة تحتاج إلى كلمات إضافية للعب.</p>
        <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded-xl">عودة</button>
      </div>
    );
  }

  const handleSelectChoice = (choice: TemplateChoice) => {
    if (isAnswerSubmitted || isVictory || isGameOver) return;
    setSelectedChoice(choice.id);
    setIsAnswerSubmitted(true);
    recordAttempt(choice.isCorrect);

    if (choice.isCorrect) {
      const nextScore = score + 100;
      const nextClean = cleanCount + 1;
      setIsCorrect(true);
      safePlaySound('correct');
      safePlayVoiceFeedback('correct');
      triggerSparkles(50, 45, '#0ea5e9');
      triggerScorePopup('+100 🧼', 50, 35, 'positive');
      setScore(nextScore);
      setCleanCount(nextClean);

      scheduleTimeout(() => {
        if (currentIndex + 1 >= totalQuestions) {
          setIsVictory(true);
          safePlaySound('victory');
          safePlayVoiceFeedback('victory');
          triggerCelebration('جميع المفردات نظيفة ولامعة! 🧼', `النقاط: ${nextScore}`);
          reportCompletion({ score: nextScore, maxScore: totalQuestions * 100, passed: true });
        } else {
          setCurrentIndex((prev) => prev + 1);
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
          setTimeLeft(effectiveTimerSeconds);
        }
      }, 1000);
    } else {
      setIsCorrect(false);
      safePlaySound('wrong');
      safePlayVoiceFeedback('wrong');
      const nextLives = lives - 1;
      setLives(nextLives);

      scheduleTimeout(() => {
        if (nextLives <= 0) {
          setIsGameOver(true);
          reportCompletion({ score, maxScore: totalQuestions * 100, passed: false });
        } else if (currentIndex + 1 >= totalQuestions) {
          setIsVictory(true);
          reportCompletion({ score, maxScore: totalQuestions * 100, passed: true });
        } else {
          setCurrentIndex((prev) => prev + 1);
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
          setTimeLeft(effectiveTimerSeconds);
        }
      }, 1200);
    }
  };

  const handleRestart = () => {
    resetSession();
    setCurrentIndex(0);
    setCleanCount(0);
    setScore(0);
    setLives(maxLives);
    setTimeLeft(effectiveTimerSeconds);
    setIsAnswerSubmitted(false);
    setSelectedChoice(null);
    setIsCorrect(null);
    setIsVictory(false);
    setIsGameOver(false);
  };

  return (
    <div className="p-4 sm:p-6 rounded-3xl min-h-[85vh] flex flex-col justify-between bg-background text-text-main relative overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <EffectsOverlay />
      {/* Top Header */}
      <div className="bg-surface border border-surface-border p-4 rounded-3xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 rounded-2xl bg-surface-hover text-text-muted hover:text-text-main cursor-pointer">
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧼</span>
            <h1 className="text-base sm:text-lg font-black text-text-main">غسيل الكلمات (Word Wash)</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-black flex-wrap">
          <SettingsBar />
          {effectiveTimerSeconds > 0 && !isVictory && !isGameOver && (
            <span className={`px-3 py-1.5 rounded-xl flex items-center gap-1 ${timeLeft <= 4 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-surface-hover text-text-main'}`}>
              <Clock className="w-3.5 h-3.5" /> {timeLeft}s
            </span>
          )}
          <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 fill-current" /> {lives}/{maxLives}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-primary-soft text-primary">النقاط: {score}</span>
          <span className="px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            نظيفة: {cleanCount}/{totalQuestions}
          </span>
        </div>
      </div>

      {/* Main Stage */}
      {!isVictory && !isGameOver ? (
        <div className="max-w-2xl w-full mx-auto my-auto space-y-5">
          <GameStageBanner
            mode="word_wash"
            title="غسيل الكلمات (Word Wash)"
            subtitle={`${displayTitle} • امسح الفقاعات الصابونية لتكشف عن المفردات الألمانية اللامعة!`}
            badgeText={`${cleanCount}/${totalQuestions} 🧼`}
          />
          <div className="bg-sky-500/10 border border-sky-500/30 p-6 rounded-3xl text-center space-y-4 relative overflow-hidden shadow-sm">
            <div className="flex justify-center items-center gap-2 text-sky-600 dark:text-sky-400">
              <Droplets className="w-5 h-5 animate-bounce" />
              <span className="text-xs font-black">نظّف الكلمة باختيار الإجابة الصحيحة!</span>
            </div>

            {/* Soap & Bubble Covered Emoji */}
            <div className="relative inline-block py-2">
              <span className={`text-7xl sm:text-8xl transition-all duration-700 ${isAnswerSubmitted && isCorrect ? 'filter-none scale-110' : 'brightness-50 blur-[2px]'}`}>
                {currentQuestion.emoji}
              </span>
              {!isAnswerSubmitted && (
                <div className="absolute inset-0 flex items-center justify-center text-4xl select-none opacity-80 pointer-events-none">
                  🫧🧼🫧
                </div>
              )}
            </div>

            {/* Prompt Box */}
            <div className="p-4 bg-surface border border-surface-border rounded-2xl inline-flex items-center gap-3 justify-center w-full shadow-xs">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-text-main font-mono" dir="auto">
                  {currentQuestion.prompt}
                </h2>
                {currentQuestion.subPrompt && (
                  <p className="text-xs text-text-muted font-bold">{currentQuestion.subPrompt}</p>
                )}
              </div>
              <button
                onClick={() => safeSpeak(currentQuestion.speakText)}
                className="p-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors cursor-pointer shrink-0"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Choice Cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedChoice === choice.id;
              let btnStyle = 'bg-surface hover:bg-surface-hover text-text-main border-surface-border';

              if (isAnswerSubmitted) {
                if (choice.isCorrect) {
                  btnStyle = 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md';
                } else if (isSelected && !isCorrect) {
                  btnStyle = 'bg-red-500 text-white border-red-500';
                }
              }

              return (
                <button
                  key={choice.id}
                  disabled={isAnswerSubmitted}
                  onClick={() => handleSelectChoice(choice)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center shadow-xs ${btnStyle}`}
                >
                  {choice.emoji && <span className="text-2xl">{choice.emoji}</span>}
                  <span className="text-sm font-bold">{choice.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Victory / Game Over Screen */
        <div className="max-w-md w-full mx-auto my-auto bg-surface border border-surface-border p-8 rounded-3xl text-center space-y-6 shadow-2xl animate-scale-up">
          <div className="flex justify-center">
            {isVictory ? (
              <SharedVictoryTrophyArt className="w-28 h-28 rounded-3xl shadow-xl border-2 border-amber-400/50" />
            ) : (
              <div className="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-5xl">
                🧼💔
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-text-main">
              {isVictory ? 'جميع المفردات نظيفة ولامعة! 🧼✨' : 'نفد الصابون! حاول مرة أخرى 💔'}
            </h2>
            <p className="text-xs text-text-muted font-bold">
              {isVictory
                ? `جمعت ${score} نقطة ونظفت كافة الكلمات الـ ${totalQuestions} بنجاح!`
                : `جمعت ${score} نقطة ونظفت ${cleanCount} من أصل ${totalQuestions} كلمات.`}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={handleRestart} className="px-6 py-3 bg-sky-600 text-white rounded-2xl font-bold flex items-center gap-2 cursor-pointer">
              <RotateCcw className="w-4 h-4" /> إعادة اللعب
            </button>
            <button onClick={onBack} className="px-6 py-3 bg-surface-hover text-text-muted rounded-2xl font-bold cursor-pointer">
              القائمة الرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
