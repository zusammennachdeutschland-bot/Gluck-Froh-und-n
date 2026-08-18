import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Importance } from '@capacitor/local-notifications';
import { 
  NotificationSettings, Lesson, Group, Student, PaymentRecord, 
  ScheduledNotificationItem, NotificationPriority, NotificationSound 
} from '../types';
import { formatLocalDate } from '../utils/timeUtils';

export interface NotificationActionHandler {
  onEndLesson?: () => void;
  onOpenLesson?: () => void;
  onCancelLesson?: () => void;
}

let activeNotification: any = null;
let isChannelCreated = false;

// Helper to convert priority level to Android Importance enum/value
const getImportanceFromPriority = (priority: NotificationPriority): Importance => {
  switch (priority) {
    case 'low': return 2 as Importance;
    case 'normal': return 3 as Importance;
    case 'high': return 4 as Importance;
    case 'max': return 5 as Importance;
    default: return 3 as Importance;
  }
};

// Helper to convert sound option to sound filename or default
const getSoundFilename = (sound: NotificationSound): string | undefined => {
  if (sound === 'default') return undefined;
  return `${sound}.wav`;
};

// Initialize Notification Channels for Android 8.0+
export const initNotificationChannels = async (settings?: NotificationSettings) => {
  if (Capacitor.isNativePlatform() && !isChannelCreated) {
    try {
      // 1. Lesson Reminders Channel
      await LocalNotifications.createChannel({
        id: 'lessons_reminders',
        name: 'Lesson Reminders & Active Timers',
        description: 'Notifications for class reminders and running lesson timer',
        importance: settings ? getImportanceFromPriority(settings.lessonReminder.priority) : 4,
        visibility: 1,
        sound: settings ? getSoundFilename(settings.lessonReminder.sound) : 'beep.wav',
        vibration: true,
      });

      // 2. Lesson Start Channel
      await LocalNotifications.createChannel({
        id: 'lesson_start',
        name: 'Lesson Start Alerts',
        description: 'Notifications when a lesson time arrives',
        importance: settings ? getImportanceFromPriority(settings.lessonStart.priority) : 5,
        visibility: 1,
        sound: settings ? getSoundFilename(settings.lessonStart.sound) : 'default',
        vibration: true,
      });

      // 3. Payment Due Channel
      await LocalNotifications.createChannel({
        id: 'payment_due',
        name: 'Payment Due Reminders',
        description: 'Notifications for student pending payments and package renewals',
        importance: settings ? getImportanceFromPriority(settings.paymentDue.priority) : 3,
        visibility: 1,
        sound: settings ? getSoundFilename(settings.paymentDue.sound) : 'default',
        vibration: true,
      });

      // 4. Daily Summary Channel
      await LocalNotifications.createChannel({
        id: 'daily_summary',
        name: 'Daily Summary Reports',
        description: 'Notifications for daily teacher schedule and earnings summary',
        importance: settings ? getImportanceFromPriority(settings.dailySummary.priority) : 3,
        visibility: 1,
        sound: settings ? getSoundFilename(settings.dailySummary.sound) : 'gentle.wav',
        vibration: true,
      });

      // 5. Attendance Reminder Channel
      await LocalNotifications.createChannel({
        id: 'attendance_reminder',
        name: 'Attendance Reminders',
        description: 'Reminders to log student attendance after class',
        importance: settings ? getImportanceFromPriority(settings.attendanceReminder.priority) : 3,
        visibility: 1,
        sound: settings ? getSoundFilename(settings.attendanceReminder.sound) : 'chime.wav',
        vibration: true,
      });

      isChannelCreated = true;
    } catch (err) {
      console.warn('Failed to create notification channels:', err);
    }
  }
};

export const isNotificationSupported = (): boolean => {
  if (Capacitor.isNativePlatform()) return true;
  try {
    return typeof window !== 'undefined' && 'Notification' in window && !!window.Notification;
  } catch {
    return false;
  }
};

