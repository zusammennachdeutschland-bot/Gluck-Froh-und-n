import { Peer, DataConnection } from 'peerjs';
import { connectivityEngine } from './connectivityEngine';

// Modern, robust public STUN servers for WebRTC P2P discovery without broken TURN endpoints
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

export function sanitizePeerId(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function formatDevicePeerId(deviceId: string): string {
  const cleanId = sanitizePeerId(deviceId);
  return `glueck-dev-${cleanId}`;
}

export function formatPairingPinId(pin: string): string {
  const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
  return `glueck-${cleanPin}`;
}

class PeerNetwork {
  private peer: Peer | null = null;
  private pairingPeer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private resolvers: Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: any }> = new Map();
  private pendingConnects: Map<string, { reject: (err: any) => void; timeout: any }> = new Map();

  public myId: string | null = null;
  public myDeviceId: string | null = null;
  public currentPairingPin: string | null = null;

  private activeRouteHandler: ((route: string, data: any) => Promise<any>) | null = null;
  private reconnectTimer: any = null;
  private isDestroyed = false;

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

  /**
   * Starts the primary long-lived host node for this device with deterministic ID.
   */
  async startHost(deviceIdOrPin: string): Promise<string> {
    this.isDestroyed = false;
    
    // Determine whether this is a full deviceId or a legacy PIN
    const isPin = /^\d{6}$/.test(deviceIdOrPin.trim());
    const peerId = isPin ? formatPairingPinId(deviceIdOrPin) : formatDevicePeerId(deviceIdOrPin);
    
    if (!isPin) {
      this.myDeviceId = deviceIdOrPin;
    }

    // If already running with this ID and open, reuse
    if (this.peer && this.myId === peerId && !this.peer.destroyed && this.peer.open) {
      return peerId;
    }

    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }

    this.myId = peerId;
    
    return new Promise((resolve, reject) => {
      let isSettled = false;

      try {
        this.peer = new Peer(peerId, {
          debug: 0,
          config: {
            iceServers: DEFAULT_ICE_SERVERS,
            sdpSemantics: 'unified-plan'
          }
        });
      } catch (initErr) {
        return reject(initErr);
      }
      
      const initTimeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          // Resolve with peerId anyway so local offline state continues
          resolve(peerId);
        }
      }, 5000);

      this.peer.on('open', (id) => {
        connectivityEngine.setBrokerStatus(true);
        if (!isSettled) {
          isSettled = true;
          clearTimeout(initTimeout);
          resolve(id);
        }
      });

      this.peer.on('disconnected', () => {
        connectivityEngine.setBrokerStatus(false);
        this.scheduleReconnect();
      });

      this.peer.on('close', () => {
        connectivityEngine.setBrokerStatus(false);
      });
      
      this.peer.on('error', (err: any) => {
        const errType = err?.type;
        const errMsg = err?.message || String(err);

        if (errType === 'network' || errType === 'disconnected' || errType === 'socket-error' || errType === 'socket-closed') {
          connectivityEngine.setBrokerStatus(false);
          this.scheduleReconnect();
        }

        if (errType === 'peer-unavailable') {
          const match = errMsg.match(/glueck-[a-zA-Z0-9_-]+/);
          const failedTargetId = match ? match[0] : null;
          if (failedTargetId) {
            this.handlePeerUnavailable(failedTargetId, errMsg);
          } else {
            for (const [targetId, pending] of this.pendingConnects.entries()) {
              pending.reject(new Error(errMsg));
              this.pendingConnects.delete(targetId);
            }
          }
          return;
        }

        if (errType === 'unavailable-id') {
          console.warn(`[PeerNetwork] Peer ID registered or recovering: ${errMsg}`);
          if (!isSettled) {
            isSettled = true;
            clearTimeout(initTimeout);
            resolve(peerId);
          }
          return;
        }

        if (errType === 'network' || errType === 'disconnected' || errType === 'socket-error' || errType === 'socket-closed') {
          return;
        }

        console.warn(`[PeerNetwork] Notice:`, errMsg);
        if (!isSettled) {
          isSettled = true;
          clearTimeout(initTimeout);
          resolve(peerId);
        }
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });
    });
  }

  /**
   * Activates an ephemeral listener for a 6-digit PIN to allow companion devices to discover and pair.
   */
  async enablePairingPin(pin: string): Promise<void> {
    const pairingPeerId = formatPairingPinId(pin);
    this.currentPairingPin = pin;

    if (this.pairingPeer && !this.pairingPeer.destroyed && this.pairingPeer.open) {
      if (this.pairingPeer.id === pairingPeerId) return;
      try { this.pairingPeer.destroy(); } catch (_) {}
    }

    try {
      this.pairingPeer = new Peer(pairingPeerId, {
        debug: 0,
        config: {
          iceServers: DEFAULT_ICE_SERVERS,
          sdpSemantics: 'unified-plan'
        }
      });

      this.pairingPeer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.pairingPeer.on('error', (err: any) => {
        // Ephemeral pairing errors are non-fatal
        if (err?.type !== 'unavailable-id') {
          console.warn(`[PeerNetwork] Pairing bridge notice:`, err?.message || err);
        }
      });
    } catch (e) {
      console.warn('[PeerNetwork] Failed to start pairing PIN listener:', e);
    }
  }

  public disablePairingPin() {
    if (this.pairingPeer) {
      try { this.pairingPeer.destroy(); } catch (_) {}
      this.pairingPeer = null;
    }
    this.currentPairingPin = null;
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
    if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
      try {
        this.peer.reconnect();
      } catch (err) {
        console.warn('[PeerNetwork] Reconnect attempt error:', err);
      }
    }
  }

  private handlePeerUnavailable(targetId: string, errMsg: string) {
    const pending = this.pendingConnects.get(targetId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Could not connect to peer ${targetId.replace('glueck-dev-', '').replace('glueck-', '')}: Device is offline or unreachable`));
      this.pendingConnects.delete(targetId);
    }
    const existing = this.connections.get(targetId);
    if (existing) {
      try { existing.close(); } catch (_) {}
      this.connections.delete(targetId);
    }
  }

  private setupConnection(conn: DataConnection) {
    const targetId = conn.peer;

    conn.on('open', () => {
      this.connections.set(targetId, conn);
    });

    conn.on('close', () => {
      this.connections.delete(targetId);
    });

    conn.on('error', (err) => {
      console.warn(`[PeerNetwork] Connection error with ${targetId}:`, err);
      this.connections.delete(targetId);
    });

    conn.on('data', async (payload: any) => {
      if (payload?.type === 'request' && this.activeRouteHandler) {
        try {
          const responseData = await this.activeRouteHandler(payload.route, payload.data);
          conn.send({ type: 'response', id: payload.id, data: responseData });
        } catch (error: any) {
          conn.send({ type: 'error', id: payload.id, error: error.message || 'Unknown error' });
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
          resolver.reject(new Error(payload.error || 'Remote error'));
          this.resolvers.delete(payload.id);
        }
      }
    });
  }

  /**
   * Resolves the proper PeerJS ID for a given target identifier.
   * If it's a 6-digit numeric PIN, resolves to pairing format 'glueck-{PIN}'.
   * If it's a deviceId, resolves to deterministic format 'glueck-dev-{deviceId}'.
   */
  public resolveTargetPeerId(targetIdentifier: string): string {
    const cleaned = targetIdentifier.trim();
    if (cleaned.startsWith('glueck-')) {
      return cleaned;
    }
    if (/^\d{6}$/.test(cleaned)) {
      return formatPairingPinId(cleaned);
    }
    return formatDevicePeerId(cleaned);
  }

  async fetch(targetIdentifier: string, route: string, data: any, timeoutMs = 6000): Promise<any> {
    if (!this.peer || this.peer.destroyed) {
       // Ensure local host is started
       const fallbackId = this.myDeviceId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'dev_' + Date.now());
       await this.startHost(fallbackId);
    }

    const targetId = this.resolveTargetPeerId(targetIdentifier);
    const friendlyName = targetIdentifier.replace(/^glueck-dev-|^glueck-/, '');
    
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
        const reqId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2);
        
        const timeout = setTimeout(() => {
          this.resolvers.delete(reqId);
          safeReject(new Error(`Request to ${friendlyName} timed out`));
        }, timeoutMs);

        this.resolvers.set(reqId, { resolve: safeResolve, reject: safeReject, timeout });
        
        try {
          connection.send({
            type: 'request',
            id: reqId,
            route,
            data
          });
        } catch (sendErr) {
          clearTimeout(timeout);
          this.resolvers.delete(reqId);
          this.connections.delete(targetId);
          safeReject(sendErr);
        }
      };

      const existingConn = this.connections.get(targetId);
      if (existingConn && existingConn.open) {
        doRequest(existingConn);
        return;
      }

      if (existingConn) {
        try { existingConn.close(); } catch (_) {}
        this.connections.delete(targetId);
      }

      const connectTimeout = setTimeout(() => {
        this.pendingConnects.delete(targetId);
        safeReject(new Error(`Connection to peer ${friendlyName} timed out (device may be offline)`));
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
          doRequest(conn);
        });

        conn.on('close', () => {
          this.connections.delete(targetId);
        });

        conn.on('error', (err) => {
          clearTimeout(connectTimeout);
          this.pendingConnects.delete(targetId);
          this.connections.delete(targetId);
          safeReject(err);
        });
      } catch (e) {
        clearTimeout(connectTimeout);
        this.pendingConnects.delete(targetId);
        safeReject(e);
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

    for (const [_, conn] of this.connections) {
      try { conn.close(); } catch (_) {}
    }
    this.connections.clear();

    for (const [_, res] of this.resolvers) {
      clearTimeout(res.timeout);
      res.reject(new Error('Peer network destroyed'));
    }
    this.resolvers.clear();

    for (const [_, pending] of this.pendingConnects) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Peer network destroyed'));
    }
    this.pendingConnects.clear();

    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    this.myId = null;
    this.myDeviceId = null;
  }
}

export const peerNetwork = new PeerNetwork();


