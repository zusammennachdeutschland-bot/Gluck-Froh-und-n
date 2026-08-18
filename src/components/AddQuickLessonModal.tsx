import React, { useState, useEffect } from 'react';
import { checkOverlap } from '../utils/lessonUtils';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { PREDEFINED_GRADES } from '../data/initialData';
import { GradeLevel, LessonType, PaymentStatus } from '../types';
import { X, Calendar, Clock, Zap, Video, MapPin, DollarSign, User, Phone, FileText, AlertTriangle } from 'lucide-react';

interface AddQuickLessonModalProps {
  onClose: () => void;
}

export const AddQuickLessonModal: React.FC<AddQuickLessonModalProps> = ({ onClose }) => {
  const { addQuickLesson, profile, lessons, t } = useApp();

  const todayStr = formatLocalDate();

  const [studentName, setStudentName] = useState('');
  const [quickStudentPhone, setQuickStudentPhone] = useState('');
  const [quickParentPhone, setQuickParentPhone] = useState('');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('16:00');
  const [type, setType] = useState<LessonType>('online');
  const [amountDue, setAmountDue] = useState(250);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [quickNotes, setQuickNotes] = useState('');

  // Sync paid amount if amountDue changes while status is paid
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(amountDue);
    }
  }, [amountDue, paymentStatus]);

  const [grade, setGrade] = useState<GradeLevel>('Grade 9');
  const [locationAddress, setLocationAddress] = useState('Kairo Schulungsraum');
  const [meetingLink, setMeetingLink] = useState(profile.defaultZoomLink || 'https://zoom.us/j/123456789');

  
  const checkConflict = (checkTime: string) => {
    const dummyLesson = { id: 'dummy', date, time: checkTime, durationMinutes: 60 };
    return lessons.some(l => checkOverlap(dummyLesson, l));
  };
  const hasConflict = checkConflict(time);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || hasConflict) return;

    addQuickLesson({
      studentName: studentName.trim(),
      quickStudentPhone: quickStudentPhone.trim(),
      quickParentPhone: quickParentPhone.trim(),
      date,
      time,
      type,
      grade,
      amountDue: Number(amountDue),
      amountPaid: Number(amountPaid),
      paymentStatus,
      durationMinutes: 60,
      status: 'scheduled',
      title: `⚡ Quick Lesson: ${studentName.trim()}`,
      quickNotes: quickNotes.trim(),
      locationAddress: type === 'offline' ? locationAddress : undefined,
      meetingLink: type === 'online' ? meetingLink : undefined,
    });

    onClose();
  };

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] overflow-y-auto font-sans p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md shadow-2xl overflow-hidden animate-scale-up"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        {/* Header */}
        <div className="bg-surface border-b border-slate-100 dark:border-surface-border p-5 flex items-center justify-between text-text-main shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary rounded-lg border border-primary-border dark:border-primary-border">
              <Zap className="w-5 h-5 text-primary dark:text-primary" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-text-main">{t('quick_lesson_modal_title')}</h2>
              <p className="text-xs text-text-muted">{t('quick_lesson_modal_desc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted/70 hover:text-slate-600 dark:hover:text-primary hover:bg-background dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {/* Required: Student Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>{t('students_student_name')} *</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Karim Ahmed"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full bg-surface-hover text-text-main text-xs font-bold p-2.5 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors"
            />
          </div>

          {/* Optional Phones */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Phone className="w-3 h-3 text-text-muted/70" /> {t('students_student_phone')}
              </label>
              <input
                type="tel"
                placeholder="+20 100 123 4567"
                value={quickStudentPhone}
                onChange={(e) => setQuickStudentPhone(e.target.value)}
                className="w-full bg-surface-hover text-text-main text-xs font-mono p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Phone className="w-3 h-3 text-text-muted/70" /> {t('students_parent_phone')}
              </label>
              <input
                type="tel"
                placeholder="+20 101 987 6543"
                value={quickParentPhone}
                onChange={(e) => setQuickParentPhone(e.target.value)}
                className="w-full bg-surface-hover text-text-main text-xs font-mono p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted/70" /> {t('date')} *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-hover text-text-main text-xs font-mono font-bold p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-text-muted/70" /> {t('time')} *
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-surface-hover text-text-main text-xs font-mono font-bold p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors"
              />
            </div>
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

          {/* Type Switcher */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">{t('next_action_online')} / {t('next_action_offline')} *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('online')}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                  type === 'online'
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 shadow-2xs'
                    : 'bg-surface-hover border-surface-border/60 dark:border-surface-border-soft/60 text-text-muted hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> {t('next_action_online')}
              </button>

              <button
                type="button"
                onClick={() => setType('offline')}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                  type === 'offline'
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 shadow-2xs'
                    : 'bg-surface-hover border-surface-border/60 dark:border-surface-border-soft/60 text-text-muted hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> {t('next_action_offline')}
              </button>
            </div>
          </div>

          {/* Fee & Payment Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-primary" /> ({profile.currency}) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={amountDue}
                onChange={(e) => setAmountDue(Number(e.target.value))}
                className="w-full bg-surface-hover text-text-main text-xs font-mono font-bold p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">{t('status')}</label>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  const val = e.target.value as PaymentStatus;
                  setPaymentStatus(val);
                  if (val === 'paid') setAmountPaid(amountDue);
                  else if (val === 'pending') setAmountPaid(0);
                }}
                className="w-full bg-surface-hover text-text-main text-xs font-bold p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors cursor-pointer"
              >
                <option value="pending">{t('status_pending')}</option>
                <option value="paid">{t('payments_paid')}</option>
                <option value="partial">{t('payments_partial')}</option>
              </select>
            </div>
          </div>

          {/* Grade Level (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">{t('students_grade')}</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as GradeLevel)}
              className="w-full bg-surface-hover text-text-main text-xs font-bold p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors cursor-pointer"
            >
              {PREDEFINED_GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-text-muted/70" /> {t('notes')}
            </label>
            <textarea
              rows={2}
              placeholder=""
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              className="w-full bg-surface-hover text-text-main text-xs p-2 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 focus:bg-surface dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary-border transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={hasConflict}
            className={`w-full text-white font-black text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 border ${
              hasConflict 
                ? 'bg-slate-300 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 cursor-not-allowed opacity-70' 
                : 'bg-primary border-primary-border hover:bg-primary text-white shadow-sm'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{hasConflict ? 'Konflikt beheben (Resolve Conflict)' : t('save')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
