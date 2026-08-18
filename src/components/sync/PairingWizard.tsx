import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  QrCode, KeyRound, Copy, Check, RefreshCw, AlertCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, Smartphone, Camera, 
  UploadCloud, FlipHorizontal, AlertTriangle, X, Sparkles, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { generateQrSvg, createPairingPayload, parsePairingPayload, scanQrFromSource, hasNativeBarcodeDetector } from '../../services/sync/qrCodeService';

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
  const qrSvgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(realQrSvg)}`;

  return (
    <div id={id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-sm">
      {/* Navigation Method Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-800/80 p-1.5 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('show_qr')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'show_qr'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>My QR Code</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scan_camera')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'scan_camera'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Camera className="w-3.5 h-3.5 text-indigo-500" />
          <span>Scan Camera</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload_img')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'upload_img'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload Image</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'code'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Manual PIN</span>
        </button>
      </div>

      {/* VIEW 1: MY QR CODE BROADCAST */}
      {activeTab === 'show_qr' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100/60 dark:from-gray-800/40 dark:to-gray-800/80 border border-gray-200 dark:border-gray-700/60 text-center">
            <div className="space-y-4">
              <div className="relative inline-block p-3 bg-white rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                <img 
                  src={qrSvgUrl} 
                  alt="Pairing QR Code" 
                  className="w-40 h-40 sm:w-44 sm:h-44 mx-auto rounded-lg"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Point Camera or Scanner</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                  Scan this code on your second device
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Refreshes in <strong className="font-mono font-bold text-gray-700 dark:text-gray-200">{formatTime(timeLeft)}</strong></span>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-4">
            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-xs uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Instant P2P Handshake</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Scanning this QR securely registers your permanent device ID in the WebRTC mesh and establishes bilateral encryption.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fallback Security PIN</div>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-2xl font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
                  {localPin || '------'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPin ? 'Copied' : 'Copy PIN'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('scan_camera')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-sm"
            >
              <Camera className="w-4 h-4" />
              <span>Or Scan Companion's QR</span>
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
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Pulsing laser line */}
                  <motion.div
                    animate={{ y: [0, 190, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(52,211,153,0.8)]"
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
                    <h4 className="text-sm font-semibold text-white">Camera Unavailable</h4>
                    <p className="text-xs text-gray-300">{cameraError}</p>
                    <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setActiveTab('code')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Enter 6-Digit PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('upload_img')}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Upload QR File
                      </button>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                    <span className="text-xs text-gray-300">Initializing camera feed...</span>
                  </div>
                )}
              </div>
            )}

            {/* Top Toolbar Controls */}
            {cameraActive && (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-xs border border-white/10 transition-colors"
                  title="Switch Camera (Front/Back)"
                  aria-label="Switch Camera"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Align companion QR code within the frame</span>
            <button
              type="button"
              onClick={() => setActiveTab('upload_img')}
              className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Image instead</span>
            </button>
          </div>

          {/* Verification Status */}
          <AnimatePresence mode="wait">
            {scannedSuccessData && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200">QR Code Recognized!</span>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Pairing with <strong>{scannedSuccessData.deviceName}</strong> (PIN: {scannedSuccessData.pin})...
                  </p>
                </div>
                <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
              </motion.div>
            )}

            {pairingState === 'failed' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span className="flex-1">{errorMessage || 'Pairing handshake failed.'}</span>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-2 py-1 bg-red-100 dark:bg-red-900/60 rounded text-red-900 dark:text-red-200 font-semibold"
                >
                  Retry
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
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 bg-gray-50/60 dark:bg-gray-800/40'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              {isDecodingFile ? (
                <RefreshCw className="w-7 h-7 animate-spin" />
              ) : (
                <ImageIcon className="w-7 h-7" />
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {isDecodingFile ? 'Decoding QR Code Image...' : 'Click to Upload or Drag & Drop QR Image'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                Select a screenshot, photo, or saved QR code image from your desktop or phone gallery.
              </p>
            </div>

            <button
              type="button"
              className="mt-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-xs hover:bg-gray-50"
            >
              Browse Files
            </button>
          </div>

          <AnimatePresence mode="wait">
            {pairingState === 'failed' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage || 'Failed to decode or connect from image'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* VIEW 4: MANUAL 6-DIGIT PIN ENTRY */}
      {activeTab === 'code' && (
        <div className="max-w-md mx-auto py-2 space-y-4">
          <div className="text-center">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Enter Companion Security PIN</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Type the 6-digit code displayed on the companion screen to complete trust establishment.
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
                className="w-full text-center tracking-widest font-mono text-3xl font-bold py-3.5 px-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
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
                  className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-xl text-xs"
                >
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-blue-600" />
                  <span>Connecting to peer node & verifying pairing handshake...</span>
                </motion.div>
              )}

              {pairingState === 'connected' && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Device successfully paired and trusted!</span>
                </motion.div>
              )}

              {pairingState === 'failed' && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-xl text-xs"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage || 'Connection failed'}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isPairing || pinInput.length < 6}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isPairing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Establishing Connection...</span>
                </>
              ) : (
                <>
                  <span>Pair & Trust Device</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

