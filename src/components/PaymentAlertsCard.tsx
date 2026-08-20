import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import { ChevronRight, Wallet } from 'lucide-react';

export const PaymentAlertsCard: React.FC = () => {
  const { students, groups, lessons, payments, profile, language, setActiveTab, t } = useApp();

  // Helper for inline translations
  

  const dueCycles = useMemo(() => {
    return calculateDuePaymentCycles(students, groups, lessons, payments);
  }, [students, groups, lessons, payments]);

  const totalPendingAmount = useMemo(() => {
    return dueCycles.reduce((sum, item) => {
      const existingRec = payments.find(p => p.id === item.existingPaymentRecordId);
      const paid = existingRec ? (existingRec.amountPaid || 0) : 0;
      const discount = existingRec ? (existingRec.discountAmount || 0) : 0;
      const remaining = Math.max(0, item.amountDue - paid - discount);
      return sum + remaining;
    }, 0);
  }, [dueCycles, payments]);

  if (dueCycles.length === 0) {
    return null;
  }

  const currency = profile.currency || (t('auto_egp'));

  return (
    <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all font-sans">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary dark:text-primary flex items-center justify-center shrink-0 border border-primary-border/20">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-primary dark:text-primary truncate">
                {t('payments_pending')}
              </span>
              <span className="text-[10px] font-extrabold bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary px-1.5 py-0.2 rounded-full font-mono">
                {dueCycles.length}
              </span>
            </div>
            <p className="text-[11px] font-black text-primary dark:text-primary font-mono mt-0.5">
              {totalPendingAmount.toLocaleString()} {currency} {t('payments_total_pending')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('payments')}
          className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
        >
          <span>{t('open')}</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
