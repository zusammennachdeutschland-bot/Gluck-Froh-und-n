import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Repeat, CalendarCheck, CheckCircle2, MoreVertical, Edit2, Trash2, CalendarDays, Wallet, AlertCircle, TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { FinanceRecurring as FinanceRecurringType } from '../../types';
import { AddFinanceRecurringModal } from './modals/AddFinanceRecurringModal';

export const FinanceRecurring: React.FC = () => {
  const { 
    _t, financeRecurring, financeAccounts, financeCategories, 
    addFinanceTransaction, updateFinanceRecurring, deleteFinanceRecurring 
  } = useApp();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<FinanceRecurringType | undefined>();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const activeRecurring = financeRecurring.filter(r => !r.deleted);

  const handleMarkPaid = (rec: FinanceRecurringType) => {
    const accId = selectedAccountId || rec.accountId || financeAccounts.find(a => !a.deleted)?.id;
    if (!accId) return;

    addFinanceTransaction({
      type: rec.type || 'expense',
      amount: rec.amount,
      accountId: accId,
      categoryId: rec.categoryId,
      date: new Date().toISOString().split('T')[0],
      note: rec.name + ' - ' + _t('دفع متكرر', 'Recurring Payment', 'Wiederkehrende Zahlung')
    });

    // Determine next due date based on frequency
    let nextDue = new Date(rec.nextDueDate || rec.startDate || new Date());
    if (rec.frequency === 'monthly') {
      nextDue.setMonth(nextDue.getMonth() + 1);
    } else if (rec.frequency === 'weekly') {
      nextDue.setDate(nextDue.getDate() + 7);
    } else if (rec.frequency === 'yearly') {
      nextDue.setFullYear(nextDue.getFullYear() + 1);
    }

    updateFinanceRecurring(rec.id, {
      lastPaidDate: new Date().toISOString().split('T')[0],
      nextDueDate: nextDue.toISOString().split('T')[0]
    });

    setPayingId(null);
  };

  const getStatus = (rec: FinanceRecurringType) => {
    if (!rec.isActive) return 'inactive';
    if (!rec.nextDueDate) return 'upcoming';
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(rec.nextDueDate);
    due.setHours(0,0,0,0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 5) return 'soon';
    return 'upcoming';
  };

  const calculateMonthlyEquivalent = (amount: number, freq: string) => {
    switch (freq) {
      case 'daily': return amount * 30;
      case 'weekly': return amount * 4;
      case 'yearly': return amount / 12;
      case 'monthly':
      default: return amount;
    }
  };

  const summary = useMemo(() => {
    let totalMonthlyCost = 0;
    let dueSoon = 0;
    let overdue = 0;

    activeRecurring.forEach(rec => {
      if (rec.type === 'expense' && rec.isActive !== false) {
        totalMonthlyCost += calculateMonthlyEquivalent(rec.amount, rec.frequency);
      }
      
      const status = getStatus(rec);
      if (status === 'overdue') overdue++;
      if (status === 'soon' || status === 'today') dueSoon++;
    });

    return { totalMonthlyCost, dueSoon, overdue };
  }, [activeRecurring]);

  const getStatusBadge = (status: string, diffDays: number) => {
    switch (status) {
      case 'overdue': 
        return (
          <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> {_t('متأخر', 'Overdue', 'Überfällig')} ({Math.abs(diffDays)}d)
          </span>
        );
      case 'today': 
        return (
          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-amber-500/20">
            <AlertCircle className="w-3 h-3" /> {_t('اليوم', 'Due Today', 'Fällig heute')}
          </span>
        );
      case 'soon': 
        return (
          <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-blue-500/20">
            <CalendarDays className="w-3 h-3" /> {_t('قريباً', 'Due in', 'Fällig in')} {diffDays}d
          </span>
        );
      case 'inactive': 
        return (
          <span className="bg-surface-hover text-text-muted px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-surface-border">
            {_t('غير نشط', 'Inactive', 'Inaktiv')}
          </span>
        );
      default: 
        return (
          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> {_t('مستقبلي', 'Upcoming', 'Anstehend')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-3 pb-8 animate-in fade-in">
      
      {/* Summary Header */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Repeat className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-wider text-text-main">
                {_t('الفواتير والمدفوعات المتكررة', 'Recurring Bills', 'Wiederkehrende Zahlungen')}
              </h3>
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-text-main tracking-tight font-sans">
                {summary.totalMonthlyCost.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-text-muted">
                EGP / {_t('شهرياً', 'Month', 'Monat')}
              </span>
            </div>
          </div>

          <button 
            onClick={() => {
              setEditingRecurring(undefined);
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs hover:bg-primary-hover cursor-pointer shrink-0 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{_t('إضافة فاتورة', 'Add Bill', 'Hinzufügen')}</span>
          </button>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-surface-border text-center">
          <div>
            <span className="text-[10px] text-text-muted block font-medium">{_t('نشط', 'Active', 'Aktive')}</span>
            <p className="font-black text-xs sm:text-sm text-text-main mt-0.5">{activeRecurring.filter(r => r.isActive !== false).length}</p>
          </div>
          <div>
            <span className="text-[10px] text-text-muted block font-medium">{_t('استحقاق قريب', 'Due Soon', 'Bald fällig')}</span>
            <p className="font-black text-xs sm:text-sm text-blue-500 mt-0.5">{summary.dueSoon}</p>
          </div>
          <div>
            <span className="text-[10px] text-text-muted block font-medium">{_t('متأخرات', 'Overdue', 'Überfällig')}</span>
            <p className={`font-black text-xs sm:text-sm mt-0.5 ${summary.overdue > 0 ? 'text-rose-500' : 'text-text-main'}`}>{summary.overdue}</p>
          </div>
        </div>
      </div>

      {/* Recurring Items List */}
      <div className="space-y-2">
        {activeRecurring.sort((a,b) => {
          const aStat = getStatus(a);
          const bStat = getStatus(b);
          const priority = { overdue: 0, today: 1, soon: 2, upcoming: 3, inactive: 4 };
          return (priority[aStat as keyof typeof priority] || 5) - (priority[bStat as keyof typeof priority] || 5);
        }).map(rec => {
          const cat = financeCategories.find(c => c.id === rec.categoryId);
          const acc = financeAccounts.find(a => a.id === rec.accountId);
          const status = getStatus(rec);
          
          let diffDays = 0;
          if (rec.nextDueDate) {
            const today = new Date(); today.setHours(0,0,0,0);
            const due = new Date(rec.nextDueDate); due.setHours(0,0,0,0);
            diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }

          return (
            <div key={rec.id} className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs relative hover:border-primary/40 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base bg-surface-hover shrink-0`}>
                    {cat?.icon || '🏷️'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-text-main flex items-center gap-1.5">
                      {rec.name}
                      {rec.notificationsEnabled && <Bell className="w-3 h-3 text-primary opacity-80" />}
                    </h4>
                    <p className="text-[10px] text-text-muted flex items-center gap-1">
                      <span className="capitalize">{rec.frequency}</span> • {cat?.name || _t('بدون تصنيف', 'No Category', 'Keine Kategorie')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <p className={`font-black text-sm sm:text-base font-sans ${rec.type === 'income' ? 'text-emerald-500' : 'text-text-main'}`}>
                    {rec.type === 'income' ? '+' : ''}{rec.amount.toLocaleString()} EGP
                  </p>
                  <div>
                    {getStatusBadge(status, diffDays)}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-surface-border pt-2">
                <div className="flex items-center gap-2 text-[10px] text-text-muted font-medium">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    <span>{rec.nextDueDate ? new Date(rec.nextDueDate).toLocaleDateString() : _t('غير محدد', 'Not set', 'Nicht festgelegt')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{acc?.name || _t('محذوف', 'Deleted', 'Gelöscht')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => { setEditingRecurring(rec); setIsAddModalOpen(true); }}
                    className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                    title={_t('تعديل', 'Edit', 'Bearbeiten')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(_t('تأكيد حذف هذه المعاملة؟', 'Confirm deletion?', 'Löschen bestätigen?'))) {
                        deleteFinanceRecurring(rec.id);
                      }
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title={_t('حذف', 'Delete', 'Löschen')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {status !== 'inactive' && (
                    <button 
                      onClick={() => setPayingId(rec.id)}
                      className="bg-primary hover:bg-primary-hover text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-2xs ml-1 cursor-pointer active:scale-95"
                    >
                      {_t('دفع الآن', 'Pay', 'Zahlen')}
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Confirmation Inline Panel */}
              {payingId === rec.id && (
                <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm rounded-xl p-3 flex flex-col justify-center border border-primary/30 z-10 animate-in fade-in zoom-in-95">
                  <h4 className="font-bold text-center text-text-main text-xs mb-2">
                    {_t('تأكيد دفع الفاتورة', 'Confirm Bill Payment', 'Zahlung bestätigen')}
                    <span className="block text-sm text-primary font-black mt-0.5 font-sans">{rec.amount.toLocaleString()} EGP</span>
                  </h4>
                  <div className="mb-2 max-w-xs mx-auto w-full">
                    <label className="block text-[10px] text-text-muted mb-0.5">{_t('حساب الدفع', 'Account', 'Konto')}</label>
                    <select 
                      value={selectedAccountId || rec.accountId} 
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
                      onClick={() => handleMarkPaid(rec)}
                      className="flex-1 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      {_t('تأكيد الدفع', 'Confirm', 'Bestätigen')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {activeRecurring.length === 0 && (
          <div className="text-center py-8 bg-surface border border-surface-border border-dashed rounded-xl">
            <Repeat className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-text-main font-bold text-xs">{_t('لا توجد فواتير أو التزامات متكررة', 'No recurring payments', 'Keine wiederkehrenden Zahlungen')}</p>
            <p className="text-text-muted text-[10px] mt-0.5">{_t('أضف اشتراكاتك أو الإيجار لتتبعها بانتظام.', 'Add subscriptions or bills for easy tracking.', 'Fügen Sie monatliche Rechnungen hinzu.')}</p>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddFinanceRecurringModal 
          onClose={() => setIsAddModalOpen(false)}
          existingRecurring={editingRecurring}
        />
      )}
    </div>
  );
};
