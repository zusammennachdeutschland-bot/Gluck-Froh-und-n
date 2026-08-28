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

      const incomingVer = (incomingItem as any).version || 0;
      const localVer = (localItem as any).version || 0;

      if (incomingTime > localTime) {
        shouldAcceptIncoming = true;
      } else if (incomingTime === localTime) {
        // Higher version wins, then higher originRevision, then deterministic device ID tie-breaker
        if (incomingVer > localVer) {
          shouldAcceptIncoming = true;
          resolutionStrategy = 'TIE_BREAKER';
        } else if (incomingRev > localRev) {
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
      } else if (incomingVer > localVer && (incomingTime >= localTime - 5000)) {
        // Higher logical version with minor clock drift
        shouldAcceptIncoming = true;
        resolutionStrategy = 'TIE_BREAKER';
      } else if (((incomingItem.deleted && !localItem.deleted) || ((incomingItem as any).status === 'cancelled' && (localItem as any).status !== 'cancelled'))) {
        // Intentional deletion or session cancellation tombstone: prioritize cancellation/deletion if version >= local or reasonable timestamp
        if (incomingVer >= localVer || incomingTime >= localTime - 300000) {
          shouldAcceptIncoming = true;
          resolutionStrategy = 'TIE_BREAKER';
        }
      }

      if (shouldAcceptIncoming) {
        // If incoming item is not deleted, preserve non-empty local fields like certificateName (Latin name) if incoming is missing them
        let finalItem = incomingItem;
        if (!incomingItem.deleted && !localItem.deleted) {
          finalItem = {
            ...localItem,
            ...incomingItem,
            certificateName: (incomingItem as any).certificateName !== undefined && (incomingItem as any).certificateName !== ''
              ? (incomingItem as any).certificateName
              : ((localItem as any).certificateName || (incomingItem as any).certificateName || ''),
            documents: Array.isArray((incomingItem as any).documents) && (incomingItem as any).documents.length > 0
              ? (incomingItem as any).documents
              : ((localItem as any).documents || [])
          };
        }

        entityMap.set(incomingItem.id, finalItem);
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
        // Local won the conflict. If local is missing certificateName but incoming had it, backfill it cleanly.
        if (!localItem.deleted && !incomingItem.deleted) {
          const localCertName = (localItem as any).certificateName;
          const incomingCertName = (incomingItem as any).certificateName;
          if ((!localCertName || localCertName.trim() === '') && incomingCertName && incomingCertName.trim() !== '') {
            const backfilled = {
              ...localItem,
              certificateName: incomingCertName
            };
            entityMap.set(localItem.id, backfilled);
          }
        }

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

function mergeArrayById<T extends { id?: string }>(base: T[] = [], fallback: T[] = []): T[] {
  const map = new Map<string, T>();
  if (Array.isArray(fallback)) {
    for (const item of fallback) {
      if (item && item.id) map.set(item.id, item);
    }
  }
  if (Array.isArray(base)) {
    for (const item of base) {
      if (item && item.id) {
        const existing = map.get(item.id);
        map.set(item.id, existing ? { ...existing, ...item } : item);
      }
    }
  }
  return Array.from(map.values());
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
    displayNameEn: baseRecord?.profile?.displayNameEn ?? fallbackRecord?.profile?.displayNameEn,
    displayNameAr: baseRecord?.profile?.displayNameAr ?? fallbackRecord?.profile?.displayNameAr,
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
      },
      teacherSchedules: {
        ...fallbackRecord?.profile?.schoolSettings?.teacherSchedules,
        ...baseRecord?.profile?.schoolSettings?.teacherSchedules
      },
      stageManagers: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageManagers, fallbackRecord?.profile?.schoolSettings?.stageManagers),
      stageSecretaries: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageSecretaries, fallbackRecord?.profile?.schoolSettings?.stageSecretaries),
      visitRecords: mergeArrayById(baseRecord?.profile?.schoolSettings?.visitRecords, fallbackRecord?.profile?.schoolSettings?.visitRecords),
      bookletObservations: mergeArrayById(baseRecord?.profile?.schoolSettings?.bookletObservations, fallbackRecord?.profile?.schoolSettings?.bookletObservations),
      weeklyPlanStatuses: mergeArrayById(baseRecord?.profile?.schoolSettings?.weeklyPlanStatuses, fallbackRecord?.profile?.schoolSettings?.weeklyPlanStatuses),
      stageReports: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageReports, fallbackRecord?.profile?.schoolSettings?.stageReports),
      stageFollowUps: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageFollowUps, fallbackRecord?.profile?.schoolSettings?.stageFollowUps),
      teachers: mergeArrayById(baseRecord?.profile?.schoolSettings?.teachers, fallbackRecord?.profile?.schoolSettings?.teachers),
      complaints: mergeArrayById(baseRecord?.profile?.schoolSettings?.complaints, fallbackRecord?.profile?.schoolSettings?.complaints),
      actionPlans: mergeArrayById(baseRecord?.profile?.schoolSettings?.actionPlans, fallbackRecord?.profile?.schoolSettings?.actionPlans),
      parentComplaints: mergeArrayById(baseRecord?.profile?.schoolSettings?.parentComplaints, fallbackRecord?.profile?.schoolSettings?.parentComplaints)
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
