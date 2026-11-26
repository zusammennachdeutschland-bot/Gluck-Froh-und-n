import PeerPkg, { type DataConnection } from 'peerjs';
import {
  DiscoveredRoomDevice,
  PresenceRoomState,
  PresenceRoomStatus
} from '../../types';
import {
  DEFAULT_ICE_SERVERS,
  PeerConstructor,
  PeerLike,
  formatDevicePeerId
} from './peerNetwork';
import { connectivityEngine } from './connectivityEngine';

const DefaultPeerCtor = (PeerPkg as any).default || PeerPkg;

let activeRoomPeerCtor: PeerConstructor = DefaultPeerCtor as unknown as PeerConstructor;

const ROOM_ANNOUNCE_INTERVAL_MS = 20000;
const ROOM_HEARTBEAT_INTERVAL_MS = 30000;
const ROOM_STALE_TIMEOUT_MS = 65000;

const FORBIDDEN_PRESENCE_KEYS = new Set([
  'records',
  'payload',
  'delta',
  'pairingToken',
  'token',
  'authToken',
  'pin',
  'pairingPin'
]);

/**
 * Pure-JS SHA-256 fallback used only if crypto.subtle is absent (e.g., insecure HTTP test context).
 */
function sha256HexFallback(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Deterministically derives an account-scoped WebRTC signalling room ID from the Firebase UID.
 */
export async function computeRoomId(accountUid: string): Promise<string> {
  const cleanUid = String(accountUid || '').trim();
  if (!cleanUid) {
    throw new Error('Authenticated account UID is required for presence room.');
  }

  let hexDigest = '';
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const encoded = new TextEncoder().encode(`glueck-presence-v1:${cleanUid}`);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    hexDigest = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    hexDigest = sha256HexFallback(`glueck-presence-v1:${cleanUid}`);
  }

  return `glueck-room-${hexDigest.slice(0, 16)}`;
}

/**
 * Strictly validates that an incoming room message is a pure presence announcement/list/heartbeat.
 * Rejects any payload containing workspace deltas, tokens, or pairing PINs.
 */
export function isValidPresenceMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return false;
  for (const key of Object.keys(msg)) {
    if (FORBIDDEN_PRESENCE_KEYS.has(key)) {
      return false;
    }
  }
  const t = msg.type;
  if (t !== 'announce' && t !== 'members' && t !== 'ping' && t !== 'pong') {
    return false;
  }
  if (t === 'announce') {
    const dev = msg.device;
    if (!dev || typeof dev !== 'object') return false;
    for (const dk of Object.keys(dev)) {
      if (FORBIDDEN_PRESENCE_KEYS.has(dk)) return false;
    }
    if (!dev.deviceId || typeof dev.deviceId !== 'string') return false;
  }
  if (t === 'members') {
    if (!Array.isArray(msg.devices)) return false;
    for (const dev of msg.devices) {
      if (!dev || typeof dev !== 'object') return false;
      for (const dk of Object.keys(dev)) {
        if (FORBIDDEN_PRESENCE_KEYS.has(dk)) return false;
      }
    }
  }
  return true;
}

export interface StartPresenceRoomOptions {
  uid: string | null | undefined;
  deviceId: string;
  deviceName: string;
  platform?: 'android' | 'web';
}

type RoomListener = (state: PresenceRoomState) => void;

class PresenceRoomService {
  private status: PresenceRoomStatus = 'idle';
  private roomId: string | null = null;
  private localIdentity: { uid: string; deviceId: string; deviceName: string; platform: 'android' | 'web' } | null = null;

  private roomPeer: PeerLike | null = null;
  private holderConnections: Map<string, DataConnection> = new Map();
  private clientConn: DataConnection | null = null;
  private membersMap: Map<string, DiscoveredRoomDevice> = new Map();

  private listeners: Set<RoomListener> = new Set();
  private heartbeatTimer: any = null;
  private announceTimer: any = null;
  private electionTimer: any = null;
  private startSeq = 0;

  // Overridable timings for fast deterministic tests
  private failoverJitterMinMs = 2000;
  private failoverJitterMaxMs = 5000;

