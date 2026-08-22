import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Group } from '../types';
import { Users, UserPlus, Search, Phone, Send, ChevronRight, Plus, MapPin, Video, FolderCheck, X, Trash2, Edit3, Archive, RotateCcw, MoreVertical, User, FileText, Award, DollarSign, Bot, ChevronDown, Filter } from 'lucide-react';
import { StudentProfileModal } from './StudentProfileModal';
import { GroupProfileModal } from './GroupProfileModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { AiImportModal } from './AiImportModal';
import { CascadeDeleteGroupModal } from './CascadeDeleteGroupModal';
import { formatGroupScheduleDisplay, getDayNumber } from '../utils/scheduleUtils';
import { buildWhatsAppUrl } from '../utils/phoneUtils';
import { DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { AvatarImage } from './AvatarImage';

export const StudentsView: React.FC = () => {
  const { 
    students, groups, profile, lessons, payments, language,
    setIsAddStudentModalOpen, setIsAddGroupModalOpen,
    deleteStudent, archiveStudent, deleteGroup, archiveGroup,
    updateStudent, updateGroup, t, _t
  } = useApp();

  // Helper for inline translations
  

  const [activeSegment, setActiveSegment] = useState<'students' | 'groups' | 'archive'>('students');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedGroupDay, setSelectedGroupDay] = useState<string>('all');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentTab, setSelectedStudentTab] = useState<'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'edit'>('overview');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isAiImportModalOpen, setIsAiImportModalOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'student' | 'group';
    id: string;
    name: string;
  } | null>(null);

  const [cascadeTarget, setCascadeTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const GERMAN_WEEKDAYS = [
    { short: 'Mo', full: 'Montag', dayNum: 1 },
    { short: 'Di', full: 'Dienstag', dayNum: 2 },
    { short: 'Mi', full: 'Mittwoch', dayNum: 3 },
    { short: 'Do', full: 'Donnerstag', dayNum: 4 },
    { short: 'Fr', full: 'Freitag', dayNum: 5 },
    { short: 'Sa', full: 'Samstag', dayNum: 6 },
    { short: 'So', full: 'Sonntag', dayNum: 0 },
  ];

  const matchGroupDay = (group: Group, dayFilter: string): boolean => {
    if (!dayFilter || dayFilter === 'all') return true;
    if (!group.scheduleDays || group.scheduleDays.length === 0) return false;

    const targetDayNum = dayFilter === 'today' ? new Date().getDay() : getDayNumber(dayFilter);
    if (targetDayNum === -1) return true;

    return group.scheduleDays.some(d => getDayNumber(d) === targetDayNum);
  };

  const activeStudents = students.filter(s => s.status !== 'archived');
  const archivedStudents = students.filter(s => s.status === 'archived');

  const activeGroups = groups.filter(g => g.status !== 'archived');
  const archivedGroups = groups.filter(g => g.status === 'archived');

  const [studentSortBy, setStudentSortBy] = useState<'name' | 'attendance' | 'homework' | 'dictation' | 'exam'>('name');

  const getStudentStats = (student: Student) => {
    // completed lessons where student is part of the group, or is the individual student
    const studentLessons = lessons.filter(l => 
      l.status === 'completed' && l.report && 
      (l.groupId === student.groupId || (l.studentId ? l.studentId === student.id : (!!l.studentName && l.studentName.trim().toLowerCase() === student.name.trim().toLowerCase())))
    );

    const totalLessons = studentLessons.length;
    if (totalLessons === 0) {
      return { attendanceRate: 0, homeworkRate: 0, avgDictation: 0, avgExam: 0 };
    }

    // Attendance rate
    const presentCount = studentLessons.filter(l => {
      const att = l.report?.studentAttendance?.[student.id] || l.report?.attendanceStatus || 'present';
      return att === 'present' || att === 'late';
    }).length;
    const attendanceRate = (presentCount / totalLessons) * 100;

    // Homework completion rate
    const homeworkDoneCount = studentLessons.filter(l => l.report?.studentHomeworkDone?.[student.id] === 'yes').length;
    const homeworkRate = (homeworkDoneCount / totalLessons) * 100;

    // Avg Dictation score
    const dictationGrades = studentLessons
      .map(l => l.report?.studentDictationGrade?.[student.id])
      .filter(g => g !== undefined) as number[];
    const avgDictation = dictationGrades.length > 0 
      ? dictationGrades.reduce((sum, g) => sum + g, 0) / dictationGrades.length 
      : 0;

    // Avg Exam score
    const examGrades = studentLessons
      .map(l => l.report?.studentExamGrade?.[student.id])
      .filter(g => g !== undefined) as number[];
    const avgExam = examGrades.length > 0 
      ? examGrades.reduce((sum, g) => sum + g, 0) / examGrades.length 
      : 0;

    return { attendanceRate, homeworkRate, avgDictation, avgExam };
  };

  const filteredStudents = activeStudents.filter(s => {
    const studentGroup = groups.find(g => g.id === s.groupId);
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
                          s.name.toLowerCase().includes(term) || 
                          s.parentName.toLowerCase().includes(term) ||
                          s.studentPhone.toLowerCase().includes(term) ||
                          s.parentPhone.toLowerCase().includes(term) ||
                          s.grade.toLowerCase().includes(term) ||
                          (studentGroup && studentGroup.name.toLowerCase().includes(term));
    const matchesGrade = selectedGrade === 'all' || s.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (studentSortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    const statsA = getStudentStats(a);
    const statsB = getStudentStats(b);

    if (studentSortBy === 'attendance') {
      return statsB.attendanceRate - statsA.attendanceRate;
    }
    if (studentSortBy === 'homework') {
      return statsB.homeworkRate - statsA.homeworkRate;
    }
    if (studentSortBy === 'dictation') {
      return statsB.avgDictation - statsA.avgDictation;
    }
    if (studentSortBy === 'exam') {
      return statsB.avgExam - statsA.avgExam;
    }
    return 0;
  });

  const filteredGroups = activeGroups.filter(g => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
                          g.name.toLowerCase().includes(term) ||
                          g.grade.toLowerCase().includes(term);
    const matchesGrade = selectedGrade === 'all' || g.grade === selectedGrade;
    const matchesDay = matchGroupDay(g, selectedGroupDay);
    return matchesSearch && matchesGrade && matchesDay;
  });

  const filteredArchivedStudents = archivedStudents.filter(s => {
    const term = searchTerm.toLowerCase();
    return !term || s.name.toLowerCase().includes(term) || s.parentName.toLowerCase().includes(term);
  });

  const filteredArchivedGroups = archivedGroups.filter(g => {
    const term = searchTerm.toLowerCase();
    return !term || g.name.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-4 ">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-black text-text-main flex items-center gap-2">
          <Users className="w-5 h-5 text-primary shrink-0" />
          <span>{t('students_and_groups_title')}</span>
        </h2>

        <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
          <button
            onClick={() => setIsAddStudentModalOpen(true)}
            className="px-2 sm:px-3 py-2 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-[10.5px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('students_add_student')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddGroupModalOpen(true)}
            className="px-2 sm:px-3 py-2 sm:py-2.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 text-text-main border border-surface-border font-bold text-[10.5px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span className="truncate">{t('students_add_group')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAiImportModalOpen(true)}
            className="px-2 sm:px-3 py-2 sm:py-2.5 bg-primary-soft hover:bg-primary-soft/80 active:scale-95 text-primary border border-primary-border font-bold text-[10.5px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('auto_import_group_students')}</span>
          </button>
        </div>
      </div>

      {/* Segment Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1 rounded-lg text-xs font-bold">
        <button
          onClick={() => setActiveSegment('students')}
          className={`py-1.5 rounded-lg transition-all cursor-pointer ${
            activeSegment === 'students'
              ? 'bg-surface text-primary dark:text-primary shadow-xs'
              : 'text-text-muted hover:text-slate-900 dark:hover:text-primary'
          }`}
        >
          {t('daily_stats_students')} ({activeStudents.length})
        </button>

        <button
          onClick={() => setActiveSegment('groups')}
          className={`py-1.5 rounded-lg transition-all cursor-pointer ${
            activeSegment === 'groups'
              ? 'bg-surface text-primary dark:text-primary shadow-xs'
              : 'text-text-muted hover:text-slate-900 dark:hover:text-primary'
          }`}
        >
          {t('daily_stats_groups')} ({activeGroups.length})
        </button>

        <button
          onClick={() => setActiveSegment('archive')}
          className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeSegment === 'archive'
              ? 'bg-surface text-primary dark:text-primary shadow-xs'
              : 'text-text-muted hover:text-slate-900 dark:hover:text-primary'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>{t('archive')} ({archivedStudents.length + archivedGroups.length})</span>
        </button>
      </div>

      {/* Search & Grade Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted/70" />
          <input
            type="text"
            placeholder={activeSegment === 'students' ? t('students_search_placeholder') : t('students_search_group_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-text-muted/70 hover:text-slate-600 dark:hover:text-primary cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">{t('students_all_grades')}</option>
            {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {activeSegment === 'students' && (
            <select
              value={studentSortBy}
              onChange={(e) => setStudentSortBy(e.target.value as any)}
              className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="name">ترتيب: أبجدي (Name)</option>
              <option value="attendance">ترتيب: نسبة الحضور (Attendance)</option>
              <option value="homework">ترتيب: أداء الواجب (Homework)</option>
              <option value="dictation">ترتيب: درجات الإملاء (Dictation)</option>
              <option value="exam">ترتيب: درجات الاختبارات (Exams)</option>
            </select>
          )}

          {(searchTerm || selectedGrade !== 'all' || selectedGroupDay !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedGrade('all');
                setSelectedGroupDay('all');
                setStudentSortBy('name');
              }}
              className="px-2 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-text-main rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
              title={t('students_reset_filters')}
            >
              {t('students_reset_filters')}
            </button>
          )}
        </div>
      </div>

      {/* DAILY FILTER FOR GROUPS */}
      {activeSegment === 'groups' && (
        <div className="relative">
          <select
            value={selectedGroupDay}
            onChange={(e) => setSelectedGroupDay(e.target.value)}
            className="w-full bg-surface border border-surface-border text-text-main text-xs font-bold rounded-lg px-3 py-1.5 appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
          >
            <option value="all">{t('students_all_days') || 'All Days'}</option>
            <option value="today">{t('students_today') || 'Today'} ({GERMAN_WEEKDAYS.find(w => w.dayNum === new Date().getDay())?.short})</option>
            {GERMAN_WEEKDAYS.map(w => (
              <option key={w.short} value={w.short}>
                {_t(w.full, w.full, w.full)}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </div>
        </div>
      )}

      {/* STUDENTS LIST SEGMENT */}
      {activeSegment === 'students' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
          {sortedStudents.length === 0 ? (
            <div className="bg-surface border border-surface-border rounded-lg p-4 text-center space-y-2">
              <p className="text-xs font-bold text-text-main">
                {t('auto_no_students_yet')}
              </p>
              <p className="text-[11px] text-slate-500">
                {t('auto_add_your_first_student_to_trac')}
              </p>
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(true)}
                className="mt-2 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-lg shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95 hover:shadow-lg hover:shadow-primary/30"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t('students_add_student')}</span>
              </button>
            </div>
          ) : (
            sortedStudents.map((student, idx) => {
              const studentGroup = groups.find(g => g.id === student.groupId);
              const cleanParentPhone = student.parentPhone.replace(/[^0-9+]/g, '');

              return (
                <div
                  key={`${student.id}_${idx}`}
                  className="bg-surface border border-surface-border/60 dark:border-surface-border rounded-lg p-2.5 sm:p-3 shadow-2xs hover:shadow-xs active:scale-[0.99] active:bg-surface-hover transition-all flex items-center justify-between gap-2.5 cursor-pointer group relative"
                  onClick={() => {
                    setSelectedStudent(student);
                    setSelectedStudentTab('overview');
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarImage
                      name={student.name}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-xs font-black border border-slate-100 dark:border-surface-border shrink-0"
                    />

                    <div className="min-w-0 space-y-0.5">
                      {/* PROMINENT STUDENT NAME */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <h3 className="text-xs sm:text-sm font-black text-text-main group-hover:text-primary transition-colors tracking-tight truncate">
                          {student.name}
                        </h3>
                        {student.certificateName && (
                          <span className="text-[10px] font-bold text-text-muted/80 font-mono tracking-wide bg-slate-50 dark:bg-slate-800/60 px-1 py-0.2 rounded border border-surface-border-soft dark:border-slate-800 shrink-0" title={_t('الاسم بالإنجليزية للشهادات', 'English Name for Certificates', 'Englischer Name für Zertifikate')}>
                            {student.certificateName}
                          </span>
                        )}
                        <span className="text-[9px] font-black text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft/40 border border-primary-border/50 dark:border-primary-border/30 px-1.5 py-0.2 rounded shrink-0">
                          {student.grade}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-muted">
                        <span className="font-extrabold text-text-main bg-surface-hover border border-surface-border-soft px-1 py-0.2 rounded text-[9px]">
                          {studentGroup?.name || 'Gruppe A1'}
                        </span>
                        <span className="text-[10px] text-text-muted/70">
                          • <span className="font-semibold text-slate-600 dark:text-slate-300">{student.parentPhone}</span>
                        </span>
                        {student.studentPhone && (
                          <span className="text-[10px] text-text-muted/70">
                            • <span className="font-semibold text-slate-600 dark:text-slate-300">{student.studentPhone}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Redesigned Student Actions Menu */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === `student_${student.id}` ? null : `student_${student.id}`)}
                        className={`p-2 rounded-lg text-text-muted/70 hover:text-slate-800 dark:hover:text-primary transition-all hover:bg-background dark:hover:bg-slate-800 cursor-pointer ${
                          activeMenuId === `student_${student.id}` ? 'bg-surface-hover text-text-main' : ''
                        }`}
                        title={t('auto_options')}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === `student_${student.id}` && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setActiveMenuId(null)} />
                          
                          <div className="absolute ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto mt-1 w-52 bg-surface border border-surface-border/80 dark:border-surface-border/80 rounded-xl shadow-xl z-30 py-1.5 animate-scale-up text-left rtl:text-right">
                            {/* View Profile link */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(student);
                                setSelectedStudentTab('overview');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-background dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <User className="w-4 h-4 text-primary" />
                              <span>{t('auto_view_profile')}</span>
                            </button>

                            {/* Attendance tracking */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(student);
                                setSelectedStudentTab('attendance');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-background dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <FileText className="w-4 h-4 text-primary" />
                              <span>{t('auto_check_attendance')}</span>
                            </button>

                            {/* Scores & grades */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(student);
                                setSelectedStudentTab('scores');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-background dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <Award className="w-4 h-4 text-primary" />
                              <span>{t('auto_scores_homework')}</span>
                            </button>

                            {/* Payments and finances */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(student);
                                setSelectedStudentTab('payments');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-background dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <DollarSign className="w-4 h-4 text-primary" />
                              <span>{t('auto_payment_history')}</span>
                            </button>

                            <div className="border-t border-slate-100 dark:border-surface-border/80 my-1.5" />

                            {/* Send WhatsApp message */}
                            <a
                              href={buildWhatsAppUrl(student.parentPhone)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setActiveMenuId(null)}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-background dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <Send className="w-4 h-4 text-primary" />
                              <span>{t('auto_send_whatsapp')}</span>
                            </a>

                            {/* Phone Call Parent */}
                            <a
                              href={`tel:${student.parentPhone}`}
                              onClick={() => setActiveMenuId(null)}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-background dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <Phone className="w-4 h-4 text-primary" />
                              <span>{t('auto_call_phone')}</span>
                            </a>

                            <div className="border-t border-slate-100 dark:border-surface-border/80 my-1.5" />

                            {/* Delete Student */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget({
                                  type: 'student',
                                  id: student.id,
                                  name: student.name
                                });
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft dark:hover:bg-primary-soft flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <Trash2 className="w-4 h-4 text-primary" />
                              <span>{t('auto_delete_archive')}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors ml-0.5" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* GROUPS LIST SEGMENT */}
      {activeSegment === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredGroups.length === 0 ? (
            <div className="bg-surface border border-surface-border rounded-lg p-5 text-center space-y-2">
              <p className="text-sm font-bold text-text-main">
                {t('auto_no_groups_yet')}
              </p>
              <p className="text-xs text-slate-500">
                {t('auto_create_your_first_group_to_sta')}
              </p>
              <button
                type="button"
                onClick={() => setIsAddGroupModalOpen(true)}
                className="mt-3 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('students_add_group')}</span>
              </button>
            </div>
          ) : (
            filteredGroups.map((group, idx) => {
            const count = students.filter(s => s.groupId === group.id).length;

            return (
              <div
                key={`${group.id}_${idx}`}
                onClick={() => setSelectedGroup(group)}
                className="bg-surface border border-surface-border/60 dark:border-surface-border rounded-lg p-2.5 sm:p-3 shadow-2xs hover:shadow-xs active:scale-[0.99] active:bg-surface-hover transition-all flex items-center justify-between gap-2.5 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                    group.type === 'online' 
                      ? 'bg-primary-soft border-primary-border dark:bg-primary-soft dark:border-primary-border text-primary dark:text-primary' 
                      : 'bg-primary-soft border-primary-border dark:bg-primary-soft dark:border-primary-border text-primary dark:text-primary'
                  }`}>
                    {group.type === 'online' ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <h3 className="text-xs sm:text-sm font-black text-text-main group-hover:text-primary transition-colors break-words leading-snug">
                      {group.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-muted">
                      {group.grade && (
                        <span className="text-[9px] font-black text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft border border-primary-border/50 dark:border-primary-border px-1.5 py-0.2 rounded shrink-0">
                          {group.grade}
                        </span>
                      )}
                      <span className="font-extrabold text-text-main bg-surface-hover border border-surface-border-soft px-1 py-0.2 rounded text-[9px]">
                        {count} {t('daily_stats_students')}
                      </span>
                      <span className="font-bold text-primary dark:text-primary bg-primary-soft dark:bg-primary-soft border border-primary-border/30 dark:border-primary-border px-1 py-0.2 rounded text-[9px] font-mono">
                        {group.paymentModel === 'per_session'
                          ? `${group.pricePerSession || Math.round(group.monthlyPackagePrice / (group.sessionCount || 8))} ${profile.currency} / Sitzung`
                          : `${group.monthlyPackagePrice} ${profile.currency} / ${group.sessionCount} Sessions`}
                      </span>
                      <span className="text-text-muted/70 text-[10px] truncate max-w-[130px] sm:max-w-[200px]" title={formatGroupScheduleDisplay(group, language)}>
                        • {formatGroupScheduleDisplay(group, language)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Redesigned Group Actions Menu */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === `group_${group.id}` ? null : `group_${group.id}`)}
                      className={`p-2 rounded-lg text-text-muted/70 hover:text-slate-800 dark:hover:text-primary transition-all hover:bg-background dark:hover:bg-slate-800 cursor-pointer ${
                        activeMenuId === `group_${group.id}` ? 'bg-surface-hover text-text-main' : ''
                      }`}
                      title={t('auto_options')}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === `group_${group.id}` && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setActiveMenuId(null)} />
                        
                        <div className="absolute ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto mt-1 w-48 bg-surface border border-surface-border/80 dark:border-surface-border/80 rounded-xl shadow-xl z-30 py-1.5 animate-scale-up text-left rtl:text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGroup(group);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-background dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                          >
                            <User className="w-4 h-4 text-primary" />
                            <span>{t('auto_view_details')}</span>
                          </button>

                          <div className="border-t border-slate-100 dark:border-surface-border/80 my-1.5" />

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget({
                                  type: 'group',
                                  id: group.id,
                                  name: group.name
                              });
                              setActiveMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft dark:hover:bg-primary-soft flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                          >
                            <Trash2 className="w-4 h-4 text-primary" />
                            <span>{t('auto_delete_archive')}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors ml-0.5" />
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* ARCHIVE SEGMENT */}
      {activeSegment === 'archive' && (
        <div className="space-y-4">
          <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border rounded-lg p-3.5 text-xs text-primary dark:text-primary flex items-center gap-2.5">
            <Archive className="w-5 h-5 shrink-0 text-primary dark:text-primary" />
            <span>
              {t('students_archive_info')}
            </span>
          </div>

          {/* Archived Students Subsection */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center justify-between">
              <span>{t('students_archived_students_title')} ({archivedStudents.length})</span>
            </h3>

            {filteredArchivedStudents.length === 0 ? (
              <div className="bg-surface border border-surface-border rounded-lg p-4 text-center text-xs text-text-muted/70">
                {t('students_no_archived_students')}
              </div>
            ) : (
              filteredArchivedStudents.map((student) => (
                <div
                  key={student.id}
                  className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-lg p-3.5 flex items-center justify-between gap-3 opacity-80 hover:opacity-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <AvatarImage
                      name={student.name}
                      className="w-10 h-10 rounded-xl font-black text-xs opacity-70"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-text-main line-through">
                          {student.name}
                        </h4>
                        <span className="text-[9px] font-bold text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.5 rounded">
                          {t('students_archived')}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted/70">
                        {t('students_parent_phone_label')}: {student.parentName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateStudent(student.id, { status: 'active' })}
                      className="px-2.5 py-1.5 bg-primary-soft dark:bg-primary-soft hover:bg-primary-soft text-primary dark:text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title={t('students_restore')}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('students_restore')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget({
                          type: 'student',
                          id: student.id,
                          name: student.name
                        });
                      }}
                      className="p-1.5 bg-red-50 dark:bg-red-950 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Archived Groups Subsection */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center justify-between">
              <span>{t('students_archived_groups_title')} ({archivedGroups.length})</span>
            </h3>

            {filteredArchivedGroups.length === 0 ? (
              <div className="bg-surface border border-surface-border rounded-lg p-4 text-center text-xs text-text-muted/70">
                {t('students_no_archived_groups')}
              </div>
            ) : (
              filteredArchivedGroups.map((group) => (
                <div
                  key={group.id}
                  className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-lg p-3.5 flex items-center justify-between gap-3 opacity-80 hover:opacity-100 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-text-main line-through">
                        {group.name}
                      </h4>
                      <span className="text-[9px] font-bold text-primary bg-primary-soft dark:bg-primary-soft px-1.5 py-0.5 rounded">
                        {t('students_archived')}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted/70">
                      Grade: {group.grade}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateGroup(group.id, { status: 'active' })}
                      className="px-2.5 py-1.5 bg-primary-soft dark:bg-primary-soft hover:bg-primary-soft text-primary dark:text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title={t('students_restore')}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('students_restore')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget({
                          type: 'group',
                          id: group.id,
                          name: group.name
                        });
                      }}
                      className="p-1.5 bg-red-50 dark:bg-red-950 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Profile Modals */}
      {selectedStudent && (
        <StudentProfileModal
          student={selectedStudent}
          initialTab={selectedStudentTab}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {selectedGroup && (
        <GroupProfileModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}

      {/* AI Import Group + Students Modal */}
      <AiImportModal
        isOpen={isAiImportModalOpen}
        onClose={() => setIsAiImportModalOpen(false)}
        onSelectGroup={(g) => setSelectedGroup(g)}
      />

      {/* Custom Delete & Archive Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={!!deleteTarget}
          itemType={deleteTarget.type}
          itemName={deleteTarget.name}
          recordsSummary={
            deleteTarget.type === 'student'
              ? {
                  lessonsCount: lessons.filter(l => l.studentId ? l.studentId === deleteTarget.id : l.studentName === deleteTarget.name).length,
                  paymentsCount: payments.filter(p => p.studentId ? p.studentId === deleteTarget.id : p.studentName === deleteTarget.name).length,
                  attendanceCount: lessons.filter(l => (l.studentId ? l.studentId === deleteTarget.id : l.studentName === deleteTarget.name) && l.report?.attendanceStatus).length,
                }
              : {
                  studentsCount: students.filter(s => s.groupId === deleteTarget.id).length,
                  lessonsCount: lessons.filter(l => l.groupId === deleteTarget.id).length,
                  paymentsCount: payments.filter(p => p.groupId === deleteTarget.id).length,
                  attendanceCount: lessons.filter(l => l.groupId === deleteTarget.id && l.report?.attendanceStatus).length,
                }
          }
          onConfirmDelete={() => {
            if (deleteTarget.type === 'student') {
              deleteStudent(deleteTarget.id);
            } else {
              deleteGroup(deleteTarget.id);
            }
            setDeleteTarget(null);
          }}
          onConfirmArchive={() => {
            if (deleteTarget.type === 'student') {
              archiveStudent(deleteTarget.id);
            } else {
              archiveGroup(deleteTarget.id);
            }
            setDeleteTarget(null);
          }}
          onConfirmCascadeDelete={deleteTarget.type === 'group' ? () => {
            setCascadeTarget({ id: deleteTarget.id, name: deleteTarget.name });
            setDeleteTarget(null);
          } : undefined}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Cascade Delete Group Modal */}
      {cascadeTarget && (
        <CascadeDeleteGroupModal
          isOpen={true}
          groupId={cascadeTarget.id}
          groupName={cascadeTarget.name}
          onClose={() => setCascadeTarget(null)}
          onSuccess={() => {
            if (selectedGroup?.id === cascadeTarget.id) setSelectedGroup(null);
            if (selectedStudent?.groupId === cascadeTarget.id) setSelectedStudent(null);
            setCascadeTarget(null);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};
