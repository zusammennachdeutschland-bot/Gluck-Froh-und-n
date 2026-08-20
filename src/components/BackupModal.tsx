import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { SmartBackupCenter } from './SmartBackupCenter';
import { useApp } from '../context/AppContext';

interface BackupModalProps {
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ onClose }) => {
  const { _t } = useApp();

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center font-sans p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-4xl shadow-2xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-primary p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-surface/20 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base font-black">
              {_t('النسخ الاحتياطي والاستعادة', 'Backup & Restore', 'Sicherung & Wiederherstellung')}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-surface/20 rounded-full transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          <SmartBackupCenter onBack={onClose} />
        </div>
      </div>
    </div>
  );
};
