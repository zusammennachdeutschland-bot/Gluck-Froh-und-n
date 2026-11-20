import {
  DEFAULT_LAN_SYNC_PORT,
  LanConnectionTestResult,
  LanSyncErrorCode,
  PairedPeer,
  SyncDeltaPayload
} from '../../types';
import { createProtocolHeader } from './protocolNegotiator';
import {
  pairWithLanHost,
  sendAuthenticatedLanRequest,
  testLanHostConnection
} from './lanTransport';
import { isLegacyUnmigratedPeer } from './lanVault';
import type { GrammarPageImageChunk } from '../../shared/lernstudioPageImageStore';
import type { PageImageManifestEntry } from './syncOrchestrator';

export async function testHostConnection(
  hostIp: string,
  port: number = DEFAULT_LAN_SYNC_PORT,
  expectedFingerprint?: string
): Promise<LanConnectionTestResult> {
  return testLanHostConnection(hostIp, port, expectedFingerprint);
}

export async function pingPeer(
  targetIp: string,
  port: number = DEFAULT_LAN_SYNC_PORT,
  expectedFingerprint?: string
) {
  const res = await testLanHostConnection(targetIp, port, expectedFingerprint);
  if (!res.ok) return null;
  return {
    ok: true,
    deviceId: res.deviceId,
    deviceName: res.deviceName,
    addresses: res.addresses,
    port: res.port,
    protocolVersion: res.protocolVersion,
    certFingerprintSha256: res.certFingerprintSha256,
    verificationCode: res.verificationCode,
    latencyMs: res.latencyMs
  };
}

/**
 * Initiates direct LAN pairing with a PC Sync Host using its LAN IP, port, and 6-digit pairing code.
 * Auth token is stored natively in AndroidKeyStore or Electron safeStorage vault (never returned to localStorage).
 */
export async function pairWithPeer(
  hostIp: string,
  port: number,
  pairingCode: string,
  localDevice: { deviceId: string; deviceName: string },
  expectedFingerprint?: string
): Promise<{
  ok: boolean;
  peer?: PairedPeer;
  errorCode?: LanSyncErrorCode;
  message?: string;
  latencyMs?: number;
}> {
  return pairWithLanHost({
    host: hostIp,
    port: Number(port) > 0 ? Number(port) : DEFAULT_LAN_SYNC_PORT,
    pairingCode,
    localDeviceId: localDevice.deviceId,
    localDeviceName: localDevice.deviceName,
    expectedFingerprint
  });
}

export async function sendHeartbeat(
  peer: PairedPeer
): Promise<{
  ok: boolean;
  latencyMs?: number;
  resolvedIp?: string;
  resolvedPort?: number;
  errorCode?: LanSyncErrorCode;
  message?: string;
}> {
  if (!peer || isLegacyUnmigratedPeer(peer)) {
    return {
      ok: false,
      errorCode: 'UNAUTHORIZED_DEVICE',
      message: 'Legacy device requires re-pairing over local Wi-Fi.'
    };
  }

  const res = await sendAuthenticatedLanRequest<any>({
    peer,
    operation: 'heartbeat',
    method: 'POST',
    path: '/api/sync/heartbeat',
    body: { header: createProtocolHeader() },
    timeoutMs: 4000,
    allowIpRediscovery: false
  });

  return {
    ok: res.ok,
    latencyMs: res.latencyMs,
    resolvedIp: res.resolvedIp,
    resolvedPort: res.resolvedPort,
    errorCode: res.errorCode,
    message: res.message
  };
}

export async function exchangeDeltas(
  peer: PairedPeer,
  outboundDelta: SyncDeltaPayload
): Promise<{
  ok: boolean;
  delta?: SyncDeltaPayload;
  errorCode?: LanSyncErrorCode;
  message?: string;
  resolvedIp?: string;
  resolvedPort?: number;
  latencyMs?: number;
}> {
  const res = await sendAuthenticatedLanRequest<{ delta?: SyncDeltaPayload }>({
    peer,
    operation: 'exchange',
    method: 'POST',
    path: '/api/sync/exchange',
    body: { delta: outboundDelta },
    timeoutMs: 25000,
    allowIpRediscovery: true
  });

  if (!res.ok) {
    return {
      ok: false,
      errorCode: res.errorCode || 'HOST_OFFLINE',
      message: res.message || 'Exchange request rejected or host unreachable.',
      latencyMs: res.latencyMs
    };
  }

  const delta = res.data?.delta || (res.data as unknown as SyncDeltaPayload);
  if (!delta || !delta.records) {
    return {
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
      message: 'Host returned an invalid sync delta response.',
      latencyMs: res.latencyMs
    };
  }

  return {
    ok: true,
    delta,
    resolvedIp: res.resolvedIp,
    resolvedPort: res.resolvedPort,
    latencyMs: res.latencyMs
  };
}

export async function fetchPeerPageImageManifest(
  peer: PairedPeer,
  requestedImageIds: string[],
  existingImageIds: string[]
): Promise<{ availableImages: PageImageManifestEntry[] } | null> {
  const res = await sendAuthenticatedLanRequest<{ availableImages: PageImageManifestEntry[] }>({
    peer,
    operation: 'page_images',
    method: 'POST',
    path: '/api/sync/page-images/manifest',
    body: { requestedImageIds, existingImageIds },
    timeoutMs: 12000,
    allowIpRediscovery: false
  });
  return res.ok && res.data ? res.data : null;
}

export async function fetchPeerPageImageChunk(
  peer: PairedPeer,
  imageId: string,
  chunkIndex: number,
  chunkSizeChars?: number
): Promise<GrammarPageImageChunk | null> {
  const res = await sendAuthenticatedLanRequest<{ chunk?: GrammarPageImageChunk }>({
    peer,
    operation: 'page_images',
    method: 'POST',
    path: '/api/sync/page-images/chunk',
    body: { imageId, chunkIndex, chunkSizeChars },
    timeoutMs: 12000,
    allowIpRediscovery: false
  });
  return res.ok ? res.data?.chunk || (res.data as any) : null;
}
