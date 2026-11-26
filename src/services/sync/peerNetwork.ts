import PeerPkg, { type DataConnection } from 'peerjs';
import {
  PAIRING_PIN_TTL_MS,
  P2pDiagnosticAttempt,
  P2pSyncErrorCode
} from '../../types';
import { connectivityEngine } from './connectivityEngine';

const DefaultPeerCtor = (PeerPkg as any).default || PeerPkg;

export interface PeerLike {
  id: string;
  open: boolean;
  destroyed: boolean;
  disconnected: boolean;
  on(event: string, listener: (...args: any[]) => void): void;
  once?(event: string, listener: (...args: any[]) => void): void;
  connect(id: string, opts?: any): DataConnection;
  reconnect(): void;
  destroy(): void;
}

export type PeerConstructor = new (id?: string, options?: any) => PeerLike;

let activePeerCtor: PeerConstructor = DefaultPeerCtor as unknown as PeerConstructor;

// Public STUN servers for direct WebRTC P2P traversal across NAT / Wi-Fi / mobile networks.
// Optional TURN relay slot (disabled by default): add TURN credentials here only if symmetric NAT relay is needed.
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
  // { urls: 'turn:turn.example.com:3478', username: '', credential: '' }
];

export interface P2pTransportError extends Error {
  errorCode: P2pSyncErrorCode;
}

export function createP2pError(errorCode: P2pSyncErrorCode, message: string): P2pTransportError {
  const err = new Error(message) as P2pTransportError;
  err.name = 'P2pTransportError';
  err.errorCode = errorCode;
  return err;
}

export function isP2pErrorCode(err: unknown, code: P2pSyncErrorCode): boolean {
  return Boolean(err && typeof err === 'object' && (err as any).errorCode === code);
}

export function getP2pErrorCode(err: unknown, fallback: P2pSyncErrorCode = 'PEER_OFFLINE'): P2pSyncErrorCode {
  if (err && typeof err === 'object' && typeof (err as any).errorCode === 'string') {
    return (err as any).errorCode as P2pSyncErrorCode;
  }
  const msg = String((err as any)?.message || err || '').toLowerCase();
  if (msg.includes('expired')) return 'PIN_EXPIRED';
  if (msg.includes('invalid pin') || msg.includes('wrong pin')) return 'PIN_INVALID';
  if (msg.includes('timed out') || msg.includes('timeout')) return 'TIMEOUT';
  if (msg.includes('ice')) return 'ICE_FAILED';
  if (msg.includes('device id missing')) return 'DEVICE_ID_MISSING';
  if (msg.includes('unauthorized') || msg.includes('not paired') || msg.includes('revoked')) return 'UNAUTHORIZED_DEVICE';
  if (msg.includes('protocol')) return 'PROTOCOL_VERSION_MISMATCH';
  if (msg.includes('storage')) return 'STORAGE_SAVE_FAILED';
  if (msg.includes('broker') || msg.includes('signalling')) return 'BROKER_DOWN';
  if (msg.includes('in use') || msg.includes('unavailable-id')) return 'ID_IN_USE';
  return fallback;
}

