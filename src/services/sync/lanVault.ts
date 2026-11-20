import { Capacitor, registerPlugin } from '@capacitor/core';
import { PairedPeer, SyncStateMetadata } from '../../types';

export interface NativeLanSyncPlugin {
  getNetworkStatus(): Promise<{
    wifiConnected: boolean;
    lanConnected: boolean;
    hasInternet: boolean;
    localIpv4Addresses: string[];
    sdkInt?: number;
  }>;
  discoverHosts(options?: { timeoutMs?: number }): Promise<{
    wifiConnected: boolean;
    hosts: any[];
  }>;
  testConnection(options: {
    host: string;
    port: number;
    expectedFingerprint?: string;
    timeoutMs?: number;
  }): Promise<any>;
  pair(options: {
    host: string;
    port: number;
    pairingCode: string;
    localDeviceId: string;
    localDeviceName: string;
    expectedFingerprint?: string;
    header?: any;
  }): Promise<any>;
  requestPaired(options: {
    peerDeviceId: string;
    host: string;
    port: number;
    method: 'GET' | 'POST';
    path: string;
    body?: any;
    expectedFingerprint?: string;
    timeoutMs?: number;
  }): Promise<any>;
  revokePeer(options: { peerDeviceId: string }): Promise<{ revoked: boolean }>;
  hasStoredCredentials(options: { peerDeviceId: string }): Promise<{
    hasCredentials: boolean;
    verificationCode?: string;
  }>;
}

let cachedNativePlugin: NativeLanSyncPlugin | null = null;

export function getNativeLanSyncPlugin(): NativeLanSyncPlugin | null {
  try {
    if (!Capacitor.isNativePlatform()) return null;
    if (!cachedNativePlugin) {
      cachedNativePlugin = registerPlugin<NativeLanSyncPlugin>('LanSync');
    }
    return cachedNativePlugin;
  } catch {
    return null;
  }
}

export function getElectronLanSyncBridge(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any)?.electronBridge?.lanSync || null;
}

/**
 * Ephemeral in-memory fallback used ONLY when neither AndroidKeyStore nor Electron safeStorage
 * is running (e.g. non-Electron browser session or unit tests). NEVER written to localStorage.
 */
const ephemeralTokenVault = new Map<string, { authToken: string; certFingerprintSha256?: string }>();

export function setEphemeralLanCredential(
  peerDeviceId: string,
  authToken: string,
  certFingerprintSha256?: string
): void {
  if (!peerDeviceId || !authToken) return;
  ephemeralTokenVault.set(peerDeviceId.trim(), { authToken, certFingerprintSha256 });
}

export function getEphemeralLanCredential(peerDeviceId: string): { authToken: string; certFingerprintSha256?: string } | null {
  return ephemeralTokenVault.get(String(peerDeviceId || '').trim()) || null;
}

export async function revokeStoredLanCredentials(peerDeviceId: string): Promise<boolean> {
  const cleanId = String(peerDeviceId || '').trim();
  if (!cleanId) return false;

  let revoked = ephemeralTokenVault.delete(cleanId);

  const electronBridge = getElectronLanSyncBridge();
  if (electronBridge?.revokePairedPeer) {
    try {
      const res = await electronBridge.revokePairedPeer(cleanId);
      revoked = Boolean(res?.revoked) || revoked;
    } catch {}
  }

  const androidPlugin = getNativeLanSyncPlugin();
  if (androidPlugin) {
    try {
      const res = await androidPlugin.revokePeer({ peerDeviceId: cleanId });
      revoked = Boolean(res?.revoked) || revoked;
    } catch {}
  }

  return revoked;
}

export async function hasStoredLanCredentials(peerDeviceId: string): Promise<boolean> {
  const cleanId = String(peerDeviceId || '').trim();
  if (!cleanId) return false;
  if (ephemeralTokenVault.has(cleanId)) return true;

  const electronBridge = getElectronLanSyncBridge();
  if (electronBridge?.hasStoredCredentials) {
    try {
      const res = await electronBridge.hasStoredCredentials(cleanId);
      if (res?.hasCredentials) return true;
    } catch {}
  }

  const androidPlugin = getNativeLanSyncPlugin();
  if (androidPlugin) {
    try {
      const res = await androidPlugin.hasStoredCredentials({ peerDeviceId: cleanId });
      if (res?.hasCredentials) return true;
    } catch {}
  }

  return false;
}

export function clearEphemeralLanVault(): void {
  ephemeralTokenVault.clear();
}

export function isLegacyUnmigratedPeer(peer: Partial<PairedPeer> | null | undefined): boolean {
  if (!peer) return false;
  const ip = String(peer.lastKnownIp || '').trim();
  const isSixDigitPin = /^\d{6}$/.test(ip);
  const isLegacyWebRtc = ip.toLowerCase().includes('webrtc') || ip === 'P2P' || ip === 'P2P (WebRTC)';
  const hasZeroPort = !peer.port || Number(peer.port) <= 0;
  return Boolean(peer.requiresRePairing || isSixDigitPin || isLegacyWebRtc || hasZeroPort);
}

/**
 * Strips any raw authentication tokens from SyncStateMetadata before saving to localStorage/IndexedDB.
 * Marks peers authenticated via secure vault with `hasStoredAuthToken: true` and keeps only
 * non-secret routing metadata (`deviceId`, `deviceName`, `lastKnownIp`, `port`, `tlsFingerprintSha256`).
 */
export function sanitizeSyncStateForStorage(state: SyncStateMetadata): SyncStateMetadata {
  if (!state || !Array.isArray(state.pairedPeers)) return state;
  const sanitizedPeers: PairedPeer[] = state.pairedPeers.map((p) => {
    const { pairingToken: legacyToken, ...rest } = p as PairedPeer & { pairingToken?: string };
    const hadToken = Boolean(rest.hasStoredAuthToken || legacyToken);
    if (legacyToken && !isLegacyUnmigratedPeer(p)) {
      setEphemeralLanCredential(p.deviceId, legacyToken, p.tlsFingerprintSha256);
    }
    return {
      ...rest,
      hasStoredAuthToken: rest.requiresRePairing ? false : hadToken
    };
  });
  return {
    ...state,
    pairedPeers: sanitizedPeers
  };
}
