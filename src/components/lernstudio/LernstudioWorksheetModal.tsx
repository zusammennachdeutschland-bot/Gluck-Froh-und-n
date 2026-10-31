import React, { useState, useEffect } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle } from '../../utils/lernstudioTranslations';
import {
  downloadOrSaveLernstudioWorksheet,
  printLernstudioWorksheetDirectly,
  renderWorksheetWithDiagnostics,
  WorksheetOptions,
  WorksheetRenderResult
} from '../../utils/lernstudioPdfUtils';
import { stripCopySuffix, WORKSHEET_BUILD_ID } from '../../utils/lernstudioWorksheetBuilder';
import {
  X,
  Printer,
  FileText,
  Download,
  Check,
  Loader2,
  RefreshCw,
  Eye,
  AlertTriangle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  set: LernstudioSet;
  schoolName?: string;
  teacherName?: string;
  language?: string;
  onClose: () => void;
}

export const LernstudioWorksheetModal: React.FC<Props> = ({
  isOpen,
  set,
  schoolName: initialSchool,
  teacherName: initialTeacher,
  language = 'ar',
  onClose
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const cleanTitle = stripCopySuffix(getLocalizedSetTitle(set, language));

  const sanitizeTeacher = (val?: string) => {
    if (!val || /^\d+$/.test(val.trim())) return '';
    return val;
  };

  const sanitizeGrade = (val?: string) => {
    if (!val || /جريد/i.test(val)) return '';
    return val;
  };

  const [schoolName, setSchoolName] = useState(
    initialSchool || (isRtl ? 'مدرسة Glück - Lernstudio' : 'Glück - Lernstudio School')
  );
  const [teacherName, setTeacherName] = useState(
    sanitizeTeacher(initialTeacher) || sanitizeTeacher(initialSchool) || ''
  );
  const [gradeName, setGradeName] = useState(sanitizeGrade(set.grade));
  const [subjectName, setSubjectName] = useState(isRtl ? 'اللغة الألمانية' : 'Deutsch');

  // Exercise checkboxes (all default true)
  const [includeMatching, setIncludeMatching] = useState(true);
  const [includeMissingLetters, setIncludeMissingLetters] = useState(true);
  const [includeOddOneOut, setIncludeOddOneOut] = useState(true);
  const [includeGrammar, setIncludeGrammar] = useState(true);
  const [includePictures, setIncludePictures] = useState(true);
  const [includeSentenceBuilder, setIncludeSentenceBuilder] = useState(true);
  const [includeVocabularyTable, setIncludeVocabularyTable] = useState(true);

  // Numerical config
  const [questionsPerExercise, setQuestionsPerExercise] = useState(8);
  const [variant, setVariant] = useState(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewResult, setPreviewResult] = useState<WorksheetRenderResult | null>(null);
  const [previewIsTeacher, setPreviewIsTeacher] = useState(false);

  // Release preview memory when modal closes or options change
  useEffect(() => {
    if (!isOpen) {
      setPreviewResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setPreviewResult(null);
  }, [
    schoolName,
    teacherName,
    gradeName,
    subjectName,
    includeMatching,
    includeMissingLetters,
    includeOddOneOut,
    includeGrammar,
    includePictures,
    includeSentenceBuilder,
    includeVocabularyTable,
    questionsPerExercise,
    variant,
    set.id
  ]);

  if (!isOpen) return null;

  const getOptions = (isTeacherKey: boolean): WorksheetOptions => ({
    schoolName,
    teacherName,
    gradeName,
    subjectName,
    dateStr: new Date().toLocaleDateString('de-DE'),
    includeAnswerKey: isTeacherKey,
    includeMatching,
    includeMissingLetters,
    includeOddOneOut,
    includeGrammar,
    includePictures,
    includeSentenceBuilder,
    includeVocabularyTable,
    questionsPerExercise,
    variant
  });

  const handlePreview = async (isTeacherKey: boolean) => {
    setIsGenerating(true);
    try {
      const opts = getOptions(isTeacherKey);
      const rendered = await renderWorksheetWithDiagnostics(set, opts);
      setPreviewResult(rendered);
      setPreviewIsTeacher(isTeacherKey);
    } catch (err) {
      console.error('Worksheet Preview error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePdf = async (isTeacherKey: boolean) => {
    setIsGenerating(true);
    try {
      const opts = getOptions(isTeacherKey);
      // Reuse preview if it already matches the requested student/teacher mode
      const preRendered =
        previewResult && previewIsTeacher === isTeacherKey ? previewResult : undefined;
      const rendered = await downloadOrSaveLernstudioWorksheet(set, opts, preRendered);
      setPreviewResult(rendered);
      setPreviewIsTeacher(isTeacherKey);
    } catch (err) {
      console.error('Worksheet PDF Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectPrint = (isTeacherKey: boolean) => {
    const opts = getOptions(isTeacherKey);
    printLernstudioWorksheetDirectly(set, opts);
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Printer className="w-5 h-5 text-primary" />
            <h2 className="text-sm sm:text-base font-black text-text-main">
              {t.worksheetModalTitle} - ({cleanTitle})
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[11px] font-mono font-black">
              {WORKSHEET_BUILD_ID}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>تصميم متعدد الصفحات A4 تلقائياً بدون ضغط أو تصغير للخطوط.</span>
            </div>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 shrink-0">
              {WORKSHEET_BUILD_ID}
            </span>
          </div>

          {/* Warnings / Validation Banner (TASK 2.5) */}
          {previewResult && (previewResult.warnings.length > 0 || previewResult.usedFallback) && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <div className="font-black flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>⚠️ الورقة فيها مشكلة في التنسيق:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 opacity-90">
                {previewResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Live Thumbnail Preview Strip (TASK 3) */}
          {previewResult && previewResult.pageDataUrls.length > 0 && (
            <div className="p-3 bg-surface-hover/60 border border-surface-border rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-text-main">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span>
                    معاينة الصفحات ({previewIsTeacher ? 'نسخة المعلم' : 'نسخة الطالب'}) — عدد الصفحات:{' '}
                    {previewResult.pageCount}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {previewResult.buildId}
                </span>
              </div>
              <div className="flex items-start gap-3 overflow-x-auto pb-2 pt-1">
                {previewResult.pageDataUrls.map((dataUrl, idx) => (
                  <div
                    key={idx}
                    className="shrink-0 flex flex-col items-center gap-1 bg-white p-1.5 rounded-xl border border-surface-border shadow-sm"
                  >
                    <img
                      src={dataUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-[165px] h-auto rounded border border-gray-200 object-contain"
                    />
                    <span className="text-[11px] font-bold text-gray-700 font-mono">
                      Seite {idx + 1}/{previewResult.pageCount} • {previewResult.buildId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                اسم المدرسة / المؤسسة:
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                اسم المعلم / المعلمة:
              </label>
              <input
                type="text"
                placeholder="اتركه فارغاً لطباعة خط كتابة"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                الصف / المرحلة:
              </label>
              <input
                type="text"
                placeholder="اتركه فارغاً ليكتبه الطالب"
                value={gradeName}
                onChange={(e) => setGradeName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                المادة الدراسية:
              </label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Quantity & Variant Options */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-border">
            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                عدد الأسئلة/الفقرات لكل تمرين:
              </label>
              <input
                type="number"
                min={3}
                max={12}
                value={questionsPerExercise}
                onChange={(e) =>
                  setQuestionsPerExercise(Math.max(3, Math.min(12, Number(e.target.value) || 8)))
                }
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">
                رقم النموذج/النسخة (Variant):
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={variant}
                  onChange={(e) => setVariant(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setVariant((v) => v + 1)}
                  className="p-2 bg-surface-hover hover:bg-primary-soft border border-surface-border rounded-xl text-primary cursor-pointer transition-colors"
                  title="توليد ترتيب نموذج جديد"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sections checkboxes */}
          <div className="space-y-2 pt-2 border-t border-surface-border">
            <span className="text-xs font-black text-text-main block">
              تمارين ورقة العمل (اختر التمارين المطلوبة):
            </span>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeMatching}
                onChange={(e) => setIncludeMatching(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>1. توصيل المفردات بالمعنى العربي (Matching)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeMissingLetters}
                onChange={(e) => setIncludeMissingLetters(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>2. إكمال الحروف الناقصة (Missing Letters)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeOddOneOut}
                onChange={(e) => setIncludeOddOneOut(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>3. ما الكلمة المختلفة؟ (Odd One Out)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeGrammar}
                onChange={(e) => setIncludeGrammar(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>4. القواعد وتصريف الأفعال / الجمع والأرتيكل (Grammar)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includePictures}
                onChange={(e) => setIncludePictures(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>5. صور ورموز الكلمات / كتابة الأرقام بالحروف (Pictures Grid)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeSentenceBuilder}
                onChange={(e) => setIncludeSentenceBuilder(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>6. ترتيب أجزاء الجملة (Sentence Order)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeVocabularyTable}
                onChange={(e) => setIncludeVocabularyTable(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>جدول المفردات والمعاني في صفحة مستقلة (Vocabulary Table)</span>
            </label>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-surface-border bg-surface space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-text-muted pb-1">
            <span>نسخة المولد الحالية:</span>
            <span className="font-mono font-black text-primary">{WORKSHEET_BUILD_ID}</span>
          </div>

          {/* Preview Buttons Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handlePreview(false)}
              className="py-2 px-3 bg-surface-hover hover:bg-primary/10 border border-surface-border text-text-main rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60 transition-all"
            >
              <Eye className="w-4 h-4 text-primary" />
              <span>معاينة (نسخة الطالب)</span>
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handlePreview(true)}
              className="py-2 px-3 bg-surface-hover hover:bg-emerald-500/10 border border-surface-border text-text-main rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60 transition-all"
            >
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>معاينة (نموذج المعلم)</span>
            </button>
          </div>

          {/* Download / Save PDF Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGeneratePdf(false)}
              className="py-2.5 px-3 bg-primary text-white rounded-xl text-xs font-black shadow-md cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري المعالجة...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{t.downloadPdf} (نسخة الطالب)</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGeneratePdf(true)}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري المعالجة...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>{t.downloadPdf} (نموذج المعلم)</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleDirectPrint(false)}
            className="w-full py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-primary" />
            <span>
              {t.printBtn} ({WORKSHEET_BUILD_ID})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
