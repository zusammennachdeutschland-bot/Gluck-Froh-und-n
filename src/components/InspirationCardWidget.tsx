import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, X, Star, RefreshCw, Quote } from 'lucide-react';

export const InspirationCardWidget: React.FC = () => {
  const { 
    activeInspirationCard, 
    dismissInspirationCard, 
    toggleFavoriteInspirationMessage,
    checkAndTriggerInspirationReminder,
    inspirationSettings,
    language, t, _t
  } = useApp();

  // Helper for inline translations
  



  React.useEffect(() => {
    if (activeInspirationCard) {
      const timer = setTimeout(() => {
        dismissInspirationCard();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeInspirationCard, dismissInspirationCard]);

  if (!activeInspirationCard || inspirationSettings.frequency === 'disabled') {
    return null;
  }

  if (inspirationSettings.displayMethod !== 'in_app' && inspirationSettings.displayMethod !== 'both') {
    return null;
  }

  const isFavorite = activeInspirationCard.isFavorite;

  return (
    <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg p-4 shadow-2xs relative overflow-hidden transition-all animate-fade-in font-sans">
      {/* Decorative subtle background icon */}
      <div className="absolute -bottom-3 -left-3 text-primary/5 pointer-events-none">
        <Quote className="w-20 h-20 rotate-180" />
      </div>

      <div className="relative z-10 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary text-white rounded-xl shrink-0 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-[11px] font-black text-primary dark:text-primary uppercase tracking-wider">
                {_t('إلهام اليوم', 'Daily Inspiration', 'Tägliche Inspiration')}
              </h3>
              <p className="text-[9px] text-primary/80 dark:text-primary/80 font-medium">
                {_t('تذكير للمعلم وخطوة للبركة', 'Teacher Reminder & Motivation')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleFavoriteInspirationMessage(activeInspirationCard.id)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                isFavorite 
                  ? 'bg-primary/20 text-primary dark:text-primary' 
                  : 'text-text-muted/70 hover:text-primary hover:bg-primary/10'
              }`}
              title={isFavorite ? 'مفضلة' : 'إضافة للمفضلة'}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => checkAndTriggerInspirationReminder('manual')}
              className="p-1.5 text-text-muted/70 hover:text-primary dark:hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
              title={_t('رسالة أخرى', 'Another Message')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={dismissInspirationCard}
              className="p-1.5 text-text-muted/70 hover:text-primary dark:hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
              title={_t('إغلاق', 'Dismiss')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message body - flat layout */}
        <div className="pt-1.5">
          <p className={`text-sm font-bold text-text-main leading-relaxed font-sans ${language === 'ar' ? 'text-right dir-rtl' : 'text-left'}`}>
            "{activeInspirationCard.text}"
          </p>
        </div>
      </div>
    </div>
  );
};
