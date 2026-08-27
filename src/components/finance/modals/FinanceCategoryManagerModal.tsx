import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, Plus, Trash2, Edit2, ShieldAlert, ArrowLeftRight, Check, Tag } from 'lucide-react';
import { FinanceCategory } from '../../../types';

interface Props {
  onClose: () => void;
}

export const FinanceCategoryManagerModal: React.FC<Props> = ({ onClose }) => {
  const { _t, language, financeCategories, addFinanceCategory, updateFinanceCategory, financeTransactions } = useApp();

  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New/Edit state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [parentId, setParentId] = useState('');

  const relevantCategories = useMemo(() => 
    financeCategories.filter(c => c.type === activeTab && !c.deleted),
  [financeCategories, activeTab]);

  const parents = useMemo(() => relevantCategories.filter(c => !c.parentId), [relevantCategories]);
  const getSubcategories = (parent: string) => relevantCategories.filter(c => c.parentId === parent);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setIcon('🏷️');
    setParentId('');
  };

  const handleEdit = (cat: FinanceCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon || '🏷️');
    setParentId(cat.parentId || '');
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (editingId) {
      updateFinanceCategory(editingId, {
        name,
        icon,
        parentId: parentId || undefined
      });
    } else {
      addFinanceCategory({
        name,
        icon,
        type: activeTab,
        parentId: parentId || undefined,
        isActive: true
      });
    }
    resetForm();
  };

  const handleToggleActive = (id: string, current: boolean) => {
    updateFinanceCategory(id, { isActive: !current });
  };

  const handleDelete = (id: string) => {
    // Check if used in transactions
    const isUsed = financeTransactions.some(tx => tx.categoryId === id && !tx.deleted);
    if (isUsed) {
      alert(_t('لا يمكن حذف هذا التصنيف لارتباطه بمعاملات مالية، تم إيقافه بدلاً من ذلك.', 'Cannot delete this category as it is used in transactions. It has been deactivated instead.', 'Kategorie wird in Transaktionen verwendet und deaktiviert.'));
      updateFinanceCategory(id, { isActive: false });
    } else {
      updateFinanceCategory(id, { deleted: true, isActive: false });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            {_t('إدارة التصنيفات', 'Manage Categories', 'Kategorien verwalten')}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Type Switcher */}
        <div className="p-4 border-b border-surface-border">
          <div className="flex p-1 bg-surface-hover rounded-xl">
            <button
              onClick={() => { setActiveTab('expense'); resetForm(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'expense' ? 'bg-surface shadow text-red-500' : 'text-text-muted'}`}
            >
              {_t('مصروفات', 'Expenses', 'Ausgaben')}
            </button>
            <button
              onClick={() => { setActiveTab('income'); resetForm(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'income' ? 'bg-surface shadow text-emerald-500' : 'text-text-muted'}`}
            >
              {_t('إيرادات', 'Income', 'Einnahmen')}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Category List */}
          <div className="w-full md:w-1/2 border-r border-surface-border overflow-y-auto p-2 space-y-4">
            {parents.map(parent => (
              <div key={parent.id} className="bg-surface-hover rounded-xl p-2 border border-surface-border shadow-2xs">
                <div className={`flex items-center justify-between p-2 rounded-lg ${parent.isActive === false ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{parent.icon || '📁'}</span>
                    <div>
                      <span className="text-sm font-bold">{parent.name}</span>
                      {parent.isActive === false && <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded ml-2">{_t('غير نشط', 'Inactive', 'Inaktiv')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleToggleActive(parent.id, parent.isActive !== false)} className="p-1.5 text-text-muted hover:text-primary rounded-lg" title={_t('تفعيل/تعطيل', 'Toggle active', 'Aktivieren/Deaktivieren')}>
                      {parent.isActive !== false ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-rose-500" />}
                    </button>
                    <button onClick={() => handleEdit(parent)} className="p-1.5 text-text-muted hover:text-primary rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!parent.isDefault && (
                      <button onClick={() => handleDelete(parent.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Subcategories */}
                <div className="mt-1 ml-6 pl-2 border-l-2 border-surface-border space-y-1">
                  {getSubcategories(parent.id).map(sub => (
                    <div key={sub.id} className={`flex items-center justify-between p-1.5 rounded-lg hover:bg-surface ${sub.isActive === false ? 'opacity-50 grayscale' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{sub.icon || '🏷️'}</span>
                        <span className="text-xs font-medium">{sub.name}</span>
                        {sub.isActive === false && <span className="text-[9px] bg-rose-500/10 text-rose-500 px-1 py-0.5 rounded">{_t('غير نشط', 'Inactive', 'Inaktiv')}</span>}
                      </div>
                      <div className="flex items-center gap-1 opacity-50 hover:opacity-100">
                        <button onClick={() => handleToggleActive(sub.id, sub.isActive !== false)} className="p-1 text-text-muted hover:text-primary rounded-lg">
                           {sub.isActive !== false ? <Check className="w-3 h-3 text-emerald-500" /> : <X className="w-3 h-3 text-rose-500" />}
                        </button>
                        <button onClick={() => handleEdit(sub)} className="p-1 text-text-muted hover:text-primary rounded-lg">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {!sub.isDefault && (
                          <button onClick={() => handleDelete(sub.id)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Edit / Add Form */}
          <div className="w-full md:w-1/2 p-4 bg-surface-hover overflow-y-auto">
            <h4 className="text-sm font-bold text-text-main mb-4 border-b border-surface-border pb-2">
              {editingId ? _t('تعديل تصنيف', 'Edit Category', 'Kategorie bearbeiten') : _t('إضافة تصنيف جديد', 'Add New Category', 'Neue Kategorie')}
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('الاسم', 'Name', 'Name')}</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder={_t('اسم التصنيف...', 'Category name...', 'Kategoriename...')}
                  className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('أيقونة (اختياري)', 'Icon (Optional)', 'Symbol (Optional)')}</label>
                <input 
                  type="text" 
                  value={icon} 
                  onChange={e => setIcon(e.target.value)} 
                  placeholder="🏠"
                  className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                />
                <p className="text-[10px] text-text-muted mt-1">{_t('يمكنك استخدام Emojis 🚗 🍔 💡', 'You can use emojis 🚗 🍔 💡', 'Sie können Emojis verwenden 🚗 🍔 💡')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('تصنيف رئيسي (اختياري)', 'Parent Category (Optional)', 'Hauptkategorie (Optional)')}</label>
                <select 
                  value={parentId} 
                  onChange={e => setParentId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">-- {_t('بدون (تصنيف رئيسي)', 'None (Main Category)', 'Keine (Hauptkategorie)')} --</option>
                  {parents.filter(p => p.id !== editingId).map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                {editingId && (
                  <button 
                    onClick={resetForm}
                    className="flex-1 py-2 bg-surface border border-surface-border text-text-muted rounded-xl font-bold hover:bg-surface-hover"
                  >
                    {_t('إلغاء', 'Cancel', 'Abbrechen')}
                  </button>
                )}
                <button 
                  onClick={handleSave} 
                  disabled={!name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {_t('حفظ', 'Save', 'Speichern')}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
