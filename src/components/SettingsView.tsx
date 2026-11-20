import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AppLanguage, Lesson } from '../types';
import {
  User,
  Globe,
  Moon,
  Sun,
  DollarSign,
  Check,
  CheckCircle2,
  HardDrive,
  Trash2,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ShieldCheck,
  Info,
  Copy,
  Save,
  Phone,
  ExternalLink,
  BookOpen,
  FileText,
  Bell,
  CheckSquare,
  XCircle,
  Award,
  Sparkles,
  Star,
  Plus,
  Pencil,
  RotateCcw,
  Heart,
  Zap,
  Smartphone,
  Palette,
  FolderOpen,
  Cloud,
  Video
} from 'lucide-react';
import { NotificationSettingsSection } from './NotificationSettingsSection';
import { SmartBackupCenter } from './SmartBackupCenter';
import { DataHealthCenterModal } from './DataHealthCenterModal';
import { SchoolSettingsSection } from './SchoolSettingsSection';
import { TeacherProfileSection } from './TeacherProfileSection';
import { COLOR_FAMILIES, getContrastTextColor } from '../utils/colorUtils';
import { CustomColorPickerModal } from './CustomColorPickerModal';
import { ContactsUnificationModal } from './ContactsUnificationModal';
import { DownloadedFilesSection } from './DownloadedFilesSection';
import { GoogleCloudSyncCard } from './GoogleCloudSyncCard';
import { GrainSettingsCard } from './GrainSettingsCard';
import { ZoomIntegrationsManager } from './ZoomIntegrationsManager';
import { getActiveCloudUser, subscribeTeacherAuth } from '../services/firebaseWorkspaceSync';
import { getDownloadedFilesRegistry } from '../services/downloadedFilesService';
import { loadZoomUiMeta } from '../services/zoomService';
import { loadGrainIntegrationMeta } from '../services/grainService';
import { getPendingHomeworkSyncCount } from '../shared/homeworkStorageSync';
import { APP_VERSION, APP_BUILD_NUMBER, formatAppBuildTimestamp, getRuntimeAppInfo } from '../shared/appVersion';
import { TeacherCrestLogo } from '../shared/components/TeacherCrestLogo';

type SettingsCategory =
  | 'profile'
  | 'school'
  | 'payment'
  | 'grain'
  | 'cloud'
  | 'messages'
  | 'contacts'
  | 'language'
  | 'notifications'
  | 'inspiration'
  | 'downloaded_files'
  | 'backup'
  | 'about'
  | 'keystore'
  | 'danger';

type SettingsGroupFilter =
  | 'teaching'
  | 'integrations'
  | 'personalize'
  | 'data'
  | 'system';

interface SettingsItemConfig {
  id: SettingsCategory;
  group: SettingsGroupFilter;
  title: string;
  description: string;
  icon: React.ElementType;
  metaText?: string;
  showAccentDot?: boolean;
  keywords: string;
}

const DEFAULT_PARENT_TEMPLATES: Record<string, string> = {
  homework: 'السلام عليكم ورحمة الله وبركاته،\n\nأود إحاطة حضرتك علماً بأن الطالب/ة {student_name} (مجموعة: {group_name}) قد استلم واجب الدرس الجديد بتاريخ {date}. يرجى المتابعة وحل الواجب قبل الحصة القادمة.\n\nمع تحيات: {teacher_name}',
  attendance: 'السلام عليكم ورحمة الله وبركاته،\n\nأفيد حضرتك بحضور الطالب/ة {student_name} بحصة {group_name} اليوم {date}، وكان تفاعله ممتازاً مع الشرح.\n\nشكراً لمتابعة حضرتك: {teacher_name}',
  absence: 'السلام عليكم ورحمة الله وبركاته،\n\nأود إحاطة حضرتك بعدم حضور الطالب/ة {student_name} لحصة {group_name} المقررة اليوم {date}. يرجى التواصل معنا للتنسيق والاطمئنان.\n\nمع تحيات: {teacher_name}',
  payment: 'السلام عليكم ورحمة الله وبركاته،\n\nأود تذكير حضرتك بموعد سداد الرسوم المستحقة للطالب/ة {student_name} عن حزمة دروس {group_name}.\nالمبلغ المطلوب: {amount}.\n\nشاكراً لحضرتك حسن التعاون: {teacher_name}',
  exam: 'السلام عليكم ورحمة الله وبركاته،\n\nنتيجة اختبار الطالب/ة {student_name} في مجموعة {group_name}:\nحصل على أداء ممتاز وتم تكريمه في الحصة.\n\nمع خالص التقدير: {teacher_name}',
  summary: 'السلام عليكم ورحمة الله وبركاته،\n\nملخص درس اليوم لمجموعة {group_name} ({date}):\nتم شرح الأجزاء الهامة والتطبيق عليها، وأبدى الطلاب تفاعلاً طيباً.\n\nمع تحيات: {teacher_name}'
};

