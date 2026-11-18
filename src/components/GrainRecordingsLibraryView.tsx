import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Video,
  RefreshCw,
  Search,
  ExternalLink,
  Link2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Lock,
  Globe,
  Trash2,
  RotateCcw,
  Eye,
  X,
  Sparkles,
  BookOpen,
  Gamepad2,
  Check,
  Users,
  Calendar,
  Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Lesson,
  GrainDiscoveredRecording,
  GrainEducationalDraft,
  GrainShareAccessClassification,
  GrainGroupLearningRecord,
  GrainMatchStatus,
  GrainWorkflowStatusBadge
} from '../types';
import {
  loadDiscoveredGrainRecordings,
  saveDiscoveredGrainRecordings,
  syncGrainRecordingsIncrementally,
  evaluateRecordingMatchAgainstLessons,
  detectGrainTwoPartRecordingPairs,
  prepareConfirmedGrainLessonAttachment,
  correctGrainRecordingAssignment,
  recordConfirmedGrainGroupLearning,
  loadGrainGroupLearningRecords,
  setGrainLearningRuleEnabled,
  deleteGrainLearningRule,
  removeGrainRecordingFromLocalLibrary,
  restoreRemovedGrainLibraryEntries,
  generateEducationalDraftForRecording,
  buildLernstudioDraftFromGrainEducationalDraft,
  loadGrainIntegrationMeta,
  classifyGrainRecordingShareAccess,
  extractStructuredLessonContentForLesson,
  applyExtractedLessonContentToLesson
} from '../services/grainService';

