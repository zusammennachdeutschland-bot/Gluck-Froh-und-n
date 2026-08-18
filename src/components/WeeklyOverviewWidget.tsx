import React from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';

import { CheckCircle2, XCircle, Clock, Wallet, CalendarDays } from 'lucide-react';

export const WeeklyOverviewWidget: React.FC = () => {
  const { lessons, groups, students, payments, profile, language, t } = useApp();

  // Helper for inline translations
  

  // Week calculation: Friday to Thursday
  const getWeekStats = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    const daysSinceFriday = (day + 2) % 7;

    const friday = new Date(now);
    friday.setDate(now.getDate() - daysSinceFriday);
    friday.setHours(0, 0, 0, 0);

    const thursday = new Date(friday);
    thursday.setDate(friday.getDate() + 6);
    thursday.setHours(23, 59, 59, 999);

    const friStr = formatLocalDate(friday);
    const thuStr = formatLocalDate(thursday);

    const weekLessons = lessons.filter(l => l.date >= friStr && l.date <= thuStr);

    const completed = weekLessons.filter(l => l.status === 'completed').length;
    const cancelled = weekLessons.filter(l => l.status === 'cancelled').length;
    const remaining = weekLessons.filter(l => l.status === 'scheduled' || l.status === 'in_progress').length;

    // Use actual payment records for accurate revenue tracking (matching Payments View)
    const paidOnly = payments.filter(p => p.status === 'paid');
    const weeklyPayments = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      if (!d) return false;
      const dateOnly = d.substring(0, 10);
      return dateOnly >= friStr && dateOnly <= thuStr;
    });
    const revenue = weeklyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    return { completed, cancelled, remaining, revenue, friStr, thuStr };
  };

  const { completed, cancelled, remaining, revenue } = getWeekStats();
  const currency = profile.currency || (t('auto_egp'));

  return (
    <div className="bg-surface border border-surface-border rounded-2xl p-4 shadow-2xs transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-soft dark:bg-primary-soft/80 text-primary dark:text-primary border border-primary-border dark:border-primary-border/60 active:scale-95 transition-all hover:bg-primary/20">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
              {t('weekly_overview_title')}
            </h3>
            <p className="text-[10px] text-text-muted font-bold">
              {t('weekly_overview_sub')}
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        {/* Completed */}
        <div className="bg-background dark:bg-background/60 p-2.5 rounded-xl border border-surface-border/80 dark:border-surface-border transition-all">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-primary dark:text-primary mb-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{t('daily_stats_completed_short')}</span>
          </div>
          <span className="text-sm font-black text-text-main font-mono">
            {completed}
          </span>
        </div>

        {/* Cancelled */}
        <div className="bg-background dark:bg-background/60 p-2.5 rounded-xl border border-surface-border/80 dark:border-surface-border transition-all">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-primary dark:text-primary mb-1">
            <XCircle className="w-3 h-3" />
            <span>{t('stat_cancelled')}</span>
          </div>
          <span className="text-sm font-black text-text-main font-mono">
            {cancelled}
          </span>
        </div>

        {/* Remaining */}
        <div className="bg-background dark:bg-background/60 p-2.5 rounded-xl border border-surface-border/80 dark:border-surface-border transition-all">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-primary dark:text-primary mb-1">
            <Clock className="w-3 h-3" />
            <span>{t('stat_remaining')}</span>
          </div>
          <span className="text-sm font-black text-text-main font-mono">
            {remaining}
          </span>
        </div>

        {/* Revenue */}
        <div className="bg-background dark:bg-background/60 p-2.5 rounded-xl border border-surface-border/80 dark:border-surface-border transition-all">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-primary dark:text-primary mb-1">
            <Wallet className="w-3 h-3" />
            <span>{t('daily_stats_revenue')}</span>
          </div>
          <span className="text-sm font-black text-primary dark:text-primary font-mono">
            {revenue.toLocaleString()} <span className="text-[10px] text-text-muted font-sans">{currency}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
