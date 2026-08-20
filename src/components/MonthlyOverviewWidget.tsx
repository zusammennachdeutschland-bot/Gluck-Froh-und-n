import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import { TrendingUp, CheckCircle2, XCircle, Clock, Wallet, AlertCircle, DollarSign, Target } from 'lucide-react';

export const MonthlyOverviewWidget: React.FC = () => {
  const { lessons, students, groups, payments, profile, language, t } = useApp();

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthStats = useMemo(() => {
    const monthLessons = lessons.filter(l => l.date.startsWith(currentMonthPrefix));

    const completed = monthLessons.filter(l => l.status === 'completed').length;
    const cancelled = monthLessons.filter(l => l.status === 'cancelled').length;
    const remaining = monthLessons.filter(l => l.status === 'scheduled' || l.status === 'in_progress').length;

    // Use actual payment records for accurate revenue tracking (matching Payments View)
    const paidOnly = payments.filter(p => p.status === 'paid');
    const monthlyPayments = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      return d && d.startsWith(currentMonthPrefix);
    });
    const collected = monthlyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    const pendingOnly = payments.filter(p => p.status !== 'paid');
    const monthlyPending = pendingOnly.filter(p => {
      const d = p.dueDate;
      return d && d.startsWith(currentMonthPrefix);
    });
    const uncollected = monthlyPending.reduce((sum, p) => sum + p.amountDue, 0);
    const totalExpected = collected + uncollected;

    return {
      completed,
      cancelled,
      remaining,
      collected,
      uncollected,
      totalExpected
    };
  }, [lessons, students, groups, payments, currentMonthPrefix]);

  const currency = profile.currency || (t('auto_egp'));

  const monthlyGoal = profile.monthlyIncomeGoal && profile.monthlyIncomeGoal > 0 ? profile.monthlyIncomeGoal : null;
  const hasMonthlyGoal = monthlyGoal !== null;
  const monthlyPercent = hasMonthlyGoal ? Math.round((monthStats.collected / monthlyGoal) * 100) : 0;
  const remainingToGoal = hasMonthlyGoal ? Math.max(0, monthlyGoal - monthStats.collected) : 0;

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border dark:border-primary-border">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
            {t('daily_stats_monthly_overview')}
          </h3>
        </div>
      </div>

      {/* Grid: 3 columns x 2 rows (Compact Card) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
        {/* Completed */}
        <div className="bg-background dark:bg-background/60 p-1.5 sm:p-2 rounded-lg border border-surface-border/80 dark:border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-primary dark:text-primary mb-0.5 truncate">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('daily_stats_completed_short')}</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-text-main font-mono">
            {monthStats.completed}
          </span>
        </div>

        {/* Cancelled */}
        <div className="bg-background dark:bg-background/60 p-1.5 sm:p-2 rounded-lg border border-surface-border/80 dark:border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-primary dark:text-primary mb-0.5 truncate">
            <XCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('stat_cancelled')}</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-text-main font-mono">
            {monthStats.cancelled}
          </span>
        </div>

        {/* Remaining */}
        <div className="bg-background dark:bg-background/60 p-1.5 sm:p-2 rounded-lg border border-surface-border/80 dark:border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-primary dark:text-primary mb-0.5 truncate">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('stat_remaining')}</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-text-main font-mono">
            {monthStats.remaining}
          </span>
        </div>

        {/* Revenue Collected */}
        <div className="bg-background dark:bg-background/60 p-1.5 sm:p-2 rounded-lg border border-surface-border/80 dark:border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-primary dark:text-primary mb-0.5 truncate">
            <Wallet className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('daily_stats_revenue')}</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-primary dark:text-primary font-mono">
            {monthStats.collected.toLocaleString()} <span className="text-[9px] text-text-muted font-sans">{currency}</span>
          </span>
        </div>

        {/* Revenue Uncollected */}
        <div className="bg-background dark:bg-background/60 p-1.5 sm:p-2 rounded-lg border border-surface-border/80 dark:border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-primary dark:text-primary mb-0.5 truncate">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('stat_uncollected')}</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-primary dark:text-primary font-mono">
            {monthStats.uncollected.toLocaleString()} <span className="text-[9px] text-text-muted font-sans">{currency}</span>
          </span>
        </div>

        {/* Total Expected Revenue */}
        <div className="bg-background dark:bg-background/60 p-1.5 sm:p-2 rounded-lg border border-surface-border/80 dark:border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-primary dark:text-primary mb-0.5 truncate">
            <DollarSign className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('stat_total_expected')}</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-primary dark:text-primary font-mono">
            {monthStats.totalExpected.toLocaleString()} <span className="text-[9px] text-text-muted font-sans">{currency}</span>
          </span>
        </div>
      </div>

      {/* Financial Goal Section */}
      <div className="mt-2.5 pt-2 border-t border-surface-border/80 dark:border-surface-border">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-text-main">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span>{t('goal_monthly_short')}</span>
          </div>
          <span className="text-[10px] font-bold text-text-muted">
            {t('this_month')}
          </span>
        </div>

        {hasMonthlyGoal ? (
          <div className="space-y-1.5 bg-background dark:bg-background/60 p-2 rounded-lg border border-surface-border/80 dark:border-surface-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted font-bold text-[10px]">{t('goal_collected')}:</span>
              <span className="font-mono font-black text-text-main text-[11px]">
                {monthStats.collected.toLocaleString()} <span className="text-[9px] text-text-muted font-sans">{currency}</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted font-bold text-[10px]">{t('goal_target')}:</span>
              <span className="font-mono font-black text-text-main text-[11px]">
                {monthlyGoal.toLocaleString()} <span className="text-[9px] text-text-muted font-sans">{currency}</span>
              </span>
            </div>

            {/* Progress bar and percentage */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-text-muted">{t('goal_remaining')}: <span className="font-mono text-text-main">{remainingToGoal.toLocaleString()} {currency}</span></span>
                <span className="font-mono text-primary font-black">{monthlyPercent}%</span>
              </div>
              <div className="w-full bg-surface-border dark:bg-surface-border/60 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, monthlyPercent)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-background dark:bg-background/60 py-1.5 px-2.5 rounded-lg border border-surface-border/80 dark:border-surface-border flex items-center justify-between text-xs">
            <span className="text-text-muted text-[10px] font-bold">{t('no_goal_set')}</span>
            <span className="text-[10px] font-mono text-text-muted">—</span>
          </div>
        )}
      </div>
    </div>
  );
};
