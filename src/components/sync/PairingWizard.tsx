import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Camera,
  Image as ImageIcon,
  Keyboard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Laptop,
  Smartphone,
  Copy,
  Check,
  WifiOff,
  Radio,
  X
} from 'lucide-react';
import {
  DiscoveredRoomDevice,
  P2pHostStartResult,
  PairedPeer,
  PresenceRoomState
} from '../../types';
import {
  canScanQrWithCamera,
  createPairingPayload,
  generateQrSvg,
  parsePairingPayload,
  scanQrFromSource
} from '../../services/sync/qrCodeService';
import { discoverNewDevices } from '../../services/sync/discoveryService';
import { useApp } from '../../context/AppContext';

export interface PairingWizardProps {
  localDevice: { name: string; id: string };
  hostStatus?: P2pHostStartResult | null;
  roomState?: PresenceRoomState | null;
  pairedPeers?: PairedPeer[];
  onRefreshHostStatus?: () => Promise<void>;
  onRegenerateCode?: () => Promise<void>;
  onPair: (targetDeviceId: string, pairingPin: string) => Promise<void>;
  prefillDeviceId?: string;
  id?: string;
}

type PairingTab = 'show_qr' | 'scan_camera' | 'upload_image' | 'enter_pin';

export const PairingWizard: React.FC<PairingWizardProps> = ({
  localDevice,
  hostStatus,
  roomState,
  pairedPeers = [],
  onRefreshHostStatus,
  onRegenerateCode,
  onPair,
  prefillDeviceId,
  id
}) => {
  const { _t } = useApp();
  const [activeTab, setActiveTab] = useState<PairingTab>(prefillDeviceId ? 'enter_pin' : 'enter_pin');
  const [targetDeviceId, setTargetDeviceId] = useState<string>(prefillDeviceId || '');
  const [targetDeviceName, setTargetDeviceName] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [isPairing, setIsPairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Camera scanning refs & state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningCamera, setIsScanningCamera] = useState(false);

  const cameraSupported = canScanQrWithCamera();
  const discoveredUnpaired: DiscoveredRoomDevice[] = discoverNewDevices(pairedPeers);

  useEffect(() => {
    if (prefillDeviceId) {
      setTargetDeviceId(prefillDeviceId);
      setActiveTab('enter_pin');
    }
  }, [prefillDeviceId]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!hostStatus?.brokerConnected || !hostStatus?.pinExpiresAt) {
        setSecondsLeft(0);
        return;
      }
      setSecondsLeft(Math.max(0, Math.floor((hostStatus.pinExpiresAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [hostStatus?.brokerConnected, hostStatus?.pinExpiresAt]);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanningCamera(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleConnect = useCallback(
    async (explicitTargetDeviceId?: string, explicitPin?: string) => {
      const cleanPin = String(explicitPin ?? pinInput).replace(/\D/g, '').slice(0, 6);
      const cleanTarget = String(explicitTargetDeviceId ?? targetDeviceId ?? '').trim();

      if (cleanPin.length !== 6) {
        setErrorMessage(
          _t(
            'أدخل رمز الاقتران المكون من 6 أرقام.',
            'Enter a valid 6-digit pairing code.',
            'Bitte den 6-stelligen Code eingeben.'
          )
        );
        return;
      }

      setIsPairing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        await onPair(cleanTarget, cleanPin);
        setSuccessMessage(
          _t('تم الاقتران بنجاح عبر WebRTC P2P!', 'Paired successfully via direct WebRTC P2P!', 'Erfolgreich per WebRTC P2P gekoppelt!')
        );
        setPinInput('');
      } catch (err: any) {
        setErrorMessage(err?.message || 'Pairing failed.');
      } finally {
        setIsPairing(false);
      }
    },
    [_t, onPair, pinInput, targetDeviceId]
  );

  const handleParsedQrString = useCallback(
    async (rawText: string) => {
      const parsed = parsePairingPayload(rawText);
      if (!parsed.valid || !parsed.payload) {
        setErrorMessage(parsed.error || 'Invalid QR code.');
        return;
      }
      if (parsed.expired) {
        setErrorMessage(
          _t(
            'انتهت صلاحية رمز QR هذا. أنشئ رمزاً جديداً على الجهاز الآخر.',
            'This QR code has expired. Generate a new code on the other device.',
            'Dieser QR-Code ist abgelaufen.'
          )
        );
        return;
      }

      stopCamera();
      setTargetDeviceId(parsed.payload.deviceId || '');
      setTargetDeviceName(parsed.payload.deviceName || '');
      setPinInput(parsed.payload.pin);
      await handleConnect(parsed.payload.deviceId || '', parsed.payload.pin);
    },
    [_t, handleConnect, stopCamera]
  );

  useEffect(() => {
    if (activeTab !== 'scan_camera') {
      stopCamera();
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      setCameraError(null);
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setCameraError(
          _t(
            'الكاميرا غير متاحة في هذا المتصفح. استخدم رفع صورة QR أو أدخل الرمز يدوياً.',
            'Camera is not available here. Upload a QR image or enter the 6-digit code.',
            'Kamera nicht verfügbar. QR-Bild hochladen oder Code eingeben.'
          )
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsScanningCamera(true);

        scanTimerRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          const decoded = await scanQrFromSource(videoRef.current);
          if (decoded) {
            await handleParsedQrString(decoded);
          }
        }, 450);
      } catch (err: any) {
        if (!cancelled) {
          setCameraError(
            err?.message ||
              _t('تعذر فتح الكاميرا.', 'Could not access camera.', 'Kamerazugriff fehlgeschlagen.')
          );
        }
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [_t, activeTab, handleParsedQrString, stopCamera]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    const decoded = await scanQrFromSource(file);
    if (!decoded) {
      setErrorMessage(
        _t(
          'لم يتم العثور على رمز QR صالح في هذه الصورة.',
          'Could not detect a valid QR code in this image.',
          'Kein gültiger QR-Code im Bild gefunden.'
        )
      );
      return;
    }
    await handleParsedQrString(decoded);
  };

  const handleCopy = (key: string, val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const activePin = hostStatus?.brokerConnected && hostStatus?.pin ? hostStatus.pin : '';
  const qrSvg = activePin
    ? generateQrSvg(createPairingPayload(localDevice.id, localDevice.name, activePin), 192)
    : '';

  const tabItems: Array<{ key: PairingTab; label: string; icon: any }> = [
    { key: 'enter_pin', label: _t('إدخال الرمز / القريبة', 'Enter PIN & Nearby', 'PIN & In der Nähe'), icon: Keyboard },
    { key: 'show_qr', label: _t('عرض QR والرمز', 'Show QR / Code', 'QR & Code zeigen'), icon: QrCode },
    ...(cameraSupported
      ? [{ key: 'scan_camera' as PairingTab, label: _t('مسح بالكاميرا', 'Scan Camera', 'Kamera-Scan'), icon: Camera }]
      : []),
    { key: 'upload_image', label: _t('صورة QR', 'Upload QR', 'QR-Bild'), icon: ImageIcon }
  ];

  return (
    <div id={id} className="space-y-4">
      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border overflow-x-auto no-scrollbar">
        {tabItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveTab(key);
              setErrorMessage(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === key
                ? 'bg-surface text-primary border border-surface-border shadow-2xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: ENTER 6-DIGIT PIN & NEARBY SAME-ACCOUNT DEVICES */}
      {activeTab === 'enter_pin' && (
        <div className="space-y-4">
          {/* Discovered Unpaired Same-Account Devices */}
          <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-text-main flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-primary" />
                  <span>{_t('أجهزتك المتصلة الآن', 'Nearby Account Devices', 'Geräte im selben Konto')}</span>
                </h3>
                <p className="text-xs text-text-muted">
                  {roomState?.status === 'signed_out'
                    ? _t(
                        'سجّل الدخول بحساب Google لاكتشاف أجهزتك تلقائياً، أو أدخل الرمز السداسي أدناه مباشرة.',
                        'Sign in with Google for automatic device discovery, or enter a 6-digit PIN below.',
                        'Für automatische Erkennung mit Google anmelden, oder 6-stelligen Code eingeben.'
                      )
                    : _t(
                        'اختر جهازاً متصلاً وأدخل رمز الاقتران الظاهر عليه (بدون عنوان IP).',
                        'Select an online device and enter its 6-digit code — no IP or port needed.',
                        'Gerät wählen und 6-stelligen Code eingeben (ohne IP/Port).'
                      )}
                </p>
              </div>
              {onRefreshHostStatus && (
                <button
                  type="button"
                  onClick={onRefreshHostStatus}
                  className="p-2 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-text-muted hover:text-primary cursor-pointer shrink-0"
                  title={_t('تحديث', 'Refresh', 'Aktualisieren')}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {discoveredUnpaired.length > 0 ? (
              <div className="divide-y divide-surface-border rounded-xl border border-surface-border overflow-hidden">
                {discoveredUnpaired.map((dev) => {
                  const isSelected = targetDeviceId === dev.deviceId;
                  const secsAgo = Math.max(0, Math.floor((Date.now() - dev.lastSeen) / 1000));
                  return (
                    <div
                      key={dev.deviceId}
                      className={`p-3 flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-primary-soft' : 'bg-background'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-surface border border-surface-border flex items-center justify-center text-primary shrink-0">
                          {dev.platform === 'android' ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-text-main truncate">{dev.deviceName}</div>
                          <div className="text-[11px] text-text-muted tabular-nums">
                            {dev.platform === 'android' ? 'Android' : 'Web'} ·{' '}
                            {secsAgo < 5
                              ? _t('متصل الآن', 'Online now', 'Jetzt online')
                              : _t(`آخر ظهور منذ ${secsAgo}ث`, `Last seen ${secsAgo}s ago`, `Vor ${secsAgo}s gesehen`)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetDeviceId(dev.deviceId);
                          setTargetDeviceName(dev.deviceName);
                          setErrorMessage(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-primary text-primary-fg'
                            : 'bg-surface border border-surface-border text-primary hover:bg-surface-hover'
                        }`}
                      >
                        {isSelected ? _t('محدد', 'Selected', 'Gewählt') : _t('اتصال', 'Connect', 'Verbinden')}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-text-muted py-1">
                {roomState?.status === 'signed_out'
                  ? _t('الاكتشاف التلقائي غير نشط قبل تسجيل الدخول.', 'Auto-discovery inactive while signed out.', 'Automatische Suche abgemeldet inaktiv.')
                  : _t('لم يظهر جهاز جديد غير مقترن بعد — يمكنك الإقران باستخدام رمز 6 أرقام أدناه.', 'No unpaired devices visible yet — enter the 6-digit code below.', 'Noch keine neuen Geräte sichtbar — 6-stelligen Code unten eingeben.')}
              </div>
            )}
          </div>

          {/* 6-Digit Code Form */}
          <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
            {targetDeviceId && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary-soft border border-primary/20 text-xs">
                <span className="font-semibold text-text-main truncate">
                  {_t('استهداف مباشر:', 'Target device:', 'Zielgerät:')}{' '}
                  <strong>{targetDeviceName || targetDeviceId.slice(0, 12)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetDeviceId('');
                    setTargetDeviceName('');
                  }}
                  className="text-text-muted hover:text-text-main cursor-pointer"
                  aria-label="Clear target device"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1">
                  {_t('رمز الاقتران (6 أرقام)', '6-Digit Pairing Code', '6-stelliger Kopplungscode')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErrorMessage(null);
                  }}
                  placeholder="123456"
                  className="w-full px-3 py-2 rounded-xl border border-surface-border bg-background text-base font-mono font-bold tracking-[0.22em] text-text-main tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="button"
                onClick={() => handleConnect()}
                disabled={isPairing || pinInput.replace(/\D/g, '').length !== 6}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                {isPairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{isPairing ? _t('جاري الاتصال...', 'Connecting...', 'Verbinde...') : _t('ربط وحفظ', 'Connect & Pair', 'Koppeln & Speichern')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SHOW THIS DEVICE'S QR & 10-MINUTE SINGLE-USE PIN */}
      {activeTab === 'show_qr' && (
        <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-4">
          {!hostStatus?.brokerConnected ? (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>
                  {hostStatus?.errorCode === 'ID_IN_USE'
                    ? _t('معرّف هذا الجهاز مستخدم في جلسة أخرى.', 'Device signalling ID is already held by another session.', 'Geräte-ID bereits in anderer Sitzung aktiv.')
                    : hostStatus?.errorCode === 'BROKER_DOWN'
                    ? _t('خادم الإشارة WebRTC غير متاح حالياً.', 'Signalling server is currently unreachable.', 'Signalisierungsserver nicht erreichbar.')
                    : _t('جاري الاتصال بخادم الإشارة WebRTC...', 'Connecting to WebRTC signalling server...', 'Verbinde mit WebRTC-Signalisierung...')}
                </span>
              </div>
              {hostStatus?.errorMessage && <p className="opacity-90">{hostStatus.errorMessage}</p>}
              {onRefreshHostStatus && (
                <button
                  type="button"
                  onClick={onRefreshHostStatus}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{_t('إعادة المحاولة', 'Retry Connection', 'Erneut versuchen')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {qrSvg && (
                <div
                  className="p-2 rounded-2xl bg-white border border-surface-border shrink-0 shadow-xs"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              )}

              <div className="flex-1 space-y-3 text-center sm:text-start">
                <div>
                  <div className="text-[11px] font-bold text-primary uppercase tracking-wider">
                    {_t('رمز الاقتران المباشر (صالح لمرة واحدة)', 'Single-Use P2P Pairing Code', 'Einmaliger P2P-Kopplungscode')}
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <span className="font-mono text-3xl font-black tracking-[0.2em] text-text-main tabular-nums">
                      {secondsLeft > 0 ? activePin : '------'}
                    </span>
                    {activePin && secondsLeft > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCopy('pin', activePin)}
                        className="p-1.5 rounded-lg bg-background border border-surface-border text-text-muted hover:text-primary cursor-pointer"
                        title={_t('نسخ الرمز', 'Copy Code', 'Code kopieren')}
                      >
                        {copiedKey === 'pin' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-text-muted tabular-nums">
                  {secondsLeft > 0
                    ? _t(
                        `ينتهي خلال ${formatCountdown(secondsLeft)} — امسح QR أو أدخل الرمز على الجهاز الآخر.`,
                        `Expires in ${formatCountdown(secondsLeft)} — scan QR or enter this PIN on your other device.`,
                        `Läuft in ${formatCountdown(secondsLeft)} ab.`
                      )
                    : _t(
                        'انتهت صلاحية الرمز — اضغط لإنشاء رمز جديد.',
                        'Code expired — tap to generate a new one.',
                        'Code abgelaufen — tippen Sie für einen neuen Code.'
                      )}
                </p>

                {onRegenerateCode && (
                  <button
                    type="button"
                    onClick={onRegenerateCode}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{_t('رمز جديد', 'New Code', 'Neuer Code')}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CAMERA QR SCANNER */}
      {activeTab === 'scan_camera' && (
        <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
          {cameraError ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs">
              {cameraError}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-64 mx-auto flex items-center justify-center">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                {!isScanningCamera && (
                  <span className="absolute text-xs text-white/80 font-semibold">
                    {_t('جاري تشغيل الكاميرا...', 'Starting camera...', 'Kamera startet...')}
                  </span>
                )}
              </div>
              <p className="text-center text-xs text-text-muted">
                {_t('وجّه الكاميرا نحو رمز QR الظاهر في الجهاز الآخر.', 'Point camera at the QR code on the other device.', 'Kamera auf den QR-Code richten.')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: UPLOAD QR IMAGE */}
      {activeTab === 'upload_image' && (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-6 text-center space-y-3">
          <ImageIcon className="w-8 h-8 text-primary mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-text-main">
              {_t('اختر صورة لرمز QR', 'Upload QR Screenshot / Image', 'QR-Bild hochladen')}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {_t('تُقرأ محلياً دون رفع أي ملفات للإنترنت.', 'Decoded offline in browser via jsQR.', 'Lokal im Browser entschlüsselt.')}
            </p>
          </div>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-bold cursor-pointer">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{_t('اختيار صورة', 'Select Image', 'Bild wählen')}</span>
            <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
          </label>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
