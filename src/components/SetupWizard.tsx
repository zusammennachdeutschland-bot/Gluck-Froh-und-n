import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  User, Globe, Coins, ChevronRight, ChevronLeft, Check, Sparkles, 
  Moon, Sun, Clock, Phone, MessageSquare, CreditCard, Video, Bell, 
  Heart, Upload, ArrowRight, ArrowLeft, ShieldCheck, Wallet, DollarSign, 
  Award, Calendar, CheckCircle2, RotateCcw, FileText, Camera, Volume2, 
  Layers, Palette, Star, Building2, BookOpen, UserCheck, School
} from 'lucide-react';
import { AppLanguage, AccentColor, NotificationSound, SchoolSettings, SchoolPeriodSettings, SchoolDayPresence } from '../types';
import { BuddyCustomization, DEFAULT_BUDDY_CUSTOMIZATION } from '../types/buddy';
import { BuddyCustomizer } from './buddy/BuddyCustomizer';
import { BuddyAnimation } from './buddy/BuddyAnimation';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { getSchoolSettings, DEFAULT_SCHOOL_SETTINGS } from '../utils/schoolUtils';

const PRESET_AVATARS = [
  { id: 'av_man_teacher', label: 'Herr (Teacher)', icon: '👨‍🏫' },
  { id: 'av_woman_teacher', label: 'Frau (Teacher)', icon: '👩‍🏫' },
  { id: 'av_academic', label: 'Professor', icon: '🎓' },
  { id: 'av_german', label: 'German Pro', icon: '🇩🇪' },
  { id: 'av_star', label: 'Star Mentor', icon: '🌟' },
  { id: 'av_expert', label: 'Language Expert', icon: '📚' }
];

const ACCENT_COLORS: { id: AccentColor; name: string; hex: string }[] = [
  { id: 'blue', name: 'Blue', hex: '#2563eb' },
  { id: 'emerald', name: 'Emerald', hex: '#059669' },
  { id: 'purple', name: 'Purple', hex: '#7c3aed' },
  { id: 'amber', name: 'Amber', hex: '#d97706' },
  { id: 'rose', name: 'Rose', hex: '#e11d48' },
  { id: 'indigo', name: 'Indigo', hex: '#4f46e5' },
  { id: 'cyan', name: 'Cyan', hex: '#0891b2' },
  { id: 'darkblue', name: 'Navy', hex: '#1e3a8a' }
];

const DAYS_OF_WEEK = [
  { key: 6, labelAr: 'السبت', labelEn: 'Sat', labelDe: 'Sa' },
  { key: 0, labelAr: 'الأحد', labelEn: 'Sun', labelDe: 'So' },
  { key: 1, labelAr: 'الإثنين', labelEn: 'Mon', labelDe: 'Mo' },
  { key: 2, labelAr: 'الثلاثاء', labelEn: 'Tue', labelDe: 'Di' },
  { key: 3, labelAr: 'الأربعاء', labelEn: 'Wed', labelDe: 'Mi' },
  { key: 4, labelAr: 'الخميس', labelEn: 'Thu', labelDe: 'Do' },
  { key: 5, labelAr: 'الجمعة', labelEn: 'Fri', labelDe: 'Fr' },
];

