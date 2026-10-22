import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../../types/lernstudio';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText, stopGermanSpeech } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Heart,
  Flame,
  Volume2,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Play
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

interface Balloon {
  id: string;
  item: LernstudioItem;
  color: string;
  xPercent: number; // 5% to 85%
  yPercent: number; // 0 (top) to 100 (bottom)
  speed: number;
  popped: boolean;
}

const BALLOON_COLORS = [
  'bg-red-500/90 border-red-400 text-white shadow-red-500/30',
  'bg-blue-500/90 border-blue-400 text-white shadow-blue-500/30',
  'bg-emerald-500/90 border-emerald-400 text-white shadow-emerald-500/30',
  'bg-amber-500/90 border-amber-400 text-white shadow-amber-500/30',
  'bg-purple-500/90 border-purple-400 text-white shadow-purple-500/30',
  'bg-pink-500/90 border-pink-400 text-white shadow-pink-500/30',
  'bg-cyan-500/90 border-cyan-400 text-white shadow-cyan-500/30'
];

export const LernstudioBalloonPopGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const items = useMemo(() => set.items || [], [set.items]);

  // Game States
  const [targetIndex, setTargetIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [poppedBurst, setPoppedBurst] = useState<{ x: number; y: number; text: string; correct: boolean } | null>(null);

  const targetItem: LernstudioItem | undefined = items[targetIndex % items.length];

  // Spawn a wave of balloons whenever target changes
  useEffect(() => {
    if (!targetItem || isGameOver || isVictory || items.length === 0) return;

    // Pick 3-5 candidates including the correct target
    const distractors = items
      .filter((it) => it.id !== targetItem.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const candidates = [targetItem, ...distractors].sort(() => 0.5 - Math.random());

    const initialBalloons: Balloon[] = candidates.map((it, idx) => ({
      id: `${it.id}_${Date.now()}_${idx}`,
      item: it,
      color: BALLOON_COLORS[idx % BALLOON_COLORS.length],
      xPercent: 12 + idx * 22 + (Math.random() * 8 - 4),
      yPercent: 85 + (idx % 2 === 0 ? 0 : 12),
      speed: 0.28 + Math.random() * 0.15,
      popped: false
    }));

    setBalloons(initialBalloons);
  }, [targetIndex, isGameOver, isVictory, items]);

  // Auto-pronounce German target word when new round starts
  useEffect(() => {
    if (targetItem?.german && !isGameOver && !isVictory) {
      const timer = setTimeout(() => {
        speakGermanText(targetItem.german);
      }, 350);
      return () => {
        clearTimeout(timer);
        stopGermanSpeech();
      };
    }
  }, [targetItem, isGameOver, isVictory]);

  // Floating Loop
  useEffect(() => {
    if (isGameOver || isVictory) return;

    const interval = setInterval(() => {
      setBalloons((prev) =>
        prev
          .map((b) => {
            if (b.popped) return b;
            const newY = b.yPercent - b.speed;
            return { ...b, yPercent: newY };
          })
          .filter((b) => {
            // If correct balloon floats off top without being popped: small penalty or cycle
            if (b.yPercent < -15 && !b.popped && b.item.id === targetItem?.id) {
              setLives((l) => {
                const nextL = l - 1;
                if (nextL <= 0) setIsGameOver(true);
                return Math.max(0, nextL);
              });
              setStreak(0);
              return false;
            }
            return b.yPercent >= -20;
          })
      );
    }, 40);

    return () => clearInterval(interval);
  }, [isGameOver, isVictory, targetItem]);

  // Handle Popping
  const handlePopBalloon = (balloon: Balloon) => {
    if (balloon.popped || isGameOver || isVictory || !targetItem) return;

    const isCorrect = balloon.item.id === targetItem.id;

    // Visual burst effect
    setPoppedBurst({
      x: balloon.xPercent,
      y: balloon.yPercent,
      text: balloon.item.german,
      correct: isCorrect
    });
    setTimeout(() => setPoppedBurst(null), 800);

    // Mark as popped
    setBalloons((prev) =>
      prev.map((b) => (b.id === balloon.id ? { ...b, popped: true } : b))
    );

    if (isCorrect) {
      playLernstudioSound('correct');
      speakGermanText(balloon.item.german);

      const nextStreak = streak + 1;
      const points = 100 + nextStreak * 25;
      setScore((s) => s + points);
      setStreak(nextStreak);

      // Check if finished all words
      if (targetIndex + 1 >= items.length) {
        setIsVictory(true);
      } else {
        setTimeout(() => {
          setTargetIndex((prev) => prev + 1);
        }, 400);
      }
    } else {
      playLernstudioSound('wrong');
      setStreak(0);
      setLives((l) => {
        const next = l - 1;
        if (next <= 0) {
          setIsGameOver(true);
        }
        return Math.max(0, next);
      });
    }
  };

  const handleRestart = () => {
    setTargetIndex(0);
    setScore(0);
    setStreak(0);
    setLives(3);
    setIsGameOver(false);
    setIsVictory(false);
    setBalloons([]);
    setPoppedBurst(null);
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center bg-surface rounded-3xl border border-surface-border">
        <p className="text-text-muted font-bold">لا توجد كلمات كافية في هذه المجموعة.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded-xl">
          العودة
        </button>
      </div>
    );
  }

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
              <span>🎈 فرقعة البالونات (Balloon Pop)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {displayTitle}
              </span>
            </h1>
            <p className="text-[11px] text-text-muted font-bold">
              فرقع البالون الذي يحمل الكلمة الألمانية المطابقة!
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
        </div>
      </div>

      {/* Target Word Banner */}
      {targetItem && !isGameOver && !isVictory && (
        <div className="bg-gradient-to-r from-primary-soft/40 via-surface to-primary-soft/40 border-2 border-primary/40 rounded-2xl p-4 text-center space-y-1 shadow-sm">
          <span className="text-xs font-extrabold text-primary uppercase tracking-wider block">
            المطلوب فرقعته الآن ({targetIndex + 1} من {items.length}):
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

      {/* Sky Canvas for Floating Balloons */}
      <div className="relative flex-1 min-h-[360px] sm:min-h-[420px] bg-gradient-to-b from-sky-400/10 via-sky-200/5 to-surface border border-surface-border rounded-3xl overflow-hidden shadow-inner p-4">
        {/* Sky Clouds Decoration */}
        <div className="absolute top-4 left-6 text-4xl opacity-30 select-none pointer-events-none">☁️</div>
        <div className="absolute top-12 right-12 text-3xl opacity-20 select-none pointer-events-none">☁️</div>
        <div className="absolute top-28 left-1/3 text-2xl opacity-25 select-none pointer-events-none">✨</div>

        {/* Floating Balloons */}
        {!isGameOver &&
          !isVictory &&
          balloons.map((balloon) => {
            if (balloon.popped) return null;

            return (
              <div
                key={balloon.id}
                onClick={() => handlePopBalloon(balloon)}
                style={{
                  left: `${balloon.xPercent}%`,
                  top: `${balloon.yPercent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute cursor-pointer transition-transform hover:scale-110 active:scale-95 z-20 flex flex-col items-center select-none`}
              >
                {/* Balloon Body */}
                <div
                  className={`w-20 sm:w-24 h-24 sm:h-28 rounded-full border-2 flex flex-col items-center justify-center p-2 text-center shadow-lg transition-all ${balloon.color}`}
                >
                  {balloon.item.emoji && <span className="text-xl mb-0.5">{balloon.item.emoji}</span>}
                  <span className="text-xs sm:text-sm font-black font-mono leading-tight tracking-tight break-words max-w-full">
                    {balloon.item.german}
                  </span>
                </div>
                {/* Balloon Knot & String */}
                <div className="w-2.5 h-2 bg-slate-400 rounded-b-sm -mt-0.5" />
                <div className="w-0.5 h-6 bg-slate-300/80 -mt-0.5" />
              </div>
            );
          })}

        {/* Pop Burst Flash Animation */}
        {poppedBurst && (
          <div
            style={{
              left: `${poppedBurst.x}%`,
              top: `${poppedBurst.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            className="absolute z-30 pointer-events-none flex flex-col items-center animate-scale-up"
          >
            <span className="text-4xl">{poppedBurst.correct ? '💥🎉' : '❌💨'}</span>
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-lg text-white shadow-md ${
                poppedBurst.correct ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            >
              {poppedBurst.text}
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
              مبروك يا بطل! فرقعت كل البالونات بنجاح! 🎈🎉
            </h2>
            <p className="text-sm font-bold text-text-muted">
              جمعت <span className="text-primary font-black text-base">{score}</span> نقطة بدون أخطاء!
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
              انتهت المحاولات! لا بأس يا بطل
            </h2>
            <p className="text-xs sm:text-sm font-bold text-text-muted">
              حاول التركيز على الكلمات الألمانية وفرقعة البالون الصحيح. نتيجتك: {score} نقطة.
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
