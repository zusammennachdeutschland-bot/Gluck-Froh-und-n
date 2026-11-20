import {
  DEFAULT_LAN_SYNC_PORT,
  DiscoveredLanHost,
  LanConnectionTestResult,
  LanDiagnosticAttempt,
  LanNetworkStatus,
  LanSyncErrorCode,
  PairedPeer
} from '../../types';
import { createProtocolHeader } from './protocolNegotiator';
import {
  getElectronLanSyncBridge,
  getEphemeralLanCredential,
  getNativeLanSyncPlugin,
  isLegacyUnmigratedPeer,
  setEphemeralLanCredential
} from './lanVault';

export interface LanTransportResult<T = any> {
  ok: boolean;
  httpStatus: number;
  data?: T;
  errorCode?: LanSyncErrorCode;
  message?: string;
  latencyMs?: number;
  certFingerprintSha256?: string | null;
  verificationCode?: string | null;
}

export interface CustomLanTransportAdapter {
  request: (params: {
    host: string;
    port: number;
    method: 'GET' | 'POST';
    path: string;
    body?: any;
    authToken?: string;
    expectedFingerprint?: string;
    timeoutMs?: number;
  }) => Promise<LanTransportResult>;
  discoverHosts?: (timeoutMs?: number) => Promise<DiscoveredLanHost[]>;
  getNetworkStatus?: () => Promise<LanNetworkStatus>;
}

let customTransportOverride: CustomLanTransportAdapter | null = null;
const recentAttempts: LanDiagnosticAttempt[] = [];
const MAX_DIAGNOSTIC_ATTEMPTS = 25;

export function __setCustomLanTransportForTests(adapter: CustomLanTransportAdapter | null): void {
  customTransportOverride = adapter;
}

function recordDiagnosticAttempt(attempt: Omit<LanDiagnosticAttempt, 'id' | 'timestamp'>): void {
  recentAttempts.unshift({
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...attempt
  });
  if (recentAttempts.length > MAX_DIAGNOSTIC_ATTEMPTS) {
    recentAttempts.length = MAX_DIAGNOSTIC_ATTEMPTS;
  }
}

export function getLastLanAttempts(): LanDiagnosticAttempt[] {
  return [...recentAttempts];
}

export function formatVerificationCode(fp?: string | null): string | null {
  const clean = String(fp || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (clean.length < 8) return null;
  return `${clean.slice(0, 4)}:${clean.slice(4, 8)}`;
}

export function isValidIpv4OrHost(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (/^\d{6}$/.test(trimmed)) return false; // Never treat a 6-digit PIN as an IP address!
  if (/^p2p/i.test(trimmed)) return false;
  const ipv4Parts = trimmed.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255)) {
    return true;
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]{1,126}$/.test(trimmed);
}

export async function getLanNetworkStatus(): Promise<LanNetworkStatus> {
  if (customTransportOverride?.getNetworkStatus) {
    return customTransportOverride.getNetworkStatus();
  }

  const android = getNativeLanSyncPlugin();
  if (android) {
    try {
      const res = await android.getNetworkStatus();
      return {
        wifiConnected: Boolean(res?.wifiConnected),
        lanConnected: Boolean(res?.lanConnected),
        hasInternet: Boolean(res?.hasInternet),
        localIpv4Addresses: Array.isArray(res?.localIpv4Addresses) ? res.localIpv4Addresses : [],
        platform: 'android'
      };
    } catch {}
  }

  const electron = getElectronLanSyncBridge();
  if (electron?.getHostStatus) {
    try {
      const st = await electron.getHostStatus();
      const addrs = Array.isArray(st?.addresses) ? st.addresses : [];
      return {
        wifiConnected: addrs.length > 0,
        lanConnected: addrs.length > 0,
        hasInternet: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
        localIpv4Addresses: addrs,
        platform: 'electron'
      };
    } catch {}
  }

  const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  return {
    wifiConnected: online,
    lanConnected: online,
    hasInternet: online,
    localIpv4Addresses: [],
    platform: 'web'
  };
}