  public __setFailoverJitterForTests(minMs: number, maxMs: number) {
    this.failoverJitterMinMs = minMs;
    this.failoverJitterMaxMs = maxMs;
  }

  public getState(): PresenceRoomState {
    return {
      status: this.status,
      roomId: this.roomId,
      devices: this.getDiscoveredDevices()
    };
  }

  public getDiscoveredDevices(): DiscoveredRoomDevice[] {
    const selfId = this.localIdentity?.deviceId;
    return Array.from(this.membersMap.values())
      .filter((d) => d.deviceId && d.deviceId !== selfId)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  public subscribe(listener: RoomListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    connectivityEngine.setDiscoveredCount(state.devices.length);
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {}
    }
  }

  public async start(options: StartPresenceRoomOptions): Promise<PresenceRoomState> {
    const uid = String(options.uid || '').trim();
    const deviceId = String(options.deviceId || '').trim();
    const deviceName = String(options.deviceName || 'My Device').trim();
    const platform: 'android' | 'web' = options.platform || 'web';

    if (!uid || !deviceId) {
      this.stop(uid ? 'idle' : 'signed_out');
      return this.getState();
    }

    if (
      this.localIdentity &&
      this.localIdentity.uid === uid &&
      this.localIdentity.deviceId === deviceId &&
      (this.status === 'hosting' || this.status === 'joined' || this.status === 'connecting')
    ) {
      if (this.localIdentity.deviceName !== deviceName) {
        this.localIdentity.deviceName = deviceName;
        this.sendAnnounceToHolder();
      }
      return this.getState();
    }

    this.stop('connecting');
    const seq = ++this.startSeq;
    const computedRoomId = await computeRoomId(uid);

    if (seq !== this.startSeq) {
      return this.getState();
    }

    this.localIdentity = { uid, deviceId, deviceName, platform };
    this.roomId = computedRoomId;
    this.status = 'connecting';
    this.notify();

    await this.claimHolderOrJoin(seq);
    return this.getState();
  }

  private async claimHolderOrJoin(seq: number): Promise<void> {
    if (seq !== this.startSeq || !this.roomId || !this.localIdentity) return;

    this.teardownPeersOnly();

    const holderAttempt = await this.tryOpenAsHolder(this.roomId, seq);
    if (seq !== this.startSeq) return;

    if (holderAttempt === 'opened') {
      this.enterHolderMode();
      return;
    }
    if (holderAttempt === 'unavailable-id') {
      await this.enterJoinerMode(seq);
    }
  }

  private tryOpenAsHolder(targetRoomId: string, seq: number): Promise<'opened' | 'unavailable-id' | 'failed'> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (val: 'opened' | 'unavailable-id' | 'failed', destroyOnFail = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (destroyOnFail && this.roomPeer === peerInstance) {
          try {
            peerInstance.destroy();
          } catch {}
          this.roomPeer = null;
        }
        resolve(val);
      };

      let peerInstance: PeerLike;
      try {
        peerInstance = new activeRoomPeerCtor(targetRoomId, {
          debug: 0,
          config: {
            iceServers: DEFAULT_ICE_SERVERS,
            sdpSemantics: 'unified-plan'
          }
        });
        this.roomPeer = peerInstance;
      } catch {
        settle('failed', true);
        return;
      }

      const timeout = setTimeout(() => {
        settle('failed', true);
      }, 4000);

      peerInstance.on('open', () => {
        if (seq !== this.startSeq) {
          settle('failed', true);
          return;
        }
        settle('opened', false);
      });

