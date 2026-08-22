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
    students.find(s => (lesson.studentId && s.id === lesson.studentId) || (lesson.studentName && s.name.trim().toLowerCase() === lesson.studentName.trim().toLowerCase())) || 
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

      const studentNote = lesson.report?.studentNotes?.[st.id] || 'مستوى ممتاز ومتفاعل في الحصة.';

      text += `
👤 [${idx + 1}] الطالب: ${st.name}
• الحضور: ${attendanceArabic}
• الواجب السابق: ${homeworkOption}
• درجة الإملاء: ${dictationScore}
• درجة الامتحان: ${examScore}
• ملاحظات: ${studentNote}
----------------------------------`;
    });

    const teacherArName = getTeacherArabicName(profile, 'المعلم');
    const teacherSig = teacherArName.startsWith('أ.') || teacherArName.startsWith('الأستاذ') ? teacherArName : `أ. ${teacherArName}`;
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
    } else {
      const rawAtt = lesson.report?.attendanceStatus || 'present';
      attendanceArabic = rawAtt === 'present' ? 'حاضر ✅' : rawAtt === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
    }

    const taughtToday = lesson.report?.teacherNotes || 'لم يحدد بعد';
    const nextHomework = lesson.report?.homeworkDescription || 'لا يوجد واجب';
    const notesCombined = studentNote.trim() || 'مستوى الطالب ممتاز ومتفاعل خلال الحصة.';

    const teacherArName = getTeacherArabicName(profile, 'المعلم');
    const teacherSig = teacherArName.startsWith('أ.') || teacherArName.startsWith('الأستاذ') ? teacherArName : `أ. ${teacherArName}`;

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
${examScore}

ملاحظات المعلم:
• ${notesCombined}

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
    if (activeTab === 'bulk' && groupWhatsAppLink) {
      const encodedText = encodeURIComponent(finalGeneratedText);
      window.open(`${groupWhatsAppLink}?text=${encodedText}`, '_blank');
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`bg-surface border border-surface-border w-full max-w-xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-fade-in ${language === 'ar' ? 'text-right' : 'text-left'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        
        {/* Header */}
        <div className={`bg-gradient-to-l from-primary/10 to-transparent p-4 sm:p-5 border-b border-surface-border flex items-center justify-between shrink-0 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-base font-black text-text-main">
              {t('auto_share_session_report')}
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-text-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Group Toggle Tab (Only if multiple students in the group) */}
          {isGroupLesson && (
            <div className="grid grid-cols-2 gap-2 bg-slate-100/80 dark:bg-slate-900/40 p-1 rounded-xl border border-surface-border">
              <button
                type="button"
                onClick={() => {
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
                onClick={() => {
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
              <label className="text-xs font-black text-text-main block">
                {t('auto_select_a_student_to_preview')}
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-surface-hover/50 rounded-xl border border-surface-border/50">
                {groupStudents.map(st => {
                  const isSelected = selectedStudentId === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        setIsManualEdited(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-primary border-primary text-white shadow-xs'
                          : 'bg-surface border-surface-border text-text-muted hover:text-text-main hover:bg-slate-50'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{st.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Report Metadata */}
          {activeTab === 'individual' ? (
            <div className="grid grid-cols-2 gap-3 bg-primary-soft/40 p-3.5 rounded-xl border border-primary-border/40 text-xs">
              <div>
                <span className="text-text-muted font-bold block mb-1">{t('auto_student')}</span>
                <span className="font-extrabold text-text-main text-[13px]">
                  {activeStudent?.name || lesson.studentName || t('auto_not_specified')}
                </span>
              </div>
              <div>
                <span className="text-text-muted font-bold block mb-1">{t('auto_parent_phone_7')}</span>
                <span className="font-extrabold text-text-main text-[13px]">
                  {parentPhone || t('auto_not_registered')}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-text-muted font-bold block mb-0.5">{t('auto_group')}</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
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
                onClick={handleCopyText}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('auto_copied') : t('auto_copy_text')}</span>
              </button>
            </div>

            <textarea
              rows={11}
              value={finalGeneratedText}
              onChange={(e) => {
                setFinalGeneratedText(e.target.value);
                setIsManualEdited(true);
              }}
              className="w-full bg-surface-hover/80 border border-surface-border rounded-xl p-4 text-xs font-semibold leading-relaxed text-text-main focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface border-t border-surface-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {activeTab === 'bulk' && groupWhatsAppLink ? (
              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>{t('auto_send_to_whatsapp_group')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-black text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>{t('auto_send_via_whatsapp')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-surface-border"
            >
              <Printer className="w-4 h-4" />
              <span>{t('auto_print')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'individual' && parentPhone && (
              <a
                href={`tel:${parentPhone}`}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-bold text-xs py-2.5 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-surface-border"
              >
                <Phone className="w-4 h-4 text-primary" />
                <span>{t('auto_phone_call')}</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                if (onGoToHomeScreen) {
                  onGoToHomeScreen();
                } else {
                  if (onSaveReport) {
                    onSaveReport(finalGeneratedText);
                  }
                  onClose();
                }
              }}
              className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs py-3 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20"
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
