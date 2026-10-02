import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  User, Mail, DollarSign, Calendar, Clock, Target, 
  Save, CheckCircle2, ArrowLeft, ArrowRight, UserCheck, ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  onBack?: () => void;
}

export const TeacherProfileSection: React.FC<Props> = ({ onBack }) => {
  const { profile, updateProfile, language, _t } = useApp();
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
      avatarUrl: undefined,
      weeklyIncomeGoal: parsedWeekly && !isNaN(parsedWeekly) && parsedWeekly > 0 ? parsedWeekly : undefined,
      monthlyIncomeGoal: parsedMonthly && !isNaN(parsedMonthly) && parsedMonthly > 0 ? parsedMonthly : undefined,
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

  const teacherInitials = (displayNameAr || displayName || displayNameEn || 'م')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10 text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-surface-border">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden p-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border cursor-pointer transition-colors"
            >
              <BackIcon className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-text-main leading-tight">
                {_t('الملف التعريفي للمعلم', 'Teacher Profile', 'Lehrerprofil')}
              </h2>
              <p className="text-[10px] text-text-muted">
                {_t('البيانات الشخصية وإعدادات الهوية والعمل', 'Personal details, identity & work schedule', 'Persönliche Daten & Arbeitszeiten')}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSaveAll()}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95"
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

      {/* Top Identity Card - Clean & Coordinated without photo icons */}
      <div className="p-4 rounded-2xl bg-surface border border-surface-border shadow-xs space-y-4">
        {/* Profile Identity Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-3.5 border-b border-surface-border/80">
          <div className="flex items-center gap-3.5">
            {/* Teacher Badge Icon */}
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center font-black text-base shadow-xs shrink-0 select-none">
              {teacherInitials || <UserCheck className="w-6 h-6" />}
            </div>

            {/* Teacher Details & Status */}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-text-main truncate">
                  {displayNameAr || displayName || displayNameEn || _t('اسم المعلم', 'Teacher Name', 'Lehrername')}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-primary-soft text-primary font-bold text-[10px] border border-primary-border flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{_t('معلم معتمد', 'Certified Teacher', 'Zertifizierter Lehrer')}</span>
                </span>
              </div>
              <p className="text-[11px] text-text-muted font-mono truncate">
                {email || _t('لم يُحدد بريد إلكتروني بعد', 'No email specified yet', 'Keine E-Mail angegeben')}
              </p>
            </div>
          </div>

          {/* Currency Badge */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="px-3 py-1.5 rounded-xl bg-surface-hover border border-surface-border text-xs font-mono font-black text-text-main flex items-center gap-1.5 shadow-2xs">
              <span className="text-[10px] text-text-muted font-sans font-bold">{_t('العملة:', 'Currency:', 'Währung:')}</span>
              <span className="text-primary">{currency}</span>
            </span>
          </div>
        </div>

        {/* Inputs Grid - Perfectly Coordinated */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* English / German Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-main">
                {_t('الاسم بالإنجليزية / الألمانية', 'English / German Name', 'Name (Englisch / Deutsch)')}
              </label>
              <span className="text-[9px] font-bold text-primary bg-primary-soft px-1.5 py-0.2 rounded border border-primary-border">
                {_t('للشهادات', 'Certificates', 'Zertifikate')}
              </span>
            </div>
            <input
              type="text"
              value={displayNameEn}
              onChange={e => {
                setDisplayNameEn(e.target.value);
                if (!displayName) setDisplayName(e.target.value);
              }}
              placeholder="e.g. Herr Omar Hassan"
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          {/* Arabic Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-main">
                {_t('الاسم بالعربية', 'Arabic Name', 'Arabischer Name')}
              </label>
              <span className="text-[9px] font-bold text-primary bg-primary-soft px-1.5 py-0.2 rounded border border-primary-border">
                {_t('للتقارير والرسائل', 'Reports & Messages', 'Berichte')}
              </span>
            </div>
            <input
              type="text"
              value={displayNameAr}
              onChange={e => {
                setDisplayNameAr(e.target.value);
                if (!displayName) setDisplayName(e.target.value);
              }}
              placeholder="مثال: أ. عمر حسن"
              dir="rtl"
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-text-muted" />
              <span>{_t('البريد الإلكتروني', 'Email Address', 'E-Mail-Adresse')}</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teacher@example.com"
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-text-muted" />
              <span>{_t('عملة الحساب الافتراضية', 'Default Currency', 'Standardwährung')}</span>
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:ring-1 focus:ring-primary outline-none cursor-pointer transition-all"
            >
              <option value="EGP">EGP (ج.م) - الجنيه المصري</option>
              <option value="€">EUR (€) - Euro</option>
              <option value="$">USD ($) - US Dollar</option>
              <option value="SAR">SAR (ر.س) - الريال السعودي</option>
              <option value="AED">AED (د.إ) - الدرهم الإماراتي</option>
              <option value="KWD">KWD (د.ك) - الدينار الكويتي</option>
              <option value="QAR">QAR (ر.ق) - الريال القطري</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial Goals (Compact Row) */}
      <div className="p-3.5 rounded-2xl bg-surface border border-surface-border space-y-2.5 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-black text-xs text-text-main">
            {_t('الأهداف المالية (الدخل المستهدف)', 'Financial Income Goals', 'Finanzziele')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-muted flex items-center justify-between">
              <span>{_t('الهدف الأسبوعي', 'Weekly Target', 'Wöchentliches Ziel')}</span>
              <span className="font-mono text-[10px]">{currency}</span>
            </label>
            <input
              type="number"
              min="0"
              value={weeklyGoal}
              onChange={e => setWeeklyGoal(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-muted flex items-center justify-between">
              <span>{_t('الهدف الشهري', 'Monthly Target', 'Monatliches Ziel')}</span>
              <span className="font-mono text-[10px]">{currency}</span>
            </label>
            <input
              type="number"
              min="0"
              value={monthlyGoal}
              onChange={e => setMonthlyGoal(e.target.value)}
              placeholder="e.g. 20000"
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>
      </div>

      {/* Working Hours Weekly Schedule */}
      <div className="p-3.5 rounded-2xl bg-surface border border-surface-border space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-surface-border">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-black text-xs text-text-main">
              {_t('ساعات العمل الأسبوعية', 'Weekly Working Hours', 'Wöchentliche Arbeitszeiten')}
            </span>
          </div>
          <span className="text-[10px] text-text-muted font-bold">
            {_t('لتحديد أوقات الحصص المتاحة', 'For scheduling availability', 'Verfügbare Zeiten')}
          </span>
        </div>

        <div className="space-y-1.5">
          {daysConfig.map(day => {
            const dNum = day.num;
            const hours = weeklyHours[dNum] || { isOff: false, startTime: '09:00', endTime: '21:00' };

            return (
              <div
                key={dNum}
                className="flex items-center justify-between p-2 rounded-xl bg-surface-hover/70 border border-surface-border/60 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={!hours.isOff}
                    onChange={e => setWeeklyHours(prev => ({
                      ...prev,
                      [dNum]: { ...prev[dNum], isOff: !e.target.checked }
                    }))}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className={`text-xs font-bold ${hours.isOff ? 'text-text-muted line-through' : 'text-text-main'}`}>
                    {day.label}
                  </span>
                </div>

                {!hours.isOff ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={hours.startTime || '09:00'}
                      onChange={e => setWeeklyHours(prev => ({
                        ...prev,
                        [dNum]: { ...prev[dNum], startTime: e.target.value }
                      }))}
                      className="px-2 py-1 rounded-lg bg-surface border border-surface-border text-xs font-mono font-bold"
                    />
                    <span className="text-text-muted text-[10px]">→</span>
                    <input
                      type="time"
                      value={hours.endTime || '21:00'}
                      onChange={e => setWeeklyHours(prev => ({
                        ...prev,
                        [dNum]: { ...prev[dNum], endTime: e.target.value }
                      }))}
                      className="px-2 py-1 rounded-lg bg-surface border border-surface-border text-xs font-mono font-bold"
                    />
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-surface text-text-muted text-[10px] font-bold border border-surface-border">
                    {_t('عطلة', 'Day Off', 'Frei')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
