import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../../types/lernstudio';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Heart,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

interface FallingWord {
  id: string;
  item: LernstudioItem;
  xPercent: number; // 5% to 85%
  yPercent: number; // 0 (top) to 100 (bottom)
  speed: number;
  caught: boolean;
}

export const LernstudioBasketCatchGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const items = useMemo(() => set.items || [], [set.items]);

  // Game state
  const [targetIndex, setTargetIndex] = useState(0);
  const [basketXPercent, setBasketXPercent] = useState(50); // 10% to 90%
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [catchFlash, setCatchFlash] = useState<{ text: string; correct: boolean } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetItem: LernstudioItem | undefined = items[targetIndex % items.length];

  // Spawn falling word items periodically
  useEffect(() => {
    if (!targetItem || isGameOver || isVictory || items.length === 0) return;

    // Pick 3 candidate words to drop: target item + 2 distractors
    const distractors = items
      .filter((it) => it.id !== targetItem.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);

    const candidates = [targetItem, ...distractors].sort(() => 0.5 - Math.random());

    const initialWords: FallingWord[] = candidates.map((it, idx) => ({
      id: `${it.id}_${Date.now()}_${idx}`,
      item: it,
      xPercent: 15 + idx * 30 + (Math.random() * 8 - 4),
      yPercent: idx * -15, // stagger fall
      speed: 0.35 + Math.random() * 0.15,
      caught: false
    }));

    setFallingWords(initialWords);
  }, [targetIndex, isGameOver, isVictory, items]);

  // Falling & Collision Loop
  useEffect(() => {
    if (isGameOver || isVictory || !targetItem) return;

    const interval = setInterval(() => {
      setFallingWords((prev) => {
        const nextWords: FallingWord[] = [];

        for (const word of prev) {
          if (word.caught) continue;

          const newY = word.yPercent + word.speed;

          // Check Basket Collision (Basket is at Y ~ 82% to 92%, X around basketXPercent +- 12%)
          const isAtBasketHeight = newY >= 80 && newY <= 92;
          const isInsideBasketWidth = Math.abs(word.xPercent - basketXPercent) <= 12;

          if (isAtBasketHeight && isInsideBasketWidth) {
            // Collision caught!
            const isCorrect = word.item.id === targetItem.id;
            setCatchFlash({ text: word.item.german, correct: isCorrect });
            setTimeout(() => setCatchFlash(null), 800);

            if (isCorrect) {
              playLernstudioSound('card_match');
              speakGermanText(word.item.german);
              setScore((s) => s + 100);

              if (targetIndex + 1 >= items.length) {
                setIsVictory(true);
              } else {
                setTargetIndex((ti) => ti + 1);
              }
            } else {
              playLernstudioSound('wrong');
              setLives((l) => {
                const nextL = l - 1;
                if (nextL <= 0) setIsGameOver(true);
                return Math.max(0, nextL);
              });
            }
            continue; // word consumed
          }

          // If word reached bottom ground
          if (newY > 105) {
            if (word.item.id === targetItem.id) {
              // Missed the correct word
              setLives((l) => {
                const nextL = l - 1;
                if (nextL <= 0) setIsGameOver(true);
                return Math.max(0, nextL);
              });
            }
            continue; // despawn
          }

          nextWords.push({ ...word, yPercent: newY });
        }

        // If all words cleared, respawn target wave
        if (nextWords.length === 0 && !isGameOver && !isVictory) {
          const distractors = items
            .filter((it) => it.id !== targetItem.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);

          const candidates = [targetItem, ...distractors].sort(() => 0.5 - Math.random());
          return candidates.map((it, idx) => ({
            id: `${it.id}_${Date.now()}_${idx}`,
            item: it,
            xPercent: 15 + idx * 30 + (Math.random() * 8 - 4),
            yPercent: idx * -15,
            speed: 0.35 + Math.random() * 0.15,
            caught: false
          }));
        }

        return nextWords;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [basketXPercent, targetItem, targetIndex, isGameOver, isVictory, items]);

  // Keyboard Navigation Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setBasketXPercent((x) => Math.max(10, x - 7));
      } else if (e.key === 'ArrowRight') {
        setBasketXPercent((x) => Math.min(90, x + 7));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pointer drag on container
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(10, Math.min(90, (x / rect.width) * 100));
    setBasketXPercent(percent);
  };

  const handleRestart = () => {
    setTargetIndex(0);
    setBasketXPercent(50);
    setFallingWords([]);
    setScore(0);
    setLives(3);
    setIsGameOver(false);
    setIsVictory(false);
    setCatchFlash(null);
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
              <span>🧺 سلة التقاط الكلمات (Basket Catch)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {displayTitle}
              </span>
            </h1>
            <p className="text-[11px] text-text-muted font-bold">
              حرك السلة لالتقاط الكلمة الألمانية المطابقة للمطلوب!
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
        </div>
      </div>

      {/* Target Mission Banner */}
      {targetItem && !isGameOver && !isVictory && (
        <div className="bg-surface border-2 border-primary/40 rounded-2xl p-3.5 text-center space-y-1 shadow-sm">
          <span className="text-xs font-extrabold text-primary block">
            التقط في السلة الكلمة التي تعني ({targetIndex + 1} من {items.length}):
          </span>
          <div className="flex items-center justify-center gap-2.5">
            {targetItem.emoji && <span className="text-2xl">{targetItem.emoji}</span>}
            <h2 className="text-xl sm:text-2xl font-black text-text-main">
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

      {/* Catch Play Arena */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        className="relative flex-1 min-h-[380px] sm:min-h-[440px] bg-gradient-to-b from-surface via-primary-soft/10 to-primary-soft/30 border border-surface-border rounded-3xl overflow-hidden shadow-inner p-4 cursor-ew-resize touch-none"
      >
        {/* Falling Words */}
        {!isGameOver &&
          !isVictory &&
          fallingWords.map((word) => (
            <div
              key={word.id}
              style={{
                left: `${word.xPercent}%`,
                top: `${word.yPercent}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute z-20 pointer-events-none"
            >
              <div className="px-3.5 py-2 rounded-2xl bg-surface/95 border-2 border-primary/40 text-text-main shadow-md flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm">
                {word.item.emoji && <span className="text-base">{word.item.emoji}</span>}
                <span>{word.item.german}</span>
              </div>
            </div>
          ))}

        {/* Catch Flash Message */}
        {catchFlash && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 animate-scale-up">
            <span
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-black text-white shadow-lg ${
                catchFlash.correct ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            >
              {catchFlash.correct ? `أحسنت! +100 نقطة (${catchFlash.text})` : `خاطئ! (${catchFlash.text})`}
            </span>
          </div>
        )}

        {/* Catching Basket */}
        {!isGameOver && !isVictory && (
          <div
            style={{
              left: `${basketXPercent}%`,
              bottom: '16px',
              transform: 'translateX(-50%)'
            }}
            className="absolute z-20 transition-transform duration-75 flex flex-col items-center select-none"
          >
            <div className="w-24 sm:w-28 h-14 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 border-4 border-amber-300 rounded-b-3xl shadow-xl flex items-center justify-center text-3xl">
              🧺
            </div>
            <span className="text-[10px] font-black text-text-muted mt-1 bg-surface/80 px-2 py-0.5 rounded-full border border-surface-border">
              اسحب للتحريك
            </span>
          </div>
        )}

        {/* Victory Screen */}
        {isVictory && (
          <div className="absolute inset-0 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-40">
            <div className="p-4 bg-amber-500/10 text-amber-500 rounded-3xl border border-amber-500/30">
              <Trophy className="w-16 h-16" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-text-main">
              مبروك! التقطت جميع الكلمات بنجاح في السلة! 🧺🎉
            </h2>
            <p className="text-sm font-bold text-text-muted">
              مجموع النقاط المحققة: <span className="text-primary font-black text-lg">{score}</span>
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>العب مرة أخرى</span>
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
          <div className="absolute inset-0 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-40">
            <div className="text-5xl">💔</div>
            <h2 className="text-xl sm:text-2xl font-black text-text-main">
              انتهت المحاولات!
            </h2>
            <p className="text-xs sm:text-sm font-bold text-text-muted">
              حاول تحريك السلة بسرعة للالتقاط بدقة. نتيجتك: {score} نقطة.
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

      {/* Touch Screen Left/Right Arrow Controls */}
      {!isGameOver && !isVictory && (
        <div className="flex items-center justify-center gap-6 pt-1 sm:hidden">
          <button
            type="button"
            onClick={() => setBasketXPercent((x) => Math.max(10, x - 15))}
            className="p-4 bg-surface-hover active:bg-primary active:text-white border border-surface-border rounded-2xl shadow-sm cursor-pointer"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
          <button
            type="button"
            onClick={() => setBasketXPercent((x) => Math.min(90, x + 15))}
            className="p-4 bg-surface-hover active:bg-primary active:text-white border border-surface-border rounded-2xl shadow-sm cursor-pointer"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        </div>
      )}
    </div>
  );
};
