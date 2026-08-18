import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, RefreshCw, Bell, Trash2, Clock, Plus, Zap,
  CheckCircle2, Calendar, Users, Wallet, BarChart2, Award, Settings, History
} from 'lucide-react';
import { NotificationsModal } from '../NotificationsModal';
import { SyncCenterModal } from '../sync/SyncCenterModal';

interface DesktopTopBarProps {
  onRefresh: () => void;
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: (open: boolean) => void;
  activityLogs: { id: string; message: string; time: string }[];
  onPair: (ip: string, pin: string) => Promise<void>;
  onForceSync: () => Promise<void>;
  onUnpair: (deviceId: string) => Promise<void>;
  onRenamePeer: (deviceId: string, name: string) => Promise<void>;
  onRenameLocalDevice: (name: string) => Promise<void>;
}

export const DesktopTopBar: React.FC<DesktopTopBarProps> = ({
  onRefresh,
  isSyncModalOpen,
  setIsSyncModalOpen,
  activityLogs,
  onPair,
  onForceSync,
  onUnpair,
  onRenamePeer,
  onRenameLocalDevice
}) => {
  const {
    activeTab,
    notifications,
    recentlyDeleted,
    setIsGlobalSearchOpen,
    setIsRecentlyDeletedModalOpen,
    setIsAddLessonModalOpen,
    setIsAddQuickLessonModalOpen,
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
    getPendingOutbox,
    getSyncHistory,
    clearSyncHistory,
    forceSyncPeer,
    startHosting
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const deletedCount = recentlyDeleted.students.length + recentlyDeleted.groups.length + recentlyDeleted.lessons.length;

  const handleRefreshClick = () => {
    onRefresh();
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-hover/80 dark:bg-surface-border/40 border border-surface-border hover:border-primary/40 text-text-muted text-xs font-medium transition-all cursor-pointer w-48 xl:w-60 justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-text-muted" />
              <span className="truncate">{t('search_placeholder') || 'Schüler, Stunden suchen...'}</span>
            </div>
            <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-border/60 text-text-muted">
              Ctrl+K
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
            syncState.pairedPeers && syncState.pairedPeers.some(p => devicePresences?.get(p.deviceId)?.isOnline)
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
