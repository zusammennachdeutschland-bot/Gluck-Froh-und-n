import React from 'react';
import { StudentSessionPerformance, PerformanceLevel, ParticipationLevel, UnderstandingLevel, SpeakingLevel, FocusLevel, ProgressLevel } from '../types';
import { generateFeedback } from '../utils/feedbackGenerator';
import { RefreshCw, BarChart2 } from 'lucide-react';

interface Props {
  performance?: StudentSessionPerformance;
  onChange: (perf: StudentSessionPerformance) => void;
  language?: 'ar' | 'en' | 'de';
}

const levels: { value: PerformanceLevel; label: string; color: string }[] = [
  { value: 'excellent', label: 'ممتاز', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800' },
  { value: 'very_good', label: 'جيد جدًا', color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-400 dark:border-teal-800' },
  { value: 'good', label: 'جيد', color: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-800' },
  { value: 'developing', label: 'في تطور', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800' },
  { value: 'needs_support', label: 'يحتاج دعم', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' }
];

const participationOpts: { value: ParticipationLevel; label: string }[] = [
  { value: 'active', label: 'نشط' },
  { value: 'good', label: 'جيد' },
  { value: 'quiet', label: 'هادئ' },
  { value: 'needs_encouragement', label: 'يحتاج تشجيع' }
];

const understandingOpts: { value: UnderstandingLevel; label: string }[] = [
  { value: 'excellent', label: 'ممتاز' },
  { value: 'good', label: 'جيد' },
  { value: 'developing', label: 'في تطور' },
  { value: 'needs_review', label: 'يحتاج مراجعة' }
];

const speakingOpts: { value: SpeakingLevel; label: string }[] = [
  { value: 'confident', label: 'واثق' },
  { value: 'good', label: 'جيد' },
  { value: 'improving', label: 'يتحسن' },
  { value: 'needs_practice', label: 'يحتاج تدريب' }
];

const focusOpts: { value: FocusLevel; label: string }[] = [
  { value: 'excellent', label: 'ممتاز' },
  { value: 'good', label: 'جيد' },
  { value: 'sometimes_distracted', label: 'يتشتت أحيانًا' },
  { value: 'needs_more_focus', label: 'يحتاج تركيز' }
];

const progressOpts: { value: ProgressLevel; label: string }[] = [
  { value: 'improved', label: '↑ تحسن' },
  { value: 'stable', label: '→ مستقر' },
  { value: 'needs_attention', label: '↓ تراجع' }
];

export const StudentSessionPerformanceSelector: React.FC<Props> = ({ performance, onChange, language = 'ar' }) => {
  const perf = performance || {};
  const currentGender: 'male' | 'female' = perf.gender || 'male';
  const lang: 'ar' | 'en' | 'de' = (language === 'de' || language === 'en') ? language : 'ar';

  const handleUpdate = (updates: Partial<StudentSessionPerformance>) => {
    const activeGender = updates.gender !== undefined ? updates.gender : currentGender;
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

  const handleToggleGender = (targetGender: 'male' | 'female') => {
    if (targetGender === currentGender && perf.generatedFeedback) return;
    handleUpdate({ gender: targetGender });
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.preventDefault();
    if (perf.level) {
      const generated = generateFeedback(perf, lang, perf.feedbackVariantId, currentGender);
      onChange({
        ...perf,
        gender: currentGender,
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
          <span className="text-[10.5px] font-black text-text-main">أداء الحصة (Session Performance)</span>
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
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">المشاركة</span>
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
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">الفهم</span>
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
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">التحدث</span>
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
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">التركيز</span>
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
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">التقدم (مقارنة بالحصة السابقة)</span>
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
                  <span className="text-[9.5px] font-black text-text-muted">النص التلقائي (Generated Feedback)</span>
                  
                  <div className="flex items-center gap-1.5">
                    {/* Small Gender Toggle Switcher (مذكر / مؤنث) */}
                    <div className="inline-flex items-center p-0.5 bg-surface border border-surface-border rounded-md shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleToggleGender('male')}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-0.5 ${
                          currentGender === 'male'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                        }`}
                        title="صياغة المذكر (طالب 👦)"
                      >
                        <span>👦</span>
                        <span>مذكر</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleGender('female')}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-0.5 ${
                          currentGender === 'female'
                            ? 'bg-rose-500 text-white shadow-2xs'
                            : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                        }`}
                        title="صياغة المؤنث (طالبة 👧)"
                      >
                        <span>👧</span>
                        <span>مؤنث</span>
                      </button>
                    </div>

                    {/* Regenerate Button */}
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-primary bg-primary-soft hover:bg-primary/20 border border-primary-border transition-colors"
                      title="تغيير صياغة النص التلقائي"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>صياغة أخرى</span>
                    </button>
                  </div>
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
