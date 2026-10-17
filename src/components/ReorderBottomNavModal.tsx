import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Home, Calendar, Users, Wallet, BarChart2, Settings, 
  History, Award, Clock, BookOpen, Layers, Gamepad2,
  SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, X, Check, Zap, ArrowUpToLine
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReorderBottomNavModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReorderBottomNavModal: React.FC<ReorderBottomNavModalProps> = ({ isOpen, onClose }) => {
  const { 
    bottomNavOrder, 
    setBottomNavOrder, 
    resetBottomNavOrder, 
    language, 
    _t, 
    t 
  } = useApp();

  const isRtl = language === 'ar' || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');

  const navItemDefs: Record<string, { label: string; icon: any; colorClass: string }> = {
    home: { 
      label: t('nav_home') || (language === 'ar' ? 'الرئيسية' : language === 'de' ? 'Startseite' : 'Home'), 
      icon: Home,
      colorClass: 'text-blue-500 bg-blue-500/10'
    },
    schedule: { 
      label: t('nav_schedule') || (language === 'ar' ? 'الجدول والمواعيد' : language === 'de' ? 'Termine & Kalender' : 'Schedule'), 
      icon: Calendar,
      colorClass: 'text-indigo-500 bg-indigo-500/10'
    },
    students: { 
      label: t('nav_students') || (language === 'ar' ? 'الطلاب والمجموعات' : language === 'de' ? 'Schüler & Gruppen' : 'Students'), 
      icon: Users,
      colorClass: 'text-emerald-500 bg-emerald-500/10'
    },
    payments: { 
      label: t('nav_payments') || (language === 'ar' ? 'المدفوعات والمالية' : language === 'de' ? 'Zahlungen & Finanzen' : 'Payments'), 
      icon: Wallet,
      colorClass: 'text-amber-500 bg-amber-500/10'
    },
    lernstudio: { 
      label: language === 'ar' ? 'استوديو التعلم (Lernstudio)' : language === 'de' ? 'Lernstudio' : 'Lernstudio', 
      icon: Gamepad2,
      colorClass: 'text-fuchsia-500 bg-fuchsia-500/10'
    },
    hod: { 
      label: language === 'ar' ? 'إدارة القسم (HOD)' : language === 'de' ? 'Fachleiter Hub' : 'HOD Hub', 
      icon: Layers,
      colorClass: 'text-cyan-500 bg-cyan-500/10'
    },
    history: { 
      label: t('nav_history') || (language === 'ar' ? 'سجل الحصص' : language === 'de' ? 'Sitzungshistorie' : 'Session History'), 
      icon: History,
      colorClass: 'text-purple-500 bg-purple-500/10'
    },
    reports: { 
      label: t('nav_reports') || (language === 'ar' ? 'التقارير والإحصائيات' : language === 'de' ? 'Berichte & Statistiken' : 'Reports & Stats'), 
      icon: BarChart2,
      colorClass: 'text-teal-500 bg-teal-500/10'
    },
    certificates: { 
      label: t('nav_certificates') || (language === 'ar' ? 'مركز الشهادات' : language === 'de' ? 'Zertifikate-Zentrum' : 'Certificates'), 
      icon: Award,
      colorClass: 'text-rose-500 bg-rose-500/10'
    },
    freeTime: { 
      label: t('nav_free_time') || (language === 'ar' ? 'أوقات الفراغ' : language === 'de' ? 'Freie Zeiten' : 'Free Time'), 
      icon: Clock,
      colorClass: 'text-orange-500 bg-orange-500/10'
    },
    schoolSchedule: { 
      label: language === 'ar' ? 'جدول المدرسة' : language === 'de' ? 'Stundenplan' : 'School Schedule', 
      icon: BookOpen,
      colorClass: 'text-sky-500 bg-sky-500/10'
    },
    settings: { 
      label: t('nav_settings') || (language === 'ar' ? 'الإعدادات' : language === 'de' ? 'Einstellungen' : 'Settings'), 
      icon: Settings,
      colorClass: 'text-slate-500 bg-slate-500/10'
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= bottomNavOrder.length) return;
    const updated = [...bottomNavOrder];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setBottomNavOrder(updated);
  };

  const moveToBar = (index: number) => {
    if (index < 6) return;
    // Move to position 5 (the last position in bottom bar)
    const updated = [...bottomNavOrder];
    const [item] = updated.splice(index, 1);
    updated.splice(5, 0, item);
    setBottomNavOrder(updated);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Invisible Click-away Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-transparent cursor-pointer"
          onClick={onClose}
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg bg-surface border-t sm:border border-surface-border rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-surface-border flex items-center justify-between shrink-0 bg-surface/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg text-text-main leading-snug">
                  {_t('ترتيب صفحات القائمة السفلية', 'Reorder Bottom Navigation', 'Untere Leiste anpassen')}
                </h3>
                <p className="text-[11px] sm:text-xs text-text-muted">
                  {_t(
                    'أول 6 صفحات تظهر مباشرة بالشريط السفلي المحمول',
                    'Top 6 pages appear directly on the mobile bottom bar',
                    'Die ersten 6 Seiten erscheinen in der unteren Leiste'
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mini Guide / Visual Bar Representation */}
          <div className="px-4 py-2.5 bg-primary/5 dark:bg-primary/10 border-b border-primary/10 flex items-center justify-between text-[11px] font-semibold text-primary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {_t('الصفحات 1 إلى 6 في الشريط', 'Pages 1-6 are active in bar', 'Seiten 1 bis 6 aktiv in Leiste')}
            </span>
            <span className="text-[10px] text-text-muted font-normal">
              {_t('3 قبل زر ⚡ و 3 بعده', '3 before ⚡ and 3 after', '3 vor ⚡ & 3 danach')}
            </span>
          </div>

          {/* List of items */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 overscroll-contain">
            {bottomNavOrder.map((id, index) => {
              const def = navItemDefs[id];
              if (!def) return null;
              const Icon = def.icon;
              const isInBottomBar = index < 6;
              const isFirstSection = index < 3;
              const isSecondSection = index >= 3 && index < 6;

              return (
                <React.Fragment key={id}>
                  {/* Visual Divider before Center FAB at index 3 */}
                  {index === 3 && (
                    <div className="my-2 py-1 px-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center gap-2 text-xs font-bold text-primary">
                      <Zap className="w-4 h-4 fill-primary" />
                      <span>{_t('زر الصاعقة السريع ⚡ (ثابت في المنتصف)', 'Quick Action FAB ⚡ (Center)', 'Schnell-Button ⚡ (Mitte)')}</span>
                    </div>
                  )}

                  {/* Visual Divider before Additional Pages at index 6 */}
                  {index === 6 && (
                    <div className="pt-3 pb-1.5 px-1 border-t border-dashed border-surface-border flex items-center justify-between">
                      <span className="text-xs font-black text-text-muted uppercase tracking-wider">
                        {_t('صفحات إضافية في القائمة الجانبية', 'Additional Pages (In Drawer)', 'Weitere Seiten (Im Seitenmenü)')}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {_t('انقل لأعلى لإظهارها في الشريط', 'Move up to display in bar', 'Nach oben schieben')}
                      </span>
                    </div>
                  )}

                  <div
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all ${
                      isInBottomBar
                        ? 'bg-surface border-surface-border shadow-xs'
                        : 'bg-surface-hover/40 border-surface-border/50 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Item Information */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      {/* Rank Index */}
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                          isInBottomBar
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface-border/80 text-text-muted'
                        }`}
                      >
                        {index + 1}
                      </span>

                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${def.colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Title & Badge */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-text-main truncate">
                            {def.label}
                          </span>
                        </div>
                        <span className="block text-[10px] text-text-muted truncate">
                          {isFirstSection
                            ? _t('الجانب الأول من الشريط', 'Left side of bottom bar', 'Linke Seite der Leiste')
                            : isSecondSection
                            ? _t('الجانب الثاني من الشريط', 'Right side of bottom bar', 'Rechte Seite der Leiste')
                            : _t('في القائمة الجانبية', 'In Android drawer menu', 'Im Hauptmenü')}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isInBottomBar && (
                        <button
                          onClick={() => moveToBar(index)}
                          className="p-1.5 px-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer mr-1 rtl:ml-1"
                          title={_t('إضافة للشريط السفلي', 'Add to Bottom Bar', 'Zur Leiste hinzufügen')}
                        >
                          <ArrowUpToLine className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{_t('للشريط', 'To Bar', 'Zur Leiste')}</span>
                        </button>
                      )}

                      <button
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        className="p-2 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-muted hover:text-text-main disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs active:scale-95"
                        aria-label="Move Up"
                        title={_t('تحريك لأعلى', 'Move Up', 'Nach oben')}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === bottomNavOrder.length - 1}
                        className="p-2 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-text-muted hover:text-text-main disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs active:scale-95"
                        aria-label="Move Down"
                        title={_t('تحريك لأسفل', 'Move Down', 'Nach unten')}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Footer Controls */}
          <div className="p-3 sm:p-4 border-t border-surface-border flex items-center justify-between gap-2 bg-surface/90 backdrop-blur-md shrink-0">
            <button
              onClick={resetBottomNavOrder}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{_t('استعادة الترتيب الافتراضي', 'Reset Default', 'Standard')}</span>
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{_t('حفظ وتم', 'Save & Done', 'Fertig')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
