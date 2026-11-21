import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { storage } from '../services/storageService';

export type AutoBackupCadence = 'daily' | 'weekly' | 'monthly';

export interface AutoBackupSnapshotEntry {
  date: string;
  timestamp: string;
  data: string;
  cadence?: AutoBackupCadence;
  periodKey?: string;
}

export interface AutoBackupScheduleConfig {
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  monthlyEnabled: boolean;
  retentionCount: number;
}

export interface AutoBackupMarkers {
  lastDailyDate?: string | null;
  lastWeeklyKey?: string | null;
  lastMonthlyKey?: string | null;
}

/**
 * Computes ISO-8601 local week identifier (YYYY-Www), e.g. "2026-W47".
 */
export function getLocalIsoWeekKey(date: Date = new Date()): string {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Nearest Thursday determines ISO week-year
  const dayNum = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
  const diffDays = Math.round((target.getTime() - firstThursday.getTime()) / 86400000);
  const weekNum = 1 + Math.round(diffDays / 7);
  return `${target.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getLocalMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function evaluateScheduledBackups(params: {
  now?: Date;
  config: AutoBackupScheduleConfig;
  markers: AutoBackupMarkers;
}): {
  dueTiers: AutoBackupCadence[];
  todayKey: string;
  weekKey: string;
  monthKey: string;
} {
  const now = params.now || new Date();
  const todayKey = formatLocalDate(now);
  const weekKey = getLocalIsoWeekKey(now);
  const monthKey = getLocalMonthKey(now);

  const dueTiers: AutoBackupCadence[] = [];
  if (params.config.dailyEnabled && params.markers.lastDailyDate !== todayKey) {
    dueTiers.push('daily');
  }
  if (params.config.weeklyEnabled && params.markers.lastWeeklyKey !== weekKey) {
    dueTiers.push('weekly');
  }
  if (params.config.monthlyEnabled && params.markers.lastMonthlyKey !== monthKey) {
    dueTiers.push('monthly');
  }

  return {
    dueTiers,
    todayKey,
    weekKey,
    monthKey
  };
}

export async function executeScheduledBackupCheck(deps: {
  now?: Date;
  performBackup: () => Promise<string | any>;
  config: AutoBackupScheduleConfig;
  storageAdapter?: {
    getItem: <T>(key: string) => Promise<T | null>;
    setItem: <T>(key: string, value: T) => Promise<void>;
  };
}): Promise<{
  ranTiers: AutoBackupCadence[];
  todayKey: string;
  weekKey: string;
  monthKey: string;
}> {
  const store = deps.storageAdapter || storage;
  const [lastDailyDate, lastWeeklyKey, lastMonthlyKey] = await Promise.all([
    store.getItem<string>('dl_last_auto_backup_date'),
    store.getItem<string>('dl_last_auto_backup_week'),
    store.getItem<string>('dl_last_auto_backup_month')
  ]);

  const evaluation = evaluateScheduledBackups({
    now: deps.now,
    config: deps.config,
    markers: {
      lastDailyDate,
      lastWeeklyKey,
      lastMonthlyKey
    }
  });

  if (evaluation.dueTiers.length === 0) {
    return {
      ranTiers: [],
      todayKey: evaluation.todayKey,
      weekKey: evaluation.weekKey,
      monthKey: evaluation.monthKey
    };
  }

  const snapshotJson = await deps.performBackup();
  if (!snapshotJson) {
    return {
      ranTiers: [],
      todayKey: evaluation.todayKey,
      weekKey: evaluation.weekKey,
      monthKey: evaluation.monthKey
    };
  }

  const retentionCount = Math.max(1, Number(deps.config.retentionCount) || 10);
  const historySnapshotsRaw = await store.getItem<any>('dl_auto_backup_history_snapshots');
  let historySnapshots: AutoBackupSnapshotEntry[] = [];

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
  if (!Array.isArray(historySnapshots)) {
    historySnapshots = [];
  }

  const dataStr = typeof snapshotJson === 'string' ? snapshotJson : JSON.stringify(snapshotJson);
  const nowIso = (deps.now || new Date()).toISOString();

  // Deduplicate/replace by cadence+periodKey (and preserve backward compatibility for daily entries keyed only by date)
  for (const tier of evaluation.dueTiers) {
    const periodKey =
      tier === 'daily'
        ? evaluation.todayKey
        : tier === 'weekly'
        ? evaluation.weekKey
        : evaluation.monthKey;

    historySnapshots = historySnapshots.filter(s => {
      if (!s) return false;
      const entryCadence: AutoBackupCadence = s.cadence || 'daily';
      const entryPeriod = s.periodKey || s.date;
      return !(entryCadence === tier && entryPeriod === periodKey);
    });

    historySnapshots.unshift({
      date: evaluation.todayKey,
      timestamp: nowIso,
      data: dataStr,
      cadence: tier,
      periodKey
    });
  }

  if (historySnapshots.length > retentionCount) {
    // Preserve newest weekly/monthly anchor snapshots ahead of overflowing daily snapshots when retention is tight,
    // while strictly honoring overall retentionCount
    const retained: AutoBackupSnapshotEntry[] = [];
    const seenIndices = new Set<number>();
    const pushByFilter = (predicate: (s: AutoBackupSnapshotEntry) => boolean) => {
      historySnapshots.forEach((s, idx) => {
        if (retained.length >= retentionCount || seenIndices.has(idx)) return;
        if (predicate(s)) {
          retained.push(s);
          seenIndices.add(idx);
        }
      });
    };
    // Keep newest snapshot of each enabled tier first, then fill newest chronologically
    pushByFilter(s => s.cadence === 'monthly');
    pushByFilter(s => s.cadence === 'weekly');
    pushByFilter(() => true);
    historySnapshots = retained.sort((a, b) =>
      String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
    );
  }

  // Persist snapshot queue FIRST; only advance tier completion markers after snapshot persistence succeeds
  await store.setItem('dl_auto_backup_history_snapshots', JSON.stringify(historySnapshots));

  for (const tier of evaluation.dueTiers) {
    if (tier === 'daily') {
      await store.setItem('dl_last_auto_backup_date', evaluation.todayKey);
    } else if (tier === 'weekly') {
      await store.setItem('dl_last_auto_backup_week', evaluation.weekKey);
    } else if (tier === 'monthly') {
      await store.setItem('dl_last_auto_backup_month', evaluation.monthKey);
    }
  }

  return {
    ranTiers: evaluation.dueTiers,
    todayKey: evaluation.todayKey,
    weekKey: evaluation.weekKey,
    monthKey: evaluation.monthKey
  };
}

/**
 * Automated Daily, Weekly & Monthly In-Storage Data Backup Engine
 * Performs silent background backups to persistent local storage (IndexedDB/Storage)
 * keeping up to the configured retention count (e.g. 10 snapshots).
 */
export const useAutomatedDailyBackup = () => {
  const { performBackup, profile } = useApp();
  const performBackupRef = useRef(performBackup);
  performBackupRef.current = performBackup;

  useEffect(() => {
    if (!profile) return;

    const runAutomatedBackupCheck = async () => {
      try {
        const dailyEnabled = localStorage.getItem('dl_auto_backup_daily') !== 'false';
        const weeklyEnabled = localStorage.getItem('dl_auto_backup_weekly') !== 'false';
        const monthlyEnabled = localStorage.getItem('dl_auto_backup_monthly') === 'true';
        const retentionCount = Number(localStorage.getItem('dl_backup_retention')) || 10;

        const result = await executeScheduledBackupCheck({
          performBackup: () => performBackupRef.current(),
          config: {
            dailyEnabled,
            weeklyEnabled,
            monthlyEnabled,
            retentionCount
          }
        });

        if (result.ranTiers.length > 0) {
          console.log('[Auto Backup] Completed tiers:', result.ranTiers.join(', '));
        }
      } catch (err) {
        console.warn('[Auto Backup] Failed to execute scheduled backup:', err);
      }
    };

    // Run check after initial app hydration (3 seconds after startup)
    const initialTimer = setTimeout(() => {
      runAutomatedBackupCheck();
    }, 3000);

    // Periodic check every 4 hours in case app stays open across midnight/week/month rollover
    const interval = setInterval(runAutomatedBackupCheck, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [profile]);
};
