import { isPendingStatus } from "../utils/lessonUtils";
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson, Group } from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { 
  CheckCircle2, Clock, PlayCircle, ChevronRight, ChevronDown, ChevronUp, AlertCircle, XCircle, X, Video, MapPin, Users, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GroupProfileModal } from './GroupProfileModal';

const getLessonEndTime = (timeStr: string, durationMinutes: number = 60): string => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const total = h * 60 + m + (durationMinutes || 60);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

export const TodaysProgressTimeline: React.FC = () => {
  const { lessons, groups, students, openLessonControl, dismissedDashboardLessonIds, dismissLessonFromDashboard, t, _t, language } = useApp();
  const [now, setNow] = useState(new Date());
  const [isPastPendingExpanded, setIsPastPendingExpanded] = useState(false);
  const [showAllPastPending, setShowAllPastPending] = useState(false);
  const [selectedGroupForModal, setSelectedGroupForModal] = useState<Group | null>(null);

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
                          {pLesson.groupId && groups.find(g => g.id === pLesson.groupId) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupForModal(groups.find(g => g.id === pLesson.groupId) || null);
                              }}
                              className="text-xs font-bold text-text-main hover:text-primary dark:hover:text-primary hover:underline truncate text-start cursor-pointer inline-flex items-center gap-1"
                              title={_t('انقر لفتح قائمة وبيانات المجموعة', 'Click to open group details & profile', 'Klicken, um Gruppendetails zu öffnen')}
                            >
                              <span className="truncate">{groups.find(g => g.id === pLesson.groupId)?.name}</span>
                              <span className="text-[9px] font-bold px-1 rounded bg-primary-soft text-primary">
                                {_t('مجموعة', 'Group', 'Gruppe')}
                              </span>
                            </button>
                          ) : (
                            <h4 className="text-xs font-bold text-text-main group-hover:text-primary dark:group-hover:text-primary truncate">
                              {pLesson.studentName || pLesson.groupName || pLesson.title}
                            </h4>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-bold bg-primary/10 text-primary dark:text-primary px-1.5 py-0.5 rounded transition-colors group-hover:bg-primary/20">
                            {t('timeline_requires_action')}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-primary dark:text-primary shrink-0 transition-transform ${
                            language === 'ar' ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'
                          }`} />
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
        <div className="bg-surface border border-surface-border rounded-xl p-2 sm:p-2.5 shadow-2xs space-y-2">
          {/* Timeline Header */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 whitespace-nowrap">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 whitespace-nowrap">
                {t('todays_lessons_title')}
              </h3>
              <span 
                className={`text-[11px] font-bold font-mono transition-colors whitespace-nowrap ${
                  progressPercent === 100
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-text-muted'
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
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0 whitespace-nowrap animate-in fade-in duration-300">
                <span className="font-bold">✓</span>
                <span>{_t('اكتمل اليوم', 'Day Completed', 'Tag abgeschlossen')}</span>
              </span>
            )}
          </div>

          {/* Progress Bar Visualizer */}
          <div className="space-y-1">
            <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden flex relative">
              {filledUnits > 0 && (
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out shadow-xs relative overflow-hidden" 
                  style={{ 
                    width: `${filledPercent}%`,
                    background: getSmoothProgressBarGradient(completedCount, activeCount, cancelledCount)
                  }}
                  title={`${completedCount} ${t('status_completed')}, ${activeCount} ${t('status_in_progress')}, ${cancelledCount} ${t('status_cancelled')}`}
                />
              )}
            </div>

            {/* Status Count Summary Inline (Compact size) */}
            <div className="flex items-center justify-between text-[10px] font-bold px-0.5 pt-0.5">
              {/* Completed (Green) */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  completedCount > 0
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{completedCount} {t('status_completed')}</span>
              </div>

              {/* In Progress (Blue) */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  activeCount > 0
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <PlayCircle className="w-3 h-3 shrink-0" />
                <span>{activeCount} {t('status_in_progress')}</span>
              </div>

              {/* Upcoming (Neutral) */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  upcomingCount > 0
                    ? 'text-slate-600 dark:text-slate-400 font-semibold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span>{upcomingCount} {t('timeline_upcoming')}</span>
              </div>

              {/* Cancelled (Red) */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  cancelledCount > 0
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <XCircle className="w-3 h-3 shrink-0" />
                <span>{cancelledCount} {t('status_cancelled')}</span>
              </div>
            </div>
          </div>

          {/* Lessons List (Material 3 Compact Agenda Cards) */}
          <div className="space-y-1.5">
            {processedLessons.map(({ lesson, state }) => {
              const targetGroup = lesson.groupId ? groups.find(g => g.id === lesson.groupId) : null;
              const groupStudents = targetGroup && students ? students.filter(s => s.groupId === targetGroup.id) : [];
              const isCompletedState = lesson.status === 'completed';
              const isCancelledState = lesson.status === 'cancelled';
              const endTime = getLessonEndTime(lesson.time, lesson.durationMinutes || 60);
              const isRtl = language === 'ar';

              // Build clean, unboxed metadata items separated by typographic middots (Zero-pill discipline)
              const metaParts: string[] = [];
              if (lesson.grade) metaParts.push(lesson.grade);
              if (lesson.type === 'online') {
                metaParts.push(t('next_action_online'));
              } else {
                metaParts.push(lesson.location && lesson.location !== 'center' && lesson.location !== 'home' ? lesson.location : t('next_action_offline'));
              }
              if (targetGroup && groupStudents.length > 0) {
                metaParts.push(`${groupStudents.length} ${_t('طلاب', 'students', 'Schüler')}`);
              }
              if (lesson.totalSessionsInPackage && lesson.totalSessionsInPackage > 1) {
                metaParts.push(`${_t('حصة', 'Session', 'Stunde')} ${lesson.sessionNumber}/${lesson.totalSessionsInPackage}`);
              }

              return (
                <div 
                  key={lesson.id}
                  onClick={() => openLessonControl(lesson)}
                  className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                    isCompletedState
                      ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-75 hover:opacity-100'
                      : isCancelledState
                      ? 'bg-rose-500/[0.02] dark:bg-rose-950/10 border-rose-500/20 dark:border-rose-900/25 opacity-70 hover:opacity-95'
                      : state === 'active'
                      ? 'bg-blue-50/60 dark:bg-blue-950/25 border-blue-400/80 dark:border-blue-600/70 shadow-2xs shadow-blue-500/5 ring-1 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-900/70 border-slate-200/70 dark:border-surface-border/70 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xs'
                  }`}
                >
                  {/* Leading Event Accent Stripe (Material 3 Event Bar) */}
                  <div 
                    className={`w-1 self-stretch rounded-full shrink-0 transition-colors ${
                      isCompletedState
                        ? 'bg-emerald-500/70'
                        : isCancelledState
                        ? 'bg-rose-400/70 dark:bg-rose-500/70'
                        : state === 'active'
                        ? 'bg-blue-600 animate-pulse'
                        : 'bg-primary/70'
                    }`}
                  />

                  {/* 1. Time Column (Crisp Tabular Typography) */}
                  <div className="flex flex-col justify-center shrink-0 min-w-[46px] sm:min-w-[50px] text-start tabular-nums select-none">
                    <span className={`text-xs sm:text-[13px] font-bold tracking-tight leading-none ${
                      isCompletedState 
                        ? 'text-text-muted line-through opacity-80' 
                        : isCancelledState 
                        ? 'text-rose-600/80 dark:text-rose-400/80 line-through' 
                        : state === 'active'
                        ? 'text-blue-700 dark:text-blue-300 font-extrabold'
                        : 'text-text-main'
                    }`}>
                      {lesson.time}
                    </span>
                    <span className={`text-[10px] font-medium leading-none mt-1 ${
                      state === 'active' ? 'text-blue-600/80 dark:text-blue-400/80' : 'text-text-muted/70'
                    }`}>
                      {endTime || `${lesson.durationMinutes || 60}m`}
                    </span>
                  </div>

                  {/* Hairline Divider between time & details */}
                  <div className="w-px self-stretch bg-slate-200/60 dark:bg-slate-800 shrink-0 my-0.5" />

                  {/* 2. Main Content (Clean Editorial Hierarchy, Compact & Full Visibility) */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Title Row */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        {targetGroup ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroupForModal(targetGroup);
                            }}
                            className={`text-xs sm:text-[13px] font-bold text-start cursor-pointer hover:underline hover:text-primary transition-colors break-words leading-tight ${
                              isCompletedState
                                ? 'line-through text-text-muted/80'
                                : isCancelledState
                                ? 'line-through text-rose-600/80 dark:text-rose-400/80'
                                : state === 'active'
                                ? 'text-blue-900 dark:text-blue-100'
                                : 'text-text-main'
                            }`}
                            title={_t('انقر لفتح ملف المجموعة', 'Click to open group profile', 'Klicken für Gruppenprofil')}
                          >
                            {targetGroup.name}
                          </button>
                        ) : (
                          <h4 className={`text-xs sm:text-[13px] font-bold break-words leading-tight ${
                            isCompletedState
                              ? 'line-through text-text-muted/80'
                              : isCancelledState
                              ? 'line-through text-rose-600/80 dark:text-rose-400/80'
                              : state === 'active'
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-text-main'
                          }`}>
                            {lesson.studentName || lesson.groupName || lesson.title}
                          </h4>
                        )}
                      </div>

                      {/* Quiet Live / Status Label */}
                      {state === 'active' && !isCompletedState && !isCancelledState && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                          <span>{t('timeline_live_now')}</span>
                        </span>
                      )}

                      {isCompletedState && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 opacity-80" />
                      )}

                      {isCancelledState && (
                        <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                          ({t('status_cancelled')})
                        </span>
                      )}
                    </div>

                    {/* Metadata Row: Pure typographic elegance with middots, NO PILLS, compact leading */}
                    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] text-text-muted font-normal leading-tight">
                      {metaParts.map((part, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-slate-300 dark:text-slate-600 text-[9px] select-none">·</span>}
                          <span>{part}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* 3. Trailing Action Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(isCompletedState || isCancelledState) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissLessonFromDashboard(lesson.id);
                        }}
                        className="p-1 rounded-lg text-text-muted/50 hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={t('dismiss_from_dashboard')}
                        aria-label="Hide from dashboard"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 text-text-muted/40 group-hover:text-text-muted transition-transform ${
                      isRtl ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selectedGroupForModal && (
        <GroupProfileModal
          group={selectedGroupForModal}
          onClose={() => setSelectedGroupForModal(null)}
        />
      )}
    </div>
  );
};
