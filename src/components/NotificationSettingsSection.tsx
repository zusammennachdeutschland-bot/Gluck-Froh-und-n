import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  NotificationSettings, CategoryNotificationConfig, NotificationSound, NotificationPriority 
} from '../types';
import { 
  getNotificationPermission, requestNotificationPermission, 
  openAndroidNotificationSettings, checkExactAlarmPermission,
  openExactAlarmSettings, sendTestOutsideNotification
} from '../services/notificationService';
import { 
  Bell, BellOff, Volume2, Shield, Clock, Calendar, DollarSign, 
  UserCheck, FileText, RefreshCw, Trash2, CheckCircle2, AlertCircle, 
  Smartphone, Settings, Sliders, Check, X, ArrowLeft, ArrowRight,
  BellRing, AlarmClock, Play, Square, VolumeX, ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { alarmAudioService, AlarmTone } from '../services/alarmAudioService';

interface Props {
  onBack: () => void;
}

export const NotificationSettingsSection: React.FC<Props> = ({ onBack }) => {
  const { 
    notificationSettings, updateNotificationSettings, 
    pendingScheduledNotifications, cancelSingleScheduledNotification,
    cancelAllPendingScheduledNotifications, rebuildNotificationSchedules,
    language, t, _t 
  } = useApp();

  const isRtl = language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean>(true);
  const [isRebuilding, setIsRebuilding] = useState<boolean>(false);
  const [rebuildFeedback, setRebuildFeedback] = useState<string | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>(
    notificationSettings.lessonReminderMinutesBefore.toString()
  );
  const [showCustomMinutes, setShowCustomMinutes] = useState<boolean>(
    ![5, 10, 15, 30, 60].includes(notificationSettings.lessonReminderMinutesBefore)
  );
  const [isTestingAlarm, setIsTestingAlarm] = useState<boolean>(false);
  const [countdownOutsideTest, setCountdownOutsideTest] = useState<number | null>(null);

  useEffect(() => {
    checkPermissions();
    const unsub = alarmAudioService.onStop(() => {
      setIsTestingAlarm(false);
    });
    return () => {
      unsub();
      alarmAudioService.stopAlarm();
    };
  }, []);

  const checkPermissions = async () => {
    const status = await getNotificationPermission();
    setPermissionStatus(status);
    const exactStatus = await checkExactAlarmPermission();
    setExactAlarmGranted(exactStatus);
  };

  const handleTestOutsideNotification = () => {
    setCountdownOutsideTest(3);
    let counter = 3;
    const timer = setInterval(() => {
      counter -= 1;
      if (counter <= 0) {
        clearInterval(timer);
        setCountdownOutsideTest(null);
        sendTestOutsideNotification();
        alarmAudioService.startAlarm(
          notificationSettings.alarmTone || 'digital',
          15
        );
      } else {
        setCountdownOutsideTest(counter);
      }
    }, 1000);
  };

  const handleToggleTestAlarm = () => {
    if (isTestingAlarm) {
      alarmAudioService.stopAlarm();
      setIsTestingAlarm(false);
    } else {
      setIsTestingAlarm(true);
      alarmAudioService.startAlarm(
        notificationSettings.alarmTone || 'digital',
        notificationSettings.alarmDurationSeconds || 60
      );
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    await checkPermissions();
    if (granted) {
      confetti({ particleCount: 40, spread: 40 });
    }
  };

  const handleToggleMaster = async () => {
    const nextState = !notificationSettings.masterEnabled;
    if (nextState && permissionStatus !== 'granted') {
      await requestNotificationPermission();
      await checkPermissions();
    }
    await updateNotificationSettings({ masterEnabled: nextState });
  };

  const handleCategoryChange = async (
    categoryKey: keyof Pick<NotificationSettings, 'lessonReminder' | 'lessonStart' | 'paymentDue' | 'dailySummary' | 'attendanceReminder' | 'schoolLessonReminder'>,
    updates: Partial<CategoryNotificationConfig>
  ) => {
    const currentCatConfig = notificationSettings[categoryKey];
    const updatedCatConfig = { ...currentCatConfig, ...updates };
    await updateNotificationSettings({ [categoryKey]: updatedCatConfig });
  };

  const handleReminderMinutesChange = async (mins: number) => {
    setShowCustomMinutes(false);
    setCustomMinutesInput(mins.toString());
    await updateNotificationSettings({ lessonReminderMinutesBefore: mins });
  };

  const handleCustomMinutesSave = async () => {
    const val = parseInt(customMinutesInput, 10);
    if (!isNaN(val) && val > 0 && val <= 1440) {
      await updateNotificationSettings({ lessonReminderMinutesBefore: val });
      setRebuildFeedback('تم حفظ توقيت التذكير المخصص');
      setTimeout(() => setRebuildFeedback(null), 3000);
    }
  };

  const handleManualRebuild = async () => {
    setIsRebuilding(true);
    setRebuildFeedback(null);
    try {
      const res = await rebuildNotificationSchedules();
      setIsRebuilding(false);
      setRebuildFeedback(`تم إعادة بناء جدول الإشعارات بنجاح! عدد التنبيهات المجدولة: ${res.count}`);
      confetti({ particleCount: 50, spread: 50 });
      setTimeout(() => setRebuildFeedback(null), 4000);
    } catch {
      setIsRebuilding(false);
      setRebuildFeedback('تعذر إعادة بناء الجدول، يرجى المحاولة مرة أخرى.');
    }
  };

  const soundOptions: { id: NotificationSound; label: string }[] = [
    { id: 'default', label: 'افتراضي النظام' },
    { id: 'beep', label: 'صفارة قصيرة (Beep)' },
    { id: 'chime', label: 'جرس هادئ (Chime)' },
    { id: 'bell', label: 'جرس كلاسيكي (Bell)' },
    { id: 'gentle', label: 'نغمة لطيفة (Gentle)' },
  ];

  const priorityOptions: { id: NotificationPriority; label: string; desc: string }[] = [
    { id: 'low', label: 'منخفضة', desc: 'بدون صوت أو اهتزاز في شريط التنبيهات' },
    { id: 'normal', label: 'عادية', desc: 'تظهر في شريط التنبيهات بصوت افتراضي' },
    { id: 'high', label: 'عالية', desc: 'تنبيه منبثق أعلى الشاشة (Heads-up) مع صوت' },
    { id: 'max', label: 'قصوى (إلحاح شديد)', desc: 'تنبيه بارز جداً لا يختفي بسهولة' },
  ];

  const nextScheduledItem = pendingScheduledNotifications.length > 0 ? pendingScheduledNotifications[0] : null;

  return (
    <div className="space-y-4  animate-fadeIn">
      {/* Top Navigation Header */}
      <div className="pb-3.5 mb-5 border-b border-surface-border/80 dark:border-surface-border">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden p-2 rounded-xl bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main hover:text-primary transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs border border-surface-border/60 active:scale-95"
              title={_t('العودة للإعدادات', 'Back to Settings', 'العودة للإعدادات')}
            >
              <BackIcon className="w-4 h-4" />
            </button>

            <div className="p-2 rounded-xl bg-primary-soft text-primary dark:text-primary border border-primary-border/50 shrink-0">
              <Bell className="w-4.5 h-4.5" />
            </div>

            <h2 className="text-base sm:text-lg font-black text-text-main truncate">
              {_t('إعدادات الإشعارات والتنبيهات', 'Notification & Alert Settings', 'Benachrichtigungseinstellungen')}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleManualRebuild}
            disabled={isRebuilding}
            className="px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRebuilding ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{_t('تحديث الجدول', 'Sync Schedule', 'Zeitplan synchronisieren')}</span>
          </button>
        </div>

        <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
          {_t('تخصيص جميع إشعارات النظام، مواعيد التذكير بالححص، وتصريحات Android', 'Customize all system notifications, lesson reminders, and device permissions', 'Systembenachrichtigungen, Lektionserinnerungen und Geräteeinstellungen anpassen')}
        </p>
      </div>

      {/* Notification Rebuild Feedback Toast */}
      {rebuildFeedback && (
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary-border dark:border-primary-border text-primary dark:text-primary text-xs font-semibold flex items-center justify-between animate-slideUp">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>{rebuildFeedback}</span>
          </div>
          <button onClick={() => setRebuildFeedback(null)} className="p-1 hover:bg-primary/20 rounded-lg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Android System Permission Banner */}
      <div className="p-4 rounded-2xl bg-background/60 border border-surface-border/80 dark:border-surface-border space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              permissionStatus === 'granted' 
                ? 'bg-primary/10 text-primary dark:text-primary' 
                : 'bg-primary/10 text-primary dark:text-primary'
            }`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                حالة إذن إشعارات نظام Android
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  permissionStatus === 'granted'
                    ? 'bg-primary/20 text-primary dark:text-primary'
                    : 'bg-primary/20 text-primary dark:text-primary'
                }`}>
                  {permissionStatus === 'granted' ? 'مسموح بها ✓' : permissionStatus === 'denied' ? 'محظورة ✕' : 'يتطلب الإذن'}
                </span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {permissionStatus === 'granted'
                  ? 'الإشعارات مفعلة ومصرح لها بالعمل في الخلفية وعلى الشاشة الرئيسية.'
                  : 'الإشعارات محظورة من النظام. قد لا تصلك التنبيهات في موعدها بدون منح الإذن.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {permissionStatus !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                تفعيل الإذن الآن
              </button>
            )}
            {!exactAlarmGranted && (
              <button
                type="button"
                onClick={openExactAlarmSettings}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <AlarmClock className="w-3.5 h-3.5" />
                إذن المنبهات الدقيقة (Android)
              </button>
            )}
            <button
              type="button"
              onClick={openAndroidNotificationSettings}
              className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-text-main text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              إعدادات التطبيق في Android
            </button>
          </div>
        </div>

        {/* Heads-up outside the app info */}
        <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            <span>الظهور كإشعار منبثق فوق الشاشة وقفل الهاتف:</span>
            <strong className="text-emerald-500 font-bold">مُفعل بأعلى أولوية (Heads-Up Banner)</strong>
          </span>
          <button
            type="button"
            onClick={openExactAlarmSettings}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>ضبط المنبهات في النظام</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Next Scheduled Notification Highlight Card */}
      {nextScheduledItem && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/10 to-transparent border border-primary-border dark:border-primary-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary dark:text-primary shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-primary dark:text-primary">
                التنبيه القادم المجدول
              </span>
              <h4 className="text-sm font-bold text-text-main">
                {nextScheduledItem.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {nextScheduledItem.body}
              </p>
            </div>
          </div>

          <div className="text-right dir-ltr">
            <span className="inline-block px-3 py-1 rounded-lg bg-surface/80 dark:bg-surface/80 border border-surface-border text-xs font-black text-primary dark:text-primary">
              🕒 {nextScheduledItem.scheduledAt}
            </span>
          </div>
        </div>
      )}

      {/* 1. Master Control Toggle Card */}
      <div className="p-5 rounded-2xl bg-slate-900 text-white dark:bg-slate-800/90 shadow-md flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {notificationSettings.masterEnabled ? (
              <Bell className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-text-muted/70" />
            )}
            <h3 className="text-base font-black">
              المفتاح الرئيسي للتنبيهات (Master Switch)
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            عند إيقاف هذا المفتاح، سيتم تعطيل وإلغاء جدولة جميع التنبيهات في التطبيق ونظام Android فوراً.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleMaster}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            notificationSettings.masterEnabled ? 'bg-primary' : 'bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-surface shadow-lg ring-0 transition duration-200 ease-in-out ${
              notificationSettings.masterEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Main Settings Sections Grid (Disabled style if master is OFF) */}
      <div className={`space-y-4 transition-all ${!notificationSettings.masterEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        
        {/* 2. REMINDER TIMING CONTROLS */}
        <div className="p-5 rounded-2xl bg-surface border border-surface-border/80 dark:border-surface-border space-y-4 shadow-2xs">
          <div>
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              توقيت التذكير المسبق بالحصة
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              حدد الوقت الذي تريد إرسال التنبيه فيه قبل موعد بدء الحصّة المجدولة.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 30, 60].map(mins => {
              const isActive = !showCustomMinutes && notificationSettings.lessonReminderMinutesBefore === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleReminderMinutesChange(mins)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-surface-hover text-text-main hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  قبل {mins} دقائق
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowCustomMinutes(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                showCustomMinutes
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-hover text-text-main hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              قيمة مخصصة
            </button>
          </div>

          {showCustomMinutes && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-surface-border max-w-xs animate-fadeIn">
              <input
                type="number"
                min="1"
                max="1440"
                value={customMinutesInput}
                onChange={e => setCustomMinutesInput(e.target.value)}
                placeholder="أدخل عدد الدقائق..."
                className="w-full px-3 py-2 rounded-xl bg-surface-hover border border-surface-border dark:border-surface-border-soft text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleCustomMinutesSave}
                className="px-3 py-2 rounded-xl bg-primary hover:bg-primary text-white text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
              >
                حفظ
              </button>
            </div>
          )}
        </div>

        {/* CONTINUOUS ALARM MODE (وضع المنبه المستمر للحصص) */}
        <div className="p-5 rounded-2xl bg-surface border-2 border-primary/20 dark:border-primary/30 space-y-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-text-main flex items-center gap-2">
                  <AlarmClock className="w-5 h-5 text-primary" />
                  <span>{_t('وضع المنبه المستمر للتذكير بالحصص', 'Continuous Alarm Mode', 'Dauerhafter Lektions-Wecker')}</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
                  {_t('منبه حقيقي', 'Real Alarm', 'Echter Wecker')}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {_t(
                  'عند تفعيله، يرن التنبيه قبل موعد الحصة بصوت متواصل واهتزاز مثل منبه الهاتف الحقيقي تماماً حتى تقوم بإيقافه أو طلب غفوة، لتفادي تفويت الحصة.',
                  'When enabled, the pre-lesson alert rings continuously with vibration like a real alarm clock until dismissed or snoozed.',
                  'Läutet vor Lektionsbeginn durchgehend mit Vibration wie ein echter Wecker, bis er gestoppt oder geschlummert wird.'
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => updateNotificationSettings({ alarmModeEnabled: notificationSettings.alarmModeEnabled === false ? true : false })}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notificationSettings.alarmModeEnabled !== false ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  notificationSettings.alarmModeEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {notificationSettings.alarmModeEnabled !== false && (
            <div className="pt-3 border-t border-surface-border/60 space-y-4 animate-in fade-in duration-200">
              {/* Tone Selection */}
              <div>
                <label className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-2">
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('نغمة وصوت المنبه', 'Alarm Tone', 'Weckerton')}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'digital', label: _t('منبه رقمي (Beep)', 'Digital Alarm', 'Digital-Wecker') },
                    { id: 'loud_bell', label: _t('جرس قوي', 'Loud Bell', 'Laute Glocke') },
                    { id: 'radar', label: _t('إنذار رادار', 'Radar Alert', 'Radar-Signal') },
                    { id: 'gentle_chime', label: _t('نغمة هادئة', 'Gentle Chime', 'Sanfter Gong') }
                  ].map(toneItem => {
                    const isSelected = (notificationSettings.alarmTone || 'digital') === toneItem.id;
                    return (
                      <button
                        key={toneItem.id}
                        type="button"
                        onClick={() => updateNotificationSettings({ alarmTone: toneItem.id as AlarmTone })}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs font-black'
                            : 'bg-surface-hover/70 border-surface-border text-text-muted hover:bg-surface-hover'
                        }`}
                      >
                        {toneItem.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('مدة رنين المنبه المستمر', 'Alarm Duration', 'Weckdauer')}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { sec: 30, label: _t('30 ثانية', '30 seconds', '30 Sekunden') },
                    { sec: 60, label: _t('دقيقة واحدة (مستحسن)', '1 minute (Recommended)', '1 Minute (Empfohlen)') },
                    { sec: 120, label: _t('دقيقتان', '2 minutes', '2 Minuten') }
                  ].map(dur => {
                    const isSelected = (notificationSettings.alarmDurationSeconds || 60) === dur.sec;
                    return (
                      <button
                        key={dur.sec}
                        type="button"
                        onClick={() => updateNotificationSettings({ alarmDurationSeconds: dur.sec })}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface-hover text-text-main hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {dur.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Test Alarm Ringing Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-hover/40 p-3 rounded-xl border border-surface-border/50">
                <div className="text-xs text-text-muted flex items-center gap-2">
                  <BellRing className={`w-4 h-4 ${isTestingAlarm ? 'text-rose-500 animate-wiggle' : 'text-primary'}`} />
                  <span>
                    {isTestingAlarm
                      ? _t('المنبه يرن الآن بصوت متواصل...', 'Alarm is ringing continuously now...', 'Wecker klingelt jetzt...')
                      : _t('جرّب سماع المنبه وقوته للتأكد من ملاءمته لك', 'Preview the continuous alarm sound & volume', 'Weckerton probehören')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTestAlarm}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
                    isTestingAlarm
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/25 animate-pulse'
                      : 'bg-primary hover:bg-primary-hover text-white shadow-xs'
                  }`}
                >
                  {isTestingAlarm ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{_t('إيقاف تجربة المنبه', 'Stop Preview', 'Stoppen')}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{_t('تجربة صوت المنبه', 'Test Alarm Ringing', 'Wecker testen')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Outside The App Notification Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl">
                <div className="text-xs text-text-main flex items-start sm:items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold block text-text-main">
                      {_t('تجربة ظهور المنبه كإشعار خارجي (خارج البرنامج)', 'Test Alarm Outside App (Heads-Up)', 'Außerhalb der App testen')}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {countdownOutsideTest !== null
                        ? `⏳ قم بتصغير التطبيق أو قفل الهاتف الآن! سيظهر المنبه بعد (${countdownOutsideTest}) ثوانٍ...`
                        : _t('يمنحك مهلة 3 ثوانٍ لتصغير التطبيق أو قفل الشاشة لمشاهدة ظهور المنبه فوق كل التطبيقات مع أزرار التحكم.', 'Gives you 3 seconds to minimize or lock device to see heads-up notification outside app.', 'Gibt 3 Sekunden Zeit zum Minimieren.')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestOutsideNotification}
                  disabled={countdownOutsideTest !== null}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 ${
                    countdownOutsideTest !== null
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {countdownOutsideTest !== null
                      ? `⏳ انتظر (${countdownOutsideTest}) ثوانٍ...`
                      : _t('اختبر الظهور بالخارج الآن', 'Test Outside Now', 'Jetzt testen')}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. DAILY SUMMARY CONTROLS */}
        <div className="p-5 rounded-2xl bg-surface border border-surface-border/80 dark:border-surface-border space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                تنبيهات الملخص اليومي للمعلم (Daily Summary)
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                إرسال تقرير إشعار يومي ملخص لجدول اليوم، الحصص، والمستحقات المتبقية.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCategoryChange('dailySummary', { enabled: !notificationSettings.dailySummary.enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notificationSettings.dailySummary.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  notificationSettings.dailySummary.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {notificationSettings.dailySummary.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-surface-border animate-fadeIn">
              <div className="flex items-center justify-between max-w-sm">
                <label className="text-xs font-bold text-text-main">
                  وقت إرسال الملخص اليومي:
                </label>
                <input
                  type="time"
                  value={notificationSettings.dailySummaryTime}
                  onChange={e => updateNotificationSettings({ dailySummaryTime: e.target.value })}
                  className="px-3 py-1.5 rounded-xl bg-surface-hover border border-surface-border dark:border-surface-border-soft text-xs font-bold text-text-main"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-main block">
                  محتويات الملخص اليومي:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-hover/60 border border-surface-border/60 dark:border-surface-border-soft/60 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.dailySummaryIncludeLessons}
                      onChange={e => updateNotificationSettings({ dailySummaryIncludeLessons: e.target.checked })}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>حصص اليوم</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-hover/60 border border-surface-border/60 dark:border-surface-border-soft/60 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.dailySummaryIncludeIncome}
                      onChange={e => updateNotificationSettings({ dailySummaryIncludeIncome: e.target.checked })}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>الإيراد المتوقع</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-hover/60 border border-surface-border/60 dark:border-surface-border-soft/60 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.dailySummaryIncludePendingPayments}
                      onChange={e => updateNotificationSettings({ dailySummaryIncludePendingPayments: e.target.checked })}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>المدفوعات المعلقة</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. NOTIFICATION CATEGORIES LIST */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            فئات الإشعارات وإعدادات الصوت والأولوية
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category 1: Lesson Reminder */}
            <CategoryCard
              title="تنبيهات التذكير بالحصص"
              description="إرسال تذكير مسبق للمعلم ببدء الحصّة القادمة."
              icon={Clock}
              iconColor="text-primary bg-primary/10"
              config={notificationSettings.lessonReminder}
              onChange={updates => handleCategoryChange('lessonReminder', updates)}
              soundOptions={soundOptions}
              priorityOptions={priorityOptions}
            />

            {/* Category 2: Lesson Start */}
            <CategoryCard
              title="تنبيهات بدء الحصّة الآن"
              description="إشعار بارز في الموعد المحدد للحصة مباشرة."
              icon={Bell}
              iconColor="text-primary bg-primary/10"
              config={notificationSettings.lessonStart}
              onChange={updates => handleCategoryChange('lessonStart', updates)}
              soundOptions={soundOptions}
              priorityOptions={priorityOptions}
            />

            {/* Category 3: Payment Due */}
            <CategoryCard
              title="تنبيهات المستحقات والاشتراكات"
              description="تذكير بالطلاب المعلقة مدفوعاتهم وتجديدات الحزم."
              icon={DollarSign}
              iconColor="text-primary bg-primary/10"
              config={notificationSettings.paymentDue}
              onChange={updates => handleCategoryChange('paymentDue', updates)}
              soundOptions={soundOptions}
              priorityOptions={priorityOptions}
            />

            {/* Category 4: Attendance Reminder */}
            <CategoryCard
              title="تنبيهات تسجيل الحضور والغياب"
              description="تذكير لتأكيد وتسجيل حضور الطلاب بعد انتهاء زمن الحصة."
              icon={UserCheck}
              iconColor="text-primary bg-primary/10"
              config={notificationSettings.attendanceReminder}
              onChange={updates => handleCategoryChange('attendanceReminder', updates)}
              soundOptions={soundOptions}
              priorityOptions={priorityOptions}
            />

            {/* Category 5: School Lesson Reminder */}
            <CategoryCard
              title={_t('تذكير حصص المدرسة (قبل 5 دقائق)', 'School Lesson Reminder (5 mins before)', 'Schulstunden-Erinnerung (5 Min. vorher)')}
              description={_t('تذكير تلقائي مجدول قبل كل حصة بـ 5 دقائق من جدول المدرسة.', 'Automatic reminder 5 minutes before each school lesson starts.', 'Automatische Erinnerung 5 Minuten vor Beginn jeder Schulstunde.')}
              icon={Clock}
              iconColor="text-primary bg-primary/10"
              config={notificationSettings.schoolLessonReminder || { enabled: true, sound: 'beep', priority: 'high' }}
              onChange={updates => handleCategoryChange('schoolLessonReminder', updates)}
              soundOptions={soundOptions}
              priorityOptions={priorityOptions}
            />
          </div>
        </div>

        {/* 5. SCHEDULED NOTIFICATIONS MANAGEMENT QUEUE */}
        <div className="p-5 rounded-2xl bg-surface border border-surface-border/80 dark:border-surface-border space-y-4 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                قائمة الإشعارات المجدولة الحالية ({pendingScheduledNotifications.length})
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                عرض جميع التنبيهات المجدولة في خلفية النظام مع إمكانية إلغاء أي إشعار.
              </p>
            </div>

            {pendingScheduledNotifications.length > 0 && (
              <button
                type="button"
                onClick={cancelAllPendingScheduledNotifications}
                className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                إلغاء كافة الإشعارات المجدولة
              </button>
            )}
          </div>

          {pendingScheduledNotifications.length === 0 ? (
            <div className="p-5 text-center rounded-xl bg-surface-hover/40 border border-dashed border-surface-border dark:border-surface-border-soft">
              <CheckCircle2 className="w-8 h-8 text-text-muted/70 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {_t('لا توجد إشعارات معلقة في الانتظار حالياً', 'No pending scheduled notifications currently', 'Derzeit keine ausstehenden Benachrichtigungen')}
              </p>
              <p className="text-[11px] text-text-muted/70 mt-1">
                {_t('اضغط على "إعادة بناء الجدول" لأداء فحص فوري وجدولة الحصص القادمة.', 'Click "Rebuild Schedules" to perform an immediate check and schedule upcoming lessons.', 'Klicken Sie auf "Zeitpläne neu erstellen", um anstehende Lektionen zu planen.')}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pl-1">
              {pendingScheduledNotifications.map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-surface-hover/60 border border-surface-border/60 dark:border-surface-border-soft/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-text-main">
                        {item.title}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        ID: {item.id}
                      </span>
                    </div>
                    <p className="text-text-muted">
                      {item.body}
                    </p>
                    <p className="text-[10px] font-semibold text-primary dark:text-primary">
                      📅 الموعد: {item.scheduledAt}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => cancelSingleScheduledNotification(item.id)}
                    className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-primary hover:text-white text-slate-600 dark:text-slate-300 transition-all cursor-pointer shrink-0"
                    title="إلغاء هذا الإشعار"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// Internal Sub-component for each category options card
interface CategoryCardProps {
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  config: CategoryNotificationConfig;
  onChange: (updates: Partial<CategoryNotificationConfig>) => void;
  soundOptions: { id: NotificationSound; label: string }[];
  priorityOptions: { id: NotificationPriority; label: string; desc: string }[];
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  title, description, icon: Icon, iconColor, config, onChange, soundOptions, priorityOptions
}) => {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-surface-border/80 dark:border-surface-border space-y-3 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-text-main">
              {title}
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">
              {description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange({ enabled: !config.enabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            config.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
              config.enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <div className="space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-surface-border/80 animate-fadeIn text-xs">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" />
              صوت النغمة:
            </label>
            <select
              value={config.sound}
              onChange={e => onChange({ sound: e.target.value as NotificationSound })}
              className="px-2.5 py-1 rounded-lg bg-surface-hover border border-surface-border dark:border-surface-border-soft text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              {soundOptions.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              مستوى الأولوية:
            </label>
            <select
              value={config.priority}
              onChange={e => onChange({ priority: e.target.value as NotificationPriority })}
              className="px-2.5 py-1 rounded-lg bg-surface-hover border border-surface-border dark:border-surface-border-soft text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              {priorityOptions.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
