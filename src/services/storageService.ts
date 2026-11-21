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

const NON_CRITICAL_CACHE_LOCALSTORAGE_KEYS = [
  'dl_auto_backup_history_snapshots',
  'dl_local_backup_data',
  'dl_restore_point_snapshot',
  'dl_lernstudio_sets',
  'dl_web_scheduled_notifications'
];

const CRITICAL_DATA_MIRROR_KEYS = new Set([
  'dl_lessons',
  'dl_payments'
]);

const verifiedPrimaryDbMirrorKeys = new Set<string>();

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

export function __getSimulatedPrimaryDbValueForTests(key: string): any {
  return simulatedPrimaryDbStore.get(key);
}

export function __setPrimaryDbVerifiedKeyForTests(key: string, verified: boolean): void {
  if (verified) {
    verifiedPrimaryDbMirrorKeys.add(key);
  } else {
    verifiedPrimaryDbMirrorKeys.delete(key);
  }
}

export function isPrimaryDbVerifiedForKey(key: string): boolean {
  if (!key) return false;
  if (simulatePrimaryDbForTests) {
    return verifiedPrimaryDbMirrorKeys.has(key) && simulatedPrimaryDbStore.has(key);
  }
  return verifiedPrimaryDbMirrorKeys.has(key);
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

  // Skip mirroring massive backup snapshots or pending queues into 5MB localStorage ONLY if already verified in IndexedDB
  if (savedInPrimaryDb && isPrimaryDbVerifiedForKey(key) && (isHeavyStorageKey(key) || valStr.length > MAX_LOCALSTORAGE_MIRROR_BYTES)) {
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
      const canRetryWrite = !savedInPrimaryDb || valStr.length <= MAX_LOCALSTORAGE_MIRROR_BYTES;

      // Pass 1: Evict non-critical cache / redundant snapshot keys from localStorage one-by-one
      for (const evictKey of NON_CRITICAL_CACHE_LOCALSTORAGE_KEYS) {
        if (evictKey === key) continue;
        // Preserve dl_restore_point_snapshot unless primary DB has verified it or all other caches are cleared
        if (evictKey === 'dl_restore_point_snapshot' && !isPrimaryDbVerifiedForKey(evictKey)) {
          continue;
        }
        try {
          localStorage.removeItem(evictKey);
        } catch {
          // ignore
        }
        if (canRetryWrite) {
          try {
            localStorage.setItem(key, valStr);
            return true;
          } catch (retryErr) {
            if (!isQuotaExceededError(retryErr)) {
              console.warn('localStorage write failed after cache eviction for key:', key, retryErr);
              return false;
            }
          }
        }
      }

      // Pass 2: Evict redundant localStorage mirrors of dl_lessons / dl_payments ONLY when verified intact in primary IndexedDB
      for (const criticalKey of CRITICAL_DATA_MIRROR_KEYS) {
        if (criticalKey === key) continue;
        if (!isPrimaryDbVerifiedForKey(criticalKey)) {
          continue;
        }
        try {
          localStorage.removeItem(criticalKey);
        } catch {
          // ignore
        }
        if (canRetryWrite) {
          try {
            localStorage.setItem(key, valStr);
            return true;
          } catch (retryErr) {
            if (!isQuotaExceededError(retryErr)) {
              console.warn('localStorage write failed after verified mirror eviction for key:', key, retryErr);
              return false;
            }
          }
        }
      }

      if (canRetryWrite) {
        console.warn('localStorage quota exceeded with no safe eviction remaining for key:', key);
      }
      return false;
    }
    console.warn('Error writing to localStorage:', key, e);
    return false;
  }
};

let lastLessonStorageTraceSnapshot: Array<{ id: string; status: string }> = [];

const traceLessonStorageBoundary = <T>(operation: 'read' | 'write', key: string, value: T): T => {
  if (key !== 'dl_lessons') return value;
  try {
    if (typeof localStorage === 'undefined' || localStorage.getItem('gluck_debug_lesson_pipeline') !== '1') return value;
    const rows = Array.isArray(value) ? value as Array<{ id?: string; status?: string }> : [];
    const current = rows.filter(row => row?.id).map(row => ({ id: String(row.id), status: String(row.status || '') }));
    const currentById = new Map(current.map(row => [row.id, row.status]));
    const previousById = new Map(lastLessonStorageTraceSnapshot.map(row => [row.id, row.status]));
    const removedIds = lastLessonStorageTraceSnapshot.filter(row => !currentById.has(row.id)).map(row => row.id);
    const statusChanged = current.flatMap(row => {
      const previous = previousById.get(row.id);
      return previous !== undefined && previous !== row.status
        ? [{ id: row.id, from: previous, to: row.status }]
        : [];
    });
    console.info(`[Glück lesson pipeline] storage ${operation} dl_lessons`, {
      count: current.length, rows: current, removedIds, statusChanged
    });
    lastLessonStorageTraceSnapshot = current;
  } catch (error) {
    console.warn('[Glück lesson pipeline] storage trace failed', error);
  }
  return value;
};

