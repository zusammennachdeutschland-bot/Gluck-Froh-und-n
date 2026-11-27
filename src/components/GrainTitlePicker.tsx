import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import {
  Lesson,
  Group,
  Student,
  GrainLessonMetadata,
  GrainEducationalDraft
} from '../types';
import {
  loadGrainIntegrationMeta,
  syncGrainRecordingsIncrementally,
  generateEducationalDraftForRecording
} from '../services/grainService';

interface GrainTitlePickerProps {
  selectedLesson: Lesson;
  lessons: Lesson[];
  groups: Group[];
  students: Student[];
  grainMeta?: GrainLessonMetadata;
  onApplyTitle: (params: { summaryTextAr: string; updatedGrainMeta: GrainLessonMetadata }) => void;
  onUpdateLesson?: (lessonId: string, patch: Partial<Lesson>) => void;
  _t: (ar: string, en: string, de?: string) => string;
  triggerToast?: (msg: string) => void;
}

/**
 * Q14 — compact Grain title picker, shown directly under "ما تم شرحه" in the
 * ONLINE lesson report. It reuses the buried GrainLessonMatcherPanel flow
 * (sync recordings → match this lesson's recording → generate the educational
 * draft → summaryOptions) but runs it automatically when the report opens and
 * shows only the 3–4 title options as buttons. Tapping one fills "ما تم شرحه".
 * The full panel below stays untouched for matching / homework / drafts.
 */
