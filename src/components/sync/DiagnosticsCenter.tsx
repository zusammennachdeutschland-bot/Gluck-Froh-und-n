import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  AlertTriangle
} from 'lucide-react';
import {
  SyncConnectionState,
  DevicePresenceState,
  P2pHostStartResult,
  P2pDiagnosticAttempt,
  PresenceRoomState
} from '../../types';
import { CopyableBlock } from './CopyableBlock';
import { connectivityEngine } from '../../services/sync/connectivityEngine';
import { getLastP2pAttempts } from '../../services/sync/peerNetwork';
import { runSyncStressBenchmark, BenchmarkMetrics } from '../../services/sync/benchmarkSync';
import { getStoragePersistenceDiagnostics } from '../../services/storageService';
import { useApp } from '../../context/AppContext';

interface DiagnosticsCenterProps {
  connectionState: SyncConnectionState;
  devicePresences: Map<string, DevicePresenceState>;
  pendingCount: number;
  hostStatus?: P2pHostStartResult | null;
  roomState?: PresenceRoomState | null;
  id?: string;
}

export const DiagnosticsCenter: React.FC<DiagnosticsCenterProps> = ({
  connectionState,
  devicePresences,
  pendingCount,
  hostStatus,
  roomState,
  id
}) => {
  const { _t } = useApp();
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [attempts, setAttempts] = useState<P2pDiagnosticAttempt[]>(() => getLastP2pAttempts());
  const [testResults, setTestResults] = useState<{
    brokerReady: 'pass' | 'fail';
    peersReady: 'pass' | 'standby';
    storageIntegrity: 'pass' | 'fail';
    benchmark: BenchmarkMetrics | null;
    timestamp: number;
  } | null>(null);

  const details = connectivityEngine.getDetails();

  const runFullDiagnostics = async () => {
    setIsRunningTests(true);
    try {
      const connState = await connectivityEngine.checkConnectivity();
      const benchmark = runSyncStressBenchmark();
      const latestDetails = connectivityEngine.getDetails();
      setAttempts(getLastP2pAttempts());

      setTestResults({
        brokerReady: latestDetails.brokerConnected ? 'pass' : 'fail',
        peersReady: connState === 'SYNC_READY' || connState === 'SYNCING' ? 'pass' : 'standby',
        storageIntegrity:
          benchmark.performanceGrade === 'OPTIMAL' || benchmark.performanceGrade === 'ACCEPTABLE'
            ? 'pass'
            : 'fail',
        benchmark,
        timestamp: Date.now()
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  const presenceList: DevicePresenceState[] = devicePresences ? Array.from(devicePresences.values()) : [];

  const fullDiagnosticLog = {
    system: {
      clientTime: new Date().toISOString(),
      connectionState,
      brokerConnected: details.brokerConnected,
      discoveredCount: details.discoveredCount,
      lastIceCandidateType: details.lastIceCandidateType,
      lastBrokerErrorCode: details.lastBrokerErrorCode,
      lastErrorMessage: details.lastErrorMessage,
      pendingOutboxCount: pendingCount,
      roomStatus: roomState?.status || 'idle',
      hostPeerId: hostStatus?.peerId || null
    },
    presences: presenceList,
    recentAttempts: attempts,
    storagePersistenceFailures: getStoragePersistenceDiagnostics(),
    testResults
  };

  return (
    <div id={id} className="space-y-5">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main">
              {_t('تشخيص اتصال WebRTC P2P', 'WebRTC P2P Sync Diagnostics', 'WebRTC-P2P-Diagnose')}
            </h3>
            <p className="text-xs text-text-muted">
              {_t(
                'فحص اتصال خادم الإشارة، الأجهزة المكتشفة، مسار ICE، وسرعة الدمج المحلي.',
                'Inspects signalling status, room discovery, ICE path, and local storage throughput.',
                'Prüft Signalisierung, Erkennung, ICE-Pfad und Speicherdurchsatz.'
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runFullDiagnostics}
          disabled={isRunningTests}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs disabled:opacity-40 shrink-0 cursor-pointer"
        >
          <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
          <span>{isRunningTests ? _t('جاري الفحص...', 'Testing...', 'Teste...') : _t('تشغيل الفحص', 'Run Diagnostics', 'Test starten')}</span>
        </button>
      </div>

      {/* Live P2P Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-xl border border-surface-border bg-surface">
          <div className="text-[11px] text-text-muted">Signalling</div>
          <div className="font-bold text-text-main mt-0.5">
            {details.brokerConnected ? 'Connected' : details.lastBrokerErrorCode || 'Disconnected'}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-surface-border bg-surface">
          <div className="text-[11px] text-text-muted">State</div>
          <div className="font-mono font-bold text-text-main mt-0.5 truncate">{connectionState}</div>
        </div>
        <div className="p-3 rounded-xl border border-surface-border bg-surface">
          <div className="text-[11px] text-text-muted">Discovered</div>
          <div className="font-mono font-bold text-text-main mt-0.5 tabular-nums">{details.discoveredCount}</div>
        </div>
        <div className="p-3 rounded-xl border border-surface-border bg-surface">
          <div className="text-[11px] text-text-muted">ICE Candidate</div>
          <div className="font-mono font-bold text-text-main mt-0.5">{details.lastIceCandidateType || '—'}</div>
        </div>
      </div>

      {/* Benchmark & Connectivity Test Results */}
      {testResults && (
        <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-text-main">{_t('نتائج الفحص', 'Test Results', 'Testergebnisse')}</span>
            <span className="font-mono text-text-muted tabular-nums">
              {new Date(testResults.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl border border-surface-border bg-background flex items-center justify-between">
              <span className="font-semibold text-text-main">{_t('خادم الإشارة WebRTC', 'P2P Signalling', 'P2P-Signalisierung')}</span>
              {testResults.brokerReady === 'pass' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {_t('متصل', 'Connected', 'Verbunden')}
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {_t('غير متصل', 'Offline', 'Offline')}
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl border border-surface-border bg-background flex items-center justify-between">
              <span className="font-semibold text-text-main">{_t('جاهزية المزامنة', 'Sync Peer State', 'Sync-Status')}</span>
              {testResults.peersReady === 'pass' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {_t('نشط', 'Ready', 'Bereit')}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {_t('استعداد', 'Standby', 'Standby')}
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl border border-surface-border bg-background flex items-center justify-between">
              <span className="font-semibold text-text-main">{_t('كفاءة الدمج المحلي', 'Storage Merge', 'Speicher')}</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {testResults.benchmark?.performanceGrade} ({testResults.benchmark?.mergeExecutionTimeMs}ms)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Last Connection Attempts Log */}
      <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-main">
            {_t('سجل آخر محاولات اتصال P2P', 'Last P2P Connection Attempts', 'Letzte P2P-Verbindungsversuche')}
          </span>
          <span className="text-[11px] font-mono text-text-muted tabular-nums">{attempts.length}</span>
        </div>

        {attempts.length === 0 ? (
          <p className="text-xs text-text-muted py-2">
            {_t('لم يتم تسجيل محاولات اتصال P2P بعد في هذه الجلسة.', 'No P2P requests executed in this session yet.', 'Noch keine P2P-Anfragen in dieser Sitzung.')}
          </p>
        ) : (
          <div className="divide-y divide-surface-border rounded-xl border border-surface-border max-h-52 overflow-y-auto text-xs">
            {attempts.slice(0, 10).map((att) => (
              <div key={att.id} className="p-2.5 flex items-center justify-between gap-2 bg-background">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-text-main truncate tabular-nums">
                    [{att.operation}] {att.targetPeerId}
                    {att.errorCode ? ` · ${att.errorCode}` : ''}
                    {att.iceCandidateType ? ` · ${att.iceCandidateType}` : ''}
                  </div>
                  {att.message && <div className="text-[11px] text-text-muted truncate">{att.message}</div>}
                </div>
                <div className="text-right shrink-0 font-mono text-[11px] tabular-nums">
                  <span className={att.ok ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                    {att.ok ? 'OK' : 'ERR'}
                  </span>
                  {typeof att.latencyMs === 'number' && (
                    <div className="text-text-muted">{att.latencyMs}ms</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostic JSON Export (Secret-free) */}
      <CopyableBlock
        title={_t('تقرير التشخيص الكامل (منقح)', 'Diagnostic Export JSON (Redacted)', 'Diagnose-Bericht JSON')}
        content={JSON.stringify(fullDiagnosticLog, null, 2)}
        maxHeight="max-h-48"
      />
    </div>
  );
};
