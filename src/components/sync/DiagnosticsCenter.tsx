import React, { useState } from 'react';
import { 
  Activity, Wifi, Globe, Shield, Lock, Server, 
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, 
  Terminal, Play, Database, Layers
} from 'lucide-react';
import { SyncConnectionState, DevicePresenceState } from '../../types';
import { CopyableBlock } from './CopyableBlock';
import { connectivityEngine } from '../../services/sync/connectivityEngine';
import { runSyncStressBenchmark, BenchmarkMetrics } from '../../services/sync/benchmarkSync';
import { useApp } from '../../context/AppContext';

interface DiagnosticsCenterProps {
  connectionState: SyncConnectionState;
  devicePresences: Map<string, DevicePresenceState>;
  pendingCount: number;
  id?: string;
}

export const DiagnosticsCenter: React.FC<DiagnosticsCenterProps> = ({
  connectionState,
  devicePresences,
  pendingCount,
  id
}) => {
  const { _t } = useApp();
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    internetReachability: 'pass' | 'fail' | 'testing';
    brokerSignaling: 'pass' | 'fail' | 'testing';
    storageIntegrity: 'pass' | 'fail' | 'testing';
    benchmark: BenchmarkMetrics | null;
    timestamp: number;
  } | null>(null);

  const runFullDiagnostics = async () => {
    setIsRunningTests(true);

    try {
      // 1. Internet Reachability Test
      const connState = await connectivityEngine.checkConnectivity();
      const internetPass = connState !== 'OFFLINE' && connState !== 'NETWORK_CONNECTED';

      // 2. Storage & Benchmark Stress Test
      const benchmark = runSyncStressBenchmark();

      setTestResults({
        internetReachability: internetPass ? 'pass' : 'fail',
        brokerSignaling: connState === 'BROKER_CONNECTED' || connState === 'SYNC_READY' || connState === 'SYNCING' ? 'pass' : 'fail',
        storageIntegrity: benchmark.performanceGrade === 'OPTIMAL' || benchmark.performanceGrade === 'ACCEPTABLE' ? 'pass' : 'fail',
        benchmark,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn('Diagnostics test encountered error:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const getStatusBadge = (state: SyncConnectionState) => {
    switch (state) {
      case 'SYNC_READY':
      case 'BROKER_CONNECTED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">🟢 {_t('جاهز ومتصل', 'Healthy', 'Bereit')} ({state})</span>;
      case 'SYNCING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-primary-soft text-primary border border-primary/20">🔵 {_t('مزامنة جارية', 'Active Syncing', 'Aktiv')} ({state})</span>;
      case 'INTERNET_AVAILABLE':
      case 'NETWORK_CONNECTED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">🟡 {_t('في وضع الاستعداد', 'Standby', 'Standby')} ({state})</span>;
      case 'OFFLINE':
      case 'SYNC_ERROR':
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">🔴 {_t('غير متصل', 'Attention', 'Offline')} ({state})</span>;
    }
  };

  const presenceList: DevicePresenceState[] = devicePresences ? Array.from(devicePresences.values()) : [];

  const fullDiagnosticLog = {
    system: {
      clientTime: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      connectionState,
      pendingOutboxCount: pendingCount
    },
    presences: presenceList,
    testResults
  };

  return (
    <div id={id} className="space-y-6">
      {/* Top Banner & Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-surface-border shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary border border-primary/20 flex items-center justify-center shadow-xs shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-text-main">
              {_t('فحص وصحة نظام المزامنة والشبكة', 'System Health & Diagnostic Suite', 'Systemdiagnose & Netzwerkprüfung')}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {_t('قياس استجابة الأجهزة، فحص سلامة التخزين المحلي، وسجلات تتبع الأداء.', 'Real-time telemetry, peer latency graphs, and storage integrity validation.', 'Echtzeit-Telemetrie, Latenz und Speicherintegritätsprüfung.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runFullDiagnostics}
          disabled={isRunningTests}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary text-white font-bold text-xs transition-all shadow-xs disabled:opacity-40 shrink-0 cursor-pointer"
        >
          <Play className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
          <span>{isRunningTests ? _t('جارٍ تشغيل الفحص...', 'Running Diagnostic Tests...', 'Diagnose läuft...') : _t('بدء الفحص الشامل', 'Run Full System Test', 'Vollständigen Test starten')}</span>
        </button>
      </div>

      {/* State Machine Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-surface-border shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-2">{_t('حالة الاتصال العامة', 'State Machine', 'Verbindungsstatus')}</span>
          {getStatusBadge(connectionState)}
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-surface-border shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">{_t('الأجهزة المتصلة الحية', 'Active Presences', 'Aktive Geräte')}</span>
          <span className="font-black text-text-main text-sm">
            {presenceList.filter(p => p.isOnline).length} / {presenceList.length} {_t('متصل الآن', 'Connected', 'Verbunden')}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-surface-border shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">{_t('تعديلات قيد الإرسال', 'Pending Outbox', 'Wartende Änderungen')}</span>
          <span className="font-black text-text-main text-sm">
            {pendingCount} {_t('تعديلات معلقة', 'Deltas Queued', 'Deltas')}
          </span>
        </div>
      </div>

      {/* Active Diagnostics Test Output */}
      {testResults && (
        <div className="rounded-2xl border border-surface-border bg-surface p-5 space-y-4 shadow-xs">
          <h4 className="text-sm font-black text-text-main flex items-center justify-between">
            <span>{_t('نتائج الفحص الآلي للمنظومة', 'Automated Test Run Results', 'Automatische Testergebnisse')}</span>
            <span className="text-xs text-text-muted font-normal font-mono bg-background px-2.5 py-0.5 rounded-md border border-surface-border">
              {new Date(testResults.timestamp).toLocaleTimeString()}
            </span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-surface-border bg-background flex items-center justify-between">
              <span className="font-bold text-text-main">{_t('الوصول للإنترنت', 'Internet Reachability', 'Internetverbindung')}</span>
              {testResults.internetReachability === 'pass' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {_t('سليم', 'Pass', 'Bestanden')}</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-black flex items-center gap-1"><XCircle className="w-4 h-4" /> {_t('غير متوفر', 'Fail', 'Fehlgeschlagen')}</span>
              )}
            </div>
            <div className="p-3.5 rounded-xl border border-surface-border bg-background flex items-center justify-between">
              <span className="font-bold text-text-main">{_t('خادم الإشارات والتوجيه', 'Broker Signaling', 'Signalisierungs-Server')}</span>
              {testResults.brokerSignaling === 'pass' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {_t('سليم', 'Pass', 'Bestanden')}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-black flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {_t('استعداد', 'Standby', 'Standby')}</span>
              )}
            </div>
            <div className="p-3.5 rounded-xl border border-surface-border bg-background flex items-center justify-between">
              <span className="font-bold text-text-main">{_t('كفاءة التخزين المحلي', 'Storage Throughput', 'Speicherdurchsatz')}</span>
              {testResults.storageIntegrity === 'pass' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {testResults.benchmark?.performanceGrade}</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-black flex items-center gap-1"><XCircle className="w-4 h-4" /> {_t('منخفض', 'Degraded', 'Reduziert')}</span>
              )}
            </div>
          </div>

          {testResults.benchmark && (
            <div className="p-3.5 rounded-xl bg-background border border-surface-border text-xs space-y-1 font-mono text-text-muted">
              <div>Stress Test: <strong className="text-text-main">{testResults.benchmark.totalEntities} entities</strong> across <strong className="text-text-main">{testResults.benchmark.devicesSimulated} devices</strong></div>
              <div>Delta Generation: <strong className="text-text-main">{testResults.benchmark.deltaBuildTimeMs}ms</strong> | 3-Way Merge: <strong className="text-text-main">{testResults.benchmark.mergeExecutionTimeMs}ms</strong></div>
            </div>
          )}
        </div>
      )}

      {/* Copyable Full Telemetry Logs Container for Support */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-text-muted block">
          {_t('سجل التشخيص للتصدير والدعم الفني', 'Support Diagnostic Export', 'Diagnose-Export für Support')}
        </span>
        <CopyableBlock
          title={_t('تقرير فحص المنظومة الكامل (نسخ بنقرة واحدة)', 'Diagnostic Dump (One-Click Copy for Support)', 'Vollständiger Diagnosebericht (1-Klick-Kopie)')}
          content={JSON.stringify(fullDiagnosticLog, null, 2)}
          maxHeight="max-h-56"
        />
      </div>
    </div>
  );
};
