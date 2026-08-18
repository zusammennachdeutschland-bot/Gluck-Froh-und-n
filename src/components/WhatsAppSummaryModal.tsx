import { isPendingStatus } from '../utils/lessonUtils';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Lesson } from '../types';
import { buildWhatsAppUrl } from '../utils/phoneUtils';
import { X, Send, Copy, Check, MessageSquare, ExternalLink, Calendar, DollarSign } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WhatsAppSummaryModalProps {
  student: Student;
  onClose: () => void;
}

export const WhatsAppSummaryModal: React.FC<WhatsAppSummaryModalProps> = ({ student, onClose }) => {
  const { groups, lessons, payments, profile } = useApp();

  const studentGroup = groups.find(g => g.id === student.groupId);
  const groupName = studentGroup?.name || 'Einzelunterricht';

  // Get all completed lessons for this student
  const studentLessons = lessons.filter(l => 
    l.status === 'completed' && 
    ((l.studentId ? l.studentId === student.id : (!!l.studentName && l.studentName === student.name)) || (student.groupId ? l.groupId === student.groupId : false))
  ).sort((a, b) => b.date.localeCompare(a.date));

  // Get payments for this student
  const studentPayments = payments.filter(p => 
    p.studentId ? p.studentId === student.id : (!!p.studentName && p.studentName === student.name)
  );

  const totalDue = studentPayments.reduce((sum, p) => sum + p.amountDue, 0) || (studentLessons.length * (studentGroup?.pricePerSession || studentGroup?.monthlyPackagePrice || 200));
  const totalPaid = studentPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const remaining = Math.max(0, totalDue - totalPaid);

  // Formatted lesson dates list
  const lessonDatesStr = studentLessons.map(l => {
    const parts = l.date.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return l.date;
  }).reverse().join('\n');

  // Next expected date
  const nextLesson = lessons.find(l => 
    isPendingStatus(l.status) && 
    (l.studentId === student.id || l.groupId === student.groupId)
  );
  let nextDateStr = 'سيتم تحديده لاحقاً';
  if (nextLesson) {
    const parts = nextLesson.date.split('-');
    if (parts.length === 3) nextDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Exact Arabic template matching Requirement 6:
  const arabicMessage = `السلام عليكم،
تم تسجيل حضور الطالب [${student.name}] للحصص التالية:

${lessonDatesStr || 'لا توجد حصص مسجلة حتى الآن'}

إجمالي المستحق: ${totalDue} جنيه.
تم السداد: ${totalPaid} جنيه.
المتبقي: ${remaining} جنيه.

تاريخ الموعد القادم: ${nextDateStr}

طرق السداد المتاحة:
📱 فودافون كاش: ${profile.vodafoneCashNumber || profile.phone || '01012345678'}
💳 InstaPay: ${profile.instaPayId || 'instapay'}

شكراً لحضراتكم.`;

  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState(student.parentPhone || student.studentPhone || '');

  const handleCopyText = () => {
    navigator.clipboard.writeText(arabicMessage);
    setCopied(true);
    confetti({ particleCount: 40, spread: 50 });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const url = buildWhatsAppUrl(customPhone, arabicMessage);
    window.open(url, '_blank');
    confetti({ particleCount: 70, spread: 60 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm: overflow-y-auto p-0 sm:p-4 pb-0">
      <div className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up space-y-0 font-sans">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary via-primary to-primary-hover p-5 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-soft bg-surface/20 px-2.5 py-0.5 rounded-full">
              WhatsApp الرسالة التلقائية
            </span>
            <h3 className="text-lg font-black mt-1 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 fill-white" />
              <span>إرسال ملخص السداد والحضور (Send Payment Summary)</span>
            </h3>
            <p className="text-xs text-primary-soft">
              تقرير الحضور والمستحقات المالية لولي الأمر باللغة العربية.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-surface/20 rounded-full text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Target Phone */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>رقم هاتف ولي الأمر (WhatsApp Number):</span>
              <span className="text-[10px] text-primary font-extrabold">{student.parentName}</span>
            </label>
            <input
              type="text"
              value={customPhone}
              onChange={(e) => setCustomPhone(e.target.value)}
              placeholder="01012345678"
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-bold font-mono text-text-main"
            />
          </div>

          {/* Formatted Text Box */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              معاينة النص المرسل:
            </label>
            <div dir="rtl" className="bg-primary-soft dark:bg-slate-800/80 p-4 rounded-lg border border-primary-border dark:border-surface-border-soft text-xs leading-relaxed text-text-main font-sans whitespace-pre-wrap max-h-60 overflow-y-auto shadow-inner">
              {arabicMessage}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleCopyText}
              className="py-3 px-4 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'تم النسخ!' : 'نسخ النص (Copy)'}</span>
            </button>

            <button
              onClick={handleSendWhatsApp}
              className="py-3 px-4 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-white font-black text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>فتح WhatsApp الآن 📱</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
