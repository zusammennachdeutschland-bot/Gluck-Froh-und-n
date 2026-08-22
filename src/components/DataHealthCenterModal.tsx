import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { StudentProfileModal } from './StudentProfileModal';
import { GroupProfileModal } from './GroupProfileModal';
import { Student, Group, Lesson, PaymentRecord } from '../types';
import { storage } from '../services/storageService';
import { 
  X, CheckCircle2, AlertTriangle, AlertCircle, ChevronRight, Activity, 
  Video, MapPin, RefreshCw, Trash2, Eye, Database, ShieldCheck, 
  Users, UserX, Calendar, DollarSign, CheckSquare, BookOpen, Award, Sparkles
} from 'lucide-react';

interface DataHealthCenterModalProps {
  onClose: () => void;
}

export type OrphanCategoryType = 
  | 'students' 
  | 'sessions' 
  | 'calendarSessions' 
  | 'payments' 
  | 'attendance' 
  | 'homework' 
  | 'exams';

export interface CleanupBreakdown {
  students: number;
  sessions: number;
  calendarEvents: number;
  payments: number;
  attendance: number;
  homework: number;
  exams: number;
  storageRecoveredMb: number;
}

export const DataHealthCenterModal: React.FC<DataHealthCenterModalProps> = ({ onClose }) => {
  const { 
    students, setStudents, 
    groups, 
    lessons, setLessons, 
    payments, setPayments, 
    getHistoricalLessons, getHistoricalPayments,
    updateFullLessonsStorage,
    updateFullPaymentsStorage,
    updateFullStudentsStorage,
    refreshCalendarAndDashboard,
    language, t, _t 
  } = useApp();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Async Scan States
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Scanned Data Storage
  const [orphanedStudents, setOrphanedStudents] = useState<Student[]>([]);
  const [orphanedSessions, setOrphanedSessions] = useState<Lesson[]>([]);
  const [orphanedCalendarSessions, setOrphanedCalendarSessions] = useState<Lesson[]>([]);
  const [orphanedPayments, setOrphanedPayments] = useState<PaymentRecord[]>([]);
  const [orphanedAttendanceLessons, setOrphanedAttendanceLessons] = useState<Lesson[]>([]);
  const [orphanedHomeworkLessons, setOrphanedHomeworkLessons] = useState<Lesson[]>([]);
  const [orphanedExamLessons, setOrphanedExamLessons] = useState<Lesson[]>([]);

  // Health Stats
  const [healthyRecordsCount, setHealthyRecordsCount] = useState(0);
  const [storageUsedMb, setStorageUsedMb] = useState(0);

  // Interactive Modals
  const [viewCategory, setViewCategory] = useState<OrphanCategoryType | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<OrphanCategoryType | 'all' | null>(null);
  const [singleDeleteItemId, setSingleDeleteItemId] = useState<string | null>(null);
  const [cleanupResults, setCleanupResults] = useState<CleanupBreakdown | null>(null);

  const isRtl = language === 'ar';

  // Set of active valid group IDs (excluding soft-deleted groups)
  const validGroupIds = useMemo(() => {
    return new Set(groups.filter(g => !g.deleted).map(g => g.id));
  }, [groups]);

  // Main Asynchronous Scanner Function
  const scanDatabaseAsync = useCallback(async () => {
    setIsScanning(true);
    // Non-blocking asynchronous yield
    await new Promise(r => setTimeout(r, 80));

    try {
      const [rawHistoricalLessons, rawHistoricalPayments] = await Promise.all([
        getHistoricalLessons(),
        getHistoricalPayments()
      ]);

      const activeGroups = groups.filter(g => !g.deleted);
      const activeStudents = students.filter(s => !s.deleted);
      const allHistoricalLessons = rawHistoricalLessons.filter(l => !l.deleted);
      const allHistoricalPayments = rawHistoricalPayments.filter(p => !p.deleted);

      const currentGroupIds = new Set(activeGroups.map(g => g.id));

      // Helper: check if a group reference is missing, invalid, or points to deleted group
      const isOrphanedGroupRef = (groupId: string | undefined): boolean => {
        if (!groupId || groupId.trim() === '') return true;
        if (groupId === 'quick_group') return false; // Quick lesson exception if applicable
        return !currentGroupIds.has(groupId);
      };

      // 1. Students Without Group
      const stOrphans = activeStudents.filter(st => isOrphanedGroupRef(st.groupId));

      // 2 & 3. Sessions vs Calendar Sessions Without Group
      const sessionOrphans: Lesson[] = [];
      const calendarOrphans: Lesson[] = [];
      const attendanceOrphans: Lesson[] = [];
      const homeworkOrphans: Lesson[] = [];
      const examOrphans: Lesson[] = [];

      allHistoricalLessons.forEach(l => {
        const isOrphanGroup = isOrphanedGroupRef(l.groupId);

        if (isOrphanGroup) {
          if (l.status === 'scheduled') {
            calendarOrphans.push(l);
          } else {
            sessionOrphans.push(l);
          }

          // Check for attendance records in orphaned lesson
          if (l.report?.attendanceStatus || (l.report?.studentAttendance && Object.keys(l.report.studentAttendance).length > 0)) {
            attendanceOrphans.push(l);
          }

          // Check for homework records in orphaned lesson
          if (l.report?.homeworkStatus || l.report?.homeworkTitle || (l.report?.studentHomeworkDone && Object.keys(l.report.studentHomeworkDone).length > 0)) {
            homeworkOrphans.push(l);
          }

          // Check for exam/quiz records in orphaned lesson
          if (
            l.report?.quizScore !== undefined || 
            l.report?.examScore !== undefined || 
            l.report?.dictationScore || 
            l.report?.arabicExamScore ||
            (l.report?.studentDictationGrade && Object.keys(l.report.studentDictationGrade).length > 0) ||
            (l.report?.studentExamGrade && Object.keys(l.report.studentExamGrade).length > 0)
          ) {
            examOrphans.push(l);
          }
        }
      });

      // 4. Payments Without Group
      const paymentOrphans = allHistoricalPayments.filter(p => isOrphanedGroupRef(p.groupId));

      // Update state arrays
      setOrphanedStudents(stOrphans);
      setOrphanedSessions(sessionOrphans);
      setOrphanedCalendarSessions(calendarOrphans);
      setOrphanedPayments(paymentOrphans);
      setOrphanedAttendanceLessons(attendanceOrphans);
      setOrphanedHomeworkLessons(homeworkOrphans);
      setOrphanedExamLessons(examOrphans);

      // Compute healthy count
      const healthySts = activeStudents.length - stOrphans.length;
      const healthySess = allHistoricalLessons.length - (sessionOrphans.length + calendarOrphans.length);
      const healthyPay = allHistoricalPayments.length - paymentOrphans.length;
      const totalHealthy = Math.max(0, healthySts + healthySess + healthyPay + activeGroups.length);
      setHealthyRecordsCount(totalHealthy);

      // Estimate storage used in MB
      try {
        const snapshotStr = JSON.stringify({
          students: activeStudents,
          groups: activeGroups,
          lessons: allHistoricalLessons,
          payments: allHistoricalPayments
        });
        const bytes = new Blob([snapshotStr]).size;
        const mb = bytes / (1024 * 1024);
        setStorageUsedMb(Math.max(0.01, parseFloat(mb.toFixed(2))));
      } catch {
        setStorageUsedMb(0.12);
      }

      setLastScanTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('Error during database health scan:', err);
    } finally {
      setIsScanning(false);
    }
  }, [students, groups, getHistoricalLessons, getHistoricalPayments]);

  // Initial scan on mount
  useEffect(() => {
    scanDatabaseAsync();
  }, [scanDatabaseAsync]);

  // Calculated totals
  const totalOrphanedRecords = useMemo(() => {
    return (
      orphanedStudents.length +
      orphanedSessions.length +
      orphanedCalendarSessions.length +
      orphanedPayments.length +
      orphanedAttendanceLessons.length +
      orphanedHomeworkLessons.length +
      orphanedExamLessons.length
    );
  }, [
    orphanedStudents.length,
    orphanedSessions.length,
    orphanedCalendarSessions.length,
    orphanedPayments.length,
    orphanedAttendanceLessons.length,
    orphanedHomeworkLessons.length,
    orphanedExamLessons.length,
  ]);

  const totalRecords = healthyRecordsCount + totalOrphanedRecords;

  const healthScore = useMemo(() => {
    if (totalRecords === 0) return 100;
    return Math.min(100, Math.max(0, Math.round((healthyRecordsCount / totalRecords) * 100)));
  }, [healthyRecordsCount, totalRecords]);

  const healthStatusInfo = useMemo(() => {
    if (healthScore >= 90) {
      return {
        badge: _t('🟢 ممتاز', '🟢 Excellent', '🟢 Ausgezeichnet'),
        bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        scoreColor: 'text-emerald-600 dark:text-emerald-400',
        level: 'excellent'
      };
    } else if (healthScore >= 60) {
      return {
        badge: _t('🟡 يحتاج تنظيف', '🟡 Needs Cleanup', '🟡 Wartung erforderlich'),
        bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        scoreColor: 'text-amber-600 dark:text-amber-400',
        level: 'needs_cleanup'
      };
    } else {
      return {
        badge: _t('🔴 حرج', '🔴 Critical', '🔴 Kritisch'),
        bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
        scoreColor: 'text-rose-600 dark:text-rose-400',
        level: 'critical'
      };
    }
  }, [healthScore, language, t, _t]);

  // Existing profile consistency checks (missing parent phone, missing group details)
  const healthData = useMemo(() => {
    const studentsWithoutParentPhone: Student[] = [];
    const studentsWithoutEnglishName: Student[] = [];
    const groupsWithoutSchedule: Group[] = [];
    const groupsWithoutPrice: Group[] = [];
    const groupsWithoutZoomLink: Group[] = [];
    const groupsWithoutAddress: Group[] = [];

    students.forEach(st => {
      if (!st.parentPhone || st.parentPhone.trim() === '') {
        studentsWithoutParentPhone.push(st);
      }
      if (!st.certificateName || st.certificateName.trim() === '') {
        studentsWithoutEnglishName.push(st);
      }
    });

    groups.forEach(g => {
      const hasSchedule = (g.scheduleDays && g.scheduleDays.length > 0) || (g.schedules && g.schedules.length > 0);
      if (!hasSchedule) {
        groupsWithoutSchedule.push(g);
      }
      if (!g.pricePerSession && !g.monthlyPackagePrice) {
        groupsWithoutPrice.push(g);
      }
      if (g.type === 'online' && (!g.zoomLink || g.zoomLink.trim() === '')) {
        groupsWithoutZoomLink.push(g);
      }
      if (g.type === 'offline' && (!g.address || g.address.trim() === '')) {
        groupsWithoutAddress.push(g);
      }
    });

    const completeStudentsCount = Math.max(0, students.length - studentsWithoutParentPhone.length - studentsWithoutEnglishName.length);

    return {
      completeStudentsCount,
      studentsWithoutParentPhone,
      studentsWithoutEnglishName,
      groupsWithoutSchedule,
      groupsWithoutPrice,
      groupsWithoutZoomLink,
      groupsWithoutAddress
    };
  }, [students, groups]);

  // Perform actual safe cleanup
  const executeCleanup = async (target: OrphanCategoryType | 'all', singleItemId?: string) => {
    let deletedStCount = 0;
    let deletedSessCount = 0;
    let deletedCalCount = 0;
    let deletedPayCount = 0;
    let deletedAttCount = 0;
    let deletedHwCount = 0;
    let deletedExamsCount = 0;

    const initialStorageMb = storageUsedMb;
    const currentGroupIds = new Set(groups.filter(g => !g.deleted).map(g => g.id));
    const isOrphan = (groupId: string | undefined) => !groupId || (groupId !== 'quick_group' && !currentGroupIds.has(groupId));

    // Target 1: Students
    if (target === 'students' || target === 'all') {
      if (singleItemId) {
        deletedStCount = 1;
        await updateFullStudentsStorage(all => all.filter(s => s.id !== singleItemId));
      } else {
        const toRemove = students.filter(s => isOrphan(s.groupId));
        deletedStCount = toRemove.length;
        await updateFullStudentsStorage(all => all.filter(s => !isOrphan(s.groupId)));
      }
    }

    // Target 2: Sessions (non-scheduled lessons without group)
    if (target === 'sessions' || target === 'all') {
      if (singleItemId) {
        deletedSessCount = 1;
        await updateFullLessonsStorage(all => all.filter(l => l.id !== singleItemId));
      } else {
        await updateFullLessonsStorage(all => {
          const remaining = all.filter(l => !(l.status !== 'scheduled' && isOrphan(l.groupId)));
          deletedSessCount = Math.max(0, all.length - remaining.length);
          return remaining;
        });
      }
    }

    // Target 3: Calendar Sessions (scheduled lessons without group)
    if (target === 'calendarSessions' || target === 'all') {
      if (singleItemId) {
        deletedCalCount = 1;
        await updateFullLessonsStorage(all => all.filter(l => l.id !== singleItemId));
      } else {
        await updateFullLessonsStorage(all => {
          const remaining = all.filter(l => !(l.status === 'scheduled' && isOrphan(l.groupId)));
          deletedCalCount = Math.max(0, all.length - remaining.length);
          return remaining;
        });
      }
    }

    // Target 4: Payments
    if (target === 'payments' || target === 'all') {
      if (singleItemId) {
        deletedPayCount = 1;
        await updateFullPaymentsStorage(all => all.filter(p => p.id !== singleItemId));
      } else {
        await updateFullPaymentsStorage(all => {
          const remaining = all.filter(p => !isOrphan(p.groupId));
          deletedPayCount = Math.max(0, all.length - remaining.length);
          return remaining;
        });
      }
    }

    // Target 5: Attendance Records Without Group
    if (target === 'attendance' || target === 'all') {
      let attCount = 0;
      await updateFullLessonsStorage(all => all.map(l => {
        if (isOrphan(l.groupId) && l.report) {
          if (l.report.attendanceStatus || l.report.studentAttendance) {
            attCount++;
            const updatedReport = { ...l.report };
            delete updatedReport.attendanceStatus;
            delete updatedReport.studentAttendance;
            return { ...l, report: updatedReport };
          }
        }
        return l;
      }));
      deletedAttCount = attCount;
    }

    // Target 6: Homework Records Without Group
    if (target === 'homework' || target === 'all') {
      let hwCount = 0;
      await updateFullLessonsStorage(all => all.map(l => {
        if (isOrphan(l.groupId) && l.report) {
          if (l.report.homeworkStatus || l.report.homeworkTitle || l.report.studentHomeworkDone) {
            hwCount++;
            const updatedReport = { ...l.report };
            delete updatedReport.homeworkStatus;
            delete updatedReport.homeworkTitle;
            delete updatedReport.homeworkDescription;
            delete updatedReport.studentHomeworkDone;
            delete updatedReport.arabicHomeworkOption;
            delete updatedReport.arabicHomeworkRequired;
            return { ...l, report: updatedReport };
          }
        }
        return l;
      }));
      deletedHwCount = hwCount;
    }

    // Target 7: Exam Records Without Group
    if (target === 'exams' || target === 'all') {
      let examCount = 0;
      await updateFullLessonsStorage(all => all.map(l => {
        if (isOrphan(l.groupId) && l.report) {
          if (
            l.report.quizScore !== undefined || 
            l.report.examScore !== undefined || 
            l.report.dictationScore || 
            l.report.arabicExamScore ||
            l.report.studentDictationGrade ||
            l.report.studentExamGrade
          ) {
            examCount++;
            const updatedReport = { ...l.report };
            delete updatedReport.quizScore;
            delete updatedReport.examScore;
            delete updatedReport.dictationScore;
            delete updatedReport.arabicExamScore;
            delete updatedReport.studentDictationGrade;
            delete updatedReport.studentExamGrade;
            return { ...l, report: updatedReport };
          }
        }
        return l;
      }));
      deletedExamsCount = examCount;
    }

    // Auto Refresh App Context (Dashboard, Calendar, Groups, Students, Payments, Session History)
    refreshCalendarAndDashboard();

    // Estimate recovered storage MB
    let endingStorageMb = initialStorageMb;
    try {
      const activeGroups = groups.filter(g => !g.deleted);
      const activeStudents = students.filter(s => !s.deleted);
      const cleanLessons = (await getHistoricalLessons()).filter(l => !l.deleted);
      const cleanPayments = (await getHistoricalPayments()).filter(p => !p.deleted);
      const snapshotStr = JSON.stringify({
        students: activeStudents,
        groups: activeGroups,
        lessons: cleanLessons,
        payments: cleanPayments
      });
      const bytes = new Blob([snapshotStr]).size;
      endingStorageMb = bytes / (1024 * 1024);
    } catch {
      endingStorageMb = Math.max(0, initialStorageMb - 0.05);
    }

    const recoveredMb = Math.max(0.01, parseFloat((initialStorageMb - endingStorageMb).toFixed(2)));

    // Re-run scan to update Data Health Center view
    await scanDatabaseAsync();

    // Close confirmation and open Cleanup Results modal
    setConfirmDeleteTarget(null);
    setSingleDeleteItemId(null);
    setViewCategory(null);

    setCleanupResults({
      students: deletedStCount,
      sessions: deletedSessCount,
      calendarEvents: deletedCalCount,
      payments: deletedPayCount,
      attendance: deletedAttCount,
      homework: deletedHwCount,
      exams: deletedExamsCount,
      storageRecoveredMb: recoveredMb
    });
  };

  // Helper labels for category titles
  const getCategoryTitle = (cat: OrphanCategoryType): string => {
    switch (cat) {
      case 'students':
        return _t('طلاب بدون مجموعة', 'Students Without Group', 'Schüler ohne Gruppe');
      case 'sessions':
        return _t('حصص بدون مجموعة', 'Sessions Without Group', 'Sitzungen ohne Gruppe');
      case 'calendarSessions':
        return _t('أحداث تقويم بدون مجموعة', 'Calendar Sessions Without Group', 'Kalenderevents ohne Gruppe');
      case 'payments':
        return _t('مدفوعات بدون مجموعة', 'Payments Without Group', 'Zahlungen ohne Gruppe');
      case 'attendance':
        return _t('سجلات حضور بدون مجموعة', 'Attendance Records Without Group', 'Anwesenheit ohne Gruppe');
      case 'homework':
        return _t('سجلات واجبات بدون مجموعة', 'Homework Records Without Group', 'Hausaufgaben ohne Gruppe');
      case 'exams':
        return _t('سجلات اختبارات بدون مجموعة', 'Exam Records Without Group', 'Prüfungen ohne Gruppe');
    }
  };

  const getCategoryCount = (cat: OrphanCategoryType): number => {
    switch (cat) {
      case 'students': return orphanedStudents.length;
      case 'sessions': return orphanedSessions.length;
      case 'calendarSessions': return orphanedCalendarSessions.length;
      case 'payments': return orphanedPayments.length;
      case 'attendance': return orphanedAttendanceLessons.length;
      case 'homework': return orphanedHomeworkLessons.length;
      case 'exams': return orphanedExamLessons.length;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-[100] flex justify-end animate-fade-in">
      <div className={`w-full max-w-xl h-full bg-surface shadow-2xl flex flex-col ${isRtl ? 'text-right' : 'text-left'} animate-slide-in-right border-l border-surface-border`}>
        {/* Top Bar Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-hover/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-base text-text-main flex items-center gap-2">
                {_t('مركز صحة البيانات والتنظيف', 'Data Health Center', 'Daten-Gesundheitszentrum')}
              </h2>
              {lastScanTime && (
                <p className="text-[11px] text-text-muted font-medium">
                  {_t(`آخر فحص: ${lastScanTime}`, `Last scan: ${lastScanTime}`, `Letzter Scan: ${lastScanTime}`)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action: Scan Database */}
            <button
              onClick={scanDatabaseAsync}
              disabled={isScanning}
              className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-primary/20 cursor-pointer disabled:opacity-50"
              title={_t('فحص قاعدة البيانات واختبار اتساق السجلات', 'Scan Database', 'Datenbank scannen')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{_t('فحص قاعدة البيانات', 'Scan Database', 'Scan durchführen')}</span>
            </button>

            <button 
              onClick={onClose} 
              className="p-2 bg-surface-hover rounded-xl text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-sm">
          
          {/* SECTION 8: Data Health Summary Card */}
          <div className="bg-surface-hover/30 border border-surface-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-text-muted">
                  {_t('ملخص صحة البيانات', 'Data Health Summary', 'Zusammenfassung der Datengesundheit')}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-3xl font-black ${healthStatusInfo.scoreColor}`}>
                    {healthScore}%
                  </span>
                  <span className="text-xs text-text-muted font-bold">
                    {_t('مؤشر السلامة', 'Database Health Score', 'Gesundheitswert')}
                  </span>
                </div>
              </div>

              {/* Status Indicator Badge */}
              <div className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 ${healthStatusInfo.bg}`}>
                <span>{healthStatusInfo.badge}</span>
              </div>
            </div>

            {/* Health Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-surface-border/60 text-center">
              <div className="p-2.5 bg-surface rounded-xl border border-surface-border">
                <span className="block text-xs text-text-muted font-semibold">{_t('سجلات سليمة', 'Healthy Records', 'Gesunde Datensätze')}</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{healthyRecordsCount}</span>
              </div>
              <div className="p-2.5 bg-surface rounded-xl border border-surface-border">
                <span className="block text-xs text-text-muted font-semibold">{_t('سجلات معزولة', 'Orphaned Records', 'Isolierte Datensätze')}</span>
                <span className={`text-base font-black mt-0.5 block ${totalOrphanedRecords > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-text-main'}`}>
                  {totalOrphanedRecords}
                </span>
              </div>
              <div className="p-2.5 bg-surface rounded-xl border border-surface-border">
                <span className="block text-xs text-text-muted font-semibold">{_t('المساحة', 'Storage Used', 'Speicherplatz')}</span>
                <span className="text-base font-black text-text-main mt-0.5 block">{storageUsedMb} MB</span>
              </div>
            </div>

            {/* Clean All Button */}
            {totalOrphanedRecords > 0 && (
              <button
                onClick={() => setConfirmDeleteTarget('all')}
                className="w-full mt-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{_t('تنظيف كافة البيانات المعزولة الآن', 'Clean All Orphan Data', 'Alle isolierten Daten bereinigen')} ({totalOrphanedRecords})</span>
              </button>
            )}
          </div>

          {/* MAIN SECTION: Data Integrity & Cleanup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <h3 className="font-extrabold text-sm text-text-main uppercase tracking-wider">
                  {_t('سلامة البيانات والتنظيف', 'Data Integrity & Cleanup', 'Integrität & Datenbereinigung')}
                </h3>
              </div>
              <span className="text-xs text-text-muted font-medium">
                {_t('الكشف عن البيانات غير المرتبطة بمجموعات', 'Detect unlinked orphaned data', 'Verwaiste Daten erkennen')}
              </span>
            </div>

            {/* The 7 Orphan Detection Cards */}
            <div className="space-y-2.5">

              {/* 1. Students Without Group */}
              <OrphanCategoryCard
                title={_t('1. طلاب بدون مجموعة', '1. Students Without Group', '1. Schüler ohne Gruppe')}
                definition={_t('سجلات الطلاب التي تفتقد groupId أو تشير إلى مجموعة محذوفة.', 'Student records whose groupId is missing, invalid, or points to a deleted group.', 'Schüler ohne gültige Gruppenzuweisung.')}
                count={orphanedStudents.length}
                icon={<UserX className="w-4 h-4 text-rose-500" />}
                onView={() => setViewCategory('students')}
                onDeleteAll={() => setConfirmDeleteTarget('students')}
                isRtl={isRtl}
                _t={_t}
              />

              {/* 2. Sessions Without Group */}
              <OrphanCategoryCard
                title={_t('2. حصص بدون مجموعة', '2. Sessions Without Group', '2. Sitzungen ohne Gruppe')}
                definition={_t('سجلات الحصص المنفذة والتاريخية غير المرتبطة بمجموعة صحيحة.', 'Lesson sessions whose groupId is missing, invalid, or linked to a deleted group.', 'Unterrichtssitzungen ohne zugewiesene Gruppe.')}
                count={orphanedSessions.length}
                icon={<Activity className="w-4 h-4 text-amber-500" />}
                onView={() => setViewCategory('sessions')}
                onDeleteAll={() => setConfirmDeleteTarget('sessions')}
                isRtl={isRtl}
                _t={_t}
              />

              {/* 3. Calendar Sessions Without Group */}
              <OrphanCategoryCard
                title={_t('3. أحداث تقويم بدون مجموعة', '3. Calendar Sessions Without Group', '3. Kalenderevents ohne Gruppe')}
                definition={_t('أحداث المواعيد المجدولة في التقويم غير المرتبطة بمجموعة مفعّلة.', 'Calendar events whose groupId is missing, invalid, or linked to a deleted group.', 'Geplante Kalendertermine ohne gültige Gruppe.')}
                count={orphanedCalendarSessions.length}
                icon={<Calendar className="w-4 h-4 text-sky-500" />}
                onView={() => setViewCategory('calendarSessions')}
                onDeleteAll={() => setConfirmDeleteTarget('calendarSessions')}
                isRtl={isRtl}
                _t={_t}
              />

              {/* 4. Payments Without Group */}
              <OrphanCategoryCard
                title={_t('4. مدفوعات بدون مجموعة', '4. Payments Without Group', '4. Zahlungen ohne Gruppe')}
                definition={_t('سجلات المعاملات والرسوم المالية المرتبطة بمجموعات محذوفة.', 'Payment records linked to missing or deleted groups.', 'Zahlungsdatensätze ohne verknüpfte Gruppe.')}
                count={orphanedPayments.length}
                icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
                onView={() => setViewCategory('payments')}
                onDeleteAll={() => setConfirmDeleteTarget('payments')}
                isRtl={isRtl}
                _t={_t}
              />

              {/* 5. Attendance Records Without Group */}
              <OrphanCategoryCard
                title={_t('5. سجلات حضور بدون مجموعة', '5. Attendance Records Without Group', '5. Anwesenheit ohne Gruppe')}
                definition={_t('سجلات كشوف الحضور والغياب لل حصص غير المرتبطة بمجموعة.', 'Attendance records linked to missing or deleted groups.', 'Anwesenheitseinträge ohne zugewiesene Gruppe.')}
                count={orphanedAttendanceLessons.length}
                icon={<CheckSquare className="w-4 h-4 text-indigo-500" />}
                onView={() => setViewCategory('attendance')}
                onDeleteAll={() => setConfirmDeleteTarget('attendance')}
                isRtl={isRtl}
                _t={_t}
              />

              {/* 6. Homework Records Without Group */}
              <OrphanCategoryCard
                title={_t('6. سجلات واجبات بدون مجموعة', '6. Homework Records Without Group', '6. Hausaufgaben ohne Gruppe')}
                definition={_t('بيانات متابعة الواجبات المنزلية المرتبطة بمجموعات ملغاة.', 'Homework records linked to missing or deleted groups.', 'Hausaufgabeneinträge ohne verknüpfte Gruppe.')}
                count={orphanedHomeworkLessons.length}
                icon={<BookOpen className="w-4 h-4 text-purple-500" />}
                onView={() => setViewCategory('homework')}
                onDeleteAll={() => setConfirmDeleteTarget('homework')}
                isRtl={isRtl}
                _t={_t}
              />

              {/* 7. Exam/Quiz Records Without Group */}
              <OrphanCategoryCard
                title={_t('7. سجلات اختبارات بدون مجموعة', '7. Exam/Quiz Records Without Group', '7. Prüfungen ohne Gruppe')}
                definition={_t('درجات الامتحانات والاختبارات القصيرة المرتبطة بمجموعات غير موجودة.', 'Exam results linked to missing or deleted groups.', 'Prüfungsergebnisse ohne zugewiesene Gruppe.')}
                count={orphanedExamLessons.length}
                icon={<Award className="w-4 h-4 text-orange-500" />}
                onView={() => setViewCategory('exams')}
                onDeleteAll={() => setConfirmDeleteTarget('exams')}
                isRtl={isRtl}
                _t={_t}
              />
            </div>
          </div>

          {/* SECTION: Student & Group Profile Consistency Checks */}
          <div className="pt-4 border-t border-surface-border space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-text-muted" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-text-muted">
                {_t('اكتمل الملف والتفاصيل', 'Profile Field Integrity', 'Profilvollständigkeit')}
              </h3>
            </div>

            {/* Complete Students Counter */}
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{healthData.completeStudentsCount} {_t('طالب مكتمل البيانات', 'Students with complete data', 'Schüler mit vollständigen Daten')}</span>
            </div>

            {/* Missing Parent Phone (Students) */}
            {healthData.studentsWithoutParentPhone.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{healthData.studentsWithoutParentPhone.length} {_t('طلاب بدون رقم ولي أمر', 'Students missing parent phone')}</span>
                </div>
                <div className="space-y-1 pl-6 rtl:pl-0 rtl:pr-6">
                  {healthData.studentsWithoutParentPhone.map(st => (
                    <div key={st.id} className="flex items-center justify-between p-2 bg-surface-hover/50 rounded-lg text-xs">
                      <span className="font-medium text-text-main">{st.name}</span>
                      <button 
                        onClick={() => setSelectedStudent(st)}
                        className="px-3 py-1 bg-amber-500 text-white rounded-md font-bold hover:bg-amber-600 transition-colors cursor-pointer"
                      >
                        {_t('إصلاح', 'Fix Now')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing English/Latin Certificate Name (Students) */}
            {healthData.studentsWithoutEnglishName.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{healthData.studentsWithoutEnglishName.length} {_t('طلاب بدون اسم إنجليزي للشهادات', 'Students missing English name for certificates', 'Schülern fehlt der englische Name für Zertifikate')}</span>
                </div>
                <div className="space-y-1 pl-6 rtl:pl-0 rtl:pr-6">
                  {healthData.studentsWithoutEnglishName.map(st => (
                    <div key={st.id} className="flex items-center justify-between p-2 bg-surface-hover/50 rounded-lg text-xs">
                      <span className="font-medium text-text-main">{st.name}</span>
                      <button 
                        onClick={() => setSelectedStudent(st)}
                        className="px-3 py-1 bg-amber-500 text-white rounded-md font-bold hover:bg-amber-600 transition-colors cursor-pointer"
                      >
                        {_t('إصلاح', 'Fix Now')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Schedule (Groups) */}
            {healthData.groupsWithoutSchedule.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{healthData.groupsWithoutSchedule.length} {_t('جروب بدون جدول زمني', 'Groups missing schedule')}</span>
                </div>
                <div className="space-y-1 pl-6 rtl:pl-0 rtl:pr-6">
                  {healthData.groupsWithoutSchedule.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-2 bg-surface-hover/50 rounded-lg text-xs">
                      <span className="font-medium text-text-main">{g.name}</span>
                      <button 
                        onClick={() => setSelectedGroup(g)}
                        className="px-3 py-1 bg-rose-500 text-white rounded-md font-bold hover:bg-rose-600 transition-colors cursor-pointer"
                      >
                        {_t('إصلاح', 'Fix Now')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Price (Groups) */}
            {healthData.groupsWithoutPrice.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{healthData.groupsWithoutPrice.length} {_t('جروب بدون سعر حصة', 'Groups missing session price')}</span>
                </div>
                <div className="space-y-1 pl-6 rtl:pl-0 rtl:pr-6">
                  {healthData.groupsWithoutPrice.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-2 bg-surface-hover/50 rounded-lg text-xs">
                      <span className="font-medium text-text-main">{g.name}</span>
                      <button 
                        onClick={() => setSelectedGroup(g)}
                        className="px-3 py-1 bg-rose-500 text-white rounded-md font-bold hover:bg-rose-600 transition-colors cursor-pointer"
                      >
                        {_t('إصلاح', 'Fix Now')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Online Groups Missing Zoom Link */}
            {healthData.groupsWithoutZoomLink.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                  <Video className="w-4 h-4" />
                  <span>{healthData.groupsWithoutZoomLink.length} {_t('جروب أونلاين بدون رابط زووم', 'Online groups missing Zoom link')}</span>
                </div>
                <div className="space-y-1 pl-6 rtl:pl-0 rtl:pr-6">
                  {healthData.groupsWithoutZoomLink.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-2 bg-surface-hover/50 rounded-lg text-xs">
                      <span className="font-medium text-text-main">{g.name}</span>
                      <button 
                        onClick={() => setSelectedGroup(g)}
                        className="px-3 py-1 bg-sky-500 text-white rounded-md font-bold hover:bg-sky-600 transition-colors cursor-pointer"
                      >
                        {_t('إصلاح', 'Fix Now')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Groups Missing Location Address */}
            {healthData.groupsWithoutAddress.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <MapPin className="w-4 h-4" />
                  <span>{healthData.groupsWithoutAddress.length} {_t('جروب أوفلاين بدون عنوان المكان', 'Offline groups missing location address')}</span>
                </div>
                <div className="space-y-1 pl-6 rtl:pl-0 rtl:pr-6">
                  {healthData.groupsWithoutAddress.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-2 bg-surface-hover/50 rounded-lg text-xs">
                      <span className="font-medium text-text-main">{g.name}</span>
                      <button 
                        onClick={() => setSelectedGroup(g)}
                        className="px-3 py-1 bg-amber-500 text-white rounded-md font-bold hover:bg-amber-600 transition-colors cursor-pointer"
                      >
                        {_t('إصلاح', 'Fix Now')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ----------------- MODAL 1: VIEW CATEGORY DETAIL MODAL ----------------- */}
      {viewCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-hover/30">
              <div>
                <h3 className="font-black text-sm text-text-main">
                  {getCategoryTitle(viewCategory)}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {_t(`إجمالي السجلات المعزولة: ${getCategoryCount(viewCategory)}`, `Total orphaned records: ${getCategoryCount(viewCategory)}`, `Verwaiste Einträge: ${getCategoryCount(viewCategory)}`)}
                </p>
              </div>
              <button 
                onClick={() => setViewCategory(null)}
                className="p-1.5 bg-surface-hover rounded-xl text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
              {getCategoryCount(viewCategory) === 0 ? (
                <div className="py-10 text-center text-text-muted space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 opacity-80" />
                  <p className="font-bold">{_t('لا توجد سجلات معزولة في هذه الفئة!', 'No orphaned records in this category!', 'Keine verwaisten Einträge in dieser Kategorie!')}</p>
                </div>
              ) : (
                <>
                  {viewCategory === 'students' && orphanedStudents.map(st => (
                    <DetailRecordRow 
                      key={st.id} 
                      title={st.name} 
                      subtitle={`Parent: ${st.parentName || 'N/A'} • Phone: ${st.parentPhone || 'N/A'}`}
                      tag={`Grade: ${st.grade}`}
                      onDeleteSingle={() => {
                        setSingleDeleteItemId(st.id);
                        setConfirmDeleteTarget('students');
                      }}
                      _t={_t}
                    />
                  ))}

                  {viewCategory === 'sessions' && orphanedSessions.map(l => (
                    <DetailRecordRow 
                      key={l.id} 
                      title={l.title || l.groupName || 'Lesson Session'} 
                      subtitle={`Date: ${l.date} • Time: ${l.time} • Status: ${l.status}`}
                      tag={`Amount Paid: ${l.amountPaid || 0}`}
                      onDeleteSingle={() => {
                        setSingleDeleteItemId(l.id);
                        setConfirmDeleteTarget('sessions');
                      }}
                      _t={_t}
                    />
                  ))}

                  {viewCategory === 'calendarSessions' && orphanedCalendarSessions.map(l => (
                    <DetailRecordRow 
                      key={l.id} 
                      title={l.title || 'Scheduled Calendar Event'} 
                      subtitle={`Date: ${l.date} • Time: ${l.time}`}
                      tag={l.type || 'Lesson'}
                      onDeleteSingle={() => {
                        setSingleDeleteItemId(l.id);
                        setConfirmDeleteTarget('calendarSessions');
                      }}
                      _t={_t}
                    />
                  ))}

                  {viewCategory === 'payments' && orphanedPayments.map(p => (
                    <DetailRecordRow 
                      key={p.id} 
                      title={`Payment: ${p.studentName || 'Student'}`} 
                      subtitle={`Due: ${p.amountDue} • Paid: ${p.amountPaid} • Date: ${p.dueDate}`}
                      tag={p.status}
                      onDeleteSingle={() => {
                        setSingleDeleteItemId(p.id);
                        setConfirmDeleteTarget('payments');
                      }}
                      _t={_t}
                    />
                  ))}

                  {viewCategory === 'attendance' && orphanedAttendanceLessons.map(l => (
                    <DetailRecordRow 
                      key={l.id} 
                      title={`Attendance: ${l.title || l.groupName || 'Lesson'}`} 
                      subtitle={`Date: ${l.date} • Status: ${l.report?.attendanceStatus || 'Recorded'}`}
                      tag="Attendance Log"
                      onDeleteSingle={() => {
                        setSingleDeleteItemId(l.id);
                        setConfirmDeleteTarget('attendance');
                      }}
                      _t={_t}
                    />
                  ))}

                  {viewCategory === 'homework' && orphanedHomeworkLessons.map(l => (
                    <DetailRecordRow 
                      key={l.id} 
                      title={`Homework: ${l.report?.homeworkTitle || l.title || 'Lesson Homework'}`} 
                      subtitle={`Date: ${l.date} • Status: ${l.report?.homeworkStatus || 'Assigned'}`}
                      tag="Homework Log"
                      onDeleteSingle={() => {
                        setSingleDeleteItemId(l.id);
                        setConfirmDeleteTarget('homework');
                      }}
                      _t={_t}
                    />
                  ))}

                  {viewCategory === 'exams' && orphanedExamLessons.map(l => (
                    <DetailRecordRow 
                      key={l.id} 
                      title={`Exam/Quiz: ${l.title || 'Lesson Quiz'}`} 
                      subtitle={`Date: ${l.date} • Quiz Score: ${l.report?.quizScore ?? l.report?.examScore ?? 'N/A'}`}
                      tag="Exam Log"
                      onDeleteSingle={() => {
                        setSingleDeleteItemId(l.id);
                        setConfirmDeleteTarget('exams');
                      }}
                      _t={_t}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="p-4 border-t border-surface-border bg-surface-hover/20 flex items-center justify-between gap-3">
              <button
                onClick={() => setViewCategory(null)}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-border/50 text-text-main font-bold text-xs rounded-xl cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>

              {getCategoryCount(viewCategory) > 0 && (
                <button
                  onClick={() => setConfirmDeleteTarget(viewCategory)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{_t('حذف الكل لهذا القسم', 'Delete All in Category', 'Alle in dieser Kategorie löschen')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 2: CLEANUP CONFIRMATION MODAL ----------------- */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 text-center animate-scale-up">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-text-main">
                {_t('⚠️ تنظيف البيانات المعزولة', '⚠️ Cleanup Orphan Data', '⚠️ Verwaiste Daten bereinigen')}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                {_t(
                  'السجلات المحددة غير مرتبطة بأي مجموعة حالية أو تم إلغاء مجموعتها.',
                  'The selected records are not linked to any existing group.',
                  'Die ausgewählten Datensätze sind mit keiner bestehenden Gruppe verknüpft.'
                )}
              </p>
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-extrabold text-rose-700 dark:text-rose-400">
              {_t(
                `السجلات المراد حذفها: ${singleDeleteItemId ? 1 : confirmDeleteTarget === 'all' ? totalOrphanedRecords : getCategoryCount(confirmDeleteTarget)}`,
                `Records to delete: ${singleDeleteItemId ? 1 : confirmDeleteTarget === 'all' ? totalOrphanedRecords : getCategoryCount(confirmDeleteTarget)}`,
                `Zu löschende Datensätze: ${singleDeleteItemId ? 1 : confirmDeleteTarget === 'all' ? totalOrphanedRecords : getCategoryCount(confirmDeleteTarget)}`
              )}
            </div>

            <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wide">
              {_t('هذا الإجراء نهائي ولا يمكن التراجع عنه.', 'This action cannot be undone.', 'Diese Aktion kann nicht rückgängig gemacht werden.')}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setConfirmDeleteTarget(null);
                  setSingleDeleteItemId(null);
                }}
                className="w-full py-2.5 px-4 bg-surface-hover hover:bg-surface-border text-text-main font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>

              <button
                onClick={() => executeCleanup(confirmDeleteTarget, singleDeleteItemId || undefined)}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {_t('حذف نهائياً', 'Delete Permanently', 'Endgültig löschen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 3: CLEANUP RESULTS MODAL ----------------- */}
      {cleanupResults && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-emerald-500/30 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 text-center animate-scale-up">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-text-main">
                {_t('اكتمل التنظيف بنجاح', 'Cleanup Complete', 'Bereinigung abgeschlossen')}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {_t('تم تحديث الشاشات والقواعد تلقائياً', 'Dashboard & views automatically refreshed', 'Ansichten automatisch aktualisiert')}
              </p>
            </div>

            <div className="bg-surface-hover/50 border border-surface-border rounded-xl p-3 text-xs text-left rtl:text-right space-y-1.5 font-medium">
              <div className="font-extrabold text-text-main pb-1 border-b border-surface-border/60">
                {_t('السجلات التي تم حذفها:', 'Deleted Records Breakdown:', 'Gelöschte Datensätze:')}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-text-muted">
                <div>• {_t('الطلاب', 'Students', 'Schüler')}: <span className="font-bold text-text-main">{cleanupResults.students}</span></div>
                <div>• {_t('الحصص', 'Sessions', 'Sitzungen')}: <span className="font-bold text-text-main">{cleanupResults.sessions}</span></div>
                <div>• {_t('أحداث التقويم', 'Calendar Events', 'Kalendertermine')}: <span className="font-bold text-text-main">{cleanupResults.calendarEvents}</span></div>
                <div>• {_t('المدفوعات', 'Payments', 'Zahlungen')}: <span className="font-bold text-text-main">{cleanupResults.payments}</span></div>
                <div>• {_t('الحضور', 'Attendance', 'Anwesenheit')}: <span className="font-bold text-text-main">{cleanupResults.attendance}</span></div>
                <div>• {_t('الواجبات', 'Homework', 'Hausaufgaben')}: <span className="font-bold text-text-main">{cleanupResults.homework}</span></div>
                <div>• {_t('الاختبارات', 'Exams', 'Prüfungen')}: <span className="font-bold text-text-main">{cleanupResults.exams}</span></div>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>{_t(`المساحة المستردة: ${cleanupResults.storageRecoveredMb} MB`, `Storage Recovered: ${cleanupResults.storageRecoveredMb} MB`, `Freigegebener Speicher: ${cleanupResults.storageRecoveredMb} MB`)}</span>
            </div>

            <button
              onClick={() => setCleanupResults(null)}
              className="w-full py-2.5 px-4 bg-primary text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {_t('تم العودة للتطوير', 'Done', 'Fertig')}
            </button>
          </div>
        </div>
      )}

      {/* Profile Modals for "Fix Now" Quick Actions */}
      {selectedStudent && (
        <StudentProfileModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          initialTab="edit"
        />
      )}

      {selectedGroup && (
        <GroupProfileModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
};

// Subcomponent: Individual Orphan Category Card
interface OrphanCategoryCardProps {
  title: string;
  definition: string;
  count: number;
  icon: React.ReactNode;
  onView: () => void;
  onDeleteAll: () => void;
  isRtl: boolean;
  _t: (ar: string, en: string, de?: string) => string;
}

const OrphanCategoryCard: React.FC<OrphanCategoryCardProps> = ({
  title,
  definition,
  count,
  icon,
  onView,
  onDeleteAll,
  _t
}) => {
  return (
    <div className="bg-surface border border-surface-border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-surface-border/80 transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-surface-hover rounded-xl shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="font-extrabold text-xs text-text-main">{title}</h4>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${count > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
              {count}
            </span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed max-w-sm">
            {definition}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-1 sm:pt-0">
        <button
          onClick={onView}
          disabled={count === 0}
          className="px-3 py-1.5 bg-surface-hover hover:bg-surface-border/50 disabled:opacity-40 text-text-main font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 border border-surface-border cursor-pointer disabled:cursor-not-allowed"
        >
          <Eye className="w-3.5 h-3.5 text-text-muted" />
          <span>{_t('عرض', 'View', 'Anzeigen')}</span>
        </button>

        <button
          onClick={onDeleteAll}
          disabled={count === 0}
          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 disabled:opacity-40 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 border border-rose-500/20 cursor-pointer disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{_t('حذف الكل', 'Delete All', 'Alle löschen')}</span>
        </button>
      </div>
    </div>
  );
};

// Subcomponent: Row in Category View Detail List
interface DetailRecordRowProps {
  title: string;
  subtitle: string;
  tag: string;
  onDeleteSingle: () => void;
  _t: (ar: string, en: string, de?: string) => string;
}

const DetailRecordRow: React.FC<DetailRecordRowProps> = ({
  title,
  subtitle,
  tag,
  onDeleteSingle,
  _t
}) => {
  return (
    <div className="flex items-center justify-between p-2.5 bg-surface-hover/40 border border-surface-border/60 rounded-xl hover:bg-surface-hover transition-all gap-2">
      <div className="space-y-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-main truncate text-xs">{title}</span>
          <span className="px-1.5 py-0.5 bg-surface-border/60 text-text-muted text-[10px] rounded font-medium shrink-0">{tag}</span>
        </div>
        <p className="text-[11px] text-text-muted truncate">{subtitle}</p>
      </div>

      <button
        onClick={onDeleteSingle}
        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg transition-colors shrink-0 cursor-pointer"
        title={_t('حذف هذا السجل فقط', 'Delete this record', 'Diesen Eintrag löschen')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
