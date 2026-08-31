import { 
  SyncStateMetadata, 
  PairedPeer, 
  SyncableRecord, 
  SyncDeltaPayload, 
  SyncCycleReport, 
  SyncEntityDiff, 
  SyncConflictRecord,
  FinanceAccount,
  FinanceTransaction
} from '../../types';
import { exchangeDeltas } from './syncClient';
import { resolvePeerIp } from './discoveryService';
import { buildOutboundDelta, updateWatermarks, resetWatermarksForPeer } from './deltaBuilder';
import { mergeEntities } from './mergeEngine';
import { syncHistoryService } from './syncHistoryService';
import { negotiateProtocol, adaptOutboundPayloadForPeer } from './protocolNegotiator';
import { syncEventQueue } from './syncEventQueue';
import { recalculateAllAccountBalances } from '../financeService';

export interface SyncDataSource {
  getLocalData: () => Record<string, SyncableRecord[]>;
  getSyncState: () => SyncStateMetadata & { pairedPeers?: PairedPeer[] };
  saveMergedData: (key: string, data: SyncableRecord[]) => Promise<void>;
  updateSyncState: (newState: SyncStateMetadata & { pairedPeers?: PairedPeer[] }) => Promise<void>;
}

/**
 * Saves a sync cycle report to the persistent history log.
 */
async function recordSyncHistory(report: SyncCycleReport): Promise<void> {
  try {
    await syncHistoryService.addEntry(report, 'Manual Sync', report.totalRecordsTransferred, report.totalRecordsTransferred);
  } catch (err) {
    console.warn('Failed to record sync history:', err);
  }
}

