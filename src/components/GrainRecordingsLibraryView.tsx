import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Search,
  MoreVertical,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  FileText,
  Sparkles,
  Inbox,
  X,
  RotateCcw,
  Settings,
  Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  GrainDiscoveredRecording,
  GrainEducationalDraft,
  Group,
  Lesson
} from '../types';
import {
  loadDiscoveredGrainRecordings,
  saveDiscoveredGrainRecordings,
  syncGrainRecordingsIncrementally,
  evaluateRecordingMatchAgainstLessons,
  detectGrainTwoPartRecordingPairs,
  correctGrainRecordingAssignment,
  removeGrainRecordingFromLocalLibrary,
  restoreRemovedGrainLibraryEntries,
  generateEducationalDraftForRecording,
  buildLernstudioDraftFromGrainEducationalDraft,
  loadGrainIntegrationMeta,
  classifyGrainRecordingShareAccess,
  extractStructuredLessonContentForLesson,
  applyExtractedLessonContentToLesson,
  acceptPendingUpdatedLessonExtraction,
  dismissPendingUpdatedLessonExtraction
} from '../services/grainService';
import {
  buildGrainLibraryEntries,
  computeGrainLibraryStats,
  filterGrainLibraryEntries,
  GrainLibraryEntry,
  GrainLibraryFilterKey,
  GrainLifecycleStatus,
  GrainPrimaryActionKind
} from '../services/grainRecordingStatus';
import {
  GrainAdvancedFiltersSheet,
  GrainDeleteConfirmDialog,
  GrainOverflowActionSheet,
  GrainReviewResolveSheet
} from './GrainRecordingActionSheets';
import { GrainRecordingDetailsSheet } from './GrainRecordingDetailsSheet';
import { GroupProfileModal } from './GroupProfileModal';

type Translator = (ar: string, en: string, de: string) => string;

const INITIAL_VISIBLE_COUNT = 40;
const LOAD_MORE_STEP = 40;

