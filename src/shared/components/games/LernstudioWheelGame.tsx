import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, TeamScore } from '../../../types/lernstudio';
import { buildDynamicQuestionPool, GameQuestion } from '../../../utils/lernstudioQuestionAdapter';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { GameStageBanner } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import {
  RotateCcw,
  ArrowRight,
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Volume2,
  VolumeX,
  Play
} from 'lucide-react';

import { GameSetupConfig } from '../LernstudioGameSetupScreen';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onBack: () => void;
}

import {
  getLernstudioTranslations,
  getLocalizedSetTitle,
  getWheelSegments,
  getLocalizedTeamName,
  WheelSegment
} from '../../../utils/lernstudioTranslations';

export const LernstudioWheelGame: React.FC<Props> = ({ set, activeTheme, language = 'ar', gameConfig, onBack }) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);
  const segments = useMemo(() => getWheelSegments(language), [language]);
  const { triggerSparkles, triggerScorePopup, EffectsOverlay, SettingsBar } = useGameEffects(language);

  // Teams setup
  const [teams, setTeams] = useState<TeamScore[]>([
    { id: 'team_1', name: getLocalizedTeamName('team_1', language), color: '#3B82F6', score: 0 },
    { id: 'team_2', name: getLocalizedTeamName('team_2', language), color: '#EF4444', score: 0 }
  ]);
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(gameConfig?.enableSoundFx ?? true);

  // Wheel state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<WheelSegment | null>(null);

  // Question state
  const questionsPool = useMemo(
    () =>
      buildDynamicQuestionPool(set, language, {
        questionModeFilter: gameConfig?.questionType || 'mixed'
      }),
    [set, language, gameConfig?.questionType]
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<GameQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answeredState, setAnsweredState] = useState<'pending' | 'correct' | 'wrong' | null>(null);
  const [sentenceArranged, setSentenceArranged] = useState<string[]>([]);
  const [eventAlert, setEventAlert] = useState<string | null>(null);

  const activeTeam = teams[activeTeamIndex] || teams[0];

  // Draw wheel on canvas
  const drawWheel = (rotationAngle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 15;
    const numSegments = segments.length;
    const arc = (2 * Math.PI) / numSegments;

    ctx.clearRect(0, 0, width, height);

    // Save and rotate
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle);

    // Outer wheel ring
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#1E293B';
    ctx.fill();

    // Slices
    segments.forEach((seg, i) => {
      const angle = i * arc;
      ctx.beginPath();
      ctx.fillStyle = seg.color;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + arc);
      ctx.lineTo(0, 0);
      ctx.fill();

      // Divider stroke
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.fillStyle = seg.textColor;
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.rotate(angle + arc / 2);
      ctx.translate(radius - 20, 0);
      ctx.fillText(seg.label, 0, 0);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, 2 * Math.PI);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();

    // Fixed Top Pointer
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = '#EF4444';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.moveTo(centerX - 14, 18);
    ctx.lineTo(centerX + 14, 18);
    ctx.lineTo(centerX, 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  useEffect(() => {
    drawWheel(currentRotation);
  }, [currentRotation]);

  // Spin wheel action
  const handleSpin = () => {
    if (isSpinning || activeQuestion) return;

    setIsSpinning(true);
    setSelectedSegment(null);
    setEventAlert(null);

    const spinRotations = 4 + Math.random() * 4; // 4 to 8 full turns
    const randomStopOffset = Math.random() * (2 * Math.PI);
    const totalRotationTarget = currentRotation + spinRotations * 2 * Math.PI + randomStopOffset;

    const start = performance.now();
    const duration = 4000;
    const initialRot = currentRotation;

    let lastTickAngle = initialRot;

    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const newRot = initialRot + (totalRotationTarget - initialRot) * ease;

      setCurrentRotation(newRot);

      // Play tick sound on passing slices
      if (soundEnabled && Math.abs(newRot - lastTickAngle) > 0.4) {
        playLernstudioSound('wheel_spin');
        lastTickAngle = newRot;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        // Calculate landed segment (pointer at top: -PI/2)
        const numSegments = segments.length;
        const arc = (2 * Math.PI) / numSegments;
        const normalized = ((3 * Math.PI) / 2 - (newRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const landedIndex = Math.floor(normalized / arc) % numSegments;
        const landed = segments[landedIndex] || segments[0];
        setSelectedSegment(landed);
        handleLandedSegment(landed);
      }
    };

    requestAnimationFrame(animate);
  };

  const handleLandedSegment = (seg: WheelSegment) => {
    if (seg.type === 'bonus') {
      // Direct bonus points
      if (soundEnabled) playLernstudioSound('powerup_star');
      const bonusText = language === 'ar'
        ? `🎉 مكافأة حظ سعيدة! حصل ${activeTeam.name} على ${seg.value} نقطة مباشرة دون سؤال!`
        : language === 'de'
        ? `🎉 ${t.luckyBonusAlert} ${activeTeam.name} erhält ${seg.value} ${t.pointsUnit} ohne Frage!`
        : `🎉 ${t.luckyBonusAlert} ${activeTeam.name} gets ${seg.value} ${t.pointsUnit} without a question!`;
      setEventAlert(bonusText);
      awardActiveTeamPoints(seg.value);
      setTimeout(nextTeamTurn, 2500);
    } else if (seg.type === 'steal') {
      // Steal points from another team
      if (soundEnabled) playLernstudioSound('powerup_steal');
      const otherTeam = teams.find((_, idx) => idx !== activeTeamIndex);
      if (otherTeam && otherTeam.score > 0) {
        const stolen = Math.min(otherTeam.score, seg.value);
        setTeams((prev) =>
          prev.map((t, idx) => {
            if (idx === activeTeamIndex) return { ...t, score: t.score + stolen };
            if (t.id === otherTeam.id) return { ...t, score: Math.max(0, t.score - stolen) };
            return t;
          })
        );
        const stealMsg = language === 'ar'
          ? `🥷 سرقة نقاط! تم تحويل ${stolen} نقطة من ${otherTeam.name} إلى ${activeTeam.name}!`
          : language === 'de'
          ? `🥷 ${t.pointsStolenAlert} ${stolen} ${t.pointsUnit} von ${otherTeam.name} an ${activeTeam.name} übertragen!`
          : `🥷 ${t.pointsStolenAlert} ${stolen} ${t.pointsUnit} transferred from ${otherTeam.name} to ${activeTeam.name}!`;
        setEventAlert(stealMsg);
      } else {
        const zeroMsg = language === 'ar'
          ? `🥷 حاول ${activeTeam.name} السرقة لكن رصيد الخصم 0 نقاط!`
          : language === 'de'
          ? `🥷 ${activeTeam.name} versuchte zu stehlen, aber der Gegner hat 0 ${t.pointsUnit}!`
          : `🥷 ${activeTeam.name} attempted a steal, but rival has 0 ${t.pointsUnit}!`;
        setEventAlert(zeroMsg);
      }
      setTimeout(nextTeamTurn, 2500);
    } else {
      // Show question for points, double, or challenge
      const q = questionsPool[questionIndex % questionsPool.length] || questionsPool[0];
      setActiveQuestion(q);
      setSelectedAnswer(null);
      setAnsweredState(null);
      setSentenceArranged([]);
      setQuestionIndex((prev) => prev + 1);
    }
  };

  const awardActiveTeamPoints = (pts: number) => {
    setTeams((prev) =>
      prev.map((t, idx) => (idx === activeTeamIndex ? { ...t, score: t.score + pts } : t))
    );
  };

  const nextTeamTurn = () => {
    setActiveTeamIndex((prev) => (prev + 1) % teams.length);
    setSelectedSegment(null);
    setActiveQuestion(null);
    setEventAlert(null);
  };

  const handleAnswerSubmit = (isCorrect: boolean) => {
    if (answeredState) return;

    setAnsweredState(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      if (soundEnabled) {
        playLernstudioSound('correct');
        playGermanVoiceFeedback('correct');
      }
      let pts = selectedSegment?.value || 100;
      if (selectedSegment?.type === 'double') {
        pts = 200;
      }
      triggerSparkles(50, 45, '#f59e0b');
      triggerScorePopup(`+${pts} 🎡`, 50, 35, 'positive');
      awardActiveTeamPoints(pts);
    } else {
      if (soundEnabled) {
        playLernstudioSound('wrong');
        playGermanVoiceFeedback('wrong');
      }
    }

    setTimeout(() => {
      nextTeamTurn();
    }, isCorrect ? 2000 : 2800);
  };

  // Add / Remove teams
  const handleToggleTeamCount = (count: number) => {
    const newTeams: TeamScore[] = [
      { id: 'team_1', name: getLocalizedTeamName('team_1', language), color: '#3B82F6', score: 0 },
      { id: 'team_2', name: getLocalizedTeamName('team_2', language), color: '#EF4444', score: 0 }
    ];
    if (count >= 3) {
      newTeams.push({ id: 'team_3', name: getLocalizedTeamName('team_3', language), color: '#10B981', score: 0 });
    }
    if (count >= 4) {
      newTeams.push({ id: 'team_4', name: getLocalizedTeamName('team_4', language), color: '#F59E0B', score: 0 });
    }
    setTeams(newTeams);
    setActiveTeamIndex(0);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans select-none relative overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <EffectsOverlay />
      {/* Top Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 sm:px-6 flex items-center justify-between shrink-0">
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
            <span>🎡 {t.wheelGameTitle}</span>
            <span className="text-xs font-normal text-slate-400">· {displaySetTitle}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Team count switcher */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <span className="text-slate-400 px-2 flex items-center gap-1 text-[11px]">
              <Users className="w-3.5 h-3.5" /> {t.teamsLabel}
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

          <SettingsBar />
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={soundEnabled ? t.soundMute : t.soundUnmute}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
        <GameStageBanner
          mode="wheel"
          title={t.wheelGameTitle}
          subtitle={`${displaySetTitle} • ${language === 'ar' ? 'أدر عجلة الحظ الذهبية واكسب النقاط والمضاعفات!' : language === 'de' ? 'Drehe das goldene Glücksrad und sammle Punkte!' : 'Spin the golden wheel and earn bonus points!'}`}
          badgeText={`${t.currentTurnLabel} ${activeTeam.name}`}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full items-center">
        {/* Left Column: Teams & Active Turn */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-5 shadow-xl">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" /> {t.leaderboardTitle}
            </h2>
            <div className="space-y-3">
              {teams.map((team, idx) => {
                const isCurrent = idx === activeTeamIndex;
                return (
                  <div
                    key={team.id}
                    style={{ borderColor: isCurrent ? team.color : 'transparent' }}
                    className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-slate-700/80 shadow-lg scale-[1.02]'
                        : 'bg-slate-900/60 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: team.color }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{team.name}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-slate-900 shadow-xs animate-pulse">
                              {t.activeTurnBadge}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{t.teamNumber} {idx + 1}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-amber-300 font-mono">{team.score}</span>
                      <span className="text-[11px] text-slate-400 mr-1">{t.pointsUnit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Turn Guidance */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1">{t.turnNowOn}</span>
            <div className="inline-flex items-center gap-2 font-black text-base" style={{ color: activeTeam.color }}>
              <span className="w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: activeTeam.color }} />
              <span>{activeTeam.name}</span>
            </div>
          </div>

          {eventAlert && (
            <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm font-bold text-center">
              {eventAlert}
            </div>
          )}
        </div>

        {/* Center: The Wheel */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center relative">
          <div className="relative p-2 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={380}
              height={380}
              className="max-w-full drop-shadow-2xl rounded-full"
            />
            {/* Center Spin Button Overlay */}
            <button
              onClick={handleSpin}
              disabled={isSpinning || !!activeQuestion}
              className={`absolute w-24 h-24 rounded-full flex flex-col items-center justify-center font-black text-sm transition-transform cursor-pointer shadow-2xl ${
                isSpinning
                  ? 'bg-slate-800 text-slate-400 scale-95 border-4 border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 hover:scale-105 active:scale-95 border-4 border-white'
              }`}
            >
              <Sparkles className="w-5 h-5 mb-0.5" />
              <span>{isSpinning ? t.wheelSpinning : t.wheelSpinNow}</span>
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSpin}
              disabled={isSpinning || !!activeQuestion}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 text-white font-black text-sm shadow-xl hover:shadow-primary/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t.spinWheelFor} ({activeTeam.name})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Question Modal for landed segment */}
      {activeQuestion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 border-2 border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden p-6 text-white flex flex-col gap-5 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: activeTeam.color }} />
                <span className="font-bold text-sm" style={{ color: activeTeam.color }}>
                  {t.teamQuestion} {activeTeam.name}
                </span>
              </div>
              <div className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black">
                {selectedSegment?.label || `100 ${t.pointsUnit}`}
              </div>
            </div>

            {/* Question Body */}
            <div className="text-center py-2 space-y-3">
              {activeQuestion.emoji && <div className="text-4xl">{activeQuestion.emoji}</div>}
              <h2 className="text-lg sm:text-xl font-black text-white" dir="auto">
                {activeQuestion.prompt}
              </h2>
              {activeQuestion.subPrompt && (
                <p
                  className="text-sm text-amber-300 font-bold bg-slate-900/70 px-3 py-1.5 rounded-xl inline-block border border-slate-700"
                  dir="auto"
                >
                  {activeQuestion.subPrompt}
                </p>
              )}
            </div>

            {/* Answer Options */}
            {activeQuestion.options && activeQuestion.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {activeQuestion.options.map((opt, i) => {
                  const isSelected = selectedAnswer === opt;
                  const isCorrect = opt.trim().toLowerCase() === activeQuestion.correctAnswer.trim().toLowerCase();

                  let btnStyle = 'bg-slate-700 hover:bg-slate-600 text-white border-slate-600';
                  if (answeredState === 'correct' && isCorrect) {
                    btnStyle = 'bg-emerald-600 text-white border-emerald-400';
                  } else if (answeredState === 'wrong' && isSelected) {
                    btnStyle = 'bg-rose-600 text-white border-rose-400';
                  } else if (answeredState === 'wrong' && isCorrect) {
                    btnStyle = 'bg-emerald-600/70 text-white border-emerald-500';
                  }

                  return (
                    <button
                      key={i}
                      disabled={!!answeredState}
                      onClick={() => {
                        setSelectedAnswer(opt);
                        handleAnswerSubmit(isCorrect);
                      }}
                      className={`p-3.5 rounded-2xl border-2 text-sm font-black transition-all flex items-center justify-center cursor-pointer ${btnStyle}`}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sentence Builder pieces */}
            {activeQuestion.type === 'sentence_builder' && activeQuestion.sentencePieces && (
              <div className="space-y-4">
                <div className="min-h-12 p-3 bg-slate-900 rounded-2xl border border-slate-700 flex flex-wrap gap-2 items-center justify-center">
                  {sentenceArranged.length === 0 ? (
                    <span className="text-xs text-slate-500">{t.arrangeWordsOrder}</span>
                  ) : (
                    sentenceArranged.map((chunk, idx) => (
                      <span
                        key={idx}
                        onClick={() => {
                          if (answeredState) return;
                          setSentenceArranged((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer hover:bg-primary/80"
                      >
                        {chunk}
                      </span>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {activeQuestion.sentencePieces.map((piece, idx) => {
                    const isUsed = sentenceArranged.includes(piece);
                    return (
                      <button
                        key={idx}
                        disabled={isUsed || !!answeredState}
                        onClick={() => setSentenceArranged((prev) => [...prev, piece])}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isUsed
                            ? 'opacity-30 bg-slate-700 text-slate-400'
                            : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                        }`}
                      >
                        {piece}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={sentenceArranged.length === 0 || !!answeredState}
                  onClick={() => {
                    const built = sentenceArranged.join(' ').trim().toLowerCase();
                    const correct = activeQuestion.correctAnswer.trim().toLowerCase();
                    handleAnswerSubmit(built === correct);
                  }}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-colors cursor-pointer disabled:opacity-40"
                >
                  {t.confirmSentenceAnswer}
                </button>
              </div>
            )}

            {/* Teacher Quick Override Buttons */}
            <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
              <span>{t.teacherVerdict}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAnswerSubmit(true)}
                  disabled={!!answeredState}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t.markCorrect}
                </button>
                <button
                  onClick={() => handleAnswerSubmit(false)}
                  disabled={!!answeredState}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> {t.markWrong}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
