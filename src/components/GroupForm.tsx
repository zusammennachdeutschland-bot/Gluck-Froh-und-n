import React, { useState } from 'react';
import { Group, GradeLevel, LessonType, PaymentCycle, ScheduleRecurrence } from '../types';
import { PREDEFINED_GRADES, COURSE_LEVELS, SCHOOL_GRADES } from '../data/initialData';
import { useApp } from '../context/AppContext';
import { Video, MapPin, DollarSign, Calendar, Sparkles, Repeat, Check, Info } from 'lucide-react';
import { isGroupPerLesson } from '../utils/lessonUtils';
import { getCurrentAlternatingWeek } from '../utils/scheduleUtils';

export interface GroupFormData {
  name: string;
  grade: GradeLevel;
  type: LessonType;
  paymentCycle: PaymentCycle;
  paymentModel?: 'per_session' | 'package';
  monthlyPackagePrice: number;
  pricePerSession: number;
  sessionCount: number;
  startingSessionNumber: number;
  defaultFinanceAccountId?: string;
  scheduleRecurrence: ScheduleRecurrence;
  scheduleDays: string[];
  scheduleTime: string;
  dayTimes: Record<string, string>;
  zoomLink: string;
  meetLink: string;
  address: string;
  color: string;
  lessonDurationMinutes: number;
  whatsAppGroupLink: string;
}

