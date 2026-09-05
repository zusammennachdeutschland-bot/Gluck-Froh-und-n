import React from 'react';
import { WeeklyOverviewWidget } from './WeeklyOverviewWidget';
import { MonthlyOverviewWidget } from './MonthlyOverviewWidget';

export const DailyStats: React.FC = () => {
  return (
    <div className="space-y-3">
      {/* Weekly Overview (Friday to Thursday) */}
      <WeeklyOverviewWidget />

      {/* Refined Monthly Overview */}
      <MonthlyOverviewWidget />
    </div>
  );
};
