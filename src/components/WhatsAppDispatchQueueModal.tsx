import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lesson, Student, TeacherProfile, Group } from '../types';
import { useApp } from '../context/AppContext';
import { 
  X, Send, Check, CheckCircle2, Copy, Users, User, Clock, AlertTriangle, 
  Sparkles, RefreshCw, Smartphone, ChevronRight, ChevronLeft, ArrowRight, 
  MessageSquare, ExternalLink, FastForward, CheckSquare, Edit3, Award, Flame,
  Calendar, Filter, CalendarDays, ChevronDown, ListFilter
} from 'lucide-react';
import { 
  buildQueueMessageForStudent, 
  QueueTemplateType, 
  getSavedQueueProgress, 
  saveQueueProgress, 
  clearQueueProgress,
  getYesterdayLocalDateStr,
  getBeforeYesterdayLocalDateStr,
  getArabicDayFromDate,
  formatArabicDateDisplay,
  formatArabicTimeDisplay,
  recordStudentReportDispatched,
  isStudentReportDispatched
} from '../utils/whatsappQueueUtils';
import { 
  buildWhatsAppUrl, 
  resolveStudentWhatsAppContact, 
  cleanPhoneNumberForTel, 
  formatContactDisplay 
} from '../utils/phoneUtils';
import { playLernstudioSound } from '../utils/lernstudioAudioUtils';
import { isLikelyFemaleStudent } from '../utils/genderUtils';
import { resolveStudentReportAttendance } from '../utils/lessonUtils';
import { getGroupScheduleSlots, getDayNumber, isDateMatchingGroupRecurrence } from '../utils/scheduleUtils';
import { getLocalDateStr, normalizeDateToISO, parseLocalDate } from '../utils/timeUtils';
import { saveToPhoneSubfolderAndRegister } from '../services/downloadedFilesService';

interface WhatsAppDispatchQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson?: Lesson;
  initialStudents?: Student[];
  initialGroup?: Group;
  title?: string;
  defaultTemplate?: QueueTemplateType;
  initialDate?: string;
}

