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
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">🟢 Healthy ({state})</span>;
      case 'SYNCING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">🔵 Active ({state})</span>;
      case 'INTERNET_AVAILABLE':
      case 'NETWORK_CONNECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">🟡 Standby ({state})</span>;
      case 'OFFLINE':
      case 'SYNC_ERROR':
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">🔴 Attention ({state})</span>;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-gray-50 to-slate-100 dark:from-gray-900 dark:to-gray-800/80 border border-gray-200 dark:border-gray-700/80">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            System Health & Diagnostic Suite
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Real-time telemetry, peer latency graphs, and storage integrity validation.
          </p>
        </div>

        <button
          type="button"
          onClick={runFullDiagnostics}
          disabled={isRunningTests}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm transition-all shadow-md disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
          <span>{isRunningTests ? 'Running Diagnostic Tests...' : 'Run Full System Test'}</span>
        </button>
      </div>

      {/* State Machine Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">State Machine</span>
          {getStatusBadge(connectionState)}
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Active Presences</span>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {presenceList.filter(p => p.isOnline).length} / {presenceList.length} Connected
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">Pending Outbox</span>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {pendingCount} Deltas Queued
          </span>
        </div>
      </div>

      {/* Active Diagnostics Test Output */}
      {testResults && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-4">
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between">
            <span>Automated Test Run Results</span>
            <span className="text-xs text-gray-500 font-normal font-mono">
              {new Date(testResults.timestamp).toLocaleTimeString()}
            </span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Internet Reachability</span>
              {testResults.internetReachability === 'pass' ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Pass</span>
              ) : (
                <span className="text-red-600 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Fail</span>
              )}
            </div>
            <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Broker Signaling</span>
              {testResults.brokerSignaling === 'pass' ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Pass</span>
              ) : (
                <span className="text-amber-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Standby</span>
              )}
            </div>
            <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Storage Throughput</span>
              {testResults.storageIntegrity === 'pass' ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {testResults.benchmark?.performanceGrade}</span>
              ) : (
                <span className="text-red-600 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Degraded</span>
              )}
            </div>
          </div>

          {testResults.benchmark && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 text-xs space-y-1 font-mono text-gray-600 dark:text-gray-300">
              <div>Stress Test: <strong>{testResults.benchmark.totalEntities} entities</strong> across <strong>{testResults.benchmark.devicesSimulated} devices</strong></div>
              <div>Delta Generation: <strong>{testResults.benchmark.deltaBuildTimeMs}ms</strong> | 3-Way Merge: <strong>{testResults.benchmark.mergeExecutionTimeMs}ms</strong></div>
            </div>
          )}
        </div>
      )}

      {/* Copyable Full Telemetry Logs Container for Support */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
          Support Diagnostic Export
        </span>
        <CopyableBlock
          title="Diagnostic Dump (One-Click Copy for Support)"
          content={JSON.stringify(fullDiagnosticLog, null, 2)}
          maxHeight="max-h-56"
        />
      </div>
    </div>
  );
};
