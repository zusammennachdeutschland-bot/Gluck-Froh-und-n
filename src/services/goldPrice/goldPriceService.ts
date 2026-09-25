import { 
  GoldPriceResult, 
  GoldPriceSettings, 
  GoldPriceStatus,
  GoldHolding,
  calculateHoldingMetrics
} from './goldPriceTypes';
import { goldPriceStorage, GOLD_STORAGE_KEYS } from './goldPriceStorage';
import { AVAILABLE_PROVIDERS, getProviderById, LocalCacheFallbackProvider } from './goldPriceProviders';
import { storage } from '../storageService';

const MIN_REFRESH_INTERVAL_MS = 15 * 1000; // 15 seconds cooldown between manual refreshes

type PriceListener = (price: GoldPriceResult) => void;

class GoldPriceService {
  private currentPrice: GoldPriceResult | null = null;
  private settings: GoldPriceSettings | null = null;
  private isFetching: boolean = false;
  private lastFetchTime: number = 0;
  private nextAllowedFetch: number = 0;
  private timerId: any = null;
  private listeners: Set<PriceListener> = new Set();
  private initialized: boolean = false;

  constructor() {
    // Online / Offline listener
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Initializes the service, loads last known price, sets up periodic timer
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Load settings
    this.settings = await goldPriceStorage.getSettings();

    // Load last cached price immediately for instant UI
    const cached = await goldPriceStorage.getLatestPrice();
    if (cached) {
      // Mark as cached until verified live
      this.currentPrice = {
        ...cached,
        status: 'cached',
      };
      this.notifyListeners();
    }

    // Load last fetch time
    const lastTime = await storage.getItem<number>(GOLD_STORAGE_KEYS.LAST_FETCH_TIME);
    if (lastTime) {
      this.lastFetchTime = lastTime;
    }

    // Initial fetch if enabled
    if (this.settings.enabled && this.settings.autoUpdateEnabled) {
      const intervalMs = (this.settings.updateIntervalMinutes || 60) * 60 * 1000;
      const timeSinceLastFetch = Date.now() - this.lastFetchTime;

      // If never fetched or stale, fetch now
      if (!this.lastFetchTime || timeSinceLastFetch >= intervalMs) {
        this.fetchLatestPrice({ force: false }).catch(() => {});
      }
    }

    // Start auto-refresh interval check
    this.setupPeriodicTimer();
  }

