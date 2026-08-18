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
    const freePeriods = getFreePeriodsForDate(date, lessons, groups, profile.weeklyWorkingHours);
    const bookable = getBookableSlots(freePeriods, durationMinutes);
    return bookable.map(b => b.start);
  }, [date, lessons, groups, profile.weeklyWorkingHours, durationMinutes]);

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
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md shadow-2xl overflow-hidden animate-scale-up font-sans"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-surface/20 rounded-xl">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t('schedule_lesson_title')}</h2>
              <p className="text-xs text-primary-soft">Weekly Recurring & Google Calendar Sync</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface/20 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Select Group */}
          <div className="space-y-1">
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
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade} • {(g.type || '').toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Individual Student (Optional if group lesson) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              Einzelner Schüler (Optional)
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none"
            >
              <option value="">-- Gesamte Gruppe ({selectedGroup?.name}) --</option>
              {groupStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">Startdatum (Start Date)</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">Uhrzeit (Time)</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* WEEKLY RECURRING PANEL */}
          <div className="p-3 bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary dark:text-primary flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-primary dark:text-primary" />
                <span>Wöchentlich Wiederholen (Weekly Recurring)</span>
              </span>

              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-primary dark:text-primary">
                <input
                  type="checkbox"
                  checked={isWeeklyRecurring}
                  onChange={(e) => setIsWeeklyRecurring(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <span>Aktiv</span>
              </label>
            </div>

            {isWeeklyRecurring && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                  Anzahl der Wochen (Weeks Duration):
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[4, 8, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRepeatWeeks(num)}
                      className={`py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        repeatWeeks === num
                          ? 'bg-primary text-white shadow-2xs'
                          : 'bg-surface dark:bg-slate-800 text-text-main border border-surface-border dark:border-surface-border-soft'
                      }`}
                    >
                      {num} Wochen ({num} Termine)
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-primary dark:text-primary font-semibold italic mt-1">
                  ✓ Lektionen werden jeden {new Date(date).toLocaleDateString('de-DE', { weekday: 'long' })} um {time} Uhr automatisch eingetragen.
                </p>
              </div>
            )}
          </div>

          {/* CONFLICT DETECTION WARNING */}
          {hasConflict && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Terminkonflikt erkannt! (Schedule Conflict)</p>
                <p className="text-[11px] text-red-700 dark:text-red-400 mt-0.5">
                  Es gibt bereits eine andere Lektion um {time} Uhr an diesem Tag. Bitte wählen Sie eine freie Zeit aus.
                </p>
              </div>
            </div>
          )}

          {/* SUGGESTED TIME SLOTS */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-main flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Freie Zeitfenster (Suggested Available Slots):</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    time === slot
                      ? 'bg-primary text-white border-primary shadow-sm'
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
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setType('online')}
                className={`py-2 rounded-xl font-bold border ${
                  type === 'online' ? 'bg-primary text-white' : 'bg-background text-slate-700'
                }`}
              >
                Online
              </button>
              <button
                type="button"
                onClick={() => setType('offline')}
                className={`py-2 rounded-xl font-bold border ${
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
            className={`w-full font-bold text-xs py-3 rounded-lg shadow-md transition-all cursor-pointer ${
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
