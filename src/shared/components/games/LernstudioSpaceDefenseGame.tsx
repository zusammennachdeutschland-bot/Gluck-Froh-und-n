import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem, LernstudioGameCompletionPayload } from '../../../types/lernstudio';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  getSetVocabularyItems,
  getDistractorChoices,
  createSeededRandom,
  seededShuffle
} from '../../../utils/lernstudioVocabularyAdapter';
import { GameSetupConfig } from '../LernstudioGameSetupScreen';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import {
  ArrowLeft,
  RotateCcw,
  Shield,
  Volume2,
  Users,
  User
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
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
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const difficulty = gameConfig?.difficulty || set.difficulty || 'medium';
  const damagePerHit = difficulty === 'easy' ? 15 : difficulty === 'hard' ? 35 : 25;
  const enableAudio = gameConfig?.enableAudio ?? true;
  const enableSoundFx = gameConfig?.enableSoundFx ?? true;

  const [sessionSeed, setSessionSeed] = useState<number>(() => Date.now());
  const items = useMemo(
    () => getSetVocabularyItems(set, language, gameConfig?.questionCount, sessionSeed),
    [set, language, gameConfig?.questionCount, sessionSeed]
  );
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay, SettingsBar } = useGameEffects(language);

  // Game Settings
  const [playMode, setPlayMode] = useState<'solo' | 'teams'>(
    gameConfig?.gameMode && gameConfig.gameMode !== 'solo' ? 'teams' : 'solo'
  );
  const [currentTeamTurn, setCurrentTeamTurn] = useState<1 | 2>(1);
  const [teamScores, setTeamScores] = useState({ team1: 0, team2: 0 });
  const team1Label = gameConfig?.teamNames?.[0] || (language === 'ar' ? 'الفريق الأزرق 🔵' : 'Team Blue 🔵');
  const team2Label = gameConfig?.teamNames?.[1] || (language === 'ar' ? 'الفريق الأحمر 🔴' : 'Team Red 🔴');

  // Game Play State
  const [targetIndex, setTargetIndex] = useState(0);
  const [shields, setShields] = useState(100);
  const [streak, setStreak] = useState(0);
  const [ships, setShips] = useState<AlienShip[]>([]);
  const [laserBeam, setLaserBeam] = useState<{ targetX: number; targetY: number } | null>(null);
  const [explosion, setExplosion] = useState<{ x: number; y: number; text: string; correct: boolean } | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const correctRef = useRef(0);
  const totalRef = useRef(0);
  const reportedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  const reportCompletion = useCallback(
    (passed: boolean, nextTeamScores: { team1: number; team2: number }) => {
      if (reportedRef.current || !onGameComplete) return;
      reportedRef.current = true;
      const total = Math.max(1, items.length);
      onGameComplete({
        gameMode: 'space_defense',
        score: Math.max(nextTeamScores.team1, nextTeamScores.team2),
        maxScore: total * 150,
        accuracy: totalRef.current > 0 ? Math.min(100, Math.round((correctRef.current / totalRef.current) * 100)) : 0,
        passed,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        teamScores: playMode === 'teams' ? { [team1Label]: nextTeamScores.team1, [team2Label]: nextTeamScores.team2 } : undefined,
        difficulty
      });
    },
    [onGameComplete, items.length, playMode, team1Label, team2Label, difficulty]
  );

  const targetItem: LernstudioItem | undefined = items[targetIndex % Math.max(1, items.length)];

  // Spawn Seeded Alien Squad
  useEffect(() => {
    if (!targetItem || isGameOver || isVictory || items.length === 0) return;

    const rng = createSeededRandom(sessionSeed + targetIndex * 71);
    const distractors = getDistractorChoices(targetItem, items, 3, rng);
    const candidates = seededShuffle([targetItem, ...distractors], rng);

    const initialShips: AlienShip[] = candidates.map((it, idx) => ({
      id: `${it.id}_${targetIndex}_${idx}`,
      item: it,
      xPercent: Math.min(88, Math.max(12, 14 + idx * 24 + (rng() * 6 - 3))),
      yPercent: 22 + (idx % 2 === 0 ? 0 : 18) + (rng() * 8 - 4),
      color: SHIP_COLORS[idx % SHIP_COLORS.length],
      isTarget: it.id === targetItem.id,
      destroyed: false
    }));

    setShips(initialShips);
  }, [targetIndex, isGameOver, isVictory, items, sessionSeed, targetItem]);

  // Target Click / Shoot
  const handleShootShip = (ship: AlienShip) => {
    if (ship.destroyed || isGameOver || isVictory || !targetItem) return;

    totalRef.current += 1;
    setLaserBeam({ targetX: ship.xPercent, targetY: ship.yPercent });
    const lTid = setTimeout(() => setLaserBeam(null), 300);
    timeoutsRef.current.push(lTid);

    const isCorrect = ship.item.id === targetItem.id;

    setExplosion({
      x: ship.xPercent,
      y: ship.yPercent,
      text: ship.item.german,
      correct: isCorrect
    });
    const eTid = setTimeout(() => setExplosion(null), 900);
    timeoutsRef.current.push(eTid);

    setShips((prev) =>
      prev.map((s) => (s.id === ship.id ? { ...s, destroyed: true } : s))
    );

    if (isCorrect) {
      correctRef.current += 1;
      if (enableSoundFx) {
        playLernstudioSound('laser');
        playGermanVoiceFeedback('correct');
      }
      triggerSparkles(ship.xPercent, ship.yPercent, '#06b6d4');
      if (enableAudio) speakGermanText(ship.item.german);

      const nextStreak = streak + 1;
      setStreak(nextStreak);
      const points = 100 + nextStreak * 30;
      triggerScorePopup(`+${points} 🚀`, ship.xPercent, Math.max(10, ship.yPercent - 8), 'positive');

      const nextScores =
        playMode === 'teams'
          ? {
              ...teamScores,
              [currentTeamTurn === 1 ? 'team1' : 'team2']:
                teamScores[currentTeamTurn === 1 ? 'team1' : 'team2'] + points
            }
          : { ...teamScores, team1: teamScores.team1 + points };

      setTeamScores(nextScores);
      if (playMode === 'teams') {
        setCurrentTeamTurn((cur) => (cur === 1 ? 2 : 1));
      }

      if (targetIndex + 1 >= items.length) {
        setIsVictory(true);
        if (enableSoundFx) {
          playLernstudioSound('victory');
          playGermanVoiceFeedback('victory');
        }
        triggerCelebration('انتصار أسطوري! تم تدمير جميع الأهداف الفضائية! 🚀');
        reportCompletion(true, nextScores);
      } else {
        const tid = setTimeout(() => {
          setTargetIndex((prev) => prev + 1);
        }, 500);
        timeoutsRef.current.push(tid);
      }
    } else {
      if (enableSoundFx) {
        playLernstudioSound('powerup_boom');
        playGermanVoiceFeedback('wrong');
      }
      setStreak(0);
      const nextShields = Math.max(0, shields - damagePerHit);
      setShields(nextShields);
      if (nextShields <= 0) {
        setIsGameOver(true);
        reportCompletion(false, teamScores);
      }

      if (playMode === 'teams') {
        setCurrentTeamTurn((cur) => (cur === 1 ? 2 : 1));
      }
    }
  };

  const handleRestart = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    correctRef.current = 0;
    totalRef.current = 0;
    reportedRef.current = false;
    startedAtRef.current = Date.now();
    setSessionSeed(Date.now());
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
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <EffectsOverlay />
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
          <SettingsBar />
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

      <GameStageBanner
        mode="space_defense"
        title="معركة الدفاع الفضائي (Space Defender)"
        subtitle={`${displayTitle} • دمر السفن الفضائية الغازية التي تحمل الكلمة الألمانية الصحيحة!`}
        badgeText={`🛡️ ${shields}%`}
      />

      {/* Target Mission Command Console */}
      {targetItem && !isGameOver && !isVictory && (
        <div className="bg-slate-900/80 border-2 border-cyan-500/40 rounded-2xl p-3.5 text-center space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-3">
            <span>
              {playMode === 'teams'
                ? `${t.currentTurnLabel}: ${currentTeamTurn === 1 ? (language === 'ar' ? 'الفريق الأزرق 🔵' : language === 'de' ? 'Team Blau 🔵' : 'Team Blue 🔵') : (language === 'ar' ? 'الفريق الأحمر 🔴' : language === 'de' ? 'Team Rot 🔴' : 'Team Red 🔴')}`
                : (language === 'ar' ? 'رادار الرصد الفضائي' : language === 'de' ? 'Weltraum-Radar' : 'Space Radar')}
            </span>
            <span className="font-mono text-cyan-400">
              {language === 'ar' ? `هدف ${targetIndex + 1} من ${items.length}` : language === 'de' ? `Ziel ${targetIndex + 1} von ${items.length}` : `Target ${targetIndex + 1} of ${items.length}`}
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
            <SharedVictoryTrophyArt className="w-28 h-28 rounded-3xl shadow-xl border-2 border-cyan-400/50" />
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {language === 'ar' ? 'انتصار أسطوري! تم تدمير جميع الأهداف الفضائية! 🚀🎉' : language === 'de' ? 'Legendärer Sieg! Alle Ziele zerstört! 🚀🎉' : 'Legendary Victory! All targets destroyed! 🚀🎉'}
            </h2>
            <p className="text-sm font-bold text-slate-300">
              {playMode === 'teams'
                ? `${language === 'ar' ? 'الفائز' : language === 'de' ? 'Gewinner' : 'Winner'}: ${
                    teamScores.team1 > teamScores.team2
                      ? (language === 'ar' ? 'الفريق الأزرق 🔵' : language === 'de' ? 'Team Blau 🔵' : 'Team Blue 🔵')
                      : teamScores.team2 > teamScores.team1
                      ? (language === 'ar' ? 'الفريق الأحمر 🔴' : language === 'de' ? 'Team Rot 🔴' : 'Team Red 🔴')
                      : t.tieGame
                  }`
                : (language === 'ar' ? `جمعت ${teamScores.team1} نقطة بدرع كوكب ${shields}%!` : language === 'de' ? `${teamScores.team1} Punkte gesammelt mit ${shields}% Schild!` : `Collected ${teamScores.team1} points with ${shields}% planet shields!`)}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-2xl font-black text-sm shadow-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.playAgain}</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 bg-slate-800 text-white border border-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all cursor-pointer"
              >
                {t.gamesPortalBack}
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
