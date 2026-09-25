import { GoldPriceProvider, GoldPriceResult, GoldPriceErrorCode } from './goldPriceTypes';
import { goldPriceStorage } from './goldPriceStorage';

const TROY_OUNCE_TO_GRAMS = 31.1034768;
const DEFAULT_TIMEOUT_MS = 6500;

/**
 * Helper to fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Helper to parse fetch errors into structured GoldPriceErrorCode
 */
function classifyError(error: any): { message: string; code: GoldPriceErrorCode } {
  if (error?.name === 'AbortError') {
    return { message: 'Connection timed out', code: 'TIMEOUT' };
  }
  if (error instanceof TypeError && error.message?.toLowerCase().includes('failed to fetch')) {
    return { message: 'Network or CORS connection error', code: 'NETWORK_ERROR' };
  }
  if (error?.status === 429) {
    return { message: 'Rate limit exceeded', code: 'RATE_LIMITED' };
  }
  return { message: error?.message || 'Unknown network error', code: 'HTTP_ERROR' };
}

/**
 * 1. Backend Proxy Provider
 * Connects to the local Express server endpoint /api/gold-price
 */
export class BackendProxyProvider implements GoldPriceProvider {
  id = 'backend_proxy';
  name = 'خادم التطبيق المحلي (Express Server Proxy)';
  description = 'استعلام محمي عبر خادم التطبيق المحلي لتفادي قيود CORS';

