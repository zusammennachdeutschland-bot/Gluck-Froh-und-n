/**
 * Network Diagnostics & Real-Time RTT (Ping) Monitor Service
 * Optimized for React, Vite, PWA, Electron (Linux/Mac/Windows), Capacitor & Android WebView.
 * Provides high-frequency (~1s) accurate round-trip time latency diagnostics
 * without causing full-app re-renders, IndexedDB churn, or memory leaks.
 */

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline' | 'unavailable';

export interface NetworkMetrics {
  currentPing: number | null; // Latency in ms (e.g. 42)
  averagePing: number | null;
  minPing: number | null;
  maxPing: number | null;
  successfulChecks: number;
  failedChecks: number;
  totalChecks: number;
  connectionQuality: ConnectionQuality;
  lastCheckedAt: string | null;
  status: 'online' | 'offline' | 'checking';
  isMeasuring: boolean;
  effectiveType?: string; // e.g. "4G", "3G", "WiFi"
  downlink?: number; // Mbps
  rttEstimated?: number;
}

type MetricsListener = (metrics: NetworkMetrics) => void;

// High-speed, high-availability Anycast endpoints designed specifically for network latency checks
// Mode: 'no-cors' allows opaque responses across any protocol (http, https, file:// in Linux Electron, capacitor://)
const GLOBAL_PING_ENDPOINTS = [
  'https://www.gstatic.com/generate_204',
  'https://connectivitycheck.gstatic.com/generate_204',
  'https://1.1.1.1/cdn-cgi/trace',
  'https://dns.google/resolve?name=example.com&type=A'
];

class NetworkMonitorService {
  private timerId: any = null;
  private activeAbortController: AbortController | null = null;
  private listeners: Set<MetricsListener> = new Set();
  private totalPingSum = 0;
  private isRunning = false;
  private isPinging = false;
  private endpointIndex = 0;

