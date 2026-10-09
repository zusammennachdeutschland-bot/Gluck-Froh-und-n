import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar, Clock, CheckCircle2, AlertTriangle, RefreshCw, Printer, Download,
  Filter, Users, User, BookOpen, Layers, Check, X, ShieldAlert, Sparkles,
  ChevronRight, ArrowRight, Eye, Edit3, Plus, ArrowLeftRight, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  generateTermVisitPlan, getDefaultTermDates, GenerationResult 
} from '../services/termVisitPlannerService';
import { 
  downloadTermVisitPlanPdf, printTermVisitPlanReport 
} from '../utils/termVisitPrintUtils';
import { PlannedVisitRecord, VisitPlannerStatus, TermVisitRequirement } from '../types';

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
  const [activeViewMode, setActiveViewMode] = useState<'schedule' | 'weekly' | 'teachers' | 'requirements'>('schedule');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Handle PDF Export
  const handleExportPdf = async () => {
    triggerToast(_t('جاري إنشاء تقرير خطة الزيارات PDF...', 'Generating Principal PDF Report...', 'PDF-Bericht wird erstellt...'));
    const res = await downloadTermVisitPlanPdf(planResult, schoolSettings, isRtl, language);
    if (res.success) {
      triggerToast(_t('تم تحميل تقرير الخطة بنجاح 📄', 'PDF Report downloaded successfully 📄', 'PDF heruntergeladen 📄'));
    } else {
      triggerToast(_t('تعذر تحميل التقرير', 'Failed to generate PDF', 'PDF-Generierung fehlgeschlagen'));
    }
  };

  // Handle Direct Print
  const handlePrint = () => {
    printTermVisitPlanReport(planResult, schoolSettings, isRtl, language);
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

      {/* Top Header & Export Controls */}
      <div className="p-3.5 bg-surface border border-surface-border rounded-2xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-text-main flex items-center gap-1.5">
              <span>{_t('مُخطط الزيارات الصفية للفصل الدراسي', 'Term Visit Planner', 'Semester-Besuchsplaner')}</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-black">
                {selectedTerm}
              </span>
            </h2>
            <p className="text-[11px] text-text-muted font-medium">
              {_t('تخطيط وحساب الزيارات الصفية تلقائياً بناءً على جدول المعلمين وإمكانية رئيس القسم', 'Automated term visit scheduling based on teacher & HOD timetables', 'Automatische Unterrichtsbesuchsplanung')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className="px-3 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border border border-surface-border text-text-main font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{_t('إعدادات الخطة', 'Plan Config', 'Konfiguration')}</span>
            {showConfigDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowRegenConfirm(true)}
            className="px-3 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border border border-surface-border text-text-main font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{_t('إعادة الحساب', 'Recalculate', 'Neu berechnen')}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border border border-surface-border text-text-main font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>{_t('طباعة', 'Print', 'Drucken')}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{_t('تقرير المدير (PDF)', 'Principal PDF Report', 'Direktor-PDF')}</span>
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
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="p-3 bg-surface border border-surface-border rounded-2xl shadow-2xs flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-text-muted">{_t('إجمالي المطلوبة', 'Total Required', 'Gesamt erfordert')}</span>
          <span className="text-xl font-black text-text-main mt-0.5">{planResult.summary.totalRequirements}</span>
        </div>

        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-2xs flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{_t('منفذة (مكتملة)', 'Completed Visits', 'Abgeschlossen')}</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{planResult.summary.completedCount}</span>
        </div>

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl shadow-2xs flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{_t('مجدولة مقدماً', 'Planned Visits', 'Geplant')}</span>
          <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{planResult.summary.plannedCount}</span>
        </div>

        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl shadow-2xs flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-400">{_t('غير مجدولة (تعارض)', 'Unscheduled', 'Ungeplant')}</span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{planResult.summary.unscheduledCount}</span>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-2xs flex flex-col items-center justify-center text-center col-span-2 sm:col-span-1">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{_t('نسبة التغطية المكتملة', 'Verified Coverage', 'Abdeckung')}</span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{planResult.summary.coveragePercentage}%</span>
        </div>
      </div>

      {/* Filter & View Switcher Toolbar */}
      <div className="p-2.5 bg-surface border border-surface-border rounded-2xl shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
        {/* View Modes */}
        <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border shrink-0">
          {[
            { id: 'schedule', label: _t('الجدول الزمني', 'Schedule', 'Zeitplan') },
            { id: 'weekly', label: _t('أسسبوعي', 'Weekly', 'Wöchentlich') },
            { id: 'teachers', label: _t('حسب المعلم', 'By Teacher', 'Nach Lehrer') },
            { id: 'requirements', label: _t('المتطلبات', 'Requirements', 'Anforderungen') },
          ].map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveViewMode(m.id as any)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
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
        <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
          <input
            type="text"
            placeholder={_t('بحث باسم المعلم أو الفصل...', 'Search teacher or class...', 'Suchen...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2.5 py-1 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main w-full sm:w-48"
          />

          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="px-2.5 py-1 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
          >
            <option value="all">{_t('جميع المعلمين', 'All Teachers', 'Alle Lehrer')}</option>
            {teachersList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-2.5 py-1 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
          >
            <option value="all">{_t('جميع الحالات', 'All Statuses', 'Alle Status')}</option>
            <option value="completed">{_t('مكتملة', 'Completed', 'Abgeschlossen')}</option>
            <option value="planned">{_t('مجدولة', 'Planned', 'Geplant')}</option>
            <option value="rescheduled">{_t('معاد جدولتها', 'Rescheduled', 'Umgeschrieben')}</option>
          </select>

          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-2.5 py-1 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer"
          >
            <option value="all">{_t('جميع الفصول', 'All Classes', 'Alle Klassen')}</option>
            {uniqueClasses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conflicts Banner Notice */}
      {planResult.conflicts.length > 0 && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2 text-rose-700 dark:text-rose-400">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-xs">
              {_t(`تنبيه تعارضات: يوجد (${planResult.conflicts.length}) متطلبات زيارة يتعذر جدولتها تلقائياً بسبب عدم تقاطع فترات التفرغ`, `Conflict Notice: (${planResult.conflicts.length}) visit requirements could not be auto-scheduled due to timetable conflicts`, 'Konflikte beim Erstellen')}
            </p>
            <div className="text-[11px] font-medium opacity-90">
              {planResult.conflicts.slice(0, 3).map((c, i) => (
                <div key={i}>• {c.teacherName} ({c.className}): {c.reason}</div>
              ))}
              {planResult.conflicts.length > 3 && (
                <div className="font-bold border-t border-rose-500/20 pt-1 mt-1">
                  {_t(`+ ${planResult.conflicts.length - 3} تعارضات إضافية مذكورة بالتقرير التفصيلي`, `+ ${planResult.conflicts.length - 3} more conflicts listed in full report`, '')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          {Array.from(weeklyVisitsMap.entries()).map(([weekTitle, weekVisits]) => (
            <div key={weekTitle} className="p-3.5 bg-surface border border-surface-border rounded-2xl shadow-2xs space-y-2">
              <h4 className="font-black text-xs text-primary border-b border-surface-border pb-1.5 flex items-center justify-between">
                <span>📅 {weekTitle}</span>
                <span className="text-[10px] font-bold text-text-muted">{weekVisits.length} {_t('زيارات', 'visits', 'Besuche')}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {weekVisits.map(v => (
                  <div key={v.id} className="p-2.5 bg-surface-hover border border-surface-border rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-primary text-xs">{v.teacherName}</span>
                      <span className="font-bold text-[10px] text-text-muted">{v.gradeClass}</span>
                    </div>
                    <div className="text-[11px] font-bold text-text-main flex items-center gap-1">
                      <span>📆 {v.date}</span>
                      <span>•</span>
                      <span>{_t('حصة', 'P.', 'St.')} {v.periodNumber}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 3: BY TEACHER MATRIX */}
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
