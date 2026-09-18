import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  CheckSquare,
  Square,
  Search,
  User,
  Calendar,
  Layers,
  Loader2,
  Eye,
  AlertCircle,
  FileText
} from 'lucide-react';
import { VisitRecord, SchoolSettings, Teacher } from '../types';
import {
  downloadCombinedObservationReportsPdf,
  printCombinedObservationReports,
  printObservationReport
} from '../utils/printObservationUtils';

interface BulkObservationExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitRecords: VisitRecord[];
  teachers: Teacher[];
  schoolSettings: SchoolSettings;
  language: string;
  initialTeacherId?: string;
  onPreviewSingle?: (visit: VisitRecord) => void;
}

export const BulkObservationExportModal: React.FC<BulkObservationExportModalProps> = ({
  isOpen,
  onClose,
  visitRecords,
  teachers,
  schoolSettings,
  language,
  initialTeacherId,
  onPreviewSingle
}) => {
  const isRtl = language === 'ar';
  const _t = (ar: string, en: string, de: string) => {
    if (language === 'ar') return ar;
    if (language === 'de') return de;
    return en;
  };

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(initialTeacherId || 'all');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVisitIds, setSelectedVisitIds] = useState<Set<string>>(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Available terms from visits or settings
  const termsList = useMemo(() => {
    const set = new Set<string>();
    if (schoolSettings.currentTerm) set.add(schoolSettings.currentTerm);
    visitRecords.forEach(v => {
      if (v.term) set.add(v.term);
    });
    return Array.from(set);
  }, [visitRecords, schoolSettings.currentTerm]);

  // Filtered visits based on controls
  const filteredVisits = useMemo(() => {
    return visitRecords.filter(v => {
      // Teacher filter
      if (selectedTeacherId !== 'all') {
        const t = teachers.find(item => item.id === selectedTeacherId);
        const matchId = v.teacherId === selectedTeacherId;
        const matchName = t && v.teacherName === t.name;
        if (!matchId && !matchName) return false;
      }

      // Term filter
      if (selectedTerm !== 'all') {
        if (v.term && v.term !== selectedTerm) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const teacherMatch = (v.teacherName || '').toLowerCase().includes(q);
        const classMatch = (v.className || '').toLowerCase().includes(q);
        const notesMatch = (v.consolidatedNotes || '').toLowerCase().includes(q);
        const catMatch = (v.overallCategory || '').toLowerCase().includes(q);
        if (!teacherMatch && !classMatch && !notesMatch && !catMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.visitedDate || a.date || 0).getTime();
      const dateB = new Date(b.visitedDate || b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [visitRecords, teachers, selectedTeacherId, selectedTerm, searchQuery]);

  // Handle Initial selection on filter change or mount
  React.useEffect(() => {
    if (isOpen && filteredVisits.length > 0) {
      setSelectedVisitIds(new Set(filteredVisits.map(v => v.id)));
    }
  }, [isOpen, selectedTeacherId, selectedTerm]);

  const toggleSelectVisit = (id: string) => {
    setSelectedVisitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedVisitIds.size === filteredVisits.length) {
      setSelectedVisitIds(new Set());
    } else {
      setSelectedVisitIds(new Set(filteredVisits.map(v => v.id)));
    }
  };

  const selectedVisitsList = useMemo(() => {
    return filteredVisits.filter(v => selectedVisitIds.has(v.id));
  }, [filteredVisits, selectedVisitIds]);

  // Combined PDF download handler
  const handleDownloadCombinedPdf = async () => {
    if (selectedVisitsList.length === 0 || isExportingPdf) return;

    try {
      setIsExportingPdf(true);
      setExportProgress({ current: 1, total: selectedVisitsList.length });

      await downloadCombinedObservationReportsPdf(
        selectedVisitsList,
        schoolSettings,
        isRtl,
        language,
        (current, total) => {
          setExportProgress({ current, total });
        }
      );
    } catch (err) {
      console.error('Failed to download combined PDF:', err);
    } finally {
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  // Combined Print handler
  const handlePrintCombined = async () => {
    if (selectedVisitsList.length === 0 || isPrinting) return;

    try {
      setIsPrinting(true);
      await printCombinedObservationReports(
        selectedVisitsList,
        schoolSettings,
        isRtl,
        language
      );
    } catch (err) {
      console.error('Failed to print combined reports:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col border border-surface-border animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Compact on mobile */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-surface-border flex items-center justify-between bg-surface-hover/50 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-black text-text-main truncate">
                {_t('تصدير وطباعة تقارير الزيارات', 'Bulk Observation Reports Export', 'Sammeldruck von Besuchen')}
              </h2>
              <p className="text-[10px] text-text-muted hidden sm:block truncate">
                {_t('دمج تقارير الزيارات في ملف PDF واحد متصل أو طباعتها دفعة واحدة', 'Merge observation reports into a single PDF or batch print', 'Berichte zusammenführen oder drucken')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 sm:p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg sm:rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Filter Controls Bar - Compact Responsive Grid */}
        <div className="p-2 sm:p-3 bg-surface border-b border-surface-border space-y-2 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Teacher Selector */}
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-text-muted uppercase mb-0.5 flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-primary shrink-0" />
                <span>{_t('المعلم', 'Teacher', 'Lehrkraft')}</span>
              </label>
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="w-full bg-surface-hover border border-surface-border rounded-lg px-2 py-1 text-xs text-text-main font-bold focus:outline-none focus:border-primary truncate"
              >
                <option value="all">{_t('جميع المعلمين', 'All Teachers', 'Alle Lehrkräfte')}</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Term Selector */}
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-text-muted uppercase mb-0.5 flex items-center gap-1 truncate">
                <Calendar className="w-3 h-3 text-primary shrink-0" />
                <span>{_t('الفصل الدراسي', 'Term', 'Halbjahr')}</span>
              </label>
              <select
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                className="w-full bg-surface-hover border border-surface-border rounded-lg px-2 py-1 text-xs text-text-main font-bold focus:outline-none focus:border-primary truncate"
              >
                <option value="all">{_t('جميع الفصول', 'All Terms', 'Alle')}</option>
                {termsList.map(term => (
                  <option key={term} value={term}>{term}</option>
                ))}
              </select>
            </div>

            {/* Search Query - Full width on mobile row 2, 3rd column on desktop */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[9px] sm:text-[10px] font-black text-text-muted uppercase mb-0.5 flex items-center gap-1">
                <Search className="w-3 h-3 text-primary shrink-0" />
                <span>{_t('بحث سريع', 'Search', 'Suche')}</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={_t('اسم المعلم، الفصل، الملاحظات...', 'Teacher, class, notes...', 'Suche...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-hover border border-surface-border rounded-lg px-2 py-1 text-xs text-text-main font-medium focus:outline-none focus:border-primary pl-7 rtl:pl-2 rtl:pr-7"
                />
                <Search className="w-3 h-3 text-text-muted absolute top-2 left-2 rtl:left-auto rtl:right-2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Selection Stats and Select All Button */}
        <div className="px-3 py-1.5 bg-surface-hover/40 border-b border-surface-border flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-text-main hover:text-primary transition-colors cursor-pointer"
            >
              {selectedVisitIds.size === filteredVisits.length && filteredVisits.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4 text-text-muted" />
              )}
              <span>
                {selectedVisitIds.size === filteredVisits.length && filteredVisits.length > 0
                  ? _t('إلغاء التحديد', 'Deselect All', 'Abwählen')
                  : _t('تحديد الكل', 'Select All', 'Alle auswählen')}
              </span>
            </button>

            <span className="text-[11px] text-text-muted">
              ({_t('المحدد:', 'Selected:', 'Ausgewählt:')}{' '}
              <strong className="text-primary font-black">{selectedVisitsList.length}</strong>{' '}
              {_t('من', 'of', 'von')}{' '}
              <strong className="text-text-main font-bold">{filteredVisits.length}</strong>)
            </span>
          </div>

          {selectedVisitsList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {_t('المتوسط:', 'Avg:', 'Ø:')}{' '}
                {(selectedVisitsList.reduce((acc, v) => acc + (Number(v.overallScore) || 0), 0) / selectedVisitsList.length).toFixed(1)}/75
              </span>
            </div>
          )}
        </div>

        {/* Visits List - Maximized vertical viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-1.5">
          {filteredVisits.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-1.5 text-text-muted">
              <AlertCircle className="w-8 h-8 text-text-muted/40" />
              <p className="text-xs font-bold">
                {_t('لا توجد تقارير زيارات مطابقة للشروط الحالية', 'No visit reports matching current filters', 'Keine passenden Besuchsberichte')}
              </p>
              <p className="text-[11px]">
                {_t('جرب تغيير خيارات الفلترة أو المعلم', 'Try adjusting your filters', 'Filter anpassen')}
              </p>
            </div>
          ) : (
            filteredVisits.map((visit) => {
              const isSelected = selectedVisitIds.has(visit.id);
              const visitedDateFormatted = new Date(visit.visitedDate || visit.date || Date.now()).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
              });

              return (
                <div
                  key={visit.id}
                  onClick={() => toggleSelectVisit(visit.id)}
                  className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-primary/5 border-primary/50 shadow-2xs'
                      : 'bg-surface hover:bg-surface-hover border-surface-border'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="text-primary shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-text-muted hover:text-text-main" />
                      )}
                    </div>

                    <div className="space-y-0.5 min-w-0 flex-1">
                      {/* Line 1: Teacher, Class, Score, Category */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-text-main truncate max-w-[150px] sm:max-w-none">
                          {visit.teacherName}
                        </span>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-surface-hover border border-surface-border text-text-muted shrink-0">
                          {visit.className}
                        </span>
                        <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded border border-primary/20 bg-primary/10 text-primary shrink-0">
                          {visit.overallScore || '-'}/75
                        </span>
                        {visit.overallCategory && (
                          <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-surface border border-surface-border text-text-muted shrink-0 hidden sm:inline-block">
                            {visit.overallCategory}
                          </span>
                        )}
                      </div>

                      {/* Line 2: Date & Period */}
                      <div className="text-[10px] text-text-muted flex items-center gap-1.5 flex-wrap">
                        <span>📅 {visitedDateFormatted}</span>
                        <span>•</span>
                        <span>⏰ {_t('حصة', 'P.', 'Std.')} {visit.periodNumber || '-'}</span>
                        {visit.term && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[100px]">{visit.term}</span>
                          </>
                        )}
                      </div>

                      {/* Line 3: Single compact notes line as requested */}
                      {visit.consolidatedNotes && (
                        <div className="text-[9.5px] text-text-muted truncate max-w-full italic flex items-center gap-1 opacity-80">
                          <FileText className="w-2.5 h-2.5 shrink-0 text-text-muted/60" />
                          <span className="truncate">{visit.consolidatedNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Individual Actions */}
                  <div
                    className="flex items-center gap-1 shrink-0 self-end sm:self-auto pt-0.5 sm:pt-0"
                    onClick={e => e.stopPropagation()}
                  >
                    {onPreviewSingle && (
                      <button
                        onClick={() => onPreviewSingle(visit)}
                        className="h-7 px-2 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        title={_t('معاينة فردية', 'Preview', 'Vorschau')}
                      >
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">{_t('معاينة', 'Preview', 'Vorschau')}</span>
                      </button>
                    )}
                    <button
                      onClick={() => printObservationReport(visit, schoolSettings, isRtl, language)}
                      className="h-7 px-2 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:border-indigo-800 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      title={_t('طباعة هذا التقرير فقط', 'Print This Only', 'Nur diesen drucken')}
                    >
                      <Printer className="w-3 h-3" />
                      <span className="hidden sm:inline">{_t('طباعة', 'Print', 'Drucken')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Progress notification during PDF generation */}
        {isExportingPdf && exportProgress && (
          <div className="p-2 bg-primary/10 border-t border-primary/20 flex items-center justify-between gap-2 text-xs text-primary font-bold shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <span className="truncate">
                {_t(
                  `جاري إنشاء PDF... صفحة ${exportProgress.current} من ${exportProgress.total}`,
                  `Generating PDF... Page ${exportProgress.current} of ${exportProgress.total}`,
                  `PDF wird erstellt... Seite ${exportProgress.current} von ${exportProgress.total}`
                )}
              </span>
            </div>
            <span className="font-mono text-xs shrink-0">{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
          </div>
        )}

        {/* Footer Actions - Compact & Mobile-Friendly */}
        <div className="p-2.5 sm:p-3 border-t border-surface-border bg-surface-hover/40 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-text-muted hidden sm:block truncate">
            {_t('كل تقرير في صفحة A4 منفصلة داخل نفس ملف الـ PDF', 'Each report on separate A4 page in the PDF', 'Jeder Bericht auf separater A4-Seite')}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="h-9 px-3 text-xs font-bold text-text-muted hover:text-text-main bg-surface hover:bg-surface-hover border border-surface-border rounded-xl transition-all cursor-pointer shrink-0"
            >
              {_t('إغلاق', 'Close', 'Schließen')}
            </button>

            <button
              onClick={handlePrintCombined}
              disabled={selectedVisitsList.length === 0 || isPrinting || isExportingPdf}
              className="h-9 px-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/70 dark:border-indigo-800 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 disabled:pointer-events-none shrink-0"
              title={_t('طباعة التقارير المحددة', 'Print Selected', 'Drucken')}
            >
              {isPrinting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              )}
              <span>{_t(`طباعة (${selectedVisitsList.length})`, `Print (${selectedVisitsList.length})`, `Drucken (${selectedVisitsList.length})`)}</span>
            </button>

            <button
              onClick={handleDownloadCombinedPdf}
              disabled={selectedVisitsList.length === 0 || isExportingPdf || isPrinting}
              className="h-9 px-3.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex-1 sm:flex-initial truncate"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Download className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">
                {isExportingPdf
                  ? _t('جاري التوليد...', 'Generating...', 'Wird generiert...')
                  : _t(
                      `تحميل PDF (${selectedVisitsList.length})`,
                      `Download PDF (${selectedVisitsList.length})`,
                      `PDF herunterladen (${selectedVisitsList.length})`
                    )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
