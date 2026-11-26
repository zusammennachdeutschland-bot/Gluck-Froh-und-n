import { DevicePresenceState, PairedPeer } from '../../types';
import { sendHeartbeat } from './syncClient';
import { isLegacyLanOnlyPeer } from './syncMigration';

type PresenceListener = (presences: Map<string, DevicePresenceState>) => void;

const HEARTBEAT_INTERVAL_MS = 12000;
const PRESENCE_EXPIRATION_MS = 30000;

class PresenceService {
  private activePresences: Map<string, DevicePresenceState> = new Map();
  private listeners: Set<PresenceListener> = new Set();
  private heartbeatTimer: any = null;
  private isRunning = false;
  private currentGetPeers: (() => PairedPeer[]) | null = null;

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
    this.currentGetPeers = getPeers;
    if (this.isRunning) return;
    this.isRunning = true;

    void this.pulse(getPeers);

    this.heartbeatTimer = setInterval(() => {
      if (this.currentGetPeers) {
        void this.pulse(this.currentGetPeers);
      }
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
    if (!deviceId) return;
    const existing = this.activePresences.get(deviceId);
    if (existing) {
      existing.isOnline = isOnline;
      existing.lastHeartbeat = isOnline ? Date.now() : existing.lastHeartbeat;
      if (typeof latencyMs === 'number') {
        existing.latencyMs = latencyMs;
      } else if (!isOnline) {
        existing.latencyMs = undefined;
      }
    } else {
      this.activePresences.set(deviceId, {
        deviceId,
        deviceName: 'Companion Device',
        isOnline,
        lastHeartbeat: isOnline ? Date.now() : 0,
        latencyMs
      });
    }
    this.notify();
  }

  private async pulse(getPeers: () => PairedPeer[]) {
    const peers = getPeers() || [];
    const now = Date.now();

    let changed = false;
    for (const [, state] of this.activePresences.entries()) {
      if (state.isOnline && now - state.lastHeartbeat > PRESENCE_EXPIRATION_MS) {
        state.isOnline = false;
        state.latencyMs = undefined;
        changed = true;
      }
    }

    await Promise.all(
      peers.map(async (peer) => {
        if (!peer.deviceId || isLegacyLanOnlyPeer(peer)) {
          const offlineState: DevicePresenceState = {
            deviceId: peer.deviceId,
            deviceName: peer.deviceName,
            isOnline: false,
            lastHeartbeat: peer.lastHeartbeat || 0,
            protocolVersion: peer.protocolVersion,
            supportedFeatures: peer.capabilities
          };
          this.activePresences.set(peer.deviceId, offlineState);
          changed = true;
          return;
        }

        try {
          const result = await sendHeartbeat(peer);

          const presence: DevicePresenceState = this.activePresences.get(peer.deviceId) || {
            deviceId: peer.deviceId,
            deviceName: peer.deviceName,
            isOnline: false,
            lastHeartbeat: 0,
            protocolVersion: peer.protocolVersion,
            supportedFeatures: peer.capabilities
          };

          if (result.ok) {
            presence.isOnline = true;
            presence.latencyMs = result.latencyMs;
            presence.lastHeartbeat = Date.now();
            presence.deviceName = peer.deviceName || presence.deviceName;
          } else {
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
      })
    );

    if (changed) {
      this.notify();
    }
  }

  public pulseHeartbeats() {
    if (this.isRunning && this.currentGetPeers) {
      void this.pulse(this.currentGetPeers);
    } else if (this.isRunning) {
      this.notify();
    }
  }

  private handleUnload() {
    for (const [, state] of this.activePresences.entries()) {
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
