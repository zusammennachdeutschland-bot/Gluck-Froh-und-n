import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { storage } from '../services/storageService';

/**
 * Automated Daily & Scheduled In-Storage Data Backup Engine
 * Performs silent background backups to persistent local storage (IndexedDB/Storage)
 * keeping up to the configured retention count (e.g. 10 snapshots).
 */
export function shouldRunAutomatedBackup(params: {
  todayStr: string;
  lastAutoBackupDate?: string | null;
  isDailyEnabled: boolean;
  isWeeklyEnabled: boolean;
  isMonthlyEnabled: boolean;
}): boolean {
  const { todayStr, lastAutoBackupDate, isDailyEnabled, isWeeklyEnabled, isMonthlyEnabled } = params;
  if (!isDailyEnabled && !isWeeklyEnabled && !isMonthlyEnabled) return false;
  if (!lastAutoBackupDate) return true;
  if (lastAutoBackupDate === todayStr) return false;

  if (isDailyEnabled) {
    return true;
  }

  const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
  const lastMs = Date.parse(`${lastAutoBackupDate}T00:00:00Z`);
  const diffDays = Number.isFinite(todayMs) && Number.isFinite(lastMs)
    ? Math.floor((todayMs - lastMs) / (24 * 60 * 60 * 1000))
    : 999;

  if (isWeeklyEnabled && diffDays >= 7) {
    return true;
  }

  if (isMonthlyEnabled) {
    const differentMonth = todayStr.slice(0, 7) !== lastAutoBackupDate.slice(0, 7);
    if (diffDays >= 30 || differentMonth) {
      return true;
    }
  }

  return false;
}

export const useAutomatedDailyBackup = () => {
  const { performBackup, profile } = useApp();
  const performBackupRef = useRef(performBackup);
  performBackupRef.current = performBackup;

  useEffect(() => {
    if (!profile) return;

    const runAutomatedBackupCheck = async () => {
      try {
        const todayStr = formatLocalDate();
        const lastAutoBackupDate = await storage.getItem<string>('dl_last_auto_backup_date');

        const isDailyEnabled = localStorage.getItem('dl_auto_backup_daily') !== 'false'; // Default enabled
        const isWeeklyEnabled = localStorage.getItem('dl_auto_backup_weekly') !== 'false';
        const isMonthlyEnabled = localStorage.getItem('dl_auto_backup_monthly') === 'true';

        if (
          shouldRunAutomatedBackup({
            todayStr,
            lastAutoBackupDate,
            isDailyEnabled,
            isWeeklyEnabled,
            isMonthlyEnabled
          })
        ) {
          console.log('[Auto Daily Backup] Executing scheduled in-storage data backup...');
          
          // 1. Perform latest state snapshot and await JSON string
          const snapshotJson = await performBackupRef.current();

          if (snapshotJson) {
            const retentionCount = Number(localStorage.getItem('dl_backup_retention')) || 10;
            const historySnapshotsRaw = await storage.getItem('dl_auto_backup_history_snapshots');
            let historySnapshots: Array<{ date: string; timestamp: string; data: string }> = [];

            if (historySnapshotsRaw) {
              if (typeof historySnapshotsRaw === 'string') {
                try {
                  historySnapshots = JSON.parse(historySnapshotsRaw);
                } catch {
                  historySnapshots = [];
                }
              } else if (Array.isArray(historySnapshotsRaw)) {
                historySnapshots = historySnapshotsRaw;
              }
            }

            // Remove existing snapshot for today if present
            historySnapshots = historySnapshots.filter(s => s.date !== todayStr);

            // Add new snapshot at top
            const dataStr = typeof snapshotJson === 'string' ? snapshotJson : JSON.stringify(snapshotJson);
            historySnapshots.unshift({
              date: todayStr,
              timestamp: new Date().toISOString(),
              data: dataStr
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
  }, [profile]);
};
