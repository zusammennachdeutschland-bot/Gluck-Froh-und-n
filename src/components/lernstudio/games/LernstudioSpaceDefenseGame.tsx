import React, { useState, useEffect, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../../types/lernstudio';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Shield,
  Rocket,
  Flame,
  Volume2,
  Users,
  User,
  Sparkles,
  Zap
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

interface AlienShip {
  id: string;
  item: LernstudioItem;
  xPercent: number;
  yPercent: number;
  color: string;
  isTarget: boolean;
  destroyed: boolean;
}

const SHIP_COLORS = [
  'from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-indigo-500/40',
  'from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-cyan-500/40',
  'from-rose-600 to-pink-600 border-rose-400 text-white shadow-rose-500/40',
  'from-emerald-600 to-teal-600 border-emerald-400 text-white shadow-emerald-500/40',
  'from-amber-600 to-orange-600 border-amber-400 text-white shadow-amber-500/40'
];

export const LernstudioSpaceDefenseGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const items = useMemo(() => set.items || [], [set.items]);

  // Game Settings
  const [playMode, setPlayMode] = useState<'solo' | 'teams'>('solo');
  const [currentTeamTurn, setCurrentTeamTurn] = useState<1 | 2>(1);
  const [teamScores, setTeamScores] = useState({ team1: 0, team2: 0 });

  // Game Play State
  const [targetIndex, setTargetIndex] = useState(0);
  const [shields, setShields] = useState(100);
  const [streak, setStreak] = useState(0);
  const [ships, setShips] = useState<AlienShip[]>([]);
  const [laserBeam, setLaserBeam] = useState<{ targetX: number; targetY: number } | null>(null);
  const [explosion, setExplosion] = useState<{ x: number; y: number; text: string; correct: boolean } | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  const targetItem: LernstudioItem | undefined = items[targetIndex % items.length];

  // Spawn Alien Squad
  useEffect(() => {
    if (!targetItem || isGameOver || isVictory || items.length === 0) return;

    const distractors = items
      .filter((it) => it.id !== targetItem.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const candidates = [targetItem, ...distractors].sort(() => 0.5 - Math.random());

    const initialShips: AlienShip[] = candidates.map((it, idx) => ({
      id: `${it.id}_${Date.now()}_${idx}`,
      item: it,
      xPercent: 12 + idx * 24 + (Math.random() * 6 - 3),
      yPercent: 22 + (idx % 2 === 0 ? 0 : 18) + (Math.random() * 8 - 4),
      color: SHIP_COLORS[idx % SHIP_COLORS.length],
      isTarget: it.id === targetItem.id,
      destroyed: false
    }));

    setShips(initialShips);
  }, [targetIndex, isGameOver, isVictory, items]);

  // Target Click / Shoot
  const handleShootShip = (ship: AlienShip) => {
    if (ship.destroyed || isGameOver || isVictory || !targetItem) return;

    // Fire laser beam effect
    setLaserBeam({ targetX: ship.xPercent, targetY: ship.yPercent });
    setTimeout(() => setLaserBeam(null), 300);

    const isCorrect = ship.item.id === targetItem.id;

    // Trigger Explosion
    setExplosion({
      x: ship.xPercent,
      y: ship.yPercent,
      text: ship.item.german,
      correct: isCorrect
    });
    setTimeout(() => setExplosion(null), 900);

    // Mark ship destroyed
    setShips((prev) =>
      prev.map((s) => (s.id === ship.id ? { ...s, destroyed: true } : s))
    );

    if (isCorrect) {
      playLernstudioSound('powerup_rocket');
      playLernstudioSound('correct');
      speakGermanText(ship.item.german);

      const nextStreak = streak + 1;
      setStreak(nextStreak);
      const points = 100 + nextStreak * 30;

      if (playMode === 'teams') {
        setTeamScores((s) => ({
          ...s,
          [currentTeamTurn === 1 ? 'team1' : 'team2']:
            s[currentTeamTurn === 1 ? 'team1' : 'team2'] + points
        }));
        // Switch turn to team 2
        setCurrentTeamTurn((cur) => (cur === 1 ? 2 : 1));
      } else {
        setTeamScores((s) => ({ ...s, team1: s.team1 + points }));
      }

      if (targetIndex + 1 >= items.length) {
        setIsVictory(true);
      } else {
        setTimeout(() => {
          setTargetIndex((prev) => prev + 1);
        }, 500);
      }
    } else {
      playLernstudioSound('powerup_boom');
      playLernstudioSound('wrong');
      setStreak(0);
      setShields((prev) => {
        const next = prev - 25;
        if (next <= 0) setIsGameOver(true);
        return Math.max(0, next);
      });

      if (playMode === 'teams') {
        setCurrentTeamTurn((cur) => (cur === 1 ? 2 : 1));
      }
    }
  };

  const handleRestart = () => {
    setTargetIndex(0);
    setShields(100);
    setStreak(0);
    setTeamScores({ team1: 0, team2: 0 });
    setIsGameOver(false);
    setIsVictory(false);
    setShips([]);
    setLaserBeam(null);
    setExplosion(null);
    setCurrentTeamTurn(1);
  };

  return (
    <div
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-slate-950 text-white flex flex-col justify-between"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-primary hover:text-white transition-all cursor-pointer border border-slate-700 inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>

          <div>
            <h1 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <span>🚀 معركة الدفاع الفضائي (Space Defender)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                {displayTitle}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-bold">
              استهدف سفينة الفضاء التي تحمل الكلمة الألمانية الصحيحة ودمرها قبل وصولها!
            </p>
          </div>
        </div>

        {/* Mode Selector and Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setPlayMode('solo');
                handleRestart();
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                playMode === 'solo' ? 'bg-primary text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>فردي</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlayMode('teams');
                handleRestart();
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                playMode === 'teams' ? 'bg-primary text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>فريقين</span>
            </button>
          </div>

          {/* Shields Health */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black">
            <Shield className="w-4 h-4" />
            <span>درع الكوكب: {shields}%</span>
          </div>

          {/* Score display */}
          {playMode === 'teams' ? (
            <div className="flex items-center gap-2 text-xs font-black">
              <span
                className={`px-2.5 py-1 rounded-lg border ${
                  currentTeamTurn === 1 ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-700'
                }`}
              >
                الأزرق: {teamScores.team1}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg border ${
                  currentTeamTurn === 2 ? 'bg-rose-600 border-rose-400' : 'bg-slate-800 border-slate-700'
                }`}
              >
                الأحمر: {teamScores.team2}
              </span>
            </div>
          ) : (
            <div className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-black text-xs shadow-xs">
              {teamScores.team1} نقطة
            </div>
          )}

          <button
            type="button"
            onClick={handleRestart}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="إعادة اللعبة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Mission Command Console */}
      {targetItem && !isGameOver && !isVictory && (
        <div className="bg-slate-900/80 border-2 border-cyan-500/40 rounded-2xl p-3.5 text-center space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-3">
            <span>
              {playMode === 'teams'
                ? `دور إطلاق النار: ${currentTeamTurn === 1 ? 'الفريق الأزرق 🔵' : 'الفريق الأحمر 🔴'}`
                : 'رادار الرصد الفضائي'}
            </span>
            <span className="font-mono text-cyan-400">
              هدف {targetIndex + 1} من {items.length}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 pt-1">
            {targetItem.emoji && <span className="text-3xl select-none">{targetItem.emoji}</span>}
            <h2 className="text-2xl sm:text-3xl font-black text-cyan-300">
              {getItemTranslation(targetItem, language)}
            </h2>
            <button
              type="button"
              onClick={() => speakGermanText(targetItem.german)}
              className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-white transition-colors cursor-pointer"
              title="نطق الكلمة"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Deep Space Battle Field */}
      <div className="relative flex-1 min-h-[380px] sm:min-h-[440px] bg-radial from-slate-900 via-slate-950 to-black border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4">
        {/* Twinkling Stars Background */}
        <div className="absolute inset-0 opacity-40 pointer-events-none select-none">
          <div className="absolute top-6 left-10 text-xs">⭐</div>
          <div className="absolute top-24 left-1/4 text-xs">✨</div>
          <div className="absolute top-16 right-1/4 text-xs">⭐</div>
          <div className="absolute top-36 right-12 text-xs">✨</div>
          <div className="absolute bottom-20 left-12 text-xs">⭐</div>
          <div className="absolute bottom-32 right-1/3 text-xs">✨</div>
        </div>

        {/* Laser Beam Visual */}
        {laserBeam && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
            <line
              x1="50%"
              y1="90%"
              x2={`${laserBeam.targetX}%`}
              y2={`${laserBeam.targetY}%`}
              stroke="#06B6D4"
              strokeWidth="4"
              strokeDasharray="8 4"
              className="animate-pulse"
            />
          </svg>
        )}

        {/* Alien Ships Fleet */}
        {!isGameOver &&
          !isVictory &&
          ships.map((ship) => {
            if (ship.destroyed) return null;

            return (
              <div
                key={ship.id}
                onClick={() => handleShootShip(ship)}
                style={{
                  left: `${ship.xPercent}%`,
                  top: `${ship.yPercent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className="absolute z-20 cursor-crosshair transition-transform hover:scale-110 active:scale-95 flex flex-col items-center select-none"
              >
                {/* Ship Body */}
                <div
                  className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-gradient-to-br border-2 flex items-center gap-2 shadow-xl ${ship.color}`}
                >
                  <span className="text-xl">🛸</span>
                  <span className="text-xs sm:text-sm font-black font-mono tracking-tight break-words">
                    {ship.item.german}
                  </span>
                </div>
                {/* Thruster Glow */}
                <div className="w-3 h-2 bg-cyan-400 rounded-b-full shadow-lg shadow-cyan-400/80 animate-ping -mt-0.5" />
              </div>
            );
          })}

        {/* Explosion Effect Flash */}
        {explosion && (
          <div
            style={{
              left: `${explosion.x}%`,
              top: `${explosion.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            className="absolute z-40 pointer-events-none flex flex-col items-center animate-scale-up"
          >
            <span className="text-5xl">{explosion.correct ? '💥🚀' : '⚡🛡️'}</span>
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-lg text-white shadow-lg ${
                explosion.correct ? 'bg-cyan-500' : 'bg-red-500'
              }`}
            >
              {explosion.text}
            </span>
          </div>
        )}

        {/* Defender Earth Rocket at Bottom */}
        {!isGameOver && !isVictory && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none select-none">
            <div className="p-3 bg-gradient-to-t from-cyan-600 to-blue-500 rounded-2xl border-2 border-cyan-300 shadow-2xl text-3xl">
              🚀
            </div>
            <div className="w-4 h-4 bg-orange-500 rounded-b-full shadow-lg shadow-orange-500 animate-pulse" />
          </div>
        )}

        {/* Victory Screen */}
        {isVictory && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-50">
            <div className="p-4 bg-cyan-500/10 text-cyan-400 rounded-3xl border border-cyan-500/30">
              <Trophy className="w-16 h-16" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              انتصار أسطوري! تم تدمير جميع الأهداف الفضائية! 🚀🎉
            </h2>
            <p className="text-sm font-bold text-slate-300">
              {playMode === 'teams'
                ? `الفائز: ${
                    teamScores.team1 > teamScores.team2
                      ? 'الفريق الأزرق 🔵'
                      : teamScores.team2 > teamScores.team1
                      ? 'الفريق الأحمر 🔴'
                      : 'تعادل الفريقين!'
                  }`
                : `جمعت ${teamScores.team1} نقطة بدرع كوكب ${shields}%!`}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-2xl font-black text-sm shadow-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>معركة جديدة</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 bg-slate-800 text-white border border-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all cursor-pointer"
              >
                العودة للألعاب
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-50">
            <div className="text-5xl">💥</div>
            <h2 className="text-xl sm:text-2xl font-black text-rose-400">
              تم اختراق دروع الكوكب!
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400">
              تدرب على الكلمات الألمانية وصوّب بدقة للدفاع عن المجرة.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-2xl font-black text-sm shadow-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 bg-slate-800 text-white border border-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all cursor-pointer"
              >
                العودة للألعاب
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
