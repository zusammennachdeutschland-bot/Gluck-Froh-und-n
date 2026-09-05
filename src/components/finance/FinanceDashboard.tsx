import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Edit3, Plus, Target, Users, ArrowRightLeft, TrendingUp, TrendingDown, 
  ArrowDownLeft, ArrowUpRight, Tag, Landmark, CreditCard, ChevronLeft, 
  CalendarDays, BarChart3
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { AddFinanceAccountModal } from './modals/AddFinanceAccountModal';
import { AddFinanceTransactionModal } from './modals/AddFinanceTransactionModal';
import { BalanceAdjustmentModal } from './modals/BalanceAdjustmentModal';
import { FinanceAccount } from '../../types';
import { FinanceCategoryManagerModal } from './modals/FinanceCategoryManagerModal';
import { calculateTodaysIncome } from '../../services/financeService';
import { calculateDuePaymentCycles } from '../../utils/paymentUtils';
import { BankCard } from './BankCard';

interface FinanceDashboardProps {
  onNavigateTab?: (tab: 'dashboard' | 'accounts' | 'transactions' | 'student-payments' | 'recurring' | 'installments') => void;
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ onNavigateTab }) => {
  const { 
    _t, profile, updateProfile, financeAccounts, financeTransactions, 
    financeRecurring, financeInstallments, financeCategories,
    students, groups, lessons, payments
  } = useApp();
  
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(profile.monthlyIncomeGoal?.toString() || '30000');
  
  // Quick action modals
  const [txModalType, setTxModalType] = useState<'income' | 'expense' | 'transfer' | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  // Accounts Management
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | undefined>();
  const [adjustingAccount, setAdjustingAccount] = useState<FinanceAccount | undefined>();
  const [viewingTxsAccountId, setViewingTxsAccountId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // --------------------------------------------------------------------------
  // 0. STUDENT PAYMENTS DUE CALCULATION (FOR CONDITIONAL SHORTCUT)
  // --------------------------------------------------------------------------
  const dueCycles = useMemo(() => {
    return calculateDuePaymentCycles(students, groups, lessons, payments);
  }, [students, groups, lessons, payments]);

  const pendingPaymentsList = useMemo(() => {
    return payments.filter(p => !p.deleted && (p.status === 'not_paid' || p.status === 'partial'));
  }, [payments]);

  const totalStudentsNeedingPayment = dueCycles.length + pendingPaymentsList.length;
  const totalAmountDueFromStudents = useMemo(() => {
    const cycleTotal = dueCycles.reduce((sum, c) => sum + (c.amountDue || 0), 0);
    const pendingTotal = pendingPaymentsList.reduce((sum, p) => sum + (p.amount - (p.paidAmount || 0)), 0);
    return cycleTotal + pendingTotal;
  }, [dueCycles, pendingPaymentsList]);

  // --------------------------------------------------------------------------
  // FINANCIAL CALCULATIONS (THIS MONTH)
  // --------------------------------------------------------------------------
  const thisMonthTransactions = useMemo(() => {
    return financeTransactions.filter(tx => {
      if (tx.deleted) return false;
      if (!tx.date) return false;
      if (tx.date.startsWith(currentMonthPrefix)) return true;
      const txDate = new Date(tx.date);
      return !isNaN(txDate.getTime()) && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });
  }, [financeTransactions, currentMonthPrefix, currentMonth, currentYear]);

  const incomeThisMonth = useMemo(() => {
    return thisMonthTransactions
      .filter(tx => tx.type === 'income' || tx.type === 'investment_return')
      .reduce((acc, tx) => acc + tx.amount, 0);
  }, [thisMonthTransactions]);

  const expensesThisMonth = useMemo(() => {
    return thisMonthTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((acc, tx) => acc + tx.amount, 0);
  }, [thisMonthTransactions]);

  const netThisMonth = incomeThisMonth - expensesThisMonth;
  const currentGoal = profile.monthlyIncomeGoal || 30000;
  const progressPercent = Math.min(100, Math.round((incomeThisMonth / currentGoal) * 100)) || 0;
  const todaysIncome = calculateTodaysIncome(financeTransactions);

  const activeAccounts = financeAccounts.filter(a => !a.deleted);

  const totalAssets = activeAccounts.reduce((sum, acc) => {
    if (acc.type === 'credit') return sum;
    if (acc.type === 'investment') {
      const current = typeof acc.currentBalance === 'number' ? acc.currentBalance : null;
      if (current !== null) return sum + current;
      const init = acc.initialCapital || acc.initialBalance || 0;
      const contrib = acc.totalContributions || 0;
      const ret = acc.accumulatedReturns || 0;
      return sum + (init + contrib + ret);
    }
    return sum + (acc.currentBalance || 0);
  }, 0);

  const totalDebt = activeAccounts
    .filter(a => a.type === 'credit')
    .reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  const netWorth = totalAssets - totalDebt;

  // Upcoming Obligations (Bills & Installments due within next 7 days)
  const upcomingDues = useMemo(() => {
    let count = 0;
    let amount = 0;
    
    financeInstallments.filter(i => !i.deleted && i.status !== 'completed').forEach(inst => {
      if (inst.nextDueDate) {
        const due = new Date(inst.nextDueDate);
        const today = new Date(); today.setHours(0,0,0,0);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 7) {
          count++;
          amount += (inst.installmentAmount || 0);
        }
      }
    });

    financeRecurring.filter(r => !r.deleted && r.isActive !== false && r.type === 'expense').forEach(rec => {
      if (rec.nextDueDate) {
        const due = new Date(rec.nextDueDate);
        const today = new Date(); today.setHours(0,0,0,0);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 7) {
          count++;
          amount += rec.amount;
        }
      }
    });

    return { count, amount };
  }, [financeInstallments, financeRecurring]);

  // --------------------------------------------------------------------------
  // LAST 6 MONTHS DATA FOR THE BAR CHART
  // --------------------------------------------------------------------------
  const last6MonthsData = useMemo(() => {
    const result = [];
    const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesDe = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
      
      const label = _t(
        `${monthNamesAr[m]}`,
        `${monthNamesEn[m]}`,
        `${monthNamesDe[m]}`
      );

      const monthTxs = financeTransactions.filter(tx => {
        if (tx.deleted) return false;
        if (!tx.date) return false;
        if (tx.date.startsWith(prefix)) return true;
        const txD = new Date(tx.date);
        return !isNaN(txD.getTime()) && txD.getMonth() === m && txD.getFullYear() === y;
      });

      const income = monthTxs
        .filter(tx => tx.type === 'income' || tx.type === 'investment_return')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const expense = monthTxs
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      result.push({
        key: prefix,
        month: label,
        income,
        expense,
        net: income - expense,
      });
    }
    return result;
  }, [financeTransactions, now, _t]);

  const sixMonthTotals = useMemo(() => {
    const totalInc = last6MonthsData.reduce((sum, item) => sum + item.income, 0);
    const totalExp = last6MonthsData.reduce((sum, item) => sum + item.expense, 0);
    return { totalInc, totalExp, net: totalInc - totalExp };
  }, [last6MonthsData]);

  // Top Expense Categories This Month
  const categoryExpenses = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthTransactions.filter(t => t.type === 'expense').forEach(tx => {
      const catId = tx.categoryId || 'uncategorized';
      map[catId] = (map[catId] || 0) + tx.amount;
    });
    return Object.entries(map).map(([catId, amount]) => {
      const cat = financeCategories.find(c => c.id === catId);
      return {
        id: catId,
        name: cat?.name || _t('بدون تصنيف', 'Uncategorized', 'Ohne Kategorie'),
        icon: cat?.icon || '🏷️',
        amount,
        percent: expensesThisMonth > 0 ? Math.round((amount / expensesThisMonth) * 100) : 0
      };
    }).sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [thisMonthTransactions, financeCategories, expensesThisMonth, _t]);

  const handleSaveGoal = () => {
    const val = parseFloat(goalInput);
    if (!isNaN(val) && val > 0) {
      updateProfile({ monthlyIncomeGoal: val });
    }
    setIsEditingGoal(false);
  };

  const accountTxs = financeTransactions.filter(tx => !tx.deleted && (tx.accountId === viewingTxsAccountId || tx.toAccountId === viewingTxsAccountId));
  const recentTxs = financeTransactions.filter(tx => !tx.deleted).slice(0, 5);

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const incomeVal = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
      const expenseVal = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
      const netVal = incomeVal - expenseVal;
      return (
        <div className="bg-surface/95 backdrop-blur-md border border-surface-border p-3 rounded-2xl shadow-xl text-xs space-y-1.5 min-w-[160px] z-50">
          <p className="font-extrabold text-text-main border-b border-surface-border pb-1">{label}</p>
          <div className="flex items-center justify-between text-emerald-500 font-bold gap-3">
            <span>{_t('الدخل', 'Income', 'Einkommen')}:</span>
            <span className="font-sans font-black">+{incomeVal.toLocaleString()} EGP</span>
          </div>
          <div className="flex items-center justify-between text-rose-500 font-bold gap-3">
            <span>{_t('المصروف', 'Expense', 'Ausgaben')}:</span>
            <span className="font-sans font-black">-{expenseVal.toLocaleString()} EGP</span>
          </div>
          <div className={`flex items-center justify-between font-black pt-1.5 border-t border-surface-border gap-3 ${netVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            <span>{_t('الصافي', 'Net', 'Saldo')}:</span>
            <span className="font-sans">{netVal >= 0 ? '+' : ''}{netVal.toLocaleString()} EGP</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (viewingTxsAccountId) {
    const account = financeAccounts.find(a => a.id === viewingTxsAccountId);
    return (
      <div className="space-y-4 animate-in fade-in pb-16">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-text-main text-base">{_t('معاملات الحساب', 'Account Transactions', 'Kontotransaktionen')} - {account?.name}</h3>
          <button 
            onClick={() => setViewingTxsAccountId(null)} 
            className="px-3.5 py-1.5 bg-surface-hover hover:bg-surface-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {_t('رجوع', 'Back', 'Zurück')}
          </button>
        </div>
        <div className="bg-surface border border-surface-border rounded-2xl divide-y divide-surface-border overflow-hidden shadow-2xs">
          {accountTxs.length > 0 ? accountTxs.map(tx => (
            <div key={tx.id} className="p-3.5 flex justify-between items-center hover:bg-surface-hover/50 transition-colors">
              <div>
                <p className="text-sm font-bold text-text-main">{tx.note || tx.type}</p>
                <p className="text-xs text-text-muted">{new Date(tx.date).toLocaleDateString()}</p>
              </div>
              <span className={`text-sm font-black font-sans ${tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === viewingTxsAccountId) ? 'text-emerald-500' : 'text-rose-500'}`}>
                {tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === viewingTxsAccountId) ? '+' : '-'}{tx.amount.toLocaleString()} EGP
              </span>
            </div>
          )) : (
            <div className="p-8 text-center text-xs text-text-muted">{_t('لا توجد معاملات مسجلة', 'No transactions found', 'Keine Transaktionen')}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4.5 animate-in fade-in pb-16">
      
      {/* ------------------------------------------------------------------ */}
      {/* 0. SHORTCUT BANNER: STUDENT PAYMENTS (CONDITIONAL: ONLY IF DUE)   */}
      {/* ------------------------------------------------------------------ */}
      {totalStudentsNeedingPayment > 0 && (
        <div 
          onClick={() => onNavigateTab?.('student-payments')}
          className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-2xs group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <h4 className="font-bold text-xs sm:text-sm text-text-main group-hover:text-amber-600 transition-colors">
                  {_t('مستحقات طلاب بحاجة إلى تحصيل', 'Student Payments Due', 'Fällige Schülerzahlungen')}
                </h4>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                {totalStudentsNeedingPayment} {_t('طلاب لديهم حصص أو دورات مكتملة', 'students awaiting payment', 'ausstehende Zahlungen')}
                {' • '}
                <span className="font-bold text-amber-600 dark:text-amber-400 font-sans">{totalAmountDueFromStudents.toLocaleString()} EGP</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-amber-500 group-hover:text-white transition shadow-2xs">
            <span>{_t('تحصيل', 'Collect', 'Kassieren')}</span>
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. MONTHLY GOAL CARD                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">{_t('الهدف المالي الشهري', 'Monthly Goal', 'Monatsziel')}</h3>
          </div>
          {profile.financeStreak && profile.financeStreak > 0 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              🔥 {profile.financeStreak} {_t('يوم متتالي', 'day streak', 'Tage')}
            </span>
          ) : null}
        </div>
        
        {isEditingGoal ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="number"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button onClick={handleSaveGoal} className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer shadow-2xs">
              {_t('حفظ', 'Save', 'Speichern')}
            </button>
            <button onClick={() => setIsEditingGoal(false)} className="px-2.5 py-1.5 bg-surface-hover text-text-muted text-xs font-bold rounded-lg cursor-pointer">
              {_t('إلغاء', 'Cancel', 'Abbrechen')}
            </button>
          </div>
        ) : (
          <div className="flex items-end justify-between mb-2 cursor-pointer group" onClick={() => setIsEditingGoal(true)}>
            <div>
              <div className="text-lg sm:text-xl font-black text-text-main font-sans tracking-tight">
                {incomeThisMonth.toLocaleString()} <span className="text-xs text-text-muted font-bold">/ {currentGoal.toLocaleString()} EGP</span>
              </div>
              <div className="text-[11px] font-medium text-primary mt-0.5 flex items-center gap-1 group-hover:underline">
                <span>{progressPercent}% {_t('منجز', 'completed', 'erreicht')}</span>
                <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="text-end">
              <div className="text-[10px] text-text-muted">{_t("دخل اليوم", "Today", "Heute")}</div>
              <div className="text-xs sm:text-sm font-black text-emerald-500 font-sans">+{todaysIncome.toLocaleString()} EGP</div>
            </div>
          </div>
        )}

        <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-700 ${progressPercent >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. ACTIVE CARDS                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">{_t('البطاقات والحسابات', 'Cards & Accounts', 'Konten')}</h3>
          </div>
          <button 
            onClick={() => { setEditingAccount(undefined); setIsAddAccountModalOpen(true); }}
            className="flex items-center gap-1 text-primary text-xs font-bold hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> {_t('إضافة بطاقة', 'Add Card', 'Karte')}
          </button>
        </div>

        {activeAccounts.length === 0 ? (
          <div className="p-4 bg-surface border border-surface-border rounded-xl text-center text-xs text-text-muted">
            {_t('لا توجد حسابات بعد. أضف حسابك الأول.', 'No accounts yet. Add your first account.', 'Noch keine Konten.')}
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 pt-2 hide-scrollbar w-full scroll-smooth">
            <div className="w-[2vw] sm:hidden shrink-0" />
            {activeAccounts.map(account => (
              <div key={account.id} className="snap-center shrink-0 w-[85vw] sm:w-[340px]">
                <BankCard
                  account={account}
                  size="sm"
                  actionButtonLabel={_t('العمليات', 'Txs', 'Txs')}
                  onActionButtonClick={() => setViewingTxsAccountId(account.id)}
                />
              </div>
            ))}
            <div className="w-[2vw] sm:hidden shrink-0" />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. QUICK ACTION BUTTONS                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button 
          onClick={() => setTxModalType('income')}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-emerald-600 dark:text-emerald-400 rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 shadow-2xs"
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>{_t('تسجيل دخل', 'Income', 'Einkommen')}</span>
        </button>
        <button 
          onClick={() => setTxModalType('expense')}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-rose-600 dark:text-rose-400 rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 shadow-2xs"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>{_t('تسجيل مصروف', 'Expense', 'Ausgabe')}</span>
        </button>
        <button 
          onClick={() => setTxModalType('transfer')}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-blue-600 dark:text-blue-400 rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 shadow-2xs"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>{_t('تحويل حسابات', 'Transfer', 'Überweisung')}</span>
        </button>
        <button 
          onClick={() => setIsCategoryManagerOpen(true)}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-muted hover:text-text-main rounded-xl transition font-bold text-xs cursor-pointer active:scale-95 shadow-2xs"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>{_t('التصنيفات', 'Categories', 'Kategorien')}</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. TOTAL NET & FINANCIAL REPORTS IN LINES                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-primary" />
            <h3 className="font-black text-xs text-text-main uppercase tracking-wider">
              {_t('التقرير المالي والتدفق النقدي', 'Financial Breakdown & Cash Flow', 'Finanzübersicht')}
            </h3>
          </div>
          <span className="text-[11px] text-text-muted font-medium">
            {now.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="divide-y divide-surface-border">
          
          {/* Line 1: Total Net Worth */}
          <div className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-surface-hover text-primary flex items-center justify-center shrink-0">
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-text-main">
                  {_t('صافي الثروة ورأس المال', 'Total Net Worth & Assets', 'Gesamtes Nettovermögen')}
                </h4>
                <p className="text-[10px] text-text-muted">
                  {activeAccounts.length} {_t('حسابات نشطة', 'active accounts', 'aktive Konten')}
                  {totalDebt > 0 && ` • ${_t('ائتمان', 'Credit', 'Kredit')}: ${totalDebt.toLocaleString()} EGP`}
                </p>
              </div>
            </div>
            <div className="text-end">
              <span className="text-sm sm:text-base font-black text-text-main font-sans">
                {netWorth.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-text-muted ms-1">EGP</span>
            </div>
          </div>

          {/* Line 2: Income This Month */}
          <div className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-text-main">
                  {_t('إجمالي الدخل الشهري', 'Total Monthly Income', 'Gesamteinnahmen')}
                </h4>
                <p className="text-[10px] text-text-muted">
                  {thisMonthTransactions.filter(t => t.type === 'income' || t.type === 'investment_return').length} {_t('عمليات إيداع', 'records', 'Einnahmen')}
                  {todaysIncome > 0 && ` • ${_t('اليوم', 'Today', 'Heute')}: +${todaysIncome.toLocaleString()} EGP`}
                </p>
              </div>
            </div>
            <div className="text-end">
              <span className="text-sm sm:text-base font-black text-emerald-500 font-sans">
                +{incomeThisMonth.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-emerald-500/80 ms-1">EGP</span>
            </div>
          </div>

          {/* Line 3: Expenses This Month */}
          <div className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-text-main">
                  {_t('إجمالي المصروفات الشهرية', 'Total Monthly Expenses', 'Gesamtausgaben')}
                </h4>
                <p className="text-[10px] text-text-muted">
                  {thisMonthTransactions.filter(t => t.type === 'expense').length} {_t('عملية صرف', 'records', 'Ausgaben')}
                </p>
              </div>
            </div>
            <div className="text-end">
              <span className="text-sm sm:text-base font-black text-rose-500 font-sans">
                -{expensesThisMonth.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-rose-500/80 ms-1">EGP</span>
            </div>
          </div>

          {/* Line 4: Net Flow This Month */}
          <div className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                netThisMonth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {netThisMonth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-text-main">
                  {_t('صافي التدفق المالي للشهر', 'Monthly Net Cash Flow', 'Monatssaldo')}
                </h4>
                <p className="text-[10px] text-text-muted">
                  {progressPercent}% {_t('من الهدف', 'of goal', 'vom Ziel')}
                </p>
              </div>
            </div>
            <div className="text-end">
              <span className={`text-sm sm:text-base font-black font-sans ${netThisMonth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netThisMonth > 0 ? '+' : ''}{netThisMonth.toLocaleString()}
              </span>
              <span className={`text-[10px] font-bold ms-1 ${netThisMonth >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>EGP</span>
            </div>
          </div>

          {/* Line 5: Upcoming Dues */}
          {upcomingDues.count > 0 && (
            <div 
              onClick={() => onNavigateTab?.(financeInstallments.length > 0 ? 'installments' : 'recurring')}
              className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-amber-500/5 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-text-main group-hover:text-amber-600 transition-colors">
                    {_t('التزامات وفواتير مستحقة قريباً', 'Upcoming Obligations (7 days)', 'Anstehende Zahlungen')}
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    {upcomingDues.count} {_t('فواتير أو أقساط', 'due items', 'fällige Posten')}
                  </p>
                </div>
              </div>
              <div className="text-end">
                <span className="text-sm sm:text-base font-black text-amber-500 font-sans">
                  {upcomingDues.amount.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-amber-500/80 ms-1">EGP</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. 6-MONTH COMPARISON BAR CHART (RECHARTS)                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <h3 className="font-black text-xs text-text-main uppercase tracking-wider">
              {_t('مقارنة الدخل والمصروفات (6 أشهر)', 'Income vs Expenses (6 Months)', 'Einnahmen vs Ausgaben')}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>{_t('الدخل', 'Income', 'Einkommen')}</span>
            </div>
            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              <span>{_t('المصروفات', 'Expenses', 'Ausgaben')}</span>
            </div>
          </div>
        </div>

        {/* Mini 6-Month Summary Header */}
        <div className="grid grid-cols-3 gap-2 py-1 border-b border-surface-border text-center">
          <div>
            <div className="text-[10px] text-text-muted">{_t('الدخل', 'Income', 'Einnahmen')}</div>
            <div className="text-xs font-black text-emerald-500 font-sans">+{sixMonthTotals.totalInc.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted">{_t('المصروف', 'Expenses', 'Ausgaben')}</div>
            <div className="text-xs font-black text-rose-500 font-sans">-{sixMonthTotals.totalExp.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted">{_t('الصافي', 'Net', 'Saldo')}</div>
            <div className={`text-xs font-black font-sans ${sixMonthTotals.net >= 0 ? 'text-primary' : 'text-rose-500'}`}>
              {sixMonthTotals.net >= 0 ? '+' : ''}{sixMonthTotals.net.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Chart Render */}
        <div className="h-44 sm:h-48 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last6MonthsData} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.5 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val >= 1000 ? `${Math.round(val / 1000)}k` : val}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Bar 
                dataKey="income" 
                name={_t('الدخل', 'Income', 'Einkommen')} 
                fill="#10b981" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={22}
              />
              <Bar 
                dataKey="expense" 
                name={_t('المصروفات', 'Expenses', 'Ausgaben')} 
                fill="#f43f5e" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 6. TOP SPENDING & RECENT TRANSACTIONS                              */}
      {/* ------------------------------------------------------------------ */}
      
      {/* Top Expense Categories Breakdown Line Items */}
      {categoryExpenses.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h4 className="font-black text-xs text-text-main uppercase tracking-wider">
              {_t('أعلى تصنيفات المصروفات', 'Top Categories', 'Hauptausgaben')}
            </h4>
            <button 
              onClick={() => setIsCategoryManagerOpen(true)}
              className="text-primary text-[11px] font-bold hover:underline cursor-pointer"
            >
              {_t('عرض الكل', 'View all', 'Alle')}
            </button>
          </div>
          <div className="space-y-2">
            {categoryExpenses.map(item => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-main font-bold flex items-center gap-1">
                    <span>{item.icon}</span> {item.name}
                  </span>
                  <span className="text-text-muted font-sans text-[11px] font-bold">
                    {item.amount.toLocaleString()} EGP <span className="text-primary">({item.percent}%)</span>
                  </span>
                </div>
                <div className="h-1 w-full bg-surface-hover rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary/70 rounded-full transition-all duration-500" 
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity List Lines */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <h3 className="font-black text-xs text-text-main uppercase tracking-wider">
            {_t('آخر العمليات المالية', 'Recent Transactions', 'Letzte Transaktionen')}
          </h3>
          <button 
            onClick={() => onNavigateTab?.('transactions')}
            className="text-primary text-xs font-bold hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <span>{_t('السجل', 'All', 'Alle')}</span>
            <ChevronLeft className="w-3 h-3 rtl:rotate-0 ltr:rotate-180" />
          </button>
        </div>
        
        {recentTxs.length > 0 ? (
          <div className="divide-y divide-surface-border">
            {recentTxs.map(tx => {
              const acc = financeAccounts.find(a => a.id === tx.accountId);
              const isIncome = tx.type === 'income' || tx.type === 'investment_return';
              const isExpense = tx.type === 'expense';
              return (
                <div key={tx.id} className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isIncome ? 'bg-emerald-500/10 text-emerald-500' : 
                      isExpense ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> : 
                       isExpense ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-text-main truncate">
                        {tx.note || (isIncome ? _t('دخل', 'Income', 'Einkommen') : isExpense ? _t('مصروف', 'Expense', 'Ausgabe') : _t('تحويل', 'Transfer', 'Transfer'))}
                      </h4>
                      <p className="text-[10px] text-text-muted">
                        {acc?.name || _t('حساب', 'Account', 'Konto')} • {new Date(tx.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`font-black text-xs sm:text-sm font-sans whitespace-nowrap ${
                    isIncome ? 'text-emerald-500' : isExpense ? 'text-rose-500' : 'text-blue-500'
                  }`}>
                    {isIncome ? '+' : isExpense ? '-' : ''}{tx.amount.toLocaleString()} EGP
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-text-muted">
            {_t('لا توجد عمليات مسجلة حديثاً.', 'No recent activity.', 'Keine Transaktionen.')}
          </div>
        )}
      </div>

      {/* Modals */}
      {isAddAccountModalOpen && (
        <AddFinanceAccountModal 
          onClose={() => {
            setIsAddAccountModalOpen(false);
            setEditingAccount(undefined);
          }}
          existingAccount={editingAccount}
        />
      )}

      {adjustingAccount && (
        <BalanceAdjustmentModal
          account={adjustingAccount}
          onClose={() => setAdjustingAccount(undefined)}
        />
      )}

      {txModalType && (
        <AddFinanceTransactionModal
          type={txModalType}
          onClose={() => setTxModalType(null)}
        />
      )}

      {isCategoryManagerOpen && (
        <FinanceCategoryManagerModal
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      )}
    </div>
  );
};
