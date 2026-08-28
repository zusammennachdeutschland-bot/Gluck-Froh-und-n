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
        } else if (entityType === 'hodStudents') {
          title = (record as any).nameAr || (record as any).nameEn || (record as any).name || 'HOD German Student';
        } else if (entityType === 'hodComplaints') {
          title = (record as any).reason ? `${(record as any).studentNameAr || (record as any).teacherName || 'Complaint'}: ${(record as any).reason}` : 'HOD Complaint';
        } else if (entityType === 'hodActionPlans') {
          title = (record as any).studentNameAr ? `Action Plan: ${(record as any).studentNameAr}` : 'HOD Student Action Plan';
        } else if (entityType === 'hodVisits') {
          title = (record as any).teacherName ? `Visit: ${(record as any).teacherName} (${(record as any).className || ''})` : 'HOD Teacher Observation';
        } else if (entityType === 'certificates') {
          title = (record as any).studentName ? `Certificate: ${(record as any).studentName}` : 'Certificate';
        } else if (entityType === 'schoolNotes') {
          const noteType = (record as any).type || 'note';
          const target = (record as any).studentName || (record as any).className || 'Lesson';
          title = `Note (${noteType} - ${target}): ${((record as any).text || '').substring(0, 25)}`;
        } else if (entityType === 'lessons') {
          const lesson = record as any;
          const lTitle = lesson.groupName || lesson.subjectName || lesson.studentName || 'Lesson';
          const isCancelled = lesson.status === 'cancelled';
          const dateStr = lesson.date ? ` (${lesson.date}${lesson.startTime ? ' ' + lesson.startTime : ''})` : '';
          title = isCancelled 
            ? `🚫 Cancelled Session: ${lTitle}${dateStr}` 
            : `📅 Lesson: ${lTitle}${dateStr}`;
        } else if (entityType === 'financeAccounts') {
          title = `Finance Account: ${(record as any).name || (record as any).id}`;
        } else if (entityType === 'financeCategories') {
          title = `Finance Category: ${(record as any).name || (record as any).id}`;
        } else if (entityType === 'financeTransactions') {
          title = `Transaction: ${(record as any).note || (record as any).type || 'Payment'} (${(record as any).amount || 0})`;
        } else if (entityType === 'financeRecurring') {
          title = `Recurring Bill: ${(record as any).name || (record as any).id} (${(record as any).amount || 0})`;
        } else if (entityType === 'financeInstallments') {
          title = `Installment: ${(record as any).name || (record as any).id} (${(record as any).amountPerInstallment || 0})`;
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
