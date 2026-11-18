import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Sparkles,
  Check, X, BookOpen, ShieldCheck, Link2, Layers, ChevronDown, ChevronUp, Edit3
} from 'lucide-react';
import {
  Lesson,
  Group,
  Student,
  GrainDiscoveredRecording,
  GrainLessonMetadata,
  GrainEducationalDraft,
  GrainWorkflowStatusBadge
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
  isGrainRecordingUrl,
  extractStructuredLessonContentForLesson,
  applyExtractedLessonContentToLesson,
  saveTeacherEditedGrainLessonContent,
  acceptPendingUpdatedLessonExtraction,
  detectGrainTwoPartRecordingPairs
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
  onUpdateLesson?: (lessonId: string, patch: Partial<Lesson>) => void;
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
  onUpdateLesson,
  _t,
  triggerToast
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [extractingContent, setExtractingContent] = useState(false);
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

  // 7-Section German Extracted Content Editor State
  const [isEditingExtractedContent, setIsEditingExtractedContent] = useState(false);
  const [editThema, setEditThema] = useState('');
  const [editInhalteText, setEditInhalteText] = useState('');
  const [editBeispieleText, setEditBeispieleText] = useState('');
  const [editUebungenText, setEditUebungenText] = useState('');
  const [editOffenePunkteText, setEditOffenePunkteText] = useState('');

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

  const effectiveSelectedLesson = useMemo(
    () => effectiveLessons.find((l) => l.id === selectedLesson.id) || selectedLesson,
    [effectiveLessons, selectedLesson]
  );

  const handleSyncRecordings = async () => {
    setSyncing(true);
    setErrorMessage(null);
    try {
      const result = await syncGrainRecordingsIncrementally({
        lessons: effectiveLessons,
        groups,
        students,
        onUpdateLesson
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

  const handleRunLessonContentExtraction = async (lessonToExtract: Lesson, recsList: GrainDiscoveredRecording[]) => {
    setExtractingContent(true);
    try {
      const extracted = await extractStructuredLessonContentForLesson({
        lesson: lessonToExtract,
        recordings: recsList
      });
      const applied = applyExtractedLessonContentToLesson(lessonToExtract, extracted);
      if (applied.updated && onUpdateLesson) {
        onUpdateLesson(lessonToExtract.id, applied.lessonPatch);
      }
    } catch {
      // Handled gracefully by extractor status
    } finally {
      setExtractingContent(false);
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

  const handleConfirmMatch = async (
    rec: GrainDiscoveredRecording,
    slotOverride?: 'part1' | 'part2',
    forceOverwrite = false
  ) => {
    const slot = slotOverride || selectedTargetSlot[rec.id] || (rec.detectedPartSlot === 'part2' ? 'part2' : 'part1');
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
      let workingLesson: Lesson = {
        ...targetLesson,
        ...prepared.proposedLessonPatch
      };

      onApplyConfirmedMatch({
        targetSlot: slot,
        recordingUrl: rec.recordingUrl,
        updatedGrainMeta: prepared.proposedLessonPatch.grainMeta!,
        targetLessonId: targetLesson.id
      });

      // Requirement 1: First-Time Manual Assignment = Permanent Recurring Learning
      recordConfirmedGrainGroupLearning({
        recording: rec,
        lesson: targetLesson,
        groups,
        students,
        previousSuggestedGroupId: rec.candidates?.[0]?.groupId || rec.matchedGroupId,
        previousSuggestedLessonId: rec.candidates?.[0]?.lessonId || rec.suggestedLessonId
      });

      // Requirement 3: When Part 1 is matched, automatically check for an unambiguous Part 2 (~40-42m gap)
      const pairedList = detectGrainTwoPartRecordingPairs({
        recordings: recordings.map((item) =>
          item.id === rec.id
            ? {
                ...item,
                matchStatus: 'already_linked' as const,
                confirmedLessonId: targetLesson.id,
                matchedGroupId: targetLesson.groupId || undefined
              }
            : item
        ),
        lessons: effectiveLessons.map((l) => (l.id === workingLesson.id ? workingLesson : l)),
        groups,
        students
      });

      const pairedPart2 = pairedList.find(
        (r) =>
          r.id !== rec.id &&
          r.pairedRecordingId === rec.id &&
          r.detectedPartSlot === 'part2' &&
          r.matchStatus === 'automatically_matched'
      );

      if (pairedPart2 && !(workingLesson.recordingLink2 || '').trim()) {
        const part2Prepared = prepareConfirmedGrainLessonAttachment({
          lesson: workingLesson,
          recording: pairedPart2,
          preferredSlot: 'recordingLink2',
          allowOverwrite: false,
          matchedAutomatically: true
        });
        if (!part2Prepared.requiresOverwriteConfirmation) {
          workingLesson = {
            ...workingLesson,
            ...part2Prepared.proposedLessonPatch
          };
          onApplyConfirmedMatch({
            targetSlot: 'part2',
            recordingUrl: pairedPart2.recordingUrl,
            updatedGrainMeta: part2Prepared.proposedLessonPatch.grainMeta!,
            targetLessonId: targetLesson.id
          });
        }
      }

      const nextList = pairedList.map((item) =>
        item.id === rec.id || (pairedPart2 && item.id === pairedPart2.id)
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

      // Requirement 4 & 5: Automatically extract and save 7-section German lesson content
      await handleRunLessonContentExtraction(workingLesson, nextList);

      if (triggerToast) {
        triggerToast(
          _t(
            'تم تأكيد ربط تسجيل Grain وحفظ نمط الحصة المتكررة واستخراج المحتوى بنجاح',
            'Confirmed Grain link, learned recurring pattern & extracted lesson content',
            'Grain-Aufnahme bestätigt, Serienmuster gelernt & Unterrichtsinhalt extrahiert'
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

  const handleStartEditExtractedContent = () => {
    const ext = effectiveSelectedLesson.grainMeta?.extractedLessonContent;
    if (!ext) return;
    setEditThema(ext.themaDerStunde || '');
    setEditInhalteText((ext.behandelteInhalte || []).join('\n'));
    setEditBeispieleText((ext.beispiele || []).join('\n'));
    setEditUebungenText((ext.uebungenUndAktivitaeten || []).join('\n'));
    setEditOffenePunkteText((ext.offenePunkte || []).join('\n'));
    setIsEditingExtractedContent(true);
  };

  const handleSaveEditedExtractedContent = () => {
    const patch = saveTeacherEditedGrainLessonContent(effectiveSelectedLesson, {
      themaDerStunde: editThema.trim(),
      behandelteInhalte: editInhalteText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      beispiele: editBeispieleText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      uebungenUndAktivitaeten: editUebungenText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      offenePunkte: editOffenePunkteText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    });
    if (onUpdateLesson) {
      onUpdateLesson(effectiveSelectedLesson.id, patch);
    }
    setIsEditingExtractedContent(false);
    if (triggerToast) {
      triggerToast(
        _t(
          'تم حفظ تعديلات المعلم على ملخص الحصة (محمية من الاستبدال التلقائي)',
          'Saved teacher-edited lesson summary (protected from auto-overwrite)',
          'Lehrkraft-Bearbeitung gespeichert (vor Überschreiben geschützt)'
        )
      );
    }
  };

  const handleAcceptPendingUpdatedExtraction = () => {
    const patch = acceptPendingUpdatedLessonExtraction(effectiveSelectedLesson);
    if (onUpdateLesson && Object.keys(patch).length > 0) {
      onUpdateLesson(effectiveSelectedLesson.id, patch);
    }
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

  const renderWorkflowBadge = (badge: GrainWorkflowStatusBadge) => {
    switch (badge) {
      case 'automatically_matched':
        return (
          <span
            key={badge}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
          >
            {_t('مطابقة تلقائية ✓', 'Automatically matched', 'Automatisch zugeordnet')}
          </span>
        );
      case 'part1_detected':
        return (
          <span
            key={badge}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60"
          >
            {_t('تم اكتشاف الجزء 1', 'Part 1 detected', 'Teil 1 erkannt')}
          </span>
        );
      case 'part2_detected':
        return (
          <span
            key={badge}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
          >
            {_t('تم اكتشاف الجزء 2 (+40د)', 'Part 2 detected', 'Teil 2 erkannt')}
          </span>
        );
      case 'lesson_content_extracted':
        return (
          <span
            key={badge}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
          >
            {_t('تم استخراج محتوى الحصة ✓', 'Lesson content extracted', 'Unterrichtsinhalt extrahiert')}
          </span>
        );
      case 'transcript_unavailable':
        return (
          <span
            key={badge}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
          >
            {_t('النص غير متاح', 'Transcript unavailable', 'Transkript nicht verfügbar')}
          </span>
        );
      case 'needs_teacher_confirmation':
        return (
          <span
            key={badge}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
          >
            {_t('يحتاج تأكيد المعلم', 'Needs teacher confirmation', 'Bestätigung erforderlich')}
          </span>
        );
      default:
        return null;
    }
  };

  const renderMatchStatusBadge = (status: GrainDiscoveredRecording['matchStatus']) => {
    switch (status) {
      case 'automatically_matched':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            {_t('تمت المطابقة تلقائياً ✓', 'Automatically matched', 'Automatisch zugeordnet')}
          </span>
        );
      case 'strong_match':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            {_t('تطابق قوي (يحتاج تأكيدك لمرة واحدة)', 'Strong match (Confirm once)', 'Starke Übereinstimmung')}
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
            {_t('يحتاج تأكيد المعلم', 'Needs teacher confirmation', 'Bestätigung erforderlich')}
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
  const extractedContent = effectiveSelectedLesson.grainMeta?.extractedLessonContent;
  const lessonWorkflowBadges = effectiveSelectedLesson.grainMeta?.workflowStatuses || [];

  return (
    <div className="pt-2 border-t border-slate-100 dark:border-surface-border space-y-2">
      {/* Dedicated Zoom Meeting Link Input (Rule 1 separation: Zoom URL != Grain Recording URL) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between flex-wrap gap-1 text-[11px] font-bold text-text-muted">
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
          <div className="flex items-center gap-1 flex-wrap">
            {lessonWorkflowBadges.map((b) => renderWorkflowBadge(b))}
            {grainMeta?.matchingStatus === 'confirmed' && (
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>{_t('مرتبط بـ Grain ✓', 'Grain Confirmed ✓', 'Grain bestätigt ✓')}</span>
              </span>
            )}
          </div>
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

      {/* Requirement 4, 5 & 6: Structured 7-Section German Lesson Summary Card */}
      {extractedContent && (
        <div className="p-2.5 rounded-xl bg-surface border border-purple-200 dark:border-purple-900/60 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[11px] font-black text-text-main">
                {_t(
                  'محتوى الحصة المستخرج من Grain (7 أقسام تعليمية)',
                  'Extracted Lesson Content from Grain (7 German Sections)',
                  'Extrahierter Unterrichtsinhalt aus Grain (7 Abschnitte)'
                )}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                  extractedContent.teacherEdited || extractedContent.origin === 'teacher_edited'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                }`}
              >
                {extractedContent.teacherEdited || extractedContent.origin === 'teacher_edited'
                  ? _t('معدّل بواسطة المعلم ✓', 'Teacher-edited ✓', 'Von Lehrkraft bearbeitet ✓')
                  : _t('مستخرج من Grain (Transcript & AI Notes)', 'Grain Transcript & AI Notes', 'Grain-Transkript & KI-Notizen')}
              </span>
              {extractedContent.partCount === 2 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {_t('مدمج (الجزء 1 + الجزء 2)', 'Merged (Part 1 + Part 2)', 'Zusammengeführt (Teil 1 + Teil 2)')}
                </span>
              )}
            </div>

            {extractedContent.transcriptStatus !== 'transcript_unavailable' && !isEditingExtractedContent && (
              <button
                type="button"
                onClick={handleStartEditExtractedContent}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-text-main cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>{_t('تعديل الأقسام', 'Edit Sections', 'Abschnitte bearbeiten')}</span>
              </button>
            )}
          </div>

          {extractedContent.transcriptStatus === 'transcript_unavailable' ? (
            <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 text-[11px] text-amber-800 dark:text-amber-200">
              {_t(
                'النص الكامل وملاحظات AI Notes غير متاحة حالياً من Grain لهذا التسجيل. لم يتم توليد أي محتوى افتراضي.',
                'Transcript and AI Notes are unavailable from Grain for this recording. No fabricated content was generated.',
                'Transkript und KI-Notizen in Grain nicht verfügbar. Es wurden keine künstlichen Inhalte erzeugt.'
              )}
            </div>
          ) : isEditingExtractedContent ? (
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-text-muted block">Thema der Stunde:</label>
                <input
                  type="text"
                  value={editThema}
                  onChange={(e) => setEditThema(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-surface-border bg-surface-hover text-xs"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-text-muted block">
                    Behandelte Inhalte (1 pro Zeile):
                  </label>
                  <textarea
                    rows={3}
                    value={editInhalteText}
                    onChange={(e) => setEditInhalteText(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-surface-border bg-surface-hover text-xs"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted block">
                    Beispiele (1 pro Zeile):
                  </label>
                  <textarea
                    rows={3}
                    value={editBeispieleText}
                    onChange={(e) => setEditBeispieleText(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-surface-border bg-surface-hover text-xs"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted block">
                    Übungen und Aktivitäten (1 pro Zeile):
                  </label>
                  <textarea
                    rows={2}
                    value={editUebungenText}
                    onChange={(e) => setEditUebungenText(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-surface-border bg-surface-hover text-xs"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted block">
                    Offene Punkte (1 pro Zeile):
                  </label>
                  <textarea
                    rows={2}
                    value={editOffenePunkteText}
                    onChange={(e) => setEditOffenePunkteText(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-surface-border bg-surface-hover text-xs"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingExtractedContent(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedExtractedContent}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black cursor-pointer"
                >
                  {_t('حفظ تعديلات المعلم', 'Save Teacher Edits', 'Lehrkraft-Änderungen speichern')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-[11px] text-left" dir="ltr">
              {extractedContent.themaDerStunde && (
                <div>
                  <span className="font-black text-purple-800 dark:text-purple-300">
                    Thema der Stunde:{' '}
                  </span>
                  <span className="font-semibold text-text-main">{extractedContent.themaDerStunde}</span>
                </div>
              )}

              {extractedContent.behandelteInhalte.length > 0 && (
                <div>
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    Behandelte Inhalte:{' '}
                  </span>
                  <span className="text-text-main">
                    {extractedContent.behandelteInhalte.join(' • ')}
                  </span>
                </div>
              )}

              {extractedContent.neueWoerterUndRedemittel.length > 0 && (
                <div>
                  <span className="font-black text-slate-700 dark:text-slate-300 block mb-0.5">
                    Neue Wörter und Redemittel:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extractedContent.neueWoerterUndRedemittel.map((v, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200 text-[10px] font-bold border border-purple-200/70"
                      >
                        {v.article ? `${v.article} ` : ''}
                        {v.german}
                        {v.arabic ? ` (${v.arabic})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {extractedContent.grammatik.length > 0 && (
                <div>
                  <span className="font-black text-slate-700 dark:text-slate-300">Grammatik: </span>
                  <span className="text-text-main">
                    {extractedContent.grammatik.map((g) => `${g.topic} (${g.explanationDe})`).join(' | ')}
                  </span>
                </div>
              )}

              {extractedContent.beispiele.length > 0 && (
                <div>
                  <span className="font-black text-slate-700 dark:text-slate-300">Beispiele: </span>
                  <span className="text-text-main italic">
                    {extractedContent.beispiele.map((b) => `„${b}“`).join(' • ')}
                  </span>
                </div>
              )}

              {extractedContent.uebungenUndAktivitaeten.length > 0 && (
                <div>
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    Übungen und Aktivitäten:{' '}
                  </span>
                  <span className="text-text-main">
                    {extractedContent.uebungenUndAktivitaeten.join(' • ')}
                  </span>
                </div>
              )}

              {extractedContent.offenePunkte.length > 0 && (
                <div>
                  <span className="font-black text-amber-700 dark:text-amber-300">
                    Offene Punkte:{' '}
                  </span>
                  <span className="text-text-main">{extractedContent.offenePunkte.join(' • ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Pending updated extraction notice when teacher had already edited and Part 2 arrived */}
          {extractedContent.pendingUpdatedExtraction && (
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 flex items-center justify-between gap-2 text-[10px]">
              <span className="font-bold text-indigo-800 dark:text-indigo-200">
                {_t(
                  'وصل تحديث جديد لمحتوى الحصة (مثل الجزء 2)، وتم الحفاظ على تعديلاتك الحالية.',
                  'New recording part content arrived; your teacher edits were preserved.',
                  'Neuer Aufnahmeteil verfügbar; Ihre Lehrkraft-Bearbeitung wurde geschützt.'
                )}
              </span>
              <button
                type="button"
                onClick={handleAcceptPendingUpdatedExtraction}
                className="px-2 py-1 rounded bg-indigo-600 text-white font-black shrink-0 cursor-pointer"
              >
                {_t('دمج التحديث الجديد', 'Apply Updated Extraction', 'Aktualisierung übernehmen')}
              </button>
            </div>
          )}
        </div>
      )}

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
              'مساعد Grain الذكي (مطابقة الحصص المتكررة والجزء 2 واستخراج الشرح)',
              'Grain Assistant (Smart Recurring Matcher, Part 2 & Content Extractor)',
              'Grain-Assistent (Serien-Abgleich, Teil 2 & Inhaltsextraktion)'
            )}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isExpanded && (
          <div className="flex items-center gap-1.5">
            {effectiveSelectedLesson.grainMeta?.recordingId && (
              <button
                type="button"
                onClick={() => handleRunLessonContentExtraction(effectiveSelectedLesson, recordings)}
                disabled={extractingContent}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer disabled:opacity-50"
              >
                <BookOpen className="w-3 h-3" />
                <span>
                  {extractingContent
                    ? _t('جاري الاستخراج...', 'Extracting...', 'Extrahiere...')
                    : _t('تحديث ملخص الحصة (7 أقسام)', 'Extract 7-Section Content', 'Inhalt extrahieren')}
                </span>
              </button>
            )}
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
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="p-2.5 sm:p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 space-y-2.5">
          {/* Mandatory Rule 2 & Rule 5 Notice */}
          <div className="flex items-center justify-between flex-wrap gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
            <span>
              {_t(
                'التعيين اليدوي لأول مرة يعلّم النظام نمط الحصة المتكررة تلقائياً للأسابيع القادمة ويكتشف الجزء 2 (+40-42 دقيقة).',
                'First manual assignment permanently learns the recurring schedule and auto-detects Part 2 (+40-42 min).',
                'Die erste manuelle Zuordnung lernt das Serienmuster dauerhaft und erkennt Teil 2 (+40-42 Min.).'
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
                const slot =
                  selectedTargetSlot[rec.id] ||
                  (rec.detectedPartSlot === 'part2' ? 'part2' : 'part1');

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
                          {(rec.workflowStatuses || []).map((b) => renderWorkflowBadge(b))}
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
                          {typeof rec.part2StartGapMinutes === 'number' && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                              +{rec.part2StartGapMinutes}m gap
                            </span>
                          )}
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
                          <span>
                            {_t(
                              'تأكيد الربط وتعلّم النمط',
                              'Confirm & Learn Pattern',
                              'Bestätigen & Muster lernen'
                            )}
                          </span>
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
                            : _t('مسودة ولي الأمر والواجب و Lernstudio', 'Parent/Homework/Lernstudio Draft', 'Eltern-/Hausaufgaben-Entwurf')}
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
                      'مراجعة واعتماد مسودة Grain لتقرير ولي الأمر والواجب و Lernstudio (بإشراف المعلم فقط)',
                      'Teacher Review & Approval: Parent Report, Homework & Lernstudio Draft',
                      'Lehrkraft-Prüfung: Elternbericht, Hausaufgabe & Lernstudio-Entwurf'
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
                      '1. ملخص معتمد لتقرير ولي الأمر (قابل للتعديل قبل الاعتماد):',
                      '1. Approved Parent Report Summary (Editable before approval):',
                      '1. Zusammenfassung für Elternbericht (vor Bestätigung bearbeitbar):'
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
                        'اعتماد الملخص لتقرير ولي الأمر',
                        'Approve Summary for Parent Report',
                        'Für Elternbericht bestätigen'
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

