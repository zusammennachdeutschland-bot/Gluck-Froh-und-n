import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson } from '../types';
import { formatLocalDate, parseLocalDate } from '../utils/timeUtils';
import { isPendingStatus } from '../utils/lessonUtils';
import { getGroupScheduleSlots, getDayNumber } from '../utils/scheduleUtils';
import { Bell, CheckCircle2, Clock, Trash2, Award, History, BarChart2, Settings, Menu, Sparkles, BookOpen, Layers, X, Users } from 'lucide-react';
import { NotificationsModal } from './NotificationsModal';
import { motion, AnimatePresence } from 'motion/react';
import { SyncHeaderButton } from './sync/SyncHeaderButton';
import { SyncCenterModal } from './sync/SyncCenterModal';
import { pairWithPeer } from '../services/sync/syncClient';

export const Header: React.FC = () => {
  const { 
    activeTab,
    setActiveTab,
    profile, 
    notifications, 
    lessons, 
    groups,
    students,
    dismissedDashboardLessonIds = [],
    openLessonControl, 
    refreshCalendarAndDashboard, 
    setIsRecentlyDeletedModalOpen,
    recentlyDeleted,
    t,
    _t,
    language,
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
  const [showMainMenuDrawer, setShowMainMenuDrawer] = useState(false);

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
    } catch {
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

  // Extract first name (clearing optional titles like Herr, Mr., أ., د.)
  const teacherFirstName = useMemo(() => {
    let rawName = '';
    if (language === 'ar') {
      rawName = profile?.displayNameAr?.trim() || profile?.nameAr?.trim() || profile?.displayName?.trim() || profile?.displayNameEn?.trim() || profile?.nameEn?.trim() || '';
    } else {
      rawName = profile?.displayNameEn?.trim() || profile?.nameEn?.trim() || profile?.displayName?.trim() || profile?.displayNameAr?.trim() || profile?.nameAr?.trim() || '';
    }

    if (!rawName) return '';

    const parts = rawName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';

    const titles = new Set([
      'herr', 'frau', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.', 'prof', 'prof.',
      'أ.', 'أستاذ', 'أستاذة', 'الاستاذ', 'الأستاذ', 'الأستاذة', 'الاستاذة', 'د.', 'دكتور', 'دكتورة', 'معلم', 'معلمة', 'كابتن', 'سيد', 'سيدة'
    ]);

    if (parts.length > 1 && titles.has(parts[0].toLowerCase())) {
      return parts[1];
    }

    return parts[0];
  }, [language, profile?.displayName, profile?.displayNameAr, profile?.displayNameEn, profile?.nameAr, profile?.nameEn]);

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    const name = teacherFirstName;
    const enName = name ? `, ${name}!` : '';
    const arName = name ? `، ${name}!` : '';
    const deName = name ? `, ${name}!` : '';

    if (hour < 12) {
      return _t(`صباح الخير${arName} 👋`, `Good Morning${enName} 👋`, `Guten Morgen${deName} 👋`);
    } else if (hour < 17) {
      return _t(`مساء الخير${arName} 👋`, `Good Afternoon${enName} 👋`, `Guten Tag${deName} 👋`);
    } else {
      return _t(`مساء الخير${arName} 👋`, `Good Evening${enName} 👋`, `Guten Abend${deName} 👋`);
    }
  }, [_t, teacherFirstName]);

  // Today's Date String
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Today's lessons
  const todaysLessons = useMemo(() => {
    const active = lessons
      .filter(l => !l.deleted && l.date === todayStr && !dismissedDashboardLessonIds.includes(l.id))
      .filter(l => {
        if (
          l.groupId && 
          l.groupId !== 'quick_group' && 
          l.status === 'scheduled' && 
          (!l.report || (!l.report.attendanceStatus && !l.report.teacherNotes && !l.report.homeworkTitle && l.report.quizScore === undefined)) &&
          (!l.studentPayments || Object.keys(l.studentPayments).length === 0) &&
          (!l.amountPaid || l.amountPaid === 0)
        ) {
          const grp = groups.find(g => g.id === l.groupId && !g.deleted);
          if (grp) {
            const activeSlots = getGroupScheduleSlots(grp);
            if (activeSlots.length > 0) {
              const lDate = parseLocalDate(l.date);
              const lDayNum = lDate.getDay();
              const matchesSlot = activeSlots.some(s => getDayNumber(s.day) === lDayNum && s.time === l.time);
              if (!matchesSlot) return false;
            }
          }
        }
        return true;
      });

    const seen = new Set<string>();
    const deduplicated: Lesson[] = [];
    active.forEach(l => {
      const key = l.groupId && l.groupId !== 'quick_group'
        ? `${l.groupId}_${l.date}_${l.time}`
        : l.id;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(l);
      }
    });

    return deduplicated;
  }, [lessons, groups, dismissedDashboardLessonIds, todayStr]);

  // Total lessons count
  const lessonsCount = todaysLessons.length;

  // Unique students scheduled today (or total active students)
  const todayStudentsCount = useMemo(() => {
    const studentSet = new Set<string>();
    todaysLessons.forEach(l => {
      if (l.studentId) {
        studentSet.add(l.studentId);
      } else if (l.groupId && l.groupId !== 'quick_group') {
        const groupStudents = students.filter(s => s.groupId === l.groupId);
        if (groupStudents.length > 0) {
          groupStudents.forEach(s => studentSet.add(s.id));
        } else {
          studentSet.add(`group_${l.groupId}`);
        }
      } else if (l.studentName) {
        studentSet.add(l.studentName);
      }
    });
    return studentSet.size > 0 ? studentSet.size : (students?.length || 0);
  }, [todaysLessons, students]);

  // Completed / resolved count & percent done
  const closedCount = useMemo(() => {
    return todaysLessons.filter(l => l.status === 'completed' || l.status === 'cancelled').length;
  }, [todaysLessons]);

  const percentDone = useMemo(() => {
    return lessonsCount > 0 ? Math.round((closedCount / lessonsCount) * 100) : 0;
  }, [lessonsCount, closedCount]);

  return (
    <>
      {/* Compact Safe Area Spacer for Android / iOS Status Bar */}
      <div 
        className="bg-surface dark:bg-black select-none max-w-lg mx-auto w-full shrink-0 transition-colors" 
        style={{ height: 'max(14px, env(safe-area-inset-top, 14px))' }}
      />

      {/* Uniform Compact Teacher Dashboard Header */}
      <header className="bg-surface dark:bg-black border-b border-surface-border/80 px-2.5 py-1.5 sm:px-3.5 sm:py-2 sticky top-0 z-30 transition-colors shadow-2xs">
        <div className="flex items-center justify-between gap-2 sm:gap-3 max-w-lg mx-auto">
          
          {/* Start: Greeting & Stats (Home) or Tab Title (Other tabs) */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="leading-tight min-w-0 flex-1">
              {activeTab === 'home' ? (
                <>
                  <h1 className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-tight truncate flex items-center gap-1">
                    <span>{greetingText}</span>
                  </h1>
                  <p className="text-[9.5px] sm:text-[10px] font-medium text-text-muted dark:text-slate-400 tracking-tight leading-tight truncate flex items-center gap-1 mt-0.5">
                    <span>{lessonsCount} {_t('حصص', 'Lessons', 'Lektionen')}</span>
                    <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
                    <span>{todayStudentsCount} {_t('طلاب', 'Students', 'Schüler')}</span>
                    <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
                    <span className="font-semibold text-primary dark:text-primary-hover">{percentDone}% {_t('مكتمل', 'Done', 'Erledigt')}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[8.5px] sm:text-[9px] font-bold text-text-muted flex items-center gap-1">
                    <span>{_t('القسم الحالي', 'Section', 'Bereich')}</span>
                  </p>
                  <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 capitalize leading-snug whitespace-normal break-words truncate">
                    {activeTab === 'schedule' ? (t('nav_schedule') || 'Termine')
                     : activeTab === 'students' ? (t('nav_students') || 'Schüler')
                     : activeTab === 'history' ? (t('nav_history') || 'Sitzungen')
                     : activeTab === 'payments' ? (t('nav_payments') || 'Zahlungen')
                     : activeTab === 'reports' ? (t('nav_reports') || 'Berichte')
                     : activeTab === 'settings' ? (t('nav_settings') || 'Einstellungen')
                     : activeTab === 'certificates' ? (t('nav_certificates') || 'Zertifikate')
                     : activeTab === 'freeTime' ? (t('nav_free_time') || 'Free Time')
                     : activeTab === 'schoolSchedule' ? _t('المدرسة', 'School', 'Schule')
                     : activeTab === 'hod' ? _t('القسم', 'HOD', 'Fachleiter')
                     : activeTab}
                  </h1>
                </>
              )}
            </div>
          </div>

          {/* End Action Toolbar: Notifications, Sync, Settings, 3-Bars Menu */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Notification Bell */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setShowNotifications(true)}
              className={`relative p-1.5 sm:p-2 rounded-full border transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                showNotifications
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-background dark:bg-background hover:bg-surface-hover text-text-main border-surface-border/80'
              }`}
              aria-label="Notifications"
              title={t('notifications') || 'Benachrichtigungen'}
            >
              <Bell className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${showNotifications ? 'text-white' : 'text-primary'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-black">
                  {unreadCount}
                </span>
              )}
            </motion.button>

            {/* Peer Sync Button - Always Visible right next to Settings */}
            <SyncHeaderButton 
              status={syncStatus}
              connectedCount={onlineCount}
              onClick={() => setIsSyncModalOpen(true)}
              isOpen={isSyncModalOpen}
            />

            {/* Direct Settings Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setActiveTab('settings')}
              className={`p-1.5 sm:p-2 rounded-full border transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-background dark:bg-background hover:bg-surface-hover text-text-main border-surface-border/80'
              }`}
              aria-label="Settings"
              title={t('nav_settings') || 'Einstellungen'}
            >
              <Settings className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'settings' ? 'text-white' : 'text-primary'}`} />
            </motion.button>

            {/* 3-Bars Main Menu Button (Includes Trash / Recently Deleted inside) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setShowMainMenuDrawer(true)}
              className={`relative p-1.5 sm:p-2 rounded-full border transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                showMainMenuDrawer
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-background dark:bg-background hover:bg-surface-hover text-text-main border-surface-border/80'
              }`}
              aria-label="Main Menu"
              title={_t('القائمة الرئيسية', 'Main Menu', 'Hauptmenü')}
            >
              <Menu className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${showMainMenuDrawer ? 'text-white' : 'text-primary'}`} />
              {deletedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white dark:ring-black" />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Menu Side Drawer (Opened by 3-Bars button) */}
      <AnimatePresence>
        {showMainMenuDrawer && (
          <div id="main-menu-drawer" className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowMainMenuDrawer(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Drawer Panel - Positioned on the trailing edge where the button is */}
            <motion.div
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`relative z-10 w-72 max-w-[80vw] h-full bg-surface border-surface-border p-4 flex flex-col justify-between shadow-2xl ${
                isRtl ? 'mr-auto border-r' : 'ml-auto border-l'
              }`}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-surface-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary-hover to-primary text-white flex items-center justify-center font-black text-lg shadow-md shadow-primary/20 shrink-0">
                      G
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black text-base tracking-tight text-text-main">Glück OS</h2>
                      <p className="text-xs text-text-muted truncate">{profile.displayName || 'Deutschlehrer'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMainMenuDrawer(false)}
                    className="p-1.5 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-1 overflow-y-auto max-h-[calc(100dvh-200px)]">
                  {[
                    { id: 'home', label: t('nav_home') || 'Startseite', icon: Sparkles },
                    { id: 'schedule', label: t('nav_schedule') || 'Termine', icon: Clock },
                    { id: 'students', label: t('nav_students') || 'Schüler', icon: Users },
                    { id: 'payments', label: t('nav_payments') || 'Zahlungen', icon: BarChart2 },
                    { id: 'history', label: t('nav_history') || 'Sitzungen', icon: History },
                    { id: 'reports', label: t('nav_reports') || 'Berichte', icon: BarChart2 },
                    { id: 'certificates', label: t('nav_certificates') || 'Zertifikate', icon: Award },
                    { id: 'freeTime', label: t('nav_free_time') || 'Free Time', icon: Clock },
                    { id: 'schoolSchedule', label: _t('جدول المدرسة', 'School Schedule', 'Stundenplan'), icon: BookOpen },
                    { id: 'hod', label: _t('إدارة القسم (HOD)', 'HOD Hub', 'Fachleiter Hub'), icon: Layers },
                    { id: 'settings', label: t('nav_settings') || 'Einstellungen', icon: Settings },
                  ].map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setShowMainMenuDrawer(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-start ${
                          isActive
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-text-main hover:bg-surface-hover dark:hover:bg-slate-900'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-primary'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drawer Footer: Trash & Settings */}
              <div className="pt-3 border-t border-surface-border space-y-2">
                <button
                  onClick={() => {
                    setIsRecentlyDeletedModalOpen(true);
                    setShowMainMenuDrawer(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-blue-500" />
                    <span>{t('recently_deleted') || 'Papierkorb'}</span>
                  </div>
                  {deletedCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-blue-500 text-white text-[10px] font-black rounded-full">
                      {deletedCount}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* Refresh Toast Notification */}
      {showToast && (
        <div className="bg-primary text-white text-xs font-bold py-2 px-4 shadow-lg flex items-center justify-center gap-2 animate-scale-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>✓ {t('dataRefreshed')}</span>
        </div>
      )}
 
      {/* Modals */}
      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
      
      {isSyncModalOpen && (
        <SyncCenterModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          syncStatus={onlineCount > 0 ? 'connected' : 'offline'}
          lastSyncTime={
            syncState?.pairedPeers && syncState.pairedPeers.length > 0
              ? new Date(Math.max(...syncState.pairedPeers.map(p => p.lastSyncedTimestamp || 0))).toLocaleTimeString()
              : 'Never'
          }
          nextAutoSyncTime="in 5 mins"
          localDevice={{ name: syncState?.localDeviceName || 'Mein Gerät', id: syncState?.localDeviceId || 'device-local' }}
          onRenameLocalDevice={onRenameLocalDevice}
          pairedPeers={syncState?.pairedPeers || []}
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


