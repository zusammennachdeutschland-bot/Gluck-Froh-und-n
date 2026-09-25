export type GoldPriceStatus = 'live' | 'cached' | 'error';

export type GoldPriceErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'CORS_ERROR'
  | 'NO_CACHED_PRICE';

export interface GoldHolding {
  id: string;
  type: 'gold';
  brand: string; // e.g. BTC, Lazurde, Master Gold, SAM, Custom
  purity: string; // e.g. '24K', '22K', '21K', '18K', '14K'
  purityKarat: number; // e.g. 24, 22, 21, 18, 14
  weightGrams: number;
  purchaseDate: string; // YYYY-MM-DD or ISO string
  purchasePrice: number;
  purchasePricePerGram: number;
  currency: 'EGP';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoldPriceResult {
  pricePerGram24K: number;
  currency: 'EGP';
  source: string;
  fetchedAt: string;
  success: boolean;
  status: GoldPriceStatus;
  error?: string;
  errorCode?: GoldPriceErrorCode;
  providerId?: string;
}

export interface GoldPriceHistory {
  id: string;
  pricePerGram24K: number;
  currency: 'EGP';
  source: string;
  fetchedAt: string;
  status: 'live' | 'cached';
}

export interface GoldPriceSettings {
  enabled: boolean;
  autoUpdateEnabled: boolean;
  updateIntervalMinutes: number; // e.g. 15, 30, 60, 120, 240
  preferredProviderId: string;
  fallbackProviderId: string;
  useCachedPriceWhenOffline: boolean;
  maxCacheAgeHours: number; // e.g. 24, 48, 168
  manualOverridePrice?: number; // optional manual override
}

export interface GoldPriceProvider {
  id: string;
  name: string;
  description: string;
  getGoldPrice(): Promise<GoldPriceResult>;
}

export const DEFAULT_GOLD_PRICE_SETTINGS: GoldPriceSettings = {
  enabled: true,
  autoUpdateEnabled: true,
  updateIntervalMinutes: 60,
  preferredProviderId: 'backend_proxy',
  fallbackProviderId: 'gold_api_direct',
  useCachedPriceWhenOffline: true,
  maxCacheAgeHours: 72,
};

/**
 * Purity factor calculation:
 * 24K = 24/24 = 1.0
 * 22K = 22/24 = 0.9167
 * 21K = 21/24 = 0.875
 * 18K = 18/24 = 0.75
 * 14K = 14/24 = 0.5833
 */
export function getPurityKaratNumber(purity: string | number): number {
  if (typeof purity === 'number') {
    return Math.min(24, Math.max(1, purity));
  }
  const match = purity.toString().match(/(\d+(\.\d+)?)/);
  if (match) {
    return Math.min(24, Math.max(1, parseFloat(match[1])));
  }
  return 24;
}

export function getPurityFactor(purity: string | number): number {
  const karat = getPurityKaratNumber(purity);
  return karat / 24;
}

export function calculateGoldPriceForPurity(price24K: number, purity: string | number): number {
  const factor = getPurityFactor(purity);
  return Math.round(price24K * factor * 100) / 100;
}

/**
 * Calculates current market value, profit/loss, ROI, and annualized return
 */
export interface HoldingCalculation {
  pricePerGramCurrent: number;
  currentValue: number;
  profitLoss: number;
  roiPercent: number;
  daysHeld: number;
  annualizedReturn: number | null; // null if daysHeld < 7 or invalid
}

export function calculateHoldingMetrics(
  holding: GoldHolding,
  current24KPrice: number
): HoldingCalculation {
  const factor = getPurityFactor(holding.purity);
  const pricePerGramCurrent = Math.round(current24KPrice * factor * 100) / 100;
  const calculatedMarketValue = Math.round(holding.weightGrams * pricePerGramCurrent * 100) / 100;
  // If market price is loaded (> 0), use calculated value; otherwise fallback to purchasePrice so gold is always counted in totals
  const currentValue = calculatedMarketValue > 0 ? calculatedMarketValue : (holding.purchasePrice || 0);
  const profitLoss = calculatedMarketValue > 0 ? Math.round((currentValue - holding.purchasePrice) * 100) / 100 : 0;
  const roiPercent = calculatedMarketValue > 0 && holding.purchasePrice > 0
    ? Math.round(((currentValue - holding.purchasePrice) / holding.purchasePrice) * 10000) / 100
    : 0;

  // Days held calculation
  let daysHeld = 0;
  if (holding.purchaseDate) {
    const pDate = new Date(holding.purchaseDate).getTime();
    const now = Date.now();
    daysHeld = Math.max(0, Math.floor((now - pDate) / (1000 * 60 * 60 * 24)));
  }

  // Annualized return: ((currentValue / purchasePrice) ^ (365 / daysHeld) - 1) * 100
  let annualizedReturn: number | null = null;
  if (daysHeld >= 7 && holding.purchasePrice > 0 && currentValue > 0) {
    try {
      const ratio = currentValue / holding.purchasePrice;
      const power = 365 / daysHeld;
      const annualized = (Math.pow(ratio, power) - 1) * 100;
      if (!isNaN(annualized) && isFinite(annualized) && annualized > -100 && annualized < 10000) {
        annualizedReturn = Math.round(annualized * 100) / 100;
      }
    } catch {
      annualizedReturn = null;
    }
  }

  return {
    pricePerGramCurrent,
    currentValue,
    profitLoss,
    roiPercent,
    daysHeld,
    annualizedReturn,
  };
}

/**
 * Formats timestamps in Africa/Cairo timezone
 */
export function formatCairoDateTime(
  dateInput?: string | number | Date,
  options?: { showTime?: boolean; language?: string }
): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const lang = options?.language || 'ar-EG';
  const showTime = options?.showTime !== false;

