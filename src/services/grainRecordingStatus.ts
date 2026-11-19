import {
  GrainDiscoveredRecording,
  GrainExtractedLessonContent,
  GrainShareAccessClassification,
  Group,
  GroupWeeklySession,
  Lesson,
  Student,
  ZoomMeetingHistory
} from '../types';
import {
  classifyGrainRecordingShareAccess,
  normalizeZoomMeetingUrl
} from './grainService';

export type GrainLifecycleStatus =
  | 'received'
  | 'processing'
  | 'transcript_available'
  | 'ai_notes_available'
  | 'lesson_extraction_completed'
  | 'pending_part2'
  | 'review_required'
  | 'processing_failed';

export type GrainRecognitionState = 'recognized' | 'review_required' | 'inaccessible';

export type GrainRecognitionSource =
  | 'active_zoom_id'
  | 'historical_zoom_id'
  | 'standardized_topic'
  | 'calendar_uid'
  | 'schedule_session'
  | 'linked_lesson'
  | 'unresolved';

export type GrainTranscriptAvailability = 'available' | 'partial' | 'unavailable' | 'pending';

export type GrainExtractionState = 'completed' | 'partial' | 'pending' | 'unavailable' | 'failed';

export type GrainLibraryFilterKey =
  | 'all'
  | 'processing'
  | 'completed'
  | 'pending_part2'
  | 'review_required'
  | 'processing_failed';

export type GrainPrimaryActionKind = 'view_details' | 'view_progress' | 'retry' | 'resolve_issue';

export type GrainSecondaryActionKind =
  | 'view_details'
  | 'open_in_grain'
  | 'open_linked_group'
  | 'retry_processing'
  | 'delete_recording';

export interface GrainRecordingSegmentItem {
  slot: 'part1' | 'part2';
  recordingId: string;
  title: string;
  startDatetime: string;
  endDatetime?: string;
  durationMinutes: number;
  recordingUrl: string;
  zoomMeetingId?: string;
  shareAccess: GrainShareAccessClassification;
  hasAiNotes: boolean;
  sourceRecording?: GrainDiscoveredRecording;
}

export interface GrainLibraryEntry {
  /** Stable key for list rendering (primary recording ID) */
  id: string;
  primaryRecording: GrainDiscoveredRecording;
  segments: GrainRecordingSegmentItem[];
  segmentCount: 1 | 2;
  part2StartGapMinutes?: number;
  title: string;
  startDatetime: string;
  dateYmd: string;
  startTimeHm: string;
  totalDurationMinutes: number;
  zoomMeetingId?: string;
  zoomSourceLabel?: string;

  /** A. Independent Recording Recognition state */
  recognition: {
    status: GrainRecognitionState;
    source: GrainRecognitionSource;
    group?: Group;
    groupName?: string;
    session?: GroupWeeklySession;
    lesson?: Lesson;
    reviewReasonCode?:
      | 'conflicting_identifiers'
      | 'multiple_candidates'
      | 'unrecognized_meeting'
      | 'schedule_changed'
      | 'slot_overwrite_conflict'
      | 'inaccessible_recording'
      | 'ambiguous_segment';
    reviewReasonDetail?: string;
  };

  /** B. Independent Grain Processing state */
  grain: {
    recordingAvailable: boolean;
    transcriptStatus: GrainTranscriptAvailability;
    aiNotesAvailable: boolean;
    shareAccess: GrainShareAccessClassification;
    processingError?: string;
  };

  /** C. Independent Glück Lesson Extraction state */
  extraction: {
    status: GrainExtractionState;
    content?: GrainExtractedLessonContent;
    teacherEdited: boolean;
    hasPendingUpdatedExtraction: boolean;
  };

  /** Overall lifecycle status accurately derived from actual recording & lesson data */
  lifecycleStatus: GrainLifecycleStatus;
  /** Primary contextual action — NEVER "Match" or "Confirm" */
  primaryAction: GrainPrimaryActionKind;
  /** Applicable secondary actions for overflow menu / bottom sheet */
  secondaryActions: GrainSecondaryActionKind[];
  /** Non-sensitive participant names for search & details display only */
  participantNames: string[];
}

