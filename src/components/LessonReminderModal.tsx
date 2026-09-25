import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson, Group } from '../types';
import { buildWhatsAppUrl, formatWhatsAppPhone, resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername } from '../utils/phoneUtils';
import { getUpcomingGroupSchedule } from '../utils/scheduleUtils';
import { getGroupCycleInfo } from '../utils/lessonUtils';
import { 
  X, Send, Copy, Check, MessageSquare, AlertTriangle, Clock, Link as LinkIcon, 
  MapPin, Video, Sparkles, Phone, Users, CheckCircle2, AtSign, Plus, Hash, BookOpen 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ReportLanguageToggle } from './ReportLanguageToggle';

interface LessonReminderModalProps {
  lesson?: Lesson | null;
  group?: Group | null;
  recipientPhone?: string;
  onClose: () => void;
}

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
  const { groups, students, lessons, profile, updateGroup, updateProfile, language, t, _t, reportLanguage, setReportLanguage, reportT } = useApp();

  const currentMsgLang = reportLanguage || 'ar';
  const msgT = (ar: string, en: string, de?: string) => {
    if (currentMsgLang === 'ar') return ar;
    if (currentMsgLang === 'de') return de || en;
    return en;
  };

  // Find associated group
  const targetGroup = group || (lesson?.groupId ? groups.find(g => g.id === lesson.groupId) : null);
  const groupStudents = targetGroup ? students.filter(s => s.groupId === targetGroup.id) : [];

  // Find upcoming lesson if lesson is not directly passed
  const upcomingLesson = lesson || (targetGroup ? (lessons || []).find(l => l.groupId === targetGroup.id && !l.deleted && (l.status === 'scheduled' || l.status === 'in_progress')) : null);
  
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

  // Calculate Package Cycle information
  const cycleInfo = targetGroup ? getGroupCycleInfo(targetGroup, lessons) : null;
  const sessionCount = targetGroup?.sessionCount || cycleInfo?.sessionCount || lesson?.totalSessionsInPackage || 4;
  const isPerLesson = targetGroup?.paymentCycle === 'per_lesson' || targetGroup?.paymentModel === 'per_session' || cycleInfo?.isPerLesson;
  const hasCycle = !isPerLesson && sessionCount > 1;
  const defaultSessionNumber = lesson?.sessionNumber || cycleInfo?.currentSessionNumber || 1;

  // Detect previous homework from previous lessons
  const detectedPreviousHomework = React.useMemo(() => {
    const currentLesson = lesson || upcomingLesson;
    const groupId = targetGroup?.id || currentLesson?.groupId;
    const studentId = targetStudent?.id || currentLesson?.studentId;

    // 1. Direct from current lesson report if already noted
    if (currentLesson?.report?.previousHomeworkDescription?.trim()) {
      return currentLesson.report.previousHomeworkDescription.trim();
    }
    if (currentLesson?.report?.arabicPreviousHomework?.trim()) {
      return currentLesson.report.arabicPreviousHomework.trim();
    }

    // 2. Search previous lessons for this group or student
    const candidates = (lessons || []).filter(l => {
      if (currentLesson && l.id === currentLesson.id) return false;
      if (l.deleted) return false;

      const matchGroup = groupId && l.groupId === groupId;
      const matchStudent = studentId && (l.studentId === studentId || l.report?.studentAttendance?.[studentId] !== undefined);

      return Boolean(matchGroup || matchStudent);
    });

    if (candidates.length === 0) return '';

    // Sort descending by date/time
    candidates.sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return (b.sessionNumber || 0) - (a.sessionNumber || 0);
    });

    const currentLessonTime = currentLesson 
      ? new Date(`${currentLesson.date}T${currentLesson.time || '00:00'}`).getTime() 
      : Date.now();

    const earlier = candidates.find(l => {
      const lTime = new Date(`${l.date}T${l.time || '00:00'}`).getTime();
      const isPrior = !isNaN(currentLessonTime) && !isNaN(lTime) ? lTime <= currentLessonTime : true;
      const hw = l.report?.arabicHomeworkRequired || l.report?.homeworkDescription || l.report?.homeworkTitle;
      return isPrior && Boolean(hw && hw.trim());
    });

    const fallback = earlier || candidates.find(l => {
      const hw = l.report?.arabicHomeworkRequired || l.report?.homeworkDescription || l.report?.homeworkTitle;
      return Boolean(hw && hw.trim());
    });

    return (
      fallback?.report?.arabicHomeworkRequired ||
      fallback?.report?.homeworkDescription ||
      fallback?.report?.homeworkTitle ||
      ''
    ).trim();
  }, [lessons, lesson, upcomingLesson, targetGroup, targetStudent]);

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

  const [selectedArrivalTime, setSelectedArrivalTime] = useState('15');
  const [zoomLink, setZoomLink] = useState(initialZoomLink);
  const [isSavingZoom, setIsSavingZoom] = useState(false);
  const [zoomSaveSuccess, setZoomSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState<string | null>(null);

  const arrivalOptions = React.useMemo(() => [
    { value: '5', label: msgT('5 دقايق', '5 mins', '5 Min') },
    { value: '10', label: msgT('10 دقايق', '10 mins', '10 Min') },
    { value: '15', label: msgT('15 دقيقة', '15 mins', '15 Min') },
    { value: '20', label: msgT('20 دقيقة', '20 mins', '20 Min') },
    { value: '25', label: msgT('25 دقيقة', '25 mins', '25 Min') },
    { value: '30', label: msgT('نص ساعة', '30 mins', '30 Min') },
  ], [currentMsgLang]);

  // Cycle & Homework States
  const [includeCycle, setIncludeCycle] = useState<boolean>(hasCycle);
  const [sessionNumber, setSessionNumber] = useState<number>(defaultSessionNumber);
  const [totalCycleSessions, setTotalCycleSessions] = useState<number>(sessionCount);

  const [includeHomework, setIncludeHomework] = useState<boolean>(Boolean(detectedPreviousHomework));
  const [previousHomework, setPreviousHomework] = useState<string>(detectedPreviousHomework);

  // Message Style: 'confirmation' (تأكيد ميعاد الحصة) vs 'immediate' (بدء الآن / في الطريق)
  const [reminderStyle, setReminderStyle] = useState<'confirmation' | 'immediate'>('confirmation');

  // Declutter UI toggles
  const [showRecipientSettings, setShowRecipientSettings] = useState<boolean>(false);
  const [showHomeworkInput, setShowHomeworkInput] = useState<boolean>(false);

  useEffect(() => {
    setWhatsAppGroupLinkInput(groupWhatsAppLink);
    if (groupWhatsAppLink) {
      setShowWhatsAppGroupSection(true);
    }
  }, [groupWhatsAppLink]);

  useEffect(() => {
    if (detectedPreviousHomework && !previousHomework) {
      setPreviousHomework(detectedPreviousHomework);
      setIncludeHomework(true);
    }
  }, [detectedPreviousHomework]);

  // Format lesson time cleanly for display
  const formattedLessonTime = React.useMemo(() => {
    if (!rawTime) return msgT('المحدد', 'Scheduled', 'Geplant');
    const [hStr, mStr] = rawTime.split(':');
    if (hStr && mStr) {
      let h = parseInt(hStr, 10);
      const isPm = h >= 12;
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      const period = isPm ? msgT('مساءً', 'PM', 'Uhr') : msgT('صباحاً', 'AM', 'Uhr');
      const timeDisplay = currentMsgLang === 'de' ? `${rawTime} Uhr` : `${h}:${mStr} ${period}`;
      return displayDay 
        ? `${msgT('يوم', 'Day', 'Am')} ${displayDay} ${msgT('الساعة', 'at', 'um')} ${timeDisplay}` 
        : timeDisplay;
    }
    return displayDay ? `${displayDay} ${rawTime}` : rawTime;
  }, [rawTime, displayDay, currentMsgLang]);

  // Generate template according to selected language (Arabic, English, German)
  const generatedMessage = React.useMemo(() => {
    const time12 = formatTimeTo12Hour(rawTime);
    const isGroup = isMultiStudentGroup || (targetGroup && sendMode === 'group');
    const arrivalLabel = arrivalOptions.find(o => o.value === selectedArrivalTime)?.label || `${selectedArrivalTime} ${msgT('دقيقة', 'mins', 'Min')}`;

    if (currentMsgLang === 'en') {
      const cycleLine = (hasCycle && includeCycle) 
        ? `\n\n🔢 Lesson Number: Session ${sessionNumber} of ${totalCycleSessions}`
        : '';
      const homeworkLine = (includeHomework && previousHomework.trim())
        ? `\n\n📝 Previous Homework to prepare:\n${previousHomework.trim()}`
        : '';

      if (isOnline) {
        const intro = reminderStyle === 'immediate'
          ? 'Hello,\n\nWe are starting our lesson now.'
          : `Hello,\n\nReminder and confirmation for our lesson scheduled at ${time12}.`;
        const zoomPart = zoomLink.trim() ? `\n\n🔗 Lesson Link:\n${zoomLink.trim()}` : '';
        return `${intro}${cycleLine}${homeworkLine}${zoomPart}`;
      } else {
        let intro = '';
        if (reminderStyle === 'immediate') {
          intro = isGroup
            ? `Hello,\n\nI am on my way and will arrive at the group in ${arrivalLabel}.`
            : `Hello,\n\nI am on my way and will arrive in ${arrivalLabel}.`;
        } else {
          intro = isGroup
            ? `Hello,\n\nReminder and confirmation for our group lesson scheduled at ${time12}.`
            : `Hello,\n\nReminder and confirmation for our lesson scheduled at ${time12}.`;
        }
        return `${intro}${cycleLine}${homeworkLine}`;
      }
    }

    if (currentMsgLang === 'de') {
      const cycleLine = (hasCycle && includeCycle) 
        ? `\n\n🔢 Unterrichtsstunde: Lektion ${sessionNumber} von ${totalCycleSessions}`
        : '';
      const homeworkLine = (includeHomework && previousHomework.trim())
        ? `\n\n📝 Hausaufgabe zur Vorbereitung:\n${previousHomework.trim()}`
        : '';

      if (isOnline) {
        const intro = reminderStyle === 'immediate'
          ? 'Guten Tag,\n\nwir beginnen jetzt mit unserer Unterrichtsstunde.'
          : `Guten Tag,\n\nErinnerung und Terminbestätigung für unsere Unterrichtsstunde um ${rawTime} Uhr.`;
        const zoomPart = zoomLink.trim() ? `\n\n🔗 Link zur Stunde:\n${zoomLink.trim()}` : '';
        return `${intro}${cycleLine}${homeworkLine}${zoomPart}`;
      } else {
        let intro = '';
        if (reminderStyle === 'immediate') {
          intro = isGroup
            ? `Guten Tag,\n\nich bin unterwegs und treffe in ${arrivalLabel} bei der Gruppe ein.`
            : `Guten Tag,\n\nich bin unterwegs und treffe in ${arrivalLabel} bei Ihnen ein.`;
        } else {
          intro = isGroup
            ? `Guten Tag,\n\nErinnerung und Terminbestätigung für die Gruppenstunde um ${rawTime} Uhr.`
            : `Guten Tag,\n\nErinnerung und Terminbestätigung für unsere Unterrichtsstunde um ${rawTime} Uhr.`;
        }
        return `${intro}${cycleLine}${homeworkLine}`;
      }
    }

    // Default: Arabic
    const cycleLine = (hasCycle && includeCycle) 
      ? `\n\n🔢 رقم الحصة: الحصة ${sessionNumber} من ${totalCycleSessions}`
      : '';
    const homeworkLine = (includeHomework && previousHomework.trim())
      ? `\n\n📝 واجب الحصة السابقة المطلوب تجهيزه:\n${previousHomework.trim()}`
      : '';

    if (isOnline) {
      const intro = reminderStyle === 'immediate'
        ? 'السلام عليكم ورحمة الله وبركاته\n\nهنبدأ الحصة الآن إن شاء الله.'
        : `السلام عليكم ورحمة الله وبركاته\n\nتذكير وتأكيد بموعد حصتنا إن شاء الله الساعة ${time12}.`;
      const zoomPart = zoomLink.trim() ? `\n\n🔗 لينك الحصة:\n${zoomLink.trim()}` : '';
      return `${intro}${cycleLine}${homeworkLine}${zoomPart}`;
    } else {
      let intro = '';
      if (reminderStyle === 'immediate') {
        intro = isGroup
          ? `السلام عليكم ورحمة الله وبركاته\n\nأنا في الطريق وهوصل للمجموعة خلال ${arrivalLabel} إن شاء الله.`
          : `السلام عليكم ورحمة الله وبركاته\n\nأنا في الطريق وهوصل لحضرتك خلال ${arrivalLabel} إن شاء الله.`;
      } else {
        intro = isGroup
          ? `السلام عليكم ورحمة الله وبركاته\n\nتذكير وتأكيد بموعد حصة المجموعة إن شاء الله الساعة ${time12}.`
          : `السلام عليكم ورحمة الله وبركاته\n\nتذكير وتأكيد بموعد حصتنا إن شاء الله الساعة ${time12}.`;
      }
      return `${intro}${cycleLine}${homeworkLine}`;
    }
  }, [
    currentMsgLang,
    isOnline, 
    rawTime, 
    zoomLink, 
    selectedArrivalTime, 
    isMultiStudentGroup, 
    targetGroup, 
    sendMode,
    hasCycle,
    includeCycle,
    sessionNumber,
    totalCycleSessions,
    includeHomework,
    previousHomework,
    reminderStyle,
    arrivalOptions
  ]);

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
      alert(_t('برجاء إضافة رابط الزووم أولاً قبل إرسال التذكير.', 'Please add the Zoom link before sending the reminder.', 'Bitte fügen Sie zuerst den Zoom-Link hinzu.'));
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
      alert(_t('لا يوجد طالب مسجل.', 'No student found.', 'Kein Schüler gefunden.'));
      return;
    }
    const resolved = resolveStudentWhatsAppContact(studentToTarget);
    if (!resolved.hasContact) {
      alert(_t(`بيانات التواصل (رقم هاتف أو يوزر نيم واتساب) لولي أمر الطالب (${studentToTarget.name}) غير مسجلة في بيانات الطالب.`, `Contact information for parent of (${studentToTarget.name}) is missing.`, `Kontaktdaten für die Eltern von (${studentToTarget.name}) fehlen.`));
      return;
    }
    if (isOnline && !zoomLink.trim()) {
      alert(_t('برجاء إضافة رابط الزووم أولاً قبل إرسال التذكير.', 'Please add the Zoom link before sending the reminder.', 'Bitte fügen Sie zuerst den Zoom-Link hinzu.'));
      return;
    }

    const finalMsg = activeMessage;
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
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 overflow-y-auto font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border rounded-t-[26px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up text-text-main flex flex-col max-h-[92dvh] sm:max-h-[85vh]"
      >
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-2 sm:hidden shrink-0" />

        {/* 1. Header - Clean & Compact */}
        <div className="bg-surface border-b border-surface-border px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl shrink-0 bg-primary-soft text-primary border border-primary-border/60">
              {isOnline ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-black text-text-main truncate">
                  {targetGroup?.name || targetStudent?.name || _t('تأكيد موعد الحصة', 'Confirm Lesson Schedule', 'Terminbestätigung')}
                </h3>
                <span className="text-[10px] font-bold bg-primary-soft text-primary border border-primary-border px-1.5 py-0.5 rounded-md shrink-0">
                  {isOnline ? _t('أونلاين', 'Online', 'Online') : _t('حضوري', 'In-Person', 'Präsenz')} • {formattedLessonTime}
                </span>
              </div>
              <p className="text-[11px] text-text-muted truncate mt-0.5">
                {_t('تأكيد الموعد والتذكير عبر واتساب', 'Schedule Confirmation & Reminder via WhatsApp', 'Terminbestätigung via WhatsApp')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ReportLanguageToggle
              showLabel={false}
              onLanguageChange={() => setCustomMessage(null)}
            />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted hover:text-text-main rounded-full transition-colors cursor-pointer shrink-0"
              title={_t('إغلاق', 'Close', 'Schließen')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain flex flex-col">
          {/* Mismatch Warning (Subtle 1-line badge if applicable) */}
          {hasTimeMismatch && (
            <div className="mx-4 mt-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1.5 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{_t(`تنبيه: وقت الحصة (${lesson?.time}) يختلف عن موعد الجروب (${rawTime})، وتم اعتماد موعد الجروب.`, `Notice: Lesson time (${lesson?.time}) differs from group time (${rawTime}). Using group time.`, `Hinweis: Lektionszeit weicht vom Gruppenplan ab.`)}</span>
            </div>
          )}

        {/* 2. Destination Strip - Clean & Expandable */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-surface-border text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0 text-text-muted">
            <span className="text-text-main font-bold shrink-0 flex items-center gap-1">
              {isMultiStudentGroup || sendMode === 'group' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('الجروب:', 'Group:', 'Gruppe:')}</span>
                </>
              ) : (
                <>
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('ولي الأمر:', 'Parent:', 'Eltern:')}</span>
                </>
              )}
            </span>
            <span className="font-semibold text-text-main truncate">
              {isMultiStudentGroup || sendMode === 'group' 
                ? (targetGroup?.name || _t('جروب الواتساب', 'WhatsApp Group', 'WhatsApp-Gruppe')) 
                : (targetStudent ? `${targetStudent.name} (${phone || _t('غير مسجل', 'Not set', 'Nicht hinterlegt')})` : phone)}
            </span>
            {isMultiStudentGroup && groupStudents.length > 0 && (
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded shrink-0">
                {groupStudents.length} {_t('طلاب', 'Students', 'Schüler')}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowRecipientSettings(!showRecipientSettings)}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{showRecipientSettings ? _t('إخفاء', 'Hide', 'Ausblenden') : _t('تعديل', 'Edit', 'Bearbeiten')}</span>
          </button>
        </div>

        {/* Collapsible Destination Settings (Only if clicked) */}
        {showRecipientSettings && (
          <div className="px-4 py-2.5 bg-surface-hover/60 border-b border-surface-border space-y-2 text-xs shrink-0 animate-fade-in">
            {isSingleStudentGroup && (
              <div className="flex bg-surface p-0.5 rounded-lg border border-surface-border gap-1 max-w-xs">
                <button
                  type="button"
                  onClick={() => setSendMode('individual')}
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-bold transition-all ${
                    sendMode === 'individual' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted'
                  }`}
                >
                  {_t('ولي الأمر', 'Parent', 'Eltern')}
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('group')}
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-bold transition-all ${
                    sendMode === 'group' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted'
                  }`}
                >
                  {_t('جروب الواتساب', 'WhatsApp Group', 'WhatsApp-Gruppe')}
                </button>
              </div>
            )}

            {(isMultiStudentGroup || sendMode === 'group') ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={whatsAppGroupLinkInput}
                  onChange={(e) => setWhatsAppGroupLinkInput(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="flex-1 bg-background border border-surface-border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleSaveWhatsAppGroupLink}
                  disabled={isSavingWhatsAppLink || !whatsAppGroupLinkInput.trim()}
                  className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {whatsAppSaveSuccess ? _t('تم الحفظ', 'Saved', 'Gespeichert') : _t('حفظ', 'Save', 'Speichern')}
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={_t('010xxxxxxxx أو @username', 'Phone or @username', 'Telefon oder @username')}
                className="w-full bg-background border border-surface-border rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                dir="ltr"
              />
            )}
          </div>
        )}

        {/* 3. Quick Options Bar - Compact Chips in a Single Row */}
        <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {/* Style Switcher (Segmented Control) */}
            <div className="flex items-center bg-surface-hover p-0.5 rounded-xl border border-surface-border text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setReminderStyle('confirmation');
                  setCustomMessage(null);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  reminderStyle === 'confirmation'
                    ? 'bg-primary text-white shadow-2xs font-black'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {_t('تأكيد الميعاد', 'Confirm Time', 'Termin bestätigen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReminderStyle('immediate');
                  setCustomMessage(null);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  reminderStyle === 'immediate'
                    ? 'bg-primary text-white shadow-2xs font-black'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {isOnline ? _t('بدء الآن', 'Start Now', 'Jetzt starten') : _t('في الطريق', 'On My Way', 'Unterwegs')}
              </button>
            </div>

            {/* Feature Chips: Cycle & Homework */}
            <div className="flex items-center gap-1.5">
              {/* Cycle Chip */}
              {hasCycle && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all select-none ${
                  includeCycle
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface border-surface-border text-text-muted opacity-50'
                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeCycle(!includeCycle);
                      setCustomMessage(null);
                    }}
                    className="flex items-center gap-1 cursor-pointer"
                    title={_t('تضمين رقم الحصة في السايكل', 'Include session number in cycle', 'Lektionsnummer einbinden')}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>{_t('الحصة', 'Lesson', 'Lektion')} {sessionNumber}/{totalCycleSessions}</span>
                  </button>

                  {includeCycle && (
                    <div className="flex items-center border-r border-primary/25 pr-1 mr-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSessionNumber(prev => Math.max(1, prev - 1));
                          setCustomMessage(null);
                        }}
                        disabled={sessionNumber <= 1}
                        className="w-4 h-4 rounded hover:bg-primary/20 flex items-center justify-center text-xs font-black disabled:opacity-30 cursor-pointer"
                        title={_t('الحصة السابقة', 'Previous Session', 'Vorherige Lektion')}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionNumber(prev => Math.min(totalCycleSessions, prev + 1));
                          setCustomMessage(null);
                        }}
                        disabled={sessionNumber >= totalCycleSessions}
                        className="w-4 h-4 rounded hover:bg-primary/20 flex items-center justify-center text-xs font-black disabled:opacity-30 cursor-pointer"
                        title={_t('الحصة التالية', 'Next Session', 'Nächste Lektion')}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Homework Chip */}
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all select-none ${
                includeHomework
                  ? 'bg-primary-soft border-primary-border text-primary'
                  : 'bg-surface border-surface-border text-text-muted opacity-50'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setIncludeHomework(!includeHomework);
                    setCustomMessage(null);
                  }}
                  className="flex items-center gap-1 cursor-pointer"
                  title={_t('تضمين واجب الحصة السابقة', 'Include previous homework', 'Hausaufgabe einbinden')}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{_t('الواجب', 'Homework', 'Hausaufgabe')}</span>
                </button>
                {includeHomework && (
                  <button
                    type="button"
                    onClick={() => setShowHomeworkInput(!showHomeworkInput)}
                    className="text-[10px] underline cursor-pointer pr-0.5 hover:opacity-80"
                    title={_t('تعديل نص الواجب', 'Edit Homework', 'Hausaufgabe bearbeiten')}
                  >
                    {previousHomework ? _t('تعديل', 'Edit', 'Bearbeiten') : _t('إضافة', 'Add', 'Hinzufügen')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conditional: Offline arrival times (only when 'في الطريق') */}
          {!isOnline && reminderStyle === 'immediate' && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
              <span className="text-[11px] font-bold text-text-muted shrink-0">{_t('الوصول خلال:', 'Arrival in:', 'Ankunft in:')}</span>
              {arrivalOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSelectedArrivalTime(opt.value);
                    setCustomMessage(null);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                    selectedArrivalTime === opt.value
                      ? 'bg-primary text-white border-primary shadow-2xs font-black'
                      : 'bg-surface border-surface-border text-text-muted hover:text-text-main'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Conditional: Homework inline edit drawer */}
          {includeHomework && showHomeworkInput && (
            <div className="space-y-1 bg-surface-hover/60 border border-surface-border p-2 rounded-xl text-xs">
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span className="font-bold">{_t('نص واجب الحصة السابقة المطلوب تجهيزه:', 'Previous homework text:', 'Hausaufgabentext:')}</span>
                <button
                  type="button"
                  onClick={() => setShowHomeworkInput(false)}
                  className="text-primary hover:underline font-bold"
                >
                  {_t('تم', 'Done', 'Fertig')}
                </button>
              </div>
              <textarea
                value={previousHomework}
                onChange={(e) => {
                  setPreviousHomework(e.target.value);
                  setCustomMessage(null);
                }}
                rows={2}
                placeholder={_t('اكتب تفاصيل الواجب هنا...', 'Type homework details here...', 'Hausaufgabendetails eingeben...')}
                className="w-full bg-background border border-surface-border rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary resize-none text-text-main"
                dir="auto"
              />
            </div>
          )}

          {/* Conditional: Online missing Zoom link */}
          {isOnline && !zoomLink.trim() && (
            <div className="bg-amber-500/10 border border-amber-500/25 p-2 rounded-xl flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold min-w-0 truncate">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{_t('رابط الزووم غير مسجل', 'Zoom Link Not Set', 'Zoom-Link fehlt')}</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <input
                  type="url"
                  value={zoomLink}
                  onChange={(e) => {
                    setZoomLink(e.target.value);
                    setCustomMessage(null);
                  }}
                  placeholder="https://zoom.us/j/..."
                  className="bg-background border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1 text-xs font-mono w-40 sm:w-48"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleSaveZoomLink}
                  disabled={isSavingZoom || !zoomLink.trim()}
                  className="bg-primary text-white text-[11px] font-bold px-2 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {_t('حفظ', 'Save', 'Speichern')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Message Box - The Hero View */}
        <div className="px-4 pb-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between text-[11px] text-text-muted mb-1 px-1">
            <span className="font-bold flex items-center gap-1 text-text-main">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>{_t('نص الرسالة (جاهز للإرسال على الواتساب):', 'Message text (ready for WhatsApp):', 'Nachrichtenvorschau für WhatsApp:')}</span>
            </span>
            {customMessage !== null && (
              <button
                type="button"
                onClick={() => setCustomMessage(null)}
                className="text-primary hover:underline font-bold cursor-pointer"
              >
                {_t('استعادة النص التلقائي', 'Reset to Auto Template', 'Zurücksetzen')}
              </button>
            )}
          </div>

          {/* Message Preview Bubble */}
          <div className="relative bg-primary-soft/20 border border-primary-border/40 rounded-2xl p-3 sm:p-3.5 shadow-2xs flex-1 flex flex-col min-h-[110px] sm:min-h-[140px]">
            <textarea
              value={activeMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full flex-1 bg-transparent text-text-main font-medium text-xs sm:text-[13px] leading-relaxed resize-none focus:outline-none min-h-[80px]"
              dir="auto"
            />
            <div className="flex items-center justify-between border-t border-primary-border/30 pt-1.5 text-[10px] text-text-muted select-none">
              <span>{_t('يمكنك تعديل أي جزء من النص مباشرة ✍️', 'You can edit any part of the text directly ✍️', 'Text kann direkt bearbeitet werden ✍️')}</span>
              <span className="font-mono dir-ltr font-bold text-primary">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
              </span>
            </div>
          </div>
        </div>
        </div>

        {/* 5. Action Footer - Minimalist & Punchy */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-surface-border flex flex-col gap-2 shrink-0 pb-safe-bottom sm:pb-4">
          <div className="flex items-center gap-2">
            {/* Primary WhatsApp Action */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 bg-primary hover:bg-primary-hover text-white font-black text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl shadow-lg shadow-primary/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] min-w-0"
            >
              <Send className="w-4 h-4 fill-white shrink-0" />
              <span className="truncate">
                {isMultiStudentGroup || (targetGroup && sendMode === 'group')
                  ? ((whatsAppGroupLinkInput.trim() || groupWhatsAppLink)
                      ? _t(`إرسال لجروب الواتساب (${targetGroup?.name || 'الجروب'})`, `Send to WhatsApp Group (${targetGroup?.name || 'Group'})`, `An WhatsApp-Gruppe senden (${targetGroup?.name || 'Gruppe'})`)
                      : _t(`فتح واتساب (${targetGroup?.name || 'الجروب'})`, `Open WhatsApp (${targetGroup?.name || 'Group'})`, `WhatsApp öffnen (${targetGroup?.name || 'Gruppe'})`))
                  : _t(`إرسال عبر واتساب`, `Send via WhatsApp`, `Über WhatsApp senden`)}
              </span>
            </button>

            {/* Quick Copy Button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs py-2.5 sm:py-3 px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[44px]"
              title={_t('نسخ نص الرسالة', 'Copy message text', 'Nachrichtentext kopieren')}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-primary font-bold">{_t('تم النسخ', 'Copied', 'Kopiert')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-text-muted shrink-0" />
                  <span>{_t('نسخ', 'Copy', 'Kopieren')}</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary parent send option if in group mode */}
          {targetGroup && (isMultiStudentGroup || sendMode === 'group') && firstStudent && (
            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => handleSendToFirstParent(firstStudent)}
                className="text-[11px] font-bold text-text-muted hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1 truncate max-w-full"
              >
                <span className="truncate">{_t(`أو إرسال فردي لولي أمر (${firstStudent.name})`, `Or send individually to parent of (${firstStudent.name})`, `Oder einzeln an Eltern von (${firstStudent.name}) senden`)}</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
