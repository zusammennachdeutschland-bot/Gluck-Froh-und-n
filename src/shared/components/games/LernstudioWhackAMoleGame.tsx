import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LernstudioSet,
  LernstudioTheme,
  LernstudioItem,
  LernstudioGameCompletionPayload
} from '../../../types/lernstudio';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText, stopGermanSpeech } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  getSetPlayableItems,
  buildSeededSessionDeck,
  createSeededRandom,
  seededShuffle
} from '../../../utils/lernstudioVocabularyAdapter';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import { GameEffectsOverlay, GameSettingsControls } from '../effects/GameEffectsOverlay';
import { GameSetupConfig } from '../LernstudioGameSetupScreen';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Heart,
  Flame,
  Volume2,
  Sparkles,
  Zap
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
  onBack: () => void;
}

interface MoleHole {
  holeIndex: number;
  item: LernstudioItem | null;
  isVisible: boolean;
  isHit: boolean;
}

function createEmptyHoles(): MoleHole[] {
  return Array.from({ length: 6 }).map((_, i) => ({
    holeIndex: i,
    item: null,
    isVisible: false,
    isHit: false
  }));
}

export const LernstudioWhackAMoleGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const [sessionNonce, setSessionNonce] = useState(0);
  const difficulty = gameConfig?.difficulty || 'medium';
  const moleIntervalMs = difficulty === 'hard' ? 1450 : difficulty === 'easy' ? 2800 : 2200;
  const maxLives = difficulty === 'easy' ? 4 : difficulty === 'hard' ? 2 : 3;

  const rawItems = useMemo(() => getSetPlayableItems(set), [set]);
  const items = useMemo(() => {
    const count = gameConfig?.questionCount && gameConfig.questionCount > 0 ? gameConfig.questionCount : rawItems.length;
    return buildSeededSessionDeck(rawItems, count, `${set.id}::mole::${sessionNonce}`);
  }, [rawItems, set.id, gameConfig?.questionCount, sessionNonce]);

  const [targetIndex, setTargetIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(maxLives);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [hammerPos, setHammerPos] = useState<{ holeIdx: number; correct: boolean } | null>(null);
  const { particles, popups, triggerCorrect, triggerWrong, triggerVictory } = useGameEffects();
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spawnTickRef = useRef(0);
  const completedRef = useRef(false);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      stopGermanSpeech();
    };
  }, []);

  // 6 Holes (2 rows x 3 cols)
  const [holes, setHoles] = useState<MoleHole[]>(createEmptyHoles);

  const targetItem: LernstudioItem | undefined = items[targetIndex % Math.max(1, items.length)];

  const reportFinishOnce = (finalScore: number, passed: boolean) => {
    if (completedRef.current || !onGameComplete) return;
    completedRef.current = true;
    const total = Math.max(1, correctRef.current + wrongRef.current);
    const accuracy = Math.min(100, Math.round((correctRef.current / total) * 100));
    onGameComplete({
      gameMode: 'whack_a_mole',
      score: finalScore,
      maxScore: items.length * 150,
      accuracy,
      passed,
      difficulty
    });
  };

  // Spawn moles loop
  useEffect(() => {
    if (!targetItem || isGameOver || isVictory || items.length === 0) return;

    const spawnWave = () => {
      spawnTickRef.current += 1;
      const rng = createSeededRandom(
        `${set.id}::mole_wave::${sessionNonce}::${targetIndex}::${spawnTickRef.current}`
      );
      const holeIndices = seededShuffle([0, 1, 2, 3, 4, 5], rng).slice(0, difficulty === 'hard' ? 4 : 3);
      const distractors = seededShuffle(
        rawItems.filter((it) => it.id !== targetItem.id),
        rng
      ).slice(0, holeIndices.length - 1);
      const assignedCandidates = seededShuffle([targetItem, ...distractors], rng);

      setHoles(
        Array.from({ length: 6 }).map((_, idx) => {
          const matchPos = holeIndices.indexOf(idx);
          if (matchPos !== -1 && assignedCandidates[matchPos]) {
            return {
              holeIndex: idx,
              item: assignedCandidates[matchPos],
              isVisible: true,
              isHit: false
            };
          }
          return {
            holeIndex: idx,
            item: null,
            isVisible: false,
            isHit: false
          };
        })
      );
    };

    spawnWave();
    const interval = setInterval(spawnWave, moleIntervalMs);

    return () => clearInterval(interval);
  }, [targetItem, targetIndex, isGameOver, isVictory, items.length, rawItems, moleIntervalMs, set.id, sessionNonce, difficulty]);

  // Handle whacking a mole
  const handleWhack = (holeIdx: number) => {
    const hole = holes[holeIdx];
    if (!hole || !hole.isVisible || hole.isHit || !hole.item || isGameOver || isVictory || !targetItem) return;

    const isCorrect = hole.item.id === targetItem.id;

    // Trigger Hammer visual
    setHammerPos({ holeIdx, correct: isCorrect });
    timeoutsRef.current.push(setTimeout(() => setHammerPos(null), 500));

    // Mark hole as hit
    setHoles((prev) =>
      prev.map((h) => (h.holeIndex === holeIdx ? { ...h, isHit: true, isVisible: false } : h))
    );

    if (isCorrect) {
      correctRef.current += 1;
      if (gameConfig?.enableSoundFx !== false) {
        playLernstudioSound('whack');
        playLernstudioSound('combo_ding');
      }
      if (gameConfig?.enableAudio !== false) speakGermanText(hole.item.german);

      const nextStreak = streak + 1;
      const pts = 100 + nextStreak * 25;
      const nextScore = score + pts;
      setStreak(nextStreak);
      setScore(nextScore);
      triggerCorrect(pts, nextStreak >= 2 ? `x${nextStreak} Whack!` : 'Treffer!');

      if (targetIndex + 1 >= items.length) {
        setIsVictory(true);
        triggerVictory();
        if (gameConfig?.enableAudio !== false) playGermanVoiceFeedback('victory');
        reportFinishOnce(nextScore, true);
      } else {
        timeoutsRef.current.push(
          setTimeout(() => {
            setTargetIndex((prev) => prev + 1);
          }, 400)
        );
      }
    } else {
      wrongRef.current += 1;
      if (gameConfig?.enableSoundFx !== false) playLernstudioSound('wrong');
      triggerWrong();
      if (gameConfig?.enableAudio !== false) playGermanVoiceFeedback('try_again');
      setStreak(0);
      setLives((l) => {
        const next = l - 1;
        if (next <= 0) {
          setIsGameOver(true);
          reportFinishOnce(score, false);
        }
        return Math.max(0, next);
      });
    }
  };

  const handleRestart = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    completedRef.current = false;
    correctRef.current = 0;
    wrongRef.current = 0;
    setSessionNonce((n) => n + 1);
    setTargetIndex(0);
    setScore(0);
    setStreak(0);
    setLives(maxLives);
    setIsGameOver(false);
    setIsVictory(false);
    setHammerPos(null);
    setHoles(createEmptyHoles());
  };

  return (
    <div
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-background text-text-main flex flex-col justify-between"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Header Bar */}
      <div className="bg-surface p-3 sm:p-4 rounded-2xl border border-surface-border shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-surface-hover text-text-main hover:bg-primary hover:text-white transition-all cursor-pointer border border-surface-border inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>

          <div>
            <h1 className="text-sm sm:text-base font-black text-text-main flex items-center gap-2">
              <span>🔨 اضرب الخلد والمفردات (Whack-A-Word)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {displayTitle}
              </span>
            </h1>
            <p className="text-[11px] text-text-muted font-bold">
              اضرب الخلد السريع الذي يحمل الكلمة الألمانية المطابقة قبل اختفائه في الجحر!
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-black">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${i < lives ? 'fill-rose-500 text-rose-500' : 'text-slate-300 dark:text-slate-700'}`}
              />
            ))}
          </div>

          {streak >= 2 && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black animate-pulse">
              <Flame className="w-4 h-4 fill-amber-500" />
              <span>x{streak} كومبو!</span>
            </div>
          )}

          <div className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-black text-xs shadow-xs">
            {score} نقطة
          </div>

          <button
            type="button"
            onClick={handleRestart}
            className="p-2 rounded-xl bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text-main transition-colors cursor-pointer"
            title="إعادة اللعبة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <GameSettingsControls compact />
        </div>
      </div>

      <GameEffectsOverlay particles={particles} popups={popups} showConfetti={isVictory} />
      <GameStageBanner
        mode="whack_a_mole"
        title="اضرب الخلد والمفردات (Whack-A-Word)"
        subtitle="اضرب الخلد السريع الذي يحمل الكلمة الألمانية المطابقة بالمطرقة!"
        badgeText={`${targetIndex + 1} / ${items.length}`}
      />

      {/* Target Mission Banner */}
      {targetItem && !isGameOver && !isVictory && (
        <div className="bg-surface border-2 border-primary/40 rounded-2xl p-4 text-center space-y-1 shadow-sm">
          <span className="text-xs font-extrabold text-primary block">
            المطلوب ضربه بالمطرقة ({targetIndex + 1} من {items.length}):
          </span>
          <div className="flex items-center justify-center gap-3">
            {targetItem.emoji && <span className="text-3xl select-none">{targetItem.emoji}</span>}
            <h2 className="text-2xl sm:text-3xl font-black text-text-main">
              {getItemTranslation(targetItem, language)}
            </h2>
            <button
              type="button"
              onClick={() => speakGermanText(targetItem.german)}
              className="p-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
              title="نطق الكلمة"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Holes Lawn Arena */}
      <div className="relative flex-1 min-h-[380px] sm:min-h-[440px] bg-gradient-to-b from-emerald-500/15 via-emerald-700/10 to-amber-900/20 border border-surface-border rounded-3xl p-6 flex items-center justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-10 max-w-2xl w-full">
          {holes.map((hole) => {
            const isTargetMole = hole.item?.id === targetItem?.id;

            return (
              <div
                key={hole.holeIndex}
                className="relative flex flex-col items-center justify-end h-32 sm:h-36"
              >
                {/* Pop-up Mole */}
                {hole.isVisible && hole.item && (
                  <div
                    onClick={() => handleWhack(hole.holeIndex)}
                    className="absolute top-0 z-20 cursor-pointer animate-scale-up transition-transform hover:scale-105 active:scale-95 flex flex-col items-center"
                  >
                    <div className="p-3 bg-amber-800 text-amber-100 rounded-3xl border-3 border-amber-600 shadow-xl flex flex-col items-center justify-center text-center min-w-[100px] sm:min-w-[120px]">
                      <span className="text-2xl sm:text-3xl mb-0.5">🐹</span>
                      <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-white px-2 py-0.5 rounded-lg bg-black/40 break-words max-w-full">
                        {hole.item.german}
                      </span>
                    </div>
                  </div>
                )}

                {/* Hammer Strike Visual */}
                {hammerPos && hammerPos.holeIdx === hole.holeIndex && (
                  <div className="absolute -top-6 z-30 pointer-events-none flex flex-col items-center animate-fade-in">
                    <span className="text-5xl">🔨💥</span>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-md text-white ${
                        hammerPos.correct ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    >
                      {hammerPos.correct ? '+100' : 'خطأ!'}
                    </span>
                  </div>
                )}

                {/* Ground Burrow Hole */}
                <div className="w-28 sm:w-36 h-10 bg-amber-950/90 border-4 border-amber-900 rounded-full shadow-inner z-10 flex items-center justify-center">
                  <div className="w-20 sm:w-28 h-6 bg-black/70 rounded-full" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Victory Screen */}
        {isVictory && (
          <div className="absolute inset-0 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-40 rounded-3xl">
            <SharedVictoryTrophyArt className="w-24 h-24 rounded-3xl shadow-xl border border-amber-400/30" />
            <h2 className="text-2xl sm:text-3xl font-black text-text-main">
              ضربات خارقة! اصطدت جميع الكلمات بنجاح 🔨🎉
            </h2>
            <p className="text-sm font-bold text-text-muted">
              مجموع النقاط: <span className="text-primary font-black text-lg">{score}</span>
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>جولة جديدة</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 bg-surface-hover text-text-main border border-surface-border rounded-2xl font-bold text-sm hover:bg-surface transition-all cursor-pointer"
              >
                العودة للألعاب
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {isGameOver && (
          <div className="absolute inset-0 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-40 rounded-3xl">
            <div className="text-5xl">💔</div>
            <h2 className="text-xl sm:text-2xl font-black text-text-main">
              انتهت المحاولات!
            </h2>
            <p className="text-xs sm:text-sm font-bold text-text-muted">
              ركّز على الكلمة الألمانية المطلوبة واضرب الخلد المناسب. نتيجتك: {score} نقطة.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 bg-surface-hover text-text-main border border-surface-border rounded-2xl font-bold text-sm hover:bg-surface transition-all cursor-pointer"
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
