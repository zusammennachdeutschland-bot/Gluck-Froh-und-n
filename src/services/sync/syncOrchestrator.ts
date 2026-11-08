import { 
  SyncStateMetadata, 
  PairedPeer, 
  SyncableRecord, 
  SyncDeltaPayload, 
  SyncCycleReport, 
  SyncEntityDiff, 
  SyncConflictRecord,
  SyncTriggerSource,
  FinanceAccount,
  FinanceTransaction,
  DEFAULT_CAPABILITIES,
  CURRENT_SYNC_PROTOCOL_VERSION,
  PurgedRecordTombstone,
  TeacherSettingsRecord
} from '../../types';
import { exchangeDeltas } from './syncClient';
import { resolvePeerIp } from './discoveryService';
import { buildOutboundDelta, updateWatermarks, resetWatermarksForPeer } from './deltaBuilder';
import { mergeEntities, mergePurgedTombstones, mergeRecentlyDeleted } from './mergeEngine';
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
async function recordSyncHistory(
  report: SyncCycleReport,
  trigger: SyncTriggerSource = 'Manual Sync',
  uploadedCount: number = 0,
  downloadedCount: number = 0
): Promise<void> {
  try {
    await syncHistoryService.addEntry(report, trigger, uploadedCount, downloadedCount);
  } catch (err) {
    console.warn('Failed to record sync history:', err);
  }
}

/**
 * Extracts authoritative PurgedRecordTombstones from both local data and an inbound P2P delta,
 * merges them into local `settings[0].recentlyDeleted`, and sweeps all local collections
 * (`groups`, `students`, `lessons`, `schoolNotes`, `notifications`) so incoming tombstones
 * remove already-existing active records even when the peer delta omits those entity arrays.
 */
