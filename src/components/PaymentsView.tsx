import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PaymentRecord, Student, Group } from '../types';
import { getStudentCyclePricing, calculateDuePaymentCycles, DuePaymentCycle } from '../utils/paymentUtils';
import { formatLocalDate } from '../utils/timeUtils';
import { buildWhatsAppUrl } from '../utils/phoneUtils';
import { 
  DollarSign, CheckCircle2, Clock, Send, Search, 
  Check, X, Sparkles, History, Calendar, AlertCircle, TrendingUp, ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const PaymentsView: React.FC = () => {
  const { 
    students, groups, lessons, payments, profile, 
    markCyclePaymentPaid, markCyclePaymentNotYet, t, _t 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'due' | 'history'>('due');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // Gains Summary Modal State
  const [selectedGainPeriod, setSelectedGainPeriod] = useState<'daily' | 'weekly' | 'monthly' | null>(null);

  // WhatsApp Parent Message Modal state
  const [selectedCycleForWhatsApp, setSelectedCycleForWhatsApp] = useState<DuePaymentCycle | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Flexible Prorate Modal State
  const [prorateModalItem, setProrateModalItem] = useState<DuePaymentCycle | null>(null);
  const [customProrateAmount, setCustomProrateAmount] = useState<number>(0);

  const currency = profile.currency || 'EGP';
  const todayStr = formatLocalDate();

  // Helper to format YYYY-MM-DD -> DD/MM/YYYY
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // --------------------------------------------------------------------------
  // GAIN COMPUTATIONS (DAILY, WEEKLY, MONTHLY)
  // --------------------------------------------------------------------------
  const { dailyPayments, weeklyPayments, monthlyPayments, dailyTotal, weeklyTotal, monthlyTotal } = useMemo(() => {
    const paidOnly = payments.filter(p => p.status === 'paid');
    const currentMonthStr = todayStr.substring(0, 7); // e.g., "2026-08"

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const daily = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      return d && d.startsWith(todayStr);
    });

    const weekly = paidOnly.filter(p => {
      const dStr = p.paidDate || p.dueDate;
      if (!dStr) return false;
      const d = new Date(dStr);
      return d >= sevenDaysAgo && d <= now;
    });

    const monthly = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      return d && d.startsWith(currentMonthStr);
    });

    const sumList = (list: PaymentRecord[]) => list.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    return {
      dailyPayments: daily,
      weeklyPayments: weekly,
      monthlyPayments: monthly,
      dailyTotal: sumList(daily),
      weeklyTotal: sumList(weekly),
      monthlyTotal: sumList(monthly)
    };
  }, [payments, todayStr]);

  // --------------------------------------------------------------------------
  // CALCULATE DUE PAYMENT CYCLES (ONLY STUDENTS WHO REACHED END OF CYCLE)
  // --------------------------------------------------------------------------
  const dueCycles = useMemo(() => {
    return calculateDuePaymentCycles(students, groups, lessons, payments);
  }, [students, groups, lessons, payments]);

  // Filtered Due Cycles based on search & group filter
  const filteredDueCycles = useMemo(() => {
    return dueCycles.filter(item => {
      const matchesSearch = item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.groupName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroupId === 'all' || item.groupId === selectedGroupId;
      return matchesSearch && matchesGroup;
    });
  }, [dueCycles, searchTerm, selectedGroupId]);

  // CALCULATE IN PROGRESS CYCLES FOR FLEXIBLE & PRORATED BILLING
  const inProgressCycles = useMemo(() => {
    const list: DuePaymentCycle[] = [];

    // Map studentId -> Set of billed lesson IDs for fast lookup
    const studentBilledLessons = new Map<string, Set<string>>();
    payments.forEach(p => {
      if (p.lessonIds && p.lessonIds.length > 0) {
        const stId = p.studentId;
        if (stId) {
          if (!studentBilledLessons.has(stId)) {
            studentBilledLessons.set(stId, new Set<string>());
          }
          p.lessonIds.forEach(id => studentBilledLessons.get(stId)!.add(id));
        }
      }
    });

    students.forEach(st => {
      // Find assigned group
      const grp = groups.find(g => g.id === st.groupId);

      // Determine cycle length (N) and package price (P) using canonical pricing utility
      const { cycleLength, amountDue } = getStudentCyclePricing(st, grp);
      const billedIds = studentBilledLessons.get(st.id) || new Set<string>();

      // Collect all completed attended lessons for this student that have NOT been billed yet (neither paid nor unpaid)
      const stCompletedLessons = lessons.filter(l => {
        if (l.status !== 'completed') return false;
        const matchesGroup = grp ? l.groupId === grp.id : false;
        const matchesStudent = l.studentId === st.id || l.studentName === st.name;
        if (!matchesGroup && !matchesStudent) return false;

        // Attendance check
        const att = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || 'present';
        if (att === 'absent') return false;

        // Check if this lesson ID has already been billed
        if (billedIds.has(l.id)) return false;

        return true;
      });

      // Sort chronologically
      stCompletedLessons.sort((a, b) => a.date.localeCompare(b.date));

      const hasUnpaidRec = payments.some(p => p.studentId === st.id && p.status !== 'paid');

      // Determine if we need to apply starting session number offset
      const hasPaidPayments = payments.some(p => p.studentId === st.id && p.status === 'paid');
      const startSess = grp?.startingSessionNumber || 1;
      const virtualOffset = !hasPaidPayments && startSess > 1 ? (startSess - 1) : 0;

      const totalCompletedCount = stCompletedLessons.length + virtualOffset;

      // If they have completed some lessons but less than cycle length, and they do NOT have an unpaid record already
      if (totalCompletedCount > 0 && totalCompletedCount < cycleLength && !hasUnpaidRec) {
        const lessonDates: string[] = [];
        for (let i = 1; i <= virtualOffset; i++) {
          lessonDates.push(`Offline (Session ${i}/${cycleLength})`);
        }
        stCompletedLessons.forEach(l => {
          lessonDates.push(`${formatDateDisplay(l.date)} (Session ${l.sessionNumber || 1}/${cycleLength})`);
        });

        const lessonIds = stCompletedLessons.map(l => l.id);

        // Prorated calculations based on actual completed lessons in the app
        const pricePerSession = amountDue / cycleLength;
        const proratedAmount = Math.round(pricePerSession * stCompletedLessons.length);

        list.push({
          id: `in_progress_cycle_${st.id}_${stCompletedLessons[0]?.id || Date.now()}_st_${st.name.replace(/\s+/g, '_')}`,
          studentId: st.id,
          studentName: st.name,
          groupId: st.groupId || grp?.id || '',
          groupName: grp?.name || 'Gruppe',
          cycleLength,
          amountDue: proratedAmount, // default to prorated
          lessonDates,
          lessonIds,
          status: 'not_yet',
          parentPhone: st.parentPhone || st.studentPhone || '',
        });
      }
    });

    return list;
  }, [students, groups, lessons, payments]);

  const filteredInProgressCycles = useMemo(() => {
    return inProgressCycles.filter(item => {
      const matchesSearch = item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.groupName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroupId === 'all' || item.groupId === selectedGroupId;
      return matchesSearch && matchesGroup;
    });
  }, [inProgressCycles, searchTerm, selectedGroupId]);

  // Paid Payment History
  const paidHistory = useMemo(() => {
    return payments
      .filter(p => p.status === 'paid')
      .filter(p => {
        const matchesSearch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              p.groupName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGroup = selectedGroupId === 'all' || p.groupId === selectedGroupId;
        return matchesSearch && matchesGroup;
      })
      .sort((a, b) => (b.paidDate || b.dueDate || '').localeCompare(a.paidDate || a.dueDate || ''));
  }, [payments, searchTerm, selectedGroupId]);

  // Total Due Calculation
  const totalAmountDue = useMemo(() => {
    return filteredDueCycles.reduce((sum, item) => {
      const existingRec = payments.find(p => p.id === item.existingPaymentRecordId);
      const paid = existingRec ? (existingRec.amountPaid || 0) : 0;
      const discount = existingRec ? (existingRec.discountAmount || 0) : 0;
      return sum + Math.max(0, item.amountDue - paid - discount);
    }, 0);
  }, [filteredDueCycles, payments]);

  // --------------------------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------------------------
  const handleMarkPaid = (item: DuePaymentCycle) => {
    markCyclePaymentPaid({
      studentId: item.studentId,
      studentName: item.studentName,
      groupId: item.groupId,
      groupName: item.groupName,
      amountDue: item.amountDue,
      amountPaid: item.amountDue,
      lessonDates: item.lessonDates,
      lessonIds: item.lessonIds,
      existingPaymentRecordId: item.existingPaymentRecordId,
      notes: `Bezahlt (${item.cycleLength}/${item.cycleLength} Lektionen)`
    });
  };

  const handleMarkNotYet = (item: DuePaymentCycle) => {
    markCyclePaymentNotYet({
      studentId: item.studentId,
      studentName: item.studentName,
      groupId: item.groupId,
      groupName: item.groupName,
      amountDue: item.amountDue,
      lessonDates: item.lessonDates,
      lessonIds: item.lessonIds,
      existingPaymentRecordId: item.existingPaymentRecordId
    });
  };

  // WhatsApp Parent Message Generator
  const generateWhatsAppMessage = (item: DuePaymentCycle) => {
    const datesFormatted = item.lessonDates.length > 0 
      ? item.lessonDates.map(d => `• ${d}`).join('\n')
      : t('auto_completed_lesson_dates');

    if (profile.language === 'en') {
      return `Dear Parent,

Notice of Course Cycle Completion & Payment Due 📚

Student: ${item.studentName}
Group: ${item.groupName}
Amount Due: ${item.amountDue} ${currency} (${item.cycleLength} lessons)

Completed Lesson Dates:
${datesFormatted}

Thank you for your cooperation!`;
    }

    if (profile.language === 'de') {
      return `Sehr geehrte Eltern,

Benachrichtigung über Kurssitzungsabschluss & Fälligkeit 📚

Schüler/in: ${item.studentName}
Gruppe: ${item.groupName}
Fälliger Betrag: ${item.amountDue} ${currency} (${item.cycleLength} Lektionen)

Abgeschlossene Termine:
${datesFormatted}

Vielen Dank für Ihre Zusammenarbeit!`;
    }

    return `السلام عليكم ورحمة الله وبركاته،

إشعار اكتمال الدورة الدراسية واستحقاق السداد 📚

الطالب/ة: ${item.studentName}
المجموعة: ${item.groupName}
المبلغ المستحق: ${item.amountDue} ${currency} (عدد ${item.cycleLength} حصص)

تاريخ الحصص المكتملة في هذه الدورة:
${datesFormatted}

شاكرين ومقدرين حسن تعاونكم معنا للتسديد.`;
  };

  const handleCopyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const handleOpenWhatsApp = (phone: string, msg: string) => {
    const url = buildWhatsAppUrl(phone, msg);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-3  font-sans max-w-4xl mx-auto">
      {/* FINANCIAL DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
        <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute -right-2 -top-2 w-12 h-12 bg-primary/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            {t('payments_total_collected') || 'Collected'}
          </span>
          <span className="text-lg font-black text-primary font-mono">{monthlyTotal} <span className="text-[10px] text-primary/70">{currency}</span></span>
        </div>
        <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute -right-2 -top-2 w-12 h-12 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            {t('payments_total_pending') || 'Pending'}
          </span>
          <span className="text-lg font-black text-amber-500 font-mono">{totalAmountDue} <span className="text-[10px] text-amber-500/70">{currency}</span></span>
        </div>
        <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute -right-2 -top-2 w-12 h-12 bg-red-500/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-red-500" />
            {t('payments_overdue')}
          </span>
          <span className="text-lg font-black text-red-500 font-mono">0 <span className="text-[10px] text-red-500/70">{currency}</span></span>
        </div>
        <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute -right-2 -top-2 w-12 h-12 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-indigo-500" />
            {t('payments_expected')}
          </span>
          <span className="text-lg font-black text-indigo-500 font-mono">{totalAmountDue + monthlyTotal} <span className="text-[10px] text-indigo-500/70">{currency}</span></span>
        </div>
      </div>

      {/* REVENUE OVERVIEW CARD */}
      <div className="bg-gradient-to-br from-primary/5 via-surface to-surface border border-primary-border/20 p-4 rounded-2xl shadow-sm mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <TrendingUp className="w-24 h-24 text-primary" />
        </div>
        
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">{t('payments_revenue_overview')}</h3>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 relative z-10">
          <button 
            type="button"
            onClick={() => setSelectedGainPeriod('daily')} 
            className="flex flex-col items-center p-3 bg-surface hover:bg-primary-soft transition-colors rounded-xl border border-surface-border cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">{t('payments_daily_gain_title') || 'Today'}</span>
            <span className="text-base sm:text-lg font-black text-text-main font-mono">{dailyTotal}</span>
            <div className="mt-1.5 flex items-center justify-center text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full"><TrendingUp className="w-2.5 h-2.5 mr-0.5"/> +0%</div>
          </button>
          
          <button 
            type="button"
            onClick={() => setSelectedGainPeriod('weekly')} 
            className="flex flex-col items-center p-3 bg-surface hover:bg-primary-soft transition-colors rounded-xl border border-surface-border cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">{t('payments_weekly_gain_title') || 'Weekly'}</span>
            <span className="text-base sm:text-lg font-black text-text-main font-mono">{weeklyTotal}</span>
            <div className="mt-1.5 flex items-center justify-center text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full"><TrendingUp className="w-2.5 h-2.5 mr-0.5"/> +0%</div>
          </button>

          <button 
            type="button"
            onClick={() => setSelectedGainPeriod('monthly')} 
            className="flex flex-col items-center p-3 bg-surface hover:bg-primary-soft transition-colors rounded-xl border border-surface-border cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">{t('payments_monthly_gain_title') || 'Monthly'}</span>
            <span className="text-base sm:text-lg font-black text-text-main font-mono">{monthlyTotal}</span>
            <div className="mt-1.5 flex items-center justify-center text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full"><TrendingUp className="w-2.5 h-2.5 mr-0.5"/> +0%</div>
          </button>
        </div>
      </div>

      {/* SEGMENT TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-surface-border pb-2">
        <div className="grid grid-cols-2 gap-2 flex-1 max-w-lg">
          <button
            onClick={() => setActiveTab('due')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'due'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-hover text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('payments_due_tab')} ({dueCycles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-hover text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('payments_history_tab')} ({paidHistory.length})</span>
          </button>
        </div>

        {/* GROUP FILTER */}
        {groups.length > 0 && (
          <select
            value={selectedGroupId}
            onChange={e => setSelectedGroupId(e.target.value)}
            className="px-3 py-1.5 bg-surface border border-surface-border rounded-xl text-xs font-bold focus:outline-none"
          >
            <option value="all">{t('students_all_groups')}</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* TAB 1: OFFENE ZAHLUNGEN (DUE NOW) */}
      {activeTab === 'due' && (
        <div className="space-y-3">
          {filteredDueCycles.length === 0 ? (
            <div className="py-12 sm:py-20 text-center flex flex-col items-center justify-center space-y-4">
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
                <div className="w-20 h-20 bg-primary-soft dark:bg-primary-soft text-primary rounded-3xl flex items-center justify-center mx-auto relative z-10 shadow-sm border border-primary-border/30 rotate-3">
                  <CheckCircle2 className="w-10 h-10 -rotate-3" />
                </div>
              </div>
              <div className="space-y-2 relative z-10">
                <h3 className="text-base sm:text-lg font-black text-text-main tracking-tight">
                  {t('payments_no_due_title') || t('payments_no_due')}
                </h3>
                <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
                  {t('payments_no_due_desc') || t('payments_no_due_sub')}
                </p>
              </div>
            </div>
          ) : (
            filteredDueCycles.map((item, idx) => (
              <div
                key={`${item.id}_${idx}`}
                className="bg-surface p-4 sm:p-5 rounded-xl border border-primary-border dark:border-primary-border shadow-xs space-y-3.5 relative overflow-hidden"
              >
                {/* TOP ROW: STUDENT INFO & AMOUNT DUE */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-surface-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-text-main">
                        {item.studentName}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-hover text-text-main text-xs font-bold">
                        {item.groupName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary text-[11px] font-black">
                        {t('payments_completed_cycle')}: {item.cycleLength} / {item.cycleLength} {t('payment_plan_lessons')}
                      </span>
                      {item.status === 'not_yet' && (
                        <span className="text-[11px] font-bold text-text-muted/70">
                          ({t('payments_pending_tag')} ⏳)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-extrabold text-text-muted/70 uppercase tracking-wider block">{t('payments_amount_due')}</span>
                    <div className="text-xl font-black text-primary dark:text-primary font-mono">
                      {item.amountDue} <span className="text-xs font-normal text-text-muted/70">{currency}</span>
                    </div>
                  </div>
                </div>

                {/* LESSON DATES INCLUDED IN THIS CYCLE */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-text-muted flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-text-muted/70" />
                    <span>{t('payments_completed_dates')}:</span>
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.lessonDates.length > 0 ? (
                      item.lessonDates.map((d, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-surface-hover text-slate-800 dark:text-slate-200 rounded-lg text-xs font-mono font-bold border border-surface-border dark:border-surface-border-soft"
                        >
                          🗓️ {d}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-text-muted/70 italic">
                        {item.cycleLength} {t('payment_plan_lessons')}
                      </span>
                    )}
                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* PAID BUTTON */}
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(item)}
                      className="px-4 py-2 bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>{t('payments_paid_btn')} (Paid)</span>
                    </button>

                    {/* NOT YET BUTTON */}
                    <button
                      type="button"
                      onClick={() => handleMarkNotYet(item)}
                      className="px-3.5 py-2 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-text-muted/70" />
                      <span>{t('payments_not_yet_btn')} (Not Yet)</span>
                    </button>
                  </div>

                  {/* WHATSAPP MESSAGE BUTTON */}
                  <button
                    type="button"
                    onClick={() => setSelectedCycleForWhatsApp(item)}
                    className="px-3 py-2 bg-primary-soft dark:bg-primary-soft hover:bg-primary-soft text-primary dark:text-primary text-xs font-bold rounded-xl transition-all border border-primary-border dark:border-primary-border cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-primary" />
                    <span>{t('payments_parent_notice')} (WhatsApp)</span>
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Section: Flexible & Prorated Billing */}
          <div className="pt-4 border-t border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-text-main flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>{t('auto_flexible_prorated_billing')}</span>
                </h3>
                <p className="text-[11px] text-text-muted mt-1">
                  {t('auto_you_can_end_the_current_cycle')}
                </p>
              </div>
            </div>

            {filteredInProgressCycles.length === 0 ? (
              <div className="bg-surface-hover/30 p-4 rounded-lg text-center border border-slate-100 dark:border-surface-border/50">
                <p className="text-xs text-text-muted/70 font-medium">
                  {t('auto_there_are_currently_no_student')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredInProgressCycles.map((item, idx) => (
                  <div key={`${item.id}_${idx}`} className="bg-surface border border-surface-border p-4 rounded-lg space-y-3 shadow-xs relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-black text-text-main">{item.studentName}</h4>
                        <span className="text-[10px] bg-surface-hover text-slate-600 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5">{item.groupName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-extrabold text-text-muted/70 uppercase tracking-wider block">{t('auto_prorated_amount')}</span>
                        <span className="text-sm font-bold text-primary dark:text-primary font-mono">{item.amountDue} {currency}</span>
                      </div>
                    </div>

                    <div className="bg-surface-hover/40 p-2.5 rounded-xl border border-slate-100 dark:border-surface-border/50 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('auto_attended_lessons')}</span>
                        <span className="font-bold text-primary dark:text-primary">{item.lessonDates.length} / {item.cycleLength} {t('auto_lessons')}</span>
                      </div>
                      <div className="text-[10px] text-text-muted/70 font-mono flex flex-wrap gap-1 mt-1">
                        {item.lessonDates.map((d, idx) => (
                          <span key={idx} className="bg-surface px-1.5 py-0.5 rounded border border-surface-border">🗓️ {d}</span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProrateModalItem(item);
                        setCustomProrateAmount(item.amountDue);
                      }}
                      className="w-full py-1.5 bg-primary-soft dark:bg-primary-soft/40 text-primary dark:text-primary hover:bg-primary-soft dark:hover:bg-primary-soft active:scale-95 transition-all text-xs font-black rounded-xl border border-primary-border/50 dark:border-primary-border flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>{t('auto_force_cycle_bill')}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ZAHLUNGSHISTORIE (PAID HISTORY) */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {paidHistory.length === 0 ? (
            <div className="bg-surface p-5 rounded-xl border border-surface-border text-center space-y-1">
              <p className="text-sm font-bold text-text-main">{t('payments_no_history')}</p>
              <p className="text-xs text-text-muted/70">{t('payments_history_sub')}</p>
            </div>
          ) : (
            paidHistory.map(p => (
              <div
                key={p.id}
                className="bg-surface p-4 rounded-lg border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-text-main">{p.studentName}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover text-slate-600 dark:text-slate-300">
                      {p.groupName}
                    </span>
                  </div>

                  {p.lessonDates && p.lessonDates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {p.lessonDates.map((d, i) => (
                        <span key={i} className="text-[10px] font-mono bg-surface-hover/60 px-2 py-0.5 rounded border border-surface-border/60 dark:border-surface-border-soft text-slate-600 dark:text-slate-300">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-primary dark:text-primary font-mono">
                    ✓ {p.amountPaid} {currency}
                  </span>
                  <span className="text-[10px] text-text-muted/70 block">
                    {t('payments_paid_on')}: {p.paidDate || p.dueDate}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* WHATSAPP RECEIPT / NOTICE MODAL */}
      {selectedCycleForWhatsApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
          <div className="bg-surface rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 max-w-md w-full p-4 border border-surface-border shadow-2xl space-y-4 animate-scale-up">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-text-main flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                <span>{t('payments_parent_notice')}</span>
              </h2>
              <button
                onClick={() => setSelectedCycleForWhatsApp(null)}
                className="p-1 rounded-xl text-text-muted/70 hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-primary-soft dark:bg-primary-soft rounded-lg border border-primary-border dark:border-primary-border text-text-main text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {generateWhatsAppMessage(selectedCycleForWhatsApp)}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleCopyMessage(generateWhatsAppMessage(selectedCycleForWhatsApp))}
                className="flex-1 py-2.5 bg-surface-hover text-text-main rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{copiedSuccess ? `${t('reports_copied')} ✓` : t('payments_copy_text')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleOpenWhatsApp(
                    selectedCycleForWhatsApp.parentPhone || '',
                    generateWhatsAppMessage(selectedCycleForWhatsApp)
                  );
                }}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{t('payments_open_whatsapp')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAIN SUMMARY MODAL */}
      {selectedGainPeriod && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
          <div className="bg-surface rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 max-w-lg w-full p-4 border border-surface-border shadow-2xl space-y-4 animate-scale-up">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-text-main">
                    {selectedGainPeriod === 'daily' && t('payments_daily_summary')}
                    {selectedGainPeriod === 'weekly' && t('payments_weekly_summary')}
                    {selectedGainPeriod === 'monthly' && t('payments_monthly_summary')}
                  </h2>
                  <p className="text-xs text-text-muted font-medium">
                    {t('payments_gain_summary_sub')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGainPeriod(null)}
                className="p-2 rounded-xl text-text-muted/70 hover:bg-surface-hover cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TOTAL STAT CARD */}
            <div className="bg-gradient-to-br from-primary to-primary-hover text-white p-5 rounded-lg shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-primary-soft uppercase tracking-wider block">{t('payments_total_gains')}</span>
                <div className="text-2xl font-black font-mono mt-0.5">
                  {selectedGainPeriod === 'daily' ? dailyTotal : selectedGainPeriod === 'weekly' ? weeklyTotal : monthlyTotal} <span className="text-sm font-normal text-primary-soft">{currency}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold text-primary-soft uppercase tracking-wider block">{t('payments_paid_cycles')}</span>
                <div className="text-2xl font-black font-mono mt-0.5">
                  {selectedGainPeriod === 'daily' ? dailyPayments.length : selectedGainPeriod === 'weekly' ? weeklyPayments.length : monthlyPayments.length}
                </div>
              </div>
            </div>

            {/* LIST OF PAYMENTS IN THIS PERIOD */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-text-muted/70">{t('payments_details_heading')}</h3>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {(selectedGainPeriod === 'daily' ? dailyPayments : selectedGainPeriod === 'weekly' ? weeklyPayments : monthlyPayments).length === 0 ? (
                  <div className="p-4 text-center text-xs text-text-muted/70 bg-surface-hover/50 rounded-lg border border-slate-100 dark:border-surface-border">
                    {t('payments_no_cycles_period')}
                  </div>
                ) : (
                  (selectedGainPeriod === 'daily' ? dailyPayments : selectedGainPeriod === 'weekly' ? weeklyPayments : monthlyPayments).map(p => (
                    <div
                      key={p.id}
                      className="p-3 bg-surface-hover/60 rounded-lg border border-surface-border/60 dark:border-surface-border-soft/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-text-main">{p.studentName}</div>
                        <div className="text-[10px] text-text-muted/70 mt-0.5">{p.groupName} • {p.paidDate || p.dueDate}</div>
                      </div>
                      <div className="font-black font-mono text-primary dark:text-primary text-sm">
                        +{p.amountPaid || p.amountDue} {currency}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedGainPeriod(null)}
              className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-black rounded-xl text-xs transition-all cursor-pointer shadow-xs"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {/* FORCE CYCLE / PRORATE MODAL */}
      {prorateModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
          <div className="bg-surface rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 max-w-md w-full p-4 border border-surface-border shadow-2xl space-y-4 animate-scale-up">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-text-main flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>{t('auto_force_end_current_cycle_bill')}</span>
              </h2>
              <button
                onClick={() => setProrateModalItem(null)}
                className="p-1 rounded-xl text-text-muted/70 hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Student info card */}
              <div className="p-4 bg-surface-hover/40 rounded-lg border border-slate-100 dark:border-surface-border/60 text-sm space-y-2">
                <div>
                  <span className="text-xs text-text-muted/70 font-bold block">{t('auto_student_name_15')}</span>
                  <span className="font-black text-text-main">{prorateModalItem.studentName}</span>
                </div>
                <div>
                  <span className="text-xs text-text-muted/70 font-bold block">{t('auto_group_16')}</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{prorateModalItem.groupName}</span>
                </div>
                <div>
                  <span className="text-xs text-text-muted/70 font-bold block">{t('auto_attendance_progress')}</span>
                  <span className="font-bold text-primary dark:text-primary">
                    {t('auto_attended_proratemodalitem_le')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-muted/70 font-bold block">{t('auto_completed_lesson_dates_17')}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {prorateModalItem.lessonDates.map((d, idx) => (
                      <span key={idx} className="bg-surface text-[10px] font-mono px-2 py-0.5 rounded border border-surface-border dark:border-surface-border-soft">🗓️ {d}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Amount editor */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-text-main">
                  {t('auto_adjust_prorated_due_amount')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={customProrateAmount}
                    onChange={(e) => setCustomProrateAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-12 pr-4 py-2.5 bg-background border border-surface-border dark:border-surface-border-soft rounded-xl text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-left"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted/70 font-mono">
                    {currency}
                  </div>
                </div>
                <p className="text-[10px] text-text-muted/70 leading-relaxed">
                  {t('auto_the_suggested_amount_is_calc')}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  markCyclePaymentNotYet({
                    studentId: prorateModalItem.studentId,
                    studentName: prorateModalItem.studentName,
                    groupId: prorateModalItem.groupId,
                    groupName: prorateModalItem.groupName,
                    amountDue: customProrateAmount,
                    lessonDates: prorateModalItem.lessonDates,
                    lessonIds: prorateModalItem.lessonIds
                  });
                  setProrateModalItem(null);
                  confetti({ particleCount: 30, spread: 40 });
                }}
                className="w-full py-2.5 bg-primary hover:bg-primary text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <span>{t('auto_mark_as_unpaid_invoice')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  markCyclePaymentPaid({
                    studentId: prorateModalItem.studentId,
                    studentName: prorateModalItem.studentName,
                    groupId: prorateModalItem.groupId,
                    groupName: prorateModalItem.groupName,
                    amountDue: customProrateAmount,
                    amountPaid: customProrateAmount,
                    lessonDates: prorateModalItem.lessonDates,
                    lessonIds: prorateModalItem.lessonIds,
                    notes: t('auto_flexible_prorated_payment_p')
                  });
                  setProrateModalItem(null);
                  confetti({ particleCount: 50, spread: 50 });
                }}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <span>{t('auto_mark_paid_now')}</span>
              </button>

              <button
                type="button"
                onClick={() => setProrateModalItem(null)}
                className="w-full py-2 bg-surface-hover text-text-main rounded-xl font-bold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span>{t('auto_cancel')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
