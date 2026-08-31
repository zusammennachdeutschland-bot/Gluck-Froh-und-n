import React from 'react';
import { MonitorSmartphone, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export interface SyncHeaderButtonProps {
  status: 'offline' | 'online' | 'connected' | 'syncing' | 'error';
  connectedCount: number;
  onClick: () => void;
  isOpen?: boolean;
}

export const SyncHeaderButton: React.FC<SyncHeaderButtonProps> = ({
  status,
  connectedCount,
  onClick,
  isOpen = false,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={`relative p-2 sm:p-2.5 rounded-full border transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
        isOpen
          ? 'bg-primary text-white border-primary shadow-xs'
          : 'bg-background dark:bg-background hover:bg-surface-hover text-text-main border-surface-border/80'
      }`}
      aria-label="Synchronization Center"
      title="مزامنة الأجهزة"
    >
      {status === 'syncing' ? (
        <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin ${isOpen ? 'text-white' : 'text-primary'}`} />
      ) : (
        <MonitorSmartphone
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isOpen ? 'text-white' : 'text-primary'}`}
        />
      )}

      {(status === 'online' || status === 'connected') && connectedCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-primary text-white font-black text-[9px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-black">
          {connectedCount}
        </span>
      )}

      {status === 'error' && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 text-white rounded-full ring-2 ring-white dark:ring-black" />
      )}
    </motion.button>
  );
};
