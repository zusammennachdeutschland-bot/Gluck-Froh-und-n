import assert from 'node:assert/strict';
import { mergeEntities, mergeTeacherSettings } from '../services/sync/mergeEngine';
import { SyncableRecord, TeacherSettingsRecord } from '../types';

interface TestEntity extends SyncableRecord {
  id: string;
  name?: string;
  certificateName?: string;
  status?: string;
  groupId?: string;
  version?: number;
}

export function runMergeEngineTests(): { passed: boolean; log: string[] } {
  const log: string[] = [];

  // 1. Insert new incoming records and count created/deleted accurately
  const initialLocal: TestEntity[] = [
    { id: '1', name: 'Local One', updatedAt: 1000, originRevision: 1 },
  ];
  const incomingNew: TestEntity[] = [
    { id: '2', name: 'Remote Two', updatedAt: 2000, originRevision: 1 },
    { id: '3', name: 'Remote Deleted', updatedAt: 2000, originRevision: 1, deleted: true },
  ];
  const res1 = mergeEntities(initialLocal, incomingNew, 'student');
  assert.equal(res1.createdCount, 1);
  assert.equal(res1.deletedCount, 1);
  assert.equal(res1.merged.length, 3);
  log.push('[PASS] mergeEntities inserts unseen remote entities and tracks created vs deleted counts');

  // 2. Last-Write-Wins (LWW) & preserving local certificateName when remote is newer but missing certificateName
  const localStudent: TestEntity[] = [
    { id: 's1', name: 'أحمد', certificateName: 'Ahmed Mohamed', updatedAt: 1000, originRevision: 1 },
  ];
  const incomingStudent: TestEntity[] = [
    { id: 's1', name: 'أحمد محمد', certificateName: '', updatedAt: 2000, originRevision: 2 },
  ];
  const res2 = mergeEntities(localStudent, incomingStudent, 'student');
  assert.equal(res2.updatedCount, 1);
  assert.equal(res2.merged[0].name, 'أحمد محمد');
  assert.equal(res2.merged[0].certificateName, 'Ahmed Mohamed');
  assert.equal(res2.conflicts[0].winner, 'remote');
  log.push('[PASS] mergeEntities resolves LWW in favor of newer remote while preserving local non-empty certificateName');

  // 3. Preserve local deletion tombstone against older or slightly drifted non-deleted remote item
  const localDeleted: TestEntity[] = [
    { id: 'l1', name: 'Deleted Lesson', deleted: true, updatedAt: 5000, version: 2 },
  ];
  const remoteActiveDrifted: TestEntity[] = [
    { id: 'l1', name: 'Deleted Lesson', deleted: false, updatedAt: 5500, version: 2 },
  ];
  const res3 = mergeEntities(localDeleted, remoteActiveDrifted, 'lesson');
  assert.equal(res3.merged[0].deleted, true);
  assert.equal(res3.conflicts[0].winner, 'local');
  log.push('[PASS] mergeEntities preserves local deletion tombstone against drifted remote non-deleted record');

  // 4. Deterministic tie-breaker when timestamps are equal
  const localTie: TestEntity[] = [
    { id: 't1', name: 'Local', updatedAt: 3000, originRevision: 2, updatedByDeviceId: 'dev_A' },
  ];
  const remoteTie: TestEntity[] = [
    { id: 't1', name: 'Remote', updatedAt: 3000, originRevision: 3, updatedByDeviceId: 'dev_B' },
  ];
  const res4 = mergeEntities(localTie, remoteTie, 'group');
  assert.equal(res4.merged[0].name, 'Remote');
  assert.equal(res4.conflicts[0].resolutionStrategy, 'TIE_BREAKER');
  log.push('[PASS] mergeEntities uses originRevision/deviceId tie-breaker when updatedAt timestamps match');

  // 5. mergeTeacherSettings merges nested schoolSettings arrays by ID without losing local items
  const localSettings: TeacherSettingsRecord = {
    id: 'singleton_teacher_settings',
    updatedAt: 1000,
    profile: {
      displayName: 'Herr Ali',
      schoolSettings: {
        teachers: [{ id: 't1', name: 'Teacher 1', isActive: true }],
      } as any,
    } as any,
    schedulingPreferences: { defaultLessonDuration: 60, bufferBetweenLessonsMins: 15, autoAlertMinutes: 30 },
  };
  const remoteSettings: TeacherSettingsRecord = {
    id: 'singleton_teacher_settings',
    updatedAt: 2000,
    profile: {
      displayName: 'Herr Ali Updated',
      schoolSettings: {
        teachers: [{ id: 't2', name: 'Teacher 2', isActive: true }],
      } as any,
    } as any,
    schedulingPreferences: { defaultLessonDuration: 45, bufferBetweenLessonsMins: 15, autoAlertMinutes: 30 },
  };
  const mergedSettings = mergeTeacherSettings(localSettings, remoteSettings);
  assert.equal(mergedSettings.profile.displayName, 'Herr Ali Updated');
  assert.equal(mergedSettings.profile.schoolSettings?.teachers?.length, 2);
  log.push('[PASS] mergeTeacherSettings merges nested schoolSettings arrays by ID without wiping fallback items');

  return { passed: true, log };
}

const result = runMergeEngineTests();
result.log.forEach(line => console.log(line));
