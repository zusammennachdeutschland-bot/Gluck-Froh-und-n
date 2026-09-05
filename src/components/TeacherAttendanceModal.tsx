import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Calendar, Clock, AlertTriangle, UserCheck, CheckCircle2, 
  ArrowRight, ArrowLeft, Shield, Bell, FileText, UserMinus, LogOut,
  Copy, Check, MessageCircle, RefreshCw, Plus, Trash2, Sparkles, ExternalLink, Send
} from 'lucide-react';
import { 
  Teacher, 
  SchoolSettings, 
  StaffAttendanceRecord, 
  StaffAttendanceType, 
  AbsenceScope, 
  AbsenceStatus 
} from '../types';
import { 
  calculateDelayMinutes, 
  calculateLostMinutes, 
  getTeacherStageName, 
  getStageSecretary, 
  formatSecretaryNotification,
  formatAbsenceReplacementMessage,
  autoSuggestReplacements,
  isTeacherBusyInPeriod,
  ReplacementAssignment,
  SYSTEM_STAGES 
} from '../utils/staffAttendanceUtils';

const WEEKDAY_NAMES_MAP: Record<string, string> = {
  '0': 'الأحد',
  '1': 'الإثنين',
  '2': 'الثلاثاء',
  '3': 'الأربعاء',
  '4': 'الخميس',
  '5': 'الجمعة',
  '6': 'السبت'
};

interface TeacherAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: StaffAttendanceRecord, notificationMessage?: string) => void;
  teachers?: Teacher[];
  availableTeachers?: Teacher[];
  schoolSettings?: SchoolSettings;
  preselectedTeacherId?: string;
  initialTeacher?: any;
  stageManagers?: any[];
  editingRecord?: StaffAttendanceRecord | null;
  _t?: (ar: string, en: string, de?: string) => string;
  isRtl?: boolean;
}

