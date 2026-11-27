import {
  CURRENT_SYNC_PROTOCOL_VERSION,
  DEFAULT_CAPABILITIES,
  PAIRING_PIN_TTL_MS,
  P2pHostStartResult,
  PairedPeer,
  SyncDeltaPayload,
  SyncStateMetadata
} from '../../types';
import {
  buildLocalPageImageManifest,
  getLocalPageImageChunk,
  handleInboundExchange,
  syncMissingPageImagesWithPeer,
  SyncDataSource
} from './syncOrchestrator';
import {
  peerNetwork,
  createP2pError,
  getP2pErrorCode
} from './peerNetwork';
import { negotiateProtocol, findAuthenticatedPeer } from './protocolNegotiator';
import { sanitizeSyncStateForStorage } from './syncMigration';
import { presenceService } from './presenceService';
import { storage } from '../storageService';

let activeDataSource: SyncDataSource | null = null;
let lastKnownHostStatus: P2pHostStartResult | null = null;
const hostStatusListeners = new Set<(status: P2pHostStartResult) => void>();

// PIN brute-force lockout: 5 wrong pairing PINs from the same remote device
// lock that device out of /api/sync/pair for 5 minutes. The 6-digit PIN has
// only 900k values, so without a lockout an attacker on the local network
// could guess it. Keyed by the remote deviceId the caller claims (or
// 'unknown' when none is sent); a successful pairing clears the entry.
const PIN_LOCKOUT_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000;
const pinLockoutByDevice = new Map<string, { failures: number; lockedUntilMs: number }>();

function isPinLockedOut(deviceKey: string): boolean {
  const entry = pinLockoutByDevice.get(deviceKey);
  if (!entry) return false;
  if (entry.lockedUntilMs > 0 && Date.now() < entry.lockedUntilMs) return true;
  if (entry.lockedUntilMs > 0 && Date.now() >= entry.lockedUntilMs) {
    pinLockoutByDevice.delete(deviceKey);
    return false;
  }
  return false;
}

function recordPinFailure(deviceKey: string): boolean {
  const entry = pinLockoutByDevice.get(deviceKey) || { failures: 0, lockedUntilMs: 0 };
  entry.failures += 1;
  if (entry.failures >= PIN_LOCKOUT_MAX_ATTEMPTS) {
    entry.lockedUntilMs = Date.now() + PIN_LOCKOUT_MS;
  }
  pinLockoutByDevice.set(deviceKey, entry);
  return entry.lockedUntilMs > 0 && Date.now() < entry.lockedUntilMs;
}

function clearPinLockout(deviceKey: string): void {
  pinLockoutByDevice.delete(deviceKey);
}

/** Test hook: clears all PIN lockout state. */
export function __resetPinLockoutForTests(): void {
  pinLockoutByDevice.clear();
}

function generateSixDigitPin(): string {
  const bytes = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 900000) + 100000;
  }
  const num = 100000 + (bytes[0] % 900000);
  return String(num);
}

function generateAuthToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `glk_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `glk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function notifyHostListeners(status: P2pHostStartResult) {
  lastKnownHostStatus = status;
  for (const listener of hostStatusListeners) {
    try {
      listener(status);
    } catch {}
  }
}

export function subscribeP2pHostStatus(listener: (status: P2pHostStartResult) => void): () => void {
  hostStatusListeners.add(listener);
  if (lastKnownHostStatus) {
    listener(lastKnownHostStatus);
  }
  return () => {
    hostStatusListeners.delete(listener);
  };
}

export function getLocalHostStatus(): P2pHostStartResult {
  if (lastKnownHostStatus) {
    return lastKnownHostStatus;
  }
  const hasPin =
    peerNetwork.brokerConnected &&
    Boolean(peerNetwork.currentPairingPin) &&
    peerNetwork.currentPairingPinExpiresAt > Date.now();
  return {
    listening: Boolean(peerNetwork.brokerConnected),
    brokerConnected: Boolean(peerNetwork.brokerConnected),
    peerId: peerNetwork.myId || '',
    deviceId: peerNetwork.myDeviceId || '',
    pin: hasPin ? peerNetwork.currentPairingPin! : '',
    pinExpiresAt: hasPin ? peerNetwork.currentPairingPinExpiresAt : 0,
    errorCode: peerNetwork.lastHostErrorCode || undefined,
    errorMessage: peerNetwork.lastHostErrorMessage || undefined
  };
}

/**
 * Returns the persisted valid 6-digit PIN + expiry if not yet expired, or creates & persists a new one.
 * Never regenerates a still-valid PIN.
 */
