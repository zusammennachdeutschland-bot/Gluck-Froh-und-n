import React, { useState, useEffect } from 'react';
import { Lesson } from '../types';
import { useApp } from '../context/AppContext';
import { 
  BellRing, BellOff, Clock, PlayCircle, Video, MapPin, 
  Users, User, ChevronRight, Volume2, Sparkles, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LessonAlarmModalProps {
  lesson: Lesson | null;
  onDismiss: () => void;
  onSnooze: (minutes?: number) => void;
  onStartNow: (lesson: Lesson) => void;
}

export const LessonAlarmModal: React.FC<LessonAlarmModalProps> = ({
  lesson,
  onDismiss,
  onSnooze,
  onStartNow,
}) => {
  const { language, _t, notificationSettings } = useApp();
  const [secondsRinging, setSecondsRinging] = useState(0);

  useEffect(() => {
    if (!lesson) return;
    setSecondsRinging(0);
    const interval = setInterval(() => {
      setSecondsRinging(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lesson]);

  if (!lesson) return null;

  const displayName = lesson.studentName || lesson.groupName || lesson.title || 'الحصّة';
  const isOnline = lesson.type === 'online';
  const isGroup = !!lesson.groupId || (lesson.groupName && !lesson.studentName);
  const durationSec = notificationSettings.alarmDurationSeconds || 60;
  const remainingSec = Math.max(0, durationSec - secondsRinging);

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alarm-title"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-primary/40 dark:border-primary/50 overflow-hidden relative"
        >
          {/* Top Pulsing Alarm Visual Header */}
          <div className="bg-linear-to-b from-primary/20 via-primary/10 to-transparent p-6 pb-2 text-center relative overflow-hidden">
            {/* Animated Ringing Bell */}
            <div className="relative inline-flex items-center justify-center mb-3">
              <span className="absolute inline-flex h-20 w-20 rounded-full bg-primary/20 animate-ping" />
              <span className="absolute inline-flex h-16 w-16 rounded-full bg-primary/30 animate-pulse" />
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 rotate-[-4deg] animate-bounce">
                <BellRing className="w-8 h-8 animate-wiggle" />
              </div>
            </div>

            {/* Title & Subtitle */}
            <h2 id="alarm-title" className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {_t('⏰ منبه موعد الحصة القادمة', '⏰ Upcoming Lesson Alarm', '⏰ Lektions-Wecker')}
            </h2>
            <p className="text-xs text-primary font-bold mt-1 flex items-center justify-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>
                {_t(
                  `المنبه يرن الآن بصوت متواصل (${remainingSec} ث متبقية)`,
                  `Alarm ringing continuously (${remainingSec}s remaining)`,
                  `Wecker klingelt durchgehend (noch ${remainingSec}s)`
                )}
              </span>
            </p>
          </div>

          {/* Lesson Details Card */}
          <div className="px-6 py-4 space-y-3.5">
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-bold text-primary">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100">{lesson.time}</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-extrabold">
                  {_t('اليوم', 'Today', 'Heute')}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug break-words">
                  {displayName}
                </h3>
                {lesson.title && lesson.title !== displayName && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                    {lesson.title}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                {lesson.grade && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/70 font-semibold">
                    {lesson.grade}
                  </span>
                )}
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/70 font-semibold">
                  {isOnline ? (
                    <>
                      <Video className="w-3 h-3 text-blue-500" />
                      <span>Online</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3 h-3 text-emerald-500" />
                      <span>{_t('حضوري', 'In-Person', 'Präsenz')}</span>
                    </>
                  )}
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/70 font-semibold">
                  {isGroup ? (
                    <>
                      <Users className="w-3 h-3 text-primary" />
                      <span>{_t('مجموعة', 'Group', 'Gruppe')}</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3 text-primary" />
                      <span>{_t('فردي', 'Individual', 'Einzelunterricht')}</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Equalizer Audio Waves Visualizer */}
            <div className="flex items-center justify-center gap-1.5 py-1">
              <div className="w-1 h-3 bg-primary rounded-full animate-pulse" />
              <div className="w-1 h-6 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              <div className="w-1 h-7 bg-primary rounded-full animate-pulse" style={{ animationDelay: '75ms' }} />
              <div className="w-1 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '225ms' }} />
              <div className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '375ms' }} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 pt-2 bg-slate-50/70 dark:bg-slate-850/60 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-2.5">
            {/* Start Lesson Now Button */}
            <button
              type="button"
              onClick={() => onStartNow(lesson)}
              className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 cursor-pointer transition-all active:scale-[0.98]"
            >
              <PlayCircle className="w-5 h-5" />
              <span>{_t('بدء الحصة الآن', 'Start Lesson Now', 'Lektion jetzt starten')}</span>
            </button>

            {/* Bottom Row: Stop Alarm & Snooze 5 Min */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Stop Alarm */}
              <button
                type="button"
                onClick={onDismiss}
                className="py-3 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer transition-all active:scale-[0.98]"
              >
                <BellOff className="w-4 h-4" />
                <span>{_t('إيقاف المنبه', 'Stop Alarm', 'Wecker stoppen')}</span>
              </button>

              {/* Snooze 5 Min */}
              <button
                type="button"
                onClick={() => onSnooze(5)}
                className="py-3 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>{_t('غفوة 5 دقائق', 'Snooze 5 Min', '5 Min. Schlummern')}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