  async getGoldPrice(): Promise<GoldPriceResult> {
    try {
      const response = await fetchWithTimeout('/api/gold-price', {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (!data || typeof data.pricePerGram24K !== 'number' || data.pricePerGram24K <= 0) {
        return {
          pricePerGram24K: 0,
          currency: 'EGP',
          source: 'Local Server Proxy',
          fetchedAt: new Date().toISOString(),
          success: false,
          status: 'error',
          errorCode: 'INVALID_RESPONSE',
          error: 'Invalid response from backend',
          providerId: this.id,
        };
      }

      return {
        pricePerGram24K: Math.round(data.pricePerGram24K),
        currency: 'EGP',
        source: data.source || 'بورصة الذهب (مصر)',
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        success: true,
        status: 'live',
        providerId: this.id,
      };
    } catch (err: any) {
      const { message, code } = classifyError(err);
      return {
        pricePerGram24K: 0,
        currency: 'EGP',
        source: 'Local Server Proxy',
        fetchedAt: new Date().toISOString(),
        success: false,
        status: 'error',
        errorCode: code,
        error: message,
        providerId: this.id,
      };
    }
  }
}

/**
 * 2. GoldAPI Browser Provider
 * Fetches spot gold price XAU from api.gold-api.com and USD/EGP rate from open.er-api.com
 */
export class GoldApiBrowserProvider implements GoldPriceProvider {
  id = 'gold_api_direct';
  name = 'Gold-API Direct (العالمية المباشرة)';
  description = 'استعلام مباشر لسعر أونصة الذهب XAU وسعر صرف الجنيه المصري';

  async getGoldPrice(): Promise<GoldPriceResult> {
    try {
      // Parallel fetch for gold price and exchange rate
      const [goldRes, fxRes] = await Promise.all([
        fetchWithTimeout('https://api.gold-api.com/price/XAU'),
        fetchWithTimeout('https://open.er-api.com/v6/latest/USD'),
      ]);

      if (!goldRes.ok || !fxRes.ok) {
        throw new Error(`Upstream API failed: gold=${goldRes.status}, fx=${fxRes.status}`);
      }

      const goldData = await goldRes.json();
      const fxData = await fxRes.json();

      const ozPriceUsd = parseFloat(goldData?.price);
      const usdToEgp = parseFloat(fxData?.rates?.EGP);

      if (!ozPriceUsd || !usdToEgp || ozPriceUsd <= 0 || usdToEgp <= 0) {
        return {
          pricePerGram24K: 0,
          currency: 'EGP',
          source: 'Gold-API.com Direct',
          fetchedAt: new Date().toISOString(),
          success: false,
          status: 'error',
          errorCode: 'INVALID_RESPONSE',
          error: 'Malformed price data received',
          providerId: this.id,
        };
      }

      // 1 troy oz = 31.1034768 g
      const pricePerGramUsd = ozPriceUsd / TROY_OUNCE_TO_GRAMS;
      const pricePerGramEgp = Math.round(pricePerGramUsd * usdToEgp);

      return {
        pricePerGram24K: pricePerGramEgp,
        currency: 'EGP',
        source: 'Gold-API Spot & FX Rate',
        fetchedAt: new Date().toISOString(),
        success: true,
        status: 'live',
        providerId: this.id,
      };
    } catch (err: any) {
      const { message, code } = classifyError(err);
      return {
        pricePerGram24K: 0,
        currency: 'EGP',
        source: 'Gold-API.com Direct',
        fetchedAt: new Date().toISOString(),
        success: false,
        status: 'error',
        errorCode: code,
        error: message,
        providerId: this.id,
      };
    }
  }
}

/**
 * 3. Binance PAXG Direct Provider
 * PAXG is an audited 1:1 physically backed fine gold troy ounce token
 */
export class BinancePaxgBrowserProvider implements GoldPriceProvider {
  id = 'paxg_direct';
  name = 'سوق السبائك العالمية (PAXG / USD)';
  description = 'مؤشر أونصة الذهب الصافي عيار 24 من كبرى أسواق السيولة العالمية';

  async getGoldPrice(): Promise<GoldPriceResult> {
    try {
      const [goldRes, fxRes] = await Promise.all([
        fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT'),
        fetchWithTimeout('https://open.er-api.com/v6/latest/USD'),
      ]);

      if (!goldRes.ok || !fxRes.ok) {
        throw new Error(`Upstream API error`);
      }

      const goldData = await goldRes.json();
      const fxData = await fxRes.json();

      const ozPriceUsd = parseFloat(goldData?.price);
      const usdToEgp = parseFloat(fxData?.rates?.EGP);

      if (!ozPriceUsd || !usdToEgp || ozPriceUsd <= 0 || usdToEgp <= 0) {
        return {
          pricePerGram24K: 0,
          currency: 'EGP',
          source: 'PAXG Bullion Ticker',
          fetchedAt: new Date().toISOString(),
          success: false,
          status: 'error',
          errorCode: 'INVALID_RESPONSE',
          error: 'Malformed ticker data',
          providerId: this.id,
        };
      }

      const pricePerGramUsd = ozPriceUsd / TROY_OUNCE_TO_GRAMS;
      const pricePerGramEgp = Math.round(pricePerGramUsd * usdToEgp);

      return {
        pricePerGram24K: pricePerGramEgp,
        currency: 'EGP',
        source: 'Binance PAXG Fine Gold',
        fetchedAt: new Date().toISOString(),
        success: true,
        status: 'live',
        providerId: this.id,
      };
    } catch (err: any) {
      const { message, code } = classifyError(err);
      return {
        pricePerGram24K: 0,
        currency: 'EGP',
        source: 'PAXG Bullion Ticker',
        fetchedAt: new Date().toISOString(),
        success: false,
        status: 'error',
        errorCode: code,
        error: message,
        providerId: this.id,
      };
    }
  }
}

/**
 * 4. Local Cache Fallback Provider
 * Reads the last known price saved on disk/IndexedDB
 */
export class LocalCacheFallbackProvider implements GoldPriceProvider {
  id = 'local_cache';
  name = 'السعر المحلي المحفوظ (Offline Cache)';
  description = 'يعتمد على آخر سعر مؤكد تم تخزينه محلياً على الجهاز';

  async getGoldPrice(): Promise<GoldPriceResult> {
    const cached = await goldPriceStorage.getLatestPrice();
    if (cached && cached.pricePerGram24K > 0) {
      return {
        ...cached,
        status: 'cached',
        success: true,
        providerId: this.id,
      };
    }

    return {
      pricePerGram24K: 0,
      currency: 'EGP',
      source: 'Local Cache',
      fetchedAt: new Date().toISOString(),
      success: false,
      status: 'error',
      errorCode: 'NO_CACHED_PRICE',
      error: 'No valid local price available',
      providerId: this.id,
    };
  }
}

/**
 * Registry of available gold price providers
 */
export const AVAILABLE_PROVIDERS: GoldPriceProvider[] = [
  new BackendProxyProvider(),
  new GoldApiBrowserProvider(),
  new BinancePaxgBrowserProvider(),
  new LocalCacheFallbackProvider(),
];

export function getProviderById(id: string): GoldPriceProvider {
  return AVAILABLE_PROVIDERS.find(p => p.id === id) || AVAILABLE_PROVIDERS[0];
}