export async function getOrEnsureActivePairingPin(
  stateInput?: SyncStateMetadata,
  dataSource?: SyncDataSource,
  ttlMs: number = PAIRING_PIN_TTL_MS
): Promise<{ pin: string; pinExpiresAt: number }> {
  const ds = dataSource || activeDataSource;
  const state = stateInput || ds?.getSyncState() || (await storage.getItem<SyncStateMetadata>('dl_sync_state'));
  const now = Date.now();

  if (
    state?.pairingPin &&
    /^\d{6}$/.test(state.pairingPin) &&
    typeof state.pairingPinExpiresAt === 'number' &&
    state.pairingPinExpiresAt > now
  ) {
    return {
      pin: state.pairingPin,
      pinExpiresAt: state.pairingPinExpiresAt
    };
  }

  const nextPin = generateSixDigitPin();
  const nextExpiresAt = now + Math.max(1000, ttlMs);

  if (state) {
    const updatedState = sanitizeSyncStateForStorage({
      ...state,
      pairingPin: nextPin,
      pairingPinExpiresAt: nextExpiresAt,
      pairingPinUpdatedAt: now
    });
    if (ds) {
      await ds.updateSyncState(updatedState);
    } else {
      await storage.setItem('dl_sync_state', updatedState);
    }
  }

  return { pin: nextPin, pinExpiresAt: nextExpiresAt };
}

async function persistPairingPin(
  pin: string,
  expiresAt: number,
  dataSource?: SyncDataSource
): Promise<void> {
  const ds = dataSource || activeDataSource;
  const current = ds?.getSyncState() || (await storage.getItem<SyncStateMetadata>('dl_sync_state'));
  if (!current) return;
  const nextState = sanitizeSyncStateForStorage({
    ...current,
    pairingPin: pin,
    pairingPinExpiresAt: expiresAt,
    pairingPinUpdatedAt: Date.now()
  });
  if (ds) {
    await ds.updateSyncState(nextState);
  } else {
    await storage.setItem('dl_sync_state', nextState);
  }
}

function getCurrentDataSourceState(): SyncStateMetadata | null {
  return activeDataSource ? activeDataSource.getSyncState() : null;
}

function authenticateInboundPeer(
  senderDeviceId: string | undefined,
  token: string | undefined
): PairedPeer {
  const state = getCurrentDataSourceState();
  if (!state) {
    throw createP2pError('STORAGE_SAVE_FAILED', 'Local sync data source not initialized.');
  }

  const matched = findAuthenticatedPeer(state.pairedPeers, senderDeviceId || token);
  if (!matched) {
    throw createP2pError('UNAUTHORIZED_DEVICE', 'This device is not paired or access was revoked.');
  }

  if (matched.pairingToken && token !== matched.pairingToken) {
    throw createP2pError('UNAUTHORIZED_DEVICE', 'Invalid or revoked device authentication token.');
  }

  return matched;
}

