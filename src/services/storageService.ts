import localforage from 'localforage';

// Setup an in-memory storage fallback
const memoryStore: Record<string, any> = {};

let isLocalforageSupported = false;

try {
  localforage.config({
    name: 'Glück_DB',
    storeName: 'ags19_store',
    description: 'Data storage for Glück'
  });
  isLocalforageSupported = true;
} catch (e) {
  console.warn('localforage configuration failed. Using in-memory/localStorage fallback.', e);
}

// Check if localStorage is available
let isLocalStorageSupported = false;
try {
  if (typeof localStorage !== 'undefined') {
    const testKey = '__test_storage__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    isLocalStorageSupported = true;
  }
} catch (e) {
  console.warn('localStorage is not available in this context (probably blocked in iframe).', e);
}

const HEAVY_EVICTABLE_LOCALSTORAGE_KEYS = [
  'dl_auto_backup_history_snapshots',
  'dl_local_backup_data',
  'dl_lernstudio_sets',
  'dl_web_scheduled_notifications',
  'dl_lessons',
  'dl_payments'
];

const LOCALFORAGE_ONLY_HEAVY_KEYS = new Set([
  'dl_auto_backup_history_snapshots',
  'dl_local_backup_data'
]);

const MAX_LOCALSTORAGE_MIRROR_BYTES = 512 * 1024; // 512 KB cap per key when localforage is active

export const isQuotaExceededError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const e = err as any;
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    (typeof e.message === 'string' && e.message.toLowerCase().includes('quota'))
  );
};

export type StorageFailureHook = ((op: 'get' | 'set' | 'remove', key: string) => void) | null;
let storageFailureHookForTests: StorageFailureHook = null;

export function __setStorageFailureHookForTests(hook: StorageFailureHook): void {
  storageFailureHookForTests = hook;
}

const hasLocalStorageRuntime = (): boolean => {
  if (isLocalStorageSupported) return true;
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
  } catch {
    return false;
  }
};

export const safeLocalStorageSetItem = (
  key: string,
  valStr: string,
  savedInPrimaryDb: boolean = false
): boolean => {
  if (!hasLocalStorageRuntime()) return false;

  // Skip mirroring massive backup snapshots into 5MB localStorage if already persisted in IndexedDB
  if (savedInPrimaryDb && (LOCALFORAGE_ONLY_HEAVY_KEYS.has(key) || valStr.length > MAX_LOCALSTORAGE_MIRROR_BYTES)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return true;
  }

  try {
    localStorage.setItem(key, valStr);
    return true;
  } catch (e) {
    if (isQuotaExceededError(e)) {
      // Evict heavy/redundant keys from localStorage (they remain safe in IndexedDB / memoryStore)
      for (const evictKey of HEAVY_EVICTABLE_LOCALSTORAGE_KEYS) {
        if (evictKey === key) continue;
        try {
          localStorage.removeItem(evictKey);
        } catch {
          // ignore
        }
      }
      // Retry writing the target key if it fits
      if (!savedInPrimaryDb || valStr.length <= MAX_LOCALSTORAGE_MIRROR_BYTES) {
        try {
          localStorage.setItem(key, valStr);
          return true;
        } catch (retryErr) {
          console.warn('localStorage quota still exceeded after eviction for key:', key, retryErr);
          return false;
        }
      }
      return false;
    }
    console.warn('Error writing to localStorage:', key, e);
    return false;
  }
};

const writeDebounceTimers: Record<string, any> = {};

