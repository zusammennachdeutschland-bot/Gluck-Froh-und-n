import React from 'react';
import { StudentSessionPerformance, PerformanceLevel, ParticipationLevel, UnderstandingLevel, SpeakingLevel, FocusLevel, ProgressLevel } from '../types';
import { generateFeedback } from '../utils/feedbackGenerator';
import { RefreshCw, BarChart2 } from 'lucide-react';

interface Props {
  performance?: StudentSessionPerformance;
  onChange: (perf: StudentSessionPerformance) => void;
  language?: 'ar' | 'en' | 'de';
}

const levels: { value: PerformanceLevel, label: string, color: string }[] = [
  { value: 'excellent', label: 'ممتاز', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800' },
  { value: 'very_good', label: 'جيد جدًا', color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-400 dark:border-teal-800' },
  { value: 'good', label: 'جيد', color: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-800' },
  { value: 'developing', label: 'في تطور', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800' },
  { value: 'needs_support', label: 'يحتاج دعم', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' }
];

const participationOpts: { value: ParticipationLevel, label: string }[] = [
  { value: 'active', label: 'نشط' },
  { value: 'good', label: 'جيد' },
  { value: 'quiet', label: 'هادئ' },
  { value: 'needs_encouragement', label: 'يحتاج تشجيع' }
];

const understandingOpts: { value: UnderstandingLevel, label: string }[] = [
  { value: 'excellent', label: 'ممتاز' },
  { value: 'good', label: 'جيد' },
  { value: 'developing', label: 'في تطور' },
  { value: 'needs_review', label: 'يحتاج مراجعة' }
];

const speakingOpts: { value: SpeakingLevel, label: string }[] = [
  { value: 'confident', label: 'واثق' },
  { value: 'good', label: 'جيد' },
  { value: 'improving', label: 'يتحسن' },
  { value: 'needs_practice', label: 'يحتاج تدريب' }
];

const focusOpts: { value: FocusLevel, label: string }[] = [
  { value: 'excellent', label: 'ممتاز' },
  { value: 'good', label: 'جيد' },
  { value: 'sometimes_distracted', label: 'يتشتت أحيانًا' },
  { value: 'needs_more_focus', label: 'يحتاج تركيز' }
];

const progressOpts: { value: ProgressLevel, label: string }[] = [
  { value: 'improved', label: '↑ تحسن' },
  { value: 'stable', label: '→ مستقر' },
  { value: 'needs_attention', label: '↓ تراجع' }
];

export const StudentSessionPerformanceSelector: React.FC<Props> = ({ performance, onChange, language = 'ar' }) => {
  const perf = performance || {};

  const handleUpdate = (updates: Partial<StudentSessionPerformance>) => {
    const newPerf = { ...perf, ...updates };
    
    // Auto-generate feedback if level is selected
    if (newPerf.level) {
      const generated = generateFeedback(newPerf, language as 'ar' | 'en' | 'de', newPerf.feedbackVariantId);
      newPerf.generatedFeedback = generated.feedback;
      newPerf.feedbackVariantId = generated.variantId;
      newPerf.feedbackLanguage = language;
      newPerf.generatedAt = new Date().toISOString();
    }
    
    onChange(newPerf);
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.preventDefault();
    if (perf.level) {
      const generated = generateFeedback(perf, language as 'ar' | 'en' | 'de', perf.feedbackVariantId);
      onChange({
        ...perf,
        generatedFeedback: generated.feedback,
        feedbackVariantId: generated.variantId,
        generatedAt: new Date().toISOString()
      });
    }
  };

  return (
    <div className="mt-4 border border-surface-border rounded-xl bg-surface-hover/30 overflow-hidden">
      <div className="bg-surface-border/40 px-3 py-2 flex items-center gap-2">
        <BarChart2 className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-[10.5px] font-black text-text-main">أداء الحصة (Session Performance)</span>
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
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-black text-text-muted">النص التلقائي (Generated Feedback)</span>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="flex items-center gap-1 text-[9px] font-bold text-primary hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    تغيير الصياغة
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
