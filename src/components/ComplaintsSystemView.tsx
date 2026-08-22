import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, Plus, Search, Filter, Printer, CheckCircle2, 
  Send, UserX, UserCheck, Calendar, BookOpen, Shield, Trash2, 
  Edit3, Eye, FileText, ArrowUpDown, ChevronDown, CheckSquare, 
  Square, Sparkles, MessageSquare, AlertCircle, Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Complaint, HodGermanStudent, Teacher } from '../types';
import { storage } from '../services/storageService';
import { generateStageManagerReportPrint } from '../utils/printComplaintUtils';

// Reason categories and quick options
export const TEACHER_TO_STUDENT_REASONS = [
  {
    category: '🔴 Behavioral (سلوكي)',
    options: [
      'شغب وإعادة إزعاج',
      'عدم احترام قواعد الفصل',
      'استخدام الموبايل/أجهزة'
    ]
  },
  {
    category: '🟡 Academic & Tools (أكاديمي وأدوات)',
    options: [
      'عدم حل الواجب H.A',
      'عدم إحضار الكتاب/الكشكول',
      'إهمال متابعة التصحيح'
    ]
  },
  {
    category: '🟠 Discipline (انضباط)',
    options: [
      'تأخر متكرر عن الحصة',
      'هروب/استئذان زائد'
    ]
  },
  {
    category: '✏️ Custom (سبب مخصص)',
    options: ['CUSTOM_FREE_TEXT']
  }
];

export const STUDENT_TO_TEACHER_REASONS = [
  {
    category: '🔵 Teaching Style (طريقة الشرح)',
    options: [
      'عدم وضوح الشرح',
      'سرعة شديدة في الإنجاز',
      'عدم إعطاء فرصة للمشاركة'
    ]
  },
  {
    category: '🟣 Correction (التصحيح والدرجات)',
    options: [
      'تأخر في تصحيح الدفاتر',
      'عدم وضوح توزيع الدرجات'
    ]
  },
  {
    category: '🔴 Treatment (الأسلوب والسلوك)',
    options: [
      'حزم زائد / أسلوب غير مناسب',
      'عدم الالتزام بوقت الحصة'
    ]
  },
  {
    category: '🟠 Homework (الواجبات)',
    options: [
      'كثرة الواجبات H.A بشكل مبالغ فيه'
    ]
  },
  {
    category: '✏️ Custom (سبب مخصص)',
    options: ['CUSTOM_FREE_TEXT']
  }
];

export const TEACHER_TO_STUDENT_ACTIONS = [
  'تواصل تلفوني مع ولي الأمر',
  'إرسال استدعاء ولي أمر',
  'تحويل للأخصائي الاجتماعي / مدير المرحلة',
  'تعهد كتابي على الطالب',
  'قيد المتابعة والتقييم'
];

export const STUDENT_TO_TEACHER_ACTIONS = [
  'اجتماع فردي مع المعلم للتوجيه',
  'جدولة زيارة صفية للمعلم',
  'تواصل مع ولي الأمر لتوضيح الصورة',
  'تنبيه شفوي / كتابي للمعلم',
  'تعديل خطة الشرح / التكليفات'
];

export const ACADEMIC_TERMS = ['Term 1', 'Term 2', 'Term 3'];
export const ACADEMIC_MONTHS = [
  'September', 'October', 'November', 'December', 
  'January', 'February', 'March', 'April', 'May', 'June'
];

interface ComplaintsSystemViewProps {
  embeddedTeacherId?: string; // Optional: filter for single teacher view in modal
  onUpdateComplaintsCount?: (count: number) => void;
}