export const WhatsAppDispatchQueueModal: React.FC<WhatsAppDispatchQueueModalProps> = ({
  isOpen,
  onClose,
  lesson,
  initialStudents,
  initialGroup,
  title,
  defaultTemplate = 'egyptian',
  initialDate
}) => {
  const { students, groups, lessons, profile, updateLesson, saveLessonReport, _t, language, t } = useApp();

  // 1. Day / Date Selection State
  // Modes: 'today' | 'yesterday' | 'before_yesterday' | 'custom' | 'all'
  const [selectedDateMode, setSelectedDateMode] = useState<'today' | 'yesterday' | 'before_yesterday' | 'custom' | 'all'>(() => {
    if (initialDate) return initialDate === getLocalDateStr() ? 'today' : 'custom';
    if (lesson?.date) return lesson.date === getLocalDateStr() ? 'today' : 'custom';
    return 'today';
  });

  const [customDateStr, setCustomDateStr] = useState<string>(() => {
    return initialDate || lesson?.date || getLocalDateStr();
  });

  const [selectedSessionId, setSelectedSessionId] = useState<'all' | string>('all');
  const [showStudentsListDrawer, setShowStudentsListDrawer] = useState<boolean>(false);

  // Compute effective date YYYY-MM-DD or 'all'
  const effectiveDateStr = useMemo(() => {
    if (selectedDateMode === 'all') return 'all';
    if (selectedDateMode === 'today') return getLocalDateStr();
    if (selectedDateMode === 'yesterday') return getYesterdayLocalDateStr();
    if (selectedDateMode === 'before_yesterday') return getBeforeYesterdayLocalDateStr();
    return normalizeDateToISO(customDateStr) || getLocalDateStr();
  }, [selectedDateMode, customDateStr]);

  // Reset session filter when effective date changes
  useEffect(() => {
    setSelectedSessionId('all');
  }, [effectiveDateStr]);

  // 2. Resolve target group if prop provided
  const targetGroup = useMemo(() => {
    if (initialGroup) return initialGroup;
    if (lesson?.groupId) {
      return (groups || []).find(g => g.id === lesson.groupId) ||
        (groups || []).find(g => g.name && g.name.trim().toLowerCase() === lesson.groupId!.trim().toLowerCase());
    }
    if (lesson?.groupName) {
      return (groups || []).find(g => g.name.trim().toLowerCase() === lesson.groupName!.trim().toLowerCase());
    }
    return undefined;
  }, [initialGroup, lesson, groups]);

  // 3. Fallback Synthetic Lesson if none found
  const fallbackSyntheticLesson: Lesson = useMemo(() => {
    if (lesson) return lesson;
    const dateToUse = effectiveDateStr === 'all' ? getLocalDateStr() : effectiveDateStr;
    return {
      id: `queue_synthetic_${dateToUse}`,
      title: title || targetGroup?.name || 'مجموعة اللغة الألمانية',
      groupId: targetGroup?.id || '',
      groupName: targetGroup?.name || 'الألماني',
      date: dateToUse,
      time: '12:00',
      durationMinutes: 60,
      duration: 60,
      type: 'offline',
      status: 'completed',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      grade: 'Klasse 5',
      paymentStatus: 'paid',
      amountDue: 0,
      amountPaid: 0,
      report: {
        attendanceStatus: 'present',
        topicCovered: 'مراجعة شاملة وتدريبات',
        homeworkRequired: 'حل تدريبات الملزمة',
      }
    };
  }, [lesson, targetGroup, title, effectiveDateStr]);

  // 4. Resolve Lessons for the Selected Day (Accurate, Day-Specific, No Unbounded Projection)
  const dayLessons = useMemo(() => {
    if (effectiveDateStr === 'all') return [];
    const targetDate = normalizeDateToISO(effectiveDateStr);
    if (!targetDate) return [];

    // 1. Explicit stored lessons matching this exact date
    const matchingExplicit = (lessons || []).filter(
      l => !l.deleted && normalizeDateToISO(l.date) === targetDate
    );

    // 2. Projected lessons for active recurring groups on this specific day of week
    const targetD = parseLocalDate(targetDate);
    const dayNum = targetD.getDay();
    const activeGroups = (groups || []).filter(g => !g.deleted && g.status !== 'archived');
    const existingGroupIds = new Set(matchingExplicit.map(l => l.groupId).filter(Boolean));

    const projectedForDate: Lesson[] = [];
    activeGroups.forEach(group => {
      if (existingGroupIds.has(group.id)) return;
      if (!isDateMatchingGroupRecurrence(group.scheduleRecurrence, targetDate)) return;

      const slots = getGroupScheduleSlots(group);
      const matchingSlots = slots.filter(s => getDayNumber(s.day) === dayNum);

      matchingSlots.forEach(slot => {
        const sessionTime = slot.time || group.scheduleTime || '17:00';
        projectedForDate.push({
          id: `proj_${group.id}_${targetDate}_${sessionTime.replace(':', '')}`,
          groupId: group.id,
          groupName: group.name,
          title: `${group.name} - ${sessionTime}`,
          date: targetDate,
          time: sessionTime,
          durationMinutes: group.lessonDurationMinutes || 60,
          duration: group.lessonDurationMinutes || 60,
          type: group.type,
          grade: group.grade,
          sessionNumber: 1,
          totalSessionsInPackage: group.sessionCount || 4,
          status: 'scheduled',
          paymentStatus: 'pending',
          amountDue: 0,
          amountPaid: 0,
          scheduleRecurrence: group.scheduleRecurrence || 'weekly',
          report: {
            attendanceStatus: 'present',
            topicCovered: 'مراجعة شاملة وتدريبات',
            homeworkRequired: 'حل تدريبات الملزمة',
          }
        } as Lesson);
      });
    });

    const allLessons = [...matchingExplicit, ...projectedForDate];
    return allLessons.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [effectiveDateStr, lessons, groups]);

  // Filter lessons if a specific session is selected
  const activeLessonsForDay = useMemo(() => {
    if (effectiveDateStr === 'all') return [];
    if (selectedSessionId !== 'all') {
      const found = dayLessons.filter(l => l.id === selectedSessionId);
      if (found.length > 0) return found;
    }
    return dayLessons;
  }, [dayLessons, selectedSessionId, effectiveDateStr]);

  // 5. Resolve Students & Map each student to their exact lesson
  const { queueStudents, studentLessonMap } = useMemo(() => {
    const sMap: Record<string, Lesson> = {};

    // Mode: ALL STUDENTS (or explicit initialStudents prop)
    if (effectiveDateStr === 'all') {
      const baseList = (initialStudents && initialStudents.length > 0)
        ? initialStudents
        : (students || []).filter(s => !s.deleted && s.status !== 'archived');

      baseList.forEach(st => {
        if (lesson) {
          sMap[st.id] = lesson;
        } else if (st.groupId) {
          const grpLesson = (lessons || []).find(l => !l.deleted && l.groupId === st.groupId);
          sMap[st.id] = grpLesson || fallbackSyntheticLesson;
        } else {
          sMap[st.id] = fallbackSyntheticLesson;
        }
      });

      return { queueStudents: baseList, studentLessonMap: sMap };
    }

    // Mode: SPECIFIC DAY SELECTED
    if (activeLessonsForDay.length > 0) {
      const studentIdSet = new Set<string>();
      const resolvedList: Student[] = [];

      activeLessonsForDay.forEach(ls => {
        let lessonStudents: Student[] = [];
        if (ls.groupId) {
          lessonStudents = (students || []).filter(
            s => !s.deleted && s.status !== 'archived' && s.groupId === ls.groupId
          );
        } else if (ls.studentId) {
          const st = (students || []).find(s => s.id === ls.studentId);
          if (st) lessonStudents = [st];
        } else if (ls.studentName) {
          const st = (students || []).find(s => s.name.trim().toLowerCase() === ls.studentName!.trim().toLowerCase());
          if (st) lessonStudents = [st];
        }

        lessonStudents.forEach(st => {
          sMap[st.id] = ls;
          if (!studentIdSet.has(st.id)) {
            studentIdSet.add(st.id);
            resolvedList.push(st);
          }
        });
      });

      // If initialStudents was explicitly provided and has matching students on this date, respect it
      if (initialStudents && initialStudents.length > 0) {
        const allowedIds = new Set(initialStudents.map(s => s.id));
        const filtered = resolvedList.filter(s => allowedIds.has(s.id));
        if (filtered.length > 0) {
          return { queueStudents: filtered, studentLessonMap: sMap };
        }
      }

      return { queueStudents: resolvedList, studentLessonMap: sMap };
    }

    // No lessons on this day
    return { queueStudents: [], studentLessonMap: sMap };
  }, [effectiveDateStr, activeLessonsForDay, initialStudents, students, lessons, lesson, fallbackSyntheticLesson]);

  // 6. Persistence Queue Key
  const queueKey = useMemo(() => {
    if (effectiveDateStr === 'all') {
      return lesson?.id || targetGroup?.id || `students_all_${queueStudents.length}`;
    }
    return `date_${effectiveDateStr}${selectedSessionId !== 'all' ? `_sess_${selectedSessionId}` : ''}`;
  }, [effectiveDateStr, selectedSessionId, lesson?.id, targetGroup?.id, queueStudents.length]);

  // 7. State
  const [templateType, setTemplateType] = useState<QueueTemplateType>(defaultTemplate);
  const [customTemplateText, setCustomTemplateText] = useState<string>(
    'السلام عليكم ورحمة الله وبركاته يا فندم 👋\nحبيت أبلغ حضرتك بتقرير حصة الألماني لـ {اسم_الطالب} 🇩🇪:\n• التاريخ: {التاريخ}\n• اللي اتشرح: {الشرح}\n• الهومورك: {الواجب}\nمع تحيات: {اسم_المعلم}'
  );
  const [recipientTarget, setRecipientTarget] = useState<'parent' | 'student'>('parent');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'sent' | 'skipped'>('all');
  
  // Sent & Skipped state
  const [sentMap, setSentMap] = useState<Record<string, string>>({}); // studentId -> timestamp
  const [skippedSet, setSkippedSet] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const [editedPreviewText, setEditedPreviewText] = useState<string>('');
  const [isEditingActiveMessage, setIsEditingActiveMessage] = useState<boolean>(false);

  // Sync to localStorage
  const syncToStorage = (newSent: Record<string, string>, newSkipped: Set<string>) => {
    saveQueueProgress(queueKey, {
      sentStudentIds: Object.keys(newSent),
      skippedStudentIds: Array.from(newSkipped),
      timestamps: newSent,
      lastActiveStudentId: queueStudents[currentIndex]?.id
    });
  };

  // 8. Cross-Modal Sent Synchronization
  useEffect(() => {
    if (!isOpen) return;

    const saved = getSavedQueueProgress(queueKey);
    const initialSent: Record<string, string> = { ...(saved.timestamps || {}) };
    saved.sentStudentIds.forEach(id => {
      if (!initialSent[id]) initialSent[id] = 'سابقاً';
    });

    // Check each student in queue against cross-modal dispatch store & lesson state
    queueStudents.forEach(st => {
      const stLesson = studentLessonMap[st.id] || fallbackSyntheticLesson;
      const dispatched = isStudentReportDispatched(st.id, {
        lessonId: stLesson?.id,
        dateStr: effectiveDateStr === 'all' ? stLesson?.date : effectiveDateStr,
        lessonDispatchedStudents: stLesson?.whatsAppDispatchedStudents
      });

      if (dispatched.isSent && !initialSent[st.id]) {
        initialSent[st.id] = dispatched.time || 'تم مسبقاً';
      }
    });

    setSentMap(initialSent);
    setSkippedSet(new Set(saved.skippedStudentIds || []));

    // Find first non-sent student
    const firstPendingIdx = queueStudents.findIndex(
      s => !initialSent[s.id] && !saved.skippedStudentIds?.includes(s.id)
    );
    if (firstPendingIdx >= 0) {
      setCurrentIndex(firstPendingIdx);
    } else {
      setCurrentIndex(0);
    }
  }, [isOpen, queueKey, queueStudents, effectiveDateStr, studentLessonMap, fallbackSyntheticLesson]);

  // 9. Live Listener for Real-Time Dispatch Events from outside modals
  useEffect(() => {
    if (!isOpen) return;

    const handleExternalDispatch = (e: any) => {
      const detail = e.detail;
      if (!detail || !detail.studentId) return;
      setSentMap(prev => {
        if (prev[detail.studentId]) return prev;
        const updated = { ...prev, [detail.studentId]: detail.timeStr || detail.time || 'الآن' };
        syncToStorage(updated, skippedSet);
        return updated;
      });
    };

    window.addEventListener('gluck_whatsapp_dispatched', handleExternalDispatch);
    return () => window.removeEventListener('gluck_whatsapp_dispatched', handleExternalDispatch);
  }, [isOpen, skippedSet]);

  const activeStudent: Student | undefined = queueStudents[currentIndex];
  const activeStudentLesson: Lesson = (activeStudent ? studentLessonMap[activeStudent.id] : undefined) || fallbackSyntheticLesson;

  // Resolve message for current student
  const activeMessageText = useMemo(() => {
    if (!activeStudent) return '';
    return buildQueueMessageForStudent(activeStudent, activeStudentLesson, profile, {
      templateType,
      customTemplate: customTemplateText,
      group: targetGroup,
      targetRecipient: recipientTarget
    });
  }, [activeStudent, activeStudentLesson, profile, templateType, customTemplateText, targetGroup, recipientTarget]);

  // Reset custom edit when active student changes
  useEffect(() => {
    setIsEditingActiveMessage(false);
    setEditedPreviewText('');
  }, [currentIndex, templateType, recipientTarget]);

  // Counts & Progress
  const totalCount = queueStudents.length;
  const sentCount = Object.keys(sentMap).length;
  const skippedCount = skippedSet.size;
  const pendingCount = Math.max(0, totalCount - sentCount - skippedCount);
  const percentComplete = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;
  const isAllDone = totalCount > 0 && sentCount + skippedCount === totalCount;

  // Count how many were already dispatched outside
  const alreadyDispatchedCount = useMemo(() => {
    return queueStudents.filter(st => {
      const stLesson = studentLessonMap[st.id] || fallbackSyntheticLesson;
      return isStudentReportDispatched(st.id, {
        lessonId: stLesson?.id,
        dateStr: effectiveDateStr === 'all' ? stLesson?.date : effectiveDateStr,
        lessonDispatchedStudents: stLesson?.whatsAppDispatchedStudents
      }).isSent;
    }).length;
  }, [queueStudents, studentLessonMap, fallbackSyntheticLesson, effectiveDateStr]);

  // Resolved contact for active student
  const activeContact = useMemo(() => {
    if (!activeStudent) return { contact: '', hasContact: false, isUsername: false, cleanForUrl: '' };
    if (recipientTarget === 'student') {
      const stPhone = (activeStudent.studentPhone || activeStudent.phone || '').trim();
      return resolveStudentWhatsAppContact(activeStudent, {
        quickStudentPhone: stPhone,
        preferStudent: true,
        targetRecipient: 'student'
      });
    }
    return resolveStudentWhatsAppContact(activeStudent);
  }, [activeStudent, recipientTarget]);

  // Advance to next pending student
  const advanceToNextPending = (fromIdx: number, updatedSent: Record<string, string>, updatedSkipped: Set<string>) => {
    for (let i = fromIdx + 1; i < queueStudents.length; i++) {
      const st = queueStudents[i];
      if (!updatedSent[st.id] && !updatedSkipped.has(st.id)) {
        setCurrentIndex(i);
        return;
      }
    }
    for (let i = 0; i < fromIdx; i++) {
      const st = queueStudents[i];
      if (!updatedSent[st.id] && !updatedSkipped.has(st.id)) {
        setCurrentIndex(i);
        return;
      }
    }
    if (fromIdx < queueStudents.length - 1) {
      setCurrentIndex(fromIdx + 1);
    }
  };

  // SEND & ADVANCE HANDLER
  const handleSendAndAdvance = async () => {
    if (!activeStudent) return;
    const textToSend = isEditingActiveMessage && editedPreviewText.trim()
      ? editedPreviewText.trim()
      : activeMessageText;

    // 1. Copy to clipboard
    try {
      await navigator.clipboard.writeText(textToSend);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }

    // 2. Save report to phone internal folder (Documents/Gluck_Lernstudio/Parent_Reports) BEFORE sharing to WhatsApp
    const phoneToUse = activeContact.cleanForUrl || activeContact.contact;
    const reportDate = effectiveDateStr === 'all' ? activeStudentLesson.date : effectiveDateStr;
    await saveToPhoneSubfolderAndRegister({
      title: `تقرير ${recipientTarget === 'student' ? 'طالب' : 'ولي أمر'} (طابور واتساب): ${activeStudent.name}`,
      fileName: `Queue_Report_${activeStudent.name}_${reportDate || getLocalDateStr()}.txt`,
      category: 'parent_reports',
      actionType: 'whatsapp',
      format: 'txt',
      textContent: textToSend,
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      groupId: activeStudentLesson.groupId,
      groupName: activeStudentLesson.groupName || activeStudentLesson.title,
      recipientPhone: phoneToUse
    });

    // 3. Open WhatsApp wa.me link
    const url = buildWhatsAppUrl(phoneToUse, textToSend);
    window.open(url, '_blank');

    // 3. Mark as sent with local time
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newSent = { ...sentMap, [activeStudent.id]: timeStr };
    const newSkipped = new Set<string>(skippedSet);
    newSkipped.delete(activeStudent.id);

    setSentMap(newSent);
    setSkippedSet(newSkipped);
    syncToStorage(newSent, newSkipped);

    // 4. Two-way Cross-Modal Dispatch Record
    recordStudentReportDispatched(
      activeStudentLesson.id,
      activeStudent.id,
      effectiveDateStr === 'all' ? activeStudentLesson.date : effectiveDateStr,
      recipientTarget,
      'queue',
      timeStr
    );

    if (activeStudentLesson.id && updateLesson) {
      updateLesson(activeStudentLesson.id, {
        whatsAppDispatchedStudents: {
          ...(activeStudentLesson.whatsAppDispatchedStudents || {}),
          [activeStudent.id]: timeStr
        }
      });
    }

    // 5. Sound feedback
    try {
      playLernstudioSound('combo_ding');
    } catch {}

    // 6. Auto advance to next pending
    advanceToNextPending(currentIndex, newSent, newSkipped);
  };

  // SKIP HANDLER
  const handleSkipCurrent = () => {
    if (!activeStudent) return;
    const newSkipped = new Set<string>(skippedSet);
    newSkipped.add(activeStudent.id);
    const newSent = { ...sentMap };
    delete newSent[activeStudent.id];

    setSkippedSet(newSkipped);
    setSentMap(newSent);
    syncToStorage(newSent, newSkipped);

    advanceToNextPending(currentIndex, newSent, newSkipped);
  };

  // RESET QUEUE HANDLER
  const handleResetQueue = () => {
    if (window.confirm(_t('إعادة ضبط الطابور وبدء الإرسال من الصفر؟', 'Reset queue progress?', 'Zurücksetzen?'))) {
      clearQueueProgress(queueKey);
      setSentMap({});
      setSkippedSet(new Set<string>());
      setCurrentIndex(0);
      try {
        playLernstudioSound('whack');
      } catch {}
    }
  };

  // MARK ALL AS SENT
  const handleMarkAllSent = () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newSent: Record<string, string> = {};
    queueStudents.forEach(st => {
      newSent[st.id] = sentMap[st.id] || timeStr;
      const stLesson = studentLessonMap[st.id] || fallbackSyntheticLesson;
      recordStudentReportDispatched(
        stLesson.id,
        st.id,
        effectiveDateStr === 'all' ? stLesson.date : effectiveDateStr,
        recipientTarget,
        'queue',
        timeStr
      );
    });
    setSentMap(newSent);
    setSkippedSet(new Set<string>());
    syncToStorage(newSent, new Set<string>());
    try {
      playLernstudioSound('victory');
    } catch {}
  };

  // Keyboard shortcut listener (Ctrl+Enter = send)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSendAndAdvance();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeStudent, activeMessageText, editedPreviewText, isEditingActiveMessage, activeContact, currentIndex, sentMap, skippedSet]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 overflow-hidden animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-surface border border-surface-border w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[96vh] h-auto overflow-hidden animate-scale-up"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* COMPACT TOP HEADER (< 85px total height) */}
        <div className="bg-surface px-3 py-2 sm:px-5 sm:py-2.5 border-b border-surface-border shrink-0 space-y-1.5">
          {/* Top Title & Progress Counter */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-text-main truncate">
                  {_t('طابور الواتساب ⚡', 'WhatsApp Queue ⚡', 'WhatsApp-Warteschlange ⚡')}
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {sentCount}/{totalCount} ({percentComplete}%)
                </span>
                {alreadyDispatchedCount > 0 && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md hidden sm:inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>متزامن: {alreadyDispatchedCount} مرسل</span>
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg border border-surface-border transition-all cursor-pointer shrink-0"
              title={t('auto_cancel')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Slim Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${percentComplete}%` }}
            />
          </div>

          {/* STREAMLINED CONTROL STRIP: Date + Session + Template + Recipient (Single Row) */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap pt-0.5">
            {/* Left/Start: Day Selector Segment */}
            <div className="flex items-center gap-1 flex-wrap">
              <div className="inline-flex items-center p-0.5 bg-surface-hover rounded-lg border border-surface-border text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedDateMode('today')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    selectedDateMode === 'today'
                      ? 'bg-emerald-600 text-white font-black shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  ⭐ {_t('اليوم', 'Today', 'Heute')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateMode('yesterday')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    selectedDateMode === 'yesterday'
                      ? 'bg-emerald-600 text-white font-black shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  ⏮️ {_t('أمس', 'Yesterday', 'Gestern')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateMode('all')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    selectedDateMode === 'all'
                      ? 'bg-indigo-600 text-white font-black shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  👥 {_t('الكل', 'All', 'Alle')}
                </button>
                <input
                  type="date"
                  value={customDateStr}
                  onChange={(e) => {
                    setCustomDateStr(e.target.value);
                    setSelectedDateMode('custom');
                  }}
                  className={`px-1 py-0.5 text-[10px] font-mono rounded-md border-0 bg-transparent cursor-pointer ${
                    selectedDateMode === 'custom' ? 'bg-emerald-600 text-white font-black' : 'text-text-muted'
                  }`}
                  title={_t('تاريخ محدد', 'Custom Date', 'Anderes Datum')}
                />
              </div>

              {/* Sub-filter: Sessions on this day (if multiple) */}
              {effectiveDateStr !== 'all' && dayLessons.length > 1 && (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold text-text-main cursor-pointer"
                >
                  <option value="all">{_t(`كل حصص اليوم (${dayLessons.length})`, `All Today (${dayLessons.length})`, `Alle Stunden (${dayLessons.length})`)}</option>
                  {dayLessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.groupName || l.title} ({formatArabicTimeDisplay(l.time)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Right/End: Recipient Target & Template Selector */}
            <div className="flex items-center gap-1">
              {/* Recipient Segment */}
              <div className="inline-flex items-center p-0.5 bg-surface-hover rounded-lg border border-surface-border text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setRecipientTarget('parent')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-all ${
                    recipientTarget === 'parent'
                      ? 'bg-white dark:bg-slate-800 text-text-main font-black shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  👨‍👩‍👧 {_t('ولي الأمر', 'Parent', 'Eltern')}
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTarget('student')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-all ${
                    recipientTarget === 'student'
                      ? 'bg-white dark:bg-slate-800 text-text-main font-black shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  📱 {_t('الطالب', 'Student', 'Schüler')}
                </button>
              </div>

              {/* Template Selector Dropdown */}
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as QueueTemplateType)}
                className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold text-text-main cursor-pointer"
              >
                <option value="egyptian">🇪🇬 مصري مفصل</option>
                <option value="streamlined">⚡ منقح سريع</option>
                <option value="reminder">🔔 تذكير حصة</option>
                <option value="standard">📜 فصحى</option>
                <option value="custom">✍️ مخصص</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Body: Split-pane Layout */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          
          {/* LEFT / HERO DISPATCH CARD (Takes 7 cols on desktop) */}
          <div className="lg:col-span-7 flex flex-col space-y-2.5">
            {/* Empty State when no students found for this day */}
            {queueStudents.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-500/40 rounded-2xl p-5 text-center space-y-2 animate-fade-in">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-amber-900 dark:text-amber-200">
                  {_t(`لا توجد حصص مسجلة في هذا اليوم (${formatArabicDateDisplay(effectiveDateStr)})`, `No lessons on ${effectiveDateStr}`, `Keine Stunden am ${effectiveDateStr}`)}
                </h3>
                <div className="pt-1 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDateMode('all')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{_t(`عرض كل الطلاب (${students.length})`, `Show All Students (${students.length})`, `Alle Schüler (${students.length})`)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDateMode('today')}
                    className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text-main text-xs font-bold rounded-xl border border-surface-border transition-all cursor-pointer"
                  >
                    {_t('حصص اليوم', 'Today Lessons', 'Heutige Stunden')}
                  </button>
                </div>
              </div>
            )}

            {isAllDone && queueStudents.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2 animate-fade-in">
                <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                  {_t('اكتمل الطابور! تم إرسال رسائل جميع الطلاب 🎉', 'All Reports Sent! 🎉', 'Alle Berichte gesendet! 🎉')}
                </h3>
                <div className="pt-1 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetQueue}
                    className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text-main text-xs font-bold rounded-xl border border-surface-border transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{_t('إعادة ضبط', 'Reset', 'Neu starten')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    {_t('إغلاق', 'Close', 'Schließen')}
                  </button>
                </div>
              </div>
            )}

            {/* Active Student Hero Card */}
            {activeStudent && (
              <div className="bg-surface-hover/60 border border-surface-border rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-xs">
                {/* Active Student Top Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                      {currentIndex + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-black text-text-main truncate">
                          {activeStudent.name}
                        </span>
                        {sentMap[activeStudent.id] && (
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            ✅ أُرسل ({sentMap[activeStudent.id]})
                          </span>
                        )}
                        {skippedSet.has(activeStudent.id) && (
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            ⏭️ متخطي
                          </span>
                        )}
                      </div>
                      
                      <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {activeStudent.parentName && (
                          <span>👨‍👩‍👧 {activeStudent.parentName}</span>
                        )}
                        {activeStudent.grade && (
                          <span className="opacity-80">• {activeStudent.grade}</span>
                        )}
                        {activeStudentLesson.groupName && (
                          <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded text-[10px] font-bold">
                            {activeStudentLesson.groupName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Badge */}
                  <div className="text-left shrink-0">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface border border-surface-border rounded-lg text-xs font-bold text-text-main font-mono">
                      <Smartphone className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>{activeContact.hasContact ? formatContactDisplay(activeContact.contact) : _t('بدون رقم ⚠️', 'No Number ⚠️', 'Keine Nummer ⚠️')}</span>
                    </div>
                  </div>
                </div>

                {/* Already Sent Notice */}
                {sentMap[activeStudent.id] && (
                  <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between gap-1.5">
                    <span>
                      {_t(
                        `تقرير هذا الطالب تم إرساله مسبقاً (${sentMap[activeStudent.id]}).`,
                        `Already sent at (${sentMap[activeStudent.id]}).`,
                        `Bereits gesendet um (${sentMap[activeStudent.id]}).`
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleSkipCurrent}
                      className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-black shrink-0 cursor-pointer shadow-xs hover:bg-emerald-700"
                    >
                      {_t('التالي ⏭️', 'Next ⏭️', 'Weiter ⏭️')}
                    </button>
                  </div>
                )}

                {/* Live Message Preview / Editor Box */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                    <span className="flex items-center gap-1 text-[11px]">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      <span>{_t('نص رسالة الواتساب:', 'Message to Send:', 'Nachricht:')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditingActiveMessage) {
                          setEditedPreviewText(activeMessageText);
                        }
                        setIsEditingActiveMessage(!isEditingActiveMessage);
                      }}
                      className="text-primary hover:underline cursor-pointer inline-flex items-center gap-1 text-[11px]"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingActiveMessage ? _t('إلغاء التعديل', 'Cancel', 'Abbrechen') : _t('تعديل النص', 'Edit', 'Bearbeiten')}</span>
                    </button>
                  </div>

                  {isEditingActiveMessage ? (
                    <textarea
                      value={editedPreviewText}
                      onChange={(e) => setEditedPreviewText(e.target.value)}
                      rows={6}
                      className="w-full p-2.5 bg-surface border-2 border-primary/50 rounded-xl text-xs leading-relaxed text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 font-sans"
                    />
                  ) : (
                    <div className="p-2.5 bg-surface border border-surface-border rounded-xl text-xs leading-relaxed text-text-main whitespace-pre-wrap max-h-40 overflow-y-auto font-sans shadow-2xs select-text">
                      {activeMessageText}
                    </div>
                  )}
                </div>

                {/* Hero Action Buttons */}
                <div className="space-y-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={handleSendAndAdvance}
                    disabled={!activeContact.hasContact}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 ${
                      activeContact.hasContact
                        ? sentMap[activeStudent.id]
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4 shrink-0 stroke-[2.5]" />
                    <span>
                      {sentMap[activeStudent.id]
                        ? _t(
                            `🔄 إعادة إرسال لـ ${activeStudent.name} والتالي`,
                            `🔄 Re-send to ${activeStudent.name} & Next`,
                            `🔄 An ${activeStudent.name} erneut senden & Weiter`
                          )
                        : _t(
                            `🚀 إرسال لـ ${activeStudent.name} والانتقال للتالي`,
                            `🚀 Send to ${activeStudent.name} & Next`,
                            `🚀 An ${activeStudent.name} senden & Weiter`
                          )}
                    </span>
                    <span className="text-[10px] font-bold opacity-80 bg-white/20 px-1.5 py-0.2 rounded-full mr-2 hidden sm:inline-block">
                      Ctrl + Enter ↵
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSkipCurrent}
                      className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main rounded-xl text-xs font-bold border border-surface-border transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <FastForward className="w-3.5 h-3.5 text-amber-500" />
                      <span>{_t('تخطي ⏭️', 'Skip ⏭️', 'Überspringen ⏭️')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const txt = isEditingActiveMessage && editedPreviewText.trim() ? editedPreviewText.trim() : activeMessageText;
                        await navigator.clipboard.writeText(txt);
                        setCopiedNotice(true);
                        setTimeout(() => setCopiedNotice(false), 2000);
                      }}
                      className="py-1.5 px-3 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main rounded-xl text-xs font-bold border border-surface-border transition-all cursor-pointer flex items-center justify-center gap-1"
                      title={_t('نسخ الرسالة فقط للحافظة', 'Copy message only', 'Nur kopieren')}
                    >
                      {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
                      <span>{copiedNotice ? _t('تم النسخ ✓', 'Copied ✓', 'Kopiert ✓') : _t('نسخ النص', 'Copy Text', 'Kopieren')}</span>
                    </button>

                    {/* Mobile Toggle to open/close student list drawer */}
                    <button
                      type="button"
                      onClick={() => setShowStudentsListDrawer(!showStudentsListDrawer)}
                      className="lg:hidden py-1.5 px-2.5 bg-surface hover:bg-surface-hover text-primary rounded-xl text-xs font-bold border border-surface-border transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{showStudentsListDrawer ? 'إخفاء القائمة' : `الطلاب (${queueStudents.length})`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Template Editor Drawer */}
            {templateType === 'custom' && (
              <div className="bg-surface border border-surface-border rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-text-main">
                  <span>{_t('قالب الرسالة المخصص:', 'Custom Template:', 'Eigene Vorlage:')}</span>
                  <span className="text-[10px] text-text-muted">{_t('استخدم المتغيرات أدناه', 'Use variables', 'Variablen nutzen')}</span>
                </div>
                <textarea
                  value={customTemplateText}
                  onChange={(e) => setCustomTemplateText(e.target.value)}
                  rows={3}
                  className="w-full p-2 bg-surface-hover border border-surface-border rounded-lg text-xs leading-relaxed text-text-main font-mono"
                />
                <div className="flex items-center gap-1 flex-wrap text-[10px] text-primary">
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{اسم_الطالب}'}</code>
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{اسم_ولي_الأمر}'}</code>
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{اليوم}'}</code>
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{التاريخ}'}</code>
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{الوقت}'}</code>
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{الشرح}'}</code>
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{الواجب}'}</code>
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{اسم_المعلم}'}</code>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT / QUEUE LIST PANE (Visible on desktop or when toggled on mobile) */}
          <div className={`${showStudentsListDrawer ? 'block' : 'hidden lg:flex'} lg:col-span-5 flex flex-col space-y-2`}>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-black text-text-main flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>{_t('قائمة الطلاب', 'Student List', 'Schülerliste')} ({queueStudents.length})</span>
              </span>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-all ${
                    activeFilter === 'all'
                      ? 'bg-primary text-white'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  الكل ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('pending')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-all ${
                    activeFilter === 'pending'
                      ? 'bg-primary text-white'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  ⏳ ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('sent')}
                  className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-all ${
                    activeFilter === 'sent'
                      ? 'bg-primary text-white'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  ✅ ({sentCount})
                </button>
              </div>
            </div>

            {/* Scrollable Student List */}
            <div className="flex-1 overflow-y-auto space-y-1 max-h-[320px] sm:max-h-[420px] pr-1">
              {queueStudents.map((st, idx) => {
                const isCurrent = idx === currentIndex;
                const isSent = Boolean(sentMap[st.id]);
                const isSkipped = skippedSet.has(st.id);

                // Apply filter
                if (activeFilter === 'pending' && (isSent || isSkipped)) return null;
                if (activeFilter === 'sent' && !isSent) return null;
                if (activeFilter === 'skipped' && !isSkipped) return null;

                const contactInfo = resolveStudentWhatsAppContact(st);
                const stLesson = studentLessonMap[st.id] || fallbackSyntheticLesson;
                const attStatus = resolveStudentReportAttendance(
                  st.id,
                  stLesson,
                  stLesson.report?.studentAttendance || {},
                  stLesson.report || {},
                  true
                );

                return (
                  <div
                    key={st.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowStudentsListDrawer(false);
                    }}
                    className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                        : isSent
                          ? 'bg-surface border-surface-border opacity-70 hover:opacity-100 hover:bg-slate-50'
                          : isSkipped
                            ? 'bg-surface border-amber-300/60 opacity-80'
                            : 'bg-surface border-surface-border hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white'
                          : isSent
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                            : isSkipped
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {isSent ? '✓' : isSkipped ? '⏭️' : idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-black text-text-main truncate flex items-center gap-1">
                          <span>{st.name}</span>
                          {stLesson.groupName && (
                            <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                              {stLesson.groupName}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-muted truncate flex items-center gap-1 mt-0.5">
                          <span>{contactInfo.hasContact ? formatContactDisplay(contactInfo.contact) : _t('بدون رقم', 'No number', 'Keine Nr.')}</span>
                          <span className={`px-1 rounded font-bold ${
                            attStatus === 'present' ? 'text-emerald-600 bg-emerald-50' : attStatus === 'late' ? 'text-amber-600 bg-amber-50' : attStatus === 'absent' ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'
                          }`}>
                            {attStatus === 'present' ? 'حاضر' : attStatus === 'late' ? 'متأخر' : attStatus === 'absent' ? 'غائب' : 'غير مسجل'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSent ? (
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded">
                          <Check className="w-2.5 h-2.5" />
                          <span>{sentMap[st.id]}</span>
                        </span>
                      ) : isSkipped ? (
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded">
                          ⏭️
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">
                          ⏳
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions inside list pane */}
            <div className="pt-1.5 border-t border-surface-border flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleMarkAllSent}
                className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
                title={_t('وسم جميع الطلاب كمرسل', 'Mark all sent', 'Alle als gesendet')}
              >
                <CheckSquare className="w-3 h-3" />
                <span>{_t('وسم الكل كمرسل ✅', 'Mark All Sent', 'Alle als gesendet')}</span>
              </button>

              <button
                type="button"
                onClick={handleResetQueue}
                className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer flex items-center gap-1"
                title={_t('مسح السجل والبدء من الصفر', 'Reset queue', 'Zurücksetzen')}
              >
                <RefreshCw className="w-3 h-3" />
                <span>{_t('إعادة ضبط', 'Reset', 'Zurücksetzen')}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
