import { SyncDeltaPayload } from '../../types';
import { peerNetwork } from './peerNetwork';
import { createProtocolHeader, negotiateProtocol } from './protocolNegotiator';

/**
 * Pings a peer to check if it's online, exchanges capabilities and returns device info.
 * target can be a permanent deviceId or a temporary PIN.
 */
export async function pingPeer(target: string, port = 0) {
  try {
    const header = createProtocolHeader();
    const data = await peerNetwork.fetch(target, '/api/sync/ping', { header });
    if (data) {
      const negotiation = negotiateProtocol(data.header);
      return {
        ...data,
        negotiatedVersion: negotiation.negotiatedVersion,
        agreedCapabilities: negotiation.agreedCapabilities,
        isCompatible: negotiation.status === 'compatible'
      };
    }
    return null;
  } catch (error) {
    console.warn(`Failed to ping peer ${target}`, error);
    return null; 
  }
}

/**
 * Attempts to pair with a peer using a provided PIN and protocol negotiation header.
 * Returns the pairingToken and capability metadata if successful, or null if failed/rejected.
 */
export async function pairWithPeer(
  targetPin: string,
  port: number,
  pin: string,
  localDevice: { deviceId: string; deviceName: string }
) {
  try {
    const header = createProtocolHeader();
    const data = await peerNetwork.fetch(targetPin, '/api/sync/pair', {
      pin: pin || targetPin,
      deviceId: localDevice.deviceId,
      deviceName: localDevice.deviceName,
      header
    });
    return data;
  } catch (error) {
    console.warn(`Failed to pair with peer ${targetPin}:`, error);
    return null;
  }
}

/**
 * Sends a lightweight heartbeat ping to measure latency and verify live presence.
 * target is the peer's permanent deviceId.
 */
export async function sendHeartbeat(target: string, port = 0): Promise<{ latencyMs: number } | null> {
  const startTime = Date.now();
  try {
    const data = await peerNetwork.fetch(target, '/api/sync/heartbeat', {}, 4000);
    if (data && data.status === 'ok') {
      const latencyMs = Date.now() - startTime;
      return { latencyMs };
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Exchanges delta payloads with a paired peer using a secure token.
 * target is the peer's permanent deviceId.
 */
export async function exchangeDeltas(
  target: string,
  port: number,
  token: string,
  payload: SyncDeltaPayload
) {
  try {
    // Attach current protocol header to the payload
    const enrichedPayload: SyncDeltaPayload = {
      ...payload,
      header: payload.header || createProtocolHeader()
    };

    const data = await peerNetwork.fetch(target, '/api/sync/exchange', {
      token,
      payload: enrichedPayload
    }, 15000);
    return data;
  } catch (error) {
    console.warn(`Failed to exchange deltas with peer ${target}:`, error);
    return null;
  }
}