async function performUnauthenticatedLanRequest<T = any>(params: {
  host: string;
  port: number;
  method: 'GET' | 'POST';
  path: string;
  body?: any;
  expectedFingerprint?: string;
  timeoutMs?: number;
}): Promise<LanTransportResult<T>> {
  const cleanHost = String(params.host || '').trim();
  const cleanPort = Number(params.port) || DEFAULT_LAN_SYNC_PORT;

  if (!isValidIpv4OrHost(cleanHost) || cleanPort < 1 || cleanPort > 65535) {
    return {
      ok: false,
      httpStatus: 0,
      errorCode: 'INVALID_PAYLOAD',
      message: 'Please enter a valid IPv4 address and port (1–65535).'
    };
  }

  if (customTransportOverride) {
    return customTransportOverride.request({
      host: cleanHost,
      port: cleanPort,
      method: params.method,
      path: params.path,
      body: params.body,
      expectedFingerprint: params.expectedFingerprint,
      timeoutMs: params.timeoutMs
    });
  }

  const android = getNativeLanSyncPlugin();
  if (android) {
    if (params.path === '/api/sync/health' && params.method === 'GET') {
      return await android.testConnection({
        host: cleanHost,
        port: cleanPort,
        expectedFingerprint: params.expectedFingerprint,
        timeoutMs: params.timeoutMs
      });
    }
  }

  const electron = getElectronLanSyncBridge();
  if (electron?.testConnection && params.path === '/api/sync/health' && params.method === 'GET') {
    return await electron.testConnection({
      host: cleanHost,
      port: cleanPort,
      expectedFingerprint: params.expectedFingerprint,
      timeoutMs: params.timeoutMs
    });
  }

  // Fallback HTTP/HTTPS fetch for browser dev or Node test harnesses
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs || 6000);
  try {
    const scheme = typeof window !== 'undefined' && window.location?.protocol === 'http:' ? 'http' : 'https';
    const resp = await fetch(`${scheme}://${cleanHost}:${cleanPort}${params.path}`, {
      method: params.method,
      headers: {
        Accept: 'application/json',
        ...(params.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
      signal: controller.signal
    });
    const text = await resp.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      return {
        ok: false,
        httpStatus: resp.status,
        errorCode: 'INVALID_PAYLOAD',
        message: 'Invalid JSON response from LAN host.',
        latencyMs: Date.now() - startedAt
      };
    }
    if (!resp.ok || parsed?.ok === false) {
      return {
        ok: false,
        httpStatus: resp.status,
        errorCode: parsed?.errorCode || 'HOST_OFFLINE',
        message: parsed?.message || `HTTP ${resp.status}`,
        data: parsed,
        latencyMs: Date.now() - startedAt
      };
    }
    return {
      ok: true,
      httpStatus: resp.status,
      data: parsed,
      latencyMs: Date.now() - startedAt
    };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      httpStatus: 0,
      errorCode: aborted ? 'CONNECTION_TIMEOUT' : 'HOST_OFFLINE',
      message: aborted ? `Connection timed out after ${params.timeoutMs || 6000}ms.` : err?.message || 'Unable to reach LAN host.',
      latencyMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverLanHosts(timeoutMs = 2200): Promise<{
  wifiConnected: boolean;
  hosts: DiscoveredLanHost[];
}> {
  const netStatus = await getLanNetworkStatus();

  if (customTransportOverride?.discoverHosts) {
    const hosts = await customTransportOverride.discoverHosts(timeoutMs);
    recordDiagnosticAttempt({
      operation: 'discover',
      targetIp: '255.255.255.255',
      port: 41234,
      ok: true,
      message: `Discovered ${hosts.length} host(s)`
    });
    return { wifiConnected: netStatus.lanConnected, hosts };
  }

  const android = getNativeLanSyncPlugin();
  if (android) {
    const res = await android.discoverHosts({ timeoutMs });
    const hosts = Array.isArray(res?.hosts) ? res.hosts : [];
    recordDiagnosticAttempt({
      operation: 'discover',
      targetIp: '255.255.255.255',
      port: 41234,
      ok: true,
      message: `Android NSD/UDP discovered ${hosts.length} host(s)`
    });
    return { wifiConnected: Boolean(res?.wifiConnected), hosts };
  }

  const electron = getElectronLanSyncBridge();
  if (electron?.discoverHosts) {
    const hosts = await electron.discoverHosts(timeoutMs);
    const list = Array.isArray(hosts) ? hosts : [];
    recordDiagnosticAttempt({
      operation: 'discover',
      targetIp: '255.255.255.255',
      port: 41234,
      ok: true,
      message: `Desktop UDP discovered ${list.length} host(s)`
    });
    return { wifiConnected: netStatus.lanConnected, hosts: list };
  }

  return { wifiConnected: netStatus.lanConnected, hosts: [] };
}

export async function testLanHostConnection(
  host: string,
  port: number = DEFAULT_LAN_SYNC_PORT,
  expectedFingerprint?: string
): Promise<LanConnectionTestResult> {
  const cleanHost = String(host || '').trim();
  const cleanPort = Number(port) || DEFAULT_LAN_SYNC_PORT;

  const res = await performUnauthenticatedLanRequest<any>({
    host: cleanHost,
    port: cleanPort,
    method: 'GET',
    path: '/api/sync/health',
    expectedFingerprint,
    timeoutMs: 5000
  });

  recordDiagnosticAttempt({
    operation: 'health_check',
    targetIp: cleanHost,
    port: cleanPort,
    ok: res.ok,
    httpStatus: res.httpStatus,
    latencyMs: res.latencyMs,
    errorCode: res.errorCode,
    message: res.ok ? `Healthy (${res.data?.deviceName || cleanHost})` : res.message
  });

  if (!res.ok || !res.data) {
    return {
      ok: false,
      host: cleanHost,
      port: cleanPort,
      httpStatus: res.httpStatus,
      latencyMs: res.latencyMs,
      errorCode: res.errorCode || 'HOST_OFFLINE',
      message: res.message || `Could not reach ${cleanHost}:${cleanPort}`
    };
  }

  return {
    ok: true,
    host: cleanHost,
    port: cleanPort,
    httpStatus: res.httpStatus,
    latencyMs: res.latencyMs,
    deviceId: res.data.deviceId,
    deviceName: res.data.deviceName,
    addresses: Array.isArray(res.data.addresses) ? res.data.addresses : [cleanHost],
    protocolVersion: res.data.protocolVersion,
    tlsEnabled: Boolean(res.data.tlsEnabled),
    certFingerprintSha256: res.data.certFingerprintSha256 || res.certFingerprintSha256 || null,
    verificationCode:
      res.data.verificationCode ||
      formatVerificationCode(res.data.certFingerprintSha256 || res.certFingerprintSha256),
    pairingActive: Boolean(res.data.pairingActive)
  };
}

export async function pairWithLanHost(params: {
  host: string;
  port: number;
  pairingCode: string;
  localDeviceId: string;
  localDeviceName: string;
  expectedFingerprint?: string;
}): Promise<{
  ok: boolean;
  peer?: PairedPeer;
  errorCode?: LanSyncErrorCode;
  message?: string;
  latencyMs?: number;
}> {
  const cleanHost = String(params.host || '').trim();
  const cleanPort = Number(params.port) || DEFAULT_LAN_SYNC_PORT;
  const cleanCode = String(params.pairingCode || '').trim();

  if (!isValidIpv4OrHost(cleanHost) || cleanPort < 1 || cleanPort > 65535) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD', message: 'Valid PC IP address and port are required.' };
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, errorCode: 'PAIRING_CODE_INVALID', message: 'Enter the 6-digit pairing code shown on the PC host.' };
  }

  const header = createProtocolHeader();
  let res: LanTransportResult<any>;

  if (customTransportOverride) {
    res = await customTransportOverride.request({
      host: cleanHost,
      port: cleanPort,
      method: 'POST',
      path: '/api/sync/pair',
      body: {
        pairingCode: cleanCode,
        clientDeviceId: params.localDeviceId,
        clientDeviceName: params.localDeviceName,
        header
      },
      expectedFingerprint: params.expectedFingerprint,
      timeoutMs: 8000
    });
    if (res.ok && res.data?.authToken && res.data?.hostDeviceId) {
      setEphemeralLanCredential(
        res.data.hostDeviceId,
        res.data.authToken,
        res.data.certFingerprintSha256 || res.certFingerprintSha256 || params.expectedFingerprint
      );
      delete res.data.authToken;
    }
  } else {
    const android = getNativeLanSyncPlugin();
    const electron = getElectronLanSyncBridge();
    if (android) {
      res = await android.pair({
        host: cleanHost,
        port: cleanPort,
        pairingCode: cleanCode,
        localDeviceId: params.localDeviceId,
        localDeviceName: params.localDeviceName,
        expectedFingerprint: params.expectedFingerprint,
        header
      });
    } else if (electron?.pairClient) {
      res = await electron.pairClient({
        host: cleanHost,
        port: cleanPort,
        pairingCode: cleanCode,
        localDeviceId: params.localDeviceId,
        localDeviceName: params.localDeviceName,
        expectedFingerprint: params.expectedFingerprint,
        header
      });
    } else {
      res = await performUnauthenticatedLanRequest({
        host: cleanHost,
        port: cleanPort,
        method: 'POST',
        path: '/api/sync/pair',
        body: {
          pairingCode: cleanCode,
          clientDeviceId: params.localDeviceId,
          clientDeviceName: params.localDeviceName,
          header
        },
        expectedFingerprint: params.expectedFingerprint,
        timeoutMs: 8000
      });
      if (res.ok && res.data?.authToken && res.data?.hostDeviceId) {
        setEphemeralLanCredential(
          res.data.hostDeviceId,
          res.data.authToken,
          res.data.certFingerprintSha256 || res.certFingerprintSha256 || params.expectedFingerprint
        );
        delete res.data.authToken;
      }
    }
  }

  recordDiagnosticAttempt({
    operation: 'pair',
    targetIp: cleanHost,
    port: cleanPort,
    ok: res.ok,
    httpStatus: res.httpStatus,
    latencyMs: res.latencyMs,
    errorCode: res.errorCode,
    message: res.ok ? `Paired with ${res.data?.hostDeviceName || cleanHost}` : res.message
  });

  if (!res.ok || !res.data?.hostDeviceId) {
    return {
      ok: false,
      errorCode: res.errorCode || 'PAIRING_CODE_INVALID',
      message: res.message || 'Pairing rejected by host.',
      latencyMs: res.latencyMs
    };
  }

  const fingerprint = res.data.certFingerprintSha256 || res.certFingerprintSha256 || params.expectedFingerprint || undefined;
  const peer: PairedPeer = {
    deviceId: res.data.hostDeviceId,
    deviceName: res.data.hostDeviceName || `PC Host (${cleanHost})`,
    lastKnownIp: cleanHost,
    knownAddresses: Array.isArray(res.data.addresses) && res.data.addresses.length > 0 ? res.data.addresses : [cleanHost],
    port: Number(res.data.port) || cleanPort,
    hasStoredAuthToken: true,
    tlsFingerprintSha256: fingerprint,
    verificationCode: formatVerificationCode(fingerprint) || undefined,
    requiresRePairing: false,
    lastSyncedTimestamp: Date.now(),
    isOnline: true,
    protocolVersion: res.data.negotiatedVersion || header.protocolVersion,
    capabilities: res.data.agreedCapabilities || header.capabilities,
    lastHeartbeat: Date.now(),
    latencyMs: res.latencyMs
  };

  return {
    ok: true,
    peer,
    latencyMs: res.latencyMs
  };
}

