import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Home, Calendar, Users, Wallet, BarChart2, Settings, 
  Zap, History, Play, Clock, Award, BookOpen, Layers, 
  Gamepad2, SlidersHorizontal, ShieldCheck, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import { ReorderBottomNavModal } from './ReorderBottomNavModal';

export const BottomNav: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    setIsAddQuickLessonModalOpen, 
    setIsStartLessonNowModalOpen, 
    isReorderBottomNavOpen,
    setIsReorderBottomNavOpen,
    bottomNavOrder,
    t,
    language,
    _t,
    students,
    groups,
    lessons,
    payments
  } = useApp();
  
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [seenDueCount, setSeenDueCount] = useState(0);

  const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
  const dueCount = dueCycles.length;

  useEffect(() => {
    if (activeTab === 'payments' || activeTab === 'finance') {
      setSeenDueCount(dueCount);
    }
  }, [activeTab, dueCount]);

  const unreadDueCount = (activeTab === 'payments' || activeTab === 'finance') ? 0 : Math.max(0, dueCount - seenDueCount);

  // Tab definitions dictionary with clean dynamic translation according to active language
  const allTabDefs: Record<string, { label: string; icon: any; badge?: number | null }> = {
    home: { 
      label: t('nav_home') || (language === 'ar' ? 'الرئيسية' : language === 'de' ? 'Start' : 'Home'), 
      icon: Home 
    },
    schedule: { 
      label: t('nav_schedule') || (language === 'ar' ? 'المواعيد' : language === 'de' ? 'Termine' : 'Schedule'), 
      icon: Calendar 
    },
    students: { 
      label: t('nav_students') || (language === 'ar' ? 'الطلاب' : language === 'de' ? 'Schüler' : 'Students'), 
      icon: Users 
    },
    parentPortal: {
      label: _t('بوابة الأبناء', 'Portal', 'Elternportal'),
      icon: ShieldCheck
    },
    payments: { 
      label: t('nav_payments') || (language === 'ar' ? 'المالية' : language === 'de' ? 'Zahlungen' : 'Payments'), 
      icon: Wallet, 
      badge: unreadDueCount > 0 ? unreadDueCount : null 
    },
    lernstudio: { 
      label: 'Lernstudio', 
      icon: Gamepad2 
    },
    hod: { 
      label: _t('القسم', 'HOD', 'Fachleiter'), 
      icon: Layers 
    },
    history: { 
      label: t('nav_history') || (language === 'ar' ? 'السجل' : language === 'de' ? 'Sitzungen' : 'History'), 
      icon: History 
    },
    reports: { 
      label: t('nav_reports') || (language === 'ar' ? 'التقارير' : language === 'de' ? 'Berichte' : 'Reports'), 
      icon: BarChart2 
    },
    certificates: { 
      label: t('nav_certificates') || (language === 'ar' ? 'الشهادات' : language === 'de' ? 'Zertifikate' : 'Certs'), 
      icon: Award 
    },
    freeTime: { 
      label: t('nav_free_time') || (language === 'ar' ? 'الفراغ' : language === 'de' ? 'Frei' : 'Free Time'), 
      icon: Clock 
    },
    schoolSchedule: { 
      label: _t('المدرسة', 'School', 'Schule'), 
      icon: BookOpen 
    },
    settings: { 
      label: t('nav_settings') || (language === 'ar' ? 'الإعدادات' : language === 'de' ? 'Einstellungen' : 'Settings'), 
      icon: Settings 
    }
  };

  // Derive left (first 3) and right (next 3) items from dynamic bottomNavOrder
  const leftTabIds = (bottomNavOrder || []).slice(0, 3);
  const rightTabIds = (bottomNavOrder || []).slice(3, 6);

  const leftTabs = leftTabIds.map(id => ({
    id,
    ...(allTabDefs[id] || { label: id, icon: Home })
  }));

  const rightTabs = rightTabIds.map(id => ({
    id,
    ...(allTabDefs[id] || { label: id, icon: Home })
  }));

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId as any);
    setShowQuickMenu(false);
  };

  return (
    <>
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
                }}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-linear-to-tr from-primary to-primary-hover hover:from-primary hover:to-primary-hover text-white flex items-center justify-center shadow-lg shadow-primary/40 dark:shadow-primary/30 ring-[3.5px] sm:ring-[4px] ring-white/50 dark:ring-white/20 backdrop-blur-md relative z-10 cursor-pointer focus:outline-none transition-transform duration-150 active:scale-90 ${
                  showQuickMenu ? 'rotate-45' : 'rotate-0'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent', WebkitBackdropFilter: 'blur(12px)' }}
                aria-label="Schnell-Eintrag / Quick Action"
                title="Schnelle Aktionen anzeigen"
              >
                <Plus className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.5]" />
              </button>

              {/* Quick Action Popover Menu */}
              <AnimatePresence>
                {showQuickMenu && (
                  <>
                    {/* Invisible click-away overlay */}
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
                            {t('quick_lesson_modal_title') || (language === 'ar' ? 'جدولة حصة سريعة' : language === 'de' ? 'Schnell-Eintrag' : 'Quick Lesson')}
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

                      {/* Reorder Bottom Nav Option right in the Quick Action popover */}
                      <button
                        onClick={() => {
                          setIsReorderBottomNavOpen(true);
                          setShowQuickMenu(false);
                        }}
                        className="w-full text-start flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer group border-t border-surface-border/60 pt-2"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <SlidersHorizontal className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-black text-text-main">
                            {_t('ترتيب القائمة السفلية', 'Reorder Bottom Bar', 'Leiste anordnen')}
                          </span>
                          <span className="block text-[10px] text-text-muted font-medium truncate">
                            {_t('تخصيص وترتيب صفحات الشريط', 'Customize bottom bar pages', 'Symbole der Leiste anpassen')}
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

      {/* Reorder Bottom Nav Modal */}
      <ReorderBottomNavModal 
        isOpen={isReorderBottomNavOpen} 
        onClose={() => setIsReorderBottomNavOpen(false)} 
      />
    </>
  );
};
