import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, Download, Share2, FileText, Image as ImageIcon, Sparkles, 
  CheckCircle2, AlertCircle, Loader2, Printer, Palette, Info,
  Calendar as CalendarIcon, Clock
} from 'lucide-react';
import { 
  exportSchoolScheduleAsImage, 
  exportSchoolScheduleAsPdf, 
  exportSchoolScheduleAsIcs,
  shareSchoolSchedule, 
  SchoolScheduleExportFormat, 
  SchoolScheduleExportTheme,
  buildSchoolScheduleExportModel
} from '../services/schoolScheduleExportService';
import { getSchoolSettings } from '../utils/schoolUtils';

interface SchoolScheduleExportModalProps {
  onClose: () => void;
}

export const SchoolScheduleExportModal: React.FC<SchoolScheduleExportModalProps> = ({ onClose }) => {
  const { profile, _t, language } = useApp();
  const schoolSettings = getSchoolSettings(profile);

  const [selectedFormat, setSelectedFormat] = useState<SchoolScheduleExportFormat>('pdf');
  const [selectedTheme, setSelectedTheme] = useState<SchoolScheduleExportTheme>('clean_light');
  const [includePresenceInIcs, setIncludePresenceInIcs] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Quick export model preview stats
  const previewModel = React.useMemo(() => {
    return buildSchoolScheduleExportModel(schoolSettings, profile, {
      language: language as any,
      theme: selectedTheme
    });
  }, [schoolSettings, profile, language, selectedTheme]);

  const handleExecuteSave = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorFeedback(null);
    setStatusMessage(_t('جاري إعداد الجدول للتصدير...', 'Preparing schedule for export...', 'Stundenplan wird vorbereitet...'));

    try {
      const options = {
        format: selectedFormat,
        theme: selectedTheme,
        language: language as any,
        includeSchoolTimes: includePresenceInIcs
      };

      if (selectedFormat === 'ics') {
        setStatusMessage(_t('جاري إنشاء ملف التقويم .ics...', 'Generating calendar .ics file...', 'ICS-Kalenderdatei wird erstellt...'));
        const result = await exportSchoolScheduleAsIcs(schoolSettings, profile, options);
        if (!result.success) {
          throw new Error(result.error || 'Failed to export ICS');
        }
      } else if (selectedFormat === 'pdf') {
        setStatusMessage(_t('جاري إنشاء مستند PDF عالي الجودة...', 'Generating high quality PDF...', 'Hochwertiges PDF wird erstellt...'));
        const result = await exportSchoolScheduleAsPdf(schoolSettings, profile, options);
        if (!result.success) {
          throw new Error(result.error || 'Failed to export PDF');
        }
      } else {
        setStatusMessage(_t('جاري معالجة الصورة بجودة عالية...', 'Rendering high resolution image...', 'Bild wird in hoher Qualität gerendert...'));
        const result = await exportSchoolScheduleAsImage(schoolSettings, profile, options);
        if (!result.success) {
          throw new Error(result.error || 'Failed to export image');
        }
      }

      setSuccessToast(_t('تم تجهيز الملف وحفظه بنجاح!', 'File created and saved successfully!', 'Datei erfolgreich gespeichert!'));
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[Export School Schedule Error]:', err);
      setErrorFeedback(_t(
        'تعذر إنشاء ملف التصدير. يرجى المحاولة مرة أخرى.',
        'Failed to generate export file. Please try again.',
        'Fehler beim Erstellen der Exportdatei. Bitte erneut versuchen.'
      ));
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const handleExecuteShare = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorFeedback(null);
    setStatusMessage(_t('جاري تجهيز الملف للمشاركة...', 'Preparing file for sharing...', 'Datei wird für Freigabe vorbereitet...'));

    try {
      const options = {
        format: selectedFormat,
        theme: selectedTheme,
        language: language as any,
        includeSchoolTimes: includePresenceInIcs
      };

      const result = await shareSchoolSchedule(schoolSettings, profile, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to share schedule');
      }

      setSuccessToast(_t('تم فتح قائمة المشاركة بنجاح!', 'Share dialog opened successfully!', 'Freigabedialog geöffnet!'));
      setTimeout(() => {
        setSuccessToast(null);
      }, 2000);
    } catch (err: any) {
      console.error('[Share School Schedule Error]:', err);
      setErrorFeedback(_t(
        'تعذر فتح المشاركة. يرجى المحاولة مرة أخرى أو استخدام خيار الحفظ.',
        'Could not open share dialog. Please try again or download the file.',
        'Freigabe konnte nicht geöffnet werden. Bitte Datei speichern oder erneut versuchen.'
      ));
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-surface border border-surface-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        id="school-schedule-export-modal"
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-surface-border flex items-center justify-between bg-surface-hover/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-soft text-primary flex items-center justify-center border border-primary-border shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main leading-tight">
                {_t('تصدير جدول المدرسة الأسبوعي', 'Export Weekly School Schedule', 'Schulstundenplan exportieren')}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {previewModel.stats.summaryLine}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-border/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* SUCCESS NOTIFICATION */}
          {successToast && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-2.5 animate-scale-up">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successToast}</span>
            </div>
          )}

          {/* ERROR FEEDBACK */}
          {errorFeedback && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center gap-2.5 animate-scale-up">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorFeedback}</span>
            </div>
          )}

          {/* FORMAT SELECTION */}
          <div className="space-y-2.5">
            <label className="text-xs font-black text-text-muted uppercase tracking-wider block">
              {_t('صيغة التصدير', 'Export Format', 'Exportformat')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* ICS CALENDAR BUTTON */}
              <button
                type="button"
                onClick={() => setSelectedFormat('ics')}
                disabled={isProcessing}
                className={`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  selectedFormat === 'ics'
                    ? 'bg-primary-soft border-primary text-primary shadow-xs'
                    : 'bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  {selectedFormat === 'ics' && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-text-main">
                    iCal (.ics)
                  </div>
                  <div className="text-[10px] text-text-muted opacity-80 leading-tight mt-0.5">
                    {_t('Google / Apple Calendar', 'Google / Apple Calendar', 'Kalendersync')}
                  </div>
                </div>
              </button>

              {/* PDF BUTTON */}
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                disabled={isProcessing}
                className={`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  selectedFormat === 'pdf'
                    ? 'bg-primary-soft border-primary text-primary shadow-xs'
                    : 'bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5" />
                  {selectedFormat === 'pdf' && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-text-main">
                    PDF (A4)
                  </div>
                  <div className="text-[10px] text-text-muted opacity-80 leading-tight mt-0.5">
                    {_t('طباعة أفقية Landscape', 'Landscape Print', 'Druckoptimiert')}
                  </div>
                </div>
              </button>

              {/* PNG BUTTON */}
              <button
                type="button"
                onClick={() => setSelectedFormat('png')}
                disabled={isProcessing}
                className={`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  selectedFormat === 'png'
                    ? 'bg-primary-soft border-primary text-primary shadow-xs'
                    : 'bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ImageIcon className="w-5 h-5" />
                  {selectedFormat === 'png' && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-text-main">
                    PNG
                  </div>
                  <div className="text-[10px] text-text-muted opacity-80 leading-tight mt-0.5">
                    {_t('دقة فائقة Retina', 'Retina High-Res', 'Ultra-Scharf')}
                  </div>
                </div>
              </button>

              {/* JPG BUTTON */}
              <button
                type="button"
                onClick={() => setSelectedFormat('jpeg')}
                disabled={isProcessing}
                className={`p-3 rounded-2xl border text-start flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  selectedFormat === 'jpeg'
                    ? 'bg-primary-soft border-primary text-primary shadow-xs'
                    : 'bg-surface border-surface-border text-text-muted hover:border-surface-border-soft hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ImageIcon className="w-5 h-5" />
                  {selectedFormat === 'jpeg' && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-text-main">
                    JPG
                  </div>
                  <div className="text-[10px] text-text-muted opacity-80 leading-tight mt-0.5">
                    {_t('حجم خفيف ومضغوط', 'Light & Compact', 'Kompakt')}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* ICS SPECIFIC OPTIONS */}
          {selectedFormat === 'ics' && (
            <div className="p-3.5 rounded-2xl bg-surface-hover border border-surface-border space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-text-main">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{_t('تضمين كتلة الدوام والحضور المدرسي', 'Include school presence hours', 'Schulanwesenheitszeiten einbeziehen')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={includePresenceInIcs}
                  onChange={(e) => setIncludePresenceInIcs(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-text-muted">
                {_t(
                  'سيتم إنشاء أحداث أسبوعية متكررة (RRULE) لكل حصة دراسية مع تنبيهات مسبقة قبل كل حصة بـ 15 دقيقة.',
                  'Creates recurring weekly events (RRULE) for each period with 15-minute advance alarms in Google Calendar & Apple Calendar.',
                  'Erstellt wöchentlich wiederkehrende Termine mit Erinnerungen 15 Minuten vor Beginn.'
                )}
              </p>
            </div>
          )}

          {/* THEME STYLE SELECTION (FOR PDF/IMAGE) */}
          {selectedFormat !== 'ics' && (
            <div className="space-y-2.5">
              <label className="text-xs font-black text-text-muted uppercase tracking-wider block">
                {_t('مظهر المستند المطبوع', 'Print & Theme Styling', 'Erscheinungsbild')}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedTheme('clean_light')}
                  disabled={isProcessing}
                  className={`p-3 rounded-2xl border text-start flex items-center gap-3 transition-all cursor-pointer ${
                    selectedTheme === 'clean_light'
                      ? 'bg-primary-soft border-primary text-primary shadow-xs'
                      : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover'
                  }`}
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-black text-text-main truncate">
                      {_t('كلاسيكي فاتح (مثالي للطباعة)', 'Classic Print (Light)', 'Klassischer Druck (Hell)')}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {_t('خلفية بيضاء وتباين عالي', 'White canvas, high contrast', 'Weißer Hintergrund')}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTheme('brand_accent')}
                  disabled={isProcessing}
                  className={`p-3 rounded-2xl border text-start flex items-center gap-3 transition-all cursor-pointer ${
                    selectedTheme === 'brand_accent'
                      ? 'bg-primary-soft border-primary text-primary shadow-xs'
                      : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover'
                  }`}
                >
                  <Palette className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-black text-text-main truncate">
                      {_t('ثيم Glück الملون', 'Glück Accent Theme', 'Glück Farb-Theme')}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {_t('خلايا ملونة بلمسات التطبيق', 'App colored badges', 'Farbige Akzente')}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* MINIATURE PREVIEW CARD */}
          <div className="p-4 rounded-2xl bg-surface-hover/80 border border-surface-border space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-text-main">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                {_t('معاينة تفاصيل التصدير', 'Export Summary Preview', 'Vorschau-Zusammenfassung')}
              </span>
              <span className="text-[11px] text-text-muted">
                {previewModel.days.length} {_t('أيام', 'Days', 'Tage')} • {previewModel.periods.length} {_t('حصص', 'Periods', 'Stunden')}
              </span>
            </div>

            <div className="p-3 bg-white text-slate-900 rounded-xl border border-slate-200 text-xs space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-black text-slate-900">{previewModel.title}</span>
                <span className="text-[10px] font-bold text-slate-500">{previewModel.exportDateFormatted}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
                <span>{previewModel.stats.summaryLine}</span>
                {previewModel.teacherName && (
                  <span>{previewModel.teacherName}</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {_t(
                  'يتم التصدير مباشرة من بيانات الجدول مع دعم كامل للغة العربية والاتجاه من اليمين لليسار بدقة عالية.',
                  'Exported programmatically from raw schedule data with full RTL and high resolution vector rendering.',
                  'Wird direkt aus den Plandaten im hochauflösenden Format generiert.'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL ACTIONS FOOTER */}
        <div className="p-4 sm:p-5 border-t border-surface-border bg-surface-hover/30 flex flex-col sm:flex-row items-center gap-3">
          {/* SHARE BUTTON (ANDROID SHARE SHEET / WEB SHARE) */}
          <button
            type="button"
            onClick={handleExecuteShare}
            disabled={isProcessing}
            className="w-full sm:w-1/2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface border border-surface-border text-text-main hover:bg-surface-hover font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Share2 className="w-4 h-4 text-primary" />
            )}
            <span>{_t('مشاركة مباشرة', 'Direct Share', 'Direkt teilen')}</span>
          </button>

          {/* SAVE / DOWNLOAD BUTTON */}
          <button
            type="button"
            onClick={handleExecuteSave}
            disabled={isProcessing}
            className="w-full sm:w-1/2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{statusMessage || _t('جاري التصدير...', 'Exporting...', 'Wird exportiert...')}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  {selectedFormat === 'ics'
                    ? _t('تصدير وحفظ ملف التقويم (.ics)', 'Export & Save Calendar (.ics)', 'Kalenderdatei speichern (.ics)')
                    : selectedFormat === 'pdf' 
                      ? _t('تصدير وحفظ PDF', 'Export & Save PDF', 'PDF speichern')
                      : _t('تصدير وحفظ الصورة', 'Export & Save Image', 'Bild speichern')
                  }
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
