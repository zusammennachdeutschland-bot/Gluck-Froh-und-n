import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate, parseLocalDate } from '../utils/timeUtils';
import { getGroupScheduleSlots, getDayNumber, isDateMatchingGroupRecurrence } from '../utils/scheduleUtils';
import { Calendar, Video, MapPin, Home, User, Clock, ChevronRight, Link2, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { useSyncedHomeworkData } from '../hooks/useSyncedHomeworkData';
import {
  findLatestEligiblePreviousLesson,
  resolveLinkedOnlineHomeworkForLesson
} from '../utils/lessonHomeworkLinkUtils';

export const TomorrowsLessonsWidget: React.FC = () => {
  const { lessons, groups, openLessonControl, _t, t } = useApp();
  const { assignments: syncedAssignments, currentOwnerUid } = useSyncedHomeworkData();
  const [copiedLessonId, setCopiedLessonId] = useState<string | null>(null);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const tomorrowsLessons = useMemo(() => {
    const active = lessons
      .filter(l => !l.deleted && l.date === tomorrowStr && l.status !== 'cancelled')
      .filter(l => {
        if (
          l.groupId && 
          l.groupId !== 'quick_group' && 
          l.status === 'scheduled' && 
          (!l.report || (!l.report.attendanceStatus && !l.report.teacherNotes && !l.report.homeworkTitle && l.report.quizScore === undefined)) &&
          (!l.studentPayments || Object.keys(l.studentPayments).length === 0) &&
          (!l.amountPaid || l.amountPaid === 0)
        ) {
          const grp = groups.find(g => g.id === l.groupId && !g.deleted);
          if (grp) {
            if (grp.scheduleRecurrence && grp.scheduleRecurrence !== 'weekly') {
              if (!isDateMatchingGroupRecurrence(grp.scheduleRecurrence, l.date)) {
                return false;
              }
            }
            const activeSlots = getGroupScheduleSlots(grp);
            if (activeSlots.length > 0) {
              const lDate = parseLocalDate(l.date);
              const lDayNum = lDate.getDay();
              const matchesSlot = activeSlots.some(s => getDayNumber(s.day) === lDayNum && s.time === l.time);
              if (!matchesSlot) return false;
            }
          }
        }
        return true;
      });

    const seen = new Set<string>();
    const deduplicated: typeof lessons = [];
    active.forEach(l => {
      const key = l.groupId && l.groupId !== 'quick_group'
        ? `${l.groupId}_${l.date}_${l.time}`
        : l.id;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(l);
      }
    });

    return deduplicated.sort((a, b) => a.time.localeCompare(b.time));
  }, [lessons, groups, tomorrowStr]);

  const getTypeBadge = (type?: string, location?: string) => {
    let label = '';
    if (type === 'online') {
      label = t('auto_online');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft/60 px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <Video className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (type === 'center' || location === 'center') {
      label = t('auto_center');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <MapPin className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (type === 'home' || location === 'home') {
      label = t('auto_home');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <Home className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (type === 'private') {
      label = t('auto_private');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <User className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    label = t('auto_in_person');
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted bg-surface-hover px-2 py-0.5 rounded-md border border-surface-border dark:border-surface-border-soft">
        <MapPin className="w-3 h-3" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-1.5 sm:p-2 shadow-2xs transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border dark:border-primary-border">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
            {t('tomorrows_lessons_title')}
          </h3>
        </div>
        <span className="text-[10px] font-extrabold bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary px-2 py-0.2 rounded-full font-mono">
          {tomorrowsLessons.length}
        </span>
      </div>

      {/* List */}
      {tomorrowsLessons.length === 0 ? (
        <div className="p-2 text-center bg-background dark:bg-background/50 rounded-lg border border-dashed border-surface-border">
          <p className="text-xs font-medium text-text-muted">
            {t('no_lessons_tomorrow')}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tomorrowsLessons.map((lesson) => {
            const displayName = lesson.title || lesson.studentName || lesson.groupName || (t('auto_lesson'));
            const prevEligibleLesson = findLatestEligiblePreviousLesson(lesson, lessons, {
              requireCompletedOrReported: true
            });
            const prevOnlineHw = prevEligibleLesson?.report?.onlineHomeworkAssignmentId
              ? resolveLinkedOnlineHomeworkForLesson(prevEligibleLesson, syncedAssignments, {
                  currentOwnerUid
                })
              : null;

            return (
              <div
                key={lesson.id}
                onClick={() => openLessonControl(lesson)}
                className="group p-1.5 rounded-lg bg-background/80 hover:bg-slate-100 dark:bg-background/60 dark:hover:bg-slate-800/80 border border-surface-border/60 dark:border-surface-border/80 transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Time & Name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="flex items-center gap-1 text-text-main text-[11px] font-mono font-bold shrink-0 bg-surface px-1.5 py-0.5 rounded border border-surface-border shadow-2xs">
                      <Clock className="w-2.5 h-2.5 text-primary" />
                      <span>{lesson.time}</span>
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {displayName}
                      </span>
                    </div>
                  </div>

                  {/* Right: Type Badge & Arrow */}
                  <div className="flex items-center gap-1 shrink-0">
                    {getTypeBadge(lesson.type, lesson.location)}
                    <ChevronRight className="w-3 h-3 text-text-muted/70 group-hover:text-primary transition-colors" />
                  </div>
                </div>

                {/* Linked Online Homework from Most Recent Prior Lesson of Same Group / Student */}
                {prevOnlineHw && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`flex items-center justify-between gap-2 px-2 py-1 rounded-md border text-[10.5px] ${
                      prevOnlineHw.isValid && prevOnlineHw.shareUrl
                        ? 'bg-primary-soft/40 border-primary-border/50 text-text-main'
                        : 'bg-red-50/70 dark:bg-red-950/20 border-red-200/70 dark:border-red-900/40 text-red-700 dark:text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {prevOnlineHw.isValid && prevOnlineHw.shareUrl ? (
                        <Link2 className="w-3 h-3 text-primary shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                      )}
                      <span className="font-bold truncate">
                        {_t('واجب الحصة السابقة:', 'Prev HW:', 'Letzte HA:')} {prevOnlineHw.title}
                      </span>
                    </div>

                    {prevOnlineHw.isValid && prevOnlineHw.shareUrl ? (
                      <div className="flex items-center gap-1 shrink-0" dir="ltr">
                        <span className="hidden sm:inline font-mono text-[10px] text-primary truncate max-w-[140px]">
                          {prevOnlineHw.shortId ? `/Herr-Abdul-rahman/${prevOnlineHw.shortId}` : prevOnlineHw.shareUrl}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(prevOnlineHw.shareUrl!);
                            setCopiedLessonId(lesson.id);
                            setTimeout(() => setCopiedLessonId(null), 2000);
                          }}
                          className="px-1.5 py-0.5 rounded bg-surface border border-surface-border text-primary hover:bg-primary-soft font-bold text-[9.5px] flex items-center gap-0.5 cursor-pointer"
                          title={prevOnlineHw.shareUrl}
                        >
                          {copiedLessonId === lesson.id ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                          <span>{copiedLessonId === lesson.id ? _t('تم', 'Copied', 'OK') : _t('نسخ', 'Copy', 'Kopieren')}</span>
                        </button>
                        <a
                          href={prevOnlineHw.shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-0.5 text-primary hover:bg-primary-soft rounded"
                          title={_t('فتح الواجب', 'Open Homework', 'Öffnen')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-[9.5px] font-black shrink-0">
                        {_t(prevOnlineHw.statusLabelAr, prevOnlineHw.statusLabelEn, prevOnlineHw.statusLabelDe)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
