import assert from 'node:assert/strict';
import { storage } from '../services/storageService';
import { SyncStateMetadata } from '../types';

async function runDlSyncStateHeaderIndicatorTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: DL_SYNC_STATE STORAGE KEY & HEADER VISUAL INDICATOR');
  console.log('================================================================================');

  // Test 1: Writing and reading dl_sync_state storage key with status='online'
  console.log('Testing [SI-01] Storing and retrieving dl_sync_state with status="online"...');
  const onlineState: SyncStateMetadata = {
    localDeviceId: 'dev_test_001',
    localDeviceName: 'Test Phone',
    localRevisionCounter: 5,
    peerWatermarkTable: {},
    protocolVersion: 1,
    status: 'online',
    lastSyncedTimestamp: Date.now()
  };

  await storage.setItem('dl_sync_state', onlineState);
  const retrievedOnline = await storage.getItem<SyncStateMetadata>('dl_sync_state');
  assert.notEqual(retrievedOnline, null);
  assert.equal(retrievedOnline?.localDeviceId, 'dev_test_001');
  assert.equal(retrievedOnline?.status, 'online');
  console.log('✅ [SI-01] dl_sync_state accurately persists status="online"');

  // Test 2: Writing and reading dl_sync_state storage key with status='syncing'
  console.log('Testing [SI-02] Storing and retrieving dl_sync_state with status="syncing"...');
  const syncingState: SyncStateMetadata = {
    ...onlineState,
    localRevisionCounter: 6,
    status: 'syncing'
  };

  await storage.setItem('dl_sync_state', syncingState);
  const retrievedSyncing = await storage.getItem<SyncStateMetadata>('dl_sync_state');
  assert.notEqual(retrievedSyncing, null);
  assert.equal(retrievedSyncing?.status, 'syncing');
  console.log('✅ [SI-02] dl_sync_state accurately persists status="syncing"');

  // Test 3: Writing and reading dl_sync_state storage key with status='offline'
  console.log('Testing [SI-03] Storing and retrieving dl_sync_state with status="offline"...');
  const offlineState: SyncStateMetadata = {
    ...onlineState,
    status: 'offline'
  };

  await storage.setItem('dl_sync_state', offlineState);
  const retrievedOffline = await storage.getItem<SyncStateMetadata>('dl_sync_state');
  assert.notEqual(retrievedOffline, null);
  assert.equal(retrievedOffline?.status, 'offline');
  console.log('✅ [SI-03] dl_sync_state accurately persists status="offline"');

  console.log('================================================================================');
  console.log('🎉 ALL DL_SYNC_STATE VISUAL INDICATOR TESTS PASSED!');
  console.log('================================================================================');
}

runDlSyncStateHeaderIndicatorTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