  try {
    const formatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : lang === 'de' ? 'de-DE' : 'en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: showTime ? '2-digit' : undefined,
      minute: showTime ? '2-digit' : undefined,
    });
    return formatter.format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Relative time description (e.g. "منذ 5 دقائق" / "5 minutes ago")
 */
export function formatRelativeTimeCairo(dateInput: string | number | Date, language: string = 'ar'): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 60) {
    return language === 'ar' ? 'الآن' : language === 'de' ? 'Gerade eben' : 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    if (language === 'ar') return `منذ ${diffMin} دقيقة`;
    if (language === 'de') return `vor ${diffMin} Min.`;
    return `${diffMin} min ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    if (language === 'ar') return `منذ ${diffHours} ساعة`;
    if (language === 'de') return `vor ${diffHours} Std.`;
    return `${diffHours} hr ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return language === 'ar' ? 'أمس' : language === 'de' ? 'Gestern' : 'Yesterday';
  }
  if (language === 'ar') return `منذ ${diffDays} أيام`;
  if (language === 'de') return `vor ${diffDays} Tagen`;
  return `${diffDays} days ago`;
}

/**
 * Friendly error messages
 */
export function getFriendlyErrorMessage(
  code?: GoldPriceErrorCode | string,
  language: string = 'ar'
): string {
  switch (code) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return language === 'ar'
        ? 'تعذر الاتصال بمزود السعر، تم استخدام آخر سعر محفوظ.'
        : language === 'de'
        ? 'Netzwerkfehler: Letzter gespeicherter Goldpreis wird verwendet.'
        : 'Network error: showing the last saved price.';
    case 'HTTP_ERROR':
    case 'PROVIDER_UNAVAILABLE':
      return language === 'ar'
        ? 'مزود الأسعار غير متاح مؤقتاً، جارٍ الاعتماد على السعر المخزن.'
        : language === 'de'
        ? 'Preisanbieter vorübergehend nicht erreichbar. Gespeicherter Preis aktiv.'
        : 'Price provider temporarily unavailable. Using stored price.';
    case 'RATE_LIMITED':
      return language === 'ar'
        ? 'تم تجاوز حد الطلبات مؤقتاً، يرجى الانتظار قليلاً.'
        : language === 'de'
        ? 'Ratenbegrenzung erreicht. Bitte kurz warten.'
        : 'Rate limit reached, please wait a moment.';
    case 'CORS_ERROR':
      return language === 'ar'
        ? 'حظر اتصال مباشر، تم التبديل إلى المزود البديل أو السعر المحفوظ.'
        : language === 'de'
        ? 'Verbindung eingeschränkt, Ersatzanbieter verwendet.'
        : 'Direct connection blocked, switched to fallback provider.';
    case 'NO_CACHED_PRICE':
      return language === 'ar'
        ? 'لا يوجد سعر محلي محفوظ حتى الآن، يرجى الضغط على تحديث عند توفر الاتصال.'
        : language === 'de'
        ? 'Kein gespeicherter Preis vorhanden. Bitte aktualisieren.'
        : 'No stored price available yet. Please refresh when online.';
    default:
      return language === 'ar'
        ? 'تعذر تحديث سعر الذهب حالياً، يتم عرض آخر سعر متاح.'
        : language === 'de'
        ? 'Goldpreis konnte nicht aktualisiert werden. Letzter Preis wird angezeigt.'
        : 'Gold price could not be updated. Showing the last saved price.';
  }
}
