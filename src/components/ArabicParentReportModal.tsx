import { App as CapacitorApp } from '@capacitor/app';
import React, { useState, useEffect } from 'react';
import { Lesson, Student, TeacherProfile } from '../types';
import { useApp } from '../context/AppContext';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername, formatContactDisplay } from '../utils/phoneUtils';
import { getTeacherArabicName } from '../utils/teacherUtils';
import { formatTimeDisplay, parseLocalDate } from '../utils/timeUtils';
import { isLikelyFemaleStudent, getStudentRoleLabel, getArabicAttendanceString } from '../utils/genderUtils';
import { 
  X, Copy, Check, Send, Phone, Printer, Sparkles, User, MessageSquare, Users, Link2, Home, AtSign, Video, ExternalLink, Plus, RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const { students, groups, _t, language, t } = useApp();
  const [copied, setCopied] = useState(false);

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

  const parentName = activeStudent?.parentName || lesson.quickParentName || activeStudent?.name || lesson.studentName || 'ولي الأمر المحترم';
  
  // Resolve contact with smart fallback: phone or username
  const resolvedContact = resolveStudentWhatsAppContact(activeStudent, {
    quickParentPhone: lesson.quickParentPhone,
    quickStudentPhone: lesson.quickStudentPhone
  });
  const parentPhone = resolvedContact.contact;

  // Editable generated report
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

      let text = `${selectedGreeting}
📊 تقرير حصة الألماني لمجموعة: *${groupTitle}* 🇩🇪
${[dayDateLine, timeLine, cycleLine].filter(Boolean).join('\n')}

📖 اللي اتشرح النهاردة في الحصة:
${taughtToday}

📝 الواجب المطلوب من كل الطلاب:
${nextHomework}${recordingSection}

----------------------------------
👥 كشف حضور الطلاب:
`;

      if (groupStudents.length > 0) {
        groupStudents.forEach((st) => {
          const stAtt = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
          const attendanceArabic = stAtt === 'present' ? 'حاضر ✅' : stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
          text += `• ${st.name}: ${attendanceArabic}\n`;
        });
      } else {
        const rawAtt = lesson.report?.attendanceStatus || 'present';
        const attendanceArabic = rawAtt === 'present' ? 'حاضر ✅' : rawAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
        text += `• ${lesson.studentName || 'الطالب'}: ${attendanceArabic}\n`;
      }

      text += `\nشكراً لمتابعتكم الكريمة واهتمامكم المستمر 🌸\nمع تحيات: *${teacherSig}* 🇩🇪`;
      return text;
    }

    if (reportStyle === 'concise') {
      let text = `⚡ تقرير سريع - ${associatedGroup?.name || lesson.title || 'حصة ألماني'} 🇩🇪
${dayDateLine} ${timeLine ? `• ${timeLine}` : ''}

📌 ما تم شرحه: ${taughtToday}
📝 الواجب المقرر: ${nextHomework}${recordingSection}

👥 الحضور:
`;
      if (groupStudents.length > 0) {
        groupStudents.forEach((st) => {
          const stAtt = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
          const attendanceArabic = stAtt === 'present' ? 'حاضر ✅' : stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
          text += `• ${st.name}: ${attendanceArabic}\n`;
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

    let text = `${headerParts}

📖 تم اليوم شرح:
${taughtToday}

📝 الواجب لجميع الطلاب:
${nextHomework}${recordingSection}

----------------------------------
👥 حضور الطلاب:
`;

    if (groupStudents.length > 0) {
      groupStudents.forEach((st) => {
        const stAtt = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
        const attendanceArabic = stAtt === 'present' ? 'حاضر ✅' : stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
        text += `• ${st.name}: ${attendanceArabic}\n`;
      });
    } else {
      const rawAtt = lesson.report?.attendanceStatus || 'present';
      const attendanceArabic = rawAtt === 'present' ? 'حاضر ✅' : rawAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
      text += `• ${lesson.studentName || 'الطالب'}: ${attendanceArabic}\n`;
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

    let attendanceArabic = 'حاضر ✅';
    let homeworkOption = 'غير محدد';
    let dictationScore = 'لا يوجد إملاء';
    let examScore = 'لا يوجد اختبار';
    let studentNote = '';
    let perfFeedback = '';

    const studentDisplayName = activeStudent?.name || lesson.studentName || 'الطالب';
    const explicitGender = activeStudent ? (activeStudent.gender || lesson.report?.studentPerformance?.[activeStudent.id]?.gender) : undefined;
    const isFemale = isLikelyFemaleStudent(studentDisplayName, explicitGender);
    const studentRoleLabel = isFemale ? 'الطالبة' : 'الطالب';

    if (activeStudent) {
      const stAtt = lesson.report?.studentAttendance?.[activeStudent.id] || lesson.report?.attendanceStatus || 'present';
      attendanceArabic = getArabicAttendanceString(stAtt, isFemale ? 'female' : 'male');

      const hwDone = lesson.report?.studentHomeworkDone?.[activeStudent.id];
      homeworkOption = hwDone === 'yes' ? 'تم الحل بالكامل 👍' : hwDone === 'no' ? 'لم يتم الحل 👎' : 'غير محدد';

      const dictationGrade = lesson.report?.studentDictationGrade?.[activeStudent.id];
      dictationScore = dictationGrade !== undefined ? `${dictationGrade} / 10` : 'لا يوجد إملاء';

      const examGrade = lesson.report?.studentExamGrade?.[activeStudent.id];
      examScore = examGrade !== undefined ? `${examGrade} / 10` : 'لا يوجد اختبار';

      studentNote = lesson.report?.studentNotes?.[activeStudent.id] || '';
      perfFeedback = lesson.report?.studentPerformance?.[activeStudent.id]?.generatedFeedback?.parent || '';
    } else {
      const rawAtt = lesson.report?.attendanceStatus || 'present';
      attendanceArabic = getArabicAttendanceString(rawAtt, isFemale ? 'female' : 'male');
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

    const taughtToday = lesson.report?.arabicTopicsExplained || lesson.report?.teacherNotes || lesson.topic || 'لم يحدد بعد';
    const nextHomework = lesson.report?.arabicHomeworkRequired || lesson.report?.homeworkDescription || (lesson.report?.homeworkTitle ? `${lesson.report.homeworkTitle}` : 'لا يوجد واجب');
    const cleanStudentNote = studentNote.trim();

    const teacherArName = getTeacherArabicName(profile, 'المعلم');
    const hasPrefix = /^(أ\.|أ\/|أستاذ|الأستاذ|د\.|د\/|دكتور|م\.|م\/|مهندس)/.test(teacherArName);
    const teacherSig = hasPrefix ? teacherArName : `أ. ${teacherArName}`;

    const notesSection = cleanStudentNote ? `\n\n📌 ملاحظات المعلم:\n• ${cleanStudentNote}` : '';
    const recordingSection = formatRecordingsArabic(recordingLink, recordingLink2);

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

      const generated = `${selectedGreeting}
${selectedIntro}
${[dayDateLine, timeLine, cycleLine].filter(Boolean).join('\n')}

📖 اللي اتشرح النهاردة في الحصة:
${taughtToday}

📝 الواجب المطلوب للمرة الجاية:
${nextHomework}${recordingSection}

✅ الحضور:
${attendanceArabic}

📋 حل الواجب السابق:
${homeworkOption}

✍️ درجة الإملاء:
${dictationScore}

🎯 درجة الكويز (Quiz):
${examScore}${notesSection}${perfFeedback ? `\n\n🌟 مستوى وأداء الطالب اليوم:\n• ${perfFeedback}` : ''}

${selectedOutro}`;

      setFinalGeneratedText(generated);
      return;
    }

    // CONCISE FORMULA (صيغة كبسولة سريعة ومختصرة)
    if (reportStyle === 'concise') {
      const generated = `🇩🇪 كبسولة تقرير حصة الألماني:
👤 ${studentRoleLabel}: *${studentDisplayName}*
${dayDateLine} ${timeLine ? `• ${timeLine}` : ''}

📖 ما تم شرحه: ${taughtToday}
📝 الواجب: ${nextHomework}${recordingSection}
📊 التقييم:
• الحضور: ${attendanceArabic}
• الواجب السابق: ${homeworkOption}
• الكويز: ${examScore} | الإملاء: ${dictationScore}
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
      dayDateLine,
      timeLine,
      cycleLine
    ].filter(Boolean).join('\n');

    const generated = `${headerParts}

📖 تم اليوم شرح:
${taughtToday}

📝 الواجب:
${nextHomework}${recordingSection}

✅ الحضور:
${attendanceArabic}

📋 الواجب السابق:
${homeworkOption}

✍️ درجة الإملاء:
${dictationScore}

🎯 درجة الامتحان (Quiz):
${examScore}${notesSection}${perfFeedback ? `\n\n🌟 أداء الحصة:\n• ${perfFeedback}` : ''}

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
    recordingLink,
    recordingLink2,
    reportStyle,
    styleSeed,
    profile.displayName,
    profile.displayNameAr,
    profile.nameAr
  ]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(finalGeneratedText);
    setCopied(true);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSend = async () => {
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface border border-surface-border w-full max-w-xl rounded-t-[28px] sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden animate-scale-up ${language === 'ar' ? 'text-right' : 'text-left'}`} 
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className={`bg-surface p-4 sm:p-5 border-b border-surface-border flex items-center justify-between shrink-0 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-primary-soft text-primary rounded-xl shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-text-main">
                {t('auto_share_session_report')}
              </h2>
              <p className="text-xs text-text-muted">
                {lesson.title} {lesson.grade ? `• ${lesson.grade}` : ''} {hasCycle ? `• الحصة ${currentSessionNumber}/${totalCycleSessions}` : ''} {lesson.date ? `• ${lesson.date}` : ''}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 sm:p-2 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-text-muted hover:text-text-main transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 min-h-0">
          
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
            <div className="grid grid-cols-2 gap-2 sm:gap-3 bg-primary-soft/40 p-3 sm:p-3.5 rounded-xl border border-primary-border/40 text-xs">
              <div>
                <span className="text-text-muted font-bold block mb-0.5">{t('auto_student')}</span>
                <span className="font-extrabold text-text-main text-xs sm:text-[13px] truncate block">
                  {activeStudent?.name || lesson.studentName || t('auto_not_specified')}
                </span>
              </div>
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
            <div className="p-3 sm:p-3.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-text-muted font-bold block mb-0.5">{t('auto_group')}</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                    {associatedGroup?.name || t('auto_german_group')}
                  </span>
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

          {/* Lecture / Session Recording Links */}
          <div className="space-y-2 bg-surface p-3 sm:p-3.5 rounded-xl border border-surface-border">
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
                <span>{_t('التسجيل الأول (الجزء 1)', 'Recording 1 (Part 1)', 'Aufnahme 1 (Teil 1)')}</span>
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
              className="w-full h-32 sm:h-44 bg-surface-hover/80 border border-surface-border rounded-xl p-3 sm:p-4 text-xs font-semibold leading-relaxed text-text-main focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none font-sans"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-surface border-t border-surface-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0 pb-safe-bottom sm:pb-4">
          <div className="flex items-center gap-2 flex-1">
            {activeTab === 'bulk' ? (
              <button
                id="send-whatsapp-group-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppSend();
                }}
                className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[42px]"
              >
                <Send className="w-4 h-4" />
                <span>
                  {groupWhatsAppLink
                    ? t('auto_send_to_whatsapp_group')
                    : _t('نسخ وفتح واتساب (اختر الشات)', 'Copy & Open WhatsApp', 'Kopieren & WhatsApp öffnen')}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppSend();
                }}
                className="flex-1 sm:flex-initial bg-primary hover:bg-primary-hover active:scale-95 text-white font-black text-xs py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[42px]"
              >
                <Send className="w-4 h-4" />
                <span>
                  {t('auto_send_via_whatsapp')} ({activeStudent?.name || 'الطالب'})
                  {resolvedContact.isUsername ? ` (${resolvedContact.display})` : ''}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrint();
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-bold text-xs py-2.5 sm:py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-surface-border min-h-[42px]"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{t('auto_print')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'individual' && resolvedContact.hasContact && !resolvedContact.isUsername && (
              <a
                href={`tel:${resolvedContact.contact}`}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-bold text-xs py-2.5 sm:py-3 px-3 sm:px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-surface-border min-h-[42px]"
              >
                <Phone className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">{t('auto_phone_call')}</span>
              </a>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onSaveReport) {
                  onSaveReport(finalGeneratedText, { 
                    recordingLink: recordingLink.trim() || undefined,
                    recordingLink2: recordingLink2.trim() || undefined
                  });
                }
                if (onGoToHomeScreen) {
                  onGoToHomeScreen();
                } else {
                  onClose();
                }
              }}
              className="flex-1 sm:flex-initial bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 min-h-[42px]"
            >
              <Home className="w-4 h-4" />
              <span>{t('auto_go_to_homescreen')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
