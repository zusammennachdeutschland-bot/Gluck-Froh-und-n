import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, Repeat, Plus, Trash2 } from 'lucide-react';
import { FinanceRecurring } from '../../../types';

interface AddFinanceRecurringModalProps {
  onClose: () => void;
  existingRecurring?: FinanceRecurring;
}

export const AddFinanceRecurringModal: React.FC<AddFinanceRecurringModalProps> = ({ onClose, existingRecurring }) => {
  const { _t, addFinanceRecurring, updateFinanceRecurring, financeAccounts, financeCategories, addFinanceCategory, deleteFinanceCategory } = useApp();
  
  const [name, setName] = useState(existingRecurring?.name || '');
  const [amount, setAmount] = useState(existingRecurring?.amount?.toString() || '');
  const [frequency, setFrequency] = useState<FinanceRecurring['frequency']>(existingRecurring?.frequency || 'monthly');
  const [dueDayOfMonth, setDueDayOfMonth] = useState(existingRecurring?.dueDayOfMonth?.toString() || '1');
  const [categoryId, setCategoryId] = useState(existingRecurring?.categoryId || (financeCategories.find(c => c.type === 'expense' && !c.deleted)?.id || ''));
  const [accountId, setAccountId] = useState(existingRecurring?.accountId || (financeAccounts[0]?.id || ''));

  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const expenseCategories = financeCategories.filter(c => c.type === 'expense' && !c.deleted);

  const handleSave = () => {
    const amountNum = parseFloat(amount);
    const dayNum = parseInt(dueDayOfMonth, 10);

    if (!name.trim() || !amountNum || amountNum <= 0) return;

    if (existingRecurring) {
      updateFinanceRecurring(existingRecurring.id, {
        name: name.trim(),
        amount: amountNum,
        frequency,
        dueDayOfMonth: isNaN(dayNum) ? undefined : dayNum,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined
      });
    } else {
      addFinanceRecurring({
        name: name.trim(),
        amount: amountNum,
        frequency,
        dueDayOfMonth: isNaN(dayNum) ? undefined : dayNum,
        categoryId: categoryId || '',
        accountId: accountId || ''
      });
    }
    onClose();
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat = addFinanceCategory({
      name: newCategoryName.trim(),
      type: 'expense'
    });
    setNewCategoryName('');
    setCategoryId(cat.id);
    setIsManagingCategories(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full md:w-full md:max-w-md bg-surface border-t md:border border-surface-border md:rounded-2xl shadow-2xl rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        
        {isManagingCategories ? (
          <div className="p-4 flex flex-col h-[50vh] md:h-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3 mb-3">
              <h3 className="text-sm font-bold">{_t('إدارة تصنيفات المصروفات', 'Manage Expense Categories', 'Kategorien verwalten')}</h3>
              <button onClick={() => setIsManagingCategories(false)} className="p-1.5 hover:bg-surface-hover rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input 
                type="text" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                placeholder={_t('اسم التصنيف الجديد...', 'New category name...', 'Neuer Kategoriename...')}
                className="flex-1 px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
              <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="p-2 bg-primary text-white rounded-xl disabled:opacity-50 cursor-pointer">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {expenseCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2.5 bg-surface-hover rounded-xl">
                  <span className="text-sm font-bold">{cat.name}</span>
                  <button onClick={() => deleteFinanceCategory(cat.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Repeat className="w-5 h-5 text-blue-500" />
                {existingRecurring ? _t('تعديل الدفعة المتكررة', 'Edit Recurring Payment', 'Wiederkehrende Zahlung bearbeiten') : _t('إضافة دفعة متكررة', 'Add Recurring Payment', 'Wiederkehrende Zahlung hinzufügen')}
              </h3>
              <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">
                  {_t('اسم الدفعة / البند', 'Item / Payment Name', 'Name')} *
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder={_t('مثال: إيجار القاعة، فاتورة الإنترنت، اشتراك المنصة', 'e.g. Center Rent, Internet Bill, Software Subscription', 'z.B. Miete, Internet')}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    {_t('المبلغ (ج.م)', 'Amount (EGP)', 'Betrag')} *
                  </label>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    placeholder="1500"
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    {_t('التكرار', 'Frequency', 'Häufigkeit')}
                  </label>
                  <select 
                    value={frequency} 
                    onChange={e => setFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
                  >
                    <option value="monthly">{_t('شهرياً', 'Monthly', 'Monatlich')}</option>
                    <option value="weekly">{_t('أسبوعياً', 'Weekly', 'Wöchentlich')}</option>
                    <option value="daily">{_t('يومياً', 'Daily', 'Täglich')}</option>
                    <option value="yearly">{_t('سنوياً', 'Yearly', 'Jährlich')}</option>
                  </select>
                </div>
              </div>

              {frequency === 'monthly' && (
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    {_t('يوم الاستحقاق من كل شهر (1 - 31)', 'Due Day of Month (1 - 31)', 'Fälligkeitstag im Monat')}
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="31" 
                    value={dueDayOfMonth} 
                    onChange={e => setDueDayOfMonth(e.target.value)} 
                    placeholder="1"
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5 flex items-center justify-between">
                  <span>{_t('التصنيف', 'Category', 'Kategorie')}</span>
                  <button onClick={() => setIsManagingCategories(true)} className="text-primary flex items-center gap-1 hover:underline text-xs cursor-pointer">
                    <Plus className="w-3 h-3" /> {_t('إضافة/تعديل', 'Manage', 'Verwalten')}
                  </button>
                </label>
                <select 
                  value={categoryId} 
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-hidden"
                >
                  <option value="">{_t('اختر التصنيف...', 'Select Category...', 'Kategorie wählen...')}</option>
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

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

              <button 
                onClick={handleSave} 
                disabled={!name.trim() || !amount || parseFloat(amount) <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold disabled:opacity-50 mt-2 transition-colors cursor-pointer shadow-2xs"
              >
                <Save className="w-5 h-5" />
                {_t('حفظ الدفعة', 'Save Recurring', 'Speichern')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
