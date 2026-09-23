import { App as CapacitorApp } from '@capacitor/app';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { PullToRefresh } from './components/PullToRefresh';
import { TodaysProgressTimeline } from './components/TodaysProgressTimeline';
import { DailyStats } from './components/DailyStats';
import { PaymentAlertsCard } from './components/PaymentAlertsCard';
import { HomeworkFollowUpWidget } from './components/HomeworkFollowUpWidget';
import { TomorrowsLessonsWidget } from './components/TomorrowsLessonsWidget';
import { AvailableTodayWidget } from './components/AvailableTodayWidget';

import { SmartDailySummaryWidget } from './components/SmartDailySummaryWidget';
import { QuickTodoWidget } from './components/QuickTodoWidget';
import { InspirationCardWidget } from './components/InspirationCardWidget';
import { SchoolTodayCard } from './components/SchoolTodayCard';
import { ScheduleView } from './components/ScheduleView';
import { StudentsView } from './components/StudentsView';
import { FinanceView } from './components/finance/FinanceView';
import { ReportsView } from './components/ReportsView';
import { SessionHistoryView } from './components/SessionHistoryView';
import { SettingsView } from './components/SettingsView';
import { FreeTimeSlotsView } from './components/FreeTimeSlotsView';
import { CertificateCenter } from './components/certificates/CertificateCenter';
import { SchoolScheduleView } from './components/SchoolScheduleView';
import { HodHubView } from './components/HodHubView';

import { DesktopSidebar } from './components/desktop/DesktopSidebar';
import { DesktopTopBar } from './components/desktop/DesktopTopBar';
import { DesktopDashboard } from './components/desktop/DesktopDashboard';
import { useDesktopShortcuts } from './hooks/useDesktopShortcuts';

import { AnimatePresence, motion } from 'motion/react';
import { BottomNav } from './components/BottomNav';
import { LessonControlModal } from './components/LessonControlModal';
import { AddLessonModal } from './components/AddLessonModal';
import { AddQuickLessonModal } from './components/AddQuickLessonModal';
import { AddStudentModal } from './components/AddStudentModal';
import { AddGroupModal } from './components/AddGroupModal';
import { StartLessonNowModal } from './components/StartLessonNowModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { RecentlyDeletedModal } from './components/RecentlyDeletedModal';
import { SetupWizard } from './components/SetupWizard';
import { BackupModal } from './components/BackupModal';
import { FloatingNetworkMonitor } from './components/FloatingNetworkMonitor';
import { AddFinanceTransactionModal } from './components/finance/modals/AddFinanceTransactionModal';
import { LoadingScreen } from './components/LoadingScreen';
import { LessonAlarmModal } from './components/LessonAlarmModal';

import { useLessonReminders } from './hooks/useLessonReminders';
import { 
  setupNotificationActionListener, 
  initNotificationChannels, 
  getNotificationPermission, 
  requestNotificationPermission 
} from './services/notificationService';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Toast } from '@capacitor/toast';

