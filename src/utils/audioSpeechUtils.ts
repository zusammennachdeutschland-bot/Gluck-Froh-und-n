/**
 * Cross-Platform German Text-To-Speech Utility
 * Optimized for Android Mobile Browsers, WebViews, iOS Safari and Desktop.
 */

let currentAudioElement: HTMLAudioElement | null = null;
let cachedGermanVoice: SpeechSynthesisVoice | null = null;

// Initialize and preload German voice on browser
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
    } catch (e) {
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
    } catch (e) {
      // ignore
    }
    currentAudioElement = null;
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore
    }
  }
};

/**
 * Primary function to speak German text with multi-level fallbacks for Android & Mobile Web
 */
export const speakGermanText = (text: string, rate: number = 0.85) => {
  if (!text || typeof window === 'undefined') return;

  const cleanText = text.trim();
  if (!cleanText) return;

  stopGermanSpeech();

  let speechAttempted = false;

  // Try Web Speech API if supported
  if ('speechSynthesis' in window) {
    try {
      // Resume SpeechSynthesis engine (vital for Android Chrome)
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'de-DE';
      utterance.rate = rate;
      utterance.volume = 1.0;

      // Assign cached German voice if available
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
        speechAttempted = true;
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error on Android, switching to audio fallback:', e);
        playFallbackTts(cleanText);
      };

      window.speechSynthesis.speak(utterance);

      // Android fallback check: if speech hasn't started in 350ms, play TTS audio fallback
      setTimeout(() => {
        if (!speechAttempted && window.speechSynthesis.speaking === false) {
          playFallbackTts(cleanText);
        }
      }, 350);

      return;
    } catch (err) {
      console.warn('SpeechSynthesis invocation failed:', err);
    }
  }

  // Fallback to HTML5 Audio TTS
  playFallbackTts(cleanText);
};

/**
 * Fallback TTS player using Google Translate TTS endpoint
 */
const playFallbackTts = (text: string) => {
  try {
    const encoded = encodeURIComponent(text);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=de&client=tw-ob`;

    const audio = new Audio(ttsUrl);
    currentAudioElement = audio;

    audio.play().catch((err) => {
      console.warn('Fallback audio playback error on Android:', err);
    });
  } catch (e) {
    console.warn('Fallback TTS audio generation failed:', e);
  }
};
