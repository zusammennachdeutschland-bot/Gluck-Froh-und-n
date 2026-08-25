import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PieChart, ArrowRightLeft, Landmark, Repeat, CreditCard, Bell, ChevronLeft, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { FinanceDashboard } from './FinanceDashboard';
import { FinanceTransactions } from './FinanceTransactions';
import { FinanceRecurring } from './FinanceRecurring';
import { FinanceInstallments } from './FinanceInstallments';
import { FinanceInbox } from './FinanceInbox';
import { FinanceStudentPayments } from './FinanceStudentPayments';
import { FinanceReports } from './FinanceReports';

export const FinanceView: React.FC = () => {
  const { _t, payments, financeRecurring } = useApp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'student-payments' | 'recurring' | 'installments' | 'reports' | 'inbox'>('dashboard');

  const pendingPayments = payments.filter(p => p.status === 'not_paid' || p.status === 'partial');
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const dueRecurring = financeRecurring.filter(r => !r.deleted).filter(rec => {
    if (rec.frequency !== 'monthly') return false;
    if (!rec.lastPaidDate) return true;
    const lastPaid = new Date(rec.lastPaidDate);
    return lastPaid.getMonth() !== currentMonth || lastPaid.getFullYear() !== currentYear;
  });
  
  const inboxCount = pendingPayments.length + dueRecurring.length;

  const tabs = [
    { id: 'dashboard', label: _t('نظرة', 'Overview', 'Übersicht'), icon: PieChart },
    { id: 'transactions', label: _t('المعاملات', 'History', 'Historie'), icon: ArrowRightLeft },
    { id: 'student-payments', label: _t('الطلاب', 'Students', 'Schüler'), icon: Landmark },
    { id: 'recurring', label: _t('متكرر', 'Recurring', 'Wiederkehrend'), icon: Repeat },
    { id: 'installments', label: _t('أقساط', 'Installments', 'Raten'), icon: CreditCard },
    { id: 'reports', label: _t('التقارير', 'Reports', 'Berichte'), icon: FileText },
  ] as const;

  return (
    <div className="space-y-4 pb-20 md:pb-0 animate-in fade-in duration-300">
      
      {/* Top Navigation Row (HOD Style) */}
      <div className="flex w-full items-center justify-between sm:justify-center gap-1 bg-surface p-1 rounded-xl border border-surface-border shadow-2xs overflow-hidden mt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
                isActive 
                  ? 'bg-primary text-white px-2.5 sm:px-3 gap-1.5 shadow-xs font-black shrink-0' 
                  : 'w-8 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
              }`}
              title={tab.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {isActive && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{tab.label}</span>}
            </button>
          );
        })}

        <button 
          onClick={() => setActiveTab('inbox')}
          className={`h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
            activeTab === 'inbox' 
              ? 'bg-primary text-white px-2.5 sm:px-3 gap-1.5 shadow-xs font-black shrink-0' 
              : 'w-8 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
          }`}
          title={_t('صندوق الوارد المالي', 'Finance Inbox', 'Finanz-Posteingang')}
        >
          <div className="relative flex items-center justify-center">
            <Bell className="w-4 h-4 shrink-0" />
            {inboxCount > 0 && activeTab !== 'inbox' && (
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {inboxCount}
              </span>
            )}
          </div>
          {activeTab === 'inbox' && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{_t('الوارد', 'Inbox', 'Post')}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >
            {activeTab === 'dashboard' && <FinanceDashboard />}
            {activeTab === 'transactions' && <FinanceTransactions />}
            {activeTab === 'student-payments' && <FinanceStudentPayments />}
            {activeTab === 'recurring' && <FinanceRecurring />}
            {activeTab === 'installments' && <FinanceInstallments />}
            {activeTab === 'reports' && <FinanceReports />}
            {activeTab === 'inbox' && <FinanceInbox />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
