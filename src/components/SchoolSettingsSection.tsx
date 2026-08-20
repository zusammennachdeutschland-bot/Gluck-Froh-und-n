import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SchoolSettings, SchoolDayPresence, SchoolPeriodSettings } from '../types';
import { 
  Clock, Calendar, BookOpen, RotateCcw, Save, CheckCircle2, 
  Plus, Trash2, ArrowRight, ToggleLeft, ToggleRight, ArrowLeft, ArrowUpRight
} from 'lucide-react';
import { 
  getSchoolSettings, 
  calculatePeriodsTimings, 
  DEFAULT_SCHOOL_SETTINGS 
} from '../utils/schoolUtils';

interface Props {
  onBack?: () => void;
}

export const SchoolSettingsSection: React.FC<Props> = ({ onBack }) => {
  const { profile, updateProfile, language, _t, t } = useApp();
  
  // Local state initialized with fallback
  const currentSettings = getSchoolSettings(profile);
  
  const [generalArrival, setGeneralArrival] = useState<string>(() => {
    const firstActive = Object.values(currentSettings.presence).find(p => p.active);
    return firstActive?.arrivalTime || '07:30';
  });
  const [generalDeparture, setGeneralDeparture] = useState<string>(() => {
    const firstActive = Object.values(currentSettings.presence).find(p => p.active);
    return firstActive?.departureTime || '14:30';
  });
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>(() => {
    const res: Record<string, boolean> = {};
    Object.keys(currentSettings.presence).forEach(k => {
      res[k] = currentSettings.presence[k].active;
    });
    return res;
  });

  const [periodsCount, setPeriodsCount] = useState<number>(currentSettings.periodSettings.periodsCount);
  const [firstPeriodStart, setFirstPeriodStart] = useState<string>(currentSettings.periodSettings.firstPeriodStart);
  const [defaultDuration, setDefaultDuration] = useState<number>(currentSettings.periodSettings.defaultDuration);
  const [customDurations, setCustomDurations] = useState<Record<number, number>>(
    currentSettings.periodSettings.customDurations || {}
  );
  
  const [showToast, setShowToast] = useState(false);
  const isRtl = language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const daysList = [
    { key: '0', label: _t('الأحد', 'Sunday', 'Sonntag') },
    { key: '1', label: _t('الإثنين', 'Monday', 'Montag') },
    { key: '2', label: _t('الثلاثاء', 'Tuesday', 'Dienstag') },
    { key: '3', label: _t('الأربعاء', 'Wednesday', 'Mittwoch') },
    { key: '4', label: _t('الخميس', 'Thursday', 'Donnerstag') },
    { key: '5', label: _t('الجمعة', 'Friday', 'Freitag') },
    { key: '6', label: _t('السبت', 'Saturday', 'Samstag') }
  ];

  // Recalculate generated period list timings
  const periodSettingsObj: SchoolPeriodSettings = {
    periodsCount,
    firstPeriodStart,
    defaultDuration,
    customDurations
  };
  const generatedPeriods = calculatePeriodsTimings(periodSettingsObj);

  // Handle saving to profile
  const handleSaveSettings = () => {
    const updatedPresence: Record<string, SchoolDayPresence> = {};
    daysList.forEach(day => {
      updatedPresence[day.key] = {
        active: !!activeDays[day.key],
        arrivalTime: generalArrival,
        departureTime: generalDeparture
      };
    });

    const updatedSchoolSettings: SchoolSettings = {
      presence: updatedPresence,
      periodSettings: {
        periodsCount,
        firstPeriodStart,
        defaultDuration,
        customDurations
      },
      schedule: currentSettings.schedule // preserve existing schedule data
    };

    updateProfile({
      schoolSettings: updatedSchoolSettings
    });

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Handle custom duration updates
  const handleCustomDurationChange = (periodNum: number, minutes: number) => {
    if (minutes <= 0 || isNaN(minutes)) return;
    setCustomDurations(prev => ({
      ...prev,
      [periodNum]: minutes
    }));
  };

  // Reset a specific period duration back to default
  const handleResetPeriodDuration = (periodNum: number) => {
    setCustomDurations(prev => {
      const copy = { ...prev };
      delete copy[periodNum];
      return copy;
    });
  };

  // Clear all hand-customized periods duration
  const handleResetAllDurations = () => {
    setCustomDurations({});
  };

  return (
    <div className="space-y-3.5" id="school-settings-container">
      {/* Save Toast Banner */}
      {showToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg font-bold text-xs animate-bounce" id="school-toast-alert">
          <CheckCircle2 className="w-4 h-4" />
          <span>{_t('تم حفظ إعدادات المدرسة بنجاح!', 'School settings saved successfully!', 'Schuleinstellungen erfolgreich gespeichert!')}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="pb-2.5 mb-3.5 border-b border-surface-border/80 dark:border-surface-border">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden p-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main hover:text-primary transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs border border-surface-border/60 active:scale-95"
              title={t('auto_back_to_settings')}
            >
              <BackIcon className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="p-1.5 rounded-lg bg-primary-soft text-primary dark:text-primary border border-primary-border/50 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>

          <h2 className="text-sm sm:text-base font-black text-text-main truncate">
            {_t('إعدادات المدرسة الشخصية', 'Personal School Settings', 'Persönliche Schuleinstellungen')}
          </h2>
        </div>

        <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
          {_t('تعيين مواعيد الحضور والانصراف، وتهيئة الحصص الدراسية اليومية لربطها التلقائي بمحرك الساعات وتقويم التطبيق.', 'Set arrival/departure times and customize daily school periods for automatic schedule synchronization.', 'Legen Sie Ankunfts- und Abfahrtszeiten fest und passen Sie die Schulstunden an.')}
        </p>
      </div>

      {/* SECTION 1: Presence Times (أوقات التواجد) */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3" id="school-presence-container">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{_t('أوقات التواجد في المدرسة', 'School Presence Times', 'Schulpräsenzzeiten')}</span>
        </h3>

        {/* Unified Arrival & Departure Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('وقت الحضور العام', 'School Attendance Time (Arrival)', 'Ankunftszeit')}
            </label>
            <div className="relative">
              <input
                type="time"
                value={generalArrival}
                onChange={(e) => setGeneralArrival(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('وقت الانصراف العام', 'School Departure Time (Departure)', 'Abfahrtszeit')}
            </label>
            <div className="relative">
              <input
                type="time"
                value={generalDeparture}
                onChange={(e) => setGeneralDeparture(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>
        </div>

        {/* School Days Selector */}
        <div className="pt-2.5 border-t border-surface-border/60 space-y-2">
          <label className="text-xs font-bold text-text-main block">
            {_t('أيام المدرسة المفعلة', 'Active School Days', 'Aktive Schultage')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
            {daysList.map((day) => {
              const isActive = activeDays[day.key];
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => {
                    setActiveDays(prev => ({
                      ...prev,
                      [day.key]: !prev[day.key]
                    }));
                  }}
                  className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                    isActive
                      ? 'bg-primary-soft border-primary-border text-primary'
                      : 'bg-surface-hover border-surface-border text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="truncate">{day.label}</div>
                  <div className={`text-[9px] mt-0.5 font-bold ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                    {isActive ? _t('مفعل', 'Active', 'Aktiv') : _t('مغلق', 'Off', 'Aus')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: Period Config */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span>{_t('إعداد الحصص المدرسية', 'School Period Structure', 'Schulstunden-Struktur')}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Periods Count */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('عدد الحصص اليومية', 'Daily Periods Count', 'Tägliche Stundenanzahl')}
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={periodsCount}
              onChange={(e) => setPeriodsCount(Math.min(15, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary text-text-main font-mono"
            />
          </div>

          {/* First Period Start */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('بداية الحصة الأولى', 'First Period Start', 'Beginn 1. Stunde')}
            </label>
            <input
              type="time"
              value={firstPeriodStart}
              onChange={(e) => setFirstPeriodStart(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary text-text-main font-mono"
            />
          </div>

          {/* Default Duration */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('المدة الافتراضية (دقيقة)', 'Default Duration (min)', 'Standard-Dauer (Min.)')}
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Math.min(120, Math.max(5, parseInt(e.target.value, 10) || 45)))}
              className="w-full px-3 py-1.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary text-text-main font-mono"
            />
          </div>
        </div>

        {/* Generated Sequential Table */}
        <div className="border border-surface-border rounded-lg overflow-hidden mt-2.5">
          <div className="bg-surface-hover p-2.5 flex items-center justify-between border-b border-surface-border">
            <span className="text-xs font-bold text-text-main">
              {_t('الخط الزمني المتسلسل للحصص', 'Sequential Period Timeline', 'Fortlaufender Stunden-Zeitplan')}
            </span>
            {Object.keys(customDurations).length > 0 && (
              <button
                type="button"
                onClick={handleResetAllDurations}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 focus:outline-none cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{_t('إعادة الجميع للافتراضي', 'Reset All to Default', 'Alle zurücksetzen')}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-surface-border max-h-64 overflow-y-auto">
            {generatedPeriods.map((period) => (
              <div 
                key={period.periodNumber}
                className={`p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  period.isCustom ? 'bg-primary-soft/30 dark:bg-primary-soft/15' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-primary-soft text-primary flex items-center justify-center text-[10px] font-black shrink-0">
                    {period.periodNumber}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-text-main">
                      {_t(`الحصة ${period.periodNumber}`, `Period ${period.periodNumber}`, `Stunde ${period.periodNumber}`)}
                    </div>
                    <div className="text-[10px] font-semibold text-text-muted font-mono">
                      {period.startTime} ← {period.endTime}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Duration Controller */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-text-muted">
                      {_t('المدة:', 'Duration:', 'Dauer:')}
                    </span>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={period.duration}
                      onChange={(e) => handleCustomDurationChange(period.periodNumber, Math.min(120, Math.max(5, parseInt(e.target.value, 10) || defaultDuration)))}
                      className="w-14 px-1.5 py-0.5 bg-surface-hover border border-surface-border rounded text-xs font-bold text-center text-text-main font-mono"
                    />
                    <span className="text-[10px] text-text-muted">{_t('د', 'm', 'Min')}</span>
                  </div>

                  {/* Reset Button */}
                  {period.isCustom ? (
                    <button
                      type="button"
                      onClick={() => handleResetPeriodDuration(period.periodNumber)}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors cursor-pointer"
                      title={_t('إعادة للمدة الافتراضية', 'Reset to Default', 'Auf Standard zurücksetzen')}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-[9px] font-bold text-text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                      {_t('افتراضي', 'Default', 'Standard')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAVE CONTROLLER */}
        <div className="pt-1 flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
            id="save-school-settings-btn"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{_t('حفظ التغييرات', 'Save Changes', 'Änderungen speichern')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
