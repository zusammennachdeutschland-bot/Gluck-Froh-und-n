import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { getFreePeriodsForDate, getBookableSlots, formatTimeDisplay, formatLocalDate } from '../utils/timeUtils';
import { motion, AnimatePresence } from 'motion/react';

type FilterType = 'today' | 'tomorrow' | 'this_week' | 'specific_day';
type DisplayMode = 'periods' | 'slots';
type SlotDuration = 30 | 60 | 90 | 120;

export const FreeTimeSlotsView: React.FC = () => {
  const { profile, lessons, groups, language, t } = useApp();
  
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [specificDate, setSpecificDate] = useState<string>(formatLocalDate());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('periods');
  const [slotDuration, setSlotDuration] = useState<SlotDuration>(60);

  const datesToAnalyze = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    
    if (filterType === 'today') {
      dates.push(formatLocalDate(today));
    } else if (filterType === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dates.push(formatLocalDate(tomorrow));
    } else if (filterType === 'this_week') {
      // Show next 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(formatLocalDate(d));
      }
    } else if (filterType === 'specific_day') {
      dates.push(specificDate);
    }
    return dates;
  }, [filterType, specificDate]);

  const results = useMemo(() => {
    if (!profile.weeklyWorkingHours) return [];
    
    return datesToAnalyze.map(dateStr => {
      const freePeriods = getFreePeriodsForDate(dateStr, lessons, groups, profile.weeklyWorkingHours!);
      
      const slotsToDisplay = displayMode === 'periods' 
        ? freePeriods 
        : getBookableSlots(freePeriods, slotDuration);
        
      return {
        dateStr,
        slots: slotsToDisplay,
        totalPeriods: freePeriods.length
      };
    }).filter(r => filterType === 'this_week' ? r.slots.length > 0 : true);
  }, [datesToAnalyze, lessons, groups, profile.weeklyWorkingHours, displayMode, slotDuration]);

  if (!profile.weeklyWorkingHours) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
        <Clock className="w-16 h-16 text-slate-300 dark:text-slate-700" />
        <h2 className="text-xl font-black text-text-main">{language === 'ar' ? 'لم يتم تعيين ساعات العمل' : language === 'de' ? 'Arbeitszeiten nicht festgelegt' : 'Weekly Working Hours Not Set'}</h2>
        <p className="text-sm text-text-muted">{language === 'ar' ? 'يرجى ضبط ساعات العمل الأسبوعية في الإعدادات.' : language === 'de' ? 'Bitte Arbeitszeiten in den Einstellungen konfigurieren.' : 'Please configure your weekly working hours in Settings to use the Smart Free Time Finder.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto font-sans pb-24">
      {/* HEADER */}
      <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-surface-border shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-text-main">{language === 'ar' ? 'البحث الذكي عن الأوقات الفارغة' : language === 'de' ? 'Smarte Freizeitsuche' : 'Smart Free Time Finder'}</h2>
            <p className="text-xs text-text-muted">{language === 'ar' ? 'يبحث تلقائياً عن الفترات المتاحة.' : language === 'de' ? 'Findet automatisch verfügbare Zeiten.' : 'Automatically finds available slots based on your schedule.'}</p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'today', label: language === 'ar' ? 'اليوم' : language === 'de' ? 'Heute' : 'Today' },
              { id: 'tomorrow', label: language === 'ar' ? 'غداً' : language === 'de' ? 'Morgen' : 'Tomorrow' },
              { id: 'this_week', label: language === 'ar' ? 'هذا الأسبوع' : language === 'de' ? 'Diese Woche' : 'This Week' },
              { id: 'specific_day', label: language === 'ar' ? 'يوم محدد' : language === 'de' ? 'Bestimmter Tag' : 'Specific Day' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as FilterType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterType === f.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                }`}
              >
                {f.label}
              </button>
            ))}
            
            {filterType === 'specific_day' && (
              <input 
                type="date"
                value={specificDate}
                onChange={e => setSpecificDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-surface border border-primary text-primary focus:outline-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* DISPLAY MODES & DURATION */}
      <div className="bg-surface p-4 rounded-2xl border border-surface-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div className="flex items-center p-1 bg-surface-hover rounded-xl border border-surface-border w-full sm:w-auto">
          <button
            onClick={() => setDisplayMode('periods')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              displayMode === 'periods' ? 'bg-surface shadow-sm text-text-main' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {language === 'ar' ? 'فترات متصلة' : language === 'de' ? 'Zusammenhängende Zeit' : 'Continuous Periods'}
          </button>
          <button
            onClick={() => setDisplayMode('slots')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              displayMode === 'slots' ? 'bg-surface shadow-sm text-text-main' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {language === 'ar' ? 'أوقات قابلة للحجز' : language === 'de' ? 'Buchbare Slots' : 'Bookable Slots'}
          </button>
        </div>

        {displayMode === 'slots' && (
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">{language === 'ar' ? 'المدة:' : language === 'de' ? 'Dauer:' : 'Duration:'}</span>
            {[30, 60, 90, 120].map(dur => (
              <button
                key={dur}
                onClick={() => setSlotDuration(dur as SlotDuration)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  slotDuration === dur
                    ? 'bg-primary-soft text-primary'
                    : 'bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                }`}
              >
                {dur} min
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RESULTS */}
      <div className="space-y-4">
        {results.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm font-bold bg-surface rounded-2xl border border-surface-border border-dashed">
            {language === 'ar' ? 'لا يوجد أوقات فارغة' : language === 'de' ? 'Keine freie Zeit gefunden.' : 'No free time found for the selected period.'}
          </div>
        ) : (
          results.map((result, idx) => {
            const dateObj = new Date(result.dateStr);
            const isToday = result.dateStr === formatLocalDate();
            const title = isToday ? 'Today' : dateObj.toLocaleDateString(language, { weekday: 'long', month: 'short', day: 'numeric' });
            
            return (
              <div key={idx} className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
                <div className="bg-surface-hover px-4 py-3 border-b border-surface-border flex items-center justify-between">
                  <h3 className="text-sm font-black text-text-main">{title}</h3>
                  <span className="text-[10px] font-bold text-text-muted bg-surface px-2 py-1 rounded-md border border-surface-border">
                    {result.slots.length} {displayMode === 'periods' ? (language === 'ar' ? 'فترات' : 'Periods') : (language === 'ar' ? 'مواعيد' : 'Slots')}
                  </span>
                </div>
                
                <div className="p-4">
                  {result.slots.length === 0 ? (
                    <div className="text-center py-6 text-xs text-text-muted font-bold">{language === 'ar' ? 'محجوز بالكامل أو يوم عطلة.' : language === 'de' ? 'Ausgebucht oder freier Tag.' : 'Fully booked or off day.'}</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {result.slots.map((slot, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between p-3 rounded-xl border border-primary-border/30 bg-primary-soft/20 hover:bg-primary-soft/40 transition-colors">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-text-main font-mono">
                              {formatTimeDisplay(slot.start, language)}
                            </span>
                          </div>
                          <span className="text-text-muted text-xs">→</span>
                          <span className="text-sm font-bold text-text-main font-mono">
                            {formatTimeDisplay(slot.end, language)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
