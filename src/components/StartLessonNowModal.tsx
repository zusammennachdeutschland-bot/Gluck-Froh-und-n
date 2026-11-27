import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Group, Student, LessonType, AttendanceStatus, HomeworkStatus, PaymentStatus } from '../types';
import { getDayNumber } from '../utils/scheduleUtils';
import { formatLocalDate } from '../utils/timeUtils';
import { areDuplicateLessons, getGroupCycleInfo } from '../utils/lessonUtils';
import { 
  X, Play, Users, User, Clock, Calendar as CalendarIcon, Video, MapPin, 
  CheckCircle2, Sparkles, BookOpen, Award, FileText, Zap, ChevronRight, ArrowLeft
} from 'lucide-react';
import { resolveActiveMeetingLinkForLesson } from '../services/zoomSessionStandardizer';

interface StartLessonNowModalProps {
  onClose: () => void;
}

export const StartLessonNowModal: React.FC<StartLessonNowModalProps> = ({ onClose }) => {
  const { groups, students, profile, lessons, getFullLessonsSnapshot, groupWeeklySessions, addLesson, updateLesson, openLessonControl, saveLessonReport, startActiveLessonTimer, t, language, _t } = useApp();

  const now = new Date();
  const todayStr = formatLocalDate(now);
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const activeGroups = groups.filter(g => g.status !== 'archived');
  const activeStudents = students.filter(s => s.status !== 'archived');

  const [selectedGroupId, setSelectedGroupId] = useState<string>(activeGroups[0]?.id || '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(''); // For 1-on-1 individual
  const [targetType, setTargetType] = useState<'group' | 'student'>('group');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');

  const GERMAN_WEEKDAYS = [
    { short: 'Mo', full: 'Montag', dayNum: 1 },
    { short: 'Di', full: 'Dienstag', dayNum: 2 },
    { short: 'Mi', full: 'Mittwoch', dayNum: 3 },
    { short: 'Do', full: 'Donnerstag', dayNum: 4 },
    { short: 'Fr', full: 'Freitag', dayNum: 5 },
    { short: 'Sa', full: 'Samstag', dayNum: 6 },
    { short: 'So', full: 'Sonntag', dayNum: 0 },
  ];

  const matchGroupDay = (group: Group, dayFilter: string): boolean => {
    if (!dayFilter || dayFilter === 'all') return true;
    if (!group.scheduleDays || group.scheduleDays.length === 0) return false;

    const targetDayNum = dayFilter === 'today' ? new Date().getDay() : getDayNumber(dayFilter);
    if (targetDayNum === -1) return true;

    return group.scheduleDays.some(d => getDayNumber(d) === targetDayNum);
  };

  const filteredGroups = activeGroups.filter(g => matchGroupDay(g, selectedDayFilter));

  const [lessonDate, setLessonDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>(currentTimeStr);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [lessonType, setLessonType] = useState<LessonType>('online');

  // Mode: Start Live Stopwatch vs Record Completed Lesson directly
  const [mode, setMode] = useState<'start_live' | 'record_completed'>('start_live');

  // Completion Form State (if recording directly)
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [homeworkStatus, setHomeworkStatus] = useState<HomeworkStatus>('assigned');
  const [homeworkTitle, setHomeworkTitle] = useState('Übungen & Hausaufgabe');
  const [homeworkDescription, setHomeworkDescription] = useState('Grammatik und Wortschatz wiederholen');
  const [quizScore, setQuizScore] = useState<number>(85);
  const [examScore, setExamScore] = useState<number>(90);
  const [teacherNotes, setTeacherNotes] = useState('Spontane Lektion erfolgreich gestartet und durchgeführt.');

  const selectedGroup = activeGroups.find(g => g.id === selectedGroupId);
  const selectedStudent = activeStudents.find(s => s.id === selectedStudentId);

  const groupStudents = selectedGroupId 
    ? activeStudents.filter(s => s.groupId === selectedGroupId)
    : [];

  // Initialize attendance map when group changes
  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedStudentId('');
    const groupSts = activeStudents.filter(s => s.groupId === groupId);
    const initialAtt: Record<string, AttendanceStatus> = {};
    groupSts.forEach(s => {
      initialAtt[s.id] = 'present';
    });
    setStudentAttendance(initialAtt);

    const targetG = activeGroups.find(g => g.id === groupId);
    if (targetG) {
      setLessonType(targetG.type || 'online');
    }
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSelectedGroupId('');
    const st = activeStudents.find(s => s.id === studentId);
    if (st) {
      setStudentAttendance({ [st.id]: 'present' });
    }
  };

  const handleStartLesson = (e: React.FormEvent) => {
    e.preventDefault();

    let targetTitle = '';
    let targetGroupId = '';
    let targetGroupName = '';
    let targetStudentId = '';
    let targetStudentName = '';
    let amountDue = 200;
    let grade = selectedGroup?.grade || selectedStudent?.grade || 'Grade 10';

    if (targetType === 'group') {
      if (!selectedGroup) return;
      targetTitle = selectedGroup.name;
      targetGroupId = selectedGroup.id;
      targetGroupName = selectedGroup.name;
      amountDue = selectedGroup.monthlyPackagePrice || selectedGroup.pricePerSession || 200;
    } else {
      if (!selectedStudent) return;
      targetTitle = `Einzelunterricht - ${selectedStudent.name}`;
      targetStudentId = selectedStudent.id;
      targetStudentName = selectedStudent.name;
      targetGroupId = selectedStudent.groupId;
      const grp = activeGroups.find(g => g.id === selectedStudent.groupId);
      targetGroupName = grp?.name || 'Einzelunterricht';
      amountDue = grp?.pricePerSession || grp?.monthlyPackagePrice || 200;
    }

    // 1. Check if a lesson already exists on this date & time for the same group/student
    const candidateProbe = {
      id: 'candidate_check',
      groupId: targetGroupId,
      studentId: targetStudentId || undefined,
      studentName: targetStudentName || undefined,
      title: targetTitle,
      date: lessonDate,
      time: startTime,
      durationMinutes: Number(durationMinutes)
    };

    const existingLesson = lessons.find(l => !l.deleted && l.status !== 'cancelled' && areDuplicateLessons(l, candidateProbe, students));

    if (existingLesson) {
      if (mode === 'start_live') {
        /* confetti removed */
        updateLesson(existingLesson.id, { status: 'in_progress' });
        startActiveLessonTimer(existingLesson);
        openLessonControl(existingLesson);
        onClose();
        return;
      } else {
        // Save report to the existing lesson instead of creating duplicate
        saveLessonReport(existingLesson.id, {
          attendanceStatus: 'present',
          studentAttendance,
          homeworkStatus,
          homeworkTitle,
          homeworkDescription,
          quizScore,
          examScore,
          participationScore: 95,
          paymentStatus: 'pending',
          amountPaid: 0,
          teacherNotes,
          savedAt: new Date().toISOString()
        });
        updateLesson(existingLesson.id, { status: 'completed' });
        /* confetti removed */
        onClose();
        return;
      }
    }

    // 2. No duplicate exists, create new Lesson object in context with a collision-proof ID
    const randomSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 8);
    const newLessonId = `l_spont_${Date.now()}_${randomSuffix}`;
    const selectedGroupCycle = selectedGroup ? getGroupCycleInfo(selectedGroup, getFullLessonsSnapshot(), language) : null;

    const newLessonData = {
      id: newLessonId,
      groupId: targetGroupId,
      groupName: targetGroupName,
      studentId: targetStudentId || undefined,
      studentName: targetStudentName || undefined,
      title: targetTitle,
      date: lessonDate,
      time: startTime,
      durationMinutes: Number(durationMinutes),
      type: lessonType,
      grade,
      sessionNumber: selectedGroupCycle ? selectedGroupCycle.currentSessionNumber : 1,
      totalSessionsInPackage: selectedGroupCycle ? selectedGroupCycle.sessionCount : (selectedGroup?.sessionCount || 4),
      status: (mode === 'start_live' ? 'in_progress' : 'completed') as any,
      paymentStatus: 'unpaid' as PaymentStatus,
      amountDue,
      amountPaid: 0,
      meetingLink: lessonType === 'online'
        ? resolveActiveMeetingLinkForLesson({
            group: selectedGroup,
            lesson: { groupId: targetGroupId, date: lessonDate, time: startTime },
            groupWeeklySessions,
            defaultZoomLink: profile.defaultZoomLink
          })
        : undefined,
      locationAddress: lessonType === 'offline' ? (selectedGroup?.address || '') : undefined
    };

    // Add directly using custom context dispatch via addLesson logic or custom trigger
    const addedLessons = addLesson(newLessonData, 1);
    const addedLesson = addedLessons[0] || newLessonData;

    if (mode === 'start_live') {
      // Launch live timer & control modal immediately
      /* confetti removed */
      startActiveLessonTimer(addedLesson);
      openLessonControl(addedLesson);
      onClose();
    } else {
      // Save completed report immediately
      saveLessonReport(addedLesson.id, {
        attendanceStatus: 'present',
        studentAttendance,
        homeworkStatus,
        homeworkTitle,
        homeworkDescription,
        quizScore,
        examScore,
        participationScore: 95,
        paymentStatus: 'pending',
        amountPaid: 0,
        teacherNotes,
        savedAt: new Date().toISOString()
      });

      /* confetti removed */
      onClose();
    }
  };

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm: pt-[max(24px,env(safe-area-inset-top,24px))] overflow-y-auto p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up space-y-0"
      >
        <div className="w-10 h-1 bg-surface-border rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-surface border-b border-surface-border px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between text-text-main shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-soft text-primary rounded-xl border border-primary-border/60 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-main">{t('sofort_title')}</h2>
              <span className="text-[11px] font-semibold text-primary">
                · {t('sofort_badge')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleStartLesson} className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Target Selector: Group vs Student */}
          <div className="grid grid-cols-2 gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setTargetType('group');
                if (filteredGroups[0]) handleSelectGroup(filteredGroups[0].id);
                else if (activeGroups[0]) handleSelectGroup(activeGroups[0].id);
              }}
              className={`min-h-[38px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                targetType === 'group' 
                  ? 'bg-surface border-surface-border text-primary shadow-2xs' 
                  : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t('students_group')} ({activeGroups.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType('student');
                if (activeStudents[0]) handleSelectStudent(activeStudents[0].id);
              }}
              className={`min-h-[38px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                targetType === 'student' 
                  ? 'bg-surface border-surface-border text-primary shadow-2xs' 
                  : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface/50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{t('students_individual')} ({activeStudents.length})</span>
            </button>
          </div>

          {/* List of Groups / Students */}
          {targetType === 'group' ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold text-text-main">
                  {_t('اختر المجموعة:', 'Select Group:', 'Gruppe auswählen:')}
                </label>
                <span className="text-[11px] text-primary font-bold tabular-nums">
                  {filteredGroups.length} {_t(`من ${activeGroups.length} مجموعة`, `of ${activeGroups.length} groups`, `von ${activeGroups.length} Gruppen`)}
                </span>
              </div>

              {/* DAILY FILTER FOR GROUPS IN MODAL */}
              <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border overflow-x-auto no-scrollbar text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('all')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer shrink-0 border ${
                    selectedDayFilter === 'all'
                      ? 'bg-surface border-surface-border text-primary shadow-2xs'
                      : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface/50'
                  }`}
                >
                  {_t('كل الأيام', 'All Days', 'Alle Tage')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('today')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer shrink-0 flex items-center gap-1 border ${
                    selectedDayFilter === 'today'
                      ? 'bg-surface border-surface-border text-primary shadow-2xs'
                      : 'border-transparent text-primary/90 hover:bg-surface/50'
                  }`}
                >
                  <span>{_t('اليوم', 'Today', 'Heute')}</span>
                  <span className="text-[10px] font-mono opacity-80">({GERMAN_WEEKDAYS.find(w => w.dayNum === new Date().getDay())?.short})</span>
                </button>
                {GERMAN_WEEKDAYS.map(w => (
                  <button
                    key={w.short}
                    type="button"
                    onClick={() => setSelectedDayFilter(w.short)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer shrink-0 border ${
                      selectedDayFilter === w.short || selectedDayFilter === w.full
                        ? 'bg-surface border-surface-border text-primary shadow-2xs'
                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface/50'
                    }`}
                  >
                    {w.short}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {filteredGroups.length === 0 ? (
                  <div className="col-span-2 p-4 text-center text-xs text-text-muted bg-surface-hover/50 rounded-xl border border-surface-border">
                    {_t('لا توجد مجموعات لهذا اليوم المحدد.', 'No groups found for the selected day.', 'Keine Gruppen für den ausgewählten Tag gefunden.')}
                  </div>
                ) : (
                  filteredGroups.map((g) => {
                    const isSelected = selectedGroupId === g.id;
                    const groupStsCount = activeStudents.filter(s => s.groupId === g.id).length;
                    const cycleInfo = getGroupCycleInfo(g, getFullLessonsSnapshot(), language);

                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleSelectGroup(g.id)}
                        className={`p-3 rounded-xl border text-start transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected 
                            ? 'bg-primary-soft border-primary-border shadow-2xs' 
                            : 'bg-surface-hover/60 border-surface-border hover:border-primary/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-text-main block truncate">
                            {g.name}
                          </span>
                          <span className="text-[11px] text-text-muted font-medium block mt-0.5 truncate">
                            {g.grade} · {groupStsCount} {language === 'ar' ? 'طلاب' : language === 'de' ? 'Schüler' : 'Students'}
                            {!cycleInfo.isPerLesson ? ` · ${cycleInfo.label}` : ` · ${_t('محاسبة بالحصة', 'Per Session', 'Pro Sitzung')}`}
                          </span>
                        </div>

                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-main">
                Wählen Sie den Schüler für Einzelunterricht:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {activeStudents.map((s) => {
                  const isSelected = selectedStudentId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStudent(s.id)}
                      className={`p-3 rounded-xl border text-start transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected 
                          ? 'bg-primary-soft border-primary-border shadow-2xs' 
                          : 'bg-surface-hover/60 border-surface-border hover:border-primary/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-text-main block truncate">
                          {s.name}
                        </span>
                        <span className="text-[11px] text-text-muted font-medium block">
                          {s.grade}
                        </span>
                      </div>

                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time & Configuration Card */}
          <div className="bg-surface-hover/40 p-3.5 rounded-xl border border-surface-border space-y-2.5">
            <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Lektions-Einstellungen</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">Datum</label>
                <input
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  className="w-full min-h-[38px] p-2 bg-surface border border-surface-border rounded-xl font-semibold text-text-main"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">Startzeit</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full min-h-[38px] p-2 bg-surface border border-surface-border rounded-xl font-semibold text-text-main"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">Dauer (Min)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full min-h-[38px] p-2 bg-surface border border-surface-border rounded-xl font-semibold text-text-main"
                >
                  <option value={30}>30 Min</option>
                  <option value={45}>45 Min</option>
                  <option value={60}>60 Min (1 Std)</option>
                  <option value={90}>90 Min (1.5 Std)</option>
                  <option value={120}>120 Min (2 Std)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">Typ</label>
                <select
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value as LessonType)}
                  className="w-full min-h-[38px] p-2 bg-surface border border-surface-border rounded-xl font-semibold text-text-main"
                >
                  <option value="online">Online (Zoom/Meet)</option>
                  <option value="offline">Präsenz (Offline)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mode Selector: Live Timer vs Record Directly */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-main">
              Aktion ausführen:
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('start_live')}
                className={`p-3 rounded-xl border text-start transition-colors cursor-pointer ${
                  mode === 'start_live'
                    ? 'bg-primary-soft border-primary-border text-text-main shadow-2xs'
                    : 'bg-surface-hover/40 border-surface-border text-text-muted hover:text-text-main'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Play className="w-3.5 h-3.5 text-primary fill-current" />
                  <span>Jetzt Live starten</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1 leading-normal">
                  Öffnet die Live-Stoppuhr und das Lektions-Steuerungscenter.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('record_completed')}
                className={`p-3 rounded-xl border text-start transition-colors cursor-pointer ${
                  mode === 'record_completed'
                    ? 'bg-primary-soft border-primary-border text-text-main shadow-2xs'
                    : 'bg-surface-hover/40 border-surface-border text-text-muted hover:text-text-main'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  <span>Direkt Eintragen</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1 leading-normal">
                  Erfasst die Anwesenheit & Noten direkt in der Historie & Finanzen.
                </p>
              </button>
            </div>
          </div>

          {/* Additional attendance checkboxes if Recording Completed Directly */}
          {mode === 'record_completed' && groupStudents.length > 0 && (
            <div className="bg-surface-hover/40 p-3 rounded-xl border border-surface-border space-y-2">
              <span className="text-xs font-bold text-text-main block">
                Anwesenheit der Schüler markieren:
              </span>

              <div className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface max-h-36 overflow-y-auto">
                {groupStudents.map(st => {
                  const currentAtt = studentAttendance[st.id] || 'present';

                  return (
                    <div key={st.id} className="flex items-center justify-between text-xs px-3 py-2">
                      <span className="font-semibold text-text-main">{st.name}</span>

                      <div className="flex items-center gap-1 bg-surface-hover p-0.5 rounded-lg border border-surface-border">
                        <button
                          type="button"
                          onClick={() => setStudentAttendance(prev => ({ ...prev, [st.id]: 'present' }))}
                          className={`min-h-[28px] px-2.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                            currentAtt === 'present' 
                              ? 'bg-surface text-primary shadow-2xs' 
                              : 'text-text-muted hover:text-text-main'
                          }`}
                        >
                          Anwesend
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudentAttendance(prev => ({ ...prev, [st.id]: 'absent' }))}
                          className={`min-h-[28px] px-2.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                            currentAtt === 'absent' 
                              ? 'bg-surface text-rose-600 dark:text-rose-400 shadow-2xs' 
                              : 'text-text-muted hover:text-text-main'
                          }`}
                        >
                          Abwesend
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            className="w-full min-h-[44px] py-2.5 bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>
              {mode === 'start_live' ? 'Lektion Jetzt Live Starten' : 'Lektion Speichern & in Finanzen/Historie Buchen'}
            </span>
          </button>
        </form>

      </div>
    </div>
  );
};
