import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Student, GradeLevel, CertificateRecord } from '../types';
import { getStudentCyclePricing } from '../utils/paymentUtils';
import { buildWhatsAppUrl } from '../utils/phoneUtils';
import { CARTOON_AVATARS, DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { AvatarImage } from './AvatarImage';
import { 
  X, Phone, Send, FileText, Upload, Trash2, Calendar, Award, DollarSign, 
  BookOpen, CheckCircle2, AlertCircle, Download, FileCheck, User, Camera, Edit3, Save, Check, Sparkles,
  RefreshCw, Shield, Lock, MoreHorizontal, MessageSquare, Info, Star, GraduationCap, Users, Plus, Eye, Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CreateCertificateModal } from './certificates/CreateCertificateModal';
import { CertificatePreviewModal } from './certificates/CertificatePreviewModal';
import { downloadCertificatePDF, shareCertificateWhatsApp } from '../utils/certificateExportUtils';

interface StudentProfileModalProps {
  student: Student;
  onClose: () => void;
  initialTab?: 'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'certificates' | 'edit';
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ student, onClose, initialTab = 'overview' }) => {
  const { groups, lessons, payments, certificates, profile, uploadStudentDocument, deleteStudentDocument, updateStudent, updateStudentCertificateName, deleteStudent, t, _t } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'certificates' | 'edit'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<'homework' | 'exam' | 'doc'>('homework');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isIssueCertModalOpen, setIsIssueCertModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);
  const [latinNameInput, setLatinNameInput] = useState(student.certificateName || '');
  const [isLatinSaved, setIsLatinSaved] = useState(false);

  // Editable Student Fields
  const [editName, setEditName] = useState(student.name);
  const [editGroupId, setEditGroupId] = useState(student.groupId);
  const [editGrade, setEditGrade] = useState<GradeLevel>(student.grade);
  const [editParentName, setEditParentName] = useState(student.parentName);
  const [editParentPhone, setEditParentPhone] = useState(student.parentPhone);
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

  // Dynamic cycle pricing & package progress calculation
  const { cycleLength, amountDue, pricePerSession } = getStudentCyclePricing(student, assignedGroup);

  const paidLessonIds = new Set<string>();
  studentPayments.forEach(p => {
    if (p.status === 'paid' && p.lessonIds) {
      p.lessonIds.forEach(id => paidLessonIds.add(id));
    }
  });

  const unbilledCompletedCount = lessons.filter(l => {
    if (l.status !== 'completed') return false;
    const matchesGroup = assignedGroup ? l.groupId === assignedGroup.id : false;
    const matchesStudent = l.studentId === student.id || l.studentName === student.name;
    if (!matchesGroup && !matchesStudent) return false;
    const att = l.report?.studentAttendance?.[student.id] || l.report?.attendanceStatus || 'present';
    if (att === 'absent') return false;
    return !paidLessonIds.has(l.id);
  }).length;

  const currentCycleProgress = unbilledCompletedCount === 0 ? 0 : (unbilledCompletedCount % cycleLength || cycleLength);

  // Attendance stats
  const presentCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[student.id] || l.report.attendanceStatus || 'present') === 'present').length;
  const lateCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[student.id] || l.report.attendanceStatus || 'present') === 'late').length;
  const absentCount = studentLessons.filter(l => l.status === 'completed' && l.report && (l.report.studentAttendance?.[student.id] || l.report.attendanceStatus || 'present') === 'absent').length;

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    updateStudent(student.id, {
      name: editName,
      groupId: editGroupId,
      grade: editGrade,
      parentName: editParentName,
      parentPhone: editParentPhone,
      studentPhone: editStudentPhone,
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
  const studentEnglishFallback = student.notes?.split('\n')?.[0]?.length && student.notes.split('\n')[0].length < 30
    ? student.notes.split('\n')[0]
    : (student.name || '').split(' ').map(n => n ? n.charAt(0).toUpperCase() + n.slice(1) : '').join(' ');

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col my-2 sm:my-4 max-h-[96vh] sm:max-h-none">
        
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
                <span className="bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 text-[10px] font-black px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-sky-200/50 dark:border-sky-950/30 inline-block">
                  {student.grade}
                </span>
                
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-800 dark:text-white pt-0.5 truncate">
                  {student.name}
                </h2>
                
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider truncate" dir="ltr">
                  {studentEnglishFallback}
                </p>

                {student.parentPhone && (
                  <div className="inline-flex items-center gap-1 bg-blue-50/50 dark:bg-blue-950/20 text-primary px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold border border-blue-100/50 dark:border-blue-950/30 max-w-full truncate" dir="ltr">
                    <span className="text-slate-500 dark:text-slate-400 shrink-0">Eltern:</span>
                    <span className="font-mono truncate">{student.parentPhone}</span>
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
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <a
              href={buildWhatsAppUrl(student.parentPhone)}
              target="_blank"
              rel="noreferrer"
              className="bg-primary hover:bg-primary-hover active:scale-[0.98] text-white font-extrabold text-[10px] sm:text-xs py-2 sm:py-3 px-1 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm shadow-primary/20 min-w-0"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">WhatsApp</span>
            </a>

            <a
              href={student.parentPhone ? `tel:${student.parentPhone}` : '#'}
              className={`font-extrabold text-[10px] sm:text-xs py-2 sm:py-3 px-1 rounded-xl transition-all flex items-center justify-center gap-1 text-center shadow-sm min-w-0 ${
                student.parentPhone 
                  ? 'bg-primary hover:bg-primary-hover active:scale-[0.98] text-white cursor-pointer shadow-primary/20' 
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed pointer-events-none'
              }`}
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{_t('اتصال بالأب', 'Call Parent', 'Eltern anrufen')}</span>
            </a>

            <a
              href={student.studentPhone ? `tel:${student.studentPhone}` : '#'}
              className={`font-extrabold text-[10px] sm:text-xs py-2 sm:py-3 px-1 rounded-xl transition-all flex items-center justify-center gap-1 text-center shadow-sm min-w-0 ${
                student.studentPhone 
                  ? 'bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white cursor-pointer shadow-slate-800/20' 
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed pointer-events-none'
              }`}
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{_t('اتصال بالطالب', 'Call Student', 'Schüler anrufen')}</span>
            </a>
          </div>

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

            {/* EDIT STUDENT DATA TAB */}
            {activeTab === 'edit' && (
              <form onSubmit={handleSaveStudent} className="space-y-3.5 pt-1">
                {/* Student Name */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Schüler Name (Student Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                  />
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
                      Klassenstufe / Niveau (Grade)
                    </label>
                    <select
                      value={editGrade}
                      onChange={(e) => setEditGrade(e.target.value as GradeLevel)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
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

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Eltern Telefon / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={editParentPhone}
                      onChange={(e) => setEditParentPhone(e.target.value)}
                      placeholder="+20 10..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Student Phone & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Schüler Telefon (Student Direct Phone)
                    </label>
                    <input
                      type="tel"
                      value={editStudentPhone}
                      onChange={(e) => setEditStudentPhone(e.target.value)}
                      placeholder="+20 11..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                    />
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