function attachRouteHandlers(localDeviceName: string, localDeviceId: string) {
  peerNetwork.setRouteHandler(async (route: string, data: any) => {
    const state = getCurrentDataSourceState();

    if (route === '/api/sync/ping') {
      return {
        ok: true,
        deviceId: state?.localDeviceId || localDeviceId,
        deviceName: state?.localDeviceName || localDeviceName,
        protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION,
        capabilities: DEFAULT_CAPABILITIES,
        timestamp: Date.now()
      };
    }

    if (route === '/api/sync/pair') {
      if (!activeDataSource || !state) {
        throw createP2pError('STORAGE_SAVE_FAILED', 'Host storage is not initialized.');
      }

      if (data?.header) {
        const neg = negotiateProtocol(data.header);
        if (neg.status !== 'compatible') {
          throw createP2pError('PROTOCOL_VERSION_MISMATCH', neg.message || 'Incompatible sync protocol version.');
        }
      }

      const submittedPin = String(data?.pairingPin || data?.pin || '').trim();
      const pinLockoutKey = String(data?.deviceId || '').trim() || 'unknown';
      if (isPinLockedOut(pinLockoutKey)) {
        throw createP2pError(
          'PIN_LOCKED',
          'Too many wrong pairing codes from this device. Try again in 5 minutes.'
        );
      }
      const pinCheck = peerNetwork.validatePairingPin(submittedPin);
      if (pinCheck.ok === false) {
        // Also check persisted state expiry in case PIN expired between app restarts
        if (
          pinCheck.errorCode === 'PIN_INVALID' &&
          state.pairingPin &&
          state.pairingPin === submittedPin &&
          typeof state.pairingPinExpiresAt === 'number' &&
          Date.now() > state.pairingPinExpiresAt
        ) {
          throw createP2pError('PIN_EXPIRED', 'Pairing code has expired. Generate a new code and try again.');
        }
        // Only wrong-PIN failures count toward the lockout (expired PINs do
        // not — they are not guesses).
        if (pinCheck.errorCode === 'PIN_INVALID' && recordPinFailure(pinLockoutKey)) {
          throw createP2pError(
            'PIN_LOCKED',
            'Too many wrong pairing codes from this device. Try again in 5 minutes.'
          );
        }
        throw createP2pError(pinCheck.errorCode, pinCheck.message);
      }
      clearPinLockout(pinLockoutKey);

      const remoteDeviceId = String(data?.deviceId || '').trim();
      const remoteDeviceName = String(data?.deviceName || 'Companion Device').trim();
      if (!remoteDeviceId) {
        throw createP2pError('DEVICE_ID_MISSING', 'Client device ID is required for pairing.');
      }

      const newAuthToken = generateAuthToken();
      const now = Date.now();
      const existingPeers = Array.isArray(state.pairedPeers) ? state.pairedPeers : [];
      const prevPeer = existingPeers.find((p) => p.deviceId === remoteDeviceId);

      const newPeer: PairedPeer = {
        deviceId: remoteDeviceId,
        deviceName: remoteDeviceName || prevPeer?.deviceName || 'Companion Device',
        lastKnownIp: 'P2P (WebRTC)',
        port: 0,
        pairingToken: newAuthToken,
        hasStoredAuthToken: true,
        requiresRePairing: false,
        lastSyncedTimestamp: prevPeer?.lastSyncedTimestamp || now,
        isOnline: true,
        lastHeartbeat: now,
        protocolVersion: data?.header?.protocolVersion || CURRENT_SYNC_PROTOCOL_VERSION,
        capabilities: Array.isArray(data?.header?.capabilities) && data.header.capabilities.length > 0
          ? data.header.capabilities
          : DEFAULT_CAPABILITIES,
        iceCandidateType: peerNetwork.lastIceCandidateType || undefined
      };

      // Rotate single-use PIN ONLY after persisting the new paired peer succeeds
      const rotatedPin = generateSixDigitPin();
      const rotatedExpiresAt = now + PAIRING_PIN_TTL_MS;

      const updatedPeers = [...existingPeers.filter((p) => p.deviceId !== remoteDeviceId), newPeer];
      await activeDataSource.updateSyncState(
        sanitizeSyncStateForStorage({
          ...state,
          pairedPeers: updatedPeers,
          pairingPin: rotatedPin,
          pairingPinExpiresAt: rotatedExpiresAt,
          pairingPinUpdatedAt: now
        })
      );

      presenceService.updatePresenceManually(remoteDeviceId, true);

      // Immediately retire old PIN listener and publish rotated single-use PIN
      peerNetwork.disablePairingPin();
      const enableRes = await peerNetwork.enablePairingPin(rotatedPin, PAIRING_PIN_TTL_MS);
      notifyHostListeners({
        listening: peerNetwork.brokerConnected,
        brokerConnected: peerNetwork.brokerConnected,
        peerId: peerNetwork.myId || '',
        deviceId: state.localDeviceId,
        pin: enableRes.ok ? rotatedPin : '',
        pinExpiresAt: enableRes.ok ? rotatedExpiresAt : 0,
        errorCode: enableRes.errorCode,
        errorMessage: enableRes.message
      });

      return {
        ok: true,
        authToken: newAuthToken,
        deviceId: state.localDeviceId,
        deviceName: state.localDeviceName,
        protocolVersion: CURRENT_SYNC_PROTOCOL_VERSION,
        capabilities: DEFAULT_CAPABILITIES
      };
    }

    if (route === '/api/sync/heartbeat') {
      const peer = authenticateInboundPeer(data?.deviceId, data?.token);
      presenceService.updatePresenceManually(peer.deviceId, true);
      return {
        ok: true,
        deviceId: state?.localDeviceId || localDeviceId,
        timestamp: Date.now()
      };
    }

    if (route === '/api/sync/exchange') {
      if (!activeDataSource) {
        throw createP2pError('STORAGE_SAVE_FAILED', 'Host storage is not initialized.');
      }
      const inboundDelta = (data?.delta || data) as SyncDeltaPayload;
      if (!inboundDelta || !inboundDelta.senderDeviceId) {
        throw createP2pError('UNAUTHORIZED_DEVICE', 'Missing sender identity on delta exchange.');
      }
      const peer = authenticateInboundPeer(inboundDelta.senderDeviceId, data?.token);
      try {
        // The sender was authenticated above (paired peer + token), so the
        // merge can verify record origins against this deviceId.
        const outboundDelta = await handleInboundExchange(inboundDelta, activeDataSource, {
          authenticatedPeerDeviceId: peer.deviceId
        });
        void syncMissingPageImagesWithPeer({ peer, dataSource: activeDataSource }).catch(() => {});
        return { ok: true, delta: outboundDelta };
      } catch (err: any) {
        throw createP2pError(
          getP2pErrorCode(err, 'STORAGE_SAVE_FAILED'),
          err?.message || 'Failed to persist inbound sync delta.'
        );
      }
    }

    if (route === '/api/sync/page-images/manifest') {
      authenticateInboundPeer(data?.deviceId, data?.token);
      return buildLocalPageImageManifest(data || {});
    }

    if (route === '/api/sync/page-images/chunk') {
      authenticateInboundPeer(data?.deviceId, data?.token);
      const chunk = await getLocalPageImageChunk(data || {});
      return { chunk };
    }

    throw createP2pError('PEER_OFFLINE', `Unsupported P2P sync route: ${route}`);
  });
}

