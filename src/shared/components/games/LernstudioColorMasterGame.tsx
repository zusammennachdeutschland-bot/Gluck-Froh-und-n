import React, { useState, useEffect } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioGameCompletionPayload } from '../../../types/lernstudio';
import { getLocalizedSetTitle } from '../../../utils/lernstudioTranslations';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/GameEffectsOverlay';
import { ArrowLeft, Volume2, RotateCcw, Palette, Heart, Clock } from 'lucide-react';
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

const PALETTE_COLORS = [
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-purple-500 to-indigo-600',
  'from-fuchsia-500 to-pink-600',
  'from-yellow-400 to-amber-600',
  'from-lime-400 to-emerald-600',
  'from-cyan-400 to-blue-500',
  'from-violet-400 to-purple-600'
];

export const LernstudioColorMasterGame: React.FC<Props> = ({
  set,
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const { triggerSparkles, triggerFloatingText, triggerConfetti } = useGameEffects();

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
  } = useTemplateGameSession('color_master', set, language, gameConfig, onGameComplete);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [coloredCount, setColoredCount] = useState(0);
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
    safePlayVoiceFeedback('noch_einmal');

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
    }, 1400);
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
      const nextColored = coloredCount + 1;
      setIsCorrect(true);
      safePlaySound('bubble_wash');
      safePlaySound('correct');
      safePlayVoiceFeedback('fantastisch');
      triggerSparkles(50, 45, '#ec4899');
      triggerFloatingText('+100 🎨 Fantastisch!', 50, 38, '#a855f7');
      setScore(nextScore);
      setColoredCount(nextColored);

      scheduleTimeout(() => {
        if (currentIndex + 1 >= totalQuestions) {
          setIsVictory(true);
          safePlaySound('fanfare_victory');
          safePlayVoiceFeedback('gewonnen');
          triggerConfetti();
          reportCompletion({
            score: nextScore,
            maxScore: totalQuestions * 100,
            passed: true
          });
        } else {
          setCurrentIndex((prev) => prev + 1);
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
          setTimeLeft(effectiveTimerSeconds);
        }
      }, 1200);
    } else {
      setIsCorrect(false);
      safePlaySound('wrong');
      safePlayVoiceFeedback('noch_einmal');
      const nextLives = lives - 1;
      setLives(nextLives);

      scheduleTimeout(() => {
        if (nextLives <= 0) {
          setIsGameOver(true);
          reportCompletion({
            score,
            maxScore: totalQuestions * 100,
            passed: false
          });
        } else {
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
          setTimeLeft(effectiveTimerSeconds);
        }
      }, 1600);
    }
  };

  const handleRestart = () => {
    resetSession();
    setCurrentIndex(0);
    setColoredCount(0);
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
    <div className="p-4 sm:p-6 rounded-3xl min-h-[85vh] flex flex-col justify-between bg-background text-text-main space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <GameStageBanner
        gameId="color_master"
        title="تلوين المفردات (Color Master)"
        subtitle={`${displayTitle} • ملونة: ${coloredCount}/${totalQuestions}`}
        emoji="🎨"
      />

      {/* Top Bar */}
      <div className="bg-surface border border-surface-border p-4 rounded-3xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 rounded-2xl bg-surface-hover text-text-muted hover:text-text-main cursor-pointer">
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <h1 className="text-base sm:text-lg font-black text-text-main">تلوين المفردات (Color Master)</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-black flex-wrap">
          {effectiveTimerSeconds > 0 && !isVictory && !isGameOver && (
            <span className={`px-3 py-1.5 rounded-xl flex items-center gap-1 ${timeLeft <= 4 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-surface-hover text-text-main'}`}>
              <Clock className="w-3.5 h-3.5" /> {timeLeft}s
            </span>
          )}
          <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 fill-current" /> {lives}/{maxLives}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-primary-soft text-primary">النقاط: {score}</span>
          <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            ملونة: {coloredCount}/{totalQuestions}
          </span>
        </div>
      </div>

      {/* Main Stage */}
      {!isVictory && !isGameOver ? (
        <div className="max-w-2xl w-full mx-auto my-auto space-y-6">
          <div className="bg-surface border border-surface-border p-6 rounded-3xl text-center space-y-4 shadow-sm relative">
            <div className="flex justify-center items-center gap-2 text-purple-500">
              <Palette className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-black">لون الكلمة بإصابة الإجابة الصحيحة!</span>
            </div>

            {/* Canvas Card with Color Splash Effect */}
            <div className={`p-8 rounded-3xl border-2 transition-all duration-700 bg-gradient-to-br ${isAnswerSubmitted && isCorrect ? PALETTE_COLORS[currentIndex % PALETTE_COLORS.length] + ' text-white scale-105 shadow-xl' : 'from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 border-dashed text-text-muted grayscale'}`}>
              <span className="text-7xl sm:text-8xl block select-none drop-shadow-md">
                {currentQuestion.emoji}
              </span>
              <p className="text-xs font-bold pt-2 opacity-90">
                {isAnswerSubmitted && isCorrect ? '✨ تم التلوين بالألوان الزاهية!' : '🎨 رسمة بحاجة إلى ألوان...'}
              </p>
            </div>

            {/* Target Prompt */}
            <div className="p-4 bg-primary-soft/40 border border-primary-border/30 rounded-2xl inline-flex items-center gap-3 justify-center w-full">
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
                className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer shrink-0"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Color Option Buttons */}
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
          <div className="w-24 h-24 rounded-2xl overflow-hidden border border-purple-500/40 mx-auto shadow-lg flex items-center justify-center">
            {isVictory ? (
              <SharedVictoryTrophyArt className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl">🎨💔</span>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-text-main">
              {isVictory ? 'معرض الألوان المكتمل! 🎨✨' : 'نفدت الألوان! حاول مرة أخرى 💔'}
            </h2>
            <p className="text-xs text-text-muted font-bold">
              {isVictory
                ? `جمعت ${score} نقطة ولونت جميع المفردات الـ ${totalQuestions} بألوان مذهلة!`
                : `جمعت ${score} نقطة ولونت ${coloredCount} من أصل ${totalQuestions} مفردات.`}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={handleRestart} className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-bold flex items-center gap-2 cursor-pointer">
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
