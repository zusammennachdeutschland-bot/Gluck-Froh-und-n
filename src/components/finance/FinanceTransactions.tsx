import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Landmark } from 'lucide-react';
import { AddFinanceTransactionModal } from './modals/AddFinanceTransactionModal';

export const FinanceTransactions: React.FC = () => {
  const { _t, financeTransactions, financeAccounts } = useApp();
  const [modalType, setModalType] = useState<'income' | 'expense' | 'transfer' | null>(null);

  const getAccountName = (id: string) => {
    return financeAccounts.find(a => a.id === id)?.name || _t('حساب محذوف', 'Deleted Account', 'Gelöschtes Konto');
  };

  const sortedTxs = [...financeTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setModalType('income')} className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors">
          <ArrowDownLeft className="w-5 h-5" />
          <span className="text-xs font-bold">{_t('دخل', 'Income', 'Einkommen')}</span>
        </button>
        <button onClick={() => setModalType('expense')} className="bg-red-500/10 text-red-600 hover:bg-red-500/20 py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors">
          <ArrowUpRight className="w-5 h-5" />
          <span className="text-xs font-bold">{_t('مصروف', 'Expense', 'Ausgabe')}</span>
        </button>
        <button onClick={() => setModalType('transfer')} className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors">
          <ArrowLeftRight className="w-5 h-5" />
          <span className="text-xs font-bold">{_t('تحويل', 'Transfer', 'Überweisung')}</span>
        </button>
      </div>

      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-surface-border">
          <h3 className="font-bold text-text-main">{_t('سجل العمليات', 'Transaction History', 'Transaktionsverlauf')}</h3>
        </div>
        
        {sortedTxs.length > 0 ? (
          <div className="divide-y divide-surface-border">
            {sortedTxs.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === 'income' ? 'bg-emerald-500/10' : 
                    tx.type === 'expense' ? 'bg-red-500/10' : 'bg-blue-500/10'
                  }`}>
                    {tx.type === 'income' && <ArrowDownLeft className="w-5 h-5 text-emerald-500" />}
                    {tx.type === 'expense' && <ArrowUpRight className="w-5 h-5 text-red-500" />}
                    {tx.type === 'transfer' && <ArrowLeftRight className="w-5 h-5 text-blue-500" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-text-main text-sm">
                      {tx.note || (
                        tx.type === 'income' ? _t('إيداع / دخل', 'Income', 'Einkommen') :
                        tx.type === 'expense' ? _t('سحب / مصروف', 'Expense', 'Ausgabe') :
                        _t('تحويل', 'Transfer', 'Überweisung')
                      )}
                    </h4>
                    <p className="text-xs text-text-muted mt-0.5">
                      {tx.type === 'transfer' 
                        ? `${getAccountName(tx.accountId)} ➔ ${getAccountName(tx.toAccountId!)}`
                        : getAccountName(tx.accountId)}
                      {' • '}
                      {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className={`font-black whitespace-nowrap ${
                    tx.type === 'income' ? 'text-emerald-500' : 
                    tx.type === 'expense' ? 'text-red-500' : 'text-blue-500'
                }`}>
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                  {tx.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Landmark className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-text-muted text-sm font-medium">
              {_t('لا توجد عمليات بعد.', 'No transactions yet.', 'Noch keine Transaktionen.')}
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
