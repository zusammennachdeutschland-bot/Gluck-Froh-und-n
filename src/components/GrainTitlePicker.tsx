import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import {
  Lesson,
  Group,
  Student,
  GrainLessonMetadata,
  GrainEducationalDraft,
  GrainDiscoveredRecording
} from '../types';
import {
  loadGrainIntegrationMeta,
  loadDiscoveredGrainRecordings,
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
  // Called when the matched Grain recording is found, with the recording
  // URL(s) to write into the report's link field automatically. The modal
  // owns the field value; the picker only reports the URLs.
  onRecordingLinkFound?: (links: { recordingLink?: string; recordingLink2?: string }) => void;
  // Current values of the report's recording-link fields (local modal
  // state), so the picker never overwrites a link the teacher typed manually.
  currentRecordingLink?: string;
  currentRecordingLink2?: string;
  _t: (ar: string, en: string, de?: string) => string;
  triggerToast?: (msg: string) => void;
}

/**
 * Q14 — compact Grain title picker, shown directly under "ما تم شرحه" in the
 * ONLINE lesson report. It reuses the buried GrainLessonMatcherPanel flow
 * (sync recordings → match this lesson's recording → generate the educational
 * draft → summaryOptions) but runs it automatically when the report opens and
 * shows the title options as buttons. Tapping one fills "ما تم شرحه".
 * It also fills the report's recording-link field automatically from the
 * matched Grain recording (only when the field is still empty), and keeps
 * re-checking every 2 minutes while the report stays open when Grain has no
 * recording for the lesson yet. The full panel below stays untouched for
 * matching / homework / drafts.
 */
