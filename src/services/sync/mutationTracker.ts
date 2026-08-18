import { SyncableRecord } from '../../types';

export function trackLocalMutation<T extends SyncableRecord>(
  record: T,
  localDeviceId: string,
  newLocalRevision: number
): T {
  return {
    ...record,
    updatedAt: Date.now(),
    updatedByDeviceId: localDeviceId,
    originDeviceId: localDeviceId,
    originRevision: newLocalRevision,
  };
}

export function trackLocalDeletion<T extends SyncableRecord>(
  record: T,
  localDeviceId: string,
  newLocalRevision: number
): T {
  return {
    ...record,
    updatedAt: Date.now(),
    updatedByDeviceId: localDeviceId,
    originDeviceId: localDeviceId,
    originRevision: newLocalRevision,
    deleted: true,
  };
}

export function getActiveRecords<T extends SyncableRecord>(records: T[]): T[] {
  return records.filter((record) => record.deleted !== true);
}