function MainApp() {
  useLessonReminders();
  useDesktopShortcuts();

  const { 
    activeTab, setActiveTab, 
    lessons, openLessonControl,
    isControlModalOpen, closeLessonControl,
    isAddLessonModalOpen, setIsAddLessonModalOpen,
    isAddQuickLessonModalOpen, setIsAddQuickLessonModalOpen,
    isStartLessonNowModalOpen, setIsStartLessonNowModalOpen,
    isAddStudentModalOpen, setIsAddStudentModalOpen,
    isAddGroupModalOpen, setIsAddGroupModalOpen,
    isBackupModalOpen, setIsBackupModalOpen,
    isGlobalSearchOpen, setIsGlobalSearchOpen,
    isRecentlyDeletedModalOpen, setIsRecentlyDeletedModalOpen,
    refreshCalendarAndDashboard,
    syncAllPeers,
    t,
    language,
    activeAlarmLesson,
    dismissLessonAlarm,
    snoozeLessonAlarm,
    notificationSettings
  } = useApp();

  // Ensure notification channels and system permissions are properly configured for outside-the-app alerts
  useEffect(() => {
    const timer = setTimeout(() => {
      const initAlarmPermissions = async () => {
        try {
          await initNotificationChannels(notificationSettings);
          const perm = await getNotificationPermission();
          if (notificationSettings?.masterEnabled !== false && (perm === 'prompt' || perm === 'default')) {
            await requestNotificationPermission();
          }
        } catch (err) {
          console.warn('Initial notification permissions setup notice:', err);
        }
      };
      initAlarmPermissions();
    }, 1200);

    return () => clearTimeout(timer);
  }, [notificationSettings?.masterEnabled]);

  const [quickTransactionType, setQuickTransactionType] = useState<'income' | 'expense' | 'transfer' | null>(null);
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);

  // Deep Link handler
  const handleDeepLink = useCallback((url: string) => {
    if (!url) return;
    console.log('Handling deep link URL:', url);

    // 1. Handle Lesson Deep Links: ags19://lesson/{id}
    if (url.includes('ags19://lesson/')) {
      const rawId = url.split('ags19://lesson/')[1];
      const lessonId = rawId ? rawId.split('?')[0].split('/')[0] : '';
      if (lessonId && lessonId !== 'null') {
        const targetLesson = lessons.find(l => l.id === lessonId);
        if (targetLesson) {
          openLessonControl(targetLesson);
        } else {
          setPendingLessonId(lessonId);
        }
      }
    } 
    // 2. Handle Action Deep Links: ags19://action/{action} or ags19://{action}
    else {
      let action = '';
      if (url.includes('ags19://action/')) {
        action = url.split('ags19://action/')[1]?.split('?')[0]?.split('/')[0]?.toLowerCase();
      } else if (url.includes('ags19://')) {
        action = url.split('ags19://')[1]?.split('?')[0]?.split('/')[0]?.toLowerCase();
      }

      if (action) {
        switch (action) {
          case 'payments':
          case 'quick_payment':
          case 'quick_student_payment':
            setActiveTab('payments');
            break;
          case 'quick_income':
            setQuickTransactionType('income');
            break;
          case 'quick_expense':
            setQuickTransactionType('expense');
            break;
          case 'quick_transfer':
            setQuickTransactionType('transfer');
            break;
          case 'schedule':
            setActiveTab('schedule');
            break;
          case 'students':
            setActiveTab('students');
            break;
          case 'history':
            setActiveTab('history');
            break;
          case 'reports':
            setActiveTab('reports');
            break;
          case 'settings':
            setActiveTab('settings');
            break;
          case 'freetime':
          case 'free_time':
            setActiveTab('freeTime');
            break;
          case 'home':
          case 'dashboard':
            setActiveTab('home');
            break;
          case 'todos':
          case 'todo':
          case 'tasks':
            setActiveTab('home');
            break;
          case 'quick_lesson':
          case 'add_quick_lesson':
            setIsAddQuickLessonModalOpen(true);
            break;
          case 'add_lesson':
            setIsAddLessonModalOpen(true);
            break;
          case 'add_student':
            setIsAddStudentModalOpen(true);
            break;
          case 'add_group':
            setIsAddGroupModalOpen(true);
            break;
          case 'start_lesson':
            setIsStartLessonNowModalOpen(true);
            break;
        }
      }
    }
  }, [lessons, openLessonControl, setActiveTab, setIsAddLessonModalOpen, setIsAddQuickLessonModalOpen, setIsAddStudentModalOpen, setIsAddGroupModalOpen, setIsStartLessonNowModalOpen]);

  const handleDeepLinkRef = useRef(handleDeepLink);
  useEffect(() => {
    handleDeepLinkRef.current = handleDeepLink;
  }, [handleDeepLink]);

  // Check pending lesson once lessons load
  useEffect(() => {
    if (pendingLessonId && lessons.length > 0) {
      const target = lessons.find(l => l.id === pendingLessonId);
      if (target) {
        openLessonControl(target);
        setPendingLessonId(null);
      }
    }
  }, [pendingLessonId, lessons, openLessonControl]);

  // Handle outside-the-app notification actions and clicks (Start lesson, Snooze, Dismiss)
  useEffect(() => {
    const unsub = setupNotificationActionListener(({ actionId, lessonId }) => {
      if (actionId === 'START_LESSON' || actionId === 'tap') {
        dismissLessonAlarm();
        if (lessonId) {
          const target = lessons.find(l => l.id === lessonId);
          if (target) {
            openLessonControl(target);
          }
        }
      } else if (actionId === 'SNOOZE_ALARM') {
        snoozeLessonAlarm(5);
      } else if (actionId === 'DISMISS_ALARM') {
        dismissLessonAlarm();
      }
    });

    return () => {
      unsub();
    };
  }, [lessons, openLessonControl, dismissLessonAlarm, snoozeLessonAlarm]);

  // Native Widget Deep-Link Router & Cold Start listener
  useEffect(() => {
    let urlListener: any = null;

    // Check cold-start launch URL
    CapacitorApp.getLaunchUrl()
      .then(launchUrl => {
        if (launchUrl && launchUrl.url) {
          handleDeepLinkRef.current(launchUrl.url);
        }
      })
      .catch(() => {});

    // Listen for runtime deep-links
    const setupUrlListener = async () => {
      urlListener = await CapacitorApp.addListener('appUrlOpen', (data: { url: string }) => {
        if (data?.url) {
          handleDeepLinkRef.current(data.url);
        }
      });
    };

    setupUrlListener();

    return () => {
      if (urlListener && typeof urlListener.then === 'function') {
        urlListener.then((l: any) => l.remove()).catch(() => {});
      } else if (urlListener && typeof urlListener.remove === 'function') {
        urlListener.remove();
      }
    };
  }, []);

  const appMountTimeRef = useRef<number>(Date.now());
  const lastBackPressRef = useRef<number>(0);

  const stateRef = useRef({
    activeTab,
    isGlobalSearchOpen,
    isRecentlyDeletedModalOpen,
    isControlModalOpen,
    isAddLessonModalOpen,
    isAddQuickLessonModalOpen,
    isStartLessonNowModalOpen,
    isAddStudentModalOpen,
    isAddGroupModalOpen,
    isBackupModalOpen,
    activeAlarmLesson
  });

  // Keep state reference up to date for back button handler to avoid stale closures
  useEffect(() => {
    stateRef.current = {
      activeTab,
      isGlobalSearchOpen,
      isRecentlyDeletedModalOpen,
      isControlModalOpen,
      isAddLessonModalOpen,
      isAddQuickLessonModalOpen,
      isStartLessonNowModalOpen,
      isAddStudentModalOpen,
      isAddGroupModalOpen,
      isBackupModalOpen,
      activeAlarmLesson
    };
  }, [
    activeTab,
    isGlobalSearchOpen,
    isRecentlyDeletedModalOpen,
    isControlModalOpen,
    isAddLessonModalOpen,
    isAddQuickLessonModalOpen,
    isStartLessonNowModalOpen,
    isAddStudentModalOpen,
    isAddGroupModalOpen,
    isBackupModalOpen,
    activeAlarmLesson
  ]);

  const callbacksRef = useRef({
    dismissLessonAlarm,
    closeLessonControl,
    setActiveTab,
    setIsGlobalSearchOpen,
    setIsRecentlyDeletedModalOpen,
    setIsAddLessonModalOpen,
    setIsAddQuickLessonModalOpen,
    setIsStartLessonNowModalOpen,
    setIsAddStudentModalOpen,
    setIsAddGroupModalOpen,
    setIsBackupModalOpen,
    language
  });

  useEffect(() => {
    callbacksRef.current = {
      dismissLessonAlarm,
      closeLessonControl,
      setActiveTab,
      setIsGlobalSearchOpen,
      setIsRecentlyDeletedModalOpen,
      setIsAddLessonModalOpen,
      setIsAddQuickLessonModalOpen,
      setIsStartLessonNowModalOpen,
      setIsAddStudentModalOpen,
      setIsAddGroupModalOpen,
      setIsBackupModalOpen,
      language
    };
  }, [
    dismissLessonAlarm,
    closeLessonControl,
    setActiveTab,
    setIsGlobalSearchOpen,
    setIsRecentlyDeletedModalOpen,
    setIsAddLessonModalOpen,
    setIsAddQuickLessonModalOpen,
    setIsStartLessonNowModalOpen,
    setIsAddStudentModalOpen,
    setIsAddGroupModalOpen,
    setIsBackupModalOpen,
    language
  ]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      try {
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      } catch {}

      const backButtonListener = CapacitorApp.addListener('backButton', () => {
        try {
          const now = Date.now();
          // Safeguard 1: Ignore any backButton events during the first 6 seconds after app mounting (prevents synthetic launch events from closing the app)
          if (now - appMountTimeRef.current < 6000) {
            console.log('[Android BackButton] Ignored during startup grace period.');
            return;
          }

          const {
            activeTab: currentActiveTab,
            isGlobalSearchOpen: searchOpen,
            isRecentlyDeletedModalOpen: deletedOpen,
            isControlModalOpen: controlOpen,
            isAddLessonModalOpen: addLessonOpen,
            isAddQuickLessonModalOpen: addQuickOpen,
            isStartLessonNowModalOpen: startNowOpen,
            isAddStudentModalOpen: addStudentOpen,
            isAddGroupModalOpen: addGroupOpen,
            isBackupModalOpen: backupOpen,
            activeAlarmLesson: alarmActive
          } = stateRef.current;

          const cb = callbacksRef.current;

          if (alarmActive) {
            cb.dismissLessonAlarm();
            return;
          }

          if (searchOpen) {
            cb.setIsGlobalSearchOpen(false);
          } else if (deletedOpen) {
            cb.setIsRecentlyDeletedModalOpen(false);
          } else if (controlOpen) {
            cb.closeLessonControl();
          } else if (addLessonOpen) {
            cb.setIsAddLessonModalOpen(false);
          } else if (addQuickOpen) {
            cb.setIsAddQuickLessonModalOpen(false);
          } else if (startNowOpen) {
            cb.setIsStartLessonNowModalOpen(false);
          } else if (addStudentOpen) {
            cb.setIsAddStudentModalOpen(false);
          } else if (addGroupOpen) {
            cb.setIsAddGroupModalOpen(false);
          } else if (backupOpen) {
            cb.setIsBackupModalOpen(false);
          } else {
            // Check for any open dialog/modal with a dedicated close button or dismiss via Escape
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
            document.dispatchEvent(escapeEvent);

            if (currentActiveTab !== 'home') {
              cb.setActiveTab('home');
            } else {
              // Double tap within 2500ms (and minimum 400ms apart to filter instantaneous synthetic bursts) to minimize
              const delta = now - lastBackPressRef.current;
              if (delta >= 400 && delta < 2500) {
                lastBackPressRef.current = 0;
                CapacitorApp.minimizeApp().catch(() => {});
              } else {
                lastBackPressRef.current = now;
                Toast.show({
                  text: cb.language === 'ar' ? 'اضغط مرة أخرى للخروج من التطبيق' : cb.language === 'de' ? 'Erneut tippen zum Beenden' : 'Press back again to exit',
                  duration: 'short',
                  position: 'bottom'
                }).catch(() => {});
              }
            }
          }
        } catch (err) {
          console.warn('[Android BackButton Handler Error]:', err);
        }
      });

      return () => {
        backButtonListener.then((listener) => listener.remove()).catch(() => {});
      };
    }
  }, []);



  return (
    <div className="min-h-[100dvh] bg-background text-text-main font-sans antialiased overflow-hidden">
      {/* ================= MOBILE EXPERIENCE (Preserved 100%) ================= */}
      <div className="md:hidden max-w-lg mx-auto bg-background h-[100dvh] shadow-2xl relative flex flex-col border-x border-surface-border/80 dark:border-surface-border">
        <Header />

        {/* Tab View Content Area with Pull-to-Refresh & Full Multi-Device Sync */}
        <PullToRefresh
          disabled={activeTab !== 'home' || isControlModalOpen || isAddLessonModalOpen || isAddQuickLessonModalOpen || isStartLessonNowModalOpen || isAddStudentModalOpen || isAddGroupModalOpen || isBackupModalOpen || !!quickTransactionType}
          onRefresh={async () => {
            refreshCalendarAndDashboard();
            try {
              await syncAllPeers();
            } catch (err) {
              console.warn('[PullToRefresh] Sync error:', err);
            }
          }}
          pullText={language === 'ar' ? 'اسحب للأسفل للتحديث والمزامنة...' : language === 'de' ? 'Zum Aktualisieren & Synchronisieren nach unten ziehen...' : 'Pull down to refresh & sync...'}
          releaseText={language === 'ar' ? 'اترك للتحديث والمزامنة الشاملة الآن' : language === 'de' ? 'Loslassen zum Aktualisieren & Synchronisieren' : 'Release to refresh & sync all'}
          refreshingText={language === 'ar' ? 'جارٍ تحديث ومزامنة البيانات مع الأجهزة...' : language === 'de' ? 'Daten werden aktualisiert & synchronisiert...' : 'Refreshing & syncing all devices...'}
          className="flex-1 px-2.5 py-2.5 sm:p-3 md:p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] overflow-x-hidden"
        >
          <div
            key={`mobile-${activeTab}`}
            className="space-y-2.5 sm:space-y-3 animate-in fade-in duration-150"
          >
            {activeTab === 'home' && (
              <>
                {/* Daily Inspiration & Gratitude Card */}
                <InspirationCardWidget />

                {/* School Today Card */}
                <SchoolTodayCard />

                {/* Today's Progress Timeline */}
                <TodaysProgressTimeline />

                {/* Compact Collapsible To-Do Widget */}
                <QuickTodoWidget />

                <HomeworkFollowUpWidget />

                {/* Tomorrow's Lessons Compact Widget */}
                <TomorrowsLessonsWidget />
                <AvailableTodayWidget />

                {/* Weekly & Monthly Statistics */}
                <DailyStats />

                {/* Payment Alerts */}
                <PaymentAlertsCard />

                {/* Smart Daily Summary Widget at bottom of Dashboard */}
                <SmartDailySummaryWidget />
              </>
            )}

            {activeTab === 'schedule' && <ScheduleView />}
            {activeTab === 'students' && <StudentsView />}
            {activeTab === 'history' && <SessionHistoryView />}
            {activeTab === 'payments' && <FinanceView />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'freeTime' && <FreeTimeSlotsView />}
            {activeTab === 'certificates' && <CertificateCenter />}
            {activeTab === 'schoolSchedule' && <SchoolScheduleView />}
            {activeTab === 'hod' && <HodHubView />}
          </div>
        </PullToRefresh>

        {/* Bottom Navigation */}
        <BottomNav />
      </div>

      {/* ================= DESKTOP WORKSPACE (Professional & Full Space) ================= */}
      <div className="hidden md:flex h-[100dvh] w-full bg-background overflow-hidden">
        {/* Desktop Sidebar (Left in LTR, Right in RTL) */}
        <DesktopSidebar />

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
          {/* Top Bar with Search, Actions & Profile */}
          <DesktopTopBar />

          {/* Desktop Content Canvas */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden bg-slate-50/40 dark:bg-background">
            <div className="max-w-7xl mx-auto w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`desktop-${activeTab}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'home' && <DesktopDashboard />}
                  {activeTab === 'schedule' && <ScheduleView />}
                  {activeTab === 'students' && <StudentsView />}
                  {activeTab === 'history' && <SessionHistoryView />}
                  {activeTab === 'payments' && <FinanceView />}
                  {activeTab === 'reports' && <ReportsView />}
                  {activeTab === 'settings' && <SettingsView />}
                  {activeTab === 'freeTime' && <FreeTimeSlotsView />}
                  {activeTab === 'certificates' && <CertificateCenter />}
                  {activeTab === 'schoolSchedule' && <SchoolScheduleView />}
                  {activeTab === 'hod' && <HodHubView />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      {/* ================= SHARED GLOBAL MODALS & DIALOGS ================= */}
      <FloatingNetworkMonitor />
      {isControlModalOpen && <LessonControlModal />}
      {isAddLessonModalOpen && <AddLessonModal onClose={() => setIsAddLessonModalOpen(false)} />}
      {isAddQuickLessonModalOpen && <AddQuickLessonModal onClose={() => setIsAddQuickLessonModalOpen(false)} />}
      {isStartLessonNowModalOpen && <StartLessonNowModal onClose={() => setIsStartLessonNowModalOpen(false)} />}
      {isAddStudentModalOpen && <AddStudentModal onClose={() => setIsAddStudentModalOpen(false)} />}
      {isAddGroupModalOpen && <AddGroupModal onClose={() => setIsAddGroupModalOpen(false)} />}
      {isBackupModalOpen && <BackupModal onClose={() => setIsBackupModalOpen(false)} />}
      <GlobalSearchModal />
      <RecentlyDeletedModal />
      <SetupWizard />
      {quickTransactionType && (
        <AddFinanceTransactionModal
          type={quickTransactionType}
          onClose={() => setQuickTransactionType(null)}
        />
      )}
      {activeAlarmLesson && (
        <LessonAlarmModal
          lesson={activeAlarmLesson}
          onDismiss={dismissLessonAlarm}
          onSnooze={snoozeLessonAlarm}
          onStartNow={(lesson) => {
            dismissLessonAlarm();
            openLessonControl(lesson);
          }}
        />
      )}
    </div>
  );
}


import { migrateFromLocalStorageToIndexedDB } from './services/migrationService';
import { storage } from './services/storageService';
import { sanitizeInitialData, clearAllLocalDataAndReset } from './services/dataSanitizer';

export default function App() {
  const [initialData, setInitialData] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');

  const runDataLoader = useCallback(async (isMounted: boolean) => {
    try {
      try {
        await migrateFromLocalStorageToIndexedDB();
      } catch (migErr) {
        console.warn('Migration non-fatal notice:', migErr);
      }

      const keys = [
        'dl_theme', 'dl_accent_color', 'dl_quick_todos', 'dl_language', 'dl_profile',
        'dl_groups', 'dl_students', 'dl_lessons', 'dl_payments', 'dl_certificates',
        'dl_notifications', 'dl_notification_settings', 'dl_inspiration_settings', 'dl_inspiration_messages',
        'dl_last_backup_time', 'dl_dismissed_dashboard_lessons', 'dl_recently_deleted',
        'dl_active_lesson_session', 'dl_notified_lesson_alerts', 'dl_local_backup_data',
        'hod_german_students', 'hod_complaints', 'hod_student_action_plans', 'hod_visit_records',
        'dl_school_notes', 'dl_finance_accounts', 'dl_finance_categories', 'dl_finance_transactions',
        'dl_finance_recurring', 'dl_finance_installments', 'dl_finance_notifications',
        'dl_settings', 'dl_sync_state'
      ];
      
      const values = await Promise.all(keys.map(async (k) => {
        try {
          return await storage.getItem(k);
        } catch {
          return null;
        }
      }));

      const rawDict: any = {};
      keys.forEach((key, idx) => {
        rawDict[key] = values[idx];
      });

      // Self-healing: Sanitize all collections, arrays, and objects
      const safeData = sanitizeInitialData(rawDict);

      if (isMounted) {
        setInitialData(safeData);
        setLoadError(false);
      }
    } catch (err: any) {
      console.error('Error during loadData initialization:', err);
      // Resilient fallback: instead of crashing, try loading with sanitized empty data
      try {
        const fallbackData = sanitizeInitialData({});
        if (isMounted) {
          setInitialData(fallbackData);
          setLoadError(false);
        }
      } catch {
        if (isMounted) {
          setErrorDetails(err?.message || String(err));
          setLoadError(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    runDataLoader(isMounted);
    return () => {
      isMounted = false;
    };
  }, [runDataLoader]);

  if (loadError) {
    return (
      <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center space-y-5 select-none font-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl font-bold">
          ⚠️
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-100">تم اكتشاف خطأ في قراءة البيانات القديمة</h2>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            حدث تعارض في صيغة البيانات المحفوظة محلياً. تم إيقاف الإغلاق المفاجئ للتطبيق ويمكنك حل المشكلة بنقرة واحدة أدناه.
          </p>
        </div>

        {errorDetails && (
          <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-[11px] font-mono text-rose-300 max-w-sm overflow-x-auto text-left w-full max-h-24">
            {errorDetails}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs pt-2">
          <button
            onClick={() => {
              setLoadError(false);
              const fallback = sanitizeInitialData({});
              setInitialData(fallback);
            }}
            className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
          >
            <span>إصلاح وترميم البيانات والمتابعة</span>
          </button>

          <button
            onClick={() => runDataLoader(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <span>إعادة المحاولة</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('هل تريد تصفير البيانات القديمة التالفة والبدء من جديد مع الاحتفاظ بنسخة طوارئ احتياطية؟')) {
                clearAllLocalDataAndReset();
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <span>تصفير البيانات التالفة وبدء جديد</span>
          </button>
        </div>
      </div>
    );
  }

  if (!initialData) {
    return <LoadingScreen message="Lade Daten..." />;
  }

  return (
    <AppProvider initialData={initialData}>
      <MainApp />
    </AppProvider>
  );
}