export async function runSyncCycle(
  peerId: string, 
  dataSource: SyncDataSource
): Promise<{ success: boolean; report: SyncCycleReport }> {
  const startTime = Date.now();
  const entityDiffs: Record<string, SyncEntityDiff> = {};
  const allConflicts: SyncConflictRecord[] = [];
  let totalTransferred = 0;

  const emptyReport: SyncCycleReport = {
    id: 'sync_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: startTime,
    peerId,
    peerName: 'Unknown Peer',
    direction: 'bidirectional',
    status: 'failed',
    entities: {},
    totalRecordsTransferred: 0,
    conflictsResolved: 0,
    durationMs: 0
  };

  try {
    // 1. Get the SyncStateMetadata and find the specific PairedPeer
    const syncState = dataSource.getSyncState();
    const pairedPeers = syncState.pairedPeers || [];
    const peerIndex = pairedPeers.findIndex(p => p.deviceId === peerId);

    if (peerIndex === -1) {
      console.warn(`Sync aborted: PairedPeer ${peerId} not found.`);
      emptyReport.errorMessage = `Paired peer ${peerId} not found.`;
      await recordSyncHistory(emptyReport);
      return { success: false, report: emptyReport };
    }

    const peer = pairedPeers[peerIndex];
    emptyReport.peerName = peer.deviceName || 'Peer Device';

    // 2. Resolve peer's current IP dynamically
    const currentIp = await resolvePeerIp(peer);
    if (!currentIp) {
      emptyReport.errorMessage = `Device is currently offline or unreachable.`;
      await recordSyncHistory(emptyReport);
      return { success: false, report: emptyReport };
    }

    // 3. Negotiate capabilities and build the outbound delta payload
    const localData = dataSource.getLocalData();
    const localDevice = { id: syncState.localDeviceId, name: syncState.localDeviceName };
    const pendingEvents = await syncEventQueue.getPendingEvents();
    const rawOutboundDelta = buildOutboundDelta(
      peerId, 
      syncState.peerWatermarkTable, 
      localData, 
      localDevice,
      { peerLastSynced: peer.lastSyncedTimestamp }
    );
    if (pendingEvents.length > 0) {
      rawOutboundDelta.syncEvents = pendingEvents;
    }

    const agreedCapabilities = peer.capabilities || ['core_entities'];
    const negotiatedVersion = peer.protocolVersion || 1;
    const outboundDelta = adaptOutboundPayloadForPeer(rawOutboundDelta, negotiatedVersion, agreedCapabilities);

    const sentCount = Object.values(outboundDelta.records).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0);
    totalTransferred += sentCount;

    // 4. Exchange deltas with the peer
    const inboundDelta = await exchangeDeltas(currentIp, peer.port, peer.pairingToken, outboundDelta);
    if (!inboundDelta || !inboundDelta.records) {
      emptyReport.errorMessage = `Peer rejected or failed to answer exchange request.`;
      await recordSyncHistory(emptyReport);
      return { success: false, report: emptyReport };
    }

    // Process incoming sync events (e.g. session cancellations)
    if (inboundDelta.syncEvents && Array.isArray(inboundDelta.syncEvents)) {
      for (const evt of inboundDelta.syncEvents) {
        if (evt.type === 'session_cancelled' && evt.payload?.lessonId) {
          const lessonId = evt.payload.lessonId;
          const lessons = localData['lessons'] || [];
          let updated = false;
          const updatedLessons = lessons.map((l: any) => {
            if (l.id === lessonId && l.status !== 'cancelled') {
              updated = true;
              return {
                ...l,
                status: 'cancelled',
                updatedAt: Date.now(),
                version: (l.version || 1) + 1
              };
            }
            return l;
          });
          if (updated) {
            localData['lessons'] = updatedLessons;
            await dataSource.saveMergedData('lessons', updatedLessons);
          }
        }
      }
    }

    // Clear sent outgoing sync events
    if (pendingEvents.length > 0) {
      await syncEventQueue.clearEvents(pendingEvents.map(e => e.id));
    }

    // 5. Ingestion Phase: Merge received records into local storage with diff tracking
    for (const [key, incomingRecords] of Object.entries(inboundDelta.records)) {
      if (Array.isArray(incomingRecords) && incomingRecords.length > 0) {
        totalTransferred += incomingRecords.length;
        const currentLocalRecords = localData[key] || [];
        const mergeResult = mergeEntities(currentLocalRecords, incomingRecords, key);
        
        entityDiffs[key] = mergeResult.diff;
        if (mergeResult.conflicts.length > 0) {
          allConflicts.push(...mergeResult.conflicts);
        }

        await dataSource.saveMergedData(key, mergeResult.merged);
      }
    }

    // 6. Update Watermarks
    let newWatermarks = syncState.peerWatermarkTable || {};
    
    // Acknowledge what we just sent successfully
    const sentRecords = Object.values(outboundDelta.records).flat() as SyncableRecord[];
    newWatermarks = updateWatermarks(newWatermarks, peerId, sentRecords);

    // Acknowledge what we just received
    const receivedRecords = Object.values(inboundDelta.records).flat() as SyncableRecord[];
    newWatermarks = updateWatermarks(newWatermarks, inboundDelta.senderDeviceId || peerId, receivedRecords);

    // 7. Update SyncStateMetadata and Peer Presence
    peer.lastSyncedTimestamp = Date.now();
    if (!peer.lastKnownIp || peer.lastKnownIp.trim() === '') {
      peer.lastKnownIp = 'P2P (WebRTC)';
    }
    peer.isOnline = true;
    peer.lastHeartbeat = Date.now();
    pairedPeers[peerIndex] = peer;

    await dataSource.updateSyncState({
      ...syncState,
      peerWatermarkTable: newWatermarks,
      pairedPeers
    });

    const finalReport: SyncCycleReport = {
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: Date.now(),
      peerId,
      peerName: peer.deviceName,
      direction: 'bidirectional',
      status: 'success',
      entities: entityDiffs,
      totalRecordsTransferred: totalTransferred,
      conflictsResolved: allConflicts.length,
      conflictDetails: allConflicts,
      durationMs: Date.now() - startTime
    };

    await recordSyncHistory(finalReport);
    return { success: true, report: finalReport };
  } catch (error: any) {
    console.error(`Sync cycle failed for peer ${peerId}:`, error);
    emptyReport.errorMessage = error?.message || 'Unexpected sync error.';
    emptyReport.durationMs = Date.now() - startTime;
    await recordSyncHistory(emptyReport);
    return { success: false, report: emptyReport };
  }
}

