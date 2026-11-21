import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { normalizeDateToISO, parseLocalDate } from '../utils/timeUtils';
import { useLocalDateKey } from '../hooks/useLocalDateKey';
import {
  computeDashboardPeriodStats,
  getDashboardLessonsForRange,
  getWeekDateRangeFridayToThursday,
} from '../utils/dashboardStatsUtils';
import { CheckCircle2, XCircle, Clock, Wallet, CalendarDays, Target } from 'lucide-react';

export const WeeklyOverviewWidget: React.FC = () => {
  const { lessons, getFullLessonsSnapshot, groups, groupWeeklySessions, payments, profile, language, t, _t } = useApp();
  const todayStr = useLocalDateKey();

  // Week calculation: Friday to Thursday using unified lesson range source (today/future projected without retroactive past fabrication)
  const stats = useMemo(() => {
    const refDate = parseLocalDate(todayStr);
    const { startDateStr: friStr, endDateStr: thuStr, startDate: friday, endDate: thursday } =
      getWeekDateRangeFridayToThursday(refDate);

    const weekLessons = getDashboardLessonsForRange({
      startDateStr: friStr,
      endDateStr: thuStr,
      todayStr,
      lessons: getFullLessonsSnapshot(),
      groups,
      groupWeeklySessions,
    });

    const { completed, cancelled, remaining } = computeDashboardPeriodStats(weekLessons);

    // Use actual payment records for accurate revenue tracking (matching Payments View)
    const paidOnly = payments.filter(p => p.status === 'paid' && !p.deleted);
    const weeklyPayments = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      if (!d) return false;
      const dateOnly = normalizeDateToISO(d);
      return dateOnly >= friStr && dateOnly <= thuStr;
    });
    const revenue = weeklyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    const pendingOnly = payments.filter(p => p.status !== 'paid' && !p.deleted);
    const weeklyPending = pendingOnly.filter(p => {
      const d = p.dueDate;
      if (!d) return false;
      const dateOnly = normalizeDateToISO(d);
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
  }, [todayStr, lessons, getFullLessonsSnapshot, groups, groupWeeklySessions, payments, language]);

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
