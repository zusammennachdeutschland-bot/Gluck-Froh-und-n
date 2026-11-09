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

    const interval = setInterval(reloadSyncState, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange as EventListener);
      window.removeEventListener('dl_sync_state_changed', handleStorageChange as EventListener);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
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
