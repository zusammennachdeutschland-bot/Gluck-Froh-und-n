
import React, { useState, useMemo } from 'react';
import { ArrowLeftRight, X, Save, Search, ChevronRight, Tag, Clock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

import { FinanceCategory } from '../../../types';

interface Props {
  type: 'income' | 'expense' | 'transfer';
  onClose: () => void;
}

export const AddFinanceTransactionModal: React.FC<Props> = ({ type, onClose }) => {
  const { financeAccounts, financeCategories, financeTransactions, addFinanceTransaction, _t, language } = useApp();
  

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const activeAccounts = useMemo(() => financeAccounts.filter(a => !a.deleted), [financeAccounts]);
  const [accountId, setAccountId] = useState(() => activeAccounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Auto-set account if empty but accounts exist
  React.useEffect(() => {
    if (!accountId && activeAccounts.length > 0) {
      setAccountId(activeAccounts[0].id);
    }
  }, [accountId, activeAccounts]);

  // Category Picker State
  const [isSelectingCategory, setIsSelectingCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const title = type === 'income' 
    ? _t('إضافة دخل', 'Add Income', 'Einnahmen hinzufügen')
    : type === 'expense' 
    ? _t('إضافة مصروف', 'Add Expense', 'Ausgaben hinzufügen')
    : _t('تحويل بين الحسابات', 'Transfer', 'Überweisen');

  // Build category tree
  const relevantCategories = useMemo(() => 
    financeCategories.filter(c => c.type === type && !c.deleted && c.isActive !== false),
  [financeCategories, type]);

  const parents = useMemo(() => relevantCategories.filter(c => !c.parentId), [relevantCategories]);
  const getSubcategories = (parentId: string) => relevantCategories.filter(c => c.parentId === parentId);

  // Recent categories for quick selection
  const recentCategories = useMemo(() => {
    const recentTx = financeTransactions
      .filter(tx => !tx.deleted && tx.type === type && tx.categoryId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    
    const uniqueIds = Array.from(new Set(recentTx.map(tx => tx.categoryId)));
    return uniqueIds.slice(0, 5).map(id => relevantCategories.find(c => c.id === id)).filter(Boolean) as FinanceCategory[];
  }, [financeTransactions, type, relevantCategories]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!categorySearch.trim()) return [];
    const term = categorySearch.toLowerCase();
    return relevantCategories.filter(c => c.name.toLowerCase().includes(term) || (c.icon && c.icon.includes(term)));
  }, [categorySearch, relevantCategories]);

  const handleSave = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (type !== 'transfer' && !categoryId) return;
    if (type === 'transfer' && (!accountId || !toAccountId)) return;

    addFinanceTransaction({
      amount: parseFloat(amount),
      type,
      categoryId: type !== 'transfer' ? categoryId : '',
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      date,
      note
    });

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
                  {recentCategories.length > 0 && (
                    <div className="mb-4">
                      <div className="p-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-text-muted" />
                        <span className="text-xs font-bold text-text-muted">{_t('الأكثر استخداماً', 'Recent', 'Kürzlich')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 px-2">
                        {recentCategories.map(cat => {
                           const parent = cat.parentId ? relevantCategories.find(c => c.id === cat.parentId) : null;
                           return (
                            <button 
                              key={`recent_${cat.id}`}
                              onClick={() => { setCategoryId(cat.id); setIsSelectingCategory(false); }}
                              className="flex items-center gap-2 p-2 bg-surface border border-surface-border hover:border-primary rounded-xl text-start"
                            >
                              <span className="text-lg">{cat.icon || parent?.icon || '🏷️'}</span>
                              <span className="text-xs font-medium truncate">{cat.name}</span>
                            </button>
                           )
                        })}
                      </div>
                    </div>
                  )}

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
                  <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('التصنيف', 'Category', 'Kategorie')}</label>
                  <button 
                    onClick={() => setIsSelectingCategory(true)}
                    className="w-full flex items-center justify-between px-3 py-3 bg-surface-hover border border-surface-border rounded-xl focus:ring-1 focus:ring-primary outline-none"
                  >
                    <span className="text-sm font-medium">{getFullCategoryName(categoryId)}</span>
                    <ChevronRight className={`w-4 h-4 text-text-muted ${language === 'ar' ? 'rotate-180' : ''}`} />
                  </button>
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
