import React, { useState } from 'react';
import { Lesson, Student, TeacherProfile } from '../types';
import { useApp } from '../context/AppContext';
import { X, Copy, Check, MessageSquare, Phone, Send, Share2, Sparkles, Home, AtSign } from 'lucide-react';
import { ArabicParentReportModal } from './ArabicParentReportModal';
import { ReportLanguageToggle } from './ReportLanguageToggle';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername } from '../utils/phoneUtils';
import { getTeacherEnglishName, getTeacherArabicName } from '../utils/teacherUtils';
import confetti from 'canvas-confetti';

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
  const { students, reportLanguage, reportT, _t } = useApp();
  const [copied, setCopied] = useState(false);
  const [showArabicModal, setShowArabicModal] = useState(false);

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

  // Generate multilingual educational lesson summary message
  const generateSummaryText = () => {
    const perfFeedback = report?.studentPerformance?.[activeStudent?.id || '']?.generatedFeedback?.detailed || '';
    const recLink1 = report?.recordingLink || lesson.recordingLink;
    const recLink2 = report?.recordingLink2 || lesson.recordingLink2;
    
    // Arabic summary
    if (reportLanguage === 'ar') {
      const attendance = report?.attendanceStatus === 'present' ? 'حاضر ✅' : report?.attendanceStatus === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
      const homework = report?.homeworkStatus === 'completed' ? 'تم الحل بالكامل ✅' : report?.homeworkStatus === 'assigned' ? 'واجب جديد 📝' : 'لم يتم الحل ❌';
      const sessionLine = (lesson.totalSessionsInPackage && lesson.totalSessionsInPackage > 1) 
        ? `⏱️ رقم الحصة: الحصة ${lesson.sessionNumber} من ${lesson.totalSessionsInPackage}\n` 
        : '';
      let recordingLine = '';
      if (recLink1 && recLink2) {
        recordingLine = `\n🎥 تسجيلات الحصة:\n• جزء 1: ${recLink1}\n• جزء 2: ${recLink2}\n`;
      } else if (recLink1) {
        recordingLine = `\n🎥 تسجيل الحصة:\n${recLink1}\n`;
      }

      return `السلام عليكم ورحمة الله وبركاته ${activeStudent?.parentName || 'ولي الأمر الكريم'} 👋 🇩🇪

تقرير ملخص الحصة لـ ${lesson.studentName || lesson.title} بتاريخ ${lesson.date}:

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
      const sessionLine = (lesson.totalSessionsInPackage && lesson.totalSessionsInPackage > 1) 
        ? `⏱️ Session: Session ${lesson.sessionNumber} of ${lesson.totalSessionsInPackage}\n` 
        : '';
      let recordingLine = '';
      if (recLink1 && recLink2) {
        recordingLine = `\n🎥 Lesson Recordings:\n• Part 1: ${recLink1}\n• Part 2: ${recLink2}\n`;
      } else if (recLink1) {
        recordingLine = `\n🎥 Lesson Recording:\n${recLink1}\n`;
      }

      return `Hello / Greetings to the parents of ${lesson.studentName || 'Student'}! 🇩🇪

Educational summary report for ${lesson.studentName || lesson.title} on ${lesson.date}:

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
    const sessionLine = (lesson.totalSessionsInPackage && lesson.totalSessionsInPackage > 1) 
      ? `⏱️ Sitzung: Session ${lesson.sessionNumber} von ${lesson.totalSessionsInPackage}\n` 
      : '';
    let recordingLine = '';
    if (recLink1 && recLink2) {
      recordingLine = `\n🎥 Aufnahmen der Lektion (Recordings):\n• Teil 1: ${recLink1}\n• Teil 2: ${recLink2}\n`;
    } else if (recLink1) {
      recordingLine = `\n🎥 Aufnahme der Lektion (Recording):\n${recLink1}\n`;
    } else if (recLink2) {
      recordingLine = `\n🎥 Aufnahme der Lektion (Recording):\n${recLink2}\n`;
    }
    
    return `Guten Tag ${parentName}! 🇩🇪

Hier ist der Unterrichtsbericht für ${lesson.studentName || lesson.title} vom ${lesson.date}:

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

  const summaryText = generateSummaryText();

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppSend = () => {
    const url = buildWhatsAppUrl(resolvedParentContact.contact, summaryText);
    window.open(url, '_blank');
    confetti({ particleCount: 50, spread: 40 });
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
