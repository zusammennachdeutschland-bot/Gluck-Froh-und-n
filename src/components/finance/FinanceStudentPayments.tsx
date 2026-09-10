import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentRecord, Student, Group, Lesson } from '../../types';
import { getStudentCyclePricing, calculateDuePaymentCycles, DuePaymentCycle, getStudentAdvanceLessonCredits, calculateEstimatedPastDate } from '../../utils/paymentUtils';
import { formatLocalDate } from '../../utils/timeUtils';
import { buildWhatsAppUrl } from '../../utils/phoneUtils';
import { 
  DollarSign, CheckCircle2, Clock, Send, Search, 
  Check, X, Sparkles, History, Calendar, AlertCircle, TrendingUp, ChevronRight,
  Landmark, Wallet, CreditCard, Layers, BookOpen, ChevronDown, Coins, ShieldX, ShieldCheck, Minus, Plus,
  Users, Filter
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const FinanceStudentPayments: React.FC = () => {
  const { 
    students, groups, lessons, payments, profile, 
    markCyclePaymentPaid, markCyclePaymentNotYet, updateLessonPaymentStatus,
    recordAdvancePayment, exemptCyclePayment, exemptSingleLesson,
    t, _t, financeAccounts
  } = useApp();

  const [activeTab, setActiveTab] = useState<'cycles' | 'single_lessons' | 'in_progress' | 'history'>('cycles');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [historyAccountId, setHistoryAccountId] = useState<string>('all');

  // Per-card selected receiving account mapping
  const [cardAccountMap, setCardAccountMap] = useState<Record<string, string>>({});

  // Advance Payment Modal State
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceStudentId, setAdvanceStudentId] = useState('');
  const [advanceLessonsCount, setAdvanceLessonsCount] = useState(4);
  const [advanceCustomAmount, setAdvanceCustomAmount] = useState(0);
  const [advanceAccountId, setAdvanceAccountId] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');

  // Exemption Modal State
  const [exemptModalCycle, setExemptModalCycle] = useState<DuePaymentCycle | null>(null);
  const [exemptModalLesson, setExemptModalLesson] = useState<Lesson | null>(null);
  const [exemptNotes, setExemptNotes] = useState('');

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

  // Helper to extract clean date DD/MM/YYYY
  const extractCleanDate = (dateInput?: string | string[]) => {
    const list = Array.isArray(dateInput) ? dateInput : (dateInput ? [dateInput] : []);
    // Find the latest valid entry containing real date digits (DD/MM/YYYY or YYYY-MM-DD)
    const validWithDigits = [...list].reverse().find(d => /\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(d));
    if (validWithDigits) {
      const match = validWithDigits.match(/\d{2}\/\d{2}\/\d{4}/);
      if (match) return match[0];
      const isoMatch = validWithDigits.match(/\d{4}-\d{2}-\d{2}/);
      if (isoMatch) return formatDateDisplay(isoMatch[0]);
    }
    return formatDateDisplay(todayStr);
  };

  const formatLessonDateChip = (dateStr: string, baseDueDate?: string, bundleSize: number = 8) => {
    if (!dateStr) return '';
    if (/\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
      return dateStr;
    }
    const match = dateStr.match(/Session (\d+)\/(\d+)/i);
    if (match) {
      const sessNum = parseInt(match[1], 10);
      const totalSess = parseInt(match[2], 10) || bundleSize;
      const pastDate = calculateEstimatedPastDate(baseDueDate || todayStr, sessNum, totalSess);
      return `${formatDateDisplay(pastDate)} (Session ${sessNum}/${totalSess})`;
    }
    return dateStr.replace('Offline', _t('حصة سابقة', 'Prior Session', 'Vorherige Sitzung'));
  };

  const handleSingleLessonWhatsApp = (lesson: Lesson) => {
    const student = students.find(s => s.id === lesson.studentId || s.name === lesson.studentName);
    const phone = student?.parentPhone || student?.studentPhone || '';
    const due = Math.max(0, (lesson.amountDue || 200) - (lesson.amountPaid || 0));
    const dummyCycle: DuePaymentCycle = {
      id: `lesson_${lesson.id}`,
      studentId: lesson.studentId || student?.id || '',
      studentName: lesson.studentName || student?.name || lesson.title,
      groupId: lesson.groupId || '',
      groupName: lesson.groupName || '',
      cycleLength: 1,
      amountDue: due,
      lessonDates: [formatDateDisplay(lesson.date)],
      lessonIds: [lesson.id],
      status: 'due',
      parentPhone: phone,
    };
    setSelectedCycleForWhatsApp(dummyCycle);
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

      // Advance prepaid lessons check
      const studentAdvance = getStudentAdvanceLessonCredits(st.id, payments, lessons, st.name);
      const remainingPrepaid = studentAdvance.remainingAdvanceLessons;

      // Slice out the lessons covered by prepaid credit
      const billableLessons = remainingPrepaid > 0
        ? stCompletedLessons.slice(remainingPrepaid)
        : stCompletedLessons;

      const totalCompletedCount = billableLessons.length + virtualOffset;
      const maxCompletedSessionNum = Math.max(0, ...billableLessons.map(l => l.sessionNumber || 0));
      const reachedCycleBySessionNum = maxCompletedSessionNum > 0 && cycleLength > 1 && (maxCompletedSessionNum >= cycleLength || maxCompletedSessionNum % cycleLength === 0);
      const isCycleFinished = totalCompletedCount >= cycleLength || reachedCycleBySessionNum;

      // If they have completed some lessons but cycle is NOT finished and they do NOT have an unpaid record already
      if (totalCompletedCount > 0 && !isCycleFinished && !hasUnpaidRec) {
        const lessonDates: string[] = [];
        for (let i = 1; i <= virtualOffset; i++) {
          const matched = lessons.find(l => 
            ((st.groupId && l.groupId === st.groupId) || (l.studentId && l.studentId === st.id)) && 
            l.sessionNumber === i
          );
          lessonDates.push(matched 
            ? `${formatDateDisplay(matched.date)} (Session ${i}/${cycleLength})`
            : `حصة سابقة (Session ${i}/${cycleLength})`
          );
        }
        billableLessons.forEach(l => {
          lessonDates.push(`${formatDateDisplay(l.date)} (Session ${l.sessionNumber || 1}/${cycleLength})`);
        });

        // If teacher set session number higher, fill missing offline sessions
        if (maxCompletedSessionNum > 1 && lessonDates.length < maxCompletedSessionNum) {
          const existingNums = new Set<number>();
          lessonDates.forEach(d => {
            const m = d.match(/Session (\d+)\//);
            if (m) existingNums.add(parseInt(m[1], 10));
          });
          for (let i = 1; i <= maxCompletedSessionNum; i++) {
            if (!existingNums.has(i)) {
              const matched = lessons.find(l => 
                ((st.groupId && l.groupId === st.groupId) || (l.studentId && l.studentId === st.id)) && 
                l.sessionNumber === i
              );
              lessonDates.push(matched 
                ? `${formatDateDisplay(matched.date)} (Session ${i}/${cycleLength})`
                : `حصة سابقة (Session ${i}/${cycleLength})`
              );
            }
          }
          lessonDates.sort((a, b) => {
            const na = parseInt(a.match(/Session (\d+)\//)?.[1] || '0', 10);
            const nb = parseInt(b.match(/Session (\d+)\//)?.[1] || '0', 10);
            return na - nb;
          });
        }

        const lessonIds = billableLessons.map(l => l.id);

        // Prorated calculations based on actual billable completed lessons in the app
        const pricePerSession = amountDue / cycleLength;
        const proratedAmount = Math.round(pricePerSession * billableLessons.length);

        list.push({
          id: `in_progress_cycle_${st.id}_${billableLessons[0]?.id || Date.now()}_st_${st.name.replace(/\s+/g, '_')}`,
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
      if (!hasRemaining || (l.status !== 'completed' && !isUnpaid)) return false;

      // If student has advance prepaid lessons remaining, this lesson is covered!
      if (l.studentId) {
        const studentAdvance = getStudentAdvanceLessonCredits(l.studentId, payments, lessons, l.studentName);
        if (studentAdvance.remainingAdvanceLessons > 0) return false;
      }

      const matchesSearch = !searchTerm || 
        (l.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.groupName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroupId === 'all' || l.groupId === selectedGroupId;
      return matchesSearch && matchesGroup;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [lessons, payments, searchTerm, selectedGroupId]);

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

  // Open Advance Payment Modal
  const openAdvanceModal = (targetStudentId?: string) => {
    const activeSts = students.filter(s => !s.deleted && s.status !== 'archived');
    const stId = targetStudentId || (activeSts.length > 0 ? activeSts[0].id : '');
    setAdvanceStudentId(stId);
    setAdvanceLessonsCount(4);
    
    const targetStudent = activeSts.find(s => s.id === stId);
    const grp = groups.find(g => g.id === targetStudent?.groupId);
    const pricing = targetStudent ? getStudentCyclePricing(targetStudent, grp) : null;
    const unitPrice = pricing?.pricePerSession || grp?.pricePerSession || 200;
    setAdvanceCustomAmount(unitPrice * 4);
    
    const defaultAcc = getCardAccountId(`adv_${stId}`, targetStudent?.groupId);
    setAdvanceAccountId(defaultAcc);
    setAdvanceNotes(`سداد مقدماً (عدد 4 حصص)`);
    setAdvanceModalOpen(true);
  };

  const handleUpdateAdvanceLessonsCount = (count: number) => {
    const validCount = Math.max(1, count);
    setAdvanceLessonsCount(validCount);
    const targetStudent = students.find(s => s.id === advanceStudentId);
    const grp = groups.find(g => g.id === targetStudent?.groupId);
    const pricing = targetStudent ? getStudentCyclePricing(targetStudent, grp) : null;
    const unitPrice = pricing?.pricePerSession || grp?.pricePerSession || 200;
    setAdvanceCustomAmount(unitPrice * validCount);
    setAdvanceNotes(`سداد مقدماً (عدد ${validCount} حصص)`);
  };

  const handleSelectAdvanceStudent = (stId: string) => {
    setAdvanceStudentId(stId);
    const targetStudent = students.find(s => s.id === stId);
    const grp = groups.find(g => g.id === targetStudent?.groupId);
    const pricing = targetStudent ? getStudentCyclePricing(targetStudent, grp) : null;
    const unitPrice = pricing?.pricePerSession || grp?.pricePerSession || 200;
    setAdvanceCustomAmount(unitPrice * advanceLessonsCount);
    const defaultAcc = getCardAccountId(`adv_${stId}`, targetStudent?.groupId);
    setAdvanceAccountId(defaultAcc);
  };

  const handleConfirmAdvancePayment = () => {
    const targetStudent = students.find(s => s.id === advanceStudentId);
    if (!targetStudent) return;
    const grp = groups.find(g => g.id === targetStudent.groupId);

    recordAdvancePayment({
      studentId: targetStudent.id,
      studentName: targetStudent.name,
      groupId: targetStudent.groupId || grp?.id || '',
      groupName: grp?.name || 'مجموعة عامة',
      numberOfLessons: advanceLessonsCount,
      amount: advanceCustomAmount,
      accountId: advanceAccountId || selectedAccountId,
      notes: advanceNotes
    });

    setAdvanceModalOpen(false);
  };

  const handleConfirmExemptCycle = () => {
    if (!exemptModalCycle) return;
    exemptCyclePayment({
      studentId: exemptModalCycle.studentId,
      studentName: exemptModalCycle.studentName,
      groupId: exemptModalCycle.groupId,
      groupName: exemptModalCycle.groupName,
      lessonIds: exemptModalCycle.lessonIds,
      existingPaymentRecordId: exemptModalCycle.existingPaymentRecordId,
      notes: exemptNotes || 'إعفاء من الدفع ومسح الاستحقاق'
    });
    setExemptModalCycle(null);
    setExemptNotes('');
  };

  const handleConfirmExemptLesson = () => {
    if (!exemptModalLesson) return;
    exemptSingleLesson(exemptModalLesson.id, exemptNotes || 'إعفاء من الدفع للحصة الفردية ومسح الاستحقاق');
    setExemptModalLesson(null);
    setExemptNotes('');
  };

  // WhatsApp Parent Message Generator
  const generateWhatsAppMessage = (item: DuePaymentCycle) => {
    const datesFormatted = item.lessonDates.length > 0 
      ? item.lessonDates.map(d => `• ${formatLessonDateChip(d)}`).join('\n')
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
    <div className="space-y-2 sm:space-y-2.5 font-sans w-full">
      {/* 1. TABS STRIP (HOD HUB STYLE) + COMPACT PREPAID BUTTON */}
      <div className="flex w-full items-center justify-between gap-1 sm:gap-1.5 bg-surface p-1 rounded-xl border border-surface-border shadow-2xs">
        {/* Tabs */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {[
            {
              id: 'cycles' as const,
              title: _t('الدورات', 'Due Cycles', 'Fällige Zyklen'),
              icon: Clock,
            },
            {
              id: 'single_lessons' as const,
              title: _t('فردية', 'Single Lessons', 'Einzellektionen'),
              icon: BookOpen,
            },
            {
              id: 'in_progress' as const,
              title: _t('مرنة', 'In-Progress', 'Laufend'),
              icon: Sparkles,
            },
            {
              id: 'history' as const,
              title: _t('السجل', 'History', 'Historie'),
              icon: History,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative h-8 sm:h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
                  isActive
                    ? 'bg-primary text-white px-2.5 sm:px-3 gap-1.5 shadow-xs font-black shrink-0'
                    : 'w-8 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
                }`}
                title={tab.title}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                {isActive && (
                  <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">
                    {tab.title}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Small Prepaid Button */}
        <button
          type="button"
          onClick={() => openAdvanceModal()}
          className="h-8 sm:h-9 px-2.5 sm:px-3 bg-primary-soft hover:bg-primary/20 active:scale-95 text-primary border border-primary-border rounded-lg text-xs font-black flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
          title={_t('سداد حصص مقدماً (Prepaid)', 'Prepaid Lessons', 'Vorauszahlung')}
        >
          <Coins className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-bold hidden xs:inline whitespace-nowrap">
            {_t('دفع مقدم', 'Prepaid', 'Voraus')}
          </span>
        </button>
      </div>

      {/* 2. COMPACT SEARCH & FILTER BAR (SINGLE ULTRA-SLIM ROW) */}
      <div className="flex items-center gap-1.5 p-1 bg-surface rounded-xl border border-surface-border shadow-2xs text-xs">
        {/* Live Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={_t('بحث...', 'Search...', 'Suchen...')}
            className="w-full h-7 sm:h-8 pr-7 pl-6 bg-background border border-surface-border rounded-lg text-[11px] font-bold text-text-main placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-main rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter by Group */}
        {groups.length > 0 && (
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="h-7 sm:h-8 px-1.5 bg-background border border-surface-border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[85px] xs:max-w-[110px] sm:max-w-[140px] truncate"
            title={_t('تصفية حسب المجموعة', 'Filter by group', 'Nach Gruppe filtern')}
          >
            <option value="all">{_t('كل المجموعات', 'All Groups', 'Alle')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}

        {/* Filter / Destination Account */}
        {activeTab === 'history' ? (
          <select
            value={historyAccountId}
            onChange={(e) => setHistoryAccountId(e.target.value)}
            className="h-7 sm:h-8 px-1.5 bg-background border border-surface-border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[90px] xs:max-w-[115px] sm:max-w-[150px] truncate"
            title={_t('تصفية حسب الخزينة', 'Filter by account', 'Nach Konto filtern')}
          >
            <option value="all">{_t('كل الحسابات', 'All Accounts', 'Alle Konten')}</option>
            {financeAccounts.filter((a) => !a.deleted).map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.type === 'cash' ? '💵 ' : acc.type === 'wallet' ? '📱 ' : acc.type === 'bank' ? '🏦 ' : '💳 '}
                {acc.name}
              </option>
            ))}
          </select>
        ) : (
          financeAccounts.length > 0 && (
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="h-7 sm:h-8 px-1.5 bg-background border border-surface-border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[90px] xs:max-w-[115px] sm:max-w-[150px] truncate"
              title={_t('الحساب الافتراضي للتحصيل', 'Default collection account', 'Standard-Konto')}
            >
              {financeAccounts.filter((a) => !a.deleted).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.type === 'cash' ? '💵 ' : acc.type === 'wallet' ? '📱 ' : acc.type === 'bank' ? '🏦 ' : '💳 '}
                  {acc.name}
                </option>
              ))}
            </select>
          )
        )}
      </div>

      {/* ========================================================================= */}
      {/* PAYMENT CARDS SECTION (ON TOP)                                            */}
      {/* ========================================================================= */}

      {/* TAB 1: DUE PAYMENT CYCLES */}
      {activeTab === 'cycles' && (
        <div className="space-y-3">
          {filteredDueCycles.length === 0 ? (
            <div className="py-10 sm:py-16 text-center flex flex-col items-center justify-center space-y-3 bg-surface border border-surface-border rounded-2xl">
              <div className="relative mb-1">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl pointer-events-none" />
                <div className="w-14 h-14 bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto relative z-10 shadow-2xs border border-primary-border/30 rotate-2">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
              {filteredDueCycles.map((item, idx) => {
                const studentAdvanceInfo = getStudentAdvanceLessonCredits(item.studentId, payments, lessons);
                const targetAccountId = getCardAccountId(item.id, item.groupId);
                const grp = groups.find(g => g.id === item.groupId);
                const duration = grp?.duration || 60;
                const rawDate = item.lessonDates[item.lessonDates.length - 1] || item.lessonDates[0] || todayStr;
                const cleanDate = extractCleanDate(item.lessonDates.length > 0 ? item.lessonDates : rawDate);
                const sessionText = item.cycleLength > 1 
                  ? `${item.cycleLength}/${item.cycleLength}`
                  : '1/1';

                return (
                  <div
                    key={`${item.id}_${idx}`}
                    className="bg-surface p-3 rounded-[16px] border border-surface-border hover:border-primary/40 transition-all shadow-2xs space-y-2 flex flex-col justify-between"
                  >
                    {/* 1. CARD HEADER */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <h3 className="text-sm font-black text-text-main truncate">
                          {item.studentName}
                        </h3>
                        <span className="px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted text-[10px] font-bold shrink-0 truncate max-w-[120px] border border-surface-border/40">
                          {item.groupName}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base sm:text-lg font-black text-primary font-mono leading-none">
                          {item.amountDue}
                        </span>
                        <span className="text-[10.5px] font-bold text-text-muted ml-1">
                          {currency}
                        </span>
                      </div>
                    </div>

                    {/* 2. ACCOUNT & CREDITS ROW */}
                    {(studentAdvanceInfo.remainingAdvanceLessons > 0 || financeAccounts.length > 0) && (
                      <div className="flex items-center justify-between gap-2 h-6">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {studentAdvanceInfo.remainingAdvanceLessons > 0 && (
                            <span className="h-6 px-1.5 rounded-md bg-primary-soft text-primary font-bold text-[9.5px] border border-primary-border flex items-center gap-1 shrink-0">
                              <Coins className="w-2.5 h-2.5 text-primary shrink-0" />
                              <span>{studentAdvanceInfo.remainingAdvanceLessons} {_t('حصص رصيد', 'credits', 'Guthaben')}</span>
                            </span>
                          )}
                        </div>

                        {/* 6. ACCOUNT INLINE CHIP */}
                        {financeAccounts.length > 0 && (
                          <div className="relative inline-flex items-center shrink-0">
                            <select
                              value={targetAccountId}
                              onChange={(e) => setCardAccountMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="h-6 pl-1.5 pr-4 bg-surface-hover/80 hover:bg-surface-hover border border-surface-border rounded-lg text-[10.5px] font-bold text-text-muted hover:text-text-main appearance-none cursor-pointer focus:outline-none transition-colors max-w-[130px] truncate"
                              title={_t('تغيير حساب الإيداع', 'Change deposit account', 'Konto ändern')}
                            >
                              {financeAccounts.filter(a => !a.deleted).map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.type === 'cash' ? '💵' : acc.type === 'wallet' ? '📱' : acc.type === 'bank' ? '🏦' : '💳'} {acc.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-2.5 h-2.5 text-text-muted absolute right-1 pointer-events-none" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. LESSON INFO ROW */}
                    <div className="flex items-center gap-3 text-[11px] font-mono text-text-muted">
                      <span className="flex items-center gap-1 shrink-0">
                        <span>📅</span>
                        <span>{cleanDate}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span>📖</span>
                        <span>Session {sessionText}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span>⏱</span>
                        <span>{duration}m</span>
                      </span>
                    </div>

                    {/* 5. PROGRESS BAR (SHOW ONLY IF TOTAL LESSONS > 1) */}
                    {item.cycleLength > 1 && (
                      <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full w-full" />
                      </div>
                    )}

                    {/* 7. ACTION BUTTONS: [ PAID ] + [ Parent Icon ] [ Advance Icon ] [ Exempt Icon ] */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {/* PAID button (Primary, full width) */}
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(item)}
                        className="flex-1 h-9 px-3 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-black text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title={t('payments_paid_btn')}
                      >
                        <Check className="w-4 h-4 stroke-[3] shrink-0" />
                        <span>{_t('تم السداد', 'PAID', 'Bezahlt')}</span>
                      </button>

                      {/* Parent WhatsApp button (Icon only) */}
                      <button
                        type="button"
                        onClick={() => setSelectedCycleForWhatsApp(item)}
                        className="w-9 h-9 shrink-0 bg-surface hover:bg-primary-soft text-text-muted hover:text-primary active:scale-95 border border-surface-border hover:border-primary-border rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title={t('payments_parent_notice')}
                      >
                        <Send className="w-4 h-4 shrink-0" />
                      </button>

                      {/* Advance button (Icon only) */}
                      <button
                        type="button"
                        onClick={() => openAdvanceModal(item.studentId)}
                        className="w-9 h-9 shrink-0 bg-surface hover:bg-primary-soft text-text-muted hover:text-primary active:scale-95 border border-surface-border hover:border-primary-border rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title={_t('تسجيل حصص مدفوعة مقدماً', 'Pay lessons in advance', 'Vorauszahlung')}
                      >
                        <Coins className="w-4 h-4 shrink-0" />
                      </button>

                      {/* Exempt button (Icon only) */}
                      <button
                        type="button"
                        onClick={() => {
                          setExemptModalCycle(item);
                          setExemptNotes('');
                        }}
                        className="w-9 h-9 shrink-0 bg-surface hover:bg-primary-soft text-text-muted hover:text-primary active:scale-95 border border-surface-border hover:border-primary-border rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title={_t('إعفاء من الدفع ومسح الاستحقاق', 'Exempt and clear due', 'Von Zahlung befreien')}
                      >
                        <ShieldX className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INDIVIDUAL DUE LESSONS */}
      {activeTab === 'single_lessons' && (
        <div className="space-y-3">
          {unpaidSingleLessons.length === 0 ? (
            <div className="py-10 sm:py-16 text-center flex flex-col items-center justify-center space-y-3 bg-surface border border-surface-border rounded-2xl">
              <div className="w-12 h-12 bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-text-main">
                  {_t('لا توجد حصص فردية مستحقة السداد', 'No individual lessons due for payment', 'Keine fälligen Einzellektionen')}
                </h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  {_t('جميع الحصص الفردية مسددة بالكامل أو مضافة للدورات المستحقة.', 'All individual lessons are settled or tracked in cycles.', 'Alle Einzellektionen sind bezahlt.')}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
              {unpaidSingleLessons.map((lesson) => {
                const due = lesson.amountDue || 200;
                const paid = lesson.amountPaid || 0;
                const remaining = Math.max(0, due - paid);
                const cardKey = `lesson_${lesson.id}`;
                const targetAccountId = getCardAccountId(cardKey, lesson.groupId);
                const student = students.find(s => s.id === lesson.studentId || s.name === lesson.studentName);
                const studentAdvanceInfo = getStudentAdvanceLessonCredits(lesson.studentId || student?.id, payments, lessons);
                const cleanDate = extractCleanDate(formatDateDisplay(lesson.date));
                const duration = lesson.duration || 60;
                const displayName = lesson.studentName || student?.name || lesson.groupName || lesson.title;
                const groupLabel = lesson.groupName || (lesson.isQuickLesson ? _t('سريعة', 'Quick', 'Schnell') : _t('فردية', 'Private', 'Einzel'));

                return (
                  <div
                    key={lesson.id}
                    className="bg-surface p-3 rounded-[16px] border border-surface-border hover:border-primary/40 transition-all shadow-2xs space-y-2 flex flex-col justify-between"
                  >
                    {/* 1. CARD HEADER */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <h4 className="text-sm font-black text-text-main truncate">
                          {displayName}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted text-[10px] font-bold shrink-0 truncate max-w-[120px] border border-surface-border/40">
                          {groupLabel}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base sm:text-lg font-black text-primary font-mono leading-none">
                          {remaining}
                        </span>
                        <span className="text-[10.5px] font-bold text-text-muted ml-1">
                          {currency}
                        </span>
                      </div>
                    </div>

                    {/* 2. ACCOUNT & CREDITS ROW */}
                    {(studentAdvanceInfo.remainingAdvanceLessons > 0 || financeAccounts.length > 0) && (
                      <div className="flex items-center justify-between gap-2 h-6">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {studentAdvanceInfo.remainingAdvanceLessons > 0 && (
                            <span className="h-6 px-1.5 rounded-md bg-primary-soft text-primary font-bold text-[9.5px] border border-primary-border flex items-center gap-1 shrink-0">
                              <Coins className="w-2.5 h-2.5 text-primary shrink-0" />
                              <span>{studentAdvanceInfo.remainingAdvanceLessons} {_t('حصص رصيد', 'credits', 'Guthaben')}</span>
                            </span>
                          )}
                        </div>

                        {/* 6. ACCOUNT INLINE CHIP */}
                        {financeAccounts.length > 0 && (
                          <div className="relative inline-flex items-center shrink-0">
                            <select
                              value={targetAccountId}
                              onChange={(e) => setCardAccountMap(prev => ({ ...prev, [cardKey]: e.target.value }))}
                              className="h-6 pl-1.5 pr-4 bg-surface-hover/80 hover:bg-surface-hover border border-surface-border rounded-lg text-[10.5px] font-bold text-text-muted hover:text-text-main appearance-none cursor-pointer focus:outline-none transition-colors max-w-[130px] truncate"
                              title={_t('تغيير حساب الإيداع', 'Change deposit account', 'Konto ändern')}
                            >
                              {financeAccounts.filter(a => !a.deleted).map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.type === 'cash' ? '💵' : acc.type === 'wallet' ? '📱' : acc.type === 'bank' ? '🏦' : '💳'} {acc.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-2.5 h-2.5 text-text-muted absolute right-1 pointer-events-none" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. LESSON INFO ROW */}
                    <div className="flex items-center gap-3 text-[11px] font-mono text-text-muted">
                      <span className="flex items-center gap-1 shrink-0">
                        <span>📅</span>
                        <span>{cleanDate}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span>📖</span>
                        <span>Session 1/1</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span>⏱</span>
                        <span>{duration}m</span>
                      </span>
                    </div>

                    {/* 5. PROGRESS BAR: HIDE COMPLETELY FOR 1 LESSON (RULE 5) */}

                    {/* 7. ACTION BUTTONS: [ PAID ] + [ Parent Icon ] [ Advance Icon ] [ Exempt Icon ] */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {/* PAID button (Primary, full width) */}
                      <button
                        type="button"
                        onClick={() => handleMarkSingleLessonPaid(lesson)}
                        className="flex-1 h-9 px-3 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-black text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title={_t('سداد الحصة الآن', 'Mark Lesson as Paid', 'Als bezahlt markieren')}
                      >
                        <Check className="w-4 h-4 stroke-[3] shrink-0" />
                        <span>{_t('تم السداد', 'PAID', 'Bezahlt')}</span>
                      </button>

                      {/* Parent WhatsApp button (Icon only) */}
                      <button
                        type="button"
                        onClick={() => handleSingleLessonWhatsApp(lesson)}
                        className="w-9 h-9 shrink-0 bg-surface hover:bg-primary-soft text-text-muted hover:text-primary active:scale-95 border border-surface-border hover:border-primary-border rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title={t('payments_parent_notice')}
                      >
                        <Send className="w-4 h-4 shrink-0" />
                      </button>

                      {/* Advance button (Icon only) */}
                      <button
                        type="button"
                        onClick={() => openAdvanceModal(lesson.studentId || student?.id || '')}
                        className="w-9 h-9 shrink-0 bg-surface hover:bg-primary-soft text-text-muted hover:text-primary active:scale-95 border border-surface-border hover:border-primary-border rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title={_t('تسجيل حصص مدفوعة مقدماً', 'Pay lessons in advance', 'Vorauszahlung')}
                      >
                        <Coins className="w-4 h-4 shrink-0" />
                      </button>

                      {/* Exempt button (Icon only) */}
                      <button
                        type="button"
                        onClick={() => {
                          setExemptModalLesson(lesson);
                          setExemptNotes('');
                        }}
                        className="w-9 h-9 shrink-0 bg-surface hover:bg-primary-soft text-text-muted hover:text-primary active:scale-95 border border-surface-border hover:border-primary-border rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title={_t('إعفاء من الدفع ومسح الحصة', 'Exempt and clear lesson', 'Lektion befreien')}
                      >
                        <ShieldX className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: IN-PROGRESS / PRORATED BILLING */}
      {activeTab === 'in_progress' && (
        <div className="space-y-3">
          <div className="bg-surface-hover/30 p-3 rounded-xl border border-surface-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-text-muted">
              {_t('يمكنك إنهاء الدورة الحالية للطالب قبل موعدها وإصدار فاتورة نسبية حسب عدد الحصص المحضورة بالفعل.', 'End current cycle early and bill proportionally based on attended lessons.', 'Zyklus vorzeitig beenden und anteilig abrechnen.')}
            </p>
          </div>

          {filteredInProgressCycles.length === 0 ? (
            <div className="bg-surface p-8 rounded-2xl text-center border border-surface-border">
              <p className="text-xs text-text-muted font-bold">
                {t('auto_there_are_currently_no_student')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
              {filteredInProgressCycles.map((item, idx) => (
                <div key={`${item.id}_${idx}`} className="bg-surface border border-surface-border hover:border-primary/40 transition-all p-3 rounded-[16px] space-y-2 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <h4 className="text-sm font-black text-text-main truncate">{item.studentName}</h4>
                      <span className="px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted text-[10px] font-bold shrink-0 truncate max-w-[120px] border border-surface-border/40">
                        {item.groupName}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-black text-primary font-mono leading-none">
                        {item.amountDue}
                      </span>
                      <span className="text-[10.5px] font-bold text-text-muted ml-1">
                        {currency}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                    <span className="flex items-center gap-1">
                      <span>📖</span>
                      <span>{item.lessonDates.length} / {item.cycleLength} {t('auto_lessons')}</span>
                    </span>
                    <span className="text-[10px] text-text-muted font-bold">
                      {Math.round((item.lessonDates.length / Math.max(1, item.cycleLength)) * 100)}%
                    </span>
                  </div>

                  {item.cycleLength > 1 && (
                    <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${Math.min(100, Math.round((item.lessonDates.length / Math.max(1, item.cycleLength)) * 100))}%` }}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setProrateModalItem(item);
                      setCustomProrateAmount(item.amountDue);
                      setProrateAccountId(getCardAccountId(item.id, item.groupId));
                    }}
                    className="w-full h-[42px] bg-primary-soft text-primary hover:bg-primary/20 active:scale-95 transition-all text-xs font-black rounded-xl border border-primary-border flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>{t('auto_force_cycle_bill')}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {filteredPaidHistory.length === 0 ? (
            <div className="bg-surface p-10 rounded-2xl border border-surface-border text-center space-y-1">
              <p className="text-sm font-bold text-text-main">{t('payments_no_history')}</p>
              <p className="text-xs text-text-muted/70">{t('payments_history_sub')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredPaidHistory.map(p => {
                const targetAcc = financeAccounts.find(a => a.id === p.financeAccountId);

                return (
                  <div
                    key={p.id}
                    className="bg-surface p-4 sm:p-5 rounded-2xl border border-surface-border hover:border-primary/40 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black text-text-main truncate">{p.studentName}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {p.paymentType === 'advance_payment' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300/40 flex items-center gap-1">
                              <Coins className="w-3 h-3 text-amber-500" />
                              <span>{_t('سداد مقدم', 'Advance', 'Voraus')} ({p.bundleSize || 1} {_t('حصص', 'lessons', 'Lekt.')})</span>
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover text-text-muted">
                            {p.groupName}
                          </span>
                        </div>
                      </div>

                      {p.lessonDates && p.lessonDates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {p.lessonDates.map((d, i) => (
                            <span key={i} className="text-[10px] font-mono bg-surface-hover/80 px-2 py-0.5 rounded border border-surface-border text-text-main">
                              {formatLessonDateChip(d)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Account Paid Into Badge */}
                      <div className="flex items-center gap-1.5 text-xs text-text-muted pt-1">
                        <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-bold text-text-main">
                          {_t('أودع في:', 'Deposited into:', 'Eingezahlt in:')}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-primary-soft text-primary font-bold text-[11px]">
                          {targetAcc?.name || _t('الخزينة الرئيسية (كاش)', 'Main Cash', 'Hauptkasse')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-surface-border">
                      <span className="text-[11px] text-text-muted">
                        {t('payments_paid_on')}: {p.paidDate || p.dueDate}
                      </span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{p.amountPaid} {currency}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FINANCIAL SUMMARY & STATISTICS SECTION (ON BOTTOM)                        */}
      {/* ========================================================================= */}
      <div className="pt-6 border-t border-surface-border space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-text-main">
                {_t('الملخص المالي ومؤشرات التحصيل', 'Financial Summary & Collection Metrics', 'Finanzübersicht & Kennzahlen')}
              </h3>
              <p className="text-[11px] text-text-muted">
                {_t('إجمالي التحصيلات والمستحقات ومعدلات الإيراد اليومية والأسبوعية والشهرية', 'Totals of collections, pending dues, and revenue gains', 'Einnahmen, fällige Beträge und Ertragsraten')}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Collected */}
          <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-between relative overflow-hidden shadow-2xs">
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {t('payments_total_collected') || 'Collected'}
            </span>
            <div>
              <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{monthlyTotal}</span>
              <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-normal mr-1">{currency}</span>
            </div>
          </div>

          {/* Pending Due */}
          <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-between relative overflow-hidden shadow-2xs">
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {t('payments_total_pending') || 'Pending'}
            </span>
            <div>
              <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{totalAmountDue}</span>
              <span className="text-xs text-amber-600/70 dark:text-amber-400/70 font-normal mr-1">{currency}</span>
            </div>
          </div>

          {/* Overdue / Postponed */}
          <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-between relative overflow-hidden shadow-2xs">
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              {t('payments_overdue')}
            </span>
            <div>
              <span className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono">{overdueTotal}</span>
              <span className="text-xs text-rose-600/70 dark:text-rose-400/70 font-normal mr-1">{currency}</span>
            </div>
          </div>

          {/* Expected Total */}
          <div className="bg-surface hover:bg-surface-hover transition-colors p-3.5 rounded-2xl border border-surface-border flex flex-col justify-between relative overflow-hidden shadow-2xs">
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-primary/10 rounded-full blur-xl pointer-events-none" />
            <span className="text-[10px] font-black text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              {t('payments_expected')}
            </span>
            <div>
              <span className="text-lg sm:text-xl font-black text-primary font-mono">{totalAmountDue + monthlyTotal}</span>
              <span className="text-xs text-primary/70 font-normal mr-1">{currency}</span>
            </div>
          </div>
        </div>

        {/* Interactive Revenue Overview Breakdown Card */}
        <div className="bg-surface border border-surface-border p-3.5 sm:p-4 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-primary/10 rounded-lg">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <h4 className="text-xs font-black text-text-main uppercase tracking-wider">
                {t('payments_revenue_overview')}
              </h4>
            </div>
            <span className="text-[11px] text-text-muted">
              {_t('انقر على أي فترة لعرض تفاصيل المعاملات المسددة', 'Click any period for detailed breakdown', 'Klicken für Details')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedGainPeriod('daily')}
              className="flex flex-col items-center p-2.5 bg-surface-hover/60 hover:bg-primary-soft transition-all rounded-xl border border-surface-border cursor-pointer group active:scale-95"
            >
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">
                {t('payments_daily_gain_title') || 'Today'}
              </span>
              <span className="text-base sm:text-lg font-black text-text-main font-mono">
                {dailyTotal} <span className="text-xs font-normal text-text-muted">{currency}</span>
              </span>
              <div className="mt-1 flex items-center justify-center text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                <span>{dailyPayments.length} {_t('دفعات', 'payments', 'Zahl.')}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGainPeriod('weekly')}
              className="flex flex-col items-center p-2.5 bg-surface-hover/60 hover:bg-primary-soft transition-all rounded-xl border border-surface-border cursor-pointer group active:scale-95"
            >
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">
                {t('payments_weekly_gain_title') || 'Weekly'}
              </span>
              <span className="text-base sm:text-lg font-black text-text-main font-mono">
                {weeklyTotal} <span className="text-xs font-normal text-text-muted">{currency}</span>
              </span>
              <div className="mt-1 flex items-center justify-center text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                <span>{weeklyPayments.length} {_t('دفعات', 'payments', 'Zahl.')}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGainPeriod('monthly')}
              className="flex flex-col items-center p-2.5 bg-surface-hover/60 hover:bg-primary-soft transition-all rounded-xl border border-surface-border cursor-pointer group active:scale-95"
            >
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">
                {t('payments_monthly_gain_title') || 'Monthly'}
              </span>
              <span className="text-base sm:text-lg font-black text-text-main font-mono">
                {monthlyTotal} <span className="text-xs font-normal text-text-muted">{currency}</span>
              </span>
              <div className="mt-1 flex items-center justify-center text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                <span>{monthlyPayments.length} {_t('دفعات', 'payments', 'Zahl.')}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

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
                      <span key={idx} className="bg-surface text-[10px] font-mono px-2 py-0.5 rounded border border-surface-border dark:border-surface-border-soft">🗓️ {formatLessonDateChip(d)}</span>
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

      {/* ADVANCE PAYMENT MODAL */}
      {advanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md shadow-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main">
                    {_t('سداد حصص مقدماً (Prepaid)', 'Advance Lessons Payment', 'Vorauszahlung')}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {_t('تسجيل تحصيل مقدماً لعدد محدد من الحصص القادمة', 'Record upfront payment for upcoming lessons', 'Zukünftige Lektionen im Voraus bezahlen')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdvanceModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5">
              {/* Student Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main block">
                  {_t('اختر الطالب:', 'Select Student:', 'Schüler auswählen:')}
                </label>
                <select
                  value={advanceStudentId}
                  onChange={(e) => handleSelectAdvanceStudent(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  {students.filter(s => !s.deleted && s.status !== 'archived').map(st => {
                    const grp = groups.find(g => g.id === st.groupId);
                    return (
                      <option key={st.id} value={st.id}>
                        {st.name} {grp ? `(${grp.name})` : ''}
                      </option>
                    );
                  })}
                </select>

                {/* Show existing advance balance if student has any */}
                {advanceStudentId && (() => {
                  const existingAdv = getStudentAdvanceLessonCredits(advanceStudentId, payments, lessons);
                  if (existingAdv.remainingAdvanceLessons > 0) {
                    return (
                      <div className="p-2 bg-amber-500/10 border border-amber-400/30 rounded-lg text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>
                          {_t('لدى هذا الطالب حالياً رصيد مقدم متبقي قدره:', 'Current remaining advance credit:', 'Aktuelles Vorausguthaben:')}{' '}
                          <strong>{existingAdv.remainingAdvanceLessons} {_t('حصص', 'lessons', 'Lektionen')}</strong>
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Number of Lessons Stepper & Quick Presets */}
              <div className="space-y-2 bg-surface-hover/50 dark:bg-surface-hover/20 p-3 rounded-xl border border-surface-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-text-main">
                    {_t('كم عدد الحصص المدفوعة مقدماً؟', 'Number of Lessons Paid in Advance:', 'Anzahl der vorausbezahlten Lektionen:')}
                  </label>
                  <span className="text-xs font-mono font-black text-primary">
                    {advanceLessonsCount} {_t('حصص', 'lessons', 'Lektionen')}
                  </span>
                </div>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-3 py-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateAdvanceLessonsCount(advanceLessonsCount - 1)}
                    disabled={advanceLessonsCount <= 1}
                    className="w-9 h-9 rounded-xl bg-surface border border-surface-border text-text-main hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-black text-base disabled:opacity-40 cursor-pointer active:scale-95 transition-all"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min={1}
                    value={advanceLessonsCount}
                    onChange={(e) => handleUpdateAdvanceLessonsCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center py-1.5 bg-surface border border-surface-border rounded-xl text-base font-black font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  <button
                    type="button"
                    onClick={() => handleUpdateAdvanceLessonsCount(advanceLessonsCount + 1)}
                    className="w-9 h-9 rounded-xl bg-surface border border-surface-border text-text-main hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-black text-base cursor-pointer active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {[1, 2, 4, 6, 8, 12].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleUpdateAdvanceLessonsCount(num)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        advanceLessonsCount === num
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                      }`}
                    >
                      {num} {_t('حصص', 'lessons', 'Lekt.')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-main">
                    {_t('المبلغ المحصل مقدماً:', 'Total Amount Collected:', 'Gesamter Vorausbetrag:')}
                  </label>
                  <span className="text-[10px] text-text-muted">
                    {_t('(قابل للتعديل حسب الاتفاق)', '(editable for custom discount)', '(anpassbar)')}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={advanceCustomAmount}
                    onChange={(e) => setAdvanceCustomAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-12 pr-4 py-2 bg-background border border-surface-border rounded-xl text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted font-mono">
                    {currency}
                  </span>
                </div>
              </div>

              {/* Receiving Financial Account */}
              {financeAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5 text-primary" />
                    <span>{_t('إيداع في خزينة / حساب:', 'Deposit into Account:', 'Einzahlen auf Konto:')}</span>
                  </label>
                  <select
                    value={advanceAccountId || selectedAccountId}
                    onChange={(e) => setAdvanceAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
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

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main block">
                  {_t('ملاحظات السداد:', 'Notes:', 'Notizen:')}
                </label>
                <input
                  type="text"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  placeholder={_t('مثال: سداد مقدم عن شهر القادم...', 'e.g. advance for next month', 'z.B. Vorauszahlung')}
                  className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={handleConfirmAdvancePayment}
                disabled={!advanceStudentId || advanceLessonsCount <= 0 || advanceCustomAmount < 0}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Coins className="w-4 h-4" />
                <span>
                  {_t(`تأكيد استلام ${advanceCustomAmount} ${currency} مقدم (${advanceLessonsCount} حصص)`, `Confirm ${advanceCustomAmount} ${currency} advance payment`, `Vorauszahlung bestätigen`)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAdvanceModalOpen(false)}
                className="w-full py-2 bg-surface-hover text-text-main rounded-xl font-bold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span>{t('auto_cancel')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXEMPTION CONFIRMATION MODAL */}
      {(exemptModalCycle || exemptModalLesson) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <ShieldX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-600 dark:text-rose-400">
                    {_t('إعفاء من الدفع ومسح الاستحقاق', 'Waive Payment & Clear Due', 'Von Zahlung befreien & löschen')}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {_t('لن يسجل كدين ولن يدخل الخزينة وسيتم حذفه من قائمة المستحقات', 'Will not be recorded as revenue or debt; cleared immediately', 'Wird nicht als Einnahme gebucht und gelöscht')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExemptModalCycle(null);
                  setExemptModalLesson(null);
                }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation Warning Banner */}
            <div className="p-3 bg-rose-500/10 border border-rose-400/30 rounded-xl space-y-1.5 text-xs text-rose-800 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{_t('تأكيد الإعفاء النهائي للطالب:', 'Confirmation details:', 'Bestätigung:')}</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-700/90 dark:text-rose-300/90">
                <li>{_t('لن يتم تسجيل أي إيراد في الخزينة أو الحسابات (المبلغ: 0)', 'Zero revenue will be added to the treasury', 'Keine Einnahme in der Kasse verbucht')}</li>
                <li>{_t('سيتم مسح هذا الاستحقاق فوراً من قائمة الدفعات والتنبيهات', 'The item will be removed immediately from due payments', 'Aus den fälligen Zahlungen entfernt')}</li>
                <li>{_t('تُعتبر الحصص معفاة رسميًا ومسجلة في الأرشيف', 'Lessons will be marked as exempted in records', 'Lektionen werden als befreit vermerkt')}</li>
              </ul>
            </div>

            {/* Student & Item Summary Card */}
            <div className="bg-surface-hover/50 dark:bg-surface-hover/20 p-3 rounded-xl border border-surface-border space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">{_t('الطالب:', 'Student:', 'Schüler:')}</span>
                <span className="font-black text-text-main">
                  {exemptModalCycle?.studentName || exemptModalLesson?.studentName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">{_t('المجموعة:', 'Group:', 'Gruppe:')}</span>
                <span className="font-bold text-text-main">
                  {exemptModalCycle?.groupName || exemptModalLesson?.groupName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">{_t('المبلغ الذي سيتم إسقاطه:', 'Waived Amount:', 'Erlassener Betrag:')}</span>
                <span className="font-black text-rose-600 dark:text-rose-400 font-mono">
                  {exemptModalCycle?.amountDue || exemptModalLesson?.amountDue || 0} {currency}
                </span>
              </div>
              {exemptModalCycle && exemptModalCycle.lessonDates.length > 0 && (
                <div className="pt-1 border-t border-surface-border/50 text-[10px] text-text-muted">
                  <span>{_t('الحصص المشمولة:', 'Lessons:', 'Lektionen:')} {exemptModalCycle.lessonDates.map(formatLessonDateChip).join('، ')}</span>
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-main block">
                {_t('سبب الإعفاء (اختياري):', 'Reason for exemption (optional):', 'Grund für die Befreiung (optional):')}
              </label>
              <input
                type="text"
                value={exemptNotes}
                onChange={(e) => setExemptNotes(e.target.value)}
                placeholder={_t('مثال: منحة تفوق، ظرف عائلي، خصم خاص...', 'e.g. scholarship, personal hardship...', 'z.B. Stipendium')}
                className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={exemptModalCycle ? handleConfirmExemptCycle : handleConfirmExemptLesson}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <ShieldX className="w-4 h-4" />
                <span>{_t('تأكيد الإعفاء ومسح الاستحقاق الآن', 'Confirm Exemption & Clear', 'Befreiung bestätigen und löschen')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExemptModalCycle(null);
                  setExemptModalLesson(null);
                }}
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
