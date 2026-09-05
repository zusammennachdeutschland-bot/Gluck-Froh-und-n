import { isPendingStatus } from "../utils/lessonUtils";
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson } from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { 
  CheckCircle2, Clock, PlayCircle, ChevronRight, ChevronDown, ChevronUp, AlertCircle, XCircle, X, Video, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const TodaysProgressTimeline: React.FC = () => {
  const { lessons, openLessonControl, dismissedDashboardLessonIds, dismissLessonFromDashboard, t, _t } = useApp();
  const [now, setNow] = useState(new Date());
  const [isPastPendingExpanded, setIsPastPendingExpanded] = useState(false);
  const [showAllPastPending, setShowAllPastPending] = useState(false);

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

  // Closed lessons include completed and cancelled lessons (all scheduled items resolved for today)
  const closedCount = completedCount + cancelledCount;
  const progressPercent = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;
  const filledUnits = completedCount + activeCount + cancelledCount;
  const filledPercent = totalCount > 0 ? Math.min(100, Math.round((filledUnits / totalCount) * 100)) : 0;

  // Helper to generate a seamless, fluid gradient transition without sharp borders (انسيابي بدون حد)
  // Palette according to user request:
  // - Completed (انشرح): الأخضر (Emerald)
  // - Active / In-progress (جاري): الأزرق (Royal Blue)
  // - Cancelled (يتكنسل): الأحمر (Rose Red)
  const getSmoothProgressBarGradient = (
    cCount: number,
    aCount: number,
    xCount: number
  ): string => {
    const total = cCount + aCount + xCount;
    if (total === 0) return 'transparent';

    const cRatio = (cCount / total) * 100;
    const aRatio = (aCount / total) * 100;
    const xRatio = (xCount / total) * 100;

    const green = '#10B981';
    const greenDark = '#059669';
    const blue = '#3B82F6';
    const blueDark = '#2563EB';
    const red = '#F43F5E';
    const redDark = '#E11D48';

    const segments: { color: string; colorDark: string; pct: number }[] = [];
    if (cRatio > 0) segments.push({ color: green, colorDark: greenDark, pct: cRatio });
    if (aRatio > 0) segments.push({ color: blue, colorDark: blueDark, pct: aRatio });
    if (xRatio > 0) segments.push({ color: red, colorDark: redDark, pct: xRatio });

    if (segments.length === 1) {
      return `linear-gradient(90deg, ${segments[0].color} 0%, ${segments[0].colorDark} 100%)`;
    }

    // Build smooth gradient stops with soft, organic blending zones (انسيابي)
    // to eliminate any sharp cutoff line ("حد") between different states
    const stops: string[] = [];
    let currentPos = 0;
    const blendRadius = segments.length === 2 ? 6.5 : 4.5;

    segments.forEach((seg, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === segments.length - 1;
      const nextPos = currentPos + seg.pct;

      if (isFirst) {
        stops.push(`${seg.color} 0%`);
        const solidEnd = Math.max(0, nextPos - blendRadius);
        stops.push(`${seg.color} ${solidEnd.toFixed(1)}%`);
      } else if (isLast) {
        const solidStart = Math.min(100, currentPos + blendRadius);
        stops.push(`${seg.color} ${solidStart.toFixed(1)}%`);
        stops.push(`${seg.colorDark} 100%`);
      } else {
        const solidStart = Math.min(100, currentPos + blendRadius);
        const solidEnd = Math.max(solidStart, nextPos - blendRadius);
        stops.push(`${seg.color} ${solidStart.toFixed(1)}%`);
        stops.push(`${seg.color} ${solidEnd.toFixed(1)}%`);
      }

      currentPos = nextPos;
    });

    return `linear-gradient(90deg, ${stops.join(', ')})`;
  };

  return (
    <div className="space-y-2.5">
      {/* SECTION 2: PAST PENDING LESSONS (Collapsible by default) */}
      {pendingPastLessons.length > 0 && (
        <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-xl shadow-2xs overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsPastPendingExpanded(prev => !prev)}
            aria-expanded={isPastPendingExpanded}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-black uppercase text-primary dark:text-primary tracking-wider flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0" />
                <span className="truncate">{t('past_pending_lessons_title')} ({pendingPastLessons.length})</span>
              </span>
              <span className="text-[9px] font-extrabold text-primary dark:text-primary bg-primary/15 dark:bg-primary/20 px-1.5 py-0.5 rounded-md shrink-0">
                {t('timeline_requires_action')}
              </span>
            </div>

            <div className="flex items-center gap-1 text-primary shrink-0">
              {isPastPendingExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {isPastPendingExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 pt-1 border-t border-primary-border/60 dark:border-primary-border/60">
                  <div className="max-h-64 overflow-y-auto divide-y divide-primary-border/60 dark:divide-primary-border/60 pr-1">
                    {(showAllPastPending ? pendingPastLessons : pendingPastLessons.slice(0, 3)).map((pLesson) => (
                      <div
                        key={pLesson.id}
                        onClick={() => openLessonControl(pLesson)}
                        className="py-1.5 flex items-center justify-between gap-2 cursor-pointer group transition-colors first:pt-0.5 last:pb-0"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.2 rounded">
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

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-bold bg-primary/10 text-primary dark:text-primary px-1.5 py-0.5 rounded transition-colors group-hover:bg-primary/20">
                            {t('timeline_requires_action')}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {pendingPastLessons.length > 3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllPastPending(prev => !prev);
                      }}
                      className="w-full mt-2 pt-2 border-t border-primary-border/40 dark:border-primary-border/40 text-[11px] font-extrabold text-primary dark:text-primary flex items-center justify-center gap-1.5 hover:underline cursor-pointer transition-colors"
                    >
                      {showAllPastPending ? (
                        <>
                          <span>{_t('إظهار أول 3 حصص فقط', 'Show first 3 lessons only', 'Nur erste 3 Lektionen anzeigen')}</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>
                            {_t(
                              `عرض باقي الحصص (${pendingPastLessons.length - 3} إضافية)`,
                              `Show remaining ${pendingPastLessons.length - 3} lessons`,
                              `Weitere ${pendingPastLessons.length - 3} Lektionen anzeigen`
                            )}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SECTION 1: TODAY'S LESSONS */}
      {totalCount === 0 ? (
        <div className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-text-main flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{t('todays_lessons_title')}</span>
            </span>
            <span className="text-[10px] font-mono text-text-muted/70">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-text-muted text-center py-1.5 italic">
            {t('timeline_no_lessons')}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-surface-border rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2.5">
          {/* Timeline Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary dark:text-primary" />
                <span>{t('todays_lessons_title')}</span>
              </h3>
              <span 
                className={`text-[10px] px-1.5 py-0.2 rounded border transition-colors ${
                  progressPercent === 100
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 font-bold'
                    : 'bg-surface-hover/80 text-text-muted border-surface-border/60 dark:border-surface-border-soft/60 font-medium'
                }`}
                title={
                  cancelledCount > 0
                    ? `${completedCount} ${t('status_completed')} + ${cancelledCount} ${t('status_cancelled')}`
                    : undefined
                }
              >
                {closedCount}/{totalCount} ({progressPercent}%)
              </span>
            </div>

            {progressPercent === 100 && totalCount > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1 animate-in fade-in duration-300">
                <span>✓</span>
                <span>{_t('اكتمل جدول اليوم', 'Day Completed', 'Tag abgeschlossen')}</span>
              </span>
            )}
          </div>

          {/* Progress Bar Visualizer */}
          <div className="space-y-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-2.5 sm:h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/70 dark:border-slate-700/60 shadow-inner flex relative">
              {filledUnits > 0 && (
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out shadow-xs relative overflow-hidden" 
                  style={{ 
                    width: `${filledPercent}%`,
                    background: getSmoothProgressBarGradient(completedCount, activeCount, cancelledCount)
                  }}
                  title={`${completedCount} ${t('status_completed')}, ${activeCount} ${t('status_in_progress')}, ${cancelledCount} ${t('status_cancelled')}`}
                >
                  {/* Subtle glossy shimmer highlight overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/10 pointer-events-none rounded-full" />
                </div>
              )}
            </div>

            {/* Status Count Summary Badges */}
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5 text-[9px] font-bold">
              {/* Completed (Green) */}
              <div 
                className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg border transition-all whitespace-nowrap overflow-hidden ${
                  completedCount > 0
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60 font-black'
                    : 'text-text-muted/60 bg-surface-hover/50 border-surface-border/40'
                }`}
              >
                <CheckCircle2 className={`w-2.5 h-2.5 shrink-0 ${completedCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted/50'}`} />
                <span className="truncate">{completedCount} {t('status_completed')}</span>
              </div>

              {/* In Progress (Blue) */}
              <div 
                className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg border transition-all whitespace-nowrap overflow-hidden ${
                  activeCount > 0
                    ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/60 font-black animate-pulse'
                    : 'text-text-muted/60 bg-surface-hover/50 border-surface-border/40'
                }`}
              >
                <PlayCircle className={`w-2.5 h-2.5 shrink-0 ${activeCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-text-muted/50'}`} />
                <span className="truncate">{activeCount} {t('status_in_progress')}</span>
              </div>

              {/* Upcoming (Neutral) */}
              <div 
                className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg border transition-all whitespace-nowrap overflow-hidden ${
                  upcomingCount > 0
                    ? 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 font-bold'
                    : 'text-text-muted/60 bg-surface-hover/50 border-surface-border/40'
                }`}
              >
                <Clock className="w-2.5 h-2.5 shrink-0 text-text-muted/70" />
                <span className="truncate">{upcomingCount} {t('timeline_upcoming')}</span>
              </div>

              {/* Cancelled (Red) */}
              <div 
                className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg border transition-all whitespace-nowrap overflow-hidden ${
                  cancelledCount > 0
                    ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/60 font-black'
                    : 'text-text-muted/60 bg-surface-hover/50 border-surface-border/40'
                }`}
              >
                <XCircle className={`w-2.5 h-2.5 shrink-0 ${cancelledCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-text-muted/50'}`} />
                <span className="truncate">{cancelledCount} {t('status_cancelled')}</span>
              </div>
            </div>
          </div>

          {/* Chronological Timeline Nodes */}
          <div className="relative pl-3 space-y-2 pt-0.5 border-l border-slate-200/70 dark:border-surface-border/80">
            {processedLessons.map(({ lesson, state }) => {
              const isGroup = !!lesson.groupId || lesson.groupName.includes('Gruppe') || (lesson.title && lesson.title.includes('Gruppe'));
              const isCompletedState = lesson.status === 'completed';
              const isCancelledState = lesson.status === 'cancelled';

              return (
                <div 
                  key={lesson.id}
                  onClick={() => openLessonControl(lesson)}
                  className={`relative pl-3 transition-all cursor-pointer group rounded-lg p-2 sm:p-2.5 border ${
                    isCompletedState
                      ? 'bg-emerald-500/[0.03] dark:bg-emerald-950/10 border-emerald-500/20 dark:border-emerald-900/30 opacity-75'
                      : isCancelledState
                      ? 'bg-rose-500/[0.04] dark:bg-rose-950/15 border-rose-500/25 dark:border-rose-900/35 opacity-75'
                      : state === 'active'
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-xs shadow-blue-500/10'
                      : 'bg-background/30 dark:bg-slate-800/10 border-slate-100 dark:border-surface-border/60 hover:bg-slate-100/40'
                  }`}
                >
                  <div 
                    className={`absolute -left-[16.5px] top-3.5 w-2 h-2 rounded-full border bg-surface flex items-center justify-center ${
                      isCompletedState
                        ? 'border-emerald-400 bg-emerald-500 ring-2 ring-emerald-400/20'
                        : isCancelledState
                        ? 'border-rose-400 bg-rose-500 ring-2 ring-rose-400/20'
                        : state === 'active'
                        ? 'border-blue-500 bg-blue-500 ring-2 ring-blue-500/30 animate-pulse'
                        : 'border-slate-300 dark:border-slate-600 bg-surface'
                    }`}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-mono font-bold ${
                          isCompletedState 
                            ? 'text-text-muted/70 dark:text-slate-500 line-through' 
                            : isCancelledState 
                            ? 'text-rose-600/80 dark:text-rose-400/80 line-through font-semibold' 
                            : state === 'active'
                            ? 'text-blue-700 dark:text-blue-300 font-extrabold'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {lesson.time}
                        </span>

                        {state === 'active' && !isCompletedState && !isCancelledState && (
                          <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded flex items-center gap-1 shadow-xs">
                            <span className="w-1 h-1 bg-white rounded-full animate-ping"></span>
                            {t('timeline_live_now')}
                          </span>
                        )}

                        {isCompletedState && (
                          <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            {t('status_completed')}
                          </span>
                        )}

                        {isCancelledState && (
                          <span className="text-[9px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <XCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                            {t('status_cancelled')}
                          </span>
                        )}
                      </div>

                      <h4 className={`text-xs font-bold line-clamp-1 transition-colors ${
                        isCompletedState 
                          ? 'line-through text-text-muted/70 dark:text-slate-500' 
                          : isCancelledState
                          ? 'line-through text-rose-700/80 dark:text-rose-300/80'
                          : state === 'active'
                          ? 'text-blue-900 dark:text-blue-100 font-black group-hover:text-blue-700'
                          : 'text-text-main group-hover:text-primary dark:group-hover:text-primary'
                      }`}>
                        {lesson.studentName || lesson.groupName || lesson.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted flex-wrap font-medium">
                        {lesson.grade && <span>{lesson.grade}</span>}
                        {lesson.grade && <span>•</span>}
                        <span className={`font-semibold ${
                          isCancelledState
                            ? 'text-rose-600/70 dark:text-rose-400/70'
                            : state === 'active'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-primary dark:text-primary'
                        }`}>
                          S{lesson.sessionNumber}/{lesson.totalSessionsInPackage}
                        </span>
                        <span>•</span>
                        {lesson.type === 'online' ? (
                          <span className={`flex items-center gap-0.5 ${
                            isCancelledState
                              ? 'text-rose-600/70 dark:text-rose-400/70'
                              : state === 'active'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-primary dark:text-primary'
                          }`}>
                            <Video className="w-2.5 h-2.5" /> {t('next_action_online')}
                          </span>
                        ) : (
                          <span className={`flex items-center gap-0.5 ${
                            isCancelledState
                              ? 'text-rose-600/70 dark:text-rose-400/70'
                              : state === 'active'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-primary dark:text-primary'
                          }`}>
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
                          className={`p-1 rounded text-text-muted/70 transition-colors cursor-pointer ${
                            isCancelledState
                              ? 'hover:text-rose-600 hover:bg-rose-100/60 dark:hover:bg-rose-950/60'
                              : 'hover:text-emerald-600 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60'
                          }`}
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
