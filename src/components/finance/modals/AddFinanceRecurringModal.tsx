import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, Repeat, Bell, Wallet } from 'lucide-react';
import { FinanceRecurring } from '../../../types';

interface AddFinanceRecurringModalProps {
  onClose: () => void;
  existingRecurring?: FinanceRecurring;
}

export const AddFinanceRecurringModal: React.FC<AddFinanceRecurringModalProps> = ({ onClose, existingRecurring }) => {
  const { _t, addFinanceRecurring, updateFinanceRecurring, financeCategories, financeAccounts } = useApp();

  const [name, setName] = useState(existingRecurring?.name || '');
  const [type, setType] = useState<FinanceRecurring['type']>(existingRecurring?.type || 'expense');
  const [amount, setAmount] = useState(existingRecurring?.amount?.toString() || '');
  const [categoryId, setCategoryId] = useState(existingRecurring?.categoryId || (financeCategories.find(c => c.type === 'expense' && !c.deleted)?.id || ''));
  const [accountId, setAccountId] = useState(existingRecurring?.accountId || (financeAccounts.find(a => !a.deleted)?.id || ''));
  const [frequency, setFrequency] = useState<FinanceRecurring['frequency']>(existingRecurring?.frequency || 'monthly');
  const [startDate, setStartDate] = useState(existingRecurring?.startDate || new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState(existingRecurring?.nextDueDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(existingRecurring?.endDate || '');
  const [autoGenerateTransaction, setAutoGenerateTransaction] = useState(existingRecurring?.autoGenerateTransaction || false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(existingRecurring?.notificationsEnabled !== false);

  const handleSave = () => {
    if (!name.trim() || !amount || !categoryId || !accountId) return;

    if (existingRecurring) {
      updateFinanceRecurring(existingRecurring.id, {
        name,
        type,
        amount: parseFloat(amount),
        categoryId,
        accountId,
        frequency,
        startDate,
        nextDueDate: nextDueDate || undefined,
        endDate: endDate || undefined,
        autoGenerateTransaction,
        notificationsEnabled
      });
    } else {
      addFinanceRecurring({
        name,
        type,
        amount: parseFloat(amount),
        categoryId,
        accountId,
        frequency,
        startDate,
        nextDueDate: nextDueDate || undefined,
        endDate: endDate || undefined,
        autoGenerateTransaction,
        notificationsEnabled,
        isActive: true
      });
    }
    onClose();
  };

  const filteredCategories = financeCategories.filter(c => !c.deleted && c.type === type);
  const activeAccounts = financeAccounts.filter(a => !a.deleted);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            {existingRecurring ? _t('تعديل معاملة متكررة', 'Edit Recurring Payment', 'Bearbeiten') : _t('إضافة معاملة متكررة', 'Add Recurring Payment', 'Hinzufügen')}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('اسم المعاملة', 'Name', 'Name')} *</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={_t('مثال: إيجار الشقة، فاتورة الإنترنت', 'e.g. Rent, Internet Bill', 'z.B. Miete')}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('النوع', 'Type', 'Typ')}</label>
              <div className="flex bg-surface-hover rounded-xl p-1">
                <button
                  onClick={() => setType('expense')}
                  className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${type === 'expense' ? 'bg-surface shadow-xs text-rose-500' : 'text-text-muted'}`}
                >
                  {_t('مصروف', 'Expense', 'Ausgabe')}
                </button>
                <button
                  onClick={() => setType('income')}
                  className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${type === 'income' ? 'bg-surface shadow-xs text-emerald-500' : 'text-text-muted'}`}
                >
                  {_t('دخل', 'Income', 'Einkommen')}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('المبلغ', 'Amount', 'Betrag')} *</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0.00"
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
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
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('الحساب', 'Account', 'Konto')} *</label>
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

          <div>
            <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('التكرار', 'Frequency', 'Häufigkeit')}</label>
            <select 
              value={frequency} 
              onChange={e => setFrequency(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="daily">{_t('يومياً', 'Daily', 'Täglich')}</option>
              <option value="weekly">{_t('أسبوعياً', 'Weekly', 'Wöchentlich')}</option>
              <option value="monthly">{_t('شهرياً', 'Monthly', 'Monatlich')}</option>
              <option value="yearly">{_t('سنوياً', 'Yearly', 'Jährlich')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('تاريخ البدء', 'Start Date', 'Startdatum')}</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('تاريخ الاستحقاق القادم', 'Next Due Date', 'Nächstes Fälligkeitsdatum')}</label>
              <input 
                type="date" 
                value={nextDueDate} 
                onChange={e => setNextDueDate(e.target.value)}
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
          
          <div className="space-y-2 p-4 bg-surface-hover rounded-xl border border-surface-border">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-text-main flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                {_t('تسجيل تلقائي', 'Auto Generate Transaction', 'Automatisch generieren')}
              </span>
              <input 
                type="checkbox"
                checked={autoGenerateTransaction}
                onChange={e => setAutoGenerateTransaction(e.target.checked)}
                className="w-5 h-5 accent-primary"
              />
            </label>
             <p className="text-xs text-text-muted pr-6">
              {_t('تسجيل الدفع تلقائياً في تاريخ الاستحقاق دون تدخل منك.', 'Automatically mark as paid on the due date.', 'Automatisch am Fälligkeitsdatum bezahlen.')}
            </p>
          </div>

        </div>

        <div className="p-4 border-t border-surface-border">
          <button 
            onClick={handleSave}
            disabled={!name.trim() || !amount || !categoryId || !accountId}
            className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {_t('حفظ', 'Save', 'Speichern')}
          </button>
        </div>
      </div>
    </div>
  );
};