      peerInstance.on('error', (err: any) => {
        const errType = String(err?.type || '');
        if (errType === 'unavailable-id') {
          settle('unavailable-id', true);
          return;
        }
        settle('failed', true);
      });
    });
  }

  private enterHolderMode() {
    if (!this.roomPeer || !this.localIdentity) return;

    this.status = 'hosting';
    const selfRecord: DiscoveredRoomDevice = {
      deviceId: this.localIdentity.deviceId,
      deviceName: this.localIdentity.deviceName,
      permanentPeerId: formatDevicePeerId(this.localIdentity.deviceId),
      lastSeen: Date.now(),
      platform: this.localIdentity.platform
    };
    this.membersMap.set(selfRecord.deviceId, selfRecord);

    this.roomPeer.on('connection', (conn: DataConnection) => {
      this.setupHolderIncomingConnection(conn);
    });

    this.roomPeer.on('close', () => {
      if (this.status === 'hosting') {
        this.scheduleFailoverElection();
      }
    });

    this.roomPeer.on('disconnected', () => {
      if (this.roomPeer && !this.roomPeer.destroyed) {
        try {
          this.roomPeer.reconnect();
        } catch {}
      }
    });

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.pruneStaleMembers();
      this.broadcastMembersFromHolder();
    }, ROOM_HEARTBEAT_INTERVAL_MS);

    this.notify();
  }

  private setupHolderIncomingConnection(conn: DataConnection) {
    let connDeviceId: string | null = null;

    conn.on('data', (msg: any) => {
      if (!isValidPresenceMessage(msg)) {
        return;
      }
      if (msg.type === 'announce') {
        const dev = msg.device as DiscoveredRoomDevice;
        const cleanDev: DiscoveredRoomDevice = {
          deviceId: String(dev.deviceId).trim(),
          deviceName: String(dev.deviceName || 'Companion Device').trim(),
          permanentPeerId: String(dev.permanentPeerId || formatDevicePeerId(dev.deviceId)).trim(),
          lastSeen: Date.now(),
          platform: dev.platform === 'android' || dev.platform === 'web' ? dev.platform : undefined
        };
        connDeviceId = cleanDev.deviceId;
        this.holderConnections.set(connDeviceId, conn);
        this.membersMap.set(cleanDev.deviceId, cleanDev);
        this.broadcastMembersFromHolder();
        this.notify();
      } else if (msg.type === 'ping') {
        try {
          conn.send({ type: 'pong', timestamp: Date.now() });
        } catch {}
      }
    });

    conn.on('close', () => {
      if (connDeviceId) {
        this.holderConnections.delete(connDeviceId);
        if (connDeviceId !== this.localIdentity?.deviceId) {
          this.membersMap.delete(connDeviceId);
          this.broadcastMembersFromHolder();
          this.notify();
        }
      }
    });
  }

  private broadcastMembersFromHolder() {
    if (!this.localIdentity) return;
    const selfRecord: DiscoveredRoomDevice = {
      deviceId: this.localIdentity.deviceId,
      deviceName: this.localIdentity.deviceName,
      permanentPeerId: formatDevicePeerId(this.localIdentity.deviceId),
      lastSeen: Date.now(),
      platform: this.localIdentity.platform
    };
    this.membersMap.set(selfRecord.deviceId, selfRecord);

    const payload = {
      type: 'members',
      devices: Array.from(this.membersMap.values())
    };
    for (const [devId, conn] of this.holderConnections.entries()) {
      if (!conn || !(conn as any).open) {
        this.holderConnections.delete(devId);
        continue;
      }
      try {
        conn.send(payload);
      } catch {}
    }
  }

  private pruneStaleMembers() {
    const now = Date.now();
    let changed = false;
    for (const [devId, dev] of this.membersMap.entries()) {
      if (devId === this.localIdentity?.deviceId) continue;
      if (now - dev.lastSeen > ROOM_STALE_TIMEOUT_MS) {
        this.membersMap.delete(devId);
        this.holderConnections.delete(devId);
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  private async enterJoinerMode(seq: number): Promise<void> {
    if (seq !== this.startSeq || !this.roomId || !this.localIdentity) return;

    try {
      const joinerPeer = new activeRoomPeerCtor(undefined, {
        debug: 0,
        config: {
          iceServers: DEFAULT_ICE_SERVERS,
          sdpSemantics: 'unified-plan'
        }
      });
      this.roomPeer = joinerPeer;

      joinerPeer.on('open', () => {
        if (seq !== this.startSeq || !this.roomId) return;
        const conn = joinerPeer.connect(this.roomId, { reliable: true });
        this.clientConn = conn;

        conn.on('open', () => {
          if (seq !== this.startSeq) return;
          this.status = 'joined';
          this.sendAnnounceToHolder();
          this.notify();
        });

        conn.on('data', (msg: any) => {
          if (!isValidPresenceMessage(msg)) {
            return;
          }
          if (msg.type === 'members' && Array.isArray(msg.devices)) {
            const nextMap = new Map<string, DiscoveredRoomDevice>();
            for (const rawDev of msg.devices) {
              if (!rawDev?.deviceId) continue;
              nextMap.set(String(rawDev.deviceId), {
                deviceId: String(rawDev.deviceId),
                deviceName: String(rawDev.deviceName || 'Companion Device'),
                permanentPeerId: String(rawDev.permanentPeerId || formatDevicePeerId(rawDev.deviceId)),
                lastSeen: Number(rawDev.lastSeen) || Date.now(),
                platform: rawDev.platform
              });
            }
            this.membersMap = nextMap;
            this.notify();
          }
        });

        conn.on('close', () => {
          if (seq === this.startSeq && this.localIdentity) {
            this.scheduleFailoverElection();
          }
        });

        conn.on('error', () => {
          if (seq === this.startSeq && this.localIdentity) {
            this.scheduleFailoverElection();
          }
        });
      });

      joinerPeer.on('error', (err: any) => {
        const errType = String(err?.type || '');
        if (errType === 'peer-unavailable' && seq === this.startSeq) {
          this.scheduleFailoverElection();
        }
      });

      if (this.announceTimer) clearInterval(this.announceTimer);
      this.announceTimer = setInterval(() => {
        this.sendAnnounceToHolder();
      }, ROOM_ANNOUNCE_INTERVAL_MS);
    } catch {
      this.scheduleFailoverElection();
    }
  }

  private sendAnnounceToHolder() {
    if (!this.clientConn || !(this.clientConn as any).open || !this.localIdentity) return;
    try {
      this.clientConn.send({
        type: 'announce',
        device: {
          deviceId: this.localIdentity.deviceId,
          deviceName: this.localIdentity.deviceName,
          permanentPeerId: formatDevicePeerId(this.localIdentity.deviceId),
          lastSeen: Date.now(),
          platform: this.localIdentity.platform
        }
      });
    } catch {}
  }

  public scheduleFailoverElection() {
    if (!this.localIdentity || !this.roomId || this.electionTimer) return;
    const seq = this.startSeq;
    const min = this.failoverJitterMinMs;
    const max = Math.max(min, this.failoverJitterMaxMs);
    const delay = min + Math.floor(Math.random() * (max - min + 1));

    this.status = 'connecting';
    this.notify();

    this.electionTimer = setTimeout(() => {
      this.electionTimer = null;
      if (seq === this.startSeq && this.localIdentity && this.roomId) {
        void this.claimHolderOrJoin(seq);
      }
    }, delay);
  }

  private teardownPeersOnly() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.announceTimer) {
      clearInterval(this.announceTimer);
      this.announceTimer = null;
    }
    for (const [, conn] of this.holderConnections) {
      try {
        conn.close();
      } catch {}
    }
    this.holderConnections.clear();
    if (this.clientConn) {
      try {
        this.clientConn.close();
      } catch {}
      this.clientConn = null;
    }
    if (this.roomPeer) {
      try {
        this.roomPeer.destroy();
      } catch {}
      this.roomPeer = null;
    }
  }

  public stop(nextStatus: PresenceRoomStatus = 'idle') {
    this.startSeq++;
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
    this.teardownPeersOnly();
    this.membersMap.clear();
    this.localIdentity = null;
    this.roomId = null;
    this.status = nextStatus;
    this.notify();
  }
}

export const presenceRoom = new PresenceRoomService();

export function __setPresencePeerConstructorForTests(ctor: PeerConstructor | null) {
  activeRoomPeerCtor = ctor || (DefaultPeerCtor as unknown as PeerConstructor);
}

export function __resetPresenceRoomForTests() {
  presenceRoom.stop('idle');
  presenceRoom.__setFailoverJitterForTests(2000, 5000);
}
