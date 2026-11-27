import { useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storageService';
import { SyncStateMetadata } from '../types';

export function useDlSyncState() {
  const [syncState, setSyncState] = useState<SyncStateMetadata | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const reloadSyncState = useCallback(async () => {
    try {
      const state = await storage.getItem<SyncStateMetadata>('dl_sync_state');
      if (state) {
        setSyncState(state);
      }
    } catch (e) {
      console.warn('Failed to load dl_sync_state from storage:', e);
    }
  }, []);

  useEffect(() => {
    reloadSyncState();

    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      if ('key' in e && e.key !== 'dl_sync_state' && e.key !== null) return;
      reloadSyncState();
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('storage', handleStorageChange as EventListener);
    window.addEventListener('dl_sync_state_changed', handleStorageChange as EventListener);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll IndexedDB every 3s only while the tab is visible; when hidden,
    // the storage + dl_sync_state_changed listeners above are enough, and
    // a fresh reload runs as soon as the tab becomes visible again.
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval !== null) return;
      interval = setInterval(reloadSyncState, 3000);
    };
    const stopPolling = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        reloadSyncState();
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    if (!document.hidden) startPolling();

    return () => {
      window.removeEventListener('storage', handleStorageChange as EventListener);
      window.removeEventListener('dl_sync_state_changed', handleStorageChange as EventListener);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling();
    };
  }, [reloadSyncState]);

  // Determine effective sync status pulling from dl_sync_state
  const effectiveStatus: 'online' | 'syncing' | 'offline' | 'error' = !isOnline
    ? 'offline'
    : (syncState?.status || 'online');

  return {
    syncState,
    status: effectiveStatus,
    isOnline,
    reloadSyncState
  };
}
