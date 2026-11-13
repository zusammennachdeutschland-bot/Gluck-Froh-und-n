import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowLeft, Layers } from 'lucide-react';
import { BonusCardInstance, BonusCardTone, PendingBonusRound } from '../homeworkGamification';
import { playLernstudioSound } from '../lernstudioAudioUtils';

interface Props {
  round: PendingBonusRound;
  animationIntensity?: 'Full' | 'Reduced' | 'Off';
  onPickCard: (cardInstanceId: string) => BonusCardInstance | null;
  onCompleteRound: () => void;
  onTriggerSparkles?: (x?: number, y?: number, color?: string) => void;
}

const TONE_FRONT_CLASSES: Record<BonusCardTone, { bg: string; border: string; badge: string; accent: string }> = {
  gold: {
    bg: 'bg-gradient-to-b from-amber-400/25 via-amber-500/15 to-slate-900',
    border: 'border-amber-400',
    badge: 'bg-amber-500 text-slate-950',
    accent: 'text-amber-300'
  },
  emerald: {
    bg: 'bg-gradient-to-b from-emerald-400/25 via-emerald-500/15 to-slate-900',
    border: 'border-emerald-400',
    badge: 'bg-emerald-500 text-slate-950',
    accent: 'text-emerald-300'
  },
  violet: {
    bg: 'bg-gradient-to-b from-violet-400/25 via-violet-500/15 to-slate-900',
    border: 'border-violet-400',
    badge: 'bg-violet-500 text-white',
    accent: 'text-violet-300'
  },
  sky: {
    bg: 'bg-gradient-to-b from-sky-400/25 via-sky-500/15 to-slate-900',
    border: 'border-sky-400',
    badge: 'bg-sky-500 text-slate-950',
    accent: 'text-sky-300'
  },
  cyan: {
    bg: 'bg-gradient-to-b from-cyan-400/25 via-cyan-500/15 to-slate-900',
    border: 'border-cyan-400',
    badge: 'bg-cyan-400 text-slate-950',
    accent: 'text-cyan-300'
  },
  indigo: {
    bg: 'bg-gradient-to-b from-indigo-400/25 via-indigo-500/15 to-slate-900',
    border: 'border-indigo-400',
    badge: 'bg-indigo-500 text-white',
    accent: 'text-indigo-300'
  },
  rose: {
    bg: 'bg-gradient-to-b from-rose-500/25 via-rose-600/15 to-slate-900',
    border: 'border-rose-400',
    badge: 'bg-rose-500 text-white',
    accent: 'text-rose-300'
  },
  amber: {
    bg: 'bg-gradient-to-b from-orange-500/25 via-red-600/15 to-slate-900',
    border: 'border-orange-400',
    badge: 'bg-orange-500 text-slate-950',
    accent: 'text-orange-300'
  }
};

