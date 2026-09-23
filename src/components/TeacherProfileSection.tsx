import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AvatarImage } from './AvatarImage';
import { BuddyCustomizer } from './buddy/BuddyCustomizer';
import { BuddyCustomization, DEFAULT_BUDDY_CUSTOMIZATION } from '../types/buddy';
import { getEffectiveSchoolEndForDay, formatTime } from '../utils/timeUtils';
import { 
  User, Mail, DollarSign, Calendar, Clock, Target, 
  Save, CheckCircle2, ArrowLeft, ArrowRight, BookOpen, Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  onBack?: () => void;
}

export const TeacherProfileSection: React.FC<Props> = ({ onBack }) => {
  const { profile, updateProfile, language, _t, t } = useApp();
  const isRtl = language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  // Basic Info
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [displayNameEn, setDisplayNameEn] = useState(profile.displayNameEn || profile.nameEn || '');
  const [displayNameAr, setDisplayNameAr] = useState(profile.displayNameAr || profile.nameAr || '');
  const [email, setEmail] = useState(profile.email || '');
  const [currency, setCurrency] = useState(profile.currency || 'EGP');

  // Goals
  const [weeklyGoal, setWeeklyGoal] = useState<string>(
    profile.weeklyIncomeGoal ? String(profile.weeklyIncomeGoal) : ''
  );
  const [monthlyGoal, setMonthlyGoal] = useState<string>(
    profile.monthlyIncomeGoal ? String(profile.monthlyIncomeGoal) : ''
  );

  // Buddy Avatar
  const [buddyConfig, setBuddyConfig] = useState<BuddyCustomization>(
    () => profile.buddyCustomization || DEFAULT_BUDDY_CUSTOMIZATION
  );

  // Working Hours
  const [weeklyHours, setWeeklyHours] = useState(profile.weeklyWorkingHours || {
    0: { isOff: true, startTime: '09:00', endTime: '21:00' },
    1: { isOff: false, startTime: '09:00', endTime: '21:00' },
    2: { isOff: false, startTime: '09:00', endTime: '21:00' },
    3: { isOff: false, startTime: '09:00', endTime: '21:00' },
    4: { isOff: false, startTime: '09:00', endTime: '21:00' },
    5: { isOff: false, startTime: '09:00', endTime: '21:00' },
    6: { isOff: false, startTime: '09:00', endTime: '21:00' },
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const rawWeekly = weeklyGoal.trim();
    const rawMonthly = monthlyGoal.trim();
    const parsedWeekly = rawWeekly ? Math.max(0, parseFloat(rawWeekly)) : undefined;
    const parsedMonthly = rawMonthly ? Math.max(0, parseFloat(rawMonthly)) : undefined;

    const primaryName = displayName.trim() || displayNameEn.trim() || displayNameAr.trim() || 'Teacher';

    updateProfile({
      displayName: primaryName,
      displayNameEn: displayNameEn.trim(),
      displayNameAr: displayNameAr.trim(),
      nameEn: displayNameEn.trim(),
      nameAr: displayNameAr.trim(),
      email: email.trim(),
      currency,
      weeklyIncomeGoal: parsedWeekly && !isNaN(parsedWeekly) && parsedWeekly > 0 ? parsedWeekly : undefined,
      monthlyIncomeGoal: parsedMonthly && !isNaN(parsedMonthly) && parsedMonthly > 0 ? parsedMonthly : undefined,
      buddyCustomization: buddyConfig,
      weeklyWorkingHours: weeklyHours
    });

    setIsSaved(true);
    confetti({ particleCount: 35, spread: 40 });
    setTimeout(() => setIsSaved(false), 3000);
  };

  const daysConfig = [
    { num: 6, label: _t('السبت', 'Saturday', 'Samstag') },
    { num: 0, label: _t('الأحد', 'Sunday', 'Sonntag') },
    { num: 1, label: _t('الإثنين', 'Monday', 'Montag') },
    { num: 2, label: _t('الثلاثاء', 'Tuesday', 'Dienstag') },
    { num: 3, label: _t('الأربعاء', 'Wednesday', 'Mittwoch') },
    { num: 4, label: _t('الخميس', 'Thursday', 'Donnerstag') },
    { num: 5, label: _t('الجمعة', 'Friday', 'Freitag') },
  ];

  return (
    <div className="space-y-3.5 max-w-3xl mx-auto pb-8 text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-surface-border">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden p-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border cursor-pointer"
            >
              <BackIcon className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 font-bold text-sm text-text-main">
            <User className="w-4 h-4 text-primary" />
            <span>{_t('الملف التعريفي للمعلم', 'Teacher Profile', 'Lehrerprofil')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSaveAll()}
          className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{_t('حفظ التغييرات', 'Save Changes', 'Speichern')}</span>
        </button>
      </div>

      {/* Save Toast Feedback */}
      {isSaved && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{_t('تم حفظ بيانات الملف التعريفي بنجاح', 'Profile updated successfully', 'Profil erfolgreich gespeichert')}</span>
        </div>
      )}

      {/* Basic Identity Card */}
      <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <AvatarImage
            name={displayName || displayNameAr || displayNameEn || 'Teacher'}
            className="w-11 h-11 rounded-xl font-bold text-base ring-2 ring-primary/20 shadow-2xs"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-text-main truncate">
              {displayName || displayNameAr || displayNameEn || _t('اسم المعلم', 'Teacher Name', 'Lehrername')}
            </h3>
            <p className="text-[11px] text-text-muted font-mono truncate">{email || _t('لم يُحدد بريد إلكتروني', 'No email specified', 'Keine E-Mail')}</p>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-surface-hover border border-surface-border text-[11px] font-mono font-bold text-text-muted">
            {currency}
          </span>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-surface-border">
          {/* English Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-main">
                {_t('الاسم بالإنجليزية / الألمانية', 'English / German Name', 'Name (Englisch / Deutsch)')}
              </label>
              <span className="text-[9px] font-semibold text-primary">
                {_t('للشهادات', 'Certificates', 'Zertifikate')}
              </span>
            </div>
            <input
              type="text"
              value={displayNameEn}
              onChange={e => setDisplayNameEn(e.target.value)}
              placeholder="e.g. Herr Omar Hassan"
              className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          {/* Arabic Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-main">
                {_t('الاسم بالعربية', 'Arabic Name', 'Arabischer Name')}
              </label>
              <span className="text-[9px] font-semibold text-primary">
                {_t('للتقارير والرسائل', 'Reports & Messages', 'Berichte')}
              </span>
            </div>
            <input
              type="text"
              value={displayNameAr}
              onChange={e => setDisplayNameAr(e.target.value)}
              placeholder="مثال: أ. عمر حسن"
              dir="rtl"
              className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
              <Mail className="w-3 h-3 text-text-muted" />
              <span>{_t('البريد الإلكتروني', 'Email Address', 'E-Mail')}</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teacher@example.com"
              className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-text-main flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-text-muted" />
              <span>{_t('عملة الحساب الافتراضية', 'Default Currency', 'Währung')}</span>
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-bold text-text-main focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="EGP">EGP (ج.م)</option>
              <option value="€">EUR (€)</option>
              <option value="$">USD ($)</option>
              <option value="SAR">SAR (ر.س)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="KWD">KWD (د.ك)</option>
              <option value="QAR">QAR (ر.ق)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial Goals (Compact Row) */}
      <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-text-main">
            {_t('الأهداف المالية (الدخل المستهدف)', 'Financial Income Goals', 'Finanzziele')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-muted flex items-center justify-between">
              <span>{_t('الهدف الأسبوعي:', 'Weekly Target:', 'Wochenziel:')}</span>
              <span className="font-mono text-[10px]">{currency}</span>
            </label>
            <input
              type="number"
              min="0"
              value={weeklyGoal}
              onChange={e => setWeeklyGoal(e.target.value)}
              placeholder="0"
              className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-muted flex items-center justify-between">
              <span>{_t('الهدف الشهري:', 'Monthly Target:', 'Monatsziel:')}</span>
              <span className="font-mono text-[10px]">{currency}</span>
            </label>
            <input
              type="number"
              min="0"
              value={monthlyGoal}
              onChange={e => setMonthlyGoal(e.target.value)}
              placeholder="0"
              className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>
      </div>

      {/* Weekly Working Hours (Clean Compact Table) */}
      <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="font-bold text-text-main">
              {_t('أوقات العمل الأسبوعية وساعات الفراغ', 'Weekly Working Hours', 'Wöchentliche Arbeitszeiten')}
            </span>
          </div>
        </div>

        <div className="space-y-1 divide-y divide-surface-border/60">
          {daysConfig.map(day => {
            const dNum = day.num as keyof typeof weeklyHours;
            const hours = weeklyHours[dNum] || { isOff: false, startTime: '09:00', endTime: '21:00' };
            const schoolEndMinutes = getEffectiveSchoolEndForDay(day.num, profile);
            const hasSchool = schoolEndMinutes > 0;
            const schoolEndStr = hasSchool ? formatTime(schoolEndMinutes) : '';

            return (
              <div
                key={day.num}
                className={`pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs ${
                  hours.isOff ? 'opacity-50' : ''
                }`}
              >
                {/* Day checkbox */}
                <label className="flex items-center gap-2 cursor-pointer min-w-[80px]">
                  <input
                    type="checkbox"
                    checked={!hours.isOff}
                    onChange={e => setWeeklyHours(prev => ({
                      ...prev,
                      [dNum]: { ...prev[dNum], isOff: !e.target.checked }
                    }))}
                    className="w-3.5 h-3.5 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="font-bold text-text-main">{day.label}</span>
                </label>

                {/* Timing or Off Badge */}
                {!hours.isOff ? (
                  <div className="flex items-center gap-1.5">
                    {hasSchool ? (
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        <span>{schoolEndStr}</span>
                        <span className="text-[9px] text-text-muted">({_t('بعد المدرسة', 'School End', 'Schulende')})</span>
                      </span>
                    ) : (
                      <input
                        type="time"
                        value={hours.startTime || '09:00'}
                        onChange={e => setWeeklyHours(prev => ({
                          ...prev,
                          [dNum]: { ...prev[dNum], startTime: e.target.value }
                        }))}
                        className="px-1.5 py-0.5 rounded bg-surface-hover border border-surface-border text-xs font-mono font-bold"
                      />
                    )}

                    <span className="text-text-muted text-[10px]">→</span>

                    <input
                      type="time"
                      value={hours.endTime || '21:00'}
                      onChange={e => setWeeklyHours(prev => ({
                        ...prev,
                        [dNum]: { ...prev[dNum], endTime: e.target.value }
                      }))}
                      className="px-1.5 py-0.5 rounded bg-surface-hover border border-surface-border text-xs font-mono font-bold"
                    />
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-surface-hover text-text-muted text-[10px] font-bold">
                    {_t('عطلة', 'Day Off', 'Frei')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Glück Buddy Avatar Customizer */}
      <div className="p-3 rounded-xl bg-surface border border-surface-border shadow-2xs">
        <BuddyCustomizer
          value={buddyConfig}
          onChange={newConfig => {
            setBuddyConfig(newConfig);
            updateProfile({ buddyCustomization: newConfig });
          }}
        />
      </div>
    </div>
  );
};
