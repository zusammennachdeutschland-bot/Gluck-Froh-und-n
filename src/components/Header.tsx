import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatLocalDate } from '../utils/timeUtils';
import { Bell, RefreshCw, CheckCircle2, Camera, Clock, Trash2, MoreHorizontal, Award, History, BarChart2, Settings } from 'lucide-react';
import { DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { AvatarImage } from './AvatarImage';
import { GlueckBuddyAvatar } from './buddy/GlueckBuddyAvatar';
import { NotificationsModal } from './NotificationsModal';
import { motion } from 'motion/react';
import { SyncHeaderButton } from './sync/SyncHeaderButton';
import { SyncCenterModal } from './sync/SyncCenterModal';
import { pairWithPeer } from '../services/sync/syncClient';

export const Header: React.FC = () => {
  const { language } = useApp();
  
  const { 
    activeTab,
    setActiveTab,
    profile, 
    updateProfile, 
    notifications, 
    lessons, 
    openLessonControl, 
    refreshCalendarAndDashboard, 
    setIsRecentlyDeletedModalOpen,
    recentlyDeleted,
    t,
    syncState,
    isSyncReady,
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
    startHosting
  } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showMoreHeaderMenu, setShowMoreHeaderMenu] = useState(false);

  const isRtl = language === 'ar' || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');

  // Sync State UI
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<{ id: string, message: string, time: string }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const deletedCount = recentlyDeleted.students.length + recentlyDeleted.groups.length + recentlyDeleted.lessons.length;

  // Derived sync values
  const onlineCount = useMemo(() => {
    if (!syncState?.pairedPeers) return 0;
    return syncState.pairedPeers.filter(p => {
      const presence = devicePresences?.get(p.deviceId);
      return presence ? presence.isOnline : false;
    }).length;
  }, [syncState?.pairedPeers, devicePresences]);

  const syncStatus = isSyncing ? 'syncing' : (onlineCount > 0 ? 'online' : 'offline');

  const addLog = (msg: string) => {
    setActivityLogs(prev => [{ id: Date.now().toString(), message: msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  };

  const onPair = async (ip: string, pin: string) => {
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

  const onForceSync = async (peerId?: string) => {
    if (!syncState) return;
    setIsSyncing(true);
    try {
      if (peerId) {
        const success = await triggerSync(peerId);
        addLog(success ? `Synced with device ${peerId.substring(0,6)}` : `Sync failed for device ${peerId.substring(0,6)}`);
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
    } catch(e) {
      addLog(`Sync error occurred`);
    } finally {
      setIsSyncing(false);
    }
  };

  const onUnpair = async (peerId: string) => {
    if (!syncState) return;
    const updatedPeers = (syncState.pairedPeers || []).filter(p => p.deviceId !== peerId);
    await updateSyncState({ ...syncState, pairedPeers: updatedPeers });
    addLog(`Unpaired device ${peerId.substring(0,6)}`);
  };

  const onRenameLocalDevice = async (newName: string) => {
    if (!syncState) return;
    await updateSyncState({ ...syncState, localDeviceName: newName });
    addLog(`Renamed local device to ${newName}`);
  };

  const onRenamePeer = async (peerId: string, newName: string) => {
    if (!syncState) return;
    const updatedPeers = (syncState.pairedPeers || []).map(p => 
      p.deviceId === peerId ? { ...p, deviceName: newName } : p
    );
    await updateSyncState({ ...syncState, pairedPeers: updatedPeers });
    addLog(`Renamed peer to ${newName}`);
  };

  const urgent30MinLesson = useMemo(() => {
    if (profile.enableLessonAlerts === false && profile.enableBrowserPush === false) return null;
    const now = new Date();
    const todayStr = formatLocalDate(now);
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const upcoming = lessons.filter(l => {
      if (l.date !== todayStr || l.status !== 'scheduled') return false;
      const parts = l.time.split(':').map(n => parseInt(n, 10));
      if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return false;
      const lMins = parts[0] * 60 + parts[1];
      const diff = lMins - nowMins;
      return diff >= 0 && diff <= 30;
    });

    return upcoming[0] || null;
  }, [lessons, profile.enableLessonAlerts, profile.enableBrowserPush]);

  const handleRefresh = () => {
    refreshCalendarAndDashboard();
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  return (
    <>
      {/* Premium Safe Area Spacer for Android Status Bar */}
      <div 
        className="bg-surface dark:bg-black select-none max-w-lg mx-auto w-full shrink-0 transition-colors" 
        style={{ height: 'max(24px, env(safe-area-inset-top, 24px))' }}
      />

      {/* Compact Premium Dashboard Header */}
      <header className="bg-surface dark:bg-black border-b border-surface-border/80 px-3.5 py-2.5 sticky top-0 z-30 transition-colors shadow-2xs">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          {/* Profile & Greeting / Tab Indicator */}
          <div className="flex items-center gap-2 min-w-0 flex-1 px-1">
            <GlueckBuddyAvatar />

            <div className="leading-tight min-w-0 flex-1 pr-1">
              {activeTab === 'home' ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary dark:text-primary-hover flex items-center gap-1">
                    <span>{t('greeting') || 'WELCOME'}</span>
                    <span className="inline-block animate-wave text-[11px]">👋</span>
                  </p>
                  <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 leading-snug whitespace-normal break-words">
                    {profile.displayName}
                  </h1>
                </>
              ) : (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary dark:text-primary">
                    Glück fröhlich und froh
                  </p>
                  <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 capitalize leading-snug whitespace-normal break-words">
                    {activeTab === 'schedule' ? (t('nav_schedule') || 'Termine')
                     : activeTab === 'students' ? (t('nav_students') || 'Schüler')
                     : activeTab === 'history' ? (t('nav_history') || 'Sitzungen')
                     : activeTab === 'payments' ? (t('nav_payments') || 'Zahlungen')
                     : activeTab === 'reports' ? (t('nav_reports') || 'Berichte')
                     : activeTab === 'settings' ? (t('nav_settings') || 'Einstellungen')
                     : activeTab}
                  </h1>
                </>
              )}
            </div>
          </div>

          {/* Right Action Controls: Trash, Refresh, Sync, Bell, Three Dots Menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Recently Deleted / Trash Bin */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setIsRecentlyDeletedModalOpen(true)}
              className="relative p-2 sm:p-2.5 rounded-full bg-background dark:bg-background hover:bg-surface-hover text-text-main border border-surface-border/80 transition-colors cursor-pointer"
              aria-label="Recently Deleted"
              title="Zuletzt gelöscht"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {deletedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-blue-500 text-white font-black text-[9px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-black">
                  {deletedCount}
                </span>
              )}
            </motion.button>

            {/* Refresh Data Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={handleRefresh}
              className="p-2 sm:p-2.5 rounded-full bg-background dark:bg-background hover:bg-surface-hover text-text-main border border-surface-border/80 transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title={t('auto_refresh_data')}
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </motion.button>

            {isSyncReady && syncState && (
              <SyncHeaderButton 
                status={syncStatus}
                connectedCount={onlineCount}
                onClick={() => setIsSyncModalOpen(true)}
              />
            )}

            {/* Notification Bell */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setShowNotifications(true)}
              className="relative p-2 sm:p-2.5 rounded-full bg-background dark:bg-background hover:bg-surface-hover text-text-main border border-surface-border/80 transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-black animate-bounce">
                  {unreadCount}
                </span>
              )}
            </motion.button>

            {/* Header Three Dots / More Menu Button - Last on the right side */}
            <div className="relative shrink-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                onClick={() => setShowMoreHeaderMenu(prev => !prev)}
                className="p-2 sm:p-2.5 rounded-full bg-background dark:bg-background hover:bg-surface-hover text-text-main border border-surface-border/80 transition-colors cursor-pointer"
                aria-label="More Options"
                title="Mehr Optionen"
              >
                <MoreHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </motion.button>

              {/* Dropdown Menu */}
              {showMoreHeaderMenu && (
                <div className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} w-48 sm:w-52 bg-surface/95 dark:bg-background/95 backdrop-blur-md border border-surface-border/40 dark:border-surface-border/60 rounded-[20px] shadow-xl p-1.5 space-y-1.5 z-50`}>
                  <button
                    onClick={() => { setActiveTab('certificates'); setShowMoreHeaderMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start hover:bg-background dark:hover:bg-slate-900 text-text-main"
                  >
                    <Award className="w-4 h-4 text-primary shrink-0" />
                    <span>{t('nav_certificates') || 'Zertifikate'}</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('freeTime'); setShowMoreHeaderMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start hover:bg-background dark:hover:bg-slate-900 text-text-main"
                  >
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span>{t('nav_free_time') || 'Free Time'}</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('history'); setShowMoreHeaderMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start hover:bg-background dark:hover:bg-slate-900 text-text-main"
                  >
                    <History className="w-4 h-4 text-primary shrink-0" />
                    <span>{t('nav_history') || 'Sitzungen'}</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('reports'); setShowMoreHeaderMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start hover:bg-background dark:hover:bg-slate-900 text-text-main"
                  >
                    <BarChart2 className="w-4 h-4 text-primary shrink-0" />
                    <span>{t('nav_reports') || 'Berichte'}</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('settings'); setShowMoreHeaderMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start hover:bg-background dark:hover:bg-slate-900 text-text-main"
                  >
                    <Settings className="w-4 h-4 text-primary shrink-0" />
                    <span>{t('nav_settings') || 'Einstellungen'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
 
      {/* Urgent 30-Min Lesson Alert Banner */}
      {urgent30MinLesson && (
        <div className="bg-primary dark:bg-primary text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-semibold animate-fade-in">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="p-1 bg-surface/20 rounded shrink-0">
              <Clock className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="truncate tracking-wide">
              {urgent30MinLesson.time}: {urgent30MinLesson.title || urgent30MinLesson.groupName || urgent30MinLesson.studentName}
            </span>
          </div>
 
          <button
            onClick={() => openLessonControl(urgent30MinLesson)}
            className="px-2.5 py-1 bg-surface/20 hover:bg-surface/30 text-white font-bold rounded-md text-[10px] uppercase tracking-wider shrink-0 cursor-pointer shadow-2xs transition-colors"
          >
            {t('open') || 'Öffnen'}
          </button>
        </div>
      )}
 
      {/* Refresh Toast Notification */}
      {showToast && (
        <div className="bg-primary text-white text-xs font-bold py-2 px-4 shadow-lg flex items-center justify-center gap-2 animate-scale-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>✓ {t('dataRefreshed')}</span>
        </div>
      )}
 
      {/* Modals */}
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
      
      {isSyncReady && syncState && (
        <SyncCenterModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          syncStatus={onlineCount > 0 ? 'connected' : 'offline'}
          lastSyncTime={
            syncState.pairedPeers && syncState.pairedPeers.length > 0
              ? new Date(Math.max(...syncState.pairedPeers.map(p => p.lastSyncedTimestamp || 0))).toLocaleTimeString()
              : 'Never'
          }
          nextAutoSyncTime="in 5 mins"
          localDevice={{ name: syncState.localDeviceName, id: syncState.localDeviceId }}
          onRenameLocalDevice={onRenameLocalDevice}
          pairedPeers={syncState.pairedPeers || []}
          onPair={onPair}
          onForceSync={onForceSync}
          onUnpair={onUnpair}
          onRenamePeer={onRenamePeer}
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

