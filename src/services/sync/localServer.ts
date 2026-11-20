import {
  CURRENT_SYNC_PROTOCOL_VERSION,
  DEFAULT_LAN_SYNC_PORT,
  LanHostStatus,
  PairedPeer,
  SyncDeltaPayload,
  SyncStateMetadata
} from '../../types';
import {
  buildLocalPageImageManifest,
  getLocalPageImageChunk,
  handleInboundExchange,
  SyncDataSource
} from './syncOrchestrator';
import { getElectronLanSyncBridge, sanitizeSyncStateForStorage } from './lanVault';
import { connectivityEngine } from './connectivityEngine';

let activeDataSource: SyncDataSource | null = null;
let unsubscribeRpc: (() => void) | null = null;
let unsubscribeHostEvents: (() => void) | null = null;
let hostStatusListeners = new Set<(status: LanHostStatus) => void>();
let lastKnownHostStatus: LanHostStatus | null = null;

function notifyHostListeners(status: LanHostStatus) {
  lastKnownHostStatus = status;
  connectivityEngine.setHostListening(Boolean(status.listening));
  for (const listener of hostStatusListeners) {
    try {
      listener(status);
    } catch {}
  }
}

export function subscribeLanHostStatus(listener: (status: LanHostStatus) => void): () => void {
  hostStatusListeners.add(listener);
  if (lastKnownHostStatus) {
    listener(lastKnownHostStatus);
  }
  return () => {
    hostStatusListeners.delete(listener);
  };
}

function attachElectronBridgeListeners(bridge: any) {
  if (!unsubscribeRpc && typeof bridge.onRpcRequest === 'function') {
    unsubscribeRpc = bridge.onRpcRequest(async (req: { requestId: string; op: string; payload: any }) => {
      const requestId = req?.requestId;
      if (!requestId) return;
      try {
        if (!activeDataSource) {
          throw new Error('Renderer sync data source is not initialized yet.');
        }
        if (req.op === 'exchange') {
          const inboundDelta = req.payload as SyncDeltaPayload;
          const outboundDelta = await handleInboundExchange(inboundDelta, activeDataSource);
          await bridge.sendRpcResponse({ requestId, ok: true, result: outboundDelta });
        } else if (req.op === 'pageImageManifest') {
          const manifest = await buildLocalPageImageManifest(req.payload || {});
          await bridge.sendRpcResponse({ requestId, ok: true, result: manifest });
        } else if (req.op === 'pageImageChunk') {
          const chunk = await getLocalPageImageChunk(req.payload || {});
          await bridge.sendRpcResponse({ requestId, ok: true, result: chunk });
        } else {
          throw new Error(`Unsupported LAN sync RPC operation: ${req.op}`);
        }
      } catch (err: any) {
        await bridge.sendRpcResponse({
          requestId,
          ok: false,
          errorCode: err?.errorCode || 'STORAGE_SAVE_FAILED',
          error: err?.message || 'Failed to persist inbound LAN sync data.'
        });
      }
    });
  }

  if (!unsubscribeHostEvents && typeof bridge.onHostEvent === 'function') {
    unsubscribeHostEvents = bridge.onHostEvent(async (evt: { type: string; data: any }) => {
      if (!evt) return;
      if (evt.type === 'status-changed' || evt.type === 'network-changed') {
        if (evt.data) notifyHostListeners(evt.data as LanHostStatus);
      } else if (evt.type === 'peer-paired' && evt.data && activeDataSource) {
        const safePeer = evt.data;
        const current = activeDataSource.getSyncState();
        const existingPeers = Array.isArray(current.pairedPeers) ? current.pairedPeers : [];
        const prevPeer = existingPeers.find((p) => p.deviceId === safePeer.deviceId);
        const updatedPeer: PairedPeer = {
          deviceId: safePeer.deviceId,
          deviceName: safePeer.deviceName || prevPeer?.deviceName || 'Companion Device',
          lastKnownIp: safePeer.lastSeenIp || prevPeer?.lastKnownIp || '',
          port: prevPeer?.port || DEFAULT_LAN_SYNC_PORT,
          hasStoredAuthToken: true,
          requiresRePairing: false,
          lastSyncedTimestamp: prevPeer?.lastSyncedTimestamp || Date.now(),
          isOnline: true,
          lastHeartbeat: Date.now(),
          protocolVersion: safePeer.protocolVersion || CURRENT_SYNC_PROTOCOL_VERSION,
          capabilities: safePeer.capabilities
        };
        const nextPeers = [...existingPeers.filter((p) => p.deviceId !== safePeer.deviceId), updatedPeer];
        await activeDataSource.updateSyncState(
          sanitizeSyncStateForStorage({
            ...current,
            pairedPeers: nextPeers
          })
        );
      } else if (evt.type === 'peer-revoked' && evt.data?.deviceId && activeDataSource) {
        const current = activeDataSource.getSyncState();
        const nextPeers = (current.pairedPeers || []).filter((p) => p.deviceId !== evt.data.deviceId);
        await activeDataSource.updateSyncState({
          ...current,
          pairedPeers: nextPeers
        });
      }
    });
  }
}

