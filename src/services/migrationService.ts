import { storage } from './storageService';

const STORAGE_KEYS = [
  'dl_theme',
  'dl_quick_todos',
  'dl_language',
  'dl_profile',
  'dl_groups',
  'dl_students',
  'dl_lessons',
  'dl_payments',
  'dl_notifications',
  'dl_inspiration_settings',
  'dl_inspiration_messages',
  'dl_last_backup_time',
  'dl_dismissed_dashboard_lessons',
  'dl_recently_deleted',
  'dl_active_lesson_session',
  'dl_notified_lesson_alerts',
  'dl_local_backup_data'
];

export async function migrateFromLocalStorageToIndexedDB(): Promise<void> {
  try {
    // Check if localStorage is supported/available
    let isLocalStorageSupported = false;
    try {
      const testKey = '__test_mig__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      isLocalStorageSupported = true;
    } catch (e) {
      console.warn('localStorage is blocked or not supported during migration:', e);
      return;
    }

    if (!isLocalStorageSupported) return;

    const isMigrated = await storage.getItem<boolean>('dl_migrated_v2');
    if (isMigrated) {
      return;
    }

    console.log('Starting migration from localStorage to IndexedDB...');
    
    for (const key of STORAGE_KEYS) {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        try {
          // Assume JSON parsing except for theme, language, dl_last_backup_time
          if (key === 'dl_theme' || key === 'dl_language' || key === 'dl_last_backup_time' || key === 'dl_local_backup_data') {
            await storage.setItem(key, value);
          } else {
            await storage.setItem(key, JSON.parse(value));
          }
        } catch (e) {
          console.error(`Failed to migrate key ${key}`, e);
          // Fallback to raw string if JSON parsing fails
          await storage.setItem(key, value);
        }
      }
    }

    await storage.setItem('dl_migrated_v2', true);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed with error:', err);
  }
}
