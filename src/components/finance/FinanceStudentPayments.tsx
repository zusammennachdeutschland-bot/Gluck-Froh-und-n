import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentRecord, Student, Group, Lesson } from '../../types';
import { getStudentCyclePricing, calculateDuePaymentCycles, DuePaymentCycle } from '../../utils/paymentUtils';
import { formatLocalDate } from '../../utils/timeUtils';
import { buildWhatsAppUrl } from '../../utils/phoneUtils';
import { 
  DollarSign, CheckCircle2, Clock, Send, Search, 
  Check, X, Sparkles, History, Calendar, AlertCircle, TrendingUp, ChevronRight,
  Landmark, Wallet, CreditCard, Layers, BookOpen, ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const FinanceStudentPayments: React.FC = () => {
  const { 
    students, groups, lessons, payments, profile, 
    markCyclePaymentPaid, markCyclePaymentNotYet, updateLessonPaymentStatus,
    t, _t, financeAccounts
  } = useApp();

  const [activeTab, setActiveTab] = useState<'due' | 'history'>('due');
  const [dueSubTab, setDueSubTab] = useState<'cycles' | 'single_lessons'>('cycles');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [historyAccountId, setHistoryAccountId] = useState<string>('all');

  // Per-card selected receiving account mapping
  const [cardAccountMap, setCardAccountMap] = useState<Record<string, string>>({});

  // Set default account ID
  React.useEffect(() => {
    if (financeAccounts.length > 0 && !selectedAccountId) {
      const defaultAcc = financeAccounts.find(a => !a.deleted);
      if (defaultAcc) {
        setSelectedAccountId(defaultAcc.id);
      }
    }
  }, [financeAccounts, selectedAccountId]);

  // Helper to determine the target account for a cycle or lesson card
  const getCardAccountId = (itemId: string, groupId?: string) => {
    if (cardAccountMap[itemId]) return cardAccountMap[itemId];
    if (groupId) {
      const grp = groups.find(g => g.id === groupId);
      if (grp?.defaultFinanceAccountId && financeAccounts.some(a => a.id === grp.defaultFinanceAccountId && !a.deleted)) {
        return grp.defaultFinanceAccountId;
      }
    }
    return selectedAccountId || financeAccounts.find(a => !a.deleted)?.id || 'acc_main_cash';
  };

  // Gains Summary Modal State
  const [selectedGainPeriod, setSelectedGainPeriod] = useState<'daily' | 'weekly' | 'monthly' | null>(null);

  // WhatsApp Parent Message Modal state
  const [selectedCycleForWhatsApp, setSelectedCycleForWhatsApp] = useState<DuePaymentCycle | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Flexible Prorate Modal State
  const [prorateModalItem, setProrateModalItem] = useState<DuePaymentCycle | null>(null);
  const [customProrateAmount, setCustomProrateAmount] = useState<number>(0);
  const [prorateAccountId, setProrateAccountId] = useState<string>('');

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
      const sTerm = (searchTerm || '').toLowerCase();
      const matchesSearch = !sTerm ||
                            (item.studentName || '').toLowerCase().includes(sTerm) ||
                            (item.groupName || '').toLowerCase().includes(sTerm);
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
      const sTerm = (searchTerm || '').toLowerCase();
      const matchesSearch = !sTerm ||
                            (item.studentName || '').toLowerCase().includes(sTerm) ||
                            (item.groupName || '').toLowerCase().includes(sTerm);
      const matchesGroup = selectedGroupId === 'all' || item.groupId === selectedGroupId;
      return matchesSearch && matchesGroup;
    });
  }, [inProgressCycles, searchTerm, selectedGroupId]);

  // Paid Payment History
  const paidHistory = useMemo(() => {
    return payments
      .filter(p => p.status === 'paid')
      .filter(p => {
        const sTerm = (searchTerm || '').toLowerCase();
        const matchesSearch = !sTerm ||
                              (p.studentName || '').toLowerCase().includes(sTerm) ||
                              (p.groupName || '').toLowerCase().includes(sTerm);
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

  // Total Overdue Calculation (cycles marked as 'not_yet' or overdue)
  const overdueTotal = useMemo(() => {
    return filteredDueCycles
      .filter(item => item.status === 'not_yet')
      .reduce((sum, item) => sum + item.amountDue, 0);
  }, [filteredDueCycles]);

  // Unpaid Individual Lessons calculation
  const unpaidSingleLessons = useMemo(() => {
    return lessons.filter(l => {
      if (l.deleted) return false;
      const isUnpaid = l.paymentStatus === 'pending' || l.paymentStatus === 'not_paid' || l.paymentStatus === 'partial';
      const due = l.amountDue || 200;
      const paid = l.amountPaid || 0;
      const hasRemaining = (due - paid) > 0;
      const matchesSearch = !searchTerm || 
        (l.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.groupName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroupId === 'all' || l.groupId === selectedGroupId;
      return hasRemaining && (l.status === 'completed' || isUnpaid) && matchesSearch && matchesGroup;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [lessons, searchTerm, selectedGroupId]);

  const filteredPaidHistory = useMemo(() => {
    return paidHistory.filter(p => {
      const matchesAcc = historyAccountId === 'all' || p.financeAccountId === historyAccountId;
      return matchesAcc;
    });
  }, [paidHistory, historyAccountId]);

  // --------------------------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------------------------
  const handleMarkPaid = (item: DuePaymentCycle) => {
    const targetAccountId = getCardAccountId(item.id, item.groupId);
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
      notes: `سداد اشتراك (${item.cycleLength}/${item.cycleLength} حصص)`,
      accountId: targetAccountId
    });
    confetti({ particleCount: 50, spread: 60 });
  };

  const handleMarkSingleLessonPaid = (lesson: Lesson) => {
    const targetAccId = getCardAccountId(`lesson_${lesson.id}`, lesson.groupId);
    const due = lesson.amountDue || 200;
    updateLessonPaymentStatus(lesson.id, 'paid', due, targetAccId);
    confetti({ particleCount: 50, spread: 60 });
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
    <div className="space-y-3 font-sans w-full">
      {/* FINANCIAL DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-0.5">
        <div className="bg-surface hover:bg-surface-hover transition-colors p-2.5 sm:p-3 rounded-xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-2xs">
          <div className="absolute -right-2 -top-2 w-10 h-10 bg-primary/5 rounded-full blur-lg pointer-events-none" />
          <span className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            {t('payments_total_collected') || 'Collected'}
          </span>
          <span className="text-base font-black text-primary font-mono">{monthlyTotal} <span className="text-[10px] text-primary/70">{currency}</span></span>
        </div>
        <div className="bg-surface hover:bg-surface-hover transition-colors p-2.5 sm:p-3 rounded-xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-2xs">
          <div className="absolute -right-2 -top-2 w-10 h-10 bg-amber-500/5 rounded-full blur-lg pointer-events-none" />
          <span className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            {t('payments_total_pending') || 'Pending'}
          </span>
          <span className="text-base font-black text-amber-500 font-mono">{totalAmountDue} <span className="text-[10px] text-amber-500/70">{currency}</span></span>
        </div>
        <div className="bg-surface hover:bg-surface-hover transition-colors p-2.5 sm:p-3 rounded-xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-2xs">
          <div className="absolute -right-2 -top-2 w-10 h-10 bg-primary-soft rounded-full blur-lg pointer-events-none" />
          <span className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-primary" />
            {t('payments_overdue')}
          </span>
          <span className="text-base font-black text-text-main font-mono">{overdueTotal} <span className="text-[10px] text-text-muted/70">{currency}</span></span>
        </div>
        <div className="bg-surface hover:bg-surface-hover transition-colors p-2.5 sm:p-3 rounded-xl border border-surface-border flex flex-col justify-center relative overflow-hidden shadow-2xs">
          <div className="absolute -right-2 -top-2 w-10 h-10 bg-primary/5 rounded-full blur-lg pointer-events-none" />
          <span className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-primary" />
            {t('payments_expected')}
          </span>
          <span className="text-base font-black text-text-main font-mono">{totalAmountDue + monthlyTotal} <span className="text-[10px] text-text-muted/70">{currency}</span></span>
        </div>
      </div>

      {/* REVENUE OVERVIEW CARD */}
      <div className="bg-gradient-to-br from-primary/5 via-surface to-surface border border-primary-border/20 p-2.5 sm:p-3 rounded-xl shadow-2xs mb-2.5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-primary/10 rounded-md">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">{t('payments_revenue_overview')}</h3>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-1.5 relative z-10">
          <button 
            type="button"
            onClick={() => setSelectedGainPeriod('daily')} 
            className="flex flex-col items-center p-2 bg-surface hover:bg-primary-soft transition-colors rounded-lg border border-surface-border cursor-pointer group"
          >
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5 group-hover:text-primary transition-colors">{t('payments_daily_gain_title') || 'Today'}</span>
            <span className="text-sm sm:text-base font-black text-text-main font-mono">{dailyTotal}</span>
            <div className="mt-0.5 flex items-center justify-center text-[8px] text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.2 rounded-full"><TrendingUp className="w-2 h-2 mr-0.5"/> +0%</div>
          </button>
          
          <button 
            type="button"
            onClick={() => setSelectedGainPeriod('weekly')} 
            className="flex flex-col items-center p-2 bg-surface hover:bg-primary-soft transition-colors rounded-lg border border-surface-border cursor-pointer group"
          >
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5 group-hover:text-primary transition-colors">{t('payments_weekly_gain_title') || 'Weekly'}</span>
            <span className="text-sm sm:text-base font-black text-text-main font-mono">{weeklyTotal}</span>
            <div className="mt-0.5 flex items-center justify-center text-[8px] text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.2 rounded-full"><TrendingUp className="w-2 h-2 mr-0.5"/> +0%</div>
          </button>

          <button 
            type="button"
            onClick={() => setSelectedGainPeriod('monthly')} 
            className="flex flex-col items-center p-2 bg-surface hover:bg-primary-soft transition-colors rounded-lg border border-surface-border cursor-pointer group"
          >
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5 group-hover:text-primary transition-colors">{t('payments_monthly_gain_title') || 'Monthly'}</span>
            <span className="text-sm sm:text-base font-black text-text-main font-mono">{monthlyTotal}</span>
            <div className="mt-0.5 flex items-center justify-center text-[8px] text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.2 rounded-full"><TrendingUp className="w-2 h-2 mr-0.5"/> +0%</div>
          </button>
        </div>
      </div>

      {/* SEGMENT TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 border-b border-surface-border pb-1.5">
        <div className="grid grid-cols-2 gap-1.5 flex-1 max-w-lg">
          <button
            onClick={() => setActiveTab('due')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'due'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-hover text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('payments_due_tab')} ({dueCycles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-hover text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('payments_history_tab')} ({paidHistory.length})</span>
          </button>
        </div>

        {/* GROUP & ACCOUNT FILTERS */}
        <div className="flex items-center gap-2">
          {financeAccounts.length > 0 && (
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="px-2.5 py-1 bg-surface border border-surface-border rounded-lg text-xs font-bold focus:outline-none max-w-[120px]"
            >
              {financeAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {groups.length > 0 && (
            <select
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              className="px-2.5 py-1 bg-surface border border-surface-border rounded-lg text-xs font-bold focus:outline-none max-w-[120px]"
            >
              <option value="all">{t('students_all_groups')}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: OFFENE ZAHLUNGEN (DUE NOW) */}
      {activeTab === 'due' && (
        <div className="space-y-3.5">
          {/* Sub-tab navigation: Cycles vs Single Lessons */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-hover/70 dark:bg-surface-hover/40 rounded-xl border border-surface-border w-fit max-w-full overflow-x-auto">
            <button
              type="button"
              onClick={() => setDueSubTab('cycles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                dueSubTab === 'cycles'
                  ? 'bg-surface text-primary shadow-xs border border-surface-border/80'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{_t('دورات الاشتراكات المكتملة', 'Completed Cycles', 'Abgeschlossene Zyklen')}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${dueSubTab === 'cycles' ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}>
                {filteredDueCycles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDueSubTab('single_lessons')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                dueSubTab === 'single_lessons'
                  ? 'bg-surface text-primary shadow-xs border border-surface-border/80'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{_t('الحصص الفردية والمستحقة', 'Individual Due Lessons', 'Fällige Einzellektionen')}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${dueSubTab === 'single_lessons' ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}>
                {unpaidSingleLessons.length}
              </span>
            </button>
          </div>

          {/* SUB-VIEW 1: DUE CYCLES */}
          {dueSubTab === 'cycles' && (
            <div className="space-y-3">
              {filteredDueCycles.length === 0 ? (
                <div className="py-8 sm:py-14 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="relative mb-1">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl pointer-events-none" />
                    <div className="w-14 h-14 bg-primary-soft dark:bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto relative z-10 shadow-2xs border border-primary-border/30 rotate-2">
                      <CheckCircle2 className="w-7 h-7 -rotate-2" />
                    </div>
                  </div>
                  <div className="space-y-1 relative z-10">
                    <h3 className="text-sm sm:text-base font-black text-text-main tracking-tight">
                      {t('payments_no_due_title') || t('payments_no_due')}
                    </h3>
                    <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                      {t('payments_no_due_desc') || t('payments_no_due_sub')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {filteredDueCycles.map((item, idx) => (
                    <div
                      key={`${item.id}_${idx}`}
                      className="bg-surface p-3.5 sm:p-4 rounded-xl border border-primary-border/70 dark:border-primary-border/50 shadow-2xs space-y-3 relative overflow-hidden flex flex-col justify-between"
                    >
                      {/* TOP ROW: STUDENT INFO & AMOUNT DUE */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-surface-border pb-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-black text-text-main">
                              {item.studentName}
                            </h3>
                            <span className="px-2 py-0.2 rounded-full bg-surface-hover text-text-main text-[10px] font-bold">
                              {item.groupName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded-md bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary text-[10px] font-black">
                              {t('payments_completed_cycle')}: {item.cycleLength} / {item.cycleLength} {t('payment_plan_lessons')}
                            </span>
                            {item.status === 'not_yet' && (
                              <span className="text-[10px] font-bold text-text-muted/70">
                                ({t('payments_pending_tag')} ⏳)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[9px] font-extrabold text-text-muted/70 uppercase tracking-wider block">{t('payments_amount_due')}</span>
                          <div className="text-base font-black text-primary dark:text-primary font-mono">
                            {item.amountDue} <span className="text-[10px] font-normal text-text-muted/70">{currency}</span>
                          </div>
                        </div>
                      </div>

                      {/* LESSON DATES INCLUDED IN THIS CYCLE */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-text-muted/70" />
                          <span>{t('payments_completed_dates')}:</span>
                        </span>

                        <div className="flex flex-wrap items-center gap-1">
                          {item.lessonDates.length > 0 ? (
                            item.lessonDates.map((d, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-surface-hover text-slate-800 dark:text-slate-200 rounded text-[10px] font-mono font-bold border border-surface-border dark:border-surface-border-soft"
                              >
                                🗓️ {d}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-text-muted/70 italic">
                              {item.cycleLength} {t('payment_plan_lessons')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* RECEIVING ACCOUNT SELECTOR */}
                      {financeAccounts.length > 0 && (
                        <div className="bg-surface-hover/70 dark:bg-surface-hover/30 px-2.5 py-1.5 rounded-lg border border-surface-border flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                            <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-bold text-[11px] text-text-main">
                              {_t('حساب الإيداع:', 'Deposit Account:', 'Einzahlen auf:')}
                            </span>
                          </div>
                          <select
                            value={getCardAccountId(item.id, item.groupId)}
                            onChange={(e) => setCardAccountMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="px-2 py-1 bg-surface border border-surface-border rounded-md text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary flex-1 max-w-[200px] cursor-pointer"
                          >
                            {financeAccounts.filter(a => !a.deleted).map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.type === 'cash' ? '💵 ' : acc.type === 'wallet' ? '📱 ' : acc.type === 'bank' ? '🏦 ' : '💳 '}
                                {acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency || currency})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* BOTTOM ACTION BUTTONS */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {/* PAID BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(item)}
                            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-black rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>{t('payments_paid_btn')}</span>
                          </button>

                          {/* NOT YET BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleMarkNotYet(item)}
                            className="px-2.5 py-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3 text-text-muted/70" />
                            <span>{t('payments_not_yet_btn')}</span>
                          </button>
                        </div>

                        {/* WHATSAPP MESSAGE BUTTON */}
                        <button
                          type="button"
                          onClick={() => setSelectedCycleForWhatsApp(item)}
                          className="px-3 py-1.5 bg-primary-soft dark:bg-primary-soft hover:bg-primary-soft/80 text-primary dark:text-primary text-xs font-bold rounded-lg transition-all border border-primary-border dark:border-primary-border cursor-pointer flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5 text-primary" />
                          <span>{t('payments_parent_notice')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 2: INDIVIDUAL DUE LESSONS */}
          {dueSubTab === 'single_lessons' && (
            <div className="space-y-3">
              {unpaidSingleLessons.length === 0 ? (
                <div className="py-8 sm:py-14 text-center flex flex-col items-center justify-center space-y-3 bg-surface border border-surface-border rounded-xl">
                  <div className="w-12 h-12 bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-black text-text-main">
                      {_t('لا توجد حصص فردية مستحقة السداد', 'No individual lessons due for payment', 'Keine fälligen Einzellektionen')}
                    </h3>
                    <p className="text-xs text-text-muted max-w-md mx-auto">
                      {_t('جميع الحصص الفردية مسددة بالكامل أو مضافة للدورات.', 'All individual lessons are fully settled or tracked in cycles.', 'Alle Einzellektionen sind bezahlt.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {unpaidSingleLessons.map((lesson) => {
                    const due = lesson.amountDue || 200;
                    const paid = lesson.amountPaid || 0;
                    const remaining = Math.max(0, due - paid);
                    const cardKey = `lesson_${lesson.id}`;

                    return (
                      <div
                        key={lesson.id}
                        className="bg-surface p-3.5 sm:p-4 rounded-xl border border-surface-border shadow-2xs space-y-3 relative overflow-hidden flex flex-col justify-between"
                      >
                        {/* TOP ROW: LESSON INFO & DUE AMOUNT */}
                        <div className="flex items-start justify-between gap-2 border-b border-surface-border pb-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-black text-text-main">
                                {lesson.studentName || lesson.groupName || lesson.title}
                              </h4>
                              {lesson.isQuickLesson && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9.5px] font-black">
                                  ⚡ {_t('حصة سريعة', 'Quick Lesson', 'Schnelle Lektion')}
                                </span>
                              )}
                              {lesson.groupName && (
                                <span className="px-2 py-0.2 rounded-full bg-surface-hover text-text-main text-[10px] font-bold">
                                  {lesson.groupName}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-text-muted font-medium">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-primary" />
                                {formatDateDisplay(lesson.date)}
                              </span>
                              {lesson.time && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-primary" />
                                  {lesson.time}
                                </span>
                              )}
                              <span className="px-1.5 py-0.2 rounded bg-surface-hover text-[10px] font-bold">
                                {lesson.type === 'online' ? '🌐 أونلاين' : '📍 حضوري'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[9px] font-extrabold text-text-muted/70 uppercase tracking-wider block">
                              {_t('المتبقي للسداد', 'Remaining Due', 'Restbetrag')}
                            </span>
                            <div className="text-base font-black text-primary font-mono">
                              {remaining} <span className="text-[10px] font-normal text-text-muted/70">{currency}</span>
                            </div>
                          </div>
                        </div>

                        {/* RECEIVING ACCOUNT SELECTOR */}
                        {financeAccounts.length > 0 && (
                          <div className="bg-surface-hover/70 dark:bg-surface-hover/30 px-2.5 py-1.5 rounded-lg border border-surface-border flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                              <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-bold text-[11px] text-text-main">
                                {_t('حساب الإيداع:', 'Deposit Account:', 'Einzahlen auf:')}
                              </span>
                            </div>
                            <select
                              value={getCardAccountId(cardKey, lesson.groupId)}
                              onChange={(e) => setCardAccountMap(prev => ({ ...prev, [cardKey]: e.target.value }))}
                              className="px-2 py-1 bg-surface border border-surface-border rounded-md text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary flex-1 max-w-[200px] cursor-pointer"
                            >
                              {financeAccounts.filter(a => !a.deleted).map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.type === 'cash' ? '💵 ' : acc.type === 'wallet' ? '📱 ' : acc.type === 'bank' ? '🏦 ' : '💳 '}
                                  {acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency || currency})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* ACTION BUTTON */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-text-muted font-medium">
                            {_t('إجمالي الحصة:', 'Lesson Total:', 'Gesamt:')} {due} {currency}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleMarkSingleLessonPaid(lesson)}
                            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-black rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>{_t('سداد الحصة في الحساب المختار', 'Mark Lesson as Paid', 'Als bezahlt markieren')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                        setProrateAccountId(getCardAccountId(item.id, item.groupId));
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
          {/* History Account Filter */}
          <div className="flex items-center justify-between gap-2 p-2 bg-surface rounded-xl border border-surface-border">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
              <Landmark className="w-3.5 h-3.5 text-primary" />
              <span>{_t('تصفية حسب الخزينة / الحساب:', 'Filter by Account:', 'Nach Konto filtern:')}</span>
            </div>
            <select
              value={historyAccountId}
              onChange={(e) => setHistoryAccountId(e.target.value)}
              className="px-2.5 py-1 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">{_t('جميع الحسابات والتحصيلات', 'All Accounts', 'Alle Konten')}</option>
              {financeAccounts.filter(a => !a.deleted).map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.type === 'cash' ? '💵 ' : acc.type === 'wallet' ? '📱 ' : acc.type === 'bank' ? '🏦 ' : '💳 '}
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {filteredPaidHistory.length === 0 ? (
            <div className="bg-surface p-5 rounded-xl border border-surface-border text-center space-y-1">
              <p className="text-sm font-bold text-text-main">{t('payments_no_history')}</p>
              <p className="text-xs text-text-muted/70">{t('payments_history_sub')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredPaidHistory.map(p => {
                const targetAcc = financeAccounts.find(a => a.id === p.financeAccountId);

                return (
                  <div
                    key={p.id}
                    className="bg-surface p-4 rounded-xl border border-surface-border flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs transition-shadow"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black text-text-main truncate">{p.studentName}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover text-slate-600 dark:text-slate-300 shrink-0">
                          {p.groupName}
                        </span>
                      </div>

                      {p.lessonDates && p.lessonDates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {p.lessonDates.map((d, i) => (
                            <span key={i} className="text-[10px] font-mono bg-surface-hover/60 px-2 py-0.5 rounded border border-surface-border/60 dark:border-surface-border-soft text-slate-600 dark:text-slate-300">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Account Paid Into Badge */}
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted pt-1">
                        <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-bold text-text-main">
                          {_t('أودع في:', 'Deposited into:', 'Eingezahlt in:')}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-primary-soft dark:bg-primary-soft text-primary font-bold text-[10.5px]">
                          {targetAcc?.name || _t('الخزينة الرئيسية (كاش)', 'Main Cash', 'Hauptkasse')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-surface-border/50">
                      <span className="text-[10px] text-text-muted/70">
                        {t('payments_paid_on')}: {p.paidDate || p.dueDate}
                      </span>
                      <span className="text-xs font-black text-primary dark:text-primary font-mono">
                        ✓ {p.amountPaid} {currency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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

              {/* Account selection in Prorate Modal */}
              {financeAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-text-main flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-primary" />
                    <span>{_t('حساب الإيداع والتحصيل:', 'Deposit Account:', 'Einzahlungskonto:')}</span>
                  </label>
                  <select
                    value={prorateAccountId || selectedAccountId}
                    onChange={(e) => setProrateAccountId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {financeAccounts.filter(a => !a.deleted).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.type === 'cash' ? '💵 ' : acc.type === 'wallet' ? '📱 ' : acc.type === 'bank' ? '🏦 ' : '💳 '}
                        {acc.name} ({acc.currentBalance.toLocaleString()} {acc.currency || currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  const targetAcc = prorateAccountId || getCardAccountId(prorateModalItem.id, prorateModalItem.groupId);
                  markCyclePaymentPaid({
                    studentId: prorateModalItem.studentId,
                    studentName: prorateModalItem.studentName,
                    groupId: prorateModalItem.groupId,
                    groupName: prorateModalItem.groupName,
                    amountDue: customProrateAmount,
                    amountPaid: customProrateAmount,
                    lessonDates: prorateModalItem.lessonDates,
                    lessonIds: prorateModalItem.lessonIds,
                    notes: t('auto_flexible_prorated_payment_p'),
                    accountId: targetAcc
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
