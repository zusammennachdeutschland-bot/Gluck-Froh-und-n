import React, { useEffect, useState } from 'react';
import {
  Video,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Key,
  Power,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GrainCapabilityState } from '../types';
import {
  GrainIntegrationMetaState,
  disconnectGrainAccount,
  loadGrainIntegrationMeta,
  refreshGrainRuntimeStatus,
  saveGrainIntegrationMeta,
  saveGrainPersonalToken,
  syncGrainRecordingsIncrementally,
  testAndProbeGrainConnection
} from '../services/grainService';

export const GrainSettingsCard: React.FC = () => {
  const { lessons, groups, students, language, _t, triggerToast, setActiveTab } = useApp();
  const [meta, setMeta] = useState<GrainIntegrationMetaState>(() => loadGrainIntegrationMeta());
  const [tokenInput, setTokenInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncSummaryMsg, setSyncSummaryMsg] = useState<string | null>(null);

  const isRtl = language === 'ar';

  useEffect(() => {
    let mounted = true;
    refreshGrainRuntimeStatus().then((updated) => {
      if (mounted) setMeta(updated);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleEnabled = () => {
    const nextEnabled = !meta.enabled;
    const updated = saveGrainIntegrationMeta({ enabled: nextEnabled });
    setMeta(updated);
    triggerToast(
      nextEnabled
        ? _t('تم تفعيل تكامل Grain', 'Grain integration enabled', 'Grain-Integration aktiviert')
        : _t('تم إيقاف تكامل Grain مؤقتاً', 'Grain integration disabled', 'Grain-Integration deaktiviert')
    );
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (!clean) return;
    setIsSaving(true);
    setSyncSummaryMsg(null);
    try {
      const res = await saveGrainPersonalToken(clean);
      setMeta(res.state);
      if (res.success) {
        setTokenInput(''); // Clear raw token from input state immediately
        const probeRes = await testAndProbeGrainConnection();
        setMeta(probeRes.state);
        triggerToast(
          probeRes.connected
            ? _t(
                'تم حفظ التوكن بأمان والاتصال بـ Grain بنجاح',
                'Token securely saved & Grain connected',
                'Token sicher gespeichert & mit Grain verbunden'
              )
            : _t(
                'تم حفظ التوكن، لكن فشل التحقق من الاتصال',
                'Token saved, but connection verification failed',
                'Token gespeichert, aber Verbindungsprüfung fehlgeschlagen'
              )
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setSyncSummaryMsg(null);
    try {
      const res = await testAndProbeGrainConnection();
      setMeta(res.state);
      triggerToast(
        res.connected
          ? _t('تم التحقق من اتصال Grain بنجاح', 'Grain connection verified', 'Grain-Verbindung bestätigt')
          : _t('تعذر التحقق من اتصال Grain', 'Grain connection check failed', 'Grain-Verbindung fehlgeschlagen')
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncRecordings = async () => {
    setIsSyncing(true);
    setSyncSummaryMsg(null);
    try {
      const res = await syncGrainRecordingsIncrementally({
        lessons: lessons || [],
        groups: groups || [],
        students: students || []
      });
      const updated = loadGrainIntegrationMeta();
      setMeta(updated);
      if (res.success) {
        const msg = _t(
          `تمت المزامنة: إجمالي ${res.recordings.length} تسجيل (${res.newCount} جديد)`,
          `Synced: ${res.recordings.length} total recordings (${res.newCount} new)`,
          `Synchronisiert: ${res.recordings.length} Aufnahmen (${res.newCount} neu)`
        );
        setSyncSummaryMsg(msg);
        triggerToast(msg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setSyncSummaryMsg(null);
    try {
      const updated = await disconnectGrainAccount();
      setMeta(updated);
      setTokenInput('');
      triggerToast(
        _t(
          'تم فصل حساب Grain ومسح بيانات الاعتماد المؤقتة بأمان',
          'Grain account disconnected & credentials cleared',
          'Grain-Konto getrennt & Zugangsdaten gelöscht'
        )
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const renderCapabilityBadge = (state: GrainCapabilityState) => {
    switch (state) {
      case 'available_tested':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            {_t('متاح (تم اختباره)', 'Available (Tested)', 'Verfügbar (Getestet)')}
          </span>
        );
      case 'available_untested':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            {_t('غير مختبر بعد', 'Untested', 'Noch nicht getestet')}
          </span>
        );
      case 'restricted':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            {_t('مقيد بالخطة', 'Restricted', 'Eingeschränkt')}
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            {_t('فشل', 'Failed', 'Fehlgeschlagen')}
          </span>
        );
      case 'unsupported':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            {_t('غير مدعوم', 'Unsupported', 'Nicht unterstützt')}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-text-muted border border-surface-border">
            {_t('غير معروف', 'Unknown', 'Unbekannt')}
          </span>
        );
    }
  };

  const capabilityRows: Array<{ label: string; state: GrainCapabilityState }> = [
    {
      label: _t('توثيق التوكن (Token authentication)', 'Token authentication', 'Token-Authentifizierung'),
      state: meta.capabilities.tokenAuthentication
    },
    {
      label: _t('نطاق الحساب الشخصي (Personal API scope)', 'Personal API scope', 'Personal-API-Bereich'),
      state: meta.capabilities.personalApiScope
    },
    {
      label: _t('اكتشاف التسجيلات (Recording discovery)', 'Recording discovery', 'Aufnahme-Erkennung'),
      state: meta.capabilities.recordingDiscovery
    },
    {
      label: _t('روابط التسجيلات (Recording URLs)', 'Recording URLs', 'Aufnahme-URLs'),
      state: meta.capabilities.recordingUrls
    },
    {
      label: _t('بيانات Zoom والتقويم (Zoom/calendar metadata)', 'Zoom/calendar metadata', 'Zoom-/Kalender-Metadaten'),
      state: meta.capabilities.zoomCalendarMetadata
    },
    {
      label: _t('المشاركون (Participants)', 'Participants', 'Teilnehmer'),
      state: meta.capabilities.participants
    },
    {
      label: _t('ملخصات الذكاء الاصطناعي (AI summaries)', 'AI summaries', 'KI-Zusammenfassungen'),
      state: meta.capabilities.aiSummaries
    },
    {
      label: _t('الوصول للنص الكامل (Transcript access)', 'Transcript access', 'Transkript-Zugriff'),
      state: meta.capabilities.transcriptAccess
    },
    {
      label: _t('تصفح الصفحات (Pagination)', 'Pagination', 'Seitennummerierung'),
      state: meta.capabilities.pagination
    }
  ];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="bg-surface border border-surface-border rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3"
    >
      {/* Header & Connection Status */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-text-main">
                {_t('تكامل تسجيلات Grain الشخصي', 'Grain Personal API Integration', 'Grain Personal-API-Integration')}
              </h3>
              {meta.runtime === 'unsupported' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 border border-rose-500/30">
                  {_t('بيئة غير مدعومة', 'Unsupported Runtime', 'Nicht unterstützt')}
                </span>
              ) : meta.connected && meta.hasToken ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{_t('متصل', 'Connected', 'Verbunden')}</span>
                </span>
              ) : meta.hasToken ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {_t('التوكن محفوظ (يتطلب فحص)', 'Token Saved (Unverified)', 'Token gespeichert')}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-text-muted border border-surface-border">
                  {_t('غير متصل', 'Disconnected', 'Nicht verbunden')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              {_t(
                'ربط آمن لتسجيلات Zoom عبر Grain بالحصة وتقارير أولياء الأمور مع مراجعة المعلم الإلزامية',
                'Securely link Zoom recordings via Grain to lessons and teacher-reviewed parent reports',
                'Zoom-Aufnahmen über Grain sicher mit Lektionen und Elternberichten verknüpfen'
              )}
            </p>
          </div>
        </div>

        {/* Enable / Disable Toggle */}
        <button
          type="button"
          onClick={handleToggleEnabled}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all flex items-center gap-1.5 cursor-pointer ${
            meta.enabled
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-surface-hover text-text-muted border-surface-border'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>
            {meta.enabled
              ? _t('مفعّل', 'Enabled', 'Aktiviert')
              : _t('معطّل', 'Disabled', 'Deaktiviert')}
          </span>
        </button>
      </div>

      {/* Secure Storage & Token Input */}
      <form onSubmit={handleSaveToken} className="space-y-2 pt-1 border-t border-surface-border/70">
        <div className="flex items-center justify-between text-[11px]">
          <label className="font-bold text-text-main flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-violet-500" />
            <span>{_t('توكن Grain الشخصي (Personal Access Token):', 'Grain Personal Access Token:', 'Grain Personal Access Token:')}</span>
          </label>
          {meta.maskedToken && (
            <span className="font-mono text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {meta.maskedToken}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            disabled={!meta.enabled || !meta.secureStorageAvailable || isSaving}
            placeholder={
              meta.hasToken
                ? _t('محفوظ بأمان — أدخل توكن جديد للاستبدال فقط', 'Saved securely — enter new token to replace', 'Sicher gespeichert — neuen Token eingeben')
                : 'grain_pat_...'
            }
            dir="ltr"
            autoComplete="off"
            className="flex-1 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-mono text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!meta.enabled || !meta.secureStorageAvailable || !tokenInput.trim() || isSaving}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-black transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isSaving
              ? _t('جاري الحفظ...', 'Saving...', 'Speichern...')
              : _t('حفظ التوكن', 'Save Token', 'Token speichern')}
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!meta.enabled || !meta.hasToken || isTesting}
            className="px-2.5 py-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>
              {isTesting
                ? _t('جاري الفحص...', 'Testing...', 'Prüfe...')
                : _t('اختبار الاتصال وفحص الصلاحيات', 'Test Connection & Capabilities', 'Verbindung & Funktionen prüfen')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSyncRecordings}
            disabled={!meta.enabled || !meta.hasToken || isSyncing}
            className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? _t('جاري المزامنة...', 'Syncing...', 'Synchronisiere...')
                : _t('مزامنة التسجيلات الآن', 'Sync Recordings Now', 'Aufnahmen jetzt synchronisieren')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grainRecordings')}
            className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Video className="w-3.5 h-3.5" />
            <span>
              {_t('فتح مكتبة تسجيلات الحصص', 'Open Grain Recordings Library', 'Aufzeichnungsbibliothek öffnen')}
            </span>
          </button>

          {meta.hasToken && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ms-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isDisconnecting
                  ? _t('جاري الفصل...', 'Disconnecting...', 'Trennen...')
                  : _t('فصل الحساب', 'Disconnect', 'Trennen')}
              </span>
            </button>
          )}
        </div>
      </form>

      {/* Metadata Status Bar: Scope, Last Sync, Last Error */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-surface-hover/60 p-2.5 rounded-lg border border-surface-border">
        <div>
          <span className="text-text-muted font-bold block">
            {_t('نطاق التوكن (Scope):', 'Token Scope:', 'Token-Bereich:')}
          </span>
          <span className="font-mono font-black text-text-main">
            {meta.tokenScope || _t('غير متاح', 'N/A', 'N/A')}
          </span>
        </div>
        <div>
          <span className="text-text-muted font-bold block">
            {_t('آخر مزامنة ناجحة:', 'Last Successful Sync:', 'Letzte Synchronisierung:')}
          </span>
          <span className="font-mono font-bold text-text-main">
            {meta.lastSuccessfulSyncAt
              ? new Date(meta.lastSuccessfulSyncAt).toLocaleString(language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-US')
              : _t('لم تتم بعد', 'Never', 'Noch nie')}
          </span>
        </div>
        <div>
          <span className="text-text-muted font-bold block">
            {_t('بيئة التخزين الآمن:', 'Secure Storage Runtime:', 'Sichere Laufzeitumgebung:')}
          </span>
          <span className="font-mono font-bold text-text-main uppercase">
            {meta.runtime} {meta.secureStorageAvailable ? '✓' : '✗'}
          </span>
        </div>
      </div>

      {syncSummaryMsg && (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncSummaryMsg}</span>
        </div>
      )}

      {meta.lastError && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">{meta.lastError}</span>
        </div>
      )}

      {/* Account Capability Matrix */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[11px] font-black text-text-main flex items-center justify-between">
          <span>{_t('حالة قدرات حساب Grain الفعلي:', 'Account Capability Status:', 'Konto-Funktionsstatus:')}</span>
          <span className="text-[10px] text-text-muted font-normal">
            {_t('لا يتم عرض أي ميزة كمتاحة إلا بعد اختبارها فعلياً', 'Only verified features are shown as Available', 'Nur getestete Funktionen werden als verfügbar markiert')}
          </span>
        </div>
        <div className="border border-surface-border rounded-lg divide-y divide-surface-border overflow-hidden text-xs">
          {capabilityRows.map((row, idx) => (
            <div
              key={idx}
              className="px-3 py-1.5 bg-surface flex items-center justify-between gap-2 hover:bg-surface-hover/40"
            >
              <span className="text-[11px] font-bold text-text-main">{row.label}</span>
              {renderCapabilityBadge(row.state)}
            </div>
          ))}
        </div>

        {/* 4-Step Recording Discovery Diagnostic Matrix (Part 7) */}
        {meta.lastDiagnostics && meta.lastDiagnostics.length > 0 && (
          <div className="pt-2 space-y-1">
            <div className="text-[10px] font-bold text-text-muted">
              {_t(
                'تشخيص اكتشاف التسجيلات (Tests A–D — خالي من أي بيانات خاصة أو رموز سرية):',
                'Recording Discovery Diagnostics (Tests A–D — sanitized):',
                'Aufnahme-Erkennungsdiagnose (Tests A–D — bereinigt):'
              )}
            </div>
            <div className="border border-surface-border rounded-lg divide-y divide-surface-border overflow-hidden text-[10px] font-mono">
              {meta.lastDiagnostics.map((step) => (
                <div
                  key={step.testId}
                  className="px-2.5 py-1 bg-surface-hover/40 flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="font-bold text-text-main">
                    {step.testId}: {step.description}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        step.httpStatus === 200
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'text-rose-600 dark:text-rose-400 font-bold'
                      }
                    >
                      HTTP {step.httpStatus || 'ERR'}
                    </span>
                    <span>
                      recordings[]: {step.hasRecordingsArray ? `yes (${step.recordingsCount})` : 'no'}
                    </span>
                    <span>cursor: {step.hasCursor ? 'yes' : 'no'}</span>
                    {step.errorCode && (
                      <span className="text-rose-600 dark:text-rose-400">
                        [{step.errorCode}]
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
