/**
 * Web Platform Stub for Capacitor APIs.
 * Ensures standalone web deployment on Vercel without native mobile dependencies,
 * while allowing desktop & Android builds to use real native plugins.
 */

export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web'
};

export const Filesystem = {
  writeFile: async () => ({ uri: '' }),
  readFile: async () => ({ data: '' }),
  getUri: async () => ({ uri: '' })
};

export const Directory = {
  Documents: 'DOCUMENTS',
  Data: 'DATA',
  Cache: 'CACHE'
};

export const Share = {
  share: async (opts: { title?: string; text?: string; url?: string }) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(opts);
        return { value: true };
      } catch {
        // Fallback
      }
    }
    return { value: false };
  }
};

export const Toast = {
  show: async ({ text }: { text: string }) => {
    // In web, fallback to simple console log or temporary overlay if needed
    console.log(`[Toast]: ${text}`);
  }
};

export const TextToSpeech = {
  speak: async () => {},
  stop: async () => {},
  getSupportedLanguages: async () => ({ languages: [] })
};
