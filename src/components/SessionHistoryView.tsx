import { isPendingStatus } from "../utils/lessonUtils";
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson } from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { 
  History, Search, Filter, Calendar, Clock, CheckCircle2, XCircle, 
  AlertTriangle, Users, User, ArrowUpRight, FileText, Settings, Play, 
  Check, DollarSign, BookOpen, ChevronRight, Award
} from 'lucide-react';
import { ArabicParentReportModal } from './ArabicParentReportModal';

export const SessionHistoryView: React.FC = () => {
  const { lessons: activeLessons, getHistoricalLessons, students, groups, profile, openLessonControl, updateLesson, saveLessonReport, t } = useApp();

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
            if (lesson.studentId !== sId && !lesson.title.toLowerCase().includes(sId.toLowerCase())) return false;
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
        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          const matchTitle = lesson.title.toLowerCase().includes(term);
          const matchStudent = (lesson.studentName || '').toLowerCase().includes(term);
          const matchGroup = (lesson.groupName || '').toLowerCase().includes(term);
          const matchNotes = (lesson.notes || '').toLowerCase().includes(term);
          const matchDate = lesson.date.includes(term);
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

  // Overall Statistics
  const totalCount = lessons.length;
  const completedCount = lessons.filter(l => l.status === 'completed').length;
  const cancelledCount = lessons.filter(l => l.status === 'cancelled').length;
  const pendingCount = lessons.filter(l => isPendingStatus(l.status)).length;
  const totalHours = (lessons.reduce((acc, l) => acc + (l.durationMinutes || l.duration || 60), 0) / 60).toFixed(1);

  return (
    <div className="space-y-4  font-sans">
      {/* Header Banner - redesigned to modern flat theme */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-soft dark:bg-primary-soft/40 flex items-center justify-center border border-primary-border/50 dark:border-primary-border/40 shrink-0">
            <History className="w-5 h-5 text-primary dark:text-primary" />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">{t('history_title')}</h1>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">{t('history_header_sub')}</p>
          </div>
        </div>

        {/* Quick Stats Grid - elegant solid styling with high contrast */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-surface-border/80 text-center">
          <div className="bg-surface-hover p-2.5 rounded-lg border border-surface-border dark:border-surface-border-soft/80">
            <span className="block text-[10px] text-text-muted font-bold uppercase truncate">{t('history_total_lessons')}</span>
            <span className="text-sm font-black text-text-main mt-1 block">{totalCount}</span>
          </div>
          <div className="bg-primary-soft dark:bg-primary-soft p-2.5 rounded-lg border border-primary-border dark:border-primary-border">
            <span className="block text-[10px] text-primary dark:text-primary font-bold uppercase truncate">{t('history_completed')}</span>
            <span className="text-sm font-black text-primary dark:text-primary mt-1 block">{completedCount}</span>
          </div>
          <div className="bg-primary-soft dark:bg-primary-soft p-2.5 rounded-lg border border-primary-border dark:border-primary-border">
            <span className="block text-[10px] text-primary dark:text-primary font-bold uppercase truncate">{t('status_cancelled')}</span>
            <span className="text-sm font-black text-primary dark:text-primary mt-1 block">{cancelledCount}</span>
          </div>
          <div className="bg-primary-soft dark:bg-primary-soft/30 p-2.5 rounded-lg border border-primary-border dark:border-primary-border/40">
            <span className="block text-[10px] text-primary dark:text-primary font-bold uppercase truncate">{t('history_total_hours')}</span>
            <span className="text-sm font-black text-primary dark:text-primary/70 mt-1 block">{totalHours} hrs</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-surface border border-surface-border rounded-xl p-3.5 space-y-3.5 shadow-2xs">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted/70 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('history_search_placeholder')}
            className="w-full pl-9 pr-3 py-1.5 bg-surface-hover/80 border border-surface-border dark:border-surface-border-soft rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filter Row 1: Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-bold no-scrollbar">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            {t('all')} ({lessons.length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-2.5 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            ✓ {t('history_completed')} ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`px-2.5 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'cancelled'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            🚫 {t('status_cancelled')} ({cancelledCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-2.5 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-primary text-white border border-transparent shadow-2xs'
                : 'bg-surface-hover/60 text-text-muted border border-surface-border/60 dark:border-surface-border-soft/60'
            }`}
          >
            ⚠️ {t('status_pending')} ({pendingCount})
          </button>
        </div>

        {/* Filter Row 2: Entity & Period Dropdowns */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-text-muted/70 mb-1 uppercase tracking-wider">{t('history_filter_entity_label')}</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full bg-surface-hover border border-surface-border dark:border-surface-border-soft font-bold px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer text-xs"
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
            <label className="block text-[10px] font-bold text-text-muted/70 mb-1 uppercase tracking-wider">{t('history_filter_period_label')}</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full bg-surface-hover border border-surface-border dark:border-surface-border-soft font-bold px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer text-xs"
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
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] font-bold px-1 text-slate-500">
          <span>
            {t('history_results_count').replace('{count}', filteredLessons.length.toString())}
          </span>
          {searchTerm || statusFilter !== 'all' || entityFilter !== 'all' || periodFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setEntityFilter('all');
                setPeriodFilter('all');
              }}
              className="text-primary dark:text-primary font-black hover:underline cursor-pointer"
            >
              {t('history_reset_filters')}
            </button>
          ) : null}
        </div>

        {filteredLessons.length === 0 ? (
          <div className="bg-surface border border-surface-border rounded-xl p-5 text-center space-y-2">
            <div className="w-10 h-10 rounded-lg bg-background dark:bg-slate-850 flex items-center justify-center mx-auto text-text-muted/70 border border-slate-100 dark:border-surface-border">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-text-main text-xs">{t('next_action_no_lessons')}</p>
            </div>
          </div>
        ) : (
          filteredLessons.map((lesson) => {
            const isGroup = Boolean(lesson.groupId);
            const formattedDate = lesson.date ? lesson.date.split('-').reverse().join('/') : '';
            
            // Attendance Status formatting
            const reportAtt = lesson.report?.attendanceStatus || (lesson.status === 'completed' ? 'present' : lesson.status === 'cancelled' ? 'absent' : 'present');
            const attBadgeClass = 
              reportAtt === 'present' ? 'bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border-primary-border dark:border-primary-border'
              : reportAtt === 'late' ? 'bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border-primary-border dark:border-primary-border'
              : 'bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border-primary-border dark:border-primary-border';

            const attText = reportAtt === 'present' ? `${t('att_present')} ✓` : reportAtt === 'late' ? `${t('att_late')} ⚠️` : `${t('att_absent')} ✕`;

            // Payment badge
            const isPaid = lesson.paymentStatus === 'paid';
            const payBadgeClass = isPaid
              ? 'bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border'
              : 'bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border';

            return (
              <div
                key={lesson.id}
                className="bg-surface border border-surface-border rounded-xl p-4 space-y-3 hover:bg-background/20 active:scale-[0.99] active:bg-surface-hover transition-all"
              >
                {/* Top Status & Date Line */}
                <div className="flex items-center justify-between text-[11px] font-bold border-b border-slate-100 dark:border-slate-850 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>{formattedDate}</span>
                    </span>
                    <span className="font-mono text-text-muted/70 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-text-muted/70" />
                      <span>{lesson.time}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${attBadgeClass}`}>
                      {attText}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${payBadgeClass}`}>
                      {isPaid ? `${t('payments_paid')} ✓` : t('payments_unpaid')}
                    </span>
                  </div>
                </div>

                {/* Main Lesson Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-xs">
                        {lesson.title || lesson.groupName || lesson.studentName}
                      </span>
                      {isGroup ? (
                        <span className="text-[9px] bg-primary-soft dark:bg-primary-soft/40 text-primary dark:text-primary/70 font-bold px-1.5 py-0.5 rounded border border-primary-border/30 flex items-center gap-0.5 active:scale-95 transition-all hover:bg-primary/20">
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

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                      <span>{t('lesson_session_num')} ({lesson.sessionNumber || 1} / {lesson.totalSessionsInPackage || 8})</span>
                      
                      {lesson.studentName && isGroup && (
                        <span className="text-text-muted/70">• {t('daily_stats_student')}: {lesson.studentName}</span>
                      )}
                    </div>

                    {lesson.notes && (
                      <p className="text-[11px] text-slate-500 bg-surface-hover/30 p-2 rounded-lg border border-slate-100 dark:border-surface-border mt-1 line-clamp-2 leading-relaxed">
                        💬 {lesson.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Reports & Scores if generated */}
                {lesson.report?.arabicPerformance && (
                  <div className="bg-primary-soft dark:bg-primary-soft border border-primary-border dark:border-primary-border p-2.5 rounded-lg text-[11px] flex items-center justify-between text-primary dark:text-primary">
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
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                  <button
                    onClick={() => setReportModalLesson(lesson)}
                    className="px-2.5 py-1.5 bg-primary-soft dark:bg-primary-soft hover:bg-primary-soft text-primary dark:text-primary font-bold rounded text-xs border border-primary-border dark:border-primary-border flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <FileText className="w-3 h-3 text-primary dark:text-primary" />
                    <span>{t('lesson_parent_report_btn')}</span>
                  </button>

                  <button
                    onClick={() => openLessonControl(lesson)}
                    className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95 hover:shadow-lg hover:shadow-primary/30"
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

      {/* Arabic Parent Report Modal Direct Launch */}
      {reportModalLesson && (
        <ArabicParentReportModal
          lesson={reportModalLesson}
          student={students.find(s => s.id === reportModalLesson.studentId || s.name === reportModalLesson.studentName)}
          profile={profile}
          onClose={() => setReportModalLesson(null)}
          onSaveReport={(arabicReportText, extraFields) => {
            saveLessonReport(reportModalLesson.id, {
              ...(reportModalLesson.report || {}),
              arabicFullGeneratedReport: arabicReportText,
              ...(extraFields || {}),
              savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            setReportModalLesson(null);
          }}
        />
      )}
    </div>
  );
};
