import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, Calendar, Users, Wallet, BarChart2, Settings, 
  History, Award, Clock, Plus, Zap, UserPlus, Layers,
  Search, Moon, Sun, BookOpen, Sparkles, Gamepad2, ShieldCheck,
  PanelLeftClose, PanelLeftOpen, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, X
} from 'lucide-react';
import { AvatarImage } from '../AvatarImage';
import { SyncHeaderButton } from '../sync/SyncHeaderButton';
import { SyncCenterModal } from '../sync/SyncCenterModal';
import { pairWithPeer } from '../../services/sync/syncClient';
import { calculateDuePaymentCycles } from '../../utils/paymentUtils';
import { formatLocalDate } from '../../utils/timeUtils';

interface DesktopSidebarProps {
  onOpenSyncModal?: () => void;
}

const ALL_NAV_IDS = [
  'home', 'schedule', 'students', 'parentPortal', 'payments', 'history', 
  'reports', 'certificates', 'freeTime', 'schoolSchedule', 'hod', 'lernstudio', 'settings'
];

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
    payments,
    t,
    language,
    _t
  } = useApp();

  const [internalSyncOpen, setInternalSyncOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<{ id: string; message: string; time: string }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [seenDueCount, setSeenDueCount] = useState(0);

  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dl_sidebar_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const [navOrder, setNavOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dl_sidebar_nav_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Ensure all current IDs are present
          const missing = ALL_NAV_IDS.filter(id => !parsed.includes(id));
          return [...parsed.filter(id => ALL_NAV_IDS.includes(id)), ...missing];
        }
      }
    } catch {}
    return ALL_NAV_IDS;
  });

  const saveNavOrder = (newOrder: string[]) => {
    setNavOrder(newOrder);
    try {
      localStorage.setItem('dl_sidebar_nav_order', JSON.stringify(newOrder));
    } catch {}
  };

  const moveNavItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= navOrder.length) return;
    const updated = [...navOrder];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    saveNavOrder(updated);
  };

  const resetNavOrder = () => {
    saveNavOrder(ALL_NAV_IDS);
  };

  const toggleMinimize = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    try {
      localStorage.setItem('dl_sidebar_minimized', String(next));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const deletedCount = recentlyDeleted.students.length + recentlyDeleted.groups.length + recentlyDeleted.lessons.length;
  const activeStudentsCount = students.filter(s => s.status !== 'archived').length;
  const activeGroupsCount = groups.filter(g => g.status !== 'archived').length;

  const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
  const dueCount = dueCycles.length;

  useEffect(() => {
    if (activeTab === 'payments' || activeTab === 'finance') {
      setSeenDueCount(dueCount);
    }
  }, [activeTab, dueCount]);

  const unreadDueCount = (activeTab === 'payments' || activeTab === 'finance') ? 0 : Math.max(0, dueCount - seenDueCount);

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

  const navItemMap: Record<string, { label: string; icon: React.ElementType; badge: any }> = {
    home: { label: t('nav_home') || 'Startseite', icon: Home, badge: null },
    schedule: { label: t('nav_schedule') || 'Termine & Unterricht', icon: Calendar, badge: lessons.filter(l => l.date === formatLocalDate() && l.status !== 'cancelled').length || null },
    students: { label: t('nav_students') || 'Schüler & Gruppen', icon: Users, badge: `${activeStudentsCount}` },
    parentPortal: { label: _t('بوابة أولياء الأمور', 'Parent Portal', 'Elternportal'), icon: ShieldCheck, badge: 'PROD' },
    payments: { label: t('nav_payments') || 'Zahlungen & Finanzen', icon: Wallet, badge: unreadDueCount > 0 ? `${unreadDueCount}` : null },
    history: { label: t('nav_history') || 'Sitzungsverlauf', icon: History, badge: null },
    reports: { label: t('nav_reports') || 'Berichte & Analysen', icon: BarChart2, badge: null },
    certificates: { label: t('nav_certificates') || 'Zertifikate-Studio', icon: Award, badge: null },
    freeTime: { label: t('nav_free_time') || 'Freie Termine', icon: Clock, badge: null },
    schoolSchedule: { label: _t('جدول المدرسة', 'School Schedule', 'Stundenplan'), icon: BookOpen, badge: null },
    hod: { label: _t('إدارة القسم (HOD Hub)', 'HOD Hub', 'Fachleiter Hub'), icon: Layers, badge: null },
    lernstudio: { label: 'Glück Lernstudio 🇩🇪', icon: Gamepad2, badge: 'NEU' },
    settings: { label: t('nav_settings') || 'Einstellungen', icon: Settings, badge: null },
  };

  const sortedNavItems = navOrder.map(id => ({ id, ...(navItemMap[id] || navItemMap['home']) }));

  return (
    <>
      <aside className={`h-full bg-surface dark:bg-background border-r border-surface-border/70 dark:border-surface-border flex flex-col justify-between select-none shrink-0 z-30 transition-all duration-300 ease-in-out ${isMinimized ? 'w-20' : 'w-64 xl:w-72'}`}>
        {/* Brand Header */}
        <div className={`p-4 border-b border-surface-border/60 ${isMinimized ? 'flex flex-col items-center gap-3' : ''}`}>
          <div className={`flex items-center ${isMinimized ? 'flex-col gap-2 w-full justify-center' : 'justify-between gap-3'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary-hover to-primary text-white flex items-center justify-center font-black text-lg shadow-md shadow-primary/20 shrink-0">
                G
              </div>
              {!isMinimized && (
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
              )}
            </div>

            {/* Minimize Toggle Button */}
            <button
              onClick={toggleMinimize}
              className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40 transition-all cursor-pointer shrink-0"
              title={isMinimized ? _t('توسيع القائمة الجانبية', 'Expand Sidebar', 'Sidebar erweitern') : _t('تصغير القائمة الجانبية', 'Minimize Sidebar', 'Sidebar minimieren')}
            >
              {isMinimized ? <PanelLeftOpen className="w-4 h-4 text-primary" /> : <PanelLeftClose className="w-4 h-4 text-text-muted" />}
            </button>
          </div>

          {/* Teacher Profile Card */}
          {!isMinimized && (
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
          )}

          {isMinimized && (
            <div className="mt-2 relative">
              <AvatarImage
                name={profile.displayName}
                avatarUrl={profile.avatarUrl || undefined}
                alt={profile.displayName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/40 mx-auto"
              />
              <span className="absolute bottom-0 right-3 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface" />
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <div className={`flex-1 py-3 overflow-y-auto space-y-1 ${isMinimized ? 'px-2' : 'px-3'}`}>
          {!isMinimized && (
            <div className="flex items-center justify-between px-3 py-1 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted/70">
                Hauptmenü
              </span>
              <button
                onClick={() => setIsCustomizeModalOpen(true)}
                className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-surface-hover transition-all cursor-pointer"
                title={_t('ترتيب الأيقونات والصفحات', 'Rearrange Pages & Icons', 'Seiten & Icons anordnen')}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {sortedNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                title={isMinimized ? item.label : undefined}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all cursor-pointer relative group ${
                  isMinimized ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-primary text-white shadow-xs shadow-primary/20'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40'
                }`}
              >
                <div className={`flex items-center min-w-0 ${isMinimized ? 'justify-center' : 'gap-2.5 truncate'}`}>
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-primary'}`} />
                  {!isMinimized && <span className="truncate">{item.label}</span>}
                </div>

                {item.badge && !isMinimized && (
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

                {item.badge && isMinimized && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface" title={String(item.badge)} />
                )}
              </button>
            );
          })}

          {!isMinimized && (
            <>
              <div className="pt-3 text-[10px] uppercase font-bold tracking-wider text-text-muted/70 px-3 py-1">
                Schnellaktionen
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setIsStartLessonNowModalOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-primary-soft text-primary border border-primary-border/60 hover:bg-primary-soft/80 transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
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
                  <UserPlus className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{t('students_add_student') || 'Schüler anlegen'}</span>
                </button>

                <button
                  onClick={() => setIsAddGroupModalOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40 transition-all cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{t('students_add_group') || 'Gruppe anlegen'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className={`p-3 border-t border-surface-border/60 bg-surface-hover/30 space-y-2 ${isMinimized ? 'flex flex-col items-center' : ''}`}>
          {/* Search button with Ctrl+K shortcut badge */}
          <button
            onClick={() => setIsGlobalSearchOpen(true)}
            title={isMinimized ? (t('search') || 'Suchen...') : undefined}
            className={`flex items-center rounded-xl text-xs font-medium text-text-muted bg-surface dark:bg-background border border-surface-border/80 hover:border-primary/40 transition-all cursor-pointer ${
              isMinimized ? 'p-2.5 justify-center w-full' : 'w-full justify-between px-3 py-2'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
              {!isMinimized && <span>{t('search') || 'Suchen...'}</span>}
            </div>
            {!isMinimized && (
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-border/50 text-text-muted">
                ⌘K
              </kbd>
            )}
          </button>

          {/* Bottom utility row */}
          <div className={`flex items-center pt-1 ${isMinimized ? 'flex-col gap-2 w-full justify-center' : 'justify-between'}`}>
            {isSyncReady && syncState && !isMinimized && (
              <SyncHeaderButton
                status={onlineCount > 0 ? 'online' : 'offline'}
                connectedCount={onlineCount}
                onClick={handleOpenSync}
              />
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
              title={theme === 'amoled' ? 'AMOLED Mode (0% OLED Power)' : theme === 'dark' ? 'Dark Mode' : theme === 'tinted' ? 'Soft Tint & Pattern' : 'Light Mode'}
            >
              {theme === 'amoled' ? (
                <Zap className="w-4 h-4 text-primary animate-pulse" />
              ) : theme === 'dark' ? (
                <Moon className="w-4 h-4 text-primary" />
              ) : theme === 'tinted' ? (
                <Sparkles className="w-4 h-4 text-primary" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Customize Navigation Order Modal */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface dark:bg-background border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-black text-text-main">
                  {_t('ترتيب القائمة والصفحات', 'Rearrange Menu & Pages', 'Menü & Seiten anordnen')}
                </h3>
              </div>
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              <p className="text-xs text-text-muted mb-3">
                {_t('استخدم أزرار السهم لنقل الصفحات لأعلى أو لأسفل حسب تفضيلك الشخصي.', 'Use the up and down arrows to rearrange pages according to your workflow.', 'Verwende die Pfeiltasten, um Seiten nach deinen Wünschen anzuordnen.')}
              </p>

              {navOrder.map((id, index) => {
                const item = navItemMap[id];
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-hover/50 border border-surface-border/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-[11px] font-mono text-text-muted text-center">{index + 1}</span>
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-text-main truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveNavItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg bg-surface border border-surface-border text-text-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        title="Nach oben"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveNavItem(index, 'down')}
                        disabled={index === navOrder.length - 1}
                        className="p-1.5 rounded-lg bg-surface border border-surface-border text-text-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        title="Nach unten"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-surface-border flex items-center justify-between bg-surface-hover/30">
              <button
                onClick={resetNavOrder}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{_t('إعادة ضبط الافتراضي', 'Reset Default', 'Standard zurücksetzen')}</span>
              </button>
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary-hover transition-all cursor-pointer"
              >
                {_t('تم', 'Done', 'Fertig')}
              </button>
            </div>
          </div>
        </div>
      )}

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
