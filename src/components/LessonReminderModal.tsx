import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson, Group } from '../types';
import { buildWhatsAppUrl, formatWhatsAppPhone, resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername } from '../utils/phoneUtils';
import { getUpcomingGroupSchedule } from '../utils/scheduleUtils';
import { 
  X, Send, Copy, Check, MessageSquare, AlertTriangle, Clock, Link as LinkIcon, 
  MapPin, Video, Sparkles, Phone, Users, CheckCircle2, AtSign, Plus 
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

// Helper to format time to 12-hour clock (e.g. 18:00 -> 6:00)
export const formatTimeTo12Hour = (timeStr?: string): string => {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  const [hStr, mStr] = clean.split(':');
  if (!hStr || mStr === undefined) return clean;
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return clean;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr}`;
};

export const LessonReminderModal: React.FC<LessonReminderModalProps> = ({
  lesson,
  group,
  recipientPhone,
  onClose,
}) => {
  const { groups, students, profile, updateGroup, updateProfile, t, _t } = useApp();

  // Find associated group
  const targetGroup = group || (lesson?.groupId ? groups.find(g => g.id === lesson.groupId) : null);
  const groupStudents = targetGroup ? students.filter(s => s.groupId === targetGroup.id) : [];
  
  // Multi-student group flag
  const isMultiStudentGroup = Boolean(targetGroup && groupStudents.length > 1);
  const isSingleStudentGroup = Boolean(targetGroup && groupStudents.length <= 1);
  const groupWhatsAppLink = targetGroup?.whatsAppGroupLink || '';
  
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

  // Resolve first student and target student
  const firstStudent = groupStudents.length > 0 
    ? groupStudents[0] 
    : (lesson?.studentId ? students.find(s => s.id === lesson.studentId) : null);

  // Resolve target student / parent contact for 1-on-1 lessons (including groups with only 1 student)
  const targetStudent = lesson?.studentId 
    ? students.find(s => s.id === lesson.studentId)
    : (groupStudents.length === 1 ? groupStudents[0] : (targetGroup && !isMultiStudentGroup ? groupStudents[0] : null));

  const resolvedContact = resolveStudentWhatsAppContact(targetStudent, {
    quickParentPhone: recipientPhone || lesson?.quickParentPhone,
    quickStudentPhone: lesson?.quickStudentPhone
  });
  const initialPhone = resolvedContact.contact;

  // States
  const [phone, setPhone] = useState(initialPhone);
  const [whatsAppGroupLinkInput, setWhatsAppGroupLinkInput] = useState(groupWhatsAppLink);
  const [isSavingWhatsAppLink, setIsSavingWhatsAppLink] = useState(false);
  const [whatsAppSaveSuccess, setWhatsAppSaveSuccess] = useState(false);
  const [showWhatsAppGroupSection, setShowWhatsAppGroupSection] = useState(Boolean(groupWhatsAppLink));
  
  // Mode selection for single-student groups or individual
  const [sendMode, setSendMode] = useState<'individual' | 'group'>(
    isMultiStudentGroup ? 'group' : (groupWhatsAppLink ? 'group' : 'individual')
  );

  const [selectedArrivalTime, setSelectedArrivalTime] = useState('15 دقيقة');
  const [zoomLink, setZoomLink] = useState(initialZoomLink);
  const [isSavingZoom, setIsSavingZoom] = useState(false);
  const [zoomSaveSuccess, setZoomSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState<string | null>(null);

  useEffect(() => {
    setWhatsAppGroupLinkInput(groupWhatsAppLink);
    if (groupWhatsAppLink) {
      setShowWhatsAppGroupSection(true);
    }
  }, [groupWhatsAppLink]);

  // Format lesson time cleanly for display (12-hour format with period)
  const formattedLessonTime = React.useMemo(() => {
    if (!rawTime) return 'المحدد';
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

  // Generate exact Arabic template according to requirements (Always 12-hour system)
  const generatedMessage = React.useMemo(() => {
    const time12 = formatTimeTo12Hour(rawTime);
    if (isOnline) {
      return `السلام عليكم\n\nهنبدأ إن شاء الله الساعة ${time12}.\n\nلينك الحصة:\n\n${zoomLink}`;
    } else {
      if (isMultiStudentGroup || (targetGroup && sendMode === 'group')) {
        return `السلام عليكم ورحمة الله وبركاته\n\nأنا في الطريق وهوصل للمجموعة خلال ${selectedArrivalTime} إن شاء الله.`;
      }
      return `السلام عليكم ورحمة الله وبركاته\n\nأنا في الطريق وهوصل لحضرتك خلال ${selectedArrivalTime} إن شاء الله.`;
    }
  }, [isOnline, rawTime, zoomLink, selectedArrivalTime, isMultiStudentGroup, targetGroup, sendMode]);

  const activeMessage = customMessage !== null ? customMessage : generatedMessage;

  // Save WhatsApp group link
  const handleSaveWhatsAppGroupLink = () => {
    if (!targetGroup || !whatsAppGroupLinkInput.trim()) return;
    setIsSavingWhatsAppLink(true);
    updateGroup(targetGroup.id, { whatsAppGroupLink: whatsAppGroupLinkInput.trim() });
    setTimeout(() => {
      setIsSavingWhatsAppLink(false);
      setWhatsAppSaveSuccess(true);
      setTimeout(() => setWhatsAppSaveSuccess(false), 2000);
    }, 400);
  };

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
      alert('برجاء إضافة رابط الزووم أولاً قبل إرسال التذكير.');
      return;
    }

    const isGroupMode = isMultiStudentGroup || (targetGroup && sendMode === 'group');

    if (isGroupMode) {
      const activeLink = whatsAppGroupLinkInput.trim() || groupWhatsAppLink;
      try {
        navigator.clipboard.writeText(activeMessage);
      } catch (e) {
        console.warn('Clipboard write failed:', e);
      }

      if (activeLink) {
        window.open(activeLink, '_blank');
      } else {
        // Copy text and open WhatsApp so user can choose chat
        const url = buildWhatsAppUrl('', activeMessage);
        window.open(url, '_blank');
      }
      try {
        confetti({ particleCount: 60, spread: 60 });
      } catch (e) {
        // ignore
      }
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

  const handleSendToFirstParent = (studentToTarget = firstStudent) => {
    if (!studentToTarget) {
      alert('لا يوجد طالب مسجل.');
      return;
    }
    const resolved = resolveStudentWhatsAppContact(studentToTarget);
    if (!resolved.hasContact) {
      alert(`بيانات التواصل (رقم هاتف أو يوزر نيم واتساب) لولي أمر الطالب (${studentToTarget.name}) غير مسجلة في بيانات الطالب.`);
      return;
    }
    if (isOnline && !zoomLink.trim()) {
      alert('برجاء إضافة رابط الزووم أولاً قبل إرسال التذكير.');
      return;
    }

    const time12 = formatTimeTo12Hour(rawTime);
    const parentMsg = isOnline 
      ? `السلام عليكم\n\nهنبدأ إن شاء الله الساعة ${time12}.\n\nلينك الحصة:\n\n${zoomLink}`
      : `السلام عليكم ورحمة الله وبركاته\n\nأنا في الطريق وهوصل لحضرتك خلال ${selectedArrivalTime} إن شاء الله.`;

    const finalMsg = customMessage !== null ? customMessage : parentMsg;
    const url = buildWhatsAppUrl(resolved.contact, finalMsg);
    window.open(url, '_blank');
    try {
      confetti({ particleCount: 60, spread: 60 });
    } catch (e) {
      // ignore
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 overflow-y-auto font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up space-y-0 text-text-main flex flex-col max-h-[92dvh] sm:max-h-[88vh]"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="bg-surface border-b border-surface-border p-4 sm:p-5 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-primary-soft text-primary rounded-xl shrink-0">
              {isOnline ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-primary-soft text-primary border border-primary-border px-2 py-0.5 rounded-full">
                  {isOnline ? 'أونلاين Online' : 'أوفلاين Offline'}
                </span>
                {targetGroup && (
                  <span className="text-xs font-bold text-text-muted truncate max-w-[130px] sm:max-w-[180px]">
                    {targetGroup.name}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black mt-0.5 text-text-main">
                تذكير بموعد الحصة
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 sm:p-2 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted hover:text-text-main rounded-full transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">

          {/* MISMATCH WARNING */}
          {hasTimeMismatch && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  تنبيه: وقت الحصة مختلف عن موعد الجروب
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
                  تم تحديد موعد الجروب ليكون ({rawTime}) لكن هذه الحصة مسجلة في ({lesson?.time}). التزاماً بمعايير النظام، التذكير يعتمد على <span className="font-bold">موعد الجروب الأساسي</span>.
                </p>
              </div>
            </div>
          )}

          {/* Recipient Destination Section: Group vs 1-on-1 Student */}
          {isMultiStudentGroup ? (
            <div className="space-y-2 bg-primary-soft/30 border border-primary-border/60 p-3 sm:p-3.5 rounded-2xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  <span>إرسال لجروب الواتساب ({targetGroup?.name}):</span>
                </label>
                {groupStudents.length > 0 && (
                  <span className="text-[10px] font-bold bg-primary-soft text-primary border border-primary-border px-2 py-0.5 rounded-full">
                    {groupStudents.length} طلاب
                  </span>
                )}
              </div>

              {/* Group Link Input & Save */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={whatsAppGroupLinkInput}
                    onChange={(e) => setWhatsAppGroupLinkInput(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className={`flex-1 bg-background border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                      !whatsAppGroupLinkInput.trim()
                        ? 'border-amber-400 focus:ring-2 focus:ring-amber-500/50'
                        : 'border-surface-border focus:ring-2 focus:ring-primary/40'
                    }`}
                    dir="ltr"
                  />

                  {targetGroup && (
                    <button
                      type="button"
                      onClick={handleSaveWhatsAppGroupLink}
                      disabled={isSavingWhatsAppLink || !whatsAppGroupLinkInput.trim()}
                      className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-black text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {whatsAppSaveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span className="text-xs">تم الحفظ</span>
                        </>
                      ) : (
                        <span className="text-xs">حفظ الرابط</span>
                      )}
                    </button>
                  )}
                </div>

                {!whatsAppGroupLinkInput.trim() && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>يرجى إضافة رابط جروب الواتساب لفتح الجروب وإرسال التذكير مباشرة.</span>
                  </p>
                )}
              </div>
            </div>
          ) : isSingleStudentGroup ? (
            /* SINGLE-STUDENT GROUP: Supports both individual phone AND WhatsApp group */
            <div className="space-y-2.5 bg-primary-soft/20 border border-primary-border/50 p-3 sm:p-3.5 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black text-text-main">
                    وجهة الإرسال ({targetGroup?.name}):
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-primary-soft text-primary border border-primary-border px-2 py-0.5 rounded-full">
                  طالب واحد في المجموعة
                </span>
              </div>

              {/* Mode Switcher */}
              <div className="flex bg-surface p-1 rounded-xl border border-surface-border gap-1">
                <button
                  type="button"
                  onClick={() => setSendMode('individual')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sendMode === 'individual'
                      ? 'bg-primary text-white shadow-xs font-black'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>رقم ولي الأمر {targetStudent ? `(${targetStudent.name})` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSendMode('group');
                    setShowWhatsAppGroupSection(true);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sendMode === 'group'
                      ? 'bg-primary text-white shadow-xs font-black'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>جروب الواتساب</span>
                </button>
              </div>

              {/* Individual Phone Input */}
              {sendMode === 'individual' && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span className="flex items-center gap-1 font-bold">
                      {isWhatsAppUsername(phone) ? <AtSign className="w-3 h-3 text-primary" /> : <Phone className="w-3 h-3 text-primary" />}
                      رقم أو يوزر نيم ولي أمر الطالب:
                    </span>
                    {targetStudent && <span className="font-bold">{targetStudent.name}</span>}
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010xxxxxxxx أو @username"
                    className="w-full bg-background border border-surface-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    dir="ltr"
                  />
                  {!showWhatsAppGroupSection && !groupWhatsAppLink && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowWhatsAppGroupSection(true);
                        setSendMode('group');
                      }}
                      className="mt-1 text-[11px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>إضافة رابط جروب واتساب لهذه المجموعة</span>
                    </button>
                  )}
                </div>
              )}

              {/* WhatsApp Group Link Input */}
              {(sendMode === 'group' || showWhatsAppGroupSection) && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-text-muted flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-primary" />
                    <span>رابط جروب الواتساب:</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={whatsAppGroupLinkInput}
                      onChange={(e) => setWhatsAppGroupLinkInput(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className={`flex-1 bg-background border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                        !whatsAppGroupLinkInput.trim()
                          ? 'border-amber-400 focus:ring-2 focus:ring-amber-500/50'
                          : 'border-surface-border focus:ring-2 focus:ring-primary/40'
                      }`}
                      dir="ltr"
                    />
                    {targetGroup && (
                      <button
                        type="button"
                        onClick={handleSaveWhatsAppGroupLink}
                        disabled={isSavingWhatsAppLink || !whatsAppGroupLinkInput.trim()}
                        className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-black text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {whatsAppSaveSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span className="text-xs">تم الحفظ</span>
                          </>
                        ) : (
                          <span className="text-xs">حفظ الرابط</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 1-on-1 LESSON WITHOUT GROUP */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                  {isWhatsAppUsername(phone) ? (
                    <AtSign className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Phone className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span>رقم أو يوزر نيم الواتساب المستلم:</span>
                </label>
                {targetStudent && (
                  <span className="text-[11px] font-bold text-text-muted">
                    {targetStudent.name}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010xxxxxxxx أو @username"
                className="w-full bg-background border border-surface-border rounded-xl px-3.5 py-2 sm:py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                dir="ltr"
              />
            </div>
          )}

          {/* OFFLINE GROUP WORKFLOW */}
          {!isOnline && (
            <div className="space-y-2.5 bg-primary-soft/20 border border-primary-border/40 p-3.5 rounded-2xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>هوصل خلال:</span>
                </label>
                <span className="text-[11px] font-bold text-text-muted">
                  اختر موعد الوصول
                </span>
              </div>

              {/* Time selection options */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
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
                      className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-primary border-primary text-white shadow-md shadow-primary/25 scale-[1.02]'
                          : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
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
              <div className="bg-primary-soft/20 border border-primary-border/40 p-3 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-text-main font-bold">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <span>وقت الحصة:</span>
                </div>
                <span className="font-black text-primary bg-primary-soft border border-primary-border px-2.5 py-1 rounded-lg text-xs">
                  {formattedLessonTime}
                </span>
              </div>

              {/* Zoom Link Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-primary" />
                  <span>رابط الزووم (Zoom Link):</span>
                </label>

                {!zoomLink.trim() && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-2.5 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs mb-2">
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
                    className={`flex-1 bg-background border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                      !zoomLink.trim()
                        ? 'border-amber-400 focus:ring-2 focus:ring-amber-500/50'
                        : 'border-surface-border focus:ring-2 focus:ring-primary/40'
                    }`}
                    dir="ltr"
                  />
                  {zoomLink.trim() && (
                    <button
                      type="button"
                      onClick={handleSaveZoomLink}
                      disabled={isSavingZoom}
                      className="bg-surface hover:bg-surface-hover border border-surface-border text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0 text-text-main"
                    >
                      {zoomSaveSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-primary" />
                          <span className="text-primary text-xs">تم الحفظ</span>
                        </>
                      ) : (
                        <span className="text-xs">حفظ للجروب</span>
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
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>معاينة الرسالة:</span>
              </label>

              {customMessage !== null && (
                <button
                  type="button"
                  onClick={() => setCustomMessage(null)}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  استعادة النص الأصلي
                </button>
              )}
            </div>

            {/* Message Preview Bubble */}
            <div className="relative bg-surface-hover/80 border border-surface-border rounded-2xl p-3 sm:p-4 shadow-inner text-right space-y-2 font-sans">
              <textarea
                value={activeMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={isOnline ? 4 : 3}
                className="w-full bg-transparent text-text-main font-semibold text-xs sm:text-sm leading-relaxed resize-none focus:outline-none"
                dir="rtl"
              />

              <div className="flex items-center justify-between border-t border-surface-border pt-1.5 text-[10px] text-text-muted">
                <span>💬 جاهزة للإرسال على الواتساب</span>
                <span className="font-bold dir-ltr">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Action Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-surface-border flex flex-col gap-2 shrink-0 pb-safe-bottom sm:pb-4">
          {/* Main Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSendWhatsApp();
            }}
            className="w-full bg-primary hover:bg-primary-hover shadow-primary/25 active:scale-98 text-white font-black text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <Send className="w-4 h-4 fill-white" />
            <span>
              {isMultiStudentGroup || (targetGroup && sendMode === 'group')
                ? ((whatsAppGroupLinkInput.trim() || groupWhatsAppLink) 
                    ? `إرسال لجروب الواتساب (${targetGroup?.name || 'الجروب'})` 
                    : `نسخ وفتح واتساب (${targetGroup?.name || 'الجروب'})`)
                : `إرسال عبر واتساب ${targetStudent ? `(${targetStudent.name})` : ''}`}
            </span>
          </button>

          {/* Secondary Send Option: Send to Parent when in Group Mode, or Send to Group when in Individual Mode */}
          {targetGroup && (
            (isMultiStudentGroup || sendMode === 'group') ? (
              firstStudent && (() => {
                const firstResolved = resolveStudentWhatsAppContact(firstStudent);
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendToFirstParent(firstStudent);
                    }}
                    className="w-full bg-primary-soft/70 hover:bg-primary-soft border border-primary-border text-primary font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
                  >
                    {firstResolved.isUsername ? (
                      <AtSign className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                    <span>
                      إرسال فردي لولي أمر ({firstStudent.name})
                      {firstResolved.hasContact ? ` - ${firstResolved.display}` : ' (غير مسجل)'}
                    </span>
                  </button>
                );
              })()
            ) : (
              (whatsAppGroupLinkInput.trim() || groupWhatsAppLink) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const activeLink = whatsAppGroupLinkInput.trim() || groupWhatsAppLink;
                    try {
                      navigator.clipboard.writeText(activeMessage);
                    } catch (err) {}
                    if (activeLink) {
                      window.open(activeLink, '_blank');
                    } else {
                      window.open(buildWhatsAppUrl('', activeMessage), '_blank');
                    }
                  }}
                  className="w-full bg-primary-soft/70 hover:bg-primary-soft border border-primary-border text-primary font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
                >
                  <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>
                    إرسال لجروب الواتساب بدلاً من ذلك ({targetGroup.name})
                  </span>
                </button>
              )
            )
          )}

          {/* Secondary Actions (Copy & Cancel) */}
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText();
              }}
              className="flex-1 bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[42px]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-primary">تم النسخ</span>
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
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex-1 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted font-semibold text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-xl transition-all cursor-pointer min-h-[42px]"
            >
              إلغاء
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