export const TeacherAttendanceModal: React.FC<TeacherAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  teachers: propTeachers,
  availableTeachers,
  schoolSettings: propSchoolSettings,
  preselectedTeacherId,
  initialTeacher,
  editingRecord,
  _t: propT,
  isRtl = true
}) => {
  const teachers = useMemo(() => {
    if (propTeachers && Array.isArray(propTeachers) && propTeachers.length > 0) {
      return propTeachers;
    }
    if (availableTeachers && Array.isArray(availableTeachers) && availableTeachers.length > 0) {
      return availableTeachers;
    }
    return [];
  }, [propTeachers, availableTeachers]);

  const schoolSettings = useMemo(() => {
    return propSchoolSettings || ({} as SchoolSettings);
  }, [propSchoolSettings]);

  const _t = useMemo(() => {
    return propT || ((ar: string, en: string, de?: string) => ar);
  }, [propT]);

  // Selected teacher
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    return editingRecord?.teacherId || initialTeacher?.id || preselectedTeacherId || teachers?.[0]?.id || '';
  });

  const selectedTeacher = useMemo(() => {
    return teachers.find(t => t.id === selectedTeacherId) || initialTeacher || teachers?.[0] || null;
  }, [teachers, selectedTeacherId, initialTeacher]);

  // Tab: absence | late_arrival | early_leave
  const [attendanceType, setAttendanceType] = useState<StaffAttendanceType>(
    editingRecord?.type || 'absence'
  );

  // Date
  const [date, setDate] = useState<string>(
    editingRecord?.date || new Date().toISOString().split('T')[0]
  );

  // Absence state
  const [absenceScope, setAbsenceScope] = useState<AbsenceScope>(
    editingRecord?.absenceScope || 'full_day'
  );
  const [absenceStatus, setAbsenceStatus] = useState<AbsenceStatus>(
    editingRecord?.absenceStatus || 'excused'
  );
  const [periodNumber, setPeriodNumber] = useState<number>(
    editingRecord?.periodNumber || 1
  );
  const [lessonClass, setLessonClass] = useState<string>(
    editingRecord?.lessonClass || ''
  );
  const [replacementTeacherId, setReplacementTeacherId] = useState<string>(
    editingRecord?.replacementTeacherId || ''
  );

  // Default times from school presence settings
  const defaultPresence = schoolSettings?.presence ? (Object.values(schoolSettings.presence) as any[]).find((p: any) => p?.active) : null;
  const defaultScheduledArrival = defaultPresence?.arrivalTime || '07:30';
  const defaultScheduledLeave = defaultPresence?.departureTime || '14:30';

  // Late arrival state
  const [scheduledArrivalTime, setScheduledArrivalTime] = useState<string>(
    editingRecord?.scheduledArrivalTime || defaultScheduledArrival
  );
  const [actualArrivalTime, setActualArrivalTime] = useState<string>(
    editingRecord?.actualArrivalTime || '07:50'
  );

  // Early leave state
  const [scheduledLeaveTime, setScheduledLeaveTime] = useState<string>(
    editingRecord?.scheduledLeaveTime || defaultScheduledLeave
  );
  const [actualLeaveTime, setActualLeaveTime] = useState<string>(
    editingRecord?.actualLeaveTime || '13:00'
  );

  // Reason & Notes
  const [reason, setReason] = useState<string>(editingRecord?.reason || '');
  const [notes, setNotes] = useState<string>(editingRecord?.notes || '');

  // Calculate live minutes
  const calculatedDelay = useMemo(() => {
    return calculateDelayMinutes(scheduledArrivalTime, actualArrivalTime);
  }, [scheduledArrivalTime, actualArrivalTime]);

  const calculatedLost = useMemo(() => {
    return calculateLostMinutes(scheduledLeaveTime, actualLeaveTime);
  }, [scheduledLeaveTime, actualLeaveTime]);

  // Target day key & day name derived from selected date
  const targetDayKey = useMemo(() => {
    if (!date) return new Date().getDay().toString();
    const parts = date.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.getDay().toString();
    }
    return new Date().getDay().toString();
  }, [date]);

  const targetDayName = useMemo(() => {
    return WEEKDAY_NAMES_MAP[targetDayKey] || '';
  }, [targetDayKey]);

  // Lessons scheduled for absent teacher on this day
  const teacherScheduledLessonsToday = useMemo(() => {
    if (!selectedTeacherId) return [];
    const schedules = selectedTeacherId === 'hod'
      ? schoolSettings?.schedule
      : schoolSettings?.teacherSchedules?.[selectedTeacherId];
    const daySchedule = schedules?.[targetDayKey] || [];
    return daySchedule
      .filter((l: any) => l && (l.className || l.subjectName))
      .sort((a: any, b: any) => Number(a.periodNumber) - Number(b.periodNumber));
  }, [selectedTeacherId, targetDayKey, schoolSettings]);

  // Replacement assignments for each class/period
  const [replacementAssignments, setReplacementAssignments] = useState<ReplacementAssignment[]>(() => {
    if (editingRecord?.replacementAssignments && editingRecord.replacementAssignments.length > 0) {
      return editingRecord.replacementAssignments;
    }
    return [];
  });

  // Automatically suggest replacements when teacher, date, or schedule changes
  useEffect(() => {
    if (editingRecord?.replacementAssignments && editingRecord.replacementAssignments.length > 0) {
      setReplacementAssignments(editingRecord.replacementAssignments);
      return;
    }

    if (attendanceType !== 'absence') {
      return;
    }

    if (teacherScheduledLessonsToday.length > 0) {
      const periods = teacherScheduledLessonsToday.map((l: any) => ({
        periodNumber: Number(l.periodNumber),
        className: l.className || l.subjectName || `حصة ${l.periodNumber}`
      }));
      const suggested = autoSuggestReplacements(
        selectedTeacherId,
        targetDayKey,
        periods,
        teachers,
        schoolSettings
      );
      setReplacementAssignments(suggested);
    } else if (absenceScope === 'lesson_based' && periodNumber) {
      const suggested = autoSuggestReplacements(
        selectedTeacherId,
        targetDayKey,
        [{ periodNumber: periodNumber, className: lessonClass || `حصة ${periodNumber}` }],
        teachers,
        schoolSettings
      );
      setReplacementAssignments(suggested);
    } else {
      setReplacementAssignments([]);
    }
  }, [selectedTeacherId, targetDayKey, teacherScheduledLessonsToday, attendanceType, absenceScope, editingRecord]);

  // Handler to re-run auto suggestion balancing
  const handleReAutoSuggest = () => {
    const periods = replacementAssignments.length > 0
      ? replacementAssignments.map(r => ({ periodNumber: r.periodNumber, className: r.className }))
      : teacherScheduledLessonsToday.map((l: any) => ({
          periodNumber: Number(l.periodNumber),
          className: l.className || l.subjectName || `حصة ${l.periodNumber}`
        }));

    const suggested = autoSuggestReplacements(
      selectedTeacherId,
      targetDayKey,
      periods,
      teachers,
      schoolSettings
    );
    setReplacementAssignments(suggested);
  };

  // Handler to modify a specific assignment
  const handleAssignmentChange = (index: number, field: 'periodNumber' | 'className' | 'teacherId', value: any) => {
    setReplacementAssignments(prev => {
      const updated = [...prev];
      if (field === 'teacherId') {
        if (!value) {
          updated[index] = {
            ...updated[index],
            replacementTeacherId: '',
            replacementTeacherName: ''
          };
        } else {
          const t = teachers.find(item => item.id === value);
          updated[index] = {
            ...updated[index],
            replacementTeacherId: value,
            replacementTeacherName: t?.name || ''
          };
        }
      } else if (field === 'className') {
        updated[index] = { ...updated[index], className: value };
      } else if (field === 'periodNumber') {
        updated[index] = { ...updated[index], periodNumber: Number(value) };
      }
      return updated;
    });
  };

  const handleAddPeriod = () => {
    const existingPeriodNums = replacementAssignments.map(r => r.periodNumber);
    let nextNum = 1;
    for (let p = 1; p <= 8; p++) {
      if (!existingPeriodNums.includes(p)) {
        nextNum = p;
        break;
      }
    }
    setReplacementAssignments(prev => [
      ...prev,
      {
        periodNumber: nextNum,
        className: '',
        replacementTeacherId: '',
        replacementTeacherName: ''
      }
    ]);
  };

  const handleRemovePeriod = (index: number) => {
    setReplacementAssignments(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAllReplacements = () => {
    setReplacementAssignments(prev => prev.map(r => ({
      ...r,
      replacementTeacherId: '',
      replacementTeacherName: ''
    })));
  };

  // Stage and Secretary identification
  const currentStageName = useMemo(() => {
    if (!selectedTeacher) return 'Primary';
    return getTeacherStageName(selectedTeacher, schoolSettings);
  }, [selectedTeacher, schoolSettings]);

  const linkedSecretary = useMemo(() => {
    return getStageSecretary(currentStageName, schoolSettings);
  }, [currentStageName, schoolSettings]);

  // WhatsApp formatted message for absence exactly matching user request
  const absenceWhatsAppMessage = useMemo(() => {
    return formatAbsenceReplacementMessage(
      selectedTeacher?.name || '',
      replacementAssignments
    );
  }, [selectedTeacher, replacementAssignments]);

  const secretaryPhone = useMemo(() => {
    if (!linkedSecretary?.phone) return '';
    return linkedSecretary.phone.replace(/[^0-9]/g, '');
  }, [linkedSecretary]);

  const whatsAppShareUrl = useMemo(() => {
    const textToShare = attendanceType === 'absence'
      ? absenceWhatsAppMessage
      : formatSecretaryNotification(
          attendanceType, 
          selectedTeacher?.name || '', 
          date, 
          attendanceType === 'late_arrival' ? calculatedDelay : calculatedLost
        );
    
    const encoded = encodeURIComponent(textToShare);
    if (secretaryPhone) {
      return `https://wa.me/${secretaryPhone}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
  }, [attendanceType, absenceWhatsAppMessage, selectedTeacher, date, calculatedDelay, calculatedLost, secretaryPhone]);

  // Success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      const textToCopy = attendanceType === 'absence'
        ? absenceWhatsAppMessage
        : formatSecretaryNotification(
            attendanceType, 
            selectedTeacher?.name || '', 
            date, 
            attendanceType === 'late_arrival' ? calculatedDelay : calculatedLost
          );
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Replacement teacher options (excluding absent teacher)
  const replacementOptions = useMemo(() => {
    return teachers.filter(t => t.id !== selectedTeacherId && t.isActive);
  }, [teachers, selectedTeacherId]);

  // Suggested reasons
  const suggestedReasons: Record<StaffAttendanceType, string[]> = {
    absence: [
      'ظرف صحي / إجازة مرضية',
      'ظرف عائلي طارئ',
      'إذن رسمي معتمد',
      'غياب غير مبرر دون إخطار مسبق',
      'امتحان جامعي / دراسات عليا',
      'ارتباط بمأمورية مدرسية خارجية'
    ],
    late_arrival: [
      'ازدحام مروري شديد',
      'عطل مفاجئ في وسيلة المواصلات',
      'ظرف صحي طارئ صباحاً',
      'إذن تأخير معتمد من الإدارة',
      'تأخر دون إبداء سبب'
    ],
    early_leave: [
      'وعكة صحية طارئة أثناء اليوم الدراسي',
      'إذن رسمي لمراجعة مصلحة حكومية',
      'ظرف عائلي قاهر',
      'انصراف بدون إذن مسبق'
    ]
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    const teacherName = selectedTeacher.name;
    const now = Date.now();
    const record: StaffAttendanceRecord = {
      id: editingRecord?.id || `att_${now}_${Math.random().toString(36).substring(2, 7)}`,
      teacherId: selectedTeacher.id,
      teacherName: teacherName,
      date: date,
      type: attendanceType,
      reason: reason.trim() || _t('بدون تحديد', 'Unspecified', 'Nicht angegeben'),
      notes: notes.trim() || undefined,
      stageName: currentStageName,
      stageManagerId: linkedSecretary?.stageManagerId,
      stageSecretaryName: linkedSecretary?.name,
      notifiedSecretary: true,
      notifiedAt: new Date().toISOString(),
      updatedAt: now,
      originRevision: 1,
      deleted: false
    };

    let finalNotificationMessage = '';

    if (attendanceType === 'absence') {
      record.absenceScope = absenceScope;
      record.absenceStatus = absenceStatus;
      record.replacementAssignments = replacementAssignments;
      if (replacementAssignments.length > 0) {
        record.replacementTeacherId = replacementAssignments[0].replacementTeacherId;
        record.replacementTeacherName = replacementAssignments[0].replacementTeacherName;
        record.periodNumber = replacementAssignments[0].periodNumber;
        record.lessonClass = replacementAssignments[0].className;
      } else if (absenceScope === 'lesson_based') {
        record.periodNumber = periodNumber;
        record.lessonClass = lessonClass.trim() || undefined;
        if (replacementTeacherId) {
          record.replacementTeacherId = replacementTeacherId;
          record.replacementTeacherName = teachers.find(t => t.id === replacementTeacherId)?.name;
        }
      }
      finalNotificationMessage = absenceWhatsAppMessage;
    } else if (attendanceType === 'late_arrival') {
      record.scheduledArrivalTime = scheduledArrivalTime;
      record.actualArrivalTime = actualArrivalTime;
      record.delayMinutes = calculatedDelay;
      finalNotificationMessage = formatSecretaryNotification('late_arrival', teacherName, date, calculatedDelay);
    } else if (attendanceType === 'early_leave') {
      record.scheduledLeaveTime = scheduledLeaveTime;
      record.actualLeaveTime = actualLeaveTime;
      record.lostMinutes = calculatedLost;
      finalNotificationMessage = formatSecretaryNotification('early_leave', teacherName, date, calculatedLost);
    }

    onSave(record, finalNotificationMessage);

    // Auto open WhatsApp link
    try {
      window.open(whatsAppShareUrl, '_blank');
    } catch (err) {
      console.warn('WhatsApp window open warning:', err);
    }

    if (attendanceType === 'absence') {
      setShowSuccessDialog(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in" onClick={onClose}>
      <div 
        className="bg-surface border border-surface-border rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-surface-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl text-white ${
              attendanceType === 'absence' ? 'bg-rose-600' :
              attendanceType === 'late_arrival' ? 'bg-amber-600' : 'bg-orange-600'
            }`}>
              {attendanceType === 'absence' ? <UserMinus className="w-5 h-5" /> :
               attendanceType === 'late_arrival' ? <Clock className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-text-main">
                {editingRecord 
                  ? _t('تعديل سجل الحضور والانضباط', 'Edit Attendance Record', 'Anwesenheit bearbeiten')
                  : _t('تسجيل الحضور والانضباط المدرسي', 'Log Teacher Attendance & Discipline', 'Anwesenheit & Disziplin erfassen')}
              </h3>
              <p className="text-[11px] font-bold text-text-muted">
                {_t('تسجيل غياب أو تأخير مع إشعار فوري لسكرتارية المرحلة', 'Log absence or delay with instant secretary alert', 'Sofortige Benachrichtigung der Stufenleitung')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-xl text-text-muted cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Teacher Selection & Stage Badge */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-wider block">
              {_t('المعلم المعني', 'Teacher', 'Lehrer')} *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                disabled={!!editingRecord}
                className="sm:col-span-2 px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isHod ? `(${_t('رئيس القسم', 'HOD', 'Fachleiter')})` : ''}
                  </option>
                ))}
              </select>

              {/* Stage Badge & Secretary Preview */}
              <div className="p-2 bg-primary/5 border border-primary/20 rounded-xl flex flex-col justify-center">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-primary">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{currentStageName}</span>
                </div>
                {linkedSecretary && (
                  <span className="text-[9.5px] font-bold text-text-muted truncate mt-0.5">
                    {_t('السكرتيرة:', 'Sec:', 'Sekr:')} {linkedSecretary.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Event Type Tabs */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-wider block">
              {_t('نوع الحدث / المخالفة', 'Event Type', 'Ereignistyp')} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAttendanceType('absence')}
                className={`py-2.5 px-3 rounded-xl font-black text-xs flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                  attendanceType === 'absence'
                    ? 'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-300 shadow-xs'
                    : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                }`}
              >
                <UserMinus className="w-4 h-4" />
                <span>{_t('غياب', 'Absence', 'Abwesenheit')}</span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('late_arrival')}
                className={`py-2.5 px-3 rounded-xl font-black text-xs flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                  attendanceType === 'late_arrival'
                    ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300 shadow-xs'
                    : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{_t('تأخير صباحي', 'Late Arrival', 'Verspätung')}</span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('early_leave')}
                className={`py-2.5 px-3 rounded-xl font-black text-xs flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                  attendanceType === 'early_leave'
                    ? 'bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-950/40 dark:border-orange-700 dark:text-orange-300 shadow-xs'
                    : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span>{_t('انصراف مبكر', 'Early Leave', 'Früher Feierabend')}</span>
              </button>
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-wider block">
              {_t('التاريخ', 'Date', 'Datum')} *
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* ================= ABSENCE SECTION ================= */}
          {attendanceType === 'absence' && (
            <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {/* Full Day vs Lesson Based */}
                <div>
                  <label className="text-[10.5px] font-black text-text-muted uppercase tracking-wider block mb-1.5">
                    {_t('نطاق الغياب', 'Absence Scope', 'Umfang')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAbsenceScope('full_day')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        absenceScope === 'full_day'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-surface border-surface-border text-text-muted hover:text-text-main'
                      }`}
                    >
                      {_t('يوم كامل', 'Full Day', 'Ganzer Tag')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbsenceScope('lesson_based')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        absenceScope === 'lesson_based'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-surface border-surface-border text-text-muted hover:text-text-main'
                      }`}
                    >
                      {_t('بالحصة', 'Lesson Based', 'Stundenweise')}
                    </button>
                  </div>
                </div>

                {/* Excused vs Unexcused */}
                <div>
                  <label className="text-[10.5px] font-black text-text-muted uppercase tracking-wider block mb-1.5">
                    {_t('حالة العذر', 'Excuse Status', 'Entschuldigung')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAbsenceStatus('excused')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        absenceStatus === 'excused'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-surface border-surface-border text-text-muted hover:text-text-main'
                      }`}
                    >
                      {_t('بعذر', 'Excused', 'Entschuldigt')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbsenceStatus('unexcused')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        absenceStatus === 'unexcused'
                          ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                          : 'bg-surface border-surface-border text-text-muted hover:text-text-main'
                      }`}
                    >
                      {_t('بدون عذر', 'Unexcused', 'Unentschuldigt')}
                    </button>
                  </div>
                </div>
              </div>

              {/* SCHEDULE & REPLACEMENT COVERAGE SYSTEM */}
              <div className="p-3 bg-surface border border-rose-200/70 dark:border-rose-900/40 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-surface-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-text-main">
                        {_t('جدول حصص المعلم اليوم وخطة الاحتياطي', "Teacher's Schedule & Substitution Plan", 'Heutige Stunden & Vertretungsplan')}
                      </span>
                      {targetDayName && (
                        <span className="px-1.5 py-0.5 bg-primary-soft text-primary rounded text-[10px] font-bold">
                          {targetDayName}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {teacherScheduledLessonsToday.length > 0
                        ? _t(`عنده ${teacherScheduledLessonsToday.length} حصص مسجلة اليوم — تم اقتراح معلمين بدون تعارض مع جداولهم`, `Has ${teacherScheduledLessonsToday.length} classes today — substitutes suggested without timetable conflict`, `${teacherScheduledLessonsToday.length} Stunden heute`)
                        : _t('لم يتم العثور على حصص مجدولة للمعلم اليوم — يمكنك إضافة الحصص يدوياً', 'No scheduled classes found for this teacher today — you can add classes manually', 'Keine Stunden eingetragen')}
                    </p>
                  </div>

                  {/* Actions: Auto Suggest, Add class, Clear */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleReAutoSuggest}
                      className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                      title={_t('إعادة اقتراح وتوزيع المعلمين البدلاء بعدالة وبدون تعارض مع جداولهم', 'Re-suggest conflict-free replacements', 'Neu verteilen')}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{_t('اقتراح ذكي للبدلاء', 'Smart Distribute', 'Auto-Vertretung')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPeriod}
                      className="px-2 py-1 bg-surface-hover hover:bg-surface-border text-text-main border border-surface-border rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{_t('إضافة حصة', 'Add Period', '+ Stunde')}</span>
                    </button>
                    {replacementAssignments.some(r => r.replacementTeacherId) && (
                      <button
                        type="button"
                        onClick={handleClearAllReplacements}
                        className="px-2 py-1 text-text-muted hover:text-rose-600 text-[10px] font-bold cursor-pointer transition-colors"
                        title={_t('ترك جميع الحصص بدون تعويض (سيبها فاضية)', 'Leave all classes blank', 'Alle freilassen')}
                      >
                        {_t('سيبها فاضية للكل', 'Leave All Blank', 'Alle leeren')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Classes list */}
                {replacementAssignments.length === 0 ? (
                  <div className="py-4 text-center border border-dashed border-surface-border rounded-xl bg-surface-hover/20">
                    <p className="text-[11px] font-bold text-text-muted mb-2">
                      {_t('لا توجد حصص مضافة لهذا اليوم بعد', 'No periods added for today yet', 'Keine Stunden')}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddPeriod}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-black rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{_t('إضافة حصة وفصل لتعويضها', 'Add Class to Cover', 'Stunde hinzufügen')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {replacementAssignments.map((ra, idx) => {
                      // Partition other teachers into Available (no conflict) vs Busy (has class in that period)
                      const candidateTeachers = teachers.filter(t => t.id !== selectedTeacherId && t.isActive !== false);
                      const availableList: Teacher[] = [];
                      const busyList: Array<{ teacher: Teacher; busyClassName: string }> = [];

                      candidateTeachers.forEach(t => {
                        const status = isTeacherBusyInPeriod(t.id, targetDayKey, ra.periodNumber, schoolSettings);
                        if (status.isBusy) {
                          busyList.push({ teacher: t, busyClassName: status.busyClassName || 'حصة مجدولة' });
                        } else {
                          availableList.push(t);
                        }
                      });

                      return (
                        <div 
                          key={idx} 
                          className="p-2.5 bg-surface-hover/60 border border-surface-border rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs"
                        >
                          {/* Period Selector & Class Name */}
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <select
                              value={ra.periodNumber}
                              onChange={e => handleAssignmentChange(idx, 'periodNumber', e.target.value)}
                              className="px-2 py-1.5 bg-surface border border-surface-border rounded-lg font-black text-text-main text-[11px]"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                                <option key={p} value={p}>{_t(`الحصة ${p}`, `Period ${p}`, `Std. ${p}`)}</option>
                              ))}
                            </select>

                            <input
                              type="text"
                              value={ra.className}
                              onChange={e => handleAssignmentChange(idx, 'className', e.target.value)}
                              placeholder={_t('الفصل مثلاً 5A', 'Class e.g. 5A', 'Klasse z.B. 5A')}
                              className="w-24 sm:w-28 px-2 py-1.5 bg-surface border border-surface-border rounded-lg font-bold text-text-main text-[11px]"
                            />
                          </div>

                          {/* Replacement Teacher Dropdown */}
                          <div className="flex-1 w-full sm:w-auto">
                            <select
                              value={ra.replacementTeacherId || ''}
                              onChange={e => handleAssignmentChange(idx, 'teacherId', e.target.value)}
                              className={`w-full px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-colors ${
                                ra.replacementTeacherId
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-surface border-surface-border text-text-muted'
                              }`}
                            >
                              <option value="">
                                {_t('-- سيبها فاضية (لم يتم التعويض) --', '-- Leave Blank (No Substitute) --', '-- Freilassen --')}
                              </option>

                              {availableList.length > 0 && (
                                <optgroup label={_t('🟢 متاحون (لا يوجد تعارض مع جدولهم)', '🟢 Available (No Conflict)', '🟢 Verfügbare Lehrer')}>
                                  {availableList.map(t => (
                                    <option key={t.id} value={t.id}>
                                      🟢 {t.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}

                              {busyList.length > 0 && (
                                <optgroup label={_t('🔴 مشغولون (لديهم حصة أخرى في نفس الوقت)', '🔴 Busy (Has Class in This Period)', '🔴 Beschäftigt')}>
                                  {busyList.map(b => (
                                    <option key={b.teacher.id} value={b.teacher.id}>
                                      🔴 {b.teacher.name} ({b.busyClassName})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>

                          {/* Remove period button */}
                          <button
                            type="button"
                            onClick={() => handleRemovePeriod(idx)}
                            className="p-1.5 text-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors self-end sm:self-center"
                            title={_t('حذف هذه الحصة', 'Remove this class', 'Entfernen')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= LATE ARRIVAL SECTION ================= */}
          {attendanceType === 'late_arrival' && (
            <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-black text-text-muted uppercase tracking-wider block mb-1">
                    {_t('موعد الحضور المقرر', 'Scheduled Time', 'Soll-Zeit')}
                  </label>
                  <input
                    type="time"
                    value={scheduledArrivalTime}
                    onChange={e => setScheduledArrivalTime(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl font-bold text-text-main"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-black text-text-muted uppercase tracking-wider block mb-1">
                    {_t('موعد الحضور الفعلي', 'Actual Arrival Time', 'Ist-Zeit')}
                  </label>
                  <input
                    type="time"
                    value={actualArrivalTime}
                    onChange={e => setActualArrivalTime(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl font-bold text-text-main"
                    required
                  />
                </div>
              </div>

              {/* Auto Calculated Delay Display */}
              <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-text-main">
                    {_t('دقائق التأخير المحتسبة تلقائياً:', 'Calculated Delay Minutes:', 'Berechnete Verspätung:')}
                  </span>
                </div>
                <span className="text-base font-black text-amber-600 dark:text-amber-400">
                  {calculatedDelay} {_t('دقيقة', 'mins', 'Min.')}
                </span>
              </div>
            </div>
          )}

          {/* ================= EARLY LEAVE SECTION ================= */}
          {attendanceType === 'early_leave' && (
            <div className="p-3.5 bg-orange-500/5 border border-orange-500/20 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-black text-text-muted uppercase tracking-wider block mb-1">
                    {_t('موعد الانصراف المقرر', 'Scheduled Leave Time', 'Soll-Feierabend')}
                  </label>
                  <input
                    type="time"
                    value={scheduledLeaveTime}
                    onChange={e => setScheduledLeaveTime(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl font-bold text-text-main"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-black text-text-muted uppercase tracking-wider block mb-1">
                    {_t('موعد الانصراف الفعلي', 'Actual Leave Time', 'Ist-Feierabend')}
                  </label>
                  <input
                    type="time"
                    value={actualLeaveTime}
                    onChange={e => setActualLeaveTime(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl font-bold text-text-main"
                    required
                  />
                </div>
              </div>

              {/* Auto Calculated Lost Minutes */}
              <div className="p-2.5 bg-orange-500/15 border border-orange-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-orange-600" />
                  <span className="font-bold text-text-main">
                    {_t('الوقت المفقود المحتسب تلقائياً:', 'Calculated Lost Minutes:', 'Verlorene Zeit:')}
                  </span>
                </div>
                <span className="text-base font-black text-orange-600 dark:text-orange-400">
                  {calculatedLost} {_t('دقيقة', 'mins', 'Min.')}
                </span>
              </div>
            </div>
          )}

          {/* Reason Input with Preset Suggestions */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-wider block">
              {_t('سبب المخالفة / الملاحظة', 'Reason', 'Grund')} *
            </label>
            <input
              type="text"
              placeholder={_t('اكتب السبب هنا أو اختر من المقترحات أدناه...', 'Enter reason or choose below...', 'Grund angeben...')}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {suggestedReasons[attendanceType].map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(s)}
                  className="px-2 py-1 bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text-main border border-surface-border rounded-lg text-[10px] font-bold transition-all cursor-pointer text-right"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-wider block">
              {_t('ملاحظات إضافية / إجراءات رئيس القسم', 'Notes / Measures', 'Notizen')}
            </label>
            <textarea
              rows={2}
              placeholder={_t('أي توجيهات أو ملاحظات إدارية...', 'Administrative notes or directives...', 'Weitere Hinweise...')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Secretary Notification Preview Box (User's Exact Format & Requirements) */}
          {attendanceType === 'absence' ? (
            <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                  <MessageCircle className="w-4 h-4" />
                  <span>{_t('رسالة الواتساب للسكرتيرة (توزيع الاحتياطي):', 'Secretary WhatsApp Message (Substitutes):', 'WhatsApp-Vertretungsplan:')}</span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="px-2 py-1 bg-surface border border-surface-border rounded-lg text-[10.5px] font-bold text-text-muted hover:text-text-main flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? _t('تم النسخ!', 'Copied!', 'Kopiert!') : _t('نسخ نص الرسالة', 'Copy Text', 'Kopieren')}</span>
                </button>
              </div>

              {/* Formatted Message Box */}
              <pre className="p-3 bg-surface border border-surface-border rounded-xl text-[11px] font-mono leading-relaxed text-text-main whitespace-pre-wrap select-all overflow-x-auto">
                {absenceWhatsAppMessage}
              </pre>

              {/* Recipient status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10.5px] pt-1 text-text-muted border-t border-emerald-500/15">
                {linkedSecretary?.phone ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {_t('المستلم المباشر:', 'Recipient:', 'Empfänger:')} {linkedSecretary.name} ({linkedSecretary.phone})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {_t('لا توجد سكرتيرة مسجلة — سيتم فتح شاشة بحث واختيار المستلم في واتساب', 'No secretary registered — WhatsApp contact search will open', 'Keine Sekretärin registriert')}
                    </span>
                  </div>
                )}

                <a
                  href={whatsAppShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors self-end sm:self-auto shadow-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{_t('معاينة في واتساب', 'Preview WhatsApp', 'WhatsApp')}</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                <Bell className="w-3.5 h-3.5" />
                <span>{_t('إشعار سكرتارية المرحلة (يتم إرساله فور الحفظ):', 'Stage Secretary Alert (Sent automatically on save):', 'Sekretariatsbenachrichtigung:')}</span>
              </div>
              <p className="text-[11px] font-semibold text-text-main bg-surface p-2 rounded-lg border border-surface-border">
                {formatSecretaryNotification(
                  attendanceType, 
                  selectedTeacher?.name || '', 
                  date, 
                  attendanceType === 'late_arrival' ? calculatedDelay : calculatedLost
                )}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface hover:bg-surface-hover border border-surface-border rounded-xl font-bold text-text-muted cursor-pointer transition-colors"
            >
              {_t('إلغاء', 'Cancel', 'Abbrechen')}
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-white rounded-xl font-black flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all ${
                attendanceType === 'absence' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary-hover'
              }`}
            >
              {attendanceType === 'absence' ? <MessageCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>
                {attendanceType === 'absence'
                  ? _t('حفظ الغياب وخطة الاحتياطي والإرسال', 'Save Absence & Send Substitution', 'Speichern & Senden')
                  : _t('حفظ وتسجيل الإشعار', 'Save & Notify Secretary', 'Speichern & Benachrichtigen')}
              </span>
            </button>
          </div>
        </form>

        {/* SUCCESS & WHATSAPP SHARE DIALOG (Guaranteed access & copy) */}
        {showSuccessDialog && (
          <div className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-scale-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main">
                    {_t('تم تسجيل الغياب وحفظ خطة الاحتياطي بنجاح! 🎉', 'Absence & Substitutions Saved Successfully! 🎉', 'Erfolgreich gespeichert! 🎉')}
                  </h3>
                  <p className="text-[11px] font-bold text-text-muted">
                    {linkedSecretary?.phone 
                      ? _t(`تم تجهيز الرسالة لإرسالها لسكرتيرة المرحلة: ${linkedSecretary.name} (${linkedSecretary.phone})`, `Message prepared for ${linkedSecretary.name}`, 'Bereit zum Senden')
                      : _t('تم تجهيز الرسالة للمشاركة عبر واتساب — يمكنك البحث عن المستلم وإرسالها', 'Message prepared for WhatsApp contact search', 'Bereit zum Senden')}
                  </p>
                </div>
              </div>

              {/* Message Quote */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-black text-text-muted uppercase tracking-wider block">
                  {_t('نص الرسالة المرسلة:', 'Message Text:', 'Nachrichtentext:')}
                </label>
                <pre className="p-3.5 bg-surface-hover/80 border border-surface-border rounded-xl text-[11px] font-mono leading-relaxed text-text-main whitespace-pre-wrap select-all max-h-48 overflow-y-auto">
                  {absenceWhatsAppMessage}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-text-main cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? _t('تم النسخ!', 'Copied!', 'Kopiert!') : _t('نسخ نص الرسالة', 'Copy Text', 'Kopieren')}</span>
                </button>

                <a
                  href={whatsAppShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{_t('فتح محادثة واتساب الآن', 'Open WhatsApp Now', 'WhatsApp öffnen')}</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessDialog(false);
                    onClose();
                  }}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs cursor-pointer shadow-sm transition-colors"
                >
                  {_t('إتمام وإغلاق', 'Done & Close', 'Fertig')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