export const GrainTitlePicker: React.FC<GrainTitlePickerProps> = ({
  selectedLesson,
  lessons,
  groups,
  students,
  grainMeta,
  onApplyTitle,
  onUpdateLesson,
  _t,
  triggerToast
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-recording' | 'not-connected'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<GrainEducationalDraft | null>(null);
  const [appliedTitle, setAppliedTitle] = useState<string | null>(null);
  const ranForLessonRef = useRef<string | null>(null);

  // Same summaryOptions logic as GrainLessonMatcherPanel (up to 4 short titles).
  const summaryOptions = useMemo(() => {
    if (!draft) return [];
    const opts: string[] = [];
    const mainTitle = selectedLesson.title || draft.mainLearningObjectives[0] || 'درس اللغة الألمانية';
    opts.push(mainTitle);
    if (draft.grammar[0]) {
      opts.push(`شرح وتطبيق قاعدة: ${draft.grammar[0].topic}`);
    }
    if (draft.vocabulary.length > 0) {
      opts.push(`شرح المفردات والتطبيقات اللغوية الجديدة (${draft.vocabulary.length} كلمات)`);
    }
    const rawClean = draft.whatWasCoveredAr
      .replace(/^ملخص مقترح من Grain.*?[:\-]\s*/i, '')
      .split(/[.!?\n]/)[0]
      ?.trim();
    if (rawClean && rawClean.length > 5 && !opts.includes(rawClean)) {
      opts.push(rawClean);
    }
    return opts.slice(0, 4);
  }, [draft, selectedLesson.title]);

  // Automatic fetch + analysis when the report opens for this lesson.
  useEffect(() => {
    if (ranForLessonRef.current === selectedLesson.id) return;
    ranForLessonRef.current = selectedLesson.id;
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setErrorMessage(null);
      const meta = loadGrainIntegrationMeta();
      if (!meta.connected) {
        if (!cancelled) setStatus('not-connected');
        return;
      }
      try {
        const result = await syncGrainRecordingsIncrementally({
          lessons,
          groups,
          students,
          onUpdateLesson
        });
        if (cancelled) return;
        if (!result.success) {
          setErrorMessage(
            result.error ||
              _t(
                'تعذر جلب التسجيلات من Grain. تأكد من إعداد مفتاح الربط في الإعدادات.',
                'Could not fetch recordings from Grain. Verify your Personal API Token in Settings.',
                'Aufnahmen konnten nicht abgerufen werden. Bitte Token in den Einstellungen prüfen.'
              )
          );
          setStatus('error');
          return;
        }
        const recs = result.recordings;
        // Same match as the panel's visible recordings for this lesson.
        const matched =
          recs.find((r) => r.confirmedLessonId === selectedLesson.id) ||
          recs.find((r) => r.suggestedLessonId === selectedLesson.id) ||
          recs.find(
            (r) =>
              r.evidence?.recordingDateLocal === selectedLesson.date ||
              r.startDatetime?.startsWith(selectedLesson.date) ||
              r.candidates.some((c) => c.lessonId === selectedLesson.id)
          );
        if (!matched) {
          setStatus('no-recording');
          return;
        }
        const res = await generateEducationalDraftForRecording(matched, {
          lesson: selectedLesson,
          students,
          includeTranscriptAnalysis: true
        });
        if (cancelled) return;
        if (!res.success || !res.draft) {
          setErrorMessage(
            res.error ||
              _t(
                'تعذر استخراج المسودة التعليمية من التسجيل.',
                'Could not generate educational draft from recording.',
                'Entwurf konnte nicht erstellt werden.'
              )
          );
          setStatus('error');
          return;
        }
        setDraft(res.draft);
        setStatus('ready');
      } catch (err: any) {
        if (!cancelled) {
          setErrorMessage(
            err?.message ||
              _t(
                'تعذر جلب عنوان الحصة من Grain.',
                'Could not fetch the lesson title from Grain.',
                'Titel konnte nicht von Grain geladen werden.'
              )
          );
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesson.id]);

  const handlePick = (opt: string) => {
    const baseMeta: GrainLessonMetadata = grainMeta || {
      recordingId: draft?.recordingId || '',
      recordingTitle: selectedLesson.title || 'Grain Recording',
      startTimestamp: new Date().toISOString(),
      durationMinutes: selectedLesson.durationMinutes || 60,
      recordingUrl: grainMeta?.recordingUrl || 'https://grain.com',
      source: 'zoom',
      matchingStatus: 'confirmed',
      confirmedLessonId: selectedLesson.id,
      lastSyncedAt: new Date().toISOString()
    };
    onApplyTitle({
      summaryTextAr: opt,
      updatedGrainMeta: { ...baseMeta, approvedSummary: opt, approvedParentReportSummaryAr: opt }
    });
    setAppliedTitle(opt);
    if (triggerToast) {
      triggerToast(_t('تم اختيار عنوان الحصة وإضافته إلى "ما تم شرحه" ✓', 'Lesson title picked and added to "What was taught" ✓'));
    }
  };

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/60 dark:bg-purple-950/30 p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
        <span className="text-[11px] font-black text-purple-900 dark:text-purple-200">
          {_t('عنوان الحصة من Grain — دوس على واحد يتحط في "ما تم شرحه"', 'Lesson title from Grain — tap one to fill "What was taught"', 'Stundentitel von Grain — antippen zum Übernehmen')}
        </span>
      </div>

      {status === 'loading' && (
        <p className="text-[11px] text-text-muted font-medium flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {_t('جاري جلب تسجيل الحصة وتحليله من Grain...', 'Fetching & analyzing the lesson recording from Grain...', 'Aufnahme wird von Grain geladen & analysiert...')}
        </p>
      )}

      {status === 'not-connected' && (
        <p className="text-[11px] text-text-muted font-medium">
          {_t('Grain غير متصل — افتح "مساعد Grain الذكي" تحت للتفاصيل.', 'Grain is not connected — open the "Grain assistant" below for details.', 'Grain ist nicht verbunden — Details im „Grain-Assistenten“ unten.')}
        </p>
      )}

      {status === 'no-recording' && (
        <p className="text-[11px] text-text-muted font-medium">
          {_t('مفيش تسجيل مطابق للحصة دي في Grain.', 'No matching recording for this lesson in Grain.', 'Keine passende Aufnahme für diese Stunde in Grain.')}
        </p>
      )}

      {status === 'error' && (
        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </p>
      )}

      {status === 'ready' && summaryOptions.length === 0 && (
        <p className="text-[11px] text-text-muted font-medium">
          {_t('تم تحليل التسجيل بس مفيش عناوين مقترحة.', 'Recording analyzed, but no title suggestions.', 'Aufnahme analysiert, aber keine Titelvorschläge.')}
        </p>
      )}

      {status === 'ready' && summaryOptions.length > 0 && (
        <div className="space-y-1">
          {summaryOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handlePick(opt)}
              className={`w-full text-start px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-start gap-1.5 ${
                appliedTitle === opt
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
              }`}
            >
              {appliedTitle === opt ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <span className="text-purple-500 shrink-0 mt-0.5">•</span>
              )}
              <span>{appliedTitle === opt ? `${opt} ✓` : opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
