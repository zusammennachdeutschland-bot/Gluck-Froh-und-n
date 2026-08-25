import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, ArrowLeftRight, Plus, Edit2, Trash2 } from 'lucide-react';

interface AddFinanceTransactionModalProps {
  onClose: () => void;
  type: 'income' | 'expense' | 'transfer';
}

export const AddFinanceTransactionModal: React.FC<AddFinanceTransactionModalProps> = ({ onClose, type }) => {
  const { _t, addFinanceTransaction, financeAccounts, financeCategories, addFinanceCategory, updateFinanceCategory, deleteFinanceCategory } = useApp();
  
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(financeAccounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const relevantCategories = financeCategories.filter(c => c.type === type && !c.deleted);

  const handleSave = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0 || !accountId) return;
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return;
    if (type !== 'transfer' && !categoryId) return; // Category required for income/expense

    addFinanceTransaction({
      type,
      amount: val,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type !== 'transfer' ? categoryId : undefined,
      date,
      note: note.trim()
    });
    onClose();
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat = addFinanceCategory({
      name: newCategoryName.trim(),
      type: type as 'income' | 'expense'
    });
    setNewCategoryName('');
    setCategoryId(cat.id);
    setIsManagingCategories(false);
  };

  const title = type === 'income' ? _t('إضافة دخل', 'Add Income', 'Einkommen') : 
                type === 'expense' ? _t('إضافة مصروف', 'Add Expense', 'Ausgabe') : 
                _t('تحويل بين الحسابات', 'Transfer', 'Überweisung');

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full md:w-full md:max-w-md bg-surface border-t md:border border-surface-border md:rounded-2xl shadow-2xl rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        
        {isManagingCategories ? (
          // CATEGORY MANAGEMENT VIEW
          <div className="p-4 flex flex-col h-[50vh] md:h-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3 mb-3">
              <h3 className="text-sm font-bold">{_t('إدارة التصنيفات', 'Manage Categories', 'Kategorien verwalten')}</h3>
              <button onClick={() => setIsManagingCategories(false)} className="p-1.5 hover:bg-surface-hover rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input 
                type="text" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                placeholder={_t('اسم التصنيف الجديد...', 'New category name...', 'Neuer Kategoriename...')}
                className="flex-1 px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="p-2 bg-primary text-white rounded-xl disabled:opacity-50">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {relevantCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2.5 bg-surface-hover rounded-xl">
                  <span className="text-sm font-bold">{cat.name}</span>
                  <button onClick={() => deleteFinanceCategory(cat.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {relevantCategories.length === 0 && (
                <p className="text-center text-xs text-text-muted py-4">{_t('لا يوجد', 'None', 'Keine')}</p>
              )}
            </div>
          </div>
        ) : (
          // NORMAL FORM
          <>
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ArrowLeftRight className={`w-5 h-5 ${type === 'income' ? 'text-emerald-500' : type === 'expense' ? 'text-red-500' : 'text-blue-500'}`} />
                {title}
              </h3>
              <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('المبلغ', 'Amount', 'Betrag')}</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-lg font-bold focus:ring-1 focus:ring-primary outline-none"
                  autoFocus
                />
              </div>

              {type !== 'transfer' && (
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5 flex items-center justify-between">
                    <span>{_t('التصنيف', 'Category', 'Kategorie')}</span>
                    <button onClick={() => setIsManagingCategories(true)} className="text-primary flex items-center gap-1 hover:underline">
                      <Plus className="w-3 h-3" /> {_t('إضافة/تعديل', 'Manage', 'Verwalten')}
                    </button>
                  </label>
                  <select 
                    value={categoryId} 
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="" disabled>{_t('اختر...', 'Select...', 'Wählen...')}</option>
                    {relevantCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">{type === 'transfer' ? _t('من حساب', 'From Account', 'Von Konto') : _t('الحساب', 'Account', 'Konto')}</label>
                  <select 
                    value={accountId} 
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="" disabled>{_t('اختر...', 'Select...', 'Wählen...')}</option>
                    {financeAccounts.filter(a => !a.deleted).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                
                {type === 'transfer' ? (
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('إلى حساب', 'To Account', 'Nach Konto')}</label>
                    <select 
                      value={toAccountId} 
                      onChange={e => setToAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">{_t('اختر...', 'Select...', 'Wählen...')}</option>
                      {financeAccounts.filter(a => !a.deleted && a.id !== accountId).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('التاريخ', 'Date', 'Datum')}</label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={e => setDate(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                )}
              </div>

              {type === 'transfer' && (
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('التاريخ', 'Date', 'Datum')}</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('ملاحظات (اختياري)', 'Notes (Optional)', 'Notizen (Optional)')}</label>
                <input 
                  type="text" 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  placeholder={_t('أي تفاصيل إضافية...', 'Any additional details...', 'Weitere Details...')}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <button 
                onClick={handleSave} 
                disabled={!amount || parseFloat(amount) <= 0 || !accountId || (type === 'transfer' && !toAccountId) || (type !== 'transfer' && !categoryId)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold disabled:opacity-50 mt-2 transition-colors cursor-pointer shadow-2xs"
              >
                <Save className="w-5 h-5" />
                {_t('حفظ', 'Save', 'Speichern')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
