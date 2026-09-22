import { isPendingStatus } from "../utils/lessonUtils";
import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { sendSystemNotification, getNotificationPermission, requestNotificationPermission } from '../services/notificationService';
import { formatLocalDate } from '../utils/timeUtils';

export const useLessonReminders = () => {
  const { 
    lessons, profile, notificationSettings, 
    triggerLessonAlarm, activeAlarmLesson, snoozedLessonAlarmMap,
    language, _t 
  } = useApp();

  const lastTriggeredLessonIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (!profile || (profile.enableLessonAlerts === false && profile.enableBrowserPush === false && !notificationSettings.masterEnabled)) return;

      const checkReminders = async () => {
        try {
          const now = new Date();
          const todayStr = formatLocalDate(now);
          const nowMins = now.getHours() * 60 + now.getMinutes();
          const minutesBefore = notificationSettings.lessonReminderMinutesBefore || 15;

          // 1. Upcoming lesson starting soon (e.g. within minutesBefore)
          const upcoming = lessons?.find(l => {
            if (!l || !l.time || typeof l.time !== 'string') return false;
            if (l.date !== todayStr || l.status !== 'scheduled') return false;
            const parts = l.time.split(':').map(n => parseInt(n, 10));
            if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return false;
            const lMins = parts[0] * 60 + parts[1];
            const diff = lMins - nowMins;
            return diff >= 0 && diff <= minutesBefore;
          });

          if (upcoming) {
            const notifKey = `rem_upcoming_${upcoming.id}_${todayStr}`;
            const isNotified = sessionStorage.getItem(notifKey);
            const snoozedUntil = snoozedLessonAlarmMap[upcoming.id];
            const isSnoozedActive = snoozedUntil && Date.now() < snoozedUntil;

            // Trigger Alarm if enabled and not currently snoozed
            if (!isSnoozedActive && !activeAlarmLesson && notificationSettings.alarmModeEnabled !== false) {
              if (lastTriggeredLessonIdRef.current !== upcoming.id || !isNotified) {
                lastTriggeredLessonIdRef.current = upcoming.id;
                triggerLessonAlarm(upcoming);
              }
            }

            // Send system/browser notification to pop up outside the app (Heads-up / Lockscreen)
            if (!isNotified) {
              let perm = await getNotificationPermission();
              if (perm !== 'granted' && perm !== 'denied') {
                const granted = await requestNotificationPermission();
                perm = granted ? 'granted' : 'denied';
              }
              if (perm === 'granted') {
                const displayName = upcoming.groupName || upcoming.studentName || upcoming.title || (language === 'ar' ? 'الحصة' : language === 'de' ? 'Lektion' : 'Lesson');
                const title = language === 'ar'
                  ? `⏰ تذكير بموعد الحصة: ${displayName}`
                  : language === 'de'
                  ? `⏰ Nächste Lektion in Kürze: ${displayName}`
                  : `⏰ Upcoming Lesson Reminder: ${displayName}`;
                const body = language === 'ar'
                  ? `تبدأ الساعة ${upcoming.time} (${upcoming.type === 'online' ? 'أونلاين' : 'حضوري'}). المنبه جاهز!`
                  : language === 'de'
                  ? `Startet um ${upcoming.time} Uhr (${upcoming.type === 'online' ? 'Online' : 'Präsenz'}).`
                  : `Starts at ${upcoming.time} (${upcoming.type === 'online' ? 'Online' : 'Offline/In-person'}).`;

                await sendSystemNotification(
                  title,
                  body,
                  `upcoming-${upcoming.id}`,
                  { lessonId: upcoming.id, groupName: displayName, isAlarm: true },
                  'LESSON_ALARM_ACTIONS'
                );
                sessionStorage.setItem(notifKey, '1');
              } else if (perm === 'denied') {
                sessionStorage.setItem(notifKey, '1');
              }
            }
          }

          // 2. Pending past lessons reminder (once a day)
          const pastPending = lessons?.filter(l => l && l.date && l.date < todayStr && isPendingStatus(l.status)) || [];
          if (pastPending.length > 0) {
            const notifKey = `rem_past_pending_${todayStr}`;
            if (!sessionStorage.getItem(notifKey)) {
              const perm = await getNotificationPermission();
              if (perm === 'granted') {
                sendSystemNotification(
                  language === 'ar' 
                    ? `⚠️ حصص سابقة معلقة تتطلب تقريراً` 
                    : language === 'de' 
                    ? `⚠️ Offene Lektionen erfordern Bericht` 
                    : `⚠️ Pending Past Lessons Require Report`,
                  language === 'ar' 
                    ? `لديك ${pastPending.length} حصص ماضية لا تزال معلقة بحاجة للإكمال أو التقرير.` 
                    : language === 'de' 
                    ? `Sie haben ${pastPending.length} vergangene Lektionen, die noch als ausstehend markiert sind.` 
                    : `You have ${pastPending.length} past lessons pending completion or report.`,
                  'past-pending'
                );
              }
              sessionStorage.setItem(notifKey, '1');
            }
          }
        } catch (err) {
          console.warn('Error checking reminders:', err);
        }
      };

      checkReminders();
      // Check every 20 seconds to catch exact reminder minutes reliably
      const interval = setInterval(checkReminders, 20 * 1000);

      return () => clearInterval(interval);
    } catch (err) {
      console.warn('useLessonReminders effect error:', err);
    }
  }, [lessons, profile, notificationSettings, triggerLessonAlarm, activeAlarmLesson, snoozedLessonAlarmMap, language]);
};

