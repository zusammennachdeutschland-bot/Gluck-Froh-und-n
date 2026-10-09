import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Home, Calendar, Users, MoreHorizontal, Wallet, BarChart2, Settings, Zap, History, Play, Clock, Award, BookOpen, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';

export const BottomNav: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    setIsAddQuickLessonModalOpen, 
    setIsStartLessonNowModalOpen, 
    t,
    language,
    _t,
    students,
    groups,
    lessons,
    payments
  } = useApp();
  
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [seenDueCount, setSeenDueCount] = useState(0);

  const isRtl = language === 'ar' || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');

  const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
  const dueCount = dueCycles.length;

  useEffect(() => {
    if (activeTab === 'payments' || activeTab === 'finance') {
      setSeenDueCount(dueCount);
    }
  }, [activeTab, dueCount]);

  const unreadDueCount = (activeTab === 'payments' || activeTab === 'finance') ? 0 : Math.max(0, dueCount - seenDueCount);

  // Helper to determine if "More" sub-tabs are active
  const isHistoryActive = activeTab === 'history';
  const isReportsActive = activeTab === 'reports';
  const isSettingsActive = activeTab === 'settings';
  const isCertificatesActive = activeTab === 'certificates';
  const isFreeTimeActive = activeTab === 'freeTime';

  // Define primary tabs
  const leftTabs = [
    { id: 'home', label: t('nav_home') || 'Start', icon: Home },
    { id: 'schedule', label: t('nav_schedule') || 'Termine', icon: Calendar },
    { id: 'students', label: t('nav_students') || 'Schüler', icon: Users },
  ];

  const rightTabs = [
    { id: 'payments', label: t('nav_payments') || 'Zahlungen', icon: Wallet, badge: unreadDueCount > 0 ? unreadDueCount : null },
    { id: 'schoolSchedule', label: _t('المدرسة', 'School', 'Schule'), icon: BookOpen },
    { id: 'hod', label: _t('القسم', 'HOD', 'Fachleiter'), icon: Layers },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId as any);
    setShowQuickMenu(false);
  };

  return (
    <div className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-2 sm:left-4 right-2 sm:right-4 z-40 max-w-lg mx-auto select-none pointer-events-none">
      <div className="relative w-full flex justify-center">
        {/* Floating Dock near-transparent pure glass container */}
        <div 
          className="w-full bg-white/[0.06] dark:bg-black/[0.12] backdrop-blur-[6px] backdrop-saturate-125 border border-white/30 dark:border-white/10 rounded-[26px] shadow-[0_8px_30px_0_rgba(0,0,0,0.04),inset_0_1px_1px_0_rgba(255,255,255,0.4)] dark:shadow-[0_8px_30px_0_rgba(0,0,0,0.25),inset_0_1px_1px_0_rgba(255,255,255,0.08)] px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between pointer-events-auto relative transition-colors duration-200"
          style={{ WebkitBackdropFilter: 'blur(6px) saturate(125%)' }}
        >
          
          {/* LEFT TABS */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {leftTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className="relative flex items-center justify-center py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-full cursor-pointer focus:outline-none shrink-0"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  title={tab.label}
                >
                  {/* Active background Pill with subtle glass tint */}
                  <div
                    className={`absolute inset-0 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3)] rounded-full -z-10 transition-all duration-150 ease-out ${
                      isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  />

                  <div className="flex items-center gap-1.5">
                    <IconComponent
                      className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-colors duration-150 ${
                        isActive
                          ? 'text-primary'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    />
                    
                    {/* Expandable Label */}
                    <span
                      className={`text-[10px] sm:text-xs font-black tracking-tight text-primary whitespace-nowrap overflow-hidden transition-all duration-150 ease-out pr-0.5 ${
                        isActive ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* CENTER Tactile Quick Action FAB */}
          <div className="relative flex items-center justify-center shrink-0 -mt-7 select-none">
            {/* Subtle glow */}
            <div className="absolute inset-[-2px] bg-primary/15 dark:bg-primary/25 rounded-full blur-xs pointer-events-none" />
            
            <button
              onClick={() => {
                setShowQuickMenu(prev => !prev);
                setShowMoreMenu(false);
              }}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-linear-to-tr from-primary to-primary-hover hover:from-primary hover:to-primary-hover text-white flex items-center justify-center shadow-lg shadow-primary/40 dark:shadow-primary/30 ring-[3.5px] sm:ring-[4px] ring-white/50 dark:ring-white/20 backdrop-blur-md relative z-10 cursor-pointer focus:outline-none transition-transform duration-150 active:scale-90 ${
                showQuickMenu ? 'rotate-45' : 'rotate-0'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent', WebkitBackdropFilter: 'blur(12px)' }}
              aria-label="Schnell-Eintrag"
              title="Aktionen anzeigen"
            >
              <Zap className="w-5 h-5 sm:w-5.5 sm:h-5.5 fill-white" />
            </button>

            {/* Quick Action Popover Menu */}
            <AnimatePresence>
              {showQuickMenu && (
                <>
                  {/* Invisible click-away overlay - completely transparent with NO dark tint or shadow */}
                  <div 
                    className="fixed inset-0 z-40 bg-transparent cursor-pointer pointer-events-auto select-none"
                    onClick={() => setShowQuickMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 bg-surface border border-surface-border rounded-[22px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1.5 space-y-1 z-50 pointer-events-auto origin-bottom"
                  >
                    <button
                      onClick={() => {
                        setIsAddQuickLessonModalOpen(true);
                        setShowQuickMenu(false);
                      }}
                      className="w-full text-start flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
                        <Zap className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-black text-text-main">
                          {t('quick_lesson_modal_title') || 'Schnell-Eintrag'}
                        </span>
                        <span className="block text-[10px] text-text-muted font-medium truncate">
                          {_t('جدولة حصة بسرعة', 'Quickly schedule a lesson', 'Schnell eine Lektion planen')}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsStartLessonNowModalOpen(true);
                        setShowQuickMenu(false);
                      }}
                      className="w-full text-start flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
                        <Play className="w-4.5 h-4.5 text-primary fill-primary/30" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-black text-text-main">
                          {t('sofort_title') || _t('بدء حصة الآن', 'Start Lesson Now', 'Lektion jetzt starten')}
                        </span>
                        <span className="block text-[10px] text-text-muted font-medium truncate">
                          {_t('تشغيل مؤقت فوري للحصة', 'Start an instant lesson timer', 'Sofort eine Live-Stoppuhr starten')}
                        </span>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

            {/* RIGHT TABS */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {rightTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className="relative flex items-center justify-center py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-full cursor-pointer focus:outline-none shrink-0"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  title={tab.label}
                >
                  <div
                    className={`absolute inset-0 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3)] rounded-full -z-10 transition-all duration-150 ease-out ${
                      isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  />

                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <IconComponent
                        className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-colors duration-150 ${
                          isActive
                            ? 'text-primary'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      />
                      {(tab as any).badge && (
                        <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-bold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-xs">
                          {(tab as any).badge}
                        </span>
                      )}
                    </div>
                    
                    <span
                      className={`text-[10px] sm:text-xs font-black tracking-tight text-primary whitespace-nowrap overflow-hidden transition-all duration-150 ease-out pr-0.5 ${
                        isActive ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};
