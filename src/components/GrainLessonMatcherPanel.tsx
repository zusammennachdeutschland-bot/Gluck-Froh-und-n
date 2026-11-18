import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Sparkles,
  Check, X, BookOpen, ShieldCheck, Link2, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  Lesson,
  Group,
  Student,
  GrainDiscoveredRecording,
  GrainLessonMetadata,
  GrainEducationalDraft
} from '../types';
import {
  loadGrainIntegrationMeta,
  loadDiscoveredGrainRecordings,
  saveDiscoveredGrainRecordings,
  syncGrainRecordingsIncrementally,
  prepareConfirmedGrainLessonAttachment,
  recordConfirmedGrainGroupLearning,
  generateEducationalDraftForRecording,
  buildLernstudioDraftFromGrainEducationalDraft,
  isGrainRecordingUrl
} from '../services/grainService';
import { storage } from '../services/storageService';

interface GrainLessonMatcherPanelProps {
  selectedLesson: Lesson;
  lessons: Lesson[];
  groups: Group[];
  students: Student[];
  lessonRecordingLink: string;
  lessonRecordingLink2: string;
  lessonZoomMeetingLink: string;
  grainMeta?: GrainLessonMetadata;
  onChangeZoomMeetingLink: (url: string) => void;
  onApplyConfirmedMatch: (params: {
    targetSlot: 'part1' | 'part2';
    recordingUrl: string;
    updatedGrainMeta: GrainLessonMetadata;
    targetLessonId: string;
  }) => void;
  onApplyApprovedEducationalSummary: (params: {
    summaryTextAr: string;
    updatedGrainMeta: GrainLessonMetadata;
  }) => void;
  onApplyApprovedHomework: (homeworkText: string) => void;
  _t: (ar: string, en: string, de?: string) => string;
  triggerToast?: (msg: string) => void;
}

