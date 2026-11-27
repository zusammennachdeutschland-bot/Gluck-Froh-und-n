import React, { useMemo, useState } from 'react';

/**
 * Quick-insert presets for the lesson report (Item 3 — UX batch).
 *
 * Each picker shows a dropdown with the full preset list plus the 3 most-used
 * presets as quick buttons beside it. Both are ordered by usage frequency
 * (most-chosen first); usage counts persist in localStorage so the ordering
 * survives reloads. Tapping a preset appends one line to the field — lines
 * stay editable/deletable because the fields are plain textareas.
 * The "(عنوان الدرس)" placeholder is auto-filled from the chosen lesson
 * title (Grain title picker / lesson title); every other placeholder
 * (e.g. "(اسم القاعدة)", "…") is left for the teacher to fill in the text.
 */

export interface ReportPreset {
  id: string;
  text: string;
}

export const REPORT_PRESET_USAGE_KEY = 'glueck_report_preset_usage_v1';

export const HOMEWORK_REPORT_PRESETS: ReportPreset[] = [
  { id: 'hw-memorize-lesson', text: 'حفظ (عنوان الدرس)' },
  { id: 'hw-review-lesson', text: 'مراجعة (عنوان الدرس)' },
  { id: 'hw-exercises-page', text: 'حل تدريبات صفحة …' },
  { id: 'hw-memorize-new-words', text: 'حفظ الكلمات الجديدة' },
  { id: 'hw-write-sentences', text: 'كتابة جمل بالكلمات الجديدة' },
  { id: 'hw-read-text-page', text: 'قراءة نص صفحة …' },
  { id: 'hw-exercises-range', text: 'حل تدريبات من صفحة … إلى صفحة …' },
  { id: 'hw-review-rule', text: 'مراجعة قاعدة (اسم القاعدة)' },
  { id: 'hw-prepare-next-lesson', text: 'تحضير الدرس القادم (عنوانه)' },
  { id: 'hw-redo-wrong-exercises', text: 'إعادة حل التمارين الخاطئة' },
  { id: 'hw-memorize-verbs', text: 'حفظ الأفعال + تصريفها' },
  { id: 'hw-listen-text-page', text: 'استماع لنص صفحة …' },
];

export const EXPLANATION_REPORT_PRESETS: ReportPreset[] = [
  { id: 'exp-explain-rule', text: 'شرح قاعدة (اسم القاعدة)' },
  { id: 'exp-explain-apply-rule', text: 'شرح وتطبيق قاعدة (اسم القاعدة)' },
  { id: 'exp-review-rule', text: 'مراجعة قاعدة (اسم القاعدة)' },
  { id: 'exp-explain-new-vocab', text: 'شرح المفردات الجديدة' },
  { id: 'exp-conversation-practice', text: 'تدريب على المحادثة' },
  { id: 'exp-read-understand-text', text: 'قراءة وفهم نص (عنوانه)' },
  { id: 'exp-solve-exercises', text: 'حل تدريبات (الموضوع)' },
  { id: 'exp-conjugate-verbs', text: 'تصريف الأفعال (اسم الفعل)' },
  { id: 'exp-review-game', text: 'لعبة مراجعة' },
  { id: 'exp-short-quiz', text: 'اختبار قصير' },
];

function readUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(REPORT_PRESET_USAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const usage: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        usage[key] = Math.floor(value);
      }
    }
    return usage;
  } catch {
    return {};
  }
}

interface ReportPresetPickerProps {
  presets: ReportPreset[];
  /** Chosen lesson title (from the Grain title picker / lesson title); '' when unknown. */
  lessonTitle: string;
  /** Called with the resolved line to append to the field. */
  onInsert: (line: string) => void;
}

export const ReportPresetPicker: React.FC<ReportPresetPickerProps> = ({
  presets,
  lessonTitle,
  onInsert,
}) => {
  const [usage, setUsage] = useState<Record<string, number>>(readUsage);

  // Most-chosen first; ties keep the original list order.
  const orderedPresets = useMemo(
    () =>
      presets
        .map((preset, index) => ({ preset, index, count: usage[preset.id] || 0 }))
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .map(({ preset }) => preset),
    [presets, usage]
  );

  const quickPresets = orderedPresets.slice(0, 3);

  const insertPreset = (preset: ReportPreset) => {
    const title = lessonTitle.trim();
    const line = title ? preset.text.split('(عنوان الدرس)').join(title) : preset.text;
    // Read fresh from storage so the sibling picker (homework / explanation)
    // sharing the same key cannot have its counts overwritten.
    const stored = readUsage();
    const next = { ...stored, [preset.id]: (stored[preset.id] || 0) + 1 };
    try {
      localStorage.setItem(REPORT_PRESET_USAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (e.g. private mode) — insertion still works.
    }
    setUsage(next);
    onInsert(line);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value=""
        onChange={(e) => {
          const preset = presets.find((p) => p.id === e.target.value);
          if (preset) insertPreset(preset);
        }}
        className="min-w-0 flex-1 px-2 py-1.5 bg-surface border border-surface-border rounded-lg text-[11px] font-bold text-text-main outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        title="إدراج قالب جاهز"
      >
        <option value="" disabled>
          ＋ إدراج قالب جاهز…
        </option>
        {orderedPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.text}
          </option>
        ))}
      </select>
      {quickPresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => insertPreset(preset)}
          title={preset.text}
          className="max-w-[9.5rem] whitespace-normal leading-tight line-clamp-2 text-center px-2 py-1.5 bg-primary-soft hover:bg-primary/20 text-primary border border-primary-border rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
        >
          {preset.text}
        </button>
      ))}
    </div>
  );
};
