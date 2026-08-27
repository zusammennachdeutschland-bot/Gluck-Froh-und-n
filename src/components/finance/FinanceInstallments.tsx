import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, CreditCard, CalendarDays, Wallet, AlertCircle, CheckCircle2, MoreVertical, Edit2, Trash2, Bell, Landmark, ShieldCheck } from 'lucide-react';
import { FinanceInstallment } from '../../types';
import { AddFinanceInstallmentModal } from './modals/AddFinanceInstallmentModal';

export const FinanceInstallments: React.FC = () => {
  const { 
    _t, financeInstallments, financeAccounts, addFinanceTransaction, 
    updateFinanceInstallment, deleteFinanceInstallment 
  } = useApp();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<FinanceInstallment | undefined>();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const activeInstallments = financeInstallments.filter(i => !i.deleted);

  const handleMarkPaid = (inst: FinanceInstallment) => {
    const accId = selectedAccountId || inst.accountId || financeAccounts.find(a => !a.deleted)?.id;
    if (!accId) return;

    addFinanceTransaction({
      type: 'expense',
      amount: inst.installmentAmount,
      accountId: accId,
      categoryId: inst.categoryId,
      date: new Date().toISOString().split('T')[0],
      note: inst.name + ' - ' + _t('قسط رقم', 'Installment #', 'Rate Nr.') + ' ' + (inst.paidInstallments + 1)
    });

    const nextPaid = inst.paidInstallments + 1;
    const remaining = Math.max(0, inst.remainingAmount - inst.installmentAmount);
    const newStatus = nextPaid >= inst.totalInstallments || remaining === 0 ? 'completed' : 'active';
    
    let nextDue = inst.nextDueDate;
    if (newStatus === 'active') {
      const due = new Date(inst.nextDueDate);
      if (inst.frequency === 'monthly') due.setMonth(due.getMonth() + 1);
      else if (inst.frequency === 'weekly') due.setDate(due.getDate() + 7);
      nextDue = due.toISOString().split('T')[0];
    }

    updateFinanceInstallment(inst.id, {
      paidInstallments: nextPaid,
      remainingAmount: remaining,
      nextDueDate: nextDue,
      status: newStatus
    });

    setPayingId(null);
  };

  const getStatus = (inst: FinanceInstallment) => {
    if (inst.status === 'completed') return 'completed';
    if (!inst.nextDueDate) return 'active';
    
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(inst.nextDueDate); due.setHours(0,0,0,0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 5) return 'soon';
    return 'active';
  };

  const summary = useMemo(() => {
    let totalRemaining = 0;
    let monthlyCommitment = 0;
    let activeCount = 0;
    let dueSoonCount = 0;

    activeInstallments.forEach(inst => {
      if (inst.status !== 'completed') {
        totalRemaining += inst.remainingAmount;
        activeCount++;
        
        if (inst.frequency === 'monthly') monthlyCommitment += inst.installmentAmount;
        else if (inst.frequency === 'weekly') monthlyCommitment += inst.installmentAmount * 4;
        
        const status = getStatus(inst);
        if (status === 'soon' || status === 'today' || status === 'overdue') dueSoonCount++;
      }
    });

    return { totalRemaining, monthlyCommitment, activeCount, dueSoonCount };
  }, [activeInstallments]);

  return (
    <div className="space-y-3 pb-8 animate-in fade-in">
      
      {/* Summary Header */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-wider text-text-main">
                {_t('الأقساط والالتزامات المالية', 'Installments & Debt', 'Raten & Schulden')}
              </h3>
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-rose-500 tracking-tight font-sans">
                {summary.totalRemaining.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-text-muted">EGP</span>
              <span className="text-[10px] text-text-muted">
                ({_t('المتبقي', 'Remaining', 'Verbleibend')})
              </span>
            </div>
          </div>

          <button 
            onClick={() => {
              setEditingInstallment(undefined);
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs hover:bg-primary-hover cursor-pointer shrink-0 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{_t('إضافة قسط', 'Add Installment', 'Rate hinzufügen')}</span>
          </button>
        </div>

        {/* Mini stats badges */}
        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-surface-border text-center">
          <div>
            <span className="text-[10px] text-text-muted block font-medium">{_t('أقساط جارية', 'Active', 'Aktive')}</span>
            <p className="font-black text-xs sm:text-sm text-text-main mt-0.5">{summary.activeCount}</p>
          </div>
          <div>
            <span className="text-[10px] text-text-muted block font-medium">{_t('التزام شهري', 'Monthly', 'Monatlich')}</span>
            <p className="font-black text-xs sm:text-sm text-text-main mt-0.5">{summary.monthlyCommitment.toLocaleString()} <span className="text-[10px] text-text-muted font-normal">EGP</span></p>
          </div>
          <div>
            <span className="text-[10px] text-text-muted block font-medium">{_t('مستحق قريباً', 'Due Soon', 'Bald fällig')}</span>
            <p className={`font-black text-xs sm:text-sm mt-0.5 ${summary.dueSoonCount > 0 ? 'text-amber-500' : 'text-text-main'}`}>{summary.dueSoonCount}</p>
          </div>
        </div>
      </div>

      {/* Installment Cards List */}
      <div className="space-y-2">
        {activeInstallments.sort((a,b) => {
           if (a.status === 'completed' && b.status !== 'completed') return 1;
           if (a.status !== 'completed' && b.status === 'completed') return -1;
           return 0;
        }).map(inst => {
          const status = getStatus(inst);
          const progress = Math.round((inst.paidInstallments / inst.totalInstallments) * 100) || 0;
          
          return (
            <div 
              key={inst.id} 
              className={`bg-surface border border-surface-border rounded-xl p-3 shadow-2xs relative transition-all ${
                inst.status === 'completed' ? 'opacity-60 grayscale-[40%]' : 'hover:border-primary/40'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-surface-hover text-primary flex items-center justify-center font-bold shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-text-main flex items-center gap-1.5">
                      {inst.name}
                      {inst.notificationsEnabled && inst.status !== 'completed' && <Bell className="w-3 h-3 text-primary opacity-80" />}
                    </h4>
                    <p className="text-[10px] text-text-muted font-mono">
                      {inst.paidInstallments} / {inst.totalInstallments} {_t('أقساط مسددة', 'paid', 'bezahlt')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {status === 'overdue' && (
                    <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-rose-500/20">
                      <AlertCircle className="w-3 h-3" /> {_t('متأخر', 'Overdue', 'Überfällig')}
                    </span>
                  )}
                  {status === 'completed' && (
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> {_t('مكتمل', 'Completed', 'Erledigt')}
                    </span>
                  )}
                  {(status === 'today' || status === 'soon') && (
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-amber-500/20">
                      <CalendarDays className="w-3 h-3" /> {_t('قريباً', 'Due Soon', 'Bald fällig')}
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 mb-2.5 py-1.5 px-2 bg-surface-hover/50 rounded-lg text-center">
                <div>
                  <span className="text-[9px] text-text-muted block">{_t('الأصلي', 'Total', 'Total')}</span>
                  <p className="font-bold text-xs text-text-main font-sans mt-0.5">{inst.originalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[9px] text-text-muted block">{_t('المدفوع', 'Paid', 'Bezahlt')}</span>
                  <p className="font-bold text-xs text-emerald-500 font-sans mt-0.5">{(inst.originalAmount - inst.remainingAmount).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[9px] text-text-muted block">{_t('المتبقي', 'Left', 'Rest')}</span>
                  <p className="font-bold text-xs text-rose-500 font-sans mt-0.5">{inst.remainingAmount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[9px] text-text-muted block">{_t('القسط', 'Rate', 'Rate')}</span>
                  <p className="font-bold text-xs text-primary font-sans mt-0.5">{inst.installmentAmount.toLocaleString()}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span className="text-text-muted">{_t('نسبة السداد', 'Progress', 'Fortschritt')}</span>
                  <span className="text-primary font-mono">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between border-t border-surface-border pt-2">
                <div className="text-[10px] text-text-muted">
                  {inst.status !== 'completed' && inst.nextDueDate && (
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-text-muted" />
                      <span>{_t('الاستحقاق:', 'Due:', 'Fällig:')} {new Date(inst.nextDueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => { setEditingInstallment(inst); setIsAddModalOpen(true); }}
                    className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                    title={_t('تعديل', 'Edit', 'Bearbeiten')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(_t('تأكيد حذف هذا القسط؟', 'Confirm deletion?', 'Löschen bestätigen?'))) {
                        deleteFinanceInstallment(inst.id);
                      }
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title={_t('حذف', 'Delete', 'Löschen')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {inst.status !== 'completed' && (
                    <button 
                      onClick={() => setPayingId(inst.id)}
                      className="bg-primary hover:bg-primary-hover text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95 ml-1"
                    >
                      {_t('دفع القسط', 'Pay Rate', 'Zahlen')}
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Confirmation Inline Panel */}
              {payingId === inst.id && (
                <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm rounded-xl p-3 flex flex-col justify-center border border-primary/30 z-10 animate-in fade-in zoom-in-95">
                  <h4 className="font-bold text-center text-text-main text-xs mb-2">
                    {_t('تأكيد سداد القسط', 'Confirm Installment Payment', 'Ratenzahlung bestätigen')}
                    <span className="block text-sm text-primary font-black mt-0.5 font-sans">{inst.installmentAmount.toLocaleString()} EGP</span>
                  </h4>
                  <div className="mb-2 max-w-xs mx-auto w-full">
                    <label className="block text-[10px] text-text-muted mb-0.5">{_t('حساب السحب', 'Deduct from Account', 'Konto')}</label>
                    <select 
                      value={selectedAccountId || inst.accountId} 
                      onChange={e => setSelectedAccountId(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-lg text-xs font-bold focus:ring-1 focus:ring-primary outline-none"
                    >
                      {financeAccounts.filter(a => !a.deleted).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1.5 max-w-xs mx-auto w-full">
                    <button 
                      onClick={() => setPayingId(null)}
                      className="flex-1 py-1 bg-surface-hover hover:bg-surface-border text-text-main rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {_t('إلغاء', 'Cancel', 'Abbrechen')}
                    </button>
                    <button 
                      onClick={() => handleMarkPaid(inst)}
                      className="flex-1 py-1 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      {_t('تأكيد السداد', 'Confirm Payment', 'Zahlung bestätigen')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {activeInstallments.length === 0 && (
          <div className="text-center py-8 bg-surface border border-surface-border border-dashed rounded-xl">
            <CreditCard className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-text-main font-bold text-xs">{_t('لا توجد أقساط مسجلة', 'No installments', 'Keine Raten')}</p>
            <p className="text-text-muted text-[10px] mt-0.5">{_t('أضف أول قسط أو التزام مالي للمتابعة التلقائية.', 'Add your first installment plan for tracking.', 'Fügen Sie Ihre erste Rate hinzu.')}</p>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddFinanceInstallmentModal 
          onClose={() => setIsAddModalOpen(false)}
          existingInstallment={editingInstallment}
        />
      )}
    </div>
  );
};
