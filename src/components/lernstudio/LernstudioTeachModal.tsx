import React, { useState } from 'react';
import { LernstudioSet, LernstudioItem } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle } from '../../utils/lernstudioTranslations';
import { X, Volume2, ChevronRight, ChevronLeft, BookOpen } from 'lucide-react';

interface Props {
  isOpen: boolean;
  set: LernstudioSet;
  language?: string;
  onClose: () => void;
}

export const LernstudioTeachModal: React.FC<Props> = ({ isOpen, set, language = 'ar', onClose }) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);

  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen || !set || !set.items || set.items.length === 0) return null;

  const items = set.items;
  const currentItem: LernstudioItem = items[currentIndex];

  const handleSpeakGerman = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < items.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0); // loop or finish
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(items.length - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm sm:text-base font-black text-text-main">
                {t.teachModeTitle} - ({displaySetTitle})
              </h2>
              <span className="text-[10px] font-bold text-text-muted">
                {set.topic}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-hover h-1.5 shrink-0">
          <div
            className="bg-primary h-1.5 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
          />
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 flex flex-col items-center justify-center text-center">
          {/* Item Card Presentation */}
          <div className="w-full bg-primary-soft/40 border border-primary-border/40 rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm relative">
            <span className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-primary text-white text-xs font-black font-mono shadow-xs">
              {currentIndex + 1} / {items.length}
            </span>

            {/* Emoji */}
            <div className="text-7xl sm:text-8xl animate-bounce pt-2">
              {currentItem.emoji || '🇩🇪'}
            </div>

            {/* German Word & Audio */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h3 className="text-2xl sm:text-3xl font-black text-text-main tracking-tight font-mono" dir="ltr">
                  {currentItem.german}
                </h3>
                <button
                  type="button"
                  onClick={() => handleSpeakGerman(currentItem.german)}
                  className="p-2 bg-primary text-white rounded-xl shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center justify-center"
                  title={t.listenAudio}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {currentItem.plural && (
                <p className="text-xs font-bold text-text-muted font-mono" dir="ltr">
                  Plural: <span className="text-text-main">{currentItem.plural}</span>
                </p>
              )}
            </div>

            {/* Translation */}
            <div className="py-2 px-4 bg-surface rounded-2xl border border-surface-border inline-block shadow-2xs">
              <span className="text-base sm:text-lg font-black text-primary">
                {currentItem.arabic}
              </span>
            </div>

            {/* Example Sentence */}
            {(currentItem.exampleSentenceGerman || currentItem.exampleSentenceArabic) && (
              <div className="p-3.5 bg-surface/90 border border-surface-border rounded-2xl space-y-1 text-right">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Beispielsatz:</span>
                {currentItem.exampleSentenceGerman && (
                  <div className="text-xs font-bold text-text-main font-mono flex items-center justify-between gap-2" dir="ltr">
                    <span>{currentItem.exampleSentenceGerman}</span>
                    <button
                      type="button"
                      onClick={() => handleSpeakGerman(currentItem.exampleSentenceGerman!)}
                      className="p-1 bg-surface-hover hover:bg-primary-soft text-primary rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {currentItem.exampleSentenceArabic && (
                  <div className="text-xs font-bold text-text-muted" dir={isRtl ? 'rtl' : 'ltr'}>
                    {currentItem.exampleSentenceArabic}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            className="px-4 py-2.5 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <ChevronRight className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.prevSlide}</span>
          </button>

          <span className="text-xs font-black text-text-muted font-mono">
            {currentIndex + 1} / {items.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>{t.nextSlide}</span>
            {currentIndex + 1 < items.length && <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />}
          </button>
        </div>
      </div>
    </div>
  );
};
