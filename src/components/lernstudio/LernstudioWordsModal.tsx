import React, { useState } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle, getLocalizedSetTopic } from '../../utils/lernstudioTranslations';
import { X, Volume2, Search, Gamepad2, BookOpen, Printer } from 'lucide-react';

interface Props {
  isOpen: boolean;
  set: LernstudioSet;
  language?: string;
  onClose: () => void;
  onStartGames: () => void;
  onStartTeach: () => void;
  onStartWorksheet: () => void;
}

export const LernstudioWordsModal: React.FC<Props> = ({
  isOpen,
  set,
  language = 'ar',
  onClose,
  onStartGames,
  onStartTeach,
  onStartWorksheet
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';

  if (!isOpen || !set) return null;

  const displayTitle = getLocalizedSetTitle(set, language);
  const displayTopic = getLocalizedSetTopic(set, language);
  const items = set.items || [];

  const handleSpeakGerman = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const filteredItems = items.filter((it) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      it.german.toLowerCase().includes(q) ||
      it.arabic.toLowerCase().includes(q) ||
      (it.example && it.example.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-fade-in"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-text-main truncate">
                {displayTitle}
              </h2>
              <div className="flex items-center gap-2 text-xs text-text-muted font-medium mt-0.5">
                <span>{displayTopic}</span>
                <span>·</span>
                <span>{items.length} {t.vocabularyCount}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 bg-surface/50 border-b border-surface-border shrink-0">
          <div className="relative">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-text-muted ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchWordsPlaceholder}
              className={`w-full py-2 bg-background text-text-main rounded-xl border border-surface-border focus:outline-none focus:border-primary text-xs sm:text-sm font-medium ${
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
          </div>
        </div>

        {/* Vocabulary List Content */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-2.5 flex-1 min-h-[250px]">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs sm:text-sm">
              {t.noSetsFound}
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-surface-hover/60 border border-surface-border/60 hover:border-primary/40 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-black text-text-main tracking-wide" dir="ltr">
                      {item.german}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSpeakGerman(item.german)}
                      className="p-1 rounded-lg text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                      title={t.listenAudio}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-text-muted font-bold">
                    {item.arabic}
                  </p>

                  {item.example && (
                    <p className="text-[11px] text-text-muted/80 italic font-normal pt-0.5 line-clamp-1" dir="ltr">
                      "{item.example}"
                    </p>
                  )}
                </div>

                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.german}
                    className="w-12 h-12 object-cover rounded-xl border border-surface-border shrink-0"
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-surface-border bg-surface flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <button
              type="button"
              onClick={onStartGames}
              className="py-2 px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>{t.playGame}</span>
            </button>

            <button
              type="button"
              onClick={onStartTeach}
              className="py-2 px-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.teachMode}</span>
            </button>

            <button
              type="button"
              onClick={onStartWorksheet}
              className="py-2 px-3 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4 text-primary" />
              <span>{t.printWorksheet}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-surface-hover text-text-muted hover:text-text-main text-xs font-bold border border-surface-border cursor-pointer transition-all shrink-0"
          >
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