export async function getLocalHostStatus(): Promise<LanHostStatus> {
  const bridge = getElectronLanSyncBridge();
  if (!bridge?.getHostStatus) {
    const unsupported: LanHostStatus = {
      isSupported: false,
      listening: false,
      status: 'unsupported',
      deviceId: '',
      deviceName: 'Glück Mobile / Web',
      addresses: [],
      primaryIp: null,
      port: DEFAULT_LAN_SYNC_PORT,
      tlsEnabled: false,
      certFingerprintSha256: null,
      verificationCode: null,
      pairingCode: null,
      pairingExpiresAt: 0,
      pairingLockedOut: false,
      lockoutRemainingMs: 0,
      pairedPeersCount: 0,
      errorCode: 'HOST_UNSUPPORTED_PLATFORM',
      bindError: 'LAN Sync Host runs on PC / Electron desktop.'
    };
    return unsupported;
  }
  const st = await bridge.getHostStatus();
  notifyHostListeners(st);
  return st;
}

export async function startLocalServer(
  deviceName: string,
  deviceId: string,
  syncState?: SyncStateMetadata,
  dataSource?: SyncDataSource,
  portOverride?: number
): Promise<LanHostStatus & { ip: string; pin: string }> {
  if (dataSource) {
    activeDataSource = dataSource;
  }

  const bridge = getElectronLanSyncBridge();
  if (!bridge?.startHost) {
    const unsupported: LanHostStatus = {
      isSupported: false,
      listening: false,
      status: 'unsupported',
      deviceId,
      deviceName,
      addresses: [],
      primaryIp: null,
      port: syncState?.hostPort || DEFAULT_LAN_SYNC_PORT,
      tlsEnabled: false,
      certFingerprintSha256: null,
      verificationCode: null,
      pairingCode: null,
      pairingExpiresAt: 0,
      pairingLockedOut: false,
      lockoutRemainingMs: 0,
      pairedPeersCount: syncState?.pairedPeers?.length || 0,
      errorCode: 'HOST_UNSUPPORTED_PLATFORM',
      bindError: 'LAN Sync Host is available on the PC / Electron desktop app.'
    };
    notifyHostListeners(unsupported);
    return { ...unsupported, ip: '', pin: '' };
  }

  attachElectronBridgeListeners(bridge);

  const requestedPort = portOverride ?? syncState?.hostPort ?? DEFAULT_LAN_SYNC_PORT;
  const result: LanHostStatus = await bridge.startHost({
    localDeviceId: deviceId,
    localDeviceName: deviceName,
    port: requestedPort
  });

  notifyHostListeners(result);

  return {
    ...result,
    ip: result.primaryIp || '',
    pin: result.pairingCode || ''
  };
}

export async function regenerateLanPairingCode(ttlMs?: number): Promise<{
  pairingCode: string;
  expiresAt: number;
  status: LanHostStatus;
} | null> {
  const bridge = getElectronLanSyncBridge();
  if (!bridge?.regeneratePairingCode) return null;
  const res = await bridge.regeneratePairingCode({ ttlMs });
  if (res?.status) notifyHostListeners(res.status);
  return res;
}

export async function stopLocalServer(): Promise<void> {
  const bridge = getElectronLanSyncBridge();
  if (bridge?.stopHost) {
    const st = await bridge.stopHost();
    notifyHostListeners(st);
  }
}

export function getActiveSyncPort(): number {
  return lastKnownHostStatus?.port || DEFAULT_LAN_SYNC_PORT;
}
