import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Toast } from '@capacitor/toast';

/**
 * Cross-Platform German Text-To-Speech Utility
 * Fully offline-capable for Android APK (Capacitor Native TTS),
 * Web Speech API (window.speechSynthesis), and Linux/Desktop environments.
 */

let isAudioUnlocked = false;
let isNativeTtsAvailable: boolean | null = null;
let cachedGermanVoice: SpeechSynthesisVoice | null = null;

// Audio unlocker for mobile WebViews restricted media autoplay
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (isAudioUnlocked) return;
    try {
      const silentAudio = new Audio(
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
      );
      silentAudio.volume = 0.01;
      silentAudio
        .play()
        .then(() => {
          isAudioUnlocked = true;
          cleanupListeners();
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  };

  const cleanupListeners = () => {
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('pointerdown', unlockAudio);
  };

  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
}

// Preload Web Speech API voices if available
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        cachedGermanVoice =
          voices.find((v) => v.lang === 'de-DE' || v.lang === 'de_DE') ||
          voices.find((v) => v.lang.startsWith('de')) ||
          null;
      }
    } catch {
      // ignore
    }
  };

  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

/**
 * Immediately stop any active speech to prevent voice overlap when moving to the next word
 */
export const stopGermanSpeech = async () => {
  if (typeof window === 'undefined') return;

  // Stop native Capacitor TTS if active
  try {
    await TextToSpeech.stop();
  } catch {
    // ignore if not native
  }

  // Stop Web Speech API if active
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
};

/**
 * Primary function to pronounce German text automatically and offline.
 * Full support for German umlauts and special characters: ä, ö, ü, ß.
 * Rate defaults to clear natural speed (0.85).
 */
export const speakGermanText = async (text: string, rate: number = 0.85) => {
  if (!text || typeof window === 'undefined') return;

  const cleanText = text.trim();
  if (!cleanText) return;

  // Prevent overlapping speech
  await stopGermanSpeech();

  const isCapacitorNative =
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:';

  // 1. Native Android/iOS Offline TTS via Capacitor TextToSpeech Plugin
  if (isCapacitorNative || isNativeTtsAvailable !== false) {
    try {
      await TextToSpeech.speak({
        text: cleanText,
        lang: 'de-DE',
        rate: Math.min(Math.max(rate, 0.4), 1.5),
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
      isNativeTtsAvailable = true;
      return;
    } catch (err: any) {
      console.warn('Native Capacitor TextToSpeech attempt failed, trying Web Speech API:', err);
      if (isCapacitorNative) {
        isNativeTtsAvailable = false;
      }
    }
  }

  // 2. Web Speech API Fallback (for Web browsers or desktop builds)
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'de-DE';
      utterance.rate = Math.min(Math.max(rate, 0.4), 1.5);
      utterance.volume = 1.0;

      if (cachedGermanVoice) {
        utterance.voice = cachedGermanVoice;
      } else {
        const voices = window.speechSynthesis.getVoices();
        const foundVoice =
          voices.find((v) => v.lang === 'de-DE' || v.lang === 'de_DE') ||
          voices.find((v) => v.lang.startsWith('de'));
        if (foundVoice) {
          cachedGermanVoice = foundVoice;
          utterance.voice = foundVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
      return;
    } catch (err) {
      console.warn('Web SpeechSynthesis invocation failed:', err);
    }
  }

  // 3. Graceful Device Requirement Toast Notice if TTS unavailable
  showTtsMissingWarning();
};

/**
 * Helper function to pronounce German text at a slower speed (0.6x)
 */
export const speakGermanTextSlow = (text: string) => {
  speakGermanText(text, 0.6);
};

let lastToastTime = 0;
const showTtsMissingWarning = async () => {
  const now = Date.now();
  if (now - lastToastTime < 5000) return;
  lastToastTime = now;

  try {
    await Toast.show({
      text: 'مطلوب تفعيل حزمة الصوت الألماني في إعدادات Android (Text-to-Speech Settings)',
      duration: 'long',
      position: 'bottom',
    });
  } catch {
    console.warn('German TTS voice pack not found on device.');
  }
};
