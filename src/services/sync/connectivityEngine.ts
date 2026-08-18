import { SyncConnectionState } from '../../types';

type StateListener = (state: SyncConnectionState, details?: { reason?: string; lastChecked?: number }) => void;

class ConnectivityEngine {
  private currentState: SyncConnectionState = 'OFFLINE';
  private listeners: Set<StateListener> = new Set();
  private checkInterval: any = null;
  private isChecking = false;
  private brokerConnected = false;
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
      // Periodic health check every 15 seconds
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
      console.log(`[ConnectivityEngine] Transition: ${this.currentState} -> ${newState}`);
      this.currentState = newState;
      this.notify();
    }
  }

  public setBrokerStatus(connected: boolean) {
    this.brokerConnected = connected;
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

  public setSyncError(error: string) {
    this.setState('SYNC_ERROR', error);
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.brokerConnected = false;
      this.setState('OFFLINE');
    } else {
      this.checkConnectivity();
    }
  }

  public async checkConnectivity(): Promise<SyncConnectionState> {
    if (this.isChecking) return this.currentState;
    this.isChecking = true;

    try {
      // 1. Check local interface state
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.setState('OFFLINE');
        this.isChecking = false;
        return 'OFFLINE';
      }

      // 2. Probe actual internet reachability
      const hasInternet = await this.probeInternetReachability();
      if (!hasInternet) {
        this.setState('NETWORK_CONNECTED');
        this.isChecking = false;
        return 'NETWORK_CONNECTED';
      }

      // 3. Internet is available, evaluate broker and sync readiness
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
      this.setState('INTERNET_AVAILABLE');
      return;
    }

    if (this.hasPeersReady) {
      this.setState('SYNC_READY');
      return;
    }

    this.setState('BROKER_CONNECTED');
  }

  private async probeInternetReachability(): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    try {
      // Quick fast fetch check with 3-second timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      // Probe current origin or reliable fast static asset
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
    this.listeners.clear();
  }
}

export const connectivityEngine = new ConnectivityEngine();
