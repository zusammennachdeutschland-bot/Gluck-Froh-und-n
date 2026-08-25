import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, Wallet } from 'lucide-react';
import { FinanceAccount } from '../../../types';

interface AddFinanceAccountModalProps {
  onClose: () => void;
  existingAccount?: FinanceAccount;
}

export const AddFinanceAccountModal: React.FC<AddFinanceAccountModalProps> = ({ onClose, existingAccount }) => {
  const { _t, addFinanceAccount, updateFinanceAccount } = useApp();
  
  const [name, setName] = useState(existingAccount?.name || '');
  const [type, setType] = useState<FinanceAccount['type']>(existingAccount?.type || 'cash');
  const [openingBalance, setOpeningBalance] = useState(existingAccount?.openingBalance?.toString() || '0');
  const [currency, setCurrency] = useState(existingAccount?.currency || 'EGP');

  const handleSave = () => {
    if (!name.trim()) return;

    const balanceNum = parseFloat(openingBalance) || 0;

    if (existingAccount) {
      updateFinanceAccount(existingAccount.id, {
        name: name.trim(),
        type,
        currency
        // Do not update opening balance normally unless we want to, but let's allow it for simplicity
        // Note: Changing opening balance should theoretically recalculate currentBalance, but we skip it for brevity unless strictly needed.
      });
    } else {
      addFinanceAccount({
        name: name.trim(),
        type,
        openingBalance: balanceNum,
        currentBalance: balanceNum,
        currency
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-black/60 backdrop-blur-xs">
      <div className="w-full md:w-full md:max-w-md bg-surface border-t md:border border-surface-border md:rounded-2xl shadow-2xl rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {existingAccount ? _t('تعديل الحساب', 'Edit Account', 'Konto bearbeiten') : _t('إضافة حساب', 'Add Account', 'Konto hinzufügen')}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('اسم الحساب', 'Account Name', 'Kontoname')}</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={_t('مثال: البنك الأهلي، كاش، المحفظة', 'e.g. CIB, Cash, Wallet', 'z.B. CIB, Bargeld, Wallet')}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('النوع', 'Type', 'Typ')}</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              >
                <option value="cash">{_t('كاش', 'Cash', 'Bargeld')}</option>
                <option value="bank">{_t('بنك', 'Bank', 'Bank')}</option>
                <option value="wallet">{_t('محفظة إلكترونية', 'E-Wallet', 'E-Wallet')}</option>
                <option value="other">{_t('أخرى', 'Other', 'Andere')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('العملة', 'Currency', 'Währung')}</label>
              <select 
                value={currency} 
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              >
                <option value="EGP">EGP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {!existingAccount && (
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('الرصيد الافتتاحي', 'Opening Balance', 'Anfangssaldo')}</label>
              <input 
                type="number" 
                value={openingBalance} 
                onChange={e => setOpeningBalance(e.target.value)} 
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              />
            </div>
          )}

          <button 
            onClick={handleSave} 
            disabled={!name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50 mt-2"
          >
            <Save className="w-5 h-5" />
            {_t('حفظ الحساب', 'Save Account', 'Konto speichern')}
          </button>
        </div>
      </div>
    </div>
  );
};