function shuffleSlots(slots: number[], stepSeed: number): number[] {
  const copy = [...slots];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs((i * 7 + stepSeed * 13 + 3) % (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export const HomeworkBonusCardOverlay: React.FC<Props> = ({
  round,
  animationIntensity = 'Full',
  onPickCard,
  onCompleteRound,
  onTriggerSparkles
}) => {
  const [roundPhase, setRoundPhase] = useState<'shuffling' | 'selecting' | 'revealing'>('shuffling');
  const [shuffleStep, setShuffleStep] = useState(0);
  const [slotOrder, setSlotOrder] = useState<number[]>(() => round.cards.map((_, idx) => idx));
  const [pickedInstanceId, setPickedInstanceId] = useState<string | null>(null);
  const [revealedCard, setRevealedCard] = useState<BonusCardInstance | null>(null);

  const hasPickedRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reducedMotion = useMemo(() => {
    if (animationIntensity === 'Off' || animationIntensity === 'Reduced') return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [animationIntensity]);

  // Progressive deceleration playing-card shuffle on round mount
  useEffect(() => {
    hasPickedRef.current = false;
    hasCompletedRef.current = false;
    setPickedInstanceId(null);
    setRevealedCard(null);
    setSlotOrder(round.cards.map((_, idx) => idx));

    if (reducedMotion) {
      setRoundPhase('shuffling');
      const settleQuick = setTimeout(() => {
        setShuffleStep(4);
        setRoundPhase('selecting');
      }, 180);
      return () => clearTimeout(settleQuick);
    }

    setRoundPhase('shuffling');
    setShuffleStep(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    // Rapid early shuffles -> gradually decelerating -> crisp settle
    const beatOffsets = [90, 310, 580, 920, 1320];
    beatOffsets.forEach((delay, idx) => {
      const t = setTimeout(() => {
        if (idx < 4) {
          setShuffleStep(idx + 1);
          setSlotOrder((prev) => shuffleSlots(prev, idx + 1));
          playLernstudioSound('card_flip');
        } else {
          setShuffleStep(4);
          setRoundPhase('selecting');
          playLernstudioSound('powerup_star');
        }
      }, delay);
      timers.push(t);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [round.roundId, round.cards, reducedMotion]);

  // Cleanup auto-resume timer on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const finishOnce = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    onCompleteRound();
  };

  const handleCardSelect = (card: BonusCardInstance) => {
    if (roundPhase !== 'selecting' || hasPickedRef.current) return;
    hasPickedRef.current = true;
    setPickedInstanceId(card.instanceId);
    setRoundPhase('revealing');
    playLernstudioSound('card_flip');

    // Immediately apply reward/penalty once (idempotent in parent state)
    const applied = onPickCard(card.instanceId) || card;
    setRevealedCard(applied);

    setTimeout(() => {
      playLernstudioSound(applied.soundEffect);
      if (applied.isPositive) {
        onTriggerSparkles?.(50, 45, applied.tone === 'gold' ? '#F59E0B' : '#10B981');
        if (!reducedMotion) {
          try {
            confetti({
              particleCount: 65,
              spread: 65,
              origin: { y: 0.55 }
            });
          } catch {}
        }
      }
    }, 220);

    resumeTimerRef.current = setTimeout(() => {
      finishOnce();
    }, 2000);
  };

  const orderedCards = useMemo(() => {
    return slotOrder.map((idx) => round.cards[idx]).filter(Boolean);
  }, [slotOrder, round.cards]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="جولة بطاقات المكافآت"
    >
      <div className="max-w-3xl w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-5 text-white">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-300">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>سلسلة 10 إجابات متتالية صحيحة!</span>
            <span aria-hidden="true">·</span>
            <span>جولة البطاقات</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            {roundPhase === 'shuffling'
              ? 'جاري خلط بطاقات الحظ...'
              : roundPhase === 'selecting'
              ? 'اختر بطاقة واحدة فقط!'
              : revealedCard
              ? `${revealedCard.emoji} ${revealedCard.titleAr}`
              : 'كشف المكافأة'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-300">
            {roundPhase === 'shuffling'
              ? 'راقب البطاقات أثناء الخلط حتى تستقر على الطاولة'
              : roundPhase === 'selecting'
              ? 'اضغط على إحدى البطاقات المقلوبة للحصول على مكافأة أو تحدٍ فوري'
              : revealedCard?.descriptionAr || 'تم تطبيق التأثير مباشرة'}
          </p>
        </div>

        {/* Wordwall-inspired Card Table */}
        <div className="rounded-2xl bg-emerald-950/65 border border-emerald-700/40 p-3 sm:p-5">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3.5 items-center justify-items-center">
            {orderedCards.map((card, visualIdx) => {
              const isSelected = pickedInstanceId === card.instanceId;
              const isFlipped = roundPhase === 'revealing' && isSelected;
              const isOtherDimmed = roundPhase === 'revealing' && !isSelected;
              const toneStyle = TONE_FRONT_CLASSES[card.tone] || TONE_FRONT_CLASSES.gold;

              // Calculate convincing rapid fan/shuffle offset during shuffling beats
              const shuffleRotateDeg =
                roundPhase === 'shuffling' && !reducedMotion
                  ? shuffleStep === 0
                    ? (visualIdx % 2 === 0 ? -9 : 9)
                    : shuffleStep === 1
                    ? (visualIdx % 2 === 0 ? 7 : -7)
                    : shuffleStep === 2
                    ? (visualIdx % 2 === 0 ? -4 : 4)
                    : shuffleStep === 3
                    ? (visualIdx % 2 === 0 ? 2 : -2)
                    : 0
                  : 0;

              const shuffleTranslateY =
                roundPhase === 'shuffling' && !reducedMotion && shuffleStep < 4
                  ? (visualIdx + shuffleStep) % 2 === 0
                    ? -8
                    : 8
                  : 0;

              return (
                <motion.div
                  key={card.instanceId}
                  layout
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85, y: 18 }}
                  animate={{
                    opacity: isOtherDimmed ? 0.35 : 1,
                    scale: isSelected ? 1.07 : isOtherDimmed ? 0.93 : 1,
                    rotate: shuffleRotateDeg,
                    y: shuffleTranslateY
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: shuffleStep < 2 ? 360 : 230,
                    damping: shuffleStep < 2 ? 22 : 24
                  }}
                  className="w-full max-w-[126px]"
                  style={{ perspective: '1000px' }}
                >
                  <button
                    type="button"
                    disabled={roundPhase !== 'selecting'}
                    onClick={() => handleCardSelect(card)}
                    aria-label={`بطاقة المكافأة رقم ${visualIdx + 1}`}
                    className={`relative w-full h-36 sm:h-44 rounded-2xl transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      roundPhase === 'selecting'
                        ? 'cursor-pointer hover:-translate-y-2 active:scale-95'
                        : 'cursor-default'
                    }`}
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      transition: reducedMotion ? 'transform 150ms ease-out' : 'transform 520ms cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    {/* CARD BACK (Face-Down) */}
                    <div
                      className={`absolute inset-0 rounded-2xl border-2 p-2.5 flex flex-col items-center justify-between shadow-lg ${
                        roundPhase === 'selecting'
                          ? 'border-amber-400/75 bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 hover:border-amber-300'
                          : 'border-slate-600/80 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950'
                      }`}
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="w-full flex items-center justify-between text-[11px] font-mono font-bold text-amber-300/90 tabular-nums">
                        <span>#{visualIdx + 1}</span>
                        <Layers className="w-3.5 h-3.5 opacity-80" />
                      </div>

                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border border-amber-400/40 bg-amber-500/10 flex items-center justify-center shadow-inner">
                        <span className="text-2xl sm:text-3xl select-none">🃏</span>
                      </div>

                      <div className="w-full text-center text-[10px] font-bold text-slate-300 tracking-wide">
                        {roundPhase === 'selecting' ? 'اختر' : 'Glück'}
                      </div>
                    </div>

                    {/* CARD FRONT (Revealed on Pick) */}
                    <div
                      className={`absolute inset-0 rounded-2xl border-2 p-2.5 flex flex-col items-center justify-between text-center shadow-xl ${toneStyle.bg} ${toneStyle.border}`}
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)'
                      }}
                    >
                      <span className="text-[10px] font-bold text-slate-200 tracking-tight truncate w-full">
                        {card.titleEn}
                      </span>

                      <div className="text-3xl sm:text-4xl select-none my-auto">
                        {card.emoji}
                      </div>

                      <div className="w-full space-y-1">
                        <div className={`text-xs font-black truncate ${toneStyle.accent}`}>
                          {card.titleAr}
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black tabular-nums ${toneStyle.badge}`}>
                          {card.effectBadgeAr}
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer Action / Auto-resume Confirmation */}
        {roundPhase === 'revealing' && revealedCard ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="text-xs sm:text-sm font-bold text-slate-200 text-center sm:text-right">
              <span>{revealedCard.effectBadgeAr}</span>
              <span className="mx-2 text-slate-500">·</span>
              <span className="text-slate-300 font-medium">تم التفعيل والعودة تلقائياً للسؤال التالي...</span>
            </div>
            <button
              type="button"
              onClick={finishOnce}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span>متابعة الآن</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center text-[11px] font-medium text-slate-400">
            يتم إيقاف المؤقت تلقائياً أثناء اختيار بطاقة المكافأة
          </div>
        )}
      </div>
    </div>
  );
};