export const getNotificationPermission = async (): Promise<string> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display; // 'granted' | 'denied' | 'prompt'
    } catch {
      return 'denied';
    }
  }

  try {
    if (!isNotificationSupported()) return 'denied';
    return Notification.permission;
  } catch {
    return 'denied';
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannels();
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (err) {
      console.warn('Failed to request native notification permissions:', err);
      return false;
    }
  }

  try {
    if (!isNotificationSupported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return false;
  }
};

export const openAndroidNotificationSettings = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.requestPermissions();
    } catch (e) {
      console.warn('Could not open Android settings:', e);
    }
  }
};

/**
 * Updates the persistent notification for a running lesson session.
 */
export const updateActiveLessonNotification = async (data: {
  groupName: string;
  grade?: string;
  elapsedMinutes: number;
  remainingMinutes?: number;
  startTimeStr: string;
  lessonTitle: string;
  handlers?: NotificationActionHandler;
}) => {
  const { groupName, grade, elapsedMinutes, remainingMinutes, startTimeStr, lessonTitle, handlers } = data;
  const title = `📚 ${groupName}${grade ? ` (${grade})` : ''}`;
  const remText = remainingMinutes !== undefined && remainingMinutes >= 0 ? ` • ${remainingMinutes} min left` : '';
  const body = `⏱ ${elapsedMinutes} min elapsed${remText}\n🕒 Started ${startTimeStr}`;

  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannels();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9999, // Constant ID for active lesson so it gets overwritten
            title,
            body,
            channelId: 'lessons_reminders',
            schedule: { at: new Date(Date.now() + 100) },
            extra: { lessonTitle, groupName },
            ongoing: true, // Keep notification persistent on Android
            autoCancel: false,
          }
        ]
      });
    } catch (err) {
      console.warn('Native notification update failed:', err);
    }
  } else {
    try {
      const perm = await getNotificationPermission();
      if (perm !== 'granted') return;

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/badge-72x72.png',
            tag: 'active-lesson-timer',
            renotify: false,
            requireInteraction: true,
            actions: [
              { action: 'end_lesson', title: '⏹ End' },
              { action: 'open_lesson', title: '📱 Open' },
              { action: 'cancel_lesson', title: '✕ Cancel' }
            ],
            data: { lessonTitle, groupName }
          } as any);
        }).catch(() => {
          fallbackStandardNotification(title, body, handlers);
        });
      } else {
        fallbackStandardNotification(title, body, handlers);
      }
    } catch (err) {
      console.warn('Could not update active notification:', err);
    }
  }

  // Also sync with MediaSession API for lock screen timer display
  updateMediaSessionLockscreen(groupName, `⏱ ${elapsedMinutes} min elapsed`, handlers);
};

const fallbackStandardNotification = (
  title: string, 
  body: string, 
  handlers?: NotificationActionHandler
) => {
  try {
    if (activeNotification) {
      try {
        activeNotification.close();
      } catch {}
    }

    activeNotification = new Notification(title, {
      body,
      tag: 'active-lesson-timer',
      icon: '/pwa-192x192.png',
      requireInteraction: true,
      silent: true
    });

    activeNotification.onclick = (e: any) => {
      try {
        if (e && e.preventDefault) e.preventDefault();
        window.focus();
        if (handlers?.onOpenLesson) handlers.onOpenLesson();
      } catch {}
    };
  } catch (err) {
    console.warn('Standard notification fallback error:', err);
  }
};

const clearMediaSession = () => {
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none';
    } catch {}
  }
};

export const clearActiveLessonNotification = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
    } catch {}
  } else {
    try {
      if (activeNotification) {
        try {
          activeNotification.close();
        } catch {}
        activeNotification = null;
      }

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.getNotifications({ tag: 'active-lesson-timer' }).then(notifs => {
            notifs.forEach(n => n.close());
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch {}
  }

  clearMediaSession();
};

/**
 * System notification helpers for alerts and reminders
 */
export const sendSystemNotification = async (title: string, body: string, tag: string = 'general') => {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannels();
      const notifId = Math.floor(Math.random() * 100000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId: 'lessons_reminders',
            schedule: { at: new Date(Date.now() + 100) },
          }
        ]
      });
    } catch (err) {
      console.warn('Native sendSystemNotification failed:', err);
    }
  } else {
    try {
      const perm = await getNotificationPermission();
      if (perm !== 'granted') return;

      new Notification(title, {
        body,
        tag,
        icon: '/pwa-192x192.png'
      });
    } catch (err) {
      console.warn('Browser notification error:', err);
    }
  }
};

