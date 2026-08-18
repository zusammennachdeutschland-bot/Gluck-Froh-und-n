import React from 'react';
import { InspirationCardWidget } from '../InspirationCardWidget';
import { TodaysProgressTimeline } from '../TodaysProgressTimeline';
import { SmartDailySummaryWidget } from '../SmartDailySummaryWidget';
import { HomeworkFollowUpWidget } from '../HomeworkFollowUpWidget';
import { TomorrowsLessonsWidget } from '../TomorrowsLessonsWidget';
import { AvailableTodayWidget } from '../AvailableTodayWidget';
import { DailyStats } from '../DailyStats';
import { PaymentAlertsCard } from '../PaymentAlertsCard';
import { QuickTodoWidget } from '../QuickTodoWidget';

export const DesktopDashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Primary Column: Today's Timeline, AI Summaries & Tomorrow's Lessons (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Daily Inspiration */}
        <InspirationCardWidget />

        {/* Today's Progress Timeline */}
        <TodaysProgressTimeline />

        {/* Smart Daily Summary */}
        <SmartDailySummaryWidget />

        {/* Tomorrow's Lessons & Homework Follow Up in 2 sub-cols on wide desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TomorrowsLessonsWidget />
          <HomeworkFollowUpWidget />
        </div>
      </div>

      {/* Secondary Column: Stats, Financial Alerts, To-Dos, and Free Slots (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        {/* Quick Todo Scratchpad */}
        <QuickTodoWidget />

        {/* Performance & Revenue Metrics */}
        <DailyStats />

        {/* Urgent Payment Alerts */}
        <PaymentAlertsCard />

        {/* Available Today Time Slots */}
        <AvailableTodayWidget />
      </div>
    </div>
  );
};
