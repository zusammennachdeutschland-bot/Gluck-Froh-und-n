import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { storage } from '../services/storageService';

/**
 * Automated Daily & Scheduled In-Storage Data Backup Engine
 * Performs silent background backups to persistent local storage (IndexedDB/Storage)
 * keeping up to the configured retention count (e.g. 10 snapshots).
 */
export const useAutomatedDailyBackup = () => {
  const { performBackup, profile } = useApp();

  useEffect(() => {
    if (!profile) return;

    const runAutomatedBackupCheck = async () => {
      try {
        const todayStr = formatLocalDate();
        const lastAutoBackupDate = await storage.getItem('dl_last_auto_backup_date');

        const isDailyEnabled = localStorage.getItem('dl_auto_backup_daily') !== 'false'; // Default enabled
        const isWeeklyEnabled = localStorage.getItem('dl_auto_backup_weekly') !== 'false';

        // Check if daily backup hasn't run today
        if (isDailyEnabled && lastAutoBackupDate !== todayStr) {
          console.log('[Auto Daily Backup] Executing scheduled in-storage daily data backup...');
          
          // 1. Perform latest state snapshot
          performBackup();

          // 2. Save snapshot into auto-backup historical ring buffer in persistent storage
          const snapshotJson = await storage.getItem('dl_local_backup_data');
          if (snapshotJson) {
            const retentionCount = Number(localStorage.getItem('dl_backup_retention')) || 10;
            const historySnapshotsRaw = await storage.getItem('dl_auto_backup_history_snapshots');
            let historySnapshots: Array<{ date: string; timestamp: string; data: string }> = [];

            if (historySnapshotsRaw && typeof historySnapshotsRaw === 'string') {
              try {
                historySnapshots = JSON.parse(historySnapshotsRaw);
              } catch {
                historySnapshots = [];
              }
            }

            // Remove existing snapshot for today if present
            historySnapshots = historySnapshots.filter(s => s.date !== todayStr);

            // Add new snapshot at top
            historySnapshots.unshift({
              date: todayStr,
              timestamp: new Date().toISOString(),
              data: String(snapshotJson)
            });

            // Enforce retention limit
            if (historySnapshots.length > retentionCount) {
              historySnapshots = historySnapshots.slice(0, retentionCount);
            }

            await storage.setItem('dl_auto_backup_history_snapshots', JSON.stringify(historySnapshots));
          }

          // 3. Update last auto backup date marker
          await storage.setItem('dl_last_auto_backup_date', todayStr);
          console.log('[Auto Daily Backup] Backup completed and saved to in-storage retention queue.');
        }
      } catch (err) {
        console.warn('[Auto Daily Backup] Failed to execute background backup:', err);
      }
    };

    // Run check after initial app hydration (3 seconds after startup)
    const initialTimer = setTimeout(() => {
      runAutomatedBackupCheck();
    }, 3000);

    // Periodic check every 4 hours in case app stays open across midnight
    const interval = setInterval(runAutomatedBackupCheck, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [profile, performBackup]);
};