/**
 * Schedule future local notification (e.g. for upcoming lesson reminders)
 */
export const scheduleLocalNotification = async (
  id: number,
  title: string,
  body: string,
  scheduleDate: Date
) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannels();
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            channelId: 'lessons_reminders',
            schedule: { at: scheduleDate },
          }
        ]
      });
    } catch (err) {
      console.warn('Failed to schedule native local notification:', err);
    }
  }
};

/**
 * Integrates MediaSession API so lockscreen / audio bar displays running lesson
 */
const updateMediaSessionLockscreen = (
  title: string, 
  body: string, 
  handlers?: NotificationActionHandler
) => {
  try {
    if (
      typeof window === 'undefined' || 
      !('mediaSession' in navigator) || 
      !('MediaMetadata' in window) ||
      !window.MediaMetadata
    ) {
      return;
    }

    // @ts-ignore
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title,
      artist: body,
      album: 'Glück fröhlich und froh',
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      try {
        if (handlers?.onEndLesson) handlers.onEndLesson();
      } catch {}
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      try {
        if (handlers?.onEndLesson) handlers.onEndLesson();
      } catch {}
    });
  } catch (e) {
    console.warn('MediaSession update failed:', e);
  }
};

// Deterministic numeric ID generator from string
const generateDeterministicId = (str: string, offset: number = 0): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 800000) + 100000 + offset;
};

// Key for web fallback scheduled notifications
const WEB_SCHEDULED_NOTIFS_KEY = 'dl_web_scheduled_notifications';

/**
 * Get all pending scheduled local notifications
 */
export const getPendingScheduledNotifications = async (): Promise<ScheduledNotificationItem[]> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications
        .filter(n => n.id !== 9999) // Exclude persistent active timer
        .map(n => ({
          id: n.id,
          title: n.title || 'تنبيه مجدول',
          body: n.body || '',
          scheduledAt: n.schedule?.at ? new Date(n.schedule.at).toLocaleString('ar-EG') : 'قريباً',
          category: n.extra?.category || 'general',
          extra: n.extra
        }));
    } catch (err) {
      console.warn('Failed to fetch pending native notifications:', err);
      return [];
    }
  }

  try {
    const raw = localStorage.getItem(WEB_SCHEDULED_NOTIFS_KEY);
    if (!raw) return [];
    const items: ScheduledNotificationItem[] = JSON.parse(raw);
    const now = Date.now();
    // Filter out past items
    return items.filter(item => new Date(item.extra?.atEpoch || 0).getTime() > now);
  } catch {
    return [];
  }
};

/**
 * Cancel a specific scheduled notification by ID
 */
export const cancelScheduledNotification = async (id: number): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (err) {
      console.warn('Failed to cancel native notification:', err);
    }
  }

  try {
    const raw = localStorage.getItem(WEB_SCHEDULED_NOTIFS_KEY);
    if (raw) {
      const items: ScheduledNotificationItem[] = JSON.parse(raw);
      const filtered = items.filter(item => item.id !== id);
      localStorage.setItem(WEB_SCHEDULED_NOTIFS_KEY, JSON.stringify(filtered));
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Cancel all pending scheduled notifications (excluding running active timer #9999)
 */
export const cancelAllScheduledNotifications = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => n.id !== 9999).map(n => ({ id: n.id }));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }
    } catch (err) {
      console.warn('Failed to cancel all native notifications:', err);
    }
  }

  try {
    localStorage.removeItem(WEB_SCHEDULED_NOTIFS_KEY);
    return true;
  } catch {
    return false;
  }
};

