import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  QrCode, KeyRound, Copy, Check, RefreshCw, AlertCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, Smartphone, Camera, 
  UploadCloud, FlipHorizontal, AlertTriangle, X, Sparkles, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { generateQrSvg, createPairingPayload, parsePairingPayload, scanQrFromSource, hasNativeBarcodeDetector } from '../../services/sync/qrCodeService';
import { useApp } from '../../context/AppContext';

interface PairingWizardProps {
  localPin: string;
  localDevice?: { name: string; id: string };
  onPair: (targetIdentifier: string, pin?: string) => Promise<void>;
  onClose?: () => void;
  id?: string;
}

export const PairingWizard: React.FC<PairingWizardProps> = ({
  localPin,
  localDevice,
  onPair,
  id
}) => {
  const { _t } = useApp();
  const [activeTab, setActiveTab] = useState<'show_qr' | 'scan_camera' | 'upload_img' | 'code'>('show_qr');
  const [pinInput, setPinInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingState, setPairingState] = useState<'waiting' | 'verifying' | 'connected' | 'failed'>('waiting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 min TTL countdown
  
  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedSuccessData, setScannedSuccessData] = useState<{ deviceName: string; pin: string; deviceId?: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDecodingFile, setIsDecodingFile] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sound feedback on successful scan
  const playScanBeep = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        }
      }
    } catch (_) {}
  }, []);

  // Haptic feedback
  const triggerHaptic = useCallback(async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (_) {}
  }, []);

  // Countdown timer for pairing code validity
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyPin = () => {
    if (localPin) {
      navigator.clipboard.writeText(localPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  // Connect handler
  const handleConnect = async (targetCode: string, targetId?: string) => {
    const cleaned = targetCode.trim();
    if (!cleaned || cleaned.length < 6) return;

    setIsPairing(true);
    setPairingState('verifying');
    setErrorMessage(null);

    try {
      // If we have targetId from QR payload, pass targetCode (PIN) and targetId
      await onPair(cleaned, cleaned);
      setPairingState('connected');
    } catch (err: any) {
      setPairingState('failed');
      setErrorMessage(err?.message || 'Failed to establish mutual trust with peer');
    } finally {
      setIsPairing(false);
    }
  };

  // Stop Camera Stream helper
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Start Camera Stream helper
  const startCamera = useCallback(async (facing: 'environment' | 'user' = cameraFacing) => {
    stopCamera();
    setCameraError(null);
    setScannedSuccessData(null);

    if (!hasNativeBarcodeDetector()) {
      setCameraError('Live camera QR scanning is not supported on this platform/browser. Please enter the 6-Digit PIN or upload a QR image.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported on this platform. Please upload a QR image or enter the PIN manually.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);

        // Start scanning loop (every 140ms)
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || isPairing) return;

          try {
            const rawQr = await scanQrFromSource(videoRef.current);
            if (rawQr) {
              const parsed = parsePairingPayload(rawQr);
              if (parsed.valid && parsed.payload) {
                stopCamera();
                playScanBeep();
                triggerHaptic();

                if (parsed.expired) {
                  setErrorMessage('The scanned QR code has expired (>10 mins old). Please request a fresh code.');
                  setPairingState('failed');
                  return;
                }

                setScannedSuccessData({
                  deviceName: parsed.payload.deviceName,
                  pin: parsed.payload.pin,
                  deviceId: parsed.payload.deviceId
                });
                setPinInput(parsed.payload.pin);

                // Automatically initiate pairing with validated PIN & DeviceId
                handleConnect(parsed.payload.pin, parsed.payload.deviceId);
              }
            }
          } catch (e) {
            // Non-fatal frame decode errors
          }
        }, 140);
      }
    } catch (err: any) {
      console.warn('[Camera] Failed to initialize video feed:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please enable camera access in your browser or device settings.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can upload a QR image or enter the 6-digit PIN below.');
      } else {
        setCameraError(`Unable to start camera (${err?.message || 'Unknown error'}). Try uploading an image.`);
      }
      setCameraActive(false);
    }
  }, [cameraFacing, isPairing, stopCamera, playScanBeep, triggerHaptic]);

  // Toggle Camera Facing
  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (cameraActive) {
      startCamera(nextFacing);
    }
  };

  // Decode from file / image upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsDecodingFile(true);
    setErrorMessage(null);
    setScannedSuccessData(null);

    try {
      const rawQr = await scanQrFromSource(file);
      if (!rawQr) {
        setErrorMessage('No valid QR code was detected in the uploaded image. Please ensure the code is clear and uncropped.');
        setPairingState('failed');
        return;
      }

      const parsed = parsePairingPayload(rawQr);
      if (!parsed.valid || !parsed.payload) {
        setErrorMessage(parsed.error || 'The QR code format is not recognized.');
        setPairingState('failed');
        return;
      }

      if (parsed.expired) {
        setErrorMessage('The scanned QR code has expired (>10 mins old). Please request a fresh code.');
        setPairingState('failed');
        return;
      }

      playScanBeep();
      triggerHaptic();
      setScannedSuccessData({
        deviceName: parsed.payload.deviceName,
        pin: parsed.payload.pin,
        deviceId: parsed.payload.deviceId
      });
      setPinInput(parsed.payload.pin);

      // Connect automatically
      handleConnect(parsed.payload.pin, parsed.payload.deviceId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process QR image.');
      setPairingState('failed');
    } finally {
      setIsDecodingFile(false);
    }
  };

  // Lifecycle for tab switches
  useEffect(() => {
    if (activeTab === 'scan_camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, startCamera, stopCamera]);

  // Generate standardized pairing payload
  const currentDeviceId = localDevice?.id || 'dev_primary';
  const currentDeviceName = localDevice?.name || 'Local Teacher Device';
  const pairingPayloadString = createPairingPayload(currentDeviceId, currentDeviceName, localPin || '000000', 2);
  const realQrSvg = generateQrSvg(pairingPayloadString, 200);
  const qrSvgUrl = realQrSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(realQrSvg)}` : null;

  return (
    <div id={id} className="rounded-2xl border border-surface-border bg-surface p-4 sm:p-6 shadow-xs">
      {/* Navigation Method Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl bg-background p-1.5 mb-6 border border-surface-border">
        <button
          type="button"
          onClick={() => setActiveTab('show_qr')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'show_qr'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>{_t('رمز QR الخاص بي', 'My QR Code', 'Mein QR-Code')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scan_camera')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'scan_camera'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>{_t('مسح بالكاميرا', 'Scan Camera', 'Kamera-Scan')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload_img')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'upload_img'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>{_t('رفع صورة QR', 'Upload Image', 'Bild hochladen')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'code'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>{_t('رمز PIN يدوي', 'Manual PIN', 'PIN-Eingabe')}</span>
        </button>
      </div>

      {/* VIEW 1: MY QR CODE BROADCAST */}
      {activeTab === 'show_qr' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-background border border-surface-border text-center">
            <div className="space-y-4">
              <div className="relative inline-block p-3.5 bg-white rounded-2xl shadow-xs border border-surface-border">
                {qrSvgUrl ? (
                  <img 
                    src={qrSvgUrl} 
                    alt="Pairing QR Code" 
                    className="w-40 h-40 sm:w-44 sm:h-44 mx-auto rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-40 h-40 sm:w-44 sm:h-44 mx-auto rounded-xl bg-gray-100 flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-primary text-white p-2 rounded-xl shadow-md border-2 border-white">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{_t('وجّه الكاميرا أو الماسح الضوئي', 'Point Camera or Scanner', 'Kamera ausrichten')}</p>
                <p className="text-sm font-bold text-text-main mt-0.5">
                  {_t('امسح هذا الرمز من جهازك الآخر لإقرانه فوراً', 'Scan this code on your second device', 'Diesen Code mit dem zweiten Gerät scannen')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-xs text-text-muted">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>{_t('يتجدد تلقائياً خلال', 'Refreshes in', 'Erneuert sich in')} <strong className="font-mono font-bold text-text-main">{formatTime(timeLeft)}</strong></span>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-4">
            <div className="p-4 rounded-2xl bg-primary-soft border border-primary/20">
              <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>{_t('مصافحة مباشرة ومشفرة (P2P Mesh)', 'Instant P2P Handshake', 'Direkte P2P-Verschlüsselung')}</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {_t('مسح هذا الرمز يوثق الجهازين محلياً ويؤسس قناة اتصال مشفرة ثنائية دون الحاجة لخوادم وسيطة.', 'Scanning this QR securely registers your permanent device ID in the WebRTC mesh and establishes bilateral encryption.', 'Sichere Registrierung und bilaterale Ende-zu-Ende-Verschlüsselung.')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-surface-border">
              <div className="text-[10px] font-black text-text-muted uppercase tracking-wider">{_t('رمز PIN البديل للأمان', 'Fallback Security PIN', 'Sicherheits-PIN')}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-2xl font-black tracking-widest text-primary">
                  {localPin || '------'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-text-main bg-surface border border-surface-border rounded-xl hover:bg-surface-hover transition-colors shadow-xs cursor-pointer"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-text-muted" />}
                  <span>{copiedPin ? _t('تم النسخ', 'Copied', 'Kopiert') : _t('نسخ الرمز', 'Copy PIN', 'PIN kopieren')}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('scan_camera')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{_t('أو افتح الكاميرا لمسح رمز الجهاز الآخر', 'Or Scan Companion\'s QR', 'Oder QR-Code des Partnergeräts scannen')}</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: LIVE CAMERA SCANNER */}
      {activeTab === 'scan_camera' && (
        <div className="space-y-4">
          <div className="relative w-full aspect-4/3 sm:aspect-16/9 max-h-[340px] bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-inner flex flex-col items-center justify-center">
            {/* Live Video */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
            />

            {/* Viewfinder Target Frame Overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />

                  {/* Pulsing laser line */}
                  <motion.div
                    animate={{ y: [0, 190, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  />
                </div>
              </div>
            )}

            {/* Error or Loading State Overlay */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-gray-950/90 z-10">
                {cameraError ? (
                  <div className="space-y-3 max-w-sm">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-white">{_t('الكاميرا غير متاحة', 'Camera Unavailable', 'Kamera nicht verfügbar')}</h4>
                    <p className="text-xs text-gray-300">{cameraError}</p>
                    <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setActiveTab('code')}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold"
                      >
                        {_t('إدخال PIN من 6 أرقام', 'Enter 6-Digit PIN', '6-stelligen PIN eingeben')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('upload_img')}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold"
                      >
                        {_t('رفع صورة QR', 'Upload QR File', 'QR-Datei hochladen')}
                      </button>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-xs font-bold"
                      >
                        {_t('إعادة المحاولة', 'Try Again', 'Erneut versuchen')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-xs text-gray-300">{_t('جارٍ تشغيل تغذية الكاميرا...', 'Initializing camera feed...', 'Kamera wird initialisiert...')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Top Toolbar Controls */}
            {cameraActive && (
              <div className="absolute top-3 right-3 rtl:left-3 rtl:right-auto flex items-center gap-2 z-20">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-xs border border-white/10 transition-colors cursor-pointer"
                  title="Switch Camera (Front/Back)"
                  aria-label="Switch Camera"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{_t('وجّه الكاميرا نحو رمز QR على الجهاز الآخر', 'Align companion QR code within the frame', 'Partner-QR-Code im Rahmen ausrichten')}</span>
            <button
              type="button"
              onClick={() => setActiveTab('upload_img')}
              className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{_t('أو ارفع صورة بدلاً من ذلك', 'Upload Image instead', 'Bild stattdessen hochladen')}</span>
            </button>
          </div>

          {/* Verification Status */}
          <AnimatePresence mode="wait">
            {scannedSuccessData && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">{_t('تم التعرف على رمز QR بنجاح!', 'QR Code Recognized!', 'QR-Code erkannt!')}</span>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    {_t('جارٍ الاقتران بالجهاز', 'Pairing with', 'Kopplung mit')} <strong>{scannedSuccessData.deviceName}</strong> (PIN: {scannedSuccessData.pin})...
                  </p>
                </div>
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
              </motion.div>
            )}

            {pairingState === 'failed' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-xs text-red-700 dark:text-red-400"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span className="flex-1">{errorMessage || _t('فشلت المصافحة وتأكيد الثقة.', 'Pairing handshake failed.', 'Kopplungs-Handshake fehlgeschlagen.')}</span>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-800 dark:text-red-300 font-bold cursor-pointer"
                >
                  {_t('إعادة المحاولة', 'Retry', 'Erneut versuchen')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* VIEW 3: UPLOAD / DRAG & DROP QR IMAGE */}
      {activeTab === 'upload_img' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-3 ${
              isDragOver
                ? 'border-primary bg-primary-soft'
                : 'border-surface-border hover:border-primary/50 bg-background'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center border border-primary/20 shadow-xs">
              {isDecodingFile ? (
                <RefreshCw className="w-7 h-7 animate-spin" />
              ) : (
                <ImageIcon className="w-7 h-7" />
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold text-text-main">
                {isDecodingFile ? _t('جارٍ فك تشفير صورة QR...', 'Decoding QR Code Image...', 'QR-Bild wird dekodiert...') : _t('انقر لرفع صورة رمز QR أو اسحبها هنا', 'Click to Upload or Drag & Drop QR Image', 'Klicken zum Hochladen oder QR-Bild hierher ziehen')}
              </h4>
              <p className="text-xs text-text-muted mt-1 max-w-sm">
                {_t('اختر لقطة شاشة، صورة محفوظة، أو مستند QR من هاتفك أو حاسوبك.', 'Select a screenshot, photo, or saved QR code image from your desktop or phone gallery.', 'Wählen Sie einen Screenshot oder ein gespeichertes QR-Bild.')}
              </p>
            </div>

            <button
              type="button"
              className="mt-2 px-4 py-2 bg-surface border border-surface-border rounded-xl text-xs font-bold text-text-main shadow-xs hover:bg-surface-hover cursor-pointer"
            >
              {_t('استعراض الملفات', 'Browse Files', 'Dateien durchsuchen')}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {pairingState === 'failed' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-xs text-red-700 dark:text-red-400"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{errorMessage || _t('تعذر قراءة أو فك تشفير رمز QR من الصورة.', 'Failed to decode or connect from image', 'QR-Code konnte nicht aus dem Bild dekodiert werden')}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* VIEW 4: MANUAL 6-DIGIT PIN ENTRY */}
      {activeTab === 'code' && (
        <div className="max-w-md mx-auto py-2 space-y-4">
          <div className="text-center">
            <h4 className="text-base font-bold text-text-main">{_t('أدخل رمز الأمان المكون من 6 أرقام', 'Enter Companion Security PIN', 'Sicherheits-PIN des Partnergeräts eingeben')}</h4>
            <p className="text-xs text-text-muted mt-1">
              {_t('اكتب الكود الظاهر على شاشة الجهاز الآخر لإتمام الاقتران وتوثيقه.', 'Type the 6-digit code displayed on the companion screen to complete trust establishment.', 'Geben Sie den 6-stelligen PIN des anderen Bildschirms ein.')}
            </p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleConnect(pinInput);
            }} 
            className="space-y-4"
          >
            <div>
              <label htmlFor="pairing-pin-input" className="sr-only">6-Digit Device PIN</label>
              <input
                id="pairing-pin-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (errorMessage) setErrorMessage(null);
                  if (pairingState !== 'waiting') setPairingState('waiting');
                }}
                className="w-full text-center tracking-widest font-mono text-3xl font-black py-3.5 px-4 rounded-2xl border border-surface-border bg-background text-text-main focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                maxLength={6}
                required
              />
            </div>

            <AnimatePresence mode="wait">
              {pairingState === 'verifying' && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3.5 bg-primary-soft text-primary border border-primary/20 rounded-2xl text-xs font-bold"
                >
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-primary" />
                  <span>{_t('جارٍ الاتصال بجهاز الزميل والتحقق من مصافحة الأمان...', 'Connecting to peer node & verifying pairing handshake...', 'Verbindung zum Knoten wird hergestellt & verifiziert...')}</span>
                </motion.div>
              )}

              {pairingState === 'connected' && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3.5 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20 rounded-2xl text-xs font-bold"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{_t('تم إقران وتوثيق الجهاز بنجاح!', 'Device successfully paired and trusted!', 'Gerät erfolgreich gekoppelt und vertraut!')}</span>
                </motion.div>
              )}

              {pairingState === 'failed' && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3.5 bg-red-500/10 text-red-800 dark:text-red-200 border border-red-500/20 rounded-2xl text-xs font-bold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage || _t('فشل الاتصال', 'Connection failed', 'Verbindung fehlgeschlagen')}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isPairing || pinInput.length < 6}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary text-white font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              {isPairing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{_t('جارٍ إنشاء الاتصال...', 'Establishing Connection...', 'Verbindung wird aufgebaut...')}</span>
                </>
              ) : (
                <>
                  <span>{_t('إقران وتوثيق الجهاز الآن', 'Pair & Trust Device', 'Gerät koppeln')}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

