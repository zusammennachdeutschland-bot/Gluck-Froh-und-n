import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Calendar, BookOpen, FileText, CheckCircle2, AlertTriangle, Clock, Plus, Trash2, Edit3, Send, Sparkles, Printer, Check, X, Shield, FileCheck, Layers, ChevronRight, RefreshCw, RotateCcw, Upload, Phone, MessageCircle, Copy, MapPin, Eye, Target, ClipboardList, Award, BarChart3, Download, Loader2, GraduationCap } from 'lucide-react';
import { calculatePeriodsTimings } from '../utils/schoolUtils';
import { 
  printObservationReport, 
  downloadObservationReportPdf, 
  shareObservationReportViaWhatsApp,
  downloadStageFollowUpPdf,
  shareStageFollowUpViaWhatsApp,
  printStageFollowUpReport
} from '../utils/printObservationUtils';
import { StageFollowUpRecord, TeacherStageEvaluationItem } from '../types';
import { SchoolScheduleExportModal } from './SchoolScheduleExportModal';
import { ObservationFormModal } from './ObservationFormModal';
import { HodStudentsView } from './HodStudentsView';
import { ComplaintsSystemView } from './ComplaintsSystemView';
import { ActionPlansView } from './ActionPlansView';
import { StageCommunicationView } from './StageCommunicationView';

