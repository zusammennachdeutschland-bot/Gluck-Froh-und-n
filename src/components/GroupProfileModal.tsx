import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Group, Lesson, Student, ScheduleRecurrence } from '../types';
import { 
  X, Users, Trash2, Send, Save, Video, ExternalLink, Copy, Check, 
  Sparkles, Calendar, Plus, Edit2, Play, FileText, UserPlus, UserMinus, Search, UserCheck, User,
  GraduationCap, Clock, MapPin, CreditCard, MessageCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CascadeDeleteGroupModal } from './CascadeDeleteGroupModal';
import { LessonReminderModal } from './LessonReminderModal';
import { GroupForm, GroupFormData } from './GroupForm';
import { AddStudentModal } from './AddStudentModal';
import { StudentProfileModal } from './StudentProfileModal';
import { getGroupCycleInfo, isGroupPerLesson } from '../utils/lessonUtils';
import { buildWhatsAppUrl } from '../utils/phoneUtils';
import { isLikelyFemaleStudent } from '../utils/genderUtils';
import { transliterateArabicNameToEnglish } from '../utils/nameUtils';

interface GroupProfileModalProps {
  group: Group;
  onClose: () => void;
  initialTab?: 'details' | 'recordings';
}

export const GroupProfileModal: React.FC<GroupProfileModalProps> = ({ group, onClose, initialTab = 'details' }) => {
  const { 
    updateGroup, updateLesson, deleteGroup, archiveGroup, generateGroupScheduleLessons, 
    groups, students, addStudent, updateStudent, moveStudent, lessons, payments, language, t, _t 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'details' | 'recordings'>(initialTab);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingCascade, setIsConfirmingCascade] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [copiedLessonId, setCopiedLessonId] = useState<string | null>(null);
  const [editingLessonRecordingId, setEditingLessonRecordingId] = useState<string | null>(null);
  const [tempRec1, setTempRec1] = useState('');
  const [tempRec2, setTempRec2] = useState('');

  // Add Student to Group State
  const [showAddStudentSection, setShowAddStudentSection] = useState(false);
  const [addStudentSubTab, setAddStudentSubTab] = useState<'new' | 'existing'>('new');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentCertName, setNewStudentCertName] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'male' | 'female'>('male');
  const [newStudentRecurrence, setNewStudentRecurrence] = useState<ScheduleRecurrence>(group.scheduleRecurrence || 'weekly');
  const [hasManualGender, setHasManualGender] = useState(false);
  const [showFullAddStudentModal, setShowFullAddStudentModal] = useState(false);
  const [existingStudentSearch, setExistingStudentSearch] = useState('');
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [studentActionSuccess, setStudentActionSuccess] = useState<string | null>(null);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);

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

  const groupStudents = students.filter(s => s.groupId === group.id);
  const cycleInfo = getGroupCycleInfo(group, lessons, language);

  const groupLessons = lessons
    .filter(l => l.groupId === group.id && l.status !== 'cancelled')
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

  const groupLessonsWithRecordings = groupLessons.filter(l => {
    const r1 = l.recordingLink?.trim() || l.report?.recordingLink?.trim();
    const r2 = l.recordingLink2?.trim() || l.report?.recordingLink2?.trim();
    return Boolean(r1 || r2);
  });

  const handleCopyLink = (lesson: Lesson, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLessonId(`${lesson.id}_${link}`);
    setTimeout(() => setCopiedLessonId(null), 2000);
  };

  const handleShareRecordingWhatsApp = (lesson: Lesson) => {
    const r1 = lesson.recordingLink?.trim() || lesson.report?.recordingLink?.trim();
    const r2 = lesson.recordingLink2?.trim() || lesson.report?.recordingLink2?.trim();
    
    let msg = _t(
      `🎥 *تسجيل حصة ${group.name}*\n📅 التاريخ: ${lesson.date} (${lesson.time || ''})\n`,
      `🎥 *Lesson Recording for ${group.name}*\n📅 Date: ${lesson.date} (${lesson.time || ''})\n`,
      `🎥 *Lektionsaufnahme für ${group.name}*\n📅 Datum: ${lesson.date} (${lesson.time || ''})\n`
    );
    if (lesson.sessionNumber) {
      msg += _t(`🔢 الحصة رقم: ${lesson.sessionNumber}\n`, `🔢 Session No: ${lesson.sessionNumber}\n`, `🔢 Lektionsnummer: ${lesson.sessionNumber}\n`);
    }
    const topic = (lesson.report?.homeworkTitle || lesson.title || '').trim();
    if (topic) {
      msg += _t(`📖 موضوع الحصة: ${topic}\n`, `📖 Topic: ${topic}\n`, `📖 Thema: ${topic}\n`);
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

    if (group.whatsAppGroupLink) {
      window.open(group.whatsAppGroupLink, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const handleSaveLessonRecording = (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    const updatedReport = lesson.report ? {
      ...lesson.report,
      recordingLink: tempRec1.trim() || undefined,
      recordingLink2: tempRec2.trim() || undefined,
    } : undefined;

    updateLesson(lessonId, {
      recordingLink: tempRec1.trim() || undefined,
      recordingLink2: tempRec2.trim() || undefined,
      report: updatedReport
    });

    setEditingLessonRecordingId(null);
    confetti({ particleCount: 30, spread: 30 });
  };

  const isPerLessonGroup = isGroupPerLesson(group);
  const cycleTotalSessions = isPerLessonGroup ? 1 : ((group.sessionCount && group.sessionCount > 1) ? group.sessionCount : 4);
  
  // Find upcoming scheduled lessons for this group
  const upcomingScheduledLessons = useMemo(() => {
    return (lessons || [])
      .filter(l => l.groupId === group.id && !l.deleted && l.status === 'scheduled')
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  }, [lessons, group.id]);

  const nearestUpcomingLesson = upcomingScheduledLessons[0];
  const detectedNextSessionNum = nearestUpcomingLesson?.sessionNumber 
    ? nearestUpcomingLesson.sessionNumber 
    : (group.startingSessionNumber || 1);

  const [selectedUpcomingCycleNumber, setSelectedUpcomingCycleNumber] = useState<number>(detectedNextSessionNum);
  const [cycleUpdateSuccessMsg, setCycleUpdateSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedUpcomingCycleNumber(detectedNextSessionNum);
  }, [detectedNextSessionNum]);

  const handleApplyUpcomingCycleNumber = (chosenNum: number) => {
    if (chosenNum < 1 || chosenNum > cycleTotalSessions) return;
    setSelectedUpcomingCycleNumber(chosenNum);

    // 1. Update the group startingSessionNumber
    updateGroup(group.id, {
      ...group,
      startingSessionNumber: chosenNum
    });

    // 2. Synchronize all upcoming scheduled lessons
    upcomingScheduledLessons.forEach((upLesson, idx) => {
      const nextSeqNum = (((chosenNum - 1 + idx) % cycleTotalSessions) + 1);
      updateLesson(upLesson.id, {
        sessionNumber: nextSeqNum,
        totalSessionsInPackage: cycleTotalSessions
      });
    });

    setCycleUpdateSuccessMsg(_t(
      `✓ تم حفظ وضبط الحصة القادمة برقم (${chosenNum} من ${cycleTotalSessions}) وتحديث كافة مواعيد المجموعة بنجاح`,
      `✓ Set upcoming session to (${chosenNum}/${cycleTotalSessions}) and updated all group lessons`,
      `✓ Nächste Sitzung auf (${chosenNum}/${cycleTotalSessions}) gesetzt`
    ));
    setTimeout(() => setCycleUpdateSuccessMsg(null), 4000);
  };

  const handleAddNewStudentToGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    if (!newStudentPhone.trim()) {
      alert(_t('رقم هاتف أو واتساب ولي الأمر مطلوب!', 'Parent phone number is required!', 'Telefonnummer der Eltern ist erforderlich!'));
      return;
    }

    setIsSubmittingStudent(true);
    try {
      const trimmedName = newStudentName.trim();
      const trimmedPhone = newStudentPhone.trim();
      const detectedGender = isLikelyFemaleStudent(trimmedName) ? 'female' : newStudentGender;
      const finalCertName = newStudentCertName.trim() || transliterateArabicNameToEnglish(trimmedName);

      addStudent({
        name: trimmedName,
        certificateName: finalCertName,
        parentPhone: trimmedPhone,
        parentName: '',
        studentPhone: '',
        gender: detectedGender,
        groupId: group.id,
        grade: group.grade || 'Grade 9',
        scheduleRecurrence: newStudentRecurrence,
        notes: '',
        status: 'active'
      });

      setNewStudentName('');
      setNewStudentPhone('');
      setNewStudentCertName('');
      setShowAddStudentSection(false);
      setStudentActionSuccess(_t(`تمت إضافة الطالب ${trimmedName} بنجاح إلى المجموعة وبيانات البرنامج!`, `Student ${trimmedName} added successfully!`, `Schüler ${trimmedName} erfolgreich hinzugefügt!`));
      confetti({ particleCount: 40, spread: 50 });
      setTimeout(() => setStudentActionSuccess(null), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleAddExistingStudentToGroup = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    updateStudent(studentId, { groupId: group.id });
    setStudentActionSuccess(_t(`تم ضم الطالب ${student.name} إلى المجموعة!`, `Student ${student.name} assigned to group!`, `Schüler ${student.name} zugewiesen!`));
    confetti({ particleCount: 30, spread: 45 });
    setTimeout(() => setStudentActionSuccess(null), 3000);
  };

  const handleRemoveStudentFromGroup = (studentId: string, studentName: string) => {
    if (window.confirm(_t(
      `هل أنت متأكد من إزالة ${studentName} من هذه المجموعة؟\n(سيبقى الطالب محفوظاً في بيانات البرنامج كطالب بدون مجموعة)`,
      `Are you sure you want to remove ${studentName} from this group? (Student will remain in the app as unassigned)`,
      `Möchten Sie ${studentName} aus dieser Gruppe entfernen?`
    ))) {
      updateStudent(studentId, { groupId: '' });
      setStudentActionSuccess(_t(`تمت إزالة ${studentName} من المجموعة.`, `${studentName} removed from group.`, `${studentName} entfernt.`));
      setTimeout(() => setStudentActionSuccess(null), 2500);
    }
  };

  const availableExistingStudents = students.filter(s => s.groupId !== group.id);
  const filteredExistingStudents = availableExistingStudents.filter(s => {
    if (!existingStudentSearch.trim()) return true;
    const query = existingStudentSearch.toLowerCase().trim();
    return (s.name || '').toLowerCase().includes(query) || (s.parentPhone || '').includes(query);
  });

  const handleSubmit = (data: GroupFormData) => {
    const isPerLesson = data.paymentCycle === 'per_lesson' || data.paymentModel === 'per_session';
    const effectiveSessionCount = isPerLesson ? 1 : Math.max(2, Number(data.sessionCount) || 4);
    const pricePerSession = Number(data.pricePerSession) || 0;
    const calcMonthlyPrice = isPerLesson 
      ? pricePerSession 
      : Number(data.monthlyPackagePrice);

    const schedules = data.scheduleDays.map(day => ({
      day,
      time: data.dayTimes[day] || data.scheduleTime || '17:00'
    }));

    const updatedGroupData = {
      ...group,
      name: data.name,
      grade: data.grade,
      type: data.type,
      paymentCycle: isPerLesson ? 'per_lesson' : 'monthly',
      paymentModel: isPerLesson ? 'per_session' : 'package',
      monthlyPackagePrice: calcMonthlyPrice,
      pricePerSession: isPerLesson ? pricePerSession : undefined,
      sessionCount: effectiveSessionCount,
      startingSessionNumber: isPerLesson ? 1 : Math.max(1, Number(data.startingSessionNumber) || 1),
      defaultFinanceAccountId: data.defaultFinanceAccountId,
      scheduleRecurrence: data.scheduleRecurrence || 'weekly',
      scheduleDays: data.scheduleDays,
      scheduleTime: data.scheduleTime,
      scheduleDayTimes: data.dayTimes,
      schedules,
      zoomLink: data.type === 'online' ? data.zoomLink : undefined,
      meetLink: data.type === 'online' ? data.meetLink : undefined,
      address: data.type === 'offline' ? data.address : undefined,
      color: data.color,
      lessonDurationMinutes: Number(data.lessonDurationMinutes),
      whatsAppGroupLink: data.whatsAppGroupLink.trim()
    };

    updateGroup(group.id, updatedGroupData);
    if (data.scheduleDays && data.scheduleDays.length > 0) {
      generateGroupScheduleLessons(group.id, data.scheduleDays, data.scheduleTime, 4, data.dayTimes, updatedGroupData);
    }

    confetti({ particleCount: 50, spread: 40 });
    onClose();
  };

  return (
    <div
      role="dialog"
      data-modal="true"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{ overscrollBehaviorY: 'contain' }}
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] p-0 sm:p-4 pb-0 overscroll-contain"
    >
      <div
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] overscroll-contain"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />
        
        {/* Chic Modern Header (No harsh blue bar!) */}
        <div className="bg-surface dark:bg-slate-900 border-b border-surface-border px-3.5 pt-2 pb-3 sm:px-5 sm:pt-3 sm:pb-3.5 shrink-0 space-y-2.5">
          {/* Top Identity Row */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {/* Group Avatar / Badge */}
              <div 
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform"
                style={{
                  backgroundColor: group.color ? `${group.color}15` : 'rgba(59, 130, 246, 0.1)',
                  borderColor: group.color ? `${group.color}35` : 'rgba(59, 130, 246, 0.25)',
                  color: group.color || '#2563eb'
                }}
              >
                <Users className="w-5 h-5" />
              </div>

              {/* Title & Group Category */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-text-main truncate tracking-tight">
                    {group.name}
                  </h2>
                  <span className="text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary-soft text-primary border border-primary-border/60 shrink-0">
                    {_t('مجموعة', 'Group', 'Gruppe')}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted font-medium truncate mt-0.5 flex items-center gap-1.5">
                  <span>{group.grade || _t('بدون مرحلة', 'No Grade', 'Keine Stufe')}</span>
                  <span>•</span>
                  <span>{group.type === 'online' ? _t('أونلاين (Zoom / Meet)', 'Online', 'Online') : _t('حضوري', 'In-Person', 'Präsenz')}</span>
                </p>
              </div>
            </div>

            {/* Actions: WhatsApp shortcut if link exists + Elegant Close */}
            <div className="flex items-center gap-1 shrink-0">
              {group.whatsAppGroupLink && (
                <a
                  href={group.whatsAppGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 sm:p-2 rounded-xl text-primary bg-primary-soft hover:bg-primary-soft/80 border border-primary-border/40 transition-all flex items-center gap-1 text-[11px] font-bold"
                  title={_t('فتح جروب واتساب للمجموعة', 'Open WhatsApp Group', 'WhatsApp-Gruppe öffnen')}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">{_t('جروب واتساب', 'WhatsApp', 'WhatsApp')}</span>
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={_t('إغلاق', 'Close', 'Schließen')}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Details Bar: Clean Unboxed Metadata */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5 text-xs font-bold text-text-muted">
            {/* Students enrolled */}
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{groupStudents.length} {_t('طلاب مسجلين', 'Students', 'Schüler')}</span>
            </span>

            {/* Grade level */}
            {group.grade && (
              <>
                <span className="text-text-muted/40">•</span>
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{group.grade}</span>
                </span>
              </>
            )}

            {/* Lesson Type */}
            <span className="text-text-muted/40">•</span>
            <span className="inline-flex items-center gap-1">
              {group.type === 'online' ? <Video className="w-3.5 h-3.5 text-primary shrink-0" /> : <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />}
              <span>{group.type === 'online' ? _t('أونلاين', 'Online', 'Online') : (group.address || _t('حضوري', 'In-Person', 'Präsenz'))}</span>
            </span>

            {/* Payment Model & Price */}
            <span className="text-text-muted/40">•</span>
            <span className="inline-flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {isPerLessonGroup
                  ? `${group.pricePerSession ? `${group.pricePerSession} EGP / ` : ''}${_t('محاسبة بالحصة', 'Per Session', 'Pro Stunde')}`
                  : `${group.monthlyPackagePrice ? `${group.monthlyPackagePrice} EGP • ` : ''}${!cycleInfo.isPerLesson ? cycleInfo.label : _t('باقة حصص', 'Package', 'Paket')}`}
              </span>
            </span>

            {/* Schedule & Duration */}
            {(group.scheduleDays?.length > 0 || group.lessonDurationMinutes) && (
              <>
                <span className="text-text-muted/40">•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>
                    {group.scheduleDays?.length ? `${group.scheduleDays.length} ${_t('أيام/أسبوع', 'days/wk', 'Tage/W.')}` : ''}
                    {group.lessonDurationMinutes ? `${group.scheduleDays?.length ? ' • ' : ''}${group.lessonDurationMinutes} ${_t('دقيقة', 'min', 'Min.')}` : ''}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Details vs Recordings) */}
        <div className="flex items-center border-b border-surface-border bg-surface px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-3 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{_t('بيانات وإعدادات المجموعة', 'Group Details & Edit', 'Gruppendaten')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recordings')}
            className={`pb-2.5 px-3 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'recordings'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{_t('تسجيلات الحصص', 'Lesson Recordings', 'Aufnahmen')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              groupLessonsWithRecordings.length > 0 
                ? 'bg-primary/10 text-primary font-bold' 
                : 'bg-slate-100 dark:bg-slate-800 text-text-muted'
            }`}>
              {groupLessonsWithRecordings.length}
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto flex-1 p-3.5 sm:p-4">
          {activeTab === 'details' ? (
            <div className="space-y-4">
              {/* Dedicated Upcoming Cycle Adjuster Card */}
              {!isPerLessonGroup && cycleTotalSessions > 1 && (
                <div className="p-3 sm:p-3.5 bg-gradient-to-r from-primary/10 via-primary/5 to-surface border border-primary/30 rounded-2xl space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-2xs">
                        {selectedUpcomingCycleNumber}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-text-main flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{_t('رقم السايكل / الحصة القادمة للمجموعة', 'Upcoming Session in Cycle', 'Nächste Sitzungsnummer')}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                            {_t(`باقة ${cycleTotalSessions} حصص`, `${cycleTotalSessions} sessions`, `${cycleTotalSessions} Sitzungen`)}
                          </span>
                        </h4>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {_t('اختر رقم الحصة القادمة لضبط وترتيب جميع الحصص القادمة والتقارير المالية في كل البرنامج:', 'Choose next session number to sequence all scheduled lessons & reports:', 'Nächste Sitzung auswählen:')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Number Selector Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {Array.from({ length: cycleTotalSessions }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSelectedUpcomingCycleNumber(num)}
                        className={`min-w-[42px] h-8 px-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          selectedUpcomingCycleNumber === num
                            ? 'bg-primary text-white shadow-2xs scale-105 ring-2 ring-primary/30'
                            : 'bg-surface hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border border-surface-border'
                        }`}
                      >
                        <span>{num === 1 ? '1 🌟' : num}</span>
                      </button>
                    ))}
                  </div>

                  {/* Apply & Save Button */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleApplyUpcomingCycleNumber(selectedUpcomingCycleNumber)}
                      className="flex-1 py-2 px-3 bg-primary hover:bg-primary-hover text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{_t(`💾 حفظ وتطبيق رقم السايكل القادمة (${selectedUpcomingCycleNumber} من ${cycleTotalSessions})`, `Save & Apply Next Session (${selectedUpcomingCycleNumber}/${cycleTotalSessions})`, `Nächste Sitzung speichern (${selectedUpcomingCycleNumber})`)}</span>
                    </button>
                  </div>

                  {/* Success Toast */}
                  {cycleUpdateSuccessMsg && (
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-2 animate-scale-up">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{cycleUpdateSuccessMsg}</span>
                    </div>
                  )}
                </div>
              )}

              <GroupForm initialData={group} onSubmit={handleSubmit} isEdit={true} className="space-y-4 pb-2">
              {/* Students in group management */}
              <div className="space-y-3 pt-3 border-t border-surface-border mt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-black text-text-main">
                      {_t(`طلاب هذه المجموعة (${groupStudents.length})`, `Students in this Group (${groupStudents.length})`, `Schüler in dieser Gruppe (${groupStudents.length})`)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddStudentSection(prev => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-primary bg-primary/10 hover:bg-primary/20 active:scale-95 px-2.5 py-1 rounded-lg border border-primary/25 transition-all cursor-pointer shadow-2xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{_t('+ إضافة طالب للجروب', '+ Add Student to Group', '+ Schüler hinzufügen')}</span>
                  </button>
                </div>

                {/* Success feedback toast */}
                {studentActionSuccess && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 animate-scale-up">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{studentActionSuccess}</span>
                  </div>
                )}

                {/* Add Student Section (Drawer/Card) */}
                {showAddStudentSection && (
                  <div className="p-3 bg-surface-hover/80 border border-primary/25 rounded-2xl space-y-3 shadow-sm animate-scale-up">
                    {/* Sub-tabs: New Student vs Existing Student */}
                    <div className="flex items-center gap-1.5 p-1 bg-surface rounded-xl border border-surface-border text-xs">
                      <button
                        type="button"
                        onClick={() => setAddStudentSubTab('new')}
                        className={`flex-1 py-1.5 px-2 rounded-lg font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          addStudentSubTab === 'new'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{_t('طالب جديد', 'New Student', 'Neuer Schüler')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddStudentSubTab('existing')}
                        className={`flex-1 py-1.5 px-2 rounded-lg font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          addStudentSubTab === 'existing'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{_t('طالب مسجل بالفعل', 'Existing Student', 'Bereits registriert')}</span>
                      </button>
                    </div>

                    {/* Sub-tab 1: Add New Student Form */}
                    {addStudentSubTab === 'new' ? (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-text-main flex items-center justify-between">
                            <span>{_t('اسم الطالب *', 'Student Name *', 'Name des Schülers *')}</span>
                            <span className="text-[10px] text-text-muted">{_t('يُحفظ في بيانات البرنامج والمجموعة', 'Saved to App & Group', 'Wird gespeichert')}</span>
                          </label>
                          <input
                            type="text"
                            placeholder={_t('مثال: سيف طارق', 'e.g. Saif Tarek', 'z.B. Saif Tarek')}
                            value={newStudentName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewStudentName(val);
                              if (!hasManualGender && val.trim()) {
                                setNewStudentGender(isLikelyFemaleStudent(val) ? 'female' : 'male');
                              }
                              if (!newStudentCertName) {
                                setNewStudentCertName(transliterateArabicNameToEnglish(val));
                              }
                            }}
                            className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-text-main">
                              {_t('هاتف / واتساب ولي الأمر *', 'Parent Phone / WA *', 'Eltern Telefon *')}
                            </label>
                            <input
                              type="tel"
                              placeholder="01xxxxxxxxx / +20..."
                              value={newStudentPhone}
                              onChange={(e) => setNewStudentPhone(e.target.value)}
                              className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-text-main">
                              {_t('النوع', 'Gender', 'Geschlecht')}
                            </label>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewStudentGender('male');
                                  setHasManualGender(true);
                                }}
                                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  newStudentGender === 'male'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-surface text-text-muted border-surface-border'
                                }`}
                              >
                                <span>👦</span>
                                <span>{_t('ولد', 'Boy', 'Junge')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewStudentGender('female');
                                  setHasManualGender(true);
                                }}
                                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  newStudentGender === 'female'
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                    : 'bg-surface text-text-muted border-surface-border'
                                }`}
                              >
                                <span>👧</span>
                                <span>{_t('بنت', 'Girl', 'Mädchen')}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-text-main">
                            <span>{_t('الاسم بالإنجليزية للشهادة (تلقائي)', 'English Name for Certificate', 'Englischer Name')}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (newStudentName.trim()) {
                                  setNewStudentCertName(transliterateArabicNameToEnglish(newStudentName.trim()));
                                }
                              }}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-normal"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>{_t('توليد بالإنجليزية', 'Auto-Generate', 'Generieren')}</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder={transliterateArabicNameToEnglish(newStudentName) || 'e.g. Saif Tarek'}
                            value={newStudentCertName}
                            onChange={(e) => setNewStudentCertName(e.target.value)}
                            className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        {/* Student Recurrence Selection: Weekly vs Week A vs Week B */}
                        <div className="space-y-1.5 p-2.5 rounded-xl bg-surface-hover/70 border border-surface-border">
                          <label className="text-[11px] font-bold text-text-main flex items-center justify-between">
                            <span>{_t('نظام حضور الطالب بالتناوب (أسبوع آه وأسبوع لأ)', 'Attendance Recurrence', 'Teilnahme-Rhythmus')}</span>
                            <span className="text-[10px] text-text-muted font-normal">{_t('حضور دوري', 'Schedule cycle', 'Rhythmus')}</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setNewStudentRecurrence('weekly')}
                              className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                                newStudentRecurrence === 'weekly'
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-surface text-text-muted hover:text-text-main border-surface-border'
                              }`}
                            >
                              <div>{_t('كل أسبوع', 'Every Week', 'Jede Woche')}</div>
                              <div className="text-[9px] opacity-80 font-normal">{_t('أسبوعي', 'Weekly', 'Wöchentlich')}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewStudentRecurrence('biweekly_a')}
                              className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                                newStudentRecurrence === 'biweekly_a'
                                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                  : 'bg-surface text-text-muted hover:text-text-main border-surface-border'
                              }`}
                            >
                              <div>🅰️ {_t('أسبوع (أ)', 'Week A', 'Woche A')}</div>
                              <div className="text-[9px] opacity-80 font-normal">{_t('الأسبوع الحالي', 'This week', 'Diese Woche')}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewStudentRecurrence('biweekly_b')}
                              className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                                newStudentRecurrence === 'biweekly_b'
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                  : 'bg-surface text-text-muted hover:text-text-main border-surface-border'
                              }`}
                            >
                              <div>🅱️ {_t('أسبوع (ب)', 'Week B', 'Woche B')}</div>
                              <div className="text-[9px] opacity-80 font-normal">{_t('الأسبوع القادم', 'Next week', 'Nächste Woche')}</div>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleAddNewStudentToGroup}
                            disabled={isSubmittingStudent || !newStudentName.trim() || !newStudentPhone.trim()}
                            className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{_t('✓ إضافة وحفظ في بيانات البرنامج والجروب', 'Save to App & Group', 'Speichern & Hinzufügen')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddStudentSection(false)}
                            className="px-3 py-2.5 bg-surface hover:bg-surface-hover text-text-muted text-xs font-bold rounded-xl border border-surface-border transition-all cursor-pointer"
                          >
                            {_t('إلغاء', 'Cancel', 'Abbrechen')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Sub-tab 2: Assign Existing Student */
                      <div className="space-y-2.5">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
                          <input
                            type="text"
                            placeholder={_t('بحث عن طالب بالاسم أو الهاتف...', 'Search by student name or phone...', 'Schüler suchen...')}
                            value={existingStudentSearch}
                            onChange={(e) => setExistingStudentSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-surface border border-surface-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
                          {filteredExistingStudents.length === 0 ? (
                            <p className="text-center py-4 text-xs text-text-muted font-bold">
                              {_t('لا يوجد طلاب آخرين متاحين', 'No other students available', 'Keine weiteren Schüler')}
                            </p>
                          ) : (
                            filteredExistingStudents.map(s => {
                              const currentGrp = groups.find(g => g.id === s.groupId);
                              return (
                                <div
                                  key={s.id}
                                  className="p-2 bg-surface hover:bg-surface-hover rounded-xl border border-surface-border text-xs flex items-center justify-between gap-2 transition-all"
                                >
                                  <div className="min-w-0">
                                    <p className="font-bold text-text-main truncate">{s.name}</p>
                                    <p className="text-[10px] text-text-muted truncate">
                                      {s.parentPhone} • {currentGrp ? currentGrp.name : _t('بدون مجموعة', 'No group', 'Keine Gruppe')}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddExistingStudentToGroup(s.id)}
                                    className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{_t('ضم للجروب', 'Assign', 'Hinzufügen')}</span>
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Detailed modal shortcut */}
                    <div className="pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">{_t('هل تحتاج لإدخال تفاصيل إضافية؟', 'Need full details & docs?', 'Weitere Details?')}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddStudentSection(false);
                          setShowFullAddStudentModal(true);
                        }}
                        className="text-primary font-black hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{_t('فتح نموذج الطالب الكامل ↗', 'Open Full Student Form ↗', 'Vollständiges Formular ↗')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* List of current students in group */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {groupStudents.length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-surface-hover/60 border border-surface-border text-text-muted text-xs">
                      <Users className="w-6 h-6 mx-auto mb-1 text-text-muted/40" />
                      <p className="font-bold">{_t('لا يوجد طلاب مسجلين في هذا الجروب حالياً', 'No students in this group yet', 'Keine Schüler in dieser Gruppe')}</p>
                      <button
                        type="button"
                        onClick={() => setShowAddStudentSection(true)}
                        className="mt-2 text-[11px] font-black text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{_t('إضافة أول طالب للجروب الآن', 'Add first student now', 'Ersten Schüler hinzufügen')}</span>
                      </button>
                    </div>
                  ) : (
                    groupStudents.map(s => (
                      <div 
                        key={s.id} 
                        className="p-2.5 bg-surface-hover hover:bg-surface-border/40 rounded-xl border border-surface-border/60 hover:border-primary/40 text-xs flex items-center justify-between gap-2 font-semibold transition-all group/item"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForProfile(s)}
                          className="min-w-0 flex-1 text-right flex items-center justify-between gap-2 cursor-pointer focus:outline-none"
                          title={_t('انقر لفتح صفحة ملف الطالب الكاملة', 'Click to open student profile', 'Klicken, um Schülerprofil zu öffnen')}
                        >
                          <div className="min-w-0">
                            <span className="text-text-main font-bold block truncate group-hover/item:text-primary transition-colors flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {s.scheduleRecurrence === 'biweekly_a' && (
                                <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 border border-sky-500/30 px-1 py-0.2 rounded shrink-0">
                                  🅰️ {_t('أسبوع أ', 'Week A', 'Woche A')}
                                </span>
                              )}
                              {s.scheduleRecurrence === 'biweekly_b' && (
                                <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1 py-0.2 rounded shrink-0">
                                  🅱️ {_t('أسبوع ب', 'Week B', 'Woche B')}
                                </span>
                              )}
                              <span className="text-[10px] text-primary opacity-0 group-hover/item:opacity-100 transition-opacity">↗</span>
                            </span>
                            <span className="text-text-muted/80 text-[10px] font-mono block truncate">
                              {s.parentPhone || _t('بدون هاتف', 'No phone', 'Keine Tel.')} {s.certificateName ? `• ${s.certificateName}` : ''}
                            </span>
                          </div>

                          <div className="text-[11px] font-bold text-primary bg-primary/10 group-hover/item:bg-primary group-hover/item:text-white px-2 py-1 rounded-lg shrink-0 transition-all flex items-center gap-1 shadow-2xs">
                            <User className="w-3 h-3" />
                            <span>{_t('فتح ملف الطالب', 'Open Profile', 'Profil öffnen')}</span>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStudentFromGroup(s.id, s.name);
                            }}
                            className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            title={_t('إزالة الطالب من هذا الجروب', 'Remove student from this group', 'Aus Gruppe entfernen')}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </GroupForm>
            </div>
          ) : (
            /* RECORDINGS TAB */
            <div className="space-y-4">
              {/* Quick Grain Launch Bar */}
              <div className="p-3 bg-primary-soft/40 border border-primary-border/40 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Video className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-text-main truncate">
                      {_t('منصة التسجيلات الذكية Grain', 'Grain Video Recordings', 'Grain Video-Aufnahmen')}
                    </h4>
                    <p className="text-[10px] text-text-muted truncate">
                      {_t('الوصول المباشر لكافة تسجيلات حصص المجموعة', 'Direct access to all group session recordings', 'Direkter Zugriff auf alle Aufnahmen')}
                    </p>
                  </div>
                </div>

                <a
                  href="https://grain.com/app/meetings"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white font-black text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Grain</span>
                </a>
              </div>

              {/* List of Lessons */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black text-text-muted">
                  <span>{_t(`حصص المجموعة (${groupLessons.length})`, `Group Sessions (${groupLessons.length})`, `Gruppensitzungen (${groupLessons.length})`)}</span>
                  <span className="text-[10px] text-primary font-bold">
                    {_t(`${groupLessonsWithRecordings.length} حصة بها تسجيل`, `${groupLessonsWithRecordings.length} recorded sessions`, `${groupLessonsWithRecordings.length} Aufnahmen`)}
                  </span>
                </div>

                {groupLessons.length === 0 ? (
                  <div className="p-6 text-center text-xs text-text-muted bg-surface-hover rounded-xl border border-surface-border">
                    <Video className="w-8 h-8 mx-auto mb-2 text-text-muted/40" />
                    <p className="font-bold">{_t('لا توجد حصص مسجلة لهذه المجموعة بعد', 'No sessions for this group yet', 'Noch keine Sitzungen vorhanden')}</p>
                  </div>
                ) : (
                  groupLessons.map((lesson) => {
                    const r1 = lesson.recordingLink?.trim() || lesson.report?.recordingLink?.trim();
                    const r2 = lesson.recordingLink2?.trim() || lesson.report?.recordingLink2?.trim();
                    const hasRecordings = Boolean(r1 || r2);
                    const isEditingThis = editingLessonRecordingId === lesson.id;

                    return (
                      <div
                        key={lesson.id}
                        className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                          hasRecordings 
                            ? 'bg-surface border-surface-border hover:border-primary/40 shadow-3xs' 
                            : 'bg-surface-hover/60 border-surface-border/60 opacity-90'
                        }`}
                      >
                        {/* Header: Date, Session Number, Title */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary font-black text-[10px] rounded-md shrink-0 font-mono">
                              {lesson.sessionNumber ? `حصة ${lesson.sessionNumber}` : `${lesson.date}`}
                            </span>
                            <span className="text-xs font-black text-text-main truncate">
                              {lesson.title || lesson.groupName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-text-muted font-bold font-mono">
                              {lesson.date} • {lesson.time}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditingThis) {
                                  setEditingLessonRecordingId(null);
                                } else {
                                  setEditingLessonRecordingId(lesson.id);
                                  setTempRec1(r1 || '');
                                  setTempRec2(r2 || '');
                                }
                              }}
                              className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-primary transition-colors cursor-pointer"
                              title={_t('تعديل روابط التسجيل', 'Edit Recording Links', 'Aufnahmelinks bearbeiten')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline editor if active */}
                        {isEditingThis && (
                          <div className="p-2.5 bg-primary-soft/30 dark:bg-primary-soft/10 rounded-lg border border-primary-border/40 space-y-2 animate-scale-up">
                            <div className="space-y-1.5">
                              <div>
                                <label className="text-[10px] font-black text-text-muted block mb-0.5">
                                  {_t('رابط التسجيل الأول (الجزء 1):', 'Recording Link (Part 1):', 'Aufnahmelink (Teil 1):')}
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://grain.com/share/recording-1..."
                                  value={tempRec1}
                                  onChange={(e) => setTempRec1(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-text-muted block mb-0.5">
                                  {_t('رابط التسجيل الثاني (الجزء 2 - اختياري):', 'Recording Link (Part 2 - Optional):', 'Aufnahmelink (Teil 2 - Optional):')}
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://grain.com/share/recording-2..."
                                  value={tempRec2}
                                  onChange={(e) => setTempRec2(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingLessonRecordingId(null)}
                                className="px-2.5 py-1 bg-surface hover:bg-surface-hover text-text-muted text-[11px] font-bold rounded-md border border-surface-border cursor-pointer"
                              >
                                {_t('إلغاء', 'Cancel', 'Abbrechen')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveLessonRecording(lesson.id)}
                                className="px-3 py-1 bg-primary hover:bg-primary-hover text-white text-[11px] font-black rounded-md shadow-2xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>{_t('حفظ الرابط', 'Save Link', 'Speichern')}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* What was taught summary */}
                        {(lesson.report?.homeworkTitle || lesson.whatWasTaught) && (
                          <p className="text-[11px] text-text-muted font-medium line-clamp-1">
                            <span className="font-bold text-text-main">{_t('ما تم شرحه: ', 'Topic: ', 'Thema: ')}</span>
                            {lesson.report?.homeworkTitle || lesson.whatWasTaught}
                          </p>
                        )}

                        {/* Recording Buttons */}
                        {hasRecordings ? (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-surface-border/60">
                            {r1 && (
                              <div className="inline-flex items-center gap-1 bg-primary-soft/40 border border-primary-border/40 rounded-lg p-1">
                                <a
                                  href={r1}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 bg-primary hover:bg-primary-hover text-white font-black text-[11px] rounded-md transition-all flex items-center gap-1 shadow-2xs"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>{r2 ? _t('الجزء 1', 'Part 1', 'Teil 1') : _t('مشاهدة التسجيل', 'Watch Recording', 'Aufnahme ansehen')}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(lesson, r1)}
                                  className="p-1 hover:bg-primary-soft text-primary rounded cursor-pointer transition-colors"
                                  title={_t('نسخ رابط الجزء 1', 'Copy Part 1 Link', 'Link kopieren')}
                                >
                                  {copiedLessonId === `${lesson.id}_${r1}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {r2 && (
                              <div className="inline-flex items-center gap-1 bg-primary-soft/40 border border-primary-border/40 rounded-lg p-1">
                                <a
                                  href={r2}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 bg-primary hover:bg-primary-hover text-white font-black text-[11px] rounded-md transition-all flex items-center gap-1 shadow-2xs"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>{_t('الجزء 2', 'Part 2', 'Teil 2')}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(lesson, r2)}
                                  className="p-1 hover:bg-primary-soft text-primary rounded cursor-pointer transition-colors"
                                  title={_t('نسخ رابط الجزء 2', 'Copy Part 2 Link', 'Link kopieren')}
                                >
                                  {copiedLessonId === `${lesson.id}_${r2}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* WhatsApp share */}
                            <button
                              type="button"
                              onClick={() => handleShareRecordingWhatsApp(lesson)}
                              className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs ml-auto"
                              title={_t('مشاركة التسجيل على الواتساب', 'Share Recording on WhatsApp', 'Auf WhatsApp teilen')}
                            >
                              <Send className="w-3 h-3" />
                              <span>{_t('مشاركة', 'Share', 'Teilen')}</span>
                            </button>
                          </div>
                        ) : (
                          !isEditingThis && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLessonRecordingId(lesson.id);
                                setTempRec1('');
                                setTempRec2('');
                              }}
                              className="w-full py-1.5 text-center text-[11px] font-bold text-primary hover:bg-primary-soft rounded-lg border border-dashed border-primary-border/60 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{_t('إضافة رابط تسجيل لهذه الحصة', 'Add Recording Link', 'Aufnahmelink hinzufügen')}</span>
                            </button>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Action Footer for Details Tab (Never cut off!) */}
        {activeTab === 'details' && (
          <div className="p-3 bg-surface border-t border-surface-border shrink-0 flex flex-col gap-2 pb-[max(12px,env(safe-area-inset-bottom,12px))] shadow-md">
            <button
              type="submit"
              form="group-form"
              className="w-full bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-black text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{_t('حفظ التعديلات', 'Save Changes', 'Änderungen Speichern')}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowReminderModal(true)}
                className="bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Send className="w-3.5 h-3.5 fill-white shrink-0" />
                <span className="truncate">{_t('تذكير الحصة', 'Send Reminder', 'Erinnerung')}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-red-200 dark:border-red-900/40"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{_t('حذف المجموعة', 'Delete Group', 'Gruppe Löschen')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showFullAddStudentModal && (
        <AddStudentModal
          initialGroupId={group.id}
          onClose={() => setShowFullAddStudentModal(false)}
        />
      )}

      {showReminderModal && (
        <LessonReminderModal
          group={group}
          onClose={() => setShowReminderModal(false)}
        />
      )}

      <DeleteConfirmModal
        isOpen={isConfirmingDelete}
        itemType="group"
        itemName={group.name}
        recordsSummary={{
          studentsCount: groupStudents.length,
          lessonsCount: lessons.filter(l => l.groupId === group.id).length,
          paymentsCount: payments.filter(p => p.groupId === group.id).length,
          attendanceCount: lessons.filter(l => l.groupId === group.id && l.report?.attendanceStatus).length,
        }}
        onConfirmDelete={() => {
          deleteGroup(group.id);
          setIsConfirmingDelete(false);
          onClose();
        }}
        onConfirmArchive={() => {
          archiveGroup(group.id);
          setIsConfirmingDelete(false);
          onClose();
        }}
        onConfirmCascadeDelete={() => {
          setIsConfirmingCascade(true);
          setIsConfirmingDelete(false);
        }}
        onClose={() => setIsConfirmingDelete(false)}
      />
      
      {isConfirmingCascade && (
        <CascadeDeleteGroupModal
          isOpen={true}
          groupId={group.id}
          groupName={group.name}
          onClose={() => setIsConfirmingCascade(false)}
          onSuccess={() => {
            setIsConfirmingCascade(false);
            onClose();
          }}
        />
      )}

      {/* Student Profile Modal on top of Group Modal */}
      {selectedStudentForProfile && (
        <StudentProfileModal
          student={students.find(st => st.id === selectedStudentForProfile.id) || selectedStudentForProfile}
          onClose={() => setSelectedStudentForProfile(null)}
        />
      )}
    </div>
  );
};
