import {
  CURRENT_SYNC_PROTOCOL_VERSION,
  DEFAULT_CAPABILITIES,
  P2pSyncErrorCode,
  PairedPeer,
  SyncDeltaPayload
} from '../../types';
import { createProtocolHeader } from './protocolNegotiator';
import {
  formatDevicePeerId,
  formatPairingPinId,
  getP2pErrorCode,
  peerNetwork,
  recordP2pDiagnosticAttempt
} from './peerNetwork';
import { isLegacyLanOnlyPeer } from './syncMigration';
import type { GrammarPageImageChunk } from '../../shared/lernstudioPageImageStore';
import type { PageImageManifestEntry } from './syncOrchestrator';

export async function pingPeer(targetIdentifier: string): Promise<{
  ok: boolean;
  deviceId?: string;
  deviceName?: string;
  protocolVersion?: number;
  capabilities?: any[];
  latencyMs?: number;
  errorCode?: P2pSyncErrorCode;
  message?: string;
}> {
  const startedAt = Date.now();
  const resolvedPeer = peerNetwork.resolveTargetPeerId(targetIdentifier);
  try {
    const res = await peerNetwork.fetch(
      targetIdentifier,
      '/api/sync/ping',
      {
        timestamp: Date.now(),
        header: createProtocolHeader()
      },
      6000
    );
    const latencyMs = Date.now() - startedAt;
    recordP2pDiagnosticAttempt({
      operation: 'ping',
      targetPeerId: resolvedPeer,
      ok: true,
      latencyMs,
      iceCandidateType: peerNetwork.lastIceCandidateType || undefined
    });
    return {
      ok: true,
      deviceId: res?.deviceId,
      deviceName: res?.deviceName,
      protocolVersion: res?.protocolVersion,
      capabilities: res?.capabilities,
      latencyMs
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const errorCode = getP2pErrorCode(err, 'PEER_OFFLINE');
    recordP2pDiagnosticAttempt({
      operation: 'ping',
      targetPeerId: resolvedPeer,
      ok: false,
      errorCode,
      message: err?.message,
      latencyMs
    });
    return {
      ok: false,
      errorCode,
      message: err?.message || 'Peer is offline.',
      latencyMs
    };
  }
}

/**
 * Initiates WebRTC P2P pairing with a remote Glück device.
 * Prefers deterministic `glueck-dev-${targetDeviceId}` when `targetDeviceId` is known,
 * falling back to ephemeral `glueck-${pin}` ONLY when `targetDeviceId` fails with `PEER_OFFLINE`.
 */
export async function pairWithPeer(
  targetDeviceId: string,
  pin: string,
  localDevice: { deviceId: string; deviceName: string }
): Promise<{
  ok: boolean;
  peer?: PairedPeer;
  errorCode?: P2pSyncErrorCode;
  message?: string;
  latencyMs?: number;
}> {
  const cleanTargetId = String(targetDeviceId || '').trim();
  const cleanPin = String(pin || '').replace(/\D/g, '').slice(0, 6);

  if (!localDevice?.deviceId) {
    return {
      ok: false,
      errorCode: 'DEVICE_ID_MISSING',
      message: 'Local device ID is missing.'
    };
  }

  if (cleanPin.length !== 6) {
    return {
      ok: false,
      errorCode: 'PIN_INVALID',
      message: 'Enter a valid 6-digit pairing code.'
    };
  }

  const payload = {
    deviceId: localDevice.deviceId,
    deviceName: localDevice.deviceName,
    pairingPin: cleanPin,
    header: createProtocolHeader()
  };

  const candidates: Array<{ rawTarget: string; label: string }> = [];
  if (cleanTargetId && cleanTargetId !== cleanPin) {
    candidates.push({
      rawTarget: cleanTargetId,
      label: formatDevicePeerId(cleanTargetId)
    });
  }
  candidates.push({
    rawTarget: cleanPin,
    label: formatPairingPinId(cleanPin)
  });

  const startedAt = Date.now();
  let lastErrorCode: P2pSyncErrorCode = 'PEER_OFFLINE';
  let lastErrorMessage = 'Peer device could not be reached.';

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const isLast = i === candidates.length - 1;

    try {
      const res = await peerNetwork.fetch(candidate.rawTarget, '/api/sync/pair', payload, 12000);
      const latencyMs = Date.now() - startedAt;

      if (!res || !res.ok || !res.deviceId || !res.authToken) {
        recordP2pDiagnosticAttempt({
          operation: 'pair',
          targetPeerId: candidate.label,
          ok: false,
          errorCode: 'PIN_INVALID',
          message: 'Remote peer returned an incomplete pairing response.',
          latencyMs
        });
        return {
          ok: false,
          errorCode: 'PIN_INVALID',
          message: 'Remote peer rejected pairing.',
          latencyMs
        };
      }

      const now = Date.now();
      const peer: PairedPeer = {
        deviceId: String(res.deviceId),
        deviceName: String(res.deviceName || 'Companion Device'),
        lastKnownIp: 'P2P (WebRTC)',
        port: 0,
        pairingToken: String(res.authToken),
        hasStoredAuthToken: true,
        requiresRePairing: false,
        lastSyncedTimestamp: now,
        isOnline: true,
        lastHeartbeat: now,
        protocolVersion: Number(res.protocolVersion) || CURRENT_SYNC_PROTOCOL_VERSION,
        capabilities:
          Array.isArray(res.capabilities) && res.capabilities.length > 0
            ? res.capabilities
            : DEFAULT_CAPABILITIES,
        iceCandidateType: peerNetwork.lastIceCandidateType || undefined
      };

      recordP2pDiagnosticAttempt({
        operation: 'pair',
        targetPeerId: candidate.label,
        ok: true,
        latencyMs,
        iceCandidateType: peerNetwork.lastIceCandidateType || undefined
      });

      return { ok: true, peer, latencyMs };
    } catch (err: any) {
      lastErrorCode = getP2pErrorCode(err, 'PEER_OFFLINE');
      lastErrorMessage = err?.message || 'Pairing attempt failed.';
      recordP2pDiagnosticAttempt({
        operation: 'pair',
        targetPeerId: candidate.label,
        ok: false,
        errorCode: lastErrorCode,
        message: lastErrorMessage,
        latencyMs: Date.now() - startedAt
      });

      // Fallback from deterministic device ID to PIN peer ID ONLY on PEER_OFFLINE
      if (!isLast && lastErrorCode === 'PEER_OFFLINE') {
        continue;
      }
      break;
    }
  }

  return {
    ok: false,
    errorCode: lastErrorCode,
    message: lastErrorMessage,
    latencyMs: Date.now() - startedAt
  };
}

