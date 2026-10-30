import React, { useState, useMemo, useEffect } from 'react';
import { LernstudioSet, LernstudioTheme, TeamScore } from '../../../types/lernstudio';
import { buildDynamicQuestionPool, GameQuestion } from '../../../utils/lernstudioQuestionAdapter';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import {
  ArrowRight,
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  Flame,
  Flag,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

interface RaceTeam extends TeamScore {
  distance: number; // 0 to TARGET_DISTANCE
  streak: number;
}

const TARGET_DISTANCE = 10; // 10 steps to reach the finish line

import {
  getLernstudioTranslations,
  getLocalizedSetTitle,
  getLocalizedTeamName
} from '../../../utils/lernstudioTranslations';

export const LernstudioRaceGame: React.FC<Props> = ({ set, activeTheme, language = 'ar', onBack }) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay, SettingsBar } = useGameEffects(language);

  const [teams, setTeams] = useState<RaceTeam[]>([
    { id: 'team_1', name: getLocalizedTeamName('team_1', language), color: '#3B82F6', score: 0, distance: 0, streak: 0 },
    { id: 'team_2', name: getLocalizedTeamName('team_2', language), color: '#EF4444', score: 0, distance: 0, streak: 0 }
  ]);
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [winnerTeam, setWinnerTeam] = useState<RaceTeam | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Questions
  const questionsPool = useMemo(() => buildDynamicQuestionPool(set, language), [set, language]);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [answeredState, setAnsweredState] = useState<'correct' | 'wrong' | null>(null);
  const [boostApplied, setBoostApplied] = useState(false);
  const [sentenceArranged, setSentenceArranged] = useState<string[]>([]);

  const activeTeam = teams[activeTeamIndex] || teams[0];
  const currentQuestion: GameQuestion = questionsPool[qIndex % questionsPool.length] || questionsPool[0];

  useEffect(() => {
    setSentenceArranged([]);
  }, [qIndex]);

  const handleToggleTeamCount = (count: number) => {
    const newTeams: RaceTeam[] = [
      { id: 'team_1', name: getLocalizedTeamName('team_1', language), color: '#3B82F6', score: 0, distance: 0, streak: 0 },
      { id: 'team_2', name: getLocalizedTeamName('team_2', language), color: '#EF4444', score: 0, distance: 0, streak: 0 }
    ];
    if (count >= 3) {
      newTeams.push({ id: 'team_3', name: getLocalizedTeamName('team_3', language), color: '#10B981', score: 0, distance: 0, streak: 0 });
    }
    if (count >= 4) {
      newTeams.push({ id: 'team_4', name: getLocalizedTeamName('team_4', language), color: '#F59E0B', score: 0, distance: 0, streak: 0 });
    }
    setTeams(newTeams);
    setActiveTeamIndex(0);
    setWinnerTeam(null);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (answeredState) return;

    setAnsweredState(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      if (soundEnabled) {
        playLernstudioSound('engine_boost');
        playGermanVoiceFeedback('correct');
      }
      triggerSparkles(50, 40, activeTeam.color);
      triggerScorePopup('+100 🏎️', 50, 30, 'positive');

      const currentStreak = activeTeam.streak + 1;
      const isBoost = currentStreak >= 2;
      setBoostApplied(isBoost);

      const advanceSteps = isBoost ? 2 : 1;
      const newDistance = Math.min(TARGET_DISTANCE, activeTeam.distance + advanceSteps);
      const newScore = activeTeam.score + (isBoost ? 200 : 100);

      const updatedTeam = {
        ...activeTeam,
        distance: newDistance,
        score: newScore,
        streak: currentStreak
      };

      setTeams((prev) => prev.map((t, i) => (i === activeTeamIndex ? updatedTeam : t)));

      if (newDistance >= TARGET_DISTANCE) {
        if (soundEnabled) {
          playLernstudioSound('victory');
          playGermanVoiceFeedback('victory');
        }
        const victoryMsg =
          language === 'ar'
            ? `بطل السباق الكبير: ${updatedTeam.name}! 🏎️🏁`
            : language === 'de'
            ? `Großer Rennsieger: ${updatedTeam.name}! 🏎️🏁`
            : `Grand Race Champion: ${updatedTeam.name}! 🏎️🏁`;
        triggerCelebration(victoryMsg, `${t.scoreLabel}: ${updatedTeam.score}`);
        setWinnerTeam(updatedTeam);
        return;
      }
    } else {
      if (soundEnabled) {
        playLernstudioSound('wrong');
        playGermanVoiceFeedback('wrong');
      }
      setBoostApplied(false);
      setTeams((prev) =>
        prev.map((t, i) => (i === activeTeamIndex ? { ...t, streak: 0 } : t))
      );
    }

    setTimeout(() => {
      setAnsweredState(null);
      setSelectedOpt(null);
      setBoostApplied(false);
      setActiveTeamIndex((prev) => (prev + 1) % teams.length);
      setQIndex((prev) => prev + 1);
    }, isCorrect ? 2000 : 2800);
  };

  const handleRestart = () => {
    setTeams((prev) =>
      prev.map((t) => ({ ...t, distance: 0, score: 0, streak: 0 }))
    );
    setActiveTeamIndex(0);
    setWinnerTeam(null);
    setAnsweredState(null);
    setSelectedOpt(null);
    setQIndex(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none relative overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <EffectsOverlay />
      {/* Top Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowRight className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>
          <div className="h-6 w-px bg-slate-700 hidden sm:block" />
          <h1 className="text-sm sm:text-base font-black flex items-center gap-2">
            <span>🏎️ {t.raceGameTitle}</span>
            <span className="text-xs font-normal text-slate-400">· {displaySetTitle}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <SettingsBar />
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <span className="text-slate-400 px-2 flex items-center gap-1 text-[11px]">
              <Users className="w-3.5 h-3.5" /> {t.teamsLabel}:
            </span>
            {[2, 3, 4].map((cnt) => (
              <button
                key={cnt}
                onClick={() => handleToggleTeamCount(cnt)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  teams.length === cnt ? 'bg-primary text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
        </div>
      </div>

      {/* Main Track & Question Arena */}
      <div className="flex-1 p-3 sm:p-6 pb-32 sm:pb-16 max-w-6xl mx-auto w-full flex flex-col gap-3 sm:gap-6 overflow-y-auto">
        <div className="hidden sm:block">
          <GameStageBanner
            mode="race"
            title={t.raceGameTitle}
            subtitle={
              language === 'ar'
                ? `${displaySetTitle} • تسابق نحو خط النهاية بالسرعة القصوى!`
                : language === 'de'
                ? `${displaySetTitle} • Rase mit Höchstgeschwindigkeit zur Ziellinie!`
                : `${displaySetTitle} • Race to the finish line at top speed!`
            }
            badgeText={`🏁 ${activeTeam.distance}/${TARGET_DISTANCE}`}
          />
        </div>

        {/* Race Track Canvas/Lanes */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl relative overflow-hidden shrink-0">
          <div className="flex items-center justify-between mb-2 sm:mb-4 pb-2 border-b border-slate-800 text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5 sm:gap-2 font-black text-slate-400 uppercase tracking-wider">
              <Flag className="w-3.5 h-3.5 text-amber-400" /> {language === 'ar' ? 'مضمار السباق' : language === 'de' ? 'Rennstrecke' : 'Race Track'}
            </div>
            <div className="font-bold text-slate-400">
              {language === 'ar' ? 'الهدف: الوصول لخط النهاية (10 خطوات)' : language === 'de' ? 'Ziel: Erreiche die Ziellinie (10 Schritte)' : 'Goal: Reach the finish line (10 steps)'}
            </div>
          </div>

          {/* Lanes */}
          <div className="space-y-2 sm:space-y-4">
            {teams.map((tItem, idx) => {
              const isCurrent = idx === activeTeamIndex;
              const percent = (tItem.distance / TARGET_DISTANCE) * 100;
              return (
                <div key={tItem.id} className="relative">
                  {/* Lane header */}
                  <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold mb-1 px-1">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: tItem.color }} />
                      <span className={isCurrent ? 'text-white font-black' : 'text-slate-400'}>{tItem.name}</span>
                      {tItem.streak >= 2 && (
                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-amber-400 font-black animate-pulse">
                          <Flame className="w-3 h-3 fill-amber-400" /> x2
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 font-mono text-[10px] sm:text-xs">
                      {tItem.distance}/{TARGET_DISTANCE} · {tItem.score}{t.pointsUnit}
                    </div>
                  </div>

                  {/* Asphalt Track Lane */}
                  <div className="h-10 sm:h-14 bg-slate-950 rounded-xl sm:rounded-2xl border border-slate-800 relative overflow-hidden flex items-center px-2 sm:px-3 shadow-inner">
                    {/* Road markings */}
                    <div className="absolute inset-0 flex items-center justify-between px-4 sm:px-6 pointer-events-none opacity-20">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="w-1 sm:w-1.5 h-4 sm:h-6 bg-white/60 rounded-full" />
                      ))}
                    </div>

                    {/* Finish Line Flag Pattern */}
                    <div className="absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-r from-transparent to-white/10 border-r-2 border-dashed border-amber-400/80 flex items-center justify-center">
                      <span className="text-[10px] sm:text-xs">🏁</span>
                    </div>

                    {/* Moving Racer Car/Icon */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out flex items-center gap-1 sm:gap-1.5"
                      style={{ right: `calc(${100 - percent}% - 24px)` }}
                    >
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center text-sm sm:text-lg shadow-lg border border-white/80 transition-transform"
                        style={{ backgroundColor: tItem.color }}
                      >
                        🏎️
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] sm:text-[10px] font-black px-1 py-0.5 rounded bg-white text-slate-900 shadow-xs hidden sm:inline-block">
                          {t.activeTurnBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question Panel for Active Team */}
        {!winnerTeam && (
          <div className="bg-slate-900/90 border-2 border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl flex flex-col gap-3 sm:gap-5 shrink-0">
            {/* Active Team Banner */}
            <div className="flex items-center justify-between pb-2 sm:pb-4 border-b border-slate-800 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full animate-ping" style={{ backgroundColor: activeTeam.color }} />
                <h3 className="text-xs sm:text-base font-black" style={{ color: activeTeam.color }}>
                  {t.teamQuestion}: {activeTeam.name}
                </h3>
              </div>
              {boostApplied && (
                <div className="flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-xl bg-amber-500/20 text-amber-300 text-[10px] sm:text-xs font-black">
                  <Zap className="w-3.5 h-3.5 fill-amber-300" /> {language === 'ar' ? 'تقدم خطوتين!' : language === 'de' ? '2 Schritte vorwärts!' : 'Advance 2 steps!'}
                </div>
              )}
            </div>

            {/* Question Text */}
            <div className="text-center py-1 sm:py-2 space-y-1 sm:space-y-2">
              {currentQuestion.emoji && <div className="text-2xl sm:text-4xl">{currentQuestion.emoji}</div>}
              <h2 className="text-base sm:text-2xl font-black text-white">{currentQuestion.prompt}</h2>
              {currentQuestion.subPrompt && (
                <p className="text-xs sm:text-sm text-slate-400 font-bold">{currentQuestion.subPrompt}</p>
              )}
            </div>

            {/* Sentence Builder Interactive Word Bank Tiles */}
            {currentQuestion.sentencePieces && currentQuestion.sentencePieces.length > 0 && (
              <div className="space-y-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="min-h-12 p-2.5 bg-slate-900 rounded-xl border border-slate-700 flex flex-wrap gap-1.5 items-center justify-center">
                  {sentenceArranged.length === 0 ? (
                    <span className="text-xs text-slate-500 font-medium">{t.arrangeWordsOrder}</span>
                  ) : (
                    sentenceArranged.map((chunk, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={!!answeredState}
                        onClick={() => {
                          setSentenceArranged((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-500 cursor-pointer"
                      >
                        {chunk}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 justify-center">
                  {currentQuestion.sentencePieces.map((piece, idx) => {
                    const countInArranged = sentenceArranged.filter((p) => p === piece).length;
                    const countInPieces = currentQuestion.sentencePieces!.filter((p) => p === piece).length;
                    const isFullyUsed = countInArranged >= countInPieces;

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isFullyUsed || !!answeredState}
                        onClick={() => {
                          const nextArranged = [...sentenceArranged, piece];
                          setSentenceArranged(nextArranged);
                          if (nextArranged.length === currentQuestion.sentencePieces!.length) {
                            const built = nextArranged.join(' ').trim().toLowerCase();
                            const expected = currentQuestion.correctAnswer.trim().toLowerCase();
                            handleAnswer(built === expected);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                          isFullyUsed
                            ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600 cursor-pointer active:scale-95'
                        }`}
                      >
                        {piece}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Answer Options */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1 sm:pt-2">
                {currentQuestion.options.map((opt, i) => {
                  const isSelected = selectedOpt === opt;
                  const isCorrect = opt.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

                  let btnColor = 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700';
                  if (answeredState === 'correct' && isCorrect) {
                    btnColor = 'bg-emerald-600 text-white border-emerald-400 shadow-lg';
                  } else if (answeredState === 'wrong' && isSelected) {
                    btnColor = 'bg-rose-600 text-white border-rose-400';
                  } else if (answeredState === 'wrong' && isCorrect) {
                    btnColor = 'bg-emerald-600/70 text-white border-emerald-500';
                  }

                  return (
                    <button
                      key={i}
                      disabled={!!answeredState}
                      onClick={() => {
                        setSelectedOpt(opt);
                        handleAnswer(isCorrect);
                      }}
                      className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-xs sm:text-base font-black transition-all flex items-center justify-center cursor-pointer ${btnColor}`}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Teacher Fast Override */}
            <div className="pt-2 sm:pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] sm:text-xs text-slate-400 flex-wrap gap-2">
              <span>{t.teacherVerdict}:</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => handleAnswer(true)}
                  disabled={!!answeredState}
                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold transition-colors cursor-pointer flex items-center gap-1 text-[11px] sm:text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t.markCorrect}
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  disabled={!!answeredState}
                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold transition-colors cursor-pointer flex items-center gap-1 text-[11px] sm:text-xs"
                >
                  <XCircle className="w-3.5 h-3.5" /> {t.markWrong}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory Celebration Modal */}
        {winnerTeam && (
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center gap-4 animate-scale-up">
            <SharedVictoryTrophyArt className="w-28 h-28 rounded-3xl shadow-xl border-2 border-amber-400/50" />
            <div>
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest block mb-1">
                {language === 'ar' ? 'بطل السباق الكبير!' : language === 'de' ? 'Großer Rennsieger!' : 'Grand Race Champion!'}
              </span>
              <h2 className="text-3xl font-black" style={{ color: winnerTeam.color }}>
                {language === 'ar' ? `مبروك لـ ${winnerTeam.name}!` : language === 'de' ? `Glückwunsch an ${winnerTeam.name}!` : `Congratulations ${winnerTeam.name}!`}
              </h2>
              <p className="text-slate-400 text-sm mt-2">
                {language === 'ar'
                  ? `وصل أولاً إلى خط النهاية بنتيجة ${winnerTeam.score} نقطة!`
                  : language === 'de'
                  ? `Erreichte zuerst die Ziellinie mit ${winnerTeam.score} Punkten!`
                  : `Reached the finish line first with ${winnerTeam.score} points!`}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleRestart}
                className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black text-sm shadow-xl transition-colors cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> {t.playAgain}
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              >
                {t.backToGames}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
