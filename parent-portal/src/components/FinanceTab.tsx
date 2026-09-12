import React from 'react';
import { StudentPortalData } from '../types';
import { CreditCard, CheckCircle2, AlertTriangle, Calendar, Clock, DollarSign, Sparkles } from 'lucide-react';

interface FinanceTabProps {
  packageInfo?: StudentPortalData['packageInfo'];
}

export const FinanceTab: React.FC<FinanceTabProps> = ({ packageInfo }) => {
  if (!packageInfo) {
    return (
      <div className="bg-surface border border-surface-border rounded-3xl p-8 text-center text-text-muted">
        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-500" />
        <h3 className="font-bold text-base text-text-main">لا توجد بيانات اشتراك مسجلة</h3>
        <p className="text-xs pt-1">يتم تحديث تفاصيل الباقة والاشتراكات الدورية بعد تأكيد المعلم.</p>
      </div>
    );
  }

  const current = packageInfo.currentSessionInCycle || 0;
  const total = packageInfo.totalCycleSessions || 8;
  const remaining = Math.max(0, total - current);
  const percentUsed = Math.min(100, Math.round((current / total) * 100));

  return (
    <div className="space-y-5">
      {/* Main Cycle Status Box */}
      <div className="bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              🇩🇪 باقة الحصص الحالية
            </span>
            <h3 className="text-lg sm:text-xl font-black text-text-main pt-1">
              {packageInfo.packageName}
            </h3>
          </div>

          <div>
            {packageInfo.isPaid ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم السداد بالكامل ✅</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4" />
                <span>في انتظار التجديد ⏳</span>
              </span>
            )}
          </div>
        </div>

        {/* Sessions Meter */}
        <div className="bg-background border border-surface-border rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-text-muted">الحصص المنجزة:</span>
            <span className="text-text-main">
              الحصة <strong className="text-blue-600 dark:text-blue-400 text-sm">{current}</strong> من <strong className="text-text-main">{total}</strong>
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface rounded-full h-3 overflow-hidden border border-surface-border">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-muted font-medium pt-1">
            <span>متبقي في الدورة الحالية: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{remaining} حصص</strong></span>
            <span>نسبة الاستهلاك: {percentUsed}%</span>
          </div>
        </div>

        {/* Extra Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {packageInfo.amount && (
            <div className="bg-background border border-surface-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="text-text-muted font-medium">قيمة الاشتراك:</div>
                <div className="font-black text-text-main text-sm">
                  {packageInfo.amount} {packageInfo.currency || 'ج.م'}
                </div>
              </div>
            </div>
          )}

          {packageInfo.renewalDate && (
            <div className="bg-background border border-surface-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="text-text-muted font-medium">تاريخ التجديد المتوقع:</div>
                <div className="font-black text-text-main text-sm">
                  {packageInfo.renewalDate}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Teacher Notes */}
        {packageInfo.notes && (
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl p-3 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="text-amber-900 dark:text-amber-200 font-medium">
              {packageInfo.notes}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
