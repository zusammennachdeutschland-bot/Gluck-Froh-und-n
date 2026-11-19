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
  const { lessons, groups, students, updateLesson, language, _t, triggerToast, setActiveTab } = useApp();
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
        students: students || [],
        onUpdateLesson: updateLesson
      });
      const updated = loadGrainIntegrationMeta();
      setMeta(updated);
      if (res.success) {
        const autoCount = res.autoMatchedLessonIds?.length || 0;
        const msg = _t(
          `تمت المزامنة: إجمالي ${res.recordings.length} تسجيل (${res.newCount} جديد${autoCount > 0 ? `، ${autoCount} حصة تمت مطابقتها تلقائياً` : ''})`,
          `Synced: ${res.recordings.length} total recordings (${res.newCount} new${autoCount > 0 ? `, ${autoCount} lessons auto-matched` : ''})`,
          `Synchronisiert: ${res.recordings.length} Aufnahmen (${res.newCount} neu${autoCount > 0 ? `, ${autoCount} automatisch zugeordnet` : ''})`
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

  const renderCapabilityStatus = (state: GrainCapabilityState) => {
    switch (state) {
      case 'available_tested':
        return (
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            {_t('متاح (تم اختباره)', 'Available (Tested)', 'Verfügbar (Getestet)')}
          </span>
        );
      case 'available_untested':
        return (
          <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            {_t('غير مختبر بعد', 'Untested', 'Noch nicht getestet')}
          </span>
        );
      case 'restricted':
        return (
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            {_t('مقيد بالخطة', 'Restricted', 'Eingeschränkt')}
          </span>
        );
      case 'failed':
        return (
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            {_t('فشل', 'Failed', 'Fehlgeschlagen')}
          </span>
        );
      case 'unsupported':
        return (
          <span className="text-[11px] font-medium text-text-muted">
            {_t('غير مدعوم', 'Unsupported', 'Nicht unterstützt')}
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium text-text-muted">
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
      className="bg-surface border border-surface-border rounded-2xl p-4 space-y-3.5 shadow-2xs"
    >
      {/* Header & Connection Status */}
      <div className="flex items-start sm:items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary-soft border border-primary-border/60 text-primary flex items-center justify-center shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-text-main">
                {_t('تكامل تسجيلات Grain الشخصي', 'Grain Personal API Integration', 'Grain Personal-API-Integration')}
              </h3>
              {meta.runtime === 'unsupported' ? (
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  · {_t('بيئة غير مدعومة', 'Unsupported Runtime', 'Nicht unterstützt')}
                </span>
              ) : meta.connected && meta.hasToken ? (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <span aria-hidden="true">·</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{_t('متصل', 'Connected', 'Verbunden')}</span>
                </span>
              ) : meta.hasToken ? (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  · {_t('التوكن محفوظ (يتطلب فحص)', 'Token Saved (Unverified)', 'Token gespeichert')}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-text-muted">
                  · {_t('غير متصل', 'Disconnected', 'Nicht verbunden')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
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
          className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
            meta.enabled
              ? 'bg-primary-soft text-primary border-primary-border'
              : 'bg-surface-hover text-text-muted border-surface-border hover:text-text-main'
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
      <form onSubmit={handleSaveToken} className="space-y-2.5 pt-2.5 border-t border-surface-border">
        <div className="flex items-center justify-between gap-2 text-xs">
          <label className="font-bold text-text-main flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-primary" />
            <span>{_t('توكن Grain الشخصي (Personal Access Token):', 'Grain Personal Access Token:', 'Grain Personal Access Token:')}</span>
          </label>
          {meta.maskedToken && (
            <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
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
            className="flex-1 min-h-[40px] px-3 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!meta.enabled || !meta.secureStorageAvailable || !tokenInput.trim() || isSaving}
            className="min-h-[40px] px-4 bg-primary hover:bg-primary-hover text-primary-fg rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shrink-0 shadow-2xs"
          >
            {isSaving
              ? _t('جاري الحفظ...', 'Saving...', 'Speichern...')
              : _t('حفظ التوكن', 'Save Token', 'Token speichern')}
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!meta.enabled || !meta.hasToken || isTesting}
            className="min-h-[40px] px-3.5 bg-surface-hover hover:bg-surface text-text-main border border-surface-border rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
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
            className="min-h-[40px] px-3.5 bg-surface-hover hover:bg-surface text-text-main border border-surface-border rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? _t('جاري المزامنة...', 'Syncing...', 'Synchronisiere...')
                : _t('مزامنة التسجيلات الآن', 'Sync Recordings Now', 'Aufnahmen jetzt synchronisieren')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grainRecordings')}
            className="min-h-[40px] px-3.5 bg-primary-soft hover:bg-primary/20 text-primary border border-primary-border rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
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
              className="min-h-[40px] px-3.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ms-auto transition-colors"
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

      {/* Hairline-Divided Metadata Strip: Scope, Last Sync, Runtime */}
      <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl bg-surface-hover/50 border border-surface-border divide-y sm:divide-y-0 sm:divide-x divide-surface-border overflow-hidden text-xs">
        <div className="p-2.5">
          <span className="text-[11px] text-text-muted font-medium block">
            {_t('نطاق التوكن (Scope):', 'Token Scope:', 'Token-Bereich:')}
          </span>
          <span className="font-mono font-bold text-text-main mt-0.5 block truncate">
            {meta.tokenScope || _t('غير متاح', 'N/A', 'N/A')}
          </span>
        </div>
        <div className="p-2.5">
          <span className="text-[11px] text-text-muted font-medium block">
            {_t('آخر مزامنة ناجحة:', 'Last Successful Sync:', 'Letzte Synchronisierung:')}
          </span>
          <span className="font-mono font-bold text-text-main mt-0.5 block tabular-nums">
            {meta.lastSuccessfulSyncAt
              ? new Date(meta.lastSuccessfulSyncAt).toLocaleString(language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-US')
              : _t('لم تتم بعد', 'Never', 'Noch nie')}
          </span>
        </div>
        <div className="p-2.5">
          <span className="text-[11px] text-text-muted font-medium block">
            {_t('بيئة التخزين الآمن:', 'Secure Storage Runtime:', 'Sichere Laufzeitumgebung:')}
          </span>
          <span className="font-mono font-bold text-text-main uppercase mt-0.5 block">
            {meta.runtime} {meta.secureStorageAvailable ? '✓' : '✗'}
          </span>
        </div>
      </div>

      {syncSummaryMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncSummaryMsg}</span>
        </div>
      )}

      {meta.lastError && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">{meta.lastError}</span>
        </div>
      )}

      {/* Account Capability Matrix */}
      <div className="space-y-1.5 pt-1">
        <div className="text-xs font-bold text-text-main flex items-center justify-between gap-2 flex-wrap">
          <span>{_t('حالة قدرات حساب Grain الفعلي:', 'Account Capability Status:', 'Konto-Funktionsstatus:')}</span>
          <span className="text-[11px] text-text-muted font-normal">
            {_t('لا يتم عرض أي ميزة كمتاحة إلا بعد اختبارها فعلياً', 'Only verified features are shown as Available', 'Nur getestete Funktionen werden als verfügbar markiert')}
          </span>
        </div>
        <div className="border border-surface-border rounded-xl divide-y divide-surface-border overflow-hidden text-xs">
          {capabilityRows.map((row, idx) => (
            <div
              key={idx}
              className="px-3 py-2 bg-surface flex items-center justify-between gap-2 hover:bg-surface-hover/40"
            >
              <span className="text-[11px] font-medium text-text-main">{row.label}</span>
              {renderCapabilityStatus(row.state)}
            </div>
          ))}
        </div>

        {/* Collapsible 4-Step Recording Discovery Diagnostic Matrix */}
        {meta.lastDiagnostics && meta.lastDiagnostics.length > 0 && (
          <details className="pt-1 group">
            <summary className="text-[11px] font-semibold text-text-muted hover:text-text-main cursor-pointer select-none py-1">
              {_t(
                'تشخيص اكتشاف التسجيلات (Tests A–D — عرض التفاصيل الفنية)',
                'Recording Discovery Diagnostics (Tests A–D — technical log)',
                'Aufnahme-Erkennungsdiagnose (Tests A–D — Details)'
              )}
            </summary>
            <div className="mt-1.5 border border-surface-border rounded-xl divide-y divide-surface-border overflow-hidden text-[11px] font-mono">
              {meta.lastDiagnostics.map((step) => (
                <div
                  key={step.testId}
                  className="px-3 py-1.5 bg-surface-hover/40 flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="font-semibold text-text-main">
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
          </details>
        )}
      </div>
    </div>
  );
};