  /**
   * Destroys listeners and timers
   */
  destroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.listeners.clear();
    this.initialized = false;
  }

  private handleOnline = () => {
    // When returning online, trigger a fresh fetch if price is cached
    if (this.currentPrice?.status === 'cached' || !this.currentPrice) {
      this.fetchLatestPrice({ force: true }).catch(() => {});
    }
  };

  private handleOffline = () => {
    if (this.currentPrice) {
      this.currentPrice = {
        ...this.currentPrice,
        status: 'cached',
      };
      this.notifyListeners();
    }
  };

  /**
   * Periodic timer running every 30 seconds to check if interval elapsed
   */
  private setupPeriodicTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    this.timerId = setInterval(() => {
      if (!this.settings || !this.settings.enabled || !this.settings.autoUpdateEnabled) {
        return;
      }

      const intervalMs = (this.settings.updateIntervalMinutes || 60) * 60 * 1000;
      const elapsed = Date.now() - this.lastFetchTime;

      if (elapsed >= intervalMs && !this.isFetching) {
        this.fetchLatestPrice({ force: false }).catch(err => {
          console.warn('Periodic gold price update failed:', err);
        });
      }
    }, 30 * 1000);
  }

  /**
   * Updates settings and restarts timer if needed
   */
  async updateSettings(newSettings: Partial<GoldPriceSettings>): Promise<GoldPriceSettings> {
    const current = this.settings || await goldPriceStorage.getSettings();
    this.settings = { ...current, ...newSettings };
    await goldPriceStorage.saveSettings(this.settings);
    this.setupPeriodicTimer();
    return this.settings;
  }

  async getSettings(): Promise<GoldPriceSettings> {
    if (!this.settings) {
      this.settings = await goldPriceStorage.getSettings();
    }
    return this.settings;
  }

  getCurrentPrice(): GoldPriceResult | null {
    return this.currentPrice;
  }

  subscribe(listener: PriceListener): () => void {
    this.listeners.add(listener);
    if (this.currentPrice) {
      listener(this.currentPrice);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    if (this.currentPrice) {
      this.listeners.forEach(cb => {
        try {
          cb(this.currentPrice!);
        } catch (e) {
          console.error('Error in price listener:', e);
        }
      });
    }
  }

  /**
   * Main fetch method with provider fallback and duplicate protection
   */
  async fetchLatestPrice(options?: { force?: boolean; providerId?: string }): Promise<GoldPriceResult> {
    // Duplicate fetch protection
    if (this.isFetching) {
      if (this.currentPrice) return this.currentPrice;
      // Wait for ongoing fetch
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.currentPrice) return this.currentPrice;
    }

    const now = Date.now();
    // Rate limit cooldown protection (unless forced)
    if (!options?.force && now < this.nextAllowedFetch) {
      if (this.currentPrice) return this.currentPrice;
    }

    this.isFetching = true;
    this.nextAllowedFetch = now + MIN_REFRESH_INTERVAL_MS;

    try {
      const settings = this.settings || await goldPriceStorage.getSettings();

      // If user specified manual override price in settings
      if (settings.manualOverridePrice && settings.manualOverridePrice > 0) {
        const manualResult: GoldPriceResult = {
          pricePerGram24K: settings.manualOverridePrice,
          currency: 'EGP',
          source: 'سعر مخصص (يدوي)',
          fetchedAt: new Date().toISOString(),
          success: true,
          status: 'live',
          providerId: 'manual',
        };
        this.currentPrice = manualResult;
        await goldPriceStorage.saveLatestPrice(manualResult);
        this.notifyListeners();
        return manualResult;
      }

      // Build fallback queue of providers
      const preferredId = options?.providerId || settings.preferredProviderId || 'backend_proxy';
      const fallbackId = settings.fallbackProviderId || 'gold_api_direct';

      const providerQueue: string[] = [preferredId];
      if (fallbackId && fallbackId !== preferredId) {
        providerQueue.push(fallbackId);
      }
      
      // Add other providers in order
      AVAILABLE_PROVIDERS.forEach(p => {
        if (!providerQueue.includes(p.id) && p.id !== 'local_cache') {
          providerQueue.push(p.id);
        }
      });

      let lastErrorResult: GoldPriceResult | null = null;
      let successfulResult: GoldPriceResult | null = null;

      for (const providerId of providerQueue) {
        const provider = getProviderById(providerId);
        try {
          const res = await provider.getGoldPrice();
          if (res.success && res.pricePerGram24K > 0) {
            successfulResult = {
              ...res,
              status: 'live',
            };
            break;
          } else {
            lastErrorResult = res;
          }
        } catch (e: any) {
          lastErrorResult = {
            pricePerGram24K: 0,
            currency: 'EGP',
            source: provider.name,
            fetchedAt: new Date().toISOString(),
            success: false,
            status: 'error',
            error: e?.message || 'Provider failed',
            providerId,
          };
        }
      }

      // If a provider succeeded
      if (successfulResult) {
        this.currentPrice = successfulResult;
        this.lastFetchTime = Date.now();
        await goldPriceStorage.saveLatestPrice(successfulResult);
        this.notifyListeners();
        return successfulResult;
      }

      // All live providers failed: fallback to local cache
      const cached = await new LocalCacheFallbackProvider().getGoldPrice();
      if (cached.success && cached.pricePerGram24K > 0) {
        const cachedResult: GoldPriceResult = {
          ...cached,
          status: 'cached',
          source: cached.source || 'السعر المحلي المحفوظ',
          error: lastErrorResult?.error || 'تعذر الاتصال بالمزود، تم استخدام آخر سعر محفوظ',
        };
        this.currentPrice = cachedResult;
        this.notifyListeners();
        return cachedResult;
      }

      // No cache at all
      const finalError: GoldPriceResult = {
        pricePerGram24K: 0,
        currency: 'EGP',
        source: 'Unknown',
        fetchedAt: new Date().toISOString(),
        success: false,
        status: 'error',
        errorCode: lastErrorResult?.errorCode || 'NETWORK_ERROR',
        error: lastErrorResult?.error || 'تعذر جلب سعر الذهب ولا يوجد سعر محفوظ محلياً',
      };
      this.currentPrice = finalError;
      this.notifyListeners();
      return finalError;

    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Computes portfolio totals for gold holdings
   */
  calculatePortfolioSummary(holdings: GoldHolding[]) {
    const price24K = this.currentPrice?.pricePerGram24K || 0;
    const activeHoldings = holdings.filter(h => !((h as any).deleted));

    let totalWeight = 0;
    let totalInvested = 0;
    let totalCurrentValue = 0;

    activeHoldings.forEach(h => {
      totalWeight += h.weightGrams;
      totalInvested += h.purchasePrice;
      const metrics = calculateHoldingMetrics(h, price24K);
      totalCurrentValue += metrics.currentValue;
    });

    const totalProfitLoss = Math.round((totalCurrentValue - totalInvested) * 100) / 100;
    const totalRoiPercent = totalInvested > 0
      ? Math.round(((totalCurrentValue - totalInvested) / totalInvested) * 10000) / 100
      : 0;

    return {
      totalHoldingsCount: activeHoldings.length,
      totalWeight: Math.round(totalWeight * 1000) / 1000,
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
      totalProfitLoss,
      totalRoiPercent,
      current24KPrice: price24K,
      status: this.currentPrice?.status || 'error',
      source: this.currentPrice?.source || 'غير معروف',
      lastUpdated: this.currentPrice?.fetchedAt || '',
    };
  }

  /**
   * Calculates historical price changes (1D, 7D, 30D, 1Y) from stored history
   */
  async calculateHistoricalChanges(): Promise<{
    change1D: { diff: number; percent: number } | null;
    change7D: { diff: number; percent: number } | null;
    change30D: { diff: number; percent: number } | null;
    change1Y: { diff: number; percent: number } | null;
  }> {
    const history = await goldPriceStorage.getPriceHistory();
    const current = this.currentPrice?.pricePerGram24K;

    if (!current || history.length < 2) {
      return { change1D: null, change7D: null, change30D: null, change1Y: null };
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const findClosestPrice = (targetDaysAgo: number) => {
      const targetTime = now - (targetDaysAgo * dayMs);
      // Find history entry closest to targetTime
      let closest = history[0];
      let minDiff = Math.abs(new Date(closest.fetchedAt).getTime() - targetTime);

      for (const entry of history) {
        const diff = Math.abs(new Date(entry.fetchedAt).getTime() - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = entry;
        }
      }

      // Only accept if within 50% of the target time range
      const maxTolerance = targetDaysAgo * dayMs * 0.5;
      if (minDiff > maxTolerance && history.length < 10) {
        // Fallback to earliest entry if history is short
        closest = history[0];
      }

      if (closest && closest.pricePerGram24K > 0) {
        const diff = current - closest.pricePerGram24K;
        const percent = Math.round((diff / closest.pricePerGram24K) * 10000) / 100;
        return { diff: Math.round(diff * 100) / 100, percent };
      }
      return null;
    };

    return {
      change1D: findClosestPrice(1),
      change7D: findClosestPrice(7),
      change30D: findClosestPrice(30),
      change1Y: findClosestPrice(365),
    };
  }
}

export const goldPriceService = new GoldPriceService();
