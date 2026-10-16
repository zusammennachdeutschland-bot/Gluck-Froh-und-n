import React, { useState, useEffect, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme } from '../../../types/lernstudio';
import { generateMemoryCards, MemoryCard } from '../../../utils/lernstudioQuestionAdapter';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import {
  ArrowRight,
  RotateCcw,
  Trophy,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Star,
  CheckCircle2
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

import { getLernstudioTranslations, getLocalizedSetTitle } from '../../../utils/lernstudioTranslations';

export const LernstudioMemoryGame: React.FC<Props> = ({ set, activeTheme, language = 'ar', onBack }) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);

  const [cardsCount, setCardsCount] = useState<number>(6); // 6 pairs = 12 cards
  const [cards, setCards] = useState<MemoryCard[]>(() => generateMemoryCards(set.items || [], 6));
  const [flippedCards, setFlippedCards] = useState<MemoryCard[]>([]);
  const [movesCount, setMovesCount] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isGameCompleted, setIsGameCompleted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && !isGameCompleted) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, isGameCompleted]);

  // Check completion
  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.isMatched)) {
      setIsGameCompleted(true);
      setIsTimerRunning(false);
      if (soundEnabled) playLernstudioSound('powerup_star');
    }
  }, [cards, soundEnabled]);

  const handleCardClick = (card: MemoryCard) => {
    // Prevent clicking already flipped or matched cards or if two cards are already being checked
    if (card.isFlipped || card.isMatched || flippedCards.length >= 2) return;

    if (soundEnabled) playLernstudioSound('card_flip');

    // Flip this card
    const updatedCards = cards.map((c) => (c.id === card.id ? { ...c, isFlipped: true } : c));
    setCards(updatedCards);

    const newFlipped = [...flippedCards, card];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMovesCount((m) => m + 1);
      const [first, second] = newFlipped;

      if (first.pairId === second.pairId) {
        // Match found!
        if (soundEnabled) playLernstudioSound('card_match');
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.pairId === first.pairId ? { ...c, isMatched: true, isFlipped: true } : c
            )
          );
          setFlippedCards([]);
        }, 500);
      } else {
        // No match: flip back
        setTimeout(() => {
          if (soundEnabled) playLernstudioSound('wrong');
          setCards((prev) =>
            prev.map((c) =>
              c.id === first.id || c.id === second.id ? { ...c, isFlipped: false } : c
            )
          );
          setFlippedCards([]);
        }, 1100);
      }
    }
  };

  const handleRestart = (newPairCount: number = cardsCount) => {
    setCardsCount(newPairCount);
    setCards(generateMemoryCards(set.items || [], newPairCount));
    setFlippedCards([]);
    setMovesCount(0);
    setTimerSeconds(0);
    setIsTimerRunning(true);
    setIsGameCompleted(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Calculate star rating
  const starsEarned = movesCount <= cardsCount + 2 ? 3 : movesCount <= cardsCount * 2 ? 2 : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header */}
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
            <span>🃏 {t.memoryGameTitle}</span>
            <span className="text-xs font-normal text-slate-400">· {displaySetTitle}</span>
          </h1>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-mono">{formatTime(timerSeconds)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{movesCount} حركة</span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col items-center justify-center">
        {/* Difficulty switcher */}
        <div className="flex items-center gap-2 mb-6 bg-slate-900 border border-slate-800 p-1 rounded-2xl text-xs font-bold">
          <span className="text-slate-400 px-3">عدد البطاقات:</span>
          {[
            { count: 4, label: 'سهل (8 كروت)' },
            { count: 6, label: 'متوسط (12 كرت)' },
            { count: 8, label: 'تحدي (16 كرت)' }
          ].map((lvl) => (
            <button
              key={lvl.count}
              onClick={() => handleRestart(lvl.count)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                cardsCount === lvl.count ? 'bg-primary text-white shadow-xs font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>

        {/* Cards Grid */}
        <div
          className={`grid gap-3 sm:gap-4 w-full ${
            cardsCount === 4
              ? 'grid-cols-2 sm:grid-cols-4 max-w-2xl'
              : cardsCount === 6
              ? 'grid-cols-3 sm:grid-cols-4 max-w-3xl'
              : 'grid-cols-4 sm:grid-cols-4 max-w-4xl'
          }`}
        >
          {cards.map((card) => {
            const isShown = card.isFlipped || card.isMatched;
            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(card)}
                className={`h-28 sm:h-36 rounded-3xl cursor-pointer transition-all duration-300 relative select-none ${
                  card.isMatched
                    ? 'opacity-80 scale-95 pointer-events-none'
                    : 'hover:scale-105 active:scale-95'
                }`}
                style={{ perspective: '1000px' }}
              >
                <div
                  className={`w-full h-full rounded-3xl transition-transform duration-500 shadow-xl flex items-center justify-center text-center p-3 border-2 ${
                    isShown
                      ? card.isMatched
                        ? 'bg-emerald-950/80 border-emerald-500/80'
                        : 'bg-slate-800 border-primary'
                      : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {isShown ? (
                    <div className="flex flex-col items-center justify-center gap-1 animate-scale-up">
                      {card.emoji && <span className="text-2xl sm:text-3xl">{card.emoji}</span>}
                      <span className="font-black text-sm sm:text-base text-white break-words line-clamp-2">
                        {card.content}
                      </span>
                      {card.subContent && (
                        <span className="text-[10px] text-slate-400 font-bold">{card.subContent}</span>
                      )}
                      {card.isMatched && (
                        <span className="text-[10px] text-emerald-400 font-black mt-1 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> تم المطابقة
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-slate-600">
                      <span className="text-2xl opacity-60">🇩🇪</span>
                      <span className="text-[11px] font-bold text-slate-500">اقلب الكرت</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Overlay */}
      {isGameCompleted && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-primary/60 rounded-3xl max-w-md w-full p-8 text-center shadow-2xl flex flex-col items-center gap-5 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-4xl shadow-xl">
              🎉
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">أحسنت! أتممت مطابقة البطاقات بنجاح</h2>
              <div className="flex items-center justify-center gap-1 mt-3">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    className={`w-7 h-7 ${
                      star <= starsEarned
                        ? 'fill-amber-400 text-amber-400 animate-bounce'
                        : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-center">
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">الوقت المستغرق</span>
                <span className="text-base font-black text-white font-mono">{formatTime(timerSeconds)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">عدد الحركات</span>
                <span className="text-base font-black text-white font-mono">{movesCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => handleRestart(cardsCount)}
                className="flex-1 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black text-sm shadow-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> العب مرة أخرى
              </button>
              <button
                onClick={onBack}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              >
                خروج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
