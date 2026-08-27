import { App as CapacitorApp } from '@capacitor/app';
import React, { useState, useEffect } from 'react';
import { Lesson, Student, TeacherProfile } from '../types';
import { useApp } from '../context/AppContext';
import { buildWhatsAppUrl } from '../utils/phoneUtils';
import { getTeacherArabicName } from '../utils/teacherUtils';
import { 
  X, Copy, Check, Send, Phone, Printer, Sparkles, User, MessageSquare, Users, Link2, Home
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const rawParentPhone = activeStudent?.parentPhone || lesson.quickParentPhone || activeStudent?.studentPhone || lesson.quickStudentPhone || '';
  const parentPhone = rawParentPhone.trim();

  // Editable generated report
  const [finalGeneratedText, setFinalGeneratedText] = useState<string>('');
  const [isManualEdited, setIsManualEdited] = useState<boolean>(false);

  // Generate Bulk Group Report Text
  const getBulkReportText = () => {
    const taughtToday = lesson.report?.teacherNotes || 'لم يحدد بعد';
    const nextHomework = lesson.report?.homeworkDescription || 'لا يوجد واجب';
    
    let text = `السلام عليكم ورحمة الله وبركاته 👋
📊 تقرير الحصة المجمع لمجموعة: ${associatedGroup?.name || 'مجموعة اللغة الألمانية'}
📅 الدرس: ${lesson.title}

تم اليوم شرح:
${taughtToday}

الواجب لجميع الطلاب:
${nextHomework}

----------------------------------
👥 تفاصيل حضور وأداء الطلاب اليوم:
`;

    groupStudents.forEach((st, idx) => {
      const stAtt = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
      const attendanceArabic = stAtt === 'present' ? 'حاضر ✅' : stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';

      const hwDone = lesson.report?.studentHomeworkDone?.[st.id];
      const homeworkOption = hwDone === 'yes' ? 'تم الحل 👍' : hwDone === 'no' ? 'لم يتم الحل 👎' : 'غير محدد';

      const dictationGrade = lesson.report?.studentDictationGrade?.[st.id];
      const dictationScore = dictationGrade !== undefined ? `${dictationGrade} / 10` : 'لا يوجد';

      const examGrade = lesson.report?.studentExamGrade?.[st.id];
      const examScore = examGrade !== undefined ? `${examGrade} / 10` : 'لا يوجد';

      const studentNote = lesson.report?.studentNotes?.[st.id] || '';
      const perfFeedback = lesson.report?.studentPerformance?.[st.id]?.generatedFeedback?.parent;

      const noteText = studentNote.trim() ? `\n• ملاحظات: ${studentNote.trim()}` : '';

      text += `
👤 [${idx + 1}] الطالب: ${st.name}
• الحضور: ${attendanceArabic}
• الواجب السابق: ${homeworkOption}
• درجة الإملاء: ${dictationScore}
• درجة الامتحان: ${examScore}${noteText}${perfFeedback ? `\n• أداء الحصة: ${perfFeedback}` : ''}\n----------------------------------`;
    });

    const teacherArName = getTeacherArabicName(profile, 'المعلم');
    const hasPrefix = /^(أ\.|أ\/|أستاذ|الأستاذ|د\.|د\/|دكتور|م\.|م\/|مهندس)/.test(teacherArName);
    const teacherSig = hasPrefix ? teacherArName : `أ. ${teacherArName}`;
    text += `\n\nشكراً لكم،\n${teacherSig} - معلم اللغة الألمانية 🇩🇪`;
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

    if (activeStudent) {
      const stAtt = lesson.report?.studentAttendance?.[activeStudent.id] || lesson.report?.attendanceStatus || 'present';
      attendanceArabic = stAtt === 'present' ? 'حاضر ✅' : stAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';

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
      attendanceArabic = rawAtt === 'present' ? 'حاضر ✅' : rawAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
    }

    const taughtToday = lesson.report?.teacherNotes || 'لم يحدد بعد';
    const nextHomework = lesson.report?.homeworkDescription || 'لا يوجد واجب';
    const cleanStudentNote = studentNote.trim();

    const teacherArName = getTeacherArabicName(profile, 'المعلم');
    const hasPrefix = /^(أ\.|أ\/|أستاذ|الأستاذ|د\.|د\/|دكتور|م\.|م\/|مهندس)/.test(teacherArName);
    const teacherSig = hasPrefix ? teacherArName : `أ. ${teacherArName}`;

    const notesSection = cleanStudentNote ? `\n\nملاحظات المعلم:\n• ${cleanStudentNote}` : '';

    const generated = `السلام عليكم ورحمة الله وبركاته 👋

تم اليوم شرح:
${taughtToday}

الواجب:
${nextHomework}

الحضور:
${attendanceArabic}

الواجب السابق:
${homeworkOption}

درجة الإملاء:
${dictationScore}

درجة الامتحان (Quiz):
${examScore}${notesSection}${perfFeedback ? `\n\nأداء الحصة:\n• ${perfFeedback}` : ''}

شكراً لكم،
${teacherSig} - معلم اللغة الألمانية 🇩🇪`;

    setFinalGeneratedText(generated);
  }, [
    selectedStudentId,
    lesson.report,
    activeStudent,
    isManualEdited,
    activeTab,
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
      if (groupWhatsAppLink) {
        navigator.clipboard.writeText(finalGeneratedText);
        alert('تم نسخ النص. سيتم فتح الجروب الآن لتلصق الرسالة.');
        window.open(groupWhatsAppLink, '_blank');
        return;
      } else {
        alert('هذا الجروب غير مسجل له رابط واتساب. يرجى إضافة رابط الجروب من إعدادات الجروب أولاً لتتمكن من الإرسال.');
        return;
      }
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
                {lesson.title} {lesson.grade ? `• ${lesson.grade}` : ''} {lesson.date ? `• ${lesson.date}` : ''}
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
                <span className="text-text-muted font-bold block mb-0.5">{t('auto_parent_phone_7')}</span>
                <span className="font-extrabold text-text-main text-xs sm:text-[13px] truncate block" dir="ltr">
                  {parentPhone || t('auto_not_registered')}
                </span>
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
                  <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-md text-[10px] font-black">
                    {t('auto_group_link_not_linked_yet')}
                  </span>
                )}
              </div>
              {!groupWhatsAppLink && (
                <p className="text-[10px] text-text-muted leading-normal font-bold">
                  {t('auto_tip_you_can_edit_the_group_to')}
                </p>
              )}
            </div>
          )}

          {/* Preview & Editor Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>{t('auto_preview_edit_message')}</span>
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyText();
                }}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('auto_copied') : t('auto_copy_text')}</span>
              </button>
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
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppSend();
                }}
                className={`flex-1 sm:flex-initial ${groupWhatsAppLink ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 hover:bg-slate-600'} active:scale-95 text-white font-black text-xs py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[42px]`}
              >
                <Send className="w-4 h-4" />
                <span>{t('auto_send_to_whatsapp_group')}</span>
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
                <span>{t('auto_send_via_whatsapp')} ({activeStudent?.name || 'الطالب'})</span>
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
            {activeTab === 'individual' && parentPhone && (
              <a
                href={`tel:${parentPhone}`}
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
                if (onGoToHomeScreen) {
                  onGoToHomeScreen();
                } else {
                  if (onSaveReport) {
                    onSaveReport(finalGeneratedText);
                  }
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