function formatCompactDate(dateYmd: string, language: string): string {
  if (!dateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return dateYmd || '—';
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return dateYmd;
  try {
    const locale = language === 'ar' ? 'ar-EG' : language === 'de' ? 'de-DE' : 'en-GB';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(dt);
  } catch {
    return dateYmd;
  }
}

function getStatusMeta(status: GrainLifecycleStatus, tr: Translator) {
  switch (status) {
    case 'lesson_extraction_completed':
      return {
        label: tr('مكتمل', 'Completed', 'Abgeschlossen'),
        fullLabel: tr('اكتمل استخراج الحصة', 'Lesson Extraction Completed', 'Lektionsextraktion abgeschlossen'),
        textClass: 'text-emerald-700 dark:text-emerald-400',
        Icon: CheckCircle2
      };
    case 'ai_notes_available':
      return {
        label: tr('ملاحظات AI متاحة', 'AI Notes Available', 'KI-Notizen verfügbar'),
        fullLabel: tr('ملاحظات Grain AI متاحة', 'AI Notes Available', 'KI-Notizen verfügbar'),
        textClass: 'text-primary',
        Icon: Sparkles
      };
    case 'transcript_available':
      return {
        label: tr('النص متاح', 'Transcript Available', 'Transkript verfügbar'),
        fullLabel: tr('النص متاح', 'Transcript Available', 'Transkript verfügbar'),
        textClass: 'text-sky-700 dark:text-sky-400',
        Icon: FileText
      };
    case 'pending_part2':
      return {
        label: tr('بانتظار الجزء 2', 'Pending Part 2', 'Wartet auf Teil 2'),
        fullLabel: tr('بانتظار الجزء 2', 'Pending Part 2', 'Wartet auf Teil 2'),
        textClass: 'text-amber-700 dark:text-amber-400',
        Icon: Clock
      };
    case 'processing':
      return {
        label: tr('قيد المعالجة', 'Processing', 'Verarbeitung'),
        fullLabel: tr('قيد المعالجة', 'Processing', 'Verarbeitung'),
        textClass: 'text-primary',
        Icon: RefreshCw
      };
    case 'review_required':
      return {
        label: tr('يتطلب مراجعة', 'Review Required', 'Prüfung nötig'),
        fullLabel: tr('يتطلب مراجعة', 'Review Required', 'Überprüfung erforderlich'),
        textClass: 'text-amber-700 dark:text-amber-400',
        Icon: AlertTriangle
      };
    case 'processing_failed':
      return {
        label: tr('فشلت المعالجة', 'Processing Failed', 'Fehlgeschlagen'),
        fullLabel: tr('فشلت المعالجة', 'Processing Failed', 'Verarbeitung fehlgeschlagen'),
        textClass: 'text-rose-600 dark:text-rose-400',
        Icon: XCircle
      };
    default:
      return {
        label: tr('تم الاستلام', 'Received', 'Empfangen'),
        fullLabel: tr('تم استلام التسجيل', 'Received', 'Empfangen'),
        textClass: 'text-text-muted',
        Icon: Inbox
      };
  }
}

function getPrimaryActionLabel(action: GrainPrimaryActionKind, tr: Translator): string {
  switch (action) {
    case 'retry':
      return tr('إعادة المحاولة', 'Retry', 'Wiederholen');
    case 'resolve_issue':
      return tr('حل المشكلة', 'Resolve Issue', 'Problem lösen');
    case 'view_progress':
      return tr('عرض التقدم', 'View Progress', 'Fortschritt');
    default:
      return tr('عرض التفاصيل', 'View Details', 'Details');
  }
}

function buildCompactPipelineSummary(entry: GrainLibraryEntry, tr: Translator): string {
  const parts: string[] = [];
  if (entry.grain.transcriptStatus === 'available') {
    parts.push(`${tr('النص', 'Transcript', 'Transkript')}: ${tr('متاح', 'Available', 'Verfügbar')}`);
  } else if (entry.grain.transcriptStatus === 'partial') {
    parts.push(`${tr('النص', 'Transcript', 'Transkript')}: ${tr('جزئي', 'Partial', 'Teilweise')}`);
  } else if (entry.grain.aiNotesAvailable) {
    parts.push(`${tr('ملاحظات AI', 'AI Notes', 'KI-Notizen')}: ${tr('متاحة', 'Available', 'Verfügbar')}`);
  } else if (entry.grain.transcriptStatus === 'unavailable') {
    parts.push(`${tr('النص', 'Transcript', 'Transkript')}: ${tr('غير متاح', 'Unavailable', 'Nicht verfügbar')}`);
  } else if (entry.grain.recordingAvailable) {
    parts.push(`${tr('التسجيل', 'Recording', 'Aufzeichnung')}: ${tr('متاح', 'Available', 'Verfügbar')}`);
  }

  if (entry.extraction.status === 'completed') {
    parts.push(`${tr('الاستخراج', 'Extraction', 'Extraktion')}: ${tr('مكتمل', 'Completed', 'Abgeschlossen')}`);
  } else if (entry.extraction.status === 'partial') {
    parts.push(`${tr('الاستخراج', 'Extraction', 'Extraktion')}: ${tr('جزئي', 'Partial', 'Teilweise')}`);
  } else if (entry.extraction.status === 'failed') {
    parts.push(`${tr('الاستخراج', 'Extraction', 'Extraktion')}: ${tr('فشل', 'Failed', 'Fehlgeschlagen')}`);
  } else if (entry.lifecycleStatus === 'pending_part2') {
    parts.push(tr('تم استلام الجزء 1 فقط', 'Part 1 received only', 'Nur Teil 1 empfangen'));
  }

  if (entry.extraction.hasPendingUpdatedExtraction) {
    parts.push(tr('تحديث متاح', 'Update available', 'Update verfügbar'));
  }

  return parts.join(' · ');
}

interface RecordingRowProps {
  entry: GrainLibraryEntry;
  language: string;
  tr: Translator;
  isRetrying: boolean;
  onPrimaryAction: (entry: GrainLibraryEntry) => void;
  onOpenOverflow: (entry: GrainLibraryEntry) => void;
  onOpenDetails: (entry: GrainLibraryEntry) => void;
}

const MobileRecordingItem = React.memo<RecordingRowProps>(
  ({ entry, language, tr, isRetrying, onPrimaryAction, onOpenOverflow, onOpenDetails }) => {
    const statusMeta = getStatusMeta(entry.lifecycleStatus, tr);
    const StatusIcon = statusMeta.Icon;
    const primaryLabel = getPrimaryActionLabel(entry.primaryAction, tr);
    const pipelineLine = buildCompactPipelineSummary(entry, tr);
    const formattedDate = formatCompactDate(entry.dateYmd, language);

    return (
      <article className="px-3.5 py-3.5 space-y-2 transition-colors hover:bg-surface-hover/40">
        {/* Row 1: Title + Status (semantic icon + label, no static pill box) */}
        <div
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => onOpenDetails(entry)}
        >
          <h3 className="text-[15px] font-semibold text-text-main leading-snug line-clamp-2 break-words min-w-0 flex-1">
            {entry.title}
          </h3>
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 whitespace-nowrap pt-0.5 ${statusMeta.textClass}`}
          >
            <StatusIcon
              className={`w-3.5 h-3.5 shrink-0 ${
                entry.lifecycleStatus === 'processing' || isRetrying ? 'animate-spin' : ''
              }`}
            />
            <span>{statusMeta.label}</span>
          </span>
        </div>

        {/* Row 2: Date · Time · Duration · Segments */}
        <div className="text-xs text-text-muted tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>{formattedDate}</span>
          <span aria-hidden="true">·</span>
          <span>{entry.startTimeHm}</span>
          <span aria-hidden="true">·</span>
          <span>
            {entry.totalDurationMinutes} {tr('دقيقة', 'min', 'Min.')}
          </span>
          {entry.segmentCount === 2 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-text-main">
                {tr('مقطعان (1+2)', '2 segments', '2 Segmente')}
              </span>
            </>
          )}
        </div>

        {/* Row 3: Linked Group / Session (or exceptional review reason) */}
        {entry.recognition.status === 'recognized' ? (
          <div className="text-xs text-text-main flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-text-muted">{tr('المجموعة:', 'Group:', 'Gruppe:')}</span>
            <span className="font-medium break-words">
              {entry.recognition.groupName || tr('حصة مرتبطة', 'Linked session', 'Verknüpfte Sitzung')}
            </span>
            {entry.recognition.session && (
              <>
                <span aria-hidden="true" className="text-text-muted">·</span>
                <span className="text-text-muted tabular-nums">
                  {entry.recognition.session.weekdayName} {entry.recognition.session.startTime}
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            {entry.recognition.reviewReasonDetail}
          </p>
        )}

        {/* Row 4: Processing & Extraction summary */}
        {pipelineLine && (
          <div className="text-xs text-text-muted leading-snug">{pipelineLine}</div>
        )}

        {/* Row 5: Contextual Primary Action + Overflow Menu (44px touch targets) */}
        <div className="pt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={isRetrying && entry.primaryAction === 'retry'}
            onClick={() => onPrimaryAction(entry)}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              entry.primaryAction === 'retry' || entry.primaryAction === 'resolve_issue'
                ? 'bg-primary hover:bg-primary-hover text-white'
                : 'border border-surface-border bg-background hover:bg-surface-hover text-text-main'
            }`}
          >
            {isRetrying && entry.primaryAction === 'retry'
              ? tr('جارٍ إعادة المحاولة...', 'Retrying...', 'Wird wiederholt...')
              : primaryLabel}
          </button>

          <button
            type="button"
            onClick={() => onOpenOverflow(entry)}
            aria-label={tr(
              `المزيد من الإجراءات لـ ${entry.title}`,
              `More actions for ${entry.title}`,
              `Weitere Aktionen für ${entry.title}`
            )}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </article>
    );
  }
);

MobileRecordingItem.displayName = 'MobileRecordingItem';

