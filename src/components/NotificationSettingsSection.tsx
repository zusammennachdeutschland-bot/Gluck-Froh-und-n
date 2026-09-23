import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NotificationSound } from '../types';
import { 
  getNotificationPermission, requestNotificationPermission, 
  openAndroidNotificationSettings, checkExactAlarmPermission,
  openExactAlarmSettings, openOverlayPermissionSettings, sendTestOutsideNotification
} from '../services/notificationService';
import { 
  Bell, BellOff, Volume2, Shield, Clock, Calendar, DollarSign, 
  UserCheck, RefreshCw, Trash2, ArrowLeft, ArrowRight,
  Play, Square, Smartphone, Layers, Check, ExternalLink, ChevronDown, ChevronUp
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
    language, _t 
  } = useApp();

  const isRtl = language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean>(true);
  const [isRebuilding, setIsRebuilding] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<string>(
    notificationSettings.lessonReminderMinutesBefore.toString()
  );
  const [showCustomInput, setShowCustomInput] = useState<boolean>(
    ![5, 10, 15, 30, 60].includes(notificationSettings.lessonReminderMinutesBefore)
  );
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);
  const [showQueue, setShowQueue] = useState<boolean>(false);

  useEffect(() => {
    checkPermissions();
    const unsub = alarmAudioService.onStop(() => setIsPlayingTest(false));
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

  const handleToggleMaster = async () => {
    const next = !notificationSettings.masterEnabled;
    if (next && permissionStatus !== 'granted') {
      await requestNotificationPermission();
      await checkPermissions();
    }
    await updateNotificationSettings({ masterEnabled: next });
  };

  const handleTestTone = () => {
    if (isPlayingTest) {
      alarmAudioService.stopAlarm();
      setIsPlayingTest(false);
    } else {
      setIsPlayingTest(true);
      alarmAudioService.startAlarm(notificationSettings.alarmTone || 'digital', 15);
    }
  };

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      await rebuildNotificationSchedules();
      confetti({ particleCount: 30, spread: 35 });
    } finally {
      setIsRebuilding(false);
    }
  };

  const timingOptions = [5, 10, 15, 30, 60];
  const tones: { id: AlarmTone; label: string }[] = [
    { id: 'digital', label: _t('رقمي', 'Digital', 'Digital') },
    { id: 'loud_bell', label: _t('جرس', 'Bell', 'Glocke') },
    { id: 'radar', label: _t('رادار', 'Radar', 'Radar') },
    { id: 'gentle_chime', label: _t('هادئ', 'Gentle', 'Sanft') },
  ];

  return (
    <div className="space-y-3.5 max-w-3xl mx-auto pb-8 text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden p-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border cursor-pointer"
          >
            <BackIcon className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 font-bold text-sm text-text-main">
            <Bell className="w-4 h-4 text-primary" />
            <span>{_t('إعدادات الإشعارات والتنبيهات', 'Notification Settings', 'Benachrichtigungen')}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRebuild}
            disabled={isRebuilding}
            className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-text-main border border-surface-border font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title={_t('إعادة جدولة كل التنبيهات', 'Sync All Alarms', 'Synchronisieren')}
          >
            <RefreshCw className={`w-3 h-3 text-primary ${isRebuilding ? 'animate-spin' : ''}`} />
            <span>{_t('مزامنة', 'Sync', 'Sync')}</span>
          </button>
        </div>
      </div>

      {/* Master Toggle Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-surface-border shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${notificationSettings.masterEnabled ? 'bg-primary/10 text-primary' : 'bg-surface-hover text-text-muted'}`}>
            {notificationSettings.masterEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </div>
          <div>
            <span className="font-bold text-text-main text-xs block">
              {_t('تفعيل التنبيهات والمنبهات', 'Enable Notifications & Alarms', 'Benachrichtigungen aktivieren')}
            </span>
            <span className="text-[11px] text-text-muted">
              {notificationSettings.masterEnabled ? _t('نشط حالياً', 'Currently active', 'Aktiv') : _t('معطل بالكامل', 'Disabled', 'Deaktiviert')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleMaster}
          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            notificationSettings.masterEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              notificationSettings.masterEnabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className={`space-y-3 ${!notificationSettings.masterEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        
        {/* Section 1: Pre-Lesson Timing & Alarm Options */}
        <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-3 shadow-2xs">
          {/* Timing Chips */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="font-bold text-text-main flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{_t('وقت التنبيه المسبق للحصة:', 'Pre-Lesson Reminder:', 'Erinnerung vor Stunde:')}</span>
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {timingOptions.map(m => {
                const isSelected = !showCustomInput && notificationSettings.lessonReminderMinutesBefore === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomMinutes(m.toString());
                      updateNotificationSettings({ lessonReminderMinutesBefore: m });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary text-white shadow-2xs font-bold'
                        : 'bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                    }`}
                  >
                    {_t(`${m} د`, `${m}m`, `${m}m`)}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  showCustomInput
                    ? 'bg-primary text-white shadow-2xs font-bold'
                    : 'bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                }`}
              >
                {_t('مخصص', 'Custom', 'Eigener')}
              </button>

              {showCustomInput && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={customMinutes}
                    onChange={e => setCustomMinutes(e.target.value)}
                    onBlur={() => {
                      const v = parseInt(customMinutes, 10);
                      if (v > 0) updateNotificationSettings({ lessonReminderMinutesBefore: v });
                    }}
                    className="w-14 px-1.5 py-1 text-center rounded-lg bg-surface-hover border border-surface-border font-mono font-bold text-text-main"
                  />
                  <span className="text-[10px] text-text-muted">{_t('دقيقة', 'min', 'Min')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Alarm Mode & Tone Selection */}
          <div className="pt-2.5 border-t border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <span className="font-bold text-text-main">
                {_t('وضع المنبه المستمر (Alarm)', 'Continuous Alarm', 'Dauerhafter Wecker')}
              </span>
              <button
                type="button"
                onClick={() => updateNotificationSettings({ alarmModeEnabled: notificationSettings.alarmModeEnabled === false ? true : false })}
                className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  notificationSettings.alarmModeEnabled !== false ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition ${
                    notificationSettings.alarmModeEnabled !== false ? 'ltr:translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Tone selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {tones.map(tone => {
                const isSelected = (notificationSettings.alarmTone || 'digital') === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => updateNotificationSettings({ alarmTone: tone.id })}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary/15 text-primary border border-primary/40 font-bold'
                        : 'bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                    }`}
                  >
                    {tone.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleTestTone}
                className={`p-1 rounded-md text-white font-bold cursor-pointer transition-all flex items-center justify-center ${
                  isPlayingTest ? 'bg-rose-500 animate-pulse' : 'bg-primary hover:bg-primary-hover'
                }`}
                title={_t('تجربة الصوت', 'Test Tone', 'Ton testen')}
              >
                {isPlayingTest ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Clean Category Toggles */}
        <div className="p-3 rounded-xl bg-surface border border-surface-border divide-y divide-surface-border shadow-2xs">
          {/* Private Lessons */}
          <div className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-text-main">
                {_t('تنبيه الحصص الخاصة', 'Private Lesson Reminder', 'Private Lektionen')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.lessonReminder?.enabled ?? true}
              onChange={e => updateNotificationSettings({ lessonReminder: { ...notificationSettings.lessonReminder, enabled: e.target.checked } })}
              className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
          </div>

          {/* School Lessons */}
          <div className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-text-main">
                {_t('تنبيه حصص المدرسة (قبل 5 دقائق)', 'School Lessons Alert (5m)', 'Schulstunden (5m)')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.schoolLessonReminder?.enabled ?? true}
              onChange={e => updateNotificationSettings({ schoolLessonReminder: { ...notificationSettings.schoolLessonReminder, enabled: e.target.checked } })}
              className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Lesson Start */}
          <div className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-text-main">
                {_t('تنبيه بدء الحصة في موعدها', 'Lesson Start Alert', 'Lektionsbeginn')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.lessonStart?.enabled ?? true}
              onChange={e => updateNotificationSettings({ lessonStart: { ...notificationSettings.lessonStart, enabled: e.target.checked } })}
              className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Payments */}
          <div className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-text-main">
                {_t('تنبيهات المدفوعات والاشتراكات', 'Payment Reminders', 'Zahlungserinnerungen')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.paymentDue?.enabled ?? true}
              onChange={e => updateNotificationSettings({ paymentDue: { ...notificationSettings.paymentDue, enabled: e.target.checked } })}
              className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Attendance */}
          <div className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-text-main">
                {_t('تذكير تسجيل الحضور والغياب', 'Attendance Follow-up', 'Anwesenheitserfassung')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.attendanceReminder?.enabled ?? true}
              onChange={e => updateNotificationSettings({ attendanceReminder: { ...notificationSettings.attendanceReminder, enabled: e.target.checked } })}
              className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Daily Summary */}
          <div className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-text-main">
                {_t('الملخص اليومي الصباحي', 'Daily Summary Report', 'Tägliche Zusammenfassung')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {notificationSettings.dailySummary?.enabled && (
                <input
                  type="time"
                  value={notificationSettings.dailySummaryTime || '07:30'}
                  onChange={e => updateNotificationSettings({ dailySummaryTime: e.target.value })}
                  className="px-1.5 py-0.5 rounded bg-surface-hover border border-surface-border text-[11px] font-mono font-bold text-text-main"
                />
              )}
              <input
                type="checkbox"
                checked={notificationSettings.dailySummary?.enabled ?? false}
                onChange={e => updateNotificationSettings({ dailySummary: { ...notificationSettings.dailySummary, enabled: e.target.checked } })}
                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 3: System Permissions & Overlays (Compact Buttons) */}
        <div className="p-3 rounded-xl bg-surface border border-surface-border flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="font-bold text-text-main">
              {_t('صلاحيات النظام والتطبيقات:', 'System Permissions:', 'Systemberechtigungen:')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {permissionStatus !== 'granted' ? (
              <button
                type="button"
                onClick={async () => {
                  await requestNotificationPermission();
                  await checkPermissions();
                }}
                className="px-2.5 py-1 rounded-lg bg-primary text-white font-bold text-[11px] cursor-pointer"
              >
                {_t('تفعيل الإشعارات', 'Enable Push', 'Aktivieren')}
              </button>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                <Check className="w-3 h-3" />
                {_t('الإشعارات مفعلة', 'Push Granted', 'Aktiviert')}
              </span>
            )}

            <button
              type="button"
              onClick={openOverlayPermissionSettings}
              className="px-2.5 py-1 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border font-semibold text-[11px] cursor-pointer flex items-center gap-1"
            >
              <Layers className="w-3 h-3 text-primary" />
              <span>{_t('العوم فوق التطبيقات (Overlay)', 'Overlay Permission', 'Über anderen Apps')}</span>
            </button>

            <button
              type="button"
              onClick={openExactAlarmSettings}
              className="px-2.5 py-1 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border font-semibold text-[11px] cursor-pointer"
            >
              {_t('المنبهات الدقيقة', 'Exact Alarms', 'Genaue Alarme')}
            </button>
          </div>
        </div>

        {/* Section 4: Scheduled Alerts Queue (Collapsible) */}
        <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-2 shadow-2xs">
          <button
            type="button"
            onClick={() => setShowQueue(!showQueue)}
            className="w-full flex items-center justify-between cursor-pointer text-text-main font-bold"
          >
            <span className="flex items-center gap-1.5">
              <span>{_t('قائمة التنبيهات المجدولة', 'Scheduled Alerts Queue', 'Geplante Alarme')}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted font-mono text-[10px]">
                {pendingScheduledNotifications.length}
              </span>
            </span>
            {showQueue ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
          </button>

          {showQueue && (
            <div className="pt-2 border-t border-surface-border space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {pendingScheduledNotifications.length === 0 ? (
                <div className="py-3 text-center text-text-muted text-[11px]">
                  {_t('لا توجد تنبيهات مجدولة حالياً', 'No pending scheduled alerts', 'Keine ausstehenden Alarme')}
                </div>
              ) : (
                <>
                  <div className="flex justify-end pb-1">
                    <button
                      type="button"
                      onClick={cancelAllPendingScheduledNotifications}
                      className="text-rose-600 dark:text-rose-400 font-semibold text-[10px] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{_t('مسح الكل', 'Clear all', 'Alle löschen')}</span>
                    </button>
                  </div>
                  {pendingScheduledNotifications.map((item, idx) => (
                    <div
                      key={`${item.id}_${item.category || ''}_${idx}`}
                      className="p-2 rounded-lg bg-surface-hover flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-text-main block truncate">{item.title}</span>
                        <span className="text-[10px] text-text-muted font-mono">{item.scheduledAt}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => cancelSingleScheduledNotification(item.id)}
                        className="p-1 rounded text-text-muted hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
