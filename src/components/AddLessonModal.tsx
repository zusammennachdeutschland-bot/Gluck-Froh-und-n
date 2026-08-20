import React, { useState, useEffect } from 'react';
import { getFreePeriodsForDate, getBookableSlots, formatTimeDisplay, formatLocalDate } from '../utils/timeUtils';
import { checkOverlap } from '../utils/lessonUtils';
import { useApp } from '../context/AppContext';
import { storage } from '../services/storageService';
import { PREDEFINED_GRADES } from '../data/initialData';
import { GradeLevel, LessonType } from '../types';
import { X, Calendar, Clock, AlertTriangle, Sparkles, Check, Video, MapPin, Repeat } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AddLessonModalProps {
  onClose: () => void;
}

export const AddLessonModal: React.FC<AddLessonModalProps> = ({ onClose }) => {
  const { groups, students, lessons, profile, addLesson, t } = useApp();

  const todayStr = formatLocalDate();

  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('17:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [type, setType] = useState<LessonType>('online');
  const [grade, setGrade] = useState<GradeLevel>('Grade 9');
  
  // Weekly Recurring States (Default: True)
  const [isWeeklyRecurring, setIsWeeklyRecurring] = useState(true);
  const [repeatWeeks, setRepeatWeeks] = useState(4);

  const selectedGroup = groups.find(g => g.id === groupId);
  const groupStudents = students.filter(s => s.groupId === groupId);

  // CONFLICT DETECTION ALGORITHM:
  // Check if chosen date + time overlaps with any existing lesson
  const checkConflict = (checkTime: string) => {
    if (isWeeklyRecurring) {
      for (let i = 0; i < repeatWeeks; i++) {
        const d = new Date(date);
        d.setDate(d.getDate() + (i * 7));
        const dateStr = formatLocalDate(d);
        const dummyLesson = { id: 'dummy', date: dateStr, time: checkTime, durationMinutes };
        if (lessons.some(l => checkOverlap(dummyLesson, l))) return true;
      }
      return false;
    } else {
      const dummyLesson = { id: 'dummy', date, time: checkTime, durationMinutes };
      return lessons.some(l => checkOverlap(dummyLesson, l));
    }
  };

  const hasConflict = checkConflict(time);

  // SUGGEST AVAILABLE SLOTS based on Working Hours & existing schedule
  const availableSlots = React.useMemo(() => {
    if (!profile.weeklyWorkingHours) return [];
    const freePeriods = getFreePeriodsForDate(date, lessons, groups, profile.weeklyWorkingHours, profile);
    const bookable = getBookableSlots(freePeriods, durationMinutes);
    return bookable.map(b => b.start);
  }, [date, lessons, groups, profile.weeklyWorkingHours, profile, durationMinutes]);

  // Load draft on mount
  useEffect(() => {
    async function loadDraft() {
      const draft = await storage.getItem<any>('dl_draft_add_lesson');
      if (draft) {
        if (draft.groupId) setGroupId(draft.groupId);
        if (draft.studentId) setStudentId(draft.studentId);
        if (draft.date) setDate(draft.date);
        if (draft.time) setTime(draft.time);
        if (draft.durationMinutes) setDurationMinutes(draft.durationMinutes);
        if (draft.type) setType(draft.type);
        if (draft.grade) setGrade(draft.grade);
      }
    }
    loadDraft();
  }, []);

  // Save draft on changes
  useEffect(() => {
    storage.setItem('dl_draft_add_lesson', {
      groupId, studentId, date, time, durationMinutes, type, grade, isWeeklyRecurring, repeatWeeks
    });
  }, [groupId, studentId, date, time, durationMinutes, type, grade, isWeeklyRecurring, repeatWeeks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || hasConflict) return;

    const targetStudent = students.find(s => s.id === studentId);

    addLesson({
      groupId,
      groupName: selectedGroup?.name || 'Deutsch Gruppe',
      studentId: studentId || undefined,
      studentName: targetStudent?.name || undefined,
      title: targetStudent?.name || selectedGroup?.name || 'Deutsch Lektion',
      date,
      time,
      durationMinutes: Number(durationMinutes),
      type,
      grade: selectedGroup?.grade || grade,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: selectedGroup ? Math.round(selectedGroup.monthlyPackagePrice / selectedGroup.sessionCount) : 250,
      amountPaid: 0
    }, isWeeklyRecurring ? Number(repeatWeeks) : 1);

    storage.removeItem('dl_draft_add_lesson');
    confetti({ particleCount: 70, spread: 50 });
    onClose();
  };

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] overflow-y-auto p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-t-[20px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md shadow-xl overflow-hidden animate-scale-up font-sans"
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2 mb-1 sm:hidden shrink-0" />
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-surface/20 rounded-lg">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t('schedule_lesson_title')}</h2>
              <p className="text-[10px] text-primary-soft">Weekly Recurring & Google Calendar Sync</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface/20 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3.5 space-y-2.5 max-h-[75vh] overflow-y-auto">
          {/* Select Group */}
          <div className="space-y-0.5">
            <label className="text-xs font-bold text-text-main">
              Gruppe / Kurs *
            </label>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                const g = groups.find(item => item.id === e.target.value);
                if (g) {
                  setType(g.type);
                  setGrade(g.grade);
                  if (g.lessonDurationMinutes) setDurationMinutes(g.lessonDurationMinutes);
                }
              }}
              className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:outline-none"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade} • {(g.type || '').toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Individual Student (Optional if group lesson) */}
          <div className="space-y-0.5">
            <label className="text-xs font-bold text-text-main">
              Einzelner Schüler (Optional)
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:outline-none"
            >
              <option value="">-- Gesamte Gruppe ({selectedGroup?.name}) --</option>
              {groupStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-text-main">Startdatum</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-xs font-bold text-text-main">Uhrzeit</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* WEEKLY RECURRING PANEL */}
          <div className="p-2.5 bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary dark:text-primary flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-primary dark:text-primary" />
                <span>Wöchentlich Wiederholen</span>
              </span>

              <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-primary dark:text-primary">
                <input
                  type="checkbox"
                  checked={isWeeklyRecurring}
                  onChange={(e) => setIsWeeklyRecurring(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                />
                <span>Aktiv</span>
              </label>
            </div>

            {isWeeklyRecurring && (
              <div className="space-y-1 pt-0.5">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block">
                  Anzahl der Wochen:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[4, 8, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRepeatWeeks(num)}
                      className={`py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                        repeatWeeks === num
                          ? 'bg-primary text-white shadow-2xs'
                          : 'bg-surface dark:bg-slate-800 text-text-main border border-surface-border dark:border-surface-border-soft'
                      }`}
                    >
                      {num} W ({num}x)
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] text-primary dark:text-primary font-semibold italic mt-0.5">
                  ✓ Jeden {new Date(date).toLocaleDateString('de-DE', { weekday: 'short' })} um {time} Uhr.
                </p>
              </div>
            )}
          </div>

          {/* CONFLICT DETECTION WARNING */}
          {hasConflict && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-2.5 flex items-start gap-1.5 text-xs text-red-800 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Terminkonflikt erkannt!</p>
                <p className="text-[10px] text-red-700 dark:text-red-400 mt-0.5">
                  Es gibt bereits eine andere Lektion um {time} Uhr an diesem Tag.
                </p>
              </div>
            </div>
          )}

          {/* SUGGESTED TIME SLOTS */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Freie Zeitfenster:</span>
            </label>
            <div className="flex flex-wrap gap-1">
              {availableSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                    time === slot
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-surface-hover text-text-main hover:bg-surface border-surface-border'
                  }`}
                >
                  {formatTimeDisplay(slot, profile.language || 'de')}
                </button>
              ))}
            </div>
          </div>

          {/* Type selector */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">Lesson Type</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setType('online')}
                className={`py-1.5 rounded-lg font-bold border ${
                  type === 'online' ? 'bg-primary text-white' : 'bg-background text-slate-700'
                }`}
              >
                Online
              </button>
              <button
                type="button"
                onClick={() => setType('offline')}
                className={`py-1.5 rounded-lg font-bold border ${
                  type === 'offline' ? 'bg-primary text-white' : 'bg-background text-slate-700'
                }`}
              >
                Offline
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={hasConflict}
            className={`w-full font-bold text-xs py-2.5 rounded-lg shadow-2xs transition-all cursor-pointer ${
              hasConflict
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-primary hover:bg-primary-hover text-white'
            }`}
          >
            {hasConflict ? 'Konflikt beheben' : isWeeklyRecurring ? `${repeatWeeks} Wöchentliche Lektionen Speichern` : t('save_lesson_btn')}
          </button>
        </form>
      </div>
    </div>
  );
};
