import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Student, GradeLevel, CertificateRecord, ScheduleRecurrence } from '../types';
import { COURSE_LEVELS, SCHOOL_GRADES } from '../data/initialData';
import { getStudentCyclePricing } from '../utils/paymentUtils';
import { buildWhatsAppUrl, isWhatsAppUsername, cleanWhatsAppUsername, formatContactDisplay, resolveStudentWhatsAppContact, cleanPhoneNumberForTel } from '../utils/phoneUtils';
import { CARTOON_AVATARS, DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { AvatarImage } from './AvatarImage';
import { 
  X, Phone, Send, FileText, Upload, Trash2, Calendar, Award, DollarSign, 
  BookOpen, CheckCircle2, AlertCircle, Download, FileCheck, User, Edit3, Save, Check, Sparkles,
  RefreshCw, Shield, Lock, MoreHorizontal, MessageSquare, Info, Star, GraduationCap, Users, Plus, Eye, Share2,
  AtSign, Video, ExternalLink, Copy, Play, Repeat, RotateCcw
} from 'lucide-react';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CreateCertificateModal } from './certificates/CreateCertificateModal';
import { CertificatePreviewModal } from './certificates/CertificatePreviewModal';
import { downloadCertificatePDF, shareCertificateWhatsApp } from '../utils/certificateExportUtils';
import { isLikelyFemaleStudent } from '../utils/genderUtils';
import { ensureTwoPartName, transliterateArabicNameToEnglish } from '../utils/nameUtils';
import { normalizeEgyptianPhone } from '../utils/contactsStandardizer';

