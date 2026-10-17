import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../../types/lernstudio';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Volume2,
  Heart,
  Flame,
  Sparkles,
  Zap,
  Bomb,
  Swords,
  ShieldAlert
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

interface FloatingFruit {
  id: string;
  item?: LernstudioItem;
  text: string;
  emoji?: string;
  isBomb?: boolean;
  isBonus?: boolean;
  isTarget: boolean;
  x: number; // percentage (10 to 85)
  y: number; // percentage (10 to 80)
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  colorClass: string;
  isSliced: boolean;
}

const FRUIT_COLORS = [
  'from-amber-500 to-orange-600 border-amber-300 text-white',
  'from-emerald-500 to-teal-600 border-emerald-300 text-white',
  'from-purple-600 to-indigo-700 border-purple-300 text-white',
  'from-rose-500 to-pink-600 border-rose-300 text-white',
  'from-cyan-500 to-blue-600 border-cyan-300 text-white'
];

export const LernstudioWordNinjaGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const items = useMemo(() => set.items || [], [set.items]);

  // Game Progress
  const [currentTargetIndex, setCurrentTargetIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [slashPoints, setSlashPoints] = useState<{ x: number; y: number }[]>([]);
  const isMouseDownRef = useRef<boolean>(false);

  // Floating Fruits on Canvas
  const [fruits, setFruits] = useState<FloatingFruit[]>([]);
  const targetItem: LernstudioItem | undefined = items[currentTargetIndex % Math.max(1, items.length)];

  // Pronounce current target when it appears
  useEffect(() => {
    if (targetItem?.german) {
      speakGermanText(targetItem.german);
    }
  }, [currentTargetIndex, targetItem]);

  // Spawn new wave of floating fruits whenever target changes or fruits get empty
  useEffect(() => {
    if (isGameOver || isVictory || !targetItem || !items.length) return;

    // Pick target fruit + 2-3 decoy fruits + 1 optional bomb
    const otherItems = items.filter((it) => it.id !== targetItem.id);
    const decoys = [...otherItems].sort(() => 0.5 - Math.random()).slice(0, 3);

    const newWave: FloatingFruit[] = [];

    // Target fruit
    newWave.push({
      id: `target-${Date.now()}-${Math.random()}`,
      item: targetItem,
      text: targetItem.german,
      emoji: targetItem.emoji || '🎯',
      isTarget: true,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 50,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      rotation: (Math.random() - 0.5) * 20,
      vRot: (Math.random() - 0.5) * 1.5,
      colorClass: FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)],
      isSliced: false
    });

    // Decoy fruits
    decoys.forEach((decoy, i) => {
      newWave.push({
        id: `decoy-${i}-${Date.now()}-${Math.random()}`,
        item: decoy,
        text: decoy.german,
        emoji: decoy.emoji || '🍏',
        isTarget: false,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        rotation: (Math.random() - 0.5) * 20,
        vRot: (Math.random() - 0.5) * 1.5,
        colorClass: FRUIT_COLORS[(i + 1) % FRUIT_COLORS.length],
        isSliced: false
      });
    });

    // Occasional Bomb (35% chance)
    if (Math.random() < 0.35) {
      newWave.push({
        id: `bomb-${Date.now()}`,
        text: 'قنبلة 💣',
        emoji: '💣',
        isBomb: true,
        isTarget: false,
        x: 25 + Math.random() * 50,
        y: 20 + Math.random() * 50,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        rotation: 0,
        vRot: (Math.random() - 0.5) * 2,
        colorClass: 'from-zinc-900 to-black border-red-500 text-red-400',
        isSliced: false
      });
    }

    setFruits(newWave);
  }, [currentTargetIndex, isGameOver, isVictory, targetItem, items]);

  // Gentle float motion loop
  useEffect(() => {
    if (isGameOver || isVictory) return;

    const interval = setInterval(() => {
      setFruits((prev) =>
        prev.map((f) => {
          if (f.isSliced) return f;

          let nextX = f.x + f.vx;
          let nextY = f.y + f.vy;
          let nextVx = f.vx;
          let nextVy = f.vy;

          // Bounce off boundary walls
          if (nextX <= 10 || nextX >= 85) nextVx = -nextVx;
          if (nextY <= 12 || nextY >= 78) nextVy = -nextVy;

          return {
            ...f,
            x: Math.max(10, Math.min(85, nextX)),
            y: Math.max(12, Math.min(78, nextY)),
            vx: nextVx,
            vy: nextVy,
            rotation: f.rotation + f.vRot
          };
        })
      );
    }, 40);

    return () => clearInterval(interval);
  }, [isGameOver, isVictory]);

  // Slash / Slice handler
  const handleSliceFruit = (fruit: FloatingFruit) => {
    if (fruit.isSliced || isGameOver || isVictory) return;

    // Mark as sliced
    setFruits((prev) =>
      prev.map((f) => (f.id === fruit.id ? { ...f, isSliced: true } : f))
    );

    if (fruit.isBomb) {
      // Hit a bomb!
      playLernstudioSound('powerup_boom');
      setCombo(0);
      setLives((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsGameOver(true);
        }
        return Math.max(0, next);
      });
      return;
    }

    if (fruit.isTarget) {
      // Correct target sliced!
      playLernstudioSound('card_match');
      if (fruit.item?.german) {
        speakGermanText(fruit.item.german);
      }

      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo((prev) => Math.max(prev, nextCombo));
      const pointsAdded = 20 * Math.min(4, nextCombo);
      setScore((s) => s + pointsAdded);

      // Check if finished whole set
      if (currentTargetIndex + 1 >= items.length) {
        setTimeout(() => {
          setIsVictory(true);
          playLernstudioSound('powerup_star');
        }, 600);
      } else {
        // Next target word after short moment
        setTimeout(() => {
          setCurrentTargetIndex((idx) => idx + 1);
        }, 500);
      }
    } else {
      // Sliced a decoy wrong word
      playLernstudioSound('wrong');
      setCombo(0);
    }
  };

  const restartGame = () => {
    setCurrentTargetIndex(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setLives(3);
    setIsGameOver(false);
    setIsVictory(false);
    setFruits([]);
  };

  return (
    <div
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-background text-text-main"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Header */}
      <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-surface-border shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-surface-hover text-text-main hover:bg-primary hover:text-white transition-all cursor-pointer border border-surface-border inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">🥷</span>
            <div>
              <h1 className="text-sm sm:text-base font-black text-text-main">
                {t.wordNinjaTitle}
              </h1>
              <p className="text-[11px] text-text-muted font-bold truncate">
                {displayTitle} • الكلمة {currentTargetIndex + 1} من {items.length}
              </p>
            </div>
          </div>
        </div>

        {/* Stats & Lives */}
        <div className="flex items-center gap-3">
          {/* Combo Indicator */}
          {combo > 1 && (
            <div className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs font-black flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{combo}x كومبو!</span>
            </div>
          )}

          {/* Score */}
          <div className="px-3 py-1 bg-surface-hover rounded-xl border border-surface-border text-xs font-black">
            <span>{score} نقطة</span>
          </div>

          {/* Hearts / Lives */}
          <div className="flex items-center gap-1 bg-surface-hover px-2.5 py-1 rounded-xl border border-surface-border">
            {[1, 2, 3].map((heart) => (
              <Heart
                key={heart}
                className={`w-4 h-4 transition-all ${
                  heart <= lives
                    ? 'text-rose-500 fill-rose-500 scale-100'
                    : 'text-text-muted opacity-30 scale-75'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={restartGame}
            className="p-2 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl border border-surface-border transition-all cursor-pointer"
            title="إعادة اللعبة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Mission Banner */}
      <div className="bg-surface/90 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-primary/30 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl shadow-inner">
            {targetItem?.emoji || '🥷'}
          </div>
          <div>
            <div className="text-[11px] font-black text-primary uppercase tracking-wider">
              المطلوب تقطيعه بسيف النينجا 🗡️:
            </div>
            <div className="text-base sm:text-xl font-black text-text-main flex items-center gap-2">
              <span>{getItemTranslation(targetItem, language)}</span>
              <span className="text-text-muted text-xs font-bold">
                ({targetItem?.german})
              </span>
            </div>
          </div>
        </div>

        {targetItem?.german && (
          <button
            type="button"
            onClick={() => speakGermanText(targetItem.german)}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
          >
            <Volume2 className="w-4 h-4 animate-pulse" />
            <span>نطق الكلمة</span>
          </button>
        )}
      </div>

      {/* Ninja Dojo Slicing Arena */}
      <div className="relative min-h-[460px] sm:min-h-[500px] bg-gradient-to-b from-stone-900 via-zinc-950 to-stone-900 rounded-3xl border border-surface-border shadow-inner overflow-hidden select-none cursor-crosshair">
        {/* Dojo Tatami / Bamboo Ambient Background */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute top-4 left-4 text-xs font-black text-stone-500 flex items-center gap-1.5 pointer-events-none">
          <Swords className="w-4 h-4" />
          <span>المس أو اضغط لتقطيع الكلمة الصحيحة</span>
        </div>

        {/* Floating Slicable Fruits & Bombs */}
        {!isGameOver && !isVictory && (
          <>
            {fruits.map((fruit) => {
              if (fruit.isSliced) {
                // Sliced in half animation
                return (
                  <div
                    key={fruit.id}
                    className="absolute pointer-events-none transition-all duration-700 ease-out"
                    style={{
                      left: `${fruit.x}%`,
                      top: `${fruit.y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="flex items-center gap-3 animate-ping opacity-60">
                      <span className="text-3xl">✨</span>
                      <span className="text-rose-400 font-black text-sm">SLICED!</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={fruit.id}
                  onClick={() => handleSliceFruit(fruit)}
                  onTouchStart={() => handleSliceFruit(fruit)}
                  className={`absolute p-3 sm:p-4 rounded-2xl border shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110 active:scale-95 group select-none bg-gradient-to-br ${fruit.colorClass}`}
                  style={{
                    left: `${fruit.x}%`,
                    top: `${fruit.y}%`,
                    transform: `translate(-50%, -50%) rotate(${fruit.rotation}deg)`
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl select-none filter drop-shadow">
                      {fruit.emoji}
                    </span>
                    <span className="text-xs sm:text-sm font-black tracking-wide font-mono" dir="ltr">
                      {fruit.text}
                    </span>
                  </div>

                  {/* Ninja Katana Sheen Hover Glow */}
                  <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
              );
            })}
          </>
        )}

        {/* Game Over Screen */}
        {isGameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-20">
            <div className="max-w-md w-full bg-surface p-6 rounded-3xl border border-surface-border text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 border border-rose-500/20 mx-auto flex items-center justify-center text-3xl shadow-inner">
                💥
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-text-main">
                انتهت المحاولات!
              </h2>
              <p className="text-xs font-bold text-text-muted">
                احذر من القنابل والكلمات الخاطئة في المرة القادمة!
              </p>

              <div className="p-3 bg-surface-hover rounded-2xl border border-surface-border text-center">
                <div className="text-xs font-bold text-text-muted">مجموع النقاط المحققة</div>
                <div className="text-2xl font-black text-primary">{score} نقطة</div>
                <div className="text-[11px] text-text-muted mt-0.5">أعلى كومبو: {maxCombo}x 🔥</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restartGame}
                  className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>محاولة جديدة</span>
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="py-3 px-4 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl text-xs font-bold border border-surface-border transition-all cursor-pointer"
                >
                  بوابة الألعاب
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {isVictory && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-20">
            <div className="max-w-md w-full bg-surface p-6 rounded-3xl border border-surface-border text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mx-auto flex items-center justify-center text-4xl shadow-inner">
                🏆
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-text-main">
                نينجا الكلمات الأسطوري! 🥷✨
              </h2>
              <p className="text-xs font-bold text-text-muted">
                أحسنت! قطعت جميع كلمات المجموعة بدقة وسرعة نينجا فائقة!
              </p>

              <div className="p-4 bg-surface-hover rounded-2xl border border-surface-border space-y-1">
                <div className="text-xs font-bold text-text-muted">النتيجة النهائية</div>
                <div className="text-3xl font-black text-amber-500">{score} نقطة</div>
                <div className="text-xs font-bold text-emerald-500">أعلى كومبو متتالي: {maxCombo}x 🔥</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restartGame}
                  className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>اللعب مرة أخرى</span>
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="py-3 px-4 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl text-xs font-bold border border-surface-border transition-all cursor-pointer"
                >
                  بوابة الألعاب
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
