import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Check, Clock, Info } from 'lucide-react';
import { FinanceRecurring as FinanceRecurringType } from '../../types';

export const FinanceInbox: React.FC = () => {
  const { _t, payments, students, groups, lessons, financeAccounts, financeRecurring, addFinanceTransaction, updatePayment, updateFinanceRecurring } = useApp();
  
  const pendingPayments = payments.filter(p => !p.deleted && (p.status === 'pending' || p.status === 'partial' || p.status === 'not_paid' || (p.status !== 'paid' && (p.amountDue - (p.amountPaid || 0)) > 0)));
  
  // Calculate recurring dues
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const dueRecurring = financeRecurring.filter(r => !r.deleted).filter(rec => {
    if (rec.frequency !== 'monthly') return false; // Focus on monthly for simplicity in inbox
    if (!rec.lastPaidDate) return true;
    const lastPaid = new Date(rec.lastPaidDate);
    return lastPaid.getMonth() !== currentMonth || lastPaid.getFullYear() !== currentYear;
  });

  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);
  const [selectedRecurringAccountId, setSelectedRecurringAccountId] = useState<string>('');

  // ---------------- PAYMENT LOGIC ---------------- //
  const handlePaidClick = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    if (financeAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(financeAccounts[0].id);
    }
  };

  const confirmPayment = () => {
    if (!selectedPaymentId || !selectedAccountId) return;
    const payment = payments.find(p => p.id === selectedPaymentId);
    if (!payment) return;

    const amountDue = payment.amountDue - payment.amountPaid;

    addFinanceTransaction({
      type: 'income',
      amount: amountDue,
      accountId: selectedAccountId,
      date: new Date().toISOString().split('T')[0],
      note: 'Student payment confirmation from Inbox',
      relatedStudentId: payment.studentId,
      relatedPaymentId: payment.id
    });

    updatePayment(payment.id, 'paid', payment.amountDue, payment.discountAmount || 0, payment.advanceAmount || 0, payment.refundAmount || 0, 'cash', 'Paid from Inbox', selectedAccountId);

    setSelectedPaymentId(null);
  };

  // ---------------- RECURRING LOGIC ---------------- //
  const handleRecurringPaidClick = (recId: string) => {
    setSelectedRecurringId(recId);
    const rec = financeRecurring.find(r => r.id === recId);
    if (rec?.accountId) {
      setSelectedRecurringAccountId(rec.accountId);
    } else if (financeAccounts.length > 0) {
      setSelectedRecurringAccountId(financeAccounts[0].id);
    }
  };

  const confirmRecurring = () => {
    if (!selectedRecurringId || !selectedRecurringAccountId) return;
    const rec = financeRecurring.find(r => r.id === selectedRecurringId);
    if (!rec) return;

    addFinanceTransaction({
      type: 'expense',
      amount: rec.amount,
      accountId: selectedRecurringAccountId,
      date: new Date().toISOString().split('T')[0],
      note: rec.name + ' - ' + _t('دفع متكرر', 'Recurring Payment', 'Wiederkehrende Zahlung')
    });

    updateFinanceRecurring(rec.id, {
      lastPaidDate: new Date().toISOString().split('T')[0]
    });

    setSelectedRecurringId(null);
  };

  if (pendingPayments.length === 0 && dueRecurring.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-surface-border rounded-2xl">
        <div className="w-16 h-16 bg-surface-hover rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-sm font-bold text-text-main">{_t('الصندوق فارغ', 'Inbox Empty', 'Posteingang leer')}</p>
        <p className="text-xs text-text-muted mt-1">{_t('كل شيء على ما يرام!', "You're all caught up!", 'Alles erledigt!')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingPayments.length > 0 && <h3 className="text-sm font-bold text-text-main px-1">{_t('دفع الطلاب', 'Student Payments', 'Schülerzahlungen')}</h3>}
      {pendingPayments.map(payment => {
        const student = students.find(s => s.id === payment.studentId);
        const group = groups.find(g => g.id === student?.groupId);
        const amountDue = payment.amountDue - payment.amountPaid;
        const lesson = lessons.find(l => l.id === payment.lessonId);
        const isConfirming = selectedPaymentId === payment.id;

        return (
          <div key={payment.id} className="bg-surface border border-surface-border rounded-xl p-3.5 shadow-2xs">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-sm font-bold text-text-main">{student?.name || 'Unknown Student'}</h4>
                <p className="text-xs text-text-muted">{group?.name} {lesson ? `- ${lesson.date}` : ''}</p>
              </div>
              <span className="text-sm font-black text-emerald-500">+{amountDue.toLocaleString()} EGP</span>
            </div>

            {isConfirming ? (
              <div className="bg-surface-hover p-3 rounded-xl border border-surface-border space-y-3">
                <p className="text-xs font-bold text-text-main">{_t('اختر حساب الإيداع:', 'Select deposit account:', 'Einzahlungskonto wählen:')}</p>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="" disabled>{_t('اختر الحساب', 'Select Account', 'Konto wählen')}</option>
                  {financeAccounts.filter(a => !a.deleted).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currentBalance.toLocaleString()} EGP)</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={confirmPayment} disabled={!selectedAccountId} className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50">
                    {_t('تأكيد الدفع', 'Confirm Payment', 'Zahlung bestätigen')}
                  </button>
                  <button onClick={() => setSelectedPaymentId(null)} className="flex-1 bg-surface border border-surface-border text-text-main text-xs font-bold py-2 rounded-lg">
                    {_t('إلغاء', 'Cancel', 'Abbrechen')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePaidClick(payment.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  {_t('تم الدفع', 'Paid', 'Bezahlt')}
                </button>
                <button 
                  onClick={() => {/* Visual only */}}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-surface-hover text-text-muted hover:text-text-main text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {_t('لاحقاً', 'Later', 'Später')}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {dueRecurring.length > 0 && <h3 className="text-sm font-bold text-text-main px-1 mt-4">{_t('مستحقات هذا الشهر', 'Due this month', 'Fällig diesen Monat')}</h3>}
      {dueRecurring.map(rec => {
        const isConfirming = selectedRecurringId === rec.id;
        return (
          <div key={rec.id} className="bg-surface border border-surface-border rounded-xl p-3.5 shadow-2xs">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-sm font-bold text-text-main">{rec.name}</h4>
                <p className="text-xs text-text-muted">{_t('دفع متكرر', 'Recurring', 'Wiederkehrend')}</p>
              </div>
              <span className="text-sm font-black text-rose-500">-{rec.amount.toLocaleString()} EGP</span>
            </div>

            {isConfirming ? (
              <div className="bg-surface-hover p-3 rounded-xl border border-surface-border space-y-3">
                <p className="text-xs font-bold text-text-main">{_t('حساب الخصم:', 'Debit account:', 'Abbuchungskonto:')}</p>
                <select
                  value={selectedRecurringAccountId}
                  onChange={(e) => setSelectedRecurringAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="" disabled>{_t('اختر الحساب', 'Select Account', 'Konto wählen')}</option>
                  {financeAccounts.filter(a => !a.deleted).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currentBalance.toLocaleString()} EGP)</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={confirmRecurring} disabled={!selectedRecurringAccountId} className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50">
                    {_t('تأكيد الدفع', 'Confirm Payment', 'Zahlung bestätigen')}
                  </button>
                  <button onClick={() => setSelectedRecurringId(null)} className="flex-1 bg-surface border border-surface-border text-text-main text-xs font-bold py-2 rounded-lg">
                    {_t('إلغاء', 'Cancel', 'Abbrechen')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleRecurringPaidClick(rec.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  {_t('دفع الآن', 'Pay Now', 'Jetzt bezahlen')}
                </button>
                <button 
                  className="flex-1 flex items-center justify-center gap-1.5 bg-surface-hover text-text-muted hover:text-text-main text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {_t('لاحقاً', 'Later', 'Später')}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
