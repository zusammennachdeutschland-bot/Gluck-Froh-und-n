import React from 'react';
import { useApp } from '../../context/AppContext';
import { FileText, TrendingUp, TrendingDown } from 'lucide-react';

export const FinanceReports: React.FC = () => {
  const { _t, financeTransactions } = useApp();

  const totalIncome = financeTransactions.filter(tx => !tx.deleted && tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0);
  const totalExpense = financeTransactions.filter(tx => !tx.deleted && tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0);

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-text-main flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {_t('التقارير المالية', 'Financial Reports', 'Finanzberichte')}
        </h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-bold">{_t('إجمالي الدخل', 'Total Income', 'Gesamteinkommen')}</span>
          </div>
          <p className="text-xl font-black text-text-main">{totalIncome.toLocaleString()} EGP</p>
        </div>
        
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-rose-500 mb-2">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-bold">{_t('إجمالي المصروفات', 'Total Expenses', 'Gesamtausgaben')}</span>
          </div>
          <p className="text-xl font-black text-text-main">{totalExpense.toLocaleString()} EGP</p>
        </div>
      </div>
      
      <div className="bg-surface-hover border border-dashed border-surface-border rounded-xl p-6 text-center text-text-muted text-sm font-medium">
        {_t('سيتم إضافة المزيد من التقارير التفصيلية والرسوم البيانية قريباً.', 'More detailed reports and charts will be added soon.', 'Weitere detaillierte Berichte und Diagramme werden bald hinzugefügt.')}
      </div>
    </div>
  );
};
