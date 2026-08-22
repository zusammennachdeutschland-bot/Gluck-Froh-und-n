/**
 * Network Diagnostics & Real-Time RTT (Ping) Monitor Service
 * Optimized for React, Vite, PWA, Capacitor & Android WebView.
 * Provides high-frequency (1s) accurate round-trip time latency diagnostics
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

class NetworkMonitorService {
  private intervalId: any = null;
  private activeAbortController: AbortController | null = null;
  private listeners: Set<MetricsListener> = new Set();
  private pingHistory: number[] = [];
  private totalPingSum = 0;

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
   * Performs a single real round-trip-time latency test.
   */
  private async performPing() {
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
      this.notify();
      return;
    }

    // Abort previous in-flight request if still hanging
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
      this.activeAbortController = null;
    }

    const controller = new AbortController();
    this.activeAbortController = controller;
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, 1800);

    const startTime = performance.now();
    const cacheBuster = `_t=${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Choose ping endpoint: test health API or favicon asset
    const pingUrl = `/api/health?${cacheBuster}`;

    try {
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const rawPing = Math.round(endTime - startTime);
      // Bound minimum ping to 1ms to reflect real physical transport
      const measuredPing = Math.max(1, rawPing);

      if (response.ok || response.status === 404 || response.status === 304 || response.status < 500) {
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
          ...this.getNetworkInfo()
        };
      } else {
        throw new Error(`Ping failed with status: ${response.status}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const isOfflineNow = typeof navigator !== 'undefined' && navigator.onLine === false;

      this.metrics = {
        ...this.metrics,
        currentPing: null,
        status: isOfflineNow ? 'offline' : 'online',
        connectionQuality: isOfflineNow ? 'offline' : 'unavailable',
        failedChecks: this.metrics.failedChecks + 1,
        totalChecks: this.metrics.totalChecks + 1,
        lastCheckedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ...this.getNetworkInfo()
      };
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
      this.notify();
    }
  }

  /**
   * Start 1-second interval diagnostics measurement.
   */
  public start() {
    if (this.intervalId) return; // Already running, prevent duplicate intervals

    // Reset session metrics
    this.totalPingSum = 0;
    this.pingHistory = [];
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
      status: 'checking',
      isMeasuring: true,
      ...this.getNetworkInfo()
    };
    this.notify();

    // Run first measurement immediately
    this.performPing();

    // Schedule high-precision 1-second heartbeat
    this.intervalId = setInterval(() => {
      this.performPing();
    }, 1000);
  }

  /**
   * Immediately stops diagnostics and cleans up resources.
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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
