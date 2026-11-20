import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  LayoutDashboard,
  Smartphone,
  Send,
  History,
  Activity,
  Wrench,
  RefreshCw,
  Wifi,
  Cloud,
  CloudOff,
  Laptop,
  Plus
} from 'lucide-react';
import {
  SyncConnectionState,
  DevicePresenceState,
  PairedPeer,
  PendingOutboxSummary,
  SyncHistoryEntry,
  SyncStateMetadata,
  LanHostStatus
} from '../../types';
import { LinkedDevicesHub } from './LinkedDevicesHub';
import { PairingWizard } from './PairingWizard';
import { OutboxInspector } from './OutboxInspector';
import { SyncHistoryTimeline } from './SyncHistoryTimeline';
import { DiagnosticsCenter } from './DiagnosticsCenter';
import { RecoveryTools } from './RecoveryTools';
import { useApp } from '../../context/AppContext';
import {
  getLocalHostStatus,
  regenerateLanPairingCode,
  subscribeLanHostStatus
} from '../../services/sync/localServer';
import { isLegacyUnmigratedPeer } from '../../services/sync/lanVault';
import {
  getPendingHomeworkSyncCount,
  flushPendingHomeworkSyncQueue,
  syncAndFetchTeacherAssignments,
  isFirestoreReadQuotaExhausted
} from '../../shared/homeworkStorageSync';

