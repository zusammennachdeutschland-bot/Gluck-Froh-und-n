import { PairedPeer } from '../../types';
import { pingPeer } from './syncClient';

/**
 * Resolves whether a paired peer is reachable and returns its primary routing identifier (deviceId).
 */
export async function resolvePeerIp(peer: PairedPeer): Promise<string | null> {
  try {
    if (!peer) return null;

    // 1. Primary: Ping peer directly via permanent deterministic deviceId
    if (peer.deviceId) {
      const data = await pingPeer(peer.deviceId, peer.port || 0);
      if (data && (data.deviceId === peer.deviceId || data.status === 'ok')) {
        return peer.deviceId;
      }
    }

    // 2. Backward-compatibility fallback: If legacy peer record has a PIN in lastKnownIp
    if (peer.lastKnownIp && /^\d{6}$/.test(peer.lastKnownIp)) {
      const data = await pingPeer(peer.lastKnownIp, peer.port || 0);
      if (data && data.deviceId) {
        // Successfully resolved via legacy PIN, return the verified deviceId
        return data.deviceId;
      }
    }

    return null;
  } catch (error) {
    console.warn('Error during peer resolution:', error);
    return null;
  }
}

