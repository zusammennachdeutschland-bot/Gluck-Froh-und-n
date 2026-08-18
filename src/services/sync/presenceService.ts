import { DevicePresenceState, PairedPeer } from '../../types';
import { sendHeartbeat } from './syncClient';

type PresenceListener = (presences: Map<string, DevicePresenceState>) => void;

const HEARTBEAT_INTERVAL_MS = 12000;
const PRESENCE_EXPIRATION_MS = 28000;

class PresenceService {
  private activePresences: Map<string, DevicePresenceState> = new Map();
  private listeners: Set<PresenceListener> = new Set();
  private heartbeatTimer: any = null;
  private isRunning = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.handleUnload());
      window.addEventListener('pagehide', () => this.handleUnload());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.pulseHeartbeats();
        }
      });
    }
  }

  public start(getPeers: () => PairedPeer[]) {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run initial pulse
    this.pulse(getPeers);

    // Schedule regular heartbeat check
    this.heartbeatTimer = setInterval(() => {
      this.pulse(getPeers);
    }, HEARTBEAT_INTERVAL_MS);
  }

  public stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isRunning = false;
  }

  public subscribe(listener: PresenceListener): () => void {
    this.listeners.add(listener);
    listener(new Map(this.activePresences));
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getPresences(): Map<string, DevicePresenceState> {
    return new Map(this.activePresences);
  }

  public getDevicePresence(deviceId: string): DevicePresenceState | null {
    return this.activePresences.get(deviceId) || null;
  }

  public updatePresenceManually(deviceId: string, isOnline: boolean, latencyMs?: number) {
    const existing = this.activePresences.get(deviceId);
    if (existing) {
      existing.isOnline = isOnline;
      existing.lastHeartbeat = Date.now();
      if (typeof latencyMs === 'number') {
        existing.latencyMs = latencyMs;
      }
      this.notify();
    }
  }

  private async pulse(getPeers: () => PairedPeer[]) {
    const peers = getPeers() || [];
    const now = Date.now();

    // 1. Check existing presences for expiration
    let changed = false;
    for (const [id, state] of this.activePresences.entries()) {
      if (state.isOnline && (now - state.lastHeartbeat) > PRESENCE_EXPIRATION_MS) {
        state.isOnline = false;
        state.latencyMs = undefined;
        changed = true;
      }
    }

    // 2. Pulse heartbeats to all paired peers
    await Promise.all(peers.map(async (peer) => {
      if (!peer.deviceId && !peer.lastKnownIp) return;

      const targetIdentifier = peer.deviceId || peer.lastKnownIp;

      try {
        let result = await sendHeartbeat(targetIdentifier, peer.port || 0);

        // Fallback for legacy peers if deviceId failed
        if (!result && peer.lastKnownIp && peer.lastKnownIp !== peer.deviceId) {
          result = await sendHeartbeat(peer.lastKnownIp, peer.port || 0);
        }

        const presence = this.activePresences.get(peer.deviceId) || {
          deviceId: peer.deviceId,
          deviceName: peer.deviceName,
          isOnline: false,
          lastHeartbeat: 0,
          protocolVersion: peer.protocolVersion,
          supportedFeatures: peer.capabilities
        };

        if (result && typeof result.latencyMs === 'number') {
          presence.isOnline = true;
          presence.latencyMs = result.latencyMs;
          presence.lastHeartbeat = Date.now();
          presence.deviceName = peer.deviceName || presence.deviceName;
        } else {
          // If ping failed, mark offline
          presence.isOnline = false;
          presence.latencyMs = undefined;
        }

        this.activePresences.set(peer.deviceId, presence);
        changed = true;
      } catch {
        const presence = this.activePresences.get(peer.deviceId);
        if (presence && presence.isOnline) {
          presence.isOnline = false;
          presence.latencyMs = undefined;
          changed = true;
        }
      }
    }));

    if (changed) {
      this.notify();
    }
  }

  public pulseHeartbeats() {
    // Immediate wake up trigger
    if (this.isRunning) {
      this.notify();
    }
  }

  private handleUnload() {
    // When tab/browser closes, mark all local presence sessions as terminated
    for (const [_, state] of this.activePresences.entries()) {
      state.isOnline = false;
    }
    this.notify();
  }

  private notify() {
    const snapshot = new Map(this.activePresences);
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[PresenceService] Listener error:', err);
      }
    }
  }
}

export const presenceService = new PresenceService();
