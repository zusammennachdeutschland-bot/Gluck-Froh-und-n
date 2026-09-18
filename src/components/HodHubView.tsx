import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Calendar, BookOpen, FileText, CheckCircle2, AlertTriangle, Clock, Plus, Trash2, Edit3, Send, Sparkles, Printer, Check, X, Shield, FileCheck, Layers, ChevronRight, RefreshCw, RotateCcw, Upload, Phone, MessageCircle, Copy, MapPin, Eye, Target, ClipboardList, Award, BarChart3, Download, Loader2, GraduationCap, Tag, CheckSquare, Square, Pin, Search, MessageSquare, AlertCircle, Bookmark } from 'lucide-react';
import { calculatePeriodsTimings, parseTimeToMinutes, getCustomSessionsForPeriod, getUnmatchedCustomSessions, getMergedDayScheduleItems } from '../utils/schoolUtils';
import { 
  printObservationReport, 
  downloadObservationReportPdf, 
  shareObservationReportViaWhatsApp,
  downloadStageFollowUpPdf,
  shareStageFollowUpViaWhatsApp,
  printStageFollowUpReport,
  downloadCombinedObservationReportsPdf,
  printCombinedObservationReports
} from '../utils/printObservationUtils';
import {
  downloadSingleWeeklyPlanPdf,
  downloadAllWeeklyPlansCombinedPdf,
  printSingleWeeklyPlan,
  printAllWeeklyPlansCombinedTable,
  getSecretaryForGradeBand
} from '../utils/weeklyPlanPrintUtils';
import { StageFollowUpRecord, TeacherStageEvaluationItem, StaffAttendanceRecord, CustomTimedSession, SchoolPeriodRecord, SchoolNote, SchoolNoteType } from '../types';
import { SchoolScheduleExportModal } from './SchoolScheduleExportModal';
import { SchoolLessonNotesModal } from './SchoolLessonNotesModal';
import { ObservationFormModal } from './ObservationFormModal';
import { BulkObservationExportModal } from './BulkObservationExportModal';
import { HodStudentsView } from './HodStudentsView';
import { ComplaintsSystemView } from './ComplaintsSystemView';
import { ActionPlansView } from './ActionPlansView';
import { StageCommunicationView } from './StageCommunicationView';
import { TeacherAttendanceModal } from './TeacherAttendanceModal';
import { DetailedStaffAttendanceModal } from './DetailedStaffAttendanceModal';
import { calculateStaffAttendanceMetrics } from '../utils/staffAttendanceUtils';

const QUICK_TEACHER_NOTE_TAGS = [
  { ar: '📝 واجب', en: '📝 Homework', de: '📝 Hausaufgabe', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { ar: '⭐ تميز', en: '⭐ Outstanding', de: '⭐ Hervorragend', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { ar: '⚠️ تنبيه', en: '⚠️ Warning', de: '⚠️ Warnung', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  { ar: '💡 فكرة', en: '💡 Idea', de: '💡 Idee', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { ar: '🎯 متابعة', en: '🎯 Follow-up', de: '🎯 Nachfassen', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { ar: '📖 مشاركة', en: '📖 Participation', de: '📖 Beteiligung', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
];

export const HodHubView: React.FC = () => {
  const { 
    profile, 
    updateProfile, 
    groups, 
    students, 
    lessons, 
    schoolNotes, 
    addSchoolNote, 
    updateSchoolNote, 
    deleteSchoolNote, 
    hodStudents, 
    language, 
    _t, 
    t, 
    addAppNotification 
  } = useApp();
  const schoolSettings = profile?.schoolSettings || {} as any;

  const [activeTab, setActiveTab] = useState<'overview' | 'timetables' | 'stage_managers' | 'plans' | 'action_plans' | 'staff' | 'students' | 'complaints'>('overview');
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [activeLoadingAction, setActiveLoadingAction] = useState<{ id: string; type: 'download' | 'share' } | null>(null);
  const [downloadingPlanId, setDownloadingPlanId] = useState<string | null>(null);
  const [isDownloadingAllPlans, setIsDownloadingAllPlans] = useState(false);

  const handleDownloadPdf = async (v: any) => {
    if (!v || activeLoadingAction) return;
    setActiveLoadingAction({ id: v.id, type: 'download' });
    triggerToast(_t('جاري إنشاء وتحميل تقرير الزيارة PDF 📄...', 'Generating and downloading visit report PDF 📄...', 'Bericht wird als PDF generiert 📄...'));
    try {
      const res = await downloadObservationReportPdf(v, schoolSettings, (language === 'ar'), language);
      if (res?.success) {
        triggerToast(_t(`تم تجهيز وتحميل تقرير الزيارة (${res.filename}) بنجاح 📥`, `Visit report downloaded successfully 📥`, `Bericht heruntergeladen 📥`));
      } else {
        triggerToast(_t('تعذر تحميل التقرير، يرجى المحاولة مجدداً', 'Download failed, please try again', 'Fehler beim Download'));
      }
    } catch (err) {
      console.error('Download PDF error:', err);
      triggerToast(_t('حدث خطأ أثناء تحميل التقرير', 'Error downloading report', 'Fehler beim Download'));
    } finally {
      setActiveLoadingAction(null);
    }
  };

  const handleShareWhatsApp = async (v: any) => {
    if (!v || activeLoadingAction) return;
    setActiveLoadingAction({ id: v.id, type: 'share' });
    try {
      await shareObservationReportViaWhatsApp(v, schoolSettings, (language === 'ar'), language);
    } catch (err) {
      console.error('Share WhatsApp error:', err);
    } finally {
      setActiveLoadingAction(null);
    }
  };

  // Helper for toast
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Live Data SWR & Polling State
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toLocaleTimeString());
  const [liveKpis, setLiveKpis] = useState<any>(null);
  const [liveTimetable, setLiveTimetable] = useState<any>(null);
  const [liveStudentData, setLiveStudentData] = useState<any>(null);

  const fetchDashboardData = async () => {
    setIsLiveSyncing(true);
    try {
      // For an AI Studio standalone app without a real backend database,
      // the 'live database' is the browser's local storage (IndexedDB wrapper).
      const { storage } = await import('../services/storageService');
      
      const [storedStudents, storedComplaints, storedPlans, storedVisits] = await Promise.all([
        storage.getItem<any[]>('hod_german_students'),
        storage.getItem<any[]>('hod_complaints'),
        storage.getItem<any[]>('hod_student_action_plans'),
        storage.getItem<any[]>('hod_visit_records')
      ]);

      // Calculate true KPIs
      const kpiData = {
        visitsCount: storedVisits ? storedVisits.length : visitRecords.length,
        activePlansCount: storedPlans ? storedPlans.length : activePlans.length,
        pendingComplaintsCount: storedComplaints ? storedComplaints.filter(c => c.status !== 'resolved').length : parentComplaints.filter(c => c.status !== 'resolved').length
      };

      // Calculate exact true student counts by grade
      // Use HOD German Department students roster
      const realStudents = storedStudents && Array.isArray(storedStudents) ? storedStudents : [];
      const gradeCounts: Record<string, number> = {};
      realStudents.forEach(s => {
        // Handle both HodGermanStudent (gradeClass: "5A") and Student (grade: "Grade 5")
        const gradeStr = s.gradeClass || s.grade || '';
        const gradeMatch = gradeStr.match(/\d+/);
        const grade = gradeMatch ? 'G' + gradeMatch[0] : 'Unknown';
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
      });

      const buildStage = (id: string, nameAr: string, gradeKeys: string[], nameArGrades: string[]) => {
        const grades = gradeKeys.map((g, idx) => ({
          grade: g,
          nameAr: nameArGrades[idx] || g,
          count: gradeCounts[g] || 0
        }));
        const total = grades.reduce((sum, g) => sum + g.count, 0);
        return { id, nameAr, total, grades };
      };

      const stages = [
        buildStage('primary', 'المرحلة الابتدائية (Primarstufe)', 
          ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], 
          ['الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع', 'الصف الخامس', 'الصف السادس']),
        buildStage('preparatory', 'المرحلة الإعدادية (Sekundarstufe I)', 
          ['G7', 'G8', 'G9'], 
          ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي']),
        buildStage('secondary', 'المرحلة الثانوية (Sekundarstufe II)', 
          ['G10', 'G11', 'G12'], 
          ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'])
      ];

      const totalStudents = stages.reduce((sum, stage) => sum + stage.total, 0);
      const studentData = { totalStudents, stages };

      // Fetch timetable from the mock API or fallback to mock data if it fails
      let timetableData = null;
      try {
        const timetableRes = await fetch('/api/hod/dashboard/timetable');
        if (timetableRes.ok) {
          timetableData = await timetableRes.json();
        }
      } catch (e) {
        timetableData = {
          dayKey: new Date().getDay().toString(),
          periodsCount: 8,
          teachers: (schoolSettings.teachers && schoolSettings.teachers.length > 0)
            ? schoolSettings.teachers.map((t: any) => ({ id: t.id, name: t.name, periods: {} }))
            : [],
          lastUpdated: new Date().toISOString()
        };
      }

      setLiveKpis(kpiData);
      setLiveTimetable(timetableData);
      setLiveStudentData(studentData);
      setLastSyncedAt(new Date().toLocaleTimeString());

    } catch (err) {
      console.error('Live sync error:', err);
    } finally {
      setIsLiveSyncing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refetch every 5 minutes (SWR interval)
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    // Refetch upon application window/tab focus
    const onFocus = () => fetchDashboardData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Optimistic handler for FAB actions
  const handleOptimisticAction = async (actionType: string, payload: any) => {
    if (actionType === 'visit') {
      setVisitRecords(prev => [{ id: Date.now().toString(), ...payload }, ...prev]);
      if (liveKpis) setLiveKpis((prev: any) => ({ ...prev, visitsCount: prev.visitsCount + 1 }));
      triggerToast(_t('تم إضافة الزيارة الصفية بنجاح (تحديث فوري)', 'Visit added instantly (optimistic)', 'Besuch sofort hinzugefügt'));
    } else if (actionType === 'complaint') {
      setParentComplaints(prev => [{ id: Date.now().toString(), ...payload, status: 'new' }, ...prev]);
      if (liveKpis) setLiveKpis((prev: any) => ({ ...prev, pendingComplaintsCount: prev.pendingComplaintsCount + 1 }));
      triggerToast(_t('تم تسجيل الشكوى بنجاح (تحديث فوري)', 'Complaint added instantly (optimistic)', 'Beschwerde sofort hinzugefügt'));
    } else if (actionType === 'support_plan') {
      setActivePlans(prev => [{ id: Date.now().toString(), ...payload, status: 'ACTIVE' }, ...prev]);
      if (liveKpis) setLiveKpis((prev: any) => ({ ...prev, activePlansCount: prev.activePlansCount + 1 }));
      triggerToast(_t('تم إنشاء خطة الدعم بنجاح (تحديث فوري)', 'Support plan created instantly (optimistic)', 'Förderplan sofort erstellt'));
    }

    try {
      await fetch('/api/hod/dashboard/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, payload })
      });
    } catch (err) {
      console.error('Action sync error:', err);
    }
  };

  // State for Staff Management
  const defaultHodName = schoolSettings.hodName || profile?.displayName || '';
  const initialTeachersList = (schoolSettings.teachers && schoolSettings.teachers.length > 0)
    ? schoolSettings.teachers
    : (defaultHodName ? [{ id: 'hod', name: defaultHodName, phone: profile?.phone || '', isActive: true, isHod: true }] : []);

  const [teachers, setTeachers] = useState<any[]>(initialTeachersList);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeacherDetails, setSelectedTeacherDetails] = useState<any | null>(null);
  const [parentComplaints, setParentComplaints] = useState<any[]>(schoolSettings.parentComplaints || []);
  const [activePlans, setActivePlans] = useState<any[]>(schoolSettings.actionPlans || []);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    teacherId: '',
    studentName: '',
    className: '',
    description: '',
    status: 'new'
  });

  // Staff Attendance & Discipline State (Requirements 1, 2, 3, 4, 5)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedTeacherForAttendance, setSelectedTeacherForAttendance] = useState<any | null>(null);
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<StaffAttendanceRecord | null>(null);
  const [isDetailedAttendanceModalOpen, setIsDetailedAttendanceModalOpen] = useState(false);

  // Teacher Notes & School Session Notes State
  const [teacherNotesFilterType, setTeacherNotesFilterType] = useState<'all' | 'pinned' | 'lesson' | 'class' | 'student'>('all');
  const [teacherNotesClassFilter, setTeacherNotesClassFilter] = useState<string>('all');
  const [teacherNotesSearch, setTeacherNotesSearch] = useState<string>('');
  const [isTeacherNoteFormOpen, setIsTeacherNoteFormOpen] = useState<boolean>(false);
  const [editingTeacherNoteId, setEditingTeacherNoteId] = useState<string | null>(null);
  const [teacherNoteForm, setTeacherNoteForm] = useState<{
    type: SchoolNoteType;
    className: string;
    studentId: string;
    studentName: string;
    periodNumber: number | '';
    date: string;
    tags: string[];
    pinned: boolean;
    text: string;
  }>({
    type: 'lesson',
    className: '',
    studentId: '',
    studentName: '',
    periodNumber: 1,
    date: new Date().toISOString().split('T')[0],
    tags: [],
    pinned: false,
    text: ''
  });

  // State for opening SchoolLessonNotesModal from Timetable or other areas
  const [activeNotesModalProps, setActiveNotesModalProps] = useState<{
    isOpen: boolean;
    periodNumber: number;
    startTime: string;
    endTime: string;
    className?: string;
    subjectName?: string;
    dateStr: string;
    teacherId?: string;
    teacherName?: string;
  } | null>(null);

  const staffAttendanceRecords: StaffAttendanceRecord[] = schoolSettings.staffAttendanceRecords || [];

  const weeklyAttendanceMetrics = React.useMemo(() => {
    return calculateStaffAttendanceMetrics(
      staffAttendanceRecords,
      teachers,
      schoolSettings,
      'this_week',
      'all'
    );
  }, [staffAttendanceRecords, teachers, schoolSettings]);

  const handleSaveAttendanceRecord = (recordData: Partial<StaffAttendanceRecord>) => {
    const existingRecords: StaffAttendanceRecord[] = schoolSettings.staffAttendanceRecords || [];
    let updatedRecords: StaffAttendanceRecord[];
    const nowTime = Date.now();

    if (recordData.id && existingRecords.some(r => r.id === recordData.id)) {
      updatedRecords = existingRecords.map(r => {
        if (r.id === recordData.id) {
          return {
            ...r,
            ...recordData,
            updatedAt: nowTime,
            version: (r.version || 1) + 1,
            deleted: false
          } as StaffAttendanceRecord;
        }
        return r;
      });
    } else {
      const newRec: StaffAttendanceRecord = {
        id: recordData.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        teacherId: recordData.teacherId!,
        teacherName: recordData.teacherName!,
        stageManagerId: recordData.stageManagerId,
        stageName: recordData.stageName,
        stageSecretaryName: recordData.stageSecretaryName,
        type: recordData.type || 'absence',
        date: recordData.date || new Date().toISOString().split('T')[0],
        absenceScope: recordData.absenceScope,
        absenceStatus: recordData.absenceStatus,
        periodNumber: recordData.periodNumber,
        lessonClass: recordData.lessonClass,
        replacementTeacherId: recordData.replacementTeacherId,
        replacementTeacherName: recordData.replacementTeacherName,
        replacementAssignments: recordData.replacementAssignments,
        reason: recordData.reason || '',
        notes: recordData.notes,
        scheduledArrivalTime: recordData.scheduledArrivalTime,
        actualArrivalTime: recordData.actualArrivalTime,
        delayMinutes: recordData.delayMinutes,
        scheduledLeaveTime: recordData.scheduledLeaveTime,
        actualLeaveTime: recordData.actualLeaveTime,
        lostMinutes: recordData.lostMinutes,
        updatedAt: nowTime,
        originRevision: Date.now(),
        deleted: false,
        version: 1
      };
      updatedRecords = [newRec, ...existingRecords];
    }

    const updatedSettings = {
      ...schoolSettings,
      staffAttendanceRecords: updatedRecords
    };
    updateProfile({ schoolSettings: updatedSettings });

    // Notification (Requirement 5)
    const teacherName = recordData.teacherName || 'المعلم';
    let notifTitle = 'سجل الحضور والانضباط';
    let notifMsg = '';
    if (recordData.type === 'absence') {
      const scopeLabel = recordData.absenceScope === 'lesson_based' ? 'غياب حصص' : 'غياب يوم كامل';
      const excLabel = recordData.absenceStatus === 'excused' ? 'بعذر' : 'بدون عذر';
      notifTitle = `⚠️ تسجيل غياب: ${teacherName}`;
      notifMsg = `تم رصد ${scopeLabel} (${excLabel}) للمعلم ${teacherName} بتاريخ ${recordData.date || ''}.`;
    } else if (recordData.type === 'late_arrival') {
      notifTitle = `⏰ تسجيل تأخير صباحي: ${teacherName}`;
      notifMsg = `تم رصد تأخير للمعلم ${teacherName} بمقدار ${recordData.delayMinutes || 0} دقيقة (الوصول: ${recordData.actualArrivalTime || ''}).`;
    } else if (recordData.type === 'early_leave') {
      notifTitle = `🚪 تسجيل انصراف مبكر: ${teacherName}`;
      notifMsg = `تم رصد خروج مبكر للمعلم ${teacherName} بمقدار ${recordData.lostMinutes || 0} دقيقة مفقودة (الانصراف: ${recordData.actualLeaveTime || ''}).`;
    }

    if (addAppNotification) {
      addAppNotification(notifTitle, notifMsg, 'system');
    }

    triggerToast(_t('تم تسجيل وحفظ واقعة الحضور بنجاح ✅', 'Attendance record saved successfully ✅', 'Erfolgreich gespeichert'));
  };

  const handleDeleteAttendanceRecord = (recordId: string) => {
    const existingRecords: StaffAttendanceRecord[] = schoolSettings.staffAttendanceRecords || [];
    const nowTime = Date.now();
    const updatedRecords = existingRecords.map(r => {
      if (r.id === recordId) {
        return {
          ...r,
          deleted: true,
          updatedAt: nowTime,
          version: (r.version || 1) + 1
        };
      }
      return r;
    });
    updateProfile({
      schoolSettings: {
        ...schoolSettings,
        staffAttendanceRecords: updatedRecords
      }
    });
    triggerToast(_t('تم حذف السجل بنجاح', 'Record deleted successfully', 'Gelöscht'));
  };

  // AI Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importScope, setImportScope] = useState<'all' | 'single'>('all');
  const [selectedTeacherForImport, setSelectedTeacherForImport] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showClearScheduleConfirm, setShowClearScheduleConfirm] = useState(false);
  const [showClearTeacherScheduleConfirm, setShowClearTeacherScheduleConfirm] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    parsedData: any;
  } | null>(null);

  // Matrix View State
  const [matrixViewMode, setMatrixViewMode] = useState<'grid' | 'single'>('grid');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [matrixDayFilter, setMatrixDayFilter] = useState<'all' | '0' | '1' | '2' | '3' | '4'>('all');
  const [selectedSingleTeacher, setSelectedSingleTeacher] = useState<string>('');
  const [showClearMatrixTeacherConfirm, setShowClearMatrixTeacherConfirm] = useState(false);
  const [selectedCellDetails, setSelectedCellDetails] = useState<{
    teacherId?: string;
    teacherName: string;
    className: string;
    subjectName?: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    dayKey: string;
    room?: string;
  } | null>(null);

  // Period Editing in Unified Matrix
  const [editingPeriod, setEditingPeriod] = useState<{
    teacherId: string;
    teacherName: string;
    dayKey: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [periodClassName, setPeriodClassName] = useState('');
  const [periodSubjectName, setPeriodSubjectName] = useState('');
  const [periodNotes, setPeriodNotes] = useState('');

  // Custom Timed Sessions (Independent of standard school schedule periods)
  const [isCustomSessionModalOpen, setIsCustomSessionModalOpen] = useState(false);
  const [editingCustomSession, setEditingCustomSession] = useState<CustomTimedSession | null>(null);
  const [customTeacherId, setCustomTeacherId] = useState('');
  const [customDayKey, setCustomDayKey] = useState('0');
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [customClassName, setCustomClassName] = useState('');
  const [customStartTime, setCustomStartTime] = useState('14:30');
  const [customEndTime, setCustomEndTime] = useState('16:00');
  const [customRoom, setCustomRoom] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customSessionType, setCustomSessionType] = useState('حصة إضافية / تقوية');
  const [customSessionTeacherFilter, setCustomSessionTeacherFilter] = useState('all');
  const [customSessionDayFilter, setCustomSessionDayFilter] = useState('all');

  // Real-time tracker for the horizontal time indicator line across the matrix
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // 15 seconds refresh for responsive live line progression
    return () => clearInterval(timer);
  }, []);

  const effectivePeriodSettings = React.useMemo(() => {
    const base = schoolSettings.periodSettings || {
      periodsCount: 8,
      firstPeriodStart: '07:30',
      defaultDuration: 45
    };
    let maxP = base.periodsCount || 8;
    const checkList = (items: any[]) => {
      if (Array.isArray(items)) {
        items.forEach(it => {
          if (it?.periodNumber && it.periodNumber > maxP) maxP = it.periodNumber;
        });
      }
    };
    if (schoolSettings.schedule) {
      Object.values(schoolSettings.schedule).forEach((dayList: any) => checkList(dayList));
    }
    if (schoolSettings.teacherSchedules) {
      Object.values(schoolSettings.teacherSchedules).forEach((tSched: any) => {
        if (tSched) {
          Object.values(tSched).forEach((dayList: any) => checkList(dayList));
        }
      });
    }
    return {
      firstPeriodStart: '07:30',
      defaultDuration: 45,
      ...base,
      periodsCount: Math.max(maxP, base.periodsCount || 8)
    };
  }, [schoolSettings]);

  const timings = calculatePeriodsTimings(effectivePeriodSettings);

  const liveTimeInfo = React.useMemo(() => {
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const nowTotalMinutes = currentHours * 60 + currentMinutes;
    const formatted = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
    const realDayKey = currentTime.getDay().toString();

    if (!timings || timings.length === 0) {
      return {
        formatted,
        nowTotalMinutes,
        realDayKey,
        activePeriodNumber: null,
        activeStatus: 'unknown' as const,
        progressPct: 50,
        remainingMinutes: 0,
        activePeriodInfo: null
      };
    }

    const firstPeriod = timings[0];
    const lastPeriod = timings[timings.length - 1];
    const firstStartMin = parseTimeToMinutes(firstPeriod.startTime);
    const lastEndMin = parseTimeToMinutes(lastPeriod.endTime);

    let activePeriodNumber: number | null = null;
    let activeStatus: 'in_period' | 'break' | 'before' | 'after' = 'before';
    let progressPct = 0;
    let remainingMinutes = 0;
    let activePeriodInfo: any = null;

    if (nowTotalMinutes < firstStartMin) {
      activeStatus = 'before';
      activePeriodNumber = firstPeriod.periodNumber;
      progressPct = 0;
      remainingMinutes = firstStartMin - nowTotalMinutes;
      activePeriodInfo = {
        periodNumber: firstPeriod.periodNumber,
        startTime: firstPeriod.startTime,
        endTime: firstPeriod.endTime
      };
    } else if (nowTotalMinutes >= lastEndMin) {
      activeStatus = 'after';
      activePeriodNumber = lastPeriod.periodNumber;
      progressPct = 100;
      remainingMinutes = 0;
      activePeriodInfo = {
        periodNumber: lastPeriod.periodNumber,
        startTime: lastPeriod.startTime,
        endTime: lastPeriod.endTime
      };
    } else {
      for (let i = 0; i < timings.length; i++) {
        const p = timings[i];
        const pStart = parseTimeToMinutes(p.startTime);
        const pEnd = parseTimeToMinutes(p.endTime);

        if (nowTotalMinutes >= pStart && nowTotalMinutes < pEnd) {
          activeStatus = 'in_period';
          activePeriodNumber = p.periodNumber;
          const duration = Math.max(1, pEnd - pStart);
          progressPct = Math.min(94, Math.max(6, ((nowTotalMinutes - pStart) / duration) * 100));
          remainingMinutes = pEnd - nowTotalMinutes;
          activePeriodInfo = p;
          break;
        } else if (i < timings.length - 1) {
          const nextP = timings[i + 1];
          const nextStart = parseTimeToMinutes(nextP.startTime);
          if (nowTotalMinutes >= pEnd && nowTotalMinutes < nextStart) {
            activeStatus = 'break';
            activePeriodNumber = p.periodNumber;
            progressPct = 98;
            remainingMinutes = nextStart - nowTotalMinutes;
            activePeriodInfo = p;
            break;
          }
        }
      }
    }

    return {
      formatted,
      nowTotalMinutes,
      realDayKey,
      activePeriodNumber,
      activeStatus,
      progressPct,
      remainingMinutes,
      activePeriodInfo
    };
  }, [currentTime, timings]);

  const isDayActiveForLine = (dayKey: string) => {
    if (matrixDayFilter !== 'all') {
      return dayKey === matrixDayFilter;
    }
    const realDayKey = liveTimeInfo.realDayKey;
    const schoolDays = ['0', '1', '2', '3', '4'];
    return schoolDays.includes(realDayKey) ? dayKey === realDayKey : dayKey === '0';
  };

  const handleOpenAddCustomSession = (prefill?: { teacherId?: string; dayKey?: string; startTime?: string; endTime?: string }) => {
    setEditingCustomSession(null);
    setCustomTeacherId(prefill?.teacherId || teachers[0]?.id || 'hod');
    setCustomDayKey(prefill?.dayKey || '0');
    setCustomSubjectName('');
    setCustomClassName('');
    setCustomStartTime(prefill?.startTime || '14:30');
    setCustomEndTime(prefill?.endTime || '16:00');
    setCustomRoom('');
    setCustomNotes('');
    setCustomSessionType('حصة إضافية / تقوية');
    setIsCustomSessionModalOpen(true);
  };

  const handleOpenEditCustomSession = (session: CustomTimedSession) => {
    setEditingCustomSession(session);
    setCustomTeacherId(session.teacherId);
    setCustomDayKey(session.dayKey);
    setCustomSubjectName(session.subjectName);
    setCustomClassName(session.className);
    setCustomStartTime(session.startTime);
    setCustomEndTime(session.endTime);
    setCustomRoom(session.room || '');
    setCustomNotes(session.notes || '');
    setCustomSessionType(session.sessionType || 'حصة إضافية / تقوية');
    setIsCustomSessionModalOpen(true);
  };

  const handleSaveCustomSession = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customClassName.trim() && !customSubjectName.trim()) {
      triggerToast(_t('يرجى إدخال اسم الفصل أو المادة', 'Please enter class or subject name', 'Bitte Klasse oder Fach eingeben'));
      return;
    }
    if (!customStartTime || !customEndTime) {
      triggerToast(_t('يرجى تحديد وقت بدء ونهاية الحصة', 'Please select start and end time', 'Bitte Start- und Endzeit angeben'));
      return;
    }

    const teacher = teachers.find(t => t.id === customTeacherId);
    const teacherName = teacher?.name || (customTeacherId === 'hod' ? (schoolSettings.hodName || _t('رئيس القسم', 'HOD', 'Fachleiter')) : customTeacherId);

    const sessionId = editingCustomSession?.id || `custom_session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newSession: CustomTimedSession = {
      id: sessionId,
      teacherId: customTeacherId,
      teacherName,
      dayKey: customDayKey,
      subjectName: customSubjectName.trim(),
      className: customClassName.trim(),
      startTime: customStartTime,
      endTime: customEndTime,
      room: customRoom.trim() || undefined,
      notes: customNotes.trim() || undefined,
      sessionType: customSessionType,
      updatedAt: Date.now(),
      createdAt: editingCustomSession?.createdAt || new Date().toISOString()
    };

    // 1. Update customTimedSessions array
    const existingList = (schoolSettings.customTimedSessions || []) as CustomTimedSession[];
    const existingIdx = existingList.findIndex(s => s.id === sessionId);
    let updatedList: CustomTimedSession[];
    if (existingIdx >= 0) {
      updatedList = [...existingList];
      updatedList[existingIdx] = newSession;
    } else {
      updatedList = [newSession, ...existingList];
    }

    // 2. Also mirror into teacherSchedules and schedule
    const currentTeacherSchedules = { ...(schoolSettings.teacherSchedules || {}) };
    const currentTeacherSchedule = { ...(currentTeacherSchedules[customTeacherId] || (customTeacherId === 'hod' ? (schoolSettings.schedule || {}) : {})) };
    const daySchedule = [...(currentTeacherSchedule[customDayKey] || [])];
    
    const mirrorIdx = daySchedule.findIndex((p: any) => p.id === sessionId);
    const periodRecord: SchoolPeriodRecord = {
      id: sessionId,
      periodNumber: 0,
      isCustomTime: true,
      startTime: customStartTime,
      endTime: customEndTime,
      subjectName: customSubjectName.trim(),
      className: customClassName.trim(),
      notes: customNotes.trim(),
      room: customRoom.trim(),
      sessionType: customSessionType,
      teacherId: customTeacherId,
      teacherName,
      dayKey: customDayKey,
      source: 'custom_timed_session'
    };

    if (mirrorIdx >= 0) {
      daySchedule[mirrorIdx] = periodRecord;
    } else {
      daySchedule.push(periodRecord);
    }

    currentTeacherSchedule[customDayKey] = daySchedule;
    currentTeacherSchedules[customTeacherId] = currentTeacherSchedule;

    const updates: any = {
      customTimedSessions: updatedList,
      teacherSchedules: currentTeacherSchedules
    };

    if (customTeacherId === 'hod') {
      const mainSchedule = { ...(schoolSettings.schedule || {}) };
      const mainDaySchedule = [...(mainSchedule[customDayKey] || [])];
      const mainIdx = mainDaySchedule.findIndex((p: any) => p.id === sessionId);
      if (mainIdx >= 0) {
        mainDaySchedule[mainIdx] = periodRecord;
      } else {
        mainDaySchedule.push(periodRecord);
      }
      mainSchedule[customDayKey] = mainDaySchedule;
      updates.schedule = mainSchedule;
    }

    persistHodData(updates);
    setIsCustomSessionModalOpen(false);
    setEditingCustomSession(null);
    triggerToast(_t('تم حفظ الحصة المخصصة وتثبيتها بنجاح في الجداول ⏱️', 'Custom timed session saved successfully ⏱️', 'Spezielle Stunde gespeichert ⏱️'));
  };

  const handleDeleteCustomSession = (sessionId: string) => {
    const existingList = (schoolSettings.customTimedSessions || []) as CustomTimedSession[];
    const targetSession = existingList.find(s => s.id === sessionId);
    const updatedList = existingList.filter(s => s.id !== sessionId);

    const updates: any = {
      customTimedSessions: updatedList
    };

    if (targetSession) {
      const currentTeacherSchedules = { ...(schoolSettings.teacherSchedules || {}) };
      if (currentTeacherSchedules[targetSession.teacherId]) {
        const ts = { ...currentTeacherSchedules[targetSession.teacherId] };
        if (ts[targetSession.dayKey]) {
          ts[targetSession.dayKey] = ts[targetSession.dayKey].filter((p: any) => p.id !== sessionId);
        }
        currentTeacherSchedules[targetSession.teacherId] = ts;
        updates.teacherSchedules = currentTeacherSchedules;
      }

      if (targetSession.teacherId === 'hod') {
        const mainSchedule = { ...(schoolSettings.schedule || {}) };
        if (mainSchedule[targetSession.dayKey]) {
          mainSchedule[targetSession.dayKey] = mainSchedule[targetSession.dayKey].filter((p: any) => p.id !== sessionId);
        }
        updates.schedule = mainSchedule;
      }
    }

    persistHodData(updates);
    if (editingCustomSession?.id === sessionId) {
      setIsCustomSessionModalOpen(false);
      setEditingCustomSession(null);
    }
    triggerToast(_t('تم حذف الحصة المخصصة بنجاح', 'Custom session deleted', 'Spezielle Stunde gelöscht'));
  };

  const startEditPeriod = (teacherId: string, dayKey: string, periodNumber: number) => {
    const teacher = teachers.find(t => t.id === teacherId);
    const teacherName = teacher?.name || (teacherId === 'hod' ? (schoolSettings.hodName || _t('رئيس القسم', 'HOD', 'Fachleiter')) : teacherId);
    const timing = timings.find(t => t.periodNumber === periodNumber) || { startTime: '', endTime: '' };
    const lesson = getLessonForTeacher(teacherId, dayKey, periodNumber);

    setPeriodClassName(lesson?.className || '');
    setPeriodSubjectName(lesson?.subjectName || '');
    setPeriodNotes(lesson?.notes || '');
    setEditingPeriod({
      teacherId,
      teacherName,
      dayKey,
      periodNumber,
      startTime: timing.startTime,
      endTime: timing.endTime
    });
  };

  const handleSavePeriod = (
    teacherId: string,
    dayKey: string,
    periodNumber: number,
    data: { className: string; subjectName: string; notes?: string }
  ) => {
    const currentTeacherSchedules = schoolSettings.teacherSchedules || {};
    const currentTeacherSchedule = currentTeacherSchedules[teacherId] || (teacherId === 'hod' ? (schoolSettings.schedule || {}) : {});
    const daySchedule = [...(currentTeacherSchedule[dayKey] || (teacherId === 'hod' ? (schoolSettings.schedule?.[dayKey] || []) : []))];
    const existingIndex = daySchedule.findIndex((p: any) => p.periodNumber === periodNumber);

    const updatedPeriod: any = {
      ...(existingIndex >= 0 ? daySchedule[existingIndex] : {}),
      periodNumber,
      className: data.className.trim(),
      subjectName: data.subjectName.trim(),
      notes: data.notes?.trim() || '',
      source: 'school_schedule'
    };

    if (existingIndex >= 0) {
      daySchedule[existingIndex] = updatedPeriod;
    } else {
      daySchedule.push(updatedPeriod);
    }
    daySchedule.sort((a: any, b: any) => a.periodNumber - b.periodNumber);

    const updatedTeacherSchedule = {
      ...currentTeacherSchedule,
      [dayKey]: daySchedule
    };

    const updatedTeacherSchedules = {
      ...currentTeacherSchedules,
      [teacherId]: updatedTeacherSchedule
    };

    const updates: any = {
      teacherSchedules: updatedTeacherSchedules
    };

    if (teacherId === 'hod') {
      const mainSchedule = schoolSettings.schedule || {};
      const mainDaySchedule = [...(mainSchedule[dayKey] || [])];
      const mainIdx = mainDaySchedule.findIndex((p: any) => p.periodNumber === periodNumber);
      if (mainIdx >= 0) {
        mainDaySchedule[mainIdx] = updatedPeriod;
      } else {
        mainDaySchedule.push(updatedPeriod);
      }
      mainDaySchedule.sort((a: any, b: any) => a.periodNumber - b.periodNumber);
      updates.schedule = {
        ...mainSchedule,
        [dayKey]: mainDaySchedule
      };
    }

    persistHodData(updates);
  };

  const handleClearPeriod = (teacherId: string, dayKey: string, periodNumber: number) => {
    const currentTeacherSchedules = schoolSettings.teacherSchedules || {};
    const currentTeacherSchedule = currentTeacherSchedules[teacherId] || (teacherId === 'hod' ? (schoolSettings.schedule || {}) : {});
    const daySchedule = (currentTeacherSchedule[dayKey] || (teacherId === 'hod' ? (schoolSettings.schedule?.[dayKey] || []) : [])).filter((p: any) => p.periodNumber !== periodNumber);

    const updatedTeacherSchedule = {
      ...currentTeacherSchedule,
      [dayKey]: daySchedule
    };

    const updatedTeacherSchedules = {
      ...currentTeacherSchedules,
      [teacherId]: updatedTeacherSchedule
    };

    const updates: any = {
      teacherSchedules: updatedTeacherSchedules
    };

    if (teacherId === 'hod') {
      const mainSchedule = schoolSettings.schedule || {};
      const mainDaySchedule = (mainSchedule[dayKey] || []).filter((p: any) => p.periodNumber !== periodNumber);
      updates.schedule = {
        ...mainSchedule,
        [dayKey]: mainDaySchedule
      };
    }

    persistHodData(updates);
  };

  // Workload Calculator
  const getWorkload = (teacherId: string) => {
    let scheduleRecords: any[] = [];
    if (teacherId === 'hod') {
      Object.values(schoolSettings.schedule || {}).forEach((dayArr: any) => {
        scheduleRecords.push(...dayArr);
      });
    } else {
      const ts = schoolSettings.teacherSchedules?.[teacherId];
      if (ts) {
        Object.values(ts).forEach((dayArr: any) => {
          scheduleRecords.push(...dayArr);
        });
      }
    }

    // Include customTimedSessions
    const customForTeacher = (schoolSettings.customTimedSessions || []).filter(
      (s: CustomTimedSession) => s.teacherId === teacherId
    );
    customForTeacher.forEach((s: CustomTimedSession) => {
      if (!scheduleRecords.some((r: any) => r.id === s.id)) {
        scheduleRecords.push(s);
      }
    });
    
    const activeLessons = scheduleRecords.filter(r => r.subjectName || r.className);
    const scheduleClasses = Array.from(new Set(activeLessons.map(r => r.className).filter(Boolean))) as string[];
    
    const teacherObj = teachers?.find((t: any) => t.id === teacherId);
    const directClasses = teacherObj?.assignedClasses || [];
    const classes = Array.from(new Set([...scheduleClasses, ...directClasses]));

    const bands = new Set<string>();
    classes.forEach(c => {
      const match = c.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]);
        if (num >= 1 && num <= 3) bands.add('Grades 1–3');
        else if (num >= 4 && num <= 6) bands.add('Grades 4–6');
        else if (num >= 7 && num <= 9) bands.add('Grades 7–9');
        else if (num >= 10 && num <= 12) bands.add('Grades 10–12');
      }
    });

    let matchedManager = null;
    const stageManagers = schoolSettings.stageManagers || [];
    if (stageManagers.length > 0) {
      const teacherBands = Array.from(bands);
      matchedManager = stageManagers.find((m: any) => teacherBands.includes(m.gradeBand)) || stageManagers[0];
    }

    return {
      totalSessions: activeLessons.length,
      assignedClasses: classes,
      gradeBands: Array.from(bands),
      matchedManager
    };
  };

  const WEEKDAY_NAMES = {
    '0': _t('الأحد', 'Sunday', 'Sonntag'),
    '1': _t('الإثنين', 'Monday', 'Montag'),
    '2': _t('الثلاثاء', 'Tuesday', 'Dienstag'),
    '3': _t('الأربعاء', 'Wednesday', 'Mittwoch'),
    '4': _t('الخميس', 'Thursday', 'Donnerstag'),
    '5': _t('الجمعة', 'Friday', 'Freitag'),
    '6': _t('السبت', 'Saturday', 'Samstag'),
  };

  const getLessonForTeacher = (teacherId: string, dayKey: string, periodNum: number) => {
    const schedules = teacherId === 'hod' 
      ? schoolSettings.schedule 
      : schoolSettings.teacherSchedules?.[teacherId];
    const daySchedule = schedules?.[dayKey] || [];
    return daySchedule.find((l: any) => l.periodNumber === periodNum && (l.className || l.subjectName));
  };

  const getTeacherCustomSessions = (teacherId: string, dayKey?: string) => {
    const list = (schoolSettings.customTimedSessions || []) as CustomTimedSession[];
    return list.filter(s => s.teacherId === teacherId && (!dayKey || s.dayKey === dayKey));
  };

  const getTeacherTodaySchedule = (teacherId: string) => {
    const todayKey = new Date().getDay().toString();
    const schedules = teacherId === 'hod' 
      ? schoolSettings.schedule 
      : schoolSettings.teacherSchedules?.[teacherId];
    const daySchedule = schedules?.[todayKey] || [];
    const regular = daySchedule.filter((l: any) => l.className || l.subjectName).sort((a: any, b: any) => a.periodNumber - b.periodNumber);
    
    // Also include custom sessions
    const custom = getTeacherCustomSessions(teacherId, todayKey);
    return {
      regular,
      custom
    };
  };

  const getTeacherStatus = (teacherId: string) => {
    const todayKey = new Date().getDay().toString();
    const schedules = teacherId === 'hod' 
      ? schoolSettings.schedule 
      : schoolSettings.teacherSchedules?.[teacherId];
    
    const todaySchedule = schedules?.[todayKey] || [];
    const activeLessons = todaySchedule.filter((l: any) => l.subjectName || l.className);
    const customSessionsToday = (schoolSettings.customTimedSessions || []).filter(
      (s: CustomTimedSession) => s.teacherId === teacherId && s.dayKey === todayKey
    );

    if (activeLessons.length === 0 && customSessionsToday.length === 0) return { status: 'no_class' };

    const timings = calculatePeriodsTimings(effectivePeriodSettings);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Check if currently in a custom-timed session!
    for (const cs of customSessionsToday) {
      const csStart = parseTimeToMinutes(cs.startTime);
      const csEnd = parseTimeToMinutes(cs.endTime);
      if (currentMinutes >= csStart && currentMinutes <= csEnd) {
        return { 
          status: 'in_class', 
          class: cs.className, 
          period: `${cs.startTime} - ${cs.endTime}`,
          isCustom: true,
          subject: cs.subjectName 
        };
      }
    }

    let currentPeriod = timings.find(p => {
      const start = parseTimeToMinutes(p.startTime);
      const end = parseTimeToMinutes(p.endTime);
      return currentMinutes >= start && currentMinutes <= end;
    });

    const standardLessons = activeLessons.filter((l: any) => !l.isCustomTime && l.periodNumber > 0);
    const lastLessonPeriod = standardLessons.length > 0 ? Math.max(...standardLessons.map((l: any) => l.periodNumber)) : 0;
    const lastTiming = timings.find((t: any) => t.periodNumber === lastLessonPeriod);
    
    const latestCustomEnd = customSessionsToday.length > 0 
      ? Math.max(...customSessionsToday.map((cs: CustomTimedSession) => parseTimeToMinutes(cs.endTime)))
      : 0;

    const effectiveEndMinutes = Math.max(
      lastTiming ? parseTimeToMinutes(lastTiming.endTime) : 0,
      latestCustomEnd
    );

    if (effectiveEndMinutes > 0 && currentMinutes > effectiveEndMinutes) {
       return { status: 'finished' };
    }

    if (currentPeriod) {
      const currentLesson = activeLessons.find((l: any) => l.periodNumber === currentPeriod.periodNumber);
      if (currentLesson) {
        return { status: 'in_class', class: currentLesson.className, period: currentPeriod.periodNumber };
      }
    }

    return { status: 'free' };
  };

  const handleClearAllTimetables = () => {
    persistHodData({ teacherSchedules: {}, schedule: {} });
    setShowClearScheduleConfirm(false);
    setShowClearTeacherScheduleConfirm(false);
    setIsImportModalOpen(false);
    setValidationResult(null);
    setImportText('');
    triggerToast(_t('تم مسح جميع جداول القسم بنجاح', 'All department timetables cleared successfully', 'Alle Stundenpläne der Abteilung erfolgreich gelöscht'));
  };

  const handleClearSingleTeacherTimetable = (teacherId: string) => {
    if (!teacherId) {
      triggerToast(_t('الرجاء اختيار المعلم أولاً', 'Please select a teacher first', 'Bitte wählen Sie zuerst einen Lehrer aus'));
      return;
    }

    const currentTeacherSchedules = { ...(schoolSettings.teacherSchedules || {}) };
    delete currentTeacherSchedules[teacherId];

    const existingCustoms = (schoolSettings.customTimedSessions || []) as CustomTimedSession[];
    const updatedCustoms = existingCustoms.filter(cs => cs.teacherId !== teacherId);

    const updates: any = {
      teacherSchedules: currentTeacherSchedules,
      customTimedSessions: updatedCustoms
    };

    if (teacherId === 'hod') {
      updates.schedule = {};
    }

    persistHodData(updates);
    setShowClearTeacherScheduleConfirm(false);
    setIsImportModalOpen(false);
    setValidationResult(null);
    setImportText('');

    const teacher = teachers.find(t => t.id === teacherId);
    const teacherName = teacher ? teacher.name : (teacherId === 'hod' ? (schoolSettings.hodName || _t('رئيس القسم', 'HOD', 'Fachleiter')) : teacherId);
    triggerToast(_t(`تم مسح جدول المعلم (${teacherName}) بنجاح 🧹`, `Schedule of teacher (${teacherName}) cleared successfully 🧹`, `Stundenplan von (${teacherName}) erfolgreich gelöscht 🧹`));
  };

  const generateAIPrompt = () => {
    if (importScope === 'single') {
      const t = teachers.find(t => t.id === selectedTeacherForImport) || teachers[0];
      const tName = t ? t.name : 'المعلم';
      return `أنا أقوم ببناء جدول حصص مدرسي. يرجى استخراج جدول الحصص الخاص بالمعلم/ة "${tName}" من النص أو الصورة المرفقة.
