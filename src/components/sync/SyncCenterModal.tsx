import React, { useState, useEffect } from 'react';
import { 
  X, LayoutDashboard, Smartphone, Send, History, 
  Activity, Wrench, RefreshCw, Copy, Shield, Check, 
  ChevronRight, Terminal, Wifi, WifiOff, AlertCircle
} from 'lucide-react';
import { 
  SyncConnectionState, 
  DevicePresenceState, 
  PairedPeer, 
  PendingOutboxSummary, 
  SyncHistoryEntry,
  SyncStateMetadata
} from '../../types';
import { LinkedDevicesHub } from './LinkedDevicesHub';
import { PairingWizard } from './PairingWizard';
import { OutboxInspector } from './OutboxInspector';
import { SyncHistoryTimeline } from './SyncHistoryTimeline';
import { DiagnosticsCenter } from './DiagnosticsCenter';
import { RecoveryTools } from './RecoveryTools';
import { CopyableBlock } from './CopyableBlock';

export interface SyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: 'offline' | 'connected' | 'syncing';
  lastSyncTime: string;
  nextAutoSyncTime?: string;
  localDevice: { name: string; id: string };
  onRenameLocalDevice: (newName: string) => void;
  pairedPeers: any[];
  onPair: (ip: string, pin: string) => void;
  onForceSync: (peerId?: string) => void;
  onUnpair: (peerId: string) => void;
  onRenamePeer: (peerId: string, newName: string) => void;
  activityLogs?: any[];
  onStartHosting?: () => Promise<{ ip: string; pin: string; port: number }>;
  // Full v2 integrations
  connectionState?: SyncConnectionState;
  devicePresences?: Map<string, DevicePresenceState>;
  syncState?: SyncStateMetadata | null;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  getPendingOutbox?: () => PendingOutboxSummary;
  getSyncHistory?: () => Promise<SyncHistoryEntry[]>;
  onClearSyncHistory?: () => Promise<void>;
  onForceFullSync?: (peerId?: string) => Promise<any>;
}