export const SettingsView: React.FC = () => {
  const {
    profile,
    updateProfile,
    theme,
    setTheme,
    language,
    setLanguage,
    t,
    _t,
    clearAllData,
    inspirationSettings,
    inspirationMessages,
    updateInspirationSettings,
    addInspirationMessage,
    updateInspirationMessage,
    deleteInspirationMessage,
    toggleFavoriteInspirationMessage,
    restoreDefaultInspirationMessages,
    checkAndTriggerInspirationReminder,
    accentColor,
    setAccentColor,
    notificationSettings,
    triggerToast,
    previewInvalidBiweeklyAutoLessons,
    cleanupInvalidBiweeklyAutoLessons
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory | null>(() => {
    try {
      if ((window as any).__glueckPendingSettingsCategory === 'grain') {
        delete (window as any).__glueckPendingSettingsCategory;
        return 'grain';
      }
    } catch {}
    return null;
  });
  const [integrationTab, setIntegrationTab] = useState<'zoom' | 'grain'>('zoom');
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [biweeklyCleanupPreview, setBiweeklyCleanupPreview] = useState<Lesson[] | null>(null);
  const [isBiweeklyCleanupLoading, setIsBiweeklyCleanupLoading] = useState(false);

  // Live overview signals
  const [cloudUser, setCloudUser] = useState<any>(() => getActiveCloudUser());
  const [downloadedCount, setDownloadedCount] = useState<number>(() => getDownloadedFilesRegistry().length);
  const [pendingHwCount, setPendingHwCount] = useState<number>(() => getPendingHomeworkSyncCount());

  useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((u) => {
      setCloudUser(u);
      setPendingHwCount(getPendingHomeworkSyncCount(u?.uid || null));
    });
    const refreshFiles = () => setDownloadedCount(getDownloadedFilesRegistry().length);
    const refreshHw = () => setPendingHwCount(getPendingHomeworkSyncCount(getActiveCloudUser()?.uid || null));

    window.addEventListener('gluck_downloaded_files_updated', refreshFiles);
    window.addEventListener('glueck-homework-sync-updated', refreshHw);
    return () => {
      unsubAuth();
      window.removeEventListener('gluck_downloaded_files_updated', refreshFiles);
      window.removeEventListener('glueck-homework-sync-updated', refreshHw);
    };
  }, []);

  useEffect(() => {
    const handleOpenIntegrations = () => {
      try {
        delete (window as any).__glueckPendingSettingsCategory;
      } catch {}
      setActiveCategory('grain');
      setIntegrationTab('zoom');
    };
    window.addEventListener('glueck:open-integrations', handleOpenIntegrations);
    return () => {
      window.removeEventListener('glueck:open-integrations', handleOpenIntegrations);
    };
  }, []);

  const handleOpenBiweeklyCleanupPreview = async () => {
    setIsBiweeklyCleanupLoading(true);
    try {
      const items = await previewInvalidBiweeklyAutoLessons();
      setBiweeklyCleanupPreview(items);
    } finally {
      setIsBiweeklyCleanupLoading(false);
    }
  };

  const handleConfirmBiweeklyCleanup = async () => {
    if (!biweeklyCleanupPreview || biweeklyCleanupPreview.length === 0) {
      setBiweeklyCleanupPreview(null);
      return;
    }
    setIsBiweeklyCleanupLoading(true);
    try {
      const ids = biweeklyCleanupPreview.map((l) => l.id);
      const count = await cleanupInvalidBiweeklyAutoLessons(ids);
      setBiweeklyCleanupPreview(null);
      triggerToast(
        _t(
          `تم تنظيف ${count} حصة تلقائية مخالفة للتكرار بنجاح (نُقلت إلى المحذوفات)`,
          `Cleaned up ${count} invalid recurring auto-lessons`,
          `${count} ungültige automatische Lektionen bereinigt`
        )
      );
    } finally {
      setIsBiweeklyCleanupLoading(false);
    }
  };

  // Live Theme Accent Preview Interactive Demo States
  const [previewSwitchOn, setPreviewSwitchOn] = useState(true);
  const [previewFeedbackText, setPreviewFeedbackText] = useState<string | null>(null);
  const [isColorPickerModalOpen, setIsColorPickerModalOpen] = useState(false);
  const [activeFamilyTab, setActiveFamilyTab] = useState<string>('all');

  // Inspiration Messages UI States
  const [isManagingMessages, setIsManagingMessages] = useState(false);
  const [msgFilterSource, setMsgFilterSource] = useState<'all' | 'favorites'>('all');
  const [isAddMsgModalOpen, setIsAddMsgModalOpen] = useState(false);
  const [newMsgText, setNewMsgText] = useState('');
  const [editingMsg, setEditingMsg] = useState<{ id: string; text: string } | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [showRestoreDefaultsConfirm, setShowRestoreDefaultsConfirm] = useState(false);

  // Payment Profile Fields
  const [phone, setPhone] = useState(profile.phone || '');
  const [instaPayId, setInstaPayId] = useState(profile.instaPayId || '');
  const [vodafoneCashNumber, setVodafoneCashNumber] = useState(profile.vodafoneCashNumber || '');
  const [bankAccount, setBankAccount] = useState(profile.bankAccount || '');
  const [paymentLink, setPaymentLink] = useState(profile.paymentLink || '');
  const [whatsappNumber, setWhatsappNumber] = useState(profile.whatsappNumber || '');

  // Keep payment form synced with profile changes
  useEffect(() => {
    setPhone(profile.phone || '');
    setInstaPayId(profile.instaPayId || '');
    setVodafoneCashNumber(profile.vodafoneCashNumber || '');
    setBankAccount(profile.bankAccount || '');
    setPaymentLink(profile.paymentLink || '');
    setWhatsappNumber(profile.whatsappNumber || '');
  }, [
    profile.phone,
    profile.instaPayId,
    profile.vodafoneCashNumber,
    profile.bankAccount,
    profile.paymentLink,
    profile.whatsappNumber
  ]);

  const [copiedDevPhone, setCopiedDevPhone] = useState(false);
  const [copiedBuildInfo, setCopiedBuildInfo] = useState(false);
  const [appVersionDisplay, setAppVersionDisplay] = useState(APP_VERSION);
  const [appBuildNumberDisplay, setAppBuildNumberDisplay] = useState(APP_BUILD_NUMBER);

  useEffect(() => {
    let isMounted = true;
    getRuntimeAppInfo().then((info) => {
      if (isMounted) {
        if (info.version) setAppVersionDisplay(info.version);
        if (info.build) setAppBuildNumberDisplay(info.build);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Parent Message Templates State
  const [activeMessageTab, setActiveMessageTab] = useState<
    'homework' | 'attendance' | 'absence' | 'payment' | 'exam' | 'summary'
  >('homework');
  const [messageTemplates, setMessageTemplates] = useState<Record<string, string>>({
    ...DEFAULT_PARENT_TEMPLATES,
    ...(profile.parentMessageTemplates || {})
  });

  // UI Toast & Modal States
  const [copiedPaymentDetails, setCopiedPaymentDetails] = useState(false);
  const [copiedTemplateText, setCopiedTemplateText] = useState(false);
  const [savedSuccessToast, setSavedSuccessToast] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDataHealthCenterModal, setShowDataHealthCenterModal] = useState(false);

  const isRtl = language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ForwardChevron = isRtl ? ChevronLeft : ChevronRight;

  const triggerSaveToast = () => {
    setSavedSuccessToast(true);
    setTimeout(() => setSavedSuccessToast(false), 3000);
  };

  const handleSharePaymentInfo = () => {
    const arabicSignature = profile.displayNameAr?.trim() || profile.displayName || 'المعلم';
    const text = `السلام عليكم ورحمة الله وبركاته\n\nبيانات التحويل والدفع:\n\n📱 رقم الهاتف:\n${phone || 'غير محدد'}\n\n💳 InstaPay:\n${instaPayId || 'غير محدد'}\n${vodafoneCashNumber ? `\n💸 فودافون كاش:\n${vodafoneCashNumber}\n` : ''}${bankAccount ? `\n🏦 الحساب البنكي:\n${bankAccount}\n` : ''}${paymentLink ? `\n🔗 رابط الدفع:\n${paymentLink}\n` : ''}${whatsappNumber ? `\n💬 واتساب:\n${whatsappNumber}\n` : ''}\nشكراً لحضرتك.\n\nمع تحيات\nأ. ${arabicSignature}`;
    navigator.clipboard.writeText(text);
    setCopiedPaymentDetails(true);
    setTimeout(() => setCopiedPaymentDetails(false), 2500);
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

  const languagesList: { id: AppLanguage; label: string; shortLabel: string; flag: string }[] = [
    { id: 'ar', label: 'العربية', shortLabel: 'العربية', flag: '🇪🇬' },
    { id: 'en', label: 'English', shortLabel: 'EN', flag: '🇬🇧' },
    { id: 'de', label: 'Deutsch', shortLabel: 'DE', flag: '🇩🇪' }
  ];

  const themeModes: { id: 'light' | 'tinted' | 'dark' | 'amoled'; label: string; icon: React.ElementType }[] = [
    { id: 'light', label: _t('فاتح', 'Light', 'Hell'), icon: Sun },
    { id: 'tinted', label: _t('ملوّن', 'Tinted', 'Getönt'), icon: Palette },
    { id: 'dark', label: _t('داكن', 'Dark', 'Dunkel'), icon: Moon },
    { id: 'amoled', label: 'AMOLED', icon: Zap }
  ];

  const zoomMeta = useMemo(() => loadZoomUiMeta(), [activeCategory]);
  const grainMeta = useMemo(() => loadGrainIntegrationMeta(), [activeCategory]);

  const integrationsSummary = useMemo(() => {
    const connectedNames: string[] = [];
    if (zoomMeta?.connected) connectedNames.push('Zoom');
    if (grainMeta?.connected && grainMeta?.hasToken) connectedNames.push('Grain');
    if (connectedNames.length > 0) return connectedNames.join(' · ');
    return _t('إعداد', 'Setup', 'Einrichten');
  }, [zoomMeta?.connected, grainMeta?.connected, grainMeta?.hasToken, language]);

  const configuredPaymentMethodsCount = useMemo(() => {
    return [phone, instaPayId, vodafoneCashNumber, bankAccount, paymentLink].filter((v) => v?.trim()).length;
  }, [phone, instaPayId, vodafoneCashNumber, bankAccount, paymentLink]);

  const settingsGroups: { id: SettingsGroupFilter; label: string }[] = [
    { id: 'teaching', label: _t('الحساب والتدريس', 'Account & Teaching', 'Konto & Unterricht') },
    { id: 'integrations', label: _t('التكاملات والتواصل', 'Integrations & Communication', 'Integrationen & Kommunikation') },
    { id: 'personalize', label: _t('المظهر والتخصيص', 'Appearance & Experience', 'Darstellung & Erlebnis') },
    { id: 'data', label: _t('الملفات والبيانات', 'Files & Data', 'Dateien & Daten') },
    { id: 'system', label: _t('النظام وحول التطبيق', 'System & About', 'System & Info') }
  ];

  const settingsItems: SettingsItemConfig[] = [
    // 1. Account & Teaching
    {
      id: 'profile',
      group: 'teaching',
      title: _t('الملف الشخصي وساعات العمل', 'Profile & Work Schedule', 'Profil & Arbeitszeiten'),
      description: _t(
        'الاسم، البريد الإلكتروني، العملة، وأوقات العمل الأسبوعية',
        'Personal details, currency & weekly availability',
        'Persönliche Daten, Währung & Verfügbarkeit'
      ),
      icon: User,
      metaText: profile.currency || 'EGP',
      keywords: 'profile teacher name email schedule hours currency ملف شخصي اسم معلم ساعات عمل عملة'
    },
    {
      id: 'school',
      group: 'teaching',
      title: _t('إعدادات المدرسة والقسم', 'School & Department Settings', 'Schul- & Fachbereichseinstellungen'),
      description: _t(
        'الحضور والانصراف، جدول الحصص المتسلسلة، ومديري المراحل',
        'Arrival, departure, sequential periods & stage managers',
        'Anwesenheit, Stundenraster & Stufenleitung'
      ),
      icon: BookOpen,
      metaText: profile.schoolSettings?.schoolName
        ? profile.schoolSettings.schoolName.slice(0, 14)
        : _t('المدرسة', 'School', 'Schule'),
      keywords: 'school hod periods arrival departure schedule مدرسة قسم حصص حضور انصراف جدول'
    },
    {
      id: 'payment',
      group: 'teaching',
      title: _t('المدفوعات وبيانات التحويل', 'Payments & Transfer Info', 'Zahlungen & Überweisungen'),
      description: _t(
        'InstaPay، فودافون كاش، الحساب البنكي، ومشاركة بيانات الدفع للأهالي',
        'InstaPay, Vodafone Cash, bank info & quick parent sharing',
        'Zahlungsdaten, Bankverbindung & Teilen'
      ),
      icon: DollarSign,
      metaText:
        configuredPaymentMethodsCount > 0
          ? _t(`${configuredPaymentMethodsCount} طرق`, `${configuredPaymentMethodsCount} active`, `${configuredPaymentMethodsCount} aktiv`)
          : _t('غير مضاف', 'Not set', 'Offen'),
      keywords: 'payment finance instapay vodafone cash bank transfer دفع مالية انستاباي فودافون كاش تحويل'
    },

    // 2. Integrations & Communication
    {
      id: 'grain',
      group: 'integrations',
      title: _t('Zoom والتقويم وتسجيلات Grain', 'Zoom, Calendar & Grain', 'Zoom, Kalender & Grain'),
      description: _t(
        'إدارة اجتماعات Zoom الموحدة، مزامنة Google Calendar، وربط Grain تلقائياً',
        'Standardized Zoom meetings, Google Calendar sync & Grain recordings',
        'Zoom-Meetings, Google-Kalender & Grain-Aufnahmen'
      ),
      icon: Video,
      metaText: integrationsSummary,
      keywords: 'zoom grain calendar meetings recordings sync google تكامل زووم جراين تقويم تسجيلات اجتماعات'
    },
    {
      id: 'cloud',
      group: 'integrations',
      title: _t('سحابة الواجبات الأونلاين', 'Online Homework Cloud', 'Online-Hausaufgaben-Cloud'),
      description: _t(
        'حساب Google لنشر روابط الواجبات، دومين الطلاب، ورفع الحلول المعلقة',
        'Google teacher sign-in, student homework domain & cloud sync',
        'Google-Login, Schüler-Domain & Cloud-Sync'
      ),
      icon: Cloud,
      metaText: cloudUser
        ? pendingHwCount > 0
          ? _t(`${pendingHwCount} معلق`, `${pendingHwCount} pending`, `${pendingHwCount} offen`)
          : _t('متصل', 'Connected', 'Verbunden')
        : _t('تسجيل الدخول', 'Sign in', 'Anmelden'),
      keywords: 'cloud google firebase homework online domain sync sha1 سحابة واجبات أونلاين جوجل دومين'
    },
    {
      id: 'messages',
      group: 'integrations',
      title: _t('قوالب رسائل أولياء الأمور', 'Parent Message Templates', 'Eltern-Nachrichtenvorlagen'),
      description: _t(
        'تخصيص رسائل واتساب التلقائية للواجب، الحضور، الغياب، والدفع',
        'Customize WhatsApp templates for homework, attendance & fees',
        'WhatsApp-Vorlagen für Hausaufgaben & Anwesenheit'
      ),
      icon: MessageSquare,
      metaText: _t('6 قوالب', '6 templates', '6 Vorlagen'),
      keywords: 'messages whatsapp templates parent homework attendance رسائل قوالب واتساب أولياء أمور'
    },
    {
      id: 'contacts',
      group: 'integrations',
      title: _t('توحيد جهات الاتصال', 'Contacts Unification', 'Kontakte vereinheitlichen'),
      description: _t(
        'توحيد أسماء أولياء الأمور عبر Google Contacts وأندرويد بصيغة Klasse',
        'Standardize parent contact names across Google Contacts & Android',
        'Elternkontakte über Google Contacts & Android formatieren'
      ),
      icon: Smartphone,
      metaText: 'Google',
      keywords: 'contacts google android unify klasse phone mom جهات اتصال أرقام هواتف توحيد'
    },

    // 3. Appearance & Experience
    {
      id: 'language',
      group: 'personalize',
      title: _t('المظهر، الألوان واللغة', 'Appearance, Colors & Language', 'Design, Farben & Sprache'),
      description: _t(
        'الوضع الفاتح والملوّن والداكن وAMOLED، لون الثيم المخصص، ولغة الواجهة',
        'Light, Tinted, Dark & AMOLED modes, accent colors & language',
        'Hell, Getönt, Dunkel, AMOLED, Akzentfarben & Sprache'
      ),
      icon: Palette,
      metaText: languagesList.find((l) => l.id === language)?.shortLabel,
      showAccentDot: true,
      keywords: 'theme appearance color accent dark light amoled tinted language arabic english german ثيم لون مظهر داكن فاتح لغة عربي'
    },
    {
      id: 'notifications',
      group: 'personalize',
      title: _t('الإشعارات والمنبهات', 'Notifications & Alarms', 'Benachrichtigungen & Wecker'),
      description: _t(
        'تذكير ما قبل الحصة، نغمات المنبه، صلاحيات أندرويد، والملخص اليومي',
        'Lesson reminders, alarm tones, permissions & daily summary',
        'Stundenerinnerungen, Wecktöne & Tagesübersicht'
      ),
      icon: Bell,
      metaText: notificationSettings?.masterEnabled
        ? _t('مفعّل', 'Active', 'Aktiv')
        : _t('معطّل', 'Off', 'Aus'),
      keywords: 'notifications alerts alarm sound reminder bell إشعارات تنبيهات منبه صوت تذكير'
    },
    {
      id: 'inspiration',
      group: 'personalize',
      title: _t('التحفيز والامتنان اليومي', 'Motivation & Gratitude', 'Motivation & Dankbarkeit'),
      description: _t(
        'تذكيرات التشجيع اليومية وإدارة عباراتك المفضلة',
        'Daily positive reminders & custom motivational quotes',
        'Tägliche Motivation & eigene Zitate verwalten'
      ),
      icon: Sparkles,
      metaText:
        inspirationSettings.frequency === 'disabled'
          ? _t('معطّل', 'Off', 'Aus')
          : inspirationSettings.frequency === 'daily'
          ? _t('يومي', 'Daily', 'Täglich')
          : inspirationSettings.frequency === 'before_first_lesson'
          ? _t('قبل الحصة', 'Pre-lesson', 'Vor Stunde')
          : _t('عشوائي', 'Random', 'Zufällig'),
      keywords: 'motivation inspiration gratitude quotes daily تحفيز امتنان عبارات تشجيع يومي'
    },

    // 4. Files & Data
    {
      id: 'downloaded_files',
      group: 'data',
      title: _t('الملفات المحملة والأرشيف', 'Downloaded Files Archive', 'Heruntergeladene Dateien'),
      description: _t(
        'كل الشهادات والتقارير وأوراق العمل المحفوظة والمطبوعة والمرسلة واتساب',
        'All generated, printed & WhatsApp-shared files and certificates',
        'Alle erstellten, gedruckten & geteilten Dateien'
      ),
      icon: FolderOpen,
      metaText:
        downloadedCount > 0
          ? _t(`${downloadedCount} ملف`, `${downloadedCount} files`, `${downloadedCount} Dateien`)
          : _t('الأرشيف', 'Archive', 'Archiv'),
      keywords: 'files downloads pdf certificates worksheets archive folder ملفات محملة شهادات أرشيف طباعة'
    },
    {
      id: 'backup',
      group: 'data',
      title: _t('النسخ الاحتياطي وصحة البيانات', 'Backup, Restore & Data Health', 'Backup, Wiederherstellung & Daten'),
      description: _t(
        'النسخ المشفّر، الاستعادة، فحص صحة البيانات، تنظيف التكرار، وإعادة التعيين',
        'Encrypted backups, restore, health audit, cleanup & reset',
        'Verschlüsselte Backups, Datenprüfung & Zurücksetzen'
      ),
      icon: HardDrive,
      metaText: 'Backup',
      keywords: 'backup restore export import data health cleanup reset delete نسخ احتياطي استعادة بيانات حذف تنظيف'
    },

    // 5. System & About
    {
      id: 'about',
      group: 'system',
      title: _t('حول التطبيق والإصدار', 'About & App Version', 'Über die App & Version'),
      description: _t(
        'معلومات النسخة، معالج الإعداد الترحيبي، والتواصل مع المطور',
        'Version info, welcome setup wizard & developer contact',
        'Versionsinfos, Setup-Assistent & Entwicklerkontakt'
      ),
      icon: Info,
      metaText: `v${appVersionDisplay}`,
      keywords: 'about version build wizard developer update حول التطبيق إصدار نسخة مطور معالج'
    },
    {
      id: 'keystore',
      group: 'system',
      title: _t('توقيع أندرويد (متقدم)', 'Android Signing (Advanced)', 'Android-Signierung (Erweitert)'),
      description: _t(
        'إنشاء ملف Keystore وإعداد مفاتيح التوقيع لبناء التطبيق عبر GitHub Actions',
        'Generate release Keystore & configure GitHub Actions signing',
        'Release-Keystore generieren & GitHub Actions einrichten'
      ),
      icon: ShieldCheck,
      metaText: 'Release',
      keywords: 'android keystore signing release apk github sha256 توقيع أندرويد متقدم'
    }
  ];

  const groupedVisibleSections = useMemo(() => {
    return settingsGroups
      .map((grp) => ({
        ...grp,
        items: settingsItems.filter((item) => item.group === grp.id)
      }))
      .filter((grp) => grp.items.length > 0);
  }, [settingsGroups, settingsItems]);

  // Unified Subpage Header
  const renderSubPageHeader = (title: string, subtitle?: string, icon?: React.ElementType) => {
    const IconComponent = icon;
    return (
      <div className="pb-3 mb-4 border-b border-surface-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className="lg:hidden min-h-[40px] min-w-[40px] rounded-xl bg-surface-hover hover:bg-primary-soft text-text-main hover:text-primary transition-colors cursor-pointer flex items-center justify-center shrink-0 border border-surface-border active:scale-95"
            title={t('auto_back_to_settings')}
            aria-label={t('auto_back_to_settings')}
          >
            <BackIcon className="w-4 h-4" />
          </button>

          {IconComponent && (
            <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary border border-primary-border/60 flex items-center justify-center shrink-0">
              <IconComponent className="w-4 h-4" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-black text-text-main truncate leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-text-muted mt-0.5 leading-snug line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 pb-28 lg:pb-10 items-start">
      {/* ==========================================
          LEFT / MAIN SIDEBAR LIST VIEW
      ========================================== */}
      <div
        className={`w-full lg:w-[360px] xl:w-[390px] shrink-0 lg:sticky lg:top-16 space-y-4 ${
          activeCategory !== null ? 'hidden lg:block' : 'block'
        }`}
      >
        {/* Grouped Inset Settings Lists */}
        <div className="space-y-4">
          {groupedVisibleSections.map((group) => (
            <section key={group.id} className="space-y-1.5">
              <h3 className="text-[11px] font-bold text-text-muted px-1.5">
                {group.label}
              </h3>

              <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden divide-y divide-surface-border/70 shadow-2xs">
                {group.items.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = activeCategory === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveCategory(item.id)}
                      className={`w-full min-h-[60px] px-3 py-2.5 flex items-center gap-3 text-start transition-colors cursor-pointer group ${
                        isActive
                          ? 'bg-primary-soft/70'
                          : 'hover:bg-surface-hover/70 active:bg-surface-hover'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-fg border-primary shadow-2xs'
                            : 'bg-primary-soft text-primary border-primary-border/60 group-hover:border-primary'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[13px] font-bold truncate transition-colors ${
                              isActive ? 'text-primary' : 'text-text-main group-hover:text-primary'
                            }`}
                          >
                            {item.title}
                          </span>
                          {(item.metaText || item.showAccentDot) && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted tabular-nums shrink-0 max-w-[110px] truncate">
                              {item.showAccentDot && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-surface-border shrink-0"
                                  style={{ backgroundColor: 'var(--primary)' }}
                                />
                              )}
                              {item.metaText && <span className="truncate">{item.metaText}</span>}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted truncate mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>

                      <ForwardChevron
                        className={`w-4 h-4 shrink-0 transition-all ${
                          isActive
                            ? 'text-primary'
                            : 'text-text-muted/45 group-hover:text-primary'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ==========================================
          RIGHT / DETAIL CONTENT PANE
      ========================================== */}
      <div className={`w-full flex-1 min-w-0 ${activeCategory === null ? 'hidden lg:block' : 'block'}`}>
        {activeCategory === null ? (
          /* Desktop Smart Overview Dashboard */
          <div className="hidden lg:flex flex-col gap-4 animate-fade-in">
            {/* Quick Settings Overview Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setActiveCategory('language')}
                className="bg-surface border border-surface-border hover:border-primary-border rounded-2xl p-4 text-start transition-all cursor-pointer group space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary border border-primary-border/60 flex items-center justify-center">
                    <Palette className="w-4 h-4" />
                  </div>
                  <span
                    className="w-5 h-5 rounded-full border-2 border-surface shadow-xs ring-1 ring-surface-border"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                </div>
                <div>
                  <h3 className="text-xs font-black text-text-main group-hover:text-primary transition-colors">
                    {_t('المظهر ولون البرنامج', 'Theme & Accent Color', 'Design & Akzentfarbe')}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {themeModes.find((m) => m.id === theme)?.label} · {languagesList.find((l) => l.id === language)?.label}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('grain')}
                className="bg-surface border border-surface-border hover:border-primary-border rounded-2xl p-4 text-start transition-all cursor-pointer group space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary border border-primary-border/60 flex items-center justify-center">
                    <Video className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-primary">{integrationsSummary}</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-text-main group-hover:text-primary transition-colors">
                    {_t('التكاملات الذكية', 'Smart Integrations', 'Integrationen')}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {_t('اجتماعات Zoom، تقويم Google، وتسجيلات Grain', 'Zoom meetings, Google Calendar & Grain', 'Zoom, Google Kalender & Grain')}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('backup')}
                className="bg-surface border border-surface-border hover:border-primary-border rounded-2xl p-4 text-start transition-all cursor-pointer group space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary border border-primary-border/60 flex items-center justify-center">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-text-muted tabular-nums">
                    {_t(`${downloadedCount} ملف`, `${downloadedCount} files`, `${downloadedCount} Dateien`)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-text-main group-hover:text-primary transition-colors">
                    {_t('النسخ الاحتياطي والبيانات', 'Backup & Data Health', 'Backup & Daten')}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {_t('النسخ المشفر، فحص البيانات، وتنظيف الحصص', 'Encrypted backup, audit & cleanup', 'Backups, Prüfung & Bereinigung')}
                  </p>
                </div>
              </button>
            </div>

            <GoogleCloudSyncCard />
          </div>
        ) : (
          <div className="animate-fade-in bg-surface rounded-2xl border border-surface-border shadow-2xs p-3.5 sm:p-5 min-h-[55vh]">
            {/* ==========================================
                SUBPAGE: INTEGRATIONS (ZOOM + CALENDAR + GRAIN)
            ========================================== */}
            {activeCategory === 'grain' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  _t('التكاملات الذكية (Zoom · Calendar · Grain)', 'Integrations (Zoom · Calendar · Grain)', 'Integrationen (Zoom · Kalender · Grain)'),
                  _t(
                    'إدارة اجتماعات Zoom الموحدة للمجموعات، مزامنة تقويم Google، وربط تسجيلات Grain تلقائياً',
                    'Manage standardized recurring Zoom meetings, Google Calendar sync, and automatic Grain recordings',
                    'Zoom-Meetings vereinheitlichen, Google-Kalender synchronisieren & Grain-Aufnahmen verknüpfen'
                  ),
                  Video
                )}
                <div className="flex items-center gap-1 p-1 bg-surface-hover rounded-xl border border-surface-border">
                  <button
                    type="button"
                    onClick={() => setIntegrationTab('zoom')}
                    className={`flex-1 min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                      integrationTab === 'zoom'
                        ? 'bg-surface text-primary border-surface-border shadow-2xs'
                        : 'border-transparent text-text-muted hover:text-text-main'
                    }`}
                  >
                    {_t('مدير Zoom والتقويم', 'Zoom & Calendar', 'Zoom & Kalender')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntegrationTab('grain')}
                    className={`flex-1 min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                      integrationTab === 'grain'
                        ? 'bg-surface text-primary border-surface-border shadow-2xs'
                        : 'border-transparent text-text-muted hover:text-text-main'
                    }`}
                  >
                    {_t('تسجيلات Grain', 'Grain Recordings', 'Grain-Aufnahmen')}
                  </button>
                </div>

                {integrationTab === 'zoom' ? <ZoomIntegrationsManager /> : <GrainSettingsCard />}
              </div>
            )}

            {/* ==========================================
                SUBPAGE: HOMEWORK CLOUD & AUTH
            ========================================== */}
            {activeCategory === 'cloud' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  _t('سحابة الواجبات الأونلاين', 'Online Homework Cloud', 'Online-Hausaufgaben-Cloud'),
                  _t(
                    'إدارة حساب Google للواجبات الأونلاين، رابط منصة الطلاب، ورفع الحلول والواجبات المعلقة',
                    'Manage Google teacher login, student homework link domain, and cloud homework sync',
                    'Lehrer-Login, Schüler-Domain und Hausaufgaben-Synchronisierung verwalten'
                  ),
                  Cloud
                )}
                <GoogleCloudSyncCard />
              </div>
            )}

            {/* ==========================================
                SUBPAGE: DOWNLOADED FILES
            ========================================== */}
            {activeCategory === 'downloaded_files' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  _t('الملفات المحملة والأرشيف', 'Downloaded Files Archive', 'Heruntergeladene Dateien'),
                  _t(
                    'أرشيف شامل لكل الملفات والشهادات وأوراق العمل والتقارير المحفوظة في هاتفك مع فلترة ذكية',
                    'Complete archive of all generated, printed, and WhatsApp-shared files saved on your device',
                    'Vollständiges Archiv aller erstellten, gedruckten und geteilten Dateien'
                  ),
                  FolderOpen
                )}
                <DownloadedFilesSection />
              </div>
            )}

            {/* ==========================================
                SUBPAGE: CONTACTS UNIFICATION
            ========================================== */}
            {activeCategory === 'contacts' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  _t('توحيد جهات الاتصال', 'Contacts Unification', 'Kontakte vereinheitlichen'),
                  _t(
                    'توحيد وتنسيق أسماء أولياء الأمور عبر Google Contacts وأندرويد',
                    'Standardize parent contact names across Google Contacts & Android',
                    'Elternkontakte über Google Contacts & Android vereinheitlichen'
                  ),
                  Smartphone
                )}

                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary-border flex items-center justify-center text-primary shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-main">
                        {_t('أداة توحيد وتنسيق جهات الاتصال الذكية', 'Smart Contact Standardization Tool', 'Smartes Werkzeug zur Kontaktvereinheitlichung')}
                      </h4>
                      <p className="text-xs text-text-muted mt-0.5">
                        {_t(
                          'تنسيق جهات اتصال الهواتف والحسابات المرتبطة بـ Google وفق الصيغة القياسية: {اسم الطالب الإنجليزي}\'s Mom - Klasse {رقم الصف}',
                          'Format phone & Google Contacts using standard formula: {Student English Name}\'s Mom - Klasse {Class}',
                          'Formatierung nach Standard: {Schülername}\'s Mom - Klasse {Stufe}'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface border border-surface-border text-xs text-text-muted space-y-1.5">
                    <div className="font-semibold text-text-main flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span>{_t('الميزات والمعايير المدعومة:', 'Features & Supported Standards:', 'Unterstützte Funktionen:')}</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 ps-2">
                      <li>{_t('دمج تلقائي للإخوة المشتركين بنفس رقم الهاتف: Ahmed & Mariam\'s Mom - Klasse 2 & 4', 'Consolidates siblings on same number: Ahmed & Mariam\'s Mom - Klasse 2 & 4', 'Geschwister-Zusammenfassung')}</li>
                      <li>{_t('استخدام كلمة Klasse حصراً بدلاً من Grade مع مراعاة قواعد الملكية بالإنجليزية', 'Strictly uses Klasse instead of Grade, respecting English possessives', 'Klasse statt Grade')}</li>
                      <li>{_t('كشف الأرقام المكررة والأسماء الموحدة مسبقاً وتوافق كامل مع Google Contacts', 'Detects duplicates, already standardized contacts, and Google accounts', 'Duplikaterkennung')}</li>
                    </ul>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsContactsModalOpen(true)}
                      className="min-h-[42px] px-4 py-2 bg-primary hover:bg-primary-hover active:scale-95 text-primary-fg text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{_t('فتح أداة توحيد جهات الاتصال', 'Open Contacts Unifier', 'Werkzeug jetzt öffnen')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}


            {/* ==========================================
                SUBPAGE: APPEARANCE, COLORS & LANGUAGE
            ========================================== */}
            {activeCategory === 'language' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  _t('المظهر، الألوان واللغة', 'Appearance, Colors & Language', 'Design, Farben & Sprache'),
                  _t(
                    'خصّص وضع العرض، لون البرنامج الأساسي، ولغة الواجهة — يتحدث كل التطبيق فوراً',
                    'Customize theme mode, accent color, and interface language — updates the entire app live',
                    'Designmodus, Akzentfarbe und Sprache anpassen — wird sofort übernommen'
                  ),
                  Palette
                )}

                {/* Interface Language */}
                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      <span>{t('settings_language')}</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {languagesList.map((langItem) => {
                      const isSelected = language === langItem.id;
                      return (
                        <button
                          key={langItem.id}
                          type="button"
                          onClick={() => {
                            if (language !== langItem.id) {
                              setLanguage(langItem.id);
                            }
                          }}
                          className={`min-h-[42px] py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border text-center ${
                            isSelected
                              ? 'bg-primary text-primary-fg border-primary shadow-2xs'
                              : 'bg-surface text-text-main border-surface-border hover:border-primary-border'
                          }`}
                        >
                          <span className="text-sm">{langItem.flag}</span>
                          <span className="text-xs truncate">{langItem.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Theme Mode Section */}
                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      {theme === 'amoled' ? (
                        <Zap className="w-3.5 h-3.5 text-primary" />
                      ) : theme === 'dark' ? (
                        <Moon className="w-3.5 h-3.5 text-primary" />
                      ) : theme === 'tinted' ? (
                        <Palette className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Sun className="w-3.5 h-3.5 text-primary" />
                      )}
                      <span>{t('settings_theme')}</span>
                    </h3>
                    <span className="text-[11px] text-text-muted font-medium">
                      {theme === 'amoled'
                        ? '100% OLED Black'
                        : theme === 'dark'
                        ? 'Midnight Slate'
                        : theme === 'tinted'
                        ? _t('أورا ملوّنة متناسقة', 'Tinted Aura', 'Farbig Weich')
                        : 'Clean Light'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {themeModes.map((mode) => {
                      const ModeIcon = mode.icon;
                      const isSelected = theme === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setTheme(mode.id)}
                          className={`min-h-[44px] p-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                            isSelected
                              ? mode.id === 'amoled'
                                ? 'bg-black text-white border-primary ring-2 ring-primary/40 shadow-xs'
                                : 'bg-primary text-primary-fg border-primary ring-2 ring-primary/25 shadow-xs'
                              : 'bg-surface text-text-main border-surface-border hover:border-primary-border'
                          }`}
                        >
                          <ModeIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs truncate">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color Section */}
                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-primary" />
                      <span>{t('auto_accent_color')}</span>
                    </h3>

                    <button
                      type="button"
                      onClick={() => setIsColorPickerModalOpen(true)}
                      className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 bg-primary-soft hover:bg-primary/20 text-primary border border-primary-border rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>{_t('منتقي الألوان المخصص', 'Custom Color Picker', 'Farbauswahl')}</span>
                    </button>
                  </div>

                  {/* Color Family Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveFamilyTab('all')}
                      title={_t('جميع العائلات', 'All Families', 'Alle Familien')}
                      className={`w-9 h-9 rounded-xl text-sm font-bold flex items-center justify-center transition-all cursor-pointer border ${
                        activeFamilyTab === 'all'
                          ? 'bg-primary text-primary-fg border-primary shadow-2xs'
                          : 'bg-surface text-text-muted hover:text-text-main border-surface-border hover:border-primary-border'
                      }`}
                    >
                      🎨
                    </button>
                    {COLOR_FAMILIES.map((fam) => {
                      const famName = language === 'ar' ? fam.nameAr : language === 'de' ? fam.nameDe : fam.nameEn;
                      const isActive = activeFamilyTab === fam.id;
                      return (
                        <button
                          key={fam.id}
                          type="button"
                          onClick={() => setActiveFamilyTab(fam.id)}
                          title={famName}
                          className={`w-9 h-9 rounded-xl text-sm font-semibold flex items-center justify-center transition-all cursor-pointer border ${
                            isActive
                              ? 'bg-primary-soft text-primary border-primary shadow-2xs'
                              : 'bg-surface text-text-muted hover:text-text-main border-surface-border hover:border-primary-border'
                          }`}
                        >
                          <span>{fam.icon}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Color Palette Grid */}
                  <div className="space-y-3 pt-1">
                    {COLOR_FAMILIES.filter((fam) => activeFamilyTab === 'all' || activeFamilyTab === fam.id).map((fam) => {
                      const famName = language === 'ar' ? fam.nameAr : language === 'de' ? fam.nameDe : fam.nameEn;
                      return (
                        <div key={fam.id} className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted">
                            <span>{fam.icon}</span>
                            <span>{famName}</span>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {fam.shades.map((shade) => {
                              const targetValue = shade.presetKey || shade.hex;
                              const isSelected =
                                accentColor === targetValue ||
                                accentColor === shade.hex ||
                                accentColor === `hex-${shade.hex.replace('#', '')}`;
                              return (
                                <button
                                  key={shade.hex}
                                  type="button"
                                  onClick={() => {
                                    if (!isSelected) {
                                      setAccentColor(targetValue as any);
                                    }
                                  }}
                                  className="flex flex-col items-center gap-1 focus:outline-none group cursor-pointer py-0.5"
                                  title={`${shade.name} (${shade.hex})`}
                                >
                                  <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center shadow-xs relative transition-transform duration-150 group-hover:scale-110 active:scale-95 ${
                                      isSelected
                                        ? 'ring-2 ring-offset-2 ring-offset-surface scale-105'
                                        : 'opacity-90 hover:opacity-100 border border-black/10 dark:border-white/20'
                                    }`}
                                    style={
                                      {
                                        backgroundColor: shade.hex,
                                        ...(isSelected ? { '--tw-ring-color': shade.hex } : {})
                                      } as React.CSSProperties
                                    }
                                  >
                                    {isSelected && (
                                      <Check
                                        className={`w-4 h-4 stroke-[3px] ${
                                          getContrastTextColor(shade.hex) === '#000000' ? 'text-slate-950' : 'text-white'
                                        }`}
                                      />
                                    )}
                                  </div>
                                  <span className="text-[10px] text-text-muted truncate w-full text-center font-medium group-hover:text-text-main">
                                    {shade.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Accent Preview */}
                  <div className="p-3 rounded-xl border border-primary-border bg-primary-soft/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-text-muted">{t('settings_live_preview')}</h4>
                      {previewFeedbackText && (
                        <span className="text-[11px] font-bold text-primary animate-fade-in">
                          {previewFeedbackText}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        id="settings-demo-primary-btn"
                        onClick={() => {
                          setPreviewFeedbackText(_t('الزر الرئيسي متناسق', 'Primary accent active', 'Hauptfarbe aktiv'));
                          triggerToast(_t('تم اختبار الزر الرئيسي بنجاح — الألوان متناسقة', 'Primary theme accent verified', 'Hauptfarbe erfolgreich getestet'));
                          setTimeout(() => setPreviewFeedbackText(null), 2500);
                        }}
                        className="flex-1 min-h-[38px] bg-primary text-primary-fg py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all hover:bg-primary-hover active:scale-98 cursor-pointer"
                      >
                        {t('settings_primary_button')}
                      </button>
                      <button
                        type="button"
                        id="settings-demo-secondary-btn"
                        onClick={() => {
                          setPreviewFeedbackText(_t('الزر الثانوي متناسق', 'Secondary accent active', 'Sekundärfarbe aktiv'));
                          triggerToast(_t('تم اختبار الزر الثانوي بنجاح — الألوان متناسقة', 'Secondary theme accent verified', 'Sekundärfarbe erfolgreich getestet'));
                          setTimeout(() => setPreviewFeedbackText(null), 2500);
                        }}
                        className="flex-1 min-h-[38px] bg-surface text-primary border border-primary-border py-1.5 rounded-xl text-xs font-bold transition-all hover:bg-primary-soft active:scale-98 cursor-pointer"
                      >
                        {t('settings_secondary_button')}
                      </button>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 bg-surface rounded-xl border border-surface-border">
                      <div className="w-8 h-8 bg-primary-soft border border-primary-border/60 rounded-lg text-primary flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-text-main truncate">{t('settings_premium_widget')}</p>
                        <p className="text-[10.5px] text-text-muted truncate">{t('settings_adapts_accent')}</p>
                      </div>
                      <button
                        type="button"
                        id="settings-demo-toggle-switch-btn"
                        onClick={() => {
                          const nextState = !previewSwitchOn;
                          setPreviewSwitchOn(nextState);
                          setPreviewFeedbackText(
                            nextState
                              ? _t('المفتاح: مفعل', 'Switch: Active', 'Schalter: Aktiv')
                              : _t('المفتاح: معطل', 'Switch: Disabled', 'Schalter: Deaktiviert')
                          );
                          setTimeout(() => setPreviewFeedbackText(null), 2500);
                        }}
                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors p-0.5 shrink-0 ${
                          previewSwitchOn ? 'bg-primary' : 'bg-surface-border'
                        }`}
                        title={_t('تبديل حالة المفتاح التجريبي', 'Toggle switch preview', 'Schalter testen')}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full shadow-2xs transition-transform ${
                            previewSwitchOn ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==========================================
                SUBPAGE: TEACHER PROFILE
            ========================================== */}
            {activeCategory === 'profile' && (
              <div className="space-y-3.5 animate-scale-up">
                <TeacherProfileSection onBack={() => setActiveCategory(null)} />
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
                SUBPAGE: PAYMENT INFORMATION
            ========================================== */}
            {activeCategory === 'payment' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  t('auto_payment_information'),
                  t('auto_information_used_when_sending'),
                  DollarSign
                )}

                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 space-y-3.5">
                  <div className="p-3 bg-primary-soft border border-primary-border rounded-xl flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <DollarSign className="w-4 h-4 shrink-0" />
                      <span>{t('auto_direct_electronic_payment_prof')}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSharePaymentInfo}
                      className="min-h-[34px] bg-primary hover:bg-primary-hover text-primary-fg font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {copiedPaymentDetails ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPaymentDetails ? t('copied') : t('auto_copy_payment_info')}</span>
                    </button>
                  </div>

                  <form onSubmit={handleSavePaymentInfo} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <label className="font-bold text-text-main text-xs">{t('settings_phone')}</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="01012345678"
                          className="w-full min-h-[40px] px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-text-main text-xs">{t('settings_instapay')}</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={instaPayId}
                          onChange={(e) => setInstaPayId(e.target.value)}
                          placeholder="name@instapay"
                          className="w-full min-h-[40px] px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-text-main text-xs">{t('settings_vodafone')}</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={vodafoneCashNumber}
                          onChange={(e) => setVodafoneCashNumber(e.target.value)}
                          placeholder="01012345678"
                          className="w-full min-h-[40px] px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-text-main text-xs">{t('settings_bank')}</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder="EG1234567890..."
                          className="w-full min-h-[40px] px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-text-main text-xs">{t('settings_payment_link')}</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={paymentLink}
                          onChange={(e) => setPaymentLink(e.target.value)}
                          placeholder="https://pay.link/..."
                          className="w-full min-h-[40px] px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-text-main text-xs">WhatsApp</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          placeholder="+201012345678"
                          className="w-full min-h-[40px] px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {savedSuccessToast && (
                      <div className="bg-primary text-primary-fg text-xs font-bold p-2.5 rounded-xl flex items-center justify-center gap-2 animate-scale-up">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('settings_save_success')}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSharePaymentInfo}
                        className="flex-1 min-h-[42px] bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-primary" />
                        <span>{t('auto_copy_payment_info')}</span>
                      </button>

                      <button
                        type="submit"
                        className="flex-1 min-h-[42px] bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs py-2 rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
                SUBPAGE: PARENT MESSAGE TEMPLATES
            ========================================== */}
            {activeCategory === 'messages' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  t('auto_parent_message_templates'),
                  t('auto_manage_templates_for_homework'),
                  MessageSquare
                )}

                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 space-y-3">
                  {/* Template Categories Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 text-xs">
                    {[
                      { id: 'homework', label: t('auto_homework'), icon: BookOpen },
                      { id: 'attendance', label: t('auto_attendance'), icon: CheckSquare },
                      { id: 'absence', label: t('auto_absence'), icon: XCircle },
                      { id: 'payment', label: t('auto_payments'), icon: DollarSign },
                      { id: 'exam', label: t('auto_exam_reports'), icon: Award },
                      { id: 'summary', label: t('auto_lesson_summary'), icon: FileText }
                    ].map((tab) => {
                      const TabIcon = tab.icon;
                      const isSelected = activeMessageTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveMessageTab(tab.id as any)}
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isSelected
                              ? 'bg-primary text-primary-fg border-primary shadow-2xs'
                              : 'bg-surface text-text-main border-surface-border hover:border-primary-border'
                          }`}
                        >
                          <TabIcon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Template Editor */}
                  <div className="space-y-2.5 pt-2 border-t border-surface-border">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{t('auto_message_template_text_arabic')}</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(messageTemplates[activeMessageTab] || '');
                          setCopiedTemplateText(true);
                          setTimeout(() => setCopiedTemplateText(false), 2000);
                        }}
                        className="px-2.5 py-1 bg-surface hover:bg-primary-soft border border-surface-border text-text-main text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {copiedTemplateText ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-primary" />}
                        <span>{copiedTemplateText ? t('copied') : t('auto_copy_text')}</span>
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={messageTemplates[activeMessageTab] || ''}
                      onChange={(e) => setMessageTemplates((prev) => ({ ...prev, [activeMessageTab]: e.target.value }))}
                      className="w-full p-3 bg-surface border border-surface-border rounded-xl text-xs font-medium leading-relaxed text-text-main focus:outline-none focus:border-primary font-sans"
                      dir="rtl"
                    />

                    {/* Dynamic Variables Legend */}
                    <div className="p-2.5 bg-primary-soft border border-primary-border rounded-xl text-[11px] text-primary space-y-1.5">
                      <p className="font-bold">{t('auto_available_dynamic_placeholders')}</p>
                      <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                        {['{student_name}', '{group_name}', '{date}', '{amount}', '{teacher_name}'].map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() =>
                              setMessageTemplates((prev) => ({
                                ...prev,
                                [activeMessageTab]: `${prev[activeMessageTab] || ''} ${token}`.trim()
                              }))
                            }
                            className="bg-surface hover:bg-primary hover:text-primary-fg px-2 py-0.5 rounded-md border border-primary-border font-bold transition-colors cursor-pointer"
                            title={_t('اضغط لإدراج المتغير', 'Click to insert placeholder', 'Zum Einfügen klicken')}
                          >
                            {token}
                          </button>
                        ))}
                      </div>
                    </div>

                    {savedSuccessToast && (
                      <div className="bg-primary text-primary-fg text-xs font-bold p-2.5 rounded-xl flex items-center justify-center gap-2 animate-scale-up">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('settings_save_success')}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setMessageTemplates((prev) => ({
                            ...prev,
                            [activeMessageTab]: DEFAULT_PARENT_TEMPLATES[activeMessageTab]
                          }))
                        }
                        className="min-h-[42px] px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        {t('auto_reset_to_default')}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveMessageTemplates}
                        className="flex-1 min-h-[42px] bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs py-2 rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
                SUBPAGE: INSPIRATION & GRATITUDE
            ========================================== */}
            {activeCategory === 'inspiration' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  t('auto_inspiration_gratitude'),
                  t('auto_teacher_reminders_motivation'),
                  Sparkles
                )}

                {!isManagingMessages ? (
                  <div className="space-y-3">
                    <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 space-y-3">
                      <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>{t('auto_display_settings')}</span>
                      </h3>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-bold text-text-main mb-1">
                            {t('auto_frequency')}
                          </label>
                          <select
                            value={inspirationSettings.frequency}
                            onChange={(e) => updateInspirationSettings({ frequency: e.target.value as any })}
                            className="w-full min-h-[40px] p-2 bg-surface border border-surface-border rounded-xl focus:outline-none focus:border-primary font-medium text-xs text-text-main transition-all"
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
                            className="w-full min-h-[40px] p-2 bg-surface border border-surface-border rounded-xl focus:outline-none focus:border-primary font-medium text-xs text-text-main transition-all disabled:opacity-50"
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
                            className="w-full min-h-[40px] p-2 bg-surface border border-surface-border rounded-xl focus:outline-none focus:border-primary font-medium text-xs text-text-main transition-all disabled:opacity-50"
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
                        className="w-full min-h-[40px] p-2 bg-primary-soft text-primary font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-primary/20 border border-primary-border transition-colors cursor-pointer text-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('auto_test_reminder_now')}</span>
                      </button>
                    </div>

                    <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          <span>{t('auto_messages')}</span>
                        </h3>
                        <span className="text-[11px] font-bold text-primary tabular-nums">
                          {inspirationMessages.length} {t('auto_messages')}
                        </span>
                      </div>

                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {t('auto_manage_the_motivational_quotes')}
                      </p>

                      <button
                        type="button"
                        onClick={() => setIsManagingMessages(true)}
                        className="w-full min-h-[40px] p-2 bg-surface hover:bg-primary-soft border border-surface-border hover:border-primary-border text-text-main hover:text-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{t('auto_manage_messages')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsManagingMessages(false);
                          setEditingMsg(null);
                          setDeletingMsgId(null);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <BackIcon className="w-3.5 h-3.5" />
                        <span>{t('auto_back')}</span>
                      </button>
                      <div className="flex gap-1 bg-surface p-0.5 rounded-xl border border-surface-border">
                        <button
                          type="button"
                          onClick={() => setMsgFilterSource('all')}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                            msgFilterSource === 'all' ? 'bg-primary text-primary-fg' : 'text-text-muted hover:text-text-main'
                          }`}
                        >
                          {t('auto_all')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMsgFilterSource('favorites')}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                            msgFilterSource === 'favorites' ? 'bg-primary text-primary-fg' : 'text-text-muted hover:text-text-main'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${msgFilterSource === 'favorites' ? 'fill-current' : ''}`} />
                          <span>{t('auto_favorites')}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsg(null);
                          setNewMsgText('');
                          setIsAddMsgModalOpen(true);
                        }}
                        className="flex-1 min-h-[40px] bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs py-2 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('auto_add_message')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRestoreDefaultsConfirm(true)}
                        className="min-h-[40px] px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title={t('auto_restore_default_messages')}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-primary" />
                      </button>
                    </div>

                    {/* Message List */}
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pe-1 pb-2">
                      {inspirationMessages
                        .filter((m) => msgFilterSource === 'all' || m.isFavorite)
                        .map((msg) => (
                          <div
                            key={msg.id}
                            className="p-3 bg-surface border border-surface-border rounded-xl flex flex-col gap-2"
                          >
                            <p className={`text-xs font-semibold text-text-main ${isRtl ? 'text-right' : 'text-left'}`} dir="auto">
                              {msg.text}
                            </p>
                            <div className="flex items-center justify-between pt-1.5 border-t border-surface-border/70">
                              <div className="text-[10.5px] font-bold text-primary">
                                {msg.isCustom ? t('auto_custom') : ''}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleFavoriteInspirationMessage(msg.id)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    msg.isFavorite
                                      ? 'text-primary bg-primary-soft'
                                      : 'text-text-muted hover:bg-surface-hover'
                                  }`}
                                >
                                  <Star className={`w-3.5 h-3.5 ${msg.isFavorite ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsg({ id: msg.id, text: msg.text });
                                    setIsAddMsgModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingMsgId(msg.id)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {deletingMsgId === msg.id && (
                              <div className="mt-1 p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                  {t('auto_are_you_sure')}
                                </span>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setDeletingMsgId(null)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-text-muted hover:bg-surface rounded-lg transition-colors cursor-pointer"
                                  >
                                    {t('auto_cancel')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deleteInspirationMessage(msg.id);
                                      setDeletingMsgId(null);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                                  >
                                    {t('delete')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                      {inspirationMessages.filter((m) => msgFilterSource === 'all' || m.isFavorite).length === 0 && (
                        <div className="text-center py-5 text-text-muted">
                          <Heart className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
                          <p className="text-xs">{t('auto_no_messages_found')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==========================================
                SUBPAGE: DATA & BACKUP (INCLUDES DANGER ZONE)
            ========================================== */}
            {(activeCategory === 'backup' || activeCategory === 'danger') && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  t('auto_backup_data_management_cente'),
                  t('auto_create_full_backups_password'),
                  HardDrive
                )}

                <SmartBackupCenter onBack={() => setActiveCategory(null)} />

                {/* Maintenance & Health Tools */}
                <div className="pt-2 border-t border-surface-border space-y-2.5">
                  <h3 className="text-xs font-bold text-text-muted px-0.5">
                    {_t('صيانة وفحص البيانات', 'Data Health & Maintenance', 'Datenprüfung & Wartung')}
                  </h3>

                  <button
                    type="button"
                    onClick={() => setShowDataHealthCenterModal(true)}
                    className="w-full min-h-[44px] bg-surface-hover/50 hover:bg-primary-soft text-text-main hover:text-primary border border-surface-border hover:border-primary-border font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>{t('auto_smart_data_validation_health')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenBiweeklyCleanupPreview}
                    disabled={isBiweeklyCleanupLoading}
                    className="w-full min-h-[44px] bg-surface-hover/50 hover:bg-surface-hover text-text-main border border-surface-border font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <span>
                      {_t(
                        'معاينة وتنظيف الحصص التلقائية المخالفة للتكرار (أسبوع وأسبوع)',
                        'Preview & Clean Invalid Biweekly Auto-Lessons',
                        'Ungültige zweiwöchentliche Auto-Lektionen prüfen & bereinigen'
                      )}
                    </span>
                  </button>

                  {/* Danger Zone */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(true)}
                      className="w-full min-h-[44px] bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                      <span>{t('auto_danger_zone_data_reset')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==========================================
                SUBPAGE: ABOUT & VERSION
            ========================================== */}
            {activeCategory === 'about' && (
              <div className="space-y-4 animate-scale-up">
                {renderSubPageHeader(
                  t('auto_about'),
                  t('auto_application_details_features'),
                  Info
                )}

                {/* 1. App Identity Card */}
                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-4 space-y-3 text-center sm:text-start">
                  <div className="flex flex-col sm:flex-row items-center gap-3.5 pb-3 border-b border-surface-border">
                    <TeacherCrestLogo size="card" />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h1 className="text-base sm:text-lg font-black text-text-main">
                          Glück fröhlich und froh
                        </h1>
                        <span className="text-[11px] font-mono font-bold text-primary tabular-nums" dir="ltr">
                          v{appVersionDisplay} · Build #{appBuildNumberDisplay}
                        </span>
                      </div>
                      <p className="text-xs text-primary font-bold">
                        {t('auto_german_teacher_management_syst')}
                      </p>
                      <p className="text-[11px] text-text-muted font-mono" dir="ltr">
                        {_t('تاريخ بناء النسخة:', 'Build Timestamp:', 'Build-Zeitstempel:')} {formatAppBuildTimestamp(language)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-text-main font-medium leading-relaxed bg-surface p-3 rounded-xl border border-surface-border">
                    {_t(
                      'منصة إلكترونية متكاملة وشاملة صممت خصيصاً لمساعدة معلمي اللغة الألمانية في تنظيم الطلاب، المجموعات، الحصص، Zoom وتقويم Google، تسجيلات Grain، الواجبات الأونلاين، الحسابات المالية، والشهادات بكفاءة وسرعة.',
                      'A comprehensive management platform designed specifically for German language teachers to manage students, groups, lessons, Zoom & Google Calendar sync, Grain recordings, online homework, finances, and certificates in one unified workspace.',
                      'Eine umfassende Plattform für Deutschlehrer zur Verwaltung von Schülern, Gruppen, Unterricht, Zoom, Google Kalender, Grain-Aufnahmen, Online-Hausaufgaben und Finanzen.'
                    )}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-setup-wizard'))}
                      className="w-full min-h-[42px] py-2.5 px-3 bg-primary-soft hover:bg-primary/20 text-primary border border-primary-border rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{_t('تشغيل معالج الإعداد الترحيبي', 'Rerun Welcome Setup Wizard', 'Setup-Assistenten ausführen')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const info = `Glück fröhlich und froh v${appVersionDisplay} (Build #${appBuildNumberDisplay}) • Updated: ${formatAppBuildTimestamp(language)} • Mr. Abdul Rahman`;
                        navigator.clipboard.writeText(info);
                        setCopiedBuildInfo(true);
                        setTimeout(() => setCopiedBuildInfo(false), 2000);
                      }}
                      className="w-full min-h-[42px] py-2.5 px-3 bg-surface hover:bg-surface-hover text-text-main border border-surface-border rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {copiedBuildInfo ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-primary" />
                          <span className="text-primary">{_t('تم النسخ بنجاح', 'Copied Successfully', 'Kopiert')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-text-muted" />
                          <span>{_t('نسخ معلومات الإصدار', 'Copy Build Info', 'Build-Info kopieren')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Core Features Grid (Updated for v3.0) */}
                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>{t('auto_features')}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      {
                        title: _t('اجتماعات Zoom وتقويم Google', 'Standardized Zoom & Calendar', 'Zoom & Google Kalender'),
                        desc: _t('روابط موحدة لكل مجموعة مع مزامنة فورية للتقويم.', 'Dedicated recurring meetings synced live with Google Calendar.', 'Feste Meetings mit Google-Kalender-Sync.')
                      },
                      {
                        title: _t('التعرف التلقائي لتسجيلات Grain', 'Auto Grain Recordings', 'Automatische Grain-Aufnahmen'),
                        desc: _t('ربط تلقائي لتسجيلات الحصص مع المجموعات وتقارير الأهالي.', 'Automatic recording matching linked to groups and parent summaries.', 'Automatische Zuordnung von Aufnahmen.')
                      },
                      {
                        title: _t('الواجبات الأونلاين التفاعلية', 'Online Interactive Homework', 'Online-Hausaufgaben'),
                        desc: _t('نشر روابط قصيرة للطلاب ومتابعة الحلول والدرجات لحظياً.', 'Share short homework links and track student results live.', 'Kurze Links teilen und Ergebnisse verfolgen.')
                      },
                      {
                        title: _t('الطلاب، المدرسة والإدارة المالية', 'Students, School & Finance', 'Schüler, Schule & Finanzen'),
                        desc: _t('سجلات المستويات A1–C2، جدول المدرسة، والإيصالات.', 'A1–C2 progress, school schedules, payments and receipts.', 'Niveaustufen, Schulplan und Finanzen.')
                      },
                      {
                        title: _t('تواصل أولياء الأمور والشهادات', 'Parent WhatsApp & Certificates', 'Eltern-WhatsApp & Urkunden'),
                        desc: _t('قوالب واتساب ذكية وشهادات تقدير ألمانية قابلة للطباعة.', 'One-click WhatsApp templates and German certificate generation.', 'WhatsApp-Vorlagen und deutsche Urkunden.')
                      },
                      {
                        title: _t('المزامنة والنسخ الاحتياطي', 'Encrypted Sync & Backup', 'Verschlüsseltes Backup'),
                        desc: _t('نسخ احتياطي مشفر وأرشيف ملفات منظم على جهازك.', 'Encrypted backups and organized local file archives.', 'Verschlüsselte Backups und Dateiarchiv.')
                      }
                    ].map((feat, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-surface rounded-xl border border-surface-border flex items-start gap-2.5"
                      >
                        <div className="p-1 rounded-md bg-primary-soft text-primary shrink-0 mt-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-text-main">{feat.title}</h4>
                          <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{feat.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Developer Contact Card */}
                <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>{t('auto_developer')}</span>
                    </h3>
                    <span className="text-[11px] font-bold text-primary">Mr. Abdul Rahman</span>
                  </div>

                  <div className="p-3 bg-surface border border-surface-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-center sm:text-start">
                      <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary border border-primary-border flex items-center justify-center font-black text-sm shrink-0">
                        AR
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-text-main">
                          Mr. Abdul Rahman (عبد الرحمن غريب)
                        </h4>
                        <p className="text-[11px] text-text-muted">Deutschlehrer & Software Architect</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('01156435802');
                          setCopiedDevPhone(true);
                          setTimeout(() => setCopiedDevPhone(false), 2000);
                        }}
                        className="min-h-[36px] px-3 py-1.5 bg-surface-hover border border-surface-border hover:border-primary-border text-text-main font-mono font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        title={_t('نسخ رقم الواتساب', 'Copy WhatsApp number', 'Nummer kopieren')}
                      >
                        <Phone className="w-3 h-3 text-primary" />
                        <span>01156435802</span>
                        {copiedDevPhone ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-text-muted" />}
                      </button>

                      <a
                        href="https://wa.me/201156435802?text=Hallo%20Mr.%20Abdul%20Rahman,%20ich%20nutze%20die%20GLÜCK%20App!"
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[36px] px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-fg font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 shrink-0 active:scale-95"
                      >
                        <span>WhatsApp</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-muted text-center sm:text-start leading-relaxed">
                    {_t(
                      'صُممت هذه المنصة خصيصاً بواسطة أ/ عبد الرحمن غريب لدعم معلمي وأساتذة اللغة الألمانية وتيسير إدارة الحصص. نسألكم خالص الدعاء له ولوالديه بظهر الغيب بالبركة والتوفيق والقبول وجزيل الأجر والثواب.',
                      'Designed specifically by Mr. Abdul Rahman Ghareeb to empower German language teachers. Kindly keep him in your sincere prayers.',
                      'Entwickelt von Herrn Abdul Rahman Ghareeb zur Unterstützung von Deutschlehrern. Bitte denken Sie an ihn in Ihren Gebeten.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==========================================
          MODALS
      ========================================== */}
      {/* Add/Edit Motivation Message Modal */}
      {isAddMsgModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl pb-safe-bottom sm:pb-5 w-full max-w-sm border border-surface-border shadow-xl p-5 space-y-4 animate-scale-up">
            <div className="w-10 h-1.5 bg-surface-border rounded-full mx-auto sm:hidden shrink-0" />
            <h3 className="text-sm font-black text-text-main">
              {editingMsg ? t('auto_edit_message') : t('auto_add_new_message')}
            </h3>
            <textarea
              value={editingMsg ? editingMsg.text : newMsgText}
              onChange={(e) =>
                editingMsg ? setEditingMsg({ ...editingMsg, text: e.target.value }) : setNewMsgText(e.target.value)
              }
              placeholder={t('auto_write_your_message')}
              className="w-full p-3 bg-surface-hover border border-surface-border rounded-xl focus:outline-none focus:border-primary font-medium text-sm text-text-main min-h-[100px] resize-none"
              dir="auto"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddMsgModalOpen(false);
                  setEditingMsg(null);
                  setNewMsgText('');
                }}
                className="flex-1 min-h-[42px] py-2.5 bg-surface-hover hover:bg-surface border border-surface-border text-text-main rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {t('auto_cancel')}
              </button>
              <button
                type="button"
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
                className="flex-1 min-h-[42px] py-2.5 bg-primary hover:bg-primary-hover text-primary-fg rounded-xl font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Default Motivation Messages Confirm Modal */}
      {showRestoreDefaultsConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl pb-safe-bottom sm:pb-5 w-full max-w-sm border border-surface-border shadow-xl p-5 space-y-4 animate-scale-up">
            <div className="w-10 h-1.5 bg-surface-border rounded-full mx-auto sm:hidden shrink-0" />
            <div className="w-11 h-11 bg-primary-soft text-primary border border-primary-border rounded-xl flex items-center justify-center mx-auto">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-black text-text-main mb-1.5">{t('auto_restore_defaults')}</h3>
              <p className="text-xs text-text-muted">{t('auto_default_messages_will_be_resto')}</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRestoreDefaultsConfirm(false)}
                className="flex-1 min-h-[42px] py-2.5 bg-surface-hover border border-surface-border text-text-main rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {t('auto_cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  restoreDefaultInspirationMessages();
                  setShowRestoreDefaultsConfirm(false);
                }}
                className="flex-1 min-h-[42px] py-2.5 bg-primary hover:bg-primary-hover text-primary-fg rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {t('auto_restore')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Data Clear */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl pb-safe-bottom sm:pb-5 max-w-sm w-full p-5 border border-surface-border shadow-xl space-y-3.5 animate-scale-up text-center">
            <div className="w-10 h-1.5 bg-surface-border rounded-full mx-auto sm:hidden shrink-0" />
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm font-black text-text-main">{t('settings_clear_data')}</h3>
              <p className="text-xs text-text-muted mt-1">{t('confirm')}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 min-h-[42px] py-2 bg-surface-hover border border-surface-border text-text-main rounded-xl font-bold text-xs cursor-pointer"
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
                className="flex-1 min-h-[42px] py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-2xs"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Health Center Modal */}
      {showDataHealthCenterModal && (
        <DataHealthCenterModal onClose={() => setShowDataHealthCenterModal(false)} />
      )}

      {/* Custom 2D Color Picker Modal */}
      <CustomColorPickerModal
        isOpen={isColorPickerModalOpen}
        onClose={() => setIsColorPickerModalOpen(false)}
        currentAccent={accentColor}
        onSelectAccent={(col) => setAccentColor(col as any)}
      />

      {/* Smart Contacts Unification Modal */}
      {isContactsModalOpen && (
        <ContactsUnificationModal onClose={() => setIsContactsModalOpen(false)} />
      )}

      {/* Biweekly Auto-Lessons Cleanup Preview Modal */}
      {biweeklyCleanupPreview !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl pb-safe-bottom sm:pb-4 max-w-md w-full p-4 border border-surface-border shadow-xl space-y-3 animate-scale-up">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-text-main">
                  {_t(
                    'معاينة تنظيف الحصص التلقائية المخالفة للتكرار',
                    'Biweekly Auto-Lessons Cleanup Preview',
                    'Vorschau: Bereinigung zweiwöchentlicher Lektionen'
                  )}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {_t(
                    'يشمل فقط حصص l_auto_ المجدولة بدون حضور أو دفع أو ملاحظات',
                    'Only scheduled l_auto_ lessons with no attendance, payment, or notes',
                    'Nur geplante l_auto_-Lektionen ohne Anwesenheit, Zahlung oder Notizen'
                  )}
                </p>
              </div>
            </div>

            {biweeklyCleanupPreview.length === 0 ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center">
                {_t(
                  'لا توجد أي حصص تلقائية مخالفة لنظام التكرار (أسبوع وأسبوع).',
                  'No invalid biweekly auto-lessons found.',
                  'Keine ungültigen zweiwöchentlichen Auto-Lektionen gefunden.'
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-text-main flex items-center justify-between">
                  <span>{_t('إجمالي الحصص المطابقة:', 'Total matching lessons:', 'Gefundene Lektionen:')}</span>
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    {biweeklyCleanupPreview.length}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-text-muted">
                  {_t('أمثلة من الحصص التي سيتم نقلها للمحذوفات:', 'Sample lessons to be soft-deleted:', 'Beispiele:')}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1">
                  {biweeklyCleanupPreview.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-xl bg-surface-hover border border-surface-border text-xs flex items-center justify-between gap-2"
                    >
                      <div className="truncate font-bold text-text-main">
                        {item.groupName || item.title || item.id}
                      </div>
                      <div className="text-[11px] font-mono text-text-muted shrink-0 tabular-nums">
                        {item.date} · {item.time}
                      </div>
                    </div>
                  ))}
                  {biweeklyCleanupPreview.length > 8 && (
                    <div className="text-[11px] text-center text-text-muted pt-1">
                      {_t(
                        `+ ${biweeklyCleanupPreview.length - 8} حصة أخرى...`,
                        `+ ${biweeklyCleanupPreview.length - 8} more lessons...`,
                        `+ ${biweeklyCleanupPreview.length - 8} weitere Lektionen...`
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBiweeklyCleanupPreview(null)}
                className="flex-1 min-h-[42px] py-2 bg-surface-hover border border-surface-border text-text-main rounded-xl font-bold text-xs cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              {biweeklyCleanupPreview.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmBiweeklyCleanup}
                  disabled={isBiweeklyCleanupLoading}
                  className="flex-1 min-h-[42px] py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs cursor-pointer shadow-2xs disabled:opacity-60"
                >
                  {_t('تأكيد', 'Confirm', 'Bestätigen')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
