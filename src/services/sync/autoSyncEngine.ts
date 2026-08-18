import { SyncDataSource, runSyncCycle, forceFullSync } from './syncOrchestrator';
import { SyncTriggerSource, SyncCycleReport } from '../../types';
import { connectivityEngine } from './connectivityEngine';
import { syncHistoryService } from './syncHistoryService';
import { presenceService } from './presenceService';

const DEBOUNCE_DELAY_MS = 2500;
const BACKGROUND_SYNC_INTERVAL_MS = 60000;
const LOCK_TIMEOUT_MS = 25000;
const MAX_FAILURES_BEFORE_QUARANTINE = 3;
const QUARANTINE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface PeerFailureRecord {
  consecutiveFailures: number;
  lastFailureAt: number;
  quarantinedUntil: number;
}

class AutoSyncEngine {
  private syncLock: { isLocked: boolean; owner: string | null; lockedAt: number } = {
    isLocked: false,
    owner: null,
    lockedAt: 0
  };

  private debounceTimer: any = null;
  private backgroundInterval: any = null;
  private isAutoSyncEnabled: boolean = true;
  private pendingPeersToSync: Set<string> = new Set();
  private dataSource: SyncDataSource | null = null;
  private failureTracker: Map<string, PeerFailureRecord> = new Map();

  public init(dataSource: SyncDataSource) {
    this.dataSource = dataSource;
    this.startBackgroundSchedule();
  }

  public setEnabled(enabled: boolean) {
    this.isAutoSyncEnabled = enabled;
    if (!enabled) {
      this.cancelPendingDebounce();
    }
  }

  public isQuarantined(peerId: string): boolean {
    const record = this.failureTracker.get(peerId);
    if (!record) return false;
    if (record.quarantinedUntil > Date.now()) {
      return true;
    }
    // Expired quarantine, reset back to 0
    if (record.quarantinedUntil > 0 && record.quarantinedUntil <= Date.now()) {
      record.quarantinedUntil = 0;
      record.consecutiveFailures = 0;
    }
    return false;
  }

  public getQuarantineInfo(peerId: string): { isQuarantined: boolean; remainingSeconds: number } {
    const record = this.failureTracker.get(peerId);
    if (!record || record.quarantinedUntil <= Date.now()) {
      return { isQuarantined: false, remainingSeconds: 0 };
    }
    const remainingSeconds = Math.ceil((record.quarantinedUntil - Date.now()) / 1000);
    return { isQuarantined: true, remainingSeconds };
  }

  private recordFailure(peerId: string) {
    const now = Date.now();
    const existing = this.failureTracker.get(peerId) || {
      consecutiveFailures: 0,
      lastFailureAt: 0,
      quarantinedUntil: 0
    };

    existing.consecutiveFailures += 1;
    existing.lastFailureAt = now;

    if (existing.consecutiveFailures >= MAX_FAILURES_BEFORE_QUARANTINE) {
      existing.quarantinedUntil = now + QUARANTINE_DURATION_MS;
      console.warn(`[AutoSyncEngine] Peer ${peerId} placed in auto-sync quarantine for 5 minutes after ${existing.consecutiveFailures} consecutive failures`);
    }

    this.failureTracker.set(peerId, existing);
  }

  private recordSuccess(peerId: string) {
    this.failureTracker.delete(peerId);
  }

