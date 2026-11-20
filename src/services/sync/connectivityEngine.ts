import { SyncConnectionState } from '../../types';
import { getLanNetworkStatus } from './lanTransport';

type StateListener = (state: SyncConnectionState, details?: { reason?: string; lastChecked?: number }) => void;

class ConnectivityEngine {
  private currentState: SyncConnectionState = 'OFFLINE';
  private listeners: Set<StateListener> = new Set();
  private checkInterval: any = null;
  private isChecking = false;
  private hostListening = false;
  private lanConnected = false;
  private isSyncing = false;
  private hasPeersReady = false;
  private lastErrorMessage: string | null = null;
  private lastCheckedTimestamp: number = Date.now();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkConnectivity();
        }
      });
    }
  }

  public init() {
    this.checkConnectivity();
    if (!this.checkInterval && typeof window !== 'undefined') {
      this.checkInterval = setInterval(() => {
        this.checkConnectivity();
      }, 15000);
    }
  }

  public getState(): SyncConnectionState {
    return this.currentState;
  }

  public getDetails(): { state: SyncConnectionState; lastChecked: number; error: string | null } {
    return {
      state: this.currentState,
      lastChecked: this.lastCheckedTimestamp,
      error: this.lastErrorMessage
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState, { lastChecked: this.lastCheckedTimestamp });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.lastCheckedTimestamp = Date.now();
    for (const listener of this.listeners) {
      try {
        listener(this.currentState, {
          reason: this.lastErrorMessage || undefined,
          lastChecked: this.lastCheckedTimestamp
        });
      } catch (err) {
        console.warn('[ConnectivityEngine] Listener error:', err);
      }
    }
  }

  private setState(newState: SyncConnectionState, errorMsg?: string) {
    if (errorMsg) {
      this.lastErrorMessage = errorMsg;
    } else if (newState !== 'SYNC_ERROR') {
      this.lastErrorMessage = null;
    }

    if (this.currentState !== newState) {
      this.currentState = newState;
      this.notify();
    }
  }

  public setHostListening(listening: boolean) {
    this.hostListening = listening;
    this.evaluateState();
  }

  /** Compatibility alias kept for callers checking host/listener status. */
  public setBrokerStatus(connected: boolean) {
    this.setHostListening(connected);
  }

  public setSyncing(syncing: boolean) {
    this.isSyncing = syncing;
    this.evaluateState();
  }

  public setPeersReady(ready: boolean) {
    this.hasPeersReady = ready;
    this.evaluateState();
  }

  public setSyncError(error: string) {
    this.setState('SYNC_ERROR', error);
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.lanConnected = false;
      this.evaluateState();
    } else {
      this.checkConnectivity();
    }
  }

  /**
   * Validates local Wi-Fi / LAN interface readiness without requiring internet access.
   */
  public async checkConnectivity(): Promise<SyncConnectionState> {
    if (this.isChecking) return this.currentState;
    this.isChecking = true;

    try {
      const netStatus = await getLanNetworkStatus();
      this.lanConnected = Boolean(netStatus.lanConnected || netStatus.wifiConnected || netStatus.localIpv4Addresses.length > 0);
      this.evaluateState();
      return this.currentState;
    } catch (err: any) {
      this.setState('NETWORK_CONNECTED', err?.message);
      return 'NETWORK_CONNECTED';
    } finally {
      this.isChecking = false;
    }
  }

  private evaluateState() {
    if (this.isSyncing) {
      this.setState('SYNCING');
      return;
    }

    if (!this.lanConnected && !this.hostListening && !this.hasPeersReady) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.setState('OFFLINE');
        return;
      }
    }

    if (this.hasPeersReady || this.hostListening) {
      this.setState('SYNC_READY');
      return;
    }

    if (this.lanConnected) {
      this.setState('NETWORK_CONNECTED');
      return;
    }

    this.setState('OFFLINE');
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.listeners.clear();
  }
}

export const connectivityEngine = new ConnectivityEngine();
