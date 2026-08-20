import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AppLanguage } from '../types';
import { 
  Settings, Search, User, Globe, Moon, Sun, Clock, DollarSign, Check, Camera, CheckCircle2,
  HardDrive, Download, Upload, Trash2, AlertTriangle, MessageSquare, ChevronRight,
  ArrowLeft, ArrowRight, Calendar, ShieldAlert, ShieldCheck, Info, Copy, Save, Phone, ExternalLink,
  BookOpen, FileText, Bell, CheckSquare, XCircle, Award, Sparkles, Star, Plus, Pencil, RotateCcw, Heart,
  Target
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { NotificationSettingsSection } from './NotificationSettingsSection';
import { SmartBackupCenter } from './SmartBackupCenter';
import { DataHealthCenterModal } from './DataHealthCenterModal';
import { SchoolSettingsSection } from './SchoolSettingsSection';
import { DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { AvatarImage } from './AvatarImage';
import { getEffectiveSchoolEndForDay, formatTime } from '../utils/timeUtils';

type SettingsCategory = 
  | 'language'
  | 'notifications'
  | 'profile'
  | 'school'
  | 'payment'
  | 'messages'
  | 'inspiration'
  | 'backup'
  | 'about'
  | 'danger';

const DEFAULT_PARENT_TEMPLATES: Record<string, string> = {
  homework: 'السلام عليكم ورحمة الله وبركاته،\n\nنود إحاطتكم علماً بأن الطالب/ة {student_name} (مجموعة: {group_name}) قد استلم واجب الدرس الجديد بتاريخ {date}. يرجى المتابعة وحل الواجب قبل الحصة القادمة.\n\nمع تحيات: {teacher_name}',
  attendance: 'السلام عليكم ورحمة الله وبركاته،\n\nنفيدكم بحضور الطالب/ة {student_name} بحصة {group_name} اليوم {date}، وكان تفاعله ممتازاً مع الشرح.\n\nشكراً لمتابعتكم: {teacher_name}',
  absence: 'السلام عليكم ورحمة الله وبركاته،\n\nنود إحاطتكم بعدم حضور الطالب/ة {student_name} لحصة {group_name} المقررة اليوم {date}. يرجى التواصل معنا للتنسيق والاطمئنان.\n\nمع تحيات: {teacher_name}',
  payment: 'السلام عليكم ورحمة الله وبركاته،\n\nنود تذكيركم بموعد سداد الرسوم المستحقة للطالب/ة {student_name} عن حزمة دروس {group_name}.\nالمبلغ المطلوب: {amount}.\n\nشاكرين حسن تعاونكم: {teacher_name}',
  exam: 'السلام عليكم ورحمة الله وبركاته،\n\nنتيجة اختبار الطالب/ة {student_name} في مجموعة {group_name}:\nحصل على أداء ممتاز وتم تكريمه في الحصة.\n\nمع خالص التقدير: {teacher_name}',
  summary: 'السلام عليكم ورحمة الله وبركاته،\n\nملخص درس اليوم لمجموعة {group_name} ({date}):\nتم شرح أجزاء الهامة والتطبيق عليها، وأبدى الطلاب تفاعلاً طيباً.\n\nمع تحيات: {teacher_name}'
};

export const SettingsView: React.FC = () => {
  const { 
    profile, updateProfile, theme, toggleTheme, language, setLanguage, t, _t,
    exportBackupFile, importBackupFile, clearAllData,
    inspirationSettings, inspirationMessages, updateInspirationSettings,
    addInspirationMessage, updateInspirationMessage, deleteInspirationMessage,
    toggleFavoriteInspirationMessage, restoreDefaultInspirationMessages,
    checkAndTriggerInspirationReminder, accentColor, setAccentColor,
    notificationSettings
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Inspiration Messages UI States
  const [isManagingMessages, setIsManagingMessages] = useState(false);
  const [msgFilterSource, setMsgFilterSource] = useState<'all' | 'favorites'>('all');
  const [isAddMsgModalOpen, setIsAddMsgModalOpen] = useState(false);
  const [newMsgText, setNewMsgText] = useState('');
  const [editingMsg, setEditingMsg] = useState<{ id: string; text: string } | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [showRestoreDefaultsConfirm, setShowRestoreDefaultsConfirm] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Profile Form States
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [displayNameEn, setDisplayNameEn] = useState(profile.displayNameEn || profile.nameEn || '');
  const [displayNameAr, setDisplayNameAr] = useState(profile.displayNameAr || profile.nameAr || '');
  const [email, setEmail] = useState(profile.email || '');
  const [currency, setCurrency] = useState(profile.currency || 'EGP');
  const [weeklyWorkingHours, setWeeklyWorkingHours] = useState(profile.weeklyWorkingHours || {
    0: { isOff: true, startTime: '09:00', endTime: '21:00' },
    1: { isOff: false, startTime: '09:00', endTime: '21:00' },
    2: { isOff: false, startTime: '09:00', endTime: '21:00' },
    3: { isOff: false, startTime: '09:00', endTime: '21:00' },
    4: { isOff: false, startTime: '09:00', endTime: '21:00' },
    5: { isOff: false, startTime: '09:00', endTime: '21:00' },
    6: { isOff: false, startTime: '09:00', endTime: '21:00' },
  });

  // Payment Profile Fields
  const [phone, setPhone] = useState(profile.phone || '');
  const [instaPayId, setInstaPayId] = useState(profile.instaPayId || '');
  const [vodafoneCashNumber, setVodafoneCashNumber] = useState(profile.vodafoneCashNumber || '');
  const [bankAccount, setBankAccount] = useState(profile.bankAccount || '');
  const [paymentLink, setPaymentLink] = useState(profile.paymentLink || '');
  const [whatsappNumber, setWhatsappNumber] = useState(profile.whatsappNumber || '');

  // Financial Goals States
  const [weeklyIncomeGoal, setWeeklyIncomeGoal] = useState<string>(
    profile.weeklyIncomeGoal !== undefined && profile.weeklyIncomeGoal !== null && profile.weeklyIncomeGoal > 0
      ? String(profile.weeklyIncomeGoal)
      : ''
  );
  const [monthlyIncomeGoal, setMonthlyIncomeGoal] = useState<string>(
    profile.monthlyIncomeGoal !== undefined && profile.monthlyIncomeGoal !== null && profile.monthlyIncomeGoal > 0
      ? String(profile.monthlyIncomeGoal)
      : ''
  );

  // Reminder Settings
  const [enableLessonAlerts, setEnableLessonAlerts] = useState(profile.enableLessonAlerts ?? true);
  const [enableBrowserPush, setEnableBrowserPush] = useState(profile.enableBrowserPush ?? false);

  // Parent Message Templates State
  const [activeMessageTab, setActiveMessageTab] = useState<'homework' | 'attendance' | 'absence' | 'payment' | 'exam' | 'summary'>('homework');
  const [messageTemplates, setMessageTemplates] = useState<Record<string, string>>({
    ...DEFAULT_PARENT_TEMPLATES,
    ...(profile.parentMessageTemplates || {})
  });

  // UI Toast & Modal States
  const [copiedPaymentDetails, setCopiedPaymentDetails] = useState(false);
  const [copiedTemplateText, setCopiedTemplateText] = useState(false);
  const [savedSuccessToast, setSavedSuccessToast] = useState(false);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDataHealthCenterModal, setShowDataHealthCenterModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRtl = language === 'ar';

  // Helper for inline translations
  
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ChevronRight;

  const handleSharePaymentInfo = () => {
    const arabicSignature = displayNameAr?.trim() || displayName || 'المعلم';
    const text = `السلام عليكم ورحمة الله وبركاته\n\nبيانات التحويل والدفع:\n\n📱 رقم الهاتف:\n${phone || 'غير محدد'}\n\n💳 InstaPay:\n${instaPayId || 'غير محدد'}\n${vodafoneCashNumber ? `\n💸 فودافون كاش:\n${vodafoneCashNumber}\n` : ''}${bankAccount ? `\n🏦 الحساب البنكي:\n${bankAccount}\n` : ''}${paymentLink ? `\n🔗 رابط الدفع:\n${paymentLink}\n` : ''}${whatsappNumber ? `\n💬 واتساب:\n${whatsappNumber}\n` : ''}\nشكراً لحضراتكم.\n\nمع تحيات\nأ. ${arabicSignature}`;
    
    navigator.clipboard.writeText(text);
    setCopiedPaymentDetails(true);
    confetti({ particleCount: 50, spread: 50 });
    setTimeout(() => setCopiedPaymentDetails(false), 2500);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (content) {
          const success = await importBackupFile(content);
          if (success) {
            setRestoreStatusMsg(t('dataRefreshed'));
            confetti({ particleCount: 70, spread: 60 });
            setTimeout(() => setRestoreStatusMsg(null), 4000);
          } else {
            alert('JSON File invalid');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const triggerSaveToast = () => {
    setSavedSuccessToast(true);
    confetti({ particleCount: 50, spread: 40 });
    setTimeout(() => setSavedSuccessToast(false), 3000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ 
      displayName: displayName.trim() || 'Teacher', 
      displayNameEn: displayNameEn.trim(),
      displayNameAr: displayNameAr.trim(),
      nameEn: displayNameEn.trim(),
      nameAr: displayNameAr.trim(),
      email, 
      currency,
      weeklyWorkingHours
    });
    triggerSaveToast();
  };

  const handleSavePaymentInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ 
      phone,
      instaPayId,
      vodafoneCashNumber,
      bankAccount,
      paymentLink,
      whatsappNumber
    });
    triggerSaveToast();
  };

  const handleSaveMessageTemplates = () => {
    updateProfile({
      parentMessageTemplates: messageTemplates
    });
    triggerSaveToast();
  };

  const handleSaveCalendarSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      weeklyWorkingHours,
      enableLessonAlerts,
      enableBrowserPush
    });
    triggerSaveToast();
  };

  const handleSaveFinancialGoals = (e: React.FormEvent) => {
    e.preventDefault();
    const rawWeekly = weeklyIncomeGoal.trim();
    const rawMonthly = monthlyIncomeGoal.trim();
    const parsedWeekly = rawWeekly ? Math.max(0, parseFloat(rawWeekly)) : undefined;
    const parsedMonthly = rawMonthly ? Math.max(0, parseFloat(rawMonthly)) : undefined;

    updateProfile({
      weeklyIncomeGoal: parsedWeekly && !isNaN(parsedWeekly) && parsedWeekly > 0 ? parsedWeekly : undefined,
      monthlyIncomeGoal: parsedMonthly && !isNaN(parsedMonthly) && parsedMonthly > 0 ? parsedMonthly : undefined
    });
    triggerSaveToast();
  };


  const languagesList: { id: AppLanguage; label: string; flag: string }[] = [
    { id: 'ar', label: 'العربية', flag: '🇪🇬' },
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  ];

  const categoryCards = [
    {
      id: 'profile' as SettingsCategory,
      title: t('auto_profile_work_schedule'),
      description: t('auto_personal_information_contact'),
      icon: User,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: profile.displayName
    },
    {
      id: 'school' as SettingsCategory,
      title: _t('إعدادات المدرسة', 'School Settings', 'Schuleinstellungen'),
      description: _t('أوقات الحضور والانصراف وإعدادات الحصص اليومية المتسلسلة', 'Arrival, departure, and sequential school periods settings', 'Anwesenheit, Abfahrt und Einstellungen für tägliche Stunden'),
      icon: BookOpen,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: _t('المدرسة', 'School', 'Schule')
    },
    {
      id: 'payment' as SettingsCategory,
      title: t('auto_payments_finance'),
      description: t('auto_financial_information_transfe'),
      icon: DollarSign,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: phone || 'InstaPay'
    },
    {
      id: 'messages' as SettingsCategory,
      title: t('auto_messages_communication'),
      description: t('auto_automated_parent_communication'),
      icon: MessageSquare,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: t('auto_6_templates')
    },
    {
      id: 'notifications' as SettingsCategory,
      title: t('auto_notifications_alerts'),
      description: t('auto_reminders_lesson_alerts_dai'),
      icon: Bell,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: notificationSettings?.masterEnabled 
        ? (t('auto_active')) 
        : (t('auto_disabled'))
    },
    {
      id: 'language' as SettingsCategory,
      title: t('auto_appearance_language'),
      description: t('auto_personalize_the_interface_expe'),
      icon: Globe,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: languagesList.find(l => l.id === language)?.label
    },
    {
      id: 'inspiration' as SettingsCategory,
      title: t('auto_motivation_gratitude'),
      description: t('auto_daily_inspiration_and_positive'),
      icon: Sparkles,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: inspirationSettings.frequency === 'disabled' 
        ? (t('auto_disabled')) 
        : inspirationSettings.frequency === 'daily'
        ? (t('auto_daily'))
        : inspirationSettings.frequency === 'before_first_lesson'
        ? (t('auto_before_lesson'))
        : (t('auto_random'))
    },
    {
      id: 'backup' as SettingsCategory,
      title: t('auto_data_backup'),
      description: t('auto_backup_restore_and_data_manag'),
      icon: HardDrive,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: 'Backup & Reset'
    },
    {
      id: 'about' as SettingsCategory,
      title: t('auto_about'),
      description: t('auto_application_information_and_ve'),
      icon: Info,
      color: 'bg-primary/10 text-primary dark:text-primary border-primary-border dark:border-primary-border',
      badge: 'v2.5.0'
    }
  ];

  // Helper Header Component for Subpages
  const renderSubPageHeader = (title: string, subtitle?: string, icon?: React.ElementType) => {
    const IconComponent = icon;
    return (
      <div className="pb-2.5 mb-3.5 border-b border-surface-border/80 dark:border-surface-border">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className="lg:hidden p-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main hover:text-primary transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs border border-surface-border/60 active:scale-95"
            title={t('auto_back_to_settings')}
          >
            <BackIcon className="w-3.5 h-3.5" />
          </button>

          {IconComponent && (
            <div className="p-1.5 rounded-lg bg-primary-soft text-primary dark:text-primary border border-primary-border/50 shrink-0">
              <IconComponent className="w-4 h-4" />
            </div>
          )}

          <h2 className="text-sm sm:text-base font-black text-text-main truncate">
            {title}
          </h2>
        </div>

        {subtitle && (
          <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    );
  };

  const filteredCategories = categoryCards.filter(cat => 
    cat.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 pb-20 items-start">
      {/* Sidebar / List View */}
      <div className={`w-full lg:w-1/3 shrink-0 lg:sticky lg:top-16 space-y-2.5 ${activeCategory !== null ? 'hidden lg:block' : 'block'}`}>
        {/* Main Title Header */}
        <div>
          <h2 className="text-lg font-black text-text-main flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>{t('settings_title')}</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t('auto_select_a_section_to_manage_app')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={t('auto_search_settings')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Categories List */}
        <div className="space-y-1.5">
          {filteredCategories.map((cat) => {
            const IconComponent = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full bg-surface border rounded-lg p-2 sm:p-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-start group ${
                  isActive 
                    ? 'border-primary dark:border-primary bg-primary/5' 
                    : 'border-surface-border/90 dark:border-surface-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1.5">
                  <div className={`p-1.5 rounded-md border shrink-0 ${cat.color} ${isActive ? 'ring-1 ring-primary/30' : ''}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs font-bold truncate transition-colors ${isActive ? 'text-primary' : 'text-text-main group-hover:text-primary'}`}>
                      {cat.title}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{cat.description}</p>
                  </div>
                </div>
                <div className={`p-1 transition-all shrink-0 ${isActive ? 'text-primary translate-x-0.5' : 'text-text-muted/50 group-hover:text-primary group-hover:translate-x-0.5'}`}>
                  <ForwardIcon className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
          {filteredCategories.length === 0 && (
            <div className="text-center py-4 text-slate-500 text-xs">
               {t('auto_no_results_found')}
            </div>
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className={`w-full lg:w-2/3 ${activeCategory === null ? 'hidden lg:block' : 'block'}`}>
        {activeCategory === null ? (
          <div className="hidden lg:flex flex-col items-center justify-center h-[50vh] bg-surface rounded-xl border border-surface-border text-center p-6 animate-fade-in shadow-2xs">
            <Settings className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" />
            <h3 className="text-base font-black text-slate-400 dark:text-slate-500">
               {t('auto_select_a_category')}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
               {t('auto_choose_a_category_from_the_sid')}
            </p>
          </div>
        ) : (
          <div className="animate-fade-in bg-surface rounded-xl border border-surface-border shadow-2xs p-3.5 sm:p-4 min-h-[50vh]">
            {/* ==========================================
                SUBPAGE: APPEARANCE & LANGUAGE
            ========================================== */}
            {activeCategory === 'language' && (
              <div className="space-y-3.5 animate-scale-up">
                {renderSubPageHeader(
                  t('auto_appearance_language'),
                  t('auto_personalize_the_interface_expe'),
                  Globe
                )}
                {/* Interface Language Card */}
          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                <span>{t('settings_language')}</span>
              </h3>
            </div>

            <p className="text-[11px] text-text-muted">
              {t('settings_lang_desc')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {languagesList.map((langItem) => {
                const isSelected = language === langItem.id;
                return (
                  <button
                    key={langItem.id}
                    type="button"
                    onClick={() => {
                      if (language !== langItem.id) {
                        setLanguage(langItem.id);
                        confetti({ particleCount: 30, spread: 40 });
                      }
                    }}
                    className={`p-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-primary text-white border-primary-border shadow-2xs'
                        : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="text-sm">{langItem.flag}</span>
                    <span>{langItem.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>

            {/* Language Note Banner */}
            <div className="p-2.5 bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg flex items-start gap-2 text-primary dark:text-primary text-[11px]">
              <MessageSquare className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0 mt-0.5" />
              <span>
                {t('auto_note_the_selected_language_ap')}
              </span>
            </div>
          </div>

          {/* Theme Section */}
          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-primary" /> : <Sun className="w-3.5 h-3.5 text-primary" />}
                <span>{t('settings_theme')}</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => theme !== 'light' && toggleTheme()}
                className={`p-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  theme === 'light'
                    ? 'bg-primary text-white border-primary-border shadow-2xs'
                    : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>{t('settings_theme_light')}</span>
              </button>

              <button
                type="button"
                onClick={() => theme !== 'dark' && toggleTheme()}
                className={`p-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  theme === 'dark'
                    ? 'bg-primary text-white border-primary-border shadow-2xs'
                    : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>{t('settings_theme_dark')}</span>
              </button>
            </div>
          </div>

          {/* Accent Color Section */}
          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>
                  {t('auto_accent_color')}
                </span>
              </h3>
            </div>

            <p className="text-[11px] text-text-muted">
              {t('auto_select_your_preferred_accent_c')}
            </p>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-1 pb-1">
              {[
                { id: 'blue' as const, hex: '#3b82f6', color: 'blue' },
                { id: 'darkblue' as const, hex: '#1e40af', color: 'darkblue' },
                { id: 'indigo' as const, hex: '#6366f1', color: 'indigo' },
                { id: 'violet' as const, hex: '#8b5cf6', color: 'violet' },
                { id: 'purple' as const, hex: '#a855f7', color: 'purple' },
                { id: 'fuchsia' as const, hex: '#d946ef', color: 'fuchsia' },
                { id: 'rose' as const, hex: '#f43f5e', color: 'rose' },
                { id: 'red' as const, hex: '#ef4444', color: 'red' },
                { id: 'orange' as const, hex: '#f97316', color: 'orange' },
                { id: 'amber' as const, hex: '#f59e0b', color: 'amber' },
                { id: 'green' as const, hex: '#22c55e', color: 'green' },
                { id: 'emerald' as const, hex: '#10b981', color: 'emerald' },
                { id: 'lime' as const, hex: '#84cc16', color: 'lime' },
                { id: 'pink' as const, hex: '#ec4899', color: 'pink' },
                { id: 'teal' as const, hex: '#14b8a6', color: 'teal' },
                { id: 'cyan' as const, hex: '#06b6d4', color: 'cyan' },
                { id: 'slate' as const, hex: '#64748b', color: 'slate' },
              ].map((item) => {
                const isSelected = accentColor === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (accentColor !== item.id) {
                        setAccentColor(item.id);
                        confetti({ particleCount: 30, spread: 40 });
                      }
                    }}
                    className="flex flex-col items-center gap-1 focus:outline-none group cursor-pointer"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md relative transition-all duration-200 transform group-hover:scale-110 active:scale-95 ${
                        isSelected 
                          ? 'ring-2 ring-offset-2 ring-offset-surface scale-105' 
                          : 'opacity-80 hover:opacity-100 border border-white/20'
                      }`}
                      style={{ backgroundColor: item.hex, ...(isSelected ? { "--tw-ring-color": item.hex } : {}) } as React.CSSProperties}
                    >
                      {isSelected && (
                        <Check className="w-4 h-4 text-white stroke-[3.5px] drop-shadow-2xs animate-scale-up" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Accent Preview */}
            <div className="mt-2.5 p-3 rounded-xl border border-primary-border/60 bg-primary-soft/30 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none" />
              <h4 className="text-[9.5px] uppercase font-bold text-text-muted relative z-10">{t('settings_live_preview')}</h4>
              <div className="flex gap-2 relative z-10">
                <button className="flex-1 bg-primary text-white py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95">
                  {t('settings_primary_button')}
                </button>
                <button className="flex-1 bg-primary-soft text-primary py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-primary/20 active:scale-95">
                  {t('settings_secondary_button')}
                </button>
              </div>
              <div className="flex items-center gap-2.5 p-2 bg-surface rounded-lg border border-surface-border relative z-10 shadow-2xs">
                <div className="p-1.5 bg-primary-soft rounded-md text-primary shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-main truncate">{t('settings_premium_widget')}</p>
                  <p className="text-[10px] text-text-muted truncate">{t('settings_adapts_accent')}</p>
                </div>
                <div className="ml-auto shrink-0">
                   <div className="w-7 h-3.5 rounded-full bg-primary relative cursor-pointer">
                     <div className="absolute right-0.5 top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-2xs"></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SUBPAGE 2: TEACHER PROFILE
      ========================================== */}
      {activeCategory === 'profile' && (
        <div className="space-y-3.5 animate-scale-up">
          {renderSubPageHeader(
            t('auto_teacher_profile'),
            t('auto_manage_personal_details_worki'),
            User
          )}

          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3">
            {/* Avatar Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-surface-border">
              <div className="relative shrink-0">
                <AvatarImage
                  name={profile.displayName}
                  className="w-12 h-12 rounded-lg font-black text-lg ring-2 ring-primary/30 shadow-2xs"
                />
              </div>

              <div className="space-y-0.5 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-extrabold text-text-main truncate" title={displayName || t('settings_name')}>
                  {displayName || t('settings_name')}
                </p>
                <p className="text-[11px] text-slate-500 font-mono truncate" title={email || '-'}>
                  {email || '-'}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[10px] font-bold text-text-muted bg-surface-hover px-2 py-0.5 rounded">
                    {t('settings_currency')}: {currency}
                  </span>
                </div>
              </div>

              {/* Profile Display / Edit Toggle */}
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="text-xs font-bold px-3 py-1.5 bg-primary-soft text-primary rounded-lg hover:bg-primary-soft dark:bg-primary-soft/30 dark:text-primary dark:hover:bg-primary-soft transition-colors active:scale-95"
              >
                {isEditingProfile ? (t('auto_cancel')) : (t('auto_edit_profile'))}
              </button>
            </div>
            
            {/* Profile Form */}
            <form onSubmit={(e) => { handleSaveProfile(e); setIsEditingProfile(false); }} className="space-y-3">
              <fieldset disabled={!isEditingProfile} className={!isEditingProfile ? 'opacity-70 pointer-events-none' : ''}>
              
              {/* Dual Names Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-hover/50 border border-surface-border/60 rounded-xl">
                {/* English / Latin Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>{isRtl ? 'اسم المعلم بالإنجليزية / الألمانية' : 'Teacher English / German Name'}</span>
                    </label>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {isRtl ? '📜 للشهادات' : '📜 For Certificates'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={displayNameEn}
                    onChange={(e) => setDisplayNameEn(e.target.value)}
                    placeholder={isRtl ? 'مثال: Herr Omar Hassan أو Omar Hassan' : 'e.g. Herr Omar Hassan or Omar Hassan'}
                    className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                  />
                  <p className="text-[10px] text-text-muted">
                    {isRtl ? 'يظهر هذا الاسم تلقائياً في الشهادات والتكريمات الرسمية' : 'This name is automatically used in student certificates and diplomas'}
                  </p>
                </div>

                {/* Arabic Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{isRtl ? 'اسم المعلم بالعربية' : 'Teacher Arabic Name'}</span>
                    </label>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {isRtl ? '📊 للتقارير والواتساب' : '📊 For Reports & WhatsApp'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={displayNameAr}
                    onChange={(e) => setDisplayNameAr(e.target.value)}
                    placeholder={isRtl ? 'مثال: أ. عمر حسن أو عمر حسن' : 'e.g. أ. عمر حسن'}
                    className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                    dir="rtl"
                  />
                  <p className="text-[10px] text-text-muted">
                    {isRtl ? 'يظهر هذا الاسم في تقارير الحصص لأولياء الأمور ورسائل السداد' : 'Used in parent reports, WhatsApp summaries, and payment reminders'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main">{isRtl ? 'اسم العرض العام' : t('settings_name')} *</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main">{t('settings_email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main">{t('settings_currency')}</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-bold focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="EGP">EGP (ج.م)</option>
                    <option value="€">EUR (€)</option>
                    <option value="$">USD ($)</option>
                    <option value="SAR">SAR (ر.س)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
              </div>

              {savedSuccessToast && (
                <div className="bg-primary text-white text-xs font-bold p-2.5 rounded-lg flex items-center justify-center gap-2 animate-scale-up mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('settings_save_success')}</span>
                </div>
              )}

              {isEditingProfile && (
                <button
                  type="submit"
                  className="w-full mt-2 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-black text-xs py-2 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('save')}</span>
                </button>
              )}
              </fieldset>
            </form>
          </div>

          {/* 🎯 Financial Goals Section */}
          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary-soft text-primary dark:text-primary border border-primary-border">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-text-main uppercase tracking-wider flex items-center gap-1.5">
                    <span>{t('financial_goals')}</span>
                  </h3>
                  <p className="text-[10px] text-text-muted font-medium">
                    {t('financial_goals_desc')}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveFinancialGoals} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Weekly Income Goal */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main flex items-center justify-between">
                    <span>{t('weekly_income_goal')}</span>
                    <span className="text-[10px] text-text-muted font-mono font-bold px-1.5 py-0.5 rounded bg-surface-hover border border-surface-border">
                      {currency}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={weeklyIncomeGoal}
                      onChange={(e) => setWeeklyIncomeGoal(e.target.value)}
                      placeholder={t('no_goal_set')}
                      className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none font-mono"
                    />
                    {weeklyIncomeGoal ? (
                      <button
                        type="button"
                        onClick={() => setWeeklyIncomeGoal('')}
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-[10px] font-bold px-1 py-0.5 rounded bg-surface border border-surface-border/50"
                        title="Clear"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Monthly Income Goal */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main flex items-center justify-between">
                    <span>{t('monthly_income_goal')}</span>
                    <span className="text-[10px] text-text-muted font-mono font-bold px-1.5 py-0.5 rounded bg-surface-hover border border-surface-border">
                      {currency}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={monthlyIncomeGoal}
                      onChange={(e) => setMonthlyIncomeGoal(e.target.value)}
                      placeholder={t('no_goal_set')}
                      className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none font-mono"
                    />
                    {monthlyIncomeGoal ? (
                      <button
                        type="button"
                        onClick={() => setMonthlyIncomeGoal('')}
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-[10px] font-bold px-1 py-0.5 rounded bg-surface border border-surface-border/50"
                        title="Clear"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-black text-xs py-2 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('save')}</span>
              </button>
            </form>
          </div>

          {/* Working Days & Working Hours Form */}
          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{t('settings_working_hours')}</span>
            </h3>

            <form onSubmit={handleSaveCalendarSettings} className="space-y-3">
              {/* Weekly Working Hours Configuration */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-main">
                  {t('auto_weekly_working_hours')}
                </label>
                <div className="flex flex-col gap-1.5">
                  {[
                    { num: 6, label: t('auto_sat') },
                    { num: 0, label: t('auto_sun') },
                    { num: 1, label: t('auto_mon') },
                    { num: 2, label: t('auto_tue') },
                    { num: 3, label: t('auto_wed') },
                    { num: 4, label: t('auto_thu') },
                    { num: 5, label: t('auto_fri') },
                  ].map(day => {
                    const dNum = day.num as keyof typeof weeklyWorkingHours;
                    const hours = weeklyWorkingHours[dNum];
                    const schoolEndMinutes = getEffectiveSchoolEndForDay(day.num, profile);
                    const hasSchoolSchedule = schoolEndMinutes > 0;
                    const schoolEndTimeStr = hasSchoolSchedule ? formatTime(schoolEndMinutes) : '';

                    return (
                      <div key={day.num} className={`flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-lg border ${hours.isOff ? 'bg-surface-hover border-surface-border opacity-60' : 'bg-surface border-primary-border/40'}`}>
                        <div className="flex items-center gap-2 min-w-[70px]">
                          <input 
                            type="checkbox" 
                            checked={!hours.isOff} 
                            onChange={(e) => setWeeklyWorkingHours(prev => ({ ...prev, [dNum]: { ...prev[dNum], isOff: !e.target.checked } }))} 
                            className="w-3.5 h-3.5 rounded text-primary"
                          />
                          <span className="text-xs font-bold text-text-main">{day.label}</span>
                        </div>
                        
                        {!hours.isOff ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {hasSchoolSchedule ? (
                              <div className="flex items-center gap-1 bg-primary-soft/60 border border-primary-border/40 px-2 py-0.5 rounded text-xs font-bold text-primary" title={language === 'ar' ? 'يبدأ وقت الفراغ تلقائياً بعد نهاية اليوم الدراسي' : 'Free time automatically starts after school ends'}>
                                <BookOpen className="w-3 h-3" />
                                <span className="font-mono text-[11px]">{schoolEndTimeStr}</span>
                                <span className="text-[9px] text-text-muted">({language === 'ar' ? 'نهاية المدرسة' : language === 'de' ? 'Schulende' : 'School End'})</span>
                              </div>
                            ) : (
                              <input
                                type="time"
                                value={hours.startTime}
                                onChange={(e) => setWeeklyWorkingHours(prev => ({ ...prev, [dNum]: { ...prev[dNum], startTime: e.target.value } }))}
                                className="px-1.5 py-1 bg-surface-hover border border-surface-border rounded text-xs font-mono font-bold"
                              />
                            )}
                            <span className="text-text-muted text-[10px]">→</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={hours.endTime}
                                onChange={(e) => setWeeklyWorkingHours(prev => ({ ...prev, [dNum]: { ...prev[dNum], endTime: e.target.value } }))}
                                className="px-1.5 py-1 bg-surface-hover border border-surface-border rounded text-xs font-mono font-bold focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-[9px] text-text-muted font-bold">({language === 'ar' ? 'نهاية الفراغ' : language === 'de' ? 'Ende' : 'Free End'})</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-surface-hover px-2 py-0.5 rounded">Off</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reminder Settings */}
              <div className="p-2.5 bg-primary-soft dark:bg-primary-soft/40 border border-primary-border/60 dark:border-primary-border/60 rounded-lg space-y-1.5">
                <h4 className="text-xs font-bold text-primary-hover dark:text-primary/70 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span>{t('auto_reminder_settings')}</span>
                </h4>

                <label className="flex items-center justify-between p-1.5 bg-surface rounded-lg cursor-pointer text-xs font-semibold">
                  <span>{t('auto_in_app_lesson_alerts_within_3')}</span>
                  <input 
                    type="checkbox" 
                    checked={enableLessonAlerts} 
                    onChange={(e) => setEnableLessonAlerts(e.target.checked)} 
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                </label>

                <label className="flex items-center justify-between p-1.5 bg-surface rounded-lg cursor-pointer text-xs font-semibold">
                  <span>{t('auto_browser_push_notifications')}</span>
                  <input 
                    type="checkbox" 
                    checked={enableBrowserPush} 
                    onChange={(e) => setEnableBrowserPush(e.target.checked)} 
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                </label>
              </div>

              {savedSuccessToast && (
                <div className="bg-primary text-white text-xs font-bold p-2.5 rounded-lg flex items-center justify-center gap-2 animate-scale-up">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('settings_save_success')}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('save')}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          SUBPAGE: SCHOOL SETTINGS
      ========================================== */}
      {activeCategory === 'school' && (
        <div className="space-y-3.5 animate-scale-up">
          <SchoolSettingsSection onBack={() => setActiveCategory(null)} />
        </div>
      )}

      {/* ==========================================
          SUBPAGE: NOTIFICATIONS & ALERTS
      ========================================== */}
      {activeCategory === 'notifications' && (
        <div className="space-y-3.5 animate-scale-up">
          <NotificationSettingsSection onBack={() => setActiveCategory(null)} />
        </div>
      )}

      {/* ==========================================
          SUBPAGE 3: PAYMENT INFORMATION
      ========================================== */}
      {activeCategory === 'payment' && (
        <div className="space-y-3.5 animate-scale-up">
          {renderSubPageHeader(
            t('auto_payment_information'),
            t('auto_information_used_when_sending'),
            DollarSign
          )}

          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3">
            <div className="p-2.5 bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary dark:text-primary">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
                <span>{t('auto_direct_electronic_payment_prof')}</span>
              </div>

              <button
                type="button"
                onClick={handleSharePaymentInfo}
                className="bg-primary hover:bg-primary-hover text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                {copiedPaymentDetails ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPaymentDetails ? t('copied') : (t('auto_copy_payment_info'))}</span>
              </button>
            </div>

            <form onSubmit={handleSavePaymentInfo} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-text-main text-xs">{t('settings_phone')}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-text-main text-xs">{t('settings_instapay')}</label>
                  <input
                    type="text"
                    value={instaPayId}
                    onChange={(e) => setInstaPayId(e.target.value)}
                    placeholder="name@instapay"
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-text-main text-xs">{t('settings_vodafone')}</label>
                  <input
                    type="text"
                    value={vodafoneCashNumber}
                    onChange={(e) => setVodafoneCashNumber(e.target.value)}
                    placeholder="01012345678"
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-text-main text-xs">{t('settings_bank')}</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="EG1234567890..."
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-text-main text-xs">{t('settings_payment_link')}</label>
                  <input
                    type="text"
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    placeholder="https://pay.link/..."
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-text-main text-xs">WhatsApp</label>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+201012345678"
                    className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {savedSuccessToast && (
                <div className="bg-primary text-white text-xs font-bold p-2.5 rounded-lg flex items-center justify-center gap-2 animate-scale-up">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('settings_save_success')}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSharePaymentInfo}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('auto_copy_payment_info')}</span>
                </button>

                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          SUBPAGE 4: PARENT MESSAGES TEMPLATES
      ========================================== */}
      {activeCategory === 'messages' && (
        <div className="space-y-3.5 animate-scale-up">
          {renderSubPageHeader(
            t('auto_parent_message_templates'),
            t('auto_manage_templates_for_homework'),
            MessageSquare
          )}

          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3">
            {/* Template Categories Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'homework', label: t('auto_homework'), icon: BookOpen },
                { id: 'attendance', label: t('auto_attendance'), icon: CheckSquare },
                { id: 'absence', label: t('auto_absence'), icon: XCircle },
                { id: 'payment', label: t('auto_payments'), icon: DollarSign },
                { id: 'exam', label: t('auto_exam_reports'), icon: Award },
                { id: 'summary', label: t('auto_lesson_summary'), icon: FileText },
              ].map(tab => {
                const TabIcon = tab.icon;
                const isSelected = activeMessageTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveMessageTab(tab.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white shadow-2xs'
                        : 'bg-surface-hover text-text-main hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Template Editor */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-surface-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-primary dark:text-primary flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {t('auto_message_template_text_arabic')}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(messageTemplates[activeMessageTab] || '');
                    setCopiedTemplateText(true);
                    setTimeout(() => setCopiedTemplateText(false), 2000);
                  }}
                  className="px-2 py-0.5 bg-surface-hover hover:bg-slate-200 text-text-main text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copiedTemplateText ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTemplateText ? t('copied') : (t('auto_copy_text'))}</span>
                </button>
              </div>

              <textarea
                rows={5}
                value={messageTemplates[activeMessageTab] || ''}
                onChange={(e) => setMessageTemplates(prev => ({ ...prev, [activeMessageTab]: e.target.value }))}
                className="w-full p-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-semibold leading-relaxed focus:ring-1 focus:ring-primary outline-none font-sans"
                dir="rtl"
              />

              {/* Dynamic Variables Legend */}
              <div className="p-2.5 bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg text-[10px] text-primary dark:text-primary space-y-1">
                <p className="font-bold">{t('auto_available_dynamic_placeholders')}</p>
                <div className="flex flex-wrap gap-1 font-mono text-[9.5px] pt-0.5">
                  <span className="bg-surface px-1.5 py-0.5 rounded border border-primary-border dark:border-primary-border font-bold">{'{student_name}'}</span>
                  <span className="bg-surface px-1.5 py-0.5 rounded border border-primary-border dark:border-primary-border font-bold">{'{group_name}'}</span>
                  <span className="bg-surface px-1.5 py-0.5 rounded border border-primary-border dark:border-primary-border font-bold">{'{date}'}</span>
                  <span className="bg-surface px-1.5 py-0.5 rounded border border-primary-border dark:border-primary-border font-bold">{'{amount}'}</span>
                  <span className="bg-surface px-1.5 py-0.5 rounded border border-primary-border dark:border-primary-border font-bold">{'{teacher_name}'}</span>
                </div>
              </div>

              {savedSuccessToast && (
                <div className="bg-primary text-white text-xs font-bold p-2 rounded-lg flex items-center justify-center gap-2 animate-scale-up">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('settings_save_success')}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMessageTemplates(prev => ({ ...prev, [activeMessageTab]: DEFAULT_PARENT_TEMPLATES[activeMessageTab] }))}
                  className="px-3 py-2 bg-surface-hover hover:bg-slate-200 text-text-main font-bold text-xs rounded-lg transition-all cursor-pointer"
                >
                  {t('auto_reset_to_default')}
                </button>

                <button
                  type="button"
                  onClick={handleSaveMessageTemplates}
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('auto_save_templates')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SUBPAGE 7: INSPIRATION & GRATITUDE
      ========================================== */}
      {activeCategory === 'inspiration' && (
        <div className="space-y-3.5 animate-scale-up">
          {renderSubPageHeader(
            t('auto_inspiration_gratitude'),
            t('auto_teacher_reminders_motivation'),
            Sparkles
          )}

          {!isManagingMessages ? (
            <div className="space-y-3">
              <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>{t('auto_display_settings')}</span>
                  </h3>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-text-main mb-1">
                      {t('auto_frequency')}
                    </label>
                    <select
                      value={inspirationSettings.frequency}
                      onChange={(e) => updateInspirationSettings({ frequency: e.target.value as any })}
                      className="w-full p-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg focus:ring-1 focus:ring-primary font-medium text-xs transition-all"
                    >
                      <option value="disabled">{t('auto_disabled')}</option>
                      <option value="daily">{t('auto_once_daily')}</option>
                      <option value="before_first_lesson">{t('auto_before_first_lesson')}</option>
                      <option value="random_daily">{t('auto_randomly_during_day')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-main mb-1">
                      {t('auto_display_method')}
                    </label>
                    <select
                      value={inspirationSettings.displayMethod}
                      onChange={(e) => updateInspirationSettings({ displayMethod: e.target.value as any })}
                      className="w-full p-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg focus:ring-1 focus:ring-primary font-medium text-xs transition-all"
                      disabled={inspirationSettings.frequency === 'disabled'}
                    >
                      <option value="in_app">{t('auto_in_app_only_card')}</option>
                      <option value="notification">{t('auto_system_notification_only')}</option>
                      <option value="both">{t('auto_in_app_notification')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-main mb-1">
                      {t('auto_message_source')}
                    </label>
                    <select
                      value={inspirationSettings.source}
                      onChange={(e) => updateInspirationSettings({ source: e.target.value as any })}
                      className="w-full p-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg focus:ring-1 focus:ring-primary font-medium text-xs transition-all"
                      disabled={inspirationSettings.frequency === 'disabled'}
                    >
                      <option value="all">{t('auto_all_messages')}</option>
                      <option value="favorites_only">{t('auto_favorites_only')}</option>
                    </select>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => checkAndTriggerInspirationReminder('manual')}
                  className="w-full p-2 bg-primary-soft text-primary font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-primary-soft/80 border border-primary-border/60 transition-colors cursor-pointer text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{t('auto_test_reminder_now')}</span>
                </button>
              </div>

              <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary dark:text-primary" />
                    <span>{t('auto_messages')}</span>
                  </h3>
                  <div className="text-[10px] font-bold bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary px-2 py-0.5 rounded">
                    {inspirationMessages.length} {t('auto_messages')}
                  </div>
                </div>

                <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                  {t('auto_manage_the_motivational_quotes')}
                </p>

                <button
                  onClick={() => setIsManagingMessages(true)}
                  className="w-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{t('auto_manage_messages')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  onClick={() => {
                    setIsManagingMessages(false);
                    setEditingMsg(null);
                    setDeletingMsgId(null);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('auto_back')}</span>
                </button>
                <div className="flex gap-1 bg-surface-hover p-0.5 rounded-lg">
                  <button
                    onClick={() => setMsgFilterSource('all')}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${msgFilterSource === 'all' ? 'bg-surface dark:bg-slate-700 shadow-2xs text-primary dark:text-primary' : 'text-slate-500'}`}
                  >
                    {t('auto_all')}
                  </button>
                  <button
                    onClick={() => setMsgFilterSource('favorites')}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-colors flex items-center gap-1 ${msgFilterSource === 'favorites' ? 'bg-surface dark:bg-slate-700 shadow-2xs text-primary dark:text-primary' : 'text-slate-500'}`}
                  >
                    <Star className={`w-2.5 h-2.5 ${msgFilterSource === 'favorites' ? 'fill-current' : ''}`} />
                    {t('auto_favorites')}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-1.5">
                <button
                  onClick={() => {
                    setEditingMsg(null);
                    setNewMsgText('');
                    setIsAddMsgModalOpen(true);
                  }}
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('auto_add_message')}</span>
                </button>
                
                <button
                  onClick={() => setShowRestoreDefaultsConfirm(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title={t('auto_restore_default_messages')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Message List */}
              <div className="space-y-1.5 mt-2 max-h-[50vh] overflow-y-auto pr-1 pb-2">
                {inspirationMessages
                  .filter(m => msgFilterSource === 'all' || m.isFavorite)
                  .map(msg => (
                  <div key={msg.id} className="p-2.5 bg-surface-hover/50 border border-surface-border/60 dark:border-surface-border-soft rounded-lg flex flex-col gap-2">
                    <p className={`text-xs font-semibold text-slate-800 dark:text-slate-200 ${language === 'ar' ? 'dir-rtl text-right' : 'text-left'}`}>
                      {msg.text}
                    </p>
                    <div className="flex items-center justify-between pt-1.5 border-t border-surface-border dark:border-surface-border-soft">
                      <div className="flex items-center gap-1.5">
                        {msg.isCustom && (
                          <span className="text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary">
                            {t('auto_custom')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => toggleFavoriteInspirationMessage(msg.id)}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${msg.isFavorite ? 'text-primary bg-primary-soft dark:bg-primary-soft' : 'text-text-muted/70 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                          <Star className={`w-3.5 h-3.5 ${msg.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingMsg({ id: msg.id, text: msg.text });
                            setIsAddMsgModalOpen(true);
                          }}
                          className="p-1 rounded-md text-text-muted/70 hover:text-primary hover:bg-primary-soft dark:hover:bg-primary-soft transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingMsgId(msg.id)}
                          className="p-1 rounded-md text-text-muted/70 hover:text-primary hover:bg-primary-soft dark:hover:bg-primary-soft transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Delete Confirmation Inline */}
                    {deletingMsgId === msg.id && (
                      <div className="mt-1.5 p-2 bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg flex items-center justify-between animate-in slide-in-from-top-2">
                        <span className="text-[11px] font-bold text-primary dark:text-primary">
                          {t('auto_are_you_sure')}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setDeletingMsgId(null)}
                            className="px-2 py-1 text-[11px] font-bold text-text-muted hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                          >
                            {t('auto_cancel')}
                          </button>
                          <button
                            onClick={() => {
                              deleteInspirationMessage(msg.id);
                              setDeletingMsgId(null);
                            }}
                            className="px-2 py-1 text-[11px] font-bold text-white bg-primary hover:bg-primary-hover rounded transition-colors"
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {inspirationMessages.filter(m => msgFilterSource === 'all' || m.isFavorite).length === 0 && (
                  <div className="text-center py-4 text-text-muted/70">
                    <Heart className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
                    <p className="text-xs">{t('auto_no_messages_found')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message Edit/Add Modal */}
      {isAddMsgModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in p-0 sm:p-4 pb-0">
          <div className="bg-surface rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-sm shadow-xl p-5 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
            <h3 className="text-sm font-black text-text-main">
              {editingMsg 
                ? (t('auto_edit_message'))
                : (t('auto_add_new_message'))}
            </h3>
            <textarea
              value={editingMsg ? editingMsg.text : newMsgText}
              onChange={(e) => editingMsg ? setEditingMsg({ ...editingMsg, text: e.target.value }) : setNewMsgText(e.target.value)}
              placeholder={t('auto_write_your_message')}
              className="w-full p-3 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl focus:ring-2 focus:ring-primary font-medium text-sm min-h-[100px] resize-none"
              dir="auto"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsAddMsgModalOpen(false);
                  setEditingMsg(null);
                  setNewMsgText('');
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
              >
                {t('auto_cancel')}
              </button>
              <button
                onClick={() => {
                  if (editingMsg && editingMsg.text.trim()) {
                    updateInspirationMessage(editingMsg.id, editingMsg.text);
                  } else if (!editingMsg && newMsgText.trim()) {
                    addInspirationMessage(newMsgText);
                  }
                  setIsAddMsgModalOpen(false);
                  setEditingMsg(null);
                  setNewMsgText('');
                }}
                disabled={editingMsg ? !editingMsg.text.trim() : !newMsgText.trim()}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Defaults Confirm Modal */}
      {showRestoreDefaultsConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in p-0 sm:p-4 pb-0">
          <div className="bg-surface rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-sm shadow-xl p-5 space-y-4 animate-in zoom-in-95">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
            <div className="w-12 h-12 bg-primary-soft dark:bg-primary-soft text-primary rounded-lg flex items-center justify-center mb-2 mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-black text-text-main mb-2">
                {t('auto_restore_defaults')}
              </h3>
              <p className="text-xs text-text-muted">
                {t('auto_default_messages_will_be_resto')}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowRestoreDefaultsConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
              >
                {t('auto_cancel')}
              </button>
              <button
                onClick={() => {
                  restoreDefaultInspirationMessages();
                  setShowRestoreDefaultsConfirm(false);
                }}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs transition-colors"
              >
                {t('auto_restore')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SUBPAGE 6: DATA & BACKUP (INCLUDES DANGER ZONE)
      ========================================== */}
      {(activeCategory === 'backup' || activeCategory === 'danger') && (
        <div className="space-y-3.5 animate-scale-up">
          {renderSubPageHeader(
            t('auto_backup_data_management_cente'),
            t('auto_create_full_backups_password'),
            HardDrive
          )}

          {/* Dedicated Smart Backup Center */}
          <SmartBackupCenter onBack={() => setActiveCategory(null)} />

          {/* Smart Data Validation Button */}
          <button
            type="button"
            onClick={() => setShowDataHealthCenterModal(true)}
            className="w-full bg-surface hover:bg-surface-hover text-text-main border border-surface-border font-bold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>{t('auto_smart_data_validation_health')}</span>
          </button>

          {/* Danger Zone Button */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="w-full bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs py-3 px-4 rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-white" />
            <span>{t('auto_danger_zone_data_reset')}</span>
          </button>
        </div>
      )}

      {/* ==========================================
          SUBPAGE 7: DEDICATED ABOUT PAGE
      ========================================== */}
      {activeCategory === 'about' && (
        <div className="space-y-3.5 animate-scale-up">
          {renderSubPageHeader(
            t('auto_about'),
            t('auto_application_details_features'),
            Info
          )}

          <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3 text-center sm:text-start">
            {/* App Hero Branding Header */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pb-3 border-b border-slate-100 dark:border-surface-border">
              <img
                src="/logo.svg"
                alt="Glück fröhlich und froh Logo"
                className="w-12 h-12 rounded-lg object-contain bg-surface p-1 shadow-2xs border border-surface-border/80 dark:border-surface-border shrink-0"
              />
              <div>
                <h1 className="text-base font-black text-text-main">
                  Glück fröhlich und froh
                </h1>
                <p className="text-[11px] text-primary dark:text-primary font-extrabold mt-0.5">
                  {t('auto_german_teacher_management_syst')}
                </p>
              </div>
            </div>

            {/* App Description */}
            <div className="space-y-1">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted/70">
                {t('auto_description')}
              </h3>
              <p className="text-xs text-text-main font-medium leading-relaxed bg-surface-hover/60 p-2.5 rounded-lg border border-surface-border/60 dark:border-surface-border-soft">
                Glück fröhlich und froh helps private teachers manage students, groups, lessons, attendance, payments, reports, parent communication, and scheduling from one place.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted/70">
                {t('auto_features')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-800 dark:text-slate-200">
                {[
                  'Student Management',
                  'Group Management',
                  'Attendance Tracking',
                  'Lesson History',
                  'Payment Tracking',
                  'Parent Communication',
                  'Reports & Statistics',
                  'Calendar & Scheduling'
                ].map((feat, idx) => (
                  <div key={idx} className="p-2 bg-surface dark:bg-slate-800/80 rounded-lg border border-surface-border/80 dark:border-surface-border-soft/80 flex items-center gap-2 font-bold shadow-2xs text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Developer Contact Section */}
            <div className="p-3 bg-gradient-to-r from-slate-900 to-primary-hover text-white rounded-lg space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-primary">
                    {t('auto_developer')}
                  </p>
                  <p className="text-sm font-black">Abdul-rahman Ghareeb</p>
                </div>
                <div className="p-1.5 bg-surface/10 rounded-lg shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-xs">
                <div className="flex items-center gap-1.5 font-mono font-bold text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>WhatsApp: 01156435802</span>
                </div>

                <a
                  href="https://wa.me/201156435802"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-primary hover:bg-primary text-white font-bold text-[11px] rounded-lg transition-all shadow-2xs flex items-center gap-1 shrink-0"
                >
                  <span>WhatsApp</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Application Version */}
            <div className="text-center pt-1 text-[11px] font-mono font-bold text-text-muted/70">
              Glück fröhlich und froh • Version 2.5.0
            </div>
          </div>
        </div>
      )}
          </div>
        )}
      </div>

      {/* ==========================================
          CONFIRMATION MODAL FOR DATA CLEAR
      ========================================== */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
          <div className="bg-surface rounded-t-[20px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 max-w-sm w-full p-3.5 border border-surface-border shadow-xl space-y-3 animate-scale-up text-center font-sans">
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2 mb-1 sm:hidden shrink-0" />
            <div className="w-10 h-10 rounded-lg bg-primary-soft dark:bg-primary-soft text-primary flex items-center justify-center mx-auto shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm font-black text-text-main">{t('settings_clear_data')}</h3>
              <p className="text-xs text-text-muted mt-0.5">
                {t('confirm')}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 bg-surface-hover text-text-main rounded-lg font-bold text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllData();
                  setShowClearConfirm(false);
                  setActiveCategory(null);
                }}
                className="flex-1 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SMART DATA VALIDATION AUDIT MODAL
      ========================================== */}
      {showDataHealthCenterModal && (
        <DataHealthCenterModal onClose={() => setShowDataHealthCenterModal(false)} />
      )}
    </div>
  );
};
