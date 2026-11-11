import React, { useState, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { 
  Sparkles, Plus, RefreshCw, Settings, TrendingUp, TrendingDown, 
  Calendar, Tag, Hash, FileText, Edit2, Trash2, ShieldCheck, 
  AlertCircle, CheckCircle2, Clock, Landmark, ArrowUpRight, ArrowDownRight,
  HelpCircle, Layers
} from 'lucide-react';
import { 
  GoldHolding, 
  calculateHoldingMetrics, 
  formatCairoDateTime, 
  formatRelativeTimeCairo, 
  calculateGoldPriceForPurity, 
  getFriendlyErrorMessage,
  getPurityFactor
} from '../../../services/goldPrice/goldPriceTypes';
import { goldPriceService } from '../../../services/goldPrice/goldPriceService';
import { GoldPriceChart } from './GoldPriceChart';
import { AddGoldHoldingModal } from './AddGoldHoldingModal';
import { GoldPriceSettingsModal } from './GoldPriceSettingsModal';
import { AddFinanceAccountModal } from '../modals/AddFinanceAccountModal';

export const FinanceInvestmentsView: React.FC = () => {
  const { 
    _t, 
    goldHoldings, 
    deleteGoldHolding, 
    latestGoldPrice, 
    refreshGoldPrice, 
    isRefreshingGoldPrice,
    financeAccounts 
  } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<GoldHolding | undefined>();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [refreshCooldownNotice, setRefreshCooldownNotice] = useState<string | null>(null);

  // Active holdings
  const activeHoldings = useMemo(() => {
    return (goldHoldings || []).filter(h => !(h as any).deleted);
  }, [goldHoldings]);

  // Current price per gram 24K
  const current24KPrice = latestGoldPrice?.pricePerGram24K || 0;

  // Portfolio Summary Calculations
  const summary = useMemo(() => {
    let totalWeight = 0;
    let totalInvested = 0;
    let totalCurrentValue = 0;

    activeHoldings.forEach(h => {
      totalWeight += h.weightGrams;
      totalInvested += h.purchasePrice;
      const metrics = calculateHoldingMetrics(h, current24KPrice);
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
    };
  }, [activeHoldings, current24KPrice]);

  // General Investment Accounts (non-gold)
  const investmentAccounts = useMemo(() => {
    return financeAccounts.filter(a => !a.deleted && a.type === 'investment');
  }, [financeAccounts]);

  const handleManualRefresh = async () => {
    if (isRefreshingGoldPrice) return;
    setRefreshCooldownNotice(null);
    try {
      await refreshGoldPrice(true);
    } catch {
      setRefreshCooldownNotice(_t('يرجى الانتظار بضع ثوانٍ قبل التحديث مجدداً', 'Please wait a few seconds before refreshing again', 'Bitte kurz warten'));
      setTimeout(() => setRefreshCooldownNotice(null), 3000);
    }
  };

  const isLive = latestGoldPrice?.status === 'live';
  const isCached = latestGoldPrice?.status === 'cached';
  const isError = latestGoldPrice?.status === 'error';

  return (
    <div className="space-y-3.5 animate-in fade-in pb-12">
      {/* 1. TOP LIVE PRICE BAR & CONTROLS */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Price & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black text-text-muted uppercase tracking-wider">
                  {_t('سعر جرام الذهب عيار 24', 'Gold Price 24K / Gram', 'Goldpreis 24K / Gramm')}
                </span>

                {/* Status Indicator Badge */}
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {_t('حي ومباشر', 'Live', 'Live')}
                  </span>
                )}
                {isCached && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title={_t('يعمل بدون اتصال بالإنترنت باستخدام آخر سعر محفوظ', 'Working offline with cached price', 'Offline-Preis')}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {_t('محفوظ محلياً (Offline)', 'Cached', 'Gespeichert')}
                  </span>
                )}
                {isError && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {_t('تعذر التحديث', 'Error', 'Fehler')}
                  </span>
                )}
              </div>

              {/* Price Figures */}
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-amber-500 font-sans tracking-tight">
                  {current24KPrice > 0 ? current24KPrice.toLocaleString() : '---'}
                </span>
                <span className="text-xs font-bold text-text-muted">
                  EGP / {_t('جرام', 'gram', 'g')}
                </span>
              </div>

              {/* Source & Last Updated Details */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-muted mt-1">
                <span>
                  {_t('المصدر:', 'Source:', 'Quelle:')}{' '}
                  <strong className="text-text-main font-semibold">
                    {latestGoldPrice?.source || _t('مؤشر الصاغة والسبائك', 'Sagha & Bullion Index', 'Goldindex')}
                  </strong>
                </span>
                <span>•</span>
                <span title={formatCairoDateTime(latestGoldPrice?.fetchedAt)}>
                  {_t('آخر تحديث:', 'Updated:', 'Aktualisiert:')}{' '}
                  <strong className="text-text-main font-semibold">
                    {latestGoldPrice?.fetchedAt ? formatRelativeTimeCairo(latestGoldPrice.fetchedAt, _t('ar', 'en', 'de')) : _t('غير متوفر', 'N/A', 'N/A')}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshingGoldPrice}
              className="px-2.5 py-1.5 bg-surface-hover hover:bg-surface-border text-text-main rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-surface-border cursor-pointer active:scale-95 disabled:opacity-50"
              title={_t('تحديث سعر الذهب الآن', 'Refresh Gold Price Now', 'Goldpreis aktualisieren')}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isRefreshingGoldPrice ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isRefreshingGoldPrice ? _t('جارٍ التحديث...', 'Updating...', 'Aktualisiere...') : _t('تحديث السعر', 'Refresh', 'Aktualisieren')}
              </span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text-main rounded-lg transition border border-surface-border cursor-pointer"
              title={_t('إعدادات تسعير الذهب', 'Gold Price Settings', 'Einstellungen')}
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setEditingHolding(undefined);
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{_t('إضافة حيازة ذهب', 'Add Gold', 'Gold hinzufügen')}</span>
            </button>
          </div>
        </div>

        {/* Cooldown or Error Notice */}
        {refreshCooldownNotice && (
          <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{refreshCooldownNotice}</span>
          </div>
        )}

        {latestGoldPrice?.error && latestGoldPrice.status === 'cached' && (
          <div className="mt-2.5 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{getFriendlyErrorMessage(latestGoldPrice.errorCode, _t('ar', 'en', 'de'))}</span>
          </div>
        )}
      </div>

      {/* 2. GOLD PORTFOLIO SUMMARY CARD (High-Information Density Glück Mobile UI) */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
              {_t('محفظة استثمار الذهب', 'Gold Portfolio Summary', 'Gold-Portfolio')}
            </h3>
          </div>
          <span className="text-[10px] font-bold text-text-muted">
            {summary.totalHoldingsCount} {_t('حيازات مسجلة', 'holdings', 'Positionen')}
          </span>
        </div>

        {/* Compact Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          {/* Total Weight */}
          <div className="bg-surface-hover/40 p-2.5 rounded-xl border border-surface-border/60">
            <span className="block text-[10px] font-bold text-text-muted uppercase">
              {_t('إجمالي الوزن', 'Total Weight', 'Gesamtgewicht')}
            </span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-text-main">
                {summary.totalWeight.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-text-muted">
                {_t('جرام', 'g', 'g')}
              </span>
            </div>
          </div>

          {/* Invested Cost */}
          <div className="bg-surface-hover/40 p-2.5 rounded-xl border border-surface-border/60">
            <span className="block text-[10px] font-bold text-text-muted uppercase">
              {_t('إجمالي المستثمر (التكلفة)', 'Total Invested', 'Kaufsumme')}
            </span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-text-main">
                {summary.totalInvested.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-text-muted">EGP</span>
            </div>
          </div>

          {/* Current Market Value */}
          <div className="bg-surface-hover/40 p-2.5 rounded-xl border border-surface-border/60">
            <span className="block text-[10px] font-bold text-text-muted uppercase">
              {_t('القيمة السوقية الحالية', 'Current Value', 'Aktueller Marktwert')}
            </span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-amber-500">
                {summary.totalCurrentValue.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-text-muted">EGP</span>
            </div>
          </div>

          {/* Profit / Loss & ROI */}
          <div className="bg-surface-hover/40 p-2.5 rounded-xl border border-surface-border/60">
            <span className="block text-[10px] font-bold text-text-muted uppercase">
              {_t('صافي الربح / الخسارة', 'Profit / Loss', 'Gewinn / Verlust')}
            </span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className={`text-base sm:text-lg font-black ${
                summary.totalProfitLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {summary.totalProfitLoss >= 0 ? '+' : ''}{summary.totalProfitLoss.toLocaleString()}
              </span>
              <span className={`text-[10px] font-black ${
                summary.totalRoiPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                ({summary.totalRoiPercent >= 0 ? '+' : ''}{summary.totalRoiPercent}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. LIVE KARAT PRICE MATRIX */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black text-text-main uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            {_t('أسعار الأعيرة اليوم في مصر', 'Live Egyptian Karat Rates Today', 'Preise nach Feingehalt')}
          </span>
          <span className="text-[10px] text-text-muted font-medium">
            {_t('بدون المصنعية', 'Excl. making charges', 'Ohne Aufschlag')}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          {[
            { label: 'عيار 24 (نقي)', karat: 24, factor: 1.0 },
            { label: 'عيار 22', karat: 22, factor: 22 / 24 },
            { label: 'عيار 21 (شائع)', karat: 21, factor: 21 / 24 },
            { label: 'عيار 18', karat: 18, factor: 18 / 24 },
          ].map(k => {
            const p = Math.round(current24KPrice * k.factor);
            return (
              <div key={k.karat} className="p-2 bg-surface-hover/30 rounded-lg border border-surface-border/50">
                <span className="text-[10px] font-bold text-text-muted block">{k.label}</span>
                <span className="font-black text-xs sm:text-sm text-text-main mt-0.5 block">
                  {p > 0 ? `${p.toLocaleString()} EGP` : '---'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. COMPACT HISTORICAL PRICE CHART */}
      <GoldPriceChart />

      {/* 5. GOLD HOLDINGS LIST */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-500" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
              {_t('حيازات وسبائك الذهب', 'Gold Holdings List', 'Goldpositionen')} ({activeHoldings.length})
            </h3>
          </div>
          <button
            onClick={() => {
              setEditingHolding(undefined);
              setIsAddModalOpen(true);
            }}
            className="text-[11px] font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{_t('إضافة حيازة', 'Add Holding', 'Hinzufügen')}</span>
          </button>
        </div>

        {activeHoldings.length === 0 ? (
          <div className="bg-surface border border-surface-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-text-main mb-1">
              {_t('لا توجد حيازات ذهب مسجلة', 'No Gold Holdings Yet', 'Noch keine Goldpositionen')}
            </h4>
            <p className="text-[11px] text-text-muted max-w-xs mb-3">
              {_t('سجل سبائكك أو عملاتك الذهبية لمتابعة قيمتها السوقية وأرباحها تلقائياً أولاً بأول.', 'Track your gold bullion, coins and profit over time.', 'Fügen Sie Gold hinzu.')}
            </p>
            <button
              onClick={() => {
                setEditingHolding(undefined);
                setIsAddModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {_t('إضافة أول سبيكة / حيازة', 'Add First Gold Holding', 'Erstes Gold erfassen')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeHoldings.map(holding => {
              const metrics = calculateHoldingMetrics(holding, current24KPrice);
              const isProfit = metrics.profitLoss >= 0;

              return (
                <div 
                  key={holding.id}
                  className="bg-surface border border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3 relative overflow-hidden group hover:border-amber-500/30 transition"
                >
                  {/* Holding Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/20">
                        {holding.purity}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs sm:text-sm text-text-main">
                            {holding.brand}
                          </h4>
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                            {holding.weightGrams} {_t('جرام', 'g', 'g')}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-text-muted" />
                          <span>{formatCairoDateTime(holding.purchaseDate, { showTime: false })}</span>
                          {metrics.daysHeld > 0 && (
                            <span>• {_t(`منذ ${metrics.daysHeld} يوم`, `${metrics.daysHeld}d held`, `vor ${metrics.daysHeld} T.`)}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingHolding(holding);
                          setIsAddModalOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-blue-500 hover:bg-surface-hover rounded-lg transition cursor-pointer"
                        title={_t('تعديل', 'Edit', 'Bearbeiten')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(_t('هل أنت متأكد من حذف هذه الحيازة؟', 'Are you sure you want to delete this holding?', 'Möchten Sie diese Position löschen?'))) {
                            deleteGoldHolding(holding.id);
                          }
                        }}
                        className="p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        title={_t('حذف', 'Delete', 'Löschen')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Financial Metrics Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-border text-center text-xs">
                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {_t('تكلفة الشراء', 'Cost', 'Kaufpreis')}
                      </span>
                      <span className="font-bold text-text-main mt-0.5 block">
                        {holding.purchasePrice.toLocaleString()} EGP
                      </span>
                      <span className="text-[9px] text-text-muted">
                        ({Math.round(holding.purchasePricePerGram || (holding.purchasePrice / holding.weightGrams)).toLocaleString()}/g)
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {_t('القيمة السوقية', 'Market Value', 'Marktwert')}
                      </span>
                      <span className="font-black text-amber-500 mt-0.5 block">
                        {metrics.currentValue.toLocaleString()} EGP
                      </span>
                      <span className="text-[9px] text-text-muted">
                        ({metrics.pricePerGramCurrent.toLocaleString()}/g)
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {_t('الربح / الخسارة', 'Profit/Loss', 'Gewinn')}
                      </span>
                      <span className={`font-black mt-0.5 block ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isProfit ? '+' : ''}{metrics.profitLoss.toLocaleString()} EGP
                      </span>
                      <span className={`text-[9px] font-black ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isProfit ? '+' : ''}{metrics.roiPercent}% ROI
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {_t('العائد السنوي', 'Annual Return', 'Rendite p.a.')}
                      </span>
                      <span className="font-bold text-text-main mt-0.5 block">
                        {metrics.annualizedReturn !== null ? (
                          <span className={metrics.annualizedReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                            {metrics.annualizedReturn >= 0 ? '+' : ''}{metrics.annualizedReturn}% / YR
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-muted font-normal" title={_t('يتطلب مرور 7 أيام على الأقل لحساب العائد السنوي بدقة', 'Requires at least 7 days holding period', 'Erst ab 7 Tagen verfügbar')}>
                            {_t('غير متاح بعد', 'Not available yet', 'Nicht verfügbar')}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Optional Notes */}
                  {holding.notes && (
                    <div className="pt-2 border-t border-surface-border/50 text-[11px] text-text-muted flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-text-muted shrink-0" />
                      <span className="truncate">{holding.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. TRADITIONAL INVESTMENT ACCOUNTS SECTION (If Any Exist or To Add) */}
      <div className="pt-2 border-t border-surface-border space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider">
              {_t('حسابات وشهادات الاستثمار الأخرى', 'Other Investment Accounts', 'Andere Investitionskonten')} ({investmentAccounts.length})
            </h3>
          </div>
          <button
            onClick={() => setIsAddAccountOpen(true)}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{_t('إضافة حساب استثمار', 'Add Account', 'Konto hinzufügen')}</span>
          </button>
        </div>

        {investmentAccounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {investmentAccounts.map(acc => (
              <div key={acc.id} className="bg-surface border border-surface-border rounded-xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-text-main">{acc.name}</h4>
                      <p className="text-[10px] text-text-muted">{acc.bankName || _t('حساب استثماري', 'Investment Account', 'Investitionskonto')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-text-main">{acc.currentBalance.toLocaleString()} {acc.currency}</span>
                    <span className="block text-[9px] text-emerald-500 font-bold">+{acc.annualInterestRate || 0}% / YR</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Modals */}
      {isAddModalOpen && (
        <AddGoldHoldingModal
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingHolding(undefined);
          }}
          existingHolding={editingHolding}
        />
      )}

      {isSettingsOpen && (
        <GoldPriceSettingsModal
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isAddAccountOpen && (
        <AddFinanceAccountModal
          onClose={() => setIsAddAccountOpen(false)}
          defaultType="investment"
        />
      )}
    </div>
  );
};
