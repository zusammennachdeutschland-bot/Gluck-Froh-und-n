import { storage } from '../storageService';
import { SyncStateMetadata, TeacherSettingsRecord, TeacherProfile, CURRENT_SYNC_PROTOCOL_VERSION } from '../../types';

const MIGRATION_KEYS = [
  'dl_groups',
  'dl_students',
  'dl_lessons',
  'dl_payments',
  'dl_notifications',
  'dl_quick_todos'
];

/**
 * Generates a unique device ID for the local instance.
 */
function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Extracts a deterministic baseline timestamp from an existing record.
 * Falls back to 0 if no parsable date field is found.
 */
function extractTimestamp(item: any): number {
  if (!item) return 0;
  
  let timeValue: string | number | undefined;

  if (item.updatedAt) {
    return typeof item.updatedAt === 'number' ? item.updatedAt : new Date(item.updatedAt).getTime() || 0;
  } else if (item.createdAt) {
    timeValue = item.createdAt;
  } else if (item.joinedDate) {
    timeValue = item.joinedDate;
  } else if (item.date) {
    timeValue = item.time ? `${item.date}T${item.time}` : item.date;
  }

  if (timeValue !== undefined) {
    if (typeof timeValue === 'number') {
      return timeValue;
    }
    const parsed = new Date(timeValue).getTime();
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

/**
 * Safely creates or migrates the singleton TeacherSettingsRecord from dl_profile.
 */
export async function migrateTeacherSettings(localDeviceId: string): Promise<TeacherSettingsRecord> {
  const existingSettings = await storage.getItem<TeacherSettingsRecord[]>('dl_settings');
  if (Array.isArray(existingSettings) && existingSettings.length > 0 && existingSettings[0].id === 'singleton_teacher_settings') {
    return existingSettings[0];
  }

  const existingProfile = await storage.getItem<TeacherProfile>('dl_profile');
  const now = Date.now();

  const initialSettingsRecord: TeacherSettingsRecord = {
    id: 'singleton_teacher_settings',
    profile: existingProfile || {
      id: 'teacher_1',
      displayName: 'Teacher',
      email: '',
      avatarUrl: '',
      currency: 'EGP',
      language: 'de',
      isGoogleConnected: false,
      lastSyncedAt: null,
      workingHours: {
        workingDays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '21:00'
      },
      defaultZoomLink: '',
      defaultMeetLink: ''
    },
    schedulingPreferences: {
      defaultLessonDuration: 60,
      bufferBetweenLessonsMins: 15,
      autoAlertMinutes: 30
    },
    updatedAt: now,
    updatedByDeviceId: localDeviceId,
    originDeviceId: localDeviceId,
    originRevision: 1,
    deleted: false,
    syncedAt: now
  };

  await storage.setItem('dl_settings', [initialSettingsRecord]);
  return initialSettingsRecord;
}

/**
 * Executes Safe Multi-Version Sync Migration.
 * Migrates all existing local storage records and teacher settings to the SyncableRecord schema.
 */
export async function runSyncMigration(): Promise<void> {
  try {
    // 1. Check existing state
    const existingState = await storage.getItem<SyncStateMetadata>('dl_sync_state');
    
    if (existingState && existingState.localDeviceId) {
      // Incremental Migration: Ensure dl_settings exists
      await migrateTeacherSettings(existingState.localDeviceId);
      
      // Update protocol version if needed
      if (!existingState.protocolVersion || existingState.protocolVersion < CURRENT_SYNC_PROTOCOL_VERSION) {
        await storage.setItem('dl_sync_state', {
          ...existingState,
          protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION
        });
      }
      return;
    }

    const localDeviceId = generateDeviceId();

    // 2. Backup Phase: Extract all targeted keys
    const snapshot: Record<string, any[]> = {};
    for (const key of MIGRATION_KEYS) {
      const data = await storage.getItem<any[]>(key);
      snapshot[key] = Array.isArray(data) ? data : [];
    }

    // Serialize snapshot for recovery
    const serializedSnapshot = JSON.stringify(snapshot);
    await storage.setItem('dl_backup_premigration_snapshot', serializedSnapshot);

    // 3. Verify Phase: Read back and parse to ensure integrity
    const readBackString = await storage.getItem<string>('dl_backup_premigration_snapshot');
    if (!readBackString) {
      throw new Error('Sync Migration Aborted: Snapshot verification failed (empty read).');
    }

    let parsedSnapshot: Record<string, any[]>;
    try {
      parsedSnapshot = JSON.parse(readBackString);
    } catch (parseError) {
      throw new Error('Sync Migration Aborted: Snapshot verification failed (parse error).');
    }

    // 4. Mutation Phase: Inject sync metadata into memory arrays with duplicate prevention
    const migratedData: Record<string, any[]> = {};
    for (const key of MIGRATION_KEYS) {
      const items = parsedSnapshot[key] || [];
      const seenIds = new Set<string>();

      migratedData[key] = items.map((item, idx) => {
        let itemId = item?.id || `rec_${Date.now()}_${idx}`;
        if (seenIds.has(itemId)) {
          itemId = `${itemId}_migrated_${idx}`;
        }
        seenIds.add(itemId);

        return {
          ...item,
          id: itemId,
          updatedAt: extractTimestamp(item) || Date.now(),
          updatedByDeviceId: localDeviceId,
          originDeviceId: localDeviceId,
          originRevision: 1,
          deleted: !!item?.deleted,
          version: 1
        };
      });
    }

    // 5. Persistence Phase: Save migrated arrays back to storage
    for (const key of MIGRATION_KEYS) {
      await storage.setItem(key, migratedData[key]);
    }

    // 6. Migrate Teacher Settings
    await migrateTeacherSettings(localDeviceId);

    // 7. Initialization Phase: Create and store the foundational sync state
    const syncState: SyncStateMetadata = {
      localDeviceId,
      localDeviceName: 'My Device',
      localRevisionCounter: 1,
      peerWatermarkTable: {},
      protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION
    };

    await storage.setItem('dl_sync_state', syncState);

    console.log('Sync migration completed successfully.');
  } catch (error) {
    console.error('Critical Error during Sync Migration:', error);
    throw error;
  }
}