interface StudentProfileModalProps {
  student: Student;
  onClose: () => void;
  initialTab?: 'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'certificates' | 'recordings' | 'edit';
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ student, onClose, initialTab = 'overview' }) => {
  const { students, groups, lessons, payments, certificates, profile, uploadStudentDocument, deleteStudentDocument, updateStudent, updateStudentCertificateName, deleteStudent, archiveStudent, t, _t } = useApp();

  // Always resolve the live, updated student record from AppContext
  const currentStudent = (students || []).find(s => s.id === student.id) || student;

  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'certificates' | 'recordings' | 'edit'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<'homework' | 'exam' | 'doc'>('homework');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isIssueCertModalOpen, setIsIssueCertModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);
  const [latinNameInput, setLatinNameInput] = useState(currentStudent.certificateName || '');
  const [isLatinSaved, setIsLatinSaved] = useState(false);
  const [copiedRecId, setCopiedRecId] = useState<string | null>(null);

  // Lock body scroll while modal is active and handle Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Editable Student Fields
  const [editName, setEditName] = useState(currentStudent.name || '');
  const [editCertificateName, setEditCertificateName] = useState(currentStudent.certificateName || '');
  const [editGender, setEditGender] = useState<'male' | 'female'>(currentStudent.gender || (isLikelyFemaleStudent(currentStudent.name) ? 'female' : 'male'));
  const [editGroupId, setEditGroupId] = useState(currentStudent.groupId || '');
  const [editGrade, setEditGrade] = useState<GradeLevel>(currentStudent.grade);
  const [editParentName, setEditParentName] = useState(currentStudent.parentName || '');
  const isInitialParentUser = isWhatsAppUsername(currentStudent.parentPhone) || currentStudent.parentContactType === 'username';
  const isInitialStudentUser = isWhatsAppUsername(currentStudent.studentPhone) || currentStudent.studentContactType === 'username';
  const [editParentContactType, setEditParentContactType] = useState<'phone' | 'username'>(isInitialParentUser ? 'username' : 'phone');
  const [editParentPhone, setEditParentPhone] = useState(currentStudent.parentPhone || '');
  const [editStudentContactType, setEditStudentContactType] = useState<'phone' | 'username'>(isInitialStudentUser ? 'username' : 'phone');
  const [editStudentPhone, setEditStudentPhone] = useState(currentStudent.studentPhone || '');
  const [editNotes, setEditNotes] = useState(currentStudent.notes || '');
  const [editScheduleRecurrence, setEditScheduleRecurrence] = useState<ScheduleRecurrence>(currentStudent.scheduleRecurrence || 'weekly');
  const [editStatus, setEditStatus] = useState<'active' | 'archived'>(currentStudent.status || 'active');
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);

  // Synchronize form states whenever currentStudent updates in AppContext
  useEffect(() => {
    const parentIsUser = isWhatsAppUsername(currentStudent.parentPhone) || currentStudent.parentContactType === 'username';
    const studentIsUser = isWhatsAppUsername(currentStudent.studentPhone) || currentStudent.studentContactType === 'username';

    setEditName(currentStudent.name || '');
    setEditCertificateName(currentStudent.certificateName || '');
    setEditGender(currentStudent.gender || (isLikelyFemaleStudent(currentStudent.name) ? 'female' : 'male'));
    setEditGroupId(currentStudent.groupId || '');
    setEditGrade(currentStudent.grade);
    setEditParentName(currentStudent.parentName || '');
    setEditParentContactType(parentIsUser ? 'username' : 'phone');
    setEditParentPhone(currentStudent.parentPhone || '');
    setEditStudentContactType(studentIsUser ? 'username' : 'phone');
    setEditStudentPhone(currentStudent.studentPhone || '');
    setEditNotes(currentStudent.notes || '');
    setEditScheduleRecurrence(currentStudent.scheduleRecurrence || 'weekly');
    setEditStatus(currentStudent.status || 'active');
    setLatinNameInput(currentStudent.certificateName || '');
  }, [
    currentStudent.id,
    currentStudent.updatedAt,
    currentStudent.name,
    currentStudent.certificateName,
    currentStudent.gender,
    currentStudent.groupId,
    currentStudent.grade,
    currentStudent.parentName,
    currentStudent.parentPhone,
    currentStudent.studentPhone,
    currentStudent.notes,
    currentStudent.scheduleRecurrence,
    currentStudent.status
  ]);

  // Track modified fields compared against current student state
  const initialGender = currentStudent.gender || (isLikelyFemaleStudent(currentStudent.name) ? 'female' : 'male');
  const initialParentContactType = isWhatsAppUsername(currentStudent.parentPhone) || currentStudent.parentContactType === 'username' ? 'username' : 'phone';
  const initialStudentContactType = isWhatsAppUsername(currentStudent.studentPhone) || currentStudent.studentContactType === 'username' ? 'username' : 'phone';

  const isNameDiff = editName.trim() !== (currentStudent.name || '').trim();
  const isCertificateNameDiff = editCertificateName.trim() !== (currentStudent.certificateName || '').trim();
  const isGenderDiff = editGender !== initialGender;
  const isGroupDiff = editGroupId !== currentStudent.groupId;
  const isGradeDiff = editGrade !== currentStudent.grade;
  const isScheduleDiff = editScheduleRecurrence !== (currentStudent.scheduleRecurrence || 'weekly');
  const isParentNameDiff = editParentName.trim() !== (currentStudent.parentName || '').trim();
  const isParentPhoneDiff = editParentPhone.trim() !== (currentStudent.parentPhone || '').trim();
  const isStudentPhoneDiff = editStudentPhone.trim() !== (currentStudent.studentPhone || '').trim();
  const isNotesDiff = editNotes.trim() !== (currentStudent.notes || '').trim();
  const isStatusDiff = editStatus !== (currentStudent.status || 'active');

  const modifiedFieldsCount = [
    isNameDiff,
    isCertificateNameDiff,
    isGenderDiff,
    isGroupDiff,
    isGradeDiff,
    isScheduleDiff,
    isParentNameDiff,
    isParentPhoneDiff,
    isStudentPhoneDiff,
    isNotesDiff,
    isStatusDiff
  ].filter(Boolean).length;

  const handleResetAllEdits = () => {
    setEditName(currentStudent.name || '');
    setEditCertificateName(currentStudent.certificateName || '');
    setEditGender(initialGender);
    setEditGroupId(currentStudent.groupId || '');
    setEditGrade(currentStudent.grade);
    setEditParentName(currentStudent.parentName || '');
    setEditParentContactType(initialParentContactType);
    setEditParentPhone(currentStudent.parentPhone || '');
    setEditStudentContactType(initialStudentContactType);
    setEditStudentPhone(currentStudent.studentPhone || '');
    setEditNotes(currentStudent.notes || '');
    setEditScheduleRecurrence(currentStudent.scheduleRecurrence || 'weekly');
    setEditStatus(currentStudent.status || 'active');
  };

  const assignedGroup = (groups || []).find(g => g.id === (activeTab === 'edit' ? editGroupId : currentStudent.groupId));
  const studentCertificates = (certificates || []).filter(c => c.studentId === currentStudent.id && !c.deleted);
  const studentLessons = (lessons || []).filter(l => {
    if (l.status === 'cancelled') return false;
    const matchesGroup = currentStudent.groupId ? l.groupId === currentStudent.groupId : false;
    const matchesStudent = l.studentId === currentStudent.id || l.studentName === currentStudent.name;
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
    
    let msg = _t(
      `🎥 *تسجيل الحصة للطالب/ة: ${student.name}*\n📅 التاريخ: ${lesson.date} (${lesson.time || ''})\n`,
      `🎥 *Lesson Recording for: ${student.name}*\n📅 Date: ${lesson.date} (${lesson.time || ''})\n`,
      `🎥 *Lektionsaufnahme für: ${student.name}*\n📅 Datum: ${lesson.date} (${lesson.time || ''})\n`
    );
    if (lesson.sessionNumber) {
      msg += _t(`🔢 الحصة رقم: ${lesson.sessionNumber}\n`, `🔢 Session No: ${lesson.sessionNumber}\n`, `🔢 Lektionsnummer: ${lesson.sessionNumber}\n`);
    }
    const topic = (lesson.report?.homeworkTitle || lesson.title || '').trim();
    if (topic) {
      msg += _t(`📖 الموضوع: ${topic}\n`, `📖 Topic: ${topic}\n`, `📖 Thema: ${topic}\n`);
    }
    msg += `\n`;

    if (r1 && r2) {
      msg += _t(
        `🎥 *تسجيلات الحصة (جزئين):*\n• الجزء الأول: ${r1}\n• الجزء الثاني: ${r2}\n`,
        `🎥 *Lesson Recordings (2 Parts):*\n• Part 1: ${r1}\n• Part 2: ${r2}\n`,
        `🎥 *Lektionsaufnahmen (2 Teile):*\n• Teil 1: ${r1}\n• Teil 2: ${r2}\n`
      );
    } else if (r1) {
      msg += _t(`🎥 *رابط تسجيل الحصة:* ${r1}\n`, `🎥 *Lesson Recording Link:* ${r1}\n`, `🎥 *Aufnahmelink:* ${r1}\n`);
    } else if (r2) {
      msg += _t(`🎥 *رابط تسجيل الحصة:* ${r2}\n`, `🎥 *Lesson Recording Link:* ${r2}\n`, `🎥 *Aufnahmelink:* ${r2}\n`);
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
  const presentCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[currentStudent.id] || l.report.attendanceStatus || 'present') === 'present').length;
  const lateCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[currentStudent.id] || l.report.attendanceStatus || 'present') === 'late').length;
  const absentCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[currentStudent.id] || l.report.attendanceStatus || 'present') === 'absent').length;

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const isParentUser = editParentContactType === 'username' || isWhatsAppUsername(editParentPhone);
    const cleanParentUser = cleanWhatsAppUsername(editParentPhone);
    const finalParentPhone = isParentUser 
      ? (cleanParentUser ? `@${cleanParentUser}` : '') 
      : normalizeEgyptianPhone(editParentPhone.trim());

    const hasStudentVal = !!editStudentPhone.trim();
    const isStudentUser = hasStudentVal && (editStudentContactType === 'username' || isWhatsAppUsername(editStudentPhone));
    const cleanStudentUser = hasStudentVal ? cleanWhatsAppUsername(editStudentPhone) : '';
    const finalStudentPhone = hasStudentVal 
      ? (isStudentUser ? (cleanStudentUser ? `@${cleanStudentUser}` : '') : normalizeEgyptianPhone(editStudentPhone.trim())) 
      : '';

    updateStudent(currentStudent.id, {
      name: editName.trim(),
      certificateName: editCertificateName.trim(),
      gender: editGender,
      groupId: editStatus === 'archived' ? '' : editGroupId,
      archivedGroupId: editStatus === 'archived' ? (editGroupId || currentStudent.groupId || currentStudent.archivedGroupId || '') : currentStudent.archivedGroupId,
      scheduleRecurrence: editScheduleRecurrence,
      grade: editGrade,
      parentName: editParentName.trim(),
      parentPhone: finalParentPhone,
      parentUsername: isParentUser ? cleanParentUser : '',
      parentContactType: isParentUser ? 'username' : 'phone',
      studentPhone: finalStudentPhone,
      studentUsername: isStudentUser ? cleanStudentUser : '',
      studentContactType: isStudentUser ? 'username' : (hasStudentVal ? 'phone' : 'phone'),
      notes: editNotes.trim(),
      status: editStatus,
      updatedAt: Date.now()
    });

    setSaveSuccessToast(true);
    setTimeout(() => {
      setSaveSuccessToast(false);
      setActiveTab('overview');
    }, 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadStudentDocument(student.id, e.target.files[0], selectedCategory);
      /* confetti removed */
    }
  };

  const cleanParentPhone = cleanPhoneNumberForTel(student.parentPhone);

  // Helper translations or fallback strings
  

  return (
    <div
      role="dialog"
      data-modal="true"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[92vh] sm:max-h-[88vh]"
      >
        
        {/* Fixed Top Control Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 border-b border-surface-border bg-surface shrink-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[10px] sm:text-xs font-black tracking-wider text-text-muted uppercase shrink-0">
              {_t('بطاقة الطالب الذكية', 'STUDENT CARD', 'SCHÜLER SMART CARD')}
            </span>
            <span className="text-[10px] font-black text-primary shrink-0">
              {currentStudent.grade}
            </span>
            <span className="text-text-muted/40">•</span>
            <span className="text-[10px] font-bold text-text-muted shrink-0">
              {(currentStudent.gender || (isLikelyFemaleStudent(currentStudent.name) ? 'female' : 'male')) === 'female' ? '👧 طالبة' : '👦 طالب'}
            </span>
            <span className="text-text-muted/40">•</span>
            <span className={`text-[10px] font-bold shrink-0 ${
              currentStudent.status === 'active' ? 'text-primary' : 'text-text-muted'
            }`}>
              {currentStudent.status === 'active' ? _t('نشط ✓', 'Active ✓', 'Aktiv ✓') : _t('مؤرشف ⚪', 'Archived ⚪', 'Archiviert ⚪')}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            title="Schließen"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scroll Container with tightened compact spacing */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-3 sm:px-5 py-2.5 space-y-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
          
          {/* Hero Profile Identity Card - Sleek, compact & tight spacing */}
          <div className="p-2.5 sm:p-3 bg-surface-hover/60 border border-surface-border rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2" dir="rtl">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <AvatarImage
                  name={currentStudent.name}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-base sm:text-lg font-black shadow-2xs border border-surface-border shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-sm sm:text-base font-black text-text-main tracking-tight truncate">
                      {currentStudent.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        const nextGender = (currentStudent.gender || (isLikelyFemaleStudent(currentStudent.name) ? 'female' : 'male')) === 'female' ? 'male' : 'female';
                        updateStudent(currentStudent.id, { gender: nextGender });
                      }}
                      className="text-[10px] font-bold text-text-muted hover:text-primary transition-colors cursor-pointer"
                      title={_t('انقر لتغيير التحديد بين ولد وبنت', 'Click to toggle gender', 'Klicken zum Ändern')}
                    >
                      ✏️
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] text-text-muted mt-0.5">
                    {assignedGroup ? (
                      <span className="font-extrabold text-primary bg-primary-soft border border-primary-border/40 px-1.5 py-0.2 rounded-md truncate max-w-[150px] sm:max-w-[220px]">
                        {assignedGroup.name}
                      </span>
                    ) : (
                      <span className="font-medium bg-surface-hover px-1.5 py-0.2 rounded-md">
                        {_t('بدون مجموعة', 'No Group', 'Keine Gruppe')}
                      </span>
                    )}

                    {currentStudent.scheduleRecurrence === 'biweekly_a' && (
                      <span className="font-bold text-[9.5px] px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        🅰️ {_t('أسبوع (أ)', 'Bi-weekly (A)', 'Alle 2 Wochen (A)')}
                      </span>
                    )}
                    {currentStudent.scheduleRecurrence === 'biweekly_b' && (
                      <span className="font-bold text-[9.5px] px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        🅱️ {_t('أسبوع (ب)', 'Bi-weekly (B)', 'Alle 2 Wochen (B)')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons (Edit & Delete) positioned neatly inline */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className="px-2 py-1 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-primary" />
                  <span>{_t('تعديل', 'Edit', 'Bearbeiten')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/40 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{_t('حذف', 'Delete', 'Löschen')}</span>
                </button>
              </div>
            </div>

            {/* Bottom Row inside card: Phone Bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-border/50 text-[10.5px]">
              {currentStudent.parentPhone && (
                <span className="font-mono text-text-muted font-bold flex items-center gap-1 truncate" dir="ltr">
                  📞 {formatContactDisplay(currentStudent.parentPhone)}
                </span>
              )}
            </div>
          </div>

          {/* Quick Communication Actions (Responsive 3-Column Grid) */}
          {(() => {
            const resolvedWhatsApp = resolveStudentWhatsAppContact(student);
            const parentHasCallNumber = !!(student.parentPhone && !isWhatsAppUsername(student.parentPhone));
            const studentHasCallNumber = !!(student.studentPhone && !isWhatsAppUsername(student.studentPhone));

            return (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                <a
                  href={resolvedWhatsApp.hasContact ? buildWhatsAppUrl(resolvedWhatsApp.contact) : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`font-black text-[11px] sm:text-xs py-2 sm:py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 min-w-0 ${
                    resolvedWhatsApp.hasContact
                      ? 'bg-primary hover:bg-primary-hover active:scale-[0.98] text-white cursor-pointer shadow-xs'
                      : 'bg-surface-hover text-text-muted cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{_t('واتساب', 'WhatsApp', 'WhatsApp')}</span>
                </a>

                <a
                  href={parentHasCallNumber ? `tel:${student.parentPhone}` : '#'}
                  className={`font-black text-[11px] sm:text-xs py-2 sm:py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center min-w-0 ${
                    parentHasCallNumber 
                      ? 'bg-primary hover:bg-primary-hover active:scale-[0.98] text-white cursor-pointer shadow-xs' 
                      : 'bg-surface-hover text-text-muted cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{_t('اتصال بالأب', 'Call Parent', 'Eltern anrufen')}</span>
                </a>

                <a
                  href={studentHasCallNumber ? `tel:${student.studentPhone}` : '#'}
                  className={`font-black text-[11px] sm:text-xs py-2 sm:py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center min-w-0 ${
                    studentHasCallNumber 
                      ? 'bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white cursor-pointer shadow-xs' 
                      : 'bg-surface-hover text-text-muted cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{_t('اتصال بالطالب', 'Call Student', 'Schüler anrufen')}</span>
                </a>
              </div>
            );
          })()}

          {/* 3-Stat Metric Cards - Perfectly Proportioned */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-center" dir="ltr">
            {/* SITZUNGEN */}
            <div className="p-2 sm:p-3 bg-surface border border-surface-border rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-2xs">
              <div className="flex items-center gap-1 text-primary">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-text-muted">{_t('الحصص', 'SESSIONS', 'SITZUNGEN')}</span>
              </div>
              <span className="text-sm sm:text-lg font-black text-text-main leading-tight font-mono">{studentLessons.length}</span>
              <span className="text-[8px] sm:text-[9px] text-text-muted font-bold">{_t('الحصص الكلية', 'Total Sessions', 'Gesamt')}</span>
            </div>

            {/* ANWESEND */}
            <div className="p-2 sm:p-3 bg-surface border border-surface-border rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-2xs">
              <div className="flex items-center gap-1 text-emerald-500">
                <User className="w-3.5 h-3.5" />
                <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-text-muted">{_t('الحضور', 'ATTENDED', 'ANWESEND')}</span>
              </div>
              <span className="text-sm sm:text-lg font-black text-text-main leading-tight font-mono">{presentCount}</span>
              <span className="text-[8px] sm:text-[9px] text-text-muted font-bold">{_t('حضور الحصص', 'Attended', 'Anwesend')}</span>
            </div>

            {/* PAKETZYKLUS */}
            <div className="p-2 sm:p-3 bg-surface border border-surface-border rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-2xs">
              <div className="flex items-center gap-1 text-primary">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-text-muted">{_t('الدورة', 'CYCLE', 'PAKETZYKLUS')}</span>
              </div>
              <span className="text-sm sm:text-lg font-black text-text-main leading-tight font-mono">{currentCycleProgress}/{cycleLength}</span>
              <span className="text-[8px] sm:text-[9px] text-text-muted font-bold">{_t('دورة الحساب', 'Billing Cycle', 'Paketzyklus')}</span>
            </div>
          </div>

          {/* Tabs Navigation (Same UI as HOD Hub) */}
          <div className="flex w-full items-center justify-start sm:justify-center gap-1 bg-surface p-1 rounded-xl border border-surface-border shadow-2xs overflow-x-auto no-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'overview' as const, title: _t('الرئيسية', 'Overview', 'Übersicht'), icon: Info, count: undefined, activeClass: 'bg-primary text-white' },
              { id: 'attendance' as const, title: _t('الحضور', 'Attendance', 'Anwesenheit'), icon: Calendar, count: presentCount + lateCount + absentCount, activeClass: 'bg-primary text-white' },
              { id: 'scores' as const, title: _t('الدرجات', 'Grades & HW', 'Noten'), icon: GraduationCap, count: undefined, activeClass: 'bg-primary text-white' },
              { id: 'payments' as const, title: _t('المالية', 'Payments', 'Zahlungen'), icon: DollarSign, count: undefined, activeClass: 'bg-primary text-white' },
              { id: 'files' as const, title: _t('الملفات', 'Files', 'Dateien'), icon: FileText, count: (student.documents || []).length, activeClass: 'bg-primary text-white' },
              { id: 'certificates' as const, title: _t('الشهادات', 'Certificates', 'Zertifikate'), icon: Award, count: studentCertificates.length, activeClass: 'bg-primary text-white' },
              { id: 'recordings' as const, title: _t('التسجيلات', 'Recordings', 'Aufnahmen'), icon: Video, count: studentRecordings.length, activeClass: 'bg-primary text-white' },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative h-8 sm:h-9 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none shrink-0 ${
                    isActive 
                      ? `${tab.activeClass} px-2.5 sm:px-3 gap-1 sm:gap-1.5 shadow-xs font-black` 
                      : 'w-7 sm:w-8.5 text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                  title={tab.title}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  {isActive && (
                    <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap overflow-hidden flex items-center gap-1">
                      <span>{tab.title}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className="text-[9px] bg-white/25 text-white px-1 py-0.2 rounded-full font-mono font-bold">
                          {tab.count}
                        </span>
                      )}
                    </span>
                  )}
                  {!isActive && tab.count !== undefined && tab.count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-mono font-bold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-2xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Edit Mode Alert Banner (if in edit mode) */}
          {activeTab === 'edit' && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>{_t('وضع تعديل بيانات الطالب', 'Editing Student Profile', 'Schülerprofil bearbeiten')}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="text-[11px] underline hover:text-amber-900 dark:hover:text-amber-200 cursor-pointer font-extrabold"
              >
                {_t('إلغاء والعودة للبيانات ✕', 'Cancel & Return ✕', 'Zurück ✕')}
              </button>
            </div>
          )}

          {/* Dynamic Tab Body Component View - Flowing naturally without nested scroll */}
          <div className="space-y-4 pt-1">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-3.5">
                {/* Info Card Block */}
                <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl sm:rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Info className="w-4 h-4 text-primary" />
                    <span>{_t('بيانات ومعلومات الطالب', 'STUDENT INFORMATION', 'ALLGEMEINE INFORMATIONEN')}</span>
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
                      <span className="font-black text-slate-800 dark:text-white">{currentStudent.grade}</span>
                    </div>

                    {/* Elternteil */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <User className="w-4 h-4 text-sky-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Elternteil:</span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-white">{currentStudent.parentName || 'N/A'}</span>
                    </div>

                    {/* Telefon Eltern */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Telefon Eltern:</span>
                      </div>
                      <span className="font-mono font-black text-slate-800 dark:text-white">{currentStudent.parentPhone || 'N/A'}</span>
                    </div>

                    {/* Telefon Schüler */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Telefon Schüler:</span>
                      </div>
                      <span className="font-mono font-black text-slate-800 dark:text-white">{currentStudent.studentPhone || 'N/A'}</span>
                    </div>

                    {/* Beigetreten */}
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Calendar className="w-4 h-4 text-rose-500" />
                        <span className="font-bold text-slate-500 dark:text-slate-400">Beigetreten:</span>
                      </div>
                      <span className="font-mono font-black text-slate-800 dark:text-white">{currentStudent.joinedDate || '2026-08-10'}</span>
                    </div>
                  </div>

                  {/* Quick Recordings summary row */}
                  {studentRecordings.length > 0 && (
                    <div 
                      onClick={() => setActiveTab('recordings')}
                      className="p-3 bg-primary-soft hover:bg-primary-soft/80 border border-primary-border rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <Video className="w-5 h-5 text-primary shrink-0" />
                        <div>
                          <p className="text-xs font-black text-text-main">
                            {_t(`تسجيلات الحصص المتاحة (${studentRecordings.length})`, `Available Session Recordings (${studentRecordings.length})`, `Verfügbare Aufnahmen (${studentRecordings.length})`)}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {_t('انقر لعرض ومشاركة تسجيلات الأجزاء مع الطالب أو ولي الأمر', 'Click to view and share part recordings', 'Klicken zum Anzeigen und Teilen')}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-primary">
                        {_t('عرض التسجيلات ←', 'View →', 'Anzeigen →')}
                      </span>
                    </div>
                  )}

                  {/* Notes Block */}

                  {currentStudent.notes && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] block mb-1">Notizen</span>
                      <p className="text-text-main font-semibold italic text-slate-700 dark:text-slate-300 leading-normal">{currentStudent.notes}</p>
                    </div>
                  )}
                </div>

                {/* Security Bottom Notice matching mockup */}
                <div className="p-3 bg-primary-soft/40 border border-primary-border/40 rounded-2xl flex items-center justify-between text-xs text-primary font-bold">
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
                    const isStudentAbsent = l.report?.studentAttendance?.[student.id] === 'absent' || 
                      (l.studentId === student.id && l.report?.attendanceStatus === 'absent');
                    const hwDone = isStudentAbsent ? undefined : l.report?.studentHomeworkDone?.[student.id];
                    const dictationGrade = isStudentAbsent ? undefined : l.report?.studentDictationGrade?.[student.id];
                    const examGrade = isStudentAbsent ? undefined : l.report?.studentExamGrade?.[student.id];
                    const remark = l.report?.studentNotes?.[student.id];

                    if (!isStudentAbsent && !hwDone && dictationGrade === undefined && examGrade === undefined && !remark) return null;

                    return (
                      <div key={l.id} className="p-3.5 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                        <div className="flex items-center justify-between font-extrabold border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <span className="text-slate-800 dark:text-white">{l.title}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{l.date}</span>
                        </div>
                        
                        {isStudentAbsent ? (
                          <div className="p-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/40 text-center font-bold text-[11px]">
                            {_t('❌ غائب عن الحصة (لم تسجل درجات أو واجبات)', '❌ Absent from lesson (No grades recorded)', '❌ Fehlend')}
                          </div>
                        ) : (
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                          {hwDone !== undefined && (
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400">{_t('الواجب السابق:', 'Previous Homework:', 'Hausaufgabe:')}</span>
                              <span className={hwDone === 'yes' ? 'text-emerald-600' : 'text-red-500'}>
                                {hwDone === 'yes' ? _t('تم الحل 👍', 'Done 👍', 'Erledigt 👍') : _t('لم يحل 👎', 'Not Done 👎', 'Nicht erledigt 👎')}
                              </span>
                            </div>
                          )}

                          {dictationGrade !== undefined && (
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400">{_t('درجة الإملاء:', 'Dictation:', 'Diktat:')}</span>
                              <span className={`font-mono ${dictationGrade === -1 ? 'text-amber-600 dark:text-amber-400 text-[10px] font-bold' : 'text-primary'}`}>
                                {dictationGrade === -1 ? _t('مكانش فيه', 'None', 'Keine') : `${dictationGrade} / 10`}
                              </span>
                            </div>
                          )}

                          {examGrade !== undefined && (
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400">{_t('درجة الامتحان:', 'Exam Grade:', 'Prüfungsnote:')}</span>
                              <span className={`font-mono ${examGrade === -1 ? 'text-amber-600 dark:text-amber-400 text-[10px] font-bold' : 'text-primary'}`}>
                                {examGrade === -1 ? _t('مكانش فيه', 'None', 'Keine') : `${examGrade} / 10`}
                              </span>
                            </div>
                          )}
                        </div>
                        )}

                        {remark && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-1">
                            <span className="font-extrabold block text-[10px] text-slate-400 uppercase tracking-widest not-italic mb-0.5">{_t('ملاحظات الحصة', 'Session Notes', 'Notizen')}</span>
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
                  {(student.documents || []).length === 0 ? (
                    <p className="text-xs text-text-muted/70 text-center py-4 italic">
                      Keine Dokumente hochgeladen.
                    </p>
                  ) : (
                    (student.documents || []).map((doc) => (
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
                <div className="flex items-center justify-between p-3.5 bg-primary-soft/40 border border-primary-border/40 rounded-2xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Video className="w-5 h-5 text-primary shrink-0" />
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
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
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
                                {lesson.sessionNumber ? `${_t('حصة', 'Session', 'Lektion')} ${lesson.sessionNumber}` : `${lesson.date}`}
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
                                  {attStatus === 'present' ? _t('حاضر', 'Present', 'Anwesend') : attStatus === 'late' ? _t('متأخر', 'Late', 'Verspätet') : _t('غائب', 'Absent', 'Abwesend')}
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
                              className="px-3 py-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ml-auto"
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
                {/* Change Tracker Summary Banner */}
                <div className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 shadow-2xs ${
                  modifiedFieldsCount > 0 
                    ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/30' 
                    : 'bg-surface-hover border-surface-border'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-xl shrink-0 ${
                      modifiedFieldsCount > 0 
                        ? 'bg-amber-500 text-white shadow-2xs' 
                        : 'bg-surface border border-surface-border text-text-muted'
                    }`}>
                      <RefreshCw className={`w-4 h-4 ${modifiedFieldsCount > 0 ? 'animate-spin-slow' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-black text-text-main truncate">
                          {modifiedFieldsCount > 0 
                            ? _t(`تم تعديل ${modifiedFieldsCount} من الحقول`, `${modifiedFieldsCount} fields modified`, `${modifiedFieldsCount} Felder geändert`)
                            : _t('لم يتم إدخال أي تعديلات حتى الآن', 'No field modifications yet', 'Keine Änderungen bisher')}
                        </h4>
                        {modifiedFieldsCount > 0 ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                            {_t('مُعدَّل', 'Modified', 'Geändert')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-surface-border text-text-muted">
                            {_t('غير مُعدَّل', 'Untouched', 'Unverändert')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted truncate mt-0.5">
                        {modifiedFieldsCount > 0
                          ? _t('تم تعليق الحقول المعدلة بشارة صفراء، يمكنك التراجع عن أي حقل على حدة', 'Modified fields are tagged in amber. Revert individually or all at once.', 'Geänderte Felder sind hervorgehoben.')
                          : _t('عدِّل أي حقل لتمييزه ومتابعة ما قمت بتغييره قبل الحفظ', 'Change any field to track modified vs unchanged data.', 'Ändern Sie ein Feld zur Verfolgung.')}
                      </p>
                    </div>
                  </div>

                  {modifiedFieldsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetAllEdits}
                      className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover text-rose-600 dark:text-rose-400 border border-surface-border hover:border-rose-300 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                      title={_t('استعادة القيمة الأصلية لكافة الحقول', 'Revert all fields to initial state', 'Alle zurücksetzen')}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{_t('تراجع عن الكل', 'Revert All', 'Alle zurücksetzen')}</span>
                    </button>
                  )}
                </div>

                {/* Student Name & English Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{_t('اسم الطالب (Student Name) *', 'Student Name *', 'Schüler Name *')}</span>
                        {isNameDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => setEditName(student.name)} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
                      </label>
                      {editName.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            const formatted = ensureTwoPartName(editName);
                            setEditName(formatted);
                            if (!editCertificateName.trim() || editCertificateName === transliterateArabicNameToEnglish(editName)) {
                              setEditCertificateName(transliterateArabicNameToEnglish(formatted));
                            }
                          }}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-primary" />
                          <span>{_t('ضبط كاسم ثنائي', '2-Part Name', '2-Teiliger Name')}</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white transition-all ${
                        isNameDiff ? 'ring-2 ring-amber-500/40 border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20' : 'border-slate-100 dark:border-slate-800'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{_t('الاسم بالإنجليزية للشهادات', 'English Name for Certificates', 'Englischer Name für Zertifikate')}</span>
                        {isCertificateNameDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => setEditCertificateName(student.certificateName || '')} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
                      </label>
                      {editCertificateName.trim() && (
                        <button
                          type="button"
                          onClick={() => setEditCertificateName(ensureTwoPartName(editCertificateName))}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-primary" />
                          <span>{_t('ضبط كاسم ثنائي', '2-Part Name', '2-Teiliger Name')}</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editCertificateName}
                      onChange={(e) => setEditCertificateName(e.target.value)}
                      placeholder="e.g. Ahmed Ali"
                      className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white font-mono tracking-wide transition-all ${
                        isCertificateNameDiff ? 'ring-2 ring-amber-500/40 border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20' : 'border-slate-100 dark:border-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Gender Toggle */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span>{_t('جنس الطالب (Gender)', 'Gender', 'Geschlecht')}</span>
                      {isGenderDiff ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                          <button type="button" onClick={() => setEditGender(initialGender)} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                      )}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditGender('male')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editGender === 'male'
                          ? 'bg-primary text-white border-primary shadow-xs'
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
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>Zugewiesene Gruppe (Group)</span>
                        {isGroupDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => setEditGroupId(student.groupId)} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
                      </label>
                    </div>
                    <select
                      value={editGroupId}
                      onChange={(e) => setEditGroupId(e.target.value)}
                      className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white transition-all ${
                        isGroupDiff ? 'ring-2 ring-amber-500/40 border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20' : 'border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.grade})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{_t('المستوى / الصف الدراسي', 'Grade / Course Level', 'Klassenstufe / Niveau')}</span>
                        {isGradeDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => setEditGrade(student.grade)} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
                      </label>
                    </div>
                    <select
                      value={editGrade}
                      onChange={(e) => setEditGrade(e.target.value as GradeLevel)}
                      className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white transition-all ${
                        isGradeDiff ? 'ring-2 ring-amber-500/40 border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20' : 'border-slate-100 dark:border-slate-800'
                      }`}
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

                {/* Alternating Week Attendance Selector */}
                <div className={`space-y-1.5 p-3 rounded-xl border transition-all ${
                  isScheduleDiff ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/40 ring-2 ring-amber-500/30' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-primary" />
                      {_t('نظام حضور الطالب (أسبوعي / أسبوع وآسبوع)', 'Attendance Recurrence (Weekly / Bi-weekly)', 'Teilnahme-Rhythmus')}
                    </span>
                    {isScheduleDiff ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                        <button type="button" onClick={() => setEditScheduleRecurrence(student.scheduleRecurrence || 'weekly')} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-normal">
                        {_t('أسبوع آه وأسبوع لأ', 'Alternating weeks', 'Alle 2 Wochen')}
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditScheduleRecurrence('weekly')}
                      className={`py-2 px-1.5 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                        editScheduleRecurrence === 'weekly'
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div>{_t('كل أسبوع', 'Every Week', 'Jede Woche')}</div>
                      <div className="text-[9px] opacity-80 font-normal">{_t('حضور أسبوعي', 'Weekly', 'Wöchentlich')}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditScheduleRecurrence('biweekly_a')}
                      className={`py-2 px-1.5 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                        editScheduleRecurrence === 'biweekly_a'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div>🅰️ {_t('أسبوع (أ)', 'Week A', 'Woche A')}</div>
                      <div className="text-[9px] opacity-80 font-normal">{_t('هذا الأسبوع', 'This week', 'Diese Woche')}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditScheduleRecurrence('biweekly_b')}
                      className={`py-2 px-1.5 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                        editScheduleRecurrence === 'biweekly_b'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div>🅱️ {_t('أسبوع (ب)', 'Week B', 'Woche B')}</div>
                      <div className="text-[9px] opacity-80 font-normal">{_t('الأسبوع القادم', 'Next week', 'Nächste Woche')}</div>
                    </button>
                  </div>
                  {editScheduleRecurrence === 'biweekly_a' && (
                    <p className="text-[10px] text-primary font-medium mt-1">
                      {_t('يحضر هذا الطالب في أسبوع (أ) فقط بالتناوب. متوافق مع جدول الحصص والمالية.', 'Attends on Week A only. Synced with schedule & finance.', 'Nimmt nur an Woche A teil.')}
                    </p>
                  )}
                  {editScheduleRecurrence === 'biweekly_b' && (
                    <p className="text-[10px] text-primary font-medium mt-1">
                      {_t('يحضر هذا الطالب في أسبوع (ب) فقط بالتناوب. متوافق مع جدول الحصص والمالية.', 'Attends on Week B only. Synced with schedule & finance.', 'Nimmt nur an Woche B teil.')}
                    </p>
                  )}
                </div>

                {/* Parent Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>Eltern Name (Parent Name)</span>
                        {isParentNameDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => setEditParentName(student.parentName)} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editParentName}
                      onChange={(e) => setEditParentName(e.target.value)}
                      placeholder="Herr / Frau Ali"
                      className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white transition-all ${
                        isParentNameDiff ? 'ring-2 ring-amber-500/40 border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20' : 'border-slate-100 dark:border-slate-800'
                      }`}
                    />
                  </div>

                  <div className={`space-y-1.5 p-2.5 rounded-xl border transition-all ${
                    isParentPhoneDiff ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/40 ring-2 ring-amber-500/30' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{_t('هاتف / يوزر نيم ولي الأمر', 'Parent Phone / WhatsApp Username', 'Eltern Telefon / WhatsApp-User')}</span>
                        {isParentPhoneDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => { setEditParentPhone(student.parentPhone); setEditParentContactType(initialParentContactType); }} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
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
                              ? 'bg-primary text-white shadow-2xs'
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
                          <AtSign className="w-3.5 h-3.5 text-primary" />
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
                  <div className={`space-y-1.5 p-2.5 rounded-xl border transition-all ${
                    isStudentPhoneDiff ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/40 ring-2 ring-amber-500/30' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{_t('هاتف / يوزر نيم الطالب (اختياري)', 'Student Direct Phone / Username (Optional)', 'Schüler Telefon / User')}</span>
                        {isStudentPhoneDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => { setEditStudentPhone(student.studentPhone); setEditStudentContactType(initialStudentContactType); }} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
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
                              ? 'bg-primary text-white shadow-2xs'
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
                          <AtSign className="w-3.5 h-3.5 text-primary" />
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
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>Status (Student Status)</span>
                        {isStatusDiff ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                            <button type="button" onClick={() => setEditStatus(student.status || 'active')} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                        )}
                      </label>
                    </div>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as 'active' | 'archived')}
                      className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white transition-all ${
                        isStatusDiff ? 'ring-2 ring-amber-500/40 border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20' : 'border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <option value="active">🟢 Aktiv (Active Student)</option>
                      <option value="archived">⚪ Pausiert / Archiviert (Archived)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span>Notizen (Teacher Notes)</span>
                      {isNotesDiff ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <span>✏️ {_t('مُعدَّل', 'Modified', 'Geändert')}</span>
                          <button type="button" onClick={() => setEditNotes(student.notes || '')} className="ms-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer" title={_t('تراجع', 'Revert', 'Zurück')}>↺</button>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-text-muted/60">✓ {_t('غير مُعدَّل', 'Original', 'Original')}</span>
                      )}
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notizen zum Schüler, Lernstand..."
                    className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white transition-all ${
                      isNotesDiff ? 'ring-2 ring-amber-500/40 border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20' : 'border-slate-100 dark:border-slate-800'
                    }`}
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
          archiveStudent(student.id);
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
