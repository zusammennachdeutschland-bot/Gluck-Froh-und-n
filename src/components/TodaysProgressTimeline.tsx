import { isPendingStatus, isGroupPerLesson, calculateSequentialSessionNumber, resolveLessonCycleNumber, pickAuthoritativeLesson, normalizeTime } from "../utils/lessonUtils";
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson, Group, Student, LessonReport, AttendanceStatus, PaymentStatus } from '../types';
import { formatLocalDate, parseLocalDate } from '../utils/timeUtils';
import { getGroupScheduleSlots, getDayNumber, isStudentMatchingLessonWeek, isDateMatchingGroupRecurrence } from '../utils/scheduleUtils';
import { storage } from '../services/storageService';
import { 
  CheckCircle2, Clock, PlayCircle, ChevronRight, ChevronDown, ChevronUp, AlertCircle, XCircle, X, Video, MapPin, Users, Check, MessageCircle, Phone
} from 'lucide-react';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact, cleanPhoneNumberForTel } from '../utils/phoneUtils';
import { motion, AnimatePresence } from 'motion/react';
import { GroupProfileModal } from './GroupProfileModal';
import { SelectParentCallModal } from './SelectParentCallModal';

const getLessonEndTime = (timeStr: string, durationMinutes: number = 60): string => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const total = h * 60 + m + (durationMinutes || 60);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

