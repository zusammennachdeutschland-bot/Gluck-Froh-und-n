import React, { useState, useEffect } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle, getLocalizedSetTopic } from '../../utils/lernstudioTranslations';
import { speakGermanText } from '../../utils/audioSpeechUtils';
import {
  hasGrammarContent,
  getGrammarLessonExercises,
  getLocalizedGrammarField,
  inferSetKind
} from '../grammarEngine';
import { GrammarPageImagesPanel } from './GrammarPageImagesPanel';
import { X, Volume2, Search, Gamepad2, BookOpen, Printer, Snail, GraduationCap, HelpCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  set: LernstudioSet;
  language?: string;
  onClose: () => void;
  onStartGames: () => void;
  onStartTeach: () => void;
  onStartWorksheet: () => void;
}

export const LernstudioWordsModal: React.FC<Props> = ({
  isOpen,
  set,
  language = 'ar',
  onClose,
  onStartGames,
  onStartTeach,
  onStartWorksheet
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const grammarAvailable = Boolean(set && hasGrammarContent(set));
  const itemsCount = set?.items?.length || 0;
  const [activeSection, setActiveSection] = useState<'vocab' | 'grammar'>(
    itemsCount === 0 && grammarAvailable ? 'grammar' : 'vocab'
  );

  useEffect(() => {
    if (!isOpen || !set) return;
    const hasItems = (set.items?.length || 0) > 0;
    const hasGrammar = hasGrammarContent(set);
    setActiveSection(!hasItems && hasGrammar ? 'grammar' : 'vocab');
    setSearchTerm('');
  }, [isOpen, set?.id]);

  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';

  if (!isOpen || !set) return null;

  const displayTitle = getLocalizedSetTitle(set, language);
  const displayTopic = getLocalizedSetTopic(set, language);
  const items = set.items || [];
  const gc = set.grammarContent;
  const rules = gc?.rules || [];
  const examples = gc?.examples || [];
  const exercises = getGrammarLessonExercises(set);
  const kind = inferSetKind(set);

  const handleSpeakGerman = (text: string, rate: number = 0.85) => {
    speakGermanText(text, rate);
  };

  const q = searchTerm.trim().toLowerCase();

  const filteredItems = items.filter((it) => {
    if (!q) return true;
    return (
      (it.german || '').toLowerCase().includes(q) ||
      (it.arabic || '').toLowerCase().includes(q) ||
      ((it as any).example && String((it as any).example).toLowerCase().includes(q)) ||
      (it.exampleSentenceGerman && it.exampleSentenceGerman.toLowerCase().includes(q))
    );
  });

  const filteredRules = rules.filter((r) => {
    if (!q) return true;
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.titleAr || '').toLowerCase().includes(q) ||
      (r.titleDe || '').toLowerCase().includes(q) ||
      (r.titleEn || '').toLowerCase().includes(q) ||
      (r.summaryAr || '').toLowerCase().includes(q) ||
      (r.summaryDe || '').toLowerCase().includes(q) ||
      (r.summaryEn || '').toLowerCase().includes(q) ||
      (r.pattern || '').toLowerCase().includes(q)
    );
  });

  const filteredExamples = examples.filter((ex) => {
    if (!q) return true;
    return (
      (ex.german || '').toLowerCase().includes(q) ||
      (ex.arabic || '').toLowerCase().includes(q) ||
      (ex.english || '').toLowerCase().includes(q)
    );
  });

  const filteredExercises = exercises.filter((ex) => {
    if (!q) return true;
    return (
      (ex.question || '').toLowerCase().includes(q) ||
      (ex.prompt || '').toLowerCase().includes(q) ||
      (ex.correctAnswer || '').toLowerCase().includes(q)
    );
  });

  const kindLabel =
    kind === 'grammar'
      ? t.setKindGrammar
      : kind === 'mixed'
      ? t.setKindMixed
      : kind === 'verb_group'
      ? t.setKindVerbGroup
      : t.setKindVocab;

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-text-main truncate">
                  {displayTitle}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                  {kindLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted font-medium mt-0.5 flex-wrap">
                <span>{displayTopic}</span>
                {items.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{items.length} {t.vocabularyCount}</span>
                  </>
                )}
                {grammarAvailable && (
                  <>
                    <span>·</span>
                    <span>{rules.length} {t.grammarRulesCount} · {exercises.length} {t.grammarExercisesCount}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mixed Mode Switcher (when both vocab and grammar exist) */}
        {items.length > 0 && grammarAvailable && (
          <div className="px-4 py-2 bg-surface-hover/50 border-b border-surface-border grid grid-cols-2 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('vocab')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSection === 'vocab'
                  ? 'bg-surface text-primary shadow-2xs border border-surface-border'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t.vocabTeachingTab} ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('grammar')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSection === 'grammar'
                  ? 'bg-surface text-primary shadow-2xs border border-surface-border'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t.grammarLessonTab} ({rules.length} / {exercises.length})
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-3 sm:p-4 bg-surface/50 border-b border-surface-border shrink-0">
          <div className="relative">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-text-muted ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchWordsPlaceholder}
              className={`w-full py-2 bg-background text-text-main rounded-xl border border-surface-border focus:outline-none focus:border-primary text-xs sm:text-sm font-medium ${
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3 flex-1 min-h-[250px]">
          {activeSection === 'vocab' ? (
            filteredItems.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs sm:text-sm">
                {t.noSetsFound}
              </div>
            ) : (
              filteredItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-xl bg-surface-hover/70 border border-surface-border hover:border-primary/40 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-text-main tracking-wide" dir="ltr">
                        {item.german}
                      </span>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(item.german, 0.85)}
                          className="p-1 rounded-lg text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                          title={t.listenAudio}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(item.german, 0.6)}
                          className="px-1.5 py-0.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0 text-[10px] font-bold border border-amber-500/20 inline-flex items-center gap-0.5"
                          title="0.6x"
                        >
                          <Snail className="w-3 h-3" />
                          <span>0.6x</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-text-muted font-medium">
                      {item.arabic}
                    </p>

                    {item.exampleSentenceGerman && (
                      <p className="text-[11px] text-text-muted/80 italic font-normal pt-0.5 line-clamp-1" dir="ltr">
                        "{item.exampleSentenceGerman}"
                      </p>
                    )}
                  </div>

                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.german}
                      className="w-12 h-12 object-cover rounded-lg border border-surface-border shrink-0"
                    />
                  )}
                </div>
              ))
            )
          ) : (
            <div className="space-y-4">
              {/* Grammar Overview */}
              {gc && (gc.explanationAr || gc.explanationDe || gc.explanationEn) && (
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-black text-primary">
                    <GraduationCap className="w-4 h-4" />
                    <span>{getLocalizedGrammarField(gc, 'lessonTitle', language) || displayTitle}</span>
                  </div>
                  <p className="text-xs text-text-main leading-relaxed whitespace-pre-line">
                    {getLocalizedGrammarField(gc, 'explanation', language)}
                  </p>
                  {gc.sourceBookInfo && (
                    <p className="text-[11px] text-text-muted font-medium pt-1">
                      📚 {gc.sourceBookInfo}
                    </p>
                  )}
                </div>
              )}

              {/* Attached Textbook Page Images (with missing-device & bundle import/export handling) */}
              {gc?.pageImageRefs && gc.pageImageRefs.length > 0 && (
                <GrammarPageImagesPanel pageImageRefs={gc.pageImageRefs} language={language} />
              )}

              {/* Grammar Rules */}
              {filteredRules.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-black text-text-muted uppercase tracking-wider">
                    {t.ruleExplanation} ({filteredRules.length})
                  </h3>
                  {filteredRules.map((rule, rIdx) => (
                    <div
                      key={rule.id || rIdx}
                      className="p-3.5 rounded-xl bg-surface-hover/70 border border-surface-border space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-text-main">
                          {rIdx + 1}. {getLocalizedGrammarField(rule, 'title', language)}
                        </span>
                        {rule.pattern && (
                          <code
                            dir="ltr"
                            className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-mono font-bold"
                          >
                            {rule.pattern}
                          </code>
                        )}
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed whitespace-pre-line">
                        {getLocalizedGrammarField(rule, 'summary', language)}
                      </p>
                      {rule.table && rule.table.headers.length > 0 && (
                        <div className="overflow-x-auto pt-1" dir="ltr">
                          <table className="w-full text-[11px] border-collapse border border-surface-border rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-surface">
                                {rule.table.headers.map((h, hIdx) => (
                                  <th key={hIdx} className="p-1.5 text-left font-bold text-text-main border-b border-surface-border">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rule.table.rows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-b border-surface-border/60 last:border-b-0">
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="p-1.5 text-text-main font-medium">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Grammar Examples */}
              {filteredExamples.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-text-muted uppercase tracking-wider">
                    {t.examplesHeader} ({filteredExamples.length})
                  </h3>
                  {filteredExamples.map((ex, eIdx) => (
                    <div
                      key={ex.id || eIdx}
                      className="p-3 rounded-xl bg-surface-hover/60 border border-surface-border flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-text-main" dir="ltr">
                            {ex.german}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSpeakGerman(ex.german, 0.85)}
                            className="p-1 rounded-lg text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title={t.listenAudio}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-text-muted font-medium">
                          {language === 'en' && ex.english ? ex.english : ex.arabic}
                        </p>
                        {(ex.noteAr || ex.noteDe) && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            💡 {language === 'de' ? ex.noteDe || ex.noteAr : ex.noteAr || ex.noteDe}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grammar Exercises Preview */}
              {filteredExercises.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{t.practiceHeader} ({filteredExercises.length})</span>
                  </h3>
                  {filteredExercises.map((ex, exIdx) => (
                    <div
                      key={ex.id || exIdx}
                      className="p-3 rounded-xl bg-surface-hover/50 border border-surface-border space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-text-main">
                        <span dir="ltr">{exIdx + 1}. {ex.question}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-surface-border text-text-muted shrink-0">
                          {ex.type}
                        </span>
                      </div>
                      {ex.prompt && (
                        <p className="text-[11px] text-text-muted">{ex.prompt}</p>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span dir="ltr">{ex.correctAnswer}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredRules.length === 0 && filteredExamples.length === 0 && filteredExercises.length === 0 && (
                <div className="py-10 text-center text-text-muted text-xs">
                  {t.noSetsFound}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-surface-border bg-surface flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <button
              type="button"
              onClick={onStartGames}
              className="py-2 px-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>{t.playGame}</span>
            </button>

            <button
              type="button"
              onClick={onStartTeach}
              className="py-2 px-3 rounded-xl bg-surface-hover hover:bg-surface text-text-main border border-surface-border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <BookOpen className="w-4 h-4 text-primary" />
              <span>{t.teachMode}</span>
            </button>

            <button
              type="button"
              onClick={onStartWorksheet}
              className="py-2 px-3 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4 text-primary" />
              <span>{t.printWorksheet}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-surface-hover hover:bg-surface text-text-muted hover:text-text-main text-xs font-bold border border-surface-border cursor-pointer transition-colors shrink-0"
          >
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
