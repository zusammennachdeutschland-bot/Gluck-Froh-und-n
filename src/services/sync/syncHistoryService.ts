import { SyncHistoryEntry, SyncCycleReport, SyncTriggerSource } from '../../types';
import { storage } from '../storageService';

const SYNC_HISTORY_STORAGE_KEY = 'dl_sync_history_v2';
const MAX_HISTORY_RECORDS = 100;
const RETENTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

class SyncHistoryService {
  private inMemoryCache: SyncHistoryEntry[] | null = null;

  public async getHistory(): Promise<SyncHistoryEntry[]> {
    if (this.inMemoryCache !== null) {
      return this.inMemoryCache;
    }

    try {
      // Check v2 key first, then migrate legacy v1 history if needed
      let records = await storage.getItem<SyncHistoryEntry[]>(SYNC_HISTORY_STORAGE_KEY);
      if (!records) {
        const legacyRecords = await storage.getItem<any[]>('dl_sync_history');
        if (legacyRecords && Array.isArray(legacyRecords)) {
          records = legacyRecords.map((r: any) => ({
            id: r.id || 'hist_' + (r.timestamp || Date.now()),
            timestamp: r.timestamp || Date.now(),
            trigger: (r.trigger as SyncTriggerSource) || 'Manual Sync',
            peerId: r.peerId || 'unknown',
            peerName: r.peerName || 'Peer Device',
            durationMs: r.durationMs || (r.report?.durationMs) || 0,
            uploadedCount: r.uploadedCount || 0,
            downloadedCount: r.downloadedCount || 0,
            conflictCount: r.conflictCount || (r.report?.conflictsResolved) || 0,
            status: r.status || 'success',
            summary: r.summary || 'Synced records',
            transferredCount: r.transferredCount || 0,
            report: r.report
          }));
        }
      }

      records = records || [];
      const pruned = this.pruneRecords(records);
      this.inMemoryCache = pruned;
      return pruned;
    } catch (err) {
      console.warn('[SyncHistoryService] Failed to load history:', err);
      return [];
    }
  }

  public async addEntry(
    report: SyncCycleReport,
    trigger: SyncTriggerSource = 'Manual Sync',
    uploadedCount: number = 0,
    downloadedCount: number = 0
  ): Promise<SyncHistoryEntry> {
    const existing = await this.getHistory();
    const entryId = report.id || ('hist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));

    const newEntry: SyncHistoryEntry = {
      id: entryId,
      timestamp: report.timestamp || Date.now(),
      trigger,
      peerId: report.peerId,
      peerName: report.peerName,
      durationMs: report.durationMs || 0,
      uploadedCount,
      downloadedCount,
      conflictCount: report.conflictsResolved || 0,
      status: report.status,
      summary: report.status === 'failed' 
        ? `Failed: ${report.errorMessage || 'Unknown error'}`
        : `${report.totalRecordsTransferred} records synced (${report.conflictsResolved} conflicts)`,
      transferredCount: report.totalRecordsTransferred,
      report
    };

    // Replace if same ID already exists, otherwise prepend
    const existingFiltered = existing.filter(item => item.id !== newEntry.id);
    const updated = [newEntry, ...existingFiltered];
    const pruned = this.pruneRecords(updated);
    this.inMemoryCache = pruned;

    try {
      await storage.setItem(SYNC_HISTORY_STORAGE_KEY, pruned);
    } catch (err) {
      console.warn('[SyncHistoryService] Failed to persist entry:', err);
    }

    return newEntry;
  }

  public async clearHistory(): Promise<void> {
    this.inMemoryCache = [];
    await storage.removeItem(SYNC_HISTORY_STORAGE_KEY);
    await storage.removeItem('dl_sync_history');
  }

  private pruneRecords(records: SyncHistoryEntry[]): SyncHistoryEntry[] {
    const now = Date.now();
    const cutoffTime = now - RETENTION_PERIOD_MS;
    const seenIds = new Set<string>();

    // Filter valid records, deduplicate by ID, sort by descending timestamp, and cap at MAX_HISTORY_RECORDS
    return records
      .filter(r => {
        if (!r || typeof r.timestamp !== 'number' || r.timestamp < cutoffTime) {
          return false;
        }
        const recordId = r.id || `hist_${r.timestamp}`;
        if (seenIds.has(recordId)) {
          return false;
        }
        seenIds.add(recordId);
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_HISTORY_RECORDS);
  }
}

export const syncHistoryService = new SyncHistoryService();