export const TodaysProgressTimeline: React.FC = () => {
  const { lessons, groups, students, openLessonControl, saveLessonReport, cancelLesson, dismissedDashboardLessonIds, dismissLessonFromDashboard, t, _t, language } = useApp();
  const [now, setNow] = useState(new Date());
  const [isPastPendingExpanded, setIsPastPendingExpanded] = useState(false);
  const [showAllPastPending, setShowAllPastPending] = useState(false);
  const [selectedGroupForModal, setSelectedGroupForModal] = useState<Group | null>(null);
  const [expandedLessonIds, setExpandedLessonIds] = useState<string[]>([]);
  const [collapsedLessonIds, setCollapsedLessonIds] = useState<string[]>([]);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number; id: string } | null>(null);
  const [selectParentModalData, setSelectParentModalData] = useState<{
    isOpen: boolean;
    title: string;
    students: Student[];
  }>({
    isOpen: false,
    title: '',
    students: [],
  });

  const isLessonExpanded = (lessonId: string, isLiveActive: boolean) => {
    if (collapsedLessonIds.includes(lessonId)) return false;
    if (expandedLessonIds.includes(lessonId)) return true;
    return isLiveActive;
  };

  const handleCardTouchStart = (e: React.TouchEvent, lessonId: string) => {
    if (e.touches.length === 1) {
      setTouchStartPos({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        id: lessonId
      });
    }
  };

  const handleCardTouchEnd = (e: React.TouchEvent, lessonId: string) => {
    if (!touchStartPos || touchStartPos.id !== lessonId || e.changedTouches.length === 0) {
      setTouchStartPos(null);
      return;
    }

    const deltaX = e.changedTouches[0].clientX - touchStartPos.x;
    const deltaY = e.changedTouches[0].clientY - touchStartPos.y;

    // Detect horizontal swipe gesture (horizontal delta > 35px & vertical delta < 45px)
    if (Math.abs(deltaX) > 35 && Math.abs(deltaY) < 45) {
      if (deltaX > 35) {
        // Swipe Right -> Expand Card!
        setCollapsedLessonIds(prev => prev.filter(id => id !== lessonId));
        setExpandedLessonIds(prev => prev.includes(lessonId) ? prev : [...prev, lessonId]);
      } else if (deltaX < -35) {
        // Swipe Left -> Collapse Card!
        setExpandedLessonIds(prev => prev.filter(id => id !== lessonId));
        setCollapsedLessonIds(prev => prev.includes(lessonId) ? prev : [...prev, lessonId]);
      }
    }

    setTouchStartPos(null);
  };

  const handleQuickCompleteLesson = (e: React.MouseEvent, targetLesson: Lesson) => {
    e.stopPropagation();

    const targetGroup = targetLesson.groupId
      ? (groups.find(g => g.id === targetLesson.groupId) || groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupId.trim().toLowerCase()))
      : (targetLesson.groupName ? groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupName!.trim().toLowerCase()) : undefined);

    const targetStudent = students.find(s =>
      !s.deleted && s.status !== 'archived' && (
        (targetLesson.studentId && s.id === targetLesson.studentId) ||
        (targetLesson.studentName && s.name.trim().toLowerCase() === targetLesson.studentName.trim().toLowerCase())
      )
    );

    const groupSts = targetGroup
      ? students.filter(s => !s.deleted && s.status !== 'archived' && s.groupId === targetGroup.id)
      : [];
    const matchingWeekGroupSts = groupSts.filter(s => !targetLesson.date || isStudentMatchingLessonWeek(s.scheduleRecurrence, targetLesson.date));
    const activeLessonStudents = targetGroup
      ? (matchingWeekGroupSts.length > 0 ? matchingWeekGroupSts : groupSts)
      : (targetStudent ? [targetStudent] : []);

    const studentAttendanceMap: Record<string, AttendanceStatus> = { ...(targetLesson.report?.studentAttendance || {}) };
    const studentHomeworkDoneMap: Record<string, 'yes' | 'no' | 'none'> = { ...(targetLesson.report?.studentHomeworkDone || {}) };
    const studentDictationGradeMap: Record<string, number> = { ...(targetLesson.report?.studentDictationGrade || {}) };
    const studentExamGradeMap: Record<string, number> = { ...(targetLesson.report?.studentExamGrade || {}) };
    const studentNotesMap: Record<string, string> = { ...(targetLesson.report?.studentNotes || {}) };
    const studentPaymentsMap: Record<string, { status: PaymentStatus; amount: number }> = {};

    activeLessonStudents.forEach(st => {
      if (!studentAttendanceMap[st.id]) {
        studentAttendanceMap[st.id] = 'present';
      }
      studentHomeworkDoneMap[st.id] = 'none';
      if (studentDictationGradeMap[st.id] === undefined) {
        studentDictationGradeMap[st.id] = -1;
      }
      if (studentExamGradeMap[st.id] === undefined) {
        studentExamGradeMap[st.id] = -1;
      }
      if (studentNotesMap[st.id] === undefined) {
        studentNotesMap[st.id] = '';
      }
      const existingPay = (targetLesson.studentPayments as any)?.[st.id] || (targetLesson.report?.studentPayments as any)?.[st.id];
      studentPaymentsMap[st.id] = {
        status: existingPay?.paymentStatus || existingPay?.status || 'pending',
        amount: existingPay?.amountPaid ?? existingPay?.amount ?? 0
      };
    });

    const isPerLessonGroup = Boolean(
      isGroupPerLesson(targetGroup) ||
      (targetStudent && (targetStudent.paymentPlan === 'per_lesson' || targetStudent.bundleSize === 1)) ||
      targetLesson.totalSessionsInPackage === 1
    );
    const cycleTotalSessions = isPerLessonGroup
      ? 1
      : ((targetGroup?.sessionCount && targetGroup.sessionCount > 1)
          ? targetGroup.sessionCount
          : (targetLesson.totalSessionsInPackage && targetLesson.totalSessionsInPackage > 1 ? targetLesson.totalSessionsInPackage : 4));

    const cycleRes = resolveLessonCycleNumber(targetLesson, lessons, {
      group: targetGroup,
      student: targetStudent,
      students
    });
    const finalSessionNumber = isPerLessonGroup
      ? 1
      : (cycleRes.sessionNumber >= 1 ? cycleRes.sessionNumber : 1);

    const noHwLabel = language === 'de' ? 'Keine Hausaufgabe' : language === 'en' ? 'None assigned' : 'لا يوجد واجب';
    const reportData: LessonReport = {
      ...(targetLesson.report || {}),
      attendanceStatus: 'present',
      studentAttendance: studentAttendanceMap,
      homeworkStatus: 'none' as any,
      arabicHomeworkOption: 'none',
      homeworkTitle: noHwLabel,
      homeworkDescription: noHwLabel,
      arabicHomeworkRequired: 'لا يوجد واجب',
      arabicPreviousHomework: 'لا يوجد واجب سابق',
      previousHomeworkDescription: 'لا يوجد واجب سابق',
      teacherNotes: 'wiederholen',
      arabicTopicsExplained: 'wiederholen',
      studentHomeworkDone: studentHomeworkDoneMap,
      studentDictationGrade: studentDictationGradeMap,
      studentExamGrade: studentExamGradeMap,
      studentNotes: studentNotesMap,
      paymentStatus: targetLesson.paymentStatus || 'pending',
      amountPaid: targetLesson.amountPaid || 0,
      ...(activeLessonStudents.length > 1 ? { studentPayments: studentPaymentsMap } : {}),
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    saveLessonReport(targetLesson.id, reportData, cycleTotalSessions, finalSessionNumber);
    storage.removeItem(`dl_draft_report_${targetLesson.id}`);
  };

  const handleQuickCancelLesson = (e: React.MouseEvent, targetLesson: Lesson) => {
    e.stopPropagation();
    cancelLesson(targetLesson.id);
    storage.removeItem(`dl_draft_report_${targetLesson.id}`);
  };

  const getIsMultiStudent = (targetLesson: Lesson) => {
    const tg = targetLesson.groupId
      ? (groups.find(g => g.id === targetLesson.groupId) || groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupId.trim().toLowerCase()))
      : (targetLesson.groupName ? groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupName!.trim().toLowerCase()) : undefined);

    const groupSts = tg
      ? students.filter(s => !s.deleted && s.status !== 'archived' && s.groupId === tg.id)
      : [];

    const targetStudent = students.find(s =>
      !s.deleted && s.status !== 'archived' && (
        (targetLesson.studentId && s.id === targetLesson.studentId) ||
        (targetLesson.studentName && s.name.trim().toLowerCase() === targetLesson.studentName.trim().toLowerCase())
      )
    );

    return (tg ? groupSts.length : (targetStudent ? 1 : 1)) > 1;
  };

  const handleOpenCall = (e: React.MouseEvent, targetLesson: Lesson) => {
    e.stopPropagation();
    const targetGroup = targetLesson.groupId
      ? (groups.find(g => g.id === targetLesson.groupId) || groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupId.trim().toLowerCase()))
      : (targetLesson.groupName ? groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupName!.trim().toLowerCase()) : undefined);

    const groupSts = targetGroup
      ? students.filter(s => !s.deleted && s.status !== 'archived' && s.groupId === targetGroup.id)
      : [];

    const targetStudent = students.find(s =>
      !s.deleted && s.status !== 'archived' && (
        (targetLesson.studentId && s.id === targetLesson.studentId) ||
        (targetLesson.studentName && s.name.trim().toLowerCase() === targetLesson.studentName.trim().toLowerCase())
      )
    );

    const effectiveStudents = groupSts.length > 0 ? groupSts : (targetStudent ? [targetStudent] : []);

    if (effectiveStudents.length > 1) {
      setSelectParentModalData({
        isOpen: true,
        title: targetGroup?.name || targetLesson.title || _t('اختيار ولي الأمر للاتصال', 'Select Parent to Call', 'Elternteil anrufen'),
        students: effectiveStudents,
      });
    } else if (effectiveStudents.length === 1) {
      const st = effectiveStudents[0];
      const phone = st.parentPhone || st.phone;
      if (phone) {
        const clean = cleanPhoneNumberForTel(phone);
        if (clean) {
          window.open(`tel:${clean}`, '_self');
          return;
        }
      }
      setSelectParentModalData({
        isOpen: true,
        title: st.name,
        students: effectiveStudents,
      });
    }
  };

  const handleOpenWhatsApp = (e: React.MouseEvent, targetLesson: Lesson) => {
    e.stopPropagation();
    const targetGroup = targetLesson.groupId
      ? (groups.find(g => g.id === targetLesson.groupId) || groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupId.trim().toLowerCase()))
      : (targetLesson.groupName ? groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupName!.trim().toLowerCase()) : undefined);

    const groupSts = targetGroup
      ? students.filter(s => !s.deleted && s.status !== 'archived' && s.groupId === targetGroup.id)
      : [];

    const targetStudent = students.find(s =>
      !s.deleted && s.status !== 'archived' && (
        (targetLesson.studentId && s.id === targetLesson.studentId) ||
        (targetLesson.studentName && s.name.trim().toLowerCase() === targetLesson.studentName.trim().toLowerCase())
      )
    );

    const effectiveStudents = groupSts.length > 0 ? groupSts : (targetStudent ? [targetStudent] : []);

    if (effectiveStudents.length > 1) {
      if (targetGroup?.whatsAppGroupLink?.trim()) {
        window.open(targetGroup.whatsAppGroupLink.trim(), '_blank');
      } else {
        setSelectParentModalData({
          isOpen: true,
          title: targetGroup?.name || targetLesson.title || _t('اختيار ولي الأمر', 'Select Parent', 'Elternteil auswählen'),
          students: effectiveStudents,
        });
      }
    } else if (effectiveStudents.length === 1) {
      const st = effectiveStudents[0];
      const contact = resolveStudentWhatsAppContact(st);
      const rawPhone = contact.cleanForUrl || st.parentPhone || st.studentPhone;
      if (rawPhone) {
        window.open(buildWhatsAppUrl(rawPhone), '_blank');
      } else {
        window.open('https://wa.me/', '_blank');
      }
    } else {
      window.open('https://wa.me/', '_blank');
    }
  };

  const handleOpenMaps = (e: React.MouseEvent, targetLesson: Lesson) => {
    e.stopPropagation();
    const targetGroup = targetLesson.groupId
      ? (groups.find(g => g.id === targetLesson.groupId) || groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupId.trim().toLowerCase()))
      : (targetLesson.groupName ? groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupName!.trim().toLowerCase()) : undefined);

    if (targetGroup?.coordinates?.lat && targetGroup?.coordinates?.lng) {
      window.open(`https://www.google.com/maps?q=${targetGroup.coordinates.lat},${targetGroup.coordinates.lng}`, '_blank');
      return;
    }

    const rawAddress = (targetGroup?.address || targetLesson.location || '').trim();
    if (rawAddress && rawAddress !== 'center' && rawAddress !== 'home') {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}`, '_blank');
      return;
    }

    const nameToSearch = targetGroup?.name || targetLesson.studentName || targetLesson.title || '';
    const searchString = `${nameToSearch} ${rawAddress || ''}`.trim();
    if (searchString) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchString)}`, '_blank');
    } else {
      window.open('https://www.google.com/maps', '_blank');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = formatLocalDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. PAST PENDING LESSONS: Lessons from previous days with NO final status (neither completed nor cancelled), excluding deleted
  const pendingPastLessons = useMemo(() => {
    const resolvedSlotKeys = new Set<string>();
    lessons.forEach(l => {
      if (!l.deleted && !isPendingStatus(l.status) && l.groupId && l.groupId !== 'quick_group' && l.date && l.time) {
        resolvedSlotKeys.add(`${l.groupId}_${l.date}_${normalizeTime(l.time) || l.time}`);
      }
    });
    return lessons
      .filter(l => {
        if (l.deleted || l.date >= todayStr || !isPendingStatus(l.status) || dismissedDashboardLessonIds.includes(l.id)) {
          return false;
        }
        if (l.groupId && l.groupId !== 'quick_group' && l.date && l.time) {
          const slotKey = `${l.groupId}_${l.date}_${normalizeTime(l.time) || l.time}`;
          if (resolvedSlotKeys.has(slotKey)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
  }, [lessons, todayStr, dismissedDashboardLessonIds]);

  // 2. TODAY'S LESSONS: Lessons scheduled for today, excluding deleted items & stale slots from changed group schedules
  const todaysLessons = useMemo(() => {
    const active = lessons
      .filter(l => !l.deleted && l.date === todayStr && !dismissedDashboardLessonIds.includes(l.id))
      .filter(l => {
        // If it's a scheduled uncompleted lesson for a group, ensure it matches current schedule slots
        if (
          l.groupId && 
          l.groupId !== 'quick_group' && 
          l.status === 'scheduled' && 
          (!l.report || (!l.report.attendanceStatus && !l.report.teacherNotes && !l.report.homeworkTitle && l.report.quizScore === undefined)) &&
          (!l.studentPayments || Object.keys(l.studentPayments).length === 0) &&
          (!l.amountPaid || l.amountPaid === 0)
        ) {
          const grp = groups.find(g => g.id === l.groupId && !g.deleted);
          if (grp) {
            // Filter out lessons if date doesn't match group alternating week recurrence
            if (grp.scheduleRecurrence && grp.scheduleRecurrence !== 'weekly') {
              if (!isDateMatchingGroupRecurrence(grp.scheduleRecurrence, l.date)) {
                return false;
              }
            }
            const activeSlots = getGroupScheduleSlots(grp);
            if (activeSlots.length > 0) {
              const lDate = parseLocalDate(l.date);
              const lDayNum = lDate.getDay();
              const matchesSlot = activeSlots.some(s => getDayNumber(s.day) === lDayNum && s.time === l.time);
              if (!matchesSlot) return false;
            }
          }
        }
        return true;
      });

    // Deduplicate: If multiple entries exist for the same group slot on this date, always keep the authoritative one (completed/cancelled/in_progress > scheduled)
    const slotMap = new Map<string, Lesson>();
    active.forEach(l => {
      const key = l.groupId && l.groupId !== 'quick_group'
        ? `${l.groupId}_${l.date}_${normalizeTime(l.time) || l.time}`
        : l.id;
      const existing = slotMap.get(key);
      if (!existing) {
        slotMap.set(key, l);
      } else {
        slotMap.set(key, pickAuthoritativeLesson(existing, l).survivor);
      }
    });

    return Array.from(slotMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [lessons, groups, todayStr, dismissedDashboardLessonIds]);

  const getLessonState = (lesson: Lesson): 'completed' | 'cancelled' | 'active' | 'upcoming' => {
    if (lesson.status === 'completed') return 'completed';
    if (lesson.status === 'cancelled') return 'cancelled';
    if (lesson.status === 'in_progress') return 'active';
    
    const [h, m] = lesson.time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) {
      return 'upcoming';
    }

    const startMin = h * 60 + m;
    const duration = lesson.durationMinutes || 60;
    const endMin = startMin + duration;

    if (currentMinutes >= startMin && currentMinutes < endMin) return 'active';
    return 'upcoming';
  };

  const processedLessons = todaysLessons.map(lesson => ({
    lesson,
    state: getLessonState(lesson),
  }));

  const completedCount = processedLessons.filter(p => p.lesson.status === 'completed').length;
  const cancelledCount = processedLessons.filter(p => p.lesson.status === 'cancelled').length;
  const activeCount = processedLessons.filter(p => p.state === 'active').length;
  const upcomingCount = processedLessons.filter(p => isPendingStatus(p.lesson.status) && p.state !== 'active').length;
  const totalCount = processedLessons.length;

  // Closed lessons include completed and cancelled lessons (all scheduled items resolved for today)
  const closedCount = completedCount + cancelledCount;
  const progressPercent = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;
  const filledUnits = completedCount + activeCount + cancelledCount;
  const filledPercent = totalCount > 0 ? Math.min(100, Math.round((filledUnits / totalCount) * 100)) : 0;

  // Helper to generate a seamless, fluid gradient transition without sharp borders (انسيابي بدون حد)
  // Palette according to user request:
  // - Completed (انشرح): الأخضر (Emerald)
  // - Active / In-progress (جاري): الأزرق (Royal Blue)
  // - Cancelled (يتكنسل): الأحمر (Rose Red)
  const getSmoothProgressBarGradient = (
    cCount: number,
    aCount: number,
    xCount: number
  ): string => {
    const total = cCount + aCount + xCount;
    if (total === 0) return 'transparent';

    const cRatio = (cCount / total) * 100;
    const aRatio = (aCount / total) * 100;
    const xRatio = (xCount / total) * 100;

    const green = '#10B981';
    const greenDark = '#059669';
    const blue = 'var(--primary, #ec4899)';
    const blueDark = 'var(--primary-hover, #db2777)';
    const red = '#F43F5E';
    const redDark = '#E11D48';

    const segments: { color: string; colorDark: string; pct: number }[] = [];
    if (cRatio > 0) segments.push({ color: green, colorDark: greenDark, pct: cRatio });
    if (aRatio > 0) segments.push({ color: blue, colorDark: blueDark, pct: aRatio });
    if (xRatio > 0) segments.push({ color: red, colorDark: redDark, pct: xRatio });

    if (segments.length === 1) {
      return `linear-gradient(90deg, ${segments[0].color} 0%, ${segments[0].colorDark} 100%)`;
    }

    // Build smooth gradient stops with soft, organic blending zones (انسيابي)
    // to eliminate any sharp cutoff line ("حد") between different states
    const stops: string[] = [];
    let currentPos = 0;
    const blendRadius = segments.length === 2 ? 6.5 : 4.5;

    segments.forEach((seg, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === segments.length - 1;
      const nextPos = currentPos + seg.pct;

      if (isFirst) {
        stops.push(`${seg.color} 0%`);
        const solidEnd = Math.max(0, nextPos - blendRadius);
        stops.push(`${seg.color} ${solidEnd.toFixed(1)}%`);
      } else if (isLast) {
        const solidStart = Math.min(100, currentPos + blendRadius);
        stops.push(`${seg.color} ${solidStart.toFixed(1)}%`);
        stops.push(`${seg.colorDark} 100%`);
      } else {
        const solidStart = Math.min(100, currentPos + blendRadius);
        const solidEnd = Math.max(solidStart, nextPos - blendRadius);
        stops.push(`${seg.color} ${solidStart.toFixed(1)}%`);
        stops.push(`${seg.color} ${solidEnd.toFixed(1)}%`);
      }

      currentPos = nextPos;
    });

    return `linear-gradient(90deg, ${stops.join(', ')})`;
  };

  return (
    <div className="space-y-1.5">
      {/* SECTION 2: PAST PENDING LESSONS (Collapsible by default) */}
      {pendingPastLessons.length > 0 && (
        <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-xl shadow-2xs overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsPastPendingExpanded(prev => !prev)}
            aria-expanded={isPastPendingExpanded}
            className="w-full p-2 sm:p-2.5 flex items-center justify-between gap-1.5 text-left cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-black uppercase text-primary dark:text-primary tracking-wider flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0" />
                <span className="truncate">{t('past_pending_lessons_title')} ({pendingPastLessons.length})</span>
              </span>
              <span className="text-[9px] font-extrabold text-primary dark:text-primary bg-primary/15 dark:bg-primary/20 px-1.5 py-0.5 rounded-md shrink-0">
                {t('timeline_requires_action')}
              </span>
            </div>

            <div className="flex items-center gap-1 text-primary shrink-0">
              {isPastPendingExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {isPastPendingExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-2 sm:px-2.5 pb-2 pt-0.5 border-t border-primary-border/60 dark:border-primary-border/60">
                  <div className="max-h-60 overflow-y-auto divide-y divide-primary-border/60 dark:divide-primary-border/60 pr-1">
                    {(showAllPastPending ? pendingPastLessons : pendingPastLessons.slice(0, 3)).map((pLesson) => {
                      const pGroup = pLesson.groupId ? groups.find(g => g.id === pLesson.groupId) : undefined;
                      const isPExpanded = isLessonExpanded(pLesson.id, false);

                      if (isPExpanded) {
                        return (
                          <div
                            key={pLesson.id}
                            onClick={() => openLessonControl(pLesson)}
                            onTouchStart={(e) => handleCardTouchStart(e, pLesson.id)}
                            onTouchEnd={(e) => handleCardTouchEnd(e, pLesson.id)}
                            className="p-2 sm:p-2.5 my-1.5 rounded-xl border border-primary-border/80 bg-surface shadow-2xs cursor-pointer space-y-1.5 transition-all hover:border-primary"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9.5px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
                                  {pLesson.date}
                                </span>
                                {pGroup && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-primary-soft text-primary border border-primary-border/40">
                                    {_t('مجموعة', 'Group', 'Gruppe')}
                                  </span>
                                )}
                              </div>

                              <div className="text-xs font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                                <span>{pLesson.time}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs sm:text-sm font-black text-text-main truncate leading-snug">
                                {pGroup ? pGroup.name : (pLesson.studentName || pLesson.groupName || pLesson.title)}
                              </h4>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickCompleteLesson(e, pLesson)}
                                  className="w-7 h-7 rounded-lg bg-primary text-white hover:bg-primary-hover flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title={_t('تمت الحصة (wiederholen + بدون واجب)', 'Mark Completed (wiederholen + no HW)', 'Erledigt (wiederholen + keine HA)')}
                                  aria-label="Mark completed with wiederholen and no homework"
                                >
                                  <Check className="w-4 h-4 stroke-[2.75]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickCancelLesson(e, pLesson)}
                                  className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title={_t('إلغاء الحصة', 'Cancel Lesson', 'Lektion absagen')}
                                  aria-label="Cancel lesson"
                                >
                                  <X className="w-4 h-4 stroke-[2.75]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedLessonIds(prev => prev.filter(id => id !== pLesson.id));
                                    setCollapsedLessonIds(prev => prev.includes(pLesson.id) ? prev : [...prev, pLesson.id]);
                                  }}
                                  className="p-1 rounded bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border transition-colors cursor-pointer"
                                  title={_t('طي الكارت', 'Collapse Card', 'Einklappen')}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={pLesson.id}
                          onClick={() => openLessonControl(pLesson)}
                          onTouchStart={(e) => handleCardTouchStart(e, pLesson.id)}
                          onTouchEnd={(e) => handleCardTouchEnd(e, pLesson.id)}
                          className="py-1 flex items-center justify-between gap-1.5 cursor-pointer group transition-colors first:pt-0.5 last:pb-0 hover:bg-primary/5 rounded px-1"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.2 rounded">
                                {pLesson.date}
                              </span>
                              <span className="text-[11px] font-mono font-bold text-primary">
                                {pLesson.time}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-text-main group-hover:text-primary dark:group-hover:text-primary truncate leading-snug">
                              {pGroup ? pGroup.name : (pLesson.studentName || pLesson.groupName || pLesson.title)}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleQuickCompleteLesson(e, pLesson)}
                              className="w-7 h-7 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-white border border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                              title={_t('تمت الحصة (wiederholen + بدون واجب)', 'Mark Completed (wiederholen + no HW)', 'Erledigt (wiederholen + keine HA)')}
                              aria-label="Mark completed with wiederholen and no homework"
                            >
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleQuickCancelLesson(e, pLesson)}
                              className="w-7 h-7 rounded-lg bg-surface/80 hover:bg-primary/15 text-text-muted hover:text-primary border border-primary-border/60 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                              title={_t('إلغاء الحصة', 'Cancel Lesson', 'Lektion absagen')}
                              aria-label="Cancel lesson"
                            >
                              <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pendingPastLessons.length > 3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllPastPending(prev => !prev);
                      }}
                      className="w-full mt-1.5 pt-1.5 border-t border-primary-border/40 dark:border-primary-border/40 text-[10.5px] font-extrabold text-primary dark:text-primary flex items-center justify-center gap-1 hover:underline cursor-pointer transition-colors"
                    >
                      {showAllPastPending ? (
                        <>
                          <span>{_t('إظهار أول 3 حصص فقط', 'Show first 3 lessons only', 'Nur erste 3 Lektionen anzeigen')}</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>
                            {_t(
                              `عرض باقي الحصص (${pendingPastLessons.length - 3} إضافية)`,
                              `Show remaining ${pendingPastLessons.length - 3} lessons`,
                              `Weitere ${pendingPastLessons.length - 3} Lektionen anzeigen`
                            )}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SECTION 1: TODAY'S LESSONS */}
      {totalCount === 0 ? (
        <div className="bg-surface border border-surface-border rounded-xl p-2 sm:p-2.5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-text-main flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{t('todays_lessons_title')}</span>
            </span>
            <span className="text-[10px] font-mono text-text-muted/70">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-text-muted text-center py-1 italic">
            {t('timeline_no_lessons')}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-surface-border rounded-xl p-1.5 sm:p-2 shadow-2xs space-y-1.5">
          {/* Timeline Header */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 whitespace-nowrap px-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 whitespace-nowrap">
                {t('todays_lessons_title')}
              </h3>
              <span 
                className={`text-[11px] font-bold font-mono transition-colors whitespace-nowrap ${
                  progressPercent === 100
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-text-muted'
                }`}
                title={
                  cancelledCount > 0
                    ? `${completedCount} ${t('status_completed')} + ${cancelledCount} ${t('status_cancelled')}`
                    : undefined
                }
              >
                {closedCount}/{totalCount} ({progressPercent}%)
              </span>
            </div>

            {progressPercent === 100 && totalCount > 0 && (
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0 whitespace-nowrap animate-in fade-in duration-300">
                <span className="font-bold">✓</span>
                <span>{_t('اكتمل اليوم', 'Day Completed', 'Tag abgeschlossen')}</span>
              </span>
            )}
          </div>

          {/* Progress Bar Visualizer */}
          <div className="space-y-0.5">
            <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden flex relative">
              {filledUnits > 0 && (
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out shadow-xs relative overflow-hidden" 
                  style={{ 
                    width: `${filledPercent}%`,
                    background: getSmoothProgressBarGradient(completedCount, activeCount, cancelledCount)
                  }}
                  title={`${completedCount} ${t('status_completed')}, ${activeCount} ${t('status_in_progress')}, ${cancelledCount} ${t('status_cancelled')}`}
                />
              )}
            </div>

            {/* Status Count Summary Inline (Compact size) */}
            <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] font-bold px-0.5 pt-0.5">
              {/* Completed (Green) */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  completedCount > 0
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{completedCount} {t('status_completed')}</span>
              </div>

              {/* In Progress */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  activeCount > 0
                    ? 'text-primary dark:text-primary-hover font-bold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <PlayCircle className="w-3 h-3 shrink-0" />
                <span>{activeCount} {t('status_in_progress')}</span>
              </div>

              {/* Upcoming (Neutral) */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  upcomingCount > 0
                    ? 'text-slate-600 dark:text-slate-400 font-semibold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span>{upcomingCount} {t('timeline_upcoming')}</span>
              </div>

              {/* Cancelled (Red) */}
              <div 
                className={`flex items-center gap-1 transition-colors ${
                  cancelledCount > 0
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-text-muted/60 font-medium'
                }`}
              >
                <XCircle className="w-3 h-3 shrink-0" />
                <span>{cancelledCount} {t('status_cancelled')}</span>
              </div>
            </div>
          </div>

          {/* Lessons List (Material 3 Compact Agenda Cards) */}
          <div className="space-y-1">
            {processedLessons.map(({ lesson, state }) => {
              const targetGroup = lesson.groupId 
                ? (groups.find(g => g.id === lesson.groupId) || groups.find(g => g.name && g.name.trim().toLowerCase() === lesson.groupId!.trim().toLowerCase()))
                : (lesson.groupName ? groups.find(g => g.name && g.name.trim().toLowerCase() === lesson.groupName!.trim().toLowerCase()) : null);
              const groupStudents = targetGroup && students ? students.filter(s => !s.deleted && s.status !== 'archived' && s.groupId === targetGroup.id) : [];
              const scheduledStudents = groupStudents.filter(s => !lesson.date || isStudentMatchingLessonWeek(s.scheduleRecurrence, lesson.date));
              const isCompletedState = lesson.status === 'completed';
              const isCancelledState = lesson.status === 'cancelled';
              const endTime = getLessonEndTime(lesson.time, lesson.durationMinutes || 60);
              const isRtl = language === 'ar';

              // Build clean, unboxed metadata items separated by typographic middots (Zero-pill discipline)
              const metaParts: string[] = [];
              if (lesson.grade) metaParts.push(lesson.grade);
              if (lesson.type === 'online') {
                metaParts.push(t('next_action_online'));
              } else {
                metaParts.push(lesson.location && lesson.location !== 'center' && lesson.location !== 'home' ? lesson.location : t('next_action_offline'));
              }
              if (targetGroup && (scheduledStudents.length > 0 || groupStudents.length > 0)) {
                const countToShow = scheduledStudents.length > 0 ? scheduledStudents.length : groupStudents.length;
                metaParts.push(`${countToShow} ${_t('طلاب', 'students', 'Schüler')}`);
              }

              const isLiveActive = state === 'active' && !isCompletedState && !isCancelledState;
              const isExpanded = isLessonExpanded(lesson.id, isLiveActive);

              if (isExpanded) {
                const cardStyle = isLiveActive
                  ? 'border-2 border-primary/50 bg-gradient-to-br from-primary/[0.06] via-surface to-primary/[0.02] dark:from-primary/15 dark:to-surface shadow-md shadow-primary/10 ring-1 ring-primary/30'
                  : isCompletedState
                  ? 'border-2 border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.04] via-surface to-emerald-500/[0.01] dark:from-emerald-950/20 dark:to-surface shadow-xs'
                  : isCancelledState
                  ? 'border-2 border-rose-500/35 bg-gradient-to-br from-rose-500/[0.04] via-surface to-rose-500/[0.01] dark:from-rose-950/20 dark:to-surface opacity-90 shadow-xs'
                  : 'border-2 border-primary-border bg-surface hover:border-primary/50 shadow-xs';

                return (
                  <div 
                    key={lesson.id}
                    onClick={() => openLessonControl(lesson)}
                    onTouchStart={(e) => handleCardTouchStart(e, lesson.id)}
                    onTouchEnd={(e) => handleCardTouchEnd(e, lesson.id)}
                    className={`group relative flex flex-col p-3 sm:p-3.5 my-2 rounded-2xl cursor-pointer transition-all hover:shadow-md space-y-2 overflow-hidden ${cardStyle}`}
                  >
                    {/* 1. Header: Time Pill & Status/Session Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 w-full">
                      {/* Time Range, Live/Status Badges & Session count */}
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* Time Range Pill */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/25 text-xs sm:text-sm font-black font-mono tracking-tight shrink-0 shadow-2xs">
                          <Clock className="w-3.5 h-3.5 text-primary stroke-[2.25]" />
                          <span>{lesson.time} – {endTime || `${lesson.durationMinutes || 60}m`}</span>
                        </div>

                        {isLiveActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[10.5px] font-black tracking-wide uppercase bg-primary/10 text-primary border border-primary/25 shadow-2xs shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></span>
                            <span>{_t('live', 'live', 'live')}</span>
                          </span>
                        ) : isCompletedState ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                            <span>{_t('تمت الحصة ✓', 'Completed ✓', 'Abgeschlossen ✓')}</span>
                          </span>
                        ) : isCancelledState ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
                            <span>{_t('ملغاة ✕', 'Cancelled ✕', 'Abgesagt ✕')}</span>
                          </span>
                        ) : null}

                        {lesson.totalSessionsInPackage && lesson.totalSessionsInPackage > 1 && !isGroupPerLesson(targetGroup) && (
                          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-primary bg-primary/15 dark:bg-primary/25 px-2 py-0.5 rounded-md border border-primary/20 shrink-0">
                            {_t('حصة', 'Session', 'Std.')} {lesson.sessionNumber}/{lesson.totalSessionsInPackage}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. Group / Student Main Title */}
                    <div className="pt-0.5">
                      <h4 className="text-base sm:text-lg font-black text-text-main dark:text-white leading-snug truncate">
                        {targetGroup ? targetGroup.name : (lesson.studentName || lesson.groupName || lesson.title)}
                      </h4>
                    </div>

                    {/* 3. Unboxed Metadata Strip (Grade · Location/Mode · Student Count & Names) */}
                    <div className="flex items-center gap-1.5 text-xs text-text-muted dark:text-slate-300 font-medium flex-wrap pt-0.5 border-t border-primary-border/40">
                      {lesson.grade && (
                        <span>{lesson.grade}</span>
                      )}
                      
                      {lesson.grade && <span className="opacity-40 select-none">·</span>}
                      
                      <span className="inline-flex items-center gap-1">
                        {lesson.type === 'online' ? (
                          <>
                            <Video className="w-3 h-3 text-primary shrink-0 stroke-[2.25]" />
                            <span>{t('next_action_online')}</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3 h-3 text-primary shrink-0 stroke-[2.25]" />
                            <span>{lesson.location && lesson.location !== 'center' && lesson.location !== 'home' ? lesson.location : t('next_action_offline')}</span>
                          </>
                        )}
                      </span>

                      {(scheduledStudents.length > 0 || groupStudents.length > 0) && (
                        <>
                          <span className="opacity-40 select-none">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-primary shrink-0 stroke-[2.25]" />
                            <span>{scheduledStudents.length > 0 ? scheduledStudents.length : groupStudents.length} {_t('طلاب', 'students', 'Schüler')}</span>
                          </span>
                        </>
                      )}

                      {/* Group student names preview if available */}
                      {groupStudents.length > 0 && (
                        <>
                          <span className="opacity-40 select-none">·</span>
                          <span className="truncate max-w-[220px] text-text-muted/80">
                            ({groupStudents.map(s => s.name.split(' ')[0]).join('، ')})
                          </span>
                        </>
                      )}
                    </div>

                    {/* 4. Notes / Topic Preview if available */}
                    {(lesson.notes || lesson.report?.teacherNotes || lesson.report?.homeworkTitle) && (
                      <div className="text-xs text-text-muted bg-surface/80 dark:bg-slate-900/50 p-2 rounded-xl border border-surface-border/80 flex items-start gap-1.5 line-clamp-2">
                        <span className="font-bold text-primary shrink-0">{_t('ملاحظة:', 'Note:', 'Hinweis:')}</span>
                        <span className="truncate">{lesson.notes || lesson.report?.teacherNotes || lesson.report?.homeworkTitle}</span>
                      </div>
                    )}

                    {/* 6. Bottom Action Controls Bar */}
                    <div className="pt-2 border-t border-primary-border/20 flex items-center justify-end gap-1.5 w-full">
                      {/* Join Online Video Meeting OR Open Google Maps Location Button */}
                      {(() => {
                        const isOfflineLesson = lesson.type === 'offline' || targetGroup?.type === 'offline';
                        const meetingUrl = lesson.meetingLink || targetGroup?.zoomLink || targetGroup?.meetLink;

                        if (!isOfflineLesson && meetingUrl) {
                          return (
                            <a
                              href={meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                              title={_t('الانضمام للاجتماع أونلاين', 'Join Online Meeting', 'Online-Meeting beitreten')}
                              aria-label="Join Online Meeting"
                            >
                              <Video className="w-3.5 h-3.5 stroke-[2]" />
                            </a>
                          );
                        }

                        return (
                          <button
                            type="button"
                            onClick={(e) => handleOpenMaps(e, lesson)}
                            className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                            title={_t('فتح الخرائط لعنوان البيت / المكان', 'Open Google Maps for Home Address', 'In Google Maps öffnen')}
                            aria-label="Open Location in Google Maps"
                          >
                            <MapPin className="w-3.5 h-3.5 stroke-[2]" />
                          </button>
                        );
                      })()}

                      {/* Call Parent Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenCall(e, lesson)}
                        className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                        title={_t('اتصال بولي الأمر', 'Call Parent', 'Elternteil anrufen')}
                        aria-label="Call Parent"
                      >
                        <Phone className="w-3.5 h-3.5 stroke-[2]" />
                      </button>

                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenWhatsApp(e, lesson)}
                        className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                        title={
                          getIsMultiStudent(lesson)
                            ? _t('فتح مجموعة الواتساب / اختيار ولي الأمر', 'Open WhatsApp Group / Select Parent', 'WhatsApp-Gruppe / Elternteil auswählen')
                            : _t('إرسال واتساب لولي الأمر', 'Send WhatsApp to Parent', 'WhatsApp an Eltern senden')
                        }
                        aria-label="Open WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 stroke-[2]" />
                      </button>

                      {!isCompletedState && !isCancelledState && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleQuickCompleteLesson(e, lesson)}
                            className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                            title={_t('تمت الحصة (wiederholen + بدون واجب)', 'Mark Completed (wiederholen + no HW)', 'Erledigt (wiederholen + keine HA)')}
                            aria-label="Mark completed with wiederholen and no homework"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2]" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleQuickCancelLesson(e, lesson)}
                            className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                            title={_t('إلغاء الحصة', 'Cancel Lesson', 'Lektion absagen')}
                            aria-label="Cancel lesson"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2]" />
                          </button>
                        </>
                      )}
                      {(isCompletedState || isCancelledState) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissLessonFromDashboard(lesson.id);
                          }}
                          className="w-7 h-7 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                          title={t('dismiss_from_dashboard')}
                          aria-label="Hide from dashboard"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={lesson.id}
                  onClick={() => openLessonControl(lesson)}
                  onTouchStart={(e) => handleCardTouchStart(e, lesson.id)}
                  onTouchEnd={(e) => handleCardTouchEnd(e, lesson.id)}
                  className={`group relative flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    isCompletedState
                      ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-75 hover:opacity-100'
                      : isCancelledState
                      ? 'bg-rose-500/[0.02] dark:bg-rose-950/10 border-rose-500/20 dark:border-rose-900/25 opacity-70 hover:opacity-95'
                      : 'bg-white dark:bg-slate-900/70 border-slate-200/70 dark:border-surface-border/70 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xs'
                  }`}
                >


                  {/* 1. Time Column */}
                  <div
                    className="flex flex-col justify-center shrink-0 min-w-[42px] sm:min-w-[46px] text-start tabular-nums select-none p-1 rounded-md"
                  >
                    <span className={`text-[11px] sm:text-xs font-bold tracking-tight leading-none ${
                      isCompletedState 
                        ? 'text-text-muted line-through opacity-80' 
                        : isCancelledState 
                        ? 'text-rose-600/80 dark:text-rose-400/80 line-through' 
                        : state === 'active'
                        ? 'text-primary dark:text-primary-hover font-extrabold'
                        : 'text-primary font-black'
                    }`}>
                      {lesson.time}
                    </span>
                    <span className={`text-[9px] sm:text-[9.5px] font-medium leading-none mt-0.5 flex items-center gap-0.5 ${
                      state === 'active' ? 'text-primary/80 dark:text-primary/80 font-semibold' : 'text-text-muted/70'
                    }`}>
                      <span>{endTime || `${lesson.durationMinutes || 60}m`}</span>
                    </span>
                  </div>

                  {/* Hairline Divider between time & details */}
                  <div className="w-px h-6 bg-slate-200/60 dark:bg-slate-800 shrink-0 self-center" />

                  {/* 2. Simple Main Content (Name + Time only when collapsed) */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="min-w-0 flex-1 truncate">
                        <h4 className={`text-xs sm:text-[12.5px] font-bold truncate leading-tight ${
                          isCompletedState
                            ? 'line-through text-text-muted/80'
                            : isCancelledState
                            ? 'line-through text-rose-600/80 dark:text-rose-400/80'
                            : state === 'active'
                            ? 'text-slate-950 dark:text-white font-extrabold'
                            : 'text-text-main'
                        }`}>
                          {targetGroup ? targetGroup.name : (lesson.studentName || lesson.groupName || lesson.title)}
                        </h4>
                      </div>

                      {/* Quiet Status Badge */}
                      <div className="flex items-center gap-1 shrink-0">
                        {state === 'active' && !isCompletedState && !isCancelledState && (
                          <span className="inline-flex items-center text-[9px] sm:text-[9.5px] font-bold text-primary dark:text-primary-hover bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-full shrink-0">
                            <span>{t('timeline_live_now')}</span>
                          </span>
                        )}

                        {isCompletedState && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 opacity-80" />
                        )}

                        {isCancelledState && (
                          <span className="text-[9px] sm:text-[9.5px] font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                            ({t('status_cancelled')})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selectedGroupForModal && (
        <GroupProfileModal
          group={selectedGroupForModal}
          onClose={() => setSelectedGroupForModal(null)}
        />
      )}
      <SelectParentCallModal
        isOpen={selectParentModalData.isOpen}
        onClose={() => setSelectParentModalData({ isOpen: false, title: '', students: [] })}
        title={selectParentModalData.title}
        students={selectParentModalData.students}
        _t={_t}
      />
    </div>
  );
};