export const GrainRecordingsLibraryView: React.FC = () => {
  const {
    lessons,
    students,
    groups,
    updateLesson,
    saveLernstudioSet,
    language,
    setActiveTab
  } = useApp();

  const tr = useCallback(
    (ar: string, en: string, de: string) =>
      language === 'ar' ? ar : language === 'de' ? de : en,
    [language]
  );

  const [recordings, setRecordings] = useState<GrainDiscoveredRecording[]>([]);
  const [learningRecords, setLearningRecords] = useState<GrainGroupLearningRecord[]>([]);
  const [showLearnedRulesPanel, setShowLearnedRulesPanel] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [hasConnectedToken, setHasConnectedToken] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'linked' | 'unlinked' | 'public_verified' | 'suggested'
  >('all');

  // Modals / Drawers
  const [selectedRecordingForMatch, setSelectedRecordingForMatch] =
    useState<GrainDiscoveredRecording | null>(null);
  const [manualLessonId, setManualLessonId] = useState<string>('');
  const [manualMatchSearch, setManualMatchSearch] = useState('');

  const [selectedRecordingDetails, setSelectedRecordingDetails] =
    useState<GrainDiscoveredRecording | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<GrainEducationalDraft | null>(null);
  const [editedSummaryAr, setEditedSummaryAr] = useState('');
  const [editedHomeworkText, setEditedHomeworkText] = useState('');
  const [draftApprovedMessage, setDraftApprovedMessage] = useState<string | null>(null);

  const refreshLocalLibrary = useCallback(() => {
    const disc = loadDiscoveredGrainRecordings({ includeRemoved: false });
    const learned = loadGrainGroupLearningRecords(groups);
    const meta = loadGrainIntegrationMeta();
    setRecordings(disc);
    setLearningRecords(learned);
    setLastSyncAt(meta.lastSuccessfulSyncAt);
    setHasConnectedToken(meta.hasToken);
  }, [groups]);

  useEffect(() => {
    refreshLocalLibrary();
  }, [refreshLocalLibrary]);

  // Evaluate matches and two-part pairs for all recordings using Smart Recurring Lesson Matching
  const evaluatedRecordings = useMemo(() => {
    const evaluated = recordings.map((rec) =>
      evaluateRecordingMatchAgainstLessons(rec, lessons, groups, students, learningRecords)
    );
    return detectGrainTwoPartRecordingPairs({
      recordings: evaluated,
      lessons,
      groups,
      students,
      learningRecords
    });
  }, [recordings, lessons, groups, students, learningRecords]);

  const handleToggleLearnedRule = (ruleId: string, enabled: boolean) => {
    const updated = setGrainLearningRuleEnabled(ruleId, enabled, groups);
    setLearningRecords(updated);
  };

  const handleDeleteLearnedRule = (ruleId: string) => {
    const updated = deleteGrainLearningRule(ruleId, groups);
    setLearningRecords(updated);
  };

  const handleSyncFromGrain = async (forceFull: boolean = false) => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const result = await syncGrainRecordingsIncrementally({
        lessons: lessons || [],
        groups: groups || [],
        students: students || [],
        maxPages: forceFull ? 5 : 2,
        onUpdateLesson: updateLesson
      });
      if (!result.success) {
        setSyncError(
          result.error ||
            tr(
              'تعذر استيراد التسجيلات من Grain. تحقق من الاتصال في الإعدادات.',
              'Could not import recordings from Grain. Check connection in Settings.',
              'Grain-Aufzeichnungen konnten nicht importiert werden. Bitte Verbindung prüfen.'
            )
        );
      } else {
        refreshLocalLibrary();
        const autoCount = result.autoMatchedLessonIds?.length || 0;
        setSyncMessage(
          tr(
            `تمت مزامنة المكتبة (${result.recordings.length} تسجيلاً متاحاً، ${result.newCount} جديد${autoCount > 0 ? `، ${autoCount} حصة تمت مطابقتها واستخراج محتواها تلقائياً` : ''}).`,
            `Library synced (${result.recordings.length} recordings, ${result.newCount} new${autoCount > 0 ? `, ${autoCount} lessons auto-matched & extracted` : ''}).`,
            `Bibliothek synchronisiert (${result.recordings.length} Aufzeichnungen, ${result.newCount} neu${autoCount > 0 ? `, ${autoCount} automatisch zugeordnet` : ''}).`
          )
        );
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Sync error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmMatch = async (rec: GrainDiscoveredRecording, targetLessonId: string) => {
    const targetLesson = lessons.find((l) => l.id === targetLessonId);
    if (!targetLesson) return;

    const previousLesson = rec.confirmedLessonId
      ? lessons.find((l) => l.id === rec.confirmedLessonId) || null
      : null;

    // 1. Prepare confirmed lesson attachment or teacher correction (preserves attendance & learns recurring rule)
    const corrected = correctGrainRecordingAssignment({
      recording: rec,
      targetLesson,
      previousLesson,
      groups,
      students,
      preferredSlot: 'auto',
      allowOverwrite: true
    });

    if (corrected.previousLessonPatch && previousLesson) {
      updateLesson(previousLesson.id, corrected.previousLessonPatch);
    }

    let workingLesson: Lesson = {
      ...targetLesson,
      ...corrected.targetLessonPatch
    };
    updateLesson(targetLesson.id, corrected.targetLessonPatch);

    // 2. Mark recording as linked in local discovered cache
    const shareClass =
      rec.shareAccessClassification ||
      classifyGrainRecordingShareAccess({
        recordingUrl: rec.recordingUrl,
        share_state: rec.rawShareState
      }).classification;

    const updatedList = recordings.map((item) =>
      item.id === rec.id
        ? {
            ...item,
            confirmedLessonId: targetLesson.id,
            suggestedLessonId: targetLesson.id,
            matchedGroupId: targetLesson.groupId || undefined,
            matchStatus: 'already_linked' as const,
            shareAccessClassification: shareClass
          }
        : item
    );
    saveDiscoveredGrainRecordings(updatedList);

    // 3. Automatically extract and save 7-section German lesson content
    try {
      const extracted = await extractStructuredLessonContentForLesson({
        lesson: workingLesson,
        recordings: updatedList
      });
      const applied = applyExtractedLessonContentToLesson(workingLesson, extracted);
      if (applied.updated) {
        updateLesson(targetLesson.id, {
          ...corrected.targetLessonPatch,
          ...applied.lessonPatch
        });
      }
    } catch {
      // Handled gracefully
    }

    refreshLocalLibrary();
    setSelectedRecordingForMatch(null);
    setSyncMessage(
      tr(
        `تم ربط التسجيل بالحصة وحفظ نمط الحصة المتكررة (${targetLesson.groupName || targetLesson.date}) واستخراج محتوى الحصة بنجاح.`,
        `Recording linked, recurring rule learned (${targetLesson.groupName || targetLesson.date}) & lesson content extracted.`,
        `Aufzeichnung verknüpft, Serienmuster gelernt (${targetLesson.groupName || targetLesson.date}) & Inhalt extrahiert.`
      )
    );
  };

  const handleRemoveFromLibrary = (recordingId: string) => {
    removeGrainRecordingFromLocalLibrary(recordingId);
    refreshLocalLibrary();
    setSyncMessage(
      tr(
        'تمت إزالة التسجيل من مكتبة Glück المحلية فقط (دون حذفه من حساب Grain).',
        'Removed entry from local Glück library only (not deleted from Grain).',
        'Eintrag nur aus der lokalen Glück-Bibliothek entfernt (nicht in Grain gelöscht).'
      )
    );
  };

  const handleRestoreRemovedEntries = () => {
    const restored = restoreRemovedGrainLibraryEntries();
    refreshLocalLibrary();
    setSyncMessage(
      tr(
        `تمت استعادة التسجيلات المخفية محلياً (${restored.length} إجمالي التسجيلات الآن).`,
        `Restored locally hidden recordings (${restored.length} total active).`,
        `Lokal ausgeblendete Aufzeichnungen wiederhergestellt (${restored.length} aktiv).`
      )
    );
  };

  const handleGenerateDraftForRecording = async (rec: GrainDiscoveredRecording) => {
    setIsGeneratingDraft(true);
    setDraftError(null);
    setDraftApprovedMessage(null);
    try {
      const linkedLessonId = rec.confirmedLessonId || rec.suggestedLessonId;
      const linkedLesson = lessons.find((l) => l.id === linkedLessonId);

      const res = await generateEducationalDraftForRecording(rec, {
        lesson: linkedLesson,
        students,
        includeTranscriptAnalysis: true
      });

      if (!res.success || !res.draft) {
        setDraftError(
          res.error ||
            tr(
              'تعذر استخراج المسودة التعليمية من التسجيل.',
              'Could not generate educational draft from recording.',
              'Entwurf konnte nicht erstellt werden.'
            )
        );
        return;
      }

      setActiveDraft(res.draft);
      setEditedSummaryAr(res.draft.whatWasCoveredAr || '');
      setEditedHomeworkText(
        res.draft.homework.map((h) => h.description).join('\n')
      );
    } catch (err: any) {
      setDraftError(err?.message || 'Failed to generate educational draft');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleApproveDraftToLesson = (rec: GrainDiscoveredRecording) => {
    if (!activeDraft) return;
    const linkedLessonId = rec.confirmedLessonId || rec.suggestedLessonId;
    const linkedLesson = lessons.find((l) => l.id === linkedLessonId);
    if (!linkedLesson) return;

    const existingReport = linkedLesson.report || {
      attendanceStatus: 'present' as const,
      homeworkStatus: 'assigned' as const,
      completedAt: new Date().toISOString()
    };

    const shareClass =
      rec.shareAccessClassification ||
      classifyGrainRecordingShareAccess({
        recordingUrl: rec.recordingUrl,
        share_state: rec.rawShareState
      }).classification;

    updateLesson(linkedLesson.id, {
      grainMeta: {
        ...(linkedLesson.grainMeta || {
          recordingId: rec.id,
          recordingTitle: rec.title,
          startTimestamp: rec.startDatetime,
          durationMinutes: rec.durationMinutes,
          recordingUrl: rec.recordingUrl,
          shareAccessClassification: shareClass,
          source: rec.sourcePlatform || 'zoom',
          matchingStatus: 'confirmed',
          confirmedLessonId: linkedLesson.id,
          lastSyncedAt: new Date().toISOString()
        }),
        approvedSummary: editedSummaryAr.trim(),
        approvedParentReportSummaryAr: editedSummaryAr.trim()
      },
      report: {
        ...existingReport,
        arabicTopicsExplained: editedSummaryAr.trim() || (existingReport as any).arabicTopicsExplained,
        arabicHomeworkRequired: editedHomeworkText.trim() || (existingReport as any).arabicHomeworkRequired,
        homeworkTitle: editedHomeworkText.trim() || (existingReport as any).homeworkTitle
      }
    });

    setDraftApprovedMessage(
      tr(
        'تم اعتماد الملخص والواجب وحفظهما في سجل الحصة بنجاح.',
        'Approved summary and homework saved to lesson record.',
        'Bestätigte Zusammenfassung und Hausaufgabe im Unterrichtseintrag gespeichert.'
      )
    );
  };

  const handleApproveLernstudioSet = (rec: GrainDiscoveredRecording) => {
    if (!activeDraft) return;
    const linkedLessonId = rec.confirmedLessonId || rec.suggestedLessonId;
    const linkedLesson = lessons.find((l) => l.id === linkedLessonId);
    const group = groups.find((g) => g.id === linkedLesson?.groupId);

    const newSet = buildLernstudioDraftFromGrainEducationalDraft(activeDraft, {
      title: `Grain: ${rec.title}`,
      grade: group?.grade || 'General',
      level: (group?.level as any) || 'A1'
    });

    saveLernstudioSet(newSet as any);
    setDraftApprovedMessage(
      tr(
        `تم إنشاء واعتماد مجموعة Lernstudio "${newSet.title}" (${newSet.items.length} مفردة).`,
        `Created and approved Lernstudio set "${newSet.title}" (${newSet.items.length} items).`,
        `Lernstudio-Set "${newSet.title}" (${newSet.items.length} Einträge) erstellt und bestätigt.`
      )
    );
  };

  // Filtered recordings
  const filteredRecordings = useMemo(() => {
    return evaluatedRecordings
      .filter((rec) => {
        const linkedLessonId = rec.confirmedLessonId;
        const linkedLesson = lessons.find((l) => l.id === linkedLessonId);
        const topCandidate = rec.candidates?.[0];
        const assignedGroupId =
          rec.matchedGroupId ||
          linkedLesson?.groupId ||
          topCandidate?.groupId ||
          '';
        const shareClass =
          rec.shareAccessClassification ||
          classifyGrainRecordingShareAccess({
            recordingUrl: rec.recordingUrl,
            share_state: rec.rawShareState
          }).classification;

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const titleHit = (rec.title || '').toLowerCase().includes(q);
          const dateHit = (rec.startDatetime || '').toLowerCase().includes(q);
          const groupObj = groups.find((g) => g.id === assignedGroupId);
          const groupHit = (groupObj?.name || '').toLowerCase().includes(q);
          const partHit = (rec.participantNames || []).some((p) =>
            (p || '').toLowerCase().includes(q)
          );
          if (!titleHit && !dateHit && !groupHit && !partHit) return false;
        }

        if (dateFilter && !rec.startDatetime.startsWith(dateFilter)) {
          return false;
        }

        if (groupFilter !== 'all' && assignedGroupId !== groupFilter) {
          return false;
        }

        if (studentFilter !== 'all') {
          const targetStudent = students.find((s) => s.id === studentFilter);
          const matchesStudentLesson = linkedLesson?.studentId === studentFilter;
          const matchesStudentGroup =
            Boolean(targetStudent?.groupId) && assignedGroupId === targetStudent?.groupId;
          if (!matchesStudentLesson && !matchesStudentGroup) return false;
        }

        if (statusFilter === 'linked' && rec.matchStatus !== 'already_linked') return false;
        if (statusFilter === 'unlinked' && rec.matchStatus === 'already_linked') return false;
        if (statusFilter === 'public_verified' && shareClass !== 'public_access_verified')
          return false;
        if (
          statusFilter === 'suggested' &&
          (rec.matchStatus === 'already_linked' || rec.candidates.length === 0)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => (b.startDatetime || '').localeCompare(a.startDatetime || ''));
  }, [
    evaluatedRecordings,
    lessons,
    groups,
    students,
    searchQuery,
    dateFilter,
    groupFilter,
    studentFilter,
    statusFilter
  ]);

  const renderShareAccessBadge = (classification?: GrainShareAccessClassification) => {
    switch (classification) {
      case 'public_access_verified':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <Globe className="w-2.5 h-2.5" />
            {tr('عام لولي الأمر', 'Public Verified', 'Öffentlich verifiziert')}
          </span>
        );
      case 'workspace_only':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Users className="w-2.5 h-2.5" />
            {tr('مساحة العمل فقط', 'Workspace Only', 'Nur Workspace')}
          </span>
        );
      case 'restricted':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <Lock className="w-2.5 h-2.5" />
            {tr('خاص / مقيد', 'Restricted', 'Eingeschränkt')}
          </span>
        );
      case 'link_unavailable':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400">
            {tr('بدون رابط', 'Link Unavailable', 'Kein Link')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            <HelpCircle className="w-2.5 h-2.5" />
            {tr('غير متحقق (يتطلب مراجعة)', 'Unverified Share', 'Freigabe ungeprüft')}
          </span>
        );
    }
  };

  const renderWorkflowBadge = (badge: GrainWorkflowStatusBadge) => {
    switch (badge) {
      case 'automatically_matched':
        return (
          <span
            key={badge}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          >
            {tr('مطابقة تلقائية', 'Automatically matched', 'Automatisch zugeordnet')}
          </span>
        );
      case 'part1_detected':
        return (
          <span
            key={badge}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300"
          >
            {tr('الجزء 1', 'Part 1 detected', 'Teil 1 erkannt')}
          </span>
        );
      case 'part2_detected':
        return (
          <span
            key={badge}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
          >
            {tr('الجزء 2 (+40د)', 'Part 2 detected', 'Teil 2 erkannt')}
          </span>
        );
      case 'lesson_content_extracted':
        return (
          <span
            key={badge}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300"
          >
            {tr('تم استخراج المحتوى', 'Lesson content extracted', 'Inhalt extrahiert')}
          </span>
        );
      case 'transcript_unavailable':
        return (
          <span
            key={badge}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300"
          >
            {tr('النص غير متاح', 'Transcript unavailable', 'Transkript nicht verfügbar')}
          </span>
        );
      case 'needs_teacher_confirmation':
        return (
          <span
            key={badge}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300"
          >
            {tr('يحتاج تأكيد المعلم', 'Needs teacher confirmation', 'Bestätigung nötig')}
          </span>
        );
      default:
        return null;
    }
  };

  const renderMatchStatusBadge = (status: GrainMatchStatus) => {
    switch (status) {
      case 'already_linked':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {tr('مرتبط بحصة ✓', 'Linked ✓', 'Verknüpft ✓')}
          </span>
        );
      case 'automatically_matched':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {tr('مطابقة تلقائية ✓', 'Automatically matched', 'Automatisch zugeordnet')}
          </span>
        );
      case 'strong_match':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
            {tr('تطابق قوي', 'Strong Match', 'Starker Treffer')}
          </span>
        );
      case 'suggested_match':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300">
            {tr('اقتراح ذكي', 'Suggested Match', 'Vorschlag')}
          </span>
        );
      case 'multiple_possible_lessons':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            {tr('عدة حصص محتملة', 'Multiple Candidates', 'Mehrere Kandidaten')}
          </span>
        );
      case 'needs_confirmation':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            {tr('يحتاج تأكيد المعلم', 'Needs teacher confirmation', 'Bestätigung nötig')}
          </span>
        );
      case 'inaccessible':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
            {tr('غير متاح', 'Inaccessible', 'Nicht zugänglich')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400">
            {tr('غير مرتبط', 'Unmatched', 'Nicht zugeordnet')}
          </span>
        );
    }
  };

  const formatTimeFromIso = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(11, 16) || '—';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-3">
      {/* Compact Header Bar */}
      <div className="rounded-2xl border border-surface-border bg-surface p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-text-main flex items-center gap-2">
                <span>
                  {tr(
                    'تسجيلات الحصص — Grain Recordings',
                    'Grain Recordings — تسجيلات الحصص',
                    'Grain-Aufzeichnungen — تسجيلات الحصص'
                  )}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  {evaluatedRecordings.length}
                </span>
              </h1>
              <p className="text-[11px] text-text-muted">
                {tr(
                  'مكتبة جميع تسجيلات Grain المستوردة مع المطابقة الذكية وتعلم المجموعات وروابط أولياء الأمور',
                  'Central library of all imported Grain recordings with smart matching, group learning & parent links',
                  'Zentrale Bibliothek aller Grain-Aufzeichnungen mit intelligenter Zuordnung & Eltern-Links'
                )}
                {lastSyncAt
                  ? ` • ${tr('آخر مزامنة:', 'Last sync:', 'Letzte Sync:')} ${lastSyncAt
                      .slice(0, 16)
                      .replace('T', ' ')}`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSyncFromGrain(false)}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{tr('مزامنة التسجيلات الجديدة', 'Sync New Recordings', 'Neue synchronisieren')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSyncFromGrain(true)}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{tr('استيراد شامل', 'Import All Pages', 'Alle Seiten importieren')}</span>
            </button>
            <button
              type="button"
              onClick={handleRestoreRemovedEntries}
              title={tr(
                'استعادة التسجيلات المخفية محلياً',
                'Restore locally removed entries',
                'Ausgeblendete Einträge wiederherstellen'
              )}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-muted hover:text-text-main text-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {!hasConnectedToken && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer"
              >
                {tr('إعداد رمز Grain', 'Configure Grain Token', 'Grain-Token einrichten')}
              </button>
            )}
          </div>
        </div>

        {/* Status messages */}
        {syncMessage && (
          <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>{syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-emerald-700 dark:text-emerald-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {syncError && (
          <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-300 flex items-center justify-between">
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-rose-600 dark:text-rose-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compact Search & Filter Bar */}
        <div className="mt-2.5 pt-2.5 border-t border-surface-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute top-1/2 -translate-y-1/2 start-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr(
                'بحث بالعنوان أو المشارك أو المجموعة...',
                'Search title, participant, group...',
                'Titel, Teilnehmer, Gruppe suchen...'
              )}
              className="w-full ps-8 pe-2.5 py-1.5 rounded-xl border border-surface-border bg-background text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-surface-border bg-background text-xs text-text-main"
          />

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-surface-border bg-background text-xs text-text-main"
          >
            <option value="all">{tr('كل المجموعات', 'All Groups', 'Alle Gruppen')}</option>
            {groups
              .filter((g) => !g.deleted)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>

          <select
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-surface-border bg-background text-xs text-text-main"
          >
            <option value="all">{tr('كل الطلاب', 'All Students', 'Alle Schüler')}</option>
            {students
              .filter((s) => !s.deleted)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-surface-border bg-background text-xs text-text-main"
          >
            <option value="all">{tr('كل التسجيلات', 'All Recordings', 'Alle Aufzeichnungen')}</option>
            <option value="linked">{tr('المرتبطة بحصص', 'Linked to Lessons', 'Mit Unterricht verknüpft')}</option>
            <option value="unlinked">{tr('غير المرتبطة', 'Unlinked Recordings', 'Nicht verknüpft')}</option>
            <option value="suggested">{tr('بها اقتراحات ذكية', 'Has Smart Suggestions', 'Mit Vorschlägen')}</option>
            <option value="public_verified">
              {tr('متاحة كرابط عام لولي الأمر', 'Public Parent Link Verified', 'Öffentlicher Eltern-Link')}
            </option>
          </select>
        </div>

        {/* Requirement 6: Smart Recurring Learning Rules Strip & Simple Review/Disable UI */}
        {learningRecords.length > 0 && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-text-muted">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {tr(
                    'قواعد المطابقة المتكررة المتعلّمة:',
                    'Learned Recurring Matching Rules:',
                    'Gelernte Serien-Zuordnungsregeln:'
                  )}
                </span>
                <span>
                  {tr(
                    `${learningRecords.filter((r) => !r.obsoleteGroup && r.ruleEnabled !== false).length} قاعدة نشطة بمعرف المجموعة الثابت (group.id)`,
                    `${learningRecords.filter((r) => !r.obsoleteGroup && r.ruleEnabled !== false).length} active rules by stable group.id`,
                    `${learningRecords.filter((r) => !r.obsoleteGroup && r.ruleEnabled !== false).length} aktive Regeln über stabile group.id`
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLearnedRulesPanel((prev) => !prev)}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {showLearnedRulesPanel
                  ? tr('إخفاء القواعد المتعلّمة', 'Hide Learned Rules', 'Regeln ausblenden')
                  : tr('مراجعة / تعطيل القواعد المتعلّمة', 'Review / Disable Learned Rules', 'Regeln prüfen / deaktivieren')}
              </button>
            </div>

            {showLearnedRulesPanel && (
              <div className="p-2.5 rounded-xl bg-background/70 border border-surface-border space-y-1.5 max-h-44 overflow-y-auto">
                {learningRecords.map((rule) => {
                  const grp = groups.find((g) => g.id === rule.groupId);
                  const isEnabled = rule.ruleEnabled !== false;
                  const weekdayStr =
                    typeof rule.lessonWeekday === 'number'
                      ? weekdayLabels[rule.lessonWeekday] || ''
                      : typeof rule.recordingDayOfWeek === 'number'
                      ? weekdayLabels[rule.recordingDayOfWeek] || ''
                      : '';
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-surface-border bg-surface text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-text-main truncate">
                          {grp ? grp.name : (rule.groupId || rule.lessonId)}
                          <span className="ms-1.5 text-[10px] font-normal text-text-muted">
                            ({weekdayStr} {rule.lessonScheduledStartTime || rule.recordingStartTime || ''})
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted truncate">
                          {rule.normalizedTitle || rule.recordingDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleLearnedRule(rule.id, !isEnabled)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            isEnabled
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isEnabled
                            ? tr('مفعّلة ✓', 'Enabled ✓', 'Aktiv ✓')
                            : tr('معطّلة', 'Disabled', 'Deaktiviert')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLearnedRule(rule.id)}
                          className="p-1 rounded text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          title={tr('حذف القاعدة', 'Delete Rule', 'Regel löschen')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compact Recordings Table / List */}
      <div className="rounded-2xl border border-surface-border bg-surface overflow-hidden shadow-xs">
        {filteredRecordings.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-xs font-semibold text-text-main">
              {tr(
                'لا توجد تسجيلات مطابقة للبحث أو لم يتم استيراد تسجيلات بعد.',
                'No matching recordings found or no recordings imported yet.',
                'Keine passenden Aufzeichnungen gefunden oder noch keine importiert.'
              )}
            </p>
            <p className="text-[11px] text-text-muted">
              {tr(
                'اضغط على "مزامنة التسجيلات الجديدة" لاستيراد التسجيلات من حساب Grain الخاص بك.',
                'Click "Sync New Recordings" to import recordings from your Grain account.',
                'Klicken Sie auf "Neue synchronisieren", um Aufzeichnungen aus Grain zu importieren.'
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-bold text-text-muted uppercase">
                  <th className="py-2 px-2.5 text-start">{tr('التسجيل', 'Recording', 'Aufzeichnung')}</th>
                  <th className="py-2 px-2 text-start">{tr('التاريخ والوقت', 'Date & Time', 'Datum & Zeit')}</th>
                  <th className="py-2 px-2 text-start">{tr('حالة المشاركة', 'Share Access', 'Freigabestatus')}</th>
                  <th className="py-2 px-2 text-start">{tr('حالة المطابقة', 'Match Status', 'Zuordnung')}</th>
                  <th className="py-2 px-2 text-start">{tr('الحصة / المجموعة', 'Lesson / Group', 'Unterricht / Gruppe')}</th>
                  <th className="py-2 px-2.5 text-end">{tr('إجراءات', 'Actions', 'Aktionen')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {filteredRecordings.map((rec) => {
                  const linkedLesson = lessons.find((l) => l.id === rec.confirmedLessonId);
                  const topCandidate = rec.candidates?.[0];
                  const assignedGroup = groups.find(
                    (g) =>
                      g.id ===
                      (rec.matchedGroupId || linkedLesson?.groupId || topCandidate?.groupId)
                  );
                  const shareClass =
                    rec.shareAccessClassification ||
                    classifyGrainRecordingShareAccess({
                      recordingUrl: rec.recordingUrl,
                      share_state: rec.rawShareState
                    }).classification;
                  const recDate = rec.startDatetime ? rec.startDatetime.slice(0, 10) : '—';
                  const recTime = formatTimeFromIso(rec.startDatetime);

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Title & Participants */}
                      <td className="py-2 px-2.5 max-w-[230px]">
                        <div className="font-bold text-text-main truncate" title={rec.title}>
                          {rec.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted mt-0.5">
                          {rec.participantNames && rec.participantNames.length > 0 && (
                            <span className="truncate max-w-[180px]">
                              👥 {rec.participantNames.join(', ')}
                            </span>
                          )}
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-500/10">
                            {rec.hasAiSummary
                              ? tr('ملخص متاح', 'Summary Ready', 'Zusammenfassung')
                              : tr('مفهرس', 'Indexed', 'Indexiert')}
                          </span>
                        </div>
                      </td>

                      {/* Date, Start Time, Duration */}
                      <td className="py-2 px-2 whitespace-nowrap text-[11px]">
                        <div className="font-semibold text-text-main flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-text-muted" />
                          <span>{recDate}</span>
                        </div>
                        <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{recTime}</span>
                          <span>• {rec.durationMinutes || 60}m</span>
                        </div>
                      </td>

                      {/* Share Access Status */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {renderShareAccessBadge(shareClass)}
                      </td>

                      {/* Matching Status */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1">
                          {renderMatchStatusBadge(rec.matchStatus)}
                          {Array.from(
                            new Set<GrainWorkflowStatusBadge>([
                              ...(rec.workflowStatuses || []),
                              ...(linkedLesson?.grainMeta?.workflowStatuses || [])
                            ])
                          ).map((b) => renderWorkflowBadge(b))}
                        </div>
                        {rec.matchStatus !== 'already_linked' && topCandidate && (
                          <div className="text-[10px] text-text-muted mt-0.5">
                            {tr('درجة الثقة:', 'Score:', 'Score:')} {topCandidate.confidenceScore}%
                          </div>
                        )}
                      </td>

                      {/* Assigned Lesson / Suggested Group */}
                      <td className="py-2 px-2 max-w-[220px]">
                        {linkedLesson ? (
                          <div>
                            <div className="font-bold text-emerald-700 dark:text-emerald-300 truncate">
                              {linkedLesson.groupName || linkedLesson.studentName || linkedLesson.title}
                            </div>
                            <div className="text-[10px] text-text-muted">
                              {linkedLesson.date} • {linkedLesson.time || ''}
                              {assignedGroup ? ` • ${assignedGroup.name}` : ''}
                            </div>
                          </div>
                        ) : topCandidate ? (
                          <div>
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                              {tr('مقترح:', 'Suggested:', 'Vorschlag:')}{' '}
                              {topCandidate.lessonTitle || topCandidate.groupName || topCandidate.studentName}
                            </div>
                            <div className="text-[10px] text-text-muted truncate">
                              {topCandidate.evidence.reasons.slice(0, 2).join(' • ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted">
                            {tr('غير معين لحصة', 'Not assigned to lesson', 'Keinem Unterricht zugeordnet')}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2.5 whitespace-nowrap text-end">
                        <div className="inline-flex items-center gap-1">
                          {!linkedLesson && topCandidate && (
                            <button
                              type="button"
                              onClick={() => handleConfirmMatch(rec, topCandidate.lessonId)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              title={tr(
                                'تأكيد الربط بالحصة المقترحة',
                                'Confirm suggested lesson match',
                                'Vorgeschlagene Zuordnung bestätigen'
                              )}
                            >
                              <Check className="w-3 h-3" />
                              <span>{tr('تأكيد', 'Confirm', 'Bestätigen')}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecordingForMatch(rec);
                              setManualLessonId(linkedLesson?.id || topCandidate?.lessonId || '');
                              setManualMatchSearch('');
                            }}
                            className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            title={tr(
                              'ربط يدوي بحصة أو مجموعة',
                              'Manually match to lesson/group',
                              'Manuell zuordnen'
                            )}
                          >
                            <Link2 className="w-3 h-3" />
                            <span>{tr('ربط', 'Match', 'Zuordnen')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecordingDetails(rec);
                              setActiveDraft(null);
                              setDraftError(null);
                              setDraftApprovedMessage(null);
                            }}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main cursor-pointer"
                            title={tr(
                              'تفاصيل التسجيل والملخص الذكي',
                              'Recording Details & AI Draft',
                              'Details & KI-Entwurf'
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {rec.recordingUrl && (
                            <a
                              href={rec.recordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400"
                              title={tr(
                                'فتح صفحة التسجيل في Grain',
                                'Open Grain Recording Page',
                                'In Grain öffnen'
                              )}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveFromLibrary(rec.id)}
                            className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer"
                            title={tr(
                              'إخفاء من مكتبة Glück المحلية (لا يحذف من Grain)',
                              'Remove from local library (does not delete from Grain)',
                              'Lokal entfernen (nicht in Grain gelöscht)'
                            )}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Match Modal */}
      {selectedRecordingForMatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface p-4 shadow-xl space-y-3 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-text-main">
                  {tr(
                    'ربط التسجيل بالحصة وتحديث تعلم المجموعة',
                    'Match Recording to Lesson & Save Group Learning',
                    'Aufzeichnung zuordnen & Gruppen-Lernmuster speichern'
                  )}
                </h3>
                <p className="text-[11px] text-text-muted truncate max-w-md">
                  {selectedRecordingForMatch.title} (
                  {selectedRecordingForMatch.startDatetime.slice(0, 16).replace('T', ' ')})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordingForMatch(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Suggested Candidates with Evidence */}
            {selectedRecordingForMatch.candidates.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {tr(
                    'الحصص المقترحة بناءً على التاريخ والوقت وتعلم المجموعات:',
                    'Suggested Lessons (Date, Time & Group Learning):',
                    'Vorgeschlagene Unterrichtsstunden:'
                  )}
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedRecordingForMatch.candidates.map((cand) => (
                    <div
                      key={cand.lessonId}
                      onClick={() => setManualLessonId(cand.lessonId)}
                      className={`p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        manualLessonId === cand.lessonId
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-surface-border bg-background/60 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-text-main">
                        <span>
                          {cand.lessonTitle || cand.groupName || cand.studentName} ({cand.lessonDate}{' '}
                          {cand.lessonTime})
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                          {cand.confidenceScore}%
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {cand.evidence.reasons.join(' • ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search all lessons */}
            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
              <label className="text-[11px] font-bold text-text-main">
                {tr(
                  'أو اختر أي حصة من الجدول:',
                  'Or select any lesson:',
                  'Oder beliebigen Unterricht wählen:'
                )}
              </label>
              <input
                type="text"
                value={manualMatchSearch}
                onChange={(e) => setManualMatchSearch(e.target.value)}
                placeholder={tr(
                  'ابحث بالتاريخ أو اسم المجموعة أو الطالب...',
                  'Search by date, group name, or student...',
                  'Nach Datum, Gruppe oder Schüler suchen...'
                )}
                className="w-full px-2.5 py-1.5 rounded-xl border border-surface-border bg-background text-xs text-text-main"
              />
              <div className="flex-1 overflow-y-auto border border-surface-border rounded-xl divide-y divide-surface-border max-h-48">
                {lessons
                  .filter((l) => !l.deleted && l.status !== 'cancelled')
                  .filter((l) => {
                    if (!manualMatchSearch.trim()) return true;
                    const q = manualMatchSearch.trim().toLowerCase();
                    return (
                      (l.date || '').toLowerCase().includes(q) ||
                      (l.groupName || '').toLowerCase().includes(q) ||
                      (l.studentName || '').toLowerCase().includes(q) ||
                      (l.title || '').toLowerCase().includes(q)
                    );
                  })
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .slice(0, 60)
                  .map((lesson) => {
                    const grp = groups.find((g) => g.id === lesson.groupId);
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => setManualLessonId(lesson.id)}
                        className={`p-2 text-xs cursor-pointer flex items-center justify-between ${
                          manualLessonId === lesson.id
                            ? 'bg-indigo-500/15 font-bold text-indigo-700 dark:text-indigo-300'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-text-main'
                        }`}
                      >
                        <div>
                          <div>
                            {lesson.groupName || lesson.studentName || lesson.title || lesson.id}
                            {grp ? ` (${grp.name})` : ''}
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {lesson.date} • {lesson.time || ''}
                          </div>
                        </div>
                        {manualLessonId === lesson.id && <Check className="w-4 h-4 text-indigo-600" />}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setSelectedRecordingForMatch(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-text-main cursor-pointer"
              >
                {tr('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                disabled={!manualLessonId}
                onClick={() => handleConfirmMatch(selectedRecordingForMatch, manualLessonId)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {tr(
                  'تأكيد الربط وحفظ تعلم المجموعة',
                  'Confirm Match & Save Group Learning',
                  'Zuordnung & Gruppen-Lernmuster speichern'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Details & Educational Draft Modal */}
      {selectedRecordingDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-2xl rounded-2xl border border-surface-border bg-surface p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-text-main">
                  {selectedRecordingDetails.title}
                </h3>
                <p className="text-[10px] text-text-muted font-mono">
                  ID: {selectedRecordingDetails.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordingDetails(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const linkedLesson = lessons.find(
                (l) => l.id === selectedRecordingDetails.confirmedLessonId
              );
              const assignedGroup = groups.find(
                (g) =>
                  g.id === (selectedRecordingDetails.matchedGroupId || linkedLesson?.groupId)
              );
              const shareClass =
                selectedRecordingDetails.shareAccessClassification ||
                classifyGrainRecordingShareAccess({
                  recordingUrl: selectedRecordingDetails.recordingUrl,
                  share_state: selectedRecordingDetails.rawShareState
                }).classification;

              return (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-background/60 border border-surface-border">
                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {tr('التاريخ والوقت', 'Date & Time', 'Datum & Zeit')}
                      </span>
                      <span className="font-bold text-text-main">
                        {selectedRecordingDetails.startDatetime.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {tr('المدة', 'Duration', 'Dauer')}
                      </span>
                      <span className="font-bold text-text-main">
                        {selectedRecordingDetails.durationMinutes || 60}m
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {tr('حالة رابط ولي الأمر', 'Parent Link Access', 'Eltern-Link-Status')}
                      </span>
                      <div className="mt-0.5">{renderShareAccessBadge(shareClass)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {tr('الحصة المرتبطة', 'Confirmed Lesson', 'Verknüpfter Unterricht')}
                      </span>
                      <span className="font-bold text-text-main">
                        {linkedLesson
                          ? `${linkedLesson.groupName || linkedLesson.studentName || ''} (${
                              linkedLesson.date
                            })`
                          : tr('غير مرتبط بعد', 'Not linked yet', 'Noch nicht verknüpft')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {tr('المجموعة', 'Group Association', 'Gruppenzuordnung')}
                      </span>
                      <span className="font-bold text-text-main">
                        {assignedGroup ? `${assignedGroup.name} (${assignedGroup.id})` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">
                        {tr('صفحة التسجيل', 'Grain Recording Page', 'Grain-Aufzeichnungsseite')}
                      </span>
                      {selectedRecordingDetails.recordingUrl ? (
                        <a
                          href={selectedRecordingDetails.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          <span>{tr('فتح في Grain', 'Open in Grain', 'In Grain öffnen')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>

                  {shareClass !== 'public_access_verified' && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">
                          {tr(
                            'تنبيه مشاركة ولي الأمر: هذا التسجيل غير مؤكد كرابط عام بدون تسجيل دخول.',
                            'Parent Link Notice: This recording is not verified as publicly accessible without login.',
                            'Eltern-Link-Hinweis: Diese Aufzeichnung ist nicht als öffentlich ohne Login verifiziert.'
                          )}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {tr(
                            'لن يتم تضمين هذا الرابط تلقائياً كرابط عام في تقرير ولي الأمر حتى يتم تفعيل المشاركة العامة في Grain.',
                            'Glück will not label or include this link as a public parent link unless public sharing is enabled in Grain.',
                            'Glück markiert diesen Link nicht als öffentlichen Eltern-Link, solange die öffentliche Freigabe in Grain nicht aktiviert ist.'
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRecordingDetails.participantNames &&
                    selectedRecordingDetails.participantNames.length > 0 && (
                      <div className="p-2.5 rounded-xl border border-surface-border bg-background/40">
                        <div className="text-[10px] font-bold text-text-muted mb-1">
                          {tr(
                            'المشاركون المسجلون (لا يُستخدمون أبداً لتغيير الحضور تلقائياً):',
                            'Recorded Participants (never used to modify attendance):',
                            'Aufgezeichnete Teilnehmer (ändern niemals die Anwesenheit):'
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedRecordingDetails.participantNames.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-500/10 text-[11px] text-text-main"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Educational Draft Generation */}
                  <div className="pt-2 border-t border-surface-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span>
                          {tr(
                            'مسودة الملخص التعليمي والواجب ومفردات Lernstudio (بموافقة المعلم)',
                            'Educational Summary, Homework & Lernstudio Draft (Teacher Approval Required)',
                            'Zusammenfassung, Hausaufgaben & Lernstudio-Entwurf (Lehrerbestätigung erforderlich)'
                          )}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGenerateDraftForRecording(selectedRecordingDetails)}
                        disabled={isGeneratingDraft}
                        className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {isGeneratingDraft
                          ? tr('جارٍ التوليد...', 'Generating...', 'Wird erstellt...')
                          : tr('توليد مسودة تعليمية', 'Generate Educational Draft', 'Entwurf erstellen')}
                      </button>
                    </div>

                    {draftError && (
                      <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[11px]">
                        {draftError}
                      </div>
                    )}

                    {draftApprovedMessage && (
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                        {draftApprovedMessage}
                      </div>
                    )}

                    {activeDraft && (
                      <div className="space-y-2 p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                        <div>
                          <label className="text-[10px] font-semibold text-text-muted block mb-0.5">
                            {tr(
                              'ملخص الحصة المعتمد (قابل للتعديل قبل الحفظ)',
                              'Lesson Summary (Editable before saving)',
                              'Unterrichtszusammenfassung (vor dem Speichern bearbeitbar)'
                            )}
                          </label>
                          <textarea
                            rows={2}
                            value={editedSummaryAr}
                            onChange={(e) => setEditedSummaryAr(e.target.value)}
                            className="w-full rounded-lg border border-surface-border bg-background px-2 py-1 text-xs text-text-main"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-text-muted block mb-0.5">
                            {tr(
                              'الواجب المنزلي والتدريبات المقترحة',
                              'Homework & Suggested Practice',
                              'Hausaufgaben & vorgeschlagene Übungen'
                            )}
                          </label>
                          <textarea
                            rows={2}
                            value={editedHomeworkText}
                            onChange={(e) => setEditedHomeworkText(e.target.value)}
                            className="w-full rounded-lg border border-surface-border bg-background px-2 py-1 text-xs text-text-main"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {linkedLesson && (
                            <button
                              type="button"
                              onClick={() => handleApproveDraftToLesson(selectedRecordingDetails)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>
                                {tr(
                                  'اعتماد وحفظ في سجل الحصة',
                                  'Approve & Save to Lesson',
                                  'Bestätigen & im Unterricht speichern'
                                )}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleApproveLernstudioSet(selectedRecordingDetails)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Gamepad2 className="w-3.5 h-3.5" />
                            <span>
                              {tr(
                                'إنشاء مجموعة Lernstudio معتمدة',
                                'Approve & Create Lernstudio Set',
                                'Lernstudio-Set erstellen'
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
