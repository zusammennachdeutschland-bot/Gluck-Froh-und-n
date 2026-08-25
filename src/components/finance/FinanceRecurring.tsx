import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Repeat, CalendarCheck, CheckCircle2, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { FinanceRecurring as FinanceRecurringType } from '../../types';
import { AddFinanceRecurringModal } from './modals/AddFinanceRecurringModal';

export const FinanceRecurring: React.FC = () => {
  const { _t, financeRecurring, financeAccounts, financeCategories, addFinanceTransaction, updateFinanceRecurring, deleteFinanceRecurring } = useApp();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<FinanceRecurringType | undefined>();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleMarkPaid = (rec: FinanceRecurringType) => {
    const accId = selectedAccountId || rec.accountId || financeAccounts[0]?.id;
    if (!accId) return;

    addFinanceTransaction({
      type: 'expense',
      amount: rec.amount,
      accountId: accId,
      categoryId: rec.categoryId,
      date: new Date().toISOString().split('T')[0],
      note: rec.name + ' - ' + _t('دفع متكرر', 'Recurring Payment', 'Wiederkehrende Zahlung')
    });

    updateFinanceRecurring(rec.id, {
      lastPaidDate: new Date().toISOString().split('T')[0]
    });
    setPayingId(null);
  };

  const activeRecurring = financeRecurring.filter(r => !r.deleted);

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-text-main">{_t('المدفوعات المتكررة', 'Recurring Payments', 'Wiederkehrende Zahlungen')}</h3>
          <p className="text-xs text-text-muted">{_t('الإيجار، الفواتير، اشتراكات البرامج والرواتب الثابتة', 'Rent, bills, software subscriptions, fixed salaries', 'Miete, Rechnungen, Abonnements')}</p>
        </div>
        <button 
          onClick={() => {
            setEditingRecurring(undefined);
            setIsAddModalOpen(true);
          }}
          className="bg-primary/10 text-primary hover:bg-primary/20 px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {_t('إضافة دفعة', 'Add Recurring', 'Hinzufügen')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeRecurring.map(rec => {
          const category = financeCategories.find(c => c.id === rec.categoryId);
          const isMenuOpen = menuOpenId === rec.id;

          return (
            <div key={rec.id} className="bg-surface border border-surface-border rounded-2xl p-4 flex flex-col justify-between shadow-2xs relative">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Repeat className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-text-main text-sm">{rec.name}</h4>
                      {category && (
                        <span className="text-[10px] font-bold text-text-muted bg-surface-hover px-1.5 py-0.5 rounded-md">
                          {category.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setMenuOpenId(isMenuOpen ? null : rec.id)}
                      className="p-1 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute left-0 rtl:right-0 rtl:left-auto mt-1 w-32 bg-surface border border-surface-border rounded-xl shadow-xl z-20 py-1 divide-y divide-surface-border">
                        <button
                          onClick={() => {
                            setEditingRecurring(rec);
                            setIsAddModalOpen(true);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-right rtl:text-right ltr:text-left px-3 py-1.5 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          {_t('تعديل', 'Edit', 'Bearbeiten')}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(_t('هل تريد حذف هذه الدفعة المتكررة؟', 'Delete this recurring payment?', 'Diese Zahlung löschen?'))) {
                              deleteFinanceRecurring(rec.id);
                            }
                            setMenuOpenId(null);
                          }}
                          className="w-full text-right rtl:text-right ltr:text-left px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {_t('حذف', 'Delete', 'Löschen')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xl font-black text-rose-500 mb-1">{rec.amount.toLocaleString()} EGP</p>
                <p className="text-xs text-text-muted mb-4">
                  {rec.frequency === 'monthly' ? _t('شهرياً', 'Monthly', 'Monatlich') :
                   rec.frequency === 'weekly' ? _t('أسبوعياً', 'Weekly', 'Wöchentlich') :
                   rec.frequency === 'yearly' ? _t('سنوياً', 'Yearly', 'Jährlich') : _t('يومياً', 'Daily', 'Täglich')}
                  {rec.dueDayOfMonth ? ` • ${_t('يوم', 'Day', 'Tag')} ${rec.dueDayOfMonth} ${_t('من الشهر', 'of month', 'des Monats')}` : ''}
                </p>
              </div>

              <div>
                {rec.lastPaidDate && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    {_t('آخر سداد:', 'Last paid:', 'Zuletzt bezahlt:')} {new Date(rec.lastPaidDate).toLocaleDateString()}
                  </p>
                )}
                
                {payingId === rec.id ? (
                  <div className="bg-surface-hover p-2.5 rounded-xl border border-surface-border space-y-2 mt-2">
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="" disabled>{_t('اختر الحساب للخصم منه', 'Select Account', 'Konto wählen')}</option>
                      {financeAccounts.filter(a => !a.deleted).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency})</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => handleMarkPaid(rec)} 
                        disabled={!selectedAccountId && !rec.accountId && financeAccounts.length === 0} 
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {_t('تأكيد الدفع', 'Confirm Pay', 'Bestätigen')}
                      </button>
                      <button 
                        onClick={() => setPayingId(null)} 
                        className="flex-1 bg-surface border border-surface-border hover:bg-surface-hover text-text-main text-xs font-bold py-2 rounded-lg cursor-pointer"
                      >
                        {_t('إلغاء', 'Cancel', 'Abbrechen')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setPayingId(rec.id);
                      if (rec.accountId) setSelectedAccountId(rec.accountId);
                      else if (financeAccounts.length > 0) setSelectedAccountId(financeAccounts[0].id);
                    }}
                    className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {_t('دفع الآن', 'Pay Now', 'Jetzt bezahlen')}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {activeRecurring.length === 0 && (
          <div className="col-span-full py-12 text-center bg-surface-hover border border-dashed border-surface-border rounded-2xl">
            <Repeat className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-text-main font-bold text-sm">
              {_t('لا توجد مدفوعات متكررة مسجلة', 'No recurring payments recorded', 'Keine wiederkehrenden Zahlungen')}
            </p>
            <p className="text-text-muted text-xs mt-1 mb-4">
              {_t('أضف بنود الإيجار، الاشتراكات، أو الرواتب الثابتة لتسجيلها بضغطة واحدة كل شهر.', 'Add rent, subscriptions, or salaries for 1-click payments.', 'Fügen Sie monatliche Fixkosten hinzu.')}
            </p>
            <button
              onClick={() => {
                setEditingRecurring(undefined);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-primary-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              {_t('إضافة دفعة متكررة الآن', 'Add Recurring Now', 'Jetzt hinzufügen')}
            </button>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddFinanceRecurringModal
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingRecurring(undefined);
          }}
          existingRecurring={editingRecurring}
        />
      )}
    </div>
  );
};