export interface GrainLibraryStats {
  total: number;
  processing: number;
  completed: number;
  reviewRequired: number;
  pendingPart2: number;
  failed: number;
}

function formatHmFromIso(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    const m = /T(\d{2}:\d{2})/.exec(iso);
    return m ? m[1] : '—';
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateYmdFromIso(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return iso.slice(0, 10);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function extractCanonicalZoomId(rec: GrainDiscoveredRecording, session?: GroupWeeklySession): string | undefined {
  if (rec.zoomMeetingId && /^\d{8,13}$/.test(rec.zoomMeetingId.trim())) {
    return rec.zoomMeetingId.trim();
  }
  const fromUrl = normalizeZoomMeetingUrl(rec.zoomMeetingUrl)?.meetingId;
  if (fromUrl) return fromUrl;
  if (rec.evidence?.normalizedGrainZoomId && /^\d{8,13}$/.test(rec.evidence.normalizedGrainZoomId)) {
    return rec.evidence.normalizedGrainZoomId;
  }
  if (session?.zoomMeetingId && /^\d{8,13}$/.test(session.zoomMeetingId)) {
    return session.zoomMeetingId;
  }
  return undefined;
}

function deriveRecognitionSource(
  rec: GrainDiscoveredRecording,
  isRecognized: boolean
): GrainRecognitionSource {
  if (!isRecognized) return 'unresolved';
  if (rec.evidence?.matchedFromHistory) return 'historical_zoom_id';
  if (rec.matchTier === 'zoom_meeting_id' || rec.evidence?.matchTier === 'zoom_meeting_id') {
    return 'active_zoom_id';
  }
  if (rec.matchTier === 'standardized_topic' || rec.evidence?.matchTier === 'standardized_topic') {
    return 'standardized_topic';
  }
  if (rec.matchTier === 'calendar_uid' || rec.evidence?.matchTier === 'calendar_uid') {
    return 'calendar_uid';
  }
  if (rec.matchStatus === 'already_linked') return 'linked_lesson';
  return 'schedule_session';
}

function deriveReviewReason(rec: GrainDiscoveredRecording): {
  code: NonNullable<GrainLibraryEntry['recognition']['reviewReasonCode']>;
  detail: string;
} {
  const joinedReasons = (rec.matchReasons || []).join(' ');
  const lower = joinedReasons.toLowerCase();

  if (rec.matchStatus === 'inaccessible' || !rec.recordingUrl) {
    return {
      code: 'inaccessible_recording',
      detail: 'Recording link is missing or inaccessible in Grain.'
    };
  }
  if (
    lower.includes('conflicting identifiers') ||
    lower.includes('different weekly session') ||
    rec.evidence?.zoomLinkStatus === 'mismatch'
  ) {
    return {
      code: 'conflicting_identifiers',
      detail:
        rec.matchReasons.find((r) => /conflict|mismatch|differs|different weekly session/i.test(r)) ||
        'Zoom meeting identity conflicts with the recording topic or scheduled session.'
    };
  }
  if (lower.includes('overlaps another scheduled lesson') || lower.includes('potential part 2')) {
    return {
      code: 'ambiguous_segment',
      detail:
        rec.matchReasons.find((r) => /part 2|overlaps/i.test(r)) ||
        'Second recording segment overlaps another scheduled session and could not be paired automatically.'
    };
  }
  if (lower.includes('already contains an existing recording link')) {
    return {
      code: 'slot_overwrite_conflict',
      detail: 'Target lesson already has a linked recording; review before replacing it.'
    };
  }
  if (rec.matchStatus === 'multiple_possible_lessons') {
    return {
      code: 'multiple_candidates',
      detail: 'Multiple scheduled lessons overlap this recording time window without a unique Zoom identity.'
    };
  }
  if (rec.evidence?.scheduleChangedRequiresConfirmation) {
    return {
      code: 'schedule_changed',
      detail: 'Recording time differs from the group’s usual weekly schedule.'
    };
  }
  return {
    code: 'unrecognized_meeting',
    detail:
      'No recognizable standardized Zoom meeting ID, historical meeting mapping, or matching scheduled session was found.'
  };
}

function isExtractedContentPopulated(content?: GrainExtractedLessonContent): boolean {
  if (!content) return false;
  if (content.transcriptStatus === 'transcript_unavailable') return false;
  return Boolean(
    (content.themaDerStunde && content.themaDerStunde.trim()) ||
      (content.formattedLessonSummaryDe && content.formattedLessonSummaryDe.trim()) ||
      (content.behandelteInhalte && content.behandelteInhalte.length > 0) ||
      (content.neueWoerterUndRedemittel && content.neueWoerterUndRedemittel.length > 0) ||
      (content.grammatik && content.grammatik.length > 0)
  );
}

/**
 * Builds modernized library entries by:
 * 1. Pairing Part 1 + Part 2 segments belonging to the same logical Glück lesson without duplicates.
 * 2. Separating Recognition, Grain Processing, and Glück Lesson Extraction states cleanly.
 * 3. Computing accurate lifecycle statuses and contextual actions (no Match/Confirm actions on normal items).
 */
export function buildGrainLibraryEntries(options: {
  recordings: GrainDiscoveredRecording[];
  lessons: Lesson[];
  groups: Group[];
  weeklySessions?: GroupWeeklySession[];
  zoomHistory?: ZoomMeetingHistory[];
  processingRecordingIds?: ReadonlySet<string>;
  failedRecordingErrors?: Readonly<Record<string, string>>;
}): GrainLibraryEntry[] {
  const {
    recordings = [],
    lessons = [],
    groups = [],
    weeklySessions = [],
    zoomHistory = [],
    processingRecordingIds,
    failedRecordingErrors
  } = options;

  const activeGroups = groups.filter((g) => g && !g.deleted);
  const activeSessions = weeklySessions.filter((s) => s && !s.deleted);
  const activeLessons = lessons.filter((l) => l && !l.deleted);

  const lessonById = new Map<string, Lesson>();
  for (const l of activeLessons) lessonById.set(l.id, l);

  const groupById = new Map<string, Group>();
  for (const g of activeGroups) groupById.set(g.id, g);

  const sessionById = new Map<string, GroupWeeklySession>();
  for (const s of activeSessions) sessionById.set(s.id, s);

  const recById = new Map<string, GrainDiscoveredRecording>();
  for (const r of recordings) {
    if (r && !r.removedFromLibrary) {
      recById.set(r.id, r);
    }
  }

  // Group paired Part 1 & Part 2 segments belonging to the same logical lesson so the library
  // shows ONE logical entry with clear segment count instead of duplicating the lesson row.
  const consumedPart2Ids = new Set<string>();
  const pairedGroups: Array<{
    primary: GrainDiscoveredRecording;
    secondary?: GrainDiscoveredRecording;
    lesson?: Lesson;
  }> = [];

  // Sort deterministically chronologically (oldest first within pairs, then we sort entries newest first at end)
  const orderedRecordings = Array.from(recById.values()).sort((a, b) =>
    (a.startDatetime || '').localeCompare(b.startDatetime || '')
  );

  for (const rec of orderedRecordings) {
    if (consumedPart2Ids.has(rec.id)) continue;

    const confirmedLesson = rec.confirmedLessonId ? lessonById.get(rec.confirmedLessonId) : undefined;

    // Look for a confirmed or confidently paired Part 2 partner
    let partner: GrainDiscoveredRecording | undefined;
    if (rec.detectedPartSlot !== 'part2') {
      if (rec.pairedRecordingId && recById.has(rec.pairedRecordingId)) {
        const candidatePartner = recById.get(rec.pairedRecordingId)!;
        if (
          candidatePartner.id !== rec.id &&
          !consumedPart2Ids.has(candidatePartner.id) &&
          candidatePartner.matchStatus !== 'needs_confirmation' &&
          candidatePartner.matchStatus !== 'multiple_possible_lessons'
        ) {
          partner = candidatePartner;
        }
      } else if (
        confirmedLesson?.grainMeta?.recordingId === rec.id &&
        confirmedLesson.grainMeta?.recordingIdPart2 &&
        recById.has(confirmedLesson.grainMeta.recordingIdPart2)
      ) {
        const candidatePartner = recById.get(confirmedLesson.grainMeta.recordingIdPart2)!;
        if (candidatePartner.id !== rec.id && !consumedPart2Ids.has(candidatePartner.id)) {
          partner = candidatePartner;
        }
      }
    }

    if (partner) {
      consumedPart2Ids.add(partner.id);
    }

    pairedGroups.push({
      primary: rec,
      secondary: partner,
      lesson: confirmedLesson
    });
  }

  const entries: GrainLibraryEntry[] = pairedGroups.map(({ primary, secondary, lesson: confirmedLesson }) => {
    // Determine if recording is automatically recognized / linked vs genuinely requiring review
    const isInaccessible = primary.matchStatus === 'inaccessible' || !primary.recordingUrl;
    const isRecognized =
      !isInaccessible &&
      (primary.matchStatus === 'already_linked' ||
        primary.matchStatus === 'automatically_matched' ||
        Boolean(confirmedLesson));

    const effectiveLesson =
      confirmedLesson ||
      (isRecognized && primary.suggestedLessonId ? lessonById.get(primary.suggestedLessonId) : undefined);

    const matchedSessionId =
      primary.matchedSessionId ||
      primary.evidence?.matchedSessionId ||
      secondary?.matchedSessionId ||
      secondary?.evidence?.matchedSessionId;
    let linkedSession = matchedSessionId ? sessionById.get(matchedSessionId) : undefined;

    const canonicalZoomId = extractCanonicalZoomId(primary, linkedSession);

    // Fallback session resolution by active/historical Zoom meeting ID when recognized
    if (!linkedSession && canonicalZoomId) {
      linkedSession = activeSessions.find((s) => s.zoomMeetingId === canonicalZoomId);
      if (!linkedSession) {
        const hist = zoomHistory.find(
          (h) =>
            !h.deleted &&
            (h.previousZoomMeetingId === canonicalZoomId || h.newZoomMeetingId === canonicalZoomId)
        );
        if (hist?.sessionId) {
          linkedSession = sessionById.get(hist.sessionId);
        }
      }
    }

    const resolvedGroupId = isRecognized
      ? effectiveLesson?.groupId || primary.matchedGroupId || linkedSession?.groupId
      : undefined;
    const linkedGroup = resolvedGroupId ? groupById.get(resolvedGroupId) : undefined;
    const resolvedGroupName = isRecognized
      ? linkedGroup?.name || effectiveLesson?.groupName || primary.matchedGroupName || linkedSession?.groupNameSnapshot
      : undefined;

    // Build segment list (1 or 2 segments)
    const share1 =
      primary.shareAccessClassification ||
      classifyGrainRecordingShareAccess({
        recordingUrl: primary.recordingUrl,
        share_state: primary.rawShareState
      }).classification;

    const segments: GrainRecordingSegmentItem[] = [
      {
        slot: primary.detectedPartSlot === 'part2' && !secondary ? 'part2' : 'part1',
        recordingId: primary.id,
        title: primary.title,
        startDatetime: primary.startDatetime,
        endDatetime: primary.endDatetime,
        durationMinutes: primary.durationMinutes || Math.max(1, Math.round((primary.durationSeconds || 0) / 60)),
        recordingUrl: primary.recordingUrl,
        zoomMeetingId: extractCanonicalZoomId(primary, linkedSession),
        shareAccess: share1,
        hasAiNotes: Boolean(primary.hasAiSummary),
        sourceRecording: primary
      }
    ];

    if (secondary) {
      const share2 =
        secondary.shareAccessClassification ||
        classifyGrainRecordingShareAccess({
          recordingUrl: secondary.recordingUrl,
          share_state: secondary.rawShareState
        }).classification;
      segments.push({
        slot: 'part2',
        recordingId: secondary.id,
        title: secondary.title,
        startDatetime: secondary.startDatetime,
        endDatetime: secondary.endDatetime,
        durationMinutes:
          secondary.durationMinutes || Math.max(1, Math.round((secondary.durationSeconds || 0) / 60)),
        recordingUrl: secondary.recordingUrl,
        zoomMeetingId: extractCanonicalZoomId(secondary, linkedSession),
        shareAccess: share2,
        hasAiNotes: Boolean(secondary.hasAiSummary),
        sourceRecording: secondary
      });
    } else if (
      effectiveLesson?.grainMeta?.recordingIdPart2 &&
      effectiveLesson.grainMeta.recordingIdPart2 !== primary.id &&
      effectiveLesson.grainMeta.recordingUrlPart2
    ) {
      // Lesson already carries Part 2 metadata even if Part 2 wasn't in the active page
      segments.push({
        slot: 'part2',
        recordingId: effectiveLesson.grainMeta.recordingIdPart2,
        title: effectiveLesson.grainMeta.recordingTitlePart2 || `${primary.title} (Part 2)`,
        startDatetime: effectiveLesson.grainMeta.startTimestampPart2 || primary.startDatetime,
        endDatetime: effectiveLesson.grainMeta.endTimestampPart2,
        durationMinutes: effectiveLesson.grainMeta.durationMinutesPart2 || 20,
        recordingUrl: effectiveLesson.grainMeta.recordingUrlPart2,
        zoomMeetingId: canonicalZoomId,
        shareAccess: effectiveLesson.grainMeta.shareAccessClassificationPart2 || 'unknown',
        hasAiNotes: false
      });
    }

    const segmentCount: 1 | 2 = segments.length >= 2 ? 2 : 1;
    const totalDurationMinutes = segments.reduce((sum, seg) => sum + (seg.durationMinutes || 0), 0);
    const part2StartGapMinutes =
      primary.part2StartGapMinutes ||
      secondary?.part2StartGapMinutes ||
      effectiveLesson?.grainMeta?.part2StartGapMinutes;

    // B. Grain Processing state
    const extracted = effectiveLesson?.grainMeta?.extractedLessonContent;
    const sourceKinds = extracted?.sourceKinds || [];
    const processingError =
      failedRecordingErrors?.[primary.id] ||
      (secondary ? failedRecordingErrors?.[secondary.id] : undefined) ||
      primary.processingError ||
      secondary?.processingError;

    const isActivelyProcessing = Boolean(
      processingRecordingIds?.has(primary.id) || (secondary && processingRecordingIds?.has(secondary.id))
    );

    const hasAiNotes = Boolean(
      primary.hasAiSummary ||
        secondary?.hasAiSummary ||
        sourceKinds.includes('ai_notes')
    );

    let transcriptStatus: GrainTranscriptAvailability = 'pending';
    if (extracted?.transcriptStatus === 'transcript_unavailable') {
      transcriptStatus = 'unavailable';
    } else if (
      extracted?.transcriptStatus === 'partial_transcript' ||
      extracted?.transcriptStatus === 'partial_part1_only' ||
      extracted?.transcriptStatus === 'partial_part2_only'
    ) {
      transcriptStatus = 'partial';
    } else if (
      sourceKinds.includes('transcript') ||
      extracted?.transcriptStatus === 'complete' ||
      extracted?.transcriptStatus === 'extracted'
    ) {
      transcriptStatus = 'available';
    }

    // C. Glück Lesson Extraction state
    let extractionStatus: GrainExtractionState = 'pending';
    if (processingError) {
      extractionStatus = 'failed';
    } else if (isExtractedContentPopulated(extracted)) {
      extractionStatus =
        extracted?.transcriptStatus === 'partial_transcript' ||
        extracted?.transcriptStatus === 'partial_part1_only' ||
        extracted?.transcriptStatus === 'partial_part2_only'
          ? 'partial'
          : 'completed';
    } else if (extracted?.transcriptStatus === 'transcript_unavailable') {
      extractionStatus = 'unavailable';
    }

    // Detect "Pending Part 2" strictly when backed by actual recording + lesson/session duration data:
    // Part 1 is recognized (~33-45m Zoom Basic cutoff), no Part 2 yet, and scheduled lesson/session is > 45 min (or planWarning40Min)
    const scheduledDuration =
      effectiveLesson?.durationMinutes ||
      effectiveLesson?.duration ||
      linkedSession?.durationMinutes ||
      linkedGroup?.lessonDurationMinutes ||
      0;
    const part1Duration = segments[0]?.durationMinutes || 0;
    const isPendingPart2 = Boolean(
      isRecognized &&
        segmentCount === 1 &&
        segments[0]?.slot === 'part1' &&
        (scheduledDuration > 45 || linkedSession?.planWarning40Min) &&
        part1Duration >= 33 &&
        part1Duration <= 45 &&
        !processingError
    );

    // Derive primary lifecycle status accurately from actual state
    let lifecycleStatus: GrainLifecycleStatus;
    if (isInaccessible || Boolean(processingError)) {
      lifecycleStatus = 'processing_failed';
    } else if (!isRecognized) {
      lifecycleStatus = 'review_required';
    } else if (isActivelyProcessing) {
      lifecycleStatus = 'processing';
    } else if (isPendingPart2 && extractionStatus !== 'completed') {
      lifecycleStatus = 'pending_part2';
    } else if (extractionStatus === 'completed') {
      lifecycleStatus = isPendingPart2 ? 'pending_part2' : 'lesson_extraction_completed';
    } else if (hasAiNotes) {
      lifecycleStatus = 'ai_notes_available';
    } else if (transcriptStatus === 'available' || transcriptStatus === 'partial') {
      lifecycleStatus = 'transcript_available';
    } else if (effectiveLesson && extractionStatus === 'pending') {
      lifecycleStatus = 'processing';
    } else {
      lifecycleStatus = 'received';
    }

    // Recognition object
    const recognitionStatus: GrainRecognitionState = isInaccessible
      ? 'inaccessible'
      : isRecognized
      ? 'recognized'
      : 'review_required';
    const reviewInfo = recognitionStatus !== 'recognized' ? deriveReviewReason(primary) : undefined;

    // Contextual Primary Action (NEVER Match or Confirm)
    let primaryAction: GrainPrimaryActionKind = 'view_details';
    if (lifecycleStatus === 'processing_failed') {
      primaryAction = 'retry';
    } else if (lifecycleStatus === 'review_required') {
      primaryAction = 'resolve_issue';
    } else if (lifecycleStatus === 'processing' || lifecycleStatus === 'pending_part2') {
      primaryAction = 'view_progress';
    } else {
      primaryAction = 'view_details';
    }

    // Applicable Secondary Actions only
    const secondaryActions: GrainSecondaryActionKind[] = ['view_details'];
    if (primary.recordingUrl) {
      secondaryActions.push('open_in_grain');
    }
    if (linkedGroup) {
      secondaryActions.push('open_linked_group');
    }
    if (
      effectiveLesson &&
      !isInaccessible &&
      (lifecycleStatus === 'processing_failed' ||
        extractionStatus === 'unavailable' ||
        extractionStatus === 'pending' ||
        extractionStatus === 'partial' ||
        lifecycleStatus === 'pending_part2')
    ) {
      secondaryActions.push('retry_processing');
    }
    secondaryActions.push('delete_recording');

    const participantsSet = new Set<string>([
      ...(primary.participantNames || []),
      ...(secondary?.participantNames || [])
    ]);

    return {
      id: primary.id,
      primaryRecording: primary,
      segments,
      segmentCount,
      part2StartGapMinutes,
      title: primary.title || 'Grain Recording',
      startDatetime: primary.startDatetime,
      dateYmd: formatDateYmdFromIso(primary.startDatetime),
      startTimeHm: formatHmFromIso(primary.startDatetime),
      totalDurationMinutes,
      zoomMeetingId: canonicalZoomId,
      zoomSourceLabel:
        primary.evidence?.matchedFromHistory
          ? 'historical_zoom_id'
          : canonicalZoomId
          ? 'active_zoom_id'
          : undefined,
      recognition: {
        status: recognitionStatus,
        source: deriveRecognitionSource(primary, isRecognized),
        group: linkedGroup,
        groupName: resolvedGroupName,
        session: linkedSession,
        lesson: effectiveLesson,
        reviewReasonCode: reviewInfo?.code,
        reviewReasonDetail: reviewInfo?.detail
      },
      grain: {
        recordingAvailable: !isInaccessible,
        transcriptStatus,
        aiNotesAvailable: hasAiNotes,
        shareAccess: share1,
        processingError
      },
      extraction: {
        status: extractionStatus,
        content: extracted,
        teacherEdited: Boolean(extracted?.teacherEdited),
        hasPendingUpdatedExtraction: Boolean(extracted?.pendingUpdatedExtraction)
      },
      lifecycleStatus,
      primaryAction,
      secondaryActions,
      participantNames: Array.from(participantsSet)
    };
  });

  // Sort newest first
  return entries.sort((a, b) => (b.startDatetime || '').localeCompare(a.startDatetime || ''));
}

export function computeGrainLibraryStats(entries: GrainLibraryEntry[]): GrainLibraryStats {
  let processing = 0;
  let completed = 0;
  let reviewRequired = 0;
  let pendingPart2 = 0;
  let failed = 0;

  for (const e of entries) {
    switch (e.lifecycleStatus) {
      case 'lesson_extraction_completed':
        completed++;
        break;
      case 'review_required':
        reviewRequired++;
        break;
      case 'pending_part2':
        pendingPart2++;
        processing++;
        break;
      case 'processing_failed':
        failed++;
        break;
      case 'received':
      case 'processing':
      case 'transcript_available':
      case 'ai_notes_available':
        processing++;
        break;
    }
  }

  return {
    total: entries.length,
    processing,
    completed,
    reviewRequired,
    pendingPart2,
    failed
  };
}

export function filterGrainLibraryEntries(
  entries: GrainLibraryEntry[],
  filters: {
    searchQuery?: string;
    statusFilter?: GrainLibraryFilterKey;
    groupFilter?: string;
    studentFilter?: string;
    dateFilter?: string;
    students?: Student[];
  }
): GrainLibraryEntry[] {
  const q = (filters.searchQuery || '').trim().toLowerCase();
  const statusFilter = filters.statusFilter || 'all';
  const groupFilter = filters.groupFilter || 'all';
  const studentFilter = filters.studentFilter || 'all';
  const dateFilter = (filters.dateFilter || '').trim();
  const targetStudent =
    studentFilter !== 'all' ? (filters.students || []).find((s) => s.id === studentFilter) : undefined;

  return entries.filter((entry) => {
    if (statusFilter !== 'all') {
      if (
        statusFilter === 'processing' &&
        entry.lifecycleStatus !== 'processing' &&
        entry.lifecycleStatus !== 'received' &&
        entry.lifecycleStatus !== 'transcript_available' &&
        entry.lifecycleStatus !== 'ai_notes_available'
      ) {
        return false;
      }
      if (statusFilter === 'completed' && entry.lifecycleStatus !== 'lesson_extraction_completed') {
        return false;
      }
      if (statusFilter === 'pending_part2' && entry.lifecycleStatus !== 'pending_part2') {
        return false;
      }
      if (statusFilter === 'review_required' && entry.lifecycleStatus !== 'review_required') {
        return false;
      }
      if (statusFilter === 'processing_failed' && entry.lifecycleStatus !== 'processing_failed') {
        return false;
      }
    }

    if (dateFilter && entry.dateYmd !== dateFilter && !entry.startDatetime.startsWith(dateFilter)) {
      return false;
    }

    const entryGroupId = entry.recognition.group?.id || entry.recognition.lesson?.groupId || '';
    if (groupFilter !== 'all' && entryGroupId !== groupFilter) {
      return false;
    }

    if (studentFilter !== 'all') {
      const matchesStudentLesson = entry.recognition.lesson?.studentId === studentFilter;
      const matchesStudentGroup = Boolean(targetStudent?.groupId) && entryGroupId === targetStudent?.groupId;
      if (!matchesStudentLesson && !matchesStudentGroup) {
        return false;
      }
    }

    if (q) {
      const titleHit = entry.title.toLowerCase().includes(q);
      const groupHit = (entry.recognition.groupName || '').toLowerCase().includes(q);
      const sessionHit = (entry.recognition.session?.sessionCode || '').toLowerCase().includes(q);
      const dateHit = entry.dateYmd.toLowerCase().includes(q);
      const zoomHit = (entry.zoomMeetingId || '').toLowerCase().includes(q);
      const partHit = entry.participantNames.some((p) => p.toLowerCase().includes(q));
      if (!titleHit && !groupHit && !sessionHit && !dateHit && !zoomHit && !partHit) {
        return false;
      }
    }

    return true;
  });
}
