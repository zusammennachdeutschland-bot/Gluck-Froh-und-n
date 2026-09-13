import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Student, GradeLevel, CertificateRecord } from '../types';
import { COURSE_LEVELS, SCHOOL_GRADES } from '../data/initialData';
import { getStudentCyclePricing } from '../utils/paymentUtils';
import { buildWhatsAppUrl, isWhatsAppUsername, cleanWhatsAppUsername, formatContactDisplay, resolveStudentWhatsAppContact } from '../utils/phoneUtils';
import { CARTOON_AVATARS, DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { AvatarImage } from './AvatarImage';
import { 
  X, Phone, Send, FileText, Upload, Trash2, Calendar, Award, DollarSign, 
  BookOpen, CheckCircle2, AlertCircle, Download, FileCheck, User, Camera, Edit3, Save, Check, Sparkles,
  RefreshCw, Shield, Lock, MoreHorizontal, MessageSquare, Info, Star, GraduationCap, Users, Plus, Eye, Share2,
  AtSign, Video, ExternalLink, Copy, Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CreateCertificateModal } from './certificates/CreateCertificateModal';
import { CertificatePreviewModal } from './certificates/CertificatePreviewModal';
import { downloadCertificatePDF, shareCertificateWhatsApp } from '../utils/certificateExportUtils';
import { isLikelyFemaleStudent } from '../utils/genderUtils';
import { getStudentCode, buildParentPortalShareText } from '../utils/studentCodeUtils';

interface StudentProfileModalProps {
  student: Student;
  onClose: () => void;
  initialTab?: 'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'certificates' | 'recordings' | 'edit';
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ student, onClose, initialTab = 'overview' }) => {
  const { groups, lessons, payments, certificates, profile, uploadStudentDocument, deleteStudentDocument, updateStudent, updateStudentCertificateName, deleteStudent, t, _t } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'certificates' | 'recordings' | 'edit'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<'homework' | 'exam' | 'doc'>('homework');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isIssueCertModalOpen, setIsIssueCertModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);
  const [latinNameInput, setLatinNameInput] = useState(student.certificateName || '');
  const [isLatinSaved, setIsLatinSaved] = useState(false);
  const [copiedRecId, setCopiedRecId] = useState<string | null>(null);

  // Editable Student Fields
  const studentCode = getStudentCode(student);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [editStudentCode, setEditStudentCode] = useState(student.studentCode || studentCode);
  const [editCertificateName, setEditCertificateName] = useState(student.certificateName || '');
  const [editGender, setEditGender] = useState<'male' | 'female'>(student.gender || (isLikelyFemaleStudent(student.name) ? 'female' : 'male'));
  const [editGroupId, setEditGroupId] = useState(student.groupId);
  const [editGrade, setEditGrade] = useState<GradeLevel>(student.grade);
  const [editParentName, setEditParentName] = useState(student.parentName);
  const isInitialParentUser = isWhatsAppUsername(student.parentPhone) || student.parentContactType === 'username';
  const isInitialStudentUser = isWhatsAppUsername(student.studentPhone) || student.studentContactType === 'username';
  const [editParentContactType, setEditParentContactType] = useState<'phone' | 'username'>(isInitialParentUser ? 'username' : 'phone');
  const [editParentPhone, setEditParentPhone] = useState(student.parentPhone);
  const [editStudentContactType, setEditStudentContactType] = useState<'phone' | 'username'>(isInitialStudentUser ? 'username' : 'phone');
  const [editStudentPhone, setEditStudentPhone] = useState(student.studentPhone);
  const [editNotes, setEditNotes] = useState(student.notes || '');
  const [editStatus, setEditStatus] = useState<'active' | 'archived'>(student.status || 'active');
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);

  const assignedGroup = (groups || []).find(g => g.id === (activeTab === 'edit' ? editGroupId : student.groupId));
  const studentCertificates = (certificates || []).filter(c => c.studentId === student.id && !c.deleted);
  const studentLessons = (lessons || []).filter(l => {
    if (l.status === 'cancelled') return false;
    const matchesGroup = student.groupId ? l.groupId === student.groupId : false;
    const matchesStudent = l.studentId === student.id || l.studentName === student.name;
    return matchesGroup || matchesStudent;
  });
  const studentPayments = (payments || []).filter(p => p.studentId === student.id || p.studentName === student.name);

  const studentRecordings = (studentLessons || []).filter(l => {
    const r1 = l.recordingLink?.trim() || l.report?.recordingLink?.trim();
    const r2 = l.recordingLink2?.trim() || l.report?.recordingLink2?.trim();
    return Boolean(r1 || r2);
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

  const handleCopyStudentRecLink = (lessonId: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedRecId(`${lessonId}_${link}`);
    setTimeout(() => setCopiedRecId(null), 2000);
  };

  const handleShareStudentRecWhatsApp = (lesson: any) => {
    const r1 = lesson.recordingLink?.trim() || lesson.report?.recordingLink?.trim();
    const r2 = lesson.recordingLink2?.trim() || lesson.report?.recordingLink2?.trim();
    const targetPhone = student.studentPhone || student.parentPhone || '';
    
    let msg = `🎥 *تسجيل الحصة للطالب/ة: ${student.name}*\n📅 التاريخ: ${lesson.date} (${lesson.time || ''})\n`;
    if (lesson.sessionNumber) {
      msg += `🔢 الحصة رقم: ${lesson.sessionNumber}\n`;
    }
    const topic = (lesson.report?.homeworkTitle || lesson.title || '').trim();
    if (topic) {
      msg += `📖 الموضوع: ${topic}\n`;
    }
    msg += `\n`;

    if (r1 && r2) {
      msg += `🎥 *تسجيلات الحصة (جزئين):*\n• الجزء الأول: ${r1}\n• الجزء الثاني: ${r2}\n`;
    } else if (r1) {
      msg += `🎥 *رابط تسجيل الحصة:* ${r1}\n`;
    } else if (r2) {
      msg += `🎥 *رابط تسجيل الحصة:* ${r2}\n`;
    }

    const url = buildWhatsAppUrl(targetPhone, msg);
    window.open(url, '_blank');
  };

  // Dynamic cycle pricing & package progress calculation
  const { cycleLength, amountDue, pricePerSession } = getStudentCyclePricing(student, assignedGroup);

  const paidLessonIds = new Set<string>();
  studentPayments.forEach(p => {
    if (p.status === 'paid' && p.lessonIds) {
      p.lessonIds.forEach(id => paidLessonIds.add(id));
    }
  });

  // One source of truth for cycle progress
  const openPaymentRecord = studentPayments.find(p => !p.deleted && (p.status === 'pending' || p.status === 'partial' || p.status === 'due' || (p.lessonDates && p.lessonDates.length > 0)));

  const unbilledCompletedLessons = lessons.filter(l => {
    if (l.status !== 'completed') return false;
    const matchesGroup = assignedGroup ? l.groupId === assignedGroup.id : false;
    const matchesStudent = l.studentId === student.id || l.studentName === student.name;
    if (!matchesGroup && !matchesStudent) return false;
    const att = l.report?.studentAttendance?.[student.id] || l.report?.attendanceStatus || 'present';
    if (att === 'absent') return false;
    return !paidLessonIds.has(l.id);
  });

  const maxCompletedSessionNum = Math.max(0, ...unbilledCompletedLessons.map(l => l.sessionNumber || 0));
  const virtualOffset = (assignedGroup?.startingSessionNumber && assignedGroup.startingSessionNumber > 1 && paidLessonIds.size === 0)
    ? (assignedGroup.startingSessionNumber - 1)
    : 0;

  let currentCycleProgress = 0;
  if (openPaymentRecord && openPaymentRecord.lessonDates && openPaymentRecord.lessonDates.length > 0) {
    currentCycleProgress = Math.min(cycleLength, openPaymentRecord.lessonDates.length);
  } else if (maxCompletedSessionNum >= cycleLength) {
    currentCycleProgress = cycleLength;
  } else if (maxCompletedSessionNum > 0) {
    currentCycleProgress = (maxCompletedSessionNum % cycleLength) || cycleLength;
  } else if (unbilledCompletedLessons.length + virtualOffset > 0) {
    const totalCount = unbilledCompletedLessons.length + virtualOffset;
    currentCycleProgress = totalCount >= cycleLength ? cycleLength : ((totalCount % cycleLength) || cycleLength);
  }

  // Attendance stats
  const presentCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[student.id] || l.report.attendanceStatus || 'present') === 'present').length;
  const lateCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[student.id] || l.report.attendanceStatus || 'present') === 'late').length;
  const absentCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[student.id] || l.report.attendanceStatus || 'present') === 'absent').length;

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const isParentUser = editParentContactType === 'username' || isWhatsAppUsername(editParentPhone);
    const cleanParentUser = cleanWhatsAppUsername(editParentPhone);
    const finalParentPhone = isParentUser ? `@${cleanParentUser}` : editParentPhone.trim();

    const hasStudentVal = !!editStudentPhone.trim();
    const isStudentUser = hasStudentVal && (editStudentContactType === 'username' || isWhatsAppUsername(editStudentPhone));
    const cleanStudentUser = hasStudentVal ? cleanWhatsAppUsername(editStudentPhone) : '';
    const finalStudentPhone = hasStudentVal ? (isStudentUser ? `@${cleanStudentUser}` : editStudentPhone.trim()) : '';

    updateStudent(student.id, {
      name: editName,
      studentCode: editStudentCode.trim() || studentCode,
      certificateName: editCertificateName,
      gender: editGender,
      groupId: editGroupId,
      grade: editGrade,
      parentName: editParentName,
      parentPhone: finalParentPhone,
      parentUsername: isParentUser ? cleanParentUser : undefined,
      parentContactType: isParentUser ? 'username' : 'phone',
      studentPhone: finalStudentPhone,
      studentUsername: isStudentUser ? cleanStudentUser : undefined,
      studentContactType: isStudentUser ? 'username' : (hasStudentVal ? 'phone' : undefined),
      notes: editNotes,
      status: editStatus
    });

    setSaveSuccessToast(true);
    confetti({ particleCount: 50, spread: 40 });
    setTimeout(() => {
      setSaveSuccessToast(false);
      setActiveTab('overview');
    }, 1200);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadStudentDocument(student.id, e.target.files[0], selectedCategory);
      confetti({ particleCount: 40, spread: 40 });
    }
  };

  const cleanParentPhone = student.parentPhone.replace(/[^0-9+]/g, '');

  // Helper translations or fallback strings
  

  // Romanized student name representation or standard fallback
  const studentEnglishFallback = student.certificateName || (student.notes?.split('\n')?.[0]?.length && student.notes.split('\n')[0].length < 30
    ? student.notes.split('\n')[0]
    : (student.name || '').split(' ').map(n => n ? n.charAt(0).toUpperCase() + n.slice(1) : '').join(' '));

  return (
    <div
      role="dialog"
      data-modal="true"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{ overscrollBehaviorY: 'contain' }}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col my-2 sm:my-4 max-h-[96vh] sm:max-h-none overscroll-contain"
      >
        
        {/* Top Control Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-1 sm:pb-2 shrink-0">
          <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase truncate">
            {_t('بطاقة الطالب الذكية', 'STUDENT SMART CARD', 'SCHÜLER SMART CARD')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-full transition-colors cursor-pointer text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Details Area matching the mockup */}
        <div className="px-3 sm:px-7 py-3 sm:py-4 space-y-3.5 sm:space-y-5 overflow-y-auto">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-5">
            {/* Left: Avatar with dynamic badge, Name, Parent text */}
            <div className="flex flex-row items-center sm:items-start gap-3 sm:gap-5 w-full">
              <div className="relative shrink-0">
                <AvatarImage
                  name={student.name}
                  className="w-16 h-16 sm:w-[110px] sm:h-[110px] rounded-2xl sm:rounded-[24px] text-xl sm:text-3xl font-black shadow-md"
                />
              </div>

              <div className="space-y-1 text-right flex-1 min-w-0" dir="rtl">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 text-[10px] font-black px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-sky-200/50 dark:border-sky-950/30 inline-block">
                    {student.grade}
                  </span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 sm:py-1 rounded-full border ${
                    (student.gender || (isLikelyFemaleStudent(student.name) ? 'female' : 'male')) === 'female'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
                  }`}>
                    {(student.gender || (isLikelyFemaleStudent(student.name) ? 'female' : 'male')) === 'female' ? '👧 طالبة' : '👦 طالب'}
                  </span>
                </div>
                
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-800 dark:text-white pt-0.5 truncate">
                  {student.name}
                </h2>
                
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider truncate" dir="ltr">
                  {studentEnglishFallback}
                </p>

                {/* Student Code & Parent Portal Quick Actions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {/* Student Code Pill */}
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black shadow-2xs">
                    <span className="text-indigo-500/90 dark:text-indigo-400 text-[9px] font-bold">كود الطالب:</span>
                    <span className="font-mono tracking-wider font-bold">{studentCode}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(studentCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded transition-colors cursor-pointer text-indigo-600 dark:text-indigo-300"
                      title="نسخ كود الطالب"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Share Parent Portal Info Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const shareText = buildParentPortalShareText(student.name, studentCode, profile.displayNameAr || profile.displayName);
                      const targetPhone = student.parentPhone ? student.parentPhone.replace(/[^0-9+]/g, '') : '';
                      const url = buildWhatsAppUrl(targetPhone, shareText);
                      window.open(url, '_blank');
                    }}
                    className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black transition-all cursor-pointer shadow-2xs"
                    title="مشاركة رابط وكود البوابة مع ولي الأمر عبر واتساب"
                  >
                    <Share2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>بوابة ولي الأمر 📱</span>
                  </button>
                </div>

                {student.parentPhone && (
                  <div className="inline-flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-950/20 text-primary px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border border-blue-100/50 dark:border-blue-950/30 max-w-full truncate" dir="ltr">
                    <span className="text-slate-500 dark:text-slate-400 shrink-0">Eltern:</span>
                    {isWhatsAppUsername(student.parentPhone) ? (
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-bold">
                        <AtSign className="w-3 h-3 shrink-0" />
                        {cleanWhatsAppUsername(student.parentPhone)}
                      </span>
                    ) : (
                      <span className="font-mono truncate">{student.parentPhone}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Control Buttons */}
            <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-center sm:justify-start gap-1.5 sm:gap-2 w-full sm:w-auto">
              {/* Active Status Badge */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-black flex items-center gap-1 shadow-2xs whitespace-nowrap">
                <span>{student.status === 'active' ? _t('نشط ✓', 'Active ✓', 'Aktiv ✓') : _t('مؤرشف ⚪', 'Archived ⚪', 'Archiviert ⚪')}</span>
              </div>

              {/* Edit button */}
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer text-[11px] sm:text-xs font-black flex items-center gap-1 shadow-2xs whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 text-primary" />
                <span>{_t('تعديل', 'Bearbeiten', 'Bearbeiten')}</span>
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl transition-all cursor-pointer text-[11px] sm:text-xs font-black flex items-center gap-1 shadow-2xs whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>{_t('حذف', 'Löschen', 'Löschen')}</span>
              </button>
            </div>
          </div>

          {/* Quick Communication Actions (Responsive Grid) */}
          {(() => {
            const resolvedWhatsApp = resolveStudentWhatsAppContact(student);
            const parentHasCallNumber = !!(student.parentPhone && !isWhatsAppUsername(student.parentPhone));
            const studentHasCallNumber = !!(student.studentPhone && !isWhatsAppUsername(student.studentPhone));

            return (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                <a
                  href={resolvedWhatsApp.hasContact ? buildWhatsAppUrl(resolvedWhatsApp.contact) : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`font-extrabold text-[10px] sm:text-xs py-2 sm:py-3 px-1 rounded-xl transition-all flex items-center justify-center gap-1 min-w-0 ${
                    resolvedWhatsApp.hasContact
                      ? 'bg-primary hover:bg-primary-hover active:scale-[0.98] text-white cursor-pointer shadow-sm shadow-primary/20'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {resolvedWhatsApp.isUsername ? `واتساب (@${cleanWhatsAppUsername(resolvedWhatsApp.contact)})` : 'WhatsApp'}
                  </span>
                </a>

                <a
                  href={parentHasCallNumber ? `tel:${student.parentPhone}` : '#'}
                  className={`font-extrabold text-[10px] sm:text-xs py-2 sm:py-3 px-1 rounded-xl transition-all flex items-center justify-center gap-1 text-center shadow-sm min-w-0 ${
                    parentHasCallNumber 
                      ? 'bg-primary hover:bg-primary-hover active:scale-[0.98] text-white cursor-pointer shadow-primary/20' 
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{_t('اتصال بالأب', 'Call Parent', 'Eltern anrufen')}</span>
                </a>

                <a
                  href={studentHasCallNumber ? `tel:${student.studentPhone}` : '#'}
                  className={`font-extrabold text-[10px] sm:text-xs py-2 sm:py-3 px-1 rounded-xl transition-all flex items-center justify-center gap-1 text-center shadow-sm min-w-0 ${
                    studentHasCallNumber 
                      ? 'bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white cursor-pointer shadow-slate-800/20' 
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{_t('اتصال بالطالب', 'Call Student', 'Schüler anrufen')}</span>
                </a>
              </div>
            );
          })()}

          {/* Stat Cards - Responsive Grid */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 text-right" dir="ltr">
            {/* Card 1 */}
            <div className="p-2 sm:p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1 sm:gap-3.5 shadow-3xs hover:border-slate-200 transition-all w-full min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-primary shrink-0">
                <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="space-y-0.5 min-w-0 w-full">
                <span className="block text-[7.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest truncate">SITZUNGEN</span>
                <span className="block text-sm sm:text-xl font-black text-slate-800 dark:text-white leading-none">{studentLessons.length}</span>
                <span className="block text-[7.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">Gesamt</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-2 sm:p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1 sm:gap-3.5 shadow-3xs hover:border-slate-200 transition-all w-full min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500 shrink-0">
                <User className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="space-y-0.5 min-w-0 w-full">
                <span className="block text-[7.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest truncate">ANWESEND</span>
                <span className="block text-sm sm:text-xl font-black text-slate-800 dark:text-white leading-none">{presentCount}</span>
                <span className="block text-[7.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">Sitzungen</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-2 sm:p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1 sm:gap-3.5 shadow-3xs hover:border-slate-200 transition-all w-full min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500 shrink-0">
                <RefreshCw className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="space-y-0.5 min-w-0 w-full">
                <span className="block text-[7.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest truncate">PAKETZYKLUS</span>
                <span className="block text-sm sm:text-xl font-black text-slate-800 dark:text-white leading-none">{currentCycleProgress}/{cycleLength}</span>
                <span className="block text-[7.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">Abgeschlossen</span>
              </div>
            </div>
          </div>

          {/* Profile Tabs Navigation - Scrollable with no scrollbar */}
          <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 p-0.5 overflow-x-auto text-[11px] sm:text-xs font-bold shrink-0 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 transition-all whitespace-nowrap border-b-2 font-black ${
                activeTab === 'overview' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {_t('Übersicht', 'Overview', 'Übersicht')}
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 transition-all whitespace-nowrap border-b-2 font-black ${
                activeTab === 'attendance' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {_t(`Anwesenheit (${presentCount + lateCount + absentCount})`, `Attendance (${presentCount + lateCount + absentCount})`, `Anwesenheit (${presentCount + lateCount + absentCount})`)}
            </button>

            <button
              onClick={() => setActiveTab('scores')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 transition-all whitespace-nowrap border-b-2 font-black ${
                activeTab === 'scores' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {_t('Noten & Aufgaben', 'Grades & Homework', 'Noten & Aufgaben')}
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 transition-all whitespace-nowrap border-b-2 font-black ${
                activeTab === 'payments' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {_t('Zahlungen', 'Payments', 'Zahlungen')}
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 transition-all whitespace-nowrap border-b-2 font-black ${
                activeTab === 'files' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {_t(`Dateien (${student.documents.length})`, `Files (${student.documents.length})`, `Dateien (${student.documents.length})`)}
            </button>

            <button
              onClick={() => setActiveTab('certificates')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 transition-all whitespace-nowrap border-b-2 font-black ${
                activeTab === 'certificates' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {_t(`الشهادات (${studentCertificates.length})`, `Certificates (${studentCertificates.length})`, `Zertifikate (${studentCertificates.length})`)}
            </button>

            <button
              onClick={() => setActiveTab('recordings')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 transition-all whitespace-nowrap border-b-2 font-black flex items-center gap-1 ${
                activeTab === 'recordings' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>{_t(`التسجيلات (${studentRecordings.length})`, `Recordings (${studentRecordings.length})`, `Aufnahmen (${studentRecordings.length})`)}</span>
            </button>
          </div>

          {/* Dynamic Tab Body Component View */}
          <div className="max-h-[38vh] overflow-y-auto space-y-4">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Info Card Block directly matching mockup */}
                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl space-y-3.5">
                  <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Info className="w-4 h-4 text-primary" />
                    <span>{_t('ALLGEMEINE INFORMATIONEN', 'ALLGEMEINE INFORMATIONEN', 'ALLGEMEINE INFORMATIONEN')}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Gruppe */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Gruppe:</span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-white">{assignedGroup?.name || 'N/A'}</span>
                    </div>

                    {/* Klasse */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <GraduationCap className="w-4 h-4 text-indigo-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Klasse:</span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-white">{student.grade}</span>
                    </div>

                    {/* Elternteil */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <User className="w-4 h-4 text-sky-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Elternteil:</span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-white">{student.parentName || 'N/A'}</span>
                    </div>

                    {/* Telefon Eltern */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Telefon Eltern:</span>
                      </div>
                      <span className="font-mono font-black text-slate-800 dark:text-white">{student.parentPhone || 'N/A'}</span>
                    </div>

                    {/* Telefon Schüler */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Telefon Schüler:</span>
                      </div>
                      <span className="font-mono font-black text-slate-800 dark:text-white">{student.studentPhone || 'N/A'}</span>
                    </div>

                    {/* Beigetreten */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Calendar className="w-4 h-4 text-rose-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Beigetreten:</span>
                      </div>
                      <span className="font-mono font-black text-slate-800 dark:text-white">{student.joinedDate || '2026-08-10'}</span>
                    </div>
                  </div>

                  {/* Quick Recordings summary row */}
                  {studentRecordings.length > 0 && (
                    <div 
                      onClick={() => setActiveTab('recordings')}
                      className="p-3 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-purple-600 text-white rounded-xl shadow-2xs">
                          <Video className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-text-main">
                            {_t(`تسجيلات الحصص المتاحة (${studentRecordings.length})`, `Available Session Recordings (${studentRecordings.length})`, `Verfügbare Aufnahmen (${studentRecordings.length})`)}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {_t('انقر لعرض ومشاركة تسجيلات الأجزاء مع الطالب أو ولي الأمر', 'Click to view and share part recordings', 'Klicken zum Anzeigen und Teilen')}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                        {_t('عرض التسجيلات ←', 'View →', 'Anzeigen →')}
                      </span>
                    </div>
                  )}

                  {student.notes && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] block mb-1">Notizen</span>
                      <p className="text-text-main font-semibold italic text-slate-700 dark:text-slate-300 leading-normal">{student.notes}</p>
                    </div>
                  )}
                </div>

                {/* Security Bottom Notice matching mockup */}
                <div className="p-3 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-950/30 rounded-2xl flex items-center justify-between text-xs text-primary font-bold">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4.5 h-4.5 text-primary" />
                    <span>Alle Daten werden sicher gespeichert und regelmäßig gesichert.</span>
                  </div>
                  <Lock className="w-4 h-4 opacity-70" />
                </div>
              </div>
            )}

            {/* ATTENDANCE TAB */}
            {activeTab === 'attendance' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400">Anwesend</span>
                    <span className="text-lg font-black font-mono">{presentCount}</span>
                  </div>
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400">Verspätet</span>
                    <span className="text-lg font-black font-mono">{lateCount}</span>
                  </div>
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400">Abwesend</span>
                    <span className="text-lg font-black font-mono">{absentCount}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Anwesenheitsprotokoll</h4>
                  {studentLessons.length === 0 ? (
                    <p className="text-xs text-text-muted/70 italic text-center py-4">Noch keine Sitzungen vorhanden.</p>
                  ) : (
                    studentLessons.map((l) => {
                      const status = l.report?.studentAttendance?.[student.id] || l.report?.attendanceStatus || 'present';
                      return (
                        <div key={l.id} className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-extrabold text-slate-800 dark:text-white">{l.title}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{l.date} • {l.time} Uhr</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg font-black text-[11px] ${
                            status === 'present' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                            status === 'late' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                            'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                          }`}>
                            {status === 'present' ? 'Anwesend' : status === 'late' ? 'Verspätet' : 'Abwesend'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SCORES & HOMEWORK TAB */}
            {activeTab === 'scores' && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hausaufgaben & Prüfungsergebnisse</h3>
                {studentLessons.filter(l => l.report?.homeworkTitle || l.report?.studentDictationGrade?.[student.id] || l.report?.studentExamGrade?.[student.id]).length === 0 ? (
                  <p className="text-xs text-text-muted/70 italic text-center py-4">Keine Prüfungsergebnisse oder Hausaufgaben verzeichnet.</p>
                ) : (
                  studentLessons.map((l) => {
                    const hwDone = l.report?.studentHomeworkDone?.[student.id];
                    const dictationGrade = l.report?.studentDictationGrade?.[student.id];
                    const examGrade = l.report?.studentExamGrade?.[student.id];
                    const remark = l.report?.studentNotes?.[student.id];

                    if (!hwDone && dictationGrade === undefined && examGrade === undefined && !remark) return null;

                    return (
                      <div key={l.id} className="p-3.5 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                        <div className="flex items-center justify-between font-extrabold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <span className="text-slate-800 dark:text-white">{l.title}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{l.date}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                          {hwDone !== undefined && (
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400">الواجب السابق:</span>
                              <span className={hwDone === 'yes' ? 'text-emerald-600' : 'text-red-500'}>
                                {hwDone === 'yes' ? 'تم الحل 👍' : 'لم يحل 👎'}
                              </span>
                            </div>
                          )}

                          {dictationGrade !== undefined && (
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400">درجة الإملاء:</span>
                              <span className="text-primary font-mono">{dictationGrade} / 10</span>
                            </div>
                          )}

                          {examGrade !== undefined && (
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400">درجة الامتحان:</span>
                              <span className="text-primary font-mono">{examGrade} / 10</span>
                            </div>
                          )}
                        </div>

                        {remark && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-1">
                            <span className="font-extrabold block text-[10px] text-slate-400 uppercase tracking-widest not-italic mb-0.5">ملاحظات الحصة</span>
                            &ldquo;{remark}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Zahlungshistorie (Payment History)</h3>
                {studentPayments.length === 0 ? (
                  <p className="text-xs text-text-muted/70 italic text-center py-4">Keine Zahlungsunterlagen vorhanden.</p>
                ) : (
                  studentPayments.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-extrabold text-slate-800 dark:text-white">{p.groupName}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Fällig am: {p.dueDate}</p>
                      </div>
                      <span className={`font-mono font-black text-xs px-2 py-1 rounded-lg ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {p.amountDue} {profile.currency} ({(p.status || '').toUpperCase()})
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* FILES & DOCUMENTS TAB */}
            {activeTab === 'files' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dokumente</h3>
                  
                  {/* Category selector */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as 'homework' | 'exam' | 'doc')}
                    className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold"
                  >
                    <option value="homework">Homework File</option>
                    <option value="exam">Exam File</option>
                    <option value="doc">Student Doc</option>
                  </select>
                </div>

                {/* Upload Input */}
                <label className="border-2 border-dashed border-primary-border dark:border-primary-border/40 hover:border-primary bg-primary-soft dark:bg-primary-soft/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                  <Upload className="w-7 h-7 text-primary mb-1.5 animate-bounce" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Klicken zum Hochladen (Upload PDF / Document)
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">PDF, Word, PNG oder Exam Dokumente</span>
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                </label>

                {/* Uploaded Files List */}
                <div className="space-y-2">
                  {student.documents.length === 0 ? (
                    <p className="text-xs text-text-muted/70 text-center py-4 italic">
                      Keine Dokumente hochgeladen.
                    </p>
                  ) : (
                    student.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-primary-soft dark:bg-primary-soft text-primary rounded-xl">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 dark:text-white line-clamp-1">{doc.fileName}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                              {doc.fileSize} • {doc.uploadedAt} • <span className="uppercase font-bold text-primary">{doc.category}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <a
                            href={doc.url}
                            download={doc.fileName}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-primary"
                            title="Herunterladen"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => deleteStudentDocument(student.id, doc.id)}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* CERTIFICATES TAB */}
            {activeTab === 'certificates' && (
              <div className="space-y-4">
                {/* Header with quick action */}
                <div className="flex items-center justify-between p-3.5 bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <Award className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <h4 className="font-black text-xs text-text-main">
                        {_t('سجل شهادات وتكريم الطالب', 'Student Certificates & Honors', 'Zertifikate & Ehrungen')}
                      </h4>
                      <p className="text-[10px] text-text-muted">
                        {studentCertificates.length} {_t('شهادات تم إصدارها', 'certificates issued', 'Zertifikate ausgestellt')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsIssueCertModalOpen(true)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{_t('إصدار شهادة', 'Issue Certificate', 'Zertifikat ausstellen')}</span>
                  </button>
                </div>

                {/* Latin Name on Certificate Setting */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                      {_t('الاسم بالإنجليزية / اللاتينية للشهادات:', 'Name on Certificate (Latin):', 'Name auf dem Zertifikat (Latein):')}
                    </label>
                    {isLatinSaved && (
                      <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {_t('تم الحفظ', 'Saved', 'Gespeichert')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={latinNameInput}
                      onChange={e => setLatinNameInput(e.target.value)}
                      placeholder="e.g. Ahmed Ali"
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateStudentCertificateName(student.id, latinNameInput);
                        setIsLatinSaved(true);
                        setTimeout(() => setIsLatinSaved(false), 2000);
                      }}
                      className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-colors cursor-pointer"
                    >
                      {_t('حفظ', 'Save', 'Speichern')}
                    </button>
                  </div>
                </div>

                {/* Certificates List */}
                <div className="space-y-2">
                  {studentCertificates.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <Award className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {_t('لم يتم إصدار شهادات لهذا الطالب حتى الآن', 'No certificates issued for this student yet', 'Noch keine Zertifikate ausgestellt')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsIssueCertModalOpen(true)}
                        className="text-xs font-black text-primary hover:underline cursor-pointer"
                      >
                        {_t('انقر هنا لإصدار أول شهادة تقدير 🏆', 'Click here to issue first certificate 🏆', 'Erstes Zertifikat jetzt ausstellen 🏆')}
                      </button>
                    </div>
                  ) : (
                    studentCertificates.map(cert => (
                      <div
                        key={cert.id}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:border-slate-200 transition-all"
                      >
                        <div
                          onClick={() => setPreviewCert(cert)}
                          className="min-w-0 cursor-pointer flex-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs text-slate-800 dark:text-white truncate">
                              {cert.courseOrLevelTitle}
                            </span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {cert.language}
                            </span>
                          </div>
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {cert.issueDate} • {cert.instructorName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewCert(cert)}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadCertificatePDF(cert)}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => shareCertificateWhatsApp(cert, student.parentPhone || student.studentPhone)}
                            className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                            title="Share WhatsApp"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* RECORDINGS TAB */}
            {activeTab === 'recordings' && (
              <div className="space-y-4">
                {/* Header with Grain Quick Access */}
                <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-primary/10 border border-purple-200 dark:border-purple-900/40 rounded-2xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-purple-600 text-white rounded-xl shadow-2xs shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-xs text-text-main truncate">
                        {_t('تسجيلات حصص الطالب', 'Student Lesson Recordings', 'Schüler-Aufnahmen')}
                      </h4>
                      <p className="text-[10px] text-text-muted truncate">
                        {studentRecordings.length} {_t('تسجيلات متاحة لمشاهدتها ومشاركتها', 'recordings available', 'Aufnahmen verfügbar')}
                      </p>
                    </div>
                  </div>

                  <a
                    href="https://grain.com/app/meetings"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Grain</span>
                  </a>
                </div>

                {/* Recordings List */}
                <div className="space-y-2.5">
                  {studentRecordings.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <Video className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {_t('لا توجد تسجيلات محفوظة لحصص هذا الطالب حتى الآن', 'No recordings saved for this student yet', 'Noch keine Aufnahmen vorhanden')}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {_t('عند تسجيل تقرير الحصة وإضافة رابط Grain أو غيره، ستظهر هنا تلقائياً', 'Recordings added to lesson reports will appear here automatically', 'Werden automatisch aus den Berichten geladen')}
                      </p>
                    </div>
                  ) : (
                    studentRecordings.map((lesson) => {
                      const r1 = lesson.recordingLink?.trim() || lesson.report?.recordingLink?.trim();
                      const r2 = lesson.recordingLink2?.trim() || lesson.report?.recordingLink2?.trim();
                      const attStatus = lesson.report?.studentAttendance?.[student.id] || (lesson.studentId === student.id ? lesson.report?.attendanceStatus : undefined);

                      return (
                        <div
                          key={lesson.id}
                          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-3xs hover:border-primary/40 transition-all space-y-2.5"
                        >
                          {/* Top: Session Badge, Title, Date & Time */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-2 py-0.5 bg-primary/10 text-primary font-black text-[10px] rounded-md shrink-0 font-mono">
                                {lesson.sessionNumber ? `حصة ${lesson.sessionNumber}` : `${lesson.date}`}
                              </span>
                              <span className="text-xs font-black text-slate-800 dark:text-white truncate">
                                {lesson.title || lesson.groupName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {attStatus && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  attStatus === 'present' 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                                    : attStatus === 'late'
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                }`}>
                                  {attStatus === 'present' ? 'حاضر' : attStatus === 'late' ? 'متأخر' : 'غائب'}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-bold font-mono">
                                {lesson.date}
                              </span>
                            </div>
                          </div>

                          {/* Homework / Topic summary */}
                          {(lesson.report?.homeworkTitle || lesson.whatWasTaught) && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium line-clamp-1">
                              <span className="font-bold text-slate-800 dark:text-white">{_t('موضوع الحصة: ', 'Topic: ', 'Thema: ')}</span>
                              {lesson.report?.homeworkTitle || lesson.whatWasTaught}
                            </p>
                          )}

                          {/* Recording Links & Actions */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            {r1 && (
                              <div className="inline-flex items-center gap-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 rounded-xl p-1">
                                <a
                                  href={r1}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-lg transition-all flex items-center gap-1 shadow-2xs"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>{r2 ? _t('مشاهدة الجزء 1', 'Watch Part 1', 'Teil 1 ansehen') : _t('مشاهدة التسجيل', 'Watch Recording', 'Aufnahme ansehen')}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyStudentRecLink(lesson.id, r1)}
                                  className="p-1.5 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-lg cursor-pointer transition-colors"
                                  title={_t('نسخ رابط التسجيل', 'Copy Link', 'Link kopieren')}
                                >
                                  {copiedRecId === `${lesson.id}_${r1}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {r2 && (
                              <div className="inline-flex items-center gap-1 bg-fuchsia-50 dark:bg-fuchsia-950/30 border border-fuchsia-200 dark:border-fuchsia-900/50 rounded-xl p-1">
                                <a
                                  href={r2}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black text-xs rounded-lg transition-all flex items-center gap-1 shadow-2xs"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>{_t('مشاهدة الجزء 2', 'Watch Part 2', 'Teil 2 ansehen')}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyStudentRecLink(lesson.id, r2)}
                                  className="p-1.5 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300 rounded-lg cursor-pointer transition-colors"
                                  title={_t('نسخ رابط الجزء 2', 'Copy Part 2 Link', 'Link kopieren')}
                                >
                                  {copiedRecId === `${lesson.id}_${r2}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Direct WhatsApp Share to student / parent */}
                            <button
                              type="button"
                              onClick={() => handleShareStudentRecWhatsApp(lesson)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ml-auto"
                              title={_t('إرسال التسجيل عبر واتساب', 'Send via WhatsApp', 'Per WhatsApp senden')}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{_t('إرسال لواتساب الطالب', 'Share WhatsApp', 'Per WhatsApp')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* EDIT STUDENT DATA TAB */}
            {activeTab === 'edit' && (
              <form onSubmit={handleSaveStudent} className="space-y-3.5 pt-1">
                {/* Student Code, Name & English Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>{_t('كود الطالب (Portal Code)', 'Student Code', 'Schüler-Code')}</span>
                      <span className="text-[10px] text-primary font-bold">لبوابة ولي الأمر</span>
                    </label>
                    <input
                      type="text"
                      value={editStudentCode}
                      onChange={(e) => setEditStudentCode(e.target.value)}
                      placeholder="e.g. STU-1001"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary text-primary dark:text-sky-300 uppercase tracking-wider"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      {_t('اسم الطالب (Student Name) *', 'Student Name *', 'Schüler Name *')}
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      {_t('الاسم بالإنجليزية للشهادات (English Name)', 'English Name for Certificates', 'Englischer Name für Zertifikate')}
                    </label>
                    <input
                      type="text"
                      value={editCertificateName}
                      onChange={(e) => setEditCertificateName(e.target.value)}
                      placeholder="e.g. Ahmed Ali"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white font-mono tracking-wide"
                    />
                  </div>
                </div>

                {/* Gender Toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {_t('جنس الطالب (Gender)', 'Gender', 'Geschlecht')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditGender('male')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editGender === 'male'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>👦</span>
                      <span>{_t('ولد (طالب)', 'Boy', 'Junge')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditGender('female')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editGender === 'female'
                          ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>👧</span>
                      <span>{_t('بنت (طالبة)', 'Girl', 'Mädchen')}</span>
                    </button>
                  </div>
                </div>

                {/* Group & Grade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Zugewiesene Gruppe (Group)
                    </label>
                    <select
                      value={editGroupId}
                      onChange={(e) => setEditGroupId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.grade})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      {_t('المستوى / الصف الدراسي', 'Grade / Course Level', 'Klassenstufe / Niveau')}
                    </label>
                    <select
                      value={editGrade}
                      onChange={(e) => setEditGrade(e.target.value as GradeLevel)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    >
                      <optgroup label={_t('مستويات الكورسات واللغات (Courses)', 'Course Levels (Language)', 'Sprachniveaus')}>
                        {COURSE_LEVELS.map(g => (
                          <option key={g} value={g}>
                            {g} - {_t(g === 'A1' ? 'A1 (مبتدئ أول)' : g === 'A2' ? 'A2 (مبتدئ متقدم)' : g === 'B1' ? 'B1 (متوسط أول)' : g === 'B2' ? 'B2 (متوسط متقدم)' : g === 'C1' ? 'C1 (متقدم)' : 'C2 (متقن)', g, g)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={_t('الصفوف المدرسية (School Grades)', 'School Grades', 'Schulklassen')}>
                        {SCHOOL_GRADES.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Parent Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Eltern Name (Parent Name)
                    </label>
                    <input
                      type="text"
                      value={editParentName}
                      onChange={(e) => setEditParentName(e.target.value)}
                      placeholder="Herr / Frau Ali"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                        {_t('هاتف / يوزر نيم ولي الأمر', 'Parent Phone / WhatsApp Username', 'Eltern Telefon / WhatsApp-User')}
                      </label>
                      <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setEditParentContactType('phone');
                            if (editParentPhone.startsWith('@')) setEditParentPhone(editParentPhone.replace(/^@/, ''));
                          }}
                          className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                            editParentContactType === 'phone'
                              ? 'bg-primary text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>{_t('هاتف', 'Phone', 'Tel')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditParentContactType('username');
                            if (editParentPhone && !editParentPhone.startsWith('@')) setEditParentPhone(`@${editParentPhone}`);
                          }}
                          className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                            editParentContactType === 'username'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <AtSign className="w-2.5 h-2.5" />
                          <span>{_t('يوزر نيم', 'Username', 'User')}</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
                        {editParentContactType === 'username' ? (
                          <AtSign className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode={editParentContactType === 'phone' ? 'tel' : 'text'}
                        dir="ltr"
                        value={editParentPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditParentPhone(val);
                          if (val.startsWith('@') || (val.length > 2 && /[a-zA-Z]/.test(val))) {
                            setEditParentContactType('username');
                          }
                        }}
                        placeholder={editParentContactType === 'username' ? '@username (e.g. @ahmed_ali)' : '+20 10...'}
                        className="w-full ps-9 pe-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Student Phone & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                        {_t('هاتف / يوزر نيم الطالب (اختياري)', 'Student Direct Phone / Username (Optional)', 'Schüler Telefon / User')}
                      </label>
                      <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setEditStudentContactType('phone');
                            if (editStudentPhone.startsWith('@')) setEditStudentPhone(editStudentPhone.replace(/^@/, ''));
                          }}
                          className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                            editStudentContactType === 'phone'
                              ? 'bg-primary text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>{_t('هاتف', 'Phone', 'Tel')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditStudentContactType('username');
                            if (editStudentPhone && !editStudentPhone.startsWith('@')) setEditStudentPhone(`@${editStudentPhone}`);
                          }}
                          className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                            editStudentContactType === 'username'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <AtSign className="w-2.5 h-2.5" />
                          <span>{_t('يوزر نيم', 'Username', 'User')}</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
                        {editStudentContactType === 'username' ? (
                          <AtSign className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode={editStudentContactType === 'phone' ? 'tel' : 'text'}
                        dir="ltr"
                        value={editStudentPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditStudentPhone(val);
                          if (val.startsWith('@') || (val.length > 2 && /[a-zA-Z]/.test(val))) {
                            setEditStudentContactType('username');
                          }
                        }}
                        placeholder={editStudentContactType === 'username' ? '@student_user' : '+20 11...'}
                        className="w-full ps-9 pe-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Status (Student Status)
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as 'active' | 'archived')}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    >
                      <option value="active">🟢 Aktiv (Active Student)</option>
                      <option value="archived">⚪ Pausiert / Archiviert (Archived)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Notizen (Teacher Notes)
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notizen zum Schüler, Lernstand..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                  />
                </div>

                {saveSuccessToast && (
                  <div className="bg-primary text-white text-xs font-bold p-2.5 rounded-xl flex items-center justify-center gap-2 animate-scale-up">
                    <Check className="w-4 h-4" />
                    <span>✓ Schülerdaten erfolgreich aktualisiert!</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-black text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Änderungen Speichern (Save Changes)</span>
                </button>
              </form>
            )}
          </div>
        </div>

      </div>

      <DeleteConfirmModal
        isOpen={isConfirmingDelete}
        itemType="student"
        itemName={student.name}
        recordsSummary={{
          lessonsCount: studentLessons.length,
          paymentsCount: studentPayments.length,
          attendanceCount: studentLessons.filter(l => l.report?.attendanceStatus).length,
        }}
        onConfirmDelete={() => {
          deleteStudent(student.id);
          setIsConfirmingDelete(false);
          onClose();
        }}
        onConfirmArchive={() => {
          deleteStudent(student.id);
          setIsConfirmingDelete(false);
          onClose();
        }}
        onClose={() => setIsConfirmingDelete(false)}
      />

      {/* Certificate Modals */}
      {isIssueCertModalOpen && (
        <CreateCertificateModal
          initialStudentId={student.id}
          onClose={() => setIsIssueCertModalOpen(false)}
        />
      )}

      {previewCert && (
        <CertificatePreviewModal
          certificate={previewCert}
          onClose={() => setPreviewCert(null)}
        />
      )}
    </div>
  );
};
