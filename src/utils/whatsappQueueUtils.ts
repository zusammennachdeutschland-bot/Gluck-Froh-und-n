import { Lesson, Student, TeacherProfile, Group } from '../types';
import { getTeacherArabicName, getTeacherEnglishName } from './teacherUtils';
import { formatTimeDisplay, parseLocalDate, getLocalDateStr, formatLocalDate } from './timeUtils';
import { isLikelyFemaleStudent } from './genderUtils';
import { resolveTaughtTodayTopic, resolveReportHomework, resolvePreviousHomeworkStatusText, resolveStudentReportAttendance } from './lessonUtils';
import { getCairoHour, getTimeBasedGreeting } from './greetingUtils';
import { resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername } from './phoneUtils';

export type QueueTemplateType = 'egyptian' | 'streamlined' | 'standard' | 'reminder' | 'custom';

export interface QueueProgressState {
  sentStudentIds: string[];
  skippedStudentIds: string[];
  timestamps: Record<string, string>; // studentId -> '10:35 ص'
  lastActiveStudentId?: string;
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function getArabicDayFromDate(dateStr?: string, fallbackDay?: string): string {
  if (dateStr) {
    try {
      const d = parseLocalDate(dateStr);
      const dayIdx = d.getDay();
      if (dayIdx >= 0 && dayIdx < 7) {
        return ARABIC_DAYS[dayIdx];
      }
    } catch {}
  }
  if (fallbackDay) {
    const map: Record<string, string> = {
      sunday: 'الأحد', monday: 'الإثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء',
      thursday: 'الخميس', friday: 'الجمعة', saturday: 'السبت',
      sonntag: 'الأحد', montag: 'الإثنين', dienstag: 'الثلاثاء', mittwoch: 'الأربعاء',
      donnerstag: 'الخميس', freitag: 'الجمعة', samstag: 'السبت'
    };
    const clean = fallbackDay.toLowerCase().trim();
    if (map[clean]) return map[clean];
  }
  return '';
}

export function formatArabicDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
}

export function formatArabicTimeDisplay(timeStr?: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('م') || timeStr.includes('ص')) return timeStr;
  if (timeStr.includes('-')) {
    const parts = timeStr.split('-').map(s => s.trim());
    return parts.map(p => formatTimeDisplay(p, 'ar')).join(' - ');
  }
  return formatTimeDisplay(timeStr, 'ar');
}

/**
 * Builds the exact personalized message for a student in the WhatsApp dispatch queue.
 */
