import { DEFAULT_LAN_SYNC_PORT, DiscoveredLanHost, PairedPeer } from '../../types';
import { discoverLanHosts, isValidIpv4OrHost, testLanHostConnection } from './lanTransport';
import { isLegacyUnmigratedPeer } from './lanVault';

export { discoverLanHosts };

/**
 * Resolves a paired peer's active LAN IPv4 address & port.
 * 1. Rejects legacy WebRTC / PIN-as-IP records so the UI cleanly prompts re-pairing.
 * 2. Probes known IP(s) via GET /api/sync/health (and validates cert fingerprint if pinned).
 * 3. If offline on saved IP (e.g., DHCP assigned a new LAN IP on PC), discovers LAN hosts
 *    and accepts a new IP ONLY when BOTH deviceId and pinned certFingerprintSha256 match.
 */
export async function resolvePeerEndpoint(
  peer: PairedPeer
): Promise<{
  ip: string;
  port: number;
  addresses: string[];
  latencyMs?: number;
  rediscovered?: boolean;
} | null> {
  if (!peer || isLegacyUnmigratedPeer(peer)) {
    return null;
  }

  const port = Number(peer.port) > 0 ? Number(peer.port) : DEFAULT_LAN_SYNC_PORT;
  const candidates = Array.from(
    new Set(
      [peer.lastKnownIp, ...(Array.isArray(peer.knownAddresses) ? peer.knownAddresses : [])].filter((ip) =>
        isValidIpv4OrHost(ip)
      )
    )
  );

  for (const ip of candidates) {
    const test = await testLanHostConnection(ip, port, peer.tlsFingerprintSha256);
    if (test.ok) {
      return {
        ip,
        port,
        addresses: test.addresses || [ip],
        latencyMs: test.latencyMs,
        rediscovered: false
      };
    }
    if (test.errorCode === 'CERTIFICATE_MISMATCH') {
      return null;
    }
  }

  // Rediscover if PC host IP changed on Wi-Fi
  const { hosts } = await discoverLanHosts(1800);
  const matched = hosts.find((h: DiscoveredLanHost) => {
    if (h.deviceId !== peer.deviceId) return false;
    if (peer.tlsFingerprintSha256 && h.certFingerprintSha256) {
      return h.certFingerprintSha256.toLowerCase() === peer.tlsFingerprintSha256.toLowerCase();
    }
    return true;
  });

  if (matched && matched.primaryIp) {
    return {
      ip: matched.primaryIp,
      port: matched.port || port,
      addresses: matched.addresses || [matched.primaryIp],
      latencyMs: matched.latencyMs,
      rediscovered: true
    };
  }

  return null;
}

export async function resolvePeerIp(peer: PairedPeer): Promise<string | null> {
  const res = await resolvePeerEndpoint(peer);
  return res ? res.ip : null;
}
