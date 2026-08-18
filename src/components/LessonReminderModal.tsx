import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson, Group } from '../types';
import { buildWhatsAppUrl, formatWhatsAppPhone } from '../utils/phoneUtils';
import { getUpcomingGroupSchedule } from '../utils/scheduleUtils';
import { 
  X, Send, Copy, Check, MessageSquare, AlertTriangle, Clock, Link as LinkIcon, 
  MapPin, Video, Sparkles, Phone, CheckCircle2 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LessonReminderModalProps {
  lesson?: Lesson | null;
  group?: Group | null;
  recipientPhone?: string;
  onClose: () => void;
}

const ARRIVAL_TIME_OPTIONS = [
  '5 دقايق',
  '10 دقايق',
  '15 دقيقة',
  '20 دقيقة',
  '25 دقيقة',
  'نص ساعة',
];

export const LessonReminderModal: React.FC<LessonReminderModalProps> = ({
  lesson,
  group,
  recipientPhone,
  onClose,
}) => {
  const { groups, students, profile, updateGroup, updateProfile, t, _t } = useApp();

  // Find associated group
  const targetGroup = group || (lesson?.groupId ? groups.find(g => g.id === lesson.groupId) : null);
  
  // Single Source of Truth for Schedule
  const upcomingSchedule = targetGroup ? getUpcomingGroupSchedule(targetGroup) : null;
  
  // Strict rule: Always use the group's current schedule time, never calculate independently
  const rawTime = upcomingSchedule?.time || '17:00';
  const displayDay = upcomingSchedule?.dayDisplay || '';
  
  // Validation: Detect if lesson time doesn't match group schedule
  const hasTimeMismatch = lesson?.time && lesson.time !== rawTime;
  
  if (hasTimeMismatch) {
    console.warn(`Time mismatch detected! Lesson time (${lesson.time}) differs from group schedule (${rawTime}). Forced to use group schedule.`);
  }

  // Determine if lesson/group is online or offline
  const isOnline = lesson?.type === 'online' || targetGroup?.type === 'online';

  // Extract initial zoom link (Strictly favor group settings first)
  const initialZoomLink = targetGroup?.zoomLink || lesson?.meetingLink || profile.defaultZoomLink || '';

  // Resolve target student / parent phone
  const targetStudent = lesson?.studentId 
    ? students.find(s => s.id === lesson.studentId)
    : (targetGroup ? students.find(s => s.groupId === targetGroup.id) : null);

  const rawPhone = recipientPhone || targetStudent?.parentPhone || targetStudent?.studentPhone || lesson?.quickParentPhone || '';
  const initialPhone = formatWhatsAppPhone(rawPhone);

  // States
  const [phone, setPhone] = useState(initialPhone);
  const [selectedArrivalTime, setSelectedArrivalTime] = useState('15 دقيقة');
  const [zoomLink, setZoomLink] = useState(initialZoomLink);
  const [isSavingZoom, setIsSavingZoom] = useState(false);
  const [zoomSaveSuccess, setZoomSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState<string | null>(null);

  // Format lesson time cleanly for display
  const formattedLessonTime = React.useMemo(() => {
    if (!rawTime) return 'المحدد';
    // If format is HH:MM, append Egyptian time suffix or keep clean string
    const [hStr, mStr] = rawTime.split(':');
    if (hStr && mStr) {
      let h = parseInt(hStr, 10);
      const isPm = h >= 12;
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      const period = isPm ? 'مساءً' : 'صباحاً';
      const timeDisplay = `${h}:${mStr} ${period}`;
      return displayDay ? `يوم ${displayDay} الساعة ${timeDisplay}` : timeDisplay;
    }
    return displayDay ? `يوم ${displayDay} الساعة ${rawTime}` : rawTime;
  }, [rawTime, displayDay]);

  // Generate exact Arabic template according to requirements
  const generatedMessage = React.useMemo(() => {
    if (isOnline) {
      return `السلام عليكم\n\nهنبدأ إن شاء الله الساعة ${rawTime}.\n\nلينك الحصة:\n\n${zoomLink}`;
    } else {
      return `السلام عليكم ورحمة الله وبركاته\n\nأنا في الطريق وهوصل لحضرتك خلال ${selectedArrivalTime} إن شاء الله.`;
    }
  }, [isOnline, rawTime, zoomLink, selectedArrivalTime]);

  const activeMessage = customMessage !== null ? customMessage : generatedMessage;

  // Save Zoom link back to group or profile
  const handleSaveZoomLink = () => {
    if (!zoomLink.trim()) return;
    setIsSavingZoom(true);
    if (targetGroup) {
      updateGroup(targetGroup.id, { zoomLink: zoomLink.trim() });
    } else {
      updateProfile({ defaultZoomLink: zoomLink.trim() });
    }
    setTimeout(() => {
      setIsSavingZoom(false);
      setZoomSaveSuccess(true);
      setTimeout(() => setZoomSaveSuccess(false), 2000);
    }, 400);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(activeMessage);
    setCopied(true);
    try {
      confetti({ particleCount: 35, spread: 50 });
    } catch (e) {
      // ignore
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (isOnline && !zoomLink.trim()) {
      alert('برجاء إضافة رابط الزووم للجروب أولاً قبل إرسال التذكير.');
      return;
    }

    const url = buildWhatsAppUrl(phone, activeMessage);
    window.open(url, '_blank');
    try {
      confetti({ particleCount: 60, spread: 60 });
    } catch (e) {
      // ignore
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 overflow-y-auto font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up space-y-0 text-text-main"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white">
              {isOnline ? <Video className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-white">
                  {isOnline ? 'أونلاين Online' : 'أوفلاين Offline'}
                </span>
                {targetGroup && (
                  <span className="text-xs font-semibold text-emerald-100 truncate max-w-[150px]">
                    {targetGroup.name}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black mt-0.5">
                تذكير بموعد الحصة
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">

          {/* MISMATCH WARNING */}
          {hasTimeMismatch && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  تنبيه: وقت الحصة مختلف عن موعد الجروب
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  تم تحديد موعد الجروب ليكون ({rawTime}) لكن هذه الحصة مسجلة في ({lesson?.time}). التزاماً بمعايير النظام، التذكير يعتمد على <span className="font-bold">موعد الجروب الأساسي</span>.
                </p>
              </div>
            </div>
          )}

          {/* Recipient Phone Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>رقم الواتساب المستلم:</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010xxxxxxxx أو 2010xxxxxxxx"
              className="w-full bg-background border border-surface-border rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              dir="ltr"
            />
          </div>

          {/* OFFLINE GROUP WORKFLOW */}
          {!isOnline && (
            <div className="space-y-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>هوصل خلال:</span>
                </label>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  اختر موعد الوصول المتوقع
                </span>
              </div>

              {/* Time selection options */}
              <div className="grid grid-cols-3 gap-2">
                {ARRIVAL_TIME_OPTIONS.map((timeOpt) => {
                  const isSelected = selectedArrivalTime === timeOpt;
                  return (
                    <button
                      key={timeOpt}
                      type="button"
                      onClick={() => {
                        setSelectedArrivalTime(timeOpt);
                        setCustomMessage(null); // Reset custom override on option change
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-[1.02]'
                          : 'bg-surface hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 border-surface-border text-text-main'
                      }`}
                    >
                      {timeOpt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ONLINE GROUP WORKFLOW */}
          {isOnline && (
            <div className="space-y-3">
              {/* Info badge */}
              <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200 font-bold">
                  <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>وقت الحصة التلقائي:</span>
                </div>
                <span className="font-black text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 px-2.5 py-1 rounded-lg">
                  {formattedLessonTime}
                </span>
              </div>

              {/* Zoom Link Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>رابط الزووم (Zoom Link):</span>
                </label>

                {!zoomLink.trim() && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-3 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">رابط الزووم غير مضاف لهذا الجروب!</p>
                      <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-400">
                        برجاء كتابة أو لصق رابط الزووم أدناه قبل إرسال التذكير.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={zoomLink}
                    onChange={(e) => {
                      setZoomLink(e.target.value);
                      setCustomMessage(null);
                    }}
                    placeholder="https://zoom.us/j/..."
                    className={`flex-1 bg-background border rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none ${
                      !zoomLink.trim()
                        ? 'border-amber-400 focus:ring-2 focus:ring-amber-500/50'
                        : 'border-surface-border focus:ring-2 focus:ring-emerald-500/50'
                    }`}
                    dir="ltr"
                  />
                  {zoomLink.trim() && (
                    <button
                      type="button"
                      onClick={handleSaveZoomLink}
                      disabled={isSavingZoom}
                      className="bg-surface hover:bg-surface-hover border border-surface-border text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {zoomSaveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">تم الحفظ</span>
                        </>
                      ) : (
                        <span>حفظ للجروب</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MESSAGE PREVIEW BOX */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-text-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>معاينة الرسالة (Message Preview):</span>
              </label>

              {customMessage !== null && (
                <button
                  type="button"
                  onClick={() => setCustomMessage(null)}
                  className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  استعادة النص الأصلي
                </button>
              )}
            </div>

            {/* WhatsApp Chat Bubble */}
            <div className="relative bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 shadow-inner text-right space-y-2 font-sans">
              <textarea
                value={activeMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={isOnline ? 6 : 4}
                className="w-full bg-transparent text-emerald-950 dark:text-emerald-100 font-semibold text-sm leading-relaxed resize-none focus:outline-none"
                dir="rtl"
              />

              <div className="flex items-center justify-between border-t border-emerald-200/50 dark:border-emerald-800/40 pt-2 text-[10px] text-emerald-700 dark:text-emerald-400">
                <span>💬 جاهزة للإرسال مباشرة على الواتساب</span>
                <span className="font-bold dir-ltr">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-surface-border flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4 fill-white" />
            <span>إرسال عبر واتساب (WhatsApp)</span>
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="w-full sm:w-auto bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-text-muted" />
                <span>نسخ النص</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted font-semibold text-sm py-3 px-4 rounded-xl transition-all cursor-pointer"
          >
            إلغاء
          </button>
        </div>

      </div>
    </div>
  );
};
