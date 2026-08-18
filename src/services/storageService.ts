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
  const testKey = '__test_storage__';
  localStorage.setItem(testKey, '1');
  localStorage.removeItem(testKey);
  isLocalStorageSupported = true;
} catch (e) {
  console.warn('localStorage is not available in this context (probably blocked in iframe).', e);
}

export const storage = {
  async getItem<T>(key: string): Promise<T | null> {
    try {
      if (isLocalforageSupported) {
        const val = await localforage.getItem<T>(key);
        if (val !== null) {
          memoryStore[key] = val;
          return val;
        }
      }
    } catch (e) {
      console.warn('Error reading from localforage:', key, e);
    }

    try {
      if (isLocalStorageSupported) {
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
    // Keep memory store updated always
    memoryStore[key] = value;

    try {
      if (isLocalforageSupported) {
        await localforage.setItem(key, value);
      }
    } catch (e) {
      console.warn('Error writing to localforage:', key, e);
    }

    try {
      if (isLocalStorageSupported) {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, valStr);
      }
    } catch (e) {
      console.warn('Error writing to localStorage:', key, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    delete memoryStore[key];

    try {
      if (isLocalforageSupported) {
        await localforage.removeItem(key);
      }
    } catch (e) {
      console.warn('Error removing from localforage:', key, e);
    }

    try {
      if (isLocalStorageSupported) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Error removing from localStorage:', key, e);
    }
  },

  async clear(): Promise<void> {
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
      if (isLocalStorageSupported) {
        localStorage.clear();
      }
    } catch (e) {
      console.warn('Error clearing localStorage:', e);
    }
  }
};
