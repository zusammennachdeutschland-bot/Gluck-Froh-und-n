import { storage } from '../storageService';
import { 
  GoldPriceResult, 
  GoldPriceHistory, 
  GoldPriceSettings, 
  DEFAULT_GOLD_PRICE_SETTINGS,
  GoldHolding 
} from './goldPriceTypes';

export const GOLD_STORAGE_KEYS = {
  LATEST_PRICE: 'gluck_gold_latest_price',
  PRICE_HISTORY: 'gluck_gold_price_history',
  SETTINGS: 'gluck_gold_settings',
  HOLDINGS: 'gluck_gold_holdings',
  LAST_FETCH_TIME: 'gluck_gold_last_fetch_time',
};

export const goldPriceStorage = {
  /**
   * Retrieves the latest stored gold price result
   */
  async getLatestPrice(): Promise<GoldPriceResult | null> {
    try {
      const data = await storage.getItem<GoldPriceResult>(GOLD_STORAGE_KEYS.LATEST_PRICE);
      if (data && data.pricePerGram24K && data.pricePerGram24K > 0) {
        return data;
      }
      return null;
    } catch (e) {
      console.warn('Failed to load latest gold price from storage:', e);
      return null;
    }
  },

  /**
   * Saves the latest successful or cached gold price
   */
  async saveLatestPrice(price: GoldPriceResult): Promise<void> {
    try {
      await storage.setItem(GOLD_STORAGE_KEYS.LATEST_PRICE, price);
      await storage.setItem(GOLD_STORAGE_KEYS.LAST_FETCH_TIME, Date.now());
      
      // If valid, also append to history if changed or sufficient time has elapsed
      if (price.success && price.pricePerGram24K > 0) {
        await this.recordPriceHistory({
          pricePerGram24K: price.pricePerGram24K,
          currency: price.currency,
          source: price.source,
          fetchedAt: price.fetchedAt,
          status: price.status,
        });
      }
    } catch (e) {
      console.warn('Failed to save latest gold price to storage:', e);
    }
  },

  /**
   * Gets historical price records sorted chronologically
   */
  async getPriceHistory(): Promise<GoldPriceHistory[]> {
    try {
      const history = await storage.getItem<GoldPriceHistory[]>(GOLD_STORAGE_KEYS.PRICE_HISTORY);
      if (Array.isArray(history)) {
        return history.sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime());
      }
      return [];
    } catch (e) {
      console.warn('Failed to load gold price history:', e);
      return [];
    }
  },

  /**
   * Records a price to history, preventing duplicate spam
   */
  async recordPriceHistory(entry: Omit<GoldPriceHistory, 'id'>): Promise<GoldPriceHistory[]> {
    try {
      const history = await this.getPriceHistory();
      const lastEntry = history[history.length - 1];

      // Check if duplicate: same price within 60 minutes
      if (lastEntry) {
        const lastTime = new Date(lastEntry.fetchedAt).getTime();
        const newTime = new Date(entry.fetchedAt).getTime();
        const diffMinutes = Math.abs(newTime - lastTime) / (1000 * 60);

        if (lastEntry.pricePerGram24K === entry.pricePerGram24K && diffMinutes < 60) {
          // Skip recording redundant identical price
          return history;
        }
      }

      const newRecord: GoldPriceHistory = {
        id: `gph_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...entry,
      };

      const updatedHistory = [...history, newRecord];
      
      // Limit history to 500 records to keep local storage lightweight
      const trimmedHistory = updatedHistory.slice(-500);
      await storage.setItem(GOLD_STORAGE_KEYS.PRICE_HISTORY, trimmedHistory);
      return trimmedHistory;
    } catch (e) {
      console.warn('Failed to record gold price history:', e);
      return [];
    }
  },

  /**
   * Gets gold settings with defaults
   */
  async getSettings(): Promise<GoldPriceSettings> {
    try {
      const saved = await storage.getItem<GoldPriceSettings>(GOLD_STORAGE_KEYS.SETTINGS);
      if (saved) {
        return { ...DEFAULT_GOLD_PRICE_SETTINGS, ...saved };
      }
      return DEFAULT_GOLD_PRICE_SETTINGS;
    } catch (e) {
      console.warn('Failed to load gold settings:', e);
      return DEFAULT_GOLD_PRICE_SETTINGS;
    }
  },

  /**
   * Saves gold settings
   */
  async saveSettings(settings: GoldPriceSettings): Promise<void> {
    try {
      await storage.setItem(GOLD_STORAGE_KEYS.SETTINGS, settings);
    } catch (e) {
      console.warn('Failed to save gold settings:', e);
    }
  },

  /**
   * Gets gold holdings
   */
  async getHoldings(): Promise<GoldHolding[]> {
    try {
      const holdings = await storage.getItem<GoldHolding[]>(GOLD_STORAGE_KEYS.HOLDINGS);
      if (Array.isArray(holdings)) {
        return holdings;
      }
      return [];
    } catch (e) {
      console.warn('Failed to load gold holdings:', e);
      return [];
    }
  },

  /**
   * Saves gold holdings
   */
  async saveHoldings(holdings: GoldHolding[]): Promise<void> {
    try {
      await storage.setItem(GOLD_STORAGE_KEYS.HOLDINGS, holdings);
    } catch (e) {
      console.warn('Failed to save gold holdings:', e);
    }
  },
};
