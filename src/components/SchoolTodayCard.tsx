import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getSchoolSettings, calculatePeriodsTimings, parseTimeToMinutes } from '../utils/schoolUtils';
import { Clock, ChevronRight, CheckCircle2, Calendar, BookOpen, AlertCircle } from 'lucide-react';

export const SchoolTodayCard: React.FC = () => {
  const { profile, setActiveTab, _t, language } = useApp();

  // 1. Get Cairo Local Time helper
  const getCairoNow = () => {
    const now = new Date();
    // Format current time explicitly in Africa/Cairo
    const cairoString = now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' });
    const cairoDate = new Date(cairoString);

    const year = cairoDate.getFullYear();
    const month = String(cairoDate.getMonth() + 1).padStart(2, '0');
    const date = String(cairoDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${date}`; // YYYY-MM-DD

    const hours = cairoDate.getHours();
    const minutes = cairoDate.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Sunday is '0', Monday is '1', ..., Saturday is '6'
    const dayOfWeekStr = String(cairoDate.getDay());

    return { dateStr, dayOfWeekStr, currentMinutes, timeStr };
  };

  const [cairoNow, setCairoNow] = useState(getCairoNow());

  // 2. Real-time timer: Updates every 15 seconds to ensure seamless transition of periods
  useEffect(() => {
    const timer = setInterval(() => {
      setCairoNow(getCairoNow());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const {
    showCard,
    totalClassesToday,
    totalLessonsToday,
    currentLesson,
    upcomingLessons,
    completedLessons,
    filledTimeline = []
  } = useMemo(() => {
    const currentSettings = getSchoolSettings(profile);
    const dayKey = cairoNow.dayOfWeekStr;
    const isDayActive = currentSettings.presence[dayKey]?.active;

    // Retrieve today's school records
    const todayRecords = currentSettings.schedule[dayKey] || [];
    const scheduledRecords = todayRecords.filter(r => r.subjectName || r.className);

    // If there is no schedule or it's empty, do not show the card
    if (!isDayActive || scheduledRecords.length === 0) {
      return {
        showCard: false,
        totalClassesToday: 0,
        totalLessonsToday: 0,
        currentLesson: null,
        upcomingLessons: [],
        completedLessons: [],
        nextLesson: null,
        minutesToNextLesson: 0,
        isSchoolActive: false,
        filledTimeline: []
      };
    }

    // Get calculated periods
    const calculatedPeriods = calculatePeriodsTimings(currentSettings.periodSettings);

    // Build timeline matching scheduled lessons
    const timeline = calculatedPeriods.map(period => {
      const record = todayRecords.find(r => r.periodNumber === period.periodNumber);
      const isFilled = record && (record.subjectName || record.className);
      const startMin = parseTimeToMinutes(period.startTime);
      const endMin = parseTimeToMinutes(period.endTime);

      return {
        period,
        record,
        isFilled: !!isFilled,
        startMin,
        endMin
      };
    });

    const filledTimeline = timeline.filter(item => item.isFilled);

    // Classify lessons based on cairoNow.currentMinutes
    const currentMinutes = cairoNow.currentMinutes;

    const currentItem = filledTimeline.find(
      item => currentMinutes >= item.startMin && currentMinutes < item.endMin
    );

    const upcomingItems = filledTimeline.filter(item => currentMinutes < item.startMin);
    const completedItems = filledTimeline.filter(item => currentMinutes >= item.endMin);

    // Calculate school day end time (either departure time or the end of the last period/lesson)
    const presenceConfig = currentSettings.presence[dayKey];
    const departureMinutes = presenceConfig?.departureTime ? parseTimeToMinutes(presenceConfig.departureTime) : 0;
    
    // Find the end time of the last scheduled lesson today
    const lastLessonEndMinutes = filledTimeline.length > 0
      ? Math.max(...filledTimeline.map(item => item.endMin))
      : 0;

    // The effective school end is the maximum of departure time and the last lesson's end
    const effectiveSchoolEndMinutes = Math.max(departureMinutes, lastLessonEndMinutes);

    // If all lessons are finished AND the school day end time has passed, do not show the card
    const isSchoolDayEnded = effectiveSchoolEndMinutes > 0 && currentMinutes >= effectiveSchoolEndMinutes && upcomingItems.length === 0 && !currentItem;

    if (isSchoolDayEnded) {
      return {
        showCard: false,
        totalClassesToday: 0,
        totalLessonsToday: 0,
        currentLesson: null,
        upcomingLessons: [],
        completedLessons: [],
        nextLesson: null,
        minutesToNextLesson: 0,
        isSchoolActive: false,
        filledTimeline: []
      };
    }

    // Calculate unique classes/groups for today
    const uniqueClasses = new Set<string>();
    scheduledRecords.forEach(r => {
      if (r.className && r.className.trim()) {
        uniqueClasses.add(r.className.trim());
      }
    });

    // Find next lesson and remaining time
    let nextItem = null;
    let minsToNext = 0;
    if (upcomingItems.length > 0) {
      nextItem = upcomingItems[0];
      minsToNext = nextItem.startMin - currentMinutes;
    }

    return {
      showCard: true,
      totalClassesToday: uniqueClasses.size,
      totalLessonsToday: scheduledRecords.length,
      currentLesson: currentItem || null,
      upcomingLessons: upcomingItems,
      completedLessons: completedItems,
      nextLesson: nextItem,
      minutesToNextLesson: minsToNext,
      isSchoolActive: isDayActive,
      filledTimeline
    };
  }, [profile, cairoNow]);

  // If no classes are scheduled or school is not active today, return null to keep dashboard clean
  if (!showCard) {
    return null;
  }

  const isRtl = language === 'ar';

  return (
    <div
      onClick={() => setActiveTab('schoolSchedule')}
      className="bg-surface border border-surface-border rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-all cursor-pointer text-start"
      id="school-today-card"
    >
      {/* 1. Header Block */}
      <div className="flex items-center justify-between pb-1.5 border-b border-surface-border/60">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🏫</span>
          <h3 className="text-xs font-black text-text-main tracking-wider uppercase">
            {_t('مدرستي اليوم', 'My School Today', 'Meine Schule heute')}
          </h3>
          <span className="text-[9px] text-text-muted font-bold px-1.5 py-0.5 rounded bg-surface-hover">
            {_t(
              `${totalClassesToday} فصول • ${totalLessonsToday} حصص`,
              `${totalClassesToday} Classes • ${totalLessonsToday} Lessons`,
              `${totalClassesToday} Klassen • ${totalLessonsToday} Std.`
            )}
          </span>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-text-muted transition-transform group-hover:translate-x-0.5 ${isRtl ? 'rotate-180' : ''}`} />
      </div>

      {/* 2. Compact Rows Block */}
      <div className="space-y-1">
        {filledTimeline.map((item, idx) => {
          const isCurrent = currentLesson?.period.periodNumber === item.period.periodNumber;
          const isUpcoming = upcomingLessons.some(u => u.period.periodNumber === item.period.periodNumber);
          
          let statusDot = <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />;
          let rowBg = "bg-transparent";
          let textStyle = "text-text-muted font-medium";
          
          if (isCurrent) {
            statusDot = <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />;
            rowBg = "bg-emerald-500/10 dark:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20";
            textStyle = "text-text-main font-black";
          } else if (isUpcoming) {
            statusDot = <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />;
            textStyle = "text-text-main font-semibold";
          }

          return (
            <div key={idx} className={`flex items-center justify-between gap-2 py-1 px-1.5 rounded-md transition-all ${rowBg}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                {statusDot}
                <div className="text-[10px] font-black text-primary font-mono">
                  {_t(`ح${item.period.periodNumber}`, `P${item.period.periodNumber}`, `S${item.period.periodNumber}`)}
                </div>
                <div className={`text-xs truncate ${textStyle}`}>
                  {item.record?.className ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-xs font-black text-text-main">
                        {item.record.className}
                      </span>
                      {item.record.subjectName && (
                        <span className="text-[9px] text-primary font-bold bg-primary-soft border border-primary-border/50 px-1 py-0.2 rounded uppercase">
                          {item.record.subjectName}
                        </span>
                      )}
                    </span>
                  ) : (
                    item.record?.subjectName
                  )}
                </div>
              </div>
              <div className="text-[10px] font-mono font-bold text-text-muted shrink-0">
                {item.period.startTime} - {item.period.endTime}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Footer Navigation CTA */}
      <div className="pt-1.5 border-t border-surface-border/40 flex items-center justify-center text-[10px] font-black text-primary hover:text-primary-hover transition-colors gap-1">
        <span>{_t('عرض الجدول بالكامل', 'View Full Schedule', 'Vollständigen Plan anzeigen')}</span>
        <ChevronRight className={`w-3 h-3 ${isRtl ? 'rotate-180' : ''}`} />
      </div>
    </div>
  );
};
