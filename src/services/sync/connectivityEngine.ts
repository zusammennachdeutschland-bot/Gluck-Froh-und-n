import { SyncConnectionState, P2pSyncErrorCode } from '../../types';

type ConnectionListener = (state: SyncConnectionState) => void;

export interface ConnectivityDetails {
  state: SyncConnectionState;
  brokerConnected: boolean;
  isSyncing: boolean;
  hasPeersReady: boolean;
  discoveredCount: number;
  lastBrokerErrorCode: P2pSyncErrorCode | null;
  lastErrorMessage: string | null;
  lastIceCandidateType: string | null;
}

class ConnectivityEngine {
  private currentState: SyncConnectionState = 'NETWORK_CONNECTED';
  private listeners: Set<ConnectionListener> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;

  private brokerConnected = false;
  private isSyncing = false;
  private hasPeersReady = false;
  private discoveredCount = 0;
  private lastBrokerErrorCode: P2pSyncErrorCode | null = null;
  private lastErrorMessage: string | null = null;
  private lastIceCandidateType: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.checkConnectivity();
        }
      });
    }
  }

  public init() {
    if (this.checkInterval) return;
    void this.checkConnectivity();
    if (typeof window !== 'undefined') {
      this.checkInterval = setInterval(() => {
        void this.checkConnectivity();
      }, 30000);
    }
  }

  public getState(): SyncConnectionState {
    return this.currentState;
  }

  public getLastError(): string | null {
    return this.lastErrorMessage;
  }

  public getDetails(): ConnectivityDetails {
    return {
      state: this.currentState,
      brokerConnected: this.brokerConnected,
      isSyncing: this.isSyncing,
      hasPeersReady: this.hasPeersReady,
      discoveredCount: this.discoveredCount,
      lastBrokerErrorCode: this.lastBrokerErrorCode,
      lastErrorMessage: this.lastErrorMessage,
      lastIceCandidateType: this.lastIceCandidateType
    };
  }

  public getStatusSummary(): {
    code:
      | 'offline'
      | 'connecting'
      | 'signalling_unreachable'
      | 'id_in_use'
      | 'syncing'
      | 'discovered'
      | 'ready'
      | 'error';
    label: string;
  } {
    if (this.currentState === 'OFFLINE' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      return { code: 'offline', label: 'Offline — will sync when back online' };
    }
    if (this.currentState === 'SYNCING' || this.isSyncing) {
      return { code: 'syncing', label: 'Syncing…' };
    }
    if (this.currentState === 'SYNC_ERROR') {
      return {
        code: 'error',
        label: `Error: ${this.lastErrorMessage || 'Sync failed'}`
      };
    }
    if (!this.brokerConnected) {
      if (this.lastBrokerErrorCode === 'ID_IN_USE') {
        return {
          code: 'id_in_use',
          label: 'Error: Device ID already in use on another session'
        };
      }
      if (this.lastBrokerErrorCode === 'BROKER_DOWN') {
        return { code: 'signalling_unreachable', label: 'Signalling unreachable' };
      }
      return { code: 'connecting', label: 'Connecting to signalling…' };
    }
    if (this.discoveredCount > 0 && !this.hasPeersReady) {
      return {
        code: 'discovered',
        label: `Discovered ${this.discoveredCount} device${this.discoveredCount === 1 ? '' : 's'}`
      };
    }
    return { code: 'ready', label: 'P2P ready' };
  }

  public subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.warn('[ConnectivityEngine] Listener error:', err);
      }
    }
  }

  private setState(newState: SyncConnectionState, errorMsg?: string) {
    if (errorMsg) {
      this.lastErrorMessage = errorMsg;
    } else if (newState !== 'SYNC_ERROR' && newState !== 'INTERNET_AVAILABLE') {
      this.lastErrorMessage = null;
    }

    if (this.currentState !== newState) {
      this.currentState = newState;
    }
    this.notify();
  }

  public setBrokerStatus(connected: boolean, errorCode?: P2pSyncErrorCode | null, errorMessage?: string | null) {
    this.brokerConnected = connected;
    if (connected) {
      this.lastBrokerErrorCode = null;
      this.lastErrorMessage = null;
    } else if (errorCode) {
      this.lastBrokerErrorCode = errorCode;
      if (errorMessage) {
        this.lastErrorMessage = errorMessage;
      }
    }
    this.evaluateState();
  }

  public setSyncing(syncing: boolean) {
    this.isSyncing = syncing;
    this.evaluateState();
  }

  public setPeersReady(ready: boolean) {
    this.hasPeersReady = ready;
    this.evaluateState();
  }

  public setDiscoveredCount(count: number) {
    const clean = Math.max(0, Math.floor(count || 0));
    if (this.discoveredCount !== clean) {
      this.discoveredCount = clean;
      this.notify();
    }
  }

  public setLastIceCandidateType(candidateType: string | null) {
    this.lastIceCandidateType = candidateType ? String(candidateType) : null;
  }

  public setSyncError(error: string) {
    this.setState('SYNC_ERROR', error);
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.brokerConnected = false;
      this.setState('OFFLINE');
    } else {
      void this.checkConnectivity();
    }
  }

  public async checkConnectivity(): Promise<SyncConnectionState> {
    if (this.isChecking) return this.currentState;
    this.isChecking = true;

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.setState('OFFLINE');
        return 'OFFLINE';
      }

      const hasInternet = await this.probeInternetReachability();
      if (!hasInternet) {
        this.setState('NETWORK_CONNECTED');
        return 'NETWORK_CONNECTED';
      }

      this.evaluateState(true);
      return this.currentState;
    } catch (err: any) {
      this.setState('NETWORK_CONNECTED', err?.message);
      return 'NETWORK_CONNECTED';
    } finally {
      this.isChecking = false;
    }
  }

  private evaluateState(internetConfirmed: boolean = true) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState('OFFLINE');
      return;
    }
    if (this.isSyncing) {
      this.setState('SYNCING');
      return;
    }
    if (!internetConfirmed && this.currentState === 'OFFLINE') {
      this.setState('NETWORK_CONNECTED');
      return;
    }
    if (!this.brokerConnected) {
      this.setState('INTERNET_AVAILABLE', this.lastErrorMessage || undefined);
      return;
    }
    if (this.hasPeersReady) {
      this.setState('SYNC_READY');
      return;
    }
    this.setState('BROKER_CONNECTED');
  }

  private async probeInternetReachability(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return true;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`/favicon.ico?_probe=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeout);
      return response !== null;
    } catch {
      return false;
    }
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.brokerConnected = false;
    this.isSyncing = false;
    this.hasPeersReady = false;
    this.discoveredCount = 0;
    this.lastBrokerErrorCode = null;
    this.lastErrorMessage = null;
    this.lastIceCandidateType = null;
    this.currentState = 'NETWORK_CONNECTED';
    this.listeners.clear();
  }
}

export const connectivityEngine = new ConnectivityEngine();
