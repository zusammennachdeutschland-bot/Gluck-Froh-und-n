import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  AlertTriangle
} from 'lucide-react';
import { SyncConnectionState, DevicePresenceState, LanHostStatus, LanDiagnosticAttempt } from '../../types';
import { CopyableBlock } from './CopyableBlock';
import { connectivityEngine } from '../../services/sync/connectivityEngine';
import { getLanNetworkStatus, getLastLanAttempts } from '../../services/sync/lanTransport';
import { runSyncStressBenchmark, BenchmarkMetrics } from '../../services/sync/benchmarkSync';
import { getStoragePersistenceDiagnostics } from '../../services/storageService';
import { useApp } from '../../context/AppContext';

interface DiagnosticsCenterProps {
  connectionState: SyncConnectionState;
  devicePresences: Map<string, DevicePresenceState>;
  pendingCount: number;
  hostStatus?: LanHostStatus | null;
  id?: string;
}

export const DiagnosticsCenter: React.FC<DiagnosticsCenterProps> = ({
  connectionState,
  devicePresences,
  pendingCount,
  hostStatus,
  id
}) => {
  const { _t } = useApp();
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [attempts, setAttempts] = useState<LanDiagnosticAttempt[]>(() => getLastLanAttempts());
  const [testResults, setTestResults] = useState<{
    lanReady: 'pass' | 'fail';
    hostOrClientReady: 'pass' | 'standby';
    storageIntegrity: 'pass' | 'fail';
    localIps: string[];
    benchmark: BenchmarkMetrics | null;
    timestamp: number;
  } | null>(null);

  const runFullDiagnostics = async () => {
    setIsRunningTests(true);
    try {
      const [netStatus, connState] = await Promise.all([
        getLanNetworkStatus(),
        connectivityEngine.checkConnectivity()
      ]);
      const benchmark = runSyncStressBenchmark();
      setAttempts(getLastLanAttempts());

      setTestResults({
        lanReady: netStatus.lanConnected || netStatus.wifiConnected ? 'pass' : 'fail',
        hostOrClientReady:
          hostStatus?.listening || connState === 'SYNC_READY' || connState === 'SYNCING' ? 'pass' : 'standby',
        storageIntegrity:
          benchmark.performanceGrade === 'OPTIMAL' || benchmark.performanceGrade === 'ACCEPTABLE' ? 'pass' : 'fail',
        localIps: netStatus.localIpv4Addresses || [],
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
      pendingOutboxCount: pendingCount,
      hostStatus: hostStatus
        ? {
            listening: hostStatus.listening,
            primaryIp: hostStatus.primaryIp,
            addresses: hostStatus.addresses,
            port: hostStatus.port,
            verificationCode: hostStatus.verificationCode,
            bindError: hostStatus.bindError
          }
        : null
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
              {_t('تشخيص اتصال الشبكة المحلية', 'Local Wi-Fi Sync Diagnostics', 'LAN-Synchronisationsdiagnose')}
            </h3>
            <p className="text-xs text-text-muted">
              {_t('فحص واجهات الشبكة المحلية، سجل محاولات الاتصال، وسرعة التخزين دون الحاجة للإنترنت.', 'Inspects local Wi-Fi interfaces, last connection attempts, and storage merge performance.', 'Prüft WLAN-Schnittstellen, letzte Verbindungsversuche und Speicherdurchsatz.')}
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
              <span className="font-semibold text-text-main">{_t('شبكة Wi-Fi / LAN', 'Wi-Fi / LAN Interface', 'WLAN / LAN')}</span>
              {testResults.lanReady === 'pass' ? (
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
              <span className="font-semibold text-text-main">{_t('جاهزية المزامنة', 'Sync Endpoint State', 'Sync-Status')}</span>
              {testResults.hostOrClientReady === 'pass' ? (
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
            {_t('سجل آخر محاولات الاتصال المحلي', 'Last LAN Connection Attempts', 'Letzte LAN-Verbindungsversuche')}
          </span>
          <span className="text-[11px] font-mono text-text-muted tabular-nums">{attempts.length}</span>
        </div>

        {attempts.length === 0 ? (
          <p className="text-xs text-text-muted py-2">
            {_t('لم يتم تسجيل محاولات اتصال محلي بعد في هذه الجلسة.', 'No LAN requests executed in this session yet.', 'Noch keine LAN-Anfragen in dieser Sitzung.')}
          </p>
        ) : (
          <div className="divide-y divide-surface-border rounded-xl border border-surface-border max-h-52 overflow-y-auto text-xs">
            {attempts.slice(0, 10).map((att) => (
              <div key={att.id} className="p-2.5 flex items-center justify-between gap-2 bg-background">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-text-main truncate tabular-nums">
                    [{att.operation}] {att.targetIp}:{att.port}
                    {att.errorCode ? ` · ${att.errorCode}` : ''}
                  </div>
                  {att.message && <div className="text-[11px] text-text-muted truncate">{att.message}</div>}
                </div>
                <div className="text-right shrink-0 font-mono text-[11px] tabular-nums">
                  <span className={att.ok ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                    {att.ok ? 'OK' : att.httpStatus ? `HTTP ${att.httpStatus}` : 'ERR'}
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

      {/* Diagnostic JSON Export */}
      <CopyableBlock
        title={_t('تقرير التشخيص الكامل', 'Diagnostic Export JSON', 'Diagnose-Bericht JSON')}
        content={JSON.stringify(fullDiagnosticLog, null, 2)}
        maxHeight="max-h-48"
      />
    </div>
  );
};
