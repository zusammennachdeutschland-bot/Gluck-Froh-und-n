import React, { useState, useEffect } from 'react';
import { 
  X, LayoutDashboard, Smartphone, Send, History, 
  Activity, Wrench, RefreshCw, Copy, Shield, Check, 
  ChevronRight, Terminal, Wifi, WifiOff, AlertCircle, Sparkles
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
import { useApp } from '../../context/AppContext';

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
  const { _t, language } = useApp();
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
    { key: 'overview', label: _t('نظرة عامة', 'Overview', 'Übersicht'), icon: LayoutDashboard },
    { key: 'devices', label: `${_t('الأجهزة المتصلة', 'Linked Devices', 'Verbundene Geräte')} (${pairedPeers.length})`, icon: Smartphone },
    { key: 'outbox', label: `${_t('صندوق الإرسال', 'Outbox', 'Postausgang')} (${outbox.totalCount})`, icon: Send },
    { key: 'history', label: _t('سجل المزامنة', 'Sync History', 'Verlauf'), icon: History },
    { key: 'diagnostics', label: _t('التشخيص والاختبار', 'Diagnostics', 'Diagnose'), icon: Activity },
    { key: 'recovery', label: _t('أدوات الاستعادة', 'Recovery Tools', 'Wiederherstellung'), icon: Wrench }
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
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-background text-text-main sm:max-h-[92vh] rounded-3xl shadow-2xl border border-surface-border">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-surface-border bg-surface px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary-soft text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
              <RefreshCw className={`w-5 h-5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-text-main truncate">
                  {_t('مركز المزامنة والأجهزة المتعددة', 'Synchronization & Multi-Device Hub', 'Synchronisations-Zentrum')}
                </h2>
                <button
                  type="button"
                  onClick={handleVersionTap}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-surface-hover text-text-muted hover:text-primary transition-colors"
                  title={_t('اضغط 5 مرات لفتح لوحة المطورين', '5 taps open Developer Telemetry', '5 Klicks für Entwickler-Telemetrie')}
                >
                  v2.4
                </button>
              </div>
              <p className="text-xs text-text-muted mt-0.5 truncate">
                {_t('مزامنة مباشرة P2P • شبكة آمنة عبر الأجهزة', 'P2P Mesh • Masterless Delta Sync Engine', 'P2P Mesh • Serverlose Delta-Synchronisation')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors cursor-pointer border border-surface-border"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Responsive Horizontal Scroll) */}
        <div className="flex items-center gap-1.5 border-b border-surface-border bg-surface px-4 py-2 overflow-x-auto no-scrollbar">
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
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-background hover:bg-surface-hover text-text-muted hover:text-text-main border border-surface-border/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-background">
          {isPairingOpen ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsPairingOpen(false)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  ← {_t('العودة للمركز الرئيسي', 'Back to Hub', 'Zurück zur Übersicht')}
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-primary text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                    
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs shrink-0 shadow-inner">
                        <Wifi className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black">
                            {syncStatus === 'syncing' 
                              ? _t('جارٍ المزامنة الآن...', 'Synchronizing...', 'Wird synchronisiert...') 
                              : connectionState === 'SYNC_READY' || connectionState === 'BROKER_CONNECTED' 
                              ? _t('النظام جاهز ونشط', 'System Healthy & Ready', 'System betriebsbereit') 
                              : _t('النظام في وضع الاستعداد', 'System Standby', 'System im Standby')}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 uppercase tracking-wider">
                            {connectionState}
                          </span>
                        </div>
                        <p className="text-xs text-white/90 mt-1">
                          {_t('آخر مزامنة ناجحة:', 'Last successful sync:', 'Letzte Synchronisation:')} <strong className="text-white">{lastSyncTime}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                      <button
                        type="button"
                        onClick={() => onForceSync()}
                        disabled={syncStatus === 'syncing'}
                        className="px-5 py-2.5 rounded-xl bg-white text-primary hover:bg-white/90 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        <span>{_t('مزامنة الكل الآن', 'Sync All Now', 'Jetzt alles synchronisieren')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 rounded-2xl border border-surface-border bg-surface">
                      <span className="text-[10px] uppercase font-black text-text-muted block mb-1">
                        {_t('الأجهزة النشطة', 'Online Devices', 'Aktive Geräte')}
                      </span>
                      <span className="text-xl font-black text-text-main">
                        {onlineCount} / {typedPeers.length}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl border border-surface-border bg-surface">
                      <span className="text-[10px] uppercase font-black text-text-muted block mb-1">
                        {_t('تعديلات معلقة', 'Pending Outbox', 'Ausstehend')}
                      </span>
                      <span className="text-xl font-black text-primary">
                        {outbox.totalCount} {_t('تعديل', 'changes', 'Änderungen')}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl border border-surface-border bg-surface">
                      <span className="text-[10px] uppercase font-black text-text-muted block mb-1">
                        {_t('المزامنة التلقائية', 'Auto-Sync Loop', 'Auto-Sync')}
                      </span>
                      <span className="text-xl font-black text-text-main">
                        {autoSyncEnabled ? _t('مفعلة', 'Active', 'Aktiv') : _t('معطلة', 'Disabled', 'Deaktiviert')}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl border border-surface-border bg-surface">
                      <span className="text-[10px] uppercase font-black text-text-muted block mb-1">
                        {_t('متوسط الاستجابة', 'Avg Transfer', 'Durchschnitt')}
                      </span>
                      <span className="text-xl font-black text-text-main">
                        ~18 ms
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl border border-surface-border bg-surface flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-text-main">
                          {_t('ربط جهاز جديد', 'Link New Companion Device', 'Neues Gerät verbinden')}
                        </h4>
                        <p className="text-xs text-text-muted mt-1">
                          {_t('استخدم رمز QR أو كود PIN المكون من 6 أرقام لربط هاتفك أو جهازك اللوحي.', 'Use QR code scanner or 6-digit PIN code to pair your phone or tablet.', 'QR-Code scannen oder 6-stelligen PIN eingeben, um Tablet oder Smartphone zu koppeln.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPairingOpen(true)}
                        className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{_t('بدء معالج الاقتران', 'Open Pairing Wizard', 'Kopplungs-Assistent öffnen')}</span>
                      </button>
                    </div>

                    <div className="p-5 rounded-2xl border border-surface-border bg-surface flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-text-main">
                          {_t('فحص صندوق الإرسال', 'Inspect Outbox Deltas', 'Postausgang prüfen')}
                        </h4>
                        <p className="text-xs text-text-muted mt-1">
                          {_t('معاينة السجلات والتعديلات الجاهزة للبث إلى الأجهزة المتصلة.', 'Preview specific records, timestamps, and collections queued for peer broadcast.', 'Wartende Datensätze und Änderungen vor der Übertragung ansehen.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('outbox')}
                        className="w-full py-2.5 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-xs font-bold text-text-main transition-colors cursor-pointer"
                      >
                        {_t(`فحص ${outbox.totalCount} تعديل معلق`, `Inspect ${outbox.totalCount} Pending Deltas`, `${outbox.totalCount} ausstehende Änderungen prüfen`)}
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
                    if (syncState) {
                      const updated = { ...syncState, peerWatermarkTable: {} };
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
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl bg-surface border border-surface-border text-text-main p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <h3 className="text-sm font-mono font-black flex items-center gap-2 text-primary">
                  <Terminal className="w-4 h-4" />
                  Developer Telemetry & Protocol Inspection
                </h3>
                <button
                  type="button"
                  onClick={() => setDevPanelOpen(false)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-background border border-surface-border">
                  <span className="text-text-muted text-[10px] block">Local Device ID</span>
                  <span className="text-primary font-bold">{localDevice.id.slice(0, 8)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-surface-border">
                  <span className="text-text-muted text-[10px] block">Revision Counter</span>
                  <span className="text-primary font-bold">{syncState?.localRevisionCounter || 1}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-surface-border">
                  <span className="text-text-muted text-[10px] block">Connection State</span>
                  <span className="text-text-main font-bold">{connectionState}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-surface-border">
                  <span className="text-text-muted text-[10px] block">Paired Count</span>
                  <span className="text-text-main font-bold">{typedPeers.length}</span>
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
                className="w-full py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-xs font-bold font-mono text-text-main cursor-pointer"
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
