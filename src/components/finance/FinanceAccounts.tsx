import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Plus, Edit2, Trash2, ArrowRightLeft, CreditCard, Wallet, Landmark, 
  Banknote, TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, 
  Target, ShieldCheck, Activity, Layers, Sparkles, Filter, ChevronRight, X
} from 'lucide-react';
import { FinanceAccount } from '../../types';
import { BankCard } from './BankCard';
import { AddFinanceAccountModal } from './modals/AddFinanceAccountModal';
import { BalanceAdjustmentModal } from './modals/BalanceAdjustmentModal';
import { AddFinanceTransactionModal } from './modals/AddFinanceTransactionModal';
import { calculateAccountPerformance } from '../../services/financeService';

export const FinanceAccounts: React.FC = () => {
  const { _t, financeAccounts, financeTransactions, deleteFinanceAccount } = useApp();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | undefined>();
  const [adjustingAccount, setAdjustingAccount] = useState<FinanceAccount | undefined>();
  const [txModalType, setTxModalType] = useState<'income' | 'expense' | 'transfer' | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const activeAccounts = financeAccounts.filter(a => !a.deleted);

  // Financial calculations
  const totalAssets = activeAccounts.reduce((sum, acc) => {
    if (acc.type === 'credit') return sum; // don't count credit limit as asset
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

  const totalCreditDebt = activeAccounts
    .filter(a => a.type === 'credit')
    .reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  const totalInvestments = activeAccounts
    .filter(a => a.type === 'investment')
    .reduce((sum, acc) => {
      const current = typeof acc.currentBalance === 'number' ? acc.currentBalance : null;
      if (current !== null) return sum + current;
      const init = acc.initialCapital || acc.initialBalance || 0;
      const contrib = acc.totalContributions || 0;
      const ret = acc.accumulatedReturns || 0;
      return sum + (init + contrib + ret);
    }, 0);

  const netBalance = totalAssets - totalCreditDebt;

  // Selected account object
  const selectedAccount = activeAccounts.find(a => a.id === selectedAccountId);

  // Transactions for selected account
  const selectedAccountTxs = selectedAccountId 
    ? financeTransactions
        .filter(tx => !tx.deleted && (tx.accountId === selectedAccountId || tx.toAccountId === selectedAccountId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt))
    : [];

  const getAccountStats = (accountId: string) => {
    const txs = financeTransactions.filter(tx => !tx.deleted && (tx.accountId === accountId || tx.toAccountId === accountId));
    const income = txs.filter(tx => tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === accountId)).reduce((sum, tx) => sum + tx.amount, 0);
    const expense = txs.filter(tx => tx.type === 'expense' || (tx.type === 'transfer' && tx.accountId === accountId)).reduce((sum, tx) => sum + tx.amount, 0);
    return { income, expense, count: txs.length };
  };

  return (
    <div className="space-y-3.5 animate-in fade-in pb-12">
      
      {/* 1. TOP FINANCIAL SUMMARY HEADER */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              {_t('إجمالي الأصول وصافي الثروة', 'Total Net Worth & Assets', 'Gesamtvermögen')}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-text-main font-sans tracking-tight">
                {netBalance.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-text-muted">
                {activeAccounts[0]?.currency || 'EGP'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-text-muted">
              <span>{activeAccounts.length} {_t('حسابات', 'accounts', 'Konten')}</span>
              {totalInvestments > 0 && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {_t('استثمارات', 'Investments', 'Investitionen')}: {totalInvestments.toLocaleString()}
                  </span>
                </>
              )}
              {totalCreditDebt > 0 && (
                <>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    {_t('ديون ائتمان', 'Credit Debt', 'Kreditschulden')}: {totalCreditDebt.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setTxModalType('transfer')}
              className="px-2.5 py-1.5 bg-surface-hover hover:bg-surface-border text-text-main rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-surface-border cursor-pointer active:scale-95"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
              <span>{_t('تحويل', 'Transfer', 'Überweisung')}</span>
            </button>
            <button
              onClick={() => {
                setEditingAccount(undefined);
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{_t('إضافة كارت', 'Add Account', 'Konto hinzufügen')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. CARDS SECTION */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
              {_t('البطاقات والحسابات', 'Digital Cards & Accounts', 'Digitale Karten')}
            </h3>
          </div>
          <span className="text-[10px] text-text-muted font-medium">
            {_t('اضغط للتفاصيل', 'Click for details', 'Klicken für Details')}
          </span>
        </div>

        {activeAccounts.length === 0 ? (
          <div className="bg-surface border border-surface-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 bg-surface-hover text-text-muted rounded-xl flex items-center justify-center mb-2">
              <Landmark className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-text-main mb-1">
              {_t('لا توجد حسابات مسجلة', 'No Accounts Registered Yet', 'Noch keine Konten registriert')}
            </h4>
            <p className="text-[11px] text-text-muted max-w-xs mb-3">
              {_t('أضف حسابك البنكي أو المحفظة الإلكترونية لتبدأ.', 'Add your bank account or wallet to start.', 'Fügen Sie Ihr Konto hinzu.')}
            </p>
            <button
              onClick={() => {
                setEditingAccount(undefined);
                setIsAddModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-primary-hover transition"
            >
              <Plus className="w-3.5 h-3.5" />
              {_t('إضافة أول حساب', 'Add First Account', 'Erstes Konto hinzufügen')}
            </button>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 pt-2 hide-scrollbar w-full scroll-smooth">
            <div className="w-[2vw] sm:hidden shrink-0" />
            {activeAccounts.map(account => {
              const isSelected = selectedAccountId === account.id;
              return (
                <div key={account.id} className="snap-center shrink-0 w-[85vw] sm:w-[340px]">
                  <BankCard
                    account={account}
                    isSelected={isSelected}
                    onClick={() => setSelectedAccountId(isSelected ? null : account.id)}
                    actionButtonLabel={_t('التفاصيل', 'Details', 'Details')}
                    onActionButtonClick={() => setSelectedAccountId(isSelected ? null : account.id)}
                  />
                </div>
              );
            })}
            <div className="w-[2vw] sm:hidden shrink-0" />
          </div>
        )}
      </div>

      {/* 3. SELECTED ACCOUNT DETAILS PANEL */}
      {selectedAccount && (
        <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-surface-hover text-primary flex items-center justify-center font-bold shrink-0 border border-surface-border">
                {selectedAccount.type === 'bank' ? <Landmark className="w-4 h-4" /> :
                 selectedAccount.type === 'wallet' ? <Wallet className="w-4 h-4" /> :
                 selectedAccount.type === 'credit' ? <CreditCard className="w-4 h-4" /> :
                 selectedAccount.type === 'investment' ? <TrendingUp className="w-4 h-4" /> :
                 <Banknote className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-bold text-text-main">{selectedAccount.name}</h4>
                  {selectedAccount.bankName && (
                    <span className="text-[10px] text-text-muted font-medium">
                      • {selectedAccount.bankName}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {_t('الرصيد:', 'Balance:', 'Saldo:')}{' '}
                  <span className="font-black text-text-main">
                    {selectedAccount.currentBalance.toLocaleString()} {selectedAccount.currency}
                  </span>
                  {selectedAccount.accountNumber && ` • •••• ${selectedAccount.accountNumber.slice(-4)}`}
                </p>
              </div>
            </div>

            {/* Account Quick Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setAdjustingAccount(selectedAccount)}
                className="px-2.5 py-1 bg-surface-hover hover:bg-surface-border text-text-main rounded-lg text-xs font-bold transition flex items-center gap-1 border border-surface-border cursor-pointer"
              >
                <Target className="w-3 h-3 text-primary" />
                <span>{_t('تسوية', 'Adjust', 'Anpassen')}</span>
              </button>
              <button
                onClick={() => {
                  setEditingAccount(selectedAccount);
                  setIsAddModalOpen(true);
                }}
                className="px-2.5 py-1 bg-surface-hover hover:bg-surface-border text-text-main rounded-lg text-xs font-bold transition flex items-center gap-1 border border-surface-border cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-blue-500" />
                <span>{_t('تعديل', 'Edit', 'Bearbeiten')}</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(_t('هل أنت متأكد من حذف هذا الحساب؟', 'Are you sure you want to delete this account?', 'Möchten Sie dieses Konto löschen?'))) {
                    deleteFinanceAccount(selectedAccount.id);
                    setSelectedAccountId(null);
                  }
                }}
                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                title={_t('حذف', 'Delete', 'Löschen')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedAccountId(null)}
                className="p-1.5 hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg transition cursor-pointer"
                title={_t('إغلاق', 'Close', 'Schließen')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Investment Stats if investment */}
          {selectedAccount.type === 'investment' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 border-b border-surface-border text-center">
              <div>
                <span className="block text-[10px] text-text-muted uppercase">{_t('رأس المال', 'Capital', 'Kapital')}</span>
                <span className="font-black text-xs text-text-main">
                  {(
                    selectedAccount.currentBalance !== undefined && selectedAccount.accumulatedReturns !== undefined
                      ? Math.max(0, Math.round((selectedAccount.currentBalance - (selectedAccount.totalContributions || 0) - (selectedAccount.accumulatedReturns || 0)) * 100) / 100)
                      : (selectedAccount.initialCapital || selectedAccount.initialBalance || 0)
                  ).toLocaleString()} {selectedAccount.currency}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-text-muted uppercase">{_t('المساهمات', 'Contributions', 'Beiträge')}</span>
                <span className="font-black text-xs text-text-main">
                  {(selectedAccount.totalContributions || 0).toLocaleString()} {selectedAccount.currency}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-text-muted uppercase">{_t('الأرباح', 'Returns', 'Gewinne')}</span>
                <span className="font-black text-xs text-emerald-500">
                  +{(selectedAccount.accumulatedReturns || 0).toLocaleString()} {selectedAccount.currency}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-text-muted uppercase">{_t('العائد السنوي', 'Annual Return', 'Rendite')}</span>
                <span className="font-black text-xs text-emerald-500">
                  {selectedAccount.annualInterestRate || 0}% / YR
                </span>
              </div>
            </div>
          )}

          {/* Account Recent Transactions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-black text-text-main uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-primary" />
                {_t('سجل معاملات هذا الحساب', 'Transactions on this Account', 'Transaktionen')} ({selectedAccountTxs.length})
              </h5>
            </div>

            <div className="divide-y divide-surface-border/60">
              {selectedAccountTxs.slice(0, 8).map(tx => {
                const isIncome = tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === selectedAccount.id) || tx.type === 'investment_return';
                return (
                  <div key={tx.id} className="py-2 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-text-main truncate">
                          {tx.note || (isIncome ? _t('إيداع', 'Deposit', 'Einzahlung') : _t('سحب / مصروف', 'Withdrawal', 'Ausgabe'))}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {new Date(tx.date).toLocaleDateString()}
                          {tx.type === 'transfer' && ` • ${_t('تحويل', 'Transfer', 'Überweisung')}`}
                        </p>
                      </div>
                    </div>
                    <div className={`font-black text-xs whitespace-nowrap ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isIncome ? '+' : '-'}{tx.amount.toLocaleString()} {selectedAccount.currency}
                    </div>
                  </div>
                );
              })}
              {selectedAccountTxs.length === 0 && (
                <div className="text-center py-4 text-text-muted text-xs font-medium">
                  {_t('لا توجد معاملات مسجلة على هذا الحساب بعد.', 'No transactions recorded on this account yet.', 'Keine Transaktionen.')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isAddModalOpen && (
        <AddFinanceAccountModal 
          onClose={() => {
            setIsAddModalOpen(false);
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
    </div>
  );
};
