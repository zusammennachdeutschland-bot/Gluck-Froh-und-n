import React, { useState, useMemo } from 'react';
import { Lesson, Student, TeacherProfile } from '../types';
import { useApp } from '../context/AppContext';
import { X, Copy, Check, MessageSquare, Phone, Send, Share2, Sparkles, Home, AtSign, BookOpen } from 'lucide-react';
import { ArabicParentReportModal } from './ArabicParentReportModal';
import { ReportLanguageToggle } from './ReportLanguageToggle';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername } from '../utils/phoneUtils';
import { getTeacherEnglishName, getTeacherArabicName } from '../utils/teacherUtils';
import { calculateSequentialSessionNumber, resolveLessonCycleNumber, resolveTaughtTodayTopic } from '../utils/lessonUtils';
import { getTimeBasedGreeting } from '../utils/greetingUtils';
import {
  sanitizeGrainSummaryForParentReport,
  isGrainRecordingUrl,
  normalizeZoomMeetingUrl,
  getLessonRecordingShareClassification,
  sortLessonsNewestFirst,
  buildMultiLessonParentReportData
} from '../services/grainService';

interface ParentSummaryModalProps {
  lesson: Lesson;
  student?: Student;
  profile: TeacherProfile;
  onClose: () => void;
  onGoToHomeScreen?: () => void;
}

