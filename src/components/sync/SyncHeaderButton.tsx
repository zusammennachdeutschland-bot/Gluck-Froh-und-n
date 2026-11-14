import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { useDlSyncState } from '../../hooks/useDlSyncState';
import {
  getPendingHomeworkSyncCount,
  isFirestoreReadQuotaExhausted
} from '../../shared/homeworkStorageSync';

export interface SyncHeaderButtonProps {
  status?: 'offline' | 'online' | 'connected' | 'syncing' | 'error';
  connectedCount?: number;
  onClick: () => void;
  isOpen?: boolean;
}

export const SyncHeaderButton: React.FC<SyncHeaderButtonProps> = ({
  status: propStatus,
  connectedCount = 0,
  onClick,
  isOpen = false,
}) => {
  const { _t, getPendingOutbox } = useApp();
  const { status: storageStatus } = useDlSyncState();
  const [hwCloudOnline, setHwCloudOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine && !isFirestoreReadQuotaExhausted() : !isFirestoreReadQuotaExhausted()
  );
  const [pendingHwCount, setPendingHwCount] = useState<number>(() => getPendingHomeworkSyncCount());

  useEffect(() => {
    const refreshStatus = () => {
      setHwCloudOnline(
        typeof navigator !== 'undefined' ? navigator.onLine && !isFirestoreReadQuotaExhausted() : !isFirestoreReadQuotaExhausted()
      );
      setPendingHwCount(getPendingHomeworkSyncCount());
    };
    window.addEventListener('online', refreshStatus);
    window.addEventListener('offline', refreshStatus);
    window.addEventListener('glueck-homework-sync-updated', refreshStatus);
    return () => {
      window.removeEventListener('online', refreshStatus);
      window.removeEventListener('offline', refreshStatus);
      window.removeEventListener('glueck-homework-sync-updated', refreshStatus);
    };
  }, []);

  const effectiveStatus = propStatus || storageStatus || 'online';
  const isSyncing = effectiveStatus === 'syncing';
  const isP2PConnected = connectedCount > 0 || effectiveStatus === 'connected';
  const pendingP2PChanges = getPendingOutbox ? getPendingOutbox().totalCount : 0;

  const p2pLabel = isSyncing
    ? _t('جاري المزامنة...', 'Synchronization in progress', 'Synchronisation läuft')
    : isP2PConnected
    ? _t('P2P متصل', 'P2P Connected', 'P2P Verbunden')
    : pendingP2PChanges > 0
    ? _t(`P2P (${pendingP2PChanges} معلق)`, `Pending local changes (${pendingP2PChanges})`, `Ausstehende Änderungen (${pendingP2PChanges})`)
    : _t('P2P جاهز', 'P2P Ready', 'P2P Bereit');

  const hwCloudLabel = hwCloudOnline
    ? pendingHwCount > 0
      ? _t(`سحابة الواجبات (${pendingHwCount} معلق)`, `Pending homework uploads (${pendingHwCount})`, `Hausaufgaben-Uploads (${pendingHwCount})`)
      : _t('سحابة الواجبات متصلة', 'Homework cloud connected', 'Hausaufgaben-Cloud verbunden')
    : _t('سحابة الواجبات غير متاحة', 'Homework cloud unavailable', 'Hausaufgaben-Cloud nicht verfügbar');

  const badgeStyles = isSyncing
    ? 'bg-blue-500/10 text-blue-700 border-blue-300/80 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/60'
    : isP2PConnected
    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300/80 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/60'
    : 'bg-slate-500/10 text-slate-600 border-slate-300/80 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/60';

  const dotStyles = isSyncing
    ? 'bg-blue-500 animate-pulse'
    : isP2PConnected
    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
    : 'bg-slate-400 dark:bg-slate-500';

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={`relative p-1.5 sm:px-2 sm:py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
        isOpen
          ? 'bg-primary text-white border-primary shadow-xs'
          : `${badgeStyles} hover:opacity-90`
      }`}
      aria-label={`Sync: ${p2pLabel}`}
      title={`${p2pLabel} • ${hwCloudLabel}`}
    >
      {/* Indicator Dot / Spinner */}
      <div className="relative flex items-center justify-center shrink-0">
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-white' : dotStyles}`} />
        )}
      </div>

      {/* Wifi / Cloud Icon */}
      {isSyncing ? null : isP2PConnected ? (
        <Wifi className={`w-3 h-3 ${isOpen ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
      ) : (
        <Cloud className={`w-3 h-3 ${isOpen ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`} />
      )}

      {/* Combined pending changes or connected count badge */}
      {(pendingP2PChanges > 0 || pendingHwCount > 0) && (
        <span className="bg-amber-500 text-white font-black text-[9px] px-1 py-0.2 rounded-full font-mono shrink-0">
          {pendingP2PChanges + pendingHwCount}
        </span>
      )}

      {connectedCount > 0 && (
        <span className="bg-emerald-600 text-white font-black text-[9px] px-1 py-0.2 rounded-full font-mono shrink-0">
          {connectedCount}
        </span>
      )}
    </motion.button>
  );
};

