import { 
  SyncableRecord, 
  SyncDeltaPayload, 
  PeerWatermarkTable,
  PairedPeer,
  PendingOutboxSummary,
  PendingEntityItem,
  TeacherSettingsRecord
} from '../../types';
import { createProtocolHeader } from './protocolNegotiator';

export function buildOutboundDelta(
  targetPeerId: string,
  watermarkTable: PeerWatermarkTable,
  localData: Record<string, SyncableRecord[]>,
  localDevice: { id: string; name: string }
): SyncDeltaPayload {
  const records: SyncDeltaPayload['records'] = {};
  let totalCount = 0;

  for (const [key, items] of Object.entries(localData)) {
    if (!Array.isArray(items)) continue;

    const filteredItems = items.filter((record) => {
      const originId = record.originDeviceId || 'unknown';
      const originRev = record.originRevision || 0;
      const seenRevision = watermarkTable[targetPeerId]?.[originId] || 0;
      
      return originRev > seenRevision;
    });

    if (filteredItems.length > 0) {
      (records as any)[key] = filteredItems;
      totalCount += filteredItems.length;
    }
  }

  return {
    header: createProtocolHeader(),
    senderDeviceId: localDevice.id,
    senderDeviceName: localDevice.name,
    peerWatermarks: JSON.parse(JSON.stringify(watermarkTable || {})), // Pass a safe copy
    records,
    metadata: {
      totalEntitiesCount: totalCount
    }
  };
}

export function updateWatermarks(
  currentTable: PeerWatermarkTable,
  targetPeerId: string,
  syncedRecords: SyncableRecord[]
): PeerWatermarkTable {
  // Deep clone to avoid mutating state directly
  const newTable: PeerWatermarkTable = JSON.parse(JSON.stringify(currentTable || {}));

  if (!newTable[targetPeerId]) {
    newTable[targetPeerId] = {};
  }

  for (const record of syncedRecords) {
    if (!record) continue;
    const originId = record.originDeviceId;
    const originRev = record.originRevision;

    if (originId && typeof originRev === 'number') {
      const currentValue = newTable[targetPeerId][originId] || 0;
      newTable[targetPeerId][originId] = Math.max(currentValue, originRev);
    }
  }

  return newTable;
}

/**
 * Resets watermarks for a specific peer to 0, forcing a complete delta re-synchronization.
 */
export function resetWatermarksForPeer(
  currentTable: PeerWatermarkTable,
  targetPeerId: string
): PeerWatermarkTable {
  const newTable: PeerWatermarkTable = JSON.parse(JSON.stringify(currentTable || {}));
  newTable[targetPeerId] = {};
  return newTable;
}

/**
 * Computes an outbox summary of all local changes that have not yet been synchronized to all paired peers.
 */
export function calculatePendingOutbox(
  watermarkTable: PeerWatermarkTable,
  localData: Record<string, SyncableRecord[]>,
  pairedPeers: PairedPeer[] = []
): PendingOutboxSummary {
  const byEntity: Record<string, number> = {};
  const pendingItems: PendingEntityItem[] = [];
  let oldestPendingTimestamp: number | null = null;

  const activePeers = pairedPeers;

  for (const [entityType, items] of Object.entries(localData)) {
    if (!Array.isArray(items)) continue;
    let entityPendingCount = 0;

    for (const record of items) {
      if (!record) continue;
      const originId = record.originDeviceId || 'unknown';
      const originRev = record.originRevision || 0;
      const updatedAt = record.updatedAt || Date.now();

      // Check if ANY paired peer has not seen this revision
      let isUnsynced = false;
      if (activePeers.length === 0) {
        // If no paired peers yet, any local change with revision > 0 is pending
        isUnsynced = originRev > 0;
      } else {
        isUnsynced = activePeers.some(peer => {
          const peerSeen = watermarkTable[peer.deviceId]?.[originId] || 0;
          return originRev > peerSeen;
        });
      }

      if (isUnsynced) {
        entityPendingCount++;
        
        let title = (record as any).name || (record as any).title || (record as any).id || 'Record';
        if (entityType === 'settings') {
          title = 'Teacher Profile & Settings';
        }

        pendingItems.push({
          id: record.id,
          entityType,
          title,
          originRevision: originRev,
          updatedAt,
          isDeleted: !!record.deleted
        });

        if (oldestPendingTimestamp === null || updatedAt < oldestPendingTimestamp) {
          oldestPendingTimestamp = updatedAt;
        }
      }
    }

    if (entityPendingCount > 0) {
      byEntity[entityType] = entityPendingCount;
    }
  }

  return {
    totalCount: pendingItems.length,
    byEntity,
    items: pendingItems.sort((a, b) => b.updatedAt - a.updatedAt),
    oldestPendingTimestamp
  };
}
