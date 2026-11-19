import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Users,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  BookOpen,
  Gamepad2,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { GrainEducationalDraft, Group } from '../types';
import { GrainLibraryEntry } from '../services/grainRecordingStatus';

type Translator = (ar: string, en: string, de: string) => string;

interface GrainRecordingDetailsSheetProps {
  entry: GrainLibraryEntry | null;
  tr: Translator;
  isRetrying: boolean;
  isGeneratingDraft: boolean;
  draftError: string | null;
  draftApprovedMessage: string | null;
  activeDraft: GrainEducationalDraft | null;
  editedSummaryAr: string;
  editedHomeworkText: string;
  onEditedSummaryChange: (v: string) => void;
  onEditedHomeworkChange: (v: string) => void;
  onClose: () => void;
  onOpenGroup: (group: Group) => void;
  onRetryProcessing: (entry: GrainLibraryEntry) => void;
  onOpenResolveIssue: (entry: GrainLibraryEntry) => void;
  onAcceptPendingExtraction: (entry: GrainLibraryEntry) => void;
  onDismissPendingExtraction: (entry: GrainLibraryEntry) => void;
  onGenerateDraft: (entry: GrainLibraryEntry) => void;
  onApproveDraftToLesson: (entry: GrainLibraryEntry) => void;
  onApproveLernstudioSet: (entry: GrainLibraryEntry) => void;
  onRequestDelete: (entry: GrainLibraryEntry) => void;
}

