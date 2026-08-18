import { isPendingStatus } from "../utils/lessonUtils";
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson } from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { 
  CheckCircle2, Clock, PlayCircle, ChevronRight, AlertCircle, XCircle, X, Video, MapPin
} from 'lucide-react';

export const TodaysProgressTimeline: React.FC = () => {
  const { lessons, openLessonControl, dismissedDashboardLessonIds, dismissLessonFromDashboard, t } = useApp();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = formatLocalDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. PAST PENDING LESSONS: Lessons from previous days with NO final status (neither completed nor cancelled)
  const pendingPastLessons = lessons
    .filter(l => l.date < todayStr && isPendingStatus(l.status) && !dismissedDashboardLessonIds.includes(l.id))
    .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));

  // 2. TODAY'S LESSONS: Lessons scheduled for today, excluding dismissed items
  const todaysLessons = lessons
    .filter(l => l.date === todayStr && !dismissedDashboardLessonIds.includes(l.id))
    .sort((a, b) => a.time.localeCompare(b.time));

  const getLessonState = (lesson: Lesson): 'completed' | 'cancelled' | 'active' | 'upcoming' => {
    if (lesson.status === 'completed') return 'completed';
    if (lesson.status === 'cancelled') return 'cancelled';
    if (lesson.status === 'in_progress') return 'active';
    
    const [h, m] = lesson.time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) {
      return 'upcoming';
    }

    const startMin = h * 60 + m;
    const duration = lesson.durationMinutes || 60;
    const endMin = startMin + duration;

    if (currentMinutes >= startMin && currentMinutes < endMin) return 'active';
    return 'upcoming';
  };

  const processedLessons = todaysLessons.map(lesson => ({
    lesson,
    state: getLessonState(lesson),
  }));

  const completedCount = processedLessons.filter(p => p.lesson.status === 'completed').length;
  const cancelledCount = processedLessons.filter(p => p.lesson.status === 'cancelled').length;
  const activeCount = processedLessons.filter(p => p.state === 'active').length;
  const upcomingCount = processedLessons.filter(p => isPendingStatus(p.lesson.status) && p.state !== 'active').length;
  const totalCount = processedLessons.length;

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* SECTION 2: PAST PENDING LESSONS */}
      {pendingPastLessons.length > 0 && (
        <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase text-primary dark:text-primary tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0" />
              <span>{t('past_pending_lessons_title')} ({pendingPastLessons.length})</span>
            </span>
            <span className="text-[9px] font-extrabold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.5 rounded-md">
              {t('timeline_requires_action')}
            </span>
          </div>
          <p className="text-[10px] text-primary/85 dark:text-primary/80 font-medium leading-relaxed">
            {t('past_pending_lessons_desc')}
          </p>

          <div className="divide-y divide-primary-border dark:divide-primary-border pt-1">
            {pendingPastLessons.map((pLesson) => (
              <div
                key={pLesson.id}
                onClick={() => openLessonControl(pLesson)}
                className="py-2.5 flex items-center justify-between gap-2.5 cursor-pointer group transition-colors first:pt-0 last:pb-0"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.5 rounded">
                      {pLesson.date}
                    </span>
                    <span className="text-xs font-mono font-bold text-text-main">
                      {pLesson.time}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-text-main group-hover:text-primary dark:group-hover:text-primary truncate">
                    {pLesson.studentName || pLesson.groupName || pLesson.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-bold bg-primary/10 text-primary dark:text-primary px-2 py-0.5 rounded transition-colors group-hover:bg-primary/20">
                    {t('timeline_requires_action')}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1: TODAY'S LESSONS */}
      {totalCount === 0 ? (
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-text-main flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{t('todays_lessons_title')}</span>
            </span>
            <span className="text-[10px] font-mono text-text-muted/70">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-text-muted text-center py-2 italic">
            {t('timeline_no_lessons')}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs space-y-3.5">
          {/* Timeline Header */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary dark:text-primary" />
                <span>{t('todays_lessons_title')}</span>
                <span className="text-[10px] bg-surface-hover/80 text-text-muted px-2 py-0.5 rounded border border-surface-border/60 dark:border-surface-border-soft/60 ml-1">
                  {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </h3>
              <p className="text-[10px] text-text-muted font-bold mt-1">
                {completedCount} / {totalCount} {t('timeline_completed_of')} ({progressPercent}%)
              </p>
            </div>
          </div>

          {/* Progress Bar Visualizer */}
          <div className="space-y-2">
            <div className="w-full bg-surface-hover h-1.5 rounded-full overflow-hidden flex">
              <div 
                className="bg-primary h-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
              {activeCount > 0 && (
                <div 
                  className="bg-primary h-full transition-all duration-500" 
                  style={{ width: `${Math.max(10, Math.round((activeCount / totalCount) * 100))}%` }}
                />
              )}
            </div>

            {/* Status Count Summary Badges */}
            <div className="grid grid-cols-4 gap-1 text-[9px] font-bold">
              <div className="flex items-center justify-center gap-1 text-primary dark:text-primary whitespace-nowrap overflow-hidden">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{completedCount} {t('status_completed')}</span>
              </div>

              <div className="flex items-center justify-center gap-1 text-primary dark:text-primary whitespace-nowrap overflow-hidden">
                <PlayCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{activeCount} {t('status_in_progress')}</span>
              </div>

              <div className="flex items-center justify-center gap-1 text-text-muted whitespace-nowrap overflow-hidden">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">{upcomingCount} {t('timeline_upcoming')}</span>
              </div>

              <div className="flex items-center justify-center gap-1 text-primary dark:text-primary whitespace-nowrap overflow-hidden">
                <XCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{cancelledCount} {t('status_cancelled')}</span>
              </div>
            </div>
          </div>

          {/* Chronological Timeline Nodes */}
          <div className="relative pl-3.5 space-y-3.5 pt-1 border-l border-slate-100 dark:border-surface-border/80">
            {processedLessons.map(({ lesson, state }) => {
              const isGroup = !!lesson.groupId || lesson.groupName.includes('Gruppe') || (lesson.title && lesson.title.includes('Gruppe'));
              const isCompletedState = lesson.status === 'completed';
              const isCancelledState = lesson.status === 'cancelled';

              return (
                <div 
                  key={lesson.id}
                  onClick={() => openLessonControl(lesson)}
                  className={`relative pl-3.5 transition-all cursor-pointer group rounded-lg p-3 border ${
                    isCompletedState
                      ? 'bg-background/50 dark:bg-slate-800/10 border-surface-border/60 dark:border-surface-border/40 opacity-70'
                      : isCancelledState
                      ? 'bg-primary-soft dark:bg-primary-soft border-primary-border dark:border-primary-border opacity-60'
                      : state === 'active'
                      ? 'bg-primary-soft dark:bg-primary-soft/10 border-primary-border/80 dark:border-primary-border/60'
                      : 'bg-background/30 dark:bg-slate-800/10 border-slate-100 dark:border-surface-border/60 hover:bg-slate-100/40'
                  }`}
                >
                  <div 
                    className={`absolute -left-[18.5px] top-4.5 w-2 h-2 rounded-full border bg-surface flex items-center justify-center ${
                      isCompletedState
                        ? 'border-slate-400 bg-slate-400'
                        : isCancelledState
                        ? 'border-primary-border bg-primary-hover'
                        : state === 'active'
                        ? 'border-primary bg-primary'
                        : 'border-slate-300 dark:border-slate-600 bg-surface'
                    }`}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-mono font-bold ${isCompletedState ? 'text-text-muted/70 dark:text-slate-500 line-through' : isCancelledState ? 'text-primary dark:text-primary line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                          {lesson.time}
                        </span>

                        {state === 'active' && !isCompletedState && !isCancelledState && (
                          <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded flex items-center gap-1 active:scale-95 hover:shadow-lg hover:shadow-primary/30 transition-all hover:bg-primary-hover">
                            <span className="w-1 h-1 bg-surface rounded-full animate-ping"></span>
                            {t('timeline_live_now')}
                          </span>
                        )}

                        {isCompletedState && (
                          <span className="text-[9px] font-bold text-text-muted bg-surface-hover px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-text-muted/70" />
                            {t('status_completed')}
                          </span>
                        )}

                        {isCancelledState && (
                          <span className="text-[9px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.5 rounded">
                            {t('status_cancelled')}
                          </span>
                        )}
                      </div>

                      <h4 className={`text-xs font-bold line-clamp-1 transition-colors ${
                        isCompletedState 
                          ? 'line-through text-text-muted/70 dark:text-slate-500' 
                          : isCancelledState
                          ? 'line-through text-primary dark:text-primary'
                          : 'text-text-main group-hover:text-primary dark:group-hover:text-primary'
                      }`}>
                        {lesson.studentName || lesson.groupName || lesson.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-1 flex-wrap font-medium">
                        {lesson.grade && <span>{lesson.grade}</span>}
                        {lesson.grade && <span>•</span>}
                        <span className="font-semibold text-primary dark:text-primary">
                          Session {lesson.sessionNumber}/{lesson.totalSessionsInPackage}
                        </span>
                        <span>•</span>
                        {lesson.type === 'online' ? (
                          <span className="flex items-center gap-0.5 text-primary dark:text-primary">
                            <Video className="w-2.5 h-2.5" /> {t('next_action_online')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-primary dark:text-primary">
                            <MapPin className="w-2.5 h-2.5" /> {t('next_action_offline')}
                          </span>
                        )}
                        
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* X Button STRICTLY ONLY for Completed or Cancelled lessons */}
                      {(isCompletedState || isCancelledState) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissLessonFromDashboard(lesson.id);
                          }}
                          className="p-1 rounded text-text-muted/70 hover:text-primary hover:bg-primary-soft dark:hover:bg-primary-soft transition-colors cursor-pointer"
                          title={t('dismiss_from_dashboard')}
                          aria-label="Hide from dashboard"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-text-muted/70 group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
