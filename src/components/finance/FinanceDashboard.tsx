import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Flame, Edit3, Plus, Trash2, Edit2, Target, MoreVertical, Search, ArrowRightLeft, TrendingUp, TrendingDown, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { AddFinanceAccountModal } from './modals/AddFinanceAccountModal';
import { AddFinanceTransactionModal } from './modals/AddFinanceTransactionModal';
import { FinanceAccount } from '../../types';

export const FinanceDashboard: React.FC = () => {
  const { _t, profile, updateProfile, financeAccounts, financeTransactions, deleteFinanceAccount } = useApp();
  
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(profile.monthlyIncomeGoal?.toString() || '30000');
  
  // Quick actions
  const [txModalType, setTxModalType] = useState<'income' | 'expense' | 'transfer' | null>(null);

  // Accounts Management
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | undefined>();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [viewingTxsAccountId, setViewingTxsAccountId] = useState<string | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const thisMonthTransactions = financeTransactions.filter(tx => {
    if (tx.deleted) return false;
    if (!tx.date) return false;
    if (tx.date.startsWith(currentMonthPrefix)) return true;
    const txDate = new Date(tx.date);
    return !isNaN(txDate.getTime()) && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
  });

  const incomeThisMonth = thisMonthTransactions.filter(tx => tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0);
  const expensesThisMonth = thisMonthTransactions.filter(tx => tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0);
  const netThisMonth = incomeThisMonth - expensesThisMonth;

  const currentGoal = profile.monthlyIncomeGoal || 30000;
  const progressPercent = Math.min(100, Math.round((incomeThisMonth / currentGoal) * 100)) || 0;
  
  const handleSaveGoal = () => {
    const val = parseFloat(goalInput);
    if (!isNaN(val) && val > 0) {
      updateProfile({ monthlyIncomeGoal: val });
    }
    setIsEditingGoal(false);
  };

  const accountTxs = financeTransactions.filter(tx => !tx.deleted && (tx.accountId === viewingTxsAccountId || tx.toAccountId === viewingTxsAccountId));
  const recentTxs = financeTransactions.filter(tx => !tx.deleted).slice(0, 5);

  if (viewingTxsAccountId) {
    const account = financeAccounts.find(a => a.id === viewingTxsAccountId);
    return (
      <div className="space-y-4 animate-in fade-in pb-20">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-text-main">{_t('معاملات الحساب', 'Account Transactions', 'Kontotransaktionen')} - {account?.name}</h3>
          <button onClick={() => setViewingTxsAccountId(null)} className="px-3 py-1.5 bg-surface-hover rounded-xl text-xs font-bold">
            {_t('رجوع', 'Back', 'Zurück')}
          </button>
        </div>
        <div className="bg-surface border border-surface-border rounded-xl divide-y divide-surface-border">
          {accountTxs.length > 0 ? accountTxs.map(tx => (
            <div key={tx.id} className="p-3.5 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-text-main">{tx.note || tx.type}</p>
                <p className="text-xs text-text-muted">{new Date(tx.date).toLocaleDateString()}</p>
              </div>
              <span className={`text-sm font-black ${tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === viewingTxsAccountId) ? 'text-emerald-500' : 'text-rose-500'}`}>
                {tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === viewingTxsAccountId) ? '+' : '-'}{tx.amount.toLocaleString()} EGP
              </span>
            </div>
          )) : (
            <div className="p-6 text-center text-xs text-text-muted">{_t('لا يوجد', 'No transactions', 'Keine Transaktionen')}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      
      {/* Monthly Goal & Streak */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-text-main">{_t('الهدف الشهري', 'Monthly Goal', 'Monatsziel')}</h3>
          </div>
          {profile.financeStreak && profile.financeStreak > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🔥</span>
              <span className="text-[11px] font-extrabold text-amber-500 uppercase tracking-wider">{profile.financeStreak} {_t('يوم متتالي', 'day streak', 'Tage in Folge')}</span>
            </div>
          ) : null}
        </div>
        
        {isEditingGoal ? (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button onClick={handleSaveGoal} className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer">
              {_t('حفظ', 'Save', 'Speichern')}
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 mb-3 cursor-pointer group" onClick={() => setIsEditingGoal(true)}>
            <div className="text-xl font-black text-text-main">
              {incomeThisMonth.toLocaleString()} <span className="text-sm text-text-muted font-medium">/ {currentGoal.toLocaleString()} EGP</span>
            </div>
            <div className="text-sm font-bold text-primary mb-0.5 group-hover:underline flex items-center gap-1">
              — {progressPercent}%
              <Edit3 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        <div className="h-2.5 w-full bg-surface-hover rounded-full overflow-hidden flex">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${progressPercent >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressPercent >= 100 && (
          <p className="text-xs font-bold text-emerald-500 mt-2 text-center animate-pulse">
            🎉 {_t('لقد حققت الهدف الشهري!', 'Goal reached!', 'Ziel erreicht!')} 🎉
          </p>
        )}
      </div>

      {/* Money Summary (Rows instead of cards) */}
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xs divide-y divide-surface-border">
        <div className="flex items-center justify-between p-3.5">
          <span className="text-sm font-bold text-text-muted flex items-center gap-1.5"><ArrowDownLeft className="w-4 h-4 text-emerald-500" /> {_t('الدخل', 'Income', 'Einkommen')}</span>
          <span className="text-sm font-black text-emerald-500">+{incomeThisMonth.toLocaleString()} EGP</span>
        </div>
        <div className="flex items-center justify-between p-3.5">
          <span className="text-sm font-bold text-text-muted flex items-center gap-1.5"><ArrowUpRight className="w-4 h-4 text-rose-500" /> {_t('المصروفات', 'Expenses', 'Ausgaben')}</span>
          <span className="text-sm font-black text-rose-500">-{expensesThisMonth.toLocaleString()} EGP</span>
        </div>
        <div className="flex items-center justify-between p-3.5 bg-surface-hover/30">
          <span className="text-sm font-bold text-text-main">{_t('الصافي', 'Net', 'Netto')}</span>
          <span className={`text-sm font-black ${netThisMonth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netThisMonth > 0 ? '+' : ''}{netThisMonth.toLocaleString()} EGP
          </span>
        </div>
      </div>

      {/* Accounts List (Compact Rows) */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-bold text-text-main">{_t('الحسابات', 'Accounts', 'Konten')}</h3>
          <button 
            onClick={() => { setEditingAccount(undefined); setIsAddAccountModalOpen(true); }}
            className="flex items-center gap-1 text-primary text-xs font-bold hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> {_t('إضافة', 'Add', 'Hinzufügen')}
          </button>
        </div>
        
        <div className="bg-surface border border-surface-border rounded-xl shadow-2xs divide-y divide-surface-border">
          {financeAccounts.filter(a => !a.deleted).map(account => (
            <div key={account.id} className="flex items-center justify-between p-3.5 group relative">
              <div className="flex items-center gap-3">
                <span className="text-lg">{account.type === 'cash' ? '💵' : account.type === 'bank' ? '🏦' : '📱'}</span>
                <span className="text-sm font-bold text-text-main">{account.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-text-main">{account.currentBalance.toLocaleString()} EGP</span>
                <div className="relative">
                  <button 
                    onClick={() => setMenuOpen(menuOpen === account.id ? null : account.id)}
                    className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === account.id && (
                    <div className="absolute top-full right-0 md:left-0 md:right-auto mt-1 w-40 bg-surface border border-surface-border rounded-xl shadow-lg z-10 py-1">
                      <button 
                        onClick={() => { setViewingTxsAccountId(account.id); setMenuOpen(null); }}
                        className="w-full text-start px-3 py-2 text-sm text-text-main hover:bg-surface-hover flex items-center gap-2 cursor-pointer"
                      >
                        <Search className="w-4 h-4" />
                        {_t('العمليات', 'Transactions', 'Transaktionen')}
                      </button>
                      <button 
                        onClick={() => { setEditingAccount(account); setIsAddAccountModalOpen(true); setMenuOpen(null); }}
                        className="w-full text-start px-3 py-2 text-sm text-text-main hover:bg-surface-hover flex items-center gap-2 cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                        {_t('تعديل', 'Edit', 'Bearbeiten')}
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(_t('حذف هذا الحساب؟', 'Delete this account?', 'Konto löschen?'))) {
                            deleteFinanceAccount(account.id);
                          }
                          setMenuOpen(null);
                        }}
                        className="w-full text-start px-3 py-2 text-sm text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        {_t('حذف', 'Delete', 'Löschen')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {financeAccounts.filter(a => !a.deleted).length === 0 && (
            <div className="p-4 text-center text-xs text-text-muted">
              {_t('لا توجد حسابات بعد.', 'No accounts yet.', 'Noch keine Konten.')}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={() => setTxModalType('income')}
          className="flex flex-col items-center justify-center p-3 bg-surface border border-surface-border rounded-xl shadow-2xs hover:bg-surface-hover transition-colors cursor-pointer text-emerald-500 gap-1.5"
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[11px] font-bold text-text-main">{_t('دخل', 'Income', 'Einkommen')}</span>
        </button>
        <button 
          onClick={() => setTxModalType('expense')}
          className="flex flex-col items-center justify-center p-3 bg-surface border border-surface-border rounded-xl shadow-2xs hover:bg-surface-hover transition-colors cursor-pointer text-rose-500 gap-1.5"
        >
          <TrendingDown className="w-5 h-5" />
          <span className="text-[11px] font-bold text-text-main">{_t('مصروف', 'Expense', 'Ausgabe')}</span>
        </button>
        <button 
          onClick={() => setTxModalType('transfer')}
          className="flex flex-col items-center justify-center p-3 bg-surface border border-surface-border rounded-xl shadow-2xs hover:bg-surface-hover transition-colors cursor-pointer text-blue-500 gap-1.5"
        >
          <ArrowRightLeft className="w-5 h-5" />
          <span className="text-[11px] font-bold text-text-main">{_t('تحويل', 'Transfer', 'Transfer')}</span>
        </button>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-bold text-text-main mb-2 px-1">{_t('النشاط الأخير', 'Recent Activity', 'Letzte Aktivität')}</h3>
        <div className="bg-surface border border-surface-border rounded-xl shadow-2xs divide-y divide-surface-border">
          {recentTxs.length > 0 ? recentTxs.map(tx => {
            const acc = financeAccounts.find(a => a.id === tx.accountId);
            const isIncome = tx.type === 'income';
            const isExpense = tx.type === 'expense';
            return (
              <div key={tx.id} className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : isExpense ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : isExpense ? <ArrowUpRight className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-main">{tx.note || _t('معاملة', 'Transaction', 'Transaktion')}</p>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                      <span>{acc?.name || '?'}</span>
                      <span>•</span>
                      <span>{new Date(tx.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <span className={`text-sm font-black ${isIncome ? 'text-emerald-500' : isExpense ? 'text-rose-500' : 'text-blue-500'}`}>
                  {isIncome ? '+' : isExpense ? '-' : ''}{tx.amount.toLocaleString()} EGP
                </span>
              </div>
            );
          }) : (
            <div className="p-4 text-center flex flex-col items-center justify-center text-text-muted">
              <Clock className="w-5 h-5 mb-1.5 opacity-50" />
              <p className="text-xs">{_t('لا توجد نشاطات', 'No recent activity', 'Keine Aktivität')}</p>
            </div>
          )}
        </div>
      </div>

      {isAddAccountModalOpen && (
        <AddFinanceAccountModal 
          onClose={() => { setIsAddAccountModalOpen(false); setEditingAccount(undefined); }} 
          existingAccount={editingAccount} 
        />
      )}

      {txModalType && (
        <AddFinanceTransactionModal 
          type={txModalType} 
          onClose={() => setTxModalType(null)} 
        />
      )}
    </div>
  );
};
