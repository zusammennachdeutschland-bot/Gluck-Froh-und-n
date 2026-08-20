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
        <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 shadow-2xs transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary dark:text-primary flex items-center justify-center shrink-0 border border-primary-border/20">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-primary dark:text-primary truncate">
                  {t('past_pending_lessons_title')}
                </span>
                <span className="text-[10px] font-extrabold bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary px-1.5 py-0.2 rounded-full font-mono">
                  {pastPendingCount}
                </span>
              </div>
              <p className="text-[10px] text-primary/90 dark:text-primary/90 truncate mt-0.5">
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
            className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{t('open')}</span>
            <ChevronRight className="w-3 h-3" />
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
