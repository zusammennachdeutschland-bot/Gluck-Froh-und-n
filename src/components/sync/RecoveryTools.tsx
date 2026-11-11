import React, { useState } from 'react';
import { 
  Wrench, RefreshCw, AlertTriangle, Database, 
  RotateCcw, Trash2, CheckCircle2, ShieldAlert 
} from 'lucide-react';
import { PairedPeer } from '../../types';
import { useApp } from '../../context/AppContext';

interface RecoveryToolsProps {
  pairedPeers: PairedPeer[];
  onForceFullSync: (peerId?: string) => Promise<void>;
  onRecalculateWatermarks: () => Promise<void>;
  onClearLocalCache: () => Promise<void>;
  id?: string;
}

export const RecoveryTools: React.FC<RecoveryToolsProps> = ({
  pairedPeers,
  onForceFullSync,
  onRecalculateWatermarks,
  onClearLocalCache,
  id
}) => {
  const { _t } = useApp();
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [confirmedAction, setConfirmedAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAction = async (actionKey: string, runner: () => Promise<void>) => {
    setExecutingAction(actionKey);
    setConfirmedAction(null);
    setSuccessMessage(null);

    try {
      await runner();
      setSuccessMessage(_t(`تم تنفيذ الإجراء بنجاح: ${actionKey}`, `Successfully completed: ${actionKey}`, `Erfolgreich abgeschlossen: ${actionKey}`));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.warn(`Recovery action ${actionKey} failed:`, err);
    } finally {
      setExecutingAction(null);
    }
  };

  return (
    <div id={id} className="space-y-6">
      {/* Warning Notice */}
      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-black block mb-0.5 text-amber-800 dark:text-amber-300">
            {_t('أدوات استعادة ومزامنة متقدمة', 'Advanced Synchronization Recovery', 'Erweiterte Synchronisations-Wiederherstellung')}
          </strong>
          <span className="text-text-muted text-xs">
            {_t('هذه الأدوات تنفذ عمليات إعادة معايرة غير متلفة ومطابقة شاملة لقواعد البيانات. استخدمها في حال وجود تباين بين الأجهزة أو تكرار غير متوقع.', 'These tools execute non-destructive database recalculations and force-synchronizations. Use when resolving peer divergence or stale watermarks.', 'Diese Werkzeuge führen nicht-destruktive Neuberechnungen und Gesamtabgleiche durch.')}
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-black shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tools List */}
      <div className="space-y-3.5">
        {/* Tool 1: Force Full Sync */}
        <div className="rounded-2xl border border-surface-border bg-surface p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-primary-soft text-primary border border-primary/20 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-text-main">
                  {_t('فرض مزامنة ثنائية كاملة وشاملة', 'Force Full Bidirectional Sync', 'Vollständige Synchronisation erzwingen')}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  {_t('يتجاوز جداول التعديلات السريعة ويقوم بفحص كل السجلات ومقارنتها مع جميع الأجهزة المتصلة.', 'Ignores watermark revision tables and compares the entire database against all connected devices.', 'Ignoriert Revisionsgrenzen und vergleicht die gesamte Datenbank.')}
                </p>
              </div>
            </div>

            {confirmedAction === 'force_full_sync' ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAction(_t('مزامنة كاملة شاملة', 'Force Full Sync', 'Vollabgleich'), () => onForceFullSync())}
                  disabled={executingAction !== null}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {executingAction ? _t('جارٍ المزامنة...', 'Syncing...', 'Synchronisiere...') : _t('تأكيد المزامنة الشاملة', 'Confirm Force Sync', 'Bestätigen')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedAction(null)}
                  className="px-3 py-2 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmedAction('force_full_sync')}
                className="px-4 py-2 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main hover:bg-surface-hover transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {_t('بدء مزامنة شاملة', 'Execute Full Sync', 'Vollabgleich ausführen')}
              </button>
            )}
          </div>
        </div>

        {/* Tool 2: Recalculate Watermarks */}
        <div className="rounded-2xl border border-surface-border bg-surface p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-primary-soft text-primary border border-primary/20 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-text-main">
                  {_t('إعادة معايرة فهارس التعديلات (Watermarks)', 'Recalculate Watermark Tables', 'Revisions-Tabellen neu berechnen')}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  {_t('يعيد ضبط عدادات التعديل وساعات التوجيه لضمان عدم تفويت أي سجل أثناء المزامنة القادمة.', 'Resets vector clocks and resets peer watermarks to 0 to trigger complete record comparisons on next sync.', 'Setzt Vektoren zurück für eine vollständige Überprüfung.')}
                </p>
              </div>
            </div>

            {confirmedAction === 'recalculate_watermarks' ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAction(_t('إعادة معايرة الفهارس', 'Recalculate Watermarks', 'Revisionsgrenzen zurücksetzen'), onRecalculateWatermarks)}
                  disabled={executingAction !== null}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {executingAction ? _t('جارٍ المعايرة...', 'Recalculating...', 'Berechne neu...') : _t('تأكيد إعادة التعيين', 'Confirm Reset', 'Bestätigen')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedAction(null)}
                  className="px-3 py-2 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmedAction('recalculate_watermarks')}
                className="px-4 py-2 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main hover:bg-surface-hover transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {_t('إعادة تعيين الفهارس', 'Reset Watermarks', 'Zurücksetzen')}
              </button>
            )}
          </div>
        </div>

        {/* Tool 3: Clear Local Cache */}
        <div className="rounded-2xl border border-surface-border bg-surface p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-text-main">
                  {_t('مسح ذاكرة المزامنة المؤقتة الحية', 'Clear Ephemeral Sync Memory', 'Temporären Sync-Speicher leeren')}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  {_t('يمسح ذاكرة التخزين المؤقت لاتصالات الأجهزة الحية ويعيد ضبط مؤقتات الفحص في الخلفية دون المساس ببياناتك.', 'Clears in-memory presence caches, peer state caches, and resets background timer loops.', 'Löscht temporäre Verbindungscaches ohne Datenverlust.')}
                </p>
              </div>
            </div>

            {confirmedAction === 'clear_cache' ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAction(_t('مسح الذاكرة المؤقتة', 'Clear Sync Memory', 'Cache leeren'), onClearLocalCache)}
                  disabled={executingAction !== null}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {executingAction ? _t('جارٍ المسح...', 'Clearing...', 'Löschen...') : _t('تأكيد المسح المؤقت', 'Confirm Clear', 'Bestätigen')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedAction(null)}
                  className="px-3 py-2 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmedAction('clear_cache')}
                className="px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {_t('مسح الكاش المؤقت', 'Clear Ephemeral Cache', 'Cache leeren')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
