import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  User, Globe, Coins, ChevronRight, ChevronLeft, Check, Sparkles, 
  Moon, Sun, Clock, Phone, MessageSquare, CreditCard, Video, Bell, 
  Heart, Upload, ArrowRight, ArrowLeft, ShieldCheck, Wallet, DollarSign, 
  Award, Calendar, CheckCircle2, RotateCcw, FileText, Volume2, 
  Layers, Palette, Star, Building2, BookOpen, UserCheck, School
} from 'lucide-react';
import { AppLanguage, AccentColor, NotificationSound, SchoolSettings, SchoolPeriodSettings, SchoolDayPresence } from '../types';
import { AvatarImage } from './AvatarImage';
import { motion, AnimatePresence } from 'motion/react';
import { getSchoolSettings, DEFAULT_SCHOOL_SETTINGS } from '../utils/schoolUtils';
import { isBackupFileSizeValid } from '../utils/backupEngine';
import { TeacherCrestLogo } from '../shared/components/TeacherCrestLogo';
import {
  signInTeacherWithGoogle,
  signInTeacherWithEmailPassword,
  createTeacherWithEmailPassword,
  subscribeTeacherAuth,
  getActiveCloudUser,
  downloadWorkspaceFromGoogleCloud,
  uploadWorkspaceToGoogleCloud,
  acknowledgeAppliedRemoteRevisions,
  isAndroidNativePlatform,
  getLastAndroidAuthDiagnostic,
  getAndroidApkSigningInfo,
  AndroidApkSigningInfo
} from '../services/firebaseWorkspaceSync';
import {
  enqueueDurablePendingRemoteItem,
  removeDurablePendingRemoteItem
} from '../hooks/useGoogleCloudWorkspaceSync';

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
    importBackupFile, performBackup, triggerToast, _t
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
  const [phone, setPhone] = useState(profile.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(profile.whatsappNumber || '');
  const [email, setEmail] = useState(profile.email || '');

  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [googleSignInError, setGoogleSignInError] = useState<string | null>(null);
  const [showUnauthorizedDomainHelper, setShowUnauthorizedDomainHelper] = useState(false);
  const [domainCopied, setDomainCopied] = useState(false);
  const [showAndroidShaHelper, setShowAndroidShaHelper] = useState(false);
  const [androidSigningInfo, setAndroidSigningInfo] = useState<AndroidApkSigningInfo | null>(null);
  const [shaCopiedField, setShaCopiedField] = useState<'sha1' | 'sha256' | 'pkg' | null>(null);
  const [setupEmailInput, setSetupEmailInput] = useState<string>(() => profile.email || 'zusammennachdeutschland@gmail.com');
  const [setupPasswordInput, setSetupPasswordInput] = useState<string>('');

  const [connectedGoogleUser, setConnectedGoogleUser] = useState<{
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null>(() => {
    const active = getActiveCloudUser();
    if (active) {
      return {
        displayName: active.displayName,
        email: active.email,
        photoURL: active.photoURL || null
      };
    }
    return null;
  });

  const applySignedInCloudUser = async (user: {
    uid?: string | null;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    phoneNumber?: string | null;
  }) => {
    const emailToUse = (user.email || email || '').trim();
    const fallbackNameFromEmail = emailToUse ? emailToUse.split('@')[0] : '';
    const nameToUse = (user.displayName || displayName || fallbackNameFromEmail || 'معلم Glück').trim();
    const photoToUse = user.photoURL || '';

    setShowAndroidShaHelper(false);
    setGoogleSignInError(null);
    setConnectedGoogleUser({
      displayName: nameToUse,
      email: emailToUse,
      photoURL: photoToUse || null
    });

    if (nameToUse) {
      setDisplayName(nameToUse);
      setDisplayNameAr(nameToUse);
      setDisplayNameEn(nameToUse);
    }
    if (emailToUse) {
      setEmail(emailToUse);
    }
    if (user.phoneNumber) {
      setPhone(user.phoneNumber);
      setWhatsappNumber(user.phoneNumber);
    }

    updateProfile({
      displayName: nameToUse || displayName || 'Teacher',
      displayNameAr: nameToUse || displayNameAr,
      displayNameEn: nameToUse || displayNameEn,
      email: emailToUse || email,
      avatarUrl: photoToUse || profile.avatarUrl,
      phone: user.phoneNumber || phone,
      whatsappNumber: user.phoneNumber || whatsappNumber,
      isGoogleConnected: true
    });

    if (triggerToast) {
      triggerToast(`تم تسجيل الدخول وربط الحساب (${emailToUse || nameToUse}) بسحابة الواجبات الأونلاين بنجاح ✓`);
    }
  };

  const loadAndroidDiagnosticHelper = async () => {
    const diag = getLastAndroidAuthDiagnostic();
    if (diag?.apkSha1 || diag?.apkSha256) {
      setAndroidSigningInfo({
        packageName: diag.packageName || 'com.glueck.teacher',
        apkSha1: diag.apkSha1,
        apkSha256: diag.apkSha256
      });
    } else {
      const info = await getAndroidApkSigningInfo();
      if (info) {
        setAndroidSigningInfo(info);
      }
    }
    setShowAndroidShaHelper(true);
  };

  const handleGoogleSetupSignIn = async () => {
    if (isGoogleSigningIn) return;
    setIsGoogleSigningIn(true);
    setGoogleSignInError(null);
    setShowUnauthorizedDomainHelper(false);
    try {
      const user = await signInTeacherWithGoogle();
      if (user) {
        await applySignedInCloudUser(user);
      } else if (isAndroidNativePlatform()) {
        await loadAndroidDiagnosticHelper();
        setGoogleSignInError(
          'لم يكتمل تسجيل الدخول عبر نافذة Google في أندرويد. راجع بصمة SHA-1 بالأسفل أو سجّل الدخول مباشرة بالبريد وكلمة المرور السحابية.'
        );
      }
    } catch (err: any) {
      const code = String(err?.code || '');
      const msg = String(err?.message || err || '');
      const isNative = isAndroidNativePlatform();

      if (isNative) {
        await loadAndroidDiagnosticHelper();
      }

      if (!isNative && (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain'))) {
        setShowUnauthorizedDomainHelper(true);
        setGoogleSignInError(null);
      } else if (code === 'NO_GOOGLE_ACCOUNT' || isNative) {
        setGoogleSignInError(
          'يلزم تفعيل بصمة شهادة التطبيق (SHA-1) في إعدادات Firebase، أو يمكنك تسجيل الدخول فوراً بالبريد وكلمة المرور السحابية بالأسفل.'
        );
      } else if (code === 'auth/network-request-failed' || msg.toLowerCase().includes('network')) {
        setGoogleSignInError('تعذر الاتصال بالإنترنت لإتمام تسجيل الدخول. يرجى التحقق من الشبكة.');
      } else {
        setGoogleSignInError('تعذر إتمام تسجيل الدخول بحساب Google حالياً. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleSetupEmailPasswordSignIn = async () => {
    const cleanEmail = setupEmailInput.trim().toLowerCase();
    const cleanPass = setupPasswordInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setGoogleSignInError('يرجى إدخال البريد الإلكتروني بشكل صحيح.');
      return;
    }
    if (cleanPass.length < 6) {
      setGoogleSignInError('يرجى إدخال كلمة مرور مكونة من 6 أحرف أو أرقام على الأقل.');
      return;
    }
    if (isGoogleSigningIn) return;
    setIsGoogleSigningIn(true);
    setGoogleSignInError(null);
    try {
      let user = null;
      try {
        user = await signInTeacherWithEmailPassword(cleanEmail, cleanPass);
      } catch (signInErr: any) {
        const errCode = String(signInErr?.code || '');
        if (
          errCode === 'auth/user-not-found' ||
          errCode === 'auth/invalid-credential' ||
          errCode === 'auth/invalid-login-credentials'
        ) {
          user = await createTeacherWithEmailPassword(cleanEmail, cleanPass);
        } else {
          throw signInErr;
        }
      }
      if (user) {
        setSetupPasswordInput('');
        await applySignedInCloudUser(user);
      }
    } catch (err: any) {
      const errCode = String(err?.code || '');
      if (errCode === 'auth/email-already-in-use' || errCode === 'auth/wrong-password') {
        setGoogleSignInError(
          'كلمة المرور غير مطابقة لهذا البريد، أو أن هذا البريد مرتبط بـ Google فقط (أضف بصمة SHA-1 الموضحة بالأسفل في Firebase لتفعيل زر Google).'
        );
      } else {
        setGoogleSignInError(err?.message || 'تعذر تسجيل الدخول بالبريد وكلمة المرور.');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  // Step 2: School Data State (NEW STEP)
  const [schoolName, setSchoolName] = useState(profile.schoolSettings?.schoolName || '');
  const [departmentName, setDepartmentName] = useState(profile.schoolSettings?.departmentName || '');
  const [academicYear, setAcademicYear] = useState(profile.schoolSettings?.academicYear || '2025 / 2026');
  const [currentTerm, setCurrentTerm] = useState(profile.schoolSettings?.currentTerm || 'الفصل الدراسي الأول');
  const [hodName, setHodName] = useState(profile.schoolSettings?.hodName || '');
  
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

  // Check if wizard should be open on initial load & subscribe to auth
  useEffect(() => {
    const rawPath = typeof window !== 'undefined' ? window.location.pathname || '' : '';
    const rawHash = typeof window !== 'undefined' ? window.location.hash || '' : '';
    const isHomeworkUrl =
      /(?:^|\/)(?:homework|Herr-Abdul-rahman)(\/|$)/i.test(rawPath) ||
      /(?:^|\/)(?:homework|Herr-Abdul-rahman)(\/|$)/i.test(rawHash.replace(/^#/, ''));
    if (isHomeworkUrl) {
      setIsOpen(false);
      return;
    }

    const hasValidProfile = Boolean(
      profile.displayName &&
      profile.displayName.trim() !== '' &&
      profile.displayName.trim() !== 'Teacher' &&
      profile.displayName.trim() !== 'أ. أحمد محمود'
    );
    if (!hasValidProfile) {
      setIsOpen(true);
    }

    const unsubAuth = subscribeTeacherAuth(async (u) => {
      if (u) {
        setConnectedGoogleUser({
          displayName: u.displayName,
          email: u.email,
          photoURL: u.photoURL || null
        });
        if (u.displayName && (!displayName || displayName === 'Teacher' || displayName === 'أ. أحمد محمود')) {
          setDisplayName(u.displayName);
          setDisplayNameAr(u.displayName);
          setDisplayNameEn(u.displayName);
        }
        if (u.email && !email) {
          setEmail(u.email);
        }
      } else {
        setConnectedGoogleUser(null);
      }
    });

    const handleCloseSetup = () => {
      setIsOpen(false);
    };
    window.addEventListener('close-setup-wizard', handleCloseSetup);

    return () => {
      unsubAuth();
      window.removeEventListener('close-setup-wizard', handleCloseSetup);
    };
  }, []);

  // Listen to manual open trigger from settings
  useEffect(() => {
    const handleManualOpen = () => {
      setIsOpen(true);
      setCurrentStep(0);
    };
    window.addEventListener('open-setup-wizard', handleManualOpen);
    return () => window.removeEventListener('open-setup-wizard', handleManualOpen);
  }, []);

  const isHomeworkRouteNow =
    typeof window !== 'undefined' &&
    (/(?:^|\/)(?:homework|Herr-Abdul-rahman)(\/|$)/i.test(window.location.pathname || '') ||
      /(?:^|\/)(?:homework|Herr-Abdul-rahman)(\/|$)/i.test((window.location.hash || '').replace(/^#/, '')));

  if (!isOpen || isHomeworkRouteNow) {
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
    if (!isBackupFileSizeValid(file.size)) {
      alert('حجم الملف أكبر من الحد المسموح (25 ميجابايت).');
      e.target.value = '';
      return;
    }
    setIsRestoring(true);
    try {
      const text = await file.text();
      const success = await importBackupFile(text);
      if (success) {
        localStorage.setItem('dl_setup_completed', 'true');
        setIsOpen(false);
        alert('أهلاً بك! تم استعادة بياناتك وجميع طلابك من ملف النسخ الاحتياطي بنجاح 🌟');
      } else {
        alert('فشل استعادة الملف. يرجى التأكد من أن ملف النسخ الاحتياطي صالح.');
      }
    } catch (err) {
      console.error('Failed to restore backup during setup:', err);
      alert('حدث خطأ أثناء قراءة ملف النسخ الاحتياطي.');
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const handleFinish = async () => {
    const finalDisplayName = displayName.trim() || 'Teacher';
    const finalEn = displayNameEn.trim() || (!/[\u0600-\u06FF]/.test(finalDisplayName) ? finalDisplayName : 'Herr ' + finalDisplayName);
    const finalAr = displayNameAr.trim() || (/[\u0600-\u06FF]/.test(finalDisplayName) ? finalDisplayName : 'أ. ' + finalDisplayName);

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
      schoolName: schoolName.trim(),
      departmentName: departmentName.trim(),
      academicYear: academicYear.trim() || '2025 / 2026',
      currentTerm: currentTerm.trim() || 'الفصل الدراسي الأول',
      hodName: hodName.trim(),
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
      avatarUrl: '',
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
    /* confetti removed */

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
    <div id="setup-wizard-overlay" className="fixed inset-0 z-[120] overflow-hidden bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-1.5 sm:p-5 font-sans">
      
      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-3xl max-h-[96dvh] sm:max-h-[92dvh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header with Stepper */}
        <div className="px-3 sm:px-6 pt-2.5 sm:pt-4 pb-2 sm:pb-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90">
          <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <TeacherCrestLogo size="xs" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">
                    Glück Teacher
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                    {_t('الإعداد', 'Setup', 'Setup')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                  {stepTitles[currentStep].title}
                </p>
              </div>
            </div>

            {/* Step Counter Badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700 shrink-0">
              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                {currentStep + 1} / {stepsCount}
              </span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="relative w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="absolute top-0 bottom-0 left-0 bg-primary rounded-full"
              initial={false}
              animate={{ width: `${((currentStep + 1) / stepsCount) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          </div>

          {/* Desktop Stepper Interactive Pills */}
          <div className="hidden sm:flex items-center justify-between gap-1 overflow-x-auto no-scrollbar pt-2">
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
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isCurrent 
                      ? 'bg-primary text-white shadow-xs ring-1 ring-primary/20' 
                      : isPast 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 cursor-pointer' 
                      : 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span className="text-[11px]">{isPast ? '✓' : step.icon}</span>
                  <span className="text-[11px]">{step.title}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile Stepper Mini Dots */}
          <div className="flex sm:hidden items-center justify-center gap-1.5 pt-1.5">
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
                  className={`h-1.5 rounded-full transition-all ${
                    isCurrent 
                      ? 'w-5 bg-primary' 
                      : isPast 
                      ? 'w-1.5 bg-emerald-500 cursor-pointer' 
                      : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                  }`}
                  title={step.title}
                />
              );
            })}
          </div>
        </div>

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-7 py-2.5 sm:py-4">
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
                <div className="space-y-3 sm:space-y-3.5">
                  {/* Welcome Dedication & Supplication Banner */}
                  <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-primary/10 to-teal-500/10 border border-emerald-500/25 dark:border-emerald-500/35 text-center space-y-1 shadow-2xs">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10.5px] font-black">
                      <span>✨</span>
                      <span>{_t('إهداء وتصميم المنظومة: أ/ عبدالرحمن غريب', 'Glück Teacher • Designed by Abdelrahman Gharib', 'Entworfen von Abdelrahman Gharib')}</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed max-w-xl mx-auto">
                      {_t(
                        'نسألكم خالص وصالح الدعاء له ولوالديه بظهر الغيب بالتوفيق والبركة والقبول وجزيل الأجر والثواب 🤲',
                        'Kindly keep him and his parents in your sincere prayers for blessing and success 🤲',
                        'Bitte schließen Sie ihn und seine Eltern in Ihre aufrichtigen Gebete ein 🤲'
                      )}
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>🎨</span>
                      <span>{_t('اختر اللغة والمظهر والعملة', 'Language, Theme & Currency', 'Sprache, Design & Währung')}</span>
                    </h2>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {_t('حدد لغة العرض ونمط الألوان والعملة الافتراضية لمنصتك.', 'Select your interface language, color scheme, and primary currency.', 'Wählen Sie Ihre bevorzugte Sprache und Währung.')}
                    </p>
                  </div>

                  {/* Language Selector Cards */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('لغة واجهة التطبيق', 'App Interface Language', 'Oberflächensprache')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
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
                          className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                            language === langItem.id 
                              ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/20 text-primary' 
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-lg sm:text-xl">{langItem.flag}</span>
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{langItem.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{langItem.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme & Currency Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Theme Mode */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {_t('نمط الألوان', 'Color Theme', 'Farbschema')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDarkMode(false);
                            if (theme === 'dark') toggleTheme();
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all ${
                            !isDarkMode 
                              ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20' 
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          <span>{_t('فاتح', 'Light', 'Hell')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDarkMode(true);
                            if (theme === 'light') toggleTheme();
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all ${
                            isDarkMode 
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20' 
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{_t('داكن', 'Dark', 'Dunkel')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Currency */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {_t('العملة الأساسية', 'Primary Currency', 'Hauptwährung')}
                      </label>
                      <div className="relative">
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                        >
                          <option value="EGP">EGP (ج.م - الجنيه المصري)</option>
                          <option value="EUR">EUR (€ - Euro)</option>
                          <option value="USD">USD ($ - US Dollar)</option>
                          <option value="SAR">SAR (ر.س - الريال السعودي)</option>
                          <option value="AED">AED (د.إ - الدرهم الإماراتي)</option>
                          <option value="KWD">KWD (د.ك - الدينار الكويتي)</option>
                        </select>
                        <Coins className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Accent Colors Palette */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('اللون المميز (Accent Color)', 'Accent Highlight Color', 'Akzentfarbe')}
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ACCENT_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => {
                            setLocalAccent(col.id);
                            setAccentColor(col.id);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            accent === col.id ? 'ring-2 ring-primary/40 scale-110 shadow-2xs' : 'hover:scale-105 opacity-80'
                          }`}
                          style={{ backgroundColor: col.hex }}
                          title={col.name}
                        >
                          {accent === col.id && <Check className="w-3 h-3 text-white drop-shadow" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 1: TEACHER PROFILE ================= */}
              {currentStep === 1 && (
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="space-y-0.5">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>👤</span>
                      <span>{_t('هوية المعلم وبيانات التواصل', 'Teacher Profile & Contacts', 'Lehrer-Profil & Kontakt')}</span>
                    </h2>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight">
                      {_t('تُستخدم هذه البيانات في إصدار الشهادات، وتذييل التقارير، وتذكيرات أولياء الأمور.', 'Used in certificate issuance, report headers, and parent communications.', 'Wird für Zertifikate und Elternberichte verwendet.')}
                    </p>
                  </div>

                  {/* Google Connected Status or Sign-In Banner */}
                  {connectedGoogleUser ? (
                    <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {connectedGoogleUser.photoURL ? (
                            <img
                              src={connectedGoogleUser.photoURL}
                              alt={connectedGoogleUser.displayName || 'Google'}
                              className="w-11 h-11 rounded-full border-2 border-emerald-500 shadow-xs object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-base shrink-0">
                              ✓
                            </div>
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                                {_t('تم تسجيل الدخول وربط الحساب السحابي بنجاح ✓', 'Connected to Google Account ✓', 'Mit Google verbunden ✓')}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                نشط
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {connectedGoogleUser.displayName || displayName || 'معلم Glück'}
                            </p>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono truncate">
                              {connectedGoogleUser.email || email}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleGoogleSetupSignIn}
                          disabled={isGoogleSigningIn}
                          className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
                          title={_t('تغيير الحساب', 'Change Account', 'Konto wechseln')}
                        >
                          {isGoogleSigningIn ? '...' : _t('تغيير', 'Change', 'Wechseln')}
                        </button>
                      </div>

                      <div className="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                          {_t('تم استيراد بياناتك بنجاح! يمكنك الدخول مباشرة للبرنامج أو المتابعة لتعديل باقي البيانات.', 'Profile loaded! Enter directly or proceed to adjust settings.', 'Profil geladen! Treten Sie direkt ein oder passen Sie die Einstellungen an.')}
                        </span>
                        <button
                          type="button"
                          onClick={handleFinish}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                        >
                          <span>دخول البرنامج والمتابعة فوراً 🚀</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-primary/10 border border-primary/30 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span>🌐</span>
                          <span>{_t('تسجيل الدخول وجلب البيانات من جوجل', 'Sign in & Auto-fill from Google', 'Mit Google anmelden')}</span>
                        </div>
                        <p className="text-[10.5px] text-slate-600 dark:text-slate-400">
                          {_t('استورد اسمك، صورتك، وبريدك الإلكتروني فورياً بضغطة زر واحدة.', 'Instantly import your name, photo, and email with 1 click.', 'Importieren Sie Ihr Profil direkt.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isGoogleSigningIn}
                        onClick={handleGoogleSetupSignIn}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs active:scale-95"
                      >
                        {isGoogleSigningIn ? (
                          <div className="w-4 h-4 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        )}
                        <span>{_t('تسجيل بـ Google', 'Google Login', 'Google-Login')}</span>
                      </button>
                    </div>
                  )}
                  {googleSignInError && (
                    <p className="text-[11px] text-red-500 font-medium px-1">
                      {googleSignInError}
                    </p>
                  )}

                  {showAndroidShaHelper && !connectedGoogleUser && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
                      <div className="space-y-1">
                        <div className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center justify-between gap-2">
                          <span>📱 {_t('تفعيل دخول Google على أندرويد (SHA-1) + الدخول المباشر', 'Android Google Login SHA-1 & Direct Sign-In', 'Android SHA-1 & Direkt-Login')}</span>
                          <button
                            type="button"
                            onClick={() => setShowAndroidShaHelper(false)}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-white px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {_t(
                            'لتفعيل الدخول بزر Google على أندرويد، أضف بصمة SHA-1 التالية لتطبيق com.glueck.teacher في إعدادات مشروع Firebase (glueck-c8621):',
                            'To enable 1-tap Google login on Android, add this SHA-1 fingerprint for com.glueck.teacher in Firebase Project Settings:',
                            'Fügen Sie diesen SHA-1-Fingerabdruck in Firebase hinzu:'
                          )}
                        </p>
                      </div>

                      {androidSigningInfo?.apkSha1 && (
                        <div className="bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <code dir="ltr" className="font-mono font-bold text-emerald-700 dark:text-emerald-400 break-all">
                            {androidSigningInfo.apkSha1}
                          </code>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (androidSigningInfo.apkSha1) {
                                  navigator.clipboard?.writeText(androidSigningInfo.apkSha1);
                                  setShaCopiedField('sha1');
                                  setTimeout(() => setShaCopiedField(null), 2000);
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold rounded-lg cursor-pointer"
                            >
                              {shaCopiedField === 'sha1' ? _t('تم النسخ ✓', 'Copied ✓', 'Kopiert ✓') : _t('نسخ SHA-1', 'Copy SHA-1', 'SHA-1 kopieren')}
                            </button>
                            <a
                              href="https://console.firebase.google.com/project/glueck-c8621/settings/general"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-primary/15 text-primary font-bold rounded-lg hover:underline"
                            >
                              Firebase ↗
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-amber-500/20 space-y-2">
                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          🔑 {_t('أو سجّل الدخول وجلب بياناتك السحابية فوراً بالبريد وكلمة المرور:', 'Or sign in and restore cloud data immediately with Email & Password:', 'Oder direkt per E-Mail & Passwort anmelden:')}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="email"
                            dir="ltr"
                            value={setupEmailInput}
                            onChange={(e) => setSetupEmailInput(e.target.value)}
                            placeholder="zusammennachdeutschland@gmail.com"
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none"
                          />
                          <input
                            type="password"
                            dir="ltr"
                            value={setupPasswordInput}
                            onChange={(e) => setSetupPasswordInput(e.target.value)}
                            placeholder={_t('كلمة المرور (6 أحرف فأكثر)', 'Password', 'Passwort')}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                          />
                          <button
                            type="button"
                            disabled={isGoogleSigningIn}
                            onClick={handleSetupEmailPasswordSignIn}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer"
                          >
                            {_t('دخول وجلب البيانات الآن', 'Sign In & Restore', 'Jetzt anmelden')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showUnauthorizedDomainHelper && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
                      <div className="space-y-1">
                        <div className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>
                            {_t(
                              'تفعيل الدومين في إعدادات مصادقة Firebase',
                              'Authorize Domain in Firebase Auth Settings',
                              'Domain in Firebase Auth autorisieren'
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {_t(
                            'لتسجيل الدخول بحساب Google بأمان من هذا الرابط، يرجى إضافة الدومين الحالي إلى قائمة Authorized Domains في إعدادات Firebase Authentication:',
                            'To sign in securely with Google from this URL, please add this domain to Authorized Domains in Firebase Authentication settings:',
                            'Um sich sicher mit Google anzumelden, fügen Sie diese Domain in den Firebase Authentication-Einstellungen hinzu:'
                          )}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500 dark:text-slate-400">
                        <span>
                          {_t('لتفعيل نافذة جوجل على هذا الدومين:', 'To authorize this domain in Firebase:', 'Domain in Firebase autorisieren:')}{' '}
                          <code className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {typeof window !== 'undefined' ? window.location.hostname : ''}
                          </code>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                navigator.clipboard?.writeText(window.location.hostname);
                                setDomainCopied(true);
                                setTimeout(() => setDomainCopied(false), 2000);
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg cursor-pointer"
                          >
                            {domainCopied ? _t('تم النسخ ✓', 'Copied ✓', 'Kopiert ✓') : _t('نسخ الدومين', 'Copy Domain', 'Domain kopieren')}
                          </button>
                          <a
                            href="https://console.firebase.google.com/project/glueck-c8621/authentication/settings"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-primary/15 text-primary font-bold rounded-lg hover:underline"
                          >
                            {_t('إعدادات Firebase ↗', 'Firebase Auth Settings ↗', 'Firebase-Einstellungen ↗')}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Restore from Backup File Card */}
                  <div className="bg-surface-hover/60 border border-surface-border rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <span>📁</span>
                        <span>{_t('استعادة البيانات من ملف نسخ احتياطي', 'Restore from Backup File', 'Aus Backup wiederherstellen')}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-600 dark:text-slate-400">
                        {_t('استعد جميع طلابك، مجموعاتك، وحصصك مباشرة من ملف النسخ الاحتياطي.', 'Restore all your students, groups, and lessons from a backup file.', 'Stellen Sie alle Daten aus einer Backup-Datei wieder her.')}
                      </p>
                    </div>
                    <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs active:scale-95">
                      <Upload className="w-4 h-4 shrink-0" />
                      <span>{_t('استعادة ملف', 'Restore File', 'Wiederherstellen')}</span>
                      <input
                        type="file"
                        accept=".json,.txt"
                        ref={fileInputRef}
                        onChange={handleRestoreBackup}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Names - Primary Input Focus */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {_t('الاسم الأساسي (يظهر في القوائم والتطبيق) *', 'Display Name (Main) *', 'Anzeigename *')}
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (displayName.trim()) handleNext();
                            }
                          }}
                          placeholder="مثال: أ. عمر حسن / Herr Omar"
                          className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                          autoFocus
                        />
                      </div>
                      {!displayName.trim() && (
                        <p className="text-[10.5px] text-red-500 mt-0.5 font-medium">
                          {_t('يرجى إدخال اسم المعلم للمتابعة', 'Teacher name is required to proceed.', 'Bitte geben Sie den Lehrernamen ein.')}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                          📜 {_t('الاسم بالألمانية/الإنجليزية (للشهادات)', 'German/English Name (Certificates)', 'Name für Zertifikate')}
                        </label>
                        <input
                          type="text"
                          value={displayNameEn}
                          onChange={(e) => setDisplayNameEn(e.target.value)}
                          placeholder="e.g. Herr Omar Hassan"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                          📊 {_t('الاسم بالعربية (للتقارير والواتساب)', 'Arabic Name (Reports & Parent msgs)', 'Arabischer Name')}
                        </label>
                        <input
                          type="text"
                          value={displayNameAr}
                          onChange={(e) => setDisplayNameAr(e.target.value)}
                          placeholder="مثال: أ. عمر حسن"
                          dir="rtl"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Contacts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          📱 {_t('رقم الواتساب للتواصل', 'WhatsApp Number', 'WhatsApp-Nummer')}
                        </label>
                        <div className="relative">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-500 absolute left-3 top-2" />
                          <input
                            type="tel"
                            value={whatsappNumber}
                            onChange={(e) => setWhatsappNumber(e.target.value)}
                            placeholder="+20 10 1234 5678"
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          📞 {_t('رقم الهاتف الأساسي', 'Primary Phone', 'Telefonnummer')}
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="01012345678"
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 2: SCHOOL & ACADEMIC DATA ================= */}
              {currentStep === 2 && (
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="space-y-0.5">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>🏫</span>
                      <span>{_t('بيانات المدرسة والجدول المدرسي', 'School & Academic Profile', 'Schuldaten & Stundenplan')}</span>
                    </h2>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {_t('سجّل اسم المدرسة، القسم، العام الدراسي، ومواعيد الحصص المدرسية لتنظيم جدول الحصص والتقارير.', 'Register school name, department, academic year, and period timings for reports.', 'Geben Sie Schulname, Fachabteilung und Stundenplan ein.')}
                    </p>
                  </div>

                  {/* School & Department Identifiers */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          🏫 {_t('اسم المدرسة', 'School Name', 'Schulname')}
                        </label>
                        <input
                          type="text"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          placeholder="مثال: مدرسة الأورمان الرسمية لغات"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          📖 {_t('القسم / المادة التعليمية', 'Department / Subject', 'Fachabteilung')}
                        </label>
                        <input
                          type="text"
                          value={departmentName}
                          onChange={(e) => setDepartmentName(e.target.value)}
                          placeholder="مثال: قسم اللغة الألمانية (Deutsch)"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          📅 {_t('العام الدراسي', 'Academic Year', 'Schuljahr')}
                        </label>
                        <input
                          type="text"
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          placeholder="2025 / 2026"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          🗓️ {_t('الفصل الدراسي', 'Current Term', 'Semester / Halbjahr')}
                        </label>
                        <select
                          value={currentTerm}
                          onChange={(e) => setCurrentTerm(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="الفصل الدراسي الأول">الفصل الدراسي الأول (Term 1)</option>
                          <option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني (Term 2)</option>
                          <option value="العام بالكامل">العام بالكامل (Full Year)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                          👔 {_t('المشرف / رئيس القسم (HOD)', 'HOD / Supervisor', 'Fachleiter')}
                        </label>
                        <input
                          type="text"
                          value={hodName}
                          onChange={(e) => setHodName(e.target.value)}
                          placeholder="مثال: أ/ محمد عبد الله"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* School Days & Periods Timing */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {_t('أيام الحضور والجدول في المدرسة', 'School Attendance Days', 'Schultage')}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
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
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                isSelected 
                                  ? 'bg-primary text-white shadow-2xs ring-1 ring-primary/20' 
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

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                          ⏰ {_t('وقت الحضور', 'Arrival', 'Ankunft')}
                        </label>
                        <input
                          type="time"
                          value={schoolArrivalTime}
                          onChange={(e) => setSchoolArrivalTime(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                          ⏰ {_t('الانصراف', 'Departure', 'Abfahrt')}
                        </label>
                        <input
                          type="time"
                          value={schoolDepartureTime}
                          onChange={(e) => setSchoolDepartureTime(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                          🔢 {_t('عدد الحصص', 'Periods', 'Stunden')}
                        </label>
                        <select
                          value={periodsCount}
                          onChange={(e) => setPeriodsCount(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white"
                        >
                          <option value={6}>6 حصص</option>
                          <option value={7}>7 حصص</option>
                          <option value={8}>8 حصص</option>
                          <option value={9}>9 حصص</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                          🔔 {_t('الحصة الأولى', '1st Period', '1. Stunde')}
                        </label>
                        <input
                          type="time"
                          value={firstPeriodStart}
                          onChange={(e) => setFirstPeriodStart(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                          ⏱️ {_t('مدة الحصة', 'Duration', 'Dauer')}
                        </label>
                        <select
                          value={periodDuration}
                          onChange={(e) => setPeriodDuration(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white"
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
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="space-y-0.5">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>💳</span>
                      <span>{_t('قنوات الدفع واستلام المصروفات', 'Payment & Collection Channels', 'Zahlungskanäle')}</span>
                    </h2>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {_t('تُدرج هذه البيانات تلقائياً في رسائل تذكير السداد وإشعارات أولياء الأمور لتسهيل التحصيل.', 'Automatically attached to invoice messages & payment reminders for parents.', 'Wird automatisch an Zahlungserinnerungen angehängt.')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* InstaPay */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-5 h-5 rounded-md bg-pink-500/10 text-pink-500 flex items-center justify-center font-black text-xs">⚡</span>
                        <span className="text-[11px]">{_t('عنوان إنستاباي (InstaPay ID / IPA)', 'InstaPay ID / Address', 'InstaPay')}</span>
                      </div>
                      <input
                        type="text"
                        value={instaPayId}
                        onChange={(e) => setInstaPayId(e.target.value)}
                        placeholder="e.g. omar@instapay"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-pink-500"
                      />
                    </div>

                    {/* Vodafone Cash */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-5 h-5 rounded-md bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs">📱</span>
                        <span className="text-[11px]">{_t('فودافون كاش / محفظة إلكترونية', 'Vodafone Cash / Wallet', 'Mobile Wallet')}</span>
                      </div>
                      <input
                        type="tel"
                        value={vodafoneCashNumber}
                        onChange={(e) => setVodafoneCashNumber(e.target.value)}
                        placeholder="e.g. 01012345678"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>

                    {/* Bank Account */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-xs">🏦</span>
                        <span className="text-[11px]">{_t('الحساب البنكي / IBAN', 'Bank Account / IBAN', 'Bankkonto')}</span>
                      </div>
                      <input
                        type="text"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        placeholder="e.g. CIB / NBE / QNB - 1000..."
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Payment Link */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-xs">🔗</span>
                        <span className="text-[11px]">{_t('رابط دفع خارجي أو تفاصيل أخرى', 'Payment Link / Note', 'Zahlungslink')}</span>
                      </div>
                      <input
                        type="text"
                        value={paymentLink}
                        onChange={(e) => setPaymentLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Auto-create finance accounts toggle */}
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                        💼
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {_t('تهيئة الحسابات المالية الافتراضية تلقائياً', 'Auto-create Standard Finance Accounts', 'Finanzkonten automatisch erstellen')}
                        </h4>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400">
                          {_t('إنشاء حساب "الخزينة كاش" ومحفظة فودافون كاش في النظام المالي للبدء فوراً.', 'Initializes Cash Drawer & Wallet in the Finance Center.', 'Erstellt Bargeld- & Wallet-Konten.')}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoCreateFinanceAccounts}
                      onChange={(e) => setAutoCreateFinanceAccounts(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ================= STEP 4: SCHEDULE & WORKING DAYS ================= */}
              {currentStep === 4 && (
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="space-y-0.5">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>⏰</span>
                      <span>{_t('جدول الحصص الخاصة وحصص الأونلاين', 'Tutoring Schedule & Online Links', 'Privatunterricht & Online-Links')}</span>
                    </h2>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {_t('حدد أيام وساعات العمل المعتادة لتنظيم جدول الدروس الخصوصية والروابط الثابتة.', 'Set your private tutoring days, work hours, and permanent virtual class links.', 'Legen Sie Unterrichtstage und Standard-Links fest.')}
                    </p>
                  </div>

                  {/* Days Selector */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('أيام تدريس الدروس الخصوصية', 'Active Tutoring Days', 'Unterrichtstage')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = selectedDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => toggleDaySelection(day.key)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isSelected 
                                ? 'bg-primary text-white shadow-2xs ring-1 ring-primary/20' 
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        {_t('بداية وقت العمل', 'Start Time', 'Startzeit')}
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        {_t('نهاية وقت العمل', 'End Time', 'Endzeit')}
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        {_t('مدة الحصة الافتراضية', 'Default Duration', 'Dauer')}
                      </label>
                      <select
                        value={defaultDuration}
                        onChange={(e) => setDefaultDuration(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                      >
                        <option value={45}>45 {_t('دقيقة', 'min', 'Min')}</option>
                        <option value={60}>60 {_t('دقيقة', 'min', 'Min')}</option>
                        <option value={90}>90 {_t('دقيقة', 'min', 'Min')}</option>
                        <option value={120}>120 {_t('دقيقة', 'min', 'Min')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Virtual Class Links */}
                  <div className="space-y-1.5 pt-0.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {_t('روابط الحصص الافتراضية الثابتة (أونلاين)', 'Default Online Meeting Links', 'Online-Unterrichtslinks')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                          <Video className="w-3 h-3" />
                          <span>Zoom Meeting Link</span>
                        </div>
                        <input
                          type="url"
                          value={defaultZoomLink}
                          onChange={(e) => setDefaultZoomLink(e.target.value)}
                          placeholder="https://zoom.us/j/..."
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                          <Video className="w-3 h-3" />
                          <span>Google Meet Link</span>
                        </div>
                        <input
                          type="url"
                          value={defaultMeetLink}
                          onChange={(e) => setDefaultMeetLink(e.target.value)}
                          placeholder="https://meet.google.com/..."
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 5: SMART ALERTS & INSPIRATION ================= */}
              {currentStep === 5 && (
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="space-y-0.5">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>🔔</span>
                      <span>{_t('التنبيهات الذكية ورسائل التفاؤل والبركة', 'Smart Alerts & Daily Inspiration', 'Erinnerungen & Inspiration')}</span>
                    </h2>
                    <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {_t('تنبيهك قبل موعد بدء الحصة ورسائل التفاؤل والبركة اليومية لبداية موفقة.', 'Timely alerts before sessions and daily motivational teacher quotes.', 'Rechtzeitige Erinnerungen und tägliche Inspiration.')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {/* Lesson alerts card */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                            <Bell className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {_t('تنبيهات اقتراب موعد الحصة', 'Upcoming Lesson Reminders', 'Unterrichtserinnerung')}
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              {_t('إشعار على الجهاز قبل بدء الحصة بالوقت المحدد', 'Get notified before class begins', 'Benachrichtigung vor Unterrichtsbeginn')}
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={enableLessonAlerts}
                          onChange={(e) => setEnableLessonAlerts(e.target.checked)}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                      </div>

                      {enableLessonAlerts && (
                        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                              {_t('التنبيه قبل الحصة بـ:', 'Alert before class:', 'Erinnern vor:')}
                            </span>
                            <select
                              value={alertMinutesBefore}
                              onChange={(e) => setAlertMinutesBefore(Number(e.target.value))}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                            >
                              <option value={5}>5 {_t('دقائق', 'mins', 'Min')}</option>
                              <option value={10}>10 {_t('دقائق', 'mins', 'Min')}</option>
                              <option value={15}>15 {_t('دقيقة', 'mins', 'Min')}</option>
                              <option value={30}>30 {_t('دقيقة', 'mins', 'Min')}</option>
                              <option value={60}>60 {_t('دقيقة (ساعة)', 'mins (1h)', '60 Min')}</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                              {_t('نغمة التنبيه:', 'Alert sound:', 'Ton:')}
                            </span>
                            <select
                              value={notificationSound}
                              onChange={(e) => setNotificationSound(e.target.value as NotificationSound)}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
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
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <Heart className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {_t('رسائل التفاؤل والبركة اليومية', 'Daily Inspiration & Blessing Quotes', 'Tägliche Inspiration & Motivation')}
                          </h4>
                          <p className="text-[10px] text-slate-500">
                            {_t('عرض عبارات تشجيعية وتذكيرية بالخير عند فتح التطبيق يومياً', 'Daily motivating quotes for the teacher', 'Tägliche ermutigende Zitate')}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableInspiration}
                        onChange={(e) => setEnableInspiration(e.target.checked)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* Daily Summary card */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {_t('إشعار التقرير المسائي اليومي (الساعة 8 مساءً)', 'Daily Summary Alert (8:00 PM)', 'Täglicher Abendbericht (20:00 Uhr)')}
                          </h4>
                          <p className="text-[10px] text-slate-500">
                            {_t('ملخص سريع للحصص المنفذة والمدفوعات المحصلة اليوم', 'Summary of today\'s lessons and income', 'Übersicht des Tages und Einnahmen')}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableDailySummary}
                        onChange={(e) => setEnableDailySummary(e.target.checked)}
                        className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================= STEP 6: SUMMARY & READY TO LAUNCH ================= */}
              {currentStep === 6 && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="text-center space-y-0.5">
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-xl mx-auto shadow-sm mb-1">
                      🚀
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {_t('أنت الآن جاهز للانطلاق!', 'You are all set!', 'Alles ist bereit!')}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      {_t('تم إعداد كافة متطلبات منصتك التعليمية بنجاح. راجع بطاقة المعلم والمدرسة أدناه ثم اضغط ابدأ.', 'Your teaching workspace is now fully configured and ready for action.', 'Ihr digitaler Lehrarbeitsplatz ist einsatzbereit.')}
                    </p>
                  </div>

                  {/* Teacher & School Preview Card */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-900 text-white shadow-lg relative overflow-hidden border border-slate-800">
                    <div className="space-y-2.5">
                      
                      {/* Teacher Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                            <AvatarImage name={displayName || 'Teacher'} className="w-full h-full rounded-xl text-sm font-black" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white">
                              {displayName || 'Teacher'}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                              <span>{displayNameEn || displayName}</span>
                              {displayNameAr && <span>• {displayNameAr}</span>}
                            </div>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          Active Teacher 🇩🇪
                        </span>
                      </div>

                      {/* School & Department Badge */}
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🏫</span>
                          <div>
                            <span className="font-bold text-white block text-[11.5px]">{schoolName || _t('اسم المدرسة غير محدد', 'School not specified', 'Schule nicht angegeben')}</span>
                            <span className="text-[10px] text-slate-300">{departmentName ? `${departmentName} • ` : ''}{academicYear}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9.5px] text-slate-400 block">{_t('رئيس القسم (HOD)', 'HOD', 'Fachleiter')}</span>
                          <span className="font-bold text-[11px] text-slate-200">{hodName || '-'}</span>
                        </div>
                      </div>

                      {/* Meta stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1.5 border-t border-white/10 text-xs">
                        <div className="bg-white/5 p-1.5 rounded-lg">
                          <span className="text-[9.5px] text-slate-400 block">{_t('اللغة', 'Language', 'Sprache')}</span>
                          <span className="font-bold text-[11px]">{language.toUpperCase()}</span>
                        </div>
                        <div className="bg-white/5 p-1.5 rounded-lg">
                          <span className="text-[9.5px] text-slate-400 block">{_t('العملة', 'Currency', 'Währung')}</span>
                          <span className="font-bold text-[11px]">{currency}</span>
                        </div>
                        <div className="bg-white/5 p-1.5 rounded-lg">
                          <span className="text-[9.5px] text-slate-400 block">{_t('أيام الدروس', 'Tutoring Days', 'Tage')}</span>
                          <span className="font-bold text-[11px]">{selectedDays.length} {_t('أيام', 'days', 'Tage')}</span>
                        </div>
                        <div className="bg-white/5 p-1.5 rounded-lg">
                          <span className="text-[9.5px] text-slate-400 block">{_t('أيام المدرسة', 'School Days', 'Schultage')}</span>
                          <span className="font-bold text-[11px]">{schoolPresenceDays.length} {_t('أيام', 'days', 'Tage')}</span>
                        </div>
                      </div>

                      {(instaPayId || vodafoneCashNumber) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {instaPayId && (
                            <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 text-[10px] font-semibold">
                              ⚡ InstaPay: {instaPayId}
                            </span>
                          )}
                          {vodafoneCashNumber && (
                            <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-semibold">
                              📱 Cash: {vodafoneCashNumber}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Restore backup alternative prompt */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11.5px]">
                          {_t('هل لديك ملف نسخة احتياطية سابقة؟', 'Already have a backup file?', 'Haben Sie ein Backup?')}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {_t('يمكنك استعادة بياناتك بالكامل بضغطة زر وتخطي الإعداد.', 'Restore your data directly from file.', 'Daten direkt aus Backup laden.')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRestoring}
                      className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
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

                  {/* Dedication and Prayer Card */}
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 text-center space-y-0.5">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                      {_t('برنامج Glück Teacher • فكرة وتصميم: عبدالرحمن غريب', 'Glück Teacher • Designed by Abdelrahman Gharib', 'Glück Teacher • Entworfen von Abdelrahman Gharib')}
                    </p>
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 font-medium">
                      {_t('برجاء خالص وصالح الدعاء له ولوالديه بظهر الغيب بالتوفيق والبركة والقبول وجزيل الأجر والثواب 🤲', 'Kindly keep him in your sincere prayers for blessings, success, and acceptance.', 'Bitte denken Sie an ihn in Ihren aufrichtigen Gebeten.')}
                    </p>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-3.5 sm:px-6 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          {/* Previous Button */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
              currentStep === 0 
                ? 'opacity-0 pointer-events-none' 
                : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{_t('السابق', 'Back', 'Zurück')}</span>
          </button>

          {/* Next or Finish Button */}
          {currentStep < stepsCount - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={currentStep === 1 && !displayName.trim()}
              className="px-5 sm:px-7 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm text-white bg-primary hover:bg-primary/90 shadow-xs transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
            >
              <span>{_t('التالي', 'Next', 'Weiter')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-5 sm:px-7 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm text-white bg-primary hover:bg-primary/90 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
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