export const GrainRecordingDetailsSheet: React.FC<GrainRecordingDetailsSheetProps> = ({
  entry,
  tr,
  isRetrying,
  isGeneratingDraft,
  draftError,
  draftApprovedMessage,
  activeDraft,
  editedSummaryAr,
  editedHomeworkText,
  onEditedSummaryChange,
  onEditedHomeworkChange,
  onClose,
  onOpenGroup,
  onRetryProcessing,
  onOpenResolveIssue,
  onAcceptPendingExtraction,
  onDismissPendingExtraction,
  onGenerateDraft,
  onApproveDraftToLesson,
  onApproveLernstudioSet,
  onRequestDelete
}) => {
  const [showDraftSection, setShowDraftSection] = useState(false);

  useEffect(() => {
    setShowDraftSection(false);
  }, [entry?.id]);

  if (!entry) return null;

  const { recognition, grain, extraction, segments, segmentCount } = entry;
  const extracted = extraction.content;
  const pendingUpdate = extracted?.pendingUpdatedExtraction;

  const recognitionSourceText = (() => {
    switch (recognition.source) {
      case 'active_zoom_id':
        return tr('تعرّف تلقائي عبر معرف Zoom النشط', 'Automatic via active Zoom meeting ID', 'Automatisch über aktive Zoom-Meeting-ID');
      case 'historical_zoom_id':
        return tr('تعرّف تلقائي عبر معرف Zoom التاريخي', 'Automatic via historical Zoom meeting ID', 'Automatisch über historische Zoom-Meeting-ID');
      case 'standardized_topic':
        return tr('تعرّف تلقائي عبر عنوان Zoom القياسي', 'Automatic via standardized Zoom topic', 'Automatisch über standardisierten Zoom-Titel');
      case 'calendar_uid':
        return tr('تعرّف تلقائي عبر معرف تقويم Google', 'Automatic via Google Calendar UID', 'Automatisch über Google-Kalender-UID');
      case 'linked_lesson':
      case 'schedule_session':
        return tr('مرتبط بحصة Glück تلقائياً', 'Automatically associated with Glück session', 'Automatisch mit Glück-Lektion verknüpft');
      default:
        return tr('يتطلب مراجعة', 'Review Required', 'Überprüfung erforderlich');
    }
  })();

  const transcriptLabel = (() => {
    switch (grain.transcriptStatus) {
      case 'available':
        return tr('متاح', 'Available', 'Verfügbar');
      case 'partial':
        return tr('متاح جزئياً', 'Partially available', 'Teilweise verfügbar');
      case 'unavailable':
        return tr('غير متاح في Grain', 'Unavailable', 'Nicht verfügbar');
      default:
        return tr('قيد المعالجة / غير مستورد بعد', 'Pending', 'Ausstehend');
    }
  })();

  const extractionLabel = (() => {
    switch (extraction.status) {
      case 'completed':
        return tr('مكتمل', 'Completed', 'Abgeschlossen');
      case 'partial':
        return tr('مكتمل جزئياً (بانتظار الجزء 2)', 'Partially completed', 'Teilweise abgeschlossen');
      case 'unavailable':
        return tr('غير متاح (لا يوجد نص أو ملاحظات)', 'Unavailable (no transcript or notes)', 'Nicht verfügbar');
      case 'failed':
        return tr('فشلت المعالجة', 'Processing Failed', 'Verarbeitung fehlgeschlagen');
      default:
        return tr('قيد الانتظار', 'Pending', 'Ausstehend');
    }
  })();

  const shareAccessLabel = (() => {
    switch (grain.shareAccess) {
      case 'public_access_verified':
        return tr('عام لولي الأمر (مُتحقّق)', 'Public (verified)', 'Öffentlich verifiziert');
      case 'workspace_only':
        return tr('مساحة العمل فقط', 'Workspace only', 'Nur Workspace');
      case 'restricted':
        return tr('خاص / مقيد', 'Restricted', 'Eingeschränkt');
      case 'link_unavailable':
        return tr('الرابط غير متاح', 'Unavailable', 'Nicht verfügbar');
      default:
        return tr('غير مُتحقّق للمشاركة العامة', 'Unverified public share', 'Freigabe ungeprüft');
    }
  })();

  const canRetry = Boolean(
    recognition.lesson &&
      grain.recordingAvailable &&
      (entry.lifecycleStatus === 'processing_failed' ||
        extraction.status === 'pending' ||
        extraction.status === 'unavailable' ||
        extraction.status === 'partial' ||
        entry.lifecycleStatus === 'pending_part2')
  );

  const unavailableText = tr('غير متاح في هذا التسجيل', 'Unavailable', 'Nicht verfügbar');

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={entry.title}
    >
      <div
        className="w-full md:max-w-2xl max-h-[92dvh] md:max-h-[88vh] rounded-t-3xl md:rounded-2xl bg-surface border-t md:border border-surface-border shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="md:hidden w-10 h-1 bg-surface-border rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Sticky Sheet Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-surface-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-text-main leading-snug break-words">
              {entry.title}
            </h2>
            <p className="text-xs text-text-muted mt-1 tabular-nums">
              {entry.dateYmd} · {entry.startTimeHm} · {entry.totalDurationMinutes}{' '}
              {tr('دقيقة', 'min', 'Min.')}
              {segmentCount === 2
                ? ` · ${tr('مقطعان (الجزء 1 + 2)', '2 segments (Part 1 + 2)', '2 Segmente (Teil 1 + 2)')}`
                : ` · ${tr('مقطع واحد', '1 segment', '1 Segment')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق التفاصيل', 'Close details', 'Details schließen')}
            className="min-h-[44px] min-w-[44px] -me-2 -mt-1 flex items-center justify-center rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Details Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5 text-sm">
          {/* 1. Recording Information */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold text-text-muted">
              {tr('معلومات التسجيل', 'Recording Information', 'Aufzeichnungsinformationen')}
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 border-t border-surface-border/70 pt-2.5">
              <div>
                <dt className="text-xs text-text-muted">{tr('التاريخ والوقت', 'Date & Time', 'Datum & Zeit')}</dt>
                <dd className="text-sm font-medium text-text-main tabular-nums mt-0.5">
                  {entry.dateYmd} · {entry.startTimeHm}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">{tr('المدة الإجمالية', 'Total Duration', 'Gesamtdauer')}</dt>
                <dd className="text-sm font-medium text-text-main tabular-nums mt-0.5">
                  {entry.totalDurationMinutes} {tr('دقيقة', 'min', 'Min.')} ({segmentCount}{' '}
                  {segmentCount === 2
                    ? tr('مقاطع', 'segments', 'Segmente')
                    : tr('مقطع', 'segment', 'Segment')}
                  )
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">{tr('معرف تسجيل Grain', 'Grain Recording ID', 'Grain-ID')}</dt>
                <dd className="text-xs font-mono text-text-main break-all mt-0.5">{entry.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">{tr('هوية اجتماع Zoom', 'Zoom Meeting Identity', 'Zoom-Meeting-Identität')}</dt>
                <dd className="text-sm font-medium text-text-main tabular-nums mt-0.5">
                  {entry.zoomMeetingId ? (
                    <span>
                      {entry.zoomMeetingId}
                      {entry.zoomSourceLabel === 'historical_zoom_id'
                        ? ` · ${tr('معرف تاريخي', 'Historical ID', 'Historische ID')}`
                        : ''}
                    </span>
                  ) : (
                    <span className="text-text-muted font-normal">{unavailableText}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">{tr('حالة رابط ولي الأمر', 'Parent Link Access', 'Eltern-Link-Status')}</dt>
                <dd className="text-sm font-medium text-text-main mt-0.5">{shareAccessLabel}</dd>
              </div>
              {entry.participantNames.length > 0 && (
                <div>
                  <dt className="text-xs text-text-muted">
                    {tr('المشاركون (للعرض فقط)', 'Participants (display only)', 'Teilnehmer (nur Anzeige)')}
                  </dt>
                  <dd className="text-xs text-text-main mt-0.5 break-words">
                    {entry.participantNames.join(' · ')}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* 2. Glück Association */}
          <section className="space-y-2.5 pt-1 border-t border-surface-border">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text-muted">
                {tr('الربط في Glück', 'Glück Association', 'Glück-Zuordnung')}
              </h3>
              {recognition.group && (
                <button
                  type="button"
                  onClick={() => onOpenGroup(recognition.group!)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer min-h-[36px] px-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{tr('فتح المجموعة', 'Open Group', 'Gruppe öffnen')}</span>
                </button>
              )}
            </div>

            {recognition.status === 'recognized' ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <div>
                  <dt className="text-xs text-text-muted">{tr('المجموعة المرتبطة', 'Linked Group', 'Verknüpfte Gruppe')}</dt>
                  <dd className="text-sm font-semibold text-text-main mt-0.5">
                    {recognition.groupName || unavailableText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{tr('الجلسة الأسبوعية', 'Weekly Session', 'Wöchentliche Sitzung')}</dt>
                  <dd className="text-sm font-medium text-text-main mt-0.5">
                    {recognition.session ? (
                      <span className="tabular-nums">
                        {recognition.session.weekdayName} · {recognition.session.startTime} ·{' '}
                        <span className="font-mono text-xs text-text-muted">{recognition.session.sessionCode}</span>
                      </span>
                    ) : recognition.lesson ? (
                      <span className="tabular-nums">
                        {recognition.lesson.date} · {recognition.lesson.time || '—'}
                      </span>
                    ) : (
                      <span className="text-text-muted font-normal">{unavailableText}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{tr('تاريخ ووقت الحصة', 'Lesson Date & Time', 'Unterrichtszeit')}</dt>
                  <dd className="text-sm font-medium text-text-main tabular-nums mt-0.5">
                    {recognition.lesson
                      ? `${recognition.lesson.date} · ${recognition.lesson.time || '—'}`
                      : unavailableText}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{tr('حالة التعرّف', 'Recognition Status', 'Erkennungsstatus')}</dt>
                  <dd className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{recognitionSourceText}</span>
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <div className="font-semibold">
                      {tr('يتطلب مراجعة', 'Review Required', 'Überprüfung erforderlich')}
                    </div>
                    <p className="mt-0.5">{recognition.reviewReasonDetail}</p>
                  </div>
                </div>
                {recognition.status === 'review_required' && (
                  <button
                    type="button"
                    onClick={() => onOpenResolveIssue(entry)}
                    className="min-h-[44px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {tr('تحديد الحصة وحل المشكلة', 'Resolve Issue', 'Problem lösen')}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 3. Grain Processing */}
          <section className="space-y-2.5 pt-1 border-t border-surface-border">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text-muted">
                {tr('معالجة Grain', 'Grain Processing', 'Grain-Verarbeitung')}
              </h3>
              {canRetry && (
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={() => onRetryProcessing(entry)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer min-h-[36px] px-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>{tr('إعادة المعالجة', 'Retry Processing', 'Wiederholen')}</span>
                </button>
              )}
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
              <div>
                <dt className="text-xs text-text-muted">{tr('التسجيل', 'Recording', 'Aufzeichnung')}</dt>
                <dd className="text-sm font-medium text-text-main mt-0.5">
                  {grain.recordingAvailable
                    ? tr('متاح', 'Available', 'Verfügbar')
                    : tr('غير متاح', 'Unavailable', 'Nicht verfügbar')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">{tr('النص (Transcript)', 'Transcript', 'Transkript')}</dt>
                <dd className="text-sm font-medium text-text-main mt-0.5">{transcriptLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">{tr('ملاحظات Grain AI', 'Grain AI Notes', 'Grain KI-Notizen')}</dt>
                <dd className="text-sm font-medium text-text-main mt-0.5">
                  {grain.aiNotesAvailable
                    ? tr('متاحة', 'Available', 'Verfügbar')
                    : tr('غير متاحة', 'Unavailable', 'Nicht verfügbar')}
                </dd>
              </div>
            </dl>

            {grain.processingError && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{grain.processingError}</span>
              </div>
            )}

            {entry.lifecycleStatus === 'pending_part2' && (
              <div className="p-3 rounded-xl border border-surface-border bg-background/70 text-xs text-text-muted flex items-start gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  {tr(
                    'تم استلام الجزء 1 فقط (حوالي 40 دقيقة من Zoom Basic). عند وصول الجزء 2 سيتم إقرانه تلقائياً وإعادة استخراج محتوى الحصة المدمج دون تكرار.',
                    'Only Part 1 (~40 min Zoom Basic segment) has arrived so far. When Part 2 arrives, Glück will pair it automatically and reprocess the combined lesson without creating duplicates.',
                    'Bisher ist nur Teil 1 (~40 Min. Zoom Basic) eingegangen. Sobald Teil 2 eintrifft, werden beide automatisch zusammen verarbeitet.'
                  )}
                </span>
              </div>
            )}
          </section>

          {/* 4. Recording Segments (Part 1 / Part 2) */}
          <section className="space-y-2.5 pt-1 border-t border-surface-border">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {tr('مقاطع التسجيل', 'Recording Segments', 'Aufzeichnungssegmente')} ({segmentCount})
                </span>
              </h3>
              {segmentCount === 2 && entry.part2StartGapMinutes && (
                <span className="text-xs text-text-muted tabular-nums">
                  {tr(
                    `فاصل إعادة الاتصال: +${entry.part2StartGapMinutes} د`,
                    `Reconnect gap: +${entry.part2StartGapMinutes} min`,
                    `Abstand: +${entry.part2StartGapMinutes} Min.`
                  )}
                </span>
              )}
            </div>

            <div className="divide-y divide-surface-border rounded-xl border border-surface-border bg-background/40 overflow-hidden">
              {segments.map((seg, idx) => (
                <div key={seg.recordingId} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-main flex items-center gap-2 flex-wrap">
                      <span>
                        {seg.slot === 'part2'
                          ? tr('الجزء 2', 'Part 2', 'Teil 2')
                          : segmentCount === 2
                          ? tr('الجزء 1', 'Part 1', 'Teil 1')
                          : tr('التسجيل الكامل', 'Single Recording', 'Einzelaufnahme')}
                      </span>
                      <span className="text-xs text-text-muted font-normal tabular-nums">
                        · {seg.durationMinutes} {tr('دقيقة', 'min', 'Min.')}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 truncate">
                      {seg.title}
                    </div>
                    <div className="text-[11px] font-mono text-text-muted/80 mt-0.5 truncate">
                      ID: {seg.recordingId}
                      {seg.zoomMeetingId ? ` · Zoom ${seg.zoomMeetingId}` : ''}
                    </div>
                  </div>
                  {seg.recordingUrl && (
                    <a
                      href={seg.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={tr(
                        `فتح المقطع ${idx + 1} في Grain`,
                        `Open segment ${idx + 1} in Grain`,
                        `Segment ${idx + 1} in Grain öffnen`
                      )}
                      className="min-h-[44px] px-3 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover text-xs font-medium text-text-main flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <span>{tr('Grain', 'Grain', 'Grain')}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 5. Glück Lesson Extraction (7-Section German Structure & Teacher-Edit Protection) */}
          <section className="space-y-3 pt-1 border-t border-surface-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{tr('استخراج محتوى الحصة في Glück', 'Glück Lesson Extraction', 'Glück-Lektionsextraktion')}</span>
              </h3>
              <span className="text-xs font-medium text-text-main">{extractionLabel}</span>
            </div>

            {extraction.teacherEdited && (
              <div className="p-3 rounded-xl border border-surface-border bg-background/70 flex items-center gap-2 text-xs text-text-main">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>
                  {tr(
                    'تم تعديل محتوى هذه الحصة بواسطة المعلم — محمي من الاستبدال التلقائي.',
                    'Teacher-edited lesson content is protected from automatic overwrites.',
                    'Vom Lehrer bearbeiteter Inhalt ist vor automatischem Überschreiben geschützt.'
                  )}
                </span>
              </div>
            )}

            {pendingUpdate && (
              <div className="p-3.5 rounded-xl border border-primary/30 bg-primary-soft space-y-2.5">
                <div className="text-xs font-semibold text-text-main">
                  {tr(
                    'يتوفر استخراج محدث للحصة (مثلاً بعد وصول الجزء 2 أو النص)',
                    'Updated lesson extraction available (e.g., after Part 2 or new transcript)',
                    'Aktualisierte Extraktion verfügbar (z. B. nach Teil 2 oder neuem Transkript)'
                  )}
                </div>
                {pendingUpdate.themaDerStunde && (
                  <p className="text-xs text-text-muted">
                    <strong className="text-text-main">Thema:</strong> {pendingUpdate.themaDerStunde}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAcceptPendingExtraction(entry)}
                    className="min-h-[44px] px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {tr('اعتماد التحديث', 'Apply Updated Extraction', 'Aktualisierung übernehmen')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissPendingExtraction(entry)}
                    className="min-h-[44px] px-3.5 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover text-xs font-medium text-text-main cursor-pointer transition-colors"
                  >
                    {tr('الاحتفاظ بتعديلاتي', 'Keep My Edits', 'Meine Änderungen behalten')}
                  </button>
                </div>
              </div>
            )}

            {extracted && extraction.status !== 'unavailable' && extraction.status !== 'pending' ? (
              <div className="space-y-3 rounded-xl border border-surface-border bg-background/40 p-3.5 text-xs">
                <div>
                  <div className="text-text-muted font-medium">1. Thema der Stunde</div>
                  <div className="text-sm font-semibold text-text-main mt-0.5">
                    {extracted.themaDerStunde || unavailableText}
                  </div>
                </div>

                <div className="border-t border-surface-border/60 pt-2.5">
                  <div className="text-text-muted font-medium">2. Behandelte Inhalte</div>
                  {extracted.behandelteInhalte.length > 0 ? (
                    <ul className="list-disc ps-4 mt-1 space-y-1 text-text-main">
                      {extracted.behandelteInhalte.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-text-muted mt-0.5">{unavailableText}</p>
                  )}
                </div>

                <div className="border-t border-surface-border/60 pt-2.5">
                  <div className="text-text-muted font-medium">3. Neue Wörter und Redemittel</div>
                  {extracted.neueWoerterUndRedemittel.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-text-main">
                      {extracted.neueWoerterUndRedemittel.map((w, idx) => (
                        <li key={idx}>
                          <span className="font-semibold">
                            {w.article ? `${w.article} ` : ''}
                            {w.german}
                          </span>
                          {w.arabic || w.meaning ? ` — ${w.arabic || w.meaning}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-text-muted mt-0.5">{unavailableText}</p>
                  )}
                </div>

                <div className="border-t border-surface-border/60 pt-2.5">
                  <div className="text-text-muted font-medium">4. Grammatik</div>
                  {extracted.grammatik.length > 0 ? (
                    <ul className="mt-1 space-y-1.5 text-text-main">
                      {extracted.grammatik.map((g, idx) => (
                        <li key={idx}>
                          <div className="font-semibold">{g.topic}</div>
                          <div className="text-text-muted">{g.explanationDe || g.explanation || g.explanationAr}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-text-muted mt-0.5">{unavailableText}</p>
                  )}
                </div>

                <div className="border-t border-surface-border/60 pt-2.5">
                  <div className="text-text-muted font-medium">5. Beispiele</div>
                  {extracted.beispiele.length > 0 ? (
                    <ul className="list-disc ps-4 mt-1 space-y-1 text-text-main">
                      {extracted.beispiele.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-text-muted mt-0.5">{unavailableText}</p>
                  )}
                </div>

                <div className="border-t border-surface-border/60 pt-2.5">
                  <div className="text-text-muted font-medium">6. Übungen und Aktivitäten</div>
                  {extracted.uebungenUndAktivitaeten.length > 0 ? (
                    <ul className="list-disc ps-4 mt-1 space-y-1 text-text-main">
                      {extracted.uebungenUndAktivitaeten.map((u, idx) => (
                        <li key={idx}>{u}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-text-muted mt-0.5">{unavailableText}</p>
                  )}
                </div>

                <div className="border-t border-surface-border/60 pt-2.5">
                  <div className="text-text-muted font-medium">7. Offene Punkte</div>
                  {extracted.offenePunkte.length > 0 ? (
                    <ul className="list-disc ps-4 mt-1 space-y-1 text-text-main">
                      {extracted.offenePunkte.map((o, idx) => (
                        <li key={idx}>{o}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-text-muted mt-0.5">{unavailableText}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                {extraction.status === 'unavailable'
                  ? tr(
                      'لم يتوفر نص أو ملاحظات AI في Grain لاستخراج محتوى هذه الحصة بعد.',
                      'No transcript or Grain AI Notes were available yet to extract lesson content.',
                      'Für diese Aufzeichnung sind noch kein Transkript oder KI-Notizen verfügbar.'
                    )
                  : tr(
                      'سيظهر محتوى الحصة المستخرج (البنية المكونة من 7 أقسام) هنا فور توفر النص أو ملاحظات Grain.',
                      'Extracted lesson content (7-section German structure) will appear here once Grain transcript or AI Notes are processed.',
                      'Die 7-teilige Unterrichtsextraktion erscheint hier, sobald Transkript oder KI-Notizen verarbeitet wurden.'
                    )}
              </p>
            )}

            {/* On-demand Teacher Educational Draft & Lernstudio Tool */}
            {grain.recordingAvailable && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowDraftSection((prev) => !prev)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-surface-border bg-background/50 hover:bg-surface-hover flex items-center justify-between text-xs font-medium text-text-main cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {tr(
                        'مسودة الملخص والواجب ومجموعة Lernstudio',
                        'Educational Summary, Homework & Lernstudio Draft',
                        'Zusammenfassung, Hausaufgaben & Lernstudio-Entwurf'
                      )}
                    </span>
                  </span>
                  {showDraftSection ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                </button>

                {showDraftSection && (
                  <div className="mt-2.5 p-3.5 rounded-xl border border-surface-border bg-background/40 space-y-3">
                    <button
                      type="button"
                      disabled={isGeneratingDraft}
                      onClick={() => onGenerateDraft(entry)}
                      className="min-h-[44px] px-4 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {isGeneratingDraft
                        ? tr('جارٍ التوليد...', 'Generating...', 'Wird erstellt...')
                        : tr('توليد مسودة تعليمية', 'Generate Educational Draft', 'Entwurf erstellen')}
                    </button>

                    {draftError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 text-xs">
                        {draftError}
                      </div>
                    )}

                    {draftApprovedMessage && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                        {draftApprovedMessage}
                      </div>
                    )}

                    {activeDraft && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1">
                            {tr('ملخص الحصة (قابل للتعديل)', 'Lesson Summary (Editable)', 'Zusammenfassung (bearbeitbar)')}
                          </label>
                          <textarea
                            rows={2}
                            value={editedSummaryAr}
                            onChange={(e) => onEditedSummaryChange(e.target.value)}
                            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-text-main"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1">
                            {tr('الواجب المقترح', 'Suggested Homework', 'Vorgeschlagene Hausaufgaben')}
                          </label>
                          <textarea
                            rows={2}
                            value={editedHomeworkText}
                            onChange={(e) => onEditedHomeworkChange(e.target.value)}
                            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-text-main"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {recognition.lesson && (
                            <button
                              type="button"
                              onClick={() => onApproveDraftToLesson(entry)}
                              className="min-h-[44px] px-3.5 rounded-xl border border-primary-border bg-primary-soft hover:bg-primary/15 text-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>{tr('حفظ في سجل الحصة', 'Save to Lesson', 'Im Unterricht speichern')}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onApproveLernstudioSet(entry)}
                            className="min-h-[44px] px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Gamepad2 className="w-3.5 h-3.5" />
                            <span>{tr('إنشاء مجموعة Lernstudio', 'Create Lernstudio Set', 'Lernstudio-Set erstellen')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Sticky Safe-Area Footer Actions */}
        <div className="px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,12px))] border-t border-surface-border bg-surface flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onRequestDelete(entry)}
            className="min-h-[44px] px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>{tr('حذف', 'Delete', 'Löschen')}</span>
          </button>

          <div className="flex items-center gap-2">
            {entry.primaryRecording.recordingUrl && (
              <a
                href={entry.primaryRecording.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-xs font-semibold text-text-main flex items-center gap-1.5 transition-colors"
              >
                <span>{tr('فتح في Grain', 'Open in Grain', 'In Grain öffnen')}</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold cursor-pointer transition-colors"
            >
              {tr('تم', 'Done', 'Fertig')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
