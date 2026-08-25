import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, Plus, Filter, Search, Calendar, User, BookOpen, AlertTriangle, 
  CheckCircle2, Clock, Printer, Trash2, Edit3, ChevronRight, X, Sparkles, 
  FileText, Check, Award, ArrowUpRight, Shield, Layers, HelpCircle, Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StudentActionPlan, WeeklyPlanLog, HodGermanStudent } from '../types';
import { storage } from '../services/storageService';
import { printActionPlansReport, downloadActionPlansPdf } from '../utils/printObservationUtils';

// Arabic Selector Preset Options
export const WEAKNESS_AREAS_PRESETS = [
  'ضعف القواعد والمفردات',
  'ضعف القراءة والفهم القرائي',
  'ضعف النطق والتحدث الشفهي',
  'ضعف الإملاء والتعبير الكتابي',
  'إهمال الدفتر والواجبات المنزلية'
];

export const ACTION_STEPS_PRESETS = [
  'توفير أوراق عمل وشيتات تدريبية إضافية',
  'تقديم دعم فردي أثناء الحصة / حصص التمكّن',
  'تغيير مكان الجلوس والمشاركة مع طالب متميز',
  'متابعة خاصة وتصحيح دوري للدفتر',
  'تواصل وتنسيق أسبوعي مع ولي الأمر'
];

export const PROGRESS_STATUS_OPTIONS: {
  value: 'لم يتحسن' | 'تحسن تدريجي بسيط' | 'تحسن ملحوظ (تم الإغلاق)';
  label: string;
  badgeBg: string;
  textColor: string;
  icon: string;
}[] = [
  {
    value: 'لم يتحسن',
    label: '🔴 لم يتحسن / يحتاج مزيداً من الدعم',
    badgeBg: 'bg-rose-500/10 border-rose-500/20',
    textColor: 'text-rose-600 dark:text-rose-400',
    icon: '🔴'
  },
  {
    value: 'تحسن تدريجي بسيط',
    label: '🟡 تحسن تدريجي بسيط / قيد المتابعة',
    badgeBg: 'bg-amber-500/10 border-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
    icon: '🟡'
  },
  {
    value: 'تحسن ملحوظ (تم الإغلاق)',
    label: '🟢 تحسن ملحوظ / تم الوصول للمستوى المطلوب وإغلاق الخطة',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    icon: '🟢'
  }
];

interface ActionPlansViewProps {
  embeddedStudentId?: string;
  embeddedTeacherId?: string;
}