export const ComplaintsSystemView: React.FC<ComplaintsSystemViewProps> = ({
  embeddedTeacherId,
  onUpdateComplaintsCount,
}) => {
  const { profile, updateProfile, _t } = useApp();
  const schoolSettings = profile?.schoolSettings || {};

  // Department Teachers list
  const teachersList: Teacher[] = useMemo(() => {
    if (schoolSettings.teachers && schoolSettings.teachers.length > 0) {
      return schoolSettings.teachers;
    }
    const currentHod = schoolSettings.hodName || profile?.displayName;
    return currentHod ? [{ id: 'hod', name: currentHod, isActive: true, isHod: true }] : [];
  }, [schoolSettings.teachers, schoolSettings.hodName, profile?.displayName]);

  // All Complaints State
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // German Students list from storage
  const [germanStudents, setGermanStudents] = useState<HodGermanStudent[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'TEACHER_TO_STUDENT' | 'STUDENT_TO_TEACHER'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsent' | 'sent'>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>(embeddedTeacherId || 'all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [termFilter, setTermFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [complaintToDelete, setComplaintToDelete] = useState<Complaint | null>(null);

  // Stage Manager Report Dispatch Modal
  const [isDispatchReportModalOpen, setIsDispatchReportModalOpen] = useState(false);
  const [selectedStageManagerId, setSelectedStageManagerId] = useState<string>('');
  const [dispatchReportType, setDispatchReportType] = useState<'weekly' | 'monthly' | 'termly'>('weekly');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Form State for New / Edit Complaint
  const [formDirection, setFormDirection] = useState<'TEACHER_TO_STUDENT' | 'STUDENT_TO_TEACHER'>('TEACHER_TO_STUDENT');
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [formGradeClass, setFormGradeClass] = useState<string>('');
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [formCustomReason, setFormCustomReason] = useState<string>('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [formCustomAction, setFormCustomAction] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formTerm, setFormTerm] = useState<string>(schoolSettings.currentTerm || 'Term 1');
  const [formMonth, setFormMonth] = useState<string>('October');

  const toggleReason = (opt: string) => {
    setSelectedReasons(prev =>
      prev.includes(opt) ? prev.filter(r => r !== opt) : [...prev, opt]
    );
  };

  const toggleAction = (act: string) => {
    setSelectedActions(prev =>
      prev.includes(act) ? prev.filter(a => a !== act) : [...prev, act]
    );
  };

  // Load Complaints & Students from Storage
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Load Students
        const storedStudents = await storage.getItem<HodGermanStudent[]>('hod_german_students');
        if (storedStudents && Array.isArray(storedStudents)) {
          setGermanStudents(storedStudents);
        }

        // Load Complaints
        const storedComplaints = await storage.getItem<Complaint[]>('hod_complaints');
        if (storedComplaints && Array.isArray(storedComplaints)) {
          setComplaints(storedComplaints);
          if (onUpdateComplaintsCount) onUpdateComplaintsCount(storedComplaints.length);
        } else if (schoolSettings.complaints && Array.isArray(schoolSettings.complaints)) {
          setComplaints(schoolSettings.complaints);
          if (onUpdateComplaintsCount) onUpdateComplaintsCount(schoolSettings.complaints.length);
        } else {
          setComplaints([]);
        }
      } catch (err) {
        console.error('Error loading complaints system data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Save Complaints to Storage & AppContext
  const persistComplaints = async (updated: Complaint[]) => {
    setComplaints(updated);
    if (onUpdateComplaintsCount) onUpdateComplaintsCount(updated.length);
    try {
      await storage.setItem('hod_complaints', updated);
      if (profile && updateProfile) {
        updateProfile({
          ...profile,
          schoolSettings: {
            ...schoolSettings,
            complaints: updated,
          }
        });
      }
    } catch (err) {
      console.error('Error saving complaints:', err);
    }
  };

  // Unique Classes list derived from German Students roster
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    germanStudents.forEach(s => {
      if (s.gradeClass) set.add(s.gradeClass.trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [germanStudents]);

  // Teacher-Specific assigned classes (Direction A logic)
  const teacherAssignedClasses = useMemo(() => {
    if (!formTeacherId) return availableClasses;
    const teacherSchedules = schoolSettings.teacherSchedules || {};
    const scheduleForTeacher = teacherSchedules[formTeacherId];
    if (!scheduleForTeacher) return availableClasses;

    const teacherClassesSet = new Set<string>();
    Object.values(scheduleForTeacher).forEach((daySchedule: any) => {
      if (Array.isArray(daySchedule)) {
        daySchedule.forEach((p: any) => {
          if (p.className) teacherClassesSet.add(p.className.trim().toUpperCase());
        });
      }
    });

    const result = Array.from(teacherClassesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return result.length > 0 ? result : availableClasses;
  }, [formTeacherId, schoolSettings.teacherSchedules, availableClasses]);

  // Dynamically Filtered Students matching selected class in form
  const classStudentsList = useMemo(() => {
    if (!formGradeClass) return germanStudents;
    return germanStudents.filter(s => s.gradeClass.toUpperCase() === formGradeClass.toUpperCase());
  }, [germanStudents, formGradeClass]);

  // Stage Managers list from settings
  const stageManagers = useMemo(() => {
    return schoolSettings.stageManagers || [];
  }, [schoolSettings.stageManagers]);

  useEffect(() => {
    if (stageManagers.length > 0 && !selectedStageManagerId) {
      setSelectedStageManagerId(stageManagers[0].id);
    }
  }, [stageManagers, selectedStageManagerId]);

  // Open Form Modal (New or Edit)
  const handleOpenAddModal = () => {
    setEditingComplaint(null);
    setFormDirection('TEACHER_TO_STUDENT');
    setFormTeacherId(embeddedTeacherId || (teachersList[0]?.id || ''));
    setFormGradeClass(availableClasses[0] || '5A');
    setFormStudentId('');
    setSelectedReasons([TEACHER_TO_STUDENT_REASONS[0].options[0]]);
    setFormCustomReason('');
    setSelectedActions([TEACHER_TO_STUDENT_ACTIONS[0]]);
    setFormCustomAction('');
    setFormNotes('');
    setFormTerm(schoolSettings.currentTerm || 'Term 1');
    setFormMonth('October');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (c: Complaint) => {
    setEditingComplaint(c);
    setFormDirection(c.direction);
    setFormTeacherId(c.teacherId);
    setFormGradeClass(c.gradeClass);
    setFormStudentId(c.studentId);
    
    // Parse preset reasons and actions
    const presetReasons = (c.direction === 'TEACHER_TO_STUDENT' ? TEACHER_TO_STUDENT_REASONS : STUDENT_TO_TEACHER_REASONS)
      .flatMap(r => r.options)
      .filter(o => o !== 'CUSTOM_FREE_TEXT');

    const presetActions = c.direction === 'TEACHER_TO_STUDENT'
      ? TEACHER_TO_STUDENT_ACTIONS
      : STUDENT_TO_TEACHER_ACTIONS;

    const matchedReasons = presetReasons.filter(r => c.reason.includes(r));
    setSelectedReasons(matchedReasons);

    let leftoverReason = c.reason;
    matchedReasons.forEach(r => {
      leftoverReason = leftoverReason.replace(r, '').replace(/\s*\+\s*/g, ' ').replace(/\s*•\s*/g, ' ').trim();
    });
    setFormCustomReason(leftoverReason);

    const matchedActions = presetActions.filter(a => c.actionTaken.includes(a));
    setSelectedActions(matchedActions);

    let leftoverAction = c.actionTaken;
    matchedActions.forEach(a => {
      leftoverAction = leftoverAction.replace(a, '').replace(/\s*\+\s*/g, ' ').replace(/\s*•\s*/g, ' ').trim();
    });
    setFormCustomAction(leftoverAction);

    setFormNotes(c.notes || '');
    setFormTerm(c.term || 'Term 1');
    setFormMonth(c.month || 'October');
    setIsAddModalOpen(true);
  };

  // Handle Form Submission
  const handleSaveComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const teacherObj = teachersList.find(t => t.id === formTeacherId) || { name: 'معلم غير محدد' };
    const studentObj = germanStudents.find(s => s.id === formStudentId) || {
      nameAr: 'طالب غير محدد',
      nameEn: 'Unknown Student',
      gradeClass: formGradeClass || '5A'
    };

    const combinedReasons = [...selectedReasons];
    if (formCustomReason.trim()) {
      combinedReasons.push(formCustomReason.trim());
    }
    const finalReason = combinedReasons.length > 0 ? combinedReasons.join(' + ') : 'سبب غير محدد';

    const combinedActions = [...selectedActions];
    if (formCustomAction.trim()) {
      combinedActions.push(formCustomAction.trim());
    }
    const finalActionTaken = combinedActions.length > 0 ? combinedActions.join(' + ') : 'قيد المتابعة والتقييم';

    if (!finalReason.trim()) return;

    if (editingComplaint) {
      const updated = complaints.map(c => 
        c.id === editingComplaint.id 
          ? {
              ...c,
              direction: formDirection,
              teacherId: formTeacherId,
              teacherName: teacherObj.name,
              studentId: studentObj.id || formStudentId,
              studentNameAr: studentObj.nameAr || studentObj.nameEn || 'طالب غير محدد',
              studentNameEn: studentObj.nameEn || studentObj.nameAr || 'Unknown Student',
              gradeClass: formGradeClass.toUpperCase() || studentObj.gradeClass,
              reason: finalReason,
              actionTaken: finalActionTaken,
              notes: formNotes.trim() || undefined,
              term: formTerm,
              month: formMonth,
            }
          : c
      );
      persistComplaints(updated);
      showToast(_t('تم تعديل سجل الشكوى بنجاح', 'Complaint record updated', 'Beschwerde aktualisiert'));
    } else {
      const newRecord: Complaint = {
        id: `cmp-${Date.now()}`,
        direction: formDirection,
        teacherId: formTeacherId,
        teacherName: teacherObj.name,
        studentId: studentObj.id || `st-${Date.now()}`,
        studentNameAr: studentObj.nameAr || 'طالب غير محدد',
        studentNameEn: studentObj.nameEn || 'Unknown Student',
        gradeClass: formGradeClass.toUpperCase() || studentObj.gradeClass || '5A',
        reason: finalReason,
        actionTaken: finalActionTaken,
        notes: formNotes.trim() || undefined,
        timestamp: new Date().toISOString(),
        term: formTerm,
        month: formMonth,
        weeklyReportSent: false,
        weeklyReportDate: null,
      };

      persistComplaints([newRecord, ...complaints]);
      showToast(_t('تم تسجيل الشكوى الجديدة بنجاح', 'Complaint logged successfully', 'Neue Beschwerde erfasst'));
    }

    setIsAddModalOpen(false);
  };

  // Delete Complaint Record
  const handleDeleteComplaint = (id: string) => {
    const updated = complaints.filter(c => c.id !== id);
    persistComplaints(updated);
    showToast(_t('تم حذف سجل الشكوى بنجاح', 'Complaint deleted', 'Beschwerde gelöscht'));
    setComplaintToDelete(null);
  };

  // Filtered Complaints for Table Display
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      // Embedded Teacher Filter Mode (if loaded inside Teacher Detail Modal)
      if (embeddedTeacherId && c.teacherId !== embeddedTeacherId) return false;

      // Direction Filter
      if (directionFilter !== 'all' && c.direction !== directionFilter) return false;

      // Status Filter
      if (statusFilter === 'unsent' && c.weeklyReportSent) return false;
      if (statusFilter === 'sent' && !c.weeklyReportSent) return false;

      // Teacher Filter
      if (!embeddedTeacherId && teacherFilter !== 'all' && c.teacherId !== teacherFilter) return false;

      // Class Filter
      if (classFilter !== 'all' && c.gradeClass.toUpperCase() !== classFilter.toUpperCase()) return false;

      // Term Filter
      if (termFilter !== 'all' && c.term !== termFilter) return false;

      // Month Filter
      if (monthFilter !== 'all' && c.month !== monthFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mTeacher = (c.teacherName || '').toLowerCase().includes(q);
        const mStudentAr = (c.studentNameAr || '').toLowerCase().includes(q);
        const mStudentEn = (c.studentNameEn || '').toLowerCase().includes(q);
        const mClass = (c.gradeClass || '').toLowerCase().includes(q);
        const mReason = (c.reason || '').toLowerCase().includes(q);
        const mAction = (c.actionTaken || '').toLowerCase().includes(q);
        return mTeacher || mStudentAr || mStudentEn || mClass || mReason || mAction;
      }

      return true;
    });
  }, [
    complaints, embeddedTeacherId, directionFilter, statusFilter, 
    teacherFilter, classFilter, termFilter, monthFilter, searchQuery
  ]);

  // Stage Manager Dispatch & Print Handler (Single-Cycle Reporting Rule)
  const handleConfirmAndDispatchReport = () => {
    const targetManager = stageManagers.find(m => m.id === selectedStageManagerId) || {
      name: schoolSettings.hodName || 'مدير المرحلة'
    };

    let targetComplaintsToPrint: Complaint[] = [];

    if (dispatchReportType === 'weekly') {
      // Weekly Report includes ONLY unsent complaints (weeklyReportSent === false)
      targetComplaintsToPrint = complaints.filter(c => !c.weeklyReportSent);
      if (targetComplaintsToPrint.length === 0) {
        showToast(_t('لا توجد أي شكاوى جديدة غير مدرجة بالتقرير الأسبوعي', 'No new unsent complaints found for weekly report', 'Keine neuen Beschwerden'));
        return;
      }

      // Mark all dispatched complaints as sent
      const dispatchedIds = new Set(targetComplaintsToPrint.map(c => c.id));
      const nowIso = new Date().toISOString();
      const updatedComplaints = complaints.map(c => 
        dispatchedIds.has(c.id) 
          ? { ...c, weeklyReportSent: true, weeklyReportDate: nowIso }
          : c
      );

      persistComplaints(updatedComplaints);
      showToast(_t(`تم اعتماد وإرسال ${targetComplaintsToPrint.length} شكوى لمدير المرحلة بنجاح`, `Dispatched ${targetComplaintsToPrint.length} complaints to Stage Manager`, `Bericht gesendet`));
    } else if (dispatchReportType === 'monthly') {
      // Monthly Report pulls ALL matching complaints for selected month
      targetComplaintsToPrint = monthFilter !== 'all'
        ? complaints.filter(c => c.month === monthFilter)
        : complaints;
    } else {
      // Term Report pulls ALL complaints for selected term
      targetComplaintsToPrint = termFilter !== 'all'
        ? complaints.filter(c => c.term === termFilter)
        : complaints;
    }

    // Generate & Print A4 Layout
    generateStageManagerReportPrint({
      stageManagerName: targetManager.name,
      stageName: (targetManager as any).gradeBand || 'قسم اللغة الألمانية',
      term: formTerm || 'Term 1',
      month: monthFilter !== 'all' ? monthFilter : 'أكتوبر',
      reportDate: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
      hodName: schoolSettings.hodName || profile?.displayName || '',
      complaints: targetComplaintsToPrint,
      reportType: dispatchReportType,
    });

    setIsDispatchReportModalOpen(false);
  };

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-10">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-2.5 py-1 rounded-xl shadow-xl font-bold text-[11px] animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header Banner */}
      {!embeddedTeacherId && (
        <div className="bg-surface border border-surface-border rounded-xl p-2.5 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-500/10 text-rose-600 rounded-xl border border-rose-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h2 className="text-[11px] sm:text-base font-black text-text-main flex items-center gap-2">
                    <span>{_t('سجل متابعة شكاوى وملاحظات أولياء الأمور والمعلمين', 'Parent & Teacher Feedback Log', 'Beschwerdeprotokoll')}</span>
                    <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded-md text-[10px] font-extrabold border border-rose-500/20">
                      🇩🇪 Deutsch
                    </span>
                  </h2>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
              <button
                onClick={() => setIsDispatchReportModalOpen(true)}
                className="px-2 sm:px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10.5px] sm:text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{_t('تقرير مدير المرحلة', 'Stage Manager Report', 'Stufenleiter-Bericht')}</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="px-2 sm:px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[10.5px] sm:text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{_t('تسجيل شكوى جديدة', 'Log New Complaint', 'Neue Beschwerde erfassen')}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-border">
            <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] shrink-0">
                📊
              </div>
              <div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('إجمالي الشكاوى', 'Total Complaints', 'Gesamt Beschwerden')}</div>
                <div className="text-[11px] font-black text-text-main">{complaints.length}</div>
              </div>
            </div>

            <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-[11px] shrink-0">
                👨‍🏫
              </div>
              <div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('معلم ضد طالب', 'Teacher vs Student', 'Lehrer vs Schüler')}</div>
                <div className="text-[11px] font-black text-rose-600">
                  {complaints.filter(c => c.direction === 'TEACHER_TO_STUDENT').length}
                </div>
              </div>
            </div>

            <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-[11px] shrink-0">
                👦
              </div>
              <div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('طالب ضد معلم', 'Student vs Teacher', 'Schüler vs Lehrer')}</div>
                <div className="text-[11px] font-black text-indigo-600">
                  {complaints.filter(c => c.direction === 'STUDENT_TO_TEACHER').length}
                </div>
              </div>
            </div>

            <div className="bg-surface-hover/80 border border-surface-border p-2 rounded-xl flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-[11px] shrink-0">
                🆕
              </div>
              <div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{_t('بانتظار التقرير الأسبوعي', 'Unsent Weekly', 'Ausstehend')}</div>
                <div className="text-[11px] font-black text-amber-600">
                  {complaints.filter(c => !c.weeklyReportSent).length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Teacher Header Notice */}
      {embeddedTeacherId && (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] font-bold text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>
              {_t(`سجل الشكاوى المتعلقة بهذا المعلم (${filteredComplaints.length} شكوى)`, `Complaints record involving this teacher (${filteredComplaints.length})`, `Beschwerden bezüglich dieses Lehrers (${filteredComplaints.length})`)}
            </span>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{_t('إضافة شكوى', 'Add Complaint', 'Beschwerde hinzufügen')}</span>
          </button>
        </div>
      )}

      {/* SEARCH ENGINE & SMART FILTERS */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* Instant Search Bar */}
          <div className="relative sm:col-span-4">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={_t('البحث السريع: معلم، طالب، فصل، سبب...', 'Search: Teacher, Student, Class, Reason...', 'Suche: Lehrer, Schüler, Klasse...')}
              className="w-full pl-3 pr-9 py-2 bg-surface-hover border border-primary/30 rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-text-muted/70"
            />
          </div>

          {/* Direction Filter */}
          <div className="sm:col-span-2">
            <select
              value={directionFilter}
              onChange={e => setDirectionFilter(e.target.value as any)}
              className="w-full px-2 py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">{_t('الكل (الاتجاهين)', 'All Directions', 'Alle Richtungen')}</option>
              <option value="TEACHER_TO_STUDENT">👨‍🏫 {_t('معلم ضد طالب', 'Teacher vs Student', 'Lehrer vs Schüler')}</option>
              <option value="STUDENT_TO_TEACHER">👦 {_t('طالب ضد معلم', 'Student vs Teacher', 'Schüler vs Lehrer')}</option>
            </select>
          </div>

          {/* Report Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-2 py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">{_t('حالة التقرير: الكل', 'Status: All', 'Status: Alle')}</option>
              <option value="unsent">🆕 {_t('بانتظار التقرير الأسبوعي', 'Unsent Weekly', 'Ausstehend')}</option>
              <option value="sent">📑 {_t('مدرجة بتقرير أسبوعي', 'Sent in Weekly Report', 'Berichtet')}</option>
            </select>
          </div>

          {/* Class Filter */}
          <div className="sm:col-span-2">
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="w-full px-2 py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">{_t('الفصل: الكل', 'Class: All', 'Klasse: Alle')}</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>
                  🏫 الفصل: {c}
                </option>
              ))}
            </select>
          </div>

          {/* Teacher Filter (Only if not embedded for single teacher) */}
          {!embeddedTeacherId && (
            <div className="sm:col-span-2">
              <select
                value={teacherFilter}
                onChange={e => setTeacherFilter(e.target.value)}
                className="w-full px-2 py-2 bg-surface-hover border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">{_t('المعلم: الكل', 'Teacher: All', 'Lehrer: Alle')}</option>
                {teachersList.map(t => (
                  <option key={t.id} value={t.id}>
                    👨‍🏫 {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* COMPLAINTS TABLE DISPLAY */}
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-muted text-[11px] animate-pulse">
            {_t('جاري تحميل سجل الشكاوى المتبادل...', 'Loading complaints dataset...', 'Beschwerden werden geladen...')}
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-8 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto font-bold text-lg">
              ✨
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-main">
                {_t('لا توجد شكاوى مطابقة للتصفية حالياً', 'No complaints found matching filters', 'Keine Beschwerden gefunden')}
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="px-2 py-1 bg-primary text-white text-[11px] font-bold rounded-xl shadow-xs cursor-pointer"
            >
              {_t('تسجيل شكوى جديدة', 'Log Complaint', 'Beschwerde erfassen')}
            </button>
          </div>
        ) : (
          <div className="max-h-[550px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-right border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-surface-hover/95 backdrop-blur border-b border-surface-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center border-r border-surface-border/50">#</th>
                  <th className="py-2.5 px-3 w-32 text-center border-r border-surface-border/50">{_t('الاتجاه', 'Direction', 'Richtung')}</th>
                  <th className="py-2.5 px-3 border-r border-surface-border/50">{_t('المعلم المعني', 'Teacher', 'Lehrer')}</th>
                  <th className="py-2.5 px-3 border-r border-surface-border/50">{_t('الطالب (عربي / En)', 'Student Name', 'Schüler')}</th>
                  <th className="py-2.5 px-2.5 w-16 text-center border-r border-surface-border/50">{_t('الفصل', 'Class', 'Klasse')}</th>
                  <th className="py-2.5 px-3 border-r border-surface-border/50">{_t('السبب / التفاصيل', 'Reason', 'Grund')}</th>
                  <th className="py-2.5 px-3 border-r border-surface-border/50">{_t('الإجراء المتخذ', 'Action Taken', 'Maßnahme')}</th>
                  <th className="py-2.5 px-3 w-32 text-center border-r border-surface-border/50">{_t('حالة التقرير الأسبوعي', 'Report Status', 'Status')}</th>
                  <th className="py-2.5 px-3 w-20 text-center">{_t('إجراءات', 'Actions', 'Aktionen')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {filteredComplaints.map((c, idx) => {
                  const isTeacherToStudent = c.direction === 'TEACHER_TO_STUDENT';
                  const formattedDate = new Date(c.timestamp).toLocaleDateString('ar-EG', {
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <tr key={c.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-text-muted border-r border-surface-border/30">{idx + 1}</td>
                      
                      {/* Direction Badge */}
                      <td className="py-2.5 px-3 text-center border-r border-surface-border/30">
                        {isTeacherToStudent ? (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded-lg text-[10px] font-black border border-rose-500/20 inline-block">
                            👨‍🏫 معلم ضد طالب
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-black border border-indigo-500/20 inline-block">
                            👦 طالب ضد معلم
                          </span>
                        )}
                      </td>

                      {/* Teacher Name */}
                      <td className="py-2.5 px-3 font-extrabold text-text-main border-r border-surface-border/30">
                        {c.teacherName}
                      </td>

                      {/* Student Name */}
                      <td className="py-2.5 px-3 border-r border-surface-border/30">
                        <div className="font-bold text-text-main">{c.studentNameAr}</div>
                        {c.studentNameEn && (
                          <div className="text-[10px] text-text-muted font-medium">{c.studentNameEn}</div>
                        )}
                      </td>

                      {/* Class */}
                      <td className="py-2.5 px-2.5 text-center font-black text-primary border-r border-surface-border/30">
                        {c.gradeClass}
                      </td>

                      {/* Reason */}
                      <td className="py-2.5 px-3 border-r border-surface-border/30">
                        <div className="font-bold text-text-main">{c.reason}</div>
                        {c.notes && (
                          <div className="text-[10px] text-text-muted mt-0.5 italic">📝 {c.notes}</div>
                        )}
                      </td>

                      {/* Action Taken */}
                      <td className="py-2.5 px-3 font-extrabold text-emerald-600 dark:text-emerald-400 border-r border-surface-border/30">
                        {c.actionTaken}
                      </td>

                      {/* Report Status Badge */}
                      <td className="py-2.5 px-3 text-center border-r border-surface-border/30">
                        {c.weeklyReportSent ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold border border-blue-500/20 inline-block">
                              📑 مدرجة بتقرير أسبوعي
                            </span>
                            <div className="text-[9px] text-text-muted">
                              {c.weeklyReportDate ? new Date(c.weeklyReportDate).toLocaleDateString('ar-EG') : formattedDate}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md text-[10px] font-bold border border-amber-500/20 inline-block animate-pulse">
                            🆕 بانتظار التقرير الأسبوعي
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1 hover:bg-surface-hover text-text-muted hover:text-primary rounded-lg transition-colors cursor-pointer"
                            title={_t('تعديل', 'Edit', 'Bearbeiten')}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setComplaintToDelete(c)}
                            className="p-1 hover:bg-rose-500/10 text-text-muted hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title={_t('حذف', 'Delete', 'Löschen')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL 1: ADD / EDIT COMPLAINT FORM ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-xl w-full max-w-xl p-2.5 sm:p-3 shadow-2xl space-y-2 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-[11px] sm:text-base font-black text-text-main flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>
                  {editingComplaint 
                    ? _t('تعديل سجل الشكوى', 'Edit Complaint Record', 'Beschwerde bearbeiten')
                    : _t('تسجيل شكوى جديدة (Two-Way Complaint)', 'Log Dual-Direction Complaint', 'Neue Beschwerde erfassen')}
                </span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-hover"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveComplaintSubmit} className="space-y-3.5">
              {/* DIRECTION TOGGLE (A vs B) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-main">
                  {_t('اتجاه الشكوى (Complaint Direction):', 'Complaint Direction:', 'Beschwerderichtung:')}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-surface-hover rounded-xl border border-surface-border">
                  <button
                    type="button"
                    onClick={() => {
                      setFormDirection('TEACHER_TO_STUDENT');
                      setSelectedReasons([TEACHER_TO_STUDENT_REASONS[0].options[0]]);
                      setSelectedActions([TEACHER_TO_STUDENT_ACTIONS[0]]);
                    }}
                    className={`py-2 px-3 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      formDirection === 'TEACHER_TO_STUDENT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span>👨‍🏫 {_t('معلم ضد طالب', 'Teacher vs Student', 'Lehrer vs Schüler')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormDirection('STUDENT_TO_TEACHER');
                      setSelectedReasons([STUDENT_TO_TEACHER_REASONS[0].options[0]]);
                      setSelectedActions([STUDENT_TO_TEACHER_ACTIONS[0]]);
                    }}
                    className={`py-2 px-3 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      formDirection === 'STUDENT_TO_TEACHER'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span>👦 {_t('طالب/ولي أمر ضد معلم', 'Student vs Teacher', 'Schüler vs Lehrer')}</span>
                  </button>
                </div>
              </div>

              {/* DIRECTION A: TEACHER AGAINST STUDENT */}
              {formDirection === 'TEACHER_TO_STUDENT' && (
                <div className="space-y-3 p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl">
                  {/* Select Teacher */}
                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      1. {_t('اختر المعلم صاحب الشكوى:', 'Select Teacher:', 'Lehrer auswählen:')}
                    </label>
                    <select
                      value={formTeacherId}
                      onChange={e => setFormTeacherId(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                      required
                    >
                      {teachersList.map(t => (
                        <option key={t.id} value={t.id}>
                          👨‍🏫 {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Class (Cascading from assigned classes) */}
                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      2. {_t('اختر الفصل (الفصول المسندة للمعلم):', 'Select Class (Assigned to Teacher):', 'Klasse auswählen:')}
                    </label>
                    <select
                      value={formGradeClass}
                      onChange={e => setFormGradeClass(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                      required
                    >
                      {teacherAssignedClasses.map(c => (
                        <option key={c} value={c}>
                          🏫 الفصل: {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Student (Cascading from selected class) */}
                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      3. {_t('اختر الطالب المشتكى عليه (من طلاب اللغة الألمانية):', 'Select Student (German Roster):', 'Schüler auswählen:')}
                    </label>
                    <select
                      value={formStudentId}
                      onChange={e => setFormStudentId(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                      required
                    >
                      <option value="">-- {_t('اختر الطالب من الفصل', 'Select student from class', 'Schüler auswählen')} --</option>
                      {classStudentsList.map(s => (
                        <option key={s.id} value={s.id}>
                          👤 {s.nameAr} ({s.nameEn}) - [{s.gradeClass}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* DIRECTION B: STUDENT/PARENT AGAINST TEACHER */}
              {formDirection === 'STUDENT_TO_TEACHER' && (
                <div className="space-y-3 p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-xl">
                  {/* Select Class */}
                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      1. {_t('اختر الفصل الدراسي:', 'Select Class:', 'Klasse auswählen:')}
                    </label>
                    <select
                      value={formGradeClass}
                      onChange={e => setFormGradeClass(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                      required
                    >
                      {availableClasses.map(c => (
                        <option key={c} value={c}>
                          🏫 الفصل: {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Complainant Student */}
                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      2. {_t('اختر الطالب صاحب الشكوى / ولي أمره:', 'Select Complainant Student:', 'Schüler auswählen:')}
                    </label>
                    <select
                      value={formStudentId}
                      onChange={e => setFormStudentId(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                      required
                    >
                      <option value="">-- {_t('اختر الطالب من الفصل', 'Select student from class', 'Schüler auswählen')} --</option>
                      {classStudentsList.map(s => (
                        <option key={s.id} value={s.id}>
                          👤 {s.nameAr} ({s.nameEn}) - [{s.gradeClass}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Target Teacher */}
                  <div>
                    <label className="text-[11px] font-bold text-text-main block mb-1">
                      3. {_t('اختر المعلم المشتكى عليه:', 'Select Target Teacher:', 'Ziel-Lehrer auswählen:')}
                    </label>
                    <select
                      value={formTeacherId}
                      onChange={e => setFormTeacherId(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                      required
                    >
                      {teachersList.map(t => (
                        <option key={t.id} value={t.id}>
                          👨‍🏫 {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* MULTI-SELECT REASON SELECTION */}
              <div className="space-y-2 border border-surface-border p-3 rounded-xl bg-surface-hover/30">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                    <span>{_t('أسباب الشكوى (يمكن اختيار أكثر من سبب):', 'Complaint Reasons (Select multiple):', 'Beschwerdegründe (Mehrfachauswahl):')}</span>
                  </label>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-black">
                    {selectedReasons.length + (formCustomReason.trim() ? 1 : 0)} {_t('محدد', 'selected', 'ausgewählt')}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                  {(formDirection === 'TEACHER_TO_STUDENT' ? TEACHER_TO_STUDENT_REASONS : STUDENT_TO_TEACHER_REASONS).map((cat, idx) => {
                    const validOptions = cat.options.filter(opt => opt !== 'CUSTOM_FREE_TEXT');
                    if (validOptions.length === 0) return null;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="text-[10px] font-black text-text-muted uppercase tracking-wider">{cat.category}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {validOptions.map(opt => {
                            const isSelected = selectedReasons.includes(opt);
                            return (
                              <button
                                type="button"
                                key={opt}
                                onClick={() => toggleReason(opt)}
                                className={`p-2 rounded-xl text-[11px] font-bold text-right transition-all border flex items-center gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-rose-500/10 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-2xs'
                                    : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border'
                                }`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                                )}
                                <span className="truncate">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Optional Custom Free Text Reason */}
                <div className="pt-1.5 border-t border-surface-border/60">
                  <input
                    type="text"
                    value={formCustomReason}
                    onChange={e => setFormCustomReason(e.target.value)}
                    placeholder={_t('✏️ سبب مخصص إضافي (اختياري)...', '✏️ Additional custom reason (optional)...', 'Zusätzlicher Grund...')}
                    className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* MULTI-SELECT ACTION / SOLUTION TAKEN */}
              <div className="space-y-2 border border-surface-border p-3 rounded-xl bg-surface-hover/30">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                    <span>{_t('الإجراءات والحلول المتخذة (يمكن اختيار أكثر من إجراء/حل):', 'Actions & Solutions Taken (Select multiple):', 'Maßnahmen & Lösungen (Mehrfachauswahl):')}</span>
                  </label>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-black">
                    {selectedActions.length + (formCustomAction.trim() ? 1 : 0)} {_t('محدد', 'selected', 'ausgewählt')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {(formDirection === 'TEACHER_TO_STUDENT' ? TEACHER_TO_STUDENT_ACTIONS : STUDENT_TO_TEACHER_ACTIONS).map(act => {
                    const isSelected = selectedActions.includes(act);
                    return (
                      <button
                        type="button"
                        key={act}
                        onClick={() => toggleAction(act)}
                        className={`p-2 rounded-xl text-[11px] font-bold text-right transition-all border flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-2xs'
                            : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Square className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                        )}
                        <span className="truncate">{act}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Optional Custom Free Text Action/Solution */}
                <div className="pt-1.5 border-t border-surface-border/60">
                  <input
                    type="text"
                    value={formCustomAction}
                    onChange={e => setFormCustomAction(e.target.value)}
                    placeholder={_t('⚡ إجراء / حل مخصص إضافي (اختياري)...', '⚡ Additional custom action/solution (optional)...', 'Zusätzliche Maßnahme...')}
                    className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="text-[11px] font-bold text-text-main block mb-1">
                  {_t('ملاحظات إضافية (اختياري):', 'Additional Notes (Optional):', 'Zusätzliche Notizen:')}
                </label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder={_t('أي تفاصيل إضافية أو ملحوظة خاصة للتقرير...', 'Any extra notes...', 'Zusätzliche Anmerkungen...')}
                  className="w-full p-2.5 bg-surface border border-surface-border rounded-xl text-[11px] font-medium text-text-main focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Term & Month Selectors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-text-muted block mb-1">
                    {_t('الفصل الدراسي (Term):', 'Term:', 'Semester:')}
                  </label>
                  <select
                    value={formTerm}
                    onChange={e => setFormTerm(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main"
                  >
                    {ACADEMIC_TERMS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted block mb-1">
                    {_t('الشهر الدراسي (Month):', 'Month:', 'Monat:')}
                  </label>
                  <select
                    value={formMonth}
                    onChange={e => setFormMonth(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main"
                  >
                    {ACADEMIC_MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-2.5 py-1 bg-surface-hover text-text-muted hover:text-text-main rounded-xl text-[11px] font-bold cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] font-bold shadow-xs cursor-pointer"
                >
                  {editingComplaint ? _t('تعديل وحفظ', 'Save Changes', 'Speichern') : _t('حفظ الشكوى', 'Save Complaint', 'Beschwerde speichern')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: STAGE MANAGER REPORT DISPATCH MODAL ================= */}
      {isDispatchReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-xl w-full max-w-lg p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-[11px] sm:text-base font-black text-text-main flex items-center gap-2">
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>{_t('اعتماد وإصدار تقرير مدير المرحلة (A4 Print)', 'Stage Manager Report Dispatch', 'Bericht an Stufenleiter')}</span>
              </h3>
              <button
                onClick={() => setIsDispatchReportModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Select Stage Manager */}
              <div>
                <label className="text-[11px] font-bold text-text-main block mb-1">
                  {_t('اختر مدير المرحلة الموجه إليه التقرير:', 'Select Target Stage Manager:', 'Stufenleiter auswählen:')}
                </label>
                <select
                  value={selectedStageManagerId}
                  onChange={e => setSelectedStageManagerId(e.target.value)}
                  className="w-full px-2 py-1 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {stageManagers.map(m => (
                    <option key={m.id} value={m.id}>
                      👤 {m.name} {m.gradeBand ? `(${m.gradeBand})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Report Cycle Type Toggle */}
              <div>
                <label className="text-[11px] font-bold text-text-main block mb-1">
                  {_t('نوع التقرير ودورة المتابعة:', 'Report Cycle Type:', 'Berichtstyp:')}
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-hover rounded-xl border border-surface-border text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDispatchReportType('weekly')}
                    className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
                      dispatchReportType === 'weekly'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    📅 {_t('أسبوعي (جديد)', 'Weekly', 'Wöchentlich')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchReportType('monthly')}
                    className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
                      dispatchReportType === 'monthly'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    📆 {_t('شهري شامل', 'Monthly', 'Monatlich')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchReportType('termly')}
                    className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
                      dispatchReportType === 'termly'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    📊 {_t('تراكمي الفصل', 'Termly', 'Semester')}
                  </button>
                </div>
              </div>

              {/* Single-Cycle Rule Explanation Notice */}
              {dispatchReportType === 'weekly' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] font-bold text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-black">
                    <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{_t('قاعدة منع التكرار الأسبوعي (Single-Cycle Rule):', 'Single-Cycle Reporting Rule:', 'Einmalige Berichterstattung:')}</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {_t(
                      'عند النقر على "تأكيد وإرسال التقرير الأسبوعي"، سيتم تضمين الشكاوى غير المرسلة سابقاً فقط، وتحديث حالتها إلى (مدرجة بتقرير) لمنع تكرارها بالأسبوع القادم.',
                      'Clicking confirm dispatches ONLY unsent complaints and updates their status to prevent duplicate reporting next week.',
                      'Nur unsortierte Beschwerden werden gesendet und als gerichtet markiert.'
                    )}
                  </p>
                </div>
              )}

              {/* Dispatch Action Button */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  onClick={() => setIsDispatchReportModalOpen(false)}
                  className="px-2.5 py-1 bg-surface-hover text-text-muted hover:text-text-main rounded-xl text-[11px] font-bold cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>

                <button
                  onClick={handleConfirmAndDispatchReport}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>{_t('تأكيد وإصدار التقرير (A4)', 'Confirm & Dispatch (A4)', 'Bestätigen & Drucken')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: DELETE CONFIRMATION ================= */}
      {complaintToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-xl w-full max-w-md p-3 shadow-2xl space-y-2 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-4 h-4" />
            </div>

            <div>
              <h3 className="text-[11px] font-black text-text-main">
                {_t('تأكيد حذف سجل الشكوى', 'Confirm Complaint Deletion', 'Löschen bestätigen')}
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setComplaintToDelete(null)}
                className="px-2.5 py-1 bg-surface-hover text-text-muted hover:text-text-main rounded-xl text-[11px] font-bold cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={() => handleDeleteComplaint(complaintToDelete.id)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold shadow-xs cursor-pointer"
              >
                {_t('تأكيد الحذف', 'Delete Record', 'Löschen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
