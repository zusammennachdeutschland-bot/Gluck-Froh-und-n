import re

code = """
import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, Repeat, Plus, Trash2, Search, ArrowLeftRight, Tag, ChevronRight, Clock } from 'lucide-react';
import { FinanceRecurring, FinanceCategory } from '../../../types';

interface AddFinanceRecurringModalProps {
  onClose: () => void;
  existingRecurring?: FinanceRecurring;
}

export const AddFinanceRecurringModal: React.FC<AddFinanceRecurringModalProps> = ({ onClose, existingRecurring }) => {
  const { _t, language, addFinanceRecurring, updateFinanceRecurring, financeAccounts, financeCategories } = useApp();

  const [type, setType] = useState<'income' | 'expense'>(existingRecurring?.type || 'expense');
  const [name, setName] = useState(existingRecurring?.name || '');
  const [amount, setAmount] = useState(existingRecurring?.amount?.toString() || '');
  const [frequency, setFrequency] = useState<FinanceRecurring['frequency']>(existingRecurring?.frequency || 'monthly');
  const [dueDayOfMonth, setDueDayOfMonth] = useState(existingRecurring?.dueDayOfMonth?.toString() || '1');
  const [startDate, setStartDate] = useState(existingRecurring?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(existingRecurring?.endDate || '');
  const [isActive, setIsActive] = useState(existingRecurring?.isActive !== false);

  const [categoryId, setCategoryId] = useState(existingRecurring?.categoryId || '');
  const [accountId, setAccountId] = useState(existingRecurring?.accountId || (financeAccounts.find(a => !a.deleted)?.id || ''));

  // Category Picker State
  const [isSelectingCategory, setIsSelectingCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const relevantCategories = useMemo(() => 
    financeCategories.filter(c => c.type === type && !c.deleted && c.isActive !== false),
  [financeCategories, type]);

  const parents = useMemo(() => relevantCategories.filter(c => !c.parentId), [relevantCategories]);
  const getSubcategories = (parentId: string) => relevantCategories.filter(c => c.parentId === parentId);

  const searchResults = useMemo(() => {
    if (!categorySearch.trim()) return [];
    const term = categorySearch.toLowerCase();
    return relevantCategories.filter(c => c.name.toLowerCase().includes(term) || (c.icon && c.icon.includes(term)));
  }, [categorySearch, relevantCategories]);

  // Handle changing type
  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategoryId('');
  };

  const handleSave = () => {
    if (!name.trim() || !amount || parseFloat(amount) <= 0 || !categoryId || !accountId) return;

    if (existingRecurring) {
      updateFinanceRecurring(existingRecurring.id, {
        name,
        type,
        amount: parseFloat(amount),
        categoryId,
        accountId,
        frequency,
        dueDayOfMonth: frequency === 'monthly' ? parseInt(dueDayOfMonth) : undefined,
        startDate,
        endDate: endDate || undefined,
        isActive
      });
    } else {
      addFinanceRecurring({
        name,
        type,
        amount: parseFloat(amount),
        categoryId,
        accountId,
        frequency,
        dueDayOfMonth: frequency === 'monthly' ? parseInt(dueDayOfMonth) : undefined,
        startDate,
        endDate: endDate || undefined,
        isActive
      });
    }
    onClose();
  };

  const getFullCategoryName = (catId: string) => {
    const cat = relevantCategories.find(c => c.id === catId);
    if (!cat) return _t('اختر التصنيف...', 'Select Category...', 'Kategorie wählen...');
    if (cat.parentId) {
      const parent = relevantCategories.find(c => c.id === cat.parentId);
      return parent ? `${parent.icon || ''} ${parent.name} -> ${cat.name}` : `${cat.icon || ''} ${cat.name}`;
    }
    return `${cat.icon || ''} ${cat.name}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {isSelectingCategory ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {selectedParentId && !categorySearch ? (
                  <button onClick={() => setSelectedParentId(null)} className="p-1 hover:bg-surface-hover rounded-lg">
                    <ArrowLeftRight className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <Tag className="w-5 h-5 text-primary" />
                )}
                {_t('اختر التصنيف', 'Select Category', 'Kategorie wählen')}
              </h3>
              <button onClick={() => { setIsSelectingCategory(false); setSelectedParentId(null); setCategorySearch(''); }} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-3 border-b border-surface-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input 
                  type="text" 
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  placeholder={_t('بحث...', 'Search...', 'Suchen...')}
                  className="w-full pl-9 pr-4 py-2 bg-surface-hover rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {categorySearch.trim() ? (
                searchResults.length > 0 ? (
                  searchResults.map(cat => {
                    const parent = cat.parentId ? relevantCategories.find(c => c.id === cat.parentId) : null;
                    return (
                      <button 
                        key={cat.id} 
                        onClick={() => { setCategoryId(cat.id); setIsSelectingCategory(false); setCategorySearch(''); setSelectedParentId(null); }}
                        className="w-full flex items-center gap-3 p-3 text-start hover:bg-surface-hover rounded-xl"
                      >
                        <span className="text-2xl">{cat.icon || (parent?.icon) || '🏷️'}</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{cat.name}</span>
                          {parent && <span className="text-xs text-text-muted">{parent.name}</span>}
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <p className="text-center text-xs text-text-muted py-8">{_t('لا توجد نتائج', 'No results', 'Keine Ergebnisse')}</p>
                )
              ) : selectedParentId ? (
                <>
                  <div className="p-2 mb-1">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                      {relevantCategories.find(c => c.id === selectedParentId)?.name}
                    </span>
                  </div>
                  {getSubcategories(selectedParentId).map(cat => (
                    <button 
                      key={cat.id} 
                      onClick={() => { setCategoryId(cat.id); setIsSelectingCategory(false); setSelectedParentId(null); }}
                      className="w-full flex items-center gap-3 p-3 text-start hover:bg-surface-hover rounded-xl"
                    >
                      <span className="text-xl">{cat.icon || '🏷️'}</span>
                      <span className="text-sm font-bold">{cat.name}</span>
                    </button>
                  ))}
                  {getSubcategories(selectedParentId).length === 0 && (
                     <button 
                      onClick={() => { setCategoryId(selectedParentId); setIsSelectingCategory(false); setSelectedParentId(null); }}
                      className="w-full flex items-center gap-3 p-3 text-start hover:bg-surface-hover rounded-xl"
                    >
                      <span className="text-xl">{relevantCategories.find(c => c.id === selectedParentId)?.icon || '🏷️'}</span>
                      <span className="text-sm font-bold">{_t('استخدام هذا التصنيف الأساسي', 'Use this main category', 'Hauptkategorie verwenden')}</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="p-2">
                    <span className="text-xs font-bold text-text-muted">{_t('جميع التصنيفات', 'All Categories', 'Alle Kategorien')}</span>
                  </div>
                  {parents.map(parent => (
                    <button 
                      key={parent.id} 
                      onClick={() => {
                        const subs = getSubcategories(parent.id);
                        if (subs.length > 0) {
                          setSelectedParentId(parent.id);
                        } else {
                          setCategoryId(parent.id); 
                          setIsSelectingCategory(false);
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-surface-hover rounded-xl"
                    >
                      <div className="flex items-center gap-3 text-start">
                        <span className="text-2xl">{parent.icon || '📁'}</span>
                        <span className="text-sm font-bold">{parent.name}</span>
                      </div>
                      {getSubcategories(parent.id).length > 0 && (
                        <ChevronRight className={`w-4 h-4 text-text-muted ${language === 'ar' ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Repeat className={`w-5 h-5 ${type === 'income' ? 'text-emerald-500' : 'text-red-500'}`} />
                {existingRecurring ? _t('تعديل معاملة متكررة', 'Edit Recurring Transaction', 'Wiederkehrende Transaktion bearbeiten') : _t('إضافة معاملة متكررة', 'Add Recurring Transaction', 'Wiederkehrende Transaktion hinzufügen')}
              </h3>
              <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Type Switch */}
              <div className="flex p-1 bg-surface-hover rounded-xl">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${type === 'expense' ? 'bg-surface shadow text-red-500' : 'text-text-muted'}`}
                >
                  {_t('مصروف', 'Expense', 'Ausgabe')}
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${type === 'income' ? 'bg-surface shadow text-emerald-500' : 'text-text-muted'}`}
                >
                  {_t('دخل', 'Income', 'Einkommen')}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">
                  {_t('الاسم / الوصف', 'Name / Description', 'Name')} *
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder={type === 'expense' ? _t('مثال: إيجار الشقة، الإنترنت', 'e.g. Rent, Internet', 'z.B. Miete, Internet') : _t('مثال: راتب شهري', 'e.g. Monthly Salary', 'z.B. Monatsgehalt')}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    {_t('المبلغ', 'Amount', 'Betrag')} *
                  </label>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    {_t('التكرار', 'Frequency', 'Häufigkeit')}
                  </label>
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
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('التصنيف', 'Category', 'Kategorie')}</label>
                <button 
                  onClick={() => setIsSelectingCategory(true)}
                  className="w-full flex items-center justify-between px-3 py-3 bg-surface-hover border border-surface-border rounded-xl focus:ring-1 focus:ring-primary outline-none"
                >
                  <span className="text-sm font-medium">{getFullCategoryName(categoryId)}</span>
                  <ChevronRight className={`w-4 h-4 text-text-muted ${language === 'ar' ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">
                  {_t('الحساب', 'Account', 'Konto')}
                </label>
                <select 
                  value={accountId} 
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">{_t('اختر حساب...', 'Select Account...', 'Konto wählen...')}</option>
                  {financeAccounts.filter(a => !a.deleted).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency})</option>
                  ))}
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
                  <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('تاريخ الانتهاء (اختياري)', 'End Date', 'Enddatum')}</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-surface-hover border border-surface-border rounded-xl cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
                <span className="text-sm font-bold">{_t('نشط (يتم جدولته)', 'Active', 'Aktiv')}</span>
              </label>

              <button 
                onClick={handleSave} 
                disabled={!name.trim() || !amount || parseFloat(amount) <= 0 || !categoryId || !accountId}
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
"""

with open('src/components/finance/modals/AddFinanceRecurringModal.tsx', 'w') as f:
    f.write(code)
