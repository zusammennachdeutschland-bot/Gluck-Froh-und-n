import assert from 'node:assert/strict';
import { runSyncCycle, SyncDataSource } from '../services/sync/syncOrchestrator';
import type { SyncableRecord } from '../types';

const run = async () => {
  const lessonId = 'lesson-completed-during-sync';
  let localLessons: any[] = [{
    id: lessonId, status: 'scheduled', updatedAt: 1000, date: '2026-11-21', time: '17:00'
  }];
  const dataSource: SyncDataSource = {
    getLocalData: () => ({ lessons: localLessons as SyncableRecord[] }),
    getSyncState: () => ({
      localDeviceId: 'local-device',
      localDeviceName: 'Local device',
      pairedPeers: [{
        deviceId: 'peer-device', deviceName: 'Peer device',
        protocolVersion: 1, capabilities: []
      }],
      peerWatermarkTable: {}
    } as any),
    saveMergedData: async (key, data) => {
      if (key === 'lessons') localLessons = data as any[];
    },
    updateSyncState: async () => {}
  };

  const result = await runSyncCycle('peer-device', dataSource, 'Manual Sync', async () => {
    // A user completes the lesson after the outbound snapshot, while transport is pending.
    localLessons = [{
      id: lessonId, status: 'completed', updatedAt: 3000,
      report: { attendanceStatus: 'present', teacherNotes: 'Completed during sync' }
    }];
    return {
      senderDeviceId: 'peer-device',
      records: { lessons: [{ id: lessonId, status: 'scheduled', updatedAt: 9000 }] }
    } as any;
  });

  assert.equal(result.success, true);
  assert.equal(localLessons.length, 1);
  assert.equal(localLessons[0].status, 'completed');
  assert.equal(localLessons[0].report.attendanceStatus, 'present');
  assert.equal(localLessons[0].report.teacherNotes, 'Completed during sync');
  console.log('✓ Sync-cycle concurrent lesson completion regression passed.');
};

run().catch(error => {
  console.error('✗ Sync-cycle concurrent lesson completion regression failed:', error);
  process.exitCode = 1;
});