const DesktopRecordingRow = React.memo<RecordingRowProps>(
  ({ entry, language, tr, isRetrying, onPrimaryAction, onOpenOverflow, onOpenDetails }) => {
    const statusMeta = getStatusMeta(entry.lifecycleStatus, tr);
    const StatusIcon = statusMeta.Icon;
    const primaryLabel = getPrimaryActionLabel(entry.primaryAction, tr);
    const pipelineLine = buildCompactPipelineSummary(entry, tr);
    const formattedDate = formatCompactDate(entry.dateYmd, language);

    return (
      <tr className="hover:bg-surface-hover/40 transition-colors">
        {/* Recording */}
        <td className="py-3 px-4 max-w-[320px] align-top">
          <button
            type="button"
            onClick={() => onOpenDetails(entry)}
            className="text-start group cursor-pointer block w-full"
          >
            <div className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors line-clamp-2 break-words leading-snug">
              {entry.title}
            </div>
            {entry.segmentCount === 2 && (
              <div className="text-xs text-text-muted mt-0.5 tabular-nums">
                {tr('مقطعان (الجزء 1 + 2)', '2 segments (Part 1 + 2)', '2 Segmente (Teil 1 + 2)')}
              </div>
            )}
          </button>
        </td>

        {/* Date */}
        <td className="py-3 px-3 whitespace-nowrap align-top tabular-nums">
          <div className="text-sm font-medium text-text-main">{formattedDate}</div>
          <div className="text-xs text-text-muted mt-0.5">{entry.startTimeHm}</div>
        </td>

        {/* Duration */}
        <td className="py-3 px-3 whitespace-nowrap align-top tabular-nums text-sm text-text-main">
          {entry.totalDurationMinutes} {tr('دقيقة', 'min', 'Min.')}
        </td>

        {/* Group */}
        <td className="py-3 px-3 max-w-[220px] align-top">
          {entry.recognition.status === 'recognized' ? (
            <div>
              <div className="text-sm font-medium text-text-main break-words leading-snug">
                {entry.recognition.groupName || tr('حصة مرتبطة', 'Linked session', 'Verknüpfte Sitzung')}
              </div>
              {entry.recognition.session && (
                <div className="text-xs text-text-muted mt-0.5 tabular-nums">
                  {entry.recognition.session.weekdayName} · {entry.recognition.session.startTime}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
              {tr('يتطلب مراجعة', 'Review Required', 'Prüfung nötig')}
            </div>
          )}
        </td>

        {/* Processing */}
        <td className="py-3 px-3 max-w-[240px] align-top">
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusMeta.textClass}`}>
            <StatusIcon
              className={`w-3.5 h-3.5 shrink-0 ${
                entry.lifecycleStatus === 'processing' || isRetrying ? 'animate-spin' : ''
              }`}
            />
            <span>{statusMeta.label}</span>
          </div>
          {pipelineLine && (
            <div className="text-xs text-text-muted mt-0.5 leading-snug">{pipelineLine}</div>
          )}
        </td>

        {/* Actions */}
        <td className="py-3 px-4 whitespace-nowrap text-end align-top">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              disabled={isRetrying && entry.primaryAction === 'retry'}
              onClick={() => onPrimaryAction(entry)}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                entry.primaryAction === 'retry' || entry.primaryAction === 'resolve_issue'
                  ? 'bg-primary hover:bg-primary-hover text-white'
                  : 'border border-surface-border bg-background hover:bg-surface-hover text-text-main'
              }`}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenOverflow(entry)}
              aria-label={tr(
                `المزيد من الإجراءات لـ ${entry.title}`,
                `More actions for ${entry.title}`,
                `Weitere Aktionen für ${entry.title}`
              )}
              className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }
);

DesktopRecordingRow.displayName = 'DesktopRecordingRow';