export const reconcileLessonStorageCopies = <T extends { id: string; status?: string; updatedAt?: any; _fieldUpdatedAt?: Record<string, any>; report?: any }>(
  primaryRows: T[],
  mirrorRows: T[]
): T[] => {
  const byId = new Map<string, T>();
  const timestamp = (value: any): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };
  const statusRank: Record<string, number> = {
    scheduled: 0, pending_action: 1, in_progress: 2, cancelled: 3, completed: 4
  };
  for (const row of [...(Array.isArray(primaryRows) ? primaryRows : []), ...(Array.isArray(mirrorRows) ? mirrorRows : [])]) {
    if (!row?.id) continue;
    const current = byId.get(row.id);
    if (!current) {
      byId.set(row.id, row);
      continue;
    }
    const currentUpdated = timestamp(current.updatedAt);
    const incomingUpdated = timestamp(row.updatedAt);
    const incomingWins = incomingUpdated > currentUpdated;
    const base = incomingWins ? row : current;
    const currentStatusUpdated = timestamp(current._fieldUpdatedAt?.status) || currentUpdated;
    const incomingStatusUpdated = timestamp(row._fieldUpdatedAt?.status) || incomingUpdated;
    let statusSource = incomingStatusUpdated > currentStatusUpdated ? row : current;
    if (incomingStatusUpdated === currentStatusUpdated &&
        (statusRank[row.status || ''] ?? -1) > (statusRank[current.status || ''] ?? -1)) {
      statusSource = row;
    }
    const merged = { ...base } as T;
    if (statusSource.status !== undefined) merged.status = statusSource.status;
    if (merged.status === 'completed' && (!merged.report || Object.keys(merged.report || {}).length === 0)) {
      merged.report = current.report || row.report;
    }
    byId.set(row.id, merged);
  }
  return Array.from(byId.values());
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
          let val = simulatedPrimaryDbStore.get(key);
          if (key === 'dl_lessons' && Array.isArray(val) && hasLocalStorageRuntime()) {
            try {
              const mirrorRaw = localStorage.getItem(key);
              if (mirrorRaw !== null) {
                const mirror = JSON.parse(mirrorRaw);
                if (Array.isArray(mirror)) {
                  val = reconcileLessonStorageCopies(val, mirror);
                  simulatedPrimaryDbStore.set(key, val);
                  safeLocalStorageSetItem(key, JSON.stringify(val), true);
                }
              }
            } catch (reconcileError) {
              console.warn('Could not reconcile simulated durable lesson snapshots:', reconcileError);
            }
          }
          memoryStore[key] = val;
          return traceLessonStorageBoundary('read', key, val);
        }
      } else if (isLocalforageSupported) {
        const val = await localforage.getItem<T>(key);
        if (val !== null && val !== undefined) {
          if (key === 'dl_lessons' && Array.isArray(val) && hasLocalStorageRuntime()) {
            // IndexedDB may contain an older successful snapshot when a later write
            // fell back to localStorage. Reconcile both durable copies on every boot.
            try {
              const mirrorRaw = localStorage.getItem(key);
              if (mirrorRaw !== null) {
                const mirror = JSON.parse(mirrorRaw);
                if (Array.isArray(mirror)) {
                  const reconciled = reconcileLessonStorageCopies(val as any[], mirror as any[]) as T;
                  memoryStore[key] = reconciled;
                  const serialized = JSON.stringify(reconciled);
                  try {
                    await localforage.setItem(key, reconciled);
                    verifiedPrimaryDbMirrorKeys.add(key);
                  } catch (repairError) {
                    verifiedPrimaryDbMirrorKeys.delete(key);
                    console.warn('Could not repair IndexedDB lesson snapshot from localStorage mirror:', repairError);
                  }
                  safeLocalStorageSetItem(key, serialized, verifiedPrimaryDbMirrorKeys.has(key));
                  return traceLessonStorageBoundary('read', key, reconciled);
                }
              }
            } catch (reconcileError) {
              console.warn('Could not reconcile durable lesson snapshots:', reconcileError);
            }
          }
          memoryStore[key] = val;
          return traceLessonStorageBoundary('read', key, val);
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
            return traceLessonStorageBoundary('read', key, parsed);
          } catch {
            memoryStore[key] = val as unknown as T;
            return val as unknown as T;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', key, e);
    }

    return traceLessonStorageBoundary('read', key, (memoryStore[key] !== undefined ? memoryStore[key] : null) as T | null);
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
        savedInForage = simulatedPrimaryDbStore.has(key);
      } else if (isLocalforageSupported) {
        await localforage.setItem(key, value);
        const readBack = await localforage.getItem(key);
        savedInForage = readBack !== null && readBack !== undefined;
      }
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.includes('No available storage method')) {
        isLocalforageSupported = false;
      } else {
        forageError = e;
        console.warn('Error writing to localforage:', key, e);
      }
    }

    if (savedInForage) {
      verifiedPrimaryDbMirrorKeys.add(key);
    } else {
      // If primary DB failed on this write, do not allow stale primary DB status to authorize localStorage eviction
      verifiedPrimaryDbMirrorKeys.delete(key);
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
    traceLessonStorageBoundary('write', key, value);
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

    verifiedPrimaryDbMirrorKeys.delete(key);
    delete memoryStore[key];
  },

  async clear(): Promise<void> {
    for (const k of Object.keys(writeDebounceTimers)) {
      clearTimeout(writeDebounceTimers[k]);
      delete writeDebounceTimers[k];
    }
    verifiedPrimaryDbMirrorKeys.clear();
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

