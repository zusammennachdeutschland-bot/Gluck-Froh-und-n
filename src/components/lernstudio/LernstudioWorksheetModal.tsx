import React, { useState } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle } from '../../utils/lernstudioTranslations';
import {
  downloadOrSaveLernstudioWorksheet,
  printLernstudioWorksheetDirectly,
  WorksheetOptions
} from '../../utils/lernstudioPdfUtils';
import { X, Printer, FileText, Download, Check, Loader2 } from 'lucide-react';

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
  const displaySetTitle = getLocalizedSetTitle(set, language);

  const [schoolName, setSchoolName] = useState(initialSchool || (isRtl ? 'مدرسة Glück - Lernstudio' : 'Glück - Lernstudio School'));
  const [teacherName, setTeacherName] = useState(initialTeacher || (isRtl ? 'الأستاذ المعلم' : 'Teacher'));
  const [gradeName, setGradeName] = useState(set.grade || (isRtl ? 'الصف الأول' : 'Grade 1'));
  const [subjectName, setSubjectName] = useState(isRtl ? 'اللغة الألمانية' : 'Deutsch');

  const [includeVocabularyTable, setIncludeVocabularyTable] = useState(true);
  const [includeMissingLetters, setIncludeMissingLetters] = useState(true);
  const [includeSentenceBuilder, setIncludeSentenceBuilder] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const getOptions = (isTeacherKey: boolean): WorksheetOptions => ({
    schoolName,
    teacherName,
    gradeName,
    subjectName,
    dateStr: new Date().toLocaleDateString('de-DE'),
    includeAnswerKey: isTeacherKey,
    includeVocabularyTable,
    includeMissingLetters,
    includeSentenceBuilder
  });

  const handleGeneratePdf = async (isTeacherKey: boolean) => {
    setIsGenerating(true);
    try {
      const opts = getOptions(isTeacherKey);
      await downloadOrSaveLernstudioWorksheet(set, opts);
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
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            <h2 className="text-sm sm:text-base font-black text-text-main">
              {t.worksheetModalTitle} - ({displaySetTitle})
            </h2>
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
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>PDF Generator with Arabic & German font support.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">School / School Name:</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">Teacher / Teacher Name:</label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">Grade / Level:</label>
              <input
                type="text"
                value={gradeName}
                onChange={(e) => setGradeName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">Subject:</label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-text-main text-xs font-bold focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Sections checkboxes */}
          <div className="space-y-2 pt-2 border-t border-surface-border">
            <span className="text-xs font-black text-text-main block">Worksheet Sections:</span>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeVocabularyTable}
                onChange={(e) => setIncludeVocabularyTable(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>1. Vocabulary Table (Wortschatz)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeMissingLetters}
                onChange={(e) => setIncludeMissingLetters(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>2. Missing Letters Practice</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted">
              <input
                type="checkbox"
                checked={includeSentenceBuilder}
                onChange={(e) => setIncludeSentenceBuilder(e.target.checked)}
                className="rounded border-surface-border text-primary focus:ring-primary"
              />
              <span>3. Sentence Builder (Satzbau)</span>
            </label>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-surface-border bg-surface space-y-2 shrink-0">
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
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{t.downloadPdf} (Student)</span>
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
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>{t.downloadPdf} (Teacher)</span>
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
            <span>{t.printBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