export function buildQueueMessageForStudent(
  student: Student,
  lesson: Lesson,
  profile: TeacherProfile,
  options: {
    templateType: QueueTemplateType;
    customTemplate?: string;
    language?: 'ar' | 'en' | 'de';
    group?: Group;
    currentSessionNumber?: number;
    totalCycleSessions?: number;
    targetRecipient?: 'parent' | 'student';
    onlineHomeworkTitle?: string;
    onlineHomeworkShareUrl?: string | null;
    previousOnlineResultLines?: string[];
  }
): string {
  const {
    templateType,
    customTemplate = '',
    language = 'ar',
    group,
    currentSessionNumber = lesson.sessionNumber || 1,
    totalCycleSessions = 4,
    targetRecipient = 'parent',
    onlineHomeworkTitle = '',
    onlineHomeworkShareUrl = null,
    previousOnlineResultLines = []
  } = options;

  const isMorning = getCairoHour() < 12;
  const isLessonToday = Boolean(lesson.date && lesson.date === getLocalDateStr());
  const dayName = getArabicDayFromDate(lesson.date, (lesson as any).dayOfWeek);
  const dateFormatted = formatArabicDateDisplay(lesson.date);
  const timeFormatted = formatArabicTimeDisplay(lesson.time);

  const teacherArName = getTeacherArabicName(profile, 'المعلم');
  const hasPrefix = /^(أ\.|أ\/|أستاذ|الأستاذ|د\.|د\/|دكتور|م\.|م\/|مهندس)/.test(teacherArName);
  const teacherSig = hasPrefix ? teacherArName : `أ. ${teacherArName}`;

  const rawStudent = student as any;
  const englishStudentName = student.certificateName || rawStudent.displayNameEn || rawStudent.nameEn;
  const studentDisplayName = (language === 'de' || language === 'en')
    ? (englishStudentName || student.name || 'Student')
    : (rawStudent.displayNameAr || rawStudent.nameAr || student.name || 'الطالب');
  
  const explicitGender = student.gender || lesson.report?.studentPerformance?.[student.id]?.gender;
  const isFemale = isLikelyFemaleStudent(studentDisplayName, explicitGender);
  const studentRoleLabel = isFemale ? 'الطالبة' : 'الطالب';
  const parentName = student.parentName || 'ولي الأمر المحترم';

  const rawReport = (lesson.report || {}) as any;
  const taughtTodayInfo = resolveTaughtTodayTopic(lesson, lesson.report);
  const taughtToday = taughtTodayInfo.text || rawReport?.topicCovered || rawReport?.topicsExplained || (lesson as any)?.topicCovered || '';
  const homeworkInfo = resolveReportHomework(lesson.report, lesson.report, language === 'en' || language === 'de' ? language : 'ar');
  const baseNextHomework = homeworkInfo.text || rawReport?.homeworkRequired || rawReport?.homeworkDescription || rawReport?.homeworkTitle || '';
  const onlineHwPart = onlineHomeworkShareUrl
    ? `🎯 واجب أونلاين${onlineHomeworkTitle ? `: ${onlineHomeworkTitle}` : ''}\n🔗 رابط الواجب: ${onlineHomeworkShareUrl}`
    : '';
  const nextHomework = [baseNextHomework.trim(), onlineHwPart].filter(Boolean).join('\n');

  // Attendance & grades
  const attStatus = resolveStudentReportAttendance(student.id, lesson, lesson.report?.studentAttendance || {}, lesson.report || {}, true);
  const isAbsent = attStatus === 'absent';
  const isLate = attStatus === 'late';

  const hwDone = lesson.report?.studentHomeworkDone?.[student.id];
  const dictationGrade = lesson.report?.studentDictationGrade?.[student.id];
  const examGrade = lesson.report?.studentExamGrade?.[student.id];
  const studentNote = lesson.report?.studentNotes?.[student.id]?.trim();
  const perfFeedback = lesson.report?.studentPerformance?.[student.id]?.generatedFeedback?.parent?.trim();

  // 1. STREAMLINED REPORT (المنقح: اليوم والتاريخ + اللي اتشرح + الهومورك الجاي فقط)
  if (templateType === 'streamlined') {
    const dayDateLine = dayName && dateFormatted
      ? `📅 اليوم والتاريخ: ${dayName} (${dateFormatted})`
      : dayName
        ? `📅 اليوم: ${dayName}`
        : dateFormatted
          ? `📅 التاريخ: ${dateFormatted}`
          : '';

    const lines: string[] = [];
    if (targetRecipient === 'parent') {
      lines.push(`تقرير حصة ${studentRoleLabel} *${studentDisplayName}* 🇩🇪`);
    } else {
      lines.push(`ملخص حصة الألماني يا *${studentDisplayName}* 🇩🇪`);
    }
    if (dayDateLine) lines.push(dayDateLine);
    if (taughtToday) lines.push(`📖 اللي اتشرح:\n${taughtToday}`);
    if (nextHomework) lines.push(`📝 الهومورك الجاي:\n${nextHomework}`);
    lines.push(`مع تحيات: *${teacherSig}* 🇩🇪`);

    return lines.join('\n\n');
  }

  // 2. NEXT SESSION REMINDER (تذكير بالحصة القادمة)
  if (templateType === 'reminder') {
    const greeting = isMorning ? 'صباح الخير يا فندم 👋' : 'مساء الخير يا فندم 👋';
    const lines = [
      `السلام عليكم ورحمة الله وبركاته، ${greeting}`,
      `🔔 تذكير بموعد حصة الألماني لـ ${studentRoleLabel} *${studentDisplayName}* 🇩🇪`,
      dayName && dateFormatted ? `📅 الموعد: ${dayName} (${dateFormatted})` : dateFormatted ? `📅 التاريخ: ${dateFormatted}` : '',
      timeFormatted ? `⏰ الساعة: ${timeFormatted}` : '',
      group?.name ? `👥 المجموعة: ${group.name}` : '',
      nextHomework ? `\n📝 برجاء التأكيد على حل الواجب:\n${nextHomework}` : '',
      `\nمع أطيب التمنيات بالتفوق والتوفيق 🌟\n*${teacherSig}*`
    ].filter(Boolean);

    return lines.join('\n');
  }

  // 3. CUSTOM TEMPLATE (رسالة مخصصة مع المتغيرات)
  if (templateType === 'custom' && customTemplate.trim()) {
    let text = customTemplate;
    text = text.replace(/\{اسم_الطالب\}/g, studentDisplayName);
    text = text.replace(/\{اسم_ولي_الأمر\}/g, parentName);
    text = text.replace(/\{المجموعة\}/g, group?.name || lesson.title || 'مجموعة الألماني');
    text = text.replace(/\{اسم_المعلم\}/g, teacherSig);
    text = text.replace(/\{التاريخ\}/g, dateFormatted || '');
    text = text.replace(/\{اليوم\}/g, dayName || '');
    text = text.replace(/\{الساعة\}/g, timeFormatted || '');
    text = text.replace(/\{الشرح\}/g, taughtToday || '—');
    text = text.replace(/\{الواجب\}/g, nextHomework || '—');
    text = text.replace(/\{الحالة\}/g, isAbsent ? 'غائب ❌' : isLate ? 'متأخر ⚠️' : 'حاضر ✅');
    return text;
  }

  // 4. STANDARD ARABIC FORMULA (فصيح)
  if (templateType === 'standard') {
    const greeting = isMorning ? 'السلام عليكم ورحمة الله وبركاته، صباح الخير يا فندم 👋' : 'السلام عليكم ورحمة الله وبركاته، مساء الخير يا فندم 👋';
    const intro = `📊 تقرير حصة اللغة الألمانية لـ ${studentRoleLabel}: *${studentDisplayName}* 🇩🇪`;
    const dayDateLine = dayName && dateFormatted ? `📅 تاريخ الحصة: ${dayName} (${dateFormatted})` : dateFormatted ? `📅 التاريخ: ${dateFormatted}` : '';
    const timeLine = timeFormatted ? `⏰ التوقيت: ${timeFormatted}` : '';

    let body = `${greeting}\n${intro}\n${[dayDateLine, timeLine].filter(Boolean).join('\n')}\n`;
    if (isAbsent) {
      body += `\n❌ تنبيه: غياب عن الحصة اليوم.`;
    } else {
      if (isLate) body += `\n⚠️ ملاحظة: حضور متأخر.`;
      if (hwDone) body += `\n📝 الواجب السابق: ${resolvePreviousHomeworkStatusText(hwDone, 'ar')}`;
      if (previousOnlineResultLines.length > 0) body += `\n${previousOnlineResultLines.join('\n')}`;
      if (dictationGrade !== undefined && dictationGrade !== null && dictationGrade !== -1) body += `\n✍️ درجة التسميع / الكويز: ${dictationGrade}/10`;
      if (examGrade !== undefined && examGrade !== null && examGrade !== -1) body += `\n🏆 درجة الامتحان: ${examGrade}/10`;
    }
    if (taughtToday) body += `\n\n📖 ما تم شرحه في الحصة:\n${taughtToday}`;
    if (nextHomework) body += `\n\n📝 الواجب المقرر:\n${nextHomework}`;
    if (studentNote) body += `\n\n📌 ملاحظات المعلم:\n• ${studentNote}`;
    if (perfFeedback) body += `\n\n🌟 تقييم المشاركة:\n${perfFeedback}`;
    body += `\n\nمع خالص التقدير،\n*${teacherSig}* 🇩🇪`;

    return body;
  }

  // 5. EGYPTIAN FRIENDLY FORMULA (الصيغة المصرية المعتمدة المحبوبة)
  const egyptianGreeting = isMorning
    ? 'السلام عليكم ورحمة الله وبركاته، صباح الخير يا فندم 👋'
    : 'السلام عليكم ورحمة الله وبركاته، مساء الخير يا فندم 👋';
  const dayDateLine = dayName && dateFormatted ? `📅 موعد الحصة: ${dayName} (${dateFormatted})` : dateFormatted ? `📅 التاريخ: ${dateFormatted}` : '';
  const timeLine = timeFormatted ? `⏰ الساعة: ${timeFormatted}` : '';

  let body = `${egyptianGreeting}\n📊 تقرير حصة الألماني لـ ${studentRoleLabel} *${studentDisplayName}* 🇩🇪\n`;
  const metaLines = [dayDateLine, timeLine].filter(Boolean);
  if (metaLines.length > 0) body += `${metaLines.join('\n')}\n`;

  if (isAbsent) {
    body += `\n❌ تنبيه: ${studentRoleLabel} كان${isFemale ? 'ت' : ''} غائب${isFemale ? 'ة' : ''} عن الحصة.`;
  } else {
    if (isLate) body += `\n⚠️ تنبيه: حضور متأخر للحصة.`;
    if (hwDone) {
      const hwText = resolvePreviousHomeworkStatusText(hwDone, 'ar');
      body += `\n📝 الهومورك السابق: ${hwText}`;
    }
    if (previousOnlineResultLines.length > 0) {
      body += `\n${previousOnlineResultLines.join('\n')}`;
    }
    if (dictationGrade !== undefined && dictationGrade !== null && dictationGrade !== -1) {
      body += `\n✍️ تسميع الكلمات: ${dictationGrade} من 10`;
    }
    if (examGrade !== undefined && examGrade !== null && examGrade !== -1) {
      body += `\n🏆 امتحان الحصة: ${examGrade} من 10`;
    }
  }

  if (taughtToday) {
    body += `\n\n📖 ${isLessonToday ? 'اللي اتشرح النهارده في الحصة' : 'اللي اتشرح في الحصة'}:\n${taughtToday}`;
  }
  if (nextHomework) {
    body += `\n\n📝 الهومورك المطلوب للحصة الجاية:\n${nextHomework}`;
  }
  if (studentNote) {
    body += `\n\n📌 ملاحظة المعلم:\n• ${studentNote}`;
  }
  if (perfFeedback) {
    body += `\n\n🌟 تقييم أداء ${studentRoleLabel} في الحصة:\n${perfFeedback}`;
  }

  body += `\n\nمع تحيات: *${teacherSig}* 🇩🇪`;
  return body;
}

