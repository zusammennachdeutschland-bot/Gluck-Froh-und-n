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
  writeFile: async (_opts?: any) => ({ uri: '' }),
  readFile: async (_opts?: any) => ({ data: '' }),
  getUri: async (_opts?: any) => ({ uri: '' })
};

export const Directory = {
  Documents: 'DOCUMENTS',
  Data: 'DATA',
  Cache: 'CACHE'
};

export const Share = {
  share: async (opts: { title?: string; text?: string; url?: string; dialogTitle?: string; files?: string[] }) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
        return { value: true };
      } catch {
        // Fallback
      }
    }
    return { value: false };
  }
};

export const Toast = {
  show: async (opts: { text: string; duration?: 'short' | 'long'; position?: 'top' | 'center' | 'bottom' }) => {
    console.log(`[Toast]: ${opts.text}`);
  }
};

export const TextToSpeech = {
  speak: async (_opts?: any) => {},
  stop: async () => {},
  getSupportedLanguages: async () => ({ languages: [] as string[] })
};
