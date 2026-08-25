import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, CreditCard, CheckCircle2, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { FinanceInstallment } from '../../types';
import { AddFinanceInstallmentModal } from './modals/AddFinanceInstallmentModal';

export const FinanceInstallments: React.FC = () => {
  const { _t, financeInstallments, financeAccounts, addFinanceTransaction, updateFinanceInstallment, deleteFinanceInstallment } = useApp();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<FinanceInstallment | undefined>();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleMarkPaid = (inst: FinanceInstallment) => {
    const accId = selectedAccountId || inst.accountId || financeAccounts[0]?.id;
    if (!accId) return;

    addFinanceTransaction({
      type: 'expense',
      amount: inst.amountPerInstallment,
      accountId: accId,
      date: new Date().toISOString().split('T')[0],
      note: inst.name + ' - ' + _t('قسط', 'Installment', 'Rate') + ` (${inst.currentInstallment + 1}/${inst.totalInstallments})`
    });

    updateFinanceInstallment(inst.id, {
      currentInstallment: inst.currentInstallment + 1,
      remainingBalance: Math.max(0, inst.remainingBalance - inst.amountPerInstallment)
    });
    setPayingId(null);
  };

  const activeInstallments = financeInstallments.filter(i => !i.deleted);

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-text-main">{_t('الأقساط والجمعيات', 'Installments & Associations', 'Raten & Vereine')}</h3>
          <p className="text-xs text-text-muted">{_t('متابعة سداد الأقساط والجمعيات بانتظام', 'Track installments and monthly associations', 'Raten und monatliche Beiträge verwalten')}</p>
        </div>
        <button 
          onClick={() => {
            setEditingInstallment(undefined);
            setIsAddModalOpen(true);
          }}
          className="bg-primary/10 text-primary hover:bg-primary/20 px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {_t('إضافة قسط', 'Add Installment', 'Hinzufügen')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeInstallments.map(inst => {
          const progress = Math.min(100, Math.round((inst.currentInstallment / Math.max(1, inst.totalInstallments)) * 100));
          const isCompleted = inst.currentInstallment >= inst.totalInstallments;
          const isMenuOpen = menuOpenId === inst.id;

          return (
            <div key={inst.id} className={`bg-surface border ${isCompleted ? 'border-emerald-500/30' : 'border-surface-border'} rounded-2xl p-4 flex flex-col justify-between shadow-2xs relative`}>
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCompleted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-purple-500/10 text-purple-500'}`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-text-main text-sm">{inst.name}</h4>
                      {inst.providerName && (
                        <p className="text-[11px] text-text-muted">{inst.providerName}</p>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setMenuOpenId(isMenuOpen ? null : inst.id)}
                      className="p-1 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute left-0 rtl:right-0 rtl:left-auto mt-1 w-32 bg-surface border border-surface-border rounded-xl shadow-xl z-20 py-1 divide-y divide-surface-border">
                        <button
                          onClick={() => {
                            setEditingInstallment(inst);
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
                            if (window.confirm(_t('هل تريد حذف هذا القسط؟', 'Delete this installment?', 'Diese Rate löschen?'))) {
                              deleteFinanceInstallment(inst.id);
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

                <p className="text-xl font-black text-text-main mb-1">
                  {inst.amountPerInstallment.toLocaleString()} EGP <span className="text-xs text-text-muted font-medium">/ {_t('قسط', 'Inst.', 'Rate')}</span>
                </p>
                <div className="text-xs text-text-muted mb-3 flex justify-between">
                  <span>{inst.currentInstallment} / {inst.totalInstallments} {_t('مدفوع', 'Paid', 'Bezahlt')}</span>
                  <span className="font-bold text-text-main">{inst.remainingBalance.toLocaleString()} EGP {_t('متبقي', 'Remaining', 'Verbleibend')}</span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-2 mb-4 overflow-hidden border border-surface-border">
                  <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              <div>
                {!isCompleted ? (
                  payingId === inst.id ? (
                    <div className="bg-surface-hover p-2.5 rounded-xl border border-surface-border space-y-2 mt-2">
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="" disabled>{_t('اختر الحساب للخصم منه', 'Select Account to debit', 'Konto wählen')}</option>
                        {financeAccounts.filter(a => !a.deleted).map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency})</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleMarkPaid(inst)} 
                          disabled={!selectedAccountId && !inst.accountId && financeAccounts.length === 0} 
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
                        setPayingId(inst.id);
                        if (inst.accountId) setSelectedAccountId(inst.accountId);
                        else if (financeAccounts.length > 0) setSelectedAccountId(financeAccounts[0].id);
                      }}
                      className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {_t('سداد قسط الآن', 'Pay Installment Now', 'Rate bezahlen')}
                    </button>
                  )
                ) : (
                  <div className="w-full py-2 bg-emerald-500/10 text-emerald-600 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 mt-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {_t('تم سداد كافة الأقساط بالكامل', 'All Installments Completed', 'Vollständig bezahlt')}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {activeInstallments.length === 0 && (
          <div className="col-span-full py-12 text-center bg-surface-hover border border-dashed border-surface-border rounded-2xl">
            <CreditCard className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-text-main font-bold text-sm">
              {_t('لا توجد أقساط أو جمعيات مسجلة', 'No installments or associations recorded', 'Keine Raten oder Vereine')}
            </p>
            <p className="text-text-muted text-xs mt-1 mb-4">
              {_t('أضف الأقساط الشهرية أو الجمعيات لتنظيم التزاماتك ومتابعة السداد تلقائياً.', 'Add monthly installments to organize obligations and track payments.', 'Fügen Sie monatliche Raten hinzu.')}
            </p>
            <button
              onClick={() => {
                setEditingInstallment(undefined);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-primary-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              {_t('إضافة قسط الآن', 'Add Installment Now', 'Jetzt hinzufügen')}
            </button>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddFinanceInstallmentModal
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingInstallment(undefined);
          }}
          existingInstallment={editingInstallment}
        />
      )}
    </div>
  );
};
