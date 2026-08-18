import React, { useState } from 'react';
import { Group, GradeLevel, LessonType, PaymentCycle } from '../types';
import { PREDEFINED_GRADES } from '../data/initialData';
import { useApp } from '../context/AppContext';
import { Video, MapPin, DollarSign, Calendar } from 'lucide-react';

export interface GroupFormData {
  name: string;
  grade: GradeLevel;
  type: LessonType;
  paymentCycle: PaymentCycle;
  monthlyPackagePrice: number;
  pricePerSession: number;
  sessionCount: number;
  startingSessionNumber: number;
  paymentMethod: 'vodafone_cash' | 'cash' | 'bank_transfer' | 'paypal' | 'instapay';
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
}

export const GroupForm: React.FC<GroupFormProps> = ({ initialData, onSubmit, isEdit, children }) => {
  const { profile, language, t } = useApp();

  
  const [name, setName] = useState(initialData?.name || '');
  const [grade, setGrade] = useState<GradeLevel>(initialData?.grade || 'Grade 9');
  const [type, setType] = useState<LessonType>(initialData?.type || 'online');
  const [paymentCycle, setPaymentCycle] = useState<PaymentCycle>(initialData?.paymentCycle || 'monthly');
  const [monthlyPackagePrice, setMonthlyPackagePrice] = useState(initialData?.monthlyPackagePrice || 1200);
  const [pricePerSession, setPricePerSession] = useState(initialData?.pricePerSession || (initialData?.monthlyPackagePrice ? Math.round(initialData.monthlyPackagePrice / (initialData.sessionCount || 8)) : 150));
  const [sessionCount, setSessionCount] = useState(initialData?.sessionCount || 8);
  const [startingSessionNumber, setStartingSessionNumber] = useState(initialData?.startingSessionNumber || 1);
  const [paymentMethod, setPaymentMethod] = useState<'vodafone_cash' | 'cash' | 'bank_transfer' | 'paypal' | 'instapay'>(initialData?.paymentMethod || 'vodafone_cash');
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

    if (type === 'online' && !zoomLink.trim()) {
      alert(t('auto_zoom_link_is_required_for_onli'));
      return;
    }

    if (type === 'offline' && !address.trim()) {
      alert(t('auto_address_location_is_required'));
      return;
    }

    onSubmit({
      name,
      grade,
      type,
      paymentCycle,
      monthlyPackagePrice: Number(monthlyPackagePrice),
      pricePerSession: Number(pricePerSession),
      sessionCount: Number(sessionCount),
      startingSessionNumber: Number(startingSessionNumber),
      paymentMethod,
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
    <form id="group-form" onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
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

      {/* Predefined Grade */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-main">
          Klassenstufe (Predefined Grade Level)
        </label>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value as GradeLevel)}
          className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold focus:outline-none"
        >
          {PREDEFINED_GRADES.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Payment Model Selector */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-main">
          Abrechnungsmodell (Payment Option) *
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPaymentCycle('monthly')}
            className={`py-2.5 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentCycle === 'monthly'
                ? 'bg-primary text-white border-primary-border shadow-xs'
                : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Monatspaket (Monthly)</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentCycle('per_lesson')}
            className={`py-2.5 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentCycle === 'per_lesson'
                ? 'bg-primary text-white border-primary-border shadow-xs'
                : 'bg-surface-hover text-text-main border-surface-border dark:border-surface-border-soft'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Pro Sitzung (Per Session)</span>
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
                value={sessionCount}
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

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-border dark:border-surface-border-soft">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              Erste Sitzungsnummer
            </label>
            <select
              value={startingSessionNumber}
              onChange={(e) => setStartingSessionNumber(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold"
            >
              <option value={1}>1 (Start)</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={8}>8</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              Standard Zahlungsart:
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold"
            >
              <option value="vodafone_cash">Vodafone Cash</option>
              <option value="instapay">InstaPay</option>
              <option value="cash">Bargeld (Cash)</option>
              <option value="bank_transfer">Banküberweisung</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Schedule & Calendar Sync Settings */}
      <div className="space-y-3 p-3 bg-primary/5 border border-primary-border/30 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <label className="text-xs font-bold text-primary-hover dark:text-primary-soft flex items-center justify-between">
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

        {scheduleDays.length > 0 && (
          <div className="space-y-2 relative z-10 pt-2 border-t border-primary-border/20">
            <label className="text-xs font-bold text-primary-hover dark:text-primary-soft">Uhrzeit pro Tag (Time per Day)</label>
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
              <span>Permanent Zoom Link *</span>
              <span className="text-[10px] text-text-muted font-normal">Required</span>
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

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-border dark:border-surface-border-soft">
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
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-main">
            Group Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            />
            <span className="text-xs font-mono">{color}</span>
          </div>
        </div>
      </div>

      {children}
    </form>
  );
};
