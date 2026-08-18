import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { X, Calendar as CalendarIcon, Download, Share2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
  const { lessons, groups, students } = useApp();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-11
  const todayStr = formatLocalDate(now); // YYYY-MM-DD
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIndex); // 0-11
  const [exportStep, setExportStep] = useState<'config' | 'summary'>('config');
  const [exportStats, setExportStats] = useState<{
    groupsCount: number;
    lessonsCount: number;
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
      'X-WR-CALNAME:Teacher Assistant - ' + MONTH_NAMES_DISPLAY[selectedMonth] + ' ' + selectedYear
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

    icsLines.push('END:VCALENDAR');

    const icsContentStr = icsLines.join('\r\n');
    const monthNameLower = MONTH_NAMES_EN[selectedMonth];
    const filename = `teacher_assistant_${monthNameLower}_${selectedYear}.ics`;

    setExportStats({
      groupsCount: exportedGroupIds.size,
      lessonsCount: filteredLessons.length,
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
      <div className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-surface-border-soft rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-surface-border-soft bg-surface-hover/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-soft dark:bg-primary-soft flex items-center justify-center text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">
                Export Monthly Calendar (.ics)
              </h3>
              <p className="text-xs text-text-muted">
                {exportStep === 'config' ? 'Select month and year to export' : 'Export summary & download'}
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
        <div className="p-6 space-y-5">
          {exportStep === 'config' ? (
            <>
              {/* Quick Shortcuts */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  Quick Shortcuts
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
                    Current Month ({MONTH_NAMES_DISPLAY[currentMonthIndex]})
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
                    Next Month
                  </button>
                </div>
              </div>

              {/* Month & Year Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    Month
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
                    Year
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

              <div className="bg-primary-soft/50 dark:bg-primary-soft/20 border border-primary-border/50 rounded-xl p-3 text-xs text-text-main space-y-1">
                <p className="font-bold flex items-center gap-1 text-primary">
                  <span>ℹ️ Export Details</span>
                </p>
                <p className="text-text-muted">
                  Exports active group lessons for <strong className="text-text-main">{MONTH_NAMES_DISPLAY[selectedMonth]} {selectedYear}</strong> with reminders (-30m, -10m), Zoom/address info, and student lists. Past completed lessons are automatically excluded.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExecuteExport}
                  className="w-full bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Generate ICS Calendar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* SUMMARY VIEW */}
              <div className="text-center py-2 space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-black text-text-main">
                  Calendar Export Complete
                </h4>
                <p className="text-xs text-text-muted">
                  Your ICS file is ready for Google Calendar, Apple Calendar, and Outlook.
                </p>
              </div>

              <div className="bg-background border border-surface-border dark:border-surface-border-soft rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-border-soft">
                  <span className="text-text-muted font-medium">Month:</span>
                  <span className="font-bold text-text-main">{MONTH_NAMES_DISPLAY[selectedMonth]} {selectedYear}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-border-soft">
                  <span className="text-text-muted font-medium">Groups Exported:</span>
                  <span className="font-bold text-primary">{exportStats?.groupsCount || 0}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-border-soft">
                  <span className="text-text-muted font-medium">Lessons Exported:</span>
                  <span className="font-bold text-emerald-500">{exportStats?.lessonsCount || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted font-medium">Students Included:</span>
                  <span className="font-bold text-text-main">{exportStats?.studentsCount || 0}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="w-full bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download ICS File ({exportStats?.filename})</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareFile}
                  className="w-full bg-background hover:bg-surface-hover dark:hover:bg-slate-800 text-text-main border border-surface-border dark:border-surface-border-soft font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-primary" />
                  <span>Share ICS File</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportStep('config')}
                  className="text-xs text-text-muted hover:text-text-main font-semibold text-center py-1 cursor-pointer"
                >
                  ← Back to Month Selector
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