export function sanitizePeerId(identifier: string): string {
  return String(identifier || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function formatDevicePeerId(deviceId: string): string {
  const cleanId = sanitizePeerId(deviceId.trim());
  return `glueck-dev-${cleanId}`;
}

export function formatPairingPinId(pin: string): string {
  const cleanPin = String(pin || '').replace(/\D/g, '').slice(0, 6);
  return `glueck-${cleanPin}`;
}

const MAX_DIAGNOSTIC_ATTEMPTS = 40;
const recentP2pAttempts: P2pDiagnosticAttempt[] = [];

export function recordP2pDiagnosticAttempt(attempt: Omit<P2pDiagnosticAttempt, 'id' | 'timestamp'>): void {
  const entry: P2pDiagnosticAttempt = {
    ...attempt,
    id: `p2p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now()
  };
  recentP2pAttempts.unshift(entry);
  if (recentP2pAttempts.length > MAX_DIAGNOSTIC_ATTEMPTS) {
    recentP2pAttempts.length = MAX_DIAGNOSTIC_ATTEMPTS;
  }
}

export function getLastP2pAttempts(): P2pDiagnosticAttempt[] {
  return [...recentP2pAttempts];
}

export interface StartHostResult {
  peerId: string;
  brokerConnected: boolean;
  errorCode?: P2pSyncErrorCode;
  errorMessage?: string;
}

export interface EnablePinResult {
  ok: boolean;
  peerId?: string;
  errorCode?: P2pSyncErrorCode;
  message?: string;
}

class PeerNetwork {
  private peer: PeerLike | null = null;
  private pairingPeer: PeerLike | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private resolvers: Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: any }> = new Map();
  private pendingConnects: Map<string, { reject: (err: any) => void; timeout: any }> = new Map();

  public myId: string | null = null;
  public myDeviceId: string | null = null;
  public currentPairingPin: string | null = null;
  public currentPairingPinExpiresAt: number = 0;
  public lastIssuedPin: string | null = null;
  public lastIssuedPinExpiresAt: number = 0;
  public brokerConnected: boolean = false;
  public lastHostErrorCode: P2pSyncErrorCode | null = null;
  public lastHostErrorMessage: string | null = null;
  public lastIceCandidateType: string | null = null;

  private activeRouteHandler: ((route: string, data: any) => Promise<any>) | null = null;
  private reconnectTimer: any = null;
  private pairingPinTimer: any = null;
  private startHostPromise: Promise<StartHostResult> | null = null;
  private startHostDeviceKey: string | null = null;
  private isDestroyed = false;

  // Configurable timing knobs (overridden in unit tests so tests run quickly without real 6s waits)
  private brokerConnectTimeoutMs = 5000;
  private unavailableIdRetryDelaysMs = [2000, 2000, 2000];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.reconnect();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.peer && this.peer.disconnected) {
          this.reconnect();
        }
      });
    }
  }

  public __setTimingForTests(opts?: {
    brokerConnectTimeoutMs?: number;
    unavailableIdRetryDelaysMs?: number[];
  }) {
    this.brokerConnectTimeoutMs = opts?.brokerConnectTimeoutMs ?? 5000;
    this.unavailableIdRetryDelaysMs = opts?.unavailableIdRetryDelaysMs ?? [2000, 2000, 2000];
  }

  /**
   * Validates an incoming PIN against the active or recently expired PIN,
   * distinguishing PIN_EXPIRED from PIN_INVALID.
   */
  public validatePairingPin(submittedPin: string): { ok: true } | { ok: false; errorCode: 'PIN_EXPIRED' | 'PIN_INVALID'; message: string } {
    const cleanSubmitted = String(submittedPin || '').replace(/\D/g, '').slice(0, 6);
    if (!cleanSubmitted || cleanSubmitted.length < 6) {
      return { ok: false, errorCode: 'PIN_INVALID', message: 'Invalid 6-digit pairing code.' };
    }
    const now = Date.now();
    if (this.currentPairingPin && cleanSubmitted === this.currentPairingPin) {
      if (this.currentPairingPinExpiresAt > 0 && now > this.currentPairingPinExpiresAt) {
        this.disablePairingPin();
        return {
          ok: false,
          errorCode: 'PIN_EXPIRED',
          message: 'Pairing code has expired. Generate a new code and try again.'
        };
      }
      return { ok: true };
    }
    if (this.lastIssuedPin && cleanSubmitted === this.lastIssuedPin && this.lastIssuedPinExpiresAt > 0 && now > this.lastIssuedPinExpiresAt) {
      return {
        ok: false,
        errorCode: 'PIN_EXPIRED',
        message: 'Pairing code has expired. Generate a new code and try again.'
      };
    }
    return {
      ok: false,
      errorCode: 'PIN_INVALID',
      message: 'Incorrect 6-digit pairing code.'
    };
  }

  /**
   * Starts the primary long-lived host node for this device with deterministic ID.
   * Never fakes readiness on timeout or unavailable-id; retries unavailable-id up to 3x before failing.
   */
  async startHost(deviceId: string): Promise<StartHostResult> {
    const cleanDeviceId = String(deviceId || '').trim();
    if (!cleanDeviceId) {
      this.brokerConnected = false;
      this.lastHostErrorCode = 'DEVICE_ID_MISSING';
      this.lastHostErrorMessage = 'Local device ID is missing.';
      connectivityEngine.setBrokerStatus(false, 'DEVICE_ID_MISSING', this.lastHostErrorMessage);
      return {
        peerId: '',
        brokerConnected: false,
        errorCode: 'DEVICE_ID_MISSING',
        errorMessage: this.lastHostErrorMessage
      };
    }

    this.isDestroyed = false;
    this.myDeviceId = cleanDeviceId;
    const peerId = formatDevicePeerId(cleanDeviceId);

    // Reuse existing healthy open peer
    if (this.peer && this.myId === peerId && !this.peer.destroyed && this.peer.open && this.brokerConnected) {
      return { peerId, brokerConnected: true };
    }

    if (this.startHostPromise && this.startHostDeviceKey === cleanDeviceId) {
      return this.startHostPromise;
    }

    this.startHostDeviceKey = cleanDeviceId;
    this.startHostPromise = this.attemptStartHostWithRetries(peerId).finally(() => {
      if (this.startHostDeviceKey === cleanDeviceId) {
        this.startHostPromise = null;
        this.startHostDeviceKey = null;
      }
    });

    return this.startHostPromise;
  }

  private async attemptStartHostWithRetries(peerId: string): Promise<StartHostResult> {
    const retryDelays = this.unavailableIdRetryDelaysMs;
    const maxAttempts = 1 + retryDelays.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.isDestroyed) {
        return {
          peerId,
          brokerConnected: false,
          errorCode: 'BROKER_DOWN',
          errorMessage: 'Peer network was stopped before connecting.'
        };
      }

      const result = await this.attemptSingleHostOpen(peerId);
      if (result.brokerConnected) {
        return result;
      }
      if (result.errorCode === 'ID_IN_USE' && attempt < retryDelays.length) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      return result;
    }

    this.brokerConnected = false;
    this.lastHostErrorCode = 'ID_IN_USE';
    this.lastHostErrorMessage = 'Device signalling ID is already in use.';
    connectivityEngine.setBrokerStatus(false, 'ID_IN_USE', this.lastHostErrorMessage);
    return {
      peerId,
      brokerConnected: false,
      errorCode: 'ID_IN_USE',
      errorMessage: this.lastHostErrorMessage
    };
  }

  private attemptSingleHostOpen(peerId: string): Promise<StartHostResult> {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }

    this.myId = peerId;
    this.brokerConnected = false;

    return new Promise((resolve) => {
      let isSettled = false;
      let suppressLifecycleEvents = false;
      let candidatePeer: PeerLike;

      const finish = (res: StartHostResult, destroyFailedPeer = false) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(initTimeout);

        this.brokerConnected = res.brokerConnected;
        this.lastHostErrorCode = res.errorCode || null;
        this.lastHostErrorMessage = res.errorMessage || null;
        connectivityEngine.setBrokerStatus(
          res.brokerConnected,
          res.errorCode || null,
          res.errorMessage || null
        );

        if (destroyFailedPeer) {
          suppressLifecycleEvents = true;
          if (this.peer === candidatePeer) {
            this.peer = null;
          }
          try {
            candidatePeer?.destroy();
          } catch {}
        }
        resolve(res);
      };

      try {
        candidatePeer = new activePeerCtor(peerId, {
          debug: 0,
          config: {
            iceServers: DEFAULT_ICE_SERVERS,
            sdpSemantics: 'unified-plan'
          }
        });
        this.peer = candidatePeer;
      } catch (initErr: any) {
        finish(
          {
            peerId,
            brokerConnected: false,
            errorCode: 'BROKER_DOWN',
            errorMessage: initErr?.message || 'Failed to initialize WebRTC signalling client.'
          },
          true
        );
        return;
      }

      const initTimeout = setTimeout(() => {
        finish(
          {
            peerId,
            brokerConnected: false,
            errorCode: 'BROKER_DOWN',
            errorMessage: 'Signalling server connection timed out.'
          },
          true
        );
      }, this.brokerConnectTimeoutMs);

      candidatePeer.on('open', (id: string) => {
        if (suppressLifecycleEvents || this.peer !== candidatePeer) return;
        this.myId = id || peerId;
        finish({ peerId: this.myId, brokerConnected: true }, false);
      });

      candidatePeer.on('disconnected', () => {
        if (suppressLifecycleEvents || this.peer !== candidatePeer) return;
        this.brokerConnected = false;
        connectivityEngine.setBrokerStatus(false, 'BROKER_DOWN', 'Disconnected from signalling server.');
        this.scheduleReconnect();
      });

      candidatePeer.on('close', () => {
        if (suppressLifecycleEvents || this.peer !== candidatePeer) return;
        this.brokerConnected = false;
        connectivityEngine.setBrokerStatus(false, 'BROKER_DOWN', 'Signalling connection closed.');
      });

      candidatePeer.on('connection', (conn: DataConnection) => {
        if (suppressLifecycleEvents || this.peer !== candidatePeer) return;
        this.setupConnection(conn);
      });

      candidatePeer.on('error', (err: any) => {
        const errType = String(err?.type || '');
        const errMsg = String(err?.message || err || 'Unknown PeerJS error');

        if (errType === 'peer-unavailable') {
          const match = errMsg.match(/glueck-(?:dev-)?[a-zA-Z0-9_-]+/);
          const failedTargetId = match ? match[0] : null;
          if (failedTargetId) {
            this.handlePeerUnavailable(failedTargetId);
          } else {
            for (const [targetId] of Array.from(this.pendingConnects.entries())) {
              this.handlePeerUnavailable(targetId);
            }
          }
          return;
        }

        if (errType === 'unavailable-id') {
          finish(
            {
              peerId,
              brokerConnected: false,
              errorCode: 'ID_IN_USE',
              errorMessage: 'Device signalling ID is already held by another active session.'
            },
            true
          );
          return;
        }

        if (
          errType === 'network' ||
          errType === 'disconnected' ||
          errType === 'socket-error' ||
          errType === 'socket-closed' ||
          errType === 'server-error'
        ) {
          if (!isSettled) {
            finish(
              {
                peerId,
                brokerConnected: false,
                errorCode: 'BROKER_DOWN',
                errorMessage: errMsg || 'Signalling broker unreachable.'
              },
              false
            );
          } else {
            this.brokerConnected = false;
            connectivityEngine.setBrokerStatus(false, 'BROKER_DOWN', errMsg);
            this.scheduleReconnect();
          }
          return;
        }

        if (!isSettled) {
          finish(
            {
              peerId,
              brokerConnected: false,
              errorCode: 'BROKER_DOWN',
              errorMessage: errMsg
            },
            true
          );
        }
      });
    });
  }

  /**
   * Activates an ephemeral signalling listener `glueck-<PIN>` ONLY when host broker connection is healthy.
   */
  async enablePairingPin(pin: string, ttlMs: number = PAIRING_PIN_TTL_MS): Promise<EnablePinResult> {
    const cleanPin = String(pin || '').replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      return {
        ok: false,
        errorCode: 'PIN_INVALID',
        message: 'Pairing PIN must be 6 digits.'
      };
    }

    if (!this.brokerConnected || !this.peer || this.peer.destroyed || !this.peer.open) {
      this.disablePairingPin();
      return {
        ok: false,
        errorCode: this.lastHostErrorCode || 'BROKER_DOWN',
        message: this.lastHostErrorMessage || 'Cannot activate pairing code while signalling is disconnected.'
      };
    }

    const pairingPeerId = formatPairingPinId(cleanPin);
    const expiresAt = Date.now() + Math.max(1000, ttlMs);

    if (this.pairingPinTimer) {
      clearTimeout(this.pairingPinTimer);
      this.pairingPinTimer = null;
    }

    this.currentPairingPin = cleanPin;
    this.currentPairingPinExpiresAt = expiresAt;
    this.lastIssuedPin = cleanPin;
    this.lastIssuedPinExpiresAt = expiresAt;

    if (ttlMs > 0) {
      this.pairingPinTimer = setTimeout(() => {
        this.disablePairingPin();
      }, ttlMs);
    }

    if (this.pairingPeer && !this.pairingPeer.destroyed && this.pairingPeer.open && this.pairingPeer.id === pairingPeerId) {
      return { ok: true, peerId: pairingPeerId };
    }

    if (this.pairingPeer) {
      try {
        this.pairingPeer.destroy();
      } catch {}
      this.pairingPeer = null;
    }

    return new Promise((resolve) => {
      let settled = false;
      const done = (res: EnablePinResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(pinTimeout);
        resolve(res);
      };

      const pinTimeout = setTimeout(() => {
        done({ ok: true, peerId: pairingPeerId });
      }, Math.min(2500, this.brokerConnectTimeoutMs));

      try {
        const pPeer = new activePeerCtor(pairingPeerId, {
          debug: 0,
          config: {
            iceServers: DEFAULT_ICE_SERVERS,
            sdpSemantics: 'unified-plan'
          }
        });
        this.pairingPeer = pPeer;

        pPeer.on('open', (id: string) => {
          done({ ok: true, peerId: id || pairingPeerId });
        });

        pPeer.on('connection', (conn: DataConnection) => {
          this.setupConnection(conn);
        });

        pPeer.on('error', (err: any) => {
          const errType = String(err?.type || '');
          if (errType === 'unavailable-id') {
            done({ ok: true, peerId: pairingPeerId });
            return;
          }
          if (errType === 'network' || errType === 'socket-error' || errType === 'server-error') {
            done({
              ok: false,
              errorCode: 'BROKER_DOWN',
              message: err?.message || 'Signalling unreachable for pairing listener.'
            });
            return;
          }
          done({
            ok: false,
            errorCode: 'BROKER_DOWN',
            message: err?.message || 'Failed to publish pairing code.'
          });
        });
      } catch (e: any) {
        done({
          ok: false,
          errorCode: 'BROKER_DOWN',
          message: e?.message || 'Failed to start pairing PIN listener.'
        });
      }
    });
  }

  public disablePairingPin() {
    if (this.pairingPinTimer) {
      clearTimeout(this.pairingPinTimer);
      this.pairingPinTimer = null;
    }
    if (this.pairingPeer) {
      try {
        this.pairingPeer.destroy();
      } catch {}
      this.pairingPeer = null;
    }
    this.currentPairingPin = null;
    this.currentPairingPinExpiresAt = 0;
  }

  setRouteHandler(handler: (route: string, data: any) => Promise<any>) {
    this.activeRouteHandler = handler;
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnect();
    }, 4000);
  }

  public reconnect() {
    if (this.isDestroyed) return;
    if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
      try {
        this.peer.reconnect();
      } catch {}
    } else if ((!this.peer || this.peer.destroyed) && this.myDeviceId) {
      void this.startHost(this.myDeviceId);
    }
  }

  private handlePeerUnavailable(targetId: string) {
    const friendly = targetId.replace(/^glueck-dev-|^glueck-/, '');
    const pending = this.pendingConnects.get(targetId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(
        createP2pError('PEER_OFFLINE', `Peer ${friendly} is offline or unreachable on signalling.`)
      );
      this.pendingConnects.delete(targetId);
    }
    const existing = this.connections.get(targetId);
    if (existing) {
      try {
        existing.close();
      } catch {}
      this.connections.delete(targetId);
    }
  }

  private captureIceCandidateStats(conn: DataConnection) {
    try {
      const pc = (conn as any)?.peerConnection as RTCPeerConnection | undefined;
      if (!pc || typeof pc.getStats !== 'function') return;
      void pc
        .getStats()
        .then((stats) => {
          stats.forEach((report: any) => {
            if (report?.type === 'candidate-pair' && report.state === 'succeeded' && report.remoteCandidateId) {
              const remote = stats.get(report.remoteCandidateId);
              const cType = remote?.candidateType || report?.candidateType;
              if (cType) {
                this.lastIceCandidateType = String(cType);
                connectivityEngine.setLastIceCandidateType(this.lastIceCandidateType);
              }
            }
          });
        })
        .catch(() => {});
    } catch {}
  }

  private setupConnection(conn: DataConnection) {
    const targetId = conn.peer;

    conn.on('open', () => {
      this.connections.set(targetId, conn);
      this.captureIceCandidateStats(conn);
    });

    conn.on('iceStateChanged', (state: string) => {
      if (state === 'failed') {
        this.connections.delete(targetId);
        const pending = this.pendingConnects.get(targetId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingConnects.delete(targetId);
          pending.reject(createP2pError('ICE_FAILED', 'WebRTC ICE negotiation failed (NAT/firewall blocked).'));
        }
      }
    });

    conn.on('close', () => {
      this.connections.delete(targetId);
    });

    conn.on('error', () => {
      this.connections.delete(targetId);
    });

    conn.on('data', async (payload: any) => {
      if (payload?.type === 'request' && this.activeRouteHandler) {
        try {
          const responseData = await this.activeRouteHandler(payload.route, payload.data);
          conn.send({ type: 'response', id: payload.id, data: responseData });
        } catch (error: any) {
          const errorCode = getP2pErrorCode(error, 'STORAGE_SAVE_FAILED');
          conn.send({
            type: 'error',
            id: payload.id,
            errorCode,
            error: error?.message || 'Remote sync error'
          });
        }
      } else if (payload?.type === 'response') {
        const resolver = this.resolvers.get(payload.id);
        if (resolver) {
          clearTimeout(resolver.timeout);
          resolver.resolve(payload.data);
          this.resolvers.delete(payload.id);
        }
      } else if (payload?.type === 'error') {
        const resolver = this.resolvers.get(payload.id);
        if (resolver) {
          clearTimeout(resolver.timeout);
          const code = (payload.errorCode as P2pSyncErrorCode) || getP2pErrorCode(payload.error, 'STORAGE_SAVE_FAILED');
          resolver.reject(createP2pError(code, payload.error || 'Remote error'));
          this.resolvers.delete(payload.id);
        }
      }
    });
  }

  /**
   * Resolves the proper PeerJS ID for a given target identifier.
   * 6-digit numeric PIN -> 'glueck-{PIN}'
   * Device ID -> 'glueck-dev-{deviceId}'
   */
  public resolveTargetPeerId(targetIdentifier: string): string {
    const cleaned = String(targetIdentifier || '').trim();
    if (cleaned.startsWith('glueck-')) {
      return cleaned;
    }
    if (/^\d{6}$/.test(cleaned)) {
      return formatPairingPinId(cleaned);
    }
    return formatDevicePeerId(cleaned);
  }

  async fetch(targetIdentifier: string, route: string, data: any, timeoutMs = 8000): Promise<any> {
    if (!this.myDeviceId) {
      throw createP2pError('DEVICE_ID_MISSING', 'Local device ID is missing; cannot send P2P request.');
    }

    const cleanTarget = String(targetIdentifier || '').trim();
    if (!cleanTarget) {
      throw createP2pError('PEER_OFFLINE', 'Target peer identifier is empty.');
    }

    if (!this.peer || this.peer.destroyed || !this.brokerConnected) {
      const hostRes = await this.startHost(this.myDeviceId);
      if (!hostRes.brokerConnected || !this.peer || this.peer.destroyed) {
        throw createP2pError(
          hostRes.errorCode || 'BROKER_DOWN',
          hostRes.errorMessage || 'Signalling broker is unreachable.'
        );
      }
    }

    const targetId = this.resolveTargetPeerId(cleanTarget);
    const friendlyName = cleanTarget.replace(/^glueck-dev-|^glueck-/, '');

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const safeResolve = (val: any) => {
        if (!isSettled) {
          isSettled = true;
          resolve(val);
        }
      };
      const safeReject = (err: any) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

      const doRequest = (connection: DataConnection) => {
        const reqId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2);

        const timeout = setTimeout(() => {
          this.resolvers.delete(reqId);
          safeReject(createP2pError('TIMEOUT', `Request to ${friendlyName} timed out.`));
        }, timeoutMs);

        this.resolvers.set(reqId, { resolve: safeResolve, reject: safeReject, timeout });

        try {
          connection.send({
            type: 'request',
            id: reqId,
            route,
            data
          });
        } catch (sendErr: any) {
          clearTimeout(timeout);
          this.resolvers.delete(reqId);
          this.connections.delete(targetId);
          safeReject(
            createP2pError(getP2pErrorCode(sendErr, 'ICE_FAILED'), sendErr?.message || 'Failed sending WebRTC message.')
          );
        }
      };

      const existingConn = this.connections.get(targetId);
      if (existingConn && existingConn.open) {
        doRequest(existingConn);
        return;
      }

      if (existingConn) {
        try {
          existingConn.close();
        } catch {}
        this.connections.delete(targetId);
      }

      const connectTimeout = setTimeout(() => {
        this.pendingConnects.delete(targetId);
        safeReject(createP2pError('TIMEOUT', `Connection to ${friendlyName} timed out (device may be offline).`));
      }, timeoutMs);

      this.pendingConnects.set(targetId, {
        reject: (err: any) => {
          clearTimeout(connectTimeout);
          safeReject(err);
        },
        timeout: connectTimeout
      });

      try {
        const conn = this.peer!.connect(targetId, { reliable: true });
        this.setupConnection(conn);

        conn.on('open', () => {
          clearTimeout(connectTimeout);
          this.pendingConnects.delete(targetId);
          this.connections.set(targetId, conn);
          this.captureIceCandidateStats(conn);
          doRequest(conn);
        });

        conn.on('iceStateChanged', (state: string) => {
          if (state === 'failed') {
            clearTimeout(connectTimeout);
            this.pendingConnects.delete(targetId);
            this.connections.delete(targetId);
            safeReject(createP2pError('ICE_FAILED', 'WebRTC ICE negotiation failed (NAT/firewall blocked).'));
          }
        });

        conn.on('close', () => {
          this.connections.delete(targetId);
          if (!isSettled && this.pendingConnects.has(targetId)) {
            clearTimeout(connectTimeout);
            this.pendingConnects.delete(targetId);
            safeReject(createP2pError('PEER_OFFLINE', `Connection to ${friendlyName} closed before completing handshake.`));
          }
        });

        conn.on('error', (err: any) => {
          clearTimeout(connectTimeout);
          this.pendingConnects.delete(targetId);
          this.connections.delete(targetId);
          safeReject(createP2pError(getP2pErrorCode(err, 'ICE_FAILED'), err?.message || 'WebRTC connection failed.'));
        });
      } catch (e: any) {
        clearTimeout(connectTimeout);
        this.pendingConnects.delete(targetId);
        safeReject(createP2pError(getP2pErrorCode(e, 'BROKER_DOWN'), e?.message || 'Unable to open P2P channel.'));
      }
    });
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.disablePairingPin();
    for (const [, conn] of this.connections) {
      try {
        conn.close();
      } catch {}
    }
    this.connections.clear();
    for (const [, res] of this.resolvers) {
      clearTimeout(res.timeout);
      res.reject(createP2pError('PEER_OFFLINE', 'Peer network destroyed.'));
    }
    this.resolvers.clear();
    for (const [, pending] of this.pendingConnects) {
      clearTimeout(pending.timeout);
      pending.reject(createP2pError('PEER_OFFLINE', 'Peer network destroyed.'));
    }
    this.pendingConnects.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
    this.myId = null;
    this.myDeviceId = null;
    this.brokerConnected = false;
    this.lastHostErrorCode = null;
    this.lastHostErrorMessage = null;
    this.lastIssuedPin = null;
    this.lastIssuedPinExpiresAt = 0;
    this.startHostPromise = null;
    this.startHostDeviceKey = null;
  }
}

export const peerNetwork = new PeerNetwork();

export function __setPeerConstructorForTests(ctor: PeerConstructor | null) {
  activePeerCtor = ctor || (DefaultPeerCtor as unknown as PeerConstructor);
}

export function __resetPeerNetworkForTests(timingOpts?: {
  brokerConnectTimeoutMs?: number;
  unavailableIdRetryDelaysMs?: number[];
}) {
  peerNetwork.destroy();
  peerNetwork.__setTimingForTests(timingOpts);
  recentP2pAttempts.length = 0;
}
