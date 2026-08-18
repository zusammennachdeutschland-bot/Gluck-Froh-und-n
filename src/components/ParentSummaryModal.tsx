import React, { useState } from 'react';
import { Lesson, Student, TeacherProfile } from '../types';
import { useApp } from '../context/AppContext';
import { X, Copy, Check, MessageSquare, Phone, Send, Share2, Sparkles, Home } from 'lucide-react';
import { ArabicParentReportModal } from './ArabicParentReportModal';
import { buildWhatsAppUrl } from '../utils/phoneUtils';
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
  const { students } = useApp();
  const [copied, setCopied] = useState(false);
  const [showArabicModal, setShowArabicModal] = useState(false);

  const activeStudent = student || 
    students.find(s => (lesson.studentId && s.id === lesson.studentId) || (lesson.studentName && s.name.trim().toLowerCase() === lesson.studentName.trim().toLowerCase())) || 
    (lesson.groupId ? students.find(s => s.groupId === lesson.groupId) : undefined);

  const report = lesson.report;
  const parentName = activeStudent?.parentName || lesson.quickParentName || (lesson.studentName ? `${lesson.studentName}'s Eltern` : 'Sehr geehrte Eltern');
  const parentPhone = activeStudent?.parentPhone || lesson.quickParentPhone || activeStudent?.studentPhone || lesson.quickStudentPhone || '';
  const studentPhone = activeStudent?.studentPhone || lesson.quickStudentPhone || parentPhone;

  // Generate German educational lesson summary message
  const generateSummaryText = () => {
    const attendance = report?.attendanceStatus === 'present' ? 'Anwesend (Present) ✅' : report?.attendanceStatus === 'late' ? 'Verspätet (Late) ⚠️' : 'Abwesend (Absent) ❌';
    const homework = report?.homeworkStatus === 'completed' ? 'Vollständig erledigt (Completed) ✅' : report?.homeworkStatus === 'assigned' ? 'Neu aufgegeben (Assigned) 📝' : 'Nicht erledigt ❌';
    
    return `Guten Tag ${parentName}! 🇩🇪

Hier ist der Unterrichtsbericht für ${lesson.studentName || lesson.title} vom ${lesson.date}:

📚 Kurs: ${lesson.title} (${lesson.grade})
⏱️ Sitzung: Session ${lesson.sessionNumber} von ${lesson.totalSessionsInPackage}
✅ Anwesenheit: ${attendance}
📖 Hausaufgabe: ${homework} ${report?.homeworkTitle ? `("${report.homeworkTitle}")` : ''}
📊 Bewertung:
  • Quiz: ${report?.quizScore ?? 'N/A'}/100
  • Mitarbeit: ${report?.participationScore ?? 'N/A'}/100

📝 Anmerkung der Lehrkraft:
"${report?.teacherNotes || 'Sehr gute Leistung und aktive Teilnahme im Unterricht.'}"

Mit freundlichen Grüßen,
${profile.displayName}
Glück fröhlich und froh 🇩🇪`;
  };

  const summaryText = generateSummaryText();

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppSend = () => {
    const url = buildWhatsAppUrl(parentPhone, summaryText);
    window.open(url, '_blank');
    confetti({ particleCount: 50, spread: 40 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] p-0 sm:p-4 pb-0">
      <div className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-surface/20 rounded-xl">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Parent Summary & Communication</h2>
              <p className="text-xs text-primary-soft">{lesson.title} • {lesson.date}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Formatted Text Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Automatisch generierter Bericht (German Summary)
              </label>
              <button
                onClick={handleCopy}
                className="text-xs font-bold text-primary dark:text-primary hover:underline flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Kopiert!' : 'Text kopieren'}
              </button>
            </div>

            <textarea
              readOnly
              rows={11}
              value={summaryText}
              className="w-full bg-surface-hover/80 border border-surface-border dark:border-surface-border-soft rounded-lg p-3.5 text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Direct Communication Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-surface-border">
            <p className="text-xs font-bold text-text-main">
              Direkte Eltern-Kommunikation:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleWhatsAppSend}
                className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>

              <a
                href={`tel:${parentPhone}`}
                className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center active:scale-95 hover:shadow-lg hover:shadow-primary/30"
              >
                <Phone className="w-4 h-4" />
                <span>Call Parent</span>
              </a>

              <a
                href={`tel:${studentPhone}`}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Phone className="w-4 h-4" />
                <span>Call Student</span>
              </a>
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
