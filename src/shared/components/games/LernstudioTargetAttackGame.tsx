import React, { useState, useEffect, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioGameCompletionPayload } from '../../../types/lernstudio';
import { getLocalizedSetTitle } from '../../../utils/lernstudioTranslations';
import { ArrowLeft, Volume2, RotateCcw, Target, Clock } from 'lucide-react';
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

const TEAM_COLORS = [
  { badge: 'bg-red-500 text-white border-red-500 ring-red-400', pill: 'bg-red-500', icon: '🔴' },
  { badge: 'bg-blue-500 text-white border-blue-500 ring-blue-400', pill: 'bg-blue-500', icon: '🔵' },
  { badge: 'bg-emerald-500 text-white border-emerald-500 ring-emerald-400', pill: 'bg-emerald-500', icon: '🟢' },
  { badge: 'bg-amber-500 text-white border-amber-500 ring-amber-400', pill: 'bg-amber-500', icon: '🟡' }
];

export const LernstudioTargetAttackGame: React.FC<Props> = ({
  set,
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay, SettingsBar } = useGameEffects(language);

  const teamNames = useMemo(() => {
    const count =
      gameConfig?.gameMode === 'pvp_4teams'
        ? 4
        : gameConfig?.gameMode === 'pvp_3teams'
        ? 3
        : 2;
    return Array.from({ length: count }, (_, idx) => {
      const provided = gameConfig?.teamNames?.[idx]?.trim();
      return provided || (isRtl ? `فريق ${idx + 1}` : `Team ${idx + 1}`);
    });
  }, [gameConfig?.gameMode, gameConfig?.teamNames, isRtl]);

  const {
    effectiveTimerSeconds,
    questions,
    scheduleTimeout,
    safePlaySound,
    safePlayVoiceFeedback,
    safeSpeak,
    recordAttempt,
    reportCompletion,
    resetSession
  } = useTemplateGameSession('target_attack', set, language, gameConfig, onGameComplete);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTeam, setActiveTeam] = useState(0);
  const [teamScores, setTeamScores] = useState<number[]>(() => teamNames.map(() => 0));
  const [timeLeft, setTimeLeft] = useState<number>(effectiveTimerSeconds);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isVictory, setIsVictory] = useState(false);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    setTeamScores(teamNames.map(() => 0));
    setActiveTeam(0);
  }, [teamNames.length]);

  useEffect(() => {
    if (currentQuestion && !isVictory) {
      const timer = scheduleTimeout(() => {
        safeSpeak(currentQuestion.speakText);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isVictory, currentQuestion, scheduleTimeout, safeSpeak]);

  useEffect(() => {
    if (!effectiveTimerSeconds || isVictory || isAnswerSubmitted || !currentQuestion) return;
    setTimeLeft(effectiveTimerSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAdvanceWrong(teamScores);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, effectiveTimerSeconds, isVictory, isAnswerSubmitted]);

  const finishMatch = (finalScores: number[]) => {
    setIsVictory(true);
    safePlaySound('victory');
    safePlayVoiceFeedback('victory');
    triggerCelebration('إصابة مباشرة في منتصف الهدف! 🎯', 'مباراة رماية رائعة!');
    const teamScoresMap: Record<string, number> = {};
    teamNames.forEach((name, idx) => {
      teamScoresMap[name] = finalScores[idx] || 0;
    });
    const best = Math.max(0, ...finalScores);
    reportCompletion({
      score: best,
      maxScore: Math.max(100, Math.ceil(totalQuestions / teamNames.length) * 100),
      passed: best > 0,
      teamScores: teamScoresMap
    });
  };

  const handleAdvanceWrong = (currentScores: number[]) => {
    if (isAnswerSubmitted || isVictory) return;
    setIsAnswerSubmitted(true);
    setIsCorrect(false);
    recordAttempt(false);
    safePlaySound('wrong');
    safePlayVoiceFeedback('wrong');

    scheduleTimeout(() => {
      if (currentIndex + 1 >= totalQuestions) {
        finishMatch(currentScores);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setActiveTeam((prev) => (prev + 1) % teamNames.length);
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
    if (isAnswerSubmitted || isVictory) return;
    setSelectedChoice(choice.id);
    setIsAnswerSubmitted(true);
    recordAttempt(choice.isCorrect);

    if (choice.isCorrect) {
      setIsCorrect(true);
      safePlaySound('correct');
      safePlayVoiceFeedback('correct');
      triggerSparkles(50, 45, '#e11d48');
      triggerScorePopup('+100 🎯', 50, 35, 'positive');
      const nextScores = [...teamScores];
      nextScores[activeTeam] = (nextScores[activeTeam] || 0) + 100;
      setTeamScores(nextScores);

      scheduleTimeout(() => {
        if (currentIndex + 1 >= totalQuestions) {
          finishMatch(nextScores);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setActiveTeam((prev) => (prev + 1) % teamNames.length);
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
          setTimeLeft(effectiveTimerSeconds);
        }
      }, 1200);
    } else {
      handleAdvanceWrong(teamScores);
    }
  };

  const handleRestart = () => {
    resetSession();
    setCurrentIndex(0);
    setActiveTeam(0);
    setTeamScores(teamNames.map(() => 0));
    setTimeLeft(effectiveTimerSeconds);
    setIsAnswerSubmitted(false);
    setSelectedChoice(null);
    setIsCorrect(null);
    setIsVictory(false);
  };

  const bestScore = Math.max(0, ...teamScores);
  const leaders = teamNames.filter((_, idx) => teamScores[idx] === bestScore);
  const winningTeamName =
    leaders.length > 1
      ? (isRtl ? 'تعادل الفرق! 🤝' : 'Tie Game! 🤝')
      : `${leaders[0]} 🎯`;

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
            <span className="text-2xl">🎯</span>
            <h1 className="text-base sm:text-lg font-black text-text-main">رمي السهام (Target Attack)</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SettingsBar />
          {effectiveTimerSeconds > 0 && !isVictory && (
            <span className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 ${timeLeft <= 4 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-surface-hover text-text-main'}`}>
              <Clock className="w-3.5 h-3.5" /> {timeLeft}s
            </span>
          )}
          {teamNames.map((name, idx) => {
            const theme = TEAM_COLORS[idx % TEAM_COLORS.length];
            const isActive = activeTeam === idx;
            return (
              <div
                key={idx}
                className={`px-3 py-1.5 rounded-xl border font-black text-xs ${isActive ? `${theme.badge} shadow-md ring-2` : 'bg-surface text-text-muted border-surface-border'}`}
              >
                {theme.icon} {name}: {teamScores[idx] || 0} ن
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Stage */}
      {!isVictory ? (
        <div className="max-w-2xl w-full mx-auto my-auto space-y-5">
          <GameStageBanner
            mode="target_attack"
            title="رمي السهام (Target Attack)"
            subtitle={`${displayTitle} • صوّب السهم الذهبي في قلب الهدف عبر اختيار الترجمة الصحيحة!`}
            badgeText={`🎯 ${teamScores.join(' : ')}`}
          />
          <div className="bg-surface border border-surface-border p-6 rounded-3xl text-center space-y-4 shadow-sm relative">
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-black text-white ${TEAM_COLORS[activeTeam % TEAM_COLORS.length].pill}`}>
                دور {teamNames[activeTeam]} ({TEAM_COLORS[activeTeam % TEAM_COLORS.length].icon})
              </span>
              <span className="text-xs font-bold text-text-muted">الكلمة {currentIndex + 1} / {totalQuestions}</span>
            </div>

            {/* Target Ring Visual */}
            <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-white flex flex-col items-center justify-center gap-2">
              <Target className="w-16 h-16 text-rose-500 animate-spin" />
              <span className="text-xs text-rose-300 font-bold">تصويب مباشر نحو الهدف الصحيح!</span>
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

          {/* Choices Grid */}
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
                  {choice.emoji && <span className="text-3xl">{choice.emoji}</span>}
                  <span className="text-sm font-bold">{choice.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Victory Screen */
        <div className="max-w-md w-full mx-auto my-auto bg-surface border border-surface-border p-8 rounded-3xl text-center space-y-6 shadow-2xl animate-scale-up">
          <div className="flex justify-center">
            <SharedVictoryTrophyArt className="w-28 h-28 rounded-3xl shadow-xl border-2 border-amber-400/50" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-text-main">فوز {winningTeamName}! 🎉</h2>
            <div className="text-xs font-bold text-text-muted space-y-1">
              {teamNames.map((name, idx) => (
                <p key={idx}>نقاط {name}: {teamScores[idx] || 0}</p>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={handleRestart} className="px-6 py-3 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 cursor-pointer">
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
