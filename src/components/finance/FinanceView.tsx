import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PieChart, ArrowRightLeft, Landmark, Repeat, CreditCard, Bell, ChevronLeft, FileText, Wallet, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDuePaymentCycles } from '../../utils/paymentUtils';

import { FinanceDashboard } from './FinanceDashboard';
import { FinanceAccounts } from './FinanceAccounts';
import { FinanceTransactions } from './FinanceTransactions';
import { FinanceRecurring } from './FinanceRecurring';
import { FinanceInstallments } from './FinanceInstallments';
import { FinanceStudentPayments } from './FinanceStudentPayments';

export const FinanceView: React.FC = () => {
  const { _t, payments, financeRecurring, financeInstallments, financeNotifications, addFinanceNotification, markAllFinanceNotificationsAsRead, updateFinanceAccount, addFinanceTransaction, financeAccounts, students, groups, lessons } = useApp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'transactions' | 'student-payments' | 'recurring' | 'installments'>('dashboard');

  const pendingPayments = payments.filter(p => p.status === 'not_paid' || p.status === 'partial');
  
  const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
  const dueCount = dueCycles.length;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const dueRecurring = financeRecurring.filter(r => !r.deleted).filter(rec => {
    if (rec.frequency !== 'monthly') return false;
    if (!rec.lastPaidDate) return true;
    const lastPaid = new Date(rec.lastPaidDate);
    return lastPaid.getMonth() !== currentMonth || lastPaid.getFullYear() !== currentYear;
  });

  const dueInstallments = financeInstallments.filter(inst => !inst.deleted).filter(inst => {
    if (inst.status !== 'active') return false;
    const paidCount = inst.paidInstallments ?? (Array.isArray((inst as any).payments) ? (inst as any).payments.length : 0);
    const totalCount = inst.totalInstallments ?? (inst as any).totalMonths ?? 1;
    if (paidCount >= totalCount) return false;
    const dueDateStr = inst.nextDueDate || inst.firstDueDate || (inst as any).startDate;
    if (!dueDateStr) return false;
    const nextDate = new Date(dueDateStr);
    const today = new Date();
    return nextDate <= today;
  });


  // Process Investments (Contributions & Returns)
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date();

    financeAccounts.filter(a => !a.deleted && a.type === 'investment').forEach(acc => {
      let needsUpdate = false;
      const updates: any = {};
      
      // Process recurring contributions
      if (acc.recurringContributionAmount && acc.nextContributionDate) {
        let nextDate = new Date(acc.nextContributionDate);
        let newContributions = acc.totalContributions || 0;
        let newBalance = acc.currentBalance;
        
        while (nextDate <= todayDate) {
          // Add transaction
          addFinanceTransaction({
            accountId: acc.id,
            amount: acc.recurringContributionAmount,
            type: 'adjustment',
            note: 'Recurring Contribution',
            date: nextDate.toISOString()
          });
          
          newContributions += acc.recurringContributionAmount;
          newBalance += acc.recurringContributionAmount;
          
          // Advance date
          if (acc.recurringContributionFrequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
          else if (acc.recurringContributionFrequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (acc.recurringContributionFrequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else nextDate.setDate(nextDate.getDate() + 1); // fallback
          
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          updates.totalContributions = newContributions;
          updates.currentBalance = newBalance;
          updates.nextContributionDate = nextDate.toISOString().split('T')[0];
        }
      }
      
      // Return Generation
      const rate = acc.annualInterestRate || 0;
      if (rate > 0 && acc.compoundingFrequency) {
        // We need a lastCompoundedDate, fallback to createdAt if not exists
        let lastDate = acc.lastCompoundedDate ? new Date(acc.lastCompoundedDate) : new Date(acc.createdAt);
        // Start from next day
        lastDate.setDate(lastDate.getDate() + 1);
        
        let newReturns = acc.accumulatedReturns || 0;
        let newBalance = updates.currentBalance !== undefined ? updates.currentBalance : acc.currentBalance;
        let returnsNeedsUpdate = false;
        
        while (lastDate <= todayDate) {
          // Calculate one period of return
          // Daily return = Rate / 365
          // Monthly return = Rate / 12
          // Yearly return = Rate
          let returnRate = 0;
          let shouldCalculate = false;
          
          if (acc.compoundingFrequency === 'daily') {
            returnRate = (rate / 100) / 365;
            shouldCalculate = true;
          } else if (acc.compoundingFrequency === 'monthly' && lastDate.getDate() === 1) {
            returnRate = (rate / 100) / 12;
            shouldCalculate = true;
          } else if (acc.compoundingFrequency === 'yearly' && lastDate.getMonth() === 0 && lastDate.getDate() === 1) {
            returnRate = (rate / 100);
            shouldCalculate = true;
          }

          if (shouldCalculate) {
            // Capital base depends on reinvestReturns
            const baseCapital = acc.reinvestReturns 
              ? (acc.initialCapital || acc.initialBalance || 0) + (updates.totalContributions ?? (acc.totalContributions || 0)) + newReturns
              : (acc.initialCapital || acc.initialBalance || 0) + (updates.totalContributions ?? (acc.totalContributions || 0));
              
            const dailyProfit = baseCapital * returnRate;
            
            if (dailyProfit > 0) {
              addFinanceTransaction({
                accountId: acc.id,
                amount: dailyProfit,
                type: 'investment_return',
                note: 'Investment Return',
                date: lastDate.toISOString()
              });
              
              newReturns += dailyProfit;
              if (acc.reinvestReturns) {
                newBalance += dailyProfit;
              }
              returnsNeedsUpdate = true;
            }
          }
          
          lastDate.setDate(lastDate.getDate() + 1);
        }
        
        if (returnsNeedsUpdate) {
          updates.accumulatedReturns = newReturns;
          updates.currentBalance = newBalance;
          needsUpdate = true;
        }
        
        // Always update lastCompoundedDate so we don't recalculate today
        updates.lastCompoundedDate = todayStr;
        needsUpdate = true;
      }
      // Simple daily compounding check (Proof of concept for the requirements)
      // In a real financial engine, this requires tracking last compounding date.
      // For now, if reinvestReturns is ON, and compounding is Daily, we can calculate today's return.
      // To prevent spamming transactions every single day for every account, the requirement said:
      // "النظام يجب أن يسجل الـ 100 EGP كإضافة فعلية لرأس المال في كل موعد استحقاق"
      // But for Returns it says: "Day 1 Contribution +500, Return +12. Day 2 Return +10"
      // Let's add a lastReturnDate to the account type temporarily or just use today for demo.
      
      if (needsUpdate && Object.keys(updates).length > 0) {
        updateFinanceAccount(acc.id, updates);
      }
    });
  }, [financeAccounts, updateFinanceAccount, addFinanceTransaction]);

  // Auto-generate notifications
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check due recurring
    dueRecurring.forEach(rec => {
      const existing = financeNotifications.find(n => n.relatedId === rec.id && !n.deleted && n.dueDate?.startsWith(today.substring(0,7))); // match year-month
      if (!existing) {
        addFinanceNotification({
          title: 'Payment Due Today',
          message: rec.name,
          amount: rec.amount,
          priority: 'critical',
          read: false,
          relatedId: rec.id,
          type: 'recurring',
          dueDate: today
        });
      }
    });

    // Check due installments
    dueInstallments.forEach(inst => {
      const existing = financeNotifications.find(n => n.relatedId === inst.id && !n.deleted && n.dueDate?.startsWith(today.substring(0,7)));
      if (!existing) {
        addFinanceNotification({
          title: 'Installment Due',
          message: inst.name,
          amount: inst.monthlyAmount,
          priority: 'warning',
          read: false,
          relatedId: inst.id,
          type: 'installment',
          dueDate: today
        });
      }
    });
  }, [dueRecurring, dueInstallments, financeNotifications, addFinanceNotification]);

  const unreadCount = financeNotifications.filter(n => !n.read && !n.deleted).length;

  const tabs = [
    { id: 'dashboard', label: _t('نظرة', 'Overview', 'Übersicht'), icon: PieChart },
    { id: 'accounts', label: _t('الحسابات', 'Accounts', 'Konten'), icon: Wallet },
    { id: 'transactions', label: _t('المعاملات', 'History', 'Historie'), icon: ArrowRightLeft },
    { id: 'student-payments', label: _t('الطلاب', 'Students', 'Schüler'), icon: Users, badge: dueCount > 0 ? dueCount : null },
    { id: 'recurring', label: _t('متكرر', 'Recurring', 'Wiederkehrend'), icon: Repeat },
    { id: 'installments', label: _t('أقساط', 'Installments', 'Raten'), icon: CreditCard },
  ] as const;

  return (
    <div className="space-y-3 max-w-7xl mx-auto pb-12">
      {/* Tabs Navigation (Same UI as HOD Hub) */}
      <div className="flex w-full items-center justify-between sm:justify-center gap-1 bg-surface p-1 rounded-xl border border-surface-border shadow-2xs overflow-hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
                isActive 
                  ? 'bg-primary text-white px-2.5 sm:px-3 gap-1.5 shadow-xs font-black shrink-0' 
                  : 'w-8 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
              }`}
              title={tab.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(tab as any).badge && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-sm z-10">
                  {(tab as any).badge}
                </span>
              )}
              {isActive && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{tab.label}</span>}
            </button>
          );
        })}
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
          >
            {activeTab === 'dashboard' && <FinanceDashboard onNavigateTab={(tab) => setActiveTab(tab as any)} />}
            {activeTab === 'accounts' && <FinanceAccounts />}
            {activeTab === 'transactions' && <FinanceTransactions />}
            {activeTab === 'student-payments' && <FinanceStudentPayments />}
            {activeTab === 'recurring' && <FinanceRecurring />}
            {activeTab === 'installments' && <FinanceInstallments />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
