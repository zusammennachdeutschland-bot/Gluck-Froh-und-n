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
import { exchangeDeltas, fetchPeerPageImageManifest, fetchPeerPageImageChunk } from './syncClient';
import { buildOutboundDelta, updateWatermarks, resetWatermarksForPeer } from './deltaBuilder';
import { mergeEntities, mergePurgedTombstones, mergeRecentlyDeleted } from './mergeEngine';
import { syncHistoryService } from './syncHistoryService';
import { negotiateProtocol, adaptOutboundPayloadForPeer } from './protocolNegotiator';
import { syncEventQueue } from './syncEventQueue';
import { recalculateAllAccountBalances } from '../financeService';
import { isLegacyLanOnlyPeer, sanitizeSyncStateForStorage } from './syncMigration';
import {
  DEFAULT_PAGE_IMAGE_CHUNK_SIZE,
  GrammarPageImageChunk,
  PageImageChunkAssembler,
  computePageImageChecksum,
  getAllStoredPageImageRecords,
  getPageImageRecord,
  hasPageImageRecord,
  listStoredPageImageIds,
  savePageImageRecord,
  splitPageImageIntoChunks
} from '../../shared/lernstudioPageImageStore';

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
    const collectionsToSweep = [
      'groups',
      'students',
      'lessons',
      'schoolNotes',
      'notifications',
      'certificates',
      'hodStudents',
      'hodComplaints',
      'hodActionPlans',
      'hodVisits',
      'customAiBackgrounds',
      'homeworkAssignments',
      'homeworkSubmissions',
      'lernstudioSets'
    ];
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

    if (isLegacyLanOnlyPeer(peer) && !customExchangeDeltasFn) {
      peer.isOnline = false;
      peer.requiresRePairing = true;
      peer.lastErrorCode = 'UNAUTHORIZED_DEVICE';
      peer.lastErrorMessage = 'Legacy LAN pairing requires re-pairing over P2P WebRTC.';
      pairedPeers[peerIndex] = peer;
      await dataSource.updateSyncState(sanitizeSyncStateForStorage({ ...syncState, pairedPeers }));
      emptyReport.errorMessage = peer.lastErrorMessage;
      await recordSyncHistory(emptyReport, trigger, 0, 0);
      return { success: false, report: emptyReport };
    }

    const workingPeer: PairedPeer = customExchangeDeltasFn
      ? { ...peer }
      : {
          ...peer,
          lastKnownIp: 'P2P (WebRTC)',
          port: 0
        };

    // 3. Negotiate capabilities and build the outbound delta payload
    let localData = dataSource.getLocalData();
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
      { peerLastSynced: workingPeer.lastSyncedTimestamp }
    );
    if (pendingEvents.length > 0) {
      rawOutboundDelta.syncEvents = pendingEvents;
    }

    const agreedCapabilities = (workingPeer.capabilities && workingPeer.capabilities.length > 0)
      ? workingPeer.capabilities
      : DEFAULT_CAPABILITIES;
    const negotiatedVersion = workingPeer.protocolVersion || CURRENT_SYNC_PROTOCOL_VERSION;
    const outboundDelta = adaptOutboundPayloadForPeer(rawOutboundDelta, negotiatedVersion, agreedCapabilities);

    sentCount = Object.values(outboundDelta.records).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0);
    totalTransferred += sentCount;

    // 4. Exchange deltas with the peer over direct WebRTC P2P
    let inboundDelta: SyncDeltaPayload | null = null;
    if (customExchangeDeltasFn) {
      inboundDelta = await customExchangeDeltasFn(outboundDelta);
      if (!inboundDelta || !inboundDelta.records) {
        emptyReport.errorMessage = 'Peer rejected or failed to answer exchange request.';
        await recordSyncHistory(emptyReport, trigger, sentCount, 0);
        return { success: false, report: emptyReport };
      }
    } else {
      const exchangeRes = await exchangeDeltas(workingPeer, outboundDelta);
      if (!exchangeRes.ok || !exchangeRes.delta || !exchangeRes.delta.records) {
        const errCode = exchangeRes.errorCode || 'PEER_OFFLINE';
        const errMsg = exchangeRes.message || `P2P exchange failed (${errCode})`;
        workingPeer.isOnline =
          errCode !== 'PEER_OFFLINE' &&
          errCode !== 'BROKER_DOWN' &&
          errCode !== 'ICE_FAILED' &&
          errCode !== 'TIMEOUT';
        workingPeer.lastErrorCode = errCode;
        workingPeer.lastErrorMessage = errMsg;
        if (errCode === 'UNAUTHORIZED_DEVICE') {
          workingPeer.requiresRePairing = true;
        }
        pairedPeers[peerIndex] = workingPeer;
        await dataSource.updateSyncState(sanitizeSyncStateForStorage({ ...syncState, pairedPeers }));
        emptyReport.errorMessage = errMsg;
        await recordSyncHistory(emptyReport, trigger, sentCount, 0);
        return { success: false, report: emptyReport };
      }
      inboundDelta = exchangeRes.delta;
      workingPeer.lastKnownIp = 'P2P (WebRTC)';
      workingPeer.port = 0;
      if (exchangeRes.iceCandidateType) workingPeer.iceCandidateType = exchangeRes.iceCandidateType;
      if (typeof exchangeRes.latencyMs === 'number') workingPeer.latencyMs = exchangeRes.latencyMs;
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

    // C2: re-read fresh local data immediately before the merge — a lesson
    // completed locally during the exchange (after the outbound snapshot in
    // step 3) must be visible to the merge, or the incoming stale snapshot
    // overwrites the completion. Step 5 changes were already persisted via
    // saveMergedData, so the fresh read includes them.
    localData = dataSource.getLocalData();

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
        const shouldDeferUnknown = !hasAuthoritativeTombstones && (key === 'groups' || key === 'students' || key === 'lessons' || key === 'lernstudioSets');

        const mergeResult = mergeEntities(currentLocalRecords, incomingRecords, {
          entityTypeName: key,
          purgedRecords: activePurgedRecords,
          deferUnknownActiveIds: shouldDeferUnknown,
          knownLocalIds,
          // runSyncCycle exchanges only with a paired peer (the transport
          // authenticates it), so the peer's deviceId is the authenticated
          // sender for owner-wins origin checks. Known devices: this peer
          // plus every other paired peer (relayed records) and ourselves.
          authenticatedPeerDeviceId: peerId,
          knownPeerDeviceIds: [
            ...((syncState.pairedPeers || []).map((p: any) => String(p?.deviceId || '')).filter(Boolean)),
            String(syncState.localDeviceId || '')
          ]
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

    // 8. Update SyncStateMetadata and Peer Presence (strip any legacy plaintext tokens)
    workingPeer.lastSyncedTimestamp = Date.now();
    workingPeer.isOnline = true;
    workingPeer.lastHeartbeat = Date.now();
    workingPeer.lastErrorCode = undefined;
    workingPeer.lastErrorMessage = undefined;
    pairedPeers[peerIndex] = workingPeer;

    await dataSource.updateSyncState(
      sanitizeSyncStateForStorage({
        ...syncState,
        peerWatermarkTable: newWatermarks,
        pairedPeers
      })
    );

    const finalReport: SyncCycleReport = {
      id: cycleId,
      timestamp: Date.now(),
      peerId,
      peerName: workingPeer.deviceName,
      direction: 'bidirectional',
      status: 'success',
      entities: entityDiffs,
      totalRecordsTransferred: totalTransferred,
      conflictsResolved: allConflicts.length,
      conflictDetails: allConflicts,
      durationMs: Date.now() - startTime
    };

    await recordSyncHistory(finalReport, trigger, sentCount, receivedCount);

    // Non-blocking background transfer of any missing grammar textbook page images
    if (!customExchangeDeltasFn) {
      void syncMissingPageImagesWithPeer({ peer: workingPeer, dataSource }).catch(() => {});
    }

    return { success: true, report: finalReport };
  } catch (error: any) {
    console.error(`Sync cycle failed for peer ${peerId}:`, error);
    emptyReport.errorMessage = error?.message || 'Unexpected sync error.';
    emptyReport.durationMs = Date.now() - startTime;
    await recordSyncHistory(emptyReport, trigger, sentCount, receivedCount);
    return { success: false, report: emptyReport };
  }
}

export async function handleInboundExchange(
  inboundDelta: SyncDeltaPayload,
  dataSource: SyncDataSource,
  options?: { authenticatedPeerDeviceId?: string }
): Promise<SyncDeltaPayload> {
  const syncState = dataSource.getSyncState();
  let localData = dataSource.getLocalData();
  const peerId = inboundDelta.senderDeviceId;
  // When the caller authenticated the sender (localServer exchange route),
  // owner-wins checks verify record origins against it. Without it (legacy /
  // test callers) the merge falls back to the self-asserted fields only.
  const authenticatedPeerDeviceId = options?.authenticatedPeerDeviceId;

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

  // C2: re-read fresh local data immediately before the merge — same
  // staleness as runSyncCycle step 6: a local mutation that landed while
  // the tombstone sweep / event handling awaited must be visible to the
  // merge. Step 1 changes were already persisted via saveMergedData.
  localData = dataSource.getLocalData();

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
      const shouldDeferUnknown = !hasAuthoritativeTombstones && (key === 'groups' || key === 'students' || key === 'lessons' || key === 'lernstudioSets');

      const mergeResult = mergeEntities(currentLocalRecords, incomingRecords, {
        entityTypeName: key,
        purgedRecords: activePurgedRecords,
        deferUnknownActiveIds: shouldDeferUnknown,
        knownLocalIds,
        ...(authenticatedPeerDeviceId
          ? {
              authenticatedPeerDeviceId,
              knownPeerDeviceIds: [
                ...((syncState.pairedPeers || []).map((p: any) => String(p?.deviceId || '')).filter(Boolean)),
                String(syncState.localDeviceId || '')
              ]
            }
          : {})
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

export interface PageImageManifestEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: number;
  checksum: string;
  totalChunks: number;
}

export interface PageImageSyncTransport {
  fetchManifest: (params: {
    requestedImageIds: string[];
    existingImageIds: string[];
  }) => Promise<{ availableImages: PageImageManifestEntry[] } | null>;
  fetchChunk: (params: {
    imageId: string;
    chunkIndex: number;
    chunkSizeChars?: number;
  }) => Promise<GrammarPageImageChunk | null>;
}

/**
 * Collects unique referenced textbook page image IDs from local Lernstudio sets & homework assignments.
 */
export function collectReferencedPageImageIds(localData: Record<string, any>): string[] {
  const ids = new Set<string>();
  const sets = Array.isArray(localData?.lernstudioSets) ? localData.lernstudioSets : [];
  for (const s of sets) {
    const refs = s?.grammarContent?.pageImageRefs;
    if (!Array.isArray(refs)) continue;
    for (const r of refs) {
      const id = String(r?.id || r?.localStorageKey || '').trim();
      if (id) ids.add(id);
    }
  }
  const homeworks = Array.isArray(localData?.homeworkAssignments) ? localData.homeworkAssignments : [];
  for (const hw of homeworks) {
    const refs = hw?.setSnapshot?.grammarContent?.pageImageRefs;
    if (!Array.isArray(refs)) continue;
    for (const r of refs) {
      const id = String(r?.id || r?.localStorageKey || '').trim();
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}

export async function buildLocalPageImageManifest(params?: {
  requestedImageIds?: string[];
  existingImageIds?: string[];
  chunkSizeChars?: number;
}): Promise<{ availableImages: PageImageManifestEntry[] }> {
  const chunkSize = Math.max(1024, params?.chunkSizeChars || DEFAULT_PAGE_IMAGE_CHUNK_SIZE);
  const existingSet = new Set(
    (Array.isArray(params?.existingImageIds) ? params.existingImageIds : []).map((x) => String(x || '').trim())
  );
  const requestedSet =
    Array.isArray(params?.requestedImageIds) && params.requestedImageIds.length > 0
      ? new Set(params.requestedImageIds.map((x) => String(x || '').trim()).filter(Boolean))
      : null;

  const allLocal = await getAllStoredPageImageRecords();
  const availableImages: PageImageManifestEntry[] = [];
  for (const rec of allLocal) {
    if (!rec?.id) continue;
    if (existingSet.has(rec.id)) continue;
    if (requestedSet && !requestedSet.has(rec.id)) continue;
    const checksum = rec.checksum || computePageImageChecksum(rec.base64Data);
    const totalChunks = Math.max(1, Math.ceil((rec.base64Data || '').length / chunkSize));
    availableImages.push({
      id: rec.id,
      fileName: rec.fileName,
      mimeType: rec.mimeType || 'image/jpeg',
      sizeBytes: rec.sizeBytes,
      ...(typeof rec.width === 'number' ? { width: rec.width } : {}),
      ...(typeof rec.height === 'number' ? { height: rec.height } : {}),
      createdAt: rec.createdAt || Date.now(),
      checksum,
      totalChunks
    });
  }
  return { availableImages };
}

export async function getLocalPageImageChunk(params: {
  imageId: string;
  chunkIndex: number;
  chunkSizeChars?: number;
}): Promise<GrammarPageImageChunk> {
  const imageId = String(params.imageId || '').trim();
  const rec = await getPageImageRecord(imageId);
  if (!rec) {
    throw new Error(`Page image ${imageId} not found on peer.`);
  }
  const chunks = splitPageImageIntoChunks(rec, params.chunkSizeChars || DEFAULT_PAGE_IMAGE_CHUNK_SIZE);
  const chunkIdx = Number(params.chunkIndex);
  if (!Number.isInteger(chunkIdx) || chunkIdx < 0 || chunkIdx >= chunks.length) {
    throw new Error(`Chunk index ${chunkIdx} out of range for ${imageId}.`);
  }
  return chunks[chunkIdx];
}

/**
 * Transfers any missing grammar textbook page images from a paired peer in bounded chunks,
 * skipping duplicates, retrying interrupted chunks, and validating checksums prior to saving.
 * Never throws: failures are reported cleanly without disturbing P2P delta sync.
 */
export async function syncMissingPageImagesWithPeer(params: {
  peer: Pick<PairedPeer, 'deviceId'> & Partial<PairedPeer>;
  dataSource: SyncDataSource;
  transport?: PageImageSyncTransport;
  chunkSizeChars?: number;
  maxRetriesPerChunk?: number;
}): Promise<{
  transferredIds: string[];
  skippedExistingIds: string[];
  failedIds: string[];
  error?: string;
}> {
  const transferredIds: string[] = [];
  const skippedExistingIds: string[] = [];
  const failedIds: string[] = [];
  const chunkSizeChars = Math.max(1024, params.chunkSizeChars || DEFAULT_PAGE_IMAGE_CHUNK_SIZE);
  const maxRetries = Math.max(1, params.maxRetriesPerChunk ?? 3);

  try {
    const localData = params.dataSource.getLocalData();
    const referencedIds = collectReferencedPageImageIds(localData);
    if (referencedIds.length === 0) {
      return { transferredIds, skippedExistingIds, failedIds };
    }

    const existingIds = await listStoredPageImageIds();
    const existingSet = new Set(existingIds);
    const missingIds: string[] = [];
    for (const id of referencedIds) {
      if (existingSet.has(id) || (await hasPageImageRecord(id))) {
        skippedExistingIds.push(id);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      return { transferredIds, skippedExistingIds, failedIds };
    }

    const fullPeer: PairedPeer = {
      deviceId: params.peer.deviceId,
      deviceName: params.peer.deviceName || 'Peer Device',
      lastKnownIp: params.peer.lastKnownIp || 'P2P (WebRTC)',
      port: typeof params.peer.port === 'number' ? params.peer.port : 0,
      pairingToken: params.peer.pairingToken,
      hasStoredAuthToken: params.peer.hasStoredAuthToken,
      lastSyncedTimestamp: params.peer.lastSyncedTimestamp || 0,
      isOnline: params.peer.isOnline ?? true
    };

    const transport: PageImageSyncTransport = params.transport || {
      fetchManifest: ({ requestedImageIds, existingImageIds }) =>
        fetchPeerPageImageManifest(fullPeer, requestedImageIds, existingImageIds),
      fetchChunk: ({ imageId, chunkIndex, chunkSizeChars: sz }) =>
        fetchPeerPageImageChunk(fullPeer, imageId, chunkIndex, sz)
    };

    const manifestResp = await transport.fetchManifest({
      requestedImageIds: missingIds,
      existingImageIds: existingIds
    });
    const availableImages = Array.isArray(manifestResp?.availableImages) ? manifestResp.availableImages : [];
    if (availableImages.length === 0) {
      return { transferredIds, skippedExistingIds, failedIds };
    }

    for (const meta of availableImages) {
      if (!meta?.id) continue;
      if (await hasPageImageRecord(meta.id)) {
        skippedExistingIds.push(meta.id);
        continue;
      }

      const assembler = new PageImageChunkAssembler({
        imageId: meta.id,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        width: meta.width,
        height: meta.height,
        createdAt: meta.createdAt,
        checksum: meta.checksum,
        totalChunks: meta.totalChunks
      });

      // Bounded resume loop: retries any missing chunks up to maxRetries attempts
      for (let round = 0; round < maxRetries; round++) {
        const missingChunkIndices = assembler.getMissingChunkIndices();
        if (missingChunkIndices.length === 0) break;

        for (const chunkIdx of missingChunkIndices) {
          try {
            const chunk = await transport.fetchChunk({
              imageId: meta.id,
              chunkIndex: chunkIdx,
              chunkSizeChars
            });
            if (chunk) {
              assembler.addChunk(chunk);
            }
          } catch {
            // Retry on next round
          }
        }
      }

      const finalized = assembler.finalizeRecord();
      if (!finalized.ok) {
        failedIds.push(meta.id);
        continue;
      }

      await savePageImageRecord(finalized.record);
      transferredIds.push(meta.id);
    }

    return { transferredIds, skippedExistingIds, failedIds };
  } catch (err: any) {
    return {
      transferredIds,
      skippedExistingIds,
      failedIds,
      error: err?.message || 'Page image P2P transfer failed'
    };
  }
}

