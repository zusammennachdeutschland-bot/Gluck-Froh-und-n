import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, Calendar, Users, Wallet, BarChart2, Settings, 
  History, Award, Clock, Plus, Zap, UserPlus, Layers,
  Search, Moon, Sun, RefreshCw, Trash2, CheckCircle2,
  Sparkles, Globe, Bell
} from 'lucide-react';
import { AvatarImage } from '../AvatarImage';
import { DEFAULT_OFFLINE_AVATAR } from '../../data/avatarPresets';
import { SyncHeaderButton } from '../sync/SyncHeaderButton';

interface DesktopSidebarProps {
  onOpenSyncModal: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ onOpenSyncModal }) => {
  const {
    activeTab,
    setActiveTab,
    profile,
    theme,
    toggleTheme,
    language,
    notifications,
    recentlyDeleted,
    isSyncReady,
    syncState,
    devicePresences,
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
              src={profile.avatarUrl || DEFAULT_OFFLINE_AVATAR}
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
              {activeStudentsCount} {t('daily_stats_students') || 'Schüler'} • {activeGroupsCount} {t('daily_stats_groups') || 'Gruppen'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-text-muted/80">
          Navigation
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary text-white shadow-sm shadow-primary/30 font-extrabold'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover/80 dark:hover:bg-surface-border/40'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-text-muted'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-border/70 text-text-muted'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Actions Group */}
        <div className="pt-4 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted/80">
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
              onClick={onOpenSyncModal}
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
  );
};
