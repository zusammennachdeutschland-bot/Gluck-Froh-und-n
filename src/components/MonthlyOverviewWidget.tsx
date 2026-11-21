import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, CheckCircle2, XCircle, Clock, Wallet, Target } from 'lucide-react';

export const MonthlyOverviewWidget: React.FC = () => {
  const { lessons, students, groups, payments, profile, language, t, _t } = useApp();

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthStats = useMemo(() => {
    const monthLessons = lessons.filter(l => l.date && l.date.startsWith(currentMonthPrefix) && !l.deleted);

    const completed = monthLessons.filter(l => l.status === 'completed').length;
    const cancelled = monthLessons.filter(l => l.status === 'cancelled').length;
    const remaining = monthLessons.filter(l => l.status === 'scheduled' || l.status === 'in_progress').length;

    // Use actual payment records for accurate revenue tracking (matching Payments View)
    const paidOnly = payments.filter(p => p.status === 'paid' && !p.deleted);
    const monthlyPayments = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      return d && d.startsWith(currentMonthPrefix);
    });
    const collected = monthlyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    const pendingOnly = payments.filter(p => p.status !== 'paid' && !p.deleted);
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
      totalExpected,
      monthName: now.toLocaleDateString(language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' })
    };
  }, [lessons, payments, currentMonthPrefix, language]);

  const targetGoal = profile.monthlyIncomeGoal || 0;
  const goalPercent = targetGoal > 0 ? Math.min(100, Math.round((monthStats.collected / targetGoal) * 100)) : 0;

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-md bg-primary-soft text-primary border border-primary-border">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-main truncate">
              {_t('المعاينة الشهرية', 'Monthly Overview', 'Monatsübersicht')}
            </h3>
            <span className="text-[10px] text-text-muted font-bold block">
              {monthStats.monthName}
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
            {monthStats.completed}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-surface-hover border border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-text-muted">
            <XCircle className="w-3 h-3 text-text-muted" />
            <span>{t('status_cancelled')}</span>
          </div>
          <span className="text-sm font-black text-text-main mt-0.5 block">
            {monthStats.cancelled}
          </span>
        </div>

        <div className="p-1.5 rounded-lg bg-surface-hover border border-surface-border">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-text-muted">
            <Clock className="w-3 h-3 text-primary" />
            <span>{t('stat_remaining')}</span>
          </div>
          <span className="text-sm font-black text-text-main mt-0.5 block">
            {monthStats.remaining}
          </span>
        </div>
      </div>

      {/* Monthly Financial Summary */}
      <div className="pt-1.5 border-t border-surface-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-text-muted font-bold text-[11px]">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span>{_t('المحصل / المستهدف:', 'Collected / Target:', 'Eingenommen / Ziel:')}</span>
        </div>
        <div className="flex items-center gap-1 font-mono font-black text-xs">
          <span className="text-primary">{monthStats.collected}</span>
          <span className="text-text-muted/60">/</span>
          <span className="text-text-main">{targetGoal > 0 ? targetGoal : monthStats.totalExpected}</span>
          <span className="text-[10px] font-sans text-text-muted">{profile.currency || 'EGP'}</span>
        </div>
      </div>
    </div>
  );
};
