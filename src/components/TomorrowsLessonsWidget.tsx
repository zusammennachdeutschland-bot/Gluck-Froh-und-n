import React from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { Calendar, Video, MapPin, Home, User, Clock, ChevronRight } from 'lucide-react';

export const TomorrowsLessonsWidget: React.FC = () => {
  const { lessons, openLessonControl, language, t } = useApp();

  // Helper for inline translations
  

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const tomorrowsLessons = lessons
    .filter(l => l.date === tomorrowStr && l.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time));

  const getTypeBadge = (type?: string, location?: string) => {
    let label = '';
    if (type === 'online') {
      label = t('auto_online');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft/60 px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <Video className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (type === 'center' || location === 'center') {
      label = t('auto_center');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <MapPin className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (type === 'home' || location === 'home') {
      label = t('auto_home');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <Home className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (type === 'private') {
      label = t('auto_private');
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
          <User className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    label = t('auto_in_person');
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted bg-surface-hover px-2 py-0.5 rounded-md border border-surface-border dark:border-surface-border-soft">
        <MapPin className="w-3 h-3" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="bg-surface border border-surface-border rounded-2xl p-4 shadow-2xs transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border dark:border-primary-border">
            <Calendar className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
            {t('tomorrows_lessons_title')}
          </h3>
        </div>
        <span className="text-[10px] font-extrabold bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary px-2.5 py-0.5 rounded-full font-mono">
          {tomorrowsLessons.length}
        </span>
      </div>

      {/* List */}
      {tomorrowsLessons.length === 0 ? (
        <div className="p-3 text-center bg-background dark:bg-background/50 rounded-xl border border-dashed border-surface-border">
          <p className="text-xs font-medium text-text-muted">
            {t('no_lessons_tomorrow')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tomorrowsLessons.map((lesson) => {
            const displayName = lesson.title || lesson.studentName || lesson.groupName || (t('auto_lesson'));
            return (
              <div
                key={lesson.id}
                onClick={() => openLessonControl(lesson)}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-background/80 hover:bg-slate-100 dark:bg-background/60 dark:hover:bg-slate-800/80 border border-surface-border/60 dark:border-surface-border/80 transition-all cursor-pointer"
              >
                {/* Left: Time & Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex items-center gap-1 text-text-main text-xs font-mono font-bold shrink-0 bg-surface px-2 py-1 rounded-lg border border-surface-border shadow-2xs">
                    <Clock className="w-3 h-3 text-primary" />
                    <span>{lesson.time}</span>
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {displayName}
                    </span>
                    
                  </div>
                </div>

                {/* Right: Type Badge & Arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  {getTypeBadge(lesson.type, lesson.location)}
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted/70 group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
