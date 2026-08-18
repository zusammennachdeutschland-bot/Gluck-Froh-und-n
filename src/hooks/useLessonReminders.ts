import { isPendingStatus } from "../utils/lessonUtils";
import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { sendSystemNotification, getNotificationPermission } from '../services/notificationService';
import { formatLocalDate } from '../utils/timeUtils';

export const useLessonReminders = () => {
  const { lessons, profile } = useApp();

  useEffect(() => {
    try {
      if (!profile || (profile.enableLessonAlerts === false && profile.enableBrowserPush === false)) return;

      const checkReminders = async () => {
        try {
          const perm = await getNotificationPermission();
          if (perm !== 'granted') return;

          const now = new Date();
          const todayStr = formatLocalDate(now);
          const nowMins = now.getHours() * 60 + now.getMinutes();

          // 1. Upcoming lesson starting in 15-30 minutes
          const upcoming = lessons?.find(l => {
            if (!l || !l.time || typeof l.time !== 'string') return false;
            if (l.date !== todayStr || l.status !== 'scheduled') return false;
            const parts = l.time.split(':').map(n => parseInt(n, 10));
            if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return false;
            const lMins = parts[0] * 60 + parts[1];
            const diff = lMins - nowMins;
            return diff >= 0 && diff <= 30;
          });

          if (upcoming) {
            const notifKey = `rem_upcoming_${upcoming.id}_${todayStr}`;
            if (!sessionStorage.getItem(notifKey)) {
              sendSystemNotification(
                `⏰ Nächste Lektion in Kürze: ${upcoming.groupName || upcoming.title || 'Lektion'}`,
                `Startet um ${upcoming.time} Uhr (${upcoming.type === 'online' ? 'Online Zoom/Meet' : 'Präsenz'}).`,
                `upcoming-${upcoming.id}`
              );
              sessionStorage.setItem(notifKey, '1');
            }
          }

          // 2. Pending past lessons reminder
          const pastPending = lessons?.filter(l => l && l.date && l.date < todayStr && isPendingStatus(l.status)) || [];
          if (pastPending.length > 0) {
            const notifKey = `rem_past_pending_${todayStr}`;
            if (!sessionStorage.getItem(notifKey)) {
              sendSystemNotification(
                `⚠️ Offene Lektionen erfordern Bericht`,
                `Sie haben ${pastPending.length} vergangene Lektionen, die noch als ausstehend markiert sind.`,
                'past-pending'
              );
              sessionStorage.setItem(notifKey, '1');
            }
          }
        } catch (err) {
          console.warn('Error checking reminders:', err);
        }
      };

      checkReminders();
      const interval = setInterval(checkReminders, 5 * 60 * 1000);

      return () => clearInterval(interval);
    } catch (err) {
      console.warn('useLessonReminders effect error:', err);
    }
  }, [lessons, profile]);
};