async function ingestAndSweepPurgedTombstonesOnDataSource(
  localData: Record<string, SyncableRecord[]>,
  inboundDelta: SyncDeltaPayload,
  dataSource: SyncDataSource,
  entityDiffs?: Record<string, SyncEntityDiff>
): Promise<{
  activePurgedRecords: PurgedRecordTombstone[];
  hasAuthoritativeTombstones: boolean;
}> {
  const localSettings = Array.isArray(localData['settings']) ? (localData['settings'] as TeacherSettingsRecord[]) : [];
  const localTeacherSettings = localSettings.find(s => s && s.id === 'singleton_teacher_settings');

  const inboundSettings = Array.isArray(inboundDelta.records?.['settings'])
    ? (inboundDelta.records['settings'] as TeacherSettingsRecord[])
    : [];
  const inboundTeacherSettings = inboundSettings.find(s => s && s.id === 'singleton_teacher_settings');

  const hasInboundSettingsTombstones = Boolean(
    inboundTeacherSettings &&
    inboundTeacherSettings.recentlyDeleted &&
    Array.isArray(inboundTeacherSettings.recentlyDeleted.purgedRecords)
  );
  const hasTopLevelTombstones = Array.isArray(inboundDelta.purgedRecords);
  const hasAuthoritativeTombstones = Boolean(
    inboundDelta.hasAuthoritativeTombstones ||
    hasTopLevelTombstones ||
    hasInboundSettingsTombstones
  );

  let activePurgedRecords = mergePurgedTombstones(
    localTeacherSettings?.recentlyDeleted?.purgedRecords,
    mergePurgedTombstones(
      inboundTeacherSettings?.recentlyDeleted?.purgedRecords,
      inboundDelta.purgedRecords
    )
  );

  // Discover cascade tombstones from local/inbound students and lessons belonging to purged groups/students
  const purgedGroupIds = new Set(activePurgedRecords.filter(p => p.type === 'group').map(p => p.id.trim()));
  const purgedStudentIds = new Set(activePurgedRecords.filter(p => p.type === 'student').map(p => p.id.trim()));
  const nowStr = new Date().toISOString();
  const nowMs = Date.now();
  const derivedCascade: PurgedRecordTombstone[] = [];

  const allKnownStudents: any[] = [
    ...(Array.isArray(localData['students']) ? localData['students'] : []),
    ...(Array.isArray(inboundDelta.records?.['students']) ? inboundDelta.records['students']! : []),
    ...(localTeacherSettings?.recentlyDeleted?.students?.map(d => d.item) || []),
    ...(inboundTeacherSettings?.recentlyDeleted?.students?.map(d => d.item) || [])
  ];
  for (const s of allKnownStudents) {
    if (!s || !s.id) continue;
    const grpId = (s.groupId || s.archivedGroupId || '').trim();
    if (grpId && purgedGroupIds.has(grpId) && !purgedStudentIds.has(s.id.trim())) {
      purgedStudentIds.add(s.id.trim());
      derivedCascade.push({ id: s.id.trim(), type: 'student', purgedAt: nowStr, updatedAt: nowMs, originRevision: 1 });
    }
  }

  const allKnownLessons: any[] = [
    ...(Array.isArray(localData['lessons']) ? localData['lessons'] : []),
    ...(Array.isArray(inboundDelta.records?.['lessons']) ? inboundDelta.records['lessons']! : []),
    ...(localTeacherSettings?.recentlyDeleted?.lessons?.map(d => d.item) || []),
    ...(inboundTeacherSettings?.recentlyDeleted?.lessons?.map(d => d.item) || [])
  ];
  for (const l of allKnownLessons) {
    if (!l || !l.id) continue;
    const grpId = (l.groupId || '').trim();
    const stId = (l.studentId || '').trim();
    if ((grpId && purgedGroupIds.has(grpId)) || (stId && purgedStudentIds.has(stId))) {
      derivedCascade.push({ id: l.id.trim(), type: 'lesson', purgedAt: nowStr, updatedAt: nowMs, originRevision: 1 });
    }
  }

  if (derivedCascade.length > 0) {
    activePurgedRecords = mergePurgedTombstones(activePurgedRecords, derivedCascade);
  }

  // Persist merged tombstones into local settings even if inboundDelta didn't send a full settings record
  if (localTeacherSettings && activePurgedRecords.length > 0) {
    const mergedRec = mergeRecentlyDeleted(
      localTeacherSettings.recentlyDeleted,
      {
        students: inboundTeacherSettings?.recentlyDeleted?.students || [],
        groups: inboundTeacherSettings?.recentlyDeleted?.groups || [],
        lessons: inboundTeacherSettings?.recentlyDeleted?.lessons || [],
        purgedRecords: activePurgedRecords
      }
    );
    const updatedSettingsRecord: TeacherSettingsRecord = {
      ...localTeacherSettings,
      recentlyDeleted: mergedRec
    };
    const nextSettingsArr = localSettings.map(s =>
      s && s.id === 'singleton_teacher_settings' ? updatedSettingsRecord : s
    );
    localData['settings'] = nextSettingsArr;
    await dataSource.saveMergedData('settings', nextSettingsArr);
  }

  // Sweep existing local collections against activePurgedRecords even if inboundDelta omitted those collections
  if (activePurgedRecords.length > 0) {
    const collectionsToSweep = ['groups', 'students', 'lessons', 'schoolNotes', 'notifications'];
    for (const colKey of collectionsToSweep) {
      const currentLocalRecords = Array.isArray(localData[colKey]) ? localData[colKey] : [];
      if (currentLocalRecords.length === 0) continue;
      const incomingForCol = (inboundDelta.records as any)?.[colKey];
      if (!Array.isArray(incomingForCol) || incomingForCol.length === 0) {
        const sweepRes = mergeEntities(currentLocalRecords, [], {
          entityTypeName: colKey,
          purgedRecords: activePurgedRecords
        });
        if (sweepRes.deletedCount > 0 || sweepRes.merged.length !== currentLocalRecords.length) {
          localData[colKey] = sweepRes.merged;
          if (entityDiffs) {
            entityDiffs[colKey] = sweepRes.diff;
          }
          await dataSource.saveMergedData(colKey, sweepRes.merged);
        }
      }
    }
  }

  return {
    activePurgedRecords,
    hasAuthoritativeTombstones
  };
}

