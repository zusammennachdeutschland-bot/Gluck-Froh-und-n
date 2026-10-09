import { isPendingStatus } from "../utils/lessonUtils";
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson, Student } from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { 
  History, Search, Filter, Calendar, Clock, CheckCircle2, XCircle, 
  AlertTriangle, Users, User, ArrowUpRight, FileText, Settings, Play, 
  Check, DollarSign, BookOpen, ChevronRight, Award, Video
} from 'lucide-react';
import { ArabicParentReportModal } from './ArabicParentReportModal';
import { Pagination } from './common/Pagination';

export const SessionHistoryView: React.FC = () => {
  const { lessons: activeLessons, getHistoricalLessons, students, groups, profile, openLessonControl, updateLesson, saveLessonReport, t, language, _t } = useApp();

  const [lessons, setLessons] = useState<Lesson[]>(activeLessons);
  const [loadingHistory, setLoadingHistory] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    getHistoricalLessons().then(history => {
      if (isMounted && history && history.length > 0) {
        setLessons(history);
      }
      if (isMounted) setLoadingHistory(false);
    });
    return () => { isMounted = false; };
  }, [getHistoricalLessons]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled' | 'pending' | 'scheduled'>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all'); // 'all', studentId, or groupId
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');

  // Pagination states (default 15 lessons per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, entityFilter, periodFilter, pageSize]);

  // Selected lesson for Parent Report direct modal preview
  const [reportModalLesson, setReportModalLesson] = useState<Lesson | null>(null);

  // Date calculations
  const todayStr = formatLocalDate();
  
  const getWeekStart = (d: Date): string => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return formatLocalDate(monday);
  };

  const currentWeekStart = getWeekStart(new Date());
  const currentMonthPrefix = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  // Filtered and Sorted Lessons (Newest First)
  const filteredLessons = useMemo(() => {
    return lessons
      .filter((lesson) => {
        // Status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'completed' && lesson.status !== 'completed') return false;
          if (statusFilter === 'cancelled' && lesson.status !== 'cancelled') return false;
          if (statusFilter === 'pending' && (!isPendingStatus(lesson.status))) return false;
          if (statusFilter === 'scheduled' && lesson.status !== 'scheduled') return false;
        }

        // Entity (Student/Group) filter
        if (entityFilter !== 'all') {
          if (entityFilter.startsWith('group_')) {
            const gId = entityFilter.replace('group_', '');
            if (lesson.groupId !== gId) return false;
          } else if (entityFilter.startsWith('student_')) {
            const sId = entityFilter.replace('student_', '');
            if (lesson.studentId !== sId && !(lesson.title || '').toLowerCase().includes(sId.toLowerCase())) return false;
          }
        }

        // Period filter
        if (periodFilter === 'today') {
          if (lesson.date !== todayStr) return false;
        } else if (periodFilter === 'this_week') {
          const lessonWeekStart = getWeekStart(new Date(lesson.date));
          if (lessonWeekStart !== currentWeekStart) return false;
        } else if (periodFilter === 'this_month') {
          if (!lesson.date.startsWith(currentMonthPrefix)) return false;
        }

        // Search term
        if (searchTerm && searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          const matchTitle = (lesson.title || '').toLowerCase().includes(term);
          const matchStudent = (lesson.studentName || '').toLowerCase().includes(term);
          const matchGroup = (lesson.groupName || '').toLowerCase().includes(term);
          const matchNotes = (lesson.notes || '').toLowerCase().includes(term);
          const matchDate = (lesson.date || '').includes(term);
          if (!matchTitle && !matchStudent && !matchGroup && !matchNotes && !matchDate) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Compare date & time descending
        const dateA = `${a.date}T${a.time}`;
        const dateB = `${b.date}T${b.time}`;
        return dateB.localeCompare(dateA);
      });
  }, [lessons, statusFilter, entityFilter, periodFilter, searchTerm, todayStr, currentWeekStart, currentMonthPrefix]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredLessons.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedLessons = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredLessons.slice(start, start + pageSize);
  }, [filteredLessons, safePage, pageSize]);

  // Overall Statistics memoized to eliminate lag
  const { totalCount, completedCount, cancelledCount, pendingCount, totalHours } = useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let pending = 0;
    let mins = 0;
    for (const l of lessons) {
      if (l.status === 'completed') completed++;
      else if (l.status === 'cancelled') cancelled++;
      else if (isPendingStatus(l.status)) pending++;
      if (l.status !== 'cancelled') {
        mins += (l.durationMinutes || l.duration || 60);
      }
    }
    return {
      totalCount: lessons.length,
      completedCount: completed,
      cancelledCount: cancelled,
      pendingCount: pending,
      totalHours: (mins / 60).toFixed(1)
    };
  }, [lessons]);

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      map.set(s.id, s);
      if (s.name) map.set(s.name, s);
    }
    return map;
  }, [students]);

  return (
    <div className="space-y-4 font-sans">
      {/* Header Banner */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-4 shadow-2xs space-y-2.5 sm:space-y-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-soft flex items-center justify-center border border-primary-border shrink-0">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black uppercase tracking-wider text-text-main">{t('history_title')}</h1>
            <p className="text-[10px] sm:text-[11px] text-text-muted font-bold mt-0.5">{t('history_header_sub')}</p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-surface-border text-center">
          <div className="bg-surface-hover p-2 rounded-lg border border-surface-border">
            <span className="block text-[9.5px] text-text-muted font-bold uppercase truncate">{t('history_total_lessons')}</span>
            <span className="text-xs font-black text-text-main mt-0.5 block">{totalCount}</span>
          </div>
          <div className="bg-primary-soft p-2 rounded-lg border border-primary-border">
            <span className="block text-[9.5px] text-primary font-bold uppercase truncate">{t('history_completed')}</span>
            <span className="text-xs font-black text-primary mt-0.5 block">{completedCount}</span>
          </div>
          <div className="bg-primary-soft p-2 rounded-lg border border-primary-border">
            <span className="block text-[9.5px] text-primary font-bold uppercase truncate">{t('status_cancelled')}</span>
            <span className="text-xs font-black text-primary mt-0.5 block">{cancelledCount}</span>
          </div>
          <div className="bg-primary-soft p-2 rounded-lg border border-primary-border">
            <span className="block text-[9.5px] text-primary font-bold uppercase truncate">{t('history_total_hours')}</span>
            <span className="text-xs font-black text-primary mt-0.5 block">{totalHours} hrs</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-surface border border-surface-border rounded-lg p-2.5 space-y-2.5 shadow-2xs">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted/70 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('history_search_placeholder')}
            className="w-full pl-8 pr-3 py-1.5 bg-surface-hover/80 border border-surface-border dark:border-surface-border-soft rounded-md text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filter Row 1: Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-bold no-scrollbar">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2 py-1 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            {t('all')} ({lessons.length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-2 py-1 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            ✓ {t('history_completed')} ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`px-2 py-1 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'cancelled'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            🚫 {t('status_cancelled')} ({cancelledCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-2 py-1 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            ⚠️ {t('status_pending')} ({pendingCount})
          </button>
        </div>

        {/* Filter Row 2: Entity & Period Dropdowns */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[9.5px] font-bold text-text-muted/70 mb-0.5 uppercase tracking-wider">{t('history_filter_entity_label')}</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full bg-surface-hover border border-surface-border dark:border-surface-border-soft font-bold px-2 py-1 rounded-md focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">{t('history_all_entities')}</option>
              <optgroup label={t('history_groups_category')}>
                {groups.map(g => (
                  <option key={g.id} value={`group_${g.id}`}>👥 {g.name}</option>
                ))}
              </optgroup>
              <optgroup label={t('history_students_category')}>
                {students.map(s => (
                  <option key={s.id} value={`student_${s.id}`}>👤 {s.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-[9.5px] font-bold text-text-muted/70 mb-0.5 uppercase tracking-wider">{t('history_filter_period_label')}</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full bg-surface-hover border border-surface-border dark:border-surface-border-soft font-bold px-2 py-1 rounded-md focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">{t('history_period_all')}</option>
              <option value="today">{t('history_period_today')}</option>
              <option value="this_week">{t('history_period_this_week')}</option>
              <option value="this_month">{t('history_period_this_month')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Session List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold px-1 text-text-muted">
          <span>
            {t('history_results_count').replace('{count}', filteredLessons.length.toString())}
            {totalPages > 1 && (
              <span className="text-text-muted font-normal mx-1">
                • {_t('صفحة', 'Page', 'Seite')} {safePage} {_t('من', 'of', 'von')} {totalPages}
              </span>
            )}
          </span>
          {searchTerm || statusFilter !== 'all' || entityFilter !== 'all' || periodFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setEntityFilter('all');
                setPeriodFilter('all');
              }}
              className="text-primary font-black hover:underline cursor-pointer"
            >
              {t('history_reset_filters')}
            </button>
          ) : null}
        </div>

        {filteredLessons.length === 0 ? (
          <div className="bg-surface border border-surface-border rounded-lg p-4 text-center space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center mx-auto text-text-muted border border-surface-border">
              <History className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-text-main text-xs">{t('next_action_no_lessons')}</p>
            </div>
          </div>
        ) : (
          paginatedLessons.map((lesson) => {
            const isGroup = Boolean(lesson.groupId);
            const formattedDate = lesson.date ? lesson.date.split('-').reverse().join('/') : '';
            
            // Attendance Status formatting
            const isCancelled = lesson.status === 'cancelled';
            const reportAtt = isCancelled 
              ? 'cancelled' 
              : (lesson.report?.attendanceStatus || (lesson.status === 'completed' ? 'present' : 'present'));

            const attBadgeClass = isCancelled
              ? 'bg-surface-hover text-text-muted border-surface-border'
              : reportAtt === 'present' ? 'bg-primary-soft text-primary border-primary-border'
              : reportAtt === 'late' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              : 'bg-primary-soft text-primary border-primary-border';

            const attText = isCancelled
              ? `${t('status_cancelled')} ⚪`
              : reportAtt === 'present' ? `${t('att_present')} ✓` 
              : reportAtt === 'late' ? `${t('att_late')} ⚠️` 
              : `${t('att_absent')} ✕`;

            // Payment badge
            const isPaid = lesson.paymentStatus === 'paid';
            const payBadgeClass = isCancelled
              ? 'bg-surface-hover text-text-muted border-surface-border'
              : isPaid
                ? 'bg-primary-soft text-primary border border-primary-border'
                : 'bg-primary-soft text-primary border border-primary-border';

            const payText = isCancelled
              ? (language === 'ar' ? 'ملغاة (غير محتسبة)' : 'Not billed')
              : isPaid 
                ? `${t('payments_paid')} ✓` 
                : t('payments_unpaid');

            return (
              <div
                key={lesson.id}
                className="bg-surface border border-surface-border rounded-lg p-3 space-y-2 hover:bg-surface-hover/40 active:scale-[0.99] active:bg-surface-hover transition-all"
              >
                {/* Top Status & Date Line */}
                <div className="flex items-center justify-between text-[11px] font-bold border-b border-surface-border pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      <span>{formattedDate}</span>
                    </span>
                    <span className="font-mono text-text-muted/70 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-text-muted/70" />
                      <span>{lesson.time}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${attBadgeClass}`}>
                      {attText}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${payBadgeClass}`}>
                      {payText}
                    </span>
                  </div>
                </div>

                {/* Main Lesson Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-text-main text-xs truncate max-w-xs">
                        {lesson.title || lesson.groupName || lesson.studentName}
                      </span>
                      {isGroup ? (
                        <span className="text-[9px] bg-primary-soft text-primary font-bold px-1.5 py-0.5 rounded border border-primary-border flex items-center gap-0.5 active:scale-95 transition-all hover:bg-primary/20">
                          <Users className="w-2.5 h-2.5" />
                          <span>{t('timeline_group')}</span>
                        </span>
                      ) : (
                        <span className="text-[9px] bg-surface-hover text-text-muted font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" />
                          <span>{t('timeline_individual')}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-text-muted font-bold">
                      {lesson.status === 'cancelled' ? (
                        <span className="text-primary font-bold bg-primary-soft px-1.5 py-0.5 rounded border border-primary-border">
                          {t('status_cancelled')}
                        </span>
                      ) : (
                        <span>{t('lesson_session_num')} ({lesson.sessionNumber || 1} / {lesson.totalSessionsInPackage || 8})</span>
                      )}
                      
                      {lesson.studentName && isGroup && (
                        <span className="text-text-muted/70">• {t('daily_stats_student')}: {lesson.studentName}</span>
                      )}
                    </div>

                    {lesson.notes && (
                      <p className="text-[10px] text-text-muted bg-surface-hover p-1.5 rounded-md border border-surface-border mt-0.5 line-clamp-2 leading-relaxed">
                        💬 {lesson.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Reports & Scores if generated */}
                {lesson.report?.arabicPerformance && (
                  <div className="bg-primary-soft border border-primary-border p-2 rounded-md text-[11px] flex items-center justify-between text-primary">
                    <span className="font-bold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-primary" />
                      <span>{t('reports_title')}: {lesson.report.arabicPerformance}</span>
                    </span>
                    {lesson.report.savedAt && (
                      <span className="text-[10px] opacity-75 font-mono">{lesson.report.savedAt}</span>
                    )}
                  </div>
                )}

                {/* Action Controls */}
                <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-surface-border flex-wrap">
                  {(() => {
                    const r1 = lesson.recordingLink || lesson.report?.recordingLink;
                    const r2 = lesson.recordingLink2 || lesson.report?.recordingLink2;
                    if (r1 && r2) {
                      return (
                        <>
                          <a
                            href={r1}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-primary-soft hover:bg-primary/20 text-primary font-bold rounded text-xs border border-primary-border flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            title="مشاهدة الجزء الأول من تسجيل الحصة"
                          >
                            <Video className="w-3 h-3 text-primary" />
                            <span>تسجيل (جزء 1)</span>
                          </a>
                          <a
                            href={r2}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-primary-soft hover:bg-primary/20 text-primary font-bold rounded text-xs border border-primary-border flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            title="مشاهدة الجزء الثاني من تسجيل الحصة"
                          >
                            <Video className="w-3 h-3 text-primary" />
                            <span>تسجيل (جزء 2)</span>
                          </a>
                        </>
                      );
                    }
                    if (r1 || r2) {
                      const link = (r1 || r2)!;
                      return (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-primary-soft hover:bg-primary/20 text-primary font-bold rounded text-xs border border-primary-border flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="مشاهدة تسجيل الحصة"
                        >
                          <Video className="w-3 h-3 text-primary" />
                          <span>تسجيل الحصة</span>
                        </a>
                      );
                    }
                    return null;
                  })()}

                  <button
                    onClick={() => setReportModalLesson(lesson)}
                    className="px-2 py-1 bg-surface-hover hover:bg-surface-border text-text-main font-bold rounded text-xs border border-surface-border flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <FileText className="w-3 h-3 text-primary" />
                    <span>{t('lesson_parent_report_btn')}</span>
                  </button>

                  <button
                    onClick={() => openLessonControl(lesson)}
                    className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Settings className="w-3 h-3" />
                    <span>{t('lesson_control_title')}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {filteredLessons.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={filteredLessons.length}
          pageSize={pageSize}
          onPageChange={(page) => {
            setCurrentPage(page);
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          onPageSizeChange={(newSize) => setPageSize(newSize)}
          pageSizeOptions={[10, 15, 25, 50]}
          itemName={_t('حصة', 'lessons', 'Lektionen')}
          className="mt-3"
        />
      )}

      {/* Arabic Parent Report Modal Direct Launch */}
      {reportModalLesson && (
        <ArabicParentReportModal
          lesson={reportModalLesson}
          student={studentMap.get(reportModalLesson.studentId || '') || studentMap.get(reportModalLesson.studentName || '')}
          profile={profile}
          onClose={() => setReportModalLesson(null)}
          onSaveReport={(arabicReportText, extraFields) => {
            saveLessonReport(reportModalLesson.id, {
              ...(reportModalLesson.report || {}),
              arabicFullGeneratedReport: arabicReportText,
              ...(extraFields || {}),
              savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            const lessonUpdates: Partial<Lesson> = {};
            if (extraFields?.recordingLink !== undefined) {
              lessonUpdates.recordingLink = extraFields.recordingLink;
            }
            if (extraFields?.recordingLink2 !== undefined) {
              lessonUpdates.recordingLink2 = extraFields.recordingLink2;
            }
            if (Object.keys(lessonUpdates).length > 0) {
              updateLesson(reportModalLesson.id, lessonUpdates);
            }
            setReportModalLesson(null);
          }}
        />
      )}
    </div>
  );
};