export const GrainLessonMatcherPanel: React.FC<GrainLessonMatcherPanelProps> = ({
  selectedLesson,
  lessons,
  groups,
  students,
  lessonRecordingLink,
  lessonRecordingLink2,
  lessonZoomMeetingLink,
  grainMeta,
  onChangeZoomMeetingLink,
  onApplyConfirmedMatch,
  onApplyApprovedEducationalSummary,
  onApplyApprovedHomework,
  _t,
  triggerToast
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<GrainDiscoveredRecording[]>([]);
  const [showAllRecordings, setShowAllRecordings] = useState(false);
  const [selectedTargetSlot, setSelectedTargetSlot] = useState<Record<string, 'part1' | 'part2'>>({});
  const [selectedAlternateLessonId, setSelectedAlternateLessonId] = useState<Record<string, string>>({});
  const [overwritePromptRecording, setOverwritePromptRecording] = useState<{
    recording: GrainDiscoveredRecording;
    slot: 'part1' | 'part2';
    existingUrl: string;
    targetLesson: Lesson;
  } | null>(null);

  // Educational Draft Review state (Sections 10 & 12)
  const [analyzingRecordingId, setAnalyzingRecordingId] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<GrainEducationalDraft | null>(null);
  const [editableSummaryAr, setEditableSummaryAr] = useState('');
  const [editableParentSummaryAr, setEditableParentSummaryAr] = useState('');
  const [editableHomeworkText, setEditableHomeworkText] = useState('');
  const [editableLernstudioTitle, setEditableLernstudioTitle] = useState('');
  const [lernstudioSavedIds, setLernstudioSavedIds] = useState<Record<string, boolean>>({});

  // Hydrate cached recordings & connection status
  useEffect(() => {
    const cached = loadDiscoveredGrainRecordings();
    setRecordings(cached);
    const meta = loadGrainIntegrationMeta();
    setConnected(meta.connected);
  }, [selectedLesson.id]);

  // Enrich current lesson with live form values for matching preview
  const effectiveLessons = useMemo(() => {
    return lessons.map((l) =>
      l.id === selectedLesson.id
        ? {
            ...l,
            recordingLink: lessonRecordingLink || l.recordingLink,
            recordingLink2: lessonRecordingLink2 || l.recordingLink2,
            zoomMeetingLink: lessonZoomMeetingLink || l.zoomMeetingLink,
            grainMeta: grainMeta || l.grainMeta
          }
        : l
    );
  }, [lessons, selectedLesson.id, lessonRecordingLink, lessonRecordingLink2, lessonZoomMeetingLink, grainMeta]);

  const handleSyncRecordings = async () => {
    setSyncing(true);
    setErrorMessage(null);
    try {
      const result = await syncGrainRecordingsIncrementally({
        lessons: effectiveLessons,
        groups,
        students
      });
      if (!result.success) {
        setErrorMessage(
          result.error ||
            _t(
              'تعذر جلب التسجيلات من Grain. تأكد من إعداد مفتاح الربط في الإعدادات.',
              'Could not fetch recordings from Grain. Verify your Personal API Token in Settings.',
              'Aufnahmen konnten nicht abgerufen werden. Bitte Token in den Einstellungen prüfen.'
            )
        );
        return;
      }
      setRecordings(result.recordings);
      setConnected(true);
      if (triggerToast) {
        triggerToast(
          _t(
            `تم فحص تسجيلات Grain (${result.recordings.length} تسجيل)`,
            `Synced ${result.recordings.length} Grain recordings`,
            `${result.recordings.length} Grain-Aufnahmen synchronisiert`
          )
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          _t(
            'تعذر جلب التسجيلات من Grain.',
            'Could not fetch recordings from Grain.',
            'Aufnahmen konnten nicht abgerufen werden.'
          )
      );
    } finally {
      setSyncing(false);
    }
  };

  // Filter recordings relevant to this lesson (same date or suggested for this lesson), or all if toggled
  const visibleRecordings = useMemo(() => {
    if (showAllRecordings) return recordings;
    return recordings.filter((rec) => {
      if (rec.suggestedLessonId === selectedLesson.id) return true;
      if (rec.confirmedLessonId === selectedLesson.id) return true;
      if (rec.evidence?.recordingDateLocal === selectedLesson.date) return true;
      if (rec.startDatetime?.startsWith(selectedLesson.date)) return true;
      if (rec.candidates.some((c) => c.lessonId === selectedLesson.id)) return true;
      return false;
    });
  }, [recordings, showAllRecordings, selectedLesson.id, selectedLesson.date]);

  const handleConfirmMatch = (
    rec: GrainDiscoveredRecording,
    slotOverride?: 'part1' | 'part2',
    forceOverwrite = false
  ) => {
    const slot = slotOverride || selectedTargetSlot[rec.id] || 'part1';
    const preferredSlot = slot === 'part2' ? 'recordingLink2' : 'recordingLink';
    const targetLessonId = selectedAlternateLessonId[rec.id] || selectedLesson.id;
    const targetLesson = effectiveLessons.find((l) => l.id === targetLessonId) || selectedLesson;

    try {
      const prepared = prepareConfirmedGrainLessonAttachment({
        lesson: targetLesson,
        recording: rec,
        preferredSlot,
        allowOverwrite: forceOverwrite
      });

      if (prepared.requiresOverwriteConfirmation && !forceOverwrite) {
        setOverwritePromptRecording({
          recording: rec,
          slot,
          existingUrl: prepared.existingUrlInTargetSlot || '',
          targetLesson
        });
        return;
      }

      setOverwritePromptRecording(null);
      onApplyConfirmedMatch({
        targetSlot: slot,
        recordingUrl: rec.recordingUrl,
        updatedGrainMeta: prepared.proposedLessonPatch.grainMeta!,
        targetLessonId: targetLesson.id
      });

      // Part 10: Persist Smart Group Learning record keyed by actual group.id
      recordConfirmedGrainGroupLearning({
        recording: rec,
        lesson: targetLesson,
        groups,
        students,
        previousSuggestedGroupId: rec.candidates?.[0]?.groupId || rec.matchedGroupId
      });

      // Mark locally as already_linked
      const nextList = recordings.map((item) =>
        item.id === rec.id
          ? {
              ...item,
              matchStatus: 'already_linked' as const,
              confirmedLessonId: targetLesson.id,
              matchedGroupId: targetLesson.groupId || undefined
            }
          : item
      );
      setRecordings(nextList);
      saveDiscoveredGrainRecordings(nextList);

      if (triggerToast) {
        triggerToast(
          _t(
            'تم تأكيد ربط تسجيل Grain بالحصة بنجاح',
            'Confirmed Grain recording link for lesson',
            'Grain-Aufnahme erfolgreich mit Lektion verknüpft'
          )
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to attach recording');
    }
  };

  const handleRejectMatch = (rec: GrainDiscoveredRecording) => {
    const nextList = recordings.map((item) =>
      item.id === rec.id
        ? { ...item, matchStatus: 'unmatched' as const, suggestedLessonId: undefined }
        : item
    );
    setRecordings(nextList);
    saveDiscoveredGrainRecordings(nextList);
  };

  const handleAnalyzeRecording = async (rec: GrainDiscoveredRecording) => {
    setAnalyzingRecordingId(rec.id);
    setErrorMessage(null);
    try {
      const res = await generateEducationalDraftForRecording(rec, {
        lesson: selectedLesson,
        students,
        includeTranscriptAnalysis: true
      });
      if (!res.success || !res.draft) {
        setErrorMessage(
          res.error ||
            _t(
              'تعذر استخراج المسودة التعليمية من التسجيل.',
              'Could not generate educational draft from recording.',
              'Entwurf konnte nicht erstellt werden.'
            )
        );
        return;
      }
      setActiveDraft(res.draft);
      setEditableSummaryAr(res.draft.whatWasCoveredAr);
      setEditableParentSummaryAr(res.draft.whatWasCoveredAr);
      const firstHw = res.draft.homework[0]?.description || '';
      setEditableHomeworkText(firstHw);
      setEditableLernstudioTitle(
        `Grain Draft: ${selectedLesson.title || rec.title} (${selectedLesson.date})`
      );
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          _t(
            'تعذر استخراج المسودة التعليمية من نص التسجيل.',
            'Could not generate educational draft from recording transcript.',
            'Entwurf konnte nicht aus dem Transkript erstellt werden.'
          )
      );
    } finally {
      setAnalyzingRecordingId(null);
    }
  };

  const handleApproveSummaryToLesson = () => {
    if (!activeDraft) return;
    const baseMeta: GrainLessonMetadata = grainMeta || {
      recordingId: activeDraft.recordingId,
      recordingTitle: selectedLesson.title || 'Grain Recording',
      startTimestamp: new Date().toISOString(),
      durationMinutes: selectedLesson.durationMinutes || 60,
      recordingUrl: lessonRecordingLink || 'https://grain.com',
      source: 'zoom',
      matchingStatus: 'confirmed',
      confirmedLessonId: selectedLesson.id,
      lastSyncedAt: new Date().toISOString()
    };
    const updatedMeta: GrainLessonMetadata = {
      ...baseMeta,
      approvedSummary: editableSummaryAr.trim(),
      approvedParentReportSummaryAr: editableParentSummaryAr.trim()
    };
    onApplyApprovedEducationalSummary({
      summaryTextAr: editableSummaryAr.trim(),
      updatedGrainMeta: updatedMeta
    });
    if (triggerToast) {
      triggerToast(
        _t(
          'تم اعتماد الملخص وإضافته إلى ملاحظات الحصة',
          'Approved summary and applied to lesson notes',
          'Zusammenfassung bestätigt und übernommen'
        )
      );
    }
  };

  const handleApproveHomeworkToLesson = () => {
    if (!editableHomeworkText.trim()) return;
    onApplyApprovedHomework(editableHomeworkText.trim());
    if (triggerToast) {
      triggerToast(
        _t(
          'تم اعتماد الواجب المقترح وإضافته إلى الحصة',
          'Approved homework suggestion and applied to lesson',
          'Hausaufgabe bestätigt und übernommen'
        )
      );
    }
  };

  const handleSaveApprovedLernstudioDraft = async () => {
    if (!activeDraft) return;
    const draftSet = buildLernstudioDraftFromGrainEducationalDraft(activeDraft, {
      title: editableLernstudioTitle.trim() || undefined,
      grade: selectedLesson.grade || 'A1',
      level: 'A1'
    });

    const raw = await storage.getItem<any>('ags19_lernstudio_data');
    let parsed: { customSets?: any[]; progress?: any } = { customSets: [], progress: {} };
    if (raw) {
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {}
      } else if (typeof raw === 'object') {
        parsed = raw;
      }
    }
    const existingSets = Array.isArray(parsed.customSets) ? parsed.customSets : [];
    parsed.customSets = [draftSet, ...existingSets];
    await storage.setItem('ags19_lernstudio_data', JSON.stringify(parsed));

    setLernstudioSavedIds((prev) => ({ ...prev, [activeDraft.recordingId]: true }));
    if (triggerToast) {
      triggerToast(
        _t(
          'تم حفظ مسودة Lernstudio المعتمدة في مكتبتك بنجاح!',
          'Approved Lernstudio draft saved to your library!',
          'Lernstudio-Entwurf in der Bibliothek gespeichert!'
        )
      );
    }
  };

  const renderMatchStatusBadge = (status: GrainDiscoveredRecording['matchStatus']) => {
    switch (status) {
      case 'strong_match':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            {_t('تطابق قوي (يحتاج تأكيدك)', 'Strong match', 'Starke Übereinstimmung')}
          </span>
        );
      case 'suggested_match':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            {_t('اقتراح ذكي', 'Suggested match', 'Vorschlag')}
          </span>
        );
      case 'needs_confirmation':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            {_t('يحتاج تأكيد المعلم', 'Needs confirmation', 'Bestätigung erforderlich')}
          </span>
        );
      case 'multiple_possible_lessons':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
            {_t('أكثر من حصة محتملة', 'Multiple possible lessons', 'Mehrere mögliche Lektionen')}
          </span>
        );
      case 'already_linked':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
            {_t('مرتبط بالفعل ✓', 'Already linked ✓', 'Bereits verknüpft ✓')}
          </span>
        );
      case 'inaccessible':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            {_t('غير متاح', 'Inaccessible', 'Nicht zugänglich')}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {_t('غير مرتبط', 'Unmatched', 'Nicht zugeordnet')}
          </span>
        );
    }
  };

  const isZoomFieldHoldingGrainUrl = isGrainRecordingUrl(lessonZoomMeetingLink);

  return (
    <div className="pt-2 border-t border-slate-100 dark:border-surface-border space-y-2">
      {/* Dedicated Zoom Meeting Link Input (Rule 1 separation: Zoom URL != Grain Recording URL) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
          <span className="flex items-center gap-1">
            <Link2 className="w-3 h-3 text-sky-600" />
            <span>
              {_t(
                'رابط اجتماع Zoom الأصلي (للتحقق من مصدر التسجيل)',
                'Zoom Meeting Link (for source verification)',
                'Zoom-Meeting-Link (zur Quellenprüfung)'
              )}
            </span>
          </span>
          {grainMeta?.matchingStatus === 'confirmed' && (
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" />
              <span>{_t('مرتبط بـ Grain ✓', 'Grain Confirmed ✓', 'Grain bestätigt ✓')}</span>
            </span>
          )}
        </div>
        <input
          type="url"
          value={lessonZoomMeetingLink}
          onChange={(e) => onChangeZoomMeetingLink(e.target.value)}
          className="w-full px-3 py-1.5 bg-surface-hover hover:bg-slate-50 focus:bg-white border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/50 font-mono text-left"
          placeholder="https://zoom.us/j/... (Zoom meeting link, separate from Grain link)"
          dir="ltr"
        />
        {isZoomFieldHoldingGrainUrl && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>
              {_t(
                'تنبيه: هذا رابط تسجيل Grain وليس رابط اجتماع Zoom. ضع رابط Grain في خانة التسجيل بالأعلى.',
                'Note: This is a Grain recording URL, not a Zoom meeting URL. Place Grain URLs in the recording field above.',
                'Hinweis: Dies ist eine Grain-Aufnahme-URL, keine Zoom-Meeting-URL.'
              )}
            </span>
          </p>
        )}
      </div>

      {/* Collapsible Grain Smart Assistant Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-[11px] font-black text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>
            {_t(
              'مساعد Grain الذكي (مطابقة التسجيلات ومسودة الشرح والواجب)',
              'Grain Assistant (Recording Matcher & Lesson Drafts)',
              'Grain-Assistent (Aufnahme-Abgleich & Entwürfe)'
            )}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isExpanded && (
          <button
            type="button"
            onClick={handleSyncRecordings}
            disabled={syncing}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-600 hover:bg-purple-700 text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            <span>
              {syncing
                ? _t('جاري الفحص...', 'Syncing...', 'Synchronisiere...')
                : _t('جلب التسجيلات من Grain', 'Fetch Grain Recordings', 'Aufnahmen abrufen')}
            </span>
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="p-2.5 sm:p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 space-y-2.5">
          {/* Mandatory Rule 2 & Rule 5 Notice */}
          <div className="flex items-center justify-between flex-wrap gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
            <span>
              {_t(
                'المطابقة تعتمد على التاريخ والوقت ورابط Zoom والمدة (ولا تغيّر غياب أو حضور الطلاب أبداً).',
                'Matching uses date, time, Zoom URL & duration (and never alters student attendance).',
                'Abgleich über Datum, Uhrzeit, Zoom-Link & Dauer (ändert niemals die Anwesenheit).'
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowAllRecordings((prev) => !prev)}
              className="font-black text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
            >
              {showAllRecordings
                ? _t('عرض تسجيلات هذا اليوم فقط', 'Show matching date only', 'Nur passendes Datum zeigen')
                : _t(`عرض كل التسجيلات (${recordings.length})`, `Show all (${recordings.length})`, `Alle anzeigen (${recordings.length})`)}
            </button>
          </div>

          {errorMessage && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Overwrite Confirmation Prompt */}
          {overwritePromptRecording && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2">
              <p className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                {_t(
                  `يوجد رابط تسجيل محفوظ بالفعل في (${overwritePromptRecording.slot === 'part1' ? 'الجزء 1' : 'الجزء 2'}). هل تريد استبداله برابط Grain المختار؟`,
                  `A recording link already exists in ${overwritePromptRecording.slot === 'part1' ? 'Part 1' : 'Part 2'}. Replace it with this Grain recording?`,
                  `Es existiert bereits ein Link in ${overwritePromptRecording.slot === 'part1' ? 'Teil 1' : 'Teil 2'}. Ersetzen?`
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleConfirmMatch(
                      overwritePromptRecording.recording,
                      overwritePromptRecording.slot,
                      true
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black cursor-pointer"
                >
                  {_t('نعم، استبدال الرابط', 'Yes, Replace Link', 'Ja, ersetzen')}
                </button>
                <button
                  type="button"
                  onClick={() => setOverwritePromptRecording(null)}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-slate-100 text-text-main border border-surface-border text-[10px] font-bold cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
              </div>
            </div>
          )}

          {/* Discovered Recordings List */}
          {visibleRecordings.length === 0 ? (
            <div className="text-center py-3 text-[11px] text-slate-500">
              {connected
                ? _t(
                    'لا توجد تسجيلات مطابقة لهذا التاريخ حالياً. اضغط "جلب التسجيلات من Grain" أو "عرض كل التسجيلات".',
                    'No matching recordings for this date yet. Click "Fetch Grain Recordings" or "Show all".',
                    'Noch keine passenden Aufnahmen für dieses Datum.'
                  )
                : _t(
                    'اربط حساب Grain من الإعدادات أو اضغط "جلب التسجيلات من Grain" للبدء.',
                    'Connect Grain in Settings or click "Fetch Grain Recordings" to start.',
                    'Grain in den Einstellungen verbinden oder Aufnahmen abrufen.'
                  )}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {visibleRecordings.map((rec) => {
                const candidateForCurrent = rec.candidates.find((c) => c.lessonId === selectedLesson.id);
                const topCandidate = candidateForCurrent || rec.candidates[0];
                const slot = selectedTargetSlot[rec.id] || 'part1';

                return (
                  <div
                    key={rec.id}
                    className="p-2.5 rounded-xl bg-surface border border-surface-border space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-text-main truncate">
                            {rec.title}
                          </span>
                          {renderMatchStatusBadge(rec.matchStatus)}
                          {topCandidate && (
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              {topCandidate.confidenceScore}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5 flex-wrap font-mono">
                          <span>📅 {rec.evidence?.recordingDateLocal || rec.startDatetime?.slice(0, 10) || '—'}</span>
                          <span>⏰ {rec.evidence?.recordingStartTimeLocal || rec.startDatetime?.slice(11, 16) || '—'}</span>
                          <span>
                            ⏱️ {rec.durationMinutes ? `${rec.durationMinutes} min` : '—'}
                          </span>
                          {rec.zoomMeetingUrl && (
                            <span className="text-sky-600 dark:text-sky-400">Zoom source ✓</span>
                          )}
                        </div>
                      </div>

                      {rec.recordingUrl && (
                        <a
                          href={rec.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-purple-600 hover:bg-purple-50 rounded-lg shrink-0"
                          title={_t('فتح في Grain', 'Open in Grain', 'In Grain öffnen')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Match Evidence Reasons */}
                    {topCandidate && topCandidate.evidence.reasons.length > 0 && (
                      <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                        <span className="font-bold">
                          {_t('أدلة المطابقة: ', 'Match Evidence: ', 'Abgleich-Nachweise: ')}
                        </span>
                        {topCandidate.evidence.reasons.join(' • ')}
                      </div>
                    )}

                    {/* Supplementary Participant Display (Rule 2: Display only, never modifies attendance) */}
                    {rec.participantNames && rec.participantNames.length > 0 && (
                      <div className="text-[10px] text-slate-500">
                        <span className="font-bold">
                          {_t(
                            'المشاركون في المكالمة (معلومة إضافية فقط): ',
                            'Call participants (supplementary info only): ',
                            'Teilnehmer (nur Zusatzinfo): '
                          )}
                        </span>
                        {rec.participantNames.join(', ')}
                      </div>
                    )}

                    {/* Multiple possible lessons selector */}
                    {rec.candidates.length > 1 && (
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="font-bold text-text-muted">
                          {_t('اختر الحصة:', 'Select lesson:', 'Lektion wählen:')}
                        </span>
                        <select
                          value={selectedAlternateLessonId[rec.id] || selectedLesson.id}
                          onChange={(e) =>
                            setSelectedAlternateLessonId((prev) => ({
                              ...prev,
                              [rec.id]: e.target.value
                            }))
                          }
                          className="px-2 py-1 rounded border border-surface-border bg-surface text-text-main text-[10px] font-bold"
                        >
                          {rec.candidates.map((cand) => (
                            <option key={cand.lessonId} value={cand.lessonId}>
                              {cand.lessonTitle} ({cand.lessonDate} {cand.lessonTime}) - {cand.confidenceScore}%
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Teacher Confirmation & Educational Analysis Actions */}
                    <div className="flex items-center justify-between flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <select
                          value={slot}
                          onChange={(e) =>
                            setSelectedTargetSlot((prev) => ({
                              ...prev,
                              [rec.id]: e.target.value as 'part1' | 'part2'
                            }))
                          }
                          className="px-2 py-1 rounded-lg border border-surface-border bg-surface-hover text-[10px] font-bold text-text-main"
                        >
                          <option value="part1">{_t('الجزء 1 (Part 1)', 'Part 1', 'Teil 1')}</option>
                          <option value="part2">{_t('الجزء 2 (Part 2)', 'Part 2', 'Teil 2')}</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleConfirmMatch(rec, slot)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>{_t('تأكيد الربط بالحصة', 'Confirm Match', 'Verknüpfung bestätigen')}</span>
                        </button>

                        {rec.matchStatus !== 'unmatched' && rec.matchStatus !== 'already_linked' && (
                          <button
                            type="button"
                            onClick={() => handleRejectMatch(rec)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-hover hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-surface-border text-[10px] font-bold cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>{_t('رفض الاقتراح', 'Reject', 'Ablehnen')}</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAnalyzeRecording(rec)}
                        disabled={analyzingRecordingId === rec.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900 text-purple-800 dark:text-purple-200 text-[10px] font-black cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>
                          {analyzingRecordingId === rec.id
                            ? _t('جاري التحليل...', 'Analyzing...', 'Analysiere...')
                            : _t('مسودة الشرح والواجب و Lernstudio', 'Review Lesson Draft', 'Entwurf prüfen')}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Teacher Review & Approval Panel for Educational Drafts (Sections 10, 11, 12) */}
          {activeDraft && (
            <div className="p-3 rounded-xl bg-surface border-2 border-purple-300 dark:border-purple-800 space-y-3 animate-scale-up">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h5 className="text-xs font-black text-text-main">
                    {_t(
                      'مراجعة واعتماد مسودة Grain التعليمية (بإشراف المعلم فقط)',
                      'Teacher Review & Approval: Grain Educational Draft',
                      'Lehrkraft-Prüfung: Grain-Unterrichtsentwurf'
                    )}
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDraft(null)}
                  className="p-1 text-text-muted hover:text-rose-500 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Lesson Summary & Parent Report Draft */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-text-main flex items-center justify-between">
                  <span>
                    {_t(
                      '1. ملخص ما تم شرحه في الحصة (قابل للتعديل قبل الاعتماد):',
                      '1. Lesson Summary (Editable before approval):',
                      '1. Zusammenfassung (vor Bestätigung bearbeitbar):'
                    )}
                  </span>
                </label>
                <textarea
                  value={editableSummaryAr}
                  onChange={(e) => {
                    setEditableSummaryAr(e.target.value);
                    setEditableParentSummaryAr(e.target.value);
                  }}
                  rows={2}
                  className="w-full p-2 rounded-lg border border-surface-border bg-surface-hover text-xs text-text-main"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApproveSummaryToLesson}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      {_t(
                        'اعتماد وإضافة إلى ملاحظات الحصة وتقرير ولي الأمر',
                        'Approve & Apply to Lesson Notes',
                        'Bestätigen & in Notizen übernehmen'
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. Homework Suggestions */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[11px] font-black text-text-main">
                    {_t('2. الواجب المقترح:', '2. Suggested Homework:', '2. Vorgeschlagene Hausaufgabe:')}
                  </span>
                  {activeDraft.homework[0] && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                      {activeDraft.homework[0].assignmentKind === 'explicitly_assigned_in_lesson'
                        ? _t('تم ذكره صراحة في الحصة', 'Explicitly assigned in lesson', 'Im Unterricht erwähnt')
                        : _t('تدريب مقترح من الذكاء الاصطناعي', 'AI-suggested practice', 'KI-Übungsvorschlag')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={editableHomeworkText}
                  onChange={(e) => setEditableHomeworkText(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-hover text-xs text-text-main"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApproveHomeworkToLesson}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-[10px] font-black cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>
                      {_t('اعتماد كواجب للحصة', 'Approve as Lesson Homework', 'Als Hausaufgabe übernehmen')}
                    </span>
                  </button>
                </div>
              </div>

              {/* 3. Extracted German Vocabulary & Grammar Preview + Lernstudio Draft Save */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-text-main flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                    <span>
                      {_t(
                        `3. مسودة Lernstudio (${activeDraft.vocabulary.length} كلمات • ${activeDraft.grammar.length} قواعد)`,
                        `3. Lernstudio Draft (${activeDraft.vocabulary.length} Vocab • ${activeDraft.grammar.length} Grammar)`,
                        `3. Lernstudio-Entwurf (${activeDraft.vocabulary.length} Vokabeln • ${activeDraft.grammar.length} Grammatik)`
                      )}
                    </span>
                  </span>
                </div>

                {activeDraft.vocabulary.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {activeDraft.vocabulary.slice(0, 8).map((v, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200 text-[10px] font-bold border border-purple-200 dark:border-purple-800/50"
                      >
                        {v.article ? `${v.article} ` : ''}{v.german} {v.arabic ? `(${v.arabic})` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {activeDraft.grammar.length > 0 && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 space-y-0.5">
                    {activeDraft.grammar.map((g, idx) => (
                      <div key={idx}>
                        <span className="font-black">{g.topic}:</span> {g.explanationAr}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={editableLernstudioTitle}
                    onChange={(e) => setEditableLernstudioTitle(e.target.value)}
                    className="flex-1 px-2.5 py-1 rounded-lg border border-surface-border bg-surface-hover text-xs text-text-main"
                    placeholder={_t('عنوان مجموعة Lernstudio', 'Lernstudio Set Title', 'Lernstudio-Titel')}
                  />
                  <button
                    type="button"
                    onClick={handleSaveApprovedLernstudioDraft}
                    disabled={Boolean(lernstudioSavedIds[activeDraft.recordingId])}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Layers className="w-3 h-3" />
                    <span>
                      {lernstudioSavedIds[activeDraft.recordingId]
                        ? _t('تم الحفظ في Lernstudio ✓', 'Saved to Lernstudio ✓', 'Gespeichert ✓')
                        : _t('اعتماد وحفظ في Lernstudio', 'Approve & Save to Lernstudio', 'In Lernstudio speichern')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
