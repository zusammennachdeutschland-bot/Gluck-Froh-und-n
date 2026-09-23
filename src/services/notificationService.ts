import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Importance } from '@capacitor/local-notifications';
import { 
  NotificationSettings, Lesson, Group, Student, PaymentRecord, 
  ScheduledNotificationItem, NotificationPriority, NotificationSound 
} from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { getSchoolSettings, calculatePeriodsTimings } from '../utils/schoolUtils';

// Helper to construct Date object for Africa/Cairo wall clock times
export function getCairoDateWithTime(dateStr: string, timeStr: string): Date {
  const localDateStr = `${dateStr}T${timeStr.padStart(5, '0')}:00`;
  const targetDate = new Date(localDateStr);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(targetDate);
    const cairoParts: Record<string, number> = {};
    parts.forEach(p => {
      if (p.type !== 'literal') {
        cairoParts[p.type] = parseInt(p.value, 10);
      }
    });
    const cairoDate = new Date(
      cairoParts.year,
      cairoParts.month - 1,
      cairoParts.day,
      cairoParts.hour === 24 ? 0 : cairoParts.hour,
      cairoParts.minute,
      cairoParts.second || 0
    );
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hrs, mins] = timeStr.split(':').map(Number);
    const desiredDate = new Date(y, m - 1, d, hrs, mins, 0);
    const diffMs = desiredDate.getTime() - cairoDate.getTime();
    return new Date(targetDate.getTime() + diffMs);
  } catch (err) {
    return targetDate;
  }
}

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

// Helper to convert sound option to sound filename or default.
// Returning undefined instructs Android to use the device's default system sound reliably.
const getSoundFilename = (_sound: NotificationSound): string | undefined => {
  return undefined;
};

// Initialize Notification Channels for Android 8.0+
export const initNotificationChannels = async (settings?: NotificationSettings) => {
  if (Capacitor.isNativePlatform() && !isChannelCreated) {
    try {
      // 0. High-Priority Pre-Lesson Alarm Channel (Heads-up banner outside app + Lock screen)
      await LocalNotifications.createChannel({
        id: 'lesson_alarm',
        name: 'منبه مواعيد الحصص المسبقة (Lesson Alarms)',
        description: 'منبهات بارزة ورنين عالي لمواعيد الحصص القادمة تظهر فوق التطبيقات وعلى شاشة القفل',
        importance: 5 as Importance, // IMPORTANCE_MAX -> Heads-up banner outside app!
        visibility: 1 as any, // VISIBILITY_PUBLIC -> On lock screen
        vibration: true,
        lights: true,
        lightColor: '#EF4444'
      });

      // 1. Lesson Reminders Channel
      await LocalNotifications.createChannel({
        id: 'lessons_reminders',
        name: 'Lesson Reminders & Active Timers',
        description: 'Notifications for class reminders and running lesson timer',
        importance: 5 as Importance, // Elevated to MAX for outside app visibility
        visibility: 1 as any,
        vibration: true,
        lights: true,
        lightColor: '#3B82F6'
      });

      // 2. Lesson Start Channel
      await LocalNotifications.createChannel({
        id: 'lesson_start',
        name: 'Lesson Start Alerts',
        description: 'Notifications when a lesson time arrives',
        importance: 5 as Importance,
        visibility: 1 as any,
        vibration: true,
        lights: true,
        lightColor: '#10B981'
      });

      // 3. Payment Due Channel
      await LocalNotifications.createChannel({
        id: 'payment_due',
        name: 'Payment Due Reminders',
        description: 'Notifications for student pending payments and package renewals',
        importance: settings ? getImportanceFromPriority(settings.paymentDue.priority) : 3,
        visibility: 1 as any,
        vibration: true
      });

      // 4. Daily Summary Channel
      await LocalNotifications.createChannel({
        id: 'daily_summary',
        name: 'Daily Summary Reports',
        description: 'Notifications for daily teacher schedule and earnings summary',
        importance: settings ? getImportanceFromPriority(settings.dailySummary.priority) : 3,
        visibility: 1 as any,
        vibration: true
      });

      // 5. Attendance Reminder Channel
      await LocalNotifications.createChannel({
        id: 'attendance_reminder',
        name: 'Attendance Reminders',
        description: 'Reminders to log student attendance after class',
        importance: settings ? getImportanceFromPriority(settings.attendanceReminder.priority) : 3,
        visibility: 1 as any,
        vibration: true
      });

      // Register interactive action buttons for notifications appearing outside the app
      try {
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'LESSON_ALARM_ACTIONS',
              actions: [
                {
                  id: 'START_LESSON',
                  title: '▶️ بدء الحصة',
                  foreground: true,
                },
                {
                  id: 'SNOOZE_ALARM',
                  title: '⏰ غفوة 5 د',
                  foreground: false,
                },
                {
                  id: 'DISMISS_ALARM',
                  title: '✖️ إيقاف',
                  destructive: true,
                  foreground: false,
                }
              ]
            }
          ]
        });
      } catch (e) {
        console.warn('registerActionTypes notice:', e);
      }

      isChannelCreated = true;
    } catch (err) {
      console.warn('Failed to create notification channels:', err);
    }
  }
};

