import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { storage } from '../services/storageService';
import { Lesson, Student, AttendanceStatus, HomeworkStatus, PaymentStatus, LessonReport, StudentSessionPerformance } from '../types';
import { 
  X, Play, Pause, Square, Video, MapPin, Send, Phone, CheckCircle2, 
  Clock, AlertCircle, Sparkles, FileText, Award, DollarSign, ExternalLink, Navigation,
  Zap, UserPlus, XCircle, Ban
} from 'lucide-react';
import { ParentSummaryModal } from './ParentSummaryModal';
import { StudentSessionPerformanceSelector } from './StudentSessionPerformanceSelector';
import { ArabicParentReportModal } from './ArabicParentReportModal';
import { LessonReminderModal } from './LessonReminderModal';
import { HomeworkFollowUpModal } from './HomeworkFollowUpModal';
import { getPendingHomeworkFollowUps } from '../utils/homeworkFollowUpUtils';
import { buildWhatsAppUrl, formatWhatsAppPhone } from '../utils/phoneUtils';
import { getTeacherArabicName, getTeacherEnglishName } from '../utils/teacherUtils';
import confetti from 'canvas-confetti';

export const LessonControlModal: React.FC = () => {
  const { 
    selectedLesson, 
    closeLessonControl, 
    saveLessonReport, 
    cancelLesson, 
    updateLesson, 
    students, 
    profile, 
    groups, 
    lessons,
    convertQuickLessonToStudent,
    activeLessonSession,
    startActiveLessonTimer,
    pauseActiveLessonTimer,
    resumeActiveLessonTimer,
    endActiveLessonTimer,
    t,
    _t
  } = useApp();

  // Cancel Lesson state
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReasonNote, setCancelReasonNote] = useState('');

  // Background & Stopwatch persistent timer state

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [showParentSummaryModal, setShowParentSummaryModal] = useState(false);
  const [showArabicParentReportModal, setShowArabicParentReportModal] = useState(false);

  // Form state for lesson report
  const [attendance, setAttendance] = useState<AttendanceStatus>('present');
  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceStatus>>({});
  
  // Brand new Session Report Fields (Unifying lesson & student details)
  const [lessonWhatWasTaught, setLessonWhatWasTaught] = useState('');
  const [lessonNextHomework, setLessonNextHomework] = useState('');
  const [studentHomeworkDone, setStudentHomeworkDone] = useState<Record<string, 'yes' | 'no'>>({});
  const [studentDictationGrade, setStudentDictationGrade] = useState<Record<string, number>>({});
  const [studentExamGrade, setStudentExamGrade] = useState<Record<string, number>>({});
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [studentPerformance, setStudentPerformance] = useState<Record<string, StudentSessionPerformance>>({});

  const [homeworkStatus, setHomeworkStatus] = useState<HomeworkStatus>('assigned');
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [quizScore, setQuizScore] = useState<number>(0);
  const [examScore, setExamScore] = useState<number>(0);
  const [participationScore, setParticipationScore] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [packageChoice, setPackageChoice] = useState<number>(selectedLesson?.totalSessionsInPackage || 4);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [studentPayments, setStudentPayments] = useState<Record<string, { status: PaymentStatus; amount: number }>>({});
  const [reminderCopied, setReminderCopied] = useState(false);
  const [showLessonReminderModal, setShowLessonReminderModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [dismissFollowUpBanner, setDismissFollowUpBanner] = useState(false);

  // Check pending follow-ups for this group
  const pendingFollowUps = getPendingHomeworkFollowUps(lessons, groups);
  const groupPendingFollowUp = selectedLesson?.groupId 
    ? pendingFollowUps.find(p => p.groupId === selectedLesson.groupId)
    : null;

  // Group students for bulk/individual attendance
  const groupStudents = selectedLesson?.groupId 
    ? students.filter(s => s.groupId === selectedLesson.groupId)
    : [];

  // Initialize report form if selected lesson already has a report
  useEffect(() => {
    if (selectedLesson?.report) {
      setAttendance(selectedLesson.report.attendanceStatus || 'present');
      setLessonWhatWasTaught(selectedLesson.report.teacherNotes || '');
      setLessonNextHomework(selectedLesson.report.homeworkDescription || '');
      
      if (selectedLesson.report.studentAttendance) {
        setStudentAttendance(selectedLesson.report.studentAttendance);
      } else if (selectedLesson.groupId) {
        const initialAtt: Record<string, AttendanceStatus> = {};
        const groupSts = students.filter(s => s.groupId === selectedLesson.groupId);
        groupSts.forEach(st => {
          initialAtt[st.id] = selectedLesson.report?.attendanceStatus || 'present';
        });
        setStudentAttendance(initialAtt);
      }

      if (selectedLesson.report.studentHomeworkDone) {
        setStudentHomeworkDone(selectedLesson.report.studentHomeworkDone);
      } else {
        setStudentHomeworkDone({});
      }

      if (selectedLesson.report.studentDictationGrade) {
        setStudentDictationGrade(selectedLesson.report.studentDictationGrade);
      } else {
        setStudentDictationGrade({});
      }

      if (selectedLesson.report.studentExamGrade) {
        setStudentExamGrade(selectedLesson.report.studentExamGrade);
      } else {
        setStudentExamGrade({});
      }

      if (selectedLesson.report.studentPerformance) setStudentPerformance(selectedLesson.report.studentPerformance);
      if (selectedLesson.report.studentNotes) {
        setStudentNotes(selectedLesson.report.studentNotes);
      } else {
        setStudentNotes({});
      }

      setHomeworkStatus(selectedLesson.report.homeworkStatus || 'assigned');
      setHomeworkTitle(selectedLesson.report.homeworkTitle || '');
      setHomeworkDescription(selectedLesson.report.homeworkDescription || '');
      setQuizScore(selectedLesson.report.quizScore || 0);
      setExamScore(selectedLesson.report.examScore || 0);
      setParticipationScore(selectedLesson.report.participationScore || 0);
      setPaymentStatus(selectedLesson.report.paymentStatus || 'paid');
      setAmountPaid(selectedLesson.report.amountPaid || selectedLesson.amountDue);
      setTeacherNotes(selectedLesson.report.teacherNotes || '');
      setPackageChoice(selectedLesson.totalSessionsInPackage || 4);
      if (selectedLesson.studentPayments) {
        const initialMap: Record<string, { status: PaymentStatus; amount: number }> = {};
        Object.entries(selectedLesson.studentPayments).forEach(([stId, pDetail]: [string, any]) => {
          if (pDetail) {
            initialMap[stId] = { 
              status: pDetail.status || 'pending', 
              amount: typeof pDetail.amount === 'number' ? pDetail.amount : (typeof pDetail.amountPaid === 'number' ? pDetail.amountPaid : 0)
            };
          }
        });
        setStudentPayments(initialMap);
      }
      setShowReportForm(true);
      setIsEditingReport(false);
    } else if (selectedLesson) {
      setAmountPaid(selectedLesson.amountDue);
      setPaymentStatus(selectedLesson.paymentStatus);
      setPackageChoice(selectedLesson.totalSessionsInPackage || 4);
      setLessonWhatWasTaught('');
      setLessonNextHomework('');
      setStudentHomeworkDone({});
      setStudentDictationGrade({});
      setStudentExamGrade({});
      setStudentNotes({});

      if (isQuick) {
        const qId = targetStudent?.id || selectedLesson.studentId || selectedLesson.id || 'quick_student';
        setStudentAttendance({ [qId]: 'present' });
        setStudentHomeworkDone({ [qId]: 'yes' });
        setStudentDictationGrade({ [qId]: 100 });
        setStudentExamGrade({ [qId]: 100 });
      } else if (selectedLesson.groupId) {
        const initialAtt: Record<string, AttendanceStatus> = {};
        const groupSts = students.filter(s => s.groupId === selectedLesson.groupId);
        groupSts.forEach(st => {
          initialAtt[st.id] = 'present';
        });
        setStudentAttendance(initialAtt);
      } else {
        // Individual lesson - initialize for single student
        const targetSt = students.find(s => 
          (selectedLesson.studentId && s.id === selectedLesson.studentId) || 
          (selectedLesson.studentName && s.name.trim().toLowerCase() === selectedLesson.studentName.trim().toLowerCase())
        );
        if (targetSt) {
          setStudentAttendance({ [targetSt.id]: 'present' });
        }
      }

      if (selectedLesson.studentPayments) {
        const initialMap: Record<string, { status: PaymentStatus; amount: number }> = {};
        Object.entries(selectedLesson.studentPayments).forEach(([stId, pDetail]: [string, any]) => {
          if (pDetail) {
            initialMap[stId] = { 
              status: pDetail.status || 'pending', 
              amount: typeof pDetail.amount === 'number' ? pDetail.amount : (typeof pDetail.amountPaid === 'number' ? pDetail.amountPaid : 0)
            };
          }
        });
        setStudentPayments(initialMap);
      }
      setShowReportForm(false);
      setIsEditingReport(false);

      // Check for report draft if no finalized report yet
      async function checkDraft() {
        if (selectedLesson) {
          const draft = await storage.getItem<any>(`dl_draft_report_${selectedLesson.id}`);
          if (draft) {
            if (draft.attendance) setAttendance(draft.attendance);
            if (draft.studentAttendance) setStudentAttendance(draft.studentAttendance);
            if (draft.homeworkStatus) setHomeworkStatus(draft.homeworkStatus);
            if (draft.homeworkTitle) setHomeworkTitle(draft.homeworkTitle);
            if (draft.homeworkDescription) setHomeworkDescription(draft.homeworkDescription);
            if (draft.quizScore !== undefined) setQuizScore(draft.quizScore);
            if (draft.examScore !== undefined) setExamScore(draft.examScore);
            if (draft.participationScore !== undefined) setParticipationScore(draft.participationScore);
            if (draft.teacherNotes) setTeacherNotes(draft.teacherNotes);
            if (draft.lessonWhatWasTaught) setLessonWhatWasTaught(draft.lessonWhatWasTaught);
            if (draft.lessonNextHomework) setLessonNextHomework(draft.lessonNextHomework);
            if (draft.studentHomeworkDone) setStudentHomeworkDone(draft.studentHomeworkDone);
            if (draft.studentDictationGrade) setStudentDictationGrade(draft.studentDictationGrade);
            if (draft.studentExamGrade) setStudentExamGrade(draft.studentExamGrade);
            if (draft.studentNotes) setStudentNotes(draft.studentNotes);
            if (draft.studentPerformance) setStudentPerformance(draft.studentPerformance);
            setShowReportForm(true);
            setIsEditingReport(true);
          }
        }
      }
      checkDraft();
    }
  }, [selectedLesson, students]);

  // Auto-save report draft as teacher types
  useEffect(() => {
    if (selectedLesson && (lessonWhatWasTaught || lessonNextHomework || teacherNotes || homeworkTitle || homeworkDescription)) {
      storage.setItem(`dl_draft_report_${selectedLesson.id}`, {
        attendance, studentAttendance, homeworkStatus, homeworkTitle, homeworkDescription,
        quizScore, examScore, participationScore, teacherNotes,
        lessonWhatWasTaught, lessonNextHomework, studentHomeworkDone, studentDictationGrade, studentExamGrade, studentNotes, studentPerformance
      });
    }
  }, [selectedLesson?.id, attendance, studentAttendance, homeworkStatus, homeworkTitle, homeworkDescription, quizScore, examScore, participationScore, teacherNotes, lessonWhatWasTaught, lessonNextHomework, studentHomeworkDone, studentDictationGrade, studentExamGrade, studentNotes, studentPerformance]);

  const handleSendPaymentReminder = () => {
    const teacherAr = getTeacherArabicName(profile, 'المعلم');
    const teacherSig = teacherAr.startsWith('أ.') || teacherAr.startsWith('الأستاذ') ? teacherAr : `أ. ${teacherAr}`;
    const text = `السلام عليكم ورحمة الله وبركاته.\nتم الانتهاء من عدد الحصص المتفق عليها. برجاء تحويل الرسوم المستحقة.\n\nبيانات التحويل:\n📱 رقم الهاتف: ${profile.phone || '01012345678'}\n💳 InstaPay: ${profile.instaPayId || 'abdulrahman@instapay'}\n\nمع الشكر والتقدير\n${teacherSig}`;
    navigator.clipboard.writeText(text);
    setReminderCopied(true);
    confetti({ particleCount: 40, spread: 50 });
    setTimeout(() => setReminderCopied(false), 3000);
  };

    // Use activeLessonSession from Context for global robust state
  useEffect(() => {
    if (!selectedLesson) return;
    
    // If the active global lesson is the current lesson, use its state
    if (activeLessonSession && activeLessonSession.lessonId === selectedLesson.id) {
      if (activeLessonSession.isRunning) {
        const elapsed = Math.max(0, Math.floor((Date.now() - activeLessonSession.startedAt) / 1000));
        setTimerSeconds(activeLessonSession.accumulatedSeconds + elapsed);
        setIsTimerRunning(true);
      } else {
        setTimerSeconds(activeLessonSession.accumulatedSeconds);
        setIsTimerRunning(false);
      }
    } else if (selectedLesson.status === 'in_progress' && !activeLessonSession) {
      // Auto-start active global timer if lesson is in_progress
      startActiveLessonTimer(selectedLesson);
    } else {
      setTimerSeconds(0);
      setIsTimerRunning(false);
    }
  }, [selectedLesson?.id, selectedLesson?.status, activeLessonSession?.startedAt, activeLessonSession?.isRunning, activeLessonSession?.accumulatedSeconds, activeLessonSession?.lessonId]);

  // Stopwatch interval timer with Date.now() delta calculation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const updateElapsedTime = () => {
      if (activeLessonSession && activeLessonSession.lessonId === selectedLesson?.id && activeLessonSession.isRunning) {
        const elapsed = Math.max(0, Math.floor((Date.now() - activeLessonSession.startedAt) / 1000));
        setTimerSeconds(activeLessonSession.accumulatedSeconds + elapsed);
      }
    };

    if (isTimerRunning) {
      updateElapsedTime();
      interval = setInterval(updateElapsedTime, 1000);
      window.addEventListener('visibilitychange', updateElapsedTime);
      window.addEventListener('focus', updateElapsedTime);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('visibilitychange', updateElapsedTime);
      window.removeEventListener('focus', updateElapsedTime);
    };
  }, [isTimerRunning, activeLessonSession, selectedLesson?.id]);

  if (!selectedLesson) return null;

  const isQuick = Boolean(selectedLesson.isQuickLesson || selectedLesson.groupId === 'quick_group');

  const targetStudent = students.find(s => 
    (selectedLesson.studentId && s.id === selectedLesson.studentId) || 
    (selectedLesson.studentName && s.name.trim().toLowerCase() === selectedLesson.studentName.trim().toLowerCase())
  ) || (!isQuick && selectedLesson.groupId ? students.find(s => s.groupId === selectedLesson.groupId) : undefined);
  
  const quickStudentSynthetic: Student = {
    id: selectedLesson.studentId || selectedLesson.id || 'quick_student',
    name: selectedLesson.studentName || 'طالب تجريبي (Quick Lesson)',
    parentName: selectedLesson.quickParentName || selectedLesson.studentName || 'ولي الأمر',
    groupId: 'quick_group',
    studentPhone: selectedLesson.quickStudentPhone || '',
    parentPhone: selectedLesson.quickParentPhone || '',
    grade: selectedLesson.grade || 'Grade 9',
    notes: selectedLesson.quickNotes || '',
    documents: [],
    joinedDate: selectedLesson.date || new Date().toISOString()
  };

  const activeLessonStudents = isQuick
    ? [targetStudent || quickStudentSynthetic]
    : (selectedLesson.groupId 
        ? students.filter(s => s.groupId === selectedLesson.groupId)
        : (targetStudent ? [targetStudent] : []));
  
  const targetGroup = groups.find(g => g.id === selectedLesson.groupId);

  // Recipient Phone Resolution (Parent Phone > Student Phone > Quick Lesson Phone)
  const rawRecipientPhone = (
    targetStudent?.parentPhone || 
    selectedLesson?.quickParentPhone || 
    targetStudent?.studentPhone || 
    selectedLesson?.quickStudentPhone || 
    ''
  );
  const recipientPhone = formatWhatsAppPhone(rawRecipientPhone);

  const isGroupLesson = targetGroup && students.filter(s => s.groupId === targetGroup.id).length > 1;
  const groupWhatsAppLink = targetGroup?.whatsAppGroupLink || '';

  const sendWhatsAppWithGroupCheck = (text: string) => {
    if (isGroupLesson) {
      if (groupWhatsAppLink) {
        navigator.clipboard.writeText(text);
        alert('تم نسخ الرسالة. سيتم فتح الجروب الآن لتلصق الرسالة.');
        window.open(groupWhatsAppLink, '_blank');
        return;
      } else {
        alert('هذا الجروب غير مسجل له رابط واتساب. يرجى إضافة رابط الجروب من إعدادات الجروب أولاً لتتمكن من الإرسال.');
        return;
      }
    }
    sendWhatsAppWithGroupCheck(text);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartLesson = () => {
    setIsTimerRunning(true);
    if (selectedLesson) {
      if (selectedLesson.status !== 'completed') {
        updateLesson(selectedLesson.id, { status: 'in_progress' });
      }
      if (activeLessonSession && activeLessonSession.lessonId === selectedLesson.id) {
         resumeActiveLessonTimer();
      } else {
         startActiveLessonTimer(selectedLesson);
      }
    }
  };

  const handlePauseLesson = () => {
    setIsTimerRunning(false);
    pauseActiveLessonTimer();
  };

  const handleEndLesson = () => {
    setIsTimerRunning(false);
    endActiveLessonTimer();
    if (selectedLesson) {
      updateLesson(selectedLesson.id, { status: 'completed' });
    }
    setShowReportForm(true);
    try {
      confetti({ particleCount: 50, spread: 60 });
    } catch {}
  };

  const handleSaveReport = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const qId = targetStudent?.id || quickStudentSynthetic.id;
    const defaultTaught = lessonWhatWasTaught.trim() || (isQuick ? `حصة تجريبية / سريعة: ${selectedLesson.studentName || selectedLesson.title}` : 'تم شرح درس اليوم ومراجعته');
    const defaultHw = lessonNextHomework.trim() || (isQuick ? 'متابعة ما تم شرحه والتطبيقات' : 'مراجعة وحل التدريبات');

    const reportData: LessonReport = {
      attendanceStatus: attendance || 'present',
      studentAttendance: isQuick ? (Object.keys(studentAttendance).length > 0 ? studentAttendance : { [qId]: 'present' }) : studentAttendance,
      homeworkStatus: 'assigned',
      homeworkTitle: defaultHw,
      homeworkDescription: defaultHw,
      teacherNotes: defaultTaught,
      studentHomeworkDone: isQuick ? (Object.keys(studentHomeworkDone).length > 0 ? studentHomeworkDone : { [qId]: 'yes' }) : studentHomeworkDone,
      studentDictationGrade: isQuick ? (Object.keys(studentDictationGrade).length > 0 ? studentDictationGrade : { [qId]: 10 }) : studentDictationGrade,
      studentExamGrade: isQuick ? (Object.keys(studentExamGrade).length > 0 ? studentExamGrade : { [qId]: 10 }) : studentExamGrade,
      studentNotes: isQuick ? (Object.keys(studentNotes).length > 0 ? studentNotes : { [qId]: selectedLesson.quickNotes || '' }) : studentNotes,
      studentPerformance,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    saveLessonReport(selectedLesson.id, reportData, packageChoice);
    updateLesson(selectedLesson.id, { status: 'completed' });
    endActiveLessonTimer();
    storage.removeItem(`dl_draft_report_${selectedLesson.id}`);
    setIsEditingReport(false);
    setShowArabicParentReportModal(true); // Automatically open Arabic parent report to make sharing incredibly easy!
    try {
      confetti({ particleCount: 50, spread: 60 });
    } catch {}
  };

  // Communication Handlers with Recipient Validation & Teacher Name
  const handleSendConfirmationMessage = () => {
    const teacherEn = getTeacherEnglishName(profile, 'Lehrkraft');
    const teacherSig = teacherEn.startsWith('Herr ') || teacherEn.startsWith('Frau ') ? teacherEn : `Herr ${teacherEn}`;
    const text = `Hallo! Erinnerung an die Deutschstunde (${selectedLesson.title}) heute um ${selectedLesson.time} Uhr.\nMit freundlichen Grüßen,\n${teacherSig}`;
    sendWhatsAppWithGroupCheck(text);
  };

  const handleSendOfflineLessonStartMessage = () => {
    const teacherAr = getTeacherArabicName(profile, 'المعلم');
    const teacherSig = teacherAr.startsWith('أ.') || teacherAr.startsWith('الأستاذ') ? teacherAr : `أ. ${teacherAr}`;
    const text = `السلام عليكم ورحمة الله وبركاته\n\nتم بدء الحصة الآن.\n\nنحيطكم علماً بأن الطالب بدأ الحصة في موعدها المحدد.\n\nمع تحيات\n${teacherSig}`;
    sendWhatsAppWithGroupCheck(text);
  };

  const handleSendPaymentRequestMessage = () => {
    const teacherAr = getTeacherArabicName(profile, 'المعلم');
    const teacherSig = teacherAr.startsWith('أ.') || teacherAr.startsWith('الأستاذ') ? teacherAr : `أ. ${teacherAr}`;
    const text = `السلام عليكم ورحمة الله وبركاته\n\nتم الانتهاء من عدد الحصص المتفق عليها.\nبرجاء تحويل الرسوم المستحقة.\n\nمع تحيات\n${teacherSig}`;
    sendWhatsAppWithGroupCheck(text);
  };

  const handleStartTrip = () => {
    const teacherAr = getTeacherArabicName(profile, 'المعلم');
    const teacherSig = teacherAr.startsWith('أ.') || teacherAr.startsWith('الأستاذ') ? teacherAr : `أ. ${teacherAr}`;
    const text = `السلام عليكم ورحمة الله وبركاته\n\n${teacherSig} في الطريق الآن للحصة (${selectedLesson.title}). الوصول المتوقع خلال 20-30 دقيقة إن شاء الله. 🚗`;
    sendWhatsAppWithGroupCheck(text);
  };

  const handleOpenMaps = () => {
    const address = selectedLesson.locationAddress || targetGroup?.address || 'Cairo, Egypt';
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeLessonControl();
        }
      }} 
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm: pt-[max(24px,env(safe-area-inset-top,24px))] overflow-y-auto p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-t-[20px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-xl shadow-xl overflow-hidden animate-scale-up"
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2 mb-1 sm:hidden shrink-0" />
        {/* Top Header */}
        <div className="bg-surface border-b border-surface-border p-3.5 sm:p-4 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-primary-soft text-primary rounded-xl shrink-0">
              {selectedLesson.type === 'online' ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="bg-primary-soft text-primary font-mono text-[10px] font-black px-1.5 py-0.5 rounded border border-primary-border">
                  {(selectedLesson.type || '').toUpperCase()}
                </span>
                {selectedLesson.grade && (
                  <span className="text-[11px] text-text-muted font-bold">{selectedLesson.grade}</span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-text-main mt-0.5">{selectedLesson.title}</h2>
            </div>
          </div>

          <button
            onClick={closeLessonControl}
            className="p-1.5 sm:p-2 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted hover:text-text-main rounded-full transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 space-y-2.5 max-h-[78vh] overflow-y-auto font-sans">
          {/* Homework Follow-Up Pending Banner */}
          {groupPendingFollowUp && !dismissFollowUpBanner && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5 rounded-lg flex items-center justify-between gap-2.5 mb-1.5">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-400">Homework Follow-Up Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Send Now
                </button>
                <button
                  onClick={() => setDismissFollowUpBanner(true)}
                  className="bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Quick Lesson Banner & Convert Action */}
          {selectedLesson.isQuickLesson && (
            <div className="p-2.5 bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg flex items-center justify-between gap-2.5">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-primary dark:text-primary flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-primary fill-primary" />
                  <span>⚡ Quick Lesson</span>
                </span>
                <p className="text-[10px] text-primary dark:text-primary">
                  {selectedLesson.studentName} {selectedLesson.quickStudentPhone && `• Tel: ${selectedLesson.quickStudentPhone}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const newStudent = convertQuickLessonToStudent(selectedLesson.id);
                  if (newStudent) {
                    closeLessonControl();
                  }
                }}
                className="bg-primary hover:bg-primary-hover text-white font-black text-[11px] px-2.5 py-1.5 rounded-lg shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Convert to Student</span>
              </button>
            </div>
          )}

          {/* SAVED REPORT QUICK REVIEW OR ACTIVE FORM */}
          {selectedLesson.report && !isEditingReport ? (
            /* QUICK REVIEW SUMMARY CARD */
            <div className="bg-surface-hover/80 border border-surface-border dark:border-surface-border-soft/80 rounded-lg p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-surface-border/80 dark:border-surface-border-soft/80">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary dark:text-primary" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {t('auto_quick_review')}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-2 py-0.5 rounded-md border border-primary-border dark:border-primary-border">
                  {t('auto_report_saved')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Attendance Summary */}
                <div className="p-2.5 bg-surface rounded-lg border border-surface-border/80 dark:border-surface-border space-y-0.5">
                  <span className="block text-[9.5px] font-black uppercase text-text-muted/70">{t('auto_1_attendance')}</span>
                  <span className={`font-black flex items-center gap-1 ${
                    selectedLesson.report.attendanceStatus === 'present' ? 'text-primary dark:text-primary' :
                    selectedLesson.report.attendanceStatus === 'late' ? 'text-primary dark:text-primary' :
                    'text-primary dark:text-primary'
                  }`}>
                    {selectedLesson.report.attendanceStatus === 'present' && t('auto_present')}
                    {selectedLesson.report.attendanceStatus === 'late' && t('auto_late')}
                    {selectedLesson.report.attendanceStatus === 'absent' && t('auto_absent')}
                  </span>
                </div>

                {/* Homework Summary */}
                <div className="p-2.5 bg-surface rounded-lg border border-surface-border/80 dark:border-surface-border space-y-0.5">
                  <span className="block text-[9.5px] font-black uppercase text-text-muted/70">{t('auto_2_homework')}</span>
                  <div className="space-y-0.5">
                    <span className={`font-black text-xs ${
                      selectedLesson.report.homeworkStatus === 'completed' ? 'text-primary dark:text-primary' :
                      selectedLesson.report.homeworkStatus === 'assigned' ? 'text-primary dark:text-primary' :
                      'text-primary dark:text-primary'
                    }`}>
                      {selectedLesson.report.homeworkStatus === 'completed' && t('auto_completed')}
                      {selectedLesson.report.homeworkStatus === 'assigned' && t('auto_assigned')}
                      {selectedLesson.report.homeworkStatus === 'not_completed' && t('auto_not_completed')}
                    </span>
                    {selectedLesson.report.homeworkTitle && (
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate">
                        {selectedLesson.report.homeworkTitle}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Teacher Notes Summary */}
              {selectedLesson.report.teacherNotes && (
                <div className="p-2.5 bg-surface rounded-lg border border-surface-border/80 dark:border-surface-border space-y-0.5 text-xs">
                  <span className="block text-[9.5px] font-black uppercase text-text-muted/70">{t('auto_3_teacher_notes')}</span>
                  <p className="text-[11px] font-medium text-text-main italic">
                    "{selectedLesson.report.teacherNotes}"
                  </p>
                </div>
              )}

              {/* Edit Report Toggle */}
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsEditingReport(true)}
                  className="text-xs font-bold text-primary dark:text-primary hover:text-primary dark:hover:text-primary underline cursor-pointer"
                >
                  {t('auto_edit_report')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* BEFORE STARTING SECTION */}
              <div className="space-y-1.5 border-b border-slate-100 dark:border-surface-border pb-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>{t('auto_before_starting')}</span>
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Main Send Lesson Reminder Button */}
                  <button
                    type="button"
                    onClick={() => setShowLessonReminderModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5 fill-white" />
                    <span>{t('auto_send_lesson_reminder')}</span>
                  </button>

                  {selectedLesson.type === 'online' ? (
                    <>
                      <a
                        href={selectedLesson.meetingLink || targetGroup?.zoomLink || profile.defaultZoomLink}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>{t('auto_open_zoom_link')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      {profile.defaultMeetLink && (
                        <a
                          href={profile.defaultMeetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>{t('auto_open_google_meet')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSendOfflineLessonStartMessage}
                        className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{t('auto_send_lesson_started_notice')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSendPaymentRequestMessage}
                        className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>{t('auto_send_payment_request')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenMaps}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span>{t('auto_open_google_maps_navigation')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION 2 – SESSION TIMER */}
              <div className="bg-surface border border-surface-border rounded-xl p-3.5 shadow-2xs space-y-3 text-center relative overflow-hidden">
                {/* Background ambient glow when timer is running */}
                {isTimerRunning && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/20 rounded-full blur-[40px] pointer-events-none animate-pulse" />
                )}
                
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-1">
                    <Clock className={`w-3.5 h-3.5 ${isTimerRunning ? 'text-primary animate-pulse' : 'text-text-muted/70'}`} />
                    <span>{t('auto_live_lesson_timer')}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.5 rounded border border-primary-border/30">
                      {selectedLesson.status === 'completed' ? t('auto_completed_9') :
                       selectedLesson.status === 'cancelled' ? t('auto_cancelled') :
                       isTimerRunning ? t('auto_in_progress') :
                       timerSeconds > 0 ? t('auto_paused') :
                       t('auto_scheduled')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {_t(
                        `المدة: ${selectedLesson.durationMinutes || 60} دقيقة`,
                        `Duration: ${selectedLesson.durationMinutes || 60} min`,
                        `Dauer: ${selectedLesson.durationMinutes || 60} Min`
                      )}
                    </span>
                  </div>
                </div>

                {/* Stopwatch Display */}
                <div className="py-2 relative z-10">
                  <div className="flex justify-center">
                    <div className="relative flex flex-col items-center">
                      <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight transition-all duration-300 ${isTimerRunning ? 'text-primary drop-shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.4)]' : 'text-slate-700 dark:text-slate-300'}`}>
                        {formatTimer(timerSeconds)}
                      </span>
                      {timerSeconds > 0 && (
                        <span className="text-[9.5px] text-text-muted mt-0.5 font-bold">
                          {t('auto_elapsed_time')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timer & Main Action Buttons */}
                <div className="flex flex-col gap-2 relative z-10">
                  {selectedLesson.status !== 'completed' && selectedLesson.status !== 'cancelled' && (
                    <div className="grid grid-cols-2 gap-2">
                      {/* If lesson has NOT started yet */}
                      {selectedLesson.status === 'scheduled' && timerSeconds === 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={handleStartLesson}
                            className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-white animate-pulse" />
                            <span>{t('auto_start_session')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveReport()}
                            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t('auto_end_session')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowCancelPrompt(true)}
                            className="col-span-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold text-xs px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Ban className="w-3.5 h-3.5 text-red-500" />
                            <span>{t('auto_cancel_session')}</span>
                          </button>
                        </>
                      ) : (
                        /* If lesson is in progress or timer is active */
                        <>
                          {!isTimerRunning ? (
                            <button
                              type="button"
                              onClick={handleStartLesson}
                              className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>{t('auto_resume_session')}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handlePauseLesson}
                              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Pause className="w-3.5 h-3.5 fill-white" />
                              <span>{t('auto_pause')}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSaveReport()}
                            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t('auto_end_session')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowCancelPrompt(true)}
                            className="col-span-2 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold text-xs px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Ban className="w-3.5 h-3.5 text-red-500" />
                            <span>{t('auto_cancel_session')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CANCELLATION PROMPT BOX */}
                {showCancelPrompt && (
                  <div className="mt-2.5 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{t('auto_confirm_lesson_cancellation')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCancelPrompt(false)}
                        className="text-red-600/70 hover:text-red-600 dark:text-red-400/70 dark:hover:text-red-400 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-red-800 dark:text-red-300">
                      {t('auto_are_you_sure_you_want_to_cance')}
                    </p>

                    <textarea
                      rows={2}
                      value={cancelReasonNote}
                      onChange={(e) => setCancelReasonNote(e.target.value)}
                      placeholder={t('auto_enter_cancellation_reason_opt')}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />

                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowCancelPrompt(false)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        {t('auto_back')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTimerRunning(false);
                          endActiveLessonTimer();
                          storage.removeItem(`dl_draft_report_${selectedLesson.id}`);
                          cancelLesson(selectedLesson.id, cancelReasonNote);
                          setShowCancelPrompt(false);
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t('auto_yes_cancel_lesson')}</span>
                      </button>
                    </div>
                  </div>
                )}

              {/* SECTION 3 – MANDATORY SESSION REPORT */}
              {(showReportForm || timerSeconds > 0 || selectedLesson.status === 'in_progress' || selectedLesson.status === 'completed') && (() => {
                const isReportFormValid = (() => {
                  if (isQuick) return true; // Quick lesson can always be completed with instant defaults
                  if (!lessonWhatWasTaught.trim()) return false;
                  if (!lessonNextHomework.trim()) return false;
                  
                  // Check for each student
                  for (const st of activeLessonStudents) {
                    const att = studentAttendance[st.id] || 'present';
                    if (att !== 'absent') {
                      if (!studentHomeworkDone[st.id]) return false;
                      if (studentDictationGrade[st.id] === undefined) return false;
                      if (studentExamGrade[st.id] === undefined) return false;
                    }
                  }
                  return true;
                })();

                return (
                  <form onSubmit={(e) => { e.preventDefault(); if (isReportFormValid) handleSaveReport(); }} className="space-y-3 pt-2.5 border-t border-surface-border">
                    <div className="flex items-center justify-between bg-primary-soft/50 p-2 rounded-lg border border-primary-border/40">
                      <h3 className="text-xs font-black text-primary flex items-center gap-1.5 font-mono">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>{t('auto_unified_session_report')}</span>
                      </h3>
                      {selectedLesson.status !== 'in_progress' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowReportForm(false)}
                            className="text-[10px] text-text-muted hover:text-text-main font-bold hover:underline cursor-pointer"
                          >
                            {t('auto_hide_report')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Subject Taught */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-text-main flex items-center gap-1">
                        <span className="text-primary">*</span>
                        <span>{t('auto_subject_taught_content_less')}</span>
                      </label>
                      <textarea
                        rows={2}
                        value={lessonWhatWasTaught}
                        onChange={(e) => setLessonWhatWasTaught(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-hover hover:bg-slate-50 focus:bg-white border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/60"
                        placeholder={t('auto_enter_topics_taught_new_gramm')}
                      />
                    </div>

                    {/* Next Homework Description */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-text-main flex items-center gap-1">
                        <span className="text-primary">*</span>
                        <span>{t('auto_next_homework_assigned_to_stud')}</span>
                      </label>
                      <textarea
                        rows={2}
                        value={lessonNextHomework}
                        onChange={(e) => setLessonNextHomework(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-hover hover:bg-slate-50 focus:bg-white border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/60"
                        placeholder={t('auto_enter_details_of_homework_pag')}
                      />
                    </div>

                    {/* Individual Students Performance and Scores */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-black text-slate-500 uppercase flex items-center gap-1">
                        {t('auto_status_performance_of_eac')}
                      </h4>

                      <div className="space-y-2.5">
                        {activeLessonStudents.map(st => {
                          const stAtt = studentAttendance[st.id] || 'present';
                          const stHw = studentHomeworkDone[st.id];
                          const stDict = studentDictationGrade[st.id];
                          const stExam = studentExamGrade[st.id];

                          // Resolve the student's homework status from their last completed session
                          const lastSessionHwStatus = (() => {
                            const studentLessons = lessons.filter(l => 
                              l.status === 'completed' && l.report && 
                              (l.groupId === st.groupId || l.studentId === st.id || l.studentName?.trim().toLowerCase() === st.name.trim().toLowerCase())
                            );
                            const completedLessons = [...studentLessons].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                            const lastLessonWithReport = completedLessons.find(l => l.id !== selectedLesson.id && l.report);
                            return lastLessonWithReport?.report?.studentHomeworkDone?.[st.id];
                          })();

                          return (
                            <div 
                              key={st.id} 
                              className={`p-2.5 rounded-xl border transition-all ${
                                stAtt === 'absent' 
                                  ? 'bg-red-50/10 border-red-200/50 dark:border-red-950/30' 
                                  : 'bg-surface border-surface-border hover:shadow-2xs'
                              }`}
                            >
                              {/* Student Header */}
                              <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    <span>{st.name}</span>
                                  </span>
                                  {lastSessionHwStatus && (
                                    <span className="text-[9.5px] text-text-muted mt-0.5 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800/30 inline-block font-extrabold">
                                      {_t(
                                        `🎒 واجب سابق: ${lastSessionHwStatus === 'yes' ? 'تم الحل 👍' : 'لم يتم 👎'}`,
                                        `🎒 Prev HW: ${lastSessionHwStatus === 'yes' ? 'Done 👍' : 'Not Done 👎'}`,
                                        `🎒 Letzte HA: ${lastSessionHwStatus === 'yes' ? 'Erledigt 👍' : 'Nicht erledigt 👎'}`
                                      )}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Attendance toggle */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStudentAttendance(prev => ({ ...prev, [st.id]: 'present' }));
                                    }}
                                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-all ${
                                      stAtt === 'present'
                                        ? 'bg-primary text-white border border-primary shadow-2xs'
                                        : 'bg-surface-hover text-text-muted border border-surface-border'
                                    }`}
                                  >
                                    {t('auto_present_10')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStudentAttendance(prev => ({ ...prev, [st.id]: 'absent' }));
                                    }}
                                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-all ${
                                      stAtt === 'absent'
                                        ? 'bg-red-600 text-white border border-red-700 shadow-2xs'
                                        : 'bg-surface-hover text-text-muted border border-surface-border'
                                    }`}
                                  >
                                    {t('auto_absent_11')}
                                  </button>
                                </div>
                              </div>

                              {stAtt !== 'absent' ? (
                                <div className="mt-2 space-y-2.5 animate-fade-in">
                                  {/* Homework completed toggle */}
                                  <div className="space-y-1">
                                    <span className="text-[10.5px] font-black text-text-main block">{t('auto_previous_homework_performance')} <span className="text-primary">*</span></span>
                                    <div className="flex gap-1.5">
                                      <button
                                        key={`hw-yes-${st.id}`}
                                        type="button"
                                        onClick={() => {
                                          setStudentHomeworkDone(prev => ({ ...prev, [st.id]: 'yes' }));
                                        }}
                                        className={`flex-1 py-1 rounded-md text-[10px] font-black cursor-pointer transition-all border ${
                                          stHw === 'yes'
                                            ? 'bg-primary-soft text-primary border-primary-border shadow-2xs'
                                            : 'bg-surface-hover text-text-muted border-surface-border'
                                        }`}
                                      >
                                        {t('auto_completed_12')}
                                      </button>
                                      <button
                                        key={`hw-no-${st.id}`}
                                        type="button"
                                        onClick={() => {
                                          setStudentHomeworkDone(prev => ({ ...prev, [st.id]: 'no' }));
                                        }}
                                        className={`flex-1 py-1 rounded-md text-[10px] font-black cursor-pointer transition-all border ${
                                          stHw === 'no'
                                            ? 'bg-red-50 text-red-600 border-red-100 shadow-2xs dark:bg-red-950/20 dark:border-red-900/50'
                                            : 'bg-surface-hover text-text-muted border-surface-border'
                                        }`}
                                      >
                                        {t('auto_not_completed_13')}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Dictation Score (0 to 10 pills) */}
                                  <div className="space-y-1">
                                    <span className="text-[10.5px] font-black text-text-main block">{t('auto_dictation_grade_out_of_10')} <span className="text-primary">*</span></span>
                                    <div className="flex flex-wrap gap-1">
                                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                        <button
                                          key={`dict-${st.id}-${score}`}
                                          type="button"
                                          onClick={() => {
                                            setStudentDictationGrade(prev => ({ ...prev, [st.id]: score }));
                                          }}
                                          className={`w-7 h-7 sm:w-6 sm:h-6 rounded-lg sm:rounded-md text-xs sm:text-[10px] font-black flex items-center justify-center border transition-all cursor-pointer ${
                                            stDict === score
                                              ? 'bg-primary text-white border-primary shadow-2xs scale-105'
                                              : 'bg-surface-hover text-text-muted border-surface-border hover:bg-slate-200'
                                          }`}
                                        >
                                          {score}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Exam Score (0 to 10 pills) */}
                                  <div className="space-y-1">
                                    <span className="text-[10.5px] font-black text-text-main block">{t('auto_exam_quiz_grade_out_of_10')} <span className="text-primary">*</span></span>
                                    <div className="flex flex-wrap gap-1">
                                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                        <button
                                          key={`exam-${st.id}-${score}`}
                                          type="button"
                                          onClick={() => {
                                            setStudentExamGrade(prev => ({ ...prev, [st.id]: score }));
                                          }}
                                          className={`w-7 h-7 sm:w-6 sm:h-6 rounded-lg sm:rounded-md text-xs sm:text-[10px] font-black flex items-center justify-center border transition-all cursor-pointer ${
                                            stExam === score
                                              ? 'bg-primary text-white border-primary shadow-2xs scale-105'
                                              : 'bg-surface-hover text-text-muted border-surface-border hover:bg-slate-200'
                                          }`}
                                        >
                                          {score}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Student-Specific Notes */}
                                  <div className="space-y-1">
                                    <span className="text-[10.5px] font-black text-text-main block">{t('auto_parent_student_notes_option')}</span>
                                    <input
                                      type="text"
                                      value={studentNotes[st.id] || ''}
                                      onChange={(e) => {
                                        setStudentNotes(prev => ({ ...prev, [st.id]: e.target.value }));
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-surface-hover hover:bg-slate-50 focus:bg-white border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-text-muted/50"
                                      placeholder={t('auto_e_g_excellent_listening_skill')}
                                    />
                                  </div>
                                  <StudentSessionPerformanceSelector 
                                    performance={studentPerformance[st.id]}
                                    onChange={(perf) => setStudentPerformance(prev => ({ ...prev, [st.id]: perf }))}
                                    language='ar'
                                  />
                                </div>
                              ) : (
                                <div className="mt-2 py-1.5 px-2 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg text-center animate-fade-in">
                                  <span className="text-[10px] font-black text-red-600 dark:text-red-400">
                                    {t('auto_absent_exempt_from_grades')}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Validation Alerts */}
                    {!isReportFormValid && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-dashed border-amber-300 dark:border-amber-900/50 rounded-xl space-y-1 text-xs text-amber-800 dark:text-amber-300">
                        <div className="flex items-center gap-1 font-extrabold text-amber-950 dark:text-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{t('auto_please_complete_the_following')}</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] font-black pr-1">
                          {!lessonWhatWasTaught.trim() && <li>{t('auto_subject_taught_field')}</li>}
                          {!lessonNextHomework.trim() && <li>{t('auto_next_homework_field')}</li>}
                          {activeLessonStudents.map(st => {
                            const att = studentAttendance[st.id] || 'present';
                            if (att !== 'absent') {
                              const missing = [];
                              if (studentHomeworkDone[st.id] === undefined) missing.push(t('auto_homework_status'));
                              if (studentDictationGrade[st.id] === undefined) missing.push(t('auto_dictation_grade'));
                              if (studentExamGrade[st.id] === undefined) missing.push(t('auto_exam_grade'));
                              if (missing.length > 0) {
                                return (
                                  <li key={st.id}>
                                    {t('auto_student_14')} <strong>{st.name}</strong>:{' '}
                                    {t('auto_needs')} ({missing.join(t('auto'))})
                                  </li>
                                );
                              }
                            }
                            return null;
                          })}
                        </ul>
                      </div>
                    )}

                    {/* End Session Button */}
                    <button
                      type="button"
                      disabled={!isReportFormValid}
                      onClick={() => handleSaveReport()}
                      className={`w-full font-black text-xs py-2.5 rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isReportFormValid
                          ? 'bg-primary hover:bg-primary-hover active:scale-95 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300/30'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('auto_end_session_save_report')}</span>
                    </button>
                  </form>
                );
              })()}
            </>
          )}

          {/* PARENT COMMUNICATION QUICK BUTTONS */}
          <div className="pt-2 border-t border-slate-100 dark:border-surface-border space-y-1.5">
            <p className="text-xs font-bold text-text-main">
              {t('auto_parent_communication')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={selectedLesson.status !== 'completed'}
                onClick={() => {
                  if (selectedLesson.status !== 'completed') {
                    alert(t('alert_finish_lesson_first'));
                    return;
                  }
                  setShowArabicParentReportModal(true);
                }}
                className={`font-black text-xs py-2 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                  selectedLesson.status === 'completed'
                    ? 'bg-primary hover:bg-primary-hover active:scale-95 text-white cursor-pointer'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200/50'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>تقرير ولي الأمر</span>
              </button>

              <a
                href={targetStudent?.parentPhone || selectedLesson?.quickParentPhone ? `tel:${(targetStudent?.parentPhone || selectedLesson?.quickParentPhone || '').replace(/[^0-9+]/g, '')}` : '#'}
                onClick={(e) => {
                  if (!targetStudent?.parentPhone && !selectedLesson?.quickParentPhone) {
                    e.preventDefault();
                    alert(t('alert_no_parent_phone'));
                  }
                }}
                className="bg-surface-hover hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1 text-center cursor-pointer"
              >
                <Phone className="w-3 h-3 text-primary" />
                <span>Anruf Eltern</span>
              </a>

              {targetStudent?.phone && (
                <a
                  href={`tel:${targetStudent.phone}`}
                  className="bg-surface-hover hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1 text-center"
                >
                  <Phone className="w-3 h-3 text-primary" />
                  <span>Anruf Schüler</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Parent Summary Modal overlay */}
      {showParentSummaryModal && (
        <ParentSummaryModal
          lesson={{
            ...selectedLesson,
            sessionNumber: selectedLesson.sessionNumber || 1,
            totalSessionsInPackage: packageChoice || selectedLesson.totalSessionsInPackage || 4,
            report: {
              ...(selectedLesson.report || {}),
              attendanceStatus: attendance,
              studentAttendance: studentAttendance,
              homeworkStatus,
              homeworkTitle,
              homeworkDescription,
              quizScore: Number(quizScore),
              examScore: Number(examScore),
              participationScore: Number(participationScore),
              paymentStatus,
              amountPaid: Number(amountPaid),
              teacherNotes,
              savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          }}
          student={targetStudent}
          profile={profile}
          onClose={() => setShowParentSummaryModal(false)}
          onGoToHomeScreen={closeLessonControl}
        />
      )}

      {/* Unified Parent Report Modal overlay */}
      {showArabicParentReportModal && (
        <ArabicParentReportModal
          lesson={{
            ...selectedLesson,
            sessionNumber: selectedLesson.sessionNumber || 1,
            totalSessionsInPackage: packageChoice || selectedLesson.totalSessionsInPackage || 8,
            report: {
              ...(selectedLesson.report || {}),
              attendanceStatus: attendance,
              studentAttendance: studentAttendance,
              homeworkStatus,
              homeworkTitle,
              homeworkDescription,
              paymentStatus,
              amountPaid: Number(amountPaid),
              teacherNotes,
            }
          }}
          student={targetStudent || (isQuick ? quickStudentSynthetic : undefined)}
          profile={profile}
          onClose={() => setShowArabicParentReportModal(false)}
          onGoToHomeScreen={closeLessonControl}
        />
      )}

      {/* Lesson Reminder Modal overlay */}
      {showLessonReminderModal && (
        <LessonReminderModal
          lesson={selectedLesson}
          group={targetGroup}
          recipientPhone={recipientPhone}
          onClose={() => setShowLessonReminderModal(false)}
        />
      )}

      {/* Homework Follow-Up Modal */}
      {showFollowUpModal && pendingFollowUps.length > 0 && (
        <HomeworkFollowUpModal
          pendingFollowUps={pendingFollowUps}
          initialGroupId={selectedLesson?.groupId}
          onClose={() => setShowFollowUpModal(false)}
        />
      )}
    </div>
  );
};
