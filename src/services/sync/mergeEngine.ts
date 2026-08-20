import { SyncableRecord, SyncConflictRecord, SyncEntityDiff, TeacherSettingsRecord } from '../../types';

export interface MergeResult<T extends SyncableRecord> {
  merged: T[];
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  conflicts: SyncConflictRecord[];
  diff: SyncEntityDiff;
}

export function mergeEntities<T extends SyncableRecord>(
  localArray: T[],
  incomingArray: T[],
  entityTypeName: string = 'entity'
): MergeResult<T> {
  const entityMap = new Map<string, T>();
  
  // Populate initial map with local entities
  for (const localItem of localArray) {
    if (localItem && localItem.id) {
      entityMap.set(localItem.id, localItem);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;
  const conflicts: SyncConflictRecord[] = [];

  for (const incomingItem of incomingArray) {
    if (!incomingItem || !incomingItem.id) continue;
    const localItem = entityMap.get(incomingItem.id);

    if (!localItem) {
      // Incoming record does not exist locally, insert it
      entityMap.set(incomingItem.id, incomingItem);
      if (incomingItem.deleted) {
        deletedCount++;
      } else {
        createdCount++;
      }
    } else {
      // Conflict resolution based on Last-Write-Wins (LWW)
      const incomingTime = incomingItem.updatedAt || 0;
      const localTime = localItem.updatedAt || 0;
      const incomingRev = incomingItem.originRevision || 0;
      const localRev = localItem.originRevision || 0;

      // Check if this is a specialized TeacherSettingsRecord
      if (incomingItem.id === 'singleton_teacher_settings') {
        const mergedSettings = mergeTeacherSettings(
          localItem as unknown as TeacherSettingsRecord,
          incomingItem as unknown as TeacherSettingsRecord
        );
        entityMap.set(incomingItem.id, mergedSettings as unknown as T);
        updatedCount++;
        conflicts.push({
          entityType: 'settings',
          entityId: incomingItem.id,
          localUpdatedAt: localTime,
          remoteUpdatedAt: incomingTime,
          winner: incomingTime >= localTime ? 'remote' : 'local',
          resolutionStrategy: 'FIELD_MERGE',
          timestamp: Date.now()
        });
        continue;
      }

      // Conflict logging
      let shouldAcceptIncoming = false;
      let resolutionStrategy: 'LWW' | 'TIE_BREAKER' | 'FIELD_MERGE' = 'LWW';

      if (incomingTime > localTime) {
        shouldAcceptIncoming = true;
      } else if (incomingTime === localTime) {
        // Higher originRevision wins, or deterministic tie-breaker using device IDs
        if (incomingRev > localRev) {
          shouldAcceptIncoming = true;
          resolutionStrategy = 'TIE_BREAKER';
        } else if (incomingRev === localRev) {
          const incomingDeviceId = incomingItem.updatedByDeviceId || incomingItem.originDeviceId || '';
          const localDeviceId = localItem.updatedByDeviceId || localItem.originDeviceId || '';

          if (incomingDeviceId > localDeviceId) {
            shouldAcceptIncoming = true;
            resolutionStrategy = 'TIE_BREAKER';
          }
        }
      }

      if (shouldAcceptIncoming) {
        entityMap.set(incomingItem.id, incomingItem);
        if (incomingItem.deleted && !localItem.deleted) {
          deletedCount++;
        } else {
          updatedCount++;
        }
        
        conflicts.push({
          entityType: entityTypeName,
          entityId: incomingItem.id,
          localUpdatedAt: localTime,
          remoteUpdatedAt: incomingTime,
          winner: 'remote',
          resolutionStrategy,
          timestamp: Date.now()
        });
      } else {
        // Local won the conflict
        if (incomingTime !== localTime || incomingRev !== localRev) {
          conflicts.push({
            entityType: entityTypeName,
            entityId: incomingItem.id,
            localUpdatedAt: localTime,
            remoteUpdatedAt: incomingTime,
            winner: 'local',
            resolutionStrategy,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  return {
    merged: Array.from(entityMap.values()),
    createdCount,
    updatedCount,
    deletedCount,
    conflicts,
    diff: {
      created: createdCount,
      updated: updatedCount,
      deleted: deletedCount,
      conflicts: conflicts.length
    }
  };
}

/**
 * Merges teacher settings with field-level fallbacks so partial remote edits do not wipe local fields.
 */
export function mergeTeacherSettings(
  local: TeacherSettingsRecord,
  incoming: TeacherSettingsRecord
): TeacherSettingsRecord {
  const localTime = local?.updatedAt || 0;
  const incomingTime = incoming?.updatedAt || 0;

  const isIncomingNewer = incomingTime >= localTime;
  const baseRecord = isIncomingNewer ? incoming : local;
  const fallbackRecord = isIncomingNewer ? local : incoming;

  const mergedProfile = {
    ...fallbackRecord?.profile,
    ...baseRecord?.profile,
    workingHours: {
      ...fallbackRecord?.profile?.workingHours,
      ...baseRecord?.profile?.workingHours
    },
    weeklyWorkingHours: baseRecord?.profile?.weeklyWorkingHours || fallbackRecord?.profile?.weeklyWorkingHours,
    parentMessageTemplates: {
      ...fallbackRecord?.profile?.parentMessageTemplates,
      ...baseRecord?.profile?.parentMessageTemplates
    },
    schoolSettings: baseRecord?.profile?.schoolSettings || fallbackRecord?.profile?.schoolSettings ? {
      ...fallbackRecord?.profile?.schoolSettings,
      ...baseRecord?.profile?.schoolSettings,
      presence: {
        ...fallbackRecord?.profile?.schoolSettings?.presence,
        ...baseRecord?.profile?.schoolSettings?.presence
      },
      periodSettings: {
        ...fallbackRecord?.profile?.schoolSettings?.periodSettings,
        ...baseRecord?.profile?.schoolSettings?.periodSettings,
        customDurations: {
          ...fallbackRecord?.profile?.schoolSettings?.periodSettings?.customDurations,
          ...baseRecord?.profile?.schoolSettings?.periodSettings?.customDurations
        }
      },
      schedule: {
        ...fallbackRecord?.profile?.schoolSettings?.schedule,
        ...baseRecord?.profile?.schoolSettings?.schedule
      }
    } : undefined
  };

  return {
    id: 'singleton_teacher_settings',
    profile: mergedProfile,
    schedulingPreferences: {
      ...fallbackRecord?.schedulingPreferences,
      ...baseRecord?.schedulingPreferences
    },
    updatedAt: Math.max(localTime, incomingTime, Date.now()),
    updatedByDeviceId: isIncomingNewer ? incoming?.updatedByDeviceId : local?.updatedByDeviceId,
    originDeviceId: isIncomingNewer ? incoming?.originDeviceId : local?.originDeviceId,
    originRevision: Math.max(local?.originRevision || 1, incoming?.originRevision || 1),
    deleted: false,
    syncedAt: Date.now()
  };
}