export async function runSyncCycle(
  peerId: string, 
  dataSource: SyncDataSource,
  trigger: SyncTriggerSource = 'Manual Sync',
  customExchangeDeltasFn?: (outboundDelta: SyncDeltaPayload) => Promise<SyncDeltaPayload | null>
): Promise<{ success: boolean; report: SyncCycleReport }> {
  const startTime = Date.now();
  const cycleId = 'sync_' + startTime + '_' + Math.random().toString(36).slice(2, 7);
  const entityDiffs: Record<string, SyncEntityDiff> = {};
  const allConflicts: SyncConflictRecord[] = [];
  let totalTransferred = 0;
  let sentCount = 0;
  let receivedCount = 0;

  const emptyReport: SyncCycleReport = {
    id: cycleId,
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
      await recordSyncHistory(emptyReport, trigger, 0, 0);
      return { success: false, report: emptyReport };
    }

    const peer = pairedPeers[peerIndex];
    emptyReport.peerName = peer.deviceName || 'Peer Device';

    // 2. Resolve peer's current IP dynamically (unless custom transport is injected)
    let currentIp: string | null = peer.lastKnownIp || '127.0.0.1';
    if (!customExchangeDeltasFn) {
      currentIp = await resolvePeerIp(peer);
      if (!currentIp) {
        emptyReport.errorMessage = `Device is currently offline or unreachable.`;
        await recordSyncHistory(emptyReport, trigger, 0, 0);
        return { success: false, report: emptyReport };
      }
    }

    // 3. Negotiate capabilities and build the outbound delta payload
    const localData = dataSource.getLocalData();
    const localDevice = { id: syncState.localDeviceId, name: syncState.localDeviceName };
    let pendingEvents: any[] = [];
    try {
      pendingEvents = await syncEventQueue.getPendingEvents();
    } catch {
      pendingEvents = [];
    }
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

    const agreedCapabilities = (peer.capabilities && peer.capabilities.length > 0)
      ? peer.capabilities
      : DEFAULT_CAPABILITIES;
    const negotiatedVersion = peer.protocolVersion || CURRENT_SYNC_PROTOCOL_VERSION;
    const outboundDelta = adaptOutboundPayloadForPeer(rawOutboundDelta, negotiatedVersion, agreedCapabilities);

    sentCount = Object.values(outboundDelta.records).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0);
    totalTransferred += sentCount;

    // 4. Exchange deltas with the peer
    const inboundDelta = customExchangeDeltasFn
      ? await customExchangeDeltasFn(outboundDelta)
      : await exchangeDeltas(currentIp!, peer.port, peer.pairingToken, outboundDelta);
    if (!inboundDelta || !inboundDelta.records) {
      emptyReport.errorMessage = `Peer rejected or failed to answer exchange request.`;
      await recordSyncHistory(emptyReport, trigger, sentCount, 0);
      return { success: false, report: emptyReport };
    }

    // 5. Ingest and sweep authoritative tombstones FIRST (before session events or entity merges)
    const { activePurgedRecords, hasAuthoritativeTombstones } = await ingestAndSweepPurgedTombstonesOnDataSource(
      localData,
      inboundDelta,
      dataSource,
      entityDiffs
    );
    const purgedIdSet = new Set(activePurgedRecords.map(p => p.id.trim()));

    // Process incoming sync events (e.g. session cancellations), ignoring events for permanently purged lessons
    if (inboundDelta.syncEvents && Array.isArray(inboundDelta.syncEvents)) {
      for (const evt of inboundDelta.syncEvents) {
        if (evt.type === 'session_cancelled' && evt.payload?.lessonId) {
          const lessonId = String(evt.payload.lessonId).trim();
          if (purgedIdSet.has(lessonId)) continue;
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

    // 6. Ingestion Phase: Merge received records into local storage with diff tracking & deferral guard
    const deferredRecordIds = new Set<string>();
    const orderedKeys = Object.keys(inboundDelta.records).sort((a, b) => {
      if (a === 'settings') return -1;
      if (b === 'settings') return 1;
      return 0;
    });

    for (const key of orderedKeys) {
      const incomingRecords = (inboundDelta.records as any)[key];
      if (Array.isArray(incomingRecords) && incomingRecords.length > 0) {
        receivedCount += incomingRecords.length;
        totalTransferred += incomingRecords.length;
        const currentLocalRecords = localData[key] || [];
        const knownLocalIds = new Set(currentLocalRecords.filter(r => r && r.id).map(r => r.id.trim()));
        const shouldDeferUnknown = !hasAuthoritativeTombstones && (key === 'groups' || key === 'students' || key === 'lessons');

        const mergeResult = mergeEntities(currentLocalRecords, incomingRecords, {
          entityTypeName: key,
          purgedRecords: activePurgedRecords,
          deferUnknownActiveIds: shouldDeferUnknown,
          knownLocalIds
        });

        if (mergeResult.deferredIds && mergeResult.deferredIds.length > 0) {
          mergeResult.deferredIds.forEach(id => deferredRecordIds.add(id));
        }

        entityDiffs[key] = mergeResult.diff;
        if (mergeResult.conflicts.length > 0) {
          allConflicts.push(...mergeResult.conflicts);
        }

        localData[key] = mergeResult.merged;
        await dataSource.saveMergedData(key, mergeResult.merged);
      }
    }

    // 7. Update Watermarks (excluding any deferred records so they will be re-requested once tombstones are known)
    let newWatermarks = syncState.peerWatermarkTable || {};
    
    // Acknowledge what we just sent successfully
    const sentRecords = Object.values(outboundDelta.records).flat().filter(Boolean) as SyncableRecord[];
    newWatermarks = updateWatermarks(newWatermarks, peerId, sentRecords);

    // Acknowledge what we just received and processed (excluding deferred records)
    const receivedRecords = (Object.values(inboundDelta.records).flat().filter(Boolean) as SyncableRecord[])
      .filter(r => r && r.id && !deferredRecordIds.has(r.id.trim()));
    newWatermarks = updateWatermarks(newWatermarks, inboundDelta.senderDeviceId || peerId, receivedRecords);

    // 8. Update SyncStateMetadata and Peer Presence
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
      id: cycleId,
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

    await recordSyncHistory(finalReport, trigger, sentCount, receivedCount);
    return { success: true, report: finalReport };
  } catch (error: any) {
    console.error(`Sync cycle failed for peer ${peerId}:`, error);
    emptyReport.errorMessage = error?.message || 'Unexpected sync error.';
    emptyReport.durationMs = Date.now() - startTime;
    await recordSyncHistory(emptyReport, trigger, sentCount, receivedCount);
    return { success: false, report: emptyReport };
  }
}

export async function handleInboundExchange(inboundDelta: SyncDeltaPayload, dataSource: SyncDataSource): Promise<SyncDeltaPayload> {
  const syncState = dataSource.getSyncState();
  const localData = dataSource.getLocalData();
  const peerId = inboundDelta.senderDeviceId;

  // 1. Ingest and sweep authoritative tombstones FIRST
  const { activePurgedRecords, hasAuthoritativeTombstones } = await ingestAndSweepPurgedTombstonesOnDataSource(
    localData,
    inboundDelta,
    dataSource
  );
  const purgedIdSet = new Set(activePurgedRecords.map(p => p.id.trim()));

  // Process incoming sync events (e.g. session cancellations), ignoring purged lessons
  if (inboundDelta.syncEvents && Array.isArray(inboundDelta.syncEvents)) {
    for (const evt of inboundDelta.syncEvents) {
      if (evt.type === 'session_cancelled' && evt.payload?.lessonId) {
        const lessonId = String(evt.payload.lessonId).trim();
        if (purgedIdSet.has(lessonId)) continue;
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

  // 2. Ingestion Phase: Merge received records into local storage with centralized tombstone enforcement
  const deferredRecordIds = new Set<string>();
  const orderedKeys = Object.keys(inboundDelta.records || {}).sort((a, b) => {
    if (a === 'settings') return -1;
    if (b === 'settings') return 1;
    return 0;
  });

  for (const key of orderedKeys) {
    const incomingRecords = (inboundDelta.records as any)[key];
    if (Array.isArray(incomingRecords) && incomingRecords.length > 0) {
      const currentLocalRecords = localData[key] || [];
      const knownLocalIds = new Set(currentLocalRecords.filter(r => r && r.id).map(r => r.id.trim()));
      const shouldDeferUnknown = !hasAuthoritativeTombstones && (key === 'groups' || key === 'students' || key === 'lessons');

      const mergeResult = mergeEntities(currentLocalRecords, incomingRecords, {
        entityTypeName: key,
        purgedRecords: activePurgedRecords,
        deferUnknownActiveIds: shouldDeferUnknown,
        knownLocalIds
      });

      if (mergeResult.deferredIds && mergeResult.deferredIds.length > 0) {
        mergeResult.deferredIds.forEach(id => deferredRecordIds.add(id));
      }

      await dataSource.saveMergedData(key, mergeResult.merged);
      localData[key] = mergeResult.merged;
    }
  }

  // 3. Build our delta payload to send back (including full DEFAULT_CAPABILITIES when negotiated or supported)
  const localDevice = { id: syncState.localDeviceId, name: syncState.localDeviceName };
  let pendingEvents: any[] = [];
  try {
    pendingEvents = await syncEventQueue.getPendingEvents();
  } catch {
    pendingEvents = [];
  }
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

  const agreedCapabilities = inboundDelta.header?.capabilities?.length
    ? inboundDelta.header.capabilities
    : (pairedPeer?.capabilities && pairedPeer.capabilities.length > 0 ? pairedPeer.capabilities : DEFAULT_CAPABILITIES);
  const negotiatedVersion = inboundDelta.header?.protocolVersion || pairedPeer?.protocolVersion || CURRENT_SYNC_PROTOCOL_VERSION;
  const outboundDelta = adaptOutboundPayloadForPeer(rawOutboundDelta, negotiatedVersion, agreedCapabilities);

  if (pendingEvents.length > 0) {
    try {
      await syncEventQueue.clearEvents(pendingEvents.map(e => e.id));
    } catch {
      // Ignore in non-browser environment
    }
  }

  // 4. Update Watermarks (excluding deferred records)
  let newWatermarks = syncState.peerWatermarkTable || {};
  
  const receivedRecords = (Object.values(inboundDelta.records || {}).flat().filter(Boolean) as SyncableRecord[])
    .filter(r => r && r.id && !deferredRecordIds.has(r.id.trim()));
  newWatermarks = updateWatermarks(newWatermarks, peerId, receivedRecords);

  const sentRecords = Object.values(outboundDelta.records || {}).flat().filter(Boolean) as SyncableRecord[];
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
  dataSource: SyncDataSource,
  trigger: SyncTriggerSource = 'Force Full Sync'
): Promise<{ success: boolean; report: SyncCycleReport }> {
  const syncState = dataSource.getSyncState();
  const updatedWatermarks = resetWatermarksForPeer(syncState.peerWatermarkTable, peerId);
  
  await dataSource.updateSyncState({
    ...syncState,
    peerWatermarkTable: updatedWatermarks
  });

  return runSyncCycle(peerId, dataSource, trigger);
}
