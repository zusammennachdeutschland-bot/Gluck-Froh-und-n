import React, { useState, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme } from '../../../types/lernstudio';
import { extractSortingItems, SortingItem } from '../../../utils/lernstudioQuestionAdapter';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  ArrowLeft,
  RotateCcw,
  Flame,
  Heart,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

export const LernstudioSortingGame: React.FC<Props> = ({ set, activeTheme, language = 'ar', onBack }) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);

  const itemsPool = useMemo(() => extractSortingItems(set.items || []), [set]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; selectedArticle: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);

  const currentItem: SortingItem | undefined = itemsPool[currentIndex];

  const handleSelectBin = (article: 'der' | 'die' | 'das') => {
    if (!currentItem || feedback || isGameOver) return;

    const isCorrect = currentItem.article.toLowerCase() === article.toLowerCase();

    setFeedback({ isCorrect, selectedArticle: article });

    if (isCorrect) {
      if (soundEnabled) {
        playLernstudioSound('combo_ding');
        playLernstudioSound('correct');
      }
      const newStreak = streak + 1;
      const pts = 50 * (newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1);
      setScore((s) => s + pts);
      setStreak(newStreak);
    } else {
      if (soundEnabled) playLernstudioSound('wrong');
      setStreak(0);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setIsGameOver(true);
        return;
      }
    }

    setTimeout(() => {
      setFeedback(null);
      if (currentIndex + 1 < itemsPool.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsGameOver(true);
      }
    }, 900);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setLives(3);
    setFeedback(null);
    setIsGameOver(false);
  };

  if (itemsPool.length === 0) {
    return (
      <div className="min-h-screen bg-background text-text-main flex flex-col items-center justify-center p-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-surface border border-surface-border p-8 rounded-3xl max-w-md space-y-4 shadow-xl">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-lg font-black text-text-main">{t.sortingGameTitle}</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            {t.sortingEmptyWarning}
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-primary text-white font-bold rounded-2xl cursor-pointer hover:bg-primary-hover transition-colors inline-flex items-center gap-2 shadow-xs"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col font-sans select-none" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>
          <div className="h-6 w-px bg-slate-700 hidden sm:block" />
          <h1 className="text-sm sm:text-base font-black flex items-center gap-2">
            <span>📦 {t.sortingGameHeader}</span>
            <span className="text-xs font-normal text-slate-400">· {displaySetTitle}</span>
          </h1>
        </div>

        {/* Lives, Streak & Score */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Lives */}
          <div className="flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            {[1, 2, 3].map((heart) => (
              <Heart
                key={heart}
                className={`w-4 h-4 transition-colors ${
                  heart <= lives ? 'fill-rose-500 text-rose-500' : 'text-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Streak Flame */}
          {streak >= 2 && (
            <div className="flex items-center gap-1 text-xs font-black text-amber-400 bg-amber-500/20 px-2.5 py-1.5 rounded-xl border border-amber-500/30 animate-pulse">
              <Flame className="w-4 h-4 fill-amber-400" />
              <span>x{streak >= 5 ? '3' : '2'} Combo!</span>
            </div>
          )}

          {/* Score */}
          <div className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1 text-xs font-bold text-amber-300 font-mono">
            <span>{score}</span>
            <span className="text-slate-400 font-normal">{t.scorePts}</span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
        </div>
      </div>

      {/* Main Sorting Game Area */}
      <div className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full flex flex-col justify-between items-center py-8">
        {/* Current Word Target Card */}
        {currentItem && !isGameOver ? (
          <div className="w-full max-w-md flex flex-col items-center gap-4 animate-scale-up">
            <span className="text-xs font-black text-slate-400 tracking-wider">
              {t.questionProgress} {currentIndex + 1} / {itemsPool.length}
            </span>

            <div
              className={`w-full p-8 rounded-3xl border-2 transition-all shadow-2xl flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden ${
                feedback
                  ? feedback.isCorrect
                    ? 'bg-emerald-950/80 border-emerald-500 shadow-emerald-900/40'
                    : 'bg-rose-950/80 border-rose-500 shadow-rose-900/40'
                  : 'bg-slate-900 border-slate-700'
              }`}
            >
              {currentItem.emoji && <span className="text-5xl">{currentItem.emoji}</span>}
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {currentItem.nounOnly}
              </h2>
              <p className="text-base text-slate-400 font-bold">{getItemTranslation(currentItem, language)}</p>

              {/* Instant feedback icon */}
              {feedback && (
                <div className="absolute top-4 right-4 animate-scale-up">
                  {feedback.isCorrect ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-400" />
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 font-bold">
              {t.sortingSubTitle}
            </p>
          </div>
        ) : null}

        {/* 3 Colored Bins: der, die, das */}
        {!isGameOver && (
          <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-2xl mt-8">
            {/* DER BIN */}
            <button
              onClick={() => handleSelectBin('der')}
              disabled={!!feedback}
              className={`p-5 sm:p-7 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-xl active:scale-95 hover:scale-105 ${
                feedback?.selectedArticle === 'der'
                  ? feedback.isCorrect
                    ? 'bg-blue-600 border-white text-white'
                    : 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-blue-900/40 border-blue-500/60 hover:bg-blue-900/60 hover:border-blue-400 text-blue-200'
              }`}
            >
              <span className="text-3xl sm:text-4xl font-black tracking-wider">der</span>
              <span className="text-[11px] font-bold text-blue-300">Maskulin</span>
            </button>

            {/* DIE BIN */}
            <button
              onClick={() => handleSelectBin('die')}
              disabled={!!feedback}
              className={`p-5 sm:p-7 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-xl active:scale-95 hover:scale-105 ${
                feedback?.selectedArticle === 'die'
                  ? feedback.isCorrect
                    ? 'bg-rose-600 border-white text-white'
                    : 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-rose-900/40 border-rose-500/60 hover:bg-rose-900/60 hover:border-rose-400 text-rose-200'
              }`}
            >
              <span className="text-3xl sm:text-4xl font-black tracking-wider">die</span>
              <span className="text-[11px] font-bold text-rose-300">Feminin</span>
            </button>

            {/* DAS BIN */}
            <button
              onClick={() => handleSelectBin('das')}
              disabled={!!feedback}
              className={`p-5 sm:p-7 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-xl active:scale-95 hover:scale-105 ${
                feedback?.selectedArticle === 'das'
                  ? feedback.isCorrect
                    ? 'bg-emerald-600 border-white text-white'
                    : 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-emerald-900/40 border-emerald-500/60 hover:bg-emerald-900/60 hover:border-emerald-400 text-emerald-200'
              }`}
            >
              <span className="text-3xl sm:text-4xl font-black tracking-wider">das</span>
              <span className="text-[11px] font-bold text-emerald-300">Neutral</span>
            </button>
          </div>
        )}

        {/* Game Over / Summary */}
        {isGameOver && (
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center gap-4 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-xl">
              🏆
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                {t.completedGameTitle}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {t.pointsLabel} <strong className="text-amber-300 font-mono text-lg">{score}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3 w-full mt-4">
              <button
                onClick={handleRestart}
                className="flex-1 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black text-sm shadow-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> {t.restartGameBtn}
              </button>
              <button
                onClick={onBack}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              >
                {t.gamesPortalBack}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