  /**
   * Called by AppContext whenever a local mutation occurs.
   * Debounces the sync trigger and coalesces rapid edits into a single sync run.
   */
  public notifyLocalMutation() {
    if (!this.isAutoSyncEnabled || !this.dataSource) return;

    const syncState = this.dataSource.getSyncState();
    const livePresences = presenceService.getPresences();

    // Check live presence status instead of stale storage
    const onlinePeers = (syncState.pairedPeers || []).filter(p => {
      const presence = livePresences.get(p.deviceId);
      const isOnline = presence ? presence.isOnline : false;
      const quarantined = this.isQuarantined(p.deviceId);
      return isOnline && !quarantined;
    });

    if (onlinePeers.length === 0) return;

    for (const peer of onlinePeers) {
      this.pendingPeersToSync.add(peer.deviceId);
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushPendingSyncs('Auto Sync');
    }, DEBOUNCE_DELAY_MS);
  }

  /**
   * Acquires the synchronization lock.
   * If an existing lock is older than LOCK_TIMEOUT_MS, it is forcefully broken to prevent deadlocks.
   */
  public acquireLock(owner: string): boolean {
    const now = Date.now();
    if (this.syncLock.isLocked) {
      if (now - this.syncLock.lockedAt > LOCK_TIMEOUT_MS) {
        console.warn(`[AutoSyncEngine] Breaking stale sync lock held by ${this.syncLock.owner}`);
        this.releaseLock(this.syncLock.owner || 'timeout');
      } else {
        return false;
      }
    }

    this.syncLock = {
      isLocked: true,
      owner,
      lockedAt: now
    };
    connectivityEngine.setSyncing(true);
    return true;
  }

  public releaseLock(owner: string) {
    if (this.syncLock.owner === owner || owner === 'timeout' || owner === 'force') {
      this.syncLock = {
        isLocked: false,
        owner: null,
        lockedAt: 0
      };
      connectivityEngine.setSyncing(false);
    }
  }

  public isLocked(): boolean {
    const now = Date.now();
    if (this.syncLock.isLocked && (now - this.syncLock.lockedAt > LOCK_TIMEOUT_MS)) {
      this.releaseLock('timeout');
      return false;
    }
    return this.syncLock.isLocked;
  }

  /**
   * Executes a synchronized cycle with a specific peer with mutex protection.
   */
  public async executeSync(
    peerId: string,
    trigger: SyncTriggerSource = 'Manual Sync',
    isForceFull: boolean = false
  ): Promise<{ success: boolean; report: SyncCycleReport }> {
    if (!this.dataSource) {
      throw new Error('Sync engine not initialized with data source');
    }

    // If automatic trigger and peer is quarantined, skip silently
    if (trigger !== 'Manual Sync' && this.isQuarantined(peerId)) {
      const skipReport: SyncCycleReport = {
        id: 'sync_quarantine_' + Date.now(),
        timestamp: Date.now(),
        peerId,
        peerName: 'Peer',
        direction: 'bidirectional',
        status: 'failed',
        entities: {},
        totalRecordsTransferred: 0,
        conflictsResolved: 0,
        durationMs: 0,
        errorMessage: 'Peer is temporarily quarantined due to consecutive connection failures.'
      };
      return { success: false, report: skipReport };
    }

    const lockKey = `sync_${peerId}_${Date.now()}`;
    const acquired = this.acquireLock(lockKey);
    if (!acquired) {
      console.warn(`[AutoSyncEngine] Sync skipped: lock is currently held by ${this.syncLock.owner}`);
      const busyReport: SyncCycleReport = {
        id: 'sync_busy_' + Date.now(),
        timestamp: Date.now(),
        peerId,
        peerName: 'Peer',
        direction: 'bidirectional',
        status: 'failed',
        entities: {},
        totalRecordsTransferred: 0,
        conflictsResolved: 0,
        durationMs: 0,
        errorMessage: 'Another synchronization cycle is currently active.'
      };
      return { success: false, report: busyReport };
    }

    try {
      let result: { success: boolean; report: SyncCycleReport };
      if (isForceFull) {
        result = await forceFullSync(peerId, this.dataSource);
      } else {
        result = await runSyncCycle(peerId, this.dataSource);
      }

      // Record to persistent history
      await syncHistoryService.addEntry(
        result.report,
        trigger,
        result.report.totalRecordsTransferred,
        result.report.totalRecordsTransferred
      );

      if (result.success) {
        this.recordSuccess(peerId);
        presenceService.updatePresenceManually(peerId, true);
      } else {
        this.recordFailure(peerId);
        if (result.report.errorMessage) {
          connectivityEngine.setSyncError(result.report.errorMessage);
        }
      }

      return result;
    } catch (err: any) {
      this.recordFailure(peerId);
      const errorReport: SyncCycleReport = {
        id: 'sync_err_' + Date.now(),
        timestamp: Date.now(),
        peerId,
        peerName: 'Peer',
        direction: 'bidirectional',
        status: 'failed',
        entities: {},
        totalRecordsTransferred: 0,
        conflictsResolved: 0,
        durationMs: 0,
        errorMessage: err?.message || 'Sync execution failed.'
      };
      await syncHistoryService.addEntry(errorReport, trigger);
      connectivityEngine.setSyncError(errorReport.errorMessage || 'Error');
      return { success: false, report: errorReport };
    } finally {
      this.releaseLock(lockKey);
    }
  }

  private async flushPendingSyncs(trigger: SyncTriggerSource) {
    if (!this.dataSource || this.pendingPeersToSync.size === 0) return;
    if (this.isLocked()) {
      // Retry in 3 seconds if locked
      this.debounceTimer = setTimeout(() => {
        this.flushPendingSyncs(trigger);
      }, 3000);
      return;
    }

    const peerIds = Array.from(this.pendingPeersToSync);
    this.pendingPeersToSync.clear();

    for (const peerId of peerIds) {
      await this.executeSync(peerId, trigger, false);
    }
  }

  private startBackgroundSchedule() {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }

    if (typeof window !== 'undefined') {
      this.backgroundInterval = setInterval(() => {
        if (!this.isAutoSyncEnabled || !this.dataSource || this.isLocked()) return;
        
        const syncState = this.dataSource.getSyncState();
        const livePresences = presenceService.getPresences();

        // Only target active, non-quarantined peers
        const onlinePeers = (syncState.pairedPeers || []).filter(p => {
          const presence = livePresences.get(p.deviceId);
          const isOnline = presence ? presence.isOnline : false;
          return isOnline && !this.isQuarantined(p.deviceId);
        });
        
        for (const peer of onlinePeers) {
          this.executeSync(peer.deviceId, 'Background Sync', false).catch(err => {
            console.warn('[AutoSyncEngine] Background sync notice:', err);
          });
        }
      }, BACKGROUND_SYNC_INTERVAL_MS);
    }
  }

  private cancelPendingDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingPeersToSync.clear();
  }

  public destroy() {
    this.cancelPendingDebounce();
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }
    this.releaseLock('force');
    this.failureTracker.clear();
  }
}

export const autoSyncEngine = new AutoSyncEngine();