async function executePairedRequestOnce<T = any>(params: {
  peer: PairedPeer;
  host: string;
  port: number;
  method: 'GET' | 'POST';
  path: string;
  body?: any;
  timeoutMs?: number;
}): Promise<LanTransportResult<T>> {
  const { peer, host, port, method, path, body, timeoutMs } = params;

  if (customTransportOverride) {
    const cred = getEphemeralLanCredential(peer.deviceId);
    const token = cred?.authToken || (peer as any).pairingToken;
    if (!token) {
      return {
        ok: false,
        httpStatus: 401,
        errorCode: 'UNAUTHORIZED_DEVICE',
        message: 'No stored authentication token for paired device. Re-pair required.'
      };
    }
    return customTransportOverride.request({
      host,
      port,
      method,
      path,
      body,
      authToken: token,
      expectedFingerprint: cred?.certFingerprintSha256 || peer.tlsFingerprintSha256,
      timeoutMs
    });
  }

  const android = getNativeLanSyncPlugin();
  if (android) {
    return await android.requestPaired({
      peerDeviceId: peer.deviceId,
      host,
      port,
      method,
      path,
      body,
      expectedFingerprint: peer.tlsFingerprintSha256,
      timeoutMs
    });
  }

  const electron = getElectronLanSyncBridge();
  if (electron?.requestPaired) {
    return await electron.requestPaired({
      peerDeviceId: peer.deviceId,
      host,
      port,
      method,
      path,
      body,
      expectedFingerprint: peer.tlsFingerprintSha256,
      timeoutMs
    });
  }

  const cred = getEphemeralLanCredential(peer.deviceId);
  if (!cred?.authToken) {
    return {
      ok: false,
      httpStatus: 401,
      errorCode: 'UNAUTHORIZED_DEVICE',
      message: 'No stored authentication token in browser memory. Re-pair required.'
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 15000);
  try {
    const scheme = typeof window !== 'undefined' && window.location?.protocol === 'http:' ? 'http' : 'https';
    const resp = await fetch(`${scheme}://${host}:${port}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${cred.authToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const parsed = await resp.json().catch(() => ({}));
    if (!resp.ok || parsed?.ok === false) {
      return {
        ok: false,
        httpStatus: resp.status,
        errorCode: parsed?.errorCode || (resp.status === 401 ? 'UNAUTHORIZED_DEVICE' : 'HOST_OFFLINE'),
        message: parsed?.message || `HTTP ${resp.status}`,
        data: parsed,
        latencyMs: Date.now() - startedAt
      };
    }
    return {
      ok: true,
      httpStatus: resp.status,
      data: parsed,
      latencyMs: Date.now() - startedAt
    };
  } catch (err: any) {
    return {
      ok: false,
      httpStatus: 0,
      errorCode: err?.name === 'AbortError' ? 'CONNECTION_TIMEOUT' : 'HOST_OFFLINE',
      message: err?.message || 'Unable to connect to paired device.',
      latencyMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes an authenticated LAN request against a paired peer.
 * Handles multi-address fallback AND automatic rediscovery when the PC host's Wi-Fi IP changes,
 * only updating the peer IP when both `deviceId` AND pinned `tlsFingerprintSha256` match.
 */
export async function sendAuthenticatedLanRequest<T = any>(params: {
  peer: PairedPeer;
  operation: LanDiagnosticAttempt['operation'];
  method: 'GET' | 'POST';
  path: string;
  body?: any;
  timeoutMs?: number;
  allowIpRediscovery?: boolean;
}): Promise<LanTransportResult<T> & { resolvedIp?: string; resolvedPort?: number }> {
  const { peer, operation, method, path, body, timeoutMs } = params;

  if (isLegacyUnmigratedPeer(peer)) {
    const res: LanTransportResult<T> = {
      ok: false,
      httpStatus: 401,
      errorCode: 'UNAUTHORIZED_DEVICE',
      message: 'This device uses a legacy pairing record and must be re-paired over local Wi-Fi.'
    };
    recordDiagnosticAttempt({
      operation,
      targetIp: peer.lastKnownIp || 'unmigrated',
      port: peer.port || 0,
      ok: false,
      errorCode: res.errorCode,
      message: res.message
    });
    return res;
  }

  const candidateIps = Array.from(
    new Set(
      [peer.lastKnownIp, ...(Array.isArray(peer.knownAddresses) ? peer.knownAddresses : [])].filter((ip) =>
        isValidIpv4OrHost(ip)
      )
    )
  );
  const port = Number(peer.port) || DEFAULT_LAN_SYNC_PORT;

  if (candidateIps.length === 0) {
    return {
      ok: false,
      httpStatus: 0,
      errorCode: 'HOST_OFFLINE',
      message: 'No valid LAN IP address recorded for paired host.'
    };
  }

  let lastResult: LanTransportResult<T> = {
    ok: false,
    httpStatus: 0,
    errorCode: 'HOST_OFFLINE',
    message: 'Host unreachable on known LAN addresses.'
  };

  for (const candidateIp of candidateIps) {
    const attempt = await executePairedRequestOnce<T>({
      peer,
      host: candidateIp,
      port,
      method,
      path,
      body,
      timeoutMs
    });

    if (attempt.ok) {
      recordDiagnosticAttempt({
        operation,
        targetIp: candidateIp,
        port,
        ok: true,
        httpStatus: attempt.httpStatus,
        latencyMs: attempt.latencyMs
      });
      return { ...attempt, resolvedIp: candidateIp, resolvedPort: port };
    }

    lastResult = attempt;

    // Do not retry alternate IPs on cryptographic/auth/protocol failures
    if (
      attempt.errorCode === 'UNAUTHORIZED_DEVICE' ||
      attempt.errorCode === 'CERTIFICATE_MISMATCH' ||
      attempt.errorCode === 'PROTOCOL_VERSION_MISMATCH' ||
      attempt.errorCode === 'INVALID_PAYLOAD' ||
      attempt.errorCode === 'STORAGE_SAVE_FAILED'
    ) {
      recordDiagnosticAttempt({
        operation,
        targetIp: candidateIp,
        port,
        ok: false,
        httpStatus: attempt.httpStatus,
        latencyMs: attempt.latencyMs,
        errorCode: attempt.errorCode,
        message: attempt.message
      });
      return attempt;
    }
  }

  // If connection failed due to IP change / unreachable host and rediscovery is permitted, probe LAN
  if (params.allowIpRediscovery !== false) {
    try {
      const { hosts } = await discoverLanHosts(1600);
      const matched = hosts.find(
        (h) =>
          h.deviceId === peer.deviceId &&
          (!peer.tlsFingerprintSha256 ||
            !h.certFingerprintSha256 ||
            h.certFingerprintSha256.toLowerCase() === peer.tlsFingerprintSha256.toLowerCase())
      );

      if (matched && matched.primaryIp && !candidateIps.includes(matched.primaryIp)) {
        const retryPort = matched.port || port;
        const rediscoveredAttempt = await executePairedRequestOnce<T>({
          peer,
          host: matched.primaryIp,
          port: retryPort,
          method,
          path,
          body,
          timeoutMs
        });
        recordDiagnosticAttempt({
          operation,
          targetIp: matched.primaryIp,
          port: retryPort,
          ok: rediscoveredAttempt.ok,
          httpStatus: rediscoveredAttempt.httpStatus,
          latencyMs: rediscoveredAttempt.latencyMs,
          errorCode: rediscoveredAttempt.errorCode,
          message: rediscoveredAttempt.ok
            ? `Reconnected after host IP change -> ${matched.primaryIp}:${retryPort}`
            : rediscoveredAttempt.message
        });
        if (rediscoveredAttempt.ok) {
          return {
            ...rediscoveredAttempt,
            resolvedIp: matched.primaryIp,
            resolvedPort: retryPort
          };
        }
        lastResult = rediscoveredAttempt;
      }
    } catch {}
  }

  recordDiagnosticAttempt({
    operation,
    targetIp: candidateIps[0],
    port,
    ok: false,
    httpStatus: lastResult.httpStatus,
    latencyMs: lastResult.latencyMs,
    errorCode: lastResult.errorCode,
    message: lastResult.message
  });

  return lastResult;
}