/**
 * Checks if exact alarm permission is granted on Android (for reliable alarms outside the app).
 */
export const checkExactAlarmPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform() && typeof (LocalNotifications as any).checkExactNotificationSetting === 'function') {
    try {
      const res = await (LocalNotifications as any).checkExactNotificationSetting();
      return res?.exact_alarm === 'granted';
    } catch {
      return true;
    }
  }
  return true;
};

/**
 * Opens the Android system settings screen to allow setting exact alarms.
 */
export const openExactAlarmSettings = async () => {
  if (Capacitor.isNativePlatform() && typeof (LocalNotifications as any).changeExactNotificationSetting === 'function') {
    try {
      await (LocalNotifications as any).changeExactNotificationSetting();
    } catch (err) {
      console.warn('Failed to open exact alarm settings:', err);
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
    if (Notification.permission === 'granted') {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
      return true;
    }
    if (Notification.permission === 'denied') return false;

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

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
      if (typeof (LocalNotifications as any).changeExactNotificationSetting === 'function') {
        await (LocalNotifications as any).changeExactNotificationSetting();
      } else {
        await LocalNotifications.requestPermissions();
      }
    } catch (e) {
      console.warn('Could not open Android settings:', e);
    }
  }
};

/**
 * Opens Android System Overlay Settings ("Display over other apps" / "الظهور فوق التطبيقات الأخرى")
 */
