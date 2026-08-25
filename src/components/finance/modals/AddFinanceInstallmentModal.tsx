import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, CreditCard } from 'lucide-react';
import { FinanceInstallment } from '../../../types';

interface AddFinanceInstallmentModalProps {
  onClose: () => void;
  existingInstallment?: FinanceInstallment;
}

export const AddFinanceInstallmentModal: React.FC<AddFinanceInstallmentModalProps> = ({ onClose, existingInstallment }) => {
  const { _t, addFinanceInstallment, updateFinanceInstallment, financeAccounts } = useApp();
  
  const [name, setName] = useState(existingInstallment?.name || '');
  const [amountPerInstallment, setAmountPerInstallment] = useState(existingInstallment?.amountPerInstallment?.toString() || '');
  const [totalInstallments, setTotalInstallments] = useState(existingInstallment?.totalInstallments?.toString() || '10');
  const [currentInstallment, setCurrentInstallment] = useState(existingInstallment?.currentInstallment?.toString() || '0');
  const [dueDate, setDueDate] = useState(existingInstallment?.dueDate || new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(existingInstallment?.accountId || (financeAccounts[0]?.id || ''));
  const [providerName, setProviderName] = useState(existingInstallment?.providerName || '');

  const handleSave = () => {
    const amount = parseFloat(amountPerInstallment);
    const total = parseInt(totalInstallments, 10);
    const current = parseInt(currentInstallment, 10) || 0;

    if (!name.trim() || !amount || amount <= 0 || !total || total <= 0) return;

    const remainingBalance = Math.max(0, (total - current) * amount);

    if (existingInstallment) {
      updateFinanceInstallment(existingInstallment.id, {
        name: name.trim(),
        amountPerInstallment: amount,
        totalInstallments: total,
        currentInstallment: current,
        remainingBalance,
        dueDate,
        accountId,
        providerName: providerName.trim()
      });
    } else {
      addFinanceInstallment({
        name: name.trim(),
        amountPerInstallment: amount,
        totalInstallments: total,
        currentInstallment: current,
        remainingBalance,
        dueDate,
        accountId,
        providerName: providerName.trim()
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full md:w-full md:max-w-md bg-surface border-t md:border border-surface-border md:rounded-2xl shadow-2xl rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-500" />
            {existingInstallment ? _t('تعديل القسط أو الجمعية', 'Edit Installment', 'Rate bearbeiten') : _t('إضافة قسط أو جمعية', 'Add Installment / Association', 'Rate / Verein hinzufügen')}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">
              {_t('اسم القسط / الجمعية', 'Installment / Association Name', 'Name der Rate')} *
            </label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={_t('مثال: قسط اللاب توب، جمعية المدرسين', 'e.g. Laptop Installment, Teachers Association', 'z.B. Laptop-Rate')}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {_t('قيمة القسط الواحد', 'Amount per Installment', 'Betrag pro Rate')} *
              </label>
              <input 
                type="number" 
                value={amountPerInstallment} 
                onChange={e => setAmountPerInstallment(e.target.value)} 
                placeholder="1000"
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {_t('إجمالي عدد الأقساط', 'Total Installments', 'Gesamtanzahl Raten')} *
              </label>
              <input 
                type="number" 
                value={totalInstallments} 
                onChange={e => setTotalInstallments(e.target.value)} 
                placeholder="10"
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {_t('الأقساط المدفوعة مسبقاً', 'Already Paid Installments', 'Bereits bezahlt')}
              </label>
              <input 
                type="number" 
                value={currentInstallment} 
                onChange={e => setCurrentInstallment(e.target.value)} 
                placeholder="0"
                min="0"
                max={totalInstallments || '100'}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {_t('تاريخ الاستحقاق الأول', 'First Due Date', 'Fälligkeitsdatum')}
              </label>
              <input 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)} 
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {_t('حساب الخصم الافتراضي', 'Default Account', 'Standardkonto')}
              </label>
              <select 
                value={accountId} 
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              >
                <option value="">{_t('اختر حساب...', 'Select Account...', 'Konto wählen...')}</option>
                {financeAccounts.filter(a => !a.deleted).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {_t('الجهة / المستفيد (اختياري)', 'Provider / Recipient', 'Empfänger')}
              </label>
              <input 
                type="text" 
                value={providerName} 
                onChange={e => setProviderName(e.target.value)} 
                placeholder={_t('مثال: البنك / بي تك / زميل', 'e.g. Bank, Store, Colleague', 'z.B. Bank, Kollege')}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
              />
            </div>
          </div>

          <button 
            onClick={handleSave} 
            disabled={!name.trim() || !amountPerInstallment || parseFloat(amountPerInstallment) <= 0 || !totalInstallments || parseInt(totalInstallments, 10) <= 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold disabled:opacity-50 mt-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Save className="w-5 h-5" />
            {_t('حفظ القسط', 'Save Installment', 'Rate speichern')}
          </button>
        </div>
      </div>
    </div>
  );
};