export async function handleInboundExchange(inboundDelta: SyncDeltaPayload, dataSource: SyncDataSource): Promise<SyncDeltaPayload> {
  const syncState = dataSource.getSyncState();
  const localData = dataSource.getLocalData();
  const peerId = inboundDelta.senderDeviceId;

  // Process incoming sync events (e.g. session cancellations)
  if (inboundDelta.syncEvents && Array.isArray(inboundDelta.syncEvents)) {
    for (const evt of inboundDelta.syncEvents) {
      if (evt.type === 'session_cancelled' && evt.payload?.lessonId) {
        const lessonId = evt.payload.lessonId;
        const lessons = localData['lessons'] || [];
        let updated = false;
        const updatedLessons = lessons.map((l: any) => {
          if (l.id === lessonId && l.status !== 'cancelled') {
            updated = true;
            return {
              ...l,
              status: 'cancelled',
              updatedAt: Date.now(),
              version: (l.version || 1) + 1
            };
          }
          return l;
        });
        if (updated) {
          localData['lessons'] = updatedLessons;
          await dataSource.saveMergedData('lessons', updatedLessons);
        }
      }
    }
  }

  // 1. Ingestion Phase: Merge received records into local storage
  for (const [key, incomingRecords] of Object.entries(inboundDelta.records)) {
    if (Array.isArray(incomingRecords) && incomingRecords.length > 0) {
      const currentLocalRecords = localData[key] || [];
      const { merged } = mergeEntities(currentLocalRecords, incomingRecords, key);
      await dataSource.saveMergedData(key, merged);
      localData[key] = merged;
    }
  }

  // 2. Build our delta payload to send back
  const localDevice = { id: syncState.localDeviceId, name: syncState.localDeviceName };
  const pendingEvents = await syncEventQueue.getPendingEvents();
  const pairedPeer = (syncState.pairedPeers || []).find(p => p.deviceId === peerId);
  const rawOutboundDelta = buildOutboundDelta(
    peerId, 
    syncState.peerWatermarkTable, 
    localData, 
    localDevice,
    { peerLastSynced: pairedPeer?.lastSyncedTimestamp }
  );
  if (pendingEvents.length > 0) {
    rawOutboundDelta.syncEvents = pendingEvents;
  }
  const outboundDelta = adaptOutboundPayloadForPeer(rawOutboundDelta, syncState.peerWatermarkTable[peerId] ? 1 : 1, ['core_entities']);

  if (pendingEvents.length > 0) {
    await syncEventQueue.clearEvents(pendingEvents.map(e => e.id));
  }

  // 3. Update Watermarks
  let newWatermarks = syncState.peerWatermarkTable || {};
  
  // Acknowledge what we just received
  const receivedRecords = Object.values(inboundDelta.records).flat() as SyncableRecord[];
  newWatermarks = updateWatermarks(newWatermarks, peerId, receivedRecords);

  // Acknowledge what we are sending back
  const sentRecords = Object.values(outboundDelta.records).flat() as SyncableRecord[];
  newWatermarks = updateWatermarks(newWatermarks, peerId, sentRecords);

  // Update paired peer timestamp
  const pairedPeers = syncState.pairedPeers || [];
  const peerIndex = pairedPeers.findIndex(p => p.deviceId === peerId);
  if (peerIndex !== -1) {
    pairedPeers[peerIndex].lastSyncedTimestamp = Date.now();
    pairedPeers[peerIndex].isOnline = true;
    pairedPeers[peerIndex].lastHeartbeat = Date.now();
  }

  await dataSource.updateSyncState({
    ...syncState,
    peerWatermarkTable: newWatermarks,
    pairedPeers
  });

  return outboundDelta;
}

/**
 * Resets watermarks for a specific peer and triggers a complete bidirectional synchronization.
 */
export async function forceFullSync(
  peerId: string, 
  dataSource: SyncDataSource
): Promise<{ success: boolean; report: SyncCycleReport }> {
  const syncState = dataSource.getSyncState();
  const updatedWatermarks = resetWatermarksForPeer(syncState.peerWatermarkTable, peerId);
  
  await dataSource.updateSyncState({
    ...syncState,
    peerWatermarkTable: updatedWatermarks
  });

  return runSyncCycle(peerId, dataSource);
}
