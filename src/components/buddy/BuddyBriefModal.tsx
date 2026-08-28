import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Award, Clock, DollarSign, BookOpen, CheckSquare, AlertCircle, Sparkles } from 'lucide-react';
import { BuddyWorkloadResult } from '../../types/buddy';
import { BuddyAnimation } from './BuddyAnimation';
import { useApp } from '../../context/AppContext';

interface BuddyBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  workload: BuddyWorkloadResult;
}

export const BuddyBriefModal: React.FC<BuddyBriefModalProps> = ({ isOpen, onClose, workload }) => {
  const { profile } = useApp();
  const currency = profile?.currency || 'EGP';

  if (!isOpen) return null;

  const getScoreRating = (score: number) => {
    if (score >= 85) return { label: 'Excellent day ⭐', color: 'text-amber-500' };
    if (score >= 60) return { label: 'Solid progress 👍', color: 'text-emerald-500' };
    return { label: 'Steady rhythm', color: 'text-blue-500' };
  };

  const rating = getScoreRating(workload.score);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-sm bg-background border border-surface-border dark:border-surface-border-soft rounded-t-[24px] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] mb-[calc(env(safe-area-inset-bottom,0px)+64px)] sm:mb-0"
        >
          {/* Header */}
          <div className="px-3.5 py-3 bg-surface dark:bg-slate-900 border-b border-surface-border dark:border-surface-border-soft flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9">
                <BuddyAnimation mood={workload.mood} size="sm" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="font-black text-xs sm:text-sm text-text-main">Glück Buddy</h3>
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-[11px] text-text-muted font-medium truncate max-w-[200px] sm:max-w-[220px]">
                  {workload.greetingText}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-surface-hover dark:bg-slate-800 text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content Body — Compact & Dense */}
          <div className="p-3.5 overflow-y-auto space-y-3 text-xs">
            
            {/* Score & Rating Banner */}
            <div className="p-3 bg-surface dark:bg-slate-900 border border-surface-border dark:border-surface-border-soft rounded-xl flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Today Score</span>
                <span className={`font-black text-xs ${rating.color}`}>{rating.label}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-black text-xs">
                {workload.score}
              </div>
            </div>

            {/* Quick Stats Grid (2x2 Compact) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-surface dark:bg-slate-900 rounded-xl border border-surface-border dark:border-surface-border-soft flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] text-text-muted block font-bold uppercase">Lessons</span>
                  <span className="font-black text-text-main">{workload.completedLessonsToday} / {workload.totalLessonsToday}</span>
                </div>
              </div>

              <div className="p-2.5 bg-surface dark:bg-slate-900 rounded-xl border border-surface-border dark:border-surface-border-soft flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] text-text-muted block font-bold uppercase">Expected</span>
                  <span className="font-black text-text-main">{workload.expectedIncomeToday} {currency}</span>
                </div>
              </div>

              <div className="p-2.5 bg-surface dark:bg-slate-900 rounded-xl border border-surface-border dark:border-surface-border-soft flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] text-text-muted block font-bold uppercase">Pending</span>
                  <span className="font-black text-text-main">{workload.pendingTasksCount}</span>
                </div>
              </div>

              <div className="p-2.5 bg-surface dark:bg-slate-900 rounded-xl border border-surface-border dark:border-surface-border-soft flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] text-text-muted block font-bold uppercase">Students</span>
                  <span className="font-black text-text-main">{workload.studentsTodayCount}</span>
                </div>
              </div>
            </div>

            {/* Next Lesson / Active Event */}
            {(workload.activeLesson || workload.nextLesson) && (
              <div className="p-3 bg-primary/5 dark:bg-primary-soft/15 border border-primary/20 rounded-xl space-y-0.5">
                <div className="flex items-center gap-1.5 text-primary font-bold text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{workload.activeLesson ? 'Active Now' : 'Next Lesson'}</span>
                </div>
                <p className="font-black text-text-main text-xs">
                  {workload.activeLesson ? workload.activeLesson.groupName || 'Lesson' : workload.nextLesson?.groupName || 'Lesson'}
                  {' — '}
                  <span className="text-text-muted font-normal text-[11px]">
                    {workload.activeLesson ? `${workload.activeLesson.startTime} - ${workload.activeLesson.endTime}` : `${workload.nextLesson?.startTime}`}
                  </span>
                </p>
              </div>
            )}

            {/* Today Story (Compact) */}
            <div className="p-3 bg-surface dark:bg-slate-900 border border-surface-border dark:border-surface-border-soft rounded-xl space-y-1">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Today's Summary</span>
              <p className="text-[11px] text-text-main leading-relaxed font-medium">{workload.todayStoryText}</p>
            </div>

            {/* Attention Alert if needed */}
            {(workload.overduePaymentsCount > 0 || workload.urgentTasksCount > 0) && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-600 dark:text-red-400 text-[11px]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Attention Required</span>
                  <span>{workload.overduePaymentsCount > 0 ? `${workload.overduePaymentsCount} overdue. ` : ''}{workload.urgentTasksCount > 0 ? `${workload.urgentTasksCount} urgent tasks.` : ''}</span>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-3.5 py-2.5 bg-surface dark:bg-slate-900 border-t border-surface-border dark:border-surface-border-soft flex items-center justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs transition-all shadow-2xs cursor-pointer"
            >
              Alles klar 👍
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
