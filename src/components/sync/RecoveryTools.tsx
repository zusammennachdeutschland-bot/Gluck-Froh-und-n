import React, { useState } from 'react';
import { 
  Wrench, RefreshCw, AlertTriangle, Database, 
  RotateCcw, Trash2, CheckCircle2, ShieldAlert 
} from 'lucide-react';
import { PairedPeer } from '../../types';

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
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [confirmedAction, setConfirmedAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAction = async (actionKey: string, runner: () => Promise<void>) => {
    setExecutingAction(actionKey);
    setConfirmedAction(null);
    setSuccessMessage(null);

    try {
      await runner();
      setSuccessMessage(`Successfully completed: ${actionKey}`);
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
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold block mb-0.5">Advanced Synchronization Recovery</strong>
          These tools execute non-destructive database recalculations and force-synchronizations. Use when resolving peer divergence or stale watermarks.
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tools List */}
      <div className="space-y-4">
        {/* Tool 1: Force Full Sync */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Force Full Bidirectional Sync</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ignores watermark revision tables and compares the entire database against all connected devices.
                </p>
              </div>
            </div>

            {confirmedAction === 'force_full_sync' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction('Force Full Sync', () => onForceFullSync())}
                  disabled={executingAction !== null}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md"
                >
                  {executingAction === 'Force Full Sync' ? 'Syncing...' : 'Confirm Force Sync'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedAction(null)}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmedAction('force_full_sync')}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors shrink-0"
              >
                Execute Full Sync
              </button>
            )}
          </div>
        </div>

        {/* Tool 2: Recalculate Watermarks */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Recalculate Watermark Tables</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Resets vector clocks and resets peer watermarks to 0 to trigger complete record comparisons on next sync.
                </p>
              </div>
            </div>

            {confirmedAction === 'recalculate_watermarks' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction('Recalculate Watermarks', onRecalculateWatermarks)}
                  disabled={executingAction !== null}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md"
                >
                  {executingAction === 'Recalculate Watermarks' ? 'Recalculating...' : 'Confirm Reset'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedAction(null)}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmedAction('recalculate_watermarks')}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors shrink-0"
              >
                Reset Watermarks
              </button>
            )}
          </div>
        </div>

        {/* Tool 3: Clear Local Cache */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Clear Ephemeral Sync Memory</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Clears in-memory presence caches, peer state caches, and resets background timer loops.
                </p>
              </div>
            </div>

            {confirmedAction === 'clear_cache' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction('Clear Sync Memory', onClearLocalCache)}
                  disabled={executingAction !== null}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md"
                >
                  {executingAction === 'Clear Sync Memory' ? 'Clearing...' : 'Confirm Clear'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedAction(null)}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmedAction('clear_cache')}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors shrink-0"
              >
                Clear Ephemeral Cache
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
