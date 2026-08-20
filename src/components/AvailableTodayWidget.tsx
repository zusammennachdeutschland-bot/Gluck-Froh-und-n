import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, ChevronRight, CheckCircle2, Calendar } from 'lucide-react';
import { getFreePeriodsForDate, getBookableSlots, formatLocalDate } from '../utils/timeUtils';

export const AvailableTodayWidget: React.FC = () => {
  const { language, profile, lessons, groups, setActiveTab, t } = useApp();
  
  
  const todayStr = formatLocalDate();

  const { totalHours, slotsCount, nextSlot } = useMemo(() => {
    if (!profile.weeklyWorkingHours) return { totalHours: '0h 0m', slotsCount: 0, nextSlot: null };

    const freePeriods = getFreePeriodsForDate(todayStr, lessons, groups, profile.weeklyWorkingHours, profile);
    
    let totalMins = 0;
    freePeriods.forEach(p => {
      totalMins += (p.endMin - p.startMin);
    });
    
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    
    // Default 60 min slots for dashboard
    const bookable = getBookableSlots(freePeriods, 60);
    
    // Find next slot from now
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const futureSlots = bookable.filter(s => s.startMin >= currentMin);
    
    return {
      totalHours: `${h}h ${m}m`,
      slotsCount: bookable.length,
      nextSlot: futureSlots.length > 0 ? futureSlots[0] : null
    };
  }, [profile.weeklyWorkingHours, profile, lessons, groups, todayStr]);

  if (!profile.weeklyWorkingHours) return null;

  return (
    <div 
      onClick={() => setActiveTab('freeTime')}
      className="bg-surface border border-surface-border rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-primary-soft text-primary border border-primary-border">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-black text-text-main tracking-wider">
            {t('free_time_available_today')}
          </h3>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted transition-colors" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{t('auto_free_hours')}</span>
          <span className="text-xs sm:text-sm font-black text-primary font-mono">{totalHours}</span>
        </div>
        
        <div className="flex flex-col gap-0.5 border-l border-surface-border pl-2">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{t('auto_slots')}</span>
          <span className="text-xs sm:text-sm font-black text-primary font-mono">{slotsCount}</span>
        </div>

        <div className="flex flex-col gap-0.5 border-l border-surface-border pl-2">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{t('auto_next_slot')}</span>
          <span className="text-[11px] sm:text-xs font-black text-slate-700 dark:text-slate-300 font-mono">
            {nextSlot ? `${nextSlot.start}` : t('auto_none')}
          </span>
        </div>
      </div>
    </div>
  );
};
