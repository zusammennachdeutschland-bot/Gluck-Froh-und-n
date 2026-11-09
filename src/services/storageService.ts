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

export const isHeavyStorageKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  if (LOCALFORAGE_ONLY_HEAVY_KEYS.has(key)) return true;
  if (key.startsWith('gluck_cloud_pending_remote_queue_v2_')) return true;
  return false;
};

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
let simulatePrimaryDbForTests = false;
const simulatedPrimaryDbStore = new Map<string, any>();

export function __setStorageFailureHookForTests(hook: StorageFailureHook): void {
  storageFailureHookForTests = hook;
}

export function __setSimulatePrimaryDbForTests(enabled: boolean): void {
  simulatePrimaryDbForTests = enabled;
  if (!enabled) {
    simulatedPrimaryDbStore.clear();
  }
}

export function __clearMemoryStoreOnlyForTests(): void {
  for (const key in memoryStore) {
    delete memoryStore[key];
  }
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

  // Skip mirroring massive backup snapshots or pending queues into 5MB localStorage if already persisted in IndexedDB
  if (savedInPrimaryDb && (isHeavyStorageKey(key) || valStr.length > MAX_LOCALSTORAGE_MIRROR_BYTES)) {
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
      if (simulatePrimaryDbForTests) {
        if (simulatedPrimaryDbStore.has(key)) {
          const val = simulatedPrimaryDbStore.get(key);
          memoryStore[key] = val;
          return val;
        }
      } else if (isLocalforageSupported) {
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
      if (simulatePrimaryDbForTests) {
        simulatedPrimaryDbStore.set(key, value);
        savedInForage = true;
      } else if (isLocalforageSupported) {
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
        if (simulatePrimaryDbForTests) {
          if (simulatedPrimaryDbStore.has(key)) {
            verified = true;
          }
        } else if (isLocalforageSupported) {
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
        if (!verified && !isLocalforageSupported && !hasLocalStorageRuntime() && !simulatePrimaryDbForTests) {
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

  async verifyDurableReadBackValue<T>(
    key: string,
    expectedValue: T,
    equalityFn?: (a: T, b: T) => boolean
  ): Promise<boolean> {
    await this.flushPendingWrites();
    try {
      if (storageFailureHookForTests) {
        storageFailureHookForTests('get', key);
      }
      let found = false;
      let readVal: any = null;

      if (simulatePrimaryDbForTests) {
        if (simulatedPrimaryDbStore.has(key)) {
          readVal = simulatedPrimaryDbStore.get(key);
          found = true;
        }
      } else if (isLocalforageSupported) {
        try {
          const forageVal = await localforage.getItem<T>(key);
          if (forageVal !== null && forageVal !== undefined) {
            readVal = forageVal;
            found = true;
          }
        } catch (e: any) {
          if (typeof e?.message === 'string' && e.message.includes('No available storage method')) {
            isLocalforageSupported = false;
          }
        }
      }

      if (!found && hasLocalStorageRuntime()) {
        try {
          const raw = localStorage.getItem(key);
          if (raw !== null) {
            try {
              readVal = JSON.parse(raw);
            } catch {
              readVal = raw;
            }
            found = true;
          }
        } catch {
          // ignore
        }
      }

      if (!found && !isLocalforageSupported && !hasLocalStorageRuntime() && !simulatePrimaryDbForTests) {
        if (memoryStore[key] !== undefined && memoryStore[key] !== null) {
          readVal = memoryStore[key];
          found = true;
        }
      }

      if (!found || readVal === null || readVal === undefined) {
        return false;
      }

      if (equalityFn) {
        return equalityFn(expectedValue, readVal);
      }

      if (Array.isArray(expectedValue)) {
        if (!Array.isArray(readVal)) return false;
        if (expectedValue.length !== readVal.length) return false;
        return JSON.stringify(expectedValue) === JSON.stringify(readVal);
      }

      const expStr = typeof expectedValue === 'string' ? expectedValue : JSON.stringify(expectedValue);
      const actStr = typeof readVal === 'string' ? readVal : JSON.stringify(readVal);
      return expStr === actStr;
    } catch {
      return false;
    }
  },

  async verifyDurableRemoved(key: string): Promise<boolean> {
    await this.flushPendingWrites();
    try {
      if (storageFailureHookForTests) {
        storageFailureHookForTests('get', key);
      }
      if (simulatePrimaryDbForTests) {
        if (simulatedPrimaryDbStore.has(key)) {
          return false;
        }
      } else if (isLocalforageSupported) {
        const forageVal = await localforage.getItem(key);
        if (forageVal !== null && forageVal !== undefined) {
          return false;
        }
      }
      if (hasLocalStorageRuntime()) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          return false;
        }
      }
      if (!simulatePrimaryDbForTests && !isLocalforageSupported && !hasLocalStorageRuntime()) {
        if (memoryStore[key] !== undefined && memoryStore[key] !== null) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (storageFailureHookForTests) {
      storageFailureHookForTests('remove', key);
    }
    if (writeDebounceTimers[key]) {
      clearTimeout(writeDebounceTimers[key]);
      delete writeDebounceTimers[key];
    }

    let removedFromPrimary = false;
    let primaryError: unknown = null;

    try {
      if (simulatePrimaryDbForTests) {
        simulatedPrimaryDbStore.delete(key);
        removedFromPrimary = true;
      } else if (isLocalforageSupported) {
        await localforage.removeItem(key);
        removedFromPrimary = true;
      }
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.includes('No available storage method')) {
        isLocalforageSupported = false;
      } else {
        primaryError = e;
        console.warn('Error removing from localforage:', key, e);
      }
    }

    if (hasLocalStorageRuntime()) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Error removing from localStorage:', key, e);
      }
    }

    if ((simulatePrimaryDbForTests || isLocalforageSupported) && !removedFromPrimary) {
      throw primaryError instanceof Error
        ? primaryError
        : new Error(`Durable storage remove failed for key: ${key}`);
    }

    delete memoryStore[key];
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

