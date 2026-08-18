import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Group, Student, LessonType, AttendanceStatus, HomeworkStatus, PaymentStatus } from '../types';
import { getDayNumber } from '../utils/scheduleUtils';
import { formatLocalDate } from '../utils/timeUtils';
import { 
  X, Play, Users, User, Clock, Calendar as CalendarIcon, Video, MapPin, 
  CheckCircle2, Sparkles, BookOpen, Award, FileText, Zap, ChevronRight, ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface StartLessonNowModalProps {
  onClose: () => void;
}

export const StartLessonNowModal: React.FC<StartLessonNowModalProps> = ({ onClose }) => {
  const { groups, students, profile, addLesson, openLessonControl, saveLessonReport, startActiveLessonTimer, t } = useApp();

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

    // 1. Create new Lesson object in context
    const newLessonId = `l_spont_${Date.now()}`;
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
      sessionNumber: 1,
      totalSessionsInPackage: selectedGroup?.sessionCount || 4,
      status: (mode === 'start_live' ? 'in_progress' : 'completed') as any,
      paymentStatus: 'unpaid' as PaymentStatus,
      amountDue,
      amountPaid: 0,
      meetingLink: lessonType === 'online' ? (selectedGroup?.zoomLink || profile.defaultZoomLink) : undefined,
      locationAddress: lessonType === 'offline' ? (selectedGroup?.address || 'Hauptstraße 45, Cairo') : undefined
    };

    // Add directly using custom context dispatch via addLesson logic or custom trigger
    const addedLessons = addLesson(newLessonData, 1);
    const addedLesson = addedLessons[0] || newLessonData;

    if (mode === 'start_live') {
      // Launch live timer & control modal immediately
      confetti({ particleCount: 70, spread: 60 });
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

      confetti({ particleCount: 90, spread: 70 });
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
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up space-y-0"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-surface border-b border-slate-100 dark:border-surface-border p-5 flex items-center justify-between text-text-main shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-lg border border-violet-100 dark:border-violet-900/50">
              <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-text-main">{t('sofort_title')}</h2>
                <span className="text-[9px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/30 border border-violet-100/50 dark:border-violet-900/30 px-2 py-0.5 rounded-md">
                  {t('sofort_badge')}
                </span>
              </div>
              <p className="text-xs text-text-muted">{t('sofort_desc')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted/70 hover:text-slate-600 dark:hover:text-primary hover:bg-background dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleStartLesson} className="p-5 space-y-4">
          {/* Target Selector: Group vs Student */}
          <div className="grid grid-cols-2 gap-1 bg-surface-hover/80 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setTargetType('group');
                if (filteredGroups[0]) handleSelectGroup(filteredGroups[0].id);
                else if (activeGroups[0]) handleSelectGroup(activeGroups[0].id);
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                targetType === 'group' 
                  ? 'bg-surface border-surface-border/40 dark:bg-surface dark:border-surface-border text-violet-600 dark:text-violet-400 shadow-2xs' 
                  : 'border-transparent text-text-muted hover:text-slate-900 dark:hover:text-primary'
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
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                targetType === 'student' 
                  ? 'bg-surface border-surface-border/40 dark:bg-surface dark:border-surface-border text-violet-600 dark:text-violet-400 shadow-2xs' 
                  : 'border-transparent text-text-muted hover:text-slate-900 dark:hover:text-primary'
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
                  Wählen Sie die Gruppe:
                </label>
                <span className="text-[10px] text-violet-600 dark:text-violet-400 font-extrabold">
                  {filteredGroups.length} von {activeGroups.length} Gruppen
                </span>
              </div>

              {/* DAILY FILTER FOR GROUPS IN MODAL */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shrink-0 border ${
                    selectedDayFilter === 'all'
                      ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 shadow-2xs'
                      : 'bg-surface-hover border-surface-border/60 dark:border-surface-border-soft/60 text-text-muted hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  Alle Tage
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('today')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shrink-0 flex items-center gap-1 border ${
                    selectedDayFilter === 'today'
                      ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 shadow-2xs'
                      : 'bg-primary-soft border-primary-border text-primary dark:bg-primary-soft dark:border-primary-border dark:text-primary hover:bg-primary-soft'
                  }`}
                >
                  <span>Heute</span>
                  <span className="text-[9px] font-mono opacity-80">({GERMAN_WEEKDAYS.find(w => w.dayNum === new Date().getDay())?.short})</span>
                </button>
                {GERMAN_WEEKDAYS.map(w => (
                  <button
                    key={w.short}
                    type="button"
                    onClick={() => setSelectedDayFilter(w.short)}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shrink-0 border ${
                      selectedDayFilter === w.short || selectedDayFilter === w.full
                        ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 shadow-2xs'
                        : 'bg-surface-hover border-surface-border/60 dark:border-surface-border-soft/60 text-text-muted hover:bg-slate-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    {w.short}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {filteredGroups.length === 0 ? (
                  <div className="col-span-2 p-4 text-center text-xs text-text-muted/70 bg-surface-hover/50 rounded-lg border border-slate-100 dark:border-surface-border">
                    Keine Gruppen für den ausgewählten Tag gefunden.
                  </div>
                ) : (
                  filteredGroups.map((g) => {
                    const isSelected = selectedGroupId === g.id;
                    const groupStsCount = activeStudents.filter(s => s.groupId === g.id).length;

                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleSelectGroup(g.id)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'bg-violet-50/50 dark:bg-violet-950/40 border-violet-500 shadow-2xs' 
                            : 'bg-surface-hover/60 border-surface-border dark:border-slate-750 hover:border-violet-300'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-black text-text-main block">
                            {g.name}
                          </span>
                          <span className="text-[10px] text-text-muted font-bold block">
                            {g.grade} • {groupStsCount} Schüler
                          </span>
                        </div>

                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
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
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-violet-50/50 dark:bg-violet-950/40 border-violet-500 shadow-2xs' 
                          : 'bg-surface-hover/60 border-surface-border dark:border-slate-750 hover:border-violet-300'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black text-text-main block">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-text-muted font-bold block">
                          {s.grade}
                        </span>
                      </div>

                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time & Configuration Card */}
          <div className="bg-surface-hover/40 p-3.5 rounded-lg border border-surface-border/85 dark:border-surface-border space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Lektions-Einstellungen</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Datum</label>
                <input
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  className="w-full p-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Startzeit</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Dauer (Min)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full p-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-lg font-bold"
                >
                  <option value={30}>30 Min</option>
                  <option value={45}>45 Min</option>
                  <option value={60}>60 Min (1 Std)</option>
                  <option value={90}>90 Min (1.5 Std)</option>
                  <option value={120}>120 Min (2 Std)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Typ</label>
                <select
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value as LessonType)}
                  className="w-full p-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-lg font-bold"
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
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  mode === 'start_live'
                    ? 'bg-violet-50/50 dark:bg-violet-950/40 border-violet-500 text-violet-900 dark:text-violet-200 shadow-2xs'
                    : 'bg-surface-hover/40 border-surface-border dark:border-slate-750 text-text-muted'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <Play className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 fill-current" />
                  <span>Jetzt Live starten</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1 leading-normal">
                  Öffnet die Live-Stoppuhr und das Lektions-Steuerungscenter.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('record_completed')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  mode === 'record_completed'
                    ? 'bg-primary-soft dark:bg-primary-soft border-primary-border text-primary dark:text-primary shadow-2xs'
                    : 'bg-surface-hover/40 border-surface-border dark:border-slate-750 text-text-muted'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary dark:text-primary" />
                  <span>Direkt Eintragen</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1 leading-normal">
                  Erfasst die Anwesenheit & Noten direkt in der Historie & Finanzen.
                </p>
              </button>
            </div>
          </div>

          {/* Additional attendance checkboxes if Recording Completed Directly */}
          {mode === 'record_completed' && groupStudents.length > 0 && (
            <div className="bg-violet-50/30 dark:bg-violet-950/20 p-3 rounded-lg border border-violet-200/65 dark:border-violet-900/45 space-y-2">
              <span className="text-xs font-bold text-violet-900 dark:text-violet-200 block">
                Anwesenheit der Schüler markieren:
              </span>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {groupStudents.map(st => {
                  const currentAtt = studentAttendance[st.id] || 'present';

                  return (
                    <div key={st.id} className="flex items-center justify-between text-xs bg-surface p-2 rounded-lg border border-slate-100 dark:border-surface-border">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{st.name}</span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setStudentAttendance(prev => ({ ...prev, [st.id]: 'present' }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            currentAtt === 'present' 
                              ? 'bg-primary border-primary-border text-white shadow-2xs' 
                              : 'bg-surface-hover border-surface-border/50 dark:border-surface-border-soft text-slate-500'
                          }`}
                        >
                          Anwesend
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudentAttendance(prev => ({ ...prev, [st.id]: 'absent' }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            currentAtt === 'absent' 
                              ? 'bg-primary border-primary-border text-white shadow-2xs' 
                              : 'bg-surface-hover border-surface-border/50 dark:border-surface-border-soft text-slate-500'
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
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-900 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:border-slate-100 dark:text-slate-900 font-black text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
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
