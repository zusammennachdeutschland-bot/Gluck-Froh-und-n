import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SchoolSettings, SchoolPeriodRecord, SchoolPeriodSettings, SchoolDayPresence, CustomTimedSession, SchoolNote, SchoolNoteType } from '../types';
import { 
  BookOpen, Sparkles, Copy, Check, Upload, AlertTriangle, Info,
  Plus, Trash2, Calendar, Clock, Edit3, X, CheckCircle2, RefreshCw, FileText,
  Download, Share2, Tag, MapPin, Coffee, GraduationCap, Layers,
  Users, BarChart3, Shield, MessageSquare, AlertCircle, Bookmark,
  Phone, MessageCircle, ExternalLink, Filter, Search, Printer,
  ArrowLeftRight, CheckSquare, Zap, ChevronRight, Eye
} from 'lucide-react';
import { 
  getSchoolSettings, 
  calculatePeriodsTimings, 
  parseTimeToMinutes,
  formatMinutesToTime,
  getCustomSessionsForPeriod,
  getUnmatchedCustomSessions,
  getMergedDayScheduleItems,
  UnifiedDayTimelineItem
} from '../utils/schoolUtils';
import { SchoolScheduleExportModal } from './SchoolScheduleExportModal';
import { 
  normalizeClassCode, 
  CLASS_UNIFICATION_RULES_AR, 
  CLASS_UNIFICATION_RULES_EN 
} from '../utils/classNormalizer';