export const storage = {
  async getItem<T>(key: string): Promise<T | null> {
    if (storageFailureHookForTests) {
      storageFailureHookForTests('get', key);
    }

    try {
      if (isLocalforageSupported) {
        const val = await localforage.getItem<T>(key);
        if (val !== null && val !== undefined) {
          memoryStore[key] = val;
          return val;
        }
      }
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.includes('No available storage method')) {
        isLocalforageSupported = false;
      } else {
        console.warn('Error reading from localforage:', key, e);
      }
    }

    try {
      if (hasLocalStorageRuntime()) {
        const val = localStorage.getItem(key);
        if (val !== null) {
          try {
            const parsed = JSON.parse(val) as T;
            memoryStore[key] = parsed;
            return parsed;
          } catch {
            memoryStore[key] = val as unknown as T;
            return val as unknown as T;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', key, e);
    }

    return (memoryStore[key] !== undefined ? memoryStore[key] : null) as T | null;
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    if (storageFailureHookForTests) {
      storageFailureHookForTests('set', key);
    }

    if (writeDebounceTimers[key]) {
      clearTimeout(writeDebounceTimers[key]);
      delete writeDebounceTimers[key];
    }

    let savedInForage = false;
    let forageError: unknown = null;
    try {
      if (isLocalforageSupported) {
        await localforage.setItem(key, value);
        savedInForage = true;
      }
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.includes('No available storage method')) {
        isLocalforageSupported = false;
      } else {
        forageError = e;
        console.warn('Error writing to localforage:', key, e);
      }
    }

    let savedInLocalStorage = false;
    if (hasLocalStorageRuntime()) {
      try {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        savedInLocalStorage = safeLocalStorageSetItem(key, valStr, savedInForage);
      } catch (e) {
        console.warn('Error serializing for localStorage:', key, e);
      }
    }

    // If a persistent backing store is active in this environment and both failed, propagate the error
    if ((isLocalforageSupported || hasLocalStorageRuntime()) && !savedInForage && !savedInLocalStorage) {
      throw forageError instanceof Error
        ? forageError
        : new Error(`Durable storage write failed for key: ${key}`);
    }

    // Update memory store only after durable write succeeded
    memoryStore[key] = value;
  },

  async flushPendingWrites(): Promise<void> {
    for (const k of Object.keys(writeDebounceTimers)) {
      clearTimeout(writeDebounceTimers[k]);
      delete writeDebounceTimers[k];
    }
  },

  async verifyDurableReadBack(keys: string[]): Promise<boolean> {
    await this.flushPendingWrites();
    for (const key of keys) {
      try {
        if (storageFailureHookForTests) {
          storageFailureHookForTests('get', key);
        }
        let verified = false;
        if (isLocalforageSupported) {
          try {
            const forageVal = await localforage.getItem(key);
            if (forageVal !== null && forageVal !== undefined) {
              verified = true;
            }
          } catch (e: any) {
            if (typeof e?.message === 'string' && e.message.includes('No available storage method')) {
              isLocalforageSupported = false;
            }
          }
        }
        if (!verified && hasLocalStorageRuntime()) {
          try {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
              verified = true;
            }
          } catch {
            // Fall through
          }
        }
        if (!verified && !isLocalforageSupported && !hasLocalStorageRuntime()) {
          verified = memoryStore[key] !== undefined && memoryStore[key] !== null;
        }
        if (!verified) {
          return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  },

  async removeItem(key: string): Promise<void> {
    if (storageFailureHookForTests) {
      storageFailureHookForTests('remove', key);
    }
    if (writeDebounceTimers[key]) {
      clearTimeout(writeDebounceTimers[key]);
      delete writeDebounceTimers[key];
    }
    delete memoryStore[key];

    try {
      if (isLocalforageSupported) {
        await localforage.removeItem(key);
      }
    } catch (e) {
      console.warn('Error removing from localforage:', key, e);
    }

    try {
      if (hasLocalStorageRuntime()) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Error removing from localStorage:', key, e);
    }
  },

  async clear(): Promise<void> {
    for (const k of Object.keys(writeDebounceTimers)) {
      clearTimeout(writeDebounceTimers[k]);
      delete writeDebounceTimers[k];
    }
    // Clear memory store
    for (const key in memoryStore) {
      delete memoryStore[key];
    }

    try {
      if (isLocalforageSupported) {
        await localforage.clear();
      }
    } catch (e) {
      console.warn('Error clearing localforage:', e);
    }

    try {
      if (hasLocalStorageRuntime()) {
        localStorage.clear();
      }
    } catch (e) {
      console.warn('Error clearing localStorage:', e);
    }
  }
};

