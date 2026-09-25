import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Settings, RefreshCw, Check, ShieldCheck, Clock, Zap, Database, Server } from 'lucide-react';
import { AVAILABLE_PROVIDERS } from '../../../services/goldPrice/goldPriceProviders';
import { GoldPriceSettings } from '../../../services/goldPrice/goldPriceTypes';

interface GoldPriceSettingsModalProps {
  onClose: () => void;
}

export const GoldPriceSettingsModal: React.FC<GoldPriceSettingsModalProps> = ({ onClose }) => {
  const { _t, goldPriceSettings, updateGoldPriceSettings, refreshGoldPrice, isRefreshingGoldPrice, latestGoldPrice } = useApp();

  const [enabled, setEnabled] = useState(goldPriceSettings.enabled);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(goldPriceSettings.autoUpdateEnabled);
  const [updateIntervalMinutes, setUpdateIntervalMinutes] = useState(goldPriceSettings.updateIntervalMinutes || 60);
  const [preferredProviderId, setPreferredProviderId] = useState(goldPriceSettings.preferredProviderId || 'backend_proxy');
  const [fallbackProviderId, setFallbackProviderId] = useState(goldPriceSettings.fallbackProviderId || 'gold_api_direct');
  const [useCachedPriceWhenOffline, setUseCachedPriceWhenOffline] = useState(goldPriceSettings.useCachedPriceWhenOffline ?? true);
  const [maxCacheAgeHours, setMaxCacheAgeHours] = useState(goldPriceSettings.maxCacheAgeHours || 72);
  const [manualOverridePrice, setManualOverridePrice] = useState(goldPriceSettings.manualOverridePrice?.toString() || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const manualVal = parseFloat(manualOverridePrice);

    await updateGoldPriceSettings({
      enabled,
      autoUpdateEnabled,
      updateIntervalMinutes: Number(updateIntervalMinutes),
      preferredProviderId,
      fallbackProviderId,
      useCachedPriceWhenOffline,
      maxCacheAgeHours: Number(maxCacheAgeHours),
      manualOverridePrice: !isNaN(manualVal) && manualVal > 0 ? manualVal : undefined,
    });

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleManualTestRefresh = async () => {
    await refreshGoldPrice(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-text-main">
                {_t('إعدادات تسعير الذهب', 'Gold Price Settings', 'Goldpreis-Einstellungen')}
              </h3>
              <p className="text-[11px] text-text-muted">
                {_t('تكوين مصادر الأسعار والتحديث التلقائي والعمل غير المتصل', 'Configure price sources & auto-updates', 'Konfiguration der Preisquellen')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1. Master Toggles */}
          <div className="space-y-2.5 bg-surface-hover/40 p-3 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-text-main block">
                  {_t('تفعيل تتبع أسعار الذهب', 'Enable Gold Price Tracking', 'Goldpreis-Tracking aktivieren')}
                </span>
                <span className="text-[10px] text-text-muted">
                  {_t('عرض أسعار الذهب وحساب أرباح المحفظة', 'Show prices and portfolio metrics', 'Goldpreise & Portfolio berechnen')}
                </span>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-surface-border">
              <div>
                <span className="font-bold text-text-main block">
                  {_t('التحديث التلقائي الدوري', 'Periodic Auto-Update', 'Automatische Aktualisierung')}
                </span>
                <span className="text-[10px] text-text-muted">
                  {_t('تحديث السعر أثناء استخدام التطبيق في الخلفية', 'Refresh price periodically in background', 'Hintergrundaktualisierung')}
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoUpdateEnabled}
                onChange={e => setAutoUpdateEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-surface-border">
              <div>
                <span className="font-bold text-text-main block">
                  {_t('استخدام السعر المحفوظ عند انقطاع الإنترنت', 'Use Cached Price Offline', 'Offline-Cache nutzen')}
                </span>
                <span className="text-[10px] text-text-muted">
                  {_t('عدم إيقاف التطبيق واستخدام آخر سعر معتمد', 'Never block UI, show cached indicator', 'Letzten Preis offline anzeigen')}
                </span>
              </div>
              <input
                type="checkbox"
                checked={useCachedPriceWhenOffline}
                onChange={e => setUseCachedPriceWhenOffline(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* 2. Update Interval */}
          <div className="space-y-1.5">
            <label className="font-bold text-text-main flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
              {_t('معدل تكرار التحديث التلقائي', 'Update Interval', 'Aktualisierungsintervall')}
            </label>
            <select
              value={updateIntervalMinutes}
              onChange={e => setUpdateIntervalMinutes(Number(e.target.value))}
              disabled={!autoUpdateEnabled}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 outline-none disabled:opacity-50"
            >
              <option value={15}>15 {_t('دقيقة', 'Minutes', 'Minuten')}</option>
              <option value={30}>30 {_t('دقيقة', 'Minutes', 'Minuten')}</option>
              <option value={60}>60 {_t('دقيقة (الموصى به)', 'Minutes (Default)', 'Minuten (Standard)')}</option>
              <option value={120}>120 {_t('دقيقة (ساعتان)', 'Minutes (2 Hours)', 'Minuten')}</option>
              <option value={240}>240 {_t('دقيقة (4 ساعات)', 'Minutes (4 Hours)', 'Minuten')}</option>
            </select>
          </div>

          {/* 3. Provider Architecture */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-text-main flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-primary" />
                {_t('المزود الأساسي المفضل', 'Preferred Provider', 'Bevorzugter Anbieter')}
              </label>
              <select
                value={preferredProviderId}
                onChange={e => setPreferredProviderId(e.target.value)}
                className="w-full px-2.5 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 outline-none"
              >
                {AVAILABLE_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-text-main flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                {_t('المزود البديل (Fallback)', 'Fallback Provider', 'Ersatz-Anbieter')}
              </label>
              <select
                value={fallbackProviderId}
                onChange={e => setFallbackProviderId(e.target.value)}
                className="w-full px-2.5 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 outline-none"
              >
                {AVAILABLE_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Max Cache Age */}
          <div className="space-y-1.5">
            <label className="font-bold text-text-main flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-text-muted" />
              {_t('الحد الأقصى لعمر السعر المحفوظ (بالساعات)', 'Max Cache Age (Hours)', 'Max. Cache-Alter')}
            </label>
            <select
              value={maxCacheAgeHours}
              onChange={e => setMaxCacheAgeHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 outline-none"
            >
              <option value={24}>24 {_t('ساعة (يوم)', 'Hours (1 day)', 'Stunden')}</option>
              <option value={48}>48 {_t('ساعة (يومان)', 'Hours (2 days)', 'Stunden')}</option>
              <option value={72}>72 {_t('ساعة (3 أيام)', 'Hours (3 days)', 'Stunden')}</option>
              <option value={168}>168 {_t('ساعة (أسبوع كامل)', 'Hours (1 week)', 'Stunden')}</option>
            </select>
          </div>

          {/* 5. Manual Price Override */}
          <div className="space-y-1.5 pt-1">
            <label className="font-bold text-text-main flex items-center justify-between">
              <span>{_t('تحديد سعر يدوي مخصص (اختياري)', 'Manual Price Override (Optional)', 'Manueller Preis')}</span>
              {manualOverridePrice && (
                <button
                  type="button"
                  onClick={() => setManualOverridePrice('')}
                  className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                >
                  {_t('إلغاء التحديد اليدوي', 'Clear', 'Löschen')}
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={manualOverridePrice}
                onChange={e => setManualOverridePrice(e.target.value)}
                placeholder={_t('اتركه فارغاً للاعتماد على المزود الحي التلقائي...', 'Leave empty for live auto price...', 'Leer lassen für Live-Preis')}
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 outline-none"
              />
              <span className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted pointer-events-none">
                EGP / 24K
              </span>
            </div>
            <p className="text-[10px] text-text-muted">
              {_t('إذا أدخلت رقماً هنا، سيستخدم التطبيق هذا السعر المحدد لجميع الحسابات بدلاً من استعلام الإنترنت.', 'If set, this static price will override provider fetches.', 'Manueller Festpreis.')}
            </p>
          </div>

          {/* 6. Test & Status Bar */}
          <div className="p-3 bg-surface-hover/30 rounded-xl border border-surface-border flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-text-main block">
                {_t('السعر الحالي المعتمد:', 'Current active price:', 'Aktueller Preis:')}{' '}
                <span className="text-amber-500 font-black">
                  {latestGoldPrice?.pricePerGram24K ? `${latestGoldPrice.pricePerGram24K.toLocaleString()} EGP/g` : _t('غير متوفر', 'Unavailable', 'Nicht verfügbar')}
                </span>
              </span>
              <span className="text-[10px] text-text-muted">
                {latestGoldPrice?.source || 'No provider'} • {latestGoldPrice?.status === 'live' ? '🟢 Live' : '🟠 Cached'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleManualTestRefresh}
              disabled={isRefreshingGoldPrice}
              className="px-3 py-1.5 bg-surface-hover hover:bg-surface-border border border-surface-border rounded-lg text-xs font-bold text-text-main flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isRefreshingGoldPrice ? 'animate-spin' : ''}`} />
              <span>{isRefreshingGoldPrice ? _t('جارٍ الجلب...', 'Testing...', 'Prüfen...') : _t('تحديث الآن', 'Test Now', 'Jetzt testen')}</span>
            </button>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition cursor-pointer"
            >
              {_t('إلغاء', 'Cancel', 'Abbrechen')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{savedSuccess ? _t('تم الحفظ!', 'Saved!', 'Gespeichert!') : _t('حفظ الإعدادات', 'Save Settings', 'Speichern')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
