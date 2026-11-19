import React, { useMemo, useState } from 'react';
import {
  X,
  Eye,
  ExternalLink,
  Users,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Search,
  Check,
  SlidersHorizontal
} from 'lucide-react';
import { Group, Lesson, Student } from '../types';
import { GrainLibraryEntry } from '../services/grainRecordingStatus';

type Translator = (ar: string, en: string, de: string) => string;

interface OverflowSheetProps {
  entry: GrainLibraryEntry | null;
  tr: Translator;
  isRetrying: boolean;
  onClose: () => void;
  onViewDetails: (entry: GrainLibraryEntry) => void;
  onOpenGroup: (group: Group) => void;
  onRetryProcessing: (entry: GrainLibraryEntry) => void;
  onRequestDelete: (entry: GrainLibraryEntry) => void;
}

export const GrainOverflowActionSheet: React.FC<OverflowSheetProps> = ({
  entry,
  tr,
  isRetrying,
  onClose,
  onViewDetails,
  onOpenGroup,
  onRetryProcessing,
  onRequestDelete
}) => {
  if (!entry) return null;

  const hasAction = (kind: GrainLibraryEntry['secondaryActions'][number]) =>
    entry.secondaryActions.includes(kind);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr('خيارات التسجيل', 'Recording actions', 'Aufzeichnungsaktionen')}
    >
      <div
        className="w-full md:max-w-sm rounded-t-3xl md:rounded-2xl bg-surface border-t md:border border-surface-border shadow-xl overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom,16px))] md:pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1" />

        <div className="px-4 py-3 border-b border-surface-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-main leading-snug line-clamp-2">
              {entry.title}
            </h3>
            <p className="text-xs text-text-muted mt-0.5 tabular-nums">
              {entry.dateYmd} · {entry.startTimeHm} · {entry.totalDurationMinutes}{' '}
              {tr('دقيقة', 'min', 'Min.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق', 'Close', 'Schließen')}
            className="min-h-[44px] min-w-[44px] -me-2 -mt-1 flex items-center justify-center rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2 divide-y divide-surface-border/60">
          <div className="space-y-0.5 pb-1.5">
            {hasAction('view_details') && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewDetails(entry);
                }}
                className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-start text-sm font-medium text-text-main hover:bg-surface-hover active:bg-surface-hover cursor-pointer transition-colors"
              >
                <Eye className="w-4 h-4 text-text-muted shrink-0" />
                <span>{tr('عرض تفاصيل التسجيل', 'View Recording Details', 'Aufzeichnungsdetails anzeigen')}</span>
              </button>
            )}

            {hasAction('open_in_grain') && entry.primaryRecording.recordingUrl && (
              <a
                href={entry.primaryRecording.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-start text-sm font-medium text-text-main hover:bg-surface-hover active:bg-surface-hover transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-text-muted shrink-0" />
                <span>{tr('فتح في Grain', 'Open in Grain', 'In Grain öffnen')}</span>
              </a>
            )}

            {hasAction('open_linked_group') && entry.recognition.group && (
              <button
                type="button"
                onClick={() => {
                  const grp = entry.recognition.group!;
                  onClose();
                  onOpenGroup(grp);
                }}
                className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-start text-sm font-medium text-text-main hover:bg-surface-hover active:bg-surface-hover cursor-pointer transition-colors"
              >
                <Users className="w-4 h-4 text-text-muted shrink-0" />
                <span className="truncate">
                  {tr('فتح المجموعة المرتبطة', 'Open Linked Group', 'Verknüpfte Gruppe öffnen')} ·{' '}
                  {entry.recognition.group.name}
                </span>
              </button>
            )}

            {hasAction('retry_processing') && (
              <button
                type="button"
                disabled={isRetrying}
                onClick={() => {
                  onClose();
                  onRetryProcessing(entry);
                }}
                className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-start text-sm font-medium text-text-main hover:bg-surface-hover active:bg-surface-hover disabled:opacity-50 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-text-muted shrink-0 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{tr('إعادة معالجة التسجيل', 'Retry Processing', 'Verarbeitung wiederholen')}</span>
              </button>
            )}
          </div>

          {hasAction('delete_recording') && (
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestDelete(entry);
                }}
                className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-start text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/15 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>{tr('حذف التسجيل من المكتبة', 'Delete Recording', 'Aufzeichnung löschen')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmDialogProps {
  entry: GrainLibraryEntry | null;
  tr: Translator;
  onCancel: () => void;
  onConfirm: (entry: GrainLibraryEntry) => void;
}

export const GrainDeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  entry,
  tr,
  onCancel,
  onConfirm
}) => {
  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="grain-delete-dialog-title"
    >
      <div
        className="w-full md:max-w-md rounded-t-3xl md:rounded-2xl bg-surface border-t md:border border-surface-border shadow-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,16px))] md:pb-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="grain-delete-dialog-title" className="text-base font-semibold text-text-main">
              {tr('حذف التسجيل من مكتبة Glück؟', 'Remove recording from Glück?', 'Aufzeichnung aus Glück entfernen?')}
            </h3>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">
              {tr(
                `سيتم إزالة "${entry.title}" من مكتبة Glück المحلية فقط. سيبقى التسجيل محفوظاً في حساب Grain الخاص بك ولن يتم حذف أي بيانات حصص أو حضور.`,
                `"${entry.title}" will be removed from the local Glück library only. The recording remains safe in your Grain account and no lesson or attendance data is deleted.`,
                `"${entry.title}" wird nur aus der lokalen Glück-Bibliothek entfernt. Die Aufzeichnung bleibt in Ihrem Grain-Konto erhalten.`
              )}
            </p>
            {entry.segmentCount === 2 && (
              <p className="text-xs text-text-muted mt-1.5">
                {tr(
                  'يتضمن هذا العنصر مقطعين (الجزء 1 والجزء 2) وسيتم إزالة كليهما من القائمة المحلية.',
                  'This lesson contains 2 recording segments (Part 1 & Part 2); both segments will be removed from the local list.',
                  'Diese Lektion enthält 2 Segmente (Teil 1 & Teil 2); beide werden aus der lokalen Liste entfernt.'
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-surface-border">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-sm font-medium text-text-main cursor-pointer transition-colors"
          >
            {tr('إلغاء', 'Cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(entry)}
            className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold cursor-pointer transition-colors"
          >
            {tr('حذف من المكتبة', 'Delete Recording', 'Aufzeichnung löschen')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdvancedFiltersSheetProps {
  isOpen: boolean;
  tr: Translator;
  groups: Group[];
  students: Student[];
  groupFilter: string;
  studentFilter: string;
  dateFilter: string;
  onGroupChange: (val: string) => void;
  onStudentChange: (val: string) => void;
  onDateChange: (val: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export const GrainAdvancedFiltersSheet: React.FC<AdvancedFiltersSheetProps> = ({
  isOpen,
  tr,
  groups,
  students,
  groupFilter,
  studentFilter,
  dateFilter,
  onGroupChange,
  onStudentChange,
  onDateChange,
  onClearAll,
  onClose
}) => {
  if (!isOpen) return null;

  const activeGroups = groups.filter((g) => !g.deleted);
  const activeStudents = students.filter((s) => !s.deleted);
  const hasAny = groupFilter !== 'all' || studentFilter !== 'all' || Boolean(dateFilter);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr('تصفية متقدمة', 'Filter recordings', 'Aufzeichnungen filtern')}
    >
      <div
        className="w-full md:max-w-md rounded-t-3xl md:rounded-2xl bg-surface border-t md:border border-surface-border shadow-xl overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom,16px))] md:pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1" />

        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-text-main">
              {tr('تصفية التسجيلات', 'Filter Recordings', 'Aufzeichnungen filtern')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق', 'Close', 'Schließen')}
            className="min-h-[44px] min-w-[44px] -me-2 flex items-center justify-center rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              {tr('المجموعة', 'Group', 'Gruppe')}
            </label>
            <select
              value={groupFilter}
              onChange={(e) => onGroupChange(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-surface-border bg-background text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">{tr('كل المجموعات', 'All Groups', 'Alle Gruppen')}</option>
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              {tr('الطالب', 'Student', 'Schüler')}
            </label>
            <select
              value={studentFilter}
              onChange={(e) => onStudentChange(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-surface-border bg-background text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">{tr('كل الطلاب', 'All Students', 'Alle Schüler')}</option>
              {activeStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              {tr('التاريخ', 'Date', 'Datum')}
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-surface-border bg-background text-sm text-text-main tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="px-4 pt-2 flex items-center justify-between gap-2 border-t border-surface-border">
          <button
            type="button"
            disabled={!hasAny}
            onClick={onClearAll}
            className="min-h-[44px] px-3.5 rounded-xl text-sm font-medium text-text-muted hover:text-text-main disabled:opacity-40 cursor-pointer"
          >
            {tr('مسح الفلاتر', 'Clear Filters', 'Filter zurücksetzen')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold cursor-pointer transition-colors"
          >
            {tr('تطبيق', 'Apply', 'Anwenden')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ReviewResolveSheetProps {
  entry: GrainLibraryEntry | null;
  lessons: Lesson[];
  groups: Group[];
  tr: Translator;
  isSubmitting: boolean;
  onClose: () => void;
  onResolveToLesson: (entry: GrainLibraryEntry, targetLessonId: string) => Promise<void>;
}

/**
 * Contextual resolution drawer shown ONLY when a recording genuinely requires review
 * (conflicting identifiers, ambiguous overlapping sessions, or unrecognized legacy recording).
 */
export const GrainReviewResolveSheet: React.FC<ReviewResolveSheetProps> = ({
  entry,
  lessons,
  groups,
  tr,
  isSubmitting,
  onClose,
  onResolveToLesson
}) => {
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [lessonSearch, setLessonSearch] = useState('');

  const availableLessons = useMemo(() => {
    if (!entry) return [];
    const q = lessonSearch.trim().toLowerCase();
    return lessons
      .filter((l) => l && !l.deleted && l.status !== 'cancelled')
      .filter((l) => {
        if (!q) return true;
        return (
          (l.date || '').toLowerCase().includes(q) ||
          (l.groupName || '').toLowerCase().includes(q) ||
          (l.studentName || '').toLowerCase().includes(q) ||
          (l.title || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Prioritize same-date lessons first
        const aSameDate = a.date === entry.dateYmd ? 1 : 0;
        const bSameDate = b.date === entry.dateYmd ? 1 : 0;
        if (aSameDate !== bSameDate) return bSameDate - aSameDate;
        return (b.date || '').localeCompare(a.date || '');
      })
      .slice(0, 60);
  }, [entry, lessons, lessonSearch]);

  if (!entry) return null;

  const localizedReason = (() => {
    switch (entry.recognition.reviewReasonCode) {
      case 'conflicting_identifiers':
        return tr(
          'تعارض في معرفات الاجتماع بين رابط Zoom وعنوان التسجيل أو موعد الحصة. اختر الحصة الصحيحة يدوياً لمنع الربط الخاطئ.',
          'Identifiers conflict between the Zoom meeting ID, recording topic, or scheduled session. Choose the correct lesson to avoid a wrong assignment.',
          'Konflikt zwischen Zoom-Meeting-ID, Titel oder geplantem Termin. Wählen Sie die richtige Lektion aus.'
        );
      case 'multiple_candidates':
        return tr(
          'تتداخل عدة حصص مجدولة في نفس وقت هذا التسجيل دون معرف Zoom فريد.',
          'Multiple scheduled lessons overlap this recording window without a unique Zoom meeting ID.',
          'Mehrere geplante Lektionen überschneiden sich ohne eindeutige Zoom-Meeting-ID.'
        );
      case 'ambiguous_segment':
        return tr(
          'يتداخل هذا المقطع مع موعد حصة أخرى مجدولة وتعذر إقرانه تلقائياً كجزء ثانٍ.',
          'This segment overlaps another scheduled lesson and could not be paired automatically as Part 2.',
          'Dieses Segment überschneidet sich mit einer anderen Lektion und konnte nicht automatisch als Teil 2 zugeordnet werden.'
        );
      case 'slot_overwrite_conflict':
        return tr(
          'الحصة المستهدفة مرتبطة بالفعل بتسجيل آخر. راجع الحصة قبل الاستبدال.',
          'The target lesson already has a linked recording. Review before replacing it.',
          'Die Ziel-Lektion hat bereits eine verknüpfte Aufzeichnung. Bitte vor dem Ersetzen prüfen.'
        );
      case 'schedule_changed':
        return tr(
          'وقت هذا التسجيل يختلف عن الموعد الأسبوعي المعتاد للمجموعة.',
          'This recording time differs from the group’s usual weekly schedule.',
          'Die Aufnahmezeit weicht vom regulären Wochenplan der Gruppe ab.'
        );
      default:
        return tr(
          'لم يُعثر على معرف اجتماع Zoom قياسي أو سجل تاريخي مطابق لهذا التسجيل القديم أو الخارجي.',
          'No standardized Zoom meeting ID or historical meeting mapping matched this external or legacy recording.',
          'Keine standardisierte Zoom-Meeting-ID oder historische Zuordnung für diese Aufzeichnung gefunden.'
        );
    }
  })();

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/55 backdrop-blur-[2px] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr('حل حالة المراجعة المطلوبة', 'Resolve Review Required', 'Überprüfung klären')}
    >
      <div
        className="w-full md:max-w-lg max-h-[88dvh] rounded-t-3xl md:rounded-2xl bg-surface border-t md:border border-surface-border shadow-xl flex flex-col overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom,12px))] md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        <div className="px-4 py-3 border-b border-surface-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-main">
              {tr('مراجعة التسجيل وتحديد الحصة', 'Resolve Recording Issue', 'Aufzeichnung zuordnen')}
            </h3>
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{entry.title}</p>
            <p className="text-xs text-text-muted tabular-nums mt-0.5">
              {entry.dateYmd} · {entry.startTimeHm} · {entry.totalDurationMinutes}{' '}
              {tr('دقيقة', 'min', 'Min.')}
              {entry.zoomMeetingId ? ` · Zoom ${entry.zoomMeetingId}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق', 'Close', 'Schließen')}
            className="min-h-[44px] min-w-[44px] -me-2 -mt-1 flex items-center justify-center rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <div className="font-semibold mb-0.5">
                {tr('لماذا يتطلب هذا التسجيل مراجعة؟', 'Why review is required', 'Warum eine Prüfung nötig ist')}
              </div>
              <p>{localizedReason}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-muted">
              {tr('اختر الحصة الصحيحة لربط التسجيل:', 'Select the correct lesson:', 'Passende Lektion auswählen:')}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
              <input
                type="text"
                value={lessonSearch}
                onChange={(e) => setLessonSearch(e.target.value)}
                placeholder={tr(
                  'بحث بالتاريخ أو اسم المجموعة...',
                  'Search by date or group name...',
                  'Nach Datum oder Gruppe suchen...'
                )}
                className="w-full min-h-[44px] ps-9 pe-3 rounded-xl border border-surface-border bg-background text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="border border-surface-border rounded-xl divide-y divide-surface-border max-h-60 overflow-y-auto bg-background/50">
              {availableLessons.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted">
                  {tr('لا توجد حصص مطابقة للبحث.', 'No matching lessons found.', 'Keine passenden Lektionen gefunden.')}
                </div>
              ) : (
                availableLessons.map((lesson) => {
                  const grp = groups.find((g) => g.id === lesson.groupId);
                  const isSelected = selectedLessonId === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`w-full min-h-[48px] px-3 py-2.5 text-start flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary-soft text-primary'
                          : 'hover:bg-surface-hover text-text-main'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {grp?.name || lesson.groupName || lesson.studentName || lesson.title}
                        </div>
                        <div className="text-xs text-text-muted tabular-nums">
                          {lesson.date} · {lesson.time || '—'}
                          {lesson.date === entry.dateYmd
                            ? ` · ${tr('نفس التاريخ', 'Same date', 'Gleiches Datum')}`
                            : ''}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-surface-border flex items-center justify-end gap-2 shrink-0 bg-surface">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-surface-border bg-background hover:bg-surface-hover text-sm font-medium text-text-main cursor-pointer"
          >
            {tr('إلغاء', 'Cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            disabled={!selectedLessonId || isSubmitting}
            onClick={async () => {
              if (!selectedLessonId) return;
              await onResolveToLesson(entry, selectedLessonId);
              setSelectedLessonId('');
              setLessonSearch('');
            }}
            className="min-h-[44px] px-4 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold cursor-pointer transition-colors"
          >
            {isSubmitting
              ? tr('جارٍ الحفظ...', 'Saving...', 'Wird gespeichert...')
              : tr('حفظ وربط الحصة', 'Assign Lesson', 'Lektion zuweisen')}
          </button>
        </div>
      </div>
    </div>
  );
};