interface GroupFormProps {
  initialData?: Partial<Group>;
  onSubmit: (data: GroupFormData) => void;
  isEdit?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const GroupForm: React.FC<GroupFormProps> = ({ initialData, onSubmit, isEdit, children, className }) => {
  const { profile, language, t, _t } = useApp();

  
  const [name, setName] = useState(initialData?.name || '');
  const [grade, setGrade] = useState<GradeLevel>(initialData?.grade || 'Grade 9');
  const [type, setType] = useState<LessonType>(initialData?.type || 'online');
  const isInitialPerLesson = isGroupPerLesson(initialData);
  const [paymentCycle, setPaymentCycle] = useState<PaymentCycle>(isInitialPerLesson ? 'per_lesson' : (initialData?.paymentCycle || 'monthly'));
  const [monthlyPackagePrice, setMonthlyPackagePrice] = useState(initialData?.monthlyPackagePrice || 1200);
  const [pricePerSession, setPricePerSession] = useState(initialData?.pricePerSession || (initialData?.monthlyPackagePrice ? Math.round(initialData.monthlyPackagePrice / (initialData.sessionCount || 4)) : 150));
  const initialSessionCount = isInitialPerLesson
    ? 1
    : ((initialData?.sessionCount && initialData.sessionCount > 1) 
        ? initialData.sessionCount 
        : 4);
  const [sessionCount, setSessionCount] = useState<number>(initialSessionCount);
  const [startingSessionNumber, setStartingSessionNumber] = useState(initialData?.startingSessionNumber || 1);
  const { financeAccounts } = useApp();
  const [defaultFinanceAccountId, setDefaultFinanceAccountId] = useState(initialData?.defaultFinanceAccountId || (financeAccounts?.[0]?.id || ''));
  const [scheduleRecurrence, setScheduleRecurrence] = useState<ScheduleRecurrence>(initialData?.scheduleRecurrence || 'weekly');
  const [scheduleDays, setScheduleDays] = useState<string[]>(initialData?.scheduleDays || []);
  const [scheduleTime, setScheduleTime] = useState(initialData?.scheduleTime || '17:00');
  const [dayTimes, setDayTimes] = useState<Record<string, string>>(initialData?.scheduleDayTimes || {});
  const [zoomLink, setZoomLink] = useState(initialData?.zoomLink || profile.defaultZoomLink || '');
  const [meetLink, setMeetLink] = useState(initialData?.meetLink || profile.defaultMeetLink || '');
  const [address, setAddress] = useState(initialData?.address || 'Hauptstraße 45, Cairo');
  const [color, setColor] = useState(initialData?.color || '#3B82F6');
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(initialData?.lessonDurationMinutes || 60);
  const [whatsAppGroupLink, setWhatsAppGroupLink] = useState(initialData?.whatsAppGroupLink || '');

  const toggleScheduleDay = (day: string) => {
    setScheduleDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        if (!dayTimes[day]) {
          setDayTimes(dt => ({ ...dt, [day]: scheduleTime || '17:00' }));
        }
        return [...prev, day];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (type === 'offline' && !address.trim()) {
      alert(t('auto_address_location_is_required'));
      return;
    }

    const isPerLesson = paymentCycle === 'per_lesson';
    const effectiveSessionCount = isPerLesson ? 1 : Math.max(2, Number(sessionCount) || 4);
    onSubmit({
      name,
      grade,
      type,
      paymentCycle: isPerLesson ? 'per_lesson' : 'monthly',
      paymentModel: isPerLesson ? 'per_session' : 'package',
      monthlyPackagePrice: isPerLesson ? Number(pricePerSession) : Number(monthlyPackagePrice),
      pricePerSession: Number(pricePerSession),
      sessionCount: effectiveSessionCount,
      startingSessionNumber: isPerLesson ? 1 : Math.max(1, Number(startingSessionNumber) || 1),
      defaultFinanceAccountId,
      scheduleRecurrence,
      scheduleDays,
      scheduleTime,
      dayTimes,
      zoomLink,
      meetLink,
      address,
      color,
      lessonDurationMinutes: Number(lessonDurationMinutes),
      whatsAppGroupLink
    });
  };

  return (
    <form id="group-form" onSubmit={handleSubmit} className={className || "p-5 space-y-4 max-h-[75vh] overflow-y-auto"}>
      {/* AI Import Shortcut is rendered outside by parent if needed */}

      {/* Group Name */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-main">
          Gruppen Name (Group Name) *
        </label>
        <input
          type="text"
          required
          placeholder="z. B. Deutsch Gruppe A2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Group Type Selector (Online / Offline) */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-main">
          Unterrichtsform (Lesson Type) *
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setType('online')}
            className={`py-2.5 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'online'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Online (Zoom / Meet)</span>
          </button>
          <button
            type="button"
            onClick={() => setType('offline')}
            className={`py-2.5 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'offline'
                ? 'bg-primary text-white border-primary-border shadow-xs'
                : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Offline (Vor Ort)</span>
          </button>
        </div>
      </div>

      {/* Predefined Grade / Course Level */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-main">
          {_t('المستوى / الصف الدراسي', 'Grade / Course Level', 'Klassenstufe / Sprachniveau')}
        </label>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value as GradeLevel)}
          className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none"
        >
          <optgroup label="مستويات الكورسات واللغات (Course Levels)">
            {COURSE_LEVELS.map(g => (
              <option key={g} value={g}>
                {g} - {_t(g === 'A1' ? 'A1 (مبتدئ أول)' : g === 'A2' ? 'A2 (مبتدئ متقدم)' : g === 'B1' ? 'B1 (متوسط أول)' : g === 'B2' ? 'B2 (متوسط متقدم)' : g === 'C1' ? 'C1 (متقدم)' : 'C2 (متقن)', g, g)}
              </option>
            ))}
          </optgroup>
          <optgroup label="الصفوف المدرسية (School Grades)">
            {SCHOOL_GRADES.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Payment Model Selector */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-main">
          {_t('نظام المحاسبة والدفع *', 'Payment Option *', 'Abrechnungsmodell *')}
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setPaymentCycle('monthly');
              if (sessionCount <= 1) setSessionCount(4);
            }}
            className={`py-2.5 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentCycle === 'monthly'
                ? 'bg-primary text-white border-primary-border shadow-xs'
                : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{_t('باقة دورية (شهري)', 'Monthly Package', 'Monatspaket (Monthly)')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentCycle('per_lesson');
              setSessionCount(1);
            }}
            className={`py-2.5 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentCycle === 'per_lesson'
                ? 'bg-primary text-white border-primary-border shadow-xs'
                : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>{_t('محاسبة بالحصة', 'Per Session', 'Pro Sitzung (Per Session)')}</span>
          </button>
        </div>
      </div>

      {/* Group Pricing & Cycle Settings */}
      <div className="space-y-3 bg-surface-hover/80 p-3 rounded-lg border border-surface-border dark:border-surface-border-soft">
        {paymentCycle === 'monthly' ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">
                Paket Preis ({profile.currency})
              </label>
              <input
                type="number"
                value={monthlyPackagePrice}
                onChange={(e) => setMonthlyPackagePrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">
                Zahlungs-Zyklus (Package)
              </label>
              <select
                value={sessionCount <= 1 ? 4 : sessionCount}
                onChange={(e) => setSessionCount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-bold"
              >
                <option value={4}>Alle 4 Lektionen (Every 4)</option>
                <option value={8}>Alle 8 Lektionen (Every 8)</option>
                <option value={12}>Alle 12 Lektionen (Every 12)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              Preis pro Sitzung ({profile.currency})
            </label>
            <input
              type="number"
              value={pricePerSession}
              onChange={(e) => setPricePerSession(Number(e.target.value))}
              className="w-full px-3 py-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-bold"
            />
          </div>
        )}

        {paymentCycle !== 'per_lesson' && (sessionCount > 1 || paymentCycle === 'monthly') ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-surface-border dark:border-surface-border-soft">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{_t('رقم السايكل / الحصة القادمة', 'Upcoming Session in Cycle', 'Nächste Sitzungsnummer')}</span>
              </label>
              <select
                value={Math.min(startingSessionNumber, Math.max(1, sessionCount || 4))}
                onChange={(e) => setStartingSessionNumber(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold"
              >
                {Array.from({ length: Math.max(1, sessionCount || 4) }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num === 1 ? `${num} (${_t('بداية السايكل', 'Start of Cycle', 'Start')})` : `${_t('الحصة', 'Session', 'Sitzung')} ${num} ${_t(`من ${sessionCount || 4}`, `of ${sessionCount || 4}`, `von ${sessionCount || 4}`)}`}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-text-muted">
                {_t('يحدد رقم الحصة القادمة ويضبط تسلسل الجدول والتقارير تلقائياً', 'Determines upcoming session and aligns reports automatically', 'Setzt nächste Sitzungsnummer')}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">
                Standard Konto (Default Account):
              </label>
              <select
                value={defaultFinanceAccountId}
                onChange={(e) => setDefaultFinanceAccountId(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold"
              >
                <option value="">{t('choose', 'Choose...', 'Wählen...')}</option>
                {financeAccounts.filter(a => !a.deleted).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-surface-border dark:border-surface-border-soft">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-main">
                Standard Konto (Default Account):
              </label>
              <select
                value={defaultFinanceAccountId}
                onChange={(e) => setDefaultFinanceAccountId(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold"
              >
                <option value="">{t('choose', 'Choose...', 'Wählen...')}</option>
                {financeAccounts.filter(a => !a.deleted).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Schedule & Calendar Sync Settings */}
      <div className="space-y-3 p-3 bg-primary/5 border border-primary-border/30 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <label className="text-xs font-bold text-primary-hover dark:text-primary-hover flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Tage auswählen (Select Days) *
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleScheduleDay(day)}
                className={`w-10 h-10 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  scheduleDays.includes(day)
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface border border-surface-border dark:border-surface-border-soft text-text-main hover:bg-surface-hover'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Recurrence Mode: Weekly vs Bi-weekly (Alternating Weeks A / B) */}
        <div className="space-y-2 relative z-10 pt-2 border-t border-primary-border/20">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-primary-hover dark:text-primary-hover flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" />
              <span>{_t('نظام التكرار والمواعيد', 'Recurrence Pattern', 'Wiederholungsrhythmus')}</span>
            </label>
            <span className="text-[10px] font-bold text-text-muted">
              {_t('هذا الأسبوع:', 'This week:', 'Diese Woche:')} <span className="font-mono text-primary font-black">{_t('أسبوع', 'Week', 'Woche')} {getCurrentAlternatingWeek()}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setScheduleRecurrence('weekly')}
              className={`p-2 rounded-xl border text-start transition-all cursor-pointer ${
                scheduleRecurrence === 'weekly'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface border-surface-border hover:bg-surface-hover text-text-main'
              }`}
            >
              <div className="text-xs font-black flex items-center justify-between">
                <span>🔄 {_t('كل أسبوع', 'Every Week', 'Jede Woche')}</span>
                {scheduleRecurrence === 'weekly' && <Check className="w-3.5 h-3.5" />}
              </div>
              <div className={`text-[10px] mt-0.5 ${scheduleRecurrence === 'weekly' ? 'text-white/80' : 'text-text-muted'}`}>
                {_t('حصة أسبوعية منتظمة', 'Regular weekly', 'Regelmäßig')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScheduleRecurrence('biweekly_a')}
              className={`p-2 rounded-xl border text-start transition-all cursor-pointer ${
                scheduleRecurrence === 'biweekly_a'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface border-surface-border hover:bg-surface-hover text-text-main'
              }`}
            >
              <div className="text-xs font-black flex items-center justify-between">
                <span>🅰️ {_t('أسبوع وآسبوع (أ)', 'Bi-weekly (A)', 'Alle 2 Wochen (A)')}</span>
                {scheduleRecurrence === 'biweekly_a' && <Check className="w-3.5 h-3.5" />}
              </div>
              <div className={`text-[10px] mt-0.5 ${scheduleRecurrence === 'biweekly_a' ? 'text-white/80' : 'text-text-muted'}`}>
                {_t('هذا الأسبوع وكل أسبوعين', 'This week & every 2w', 'Diese Woche & alle 2W')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScheduleRecurrence('biweekly_b')}
              className={`p-2 rounded-xl border text-start transition-all cursor-pointer ${
                scheduleRecurrence === 'biweekly_b'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface border-surface-border hover:bg-surface-hover text-text-main'
              }`}
            >
              <div className="text-xs font-black flex items-center justify-between">
                <span>🅱️ {_t('أسبوع وآسبوع (ب)', 'Bi-weekly (B)', 'Alle 2 Wochen (B)')}</span>
                {scheduleRecurrence === 'biweekly_b' && <Check className="w-3.5 h-3.5" />}
              </div>
              <div className={`text-[10px] mt-0.5 ${scheduleRecurrence === 'biweekly_b' ? 'text-white/80' : 'text-text-muted'}`}>
                {_t('الأسبوع القادم وكل أسبوعين', 'Next week & every 2w', 'Nächste Woche & alle 2W')}
              </div>
            </button>
          </div>

          {scheduleRecurrence !== 'weekly' && (
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-semibold text-primary flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span>
                {scheduleRecurrence === 'biweekly_a'
                  ? _t('الحصص ستُجدول في أسبوع (أ) فقط (يبدأ هذا الأسبوع). يمكنك إضافة طالب أو مجموعة أخرى في أسبوع (ب) لنفس اليوم والساعة دون أي تعارض!', 'Lessons will occur on Week A only (starts this week). You can add another student or group on Week B for the same time slot without conflict!', 'Unterricht findet nur in Woche A statt (beginnt diese Woche). Sie können eine andere Gruppe für Woche B zur selben Zeit anlegen!')
                  : _t('الحصص ستُجدول في أسبوع (ب) فقط (يبدأ الأسبوع القادم). يتيح لك مشاركة نفس الوقت بالتناوب مع طالب أسبوع (أ)!', 'Lessons will occur on Week B only (starts next week). Allows sharing the exact same time slot alternately with Week A!', 'Unterricht findet nur in Woche B statt (beginnt nächste Woche). Erlaubt das Teilen des Termins mit Woche A!')}
              </span>
            </div>
          )}
        </div>

        {scheduleDays.length > 0 && (
          <div className="space-y-2 relative z-10 pt-2 border-t border-primary-border/20">
            <label className="text-xs font-bold text-primary-hover dark:text-primary-hover">Uhrzeit pro Tag (Time per Day)</label>
            <div className="grid grid-cols-2 gap-2">
              {scheduleDays.map(day => (
                <div key={day} className="flex items-center gap-2 bg-surface p-2 rounded-xl border border-primary-border/20">
                  <span className="text-xs font-bold text-primary w-6">{day}</span>
                  <input
                    type="time"
                    value={dayTimes[day] || scheduleTime || '17:00'}
                    onChange={(e) => setDayTimes(prev => ({ ...prev, [day]: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono font-bold focus:outline-none text-slate-800 dark:text-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lesson Duration per Group */}
        <div className="pt-2 border-t border-primary-border/60 dark:border-primary-border/60 space-y-1 relative z-10">
          <label className="text-xs font-bold text-primary-hover dark:text-primary/70 flex items-center gap-1.5">
            <span>{t('lesson_duration_label')}:</span>
          </label>
          <select
            value={lessonDurationMinutes}
            onChange={(e) => setLessonDurationMinutes(Number(e.target.value))}
            className="w-full px-3 py-2 bg-surface border border-primary-border dark:border-primary-border rounded-xl text-xs font-bold text-primary dark:text-primary/70"
          >
            <option value={60}>60 Min (1 Std / 1 Hour - Default)</option>
            <option value={75}>75 Min (1h 15m)</option>
            <option value={90}>90 Min (1.5 Std / 1.5 Hours)</option>
            <option value={105}>105 Min (1h 45m)</option>
            <option value={120}>120 Min (2 Std / 2 Hours)</option>
            <option value={150}>150 Min (2.5 Std / 2.5 Hours)</option>
            <option value={180}>180 Min (3 Std / 3 Hours)</option>
          </select>
        </div>
      </div>

      {/* Type specific links */}
      {type === 'online' ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>{_t('رابط زووم الدائم (اختياري)', 'Permanent Zoom Link (Optional)', 'Permanenter Zoom-Link (Optional)')}</span>
              <span className="text-[10px] text-text-muted font-normal">{_t('اختياري', 'Optional', 'Optional')}</span>
            </label>
            <input
              type="url"
              value={zoomLink}
              onChange={(e) => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-main flex items-center justify-between">
            <span>Standort / Adresse (Location) *</span>
            <span className="text-[10px] text-text-muted font-normal">Required</span>
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold resize-none"
          />
        </div>
      )}

      <div className="pt-2 border-t border-surface-border dark:border-surface-border-soft">
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-main">
            WhatsApp Group Link (Optional)
          </label>
          <input
            type="url"
            value={whatsAppGroupLink}
            onChange={(e) => setWhatsAppGroupLink(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-mono"
          />
        </div>
      </div>

      {children}
    </form>
  );
};
