import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, RefreshCw, Bell, Trash2, Clock, Plus, Zap,
  CheckCircle2, MonitorSmartphone
} from 'lucide-react';
import { NotificationsModal } from '../NotificationsModal';
import { SyncCenterModal } from '../sync/SyncCenterModal';
import { SyncHeaderButton } from '../sync/SyncHeaderButton';
import { pairWithPeer } from '../../services/sync/syncClient';
import { motion } from 'motion/react';

interface DesktopTopBarProps {
  onOpenSyncModal?: () => void;
}

export const DesktopTopBar: React.FC<DesktopTopBarProps> = () => {
  const {
    activeTab,
    notifications,
    recentlyDeleted,
    setIsGlobalSearchOpen,
    setIsRecentlyDeletedModalOpen,
    setIsAddLessonModalOpen,
    setIsStartLessonNowModalOpen,
    lessons,
    openLessonControl,
    language,
    t,
    isSyncReady,
    syncState,
    connectionState,
    devicePresences,
    autoSyncEnabled,
    setAutoSyncEnabled,
    triggerSync,
    forceSyncPeer,
    getPendingOutbox,
    getSyncHistory,
    clearSyncHistory,
    updateSyncState,
    startHosting,
    refreshCalendarAndDashboard
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Sync state management
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<{ id: string; message: string; time: string }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const deletedCount = recentlyDeleted.students.length + recentlyDeleted.groups.length + recentlyDeleted.lessons.length;

  const onlineCount = useMemo(() => {
    if (!syncState?.pairedPeers) return 0;
    return syncState.pairedPeers.filter(p => {
      const presence = devicePresences?.get(p.deviceId);
      return presence ? presence.isOnline : false;
    }).length;
  }, [syncState?.pairedPeers, devicePresences]);

  const syncStatus = isSyncing ? 'syncing' : (onlineCount > 0 ? 'online' : 'offline');

  const addLog = (msg: string) => {
    setActivityLogs(prev => [
      { id: Date.now().toString(), message: msg, time: new Date().toLocaleTimeString() },
      ...prev
    ].slice(0, 50));
  };

  const handlePair = async (ip: string, pin: string) => {
    if (!syncState) return;
    try {
      const localDevice = { deviceId: syncState.localDeviceId, deviceName: syncState.localDeviceName };
      const token = await pairWithPeer(ip, 0, pin, localDevice);
      if (token) {
        const actualToken = typeof token === 'string' ? token : (token as any).pairingToken || (token as any).token || 'token';
        const actualPeerId = typeof token === 'string' ? `peer_${Date.now()}` : (token as any).peerId || `peer_${Date.now()}`;
        const actualPeerName = typeof token === 'string' ? `Device (${ip})` : (token as any).deviceName || `Companion Device`;
        const negotiatedVersion = (token as any).negotiatedVersion || 1;
        const agreedCapabilities = (token as any).agreedCapabilities || ['core_entities'];
        
        const newPeer = { 
          deviceId: actualPeerId, 
          deviceName: actualPeerName, 
          lastKnownIp: 'P2P (WebRTC)',
          port: 0,
          pairingToken: actualToken,
          protocolVersion: negotiatedVersion,
          capabilities: agreedCapabilities,
          lastSyncedTimestamp: Date.now(),
          isOnline: true,
          lastHeartbeat: Date.now()
        };
        const updatedPeers = [...(syncState.pairedPeers || []).filter(p => p.deviceId !== actualPeerId), newPeer];
        await updateSyncState({ ...syncState, pairedPeers: updatedPeers });
        addLog(`Paired with ${actualPeerName} (${actualPeerId.substring(0, 10)})`);
      } else {
        addLog(`Could not connect to device ${ip} (Device is offline or invalid PIN)`);
        throw new Error(`Device (${ip}) is offline or PIN was not found`);
      }
    } catch (err: any) {
      addLog(`Failed to pair with ${ip}: ${err.message || 'Offline'}`);
      throw err;
    }
  };

  const handleForceSync = async (peerId?: string) => {
    if (!syncState) return;
    setIsSyncing(true);
    try {
      if (peerId) {
        const success = await triggerSync(peerId);
        addLog(success ? `Synced with device ${peerId.substring(0, 6)}` : `Sync failed for device ${peerId.substring(0, 6)}`);
      } else {
        const peersToSync = syncState.pairedPeers?.filter(p => {
          const presence = devicePresences?.get(p.deviceId);
          return presence ? presence.isOnline : false;
        }) || [];
        for (const peer of peersToSync) {
          await triggerSync(peer.deviceId);
        }
        addLog(`Synced with ${peersToSync.length} device(s)`);
      }
    } catch {
      addLog('Sync error occurred');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnpair = async (peerId: string) => {
    if (!syncState) return;
    const updatedPeers = (syncState.pairedPeers || []).filter(p => p.deviceId !== peerId);
    await updateSyncState({ ...syncState, pairedPeers: updatedPeers });
    addLog(`Unpaired device ${peerId.substring(0, 6)}`);
  };

  const handleRenameLocalDevice = async (newName: string) => {
    if (!syncState) return;
    await updateSyncState({ ...syncState, localDeviceName: newName });
    addLog(`Renamed local device to ${newName}`);
  };

  const handleRenamePeer = async (peerId: string, newName: string) => {
    if (!syncState) return;
    const updatedPeers = (syncState.pairedPeers || []).map(p => 
      p.deviceId === peerId ? { ...p, deviceName: newName } : p
    );
    await updateSyncState({ ...syncState, pairedPeers: updatedPeers });
    addLog(`Renamed peer to ${newName}`);
  };

  const handleRefreshClick = () => {
    refreshCalendarAndDashboard();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // Check for upcoming lesson in 30 mins
  const urgent30MinLesson = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    return lessons.find(l => {
      if (l.date !== todayStr || l.status === 'completed' || l.status === 'cancelled') return false;
      const [h, m] = (l.time || '00:00').split(':').map(Number);
      const lessonMins = h * 60 + m;
      const diff = lessonMins - currentMins;
      return diff >= 0 && diff <= 35;
    });
  }, [lessons]);

  // Current formatted Date
  const currentDateFormatted = React.useMemo(() => {
    const now = new Date();
    const locale = language === 'ar' ? 'ar-EG' : language === 'en' ? 'en-US' : 'de-DE';
    return now.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [language]);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'home': return t('nav_home') || 'Startseite & Dashboard';
      case 'schedule': return t('nav_schedule') || 'Terminkalender & Unterricht';
      case 'students': return t('nav_students') || 'Schüler- & Gruppenverwaltung';
      case 'payments': return t('nav_payments') || 'Zahlungsübersicht & Finanzen';
      case 'history': return t('nav_history') || 'Sitzungsprotokolle & Verlauf';
      case 'reports': return t('nav_reports') || 'Leistungsberichte & Statistiken';
      case 'certificates': return t('nav_certificates') || 'Zertifikate- & Urkundenstudio';
      case 'freeTime': return t('nav_free_time') || 'Freie Zeitfenster Finder';
      case 'settings': return t('nav_settings') || 'Systemeinstellungen';
      default: return 'Glück Cockpit';
    }
  };

  return (
    <>
      <header className="h-16 bg-surface/90 dark:bg-background/90 backdrop-blur-md border-b border-surface-border/70 dark:border-surface-border px-6 flex items-center justify-between gap-4 z-20 shrink-0 select-none">
        {/* Left: Section Title & Date */}
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <h1 className="text-base font-black text-text-main tracking-tight truncate">
              {getTabTitle()}
            </h1>
            <p className="text-xs text-text-muted font-medium capitalize">
              {currentDateFormatted}
            </p>
          </div>
        </div>

        {/* Center: Urgent lesson alert badge if any */}
        {urgent30MinLesson && (
          <button
            onClick={() => openLessonControl(urgent30MinLesson)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all cursor-pointer animate-pulse"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {t('upcoming_lesson_alert') || 'Gleich beginnt'}: {urgent30MinLesson.time} ({urgent30MinLesson.title || urgent30MinLesson.groupName || urgent30MinLesson.studentName})
            </span>
          </button>
        )}

        {/* Right: Quick Global Search + Actions + Tools */}
        <div className="flex items-center gap-2.5">
          {/* Quick Search Field */}
          <button
            onClick={() => setIsGlobalSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-hover/80 dark:bg-surface-border/40 border border-surface-border hover:border-primary/40 text-text-muted text-xs font-medium transition-all cursor-pointer w-44 xl:w-56 justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-text-muted" />
              <span className="truncate">{t('search_placeholder') || 'Suchen...'}</span>
            </div>
            <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-border/60 text-text-muted">
              ⌘K
            </kbd>
          </button>

          {/* Quick Create Buttons */}
          <button
            onClick={() => setIsAddLessonModalOpen(true)}
            className="hidden xl:flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('schedule_add_lesson') || 'Lektion'}</span>
          </button>

          <button
            onClick={() => setIsStartLessonNowModalOpen(true)}
            className="hidden lg:flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t('start_lesson_now') || 'Blitz-Start'}</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-surface-border/80 mx-1" />

          {/* P2P Sync Center Button */}
          {isSyncReady && syncState && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsSyncModalOpen(true)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-bold ${
                onlineCount > 0
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                  : isSyncing
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                  : 'bg-surface-hover/60 hover:bg-surface-hover text-text-muted hover:text-text-main border-surface-border'
              }`}
              title={
                onlineCount > 0
                  ? `${onlineCount} Gerät(e) online & synchronisiert`
                  : 'P2P Synchronisations-Zentrum öffnen'
              }
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
              ) : (
                <MonitorSmartphone className={`w-3.5 h-3.5 ${onlineCount > 0 ? 'text-emerald-500' : 'text-text-muted'}`} />
              )}
              <span className="hidden xl:inline text-[11px]">
                {isSyncing
                  ? 'Synchronisiere...'
                  : onlineCount > 0
                  ? `${onlineCount} Online`
                  : 'Sync'}
              </span>
              {onlineCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse xl:hidden" />
              )}
            </motion.button>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefreshClick}
            className="p-2 rounded-xl bg-surface-hover/60 hover:bg-surface-hover text-text-main border border-surface-border transition-colors cursor-pointer"
            title={t('auto_refresh_data') || 'Daten aktualisieren'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Trash button */}
          <button
            onClick={() => setIsRecentlyDeletedModalOpen(true)}
            className="relative p-2 rounded-xl bg-surface-hover/60 hover:bg-surface-hover text-text-main border border-surface-border transition-colors cursor-pointer"
            title={t('recently_deleted') || 'Papierkorb'}
          >
            <Trash2 className="w-4 h-4" />
            {deletedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-surface">
                {deletedCount}
              </span>
            )}
          </button>

          {/* Notification Bell */}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 rounded-xl bg-surface-hover/60 hover:bg-surface-hover text-text-main border border-surface-border transition-colors cursor-pointer"
            title={t('notifications') || 'Benachrichtigungen'}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-surface animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Toast Alert */}
      {showToast && (
        <div className="fixed top-18 right-6 z-50 bg-primary text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg flex items-center gap-2 animate-scale-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>✓ {t('dataRefreshed') || 'Daten erfolgreich aktualisiert'}</span>
        </div>
      )}

      {/* Global Modals */}
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}

      {isSyncReady && syncState && (
        <SyncCenterModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          syncStatus={
            isSyncing
              ? 'syncing'
              : syncState.pairedPeers && syncState.pairedPeers.some(p => devicePresences?.get(p.deviceId)?.isOnline)
              ? 'connected'
              : 'offline'
          }
          lastSyncTime={
            syncState.pairedPeers && syncState.pairedPeers.length > 0
              ? new Date(Math.max(...syncState.pairedPeers.map(p => p.lastSyncedTimestamp || 0))).toLocaleTimeString()
              : 'Never'
          }
          nextAutoSyncTime="in 5 mins"
          localDevice={{ name: syncState.localDeviceName, id: syncState.localDeviceId }}
          onRenameLocalDevice={handleRenameLocalDevice}
          pairedPeers={syncState.pairedPeers || []}
          onPair={handlePair}
          onForceSync={handleForceSync}
          onUnpair={handleUnpair}
          onRenamePeer={handleRenamePeer}
          activityLogs={activityLogs}
          onStartHosting={startHosting}
          connectionState={connectionState}
          devicePresences={devicePresences}
          syncState={syncState}
          autoSyncEnabled={autoSyncEnabled}
          onToggleAutoSync={setAutoSyncEnabled}
          getPendingOutbox={getPendingOutbox}
          getSyncHistory={getSyncHistory}
          onClearSyncHistory={clearSyncHistory}
          onForceFullSync={forceSyncPeer}
        />
      )}
    </>
  );
};