export const GrainRecordingsLibraryView: React.FC = () => {
  const {
    lessons,
    students,
    groups,
    groupWeeklySessions,
    zoomMeetingHistory,
    updateLesson,
    saveLernstudioSet,
    language,
    setActiveTab
  } = useApp();

  const tr = useCallback<Translator>(
    (ar, en, de) => (language === 'ar' ? ar : language === 'de' ? de : en),
    [language]
  );

  const [recordings, setRecordings] = useState<GrainDiscoveredRecording[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [hasConnectedToken, setHasConnectedToken] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Per-recording processing & failure state
  const [processingRecordingIds, setProcessingRecordingIds] = useState<Set<string>>(() => new Set());
  const [failedRecordingErrors, setFailedRecordingErrors] = useState<Record<string, string>>({});

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GrainLibraryFilterKey>('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Windowed pagination for 100s of recordings
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Contextual Sheets & Modals
  const [detailsEntryId, setDetailsEntryId] = useState<string | null>(null);
  const [overflowEntryId, setOverflowEntryId] = useState<string | null>(null);
  const [resolveEntryId, setResolveEntryId] = useState<string | null>(null);
  const [deleteTargetEntryId, setDeleteTargetEntryId] = useState<string | null>(null);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [isResolvingIssue, setIsResolvingIssue] = useState(false);

  // On-demand Educational Draft state (only loaded inside Details sheet)
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<GrainEducationalDraft | null>(null);
  const [editedSummaryAr, setEditedSummaryAr] = useState('');
  const [editedHomeworkText, setEditedHomeworkText] = useState('');
  const [draftApprovedMessage, setDraftApprovedMessage] = useState<string | null>(null);

  const refreshLocalLibrary = useCallback(() => {
    const disc = loadDiscoveredGrainRecordings({ includeRemoved: false });
    const meta = loadGrainIntegrationMeta();
    setRecordings(disc);
    setLastSyncAt(meta.lastSuccessfulSyncAt);
    setHasConnectedToken(meta.hasToken);
  }, []);

  useEffect(() => {
    refreshLocalLibrary();
  }, [refreshLocalLibrary]);

  // Automatic recognition using standardized Zoom sessions & immutable Zoom history (preserving historical compatibility)
  const evaluatedRecordings = useMemo(() => {
    const evaluated = recordings.map((rec) =>
      evaluateRecordingMatchAgainstLessons(
        rec,
        lessons,
        groups,
        students,
        undefined,
        undefined,
        groupWeeklySessions,
        zoomMeetingHistory
      )
    );
    return detectGrainTwoPartRecordingPairs({
      recordings: evaluated,
      lessons,
      groups,
      students
    });
  }, [recordings, lessons, groups, students, groupWeeklySessions, zoomMeetingHistory]);

  const libraryEntries = useMemo(
    () =>
      buildGrainLibraryEntries({
        recordings: evaluatedRecordings,
        lessons,
        groups,
        weeklySessions: groupWeeklySessions,
        zoomHistory: zoomMeetingHistory,
        processingRecordingIds,
        failedRecordingErrors
      }),
    [
      evaluatedRecordings,
      lessons,
      groups,
      groupWeeklySessions,
      zoomMeetingHistory,
      processingRecordingIds,
      failedRecordingErrors
    ]
  );

  const stats = useMemo(() => computeGrainLibraryStats(libraryEntries), [libraryEntries]);

  const filteredEntries = useMemo(
    () =>
      filterGrainLibraryEntries(libraryEntries, {
        searchQuery,
        statusFilter,
        groupFilter,
        studentFilter,
        dateFilter,
        students
      }),
    [libraryEntries, searchQuery, statusFilter, groupFilter, studentFilter, dateFilter, students]
  );

  // Reset visible window when filters change
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [searchQuery, statusFilter, groupFilter, studentFilter, dateFilter]);

  // Smooth incremental loading when scrolling large libraries
  useEffect(() => {
    if (visibleCount >= filteredEntries.length) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => Math.min(filteredEntries.length, prev + LOAD_MORE_STEP));
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filteredEntries.length]);

  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, visibleCount),
    [filteredEntries, visibleCount]
  );

  const entryById = useMemo(() => {
    const map = new Map<string, GrainLibraryEntry>();
    for (const e of libraryEntries) map.set(e.id, e);
    return map;
  }, [libraryEntries]);

  const activeDetailsEntry = detailsEntryId ? entryById.get(detailsEntryId) || null : null;
  const activeOverflowEntry = overflowEntryId ? entryById.get(overflowEntryId) || null : null;
  const activeResolveEntry = resolveEntryId ? entryById.get(resolveEntryId) || null : null;
  const activeDeleteEntry = deleteTargetEntryId ? entryById.get(deleteTargetEntryId) || null : null;

  const advancedFilterCount =
    (groupFilter !== 'all' ? 1 : 0) + (studentFilter !== 'all' ? 1 : 0) + (dateFilter ? 1 : 0);
  const hasAnyActiveFilters =
    Boolean(searchQuery.trim()) || statusFilter !== 'all' || advancedFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setGroupFilter('all');
    setStudentFilter('all');
    setDateFilter('');
  }, []);

  const handleSyncFromGrain = useCallback(
    async (forceFull: boolean = false) => {
      setIsSyncing(true);
      setShowHeaderMenu(false);
      setFeedbackNotice(null);
      try {
        const result = await syncGrainRecordingsIncrementally({
          lessons: lessons || [],
          groups: groups || [],
          students: students || [],
          weeklySessions: groupWeeklySessions || [],
          zoomMeetingHistory: zoomMeetingHistory || [],
          maxPages: forceFull ? 5 : 2,
          onUpdateLesson: updateLesson
        });
        if (!result.success) {
          setFeedbackNotice({
            kind: 'error',
            text:
              result.error ||
              tr(
                'تعذر استيراد التسجيلات من Grain. تحقق من الاتصال في الإعدادات.',
                'Could not sync recordings from Grain. Check your connection in Settings.',
                'Grain-Aufzeichnungen konnten nicht synchronisiert werden.'
              )
          });
        } else {
          refreshLocalLibrary();
          const autoCount = result.autoMatchedLessonIds?.length || 0;
          setFeedbackNotice({
            kind: 'success',
            text: tr(
              `تمت مزامنة ${result.recordings.length} تسجيلاً (${result.newCount} جديد${autoCount > 0 ? `، ${autoCount} تمت معالجتها تلقائياً` : ''}).`,
              `Synced ${result.recordings.length} recordings (${result.newCount} new${autoCount > 0 ? `, ${autoCount} processed automatically` : ''}).`,
              `${result.recordings.length} Aufzeichnungen synchronisiert (${result.newCount} neu${autoCount > 0 ? `, ${autoCount} automatisch verarbeitet` : ''}).`
            )
          });
        }
      } catch (err: any) {
        setFeedbackNotice({
          kind: 'error',
          text: err?.message || tr('حدث خطأ أثناء المزامنة.', 'Sync error occurred.', 'Synchronisierungsfehler.')
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [lessons, groups, students, groupWeeklySessions, zoomMeetingHistory, updateLesson, refreshLocalLibrary, tr]
  );

  const handleRetryProcessing = useCallback(
    async (entry: GrainLibraryEntry) => {
      const targetLesson = entry.recognition.lesson;
      if (!targetLesson) {
        await handleSyncFromGrain(false);
        return;
      }

      setProcessingRecordingIds((prev) => new Set(prev).add(entry.id));
      setFailedRecordingErrors((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });

      try {
        const extracted = await extractStructuredLessonContentForLesson({
          lesson: targetLesson,
          recordings: evaluatedRecordings
        });
        const applied = applyExtractedLessonContentToLesson(targetLesson, extracted);
        if (applied.updated) {
          updateLesson(targetLesson.id, applied.lessonPatch);
        }
        refreshLocalLibrary();
        setFeedbackNotice({
          kind: 'success',
          text:
            extracted.transcriptStatus === 'transcript_unavailable'
              ? tr(
                  'تم فحص التسجيل: النص وملاحظات AI غير متاحة بعد في Grain.',
                  'Checked Grain: transcript and AI Notes are not available yet.',
                  'Geprüft: Transkript und KI-Notizen sind in Grain noch nicht verfügbar.'
                )
              : tr(
                  'تمت إعادة معالجة التسجيل وتحديث محتوى الحصة بنجاح.',
                  'Recording reprocessed and lesson content updated.',
                  'Aufzeichnung erneut verarbeitet und Unterrichtsinhalt aktualisiert.'
                )
        });
      } catch (err: any) {
        const msg =
          err?.message ||
          tr('فشلت إعادة معالجة التسجيل.', 'Failed to reprocess recording.', 'Erneute Verarbeitung fehlgeschlagen.');
        setFailedRecordingErrors((prev) => ({ ...prev, [entry.id]: msg }));
        setFeedbackNotice({ kind: 'error', text: msg });
      } finally {
        setProcessingRecordingIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      }
    },
    [evaluatedRecordings, handleSyncFromGrain, refreshLocalLibrary, tr, updateLesson]
  );

  const handleResolveIssueToLesson = useCallback(
    async (entry: GrainLibraryEntry, targetLessonId: string) => {
      const targetLesson = lessons.find((l) => l.id === targetLessonId);
      if (!targetLesson) return;

      setIsResolvingIssue(true);
      try {
        const rec = entry.primaryRecording;
        const previousLesson = rec.confirmedLessonId
          ? lessons.find((l) => l.id === rec.confirmedLessonId) || null
          : null;

        const corrected = correctGrainRecordingAssignment({
          recording: rec,
          targetLesson,
          previousLesson,
          groups,
          students,
          preferredSlot: 'auto',
          allowOverwrite: true
        });

        if (corrected.previousLessonPatch && previousLesson) {
          updateLesson(previousLesson.id, corrected.previousLessonPatch);
        }

        const workingLesson: Lesson = {
          ...targetLesson,
          ...corrected.targetLessonPatch
        };
        updateLesson(targetLesson.id, corrected.targetLessonPatch);

        const shareClass =
          rec.shareAccessClassification ||
          classifyGrainRecordingShareAccess({
            recordingUrl: rec.recordingUrl,
            share_state: rec.rawShareState
          }).classification;

        const updatedList = recordings.map((item) =>
          item.id === rec.id
            ? {
                ...item,
                confirmedLessonId: targetLesson.id,
                suggestedLessonId: targetLesson.id,
                matchedGroupId: targetLesson.groupId || undefined,
                matchStatus: 'already_linked' as const,
                shareAccessClassification: shareClass
              }
            : item
        );
        saveDiscoveredGrainRecordings(updatedList);

        try {
          const extracted = await extractStructuredLessonContentForLesson({
            lesson: workingLesson,
            recordings: updatedList
          });
          const applied = applyExtractedLessonContentToLesson(workingLesson, extracted);
          if (applied.updated) {
            updateLesson(targetLesson.id, {
              ...corrected.targetLessonPatch,
              ...applied.lessonPatch
            });
          }
        } catch {
          // Extraction errors handled smoothly on next retry
        }

        refreshLocalLibrary();
        setResolveEntryId(null);
        setFeedbackNotice({
          kind: 'success',
          text: tr(
            `تم ربط التسجيل بحصة ${targetLesson.groupName || targetLesson.date} بنجاح.`,
            `Recording assigned to ${targetLesson.groupName || targetLesson.date}.`,
            `Aufzeichnung wurde ${targetLesson.groupName || targetLesson.date} zugewiesen.`
          )
        });
      } finally {
        setIsResolvingIssue(false);
      }
    },
    [groups, lessons, recordings, refreshLocalLibrary, students, tr, updateLesson]
  );

  const handleConfirmDelete = useCallback(
    (entry: GrainLibraryEntry) => {
      for (const seg of entry.segments) {
        removeGrainRecordingFromLocalLibrary(seg.recordingId);
      }
      if (detailsEntryId === entry.id) setDetailsEntryId(null);
      setDeleteTargetEntryId(null);
      refreshLocalLibrary();
      setFeedbackNotice({
        kind: 'success',
        text: tr(
          'تمت إزالة التسجيل من مكتبة Glück المحلية فقط (دون حذفه من Grain).',
          'Removed from local Glück library only (remains intact in Grain).',
          'Nur aus der lokalen Glück-Bibliothek entfernt (in Grain weiterhin vorhanden).'
        )
      });
    },
    [detailsEntryId, refreshLocalLibrary, tr]
  );

  const handleRestoreRemoved = useCallback(() => {
    setShowHeaderMenu(false);
    const restored = restoreRemovedGrainLibraryEntries();
    refreshLocalLibrary();
    setFeedbackNotice({
      kind: 'success',
      text: tr(
        `تمت استعادة التسجيلات المخفية محلياً (${restored.length} إجمالي).`,
        `Restored locally hidden recordings (${restored.length} total).`,
        `Lokal ausgeblendete Aufzeichnungen wiederhergestellt (${restored.length} gesamt).`
      )
    });
  }, [refreshLocalLibrary, tr]);

  const handleAcceptPendingExtraction = useCallback(
    (entry: GrainLibraryEntry) => {
      if (!entry.recognition.lesson) return;
      const patch = acceptPendingUpdatedLessonExtraction(entry.recognition.lesson);
      if (Object.keys(patch).length > 0) {
        updateLesson(entry.recognition.lesson.id, patch);
        setFeedbackNotice({
          kind: 'success',
          text: tr(
            'تم اعتماد الاستخراج المحدث وحفظه في سجل الحصة.',
            'Updated lesson extraction applied and saved.',
            'Aktualisierte Extraktion übernommen und gespeichert.'
          )
        });
      }
    },
    [tr, updateLesson]
  );

  const handleDismissPendingExtraction = useCallback(
    (entry: GrainLibraryEntry) => {
      if (!entry.recognition.lesson) return;
      const patch = dismissPendingUpdatedLessonExtraction(entry.recognition.lesson);
      if (Object.keys(patch).length > 0) {
        updateLesson(entry.recognition.lesson.id, patch);
        setFeedbackNotice({
          kind: 'success',
          text: tr(
            'تم الاحتفاظ بمحتوى الحصة الذي عدّله المعلم دون تغيير.',
            'Kept your teacher-edited lesson content unchanged.',
            'Ihre bearbeiteten Unterrichtsinhalte wurden unverändert beibehalten.'
          )
        });
      }
    },
    [tr, updateLesson]
  );

  const handleGenerateDraft = useCallback(
    async (entry: GrainLibraryEntry) => {
      setIsGeneratingDraft(true);
      setDraftError(null);
      setDraftApprovedMessage(null);
      try {
        const res = await generateEducationalDraftForRecording(entry.primaryRecording, {
          lesson: entry.recognition.lesson,
          students,
          includeTranscriptAnalysis: true
        });
        if (!res.success || !res.draft) {
          setDraftError(
            res.error ||
              tr(
                'تعذر توليد المسودة التعليمية من هذا التسجيل.',
                'Could not generate educational draft for this recording.',
                'Entwurf konnte nicht erstellt werden.'
              )
          );
          return;
        }
        setActiveDraft(res.draft);
        setEditedSummaryAr(res.draft.whatWasCoveredAr || '');
        setEditedHomeworkText(res.draft.homework.map((h) => h.description).join('\n'));
      } catch (err: any) {
        setDraftError(err?.message || 'Draft generation error');
      } finally {
        setIsGeneratingDraft(false);
      }
    },
    [students, tr]
  );

  const handleApproveDraftToLesson = useCallback(
    (entry: GrainLibraryEntry) => {
      if (!activeDraft || !entry.recognition.lesson) return;
      const linkedLesson = entry.recognition.lesson;
      const rec = entry.primaryRecording;
      const existingReport = linkedLesson.report || {
        attendanceStatus: 'present' as const,
        homeworkStatus: 'assigned' as const,
        completedAt: new Date().toISOString()
      };

      updateLesson(linkedLesson.id, {
        grainMeta: {
          ...(linkedLesson.grainMeta || {
            recordingId: rec.id,
            recordingTitle: rec.title,
            startTimestamp: rec.startDatetime,
            durationMinutes: rec.durationMinutes,
            recordingUrl: rec.recordingUrl,
            shareAccessClassification: entry.grain.shareAccess,
            source: rec.sourcePlatform || 'zoom',
            matchingStatus: 'confirmed',
            confirmedLessonId: linkedLesson.id,
            lastSyncedAt: new Date().toISOString()
          }),
          approvedSummary: editedSummaryAr.trim(),
          approvedParentReportSummaryAr: editedSummaryAr.trim()
        },
        report: {
          ...existingReport,
          arabicTopicsExplained: editedSummaryAr.trim() || (existingReport as any).arabicTopicsExplained,
          arabicHomeworkRequired: editedHomeworkText.trim() || (existingReport as any).arabicHomeworkRequired,
          homeworkTitle: editedHomeworkText.trim() || (existingReport as any).homeworkTitle
        }
      });

      setDraftApprovedMessage(
        tr(
          'تم حفظ الملخص والواجب في سجل الحصة.',
          'Approved summary and homework saved to lesson record.',
          'Zusammenfassung und Hausaufgaben gespeichert.'
        )
      );
    },
    [activeDraft, editedHomeworkText, editedSummaryAr, tr, updateLesson]
  );

  const handleApproveLernstudioSet = useCallback(
    (entry: GrainLibraryEntry) => {
      if (!activeDraft) return;
      const grp = entry.recognition.group;
      const newSet = buildLernstudioDraftFromGrainEducationalDraft(activeDraft, {
        title: `Grain: ${entry.title}`,
        grade: grp?.grade || 'General',
        level: (grp?.level as any) || 'A1'
      });
      saveLernstudioSet(newSet as any);
      setDraftApprovedMessage(
        tr(
          `تم إنشاء مجموعة Lernstudio "${newSet.title}" (${newSet.items.length} مفردة).`,
          `Created Lernstudio set "${newSet.title}" (${newSet.items.length} items).`,
          `Lernstudio-Set "${newSet.title}" (${newSet.items.length} Einträge) erstellt.`
        )
      );
    },
    [activeDraft, saveLernstudioSet, tr]
  );

  const openDetailsForEntry = useCallback((entry: GrainLibraryEntry) => {
    setActiveDraft(null);
    setDraftError(null);
    setDraftApprovedMessage(null);
    setDetailsEntryId(entry.id);
  }, []);

  const handlePrimaryAction = useCallback(
    (entry: GrainLibraryEntry) => {
      if (entry.primaryAction === 'retry') {
        void handleRetryProcessing(entry);
        return;
      }
      if (entry.primaryAction === 'resolve_issue') {
        setResolveEntryId(entry.id);
        return;
      }
      openDetailsForEntry(entry);
    },
    [handleRetryProcessing, openDetailsForEntry]
  );

  const handleOpenOverflow = useCallback((entry: GrainLibraryEntry) => {
    setOverflowEntryId(entry.id);
  }, []);

  const filterTabs: Array<{ key: GrainLibraryFilterKey; label: string; count?: number }> = useMemo(
    () => [
      { key: 'all', label: tr('الكل', 'All', 'Alle'), count: stats.total },
      { key: 'processing', label: tr('قيد المعالجة', 'Processing', 'Verarbeitung'), count: stats.processing },
      { key: 'completed', label: tr('مكتمل', 'Completed', 'Abgeschlossen'), count: stats.completed },
      { key: 'pending_part2', label: tr('بانتظار الجزء 2', 'Pending Part 2', 'Teil 2 offen'), count: stats.pendingPart2 },
      { key: 'review_required', label: tr('يتطلب مراجعة', 'Review Required', 'Prüfung nötig'), count: stats.reviewRequired },
      { key: 'processing_failed', label: tr('فشل', 'Failed', 'Fehlgeschlagen'), count: stats.failed }
    ],
    [stats, tr]
  );

  return (
    <div className="w-full min-w-0 space-y-3.5 pb-[calc(6.5rem+env(safe-area-inset-bottom,16px))] md:pb-8">
      {/* Page Header & Compact Statistics */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-text-main truncate">
              {tr('تسجيلات Grain', 'Grain Recordings', 'Grain-Aufzeichnungen')}
            </h1>
            {lastSyncAt && (
              <p className="text-xs text-text-muted tabular-nums mt-0.5">
                {tr('آخر مزامنة:', 'Last synced:', 'Zuletzt synchronisiert:')}{' '}
                {lastSyncAt.slice(0, 16).replace('T', ' ')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 relative">
            <button
              type="button"
              onClick={() => handleSyncFromGrain(false)}
              disabled={isSyncing}
              className="min-h-[44px] px-4 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{tr('مزامنة', 'Sync', 'Sync')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHeaderMenu((prev) => !prev)}
              aria-label={tr('خيارات المكتبة', 'Library options', 'Bibliotheksoptionen')}
              aria-expanded={showHeaderMenu}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-surface-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showHeaderMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowHeaderMenu(false)}
                />
                <div className="absolute top-12 end-0 z-50 w-56 rounded-2xl border border-surface-border bg-surface shadow-lg p-1.5 space-y-0.5">
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => handleSyncFromGrain(true)}
                    className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-start text-xs font-medium text-text-main hover:bg-surface-hover disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-text-muted shrink-0" />
                    <span>{tr('استيراد جميع الصفحات', 'Import All Pages', 'Alle Seiten importieren')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreRemoved}
                    className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-start text-xs font-medium text-text-main hover:bg-surface-hover cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-text-muted shrink-0" />
                    <span>{tr('استعادة المخفي محلياً', 'Restore Hidden Entries', 'Ausgeblendete wiederherstellen')}</span>
                  </button>
                  {!hasConnectedToken && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setActiveTab('settings');
                      }}
                      className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-start text-xs font-semibold text-primary hover:bg-primary-soft cursor-pointer"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      <span>{tr('إعداد اتصال Grain', 'Configure Grain', 'Grain einrichten')}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Compact 4-Stat Strip (Neutral, high-density, clickable shortcuts — no oversized dashboard cards) */}
        <div className="grid grid-cols-4 divide-x divide-surface-border rtl:divide-x-reverse rounded-2xl border border-surface-border bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2 sm:px-3 py-2.5 text-start transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-primary-soft/60' : 'hover:bg-surface-hover/60'
            }`}
          >
            <div className="text-base sm:text-lg font-bold text-text-main tabular-nums leading-tight">
              {stats.total}
            </div>
            <div className="text-[11px] text-text-muted truncate mt-0.5">
              {tr('الإجمالي', 'Total', 'Gesamt')}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('processing')}
            className={`px-2 sm:px-3 py-2.5 text-start transition-colors cursor-pointer ${
              statusFilter === 'processing' ? 'bg-primary-soft/60' : 'hover:bg-surface-hover/60'
            }`}
          >
            <div className="text-base sm:text-lg font-bold text-primary tabular-nums leading-tight">
              {stats.processing}
            </div>
            <div className="text-[11px] text-text-muted truncate mt-0.5">
              {tr('قيد المعالجة', 'Processing', 'Aktiv')}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-2 sm:px-3 py-2.5 text-start transition-colors cursor-pointer ${
              statusFilter === 'completed' ? 'bg-primary-soft/60' : 'hover:bg-surface-hover/60'
            }`}
          >
            <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums leading-tight">
              {stats.completed}
            </div>
            <div className="text-[11px] text-text-muted truncate mt-0.5">
              {tr('مكتمل', 'Completed', 'Fertig')}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('review_required')}
            className={`px-2 sm:px-3 py-2.5 text-start transition-colors cursor-pointer ${
              statusFilter === 'review_required' ? 'bg-primary-soft/60' : 'hover:bg-surface-hover/60'
            }`}
          >
            <div
              className={`text-base sm:text-lg font-bold tabular-nums leading-tight ${
                stats.reviewRequired > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-text-main'
              }`}
            >
              {stats.reviewRequired}
            </div>
            <div className="text-[11px] text-text-muted truncate mt-0.5">
              {tr('مراجعة', 'Review', 'Prüfen')}
            </div>
          </button>
        </div>

        {/* Unconnected Grain Banner */}
        {!hasConnectedToken && (
          <div className="px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span>
              {tr(
                'لم يتم ربط حساب Grain بعد. قم بإعداد الاتصال لاستيراد التسجيلات تلقائياً.',
                'Grain is not connected yet. Configure it in Settings to sync recordings automatically.',
                'Grain ist noch nicht verbunden. In den Einstellungen einrichten.'
              )}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="min-h-[36px] px-3 rounded-lg bg-surface border border-surface-border text-text-main font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tr('الإعدادات', 'Settings', 'Einstellungen')}
            </button>
          </div>
        )}

        {/* Inline Feedback Notice */}
        {feedbackNotice && (
          <div
            role="status"
            className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
              feedbackNotice.kind === 'error'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <span className="leading-snug">{feedbackNotice.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackNotice(null)}
              aria-label={tr('إغلاق الإشعار', 'Dismiss notice', 'Hinweis schließen')}
              className="min-h-[36px] min-w-[36px] -me-1.5 flex items-center justify-center rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Compact Mobile-First Search & Filter Toolbar */}
      <section className="space-y-2.5" aria-label={tr('البحث والتصفية', 'Search and filters', 'Suche und Filter')}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-text-muted absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr(
                'بحث في التسجيلات أو المجموعات...',
                'Search recordings or groups...',
                'Aufzeichnungen oder Gruppen suchen...'
              )}
              className="w-full min-h-[44px] ps-9 pe-9 rounded-xl border border-surface-border bg-surface text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={tr('مسح البحث', 'Clear search', 'Suche löschen')}
                className="min-h-[36px] min-w-[36px] absolute top-1/2 -translate-y-1/2 end-1 flex items-center justify-center text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters(true)}
            aria-label={tr('فلاتر متقدمة', 'Advanced filters', 'Erweiterte Filter')}
            className={`min-h-[44px] px-3 sm:px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              advancedFilterCount > 0
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-surface-border bg-surface text-text-main hover:bg-surface-hover'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">{tr('تصفية', 'Filters', 'Filter')}</span>
            {advancedFilterCount > 0 && (
              <span className="tabular-nums">({advancedFilterCount})</span>
            )}
          </button>
        </div>

        {/* Horizontally Scrollable Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-surface-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`tabular-nums text-[11px] ${
                      isActive ? 'text-white/85' : 'text-text-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}

          {hasAnyActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="min-h-[40px] px-3 rounded-xl text-xs font-medium text-primary hover:bg-primary-soft whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              {tr('مسح الكل', 'Clear Filters', 'Zurücksetzen')}
            </button>
          )}
        </div>
      </section>

      {/* Recording Library Content */}
      <section className="rounded-2xl border border-surface-border bg-surface overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-2.5">
            <p className="text-sm font-semibold text-text-main">
              {libraryEntries.length === 0
                ? tr('لا توجد تسجيلات مستوردة بعد', 'No recordings imported yet', 'Noch keine Aufzeichnungen importiert')
                : tr('لا توجد تسجيلات مطابقة للتصفية الحالية', 'No recordings match your filters', 'Keine Aufzeichnungen entsprechen den Filtern')}
            </p>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              {libraryEntries.length === 0
                ? tr(
                    'اضغط على "مزامنة" لاستيراد التسجيلات من Grain والتعرّف تلقائياً على مجموعاتك وجلساتك.',
                    'Tap "Sync" to import recordings from Grain and automatically associate them with your standardized Zoom groups.',
                    'Tippen Sie auf "Sync", um Aufzeichnungen aus Grain zu importieren und automatisch zuzuordnen.'
                  )
                : tr(
                    'جرّب تغيير كلمات البحث أو مسح الفلاتر لعرض جميع التسجيلات.',
                    'Try adjusting your search or clearing filters to view all recordings.',
                    'Ändern Sie die Suche oder setzen Sie die Filter zurück.'
                  )}
            </p>
            {hasAnyActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="min-h-[44px] px-4 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-xs font-semibold text-text-main cursor-pointer"
              >
                {tr('مسح الفلاتر', 'Clear Filters', 'Filter zurücksetzen')}
              </button>
            ) : (
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => handleSyncFromGrain(false)}
                className="min-h-[44px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold cursor-pointer"
              >
                {tr('مزامنة التسجيلات الآن', 'Sync Recordings Now', 'Jetzt synchronisieren')}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Single-Column Compact List (< md: 320px–767px) */}
            <div className="md:hidden divide-y divide-surface-border">
              {visibleEntries.map((entry) => (
                <MobileRecordingItem
                  key={entry.id}
                  entry={entry}
                  language={language}
                  tr={tr}
                  isRetrying={processingRecordingIds.has(entry.id)}
                  onPrimaryAction={handlePrimaryAction}
                  onOpenOverflow={handleOpenOverflow}
                  onOpenDetails={openDetailsForEntry}
                />
              ))}
            </div>

            {/* Tablet & Desktop Responsive Structured Table (>= md: 768px–1440px+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-surface-border bg-background/60 text-xs font-semibold text-text-muted">
                    <th className="py-2.5 px-4 text-start">{tr('التسجيل', 'Recording', 'Aufzeichnung')}</th>
                    <th className="py-2.5 px-3 text-start">{tr('التاريخ', 'Date', 'Datum')}</th>
                    <th className="py-2.5 px-3 text-start">{tr('المدة', 'Duration', 'Dauer')}</th>
                    <th className="py-2.5 px-3 text-start">{tr('المجموعة', 'Group', 'Gruppe')}</th>
                    <th className="py-2.5 px-3 text-start">{tr('المعالجة', 'Processing', 'Verarbeitung')}</th>
                    <th className="py-2.5 px-4 text-end">{tr('إجراءات', 'Actions', 'Aktionen')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {visibleEntries.map((entry) => (
                    <DesktopRecordingRow
                      key={entry.id}
                      entry={entry}
                      language={language}
                      tr={tr}
                      isRetrying={processingRecordingIds.has(entry.id)}
                      onPrimaryAction={handlePrimaryAction}
                      onOpenOverflow={handleOpenOverflow}
                      onOpenDetails={openDetailsForEntry}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Smooth Incremental Loading Footer for Large Libraries */}
            {visibleCount < filteredEntries.length && (
              <div
                ref={loadMoreRef}
                className="p-3 border-t border-surface-border flex items-center justify-center"
              >
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) => Math.min(filteredEntries.length, prev + LOAD_MORE_STEP))
                  }
                  className="min-h-[44px] px-4 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-xs font-semibold text-text-main tabular-nums cursor-pointer"
                >
                  {tr(
                    `عرض المزيد (${visibleEntries.length} من ${filteredEntries.length})`,
                    `Load more (${visibleEntries.length} of ${filteredEntries.length})`,
                    `Mehr laden (${visibleEntries.length} von ${filteredEntries.length})`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Contextual Overflow Action Sheet */}
      <GrainOverflowActionSheet
        entry={activeOverflowEntry}
        tr={tr}
        isRetrying={activeOverflowEntry ? processingRecordingIds.has(activeOverflowEntry.id) : false}
        onClose={() => setOverflowEntryId(null)}
        onViewDetails={openDetailsForEntry}
        onOpenGroup={(grp) => setViewingGroup(grp)}
        onRetryProcessing={handleRetryProcessing}
        onRequestDelete={(entry) => setDeleteTargetEntryId(entry.id)}
      />

      {/* Recording Details Sheet / Drawer */}
      <GrainRecordingDetailsSheet
        entry={activeDetailsEntry}
        tr={tr}
        isRetrying={activeDetailsEntry ? processingRecordingIds.has(activeDetailsEntry.id) : false}
        isGeneratingDraft={isGeneratingDraft}
        draftError={draftError}
        draftApprovedMessage={draftApprovedMessage}
        activeDraft={activeDraft}
        editedSummaryAr={editedSummaryAr}
        editedHomeworkText={editedHomeworkText}
        onEditedSummaryChange={setEditedSummaryAr}
        onEditedHomeworkChange={setEditedHomeworkText}
        onClose={() => setDetailsEntryId(null)}
        onOpenGroup={(grp) => setViewingGroup(grp)}
        onRetryProcessing={handleRetryProcessing}
        onOpenResolveIssue={(entry) => {
          setDetailsEntryId(null);
          setResolveEntryId(entry.id);
        }}
        onAcceptPendingExtraction={handleAcceptPendingExtraction}
        onDismissPendingExtraction={handleDismissPendingExtraction}
        onGenerateDraft={handleGenerateDraft}
        onApproveDraftToLesson={handleApproveDraftToLesson}
        onApproveLernstudioSet={handleApproveLernstudioSet}
        onRequestDelete={(entry) => setDeleteTargetEntryId(entry.id)}
      />

      {/* Exceptional Case Resolution Sheet (Review Required ONLY) */}
      <GrainReviewResolveSheet
        entry={activeResolveEntry}
        lessons={lessons}
        groups={groups}
        tr={tr}
        isSubmitting={isResolvingIssue}
        onClose={() => setResolveEntryId(null)}
        onResolveToLesson={handleResolveIssueToLesson}
      />

      {/* Advanced Filters Bottom Sheet */}
      <GrainAdvancedFiltersSheet
        isOpen={showAdvancedFilters}
        tr={tr}
        groups={groups}
        students={students}
        groupFilter={groupFilter}
        studentFilter={studentFilter}
        dateFilter={dateFilter}
        onGroupChange={setGroupFilter}
        onStudentChange={setStudentFilter}
        onDateChange={setDateFilter}
        onClearAll={() => {
          setGroupFilter('all');
          setStudentFilter('all');
          setDateFilter('');
        }}
        onClose={() => setShowAdvancedFilters(false)}
      />

      {/* Destructive Delete Confirmation Dialog */}
      <GrainDeleteConfirmDialog
        entry={activeDeleteEntry}
        tr={tr}
        onCancel={() => setDeleteTargetEntryId(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Linked Group Profile Modal */}
      {viewingGroup && (
        <GroupProfileModal
          group={viewingGroup}
          onClose={() => setViewingGroup(null)}
        />
      )}
    </div>
  );
};
