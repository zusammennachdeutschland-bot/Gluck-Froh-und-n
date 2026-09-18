import { App as CapacitorApp } from '@capacitor/app';
import React, { useState, useEffect } from 'react';
import { Lesson, Student, TeacherProfile } from '../types';
import { useApp } from '../context/AppContext';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername, formatContactDisplay } from '../utils/phoneUtils';
import { getTeacherArabicName } from '../utils/teacherUtils';
import { formatTimeDisplay, parseLocalDate } from '../utils/timeUtils';
import { isLikelyFemaleStudent, getStudentRoleLabel, getArabicAttendanceString } from '../utils/genderUtils';
import { getStudentCode } from '../utils/studentCodeUtils';
import { 
  X, Copy, Check, Send, Phone, Printer, Sparkles, User, MessageSquare, Users, Link2, Home, AtSign, Video, ExternalLink, Plus, RefreshCw, KeyRound, ClipboardCheck, BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GroupProfileModal } from './GroupProfileModal';

export { isLikelyFemaleStudent } from '../utils/genderUtils';

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const getLessonArabicDay = (dateStr?: string, fallbackDay?: string): string => {
  if (dateStr) {
    try {
      const d = parseLocalDate(dateStr);
      const dayIdx = d.getDay();
      if (dayIdx >= 0 && dayIdx < 7) {
        return ARABIC_DAYS[dayIdx];
      }
    } catch (e) {}
  }
  if (fallbackDay) {
    const map: Record<string, string> = {
      sunday: 'الأحد',
      monday: 'الإثنين',
      tuesday: 'الثلاثاء',
      wednesday: 'الأربعاء',
      thursday: 'الخميس',
      friday: 'الجمعة',
      saturday: 'السبت',
      sonntag: 'الأحد',
      montag: 'الإثنين',
      dienstag: 'الثلاثاء',
      mittwoch: 'الأربعاء',
      donnerstag: 'الخميس',
      freitag: 'الجمعة',
      samstag: 'السبت'
    };
    const clean = fallbackDay.toLowerCase().trim();
    if (map[clean]) return map[clean];
  }
  return '';
};

const formatArabicDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

const formatArabicTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  if (timeStr.includes('م') || timeStr.includes('ص')) return timeStr;
  if (timeStr.includes('-')) {
    const parts = timeStr.split('-').map(s => s.trim());
    return parts.map(p => formatTimeDisplay(p, 'ar')).join(' - ');
  }
  return formatTimeDisplay(timeStr, 'ar');
};

interface ArabicParentReportModalProps {
  lesson: Lesson;
  student?: Student;
  profile: TeacherProfile;
  onClose: () => void;
  onSaveReport?: (arabicReportText: string, updatedFields?: Record<string, any>) => void;
  onGoToHomeScreen?: () => void;
}

