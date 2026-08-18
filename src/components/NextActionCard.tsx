import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { isPendingStatus } from '../utils/lessonUtils';
import { formatLocalDate } from '../utils/timeUtils';
import { Video, MapPin, Play, Sparkles, ChevronRight, Users, User } from 'lucide-react';

export const NextActionCard: React.FC = () => {
  const { lessons, openLessonControl, dismissedDashboardLessonIds, t } = useApp();
  const [filterPeriod, setFilterPeriod] = useState<'heute' | 'morgen' | 'woche'>('heute');
  const [filterType, setFilterType] = useState<'alle' | 'online' | 'offline'>('alle');

  const todayStr = formatLocalDate();

  const filteredLessons = lessons.filter(l => {
    if (dismissedDashboardLessonIds.includes(l.id)) return false;
    if (!isPendingStatus(l.status)) return false;
    if (filterPeriod === 'heute' && l.date !== todayStr) return false;
    if (filterType === 'online' && l.type !== 'online') return false;
    if (filterType === 'offline' && l.type !== 'offline') return false;
    return true;
  });

  const nextLesson = filteredLessons.find(l => isPendingStatus(l.status)) || filteredLessons[0];

  const calculateTimeRemaining = (timeStr: string) => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const lessonTime = new Date();
    lessonTime.setHours(hours, minutes, 0, 0);

    const diffMs = lessonTime.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0 && Math.abs(diffMins) < 60) return t('time_in_progress');
    if (diffMins >= 0 && diffMins <= 60) return `${t('time_starts_in')} ${diffMins}m`;
    if (diffMins > 60) return `${t('time_starts_at')} ${timeStr}`;
    return t('time_scheduled_today');
  };

  if (!nextLesson) {
    return (
      <div className="bg-surface-hover/60 border border-surface-border/80 dark:border-surface-border rounded-lg p-4 text-center">
        <p className="text-sm font-medium text-text-muted">{t('next_action_no_lessons')}</p>
      </div>
    );
  }

  const isGroup = nextLesson.groupName.includes('Gruppe') || !!nextLesson.groupId;
  const timeRemainingText = calculateTimeRemaining(nextLesson.time);

  return (
    <div className="space-y-3">
      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1 bg-surface-hover/80 p-1 rounded-xl">
          <button
            onClick={() => setFilterPeriod('heute')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterPeriod === 'heute'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-slate-900'
            }`}
          >
            {t('next_action_today')}
          </button>
          <button
            onClick={() => setFilterPeriod('morgen')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterPeriod === 'morgen'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-slate-900'
            }`}
          >
            {t('next_action_tomorrow')}
          </button>
          <button
            onClick={() => setFilterPeriod('woche')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterPeriod === 'woche'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-slate-900'
            }`}
          >
            {t('next_action_this_week')}
          </button>
        </div>

        <div className="flex items-center gap-1 bg-surface-hover/80 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('alle')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterType === 'alle'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'text-text-muted'
            }`}
          >
            {t('next_action_all')}
          </button>
          <button
            onClick={() => setFilterType('online')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterType === 'online'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted'
            }`}
          >
            {t('next_action_online')}
          </button>
          <button
            onClick={() => setFilterType('offline')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterType === 'offline'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted'
            }`}
          >
            {t('next_action_offline')}
          </button>
        </div>
      </div>

      {/* Next Action Compact Card */}
      <div className="bg-background/70 dark:bg-surface/50 border border-surface-border/60 dark:border-surface-border/80 rounded-lg p-4 shadow-2xs relative">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-primary dark:text-primary" />
            <span>{t('next_action_title')}</span>
            <span className="bg-surface-hover text-text-main text-[10px] px-2 py-0.5 rounded-md font-mono font-bold">
              {timeRemainingText}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {nextLesson.type === 'online' ? (
              <span className="bg-primary-soft dark:bg-primary-soft/60 text-primary dark:text-primary/70 border border-primary-border dark:border-primary-border/50 text-[10px] px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 active:scale-95 transition-all hover:bg-primary/20">
                <Video className="w-3 h-3" />
                {t('next_action_online')}
              </span>
            ) : (
              <span className="bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border dark:border-primary-border text-[10px] px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {t('next_action_offline')}
              </span>
            )}
          </div>
        </div>

        {/* Lesson Details & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
              isGroup ? 'bg-primary' : 'bg-primary'
            }`}>
              {isGroup ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>

            <div>
              <h3 className="text-sm font-black text-text-main leading-snug">
                {nextLesson.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                <span className="font-bold text-text-main">{nextLesson.time}</span>
                <span>•</span>
                <span className="bg-surface-hover text-text-main font-bold px-1.5 py-0.5 rounded text-[10px]">
                  Session {nextLesson.sessionNumber} / {nextLesson.totalSessionsInPackage}
                </span>
                <span>•</span>
                <span>{nextLesson.grade}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => openLessonControl(nextLesson)}
            className="w-full sm:w-auto bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 hover:shadow-lg hover:shadow-primary/30"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{t('next_action_open')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
