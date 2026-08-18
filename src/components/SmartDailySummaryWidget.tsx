import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import { formatLocalDate } from '../utils/timeUtils';

import { Sparkles, Clock, Users, BookOpen, AlertCircle, Wallet } from 'lucide-react';

export const SmartDailySummaryWidget: React.FC = () => {
  const { lessons, students, groups, payments, profile, language, t } = useApp();

  // Helper for inline translations
  

  const todayStr = formatLocalDate();

  const summary = useMemo(() => {
    const todaysLessons = lessons
      .filter(l => l.date === todayStr && l.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));

    const todaysLessonsCount = todaysLessons.length;

    // Unique students attending today
    const studentSet = new Set<string>();
    todaysLessons.forEach(l => {
      if (l.studentId) {
        studentSet.add(l.studentId);
      } else if (l.groupId && l.groupId !== 'quick_group') {
        const groupStudents = students.filter(s => s.groupId === l.groupId);
        if (groupStudents.length > 0) {
          groupStudents.forEach(s => studentSet.add(s.id));
        } else {
          studentSet.add(`group_${l.groupId}`);
        }
      } else if (l.studentName) {
        studentSet.add(l.studentName);
      }
    });
    const todaysStudentsCount = studentSet.size;

    // Revenue collected today (matching Payments View)
    const paidOnly = payments.filter(p => p.status === 'paid');
    const dailyPayments = paidOnly.filter(p => {
      const d = p.paidDate || p.dueDate;
      return d && d.startsWith(todayStr);
    });
    const collectedToday = dailyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    // Overdue students count
    const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
    const lateStudentsCount = new Set(dueCycles.map(c => c.studentId)).size;

    // First lesson time today
    const firstLessonTime = todaysLessons[0]?.time || null;

    const formatTime12h = (timeStr: string) => {
      if (!timeStr) return '';
      const parts = timeStr.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      if (isNaN(h)) return timeStr;
      if (language === 'ar') {
        const period = h >= 12 ? 'مساءً' : 'صباحاً';
        h = h % 12 || 12;
        return `${h}:${m} ${period}`;
      } else if (language === 'de') {
        return `${timeStr} Uhr`;
      } else {
        const period = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${period}`;
      }
    };

    const currency = profile.currency || (t('auto_egp'));

    let text = '';
    if (todaysLessonsCount === 0) {
      if (lateStudentsCount > 0) {
        if (language === 'ar') {
          text = `لا توجد حصص مجدولة لليوم. يوجد ${lateStudentsCount} طلاب متأخرون في الدفع.`;
        } else if (language === 'de') {
          text = `Keine Stunden für heute geplant. Es gibt ${lateStudentsCount} Schüler mit überfälligen Zahlungen.`;
        } else {
          text = `No lessons scheduled for today. There are ${lateStudentsCount} student(s) with overdue payments.`;
        }
      } else {
        text = t('smart_summary_no_lessons_regular');
      }
    } else {
      let lateText = '';
      if (lateStudentsCount > 0) {
        if (language === 'ar') lateText = `يوجد ${lateStudentsCount} طلاب متأخرون في الدفع.`;
        else if (language === 'de') lateText = `Es gibt ${lateStudentsCount} Schüler mit überfälligen Zahlungen.`;
        else lateText = `There are ${lateStudentsCount} student(s) with overdue payments.`;
      } else {
        if (language === 'ar') lateText = 'جميع الدفوعات منتظمة.';
        else if (language === 'de') lateText = 'Alle Zahlungen sind pünktlich.';
        else lateText = 'All payments are up to date.';
      }

      let firstText = '';
      if (firstLessonTime) {
        if (language === 'ar') firstText = `أول حصة تبدأ الساعة ${formatTime12h(firstLessonTime)}.`;
        else if (language === 'de') firstText = `Die erste Stunde beginnt um ${formatTime12h(firstLessonTime)}.`;
        else firstText = `First lesson starts at ${formatTime12h(firstLessonTime)}.`;
      }

      if (language === 'ar') {
        text = `لديك اليوم ${todaysLessonsCount} حصص، و ${todaysStudentsCount} طالبًا. تم تحصيل ${collectedToday.toLocaleString()} ${currency} اليوم. ${lateText} ${firstText}`;
      } else if (language === 'de') {
        text = `Sie haben heute ${todaysLessonsCount} Stunde(n) und ${todaysStudentsCount} Schüler. Heute eingenommen: ${collectedToday.toLocaleString()} ${currency}. ${lateText} ${firstText}`;
      } else {
        text = `You have ${todaysLessonsCount} lesson(s) today with ${todaysStudentsCount} student(s). Collected today: ${collectedToday.toLocaleString()} ${currency}. ${lateText} ${firstText}`;
      }
    }

    return {
      todaysLessonsCount,
      todaysStudentsCount,
      collectedToday,
      lateStudentsCount,
      firstLessonTime: firstLessonTime ? formatTime12h(firstLessonTime) : null,
      text,
      currency
    };
  }, [lessons, students, groups, payments, profile, todayStr, language, t]);

  return (
    <div className="relative overflow-hidden bg-surface border border-primary-border dark:border-primary-border rounded-2xl p-4 shadow-2xs transition-all">
      {/* Subtle Background Glow Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 dark:bg-primary/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 dark:bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary-soft text-primary border border-primary-border active:scale-95 transition-all hover:bg-primary/20">
            <Sparkles className="w-4 h-4 text-primary dark:text-primary animate-pulse" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-text-main">
            {t('smart_summary_title')}
          </h3>
        </div>
        <span className="text-[10px] font-extrabold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 rounded-full border border-primary-border dark:border-primary-800/80">
          {t('smart_summary_badge')}
        </span>
      </div>

      {/* Narrative Card */}
      <div className="relative z-10 bg-primary-soft/40 dark:bg-background/70 border border-primary-border rounded-xl p-3.5 mb-3 transition-all">
        <p className="text-xs sm:text-sm leading-relaxed text-text-main font-medium">
          {summary.text}
        </p>
      </div>

      {/* Metrics Row */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Lessons count */}
        <div className="flex items-center gap-2 bg-background dark:bg-background/60 border border-surface-border/80 dark:border-surface-border p-2.5 rounded-xl transition-all">
          <div className="p-1.5 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary shrink-0 active:scale-95 transition-all hover:bg-primary/20">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-text-muted font-bold truncate">
              {t('smart_summary_todays_lessons')}
            </p>
            <p className="text-xs font-extrabold text-text-main font-mono">
              {summary.todaysLessonsCount}
            </p>
          </div>
        </div>

        {/* Students count */}
        <div className="flex items-center gap-2 bg-background dark:bg-background/60 border border-surface-border/80 dark:border-surface-border p-2.5 rounded-xl transition-all">
          <div className="p-1.5 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-text-muted font-bold truncate">
              {t('smart_summary_todays_students')}
            </p>
            <p className="text-xs font-extrabold text-text-main font-mono">
              {summary.todaysStudentsCount}
            </p>
          </div>
        </div>

        {/* Expected Income */}
        <div className="flex items-center gap-2 bg-background dark:bg-background/60 border border-surface-border/80 dark:border-surface-border p-2.5 rounded-xl transition-all">
          <div className="p-1.5 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary shrink-0">
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-text-muted font-bold truncate">
              {t('daily_stats_revenue_today')}
            </p>
            <p className="text-xs font-extrabold text-primary dark:text-primary font-mono">
              {summary.collectedToday.toLocaleString()} <span className="text-[9px]">{summary.currency}</span>
            </p>
          </div>
        </div>

        {/* First Lesson / Overdue Alert */}
        <div className="flex items-center gap-2 bg-background dark:bg-background/60 border border-surface-border/80 dark:border-surface-border p-2.5 rounded-xl transition-all">
          {summary.firstLessonTime ? (
            <>
              <div className="p-1.5 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-text-muted font-bold truncate">
                  {t('smart_summary_first_lesson')}
                </p>
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono truncate">
                  {summary.firstLessonTime}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-1.5 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-text-muted font-bold truncate">
                  {t('smart_summary_overdue_students')}
                </p>
                <p className="text-xs font-extrabold text-primary dark:text-primary font-mono">
                  {summary.lateStudentsCount}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