export const ParentSummaryModal: React.FC<ParentSummaryModalProps> = ({
  lesson,
  student,
  profile,
  onClose,
  onGoToHomeScreen
}) => {
  const { groups, students, lessons, getFullLessonsSnapshot, reportLanguage, reportT, _t } = useApp();
  const [copied, setCopied] = useState(false);
  const [showArabicModal, setShowArabicModal] = useState(false);
  const [showMultiLessonSelector, setShowMultiLessonSelector] = useState(false);
  const [selectedMultiLessonIds, setSelectedMultiLessonIds] = useState<string[]>([lesson.id]);
  const [multiLessonSearchQuery, setMultiLessonSearchQuery] = useState('');

  const activeStudent = student || 
    students.find(s => (lesson.studentId && s.id === lesson.studentId) || (lesson.studentName && s.name && s.name.trim().toLowerCase() === lesson.studentName.trim().toLowerCase())) || 
    (lesson.groupId ? students.find(s => s.groupId === lesson.groupId) : undefined);

  const report = lesson.report;
  const parentName = activeStudent?.parentName || lesson.quickParentName || (lesson.studentName ? `${lesson.studentName}'s Eltern` : 'Sehr geehrte Eltern');
  
  const resolvedParentContact = resolveStudentWhatsAppContact(activeStudent, {
    quickParentPhone: lesson.quickParentPhone
  });
  const parentPhone = resolvedParentContact.contact;

  const rawStudentPhone = activeStudent?.studentPhone || activeStudent?.studentUsername || lesson.quickStudentPhone || '';
  const isStudentUsername = isWhatsAppUsername(rawStudentPhone);
  const studentPhone = rawStudentPhone.trim();

  const associatedGroup = useMemo(() => {
    return lesson.groupId
      ? groups.find(g => g.id === lesson.groupId)
      : (activeStudent?.groupId ? groups.find(g => g.id === activeStudent.groupId) : undefined);
  }, [lesson.groupId, activeStudent?.groupId, groups]);

  const cycleResolution = useMemo(() => {
    return resolveLessonCycleNumber(lesson, getFullLessonsSnapshot(), {
      group: associatedGroup,
      student: activeStudent,
      students
    });
  }, [lesson, lessons, getFullLessonsSnapshot, associatedGroup, activeStudent, students]);

  // Dynamically compute exact session number excluding cancelled lessons
  const currentSessionNumber = cycleResolution.sessionNumber >= 1 ? cycleResolution.sessionNumber : 1;

  // Rule 4: Teacher review & approval for Grain summary (never included automatically)
  const allGroupStudents = useMemo(() => {
    return lesson.groupId ? students.filter(s => !s.deleted && s.status !== 'archived' && s.groupId === lesson.groupId) : [];
  }, [lesson.groupId, students]);

  const candidateLessonsNewestFirst = useMemo(() => {
    const allList = lessons || [];
    const filtered = allList.filter((l) => {
      if (l.id === lesson.id) return true;
      if (lesson.groupId && l.groupId === lesson.groupId) return true;
      if (activeStudent?.id && (l.studentId === activeStudent.id || l.attendance?.[activeStudent.id] || l.report?.studentAttendance?.[activeStudent.id])) {
        return true;
      }
      return false;
    });
    return sortLessonsNewestFirst(filtered);
  }, [lessons, lesson.id, lesson.groupId, activeStudent?.id]);

  const filteredMultiLessons = useMemo(() => {
    const q = multiLessonSearchQuery.trim().toLowerCase();
    if (!q) return candidateLessonsNewestFirst;
    return candidateLessonsNewestFirst.filter((l) => {
      const topic = resolveTaughtTodayTopic(l, l.report).text || l.title || '';
      return `${l.date || ''} ${l.time || ''} ${topic}`.toLowerCase().includes(q);
    });
  }, [candidateLessonsNewestFirst, multiLessonSearchQuery]);

  const multiLessonReportResult = useMemo(() => {
    if (selectedMultiLessonIds.length <= 1) return null;
    const picked = candidateLessonsNewestFirst.filter((l) => selectedMultiLessonIds.includes(l.id));
    if (picked.length <= 1) return null;
    return buildMultiLessonParentReportData({
      lessons: picked,
      targetStudent: activeStudent || null,
      allGroupStudents,
      language: reportLanguage === 'de' ? 'de' : reportLanguage === 'en' ? 'en' : 'ar'
    });
  }, [selectedMultiLessonIds, candidateLessonsNewestFirst, activeStudent, allGroupStudents, reportLanguage]);

  const rawGrainCandidate =
    lesson.grainMeta?.approvedParentReportSummaryAr ||
    lesson.grainMeta?.approvedSummary ||
    lesson.report?.grainMeta?.approvedParentReportSummaryAr ||
    lesson.report?.grainMeta?.approvedSummary ||
    '';

  const initialSanitizedGrain = useMemo(() => {
    if (!rawGrainCandidate) return '';
    return sanitizeGrainSummaryForParentReport({
      rawSummaryText: rawGrainCandidate,
      targetStudent: activeStudent,
      allGroupStudents,
      language: reportLanguage === 'de' ? 'de' : reportLanguage === 'en' ? 'en' : 'ar'
    });
  }, [rawGrainCandidate, activeStudent, allGroupStudents, reportLanguage]);

  const [editableGrainSummary, setEditableGrainSummary] = useState(initialSanitizedGrain);
  const [approvedGrainSummaryText, setApprovedGrainSummaryText] = useState<string | null>(null);
  const [dismissedGrainSummary, setDismissedGrainSummary] = useState(false);

  // Part 2 (FIX-1): Only include verified public Grain links (never Zoom meeting URLs or non-public links)
  const getSafeParentLink = (rawUrl: string | undefined, slot: 'recordingLink' | 'recordingLink2'): string => {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) return '';
    if (normalizeZoomMeetingUrl(trimmed) !== null) return '';
    if (/\/_\/public-api\/|\/transcript|\.mp4($|\?)|\.webm($|\?)/i.test(trimmed)) return '';
    if (isGrainRecordingUrl(trimmed)) {
      const cls = getLessonRecordingShareClassification(lesson, slot);
      return cls === 'public_access_verified' ? trimmed : '';
    }
    return trimmed;
  };

  // Generate multilingual educational lesson summary message
  const generateSummaryText = () => {
    if (multiLessonReportResult && multiLessonReportResult.entries.length > 1) {
      return multiLessonReportResult.formattedReportText;
    }

    const perfFeedback = report?.studentPerformance?.[activeStudent?.id || '']?.generatedFeedback?.detailed || '';
    const recLink1 = getSafeParentLink(report?.recordingLink || lesson.recordingLink, 'recordingLink');
    const recLink2 = getSafeParentLink(report?.recordingLink2 || lesson.recordingLink2, 'recordingLink2');
    
    const totalCycleCount = cycleResolution.totalCycleSessions;
    const isPerLessonGroup = cycleResolution.isPerLesson;
    const hasCycleSession = !isPerLessonGroup && totalCycleCount > 1;

    const englishStudentName = activeStudent?.certificateName || activeStudent?.displayNameEn || activeStudent?.nameEn;
    const studentDisplayName = (reportLanguage === 'de' || reportLanguage === 'en')
      ? (englishStudentName || activeStudent?.name || lesson.studentName || 'Student')
      : (activeStudent?.displayNameAr || activeStudent?.nameAr || activeStudent?.name || lesson.studentName || 'الطالب');

    // Arabic summary
    if (reportLanguage === 'ar') {
      const attendance = report?.attendanceStatus === 'present' ? 'حاضر ✅' : report?.attendanceStatus === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
      const homework = report?.homeworkStatus === 'completed' ? 'تم الحل بالكامل ✅' : report?.homeworkStatus === 'assigned' ? 'واجب جديد 📝' : 'لم يتم الحل ❌';
      const sessionLine = hasCycleSession 
        ? `⏱️ رقم الحصة: الحصة ${currentSessionNumber} من ${totalCycleCount}\n` 
        : '';
      let recordingLine = '';
      if (recLink1 && recLink2) {
        recordingLine = `\n🎥 تسجيلات الحصة:\n• جزء 1: ${recLink1}\n• جزء 2: ${recLink2}\n`;
      } else if (recLink1) {
        recordingLine = `\n🎥 تسجيل الحصة:\n${recLink1}\n`;
      }

      const arG = getTimeBasedGreeting('ar', { style: 'egyptian', recipientName: activeStudent?.parentName || 'ولي الأمر الكريم' });
      return `${arG} 🇩🇪

تقرير ملخص الحصة لـ ${studentDisplayName || lesson.title} بتاريخ ${lesson.date}:

📚 المادة: ${lesson.title} (${lesson.grade || ''})
${sessionLine}✅ الحضور: ${attendance}
📖 الواجب: ${homework} ${report?.homeworkTitle ? `("${report.homeworkTitle}")` : ''}${recordingLine}
📊 التقييم والمشاركة:
  • اختبار/Quiz: ${report?.quizScore ?? 'N/A'}/100
  • التفاعل والمشاركة: ${report?.participationScore ?? 'N/A'}/100

📝 ملاحظة المعلم:
"${report?.teacherNotes || 'مستوى ممتاز ومشاركة فعالة في الحصة.'}"${perfFeedback ? `\n\nتقرير الأداء:\n${perfFeedback}` : ''}

مع خالص التحيات،
${getTeacherArabicName(profile, 'معلم اللغة الألمانية')} 🇩🇪`;
    }

    // English summary
    if (reportLanguage === 'en') {
      const attendance = report?.attendanceStatus === 'present' ? 'Present ✅' : report?.attendanceStatus === 'late' ? 'Late ⚠️' : 'Absent ❌';
      const homework = report?.homeworkStatus === 'completed' ? 'Completed ✅' : report?.homeworkStatus === 'assigned' ? 'Assigned 📝' : 'Not completed ❌';
      const sessionLine = hasCycleSession 
        ? `⏱️ Session: Session ${currentSessionNumber} of ${totalCycleCount}\n` 
        : '';
      let recordingLine = '';
      if (recLink1 && recLink2) {
        recordingLine = `\n🎥 Lesson Recordings:\n• Part 1: ${recLink1}\n• Part 2: ${recLink2}\n`;
      } else if (recLink1) {
        recordingLine = `\n🎥 Lesson Recording:\n${recLink1}\n`;
      }

      const enG = getTimeBasedGreeting('en', { recipientName: `parent of ${studentDisplayName}` });
      return `${enG} 🇩🇪

Educational summary report for ${studentDisplayName} on ${lesson.date}:

📚 Course: ${lesson.title} (${lesson.grade || ''})
${sessionLine}✅ Attendance: ${attendance}
📖 Homework: ${homework} ${report?.homeworkTitle ? `("${report.homeworkTitle}")` : ''}${recordingLine}
📊 Evaluation:
  • Quiz: ${report?.quizScore ?? 'N/A'}/100
  • Participation: ${report?.participationScore ?? 'N/A'}/100

📝 Teacher's Note:
"${report?.teacherNotes || 'Great performance and active participation in class.'}"${perfFeedback ? `\n\nPerformance Summary:\n${perfFeedback}` : ''}

Best regards,
${getTeacherEnglishName(profile, 'Teacher')}
German Language Department 🇩🇪`;
    }

    // German summary (default)
    const attendance = report?.attendanceStatus === 'present' ? 'Anwesend (Present) ✅' : report?.attendanceStatus === 'late' ? 'Verspätet (Late) ⚠️' : 'Abwesend (Absent) ❌';
    const homework = report?.homeworkStatus === 'completed' ? 'Vollständig erledigt (Completed) ✅' : report?.homeworkStatus === 'assigned' ? 'Neu aufgegeben (Assigned) 📝' : 'Nicht erledigt ❌';
    const sessionLine = hasCycleSession 
      ? `⏱️ Sitzung: Session ${currentSessionNumber} von ${totalCycleCount}\n` 
      : '';
    let recordingLine = '';
    if (recLink1 && recLink2) {
      recordingLine = `\n🎥 Aufnahmen der Lektion (Recordings):\n• Teil 1: ${recLink1}\n• Teil 2: ${recLink2}\n`;
    } else if (recLink1) {
      recordingLine = `\n🎥 Aufnahme der Lektion (Recording):\n${recLink1}\n`;
    } else if (recLink2) {
      recordingLine = `\n🎥 Aufnahme der Lektion (Recording):\n${recLink2}\n`;
    }
    
    const deG = getTimeBasedGreeting('de', { recipientName: parentName });
    return `${deG} 🇩🇪

Hier ist der Unterrichtsbericht für ${studentDisplayName} vom ${lesson.date}:

📚 Kurs: ${lesson.title} (${lesson.grade})
${sessionLine}✅ Anwesenheit: ${attendance}
📖 Hausaufgabe: ${homework} ${report?.homeworkTitle ? `("${report.homeworkTitle}")` : ''}${recordingLine}
📊 Bewertung:
  • Quiz: ${report?.quizScore ?? 'N/A'}/100
  • Mitarbeit: ${report?.participationScore ?? 'N/A'}/100

📝 Anmerkung der Lehrkraft:
"${report?.teacherNotes || 'Sehr gute Leistung und aktive Teilnahme im Unterricht.'}"${perfFeedback ? `\n\nLeistungsbericht:\n${perfFeedback}` : ''}

Mit freundlichen Grüßen,
${getTeacherEnglishName(profile, 'Lehrer/in')}
Glück fröhlich und froh 🇩🇪`;
  };

  const baseSummaryText = generateSummaryText();
  const summaryText = approvedGrainSummaryText
    ? `${baseSummaryText}\n\n📌 ${approvedGrainSummaryText}`
    : baseSummaryText;

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppSend = () => {
    const url = buildWhatsAppUrl(resolvedParentContact.contact, summaryText);
    window.open(url, '_blank');
    /* confetti removed */
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />
        {/* Modal Header */}
        <div className="bg-surface border-b border-surface-border px-3.5 py-2.5 sm:p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-primary-soft text-primary rounded-lg sm:rounded-xl shrink-0">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-text-main truncate">
                {reportT('ملخص ولي الأمر والتواصل', 'Parent Summary & Communication', 'Eltern-Zusammenfassung')}
              </h2>
              <p className="text-[10px] sm:text-xs text-text-muted truncate">{lesson.title} • {lesson.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ReportLanguageToggle showLabel={false} />
            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-text-muted hover:text-text-main transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Rule 4: Teacher Review & Approval for Grain Lesson Summary */}
          {initialSanitizedGrain && !dismissedGrainSummary && (
            <div className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-black text-purple-900 dark:text-purple-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>
                    {reportT(
                      'مسودة ملخص الحصة من Grain (بموافقة المعلم فقط)',
                      'Grain Summary Draft (Teacher Approval Required)',
                      'Grain-Zusammenfassung (Lehrkraft-Bestätigung erforderlich)'
                    )}
                  </span>
                </span>
              </div>
              <textarea
                rows={2}
                value={editableGrainSummary}
                onChange={(e) => setEditableGrainSummary(e.target.value)}
                className="w-full p-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-surface text-xs text-text-main"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const clean = sanitizeGrainSummaryForParentReport({
                      rawSummaryText: editableGrainSummary,
                      targetStudent: activeStudent,
                      allGroupStudents,
                      language: reportLanguage === 'de' ? 'de' : reportLanguage === 'en' ? 'en' : 'ar'
                    });
                    setEditableGrainSummary(clean);
                    setApprovedGrainSummaryText(clean);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>{reportT('اعتماد وإدراج', 'Approve & Include', 'Bestätigen & einfügen')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApprovedGrainSummaryText(null);
                    setDismissedGrainSummary(true);
                  }}
                  className="px-2 py-1 rounded-lg bg-surface hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-surface-border text-[10px] font-bold cursor-pointer"
                >
                  {reportT('تجاهل', 'Dismiss', 'Verwerfen')}
                </button>
              </div>
            </div>
          )}

          {/* Part 11: Multi-Lesson Selector (Newest first -> Oldest last) */}
          {candidateLessonsNewestFirst.length > 1 && (
            <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-surface-border space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowMultiLessonSelector((prev) => !prev)}
                  className="text-xs font-black text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {reportT(
                      `دمج عدة حصص (${selectedMultiLessonIds.length} مختارة - الأحدث للأقدم)`,
                      `Combine Multiple Lessons (${selectedMultiLessonIds.length} selected - Newest first)`,
                      `Mehrere Stunden (${selectedMultiLessonIds.length} ausgewählt - Neueste zuerst)`
                    )}
                  </span>
                </button>
                {selectedMultiLessonIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMultiLessonIds([lesson.id])}
                    className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    {reportT('إعادة تعيين', 'Reset', 'Zurücksetzen')}
                  </button>
                )}
              </div>

              {showMultiLessonSelector && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={multiLessonSearchQuery}
                      onChange={(e) => setMultiLessonSearchQuery(e.target.value)}
                      placeholder={reportT('بحث بالتاريخ أو الموضوع...', 'Search date or topic...', 'Datum oder Thema suchen...')}
                      className="flex-1 px-2 py-1 rounded-lg bg-surface border border-surface-border text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedMultiLessonIds(filteredMultiLessons.map((l) => l.id))}
                      className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black cursor-pointer"
                    >
                      {reportT('الكل', 'All', 'Alle')}
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-surface-border/50 border border-surface-border rounded-lg bg-surface">
                    {filteredMultiLessons.map((item) => {
                      const isChecked = selectedMultiLessonIds.includes(item.id);
                      const topic = resolveTaughtTodayTopic(item, item.report).text || item.title;
                      const shareClass = getLessonRecordingShareClassification(item, 'recordingLink');
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer ${
                            isChecked ? 'bg-primary-soft/30 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedMultiLessonIds((prev) => {
                                  if (checked) return Array.from(new Set([...prev, item.id]));
                                  const next = prev.filter((id) => id !== item.id);
                                  return next.length > 0 ? next : [lesson.id];
                                });
                              }}
                              className="rounded border-surface-border text-primary"
                            />
                            <span className="font-mono text-[10px] text-primary shrink-0">{item.date}</span>
                            {item.time && <span className="font-mono text-[10px] text-text-muted shrink-0">{item.time}</span>}
                            <span className="truncate text-text-main">{topic}</span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                              shareClass === 'public_access_verified'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {shareClass === 'public_access_verified' ? '🎥 Public ✓' : shareClass}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Formatted Text Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-text-muted">
                {reportT('نص التقرير الجاهز للإرسال:', 'Ready Message / Report Text:', 'Generierter Bericht:')}
              </label>
              <button
                onClick={handleCopy}
                className="text-xs font-bold text-primary dark:text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? reportT('تم النسخ!', 'Copied!', 'Kopiert!') : reportT('نسخ النص', 'Copy Text', 'Text kopieren')}
              </button>
            </div>

            <textarea
              readOnly
              rows={10}
              value={summaryText}
              className="w-full bg-surface-hover/80 border border-surface-border dark:border-surface-border-soft rounded-xl p-3 text-xs sm:text-sm font-sans text-slate-800 dark:text-slate-200 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Direct Communication Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-surface-border">
            <p className="text-xs font-bold text-text-main">
              {reportT('إرسال وتواصل مباشر:', 'Direct Communication:', 'Direkte Eltern-Kommunikation:')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleWhatsAppSend}
                className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>
                  WhatsApp {resolvedParentContact.isUsername ? `(${resolvedParentContact.display})` : ''}
                </span>
              </button>

              {resolvedParentContact.hasContact && !resolvedParentContact.isUsername && (
                <a
                  href={`tel:${resolvedParentContact.contact}`}
                  className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center active:scale-95 hover:shadow-lg hover:shadow-primary/30"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Parent</span>
                </a>
              )}

              {studentPhone && !isStudentUsername && (
                <a
                  href={`tel:${studentPhone}`}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Student</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-hover/50 border-t border-slate-100 dark:border-surface-border flex justify-end">
          <button
            onClick={() => {
              if (onGoToHomeScreen) {
                onGoToHomeScreen();
              } else {
                onClose();
              }
            }}
            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs py-3 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية (Go to Homescreen)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
