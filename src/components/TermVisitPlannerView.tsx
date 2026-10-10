import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar, Clock, CheckCircle2, AlertTriangle, RefreshCw, Printer, Download,
  Filter, Users, User, BookOpen, Layers, Check, X, ShieldAlert, Sparkles,
  ChevronRight, ArrowRight, Eye, Edit3, Plus, ArrowLeftRight, FileText, ChevronDown, ChevronUp, Save
} from 'lucide-react';
import { 
  generateTermVisitPlan, getDefaultTermDates, GenerationResult 
} from '../services/termVisitPlannerService';
import { 
  downloadTermVisitPlanPdf, printTermVisitPlanReport, saveTermVisitPlanToPhoneStorage,
  TermVisitReportExportOptions
} from '../utils/termVisitPrintUtils';
import { PlannedVisitRecord, VisitPlannerStatus, TermVisitRequirement } from '../types';
import { calculatePeriodsTimings } from '../utils/schoolUtils';

export const TermVisitPlannerView: React.FC = () => {
  const { profile, updateProfile, lessons, _t, language } = useApp();
  const schoolSettings = profile?.schoolSettings || {} as any;
  const isRtl = language === 'ar';

  const defaultDates = useMemo(() => getDefaultTermDates(schoolSettings.currentTerm), [schoolSettings.currentTerm]);

  // Settings State
  const [selectedTerm, setSelectedTerm] = useState<string>(() => schoolSettings.termVisitPlannerSettings?.term || defaultDates.term);
  const [startDate, setStartDate] = useState<string>(() => schoolSettings.termVisitPlannerSettings?.startDate || defaultDates.startDate);
  const [endDate, setEndDate] = useState<string>(() => schoolSettings.termVisitPlannerSettings?.endDate || defaultDates.endDate);
  const [workingDays, setWorkingDays] = useState<string[]>(() => schoolSettings.termVisitPlannerSettings?.workingDays || ['0', '1', '2', '3', '4']);
  const [visitsPerClass, setVisitsPerClass] = useState<number>(() => schoolSettings.termVisitPlannerSettings?.visitsPerTeacherPerClass || 1);

  // View & Filters State
  const [activeViewMode, setActiveViewMode] = useState<'schedule' | 'weekly' | 'manual' | 'teachers' | 'requirements'>('schedule');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Manual Interactive Visit Planner State
  const [manualTargetWeekKey, setManualTargetWeekKey] = useState<string>('');
  const [manualSelectedDayKey, setManualSelectedDayKey] = useState<string>('0'); // Default Sunday

  // Modals & Actions State
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Reschedule Modal State
  const [editingVisit, setEditingVisit] = useState<PlannedVisitRecord | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newPeriod, setNewPeriod] = useState<number>(1);
  const [rescheduleNotes, setRescheduleNotes] = useState<string>('');

  // 1. Generate or Retrieve Schedule Data
  const planResult: GenerationResult = useMemo(() => {
    return generateTermVisitPlan(schoolSettings, lessons || [], {
      term: selectedTerm,
      startDate,
      endDate,
      workingDays,
      visitsPerTeacherPerClass: visitsPerClass
    });
  }, [schoolSettings, lessons, selectedTerm, startDate, endDate, workingDays, visitsPerClass]);

  // Function to save current plan configuration persistently
  const savePlanConfig = (newSettings?: any) => {
    const settingsToSave = newSettings || {
      ...planResult.settings,
      lastGeneratedAt: new Date().toISOString()
    };
    updateProfile({
      ...profile,
      schoolSettings: {
        ...schoolSettings,
        termVisitPlannerSettings: settingsToSave
      }
    });
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Toggle Working Day Selection
  const toggleWorkingDay = (dayKey: string) => {
    if (workingDays.includes(dayKey)) {
      if (workingDays.length > 1) {
        setWorkingDays(workingDays.filter(d => d !== dayKey));
      }
    } else {
      setWorkingDays([...workingDays, dayKey].sort());
    }
  };

  // Export Scope State: 'term' (full term) | 'weekly_4per_page' | 'current' (current week only) | 'week:<weekKey>' (specific week)
  const [exportScope, setExportScope] = useState<string>('term');

  // Available Weeks List spanning the ENTIRE TERM date range (startDate to endDate)
  const availableWeeksList = useMemo(() => {
    const map = new Map<string, { 
      weekKey: string; 
      weekNum: number; 
      visitsCount: number; 
      dates: string[];
      firstDate: string;
      lastDate: string;
      dateRangeStr: string;
    }>();

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const curr = new Date(start);
      // Align curr to start of week (Sunday = day 0)
      const dayOffset = curr.getDay();
      curr.setDate(curr.getDate() - dayOffset);

      while (curr <= end) {
        const weekStartDate = new Date(curr);
        const weekEndDate = new Date(curr);
        weekEndDate.setDate(weekEndDate.getDate() + 6);

        const jan1 = new Date(curr.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((curr.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7);
        const weekKey = `${_t('الأسبوع', 'Week', 'Woche')} ${weekNum}`;

        const firstDateStr = weekStartDate.toISOString().split('T')[0];
        const lastDateStr = weekEndDate.toISOString().split('T')[0];

        // Find visits falling in this calendar week
        const weekVisits = planResult.plannedVisits.filter(v => v.date >= firstDateStr && v.date <= lastDateStr);

        if (!map.has(weekKey)) {
          map.set(weekKey, {
            weekKey,
            weekNum,
            visitsCount: weekVisits.length,
            dates: [firstDateStr, lastDateStr],
            firstDate: firstDateStr,
            lastDate: lastDateStr,
            dateRangeStr: `${firstDateStr} ${_t('إلى', 'to', 'bis')} ${lastDateStr}`
          });
        }

        curr.setDate(curr.getDate() + 7);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.firstDate.localeCompare(b.firstDate));
  }, [startDate, endDate, planResult.plannedVisits, _t]);

  // Current Week Info - ACCURATE matching against today's date
  const currentWeekInfo = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Try exact date range containment
    let matched = availableWeeksList.find(w => w.firstDate <= todayStr && todayStr <= w.lastDate);

    // 2. Try weekNum match
    if (!matched) {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const todayWeekNum = Math.ceil((((today.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
      matched = availableWeeksList.find(w => w.weekNum === todayWeekNum);
    }

    // 3. Try closest week to today
    if (!matched && availableWeeksList.length > 0) {
      let minDiff = Infinity;
      let closest = availableWeeksList[0];
      const todayTime = today.getTime();
      availableWeeksList.forEach(w => {
        const wTime = new Date(w.firstDate).getTime();
        const diff = Math.abs(todayTime - wTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = w;
        }
      });
      matched = closest;
    }

    return matched || availableWeeksList[0] || null;
  }, [availableWeeksList]);

  // Keep manualTargetWeekKey synced with current week if empty
  useEffect(() => {
    if (!manualTargetWeekKey && currentWeekInfo) {
      setManualTargetWeekKey(currentWeekInfo.weekKey);
    }
  }, [currentWeekInfo, manualTargetWeekKey]);

  // Date calculations for manual planner
  const manualTargetWeekObj = useMemo(() => {
    return availableWeeksList.find(w => w.weekKey === manualTargetWeekKey) || currentWeekInfo || availableWeeksList[0];
  }, [availableWeeksList, manualTargetWeekKey, currentWeekInfo]);

  const manualTargetDayDateStr = useMemo(() => {
    if (!manualTargetWeekObj || !manualTargetWeekObj.firstDate) return new Date().toISOString().split('T')[0];
    const base = new Date(manualTargetWeekObj.firstDate);
    if (isNaN(base.getTime())) return new Date().toISOString().split('T')[0];
    base.setDate(base.getDate() + Number(manualSelectedDayKey));
    return base.toISOString().split('T')[0];
  }, [manualTargetWeekObj, manualSelectedDayKey]);

  const periodTimings = useMemo(() => calculatePeriodsTimings(schoolSettings.periodSettings), [schoolSettings.periodSettings]);
  const periodsCount = periodTimings.length || 7;

  // Manual visit toggle
  const handleToggleManualVisit = (slot: { teacherId: string; teacherName: string; gradeClass: string; periodNumber: number }) => {
    const isAlready = planResult.plannedVisits.some(v => 
      v.date === manualTargetDayDateStr && 
      Number(v.periodNumber) === slot.periodNumber && 
      v.teacherId === slot.teacherId
    );

    let updatedVisits: PlannedVisitRecord[] = [];
    if (isAlready) {
      updatedVisits = planResult.plannedVisits.filter(v => !(
        v.date === manualTargetDayDateStr && 
        Number(v.periodNumber) === slot.periodNumber && 
        v.teacherId === slot.teacherId
      ));
      triggerToast(_t('تم إلغاء تحديد هذه الزيارة بنجاح', 'Visit deselected', 'Besuch entfernt'));
    } else {
      const pTiming = periodTimings.find(p => p.periodNumber === slot.periodNumber);
      const dayKey = manualSelectedDayKey;
      const WEEKDAY_NAMES_AR: Record<string, string> = { '0': 'الأحد', '1': 'الإثنين', '2': 'الثلاثاء', '3': 'الأربعاء', '4': 'الخميس', '5': 'الجمعة', '6': 'السبت' };
      const WEEKDAY_NAMES_EN: Record<string, string> = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };

      const newVisit: PlannedVisitRecord = {
        id: `manual_${slot.teacherId}_${manualTargetDayDateStr}_${slot.periodNumber}`,
        term: selectedTerm,
        teacherId: slot.teacherId,
        teacherName: slot.teacherName,
        gradeClass: slot.gradeClass,
        date: manualTargetDayDateStr,
        dayKey,
        weekdayNameAr: WEEKDAY_NAMES_AR[dayKey] || 'اليوم',
        weekdayNameEn: WEEKDAY_NAMES_EN[dayKey] || 'Day',
        periodNumber: slot.periodNumber,
        startTime: pTiming?.startTime,
        endTime: pTiming?.endTime,
        status: 'planned',
        isManualOverride: true,
        notes: `زيارة صفية مخصصة يدوياً - ${slot.gradeClass}`
      };

      updatedVisits = [...planResult.plannedVisits.filter(v => v.id !== newVisit.id), newVisit];
      triggerToast(_t(`تم تخصيص زيارة للمعلم (${slot.teacherName}) - صف (${slot.gradeClass}) 📅`, `Visit scheduled for ${slot.teacherName} (${slot.gradeClass}) 📅`, `Besuch eingeplant 📅`));
    }

    updateProfile({
      ...profile,
      schoolSettings: {
        ...schoolSettings,
        termVisitPlannerSettings: {
          ...planResult.settings,
          plannedVisits: updatedVisits
        }
      }
    });
  };

  // Helper to build active export options
  const getActiveExportOptions = (scopeOverride?: string): TermVisitReportExportOptions | undefined => {
    const scope = scopeOverride || exportScope;
    if (scope === 'weekly_2per_page') {
      return { exportLayout: 'weekly_2per_page', weekFilter: 'all' };
    }
    if (scope === 'weekly_4per_page') {
      return { exportLayout: 'weekly_4per_page', weekFilter: 'all' };
    }
    if (scope === 'current') {
      const target = currentWeekInfo;
      return {
        weekFilter: target ? target.weekKey : undefined,
        exportLayout: 'single_week',
        weekDateRange: target?.dateRangeStr
      };
    }
    if (scope.startsWith('week:')) {
      const weekKey = scope.replace('week:', '');
      const target = availableWeeksList.find(w => w.weekKey === weekKey);
      return {
        weekFilter: weekKey,
        exportLayout: 'single_week',
        weekDateRange: target?.dateRangeStr
      };
    }
    if (scope === 'term') {
      return { weekFilter: 'all', exportLayout: 'standard' };
    }
    return undefined;
  };

  // Handle PDF Export (Visits and their Plan)
  const handleExportPdf = async (scopeOverride?: string) => {
    const opts = getActiveExportOptions(scopeOverride);
    let scopeLabel = _t('الفصل بالكامل', 'Full Term', 'Ganzes Semester');
    if (opts?.exportLayout === 'weekly_2per_page') {
      scopeLabel = _t('خطة كل الأسابيع (أسبوعين في كل ورقة)', 'All Weeks Plan (2 Weeks/Sheet)', 'Alle Wochen (2/Blatt)');
    } else if (opts?.exportLayout === 'weekly_4per_page') {
      scopeLabel = _t('خطة كل الأسابيع (4 أسابيع في كل ورقة)', 'All Weeks Plan (4 Weeks/Sheet)', 'Alle Wochen (4/Blatt)');
    } else if (opts?.weekFilter && opts.weekFilter !== 'all') {
      scopeLabel = opts.weekFilter;
    }

    triggerToast(_t(`جاري إنشاء وتحميل تقرير (${scopeLabel}) PDF...`, `Generating (${scopeLabel}) PDF Report...`, `PDF-Bericht wird erstellt...`));
    const res = await downloadTermVisitPlanPdf(planResult, schoolSettings, isRtl, language, opts);
    if (res.success) {
      triggerToast(_t(`تم تحميل تقرير (${scopeLabel}) بنجاح 📄`, `Report (${scopeLabel}) downloaded successfully 📄`, `PDF heruntergeladen 📄`));
    } else {
      triggerToast(_t('تعذر تحميل التقرير، يرجى تجربة زر حفظ بالهاتف أو الطباعة', 'Failed to generate PDF, try Save to Phone or Print', 'PDF-Generierung fehlgeschlagen'));
    }
  };

  // Handle Save to Phone Storage
  const handleSaveToPhone = async (scopeOverride?: string) => {
    const opts = getActiveExportOptions(scopeOverride);
    let scopeLabel = _t('الفصل بالكامل', 'Full Term', 'Ganzes Semester');
    if (opts?.exportLayout === 'weekly_2per_page') {
      scopeLabel = _t('خطة كل الأسابيع (أسبوعين/ورقة)', 'All Weeks Plan (2 Weeks/Sheet)', 'Alle Wochen (2/Blatt)');
    } else if (opts?.exportLayout === 'weekly_4per_page') {
      scopeLabel = _t('خطة كل الأسابيع (4 أسابيع/ورقة)', 'All Weeks Plan (4 Weeks/Sheet)', 'Alle Wochen (4/Blatt)');
    } else if (opts?.weekFilter && opts.weekFilter !== 'all') {
      scopeLabel = opts.weekFilter;
    }

    triggerToast(_t(`جاري حفظ تقرير (${scopeLabel}) بمساحة الهاتف...`, `Saving report (${scopeLabel}) to phone storage...`, `Wird im Telefonspeicher gesichert...`));
    const res = await saveTermVisitPlanToPhoneStorage(planResult, schoolSettings, isRtl, language, opts);
    if (res.success) {
      triggerToast(_t(`تم حفظ تقرير (${scopeLabel}) بنجاح في مساحة الهاتف 📱`, `Report (${scopeLabel}) saved to phone storage successfully 📱`, `Erfolgreich auf Telefon gespeichert 📱`));
    } else {
      triggerToast(_t('تعذر حفظ التقرير في مساحة الهاتف', 'Failed to save report to phone storage', 'Fehler beim Speichern'));
    }
  };

  // Handle Direct Print
  const handlePrint = (scopeOverride?: string) => {
    const opts = getActiveExportOptions(scopeOverride);
    printTermVisitPlanReport(planResult, schoolSettings, isRtl, language, opts);
  };

  // Filter Visits
  const filteredVisits = useMemo(() => {
    return planResult.plannedVisits.filter(v => {
      if (selectedTeacherFilter !== 'all' && v.teacherId !== selectedTeacherFilter) return false;
      if (selectedStatusFilter !== 'all' && v.status !== selectedStatusFilter) return false;
      if (selectedClassFilter !== 'all' && v.gradeClass !== selectedClassFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTeacher = v.teacherName.toLowerCase().includes(q);
        const matchClass = v.gradeClass.toLowerCase().includes(q);
        const matchDate = v.date.includes(q);
        if (!matchTeacher && !matchClass && !matchDate) return false;
      }
      return true;
    });
  }, [planResult.plannedVisits, selectedTeacherFilter, selectedStatusFilter, selectedClassFilter, searchQuery]);

  // Unique Classes list for filter
  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    planResult.requirements.forEach(r => set.add(r.gradeClass));
    return Array.from(set).sort();
  }, [planResult.requirements]);

  // Unique Teachers list for filter
  const teachersList = useMemo(() => {
    return (schoolSettings.teachers || []).filter(t => t.isActive && !t.isHod);
  }, [schoolSettings.teachers]);

  // Group Visits by Week
  const weeklyVisitsMap = useMemo(() => {
    const map = new Map<string, PlannedVisitRecord[]>();
    filteredVisits.forEach(v => {
      const dateObj = new Date(v.date);
      if (isNaN(dateObj.getTime())) return;
      const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
      const weekNum = Math.ceil((((dateObj.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
      const weekKey = `${_t('الأسبوع', 'Week', 'Woche')} ${weekNum}`;
      if (!map.has(weekKey)) map.set(weekKey, []);
      map.get(weekKey)!.push(v);
    });
    return map;
  }, [filteredVisits, _t]);

  // Manual Reschedule Save
  const handleSaveReschedule = () => {
    if (!editingVisit || !newDate) return;

    // Update in plannedVisits
    const updatedVisits = planResult.plannedVisits.map(v => {
      if (v.id === editingVisit.id) {
        return {
          ...v,
          date: newDate,
          periodNumber: newPeriod,
          status: 'rescheduled' as VisitPlannerStatus,
          isManualOverride: true,
          rescheduledFromDate: v.date,
          rescheduledFromPeriod: v.periodNumber,
          notes: rescheduleNotes ? `${v.notes || ''} | ${rescheduleNotes}` : v.notes
        };
      }
      return v;
    });

    updateProfile({
      ...profile,
      schoolSettings: {
        ...schoolSettings,
        termVisitPlannerSettings: {
          ...planResult.settings,
          plannedVisits: updatedVisits
        }
      }
    });

    setEditingVisit(null);
    triggerToast(_t('تم تحديث موعد الزيارة بنجاح 📅', 'Visit rescheduled successfully 📅', 'Termin geändert 📅'));
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto pb-12 font-sans text-xs select-none">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-xl font-bold text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header & Export Controls - Ultra-Compact & Shifting Everything Upwards */}
      <div className="p-2 sm:p-2.5 bg-surface border border-surface-border rounded-xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5">
              <span>{_t('مُخطط الزيارات الصفية وخطة الفصل', 'Classroom Visits & Term Plan', 'Besuchsplaner')}</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-black">
                {selectedTerm}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Export Scope Selector Dropdown */}
          <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-lg border border-surface-border">
            <span className="text-[10px] font-extrabold text-text-muted px-1 hidden sm:inline">
              {_t('الخطة المطلوبة:', 'Scope:', 'Umfang:')}
            </span>
            <select
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value)}
              className="px-2 py-0.5 rounded-md bg-surface border border-surface-border text-xs font-black text-primary cursor-pointer focus:ring-1 focus:ring-primary"
            >
              <option value="weekly_2per_page">
                📄 {_t('كل الأسابيع (أسبوعين في كل ورقة PDF)', 'All Weeks (2 Weeks/Sheet)', 'Alle Wochen (2/Blatt)')}
              </option>
              <option value="weekly_4per_page">
                📑 {_t('كل الأسابيع (4 أسابيع في كل ورقة PDF)', 'All Weeks (4 Weeks/Sheet)', 'Alle Wochen (4/Blatt)')}
              </option>
              <option value="current">
                📌 {_t('الأسبوع الحالي فقط', 'Current Week Only', 'Nur aktuelle Woche')}
              </option>
              {availableWeeksList.map(w => (
                <option key={w.weekKey} value={`week:${w.weekKey}`}>
                  🗓️ {w.weekKey} ({w.dateRangeStr})
                </option>
              ))}
              <option value="term">
                📊 {_t('تقرير الفصل الدراسي الكامل', 'Full Term Summary', 'Gesamtbericht')}
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className="px-2 py-1 rounded-lg bg-surface-hover hover:bg-surface-border border border-surface-border text-text-main font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{_t('إعدادات الخطة', 'Plan Config', 'Konfig')}</span>
            {showConfigDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={() => setShowRegenConfirm(true)}
            className="px-2 py-1 rounded-lg bg-surface-hover hover:bg-surface-border border border-surface-border text-text-main font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{_t('إعادة الحساب', 'Recalculate', 'Neu berechnen')}</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrint()}
            className="px-2 py-1 rounded-lg bg-surface-hover hover:bg-surface-border border border-surface-border text-text-main font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title={_t('طباعة فورية للتقرير', 'Direct Print', 'Drucken')}
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>{_t('طباعة', 'Print', 'Drucken')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveToPhone()}
            className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold flex items-center gap-1 cursor-pointer shadow-xs transition-all active:scale-95 text-xs"
            title={_t('حفظ الخطة المحددة مباشرة في مساحة تخزين الهاتف والملفات', 'Save selected plan to phone storage', 'Auf Telefon sichern')}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{_t('حفظ بالهاتف 📱', 'Save to Phone 📱', 'Auf Telefon 📱')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportPdf()}
            className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 text-xs"
            title={_t('تحميل ملف PDF المعتمد للخطة المحددة', 'Download approved PDF for selected scope', 'PDF herunterladen')}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{_t('تحميل الخطة (PDF)', 'Download Plan (PDF)', 'Plan (PDF)')}</span>
          </button>
        </div>
      </div>

      {/* Config Drawer */}
      {showConfigDrawer && (
        <div className="p-3.5 bg-surface border border-primary/30 rounded-2xl shadow-md space-y-3 animate-fade-in">
          <h3 className="font-extrabold text-xs text-text-main flex items-center gap-1.5 border-b border-surface-border pb-2">
            <Clock className="w-4 h-4 text-primary" />
            <span>{_t('إعدادات الفصل الدراسي وأيام العمل', 'Term Dates & Working Days Settings', 'Semester & Arbeitstage')}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('الفصل الدراسي', 'Term', 'Semester')}</label>
              <input
                type="text"
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-hover border border-surface-border font-bold text-xs text-text-main"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('تاريخ البداية', 'Start Date', 'Startdatum')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-hover border border-surface-border font-bold text-xs text-text-main"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('تاريخ النهاية', 'End Date', 'Enddatum')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-hover border border-surface-border font-bold text-xs text-text-main"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('عدد الزيارات لكل فصل', 'Visits per Class', 'Besuche pro Klasse')}</label>
              <input
                type="number"
                min="1"
                max="5"
                value={visitsPerClass}
                onChange={(e) => setVisitsPerClass(Number(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-hover border border-surface-border font-bold text-xs text-text-main"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('أيام العمل المتاحة للزيارات', 'Working Days for Visits', 'Arbeitstage')}</label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: '0', labelAr: 'الأحد', labelEn: 'Sunday' },
                { key: '1', labelAr: 'الإثنين', labelEn: 'Monday' },
                { key: '2', labelAr: 'الثلاثاء', labelEn: 'Tuesday' },
                { key: '3', labelAr: 'الأربعاء', labelEn: 'Wednesday' },
                { key: '4', labelAr: 'الخميس', labelEn: 'Thursday' },
                { key: '5', labelAr: 'الجمعة', labelEn: 'Friday' },
                { key: '6', labelAr: 'السبت', labelEn: 'Saturday' },
              ].map(day => {
                const active = workingDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleWorkingDay(day.key)}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold cursor-pointer border transition-all ${
                      active 
                        ? 'bg-primary text-white border-primary shadow-2xs' 
                        : 'bg-surface-hover text-text-muted border-surface-border hover:text-text-main'
                    }`}
                  >
                    {isRtl ? day.labelAr : day.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Row: Explicit Save & Apply Button */}
          <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                savePlanConfig({
                  term: selectedTerm,
                  startDate,
                  endDate,
                  workingDays,
                  visitsPerTeacherPerClass: visitsPerClass,
                  lastGeneratedAt: new Date().toISOString()
                });
                triggerToast(_t('تم حفظ التعديلات وإعادة حساب وتوليد الخطة بنجاح 💾', 'Settings saved & visit plan recalculated successfully 💾', 'Einstellungen gespeichert 💾'));
                setShowConfigDrawer(false);
              }}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{_t('حفظ التعديلات وتطبيق الخطة 💾', 'Save Settings & Apply Plan 💾', 'Speichern & Anwenden 💾')}</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Bar - Ultra-Compact Strip */}
      <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-surface border border-surface-border rounded-xl text-center text-xs">
        <div className="p-1 bg-surface-hover rounded-lg">
          <span className="text-[10px] font-bold text-text-muted block leading-tight">{_t('المطلوبة', 'Required', 'Erfordert')}</span>
          <span className="text-xs sm:text-sm font-black text-text-main">{planResult.summary.totalRequirements}</span>
        </div>

        <div className="p-1 bg-emerald-500/10 rounded-lg">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block leading-tight">{_t('المنفذة', 'Completed', 'Erledigt')}</span>
          <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">{planResult.summary.completedCount}</span>
        </div>

        <div className="p-1 bg-blue-500/10 rounded-lg">
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block leading-tight">{_t('المجدولة', 'Planned', 'Geplant')}</span>
          <span className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400">{planResult.summary.plannedCount}</span>
        </div>

        <div className="p-1 bg-rose-500/10 rounded-lg">
          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block leading-tight">{_t('غير مجدولة', 'Unscheduled', 'Ungeplant')}</span>
          <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">{planResult.summary.unscheduledCount}</span>
        </div>

        <div className="p-1 bg-amber-500/10 rounded-lg">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block leading-tight">{_t('التغطية', 'Coverage', 'Abdeckung')}</span>
          <span className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">{planResult.summary.coveragePercentage}%</span>
        </div>
      </div>

      {/* Filter & View Switcher Toolbar - Ultra-Compact */}
      <div className="p-1.5 sm:p-2 bg-surface border border-surface-border rounded-xl shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-1.5">
        {/* View Modes */}
        <div className="flex items-center gap-1 bg-surface-hover p-0.5 rounded-lg border border-surface-border shrink-0 flex-wrap">
          {[
            { id: 'schedule', label: _t('الجدول الزمني', 'Schedule', 'Zeitplan') },
            { id: 'weekly', label: _t('العرض الأسبوعي', 'Weekly Overview', 'Wöchentlich') },
            { id: 'manual', label: _t('تخطيط يدوي للحصص 🖐️', 'Manual Builder 🖐️', 'Manuell 🖐️') },
            { id: 'teachers', label: _t('حسب المعلم', 'By Teacher', 'Nach Lehrer') },
            { id: 'requirements', label: _t('المتطلبات', 'Requirements', 'Anforderungen') },
          ].map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveViewMode(m.id as any)}
              className={`px-2 py-0.5 rounded-md font-bold text-[11px] sm:text-xs cursor-pointer transition-all ${
                activeViewMode === m.id
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Search & Dropdown Filters */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
          {planResult.conflicts.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-400 font-extrabold text-[10px] shrink-0" title={planResult.conflicts.map(c => `${c.teacherName}: ${c.reason}`).join(' | ')}>
              ⚠️ {planResult.conflicts.length} {_t('تعارض', 'conflicts', 'Konflikte')}
            </span>
          )}

          <input
            type="text"
            placeholder={_t('بحث بالمعلم أو الفصل...', 'Search...', 'Suchen...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2 py-1 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main w-full sm:w-40"
          />

          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="px-2 py-1 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
          >
            <option value="all">{_t('جميع المعلمين', 'All Teachers', 'Alle Lehrer')}</option>
            {teachersList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-2 py-1 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
          >
            <option value="all">{_t('جميع الحالات', 'All Statuses', 'Alle Status')}</option>
            <option value="completed">{_t('مكتملة', 'Completed', 'Abgeschlossen')}</option>
            <option value="planned">{_t('مجدولة', 'Planned', 'Geplant')}</option>
            <option value="rescheduled">{_t('معاد جدولتها', 'Rescheduled', 'Umgeschrieben')}</option>
          </select>

          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-2 py-1 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
          >
            <option value="all">{_t('جميع الفصول', 'All Classes', 'Alle Klassen')}</option>
            {uniqueClasses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* VIEW 1: FULL CHRONOLOGICAL SCHEDULE */}
      {activeViewMode === 'schedule' && (
        <div className="p-3.5 bg-surface border border-surface-border rounded-2xl shadow-2xs space-y-2">
          <h3 className="font-extrabold text-xs text-text-main border-b border-surface-border pb-2 flex items-center justify-between">
            <span>{_t('الجدول الزمني للزيارات الصفية المجدولة والمنفذة', 'Chronological Visit Schedule', 'Chronologischer Besuchsplan')}</span>
            <span className="text-[11px] text-text-muted font-normal">{filteredVisits.length} {_t('زيارات', 'visits', 'Besuche')}</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-border text-text-muted font-extrabold text-[11px] text-start">
                  <th className="p-2 text-start">#</th>
                  <th className="p-2 text-start">{_t('التاريخ واليوم', 'Date & Day', 'Datum & Tag')}</th>
                  <th className="p-2 text-start">{_t('الحصة والوقت', 'Period & Time', 'Stunde & Zeit')}</th>
                  <th className="p-2 text-start">{_t('اسم المعلم', 'Teacher', 'Lehrer')}</th>
                  <th className="p-2 text-start">{_t('الصف / الفصل', 'Grade / Class', 'Klasse')}</th>
                  <th className="p-2 text-start">{_t('الحالة', 'Status', 'Status')}</th>
                  <th className="p-2 text-center">{_t('إجراءات', 'Actions', 'Aktionen')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-muted font-bold">
                      {_t('لا توجد زيارات تطابق خيارات الفلترة المحددة', 'No visits match the selected filter options', 'Keine Besuche gefunden')}
                    </td>
                  </tr>
                ) : (
                  filteredVisits.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-surface-hover transition-colors">
                      <td className="p-2 font-bold text-text-muted">{idx + 1}</td>
                      <td className="p-2 font-bold text-text-main">
                        <div>{v.date}</div>
                        <div className="text-[10px] text-text-muted font-normal">{isRtl ? v.weekdayNameAr : v.weekdayNameEn}</div>
                      </td>
                      <td className="p-2 font-bold text-text-main">
                        <div>{_t('الحصة', 'Period', 'Stunde')} {v.periodNumber}</div>
                        {v.startTime && <div className="text-[10px] text-text-muted font-normal">{v.startTime} - {v.endTime}</div>}
                      </td>
                      <td className="p-2 font-black text-primary">{v.teacherName}</td>
                      <td className="p-2 font-bold text-text-main">{v.gradeClass}</td>
                      <td className="p-2 font-bold">
                        {v.status === 'completed' && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-black text-[10px]">
                            ✓ {_t('منفذة فعلياً', 'Completed', 'Abgeschlossen')}
                          </span>
                        )}
                        {v.status === 'planned' && (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 font-black text-[10px]">
                            📅 {_t('مجدولة', 'Planned', 'Geplant')}
                          </span>
                        )}
                        {v.status === 'rescheduled' && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-[10px]">
                            🔄 {_t('معاد جدولتها', 'Rescheduled', 'Umgeschrieben')}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {v.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVisit(v);
                              setNewDate(v.date);
                              setNewPeriod(v.periodNumber);
                              setRescheduleNotes('');
                            }}
                            className="px-2 py-1 rounded-lg bg-surface-hover hover:bg-surface-border text-text-main border border-surface-border font-bold text-[10px] cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3 text-primary inline-block me-1" />
                            <span>{_t('تعديل الموعد', 'Reschedule', 'Ändern')}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: WEEKLY BREAKDOWN */}
      {activeViewMode === 'weekly' && (
        <div className="space-y-3">
          {/* Weekly Plan Action Banner */}
          <div className="p-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div>
              <h3 className="font-black text-xs text-primary flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{_t('الخطة الأسبوعية المعتمدة للزيارات الصفية', 'Weekly Classroom Visit Schedule', 'Wöchentlicher Besuchsplan')}</span>
              </h3>
              <p className="text-[11px] text-text-muted font-bold mt-0.5">
                {_t('خط عريض ومكبر يبرز إسم المدرس، الفصل، واليوم لإنجاز الخطة أسبوعاً بأسبوع', 'Clear & large font highlighting Teacher, Class & Day', 'Große Schrift für Lehrer, Klasse & Tag')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleExportPdf('weekly_4per_page')}
                className="px-2.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                title={_t('تحميل كل الأسابيع بأسلوب 4 أسابيع في كل ورقة', 'Download all weeks formatted 4 weeks per sheet', '4 Wochen/Blatt PDF')}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{_t('تحميل كل الأسابيع (4 في كل ورقة PDF)', 'Download All Weeks (4/Sheet PDF)', 'Alle Wochen (4/Blatt PDF)')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportPdf('current')}
                className="px-2.5 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border text-text-main border border-surface-border font-extrabold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>{_t('تحميل الأسبوع الحالي فقط', 'Download Current Week Only', 'Nur aktuelle Woche')}</span>
              </button>
            </div>
          </div>

          {Array.from(weeklyVisitsMap.entries()).map(([weekTitle, weekVisits]) => (
            <div key={weekTitle} className="p-3.5 bg-surface border border-surface-border rounded-2xl shadow-2xs space-y-2.5">
              <div className="border-b border-surface-border pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <h4 className="font-black text-sm text-primary flex items-center gap-2">
                  <span>📅 {weekTitle}</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-hover text-text-muted text-xs font-extrabold border border-surface-border">
                    {weekVisits.length} {_t('زيارات', 'visits', 'Besuche')}
                  </span>
                </h4>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportPdf(`week:${weekTitle}`)}
                    className="px-2.5 py-1 rounded-lg bg-surface-hover hover:bg-surface-border text-primary border border-primary/20 font-black text-[11px] flex items-center gap-1 cursor-pointer"
                    title={_t('تحميل تقرير خطة هذا الأسبوع كملف PDF', 'Download PDF for this week', 'Wochen-PDF')}
                  >
                    <Download className="w-3 h-3" />
                    <span>{_t('تحميل خطة هذا الأسبوع PDF', 'Download Week PDF', 'Wochen-PDF')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveToPhone(`week:${weekTitle}`)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                    title={_t('حفظ خطة هذا الأسبوع بمساحة الهاتف', 'Save this week to phone', 'Auf Telefon')}
                  >
                    <Save className="w-3 h-3" />
                    <span>{_t('حفظ بالهاتف 📱', 'Save to Phone 📱', 'Auf Telefon 📱')}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {weekVisits.map(v => (
                  <div key={v.id} className="p-3 bg-surface-hover border border-surface-border hover:border-primary/40 rounded-xl space-y-1.5 transition-all shadow-2xs">
                    <div className="flex items-start justify-between gap-2 border-b border-surface-border/60 pb-1.5">
                      <span className="font-black text-primary text-sm sm:text-base leading-tight">{v.teacherName}</span>
                      <span className="font-black text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md shrink-0">
                        {v.gradeClass}
                      </span>
                    </div>

                    <div className="text-xs font-extrabold text-text-main flex items-center justify-between pt-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-700 dark:text-emerald-400 font-black">{isRtl ? v.weekdayNameAr : v.weekdayNameEn}</span>
                        <span className="text-text-muted font-normal text-[11px]">({v.date})</span>
                      </div>
                      <span className="text-primary font-black">
                        {_t('حصة', 'Period', 'Stunde')} {v.periodNumber}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 3: INTERACTIVE MANUAL VISIT BUILDER */}
      {activeViewMode === 'manual' && (
        <div className="space-y-3.5">
          {/* Header Banner */}
          <div className="p-3.5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl space-y-2.5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-xs sm:text-sm text-primary flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span>{_t('المُخطط اليدوي التفاعلي للزيارات (اختر حصصك بنفسك)', 'Interactive Manual Weekly Visit Builder', 'Manuelle Besuchsplanung')}</span>
                </h3>
                <p className="text-[11px] text-text-muted font-bold mt-0.5">
                  {_t('يعرض جدولك المعتمد وجدول جميع المعلمين، اختر الحصص المتاحة التي ترغب بزيارتها ثم قم بتنزيل الخطة الأسبوعية مباشرة.', 'View your schedule & all teacher classes, pick slots to visit, and download.', 'Anzeigen und Besuche auswählen.')}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExportPdf(manualTargetWeekKey ? `week:${manualTargetWeekKey}` : 'current')}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{_t('تحميل خطة هذا الأسبوع (PDF)', 'Download Week Plan (PDF)', 'Wochen-PDF')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveToPhone(manualTargetWeekKey ? `week:${manualTargetWeekKey}` : 'current')}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{_t('حفظ بالهاتف 📱', 'Save to Phone 📱', 'Auf Telefon 📱')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint(manualTargetWeekKey ? `week:${manualTargetWeekKey}` : 'current')}
                  className="px-3 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border text-text-main font-extrabold text-xs flex items-center gap-1 border border-surface-border cursor-pointer transition-all active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('طباعة 🖨️', 'Print 🖨️', 'Drucken 🖨️')}</span>
                </button>
              </div>
            </div>

            {/* Week & Day Selection Controls */}
            <div className="pt-2 border-t border-primary/15 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-text-main shrink-0">{_t('الأسبوع المستهدف:', 'Target Week:', 'Woche:')}</label>
                <select
                  value={manualTargetWeekKey}
                  onChange={(e) => setManualTargetWeekKey(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-surface border border-primary/30 text-xs font-black text-primary cursor-pointer shadow-2xs"
                >
                  {availableWeeksList.map(w => (
                    <option key={w.weekKey} value={w.weekKey}>
                      🗓️ {w.weekKey} ({w.dateRangeStr}) [{w.visitsCount} {_t('زيارات', 'visits', 'Besuche')}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Day Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: '0', labelAr: 'الأحد', labelEn: 'Sunday' },
                  { key: '1', labelAr: 'الإثنين', labelEn: 'Monday' },
                  { key: '2', labelAr: 'الثلاثاء', labelEn: 'Tuesday' },
                  { key: '3', labelAr: 'الأربعاء', labelEn: 'Wednesday' },
                  { key: '4', labelAr: 'الخميس', labelEn: 'Thursday' },
                ].map(d => {
                  const active = manualSelectedDayKey === d.key;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setManualSelectedDayKey(d.key)}
                      className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer border transition-all ${
                        active 
                          ? 'bg-primary text-white border-primary shadow-xs scale-105' 
                          : 'bg-surface hover:bg-surface-hover text-text-muted border-surface-border'
                      }`}
                    >
                      {isRtl ? d.labelAr : d.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-[11px] font-extrabold text-primary flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-primary/10">
              <div className="flex items-center gap-1.5">
                <span>📆 {_t('التاريخ المحدد:', 'Selected Date:', 'Datum:')} <strong>{manualTargetDayDateStr}</strong></span>
                <span>•</span>
                <span>{_t('إجمالي زيارات هذا الأسبوع:', 'Total Week Visits:', 'Besuche:')} <strong>{planResult.plannedVisits.filter(v => v.date >= (manualTargetWeekObj?.firstDate || '') && v.date <= (manualTargetWeekObj?.lastDate || '')).length}</strong></span>
              </div>
              
              <span className="text-text-muted text-[10px]">
                {_t('اضغط على أي حصة مخصصة للمعلم لتحديدها أو إلغاء تحديدها فوراً', 'Click any teacher class slot to toggle visit', 'Klicken zum Auswählen')}
              </span>
            </div>
          </div>

          {/* Periods Matrix (Periods 1 to 8) */}
          <div className="space-y-3">
            {Array.from({ length: periodsCount }, (_, i) => i + 1).map(pNum => {
              const pTiming = periodTimings.find(p => p.periodNumber === pNum);
              const hodRecs = (schoolSettings.schedule?.[manualSelectedDayKey] || []).filter(r => Number(r.periodNumber) === pNum);
              const isHodTeaching = hodRecs.some(r => r.subjectName || r.className);
              const hodTeachingInfo = hodRecs.map(r => `${r.subjectName || ''} (${r.className || ''})`).filter(Boolean).join(', ');

              // Find all teacher classes in this day & period
              const teacherSchedules = schoolSettings.teacherSchedules || {};
              const periodTeacherSlots: Array<{ teacherId: string; teacherName: string; gradeClass: string }> = [];

              teachersList.forEach(t => {
                const tSched = teacherSchedules[t.id]?.[manualSelectedDayKey] || [];
                const matchedRec = tSched.find(r => Number(r.periodNumber) === pNum);
                if (matchedRec && matchedRec.className && matchedRec.className.trim()) {
                  periodTeacherSlots.push({
                    teacherId: t.id,
                    teacherName: t.name,
                    gradeClass: matchedRec.className.trim()
                  });
                }
              });

              return (
                <div key={pNum} className="p-3 bg-surface border border-surface-border rounded-2xl shadow-2xs space-y-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 border-b border-surface-border pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-black text-xs">
                        {_t('الحصة', 'Period', 'Stunde')} {pNum}
                      </span>
                      {pTiming?.startTime && (
                        <span className="text-xs font-extrabold text-text-muted">
                          ({pTiming.startTime} - {pTiming.endTime})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="text-text-muted">{_t('جدولك الخطي:', 'My Status:', 'Mein Status:')}</span>
                      {isHodTeaching ? (
                        <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-400 font-black text-[11px]">
                          ⚠️ {_t('حصة تدريس:', 'Teaching:', 'Unterricht:')} {hodTeachingInfo || _t('حصة رسمية', 'Class', 'Klasse')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-black text-[11px]">
                          🟢 {_t('أنت متفرغ للزيارات الصفية 👍', 'You are free for visits 👍', 'Frei 👍')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teacher Classes Grid for Period P */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {periodTeacherSlots.length === 0 ? (
                      <div className="p-2.5 text-center text-text-muted font-bold text-xs col-span-full">
                        {_t('لا توجد حصص تدريسية للمعلمين في هذه الحصة', 'No teacher classes in this period', 'Keine Klassen')}
                      </div>
                    ) : (
                      periodTeacherSlots.map(slot => {
                        const isSelected = planResult.plannedVisits.some(v => 
                          v.date === manualTargetDayDateStr && 
                          Number(v.periodNumber) === pNum && 
                          v.teacherId === slot.teacherId
                        );

                        return (
                          <div 
                            key={`${slot.teacherId}_${pNum}`}
                            onClick={() => handleToggleManualVisit({ ...slot, periodNumber: pNum })}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 select-none ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-xs ring-1 ring-emerald-500'
                                : 'bg-surface-hover hover:bg-surface-border border-surface-border hover:border-primary/40 text-text-main'
                            }`}
                          >
                            <div>
                              <div className="font-black text-xs text-primary">{slot.teacherName}</div>
                              <div className="text-[11px] font-extrabold text-text-main mt-0.5 flex items-center gap-1">
                                <span>🏫 {slot.gradeClass}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-primary/10 hover:bg-primary text-primary hover:text-white'
                              }`}
                            >
                              {isSelected ? `✓ ${_t('محددة للزيارة', 'Selected', 'Gewählt')}` : `➕ ${_t('اختيار', 'Select', 'Wählen')}`}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 4: BY TEACHER MATRIX */}
      {activeViewMode === 'teachers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {teachersList.map(t => {
            const tVisits = filteredVisits.filter(v => v.teacherId === t.id);
            const tReqs = planResult.requirements.filter(r => r.teacherId === t.id);
            const completedCount = tReqs.filter(r => r.isSatisfied).length;

            return (
              <div key={t.id} className="p-3.5 bg-surface border border-surface-border rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-text-main">{t.name}</h4>
                      <p className="text-[10px] text-text-muted font-bold">{tReqs.length} {_t('فصول مخصصة', 'classes assigned', 'Klassen')}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-extrabold text-[10px]">
                    {completedCount} / {tReqs.length} {_t('مكتملة', 'done', 'erledigt')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {tVisits.map(v => (
                    <div key={v.id} className="p-2 bg-surface-hover rounded-xl border border-surface-border flex items-center justify-between text-[11px]">
                      <div>
                        <div className="font-bold text-text-main">{v.gradeClass}</div>
                        <div className="text-[10px] text-text-muted">{v.date} (حصة {v.periodNumber})</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                        v.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-blue-500/15 text-blue-600'
                      }`}>
                        {v.status === 'completed' ? '✓ مكتملة' : '📅 مجدولة'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 4: REQUIREMENTS COVERAGE */}
      {activeViewMode === 'requirements' && (
        <div className="p-3.5 bg-surface border border-surface-border rounded-2xl shadow-2xs space-y-2">
          <h3 className="font-extrabold text-xs text-text-main border-b border-surface-border pb-2">
            {_t('متطلبات الزيارات حسب كل معلم وفصل مع حالة الاستيفاء', 'Visit Requirements Coverage Table', 'Anforderungen Übersicht')}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-border text-text-muted font-extrabold text-[11px] text-start">
                  <th className="p-2 text-start">#</th>
                  <th className="p-2 text-start">{_t('المعلم', 'Teacher', 'Lehrer')}</th>
                  <th className="p-2 text-start">{_t('الصف / الفصل', 'Grade / Class', 'Klasse')}</th>
                  <th className="p-2 text-center">{_t('المطلوب', 'Required', 'Erforderlich')}</th>
                  <th className="p-2 text-center">{_t('المنفذ', 'Completed', 'Erledigt')}</th>
                  <th className="p-2 text-center">{_t('المجدول', 'Planned', 'Geplant')}</th>
                  <th className="p-2 text-center">{_t('حالة التغطية', 'Coverage Status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {planResult.requirements.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-surface-hover transition-colors">
                    <td className="p-2 font-bold text-text-muted">{idx + 1}</td>
                    <td className="p-2 font-black text-primary">{req.teacherName}</td>
                    <td className="p-2 font-bold text-text-main">{req.gradeClass}</td>
                    <td className="p-2 text-center font-bold">{req.requiredVisitsCount}</td>
                    <td className="p-2 text-center font-extrabold text-emerald-600 dark:text-emerald-400">{req.completedVisitsCount}</td>
                    <td className="p-2 text-center font-extrabold text-blue-600 dark:text-blue-400">{req.plannedVisitsCount}</td>
                    <td className="p-2 text-center">
                      {req.isSatisfied ? (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-black text-[10px]">
                          ✓ {_t('مكتملة 100%', 'Satisfied 100%', '100%')}
                        </span>
                      ) : req.plannedVisitsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 font-black text-[10px]">
                          📅 {_t('مجدولة مقدماً', 'Planned', 'Geplant')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-400 font-black text-[10px]">
                          ⚠️ {_t('غير مجدولة (تعارض)', 'Unscheduled', 'Ungeplant')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Reschedule Modal */}
      {editingVisit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl p-4 max-w-md w-full shadow-2xl space-y-3 animate-scale-up">
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <h3 className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-primary" />
                <span>{_t('تعديل موعد الزيارة الصفية', 'Reschedule Visit', 'Termin ändern')}</span>
              </h3>
              <button type="button" onClick={() => setEditingVisit(null)} className="text-text-muted hover:text-text-main">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 bg-surface-hover rounded-xl text-xs space-y-1">
              <div><strong className="text-primary">{editingVisit.teacherName}</strong> ({editingVisit.gradeClass})</div>
              <div className="text-[11px] text-text-muted">{_t('الموعد الحالي:', 'Current:', 'Aktuell:')} {editingVisit.date} - {_t('حصة', 'Period', 'Stunde')} {editingVisit.periodNumber}</div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('التاريخ الجديد', 'New Date', 'Neues Datum')}</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('رقم الحصة', 'Period Number', 'Stundennummer')}</label>
                <select
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                    <option key={p} value={p}>{_t('الحصة', 'Period', 'Stunde')} {p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1">{_t('سبب التعديل / ملاحظات', 'Notes / Reason', 'Grund')}</label>
                <input
                  type="text"
                  placeholder={_t('مثال: بطلب من المعلم أو تبادل حصص...', 'e.g. Requested by teacher...', 'Grund...')}
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setEditingVisit(null)}
                className="px-3 py-1.5 rounded-xl bg-surface-hover text-text-main font-bold text-xs cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>

              <button
                type="button"
                onClick={handleSaveReschedule}
                className="px-3 py-1.5 rounded-xl bg-primary text-white font-extrabold text-xs cursor-pointer shadow-2xs"
              >
                {_t('حفظ التعديل', 'Save Changes', 'Speichern')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recalculate Confirmation Modal */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl p-4 max-w-md w-full shadow-2xl space-y-3 animate-scale-up">
            <div className="flex items-center gap-2 text-primary border-b border-surface-border pb-2">
              <RefreshCw className="w-5 h-5" />
              <h3 className="font-extrabold text-xs text-text-main">{_t('إعادة جدول الخطة وحساب المواعيد', 'Recalculate Plan Schedule', 'Neu berechnen')}</h3>
            </div>

            <p className="text-xs font-semibold text-text-main leading-relaxed">
              {_t(
                'سيتم إعادة توزيع الزيارات المجدولة بناءً على أحدث التحديثات للجداول الدراسية. ولن يتم المساس مطلقاً بأي زيارات منفذة ومكتملة سابقاً.',
                'Future planned visits will be recalculated based on the latest timetables. Historical completed visits will remain untouched.',
                'Zukünftige Besuche werden neu berechnet. Historische Daten bleiben unverändert.'
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="px-3 py-1.5 rounded-xl bg-surface-hover text-text-main font-bold text-xs cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRegenConfirm(false);
                  triggerToast(_t('تم إعادة حساب الخطة بنجاح 🔄', 'Plan recalculated successfully 🔄', 'Plan neu berechnet 🔄'));
                }}
                className="px-3 py-1.5 rounded-xl bg-primary text-white font-extrabold text-xs cursor-pointer shadow-2xs"
              >
                {_t('تأكيد وبدء الحساب', 'Confirm Recalculate', 'Bestätigen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
