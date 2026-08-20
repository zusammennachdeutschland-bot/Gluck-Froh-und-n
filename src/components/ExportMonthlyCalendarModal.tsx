import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { 
  X, Calendar as CalendarIcon, Download, Share2, CheckCircle2, ArrowRight, 
  BookOpen, Clock, Check, ShieldCheck 
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getSchoolSettings } from '../utils/schoolUtils';
import { generateMonthlySchoolScheduleIcsEvents } from '../utils/schoolScheduleIcsUtils';

interface ExportMonthlyCalendarModalProps {
  onClose: () => void;
}

const MONTH_NAMES_EN = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const MONTH_NAMES_DISPLAY = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ExportMonthlyCalendarModal: React.FC<ExportMonthlyCalendarModalProps> = ({ onClose }) => {
  const { lessons, groups, students, profile, language, _t } = useApp();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-11
  const todayStr = formatLocalDate(now); // YYYY-MM-DD
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const schoolSettings = useMemo(() => getSchoolSettings(profile), [profile]);
  
  const weeklySchoolLessonsCount = useMemo(() => {
    const days = Object.values(schoolSettings.schedule || {});
    return days.reduce<number>(
      (acc: number, day: any) => acc + (Array.isArray(day) ? day.filter((r: any) => r && (r.subjectName || r.className)).length : 0),
      0
    );
  }, [schoolSettings]);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIndex); // 0-11
  const [includeSchoolSchedule, setIncludeSchoolSchedule] = useState<boolean>(weeklySchoolLessonsCount > 0);
  const [includeSchoolPresence, setIncludeSchoolPresence] = useState<boolean>(false);
  const [exportStep, setExportStep] = useState<'config' | 'summary'>('config');
  const [exportStats, setExportStats] = useState<{
    groupsCount: number;
    lessonsCount: number;
    schoolLessonsCount: number;
    schoolPresenceCount: number;
    totalEventsCount: number;
    studentsCount: number;
    filename: string;
    icsContent: string;
  } | null>(null);

  // Quick Month Shortcuts
  const handleSelectCurrentMonth = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonthIndex);
  };

  const handleSelectNextMonth = () => {
    let nextM = currentMonthIndex + 1;
    let nextY = currentYear;
    if (nextM > 11) {
      nextM = 0;
      nextY += 1;
    }
    setSelectedYear(nextY);
    setSelectedMonth(nextM);
  };

  const handleExecuteExport = () => {
    // 1. Filter active groups (non-archived)
    const activeGroupIds = new Set(groups.filter(g => g.status !== 'archived').map(g => g.id));

    // 2. Filter lessons for selected month & year
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const yearMonthPrefix = `${selectedYear}-${monthStr}`;

    const isCurrentMonthSelection = (selectedYear === currentYear && selectedMonth === currentMonthIndex);

    const filteredLessons = lessons.filter(l => {
      if (!l.date || !l.date.startsWith(yearMonthPrefix)) return false;
      if (l.groupId && !activeGroupIds.has(l.groupId)) return false;

      // If current month, exclude past lessons outside rules
      if (isCurrentMonthSelection) {
        if (l.date < todayStr) return false;
        if (l.date === todayStr) {
          const [hStr, mStr] = (l.time || '00:00').split(':');
          const lessonStartMins = parseInt(hStr || '0', 10) * 60 + parseInt(mStr || '0', 10);
          const duration = l.durationMinutes || 60;
          const lessonEndMins = lessonStartMins + duration;
          if (currentMinutes >= lessonEndMins) {
            return false; // Lesson already ended today
          }
        }
      }
      return true;
    });

    // 3. Build ICS content
    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Glück//Teacher Assistant Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Glück Schedule - ' + MONTH_NAMES_DISPLAY[selectedMonth] + ' ' + selectedYear
    ];

    const exportedGroupIds = new Set<string>();
    const includedStudentIds = new Set<string>();

    filteredLessons.forEach(l => {
      if (l.groupId) exportedGroupIds.add(l.groupId);
      if (l.studentId) includedStudentIds.add(l.studentId);
      const groupStudents = students.filter(s => s.groupId === l.groupId);
      groupStudents.forEach(s => includedStudentIds.add(s.id));

      const targetGroup = groups.find(g => g.id === l.groupId);
      const groupName = l.groupName || targetGroup?.name || 'Group';
      const grade = l.grade || targetGroup?.grade || 'General';
      const duration = l.durationMinutes || targetGroup?.lessonDurationMinutes || 60;
      const lessonType = l.type || targetGroup?.type || 'offline';
      const zoomLink = l.meetingLink || targetGroup?.zoomLink || '';
      const address = l.locationAddress || targetGroup?.address || '';
      const price = l.amountDue || targetGroup?.monthlyPackagePrice || 0;
      const paymentCycle = targetGroup?.paymentCycle || 'Per Lesson';

      const studentListText = groupStudents.length > 0 
        ? groupStudents.map(s => `• ${s.name} (${s.grade || grade})`).join('\\n')
        : (l.studentName ? `• ${l.studentName}` : 'No students listed');

      const cleanDate = l.date.replace(/-/g, '');
      const cleanTime = (l.time || '17:00').replace(':', '') + '00';
      const startDT = `${cleanDate}T${cleanTime}`;

      const endDateObj = new Date(`${l.date}T${l.time || '17:00'}:00`);
      endDateObj.setMinutes(endDateObj.getMinutes() + duration);
      const endY = endDateObj.getFullYear();
      const endMo = String(endDateObj.getMonth() + 1).padStart(2, '0');
      const endDa = String(endDateObj.getDate()).padStart(2, '0');
      const endHStr = String(endDateObj.getHours()).padStart(2, '0');
      const endMStr = String(endDateObj.getMinutes()).padStart(2, '0');
      const endDT = `${endY}${endMo}${endDa}T${endHStr}${endMStr}00`;

      const uid = `lesson_${l.id}_${cleanDate}@teacherassistant`;
      const summary = `🇩🇪 German Lesson - ${groupName}`;

      let desc = `Group: ${groupName}\\n\\nStudents:\\n${studentListText}\\n\\nGrade: ${grade}\\nType: ${lessonType.toUpperCase()}\\nPayment: ${price} EGP (${paymentCycle})`;
      if (lessonType === 'online' && zoomLink) {
        desc += `\\n\\nZoom Link:\\n${zoomLink}`;
      } else if (address) {
        desc += `\\n\\nAddress:\\n${address}`;
      }

      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:${uid}`);
      icsLines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      icsLines.push(`DTSTART:${startDT}`);
      icsLines.push(`DTEND:${endDT}`);
      icsLines.push(`SUMMARY:${summary}`);
      icsLines.push(`DESCRIPTION:${desc}`);
      if (zoomLink) {
        icsLines.push(`LOCATION:${zoomLink}`);
      } else if (address) {
        icsLines.push(`LOCATION:${address}`);
      }

      // Reminders: 30 mins before, 10 mins before
      icsLines.push('BEGIN:VALARM');
      icsLines.push('TRIGGER:-PT30M');
      icsLines.push('ACTION:DISPLAY');
      icsLines.push(`DESCRIPTION:Reminder: ${summary} in 30 minutes`);
      icsLines.push('END:VALARM');

      icsLines.push('BEGIN:VALARM');
      icsLines.push('TRIGGER:-PT10M');
      icsLines.push('ACTION:DISPLAY');
      icsLines.push(`DESCRIPTION:Reminder: ${summary} in 10 minutes`);
      icsLines.push('END:VALARM');

      icsLines.push('END:VEVENT');
    });

    // 4. Optionally append School Schedule Events for the selected month
    let schoolPeriodsCount = 0;
    let schoolPresenceCount = 0;

    if (includeSchoolSchedule && weeklySchoolLessonsCount > 0) {
      const schoolIcsData = generateMonthlySchoolScheduleIcsEvents(
        schoolSettings,
        selectedYear,
        selectedMonth,
        {
          includePresence: includeSchoolPresence,
          language: language as any,
          reminderMinutes: 15
        }
      );
      icsLines.push(...schoolIcsData.icsLines);
      schoolPeriodsCount = schoolIcsData.totalPeriodsCount;
      schoolPresenceCount = includeSchoolPresence ? schoolIcsData.activeSchoolDaysCount : 0;
    }

    icsLines.push('END:VCALENDAR');

    const icsContentStr = icsLines.join('\r\n');
    const monthNameLower = MONTH_NAMES_EN[selectedMonth];
    const filename = `teacher_assistant_${monthNameLower}_${selectedYear}.ics`;

    setExportStats({
      groupsCount: exportedGroupIds.size,
      lessonsCount: filteredLessons.length,
      schoolLessonsCount: schoolPeriodsCount,
      schoolPresenceCount,
      totalEventsCount: filteredLessons.length + schoolPeriodsCount + schoolPresenceCount,
      studentsCount: includedStudentIds.size,
      filename,
      icsContent: icsContentStr
    });
    setExportStep('summary');
  };

  const handleDownloadFile = async () => {
    if (!exportStats) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const savedFile = await Filesystem.writeFile({
          path: exportStats.filename,
          data: exportStats.icsContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: 'Calendar Export',
          text: `Glück Calendar Export - ${exportStats.filename}`,
          url: savedFile.uri,
          dialogTitle: 'Save Calendar File'
        });
        return;
      } catch (err) {
        console.warn('Capacitor save/share failed, fallback to web download:', err);
      }
    }

    const blob = new Blob([exportStats.icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportStats.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareFile = async () => {
    if (!exportStats) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const savedFile = await Filesystem.writeFile({
          path: exportStats.filename,
          data: exportStats.icsContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: `Calendar Export - ${MONTH_NAMES_DISPLAY[selectedMonth]} ${selectedYear}`,
          text: `Teacher Assistant calendar for ${MONTH_NAMES_DISPLAY[selectedMonth]} ${selectedYear}`,
          url: savedFile.uri,
          dialogTitle: 'Share Calendar File'
        });
        return;
      } catch (err) {
        console.warn('Capacitor share failed, fallback to web:', err);
      }
    }

    const file = new File([exportStats.icsContent], exportStats.filename, { type: 'text/calendar' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Calendar Export - ${MONTH_NAMES_DISPLAY[selectedMonth]} ${selectedYear}`,
          text: `Teacher Assistant calendar for ${MONTH_NAMES_DISPLAY[selectedMonth]} ${selectedYear}`,
          files: [file]
        });
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }
    handleDownloadFile();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-surface-border-soft rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-surface-border-soft bg-surface-hover/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-soft dark:bg-primary-soft flex items-center justify-center text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">
                {_t('تصدير التقويم الشهري (.ics)', 'Export Monthly Calendar (.ics)', 'Monatskalender exportieren (.ics)')}
              </h3>
              <p className="text-xs text-text-muted">
                {exportStep === 'config' 
                  ? _t('تخصيص الشهر والبيانات المراد تصديرها', 'Select month & data to export', 'Monat und Daten zum Exportieren wählen') 
                  : _t('ملخص التصدير والتحميل', 'Export summary & download', 'Export-Übersicht & Download')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {exportStep === 'config' ? (
            <>
              {/* Quick Shortcuts */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  {_t('اختصارات سريعة', 'Quick Shortcuts', 'Schnellzugriff')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSelectCurrentMonth}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedMonth === currentMonthIndex && selectedYear === currentYear
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-background hover:bg-surface-hover dark:hover:bg-slate-800 text-text-main border-surface-border dark:border-surface-border-soft'
                    }`}
                  >
                    {_t('الشهر الحالي', 'Current Month', 'Aktueller Monat')} ({MONTH_NAMES_DISPLAY[currentMonthIndex]})
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectNextMonth}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      (selectedMonth === (currentMonthIndex + 1) % 12) && (selectedYear === currentYear + (currentMonthIndex === 11 ? 1 : 0))
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-background hover:bg-surface-hover dark:hover:bg-slate-800 text-text-main border-surface-border dark:border-surface-border-soft'
                    }`}
                  >
                    {_t('الشهر القادم', 'Next Month', 'Nächster Monat')}
                  </button>
                </div>
              </div>

              {/* Month & Year Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    {_t('الشهر', 'Month', 'Monat')}
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-background border border-surface-border dark:border-surface-border-soft rounded-xl px-3 py-2.5 text-sm font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {MONTH_NAMES_DISPLAY.map((m, idx) => (
                      <option key={idx} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    {_t('السنة', 'Year', 'Jahr')}
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-background border border-surface-border dark:border-surface-border-soft rounded-xl px-3 py-2.5 text-sm font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SCHOOL SCHEDULE INTEGRATION TOGGLE */}
              <div className="p-3.5 rounded-2xl bg-surface-hover/70 dark:bg-slate-800/50 border border-surface-border dark:border-surface-border-soft space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-primary-soft text-primary shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-text-main">
                        {_t('تضمين جدول وحصص المدرسة', 'Include School Schedule', 'Schulstundenplan einbeziehen')}
                      </h4>
                      <p className="text-[11px] text-text-muted">
                        {weeklySchoolLessonsCount > 0 
                          ? _t(`${weeklySchoolLessonsCount} حصة مدرسية أسبوعياً`, `${weeklySchoolLessonsCount} weekly school classes`, `${weeklySchoolLessonsCount} Schulstunden/Woche`)
                          : _t('لم يتم إدخال حصص مدرسية بعد', 'No school classes set yet', 'Noch keine Schulstunden eingetragen')}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={includeSchoolSchedule}
                      onChange={(e) => setIncludeSchoolSchedule(e.target.checked)}
                      disabled={weeklySchoolLessonsCount === 0}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {includeSchoolSchedule && weeklySchoolLessonsCount > 0 && (
                  <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between gap-2 text-xs">
                    <span className="text-text-muted text-[11px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {_t('تضمين كتلة الدوام المدرسي بالكامل (الحضور والانصراف)', 'Include full school presence block', 'Gesamte Schulpräsenz einbeziehen')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeSchoolPresence}
                      onChange={(e) => setIncludeSchoolPresence(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* INFO BOX */}
              <div className="bg-primary-soft/40 dark:bg-primary-soft/20 border border-primary-border/50 rounded-xl p-3 text-xs text-text-main space-y-1">
                <p className="font-bold flex items-center gap-1 text-primary">
                  <span>ℹ️ {_t('تفاصيل التصدير', 'Export Details', 'Export-Details')}</span>
                </p>
                <p className="text-text-muted leading-relaxed">
                  {_t(
                    `يتم تصدير الحصص لشهر ${MONTH_NAMES_DISPLAY[selectedMonth]} ${selectedYear} بتنبيهات مسبقة ومعلومات الروابط والعناوين، متوافقة مباشرة مع تقويم Google وApple.`,
                    `Exports active lessons for ${MONTH_NAMES_DISPLAY[selectedMonth]} ${selectedYear} with reminders, addresses/links, compatible with Google Calendar & Apple Calendar.`,
                    `Exportiert Termine für ${MONTH_NAMES_DISPLAY[selectedMonth]} ${selectedYear} kompatibel mit Google & Apple Kalender.`
                  )}
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleExecuteExport}
                  className="w-full bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{_t('إنشاء وتجهيز ملف التقويم (.ics)', 'Generate ICS Calendar', 'ICS-Kalender generieren')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* SUMMARY VIEW */}
              <div className="text-center py-2 space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-black text-text-main">
                  {_t('اكتمل تجهيز التقويم بنجاح', 'Calendar Export Complete', 'Kalenderexport abgeschlossen')}
                </h4>
                <p className="text-xs text-text-muted">
                  {_t(
                    'ملف ICS جاهز للاستيراد في Google Calendar و Apple Calendar و Outlook.',
                    'Your ICS file is ready for Google Calendar, Apple Calendar, and Outlook.',
                    'Ihre ICS-Datei ist bereit für Google Kalender, Apple Kalender und Outlook.'
                  )}
                </p>
              </div>

              <div className="bg-background border border-surface-border dark:border-surface-border-soft rounded-xl p-4 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-border-soft">
                  <span className="text-text-muted font-medium">{_t('الشهر المحدد:', 'Month:', 'Monat:')}</span>
                  <span className="font-bold text-text-main">{MONTH_NAMES_DISPLAY[selectedMonth]} {selectedYear}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-border-soft">
                  <span className="text-text-muted font-medium">{_t('المجموعات الخاصة:', 'Private Groups:', 'Gruppen:')}</span>
                  <span className="font-bold text-primary">{exportStats?.groupsCount || 0}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-border-soft">
                  <span className="text-text-muted font-medium">{_t('دروس المجموعات:', 'Group Lessons:', 'Gruppenstunden:')}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{exportStats?.lessonsCount || 0}</span>
                </div>
                {exportStats && exportStats.schoolLessonsCount > 0 && (
                  <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-border-soft">
                    <span className="text-text-muted font-medium flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      {_t('حصص المدرسة المضمنة:', 'School Classes Included:', 'Schulstunden:')}
                    </span>
                    <span className="font-bold text-primary">{exportStats.schoolLessonsCount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-text-main font-bold">{_t('إجمالي الأحداث المصدرة:', 'Total Calendar Events:', 'Gesamtanzahl Termine:')}</span>
                  <span className="font-black text-sm text-primary">{exportStats?.totalEventsCount || 0}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="w-full bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{_t('تحميل ملف التقويم', 'Download ICS File', 'ICS-Datei herunterladen')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareFile}
                  className="w-full bg-background hover:bg-surface-hover dark:hover:bg-slate-800 text-text-main border border-surface-border dark:border-surface-border-soft font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-primary" />
                  <span>{_t('مشاركة ملف التقويم', 'Share ICS File', 'ICS-Datei teilen')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportStep('config')}
                  className="text-xs text-text-muted hover:text-text-main font-semibold text-center py-1 cursor-pointer"
                >
                  ← {_t('العودة لتحديد الشهر', 'Back to Month Selector', 'Zurück zur Monatsauswahl')}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

