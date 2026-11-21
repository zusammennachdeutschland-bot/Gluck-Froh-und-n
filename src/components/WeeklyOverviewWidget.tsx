import React from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { CheckCircle2, XCircle, Clock, Wallet, CalendarDays, Target } from 'lucide-react';

export const WeeklyOverviewWidget: React.FC = () => {
  const { lessons, groups, students, payments, profile, language, t, _t } = useApp();

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

    const weekLessons = lessons.filter(l => l.date >= friStr && l.date <= thuStr && !l.deleted);

    const completed = weekLessons.filter(l => l.status === 'completed').length;
    const cancelled = weekLessons.filter(l => l.status === 'cancelled').length;
    const remaining = weekLessons.filter(l => l.status === 'scheduled' || l.status === 'in_progress').length;

    // Use actual payment records for accurate revenue tracking (matching Payments View)
    const paidOnly = payments.filter(p => p.status === 'paid' && !p.deleted);
    const weeklyPayments = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      if (!d) return false;
      const dateOnly = d.substring(0, 10);
      return dateOnly >= friStr && dateOnly <= thuStr;
    });
    const revenue = weeklyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    const pendingOnly = payments.filter(p => p.status !== 'paid' && !p.deleted);
    const weeklyPending = pendingOnly.filter(p => {
      const d = p.dueDate;
      if (!d) return false;
      const dateOnly = d.substring(0, 10);
      return dateOnly >= friStr && dateOnly <= thuStr;
    });
    const pendingRevenue = weeklyPending.reduce((sum, p) => sum + p.amountDue, 0);

    return {
      completed,
      cancelled,
      remaining,
      revenue,
      pendingRevenue,
      totalExpected: revenue + pendingRevenue,
      dateRange: `${friday.toLocaleDateString(language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' })} - ${thursday.toLocaleDateString(language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' })}`
    };
  };

  const stats = getWeekStats();
  const targetGoal = profile.weeklyIncomeGoal || 0;
  const goalPercent = targetGoal > 0 ? Math.min(100, Math.round((stats.revenue / targetGoal) * 100)) : 0;

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-md bg-primary-soft text-primary border border-primary-border">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-main truncate">
              {t('weekly_overview_title')}
            </h3>
            <span className="text-[10px] text-text-muted font-bold block">
              {stats.dateRange}
            </span>
          </div>
        </div>

        {targetGoal > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-soft border border-primary-border text-[10px] font-bold text-primary">
            <Target className="w-3 h-3 text-primary" />
            <span>{goalPercent}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="p-1.5 rounded-lg bg-surface-hover border border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-primary">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            <span>{t('status_completed')}</span>
          </div>
          <span className="text-sm font-black text-text-main mt-0.5 block">
            {stats.completed}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-surface-hover border border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-text-muted">
            <XCircle className="w-3 h-3 text-text-muted" />
            <span>{t('status_cancelled')}</span>
          </div>
          <span className="text-sm font-black text-text-main mt-0.5 block">
            {stats.cancelled}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-surface-hover border border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-text-muted">
            <Clock className="w-3 h-3 text-primary" />
            <span>{t('stat_remaining')}</span>
          </div>
          <span className="text-sm font-black text-text-main mt-0.5 block">
            {stats.remaining}
          </span>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="pt-1.5 border-t border-surface-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-text-muted font-bold text-[11px]">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span>{_t('المحصل / المتوقع:', 'Collected / Expected:', 'Eingenommen / Erwartet:')}</span>
        </div>
        <div className="flex items-center gap-1 font-mono font-black text-xs">
          <span className="text-primary">{stats.revenue}</span>
          <span className="text-text-muted/60">/</span>
          <span className="text-text-main">{stats.totalExpected}</span>
          <span className="text-[10px] font-sans text-text-muted">{profile.currency || 'EGP'}</span>
        </div>
      </div>
    </div>
  );
};
