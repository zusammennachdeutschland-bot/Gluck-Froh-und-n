import { storage } from '../storageService';
import {
  SyncStateMetadata,
  TeacherSettingsRecord,
  TeacherProfile,
  CURRENT_SYNC_PROTOCOL_VERSION,
  PairedPeer
} from '../../types';

const MIGRATION_KEYS = [
  'dl_groups',
  'dl_students',
  'dl_lessons',
  'dl_payments',
  'dl_notifications',
  'dl_quick_todos',
  'dl_certificates',
  'hod_german_students',
  'hod_complaints',
  'hod_student_action_plans',
  'hod_visit_records',
  'dl_school_notes',
  'dl_finance_accounts',
  'dl_finance_categories',
  'dl_finance_transactions',
  'dl_finance_recurring',
  'dl_finance_installments'
];

function isNumericIpv4(value?: string): boolean {
  if (!value) return false;
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value.trim());
}

/**
 * Returns true if a paired peer is a legacy LAN-IP/PIN-as-IP record or was previously flagged as needing re-pairing.
 * Valid WebRTC P2P peers (`lastKnownIp === 'P2P (WebRTC)'` or `'P2P'` with `port === 0` and a stored token) return false.
 */
export function isLegacyLanOnlyPeer(peer: PairedPeer | null | undefined): boolean {
  if (!peer) return true;
  if (peer.requiresRePairing) return true;

  const ip = String(peer.lastKnownIp || '').trim();
  const port = Number(peer.port || 0);
  if (port > 0) return true;

  const isP2pMarker = ip === 'P2P (WebRTC)' || ip === 'P2P';
  if (!isP2pMarker) {
    // Numeric PIN-as-IP, IPv4, or empty non-P2P host
    if (/^\d{6}$/.test(ip) || isNumericIpv4(ip) || ip.length > 0) {
      return true;
    }
    return true;
  }

  return false;
}

/**
 * Normalizes SyncStateMetadata for local persistence.
 * Keeps P2P peer auth tokens intact across restarts so Web + Android remain paired without Electron/KeyStore,
 * while ensuring valid P2P peers are cleanly typed.
 */
export function sanitizeSyncStateForStorage(state: SyncStateMetadata): SyncStateMetadata {
  if (!state) return state;
  const cleanPeers: PairedPeer[] = Array.isArray(state.pairedPeers)
    ? state.pairedPeers.map((p) => ({
        ...p,
        port: Number(p.port || 0),
        hasStoredAuthToken: Boolean(p.pairingToken || p.hasStoredAuthToken)
      }))
    : [];

  return {
    ...state,
    pairedPeers: cleanPeers
  };
}

/**
 * Strips sensitive pairing secrets (`pairingPin`, per-peer `pairingToken`) before displaying or exporting diagnostics.
 */
