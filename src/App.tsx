import { App as CapacitorApp } from '@capacitor/app';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
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

import { useLessonReminders } from './hooks/useLessonReminders';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

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
    isRecentlyDeletedModalOpen, setIsRecentlyDeletedModalOpen
  } = useApp();

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

  // Native Widget Deep-Link Router & Cold Start listener
  useEffect(() => {
    let urlListener: any = null;

    // Check cold-start launch URL
    CapacitorApp.getLaunchUrl()
      .then(launchUrl => {
        if (launchUrl && launchUrl.url) {
          handleDeepLink(launchUrl.url);
        }
      })
      .catch(() => {});

    // Listen for runtime deep-links
    const setupUrlListener = async () => {
      urlListener = await CapacitorApp.addListener('appUrlOpen', (data: { url: string }) => {
        if (data?.url) {
          handleDeepLink(data.url);
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
  }, [handleDeepLink]);

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
    isBackupModalOpen
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
      isBackupModalOpen
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
    isBackupModalOpen
  ]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

      const backButtonListener = CapacitorApp.addListener('backButton', () => {
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
          isBackupModalOpen: backupOpen
        } = stateRef.current;

        if (searchOpen) {
          setIsGlobalSearchOpen(false);
        } else if (deletedOpen) {
          setIsRecentlyDeletedModalOpen(false);
        } else if (controlOpen) {
          closeLessonControl();
        } else if (addLessonOpen) {
          setIsAddLessonModalOpen(false);
        } else if (addQuickOpen) {
          setIsAddQuickLessonModalOpen(false);
        } else if (startNowOpen) {
          setIsStartLessonNowModalOpen(false);
        } else if (addStudentOpen) {
          setIsAddStudentModalOpen(false);
        } else if (addGroupOpen) {
          setIsAddGroupModalOpen(false);
        } else if (backupOpen) {
          setIsBackupModalOpen(false);
        } else {
          // Check for any DOM overlay / modal container
          const overlays = document.querySelectorAll('.fixed.inset-0');
          if (overlays.length > 0) {
            const topOverlay = overlays[overlays.length - 1] as HTMLElement;
            const closeBtn = topOverlay.querySelector('button') as HTMLButtonElement;
            if (closeBtn) {
              closeBtn.click();
            } else {
              topOverlay.click();
            }
            return;
          }

          if (currentActiveTab !== 'home') {
            setActiveTab('home');
          } else {
            CapacitorApp.minimizeApp();
          }
        }
      });

      return () => {
        backButtonListener.then((listener) => listener.remove());
      };
    }
  }, []);


  return (
    <div className="min-h-[100dvh] bg-background text-text-main font-sans antialiased overflow-hidden">
      {/* ================= MOBILE EXPERIENCE (Preserved 100%) ================= */}
      <div className="md:hidden max-w-lg mx-auto bg-background h-[100dvh] shadow-2xl relative flex flex-col border-x border-surface-border/80 dark:border-surface-border">
        <Header />

        {/* Tab View Content Area */}
        <main 
          className="flex-1 px-2.5 py-2.5 sm:p-3 md:p-4 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] overflow-x-hidden relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`mobile-${activeTab}`}
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="space-y-2.5 sm:space-y-3"
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
            </motion.div>
          </AnimatePresence>
        </main>

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
    </div>
  );
}


import { migrateFromLocalStorageToIndexedDB } from './services/migrationService';
import { storage } from './services/storageService';

export default function App() {
  const [initialData, setInitialData] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        await migrateFromLocalStorageToIndexedDB();
        const keys = [
          'dl_theme', 'dl_accent_color', 'dl_quick_todos', 'dl_language', 'dl_profile',
          'dl_groups', 'dl_students', 'dl_lessons', 'dl_payments', 'dl_certificates',
          'dl_notifications', 'dl_notification_settings', 'dl_inspiration_settings', 'dl_inspiration_messages',
          'dl_last_backup_time', 'dl_dismissed_dashboard_lessons', 'dl_recently_deleted',
          'dl_active_lesson_session', 'dl_notified_lesson_alerts', 'dl_local_backup_data',
          'hod_german_students', 'hod_complaints', 'hod_student_action_plans', 'hod_visit_records'
        ];
        
        const values = await Promise.all(keys.map(k => storage.getItem(k)));
        const data: any = {};
        keys.forEach((key, idx) => {
          data[key] = values[idx];
        });
        if (isMounted) {
          setInitialData(data);
        }
      } catch (err) {
        console.error('Error during loadData initialisation:', err);
        if (isMounted) {
          setLoadError(true);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loadError) {
    return (
      <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <div className="text-red-500 font-bold text-xl">System Error / Speicherfehler</div>
        <p className="text-text-main text-sm max-w-md">
          A critical error occurred while accessing the local database. The app has been halted to prevent data loss. 
          Please try restarting the app or contact support.
        </p>
      </div>
    );
  }

  if (!initialData) {
    return <div className="h-[100dvh] w-screen flex items-center justify-center bg-background"><div className="animate-pulse text-slate-500">Lade Daten...</div></div>;
  }

  return (
    <AppProvider initialData={initialData}>
      <MainApp />
    </AppProvider>
  );
}
