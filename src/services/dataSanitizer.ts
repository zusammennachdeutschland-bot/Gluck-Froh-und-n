import { storage } from './storageService';
import { 
  Group, 
  Student, 
  Lesson, 
  PaymentRecord, 
  NotificationItem, 
  CertificateRecord, 
  TodoItem, 
  RecentlyDeletedData,
  TeacherProfile,
  NotificationSettings,
  InspirationSettings,
  InspirationMessage
} from '../types';
import { DEFAULT_FINANCE_CATEGORIES } from '../data/defaultFinanceCategories';
import { 
  INITIAL_TODOS,
  INITIAL_TEACHER_PROFILE,
  DEFAULT_NOTIFICATION_SETTINGS,
  INITIAL_INSPIRATION_SETTINGS,
  INITIAL_INSPIRATION_MESSAGES
} from '../data/initialData';

export function sanitizeInitialData(rawData: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = { ...rawData };
  let needsPersistCleaned = false;

  // Helper to ensure an array
  const ensureArray = <T>(key: string, fallback: T[] = []): T[] => {
    let val = sanitized[key];
    if (typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch {
        val = fallback;
        needsPersistCleaned = true;
      }
    }
    if (!Array.isArray(val)) {
      val = fallback;
      needsPersistCleaned = true;
    }
    // Filter out null or non-objects for object-arrays
    return val.filter((item: any) => item !== null && item !== undefined);
  };

  // Helper to ensure an object
  const ensureObject = <T extends Record<string, any>>(key: string, fallback: T): T => {
    let val = sanitized[key];
    if (typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch {
        val = fallback;
        needsPersistCleaned = true;
      }
    }
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      val = fallback;
      needsPersistCleaned = true;
    }
    return val;
  };

  // 1. Groups
  const rawGroups = ensureArray<Group>('dl_groups', []);
  sanitized['dl_groups'] = rawGroups
    .filter(g => g && typeof g === 'object')
    .map((g, idx) => ({
      ...g,
      id: String(g.id || `grp_${Date.now()}_${idx}`),
      name: String(g.name || 'مجموعة بدون اسم')
    }));

  // 2. Students
  const rawStudents = ensureArray<Student>('dl_students', []);
  sanitized['dl_students'] = rawStudents
    .filter(s => s && typeof s === 'object')
    .map((s, idx) => ({
      ...s,
      id: String(s.id || `st_${Date.now()}_${idx}`),
      name: String(s.name || 'طالب بدون اسم'),
      groupId: String(s.groupId || '')
    }));

  // 3. Lessons
  const rawLessons = ensureArray<Lesson>('dl_lessons', []);
  sanitized['dl_lessons'] = rawLessons
    .filter(l => l && typeof l === 'object')
    .map((l, idx) => ({
      ...l,
      id: String(l.id || `lsn_${Date.now()}_${idx}`),
      date: typeof l.date === 'string' ? l.date : '',
      time: typeof l.time === 'string' ? l.time : ''
    }));

  // 4. Payments
  const rawPayments = ensureArray<PaymentRecord>('dl_payments', []);
  sanitized['dl_payments'] = rawPayments
    .filter(p => p && typeof p === 'object')
    .map((p, idx) => ({
      ...p,
      id: String(p.id || `pay_${Date.now()}_${idx}`),
      lessonIds: Array.isArray(p.lessonIds) ? p.lessonIds : [],
      lessonDates: Array.isArray(p.lessonDates) ? p.lessonDates : []
    }));

  // 5. Notifications
  const rawNotifs = ensureArray<NotificationItem>('dl_notifications', []);
  sanitized['dl_notifications'] = rawNotifs
    .filter(n => n && typeof n === 'object')
    .map((n, idx) => ({
      ...n,
      id: String(n.id || `notif_${Date.now()}_${idx}`)
    }));

  // 6. Quick Todos
  const rawTodos = ensureArray<TodoItem>('dl_quick_todos', INITIAL_TODOS);
  sanitized['dl_quick_todos'] = rawTodos
    .filter(t => t && typeof t === 'object')
    .map((t, idx) => ({
      ...t,
      id: String(t.id || `todo_${Date.now()}_${idx}`),
      text: String(t.text || (t as any).title || '')
    }));

  // 7. Certificates
  const rawCerts = ensureArray<CertificateRecord>('dl_certificates', []);
  sanitized['dl_certificates'] = rawCerts.filter(c => c && typeof c === 'object');

  // 8. Recently Deleted
  const rawRecentlyDeleted = ensureObject<RecentlyDeletedData>('dl_recently_deleted', { students: [], groups: [], lessons: [] });
  sanitized['dl_recently_deleted'] = {
    students: Array.isArray(rawRecentlyDeleted.students) ? rawRecentlyDeleted.students : [],
    groups: Array.isArray(rawRecentlyDeleted.groups) ? rawRecentlyDeleted.groups : [],
    lessons: Array.isArray(rawRecentlyDeleted.lessons) ? rawRecentlyDeleted.lessons : []
  };

  // 9. Profile
  const rawProfile = ensureObject<TeacherProfile>('dl_profile', INITIAL_TEACHER_PROFILE);
  sanitized['dl_profile'] = {
    ...INITIAL_TEACHER_PROFILE,
    ...rawProfile,
    workingHours: {
      workingDays: Array.isArray(rawProfile.workingHours?.workingDays) ? rawProfile.workingHours.workingDays : [1, 2, 3, 4, 5],
      startTime: rawProfile.workingHours?.startTime || '08:00',
      endTime: rawProfile.workingHours?.endTime || '16:00'
    },
    weeklyWorkingHours: (rawProfile.weeklyWorkingHours && typeof rawProfile.weeklyWorkingHours === 'object') 
      ? rawProfile.weeklyWorkingHours 
      : {}
  };

  // 10. Notification Settings
  const rawNotifSettings = ensureObject<NotificationSettings>('dl_notification_settings', DEFAULT_NOTIFICATION_SETTINGS);
  sanitized['dl_notification_settings'] = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...rawNotifSettings
  };

  // 11. Inspiration Settings & Messages
  const rawInspSettings = ensureObject<InspirationSettings>('dl_inspiration_settings', INITIAL_INSPIRATION_SETTINGS);
  sanitized['dl_inspiration_settings'] = {
    ...INITIAL_INSPIRATION_SETTINGS,
    ...rawInspSettings
  };

  const rawInspMsgs = ensureArray<InspirationMessage>('dl_inspiration_messages', INITIAL_INSPIRATION_MESSAGES);
  sanitized['dl_inspiration_messages'] = rawInspMsgs.filter(m => m && typeof m === 'object');

  // 12. Dismissed Dashboard Lessons
  sanitized['dl_dismissed_dashboard_lessons'] = ensureArray<string>('dl_dismissed_dashboard_lessons', [])
    .filter(id => typeof id === 'string');

  // 13. Notified Lesson Alerts
  const rawAlerts = ensureObject<Record<string, boolean>>('dl_notified_lesson_alerts', {});
  sanitized['dl_notified_lesson_alerts'] = (rawAlerts && typeof rawAlerts === 'object' && !Array.isArray(rawAlerts)) ? rawAlerts : {};

  // 14. Finance Collections
  sanitized['dl_finance_accounts'] = ensureArray('dl_finance_accounts', []).filter(a => a && typeof a === 'object');
  sanitized['dl_finance_categories'] = ensureArray('dl_finance_categories', DEFAULT_FINANCE_CATEGORIES).filter(c => c && typeof c === 'object');
  sanitized['dl_finance_transactions'] = ensureArray('dl_finance_transactions', []).filter(tx => tx && typeof tx === 'object');
  sanitized['dl_finance_recurring'] = ensureArray('dl_finance_recurring', []).filter(r => r && typeof r === 'object');
  sanitized['dl_finance_installments'] = ensureArray('dl_finance_installments', []).filter(i => i && typeof i === 'object');
  sanitized['dl_finance_notifications'] = ensureArray('dl_finance_notifications', []).filter(n => n && typeof n === 'object');

  // 15. HOD & School Notes
  sanitized['hod_german_students'] = ensureArray('hod_german_students', []).filter(s => s && typeof s === 'object');
  sanitized['hod_complaints'] = ensureArray('hod_complaints', []).filter(c => c && typeof c === 'object');
  sanitized['hod_student_action_plans'] = ensureArray('hod_student_action_plans', []).filter(p => p && typeof p === 'object');
  sanitized['hod_visit_records'] = ensureArray('hod_visit_records', []).filter(v => v && typeof v === 'object');
  sanitized['dl_school_notes'] = ensureArray('dl_school_notes', []).filter(n => n && typeof n === 'object');

  // 16. Gold Holdings & Settings (Defaults to empty array for privacy)
  sanitized['gluck_gold_holdings'] = ensureArray('gluck_gold_holdings', []).filter(g => g && typeof g === 'object' && g.id !== 'gold_btc_5g_init');
  sanitized['gluck_gold_settings'] = ensureObject('gluck_gold_settings', {
    enabled: true,
    autoUpdateEnabled: true,
    updateIntervalMinutes: 60,
    preferredProviderId: 'backend_proxy',
    fallbackProviderId: 'gold_api_direct',
    useCachedPriceWhenOffline: true,
    maxCacheAgeHours: 72,
  });

  // Asynchronously write back cleaned data if corruption or non-standard format was detected
  if (needsPersistCleaned) {
    console.log('[DataSanitizer] Repaired legacy data discrepancies. Persisting clean state to storage...');
    setTimeout(async () => {
      try {
        await storage.setItem('dl_groups', sanitized['dl_groups']);
        await storage.setItem('dl_students', sanitized['dl_students']);
        await storage.setItem('dl_lessons', sanitized['dl_lessons']);
        await storage.setItem('dl_payments', sanitized['dl_payments']);
        await storage.setItem('dl_notifications', sanitized['dl_notifications']);
        await storage.setItem('dl_recently_deleted', sanitized['dl_recently_deleted']);
        await storage.setItem('dl_profile', sanitized['dl_profile']);
        await storage.setItem('dl_notification_settings', sanitized['dl_notification_settings']);
      } catch (e) {
        console.warn('[DataSanitizer] Background persist warning:', e);
      }
    }, 1000);
  }

  return sanitized;
}

export async function clearAllLocalDataAndReset(): Promise<void> {
  try {
    // 1. Take a fallback snapshot in localStorage before clearing
    try {
      const keys = ['dl_groups', 'dl_students', 'dl_lessons', 'dl_payments', 'dl_profile'];
      const snapshot: Record<string, any> = {};
      for (const k of keys) {
        snapshot[k] = await storage.getItem(k);
      }
      window.localStorage.setItem('dl_emergency_backup_' + Date.now(), JSON.stringify(snapshot));
    } catch {}

    // 2. Clear IndexedDB
    await storage.clear();

    // 3. Clear localStorage except for emergency backups
    if (typeof window !== 'undefined' && window.localStorage) {
      const backupKeys = Object.keys(window.localStorage).filter(k => k.startsWith('dl_emergency_backup_'));
      const backups: Record<string, string> = {};
      backupKeys.forEach(k => { backups[k] = window.localStorage.getItem(k) || ''; });
      window.localStorage.clear();
      Object.entries(backups).forEach(([k, v]) => window.localStorage.setItem(k, v));
    }

    // 4. Reload clean
    window.location.reload();
  } catch (err) {
    console.error('Failed to reset local data:', err);
    window.location.reload();
  }
}