export const SetupWizard: React.FC = () => {
  const { 
    profile, updateProfile, theme, toggleTheme, language: currentAppLang, setLanguage, 
    accentColor: currentAccent, setAccentColor, updateNotificationSettings,
    updateInspirationSettings, financeAccounts, addFinanceAccount,
    importBackupFile, _t
  } = useApp();

  const currentSchoolData = getSchoolSettings(profile);

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Step 0: Display & Preferences State
  const [language, setLocalLanguage] = useState<AppLanguage>(profile.language || currentAppLang || 'de');
  const [accent, setLocalAccent] = useState<AccentColor>(currentAccent || 'blue');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(theme === 'dark');
  const [currency, setCurrency] = useState(profile.currency || 'EGP');

  // Step 1: Teacher Profile State
  const [displayName, setDisplayName] = useState(profile.displayName === 'Teacher' ? '' : profile.displayName);
  const [displayNameEn, setDisplayNameEn] = useState(profile.displayNameEn || profile.nameEn || '');
  const [displayNameAr, setDisplayNameAr] = useState(profile.displayNameAr || profile.nameAr || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(profile.avatarUrl || '');
  const [customAvatarImg, setCustomAvatarImg] = useState<string>(profile.avatarUrl && profile.avatarUrl.startsWith('data:') ? profile.avatarUrl : '');
  const [buddyConfig, setBuddyConfig] = useState<BuddyCustomization>(() => {
    return profile.buddyCustomization || DEFAULT_BUDDY_CUSTOMIZATION;
  });
  const [phone, setPhone] = useState(profile.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(profile.whatsappNumber || '');
  const [email, setEmail] = useState(profile.email || '');

  // Step 2: School Data State (NEW STEP)
  const [schoolName, setSchoolName] = useState(profile.schoolSettings?.schoolName || 'مدرسة الأورمان الرسمية لغات');
  const [departmentName, setDepartmentName] = useState(profile.schoolSettings?.departmentName || 'قسم اللغة الألمانية (Deutsch)');
  const [academicYear, setAcademicYear] = useState(profile.schoolSettings?.academicYear || '2025 / 2026');
  const [currentTerm, setCurrentTerm] = useState(profile.schoolSettings?.currentTerm || 'الفصل الدراسي الأول');
  const [hodName, setHodName] = useState(profile.schoolSettings?.hodName || 'Abdul-rahman Ghareeb');
  
  // School Attendance Days & Periods
  const [schoolPresenceDays, setSchoolPresenceDays] = useState<string[]>(() => {
    if (profile.schoolSettings?.presence) {
      return Object.keys(profile.schoolSettings.presence).filter(k => profile.schoolSettings!.presence[k]?.active);
    }
    return ['0', '1', '2', '3', '4']; // Sun to Thu
  });
  const [schoolArrivalTime, setSchoolArrivalTime] = useState(profile.schoolSettings?.presence?.['0']?.arrivalTime || '07:30');
  const [schoolDepartureTime, setSchoolDepartureTime] = useState(profile.schoolSettings?.presence?.['0']?.departureTime || '14:30');
  const [periodsCount, setPeriodsCount] = useState<number>(profile.schoolSettings?.periodSettings?.periodsCount || 7);
  const [firstPeriodStart, setFirstPeriodStart] = useState<string>(profile.schoolSettings?.periodSettings?.firstPeriodStart || '08:00');
  const [periodDuration, setPeriodDuration] = useState<number>(profile.schoolSettings?.periodSettings?.defaultDuration || 45);

  // Step 3: Payment State
  const [instaPayId, setInstaPayId] = useState(profile.instaPayId || '');
  const [vodafoneCashNumber, setVodafoneCashNumber] = useState(profile.vodafoneCashNumber || '');
  const [bankAccount, setBankAccount] = useState(profile.bankAccount || '');
  const [paymentLink, setPaymentLink] = useState(profile.paymentLink || '');
  const [autoCreateFinanceAccounts, setAutoCreateFinanceAccounts] = useState(true);

  // Step 4: Schedule & Working Days State
  const [selectedDays, setSelectedDays] = useState<number[]>(
    profile.workingHours?.workingDays?.length ? profile.workingHours.workingDays : [6, 0, 1, 2, 3, 4] // Sat-Thu
  );
  const [startTime, setStartTime] = useState(profile.workingHours?.startTime || '09:00');
  const [endTime, setEndTime] = useState(profile.workingHours?.endTime || '21:00');
  const [defaultDuration, setDefaultDuration] = useState<number>(60);
  const [defaultZoomLink, setDefaultZoomLink] = useState(profile.defaultZoomLink || '');
  const [defaultMeetLink, setDefaultMeetLink] = useState(profile.defaultMeetLink || '');

  // Step 5: Alerts & Inspiration State
  const [enableLessonAlerts, setEnableLessonAlerts] = useState(profile.enableLessonAlerts !== false);
  const [alertMinutesBefore, setAlertMinutesBefore] = useState(15);
  const [notificationSound, setNotificationSound] = useState<NotificationSound>('beep');
  const [enableDailySummary, setEnableDailySummary] = useState(true);
  const [enableInspiration, setEnableInspiration] = useState(true);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Check if wizard should be open on initial load
  useEffect(() => {
    const isCompleted = localStorage.getItem('dl_setup_completed') === 'true';
    if (!isCompleted || !profile.displayName || profile.displayName.trim() === '' || profile.displayName === 'Teacher' || profile.displayName === 'أ. أحمد محمود') {
      setIsOpen(true);
      setCurrentStep(0);
    }
  }, [profile.displayName]);

  // Listen to manual open trigger from settings
  useEffect(() => {
    const handleManualOpen = () => {
      setIsOpen(true);
      setCurrentStep(0);
    };
    window.addEventListener('open-setup-wizard', handleManualOpen);
    return () => window.removeEventListener('open-setup-wizard', handleManualOpen);
  }, []);

  if (!isOpen) {
    return null;
  }

  // 7 Steps total: 0 to 6
  const stepsCount = 7;

  const handleNext = () => {
    if (currentStep === 1 && !displayName.trim()) {
      return; // Required on step 1
    }
    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, stepsCount - 1));
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert(_t('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت', 'Image is too large. Please select an image under 2MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setCustomAvatarImg(base64);
        setSelectedAvatar(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleDaySelection = (dayKey: number) => {
    if (selectedDays.includes(dayKey)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== dayKey));
      }
    } else {
      setSelectedDays([...selectedDays, dayKey]);
    }
  };

  const toggleSchoolPresenceDay = (dayKeyStr: string) => {
    if (schoolPresenceDays.includes(dayKeyStr)) {
      if (schoolPresenceDays.length > 1) {
        setSchoolPresenceDays(schoolPresenceDays.filter(d => d !== dayKeyStr));
      }
    } else {
      setSchoolPresenceDays([...schoolPresenceDays, dayKeyStr]);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    try {
      const text = await file.text();
      const success = await importBackupFile(text);
      if (success) {
        localStorage.setItem('dl_setup_completed', 'true');
        setIsOpen(false);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    } catch (err) {
      console.error('Failed to restore backup during setup:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFinish = async () => {
    const finalDisplayName = displayName.trim() || 'Teacher';
    const finalEn = displayNameEn.trim() || (!/[\u0600-\u06FF]/.test(finalDisplayName) ? finalDisplayName : 'Herr ' + finalDisplayName);
    const finalAr = displayNameAr.trim() || (/[\u0600-\u06FF]/.test(finalDisplayName) ? finalDisplayName : 'أ. ' + finalDisplayName);
    const finalAvatar = selectedAvatar || '👨‍🏫';

    // 1. Build weekly hours for private lessons
    const weeklyHoursObj: any = {};
    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
      weeklyHoursObj[day] = {
        isOff: !selectedDays.includes(day),
        startTime,
        endTime
      };
    });

    // 2. Build School Presence & Settings
    const newPresence: Record<string, SchoolDayPresence> = {};
    ['0', '1', '2', '3', '4', '5', '6'].forEach(dayKey => {
      newPresence[dayKey] = {
        active: schoolPresenceDays.includes(dayKey),
        arrivalTime: schoolArrivalTime,
        departureTime: schoolDepartureTime
      };
    });

    const updatedSchoolSettings: SchoolSettings = {
      ...(profile.schoolSettings || DEFAULT_SCHOOL_SETTINGS),
      schoolName: schoolName.trim() || 'مدرسة الأورمان الرسمية لغات',
      departmentName: departmentName.trim() || 'قسم اللغة الألمانية (Deutsch)',
      academicYear: academicYear.trim() || '2025 / 2026',
      currentTerm: currentTerm.trim() || 'الفصل الدراسي الأول',
      hodName: hodName.trim() || 'Abdul-rahman Ghareeb',
      presence: newPresence,
      periodSettings: {
        periodsCount,
        firstPeriodStart,
        defaultDuration: periodDuration,
        customDurations: profile.schoolSettings?.periodSettings?.customDurations || {}
      },
      schedule: profile.schoolSettings?.schedule || DEFAULT_SCHOOL_SETTINGS.schedule
    };

    // 3. Update Teacher Profile
    updateProfile({
      displayName: finalDisplayName,
      displayNameEn: finalEn,
      displayNameAr: finalAr,
      nameEn: finalEn,
      nameAr: finalAr,
      avatarUrl: finalAvatar,
      phone: phone.trim(),
      whatsappNumber: (whatsappNumber || phone).trim(),
      email: email.trim(),
      currency,
      language,
      instaPayId: instaPayId.trim(),
      vodafoneCashNumber: vodafoneCashNumber.trim(),
      bankAccount: bankAccount.trim(),
      paymentLink: paymentLink.trim(),
      defaultZoomLink: defaultZoomLink.trim(),
      defaultMeetLink: defaultMeetLink.trim(),
      enableLessonAlerts,
      schoolSettings: updatedSchoolSettings,
      buddyCustomization: buddyConfig,
      workingHours: {
        workingDays: selectedDays,
        startTime,
        endTime
      },
      weeklyWorkingHours: weeklyHoursObj
    });

    // 4. Set global preferences
    setLanguage(language);
    setAccentColor(accent);
    if ((isDarkMode && theme === 'light') || (!isDarkMode && theme === 'dark')) {
      toggleTheme();
    }

    // 5. Update Notifications & Inspiration
    await updateNotificationSettings({
      masterEnabled: true,
      lessonReminder: { enabled: enableLessonAlerts, sound: notificationSound, priority: 'high' },
      lessonReminderMinutesBefore: alertMinutesBefore,
      dailySummary: { enabled: enableDailySummary, sound: 'gentle', priority: 'normal' },
      dailySummaryTime: '20:00'
    });

    updateInspirationSettings({
      frequency: enableInspiration ? 'daily' : 'disabled',
      displayMethod: 'both'
    });

    // 6. Initialize default finance accounts if requested
    if (autoCreateFinanceAccounts && financeAccounts.length === 0) {
      addFinanceAccount({
        name: language === 'ar' ? 'الخزينة (كاش)' : (language === 'de' ? 'Bargeld Kasse' : 'Cash Drawer'),
        type: 'cash',
        openingBalance: 0,
        currentBalance: 0,
        currency
      });

      if (vodafoneCashNumber.trim()) {
        addFinanceAccount({
          name: language === 'ar' ? `فودافون كاش (${vodafoneCashNumber.trim()})` : `Vodafone Cash (${vodafoneCashNumber.trim()})`,
          type: 'wallet',
          openingBalance: 0,
          currentBalance: 0,
          currency
        });
      }

      if (bankAccount.trim()) {
        addFinanceAccount({
          name: language === 'ar' ? 'الحساب البنكي' : (language === 'de' ? 'Bankkonto' : 'Bank Account'),
          type: 'bank',
          openingBalance: 0,
          currentBalance: 0,
          currency
        });
      }
    }

    // 7. Mark setup as completed
    localStorage.setItem('dl_setup_completed', 'true');
    
    // Celebration
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    setTimeout(() => {
      setIsOpen(false);
    }, 500);
  };

  const stepTitles = [
    { title: _t('المظهر واللغة', 'Style & Lang', 'Design & Sprache'), icon: '🎨' },
    { title: _t('هوية المعلم', 'Teacher Profile', 'Lehrer-Profil'), icon: '👤' },
    { title: _t('بيانات المدرسة', 'School Profile', 'Schuldaten'), icon: '🏫' },
    { title: _t('طرق التحصيل', 'Payments', 'Zahlungen'), icon: '💳' },
    { title: _t('جدول العمل', 'Schedule', 'Arbeitszeiten'), icon: '⏰' },
    { title: _t('التنبيهات والبركة', 'Alerts & Quotes', 'Erinnerungen'), icon: '🔔' },
    { title: _t('المراجعة والبدء', 'Launch', 'Startklar'), icon: '🚀' }
  ];

  return (
    <div id="setup-wizard-overlay" className="fixed inset-0 z-[120] overflow-hidden bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 font-sans">
      
      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-3xl max-h-[92dvh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header with Stepper */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
          <div className="flex items-center justify-between gap-4 mb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center text-lg shadow-sm font-bold">
                🇩🇪
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Glück Teacher</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Setup Wizard
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {_t('إعداد ملف المعلم وبيانات المدرسة والجدول الدراسي', 'Configure teacher profile, school data and schedules', 'Lehrerprofil, Schuldaten und Arbeitszeiten einrichten')}
                </p>
              </div>
            </div>

            {/* Step Counter Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {currentStep + 1} / {stepsCount}
              </span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="relative w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
            <motion.div 
              className="absolute top-0 bottom-0 left-0 bg-primary rounded-full"
              initial={false}
              animate={{ width: `${((currentStep + 1) / stepsCount) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          </div>

          {/* Stepper Interactive Pills */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-1">
            {stepTitles.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (idx < currentStep || (idx > 0 && displayName.trim())) {
                      setDirection(idx > currentStep ? 1 : -1);
                      setCurrentStep(idx);
                    }
                  }}
                  disabled={idx > currentStep && !displayName.trim()}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isCurrent 
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20' 
                      : isPast 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 cursor-pointer' 
                      : 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>{isPast ? '✓' : step.icon}</span>
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 30 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="space-y-5 max-w-2xl mx-auto"
            >

              {/* ================= STEP 0: LANGUAGE, THEME & CURRENCY ================= */}
              {currentStep === 0 && (
                <div className="space-y-5">
                  <div className="text-center sm:text-left space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>🎨</span>
                      <span>{_t('اختر اللغة والمظهر والعملة', 'Language, Theme & Currency', 'Sprache, Design & Währung')}</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {_t('حدد لغة العرض ونمط الألوان والعملة الافتراضية لمنصتك.', 'Select your interface language, color scheme, and primary currency.', 'Wählen Sie Ihre bevorzugte Sprache und Währung.')}
                    </p>
                  </div>

                  {/* Language Selector Cards */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('لغة واجهة التطبيق', 'App Interface Language', 'Oberflächensprache')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'de' as AppLanguage, name: 'Deutsch', sub: 'German', flag: '🇩🇪' },
                        { id: 'ar' as AppLanguage, name: 'العربية', sub: 'Arabic (RTL)', flag: '🇪🇬' },
                        { id: 'en' as AppLanguage, name: 'English', sub: 'English', flag: '🇬🇧' },
                      ].map((langItem) => (
                        <button
                          key={langItem.id}
                          type="button"
                          onClick={() => {
                            setLocalLanguage(langItem.id);
                            setLanguage(langItem.id);
                          }}
                          className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                            language === langItem.id 
                              ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20 text-primary' 
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-2xl">{langItem.flag}</span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{langItem.name}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{langItem.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme & Currency Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Theme Mode */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {_t('نمط الألوان', 'Color Theme', 'Farbschema')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDarkMode(false);
                            if (theme === 'dark') toggleTheme();
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                            !isDarkMode 
                              ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20' 
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span>{_t('فاتح (Light)', 'Light Mode', 'Hell')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDarkMode(true);
                            if (theme === 'light') toggleTheme();
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                            isDarkMode 
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 ring-2 ring-indigo-500/20' 
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Moon className="w-4 h-4 text-indigo-400" />
                          <span>{_t('داكن (Dark)', 'Dark Mode', 'Dunkel')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Currency */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {_t('العملة الأساسية', 'Primary Currency', 'Hauptwährung')}
                      </label>
                      <div className="relative">
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                        >
                          <option value="EGP">EGP (ج.م - الجنيه المصري)</option>
                          <option value="EUR">EUR (€ - Euro)</option>
                          <option value="USD">USD ($ - US Dollar)</option>
                          <option value="SAR">SAR (ر.س - الريال السعودي)</option>
                          <option value="AED">AED (د.إ - الدرهم الإماراتي)</option>
                          <option value="KWD">KWD (د.ك - الدينار الكويتي)</option>
                        </select>
                        <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Accent Colors Palette */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('اللون المميز (Accent Color)', 'Accent Highlight Color', 'Akzentfarbe')}
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENT_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => {
                            setLocalAccent(col.id);
                            setAccentColor(col.id);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            accent === col.id ? 'ring-4 ring-primary/30 scale-110 shadow-sm' : 'hover:scale-105 opacity-80'
                          }`}
                          style={{ backgroundColor: col.hex }}
                          title={col.name}
                        >
                          {accent === col.id && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 1: TEACHER PROFILE ================= */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="text-center sm:text-left space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>👤</span>
                      <span>{_t('هوية المعلم وبيانات التواصل', 'Teacher Profile & Contacts', 'Lehrer-Profil & Kontakt')}</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {_t('تُستخدم هذه البيانات في إصدار الشهادات، وتذييل التقارير، وتذكيرات أولياء الأمور.', 'Used in certificate issuance, report headers, and parent communications.', 'Wird für Zertifikate und Elternberichte verwendet.')}
                    </p>
                  </div>

                  {/* Buddy Mascot Customizer & Avatar */}
                  <div className="space-y-3">
                    <BuddyCustomizer
                      value={buddyConfig}
                      onChange={setBuddyConfig}
                    />

                    {/* Or Upload Custom Teacher Photo */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {customAvatarImg ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/40 shrink-0">
                            <img src={customAvatarImg} alt="Uploaded" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <Camera className="w-4 h-4 text-slate-400" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {customAvatarImg ? _t('تم تعيين صورة مخصصة', 'Custom Photo Uploaded', 'Eigenes Foto ausgewählt') : _t('أو استخدام صورة شخصية حقيقية', 'Or use a real profile photo', 'Oder eigenes Profilfoto')}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {_t('اختياري — تظهر في الشهادات والتقارير الرسمية', 'Optional — used in certificates and reports', 'Optional für Zertifikate')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {customAvatarImg && (
                          <button
                            type="button"
                            onClick={() => { setCustomAvatarImg(''); setSelectedAvatar(''); }}
                            className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                          >
                            {_t('حذف', 'Remove', 'Entfernen')}
                          </button>
                        )}
                        <label className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer flex items-center gap-1.5 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{customAvatarImg ? _t('تغيير', 'Change', 'Ändern') : _t('رفع صورة', 'Upload', 'Hochladen')}</span>
                          <input type="file" accept="image/*" onChange={handleAvatarFileUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Names */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                        {_t('الاسم الأساسي (يظهر في القوائم والتطبيق) *', 'Display Name (Main) *', 'Anzeigename *')}
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Herr Omar Hassan / أ. عمر حسن"
                          className="w-full pl-10 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary shadow-sm"
                          autoFocus
                        />
                      </div>
                      {!displayName.trim() && (
                        <p className="text-[11px] text-red-500 mt-1 font-medium">
                          {_t('يرجى إدخال اسم المعلم للمتابعة', 'Teacher name is required to proceed.', 'Bitte geben Sie den Lehrernamen ein.')}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          📜 {_t('الاسم بالألمانية/الإنجليزية (للشهادات)', 'German/English Name (Certificates)', 'Name für Zertifikate')}
                        </label>
                        <input
                          type="text"
                          value={displayNameEn}
                          onChange={(e) => setDisplayNameEn(e.target.value)}
                          placeholder="e.g. Herr Omar Hassan"
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          📊 {_t('الاسم بالعربية (للتقارير والواتساب)', 'Arabic Name (Reports & Parent msgs)', 'Arabischer Name')}
                        </label>
                        <input
                          type="text"
                          value={displayNameAr}
                          onChange={(e) => setDisplayNameAr(e.target.value)}
                          placeholder="مثال: أ. عمر حسن"
                          dir="rtl"
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contacts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                        {_t('رقم الواتساب للتواصل', 'WhatsApp Number', 'WhatsApp-Nummer')}
                      </label>
                      <div className="relative">
                        <MessageSquare className="w-4 h-4 text-emerald-500 absolute left-3.5 top-2.5" />
                        <input
                          type="tel"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          placeholder="+20 10 1234 5678"
                          className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                        {_t('رقم الهاتف الأساسي', 'Primary Phone', 'Telefonnummer')}
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="01012345678"
                          className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 2: SCHOOL & ACADEMIC DATA (NEW STEP) ================= */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="text-center sm:text-left space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>🏫</span>
                      <span>{_t('بيانات المدرسة والجدول المدرسي', 'School & Academic Profile', 'Schuldaten & Stundenplan')}</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {_t('سجّل اسم المدرسة، القسم، العام الدراسي، ومواعيد الحصص المدرسية لتنظيم جدول الحصص والتقارير المدرسية.', 'Register school name, department, academic year, and period timings for school reports.', 'Geben Sie Schulname, Fachabteilung, Schuljahr und Unterrichtszeiten ein.')}
                    </p>
                  </div>

                  {/* School & Department Identifiers */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          🏫 {_t('اسم المدرسة', 'School Name', 'Schulname')}
                        </label>
                        <input
                          type="text"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          placeholder="مثال: مدرسة الأورمان الرسمية لغات"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          📖 {_t('القسم / المادة التعليمية', 'Department / Subject', 'Fachabteilung')}
                        </label>
                        <input
                          type="text"
                          value={departmentName}
                          onChange={(e) => setDepartmentName(e.target.value)}
                          placeholder="مثال: قسم اللغة الألمانية (Deutsch)"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          📅 {_t('العام الدراسي', 'Academic Year', 'Schuljahr')}
                        </label>
                        <input
                          type="text"
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          placeholder="2025 / 2026"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          🗓️ {_t('الفصل الدراسي', 'Current Term', 'Semester / Halbjahr')}
                        </label>
                        <select
                          value={currentTerm}
                          onChange={(e) => setCurrentTerm(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="الفصل الدراسي الأول">الفصل الدراسي الأول (Term 1)</option>
                          <option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني (Term 2)</option>
                          <option value="العام بالكامل">العام بالكامل (Full Year)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          👔 {_t('المشرف / رئيس القسم (HOD)', 'HOD / Supervisor', 'Fachleiter')}
                        </label>
                        <input
                          type="text"
                          value={hodName}
                          onChange={(e) => setHodName(e.target.value)}
                          placeholder="Abdul-rahman Ghareeb"
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* School Days & Periods Timing */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3.5">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {_t('أيام الحضور والجدول في المدرسة', 'School Attendance Days', 'Schultage')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: '0', labelAr: 'الأحد', labelEn: 'Sun', labelDe: 'So' },
                          { key: '1', labelAr: 'الإثنين', labelEn: 'Mon', labelDe: 'Mo' },
                          { key: '2', labelAr: 'الثلاثاء', labelEn: 'Tue', labelDe: 'Di' },
                          { key: '3', labelAr: 'الأربعاء', labelEn: 'Wed', labelDe: 'Mi' },
                          { key: '4', labelAr: 'الخميس', labelEn: 'Thu', labelDe: 'Do' },
                          { key: '6', labelAr: 'السبت', labelEn: 'Sat', labelDe: 'Sa' },
                          { key: '5', labelAr: 'الجمعة', labelEn: 'Fri', labelDe: 'Fr' },
                        ].map((day) => {
                          const isSelected = schoolPresenceDays.includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => toggleSchoolPresenceDay(day.key)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected 
                                  ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20' 
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                              }`}
                            >
                              <span>{isSelected ? '✓' : ''}</span>
                              <span>{language === 'ar' ? day.labelAr : (language === 'de' ? day.labelDe : day.labelEn)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          ⏰ {_t('وقت الحضور', 'Arrival', 'Ankunft')}
                        </label>
                        <input
                          type="time"
                          value={schoolArrivalTime}
                          onChange={(e) => setSchoolArrivalTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          ⏰ {_t('الانصراف', 'Departure', 'Abfahrt')}
                        </label>
                        <input
                          type="time"
                          value={schoolDepartureTime}
                          onChange={(e) => setSchoolDepartureTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          🔢 {_t('عدد الحصص', 'Periods', 'Stunden')}
                        </label>
                        <select
                          value={periodsCount}
                          onChange={(e) => setPeriodsCount(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                        >
                          <option value={6}>6 حصص</option>
                          <option value={7}>7 حصص</option>
                          <option value={8}>8 حصص</option>
                          <option value={9}>9 حصص</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          🔔 {_t('الحصة الأولى', '1st Period', '1. Stunde')}
                        </label>
                        <input
                          type="time"
                          value={firstPeriodStart}
                          onChange={(e) => setFirstPeriodStart(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          ⏱️ {_t('مدة الحصة', 'Duration', 'Dauer')}
                        </label>
                        <select
                          value={periodDuration}
                          onChange={(e) => setPeriodDuration(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white"
                        >
                          <option value={40}>40 دقيقة</option>
                          <option value={45}>45 دقيقة</option>
                          <option value={50}>50 دقيقة</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 3: PAYMENT & FINANCE ================= */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <div className="text-center sm:text-left space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>💳</span>
                      <span>{_t('قنوات الدفع واستلام المصروفات', 'Payment & Collection Channels', 'Zahlungskanäle')}</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {_t('تُدرج هذه البيانات تلقائياً في رسائل تذكير السداد وإشعارات أولياء الأمور لتسهيل التحصيل.', 'Automatically attached to invoice messages & payment reminders for parents.', 'Wird automatisch an Zahlungserinnerungen angehängt.')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* InstaPay */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-6 h-6 rounded-lg bg-pink-500/10 text-pink-500 flex items-center justify-center font-black">⚡</span>
                        <span>{_t('عنوان إنستاباي (InstaPay ID / IPA)', 'InstaPay ID / Address', 'InstaPay')}</span>
                      </div>
                      <input
                        type="text"
                        value={instaPayId}
                        onChange={(e) => setInstaPayId(e.target.value)}
                        placeholder="e.g. omar@instapay"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"
                      />
                    </div>

                    {/* Vodafone Cash */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-black">📱</span>
                        <span>{_t('فودافون كاش / محفظة إلكترونية', 'Vodafone Cash / Wallet', 'Mobile Wallet')}</span>
                      </div>
                      <input
                        type="tel"
                        value={vodafoneCashNumber}
                        onChange={(e) => setVodafoneCashNumber(e.target.value)}
                        placeholder="e.g. 01012345678"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    {/* Bank Account */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">🏦</span>
                        <span>{_t('الحساب البنكي / IBAN', 'Bank Account / IBAN', 'Bankkonto')}</span>
                      </div>
                      <input
                        type="text"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        placeholder="e.g. CIB / NBE / QNB - 1000..."
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Payment Link */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-black">🔗</span>
                        <span>{_t('رابط دفع خارجي أو تفاصيل أخرى', 'Payment Link / Note', 'Zahlungslink')}</span>
                      </div>
                      <input
                        type="text"
                        value={paymentLink}
                        onChange={(e) => setPaymentLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Auto-create finance accounts toggle */}
                  <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold">
                        💼
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {_t('تهيئة الحسابات المالية الافتراضية تلقائياً', 'Auto-create Standard Finance Accounts', 'Finanzkonten automatisch erstellen')}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {_t('إنشاء حساب "الخزينة كاش" ومحفظة فودافون كاش في النظام المالي للبدء فوراً.', 'Initializes Cash Drawer & Wallet in the Finance Center.', 'Erstellt Bargeld- & Wallet-Konten.')}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoCreateFinanceAccounts}
                      onChange={(e) => setAutoCreateFinanceAccounts(e.target.checked)}
                      className="w-5 h-5 accent-primary rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ================= STEP 4: SCHEDULE & WORKING DAYS ================= */}
              {currentStep === 4 && (
                <div className="space-y-5">
                  <div className="text-center sm:text-left space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>⏰</span>
                      <span>{_t('جدول الحصص الخاصة وحصص الأونلاين', 'Tutoring Schedule & Online Links', 'Privatunterricht & Online-Links')}</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {_t('حدد أيام وساعات العمل المعتادة لتنظيم جدول الدروس الخصوصية والروابط الثابتة.', 'Set your private tutoring days, work hours, and permanent virtual class links.', 'Legen Sie Unterrichtstage und Standard-Links fest.')}
                    </p>
                  </div>

                  {/* Days Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('أيام تدريس الدروس الخصوصية', 'Active Tutoring Days', 'Unterrichtstage')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = selectedDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => toggleDaySelection(day.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected 
                                ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            <span>{isSelected ? '✓' : ''}</span>
                            <span>{language === 'ar' ? day.labelAr : (language === 'de' ? day.labelDe : day.labelEn)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hours & Duration */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {_t('بداية وقت العمل', 'Start Time', 'Startzeit')}
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {_t('نهاية وقت العمل', 'End Time', 'Endzeit')}
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {_t('مدة الحصة الافتراضية', 'Default Duration', 'Dauer')}
                      </label>
                      <select
                        value={defaultDuration}
                        onChange={(e) => setDefaultDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                      >
                        <option value={45}>45 {_t('دقيقة', 'min', 'Min')}</option>
                        <option value={60}>60 {_t('دقيقة', 'min', 'Min')}</option>
                        <option value={90}>90 {_t('دقيقة', 'min', 'Min')}</option>
                        <option value={120}>120 {_t('دقيقة', 'min', 'Min')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Virtual Class Links */}
                  <div className="space-y-2.5 pt-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('روابط الحصص الافتراضية الثابتة (أونلاين)', 'Default Online Meeting Links', 'Online-Unterrichtslinks')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
                          <Video className="w-3.5 h-3.5" />
                          <span>Zoom Meeting Link</span>
                        </div>
                        <input
                          type="url"
                          value={defaultZoomLink}
                          onChange={(e) => setDefaultZoomLink(e.target.value)}
                          placeholder="https://zoom.us/j/..."
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                          <Video className="w-3.5 h-3.5" />
                          <span>Google Meet Link</span>
                        </div>
                        <input
                          type="url"
                          value={defaultMeetLink}
                          onChange={(e) => setDefaultMeetLink(e.target.value)}
                          placeholder="https://meet.google.com/..."
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 5: SMART ALERTS & INSPIRATION ================= */}
              {currentStep === 5 && (
                <div className="space-y-5">
                  <div className="text-center sm:text-left space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>🔔</span>
                      <span>{_t('التنبيهات الذكية ورسائل التفاؤل والبركة', 'Smart Alerts & Daily Inspiration', 'Erinnerungen & Inspiration')}</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {_t('تنبيهك قبل موعد بدء الحصة ورسائل التفاؤل والبركة اليومية لبداية موفقة.', 'Timely alerts before sessions and daily motivational teacher quotes.', 'Rechtzeitige Erinnerungen und tägliche Inspiration.')}
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Lesson alerts card */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {_t('تنبيهات اقتراب موعد الحصة', 'Upcoming Lesson Reminders', 'Unterrichtserinnerung')}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {_t('إشعار على الجهاز قبل بدء الحصة بالوقت المحدد', 'Get notified before class begins', 'Benachrichtigung vor Unterrichtsbeginn')}
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={enableLessonAlerts}
                          onChange={(e) => setEnableLessonAlerts(e.target.checked)}
                          className="w-5 h-5 accent-primary rounded cursor-pointer"
                        />
                      </div>

                      {enableLessonAlerts && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                              {_t('التنبيه قبل الحصة بـ:', 'Alert before class:', 'Erinnern vor:')}
                            </span>
                            <select
                              value={alertMinutesBefore}
                              onChange={(e) => setAlertMinutesBefore(Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                            >
                              <option value={5}>5 {_t('دقائق', 'mins', 'Min')}</option>
                              <option value={10}>10 {_t('دقائق', 'mins', 'Min')}</option>
                              <option value={15}>15 {_t('دقيقة', 'mins', 'Min')}</option>
                              <option value={30}>30 {_t('دقيقة', 'mins', 'Min')}</option>
                              <option value={60}>60 {_t('دقيقة (ساعة)', 'mins (1h)', '60 Min')}</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                              {_t('نغمة التنبيه:', 'Alert sound:', 'Ton:')}
                            </span>
                            <select
                              value={notificationSound}
                              onChange={(e) => setNotificationSound(e.target.value as NotificationSound)}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                            >
                              <option value="beep">Beep (صافرة واضحة)</option>
                              <option value="chime">Chime (جرس ناعم)</option>
                              <option value="bell">Bell (رنة منبه)</option>
                              <option value="gentle">Gentle (هادئ)</option>
                              <option value="default">System Default (الافتراضي)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Daily Inspiration card */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <Heart className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {_t('رسائل التفاؤل والبركة اليومية', 'Daily Inspiration & Blessing Quotes', 'Tägliche Inspiration & Motivation')}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {_t('عرض عبارات تشجيعية وتذكيرية بالخير عند فتح التطبيق يومياً', 'Daily motivating quotes for the teacher', 'Tägliche ermutigende Zitate')}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableInspiration}
                        onChange={(e) => setEnableInspiration(e.target.checked)}
                        className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* Daily Summary card */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {_t('إشعار التقرير المسائي اليومي (الساعة 8 مساءً)', 'Daily Summary Alert (8:00 PM)', 'Täglicher Abendbericht (20:00 Uhr)')}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {_t('ملخص سريع للحصص المنفذة والمدفوعات المحصلة اليوم', 'Summary of today\'s lessons and income', 'Übersicht des Tages und Einnahmen')}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableDailySummary}
                        onChange={(e) => setEnableDailySummary(e.target.checked)}
                        className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 6: SUMMARY & READY TO LAUNCH ================= */}
              {currentStep === 6 && (
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl mx-auto shadow-md mb-2">
                      🚀
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {_t('أنت الآن جاهز للانطلاق!', 'You are all set!', 'Alles ist bereit!')}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                      {_t('تم إعداد كافة متطلبات منصتك التعليمية بنجاح. راجع بطاقة المعلم والمدرسة أدناه ثم اضغط ابدأ.', 'Your teaching workspace is now fully configured and ready for action.', 'Ihr digitaler Lehrarbeitsplatz ist einsatzbereit.')}
                    </p>
                  </div>

                  {/* Teacher & School Preview Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white shadow-xl relative overflow-hidden border border-slate-800">
                    <div className="space-y-3.5">
                      
                      {/* Teacher Row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl overflow-visible flex-shrink-0">
                            {customAvatarImg ? (
                              <img src={customAvatarImg} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                              <BuddyAnimation mood="celebration" size="sm" customization={buddyConfig} popOut={true} />
                            )}
                          </div>
                          <div>
                            <h3 className="text-base font-black text-white">
                              {displayName || 'Teacher'}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-300">
                              <span>{displayNameEn || displayName}</span>
                              {displayNameAr && <span>• {displayNameAr}</span>}
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                          Active Teacher 🇩🇪
                        </span>
                      </div>

                      {/* School & Department Badge */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🏫</span>
                          <div>
                            <span className="font-bold text-white block">{schoolName || 'مدرسة الأورمان الرسمية لغات'}</span>
                            <span className="text-[11px] text-slate-300">{departmentName} • {academicYear}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">{_t('رئيس القسم (HOD)', 'HOD', 'Fachleiter')}</span>
                          <span className="font-bold text-slate-200">{hodName || 'Abdul-rahman Ghareeb'}</span>
                        </div>
                      </div>

                      {/* Meta stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-xs">
                        <div className="bg-white/5 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">{_t('اللغة', 'Language', 'Sprache')}</span>
                          <span className="font-bold">{language.toUpperCase()}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">{_t('العملة', 'Currency', 'Währung')}</span>
                          <span className="font-bold">{currency}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">{_t('أيام الدروس', 'Tutoring Days', 'Tage')}</span>
                          <span className="font-bold">{selectedDays.length} {_t('أيام', 'days', 'Tage')}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">{_t('أيام المدرسة', 'School Days', 'Schultage')}</span>
                          <span className="font-bold">{schoolPresenceDays.length} {_t('أيام', 'days', 'Tage')}</span>
                        </div>
                      </div>

                      {(instaPayId || vodafoneCashNumber) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {instaPayId && (
                            <span className="px-2 py-0.5 rounded-lg bg-pink-500/20 text-pink-300 text-[11px] font-semibold">
                              ⚡ InstaPay: {instaPayId}
                            </span>
                          )}
                          {vodafoneCashNumber && (
                            <span className="px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 text-[11px] font-semibold">
                              📱 Cash: {vodafoneCashNumber}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Restore backup alternative prompt */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <div className="flex items-center gap-2.5">
                      <RotateCcw className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {_t('هل لديك ملف نسخة احتياطية سابقة؟', 'Already have a backup file?', 'Haben Sie ein Backup?')}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {_t('يمكنك استعادة بياناتك بالكامل بضغطة زر وتخطي الإعداد.', 'Restore your data directly from file.', 'Daten direkt aus Backup laden.')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRestoring}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      {isRestoring ? _t('جار الاستعادة...', 'Restoring...', 'Wiederherstellen...') : _t('استعادة النسخة الآن', 'Restore Backup Now', 'Backup laden')}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleRestoreBackup}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-5 sm:px-7 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          {/* Previous Button */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
              currentStep === 0 
                ? 'opacity-0 pointer-events-none' 
                : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{_t('السابق', 'Back', 'Zurück')}</span>
          </button>

          {/* Next or Finish Button */}
          {currentStep < stepsCount - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={currentStep === 1 && !displayName.trim()}
              className="px-6 sm:px-7 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-primary hover:bg-primary/90 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
            >
              <span>{_t('التالي', 'Next', 'Weiter')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 sm:px-8 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-primary hover:bg-primary/90 shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <span>🚀</span>
              <span>{_t('ابدأ رحلة التدريس الآن', 'Start Teaching Now', 'Jetzt durchstarten!')}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
