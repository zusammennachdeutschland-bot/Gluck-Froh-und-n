import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Toast } from '@capacitor/toast';

/**
 * Cross-Platform German Text-To-Speech Utility
 * Supports Native Android/iOS (Capacitor), Web Speech API, and HTML5 Audio fallback (Vercel & Mobile Web).
 */

let isAudioUnlocked = false;
let cachedGermanVoice: SpeechSynthesisVoice | null = null;
let activeAudio: HTMLAudioElement | null = null;

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
 * HTML5 Audio Fallback via Google Translate TTS for 100% reliable web pronunciation
 */
const playAudioFallback = (cleanText: string, rate: number = 0.85): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        cleanText
      )}&tl=de&client=tw-ob`;
      const audio = new Audio(ttsUrl);
      activeAudio = audio;
      audio.playbackRate = Math.min(Math.max(rate, 0.5), 1.5);
      audio.onended = () => {
        activeAudio = null;
        resolve(true);
      };
      audio.onerror = () => {
        activeAudio = null;
        resolve(false);
      };
      audio.play().catch((err) => {
        console.warn('HTML5 Audio fallback play error:', err);
        activeAudio = null;
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
};

/**
 * Immediately stop any active speech to prevent voice overlap
 */
export const stopGermanSpeech = async () => {
  if (typeof window === 'undefined') return;

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }

  // Stop native Capacitor TTS if active
  try {
    await TextToSpeech.stop();
  } catch {
    // ignore
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
 * Primary function to pronounce German text automatically across all platforms (Native APK, Web, Vercel).
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
  if (isCapacitorNative) {
    try {
      await TextToSpeech.speak({
        text: cleanText,
        lang: 'de-DE',
        rate: Math.min(Math.max(rate, 0.4), 1.5),
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
      return;
    } catch (err: any) {
      console.warn('Native Capacitor TextToSpeech failed, attempting Web speech:', err);
    }
  }

  // 2. Web Speech API (for modern Web browsers)
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume();

      const voices = window.speechSynthesis.getVoices();
      const germanVoice =
        cachedGermanVoice ||
        voices.find((v) => v.lang === 'de-DE' || v.lang === 'de_DE') ||
        voices.find((v) => v.lang.startsWith('de'));

      if (germanVoice) {
        cachedGermanVoice = germanVoice;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'de-DE';
        utterance.rate = Math.min(Math.max(rate, 0.4), 1.5);
        utterance.volume = 1.0;
        utterance.voice = germanVoice;
        window.speechSynthesis.speak(utterance);
        return;
      }
    } catch (err) {
      console.warn('Web SpeechSynthesis invocation failed, falling back to HTML5 Audio:', err);
    }
  }

  // 3. Robust HTML5 Cloud Audio Fallback (Vercel & Mobile Web)
  const fallbackSuccess = await playAudioFallback(cleanText, rate);
  if (!fallbackSuccess) {
    showTtsMissingWarning();
  }
};

/**
 * Pronounces German text and returns a Promise that resolves when speaking completes.
 */
export const speakGermanTextAndWait = (text: string, rate: number = 0.85): Promise<void> => {
  return new Promise(async (resolve) => {
    if (!text || typeof window === 'undefined') {
      resolve();
      return;
    }

    const cleanText = text.trim();
    if (!cleanText) {
      resolve();
      return;
    }

    let isDone = false;
    const finish = () => {
      if (!isDone) {
        isDone = true;
        resolve();
      }
    };

    const timeoutMs = Math.min(Math.max(cleanText.length * 130 + 600, 2000), 6500);
    const safetyTimer = setTimeout(() => {
      finish();
    }, timeoutMs);

    await stopGermanSpeech();

    const isCapacitorNative =
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:';

    // 1. Native Capacitor TTS
    if (isCapacitorNative) {
      try {
        await TextToSpeech.speak({
          text: cleanText,
          lang: 'de-DE',
          rate: Math.min(Math.max(rate, 0.4), 1.5),
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });
        clearTimeout(safetyTimer);
        finish();
        return;
      } catch (err: any) {
        console.warn('Native Capacitor TextToSpeech attempt failed, trying Web Speech API:', err);
      }
    }

    // 2. Web Speech API
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        const voices = window.speechSynthesis.getVoices();
        const germanVoice =
          cachedGermanVoice ||
          voices.find((v) => v.lang === 'de-DE' || v.lang === 'de_DE') ||
          voices.find((v) => v.lang.startsWith('de'));

        if (germanVoice) {
          cachedGermanVoice = germanVoice;
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'de-DE';
          utterance.rate = Math.min(Math.max(rate, 0.4), 1.5);
          utterance.volume = 1.0;
          utterance.voice = germanVoice;

          utterance.onend = () => {
            clearTimeout(safetyTimer);
            finish();
          };

          utterance.onerror = () => {
            clearTimeout(safetyTimer);
            // try HTML5 audio fallback if utterance errored
            playAudioFallback(cleanText, rate).then(() => finish());
          };

          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch (err) {
        console.warn('Web SpeechSynthesis invocation failed:', err);
      }
    }

    // 3. HTML5 Audio Fallback
    await playAudioFallback(cleanText, rate);
    clearTimeout(safetyTimer);
    finish();
  });
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