export const ArabicParentReportModal: React.FC<ArabicParentReportModalProps> = ({
  lesson,
  student,
  profile,
  onClose,
  onSaveReport,
  onGoToHomeScreen
}) => {
  const { students, groups, lessons, updateLesson, saveLessonReport, _t, language, t } = useApp();
  const [copied, setCopied] = useState(false);
  const [showGroupProfile, setShowGroupProfile] = useState(false);

  // Find the associated group (if any)
  const associatedGroup = groups.find(g => g.id === lesson.groupId);
  const groupWhatsAppLink = associatedGroup?.whatsAppGroupLink || '';

  // Check if the lesson/group operates on a cycle package (not per-lesson / single session)
  const isPerLesson = Boolean(
    lesson.isQuickLesson || 
    (associatedGroup && (
      associatedGroup.paymentCycle === 'per_lesson' || 
      associatedGroup.paymentModel === 'per_session' || 
      (associatedGroup.sessionCount || 0) <= 1
    )) ||
    (!associatedGroup && (!lesson.totalSessionsInPackage || lesson.totalSessionsInPackage <= 1))
  );

  const hasCycle = !isPerLesson;
  const totalCycleSessions = associatedGroup?.sessionCount || lesson.totalSessionsInPackage || 8;
  const currentSessionNumber = lesson.sessionNumber || 1;

  // Find students associated with this lesson or group
  const groupStudents = lesson.groupId 
    ? students.filter(s => s.groupId === lesson.groupId) 
    : [];

  const isGroupLesson = (Boolean(lesson.groupId) || groupStudents.length > 0) && groupStudents.length > 1;

  // Tabs: 'individual' | 'bulk'
  const [activeTab, setActiveTab] = useState<'individual' | 'bulk'>(
    isGroupLesson ? 'bulk' : 'individual'
  );

  const initialResolvedStudent = student || 
    students.find(s => (lesson.studentId && s.id === lesson.studentId) || (lesson.studentName && s.name && s.name.trim().toLowerCase() === lesson.studentName.trim().toLowerCase())) || 
    (groupStudents.length > 0 ? groupStudents[0] : (lesson.studentName ? ({
      id: lesson.studentId || lesson.id || 'quick_student',
      name: lesson.studentName,
      groupId: 'quick_group',
      parentName: lesson.quickParentName,
      parentPhone: lesson.quickParentPhone,
      studentPhone: lesson.quickStudentPhone,
      grade: lesson.grade || 'Grade 9',
      currency: profile.currency,
      notes: lesson.quickNotes || '',
      createdAt: lesson.date || new Date().toISOString(),
      documents: [],
      joinedDate: lesson.date || new Date().toISOString()
    } as unknown as Student) : undefined));

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialResolvedStudent?.id || ''
  );

  const activeStudent = students.find(s => s.id === selectedStudentId) || initialResolvedStudent;

  // Helper to find previous homework from earlier lesson or lesson report
  const detectedPreviousHomework = React.useMemo(() => {
    if (lesson.report?.arabicPreviousHomework?.trim()) {
      return lesson.report.arabicPreviousHomework.trim();
    }
    if (lesson.report?.previousHomeworkDescription?.trim()) {
      return lesson.report.previousHomeworkDescription.trim();
    }

    const studentId = activeStudent?.id || lesson.studentId;
    const groupId = lesson.groupId || activeStudent?.groupId;
    const studentName = (activeStudent?.name || lesson.studentName || '').trim().toLowerCase();

    // Find previous candidate lessons for this group or student
    const candidateLessons = (lessons || []).filter(l => {
      if (l.id === lesson.id) return false;
      if (l.deleted) return false;

      const matchGroup = groupId && l.groupId === groupId;
      const matchStudent = (studentId && (l.studentId === studentId || l.report?.studentAttendance?.[studentId] !== undefined)) ||
        (studentName && l.studentName && l.studentName.trim().toLowerCase() === studentName);

      return Boolean(matchGroup || matchStudent);
    });

    if (candidateLessons.length === 0) return '';

    // Sort by date and time descending
    candidateLessons.sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return (b.sessionNumber || 0) - (a.sessionNumber || 0);
    });

    const currentLessonTime = new Date(`${lesson.date}T${lesson.time || '00:00'}`).getTime();
    
    // Find the closest lesson prior to this one that has homework recorded
    const earlierLesson = candidateLessons.find(l => {
      const lTime = new Date(`${l.date}T${l.time || '00:00'}`).getTime();
      const isPrior = !isNaN(currentLessonTime) && !isNaN(lTime) ? lTime <= currentLessonTime : true;
      const hw = l.report?.arabicHomeworkRequired || l.report?.homeworkDescription || l.report?.homeworkTitle || l.homeworkDescription || l.homeworkTitle;
      return isPrior && Boolean(hw && hw.trim());
    });

    const targetPrevLesson = earlierLesson || candidateLessons.find(l => {
      const hw = l.report?.arabicHomeworkRequired || l.report?.homeworkDescription || l.report?.homeworkTitle || l.homeworkDescription || l.homeworkTitle;
      return Boolean(hw && hw.trim());
    });

    if (targetPrevLesson) {
      const hw = (
        targetPrevLesson.report?.arabicHomeworkRequired ||
        targetPrevLesson.report?.homeworkDescription ||
        targetPrevLesson.report?.homeworkTitle ||
        targetPrevLesson.homeworkDescription ||
        targetPrevLesson.homeworkTitle ||
        ''
      ).trim();
      return hw;
    }

    return '';
  }, [lessons, lesson, activeStudent]);

  const [previousHomework, setPreviousHomework] = useState<string>(() => {
    return (
      lesson.report?.arabicPreviousHomework || 
      lesson.report?.previousHomeworkDescription || 
      detectedPreviousHomework || 
      ''
    );
  });

  // Sync if active student changes or detectedPreviousHomework changes when field is empty
  useEffect(() => {
    if (detectedPreviousHomework && !previousHomework) {
      setPreviousHomework(detectedPreviousHomework);
    }
  }, [detectedPreviousHomework]);

  const parentName = activeStudent?.parentName || lesson.quickParentName || activeStudent?.name || lesson.studentName || 'ولي الأمر المحترم';
  
  // Resolve contact with smart fallback: phone or username
  const resolvedContact = resolveStudentWhatsAppContact(activeStudent, {
    quickParentPhone: lesson.quickParentPhone,
    quickStudentPhone: lesson.quickStudentPhone
  });
  const parentPhone = resolvedContact.contact;

  // Editable generated report
  const [copiedCodeInModal, setCopiedCodeInModal] = useState<boolean>(false);
  const [finalGeneratedText, setFinalGeneratedText] = useState<string>('');
  const [isManualEdited, setIsManualEdited] = useState<boolean>(false);
  const [reportStyle, setReportStyle] = useState<'egyptian' | 'standard' | 'concise'>('egyptian');
  const [styleSeed, setStyleSeed] = useState<number>(0);
  const [recordingLink, setRecordingLink] = useState<string>(
    lesson.report?.recordingLink || lesson.recordingLink || ''
  );
  const [recordingLink2, setRecordingLink2] = useState<string>(
    lesson.report?.recordingLink2 || lesson.recordingLink2 || ''
  );
  const [showRecordingLink2, setShowRecordingLink2] = useState<boolean>(
    Boolean(lesson.report?.recordingLink2 || lesson.recordingLink2)
  );
  const [autoSavedNotice, setAutoSavedNotice] = useState<boolean>(false);

  // Auto save recording links directly to lists & lesson database
  const persistRecordings = React.useCallback((r1?: string, r2?: string, currentText?: string) => {
    const raw1 = r1 !== undefined ? r1 : recordingLink;
    const raw2 = r2 !== undefined ? r2 : recordingLink2;
    const textToCheck = currentText !== undefined ? currentText : finalGeneratedText;

    let finalR1 = raw1.trim();
    let finalR2 = raw2.trim();

    // If direct link field is empty, detect video recording links from custom edited message
    if (!finalR1 && textToCheck) {
      const urls = textToCheck.match(/https?:\/\/[^\s\n\r"']+/g) || [];
      const match = urls.find(u => 
        u.includes('grain.co') || u.includes('grain.com') || u.includes('zoom.us') || 
        u.includes('drive.google') || u.includes('youtube.com') || u.includes('youtu.be') || 
        u.includes('loom.com') || u.includes('vimeo.com')
      ) || (urls.length > 0 && !urls[0].includes('whatsapp') && !urls[0].includes('wa.me') ? urls[0] : undefined);

      if (match) {
        finalR1 = match;
        setRecordingLink(match);
      }
    }

    const rec1 = finalR1 || undefined;
    const rec2 = finalR2 || undefined;

    updateLesson(lesson.id, {
      recordingLink: rec1,
      recordingLink2: rec2,
      report: {
        ...(lesson.report || {}),
        recordingLink: rec1,
        recordingLink2: rec2,
        arabicFullGeneratedReport: textToCheck,
        arabicPreviousHomework: previousHomework.trim() || undefined,
        previousHomeworkDescription: previousHomework.trim() || undefined
      }
    });

    saveLessonReport(lesson.id, {
      ...(lesson.report || {}),
      recordingLink: rec1,
      recordingLink2: rec2,
      arabicFullGeneratedReport: textToCheck,
      arabicPreviousHomework: previousHomework.trim() || undefined,
      previousHomeworkDescription: previousHomework.trim() || undefined
    });

    if (onSaveReport) {
      onSaveReport(textToCheck, {
        recordingLink: rec1,
        recordingLink2: rec2,
        arabicPreviousHomework: previousHomework.trim() || undefined,
        previousHomeworkDescription: previousHomework.trim() || undefined
      });
    }

    setAutoSavedNotice(true);
    setTimeout(() => setAutoSavedNotice(false), 2500);
  }, [lesson.id, lesson.report, recordingLink, recordingLink2, finalGeneratedText, previousHomework, updateLesson, saveLessonReport, onSaveReport]);

  // Debounce-sync recording link updates automatically to the list
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentR1 = lesson.recordingLink || lesson.report?.recordingLink || '';
      const currentR2 = lesson.recordingLink2 || lesson.report?.recordingLink2 || '';
      if (recordingLink.trim() !== currentR1.trim() || recordingLink2.trim() !== currentR2.trim()) {
        persistRecordings();
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [recordingLink, recordingLink2, persistRecordings, lesson.recordingLink, lesson.report?.recordingLink, lesson.recordingLink2, lesson.report?.recordingLink2]);

  // Helper to format recording link(s) for the Arabic report
  const formatRecordingsArabic = (link1: string, link2: string): string => {
    const l1 = link1.trim();
    const l2 = link2.trim();
    if (l1 && l2) {
      return `\n\n🎥 تسجيلات الحصة (جزئين):\n• الجزء الأول: ${l1}\n• الجزء الثاني: ${l2}`;
    }
    if (l1) {
      return `\n\n🎥 رابط تسجيل الحصة:\n${l1}`;
    }
    if (l2) {
      return `\n\n🎥 رابط تسجيل الحصة:\n${l2}`;
    }
    return '';
  };

  // Generate Bulk Group Report Text
  const getBulkReportText = () => {
    const taughtToday = lesson.report?.arabicTopicsExplained || lesson.report?.teacherNotes || lesson.topic || 'لم يحدد بعد';
    const nextHomework = lesson.report?.arabicHomeworkRequired || lesson.report?.homeworkDescription || (lesson.report?.homeworkTitle ? `${lesson.report.homeworkTitle}` : 'لا يوجد واجب');
    
    const dayName = getLessonArabicDay(lesson.date, lesson.dayOfWeek);
    const dateFormatted = formatArabicDate(lesson.date);
    const timeFormatted = formatArabicTime(lesson.time);

    const dayDateLine = dayName && dateFormatted 
      ? `📅 اليوم: ${dayName} (${dateFormatted})`
      : dayName 
        ? `📅 اليوم: ${dayName}`
        : dateFormatted 
          ? `📅 التاريخ: ${dateFormatted}` 
          : '';

    const timeLine = timeFormatted ? `⏰ الساعة: ${timeFormatted}` : '';
    const cycleLine = hasCycle ? `🔢 رقم الحصة: الحصة (${currentSessionNumber} من ${totalCycleSessions})` : '';

    const recordingSection = formatRecordingsArabic(recordingLink, recordingLink2);

    const teacherArName = getTeacherArabicName(profile, 'المعلم');
    const hasPrefix = /^(أ\.|أ\/|أستاذ|الأستاذ|د\.|د\/|دكتور|م\.|م\/|مهندس)/.test(teacherArName);
    const teacherSig = hasPrefix ? teacherArName : `أ. ${teacherArName}`;

    if (reportStyle === 'egyptian') {
      const egyptianGreetings = [
        'مساء الخير يا فندم / أهلاً بحضراتكم 👋',
        'السلام عليكم ورحمة الله وبركاته يا فندم 👋',
        'أهلاً بحضراتكم جميعاً 👋'
      ];
      const selectedGreeting = egyptianGreetings[styleSeed % egyptianGreetings.length];
      const groupTitle = associatedGroup?.name || lesson.title || 'مجموعة الألماني';

      const absentsOrLates = groupStudents.filter(st => {
        const stAtt = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
        return stAtt !== 'present';
      });

      let text = `${selectedGreeting}
📊 تقرير حصة الألماني لمجموعة: *${groupTitle}* 🇩🇪
${[dayDateLine, timeLine, cycleLine].filter(Boolean).join('\n')}

📖 اللي اتشرح النهاردة في الحصة:
${taughtToday}

📝 الواجب المطلوب من كل الطلاب:
${nextHomework}${previousHomework.trim() ? `\n\n📋 الواجب السابق المطلوب كان:\n• ${previousHomework.trim()}` : ''}${recordingSection}
`;

      if (absentsOrLates.length > 0) {
        text += `\n----------------------------------\n⚠️ تنبيهات الغياب والتأخير:\n`;
        absentsOrLates.forEach((st) => {
          const stAtt = lesson.report?.studentAttendance?.[st.id] || 'absent';
          text += `• ${st.name}: ${stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌'}\n`;
        });
      }

      text += `\nشكراً لمتابعتكم الكريمة واهتمامكم المستمر 🌸\nمع تحيات: *${teacherSig}* 🇩🇪`;
      return text;
    }

    if (reportStyle === 'concise') {
      const absentsOrLates = groupStudents.filter(st => {
        const stAtt = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
        return stAtt !== 'present';
      });

      let text = `⚡ تقرير سريع - ${associatedGroup?.name || lesson.title || 'حصة ألماني'} 🇩🇪
${dayDateLine} ${timeLine ? `• ${timeLine}` : ''}

📌 ما تم شرحه: ${taughtToday}
📝 الواجب المقرر: ${nextHomework}${previousHomework.trim() ? `\n• الواجب السابق: ${previousHomework.trim()}` : ''}${recordingSection}
`;

      if (absentsOrLates.length > 0) {
        text += `\n⚠️ الغياب والتأخير:\n`;
        absentsOrLates.forEach((st) => {
          const stAtt = lesson.report?.studentAttendance?.[st.id] || 'absent';
          text += `• ${st.name}: ${stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌'}\n`;
        });
      }

      text += `\nتحياتي، *${teacherSig}*`;
      return text;
    }

    // Standard Arabic
    const headerParts = [
      `السلام عليكم ورحمة الله وبركاته 👋`,
      `📊 تقرير الحصة لمجموعة: ${associatedGroup?.name || lesson.title || 'مجموعة اللغة الألمانية'}`,
      dayDateLine,
      timeLine,
      cycleLine
    ].filter(Boolean).join('\n');

    const absentsOrLates = groupStudents.filter(st => {
      const stAtt = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
      return stAtt !== 'present';
    });

    let text = `${headerParts}

📖 تم اليوم شرح:
${taughtToday}

📝 الواجب لجميع الطلاب:
${nextHomework}${previousHomework.trim() ? `\n\n📋 الواجب السابق المطلوب كان:\n• ${previousHomework.trim()}` : ''}${recordingSection}
`;

    if (absentsOrLates.length > 0) {
      text += `\n----------------------------------\n⚠️ تنبيهات الغياب والتأخير:\n`;
      absentsOrLates.forEach((st) => {
        const stAtt = lesson.report?.studentAttendance?.[st.id] || 'absent';
        text += `• ${st.name}: ${stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌'}\n`;
      });
    }

    text += `\nشكراً لكم،\n${teacherSig} - معلم اللغة الألمانية 🇩🇪`;
    return text;
  };

  // Auto-generate report based on student data or bulk mode
  useEffect(() => {
    if (isManualEdited) return;

    if (activeTab === 'bulk') {
      setFinalGeneratedText(getBulkReportText());
      return;
    }

    let homeworkOption = 'غير محدد';
    let dictationScore = 'مكانش فيه';
    let examScore = 'مكانش فيه';
    let studentNote = '';
    let perfFeedback = '';
    let attendanceAlert = '';

    const studentDisplayName = activeStudent?.name || lesson.studentName || 'الطالب';
    const activeStudentCode = activeStudent ? getStudentCode(activeStudent) : (lesson.studentId ? getStudentCode({ id: lesson.studentId, name: lesson.studentName || '' }) : '');
    const explicitGender = activeStudent ? (activeStudent.gender || lesson.report?.studentPerformance?.[activeStudent.id]?.gender) : undefined;
    const isFemale = isLikelyFemaleStudent(studentDisplayName, explicitGender);
    const studentRoleLabel = isFemale ? 'الطالبة' : 'الطالب';

    if (activeStudent) {
      const stAtt = lesson.report?.studentAttendance?.[activeStudent.id] || lesson.report?.attendanceStatus || 'present';
      if (stAtt === 'absent') {
        attendanceAlert = '❌ تنبيه: غياب عن الحصة';
      } else if (stAtt === 'late') {
        attendanceAlert = '⚠️ تنبيه: حضور متأخر';
      }

      const hwDone = lesson.report?.studentHomeworkDone?.[activeStudent.id];
      homeworkOption = hwDone === 'yes' ? 'تم الحل بالكامل 👍' : hwDone === 'no' ? 'لم يتم الحل 👎' : 'غير محدد';

      const dictationGrade = lesson.report?.studentDictationGrade?.[activeStudent.id];
      const hasDictation = dictationGrade !== undefined && dictationGrade !== null && dictationGrade !== -1;
      dictationScore = hasDictation ? `${dictationGrade} / 10` : 'مكانش فيه';

      const examGrade = lesson.report?.studentExamGrade?.[activeStudent.id];
      const hasExam = examGrade !== undefined && examGrade !== null && examGrade !== -1;
      examScore = hasExam ? `${examGrade} / 10` : 'مكانش فيه';

      studentNote = lesson.report?.studentNotes?.[activeStudent.id] || '';
      perfFeedback = lesson.report?.studentPerformance?.[activeStudent.id]?.generatedFeedback?.parent || '';
    } else {
      const rawAtt = lesson.report?.attendanceStatus || 'present';
      if (rawAtt === 'absent') {
        attendanceAlert = '❌ تنبيه: غياب عن الحصة';
      } else if (rawAtt === 'late') {
        attendanceAlert = '⚠️ تنبيه: حضور متأخر';
      }
    }

    const dayName = getLessonArabicDay(lesson.date, lesson.dayOfWeek);
    const dateFormatted = formatArabicDate(lesson.date);
    const timeFormatted = formatArabicTime(lesson.time);

    const dayDateLine = dayName && dateFormatted 
      ? `📅 اليوم: ${dayName} (${dateFormatted})`
      : dayName 
        ? `📅 اليوم: ${dayName}`
        : dateFormatted 
          ? `📅 التاريخ: ${dateFormatted}` 
          : '';

    const timeLine = timeFormatted ? `⏰ الساعة: ${timeFormatted}` : '';
    const cycleLine = hasCycle ? `🔢 رقم الحصة: الحصة (${currentSessionNumber} من ${totalCycleSessions})` : '';
    const codeLine = activeStudentCode ? `🔑 كود الطالب للمتابعة: *${activeStudentCode}*` : '';

    const taughtToday = lesson.report?.arabicTopicsExplained || lesson.report?.teacherNotes || lesson.topic || 'لم يحدد بعد';
    const nextHomework = lesson.report?.arabicHomeworkRequired || lesson.report?.homeworkDescription || (lesson.report?.homeworkTitle ? `${lesson.report.homeworkTitle}` : 'لا يوجد واجب');
    const cleanStudentNote = studentNote.trim();

    const teacherArName = getTeacherArabicName(profile, 'المعلم');
    const hasPrefix = /^(أ\.|أ\/|أستاذ|الأستاذ|د\.|د\/|دكتور|م\.|م\/|مهندس)/.test(teacherArName);
    const teacherSig = hasPrefix ? teacherArName : `أ. ${teacherArName}`;

    const notesSection = cleanStudentNote ? `\n\n📌 ملاحظات المعلم:\n• ${cleanStudentNote}` : '';
    const recordingSection = formatRecordingsArabic(recordingLink, recordingLink2);
    const alertSection = attendanceAlert ? `\n\n${attendanceAlert}` : '';

    // EGYPTIAN DIALECT FORMULA (صيغة مصرية راقية ومحبوبة لأولياء الأمور)
    if (reportStyle === 'egyptian') {
      const egyptianGreetings = [
        'مساء الخير يا فندم 👋',
        'أهلاً بحضرتك يا فندم 👋',
        'السلام عليكم ورحمة الله وبركاته يا فندم 👋',
        'تحياتي لحضرتك يا فندم 👋',
        'أهلاً بولي أمر الطالبة/الطالب العزيز 👋'
      ];
      const selectedGreeting = egyptianGreetings[styleSeed % egyptianGreetings.length];
      
      const egyptianIntros = [
        `حبينا نبلغ حضرتك بتقرير حصة الألماني لـ ${studentRoleLabel} *${studentDisplayName}* اليوم 🇩🇪:`,
        `تقرير حصة الألماني اليوم لـ ${studentRoleLabel} *${studentDisplayName}* 🇩🇪:`,
        `ملخص حصة الألماني ومستوى ${studentRoleLabel} *${studentDisplayName}* اليوم 🇩🇪:`,
        `تفاصيل ومتابعة حصة الألماني لـ ${studentRoleLabel} *${studentDisplayName}* النهارده 🇩🇪:`,
        `تقرير ومتابعة أداء ${studentRoleLabel} *${studentDisplayName}* في حصة الألماني 🇩🇪:`
      ];
      const selectedIntro = egyptianIntros[styleSeed % egyptianIntros.length];

      const egyptianOutros = [
        `شكراً لمتابعة حضرتك واهتمامك الدائم 🌸\nمع تحيات: *${teacherSig}* 🇩🇪`,
        `شكراً جزيلاً لتعاونكم ومتابعتكم المستمرة 🌸\nمع أطيب التحيات: *${teacherSig}* 🇩🇪`,
        `خالص الشكر والتقدير لحضرتك على المتابعة والحرص 🌸\nمع تحيات: *${teacherSig}* 🇩🇪`,
        `ربنا يبارك فيه/فيها وتمنياتنا بدوام التميز والتفوق 🌸\nمع تحيات: *${teacherSig}* 🇩🇪`
      ];
      const selectedOutro = egyptianOutros[styleSeed % egyptianOutros.length];

      const prevHwEgyptian = previousHomework.trim()
        ? `• الواجب كان: ${previousHomework.trim()}\n• حالة الحل: ${homeworkOption}`
        : homeworkOption;

      const generated = `${selectedGreeting}
${selectedIntro}
${[dayDateLine, timeLine, cycleLine, codeLine].filter(Boolean).join('\n')}

📖 اللي اتشرح النهاردة في الحصة:
${taughtToday}

📝 الواجب المطلوب للمرة الجاية:
${nextHomework}${recordingSection}

📋 حل الواجب السابق:
${prevHwEgyptian}

✍️ درجة الإملاء:
${dictationScore}

🎯 درجة الكويز (Quiz):
${examScore}${notesSection}${perfFeedback ? `\n\n🌟 مستوى وأداء الطالب اليوم:\n• ${perfFeedback}` : ''}${alertSection}

${selectedOutro}`;

      setFinalGeneratedText(generated);
      return;
    }

    // CONCISE FORMULA (صيغة كبسولة سريعة ومختصرة)
    if (reportStyle === 'concise') {
      const prevHwConcise = previousHomework.trim()
        ? `${previousHomework.trim()} (${homeworkOption})`
        : homeworkOption;

      const generated = `🇩🇪 كبسولة تقرير حصة الألماني:
👤 ${studentRoleLabel}: *${studentDisplayName}* ${activeStudentCode ? `(كود: ${activeStudentCode})` : ''}
${dayDateLine} ${timeLine ? `• ${timeLine}` : ''}

📖 ما تم شرحه: ${taughtToday}
📝 الواجب: ${nextHomework}${recordingSection}
📊 التقييم:
• الواجب السابق: ${prevHwConcise}
• الكويز: ${examScore} | الإملاء: ${dictationScore}${alertSection ? `\n• ${attendanceAlert}` : ''}
${perfFeedback ? `🌟 التقييم: ${perfFeedback}` : ''}${cleanStudentNote ? `📌 ملاحظة: ${cleanStudentNote}` : ''}

تحياتي، *${teacherSig}*`;

      setFinalGeneratedText(generated);
      return;
    }

    // STANDARD ARABIC FORMULA (الصيغة الفصحى المنظمة)
    const headerParts = [
      `السلام عليكم ورحمة الله وبركاته 👋`,
      `📊 تقرير متابعة الحصة:`,
      `👤 ${studentRoleLabel}: ${studentDisplayName}`,
      codeLine,
      dayDateLine,
      timeLine,
      cycleLine
    ].filter(Boolean).join('\n');

    const prevHwStandard = previousHomework.trim()
      ? `• موضوع الواجب: ${previousHomework.trim()}\n• حالة الإنجاز: ${homeworkOption}`
      : homeworkOption;

    const generated = `${headerParts}

📖 تم اليوم شرح:
${taughtToday}

📝 الواجب:
${nextHomework}${recordingSection}

📋 الواجب السابق:
${prevHwStandard}

✍️ درجة الإملاء:
${dictationScore}

🎯 درجة الامتحان (Quiz):
${examScore}${notesSection}${perfFeedback ? `\n\n🌟 أداء الحصة:\n• ${perfFeedback}` : ''}${alertSection}

شكراً لكم،
${teacherSig} - معلم اللغة الألمانية 🇩🇪`;

    setFinalGeneratedText(generated);
  }, [
    selectedStudentId,
    lesson.report,
    lesson.sessionNumber,
    lesson.totalSessionsInPackage,
    hasCycle,
    currentSessionNumber,
    totalCycleSessions,
    activeStudent,
    isManualEdited,
    activeTab,
    previousHomework,
    recordingLink,
    recordingLink2,
    reportStyle,
    styleSeed,
    profile.displayName,
    profile.displayNameAr,
    profile.nameAr
  ]);

  const handleCopyText = () => {
    persistRecordings(undefined, undefined, finalGeneratedText);
    navigator.clipboard.writeText(finalGeneratedText);
    setCopied(true);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSend = async () => {
    persistRecordings(undefined, undefined, finalGeneratedText);

    if (activeTab === 'bulk') {
      try {
        await navigator.clipboard.writeText(finalGeneratedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }

      if (groupWhatsAppLink) {
        window.open(groupWhatsAppLink, '_blank');
      } else {
        // Even if no group link registered: copy text and open WhatsApp so user can pick chat
        const url = buildWhatsAppUrl('', finalGeneratedText);
        window.open(url, '_blank');
      }
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      } catch (e) {}
      return;
    }

    const fallbackUrl = buildWhatsAppUrl(parentPhone, finalGeneratedText);
    window.open(fallbackUrl, '_blank');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>تقرير الطالب - DeutschLernen</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 40px; line-height: 1.8; color: #333; }
              .card { border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px; background: #fff; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
              h2 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-top: 0; }
              pre { white-space: pre-wrap; font-size: 15px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>تقرير ولي الأمر 📊</h2>
              <pre>${finalGeneratedText}</pre>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 overflow-hidden"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface border border-surface-border w-full max-w-xl rounded-t-[28px] sm:rounded-2xl shadow-2xl flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden animate-scale-up ${language === 'ar' ? 'text-right' : 'text-left'}`} 
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className={`bg-surface px-3.5 py-2 sm:p-4 border-b border-surface-border flex items-center justify-between shrink-0 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-primary-soft text-primary rounded-lg sm:rounded-xl shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-text-main truncate">
                {t('auto_share_session_report')}
              </h2>
              <div className="text-[10px] sm:text-xs text-text-muted truncate flex items-center gap-1 flex-wrap">
                {associatedGroup ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowGroupProfile(true);
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    title={_t('انقر لفتح قائمة وبيانات المجموعة', 'Click to open group details & profile', 'Klicken, um Gruppendetails zu öffnen')}
                  >
                    <span>{associatedGroup.name}</span>
                    <Users className="w-3 h-3 opacity-80" />
                  </button>
                ) : (
                  <span>{lesson.title}</span>
                )}
                {lesson.grade ? <span>• {lesson.grade}</span> : null}
                {hasCycle ? <span>• الحصة {currentSessionNumber}/{totalCycleSessions}</span> : null}
                {lesson.date ? <span>• {lesson.date}</span> : null}
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 sm:p-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-text-muted hover:text-text-main transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5 overflow-y-auto flex-1 min-h-0">
          
          {/* Group Toggle Tab (Only if multiple students in the group) */}
          {isGroupLesson && (
            <div className="grid grid-cols-2 gap-2 bg-slate-100/80 dark:bg-slate-900/40 p-1 rounded-xl border border-surface-border">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('bulk');
                  setIsManualEdited(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'bulk'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-500" />
                <span>{t('auto_bulk_group_report_groups')}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('individual');
                  setIsManualEdited(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'individual'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <User className="w-4 h-4 text-primary" />
                <span>{t('auto_individual_student_report')}</span>
              </button>
            </div>
          )}

          {/* Student Selection List (For individual reports) */}
          {activeTab === 'individual' && groupStudents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-text-main block">
                  {t('auto_select_a_student_to_preview')}
                </label>
                <span className="text-[10px] font-bold text-primary bg-primary-soft px-2 py-0.5 rounded-full">
                  {groupStudents.length} طلاب
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 sm:max-h-28 overflow-y-auto p-1.5 bg-surface-hover/50 rounded-xl border border-surface-border/50">
                {groupStudents.map(st => {
                  const isSelected = selectedStudentId === st.id;
                  const stAtt = lesson.report?.studentAttendance?.[st.id] || 'present';
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudentId(st.id);
                        setIsManualEdited(false);
                      }}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-primary border-primary text-white shadow-xs'
                          : 'bg-surface border-surface-border text-text-muted hover:text-text-main hover:bg-slate-50'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{st.name}</span>
                      <span className={`text-[9px] px-1 rounded ${
                        isSelected 
                          ? 'bg-white/20 text-white' 
                          : stAtt === 'present' ? 'text-emerald-600 bg-emerald-50' : stAtt === 'late' ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                      }`}>
                        {stAtt === 'present' ? '✓' : stAtt === 'late' ? '!' : '✕'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Report Metadata */}
          {activeTab === 'individual' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 bg-primary-soft/40 p-3 sm:p-3.5 rounded-xl border border-primary-border/40 text-xs">
              <div>
                <span className="text-text-muted font-bold block mb-0.5">{t('auto_student')}</span>
                <span className="font-extrabold text-text-main text-xs sm:text-[13px] truncate block">
                  {activeStudent?.name || lesson.studentName || t('auto_not_specified')}
                </span>
                {activeStudent?.grade && (
                  <span className="text-[10px] text-primary font-bold">
                    {activeStudent.grade}
                  </span>
                )}
              </div>

              {/* Student Code for Parent Portal */}
              {activeStudent && (
                <div>
                  <span className="text-text-muted font-bold block mb-0.5">
                    {_t('كود الطالب (المنصة)', 'Student Code (Portal)', 'Schüler-Code')}
                  </span>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 px-2 py-0.5 rounded-lg text-xs">
                      {getStudentCode(activeStudent)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(getStudentCode(activeStudent));
                        setCopiedCodeInModal(true);
                        setTimeout(() => setCopiedCodeInModal(false), 2000);
                      }}
                      className="p-1 hover:bg-primary-soft rounded-md transition-colors cursor-pointer text-indigo-600 dark:text-indigo-400"
                      title={_t('نسخ كود الطالب', 'Copy student code', 'Code kopieren')}
                    >
                      {copiedCodeInModal ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span className="text-text-muted font-bold block mb-0.5">
                  {resolvedContact.isUsername 
                    ? (language === 'ar' ? 'يوزر نيم ولي الأمر' : 'Parent Username') 
                    : t('auto_parent_phone_7')}
                </span>
                <div className="font-extrabold text-text-main text-xs sm:text-[13px] truncate" dir="ltr">
                  {resolvedContact.hasContact ? (
                    resolvedContact.isUsername ? (
                      <span className="inline-flex items-center gap-0.5 font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-xs">
                        <AtSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        {cleanWhatsAppUsername(resolvedContact.contact)}
                      </span>
                    ) : (
                      <span className="font-mono text-slate-700 dark:text-slate-200">{resolvedContact.contact}</span>
                    )
                  ) : (
                    <span className="text-text-muted font-normal text-xs">{t('auto_not_registered')}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2.5 sm:p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-text-muted font-bold block mb-0.5">{t('auto_group')}</span>
                  {associatedGroup ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowGroupProfile(true);
                      }}
                      className="font-black text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm hover:underline inline-flex items-center gap-1.5 cursor-pointer text-start"
                      title={_t('انقر لفتح قائمة وبيانات المجموعة', 'Click to open group details & profile', 'Klicken, um Gruppendetails zu öffnen')}
                    >
                      <span>{associatedGroup.name}</span>
                      <Users className="w-3.5 h-3.5 opacity-80" />
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded font-bold">
                        {_t('فتح القائمة', 'Open List', 'Öffnen')}
                      </span>
                    </button>
                  ) : (
                    <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                      {associatedGroup?.name || t('auto_german_group')}
                    </span>
                  )}
                </div>
                {groupWhatsAppLink ? (
                  <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    <span>{t('auto_whatsapp_group_connected')}</span>
                  </span>
                ) : (
                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-md text-[10px] font-black">
                    {_t('سيتم نسخ التقرير وفتح واتساب لاختيار الشات', 'Text copied & WhatsApp opens to pick chat', 'Text kopiert & WhatsApp öffnet')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Previous Homework Section (الواجب السابق) */}
          <div className="space-y-1.5 bg-surface p-2.5 sm:p-3 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <span className="text-xs font-black text-text-main">
                  {_t('الواجب السابق (الذي تمت مراجعته اليوم)', 'Previous Homework (Checked Today)', 'Vorherige Hausaufgabe')}
                </span>
              </div>
              {detectedPreviousHomework && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{_t('تم جلبه تلقائياً من الحصة السابقة', 'Loaded from previous lesson', 'Aus vorheriger Stunde geladen')}</span>
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                value={previousHomework}
                onChange={(e) => {
                  setPreviousHomework(e.target.value);
                  setIsManualEdited(false);
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-surface-hover hover:bg-slate-50 focus:bg-white border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/60 text-right font-medium"
                placeholder={_t('اكتب كان إيه الواجب السابق هنا (مثلاً: حل صـ 25 وتدريبات القواعد)...', 'Enter previous homework details...', 'Vorherige Hausaufgabe hier eingeben...')}
              />
              {previousHomework && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviousHomework('');
                    setIsManualEdited(false);
                  }}
                  className="absolute left-2 p-1 text-text-muted hover:text-red-500 rounded transition-colors cursor-pointer"
                  title={_t('مسح', 'Clear', 'Löschen')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Lecture / Session Recording Links */}
          <div className="space-y-1.5 bg-surface p-2.5 sm:p-3 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Video className="w-4 h-4 text-primary" />
                <span className="text-xs font-black text-text-main">
                  {_t('روابط تسجيل الحصة', 'Session Recordings', 'Aufnahmelinks der Lektion')}
                </span>
              </div>

              {/* Open Grain Button */}
              <a
                href="https://grain.com/app/meetings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Open Grain Meetings"
              >
                <ExternalLink className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>Open Grain</span>
              </a>
            </div>

            {/* Part 1 Recording Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
                <div className="flex items-center gap-1.5">
                  <span>{_t('التسجيل الأول (الجزء 1)', 'Recording 1 (Part 1)', 'Aufnahme 1 (Teil 1)')}</span>
                  {autoSavedNotice && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1 animate-scale-up font-bold">
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                      <span>{_t('تم الحفظ في القوائم تلقائياً ✓', 'Saved to lists ✓', 'Gespeichert ✓')}</span>
                    </span>
                  )}
                </div>
                {!showRecordingLink2 && !recordingLink2 && (
                  <button
                    type="button"
                    onClick={() => setShowRecordingLink2(true)}
                    className="text-[10px] font-black text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{_t('+ إضافة تسجيل ثانٍ للحصة', '+ Add Part 2 Recording', '+ Teil 2 hinzufügen')}</span>
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="url"
                  value={recordingLink}
                  onChange={(e) => {
                    setRecordingLink(e.target.value);
                    setIsManualEdited(false);
                  }}
                  className="w-full pl-3 pr-16 py-2 bg-surface-hover hover:bg-slate-50 focus:bg-white border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/50 font-mono text-left"
                  placeholder="https://... (Grain, Zoom, YouTube, Drive)"
                  dir="ltr"
                />
                {recordingLink.trim() && (
                  <div className="absolute right-2 flex items-center gap-1">
                    <a
                      href={recordingLink.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-primary hover:text-primary-hover hover:bg-primary-soft rounded transition-colors"
                      title={_t('فتح الرابط والتأكد منه', 'Open & Test Link', 'Link testen')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordingLink('');
                        setIsManualEdited(false);
                      }}
                      className="p-1 text-text-muted hover:text-red-500 rounded transition-colors"
                      title={_t('مسح', 'Clear', 'Löschen')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Part 2 Recording Input */}
            {(showRecordingLink2 || recordingLink2.trim()) && (
              <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-surface-border">
                <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
                  <span>{_t('التسجيل الثاني (الجزء 2)', 'Recording 2 (Part 2)', 'Aufnahme 2 (Teil 2)')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingLink2('');
                      setShowRecordingLink2(false);
                      setIsManualEdited(false);
                    }}
                    className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>{_t('إلغاء الجزء الثاني', 'Remove Part 2', 'Teil 2 entfernen')}</span>
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="url"
                    value={recordingLink2}
                    onChange={(e) => {
                      setRecordingLink2(e.target.value);
                      setIsManualEdited(false);
                    }}
                    className="w-full pl-3 pr-16 py-2 bg-surface-hover hover:bg-slate-50 focus:bg-white border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/50 font-mono text-left"
                    placeholder="https://... (Grain, Zoom, YouTube, Drive - Part 2)"
                    dir="ltr"
                  />
                  {recordingLink2.trim() && (
                    <div className="absolute right-2 flex items-center gap-1">
                      <a
                        href={recordingLink2.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-primary hover:text-primary-hover hover:bg-primary-soft rounded transition-colors"
                        title={_t('فتح الرابط والتأكد منه', 'Open & Test Link', 'Link testen')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setRecordingLink2('');
                          setIsManualEdited(false);
                        }}
                        className="p-1 text-text-muted hover:text-red-500 rounded transition-colors"
                        title={_t('مسح', 'Clear', 'Löschen')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview & Editor Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>{t('auto_preview_edit_message')}</span>
              </label>

              {/* Style selector and re-roll button */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="inline-flex items-center p-0.5 bg-surface border border-surface-border rounded-lg shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setReportStyle('egyptian');
                      setIsManualEdited(false);
                    }}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all ${
                      reportStyle === 'egyptian'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    🇪🇬 مصري راقي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportStyle('standard');
                      setIsManualEdited(false);
                    }}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all ${
                      reportStyle === 'standard'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    📜 فصحى
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportStyle('concise');
                      setIsManualEdited(false);
                    }}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all ${
                      reportStyle === 'concise'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    ⚡ مختصر
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStyleSeed(prev => prev + 1);
                    setIsManualEdited(false);
                  }}
                  className="px-2 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 text-primary border border-surface-border rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                  title="تغيير صياغة التقرير"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>صيغة أخرى</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyText();
                  }}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer ml-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t('auto_copied') : t('auto_copy_text')}</span>
                </button>
              </div>
            </div>

            <textarea
              value={finalGeneratedText}
              onChange={(e) => {
                setFinalGeneratedText(e.target.value);
                setIsManualEdited(true);
              }}
              className="w-full h-28 sm:h-36 bg-surface-hover/80 border border-surface-border rounded-xl p-2.5 sm:p-3 text-xs font-semibold leading-relaxed text-text-main focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none font-sans"
            />
          </div>

        </div>

        {/* Footer Actions - Guaranteed visible and accessible */}
        <div className="p-2.5 sm:p-3 bg-surface border-t border-surface-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 pb-[max(12px,env(safe-area-inset-bottom,12px))] shadow-lg z-10">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {activeTab === 'bulk' ? (
              <button
                id="send-whatsapp-group-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppSend();
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[42px]"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {groupWhatsAppLink
                    ? t('auto_send_to_whatsapp_group')
                    : _t('إرسال عبر واتساب (اختر الشات)', 'Send via WhatsApp', 'Über WhatsApp senden')}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppSend();
                }}
                className="flex-1 bg-primary hover:bg-primary-hover active:scale-95 text-white font-black text-xs py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[42px]"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {t('auto_send_via_whatsapp')} ({activeStudent?.name || 'الطالب'})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrint();
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-bold text-xs py-2.5 sm:py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-surface-border min-h-[42px] shrink-0"
              title={t('auto_print')}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{t('auto_print')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'individual' && resolvedContact.hasContact && !resolvedContact.isUsername && (
              <a
                href={`tel:${resolvedContact.contact}`}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-bold text-xs py-2.5 sm:py-3 px-3 sm:px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-surface-border min-h-[42px]"
                title={t('auto_phone_call')}
              >
                <Phone className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">{t('auto_phone_call')}</span>
              </a>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                persistRecordings(undefined, undefined, finalGeneratedText);
                if (onGoToHomeScreen) {
                  onGoToHomeScreen();
                } else {
                  onClose();
                }
              }}
              className="flex-1 sm:flex-initial bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 min-h-[42px]"
            >
              <Home className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('auto_go_to_homescreen')}</span>
            </button>
          </div>
        </div>

      </div>

      {showGroupProfile && associatedGroup && (
        <GroupProfileModal
          group={associatedGroup}
          onClose={() => setShowGroupProfile(false)}
        />
      )}
    </div>
  );
};