/**
 * Loads saved queue state from localStorage
 */
export function getSavedQueueProgress(queueKey: string): QueueProgressState {
  try {
    const raw = localStorage.getItem(`gluck_queue_${queueKey}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return { sentStudentIds: [], skippedStudentIds: [], timestamps: {} };
}

/**
 * Persists queue state to localStorage
 */
export function saveQueueProgress(queueKey: string, state: QueueProgressState): void {
  try {
    localStorage.setItem(`gluck_queue_${queueKey}`, JSON.stringify(state));
  } catch {}
}

/**
 * Clears saved queue state
 */
export function clearQueueProgress(queueKey: string): void {
  try {
    localStorage.removeItem(`gluck_queue_${queueKey}`);
  } catch {}
}

/**
 * Date helper: Yesterday in local YYYY-MM-DD
 */
export function getYesterdayLocalDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

/**
 * Date helper: 2 days ago in local YYYY-MM-DD
 */
export function getBeforeYesterdayLocalDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return formatLocalDate(d);
}

export interface DispatchedRecord {
  time: string; // e.g. '12:30 م'
  lessonId?: string;
  dateStr?: string;
  target?: 'parent' | 'student' | 'group';
  source: 'queue' | 'session_modal';
  timestamp: number;
}

/**
 * Records that a student's report was dispatched (sent via WhatsApp),
 * synchronizing across the session report modal, the dispatch queue, and localStorage.
 */
export function recordStudentReportDispatched(
  lessonId: string | undefined,
  studentId: string,
  dateStr?: string,
  target: 'parent' | 'student' | 'group' = 'parent',
  source: 'queue' | 'session_modal' = 'session_modal',
  customTimeStr?: string
): void {
  const now = new Date();
  const timeStr = customTimeStr || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const effectiveDate = dateStr || getLocalDateStr();

  const record: DispatchedRecord = {
    time: timeStr,
    lessonId,
    dateStr: effectiveDate,
    target,
    source,
    timestamp: now.getTime()
  };

  try {
    // 1. By student & date (direct index)
    localStorage.setItem(`gluck_dispatched_student_${studentId}_${effectiveDate}`, JSON.stringify(record));

    // 2. By date index
    const dateMapRaw = localStorage.getItem(`gluck_date_dispatched_${effectiveDate}`);
    const dateMap: Record<string, DispatchedRecord> = dateMapRaw ? JSON.parse(dateMapRaw) : {};
    dateMap[studentId] = record;
    localStorage.setItem(`gluck_date_dispatched_${effectiveDate}`, JSON.stringify(dateMap));

    // 3. By lesson index (if lessonId present)
    if (lessonId) {
      const lessonMapRaw = localStorage.getItem(`gluck_lesson_dispatched_${lessonId}`);
      const lessonMap: Record<string, DispatchedRecord> = lessonMapRaw ? JSON.parse(lessonMapRaw) : {};
      lessonMap[studentId] = record;
      localStorage.setItem(`gluck_lesson_dispatched_${lessonId}`, JSON.stringify(lessonMap));

      // Also update standard queue progress for this lesson
      const qState = getSavedQueueProgress(lessonId);
      if (!qState.sentStudentIds.includes(studentId)) {
        qState.sentStudentIds.push(studentId);
      }
      qState.skippedStudentIds = qState.skippedStudentIds.filter(id => id !== studentId);
      qState.timestamps[studentId] = timeStr;
      saveQueueProgress(lessonId, qState);
    }

    // 4. Broadcast window event for live two-way reactive UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gluck_whatsapp_dispatched', {
          detail: { lessonId, studentId, dateStr: effectiveDate, target, timeStr, source }
        })
      );
    }
  } catch (err) {
    console.warn('Error saving dispatched report status:', err);
  }
}

/**
 * Checks whether a student's report was already dispatched for a given lesson or date.
 */
export function isStudentReportDispatched(
  studentId: string,
  context?: {
    lessonId?: string;
    dateStr?: string;
    lessonDispatchedStudents?: Record<string, string>;
  }
): { isSent: boolean; time?: string; source?: 'queue' | 'session_modal'; target?: string } {
  // 1. Check lessonDispatchedStudents on lesson object itself
  if (context?.lessonDispatchedStudents && context.lessonDispatchedStudents[studentId]) {
    return {
      isSent: true,
      time: context.lessonDispatchedStudents[studentId],
      source: 'session_modal'
    };
  }

  const effectiveDate = context?.dateStr || getLocalDateStr();

  // 2. Check lesson dispatched map
  if (context?.lessonId) {
    try {
      const lessonMapRaw = localStorage.getItem(`gluck_lesson_dispatched_${context.lessonId}`);
      if (lessonMapRaw) {
        const lessonMap: Record<string, DispatchedRecord> = JSON.parse(lessonMapRaw);
        if (lessonMap[studentId]) {
          return {
            isSent: true,
            time: lessonMap[studentId].time,
            source: lessonMap[studentId].source,
            target: lessonMap[studentId].target
          };
        }
      }

      // Check saved queue progress for this lesson
      const qState = getSavedQueueProgress(context.lessonId);
      if (qState.sentStudentIds.includes(studentId)) {
        return {
          isSent: true,
          time: qState.timestamps[studentId] || 'سابقاً',
          source: 'queue'
        };
      }
    } catch {}
  }

  // 3. Check date dispatched index
  try {
    const dateMapRaw = localStorage.getItem(`gluck_date_dispatched_${effectiveDate}`);
    if (dateMapRaw) {
      const dateMap: Record<string, DispatchedRecord> = JSON.parse(dateMapRaw);
      if (dateMap[studentId]) {
        return {
          isSent: true,
          time: dateMap[studentId].time,
          source: dateMap[studentId].source,
          target: dateMap[studentId].target
        };
      }
    }

    // 4. Direct student date key
    const directRaw = localStorage.getItem(`gluck_dispatched_student_${studentId}_${effectiveDate}`);
    if (directRaw) {
      const rec: DispatchedRecord = JSON.parse(directRaw);
      return {
        isSent: true,
        time: rec.time,
        source: rec.source,
        target: rec.target
      };
    }
  } catch {}

  return { isSent: false };
}

/**
 * Returns all dispatched students with their send times for a specific date
 */
export function getAllDispatchedStudentsForDate(dateStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(`gluck_date_dispatched_${dateStr}`);
    if (raw) {
      const map: Record<string, DispatchedRecord> = JSON.parse(raw);
      Object.keys(map).forEach(stId => {
        result[stId] = map[stId].time;
      });
    }
  } catch {}
  return result;
}

/**
 * Returns all dispatched students with their send times for a specific lesson
 */
export function getAllDispatchedStudentsForLesson(lessonId: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(`gluck_lesson_dispatched_${lessonId}`);
    if (raw) {
      const map: Record<string, DispatchedRecord> = JSON.parse(raw);
      Object.keys(map).forEach(stId => {
        result[stId] = map[stId].time;
      });
    }
    const qState = getSavedQueueProgress(lessonId);
    qState.sentStudentIds.forEach(stId => {
      if (!result[stId]) {
        result[stId] = qState.timestamps[stId] || 'سابقاً';
      }
    });
  } catch {}
  return result;
}

