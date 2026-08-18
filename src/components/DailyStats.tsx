import React from 'react';
import { useApp } from '../context/AppContext';
import { isPendingStatus } from "../utils/lessonUtils";
import { formatLocalDate } from '../utils/timeUtils';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { WeeklyOverviewWidget } from './WeeklyOverviewWidget';
import { MonthlyOverviewWidget } from './MonthlyOverviewWidget';

export const DailyStats: React.FC = () => {
  const { lessons, openLessonControl, dismissedDashboardLessonIds, t } = useApp();

  const todayStr = formatLocalDate();

  // Past pending sessions (past lessons not completed or cancelled, excluding dismissed)
  const pastPendingLessons = lessons.filter(l => 
    l.date < todayStr && isPendingStatus(l.status) && !dismissedDashboardLessonIds.includes(l.id)
  );
  const pastPendingCount = pastPendingLessons.length;

  return (
    <div className="space-y-3">
      {/* Pending Sessions Warning Card (if any exist) */}
      {pastPendingCount > 0 && (
        <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary dark:text-primary flex items-center justify-center shrink-0 border border-primary-border/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-primary dark:text-primary truncate">
                  {t('past_pending_lessons_title')}
                </span>
                <span className="text-[10px] font-extrabold bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary px-2 py-0.5 rounded-full font-mono">
                  {pastPendingCount}
                </span>
              </div>
              <p className="text-xs text-primary/90 dark:text-primary/90 truncate mt-0.5">
                {t('past_pending_lessons_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (pastPendingLessons[0]) {
                openLessonControl(pastPendingLessons[0]);
              }
            }}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{t('open')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Weekly Overview (Friday to Thursday) */}
      <WeeklyOverviewWidget />

      {/* Refined Monthly Overview */}
      <MonthlyOverviewWidget />
    </div>
  );
};
