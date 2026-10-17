import React, { useState, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, TeamScore } from '../../../types/lernstudio';
import { buildDynamicQuestionPool, GameQuestion } from '../../../utils/lernstudioQuestionAdapter';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
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

import { getLernstudioTranslations, getLocalizedSetTitle } from '../../../utils/lernstudioTranslations';

export const LernstudioRaceGame: React.FC<Props> = ({ set, activeTheme, language = 'ar', onBack }) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);

  const [teams, setTeams] = useState<RaceTeam[]>([
    { id: 'team_1', name: isRtl ? 'الفريق الأزرق 🦅' : 'Team Blue 🦅', color: '#3B82F6', score: 0, distance: 0, streak: 0 },
    { id: 'team_2', name: isRtl ? 'الفريق الأحمر 🦁' : 'Team Red 🦁', color: '#EF4444', score: 0, distance: 0, streak: 0 }
  ]);
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [winnerTeam, setWinnerTeam] = useState<RaceTeam | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Questions
  const questionsPool = useMemo(() => buildDynamicQuestionPool(set), [set]);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [answeredState, setAnsweredState] = useState<'correct' | 'wrong' | null>(null);
  const [boostApplied, setBoostApplied] = useState(false);

  const activeTeam = teams[activeTeamIndex] || teams[0];
  const currentQuestion: GameQuestion = questionsPool[qIndex % questionsPool.length] || questionsPool[0];

  const handleToggleTeamCount = (count: number) => {
    if (count === 2) {
      setTeams([
        { id: 'team_1', name: 'الفريق الأزرق', color: '#3B82F6', score: 0, distance: 0, streak: 0 },
        { id: 'team_2', name: 'الفريق الأحمر', color: '#EF4444', score: 0, distance: 0, streak: 0 }
      ]);
    } else if (count === 3) {
      setTeams([
        { id: 'team_1', name: 'الفريق الأزرق', color: '#3B82F6', score: 0, distance: 0, streak: 0 },
        { id: 'team_2', name: 'الفريق الأحمر', color: '#EF4444', score: 0, distance: 0, streak: 0 },
        { id: 'team_3', name: 'الفريق الأخضر', color: '#10B981', score: 0, distance: 0, streak: 0 }
      ]);
    } else {
      setTeams([
        { id: 'team_1', name: 'الفريق الأزرق', color: '#3B82F6', score: 0, distance: 0, streak: 0 },
        { id: 'team_2', name: 'الفريق الأحمر', color: '#EF4444', score: 0, distance: 0, streak: 0 },
        { id: 'team_3', name: 'الفريق الأخضر', color: '#10B981', score: 0, distance: 0, streak: 0 },
        { id: 'team_4', name: 'الفريق الأصفر', color: '#F59E0B', score: 0, distance: 0, streak: 0 }
      ]);
    }
    setActiveTeamIndex(0);
    setWinnerTeam(null);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (answeredState) return;

    setAnsweredState(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      if (soundEnabled) {
        playLernstudioSound('race_vroom');
        playLernstudioSound('correct');
      }

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
        if (soundEnabled) playLernstudioSound('powerup_star');
        setWinnerTeam(updatedTeam);
        return;
      }
    } else {
      if (soundEnabled) playLernstudioSound('wrong');
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
    }, 1800);
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none" dir={isRtl ? 'rtl' : 'ltr'}>
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
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <span className="text-slate-400 px-2 flex items-center gap-1 text-[11px]">
              <Users className="w-3.5 h-3.5" /> الفرق:
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
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {/* Race Track Canvas/Lanes */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-wider">
              <Flag className="w-4 h-4 text-amber-400" /> مضمار السباق نحو خط النهاية
            </div>
            <div className="text-xs font-bold text-slate-400">
              الهدف: الوصول لخط النهاية (10 خطوات)
            </div>
          </div>

          {/* Lanes */}
          <div className="space-y-4">
            {teams.map((t, idx) => {
              const isCurrent = idx === activeTeamIndex;
              const percent = (t.distance / TARGET_DISTANCE) * 100;
              return (
                <div key={t.id} className="relative">
                  {/* Lane header */}
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5 px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className={isCurrent ? 'text-white font-black' : 'text-slate-400'}>{t.name}</span>
                      {t.streak >= 2 && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-400 font-black animate-pulse">
                          <Flame className="w-3.5 h-3.5 fill-amber-400" /> سرعة مضاعفة x2
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 font-mono">
                      {t.distance} / {TARGET_DISTANCE} خطوة · {t.score} نقطة
                    </div>
                  </div>

                  {/* Asphalt Track Lane */}
                  <div className="h-14 bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden flex items-center px-3 shadow-inner">
                    {/* Road markings */}
                    <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none opacity-20">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="w-1.5 h-6 bg-white/60 rounded-full" />
                      ))}
                    </div>

                    {/* Finish Line Flag Pattern */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/10 border-r-2 border-dashed border-amber-400/80 flex items-center justify-center">
                      <span className="text-xs">🏁</span>
                    </div>

                    {/* Moving Racer Car/Icon */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out flex items-center gap-1.5"
                      style={{ right: `calc(${100 - percent}% - 30px)` }}
                    >
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg border-2 border-white/80 transition-transform"
                        style={{ backgroundColor: t.color }}
                      >
                        🏎️
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white text-slate-900 shadow-xs hidden sm:inline-block">
                          دوره
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
          <div className="bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            {/* Active Team Banner */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full animate-ping" style={{ backgroundColor: activeTeam.color }} />
                <h3 className="text-base font-black" style={{ color: activeTeam.color }}>
                  سؤال الفريق المتسابق: {activeTeam.name}
                </h3>
              </div>
              {boostApplied && (
                <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-black">
                  <Zap className="w-4 h-4 fill-amber-300" /> تقدم خطوتين!
                </div>
              )}
            </div>

            {/* Question Text */}
            <div className="text-center py-2 space-y-2">
              {currentQuestion.emoji && <div className="text-4xl">{currentQuestion.emoji}</div>}
              <h2 className="text-xl sm:text-2xl font-black text-white">{currentQuestion.prompt}</h2>
              {currentQuestion.subPrompt && (
                <p className="text-sm text-slate-400 font-bold">{currentQuestion.subPrompt}</p>
              )}
            </div>

            {/* Answer Options */}
            {currentQuestion.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                      className={`p-4 rounded-2xl border-2 text-base font-black transition-all flex items-center justify-center cursor-pointer ${btnColor}`}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Teacher Fast Override */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>تحكيم المعلم المباشر:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAnswer(true)}
                  disabled={!!answeredState}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> احتساب فوز الخطوة
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  disabled={!!answeredState}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> احتساب تعطل
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory Celebration Modal */}
        {winnerTeam && (
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center gap-4 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-xl">
              🏆
            </div>
            <div>
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest block mb-1">
                بطل السباق الكبير!
              </span>
              <h2 className="text-3xl font-black" style={{ color: winnerTeam.color }}>
                مبروك لـ {winnerTeam.name}!
              </h2>
              <p className="text-slate-400 text-sm mt-2">
                وصل أولاً إلى خط النهاية بنتيجة {winnerTeam.score} نقطة!
              </p>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleRestart}
                className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black text-sm shadow-xl transition-colors cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> جولة سباق جديدة
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              >
                العودة للقائمة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
