import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Landmark, Search, Filter } from 'lucide-react';
import { AddFinanceTransactionModal } from './modals/AddFinanceTransactionModal';

export const FinanceTransactions: React.FC = () => {
  const { _t, financeTransactions, financeAccounts, financeCategories } = useApp();
  const [modalType, setModalType] = useState<'income' | 'expense' | 'transfer' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');

  const getAccountName = (id: string) => {
    return financeAccounts.find(a => a.id === id)?.name || _t('حساب محذوف', 'Deleted Account', 'Gelöschtes Konto');
  };

  const filteredTxs = financeTransactions
    .filter(tx => !tx.deleted)
    .filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterAccountId !== 'all' && tx.accountId !== filterAccountId && tx.toAccountId !== filterAccountId) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const noteMatch = (tx.note || '').toLowerCase().includes(query);
        const accMatch = getAccountName(tx.accountId).toLowerCase().includes(query);
        return noteMatch || accMatch;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-3 pb-8 animate-in fade-in">
      
      {/* Quick Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={() => setModalType('income')} 
          className="bg-surface hover:bg-surface-hover text-emerald-600 dark:text-emerald-400 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all border border-surface-border font-bold text-xs shadow-2xs active:scale-95 cursor-pointer"
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>{_t('تسجيل دخل', 'Income', 'Einkommen')}</span>
        </button>
        <button 
          onClick={() => setModalType('expense')} 
          className="bg-surface hover:bg-surface-hover text-rose-600 dark:text-rose-400 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all border border-surface-border font-bold text-xs shadow-2xs active:scale-95 cursor-pointer"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>{_t('تسجيل مصروف', 'Expense', 'Ausgabe')}</span>
        </button>
        <button 
          onClick={() => setModalType('transfer')} 
          className="bg-surface hover:bg-surface-hover text-blue-600 dark:text-blue-400 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all border border-surface-border font-bold text-xs shadow-2xs active:scale-95 cursor-pointer"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>{_t('تحويل حسابات', 'Transfer', 'Überweisung')}</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-surface-border rounded-xl p-2 sm:p-2.5 flex flex-wrap gap-2 items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={_t('بحث في المعاملات...', 'Search transactions...', 'Transaktionen suchen...')}
            className="w-full bg-transparent text-xs font-semibold text-text-main placeholder:text-text-muted outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main outline-none cursor-pointer"
          >
            <option value="all">{_t('كل الأنواع', 'All Types', 'Alle Typen')}</option>
            <option value="income">{_t('دخل', 'Income', 'Einkommen')}</option>
            <option value="expense">{_t('مصروف', 'Expense', 'Ausgabe')}</option>
            <option value="transfer">{_t('تحويل', 'Transfer', 'Überweisung')}</option>
          </select>
          <select
            value={filterAccountId}
            onChange={e => setFilterAccountId(e.target.value)}
            className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main outline-none max-w-[130px] cursor-pointer"
          >
            <option value="all">{_t('كل الحسابات', 'All Accounts', 'Alle Konten')}</option>
            {financeAccounts.filter(a => !a.deleted).map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-2xs">
        <div className="p-2.5 sm:p-3 border-b border-surface-border flex items-center justify-between">
          <h3 className="font-black text-xs uppercase tracking-wider text-text-main">{_t('سجل المعاملات والتحويلات', 'Transaction History', 'Transaktionsverlauf')}</h3>
          <span className="text-[11px] font-medium text-text-muted">{filteredTxs.length} {_t('عملية', 'records', 'Einträge')}</span>
        </div>
        
        {filteredTxs.length > 0 ? (
          <div className="divide-y divide-surface-border">
            {filteredTxs.map(tx => (
              <div key={tx.id} className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-surface-hover/30 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    tx.type === 'income' || tx.type === 'investment_return' ? 'bg-emerald-500/10 text-emerald-500' : 
                    tx.type === 'expense' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {tx.type === 'income' || tx.type === 'investment_return' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : 
                     tx.type === 'expense' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-text-main text-xs truncate">
                      {tx.note || (
                        tx.type === 'income' ? _t('إيداع / دخل', 'Income', 'Einkommen') :
                        tx.type === 'expense' ? _t('سحب / مصروف', 'Expense', 'Ausgabe') :
                        _t('تحويل حسابات', 'Transfer', 'Überweisung')
                      )}
                    </h4>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {tx.type === 'transfer' 
                        ? `${getAccountName(tx.accountId)} ➔ ${getAccountName(tx.toAccountId!)}`
                        : getAccountName(tx.accountId)}
                      {' • '}
                      {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className={`font-black text-xs sm:text-sm font-sans whitespace-nowrap ${
                    tx.type === 'income' || tx.type === 'investment_return' ? 'text-emerald-500' : 
                    tx.type === 'expense' ? 'text-rose-500' : 'text-blue-500'
                }`}>
                  {tx.type === 'income' || tx.type === 'investment_return' ? '+' : tx.type === 'expense' ? '-' : ''}
                  {tx.amount.toLocaleString()} EGP
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Landmark className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-text-muted text-xs font-bold">
              {_t('لا توجد عمليات مسجلة تطابق البحث.', 'No transactions found.', 'Keine Transaktionen.')}
            </p>
          </div>
        )}
      </div>

      {modalType && (
        <AddFinanceTransactionModal 
          onClose={() => setModalType(null)} 
          type={modalType} 
        />
      )}
    </div>
  );
};