export function redactSyncStateForDiagnostics(state: SyncStateMetadata | null | undefined): any {
  if (!state) return null;
  const { pairingPin: _omitPin, ...restState } = state;
  return {
    ...restState,
    ...(typeof state.pairingPin === 'string' && state.pairingPin ? { pairingPin: '[REDACTED]' } : {}),
    pairedPeers: Array.isArray(state.pairedPeers)
      ? state.pairedPeers.map((peer) => {
          const { pairingToken, ...restPeer } = peer;
          return {
            ...restPeer,
            ...(pairingToken ? { pairingToken: '[REDACTED]' } : {}),
            hasStoredAuthToken: Boolean(pairingToken || peer.hasStoredAuthToken)
          };
        })
      : []
  };
}

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
  if (
    Array.isArray(existingSettings) &&
    existingSettings.length > 0 &&
    existingSettings[0].id === 'singleton_teacher_settings'
  ) {
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
 * Migrates paired peer records when transitioning back to WebRTC P2P sync:
 * - Preserves valid `P2P (WebRTC)` / `P2P` peers with `port: 0` cleanly (clearing accidental `requiresRePairing` if a token is intact; keeping `requiresRePairing` if its token was wiped).
 * - Flags legacy LAN-IP (`192.168.x.x` / `port > 0`) or PIN-as-IP peers with `requiresRePairing: true` without deleting watermarks or user data.
 */
export function migrateLegacyPeerRecords(state: SyncStateMetadata): {
  migratedState: SyncStateMetadata;
  didChange: boolean;
} {
  if (!state || !Array.isArray(state.pairedPeers)) {
    return { migratedState: state, didChange: false };
  }

  let didChange = false;
  const upgradedPeers: PairedPeer[] = state.pairedPeers.map((rawPeer) => {
    const ip = String(rawPeer.lastKnownIp || '').trim();
    const port = Number(rawPeer.port || 0);
    const hasToken = Boolean(rawPeer.pairingToken);
    const wasP2p =
      (ip === 'P2P (WebRTC)' || ip === 'P2P' || rawPeer.legacyMigratedFrom === 'P2P (WebRTC)' || rawPeer.legacyMigratedFrom === 'P2P') &&
      port === 0;

    if (wasP2p) {
      if (hasToken && rawPeer.requiresRePairing) {
        didChange = true;
        return {
          ...rawPeer,
          lastKnownIp: 'P2P (WebRTC)',
          port: 0,
          hasStoredAuthToken: true,
          requiresRePairing: false
        };
      }
      if (!hasToken && !rawPeer.requiresRePairing) {
        didChange = true;
        return {
          ...rawPeer,
          lastKnownIp: 'P2P (WebRTC)',
          port: 0,
          hasStoredAuthToken: false,
          requiresRePairing: true,
          isOnline: false
        };
      }
      return {
        ...rawPeer,
        lastKnownIp: 'P2P (WebRTC)',
        port: 0,
        hasStoredAuthToken: hasToken || Boolean(rawPeer.hasStoredAuthToken)
      };
    }

    // Legacy LAN-only peer or PIN-as-IP
    if (!rawPeer.requiresRePairing || port > 0 || isNumericIpv4(ip) || /^\d{6}$/.test(ip)) {
      didChange = true;
      return {
        ...rawPeer,
        lastKnownIp: ip,
        port,
        requiresRePairing: true,
        isOnline: false,
        legacyMigratedFrom: rawPeer.legacyMigratedFrom || (isNumericIpv4(ip) ? 'lan_ip' : ip || 'legacy')
      };
    }

    return rawPeer;
  });

  if (!didChange) {
    return { migratedState: state, didChange: false };
  }

  return {
    migratedState: sanitizeSyncStateForStorage({
      ...state,
      pairedPeers: upgradedPeers
    }),
    didChange: true
  };
}

/**
 * Executes Safe Multi-Version Sync Migration.
 */
export async function runSyncMigration(): Promise<void> {
  try {
    const existingState = await storage.getItem<SyncStateMetadata>('dl_sync_state');

    if (existingState && existingState.localDeviceId) {
      await migrateTeacherSettings(existingState.localDeviceId);

      const { migratedState, didChange } = migrateLegacyPeerRecords(existingState);
      const needsProtocolBump =
        !migratedState.protocolVersion || migratedState.protocolVersion < CURRENT_SYNC_PROTOCOL_VERSION;

      if (didChange || needsProtocolBump) {
        await storage.setItem(
          'dl_sync_state',
          sanitizeSyncStateForStorage({
            ...migratedState,
            protocolVersion: Math.max(CURRENT_SYNC_PROTOCOL_VERSION, migratedState.protocolVersion || 0)
          })
        );
      }
      return;
    }

    const localDeviceId = generateDeviceId();

    const snapshot: Record<string, any[]> = {};
    for (const key of MIGRATION_KEYS) {
      const data = await storage.getItem<any[]>(key);
      snapshot[key] = Array.isArray(data) ? data : [];
    }

    const serializedSnapshot = JSON.stringify(snapshot);
    await storage.setItem('dl_backup_premigration_snapshot', serializedSnapshot);

    const readBackString = await storage.getItem<string>('dl_backup_premigration_snapshot');
    if (!readBackString) {
      throw new Error('Sync Migration Aborted: Snapshot verification failed (empty read).');
    }

    let parsedSnapshot: Record<string, any[]>;
    try {
      parsedSnapshot = JSON.parse(readBackString);
    } catch {
      throw new Error('Sync Migration Aborted: Snapshot verification failed (parse error).');
    }

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

    for (const key of MIGRATION_KEYS) {
      await storage.setItem(key, migratedData[key]);
    }

    await migrateTeacherSettings(localDeviceId);

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
