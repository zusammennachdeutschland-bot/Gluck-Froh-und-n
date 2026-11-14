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
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={`relative px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
        isOpen
          ? 'bg-primary text-white border-primary shadow-xs'
          : `${badgeStyles} hover:opacity-90`
      }`}
      aria-label={`P2P: ${p2pLabel} | ${hwCloudLabel}`}
      title={`${p2pLabel} • ${hwCloudLabel}`}
    >
      {/* P2P Indicator Dot / Spinner */}
      <div className="relative flex items-center justify-center shrink-0">
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-blue-600 dark:text-blue-400" />
        ) : (
          <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isOpen ? 'bg-white' : dotStyles}`} />
        )}
      </div>

      {/* P2P Status Icon */}
      {isSyncing ? null : isP2PConnected ? (
        <Wifi className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isOpen ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
      ) : (
        <WifiOff className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isOpen ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`} />
      )}

      {/* Clear P2P Text Status Label */}
      <span className={`text-[11px] sm:text-xs font-bold tracking-tight whitespace-nowrap ${isOpen ? 'text-white' : ''}`}>
        {p2pLabel}
      </span>

      {/* Connected Peers Badge Count */}
      {connectedCount > 0 && (
        <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-primary text-white font-black text-[9px] rounded-full flex items-center justify-center ring-1 ring-white dark:ring-black shrink-0">
          {connectedCount}
        </span>
      )}

      {/* Distinct Homework Cloud Mini-Indicator */}
      <span
        className={`inline-flex items-center gap-0.5 pl-1 border-l ${
          isOpen ? 'border-white/30 text-white' : 'border-slate-300/70 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
        }`}
        title={hwCloudLabel}
      >
        {hwCloudOnline ? (
          <Cloud className="w-3 h-3 shrink-0" />
        ) : (
          <CloudOff className="w-3 h-3 shrink-0 opacity-60" />
        )}
        {pendingHwCount > 0 && (
          <span className="text-[9px] font-black text-amber-600 dark:text-amber-300">{pendingHwCount}</span>
        )}
      </span>
    </motion.button>
  );
};

