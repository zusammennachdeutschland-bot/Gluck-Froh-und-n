import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  Plus, TrendingUp, Landmark
} from 'lucide-react';
import { AddFinanceAccountModal } from '../modals/AddFinanceAccountModal';

export const FinanceInvestmentsView: React.FC = () => {
  const {
    _t,
    financeAccounts
  } = useApp();

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  // General Investment Accounts
  const investmentAccounts = useMemo(() => {
    return financeAccounts.filter(a => !a.deleted && a.type === 'investment');
  }, [financeAccounts]);

  return (
    <div className="space-y-3.5 animate-in fade-in pb-12">
      {/* INVESTMENT ACCOUNTS SECTION */}
      <div className="pt-2 space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
              {_t('حسابات وشهادات الاستثمار', 'Investment Accounts', 'Investitionskonten')} ({investmentAccounts.length})
            </h3>
          </div>
          <button
            onClick={() => setIsAddAccountOpen(true)}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{_t('إضافة حساب استثمار', 'Add Account', 'Konto hinzufügen')}</span>
          </button>
        </div>

        {investmentAccounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {investmentAccounts.map(acc => (
              <div key={acc.id} className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-text-main">{acc.name}</h4>
                      <p className="text-[10px] text-text-muted">{acc.bankName || _t('حساب استثماري', 'Investment Account', 'Investitionskonto')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-text-main">{acc.currentBalance.toLocaleString()} {acc.currency}</span>
                    <span className="block text-[9px] text-emerald-500 font-bold">+{acc.annualInterestRate || 0}% / YR</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Modals */}
      {isAddAccountOpen && (
        <AddFinanceAccountModal
          onClose={() => setIsAddAccountOpen(false)}
          defaultType="investment"
        />
      )}
    </div>
  );
};