export async function sendHeartbeat(
  peer: PairedPeer
): Promise<{
  ok: boolean;
  latencyMs?: number;
  errorCode?: P2pSyncErrorCode;
  message?: string;
}> {
  if (!peer || isLegacyLanOnlyPeer(peer)) {
    return {
      ok: false,
      errorCode: 'UNAUTHORIZED_DEVICE',
      message: 'Legacy device requires P2P re-pairing.'
    };
  }

  const startedAt = Date.now();
  const targetPeerId = formatDevicePeerId(peer.deviceId);
  try {
    await peerNetwork.fetch(
      peer.deviceId,
      '/api/sync/heartbeat',
      {
        deviceId: peerNetwork.myDeviceId,
        token: peer.pairingToken,
        header: createProtocolHeader()
      },
      5000
    );
    const latencyMs = Date.now() - startedAt;
    recordP2pDiagnosticAttempt({
      operation: 'heartbeat',
      targetPeerId,
      ok: true,
      latencyMs,
      iceCandidateType: peerNetwork.lastIceCandidateType || undefined
    });
    return { ok: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const errorCode = getP2pErrorCode(err, 'PEER_OFFLINE');
    recordP2pDiagnosticAttempt({
      operation: 'heartbeat',
      targetPeerId,
      ok: false,
      errorCode,
      message: err?.message,
      latencyMs
    });
    return {
      ok: false,
      latencyMs,
      errorCode,
      message: err?.message || 'Peer offline.'
    };
  }
}

export async function exchangeDeltas(
  peer: PairedPeer,
  outboundDelta: SyncDeltaPayload
): Promise<{
  ok: boolean;
  delta?: SyncDeltaPayload;
  errorCode?: P2pSyncErrorCode;
  message?: string;
  latencyMs?: number;
  iceCandidateType?: string;
}> {
  const startedAt = Date.now();
  const targetPeerId = formatDevicePeerId(peer.deviceId);
  try {
    const res = await peerNetwork.fetch(
      peer.deviceId,
      '/api/sync/exchange',
      {
        delta: outboundDelta,
        token: peer.pairingToken,
        header: createProtocolHeader()
      },
      25000
    );
    const latencyMs = Date.now() - startedAt;
    const delta = (res?.delta || res) as SyncDeltaPayload | undefined;

    if (!delta || !delta.records) {
      recordP2pDiagnosticAttempt({
        operation: 'exchange',
        targetPeerId,
        ok: false,
        errorCode: 'STORAGE_SAVE_FAILED',
        message: 'Peer returned an invalid sync delta response.',
        latencyMs
      });
      return {
        ok: false,
        errorCode: 'STORAGE_SAVE_FAILED',
        message: 'Peer returned an invalid sync delta response.',
        latencyMs
      };
    }

    const iceCandidateType = peerNetwork.lastIceCandidateType || undefined;
    recordP2pDiagnosticAttempt({
      operation: 'exchange',
      targetPeerId,
      ok: true,
      latencyMs,
      iceCandidateType
    });

    return {
      ok: true,
      delta,
      latencyMs,
      iceCandidateType
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const errorCode = getP2pErrorCode(err, 'PEER_OFFLINE');
    recordP2pDiagnosticAttempt({
      operation: 'exchange',
      targetPeerId,
      ok: false,
      errorCode,
      message: err?.message || 'P2P delta exchange failed.',
      latencyMs
    });
    return {
      ok: false,
      errorCode,
      message: err?.message || 'Peer is offline or unreachable.',
      latencyMs
    };
  }
}

export async function fetchPeerPageImageManifest(
  peer: PairedPeer,
  requestedImageIds: string[],
  existingImageIds: string[]
): Promise<{ availableImages: PageImageManifestEntry[] } | null> {
  try {
    const res = await peerNetwork.fetch(
      peer.deviceId,
      '/api/sync/page-images/manifest',
      {
        deviceId: peerNetwork.myDeviceId,
        token: peer.pairingToken,
        requestedImageIds,
        existingImageIds
      },
      12000
    );
    return res && Array.isArray(res.availableImages) ? res : null;
  } catch {
    return null;
  }
}

export async function fetchPeerPageImageChunk(
  peer: PairedPeer,
  imageId: string,
  chunkIndex: number,
  chunkSizeChars?: number
): Promise<GrammarPageImageChunk | null> {
  try {
    const res = await peerNetwork.fetch(
      peer.deviceId,
      '/api/sync/page-images/chunk',
      {
        deviceId: peerNetwork.myDeviceId,
        token: peer.pairingToken,
        imageId,
        chunkIndex,
        chunkSizeChars
      },
      12000
    );
    return res?.chunk || res || null;
  } catch {
    return null;
  }
}