  private metrics: NetworkMetrics = {
    currentPing: null,
    averagePing: null,
    minPing: null,
    maxPing: null,
    successfulChecks: 0,
    failedChecks: 0,
    totalChecks: 0,
    connectionQuality: 'unavailable',
    lastCheckedAt: null,
    status: 'checking',
    isMeasuring: false
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.metrics.status = 'online';
        if (this.isRunning) {
          this.performPing();
        } else {
          this.notify();
        }
      });
      window.addEventListener('offline', () => {
        this.metrics.status = 'offline';
        this.metrics.connectionQuality = 'offline';
        this.metrics.currentPing = null;
        this.notify();
      });
    }
  }

  /**
   * Returns a snapshot of current in-memory diagnostics metrics.
   */
  public getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to real-time metrics updates.
   */
  public subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    listener(this.getMetrics());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = this.getMetrics();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[NetworkMonitor] Listener error:', err);
      }
    });
  }

  /**
   * Read additional NetworkInformation API properties if supported.
   */
  private getNetworkInfo(): { effectiveType?: string; downlink?: number; rttEstimated?: number } {
    if (typeof navigator === 'undefined') return {};
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!conn) return {};
    return {
      effectiveType: conn.effectiveType ? String(conn.effectiveType).toUpperCase() : undefined,
      downlink: typeof conn.downlink === 'number' ? conn.downlink : undefined,
      rttEstimated: typeof conn.rtt === 'number' ? conn.rtt : undefined
    };
  }

  /**
   * Determine quality tier based on latency thresholds:
   * < 50 ms       Excellent
   * 50–100 ms     Good
   * 100–200 ms    Fair
   * > 200 ms      Poor
   */
  private computeQuality(ping: number | null, isOffline: boolean): ConnectionQuality {
    if (isOffline) return 'offline';
    if (ping === null) return 'unavailable';
    if (ping < 50) return 'excellent';
    if (ping <= 100) return 'good';
    if (ping <= 200) return 'fair';
    return 'poor';
  }

  /**
   * Selects candidate endpoints appropriate for current runtime environment.
   * On Linux Electron or file:// protocol, avoid relative paths like /api/health which resolve
   * to non-existent Linux root filesystem files (file:///api/health).
   */
  private getCandidateEndpoints(): string[] {
    const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
    const isHttpProtocol = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');

    const endpoints = [...GLOBAL_PING_ENDPOINTS];

    // If served via HTTP/HTTPS (e.g. web dev/prod server), include local health check as a secondary fallback
    if (isHttpProtocol && !isFileProtocol) {
      endpoints.push(`${window.location.origin}/api/health`);
    }

    return endpoints;
  }

  /**
   * Performs a single real round-trip-time latency test.
   */
  public async performPing() {
    if (this.isPinging) return;
    this.isPinging = true;

    // 1. Check browser-level offline status
    const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isBrowserOffline) {
      this.metrics = {
        ...this.metrics,
        currentPing: null,
        status: 'offline',
        connectionQuality: 'offline',
        failedChecks: this.metrics.failedChecks + 1,
        totalChecks: this.metrics.totalChecks + 1,
        lastCheckedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ...this.getNetworkInfo()
      };
      this.isPinging = false;
      this.notify();
      return;
    }

    const controller = new AbortController();
    this.activeAbortController = controller;

    // Generous 3000ms timeout so slower 3G/4G connections (e.g. 0.35 Mbps) don't get killed prematurely
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, 3000);

    const endpoints = this.getCandidateEndpoints();
    const primaryEndpoint = endpoints[this.endpointIndex % endpoints.length];
    const cacheBuster = `_t=${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTime = performance.now();

    let success = false;
    let measuredPing: number | null = null;

    try {
      const pingUrl = primaryEndpoint.includes('?') 
        ? `${primaryEndpoint}&${cacheBuster}` 
        : `${primaryEndpoint}?${cacheBuster}`;

      // In Linux Electron (file://) or standard web, mode: 'no-cors' succeeds without CORS restrictions
      const response = await fetch(pingUrl, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const rawPing = Math.round(endTime - startTime);

      // In no-cors mode, opaque responses (type === 'opaque' with status 0) mean the request successfully completed!
      if (
        response.type === 'opaque' ||
        response.status === 204 ||
        response.ok ||
        (response.status >= 200 && response.status < 500)
      ) {
        measuredPing = Math.max(1, rawPing);
        success = true;
      }
    } catch {
      // Primary candidate failed or timed out; try immediate fallback from the candidate pool
      if (!controller.signal.aborted) {
        this.endpointIndex = (this.endpointIndex + 1) % endpoints.length;
        const fallbackEndpoint = endpoints[this.endpointIndex];
        const fbUrl = fallbackEndpoint.includes('?') ? `${fallbackEndpoint}&${cacheBuster}` : `${fallbackEndpoint}?${cacheBuster}`;
        const fbStartTime = performance.now();

        try {
          const fbResponse = await fetch(fbUrl, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const fbEndTime = performance.now();
          const fbRawPing = Math.round(fbEndTime - fbStartTime);

          if (
            fbResponse.type === 'opaque' ||
            fbResponse.status === 204 ||
            fbResponse.ok ||
            (fbResponse.status >= 200 && fbResponse.status < 500)
          ) {
            measuredPing = Math.max(1, fbRawPing);
            success = true;
          }
        } catch {
          // Secondary attempt also failed
        }
      }
    } finally {
      clearTimeout(timeoutId);
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }

    // Fallback: If HTTP probes were blocked by a strict local firewall, but the browser has an estimated RTT
    const networkInfo = this.getNetworkInfo();
    if (!success && typeof networkInfo.rttEstimated === 'number' && networkInfo.rttEstimated > 0 && !isBrowserOffline) {
      measuredPing = Math.round(networkInfo.rttEstimated);
      success = true;
    }

    if (success && measuredPing !== null) {
      this.totalPingSum += measuredPing;
      const newSuccessCount = this.metrics.successfulChecks + 1;
      const newAverage = Math.round(this.totalPingSum / newSuccessCount);
      const newMin = this.metrics.minPing === null ? measuredPing : Math.min(this.metrics.minPing, measuredPing);
      const newMax = this.metrics.maxPing === null ? measuredPing : Math.max(this.metrics.maxPing, measuredPing);

      this.metrics = {
        ...this.metrics,
        currentPing: measuredPing,
        averagePing: newAverage,
        minPing: newMin,
        maxPing: newMax,
        successfulChecks: newSuccessCount,
        totalChecks: this.metrics.totalChecks + 1,
        status: 'online',
        connectionQuality: this.computeQuality(measuredPing, false),
        lastCheckedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ...networkInfo
      };
    } else {
      this.endpointIndex = (this.endpointIndex + 1) % endpoints.length;
      const isOfflineNow = typeof navigator !== 'undefined' && navigator.onLine === false;

      this.metrics = {
        ...this.metrics,
        currentPing: null,
        status: isOfflineNow ? 'offline' : 'online',
        connectionQuality: isOfflineNow ? 'offline' : 'unavailable',
        failedChecks: this.metrics.failedChecks + 1,
        totalChecks: this.metrics.totalChecks + 1,
        lastCheckedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ...networkInfo
      };
    }

    this.isPinging = false;
    this.notify();
  }

  /**
   * Run a single measurement cycle and self-schedule next probe with ~1s delay.
   * This eliminates the race condition where rigid setInterval aborts in-flight pings on slower networks.
   */
  private async runPingCycle() {
    if (!this.isRunning) return;
    await this.performPing();
    if (!this.isRunning) return;

    this.timerId = setTimeout(() => {
      this.runPingCycle();
    }, 1000);
  }

  /**
   * Start diagnostics measurement cycle.
   */
  public start() {
    if (this.isRunning) return; // Already running
    this.isRunning = true;

    // Reset session metrics
    this.totalPingSum = 0;
    this.metrics = {
      currentPing: null,
      averagePing: null,
      minPing: null,
      maxPing: null,
      successfulChecks: 0,
      failedChecks: 0,
      totalChecks: 0,
      connectionQuality: 'unavailable',
      lastCheckedAt: null,
      status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'checking',
      isMeasuring: true,
      ...this.getNetworkInfo()
    };
    this.notify();

    // Start self-scheduling loop
    this.runPingCycle();
  }

  /**
   * Triggers an immediate ping test on demand.
   */
  public async pingNow() {
    if (this.isPinging) return;
    await this.performPing();
  }

  /**
   * Immediately stops diagnostics and cleans up resources.
   */
  public stop() {
    this.isRunning = false;
    this.isPinging = false;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
      this.activeAbortController = null;
    }

    this.metrics = {
      ...this.metrics,
      isMeasuring: false
    };
    this.notify();
  }
}

export const networkMonitorService = new NetworkMonitorService();

