import React from 'react';
import { AlertTriangle, Trash2, Archive, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemType: 'student' | 'group';
  itemName: string;
  recordsSummary?: {
    lessonsCount: number;
    paymentsCount: number;
    attendanceCount: number;
    studentsCount?: number;
  };
  onConfirmDelete: () => void;
  onConfirmArchive: () => void;
  onConfirmCascadeDelete?: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  itemType,
  itemName,
  recordsSummary,
  onConfirmDelete,
  onConfirmArchive,
  onConfirmCascadeDelete,
  onClose,
}) => {
  const { _t } = useApp();

  if (!isOpen) return null;

  const hasAssociatedRecords =
    (recordsSummary?.lessonsCount || 0) > 0 ||
    (recordsSummary?.paymentsCount || 0) > 0 ||
    (recordsSummary?.attendanceCount || 0) > 0 ||
    (recordsSummary?.studentsCount || 0) > 0;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
      <div onClick={(e) => e.stopPropagation()} className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md p-4 shadow-2xl relative animate-scale-up space-y-3">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-lg shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-text-main">
                {itemType === 'student' ? 'Schüler löschen / archivieren' : 'Gruppe löschen / archivieren'}
              </h3>
              <p className="text-xs font-semibold text-text-muted mt-0.5">
                "{itemName}"
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-hover rounded-full transition-colors cursor-pointer text-text-muted/70 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if existing records */}
        {hasAssociatedRecords ? (
          <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg p-4 text-xs space-y-2 text-primary dark:text-primary">
            <div className="font-bold flex items-center gap-1.5 text-primary dark:text-primary">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Achtung: Zugehörige Daten vorhanden!</span>
            </div>
            <p className="leading-relaxed">
              Für <strong>{itemName}</strong> existieren folgende Datensätze im System:
            </p>
            <ul className="list-disc list-inside space-y-1 font-semibold text-[11px] text-primary/90 dark:text-primary/90 pl-1">
              {recordsSummary?.studentsCount ? (
                <li>{recordsSummary.studentsCount} zugewiesene Schüler</li>
              ) : null}
              {recordsSummary?.lessonsCount ? (
                <li>{recordsSummary.lessonsCount} Lektionen / Termine</li>
              ) : null}
              {recordsSummary?.paymentsCount ? (
                <li>{recordsSummary.paymentsCount} Zahlungsaufzeichnungen</li>
              ) : null}
              {recordsSummary?.attendanceCount ? (
                <li>{recordsSummary.attendanceCount} Anwesenheitsdaten</li>
              ) : null}
            </ul>
            <p className="text-[11px] text-primary dark:text-primary pt-1">
              Tipp: Sie können diesen Eintrag <strong>archivieren</strong>, um Historien und Berichte zu behalten.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Sind Sie sicher, dass Sie <strong>{itemName}</strong> löschen oder archivieren möchten?
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onConfirmArchive}
            className="w-full bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs py-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-surface-border dark:border-surface-border-soft"
          >
            <Archive className="w-4 h-4 text-primary" />
            <span>In Archiv verschieben (Empfohlen)</span>
          </button>

          <button
            type="button"
            onClick={onConfirmDelete}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Endgültig löschen</span>
          </button>

          {itemType === 'group' && onConfirmCascadeDelete && (
            <div className="pt-2 mt-2 border-t border-red-100 dark:border-red-950/30">
              <button
                type="button"
                onClick={onConfirmCascadeDelete}
                className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-bold text-xs py-3 rounded-lg border border-red-200 dark:border-red-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{_t('حذف المجموعة وجميع البيانات المتعلقة', 'Delete Group & All Related Data', 'Gruppe & Alle zugehörigen Daten löschen')}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-transparent hover:bg-surface-hover text-slate-500 font-bold text-xs py-2 rounded-lg transition-all text-center cursor-pointer mt-1"
          >
            Abbrechen
          </button>
        </div>

      </div>
    </div>
  );
};
