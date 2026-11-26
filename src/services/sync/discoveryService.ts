import { DiscoveredRoomDevice, PairedPeer } from '../../types';
import { formatDevicePeerId } from './peerNetwork';
import { isLegacyLanOnlyPeer } from './syncMigration';
import { pingPeer } from './syncClient';
import { presenceService } from './presenceService';
import { presenceRoom } from './presenceRoom';

const REDISCOVERY_INTERVAL_MS = 30000;

export function resolvePeerP2pTarget(peer: PairedPeer | null | undefined): string | null {
  if (!peer || !peer.deviceId || isLegacyLanOnlyPeer(peer)) {
    return null;
  }
  return formatDevicePeerId(peer.deviceId);
}

/**
 * Probes all paired P2P peers directly via WebRTC ping and updates PresenceService.
 */
export async function rediscoverPairedPeers(
  pairedPeers: PairedPeer[]
): Promise<{ onlinePeerIds: string[]; checkedCount: number }> {
  const validPeers = (pairedPeers || []).filter((p) => p?.deviceId && !isLegacyLanOnlyPeer(p));
  const onlinePeerIds: string[] = [];

  await Promise.all(
    validPeers.map(async (peer) => {
      try {
        const res = await pingPeer(peer.deviceId);
        presenceService.updatePresenceManually(peer.deviceId, res.ok, res.latencyMs);
        if (res.ok) {
          onlinePeerIds.push(peer.deviceId);
        }
      } catch {
        presenceService.updatePresenceManually(peer.deviceId, false);
      }
    })
  );

  return {
    onlinePeerIds,
    checkedCount: validPeers.length
  };
}

/**
 * Returns online devices announced in the account-scoped presence room that are not yet actively paired.
 */
export function discoverNewDevices(pairedPeers: PairedPeer[] = []): DiscoveredRoomDevice[] {
  const activePairedIds = new Set(
    (pairedPeers || [])
      .filter((p) => p?.deviceId && !isLegacyLanOnlyPeer(p))
      .map((p) => p.deviceId)
  );
  return presenceRoom.getDiscoveredDevices().filter((d) => !activePairedIds.has(d.deviceId));
}

/**
 * Starts the automatic background rediscovery loop (startup, online, visibilitychange, and every 30s).
 */
export function startRediscoveryLoop(getPeers: () => PairedPeer[]): () => void {
  const runProbe = () => {
    const peers = getPeers() || [];
    if (peers.length > 0) {
      void rediscoverPairedPeers(peers);
    }
  };

  runProbe();

  const onOnline = () => runProbe();
  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      runProbe();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  const intervalId = setInterval(runProbe, REDISCOVERY_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