الناتج يجب أن يكون بتنسيق JSON فقط (بدون أي نص إضافي أو شروحات) ويطابق الـ Schema التالي:
\`\`\`json
{
  "schedule": {
    "0": [{ "periodNumber": 1, "className": "5A", "subjectName": "Deutsch" }],
    "1": [],
    "2": [],
    "3": [],
    "4": []
  }
}
\`\`\`
ملاحظات هامة:
1. المفاتيح من "0" إلى "4" تمثل أيام الأسبوع (0 = الأحد، 1 = الإثنين، 2 = الثلاثاء، 3 = الأربعاء، 4 = الخميس).
2. className هو اسم الفصل.
3. subjectName هو اسم المادة.
4. periodNumber هو رقم الحصة.
5. لا تقم باختراع أي بيانات غير موجودة.
أخرج JSON صالح فقط.`;
    }

    const teacherNames = teachers.map(t => t.name).join('، ');
    return `أنا أقوم ببناء جدول حصص مدرسي لعدة معلمين. يرجى استخراج جدول الحصص من النص أو الصورة المرفقة.
قائمة المعلمين المتاحين في النظام (استخدم نفس الأسماء): ${teacherNames}.
الناتج يجب أن يكون بتنسيق JSON فقط (بدون أي نص إضافي أو شروحات) ويطابق الـ Schema التالي:
\`\`\`json
{
  "teachersSchedules": {
    "اسم المعلم 1": {
      "0": [{ "periodNumber": 1, "className": "5A", "subjectName": "Deutsch" }]
    },
    "اسم المعلم 2": {
      "1": [{ "periodNumber": 3, "className": "7B", "subjectName": "Deutsch" }]
    }
  }
}
\`\`\`
ملاحظات هامة:
1. المفاتيح من "0" إلى "4" تمثل أيام الأسبوع (0 = الأحد، 1 = الإثنين، 2 = الثلاثاء، 3 = الأربعاء، 4 = الخميس).
2. className هو اسم الفصل، subjectName هو المادة، periodNumber هو رقم الحصة.
3. لا تقم باختراع أي بيانات غير موجودة.
أخرج JSON صالح فقط.`;
  };

  const copyPromptToClipboard = () => {
    if (importScope === 'single' && !selectedTeacherForImport) {
      triggerToast(_t('الرجاء اختيار المعلم أولاً', 'Please select a teacher first', 'Bitte wählen Sie zuerst einen Lehrer aus'));
      return;
    }
    navigator.clipboard.writeText(generateAIPrompt());
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleValidateImport = () => {
    setValidationResult(null);
    const errors: string[] = [];
    const warnings: string[] = [];
    let parsed: any = null;

    try {
      let rawJson = importText.trim();
      if (rawJson.startsWith('```')) {
        const lines = rawJson.split('\n');
        rawJson = lines.filter((l, i) => i > 0 && i < lines.length - 1).join('\n');
      }
      parsed = JSON.parse(rawJson.trim());
    } catch (e: any) {
      setValidationResult({ isValid: false, errors: [_t('صيغة JSON غير صالحة', 'Invalid JSON format', 'Ungültiges JSON-Format')], warnings: [], parsedData: null });
      return;
    }

    let finalTeacherSchedules: any = {};

    if (importScope === 'single') {
      if (!parsed.schedule || typeof parsed.schedule !== 'object') {
        errors.push(_t('حقل schedule مفقود', 'Missing schedule object', 'Fehlendes schedule-Objekt'));
      } else {
        finalTeacherSchedules[selectedTeacherForImport] = parsed.schedule;
      }
    } else {
      if (!parsed.teachersSchedules || typeof parsed.teachersSchedules !== 'object') {
        errors.push(_t('حقل teachersSchedules مفقود', 'Missing teachersSchedules object', 'Fehlendes teachersSchedules-Objekt'));
      } else {
        Object.keys(parsed.teachersSchedules).forEach(teacherName => {
          const matchedTeacher = teachers.find(t => 
            t.name.trim() === teacherName.trim() || 
            t.name.includes(teacherName) || 
            teacherName.includes(t.name)
          );
          if (matchedTeacher) {
            finalTeacherSchedules[matchedTeacher.id] = parsed.teachersSchedules[teacherName];
          } else {
            warnings.push(_t(`لم يتم التعرف على المعلم: ${teacherName}`, `Unrecognized teacher: ${teacherName}`, `Unbekannter Lehrer: ${teacherName}`));
          }
        });
        if (Object.keys(finalTeacherSchedules).length === 0) {
          errors.push(_t('لم يتم استخراج جدول لأي معلم مسجل بالنظام', 'No schedule extracted for registered teachers', 'Kein Stundenplan für registrierte Lehrer extrahiert'));
        }
      }
    }

    if (errors.length > 0) {
      setValidationResult({ isValid: false, errors, warnings, parsedData: null });
    } else {
      setValidationResult({ isValid: true, errors, warnings, parsedData: finalTeacherSchedules });
    }
  };

  const confirmImport = () => {
    if (!validationResult || !validationResult.parsedData) return;
    
    const currentSchedules = schoolSettings.teacherSchedules || {};
    let newSchedules = { ...currentSchedules };
    let newMainSchedule = schoolSettings.schedule;

    Object.keys(validationResult.parsedData).forEach(tId => {
      newSchedules[tId] = validationResult.parsedData[tId];
      if (tId === 'hod') {
        newMainSchedule = validationResult.parsedData[tId];
      }
    });

    persistHodData({ 
      teacherSchedules: newSchedules,
      ...(newMainSchedule ? { schedule: newMainSchedule } : {})
    });

    setImportText('');
    setValidationResult(null);
    setIsImportModalOpen(false);
    triggerToast(_t('تم استيراد الجدول بنجاح', 'Timetable imported successfully', 'Stundenplan erfolgreich importiert'));
  };

  const handleSaveComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintForm.teacherId || !complaintForm.studentName || !complaintForm.description) return;

    const newComplaint = {
      ...complaintForm,
      id: Date.now().toString(),
      date: new Date().toISOString()
    };
    const updated = [newComplaint, ...parentComplaints];
    setParentComplaints(updated);
    persistHodData({ parentComplaints: updated });
    setIsComplaintModalOpen(false);
    setComplaintForm({ teacherId: '', studentName: '', className: '', description: '', status: 'new' });
    triggerToast(_t('تم تسجيل الشكوى', 'Complaint logged', 'Beschwerde protokolliert'));
  };

  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName) return;

    let updated;
    if (editingTeacher) {
      updated = teachers.map(t => t.id === editingTeacher.id ? { ...t, name: teacherName, phone: teacherPhone } : t);
    } else {
      const newTeacher = { id: Date.now().toString(), name: teacherName, phone: teacherPhone, isActive: true };
      updated = [...teachers, newTeacher];
    }
    setTeachers(updated);
    persistHodData({ teachers: updated });
    setIsTeacherModalOpen(false);
    triggerToast(editingTeacher ? _t('تم تحديث بيانات المعلم', 'Teacher updated', 'Lehrer aktualisiert') : _t('تمت إضافة المعلم بنجاح', 'Teacher added successfully', 'Lehrer erfolgreich hinzugefügt'));
  };

  const handleToggleTeacherStatus = (id: string) => {
    const updated = teachers.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t);
    setTeachers(updated);
    persistHodData({ teachers: updated });
  };

  const handleDeleteTeacher = (id: string) => {
    if (window.confirm(_t('هل أنت متأكد من حذف هذا المعلم؟', 'Are you sure you want to delete this teacher?', 'Möchten Sie diesen Lehrer wirklich löschen?'))) {
      const updated = teachers.filter(t => t.id !== id);
      setTeachers(updated);
      persistHodData({ teachers: updated });
      triggerToast(_t('تم حذف المعلم', 'Teacher deleted', 'Lehrer gelöscht'));
    }
  };

  // State for Visits & Booklet Observations
  const [visitRecords, setVisitRecords] = useState<any[]>(schoolSettings.visitRecords || []);
  const [bookletObservations, setBookletObservations] = useState<any[]>(schoolSettings.bookletObservations || []);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [obsInitialTeacherId, setObsInitialTeacherId] = useState<string | undefined>(undefined);
  const [previewVisitRecord, setPreviewVisitRecord] = useState<any | null>(null);
  const [isBulkVisitExportModalOpen, setIsBulkVisitExportModalOpen] = useState(false);
  const [bulkExportTeacherId, setBulkExportTeacherId] = useState<string | undefined>(undefined);
  const [selectedTeacherVisitIds, setSelectedTeacherVisitIds] = useState<Set<string>>(new Set());
  const [isBatchGeneratingPdf, setIsBatchGeneratingPdf] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const handleBatchDownloadVisitsPdf = async (visitsToDownload: any[]) => {
    if (visitsToDownload.length === 0 || isBatchGeneratingPdf) return;
    setIsBatchGeneratingPdf(true);
    setBatchProgress({ current: 1, total: visitsToDownload.length });
    triggerToast(_t('جاري تجميع وإنشاء ملف PDF للزيارات المحددة 📄...', 'Generating combined PDF for selected visits 📄...', 'Kombiniertes PDF wird erstellt 📄...'));
    try {
      const res = await downloadCombinedObservationReportsPdf(
        visitsToDownload,
        schoolSettings,
        (language === 'ar'),
        language,
        (current, total) => setBatchProgress({ current, total })
      );
      if (res?.success) {
        triggerToast(_t(`تم تحميل ملف PDF المجمّع (${res.filename}) بنجاح 📥`, 'Combined PDF downloaded successfully 📥', 'Kombiniertes PDF erfolgreich heruntergeladen 📥'));
      } else {
        triggerToast(_t('تعذر تحميل الملف المجمّع، يرجى المحاولة مجدداً', 'Failed to generate combined PDF', 'Fehler beim Erstellen des kombinierten PDF'));
      }
    } catch (err) {
      console.error('Batch download PDF error:', err);
      triggerToast(_t('حدث خطأ أثناء تحميل ملف الـ PDF المجمّع', 'Error generating combined PDF', 'Fehler beim Erstellen des kombinierten PDF'));
    } finally {
      setIsBatchGeneratingPdf(false);
      setBatchProgress(null);
    }
  };

  const handleBatchPrintVisits = async (visitsToPrint: any[]) => {
    if (visitsToPrint.length === 0) return;
    try {
      await printCombinedObservationReports(
        visitsToPrint,
        schoolSettings,
        (language === 'ar'),
        language
      );
    } catch (err) {
      console.error('Batch print error:', err);
      triggerToast(_t('حدث خطأ أثناء طباعة الزيارات', 'Error printing visits', 'Fehler beim Drucken'));
    }
  };

  const [visitForm, setVisitForm] = useState({
    teacherId: '',
    className: '',
    visitedDate: new Date().toISOString().split('T')[0],
    periodNumber: '',
    lessonTopic: '',
    positivePoints: '',
    areasForImprovement: '',
    overallEvaluation: ''
  });

  // State for Weekly Reports
  const [stageReports, setStageReports] = useState<any[]>(schoolSettings.stageReports || []);
  const [selectedManagerId, setSelectedManagerId] = useState(schoolSettings.stageManagers?.[0]?.id || '');
  const [reportWeekTitle, setReportWeekTitle] = useState('التقرير الأسبوعي - الأسبوع الأول');
  const [draftContent, setDraftContent] = useState(`تقرير المتابعة الأسبوعية لقسم اللغة الألمانية:
1. الحضور والانصراف: التزام تام بجميع مواعيد الحصص الرسمية.
2. الشكاوى والملاحظات: لا توجد شكاوى جوهرية، مع تحسن ملحوظ في تفاعل الطلاب.
3. الزيارات الصفية: تم تنفيذ الزيارات الميدانية المخطط لها وفق الجدول الزمني.
4. الجوانب الإيجابية: تفعيل التقنيات الحديثة وحرص الطلاب على إنجاز الواجبات.`);

  // Helpers & Dropdown Constants for Weekly Plans
  const S1_S2_DROPDOWN_OPTIONS = [
    'Wiederholung',
    'Aktivität',
    'Projekt',
    'Prüfung / Test'
  ];

  const HA_DROPDOWN_OPTIONS = [
    'Keine Hausaufgaben',
    'Im Heft',
    'Arbeitsblatt'
  ];

  const QUIZ_HINWEIS_DROPDOWN_OPTIONS = [
    'Quiz 1',
    'Quiz 2',
    'Wortschatz-Test',
    'Grammatik-Quiz',
    'Kurztest',
    'Bitte Heft mitbringen'
  ];

  const getGermanGradeBandLabel = (band: string) => {
    if (band.includes('1–3') || band.includes('1-3')) return 'Primarstufe (Klassen 1–3)';
    if (band.includes('4–6') || band.includes('4-6')) return 'Primarstufe (Klassen 4–6)';
    if (band.includes('7–9') || band.includes('7-9')) return 'Sekundarstufe I (Klassen 7–9)';
    if (band.includes('10–12') || band.includes('10-12')) return 'Sekundarstufe II (Klassen 10–12)';
    return band;
  };

  const getGermanGradeName = (gradeName: string, band: string, idx: number) => {
    if (gradeName && gradeName.startsWith('Klasse')) return gradeName;
    if (band.includes('1–3') || band.includes('1-3')) return `Klasse ${idx + 1}`;
    if (band.includes('4–6') || band.includes('4-6')) return `Klasse ${idx + 4}`;
    if (band.includes('7–9') || band.includes('7-9')) return `Klasse ${idx + 7}`;
    if (band.includes('10–12') || band.includes('10-12')) return `Klasse ${idx + 10}`;
    return gradeName || `Klasse ${idx + 1}`;
  };

  const getEmptyGradesForBand = (band: string) => {
    if (band.includes('1–3') || band.includes('1-3')) {
      return [
        { gradeName: 'Klasse 1', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 2', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 3', s1: '', s2: '', ha: '', quiz: '' }
      ];
    } else if (band.includes('4–6') || band.includes('4-6')) {
      return [
        { gradeName: 'Klasse 4', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 5', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 6', s1: '', s2: '', ha: '', quiz: '' }
      ];
    } else if (band.includes('7–9') || band.includes('7-9')) {
      return [
        { gradeName: 'Klasse 7', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 8', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 9', s1: '', s2: '', ha: '', quiz: '' }
      ];
    } else {
      return [
        { gradeName: 'Klasse 10', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 11', s1: '', s2: '', ha: '', quiz: '' },
        { gradeName: 'Klasse 12', s1: '', s2: '', ha: '', quiz: '' }
      ];
    }
  };

  const sanitizeGradesContent = (grades: any[], band: string) => {
    const empty = getEmptyGradesForBand(band);
    if (!grades || !Array.isArray(grades) || grades.length === 0) return empty;
    return empty.map((emptyItem, idx) => {
      const g = grades[idx];
      if (!g) return emptyItem;
      // Filter out legacy mock data if matched
      const s1 = (g.s1 === 'S. 4-6' || g.s1 === 'S. [Page Number]' || g.s1 === 'S. 1-3') ? '' : (g.s1 || '');
      const s2 = (g.s2 === 'S. 7-9' || g.s2 === 'S. [Page Number]' || g.s2 === 'S. 4-6') ? '' : (g.s2 || '');
      const ha = (g.ha === 'Arbeitsbuch S. 4-5' || g.ha === 'Arbeitsbuch S. [Page Number]' || g.ha === 'Arbeitsbuch S. 1-2') ? '' : (g.ha || '');
      const quiz = (g.quiz === 'Quiz 1' || g.quiz === 'Kein Quiz / Hinweis' || g.quiz === 'Kein Quiz') ? '' : (g.quiz || '');
      return {
        gradeName: g.gradeName || emptyItem.gradeName,
        s1,
        s2,
        ha,
        quiz
      };
    });
  };

  const getArabicGradeBandLabel = (band: string) => {
    if (band.includes('1–3') || band.includes('1-3')) return 'المرحلة الابتدائية (الصفوف 1-3)';
    if (band.includes('4–6') || band.includes('4-6')) return 'المرحلة الابتدائية العليا (الصفوف 4-6)';
    if (band.includes('7–9') || band.includes('7-9')) return 'المرحلة الإعدادية (الصفوف 7-9)';
    if (band.includes('10–12') || band.includes('10-12')) return 'المرحلة الثانوية (الصفوف 10-12)';
    return band;
  };

  const cleanSecretaryName = (name?: string) => {
    if (!name) return '';
    const cleaned = name.replace(/^(أستاذة|أ\/|سكرتيرة|السكرتيرة|Frau|Herr)\s*/gi, '').trim();
    return cleaned;
  };

  const cleanHodName = (name?: string) => {
    if (!name) return schoolSettings.hodName || profile?.displayName || '';
    const cleaned = name.replace(/^(أستاذ|أ\/|Herr|Dr\.|Mr\.)\s*/gi, '').trim();
    return cleaned || schoolSettings.hodName || profile?.displayName || '';
  };

  const WEEKLY_SECRETARY_APPRECIATIONS = [
    {
      emoji: '🌹',
      de: (sec: string) => sec ? `🌹 *Vielen Dank für Ihre wertvolle Unterstützung zum Start der Schulwoche, Frau ${sec}!*` : `🌹 *Vielen Dank für Ihre wertvolle Unterstützung zum Start der Schulwoche!*`,
      en: (sec: string) => sec ? `_(Thank you so much for your valuable support at the start of this school week, Ms. ${sec})_` : `_(Thank you so much for your valuable support at the start of this school week)_`
    },
    {
      emoji: '🌷',
      de: (sec: string) => sec ? `🌷 *Herzlichen Dank für Ihre kontinuierliche Mühe und tatkräftige Hilfe, Frau ${sec}!*` : `🌷 *Herzlichen Dank für Ihre kontinuierliche Mühe und tatkräftige Hilfe!*`,
      en: (sec: string) => sec ? `_(Warm thanks for your ongoing dedication and active assistance, Ms. ${sec})_` : `_(Warm thanks for your ongoing dedication and active assistance)_`
    },
    {
      emoji: '🌸',
      de: (sec: string) => sec ? `🌸 *Ein großes Dankeschön für Ihre hervorragende Zusammenarbeit und Organisation, Frau ${sec}!*` : `🌸 *Ein großes Dankeschön für Ihre hervorragende Zusammenarbeit und Organisation!*`,
      en: (sec: string) => sec ? `_(A big thank you for your outstanding cooperation and organization, Ms. ${sec})_` : `_(A big thank you for your outstanding cooperation and organization)_`
    },
    {
      emoji: '🌺',
      de: (sec: string) => sec ? `🌺 *Vielen Dank für Ihren unermüdlichen Einsatz und Ihre verlässliche Betreuung, Frau ${sec}!*` : `🌺 *Vielen Dank für Ihren unermüdlichen Einsatz und Ihre verlässliche Betreuung!*`,
      en: (sec: string) => sec ? `_(Thank you for your tireless effort and reliable coordination, Ms. ${sec})_` : `_(Thank you for your tireless effort and reliable coordination)_`
    },
    {
      emoji: '🌻',
      de: (sec: string) => sec ? `🌻 *Herzlichen Dank für Ihre wunderbare Unterstützung und Freundlichkeit, Frau ${sec}!*` : `🌻 *Herzlichen Dank für Ihre wunderbare Unterstützung und Freundlichkeit!*`,
      en: (sec: string) => sec ? `_(Warm thanks for your wonderful support and kindness, Ms. ${sec})_` : `_(Warm thanks for your wonderful support and kindness)_`
    },
    {
      emoji: '🌼',
      de: (sec: string) => sec ? `🌼 *Vielen Dank für Ihre wertvolle Begleitung und professionelle Arbeit, Frau ${sec}!*` : `🌼 *Vielen Dank für Ihre wertvolle Begleitung und professionelle Arbeit!*`,
      en: (sec: string) => sec ? `_(Thank you for your valuable guidance and professional work, Ms. ${sec})_` : `_(Thank you for your valuable guidance and professional work)_`
    },
    {
      emoji: '💐',
      de: (sec: string) => sec ? `💐 *Ein herzliches Dankeschön für Ihre stetige Hilfe und Ihr großes Engagement, Frau ${sec}!*` : `💐 *Ein herzliches Dankeschön für Ihre stetige Hilfe und Ihr großes Engagement!*`,
      en: (sec: string) => sec ? `_(Sincere thanks for your continuous assistance and great commitment, Ms. ${sec})_` : `_(Sincere thanks for your continuous assistance and great commitment)_`
    },
    {
      emoji: '🪷',
      de: (sec: string) => sec ? `🪷 *Vielen Dank für Ihren erstklassigen Beitrag zum reibungslosen Ablauf, Frau ${sec}!*` : `🪷 *Vielen Dank für Ihren erstklassigen Beitrag zum reibungslosen Ablauf!*`,
      en: (sec: string) => sec ? `_(Thank you for your first-class contribution to smooth school operations, Ms. ${sec})_` : `_(Thank you for your first-class contribution to smooth school operations)_`
    },
    {
      emoji: '💮',
      de: (sec: string) => sec ? `💮 *Herzlichen Dank für Ihre geschätzte Geduld und tatkräftige Unterstützung, Frau ${sec}!*` : `💮 *Herzlichen Dank für Ihre geschätzte Geduld und tatkräftige Unterstützung!*`,
      en: (sec: string) => sec ? `_(Warm thanks for your appreciated patience and effective support, Ms. ${sec})_` : `_(Warm thanks for your appreciated patience and effective support)_`
    },
    {
      emoji: '🏵️',
      de: (sec: string) => sec ? `🏵️ *Vielen Dank für die stets vorbildliche und angenehme Zusammenarbeit, Frau ${sec}!*` : `🏵️ *Vielen Dank für die stets vorbildliche und angenehme Zusammenarbeit!*`,
      en: (sec: string) => sec ? `_(Thank you for the always exemplary and pleasant collaboration, Ms. ${sec})_` : `_(Thank you for the always exemplary and pleasant collaboration)_`
    },
    {
      emoji: '🌷',
      de: (sec: string) => sec ? `🌷 *Ein großes Dankeschön für Ihren täglichen Einsatz und Ihre Verlässlichkeit, Frau ${sec}!*` : `🌷 *Ein großes Dankeschön für Ihren täglichen Einsatz und Ihre Verlässlichkeit!*`,
      en: (sec: string) => sec ? `_(A huge thank you for your daily dedication and dependability, Ms. ${sec})_` : `_(A huge thank you for your daily dedication and dependability)_`
    },
    {
      emoji: '🌹',
      de: (sec: string) => sec ? `🌹 *Herzlichen Dank für Ihre unverzichtbare Unterstützung und Fürsorge, Frau ${sec}!*` : `🌹 *Herzlichen Dank für Ihre unverzichtbare Unterstützung und Fürsorge!*`,
      en: (sec: string) => sec ? `_(Warm thanks for your indispensable support and care, Ms. ${sec})_` : `_(Warm thanks for your indispensable support and care)_`
    },
    {
      emoji: '🌸',
      de: (sec: string) => sec ? `🌸 *Vielen Dank für Ihren stetigen Fleiß und Ihre positive Energie, Frau ${sec}!*` : `🌸 *Vielen Dank für Ihren stetigen Fleiß und Ihre positive Energie!*`,
      en: (sec: string) => sec ? `_(Thank you for your constant diligence and positive energy, Ms. ${sec})_` : `_(Thank you for your constant diligence and positive energy)_`
    },
    {
      emoji: '🌺',
      de: (sec: string) => sec ? `🌺 *Ein herzliches Dankeschön für die exzellente Unterstützung und Koordination, Frau ${sec}!*` : `🌺 *Ein herzliches Dankeschön für die exzellente Unterstützung und Koordination!*`,
      en: (sec: string) => sec ? `_(Sincere thanks for the excellent support and coordination, Ms. ${sec})_` : `_(Sincere thanks for the excellent support and coordination)_`
    },
    {
      emoji: '🌻',
      de: (sec: string) => sec ? `🌻 *Vielen Dank für Ihre großartige Hilfsbereitschaft und Ihren Einsatz, Frau ${sec}!*` : `🌻 *Vielen Dank für Ihre großartige Hilfsbereitschaft und Ihren Einsatz!*`,
      en: (sec: string) => sec ? `_(Thank you for your great readiness to help and dedication, Ms. ${sec})_` : `_(Thank you for your great readiness to help and dedication)_`
    },
    {
      emoji: '🌼',
      de: (sec: string) => sec ? `🌼 *Herzlichen Dank für Ihre wertvolle Arbeit und beste Organisation, Frau ${sec}!*` : `🌼 *Herzlichen Dank für Ihre wertvolle Arbeit und beste Organisation!*`,
      en: (sec: string) => sec ? `_(Warm thanks for your valuable work and top-tier organization, Ms. ${sec})_` : `_(Warm thanks for your valuable work and top-tier organization)_`
    },
    {
      emoji: '🪷',
      de: (sec: string) => sec ? `🪷 *Vielen Dank für Ihre tatkräftige Unterstützung in dieser Schulwoche, Frau ${sec}!*` : `🪷 *Vielen Dank für Ihre tatkräftige Unterstützung in dieser Schulwoche!*`,
      en: (sec: string) => sec ? `_(Thank you for your energetic support during this school week, Ms. ${sec})_` : `_(Thank you for your energetic support during this school week)_`
    },
    {
      emoji: '💐',
      de: (sec: string) => sec ? `💐 *Ein herzliches Dankeschön für Ihre kontinuierliche und verlässliche Hilfe, Frau ${sec}!*` : `💐 *Ein herzliches Dankeschön für Ihre kontinuierliche und verlässliche Hilfe!*`,
      en: (sec: string) => sec ? `_(Sincere thanks for your continuous and reliable help, Ms. ${sec})_` : `_(Sincere thanks for your continuous and reliable help)_`
    },
    {
      emoji: '💮',
      de: (sec: string) => sec ? `💮 *Vielen Dank für Ihren bewundernswerten Einsatz und die tolle Zusammenarbeit, Frau ${sec}!*` : `💮 *Vielen Dank für Ihren bewundernswerten Einsatz und die tolle Zusammenarbeit!*`,
      en: (sec: string) => sec ? `_(Thank you for your admirable effort and great collaboration, Ms. ${sec})_` : `_(Thank you for your admirable effort and great collaboration)_`
    },
    {
      emoji: '🏵️',
      de: (sec: string) => sec ? `🏵️ *Herzlichen Dank für Ihre hervorragende Unterstützung über das gesamte Semester hinweg, Frau ${sec}!*` : `🏵️ *Herzlichen Dank für Ihre hervorragende Unterstützung über das gesamte Semester hinweg!*`,
      en: (sec: string) => sec ? `_(Warm thanks for your outstanding support throughout the semester, Ms. ${sec})_` : `_(Warm thanks for your outstanding support throughout the semester)_`
    }
  ];

  const getWeeklySecretaryThankYou = (weekNum: number | string, secName?: string) => {
    const numericWeek = Math.max(1, parseInt(String(weekNum).replace(/\D/g, ''), 10) || 1);
    const index = (numericWeek - 1) % WEEKLY_SECRETARY_APPRECIATIONS.length;
    const template = WEEKLY_SECRETARY_APPRECIATIONS[index];
    const cleanName = cleanSecretaryName(secName);
    return `${template.de(cleanName)}\n${template.en(cleanName)}`;
  };

  const generateWeeklyPlanMessage = (
    plan: any,
    weekNum: number | string,
    secName?: string,
    hodName?: string
  ) => {
    const grades = (plan.gradesContent && plan.gradesContent.length > 0)
      ? sanitizeGradesContent(plan.gradesContent, plan.gradeBand)
      : getEmptyGradesForBand(plan.gradeBand);

    const formattedSecName = cleanSecretaryName(secName || plan.secretaryName);
    const formattedHodName = cleanHodName(hodName || schoolSettings.hodName || profile?.displayName || '');

    let text = `📌 *Wochenplan - Deutschabteilung*\n`;
    text += `🗓️ *Schulwoche: Woche ${weekNum}*\n`;
    text += `🏫 *Stufe:* ${getGermanGradeBandLabel(plan.gradeBand)}\n`;
    text += `──────────────────────────────────\n\n`;

    grades.forEach((g: any, idx: number) => {
      const gName = getGermanGradeName(g.gradeName, plan.gradeBand, idx);
      text += `📚 *${gName}*\n`;
      text += `• *S.1:* ${g.s1 || '-'}\n`;
      text += `• *S.2:* ${g.s2 || '-'}\n`;
      text += `• *H.A:* ${g.ha || '-'}\n`;
      const note = g.quiz || g.hinweis;
      if (note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' && note.trim() !== '') {
        text += `• *Quiz / Hinweis:* ${note}\n`;
      }
      if (idx < grades.length - 1) text += `\n`;
    });

    text += `\n──────────────────────────────────\n`;
    text += `${getWeeklySecretaryThankYou(weekNum, formattedSecName)}\n\n`;

    if (formattedHodName) {
      text += `✍️ *Mit freundlichen Grüßen, Herr ${formattedHodName} (Fachleiter für Deutsch)*\n`;
      text += `_(Best regards, Mr. ${formattedHodName} - Head of German Department)_`;
    } else {
      text += `✍️ *Mit freundlichen Grüßen (Fachleiter für Deutsch)*\n`;
      text += `_(Best regards - Head of German Department)_`;
    }

    return text;
  };

  const generateAllWeeklyPlansCombinedMessage = (
    plans: any[],
    weekNum: number | string
  ) => {
    let text = `📌 *Wochenplan - Deutschabteilung*\n`;
    text += `🗓️ *Schulwoche: Woche ${weekNum}*\n`;
    text += `──────────────────────────────────\n\n`;

    const allGradesText: string[] = [];

    plans.forEach((plan: any) => {
      const grades = (plan.gradesContent && plan.gradesContent.length > 0)
        ? sanitizeGradesContent(plan.gradesContent, plan.gradeBand)
        : getEmptyGradesForBand(plan.gradeBand);

      grades.forEach((g: any, idx: number) => {
        const gName = getGermanGradeName(g.gradeName, plan.gradeBand, idx);
        let gradeBlock = `📚 *${gName}*\n`;
        gradeBlock += `• *S.1:* ${g.s1 || '-'}\n`;
        gradeBlock += `• *S.2:* ${g.s2 || '-'}\n`;
        gradeBlock += `• *H.A:* ${g.ha || '-'}`;
        const note = g.quiz || g.hinweis;
        if (note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' && note.trim() !== '') {
          gradeBlock += `\n• *Quiz / Hinweis:* ${note}`;
        }
        allGradesText.push(gradeBlock);
      });
    });

    text += allGradesText.join('\n\n');
    return text;
  };

  // State for Weekly Plans
  const gradeBands = ['Grades 1–3', 'Grades 4–6', 'Grades 7–9', 'Grades 10–12'];
  const [selectedPlanWeekNumber, setSelectedPlanWeekNumber] = useState<number>(1);
  const [editingPlanRecord, setEditingPlanRecord] = useState<any | null>(null);

  const createDefaultPlanForBandAndWeek = (band: string, weekNum: number) => {
    const sec = getSecretaryForGradeBand(band, schoolSettings);

    return {
      id: `${band}_w${weekNum}`,
      gradeBand: band,
      status: 'not_sent', // Strictly NOT_SENT by default
      sentAt: undefined,
      secretaryName: sec.name || '',
      secretaryPhone: sec.phone || '',
      weekNumber: weekNum,
      gradesContent: getEmptyGradesForBand(band)
    };
  };

  const [weeklyPlans, setWeeklyPlans] = useState<any[]>(() => {
    if (schoolSettings.weeklyPlanStatuses && Array.isArray(schoolSettings.weeklyPlanStatuses) && schoolSettings.weeklyPlanStatuses.length > 0) {
      return schoolSettings.weeklyPlanStatuses.map((p: any) => {
        // Sanitize legacy hardcoded 'sent' status if present from previous mock defaults
        const isLegacyFakeSent = (p.id === '2' && p.sentAt === '2026-08-19');
        return {
          ...p,
          status: isLegacyFakeSent ? 'not_sent' : (p.status || 'not_sent'),
          sentAt: isLegacyFakeSent ? undefined : p.sentAt,
          gradesContent: sanitizeGradesContent(p.gradesContent, p.gradeBand),
          weekNumber: p.weekNumber || 1
        };
      });
    }
    return gradeBands.map(band => createDefaultPlanForBandAndWeek(band, 1));
  });

  // Derived current displayed plans for active week (defaults to NOT_SENT if no explicit record exists)
  const currentWeekPlans = gradeBands.map(band => {
    const existing = weeklyPlans.find(
      p => p.gradeBand === band && Number(p.weekNumber || 1) === Number(selectedPlanWeekNumber)
    );
    if (existing) {
      const resolvedSec = getSecretaryForGradeBand(band, schoolSettings, existing.secretaryName, existing.secretaryPhone);
      return {
        ...existing,
        secretaryName: existing.secretaryName || resolvedSec.name,
        secretaryPhone: existing.secretaryPhone || resolvedSec.phone,
        gradesContent: sanitizeGradesContent(existing.gradesContent, existing.gradeBand)
      };
    }
    return createDefaultPlanForBandAndWeek(band, selectedPlanWeekNumber);
  });

  // Stage Managers & Stage Follow-up State
  const stageManagers: any[] = schoolSettings.stageManagers || [];

  const [stageFollowUps, setStageFollowUps] = useState<StageFollowUpRecord[]>(schoolSettings.stageFollowUps || []);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedStageManager, setSelectedStageManager] = useState<any | null>(null);
  const [followUpPeriodType, setFollowUpPeriodType] = useState<'weekly' | 'monthly' | 'termly'>('weekly');
  const [followUpWeekNumber, setFollowUpWeekNumber] = useState<number | string>(1);
  const [followUpTeachersData, setFollowUpTeachersData] = useState<Record<string, TeacherStageEvaluationItem>>({});
  const [overallStageNotes, setOverallStageNotes] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  const PRESET_EVALS = {
    curriculum: ['ممتاز وفي الخطة', 'متقدم عن الخطة', 'متأخر قليلاً عن المنهج', 'يحتاج خطة تعويضية'],
    booklets: ['متابعة دقيقة ومنتظمة', 'تصحيح جيد وملاحظات بناءة', 'توجد كراسات تحتاج مراجعة', 'يحتاج اهتمام أكبر بالتصحيح'],
    management: ['سيطرة ممتازة وتفاعل قوي', 'بيئة تعليمية هادئة ومنظمة', 'تفاعل متوسط للطلاب', 'يحتاج تعزيز الحزم والتفاعل'],
    punctuality: ['منضبط جداً في الحضور والدخول', 'حضور منتظم دون تأخير', 'تأخيرات بسيطة بعذر', 'يحتاج التزام بدقة المواعيد'],
    complaints: ['لا توجد أي شكاوى', 'تم حل الشكاوى الواردة بنجاح', 'جاري متابعة ملاحظة ولي الأمر', 'مطلوب اجتماع مع ولي الأمر']
  };

  // Helper to extract grade numbers (1 to 12) from strings or arrays
  const extractGradeNumbers = (input: string | string[]): Set<number> => {
    const grades = new Set<number>();
    const strings = Array.isArray(input) ? input : [input];

    for (const rawStr of strings) {
      if (!rawStr) continue;
      const str = rawStr.toLowerCase().trim();

      // Check explicit ranges like 1-3, 4-6, 7-9, 10-12, 1–3, 4–6, 7–9, 10–12
      const rangeMatches = Array.from(str.matchAll(/(\d{1,2})\s*[\-–—]\s*(\d{1,2})/g));
      let foundRange = false;
      for (const match of rangeMatches) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        if (start >= 1 && end <= 12 && start <= end) {
          for (let g = start; g <= end; g++) {
            grades.add(g);
          }
          foundRange = true;
        }
      }

      // Check Arabic & English ordinal grade names
      if (/أول|اول|1st|prim 1|p1\b|g1\b/i.test(str)) grades.add(1);
      if (/ثاني|ثاني|2nd|prim 2|p2\b|g2\b/i.test(str)) grades.add(2);
      if (/ثالث|ثالث|3rd|prim 3|p3\b|g3\b/i.test(str)) grades.add(3);
      if (/رابع|رابع|4th|prim 4|p4\b|g4\b/i.test(str)) grades.add(4);
      if (/خامس|خامس|5th|prim 5|p5\b|g5\b/i.test(str)) grades.add(5);
      if (/سادس|سادس|6th|prim 6|p6\b|g6\b/i.test(str)) grades.add(6);
      if (/سابع|سابع|7th|prep 1|m1\b|g7\b/i.test(str)) grades.add(7);
      if (/ثامن|ثامن|8th|prep 2|m2\b|g8\b/i.test(str)) grades.add(8);
      if (/تاسع|تاسع|9th|prep 3|m3\b|g9\b/i.test(str)) grades.add(9);
      if (/عاشر|عاشر|10th|sec 1|g10\b/i.test(str)) grades.add(10);
      if (/حادي\s*عشر|11th|sec 2|g11\b/i.test(str)) grades.add(11);
      if (/ثاني\s*عشر|12th|sec 3|g12\b/i.test(str)) grades.add(12);

      // Standalone numbers 1..12 if no range matched
      if (!foundRange) {
        const numMatches = str.match(/(?:^|\D)(1[0-2]|[1-9])(?:\D|$)/g);
        if (numMatches) {
          numMatches.forEach(m => {
            const digits = m.match(/1[0-2]|[1-9]/);
            if (digits) {
              const num = parseInt(digits[0], 10);
              if (num >= 1 && num <= 12) grades.add(num);
            }
          });
        }
      }
    }

    return grades;
  };

  const getSupervisedTeachersForManager = (manager: any) => {
    if (!manager) return [];

    const managerInputs: string[] = [];
    if (manager.assignedGradeGroups && Array.isArray(manager.assignedGradeGroups)) {
      managerInputs.push(...manager.assignedGradeGroups);
    }
    if (manager.gradeBand) {
      managerInputs.push(manager.gradeBand);
    }

    const managerTargetGrades = extractGradeNumbers(managerInputs);

    return teachers.filter(t => {
      if (t.isHod) return false;

      const wl = getWorkload(t.id);
      const teacherClasses = wl.assignedClasses || [];

      // Extract grade numbers taught by this teacher
      const teacherGrades = extractGradeNumbers(teacherClasses);

      // Check numeric grade intersection
      if (managerTargetGrades.size > 0 && teacherGrades.size > 0) {
        for (const g of teacherGrades) {
          if (managerTargetGrades.has(g)) return true;
        }
      }

      // Fallback string matching if grade numbers couldn't be extracted
      if (teacherClasses.length > 0 && managerInputs.length > 0) {
        const classesLower = teacherClasses.map(c => c.toLowerCase());
        return managerInputs.some(input => {
          const inpLower = input.toLowerCase();
          return classesLower.some(cls => cls.includes(inpLower) || inpLower.includes(cls));
        });
      }

      return false;
    });
  };

  const handleOpenFollowUpModal = (manager: any) => {
    setSelectedStageManager(manager);
    setFollowUpPeriodType('weekly');
    setFollowUpWeekNumber(1);
    setOverallStageNotes('');

    const supervised = getSupervisedTeachersForManager(manager);
    const initialData: Record<string, TeacherStageEvaluationItem> = {};

    supervised.forEach((t: any) => {
      const wl = getWorkload(t.id);
      const tVisits = visitRecords.filter(v => v.teacherId === t.id);
      const totalVisits = tVisits.length;
      const avgScore = totalVisits > 0 
        ? Math.round(tVisits.reduce((acc, v) => acc + (v.overallScore || 70), 0) / totalVisits)
        : 0;
      const tComplaints = parentComplaints.filter(c => c.teacherId === t.id);

      initialData[t.id] = {
        teacherId: t.id,
        teacherName: t.name,
        assignedClasses: wl.assignedClasses,
        totalSessions: wl.totalSessions,
        visitsCount: totalVisits,
        visitsAvgScore: totalVisits > 0 ? avgScore : 'لا توجد',
        complaintsCount: tComplaints.length,
        curriculumAdherence: 'ممتاز وفي الخطة',
        bookletChecking: 'متابعة دقيقة ومنتظمة',
        classroomManagement: 'سيطرة ممتازة وتفاعل قوي',
        punctuality: 'منضبط جداً في الحضور والدخول',
        complaintsStatus: tComplaints.length > 0 ? 'جاري متابعة الشكوى' : 'لا توجد أي شكاوى',
        customNotes: ''
      };
    });

    setFollowUpTeachersData(initialData);
    setIsFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = async () => {
    if (!selectedStageManager) return;
    setIsSavingFollowUp(true);

    const newRecord: StageFollowUpRecord = {
      id: Date.now().toString(),
      stageManagerId: selectedStageManager.id,
      stageManagerName: selectedStageManager.name,
      gradeBand: (selectedStageManager.assignedGradeGroups || []).join(', ') || 'عام',
      periodType: followUpPeriodType,
      weekNumber: followUpWeekNumber,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      teachersData: Object.values(followUpTeachersData),
      overallStageNotes
    };

    const updated = [newRecord, ...stageFollowUps];
    setStageFollowUps(updated);
    persistHodData({ stageFollowUps: updated });

    triggerToast(_t('تم حفظ وإرسال متابعة المرحلة بنجاح', 'Stage follow-up report saved successfully', 'Erfolgreich gespeichert'));
    setIsSavingFollowUp(false);
    setIsFollowUpModalOpen(false);
  };

  const handleDownloadStageFollowUp = async (record: StageFollowUpRecord) => {
    if (activeLoadingAction) return;
    setActiveLoadingAction({ id: record.id, type: 'download' });
    triggerToast(_t('جاري إنشاء وتحميل تقرير المتابعة PDF 📄...', 'Generating and downloading follow-up report PDF 📄...', 'Bericht wird als PDF generiert 📄...'));
    try {
      const res = await downloadStageFollowUpPdf(record, schoolSettings, (language === 'ar'), language);
      if (res?.success) {
        triggerToast(_t(`تم تجهيز وتحميل تقرير المتابعة (${res.filename}) بنجاح 📥`, `Follow-up report downloaded successfully 📥`, `Bericht heruntergeladen 📥`));
      } else {
        triggerToast(_t('تعذر تحميل التقرير، يرجى المحاولة مجدداً', 'Download failed, please try again', 'Fehler beim Download'));
      }
    } catch (err) {
      console.error('Download error:', err);
      triggerToast(_t('حدث خطأ أثناء تحميل التقرير', 'Error downloading report', 'Fehler beim Download'));
    } finally {
      setActiveLoadingAction(null);
    }
  };

  const handleShareStageFollowUpWhatsApp = async (record: StageFollowUpRecord) => {
    if (activeLoadingAction) return;
    setActiveLoadingAction({ id: record.id, type: 'share' });
    try {
      await shareStageFollowUpViaWhatsApp(record, schoolSettings, (language === 'ar'), language);
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setActiveLoadingAction(null);
    }
  };

  const handlePrintStageFollowUp = (record: StageFollowUpRecord) => {
    printStageFollowUpReport(record, schoolSettings, (language === 'ar'), language);
  };

  // Save changes to profile
  const persistHodData = (updates: any) => {
    const updatedSettings = {
      ...schoolSettings,
      visitRecords,
      bookletObservations,
      weeklyPlanStatuses: weeklyPlans,
      stageReports,
      stageFollowUps,
      ...updates
    };
    updateProfile({ schoolSettings: updatedSettings });
  };

  // Handlers for Visits
  const handleAddVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitForm.teacherId || !visitForm.className) return;
    
    const teacherName = teachers.find(t => t.id === visitForm.teacherId)?.name || visitForm.teacherId;
    
    const item = {
      id: Date.now().toString(),
      teacherId: visitForm.teacherId,
      teacherName,
      className: visitForm.className,
      term: schoolSettings.currentTerm || 'Term 1',
      visitedDate: visitForm.visitedDate,
      periodNumber: visitForm.periodNumber,
      lessonTopic: visitForm.lessonTopic,
      positivePoints: visitForm.positivePoints,
      areasForImprovement: visitForm.areasForImprovement,
      overallEvaluation: visitForm.overallEvaluation
    };
    const updated = [item, ...visitRecords];
    setVisitRecords(updated);
    persistHodData({ visitRecords: updated });
    
    setVisitForm({
      teacherId: '',
      className: '',
      visitedDate: new Date().toISOString().split('T')[0],
      periodNumber: '',
      lessonTopic: '',
      positivePoints: '',
      areasForImprovement: '',
      overallEvaluation: ''
    });
    setIsVisitModalOpen(false);
    triggerToast(_t('تم تسجيل الزيارة بنجاح', 'Visit logged successfully', 'Besuch erfolgreich protokolliert'));
  };

  
  const handleToggleBookletStatus = (className: string, newStatus: any) => {
    const existingIndex = bookletObservations.findIndex(b => b.className === className);
    let updated = [...bookletObservations];
    
    if (existingIndex >= 0) {
      updated[existingIndex] = { ...updated[existingIndex], status: newStatus, updatedAt: Date.now() };
    } else {
      updated.push({
        id: Date.now().toString(),
        className,
        status: newStatus,
        updatedAt: Date.now()
      });
    }
    
    setBookletObservations(updated);
    persistHodData({ bookletObservations: updated });
  };

  const handleDeleteVisit = (id: string) => {
    const updated = visitRecords.filter(v => v.id !== id);
    setVisitRecords(updated);
    persistHodData({ visitRecords: updated });
  };

  // Booklet correction toggle
  const handleToggleBooklet = (className: string, currentStatus: string) => {
    const statuses = ['completed', 'partially_completed', 'not_completed', 'na'];
    const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    const nextStatus = statuses[nextIdx];

    const existing = bookletObservations.find(b => b.className === className);
    let updated = [...bookletObservations];
    if (existing) {
      updated = updated.map(b => b.className === className ? { ...b, status: nextStatus, updatedAt: Date.now() } : b);
    } else {
      updated.push({ id: Date.now().toString(), className, status: nextStatus, updatedAt: Date.now() });
    }
    setBookletObservations(updated);
    persistHodData({ bookletObservations: updated });
  };

  // Weekly plan actions
  const handleTogglePlanStatus = (planOrId: any) => {
    const targetPlan = typeof planOrId === 'string'
      ? (weeklyPlans.find(p => p.id === planOrId) || currentWeekPlans.find(p => p.id === planOrId))
      : planOrId;

    if (!targetPlan) return;

    const weekNum = targetPlan.weekNumber || selectedPlanWeekNumber;
    const band = targetPlan.gradeBand;
    const currentStatus = targetPlan.status || 'not_sent';
    const nextStatus = currentStatus === 'sent' ? 'not_sent' : 'sent';
    const freshSentAt = nextStatus === 'sent' ? new Date().toISOString().split('T')[0] : undefined;

    const targetId = `${band}_w${weekNum}`;
    const existingIdx = weeklyPlans.findIndex(p => p.gradeBand === band && Number(p.weekNumber || 1) === Number(weekNum));

    let updatedPlans: any[];
    if (existingIdx >= 0) {
      updatedPlans = [...weeklyPlans];
      updatedPlans[existingIdx] = {
        ...updatedPlans[existingIdx],
        id: targetId,
        status: nextStatus,
        sentAt: freshSentAt,
        weekNumber: weekNum
      };
    } else {
      updatedPlans = [
        ...weeklyPlans,
        {
          ...targetPlan,
          id: targetId,
          status: nextStatus,
          sentAt: freshSentAt,
          weekNumber: weekNum
        }
      ];
    }

    setWeeklyPlans(updatedPlans);
    persistHodData({ weeklyPlanStatuses: updatedPlans });

    triggerToast(nextStatus === 'sent' 
      ? _t('تم الإرسال - حفظ حالة الخطة 🟢', 'Marked plan as sent 🟢', 'Als gesendet markiert 🟢') 
      : _t('تم تحديث الخطة إلى لم تُرسل 🔴', 'Marked plan as pending 🔴', 'Als ausstehend markiert 🔴'));
  };

  const handleCopyFormattedPlanText = (plan: any) => {
    const weekNum = plan.weekNumber || selectedPlanWeekNumber;
    const sec = getSecretaryForGradeBand(plan.gradeBand, schoolSettings, plan.secretaryName, plan.secretaryPhone);
    const text = generateWeeklyPlanMessage(plan, weekNum, sec.name, schoolSettings.hodName);
    navigator.clipboard.writeText(text);
    triggerToast(_t('تم نسخ الخطة الأسبوعية بنسق الواتساب 📋', 'Plan copied to clipboard 📋', 'In Zwischenablage kopiert 📋'));
  };

  const handleSharePlanWhatsApp = (targetPlan: any) => {
    if (!targetPlan) return;
    const weekNum = targetPlan.weekNumber || selectedPlanWeekNumber;
    const band = targetPlan.gradeBand;
    const sec = getSecretaryForGradeBand(band, schoolSettings, targetPlan.secretaryName, targetPlan.secretaryPhone);
    const text = generateWeeklyPlanMessage(targetPlan, weekNum, sec.name, schoolSettings.hodName);
    const cleanPhone = (sec.phone || targetPlan.secretaryPhone || '').replace(/[^0-9]/g, '');
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    const freshSentAt = new Date().toISOString().split('T')[0];
    const targetId = `${band}_w${weekNum}`;
    const existingIdx = weeklyPlans.findIndex(p => p.gradeBand === band && Number(p.weekNumber || 1) === Number(weekNum));

    let updatedPlans: any[];
    if (existingIdx >= 0) {
      updatedPlans = [...weeklyPlans];
      updatedPlans[existingIdx] = {
        ...updatedPlans[existingIdx],
        id: targetId,
        status: 'sent',
        sentAt: freshSentAt,
        weekNumber: weekNum
      };
    } else {
      updatedPlans = [
        ...weeklyPlans,
        {
          ...targetPlan,
          id: targetId,
          status: 'sent',
          sentAt: freshSentAt,
          weekNumber: weekNum
        }
      ];
    }

    setWeeklyPlans(updatedPlans);
    persistHodData({ weeklyPlanStatuses: updatedPlans });

    window.open(url, '_blank');
    triggerToast(_t('جاري فتح واتساب ومشاركة الخطة 🚀', 'Opening WhatsApp 🚀', 'WhatsApp wird geöffnet 🚀'));
  };

  const handleDownloadWeeklyPlan = async (plan: any) => {
    if (downloadingPlanId) return;
    const weekNum = plan.weekNumber || selectedPlanWeekNumber;
    setDownloadingPlanId(plan.id);
    triggerToast(_t('جاري إنشاء وتحميل ملف الـ PDF 📄...', 'Generating and downloading PDF 📄...', 'PDF wird generiert und heruntergeladen 📄...'));
    try {
      const res = await downloadSingleWeeklyPlanPdf(plan, schoolSettings, weekNum);
      if (res.success) {
        triggerToast(_t(`تم تحميل ملف الخطة (${res.filename}) بنجاح 📥`, `Downloaded ${res.filename} successfully 📥`, `Wochenplan heruntergeladen 📥`));
      } else {
        triggerToast(_t('تعذر تحميل الملف، يرجى إعادة المحاولة', 'Download failed, please try again', 'Fehler beim Download'));
      }
    } catch (err) {
      console.error('Error downloading weekly plan:', err);
      triggerToast(_t('حدث خطأ أثناء تحميل الملف', 'Error downloading file', 'Fehler beim Download'));
    } finally {
      setDownloadingPlanId(null);
    }
  };

  const handleDownloadAllWeeklyPlansCombined = async () => {
    if (isDownloadingAllPlans) return;
    setIsDownloadingAllPlans(true);
    triggerToast(_t('جاري إنشاء وتحميل الجدول المجمع لكافة المراحل PDF 📊...', 'Generating Master Combined Table PDF 📊...', 'Gesamttabelle PDF wird generiert 📊...'));
    try {
      const res = await downloadAllWeeklyPlansCombinedPdf(currentWeekPlans, schoolSettings, selectedPlanWeekNumber);
      if (res.success) {
        triggerToast(_t(`تم تحميل الجدول المجمع (${res.filename}) بنجاح 📥`, `Downloaded master table successfully 📥`, `Gesamttabelle heruntergeladen 📥`));
      } else {
        triggerToast(_t('تعذر تحميل الجدول المجمع، يرجى إعادة المحاولة', 'Download failed, please try again', 'Fehler beim Download'));
      }
    } catch (err) {
      console.error('Error downloading master weekly plan:', err);
      triggerToast(_t('حدث خطأ أثناء تحميل الملف', 'Error downloading file', 'Fehler beim Download'));
    } finally {
      setIsDownloadingAllPlans(false);
    }
  };

  const handleSaveEditedPlan = (updatedRecord: any) => {
    if (!updatedRecord) return;
    const weekNum = updatedRecord.weekNumber || selectedPlanWeekNumber;
    const band = updatedRecord.gradeBand;
    const targetId = `${band}_w${weekNum}`;

    const existingIdx = weeklyPlans.findIndex(p => p.gradeBand === band && Number(p.weekNumber || 1) === Number(weekNum));

    let updatedPlans: any[];
    if (existingIdx >= 0) {
      updatedPlans = [...weeklyPlans];
      updatedPlans[existingIdx] = {
        ...updatedPlans[existingIdx],
        ...updatedRecord,
        id: targetId,
        weekNumber: weekNum
      };
    } else {
      updatedPlans = [
        ...weeklyPlans,
        {
          ...updatedRecord,
          id: targetId,
          weekNumber: weekNum,
          status: updatedRecord.status || 'not_sent'
        }
      ];
    }

    setWeeklyPlans(updatedPlans);
    persistHodData({ weeklyPlanStatuses: updatedPlans });
    setEditingPlanRecord(null);
    triggerToast(_t('تم حفظ وتنسيق الخطة الأسبوعية بنجاح 💾', 'Weekly plan saved successfully 💾', 'Erfolgreich gespeichert 💾'));
  };

  const handleClearSinglePlan = (plan: any) => {
    if (!plan) return;
    const weekNum = plan.weekNumber || selectedPlanWeekNumber;
    const band = plan.gradeBand;
    const targetId = `${band}_w${weekNum}`;
    const emptyGrades = getEmptyGradesForBand(band);

    const existingIdx = weeklyPlans.findIndex(p => p.gradeBand === band && Number(p.weekNumber || 1) === Number(weekNum));
    let updatedPlans: any[];

    if (existingIdx >= 0) {
      updatedPlans = [...weeklyPlans];
      updatedPlans[existingIdx] = {
        ...updatedPlans[existingIdx],
        id: targetId,
        weekNumber: weekNum,
        status: 'not_sent',
        sentAt: undefined,
        gradesContent: emptyGrades
      };
    } else {
      updatedPlans = [
        ...weeklyPlans,
        {
          id: targetId,
          gradeBand: band,
          weekNumber: weekNum,
          status: 'not_sent',
          sentAt: undefined,
          secretaryName: plan.secretaryName || '',
          secretaryPhone: plan.secretaryPhone || '',
          gradesContent: emptyGrades
        }
      ];
    }

    setWeeklyPlans(updatedPlans);
    persistHodData({ weeklyPlanStatuses: updatedPlans });
    triggerToast(_t(`تم تفريغ خطة ${getArabicGradeBandLabel(band)} بالكامل 🧹`, `Cleared ${band} plan 🧹`, `Plan geleert 🧹`));
  };

  const handleClearAllPlansForWeek = (weekNum: number) => {
    const updatedPlans = weeklyPlans.filter(p => Number(p.weekNumber || 1) !== Number(weekNum));
    setWeeklyPlans(updatedPlans);
    persistHodData({ weeklyPlanStatuses: updatedPlans });
    triggerToast(_t(`تم تفريغ جميع خطط الأسبوع ${weekNum} بنجاح 🧹`, `Cleared all plans for week ${weekNum} 🧹`, `Alle Pläne für Woche ${weekNum} geleert 🧹`));
  };

  const handleClearAllWeeklyPlansEver = () => {
    setWeeklyPlans([]);
    persistHodData({ weeklyPlanStatuses: [] });
    triggerToast(_t('تم تفريغ جميع الخطط الأسبوعية لكافة الأسابيع بنجاح 🧹', 'Wiped all weekly plans for all weeks 🧹', 'Alle Wochenpläne zurückgesetzt 🧹'));
  };

  // Stage Report save/send
  const handleSaveReport = (status: 'draft' | 'sent') => {
    const manager = (schoolSettings.stageManagers || []).find((m: any) => m.id === selectedManagerId) || { name: schoolSettings.hodName || 'مدير المرحلة' };
    const reportItem = {
      id: Date.now().toString(),
      weekTitle: reportWeekTitle,
      stageManagerId: selectedManagerId,
      stageManagerName: manager.name,
      contentAr: draftContent,
      status,
      timestamp: Date.now()
    };
    const updated = [reportItem, ...stageReports];
    setStageReports(updated);
    persistHodData({ stageReports: updated });
    triggerToast(status === 'sent' ? _t('تم إرسال التقرير لمدير المرحلة بنجاح', 'Report sent to Stage Manager successfully', 'Bericht an Stufenleiter gesendet') : _t('تم حفظ المسودة', 'Draft saved', 'Entwurf gespeichert'));
  };

  // Print All Teachers View
  const handlePrintTimetables = () => {
    window.print();
  };

  return (
    <div className="space-y-2 max-w-7xl mx-auto pb-12">
      {/* Toast */}
      {showToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-2.5 py-1 rounded-xl shadow-lg font-bold text-[11px] animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex w-full items-center justify-start sm:justify-center gap-1 bg-surface p-1 rounded-xl border border-surface-border shadow-2xs overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', icon: BarChart3, title: _t('الرئيسية', 'Overview', 'Übersicht'), activeClass: 'bg-primary text-white' },
          { id: 'stage_managers', icon: Shield, title: _t('المراحل', 'Stages', 'Stufen'), activeClass: 'bg-primary text-white' },
          { id: 'staff', icon: Users, title: _t('المعلمين', 'Staff', 'Kollegium'), activeClass: 'bg-primary text-white' },
          { id: 'timetables', icon: Calendar, title: _t('الجداول', 'Timetables', 'Pläne'), activeClass: 'bg-primary text-white' },
          { id: 'plans', icon: CheckCircle2, title: _t('الخطة', 'Plans', 'Pläne'), activeClass: 'bg-primary text-white' },
          { id: 'students', icon: GraduationCap, title: _t('الطلاب', 'Students', 'Schüler'), activeClass: 'bg-primary text-white' },
          { id: 'action_plans', icon: Target, title: _t('الدعم', 'Support', 'Förder'), activeClass: 'bg-emerald-600 text-white' },
          { id: 'complaints', icon: AlertTriangle, title: _t('الشكاوى', 'Complaints', 'Beschwerden'), activeClass: 'bg-rose-600 text-white' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-8 sm:h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
                isActive 
                  ? `${tab.activeClass} px-2 sm:px-3 gap-1 sm:gap-1.5 shadow-xs font-black shrink-0` 
                  : 'w-7 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
              }`}
              title={tab.title}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              {isActive && <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap overflow-hidden">{tab.title}</span>}
            </button>
          );
        })}
      </div>

      {/* TAB OVERVIEW: HOD DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="space-y-2 animate-fade-in relative pb-20">
          {/* 1. Core KPIs & Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-2">
            <div 
              onClick={() => setActiveTab('staff')}
              className="bg-surface border border-surface-border p-3 rounded-xl shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-1">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-text-main">{liveKpis?.visitsCount ?? visitRecords.length}</span>
              <span className="text-[10px] font-bold text-text-muted">{_t('الزيارات الصفية', 'Class Visits', 'Besuche')}</span>
            </div>

            <div 
              onClick={() => setActiveTab('action_plans')}
              className="bg-surface border border-surface-border p-2 sm:p-2.5 rounded-xl shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-500 transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-text-main">{liveKpis?.activePlansCount ?? activePlans.length}</span>
              <span className="text-[10px] font-bold text-text-muted">{_t('خطط الدعم النشطة', 'Active Plans', 'Aktive Pläne')}</span>
            </div>

            <div 
              onClick={() => setActiveTab('complaints')}
              className="bg-surface border border-surface-border p-2 sm:p-2.5 rounded-xl shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer hover:border-rose-500 transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-1">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-text-main">{liveKpis?.pendingComplaintsCount ?? parentComplaints.filter(c => c.status !== 'resolved').length}</span>
              <span className="text-[10px] font-bold text-text-muted">{_t('شكاوى معلقة', 'Pending Issues', 'Beschwerden')}</span>
            </div>
          </div>

          {/* 2. Live Daily Section Schedule Bar */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-2.5 sm:p-3 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-30 animate-ping" />
                <Clock className="w-4 h-4 relative" />
              </div>
              <div>
                <h4 className="text-[11px] font-black text-text-main">
                  {_t('البث الحقيقي للحصص والفعاليات اليومية', 'Live Section Schedule Bar', 'Aktueller Stunden-Status')}
                </h4>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {teachers.filter(t => getTeacherStatus(t.id).status === 'in_class').length} {_t('معلمين يعطون حصصاً الآن', 'teachers teaching now', 'Lehrer im Unterricht')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('timetables')}
              className="px-2 py-1 bg-primary text-white text-[11px] font-bold rounded-xl shadow-xs hover:bg-primary-hover transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>{_t('عرض الجدول الكامل', 'Full Timetable', 'Vollständiger Plan')}</span>
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          {/* 3. Student Demographics Card */}
          <div className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                <h3 className="text-[11px] font-black text-text-main">
                  {_t('ديموغرافيا طلاب قسم اللغة الألمانية', 'German Department Student Demographics', 'Schüler-Demografie')}
                </h3>
              </div>
              <span className="px-2.5 py-1 bg-primary-soft text-primary font-black text-[11px] rounded-xl">
                {liveStudentData ? liveStudentData.totalStudents : 0} {_t('طالب إجمالاً', 'Total Students', 'Schüler')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {!liveStudentData ? (
                <div className="col-span-full py-6 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
              ) : (
                (liveStudentData.stages || []).map((stage: any) => (
                  <div key={stage.id} className="bg-surface-hover p-2 sm:p-2.5 rounded-xl border border-surface-border space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-bold text-text-main">
                      <span className="truncate">{stage.nameAr}</span>
                      <span className="text-primary font-black shrink-0">{stage.total} {_t('طالب', 'students', 'Schüler')}</span>
                    </div>
                    <div className={`grid grid-cols-${Math.min(stage.grades.length, 3)} gap-1 text-[11px] text-text-muted`}>
                      {stage.grades.map((g: any) => (
                        <span key={g.grade} className="bg-surface p-1.5 rounded-lg text-center border border-surface-border font-bold truncate" title={`${g.nameAr}: ${g.count}`}>
                          {g.grade}: {g.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Secretariat Weekly Plan Tracker by Stage */}
          <div className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-primary" />
                <h3 className="text-[11px] font-black text-text-main">
                  {_t('متابعة تسليم الـ Weekly Plan للسكرتارية حسب المرحلة', 'Secretariat Weekly Plan Tracker by Stage', 'Wochenplan-Tracker nach Stufe')}
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('plans')}
                className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
              >
                {_t('إدارة الخطط بالكامل', 'Manage All Plans', 'Alle Pläne')}
              </button>
            </div>

            <div className="space-y-2">
              {gradeBands.map(band => {
                const plan = weeklyPlans.find(p => p.gradeBand === band && Number(p.weekNumber || 1) === Number(selectedPlanWeekNumber)) || createDefaultPlanForBandAndWeek(band, selectedPlanWeekNumber);
                const isSent = plan.status === 'sent';
                return (
                  <div key={band} className="bg-surface-hover p-3 rounded-xl border border-surface-border flex items-center justify-between gap-1.5">
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-[11px] font-black text-text-main truncate">
                        {getArabicGradeBandLabel(band)}
                      </h4>
                      <p className="text-[10px] text-text-muted">
                        {_t('السكرتيرة المسؤولـة:', 'Responsible Sec:', 'Sekretärin:')} <span className="font-bold text-text-main">{plan.secretaryName || _t('غير محدد', 'Unassigned', 'Nicht zugewiesen')}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black border ${
                        isSent 
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isSent ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {isSent ? _t('تم التسليم 🟢', 'Submitted 🟢', 'Eingereicht 🟢') : _t('معلق 🔴', 'Pending 🔴', 'Ausstehend 🔴')}
                      </span>
                      <button
                        onClick={() => {
                          const updated = weeklyPlans.map(p => {
                            if (p.gradeBand === band && Number(p.weekNumber || 1) === Number(selectedPlanWeekNumber)) {
                              return { ...p, status: isSent ? 'not_sent' : 'sent', sentAt: isSent ? undefined : new Date().toISOString().split('T')[0] };
                            }
                            return p;
                          });
                          if (!weeklyPlans.some(p => p.gradeBand === band && Number(p.weekNumber || 1) === Number(selectedPlanWeekNumber))) {
                            updated.push({ ...plan, status: 'sent', sentAt: new Date().toISOString().split('T')[0] });
                          }
                          setWeeklyPlans(updated);
                          persistHodData({ weeklyPlanStatuses: updated });
                          triggerToast(_t('تم تحديث حالة تسليم الخطة', 'Plan status updated', 'Status aktualisiert'));
                        }}
                        className="px-2.5 py-1 bg-surface border border-surface-border rounded-lg text-[10px] font-bold text-text-main hover:bg-surface-hover cursor-pointer"
                      >
                        {isSent ? _t('إلغاء التسليم', 'Mark Pending', 'Zurücksetzen') : _t('تأكيد التسليم للسكرتارية', 'Mark Submitted', 'Bestätigen')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Full Teachers Daily Timetable Card */}
          <div className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-[11px] font-black text-text-main">
                  {_t('جدول حصص المعلمين اليومي (P1 - P8)', 'Full Teachers Daily Timetable (P1 - P8)', 'Tägliche Stundenpläne')}
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('timetables')}
                className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
              >
                {_t('عرض الماتريكس الكامل', 'Full Matrix', 'Vollständiges Raster')}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-surface-hover text-text-muted font-bold">
                    <th className="p-2 border border-surface-border text-right">{_t('المعلم', 'Teacher', 'Lehrer')}</th>
                    {timings.map(p => (
                      <th key={p.periodNumber} className="p-1.5 border border-surface-border text-center min-w-[65px]">
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-black text-text-main text-[11px]">P{p.periodNumber}</span>
                          <span className="text-[8px] font-mono font-bold text-text-muted tracking-tighter whitespace-nowrap">{p.startTime}-{p.endTime}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(t => {
                    const todayKey = new Date().getDay().toString();
                    const teacherCustomsToday = (schoolSettings.customTimedSessions || [] as CustomTimedSession[]).filter(
                      (cs: CustomTimedSession) => cs.teacherId === t.id && cs.dayKey === todayKey
                    );

                    return (
                      <tr key={t.id} className="border border-surface-border hover:bg-surface-hover/30">
                        <td className="p-2 border border-surface-border font-bold text-text-main">
                          <div className="flex flex-col">
                            <span>{t.name}</span>
                            {teacherCustomsToday.length > 0 && (
                              <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{teacherCustomsToday.length} {_t('حصة مخصصة', 'custom', 'Spezial')}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        {timings.map(p => {
                          const lesson = getLessonForTeacher(t.id, todayKey, p.periodNumber);
                          const matchingCustoms = getCustomSessionsForPeriod(
                            schoolSettings.customTimedSessions,
                            todayKey,
                            p.periodNumber,
                            timings,
                            t.id
                          );

                          return (
                            <td key={p.periodNumber} className="p-1 border border-surface-border text-center align-middle">
                              <div className="flex flex-col gap-0.5 items-center justify-center">
                                {lesson && (
                                  <span className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary font-black rounded text-[10px]">
                                    {lesson.className}
                                  </span>
                                )}
                                {matchingCustoms.map((cs: CustomTimedSession) => (
                                  <span key={cs.id} className="inline-block px-1 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold rounded text-[8.5px] border border-indigo-200 dark:border-indigo-800" title={`${cs.className} (⏱️ ${cs.startTime}-${cs.endTime})`}>
                                    {cs.className}
                                  </span>
                                ))}
                                {!lesson && matchingCustoms.length === 0 && (
                                  <span className="text-text-muted/30">-</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* STAFF ATTENDANCE OVERVIEW (HOD DASHBOARD OVERVIEW TAB - Requirement 3) */}
          <div className="bg-surface border border-surface-border rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-black text-text-main">
                      {_t('موجز حضور وانضباط المعلمين', 'Staff Attendance Overview', 'Anwesenheitsübersicht')}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-hover text-text-muted text-[10px] font-bold border border-surface-border">
                      {_t('الأسبوع الحالي', 'Current Week', 'Diese Woche')}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-text-muted font-medium">
                    {_t('رصد الغياب، التأخير، الانصراف المبكر ومعدل الالتزام الأسبوعي', 'Weekly tracking of absences, delays, early leaves and discipline', 'Wöchentliche Erfassung von Abwesenheiten und Verspätungen')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTeacherForAttendance(null);
                    setEditingAttendanceRecord(null);
                    setIsAttendanceModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{_t('تسجيل واقعة', 'Log Event', 'Erfassen')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailedAttendanceModalOpen(true)}
                  className="px-2.5 py-1.5 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl text-[10.5px] font-bold border border-surface-border flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('عرض السجل التفصيلي', 'View Details', 'Details')}</span>
                </button>
              </div>
            </div>

            {/* 5 Compact Metrics Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Absences */}
              <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">
                  {_t('الغياب هذا الأسبوع', 'Absences This Week', 'Fehlzeiten')}
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                    {weeklyAttendanceMetrics.totalAbsences}
                  </span>
                  <span className="text-[10px] text-text-muted font-bold">
                    {_t('يوم/حصة', 'days/lessons', 'Tage')}
                  </span>
                </div>
                <span className="text-[9.5px] text-text-muted font-medium mt-0.5">
                  {weeklyAttendanceMetrics.totalUnexcusedAbsences > 0 ? (
                    <span className="text-rose-600 font-bold">{weeklyAttendanceMetrics.totalUnexcusedAbsences} {_t('بدون عذر', 'unexcused', 'unentsch.')}</span>
                  ) : (
                    _t('لا غياب غير مبرر', 'No unexcused', 'Keine')
                  )}
                </span>
              </div>

              {/* Late Arrivals */}
              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  {_t('التأخير الصباحي', 'Late Arrivals', 'Verspätungen')}
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {weeklyAttendanceMetrics.totalLateArrivals}
                  </span>
                  <span className="text-[10px] text-text-muted font-bold">
                    {_t('مرات', 'times', 'Mal')}
                  </span>
                </div>
                <span className="text-[9.5px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  {weeklyAttendanceMetrics.totalDelayMinutes} {_t('دقيقة تأخير', 'delay mins', 'Min. Verspätung')}
                </span>
              </div>

              {/* Early Leaves */}
              <div className="p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400">
                  {_t('الانصراف المبكر', 'Early Leaves', 'Frühzeitiges Gehen')}
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-orange-600 dark:text-orange-400">
                    {weeklyAttendanceMetrics.totalEarlyLeaves}
                  </span>
                  <span className="text-[10px] text-text-muted font-bold">
                    {_t('مرات', 'times', 'Mal')}
                  </span>
                </div>
                <span className="text-[9.5px] text-orange-600 dark:text-orange-400 font-bold mt-0.5">
                  {weeklyAttendanceMetrics.totalLostHours} {_t('ساعة مفقودة', 'lost hrs', 'Std. Verlust')}
                </span>
              </div>

              {/* Teachers With Violations */}
              <div className="p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                  {_t('معلمين بمخالفات', 'Teachers With Violations', 'Lehrer mit Verstößen')}
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {weeklyAttendanceMetrics.teachersWithViolationsCount}
                  </span>
                  <span className="text-[10px] text-text-muted font-bold">
                    / {teachers.length}
                  </span>
                </div>
                <span className="text-[9.5px] text-text-muted font-medium mt-0.5">
                  {weeklyAttendanceMetrics.teachersWithViolationsCount === 0 ? (
                    <span className="text-emerald-600 font-bold">{_t('انضباط تام 100%', 'Full compliance', 'Vollständig')}</span>
                  ) : (
                    _t('بحاجة لمتابعة', 'Needs follow-up', 'Nachverfolgung')
                  )}
                </span>
              </div>

              {/* Average Attendance Rate */}
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  {_t('معدل الانضباط العام', 'Average Discipline Rate', 'Disziplinrate')}
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {weeklyAttendanceMetrics.averageAttendanceRate}%
                  </span>
                </div>
                <div className="w-full bg-surface-border rounded-full h-1.5 mt-1 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      weeklyAttendanceMetrics.averageAttendanceRate >= 90
                        ? 'bg-emerald-500'
                        : weeklyAttendanceMetrics.averageAttendanceRate >= 75
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${weeklyAttendanceMetrics.averageAttendanceRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick summary strip if there are infractions */}
            {weeklyAttendanceMetrics.teachersWithViolationsCount > 0 && (
              <div className="p-2 rounded-xl bg-surface-hover/60 border border-surface-border/80 flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-bold text-text-main">{_t('المعلمين الأكثر تسجيلاً للمخالفات هذا الأسبوع:', 'Teachers with infractions this week:', 'Auffällige Lehrer:')}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {weeklyAttendanceMetrics.teacherStats
                    .filter(s => (s.absences + s.lateArrivals + s.earlyLeaves) > 0)
                    .slice(0, 3)
                    .map(s => (
                      <span key={s.teacherId} className="px-2 py-0.5 rounded-lg bg-surface border border-surface-border font-bold text-text-main">
                        {s.teacherName}: <span className="text-rose-600">{s.absences} غياب</span> • <span className="text-amber-600">{s.lateArrivals} تأخير</span>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating Speed-Dial FAB (+) - Raised above bottom navigation bar */}
          <div className="fixed bottom-28 sm:bottom-8 right-4 sm:right-8 z-45 flex flex-col items-end gap-2">
            {isFabOpen && (
              <div className="bg-surface border border-surface-border rounded-2xl shadow-2xl p-2 flex flex-col gap-1.5 mb-2 w-64 animate-fade-in">
                <div className="px-2 py-1 text-[10px] font-black text-text-muted uppercase border-b border-surface-border">
                  {_t('إجراءات سريعة (Speed Dial)', 'Quick Actions', 'Schnellaktionen')}
                </div>
                <button
                  onClick={() => { setIsFabOpen(false); setIsVisitModalOpen(true); }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-text-main hover:bg-surface-hover transition-all text-right w-full cursor-pointer active:scale-98"
                >
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span>{_t('زيارة صفية جديدة', 'New Class Visit', 'Neuer Unterrichtsbesuch')}</span>
                </button>
                <button
                  onClick={() => { setIsFabOpen(false); setIsComplaintModalOpen(true); }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-text-main hover:bg-surface-hover transition-all text-right w-full cursor-pointer active:scale-98"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{_t('تسجيل شكوى جديدة', 'New Complaint', 'Neue Beschwerde')}</span>
                </button>
                <button
                  onClick={() => { setIsFabOpen(false); setActiveTab('action_plans'); }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-text-main hover:bg-surface-hover transition-all text-right w-full cursor-pointer active:scale-98"
                >
                  <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{_t('خطة دعم أكاديمي جديدة', 'New Support Plan', 'Neuer Förderplan')}</span>
                </button>
                <button
                  onClick={() => { setIsFabOpen(false); setActiveTab('stage_managers'); }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-text-main hover:bg-surface-hover transition-all text-right w-full cursor-pointer active:scale-98"
                >
                  <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{_t('التواصل مع مديري المراحل', 'Stage Manager Communication', 'Stufenleiter-Kommunikation')}</span>
                </button>
              </div>
            )}
            
            <button
              onClick={() => setIsFabOpen(!isFabOpen)}
              className="w-13 h-13 sm:w-14 sm:h-14 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center transition-all cursor-pointer border-2 border-white/20"
              title="Quick Actions FAB"
            >
              <Plus className={`w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-200 ${isFabOpen ? 'rotate-45' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* TAB 0: STAGE MANAGERS COMMUNICATION */}
      {activeTab === 'stage_managers' && (
        <StageCommunicationView />
      )}

      {/* TAB 1: TEACHERS' TIMETABLES TRACKER */}
      {activeTab === 'timetables' && (
        <div className="space-y-2 animate-fade-in">
          {/* Compact Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 bg-surface p-2 rounded-xl border border-surface-border shadow-2xs">
            <h2 className="text-[11px] font-black text-text-main px-2">
              {_t('الجدول والمتابعة', 'Timetable & Tracker', 'Stundenplan & Übersicht')}
            </h2>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenAddCustomSession()}
                className="flex-1 sm:flex-none px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 dark:text-indigo-400 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border border-indigo-100 dark:border-indigo-800 cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{_t('إضافة حصة بتوقيت مخصص', 'Add Custom Session', 'Spezielle Stunde')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex-1 sm:flex-none px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-800 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{_t('طباعة / تصدير', 'Print / Export', 'Drucken / Export')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportScope('all');
                  setSelectedTeacherForImport('');
                  setValidationResult(null);
                  setIsImportModalOpen(true);
                }}
                className="flex-1 sm:flex-none px-2 py-1 bg-primary-soft text-primary hover:bg-primary-soft/80 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{_t('استيراد بالذكاء الاصطناعي', 'AI Import', 'KI-Import')}</span>
              </button>
            </div>
          </div>

          {/* Unified Weekly Matrix */}
          <div className="bg-surface border border-surface-border rounded-xl shadow-2xs overflow-hidden flex flex-col">
            <div className="p-3 border-b border-surface-border bg-surface-hover/30 flex flex-col xl:flex-row xl:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-[11px] font-bold text-text-main shrink-0">
                  {_t('الجدول الأسبوعي الموحد', 'Unified Weekly Matrix', 'Einheitlicher Wochenplan')}
                </h3>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full xl:w-auto">
                <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-surface-border w-full sm:w-auto flex-wrap justify-center">
                  <button 
                    onClick={() => setMatrixDayFilter('all')}
                    className={`shrink-0 px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${matrixDayFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-surface-hover'}`}
                  >
                    {_t('الكل', 'All', 'Alle')}
                  </button>
                  {['0','1','2','3','4'].map(d => (
                    <button 
                      key={d}
                      onClick={() => setMatrixDayFilter(d as any)}
                      className={`shrink-0 px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${matrixDayFilter === d ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-surface-hover'}`}
                    >
                      {WEEKDAY_NAMES[d as keyof typeof WEEKDAY_NAMES].split(' ')[0]}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-surface-border w-full sm:w-auto shrink-0">
                  <button 
                    onClick={() => setMatrixViewMode('grid')}
                    className={`flex-1 sm:flex-none px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${matrixViewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-surface-hover'}`}
                  >
                    {_t('ماتريكس', 'Grid', 'Raster')}
                  </button>
                  <button 
                    onClick={() => setMatrixViewMode('single')}
                    className={`flex-1 sm:flex-none px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${matrixViewMode === 'single' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-surface-hover'}`}
                  >
                    {_t('معلم محدد', 'Single', 'Einzel')}
                  </button>
                </div>
              </div>
            </div>

            {matrixViewMode === 'single' && (
              <div className="p-3 border-b border-surface-border bg-surface-hover/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <select
                  value={selectedSingleTeacher}
                  onChange={(e) => setSelectedSingleTeacher(e.target.value)}
                  className="w-full sm:max-w-xs p-2 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-semibold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">{_t('-- اختر المعلم --', '-- Select Teacher --', '-- Lehrer wählen --')}</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {selectedSingleTeacher && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleOpenAddCustomSession({ teacherId: selectedSingleTeacher })}
                      className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 border border-indigo-200 dark:border-indigo-800/50 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{_t('إضافة حصة مخصصة', 'Add Custom Session', 'Spezielle Stunde')}</span>
                    </button>

                    {!showClearMatrixTeacherConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowClearMatrixTeacherConfirm(true)}
                        className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 border border-rose-200 dark:border-rose-800/50 cursor-pointer"
                        title={_t('مسح جدول هذا المعلم فقط', "Clear This Teacher's Schedule Only", 'Diesen Stundenplan löschen')}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{_t('مسح جدول المعلم', 'Clear Schedule', 'Plan löschen')}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 p-0.5 bg-rose-500/10 border border-rose-500/30 rounded-lg animate-fade-in">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 px-1">
                          {_t('تأكيد مسح جدول هذا المعلم؟', 'Confirm clear schedule?', 'Löschen bestätigen?')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleClearSingleTeacherTimetable(selectedSingleTeacher);
                            setShowClearMatrixTeacherConfirm(false);
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9.5px] font-bold cursor-pointer transition-all active:scale-95"
                        >
                          {_t('نعم، امسح', 'Yes, Clear', 'Ja, löschen')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowClearMatrixTeacherConfirm(false)}
                          className="px-2 py-0.5 bg-surface hover:bg-surface-hover text-text-muted rounded text-[9.5px] font-bold border border-surface-border cursor-pointer transition-all"
                        >
                          {_t('إلغاء', 'Cancel', 'Abbrechen')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live Current Time Status Ribbon */}
            <div className="mx-2 mb-2 p-2 rounded-xl bg-gradient-to-r from-rose-500/10 via-primary/5 to-amber-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute" />
                  <span className="w-2 h-2 rounded-full bg-rose-600 relative" />
                </div>
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                  {_t('الوقت الحالي الآن:', 'Current Time:', 'Aktuelle Zeit:')}
                </span>
                <span className="text-[11.5px] font-black font-mono bg-surface px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 shadow-2xs">
                  {liveTimeInfo.formatted}
                </span>
                <span className="text-[10.5px] font-bold text-text-main">
                  • {liveTimeInfo.activePeriodInfo ? (
                    liveTimeInfo.activeStatus === 'in_period' ? (
                      <span>
                        {_t('أنت الآن في الحصة', 'Currently in Period', 'Aktuell in Stunde')} <strong className="text-rose-600 dark:text-rose-400 font-black">{liveTimeInfo.activePeriodInfo.periodNumber}</strong> ({liveTimeInfo.activePeriodInfo.startTime} - {liveTimeInfo.activePeriodInfo.endTime}) — {_t('متبقي على انتهائها', 'remaining', 'verbleibend')}: <strong className="text-rose-600 dark:text-rose-400 font-mono font-black">{liveTimeInfo.remainingMinutes} {_t('دقيقة', 'min', 'Min')}</strong>
                      </span>
                    ) : liveTimeInfo.activeStatus === 'break' ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        ☕ {_t('استراحة / فسحة بين الحصص', 'Break between periods', 'Pause zwischen Stunden')} (متبقي {liveTimeInfo.remainingMinutes}د على الحصة القادمة)
                      </span>
                    ) : liveTimeInfo.activeStatus === 'before' ? (
                      <span className="text-text-muted">
                        🌅 {_t('قبل بداية اليوم الدراسي', 'Before school starts', 'Vor Unterrichtsbeginn')} (الحصة 1 تبدأ {timings[0]?.startTime || '08:00'})
                      </span>
                    ) : (
                      <span className="text-text-muted">
                        🏁 {_t('انتهى اليوم الدراسي لجميع الحصص', 'School day finished for all periods', 'Schultag beendet')}
                      </span>
                    )
                  ) : null}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-bold shrink-0">
                <span className="w-2.5 h-[2.5px] bg-rose-500 rounded-full shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                <span>{_t('الخط الأحمر يقطع الجدول لتوضيح سير الوقت الحالي', 'Red line tracks live time across matrix', 'Rote Linie zeigt aktuelle Zeit')}</span>
              </div>
            </div>

            <div className={`overflow-y-auto max-h-[60vh] scrollbar-thin ${matrixViewMode === 'grid' ? 'w-full overflow-hidden' : ''}`}>
              {matrixViewMode === 'grid' ? (
                <table className="w-full text-left border-collapse table-fixed text-[11px]">
                  <thead className="sticky top-0 z-20 bg-surface-hover shadow-sm">
                    <tr>
                      <th className="p-1 border-b border-surface-border font-bold text-text-muted w-14 sm:w-20 text-center align-middle">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] sm:text-[11px] font-black">{_t('ي/ح', 'D/P', 'T/S')}</span>
                          <span className="text-[7.5px] sm:text-[8px] text-primary font-bold">{_t('نهاية الحصة', 'Ends At', 'Ende')}</span>
                        </div>
                      </th>
                      {teachers.map(t => {
                        const nameParts = t.name.split(' ');
                        const shortName = nameParts.length > 1 ? nameParts[0] + ' ' + nameParts[1][0] + '.' : nameParts[0];
                        return (
                        <th key={t.id} className="p-1 border-b border-surface-border border-l font-bold text-text-main text-center overflow-hidden">
                          <div className="flex flex-col items-center justify-center w-full">
                            <span className="truncate w-full text-[9px] sm:text-[11px] leading-tight" title={t.name}>{shortName}</span>
                            {t.isHod && <span className="text-[7px] bg-primary-soft text-primary px-0.5 rounded mt-0.5">HOD</span>}
                          </div>
                        </th>
                      )})}
                    </tr>
                  </thead>
                  <tbody>
                    {(['0','1','2','3','4'].filter(d => matrixDayFilter === 'all' || d === matrixDayFilter)).map((dayKey) => {
                      const dayUnmatchedCustoms = getUnmatchedCustomSessions(schoolSettings.customTimedSessions, dayKey, timings);
                      
                      return (
                        <React.Fragment key={dayKey}>
                          <tr>
                            <td colSpan={teachers.length + 1} className={`py-1.5 px-2 font-black text-center border-y border-surface-border text-[11px] sm:text-[12px] transition-colors ${
                              isDayActiveForLine(dayKey)
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60'
                                : 'bg-primary/5 dark:bg-primary/10 text-primary'
                            }`}>
                              <div className="flex items-center justify-center gap-2">
                                <span>{WEEKDAY_NAMES[dayKey as keyof typeof WEEKDAY_NAMES]}</span>
                                {isDayActiveForLine(dayKey) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-rose-600 text-white shadow-xs animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    <span>{_t('اليوم الحالي', 'Today', 'Heute')}</span>
                                    <span>•</span>
                                    <span>{liveTimeInfo.formatted}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {timings.map(period => {
                            const isThisPeriodActive = isDayActiveForLine(dayKey) && (liveTimeInfo.activePeriodNumber === period.periodNumber);

                            return (
                            <tr 
                              key={`${dayKey}-${period.periodNumber}`} 
                              className={`hover:bg-surface-hover/50 group relative transition-colors ${
                                isThisPeriodActive ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.08]' : ''
                              }`}
                            >
                              <td className={`p-0.5 sm:p-1 border-b border-surface-border font-bold text-text-muted text-center align-middle bg-surface group-hover:bg-surface-hover relative overflow-visible ${
                                isThisPeriodActive ? 'ring-1 ring-inset ring-rose-500/30' : ''
                              }`}>
                                {/* Live Time Line cutting across the D/P cell with time badge */}
                                {isThisPeriodActive && (
                                  <div 
                                    className="absolute left-0 right-0 h-[2.5px] bg-rose-500 dark:bg-rose-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                                    style={{ top: `${liveTimeInfo.progressPct}%` }}
                                  >
                                    <div className="absolute start-0 -translate-y-1/2 z-40 flex items-center gap-1 bg-rose-600 text-white text-[8px] sm:text-[8.5px] font-mono font-black px-1.5 py-0.5 rounded-full shadow-lg border border-white/40 whitespace-nowrap animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                      <span>{liveTimeInfo.formatted}</span>
                                      {liveTimeInfo.activeStatus === 'in_period' && (
                                        <span className="hidden sm:inline text-[7px] font-sans font-bold opacity-90">
                                          ({liveTimeInfo.remainingMinutes}د)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-col items-center justify-center leading-tight py-1 relative z-10">
                                  <span className="text-text-main font-black text-[11px] sm:text-[12px]">{period.periodNumber}</span>
                                  
                                  {/* Explicit user requirement: Under period number, display when it ends */}
                                  <div 
                                    className="mt-0.5 px-1 sm:px-1.5 py-0.5 rounded bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light font-mono font-black text-[8px] sm:text-[8.5px] whitespace-nowrap flex items-center justify-center gap-0.5 border border-primary/20 shadow-2xs"
                                    title={`${_t('الحصة', 'Period', 'Stunde')} ${period.periodNumber}: ${_t('من', 'from', 'von')} ${period.startTime} ${_t('حتى', 'to', 'bis')} ${period.endTime}`}
                                  >
                                    <span className="text-[6.5px] sm:text-[7px] font-sans font-bold opacity-80">{_t('ينتهي', 'Ends', 'Bis')}</span>
                                    <span>{period.endTime}</span>
                                  </div>

                                  <span className="text-[6.5px] sm:text-[7px] text-text-muted font-mono opacity-65 mt-0.5" title={_t('وقت البداية', 'Start time', 'Startzeit')}>
                                    {period.startTime}
                                  </span>
                                </div>
                              </td>
                              {teachers.map((t, tIdx) => {
                                const isLastTeacher = tIdx === teachers.length - 1;
                                const lesson = getLessonForTeacher(t.id, dayKey, period.periodNumber);
                                const matchingCustoms = getCustomSessionsForPeriod(
                                  schoolSettings.customTimedSessions,
                                  dayKey,
                                  period.periodNumber,
                                  timings,
                                  t.id
                                );

                                return (
                                  <td 
                                    key={t.id} 
                                    onClick={() => startEditPeriod(t.id, dayKey, period.periodNumber)}
                                    className="p-0.5 sm:p-1 border-b border-l border-surface-border text-center h-full align-middle overflow-visible cursor-pointer hover:bg-primary-soft/20 transition-colors group/cell relative"
                                    title={lesson 
                                      ? `${t.name}: ${lesson.className}${lesson.subjectName ? ` - ${lesson.subjectName}` : ''} (${_t('انقر للتعديل', 'Click to edit', 'Klicken zum Bearbeiten')})` 
                                      : `${t.name}: ${_t('انقر لإضافة حصة', 'Click to add period', 'Klicken zum Hinzufügen')}`
                                    }
                                  >
                                    {/* Horizontal Line cutting across this teacher's column */}
                                    {isThisPeriodActive && (
                                      <div 
                                        className="absolute left-0 right-0 h-[2.5px] bg-rose-500 dark:bg-rose-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                                        style={{ top: `${liveTimeInfo.progressPct}%` }}
                                      >
                                        {isLastTeacher && (
                                          <div className="absolute end-0 -translate-y-1/2 z-40 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 shadow-md flex items-center justify-center">
                                            <span className="w-1 h-1 rounded-full bg-white" />
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="flex flex-col gap-1 w-full relative z-10">
                                      {lesson && (
                                        <div className="flex flex-col items-center justify-center bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 rounded-[4px] py-1 px-0.5 sm:px-1 w-full overflow-hidden transition-all">
                                          <span className="font-bold text-text-main text-[9px] sm:text-[11px] leading-none truncate w-full">{lesson.className}</span>
                                          {lesson.subjectName && (
                                            <span className="text-[7.5px] sm:text-[9px] text-primary font-bold truncate w-full leading-none mt-0.5 hidden sm:block">
                                              {lesson.subjectName}
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {matchingCustoms.map((cs: CustomTimedSession) => (
                                        <div
                                          key={cs.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditCustomSession(cs);
                                          }}
                                          className="flex flex-col items-center justify-center bg-indigo-100/90 hover:bg-indigo-200/90 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 border border-indigo-300 dark:border-indigo-700/80 rounded-[4px] py-0.5 px-0.5 sm:px-1 w-full overflow-hidden transition-all cursor-pointer shadow-2xs group/cs"
                                          title={`${t.name}: ${cs.className} (⏱️ ${cs.startTime} - ${cs.endTime}) ${cs.subjectName ? `- ${cs.subjectName}` : ''} - ${_t('انقر للتعديل', 'Click to edit', 'Klicken zum Bearbeiten')}`}
                                        >
                                          <span className="font-black text-indigo-950 dark:text-indigo-200 text-[9px] sm:text-[10.5px] leading-none truncate w-full">{cs.className}</span>
                                          <span className="text-[7px] sm:text-[8px] text-indigo-700 dark:text-indigo-300 font-mono font-bold truncate w-full leading-none mt-0.5">
                                            ⏱️ {cs.startTime}-{cs.endTime}
                                          </span>
                                          {cs.subjectName && (
                                            <span className="text-[6.5px] sm:text-[7.5px] text-indigo-600 dark:text-indigo-400 font-semibold truncate w-full leading-none mt-0.5 hidden sm:block">
                                              {cs.subjectName}
                                            </span>
                                          )}
                                        </div>
                                      ))}

                                      {!lesson && matchingCustoms.length === 0 && (
                                        <div className="flex items-center justify-center w-full py-1 text-slate-300 dark:text-slate-600 group-hover/cell:text-primary transition-colors">
                                          <span className="text-[11px] font-black leading-none select-none">+</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          )})}

                          {/* Unmatched / Extended Custom Timed Sessions integrated directly into the day timeline */}
                          {dayUnmatchedCustoms.length > 0 && (
                            <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-200/50 dark:border-indigo-800/40">
                              <td className="p-0.5 sm:p-1 border-b border-indigo-200/50 dark:border-indigo-800/40 font-bold text-indigo-600 dark:text-indigo-400 text-center align-middle bg-indigo-50/70 dark:bg-indigo-950/40">
                                <div className="flex flex-col items-center justify-center py-0.5" title={_t('حصص بتوقيت مخصص خارج الحصص الأساسية', 'Custom Timed Sessions', 'Spezielle Zeiten')}>
                                  <Clock className="w-3 h-3 text-indigo-500" />
                                  <span className="text-[7.5px] sm:text-[8.5px] font-black tracking-tighter mt-0.5 leading-none">{_t('مخصص', 'Custom', 'Spez.')}</span>
                                </div>
                              </td>
                              {teachers.map(t => {
                                const teacherUnmatched = dayUnmatchedCustoms.filter((s: CustomTimedSession) => s.teacherId === t.id);
                                return (
                                  <td 
                                    key={t.id} 
                                    className="p-0.5 sm:p-1 border-b border-l border-indigo-200/50 dark:border-indigo-800/40 text-center h-full align-middle overflow-hidden"
                                  >
                                    {teacherUnmatched.length > 0 ? (
                                      <div className="flex flex-col gap-1 w-full">
                                        {teacherUnmatched.map((cs: CustomTimedSession) => (
                                          <div
                                            key={cs.id}
                                            onClick={() => handleOpenEditCustomSession(cs)}
                                            className="flex flex-col items-center justify-center bg-indigo-100/90 hover:bg-indigo-200/90 dark:bg-indigo-900/70 dark:hover:bg-indigo-900/90 border border-indigo-300 dark:border-indigo-700/80 rounded-[4px] py-1 px-0.5 sm:px-1 w-full overflow-hidden transition-all cursor-pointer shadow-2xs group/cs"
                                            title={`${t.name}: ${cs.className} (${cs.startTime} - ${cs.endTime}) ${cs.subjectName ? `- ${cs.subjectName}` : ''} - ${_t('انقر للتعديل', 'Click to edit', 'Klicken zum Bearbeiten')}`}
                                          >
                                            <span className="font-black text-indigo-900 dark:text-indigo-200 text-[9px] sm:text-[10.5px] leading-none truncate w-full">{cs.className}</span>
                                            <span className="text-[7px] sm:text-[8.5px] text-indigo-700 dark:text-indigo-300 font-mono font-bold truncate w-full leading-none mt-0.5">
                                              ⏱️ {cs.startTime}-{cs.endTime}
                                            </span>
                                            {cs.subjectName && (
                                              <span className="text-[7px] sm:text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold truncate w-full leading-none mt-0.5 hidden sm:block">
                                                {cs.subjectName}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAddCustomSession({ teacherId: t.id, dayKey })}
                                        className="w-full py-1 text-indigo-300/60 hover:text-indigo-600 dark:text-indigo-700/60 dark:hover:text-indigo-400 text-[10px] font-bold transition-colors cursor-pointer"
                                        title={_t('إضافة حصة بتوقيت مخصص لهذا المعلم', 'Add custom timed session', 'Spezielle Stunde hinzufügen')}
                                      >
                                        +
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-2.5 space-y-2">
                  {!selectedSingleTeacher ? (
                    <div className="text-center py-10 text-[11px] text-text-muted border border-dashed border-surface-border rounded-xl">
                      {_t('يرجى اختيار معلم من القائمة أعلاه لعرض جدوله.', 'Please select a teacher from the dropdown above to view their schedule.', 'Bitte wählen Sie oben einen Lehrer aus, um dessen Stundenplan anzuzeigen.')}
                    </div>
                  ) : (
                    (['0','1','2','3','4'].filter(d => matrixDayFilter === 'all' || d === matrixDayFilter)).map((dayKey) => {
                      const teacherSchedule = selectedSingleTeacher === 'hod' 
                        ? schoolSettings.schedule?.[dayKey] 
                        : schoolSettings.teacherSchedules?.[selectedSingleTeacher]?.[dayKey];
                      
                      const unifiedTimelineItems = getMergedDayScheduleItems(
                        teacherSchedule,
                        schoolSettings.customTimedSessions,
                        dayKey,
                        timings,
                        selectedSingleTeacher
                      );
                      
                      if (unifiedTimelineItems.length === 0) return null;
                      
                      return (
                        <div key={dayKey} className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-2xs">
                          <div className="bg-surface-hover px-2.5 py-1.5 border-b border-surface-border font-black text-text-main text-[11px] flex items-center justify-between">
                            <span>{WEEKDAY_NAMES[dayKey as keyof typeof WEEKDAY_NAMES]}</span>
                            <button
                              type="button"
                              onClick={() => handleOpenAddCustomSession({ teacherId: selectedSingleTeacher, dayKey })}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{_t('إضافة حصة مخصصة', 'Add Custom Session', '+ Spezielle Stunde')}</span>
                            </button>
                          </div>
                          <div className="divide-y divide-surface-border/50">
                            {unifiedTimelineItems.map((item) => {
                              const isCustom = item.isCustomTime || item.type === 'custom_session';
                              
                              return (
                                <div 
                                  key={item.id} 
                                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                    isCustom 
                                      ? 'bg-indigo-50/50 dark:bg-indigo-950/25 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-l-4 border-indigo-500' 
                                      : 'hover:bg-surface-hover/30'
                                  }`}
                                  onClick={() => {
                                    if (isCustom && item.rawCustomSession) {
                                      handleOpenEditCustomSession(item.rawCustomSession);
                                    } else if (item.periodNumber) {
                                      startEditPeriod(selectedSingleTeacher, dayKey, item.periodNumber);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 ${
                                      isCustom 
                                        ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300' 
                                        : 'bg-primary-soft text-primary'
                                    }`}>
                                      {item.periodNumber ? (
                                        <span className="font-black text-[11px]">{_t(`ح${item.periodNumber}`, `P${item.periodNumber}`, `S${item.periodNumber}`)}</span>
                                      ) : (
                                        <Clock className="w-4 h-4" />
                                      )}
                                      <span className="text-[7.5px] font-bold font-mono tracking-tighter leading-none mt-0.5">
                                        {isCustom ? _t('مخصص', 'Custom', 'Spez.') : item.periodNumber}
                                      </span>
                                    </div>
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-text-main text-[12px]">{item.className || _t('حصة بدون فصل', 'No Class Name', 'Ohne Klasse')}</span>
                                        {isCustom && (
                                          <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                            {item.sessionType || _t('توقيت مخصص', 'Custom Time', 'Spezielle Zeit')}
                                          </span>
                                        )}
                                      </div>
                                      <span className={`text-[10px] font-mono font-bold ${isCustom ? 'text-indigo-600 dark:text-indigo-400' : 'text-text-muted'}`}>
                                        ⏱️ {item.startTime} - {item.endTime} {item.room ? `• ${item.room}` : ''}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {item.subjectName && (
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border max-w-[120px] truncate ${
                                        isCustom 
                                          ? 'bg-white dark:bg-surface text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' 
                                          : 'bg-surface-hover text-text-muted border-surface-border text-right'
                                      }`}>
                                        {item.subjectName}
                                      </span>
                                    )}
                                    {isCustom && item.rawCustomSession && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteCustomSession(item.rawCustomSession!.id);
                                        }}
                                        className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                                        title={_t('حذف', 'Delete', 'Löschen')}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* DEDICATED SECTION: Independent & Custom-Timed Sessions */}
          <div className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-text-main flex items-center gap-1.5">
                    <span>{_t('الحصص الخاصة وخارج الجدول المدرسي (بتوقيت مخصص)', 'Custom & Independent Timed Sessions', 'Spezielle & Unabhängige Stunden')}</span>
                    <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-md text-[9px] font-bold">
                      {((schoolSettings.customTimedSessions || []) as CustomTimedSession[]).length}
                    </span>
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {_t('حصص ومجموعات مستقلة بوقت محدد (من كام لكام) واسم الفصل والمادة دون التقيد بأرقام الحصص المدرسية', 'Add custom sessions with exact start/end time, subject, and class independent of standard periods', 'Stunden mit freier Start- und Endzeit')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Teacher Filter */}
                <select
                  value={customSessionTeacherFilter}
                  onChange={(e) => setCustomSessionTeacherFilter(e.target.value)}
                  className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[10px] font-bold text-text-main outline-none"
                >
                  <option value="all">{_t('كل المعلمين', 'All Teachers', 'Alle Lehrer')}</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {/* Day Filter */}
                <select
                  value={customSessionDayFilter}
                  onChange={(e) => setCustomSessionDayFilter(e.target.value)}
                  className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[10px] font-bold text-text-main outline-none"
                >
                  <option value="all">{_t('كل الأيام', 'All Days', 'Alle Tage')}</option>
                  {['0','1','2','3','4','5','6'].map(d => (
                    <option key={d} value={d}>{WEEKDAY_NAMES[d as keyof typeof WEEKDAY_NAMES]}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleOpenAddCustomSession()}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>{_t('إضافة حصة مخصصة', 'New Session', 'Neue Stunde')}</span>
                </button>
              </div>
            </div>

            {/* Custom Sessions Grid / List */}
            {(() => {
              const allCustom = ((schoolSettings.customTimedSessions || []) as CustomTimedSession[]);
              const filtered = allCustom.filter(s => {
                const matchTeacher = customSessionTeacherFilter === 'all' || s.teacherId === customSessionTeacherFilter;
                const matchDay = customSessionDayFilter === 'all' || s.dayKey === customSessionDayFilter;
                return matchTeacher && matchDay;
              });

              if (filtered.length === 0) {
                return (
                  <div className="py-6 text-center border border-dashed border-surface-border rounded-xl space-y-2">
                    <Clock className="w-8 h-8 text-indigo-300 dark:text-indigo-700 mx-auto" />
                    <p className="text-[11px] font-bold text-text-main">
                      {_t('لا توجد حصص مخصصة مسجلة حالياً', 'No custom timed sessions added yet', 'Noch keine speziellen Stunden hinzugefügt')}
                    </p>
                    <p className="text-[10px] text-text-muted max-w-sm mx-auto">
                      {_t('يمكنك إضافة حصص إضافية، مجموعات تقوية، أو فترات تدريب بوقت مخصص حر (مثلاً من 14:30 إلى 16:00)', 'Add remedial classes, extra tutoring, or language clubs with exact start and end times', 'Fügen Sie Förderkurse oder Sprachclubs mit genauen Uhrzeiten hinzu')}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenAddCustomSession()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{_t('إضافة أول حصة مخصصة الآن', 'Add Custom Session Now', 'Jetzt Stunde hinzufügen')}</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filtered.map(session => {
                    const startMin = parseTimeToMinutes(session.startTime);
                    const endMin = parseTimeToMinutes(session.endTime);
                    const durationMin = endMin > startMin ? endMin - startMin : 0;

                    return (
                      <div
                        key={session.id}
                        className="bg-surface-hover/60 border border-surface-border hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl p-2.5 space-y-2 transition-all shadow-2xs group relative"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                                {WEEKDAY_NAMES[session.dayKey as keyof typeof WEEKDAY_NAMES] || session.dayKey}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-surface text-text-muted border border-surface-border text-[10px] font-bold">
                                {session.sessionType || _t('حصة إضافية', 'Extra Session', 'Zusatzstunde')}
                              </span>
                            </div>
                            <h4 className="text-[12px] font-black text-text-main mt-1.5 flex items-center gap-1">
                              <span>{session.className}</span>
                              {session.subjectName && (
                                <span className="text-primary font-bold text-[11px]">({session.subjectName})</span>
                              )}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCustomSession(session)}
                              className="p-1 hover:bg-surface rounded-lg text-text-muted hover:text-primary transition-colors cursor-pointer"
                              title={_t('تعديل', 'Edit', 'Bearbeiten')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomSession(session.id)}
                              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-rose-500 transition-colors cursor-pointer"
                              title={_t('حذف', 'Delete', 'Löschen')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1 border-t border-surface-border/60">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-text-muted flex items-center gap-1">
                              <Users className="w-3 h-3 text-text-muted" />
                              <span>{_t('المعلم:', 'Teacher:', 'Lehrer:')}</span>
                            </span>
                            <span className="font-bold text-text-main">{session.teacherName}</span>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-text-muted flex items-center gap-1">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              <span>{_t('الوقت:', 'Time:', 'Zeit:')}</span>
                            </span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {session.startTime} - {session.endTime} {durationMin > 0 ? `(${durationMin} د)` : ''}
                            </span>
                          </div>

                          {session.room && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-text-muted flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-text-muted" />
                                <span>{_t('المكان / القاعة:', 'Room:', 'Raum:')}</span>
                              </span>
                              <span className="font-bold text-text-main">{session.room}</span>
                            </div>
                          )}

                          {session.notes && (
                            <p className="text-[10px] text-text-muted italic pt-1 truncate" title={session.notes}>
                              📝 {session.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Live Real-time Status Tracker */}
          <div className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center w-4 h-4">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20 animate-ping"></span>
                  <Clock className="w-4 h-4 text-emerald-500 relative" />
                </div>
                <h3 className="text-[11px] font-bold text-text-main">
                  {_t('متابعة حالة المدرسين الآن', 'Live Real-time Status Tracker', 'Live-Status der Lehrer')}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-text-muted bg-surface-hover px-2 py-1 rounded-lg border border-surface-border">
                {new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {teachers.map(t => {
                const statusObj = getTeacherStatus(t.id);
                return (
                  <div key={t.id} className="bg-surface-hover border border-surface-border p-3 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-surface border border-surface-border flex items-center justify-center text-[11px] font-bold text-text-main shrink-0 shadow-sm">
                        {t.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <h4 className="text-[11px] font-bold text-text-main truncate">{t.name}</h4>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {statusObj.status === 'in_class' && (
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {_t('في الحصة', 'In Class', 'Im Unterricht')} ({statusObj.period})
                          </span>
                          <span className="text-[10px] font-bold text-text-main px-1">
                            {statusObj.class} {statusObj.subject ? `(${statusObj.subject})` : ''}
                          </span>
                        </span>
                      )}
                      {statusObj.status === 'free' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-lg border border-amber-500/20">
                          {_t('حصة فراغ', 'Free Period', 'Freistunde')}
                        </span>
                      )}
                      {statusObj.status === 'finished' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-lg border border-slate-500/20">
                          {_t('أنهى حصصه', 'Finished', 'Beendet')}
                        </span>
                      )}
                      {statusObj.status === 'no_class' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-lg border border-slate-500/20">
                          {_t('لا حصص اليوم', 'No Class', 'Kein Unterricht')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Department Schedule */}
          <div className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="text-[11px] font-bold text-text-main">
                {_t('جدول اليوم للقسم كله', 'Today\'s Department Schedule', 'Tagesplan der Abteilung')}
              </h3>
            </div>
            <div className="space-y-3">
              {teachers.map(t => {
                const todayData = getTeacherTodaySchedule(t.id);
                const hasLessons = (todayData.regular && todayData.regular.length > 0) || (todayData.custom && todayData.custom.length > 0);
                if (!hasLessons) return null;
                
                return (
                  <div key={t.id} className="bg-surface-hover border border-surface-border rounded-xl p-3 space-y-2">
                    <h4 className="text-[11px] font-bold text-text-main flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {t.name}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {todayData.regular.map((lesson: any) => (
                        <div key={lesson.periodNumber} className="bg-surface border border-surface-border px-2 py-1.5 rounded-lg flex items-center gap-2 text-[10px] shadow-sm">
                          <span className="font-bold text-primary shrink-0">ح{lesson.periodNumber}</span>
                          <span className="font-bold text-text-main">{lesson.className}</span>
                          {lesson.subjectName && <span className="text-text-muted truncate max-w-[80px]">({lesson.subjectName})</span>}
                        </div>
                      ))}
                      {todayData.custom.map((cs: CustomTimedSession) => (
                        <div key={cs.id} className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] shadow-sm text-indigo-700 dark:text-indigo-300">
                          <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="font-bold">{cs.className}</span>
                          <span className="font-mono text-[9px] bg-white/60 dark:bg-black/30 px-1 rounded">{cs.startTime}-{cs.endTime}</span>
                          {cs.subjectName && <span className="truncate max-w-[80px]">({cs.subjectName})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {teachers.every(t => {
                const data = getTeacherTodaySchedule(t.id);
                return (!data.regular || data.regular.length === 0) && (!data.custom || data.custom.length === 0);
              }) && (
                <div className="text-center py-6 text-[11px] text-text-muted border border-dashed border-surface-border rounded-xl">
                  {_t('لا توجد حصص مسجلة لليوم في جداول المعلمين', 'No sessions assigned for today', 'Heute keine Unterrichtsstunden zugewiesen')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WEEKLY PLAN & SECRETARY TRACKER */}
      {activeTab === 'plans' && (
        <div className="space-y-2 animate-fade-in">
          {/* Header Card with Academic Week Selector */}
          <div className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs space-y-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5">
              <div>
                <h3 className="text-[11px] font-bold text-text-main flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{_t('إعداد ومتابعة خطط الأسبوع (Weekly Plan Generator & Tracker)', 'Weekly Plan Builder & Secretary Tracker', 'Wochenplan-Generator & Sekretariat-Tracker')}</span>
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {_t('تنسيق الخطط الأسبوعية وإرسال رسائل التقدير والتوقيع التلقائي لسكرتيرات المراحل', 'Format weekly plans and generate auto-signed thank you messages for stage secretaries', 'Wochenpläne formatieren und automatische Dankesschreiben senden')}
                </p>
              </div>

              {/* Academic Week Selector */}
              <div className="flex items-center gap-2 bg-surface-hover border border-surface-border p-2 rounded-xl">
                <label className="text-[11px] font-bold text-text-main shrink-0 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('رقم الأسبوع الدراسي (Woche):', 'Academic Week Number:', 'Schulwoche:')}</span>
                </label>
                <select
                  value={selectedPlanWeekNumber}
                  onChange={e => setSelectedPlanWeekNumber(Number(e.target.value))}
                  className="px-2 py-1 bg-surface border border-surface-border rounded-lg text-[11px] font-black text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      {_t(`الأسبوع ${num} (Woche ${num})`, `Week ${num} (Woche ${num})`, `Woche ${num}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Action Bar for Copy/Print All & Clear Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-surface-border text-[11px]">
              <span className="text-text-muted text-[11px] font-medium">
                {_t('إجمالي المراحل الدراسية: 4 مراحل (الصفوف 1 - 12)', 'Total Stages: 4 Stage Bands (Grades 1-12)', 'Stufen: 4 (Klassen 1-12)')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadAllWeeklyPlansCombined}
                  disabled={isDownloadingAllPlans}
                  className="px-2.5 py-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title={_t('تحميل ملف PDF مجمع لكافة المراحل والصفوف الأربعة في ورقة واحدة A4', 'Download master combined table PDF for all stages', 'Gesamttabelle als PDF herunterladen')}
                >
                  {isDownloadingAllPlans ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isDownloadingAllPlans ? _t('جاري التحميل...', 'Downloading...', 'Wird geladen...') : _t('تحميل الجدول المجمع (All Stages PDF)', 'Download Master Table PDF', 'Gesamttabelle PDF herunterladen')}</span>
                </button>

                <button
                  onClick={() => {
                    const allTexts = generateAllWeeklyPlansCombinedMessage(currentWeekPlans, selectedPlanWeekNumber);
                    navigator.clipboard.writeText(allTexts);
                    triggerToast(_t('تم نسخ كافة خطط الصفوف مجمعة بنسق الواتساب 📋', 'Copied all grades weekly plans 📋', 'Alle Klassen-Pläne kopiert 📋'));
                  }}
                  className="px-2 py-1 bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('نسخ كافة الخطط (All Plans)', 'Copy All Plans', 'Alle Pläne kopieren')}</span>
                </button>

                <button
                  onClick={() => handleClearAllPlansForWeek(selectedPlanWeekNumber)}
                  className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  title={_t(`تفريغ كافة بيانات خطط الأسبوع ${selectedPlanWeekNumber}`, `Clear all plans for week ${selectedPlanWeekNumber}`, `Woche ${selectedPlanWeekNumber} leeren`)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{_t(`تفريغ خطط الأسبوع ${selectedPlanWeekNumber}`, `Clear Week ${selectedPlanWeekNumber} Plans`, `Woche ${selectedPlanWeekNumber} leeren`)}</span>
                </button>

                <button
                  onClick={handleClearAllWeeklyPlansEver}
                  className="px-2 py-1 bg-surface hover:bg-surface-hover border border-surface-border text-text-muted hover:text-rose-600 text-[11px] font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  title={_t('تفريغ كافة الخطط لجميع الأسابيع نهائياً', 'Wipe all weekly plans across all weeks', 'Alle Wochenpläne zurücksetzen')}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{_t('تفريغ كافة الأسابيع', 'Wipe All Weeks', 'Alles leeren')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {currentWeekPlans.map(plan => {
              const isSent = plan.status === 'sent';
              const currentWeek = plan.weekNumber || selectedPlanWeekNumber;
              const grades = (plan.gradesContent && plan.gradesContent.length > 0)
                ? sanitizeGradesContent(plan.gradesContent, plan.gradeBand)
                : getEmptyGradesForBand(plan.gradeBand);

              return (
                <div key={plan.id} className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs flex flex-col justify-between space-y-3.5 hover:border-primary/40 transition-all">
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                          {plan.gradeBand}
                        </span>
                        <span className="text-[11px] font-bold text-text-muted">
                          {getArabicGradeBandLabel(plan.gradeBand)}
                        </span>
                      </div>
                      <h4 className="text-[11px] font-bold text-text-main mt-1.5 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-primary" />
                        <span>{_t('السكرتيرة المسؤولة:', 'Secretary:', 'Sekretärin:')} {plan.secretaryName ? `Frau ${cleanSecretaryName(plan.secretaryName)}` : _t('غير محدد', 'Unassigned', 'Nicht zugewiesen')}</span>
                      </h4>
                      {plan.secretaryPhone && (
                        <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5 dir-ltr text-right">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <span>{plan.secretaryPhone}</span>
                        </p>
                      )}
                    </div>

                    {/* Status Badge */}
                    <button
                      onClick={() => handleTogglePlanStatus(plan.id)}
                      title={_t('انقر لتغيير حالة الإرسال', 'Click to toggle sent status', 'Klicken zum Ändern')}
                      className={`px-2 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs ${
                        isSent 
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
                      }`}
                    >
                      {isSent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      <span>{isSent ? `${_t('تم الإرسال', 'Sent', 'Gesendet')} (Woche ${currentWeek})` : _t('لم يُرسل (Pending)', 'Not Sent', 'Ausstehend')}</span>
                    </button>
                  </div>

                  {/* Plan Details Preview Box */}
                  <div className="bg-surface-hover/80 border border-surface-border p-3 rounded-xl space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-[11px] font-bold text-primary pb-1.5 border-b border-surface-border">
                      <span>📋 {_t(`محتوى الخطة الأسبوعية - Woche ${currentWeek}`, `Weekly Plan Content - Woche ${currentWeek}`, `Inhalt - Woche ${currentWeek}`)}</span>
                      <span className="text-text-muted">{grades.length} {_t('صفوف دراسية', 'Grades', 'Klassen')}</span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {grades.map((g: any, gIdx: number) => {
                        const note = g.quiz || g.hinweis;
                        return (
                          <div key={gIdx} className="bg-surface p-2 rounded-lg border border-surface-border/60 text-[11px] space-y-1">
                            <div className="font-bold text-text-main flex items-center justify-between">
                              <span>📚 {getGermanGradeName(g.gradeName, plan.gradeBand, gIdx)}</span>
                              <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                                Woche {currentWeek}
                              </span>
                            </div>
                            <p className="text-text-muted truncate text-[10px]">
                              • S.1: {g.s1 || '—'} | S.2: {g.s2 || '—'}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-0.5 border-t border-surface-border/40">
                              <span className="text-text-muted font-medium">H.A: {g.ha || '—'}</span>
                              {note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' && (
                                <span className="text-purple-700 font-bold bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                                  Quiz/Note: {note}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="pt-2 border-t border-surface-border space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      <button
                        onClick={() => {
                          const resolvedSec = getSecretaryForGradeBand(plan.gradeBand, schoolSettings, plan.secretaryName, plan.secretaryPhone);
                          setEditingPlanRecord({
                            ...plan,
                            secretaryName: plan.secretaryName || resolvedSec.name,
                            secretaryPhone: plan.secretaryPhone || resolvedSec.phone
                          });
                        }}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                        title={_t('تعديل الدروس والإنجازات', 'Edit plan details', 'Bearbeiten')}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-primary" />
                        <span>{_t('تعديل', 'Edit', 'Bearbeiten')}</span>
                      </button>

                      <button
                        onClick={() => handleCopyFormattedPlanText(plan)}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                        title={_t('نسخ نص الواتساب المنسق مع الشكر والتوقيع', 'Copy formatted WhatsApp text', 'Text kopieren')}
                      >
                        <Copy className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{_t('نسخ', 'Copy', 'Kopieren')}</span>
                      </button>

                      <button
                        onClick={() => handleSharePlanWhatsApp(plan)}
                        className="px-2.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                        title={_t('مشاركة مباشرة عبر واتساب', 'Share directly via WhatsApp', 'Via WhatsApp senden')}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{_t('واتساب', 'WhatsApp', 'WhatsApp')}</span>
                      </button>

                      <button
                        onClick={() => handleDownloadWeeklyPlan(plan)}
                        disabled={downloadingPlanId === plan.id}
                        className="px-2.5 py-2 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-50 text-sky-700 dark:text-sky-400 border border-sky-500/30 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                        title={_t('تحميل الخطة كمستند PDF رسمي ومنسق مع رسالة التقدير والتوقيع', 'Download official weekly plan PDF with appreciation and signature', 'Als PDF herunterladen')}
                      >
                        {downloadingPlanId === plan.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-sky-600" />
                        )}
                        <span>{downloadingPlanId === plan.id ? _t('تحميل...', 'Loading...', 'Laden...') : _t('تحميل PDF', 'Download PDF', 'PDF laden')}</span>
                      </button>

                      <button
                        onClick={() => handleClearSinglePlan(plan)}
                        className="px-2.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 col-span-2 sm:col-span-1"
                        title={_t('تفريغ بيانات هذه الخطة بالكامل', 'Clear this plan content', 'Plan leeren')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>{_t('تفريغ', 'Clear', 'Leeren')}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted px-1 pt-1">
                      <span>
                        {plan.sentAt ? `${_t('تاريخ آخر إرسال:', 'Last sent:', 'Zuletzt gesendet:')} ${plan.sentAt}` : _t('لم يتم التوثيق بعد', 'Not sent yet', 'Noch nicht gesendet')}
                      </span>
                      <button
                        onClick={() => handleTogglePlanStatus(plan.id)}
                        className="text-primary hover:underline font-bold cursor-pointer"
                      >
                        {isSent ? _t('إلغاء التوثيق', 'Mark Unsent', 'Als ausstehend') : _t('زر تم الإرسال بالفعل 🟢', 'Mark as Sent 🟢', 'Als gesendet')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* TAB 5: STAFF MANAGEMENT */}
      {activeTab === 'staff' && (() => {
        const staffGroups: Record<string, any[]> = {};
        teachers.filter(t => (t.name || '').toLowerCase().includes((teacherSearch || '').toLowerCase())).forEach(teacher => {
          const workload = getWorkload(teacher.id);
          const managerName = teacher.isHod ? _t('رئيس القسم', 'Head of Department', 'Fachleitung') : (workload.matchedManager?.name || _t('غير محدد', 'Unassigned', 'Nicht zugewiesen'));
          if (!staffGroups[managerName]) staffGroups[managerName] = [];
          staffGroups[managerName].push({ ...teacher, workload });
        });

        return (
          <div className="space-y-2 animate-fade-in">
            <div className="bg-surface border border-surface-border rounded-xl shadow-2xs overflow-hidden">
              <div className="p-2.5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder={_t('ابحث عن معلم...', 'Search teacher...', 'Lehrer suchen...')}
                    value={teacherSearch}
                    onChange={e => setTeacherSearch(e.target.value)}
                    className="w-full px-2 py-1.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
                  <button
                    onClick={() => {
                      setSelectedTeacherForAttendance(null);
                      setEditingAttendanceRecord(null);
                      setIsAttendanceModalOpen(true);
                    }}
                    className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{_t('تسجيل حضور / غياب', 'Attendance', 'Anwesenheit')}</span>
                  </button>
                  <button
                    onClick={() => setIsDetailedAttendanceModalOpen(true)}
                    className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-[10.5px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span className="truncate">{_t('تقرير الانضباط', 'Discipline Report', 'Disziplin')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setBulkExportTeacherId(undefined);
                      setIsBulkVisitExportModalOpen(true);
                    }}
                    className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-[10.5px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                    title={_t('تصدير وطباعة تقارير الزيارات مجمعة', 'Bulk Observation Reports Export & Print', 'Sammeldruck von Unterrichtsbesuchen')}
                  >
                    <Download className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span className="truncate">{_t('تصدير الزيارات مجمعة', 'Bulk Visits Export', 'Sammeldruck')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setObsInitialTeacherId(undefined);
                      setIsVisitModalOpen(true);
                    }}
                    className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{_t('إضافة زيارة', 'Add Visit', 'Besuch hinzufügen')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingTeacher(null);
                      setTeacherName('');
                      setTeacherPhone('');
                      setIsTeacherModalOpen(true);
                    }}
                    className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-primary hover:bg-primary-hover text-white text-[10.5px] sm:text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{_t('معلم جديد', 'Add Teacher', 'Lehrer hinzufügen')}</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-surface-border">
                {Object.entries(staffGroups).map(([groupName, groupTeachers]) => (
                  <div key={groupName} className="group-container">
                    <div className="bg-surface-hover/80 px-2.5 py-1 border-b border-surface-border/50 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-[11px] font-black text-text-muted uppercase tracking-wider">{groupName}</span>
                    </div>
                    
                    {groupTeachers.map((teacher: any) => (
                      <div 
                        key={teacher.id} 
                        onClick={() => setSelectedTeacherDetails(teacher)}
                        className="p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        {/* Left/Start: Avatar + Info */}
                        <div className="flex items-center gap-1.5 md:w-1/3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-[11px] shrink-0">
                            {teacher.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-[11px] font-bold truncate ${teacher.isActive ? 'text-text-main' : 'text-text-muted line-through'}`}>
                                {teacher.name}
                              </h4>
                              {teacher.isHod && (
                                <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded shrink-0">
                                  {_t('رئيس القسم', 'HOD', 'Fachleiter')}
                                </span>
                              )}
                            </div>
                            <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-black rounded-lg ${
                              teacher.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'
                            }`}>
                              {teacher.isActive ? _t('نشط', 'Active', 'Aktiv') : _t('غير نشط', 'Inactive', 'Inaktiv')}
                            </span>
                          </div>
                        </div>

                        {/* Middle: Compact Stats & Coverage */}
                        <div className="flex-1 flex flex-col md:flex-row items-start md:items-center gap-2.5 text-[11px] justify-start md:justify-center">
                          {(() => {
                            const teacherCustoms = (schoolSettings.customTimedSessions || [] as CustomTimedSession[]).filter(
                              (cs: CustomTimedSession) => cs.teacherId === teacher.id
                            );

                            return (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {teacher.workload.totalSessions > 0 ? (
                                  <>
                                    <div className="flex items-center gap-1.5 shrink-0 bg-surface border border-surface-border px-2 py-1 rounded-lg">
                                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                                      <span className="font-bold text-text-main">
                                        {teacher.workload.totalSessions} {_t('حصة', 'sessions', 'Std.')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 bg-surface border border-surface-border px-2 py-1 rounded-lg">
                                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                                      <span className="font-bold text-text-main">
                                        {teacher.workload.assignedClasses.length} {_t('فصول', 'classes', 'Klassen')}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-text-muted font-bold">
                                    {_t('لا توجد حصص', 'No sessions', 'Keine Std.')}
                                  </span>
                                )}

                                {teacherCustoms.length > 0 && (
                                  <div className="flex items-center gap-1 shrink-0 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg">
                                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                    <span className="font-bold">
                                      {teacherCustoms.length} {_t('مخصصة', 'custom', 'Spez.')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* Visit Coverage Progress Bar */}
                          {!teacher.isHod && teacher.workload.assignedClasses.length > 0 && (() => {
                            const teacherVisits = visitRecords.filter(v => v.teacherId === teacher.id && v.term === (schoolSettings.currentTerm || 'Term 1'));
                            const uniqueClassesVisited = new Set(teacherVisits.map(v => v.className).filter(c => c && c !== 'Manual Entry')).size;
                            const totalAssignedClasses = teacher.workload.assignedClasses.length;
                            const progress = Math.min((uniqueClassesVisited / totalAssignedClasses) * 100, 100);
                            return (
                              <div className="flex flex-col gap-1 w-full md:w-32">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-text-muted">{_t('تغطية الزيارات', 'Visit Coverage', 'Abdeckung')}</span>
                                  <span className="font-black text-primary">{uniqueClassesVisited} / {totalAssignedClasses}</span>
                                </div>
                                <div className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${progress}%` }}></div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Right/End: Actions */}
                        <div className="flex items-center gap-1 md:w-auto shrink-0 justify-end mt-2 md:mt-0 pt-3 md:pt-0 border-t border-surface-border md:border-t-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedTeacherForAttendance(teacher);
                              setEditingAttendanceRecord(null);
                              setIsAttendanceModalOpen(true);
                            }}
                            className="p-2 sm:p-1.5 text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title={_t('تسجيل حضور / غياب للمعلم', 'Log Teacher Attendance', 'Anwesenheit erfassen')}
                          >
                            <Clock className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingTeacher(teacher);
                              setTeacherName(teacher.name);
                              setTeacherPhone(teacher.phone || '');
                              setIsTeacherModalOpen(true);
                            }}
                            className="p-2 sm:p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-main rounded-lg transition-colors cursor-pointer"
                            title={_t('تعديل', 'Edit', 'Bearbeiten')}
                          >
                            <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </button>
                          
                          {!teacher.isHod && (
                            <>
                              <button
                                onClick={() => handleToggleTeacherStatus(teacher.id)}
                                className="p-2 sm:p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-main rounded-lg transition-colors cursor-pointer"
                                title={_t('تفعيل/إيقاف', 'Toggle Status', 'Status umschalten')}
                              >
                                <RefreshCw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => handleDeleteTeacher(teacher.id)}
                                className="p-2 sm:p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title={_t('حذف', 'Delete', 'Löschen')}
                              >
                                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Teacher Detail Drawer Modal */}
      {selectedTeacherDetails && (() => {
        const t = selectedTeacherDetails;
        const workload = t.workload || getWorkload(t.id);
        const secName = (schoolSettings.stageSecretaries || []).find((s: any) => s.stageManagerId === workload.matchedManager?.id)?.name || _t('غير محدد', 'Unassigned', 'Nicht zugewiesen');
        const teacherComplaints = parentComplaints.filter(c => c.teacherId === t.id);
        const teacherVisits = visitRecords.filter(v => v.teacherName === t.name);

        return (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-2.5 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedTeacherDetails(null)}>
            <div 
              className="bg-surface w-full sm:max-w-xl rounded-t-3xl sm:rounded-xl shadow-xl overflow-hidden border border-surface-border max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface-hover/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center font-black text-lg shadow-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-text-main flex items-center gap-2">
                      {t.name}
                      {t.isHod && (
                        <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded shrink-0">
                          {_t('رئيس القسم', 'HOD', 'Fachleiter')}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-text-muted font-bold mt-0.5">{_t('مدير المرحلة:', 'Stage Manager:', 'Stufenleiter:')} {workload.matchedManager?.name || _t('رئيس القسم', 'Head of Department', 'Fachleitung')}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTeacherDetails(null)} className="p-2 hover:bg-surface-hover rounded-xl text-text-muted cursor-pointer transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-3 overflow-y-auto space-y-3">
                {/* Contact Actions */}
                {t.phone && (
                  <div className="flex gap-2">
                    <a href={`tel:${t.phone}`} className="flex-1 py-2.5 bg-surface-hover hover:bg-surface-border/50 border border-surface-border rounded-xl text-[11px] font-bold text-text-main transition-colors flex items-center justify-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      <span>{t.phone}</span>
                    </a>
                    <a href={`https://wa.me/${t.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('السكرتيرة', 'Secretary', 'Sekretärin')}</span>
                    <p className="text-[11px] font-black text-text-main truncate">{secName}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('الحصص الأسبوعية', 'Weekly Sessions', 'Wochenstunden')}</span>
                    <p className="text-[11px] font-black text-text-main truncate">{workload.totalSessions} {_t('حصة', 'sessions', 'Std.')}</p>
                  </div>
                </div>

                {/* Classes */}
                {workload.assignedClasses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{_t('الفصول المسندة', 'Assigned Classes', 'Zugewiesene Klassen')}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {workload.assignedClasses.map((cls: string) => (
                        <span key={cls} className="px-2 py-1 bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold rounded-lg">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Timed Sessions for this teacher */}
                {(() => {
                  const teacherCustoms = (schoolSettings.customTimedSessions || [] as CustomTimedSession[]).filter(
                    (cs: CustomTimedSession) => cs.teacherId === t.id
                  );
                  if (teacherCustoms.length === 0) return null;

                  return (
                    <div className="space-y-2 p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-black text-[11px]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{_t('حصص بتوقيت مخصص', 'Custom Timed Sessions', 'Spezielle Stunden')} ({teacherCustoms.length})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTeacherDetails(null);
                            handleOpenAddCustomSession({ teacherId: t.id });
                          }}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{_t('إضافة حصة', 'Add', 'Neu')}</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {teacherCustoms.map((cs: CustomTimedSession) => (
                          <div 
                            key={cs.id}
                            onClick={() => {
                              setSelectedTeacherDetails(null);
                              handleOpenEditCustomSession(cs);
                            }}
                            className="p-2 rounded-lg bg-surface border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-between text-[11px] cursor-pointer hover:border-indigo-400 transition-all shadow-2xs"
                          >
                            <div>
                              <div className="font-bold text-text-main flex items-center gap-1.5">
                                <span>{cs.className}</span>
                                <span className="text-[9px] px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded font-semibold">
                                  {WEEKDAY_NAMES[cs.dayKey as keyof typeof WEEKDAY_NAMES]?.split(' ')[0] || cs.dayKey}
                                </span>
                              </div>
                              {cs.subjectName && (
                                <div className="text-[10px] text-text-muted">{cs.subjectName}</div>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                              {cs.startTime} - {cs.endTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Teacher Attendance Summary Card (Requirement 2) */}
                {(() => {
                  const teacherRecords = (schoolSettings.staffAttendanceRecords || []).filter(
                    (r: any) => !r.deleted && (r.teacherId === t.id || r.teacherName === t.name)
                  );
                  const absences = teacherRecords.filter((r: any) => r.type === 'absence' || r.type === 'ABSENCE').length;
                  const lateArrivals = teacherRecords.filter((r: any) => r.type === 'late_arrival' || r.type === 'LATE_ARRIVAL').length;
                  const earlyLeaves = teacherRecords.filter((r: any) => r.type === 'early_leave' || r.type === 'EARLY_LEAVE').length;
                  const delayMinutes = teacherRecords
                    .filter((r: any) => r.type === 'late_arrival' || r.type === 'LATE_ARRIVAL')
                    .reduce((sum: number, r: any) => sum + (r.delayMinutes || 0), 0);

                  let score = 100;
                  teacherRecords.forEach((r: any) => {
                    const isAbsence = r.type === 'absence' || r.type === 'ABSENCE';
                    const isLate = r.type === 'late_arrival' || r.type === 'LATE_ARRIVAL';
                    const isEarly = r.type === 'early_leave' || r.type === 'EARLY_LEAVE';
                    const isUnexcused = r.absenceStatus === 'unexcused' || r.absenceReasonType === 'UNEXCUSED';
                    const isLesson = r.absenceScope === 'lesson_based' || r.absenceScope === 'LESSON_BASED';

                    if (isAbsence) {
                      if (isUnexcused) score -= (isLesson ? 10 : 20);
                      else score -= (isLesson ? 3 : 7);
                    } else if (isLate) {
                      const mins = r.delayMinutes || 0;
                      if (mins > 30) score -= 10;
                      else if (mins > 15) score -= 5;
                      else if (mins > 0) score -= 2;
                    } else if (isEarly) {
                      const lost = r.lostMinutes || 0;
                      if (lost > 30) score -= 10;
                      else if (lost > 0) score -= 5;
                    }
                  });
                  score = Math.max(0, Math.min(100, Math.round(score)));

                  return (
                    <div className="p-3 rounded-xl bg-surface-hover/80 border border-surface-border space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[11px] font-black text-text-main">
                              {_t('ملخص الحضور والانضباط (Attendance Summary)', 'Attendance Summary', 'Anwesenheitsübersicht')}
                            </h4>
                            <span className="text-[10px] text-text-muted">
                              {teacherRecords.length} {_t('وقائع مسجلة', 'events recorded', 'Vorfälle erfasst')}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTeacherForAttendance(t);
                            setEditingAttendanceRecord(null);
                            setIsAttendanceModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{_t('تسجيل حدث جديد', 'Log Event', 'Erfassen')}</span>
                        </button>
                      </div>

                      {/* 5 Stats Grid */}
                      <div className="grid grid-cols-5 gap-1.5 text-center">
                        <div className="p-2 rounded-lg bg-surface border border-surface-border">
                          <span className="text-[9.5px] font-bold text-rose-600 block truncate">
                            {_t('الغياب', 'Absences', 'Fehltage')}
                          </span>
                          <span className="text-sm font-black text-text-main">{absences}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-surface-border">
                          <span className="text-[9.5px] font-bold text-amber-600 block truncate">
                            {_t('التأخير', 'Late', 'Verspätet')}
                          </span>
                          <span className="text-sm font-black text-text-main">{lateArrivals}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-surface-border">
                          <span className="text-[9.5px] font-bold text-orange-600 block truncate">
                            {_t('الانصراف', 'Early', 'Früh')}
                          </span>
                          <span className="text-sm font-black text-text-main">{earlyLeaves}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-surface-border">
                          <span className="text-[9.5px] font-bold text-blue-600 block truncate">
                            {_t('دقائق تأخير', 'Delay Min', 'Minuten')}
                          </span>
                          <span className="text-sm font-black text-text-main">{delayMinutes}m</span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface border border-surface-border">
                          <span className="text-[9.5px] font-bold text-emerald-600 block truncate">
                            {_t('الانضباط', 'Discipline', 'Score')}
                          </span>
                          <span className={`text-sm font-black ${score >= 90 ? 'text-emerald-600' : score >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {score}%
                          </span>
                        </div>
                      </div>

                      {/* Recent Attendance Events list for this teacher */}
                      {teacherRecords.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-surface-border/60">
                          <span className="text-[10px] font-bold text-text-muted">
                            {_t('سجل الوقائع الأخيرة للمعلم:', 'Recent Incidents for Teacher:', 'Letzte Vorfälle:')}
                          </span>
                          <div className="max-h-28 overflow-y-auto space-y-1">
                            {teacherRecords.slice(0, 4).map((rec: any) => (
                              <div key={rec.id} className="p-1.5 rounded-lg bg-surface border border-surface-border flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                                    (rec.type === 'absence' || rec.type === 'ABSENCE') ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                    (rec.type === 'late_arrival' || rec.type === 'LATE_ARRIVAL') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    'bg-orange-50 text-orange-700 border border-orange-200'
                                  }`}>
                                    {(rec.type === 'absence' || rec.type === 'ABSENCE') ? _t('غياب', 'Absence', 'Abwesend') :
                                     (rec.type === 'late_arrival' || rec.type === 'LATE_ARRIVAL') ? _t('تأخير', 'Late', 'Verspätet') :
                                     _t('انصراف مبكر', 'Early Leave', 'Früh')}
                                  </span>
                                  <span className="font-bold text-text-main">{rec.date}</span>
                                  {rec.delayMinutes ? <span className="text-amber-600 font-bold">({rec.delayMinutes} د)</span> : null}
                                  {rec.lostMinutes ? <span className="text-orange-600 font-bold">({rec.lostMinutes} د)</span> : null}
                                </div>
                                <span className="text-text-muted truncate max-w-[160px]">
                                  {rec.reason || (rec.absenceStatus === 'unexcused' || rec.absenceReasonType === 'UNEXCUSED' ? 'بدون عذر' : 'بعذر')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Complaints History */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{_t('سجل الشكاوى المتبادل لهذا المعلم', 'Teacher Complaints History', 'Beschwerde-Verlauf')}</h4>
                  <div className="border border-surface-border rounded-xl p-2 bg-surface">
                    <ComplaintsSystemView embeddedTeacherId={t.id} />
                  </div>
                </div>

                {/* Dynamic Visit Progress Counter (نسبة التغطية الذكية) */}
                {(() => {
                  const assignedClasses = workload.assignedClasses || [];
                  const teacherVisitsList = visitRecords.filter(v => (v.teacherId === t.id || v.teacherName === t.name) && (v.term === (schoolSettings.currentTerm || 'Term 1') || !v.term));
                  const visitedClassesSet = new Set(teacherVisitsList.map(v => v.className).filter(Boolean));
                  const visitedClasses = Array.from(visitedClassesSet);
                  const totalAssigned = assignedClasses.length > 0 ? assignedClasses.length : Math.max(1, visitedClasses.length);
                  const totalVisited = visitedClasses.length;
                  const progress = Math.min(100, Math.round((totalVisited / totalAssigned) * 100));

                  return (
                    <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          <span className="text-[11px] font-black text-text-main">
                            {_t('نسبة التغطية الذكية', 'Smart Visit Coverage', 'Smart Besuchsabdeckung')}
                          </span>
                        </div>
                        <span className="text-[11px] font-black text-primary px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
                          {totalVisited} / {totalAssigned} {_t('فصول تم زيارتها', 'Classes Visited', 'Klassen besucht')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-text-muted">
                          <span>{_t('مستوى التغطية الصفية', 'Classroom Coverage Level', 'Abdeckungsgrad')}</span>
                          <span className="font-black text-primary">{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              progress === 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-primary' : 'bg-amber-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {assignedClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {assignedClasses.map((cls: string) => {
                            const isVisited = visitedClasses.includes(cls);
                            return (
                              <span
                                key={cls}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border transition-all ${
                                  isVisited 
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                    : 'bg-surface text-text-muted border-surface-border'
                                }`}
                              >
                                {isVisited ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-text-muted" />}
                                <span>{cls}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Embedded Observation Log (سجل الزيارات داخل كارت المدرس) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <h4 className="text-[11px] font-bold text-text-main uppercase tracking-wider">
                        {_t('سجل الزيارات الصفية', 'Classroom Visits History', 'Besuchsverlauf')}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setBulkExportTeacherId(t.id);
                          setIsBulkVisitExportModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-[11px] font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        title={_t('تصدير وطباعة تقارير الزيارات مجمعة', 'Bulk Observation Reports Export & Print', 'Sammeldruck')}
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{_t('تصدير / طباعة مجمعة', 'Bulk Export / Print', 'Sammeldruck')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setObsInitialTeacherId(t.id);
                          setIsVisitModalOpen(true);
                        }}
                        className="px-2 py-1 bg-primary text-white hover:bg-primary-hover text-[11px] font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{_t('تسجيل زيارة', 'Add Observation', 'Beobachtung hinzufügen')}</span>
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const teacherVisitsList = visitRecords.filter(v => (v.teacherId === t.id || v.teacherName === t.name));
                    if (teacherVisitsList.length === 0) {
                      return (
                        <div className="text-[11px] text-text-muted bg-surface-hover p-2.5 rounded-xl border border-surface-border flex flex-col items-center justify-center text-center gap-1">
                          <ClipboardList className="w-8 h-8 text-text-muted/40 mb-1" />
                          <p className="font-bold">{_t('لا توجد زيارات مسجلة لهذا المعلم', 'No observation logs recorded for this teacher', 'Keine Besuche erfasst')}</p>
                          <p className="text-[10px] text-text-muted">{_t('اضغط على "تسجيل زيارة" لإضافة تقرير جديد', 'Click "Add Observation" to log a new report', 'Klicken Sie auf "Beobachtung hinzufügen"')}</p>
                        </div>
                      );
                    }

                    const selectedTeacherVisits = teacherVisitsList.filter(v => selectedTeacherVisitIds.has(v.id));
                    const isAllSelected = teacherVisitsList.length > 0 && selectedTeacherVisits.length === teacherVisitsList.length;

                    const toggleSelectAllForTeacher = () => {
                      if (isAllSelected) {
                        setSelectedTeacherVisitIds(prev => {
                          const next = new Set(prev);
                          teacherVisitsList.forEach(v => next.delete(v.id));
                          return next;
                        });
                      } else {
                        setSelectedTeacherVisitIds(prev => {
                          const next = new Set(prev);
                          teacherVisitsList.forEach(v => next.add(v.id));
                          return next;
                        });
                      }
                    };

                    const toggleSelectVisit = (visitId: string) => {
                      setSelectedTeacherVisitIds(prev => {
                        const next = new Set(prev);
                        if (next.has(visitId)) {
                          next.delete(visitId);
                        } else {
                          next.add(visitId);
                        }
                        return next;
                      });
                    };

                    return (
                      <div className="space-y-2">
                        {/* Quick Selection Toolbar */}
                        <div className="flex items-center justify-between bg-surface-hover/80 px-2.5 py-1.5 rounded-xl border border-surface-border flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={toggleSelectAllForTeacher}
                            className="flex items-center gap-1.5 text-xs font-bold text-text-main hover:text-primary transition-colors cursor-pointer"
                          >
                            {isAllSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-text-muted" />
                            )}
                            <span>
                              {isAllSelected
                                ? _t('إلغاء تحديد الكل', 'Deselect All', 'Alle abwählen')
                                : _t('تحديد الكل', 'Select All', 'Alle auswählen')}
                            </span>
                          </button>

                          {selectedTeacherVisits.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-text-muted">
                                {_t('تم تحديد', 'Selected', 'Ausgewählt')}{' '}
                                <strong className="text-primary font-black">{selectedTeacherVisits.length}</strong>{' '}
                                {_t('من', 'of', 'von')} {teacherVisitsList.length}
                              </span>

                              <button
                                onClick={() => handleBatchPrintVisits(selectedTeacherVisits)}
                                className="h-7 px-2 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:border-indigo-800 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                title={_t('طباعة التقارير المحددة', 'Print Selected', 'Ausgewählte drucken')}
                              >
                                <Printer className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>{_t('طباعة مجمعة', 'Bulk Print', 'Sammeldruck')}</span>
                              </button>

                              <button
                                onClick={() => handleBatchDownloadVisitsPdf(selectedTeacherVisits)}
                                disabled={isBatchGeneratingPdf}
                                className="h-7 px-2.5 text-[10px] font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                                title={_t('تحميل التقارير المحددة في ملف PDF واحد', 'Download Selected as single combined PDF', 'Als kombiniertes PDF herunterladen')}
                              >
                                {isBatchGeneratingPdf ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                <span>
                                  {isBatchGeneratingPdf
                                    ? _t('جاري التحميل...', 'Downloading...', 'Wird geladen...')
                                    : _t(`تحميل PDF مجمّع (${selectedTeacherVisits.length})`, `Download PDF (${selectedTeacherVisits.length})`, `PDF (${selectedTeacherVisits.length})`)}
                                </span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedTeacherVisitIds(prev => {
                                    const next = new Set(prev);
                                    teacherVisitsList.forEach(v => next.delete(v.id));
                                    return next;
                                  });
                                }}
                                className="h-7 px-2 text-[10px] font-bold text-text-muted hover:text-text-main rounded-lg transition-all cursor-pointer"
                              >
                                {_t('إلغاء', 'Clear', 'Abbrechen')}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-text-muted">
                              {_t('حدد التقارير للتحميل في ملف PDF واحد', 'Select reports to download as single PDF', 'Wählen Sie Berichte für ein PDF')}
                            </span>
                          )}
                        </div>

                        {/* Progress Bar for Batch Generation */}
                        {isBatchGeneratingPdf && batchProgress && (
                          <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between text-[11px] text-primary font-bold">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>
                                {_t(
                                  `جاري إعداد الصفحة ${batchProgress.current} من ${batchProgress.total}...`,
                                  `Preparing page ${batchProgress.current} of ${batchProgress.total}...`,
                                  `Seite ${batchProgress.current} von ${batchProgress.total} wird vorbereitet...`
                                )}
                              </span>
                            </div>
                            <span className="font-mono">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                          </div>
                        )}

                        {teacherVisitsList.map(v => {
                          const isSelected = selectedTeacherVisitIds.has(v.id);
                          return (
                            <div
                              key={v.id}
                              className={`p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 transition-all ${
                                isSelected
                                  ? 'bg-primary/5 border-primary/40 shadow-2xs'
                                  : 'bg-surface-hover border-surface-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => toggleSelectVisit(v.id)}
                                  className="text-primary hover:scale-110 transition-transform cursor-pointer p-0.5 shrink-0"
                                  title={isSelected ? _t('إلغاء التحديد', 'Deselect', 'Abwählen') : _t('تحديد', 'Select', 'Auswählen')}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Square className="w-4 h-4 text-text-muted hover:text-text-main" />
                                  )}
                                </button>

                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="text-[11px] font-bold text-text-main truncate">{_t('الفصل:', 'Class:', 'Klasse:')} {v.className}</h5>
                                    <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-md border border-primary/20 bg-primary/5 text-primary">
                                      {v.overallScore || '-'}/75
                                    </span>
                                    {v.overallCategory && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface border border-surface-border text-text-muted">
                                        {v.overallCategory}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-text-muted flex items-center gap-1.5 flex-wrap">
                                    <span>{new Date(v.visitedDate || v.date || Date.now()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    <span>•</span>
                                    <span>{_t('الحصة', 'Period', 'Stunde')} {v.periodNumber || '-'}</span>
                                  </div>
                                  {v.consolidatedNotes && (
                                    <div className="text-[9.5px] text-text-muted truncate max-w-full italic flex items-center gap-1 opacity-80">
                                      <FileText className="w-2.5 h-2.5 shrink-0 text-text-muted/60" />
                                      <span className="truncate">{v.consolidatedNotes}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-end sm:self-auto flex-wrap pt-1 sm:pt-0">
                                <button
                                  onClick={() => setPreviewVisitRecord(v)}
                                  className="h-7 sm:h-8 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 rounded-lg transition-all duration-150 active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                  title={_t('معاينة التقرير', 'Preview Report', 'Bericht anzeigen')}
                                >
                                  <Eye className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                                  <span>{_t('معاينة', 'Preview', 'Vorschau')}</span>
                                </button>
                                <button
                                  onClick={() => handleShareWhatsApp(v)}
                                  disabled={!!activeLoadingAction}
                                  className="h-7 sm:h-8 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:border-emerald-800 rounded-lg transition-all duration-150 active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-2xs disabled:opacity-60 disabled:pointer-events-none"
                                  title={_t('مشاركة عبر واتساب', 'Share via WhatsApp', 'Über WhatsApp teilen')}
                                >
                                  {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'share' ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <MessageCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  )}
                                  <span>
                                    {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'share'
                                      ? _t('جاري...', 'Sharing...', 'Wird geteilt...')
                                      : _t('واتساب', 'WhatsApp', 'WhatsApp')}
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleDownloadPdf(v)}
                                  disabled={!!activeLoadingAction}
                                  className="h-7 sm:h-8 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 dark:text-sky-300 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 dark:border-sky-800 rounded-lg transition-all duration-150 active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-2xs disabled:opacity-60 disabled:pointer-events-none"
                                  title={_t('تحميل ملف PDF', 'Download PDF File', 'PDF herunterladen')}
                                >
                                  {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'download' ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-sky-600 dark:text-sky-400" />
                                  ) : (
                                    <Download className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                  )}
                                  <span>
                                    {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'download'
                                      ? _t('جاري...', 'Generating...', 'Wird geladen...')
                                      : _t('PDF', 'PDF', 'PDF')}
                                  </span>
                                </button>
                                <button
                                  onClick={() => printObservationReport(v, schoolSettings, (language === 'ar'), language)}
                                  className="h-7 sm:h-8 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:border-indigo-800 rounded-lg transition-all duration-150 active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                  title={_t('طباعة التقرير', 'Print Report', 'Drucken')}
                                >
                                  <Printer className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                  <span>{_t('طباعة', 'Print', 'Drucken')}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Teacher Notes & School Session Notes Section (ملاحظات الحصص والفصول المدرسية للمعلم) */}
                <div className="space-y-3 pt-2 border-t border-surface-border" id="teacher-school-notes-section">
                  {(() => {
                    // 1. Gather all classes linked to this teacher
                    const assignedClasses = workload.assignedClasses || [];
                    const teacherClassesSet = new Set<string>(assignedClasses.map((c: string) => c.trim()));
                    
                    // Also include classes from teacher's timetable
                    const tSched = schoolSettings.teacherSchedules?.[t.id] || (t.isHod ? schoolSettings.schedule : {});
                    if (tSched) {
                      Object.values(tSched).forEach((dayPeriods: any) => {
                        if (Array.isArray(dayPeriods)) {
                          dayPeriods.forEach(p => {
                            if (p.className) teacherClassesSet.add(p.className.trim());
                          });
                        }
                      });
                    }
                    // Also include custom timed sessions
                    const tCustoms = (schoolSettings.customTimedSessions || [] as CustomTimedSession[]).filter(
                      (cs: CustomTimedSession) => cs.teacherId === t.id
                    );
                    tCustoms.forEach((cs: CustomTimedSession) => {
                      if (cs.className) teacherClassesSet.add(cs.className.trim());
                    });

                    const teacherClassesList = Array.from(teacherClassesSet).filter(Boolean);

                    // 2. Filter notes belonging to this teacher, their classes, or students
                    const allTeacherNotes = (schoolNotes || []).filter(n => {
                      if (n.deleted) return false;
                      if (n.teacherId && n.teacherId === t.id) return true;
                      if (n.teacherName && n.teacherName.trim().toLowerCase() === t.name.trim().toLowerCase()) return true;
                      if (n.className && teacherClassesList.some(c => c.toLowerCase() === n.className!.trim().toLowerCase())) return true;
                      return false;
                    });

                    // Sub-counts
                    const pinnedNotesCount = allTeacherNotes.filter(n => n.pinned).length;
                    const lessonNotesCount = allTeacherNotes.filter(n => n.type === 'lesson').length;
                    const classNotesCount = allTeacherNotes.filter(n => n.type === 'class').length;
                    const studentNotesCount = allTeacherNotes.filter(n => n.type === 'student').length;

                    // Filtered by Search & Filter Tabs
                    const filteredNotes = allTeacherNotes.filter(n => {
                      // Type Filter
                      if (teacherNotesFilterType === 'pinned' && !n.pinned) return false;
                      if (teacherNotesFilterType !== 'all' && teacherNotesFilterType !== 'pinned' && n.type !== teacherNotesFilterType) return false;
                      // Class Filter
                      if (teacherNotesClassFilter !== 'all' && n.className?.trim().toLowerCase() !== teacherNotesClassFilter.trim().toLowerCase()) return false;
                      // Search
                      if (teacherNotesSearch.trim()) {
                        const q = teacherNotesSearch.trim().toLowerCase();
                        const matchesText = n.text?.toLowerCase().includes(q);
                        const matchesStudent = n.studentName?.toLowerCase().includes(q);
                        const matchesClass = n.className?.toLowerCase().includes(q);
                        const matchesTags = (n.tags || []).some(tag => tag.toLowerCase().includes(q));
                        if (!matchesText && !matchesStudent && !matchesClass && !matchesTags) return false;
                      }
                      return true;
                    }).sort((a, b) => {
                      if (a.pinned && !b.pinned) return -1;
                      if (!a.pinned && b.pinned) return 1;
                      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                    });

                    const handleSaveTeacherNote = (e?: React.FormEvent) => {
                      if (e) e.preventDefault();
                      if (!teacherNoteForm.text.trim()) {
                        triggerToast(_t('يرجى كتابة نص الملاحظة', 'Please enter note text', 'Bitte Notiztext eingeben'));
                        return;
                      }

                      if (editingTeacherNoteId) {
                        updateSchoolNote(editingTeacherNoteId, {
                          type: teacherNoteForm.type,
                          text: teacherNoteForm.text.trim(),
                          tags: teacherNoteForm.tags,
                          pinned: teacherNoteForm.pinned,
                          className: teacherNoteForm.className.trim(),
                          teacherId: t.id,
                          teacherName: t.name,
                          periodNumber: teacherNoteForm.type === 'lesson' ? Number(teacherNoteForm.periodNumber) || 1 : undefined,
                          date: teacherNoteForm.type === 'lesson' ? teacherNoteForm.date : undefined,
                          studentId: teacherNoteForm.type === 'student' ? teacherNoteForm.studentId : undefined,
                          studentName: teacherNoteForm.type === 'student' ? teacherNoteForm.studentName : undefined,
                        });
                        triggerToast(_t('تم تحديث الملاحظة بنجاح ✅', 'Note updated successfully ✅', 'Notiz aktualisiert ✅'));
                        setEditingTeacherNoteId(null);
                      } else {
                        addSchoolNote({
                          type: teacherNoteForm.type,
                          text: teacherNoteForm.text.trim(),
                          tags: teacherNoteForm.tags,
                          pinned: teacherNoteForm.pinned,
                          className: teacherNoteForm.className.trim() || (teacherClassesList[0] || ''),
                          teacherId: t.id,
                          teacherName: t.name,
                          periodNumber: teacherNoteForm.type === 'lesson' ? Number(teacherNoteForm.periodNumber) || 1 : undefined,
                          date: teacherNoteForm.type === 'lesson' ? teacherNoteForm.date : undefined,
                          studentId: teacherNoteForm.type === 'student' ? teacherNoteForm.studentId : undefined,
                          studentName: teacherNoteForm.type === 'student' ? teacherNoteForm.studentName : undefined,
                        });
                        triggerToast(_t('تم حفظ الملاحظة بنجاح 📝', 'Note added successfully 📝', 'Notiz hinzugefügt 📝'));
                      }

                      setIsTeacherNoteFormOpen(false);
                      setTeacherNoteForm({
                        type: 'lesson',
                        className: teacherClassesList[0] || '',
                        studentId: '',
                        studentName: '',
                        periodNumber: 1,
                        date: new Date().toISOString().split('T')[0],
                        tags: [],
                        pinned: false,
                        text: ''
                      });
                    };

                    const handleStartEditTeacherNote = (note: SchoolNote) => {
                      setEditingTeacherNoteId(note.id);
                      setTeacherNoteForm({
                        type: note.type,
                        className: note.className || teacherClassesList[0] || '',
                        studentId: note.studentId || '',
                        studentName: note.studentName || '',
                        periodNumber: note.periodNumber || 1,
                        date: note.date || new Date().toISOString().split('T')[0],
                        tags: note.tags || [],
                        pinned: !!note.pinned,
                        text: note.text
                      });
                      setIsTeacherNoteFormOpen(true);
                    };

                    const toggleFormTag = (tagLabel: string) => {
                      setTeacherNoteForm(prev => ({
                        ...prev,
                        tags: prev.tags.includes(tagLabel)
                          ? prev.tags.filter(t => t !== tagLabel)
                          : [...prev.tags, tagLabel]
                      }));
                    };

                    return (
                      <div className="space-y-3">
                        {/* Section Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <h4 className="text-[11px] font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                              <span>{_t('ملاحظات الحصص والفصول المدرسية', 'School & Class Notes', 'Unterrichts- & Klassennotizen')}</span>
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                {allTeacherNotes.length}
                              </span>
                            </h4>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (isTeacherNoteFormOpen && !editingTeacherNoteId) {
                                setIsTeacherNoteFormOpen(false);
                              } else {
                                setEditingTeacherNoteId(null);
                                setTeacherNoteForm({
                                  type: 'lesson',
                                  className: teacherClassesList[0] || '',
                                  studentId: '',
                                  studentName: '',
                                  periodNumber: 1,
                                  date: new Date().toISOString().split('T')[0],
                                  tags: [],
                                  pinned: false,
                                  text: ''
                                });
                                setIsTeacherNoteFormOpen(true);
                              }
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            {isTeacherNoteFormOpen && !editingTeacherNoteId ? (
                              <>
                                <X className="w-3.5 h-3.5" />
                                <span>{_t('إغلاق النموذج', 'Close Form', 'Schließen')}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>{_t('إضافة ملاحظة للمعلم / فصوله', 'Add Note for Teacher', 'Notiz hinzufügen')}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Add/Edit Note Form */}
                        {isTeacherNoteFormOpen && (
                          <div className="bg-surface-hover/80 border border-amber-500/30 rounded-2xl p-3.5 space-y-3 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-surface-border/80 pb-2">
                              <span className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                <Edit3 className="w-3.5 h-3.5" />
                                {editingTeacherNoteId ? _t('تعديل الملاحظة', 'Edit Note', 'Notiz bearbeiten') : _t('إضافة ملاحظة جديدة', 'Add New Note', 'Neue Notiz')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsTeacherNoteFormOpen(false);
                                  setEditingTeacherNoteId(null);
                                }}
                                className="text-text-muted hover:text-text-main p-1 rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Note Type Selector */}
                            <div className="grid grid-cols-3 gap-1.5 bg-surface p-1 rounded-xl border border-surface-border">
                              <button
                                type="button"
                                onClick={() => setTeacherNoteForm(prev => ({ ...prev, type: 'lesson' }))}
                                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  teacherNoteForm.type === 'lesson'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>{_t('حصة', 'Lesson', 'Stunde')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTeacherNoteForm(prev => ({ ...prev, type: 'class' }))}
                                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  teacherNoteForm.type === 'class'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                                }`}
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>{_t('فصل كامل', 'Class', 'Klasse')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTeacherNoteForm(prev => ({ ...prev, type: 'student' }))}
                                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  teacherNoteForm.type === 'student'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                                }`}
                              >
                                <GraduationCap className="w-3.5 h-3.5" />
                                <span>{_t('طالب محدد', 'Student', 'Schüler')}</span>
                              </button>
                            </div>

                            {/* Form Fields Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {/* Class Selection */}
                              <div>
                                <label className="block text-[10px] font-bold text-text-muted mb-1">
                                  {_t('الفصل الدراسي', 'Class', 'Klasse')}
                                </label>
                                {teacherClassesList.length > 0 ? (
                                  <select
                                    value={teacherNoteForm.className}
                                    onChange={(e) => setTeacherNoteForm(prev => ({ ...prev, className: e.target.value }))}
                                    className="w-full bg-surface border border-surface-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="">{_t('-- اختر الفصل --', '-- Select Class --', '-- Klasse wählen --')}</option>
                                    {teacherClassesList.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={teacherNoteForm.className}
                                    onChange={(e) => setTeacherNoteForm(prev => ({ ...prev, className: e.target.value }))}
                                    placeholder={_t('اسم الفصل (مثال: 1/1)', 'Class name (e.g. 1/1)', 'Klasse')}
                                    className="w-full bg-surface border border-surface-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                                  />
                                )}
                              </div>

                              {/* Lesson Specifics */}
                              {teacherNoteForm.type === 'lesson' && (
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] font-bold text-text-muted mb-1">
                                      {_t('رقم الحصة', 'Period', 'Stunde')}
                                    </label>
                                    <select
                                      value={teacherNoteForm.periodNumber}
                                      onChange={(e) => setTeacherNoteForm(prev => ({ ...prev, periodNumber: Number(e.target.value) }))}
                                      className="w-full bg-surface border border-surface-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                                        <option key={p} value={p}>{_t(`حصة ${p}`, `Period ${p}`, `Std. ${p}`)}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-text-muted mb-1">
                                      {_t('التاريخ', 'Date', 'Datum')}
                                    </label>
                                    <input
                                      type="date"
                                      value={teacherNoteForm.date}
                                      onChange={(e) => setTeacherNoteForm(prev => ({ ...prev, date: e.target.value }))}
                                      className="w-full bg-surface border border-surface-border rounded-xl px-2 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500 font-mono"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Student Specifics */}
                              {teacherNoteForm.type === 'student' && (
                                <div>
                                  <label className="block text-[10px] font-bold text-text-muted mb-1">
                                    {_t('اسم الطالب', 'Student Name', 'Schülername')}
                                  </label>
                                  {(() => {
                                    const matchingStudents = (hodStudents || []).filter(s => 
                                      !teacherNoteForm.className || s.className?.trim().toLowerCase() === teacherNoteForm.className.trim().toLowerCase()
                                    );
                                    return (
                                      <select
                                        value={teacherNoteForm.studentId}
                                        onChange={(e) => {
                                          const sId = e.target.value;
                                          const found = matchingStudents.find(s => s.id === sId);
                                          setTeacherNoteForm(prev => ({
                                            ...prev,
                                            studentId: sId,
                                            studentName: found ? found.name : ''
                                          }));
                                        }}
                                        className="w-full bg-surface border border-surface-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                                      >
                                        <option value="">{_t('-- اختر الطالب --', '-- Select Student --', '-- Schüler wählen --')}</option>
                                        {matchingStudents.map(s => (
                                          <option key={s.id} value={s.id}>{s.name} ({s.className || '-'})</option>
                                        ))}
                                      </select>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>

                            {/* Quick Tags */}
                            <div>
                              <label className="block text-[10px] font-bold text-text-muted mb-1">
                                {_t('الوسوم السريعة', 'Quick Tags', 'Tags')}
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {QUICK_TEACHER_NOTE_TAGS.map(tag => {
                                  const tagLabel = language === 'ar' ? tag.ar : language === 'de' ? tag.de : tag.en;
                                  const isSelected = teacherNoteForm.tags.includes(tagLabel);
                                  return (
                                    <button
                                      key={tag.en}
                                      type="button"
                                      onClick={() => toggleFormTag(tagLabel)}
                                      className={`px-2 py-0.8 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                        isSelected 
                                          ? `${tag.color} ring-1 ring-amber-500/40 shadow-2xs` 
                                          : 'bg-surface text-text-muted border-surface-border hover:bg-surface-hover'
                                      }`}
                                    >
                                      {tagLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Note Text Area */}
                            <div>
                              <textarea
                                value={teacherNoteForm.text}
                                onChange={(e) => setTeacherNoteForm(prev => ({ ...prev, text: e.target.value }))}
                                placeholder={_t('اكتب ملاحظتك التفصيلية هنا...', 'Type detailed note here...', 'Detaillierte Notiz hier eingeben...')}
                                rows={3}
                                className="w-full bg-surface border border-surface-border rounded-xl p-2.5 text-xs text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-amber-500 leading-relaxed"
                              />
                            </div>

                            {/* Pin Toggle & Action Buttons */}
                            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-surface-border/60">
                              <button
                                type="button"
                                onClick={() => setTeacherNoteForm(prev => ({ ...prev, pinned: !prev.pinned }))}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  teacherNoteForm.pinned 
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 shadow-2xs' 
                                    : 'bg-surface text-text-muted border-surface-border hover:bg-surface-hover'
                                }`}
                              >
                                <Pin className={`w-3.5 h-3.5 ${teacherNoteForm.pinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                                <span>{_t('تثبيت في الأعلى', 'Pin to Top', 'Oben anheften')}</span>
                              </button>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsTeacherNoteFormOpen(false);
                                    setEditingTeacherNoteId(null);
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-main bg-surface hover:bg-surface-hover border border-surface-border rounded-xl transition-all cursor-pointer"
                                >
                                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveTeacherNote}
                                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{editingTeacherNoteId ? _t('حفظ التعديلات', 'Save Changes', 'Änderungen speichern') : _t('حفظ الملاحظة', 'Save Note', 'Notiz speichern')}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Filter Toolbar (Search & Pills) */}
                        {allTeacherNotes.length > 0 && (
                          <div className="space-y-2 bg-surface-hover/50 p-2.5 rounded-2xl border border-surface-border">
                            {/* Search + Class Dropdown */}
                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                              <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={teacherNotesSearch}
                                  onChange={(e) => setTeacherNotesSearch(e.target.value)}
                                  placeholder={_t('بحث في الملاحظات أو الطلاب أو الوسوم...', 'Search notes, students, tags...', 'Notizen, Schüler, Tags suchen...')}
                                  className="w-full bg-surface border border-surface-border rounded-xl pr-8 pl-3 py-1 text-xs text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {teacherClassesList.length > 1 && (
                                <div className="shrink-0 flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-text-muted whitespace-nowrap">{_t('تصفية الفصل:', 'Class:', 'Klasse:')}</span>
                                  <select
                                    value={teacherNotesClassFilter}
                                    onChange={(e) => setTeacherNotesClassFilter(e.target.value)}
                                    className="bg-surface border border-surface-border rounded-xl px-2 py-1 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="all">{_t('كل الفصول', 'All Classes', 'Alle Klassen')}</option>
                                    {teacherClassesList.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Type Filter Pills */}
                            <div className="flex flex-wrap gap-1 items-center pt-1 border-t border-surface-border/50">
                              <button
                                type="button"
                                onClick={() => setTeacherNotesFilterType('all')}
                                className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  teacherNotesFilterType === 'all'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'bg-surface text-text-muted border border-surface-border hover:bg-surface-hover'
                                }`}
                              >
                                {_t('الكل', 'All', 'Alle')} ({allTeacherNotes.length})
                              </button>

                              {pinnedNotesCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setTeacherNotesFilterType('pinned')}
                                  className={`px-2 py-0.8 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                    teacherNotesFilterType === 'pinned'
                                      ? 'bg-amber-600 text-white shadow-2xs'
                                      : 'bg-surface text-amber-600 dark:text-amber-400 border border-surface-border hover:bg-surface-hover'
                                  }`}
                                >
                                  <Pin className="w-2.5 h-2.5 fill-current" />
                                  <span>{_t('المثبتة', 'Pinned', 'Angeheftet')} ({pinnedNotesCount})</span>
                                </button>
                              )}

                              {lessonNotesCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setTeacherNotesFilterType('lesson')}
                                  className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    teacherNotesFilterType === 'lesson'
                                      ? 'bg-blue-600 text-white shadow-2xs'
                                      : 'bg-surface text-text-muted border border-surface-border hover:bg-surface-hover'
                                  }`}
                                >
                                  {_t('الحصص', 'Lessons', 'Stunden')} ({lessonNotesCount})
                                </button>
                              )}

                              {classNotesCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setTeacherNotesFilterType('class')}
                                  className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    teacherNotesFilterType === 'class'
                                      ? 'bg-purple-600 text-white shadow-2xs'
                                      : 'bg-surface text-text-muted border border-surface-border hover:bg-surface-hover'
                                  }`}
                                >
                                  {_t('الفصول', 'Classes', 'Klassen')} ({classNotesCount})
                                </button>
                              )}

                              {studentNotesCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setTeacherNotesFilterType('student')}
                                  className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    teacherNotesFilterType === 'student'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-surface text-text-muted border border-surface-border hover:bg-surface-hover'
                                  }`}
                                >
                                  {_t('الطلاب', 'Students', 'Schüler')} ({studentNotesCount})
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Notes List */}
                        {allTeacherNotes.length === 0 ? (
                          <div className="text-[11px] text-text-muted bg-surface-hover p-4 rounded-2xl border border-surface-border flex flex-col items-center justify-center text-center gap-1.5">
                            <BookOpen className="w-8 h-8 text-amber-500/40 mb-1" />
                            <p className="font-bold">{_t('لا توجد ملاحظات مسجلة لهذا المعلم أو فصوله بعد', 'No notes recorded for this teacher or their classes yet', 'Keine Notizen für diesen Lehrer vorhanden')}</p>
                            <p className="text-[10px] text-text-muted">
                              {_t('الملاحظات التي تسجلها عند فتح كارت المدرسة أو الحصص ستظهر هنا تلقائياً، أو يمكنك الضغط على "إضافة ملاحظة" الآن', 'Notes taken from school card or lessons will appear here automatically, or click "Add Note" now', 'Notizen aus dem Schulplan erscheinen hier')}
                            </p>
                          </div>
                        ) : filteredNotes.length === 0 ? (
                          <div className="text-[11px] text-text-muted bg-surface-hover p-3 rounded-xl border border-surface-border text-center">
                            {_t('لا توجد نتائج مطابقة لبحثك أو الفلاتر المحددة', 'No notes match your filter or search criteria', 'Keine passenden Notizen')}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {filteredNotes.map(note => {
                              const typeConfig = {
                                lesson: {
                                  label: _t('حصة', 'Lesson', 'Stunde'),
                                  bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                },
                                class: {
                                  label: _t('فصل', 'Class', 'Klasse'),
                                  bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                                },
                                student: {
                                  label: _t('طالب', 'Student', 'Schüler'),
                                  bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                }
                              }[note.type] || { label: _t('ملاحظة', 'Note', 'Notiz'), bg: 'bg-slate-500/10 text-slate-700' };

                              return (
                                <div
                                  key={note.id}
                                  className={`p-3 rounded-xl border transition-all relative group bg-surface ${
                                    note.pinned 
                                      ? 'border-amber-500/40 bg-amber-500/5 shadow-2xs' 
                                      : 'border-surface-border hover:border-amber-500/30'
                                  }`}
                                >
                                  {/* Note Header */}
                                  <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded border ${typeConfig.bg}`}>
                                        {typeConfig.label}
                                      </span>
                                      {note.className && (
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-surface-hover border border-surface-border text-text-main">
                                          {note.className}
                                        </span>
                                      )}
                                      {note.periodNumber && (
                                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-500/5 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
                                          {_t(`الحصة ${note.periodNumber}`, `Period ${note.periodNumber}`, `Std. ${note.periodNumber}`)}
                                        </span>
                                      )}
                                      {note.studentName && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                          <GraduationCap className="w-2.5 h-2.5" />
                                          <span>{note.studentName}</span>
                                        </span>
                                      )}
                                      {note.pinned && (
                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-white flex items-center gap-0.5 shadow-2xs">
                                          <Pin className="w-2.5 h-2.5 fill-current" />
                                          <span>{_t('مثبتة', 'Pinned', 'Angeheftet')}</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Quick Action Buttons */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateSchoolNote(note.id, { pinned: !note.pinned });
                                          triggerToast(note.pinned ? _t('تم إلغاء التثبيت', 'Unpinned', 'Gelöst') : _t('تم تثبيت الملاحظة 📌', 'Pinned 📌', 'Angeheftet 📌'));
                                        }}
                                        className={`p-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                                          note.pinned ? 'text-amber-500 hover:bg-amber-500/10' : 'text-text-muted hover:text-amber-500 hover:bg-surface-hover'
                                        }`}
                                        title={note.pinned ? _t('إلغاء التثبيت', 'Unpin', 'Lösen') : _t('تثبيت', 'Pin', 'Anheften')}
                                      >
                                        <Pin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-current' : ''}`} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleStartEditTeacherNote(note)}
                                        className="p-1 text-text-muted hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                                        title={_t('تعديل', 'Edit', 'Bearbeiten')}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(note.text);
                                          triggerToast(_t('تم نسخ نص الملاحظة 📋', 'Note text copied 📋', 'Notiz kopiert 📋'));
                                        }}
                                        className="p-1 text-text-muted hover:text-emerald-500 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                                        title={_t('نسخ النص', 'Copy Text', 'Kopieren')}
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(_t('هل أنت متأكد من حذف هذه الملاحظة؟', 'Delete this note?', 'Diese Notiz löschen?'))) {
                                            deleteSchoolNote(note.id);
                                            triggerToast(_t('تم حذف الملاحظة', 'Note deleted', 'Notiz gelöscht'));
                                          }
                                        }}
                                        className="p-1 text-text-muted hover:text-rose-500 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                                        title={_t('حذف', 'Delete', 'Löschen')}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Note Body Text */}
                                  <p className="text-xs text-text-main whitespace-pre-wrap leading-relaxed my-1.5 font-medium">
                                    {note.text}
                                  </p>

                                  {/* Note Tags & Date Footer */}
                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-border/40 text-[10px] text-text-muted flex-wrap">
                                    <div className="flex flex-wrap gap-1 items-center">
                                      {(note.tags || []).map(tag => (
                                        <span key={tag} className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-surface-hover border border-surface-border text-text-muted">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>

                                    <div className="font-mono text-[9px] text-text-muted/70 flex items-center gap-1">
                                      {note.date ? (
                                        <span>{note.date}</span>
                                      ) : note.createdAt ? (
                                        <span>{new Date(note.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* Export Modal */}
      {isExportModalOpen && (
        <SchoolScheduleExportModal onClose={() => setIsExportModalOpen(false)} />
      )}
      
      {/* Import Timetable Modal */}
      
      
      <ObservationFormModal 
        isOpen={isVisitModalOpen}
        initialTeacherId={obsInitialTeacherId}
        onClose={() => {
          setIsVisitModalOpen(false);
          setObsInitialTeacherId(undefined);
        }}
        onSave={(record) => {
          const teacherName = teachers.find(t => t.id === record.teacherId)?.name || record.teacherId;
          const item = {
            ...record,
            id: Date.now().toString(),
            teacherName,
            term: schoolSettings.currentTerm || 'Term 1'
          };
          const updated = [item, ...visitRecords];
          setVisitRecords(updated);
          persistHodData({ visitRecords: updated });
          setIsVisitModalOpen(false);
          triggerToast(_t('تم تسجيل الزيارة بنجاح', 'Visit logged successfully', 'Besuch erfolgreich protokolliert'));
        }}
        teachers={teachers}
        schoolSettings={schoolSettings}
        _t={_t}
      />

      <BulkObservationExportModal
        isOpen={isBulkVisitExportModalOpen}
        onClose={() => {
          setIsBulkVisitExportModalOpen(false);
          setBulkExportTeacherId(undefined);
        }}
        visitRecords={visitRecords}
        teachers={teachers}
        schoolSettings={schoolSettings}
        language={language}
        initialTeacherId={bulkExportTeacherId}
        onPreviewSingle={(visit) => setPreviewVisitRecord(visit)}
      />
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5">
          <div className="bg-surface rounded-xl border border-surface-border w-full max-w-2xl p-3 space-y-2 shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <h3 className="text-base font-black text-text-main flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>{_t('استيراد الجدول بالذكاء الاصطناعي', 'Import Schedule via AI', 'Stundenplan mit KI importieren')}</span>
              </h3>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setValidationResult(null);
                }}
                className="p-2 bg-surface-hover text-text-muted hover:text-text-main rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* Step 1: Scope & Prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">1</div>
                  <h4 className="text-[11px] font-bold text-text-main">{_t('نطاق الاستيراد', 'Import Scope', 'Import-Umfang')}</h4>
                </div>
                
                <div className="flex gap-2 bg-surface-hover p-1 rounded-xl">
                  <button 
                    onClick={() => setImportScope('all')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${importScope === 'all' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-surface'}`}
                  >
                    {_t('القسم بالكامل', 'Whole Department', 'Gesamte Abteilung')}
                  </button>
                  <button 
                    onClick={() => setImportScope('single')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${importScope === 'single' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-surface'}`}
                  >
                    {_t('معلم محدد', 'Specific Teacher', 'Bestimmter Lehrer')}
                  </button>
                </div>

                {importScope === 'single' && (
                  <select
                    value={selectedTeacherForImport}
                    onChange={(e) => setSelectedTeacherForImport(e.target.value)}
                    className="w-full p-2 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-semibold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="">{_t('-- اختر المعلم --', '-- Select Teacher --', '-- Lehrer wählen --')}</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}

                <div className="p-3 bg-primary-soft/30 border border-primary-border rounded-xl space-y-3 mt-4">
                  <p className="text-[11px] text-text-muted font-semibold leading-relaxed">
                    {_t('انسخ الموجه الذكي وقدمه لـ ChatGPT أو Gemini مع إرفاق صورة جدول الحصص.', 'Copy the smart prompt and provide it to ChatGPT/Gemini along with a photo of the schedule.', 'Kopieren Sie den Prompt und fügen Sie ihn in ChatGPT/Gemini ein.')}
                  </p>
                  <button
                    onClick={copyPromptToClipboard}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-xs"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{_t('تم النسخ للحافظة!', 'Copied to Clipboard!', 'Kopiert!')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{_t('نسخ الموجه الذكي', 'Copy Smart Prompt', 'Prompt kopieren')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Paste & Validate */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">2</div>
                  <h4 className="text-[11px] font-bold text-text-main">{_t('لصق الرد (JSON)', 'Paste Response (JSON)', 'Antwort einfügen (JSON)')}</h4>
                </div>

                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setValidationResult(null);
                  }}
                  placeholder={_t('ألصق كود JSON هنا...', 'Paste JSON code here...', 'Fügen Sie den JSON-Code hier ein...')}
                  className="w-full h-32 p-3 bg-surface border border-surface-border rounded-xl text-[11px] font-mono text-text-main placeholder-text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                  dir="ltr"
                />

                {!validationResult ? (
                  <button
                    onClick={handleValidateImport}
                    disabled={!importText.trim()}
                    className="w-full py-2 bg-surface hover:bg-surface-hover text-text-main border border-surface-border rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {_t('التحقق من صحة البيانات', 'Validate Data', 'Daten validieren')}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className={`p-2 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${validationResult.isValid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'}`}>
                      {validationResult.isValid ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      <span>{validationResult.isValid ? _t('البيانات صحيحة', 'Data is valid', 'Daten sind gültig') : _t('يوجد أخطاء في البيانات', 'Errors found in data', 'Fehler in den Daten gefunden')}</span>
                    </div>

                    {!validationResult.isValid && validationResult.errors.map((err, idx) => (
                      <div key={idx} className="text-[10px] text-rose-500 font-semibold px-2 flex items-start gap-1">
                        <span>•</span>
                        <span>{err}</span>
                      </div>
                    ))}

                    {validationResult.warnings.map((warn, idx) => (
                      <div key={idx} className="text-[10px] text-amber-500 font-semibold px-2 flex items-start gap-1">
                        <span>•</span>
                        <span>{warn}</span>
                      </div>
                    ))}

                    <button
                      onClick={confirmImport}
                      disabled={!validationResult.isValid}
                      className="w-full mt-2 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-xs"
                    >
                      {_t('تأكيد الاستيراد', 'Confirm Import', 'Import bestätigen')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Clear Department / Single Teacher Schedule Footer */}
            <div className="pt-3 mt-1 border-t border-surface-border space-y-2.5">
              {/* Option 1: Clear Selected Teacher's Schedule (When specific teacher is selected) */}
              {importScope === 'single' && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-text-main text-[11px] font-bold">
                    <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      {selectedTeacherForImport ? (
                        _t(
                          `مسح جدول (${teachers.find(t => t.id === selectedTeacherForImport)?.name || 'المعلم المحدد'}) فقط: تفريغ حصص هذا المعلم دون التأثير على باقي القسم.`,
                          `Clear (${teachers.find(t => t.id === selectedTeacherForImport)?.name || 'Selected Teacher'}) schedule only.`,
                          `Nur den Stundenplan von (${teachers.find(t => t.id === selectedTeacherForImport)?.name || 'Lehrer'}) löschen.`
                        )
                      ) : (
                        _t(
                          'مسح جدول معلم محدد: اختر معلماً من القائمة أعلاه لتفريغ جدوله فقط.',
                          'Clear single teacher schedule: Please select a teacher above.',
                          'Einzelnen Plan löschen: Bitte wählen Sie oben einen Lehrer aus.'
                        )
                      )}
                    </span>
                  </div>

                  {!showClearTeacherScheduleConfirm ? (
                    <button
                      type="button"
                      disabled={!selectedTeacherForImport}
                      onClick={() => setShowClearTeacherScheduleConfirm(true)}
                      className="w-full sm:w-auto px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{_t('مسح جدول هذا المعلم فقط', "Clear This Teacher's Schedule Only", 'Diesen Stundenplan löschen')}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto p-1 bg-amber-500/20 border border-amber-500/40 rounded-xl shrink-0 animate-fade-in">
                      <span className="text-[10.5px] font-bold text-amber-800 dark:text-amber-200 px-1.5">
                        {_t('تأكيد مسح جدول هذا المعلم؟', "Confirm clear this teacher's schedule?", 'Diesen Plan wirklich löschen?')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleClearSingleTeacherTimetable(selectedTeacherForImport)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10.5px] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        {_t('نعم، امسح الجدول', 'Yes, Clear Schedule', 'Ja, löschen')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearTeacherScheduleConfirm(false)}
                        className="px-2.5 py-1 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg text-[10.5px] font-bold border border-surface-border transition-all cursor-pointer"
                      >
                        {_t('إلغاء', 'Cancel', 'Abbrechen')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Option 2: Clear All Department Schedules Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-text-muted text-[11px]">
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>
                    {_t('إعادة ضبط الجداول: يمكنك تفريغ كافة جداول معلمين القسم دفعة واحدة.', 'Reset: Clear all department teacher schedules at once.', 'Zurücksetzen: Alle Stundenpläne der Fachschaft auf einmal löschen.')}
                  </span>
                </div>

                {!showClearScheduleConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowClearScheduleConfirm(true)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:border-rose-500/30 rounded-xl text-[11px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{_t('مسح كافة جداول القسم', 'Clear All Department Schedules', 'Alle Stundenpläne löschen')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto p-1 bg-rose-500/10 border border-rose-500/30 rounded-xl shrink-0 animate-fade-in">
                    <span className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 px-1.5">
                      {_t('تأكيد مسح كافة الجداول؟', 'Confirm full clear?', 'Löschen bestätigen?')}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllTimetables}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10.5px] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      {_t('نعم، امسح الكل', 'Yes, Clear All', 'Ja, alle löschen')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearScheduleConfirm(false)}
                      className="px-2.5 py-1 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg text-[10.5px] font-bold border border-surface-border transition-all cursor-pointer"
                    >
                      {_t('إلغاء', 'Cancel', 'Abbrechen')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cell Details Modal */}
      {selectedCellDetails && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-2.5 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedCellDetails(null)}>
          <div 
            className="bg-surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-xl shadow-xl overflow-hidden border border-surface-border animate-slide-up sm:animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-surface-border rounded-full mx-auto mt-3 sm:hidden" />
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <h3 className="text-base font-black text-text-main flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span>{_t('تفاصيل الحصة', 'Lesson Details', 'Stundendetails')}</span>
              </h3>
              <button 
                onClick={() => setSelectedCellDetails(null)}
                className="p-2 bg-surface-hover hover:bg-surface-border text-text-muted rounded-full transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-1.5 bg-surface-hover border border-surface-border p-3 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-lg">
                  {selectedCellDetails.teacherName.charAt(0)}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-text-muted">{_t('المعلم', 'Teacher', 'Lehrer')}</div>
                  <div className="text-[11px] font-bold text-text-main">{selectedCellDetails.teacherName}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-surface border border-surface-border p-3 rounded-xl space-y-1 shadow-sm">
                  <div className="text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {_t('الفصل', 'Class', 'Klasse')}
                  </div>
                  <div className="text-base font-black text-text-main">{selectedCellDetails.className}</div>
                </div>
                <div className="bg-surface border border-surface-border p-3 rounded-xl space-y-1 shadow-sm">
                  <div className="text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {_t('المادة', 'Subject', 'Fach')}
                  </div>
                  <div className="text-[11px] font-bold text-text-main line-clamp-1">{selectedCellDetails.subjectName || '-'}</div>
                </div>
                <div className="bg-surface border border-surface-border p-3 rounded-xl space-y-1 shadow-sm">
                  <div className="text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {_t('اليوم والحصة', 'Day & Period', 'Tag & Stunde')}
                  </div>
                  <div className="text-[11px] font-bold text-text-main">
                    {WEEKDAY_NAMES[selectedCellDetails.dayKey as keyof typeof WEEKDAY_NAMES]} - {_t(`ح${selectedCellDetails.periodNumber}`, `P${selectedCellDetails.periodNumber}`, `S${selectedCellDetails.periodNumber}`)}
                  </div>
                </div>
                <div className="bg-surface border border-surface-border p-3 rounded-xl space-y-1 shadow-sm">
                  <div className="text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {_t('الوقت', 'Time', 'Zeit')}
                  </div>
                  <div className="text-[11px] font-bold text-text-main font-mono">
                    {selectedCellDetails.startTime} - {selectedCellDetails.endTime}
                  </div>
                </div>
              </div>

              {selectedCellDetails.room && (
                <div className="bg-surface border border-surface-border p-3 rounded-xl flex items-center gap-2 shadow-sm">
                  <MapPin className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-[10px] font-semibold text-text-muted">{_t('القاعة / الغرفة', 'Room / Location', 'Raum / Ort')}</div>
                    <div className="text-[11px] font-bold text-text-main">{selectedCellDetails.room}</div>
                  </div>
                </div>
              )}
            </div>

            {selectedCellDetails.teacherId && (
              <div className="p-3 pt-0">
                <button
                  type="button"
                  onClick={() => {
                    const cell = selectedCellDetails;
                    setSelectedCellDetails(null);
                    startEditPeriod(cell.teacherId!, cell.dayKey, cell.periodNumber);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{_t('تعديل بيانات الحصة', 'Edit Period Details', 'Stundendetails bearbeiten')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Edit / Add Period Dialog in Unified Matrix */}
      {editingPeriod && (() => {
        const existingLesson = getLessonForTeacher(editingPeriod.teacherId, editingPeriod.dayKey, editingPeriod.periodNumber);
        const hasExistingLesson = Boolean(existingLesson && (existingLesson.className || existingLesson.subjectName));

        return (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[110] animate-fade-in" 
            onClick={() => setEditingPeriod(null)}
          >
            <div 
              className="bg-surface rounded-3xl border border-surface-border w-full max-w-md p-5 space-y-4 animate-scale-up shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-primary-soft text-primary flex items-center justify-center font-bold shrink-0">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-text-main flex items-center gap-1.5">
                      <span>
                        {hasExistingLesson 
                          ? _t(`تعديل بيانات الحصة ${editingPeriod.periodNumber}`, `Edit Period ${editingPeriod.periodNumber} Details`, `Bearbeite Stunde ${editingPeriod.periodNumber}`)
                          : _t(`إضافة حصة جديدة (الحصة ${editingPeriod.periodNumber})`, `Add New Period (${editingPeriod.periodNumber})`, `Neue Stunde (${editingPeriod.periodNumber})`)
                        }
                      </span>
                    </h3>
                    <p className="text-[11px] text-text-muted font-bold mt-0.5">
                      <span className="text-primary">{editingPeriod.teacherName}</span> • {WEEKDAY_NAMES[editingPeriod.dayKey as keyof typeof WEEKDAY_NAMES]} {editingPeriod.startTime ? `(${editingPeriod.startTime} - ${editingPeriod.endTime})` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPeriod(null)}
                  className="p-1.5 hover:bg-surface-hover rounded-full text-text-muted cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main">
                    {_t('المادة أو النشاط', 'Subject / Activity', 'Fach / Aktivität')}
                  </label>
                  <input
                    type="text"
                    placeholder={_t('مثال: لغة ألمانية، رياضيات...', 'e.g. German, Math...', 'z.B. Deutsch, Mathe...')}
                    value={periodSubjectName}
                    onChange={(e) => setPeriodSubjectName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-text-main font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main">
                    {_t('الفصل أو المجموعة', 'Class / Group', 'Klasse / Gruppe')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={_t('مثال: 1/أ، مجموعة التقوية...', 'e.g. Class 10A, Group B...', 'z.B. Klasse 10A, Gruppe B...')}
                    value={periodClassName}
                    onChange={(e) => setPeriodClassName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-text-main font-bold"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main">
                    {_t('ملاحظات إضافية', 'Additional Notes', 'Zusätzliche Notizen')}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={_t('أي ملاحظات أو تنبيهات لهذه الحصة...', 'Any notes regarding this school period...', 'Notizen zu dieser Stunde...')}
                    value={periodNotes}
                    onChange={(e) => setPeriodNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-text-main font-medium resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-surface-border gap-2">
                {hasExistingLesson ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleClearPeriod(editingPeriod.teacherId, editingPeriod.dayKey, editingPeriod.periodNumber);
                      setEditingPeriod(null);
                      triggerToast(_t('تم مسح الحصة بنجاح', 'Period cleared successfully', 'Stunde gelöscht'));
                    }}
                    className="px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{_t('مسح الحصة', 'Clear Period', 'Entfernen')}</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPeriod(null)}
                    className="px-4 py-2 bg-surface hover:bg-surface-hover text-text-muted rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {_t('إلغاء', 'Cancel', 'Abbrechen')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!periodClassName.trim() && !periodSubjectName.trim()) {
                        triggerToast(_t('يرجى إدخال اسم الفصل أو المادة', 'Please enter class or subject name', 'Bitte Klasse oder Fach eingeben'));
                        return;
                      }
                      handleSavePeriod(
                        editingPeriod.teacherId,
                        editingPeriod.dayKey,
                        editingPeriod.periodNumber,
                        {
                          className: periodClassName,
                          subjectName: periodSubjectName,
                          notes: periodNotes
                        }
                      );
                      setEditingPeriod(null);
                      triggerToast(_t('تم حفظ بيانات الحصة بنجاح', 'Period saved successfully', 'Stunde gespeichert'));
                    }}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold focus:outline-none shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    {_t('حفظ البيانات', 'Save', 'Speichern')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Teacher Add/Edit Modal */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-xl shadow-xl overflow-hidden border border-surface-border">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
              <h3 className="text-[11px] font-black text-text-main">
                {editingTeacher ? _t('تعديل بيانات المعلم', 'Edit Teacher', 'Lehrer bearbeiten') : _t('إضافة معلم جديد', 'Add New Teacher', 'Neuen Lehrer hinzufügen')}
              </h3>
              <button 
                onClick={() => setIsTeacherModalOpen(false)}
                className="p-1 hover:bg-surface-hover rounded-lg text-text-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveTeacher} className="p-2.5 space-y-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-main">
                  {_t('اسم المعلم', 'Teacher Name', 'Lehrername')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={e => setTeacherName(e.target.value)}
                  className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-main">
                  {_t('رقم الهاتف (اختياري)', 'Phone Number (Optional)', 'Telefon (Optional)')}
                </label>
                <input
                  type="tel"
                  value={teacherPhone}
                  onChange={e => setTeacherPhone(e.target.value)}
                  className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary text-left"
                  dir="ltr"
                />
              </div>

              {!editingTeacher && (
                <div className="bg-primary-soft/50 border border-primary-border p-2.5 rounded-xl flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-text-muted font-bold leading-relaxed">
                    {_t('سيتم حساب الحصص والفصول تلقائياً من جدول الحصص الشامل عند استيراده.', 'Workload & classes will be automatically derived from the global timetable.', 'Auslastung wird automatisch berechnet.')}
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="px-2.5 py-1 text-[11px] font-bold text-text-muted hover:bg-surface-hover rounded-xl transition-all cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-primary text-white text-[11px] font-bold rounded-xl hover:bg-primary-hover shadow-2xs transition-all cursor-pointer"
                >
                  {_t('حفظ البيانات', 'Save Data', 'Daten speichern')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Visit Modal */}
      {previewVisitRecord && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewVisitRecord(null)}>
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-border" onClick={e => e.stopPropagation()}>
            <div className="p-2.5 border-b border-surface-border flex items-center justify-between bg-surface-hover/30">
              <h2 className="text-lg font-black text-text-main flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-primary" />
                {_t('معاينة زيارة صفية', 'Classroom Observation Preview', 'Vorschau der Klassenbeobachtung')}
              </h2>
              <button onClick={() => setPreviewVisitRecord(null)} className="p-2 hover:bg-surface-hover rounded-xl text-text-muted cursor-pointer transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto space-y-2">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-surface-hover border border-surface-border rounded-xl">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('المعلم', 'Teacher', 'Lehrer')}</span>
                  <p className="text-[11px] font-black text-text-main">{previewVisitRecord.teacherName}</p>
                </div>
                <div className="p-3 bg-surface-hover border border-surface-border rounded-xl">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('الفصل', 'Class', 'Klasse')}</span>
                  <p className="text-[11px] font-black text-text-main">{previewVisitRecord.className}</p>
                </div>
                <div className="p-3 bg-surface-hover border border-surface-border rounded-xl">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('التاريخ والحصة', 'Date & Period', 'Datum & Stunde')}</span>
                  <p className="text-[11px] font-black text-text-main">{new Date(previewVisitRecord.visitedDate || previewVisitRecord.date).toLocaleDateString()} - {_t('الحصة', 'Period', 'Stunde')} {previewVisitRecord.periodNumber}</p>
                </div>
                <div className="p-3 bg-surface-hover border border-surface-border rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('التقييم العام', 'Overall Score', 'Gesamtbewertung')}</span>
                    <p className="text-[11px] font-black text-text-main">{previewVisitRecord.overallScore} / 75</p>
                  </div>
                  <span className="px-2 py-1 rounded-md text-[10px] font-black border bg-primary/10 text-primary border-primary/30">
                    {previewVisitRecord.overallCategory}
                  </span>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{_t('تفاصيل التقييم (1 - 5)', 'Evaluation Breakdown (1 - 5)', 'Bewertungsübersicht')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {/* Category 1 */}
                  <div className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-2">
                    <h5 className="text-[11px] font-black text-primary border-b border-surface-border pb-1">
                      {_t('إدارة الفصل', 'Classroom Management', 'Klassenführung')}
                    </h5>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('التنظيم والنظافة', 'Organization', 'Organisation')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.cm_organization || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('السيطرة وضبط الفصل', 'Control & Discipline', 'Kontrolle')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.cm_control || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('إدارة الوقت', 'Time Management', 'Zeitmanagement')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.cm_time || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('الاحترام والتعامل', 'Respect & Rapport', 'Respekt')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.cm_respect || '-'}/5</span>
                      </div>
                    </div>
                  </div>

                  {/* Category 2 */}
                  <div className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-2">
                    <h5 className="text-[11px] font-black text-primary border-b border-surface-border pb-1">
                      {_t('المهارات التدريسية', 'Teaching Skills', 'Lehrfähigkeiten')}
                    </h5>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('وضوح الأهداف', 'Objectives Clarity', 'Lernziele')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.ts_objectives || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('الوسائل التعليمية', 'Teaching Aids', 'Lehrmittel')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.ts_aids || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('تشجيع المشاركة', 'Encouraging Participation', 'Beteiligung')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.ts_participation || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('الأسئلة والتحفيز', 'Thought Questions', 'Fragen')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.ts_questions || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('وضوح الشرح', 'Explanation Clarity', 'Erklärungen')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.ts_clarity || '-'}/5</span>
                      </div>
                    </div>
                  </div>

                  {/* Category 3 */}
                  <div className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-2">
                    <h5 className="text-[11px] font-black text-primary border-b border-surface-border pb-1">
                      {_t('تفاعل الطلاب', 'Student Engagement', 'Schülerengagement')}
                    </h5>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('المشاركة بالأنشطة', 'Activity Participation', 'Aktivitäten')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.se_participation || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('التفاعل الإيجابي', 'Positive Interaction', 'Interaktion')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.se_interaction || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('الالتزام بالقواعد', 'Rule Adherence', 'Regeln')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.se_rules || '-'}/5</span>
                      </div>
                    </div>
                  </div>

                  {/* Category 4 */}
                  <div className="p-3 bg-surface-hover border border-surface-border rounded-xl space-y-2">
                    <h5 className="text-[11px] font-black text-primary border-b border-surface-border pb-1">
                      {_t('متابعة تصحيح الدفتر', 'Booklet Correction', 'Heftkorrektur')}
                    </h5>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('الانتظام والسرعة', 'Prompt Marking', 'Regelmäßigkeit')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.bc_regularity || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('جودة التغذية الراجعة', 'Feedback Quality', 'Feedback-Qualität')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.bc_quality || '-'}/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">{_t('استجابة الطلاب للتصويبات', 'Student Compliance', 'Schüler-Compliance')}</span>
                        <span className="font-black text-text-main">{previewVisitRecord.bc_compliance || '-'}/5</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{_t('توجيهات إضافية وتوصيات', 'Notes & Recommendations', 'Notizen & Empfehlungen')}</h4>
                <div className="p-3 bg-surface-hover border border-surface-border rounded-xl text-[11px] text-text-main leading-relaxed min-h-[60px]">
                  {previewVisitRecord.consolidatedNotes || _t('لا توجد ملاحظات مسجلة.', 'No notes recorded.', 'Keine Notizen erfasst.')}
                </div>
              </div>

              {/* Signatures Footer Summary */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 text-[10px] text-center text-text-muted border-t border-surface-border">
                <div className="p-2 bg-surface-hover rounded-lg">
                  <span className="block font-bold">{_t('المعلم', 'Teacher', 'Lehrer')}</span>
                  <span className="font-black text-text-main truncate block mt-0.5">{previewVisitRecord.teacherName}</span>
                </div>
                <div className="p-2 bg-surface-hover rounded-lg">
                  <span className="block font-bold">{_t('المشرف', 'Supervisor', 'Fachleiter')}</span>
                  <span className="font-black text-text-main truncate block mt-0.5">{schoolSettings.hodName || 'عبد الرحمن غريب'}</span>
                </div>
              </div>
            </div>
            <div className="p-2.5 border-t border-surface-border flex flex-wrap items-center justify-between gap-1.5 bg-surface">
              <button
                onClick={() => setPreviewVisitRecord(null)}
                className="h-9 px-4 text-[11px] font-bold text-text-muted bg-surface hover:bg-surface-hover border border-surface-border rounded-xl transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>{_t('إغلاق', 'Close', 'Schließen')}</span>
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleShareWhatsApp(previewVisitRecord)}
                  disabled={!!activeLoadingAction}
                  className="h-9 px-3.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:border-emerald-800 rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60 disabled:pointer-events-none"
                >
                  {activeLoadingAction?.id === previewVisitRecord.id && activeLoadingAction?.type === 'share' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>
                    {activeLoadingAction?.id === previewVisitRecord.id && activeLoadingAction?.type === 'share'
                      ? _t('جاري المشاركة...', 'Sharing...', 'Wird geteilt...')
                      : _t('مشاركة عبر واتساب', 'Share via WhatsApp', 'Über WhatsApp teilen')}
                  </span>
                </button>
                <button
                  onClick={() => handleDownloadPdf(previewVisitRecord)}
                  disabled={!!activeLoadingAction}
                  className="h-9 px-3.5 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 dark:text-sky-300 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 dark:border-sky-800 rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60 disabled:pointer-events-none"
                >
                  {activeLoadingAction?.id === previewVisitRecord.id && activeLoadingAction?.type === 'download' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600 dark:text-sky-400" />
                  ) : (
                    <Download className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  )}
                  <span>
                    {activeLoadingAction?.id === previewVisitRecord.id && activeLoadingAction?.type === 'download'
                      ? _t('جاري التحميل...', 'Generating PDF...', 'Wird geladen...')
                      : _t('تحميل التقرير PDF', 'Download PDF', 'PDF herunterladen')}
                  </span>
                </button>
                <button
                  onClick={() => {
                    printObservationReport(previewVisitRecord, schoolSettings, (language === 'ar'), language);
                  }}
                  className="h-9 px-3.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:border-indigo-800 rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{_t('طباعة', 'Print', 'Drucken')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {isFollowUpModalOpen && selectedStageManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-2.5 border-b border-surface-border flex items-center justify-between bg-surface-hover/40">
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-[11px] shadow-xs">
                  {selectedStageManager.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-text-main">
                    {_t('إرسال متابعة وتقييم لمدير المرحلة:', 'Send Follow-Up & Evaluation:', 'Nachverfolgung senden:')} {selectedStageManager.name}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {_t('المرحلة المسندة:', 'Assigned Stage:', 'Stufe:')} {(selectedStageManager.assignedGradeGroups || []).join(', ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFollowUpModalOpen(false)}
                className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-2.5 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
              {/* Period & Week Selection */}
              <div className="bg-surface-hover/60 border border-surface-border p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-text-main shrink-0">{_t('نوع المتابعة:', 'Period Type:', 'Zeitraum:')}</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'weekly', label: _t('أسبوعية', 'Weekly', 'Wöchentlich') },
                      { id: 'monthly', label: _t('شهرية', 'Monthly', 'Monatlich') },
                      { id: 'termly', label: _t('فصلية', 'Termly', 'Pro Semester') }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFollowUpPeriodType(p.id as any)}
                        className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                          followUpPeriodType === p.id 
                            ? 'bg-primary text-white border-primary shadow-xs' 
                            : 'bg-surface text-text-muted border-surface-border hover:text-text-main'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Week Number Option */}
                <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-r border-surface-border pt-2 sm:pt-0 sm:pr-3 w-full sm:w-auto">
                  <label className="text-[11px] font-bold text-text-main whitespace-nowrap">
                    {_t('رقم الأسبوع:', 'Week Number:', 'Woche:')}
                  </label>
                  <select
                    value={followUpWeekNumber}
                    onChange={e => setFollowUpWeekNumber(Number(e.target.value))}
                    className="px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>
                        {_t(`الأسبوع ${w}`, `Week ${w}`, `Woche ${w}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Supervised Teachers List with Expanded Preset Evals */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>{_t('تجميع بيانات وتقييمات معلمين المرحلة تلقائياً', 'Supervised Teachers Auto-Evaluation', 'Lehrer-Bewertung')}</span>
                </h4>

                {Object.keys(followUpTeachersData).length === 0 ? (
                  <div className="p-3 text-center text-[11px] text-text-muted border border-dashed border-surface-border rounded-xl">
                    {_t('لا يوجد معلمين مرتبطين بهذه المرحلة تلقائياً', 'No teachers assigned', 'Keine Lehrer zugewiesen')}
                  </div>
                ) : (
                  Object.entries(followUpTeachersData).map(([tId, tData]: [string, any]) => (
                    <div key={tId} className="bg-surface-hover/40 border border-surface-border rounded-xl p-2.5 space-y-3">
                      {/* Teacher Header & Auto Metrics */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-border/60">
                        <div>
                          <h5 className="text-[11px] font-black text-text-main">{tData.teacherName}</h5>
                          <span className="text-[11px] text-text-muted font-mono">
                            {_t('الفصول:', 'Classes:', 'Klassen:')} {(tData.assignedClasses || []).join(', ') || '-'} ({tData.totalSessions} {_t('حصة/أسبوع', 'sessions/wk', 'Std/W')})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg border border-emerald-500/20">
                            {_t('الزيارات:', 'Visits:', 'Besuche:')} {tData.visitsCount} ({tData.visitsAvgScore})
                          </span>
                          <span className={`px-2 py-1 rounded-lg border ${
                            tData.complaintsCount > 0 ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                          }`}>
                            {_t('الشكاوى:', 'Complaints:', 'Beschwerden:')} {tData.complaintsCount}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Preset Categories */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
                        {/* 1. Curriculum Adherence */}
                        <div className="space-y-1.5">
                          <label className="font-bold text-text-main text-[11px]">{_t('1. الالتزام بالمنهج وخطة التدريس:', '1. Curriculum Adherence:', '1. Lehrplan:')}</label>
                          <div className="flex flex-wrap gap-1">
                            {PRESET_EVALS.curriculum.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setFollowUpTeachersData(prev => ({
                                  ...prev,
                                  [tId]: { ...prev[tId], curriculumAdherence: preset }
                                }))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                                  tData.curriculumAdherence === preset 
                                    ? 'bg-primary text-white border-primary shadow-2xs' 
                                    : 'bg-surface text-text-muted border-surface-border hover:bg-surface-hover hover:text-text-main'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. Booklet Checking */}
                        <div className="space-y-1.5">
                          <label className="font-bold text-text-main text-[11px]">{_t('2. متابعة الكراسات والدفاتر:', '2. Booklet Checking:', '2. Hefte:')}</label>
                          <div className="flex flex-wrap gap-1">
                            {PRESET_EVALS.booklets.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setFollowUpTeachersData(prev => ({
                                  ...prev,
                                  [tId]: { ...prev[tId], bookletChecking: preset }
                                }))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                                  tData.bookletChecking === preset 
                                    ? 'bg-primary text-white border-primary shadow-2xs' 
                                    : 'bg-surface text-text-muted border-surface-border hover:bg-surface-hover hover:text-text-main'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. Classroom Management */}
                        <div className="space-y-1.5">
                          <label className="font-bold text-text-main text-[11px]">{_t('3. إدارة الفصل والسيطرة:', '3. Classroom Management:', '3. Klassenführung:')}</label>
                          <div className="flex flex-wrap gap-1">
                            {PRESET_EVALS.management.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setFollowUpTeachersData(prev => ({
                                  ...prev,
                                  [tId]: { ...prev[tId], classroomManagement: preset }
                                }))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                                  tData.classroomManagement === preset 
                                    ? 'bg-primary text-white border-primary shadow-2xs' 
                                    : 'bg-surface text-text-muted border-surface-border hover:bg-surface-hover hover:text-text-main'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 4. Punctuality & Discipline */}
                        <div className="space-y-1.5">
                          <label className="font-bold text-text-main text-[11px]">{_t('4. المواعيد والانضباط:', '4. Punctuality & Discipline:', '4. Pünktlichkeit:')}</label>
                          <div className="flex flex-wrap gap-1">
                            {PRESET_EVALS.punctuality.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setFollowUpTeachersData(prev => ({
                                  ...prev,
                                  [tId]: { ...prev[tId], punctuality: preset }
                                }))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                                  tData.punctuality === preset 
                                    ? 'bg-primary text-white border-primary shadow-2xs' 
                                    : 'bg-surface text-text-muted border-surface-border hover:bg-surface-hover hover:text-text-main'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Custom Teacher Notes */}
                      <input
                        type="text"
                        placeholder={_t('ملاحظة إضافية خاصة بالمدرس...', 'Custom note for teacher...', 'Zusätzliche Anmerkung...')}
                        value={tData.customNotes || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFollowUpTeachersData(prev => ({
                            ...prev,
                            [tId]: { ...prev[tId], customNotes: val }
                          }));
                        }}
                        className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Overall Stage Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-main">
                  {_t('توصيات وملاحظات رئيس القسم العامة للمرحلة:', 'Overall Stage Notes & Recommendations:', 'Gesamtempfehlungen:')}
                </label>
                <textarea
                  rows={3}
                  value={overallStageNotes}
                  onChange={e => setOverallStageNotes(e.target.value)}
                  placeholder={_t('اكتب توصيات عامة لمدير المرحلة المعني...', 'Write general recommendations for the stage manager...', 'Allgemeine Empfehlungen...')}
                  className="w-full p-3 bg-surface-hover border border-surface-border rounded-xl text-[11px] text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 border-t border-surface-border flex items-center justify-end gap-2 bg-surface-hover/30">
              <button
                onClick={() => setIsFollowUpModalOpen(false)}
                className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold rounded-xl transition-all cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={handleSaveFollowUp}
                disabled={isSavingFollowUp}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingFollowUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{_t('حفظ وإرسال التقرير', 'Save & Generate Report', 'Bericht speichern')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GERMAN STUDENT ROSTER */}
      {activeTab === 'students' && (
        <HodStudentsView />
      )}

      {/* TAB 6: ACADEMIC ACTION PLANS & STUDENT TRACKER */}
      {activeTab === 'action_plans' && (
        <ActionPlansView />
      )}

      {/* TAB 7: TWO-WAY COMPLAINTS SYSTEM */}
      {activeTab === 'complaints' && (
        <ComplaintsSystemView />
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlanRecord && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2.5 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-surface-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="p-2.5 border-b border-surface-border flex items-center justify-between bg-surface-hover/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  {editingPlanRecord.gradeBand}
                </span>
                <h3 className="text-[11px] font-bold text-text-main mt-1 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-primary" />
                  <span>{_t('تعديل وتنسيق الخطة الأسبوعية', 'Edit & Format Weekly Plan', 'Wochenplan bearbeiten')} - {getArabicGradeBandLabel(editingPlanRecord.gradeBand)}</span>
                </h3>
              </div>
              <button
                onClick={() => setEditingPlanRecord(null)}
                className="p-1.5 hover:bg-surface-hover rounded-xl text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-2.5 sm:p-3 overflow-y-auto space-y-3 flex-1">
              {/* Meta Inputs: Week Number & Secretary Details */}
              <div className="bg-surface-hover/60 border border-surface-border p-3.5 rounded-xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-surface-border/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{_t('بيانات الخطة وسكرتيرة المرحلة (مربوطة تلقائياً بالإعدادات)', 'Plan Meta & Stage Secretary (Auto-linked to Settings)', 'Metadaten & Stufensekretärin')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const autoSec = getSecretaryForGradeBand(editingPlanRecord.gradeBand, schoolSettings);
                      setEditingPlanRecord({
                        ...editingPlanRecord,
                        secretaryName: autoSec.name,
                        secretaryPhone: autoSec.phone
                      });
                      triggerToast(_t('تمت استعادة بيانات السكرتيرة من إعدادات المدرسة 🔄', 'Restored secretary info from school settings 🔄', 'Aus Schuleinstellungen wiederhergestellt 🔄'));
                    }}
                    className="px-2 py-1 bg-surface hover:bg-primary/10 border border-surface-border hover:border-primary/30 text-primary text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    title={_t('استعادة السكرتيرة المسجلة في إعدادات المدرسة لهذه المرحلة', 'Restore assigned secretary from school settings', 'Aus Einstellungen laden')}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{_t('استعادة من الإعدادات', 'Restore from Settings', 'Aus Einstellungen laden')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      {_t('رقم الأسبوع الدراسي (Woche):', 'Academic Week Number:', 'Schulwoche:')}
                    </label>
                    <select
                      value={editingPlanRecord.weekNumber || selectedPlanWeekNumber}
                      onChange={e => setEditingPlanRecord({ ...editingPlanRecord, weekNumber: Number(e.target.value) })}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-black text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>Woche {num} (Schulwoche {num})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      {_t('اسم السكرتيرة المسؤولة:', 'Secretary Name:', 'Name der Sekretärin:')}
                    </label>
                    {schoolSettings.stageSecretaries && schoolSettings.stageSecretaries.length > 0 ? (
                      <div className="space-y-1">
                        <select
                          value={
                            schoolSettings.stageSecretaries.some((s: any) => cleanSecretaryName(s.name) === cleanSecretaryName(editingPlanRecord.secretaryName))
                              ? schoolSettings.stageSecretaries.find((s: any) => cleanSecretaryName(s.name) === cleanSecretaryName(editingPlanRecord.secretaryName))?.id
                              : 'custom'
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'custom') return;
                            const sec = schoolSettings.stageSecretaries.find((s: any) => s.id === val);
                            if (sec) {
                              setEditingPlanRecord({
                                ...editingPlanRecord,
                                secretaryName: cleanSecretaryName(sec.name),
                                secretaryPhone: sec.phone || ''
                              });
                            }
                          }}
                          className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="" disabled>{_t('— اختر من سكرتيرات المدرسة —', '— Choose from School Secretaries —', '— Sekretärin auswählen —')}</option>
                          {schoolSettings.stageSecretaries.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.phone ? `(${s.phone})` : ''}
                            </option>
                          ))}
                          <option value="custom">{_t('✏️ كتابة اسم مخصص يدوي...', '✏️ Custom manual name...', '✏️ Manuell...')}</option>
                        </select>
                        <input
                          type="text"
                          value={editingPlanRecord.secretaryName || ''}
                          onChange={e => setEditingPlanRecord({ ...editingPlanRecord, secretaryName: e.target.value })}
                          placeholder={_t('اسم السكرتيرة...', 'Secretary name...', 'Name...')}
                          className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editingPlanRecord.secretaryName || ''}
                        onChange={e => setEditingPlanRecord({ ...editingPlanRecord, secretaryName: e.target.value })}
                        placeholder={_t('اسم السكرتيرة...', 'Secretary name...', 'Name...')}
                        className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      {_t('رقم الواتساب (للتواصل المباشر):', 'WhatsApp Phone Number:', 'WhatsApp-Nummer:')}
                    </label>
                    <input
                      type="text"
                      value={editingPlanRecord.secretaryPhone || ''}
                      onChange={e => setEditingPlanRecord({ ...editingPlanRecord, secretaryPhone: e.target.value })}
                      placeholder="010XXXXXXXX"
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-bold focus:outline-none focus:ring-1 focus:ring-primary dir-ltr text-right"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-text-muted flex items-center gap-1">
                  <span>ℹ️ {_t('ملاحظة: يتم سحب بيانات السكرتيرة تلقائياً لكل مرحلة من الإعدادات، ويمكنك تغييرها أو تعديلها هنا إن لزم.', 'Note: Secretary info is auto-populated from School Settings for this stage band.', 'Hinweis: Wird automatisch aus den Schuleinstellungen geladen.')}</span>
                </p>
              </div>

              {/* Grades Content Inputs */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    <span>{_t('تفاصيل المنهج لكل صف دراسي (S.1, S.2, H.A, Quiz / Hinweis)', 'Grade Content Details (S.1, S.2, H.A, Quiz / Hinweis)', 'Klasseninhalte')}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlanRecord({
                          ...editingPlanRecord,
                          gradesContent: getEmptyGradesForBand(editingPlanRecord.gradeBand)
                        });
                        triggerToast(_t('تم تفريغ كافة حقول الخطة 🧹', 'Cleared all fields 🧹', 'Alle Felder geleert 🧹'));
                      }}
                      className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{_t('تفريغ الحقول', 'Clear Fields', 'Felder leeren')}</span>
                    </button>
                    <span className="text-[10px] text-text-muted font-normal bg-surface-hover px-2 py-0.5 rounded border border-surface-border">
                      100% German Text
                    </span>
                  </div>
                </h4>

                {((editingPlanRecord.gradesContent && editingPlanRecord.gradesContent.length > 0)
                  ? sanitizeGradesContent(editingPlanRecord.gradesContent, editingPlanRecord.gradeBand)
                  : getEmptyGradesForBand(editingPlanRecord.gradeBand)
                ).map((grade: any, gIdx: number) => (
                  <div key={gIdx} className="bg-surface border border-surface-border p-2.5 rounded-xl space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-surface-border pb-2">
                      <span className="text-[11px] font-black text-text-main flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        {getGermanGradeName(grade.gradeName, editingPlanRecord.gradeBand, gIdx)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                          const updatedGrades = [...currentGrades];
                          updatedGrades[gIdx] = {
                            gradeName: grade.gradeName,
                            s1: '',
                            s2: '',
                            ha: '',
                            quiz: ''
                          };
                          setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                        }}
                        className="text-[10px] text-text-muted hover:text-rose-600 font-bold cursor-pointer"
                      >
                        {_t('تفريغ هذا الصف', 'Clear grade', 'Leeren')}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {/* 1. S. 1 (Schülerbuch / Teil 1) Dropdown + Optional Page Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-blue-600 block">
                          • S. 1 (Schülerbuch / Teil 1):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <select
                            value={S1_S2_DROPDOWN_OPTIONS.includes(grade.s1) ? grade.s1 : ''}
                            onChange={e => {
                              const selectedOpt = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], s1: selectedOpt };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="">{_t('— اختياري / صفحة —', '— Custom Page —', '— Manuell / Seite —')}</option>
                            {S1_S2_DROPDOWN_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={grade.s1 || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], s1: val };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            placeholder={_t('رقم الصفحات (مثال: S. 4-6)', 'e.g. S. 4-6', 'z.B. S. 4-6')}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* 2. S. 2 (Schülerbuch / Teil 2) Dropdown + Optional Page Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-indigo-600 block">
                          • S. 2 (Schülerbuch / Teil 2):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <select
                            value={S1_S2_DROPDOWN_OPTIONS.includes(grade.s2) ? grade.s2 : ''}
                            onChange={e => {
                              const selectedOpt = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], s2: selectedOpt };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="">{_t('— اختياري / صفحة —', '— Custom Page —', '— Manuell / Seite —')}</option>
                            {S1_S2_DROPDOWN_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={grade.s2 || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], s2: val };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            placeholder={_t('رقم الصفحات (مثال: S. 7-9)', 'e.g. S. 7-9', 'z.B. S. 7-9')}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* 3. H.A (Hausaufgabe) Dropdown + Optional Page Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-emerald-600 block">
                          • H.A (Hausaufgabe):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <select
                            value={HA_DROPDOWN_OPTIONS.includes(grade.ha) ? grade.ha : ''}
                            onChange={e => {
                              const selectedOpt = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], ha: selectedOpt };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="">{_t('— اختياري / يدوي —', '— Custom / Workbook —', '— Manuell / Arbeitsbuch —')}</option>
                            {HA_DROPDOWN_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={grade.ha || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], ha: val };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            placeholder={_t('الواجب (مثال: Arbeitsbuch S. 4-5)', 'e.g. Arbeitsbuch S. 4-5', 'z.B. Arbeitsbuch S. 4-5')}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* 4. Quiz / Hinweis (Optional Note/Quiz) Dropdown + Custom Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-purple-600 block">
                          • Quiz / Hinweis (Optional Note/Quiz):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <select
                            value={QUIZ_HINWEIS_DROPDOWN_OPTIONS.includes(grade.quiz) ? grade.quiz : ''}
                            onChange={e => {
                              const selectedOpt = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], quiz: selectedOpt };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="">{_t('— بدون اختبار / يدوي —', '— None / Custom Note —', '— Ohne / Manuell —')}</option>
                            {QUIZ_HINWEIS_DROPDOWN_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={grade.quiz || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const currentGrades = editingPlanRecord.gradesContent || getEmptyGradesForBand(editingPlanRecord.gradeBand);
                              const updatedGrades = [...currentGrades];
                              updatedGrades[gIdx] = { ...updatedGrades[gIdx], quiz: val };
                              setEditingPlanRecord({ ...editingPlanRecord, gradesContent: updatedGrades });
                            }}
                            placeholder={_t('ملاحظة أو اختبار (مثال: Quiz 1)...', 'Custom quiz or note...', 'z.B. Quiz 1...')}
                            className="w-full px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Formatted WhatsApp Text Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>{_t('معاينة الرسالة المنسقة للواتساب (100% German Live Preview):', 'WhatsApp German Live Preview:', 'WhatsApp Vorschau (Deutsch):')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = generateWeeklyPlanMessage(
                        editingPlanRecord,
                        editingPlanRecord.weekNumber || selectedPlanWeekNumber,
                        editingPlanRecord.secretaryName,
                        schoolSettings.hodName
                      );
                      navigator.clipboard.writeText(msg);
                      triggerToast(_t('تم نسخ النص الألماني المنسق 📋', 'Copied German preview 📋', 'Kopiert 📋'));
                    }}
                    className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{_t('نسخ المعاينة', 'Copy Preview', 'Kopieren')}</span>
                  </button>
                </div>

                <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-xl text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto border border-slate-800 shadow-inner dir-ltr text-left">
                  {generateWeeklyPlanMessage(
                    editingPlanRecord,
                    editingPlanRecord.weekNumber || selectedPlanWeekNumber,
                    editingPlanRecord.secretaryName,
                    schoolSettings.hodName
                  )}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 border-t border-surface-border flex items-center justify-end gap-2 bg-surface-hover/30">
              <button
                onClick={() => setEditingPlanRecord(null)}
                className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold rounded-xl transition-all cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={() => handleSaveEditedPlan(editingPlanRecord)}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{_t('حفظ وتنسيق الخطة', 'Save & Apply Plan', 'Plan speichern')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER ATTENDANCE LOG MODAL (Requirements 1, 2) */}
      {isAttendanceModalOpen && (
        <TeacherAttendanceModal
          isOpen={isAttendanceModalOpen}
          onClose={() => {
            setIsAttendanceModalOpen(false);
            setSelectedTeacherForAttendance(null);
            setEditingAttendanceRecord(null);
          }}
          onSave={(data) => {
            handleSaveAttendanceRecord(data);
          }}
          initialTeacher={selectedTeacherForAttendance}
          teachers={teachers}
          availableTeachers={teachers}
          schoolSettings={schoolSettings}
          stageManagers={schoolSettings.stageManagers || []}
          editingRecord={editingAttendanceRecord}
          _t={_t}
          isRtl={language === 'ar'}
        />
      )}

      {/* DETAILED STAFF ATTENDANCE & DISCIPLINE REPORT MODAL (Requirements 1, 3, 4) */}
      {isDetailedAttendanceModalOpen && (
        <DetailedStaffAttendanceModal
          isOpen={isDetailedAttendanceModalOpen}
          onClose={() => setIsDetailedAttendanceModalOpen(false)}
          attendanceRecords={staffAttendanceRecords}
          records={staffAttendanceRecords}
          teachers={teachers}
          schoolSettings={schoolSettings}
          onOpenNewRecordModal={(teacherId) => {
            const t = teachers.find(item => item.id === teacherId);
            setSelectedTeacherForAttendance(t || null);
            setEditingAttendanceRecord(null);
            setIsAttendanceModalOpen(true);
          }}
          onAddRecord={(teacher) => {
            setSelectedTeacherForAttendance(teacher || null);
            setEditingAttendanceRecord(null);
            setIsAttendanceModalOpen(true);
          }}
          onEditRecord={(record) => {
            setEditingAttendanceRecord(record);
            setSelectedTeacherForAttendance(null);
            setIsAttendanceModalOpen(true);
          }}
          onDeleteRecord={(recordId) => {
            handleDeleteAttendanceRecord(recordId);
          }}
          _t={_t}
          language={language}
        />
      )}

      {/* CUSTOM TIMED SESSION MODAL */}
      {isCustomSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-surface-border flex items-center justify-between bg-surface-hover/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-text-main">
                    {editingCustomSession
                      ? _t('تعديل الحصة المخصصة', 'Edit Custom Session', 'Spezielle Stunde bearbeiten')
                      : _t('إضافة حصة بتوقيت مخصص حر', 'Add Custom Timed Session', 'Spezielle Stunde hinzufügen')}
                  </h3>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {_t('حصة مستقلة بوقت حر (من - إلى) واسم الفصل والمادة', 'Independent class with custom time range and room', 'Eigene Start- und Endzeit festlegen')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustomSessionModalOpen(false);
                  setEditingCustomSession(null);
                }}
                className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCustomSession} className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1 scrollbar-thin">
              {/* Teacher & Day Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('المعلم المسؤول', 'Assigned Teacher', 'Zuständiger Lehrer')}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={customTeacherId}
                    onChange={(e) => setCustomTeacherId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    required
                  >
                    <option value="hod">{schoolSettings.hodName || _t('رئيس القسم (HOD)', 'Head of Department (HOD)', 'Fachleiter')}</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('اليوم', 'Day', 'Tag')}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={customDayKey}
                    onChange={(e) => setCustomDayKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    required
                  >
                    {['0', '1', '2', '3', '4', '5', '6'].map(d => (
                      <option key={d} value={d}>{WEEKDAY_NAMES[d as keyof typeof WEEKDAY_NAMES]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class / Group Name & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('اسم الفصل أو المجموعة', 'Class / Group Name', 'Klasse / Gruppe')}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customClassName}
                    onChange={(e) => setCustomClassName(e.target.value)}
                    placeholder={_t('مثال: 10/1 أو مجموعة تقوية أ', 'e.g., 10/1 or Study Group A', 'z.B. 10/1')}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('المادة / المحتوى', 'Subject / Content', 'Fach / Inhalt')}</span>
                  </label>
                  <input
                    type="text"
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    placeholder={_t('مثال: Deutsch, Förderkurs, محادثة', 'e.g. Deutsch, Remedial', 'z.B. Deutsch')}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Time from / to */}
              <div className="p-3 bg-surface-hover/60 border border-surface-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('التوقيت (من كام لكام)', 'Session Timing (Start - End)', 'Uhrzeit (Von - Bis)')}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {customStartTime && customEndTime && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md">
                      {(() => {
                        const s = parseTimeToMinutes(customStartTime);
                        const e = parseTimeToMinutes(customEndTime);
                        return e > s ? `${e - s} ${_t('دقيقة', 'min', 'Min')}` : '';
                      })()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-text-muted block">{_t('من الساعة:', 'From (Start):', 'Von:')}</span>
                    <input
                      type="time"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-xl text-[11px] font-mono font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-text-muted block">{_t('إلى الساعة:', 'To (End):', 'Bis:')}</span>
                    <input
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-xl text-[11px] font-mono font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Quick Preset Times */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[9px] font-bold text-text-muted">{_t('أوقات شائعة:', 'Presets:', 'Vorlagen:')}</span>
                  {[
                    { label: '14:30 - 16:00', start: '14:30', end: '16:00' },
                    { label: '14:00 - 15:30', start: '14:00', end: '15:30' },
                    { label: '15:00 - 16:30', start: '15:00', end: '16:30' },
                    { label: '16:00 - 17:30', start: '16:00', end: '17:30' }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setCustomStartTime(p.start);
                        setCustomEndTime(p.end);
                      }}
                      className="px-1.5 py-0.5 bg-surface text-text-muted hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-700 border border-surface-border rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Type / Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{_t('نوع الحصة / التصنيف', 'Session Type / Tag', 'Kategorie')}</span>
                </label>
                <div className="flex flex-wrap gap-1">
                  {[
                    'حصة إضافية / تقوية',
                    'نشاط لغوي / محادثة',
                    'حصة خاصة',
                    'تدريب إثرائي / أولمبياد',
                    'مراجعة عامة',
                    'أخرى'
                  ].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCustomSessionType(type)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                        customSessionType === type
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-surface text-text-muted border-surface-border hover:bg-surface-hover hover:text-text-main'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room & Location + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('المكان أو القاعة (اختياري)', 'Room / Location', 'Raum')}</span>
                  </label>
                  <input
                    type="text"
                    value={customRoom}
                    onChange={(e) => setCustomRoom(e.target.value)}
                    placeholder={_t('مثال: معمل اللغات / قاعة 12', 'e.g., Language Lab / Room 12', 'z.B. Raum 12')}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('ملاحظات إضافية (اختياري)', 'Notes', 'Notizen')}</span>
                  </label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder={_t('ملاحظات للمعلم أو المتابعة...', 'Extra notes...', 'Notizen...')}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-2">
                <div>
                  {editingCustomSession && (
                    <button
                      type="button"
                      onClick={() => {
                        if (editingCustomSession) {
                          handleDeleteCustomSession(editingCustomSession.id);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{_t('حذف الحصة', 'Delete', 'Löschen')}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomSessionModalOpen(false);
                      setEditingCustomSession(null);
                    }}
                    className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {_t('إلغاء', 'Cancel', 'Abbrechen')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>{_t('حفظ الحصة', 'Save Session', 'Speichern')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};