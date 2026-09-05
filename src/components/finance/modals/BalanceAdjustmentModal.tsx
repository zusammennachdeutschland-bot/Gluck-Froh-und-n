import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, Edit2 } from 'lucide-react';
import { FinanceAccount } from '../../../types';
import { computeAccountBalance } from '../../../services/financeService';
import { v4 as uuidv4 } from 'uuid';

interface BalanceAdjustmentModalProps {
  onClose: () => void;
  account: FinanceAccount;
}

export const BalanceAdjustmentModal: React.FC<BalanceAdjustmentModalProps> = ({ onClose, account }) => {
  const { _t, addFinanceTransaction, updateFinanceAccount, financeTransactions } = useApp();
  const currentDerivedBalance = computeAccountBalance(account, financeTransactions);
  
  const [newBalance, setNewBalance] = useState(currentDerivedBalance.toString());

  const handleSave = () => {
    const balanceNum = parseFloat(newBalance);
    if (isNaN(balanceNum)) return;
    
    const difference = Math.round((balanceNum - currentDerivedBalance) * 100) / 100;
    if (difference === 0) {
      onClose();
      return;
    }

    // Create adjustment transaction which updates account balance atomically
    addFinanceTransaction({
      type: 'adjustment',
      amount: difference,
      accountId: account.id,
      date: new Date().toISOString(),
      note: _t('تسوية رصيد', 'Balance Adjustment', 'Kontenabstimmung') + ` (${difference > 0 ? '+' : ''}${difference.toLocaleString()} ${account.currency})`
    });

    // If this is an investment account, keep initialCapital updated as well
    if (account.type === 'investment') {
      const currentCapital = account.initialCapital !== undefined ? account.initialCapital : (account.initialBalance || 0);
      updateFinanceAccount(account.id, {
        initialCapital: Math.max(0, Math.round((currentCapital + difference) * 100) / 100)
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-black/60 backdrop-blur-xs">
      <div className="w-full md:w-full md:max-w-md bg-surface border-t md:border border-surface-border md:rounded-2xl shadow-2xl rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-primary" />
            {_t('تعديل الرصيد', 'Edit Balance', 'Guthaben bearbeiten')} - {account.name}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="p-4 bg-surface-hover rounded-xl text-center border border-surface-border">
            <div className="text-xs font-bold text-text-muted mb-1">{_t('الرصيد الحالي', 'Current Balance', 'Aktuelles Guthaben')}</div>
            <div className="text-xl font-black text-text-main">{currentDerivedBalance.toLocaleString()} {account.currency}</div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('الرصيد الجديد', 'New Balance', 'Neues Guthaben')}</label>
            <input 
              type="number" 
              value={newBalance} 
              onChange={e => setNewBalance(e.target.value)} 
              className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-sm font-bold focus:ring-1 focus:ring-primary outline-hidden"
              autoFocus
            />
          </div>
          
          <button 
            onClick={handleSave} 
            disabled={isNaN(parseFloat(newBalance))}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50 mt-2 cursor-pointer"
          >
            <Save className="w-5 h-5" />
            {_t('حفظ الرصيد', 'Save Balance', 'Guthaben speichern')}
          </button>
        </div>
      </div>
    </div>
  );
};