export const openOverlayPermissionSettings = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      if (typeof (LocalNotifications as any).changeExactNotificationSetting === 'function') {
        await (LocalNotifications as any).changeExactNotificationSetting();
      } else {
        await LocalNotifications.requestPermissions();
      }
    } catch (e) {
      console.warn('Could not open overlay settings:', e);
    }
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
export const sendSystemNotification = async (
  title: string, 
  body: string, 
  tag: string = 'general',
  extra?: Record<string, any>,
  actionTypeId?: string
) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannels();
      const notifId = Math.floor(Math.random() * 100000);
      
      let channelId = 'lessons_reminders';
      if (tag === 'payment') channelId = 'payment_due';
      if (tag === 'lessonStart') channelId = 'lesson_start';
      if (tag === 'attendance') channelId = 'attendance_reminder';
      if (tag.startsWith('upcoming-') || tag === 'lesson_alarm') channelId = 'lesson_alarm';
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId,
            schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true },
            actionTypeId: actionTypeId || (tag.startsWith('upcoming-') || tag === 'lesson_alarm' ? 'LESSON_ALARM_ACTIONS' : undefined),
            extra: extra || {},
            autoCancel: true,
            ongoing: false
          }
        ]
      });
    } catch (err) {
      console.warn('Native sendSystemNotification failed:', err);
    }
  } else {
    try {
      let perm = await getNotificationPermission();
      if (perm !== 'granted') {
        const granted = await requestNotificationPermission();
        if (!granted) return;
        perm = 'granted';
      }

      // Check for ServiceWorker showNotification to present system-level OS banner outside browser tab
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          let reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            reg = await navigator.serviceWorker.ready;
          }
          if (reg && reg.showNotification) {
            const isAlarm = tag.startsWith('upcoming-') || tag === 'lesson_alarm';
            const swOptions: any = {
              body,
              tag: tag || 'lesson_alarm',
              icon: '/icon.png',
              badge: '/icon.png',
              requireInteraction: true, // Crucial: forces notification to stay on screen outside browser
              silent: false,
              renotify: true,
              vibrate: [500, 200, 500, 200, 500, 200, 800],
              data: { ...extra, lessonId: extra?.lessonId, url: window.location.href, tag },
              actions: isAlarm ? [
                { action: 'start', title: '▶️ بدء الحصة' },
                { action: 'snooze', title: '⏰ غفوة 5 دقائق' },
                { action: 'dismiss', title: '✖️ إيقاف' }
              ] : undefined
            };
            await reg.showNotification(title, swOptions);
            return;
          }
        } catch (swErr) {
          console.warn('ServiceWorker showNotification failed, trying fallback:', swErr);
        }
      }

      if (typeof Notification !== 'undefined') {
        try {
          const notif = new Notification(title, {
            body,
            tag,
            icon: '/icon.png',
            badge: '/icon.png',
            requireInteraction: true
          });

          notif.onclick = () => {
            try {
              window.focus();
              notif.close();
            } catch {}
          };
        } catch (notifErr) {
          console.warn('Direct Notification constructor failed:', notifErr);
        }
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([500, 200, 500, 200, 500]);
        } catch {}
      }
    } catch (err) {
      console.warn('Browser notification error:', err);
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
      const seenIds = new Set<number>();
      const result: ScheduledNotificationItem[] = [];
      for (const n of pending.notifications) {
        if (n.id !== 9999 && !seenIds.has(n.id)) {
          seenIds.add(n.id);
          result.push({
            id: n.id,
            title: n.title || 'تنبيه مجدول',
            body: n.body || '',
            scheduledAt: n.schedule?.at ? new Date(n.schedule.at).toLocaleString('ar-EG') : 'قريباً',
            category: n.extra?.category || 'general',
            extra: n.extra
          });
        }
      }
      return result;
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
    const seenIds = new Set<number>();
    const result: ScheduledNotificationItem[] = [];
    // Filter out past items and deduplicate by ID
    for (const item of items) {
      if (new Date(item.extra?.atEpoch || 0).getTime() > now && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push(item);
      }
    }
    return result;
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
  payments: PaymentRecord[],
  profile?: any,
  language?: string
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
  const scheduledIds = new Set<number>();
  const now = Date.now();
  let earliestEpoch: number | null = null;

  // Helper to register a notification
  const addNotification = (
    id: number,
    title: string,
    body: string,
    scheduleDate: Date,
    channelId: string,
    category: 'lessonReminder' | 'lessonStart' | 'paymentDue' | 'dailySummary' | 'attendanceReminder' | 'schoolLessonReminder',
    extraData: Record<string, any> = {},
    actionTypeId?: string
  ) => {
    const atEpoch = scheduleDate.getTime();
    if (atEpoch <= now) return; // Ignore past dates

    if (earliestEpoch === null || atEpoch < earliestEpoch) {
      earliestEpoch = atEpoch;
    }

    let uniqueId = id;
    while (scheduledIds.has(uniqueId)) {
      uniqueId += 1;
    }
    scheduledIds.add(uniqueId);

    nativeNotifsToSchedule.push({
      id: uniqueId,
      title,
      body,
      channelId,
      schedule: { at: scheduleDate, allowWhileIdle: true },
      actionTypeId,
      extra: { ...extraData, category, atEpoch }
    });

    webNotifsStore.push({
      id: uniqueId,
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

  const lang = language || 'en';
  const isAr = lang === 'ar';
  const isDe = lang === 'de';

  // -------------------------------------------------------------
  // A. LESSON REMINDERS, LESSON START & ATTENDANCE REMINDERS
  // -------------------------------------------------------------
  const upcomingLessons = lessons.filter(l => (l.status === 'scheduled' || l.status === 'in_progress') && !l.deleted);

  for (const lesson of upcomingLessons) {
    if (!lesson.date || !lesson.time) continue;

    // Parse lesson date & time (e.g. "2026-08-11" & "15:00")
    const cleanTime = lesson.time.includes(':') ? lesson.time : `${lesson.time}:00`;
    const lessonStartEpoch = new Date(`${lesson.date}T${cleanTime.padStart(5, '0')}:00`).getTime();

    if (isNaN(lessonStartEpoch)) continue;

    const lessonDisplayName = lesson.studentName || (lesson.groupName && lesson.groupName !== 'Quick Lesson' ? lesson.groupName : '') || lesson.title || (isAr ? 'الحصّة' : isDe ? 'Lektion' : 'Lesson');

    // 1. Lesson Reminder (X minutes before)
    if (settings.lessonReminder.enabled) {
      const minutesBefore = settings.lessonReminderMinutesBefore || 15;
      const reminderEpoch = lessonStartEpoch - minutesBefore * 60 * 1000;
      if (reminderEpoch > now) {
        const isAlarm = settings.alarmModeEnabled !== false;
        const title = isAlarm
          ? (isAr ? `⏰ منبه موعد الحصّة: ${lessonDisplayName}` : isDe ? `⏰ Alarm für Lektion: ${lessonDisplayName}` : `⏰ Lesson Alarm: ${lessonDisplayName}`)
          : (isAr ? `⏰ تذكير بموعد الحصّة: ${lessonDisplayName}` : isDe ? `⏰ Erinnerung an Lektion: ${lessonDisplayName}` : `⏰ Lesson Reminder: ${lessonDisplayName}`);
        const body = isAr
          ? `حصّة ${lessonDisplayName} تبدأ بعد ${minutesBefore} دقيقة (الساعة ${lesson.time})`
          : isDe
          ? `Lektion ${lessonDisplayName} beginnt in ${minutesBefore} Minuten (${lesson.time} Uhr)`
          : `Lesson ${lessonDisplayName} starts in ${minutesBefore} mins (at ${lesson.time})`;

        addNotification(
          generateDeterministicId(`rem_${lesson.id}`, 10000),
          title,
          body,
          new Date(reminderEpoch),
          isAlarm ? 'lesson_alarm' : 'lessons_reminders',
          'lessonReminder',
          { lessonId: lesson.id, groupName: lessonDisplayName, isAlarm },
          'LESSON_ALARM_ACTIONS'
        );
      }
    }

    // 2. Lesson Start Alert
    if (settings.lessonStart.enabled) {
      if (lessonStartEpoch > now) {
        const startTitle = isAr
          ? `🔔 حان موعد حصّة: ${lessonDisplayName}`
          : isDe
          ? `🔔 Zeit für Lektion: ${lessonDisplayName}`
          : `🔔 Time for Lesson: ${lessonDisplayName}`;
        const startBody = isAr
          ? `بدأت الآن حصّة ${lessonDisplayName} (الساعة ${lesson.time})`
          : isDe
          ? `Lektion ${lessonDisplayName} startet jetzt (${lesson.time} Uhr)`
          : `Lesson ${lessonDisplayName} is starting now (at ${lesson.time})`;

        addNotification(
          generateDeterministicId(`start_${lesson.id}`, 20000),
          startTitle,
          startBody,
          new Date(lessonStartEpoch),
          'lesson_start',
          'lessonStart',
          { lessonId: lesson.id, groupName: lessonDisplayName },
          'LESSON_ALARM_ACTIONS'
        );
      }
    }

    // 3. Attendance Logging Reminder
    if (settings.attendanceReminder.enabled) {
      const duration = lesson.durationMinutes || 60;
      const attendanceRemEpoch = lessonStartEpoch + duration * 60 * 1000;
      if (attendanceRemEpoch > now) {
        const attTitle = isAr
          ? `📝 تذكير بتسجيل الحضور والغياب: ${lessonDisplayName}`
          : isDe
          ? `📝 Anwesenheit erfassen: ${lessonDisplayName}`
          : `📝 Log Attendance: ${lessonDisplayName}`;
        const attBody = isAr
          ? `لا تنسَ تسجيل حضور وغياب الطلاب لحصّة ${lessonDisplayName}`
          : isDe
          ? `Vergessen Sie nicht, die Anwesenheit für ${lessonDisplayName} einzutragen.`
          : `Don't forget to mark student attendance for ${lessonDisplayName}.`;

        addNotification(
          generateDeterministicId(`att_${lesson.id}`, 30000),
          attTitle,
          attBody,
          new Date(attendanceRemEpoch),
          'attendance_reminder',
          'attendanceReminder',
          { lessonId: lesson.id, groupName: lessonDisplayName }
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

      const payTitle = isAr
        ? `💰 تذكير بالمدفوعات المستحقة (${pendingStudents.length} طلاب)`
        : isDe
        ? `💰 Fällige Zahlungen (${pendingStudents.length} Schüler)`
        : `💰 Pending Payments Due (${pendingStudents.length} students)`;
      const payBody = isAr
        ? `توجد مدفوعات وتجديدات اشتراك مستحقة لـ ${pendingStudents.length} من الطلاب.`
        : isDe
        ? `Es gibt fällige Zahlungen und Paket-Verlängerungen für ${pendingStudents.length} Schüler.`
        : `There are pending fees and renewals due for ${pendingStudents.length} students.`;

      addNotification(
        40001,
        payTitle,
        payBody,
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

    let summaryText = isAr ? 'ملخص اليوم: ' : isDe ? 'Tagesübersicht: ' : 'Daily Summary: ';
    const parts: string[] = [];

    if (settings.dailySummaryIncludeLessons) {
      parts.push(isAr ? `${todayLessons.length} حصص اليوم` : isDe ? `${todayLessons.length} Lektionen heute` : `${todayLessons.length} lessons today`);
    }
    if (settings.dailySummaryIncludePendingPayments) {
      const pendingCount = students.filter(s => s.paymentStatus === 'pending').length;
      parts.push(isAr ? `${pendingCount} مدفوعات معلقة` : isDe ? `${pendingCount} offene Zahlungen` : `${pendingCount} pending payments`);
    }

    summaryText += parts.join(' • ') || (isAr ? 'تأكد من مراجعة جدول الغد' : isDe ? 'Morgigen Zeitplan prüfen' : 'Check tomorrow’s schedule');

    const sumTitle = isAr ? `📊 الملخص اليومي للمعلم` : isDe ? `📊 Tägliche Lehrerübersicht` : `📊 Teacher's Daily Summary`;

    addNotification(
      50001,
      sumTitle,
      summaryText,
      summaryDate,
      'daily_summary',
      'dailySummary'
    );
  }

  // -------------------------------------------------------------
  // D. SCHOOL LESSON REMINDERS (5 MINUTES BEFORE)
  // -------------------------------------------------------------
  const schoolConfig = settings.schoolLessonReminder || { enabled: true, sound: 'beep', priority: 'high' };
  if (schoolConfig.enabled && profile) {
    const schoolSettings = getSchoolSettings(profile);
    const periods = calculatePeriodsTimings(schoolSettings.periodSettings);
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const futureDate = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
      const dayKey = String(futureDate.getDay());
      const isDayActive = schoolSettings.presence[dayKey]?.active;
      const todayRecords = schoolSettings.schedule[dayKey] || [];
      const scheduledRecords = todayRecords.filter(r => r.subjectName || r.className);
      
      if (isDayActive && scheduledRecords.length > 0) {
        const dateStr = formatLocalDate(futureDate); // YYYY-MM-DD
        
        for (const record of scheduledRecords) {
          const period = periods.find(p => p.periodNumber === record.periodNumber);
          if (!period) continue;
          
          const startTime = period.startTime; // "HH:MM"
          const lessonStartDate = getCairoDateWithTime(dateStr, startTime);
          
          // Reminder should be 5 minutes before start
          const reminderDate = new Date(lessonStartDate.getTime() - 5 * 60 * 1000);
          
          if (reminderDate.getTime() > now) {
            const labelSubject = record.subjectName || '';
            const labelClass = record.className || '';
            const displayTitle = language === 'ar' 
              ? `🏫 الحصة القادمة بعد 5 دقائق` 
              : (language === 'de' ? `🏫 Nächste Stunde in 5 Min.` : `🏫 Next Lesson in 5 mins`);
            const displayBody = `${labelClass}${labelSubject ? ` · ${labelSubject}` : ''}\n${period.startTime} - ${period.endTime}`;
            
            addNotification(
              generateDeterministicId(`school_rem_${dayKey}_${record.periodNumber}_${dateStr}`, 40000),
              displayTitle,
              displayBody,
              reminderDate,
              'lessons_reminders',
              'schoolLessonReminder',
              { className: labelClass, subjectName: labelSubject }
            );
          }
        }
      }
    }
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

/**
 * Setup listeners for notification clicks and action buttons when user interacts from outside the app
 */
export const setupNotificationActionListener = (
  onAction: (action: { actionId: string; lessonId?: string; extra?: any }) => void
) => {
  const cleanups: (() => void)[] = [];

  if (Capacitor.isNativePlatform()) {
    try {
      const perfSub = LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const actionId = notificationAction.actionId; // 'tap', 'START_LESSON', 'SNOOZE_ALARM', 'DISMISS_ALARM'
        const extra = notificationAction.notification.extra || {};
        const lessonId = extra.lessonId;
        onAction({ actionId, lessonId, extra });
      });

      const recSub = LocalNotifications.addListener('localNotificationReceived', (notification) => {
        const extra = notification.extra || {};
        // If an alarm notification is received
        if (extra.isAlarm || notification.channelId === 'lesson_alarm') {
          onAction({ actionId: 'ALARM_RECEIVED', lessonId: extra.lessonId, extra });
        }
      });

      cleanups.push(() => {
        perfSub.then(sub => sub.remove()).catch(() => {});
        recSub.then(sub => sub.remove()).catch(() => {});
      });
    } catch (e) {
      console.warn('Failed to register notification action listener:', e);
    }
  }

  // Web / PWA Service Worker message listener for outside-the-app clicks
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
        const actionMap: Record<string, string> = {
          start: 'START_LESSON',
          snooze: 'SNOOZE_ALARM',
          dismiss: 'DISMISS_ALARM'
        };
        const mappedAction = actionMap[event.data.action] || event.data.action || 'tap';
        onAction({
          actionId: mappedAction,
          lessonId: event.data.lessonId,
          extra: event.data.extra
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', messageHandler);
    cleanups.push(() => {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
    });
  }

  return () => {
    cleanups.forEach(fn => fn());
  };
};

/**
 * Triggers a test notification designed to pop up outside the app (Heads-Up Banner + Sound + Actions)
 */
export const sendTestOutsideNotification = async (language?: string) => {
  const isAr = language === 'ar';
  const isDe = language === 'de';
  const title = isAr
    ? '⏰ تجربة منبه موعد الحصة خارج البرنامج'
    : isDe
    ? '⏰ Test-Alarm für Lektion außerhalb der App'
    : '⏰ Test Lesson Alarm Outside App';
  const body = isAr
    ? 'هكذا يظهر منبه الحصة في أعلى الشاشة وعلى شاشة القفل عند تصغير التطبيق أو قفل الهاتف.'
    : isDe
    ? 'So erscheint der Lektionsalarm am oberen Bildschirmrand und auf dem Sperrbildschirm.'
    : 'This is how the lesson alarm appears at the top banner and lock screen when minimized.';

  await sendSystemNotification(
    title,
    body,
    'lesson_alarm',
    { isTest: true },
    'LESSON_ALARM_ACTIONS'
  );
};