export const SchoolScheduleView: React.FC = () => {
  const { 
    profile, 
    updateProfile, 
    rebuildNotificationSchedules, 
    students = [],
    groups = [],
    lessons = [],
    hodStudents = [],
    hodComplaints = [],
    hodActionPlans = [],
    hodVisits = [],
    schoolNotes = [],
    addSchoolNote,
    deleteSchoolNote,
    setActiveTab,
    language, 
    _t, 
    t 
  } = useApp();
  
  const currentSettings = getSchoolSettings(profile);
  const [selectedDay, setSelectedDay] = useState<string>('0'); // '0' = Sunday
  const [editingPeriod, setEditingPeriod] = useState<{ dayKey: string; periodNumber: number } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Edit Form Fields
  const [subjectName, setSubjectName] = useState('');
  const [className, setClassName] = useState('');
  const [notes, setNotes] = useState('');

  // Custom Timed Session Modal & Form State
  const [isCustomSessionModalOpen, setIsCustomSessionModalOpen] = useState(false);
  const [editingCustomSession, setEditingCustomSession] = useState<CustomTimedSession | null>(null);
  const [customDayKey, setCustomDayKey] = useState<string>('0');
  const [customStartTime, setCustomStartTime] = useState<string>('14:30');
  const [customEndTime, setCustomEndTime] = useState<string>('15:30');
  const [customClassName, setCustomClassName] = useState<string>('');
  const [customSubjectName, setCustomSubjectName] = useState<string>('');
  const [customRoom, setCustomRoom] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [customSessionType, setCustomSessionType] = useState<string>('حصة إضافية / تقوية');

  // AI Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    parsedData: SchoolSettings | null;
  } | null>(null);

  // Full Reset State & Logic
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ===== NEW SYSTEM & HOD COMMAND BUTTONS STATE =====
  const [highlightedClass, setHighlightedClass] = useState<string | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isHodStudentsModalOpen, setIsHodStudentsModalOpen] = useState(false);
  const [selectedClassForHod, setSelectedClassForHod] = useState<string | null>(null);
  const [isConflictCheckerModalOpen, setIsConflictCheckerModalOpen] = useState(false);
  const [isSchoolNotesModalOpen, setIsSchoolNotesModalOpen] = useState(false);
  const [isCopyDayModalOpen, setIsCopyDayModalOpen] = useState(false);
  const [targetCopyDay, setTargetCopyDay] = useState<string>('1');

  // Quick School Note State
  const [noteFormText, setNoteFormText] = useState('');
  const [noteFormClass, setNoteFormClass] = useState('');
  const [noteFormPeriod, setNoteFormPeriod] = useState<number>(1);
  const [noteFormTag, setNoteFormTag] = useState<string>('📝 واجب');

  // Current Live Time for Live Class tracker
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenAddCustomSession = (prefillDayKey?: string) => {
    setEditingCustomSession(null);
    setCustomDayKey(prefillDayKey || selectedDay || '0');
    setCustomStartTime('14:30');
    setCustomEndTime('15:30');
    setCustomClassName('');
    setCustomSubjectName('');
    setCustomRoom('');
    setCustomNotes('');
    setCustomSessionType('حصة إضافية / تقوية');
    setIsCustomSessionModalOpen(true);
  };

  const handleOpenEditCustomSession = (session: CustomTimedSession) => {
    setEditingCustomSession(session);
    setCustomDayKey(session.dayKey);
    setCustomStartTime(session.startTime || '14:30');
    setCustomEndTime(session.endTime || '15:30');
    setCustomClassName(session.className || '');
    setCustomSubjectName(session.subjectName || '');
    setCustomRoom(session.room || '');
    setCustomNotes(session.notes || '');
    setCustomSessionType(session.sessionType || 'حصة إضافية / تقوية');
    setIsCustomSessionModalOpen(true);
  };

  const handleSaveCustomSession = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customClassName.trim()) {
      alert(_t('يرجى إدخال اسم الفصل أو المجموعة', 'Please enter class or group name', 'Bitte Klassen-/Gruppennamen eingeben'));
      return;
    }

    const existingCustoms: CustomTimedSession[] = currentSettings.customTimedSessions || [];
    let updatedCustoms: CustomTimedSession[];
    const nowTime = Date.now();

    const teacherId = profile?.id || 'hod';
    const teacherName = profile?.displayName || profile?.name || 'المعلم';

    if (editingCustomSession) {
      updatedCustoms = existingCustoms.map(s => {
        if (s.id === editingCustomSession.id) {
          return {
            ...s,
            dayKey: customDayKey,
            startTime: customStartTime,
            endTime: customEndTime,
            className: customClassName.trim(),
            subjectName: customSubjectName.trim(),
            room: customRoom.trim() || undefined,
            notes: customNotes.trim() || undefined,
            sessionType: customSessionType,
            updatedAt: nowTime
          };
        }
        return s;
      });
    } else {
      const newSession: CustomTimedSession = {
        id: `custom_sess_${nowTime}_${Math.random().toString(36).substring(2, 7)}`,
        teacherId,
        teacherName,
        dayKey: customDayKey,
        startTime: customStartTime,
        endTime: customEndTime,
        className: customClassName.trim(),
        subjectName: customSubjectName.trim(),
        room: customRoom.trim() || undefined,
        notes: customNotes.trim() || undefined,
        sessionType: customSessionType,
        createdAt: new Date().toISOString(),
        updatedAt: nowTime
      };
      updatedCustoms = [...existingCustoms, newSession];
    }

    const updatedSettings: SchoolSettings = {
      ...currentSettings,
      customTimedSessions: updatedCustoms
    };

    updateProfile({ schoolSettings: updatedSettings });
    setIsCustomSessionModalOpen(false);
    setToastMessage(_t('تم حفظ الحصة المخصصة بنجاح ✅', 'Custom session saved successfully ✅', 'Spezielle Stunde erfolgreich gespeichert ✅'));
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteCustomSession = (sessionId: string) => {
    const existingCustoms: CustomTimedSession[] = currentSettings.customTimedSessions || [];
    const updatedCustoms = existingCustoms.filter(s => s.id !== sessionId);

    const updatedSettings: SchoolSettings = {
      ...currentSettings,
      customTimedSessions: updatedCustoms
    };

    updateProfile({ schoolSettings: updatedSettings });
    setIsCustomSessionModalOpen(false);
    setToastMessage(_t('تم حذف الحصة بنجاح', 'Session deleted successfully', 'Stunde gelöscht'));
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFullReset = async () => {
    if (isResetting) return;
    setIsResetting(true);

    try {
      // 1. Preflight calculation of deletion scope
      const preflightLessonsCount = Object.values(currentSettings.schedule).reduce(
        (acc, day) => acc + (day || []).filter(r => r.subjectName || r.className).length,
        0
      );
      console.log(`[School Schedule Reset Preflight] Scope of deletion calculated:`, {
        schoolLessons: preflightLessonsCount,
        derivedCalendarEvents: preflightLessonsCount,
        derivedNotifications: preflightLessonsCount
      });

      // 2. Perform Full Cascade Delete on School Settings schedule and custom durations
      const resetSchoolSettings = {
        ...currentSettings,
        periodSettings: {
          ...currentSettings.periodSettings,
          customDurations: {}
        },
        schedule: {
          '0': [],
          '1': [],
          '2': [],
          '3': [],
          '4': [],
          '5': [],
          '6': []
        }
      };

      // Atomic Update Profile
      await updateProfile({
        schoolSettings: resetSchoolSettings
      });

      // 3. Rebuild Notification Schedules immediately so school notifications are cancelled
      await rebuildNotificationSchedules();

      // 4. Verify after deletion to ensure no orphaned data
      const checkProfile = { ...profile, schoolSettings: resetSchoolSettings };
      const isVerified = verifyReset(checkProfile);
      
      if (!isVerified) {
        throw new Error('Data integrity verification failed after delete operation.');
      }

      // 5. Success State
      setToastMessage(_t('تم مسح جدول المدرسة بالكامل.', 'School schedule cleared successfully.', 'Schulplan erfolgreich gelöscht.'));
      setTimeout(() => setToastMessage(null), 3000);

      // Close all modals
      setIsConfirmResetOpen(false);
      setIsImportModalOpen(false);
    } catch (error: any) {
      console.error('[School Schedule Reset Error]:', error);
      alert(_t(
        'تعذر إكمال مسح جدول المدرسة بالكامل. لم يتم تأكيد نجاح العملية، يرجى المحاولة مرة أخرى.',
        'Could not complete the full school schedule reset. Operation success not confirmed, please try again.',
        'Der Schulplan konnte nicht vollständig gelöscht werden. Erfolg der Aktion nicht bestätigt, bitte erneut versuchen.'
      ));
    } finally {
      setIsResetting(false);
    }
  };

  const verifyReset = (checkProfile: any) => {
    const settings = checkProfile.schoolSettings;
    if (!settings) return false;
    const days = ['0', '1', '2', '3', '4', '5', '6'];
    for (const day of days) {
      const list = settings.schedule?.[day] || [];
      if (list.filter((r: any) => r.subjectName || r.className).length > 0) {
        return false;
      }
    }
    if (Object.keys(settings.periodSettings?.customDurations || {}).length > 0) {
      return false;
    }
    return true;
  };

  const isRtl = language === 'ar';

  const daysList = [
    { key: '0', label: _t('الأحد', 'Sunday', 'Sonntag'), short: _t('أحد', 'Sun', 'So') },
    { key: '1', label: _t('الإثنين', 'Monday', 'Montag'), short: _t('اثنين', 'Mon', 'Mo') },
    { key: '2', label: _t('الثلاثاء', 'Tuesday', 'Dienstag'), short: _t('ثلاثاء', 'Tue', 'Di') },
    { key: '3', label: _t('الأربعاء', 'Wednesday', 'Mittwoch'), short: _t('أربعاء', 'Wed', 'Mi') },
    { key: '4', label: _t('الخميس', 'Thursday', 'Donnerstag'), short: _t('خميس', 'Thu', 'Do') },
    { key: '5', label: _t('الجمعة', 'Friday', 'Freitag'), short: _t('جمعة', 'Fri', 'Fr') },
    { key: '6', label: _t('السبت', 'Saturday', 'Samstag'), short: _t('سبت', 'Sat', 'Sa') }
  ];

  // Generated timings for the selected day (or general)
  const activePresence = currentSettings.presence[selectedDay] || { active: false, arrivalTime: '07:30', departureTime: '14:30' };
  const calculatedPeriods = calculatePeriodsTimings(currentSettings.periodSettings);

  // Trigger editing popup
  const startEditPeriod = (dayKey: string, periodNumber: number) => {
    const daySchedule = currentSettings.schedule[dayKey] || [];
    const record = daySchedule.find(p => p.periodNumber === periodNumber);
    
    setSubjectName(record?.subjectName || '');
    setClassName(record?.className || '');
    setNotes(record?.notes || '');
    setEditingPeriod({ dayKey, periodNumber });
  };

  // Save manual edit
  const savePeriodEdit = () => {
    if (!editingPeriod) return;
    const { dayKey, periodNumber } = editingPeriod;
    
    const daySchedule = [...(currentSettings.schedule[dayKey] || [])];
    const index = daySchedule.findIndex(p => p.periodNumber === periodNumber);
    
    const updatedRecord: SchoolPeriodRecord = {
      periodNumber,
      subjectName: subjectName.trim() || undefined,
      className: className.trim() || undefined,
      notes: notes.trim() || undefined
    };

    if (index !== -1) {
      daySchedule[index] = updatedRecord;
    } else {
      daySchedule.push(updatedRecord);
    }

    const updatedSchedule = {
      ...currentSettings.schedule,
      [dayKey]: daySchedule
    };

    updateProfile({
      schoolSettings: {
        ...currentSettings,
        schedule: updatedSchedule
      }
    });

    setEditingPeriod(null);
  };

  // Clear specific period
  const clearPeriod = (dayKey: string, periodNumber: number) => {
    const daySchedule = (currentSettings.schedule[dayKey] || []).filter(p => p.periodNumber !== periodNumber);
    
    updateProfile({
      schoolSettings: {
        ...currentSettings,
        schedule: {
          ...currentSettings.schedule,
          [dayKey]: daySchedule
        }
      }
    });
  };

  // 1. Copy Selected Day to Target Day
  const handleCopyDaySchedule = (targetDayKey: string) => {
    const sourceSchedule = currentSettings.schedule[selectedDay] || [];
    const sourceCustoms = (currentSettings.customTimedSessions || []).filter(s => s.dayKey === selectedDay);
    
    // Copy periods
    const updatedSchedule = {
      ...currentSettings.schedule,
      [targetDayKey]: JSON.parse(JSON.stringify(sourceSchedule))
    };

    // Also copy any custom timed sessions to the new day with new IDs
    const otherCustoms = (currentSettings.customTimedSessions || []).filter(s => s.dayKey !== targetDayKey);
    const copiedCustoms: CustomTimedSession[] = sourceCustoms.map(s => ({
      ...s,
      id: `custom_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      dayKey: targetDayKey,
      updatedAt: Date.now()
    }));

    updateProfile({
      schoolSettings: {
        ...currentSettings,
        schedule: updatedSchedule,
        customTimedSessions: [...otherCustoms, ...copiedCustoms]
      }
    });

    const srcDayName = daysList.find(d => d.key === selectedDay)?.label || selectedDay;
    const tgtDayName = daysList.find(d => d.key === targetDayKey)?.label || targetDayKey;
    setIsCopyDayModalOpen(false);
    setToastMessage(_t(`تم نسخ جدول يوم (${srcDayName}) إلى يوم (${tgtDayName}) بنجاح ✅`, `Schedule of ${srcDayName} copied to ${tgtDayName} successfully ✅`, `Tagesplan erfolgreich nach ${tgtDayName} kopiert ✅`));
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 2. Clear Only Selected Day
  const handleClearSelectedDay = () => {
    const dayObj = daysList.find(d => d.key === selectedDay);
    const dayLabel = dayObj ? dayObj.label : selectedDay;

    const updatedSchedule = {
      ...currentSettings.schedule,
      [selectedDay]: []
    };

    const remainingCustoms = (currentSettings.customTimedSessions || []).filter(s => s.dayKey !== selectedDay);

    updateProfile({
      schoolSettings: {
        ...currentSettings,
        schedule: updatedSchedule,
        customTimedSessions: remainingCustoms
      }
    });

    setToastMessage(_t(`تم تفريغ حصص يوم (${dayLabel}) بنجاح 🗑️`, `Cleared schedule for ${dayLabel} 🗑️`, `Stunden für ${dayLabel} geleert 🗑️`));
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 3. Quick Print
  const handleQuickPrint = () => {
    window.print();
  };

  // 4. Quick Add School Note
  const handleAddQuickSchoolNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteFormText.trim()) return;

    addSchoolNote({
      type: 'lesson',
      text: noteFormText.trim(),
      tags: [noteFormTag],
      className: noteFormClass.trim() || undefined,
      periodNumber: noteFormPeriod || undefined,
      teacherId: profile?.id || 'hod',
      teacherName: profile?.displayName || profile?.name || 'المعلم',
      pinned: false
    });

    setNoteFormText('');
    setToastMessage(_t('تم تسجيل الملاحظة المدرسية بنجاح 📝', 'School note saved successfully 📝', 'Schulnotiz erfolgreich gespeichert 📝'));
    setTimeout(() => setToastMessage(null), 3000);
  };

  // AI Import Prompt Generator
  const generateAIPrompt = (): string => {
    return `أنت مساعد خبير وفائق الدقة في قراءة واستخراج جداول الحصص المدرسية لربطها بقوائم الطلاب.
سأقوم بإرفاق صورة أو نص أو ملف لجدول الحصص المدرسي الأسبوعي الخاص بي.
مهمتك استخراج الجدول وإخراجه بتنسيق JSON نظيف وصارم يطابق الـ Schema التالي تماماً:

\`\`\`json
{
  "presence": {
    "0": { "active": true, "arrivalTime": "07:30", "departureTime": "14:30" },
    "1": { "active": true, "arrivalTime": "07:30", "departureTime": "14:30" },
    "2": { "active": true, "arrivalTime": "07:30", "departureTime": "14:30" },
    "3": { "active": true, "arrivalTime": "07:30", "departureTime": "14:30" },
    "4": { "active": true, "arrivalTime": "07:30", "departureTime": "14:30" },
    "5": { "active": false, "arrivalTime": "07:30", "departureTime": "14:30" },
    "6": { "active": false, "arrivalTime": "07:30", "departureTime": "14:30" }
  },
  "periodSettings": {
    "periodsCount": 8,
    "firstPeriodStart": "08:00",
    "defaultDuration": 45,
    "customDurations": {}
  },
  "schedule": {
    "0": [
      { "periodNumber": 1, "subjectName": "Deutsch", "className": "10A", "notes": "" },
      { "periodNumber": 2, "subjectName": "Deutsch", "className": "10B", "notes": "" }
    ],
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": []
  }
}
\`\`\`

قواعد وشروط إلزامية بالغة الأهمية:
1. ${CLASS_UNIFICATION_RULES_AR}
2. أيام الأسبوع تمثل من "0" (الأحد) إلى "6" (السبت). فَعّل ("active": true) فقط أيام العمل والدراسة الفعلية.
3. وقت الحضور ووقت الانصراف يمثلان فترة التواجد الإجمالية في المدرسة (مثال: الحضور 07:30 والانصراف 14:30).
4. ترقيم الحصص "periodNumber" يبدأ من 1 تصاعدياً حتى "periodsCount".
5. ⚠️ قاعدة حاسمة بخصوص الفسحة / الاستراحة (Break / Recess):
   - الفسحة تُحسب دائماً حصة واحدة فقط لا غير (موضع حصة واحدة بالضبط = Exactly 1 period slot)، ولا تأخذ أكثر من حصة واحدة أبداً.
   - يجب احتساب الفسحة ضمن ترقيم الحصص التسلسلي (periodNumber) كحصة مفردة، بحيث:
     * إذا كان الجدول يحتوي على 3 حصص ثم الفسحة، فإن الفسحة تكون دائماً هي "الحصة رقم 4" (حصة واحدة فقط).
     * وتكون الحصة الدراسية التالية للفسحة مباشرة هي "الحصة رقم 5"، وتُحسب الفسحة كحصة واحدة ضمن إجمالي عدد الحصص (periodsCount).
   - إذا رغبت بإدراج فترة الفسحة نفسها في مصفوفة schedule، يمكن وضع subjectName: "فسحة" أو "Break" وترك className فارغاً.
   - إذا كانت مدة الفسحة مختلفة عن المدة الافتراضية (مثلاً 30 دقيقة والافتراضي 45 دقيقة)، يمكنك وضع مدة الفسحة بالدقائق في "customDurations" لرقم حصتها (مثال: "customDurations": { "4": 30 }).
6. subjectName هو اسم المادة (يرجى توحيده لـ "Deutsch" لمادة اللغة الألمانية).
7. className هو اسم الفصل ويجب كتابته بالصيغة القياسية الموحدة (مثل 10A, 11B, 7A...) بدون مسافات ليتطابق تماماً مع كشوف وفلاتر الطلاب.
8. استخدم نظام التوقيت 24 ساعة (HH:MM) مثل "08:00" و "13:30".
9. أخرج فقط كود JSON النظيف داخل وسم \`\`\`json و \`\`\` بدون أي نصوص تمهيدية أو شروحات.`;
  };

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(generateAIPrompt());
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  // Validate the AI copied input
  const handleValidateImport = () => {
    setValidationResult(null);
    const errors: string[] = [];
    const warnings: string[] = [];
    let parsed: any = null;

    try {
      // Clean up markdown markers if exist
      let rawJson = importText.trim();
      if (rawJson.startsWith('```')) {
        const lines = rawJson.split('\n');
        rawJson = lines.filter((l, i) => i > 0 && i < lines.length - 1).join('\n');
      }
      
      parsed = JSON.parse(rawJson.trim());
    } catch (e: any) {
      setValidationResult({
        isValid: false,
        errors: [_t('صيغة JSON غير صالحة. يرجى مراجعة القيمة المدخلة والتأكد من أنها كود JSON سليم.', 'Invalid JSON format. Please double check the pasted content.', 'Ungültiges JSON-Format. Bitte überprüfen Sie den eingefügten Text.')],
        warnings: [],
        parsedData: null
      });
      return;
    }

    // Schema validation
    if (!parsed.presence || typeof parsed.presence !== 'object') {
      errors.push(_t('حقل presence مفقود أو غير صحيح.', 'Missing or invalid "presence" object.', 'Feld "presence" fehlt oder ist ungültig.'));
    }
    if (!parsed.periodSettings || typeof parsed.periodSettings !== 'object') {
      errors.push(_t('حقل periodSettings مفقود أو غير صحيح.', 'Missing or invalid "periodSettings" object.', 'Feld "periodSettings" fehlt oder ist ungültig.'));
    }
    if (!parsed.schedule || typeof parsed.schedule !== 'object') {
      errors.push(_t('حقل schedule مفقود أو غير صحيح.', 'Missing or invalid "schedule" object.', 'Feld "schedule" fehlt oder ist ungültig.'));
    }

    if (errors.length > 0) {
      setValidationResult({ isValid: false, errors, warnings, parsedData: null });
      return;
    }

    // Deeper logical validations
    // 1. Check days
    const validDayKeys = ['0', '1', '2', '3', '4', '5', '6'];
    Object.keys(parsed.presence).forEach(k => {
      if (!validDayKeys.includes(k)) {
        errors.push(_t(`يوم غير معروف: ${k}. يجب استخدام قيم من 0 لـ 6.`, `Unknown day key: ${k}. Must be between 0 and 6.`, `Unbekannter Tagesschlüssel: ${k}. Muss zwischen 0 und 6 liegen.`));
      } else {
        const pDay = parsed.presence[k];
        if (pDay.active) {
          if (!pDay.arrivalTime || !pDay.departureTime) {
            errors.push(_t(`بيانات الحضور والانصراف ناقصة لليوم: ${k}.`, `Missing arrival/departure time for active day: ${k}.`, `Fehlende Ankunfts-/Abfahrtszeit für aktiven Tag: ${k}.`));
          } else {
            const arrMin = parseTimeToMinutes(pDay.arrivalTime);
            const depMin = parseTimeToMinutes(pDay.departureTime);
            if (depMin <= arrMin) {
              errors.push(_t(`وقت الانصراف يقع قبل أو يساوي وقت الحضور في اليوم: ${k}.`, `Departure time is before or equal to arrival time on day: ${k}.`, `Die Abfahrtszeit liegt vor oder ist gleich der Ankunftszeit am Tag: ${k}.`));
            }
          }
        }
      }
    });

    // 2. Period Settings validation
    const { periodsCount, firstPeriodStart, defaultDuration } = parsed.periodSettings;
    if (typeof periodsCount !== 'number' || periodsCount < 1 || periodsCount > 15) {
      errors.push(_t('عدد الحصص اليومية يجب أن يكون رقماً بين 1 و 15.', 'Periods count must be a number between 1 and 15.', 'Die Anzahl der Stunden muss eine Zahl zwischen 1 und 15 sein.'));
    }
    if (!firstPeriodStart || !firstPeriodStart.includes(':')) {
      errors.push(_t('ميعاد بداية الحصة الأولى غير صحيح.', 'First period start time is invalid.', 'Der Beginn der ersten Stunde ist ungültig.'));
    }
    if (typeof defaultDuration !== 'number' || defaultDuration < 5) {
      errors.push(_t('مدة الحصة الافتراضية يجب ألا تقل عن 5 دقائق.', 'Default duration must be at least 5 minutes.', 'Die Standard-Dauer muss mindestens 5 Minuten betragen.'));
    }

    // 3. Schedule conflicts & out-of-presence checks
    Object.keys(parsed.schedule).forEach(dayKey => {
      if (!validDayKeys.includes(dayKey)) return;
      const dayPresence = parsed.presence[dayKey] || { active: false };
      const dayClasses: any[] = parsed.schedule[dayKey] || [];
      
      const seenPeriodNumbers = new Set<number>();

      dayClasses.forEach(p => {
        if (seenPeriodNumbers.has(p.periodNumber)) {
          errors.push(_t(`رقم حصة مكرر (${p.periodNumber}) في اليوم: ${dayKey}.`, `Duplicate period number (${p.periodNumber}) detected on day: ${dayKey}.`, `Doppelte Schulstundennummer (${p.periodNumber}) am Tag erkannt: ${dayKey}.`));
        }
        seenPeriodNumbers.add(p.periodNumber);

        if (p.periodNumber < 1 || p.periodNumber > (periodsCount || 7)) {
          warnings.push(_t(`الحصة رقم ${p.periodNumber} تقع خارج نطاق الحصص المحددة اليومية.`, `Period number ${p.periodNumber} exceeds configured periods count.`, `Schulstunde Nr. ${p.periodNumber} überschreitet die konfigurierte Stundenanzahl.`));
        }
      });
      
      // Check if classes fit inside presence block boundaries
      if (dayPresence.active && dayPresence.arrivalTime && dayPresence.departureTime && dayClasses.length > 0) {
        const presenceStart = parseTimeToMinutes(dayPresence.arrivalTime);
        const presenceEnd = parseTimeToMinutes(dayPresence.departureTime);

        // calculate current timings
        const pSettings: SchoolPeriodSettings = {
          periodsCount: parsed.periodSettings.periodsCount || 7,
          firstPeriodStart: parsed.periodSettings.firstPeriodStart || '08:00',
          defaultDuration: parsed.periodSettings.defaultDuration || 45,
          customDurations: parsed.periodSettings.customDurations || {}
        };
        
        const calculated = calculatePeriodsTimings(pSettings);
        dayClasses.forEach(p => {
          const timing = calculated.find(c => c.periodNumber === p.periodNumber);
          if (timing) {
            const classStart = parseTimeToMinutes(timing.startTime);
            const classEnd = parseTimeToMinutes(timing.endTime);
            if (classStart < presenceStart || classEnd > presenceEnd) {
              warnings.push(_t(`الحصة رقم ${p.periodNumber} في اليوم (${dayKey}) تقع خارج نطاق وقت الحضور والانصراف العام للمدرسة.`, `Period ${p.periodNumber} on day (${dayKey}) falls outside school presence hours.`, `Schulstunde ${p.periodNumber} am Tag (${dayKey}) liegt außerhalb der allgemeinen Schulpräsenzzeiten.`));
            }
          }
        });
      }
    });

    setValidationResult({
      isValid: errors.length === 0,
      errors,
      warnings,
      parsedData: parsed
    });
  };

  // Perform absolute import
  const confirmImport = () => {
    if (!validationResult || !validationResult.parsedData) return;
    
    const normalizedData = { ...validationResult.parsedData };
    if (normalizedData.schedule) {
      const newSchedule: Record<string, any[]> = {};
      Object.keys(normalizedData.schedule).forEach(dayKey => {
        newSchedule[dayKey] = (normalizedData.schedule[dayKey] || []).map((p: any) => ({
          ...p,
          className: normalizeClassCode(p.className || '')
        }));
      });
      normalizedData.schedule = newSchedule;
    }

    updateProfile({
      schoolSettings: normalizedData
    });

    setImportText('');
    setValidationResult(null);
    setIsImportModalOpen(false);
  };

  // State to manually display table even if empty
  const [showTableEvenIfEmpty, setShowTableEvenIfEmpty] = useState(false);

  // 1. Classes Count: count unique group names (className)
  const uniqueClassesSet = new Set<string>();
  Object.values(currentSettings.schedule).forEach((dayRecords) => {
    dayRecords.forEach((record) => {
      if (record.className && record.className.trim()) {
        uniqueClassesSet.add(record.className.trim());
      }
    });
  });
  const totalUniqueClasses = uniqueClassesSet.size;

  // 2. Stages Count: extract clean stage from group names
  const extractStage = (classNameStr: string): string => {
    const trimmed = classNameStr.trim();
    const digitMatch = trimmed.match(/\d+/);
    if (digitMatch) {
      return digitMatch[0];
    }
    const tokens = trimmed.split(/[\s\-\/_]+/);
    if (tokens.length > 0 && tokens[0]) {
      return tokens[0].toLowerCase();
    }
    return trimmed.toLowerCase();
  };

  const uniqueStagesSet = new Set<string>();
  Object.values(currentSettings.schedule).forEach((dayRecords) => {
    dayRecords.forEach((record) => {
      if (record.className && record.className.trim()) {
        const stage = extractStage(record.className);
        if (stage) {
          uniqueStagesSet.add(stage);
        }
      }
    });
  });
  const totalUniqueStages = uniqueStagesSet.size;

  // 3. Weekly Lessons: count non-empty lessons
  let totalWeeklyLessons = 0;
  Object.values(currentSettings.schedule).forEach((dayRecords) => {
    dayRecords.forEach((record) => {
      if (record.subjectName || record.className) {
        totalWeeklyLessons++;
      }
    });
  });

  // 4. Detailed Class Workload Map
  const classWorkloadMap = useMemo(() => {
    const map: Record<string, { count: number; days: Set<string>; periods: Array<{ dayKey: string; periodNumber: number; subject?: string }> }> = {};
    Object.entries(currentSettings.schedule).forEach(([dayKey, dayRecords]) => {
      (dayRecords || []).forEach(record => {
        if (record.className && record.className.trim()) {
          const cls = normalizeClassCode(record.className.trim());
          if (!map[cls]) {
            map[cls] = { count: 0, days: new Set(), periods: [] };
          }
          map[cls].count += 1;
          map[cls].days.add(dayKey);
          map[cls].periods.push({ dayKey, periodNumber: record.periodNumber, subject: record.subjectName });
        }
      });
    });
    return map;
  }, [currentSettings.schedule]);

  // 5. Stage Workload Map
  const stageWorkloadMap = useMemo(() => {
    const map: Record<string, number> = {};
    Object.entries(classWorkloadMap).forEach(([cls, data]: [string, { count: number; days: Set<string>; periods: any[] }]) => {
      const stage = extractStage(cls);
      map[stage] = (map[stage] || 0) + data.count;
    });
    return map;
  }, [classWorkloadMap]);

  // 6. Cross-reference Tutoring Conflicts Scanner
  const tutoringConflictsList = useMemo(() => {
    const conflicts: Array<{
      lessonId: string;
      studentOrGroup: string;
      dayKey: string;
      dayLabel: string;
      lessonTime: string;
      conflictType: 'presence' | 'period';
      detail: string;
    }> = [];

    lessons.forEach(l => {
      if (!l.date || !l.time) return;
      const lDate = new Date(l.date);
      const dayKey = String(lDate.getDay());
      const dayPresence = currentSettings.presence[dayKey];
      if (!dayPresence || !dayPresence.active) return;

      const lessonStartMin = parseTimeToMinutes(l.time);
      const lessonDuration = l.durationMinutes || 60;
      const lessonEndMin = lessonStartMin + lessonDuration;

      const presenceStart = parseTimeToMinutes(dayPresence.arrivalTime || '07:30');
      const presenceEnd = parseTimeToMinutes(dayPresence.departureTime || '14:30');

      if (lessonStartMin < presenceEnd && lessonEndMin > presenceStart) {
        const daySchedule = currentSettings.schedule[dayKey] || [];
        const overlappingPeriod = calculatedPeriods.find(p => {
          const pStart = parseTimeToMinutes(p.startTime);
          const pEnd = parseTimeToMinutes(p.endTime);
          return lessonStartMin < pEnd && lessonEndMin > pStart;
        });

        const dayObj = daysList.find(d => d.key === dayKey);
        const scheduledClass = overlappingPeriod 
          ? daySchedule.find(r => r.periodNumber === overlappingPeriod.periodNumber) 
          : null;

        conflicts.push({
          lessonId: l.id,
          studentOrGroup: l.studentName || l.groupName || l.title || _t('درس خصوصي', 'Private Lesson', 'Privatunterricht'),
          dayKey,
          dayLabel: dayObj?.label || dayKey,
          lessonTime: `${l.time} (${lessonDuration}m)`,
          conflictType: scheduledClass?.className ? 'period' : 'presence',
          detail: scheduledClass?.className 
            ? _t(`يتعارض مباشرة مع الحصة ${overlappingPeriod?.periodNumber} (فصل ${scheduledClass.className})`, `Directly conflicts with period ${overlappingPeriod?.periodNumber} (class ${scheduledClass.className})`, `Kollidiert direkt mit Stunde ${overlappingPeriod?.periodNumber} (Klasse ${scheduledClass.className})`)
            : _t(`يتعارض مع فترة التواجد المدرسي (${dayPresence.arrivalTime} - ${dayPresence.departureTime})`, `Conflicts with school presence hours (${dayPresence.arrivalTime} - ${dayPresence.departureTime})`, `Kollidiert mit Schulpräsenzzeit (${dayPresence.arrivalTime} - ${dayPresence.departureTime})`)
        });
      }
    });

    return conflicts;
  }, [lessons, currentSettings.schedule, currentSettings.presence, calculatedPeriods, daysList, _t]);

  // 7. Live Current Class / Session Detection
  const liveCurrentSession = useMemo(() => {
    const now = new Date();
    const todayDayKey = String(now.getDay());
    const dayPresence = currentSettings.presence[todayDayKey];
    if (!dayPresence || !dayPresence.active) return null;

    const currentMin = currentTimeMinutes;
    
    // Check standard periods
    const activePeriodTiming = calculatedPeriods.find(p => {
      const s = parseTimeToMinutes(p.startTime);
      const e = parseTimeToMinutes(p.endTime);
      return currentMin >= s && currentMin <= e;
    });

    if (activePeriodTiming) {
      const daySchedule = currentSettings.schedule[todayDayKey] || [];
      const rec = daySchedule.find(r => r.periodNumber === activePeriodTiming.periodNumber);
      const endMin = parseTimeToMinutes(activePeriodTiming.endTime);
      const minsRemaining = Math.max(0, endMin - currentMin);

      return {
        type: 'standard',
        periodNumber: activePeriodTiming.periodNumber,
        startTime: activePeriodTiming.startTime,
        endTime: activePeriodTiming.endTime,
        minsRemaining,
        className: rec?.className || '',
        subjectName: rec?.subjectName || '',
        isBreak: !rec?.className && (rec?.subjectName?.includes('فسحة') || rec?.subjectName?.toLowerCase().includes('break'))
      };
    }

    // Check custom timed sessions
    const todaysCustoms = (currentSettings.customTimedSessions || []).filter(s => s.dayKey === todayDayKey);
    for (const cs of todaysCustoms) {
      const s = parseTimeToMinutes(cs.startTime);
      const e = parseTimeToMinutes(cs.endTime);
      if (currentMin >= s && currentMin <= e) {
        const minsRemaining = Math.max(0, e - currentMin);
        return {
          type: 'custom',
          periodNumber: null,
          startTime: cs.startTime,
          endTime: cs.endTime,
          minsRemaining,
          className: cs.className,
          subjectName: cs.subjectName || '',
          isBreak: false
        };
      }
    }

    return null;
  }, [currentTimeMinutes, currentSettings.presence, currentSettings.schedule, currentSettings.customTimedSessions, calculatedPeriods]);

  // 8. Class to HOD and System Students Link Map
  const classStudentsMap = useMemo(() => {
    const map: Record<string, {
      hodStudentsList: typeof hodStudents;
      systemStudentsList: typeof students;
      actionPlansCount: number;
      complaintsCount: number;
    }> = {};

    const allClassCodes = Object.keys(classWorkloadMap);

    allClassCodes.forEach(cls => {
      const normCls = normalizeClassCode(cls).toLowerCase();
      const stage = extractStage(cls);

      const matchingHod = hodStudents.filter(s => {
        const sCls = normalizeClassCode(s.className || '').toLowerCase();
        const sGrade = normalizeClassCode(s.grade || '').toLowerCase();
        return sCls === normCls || sGrade === normCls || (stage && (sCls.includes(stage) || sGrade.includes(stage)));
      });

      const matchingSys = students.filter(s => {
        const sGrade = (s.schoolGrade || '').toLowerCase();
        const sNotes = (s.notes || '').toLowerCase();
        return sGrade.includes(normCls) || sNotes.includes(normCls) || (stage && sGrade.includes(stage));
      });

      const hodStudentIds = new Set(matchingHod.map(h => h.id));
      const matchingPlans = hodActionPlans.filter(p => hodStudentIds.has(p.studentId) || (p.className && normalizeClassCode(p.className).toLowerCase() === normCls));
      const matchingComplaints = hodComplaints.filter(c => hodStudentIds.has(c.studentId) || (c.className && normalizeClassCode(c.className).toLowerCase() === normCls));

      map[cls] = {
        hodStudentsList: matchingHod,
        systemStudentsList: matchingSys,
        actionPlansCount: matchingPlans.length,
        complaintsCount: matchingComplaints.length
      };
    });

    return map;
  }, [classWorkloadMap, hodStudents, students, hodActionPlans, hodComplaints]);

  const isEmpty = totalWeeklyLessons === 0 && !showTableEvenIfEmpty;

  return (
    <div className="space-y-3 pb-6" id="school-schedule-root">
      {/* 1. LIVE SESSION BANNER (WHEN CLASS IS ONGOING) */}
      {liveCurrentSession && (
        <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-primary/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-pulse-subtle">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                  {_t('🔴 الحصة الحالية الآن:', '🔴 Live Session Now:', '🔴 Aktuelle Stunde:')}
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {liveCurrentSession.isBreak 
                    ? _t('استراحة / فسحة ☕', 'Break / Recess ☕', 'Pause ☕') 
                    : `${liveCurrentSession.className || _t('حصة مدرسية', 'School Period', 'Unterricht')} ${liveCurrentSession.subjectName ? `(${liveCurrentSession.subjectName})` : ''}`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono">
                {liveCurrentSession.startTime} - {liveCurrentSession.endTime} • {_t(`متبقي ${liveCurrentSession.minsRemaining} دقيقة على الجرس`, `${liveCurrentSession.minsRemaining} mins until bell`, `noch ${liveCurrentSession.minsRemaining} Min.`)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {liveCurrentSession.className && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClassForHod(liveCurrentSession.className);
                  setIsHodStudentsModalOpen(true);
                }}
                className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-slate-50 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10.5px] font-black shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <Users className="w-3 h-3 text-primary" />
                <span className="hidden sm:inline">{_t('طلاب الفصل', 'Students', 'Schüler')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setNoteFormClass(liveCurrentSession.className);
                setNoteFormPeriod(liveCurrentSession.periodNumber || 1);
                setIsSchoolNotesModalOpen(true);
              }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-black shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              <span>{_t('تسجيل ملاحظة', 'Log Note', 'Notiz')}</span>
            </button>
          </div>
        </div>
      )}

      {isEmpty && (currentSettings.customTimedSessions || []).length === 0 ? (
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-gray-900 border border-slate-150/60 dark:border-gray-850 text-center space-y-3 shadow-xs" id="school-empty-state">
          <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center mx-auto border border-primary-border/40">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
              {_t('لا يوجد جدول مدرسة بعد', 'No School Schedule Configured', 'Noch kein Stundenplan konfiguriert')}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              {_t('لم تقم بإدخال جدول الحصص الخاص بك حتى الآن. يمكنك استيراده فوراً وصنع جدولك بالذكاء الاصطناعي أو ملؤه يدوياً.', 'You have not added any teaching hours to your schedule yet. You can import your schedule instantly using our AI parser or add classes manually.', 'Sie haben noch keine Unterrichtsstunden eingetragen. Nutzen Sie den KI-Import oder tragen Sie die Stunden manuell ein.')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 w-full max-w-sm mx-auto sm:flex sm:items-center sm:justify-center">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] sm:text-xs font-black shadow-2xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{_t('استيراد بالذكاء الاصطناعي', 'Import with AI', 'Mit KI importieren')}</span>
            </button>
            <button
              onClick={() => setShowTableEvenIfEmpty(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-hover text-text-main rounded-xl text-[11px] sm:text-xs font-black border border-surface-border transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{_t('إضافة يدويًا', 'Add Manually', 'Manuell hinzufügen')}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* WEEKLY GRID */}
          <div className="space-y-2" id="weekly-schedule-grid-container">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                {_t('الجدول الأسبوعي العام', 'Weekly Schedule Grid', 'Wochen-Stundenplan')}
              </h3>
              <button
                type="button"
                onClick={() => handleOpenAddCustomSession(selectedDay)}
                className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Clock className="w-3 h-3" />
                <span>{_t('+ حصة مخصصة', '+ Custom Session', '+ Spez. Stunde')}</span>
              </button>
            </div>
            <div className="w-full overflow-hidden rounded-xl border border-slate-100 dark:border-gray-850 bg-white dark:bg-gray-900 shadow-xs relative">
              <table className="w-full border-collapse text-start table-fixed">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-gray-850">
                    {(() => {
                      const activeDaysKeys = daysList.filter(day => currentSettings.presence[day.key]?.active).map(day => day.key);
                      const columnsDayKeys = activeDaysKeys.length > 0 ? activeDaysKeys : ['0', '1', '2', '3', '4'];
                      const numCols = columnsDayKeys.length;
                      const timePct = numCols > 5 ? 12 : 15;
                      const dayPct = (100 - timePct) / numCols;

                      return (
                        <>
                          <th 
                            style={{ width: `${timePct}%` }}
                            className={`p-1.5 text-center text-[8px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-r border-slate-100 dark:border-gray-850`}
                          >
                            {_t('الوقت', 'Time', 'Zeit')}
                          </th>
                          {columnsDayKeys.map((dayKey) => {
                            const dayObj = daysList.find(d => d.key === dayKey)!;
                            const isDaySelected = selectedDay === dayKey;
                            return (
                              <th 
                                key={dayKey}
                                onClick={() => setSelectedDay(dayKey)}
                                style={{ width: `${dayPct}%` }}
                                className={`p-1.5 sm:p-2.5 text-center text-[10px] sm:text-xs font-black cursor-pointer transition-colors border-r border-slate-100 dark:border-gray-850 last:border-r-0 ${
                                  isDaySelected 
                                    ? 'bg-primary-soft text-primary font-black'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="hidden sm:inline">{dayObj.label}</span>
                                  <span className="sm:hidden">{dayObj.short}</span>
                                  <span className={`w-1 h-1 rounded-full transition-all ${isDaySelected ? 'bg-primary scale-100' : 'bg-transparent scale-0'}`} />
                                </div>
                              </th>
                            );
                          })}
                        </>
                      );
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {calculatedPeriods.map((period) => {
                    const activeDaysKeys = daysList.filter(day => currentSettings.presence[day.key]?.active).map(day => day.key);
                    const columnsDayKeys = activeDaysKeys.length > 0 ? activeDaysKeys : ['0', '1', '2', '3', '4'];
                    const numCols = columnsDayKeys.length;
                    const timePct = numCols > 5 ? 12 : 15;
                    const dayPct = (100 - timePct) / numCols;

                    return (
                      <tr key={period.periodNumber} className="border-b border-slate-100/50 dark:border-gray-850 last:border-b-0">
                        {/* Time / Period Column */}
                        <td 
                          style={{ width: `${timePct}%` }}
                          className={`bg-slate-50/80 dark:bg-slate-900/80 border-r border-slate-200 dark:border-gray-800 p-1 sm:p-2 text-center`}
                        >
                          <div className="text-[11px] sm:text-xs font-black text-primary font-mono">
                            {_t(`ح${period.periodNumber}`, `P${period.periodNumber}`, `Std. ${period.periodNumber}`)}
                          </div>
                          <div 
                            className="mt-0.5 px-1 py-0.5 rounded bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light font-mono font-black text-[7.5px] sm:text-[8.5px] whitespace-nowrap flex items-center justify-center gap-0.5 border border-primary/20 shadow-2xs"
                            title={`${_t('ينتهي في', 'Ends at', 'Endet um')} ${period.endTime}`}
                          >
                            <span className="text-[6.5px] sm:text-[7px] font-sans font-bold opacity-80">{_t('ينتهي', 'Ends', 'Bis')}</span>
                            <span>{period.endTime}</span>
                          </div>
                          <div className="text-[7px] sm:text-[8px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 whitespace-nowrap" title={_t('وقت البداية', 'Start time', 'Startzeit')}>
                            {period.startTime}
                          </div>
                        </td>

                        {/* Day Columns */}
                        {columnsDayKeys.map((dayKey) => {
                          const daySchedule = currentSettings.schedule[dayKey] || [];
                          const record = daySchedule.find(p => p.periodNumber === period.periodNumber);
                          const isFilled = record && (record.subjectName || record.className);
                          const matchingCustoms = getCustomSessionsForPeriod(currentSettings.customTimedSessions, dayKey, period.periodNumber, calculatedPeriods);
                          const isCellSelected = selectedDay === dayKey;

                          return (
                            <td 
                              key={dayKey}
                              style={{ width: `${dayPct}%` }}
                              onClick={() => setSelectedDay(dayKey)}
                              className={`p-0.5 sm:p-1 text-center transition-all border-r border-slate-100 dark:border-gray-850 last:border-r-0 relative group cursor-pointer ${
                                isCellSelected ? 'bg-primary-soft/30 dark:bg-primary-soft/15' : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/20'
                              }`}
                            >
                                <div className="flex flex-col gap-1 w-full">
                                {isFilled && (() => {
                                  const isClassMatch = highlightedClass && record.className && normalizeClassCode(record.className) === normalizeClassCode(highlightedClass);
                                  const isDimmed = highlightedClass && (!record.className || normalizeClassCode(record.className) !== normalizeClassCode(highlightedClass));

                                  return (
                                    <div 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDay(dayKey);
                                        startEditPeriod(dayKey, period.periodNumber);
                                      }}
                                      className={`p-1 sm:p-2 rounded-lg text-center flex flex-col justify-center items-center min-h-[40px] sm:min-h-[46px] transition-all group/card overflow-hidden shadow-2xs ${
                                        isClassMatch 
                                          ? 'bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/50 scale-[1.03]'
                                          : isDimmed 
                                            ? 'opacity-30 grayscale-[30%] bg-primary-soft/30 dark:bg-primary-soft/10 border border-primary-border/30'
                                            : 'bg-primary-soft/50 dark:bg-primary-soft/25 border border-primary-border/60 hover:bg-primary-soft/80'
                                      }`}
                                      title={`${record.className || ''} ${record.subjectName ? `- ${record.subjectName}` : ''}`}
                                    >
                                      {record.className ? (
                                        <>
                                          <div className={`text-xs sm:text-sm font-black leading-tight truncate max-w-full tracking-tight ${isClassMatch ? 'text-amber-950 dark:text-amber-200' : 'text-slate-950 dark:text-white'}`}>
                                            {record.className}
                                          </div>
                                          {record.subjectName && (
                                            <div className={`text-[7.5px] sm:text-[9px] font-bold leading-none truncate max-w-full mt-0.5 uppercase opacity-95 ${isClassMatch ? 'text-amber-800 dark:text-amber-300' : 'text-primary'}`}>
                                              {record.subjectName}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <div className="text-[10px] sm:text-xs font-black text-slate-900 dark:text-slate-100 truncate leading-tight">
                                          {record.subjectName}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {matchingCustoms.map(cs => {
                                  const isClassMatch = highlightedClass && cs.className && normalizeClassCode(cs.className) === normalizeClassCode(highlightedClass);
                                  const isDimmed = highlightedClass && (!cs.className || normalizeClassCode(cs.className) !== normalizeClassCode(highlightedClass));

                                  return (
                                    <div
                                      key={cs.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDay(dayKey);
                                        handleOpenEditCustomSession(cs);
                                      }}
                                      className={`p-0.5 sm:p-1.5 rounded-lg text-center flex flex-col justify-center items-center min-h-[36px] sm:min-h-[40px] transition-all group/card overflow-hidden shadow-2xs ${
                                        isClassMatch 
                                          ? 'bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/50 scale-[1.03]'
                                          : isDimmed 
                                            ? 'opacity-30 grayscale-[30%] bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-200/40'
                                            : 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                                      }`}
                                      title={`${cs.className} (⏱️ ${cs.startTime} - ${cs.endTime}) ${cs.subjectName ? `- ${cs.subjectName}` : ''}`}
                                    >
                                      <div className={`text-[10px] sm:text-[11.5px] font-black leading-tight truncate max-w-full ${isClassMatch ? 'text-amber-950 dark:text-amber-200' : 'text-indigo-900 dark:text-indigo-200'}`}>
                                        {cs.className}
                                      </div>
                                      <div className="text-[7px] sm:text-[8px] font-mono font-bold text-indigo-600 dark:text-indigo-400 leading-none truncate max-w-full mt-0.5">
                                        ⏱️ {cs.startTime}-{cs.endTime}
                                      </div>
                                      {cs.subjectName && (
                                        <div className="text-[6.5px] sm:text-[7.5px] font-semibold text-indigo-700 dark:text-indigo-300 leading-none truncate max-w-full mt-0.5 hidden sm:block">
                                          {cs.subjectName}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {!isFilled && matchingCustoms.length === 0 && (
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDay(dayKey);
                                      startEditPeriod(dayKey, period.periodNumber);
                                    }}
                                    className="py-2.5 sm:py-3.5 text-slate-300 dark:text-slate-700 text-xs font-semibold flex items-center justify-center border border-dashed border-transparent hover:border-slate-200 dark:hover:border-slate-800 rounded-lg transition-all min-h-[38px] sm:min-h-[44px]"
                                  >
                                    <span className="hidden group-hover:inline-block text-[9px] font-black text-primary">
                                      +
                                    </span>
                                    <span className="group-hover:hidden text-[10px] text-slate-300 dark:text-slate-700 font-bold">+</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* After-school / Unmatched Custom Timed Sessions Row if any */}
                  {(() => {
                    const activeDaysKeys = daysList.filter(day => currentSettings.presence[day.key]?.active).map(day => day.key);
                    const columnsDayKeys = activeDaysKeys.length > 0 ? activeDaysKeys : ['0', '1', '2', '3', '4'];
                    const hasAnyUnmatched = columnsDayKeys.some(dayKey => 
                      getUnmatchedCustomSessions(currentSettings.customTimedSessions, dayKey, calculatedPeriods).length > 0
                    );

                    if (!hasAnyUnmatched) return null;

                    const numCols = columnsDayKeys.length;
                    const timePct = numCols > 5 ? 12 : 15;
                    const dayPct = (100 - timePct) / numCols;

                    return (
                      <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 border-t-2 border-indigo-200 dark:border-indigo-800/40">
                        <td 
                          style={{ width: `${timePct}%` }}
                          className="bg-indigo-50/80 dark:bg-indigo-950/60 border-r border-indigo-200 dark:border-indigo-800 p-1 sm:p-2 text-center"
                        >
                          <div className="flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[7.5px] sm:text-[8.5px] font-black tracking-tighter mt-0.5">{_t('مخصص', 'Custom', 'Spez.')}</span>
                          </div>
                        </td>
                        {columnsDayKeys.map(dayKey => {
                          const unmatchedCustoms = getUnmatchedCustomSessions(currentSettings.customTimedSessions, dayKey, calculatedPeriods);
                          return (
                            <td 
                              key={dayKey}
                              style={{ width: `${dayPct}%` }}
                              className="p-0.5 sm:p-1 text-center transition-all border-r border-indigo-100 dark:border-indigo-900/40 last:border-r-0"
                            >
                              <div className="flex flex-col gap-1 w-full">
                                {unmatchedCustoms.map(cs => (
                                  <div
                                    key={cs.id}
                                    onClick={() => {
                                      setSelectedDay(dayKey);
                                      handleOpenEditCustomSession(cs);
                                    }}
                                    className="p-1 rounded-lg bg-indigo-100/90 dark:bg-indigo-900/70 border border-indigo-300 dark:border-indigo-700 text-center flex flex-col justify-center items-center cursor-pointer hover:bg-indigo-200/90 dark:hover:bg-indigo-900 transition-all shadow-2xs"
                                    title={`${cs.className} (⏱️ ${cs.startTime} - ${cs.endTime})`}
                                  >
                                    <div className="text-[10px] sm:text-[11px] font-black text-indigo-950 dark:text-indigo-100 truncate w-full">
                                      {cs.className}
                                    </div>
                                    <div className="text-[7px] sm:text-[8px] font-mono font-bold text-indigo-700 dark:text-indigo-300 leading-none truncate w-full mt-0.5">
                                      ⏱️ {cs.startTime}-{cs.endTime}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* DAILY TIMELINE LIST */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 space-y-1.5" id="daily-timeline-section">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-50 dark:border-gray-800">
              <div className="space-y-0.5">
                {(() => {
                  const selectedDayObj = daysList.find(d => d.key === selectedDay)!;
                  return (
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>{_t(`تفاصيل جدول يوم ${selectedDayObj.label}`, `${selectedDayObj.label} Schedule Details`, `${selectedDayObj.label} Details`)}</span>
                    </h3>
                  );
                })()}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenAddCustomSession(selectedDay)}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10.5px] font-bold transition-all border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-2xs"
                >
                  <Clock className="w-3 h-3" />
                  <span>{_t('+ حصة مخصصة', '+ Custom Session', '+ Spez. Stunde')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => startEditPeriod(selectedDay, 1)}
                  className="flex items-center gap-1 px-2 py-1 bg-primary-soft hover:bg-primary/20 text-primary rounded-lg text-[10.5px] font-bold transition-all border border-primary-border/60 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{_t('+ حصة عادية', '+ Standard Period', '+ Stunde')}</span>
                </button>
              </div>
            </div>

            {(() => {
              const selectedDayObj = daysList.find(d => d.key === selectedDay)!;
              const isSchoolActive = currentSettings.presence[selectedDay]?.active;
              
              if (!isSchoolActive) {
                return (
                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-gray-800 text-center space-y-1.5">
                    <Info className="w-5 h-5 text-slate-300 dark:text-slate-700 mx-auto" />
                    <h4 className="text-xs font-black text-slate-500 dark:text-slate-400">
                      {_t(`${selectedDayObj.label} هو يوم عطلة أو غير مدرسي`, `${selectedDayObj.label} is an off / weekend day`, `${selectedDayObj.label} ist ein unterrichtsfreier Tag`)}
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      {_t('هذا اليوم غير مفعل في إعدادات الحضور. يمكنك تفعيله لتسجيل الحصص من قسم الإعدادات.', 'This day is not configured as a teaching day. Enable it in School Settings to add periods.', 'Dieser Tag ist in den Einstellungen nicht aktiv. Aktivieren Sie ihn, um Stunden einzutragen.')}
                    </p>
                  </div>
                );
              }

              // Merged & Chronologically Sorted Schedule Items (Standard Periods + Custom Sessions)
              const mergedItems = getMergedDayScheduleItems(
                currentSettings.schedule[selectedDay],
                currentSettings.customTimedSessions,
                selectedDay,
                calculatedPeriods
              );

              if (mergedItems.length === 0) {
                return (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/20 border border-dashed border-slate-100 dark:border-gray-800 text-center space-y-1">
                    <Info className="w-4 h-4 text-slate-400 mx-auto" />
                    <h4 className="text-xs font-black text-slate-500 dark:text-slate-400">
                      {_t('لا توجد حصص مجدولة لهذا اليوم', 'No scheduled classes for this day', 'Keine Unterrichtsstunden für diesen Tag geplant')}
                    </h4>
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        onClick={() => startEditPeriod(selectedDay, 1)}
                        className="text-[10px] font-black text-primary hover:underline cursor-pointer"
                      >
                        {_t('+ إضافة حصة عادية', '+ Add standard class', '+ Stunde hinzufügen')}
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <button
                        onClick={() => handleOpenAddCustomSession(selectedDay)}
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {_t('+ إضافة حصة بتوقيت مخصص', '+ Add custom timed class', '+ Spezielle Stunde')}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2" id="periods-timeline-list">
                  {mergedItems.map((item) => {
                    const isCustom = item.isCustomTime;

                    return (
                      <div 
                        key={item.id}
                        className={`p-1.5 sm:p-2 rounded-lg border transition-all duration-200 ${
                          isCustom 
                            ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60 shadow-2xs' 
                            : 'bg-primary-soft/20 dark:bg-primary-soft/10 border-primary-border/40'
                        }`}
                        id={`schedule-item-${item.id}`}
                      >
                        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                          <div className="flex gap-1.5 sm:gap-2 text-start">
                            {isCustom ? (
                              <span className="w-5 sm:w-6 h-5 sm:h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shrink-0 shadow-2xs">
                                <Clock className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="w-5 sm:w-6 h-5 sm:h-6 rounded-md bg-primary text-white flex items-center justify-center text-[11px] font-black shrink-0 shadow-2xs">
                                {item.periodNumber}
                              </span>
                            )}
                            
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[11.5px] sm:text-xs font-black font-mono ${isCustom ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {item.startTime} - {item.endTime}
                                </span>
                                <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-semibold">
                                  ({item.durationMinutes} {_t('دقيقة', 'mins', 'Min.')})
                                </span>
                                {isCustom && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                    {item.sessionType || _t('توقيت مخصص', 'Custom Time', 'Spezielle Zeit')}
                                  </span>
                                )}
                              </div>

                              <div className="space-y-0.5 pt-0.5">
                                {item.className ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                      {item.className}
                                    </span>
                                    {item.subjectName && (
                                      <span className={`text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase border ${
                                        isCustom 
                                          ? 'text-indigo-700 dark:text-indigo-300 bg-white dark:bg-surface border-indigo-200 dark:border-indigo-800' 
                                          : 'text-primary bg-primary-soft border-primary-border/60'
                                      }`}>
                                        {item.subjectName}
                                      </span>
                                    )}
                                    {item.room && (
                                      <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-mono">
                                        📍 {item.room}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {item.subjectName}
                                  </div>
                                )}
                                {item.notes && (
                                  <p className="text-[9.5px] sm:text-[10px] text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-100 dark:border-gray-800">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                if (isCustom && item.rawCustomSession) {
                                  handleOpenEditCustomSession(item.rawCustomSession);
                                } else if (item.periodNumber) {
                                  startEditPeriod(selectedDay, item.periodNumber);
                                }
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors focus:outline-none cursor-pointer"
                              title={_t('تعديل', 'Edit', 'Bearbeiten')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => {
                                if (isCustom && item.rawCustomSession) {
                                  handleDeleteCustomSession(item.rawCustomSession.id);
                                } else if (item.periodNumber) {
                                  clearPeriod(selectedDay, item.periodNumber);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg transition-colors focus:outline-none cursor-pointer"
                              title={_t('مسح / حذف', 'Clear / Delete', 'Entfernen / Löschen')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* MODAL 1: Edit Period Dialog */}
      {editingPeriod && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-md p-5 space-y-4 animate-scale-up shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                <span>
                  {_t(`تعديل بيانات الحصة ${editingPeriod.periodNumber}`, `Edit Period ${editingPeriod.periodNumber} Details`, `Bearbeite Stunde ${editingPeriod.periodNumber}`)}
                </span>
              </h3>
              <button
                onClick={() => setEditingPeriod(null)}
                className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 focus:outline-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {_t('المادة أو النشاط', 'Subject / Activity', 'Fach / Aktivität')}
                </label>
                <input
                  type="text"
                  placeholder={_t('مثال: لغة ألمانية، رياضيات...', 'e.g. German, Math...', 'z.B. Deutsch, Mathe...')}
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {_t('الفصل أو المجموعة', 'Class / Group', 'Klasse / Gruppe')}
                </label>
                <input
                  type="text"
                  placeholder={_t('مثال: 1/أ، مجموعة التقوية...', 'e.g. Class 10A, Group B...', 'z.B. Klasse 10A, Gruppe B...')}
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-gray-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {_t('ملاحظات أو القاعة (اختياري)', 'Notes / Room (Optional)', 'Notizen / Raum (Optional)')}
                </label>
                <input
                  type="text"
                  placeholder={_t('مثال: معمل اللغات، الطابق الثاني...', 'e.g. Language Lab, 2nd Floor...', 'z.B. Sprachlabor, 2. Stock...')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-gray-800">
              <button
                onClick={() => setEditingPeriod(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={savePeriodEdit}
                className="px-5 py-2 text-xs font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-all cursor-pointer"
              >
                {_t('حفظ التعديلات', 'Save Changes', 'Änderungen speichern')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add / Edit Custom Timed Session Modal */}
      {isCustomSessionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg p-5 space-y-4 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-text-main">
                    {editingCustomSession 
                      ? _t('تعديل الحصة ذات التوقيت المخصص', 'Edit Custom Timed Session', 'Spezielle Stunde bearbeiten') 
                      : _t('إضافة حصة بتوقيت مخصص', 'Add Custom Timed Session', 'Neue spezielle Stunde hinzufügen')}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {_t('تظهر في الجدول والبطاقات والجدول المجمع وفق وقتها الزمني الدقيق', 'Appears in schedule, cards, and matrix based on its exact time', 'Wird gemäß exakter Uhrzeit im Plan und der Übersicht angezeigt')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomSessionModalOpen(false)}
                className="p-1 hover:bg-surface-hover rounded-full text-text-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomSession} className="space-y-3.5">
              {/* Day Selection */}
              <div className="space-y-1">
                <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{_t('اليوم', 'Day', 'Tag')}</span>
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-1">
                  {daysList.map(d => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setCustomDayKey(d.key)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                        customDayKey === d.key 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-black' 
                          : 'bg-surface hover:bg-surface-hover text-text-muted border-surface-border'
                      }`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact Time Range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('وقت البدء', 'Start Time', 'Startzeit')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-mono font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('وقت الانتهاء', 'End Time', 'Endzeit')}</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-mono font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Class and Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main">
                    {_t('الفصل / المجموعة *', 'Class / Group *', 'Klasse / Gruppe *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={_t('مثال: 11-D، مجموعة التقوية...', 'e.g. 11-D, Tutoring Group A...', 'z.B. 11-D, Fördergruppe...')}
                    value={customClassName}
                    onChange={(e) => setCustomClassName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main">
                    {_t('المادة أو النشاط', 'Subject / Activity', 'Fach / Aktivität')}
                  </label>
                  <input
                    type="text"
                    placeholder={_t('مثال: لغة ألمانية، مراجعة نهائية...', 'e.g. German, Review...', 'z.B. Deutsch, Wiederholung...')}
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Room & Session Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('القاعة / المكان (اختياري)', 'Room / Location', 'Raum / Ort')}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={_t('مثال: معمل اللغات، قاعة 204...', 'e.g. Language Lab 204...', 'z.B. Sprachlabor 204...')}
                    value={customRoom}
                    onChange={(e) => setCustomRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{_t('نوع الحصة', 'Session Type', 'Stundentyp')}</span>
                  </label>
                  <select
                    value={customSessionType}
                    onChange={(e) => setCustomSessionType(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="حصة إضافية / تقوية">{_t('حصة إضافية / تقوية', 'Extra / Remedial', 'Förderunterricht')}</option>
                    <option value="حصة خاصة">{_t('حصة خاصة', 'Private Session', 'Privatstunde')}</option>
                    <option value="نشاط إثرائي">{_t('نشاط إثرائي', 'Enrichment Activity', 'Förderaktivität')}</option>
                    <option value="تدريب لغوي">{_t('تدريب لغوي', 'Language Training', 'Sprachtraining')}</option>
                    <option value="حصة خارج الجدول">{_t('حصة خارج الجدول', 'Off-Schedule Session', 'Außerplanmäßige Stunde')}</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-black text-text-main">
                  {_t('ملاحظات إضافية (اختياري)', 'Additional Notes', 'Zusätzliche Notizen')}
                </label>
                <textarea
                  rows={2}
                  placeholder={_t('أهداف الحصة، الطلاب المستهدفين...', 'Session goals, targeted students...', 'Ziele, Schüler...')}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                {editingCustomSession ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomSession(editingCustomSession.id)}
                    className="px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{_t('حذف الحصة', 'Delete', 'Löschen')}</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomSessionModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-text-muted hover:bg-surface-hover rounded-xl transition-colors cursor-pointer"
                  >
                    {_t('إلغاء', 'Cancel', 'Abbrechen')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{_t('حفظ الحصة', 'Save Session', 'Speichern')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: AI IMPORT WIZARD */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-2xl p-5 space-y-4 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-50 dark:border-gray-850">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>{_t('استيراد الجدول بالذكاء الاصطناعي', 'Import Schedule via AI Assistant', 'Stundenplan mit KI importieren')}</span>
              </h3>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setValidationResult(null);
                  setImportText('');
                }}
                className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 focus:outline-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Steps explanations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 bg-primary-soft/30 dark:bg-primary-soft/15 p-4 rounded-2xl border border-primary-border/40">
                <h4 className="text-xs font-black text-primary flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-2xs">1</span>
                  <span>{_t('انسخ موجه الأوامر (Prompt)', 'Copy AI Prompt', 'KI-Prompt kopieren')}</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  {_t('انسخ الموجه الجاهز الذي يحتوي على تعليمات دقيقة و Schema مخصص وقدمه لـ ChatGPT / Gemini مع إرفاق صورة جدولك.', 'Copy our optimized prompt template containing strict format guidelines and schema, and feed it to Gemini/ChatGPT with your schedule photo.', 'Kopieren Sie unsere optimierte Prompt-Vorlage und fügen Sie sie in ChatGPT/Gemini mit Ihrem Stundenplan-Foto ein.')}
                </p>

                {/* Break period rule badge */}
                <div className="p-2 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{_t('قاعدة احتساب الفسحة مدمجة: البرومبت يوجّه الذكاء الاصطناعي لاحتساب الفسحة حصة واحدة دائماً في الترقيم لتفادي ترحيل مواعيد الحصص التالية.', 'Break period rule included: Instructs AI that break is always counted as exactly one period slot so subsequent lessons remain properly timed.', 'Pause zählt immer genau als eine Stunde.')}</span>
                </div>

                <button
                  type="button"
                  onClick={copyPromptToClipboard}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{_t('تم النسخ للحافظة!', 'Copied to Clipboard!', 'Kopiert!')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{_t('نسخ الـ Prompt الذكي', 'Copy Smart Prompt', 'Prompt kopieren')}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3 bg-emerald-50/20 dark:bg-emerald-950/10 p-4 rounded-2xl border border-emerald-100/20 dark:border-emerald-900/15">
                <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black">2</span>
                  <span>{_t('ألصق الرمز المستخرج (JSON)', 'Paste AI Output Code', 'KI-Code einfügen')}</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  {_t('انسخ الرمز النظيف الذي يخرجه الذكاء الاصطناعي وألصقه بالأسفل لإجراء التدقيق الأوتوماتيكي وحفظ الجدول.', 'Copy the JSON output provided by the AI Assistant, paste it in the textarea below to trigger data validations.', 'Kopieren Sie den JSON-Code, den die KI geliefert hat, und fügen Sie ihn unten ein, um den Import zu prüfen.')}
                </p>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{_t('تأكد من مطابقة كود JSON تماماً', 'Ensure pure JSON structure', 'Achten Sie auf reines JSON')}</div>
              </div>
            </div>

            {/* Input Text Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>{_t('ألصق كود JSON هنا:', 'Paste JSON result here:', 'JSON-Ergebnis hier einfügen:')}</span>
              </label>
              <textarea
                rows={5}
                placeholder='{ "presence": { ... }, "periodSettings": { ... }, "schedule": { ... } }'
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setValidationResult(null);
                }}
                className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-gray-800 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
              />
            </div>

            {/* Action Verify */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleValidateImport}
                disabled={!importText.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{_t('تحليل وفحص البيانات', 'Analyze & Validate', 'Analysieren & Validieren')}</span>
              </button>
            </div>

            {/* Validation Messages UI */}
            {validationResult && (
              <div className="p-4 rounded-2xl border space-y-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  {validationResult.isValid ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{_t('البيانات صالحة ومطابقة للـ Schema بنجاح!', 'Data is clean and fully valid!', 'Daten sind sauber und vollständig valide!')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{_t('عثرنا على أخطاء تمنع الاستيراد:', 'Validation failed with blocking errors:', 'Validierung fehlgeschlagen mit Fehlern:')}</span>
                    </div>
                  )}
                </div>

                {/* Errors list */}
                {validationResult.errors.length > 0 && (
                  <div className="space-y-1 pl-4" style={{ direction: 'rtl' }}>
                    {validationResult.errors.map((err, i) => (
                      <div key={i} className="text-[11px] text-rose-500 font-bold list-disc">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings list */}
                {validationResult.warnings.length > 0 && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1">
                    <div className="text-[10px] font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{_t('تنبيهات وتعارضات محتملة (غير مانعة للاستيراد):', 'Warnings / Conflicts detected (non-blocking):', 'Mögliche Konflikte erkannt (nicht blockierend):')}</span>
                    </div>
                    {validationResult.warnings.map((warn, i) => (
                      <div key={i} className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold pl-2">
                        • {warn}
                      </div>
                    ))}
                  </div>
                )}

                {/* PREVIEW & SUMMARY OF THE IMPORT DATA */}
                {validationResult.isValid && validationResult.parsedData && (() => {
                  const data = validationResult.parsedData;
                  const sched = data.schedule || {};
                  const presence = data.presence || {};
                  const pSettings = data.periodSettings || { periodsCount: 7, firstPeriodStart: '08:00', defaultDuration: 45 };

                  let totalScheduledSlots = 0;
                  let teachingLessonsCount = 0;
                  let breakSlotsCount = 0;
                  const uniqueClassesSet = new Set<string>();
                  const activeDaysWithLessons: Array<{
                    dayKey: string;
                    dayLabel: string;
                    lessons: Array<{ periodNumber: number; className: string; subjectName: string; isBreak: boolean }>;
                  }> = [];

                  const dayKeysOrder = ['0', '1', '2', '3', '4', '5', '6'];
                  dayKeysOrder.forEach(dayKey => {
                    const list = sched[dayKey] || [];
                    const isDayActive = presence[dayKey]?.active;
                    const sorted = [...list].sort((a, b) => (Number(a.periodNumber) || 0) - (Number(b.periodNumber) || 0));
                    
                    if (sorted.length > 0 || isDayActive) {
                      const dayLessons = sorted.map(item => {
                        const cls = normalizeClassCode(item.className || '');
                        const subj = item.subjectName?.trim() || '';
                        const isBreak = /فسحة|بريك|استراحة|break|pause/i.test(subj) || /فسحة|بريك|استراحة|break|pause/i.test(cls);
                        
                        totalScheduledSlots++;
                        if (isBreak) {
                          breakSlotsCount++;
                        } else {
                          teachingLessonsCount++;
                          if (cls) uniqueClassesSet.add(cls);
                        }

                        return {
                          periodNumber: item.periodNumber,
                          className: cls,
                          subjectName: subj || (isBreak ? _t('فسحة', 'Break', 'Pause') : 'Deutsch'),
                          isBreak
                        };
                      });

                      if (dayLessons.length > 0) {
                        const dayObj = daysList.find(d => d.key === dayKey);
                        activeDaysWithLessons.push({
                          dayKey,
                          dayLabel: dayObj ? dayObj.label : `يوم ${dayKey}`,
                          lessons: dayLessons
                        });
                      }
                    }
                  });

                  const uniqueClasses = Array.from(uniqueClassesSet).sort();

                  return (
                    <div className="pt-3 border-t border-slate-200 dark:border-gray-800 space-y-3">
                      {/* Summary Section Header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap bg-primary/5 dark:bg-primary/10 p-2.5 rounded-xl border border-primary/20">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-xs font-black text-text-main">
                            {_t('ملخص البيانات التي ستُضاف إلى جدولك:', 'Summary of data to be added to your schedule:', 'Zusammenfassung der hinzuzufügenden Daten:')}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                          ✓ {_t('جاهز للحفظ', 'Ready to save', 'Bereit zum Speichern')}
                        </span>
                      </div>

                      {/* Key Numerical Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                            <span>{_t('الحصص الدراسية', 'Teaching Lessons', 'Unterrichtsstunden')}</span>
                          </div>
                          <div className="mt-1 text-base font-black text-text-main flex items-baseline gap-1">
                            <span>{teachingLessonsCount}</span>
                            <span className="text-[10px] font-semibold text-slate-400">{_t('حصة أسبوعياً', 'lessons/wk', 'Std./Woche')}</span>
                          </div>
                        </div>

                        <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{_t('الفصول المستخرجة', 'Target Classes', 'Klassen')}</span>
                          </div>
                          <div className="mt-1 text-base font-black text-text-main flex items-baseline gap-1">
                            <span>{uniqueClasses.length}</span>
                            <span className="text-[10px] font-semibold text-slate-400">{_t('فصل مختلف', 'classes', 'Klassen')}</span>
                          </div>
                        </div>

                        <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{_t('أيام التدريس', 'Teaching Days', 'Unterrichtstage')}</span>
                          </div>
                          <div className="mt-1 text-base font-black text-text-main flex items-baseline gap-1">
                            <span>{activeDaysWithLessons.length}</span>
                            <span className="text-[10px] font-semibold text-slate-400">{_t('أيام نشطة', 'active days', 'Tage')}</span>
                          </div>
                        </div>

                        <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-gray-700/80 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <Coffee className="w-3.5 h-3.5 text-amber-500" />
                            <span>{_t('الفسحة / البريك', 'Break / Recess', 'Pause')}</span>
                          </div>
                          <div className="mt-1 text-xs font-black text-amber-600 dark:text-amber-400 truncate">
                            {breakSlotsCount > 0 
                              ? _t(`${breakSlotsCount} فترة فسحة مدمجة`, `${breakSlotsCount} Break slot included`, `${breakSlotsCount} Pause gezählt`)
                              : _t('محسوبة حصة واحدة', 'Counted as 1 period', 'Als 1 Stunde gezählt')
                            }
                          </div>
                        </div>
                      </div>

                      {/* Unique Normalized Classes Pills */}
                      {uniqueClasses.length > 0 && (
                        <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-1.5">
                          <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-indigo-600" />
                            <span>{_t('الفصول المستهدفة الموحدة (مطابقة لكشوف وفلاتر الطلاب):', 'Standardized classes to be added (matching student lists):', 'Extrahierte Klassen:')}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {uniqueClasses.map(c => (
                              <span key={c} className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[10px] font-mono font-bold shadow-2xs">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Settings Details Row */}
                      <div className="p-2.5 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="text-slate-400">{_t('مجموع الحصص اليومية:', 'Daily period count:', 'Stundenanzahl:')} </span>
                          <span className="font-bold text-text-main">{pSettings.periodsCount} {_t('حصص', 'periods', 'Stunden')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">{_t('بداية الحصة الأولى:', '1st period start:', 'Beginn 1. Stunde:')} </span>
                          <span className="font-bold text-text-main">{pSettings.firstPeriodStart}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">{_t('مدة الحصة الافتراضية:', 'Period duration:', 'Dauer:')} </span>
                          <span className="font-bold text-text-main">{pSettings.defaultDuration} {_t('دقيقة', 'mins', 'Min.')}</span>
                        </div>
                      </div>

                      {/* Day-by-Day Lessons Breakdown */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>{_t('توزيع الحصص المضافة حسب الأيام:', 'Day-by-day lesson breakdown to be added:', 'Tägliche Stundenverteilung:')}</span>
                          <span className="font-mono text-slate-400 font-semibold">{totalScheduledSlots} {_t('عنصر مجدول', 'scheduled slots', 'Einträge')}</span>
                        </div>

                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {activeDaysWithLessons.length === 0 ? (
                            <div className="p-3 text-center text-[11px] text-slate-400 italic bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-gray-700">
                              {_t('لم يتم العثور على حصص مجدولة بالأيام.', 'No scheduled lessons found in days.', 'Keine Stunden gefunden.')}
                            </div>
                          ) : (
                            activeDaysWithLessons.map(day => (
                              <div key={day.dayKey} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-gray-700/80 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-black text-text-main">
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-primary" />
                                    <span>{day.dayLabel}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                    {day.lessons.length} {_t('حصص', 'periods', 'Stunden')}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {day.lessons.map((lesson, idx) => (
                                    <div
                                      key={idx}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                                        lesson.isBreak
                                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                                          : 'bg-primary/10 text-primary border-primary/20'
                                      }`}
                                      title={lesson.isBreak ? _t('فترة الفسحة / الاستراحة', 'Break period', 'Pause') : `${lesson.className} (${lesson.subjectName})`}
                                    >
                                      <span className="opacity-75 font-mono text-[9px] bg-black/5 dark:bg-white/10 px-1 rounded">
                                        #{lesson.periodNumber}
                                      </span>
                                      {lesson.isBreak ? (
                                        <>
                                          <Coffee className="w-2.5 h-2.5" />
                                          <span>{_t('فسحة', 'Break', 'Pause')}</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="font-black text-text-main">{lesson.className || _t('بدون فصل', 'No class', 'Keine Klasse')}</span>
                                          {lesson.subjectName && lesson.subjectName !== 'Deutsch' && (
                                            <span className="text-[9px] opacity-75">({lesson.subjectName})</span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Confirm action */}
            <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-50 dark:border-gray-850 flex-wrap">
              <button
                type="button"
                onClick={() => setIsConfirmResetOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100/80 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-all active:scale-95 border border-rose-100/50 dark:border-rose-950/30 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{_t('مسح جدول المدرسة بالكامل', 'Clear Entire School Schedule', 'Schulplan vollständig löschen')}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setValidationResult(null);
                    setImportText('');
                  }}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={!validationResult || !validationResult.isValid}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-45 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold focus:outline-none shadow-xs cursor-pointer active:scale-95"
                >
                  {_t('تأكيد وحفظ الاستيراد', 'Confirm & Import', 'Import bestätigen')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM RESET */}
      {isConfirmResetOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-md p-5 space-y-4 animate-scale-up shadow-2xl">
            <div className="flex items-center gap-2 pb-2 text-rose-600 border-b border-slate-50 dark:border-gray-850">
              <AlertTriangle className="w-5 h-5 animate-pulse shrink-0" />
              <h3 className="text-base font-black">
                {_t('مسح جدول المدرسة بالكامل؟', 'Clear Entire School Schedule?', 'Schulplan vollständig löschen?')}
              </h3>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
              <p>
                {_t(
                  'سيتم حذف جدول المدرسة الحالي وجميع البيانات المرتبطة به، بما في ذلك:',
                  'This will delete the current school schedule and all associated data, including:',
                  'Dadurch wird der aktuelle Schulplan und alle zugehörigen Daten gelöscht, einschließlich:'
                )}
              </p>
              <ul className="list-disc pl-4 pr-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <li>{_t('جميع الحصص والمواد الدراسية.', 'All school periods and subjects.', 'Alle Unterrichtsstunden und Fächer.')}</li>
                <li>{_t('بيانات الجدول الأسبوعي واليومي.', 'Weekly and daily schedule grids.', 'Wöchentliche und tägliche Stundenpläne.')}</li>
                <li>{_t('أحداث التقويم (Calendar) الناتجة عن جدول المدرسة.', 'Calendar events derived from the school schedule.', 'Von diesem Plan abgeleitete Kalendertermine.')}</li>
                <li>{_t('إشعارات وتنبيهات الحصص المدرسية القادمة.', 'Upcoming school period alerts and notifications.', 'Unterrichtserinnerungen und Benachrichtigungen.')}</li>
              </ul>
              <p className="text-rose-500 font-bold pt-1">
                {_t(
                  'هذه العملية لا يمكن التراجع عنها.',
                  'This action is irreversible and cannot be undone.',
                  'Diese Aktion kann nicht rückgängig gemacht werden.'
                )}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-50 dark:border-gray-850">
              <button
                type="button"
                onClick={() => setIsConfirmResetOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold focus:outline-none"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={handleFullReset}
                disabled={isResetting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold focus:outline-none shadow-md flex items-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{_t('جاري مسح جدول المدرسة...', 'Clearing school schedule...', 'Schulplan wird gelöscht...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{_t('مسح الجدول بالكامل', 'Clear Entire Schedule', 'Plan vollständig löschen')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: WORKLOAD & ANALYTICS MODAL */}
      {isAnalyticsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-2xl p-5 space-y-4 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {_t('تحليل النصاب والأعباء التدريسية', 'Teaching Workload & Schedule Analytics', 'Lehraufwand- & Stundenanalyse')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {_t('إحصائيات تفصيلية وتوزيع الحصص على الفصول والمراحل', 'Detailed statistics and distribution per class & stage', 'Detaillierte Statistiken und Verteilung nach Klasse & Stufe')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAnalyticsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-center space-y-0.5">
                <span className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400">{_t('إجمالي الحصص', 'Total Lessons', 'Gesamtstunden')}</span>
                <p className="text-xl font-black text-indigo-950 dark:text-indigo-200">{totalWeeklyLessons}</p>
                <span className="text-[9.5px] text-indigo-400 font-semibold">{_t('حصة / أسبوع', 'periods/wk', 'Std./Woche')}</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-center space-y-0.5">
                <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">{_t('عدد الفصول', 'Classes Count', 'Klassen')}</span>
                <p className="text-xl font-black text-emerald-950 dark:text-emerald-200">{totalUniqueClasses}</p>
                <span className="text-[9.5px] text-emerald-400 font-semibold">{_t('فصل مختلف', 'distinct classes', 'verschiedene Klassen')}</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-center space-y-0.5">
                <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400">{_t('المراحل الدراسية', 'Stages Count', 'Stufen')}</span>
                <p className="text-xl font-black text-amber-950 dark:text-amber-200">{totalUniqueStages}</p>
                <span className="text-[9.5px] text-amber-400 font-semibold">{_t('مرحلة تعليمية', 'school stages', 'Schulstufen')}</span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-center space-y-0.5">
                <span className="text-[10.5px] font-bold text-purple-600 dark:text-purple-400">{_t('أيام التدريس', 'Active Days', 'Aktive Tage')}</span>
                <p className="text-xl font-black text-purple-950 dark:text-purple-200">
                  {daysList.filter(d => currentSettings.presence[d.key]?.active).length}
                </p>
                <span className="text-[9.5px] text-purple-400 font-semibold">{_t('يوم عمل أسبوعي', 'working days', 'Arbeitstage')}</span>
              </div>
            </div>

            {/* Distribution by Class */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>{_t('توزيع النصاب لكل فصل / مجموعة', 'Workload Distribution per Class', 'Stundenverteilung nach Klasse')}</span>
              </h4>
              <div className="border border-slate-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-gray-800">
                {Object.keys(classWorkloadMap).length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-semibold">
                    {_t('لم يتم إدخال فصول في الجدول حتى الآن', 'No classes registered yet in schedule', 'Noch keine Klassen im Plan eingetragen')}
                  </div>
                ) : (
                  Object.entries(classWorkloadMap).map(([cls, data]: [string, { count: number; days: Set<string>; periods: any[] }]) => {
                    const pct = totalWeeklyLessons > 0 ? Math.round((data.count / totalWeeklyLessons) * 100) : 0;
                    const linked = classStudentsMap[cls] || { hodStudentsList: [], systemStudentsList: [] };
                    return (
                      <div key={cls} className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{cls}</span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              ({data.days.size} {_t('أيام في الأسبوع', 'days/wk', 'Tage/Woche')})
                            </span>
                            {(linked.hodStudentsList.length > 0 || linked.systemStudentsList.length > 0) && (
                              <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                                {linked.hodStudentsList.length + linked.systemStudentsList.length} {_t('طالب مسجل', 'students linked', 'Schüler verknüpft')}
                              </span>
                            )}
                          </div>
                          <div className="w-48 sm:w-64 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{data.count}</span>
                          <span className="text-[10px] text-slate-400 ms-1 font-bold">{_t('حصة', 'periods', 'Std.')} ({pct}%)</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsAnalyticsModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: SCHOOL CLASS STUDENTS & HOD INTEGRATION MODAL */}
      {isHodStudentsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-2xl p-5 space-y-4 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {_t('طلاب الفصول وربط الإشراف (HOD Link)', 'Class Students & HOD Link', 'Klassenschüler & HOD-Verknüpfung')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {_t('عرض طلاب الفصل، خطط الدعم، الشكاوى، والملاحظات الإشرافية', 'View students, action plans, complaints, and notes per class', 'Schüler, Förderpläne und Beschwerden pro Klasse anzeigen')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHodStudentsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Class tabs */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {_t('اختر الفصل لعرض تفاصيل طلابه:', 'Select class to inspect:', 'Klasse wählen:')}
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {Object.keys(classWorkloadMap).map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedClassForHod(cls)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                      selectedClassForHod === cls
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Class HOD Detail Body */}
            {selectedClassForHod && (() => {
              const info = classStudentsMap[selectedClassForHod] || { hodStudentsList: [], systemStudentsList: [], actionPlansCount: 0, complaintsCount: 0 };
              return (
                <div className="space-y-3 pt-1">
                  {/* Summary row for this class */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-gray-800 text-center">
                      <span className="text-[10px] font-bold text-slate-400">{_t('طلاب HOD', 'HOD Students', 'HOD Schüler')}</span>
                      <p className="text-base font-black text-slate-900 dark:text-white font-mono">{info.hodStudentsList.length}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-gray-800 text-center">
                      <span className="text-[10px] font-bold text-slate-400">{_t('خطط علاجية', 'Action Plans', 'Förderpläne')}</span>
                      <p className="text-base font-black text-purple-600 font-mono">{info.actionPlansCount}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-gray-800 text-center">
                      <span className="text-[10px] font-bold text-slate-400">{_t('شكاوى وملاحظات', 'Complaints', 'Beschwerden')}</span>
                      <p className="text-base font-black text-rose-600 font-mono">{info.complaintsCount}</p>
                    </div>
                  </div>

                  {/* List HOD students */}
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center justify-between">
                      <span>{_t('قائمة طلاب الفصل المسجلين:', 'Registered Class Students:', 'Eingetragene Schüler:')}</span>
                      <span className="text-[10.5px] text-slate-400 font-semibold">{info.hodStudentsList.length} {_t('طالب', 'students', 'Schüler')}</span>
                    </h5>

                    {info.hodStudentsList.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-gray-800 text-center space-y-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                          {_t(`لا يوجد طلاب HOD مسجلين باسم فصل (${selectedClassForHod}) حالياً.`, `No HOD students directly tagged with (${selectedClassForHod}) yet.`, `Keine HOD-Schüler für (${selectedClassForHod}) eingetragen.`)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsHodStudentsModalOpen(false);
                            setActiveTab('hod');
                          }}
                          className="text-[11px] font-black text-primary hover:underline cursor-pointer"
                        >
                          {_t('+ إضافة وإدارة الطلاب من قسم الإشراف (HOD Hub)', '+ Manage Students in HOD Hub', '+ Im HOD-Hub verwalten')}
                        </button>
                      </div>
                    ) : (
                      <div className="border border-slate-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-gray-800 max-h-56 overflow-y-auto">
                        {info.hodStudentsList.map(st => (
                          <div key={st.id} className="p-2.5 flex items-center justify-between gap-2 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-white">{st.name}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">
                                {st.grade || selectedClassForHod} • {_t('المستوى:', 'Status:', 'Status:')} {st.status || _t('نشط', 'Active', 'Aktiv')}
                              </div>
                            </div>
                            {st.gpa !== undefined && (
                              <span className="text-xs font-mono font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg">
                                {st.gpa}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setIsHodStudentsModalOpen(false);
                  setActiveTab('hod');
                }}
                className="px-4 py-2 bg-primary-soft hover:bg-primary/20 text-primary border border-primary-border/60 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{_t('الذهاب إلى HOD Hub بالكامل', 'Open Full HOD Hub', 'Vollständigen HOD-Hub öffnen')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsHodStudentsModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: TUTORING CONFLICTS SCANNER MODAL */}
      {isConflictCheckerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-xl p-5 space-y-4 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  tutoringConflictsList.length > 0
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border-amber-300 dark:border-amber-700'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border-emerald-300 dark:border-emerald-700'
                }`}>
                  {tutoringConflictsList.length > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {_t('فحص تعارض الدروس مع الدوام المدرسي', 'Tutoring vs School Schedule Conflict Scanner', 'Kollisionsprüfung Unterricht vs Schule')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {_t('كاشف فوري للتعارض بين جدول الحصص المدرسية ومواعيد الدروس الخصوصية', 'Live detector for overlaps between school periods and private lessons', 'Live-Prüfung auf Überschneidungen')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConflictCheckerModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {tutoringConflictsList.length === 0 ? (
              <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                  {_t('ممتاز! لا يوجد أي تعارض زمني', 'Perfect! Zero Schedule Conflicts Detected', 'Keine Kollisionen gefunden')}
                </h4>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300 max-w-sm mx-auto">
                  {_t('جميع دروسك الخصوصية تقع خارج أوقات الحصص المدرسية وأوقات التواجد في المدرسة.', 'All private lessons are scheduled outside of school presence and period timings.', 'Alle Privatstunden liegen außerhalb der Schulzeiten.')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-2xl text-xs text-amber-800 dark:text-amber-200 font-semibold">
                  {_t(`تم رصد (${tutoringConflictsList.length}) درس خصوصي يتعارض مع جدول المدرسة:`, `Detected (${tutoringConflictsList.length}) private lessons overlapping with school time:`, `(${tutoringConflictsList.length}) Kollisionen mit Schulzeit entdeckt:`)}
                </div>

                <div className="border border-slate-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
                  {tutoringConflictsList.map(cf => (
                    <div key={cf.lessonId} className="p-3 bg-white dark:bg-gray-900 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {cf.studentOrGroup}
                        </span>
                        <span className="text-[10.5px] font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                          {cf.dayLabel} • {cf.lessonTime}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{cf.detail}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsConflictCheckerModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: SCHOOL NOTES & LESSON PREP MODAL */}
      {isSchoolNotesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-xl p-5 space-y-4 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {_t('ملاحظات وتحضير الحصص المدرسية', 'School Notes & Lesson Log', 'Schulnotizen & Unterrichtsberichte')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {_t('تسجيل ملاحظات المتابعة والتحضير لكل حصة وفصل', 'Log follow-up notes and preparation per period & class', 'Notizen und Vorbereitung protokollieren')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSchoolNotesModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddQuickSchoolNote} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-gray-800 space-y-2.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-500" />
                <span>{_t('تسجيل ملاحظة جديدة فوراً:', 'Log New Note:', 'Neue Notiz:')}</span>
              </span>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={_t('الفصل (مثال: 10-A)', 'Class (e.g. 10-A)', 'Klasse (z.B. 10-A)')}
                  value={noteFormClass}
                  onChange={(e) => setNoteFormClass(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                />
                <select
                  value={noteFormTag}
                  onChange={(e) => setNoteFormTag(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                >
                  <option value="شرح">{_t('شرح وتحضير', 'Explanation/Prep', 'Erklärung')}</option>
                  <option value="واجب">{_t('واجب / مهمة', 'Homework/Task', 'Hausaufgabe')}</option>
                  <option value="سلوك">{_t('سلوك وملاحظة', 'Behavior/Note', 'Verhalten')}</option>
                  <option value="اختبار">{_t('اختبار قصير', 'Quiz/Exam', 'Test')}</option>
                </select>
              </div>

              <textarea
                required
                rows={2}
                placeholder={_t('اكتب الملاحظة المدرسية هنا...', 'Type school note here...', 'Schulnotiz hier eingeben...')}
                value={noteFormText}
                onChange={(e) => setNoteFormText(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white resize-none"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                >
                  {_t('حفظ الملاحظة', 'Save Note', 'Notiz speichern')}
                </button>
              </div>
            </form>

            {/* List Existing Notes */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-black text-slate-800 dark:text-white">
                {_t('الملاحظات المسجلة سابقاً:', 'Logged Notes:', 'Bisherige Notizen:')} ({schoolNotes.length})
              </h5>

              {schoolNotes.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl">
                  {_t('لا توجد ملاحظات مدرسية مسجلة حتى الآن.', 'No school notes recorded yet.', 'Noch keine Notizen.')}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {schoolNotes.slice(0, 10).map((nt) => (
                    <div key={nt.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-gray-800 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {nt.className ? `${_t('فصل', 'Class', 'Klasse')} ${nt.className}` : _t('ملاحظة عامة', 'General Note', 'Allgemein')}
                        </span>
                        <div className="flex items-center gap-1">
                          {nt.tags?.map((tg: string) => (
                            <span key={tg} className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded text-[9px] font-bold">
                              {tg}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => deleteSchoolNote(nt.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {nt.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsSchoolNotesModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: COPY DAY SCHEDULE MODAL */}
      {isCopyDayModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 w-full max-w-md p-5 space-y-4 animate-scale-up shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-850">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-800">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {_t('نسخ جدول اليوم إلى يوم آخر', 'Copy Day Schedule', 'Tagesplan kopieren')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {_t(`نسخ حصص يوم (${daysList.find(d => d.key === selectedDay)?.label || selectedDay}) كاملة`, `Copy all lessons from selected day`, `Alle Stunden kopieren`)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyDayModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-200">
                {_t('اختر اليوم الهدف للصق الحصص فيه:', 'Select target day to paste schedule into:', 'Zieltagesplan wählen:')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {daysList.filter(d => d.key !== selectedDay).map(d => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => handleCopyDaySchedule(d.key)}
                    className="p-3 text-start bg-slate-50 hover:bg-purple-50 dark:bg-slate-800/60 dark:hover:bg-purple-950/30 border border-slate-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-purple-600">
                      {d.label}
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {_t('استبدال جدول هذا اليوم', 'Overwrite target day', 'Diesen Tag überschreiben')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsCopyDayModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST ALERT */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg font-semibold text-xs animate-bounce" id="school-schedule-toast-alert">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* EXPORT MODAL */}
      {isExportModalOpen && (
        <SchoolScheduleExportModal onClose={() => setIsExportModalOpen(false)} />
      )}
    </div>
  );
};