/**
 * Rebuilds all notification schedules based on current notification settings and app data.
 * Guarantees no duplicates, persists schedules across reboots/restarts, and respects all toggles.
 */
export const rebuildAllNotificationSchedules = async (
  settings: NotificationSettings,
  lessons: Lesson[],
  groups: Group[],
  students: Student[],
  payments: PaymentRecord[]
): Promise<{ count: number; nextScheduledTime: string | null }> => {
  // 1. First, clear all existing non-timer pending notifications
  await cancelAllScheduledNotifications();

  // 2. If master switch is OFF, return immediately
  if (!settings || !settings.masterEnabled) {
    return { count: 0, nextScheduledTime: null };
  }

  // 3. Re-init native channels with configured priority & sound
  await initNotificationChannels(settings);

  const nativeNotifsToSchedule: any[] = [];
  const webNotifsStore: ScheduledNotificationItem[] = [];
  const now = Date.now();
  let earliestEpoch: number | null = null;

  // Helper to register a notification
  const addNotification = (
    id: number,
    title: string,
    body: string,
    scheduleDate: Date,
    channelId: string,
    category: 'lessonReminder' | 'lessonStart' | 'paymentDue' | 'dailySummary' | 'attendanceReminder',
    extraData: Record<string, any> = {}
  ) => {
    const atEpoch = scheduleDate.getTime();
    if (atEpoch <= now) return; // Ignore past dates

    if (earliestEpoch === null || atEpoch < earliestEpoch) {
      earliestEpoch = atEpoch;
    }

    nativeNotifsToSchedule.push({
      id,
      title,
      body,
      channelId,
      schedule: { at: scheduleDate },
      extra: { ...extraData, category, atEpoch }
    });

    webNotifsStore.push({
      id,
      title,
      body,
      scheduledAt: scheduleDate.toLocaleString('ar-EG', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      category,
      extra: { ...extraData, atEpoch }
    });
  };

  // -------------------------------------------------------------
  // A. LESSON REMINDERS, LESSON START & ATTENDANCE REMINDERS
  // -------------------------------------------------------------
  const upcomingLessons = lessons.filter(l => l.status === 'scheduled' || l.status === 'in_progress');

  for (const lesson of upcomingLessons) {
    if (!lesson.date || !lesson.time) continue;

    // Parse lesson date & time (e.g. "2026-08-11" & "15:00")
    const cleanTime = lesson.time.includes(':') ? lesson.time : `${lesson.time}:00`;
    const lessonStartEpoch = new Date(`${lesson.date}T${cleanTime.padStart(5, '0')}:00`).getTime();

    if (isNaN(lessonStartEpoch)) continue;

    // 1. Lesson Reminder (X minutes before)
    if (settings.lessonReminder.enabled) {
      const minutesBefore = settings.lessonReminderMinutesBefore || 15;
      const reminderEpoch = lessonStartEpoch - minutesBefore * 60 * 1000;
      if (reminderEpoch > now) {
        addNotification(
          generateDeterministicId(`rem_${lesson.id}`, 10000),
          `⏰ تذكير بموعد الحصّة: ${lesson.groupName}`,
          `حصّة ${lesson.groupName} تبدأ بعد ${minutesBefore} دقيقة (الساعة ${lesson.time})`,
          new Date(reminderEpoch),
          'lessons_reminders',
          'lessonReminder',
          { lessonId: lesson.id, groupName: lesson.groupName }
        );
      }
    }

    // 2. Lesson Start Alert
    if (settings.lessonStart.enabled) {
      if (lessonStartEpoch > now) {
        addNotification(
          generateDeterministicId(`start_${lesson.id}`, 20000),
          `🔔 حان موعد الحصّة الآن: ${lesson.groupName}`,
          `بدأت الآن حصّة ${lesson.groupName} (${lesson.title || 'مجموعة ' + lesson.groupName})`,
          new Date(lessonStartEpoch),
          'lesson_start',
          'lessonStart',
          { lessonId: lesson.id, groupName: lesson.groupName }
        );
      }
    }

    // 3. Attendance Logging Reminder
    if (settings.attendanceReminder.enabled) {
      const duration = lesson.durationMinutes || 60;
      const attendanceRemEpoch = lessonStartEpoch + duration * 60 * 1000;
      if (attendanceRemEpoch > now) {
        addNotification(
          generateDeterministicId(`att_${lesson.id}`, 30000),
          `📝 تذكير بتسجيل الحضور والغياب: ${lesson.groupName}`,
          `لا تنسَ تسجيل حضور وغياب الطلاب لحصّة ${lesson.groupName}`,
          new Date(attendanceRemEpoch),
          'attendance_reminder',
          'attendanceReminder',
          { lessonId: lesson.id, groupName: lesson.groupName }
        );
      }
    }
  }

  // -------------------------------------------------------------
  // B. PAYMENT DUE REMINDERS
  // -------------------------------------------------------------
  if (settings.paymentDue.enabled) {
    const pendingStudents = students.filter(s => 
      s.status !== 'archived' && 
      (s.paymentStatus === 'pending' || (s.packageProgress ?? 0) >= (s.totalLessonsCount ?? 8))
    );

    // Schedule a bulk or individual payment reminder
    if (pendingStudents.length > 0) {
      // Schedule for tomorrow 10:00 AM
      const tomorrow10AM = new Date();
      tomorrow10AM.setDate(tomorrow10AM.getDate() + 1);
      tomorrow10AM.setHours(10, 0, 0, 0);

      addNotification(
        40001,
        `💰 تذكير بالمدفوعات المستحقة (${pendingStudents.length} طلاب)`,
        `توجد مدفوعات وتجديدات اشتراك مستحقة لـ ${pendingStudents.length} من الطلاب.`,
        tomorrow10AM,
        'payment_due',
        'paymentDue',
        { studentCount: pendingStudents.length }
      );
    }
  }

  // -------------------------------------------------------------
  // C. DAILY SUMMARY NOTIFICATION
  // -------------------------------------------------------------
  if (settings.dailySummary.enabled) {
    const timeStr = settings.dailySummaryTime || '20:00';
    const [hrs, mins] = timeStr.split(':').map(Number);

    const summaryDate = new Date();
    summaryDate.setHours(hrs || 20, mins || 0, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (summaryDate.getTime() <= now) {
      summaryDate.setDate(summaryDate.getDate() + 1);
    }

    const todayStr = formatLocalDate();
    const todayLessons = lessons.filter(l => l.date === todayStr);

    let summaryText = 'ملخص اليوم: ';
    const parts: string[] = [];

    if (settings.dailySummaryIncludeLessons) {
      parts.push(`${todayLessons.length} حصص اليوم`);
    }
    if (settings.dailySummaryIncludePendingPayments) {
      const pendingCount = students.filter(s => s.paymentStatus === 'pending').length;
      parts.push(`${pendingCount} مدفوعات معلقة`);
    }

    summaryText += parts.join(' • ') || 'تأكد من مراجعة جدول الغد';

    addNotification(
      50001,
      `📊 الملخص اليومي للمعلم`,
      summaryText,
      summaryDate,
      'daily_summary',
      'dailySummary'
    );
  }

  // -------------------------------------------------------------
  // SCHEDULE NATIVELY OR SAVE TO WEB STORAGE
  // -------------------------------------------------------------
  if (Capacitor.isNativePlatform() && nativeNotifsToSchedule.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications: nativeNotifsToSchedule });
    } catch (err) {
      console.warn('Native LocalNotifications.schedule error:', err);
    }
  }

  // Save web fallback queue
  localStorage.setItem(WEB_SCHEDULED_NOTIFS_KEY, JSON.stringify(webNotifsStore));

  const nextScheduledTimeStr = earliestEpoch
    ? new Date(earliestEpoch).toLocaleString('ar-EG', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return {
    count: webNotifsStore.length,
    nextScheduledTime: nextScheduledTimeStr
  };
};
