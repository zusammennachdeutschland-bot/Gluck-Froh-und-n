import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Group } from '../types';
import { COURSE_LEVELS, SCHOOL_GRADES } from '../data/initialData';
import { 
  Users, UserPlus, Search, Phone, Send, ChevronRight, Plus, MapPin, Video, 
  FolderCheck, X, Trash2, Edit3, Archive, RotateCcw, MoreVertical, User, 
  FileText, Award, DollarSign, Bot, ChevronDown, Filter, Sparkles, AtSign, 
  Mars, Venus, CircleHelp, Copy, Check, ArrowRightLeft, UserX, CheckSquare, Square, AlertTriangle,
  BarChart3, GraduationCap
} from 'lucide-react';
import { StudentProfileModal } from './StudentProfileModal';
import { GroupProfileModal } from './GroupProfileModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { AiImportModal } from './AiImportModal';
import { CascadeDeleteGroupModal } from './CascadeDeleteGroupModal';
import { QuickGenderAssignModal } from './QuickGenderAssignModal';
import { formatGroupScheduleDisplay, getDayNumber } from '../utils/scheduleUtils';
import { buildWhatsAppUrl, isWhatsAppUsername, cleanWhatsAppUsername, formatContactDisplay, resolveStudentWhatsAppContact, cleanPhoneNumberForTel } from '../utils/phoneUtils';
import { isLikelyFemaleStudent } from '../utils/genderUtils';
import { getStudentCode } from '../utils/studentCodeUtils';
import { normalizeSearchText } from '../utils/nameUtils';
import { DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { AvatarImage } from './AvatarImage';
import { getGroupCycleInfo, isGroupPerLesson } from '../utils/lessonUtils';
import { Pagination } from './common/Pagination';

export const StudentsView: React.FC = () => {
  const { 
    students, groups, profile, lessons, payments, language,
    setIsAddStudentModalOpen, setIsAddGroupModalOpen,
    deleteStudent, deleteStudentsByGroup, moveStudent, moveStudentsBulk,
    archiveStudent, deleteGroup, archiveGroup,
    updateStudent, updateGroup, t, _t
  } = useApp();

  // Helper for inline translations
  

  const [activeSegment, setActiveSegment] = useState<'summary' | 'students' | 'groups' | 'archive'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedGroupDay, setSelectedGroupDay] = useState<string>('all');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentTab, setSelectedStudentTab] = useState<'overview' | 'attendance' | 'scores' | 'payments' | 'files' | 'certificates' | 'recordings' | 'edit'>('overview');
  const [selectedGroupInitialTab, setSelectedGroupInitialTab] = useState<'details' | 'recordings'>('details');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedStudentCodeId, setCopiedStudentCodeId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isAiImportModalOpen, setIsAiImportModalOpen] = useState(false);
  const [isGenderAssignModalOpen, setIsGenderAssignModalOpen] = useState(false);

  // Student transfer & group clear states
  const [studentToMove, setStudentToMove] = useState<Student | null>(null);
  const [targetGroupIdForMove, setTargetGroupIdForMove] = useState<string>('');
  const [groupToClearStudents, setGroupToClearStudents] = useState<Group | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);
  const [bulkMoveTargetGroupId, setBulkMoveTargetGroupId] = useState<string>('');

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

  const activeStudents = useMemo(() => students.filter(s => s.status !== 'archived'), [students]);
  const archivedStudents = useMemo(() => students.filter(s => s.status === 'archived'), [students]);

  const activeGroups = useMemo(() => groups.filter(g => g.status !== 'archived'), [groups]);
  const archivedGroups = useMemo(() => groups.filter(g => g.status === 'archived'), [groups]);

  const groupMap = useMemo(() => {
    const map = new Map<string, Group>();
    groups.forEach(g => map.set(g.id, g));
    return map;
  }, [groups]);

  const groupStudentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    activeStudents.forEach(s => {
      if (s.groupId) {
        map.set(s.groupId, (map.get(s.groupId) || 0) + 1);
      }
    });
    return map;
  }, [activeStudents]);

  const studentLessonOnlineMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of lessons) {
      if (l.type) {
        const isOnline = l.type === 'online';
        if (l.studentId) map.set(l.studentId, isOnline);
        if (l.studentName) map.set(l.studentName.trim().toLowerCase(), isOnline);
      }
    }
    return map;
  }, [lessons]);

  const unassignedGenderCount = useMemo(() => {
    return activeStudents.filter(s => !s.gender).length;
  }, [activeStudents]);

  // Ultra-compact student summary calculation (Gender, Grades, Groups, Totals, Online/Offline)
  const studentSummary = useMemo(() => {
    const totalActive = activeStudents.length;
    let boysCount = 0;
    let girlsCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    const gradeMap: Record<string, { total: number; boys: number; girls: number; online: number; offline: number }> = {};

    activeStudents.forEach(s => {
      const isGirl = s.gender === 'female' || (!s.gender && isLikelyFemaleStudent(s.name));
      if (s.gender === 'female') {
        girlsCount++;
      } else if (s.gender === 'male') {
        boysCount++;
      } else {
        if (isGirl) girlsCount++;
        else boysCount++;
      }

      // Check online / offline status via O(1) maps
      let isOnline = false;
      if (s.groupId && groupMap.has(s.groupId)) {
        isOnline = groupMap.get(s.groupId)?.type === 'online';
      } else {
        isOnline = studentLessonOnlineMap.get(s.id) || (Boolean(s.name) && studentLessonOnlineMap.get(s.name.trim().toLowerCase())) || false;
      }

      if (isOnline) {
        onlineCount++;
      } else {
        offlineCount++;
      }

      const g = (s.grade && s.grade.trim()) || _t('بدون مرحلة', 'No Grade', 'Ohne Klasse');
      if (!gradeMap[g]) {
        gradeMap[g] = { total: 0, boys: 0, girls: 0, online: 0, offline: 0 };
      }
      gradeMap[g].total++;
      if (isGirl) {
        gradeMap[g].girls++;
      } else {
        gradeMap[g].boys++;
      }
      if (isOnline) {
        gradeMap[g].online++;
      } else {
        gradeMap[g].offline++;
      }
    });

    let inGroups = 0; // Students in multi-student groups (>= 2 students)
    let individual = 0; // Students in private 1-on-1 (group with 1 student or no group)

    activeStudents.forEach(s => {
      if (s.groupId && (groupStudentCountMap.get(s.groupId) || 0) >= 2) {
        inGroups++;
      } else {
        individual++;
      }
    });

    const multiStudentGroupsCount = activeGroups.filter(g => (groupStudentCountMap.get(g.id) || 0) >= 2).length;
    const privateGroupsCount = activeGroups.filter(g => (groupStudentCountMap.get(g.id) || 0) <= 1).length;

    const sortedGrades = Object.entries(gradeMap).sort((a, b) => b[1].total - a[1].total);

    const boysPct = totalActive > 0 ? Math.round((boysCount / totalActive) * 100) : 0;
    const girlsPct = totalActive > 0 ? 100 - boysPct : 0;

    const onlinePct = totalActive > 0 ? Math.round((onlineCount / totalActive) * 100) : 0;
    const offlinePct = totalActive > 0 ? 100 - onlinePct : 0;

    const inGroupsPct = totalActive > 0 ? Math.round((inGroups / totalActive) * 100) : 0;
    const individualPct = totalActive > 0 ? 100 - inGroupsPct : 0;

    const onlineGroupsCount = activeGroups.filter(g => g.type === 'online').length;
    const offlineGroupsCount = activeGroups.filter(g => g.type === 'offline').length;

    return {
      totalActive,
      boysCount,
      girlsCount,
      boysPct,
      girlsPct,
      onlineCount,
      offlineCount,
      onlinePct,
      offlinePct,
      inGroups,
      individual,
      inGroupsPct,
      individualPct,
      onlineGroupsCount,
      offlineGroupsCount,
      multiStudentGroupsCount,
      privateGroupsCount,
      totalGroups: activeGroups.length,
      archivedTotal: archivedStudents.length,
      sortedGrades,
    };
  }, [activeStudents, activeGroups, archivedStudents, groupMap, groupStudentCountMap, studentLessonOnlineMap, _t]);

  const [studentSortBy, setStudentSortBy] = useState<'name' | 'attendance' | 'homework' | 'dictation' | 'exam'>('name');

  // Single-pass memoized student stats calculation
  const studentStatsMap = useMemo(() => {
    const map = new Map<string, { attendanceRate: number; homeworkRate: number; avgDictation: number; avgExam: number }>();
    if (studentSortBy === 'name') return map;

    const studentLessonsMap = new Map<string, typeof lessons>();
    const completedLessons = lessons.filter(l => l.status === 'completed' && l.report);

    const groupStudentsMap = new Map<string, string[]>();
    activeStudents.forEach(s => {
      if (s.groupId) {
        const arr = groupStudentsMap.get(s.groupId) || [];
        arr.push(s.id);
        groupStudentsMap.set(s.groupId, arr);
      }
    });

    for (const l of completedLessons) {
      if (l.groupId && groupStudentsMap.has(l.groupId)) {
        for (const sId of groupStudentsMap.get(l.groupId)!) {
          const arr = studentLessonsMap.get(sId) || [];
          arr.push(l);
          studentLessonsMap.set(sId, arr);
        }
      } else if (l.studentId) {
        const arr = studentLessonsMap.get(l.studentId) || [];
        arr.push(l);
        studentLessonsMap.set(l.studentId, arr);
      }
    }

    for (const s of activeStudents) {
      const sLessons = studentLessonsMap.get(s.id) || [];
      const total = sLessons.length;
      if (total === 0) {
        map.set(s.id, { attendanceRate: 0, homeworkRate: 0, avgDictation: 0, avgExam: 0 });
        continue;
      }

      let presentCount = 0;
      let homeworkCount = 0;
      let dictSum = 0;
      let dictCount = 0;
      let examSum = 0;
      let examCount = 0;

      for (const l of sLessons) {
        const att = l.report?.studentAttendance?.[s.id] || l.report?.attendanceStatus || 'present';
        if (att === 'present' || att === 'late') presentCount++;
        if (l.report?.studentHomeworkDone?.[s.id] === 'yes') homeworkCount++;
        const dg = l.report?.studentDictationGrade?.[s.id];
        if (dg !== undefined && dg !== null && dg >= 0) {
          dictSum += dg;
          dictCount++;
        }
        const eg = l.report?.studentExamGrade?.[s.id];
        if (eg !== undefined && eg !== null && eg >= 0) {
          examSum += eg;
          examCount++;
        }
      }

      map.set(s.id, {
        attendanceRate: (presentCount / total) * 100,
        homeworkRate: (homeworkCount / total) * 100,
        avgDictation: dictCount > 0 ? dictSum / dictCount : 0,
        avgExam: examCount > 0 ? examSum / examCount : 0,
      });
    }

    return map;
  }, [activeStudents, lessons, studentSortBy]);

  const filteredStudents = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    return activeStudents.filter(s => {
      const studentGroup = s.groupId ? groupMap.get(s.groupId) : undefined;
      const sCode = getStudentCode(s);
      const matchesSearch = !term ||
                            normalizeSearchText(s.name).includes(term) || 
                            normalizeSearchText(s.certificateName).includes(term) ||
                            normalizeSearchText(s.parentName).includes(term) ||
                            normalizeSearchText(s.studentPhone).includes(term) ||
                            normalizeSearchText(s.parentPhone).includes(term) ||
                            normalizeSearchText(s.grade).includes(term) ||
                            normalizeSearchText(sCode).includes(term) ||
                            normalizeSearchText(s.studentCode).includes(term) ||
                            (studentGroup && normalizeSearchText(studentGroup.name).includes(term));
      const matchesGrade = selectedGrade === 'all' || s.grade === selectedGrade;

      let isOnline = false;
      if (studentGroup) {
        isOnline = studentGroup.type === 'online';
      } else {
        isOnline = studentLessonOnlineMap.get(s.id) || (Boolean(s.name) && studentLessonOnlineMap.get(s.name.trim().toLowerCase())) || false;
      }
      const matchesMode = selectedMode === 'all' || (selectedMode === 'online' ? isOnline : !isOnline);

      return matchesSearch && matchesGrade && matchesMode;
    });
  }, [activeStudents, groupMap, studentLessonOnlineMap, searchTerm, selectedGrade, selectedMode]);

  const sortedStudents = useMemo(() => {
    if (studentSortBy === 'name') {
      return [...filteredStudents].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return [...filteredStudents].sort((a, b) => {
      const statsA = studentStatsMap.get(a.id) || { attendanceRate: 0, homeworkRate: 0, avgDictation: 0, avgExam: 0 };
      const statsB = studentStatsMap.get(b.id) || { attendanceRate: 0, homeworkRate: 0, avgDictation: 0, avgExam: 0 };

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
  }, [filteredStudents, studentSortBy, studentStatsMap]);

  const filteredGroups = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return activeGroups.filter(g => {
      const matchesSearch = !term ||
                            (g.name || '').toLowerCase().includes(term) ||
                            (g.grade || '').toLowerCase().includes(term);
      const matchesGrade = selectedGrade === 'all' || g.grade === selectedGrade;
      const matchesDay = matchGroupDay(g, selectedGroupDay);
      const matchesMode = selectedMode === 'all' || g.type === selectedMode;
      return matchesSearch && matchesGrade && matchesDay && matchesMode;
    });
  }, [activeGroups, searchTerm, selectedGrade, selectedGroupDay, selectedMode]);

  const filteredArchivedStudents = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return archivedStudents.filter(s => {
      return !term || (s.name || '').toLowerCase().includes(term) || (s.parentName || '').toLowerCase().includes(term);
    });
  }, [archivedStudents, searchTerm]);

  const filteredArchivedGroups = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return archivedGroups.filter(g => {
      return !term || (g.name || '').toLowerCase().includes(term);
    });
  }, [archivedGroups, searchTerm]);

  // Pagination states
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPageSize, setStudentsPageSize] = useState(15);

  const [groupsPage, setGroupsPage] = useState(1);
  const [groupsPageSize, setGroupsPageSize] = useState(12);

  const [archivedStudentsPage, setArchivedStudentsPage] = useState(1);
  const [archivedStudentsPageSize, setArchivedStudentsPageSize] = useState(15);

  React.useEffect(() => {
    setStudentsPage(1);
    setGroupsPage(1);
    setArchivedStudentsPage(1);
  }, [searchTerm, selectedGrade, selectedMode, selectedGroupDay, studentSortBy]);

  const totalStudentPages = Math.max(1, Math.ceil(sortedStudents.length / studentsPageSize));
  const safeStudentsPage = Math.min(Math.max(1, studentsPage), totalStudentPages);
  const paginatedStudents = useMemo(() => {
    const start = (safeStudentsPage - 1) * studentsPageSize;
    return sortedStudents.slice(start, start + studentsPageSize);
  }, [sortedStudents, safeStudentsPage, studentsPageSize]);

  const totalGroupPages = Math.max(1, Math.ceil(filteredGroups.length / groupsPageSize));
  const safeGroupsPage = Math.min(Math.max(1, groupsPage), totalGroupPages);
  const paginatedGroups = useMemo(() => {
    const start = (safeGroupsPage - 1) * groupsPageSize;
    return filteredGroups.slice(start, start + groupsPageSize);
  }, [filteredGroups, safeGroupsPage, groupsPageSize]);

  const totalArchivedStudentPages = Math.max(1, Math.ceil(filteredArchivedStudents.length / archivedStudentsPageSize));
  const safeArchivedStudentsPage = Math.min(Math.max(1, archivedStudentsPage), totalArchivedStudentPages);
  const paginatedArchivedStudents = useMemo(() => {
    const start = (safeArchivedStudentsPage - 1) * archivedStudentsPageSize;
    return filteredArchivedStudents.slice(start, start + archivedStudentsPageSize);
  }, [filteredArchivedStudents, safeArchivedStudentsPage, archivedStudentsPageSize]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <h2 className="text-sm sm:text-base font-black text-text-main flex items-center gap-1.5 sm:gap-2">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
          <span>{t('students_and_groups_title')}</span>
        </h2>

        <div className="grid grid-cols-3 gap-1 sm:gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
          <button
            onClick={() => setIsAddStudentModalOpen(true)}
            className="px-1.5 sm:px-3 py-1.5 sm:py-2 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('students_add_student')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddGroupModalOpen(true)}
            className="px-1.5 sm:px-3 py-1.5 sm:py-2 bg-surface-hover hover:bg-surface-border active:scale-95 text-text-main border border-surface-border font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span className="truncate">{t('students_add_group')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAiImportModalOpen(true)}
            className="px-1.5 sm:px-3 py-1.5 sm:py-2 bg-primary-soft hover:bg-primary-soft/80 active:scale-95 text-primary border border-primary-border font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('auto_import_group_students')}</span>
          </button>
        </div>
      </div>

      {/* Segment Switcher Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-surface-hover p-1 rounded-lg text-[10.5px] sm:text-xs font-bold border border-surface-border">
        <button
          type="button"
          onClick={() => setActiveSegment('summary')}
          className={`py-1 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
            activeSegment === 'summary'
              ? 'bg-surface text-primary shadow-xs border border-surface-border'
              : 'text-text-muted hover:text-text-main hover:bg-surface/50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 shrink-0" />
          <span>{_t('الملخص', 'Summary', 'Übersicht')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment('students')}
          className={`py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer truncate ${
            activeSegment === 'students'
              ? 'bg-surface text-primary shadow-xs border border-surface-border'
              : 'text-text-muted hover:text-text-main hover:bg-surface/50'
          }`}
        >
          {t('daily_stats_students')} ({activeStudents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment('groups')}
          className={`py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer truncate ${
            activeSegment === 'groups'
              ? 'bg-surface text-primary shadow-xs border border-surface-border'
              : 'text-text-muted hover:text-text-main hover:bg-surface/50'
          }`}
        >
          {t('daily_stats_groups')} ({activeGroups.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment('archive')}
          className={`py-1 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
            activeSegment === 'archive'
              ? 'bg-surface text-primary shadow-xs border border-surface-border'
              : 'text-text-muted hover:text-text-main hover:bg-surface/50'
          }`}
        >
          <Archive className="w-3.5 h-3.5 shrink-0" />
          <span>{t('archive')} ({archivedStudents.length + archivedGroups.length})</span>
        </button>
      </div>

      {/* Search & Grade Filter Bar (Hidden in Summary tab) */}
      {activeSegment !== 'summary' && (
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted/70" />
          <input
            type="text"
            placeholder={activeSegment === 'students' ? t('students_search_placeholder') : t('students_search_group_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-text-main placeholder:text-text-muted/60"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-text-muted/70 hover:text-text-main cursor-pointer"
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
            <optgroup label={_t('مستويات الكورسات واللغات (Courses)', 'Course Levels (Language)', 'Sprachniveaus')}>
              {COURSE_LEVELS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </optgroup>
            <optgroup label={_t('الصفوف المدرسية (School Grades)', 'School Grades', 'Schulklassen')}>
              {SCHOOL_GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </optgroup>
          </select>

          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as any)}
            className="px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
            title={_t('تصفية حسب نمط الحضور (أونلاين / حضوري)', 'Filter by learning mode (Online / Offline)', 'Nach Modus filtern')}
          >
            <option value="all">{_t('كل الأنماط', 'All Modes', 'Alle Modi')}</option>
            <option value="online">{_t('🌐 أونلاين', '🌐 Online', '🌐 Online')}</option>
            <option value="offline">{_t('📍 حضوري / سنتر', '📍 In-Person / Center', '📍 Vor Ort')}</option>
          </select>

          {activeSegment === 'students' && (
            <select
              value={studentSortBy}
              onChange={(e) => setStudentSortBy(e.target.value as any)}
              className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="name">{_t('ترتيب: أبجدي', 'Sort: Alphabetical', 'Sortierung: Alphabetisch')}</option>
              <option value="attendance">{_t('ترتيب: نسبة الحضور', 'Sort: Attendance Rate', 'Sortierung: Anwesenheitsquote')}</option>
              <option value="homework">{_t('ترتيب: أداء الواجب', 'Sort: Homework Completion', 'Sortierung: Hausaufgaben')}</option>
              <option value="dictation">{_t('ترتيب: درجات الإملاء', 'Sort: Dictation Scores', 'Sortierung: Diktatnoten')}</option>
              <option value="exam">{_t('ترتيب: درجات الاختبارات', 'Sort: Exam Scores', 'Sortierung: Prüfungsnoten')}</option>
            </select>
          )}

          {/* Quick Gender Classification Button */}
          {activeSegment === 'students' && (
            <button
              type="button"
              id="quick-gender-assign-trigger-btn"
              onClick={() => setIsGenderAssignModalOpen(true)}
              className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover active:scale-95 border border-surface-border text-text-main font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              title={_t('تحديد جنس الطلاب سريعاً (ولد / بنت)', 'Quick gender classification (boy / girl)', 'Schnelle Geschlechtsbestimmung')}
            >
              <span className="text-xs">👦👧</span>
              <span className="truncate">{_t('تحديد الجنس', 'Assign Gender', 'Geschlecht')}</span>
              {unassignedGenderCount > 0 && (
                <span className="px-1.5 py-0.2 bg-primary text-primary-contrast text-[9.5px] font-black rounded-full">
                  {unassignedGenderCount}
                </span>
              )}
            </button>
          )}

          {(searchTerm || selectedGrade !== 'all' || selectedMode !== 'all' || selectedGroupDay !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedGrade('all');
                setSelectedMode('all');
                setSelectedGroupDay('all');
                setStudentSortBy('name');
              }}
              className="px-2 py-1.5 bg-surface-hover hover:bg-surface-border border border-surface-border text-text-main rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
              title={t('students_reset_filters')}
            >
              {t('students_reset_filters')}
            </button>
          )}
        </div>
      </div>
      )}

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

      {/* MULTI-SELECT ACTION BAR */}
      {activeSegment === 'students' && selectedStudentIds.length > 0 && (
        <div className="bg-primary-soft dark:bg-primary-soft/40 border border-primary-border/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-black flex items-center justify-center">
              {selectedStudentIds.length}
            </span>
            <span className="text-xs font-bold text-text-main">
              {_t(`تم تحديد ${selectedStudentIds.length} طالب`, `${selectedStudentIds.length} students selected`, `${selectedStudentIds.length} Schüler ausgewählt`)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setBulkMoveTargetGroupId(groups[0]?.id || '');
                setIsBulkMoveModalOpen(true);
              }}
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{_t('نقل الطلاب المحددين إلى مجموعة', 'Move Selected to Group', 'In Gruppe verschieben')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm(_t(`هل أنت متأكد من حذف ${selectedStudentIds.length} طالب؟`, `Delete ${selectedStudentIds.length} selected students?`, `${selectedStudentIds.length} Schüler löschen?`))) {
                  selectedStudentIds.forEach(id => deleteStudent(id));
                  setSelectedStudentIds([]);
                }
              }}
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{_t('حذف المحددين', 'Delete Selected', 'Ausgewählte löschen')}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStudentIds([])}
              className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main rounded-lg text-xs font-bold border border-surface-border transition-all cursor-pointer"
            >
              {_t('إلغاء التحديد', 'Deselect All', 'Abbrechen')}
            </button>
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
              <p className="text-[11px] text-text-muted">
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
            paginatedStudents.map((student, idx) => {
              const studentGroup = groups.find(g => g.id === student.groupId);
              const cleanParentPhone = cleanPhoneNumberForTel(student.parentPhone);
              const studentCode = getStudentCode(student);
              const isSelected = selectedStudentIds.includes(student.id);

              return (
                <div
                  key={`${student.id}_${idx}`}
                  className={`bg-surface border rounded-lg p-2 sm:p-2.5 shadow-2xs transition-all flex items-center justify-between gap-2.5 cursor-pointer group relative ${
                    isSelected ? 'border-primary bg-primary-soft/20 dark:border-primary' : 'border-surface-border/60 dark:border-surface-border'
                  } ${
                    activeMenuId === `student_${student.id}`
                      ? 'z-50'
                      : 'hover:shadow-xs active:scale-[0.99] active:bg-surface-hover z-0'
                  }`}
                  onClick={() => {
                    setSelectedStudent(student);
                    setSelectedStudentTab('overview');
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Multi-select checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudentIds(prev => 
                          prev.includes(student.id) 
                            ? prev.filter(id => id !== student.id) 
                            : [...prev, student.id]
                        );
                      }}
                      className="p-1 text-text-muted hover:text-primary transition-colors cursor-pointer shrink-0"
                      title={isSelected ? _t('إلغاء التحديد', 'Deselect', 'Abwählen') : _t('تحديد الطالب', 'Select student', 'Schüler auswählen')}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary fill-primary/10" />
                      ) : (
                        <Square className="w-4 h-4 text-text-muted/60" />
                      )}
                    </button>

                    <AvatarImage
                      name={student.name}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-xs font-black border border-surface-border shrink-0"
                    />

                    <div className="min-w-0 space-y-1 flex-1">
                      {/* LINE 1: Name + Gender + Grade in ONE clean row */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-black text-text-main group-hover:text-primary transition-colors tracking-tight truncate max-w-[150px] sm:max-w-[220px]">
                          {student.name}
                        </h3>

                        {/* Student Gender Icon - right next to the name */}
                        {student.gender ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStudent(student.id, { gender: student.gender === 'female' ? 'male' : 'female' });
                            }}
                            className="inline-flex items-center justify-center p-0.5 hover:scale-125 active:scale-95 transition-transform cursor-pointer bg-transparent border-0 shrink-0"
                            title={
                              student.gender === 'female'
                                ? _t('طالبة (بنت) - اضغط للتبديل إلى ولد', 'Female student (Girl) - Click to toggle', 'Schülerin (Mädchen) - Klicken zum Umschalten')
                                : _t('طالب (ولد) - اضغط للتبديل إلى بنت', 'Male student (Boy) - Click to toggle', 'Schüler (Junge) - Klicken zum Umschalten')
                            }
                          >
                            {student.gender === 'female' ? (
                              <Venus className="w-3.5 h-3.5 text-primary stroke-[2.2]" />
                            ) : (
                              <Mars className="w-3.5 h-3.5 text-primary stroke-[2.2]" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const predicted = isLikelyFemaleStudent(student.name) ? 'female' : 'male';
                              updateStudent(student.id, { gender: predicted });
                            }}
                            className="inline-flex items-center justify-center p-0.5 hover:scale-125 active:scale-95 transition-transform cursor-pointer bg-transparent border-0 shrink-0 text-text-muted/40 hover:text-primary"
                            title={_t('تحديد جنس الطالب - اضغط للتحديد السريع', 'Set student gender - Click for quick set', 'Geschlecht festlegen - Klicken für Schnellauswahl')}
                          >
                            <CircleHelp className="w-3.5 h-3.5 stroke-[1.8]" />
                          </button>
                        )}

                        {/* Grade Badge right next to name & gender */}
                        <span className="text-[9.5px] font-bold text-primary bg-primary-soft border border-primary-border/50 px-1.5 py-0.2 rounded shrink-0">
                          {student.grade}
                        </span>
                      </div>

                      {/* LINE 2: Group + Contacts */}
                      <div className="flex items-center gap-1.5 text-xs text-text-muted min-w-0 flex-wrap">
                        {studentGroup ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(studentGroup);
                            }}
                            className="font-extrabold text-text-main hover:text-primary hover:underline bg-surface-hover border border-surface-border px-1.5 py-0.2 rounded text-[9px] truncate max-w-[130px] sm:max-w-[220px] shrink-0 cursor-pointer transition-colors"
                            title={_t('انقر لفتح قائمة وبيانات المجموعة', 'Click to open group details & profile', 'Klicken, um Gruppendetails zu öffnen')}
                          >
                            {studentGroup.name}
                          </button>
                        ) : (
                          <span className="font-extrabold text-text-main bg-surface-hover border border-surface-border px-1.5 py-0.2 rounded text-[9px] truncate max-w-[130px] sm:max-w-[220px] shrink-0">
                            Gruppe A1
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted/70 inline-flex items-center gap-0.5 shrink-0">
                          • {isWhatsAppUsername(student.parentPhone) ? (
                            <span className="inline-flex items-center gap-0.5 font-bold text-primary font-mono">
                              <AtSign className="w-2.5 h-2.5" />
                              {formatContactDisplay(student.parentPhone)}
                            </span>
                          ) : (
                            <span className="font-semibold text-text-muted font-mono">{student.parentPhone}</span>
                          )}
                        </span>
                        {student.studentPhone && (
                          <span className="text-[10px] text-text-muted/70 hidden sm:inline-flex items-center gap-0.5 shrink-0">
                            • {isWhatsAppUsername(student.studentPhone) ? (
                              <span className="inline-flex items-center gap-0.5 font-bold text-primary font-mono">
                                <AtSign className="w-2.5 h-2.5" />
                                {formatContactDisplay(student.studentPhone)}
                              </span>
                            ) : (
                              <span className="font-semibold text-text-muted font-mono">{student.studentPhone}</span>
                            )}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === `student_${student.id}` ? null : `student_${student.id}`);
                        }}
                        className={`p-2 rounded-lg text-text-muted/70 hover:text-text-main transition-all hover:bg-surface-hover cursor-pointer ${
                          activeMenuId === `student_${student.id}` ? 'bg-surface-hover text-text-main' : ''
                        }`}
                        title={t('auto_options')}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === `student_${student.id}` && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                            }}
                          />
                          
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto mt-1 w-52 bg-surface border border-surface-border rounded-xl shadow-xl z-50 py-1.5 animate-scale-up text-left rtl:text-right"
                          >
                            {/* View Profile link */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudent(student);
                                setSelectedStudentTab('overview');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <User className="w-4 h-4 text-primary" />
                              <span>{t('auto_view_profile')}</span>
                            </button>

                            {/* Move / Transfer Student to Another Group */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStudentToMove(student);
                                setTargetGroupIdForMove(student.groupId || (groups[0]?.id || ''));
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <ArrowRightLeft className="w-4 h-4 text-primary" />
                              <span>{_t('نقل إلى مجموعة / فصل آخر', 'Move to Another Group', 'In andere Gruppe verschieben')}</span>
                            </button>

                            {/* Attendance tracking */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudent(student);
                                setSelectedStudentTab('attendance');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <FileText className="w-4 h-4 text-primary" />
                              <span>{t('auto_check_attendance')}</span>
                            </button>

                            {/* Scores & grades */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudent(student);
                                setSelectedStudentTab('scores');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <Award className="w-4 h-4 text-primary" />
                              <span>{t('auto_scores_homework')}</span>
                            </button>

                            {/* Payments and finances */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudent(student);
                                setSelectedStudentTab('payments');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <DollarSign className="w-4 h-4 text-primary" />
                              <span>{t('auto_payment_history')}</span>
                            </button>

                            {/* Lesson Recordings */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudent(student);
                                setSelectedStudentTab('recordings');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <Video className="w-4 h-4 text-primary" />
                              <span>{_t('تسجيلات الحصص', 'Lesson Recordings', 'Aufnahmen')}</span>
                            </button>

                            <div className="border-t border-surface-border my-1.5" />

                            {/* Send WhatsApp message & Phone Call */}
                            {(() => {
                              const resolvedContact = resolveStudentWhatsAppContact(student);
                              const hasCallNumber = !!(student.parentPhone && !isWhatsAppUsername(student.parentPhone));

                              return (
                                <>
                                  {resolvedContact.hasContact && (
                                    <a
                                      href={buildWhatsAppUrl(resolvedContact.contact)}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                                    >
                                      <Send className="w-4 h-4 text-primary" />
                                      <span>
                                        {t('auto_send_whatsapp')}
                                        {resolvedContact.isUsername ? ` (@${cleanWhatsAppUsername(resolvedContact.contact)})` : ''}
                                      </span>
                                    </a>
                                  )}

                                  {/* Phone Call Parent (if phone number available) */}
                                  {hasCallNumber && (
                                    <a
                                      href={`tel:${student.parentPhone}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                                    >
                                      <Phone className="w-4 h-4 text-primary" />
                                      <span>{t('auto_call_phone')}</span>
                                    </a>
                                  )}
                                </>
                              );
                            })()}

                            <div className="border-t border-surface-border my-1.5" />

                            {/* Delete Student */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({
                                  type: 'student',
                                  id: student.id,
                                  name: student.name
                                });
                                setActiveMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                            >
                              <Trash2 className="w-4 h-4 text-primary" />
                              <span>{t('auto_delete_archive')}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {sortedStudents.length > 0 && (
            <Pagination
              currentPage={safeStudentsPage}
              totalPages={totalStudentPages}
              totalItems={sortedStudents.length}
              pageSize={studentsPageSize}
              onPageChange={(page) => setStudentsPage(page)}
              onPageSizeChange={(size) => {
                setStudentsPageSize(size);
                setStudentsPage(1);
              }}
              pageSizeOptions={[12, 18, 30, 60]}
              itemName={t('daily_stats_students')}
              className="mt-3 col-span-full"
            />
          )}
        </div>
      )}

      {/* GROUPS LIST SEGMENT */}
      {activeSegment === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
          {filteredGroups.length === 0 ? (
            <div className="bg-surface border border-surface-border rounded-lg p-5 text-center space-y-2">
              <p className="text-sm font-bold text-text-main">
                {t('auto_no_groups_yet')}
              </p>
              <p className="text-xs text-text-muted">
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
            paginatedGroups.map((group, idx) => {
            const count = groupStudentCountMap.get(group.id) || 0;
            const cycleInfo = getGroupCycleInfo(group, lessons, language);
            const isPerLessonGroup = Boolean(
              isGroupPerLesson(group) ||
              cycleInfo.isPerLesson
            );

            const perSessionPrice = group.pricePerSession 
              ? group.pricePerSession 
              : (group.monthlyPackagePrice && group.sessionCount && group.sessionCount > 1 
                  ? Math.round(group.monthlyPackagePrice / group.sessionCount) 
                  : (group.monthlyPackagePrice || 0));

            const packageSessionsCount = isPerLessonGroup ? 1 : ((group.sessionCount && group.sessionCount > 1) ? group.sessionCount : (cycleInfo.sessionCount || 4));
            const groupRecordingsCount = (lessons || []).filter(l => l.groupId === group.id && (l.recordingLink?.trim() || l.recordingLink2?.trim() || l.report?.recordingLink?.trim() || l.report?.recordingLink2?.trim())).length;

            return (
              <div
                key={`${group.id}_${idx}`}
                onClick={() => setSelectedGroup(group)}
                className={`bg-surface border border-surface-border rounded-lg p-2 sm:p-2.5 shadow-2xs transition-all flex items-center justify-between gap-2.5 cursor-pointer group relative ${
                  activeMenuId === `group_${group.id}`
                    ? 'z-50'
                    : 'hover:shadow-xs active:scale-[0.99] active:bg-surface-hover z-0'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 border transition-all bg-primary-soft border-primary-border text-primary">
                    {group.type === 'online' ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-xs sm:text-sm font-black text-text-main group-hover:text-primary transition-colors truncate leading-tight">
                      {group.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-muted">
                      {group.grade && (
                        <span className="text-[9px] font-black text-primary bg-primary-soft border border-primary-border/50 px-1.5 py-0.2 rounded shrink-0">
                          {group.grade}
                        </span>
                      )}
                      <span className="font-extrabold text-text-main bg-surface-hover border border-surface-border px-1 py-0.2 rounded text-[9px] shrink-0">
                        {count} {t('daily_stats_students')}
                      </span>
                      {groupRecordingsCount > 0 && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGroup(group);
                            setSelectedGroupInitialTab('recordings');
                          }}
                          className="font-bold text-primary bg-primary-soft border border-primary-border px-1.5 py-0.2 rounded text-[9px] flex items-center gap-1 cursor-pointer hover:bg-primary-soft/80 transition-all shrink-0"
                          title={_t('عرض تسجيلات المجموعة', 'View Group Recordings', 'Aufnahmen der Gruppe anzeigen')}
                        >
                          <Video className="w-2.5 h-2.5 text-primary" />
                          <span>{groupRecordingsCount} {_t('تسجيلات', 'Recs', 'Aufn.')}</span>
                        </span>
                      )}
                      <span className="font-bold text-primary bg-primary-soft border border-primary-border/30 px-1 py-0.2 rounded text-[9px] font-mono shrink-0">
                        {isPerLessonGroup
                          ? `${perSessionPrice} ${profile.currency} / ${_t('حصة', 'Session', 'Sitzung')}`
                          : `${group.monthlyPackagePrice} ${profile.currency} / ${packageSessionsCount} ${_t('حصص', 'Sessions', 'Sitzungen')}`}
                      </span>

                      <span className="text-[10px] font-bold text-primary shrink-0">
                        • {isPerLessonGroup
                            ? _t('محاسبة بالحصة', 'Per Session', 'Pro Sitzung')
                            : _t(`الحصة ${cycleInfo.currentSessionNumber} من ${cycleInfo.sessionCount}`, `Session ${cycleInfo.currentSessionNumber} of ${cycleInfo.sessionCount}`, `Sitzung ${cycleInfo.currentSessionNumber} von ${cycleInfo.sessionCount}`)}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === `group_${group.id}` ? null : `group_${group.id}`);
                      }}
                      className={`p-2 rounded-lg text-text-muted/70 hover:text-text-main transition-all hover:bg-surface-hover cursor-pointer ${
                        activeMenuId === `group_${group.id}` ? 'bg-surface-hover text-text-main' : ''
                      }`}
                      title={t('auto_options')}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === `group_${group.id}` && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                          }}
                        />
                        
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto mt-1 w-48 bg-surface border border-surface-border rounded-xl shadow-xl z-50 py-1.5 animate-scale-up text-left rtl:text-right"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(group);
                              setSelectedGroupInitialTab('details');
                              setActiveMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                          >
                            <User className="w-4 h-4 text-primary" />
                            <span>{t('auto_view_details')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(group);
                              setSelectedGroupInitialTab('recordings');
                              setActiveMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-xs font-bold text-text-main hover:bg-surface-hover flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                          >
                            <Video className="w-4 h-4 text-primary" />
                            <span>{_t('تسجيلات الحصص', 'Lesson Recordings', 'Aufnahmen')} ({groupRecordingsCount})</span>
                          </button>

                          <div className="border-t border-surface-border my-1.5" />

                          {/* Clear / Delete All Students in Group */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGroupToClearStudents(group);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                          >
                            <UserX className="w-4 h-4 text-primary" />
                            <span>{_t('مسح طلاب المجموعة', 'Delete Group Students', 'Schüler der Gruppe löschen')} ({count})</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                  type: 'group',
                                  id: group.id,
                                  name: group.name
                              });
                              setActiveMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-xs font-bold text-primary hover:bg-primary-soft flex items-center gap-2.5 cursor-pointer text-left rtl:text-right"
                          >
                            <Trash2 className="w-4 h-4 text-primary" />
                            <span>{t('auto_delete_archive')}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          }))}

          {filteredGroups.length > 0 && (
            <Pagination
              currentPage={safeGroupsPage}
              totalPages={totalGroupPages}
              totalItems={filteredGroups.length}
              pageSize={groupsPageSize}
              onPageChange={(page) => setGroupsPage(page)}
              onPageSizeChange={(size) => {
                setGroupsPageSize(size);
                setGroupsPage(1);
              }}
              pageSizeOptions={[9, 15, 24, 48]}
              itemName={t('daily_stats_groups')}
              className="mt-3 col-span-full"
            />
          )}
        </div>
      )}

      {/* SUMMARY SEGMENT - ULTRA COMPACT & ELEGANT */}
      {activeSegment === 'summary' && (
        <div className="space-y-2 sm:space-y-2.5 animate-fade-in text-xs select-none">
          {/* 3 Unified Visual Ratio Bars (Theme-Adaptive) */}
          <div className="space-y-2">
            {/* 1. Groups vs Private Visual Bar */}
            <div className="p-2.5 rounded-xl bg-surface border border-surface-border shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-primary flex items-center gap-1">
                  <span>🏫</span>
                  <span>{_t('مجموعات:', 'Groups:', 'Gruppen:')} {studentSummary.inGroups}</span>
                  <span className="text-[9.5px] font-normal font-mono opacity-80">({studentSummary.inGroupsPct}%)</span>
                </span>
                <span className="text-text-muted flex items-center gap-1">
                  <span className="text-[9.5px] font-normal font-mono opacity-80">({studentSummary.individualPct}%)</span>
                  <span>{_t('فردي (برايفت):', 'Private:', 'Privat:')} {studentSummary.individual}</span>
                  <span>👤</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-border overflow-hidden flex">
                <div
                  style={{ width: `${studentSummary.inGroupsPct}%` }}
                  className="bg-primary transition-all duration-300"
                  title={`مجموعات: ${studentSummary.inGroupsPct}%`}
                />
                <div
                  style={{ width: `${studentSummary.individualPct}%` }}
                  className="bg-primary/25 transition-all duration-300"
                  title={`فردي (برايفت): ${studentSummary.individualPct}%`}
                />
              </div>
            </div>

            {/* 2. Online vs Offline Visual Bar */}
            <div className="p-2.5 rounded-xl bg-surface border border-surface-border shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-primary flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  <span>{_t('أونلاين:', 'Online:', 'Online:')} {studentSummary.onlineCount}</span>
                  <span className="text-[9.5px] font-normal font-mono opacity-80">({studentSummary.onlinePct}%)</span>
                </span>
                <span className="text-text-muted flex items-center gap-1">
                  <span className="text-[9.5px] font-normal font-mono opacity-80">({studentSummary.offlinePct}%)</span>
                  <span>{_t('حضوري:', 'In-Person:', 'Vor Ort:')} {studentSummary.offlineCount}</span>
                  <MapPin className="w-3 h-3" />
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-border overflow-hidden flex">
                <div
                  style={{ width: `${studentSummary.onlinePct}%` }}
                  className="bg-primary transition-all duration-300"
                  title={`أونلاين: ${studentSummary.onlinePct}%`}
                />
                <div
                  style={{ width: `${studentSummary.offlinePct}%` }}
                  className="bg-primary/25 transition-all duration-300"
                  title={`حضوري: ${studentSummary.offlinePct}%`}
                />
              </div>
            </div>

            {/* 3. Gender Ratio Visual Bar */}
            <div className="p-2.5 rounded-xl bg-surface border border-surface-border shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-primary flex items-center gap-1">
                  <span>👦</span>
                  <span>{_t('بنين:', 'Boys:', 'Jungen:')} {studentSummary.boysCount}</span>
                  <span className="text-[9.5px] font-normal font-mono opacity-80">({studentSummary.boysPct}%)</span>
                </span>
                <span className="text-text-muted flex items-center gap-1">
                  <span className="text-[9.5px] font-normal font-mono opacity-80">({studentSummary.girlsPct}%)</span>
                  <span>{_t('بنات:', 'Girls:', 'Mädchen:')} {studentSummary.girlsCount}</span>
                  <span>👧</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-border overflow-hidden flex">
                <div
                  style={{ width: `${studentSummary.boysPct}%` }}
                  className="bg-primary transition-all duration-300"
                  title={`بنين: ${studentSummary.boysPct}%`}
                />
                <div
                  style={{ width: `${studentSummary.girlsPct}%` }}
                  className="bg-primary/25 transition-all duration-300"
                  title={`بنات: ${studentSummary.girlsPct}%`}
                />
              </div>
            </div>
          </div>

          {/* Grade Breakdown (كام واحد في كام جريد + تفاصيل الأونلاين والأوفلاين) */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-surface border border-surface-border shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-text-main flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span>{_t('توزيع الطلاب حسب المراحل والصفوف الدراسية', 'Distribution by Grade', 'Verteilung nach Klassen')}</span>
              </h3>
              <span className="text-[10px] font-bold text-text-muted font-mono bg-surface-hover px-2 py-0.5 rounded-md border border-surface-border">
                {studentSummary.sortedGrades.length} {_t('صفوف / مستويات', 'grades/levels', 'Stufen')}
              </span>
            </div>

            {studentSummary.sortedGrades.length === 0 ? (
              <p className="text-center py-4 text-xs text-text-muted">
                {_t('لا يوجد طلاب مسجلون حالياً', 'No students registered yet', 'Keine Schüler registriert')}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                {studentSummary.sortedGrades.map(([gradeName, gStat]) => {
                  const pct = studentSummary.totalActive > 0 ? Math.round((gStat.total / studentSummary.totalActive) * 100) : 0;
                  return (
                    <div
                      key={gradeName}
                      onClick={() => {
                        setSelectedGrade(gradeName);
                        setActiveSegment('students');
                      }}
                      className="p-2 sm:p-2.5 rounded-xl bg-surface-hover/60 hover:bg-surface-hover border border-surface-border/70 transition-all cursor-pointer flex flex-col gap-1.5 group active:scale-[0.99]"
                      title={_t(`انقر لعرض طلاب ${gradeName}`, `Click to view students in ${gradeName}`, `Klicken, um Schüler anzuzeigen`)}
                    >
                      <div className="flex items-center justify-between gap-1 text-xs">
                        <span className="font-black text-text-main group-hover:text-primary transition-colors truncate">
                          {gradeName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-black text-[10px] font-mono">
                            {gStat.total} {_t('طالب', 'students', 'Schüler')}
                          </span>
                        </div>
                      </div>

                      {/* Sub-breakdown (Gender & Mode) */}
                      <div className="flex items-center justify-between text-[10px] text-text-muted font-bold font-mono">
                        <span className="flex items-center gap-1">
                          <span className="text-text-main">👦 {gStat.boys}</span>
                          <span>•</span>
                          <span className="text-text-muted">👧 {gStat.girls}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-primary">🌐 {gStat.online}</span>
                          <span>•</span>
                          <span className="text-text-muted">📍 {gStat.offline}</span>
                        </span>
                      </div>

                      {/* Mini Percentage Bar */}
                      <div className="w-full h-1.5 rounded-full bg-surface-border overflow-hidden flex">
                        <div
                          style={{ width: `${pct}%` }}
                          className="bg-primary rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Footer Stats & Gender Classification Shortcut */}
          <div className="p-2 rounded-xl bg-surface border border-surface-border flex items-center justify-between text-[10.5px] text-text-muted">
            <span className="flex items-center gap-1 font-bold">
              <span>📁 {_t('المؤرشفين:', 'Archived:', 'Archiviert:')}</span>
              <span className="font-mono text-text-main font-black">{studentSummary.archivedTotal}</span>
            </span>

            <button
              type="button"
              onClick={() => setIsGenderAssignModalOpen(true)}
              className="text-primary hover:underline font-bold text-[10.5px] flex items-center gap-1 cursor-pointer"
            >
              <span>👦👧</span>
              <span>{_t('تعديل تصنيف الجنس', 'Manage Gender Classification', 'Geschlecht verwalten')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ARCHIVE SEGMENT */}
      {activeSegment === 'archive' && (
        <div className="space-y-4">
          <div className="bg-primary-soft border border-primary-border rounded-lg p-3.5 text-xs text-primary flex items-center gap-2.5">
            <Archive className="w-5 h-5 shrink-0 text-primary" />
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
              <>
                {paginatedArchivedStudents.map((student) => (
                  <div
                    key={student.id}
                    className="bg-surface border border-surface-border rounded-lg p-3.5 flex items-center justify-between gap-3 opacity-80 hover:opacity-100 transition-all"
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
                          <span className="text-[9px] font-bold text-primary bg-primary-soft px-1.5 py-0.5 rounded">
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
                        className="px-2.5 py-1.5 bg-primary-soft hover:bg-primary-soft/80 text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
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
                        className="p-1.5 bg-primary-soft hover:bg-primary-soft/80 text-primary rounded-xl transition-all cursor-pointer"
                        title={t('delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {filteredArchivedStudents.length > 0 && (
                  <Pagination
                    currentPage={safeArchivedStudentsPage}
                    totalPages={totalArchivedStudentPages}
                    totalItems={filteredArchivedStudents.length}
                    pageSize={archivedStudentsPageSize}
                    onPageChange={(page) => setArchivedStudentsPage(page)}
                    onPageSizeChange={(size) => {
                      setArchivedStudentsPageSize(size);
                      setArchivedStudentsPage(1);
                    }}
                    pageSizeOptions={[10, 15, 25, 50]}
                    itemName={t('daily_stats_students')}
                    className="mt-2"
                  />
                )}
              </>
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
                  className="bg-surface border border-surface-border rounded-lg p-3.5 flex items-center justify-between gap-3 opacity-80 hover:opacity-100 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-text-main line-through">
                        {group.name}
                      </h4>
                      <span className="text-[9px] font-bold text-primary bg-primary-soft px-1.5 py-0.5 rounded">
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
                      className="px-2.5 py-1.5 bg-primary-soft hover:bg-primary-soft/80 text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
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
                      className="p-1.5 bg-primary-soft hover:bg-primary-soft/80 text-primary rounded-xl transition-all cursor-pointer"
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
          initialTab={selectedGroupInitialTab}
          onClose={() => {
            setSelectedGroup(null);
            setSelectedGroupInitialTab('details');
          }}
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
                  studentsCount: groupStudentCountMap.get(deleteTarget.id) || 0,
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

      {/* Quick Gender Assign Modal */}
      <QuickGenderAssignModal
        isOpen={isGenderAssignModalOpen}
        onClose={() => setIsGenderAssignModalOpen(false)}
      />

      {/* SINGLE STUDENT MOVE MODAL */}
      {studentToMove && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center border border-primary-border">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main">
                    {_t('نقل الطالب إلى مجموعة / فصل آخر', 'Move Student to Another Group', 'Schüler verschieben')}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {studentToMove.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToMove(null)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  {_t('اختر المجموعة / الفصل الجديد:', 'Select Target Group:', 'Zielgruppe wählen:')}
                </label>
                <select
                  value={targetGroupIdForMove}
                  onChange={(e) => setTargetGroupIdForMove(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">{_t('-- بدون مجموعة --', '-- No Group --', '-- Keine Gruppe --')}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.level}) - {groupStudentCountMap.get(g.id) || 0} {_t('طلاب', 'students', 'Schüler')}
                    </option>
                  ))}
                </select>
              </div>

              {studentToMove.groupId && (
                <div className="text-[11px] text-text-muted bg-surface-hover p-2.5 rounded-lg border border-surface-border flex items-center gap-2">
                  <span className="font-bold">{_t('المجموعة الحالية:', 'Current Group:', 'Aktuelle Gruppe:')}</span>
                  <span className="text-text-main font-bold">
                    {groups.find(g => g.id === studentToMove.groupId)?.name || studentToMove.groupId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setStudentToMove(null)}
                className="px-3.5 py-2 text-xs font-bold text-text-muted hover:text-text-main rounded-xl border border-surface-border hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  moveStudent(studentToMove.id, targetGroupIdForMove || null);
                  setStudentToMove(null);
                }}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{_t('تأكيد النقل', 'Confirm Move', 'Verschieben bestätigen')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK MOVE STUDENTS MODAL */}
      {isBulkMoveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="w-6 h-6 text-primary shrink-0" />
                <div>
                  <h3 className="text-sm font-black text-text-main">
                    {_t('نقل الطلاب المحددين جماعياً', 'Bulk Move Selected Students', 'Ausgewählte Schüler verschieben')}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {_t(`سيتم نقل ${selectedStudentIds.length} طالب دفعة واحدة`, `Moving ${selectedStudentIds.length} students at once`, `${selectedStudentIds.length} Schüler werden verschoben`)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkMoveModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">
                  {_t('اختر المجموعة / الفصل الجديد للطلاب:', 'Select Target Group for Students:', 'Zielgruppe für Schüler wählen:')}
                </label>
                <select
                  value={bulkMoveTargetGroupId}
                  onChange={(e) => setBulkMoveTargetGroupId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">{_t('-- بدون مجموعة --', '-- No Group --', '-- Keine Gruppe --')}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.level}) - {groupStudentCountMap.get(g.id) || 0} {_t('طلاب', 'students', 'Schüler')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-36 overflow-y-auto bg-surface-hover/50 p-2 rounded-lg border border-surface-border space-y-1">
                {selectedStudentIds.map(id => {
                  const st = students.find(s => s.id === id);
                  return (
                    <div key={id} className="text-xs font-bold text-text-main flex items-center justify-between">
                      <span>{st?.name || id}</span>
                      <span className="text-[10px] text-text-muted font-normal">
                        {groups.find(g => g.id === st?.groupId)?.name || _t('بدون مجموعة', 'No group', 'Keine')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setIsBulkMoveModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-text-muted hover:text-text-main rounded-xl border border-surface-border hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  moveStudentsBulk(selectedStudentIds, bulkMoveTargetGroupId || null);
                  setSelectedStudentIds([]);
                  setIsBulkMoveModalOpen(false);
                }}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{_t(`نقل (${selectedStudentIds.length}) طالب`, `Move (${selectedStudentIds.length}) students`, `(${selectedStudentIds.length}) Schüler verschieben`)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR GROUP STUDENTS CONFIRMATION MODAL */}
      {groupToClearStudents && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center border border-primary-border">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main">
                    {_t('مسح طلاب المجموعة / الفصل', 'Clear Group Students', 'Gruppenschüler löschen')}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {groupToClearStudents.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGroupToClearStudents(null)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-surface border border-surface-border rounded-xl space-y-2 text-xs">
              <div className="font-bold text-text-main flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-primary" />
                <span>
                  {_t(
                    `هل أنت متأكد من حذف جميع طلاب فصل (${groupToClearStudents.name})؟`,
                    `Are you sure you want to delete all students in (${groupToClearStudents.name})?`,
                    `Möchten Sie wirklich alle Schüler in (${groupToClearStudents.name}) löschen?`
                  )}
                </span>
              </div>
              <p className="text-text-muted text-[11px] leading-relaxed">
                {_t(
                  `سيتم حذف (${groupStudentCountMap.get(groupToClearStudents.id) || 0}) طالب ونقلهم إلى المحذوفات مؤخراً ليمكن استرجاعهم عند الحاجة. لن يتم حذف المجموعة نفسها.`,
                  `(${groupStudentCountMap.get(groupToClearStudents.id) || 0}) students will be deleted and kept in Recently Deleted for recovery. The group itself will remain intact.`,
                  `(${groupStudentCountMap.get(groupToClearStudents.id) || 0}) Schüler werden gelöscht und in den Papierkorb verschoben.`
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setGroupToClearStudents(null)}
                className="px-3.5 py-2 text-xs font-bold text-text-muted hover:text-text-main rounded-xl border border-surface-border hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteStudentsByGroup(groupToClearStudents.id);
                  setGroupToClearStudents(null);
                }}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{_t('تأكيد مسح الطلاب', 'Confirm Delete Students', 'Schüler löschen')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
