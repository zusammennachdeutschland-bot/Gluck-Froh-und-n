import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, Calendar, Users, Wallet, BarChart2, Settings, 
  History, Award, Clock, Plus, Zap, UserPlus, Layers,
  Search, Moon, Sun
} from 'lucide-react';
import { AvatarImage } from '../AvatarImage';
import { DEFAULT_OFFLINE_AVATAR } from '../../data/avatarPresets';
import { SyncHeaderButton } from '../sync/SyncHeaderButton';
import { SyncCenterModal } from '../sync/SyncCenterModal';
import { pairWithPeer } from '../../services/sync/syncClient';

interface DesktopSidebarProps {
  onOpenSyncModal?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ onOpenSyncModal }) => {
  const {
    activeTab,
    setActiveTab,
    profile,
    theme,
    toggleTheme,
    notifications,
    recentlyDeleted,
    isSyncReady,
    syncState,
    devicePresences,
    connectionState,
    autoSyncEnabled,
    setAutoSyncEnabled,
    triggerSync,
    forceSyncPeer,
    getPendingOutbox,
    getSyncHistory,
    clearSyncHistory,
    updateSyncState,
    startHosting,
    setIsGlobalSearchOpen,
    setIsAddLessonModalOpen,
    setIsAddQuickLessonModalOpen,
    setIsAddStudentModalOpen,
    setIsAddGroupModalOpen,
    setIsStartLessonNowModalOpen,
    students,
    groups,
    lessons,
    t
  } = useApp();

  const [internalSyncOpen, setInternalSyncOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<{ id: string; message: string; time: string }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const deletedCount = recentlyDeleted.students.length + recentlyDeleted.groups.length + recentlyDeleted.lessons.length;
  const activeStudentsCount = students.filter(s => s.status !== 'archived').length;
  const activeGroupsCount = groups.filter(g => g.status !== 'archived').length;

  const onlineCount = syncState?.pairedPeers
    ? syncState.pairedPeers.filter(p => {
        const presence = devicePresences?.get(p.deviceId);
        return presence ? presence.isOnline : false;
      }).length
    : 0;

  const handleOpenSync = () => {
    if (onOpenSyncModal) {
      onOpenSyncModal();
    } else {
      setInternalSyncOpen(true);
    }
  };

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

  const navItems = [
    { id: 'home', label: t('nav_home') || 'Startseite', icon: Home, badge: null },
    { id: 'schedule', label: t('nav_schedule') || 'Termine & Unterricht', icon: Calendar, badge: lessons.filter(l => l.date === new Date().toISOString().split('T')[0] && l.status !== 'cancelled').length || null },
    { id: 'students', label: t('nav_students') || 'Schüler & Gruppen', icon: Users, badge: `${activeStudentsCount}` },
    { id: 'payments', label: t('nav_payments') || 'Zahlungen & Finanzen', icon: Wallet, badge: null },
    { id: 'history', label: t('nav_history') || 'Sitzungsverlauf', icon: History, badge: null },
    { id: 'reports', label: t('nav_reports') || 'Berichte & Analysen', icon: BarChart2, badge: null },
    { id: 'certificates', label: t('nav_certificates') || 'Zertifikate-Studio', icon: Award, badge: null },
    { id: 'freeTime', label: t('nav_free_time') || 'Freie Termine', icon: Clock, badge: null },
    { id: 'settings', label: t('nav_settings') || 'Einstellungen', icon: Settings, badge: null },
  ];

  return (
    <>
      <aside className="w-64 xl:w-72 h-full bg-surface dark:bg-background border-r border-surface-border/70 dark:border-surface-border flex flex-col justify-between select-none shrink-0 z-30 transition-all">
        {/* Brand Header */}
        <div className="p-4 border-b border-surface-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary-hover to-primary text-white flex items-center justify-center font-black text-lg shadow-md shadow-primary/20 shrink-0">
              G
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-text-main">Glück</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary-soft">
                  OS
                </span>
              </div>
              <p className="text-[11px] text-text-muted truncate font-medium">
                Deutschlehrer Cockpit
              </p>
            </div>
          </div>

          {/* Teacher Profile Card */}
          <div className="mt-3 p-2.5 rounded-xl bg-surface-hover/60 dark:bg-surface-border/30 border border-surface-border/50 flex items-center gap-2.5">
            <div className="relative shrink-0">
              <AvatarImage
                name={profile.displayName}
                avatarUrl={profile.avatarUrl || undefined}
                alt={profile.displayName}
                className="w-9 h-9 rounded-full object-cover ring-1 ring-surface-border"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-text-main truncate">
                {profile.displayName || 'Deutschlehrer'}
              </p>
              <p className="text-[10px] text-text-muted truncate">
                {profile.email || 'offline-betrieb'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted/70 px-3 py-1">
            Hauptmenü
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-xs shadow-primary/20'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-text-muted'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-hover text-text-muted dark:bg-surface-border/80'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 text-[10px] uppercase font-bold tracking-wider text-text-muted/70 px-3 py-1">
            Schnellaktionen
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setIsStartLessonNowModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{t('start_lesson_now') || 'Blitz-Start'}</span>
            </button>

            <button
              onClick={() => setIsAddQuickLessonModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{t('add_quick_lesson') || 'Schnell-Lektion'}</span>
            </button>

            <button
              onClick={() => setIsAddStudentModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{t('students_add_student') || 'Schüler anlegen'}</span>
            </button>

            <button
              onClick={() => setIsAddGroupModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40 transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">{t('students_add_group') || 'Gruppe anlegen'}</span>
            </button>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-3 border-t border-surface-border/60 bg-surface-hover/30 space-y-2">
          {/* Search button with Ctrl+K shortcut badge */}
          <button
            onClick={() => setIsGlobalSearchOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-text-muted bg-surface dark:bg-background border border-surface-border/80 hover:border-primary/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-text-muted" />
              <span>{t('search') || 'Suchen...'}</span>
            </div>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-border/50 text-text-muted">
              ⌘K
            </kbd>
          </button>

          {/* Bottom utility row */}
          <div className="flex items-center justify-between pt-1">
            {isSyncReady && syncState && (
              <SyncHeaderButton
                status={onlineCount > 0 ? 'online' : 'offline'}
                connectedCount={onlineCount}
                onClick={handleOpenSync}
              />
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Internal Sync Center Modal if opened via sidebar */}
      {!onOpenSyncModal && internalSyncOpen && isSyncReady && syncState && (
        <SyncCenterModal
          isOpen={internalSyncOpen}
          onClose={() => setInternalSyncOpen(false)}
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