export const GrainTitlePicker: React.FC<GrainTitlePickerProps> = ({
  selectedLesson,
  lessons,
  groups,
  students,
  grainMeta,
  onApplyTitle,
  onUpdateLesson,
  onRecordingLinkFound,
  currentRecordingLink,
  currentRecordingLink2,
  _t,
  triggerToast
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-recording' | 'not-connected' | 'waiting'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<GrainEducationalDraft | null>(null);
  const [appliedTitle, setAppliedTitle] = useState<string | null>(null);
  const ranForLessonRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  // Latest report link-field values, kept in a ref so the async fetch loop
  // always sees the current value — even if the teacher typed a link into
  // the field while the picker was still waiting for the recording.
  const currentLinksRef = useRef({ link: '', link2: '' });
  currentLinksRef.current = { link: currentRecordingLink || '', link2: currentRecordingLink2 || '' };

  // Strip markdown markers from a title option ("#", "**", "__", backticks,
  // leading bullets). A bare markdown heading (e.g. "## Summary") is not a
  // title at all and must never appear as an option.
  const stripMarkdown = (text: string): string =>
    text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/#/g, '')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .replace(/^[-*•]\s+/gm, '')
      .trim();
  const isBareHeading = (text: string): boolean =>
    /^(summary|ملخص|zusammenfassung|overview)$/i.test(text.trim());

  // Lesson titles ONLY. The grammar option ("شرح وتطبيق قاعدة: …") appears
  // only when the lesson itself IS a grammar lesson: the AI summary or the
  // recording title must literally name the rule (draft.grammar[].explicit,
  // set in grainService). Inferred matches — e.g. "gespielt" matching
  // Perfekt in a hobbies lesson — never produce a grammar option.
  const summaryOptions = useMemo(() => {
    if (!draft) return [];
    const opts: string[] = [];
    const pushOpt = (raw?: string) => {
      const clean = raw ? stripMarkdown(raw) : '';
      if (!clean || isBareHeading(clean) || opts.includes(clean)) return;
      opts.push(clean);
    };
    // Lesson title first. Never fall back to an inferred grammar topic as the
    // title when the lesson has no title of its own.
    let mainTitle = selectedLesson.title || draft.mainLearningObjectives[0] || 'درس اللغة الألمانية';
    if (!selectedLesson.title && draft.grammar.some((g) => g.topic === mainTitle && !g.explicit)) {
      mainTitle = 'درس اللغة الألمانية';
    }
    pushOpt(mainTitle);
    const explicitGrammar = draft.grammar.find((g) => g.explicit);
    if (explicitGrammar) {
      pushOpt(`شرح وتطبيق قاعدة: ${explicitGrammar.topic}`);
    }
    if (draft.vocabulary.length > 0) {
      const vocabCount = draft.vocabulary.length;
      pushOpt(`شرح المفردات والتطبيقات اللغوية الجديدة (${vocabCount} ${vocabCount === 1 ? 'كلمة' : 'كلمات'})`);
    }
    // Second vocabulary option: the actual new words (with articles), so the
    // teacher can pick a word-list title instead of the generic count line.
    const topWords = draft.vocabulary
      .filter((v) => (v.confidence === 'high' || v.confidence === 'medium') && v.german?.trim())
      .slice(0, 3)
      .map((v) => `${v.article ? `${v.article} ` : ''}${stripMarkdown(v.german)}`.trim());
    if (topWords.length > 0) {
      const wordsOpt = `مفردات جديدة: ${topWords.join('، ')}`;
      if (wordsOpt.length <= 80) pushOpt(wordsOpt);
    }
    // More title-shaped learning objectives (not just the first one).
    for (const obj of draft.mainLearningObjectives.slice(1, 3)) {
      const clean = stripMarkdown(obj);
      if (clean && clean.length > 5 && clean.length < 60 && !/\(\s*\d/.test(clean)) {
        pushOpt(clean);
      }
    }
    const summarySentences = draft.whatWasCoveredAr
      .replace(/^ملخص مقترح من Grain.*?[:\-]\s*/i, '')
      .split(/[.!?\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    // P2-N7: a full descriptive sentence ("تمت مناقشة موضوع …") or a
    // "حصة مسجلة بعنوان … (60 دقيقة)" line is not a title — only offer
    // sentences that already look like a short title, up to 3 of them.
    let addedSentences = 0;
    for (const sentence of summarySentences) {
      if (addedSentences >= 3) break;
      const clean = stripMarkdown(sentence);
      if (
        clean.length > 5 &&
        clean.length < 60 &&
        !/\(\s*\d/.test(clean) &&
        !/^تمت\s/.test(clean) &&
        !/حصة مسجلة/.test(clean)
      ) {
        const before = opts.length;
        pushOpt(clean);
        if (opts.length > before) addedSentences += 1;
      }
    }
    return opts.slice(0, 10);
  }, [draft, selectedLesson.title]);

  // Retry cadence while the report stays open and Grain has no recording
  // for this lesson yet (e.g. Grain is still processing it). Stops after
  // ~30 minutes of retries.
  const RETRY_INTERVAL_MS = 2 * 60 * 1000;
  const MAX_RETRIES = 15;

  // Automatic fetch + analysis when the report opens for this lesson, plus
  // live refresh: when Grain has no recording yet, re-check every 2 minutes
  // until one appears, then fill the recording link and the title options
  // automatically.
  useEffect(() => {
    if (ranForLessonRef.current === selectedLesson.id) return;
    ranForLessonRef.current = selectedLesson.id;
    retryCountRef.current = 0;
    let cancelled = false;
    // P1-N1: abort the in-flight Grain sync/draft when the report closes or
    // the lesson changes, so a hung request cannot update a dead report.
    const abortController = new AbortController();

    // Write the matched recording's URL into the report's link field, but
    // ONLY when the field is still empty — never overwrite a link the
    // teacher typed manually. The part-2 slot comes from the sync result's
    // lessonPatches when present (the sync already detects part 1 / part 2
    // pairs), otherwise from the matched recording itself.
    const fillRecordingLink = (
      rec: GrainDiscoveredRecording,
      patch?: Partial<Lesson>
    ): boolean => {
      const cur = currentLinksRef.current;
      const part1Url =
        patch?.recordingLink || (rec.detectedPartSlot !== 'part2' ? rec.recordingUrl : undefined);
      const part2Url =
        patch?.recordingLink2 || (rec.detectedPartSlot === 'part2' ? rec.recordingUrl : undefined);
      const links: { recordingLink?: string; recordingLink2?: string } = {};
      if (part1Url && !(cur.link || '').trim()) links.recordingLink = part1Url.trim();
      if (part2Url && !(cur.link2 || '').trim()) links.recordingLink2 = part2Url.trim();
      if (Object.keys(links).length === 0) return false;
      onRecordingLinkFound?.(links);
      // Persist on the lesson too (idempotent with what the sync already
      // applied via lessonPatches).
      onUpdateLesson?.(selectedLesson.id, links);
      return true;
    };

    type AttemptOutcome = 'found' | 'not-found' | 'error';
    const runAttempt = async (forceFresh: boolean): Promise<AttemptOutcome> => {
      setStatus('loading');
      setErrorMessage(null);
      const meta = loadGrainIntegrationMeta();
      if (!meta.connected) {
        if (!cancelled) setStatus('not-connected');
        return 'error';
      }
      try {
        // P1-N1: do not re-fetch when the last successful Grain sync was
        // recent (5 min) — the locally cached recordings are fresh enough.
        // Retries bypass this guard: they must actually re-fetch, otherwise
        // a recording that finished processing on Grain would never appear.
        const lastSyncMs = Date.parse(meta.lastSuccessfulSyncAt || '');
        const syncIsRecent =
          !forceFresh && Number.isFinite(lastSyncMs) && Date.now() - lastSyncMs < 5 * 60 * 1000;
        const result = syncIsRecent
          ? {
              success: true as const,
              recordings: loadDiscoveredGrainRecordings(),
              newCount: 0,
              lessonPatches: undefined as Record<string, Partial<Lesson>> | undefined
            }
          : await syncGrainRecordingsIncrementally({
              lessons,
              groups,
              students,
              onUpdateLesson,
              signal: abortController.signal
            });
        if (cancelled) return 'error';
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
          return 'error';
        }
        const recs = result.recordings;
        // Same match as the panel's visible recordings for this lesson.
        // P1-N4: the date-only fallback must ALSO match the lesson time
        // (within +-30 minutes) AND the same group — otherwise a day with
        // two lessons for different groups could fill in the wrong title.
        const lessonStartMs = (() => {
          const timePart = (selectedLesson.time || '').match(/(\d{1,2}):(\d{2})/);
          if (!timePart) return NaN;
          return Date.parse(
            `${selectedLesson.date}T${timePart[1].padStart(2, '0')}:${timePart[2]}:00`
          );
        })();
        const matchesDateFallback = (r: (typeof recs)[number]) => {
          const sameDate =
            r.evidence?.recordingDateLocal === selectedLesson.date ||
            r.startDatetime?.startsWith(selectedLesson.date);
          if (!sameDate) return false;
          const recMs = Date.parse(r.startDatetime || '');
          if (!Number.isFinite(lessonStartMs) || !Number.isFinite(recMs)) return false;
          if (Math.abs(recMs - lessonStartMs) > 30 * 60 * 1000) return false;
          return r.matchedGroupId === selectedLesson.groupId;
        };
        const matched =
          recs.find((r) => r.confirmedLessonId === selectedLesson.id) ||
          recs.find((r) => r.suggestedLessonId === selectedLesson.id) ||
          recs.find(
            (r) =>
              matchesDateFallback(r) ||
              r.candidates.some((c) => c.lessonId === selectedLesson.id)
          );
        if (!matched) {
          return 'not-found';
        }
        // Fill the recording link now, before draft generation — so the link
        // lands in the report even if generating the draft fails.
        fillRecordingLink(matched, result.lessonPatches?.[selectedLesson.id]);
        const res = await generateEducationalDraftForRecording(matched, {
          lesson: selectedLesson,
          students,
          includeTranscriptAnalysis: true
        });
        if (cancelled) return 'error';
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
          return 'error';
        }
        setDraft(res.draft);
        setStatus('ready');
        return 'found';
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
        return 'error';
      }
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      if (retryCountRef.current >= MAX_RETRIES) {
        if (!cancelled) setStatus('no-recording');
        return;
      }
      retryCountRef.current += 1;
      if (!cancelled) setStatus('waiting');
      retryTimerRef.current = setTimeout(async () => {
        if (cancelled) return;
        const outcome = await runAttempt(true);
        if (!cancelled && outcome === 'not-found') scheduleRetry();
      }, RETRY_INTERVAL_MS);
    };

    (async () => {
      const outcome = await runAttempt(false);
      if (!cancelled && outcome === 'not-found') scheduleRetry();
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
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

      {status === 'waiting' && (
        <p className="text-[11px] text-text-muted font-medium flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {_t('لسه التسجيل متجهزش على Grain — هعيد المحاولة تلقائياً كل دقيقتين.', 'Recording not ready on Grain yet — retrying automatically every 2 minutes.', 'Aufnahme in Grain noch nicht fertig — automatischer erneuter Versuch alle 2 Minuten.')}
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
