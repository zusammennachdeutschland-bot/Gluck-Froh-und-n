import { Capacitor } from '@capacitor/core';
import { SyncableRecord } from '../../types';

export function detectLocalOriginPlatform(localDeviceId?: string): 'android' | 'web' {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      return 'android';
    }
    if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '')) {
      return 'android';
    }
    if (localDeviceId && /android/i.test(localDeviceId)) {
      return 'android';
    }
  } catch {
    // ignore environment detection errors
  }
  return 'web';
}

export function trackLocalMutation<T extends SyncableRecord>(
  record: T,
  localDeviceId: string,
  newLocalRevision: number,
  explicitOriginPlatform?: 'android' | 'web'
): T {
  const nextVersion = (typeof record.version === 'number' && Number.isFinite(record.version) ? record.version : 0) + 1;
  return {
    ...record,
    updatedAt: Date.now(),
    updatedByDeviceId: localDeviceId,
    originDeviceId: localDeviceId,
    originPlatform: explicitOriginPlatform || record.originPlatform || detectLocalOriginPlatform(localDeviceId),
    originRevision: newLocalRevision,
    version: nextVersion,
  };
}

export function trackLocalDeletion<T extends SyncableRecord>(
  record: T,
  localDeviceId: string,
  newLocalRevision: number,
  explicitOriginPlatform?: 'android' | 'web'
): T {
  const nextVersion = (typeof record.version === 'number' && Number.isFinite(record.version) ? record.version : 0) + 1;
  return {
    ...record,
    updatedAt: Date.now(),
    updatedByDeviceId: localDeviceId,
    originDeviceId: localDeviceId,
    originPlatform: explicitOriginPlatform || record.originPlatform || detectLocalOriginPlatform(localDeviceId),
    originRevision: newLocalRevision,
    version: nextVersion,
    deleted: true,
  };
}

export function getActiveRecords<T extends SyncableRecord>(records: T[]): T[] {
  return records.filter((record) => record.deleted !== true);
}

