import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SchoolSettings, SchoolPeriodRecord, SchoolPeriodSettings, SchoolDayPresence } from '../types';
import { 
  BookOpen, Sparkles, Copy, Check, Upload, AlertTriangle, Info,
  Plus, Trash2, Calendar, Clock, Edit3, X, CheckCircle2, RefreshCw, FileText,
  Download, Share2
} from 'lucide-react';
import { 
  getSchoolSettings, 
  calculatePeriodsTimings, 
  parseTimeToMinutes,
  formatMinutesToTime 
} from '../utils/schoolUtils';
import { SchoolScheduleExportModal } from './SchoolScheduleExportModal';

export const SchoolScheduleView: React.FC = () => {
  const { profile, updateProfile, rebuildNotificationSchedules, language, _t, t } = useApp();
  
  const currentSettings = getSchoolSettings(profile);
  const [selectedDay, setSelectedDay] = useState<string>('0'); // '0' = Sunday
  const [editingPeriod, setEditingPeriod] = useState<{ dayKey: string; periodNumber: number } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Edit Form Fields
  const [subjectName, setSubjectName] = useState('');
  const [className, setClassName] = useState('');
  const [notes, setNotes] = useState('');

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

  // AI Import Prompt Generator
  const generateAIPrompt = (): string => {
    return `You are an expert school schedule parser and visual information extractor. 
I am going to provide you with an image, text, PDF, or screenshot of my personal school teaching schedule.

Your task is to extract this schedule and output a clean, strict JSON document matching the exact schema below.

JSON SCHEMA:
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
    "periodsCount": 7,
    "firstPeriodStart": "08:00",
    "defaultDuration": 45,
    "customDurations": {}
  },
  "schedule": {
    "0": [
      { "periodNumber": 1, "subjectName": "German Language", "className": "Class 10-A", "notes": "" },
      { "periodNumber": 2, "subjectName": "German Language", "className": "Class 10-B", "notes": "" }
    ],
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": []
  }
}

KEY CONSTRAINTS & RULES:
1. Days of week keys range from "0" (Sunday) to "6" (Saturday). Activate ("active": true) only the days that are actual school teaching days.
2. The arrival and departure times represent my overall presence block at the school, not just the duration of classes (e.g. Arrival 07:30, Departure 14:30).
3. The classes must be indexed in "periodNumber" starting from 1 up to "periodsCount".
4. There are NO gaps or breaks between periods. Period i end = Period i+1 start.
5. If a period duration is different from the default (e.g. period 3 is 35 mins while default is 45), declare it in "customDurations" under "periodSettings": e.g., "customDurations": { "3": 35 }.
6. Keep subject names, class/group identifiers, and notes highly accurate. Use Arabic or English or German depending on how they appear in the original schedule.
7. Use 24-hour HH:MM formatting (e.g. "07:30", "13:15") for all times.
8. If an information is completely blank, unclear or missing, represent it with null or omit it. Do not invent any records.
9. ONLY output the valid JSON markdown block (with \`\`\`json and \`\`\`). No preamble, no conversational greetings, no extra explanation text.`;
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
    
    updateProfile({
      schoolSettings: validationResult.parsedData
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

  const isEmpty = totalWeeklyLessons === 0 && !showTableEvenIfEmpty;

  return (
    <div className="space-y-3 pb-6" id="school-schedule-root">
      {/* HEADER BAR WITH AI BUTTON & COMPACT OVERVIEW */}
      <div className="flex flex-row items-center justify-between gap-2.5 flex-wrap" id="school-schedule-header">
        {/* COMPACT OVERVIEW SUMMARY LINE */}
        <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-gray-800 text-[11px] text-slate-500 dark:text-slate-400 font-bold" id="school-overview-box">
          <span>{totalUniqueClasses} {_t('فصول', 'Classes', 'Klassen')}</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>{totalUniqueStages} {_t('مراحل', 'Stages', 'Stufen')}</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="text-primary font-black">{totalWeeklyLessons} {_t('حصة أسبوعية', 'Weekly Lessons', 'Wochenstunden')}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface hover:bg-surface-hover text-text-main rounded-lg text-xs font-bold transition-all active:scale-95 border border-surface-border shrink-0 cursor-pointer shadow-2xs"
            id="export-school-schedule-btn"
            title={_t('تصدير الجدول الأسبوعي (PDF / PNG / JPG)', 'Export Weekly Schedule (PDF / PNG / JPG)', 'Wochenplan exportieren (PDF / PNG / JPG)')}
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>{_t('تصدير', 'Export', 'Exportieren')}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-soft hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-all active:scale-95 border border-primary-border/60 shrink-0 cursor-pointer"
            id="import-ai-btn"
            title={_t('استيراد بالذكاء الاصطناعي', 'Import with AI', 'Mit KI importieren')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{_t('استيراد بالذكاء الاصطناعي', 'Import with AI', 'Mit KI importieren')}</span>
          </button>
        </div>
      </div>

      {isEmpty ? (
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
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">
              {_t('الجدول الأسبوعي العام', 'Weekly Schedule Grid', 'Wochen-Stundenplan')}
            </h3>
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
                          className={`bg-slate-50/60 dark:bg-slate-900/60 border-r border-slate-100 dark:border-gray-850 p-1 sm:p-2 text-center`}
                        >
                          <div className="text-[10px] sm:text-xs font-black text-primary font-mono">
                            {_t(`ح${period.periodNumber}`, `P${period.periodNumber}`, `Std. ${period.periodNumber}`)}
                          </div>
                          <div className="text-[7.5px] sm:text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 leading-none">
                            {period.startTime}
                          </div>
                        </td>

                        {/* Day Columns */}
                        {columnsDayKeys.map((dayKey) => {
                          const daySchedule = currentSettings.schedule[dayKey] || [];
                          const record = daySchedule.find(p => p.periodNumber === period.periodNumber);
                          const isFilled = record && (record.subjectName || record.className);
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
                              {isFilled ? (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDay(dayKey);
                                    startEditPeriod(dayKey, period.periodNumber);
                                  }}
                                  className="p-0.5 sm:p-1.5 rounded-lg bg-primary-soft/50 dark:bg-primary-soft/25 border border-primary-border/40 text-center flex flex-col justify-center items-center min-h-[38px] sm:min-h-[44px] transition-all hover:bg-primary-soft/80 group/card overflow-hidden"
                                >
                                  {record.className ? (
                                    <>
                                      <div className="text-[10.5px] sm:text-xs font-black text-slate-900 dark:text-white leading-tight truncate max-w-full tracking-tight">
                                        {record.className}
                                      </div>
                                      {record.subjectName && (
                                        <div className="text-[7px] sm:text-[8px] font-bold text-primary leading-none truncate max-w-full mt-0.5 uppercase opacity-90">
                                          {record.subjectName}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-[9px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                                      {record.subjectName}
                                    </div>
                                  )}
                                </div>
                              ) : (
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

          {/* DAILY TIMELINE LIST */}
          <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 space-y-2.5" id="daily-timeline-section">
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
            </div>

            {(() => {
              const selectedDayObj = daysList.find(d => d.key === selectedDay)!;
              const isSchoolActive = currentSettings.presence[selectedDay]?.active;
              const daySchedule = currentSettings.schedule[selectedDay] || [];

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

              const filledPeriods = calculatedPeriods.filter(period => {
                const record = daySchedule.find(p => p.periodNumber === period.periodNumber);
                return record && (record.subjectName || record.className);
              });

              if (filledPeriods.length === 0) {
                return (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/20 border border-dashed border-slate-100 dark:border-gray-800 text-center space-y-1">
                    <Info className="w-4 h-4 text-slate-400 mx-auto" />
                    <h4 className="text-xs font-black text-slate-500 dark:text-slate-400">
                      {_t('لا توجد حصص مجدولة لهذا اليوم', 'No scheduled classes for this day', 'Keine Unterrichtsstunden für diesen Tag geplant')}
                    </h4>
                    <button
                      onClick={() => startEditPeriod(selectedDay, 1)}
                      className="text-[10px] font-black text-primary hover:underline cursor-pointer"
                    >
                      {_t('+ إضافة أول حصة اليوم', '+ Add first class today', '+ Erste Stunde hinzufügen')}
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2" id="periods-timeline-list">
                  {filledPeriods.map((period) => {
                    const record = daySchedule.find(p => p.periodNumber === period.periodNumber)!;
                    const isFilled = record && (record.subjectName || record.className);

                    return (
                      <div 
                        key={period.periodNumber}
                        className="p-2.5 rounded-lg border bg-primary-soft/20 dark:bg-primary-soft/10 border-primary-border/40 transition-all duration-200"
                        id={`period-item-${period.periodNumber}`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex gap-2 text-start">
                            <span className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                              {period.periodNumber}
                            </span>
                            
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                                  {period.startTime} - {period.endTime}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  ({period.duration} {_t('دقيقة', 'mins', 'Min.')})
                                </span>
                              </div>

                              <div className="space-y-1 pt-0.5">
                                {record.className ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">
                                      {record.className}
                                    </span>
                                    {record.subjectName && (
                                      <span className="text-[10px] font-bold text-primary bg-primary-soft border border-primary-border/60 px-2 py-0.5 rounded-md uppercase">
                                        {record.subjectName}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {record.subjectName}
                                  </div>
                                )}
                                {record.notes && (
                                  <p className="text-[10px] text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-gray-800">
                                    {record.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEditPeriod(selectedDay, period.periodNumber)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors focus:outline-none cursor-pointer"
                              title={_t('تعديل', 'Edit', 'Bearbeiten')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            
                            {isFilled && (
                              <button
                                onClick={() => clearPeriod(selectedDay, period.periodNumber)}
                                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg transition-colors focus:outline-none cursor-pointer"
                                title={_t('مسح الحصة', 'Clear Period', 'Entfernen')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {_t('ملاحظات إضافية', 'Additional Notes', 'Zusätzliche Notizen')}
                </label>
                <textarea
                  rows={2}
                  placeholder={_t('أي ملاحظات أو تنبيهات لهذه الحصة...', 'Any notes regarding this school period...', 'Notizen zu dieser Stunde...')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPeriod(null)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={savePeriodEdit}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold focus:outline-none shadow-xs cursor-pointer active:scale-95"
              >
                {_t('حفظ البيانات', 'Save', 'Speichern')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AI IMPORT WIZARD */}
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

                {/* PREVIEW OF THE IMPORT DATA */}
                {validationResult.isValid && validationResult.parsedData && (
                  <div className="pt-3 border-t border-slate-200 dark:border-gray-800 space-y-2">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {_t('معاينة الجدول المستخرج للتحقق البصري', 'Schedule Preview Summary', 'Vorschau-Zusammenfassung')}
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                      <div>
                        <strong>{_t('مجموع الحصص اليومية:', 'Daily period count:', 'Stundenanzahl:')}</strong> {validationResult.parsedData.periodSettings.periodsCount}
                      </div>
                      <div>
                        <strong>{_t('بداية أول حصة:', 'First period start:', 'Beginn 1. Stunde:')}</strong> {validationResult.parsedData.periodSettings.firstPeriodStart}
                      </div>
                      <div>
                        <strong>{_t('مدة الحصة الافتراضية:', 'Default duration:', 'Standard-Dauer:')}</strong> {validationResult.parsedData.periodSettings.defaultDuration} {_t('دقيقة', 'mins', 'Min.')}
                      </div>
                      <div>
                        <strong>{_t('أيام المدرسة المفعلة:', 'Active school days:', 'Aktive Schultage:')}</strong> {
                          Object.keys(validationResult.parsedData.presence)
                            .filter(k => validationResult.parsedData!.presence[k].active)
                            .map(k => daysList.find(d => d.key === k)?.short)
                            .join(', ')
                        }
                      </div>
                    </div>
                  </div>
                )}
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
