import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Laptop,
  Smartphone,
  Copy,
  Check,
  Search,
  PlugZap,
  Lock
} from 'lucide-react';
import {
  DEFAULT_LAN_SYNC_PORT,
  DiscoveredLanHost,
  LanConnectionTestResult,
  LanHostStatus,
  LanSyncUiState
} from '../../types';
import { discoverLanHosts } from '../../services/sync/discoveryService';
import { testHostConnection } from '../../services/sync/syncClient';
import { useApp } from '../../context/AppContext';

export interface PairingWizardProps {
  localDevice: { name: string; id: string };
  hostStatus?: LanHostStatus | null;
  onRefreshHostStatus?: () => Promise<void>;
  onRegenerateCode?: () => Promise<void>;
  onUpdateHostPort?: (port: number) => Promise<void>;
  onPair: (
    hostIp: string,
    port: number,
    pairingCode: string,
    expectedFingerprint?: string
  ) => Promise<void>;
  initialHostIp?: string;
  initialPort?: number;
  id?: string;
}

export const PairingWizard: React.FC<PairingWizardProps> = ({
  localDevice,
  hostStatus,
  onRefreshHostStatus,
  onRegenerateCode,
  onUpdateHostPort,
  onPair,
  initialHostIp,
  initialPort,
  id
}) => {
  const { _t } = useApp();
  const isElectronHostSupported = Boolean(hostStatus?.isSupported);

  const [mode, setMode] = useState<'connect' | 'host'>(
    isElectronHostSupported && !initialHostIp ? 'host' : 'connect'
  );

  // Client discovery & manual entry state
  const [uiState, setUiState] = useState<LanSyncUiState>(
    initialHostIp ? 'waiting_for_code' : 'disconnected'
  );
  const [wifiConnected, setWifiConnected] = useState<boolean>(true);
  const [discoveredHosts, setDiscoveredHosts] = useState<DiscoveredLanHost[]>([]);
  const [selectedHost, setSelectedHost] = useState<DiscoveredLanHost | null>(null);
  const [showManualForm, setShowManualForm] = useState<boolean>(Boolean(initialHostIp));

  const [ipInput, setIpInput] = useState<string>(initialHostIp || '');
  const [portInput, setPortInput] = useState<string>(
    String(initialPort && initialPort > 0 ? initialPort : DEFAULT_LAN_SYNC_PORT)
  );
  const [codeInput, setCodeInput] = useState<string>('');
  const [testResult, setTestResult] = useState<LanConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PC Host controls state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hostPortInput, setHostPortInput] = useState<string>(
    String(hostStatus?.port || DEFAULT_LAN_SYNC_PORT)
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (hostStatus?.port) {
      setHostPortInput(String(hostStatus.port));
    }
  }, [hostStatus?.port]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!hostStatus?.pairingExpiresAt) {
        setSecondsLeft(0);
        return;
      }
      setSecondsLeft(Math.max(0, Math.floor((hostStatus.pairingExpiresAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [hostStatus?.pairingExpiresAt]);

  const handleCopy = (key: string, value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleSearchLan = useCallback(async () => {
    setUiState('searching');
    setErrorMessage(null);
    setTestResult(null);
    try {
      const res = await discoverLanHosts(2200);
      setWifiConnected(res.wifiConnected);
      const filtered = (res.hosts || []).filter((h) => h.deviceId !== localDevice.id);
      setDiscoveredHosts(filtered);
      if (filtered.length > 0) {
        setUiState('host_found');
      } else {
        setUiState('disconnected');
        setShowManualForm(true);
      }
    } catch (err: any) {
      setUiState('sync_failed');
      setErrorMessage(err?.message || 'LAN search failed.');
    }
  }, [localDevice.id]);

  useEffect(() => {
    if (mode === 'connect' && !initialHostIp) {
      void handleSearchLan();
    }
  }, [mode, initialHostIp, handleSearchLan]);

  const handleSelectHost = (host: DiscoveredLanHost) => {
    setSelectedHost(host);
    setIpInput(host.primaryIp);
    setPortInput(String(host.port || DEFAULT_LAN_SYNC_PORT));
    setTestResult({
      ok: true,
      host: host.primaryIp,
      port: host.port || DEFAULT_LAN_SYNC_PORT,
      httpStatus: 200,
      latencyMs: host.latencyMs,
      deviceId: host.deviceId,
      deviceName: host.deviceName,
      addresses: host.addresses,
      certFingerprintSha256: host.certFingerprintSha256,
      verificationCode: host.verificationCode,
      pairingActive: host.pairingActive
    });
    setErrorMessage(null);
    setUiState('waiting_for_code');
  };

  const handleTestConnection = async () => {
    const cleanIp = ipInput.trim();
    const numPort = Number(portInput) || DEFAULT_LAN_SYNC_PORT;
    if (!cleanIp) {
      setErrorMessage(_t('أدخل عنوان IP الخاص بالكمبيوتر أولاً.', 'Enter the PC IP address first.', 'Bitte zuerst die PC-IP eingeben.'));
      return;
    }
    setIsTesting(true);
    setErrorMessage(null);
    setTestResult(null);
    try {
      const res = await testHostConnection(
        cleanIp,
        numPort,
        selectedHost?.certFingerprintSha256 || undefined
      );
      setTestResult(res);
      if (res.ok) {
        setUiState('waiting_for_code');
      } else {
        setUiState('sync_failed');
        setErrorMessage(res.message || `Connection test failed (${res.errorCode})`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfirmPair = async () => {
    const cleanIp = ipInput.trim();
    const numPort = Number(portInput) || DEFAULT_LAN_SYNC_PORT;
    const cleanCode = codeInput.replace(/\D/g, '').slice(0, 6);

    if (!cleanIp || cleanCode.length !== 6) {
      setErrorMessage(_t('أدخل عنوان IP ورمز الاقتران المكون من 6 أرقام.', 'Enter host IP and 6-digit pairing code.', 'Bitte IP und 6-stelligen Code eingeben.'));
      return;
    }

    setIsPairing(true);
    setUiState('pairing');
    setErrorMessage(null);

    try {
      const expectedFp =
        testResult?.ok && testResult.certFingerprintSha256
          ? testResult.certFingerprintSha256
          : selectedHost?.certFingerprintSha256 || undefined;
      await onPair(cleanIp, numPort, cleanCode, expectedFp);
      setUiState('connected');
    } catch (err: any) {
      setUiState('sync_failed');
      setErrorMessage(err?.message || 'Pairing failed.');
    } finally {
      setIsPairing(false);
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const stateBadgeLabel: Record<LanSyncUiState, string> = {
    searching: _t('جاري البحث عن الأجهزة...', 'Searching', 'Suche läuft...'),
    host_found: _t('تم العثور على الكمبيوتر', 'Host found', 'Host gefunden'),
    waiting_for_code: _t('بانتظار رمز الاقتران', 'Waiting for pairing code', 'Warte auf Code'),
    pairing: _t('جاري الاقتران الآمن...', 'Pairing', 'Koppeln...'),
    connected: _t('تم الاتصال بنجاح', 'Connected', 'Verbunden'),
    disconnected: _t('غير متصل', 'Disconnected', 'Getrennt'),
    synchronizing: _t('جاري المزامنة...', 'Synchronizing', 'Synchronisiere...'),
    sync_completed: _t('اكتملت المزامنة', 'Sync completed', 'Synchronisation fertig'),
    sync_failed: _t('فشل الاتصال', 'Sync failed', 'Fehlgeschlagen')
  };

  return (
    <div id={id} className="space-y-4">
      {/* Compact Role Switcher (only switchable when Desktop Host is supported) */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-surface-border pb-3">
        <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border">
          {isElectronHostSupported && (
            <button
              type="button"
              onClick={() => setMode('host')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                mode === 'host'
                  ? 'bg-surface text-primary border border-surface-border shadow-2xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>{_t('استضافة على الكمبيوتر (PC Host)', 'PC Sync Host', 'PC Sync Host')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('connect')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'connect'
                ? 'bg-surface text-primary border border-surface-border shadow-2xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{_t('الاتصال بكمبيوتر على الواي فاي', 'Connect to PC Host', 'Mit PC verbinden')}</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-text-muted tabular-nums">
          {mode === 'host'
            ? hostStatus?.listening
              ? _t('الحالة: بانتظار الأجهزة', 'Status: Waiting for devices', 'Status: Warte auf Geräte')
              : _t('الحالة: متوقف', 'Status: Stopped', 'Status: Gestoppt')
            : `${_t('الحالة:', 'State:', 'Status:')} ${stateBadgeLabel[uiState]}`}
        </span>
      </div>

      {/* MODE A: PC SYNC HOST (Electron Desktop) */}
      {mode === 'host' && (
        <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-main">
                {_t('خادم المزامنة المحلي (PC Sync Host)', 'PC Sync Host', 'PC Sync Host')}
              </h3>
              <p className="text-xs text-text-muted">
                {_t('توصيل مباشر عبر نفس شبكة Wi-Fi بتشفير TLS دون إنترنت.', 'Direct encrypted HTTPS sync over local Wi-Fi. No internet or relay required.', 'Direkte verschlüsselte WLAN-Synchronisation ohne Internet.')}
              </p>
            </div>
            {onRefreshHostStatus && (
              <button
                type="button"
                onClick={onRefreshHostStatus}
                className="p-2 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-text-muted hover:text-text-main cursor-pointer"
                title={_t('تحديث حالة الشبكة', 'Refresh Host Status', 'Status aktualisieren')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {hostStatus?.bindError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{hostStatus.errorCode || 'HOST_BIND_FAILED'}</div>
                <div>{hostStatus.bindError}</div>
              </div>
            </div>
          )}

          {/* Host Readout Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-background border border-surface-border space-y-1.5">
              <div className="text-[11px] font-semibold text-text-muted">
                {_t('عنوان IP المحلي (LAN IPv4)', 'Address (LAN IPv4)', 'IP-Adresse (LAN)')}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-text-main tabular-nums">
                  {hostStatus?.primaryIp || _t('لا توجد شبكة Wi-Fi / LAN', 'No active LAN IP', 'Keine LAN-IP')}
                </span>
                {hostStatus?.primaryIp && (
                  <button
                    type="button"
                    onClick={() => handleCopy('ip', hostStatus.primaryIp!)}
                    className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary cursor-pointer"
                  >
                    {copiedKey === 'ip' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {hostStatus && hostStatus.addresses.length > 1 && (
                <div className="text-[10px] font-mono text-text-muted truncate tabular-nums">
                  {_t('واجهات أخرى:', 'Other IPs:', 'Weitere:')}{' '}
                  {hostStatus.addresses.slice(1).join(', ')}
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-background border border-surface-border space-y-1.5">
              <div className="text-[11px] font-semibold text-text-muted">
                {_t('المنفذ (Port) ومعرّف الأمان', 'Port & TLS Verification Code', 'Port & Prüfcode')}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1025}
                    max={65535}
                    value={hostPortInput}
                    onChange={(e) => setHostPortInput(e.target.value)}
                    className="w-20 px-2 py-1 rounded-lg border border-surface-border bg-surface text-xs font-mono font-bold text-text-main tabular-nums"
                  />
                  {onUpdateHostPort && Number(hostPortInput) !== hostStatus?.port && (
                    <button
                      type="button"
                      onClick={() => onUpdateHostPort(Number(hostPortInput) || DEFAULT_LAN_SYNC_PORT)}
                      className="px-2 py-1 rounded-lg bg-primary text-primary-fg text-[11px] font-bold cursor-pointer"
                    >
                      {_t('تطبيق', 'Apply', 'Übernehmen')}
                    </button>
                  )}
                </div>
                {hostStatus?.verificationCode && (
                  <span className="font-mono text-[11px] font-bold text-primary flex items-center gap-1 tabular-nums">
                    <Lock className="w-3 h-3" />
                    {hostStatus.verificationCode}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-text-muted">
                {_t('الجهاز:', 'Device:', 'Gerät:')} <strong className="text-text-main">{hostStatus?.deviceName || localDevice.name}</strong>
              </div>
            </div>
          </div>

          {/* Ephemeral Pairing Code Box */}
          <div className="p-4 rounded-xl bg-primary-soft border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-primary uppercase tracking-wider">
                {_t('رمز الاقتران المؤقت (صالح لمرة واحدة)', 'Short-Lived Pairing Code (Single-Use)', 'Einmal-Kopplungscode')}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-2xl font-black tracking-[0.22em] text-text-main tabular-nums">
                  {hostStatus?.pairingLockedOut
                    ? _t('محظور مؤقتاً', 'LOCKED', 'GESPERRT')
                    : hostStatus?.pairingCode || '------'}
                </span>
                {hostStatus?.pairingCode && (
                  <button
                    type="button"
                    onClick={() => handleCopy('pin', hostStatus.pairingCode!)}
                    className="p-1.5 rounded-lg bg-surface border border-surface-border text-text-muted hover:text-primary cursor-pointer"
                    title={_t('نسخ الرمز', 'Copy Code', 'Code kopieren')}
                  >
                    {copiedKey === 'pin' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-text-muted mt-1 tabular-nums">
                {hostStatus?.pairingLockedOut
                  ? _t(`محاولات خاطئة متكررة — انتظر ${Math.ceil(hostStatus.lockoutRemainingMs / 1000)} ثانية`, `Locked for ${Math.ceil(hostStatus.lockoutRemainingMs / 1000)}s due to invalid attempts.`, `Gesperrt für ${Math.ceil(hostStatus.lockoutRemainingMs / 1000)}s`)
                  : secondsLeft > 0
                  ? _t(`ينتهي خلال ${formatCountdown(secondsLeft)} — أدخله على هاتف Android بعد اختيار هذا الجهاز.`, `Expires in ${formatCountdown(secondsLeft)} — enter on Android to pair.`, `Läuft in ${formatCountdown(secondsLeft)} ab`)
                  : _t('انتهت صلاحية الرمز. أنشئ رمزاً جديداً للربط.', 'Code expired. Generate a new code to pair a device.', 'Code abgelaufen. Neuen Code erstellen.')}
              </p>
            </div>

            {onRegenerateCode && (
              <button
                type="button"
                onClick={onRegenerateCode}
                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{_t('رمز جديد', 'New Code', 'Neuer Code')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODE B: CLIENT CONNECT (Android / Desktop Client) */}
      {mode === 'connect' && (
        <div className="space-y-4">
          {!wifiConnected && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {_t(
                  'تأكد من اتصال الهاتف والكمبيوتر بنفس شبكة Wi-Fi ثم أعد البحث أو أدخل العنوان يدوياً.',
                  'Ensure Android phone and PC are on the same Wi-Fi network, or enter PC IP manually below.',
                  'Stellen Sie sicher, dass PC und Smartphone im selben WLAN sind.'
                )}
              </span>
            </div>
          )}

          {/* Step 1: Search Devices on Same Wi-Fi */}
          <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-text-main">
                  {_t('الأجهزة المكتشفة على شبكة Wi-Fi', 'Devices on Local Wi-Fi', 'Geräte im lokalen WLAN')}
                </h3>
                <p className="text-xs text-text-muted">
                  {_t('افتح Glück على الكمبيوتر لعرض IP ورمز الاقتران.', 'Open Glück PC Sync Host on your computer to make it discoverable.', 'Öffnen Sie Glück auf dem PC als Sync-Host.')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSearchLan}
                disabled={uiState === 'searching'}
                className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {uiState === 'searching' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>{uiState === 'searching' ? _t('جاري البحث...', 'Searching...', 'Suche...') : _t('بحث على الشبكة', 'Search Wi-Fi', 'WLAN suchen')}</span>
              </button>
            </div>

            {discoveredHosts.length > 0 ? (
              <div className="divide-y divide-surface-border rounded-xl border border-surface-border overflow-hidden">
                {discoveredHosts.map((host) => {
                  const isSelected = selectedHost?.deviceId === host.deviceId;
                  return (
                    <button
                      key={`${host.deviceId}_${host.primaryIp}`}
                      type="button"
                      onClick={() => handleSelectHost(host)}
                      className={`w-full p-3 text-left rtl:text-right flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected ? 'bg-primary-soft' : 'bg-background hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-surface border border-surface-border flex items-center justify-center text-primary shrink-0">
                          <Laptop className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-text-main truncate">{host.deviceName}</div>
                          <div className="text-[11px] font-mono text-text-muted tabular-nums">
                            {host.primaryIp}:{host.port}
                            {host.verificationCode ? ` · TLS ${host.verificationCode}` : ''}
                            {typeof host.latencyMs === 'number' ? ` · ${host.latencyMs}ms` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-primary shrink-0">
                        {isSelected ? _t('مختار', 'Selected', 'Gewählt') : _t('اختيار', 'Select', 'Wählen')}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-text-muted py-2">
                {uiState === 'searching'
                  ? _t('جاري مسح الشبكة المحلية عبر mDNS و UDP...', 'Scanning local network via mDNS & UDP broadcast...', 'Scanne lokales Netzwerk...')
                  : _t('لم يتم اكتشاف جهاز تلقائياً بعد. يمكنك الإضافة يدوياً أدناه.', 'No host discovered automatically yet. Use manual IP & port below.', 'Kein Gerät gefunden. Manuell hinzufügen.')}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowManualForm((v) => !v)}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              {showManualForm
                ? _t('إخفاء الإدخال اليدوي', 'Hide Manual IP Entry', 'Manuelle Eingabe ausblenden')
                : _t('إضافة جهاز يدوياً (IP + Port)', 'Add Device Manually (IP + Port)', 'Gerät manuell hinzufügen')}
            </button>
          </div>

          {/* Step 2: Manual / Selected Entry + Connection Test + Pairing Code */}
          {(showManualForm || selectedHost) && (
            <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-text-muted mb-1">
                    {_t('عنوان IP للكمبيوتر', 'PC IP Address', 'PC IP-Adresse')}
                  </label>
                  <input
                    type="text"
                    value={ipInput}
                    onChange={(e) => {
                      setIpInput(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="192.168.1.5"
                    className="w-full px-3 py-2 rounded-xl border border-surface-border bg-background text-sm font-mono text-text-main tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1">
                    {_t('المنفذ (Port)', 'Port', 'Port')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={portInput}
                    onChange={(e) => {
                      setPortInput(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="8765"
                    className="w-full px-3 py-2 rounded-xl border border-surface-border bg-background text-sm font-mono text-text-main tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Pairing Code & Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1">
                    {_t('رمز الاقتران (6 أرقام)', '6-Digit Pairing Code', '6-stelliger Kopplungscode')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="482193"
                    className="w-full px-3 py-2 rounded-xl border border-surface-border bg-background text-base font-mono font-bold tracking-[0.2em] text-text-main tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !ipInput.trim()}
                    className="flex-1 min-h-[38px] px-3 py-2 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-xs font-bold text-text-main flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <PlugZap className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-primary' : ''}`} />
                    <span>{isTesting ? _t('فحص...', 'Testing...', 'Teste...') : _t('اختبار الاتصال', 'Test Connection', 'Verbindung testen')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmPair}
                    disabled={isPairing || !ipInput.trim() || codeInput.length !== 6}
                    className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    {isPairing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>{isPairing ? _t('ربط...', 'Pairing...', 'Koppeln...') : _t('ربط وحفظ', 'Pair & Save', 'Koppeln')}</span>
                  </button>
                </div>
              </div>

              {testResult && testResult.ok && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {_t('متاح:', 'Reachable:', 'Erreichbar:')} <strong>{testResult.deviceName || testResult.host}</strong>
                      {testResult.verificationCode ? ` · TLS ${testResult.verificationCode}` : ''}
                    </span>
                  </div>
                  {typeof testResult.latencyMs === 'number' && (
                    <span className="font-mono text-[11px] tabular-nums">{testResult.latencyMs}ms</span>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
