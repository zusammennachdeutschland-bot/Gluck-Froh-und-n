import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Home, Calendar, Users, MoreHorizontal, Wallet, BarChart2, Settings, Zap, History, Play, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const BottomNav: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    setIsAddQuickLessonModalOpen, 
    setIsStartLessonNowModalOpen, 
    t,
    language
  } = useApp();
  
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const isRtl = language === 'ar' || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');

  // Helper to determine if "More" sub-tabs are active
  const isHistoryActive = activeTab === 'history';
  const isReportsActive = activeTab === 'reports';
  const isSettingsActive = activeTab === 'settings';
  const isMoreTabActive = isHistoryActive || isReportsActive || isSettingsActive;

  // Define primary tabs
  const leftTabs = [
    { id: 'home', label: t('nav_home') || 'Start', icon: Home },
    { id: 'schedule', label: t('nav_schedule') || 'Termine', icon: Calendar },
    { id: 'students', label: t('nav_students') || 'Schüler', icon: Users },
  ];

  const rightTabs = [
    { id: 'payments', label: t('nav_payments') || 'Zahlungen', icon: Wallet },
  ];

  // Dynamic more tab metadata
  const getMoreTabMetadata = () => {
    if (isHistoryActive) return { label: t('nav_history') || 'Sitzungen', icon: History, colorClass: 'text-primary' };
    if (isReportsActive) return { label: t('nav_reports') || 'Berichte', icon: BarChart2, colorClass: 'text-primary' };
    if (isSettingsActive) return { label: t('nav_settings') || 'Einstellungen', icon: Settings, colorClass: 'text-primary' };
    return { label: t('nav_more') || 'Mehr', icon: MoreHorizontal, colorClass: 'text-text-muted/70' };
  };

  const moreTab = getMoreTabMetadata();

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId as any);
    setShowMoreMenu(false);
    setShowQuickMenu(false);
  };

  return (
    <div className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40 max-w-lg mx-auto select-none pointer-events-none">
      <div className="relative w-full flex justify-center">
        {/* Floating Dock glassmorphism container */}
        <div className="w-full bg-surface/80 dark:bg-background/85 backdrop-blur-xl border border-surface-border/40 dark:border-surface-border/60 rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] px-3 py-2 flex items-center justify-between pointer-events-auto relative">
          
          {/* LEFT TABS */}
          <div className="flex items-center gap-1">
            {leftTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className="relative flex items-center justify-center py-2 px-3 rounded-full cursor-pointer transition-all focus:outline-none shrink-0"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* Gliding Active background Pill using framer-motion */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-primary/10 dark:bg-primary-soft rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}

                  <motion.div 
                    animate={{ scale: isActive ? 1.08 : 1 }}
                    className="flex items-center gap-1.5"
                  >
                    <IconComponent
                      className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-colors duration-200 ${
                        isActive
                          ? 'text-primary dark:text-primary'
                          : 'text-text-muted/70 dark:text-slate-500 hover:text-slate-600 dark:hover:text-primary'
                      }`}
                    />
                    
                    {/* Expandable Label only for active state */}
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.span
                          initial={{ width: 0, opacity: 0, scale: 0.8 }}
                          animate={{ width: 'auto', opacity: 1, scale: 1 }}
                          exit={{ width: 0, opacity: 0, scale: 0.8 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                          className="text-[10px] sm:text-xs font-black tracking-tight text-primary dark:text-primary whitespace-nowrap overflow-hidden pr-0.5"
                        >
                          {tab.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </button>
              );
            })}
          </div>

          {/* CENTER Tactile Quick Action FAB */}
          <div className="relative flex items-center justify-center shrink-0 -mt-7 select-none">
            {/* Soft breathing background rings */}
            <div className="absolute inset-[-4px] bg-primary/10 dark:bg-primary-soft rounded-full animate-ping opacity-60 pointer-events-none scale-90" />
            
            <motion.button
              whileHover={{ scale: 1.12, rotate: showQuickMenu ? 90 : 0 }}
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                setShowQuickMenu(prev => !prev);
                setShowMoreMenu(false);
              }}
              className="w-12 h-12 rounded-full bg-linear-to-tr from-primary to-primary-hover hover:from-primary hover:to-primary-hover text-white flex items-center justify-center shadow-lg shadow-primary/50 dark:shadow-primary/30 ring-[5px] ring-white dark:ring-black relative z-10 cursor-pointer focus:outline-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Schnell-Eintrag"
              title="Aktionen anzeigen"
            >
              <Zap className="w-5.5 h-5.5 fill-white" />
            </motion.button>

            {/* Quick Action Popover Menu */}
            <AnimatePresence>
              {showQuickMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 15 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  className="absolute bottom-16 left-1/2 -translate-x-1/2 w-60 bg-surface/95 dark:bg-background/95 backdrop-blur-xl border border-surface-border/40 dark:border-surface-border/60 rounded-[20px] shadow-xl p-1.5 space-y-1 z-50 pointer-events-auto origin-bottom"
                >
                  <button
                    onClick={() => {
                      setIsAddQuickLessonModalOpen(true);
                      setShowQuickMenu(false);
                    }}
                    className="w-full text-start flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-background dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-xs font-black text-slate-900 dark:text-slate-100">
                        {t('quick_lesson_modal_title') || 'Schnell-Eintrag'}
                      </span>
                      <span className="block text-[9px] text-text-muted/70 font-medium truncate">
                        {language === 'ar' ? 'جدولة حصة بسرعة' : 'Schnell eine Lektion planen'}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsStartLessonNowModalOpen(true);
                      setShowQuickMenu(false);
                    }}
                    className="w-full text-start flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-background dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-violet-500 mt-0.5 shrink-0 fill-violet-500/15" />
                    <div className="min-w-0">
                      <span className="block text-xs font-black text-slate-900 dark:text-slate-100">
                        {t('sofort_title') || 'Start Lesson Now (Anytime)'}
                      </span>
                      <span className="block text-[9px] text-text-muted/70 font-medium truncate">
                        {language === 'ar' ? 'تشغيل مؤقت فوري للحصة' : 'Sofort eine Live-Stoppuhr starten'}
                      </span>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT TABS */}
          <div className="flex items-center gap-1">
            {rightTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className="relative flex items-center justify-center py-2 px-3 rounded-full cursor-pointer transition-all focus:outline-none shrink-0"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-primary/10 dark:bg-primary-soft rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}

                  <motion.div 
                    animate={{ scale: isActive ? 1.08 : 1 }}
                    className="flex items-center gap-1.5"
                  >
                    <IconComponent
                      className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-colors duration-200 ${
                        isActive
                          ? 'text-primary dark:text-primary'
                          : 'text-text-muted/70 dark:text-slate-500 hover:text-slate-600 dark:hover:text-primary'
                      }`}
                    />
                    
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.span
                          initial={{ width: 0, opacity: 0, scale: 0.8 }}
                          animate={{ width: 'auto', opacity: 1, scale: 1 }}
                          exit={{ width: 0, opacity: 0, scale: 0.8 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                          className="text-[10px] sm:text-xs font-black tracking-tight text-primary dark:text-primary whitespace-nowrap overflow-hidden pr-0.5"
                        >
                          {tab.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </button>
              );
            })}

            {/* MORE BUTTON */}
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setShowMoreMenu(prev => !prev);
                  setShowQuickMenu(false);
                }}
                className="relative flex items-center justify-center py-2 px-3 rounded-full cursor-pointer transition-all focus:outline-none shrink-0"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isMoreTabActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-primary/10 dark:bg-primary-soft rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}

                <motion.div 
                  animate={{ scale: isMoreTabActive ? 1.08 : 1 }}
                  className="flex items-center gap-1.5"
                >
                  <moreTab.icon
                    className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-colors duration-200 ${
                      isMoreTabActive
                        ? 'text-primary dark:text-primary'
                        : 'text-text-muted/70 dark:text-slate-500 hover:text-slate-600 dark:hover:text-primary'
                    }`}
                  />
                  
                  <AnimatePresence initial={false}>
                    {isMoreTabActive && (
                      <motion.span
                        initial={{ width: 0, opacity: 0, scale: 0.8 }}
                        animate={{ width: 'auto', opacity: 1, scale: 1 }}
                        exit={{ width: 0, opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                        className="text-[10px] sm:text-xs font-black tracking-tight text-primary dark:text-primary whitespace-nowrap overflow-hidden pr-0.5"
                      >
                        {moreTab.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </button>

              {/* Modern Frosted-glass context menu popover */}
              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 15 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    className={`absolute bottom-14 ${isRtl ? 'left-0 origin-bottom-left' : 'right-0 origin-bottom-right'} w-48 sm:w-52 bg-surface/95 dark:bg-background/95 backdrop-blur-xl border border-surface-border/40 dark:border-surface-border/60 rounded-[20px] shadow-xl p-1.5 space-y-1.5 z-50`}
                  >
                    <button
                      onClick={() => handleTabClick('freeTime')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start ${
                        activeTab === 'freeTime'
                          ? 'bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary'
                          : 'hover:bg-background dark:hover:bg-slate-900 text-text-main'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-primary shrink-0" />
                      <span>{t('nav_free_time') || 'Free Time'}</span>
                    </button>
                    <button
                      onClick={() => handleTabClick('history')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start ${
                        activeTab === 'history'
                          ? 'bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary'
                          : 'hover:bg-background dark:hover:bg-slate-900 text-text-main'
                      }`}
                    >
                      <History className="w-4 h-4 text-primary shrink-0" />
                      <span>{t('nav_history') || 'Sitzungen'}</span>
                    </button>

                    <button
                      onClick={() => handleTabClick('reports')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start ${
                        activeTab === 'reports'
                          ? 'bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary'
                          : 'hover:bg-background dark:hover:bg-slate-900 text-text-main'
                      }`}
                    >
                      <BarChart2 className="w-4 h-4 text-primary shrink-0" />
                      <span>{t('nav_reports') || 'Berichte'}</span>
                    </button>

                    <button
                      onClick={() => handleTabClick('settings')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-start ${
                        activeTab === 'settings'
                          ? 'bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary'
                          : 'hover:bg-background dark:hover:bg-slate-900 text-text-main'
                      }`}
                    >
                      <Settings className="w-4 h-4 text-primary shrink-0" />
                      <span>{t('nav_settings') || 'Einstellungen'}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
