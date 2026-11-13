import { SyncableRecord } from '../../types';

export function trackLocalMutation<T extends SyncableRecord>(
  record: T,
  localDeviceId: string,
  newLocalRevision: number
): T {
  const nextVersion = (typeof record.version === 'number' && Number.isFinite(record.version) ? record.version : 0) + 1;
  return {
    ...record,
    updatedAt: Date.now(),
    updatedByDeviceId: localDeviceId,
    originDeviceId: localDeviceId,
    originRevision: newLocalRevision,
    version: nextVersion,
  };
}

export function trackLocalDeletion<T extends SyncableRecord>(
  record: T,
  localDeviceId: string,
  newLocalRevision: number
): T {
  const nextVersion = (typeof record.version === 'number' && Number.isFinite(record.version) ? record.version : 0) + 1;
  return {
    ...record,
    updatedAt: Date.now(),
    updatedByDeviceId: localDeviceId,
    originDeviceId: localDeviceId,
    originRevision: newLocalRevision,
    version: nextVersion,
    deleted: true,
  };
}

export function getActiveRecords<T extends SyncableRecord>(records: T[]): T[] {
  return records.filter((record) => record.deleted !== true);
}
