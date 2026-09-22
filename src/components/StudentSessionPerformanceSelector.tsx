import React from 'react';
import { Student, StudentSessionPerformance, PerformanceLevel, ParticipationLevel, UnderstandingLevel, SpeakingLevel, FocusLevel, ProgressLevel } from '../types';
import { generateFeedback } from '../utils/feedbackGenerator';
import { getStudentGender } from '../utils/genderUtils';
import { RefreshCw, BarChart2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  performance?: StudentSessionPerformance;
  onChange: (perf: StudentSessionPerformance) => void;
  language?: 'ar' | 'en' | 'de';
  student?: Student | { name?: string; gender?: 'male' | 'female' };
  defaultGender?: 'male' | 'female';
}

export const StudentSessionPerformanceSelector: React.FC<Props> = ({ 
  performance, 
  onChange, 
  language: propLanguage,
  student,
  defaultGender
}) => {
  const { _t, language: appLanguage } = useApp();
  const effectiveLang = propLanguage || appLanguage;
  const lang: 'ar' | 'en' | 'de' = (effectiveLang === 'de' || effectiveLang === 'en') ? effectiveLang : 'ar';

  const levels: { value: PerformanceLevel; label: string; color: string }[] = React.useMemo(() => [
    { value: 'excellent', label: _t('ممتاز', 'Excellent', 'Ausgezeichnet'), color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800' },
    { value: 'very_good', label: _t('جيد جدًا', 'Very Good', 'Sehr gut'), color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-400 dark:border-teal-800' },
    { value: 'good', label: _t('جيد', 'Good', 'Gut'), color: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-800' },
    { value: 'developing', label: _t('في تطور', 'Developing', 'In Entwicklung'), color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800' },
    { value: 'needs_support', label: _t('يحتاج دعم', 'Needs Support', 'Braucht Förderung'), color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' }
  ], [_t]);

  const participationOpts: { value: ParticipationLevel; label: string }[] = React.useMemo(() => [
    { value: 'active', label: _t('نشط', 'Active', 'Aktiv') },
    { value: 'good', label: _t('جيد', 'Good', 'Gut') },
    { value: 'quiet', label: _t('هادئ', 'Quiet', 'Ruhig') },
    { value: 'needs_encouragement', label: _t('يحتاج تشجيع', 'Needs Encouragement', 'Braucht Ermutigung') }
  ], [_t]);

  const understandingOpts: { value: UnderstandingLevel; label: string }[] = React.useMemo(() => [
    { value: 'excellent', label: _t('ممتاز', 'Excellent', 'Ausgezeichnet') },
    { value: 'good', label: _t('جيد', 'Good', 'Gut') },
    { value: 'developing', label: _t('في تطور', 'Developing', 'In Entwicklung') },
    { value: 'needs_review', label: _t('يحتاج مراجعة', 'Needs Review', 'Wiederholung nötig') }
  ], [_t]);

  const speakingOpts: { value: SpeakingLevel; label: string }[] = React.useMemo(() => [
    { value: 'confident', label: _t('واثق', 'Confident', 'Selbstbewusst') },
    { value: 'good', label: _t('جيد', 'Good', 'Gut') },
    { value: 'improving', label: _t('يتحسن', 'Improving', 'Verbessert sich') },
    { value: 'needs_practice', label: _t('يحتاج تدريب', 'Needs Practice', 'Braucht Übung') }
  ], [_t]);

  const focusOpts: { value: FocusLevel; label: string }[] = React.useMemo(() => [
    { value: 'excellent', label: _t('ممتاز', 'Excellent', 'Ausgezeichnet') },
    { value: 'good', label: _t('جيد', 'Good', 'Gut') },
    { value: 'sometimes_distracted', label: _t('يتشتت أحيانًا', 'Sometimes Distracted', 'Manchmal abgelenkt') },
    { value: 'needs_more_focus', label: _t('يحتاج تركيز', 'Needs Focus', 'Mehr Fokus nötig') }
  ], [_t]);

  const progressOpts: { value: ProgressLevel; label: string }[] = React.useMemo(() => [
    { value: 'improved', label: _t('↑ تحسن', '↑ Improved', '↑ Verbessert') },
    { value: 'stable', label: _t('→ مستقر', '→ Stable', '→ Stabil') },
    { value: 'needs_attention', label: _t('↓ تراجع', '↓ Needs Attention', '↓ Nachholbedarf') }
  ], [_t]);

  const perf = performance || {};
  // Automatically determine student's gender from profile settings or name
  const autoResolvedGender: 'male' | 'female' = defaultGender || (student ? getStudentGender(student) : 'male');
  const currentGender: 'male' | 'female' = perf.gender || autoResolvedGender;

  const handleUpdate = (updates: Partial<StudentSessionPerformance>) => {
    const activeGender = updates.gender !== undefined ? updates.gender : (perf.gender || autoResolvedGender);
    const newPerf: StudentSessionPerformance = { ...perf, ...updates, gender: activeGender };
    
    // Auto-generate feedback if level is selected
    if (newPerf.level) {
      const generated = generateFeedback(newPerf, lang, newPerf.feedbackVariantId, activeGender);
      newPerf.generatedFeedback = generated.feedback;
      newPerf.feedbackVariantId = generated.variantId;
      newPerf.feedbackLanguage = lang;
      newPerf.generatedAt = new Date().toISOString();
    }
    
    onChange(newPerf);
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.preventDefault();
    if (perf.level) {
      const activeGender = perf.gender || autoResolvedGender;
      const generated = generateFeedback(perf, lang, perf.feedbackVariantId, activeGender);
      onChange({
        ...perf,
        gender: activeGender,
        generatedFeedback: generated.feedback,
        feedbackVariantId: generated.variantId,
        feedbackLanguage: lang,
        generatedAt: new Date().toISOString()
      });
    }
  };

  return (
    <div className="mt-4 border border-surface-border rounded-xl bg-surface-hover/30 overflow-hidden">
      <div className="bg-surface-border/40 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[10.5px] font-black text-text-main">{_t('أداء الحصة', 'Session Performance', 'Lektionsleistung')}</span>
        </div>

        {/* Small subtle gender indicator (auto from student profile) */}
        <div className="flex items-center gap-1 text-[10px] font-bold text-text-muted bg-surface px-2 py-0.5 rounded-md border border-surface-border">
          <span>{currentGender === 'female' ? _t('👧 طالبة (مؤنث)', '👧 Female Student', '👧 Schülerin') : _t('👦 طالب (مذكر)', '👦 Male Student', '👦 Schüler')}</span>
        </div>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Level */}
        <div className="flex flex-wrap gap-1.5">
          {levels.map(l => (
            <button
              key={l.value}
              type="button"
              onClick={() => handleUpdate({ level: l.value })}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                perf.level === l.value 
                  ? l.color + ' shadow-xs ring-1 ring-current' 
                  : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover hover:text-text-main'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {perf.level && (
          <div className="space-y-2.5 pt-1 border-t border-surface-border/50">
            {/* Factors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">{_t('المشاركة', 'Participation', 'Beteiligung')}</span>
                <div className="flex flex-wrap gap-1">
                  {participationOpts.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => handleUpdate({ participation: perf.participation === o.value ? undefined : o.value })}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                        perf.participation === o.value 
                          ? 'bg-primary-soft text-primary border-primary-border shadow-2xs' 
                          : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">{_t('الفهم', 'Understanding', 'Verständnis')}</span>
                <div className="flex flex-wrap gap-1">
                  {understandingOpts.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => handleUpdate({ understanding: perf.understanding === o.value ? undefined : o.value })}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                        perf.understanding === o.value 
                          ? 'bg-primary-soft text-primary border-primary-border shadow-2xs' 
                          : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">{_t('التحدث', 'Speaking', 'Sprechen')}</span>
                <div className="flex flex-wrap gap-1">
                  {speakingOpts.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => handleUpdate({ speaking: perf.speaking === o.value ? undefined : o.value })}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                        perf.speaking === o.value 
                          ? 'bg-primary-soft text-primary border-primary-border shadow-2xs' 
                          : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">{_t('التركيز', 'Focus', 'Fokus')}</span>
                <div className="flex flex-wrap gap-1">
                  {focusOpts.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => handleUpdate({ focus: perf.focus === o.value ? undefined : o.value })}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                        perf.focus === o.value 
                          ? 'bg-primary-soft text-primary border-primary-border shadow-2xs' 
                          : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-1 pt-1">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">{_t('التقدم (مقارنة بالحصة السابقة)', 'Progress (vs Previous Lesson)', 'Fortschritt (vgl. letzte Stunde)')}</span>
              <div className="flex flex-wrap gap-1">
                {progressOpts.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => handleUpdate({ progress: perf.progress === o.value ? undefined : o.value })}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                      perf.progress === o.value 
                        ? 'bg-text-main text-surface border-text-main shadow-sm' 
                        : 'bg-surface border-surface-border text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generated Feedback */}
            {perf.generatedFeedback && (
              <div className="mt-2 bg-background border border-surface-border rounded-lg p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-surface-border/40">
                  <span className="text-[9.5px] font-black text-text-muted">{_t('النص التلقائي', 'Generated Feedback', 'Generiertes Feedback')}</span>
                  
                  {/* Regenerate Button */}
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black text-primary bg-primary-soft hover:bg-primary/20 border border-primary-border transition-colors cursor-pointer"
                    title={_t('تغيير صياغة النص التلقائي', 'Regenerate feedback wording', 'Formulierung neu generieren')}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{_t('صياغة أخرى', 'Another phrasing', 'Neu formulieren')}</span>
                  </button>
                </div>

                <p className="text-[11px] font-semibold text-text-main leading-relaxed">
                  {perf.generatedFeedback.parent}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