/**
 * Starts the P2P WebRTC host node for this device and ensures an active 10-minute PIN is published
 * whenever the PeerJS signalling broker is genuinely connected.
 * Never regenerates an existing non-expired PIN and never issues a fake PIN when brokerConnected is false.
 */
export async function startLocalServer(
  deviceName: string,
  deviceId: string,
  syncState?: SyncStateMetadata,
  dataSource?: SyncDataSource
): Promise<P2pHostStartResult> {
  if (dataSource) {
    activeDataSource = dataSource;
  }

  attachRouteHandlers(deviceName, deviceId);

  const hostRes = await peerNetwork.startHost(deviceId);
  if (!hostRes.brokerConnected) {
    peerNetwork.disablePairingPin();
    const failedResult: P2pHostStartResult = {
      listening: false,
      brokerConnected: false,
      peerId: hostRes.peerId,
      deviceId,
      pin: '',
      pinExpiresAt: 0,
      errorCode: hostRes.errorCode || 'BROKER_DOWN',
      errorMessage: hostRes.errorMessage || 'Signalling server unreachable.'
    };
    notifyHostListeners(failedResult);
    return failedResult;
  }

  const dsState = syncState || activeDataSource?.getSyncState();
  const { pin, pinExpiresAt } = await getOrEnsureActivePairingPin(dsState, dataSource);
  const remainingTtlMs = Math.max(1000, pinExpiresAt - Date.now());
  const pinRes = await peerNetwork.enablePairingPin(pin, remainingTtlMs);

  const result: P2pHostStartResult = {
    listening: pinRes.ok,
    brokerConnected: hostRes.brokerConnected,
    peerId: hostRes.peerId,
    deviceId,
    pin: pinRes.ok ? pin : '',
    pinExpiresAt: pinRes.ok ? pinExpiresAt : 0,
    errorCode: pinRes.errorCode,
    errorMessage: pinRes.message
  };

  notifyHostListeners(result);
  return result;
}

/**
 * Explicitly rotates the 6-digit pairing code ("New Code" button).
 */
export async function regeneratePairingPin(
  ttlMs: number = PAIRING_PIN_TTL_MS,
  dataSource?: SyncDataSource
): Promise<P2pHostStartResult> {
  const ds = dataSource || activeDataSource;
  const state = ds?.getSyncState() || (await storage.getItem<SyncStateMetadata>('dl_sync_state'));
  const deviceId = state?.localDeviceId || peerNetwork.myDeviceId || '';

  if (!peerNetwork.brokerConnected) {
    const startRes = await peerNetwork.startHost(deviceId);
    if (!startRes.brokerConnected) {
      const failStatus: P2pHostStartResult = {
        listening: false,
        brokerConnected: false,
        peerId: startRes.peerId,
        deviceId,
        pin: '',
        pinExpiresAt: 0,
        errorCode: startRes.errorCode || 'BROKER_DOWN',
        errorMessage: startRes.errorMessage || 'Cannot generate a new code while signalling is disconnected.'
      };
      notifyHostListeners(failStatus);
      return failStatus;
    }
  }

  const nextPin = generateSixDigitPin();
  const nextExpiresAt = Date.now() + Math.max(1000, ttlMs);

  await persistPairingPin(nextPin, nextExpiresAt, ds);
  peerNetwork.disablePairingPin();
  const enableRes = await peerNetwork.enablePairingPin(nextPin, Math.max(1000, ttlMs));

  const status: P2pHostStartResult = {
    listening: enableRes.ok,
    brokerConnected: peerNetwork.brokerConnected,
    peerId: peerNetwork.myId || '',
    deviceId,
    pin: enableRes.ok ? nextPin : '',
    pinExpiresAt: enableRes.ok ? nextExpiresAt : 0,
    errorCode: enableRes.errorCode,
    errorMessage: enableRes.message
  };

  notifyHostListeners(status);
  return status;
}

export function stopLocalServer(): void {
  peerNetwork.destroy();
  const stopped: P2pHostStartResult = {
    listening: false,
    brokerConnected: false,
    peerId: '',
    deviceId: '',
    pin: '',
    pinExpiresAt: 0
  };
  notifyHostListeners(stopped);
}
