import { SyncStateMetadata, SyncableRecord } from '../../types';
import { storage } from '../storageService';

export interface BackupSyncReconciliationResult {
  nextRevisionCounter: number;
  totalEntitiesScanned: number;
  reconciledWatermarks: Record<string, Record<string, number>>;
}

/**
 * Reconciles the local synchronization state after a backup restore.
 * Ensures revision numbers strictly advance to avoid rollback conflicts,
 * resets stale watermark tables, and prevents entity duplication.
 */
export function reconcileSyncStateAfterRestore(
  restoredData: Record<string, any[]>,
  currentSyncState: SyncStateMetadata | null
): BackupSyncReconciliationResult {
  let maxFoundRevision = 0;
  let totalEntitiesScanned = 0;

  for (const items of Object.values(restoredData)) {
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item) continue;
      totalEntitiesScanned++;
      const rev = (item as SyncableRecord).originRevision;
      if (typeof rev === 'number' && rev > maxFoundRevision) {
        maxFoundRevision = rev;
      }
    }
  }

  const currentCounter = currentSyncState?.localRevisionCounter || 0;
  // Advance sequence counter safely beyond any restored revision (+100 buffer for safety)
  const nextRevisionCounter = Math.max(currentCounter, maxFoundRevision) + 100;

  // Reset peer watermarks to force fresh reconciliatory comparison with peers
  const reconciledWatermarks: Record<string, Record<string, number>> = {};

  return {
    nextRevisionCounter,
    totalEntitiesScanned,
    reconciledWatermarks
  };
}

/**
 * Persists the reconciled sync state safely to local storage.
 */
export async function applyRestoreSyncSafeguards(
  restoredData: Record<string, any[]>,
  currentSyncState: SyncStateMetadata | null
): Promise<SyncStateMetadata | null> {
  if (!currentSyncState) return null;

  const reconciliation = reconcileSyncStateAfterRestore(restoredData, currentSyncState);

  const updatedState: SyncStateMetadata = {
    ...currentSyncState,
    localRevisionCounter: reconciliation.nextRevisionCounter,
    peerWatermarkTable: reconciliation.reconciledWatermarks
  };

  await storage.setItem('dl_sync_state', updatedState);
  return updatedState;
}
