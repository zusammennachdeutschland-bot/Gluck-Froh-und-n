import { checkOverlap } from "../utils/lessonUtils";
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson } from '../types';
import { parseLocalDate, formatLocalDate } from '../utils/timeUtils';
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, 
  Video, MapPin, CheckCircle2, AlertTriangle, Trash2, ArrowLeftRight, 
  Download, X, Check, Zap, RefreshCw, Play, Send, BookOpen, Plus
} from 'lucide-react';
import { StartLessonNowModal } from './StartLessonNowModal';
import { LessonReminderModal } from './LessonReminderModal';
import { ExportMonthlyCalendarModal } from './ExportMonthlyCalendarModal';
import { getSchoolSettings, calculatePeriodsTimings } from '../utils/schoolUtils';
import { DAY_KEY_TO_RRULE_BYDAY, getUpcomingDateForDayKey, formatIcsEventBlock, SchoolIcsEventItem } from '../utils/schoolScheduleIcsUtils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const ScheduleView: React.FC = () => {
  const { lessons, groups, students, profile, openLessonControl, setIsAddLessonModalOpen, setIsAddQuickLessonModalOpen, updateLesson, deleteLesson, refreshCalendarAndDashboard, t, language, _t } = useApp();

  const todayStr = formatLocalDate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [showRefreshToast, setShowRefreshToast] = useState(false);
  const [exportToastMessage, setExportToastMessage] = useState<string | null>(null);
  const [showStartLessonNowModal, setShowStartLessonNowModal] = useState(false);
  const [isExportMonthlyModalOpen, setIsExportMonthlyModalOpen] = useState(false);
  const [reminderLesson, setReminderLesson] = useState<Lesson | null>(null);

  const handleRefreshCalendar = () => {
    refreshCalendarAndDashboard();
    setShowRefreshToast(true);
    setTimeout(() => {
      setShowRefreshToast(false);
    }, 2500);
  };

  // Reschedule Modal State
  const [rescheduleLesson, setRescheduleLesson] = useState<Lesson | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string>('');

  // Working hours from profile
  const workingStart = profile.workingHours?.startTime || '09:00';
  const workingEnd = profile.workingHours?.endTime || '21:30';

  // CONFLICT DETECTION
  const activeLessons = useMemo(() => {
    return lessons.filter(l => !l.deleted);
  }, [lessons]);

  const conflictsMap = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    activeLessons.forEach((l) => {
      if (l.status === 'cancelled') return;
      const key = `${l.date}_${l.time}`;
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    return map;
  }, [activeLessons]);

  const hasConflict = (lessonId: string) => {
    return dayConflicts.includes(lessonId);
  };

  const checkTimeConflict = (date: string, time: string, excludeLessonId?: string) => {
    const dummy = { id: 'dummy', date, time, durationMinutes: 60 };
    return activeLessons.some(l => l.id !== excludeLessonId && l.status !== 'cancelled' && checkOverlap(dummy, l));
  };

  const dayConflicts = useMemo(() => {
    const conflicts: string[] = [];
    const nonCancelled = activeLessons.filter(l => l.status !== 'cancelled');
    for (let i = 0; i < nonCancelled.length; i++) {
      for (let j = i + 1; j < nonCancelled.length; j++) {
        if (checkOverlap(nonCancelled[i], nonCancelled[j])) {
          if (!conflicts.includes(nonCancelled[i].id)) conflicts.push(nonCancelled[i].id);
          if (!conflicts.includes(nonCancelled[j].id)) conflicts.push(nonCancelled[j].id);
        }
      }
    }
    return conflicts;
  }, [activeLessons]);

  // DAY VIEW CALCULATIONS
  const dayLessons = useMemo(() => {
    return activeLessons
      .filter((l) => l.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [activeLessons, selectedDate]);

  // WEEK VIEW CALCULATIONS
  const weekDays = useMemo(() => {
    const current = parseLocalDate(selectedDate);
    const dayOfWeek = current.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(current);
    monday.setDate(current.getDate() + distanceToMonday);

    const days = [];
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatLocalDate(d);
      const lessonsOnDay = activeLessons.filter((l) => l.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));

      days.push({
        dateStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        monthName: d.toLocaleDateString(undefined, { month: 'short' }),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        lessons: lessonsOnDay,
      });
    }
    return days;
  }, [selectedDate, activeLessons, todayStr]);

  // MONTH VIEW CALCULATIONS
  const monthData = useMemo(() => {
    const current = parseLocalDate(selectedDate);
    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const monthName = firstDayOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const gridDays = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      gridDays.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const lessonsOnDay = activeLessons.filter((l) => l.date === dateStr);

      gridDays.push({
        dayNumber: day,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        lessons: lessonsOnDay,
        hasConflict: lessonsOnDay.some((l) => hasConflict(l.id)),
      });
    }

    return { monthName, gridDays };
  }, [selectedDate, activeLessons, todayStr]);

  // RESCHEDULE ACTION
  const openReschedule = (lesson: Lesson) => {
    setRescheduleLesson(lesson);
    setNewDate(lesson.date);
    setNewTime(lesson.time);
    setRescheduleSuccess('');
  };

  const handleSaveReschedule = () => {
    if (!rescheduleLesson || !newDate || !newTime) return;

    updateLesson(rescheduleLesson.id, {
      date: newDate,
      time: newTime,
    });

    setRescheduleSuccess(t('schedule_reschedule_success'));
    setTimeout(() => {
      setRescheduleLesson(null);
      setRescheduleSuccess('');
    }, 1200);
  };

  // GOOGLE CALENDAR ICS EXPORT (TUTORING LESSONS + SCHOOL SCHEDULE)
  const handleExportICS = async () => {
    const schoolSettings = getSchoolSettings(profile);
    const periodsTimings = calculatePeriodsTimings(schoolSettings.periodSettings);
    const timingMap = new Map();
    periodsTimings.forEach(p => timingMap.set(p.periodNumber, p));

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Glück//Teacher Assistant Complete Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Glück Schedule & School Calendar'
    ];

    // 1. Export Private / Group Tutoring Lessons
    let tutoringLessonsCount = 0;
    lessons.forEach((l) => {
      tutoringLessonsCount++;
      const cleanDate = l.date.replace(/-/g, '');
      const cleanTime = (l.time || '17:00').replace(':', '') + '00';
      const startDT = `${cleanDate}T${cleanTime}`;
      const duration = l.durationMinutes || 60;

      const endDateObj = new Date(`${l.date}T${l.time || '17:00'}:00`);
      endDateObj.setMinutes(endDateObj.getMinutes() + duration);
      const endY = endDateObj.getFullYear();
      const endMo = String(endDateObj.getMonth() + 1).padStart(2, '0');
      const endDa = String(endDateObj.getDate()).padStart(2, '0');
      const endHStr = String(endDateObj.getHours()).padStart(2, '0');
      const endMStr = String(endDateObj.getMinutes()).padStart(2, '0');
      const endDT = `${endY}${endMo}${endDa}T${endHStr}${endMStr}00`;

      const targetGroup = groups.find(g => g.id === l.groupId);
      const groupName = l.groupName || targetGroup?.name || 'Group';
      const grade = l.grade || targetGroup?.grade || 'General';
      const location = l.meetingLink || l.locationAddress || targetGroup?.zoomLink || targetGroup?.address || '';

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:lesson_${l.id}_${cleanDate}@teacherassistant`);
      icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      icsContent.push(`SUMMARY:🇩🇪 German - ${groupName} (${grade})`);
      icsContent.push(`DESCRIPTION:Lesson ${l.sessionNumber || 1}/${l.totalSessionsInPackage || 8} - Type: ${(l.type || '').toUpperCase()}`);
      icsContent.push(`DTSTART:${startDT}`);
      icsContent.push(`DTEND:${endDT}`);
      if (location) icsContent.push(`LOCATION:${location}`);
      
      // Alarms
      icsContent.push('BEGIN:VALARM');
      icsContent.push('TRIGGER:-PT30M');
      icsContent.push('ACTION:DISPLAY');
      icsContent.push(`DESCRIPTION:Reminder: German Lesson with ${groupName} in 30 minutes`);
      icsContent.push('END:VALARM');

      icsContent.push('BEGIN:VALARM');
      icsContent.push('TRIGGER:-PT10M');
      icsContent.push('ACTION:DISPLAY');
      icsContent.push(`DESCRIPTION:Reminder: German Lesson with ${groupName} in 10 minutes`);
      icsContent.push('END:VALARM');

      icsContent.push('END:VEVENT');
    });

    // 2. Export Recurring Weekly School Schedule Periods
    let weeklySchoolClassesCount = 0;
    const now = new Date();

    Object.entries(schoolSettings.presence).forEach(([dayKey, presence]) => {
      if (!presence.active) return;
      const byDay = DAY_KEY_TO_RRULE_BYDAY[dayKey] || 'MO';
      const firstOccurDate = getUpcomingDateForDayKey(dayKey, now);
      const cleanDate = firstOccurDate.replace(/-/g, '');

      const daySchedule = schoolSettings.schedule[dayKey] || [];
      daySchedule.forEach((record) => {
        if (!record.subjectName && !record.className) return;
        const timing = timingMap.get(record.periodNumber);
        if (!timing) return;

        weeklySchoolClassesCount++;
        const cleanStartTime = timing.startTime.replace(':', '') + '00';
        const cleanEndTime = timing.endTime.replace(':', '') + '00';
        const startDT = `${cleanDate}T${cleanStartTime}`;
        const endDT = `${cleanDate}T${cleanEndTime}`;

        const subject = record.subjectName || (language === 'ar' ? 'حصة مدرسية' : 'School Lesson');
        const cls = record.className ? `(${record.className})` : '';
        const summary = `🏫 ${subject} ${cls}`.trim();

        const descLines = [
          `School Period: ${record.periodNumber} (${timing.startTime} - ${timing.endTime})`,
          record.className ? `Class / Stage: ${record.className}` : '',
          record.subjectName ? `Subject: ${record.subjectName}` : '',
          record.notes ? `Notes / Room: ${record.notes}` : ''
        ].filter(Boolean);

        const periodEvt: SchoolIcsEventItem = {
          uid: `school_period_rrule_d${dayKey}_p${record.periodNumber}@teacherassistant`,
          summary,
          description: descLines.join('\n'),
          location: record.notes ? `School - ${record.notes}` : 'School',
          startDT,
          endDT,
          rrule: `FREQ=WEEKLY;BYDAY=${byDay}`,
          type: 'period',
          periodNumber: record.periodNumber,
          dayKey
        };

        icsContent.push(...formatIcsEventBlock(periodEvt, 15));
      });
    });

    icsContent.push('END:VCALENDAR');

    const icsContentStr = icsContent.join('\r\n');
    const filename = `Schedule_${formatLocalDate(new Date())}.ics`;

    const summaryToast = language === 'ar'
      ? `تم تصدير ${tutoringLessonsCount} درس خصوصي و ${weeklySchoolClassesCount} حصة مدرسية أسبوعية إلى ملف التقويم`
      : `Exported ${tutoringLessonsCount} lessons & ${weeklySchoolClassesCount} weekly school classes to calendar`;
    setExportToastMessage(summaryToast);
    setTimeout(() => setExportToastMessage(null), 4000);

    if (Capacitor.isNativePlatform()) {
      try {
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: icsContentStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: 'Schedule Export',
          text: `Glück Schedule Export - ${filename}`,
          url: savedFile.uri,
          dialogTitle: 'Save Schedule Calendar File'
        });
        return;
      } catch (err) {
        console.warn('Capacitor schedule save/share failed, fallback to web:', err);
      }
    }

    const blob = new Blob([icsContentStr], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4  font-sans">
      {/* TOP HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base sm:text-lg font-black text-text-main flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span>{t('schedule_title')}</span>
          </h2>
          <p className="text-[11px] font-semibold text-text-muted">
            {t('schedule_working_hours')}: {workingStart} - {workingEnd}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
          {/* Refresh Calendar Data */}
          <button
            onClick={handleRefreshCalendar}
            title={t('schedule_refresh')}
            className="bg-background hover:bg-surface-hover dark:hover:bg-slate-700/80 text-text-main border border-surface-border dark:border-surface-border-soft font-bold text-xs px-2 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('schedule_refresh')}</span>
          </button>

          {/* Export iCal */}
          <button
            onClick={handleExportICS}
            title={t('schedule_ical')}
            className="bg-background hover:bg-surface-hover dark:hover:bg-slate-700/80 text-text-main border border-surface-border dark:border-surface-border-soft font-bold text-xs px-2 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('schedule_ical')}</span>
          </button>

          {/* Export Monthly Calendar (.ics) */}
          <button
            onClick={() => setIsExportMonthlyModalOpen(true)}
            title="Export Monthly Calendar (.ics)"
            className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Export Monthly (.ics)</span>
          </button>

          {/* Quick Lesson */}
          <button
            type="button"
            onClick={() => setIsAddQuickLessonModalOpen(true)}
            className="bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border dark:border-primary-border hover:bg-primary-soft/80 active:scale-95 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5 fill-primary text-primary" />
            <span>{t('nav_quickLesson')}</span>
          </button>

          {/* START LESSON NOW */}
          <button
            onClick={() => setShowStartLessonNowModal(true)}
            className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-primary/30 shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-white text-white" />
            <span>{t('schedule_start_now')}</span>
          </button>
        </div>
      </div>

      {/* REFRESH TOAST BANNER */}
      {showRefreshToast && (
        <div className="bg-primary text-white text-xs font-bold p-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md animate-scale-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>✓ {t('dataRefreshed')}</span>
        </div>
      )}

      {/* EXPORT TOAST BANNER */}
      {exportToastMessage && (
        <div className="bg-emerald-600 text-white text-xs font-bold p-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md animate-scale-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>{exportToastMessage}</span>
        </div>
      )}

      {/* CONFLICT ALERT BANNER */}
      {dayConflicts.length > 0 && calendarView === 'day' && (
        <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg p-2.5 flex items-center justify-between gap-2 animate-pulse">
          <div className="flex items-center gap-2 text-primary dark:text-primary text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-primary dark:text-primary" />
            <span>
              {t('schedule_conflict_alert')}: {selectedDate}
            </span>
          </div>
        </div>
      )}

      {/* VIEW SWITCHER TABS & DATE NAVIGATION BANNER */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-lg p-2.5 shadow-2xs space-y-2">
        
        {/* Row 1: View Switcher Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-surface-border pb-2">
          <div className="flex items-center bg-surface-hover p-0.5 rounded-lg text-xs font-bold gap-0.5">
            <button
              onClick={() => setCalendarView('day')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                calendarView === 'day' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted hover:text-slate-900'
              }`}
            >
              {t('schedule_day_view')}
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                calendarView === 'week' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted hover:text-slate-900'
              }`}
            >
              {t('schedule_week_view')}
            </button>
            <button
              onClick={() => setCalendarView('month')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                calendarView === 'month' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted hover:text-slate-900'
              }`}
            >
              {t('schedule_month_view')}
            </button>
          </div>

          <button
            onClick={() => setSelectedDate(todayStr)}
            className="text-xs font-bold text-primary dark:text-primary hover:underline cursor-pointer bg-primary-soft dark:bg-primary-soft/80 px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border"
          >
            {t('schedule_today')}
          </button>
        </div>

        {/* Row 2: Date Selector Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const current = parseLocalDate(selectedDate);
              if (calendarView === 'day') current.setDate(current.getDate() - 1);
              else if (calendarView === 'week') current.setDate(current.getDate() - 7);
              else current.setMonth(current.getMonth() - 1);
              setSelectedDate(formatLocalDate(current));
            }}
            className="p-1.5 hover:bg-surface-hover rounded-lg cursor-pointer transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-text-muted" />
          </button>

          <div className="text-center">
            {calendarView === 'day' && (
              <>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs sm:text-sm font-extrabold text-text-main bg-transparent border-none focus:outline-none cursor-pointer font-mono text-center"
                />
                <span className="block text-[10px] text-primary dark:text-primary font-extrabold uppercase">
                  {selectedDate === todayStr ? t('schedule_today') : parseLocalDate(selectedDate).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' })}
                </span>
              </>
            )}

            {calendarView === 'week' && (
              <span className="text-xs font-extrabold text-text-main font-mono">
                {weekDays[0].dateStr.substring(5)} — {weekDays[6].dateStr.substring(5)}
              </span>
            )}

            {calendarView === 'month' && (
              <span className="text-xs sm:text-sm font-extrabold text-text-main">
                {monthData.monthName}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              const current = parseLocalDate(selectedDate);
              if (calendarView === 'day') current.setDate(current.getDate() + 1);
              else if (calendarView === 'week') current.setDate(current.getDate() + 7);
              else current.setMonth(current.getMonth() + 1);
              setSelectedDate(formatLocalDate(current));
            }}
            className="p-1.5 hover:bg-surface-hover rounded-lg cursor-pointer transition-all"
          >
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      {/* 1. DAY VIEW */}
      {calendarView === 'day' && (
        <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-lg p-3 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 dark:border-surface-border pb-1.5">
            <span className="text-slate-500 uppercase text-[11px]">({dayLessons.length}) {t('schedule_title')}</span>
            {dayConflicts.length === 0 ? (
              <span className="text-primary dark:text-primary flex items-center gap-1 text-[10px]">
                <CheckCircle2 className="w-3 h-3" /> {t('schedule_no_conflicts')}
              </span>
            ) : (
              <span className="text-primary dark:text-primary flex items-center gap-1 text-[10px] font-bold">
                <AlertTriangle className="w-3 h-3" /> {t('schedule_conflict')}
              </span>
            )}
          </div>

          {/* School Presence Block in Day View */}
          {(() => {
            const currentDayNum = parseLocalDate(selectedDate).getDay();
            const schoolSettings = getSchoolSettings(profile);
            const dayKey = String(currentDayNum);
            const presence = schoolSettings.presence[dayKey];
            
            if (!presence || !presence.active) return null;
            
            const periods = calculatePeriodsTimings(schoolSettings.periodSettings);
            const schedule = schoolSettings.schedule[dayKey] || [];
            const scheduledPeriods = periods
              .map(p => {
                const rec = schedule.find(s => s.periodNumber === p.periodNumber);
                const hasContent = Boolean(rec && (rec.subjectName || rec.className));
                return { period: p, record: rec, hasContent };
              })
              .filter(item => item.hasContent);

            return (
              <div className="p-4 rounded-xl bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/40 dark:border-indigo-900/20 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-850 dark:text-white">
                        {_t('فترة التواجد بالمدرسة', 'School Presence Block', 'Schulpräsenzzeit')}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {presence.arrivalTime} ← {presence.departureTime}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-md">
                    {_t('يوم عمل مدرسة', 'School Day', 'Schultag')}
                  </span>
                </div>

                {scheduledPeriods.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-indigo-100/20 dark:border-indigo-900/20">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      {_t('الحصص والنشاط المدرسي اليوم', 'Periods & School Activities Today', 'Tägliche Schulstunden')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {scheduledPeriods.map(({ period: p, record: rec }) => (
                        <div 
                          key={p.periodNumber}
                          className="p-2 rounded-lg border flex items-center justify-between gap-2 text-[11px] bg-primary-soft/30 dark:bg-primary-soft/15 border-primary-border/40"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 h-4 rounded bg-primary-soft text-primary flex items-center justify-center font-black text-[9px]">
                              {p.periodNumber}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-700 dark:text-slate-300 font-mono tracking-wider">
                                {p.startTime}-{p.endTime}
                              </div>
                              <div className="font-semibold text-slate-500 dark:text-slate-400 truncate text-[10px]">
                                {rec?.className ? (
                                  <span>
                                    <strong className="font-black text-slate-850 dark:text-white text-[11px]">{rec.className}</strong>
                                    {rec.subjectName && (
                                      <span className="text-[9px] font-bold text-primary ms-1 uppercase">
                                        ({rec.subjectName})
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  rec?.subjectName
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {dayLessons.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs font-bold text-text-muted">{t('schedule_no_lessons_day')}</p>
              <button
                onClick={() => setIsAddLessonModalOpen(true)}
                className="text-xs font-bold text-primary dark:text-primary hover:underline cursor-pointer"
              >
                + {t('schedule_add_lesson_for')}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dayLessons.map((lesson) => {
                const isCompleted = lesson.status === 'completed';
                const isCancelled = lesson.status === 'cancelled';
                const conflict = hasConflict(lesson.id);

                return (
                  <div
                    key={lesson.id}
                    className="flex items-start gap-2 sm:gap-3 relative group"
                  >
                    {/* Time Column on Timeline */}
                    <div className={`w-11 sm:w-12 text-end text-xs font-bold font-mono shrink-0 pt-2 ${
                      isCompleted ? 'text-text-muted/70 dark:text-slate-500 line-through' : 'text-text-main'
                    }`}>
                      {lesson.time}
                    </div>

                    {/* Timeline Rail: Dot + Connecting Line */}
                    <div className="flex flex-col items-center shrink-0 self-stretch relative">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 mt-2 transition-all ${
                        conflict
                          ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-400/40 animate-bounce'
                          : isCompleted
                          ? 'border-slate-400 bg-slate-200 ring-2 ring-slate-200 dark:ring-slate-800'
                          : isCancelled
                          ? 'border-rose-400 bg-rose-100 ring-2 ring-rose-300'
                          : 'border-primary bg-primary/20 ring-2 ring-primary/20'
                      }`} />
                      <div className="w-0.5 bg-slate-200/80 dark:bg-slate-800 flex-1 -mt-0.5 min-h-[46px] group-last:hidden" />
                    </div>

                    {/* Compact Session Card (72-80px Height) */}
                    <div className={`flex-1 min-w-0 border rounded-xl p-3 sm:p-3.5 transition-all shadow-2xs ${
                      conflict
                        ? 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10'
                        : isCompleted
                        ? 'bg-slate-100/70 dark:bg-slate-800/30 border-surface-border/80 opacity-80'
                        : isCancelled
                        ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 opacity-75'
                        : 'bg-surface hover:bg-surface-hover/60 border-surface-border/90 dark:border-surface-border hover:border-primary/40'
                    }`}>
                      <div className="space-y-1">
                        {/* Row 1: Student/Group Name + Badge + Actions */}
                        <div className="flex items-center justify-between gap-2">
                          <div
                            onClick={() => openLessonControl(lesson)}
                            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                          >
                            <h4 className={`text-sm sm:text-[15px] font-bold truncate transition-colors ${
                              isCompleted
                                ? 'line-through text-text-muted/70 dark:text-slate-500'
                                : isCancelled
                                ? 'line-through text-rose-500'
                                : 'text-text-main group-hover:text-primary'
                            }`}>
                              {lesson.studentName || lesson.groupName || lesson.title}
                            </h4>

                            {/* Location Badge */}
                            {lesson.type === 'online' ? (
                              <span className="text-[10px] sm:text-[11px] font-medium text-primary bg-primary-soft dark:bg-primary-soft/80 border border-primary-border/60 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <Video className="w-3 h-3" />
                                <span>{t('next_action_online')}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] sm:text-[11px] font-medium text-primary bg-primary-soft dark:bg-primary-soft/80 border border-primary-border/60 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <MapPin className="w-3 h-3" />
                                <span>{t('next_action_offline')}</span>
                              </span>
                            )}

                            {isCompleted && (
                              <span className="text-[9px] font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5 text-slate-500" />
                                {t('status_completed')}
                              </span>
                            )}

                            {isCancelled && (
                              <span className="text-[9px] font-bold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-md shrink-0">
                                {t('status_cancelled')}
                              </span>
                            )}

                            {conflict && (
                              <span className="text-[9px] font-bold uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded-md shrink-0">
                                {t('schedule_conflict')}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons (Quiet Calm Colors) */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setReminderLesson(lesson)}
                              title="إرسال تذكير الحصة"
                              className="p-1.5 text-emerald-600/80 hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-all cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openReschedule(lesson)}
                              title="إعادة جدولة الحصة"
                              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteLesson(lesson.id)}
                              title="حذف الحصة"
                              className="p-1.5 text-rose-400 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Subject / Lesson Topic */}
                        <div
                          onClick={() => openLessonControl(lesson)}
                          className="cursor-pointer text-xs text-text-muted dark:text-slate-400 font-normal leading-tight"
                        >
                          {lesson.notes || (lesson.groupName && lesson.groupName !== lesson.title ? lesson.groupName : null) || _t('حصة تعليمية', 'Lesson', 'Lektion')}
                        </div>

                        {/* Row 3: Metadata in One Neat Horizontal Row */}
                        <div
                          onClick={() => openLessonControl(lesson)}
                          className="flex items-center gap-2 text-xs text-text-muted font-medium cursor-pointer whitespace-nowrap overflow-x-auto no-scrollbar pt-0.5"
                        >
                          <span>{lesson.grade}</span>
                          <span className="text-text-muted/40 text-[10px]">•</span>
                          <span className="font-semibold text-primary">
                            Session {lesson.sessionNumber}/{lesson.totalSessionsInPackage}
                          </span>
                          <span className="text-text-muted/40 text-[10px]">•</span>
                          <span className="font-semibold text-primary">
                            {t('schedule_weekly')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Lesson Button at Bottom of Day List */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsAddLessonModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover hover:bg-primary-soft/60 px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('schedule_add_lesson_for')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. WEEK VIEW */}
      {calendarView === 'week' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
            {weekDays.map((day) => (
              <div
                key={day.dateStr}
                className={`bg-surface border rounded-lg p-3 shadow-2xs space-y-2 transition-all ${
                  day.isToday
                    ? 'border-primary dark:border-primary ring-2 ring-primary dark:ring-primary'
                    : 'border-surface-border/90 dark:border-surface-border'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-border pb-1.5">
                  <div>
                    <span className="text-[11px] font-black text-text-muted uppercase block">
                      {day.dayName}
                    </span>
                    <span className={`text-sm font-black font-mono ${day.isToday ? 'text-primary dark:text-primary' : 'text-text-main'}`}>
                      {day.dayNumber}. {day.monthName}
                    </span>
                  </div>

                  <span className="text-[10px] font-extrabold bg-surface-hover text-text-main px-2 py-0.5 rounded-full">
                    {day.lessons.length}
                  </span>
                </div>

                {/* School Presence Block inside weekly cell */}
                {(() => {
                  const dayNum = parseLocalDate(day.dateStr).getDay();
                  const schoolSettings = getSchoolSettings(profile);
                  const dayKey = String(dayNum);
                  const presence = schoolSettings.presence[dayKey];
                  if (!presence || !presence.active) return null;
                  
                  const schedule = schoolSettings.schedule[dayKey] || [];
                  const activePeriodsCount = schedule.filter(s => s.subjectName || s.className).length;

                  return (
                    <div className="p-1.5 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/20 dark:border-indigo-900/10 text-[10px] space-y-1">
                      <div className="flex items-center justify-between font-black text-indigo-600 dark:text-indigo-400">
                        <span className="flex items-center gap-1 font-bold">
                          <BookOpen className="w-3 h-3 shrink-0" />
                          <span>{_t('مدرسة', 'School', 'Schule')}</span>
                        </span>
                        <span className="text-[9px] font-mono shrink-0">{presence.arrivalTime}-{presence.departureTime}</span>
                      </div>
                      {activePeriodsCount > 0 && (
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                          🏫 {activePeriodsCount} {_t('حصص', 'periods', 'Stunden')}
                        </div>
                      )}
                    </div>
                  );
                })() || null}

                <div className="space-y-1.5 min-h-[90px]">
                  {day.lessons.length === 0 ? (
                    <p className="text-[10px] text-text-muted/70 dark:text-slate-500 text-center py-4 font-semibold">
                      {t('schedule_no_lessons')}
                    </p>
                  ) : (
                    day.lessons.map((l) => {
                      const conflict = hasConflict(l.id);
                      return (
                        <div
                          key={l.id}
                          onClick={() => openLessonControl(l)}
                          className={`p-2 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.02] ${
                            conflict
                              ? 'bg-primary-soft border-primary-border text-primary dark:bg-primary-soft dark:border-primary-border dark:text-primary'
                              : l.type === 'online'
                              ? 'bg-primary-soft border-primary-border text-primary-hover dark:bg-primary-soft/50 dark:border-primary-border dark:text-primary/70'
                              : 'bg-primary-soft border-primary-border text-primary dark:bg-primary-soft dark:border-primary-border dark:text-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono font-bold text-[10px]">
                            <span>{l.time}</span>
                            <span className="uppercase text-[9px] font-black">{l.type}</span>
                          </div>
                          <p className="font-bold text-[11px] truncate mt-0.5">{l.title}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedDate(day.dateStr);
                    setIsAddLessonModalOpen(true);
                  }}
                  className="w-full text-[10px] font-bold text-slate-500 hover:text-primary dark:hover:text-primary bg-surface-hover/60 hover:bg-primary-soft p-1.5 rounded-xl border border-dashed border-surface-border dark:border-surface-border-soft transition-all cursor-pointer text-center"
                >
                  + {t('add')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. MONTH VIEW */}
      {calendarView === 'month' && (
        <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-lg p-4 shadow-2xs space-y-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-text-muted/70 uppercase tracking-wider border-b border-slate-100 dark:border-surface-border pb-2">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthData.gridDays.map((cell, index) => {
              if (!cell) {
                return <div key={`empty_${index}`} className="min-h-[64px] bg-background/40 dark:bg-surface/40 rounded-xl" />;
              }

              const isSelected = cell.dateStr === selectedDate;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    setSelectedDate(cell.dateStr);
                    setCalendarView('day');
                  }}
                  className={`min-h-[64px] p-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 active:bg-surface-hover flex flex-col justify-between ${
                    cell.isToday
                      ? 'bg-primary-soft dark:bg-primary-soft/40 border-primary font-bold'
                      : isSelected
                      ? 'bg-primary-soft dark:bg-primary-soft border-primary-border'
                      : 'bg-background/50 dark:bg-slate-800/40 border-surface-border/60 dark:border-surface-border hover:border-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono font-bold ${cell.isToday ? 'text-primary dark:text-primary font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                      {cell.dayNumber}
                    </span>

                    {cell.lessons.length > 0 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                        cell.hasConflict ? 'bg-primary text-white' : 'bg-primary text-white'
                      }`}>
                        {cell.lessons.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {cell.lessons.slice(0, 3).map((l) => (
                      <span
                        key={l.id}
                        className={`w-2 h-2 rounded-full ${
                          l.type === 'online' ? 'bg-primary' : 'bg-primary'
                        }`}
                        title={`${l.time} - ${l.title}`}
                      />
                    ))}
                    {cell.lessons.length > 3 && (
                      <span className="text-[8px] font-bold text-text-muted/70">+{cell.lessons.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleLesson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
          <div className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 p-5 max-w-sm w-full shadow-2xl space-y-4 font-sans">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-border pb-3">
              <h3 className="text-sm font-black text-text-main flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
                <span>{t('schedule_reschedule')}</span>
              </h3>
              <button
                onClick={() => setRescheduleLesson(null)}
                className="p-1 hover:bg-surface-hover rounded-lg text-text-muted/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-surface-hover/60 p-3 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 space-y-1">
              <span className="text-[10px] font-bold text-text-muted/70 uppercase">{rescheduleLesson.title}</span>
              <p className="text-[11px] text-slate-500">{rescheduleLesson.date} • {rescheduleLesson.time}</p>
            </div>

            {rescheduleSuccess && (
              <div className="bg-primary-soft text-primary text-xs font-bold p-3 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>{rescheduleSuccess}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-text-main block mb-1">
                  {t('schedule_new_date')}
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-surface-hover text-text-main text-xs font-mono font-bold p-2.5 rounded-xl border border-surface-border dark:border-surface-border-soft focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-main block mb-1">
                  {t('schedule_new_time')}
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-surface-hover text-text-main text-xs font-mono font-bold p-2.5 rounded-xl border border-surface-border dark:border-surface-border-soft focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {checkTimeConflict(newDate, newTime, rescheduleLesson?.id) && (
                <div className="bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary text-[11px] font-bold p-2.5 rounded-xl border border-primary-border dark:border-primary-border flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{t('schedule_conflict_alert')}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRescheduleLesson(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-surface-hover rounded-xl cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSaveReschedule}
                disabled={checkTimeConflict(newDate, newTime, rescheduleLesson?.id)}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-xs ${checkTimeConflict(newDate, newTime, rescheduleLesson?.id) ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover cursor-pointer'}`}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* START LESSON NOW MODAL */}
      {showStartLessonNowModal && (
        <StartLessonNowModal onClose={() => setShowStartLessonNowModal(false)} />
      )}

      {/* LESSON REMINDER MODAL */}
      {reminderLesson && (
        <LessonReminderModal
          lesson={reminderLesson}
          onClose={() => setReminderLesson(null)}
        />
      )}

      {/* EXPORT MONTHLY CALENDAR MODAL */}
      {isExportMonthlyModalOpen && (
        <ExportMonthlyCalendarModal onClose={() => setIsExportMonthlyModalOpen(false)} />
      )}
    </div>
  );
};