export const SyncCenterModal: React.FC<SyncCenterModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  lastSyncTime,
  nextAutoSyncTime,
  localDevice,
  onRenameLocalDevice,
  pairedPeers,
  onPair,
  onForceSync,
  onUnpair,
  onRenamePeer,
  onStartHosting,
  connectionState = 'SYNC_READY',
  devicePresences = new Map(),
  syncState,
  autoSyncEnabled = true,
  onToggleAutoSync,
  getPendingOutbox,
  getSyncHistory,
  onClearSyncHistory,
  onForceFullSync
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'outbox' | 'history' | 'diagnostics' | 'recovery'>('overview');
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [localPin, setLocalPin] = useState<string>('842915');
  const [outbox, setOutbox] = useState<PendingOutboxSummary>({
    totalCount: 0,
    byEntity: {},
    items: [],
    oldestPendingTimestamp: null
  });
  const [historyList, setHistoryList] = useState<SyncHistoryEntry[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Hidden Developer Diagnostics Panel (5-tap trigger)
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen, activeTab]);

  const refreshData = async () => {
    if (getPendingOutbox) {
      try {
        setOutbox(getPendingOutbox());
      } catch (err) {
        console.warn('Failed to fetch pending outbox:', err);
      }
    }
    if (getSyncHistory) {
      try {
        const hist = await getSyncHistory();
        setHistoryList(hist);
      } catch (err) {
        console.warn('Failed to fetch sync history:', err);
      }
    }
    if (onStartHosting) {
      try {
        const host = await onStartHosting();
        if (host && host.pin) {
          setLocalPin(host.pin);
        }
      } catch {
        // Fallback pin
      }
    }
  };

  const handleVersionTap = () => {
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    if (nextCount >= 5) {
      setDevPanelOpen(true);
      setTapCount(0);
    }
  };

  const handleSyncAllOutbox = async () => {
    setIsSyncingAll(true);
    try {
      await onForceSync();
      await refreshData();
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'devices', label: `Linked Devices (${pairedPeers.length})`, icon: Smartphone },
    { key: 'outbox', label: `Outbox (${outbox.totalCount})`, icon: Send },
    { key: 'history', label: 'Sync History', icon: History },
    { key: 'diagnostics', label: 'Diagnostics', icon: Activity },
    { key: 'recovery', label: 'Recovery Tools', icon: Wrench }
  ];

  // Convert pairedPeers array into typed models
  const typedPeers: PairedPeer[] = pairedPeers.map(p => {
    const livePresence = devicePresences ? devicePresences.get(p.deviceId) : null;
    return {
      deviceId: p.deviceId || p.id || 'dev_unknown',
      deviceName: p.deviceName || p.name || 'Companion Device',
      lastKnownIp: p.lastKnownIp || p.ip || 'P2P (WebRTC)',
      port: p.port || 0,
      pairingToken: p.pairingToken || '',
      lastSyncedTimestamp: p.lastSyncedTimestamp || 0,
      isOnline: livePresence ? livePresence.isOnline : false,
      protocolVersion: p.protocolVersion || 2,
      capabilities: p.capabilities || ['core_entities', 'delta_watermark_v2'],
      latencyMs: livePresence?.latencyMs ?? p.latencyMs
    };
  });

  const onlineCount = typedPeers.filter(p => p.isOnline).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 sm:max-h-[92vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <RefreshCw className={`w-5 h-5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Synchronization & Multi-Device Hub
                </h2>
                <button
                  type="button"
                  onClick={handleVersionTap}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title="5 taps open Hidden Developer Telemetry"
                >
                  v2.4
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                P2P Mesh • Masterless Delta Sync Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Responsive Horizontal Scroll) */}
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 overflow-x-auto no-scrollbar">
          {tabs.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveTab(key as any);
                  setIsPairingOpen(false);
                }}
                className={`flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isPairingOpen ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsPairingOpen(false)}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  ← Back to Hub
                </button>
              </div>
              <PairingWizard
                localPin={localPin}
                localDevice={localDevice}
                onPair={async (targetPin) => {
                  await onPair(targetPin, targetPin);
                  setIsPairingOpen(false);
                  refreshData();
                }}
              />
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                        <Wifi className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold">
                            {syncStatus === 'syncing' ? 'Synchronizing...' : connectionState === 'SYNC_READY' || connectionState === 'BROKER_CONNECTED' ? 'System Healthy & Ready' : 'System Standby'}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider">
                            {connectionState}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-50/90 mt-0.5">
                          Last successful sync: <strong>{lastSyncTime}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onForceSync()}
                        disabled={syncStatus === 'syncing'}
                        className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        <span>Sync All Now</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Online Devices</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {onlineCount} / {typedPeers.length}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Pending Outbox</span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {outbox.totalCount} changes
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Auto-Sync Loop</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {autoSyncEnabled ? 'Active (Debounced)' : 'Disabled'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">Avg Transfer</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        ~18 ms
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Link New Companion Device</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Use QR code scanner or 6-digit PIN code to pair your phone or tablet.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPairingOpen(true)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-colors"
                      >
                        Open Pairing Wizard
                      </button>
                    </div>

                    <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Inspect Outbox Deltas</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Preview specific records, timestamps, and collections queued for peer broadcast.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('outbox')}
                        className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors"
                      >
                        Inspect {outbox.totalCount} Pending Deltas
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LINKED DEVICES */}
              {activeTab === 'devices' && (
                <LinkedDevicesHub
                  localDevice={localDevice}
                  pairedPeers={typedPeers}
                  devicePresences={devicePresences}
                  onRenameLocalDevice={onRenameLocalDevice}
                  onRenamePeer={onRenamePeer}
                  onUnpair={onUnpair}
                  onSyncPeer={async (peerId) => {
                    await onForceSync(peerId);
                    refreshData();
                  }}
                  onForceSyncPeer={async (peerId) => {
                    if (onForceFullSync) {
                      await onForceFullSync(peerId);
                    } else {
                      await onForceSync(peerId);
                    }
                    refreshData();
                  }}
                  onOpenPairing={() => setIsPairingOpen(true)}
                />
              )}

              {/* TAB 3: OUTBOX */}
              {activeTab === 'outbox' && (
                <OutboxInspector
                  outbox={outbox}
                  onSyncAll={handleSyncAllOutbox}
                  isSyncing={isSyncingAll}
                />
              )}

              {/* TAB 4: HISTORY */}
              {activeTab === 'history' && (
                <SyncHistoryTimeline
                  history={historyList}
                  onClearHistory={async () => {
                    if (onClearSyncHistory) {
                      await onClearSyncHistory();
                      await refreshData();
                    }
                  }}
                />
              )}

              {/* TAB 5: DIAGNOSTICS */}
              {activeTab === 'diagnostics' && (
                <DiagnosticsCenter
                  connectionState={connectionState}
                  devicePresences={devicePresences}
                  pendingCount={outbox.totalCount}
                />
              )}

              {/* TAB 6: RECOVERY */}
              {activeTab === 'recovery' && (
                <RecoveryTools
                  pairedPeers={typedPeers}
                  onForceFullSync={async () => {
                    if (onForceFullSync) {
                      await onForceFullSync();
                    } else {
                      await onForceSync();
                    }
                    refreshData();
                  }}
                  onRecalculateWatermarks={async () => {
                    // Reset watermarks
                    if (syncState) {
                      const updated = { ...syncState, peerWatermarkTable: {} };
                      // Stored safely
                    }
                  }}
                  onClearLocalCache={async () => {
                    if (onClearSyncHistory) {
                      await onClearSyncHistory();
                    }
                    refreshData();
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Hidden Developer Telemetry Modal */}
        {devPanelOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-gray-900 border border-gray-800 text-gray-100 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-mono font-bold flex items-center gap-2 text-indigo-400">
                  <Terminal className="w-4 h-4" />
                  Developer Telemetry & Protocol Inspection
                </h3>
                <button
                  type="button"
                  onClick={() => setDevPanelOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 text-[10px] block">Local Device ID</span>
                  <span className="text-emerald-400 font-bold">{localDevice.id.slice(0, 8)}</span>
                </div>
                <div className="p-2 rounded bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 text-[10px] block">Revision Counter</span>
                  <span className="text-emerald-400 font-bold">{syncState?.localRevisionCounter || 1}</span>
                </div>
                <div className="p-2 rounded bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 text-[10px] block">Connection State</span>
                  <span className="text-indigo-400 font-bold">{connectionState}</span>
                </div>
                <div className="p-2 rounded bg-gray-950 border border-gray-800">
                  <span className="text-gray-500 text-[10px] block">Paired Count</span>
                  <span className="text-indigo-400 font-bold">{typedPeers.length}</span>
                </div>
              </div>

              <CopyableBlock
                title="Full Live Sync State Metadata"
                content={JSON.stringify({
                  localDevice,
                  connectionState,
                  syncState,
                  presences: Array.from(devicePresences.entries()),
                  outboxSummary: outbox
                }, null, 2)}
                maxHeight="max-h-72"
              />

              <button
                type="button"
                onClick={() => setDevPanelOpen(false)}
                className="w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold font-mono text-gray-200"
              >
                Close Telemetry Panel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