export interface SyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: 'offline' | 'connected' | 'syncing';
  lastSyncTime: string;
  nextAutoSyncTime?: string;
  localDevice: { name: string; id: string };
  onRenameLocalDevice: (newName: string) => void;
  pairedPeers: PairedPeer[];
  onPair: (hostIp: string, port: number, pairingCode: string, expectedFingerprint?: string) => Promise<void>;
  onForceSync: (peerId?: string) => void;
  onUnpair: (peerId: string) => void;
  onRenamePeer: (peerId: string, newName: string) => void;
  activityLogs?: any[];
  onStartHosting?: (portOverride?: number) => Promise<LanHostStatus & { ip: string; pin: string }>;
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
  localDevice,
  onRenameLocalDevice,
  pairedPeers,
  onPair,
  onForceSync,
  onUnpair,
  onRenamePeer,
  onStartHosting,
  connectionState = 'NETWORK_CONNECTED',
  devicePresences = new Map(),
  syncState,
  autoSyncEnabled = true,
  getPendingOutbox,
  getSyncHistory,
  onClearSyncHistory,
  onForceFullSync
}) => {
  const { _t, updateSyncState } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'outbox' | 'history' | 'diagnostics' | 'recovery'>('overview');
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [pairingPrefill, setPairingPrefill] = useState<{ ip?: string; port?: number }>({});
  const [hostStatus, setHostStatus] = useState<LanHostStatus | null>(null);
  const [outbox, setOutbox] = useState<PendingOutboxSummary>({
    totalCount: 0,
    byEntity: {},
    items: [],
    oldestPendingTimestamp: null
  });
  const [historyList, setHistoryList] = useState<SyncHistoryEntry[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [hwCloudAvailable, setHwCloudAvailable] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine && !isFirestoreReadQuotaExhausted() : !isFirestoreReadQuotaExhausted()
  );
  const [pendingHwCount, setPendingHwCount] = useState<number>(() => getPendingHomeworkSyncCount());
  const [isSyncingHwCloud, setIsSyncingHwCloud] = useState(false);

  const refreshData = useCallback(async () => {
    setHwCloudAvailable(
      typeof navigator !== 'undefined' ? navigator.onLine && !isFirestoreReadQuotaExhausted() : !isFirestoreReadQuotaExhausted()
    );
    setPendingHwCount(getPendingHomeworkSyncCount());

    if (getPendingOutbox) {
      try {
        setOutbox(getPendingOutbox());
      } catch {}
    }
    if (getSyncHistory) {
      try {
        const hist = await getSyncHistory();
        setHistoryList(hist);
      } catch {}
    }
    try {
      const st = await getLocalHostStatus();
      setHostStatus(st);
      if (!st.listening && st.isSupported && onStartHosting) {
        const started = await onStartHosting();
        setHostStatus(started);
      }
    } catch {}
  }, [getPendingOutbox, getSyncHistory, onStartHosting]);

  useEffect(() => {
    if (!isOpen) return;
    void refreshData();
    const unsub = subscribeLanHostStatus((st) => setHostStatus(st));
    return unsub;
  }, [isOpen, activeTab, refreshData]);

  const handleSyncAllOutbox = async () => {
    setIsSyncingAll(true);
    try {
      await onForceSync();
      await refreshData();
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncHomeworkCloudNow = async () => {
    setIsSyncingHwCloud(true);
    try {
      await flushPendingHomeworkSyncQueue();
      await syncAndFetchTeacherAssignments();
      setPendingHwCount(getPendingHomeworkSyncCount());
    } finally {
      setIsSyncingHwCloud(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { key: 'overview', label: _t('نظرة عامة', 'Overview', 'Übersicht'), icon: LayoutDashboard },
    { key: 'devices', label: `${_t('الأجهزة', 'Devices', 'Geräte')} (${pairedPeers.length})`, icon: Smartphone },
    { key: 'outbox', label: `${_t('قيد الإرسال', 'Outbox', 'Postausgang')} (${outbox.totalCount})`, icon: Send },
    { key: 'history', label: _t('السجل', 'History', 'Verlauf'), icon: History },
    { key: 'diagnostics', label: _t('التشخيص', 'Diagnostics', 'Diagnose'), icon: Activity },
    { key: 'recovery', label: _t('الاستعادة', 'Recovery', 'Wiederherstellung'), icon: Wrench }
  ];

  const typedPeers: PairedPeer[] = (pairedPeers || []).map((p) => {
    const livePresence = devicePresences ? devicePresences.get(p.deviceId) : null;
    const legacy = isLegacyUnmigratedPeer(p);
    return {
      ...p,
      isOnline: !legacy && (livePresence ? livePresence.isOnline : false),
      latencyMs: livePresence?.latencyMs ?? p.latencyMs
    };
  });

  const onlineCount = typedPeers.filter((p) => p.isOnline).length;
  const legacyPeersCount = typedPeers.filter((p) => isLegacyUnmigratedPeer(p)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-background text-text-main sm:max-h-[90vh] rounded-3xl shadow-2xl border border-surface-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border bg-surface px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <Wifi className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-text-main truncate">
                {_t('المزامنة المباشرة عبر شبكة Wi-Fi', 'Direct LAN Sync', 'Direkte WLAN-Synchronisation')}
              </h2>
              <p className="text-[11px] text-text-muted truncate">
                {hostStatus?.isSupported
                  ? hostStatus.listening && hostStatus.primaryIp
                    ? `${_t('خادم الكمبيوتر:', 'PC Host:', 'PC Host:')} ${hostStatus.primaryIp}:${hostStatus.port}`
                    : _t('خادم الكمبيوتر جاهز للتهيئة', 'PC Sync Host initializing', 'PC Host wird vorbereitet')
                  : _t('اتصال مباشر بالكمبيوتر على نفس شبكة Wi-Fi دون إنترنت', 'Direct Wi-Fi sync with your PC Host (no internet needed)', 'Direkte WLAN-Verbindung zum PC')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-text-muted hover:bg-surface-hover hover:text-text-main border border-surface-border cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Strip */}
        <div className="border-b border-surface-border bg-surface px-4 py-2">
          <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border overflow-x-auto no-scrollbar">
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
                  className={`min-h-[34px] flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                    isActive
                      ? 'bg-surface text-primary border-surface-border shadow-2xs'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-background">
          {isPairingOpen ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsPairingOpen(false);
                  setPairingPrefill({});
                }}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                ← {_t('العودة', 'Back', 'Zurück')}
              </button>

              <PairingWizard
                localDevice={localDevice}
                hostStatus={hostStatus}
                onRefreshHostStatus={refreshData}
                onRegenerateCode={async () => {
                  const res = await regenerateLanPairingCode();
                  if (res?.status) setHostStatus(res.status);
                }}
                onUpdateHostPort={
                  onStartHosting
                    ? async (newPort) => {
                        const st = await onStartHosting(newPort);
                        setHostStatus(st);
                        if (syncState) {
                          await updateSyncState({ ...syncState, hostPort: st.port });
                        }
                      }
                    : undefined
                }
                onPair={async (hostIp, port, code, fp) => {
                  await onPair(hostIp, port, code, fp);
                  setIsPairingOpen(false);
                  setPairingPrefill({});
                  await refreshData();
                }}
                initialHostIp={pairingPrefill.ip}
                initialPort={pairingPrefill.port}
              />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Main Action Strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-primary text-primary-fg">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold">
                        {syncStatus === 'syncing'
                          ? _t('جاري المزامنة الآن...', 'Synchronizing...', 'Synchronisation läuft...')
                          : onlineCount > 0
                          ? _t(`متصل بـ ${onlineCount} جهاز عبر Wi-Fi`, `Connected to ${onlineCount} LAN device(s)`, `${onlineCount} Gerät(e) im WLAN verbunden`)
                          : hostStatus?.listening
                          ? _t('خادم الكمبيوتر نشط وبانتظار الأجهزة', 'PC Sync Host waiting for devices', 'PC Sync Host wartet auf Geräte')
                          : _t('غير متصل بجهاز كمبيوتر حالياً', 'Disconnected — Ready to search Wi-Fi', 'Getrennt — bereit für WLAN-Suche')}
                      </h3>
                      <p className="text-xs opacity-90 mt-0.5 tabular-nums">
                        {_t('آخر مزامنة:', 'Last sync:', 'Letzte Sync:')} <strong>{lastSyncTime}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPairingPrefill({});
                          setIsPairingOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-surface/15 hover:bg-surface/25 text-primary-fg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{_t('ربط / بحث Wi-Fi', 'Search / Pair', 'Koppeln / Suchen')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onForceSync()}
                        disabled={syncStatus === 'syncing' || typedPeers.length === 0}
                        className="px-3.5 py-2 rounded-xl bg-surface text-text-main hover:bg-surface-hover text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-primary ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        <span>{_t('مزامنة الآن', 'Sync Now', 'Jetzt syncen')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline PC Sync Host Summary (Electron Desktop Only) */}
                  {hostStatus?.isSupported && (
                    <div className="p-4 rounded-2xl border border-surface-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Laptop className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <div className="font-bold text-text-main">
                            {_t('PC Sync Host:', 'PC Sync Host:', 'PC Sync Host:')} {hostStatus.deviceName}
                          </div>
                          <div className="font-mono text-text-muted tabular-nums">
                            {hostStatus.primaryIp ? `${hostStatus.primaryIp}:${hostStatus.port}` : _t('لا توجد شبكة', 'No LAN IP', 'Keine LAN-IP')}
                            {hostStatus.pairingCode ? ` · Code: ${hostStatus.pairingCode}` : ''}
                            {hostStatus.verificationCode ? ` · TLS: ${hostStatus.verificationCode}` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await regenerateLanPairingCode();
                          if (res?.status) setHostStatus(res.status);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-xs font-bold text-text-main cursor-pointer shrink-0"
                      >
                        {_t('تحديث رمز الاقتران', 'New Code', 'Neuer Code')}
                      </button>
                    </div>
                  )}

                  {legacyPeersCount > 0 && (
                    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                      <span>
                        {_t(
                          `يوجد ${legacyPeersCount} جهاز قديم يتطلب إعادة اقتران بنظام الشبكة المحلية الجديد (لن يتم حذف أي بيانات).`,
                          `${legacyPeersCount} legacy device record(s) require quick LAN re-pairing (your data and history are preserved).`,
                          `${legacyPeersCount} älteres Gerät muss neu per WLAN gekoppelt werden.`
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('devices')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold shrink-0 cursor-pointer"
                      >
                        {_t('عرض', 'Review', 'Prüfen')}
                      </button>
                    </div>
                  )}

                  {/* Compact Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 rounded-2xl border border-surface-border bg-surface divide-x divide-y sm:divide-y-0 divide-surface-border overflow-hidden">
                    <div className="p-3.5">
                      <span className="text-[11px] font-semibold text-text-muted block mb-0.5">
                        {_t('الأجهزة النشطة', 'Online Peers', 'Aktive Geräte')}
                      </span>
                      <span className="text-base font-bold text-text-main tabular-nums">
                        {onlineCount} / {typedPeers.length}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[11px] font-semibold text-text-muted block mb-0.5">
                        {_t('تعديلات معلقة', 'Pending Outbox', 'Ausstehend')}
                      </span>
                      <span className="text-base font-bold text-primary tabular-nums">
                        {outbox.totalCount}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[11px] font-semibold text-text-muted block mb-0.5">
                        {_t('المزامنة التلقائية', 'Auto-Sync', 'Auto-Sync')}
                      </span>
                      <span className="text-base font-bold text-text-main">
                        {autoSyncEnabled ? _t('نشط', 'On', 'Ein') : _t('متوقف', 'Off', 'Aus')}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <span className="text-[11px] font-semibold text-text-muted block mb-0.5">
                        {_t('سحابة الواجبات', 'Homework Cloud', 'Hausaufgaben-Cloud')}
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold flex items-center gap-1 text-text-main">
                          {hwCloudAvailable ? <Cloud className="w-3.5 h-3.5 text-primary" /> : <CloudOff className="w-3.5 h-3.5 text-amber-500" />}
                          {pendingHwCount > 0 ? `${pendingHwCount} pending` : hwCloudAvailable ? 'OK' : 'Offline'}
                        </span>
                        {hwCloudAvailable && (
                          <button
                            type="button"
                            onClick={handleSyncHomeworkCloudNow}
                            disabled={isSyncingHwCloud}
                            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                          >
                            {isSyncingHwCloud ? '...' : _t('مزامنة', 'Sync', 'Sync')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                    await refreshData();
                  }}
                  onForceSyncPeer={async (peerId) => {
                    if (onForceFullSync) {
                      await onForceFullSync(peerId);
                    } else {
                      await onForceSync(peerId);
                    }
                    await refreshData();
                  }}
                  onOpenPairing={(prefill) => {
                    setPairingPrefill(
                      prefill && prefill.lastKnownIp && !isLegacyUnmigratedPeer(prefill)
                        ? { ip: prefill.lastKnownIp, port: prefill.port }
                        : {}
                    );
                    setIsPairingOpen(true);
                  }}
                />
              )}

              {activeTab === 'outbox' && (
                <OutboxInspector
                  outbox={outbox}
                  onSyncAll={handleSyncAllOutbox}
                  isSyncing={isSyncingAll}
                />
              )}

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

              {activeTab === 'diagnostics' && (
                <DiagnosticsCenter
                  connectionState={connectionState}
                  devicePresences={devicePresences}
                  pendingCount={outbox.totalCount}
                  hostStatus={hostStatus}
                />
              )}

              {activeTab === 'recovery' && (
                <RecoveryTools
                  pairedPeers={typedPeers}
                  onForceFullSync={async () => {
                    if (onForceFullSync) {
                      await onForceFullSync();
                    } else {
                      await onForceSync();
                    }
                    await refreshData();
                  }}
                  onRecalculateWatermarks={async () => {
                    if (syncState) {
                      await updateSyncState({ ...syncState, peerWatermarkTable: {} });
                    }
                  }}
                  onClearLocalCache={async () => {
                    if (onClearSyncHistory) {
                      await onClearSyncHistory();
                    }
                    await refreshData();
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