export const HodHubView: React.FC = () => {
  const { profile, updateProfile, groups, students, lessons, language, _t, t } = useApp();
  const schoolSettings = profile?.schoolSettings || {} as any;

  const [activeTab, setActiveTab] = useState<'overview' | 'timetables' | 'stage_managers' | 'plans' | 'action_plans' | 'staff' | 'students' | 'complaints'>('overview');
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [activeLoadingAction, setActiveLoadingAction] = useState<{ id: string; type: 'download' | 'share' } | null>(null);

  const handleDownloadPdf = async (v: any) => {
    if (!v || activeLoadingAction) return;
    setActiveLoadingAction({ id: v.id, type: 'download' });
    try {
      await downloadObservationReportPdf(v, schoolSettings, (language === 'ar'), language);
    } catch (err) {
      console.error('Download PDF error:', err);
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
      
      const [storedStudents, storedComplaints, storedPlans, storedVisits, teacherStudents] = await Promise.all([
        storage.getItem<any[]>('hod_german_students'),
        storage.getItem<any[]>('hod_complaints'),
        storage.getItem<any[]>('hod_student_action_plans'),
        storage.getItem<any[]>('hod_visit_records'),
        storage.getItem<any[]>('dl_students')
      ]);

      // Calculate true KPIs
      const kpiData = {
        visitsCount: storedVisits ? storedVisits.length : visitRecords.length,
        activePlansCount: storedPlans ? storedPlans.length : activePlans.length,
        pendingComplaintsCount: storedComplaints ? storedComplaints.filter(c => c.status !== 'resolved').length : parentComplaints.filter(c => c.status !== 'resolved').length
      };

      // Calculate exact true student counts by grade
      // Fallback to teacher's generic students if the HOD-specific table is empty
      const realStudents = (storedStudents && storedStudents.length > 0) ? storedStudents : (teacherStudents || []);
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

  // AI Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importScope, setImportScope] = useState<'all' | 'single'>('all');
  const [selectedTeacherForImport, setSelectedTeacherForImport] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showClearScheduleConfirm, setShowClearScheduleConfirm] = useState(false);
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
  const [selectedCellDetails, setSelectedCellDetails] = useState<{
    teacherName: string;
    className: string;
    subjectName?: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    dayKey: string;
    room?: string;
  } | null>(null);

  const timings = calculatePeriodsTimings(schoolSettings.periodSettings || {
    periodsCount: 8,
    firstPeriodStart: '07:30',
    defaultDuration: 45
  });

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
  };

  const parseTimeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };

  const getLessonForTeacher = (teacherId: string, dayKey: string, periodNum: number) => {
    const schedules = teacherId === 'hod' 
      ? schoolSettings.schedule 
      : schoolSettings.teacherSchedules?.[teacherId];
    const daySchedule = schedules?.[dayKey] || [];
    return daySchedule.find((l: any) => l.periodNumber === periodNum && (l.className || l.subjectName));
  };

  const getTeacherTodaySchedule = (teacherId: string) => {
    const todayKey = new Date().getDay().toString();
    const schedules = teacherId === 'hod' 
      ? schoolSettings.schedule 
      : schoolSettings.teacherSchedules?.[teacherId];
    const daySchedule = schedules?.[todayKey] || [];
    return daySchedule.filter((l: any) => l.className || l.subjectName).sort((a: any, b: any) => a.periodNumber - b.periodNumber);
  };

  const getTeacherStatus = (teacherId: string) => {
    const todayKey = new Date().getDay().toString();
    const schedules = teacherId === 'hod' 
      ? schoolSettings.schedule 
      : schoolSettings.teacherSchedules?.[teacherId];
    
    const todaySchedule = schedules?.[todayKey] || [];
    const activeLessons = todaySchedule.filter((l: any) => l.subjectName || l.className);

    if (activeLessons.length === 0) return { status: 'no_class' };

    const timings = calculatePeriodsTimings(schoolSettings.periodSettings);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let currentPeriod = timings.find(p => {
      const start = parseTimeToMinutes(p.startTime);
      const end = parseTimeToMinutes(p.endTime);
      return currentMinutes >= start && currentMinutes <= end;
    });

    const lastLessonPeriod = Math.max(...activeLessons.map((l: any) => l.periodNumber));
    const lastTiming = timings.find((t: any) => t.periodNumber === lastLessonPeriod);
    
    if (lastTiming && currentMinutes > parseTimeToMinutes(lastTiming.endTime)) {
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
    setIsImportModalOpen(false);
    setValidationResult(null);
    setImportText('');
    triggerToast(_t('تم مسح جميع جداول القسم بنجاح', 'All department timetables cleared successfully', 'Alle Stundenpläne der Abteilung erfolgreich gelöscht'));
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
    if (formattedSecName) {
      text += `🌹 *Vielen Dank für Ihre Unterstützung, Frau ${formattedSecName}*\n\n`;
    } else {
      text += `🌹 *Vielen Dank für Ihre Unterstützung*\n\n`;
    }
    if (formattedHodName) {
      text += `✍️ *Mit freundlichen Grüßen, Herr ${formattedHodName} (Fachleiter für Deutsch)*`;
    } else {
      text += `✍️ *Mit freundlichen Grüßen (Fachleiter für Deutsch)*`;
    }

    return text;
  };

  // State for Weekly Plans
  const gradeBands = ['Grades 1–3', 'Grades 4–6', 'Grades 7–9', 'Grades 10–12'];
  const [selectedPlanWeekNumber, setSelectedPlanWeekNumber] = useState<number>(1);
  const [editingPlanRecord, setEditingPlanRecord] = useState<any | null>(null);

  const createDefaultPlanForBandAndWeek = (band: string, weekNum: number) => {
    let secIdx = 0;
    if (band.includes('4–6') || band.includes('4-6')) secIdx = 1;
    else if (band.includes('7–9') || band.includes('7-9')) secIdx = 2;
    else if (band.includes('10–12') || band.includes('10-12')) secIdx = 3;

    const secObj = schoolSettings.stageSecretaries?.[secIdx];

    return {
      id: `${band}_w${weekNum}`,
      gradeBand: band,
      status: 'not_sent', // Strictly NOT_SENT by default
      sentAt: undefined,
      secretaryName: secObj?.name || '',
      secretaryPhone: secObj?.phone || '',
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
      return {
        ...existing,
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
    try {
      await downloadStageFollowUpPdf(record, schoolSettings, (language === 'ar'), language);
    } catch (err) {
      console.error('Download error:', err);
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
    const text = generateWeeklyPlanMessage(plan, weekNum, plan.secretaryName, schoolSettings.hodName);
    navigator.clipboard.writeText(text);
    triggerToast(_t('تم نسخ الخطة الأسبوعية بنسق الواتساب 📋', 'Plan copied to clipboard 📋', 'In Zwischenablage kopiert 📋'));
  };

  const handleSharePlanWhatsApp = (targetPlan: any) => {
    if (!targetPlan) return;
    const weekNum = targetPlan.weekNumber || selectedPlanWeekNumber;
    const band = targetPlan.gradeBand;
    const text = generateWeeklyPlanMessage(targetPlan, weekNum, targetPlan.secretaryName, schoolSettings.hodName);
    const cleanPhone = (targetPlan.secretaryPhone || '').replace(/[^0-9]/g, '');
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

  const handlePrintWeeklyPlan = (plan: any) => {
    const weekNum = plan.weekNumber || selectedPlanWeekNumber;
    const secName = cleanSecretaryName(plan.secretaryName);
    const hodName = cleanHodName(schoolSettings.hodName);
    const grades = (plan.gradesContent && plan.gradesContent.length > 0)
      ? plan.gradesContent
      : getEmptyGradesForBand(plan.gradeBand);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html dir="ltr" lang="de">
      <head>
        <meta charset="utf-8">
        <title>Wochenplan - Deutschabteilung - Woche ${weekNum}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; direction: ltr; background: #fff; }
          .header { text-align: center; border-bottom: 2.5px solid #0284c7; padding-bottom: 10px; margin-bottom: 14px; }
          .header h1 { margin: 0; font-size: 17pt; color: #0369a1; font-weight: bold; }
          .header p { margin: 4px 0 0; font-size: 11pt; color: #475569; font-weight: bold; }
          .meta-bar { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #f0f9ff; border: 1px solid #bae6fd; padding: 8px 12px; border-radius: 8px; margin-bottom: 16px; font-weight: bold; font-size: 9.5pt; text-align: center; }
          .grade-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; background: #fff; }
          .grade-title { font-size: 11.5pt; font-weight: bold; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
          .item-row { display: flex; margin-bottom: 5px; font-size: 9.5pt; line-height: 1.3; }
          .item-label { font-weight: bold; width: 140px; color: #334155; shrink: 0; }
          .item-value { flex: 1; color: #0f172a; font-weight: 500; }
          .appreciation { background: #fefce8; border: 1px solid #fef08a; padding: 10px 14px; border-radius: 8px; color: #854d0e; font-weight: bold; font-size: 10pt; margin-top: 16px; margin-bottom: 16px; text-align: center; }
          .footer { border-top: 1.5px solid #cbd5e1; padding-top: 10px; font-size: 9.5pt; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; }
        </style>
      </head>
      <body onload="window.print(); window.onafterprint = function(){ window.close(); }">
        <div class="header">
          <h1>📌 Wochenplan - Deutschabteilung</h1>
          <p>${getGermanGradeBandLabel(plan.gradeBand)}</p>
        </div>

        <div class="meta-bar">
          <span>🗓️ Schulwoche: Woche ${weekNum}</span>
          <span>👩‍💼 Sekretärin: Frau ${secName}</span>
          <span>👨‍🏫 Fachleiter: Herr ${hodName}</span>
        </div>

        ${grades.map((g: any, idx: number) => {
          const note = g.quiz || g.hinweis;
          return `
          <div class="grade-card">
            <div class="grade-title">📚 ${getGermanGradeName(g.gradeName, plan.gradeBand, idx)}</div>
            <div class="item-row">
              <span class="item-label">S.1:</span>
              <span class="item-value">${g.s1 || 'Wiederholung'}</span>
            </div>
            <div class="item-row">
              <span class="item-label">S.2:</span>
              <span class="item-value">${g.s2 || 'Aktivität'}</span>
            </div>
            <div class="item-row">
              <span class="item-label">H.A:</span>
              <span class="item-value">${g.ha || 'Keine Hausaufgaben'}</span>
            </div>
            ${note && note !== 'Kein Quiz / Hinweis' && note !== 'Kein Quiz' ? `
              <div class="item-row">
                <span class="item-label">Quiz / Hinweis:</span>
                <span class="item-value">${note}</span>
              </div>
            ` : ''}
          </div>
        `}).join('')}

        <div class="appreciation">
          🌹 Vielen Dank für Ihre Unterstützung, Frau ${secName}
        </div>

        <div class="footer">
          <div>
            <strong>Deutschabteilung / Department of German</strong>
          </div>
          <div style="text-align: right; font-weight: bold;">
            Mit freundlichen Grüßen,<br/>
            Herr ${hodName} (Fachleiter für Deutsch)
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
      <div className="flex w-full items-center justify-between sm:justify-center gap-1 bg-surface p-1 rounded-xl border border-surface-border shadow-2xs overflow-hidden">
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
              className={`h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
                isActive 
                  ? `${tab.activeClass} px-2.5 sm:px-3 gap-1.5 shadow-xs font-black shrink-0` 
                  : 'w-8 sm:w-9 text-text-muted hover:bg-surface-hover hover:text-text-main shrink-0'
              }`}
              title={tab.title}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {isActive && <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden">{tab.title}</span>}
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
              className="bg-surface border border-surface-border p-3 rounded-xl shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-500 transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-text-main">{liveKpis?.activePlansCount ?? activePlans.length}</span>
              <span className="text-[10px] font-bold text-text-muted">{_t('خطط الدعم النشطة', 'Active Plans', 'Aktive Pläne')}</span>
            </div>

            <div 
              onClick={() => setActiveTab('complaints')}
              className="bg-surface border border-surface-border p-3 rounded-xl shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer hover:border-rose-500 transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-1">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-text-main">{liveKpis?.pendingComplaintsCount ?? parentComplaints.filter(c => c.status !== 'resolved').length}</span>
              <span className="text-[10px] font-bold text-text-muted">{_t('شكاوى معلقة', 'Pending Issues', 'Beschwerden')}</span>
            </div>
          </div>

          {/* 2. Live Daily Section Schedule Bar */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
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
                  <div key={stage.id} className="bg-surface-hover p-3 rounded-xl border border-surface-border space-y-2">
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
                      <th key={p.periodNumber} className="p-2 border border-surface-border text-center w-12">
                        P{p.periodNumber}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id} className="border border-surface-border hover:bg-surface-hover/30">
                      <td className="p-2 border border-surface-border font-bold text-text-main">
                        {t.name}
                      </td>
                      {timings.map(p => {
                        const todayKey = new Date().getDay().toString();
                        const lesson = getLessonForTeacher(t.id, todayKey, p.periodNumber);
                        return (
                          <td key={p.periodNumber} className="p-2 border border-surface-border text-center">
                            {lesson ? (
                              <span className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary font-black rounded text-[10px]">
                                {lesson.className}
                              </span>
                            ) : (
                              <span className="text-text-muted/30">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex-1 sm:flex-none px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{_t('طباعة / تصدير', 'Print / Export', 'Drucken / Export')}</span>
              </button>
              <button
                onClick={() => {
                  setImportScope('all');
                  setSelectedTeacherForImport('');
                  setValidationResult(null);
                  setIsImportModalOpen(true);
                }}
                className="flex-1 sm:flex-none px-2 py-1 bg-primary-soft text-primary hover:bg-primary-soft/80 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
              <div className="p-3 border-b border-surface-border bg-surface-hover/20">
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
              </div>
            )}

            <div className={`overflow-y-auto max-h-[60vh] scrollbar-thin ${matrixViewMode === 'grid' ? 'w-full overflow-hidden' : ''}`}>
              {matrixViewMode === 'grid' ? (
                <table className="w-full text-left border-collapse table-fixed text-[11px]">
                  <thead className="sticky top-0 z-20 bg-surface-hover shadow-sm">
                    <tr>
                      <th className="p-1 border-b border-surface-border font-bold text-text-muted w-10 sm:w-16 text-center align-middle">
                        {_t('ي/ح', 'D/P', 'T/S')}
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
                    {(['0','1','2','3','4'].filter(d => matrixDayFilter === 'all' || d === matrixDayFilter)).map((dayKey) => (
                      <React.Fragment key={dayKey}>
                        <tr>
                          <td colSpan={teachers.length + 1} className="bg-primary/5 dark:bg-primary/10 py-1.5 px-2 font-black text-primary text-center border-y border-surface-border text-[11px] sm:text-[11px]">
                            {WEEKDAY_NAMES[dayKey as keyof typeof WEEKDAY_NAMES]}
                          </td>
                        </tr>
                        {timings.map(period => (
                          <tr key={`${dayKey}-${period.periodNumber}`} className="hover:bg-surface-hover/50 group">
                            <td className="p-0.5 sm:p-1 border-b border-surface-border font-bold text-text-muted text-center align-middle bg-surface group-hover:bg-surface-hover">
                              <div className="flex flex-col items-center justify-center">
                                <span className="text-text-main text-[10px] sm:text-[11px]">{period.periodNumber}</span>
                                <span className="text-[7px] sm:text-[9px] text-text-muted/70 font-mono tracking-tighter hidden sm:block">{period.startTime}</span>
                              </div>
                            </td>
                            {teachers.map(t => {
                              const lesson = getLessonForTeacher(t.id, dayKey, period.periodNumber);
                              return (
                                <td 
                                  key={t.id} 
                                  onClick={() => {
                                    if (lesson) {
                                      setSelectedCellDetails({
                                        teacherName: t.name,
                                        className: lesson.className,
                                        subjectName: lesson.subjectName,
                                        periodNumber: period.periodNumber,
                                        startTime: period.startTime,
                                        endTime: period.endTime,
                                        dayKey,
                                        room: lesson.roomName
                                      });
                                    }
                                  }}
                                  className={`p-0.5 sm:p-1 border-b border-l border-surface-border text-center h-full align-middle overflow-hidden ${lesson ? 'cursor-pointer hover:bg-primary-soft/30 transition-colors' : ''}`}
                                >
                                  {lesson ? (
                                    <div className="flex flex-col items-center justify-center bg-primary/10 border border-primary/20 rounded-[4px] py-1 px-0.5 sm:px-1 w-full overflow-hidden">
                                      <span className="font-bold text-text-main text-[9px] sm:text-[11px] leading-none truncate w-full">{lesson.className}</span>
                                    </div>
                                  ) : (
                                    <span className="text-text-muted/20 text-[11px] sm:text-[11px] leading-none">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
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
                      const dayLessons = timings.map(p => getLessonForTeacher(selectedSingleTeacher, dayKey, p.periodNumber)).filter(Boolean);
                      if (dayLessons.length === 0) return null;
                      
                      return (
                        <div key={dayKey} className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-2xs">
                          <div className="bg-surface-hover px-2 py-1 border-b border-surface-border font-black text-text-main text-[11px]">
                            {WEEKDAY_NAMES[dayKey as keyof typeof WEEKDAY_NAMES]}
                          </div>
                          <div className="divide-y divide-surface-border/50">
                            {timings.map(period => {
                              const lesson = getLessonForTeacher(selectedSingleTeacher, dayKey, period.periodNumber);
                              if (!lesson) return null;
                              
                              return (
                                <div 
                                  key={period.periodNumber} 
                                  className="p-3 flex items-center justify-between hover:bg-surface-hover/30 cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedCellDetails({
                                      teacherName: teachers.find(t => t.id === selectedSingleTeacher)?.name || '',
                                      className: lesson.className,
                                      subjectName: lesson.subjectName,
                                      periodNumber: period.periodNumber,
                                      startTime: period.startTime,
                                      endTime: period.endTime,
                                      dayKey,
                                      room: lesson.roomName
                                    });
                                  }}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex flex-col items-center justify-center w-10 h-10 bg-primary-soft text-primary rounded-xl shrink-0">
                                      <span className="font-bold text-[11px]">{_t(`ح${period.periodNumber}`, `P${period.periodNumber}`, `S${period.periodNumber}`)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-text-main text-[11px]">{lesson.className}</span>
                                      <span className="text-[10px] text-text-muted font-mono">{period.startTime} - {period.endTime}</span>
                                    </div>
                                  </div>
                                  {lesson.subjectName && (
                                    <span className="text-[10px] font-bold px-2 py-1 bg-surface-hover text-text-muted rounded-lg border border-surface-border text-right max-w-[100px] truncate">
                                      {lesson.subjectName}
                                    </span>
                                  )}
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
                          <span className="text-[10px] font-bold text-text-main px-1">{statusObj.class}</span>
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
                const todaySchedule = getTeacherTodaySchedule(t.id);
                if (!todaySchedule || todaySchedule.length === 0) return null;
                
                return (
                  <div key={t.id} className="bg-surface-hover border border-surface-border rounded-xl p-3 space-y-2">
                    <h4 className="text-[11px] font-bold text-text-main flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {t.name}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {todaySchedule.map((lesson: any) => (
                        <div key={lesson.periodNumber} className="bg-surface border border-surface-border px-2 py-1.5 rounded-lg flex items-center gap-2 text-[10px] shadow-sm">
                          <span className="font-bold text-primary shrink-0">ح{lesson.periodNumber}</span>
                          <span className="font-bold text-text-main">{lesson.className}</span>
                          {lesson.subjectName && <span className="text-text-muted truncate max-w-[80px]">({lesson.subjectName})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {teachers.every(t => !getTeacherTodaySchedule(t.id) || getTeacherTodaySchedule(t.id).length === 0) && (
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
                  onClick={() => {
                    const allTexts = currentWeekPlans.map(p => generateWeeklyPlanMessage(p, selectedPlanWeekNumber, p.secretaryName, schoolSettings.hodName)).join('\n\n══════════════════════════════════\n\n');
                    navigator.clipboard.writeText(allTexts);
                    triggerToast(_t('تم نسخ جميع الخطط الأسبوعية بنسق الواتساب 📋', 'Copied all plans 📋', 'Alle Pläne kopiert 📋'));
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
                        onClick={() => setEditingPlanRecord(plan)}
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
                        onClick={() => handlePrintWeeklyPlan(plan)}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                        title={_t('طباعة الخطة كأنها مستند محضر', 'Print formal plan', 'Drucken')}
                      >
                        <Printer className="w-3.5 h-3.5 text-sky-500" />
                        <span>{_t('طباعة', 'Print', 'Drucken')}</span>
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
        teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase())).forEach(teacher => {
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
                <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
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
                          <div className="flex items-center gap-1.5">
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
                          </div>
                          
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <h4 className="text-[11px] font-bold text-text-main uppercase tracking-wider">
                        {_t('سجل الزيارات الصفية', 'Classroom Visits History', 'Besuchsverlauf')}
                      </h4>
                    </div>
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

                    return (
                      <div className="space-y-2">
                        {teacherVisitsList.map(v => (
                          <div key={v.id} className="p-3 bg-surface-hover border border-surface-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:border-primary/30 transition-all">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h5 className="text-[11px] font-bold text-text-main truncate">{_t('الفصل:', 'Class:', 'Klasse:')} {v.className}</h5>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md border border-primary/20 bg-primary/5 text-primary">
                                  {v.overallScore || '-'}/75
                                </span>
                                {v.overallCategory && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface border border-surface-border text-text-muted">
                                    {v.overallCategory}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-text-muted flex items-center gap-1.5">
                                <span>{new Date(v.visitedDate || v.date || Date.now()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                <span>•</span>
                                <span>{_t('الحصة', 'Period', 'Stunde')} {v.periodNumber || '-'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto flex-wrap">
                              <button
                                onClick={() => setPreviewVisitRecord(v)}
                                className="h-9 px-3 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                title={_t('معاينة التقرير', 'Preview Report', 'Bericht anzeigen')}
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                                <span>{_t('معاينة', 'Preview', 'Vorschau')}</span>
                              </button>
                              <button
                                onClick={() => handleShareWhatsApp(v)}
                                disabled={!!activeLoadingAction}
                                className="h-9 px-3 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:border-emerald-800 rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60 disabled:pointer-events-none"
                                title={_t('مشاركة عبر واتساب', 'Share via WhatsApp', 'Über WhatsApp teilen')}
                              >
                                {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'share' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                )}
                                <span>
                                  {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'share'
                                    ? _t('جاري المشاركة...', 'Sharing...', 'Wird geteilt...')
                                    : _t('واتساب', 'WhatsApp', 'WhatsApp')}
                                </span>
                              </button>
                              <button
                                onClick={() => handleDownloadPdf(v)}
                                disabled={!!activeLoadingAction}
                                className="h-9 px-3 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 dark:text-sky-300 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 dark:border-sky-800 rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60 disabled:pointer-events-none"
                                title={_t('تحميل ملف PDF', 'Download PDF File', 'PDF herunterladen')}
                              >
                                {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'download' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-400" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                )}
                                <span>
                                  {activeLoadingAction?.id === v.id && activeLoadingAction?.type === 'download'
                                    ? _t('جاري التحميل...', 'Generating PDF...', 'Wird geladen...')
                                    : _t('تحميل PDF', 'Download PDF', 'PDF herunterladen')}
                                </span>
                              </button>
                              <button
                                onClick={() => printObservationReport(v, schoolSettings, (language === 'ar'), language)}
                                className="h-9 px-3 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:border-indigo-800 rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                title={_t('طباعة التقرير', 'Print Report', 'Drucken')}
                              >
                                <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>{_t('طباعة', 'Print', 'Drucken')}</span>
                              </button>
                            </div>
                          </div>
                        ))}
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

            {/* Clear All Department Schedules Footer */}
            <div className="pt-3 mt-1 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-2.5">
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
          </div>
        </div>
      )}

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-surface-hover/60 border border-surface-border p-3.5 rounded-xl">
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
                  <input
                    type="text"
                    value={editingPlanRecord.secretaryName || ''}
                    onChange={e => setEditingPlanRecord({ ...editingPlanRecord, secretaryName: e.target.value })}
                    placeholder={_t('اسم السكرتيرة...', 'Secretary name...', 'Name...')}
                    className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] text-text-main font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
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
    </div>
  );
};