import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, CreditCard, Bell } from 'lucide-react';
import { FinanceInstallment } from '../../../types';

interface AddFinanceInstallmentModalProps {
  onClose: () => void;
  existingInstallment?: FinanceInstallment;
}

export const AddFinanceInstallmentModal: React.FC<AddFinanceInstallmentModalProps> = ({ onClose, existingInstallment }) => {
  const { _t, addFinanceInstallment, updateFinanceInstallment, financeCategories, financeAccounts } = useApp();

  const [name, setName] = useState(existingInstallment?.name || '');
  const [categoryId, setCategoryId] = useState(existingInstallment?.categoryId || (financeCategories.find(c => c.type === 'expense' && !c.deleted)?.id || ''));
  const [accountId, setAccountId] = useState(existingInstallment?.accountId || (financeAccounts.find(a => !a.deleted)?.id || ''));
  
  const [originalAmount, setOriginalAmount] = useState(existingInstallment?.originalAmount?.toString() || '');
  const [downPayment, setDownPayment] = useState(existingInstallment?.downPayment?.toString() || '0');
  const [totalInstallments, setTotalInstallments] = useState(existingInstallment?.totalInstallments?.toString() || '12');
  const [installmentAmount, setInstallmentAmount] = useState(existingInstallment?.installmentAmount?.toString() || '');
  
  const [frequency, setFrequency] = useState(existingInstallment?.frequency || 'monthly');
  const [firstDueDate, setFirstDueDate] = useState(existingInstallment?.firstDueDate || new Date().toISOString().split('T')[0]);
  
  const [notes, setNotes] = useState(existingInstallment?.notes || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(existingInstallment?.notificationsEnabled !== false);

  // Auto-calculate installment amount if left empty
  useEffect(() => {
    if (originalAmount && totalInstallments && !existingInstallment) {
      const orig = parseFloat(originalAmount) || 0;
      const down = parseFloat(downPayment) || 0;
      const count = parseInt(totalInstallments) || 1;
      const remaining = Math.max(0, orig - down);
      
      const calcAmount = remaining / count;
      setInstallmentAmount(calcAmount.toFixed(2));
    }
  }, [originalAmount, downPayment, totalInstallments, existingInstallment]);

  const handleSave = () => {
    if (!name.trim() || !originalAmount || !totalInstallments || !installmentAmount || !categoryId || !accountId) return;

    const orig = parseFloat(originalAmount);
    const down = parseFloat(downPayment) || 0;
    const count = parseInt(totalInstallments);
    const instAmt = parseFloat(installmentAmount);

    if (existingInstallment) {
      updateFinanceInstallment(existingInstallment.id, {
        name,
        categoryId,
        accountId,
        originalAmount: orig,
        downPayment: down,
        installmentAmount: instAmt,
        totalInstallments: count,
        frequency,
        firstDueDate,
        notes,
        notificationsEnabled
      });
    } else {
      const remaining = Math.max(0, orig - down);
      addFinanceInstallment({
        name,
        categoryId,
        accountId,
        originalAmount: orig,
        downPayment: down,
        installmentAmount: instAmt,
        totalInstallments: count,
        paidInstallments: 0,
        remainingAmount: remaining,
        frequency,
        firstDueDate,
        nextDueDate: firstDueDate,
        status: 'active',
        notificationsEnabled,
        notes
      });
    }
    onClose();
  };

  const filteredCategories = financeCategories.filter(c => !c.deleted && c.type === 'expense');
  const activeAccounts = financeAccounts.filter(a => !a.deleted);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {existingInstallment ? _t('تعديل قسط', 'Edit Installment', 'Rate bearbeiten') : _t('إضافة قسط جديد', 'Add New Installment', 'Neue Rate')}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('اسم أو وصف القسط', 'Name / Description', 'Name')} *</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={_t('مثال: آيفون، سيارة', 'e.g. Phone, Car', 'z.B. Telefon, Auto')}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('التصنيف', 'Category', 'Kategorie')} *</label>
              <select 
                value={categoryId} 
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="" disabled>{_t('اختر تصنيف', 'Select Category', 'Kategorie wählen')}</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('حساب الدفع', 'Account', 'Konto')} *</label>
              <select 
                value={accountId} 
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="" disabled>{_t('اختر حساب', 'Select Account', 'Konto wählen')}</option>
                {activeAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-surface-hover p-3 rounded-xl border border-surface-border">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('المبلغ الأصلي الإجمالي', 'Total Original Amount', 'Gesamtbetrag')} *</label>
              <input 
                type="number" 
                value={originalAmount} 
                onChange={e => setOriginalAmount(e.target.value)} 
                placeholder="24000"
                className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('المقدم (إن وجد)', 'Down Payment (Optional)', 'Anzahlung')}</label>
              <input 
                type="number" 
                value={downPayment} 
                onChange={e => setDownPayment(e.target.value)} 
                placeholder="4000"
                className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('عدد الأقساط', 'No. of Installments', 'Anzahl der Raten')} *</label>
              <input 
                type="number" 
                value={totalInstallments} 
                onChange={e => setTotalInstallments(e.target.value)} 
                placeholder="12"
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('قيمة القسط', 'Installment Amount', 'Ratenbetrag')} *</label>
              <input 
                type="number" 
                value={installmentAmount} 
                onChange={e => setInstallmentAmount(e.target.value)} 
                placeholder="0.00"
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none font-bold text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('دورية الدفع', 'Frequency', 'Häufigkeit')}</label>
              <select 
                value={frequency} 
                onChange={e => setFrequency(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="weekly">{_t('أسبوعياً', 'Weekly', 'Wöchentlich')}</option>
                <option value="monthly">{_t('شهرياً', 'Monthly', 'Monatlich')}</option>
                <option value="yearly">{_t('سنوياً', 'Yearly', 'Jährlich')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('تاريخ أول استحقاق', 'First Due Date', 'Erstes Fälligkeitsdatum')}</label>
              <input 
                type="date" 
                value={firstDueDate} 
                onChange={e => setFirstDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="space-y-2 mt-4 p-4 bg-surface-hover rounded-xl border border-surface-border">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-text-main flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                {_t('تفعيل التنبيهات', 'Enable Notifications', 'Benachrichtigungen aktivieren')}
              </span>
              <input 
                type="checkbox"
                checked={notificationsEnabled}
                onChange={e => setNotificationsEnabled(e.target.checked)}
                className="w-5 h-5 accent-primary"
              />
            </label>
            <p className="text-xs text-text-muted pr-6">
              {_t('سيتم تذكيرك قبل موعد الدفع بـ 5 أيام ويوم واحد وفي نفس اليوم.', 'You will be reminded 5 days, 1 day before, and on the due date.', 'Sie werden vor dem Fälligkeitsdatum erinnert.')}
            </p>
          </div>

        </div>

        <div className="p-4 border-t border-surface-border">
          <button 
            onClick={handleSave}
            disabled={!name.trim() || !originalAmount || !totalInstallments || !installmentAmount || !categoryId || !accountId}
            className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
          >
            <Save className="w-5 h-5" />
            {_t('حفظ القسط', 'Save Installment', 'Rate speichern')}
          </button>
        </div>
      </div>
    </div>
  );
};