export const ActionPlansView: React.FC<ActionPlansViewProps> = ({
  embeddedStudentId,
  embeddedTeacherId
}) => {
  const { profile, _t, t } = useApp();
  const schoolSettings = profile?.schoolSettings || ({} as any);

  // Main State
  const [actionPlans, setActionPlans] = useState<StudentActionPlan[]>([]);
  const [germanStudents, setGermanStudents] = useState<HodGermanStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Toast
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [teacherFilter, setTeacherFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<StudentActionPlan | null>(null);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedPlanForLog, setSelectedPlanForLog] = useState<StudentActionPlan | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<StudentActionPlan | null>(null);

  // Pre-Print Options State
  const [selectedPrintStage, setSelectedPrintStage] = useState('جميع المراحل التعليمية');
  const [selectedPrintStageManager, setSelectedPrintStageManager] = useState('');
  const [printStatusFilter, setPrintStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!selectedPrintStageManager && schoolSettings.stageManagers && schoolSettings.stageManagers.length > 0) {
      setSelectedPrintStageManager(schoolSettings.stageManagers[0]?.name || '');
    }
  }, [schoolSettings.stageManagers, selectedPrintStageManager]);

  // Form State for Plan Creation / Editing
  const [formClass, setFormClass] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [selectedWeaknessAreas, setSelectedWeaknessAreas] = useState<string[]>([]);
  const [customWeakness, setCustomWeakness] = useState('');
  const [selectedActionSteps, setSelectedActionSteps] = useState<string[]>([]);
  const [customActionStep, setCustomActionStep] = useState('');
  const [formTerm, setFormTerm] = useState(schoolSettings.currentTerm || 'الفصل الدراسي الأول');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Form State for Weekly Log
  const [logWeekNumber, setLogWeekNumber] = useState(1);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logProgress, setLogProgress] = useState<'لم يتحسن' | 'تحسن تدريجي بسيط' | 'تحسن ملحوظ (تم الإغلاق)'>('تحسن تدريجي بسيط');
  const [logNotes, setLogNotes] = useState('');

  // Roster Teachers List
  const teachersList = useMemo(() => {
    if (schoolSettings.teachers && schoolSettings.teachers.length > 0) {
      return schoolSettings.teachers;
    }
    const currentHod = schoolSettings.hodName || profile?.displayName;
    return currentHod ? [{ id: 'hod', name: currentHod, isActive: true, isHod: true }] : [];
  }, [schoolSettings.teachers, schoolSettings.hodName, profile?.displayName]);

  // Load Data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const storedPlans = await storage.getItem<StudentActionPlan[]>('hod_student_action_plans');
        if (storedPlans && Array.isArray(storedPlans)) {
          setActionPlans(storedPlans);
        }

        const storedStudents = await storage.getItem<HodGermanStudent[]>('hod_german_students');
        if (storedStudents && Array.isArray(storedStudents)) {
          setGermanStudents(storedStudents);
        }
      } catch (err) {
        console.error('Error loading action plans data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Save Plans
  const savePlansToStorage = async (updated: StudentActionPlan[]) => {
    setActionPlans(updated);
    try {
      await storage.setItem('hod_student_action_plans', updated);
    } catch (err) {
      console.error('Error persisting action plans:', err);
    }
  };

  // Unique Available Classes from Students Database
  const availableClasses: string[] = Array.from<string>(
    new Set(germanStudents.map(s => String(s.gradeClass || '')).filter(Boolean))
  ).sort();

  // Filtered Students for selected class in Form
  const filteredStudentsForForm = germanStudents.filter(
    s => !formClass || (s.gradeClass || '').toUpperCase() === (formClass || '').toUpperCase()
  );

  // Toggle Checkboxes
  const toggleWeakness = (area: string) => {
    setSelectedWeaknessAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const toggleActionStep = (step: string) => {
    setSelectedActionSteps(prev =>
      prev.includes(step) ? prev.filter(s => s !== step) : [...prev, step]
    );
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    const initialClass = availableClasses[0] || '5A';
    setFormClass(initialClass);
    const initialStudents = germanStudents.filter(s => (s.gradeClass || '').toUpperCase() === String(initialClass).toUpperCase());
    setFormStudentId(initialStudents[0]?.id || '');
    setFormTeacherId(teachersList[0]?.id || '');
    setSelectedWeaknessAreas([WEAKNESS_AREAS_PRESETS[0]]);
    setCustomWeakness('');
    setSelectedActionSteps([ACTION_STEPS_PRESETS[0]]);
    setCustomActionStep('');
    setFormTerm(schoolSettings.currentTerm || 'الفصل الدراسي الأول');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (plan: StudentActionPlan) => {
    setEditingPlan(plan);
    setFormClass(plan.gradeClass);
    setFormStudentId(plan.studentId);
    setFormTeacherId(plan.teacherId);

    const presetWeaknesses = WEAKNESS_AREAS_PRESETS;
    const matchedWeakness = presetWeaknesses.filter(w => plan.weaknessAreas.includes(w));
    setSelectedWeaknessAreas(matchedWeakness);

    const customWeak = plan.weaknessAreas.filter(w => !presetWeaknesses.includes(w)).join(', ');
    setCustomWeakness(customWeak);

    const presetSteps = ACTION_STEPS_PRESETS;
    const matchedSteps = presetSteps.filter(s => plan.actionSteps.includes(s));
    setSelectedActionSteps(matchedSteps);

    const customStep = plan.actionSteps.filter(s => !presetSteps.includes(s)).join(', ');
    setCustomActionStep(customStep);

    setFormTerm(plan.term || 'الفصل الدراسي الأول');
    setFormStartDate(plan.startDate || new Date().toISOString().split('T')[0]);
    setIsCreateModalOpen(true);
  };

  // Save Plan Submission
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedStudent = germanStudents.find(s => s.id === formStudentId);
    const selectedTeacher = teachersList.find((t: any) => t.id === formTeacherId);

    const finalWeaknesses = [...selectedWeaknessAreas];
    if (customWeakness.trim()) {
      finalWeaknesses.push(customWeakness.trim());
    }

    const finalActionSteps = [...selectedActionSteps];
    if (customActionStep.trim()) {
      finalActionSteps.push(customActionStep.trim());
    }

    if (finalWeaknesses.length === 0) {
      triggerToast('يرجى تحديد مجال ضعف واحد على الأقل');
      return;
    }

    if (finalActionSteps.length === 0) {
      triggerToast('يرجى تحديد خطة دعم واحدة على الأقل');
      return;
    }

    if (editingPlan) {
      const updated = actionPlans.map(p => {
        if (p.id === editingPlan.id) {
          return {
            ...p,
            studentId: formStudentId,
            studentNameAr: selectedStudent?.nameAr || selectedStudent?.name || p.studentNameAr,
            studentNameEn: selectedStudent?.nameEn || p.studentNameEn,
            gradeClass: formClass.toUpperCase(),
            teacherId: formTeacherId,
            teacherName: selectedTeacher?.name || p.teacherName,
            weaknessAreas: finalWeaknesses,
            actionSteps: finalActionSteps,
            term: formTerm,
            startDate: formStartDate
          };
        }
        return p;
      });
      await savePlansToStorage(updated);
      triggerToast('تم تحديث خطة الدعم بنجاح');
    } else {
      const newPlan: StudentActionPlan = {
        id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        studentId: formStudentId || `std_${Date.now()}`,
        studentNameAr: selectedStudent?.nameAr || selectedStudent?.name || 'طالب غير محدد',
        studentNameEn: selectedStudent?.nameEn || 'Student',
        gradeClass: formClass.toUpperCase(),
        teacherId: formTeacherId,
        teacherName: selectedTeacher?.name || 'المعلم المسؤول',
        weaknessAreas: finalWeaknesses,
        actionSteps: finalActionSteps,
        startDate: formStartDate,
        term: formTerm,
        status: 'ACTIVE',
        weeklyLogs: [
          {
            weekNumber: 1,
            logDate: formStartDate,
            progress: 'تحسن تدريجي بسيط',
            notes: 'بدء تنفيذ خطة الدعم الأكاديمي'
          }
        ]
      };
      await savePlansToStorage([newPlan, ...actionPlans]);
      triggerToast('تمت إضافة خطة الدعم الأكاديمي بنجاح');
    }

    setIsCreateModalOpen(false);
  };

  // Delete Plan
  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    const updated = actionPlans.filter(p => p.id !== planToDelete.id);
    await savePlansToStorage(updated);
    triggerToast(`تم حذف خطة الدعم للطالب (${planToDelete.studentNameAr})`);
    setPlanToDelete(null);
  };

  // Toggle Plan Resolution Status
  const handleTogglePlanStatus = async (plan: StudentActionPlan) => {
    const nextStatus: 'ACTIVE' | 'RESOLVED' = plan.status === 'ACTIVE' ? 'RESOLVED' : 'ACTIVE';
    const updated = actionPlans.map(p => {
      if (p.id === plan.id) {
        return {
          ...p,
          status: nextStatus
        };
      }
      return p;
    });
    await savePlansToStorage(updated);
    triggerToast(
      nextStatus === 'RESOLVED'
        ? `تم إغلاق خطة الدعم بنجاح للطالب (${plan.studentNameAr})`
        : `تم إعادة فتح خطة الدعم للطالب (${plan.studentNameAr})`
    );
  };

  // Open Log Modal
  const handleOpenLogModal = (plan: StudentActionPlan) => {
    setSelectedPlanForLog(plan);
    const nextWeek = (plan.weeklyLogs?.length || 0) + 1;
    setLogWeekNumber(nextWeek);
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogProgress('تحسن تدريجي بسيط');
    setLogNotes('');
    setIsLogModalOpen(true);
  };

  // Save Log Submission
  const handleSaveWeeklyLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForLog) return;

    const newLog: WeeklyPlanLog = {
      weekNumber: logWeekNumber,
      logDate: logDate,
      progress: logProgress,
      notes: logNotes.trim() || undefined
    };

    const shouldClosePlan = logProgress === 'تحسن ملحوظ (تم الإغلاق)';

    const updated = actionPlans.map(p => {
      if (p.id === selectedPlanForLog.id) {
        return {
          ...p,
          status: shouldClosePlan ? ('RESOLVED' as const) : p.status,
          weeklyLogs: [...(p.weeklyLogs || []), newLog]
        };
      }
      return p;
    });

    await savePlansToStorage(updated);
    triggerToast(
      shouldClosePlan
        ? 'تمت إضافة تقرير المتابعة وإغلاق الخطة بنجاح 🟢'
        : 'تم تسجيل المتابعة الأسبوعية بنجاح'
    );
    setIsLogModalOpen(false);
  };

  // Filtering Logic
  const filteredPlans = actionPlans.filter(p => {
    if (embeddedStudentId && p.studentId !== embeddedStudentId) {
      const matchStd = germanStudents.find(s => s.id === embeddedStudentId);
      if (matchStd) {
        if (p.studentNameAr !== matchStd.nameAr && p.studentNameEn !== matchStd.nameEn) {
          return false;
        }
      } else {
        return false;
      }
    }

    if (embeddedTeacherId && p.teacherId !== embeddedTeacherId) {
      return false;
    }

    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (classFilter !== 'ALL' && (p.gradeClass || '').toUpperCase() !== (classFilter || '').toUpperCase()) return false;
    if (teacherFilter !== 'ALL' && p.teacherId !== teacherFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = (p.studentNameAr || '').toLowerCase().includes(q) || (p.studentNameEn || '').toLowerCase().includes(q);
      const matchTeacher = (p.teacherName || '').toLowerCase().includes(q);
      const matchClass = (p.gradeClass || '').toLowerCase().includes(q);
      const matchStatus = (p.status === 'ACTIVE' && ('قيد المتابعة'.includes(q) || 'متابعة'.includes(q) || 'نشط'.includes(q) || 'active'.includes(q))) ||
                          (p.status === 'RESOLVED' && ('تم الإغلاق'.includes(q) || 'مغلق'.includes(q) || 'مكتمل'.includes(q) || 'resolved'.includes(q)));
      const matchWeakness = (p.weaknessAreas || []).some(w => (w || '').toLowerCase().includes(q));
      const matchAction = (p.actionSteps || []).some(s => (s || '').toLowerCase().includes(q));
      if (!matchName && !matchTeacher && !matchClass && !matchStatus && !matchWeakness && !matchAction) return false;
    }

    return true;
  });

  // Analytics Metrics
  const totalPlansCount = actionPlans.length;
  const activePlansCount = actionPlans.filter(p => p.status === 'ACTIVE').length;
  const resolvedPlansCount = actionPlans.filter(p => p.status === 'RESOLVED').length;
  const activeTeachersCount = new Set(actionPlans.filter(p => p.status === 'ACTIVE').map(p => p.teacherId)).size;

  return (
    <div className="space-y-3 text-text-main pb-12">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 rounded-xl shadow-2xl text-[11px] font-black flex items-center gap-2 border border-surface-border animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Module Action Bar & Stats */}
      {!embeddedStudentId && !embeddedTeacherId && (
        <div className="bg-surface border border-surface-border p-3 rounded-2xl shadow-2xs space-y-3">
          {/* Header Row: Title & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-text-main flex items-center gap-2">
                  <span>{_t('خطط الدعم الأكاديمي والتعثر الدراسي', 'Academic Support Plans', 'Förderpläne')}</span>
                </h1>
                <p className="text-[10px] text-text-muted">
                  {_t('متابعة خطط الدعم للطلاب المتعثرين أسبوعياً وربطها بالتقارير الرسمية', 'Weekly tracking of academic support plans for struggling students', 'Wöchentliche Nachverfolgung von Förderplänen')}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-4 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5">
              <button
                onClick={handleOpenCreateModal}
                className="px-2 sm:px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{_t('خطة جديدة', 'New Plan', 'Neuer Plan')}</span>
              </button>

              <button
                onClick={() => printActionPlansReport(actionPlans, schoolSettings, {
                  stageName: selectedPrintStage,
                  stageManagerName: selectedPrintStageManager || schoolSettings.stageManagers?.[0]?.name || 'إدارة المرحلة',
                  statusFilter: printStatusFilter,
                  isRtl: true,
                  lang: 'ar'
                })}
                className="px-1.5 sm:px-2 py-1.5 bg-surface hover:bg-surface-hover text-text-main rounded-xl text-[10px] sm:text-[11px] font-bold border border-surface-border transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                title={_t('طباعة فورية A4', 'Print A4', 'Drucken A4')}
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{_t('طباعة A4', 'Print A4', 'Drucken A4')}</span>
              </button>

              <button
                onClick={async () => {
                  setIsDownloadingPdf(true);
                  await downloadActionPlansPdf(actionPlans, schoolSettings, {
                    stageName: selectedPrintStage,
                    stageManagerName: selectedPrintStageManager || schoolSettings.stageManagers?.[0]?.name || 'إدارة المرحلة',
                    statusFilter: printStatusFilter,
                    isRtl: true,
                    lang: 'ar'
                  });
                  setIsDownloadingPdf(false);
                }}
                disabled={isDownloadingPdf}
                className="px-1.5 sm:px-2 py-1.5 bg-surface hover:bg-surface-hover text-text-main rounded-xl text-[10px] sm:text-[11px] font-bold border border-surface-border transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title={_t('تنزيل ملف PDF', 'Download PDF', 'PDF herunterladen')}
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{isDownloadingPdf ? '...' : 'PDF'}</span>
              </button>

              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="px-1.5 sm:px-2 py-1.5 bg-surface hover:bg-surface-hover text-text-main rounded-xl text-[10px] sm:text-[11px] font-bold border border-surface-border transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                title={_t('تخصيص ومعاينة التقرير', 'Preview Report', 'Vorschau')}
              >
                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{_t('المعاينة', 'Preview', 'Vorschau')}</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-border">
            <div className="p-2 bg-surface-hover rounded-xl border border-surface-border flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-muted">{_t('إجمالي الخطط', 'Total Plans', 'Gesamt')}</span>
              <span className="text-xs font-black text-text-main">{totalPlansCount}</span>
            </div>

            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{_t('🟡 قيد المتابعة', 'Active', 'Aktiv')}</span>
              <span className="text-xs font-black text-amber-700 dark:text-amber-300">{activePlansCount}</span>
            </div>

            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{_t('🟢 تم التمكن والإغلاق', 'Resolved', 'Abgeschlossen')}</span>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">{resolvedPlansCount}</span>
            </div>

            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-primary">{_t('👨‍🏫 المعلمون المسؤولون', 'Teachers', 'Lehrer')}</span>
              <span className="text-xs font-black text-primary">{activeTeachersCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* FILTER CONTROLS TOOLBAR */}
      <div className="bg-surface border border-surface-border p-2.5 rounded-xl shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={_t('بحث باسم الطالب، الفصل، أو المعلم أو مجال الضعف...', 'Search student, class, teacher or weakness...', 'Suchen...')}
              className="w-full pr-8 pl-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons for Embedded mode */}
          {(embeddedStudentId || embeddedTeacherId) && (
            <button
              onClick={handleOpenCreateModal}
              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer hover:bg-emerald-700 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{_t('إضافة خطة دعم', 'Add Support Plan', 'Förderplan hinzufügen')}</span>
            </button>
          )}
        </div>

        {/* Filter Badges & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-border">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 bg-surface-hover p-0.5 rounded-lg border border-surface-border">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {_t('الكل', 'All', 'Alle')} ({actionPlans.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                statusFilter === 'ACTIVE' ? 'bg-amber-500 text-white shadow-2xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              🟡 {_t('متابعة', 'Active', 'Aktiv')} ({activePlansCount})
            </button>
            <button
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                statusFilter === 'RESOLVED' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              🟢 {_t('مكتمل', 'Done', 'Erledigt')} ({resolvedPlansCount})
            </button>
          </div>

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[10px] font-bold text-text-main focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">{_t('جميع الفصول', 'All Classes', 'Alle Klassen')} ({availableClasses.length})</option>
            {availableClasses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Teacher Filter */}
          <select
            value={teacherFilter}
            onChange={e => setTeacherFilter(e.target.value)}
            className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[10px] font-bold text-text-main focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">{_t('جميع المعلمين', 'All Teachers', 'Alle Lehrer')}</option>
            {teachersList.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* PLANS LIST */}
      {isLoading ? (
        <div className="text-center py-10 bg-surface border border-surface-border rounded-xl">
          <div className="animate-spin w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-[11px] font-bold text-text-muted">{_t('جاري تحميل خطط الدعم الأكاديمي...', 'Loading support plans...', 'Lade Förderpläne...')}</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-10 bg-surface border border-surface-border rounded-xl p-3 space-y-2">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center mx-auto">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="text-[11px] font-black text-text-main">{_t('لا توجد خطط دعم أكاديمي مطابقة', 'No matching support plans', 'Keine Förderpläne gefunden')}</h3>
          <button
            onClick={handleOpenCreateModal}
            className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-emerald-700 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{_t('إنشاء خطة دعم الآن', 'Create Support Plan Now', 'Jetzt Förderplan erstellen')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredPlans.map(plan => {
            const isActive = plan.status === 'ACTIVE';
            const latestLog = plan.weeklyLogs && plan.weeklyLogs.length > 0 
              ? plan.weeklyLogs[plan.weeklyLogs.length - 1] 
              : null;

            return (
              <div
                key={plan.id}
                className={`p-2.5 bg-surface border rounded-xl shadow-2xs transition-all space-y-1.5 text-[11px] ${
                  isActive 
                    ? 'border-amber-500/25 hover:border-amber-500/40' 
                    : 'border-emerald-500/25 hover:border-emerald-500/40'
                }`}
              >
                {/* ROW 1: Header - Student Name + Class + Teacher | Status Toggle & Tools */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="font-black text-text-main text-[11px] truncate">
                      {plan.studentNameAr}
                    </span>
                    {plan.studentNameEn && (
                      <span className="hidden md:inline text-[10px] text-text-muted font-medium truncate">
                        ({plan.studentNameEn})
                      </span>
                    )}
                    <span className="px-1.5 py-0.2 bg-primary/10 text-primary rounded text-[10px] font-black shrink-0">
                      {plan.gradeClass}
                    </span>
                    <span className="text-[10px] text-text-muted font-bold truncate border-r pr-1.5 border-surface-border hidden sm:inline">
                      👨‍🏫 {plan.teacherName}
                    </span>
                  </div>

                  {/* Status Toggle & Action Tools */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePlanStatus(plan)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all border flex items-center gap-1 cursor-pointer select-none ${
                        isActive
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      }`}
                      title={isActive ? _t('النقر لإغلاق الخطة', 'Click to resolve plan', 'Klicken zum Abschließen') : _t('النقر لإعادة فتح الخطة', 'Click to reopen plan', 'Klicken zum Wiedereröffnen')}
                    >
                      <span>{isActive ? '🟡 قيد المتابعة' : '🟢 تم الإغلاق'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(plan)}
                      className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg border border-surface-border cursor-pointer"
                      title={_t('تعديل الخطة', 'Edit Plan', 'Plan bearbeiten')}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => setPlanToDelete(plan)}
                      className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg border border-surface-border cursor-pointer"
                      title={_t('حذف الخطة', 'Delete Plan', 'Plan löschen')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* ROW 2: Weakness Areas & Action Steps */}
                <div className="flex flex-wrap items-center gap-1 text-[10px] leading-tight pt-1 border-t border-surface-border/50">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-black text-rose-600 dark:text-rose-400 shrink-0">⚠️ الضعف:</span>
                    {plan.weaknessAreas.map((w, idx) => (
                      <span key={idx} className="px-1.5 py-0.2 bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded text-[10px] font-bold border border-rose-500/20 truncate max-w-[150px]">
                        {w}
                      </span>
                    ))}
                  </div>

                  <span className="text-text-muted/40 hidden sm:inline">•</span>

                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">⚡ العلاج:</span>
                    {plan.actionSteps.map((s, idx) => (
                      <span key={idx} className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold border border-emerald-500/20 truncate max-w-[180px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ROW 3: Latest Weekly Evaluation & Direct Update Button */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-border/50 text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-black text-text-main shrink-0">
                      📊 الأسبوع {latestLog ? latestLog.weekNumber : 1}:
                    </span>
                    {latestLog ? (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-black border shrink-0 ${
                        latestLog.progress.includes('تم الإغلاق')
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : latestLog.progress.includes('تدريجي')
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                      }`}>
                        {latestLog.progress}
                      </span>
                    ) : (
                      <span className="text-text-muted italic">لم يتم إضافة تقييم أسبوعي بعد</span>
                    )}
                    {latestLog?.notes && (
                      <span className="text-text-muted italic truncate hidden sm:inline">
                        — {latestLog.notes}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenLogModal(plan)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-2xs flex items-center gap-1 cursor-pointer transition-all shrink-0"
                    title={_t('تسجيل متابعة الأسبوع الحالي', 'Log Week Progress', 'Wöchentlichen Fortschritt erfassen')}
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>{_t('تحديث الأسبوع', 'Update Week', 'Woche aktualisieren')}</span>
                  </button>
                </div>

                {/* Expandable Previous Weekly Logs */}
                {plan.weeklyLogs && plan.weeklyLogs.length > 1 && (
                  <details className="group pt-0.5">
                    <summary className="text-[10px] font-bold text-text-muted hover:text-text-main cursor-pointer flex items-center gap-1 select-none">
                      <span>سجل الأسابيع السابقة ({plan.weeklyLogs.length} أسابيع)</span>
                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-1 space-y-1 pr-2 border-r-2 border-emerald-500/30">
                      {plan.weeklyLogs.map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] bg-surface-hover px-2 py-0.5 rounded border border-surface-border/40">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-text-main">أسبوع {log.weekNumber}</span>
                            <span className="text-text-muted">({log.logDate})</span>
                            {log.notes && <span className="text-text-muted italic hidden sm:inline">- {log.notes}</span>}
                          </div>
                          <span className="font-bold">{log.progress}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: CREATE / EDIT ACTION PLAN ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-xl p-3.5 shadow-2xl space-y-2.5 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <Target className="w-4 h-4" />
                </span>
                <h3 className="text-xs sm:text-sm font-black text-text-main">
                  {editingPlan ? _t('تعديل خطة الدعم الأكاديمي', 'Edit Support Plan', 'Förderplan bearbeiten') : _t('إنشاء خطة دعم أكاديمي جديدة', 'New Academic Support Plan', 'Neuer Förderplan')}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePlan} className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              {/* Class & Student Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-text-main block mb-1">
                    {_t('الفصل الدراسي:', 'Class:', 'Klasse:')}
                  </label>
                  <select
                    value={formClass}
                    onChange={e => {
                      const newC = e.target.value;
                      setFormClass(newC);
                      const st = germanStudents.filter(s => (s.gradeClass || '').toUpperCase() === (newC || '').toUpperCase());
                      setFormStudentId(st[0]?.id || '');
                    }}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  >
                    {availableClasses.map(c => (
                      <option key={c} value={c}>الفصل {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-main block mb-1">
                    {_t('اسم الطالب:', 'Student Name:', 'Schülername:')}
                  </label>
                  <select
                    value={formStudentId}
                    onChange={e => setFormStudentId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  >
                    {filteredStudentsForForm.length === 0 ? (
                      <option value="">لا يوجد طلاب بهذا الفصل</option>
                    ) : (
                      filteredStudentsForForm.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nameAr || s.name} ({s.nameEn})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Teacher & Term Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-text-main block mb-1">
                    {_t('المعلم المسؤول عن المتابعة:', 'Supervising Teacher:', 'Betreuender Lehrer:')}
                  </label>
                  <select
                    value={formTeacherId}
                    onChange={e => setFormTeacherId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  >
                    {teachersList.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-main block mb-1">
                    {_t('الفصل الدراسي (Term):', 'Term:', 'Halbjahr:')}
                  </label>
                  <input
                    type="text"
                    value={formTerm}
                    onChange={e => setFormTerm(e.target.value)}
                    placeholder="مثال: الفصل الدراسي الأول"
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* WEAKNESS AREAS MULTI-SELECT */}
              <div className="space-y-2 border border-surface-border p-2.5 rounded-xl bg-surface-hover/40">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                    <span>{_t('مجالات الضعف الأكاديمي (اختيار متعدد):', 'Weakness Areas (Multiple Selection):', 'Schwächenbereiche:')}</span>
                  </label>
                  <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded-full text-[10px] font-black">
                    {selectedWeaknessAreas.length + (customWeakness.trim() ? 1 : 0)} محدد
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {WEAKNESS_AREAS_PRESETS.map(area => {
                    const isSelected = selectedWeaknessAreas.includes(area);
                    return (
                      <button
                        type="button"
                        key={area}
                        onClick={() => toggleWeakness(area)}
                        className={`p-2 rounded-xl text-[11px] font-bold text-right transition-all border flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-2xs'
                            : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-surface-border'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="truncate">{area}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-surface-border/60">
                  <input
                    type="text"
                    value={customWeakness}
                    onChange={e => setCustomWeakness(e.target.value)}
                    placeholder="✏️ مجال ضعف مخصص آخر (اختياري)..."
                    className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* ACTION STEPS MULTI-SELECT */}
              <div className="space-y-2 border border-surface-border p-2.5 rounded-xl bg-surface-hover/40">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                    <span>{_t('خطوات خطة الدعم العلاجية (اختيار متعدد):', 'Action Steps (Multiple Selection):', 'Fördermaßnahmen:')}</span>
                  </label>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-black">
                    {selectedActionSteps.length + (customActionStep.trim() ? 1 : 0)} محدد
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {ACTION_STEPS_PRESETS.map(step => {
                    const isSelected = selectedActionSteps.includes(step);
                    return (
                      <button
                        type="button"
                        key={step}
                        onClick={() => toggleActionStep(step)}
                        className={`p-2 rounded-xl text-[11px] font-bold text-right transition-all border flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-2xs'
                            : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-surface-border'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="truncate">{step}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-surface-border/60">
                  <input
                    type="text"
                    value={customActionStep}
                    onChange={e => setCustomActionStep(e.target.value)}
                    placeholder="⚡ خطة دعم علاجية مخصصة إضافية (اختياري)..."
                    className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-[11px] font-bold text-text-main block mb-1">
                  {_t('تاريخ بدء الخطة:', 'Start Date:', 'Startdatum:')}
                </label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={e => setFormStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-2.5 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-surface-hover text-text-main rounded-xl text-[11px] font-bold border border-surface-border cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold shadow-2xs hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  {editingPlan ? _t('حفظ التعديلات', 'Save Changes', 'Speichern') : _t('إنشاء الخطة الآن', 'Create Plan Now', 'Plan erstellen')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD WEEKLY PROGRESS LOG ================= */}
      {isLogModalOpen && selectedPlanForLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg p-3.5 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <h3 className="text-xs sm:text-sm font-black text-text-main">
                  {_t('تحديث المتابعة الأسبوعية للطالب', 'Update Weekly Progress', 'Wöchentlichen Fortschritt erfassen')}
                </h3>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWeeklyLog} className="space-y-3">
              <div className="bg-surface-hover p-2 rounded-xl border border-surface-border text-[11px]">
                <span className="font-black text-text-main">{selectedPlanForLog.studentNameAr}</span>
                <span className="text-text-muted mr-1.5">({selectedPlanForLog.gradeClass}) - المعلم: {selectedPlanForLog.teacherName}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-text-main block mb-1">
                    {_t('رقم الأسبوع:', 'Week Number:', 'Wochennummer:')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={logWeekNumber}
                    onChange={e => setLogWeekNumber(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-main block mb-1">
                    {_t('تاريخ التقييم:', 'Log Date:', 'Datum:')}
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Weekly Progress Radio / Selector */}
              <div>
                <label className="text-[11px] font-bold text-text-main block mb-1.5">
                  {_t('تقييم مدى التحسن الأكاديمي:', 'Progress Status:', 'Fortschrittsbewertung:')}
                </label>
                <div className="space-y-1.5">
                  {PROGRESS_STATUS_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        logProgress === opt.value
                          ? `${opt.badgeBg} shadow-2xs font-black`
                          : 'bg-surface hover:bg-surface-hover border-surface-border font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="logProgress"
                          value={opt.value}
                          checked={logProgress === opt.value}
                          onChange={() => setLogProgress(opt.value)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className={`text-[11px] ${opt.textColor}`}>{opt.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="text-[11px] font-bold text-text-main block mb-1">
                  {_t('ملاحظات المعلم وتفاصيل التقدم (اختياري):', 'Teacher Notes (Optional):', 'Lehrerhinweise (optional):')}
                </label>
                <textarea
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  rows={2}
                  placeholder="مثال: أظهر الطالب تجاوباً ممتازاً في ورقة العمل وتدريبات القواعد..."
                  className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2.5 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-3 py-1.5 bg-surface-hover text-text-main rounded-xl text-[11px] font-bold border border-surface-border cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold shadow-2xs hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  {_t('تسجيل المتابعة الآن', 'Save Log', 'Speichern')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md p-3.5 shadow-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-rose-600">
              <span className="p-1.5 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <h3 className="text-xs sm:text-sm font-black text-text-main">{_t('تأكيد حذف خطة الدعم', 'Confirm Delete Plan', 'Förderplan löschen')}</h3>
            </div>

            <div className="bg-surface-hover p-2.5 rounded-xl border border-surface-border text-[11px] space-y-1">
              <div className="font-bold text-text-main">الطالب: {planToDelete.studentNameAr} ({planToDelete.gradeClass})</div>
              <div className="text-text-muted">المعلم المسؤول: {planToDelete.teacherName}</div>
            </div>

            <div className="pt-2 border-t border-surface-border flex items-center justify-end gap-2">
              <button
                onClick={() => setPlanToDelete(null)}
                className="px-3 py-1.5 bg-surface-hover text-text-main rounded-xl text-[11px] font-bold border border-surface-border cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={handleDeletePlan}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[11px] font-bold hover:bg-rose-700 transition-all cursor-pointer"
              >
                {_t('حذف نهائياً', 'Delete Permanently', 'Endgültig löschen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINT MODAL: FULL TERM A4 REPORT ================= */}
      {isPrintModalOpen && (() => {
        const modalFilteredPlans = actionPlans.filter(p => {
          if (printStatusFilter === 'ACTIVE') return p.status === 'ACTIVE';
          if (printStatusFilter === 'RESOLVED') return p.status === 'RESOLVED';
          return true;
        });
        const modalActiveCount = modalFilteredPlans.filter(p => p.status === 'ACTIVE').length;
        const modalResolvedCount = modalFilteredPlans.filter(p => p.status === 'RESOLVED').length;
        const modalSuccessRate = modalFilteredPlans.length > 0 ? Math.round((modalResolvedCount / modalFilteredPlans.length) * 100) : 0;
        const currentStageManager = selectedPrintStageManager || schoolSettings.stageManagers?.[0]?.name || 'إدارة المرحلة';
        const rawHodName = schoolSettings.hodName || 'عبد الرحمن غريب';
        const formattedHodName = rawHodName.replace(/^أ[\.\/]\s*/, '');

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in overflow-y-auto">
            <div className="bg-white text-slate-900 rounded-2xl w-full max-w-4xl p-4 shadow-2xl space-y-3 max-h-[92vh] flex flex-col">
              {/* Action Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 gap-2 print:hidden">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    معاينة وطباعة تقرير خطط الدعم الأكاديمي الشامل (A4)
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={async () => {
                      setIsDownloadingPdf(true);
                      await downloadActionPlansPdf(actionPlans, schoolSettings, {
                        stageName: selectedPrintStage,
                        stageManagerName: currentStageManager,
                        statusFilter: printStatusFilter,
                        isRtl: true,
                        lang: 'ar'
                      });
                      setIsDownloadingPdf(false);
                    }}
                    disabled={isDownloadingPdf}
                    className="px-2.5 py-1.5 bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-emerald-800 transition-all shadow-xs disabled:opacity-50"
                    title="تنزيل ملف PDF مباشر على جهازك"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{isDownloadingPdf ? 'جاري تجهيز PDF...' : 'تحميل PDF'}</span>
                  </button>

                  <button
                    onClick={() => printActionPlansReport(actionPlans, schoolSettings, {
                      stageName: selectedPrintStage,
                      stageManagerName: currentStageManager,
                      statusFilter: printStatusFilter,
                      isRtl: true,
                      lang: 'ar'
                    })}
                    className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 transition-all shadow-xs"
                    title="فتح نافذة طباعة A4 ناصعة بدون خلفيات"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة A4</span>
                  </button>

                  <button
                    onClick={() => setIsPrintModalOpen(false)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pre-Print Options Panel */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 print:hidden space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-emerald-600" />
                    إعدادات وتخصيص تقرير الطباعة (A4)
                  </span>
                  <span className="text-[10px] text-slate-500">تخصيص المرحلة والمسمى الوظيفي وحالة الخطط قبل التصدير</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {/* Stage Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">المرحلة التعليمية:</label>
                    <select
                      value={selectedPrintStage}
                      onChange={(e) => setSelectedPrintStage(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="جميع المراحل التعليمية">جميع المراحل التعليمية</option>
                      <option value="المرحلة الابتدائية (الصفوف 1 - 3)">المرحلة الابتدائية (الصفوف 1 - 3)</option>
                      <option value="المرحلة الابتدائية العليا (الصفوف 4 - 6)">المرحلة الابتدائية العليا (الصفوف 4 - 6)</option>
                      <option value="المرحلة الإعدادية (الصفوف 7 - 9)">المرحلة الإعدادية (الصفوف 7 - 9)</option>
                      <option value="المرحلة الثانوية (الصفوف 10 - 12)">المرحلة الثانوية (الصفوف 10 - 12)</option>
                      {schoolSettings.stageManagers?.map((sm: any) => (
                        <option key={sm.id} value={sm.gradeBand || sm.name}>
                          {sm.gradeBand} - ({sm.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stage Manager Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">اسم مدير المرحلة:</label>
                    {schoolSettings.stageManagers && schoolSettings.stageManagers.length > 0 ? (
                      <select
                        value={selectedPrintStageManager}
                        onChange={(e) => setSelectedPrintStageManager(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {schoolSettings.stageManagers.map((sm: any) => (
                          <option key={sm.id} value={sm.name}>
                            أ/ {sm.name} ({sm.gradeBand})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedPrintStageManager}
                        onChange={(e) => setSelectedPrintStageManager(e.target.value)}
                        placeholder="اسم مدير المرحلة"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    )}
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">حالة خطط الدعم:</label>
                    <select
                      value={printStatusFilter}
                      onChange={(e) => setPrintStatusFilter(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="ALL">جميع الخطط (نشطة ومغلقة)</option>
                      <option value="ACTIVE">قيد المتابعة والتقويم فقط (🟡)</option>
                      <option value="RESOLVED">تم الوصول للهدف والإغلاق فقط (🟢)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Printable A4 Content Block */}
              <div id="printable-action-plans-report" className="space-y-3 text-right font-sans p-2.5 bg-white dir-rtl overflow-y-auto" dir="rtl">
                {/* Formal Header: Logo + Title */}
                <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-3">
                  <div className="flex items-center gap-2">
                    {schoolSettings.schoolLogoUrl ? (
                      <img src={schoolSettings.schoolLogoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                    ) : (
                      <div className="w-10 h-10 bg-emerald-700 text-white rounded-lg flex items-center justify-center font-black text-sm">
                        DE
                      </div>
                    )}
                    <div>
                      <h1 className="text-sm font-black text-slate-900">
                        {schoolSettings.schoolName || ''}
                      </h1>
                      <p className="text-[10px] font-bold text-emerald-800">
                        {schoolSettings.departmentName || 'قسم اللغة الألمانية (Deutschabteilung)'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-black">
                      تقرير خطط الدعم الأكاديمي
                    </span>
                  </div>
                </div>

                {/* Metadata Bar */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-800">
                  <div>
                    <span className="text-slate-500 font-semibold">المرحلة التعليمية: </span>
                    <span>{selectedPrintStage}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">الفصل الدراسي: </span>
                    <span>{schoolSettings.currentTerm || 'الفصل الدراسي الأول'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">تاريخ الإصدار: </span>
                    <span>{new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[9px] text-slate-500 font-bold">إجمالي الخُطط</div>
                    <div className="text-sm font-black text-slate-900">{modalFilteredPlans.length}</div>
                  </div>
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="text-[9px] text-amber-700 font-bold">قيد المتابعة</div>
                    <div className="text-sm font-black text-amber-800">{modalActiveCount}</div>
                  </div>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="text-[9px] text-emerald-700 font-bold">تم الوصول للهدف والتمكن</div>
                    <div className="text-sm font-black text-emerald-800">{modalResolvedCount}</div>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[9px] text-slate-500 font-bold">نسبة النجاح والتمكن</div>
                    <div className="text-sm font-black text-slate-900">{modalSuccessRate}%</div>
                  </div>
                </div>

                {/* Printable Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-right border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-emerald-700 text-white font-black text-[10px]">
                        <th className="p-1.5 border border-slate-300 w-7 text-center">#</th>
                        <th className="p-1.5 border border-slate-300 w-28">اسم الطالب</th>
                        <th className="p-1.5 border border-slate-300 w-14 text-center">الفصل</th>
                        <th className="p-1.5 border border-slate-300 w-24">المعلم المسؤول</th>
                        <th className="p-1.5 border border-slate-300">نقاط الضعف المرصودة</th>
                        <th className="p-1.5 border border-slate-300">الإجراءات والحلول المتخذة</th>
                        <th className="p-1.5 border border-slate-300 w-20 text-center">الحالة الحالية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalFilteredPlans.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-2 text-center text-slate-500 italic">
                            لا توجد خطط دعم مسجلة تطابق محددات التصفية المختارة.
                          </td>
                        </tr>
                      ) : (
                        modalFilteredPlans.map((p, idx) => (
                          <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 font-bold text-slate-900">
                              {p.studentNameAr}
                              {p.studentNameEn && <span className="block text-[9px] text-slate-500 font-normal">{p.studentNameEn}</span>}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-center font-bold text-slate-900">{p.gradeClass}</td>
                            <td className="p-1.5 border border-slate-300 font-bold text-slate-800">{p.teacherName}</td>
                            <td className="p-1.5 border border-slate-300 text-[10px] text-rose-800">
                              {p.weaknessAreas.join(' • ')}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-[10px] text-emerald-800">
                              {p.actionSteps.join(' • ')}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-center font-black">
                              {p.status === 'ACTIVE' ? (
                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] border border-amber-300 inline-block">
                                  🟡 قيد المتابعة
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] border border-emerald-300 inline-block">
                                  🟢 تم الإغلاق
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Refined Formal Signature Footer */}
                <div className="pt-6 flex items-start justify-between px-8 text-center text-[10px] font-bold text-slate-900">
                  <div className="w-[42%] flex flex-col items-center">
                    <div className="font-black text-slate-900 text-[10px] mb-1">مدير المرحلة</div>
                    <div className="text-slate-700 mb-3">أ/ {currentStageManager}</div>
                    <div className="w-36 text-center text-slate-500 font-normal tracking-widest">..................................</div>
                  </div>

                  <div className="w-[42%] flex flex-col items-center">
                    <div className="font-black text-slate-900 text-[10px] mb-1">رئيس قسم اللغة الألمانية</div>
                    <div className="text-slate-700 mb-3">أ/ {formattedHodName}</div>
                    <div className="w-36 text-center text-slate-500 font-normal tracking-widest">..................................</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
