/**
 * Cross-Platform German Text-To-Speech Utility
 * Fully optimized for Android APK (Capacitor/WebView), Linux Desktop, Web & iOS Safari.
 */

let currentAudioElement: HTMLAudioElement | null = null;
let cachedGermanVoice: SpeechSynthesisVoice | null = null;
let isAudioUnlocked = false;

// Audio unlocker for Android WebView / Mobile browsers restricted media autoplay
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

// Preload German voice if Web Speech API is supported
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
 * Stop any active speech or audio output
 */
export const stopGermanSpeech = () => {
  if (typeof window === 'undefined') return;

  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudioElement = null;
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
};

/**
 * Primary function to speak German text with multi-tier fallback for Android APK, Linux & Web
 */
export const speakGermanText = (text: string, rate: number = 0.85) => {
  if (!text || typeof window === 'undefined') return;

  const cleanText = text.trim();
  if (!cleanText) return;

  stopGermanSpeech();

  let speechStarted = false;

  // Enforce local Web Speech API de-DE first
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

      utterance.onstart = () => {
        speechStarted = true;
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error, falling back to audio streaming:', e);
        if (!speechStarted) {
          playFallbackTts(cleanText, rate);
        }
      };

      window.speechSynthesis.speak(utterance);

      // Verify if synthesis actually started speaking within 200ms
      setTimeout(() => {
        if (!speechStarted) {
          playFallbackTts(cleanText, rate);
        }
      }, 200);

      return;
    } catch (err) {
      console.warn('SpeechSynthesis invocation failed:', err);
    }
  }

  // Fallback to HTML5 Audio TTS
  playFallbackTts(cleanText, rate);
};

/**
 * Helper function to speak German text at a slow, clear pace (0.6x)
 */
export const speakGermanTextSlow = (text: string) => {
  speakGermanText(text, 0.6);
};

/**
 * Robust Multi-Source Fallback Audio TTS player
 */
const playFallbackTts = (text: string, rate: number = 0.85) => {
  try {
    const encoded = encodeURIComponent(text);

    const isStandaloneApk =
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      !window.location.host;

    // Direct HTTPS endpoints strictly requested with sl=de & tl=de
    const sources = [
      `https://translate.googleapis.com/translate_tts?client=gtx&sl=de&tl=de&dt=t&q=${encoded}`,
      `https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`,
      `https://tts.quest/api/voice?text=${encoded}&language=de`
    ];

    if (!isStandaloneApk) {
      sources.push(`/api/tts?text=${encoded}&lang=de`);
    }

    let currentSourceIdx = 0;

    const tryNextSource = () => {
      if (currentSourceIdx >= sources.length) {
        console.warn('All TTS audio sources failed');
        return;
      }

      const url = sources[currentSourceIdx++];
      const audio = new Audio(url);
      currentAudioElement = audio;
      audio.playbackRate = Math.min(Math.max(rate, 0.5), 1.5);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`Audio playback error from source (${url}):`, err);
          tryNextSource();
        });
      }

      audio.onerror = () => {
        console.warn(`Audio load error from source (${url})`);
        tryNextSource();
      };
    };

    tryNextSource();
  } catch (e) {
    console.warn('Fallback TTS audio generation failed:', e);
  }
};


