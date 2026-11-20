import {
  Group,
  GroupWeeklySession,
  ZoomMeetingHistory,
  ZoomMeetingRecord
} from '../types';
import { storage } from './storageService';
import {
  CalendarCleanupEventDecision,
  GoogleCalendarCleanupEvent,
  deleteGoogleCalendarEventForCleanup,
  getInMemoryGoogleCalendarToken,
  listPrimaryGoogleCalendarEventsForCleanup,
  matchGoogleCalendarEventsToZoomCleanup,
  syncSessionsToGoogleCalendar
} from './calendarSyncService';
import {
  ZoomScheduledMeetingItem,
  appendZoomHistoryEntry,
  buildZoomMigrationPreview,
  createOrReplaceZoomMeetingForSession,
  deleteZoomMeetingSeriesRemote,
  listAllZoomScheduledMeetings,
  loadZoomUiMeta,
  redactZoomSecrets,
  sanitizeZoomRecordForStorage,
  saveZoomUiMeta
} from './zoomService';
import {
  DEFAULT_ZOOM_TIMEZONE,
  deriveDeterministicGoogleEventId,
  extractNumericZoomMeetingId
} from './zoomSessionStandardizer';

export const CLEANUP_REBUILD_OPERATION_STORAGE_KEY = 'glueck_zoom_cleanup_rebuild_op_v1';
export const CLEANUP_RECOVERY_SNAPSHOTS_STORAGE_KEY = 'glueck_zoom_cleanup_recovery_snapshots_v1';

export type CleanupRebuildState =
  | 'preview_ready'
  | 'cleanup_in_progress'
  | 'zoom_deletion_in_progress'
  | 'calendar_cleanup_in_progress'
  | 'old_meetings_verified_empty'
  | 'rebuilding_zoom_meetings'
  | 'syncing_calendar_events'
  | 'completed'
  | 'completed_with_errors'
  | 'paused'
  | 'failed';

export type CleanupItemStatus = 'pending' | 'succeeded' | 'already_deleted' | 'skipped_live' | 'failed';
export type RebuildZoomItemStatus = 'pending' | 'succeeded' | 'failed';
export type RebuildCalendarItemStatus = 'pending' | 'succeeded' | 'failed' | 'skipped_zoom_failed' | 'skipped_disconnected';

export interface PreviewZoomMeetingEntry {
  id: string;
  uuid?: string;
  topic: string;
  type: number;
  isRecurring: boolean;
  startTime?: string;
  duration?: number;
  timezone?: string;
  joinUrl: string;
  status?: string;
  isLive: boolean;
  willDelete: boolean;
  associatedGroupId?: string;
  associatedGroupName?: string;
  associatedSessionId?: string;
  associatedSessionCode?: string;
  associationSource: 'active_session' | 'history_or_record' | 'unreferenced_external_or_manual';
}

export interface ManualResolutionItem {
  category:
    | 'live_zoom_meeting'
    | 'group_missing_schedule'
    | 'ambiguous_calendar_event'
    | 'calendar_not_connected'
    | 'remaining_old_meeting'
    | 'failed_item';
  id: string;
  title: string;
  detail: string;
}

export interface CleanupRebuildPreview {
  generatedAtIso: string;
  hostEmail: string | null;
  hostScope: 'single_connected_host';
  hostScopeDisclosure: string;
  timezone: string;
  totalScheduledZoomMeetingsFound: number;
  zoomMeetingsToDeleteCount: number;
  liveMeetingsBlockedCount: number;
  zoomMeetings: PreviewZoomMeetingEntry[];
  liveMeetings: PreviewZoomMeetingEntry[];
  activeOnlineGroupsCount: number;
  activeGluckOnlineSessionsCount: number;
  activeSessionsToRebuild: Array<{
    sessionId: string;
    sessionCode: string;
    groupId: string;
    groupName: string;
    weekdayName: string;
    startTime: string;
    durationMinutes: number;
    standardizedTitle: string;
    previousZoomMeetingId?: string;
    previousZoomUrl?: string;
    previousGoogleCalendarEventId?: string;
    planWarning40Min: boolean;
  }>;
  groupsMissingSchedule: Array<{ groupId: string; groupName: string }>;
  calendarConnected: boolean;
  calendarEventsScannedCount: number;
  calendarEventsToDeleteCount: number;
  calendarEventsUntouchedCount: number;
  calendarEventsToDelete: CalendarCleanupEventDecision[];
  calendarAmbiguousEvents: CalendarCleanupEventDecision[];
  calendarUntouchedEventIds: string[];
  manualResolutionItems: ManualResolutionItem[];
  reconciledSessions: GroupWeeklySession[];
  reconciledHistory: ZoomMeetingHistory[];
  historicalZoomMeetingIds: string[];
  historicalZoomJoinUrls: string[];
  storedCalendarEventIds: string[];
}

export interface CleanupRecoverySnapshotSessionEntry {
  groupId: string;
  groupName: string;
  sessionId: string;
  sessionCode: string;
  previousZoomMeetingId?: string;
  previousJoinUrl?: string;
  previousZoomPasscode?: string;
  previousGoogleCalendarEventId?: string;
  previousGoogleCalendarIcalUid?: string;
  previousCalendarEventUid?: string;
  previousMeetingSource?: string;
}

export interface CleanupRecoverySnapshot {
  snapshotId: string;
  operationId: string;
  createdAtIso: string;
  hostEmail: string | null;
  hostScope: 'single_connected_host';
  sessions: CleanupRecoverySnapshotSessionEntry[];
  historicalZoomMeetingIds: string[];
  historicalZoomJoinUrls: string[];
  zoomMeetingsPlannedForDeletion: Array<{
    id: string;
    uuid?: string;
    topic: string;
    type: number;
    isRecurring: boolean;
    startTime?: string;
    joinUrl: string;
    isLive: boolean;
    associatedGroupId?: string;
    associatedGroupName?: string;
    associatedSessionId?: string;
  }>;
  calendarEventsPlannedForDeletion: Array<{
    eventId: string;
    summary: string;
    startDateTime?: string;
    isRecurringSeries: boolean;
    signals: string[];
    matchedZoomMeetingIds: string[];
    matchedSessionId?: string;
  }>;
}

export interface ZoomDeletionCheckpointItem {
  meetingId: string;
  uuid?: string;
  topic: string;
  type: number;
  isRecurring: boolean;
  startTime?: string;
  joinUrl: string;
  isLive: boolean;
  status: CleanupItemStatus;
  attempts: number;
  lastError?: string;
  completedAtIso?: string;
}

export interface CalendarDeletionCheckpointItem {
  eventId: string;
  summary: string;
  startDateTime?: string;
  isRecurringSeries: boolean;
  signals: string[];
  matchedZoomMeetingIds: string[];
  matchedSessionId?: string;
  status: CleanupItemStatus;
  attempts: number;
  lastError?: string;
  completedAtIso?: string;
}

export interface RebuildSessionCheckpointItem {
  sessionId: string;
  sessionCode: string;
  groupId: string;
  groupName: string;
  standardizedTitle: string;
  weekdayName: string;
  startTime: string;
  durationMinutes: number;
  zoomStatus: RebuildZoomItemStatus;
  newZoomMeetingId?: string;
  newZoomJoinUrl?: string;
  zoomAttempts: number;
  zoomLastError?: string;
  calendarStatus: RebuildCalendarItemStatus;
  newGoogleCalendarEventId?: string;
  calendarAttempts: number;
  calendarLastError?: string;
}

export interface CleanupRebuildVerificationResult {
  checkedAtIso: string;
  passed: boolean;
  zeroOldZoomMeetingsRemain: boolean;
  allRemainingMeetingsCreatedByGluck: boolean;
  everyActiveOnlineSessionHasOneMeeting: boolean;
  noDuplicateMeetingIdsOrUrls: boolean;
  allNewLinksSavedInGluck: boolean;
  expectedCalendarEventsExistWithExactNewZoomUrl: boolean;
  zeroUnrelatedCalendarEventsDeleted: boolean;
  zeroOldLinkedCalendarEventsRemain: boolean;
  remainingZoomMeetingsCount: number;
  remainingOldZoomMeetingIds: string[];
  remainingOldLinkedCalendarEventIds: string[];
  missingCalendarSessionIds: string[];
  unrelatedDeletedCalendarEventIds: string[];
  issues: string[];
}

export interface CleanupRebuildFinalReport {
  zoomMeetingsFoundBeforeCleanup: number;
  zoomMeetingsDeleted: number;
  zoomMeetingsSkippedOrFailed: number;
  calendarEventsDeleted: number;
  calendarEventsUntouched: number;
  newGluckZoomMeetingsCreated: number;
  calendarEventsRecreatedOrUpdated: number;
  failedItemsCount: number;
  verificationPassed: boolean;
  remainingProblems: string[];
}

export interface CleanupRebuildOperationRecord {
  operationId: string;
  snapshotId: string;
  cleanupOnly?: boolean;
  sessionIdsToClear?: string[];
  state: CleanupRebuildState;
  startedAtIso: string;
  updatedAtIso: string;
  completedAtIso?: string;
  hostEmail: string | null;
  hostScope: 'single_connected_host';
  timezone: string;
  includeGoogleCalendar: boolean;
  obsoleteReferencesCleared: boolean;
  zoomMeetingsFoundBeforeCleanup: number;
  calendarEventsUntouchedCount: number;
  calendarUntouchedEventIds: string[];
  zoomDeletions: ZoomDeletionCheckpointItem[];
  calendarDeletions: CalendarDeletionCheckpointItem[];
  rebuilds: RebuildSessionCheckpointItem[];
  manualResolutionItems: ManualResolutionItem[];
  verification?: CleanupRebuildVerificationResult;
  report: CleanupRebuildFinalReport;
  lastError?: string;
}

export interface CleanupRebuildProgressUpdate {
  operationId: string;
  state: CleanupRebuildState;
  phaseLabel: string;
  completedSteps: number;
  totalSteps: number;
  currentItemLabel?: string;
  operation: CleanupRebuildOperationRecord;
}

// ============================================================================
// Persistence & Concurrency Lock (Secret-free, Restart-safe)
// ============================================================================

let inMemoryOperationFallback: CleanupRebuildOperationRecord | null = null;
let inMemorySnapshotsFallback: CleanupRecoverySnapshot[] = [];
let activeOperationLockId: string | null = null;

export interface CleanupStorageAdapter {
  getItem: (key: string) => Promise<any>;
  setItem: (key: string, value: any) => Promise<void>;
  removeItem?: (key: string) => Promise<void>;
}

let customStorageAdapterForTesting: CleanupStorageAdapter | null = null;

export function __setCleanupStorageAdapterForTesting(adapter: CleanupStorageAdapter | null): void {
  customStorageAdapterForTesting = adapter;
}

export function __resetCleanupRebuildMemoryForTesting(): void {
  inMemoryOperationFallback = null;
  inMemorySnapshotsFallback = [];
  activeOperationLockId = null;
}

export function __simulateCleanupProcessDeathForTesting(): void {
  inMemoryOperationFallback = null;
  inMemorySnapshotsFallback = [];
  activeOperationLockId = null;
}

export function isCleanupRebuildRunning(): boolean {
  return Boolean(activeOperationLockId);
}

function deepSanitizeForCleanupStorage<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactZoomSecrets(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((item) => deepSanitizeForCleanupStorage(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const cleaned = sanitizeZoomRecordForStorage(value as Record<string, any>);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(cleaned)) {
      out[k] = deepSanitizeForCleanupStorage(v);
    }
    return out as T;
  }
  return value;
}

async function readStorageKey(key: string): Promise<any> {
  if (customStorageAdapterForTesting) {
    return customStorageAdapterForTesting.getItem(key);
  }
  if (typeof window !== 'undefined') {
    try {
      return await storage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

async function writeStorageKey(key: string, value: any): Promise<void> {
  const sanitized = deepSanitizeForCleanupStorage(value);
  if (customStorageAdapterForTesting) {
    await customStorageAdapterForTesting.setItem(key, sanitized);
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      await storage.setItem(key, sanitized);
    } catch {
      // Ignore storage quota errors; in-memory fallback remains intact
    }
  }
}

export async function loadCleanupRebuildOperation(): Promise<CleanupRebuildOperationRecord | null> {
  const persisted = await readStorageKey(CLEANUP_REBUILD_OPERATION_STORAGE_KEY);
  if (persisted && typeof persisted === 'object' && typeof persisted.operationId === 'string') {
    inMemoryOperationFallback = deepSanitizeForCleanupStorage(persisted as CleanupRebuildOperationRecord);
    return inMemoryOperationFallback;
  }
  return inMemoryOperationFallback ? { ...inMemoryOperationFallback } : null;
}

export async function saveCleanupRebuildOperation(
  op: CleanupRebuildOperationRecord
): Promise<CleanupRebuildOperationRecord> {
  const clean = deepSanitizeForCleanupStorage({
    ...op,
    updatedAtIso: new Date().toISOString()
  });
  inMemoryOperationFallback = clean;
  await writeStorageKey(CLEANUP_REBUILD_OPERATION_STORAGE_KEY, clean);
  return clean;
}

export async function clearCleanupRebuildOperation(): Promise<void> {
  inMemoryOperationFallback = null;
  if (customStorageAdapterForTesting?.removeItem) {
    await customStorageAdapterForTesting.removeItem(CLEANUP_REBUILD_OPERATION_STORAGE_KEY);
    return;
  }
  if (customStorageAdapterForTesting) {
    await customStorageAdapterForTesting.setItem(CLEANUP_REBUILD_OPERATION_STORAGE_KEY, null);
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      await storage.removeItem(CLEANUP_REBUILD_OPERATION_STORAGE_KEY);
    } catch {}
  }
}

export async function loadCleanupRecoverySnapshots(): Promise<CleanupRecoverySnapshot[]> {
  const persisted = await readStorageKey(CLEANUP_RECOVERY_SNAPSHOTS_STORAGE_KEY);
  if (Array.isArray(persisted)) {
    inMemorySnapshotsFallback = persisted.map((s) => deepSanitizeForCleanupStorage(s));
    return inMemorySnapshotsFallback;
  }
  return [...inMemorySnapshotsFallback];
}

export async function saveCleanupRecoverySnapshot(
  snapshot: CleanupRecoverySnapshot
): Promise<CleanupRecoverySnapshot[]> {
  const clean = deepSanitizeForCleanupStorage(snapshot);
  const existing = await loadCleanupRecoverySnapshots();
  const next = [clean, ...existing.filter((s) => s.snapshotId !== clean.snapshotId)].slice(0, 15);
  inMemorySnapshotsFallback = next;
  await writeStorageKey(CLEANUP_RECOVERY_SNAPSHOTS_STORAGE_KEY, next);
  return next;
}

function sleepPacing(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildReportFromOperation(op: CleanupRebuildOperationRecord): CleanupRebuildFinalReport {
  const zoomMeetingsDeleted = op.zoomDeletions.filter(
    (z) => z.status === 'succeeded' || z.status === 'already_deleted'
  ).length;
  const zoomMeetingsSkippedOrFailed = op.zoomDeletions.filter(
    (z) => z.status === 'skipped_live' || z.status === 'failed'
  ).length;
  const calendarEventsDeleted = op.calendarDeletions.filter(
    (c) => c.status === 'succeeded' || c.status === 'already_deleted'
  ).length;
  const newGluckZoomMeetingsCreated = op.rebuilds.filter((r) => r.zoomStatus === 'succeeded').length;
  const calendarEventsRecreatedOrUpdated = op.rebuilds.filter((r) => r.calendarStatus === 'succeeded').length;

  const failedZoomDel = op.zoomDeletions.filter((z) => z.status === 'failed');
  const failedCalDel = op.calendarDeletions.filter((c) => c.status === 'failed');
  const failedZoomCreate = op.rebuilds.filter((r) => r.zoomStatus === 'failed');
  const failedCalSync = op.rebuilds.filter((r) => r.calendarStatus === 'failed');
  const skippedLive = op.zoomDeletions.filter((z) => z.status === 'skipped_live');

  const failedItemsCount =
    failedZoomDel.length + failedCalDel.length + failedZoomCreate.length + failedCalSync.length;

  const remainingProblems: string[] = [];
  for (const l of skippedLive) {
    remainingProblems.push(`Live Zoom meeting "${l.topic || l.meetingId}" (${l.meetingId}) could not be deleted while in progress.`);
  }
  for (const z of failedZoomDel) {
    remainingProblems.push(`Failed to delete Zoom meeting ${z.meetingId} (${z.topic || 'Untitled'}): ${z.lastError || 'Unknown error'}`);
  }
  for (const c of failedCalDel) {
    remainingProblems.push(`Failed to delete Calendar event "${c.summary}" (${c.eventId}): ${c.lastError || 'Unknown error'}`);
  }
  for (const r of failedZoomCreate) {
    remainingProblems.push(`Failed to recreate Zoom meeting for ${r.standardizedTitle}: ${r.zoomLastError || 'Unknown error'}`);
  }
  for (const r of failedCalSync) {
    remainingProblems.push(`Failed to sync Calendar event for ${r.standardizedTitle}: ${r.calendarLastError || 'Unknown error'}`);
  }
  if (op.verification && !op.verification.passed) {
    for (const issue of op.verification.issues) {
      if (!remainingProblems.includes(issue)) remainingProblems.push(issue);
    }
  }
  if (op.lastError && !remainingProblems.includes(op.lastError)) {
    remainingProblems.push(op.lastError);
  }

  return {
    zoomMeetingsFoundBeforeCleanup: op.zoomMeetingsFoundBeforeCleanup,
    zoomMeetingsDeleted,
    zoomMeetingsSkippedOrFailed,
    calendarEventsDeleted,
    calendarEventsUntouched: op.calendarEventsUntouchedCount,
    newGluckZoomMeetingsCreated,
    calendarEventsRecreatedOrUpdated,
    failedItemsCount,
    verificationPassed: Boolean(op.verification?.passed),
    remainingProblems
  };
}

function collectHistoricalZoomReferences(params: {
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  groups: Group[];
}): {
  historicalIds: Set<string>;
  historicalUrls: Set<string>;
  storedCalendarEventIds: Set<string>;
  idToSession: Map<string, { session?: GroupWeeklySession; group?: Group; source: 'active_session' | 'history_or_record' }>;
} {
  const historicalIds = new Set<string>();
  const historicalUrls = new Set<string>();
  const storedCalendarEventIds = new Set<string>();
  const groupById = new Map<string, Group>();
  const sessionById = new Map<string, GroupWeeklySession>();
  const idToSession = new Map<
    string,
    { session?: GroupWeeklySession; group?: Group; source: 'active_session' | 'history_or_record' }
  >();

  for (const g of params.groups || []) {
    if (!g) continue;
    groupById.set(g.id, g);
    for (const rawLink of [g.zoomLink, g.meetLink]) {
      if (!rawLink) continue;
      historicalUrls.add(rawLink);
      const idFromGroup = extractNumericZoomMeetingId(rawLink);
      if (idFromGroup) {
        historicalIds.add(idFromGroup);
        if (!idToSession.has(idFromGroup)) {
          idToSession.set(idFromGroup, { group: g, source: 'history_or_record' });
        }
      }
    }
  }

  for (const s of params.sessions || []) {
    if (!s) continue;
    sessionById.set(s.id, s);
    if (s.googleCalendarEventId) {
      storedCalendarEventIds.add(s.googleCalendarEventId.trim());
    }
    const g = groupById.get(s.groupId);
    const ids = [
      s.zoomMeetingId,
      s.zoomJoinUrl ? extractNumericZoomMeetingId(s.zoomJoinUrl) : undefined
    ].filter((v): v is string => Boolean(v));
    for (const rawId of ids) {
      const clean = rawId.replace(/[^0-9]/g, '');
      if (clean.length >= 8) {
        historicalIds.add(clean);
        idToSession.set(clean, { session: s, group: g, source: 'active_session' });
      }
    }
    if (s.zoomJoinUrl) historicalUrls.add(s.zoomJoinUrl);
  }

  for (const r of params.records || []) {
    if (!r) continue;
    const clean = String(r.zoomMeetingId || '').replace(/[^0-9]/g, '');
    if (clean.length >= 8) {
      historicalIds.add(clean);
      if (!idToSession.has(clean)) {
        idToSession.set(clean, {
          session: sessionById.get(r.sessionId),
          group: groupById.get(r.groupId),
          source: 'history_or_record'
        });
      }
    }
    if (r.joinUrl) historicalUrls.add(r.joinUrl);
  }

  for (const h of params.history || []) {
    if (!h) continue;
    for (const rawId of [h.previousZoomMeetingId, h.newZoomMeetingId]) {
      const clean = String(rawId || '').replace(/[^0-9]/g, '');
      if (clean.length >= 8) {
        historicalIds.add(clean);
        if (!idToSession.has(clean)) {
          idToSession.set(clean, {
            session: sessionById.get(h.sessionId),
            group: groupById.get(h.groupId),
            source: 'history_or_record'
          });
        }
      }
    }
    if (h.previousJoinUrl) historicalUrls.add(h.previousJoinUrl);
    if (h.newJoinUrl) historicalUrls.add(h.newJoinUrl);
  }

  return { historicalIds, historicalUrls, storedCalendarEventIds, idToSession };
}

// ============================================================================
// Step 1: Preview Cleanup (Strictly Read-Only, Zero Mutations)
// ============================================================================

export async function previewZoomCalendarCleanupRebuild(params: {
  groups: Group[];
  existingSessions: GroupWeeklySession[];
  existingRecords: ZoomMeetingRecord[];
  existingHistory: ZoomMeetingHistory[];
  timezone?: string;
  calendarAccessToken?: string | null;
  calendarId?: string;
  retryDelayMs?: number;
}): Promise<{ ok: boolean; preview?: CleanupRebuildPreview; error?: string }> {
  const uiMeta = loadZoomUiMeta();
  const tz = params.timezone || uiMeta.defaultTimezone || DEFAULT_ZOOM_TIMEZONE;

  // 1. Fetch ALL scheduled Zoom meetings across all pages + detect live meetings
  const zoomInv = await listAllZoomScheduledMeetings({
    includeLiveCheck: true,
    pageSize: 300,
    retryDelayMs: params.retryDelayMs
  });
  if (!zoomInv.ok) {
    return {
      ok: false,
      error: zoomInv.error || 'Failed to retrieve scheduled Zoom meetings for preview.'
    };
  }

  // 2. Reconcile active online groups & weekly sessions using existing standardizer
  const migrationPreview = buildZoomMigrationPreview({
    groups: params.groups,
    existingSessions: params.existingSessions,
    targetTimezone: tz,
    includePausedOrArchived: false
  });

  const { historicalIds, historicalUrls, storedCalendarEventIds, idToSession } =
    collectHistoricalZoomReferences({
      sessions: migrationPreview.reconciledSessions,
      records: params.existingRecords,
      history: [...migrationPreview.reconciledHistory, ...(params.existingHistory || [])],
      groups: params.groups
    });

  const liveIdSet = new Set(zoomInv.liveMeetingIds);

  const zoomMeetings: PreviewZoomMeetingEntry[] = zoomInv.meetings.map((m: ZoomScheduledMeetingItem) => {
    const assoc = idToSession.get(m.id);
    const isLive = Boolean(m.isLive || liveIdSet.has(m.id));
    return {
      id: m.id,
      uuid: m.uuid,
      topic: m.topic || '(Untitled Zoom meeting)',
      type: m.type,
      isRecurring: m.isRecurring,
      startTime: m.startTime,
      duration: m.duration,
      timezone: m.timezone,
      joinUrl: m.joinUrl,
      status: m.status,
      isLive,
      willDelete: !isLive,
      associatedGroupId: assoc?.group?.id || assoc?.session?.groupId,
      associatedGroupName: assoc?.group?.name || assoc?.session?.groupNameSnapshot,
      associatedSessionId: assoc?.session?.id,
      associatedSessionCode: assoc?.session?.sessionCode,
      associationSource: assoc ? assoc.source : 'unreferenced_external_or_manual'
    };
  });

  const liveMeetings = zoomMeetings.filter((m) => m.isLive);
  const deletableZoomMeetings = zoomMeetings.filter((m) => m.willDelete);

  const targetZoomMeetingIds = new Set(deletableZoomMeetings.map((m) => m.id));
  const targetZoomJoinUrls = new Set(deletableZoomMeetings.map((m) => m.joinUrl).filter(Boolean));

  const manualResolutionItems: ManualResolutionItem[] = [];
  for (const lm of liveMeetings) {
    manualResolutionItems.push({
      category: 'live_zoom_meeting',
      id: lm.id,
      title: lm.topic,
      detail: `Meeting ${lm.id} is currently live/in-progress and cannot be safely deleted until it ends.`
    });
  }
  for (const missing of migrationPreview.groupsMissingSchedule) {
    manualResolutionItems.push({
      category: 'group_missing_schedule',
      id: missing.groupId,
      title: missing.groupName,
      detail: 'Active online group has no valid weekly day/time schedule; add a schedule before rebuilding its Zoom meeting.'
    });
  }

  // 3. Inspect Google Calendar events if access token is available
  const calToken =
    params.calendarAccessToken !== undefined
      ? params.calendarAccessToken
      : getInMemoryGoogleCalendarToken();

  let calendarConnected = false;
  let calendarEventsScannedCount = 0;
  let calendarEventsToDelete: CalendarCleanupEventDecision[] = [];
  let calendarAmbiguousEvents: CalendarCleanupEventDecision[] = [];
  let calendarEventsUntouchedCount = 0;
  let calendarUntouchedEventIds: string[] = [];

  if (calToken) {
    const calList = await listPrimaryGoogleCalendarEventsForCleanup({
      accessToken: calToken,
      calendarId: params.calendarId || 'primary',
      retryDelayMs: params.retryDelayMs
    });
    if (!calList.ok) {
      return {
        ok: false,
        error: calList.error || 'Failed to inspect Google Calendar events for cleanup preview.'
      };
    }
    calendarConnected = true;
    const matchSummary = matchGoogleCalendarEventsToZoomCleanup({
      calendarEvents: calList.events,
      targetZoomMeetingIds,
      targetZoomJoinUrls,
      sessions: migrationPreview.reconciledSessions,
      historicalZoomMeetingIds: historicalIds,
      historicalZoomJoinUrls: historicalUrls,
      storedCalendarEventIds,
      liveZoomMeetingIds: liveIdSet
    });
    calendarEventsScannedCount = matchSummary.totalEventsScanned;
    calendarEventsToDelete = matchSummary.matchedToDelete;
    calendarAmbiguousEvents = matchSummary.ambiguousEvents;
    calendarEventsUntouchedCount = matchSummary.untouchedEventsCount;

    const deleteIdSet = new Set(calendarEventsToDelete.map((e) => e.eventId));
    calendarUntouchedEventIds = calList.events
      .map((e) => e.id)
      .filter((id) => !deleteIdSet.has(id));

    for (const amb of calendarAmbiguousEvents) {
      manualResolutionItems.push({
        category: 'ambiguous_calendar_event',
        id: amb.eventId,
        title: amb.summary,
        detail: amb.reason
      });
    }
  } else {
    manualResolutionItems.push({
      category: 'calendar_not_connected',
      id: 'google_calendar',
      title: 'Google Calendar not connected',
      detail:
        'Connect Google Calendar first to preview and clean linked Calendar events and recreate them after Zoom rebuild.'
    });
  }

  const hostEmail = zoomInv.hostEmail || uiMeta.hostEmail || null;
  const hostScopeDisclosure = hostEmail
    ? `Scope: Only scheduled meetings belonging to the single connected Zoom host (${hostEmail}) via /users/me/meetings will be inspected and cleaned. Meetings hosted by other Zoom users are outside this host scope.`
    : 'Scope: Only scheduled meetings belonging to the single connected Zoom host (/users/me/meetings) will be inspected and cleaned. Meetings hosted by other Zoom users are outside this host scope.';

  const activeSessionsToRebuild = migrationPreview.items.map((item) => {
    const sess = migrationPreview.reconciledSessions.find((s) => s.id === item.sessionId);
    return {
      sessionId: item.sessionId,
      sessionCode: item.sessionCode,
      groupId: item.groupId,
      groupName: item.groupName,
      weekdayName: item.weekdayName,
      startTime: item.startTime,
      durationMinutes: item.durationMinutes,
      standardizedTitle: item.standardizedTitle,
      previousZoomMeetingId: item.previousZoomMeetingId,
      previousZoomUrl: item.previousZoomUrl,
      previousGoogleCalendarEventId: sess?.googleCalendarEventId,
      planWarning40Min: item.planWarning40Min
    };
  });

  const preview: CleanupRebuildPreview = {
    generatedAtIso: new Date().toISOString(),
    hostEmail,
    hostScope: 'single_connected_host',
    hostScopeDisclosure,
    timezone: tz,
    totalScheduledZoomMeetingsFound: zoomMeetings.length,
    zoomMeetingsToDeleteCount: deletableZoomMeetings.length,
    liveMeetingsBlockedCount: liveMeetings.length,
    zoomMeetings,
    liveMeetings,
    activeOnlineGroupsCount: migrationPreview.totalOnlineGroups,
    activeGluckOnlineSessionsCount: activeSessionsToRebuild.length,
    activeSessionsToRebuild,
    groupsMissingSchedule: migrationPreview.groupsMissingSchedule,
    calendarConnected,
    calendarEventsScannedCount,
    calendarEventsToDeleteCount: calendarEventsToDelete.length,
    calendarEventsUntouchedCount,
    calendarEventsToDelete,
    calendarAmbiguousEvents,
    calendarUntouchedEventIds,
    manualResolutionItems,
    reconciledSessions: migrationPreview.reconciledSessions,
    reconciledHistory: migrationPreview.reconciledHistory,
    historicalZoomMeetingIds: Array.from(historicalIds),
    historicalZoomJoinUrls: Array.from(historicalUrls),
    storedCalendarEventIds: Array.from(storedCalendarEventIds)
  };

  return { ok: true, preview };
}

// ============================================================================
// Step 2: Execute / Resume / Retry Cleanup & Rebuild State Machine
// ============================================================================

function createRecoverySnapshotFromPreview(
  operationId: string,
  preview: CleanupRebuildPreview
): CleanupRecoverySnapshot {
  const snapshotId = `snap_${operationId}`;
  const sessions: CleanupRecoverySnapshotSessionEntry[] = preview.activeSessionsToRebuild.map((item) => {
    const full = preview.reconciledSessions.find((s) => s.id === item.sessionId);
    return {
      groupId: item.groupId,
      groupName: item.groupName,
      sessionId: item.sessionId,
      sessionCode: item.sessionCode,
      previousZoomMeetingId: full?.zoomMeetingId || item.previousZoomMeetingId,
      previousJoinUrl: full?.zoomJoinUrl || item.previousZoomUrl,
      previousZoomPasscode: full?.zoomPasscode,
      previousGoogleCalendarEventId: full?.googleCalendarEventId,
      previousGoogleCalendarIcalUid: full?.googleCalendarIcalUid,
      previousCalendarEventUid: full?.calendarEventUid,
      previousMeetingSource: full?.meetingSource
    };
  });

  return deepSanitizeForCleanupStorage({
    snapshotId,
    operationId,
    createdAtIso: new Date().toISOString(),
    hostEmail: preview.hostEmail,
    hostScope: 'single_connected_host',
    sessions,
    historicalZoomMeetingIds: preview.historicalZoomMeetingIds,
    historicalZoomJoinUrls: preview.historicalZoomJoinUrls,
    zoomMeetingsPlannedForDeletion: preview.zoomMeetings.map((m) => ({
      id: m.id,
      uuid: m.uuid,
      topic: m.topic,
      type: m.type,
      isRecurring: m.isRecurring,
      startTime: m.startTime,
      joinUrl: m.joinUrl,
      isLive: m.isLive,
      associatedGroupId: m.associatedGroupId,
      associatedGroupName: m.associatedGroupName,
      associatedSessionId: m.associatedSessionId
    })),
    calendarEventsPlannedForDeletion: preview.calendarEventsToDelete.map((e) => ({
      eventId: e.eventId,
      summary: e.summary,
      startDateTime: e.startDateTime,
      isRecurringSeries: e.isRecurringSeries,
      signals: e.signals,
      matchedZoomMeetingIds: e.matchedZoomMeetingIds,
      matchedSessionId: e.matchedSessionId
    }))
  });
}

function buildInitialOperationRecord(params: {
  operationId: string;
  snapshotId: string;
  preview: CleanupRebuildPreview;
  includeGoogleCalendar: boolean;
  cleanupOnly?: boolean;
}): CleanupRebuildOperationRecord {
  const nowIso = new Date().toISOString();
  const cleanupOnly = Boolean(params.cleanupOnly);
  const sessionIdsToClear = params.preview.activeSessionsToRebuild.map((s) => s.sessionId);
  const op: CleanupRebuildOperationRecord = {
    operationId: params.operationId,
    snapshotId: params.snapshotId,
    cleanupOnly,
    sessionIdsToClear,
    state: 'cleanup_in_progress',
    startedAtIso: nowIso,
    updatedAtIso: nowIso,
    hostEmail: params.preview.hostEmail,
    hostScope: 'single_connected_host',
    timezone: params.preview.timezone,
    includeGoogleCalendar: params.includeGoogleCalendar,
    obsoleteReferencesCleared: false,
    zoomMeetingsFoundBeforeCleanup: params.preview.totalScheduledZoomMeetingsFound,
    calendarEventsUntouchedCount: params.preview.calendarEventsUntouchedCount,
    calendarUntouchedEventIds: [...params.preview.calendarUntouchedEventIds],
    zoomDeletions: params.preview.zoomMeetings.map((m) => ({
      meetingId: m.id,
      uuid: m.uuid,
      topic: m.topic,
      type: m.type,
      isRecurring: m.isRecurring,
      startTime: m.startTime,
      joinUrl: m.joinUrl,
      isLive: m.isLive,
      status: m.isLive ? 'skipped_live' : 'pending',
      attempts: 0
    })),
    calendarDeletions: params.includeGoogleCalendar
      ? params.preview.calendarEventsToDelete.map((e) => ({
          eventId: e.eventId,
          summary: e.summary,
          startDateTime: e.startDateTime,
          isRecurringSeries: e.isRecurringSeries,
          signals: [...e.signals],
          matchedZoomMeetingIds: [...e.matchedZoomMeetingIds],
          matchedSessionId: e.matchedSessionId,
          status: 'pending',
          attempts: 0
        }))
      : [],
    rebuilds: cleanupOnly
      ? []
      : params.preview.activeSessionsToRebuild.map((s) => ({
          sessionId: s.sessionId,
          sessionCode: s.sessionCode,
          groupId: s.groupId,
          groupName: s.groupName,
          standardizedTitle: s.standardizedTitle,
          weekdayName: s.weekdayName,
          startTime: s.startTime,
          durationMinutes: s.durationMinutes,
          zoomStatus: 'pending',
          zoomAttempts: 0,
          calendarStatus: params.includeGoogleCalendar ? 'pending' : 'skipped_disconnected',
          calendarAttempts: 0
        })),
    manualResolutionItems: [...params.preview.manualResolutionItems],
    report: {
      zoomMeetingsFoundBeforeCleanup: params.preview.totalScheduledZoomMeetingsFound,
      zoomMeetingsDeleted: 0,
      zoomMeetingsSkippedOrFailed: params.preview.liveMeetingsBlockedCount,
      calendarEventsDeleted: 0,
      calendarEventsUntouched: params.preview.calendarEventsUntouchedCount,
      newGluckZoomMeetingsCreated: 0,
      calendarEventsRecreatedOrUpdated: 0,
      failedItemsCount: 0,
      verificationPassed: false,
      remainingProblems: []
    }
  };
  op.report = buildReportFromOperation(op);
  return op;
}

function computeProgressCounters(op: CleanupRebuildOperationRecord): {
  completedSteps: number;
  totalSteps: number;
} {
  const totalSteps =
    op.zoomDeletions.length +
    op.calendarDeletions.length +
    op.rebuilds.length +
    (op.includeGoogleCalendar ? op.rebuilds.length : 0) +
    1; // final verification step

  const zoomDelDone = op.zoomDeletions.filter((z) => z.status !== 'pending').length;
  const calDelDone = op.calendarDeletions.filter((c) => c.status !== 'pending').length;
  const zoomRebuildDone = op.rebuilds.filter((r) => r.zoomStatus !== 'pending').length;
  const calRebuildDone = op.includeGoogleCalendar
    ? op.rebuilds.filter((r) => r.calendarStatus !== 'pending').length
    : 0;
  const verifyDone = op.verification ? 1 : 0;

  return {
    completedSteps: zoomDelDone + calDelDone + zoomRebuildDone + calRebuildDone + verifyDone,
    totalSteps: Math.max(1, totalSteps)
  };
}

function phaseLabelForState(state: CleanupRebuildState): string {
  switch (state) {
    case 'preview_ready':
      return 'Preview ready';
    case 'cleanup_in_progress':
      return 'Preparing recovery snapshot & starting cleanup';
    case 'zoom_deletion_in_progress':
      return 'Deleting old Zoom meetings';
    case 'calendar_cleanup_in_progress':
      return 'Deleting linked Google Calendar events';
    case 'old_meetings_verified_empty':
      return 'Verified old Zoom meetings empty';
    case 'rebuilding_zoom_meetings':
      return 'Rebuilding Glück Zoom meetings';
    case 'syncing_calendar_events':
      return 'Rebuilding Google Calendar events';
    case 'completed':
      return 'Completed & verified';
    case 'completed_with_errors':
      return 'Completed with remaining issues';
    case 'paused':
      return 'Paused (resumable)';
    case 'failed':
      return 'Failed';
    default:
      return state;
  }
}

export interface ExecuteCleanupRebuildParams {
  mode: 'start' | 'resume' | 'retry_failed';
  cleanupOnly?: boolean;
  preview?: CleanupRebuildPreview;
  groups: Group[];
  existingSessions: GroupWeeklySession[];
  existingRecords: ZoomMeetingRecord[];
  existingHistory: ZoomMeetingHistory[];
  includeGoogleCalendar?: boolean;
  calendarAccessToken?: string | null;
  calendarId?: string;
  onRenewCalendarToken?: () => Promise<string | null>;
  onWorkspaceUpdate?: (snapshot: {
    sessions: GroupWeeklySession[];
    records: ZoomMeetingRecord[];
    history: ZoomMeetingHistory[];
  }) => void | Promise<void>;
  onProgress?: (progress: CleanupRebuildProgressUpdate) => void;
  shouldPause?: () => boolean;
  pacingDelayMs?: number;
  retryDelayMs?: number;
}

export interface ExecuteCleanupRebuildResult {
  ok: boolean;
  locked?: boolean;
  operation: CleanupRebuildOperationRecord;
  snapshot?: CleanupRecoverySnapshot;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
}

export async function executeZoomCalendarCleanupRebuild(
  params: ExecuteCleanupRebuildParams
): Promise<ExecuteCleanupRebuildResult> {
  if (activeOperationLockId) {
    const currentOp = (await loadCleanupRebuildOperation())!;
    return {
      ok: false,
      locked: true,
      operation: currentOp,
      sessions: params.existingSessions,
      records: params.existingRecords,
      history: params.existingHistory
    };
  }

  const pacingDelayMs = params.pacingDelayMs ?? 120;
  const retryDelayMs = params.retryDelayMs ?? 450;
  const calendarId = params.calendarId || 'primary';
  let activeCalToken: string | null =
    params.calendarAccessToken !== undefined
      ? params.calendarAccessToken
      : getInMemoryGoogleCalendarToken();

  let workingSessions = [...(params.existingSessions || [])];
  let workingRecords = [...(params.existingRecords || [])];
  let workingHistory = [...(params.existingHistory || [])];
  let operation: CleanupRebuildOperationRecord | null = null;
  let createdSnapshot: CleanupRecoverySnapshot | undefined;

  if (params.mode === 'start') {
    if (!params.preview) {
      throw new Error('Cleanup preview is required before starting cleanup.');
    }
    const cleanupOnly = Boolean(params.cleanupOnly);
    const operationId = `${cleanupOnly ? 'cleanup_only' : 'cleanup_rebuild'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const includeGoogleCalendar =
      params.includeGoogleCalendar !== undefined
        ? params.includeGoogleCalendar
        : Boolean(params.preview.calendarConnected && activeCalToken);

    workingSessions = [...params.preview.reconciledSessions];
    workingHistory = [...params.preview.reconciledHistory, ...workingHistory];

    // CRITICAL: Create & persist secret-free recovery snapshot BEFORE deleting any Zoom meeting
    createdSnapshot = createRecoverySnapshotFromPreview(operationId, params.preview);
    await saveCleanupRecoverySnapshot(createdSnapshot);

    operation = buildInitialOperationRecord({
      operationId,
      snapshotId: createdSnapshot.snapshotId,
      preview: params.preview,
      includeGoogleCalendar,
      cleanupOnly
    });
    operation = await saveCleanupRebuildOperation(operation);
  } else {
    operation = await loadCleanupRebuildOperation();
    if (!operation) {
      throw new Error('No saved Cleanup & Rebuild operation found to resume or retry.');
    }
    const snapshots = await loadCleanupRecoverySnapshots();
    createdSnapshot = snapshots.find((s) => s.snapshotId === operation!.snapshotId);

    // Ensure reconciled sessions exist for active groups and stay aligned with checkpointed sessionIds across crashes
    const tz = operation.timezone || DEFAULT_ZOOM_TIMEZONE;
    const recPreview = buildZoomMigrationPreview({
      groups: params.groups,
      existingSessions: workingSessions,
      targetTimezone: tz,
      includePausedOrArchived: false
    });
    const snapshotSessionById = new Map(
      (createdSnapshot?.sessions || []).map((entry) => [entry.sessionId, entry])
    );
    const matchedWorkingSessionIds = new Set<string>();
    workingSessions = recPreview.reconciledSessions.map((session) => {
      const exactRebuild = operation!.rebuilds.find((r) => r.sessionId === session.id);
      const fallbackRebuild =
        exactRebuild ||
        operation!.rebuilds.find(
          (r) =>
            !matchedWorkingSessionIds.has(r.sessionId) &&
            r.groupId === session.groupId &&
            (r.sessionCode === session.sessionCode ||
              (r.weekdayName === session.weekdayName && r.startTime === session.startTime))
        );
      if (!fallbackRebuild) return session;
      matchedWorkingSessionIds.add(fallbackRebuild.sessionId);
      const snapEntry = snapshotSessionById.get(fallbackRebuild.sessionId);
      return {
        ...session,
        id: fallbackRebuild.sessionId,
        calendarEventUid:
          session.calendarEventUid || snapEntry?.previousCalendarEventUid || session.calendarEventUid,
        zoomMeetingId:
          fallbackRebuild.zoomStatus === 'succeeded' && fallbackRebuild.newZoomMeetingId
            ? fallbackRebuild.newZoomMeetingId
            : session.zoomMeetingId,
        zoomJoinUrl:
          fallbackRebuild.zoomStatus === 'succeeded' && fallbackRebuild.newZoomJoinUrl
            ? fallbackRebuild.newZoomJoinUrl
            : session.zoomJoinUrl,
        googleCalendarEventId:
          fallbackRebuild.calendarStatus === 'succeeded' && fallbackRebuild.newGoogleCalendarEventId
            ? fallbackRebuild.newGoogleCalendarEventId
            : session.googleCalendarEventId
      };
    });

    if (params.mode === 'retry_failed') {
      operation = {
        ...operation,
        lastError: undefined,
        verification: undefined,
        zoomDeletions: operation.zoomDeletions.map((z) =>
          z.status === 'failed' || z.status === 'skipped_live'
            ? { ...z, status: 'pending', lastError: undefined }
            : z
        ),
        calendarDeletions: operation.calendarDeletions.map((c) =>
          c.status === 'failed' ? { ...c, status: 'pending', lastError: undefined } : c
        ),
        rebuilds: operation.rebuilds.map((r) => ({
          ...r,
          // NEVER reset already succeeded Zoom meetings so retries never create duplicates!
          zoomStatus: r.zoomStatus === 'failed' ? 'pending' : r.zoomStatus,
          zoomLastError: r.zoomStatus === 'failed' ? undefined : r.zoomLastError,
          calendarStatus:
            r.calendarStatus === 'failed' ||
            (r.calendarStatus === 'skipped_zoom_failed' && r.zoomStatus !== 'succeeded') ||
            (r.calendarStatus === 'skipped_disconnected' && Boolean(activeCalToken) && operation!.includeGoogleCalendar)
              ? 'pending'
              : r.calendarStatus,
          calendarLastError: r.calendarStatus === 'failed' ? undefined : r.calendarLastError
        }))
      };
    } else {
      operation = {
        ...operation,
        lastError: undefined
      };
    }
    operation = await saveCleanupRebuildOperation(operation);
  }

  activeOperationLockId = operation.operationId;

  const emitProgress = async (currentItemLabel?: string) => {
    if (!operation) return;
    operation.report = buildReportFromOperation(operation);
    operation.updatedAtIso = new Date().toISOString();
    const persistedSnapshot = await saveCleanupRebuildOperation(operation);
    const { completedSteps, totalSteps } = computeProgressCounters(persistedSnapshot);
    params.onProgress?.({
      operationId: persistedSnapshot.operationId,
      state: persistedSnapshot.state,
      phaseLabel: phaseLabelForState(persistedSnapshot.state),
      completedSteps,
      totalSteps,
      currentItemLabel,
      operation: persistedSnapshot
    });
  };

  const commitWorkspace = async () => {
    await params.onWorkspaceUpdate?.({
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory
    });
  };

  const pauseAndReturn = async (): Promise<ExecuteCleanupRebuildResult> => {
    operation!.state = 'paused';
    operation!.report = buildReportFromOperation(operation!);
    operation = await saveCleanupRebuildOperation(operation!);
    await emitProgress('Paused safely');
    return {
      ok: false,
      operation,
      snapshot: createdSnapshot,
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory
    };
  };

  try {
    if (params.mode === 'start') {
      await commitWorkspace();
    }
    await emitProgress('Recovery snapshot saved');

    // ========================================================================
    // PHASE A: Zoom Deletion (All Old Non-Live Meetings — Entire Series)
    // ========================================================================
    if (!operation.obsoleteReferencesCleared) {
      // Refresh live status on retry so meetings that were live earlier are re-checked safely
      let liveIdsNow = new Set<string>(
        operation.zoomDeletions.filter((z) => z.isLive && z.status === 'skipped_live').map((z) => z.meetingId)
      );
      if (params.mode === 'retry_failed' && operation.zoomDeletions.some((z) => z.isLive)) {
        const liveCheck = await listAllZoomScheduledMeetings({
          includeLiveCheck: true,
          retryDelayMs
        });
        if (liveCheck.ok) {
          liveIdsNow = new Set(liveCheck.liveMeetingIds);
          operation.zoomDeletions = operation.zoomDeletions.map((z) => {
            const stillLive = liveIdsNow.has(z.meetingId);
            return {
              ...z,
              isLive: stillLive,
              status: stillLive ? 'skipped_live' : z.status === 'skipped_live' ? 'pending' : z.status
            };
          });
        }
      }

      const hasPendingZoomDeletes = operation.zoomDeletions.some((z) => z.status === 'pending');
      if (hasPendingZoomDeletes) {
        operation.state = 'zoom_deletion_in_progress';
        await emitProgress('Starting Zoom cleanup');

        for (let i = 0; i < operation.zoomDeletions.length; i++) {
          const item = operation.zoomDeletions[i];
          if (item.status !== 'pending') continue;

          if (params.shouldPause?.()) {
            return await pauseAndReturn();
          }

          if (item.isLive || liveIdsNow.has(item.meetingId)) {
            item.isLive = true;
            item.status = 'skipped_live';
            item.lastError = 'Meeting is currently live and cannot be safely deleted.';
            await emitProgress(`Skipped live meeting: ${item.topic}`);
            continue;
          }

          item.attempts += 1;
          await emitProgress(`Deleting Zoom meeting: ${item.topic} (${item.meetingId})`);

          const delRes = await deleteZoomMeetingSeriesRemote(item.meetingId, {
            maxRetries: 3,
            retryDelayMs
          });

          if (delRes.ok && delRes.deleted) {
            item.status = delRes.alreadyDeleted ? 'already_deleted' : 'succeeded';
            item.lastError = undefined;
            item.completedAtIso = new Date().toISOString();
          } else {
            item.status = 'failed';
            item.lastError = delRes.error || `Failed to delete Zoom meeting ${item.meetingId}`;
          }

          await emitProgress(`Zoom ${item.meetingId}: ${item.status}`);

          if (delRes.authError || delRes.permissionError) {
            operation.lastError = delRes.error;
            break;
          }

          if (pacingDelayMs > 0) await sleepPacing(pacingDelayMs);
        }
      }
    }

    // ========================================================================
    // PHASE B: Google Calendar Cleanup (Confidently Matched Events Only)
    // Runs on initial execution AND on retry_failed even if Zoom obsolete refs were already cleared
    // ========================================================================
    if (operation.includeGoogleCalendar && operation.calendarDeletions.some((c) => c.status === 'pending')) {
      operation.state = 'calendar_cleanup_in_progress';
      await emitProgress('Cleaning linked Google Calendar events');

      if (!activeCalToken && params.onRenewCalendarToken) {
        activeCalToken = await params.onRenewCalendarToken();
      }

      if (!activeCalToken) {
        for (const cItem of operation.calendarDeletions) {
          if (cItem.status === 'pending') {
            cItem.status = 'failed';
            cItem.lastError = 'Google Calendar authorization is missing or expired. Reconnect Google Calendar and retry.';
          }
        }
        operation.lastError = 'Google Calendar token unavailable during Calendar cleanup.';
        await emitProgress('Calendar cleanup blocked: not connected');
      } else {
        for (let i = 0; i < operation.calendarDeletions.length; i++) {
          const cItem = operation.calendarDeletions[i];
          if (cItem.status !== 'pending') continue;

          if (params.shouldPause?.()) {
            return await pauseAndReturn();
          }

          cItem.attempts += 1;
          await emitProgress(`Deleting Calendar event: ${cItem.summary}`);

          const delCalRes = await deleteGoogleCalendarEventForCleanup({
            eventId: cItem.eventId,
            accessToken: activeCalToken,
            calendarId,
            maxRetries: 3,
            retryDelayMs,
            onAuthExpiredRenew: async () => {
              if (!params.onRenewCalendarToken) return null;
              const fresh = await params.onRenewCalendarToken();
              if (fresh) activeCalToken = fresh;
              return fresh;
            }
          });

          if (delCalRes.ok && delCalRes.deleted) {
            cItem.status = delCalRes.alreadyDeleted ? 'already_deleted' : 'succeeded';
            cItem.lastError = undefined;
            cItem.completedAtIso = new Date().toISOString();
          } else {
            cItem.status = 'failed';
            cItem.lastError = delCalRes.error || `Failed to delete Calendar event ${cItem.eventId}`;
          }

          await emitProgress(`Calendar event ${cItem.eventId}: ${cItem.status}`);

          if (delCalRes.authExpired || delCalRes.permissionDenied) {
            operation.lastError = delCalRes.error;
            break;
          }

          if (pacingDelayMs > 0) await sleepPacing(pacingDelayMs);
        }
      }
    }

    if (!operation.obsoleteReferencesCleared) {
      // ======================================================================
      // PHASE C: Verify Old Zoom Meetings Empty Before Clearing Active Refs
      // ======================================================================
      if (params.shouldPause?.()) {
        return await pauseAndReturn();
      }

      const postCleanupZoomInv = await listAllZoomScheduledMeetings({
        includeLiveCheck: true,
        retryDelayMs
      });

      if (!postCleanupZoomInv.ok) {
        operation.state = 'failed';
        operation.lastError =
          postCleanupZoomInv.error || 'Failed to verify scheduled Zoom inventory after deletion.';
        operation.report = buildReportFromOperation(operation);
        operation = await saveCleanupRebuildOperation(operation);
        await emitProgress('Verification failed');
        return {
          ok: false,
          operation,
          snapshot: createdSnapshot,
          sessions: workingSessions,
          records: workingRecords,
          history: workingHistory
        };
      }

      const newlyCreatedIdsSoFar = new Set(
        operation.rebuilds
          .filter((r) => r.zoomStatus === 'succeeded' && r.newZoomMeetingId)
          .map((r) => r.newZoomMeetingId!)
      );

      let remainingOldMeetings = postCleanupZoomInv.meetings.filter((m) => !newlyCreatedIdsSoFar.has(m.id));

      // One extra cleanup pass for any non-live stragglers (e.g. pagination shift during deletion)
      const stragglersToRetry = remainingOldMeetings.filter(
        (m) =>
          !m.isLive &&
          !operation!.zoomDeletions.some((z) => z.meetingId === m.id && z.status === 'failed')
      );

      if (stragglersToRetry.length > 0) {
        operation.state = 'zoom_deletion_in_progress';
        for (const straggler of stragglersToRetry) {
          if (params.shouldPause?.()) {
            return await pauseAndReturn();
          }
          const existingEntry = operation.zoomDeletions.find((z) => z.meetingId === straggler.id);
          const entry: ZoomDeletionCheckpointItem = existingEntry || {
            meetingId: straggler.id,
            uuid: straggler.uuid,
            topic: straggler.topic || '(Untitled Zoom meeting)',
            type: straggler.type,
            isRecurring: straggler.isRecurring,
            startTime: straggler.startTime,
            joinUrl: straggler.joinUrl,
            isLive: Boolean(straggler.isLive),
            status: 'pending',
            attempts: 0
          };
          if (!existingEntry) {
            operation.zoomDeletions.push(entry);
          }
          entry.attempts += 1;
          const delStraggler = await deleteZoomMeetingSeriesRemote(straggler.id, {
            maxRetries: 2,
            retryDelayMs
          });
          if (delStraggler.ok && delStraggler.deleted) {
            entry.status = delStraggler.alreadyDeleted ? 'already_deleted' : 'succeeded';
            entry.lastError = undefined;
            entry.completedAtIso = new Date().toISOString();
          } else {
            entry.status = 'failed';
            entry.lastError = delStraggler.error || `Failed to delete remaining Zoom meeting ${straggler.id}`;
          }
          await emitProgress(`Cleaned straggler Zoom meeting ${straggler.id}`);
        }

        const secondInv = await listAllZoomScheduledMeetings({
          includeLiveCheck: true,
          retryDelayMs
        });
        if (secondInv.ok) {
          remainingOldMeetings = secondInv.meetings.filter((m) => !newlyCreatedIdsSoFar.has(m.id));
        }
      }

      const anyFailedZoomDel = operation.zoomDeletions.some((z) => z.status === 'failed');
      const anyLiveRemaining = remainingOldMeetings.some((m) => m.isLive);

      if (remainingOldMeetings.length > 0 || anyFailedZoomDel) {
        const remainingIds = remainingOldMeetings.map((m) => m.id);
        const issues: string[] = [];
        if (anyLiveRemaining) {
          issues.push(
            `${remainingOldMeetings.filter((m) => m.isLive).length} live Zoom meeting(s) are currently active and could not be deleted. End live meetings and retry.`
          );
        }
        if (remainingOldMeetings.length > 0) {
          issues.push(
            `${remainingOldMeetings.length} old scheduled Zoom meeting(s) still remain in the account (${remainingIds.join(', ')}). Cleanup cannot be marked complete until all old meetings are deleted.`
          );
        }
        if (anyFailedZoomDel) {
          issues.push('One or more Zoom meeting deletions failed. Resolve the error and use Retry Failed Operations.');
        }

        operation.state = 'completed_with_errors';
        operation.verification = {
          checkedAtIso: new Date().toISOString(),
          passed: false,
          zeroOldZoomMeetingsRemain: false,
          allRemainingMeetingsCreatedByGluck: false,
          everyActiveOnlineSessionHasOneMeeting: false,
          noDuplicateMeetingIdsOrUrls: true,
          allNewLinksSavedInGluck: false,
          expectedCalendarEventsExistWithExactNewZoomUrl: false,
          zeroUnrelatedCalendarEventsDeleted: true,
          zeroOldLinkedCalendarEventsRemain: operation.calendarDeletions.every(
            (c) => c.status === 'succeeded' || c.status === 'already_deleted'
          ),
          remainingZoomMeetingsCount: postCleanupZoomInv.meetings.length,
          remainingOldZoomMeetingIds: remainingIds,
          remainingOldLinkedCalendarEventIds: operation.calendarDeletions
            .filter((c) => c.status === 'failed' || c.status === 'pending')
            .map((c) => c.eventId),
          missingCalendarSessionIds: operation.cleanupOnly ? [] : operation.rebuilds.map((r) => r.sessionId),
          unrelatedDeletedCalendarEventIds: [],
          issues
        };
        operation.report = buildReportFromOperation(operation);
        operation = await saveCleanupRebuildOperation(operation);
        await emitProgress('Cleanup incomplete: old meetings still remain');
        return {
          ok: false,
          operation,
          snapshot: createdSnapshot,
          sessions: workingSessions,
          records: workingRecords,
          history: workingHistory
        };
      }

      // Old scheduled Zoom meetings are VERIFIED EMPTY -> Archive & clear obsolete active references now!
      const nowMs = Date.now();
      const targetSessionIds = new Set(
        operation.sessionIdsToClear && operation.sessionIdsToClear.length > 0
          ? operation.sessionIdsToClear
          : operation.rebuilds.map((r) => r.sessionId)
      );

      for (const s of workingSessions) {
        if (!targetSessionIds.has(s.id)) continue;
        if (s.zoomMeetingId || s.zoomJoinUrl) {
          workingHistory = appendZoomHistoryEntry(workingHistory, {
            session: s,
            action: 'cleanup_archived',
            previousZoomMeetingId: s.zoomMeetingId,
            previousJoinUrl: s.zoomJoinUrl,
            previousTopic: s.standardizedTitle,
            reason: operation.cleanupOnly
              ? `Archived before Clean Only (${operation.operationId})`
              : `Archived before Clean & Rebuild (${operation.operationId})`,
            nowMs
          });
        }
      }

      workingRecords = workingRecords.map((r) =>
        targetSessionIds.has(r.sessionId) && r.status === 'active'
          ? { ...r, status: 'deleted' as const, updatedAt: nowMs }
          : r
      );

      // Clear ONLY obsolete active meeting & calendar links — keep calendarEventUid, schedule, and all Glück business data intact!
      workingSessions = workingSessions.map((s) => {
        if (!targetSessionIds.has(s.id)) return s;
        return {
          ...s,
          zoomMeetingId: undefined,
          zoomJoinUrl: undefined,
          zoomPasscode: undefined,
          googleCalendarEventId: undefined,
          googleCalendarIcalUid: undefined,
          calendarSyncStatus: 'not_synced',
          calendarSyncError: undefined,
          syncState: 'pending',
          lastError: undefined,
          updatedAt: nowMs
        };
      });

      operation.obsoleteReferencesCleared = true;
      operation.state = 'old_meetings_verified_empty';
      await commitWorkspace();
      await emitProgress('Verified 0 old Zoom meetings remain; obsolete references cleared');
    }

    // ========================================================================
    // PHASE D: Rebuild New Glück-Managed Zoom Meetings (Skipped in Clean Only mode)
    // ========================================================================
    if (!operation.cleanupOnly && operation.rebuilds.some((r) => r.zoomStatus === 'pending')) {
      operation.state = 'rebuilding_zoom_meetings';
      await emitProgress('Rebuilding standardized Zoom meetings');

      for (let i = 0; i < operation.rebuilds.length; i++) {
        const rItem = operation.rebuilds[i];
        if (rItem.zoomStatus !== 'pending') continue;

        if (params.shouldPause?.()) {
          return await pauseAndReturn();
        }

        const currentSession = workingSessions.find((s) => s.id === rItem.sessionId);
        if (!currentSession) {
          rItem.zoomStatus = 'failed';
          rItem.zoomLastError = `Weekly session ${rItem.sessionId} not found in Glück store.`;
          rItem.calendarStatus = 'skipped_zoom_failed';
          await emitProgress(`Missing session ${rItem.sessionId}`);
          continue;
        }

        // Extra idempotency guard: if session already received a newly created meeting in this op, never duplicate
        if (rItem.newZoomMeetingId && rItem.newZoomJoinUrl) {
          rItem.zoomStatus = 'succeeded';
          continue;
        }

        rItem.zoomAttempts += 1;
        await emitProgress(`Creating Zoom meeting: ${rItem.standardizedTitle}`);

        const created = await createOrReplaceZoomMeetingForSession({
          session: currentSession,
          sessions: workingSessions,
          records: workingRecords,
          history: workingHistory,
          timezone: operation.timezone,
          actionType: 'cleanup_rebuilt',
          reason: `Rebuilt during Clean & Rebuild (${operation.operationId})`,
          deletePreviousRemote: false
        });

        workingSessions = created.sessions;
        workingRecords = created.records;
        workingHistory = created.history;

        if (created.ok && created.updatedSession?.zoomMeetingId && created.updatedSession?.zoomJoinUrl) {
          rItem.zoomStatus = 'succeeded';
          rItem.newZoomMeetingId = created.updatedSession.zoomMeetingId;
          rItem.newZoomJoinUrl = created.updatedSession.zoomJoinUrl;
          rItem.zoomLastError = undefined;
          if (operation.includeGoogleCalendar && rItem.calendarStatus === 'skipped_zoom_failed') {
            rItem.calendarStatus = 'pending';
          }
        } else {
          rItem.zoomStatus = 'failed';
          rItem.zoomLastError = created.error || 'Failed to create standardized Zoom meeting.';
          // CRITICAL: If Zoom creation fails, NEVER create a Calendar event with an obsolete/invalid URL
          rItem.calendarStatus = 'skipped_zoom_failed';
        }

        await commitWorkspace();
        await emitProgress(`Rebuilt Zoom for ${rItem.standardizedTitle}: ${rItem.zoomStatus}`);

        if (created.rateLimited) {
          operation.lastError = created.error || 'Zoom rate limit reached during rebuild. Resume or retry shortly.';
          break;
        }

        if (pacingDelayMs > 0) await sleepPacing(pacingDelayMs);
      }
    }

    // ========================================================================
    // PHASE E: Sync Google Calendar Events for Rebuilt Sessions Only (Skipped in Clean Only mode)
    // ========================================================================
    if (!operation.cleanupOnly && operation.includeGoogleCalendar) {
      const pendingCalRebuilds = operation.rebuilds.filter(
        (r) => r.zoomStatus === 'succeeded' && r.calendarStatus === 'pending'
      );

      if (pendingCalRebuilds.length > 0) {
        operation.state = 'syncing_calendar_events';
        await emitProgress('Synchronizing rebuilt Google Calendar events');

        if (!activeCalToken && params.onRenewCalendarToken) {
          activeCalToken = await params.onRenewCalendarToken();
        }

        if (!activeCalToken) {
          for (const rItem of pendingCalRebuilds) {
            rItem.calendarStatus = 'failed';
            rItem.calendarLastError =
              'Google Calendar authorization is missing or expired. Reconnect Google Calendar and click Retry Failed Operations (new Zoom meetings are kept safely).';
          }
          operation.lastError = 'Google Calendar authorization required to complete Calendar sync.';
          await emitProgress('Calendar sync requires reconnection');
        } else {
          for (const rItem of pendingCalRebuilds) {
            if (params.shouldPause?.()) {
              return await pauseAndReturn();
            }

            // Double-guard: never sync Calendar without a newly created Zoom URL
            if (!rItem.newZoomMeetingId || !rItem.newZoomJoinUrl) {
              rItem.calendarStatus = 'skipped_zoom_failed';
              continue;
            }

            rItem.calendarAttempts += 1;
            await emitProgress(`Syncing Calendar event: ${rItem.standardizedTitle}`);

            let calRes = await syncSessionsToGoogleCalendar({
              allSessions: workingSessions,
              targetSessionIds: new Set([rItem.sessionId]),
              accessToken: activeCalToken,
              calendarId,
              forceUpdateSynced: true
            });

            // Handle 401 token expiry via existing renewal hook once
            if (!calRes.success && calRes.authExpired && params.onRenewCalendarToken) {
              const freshToken = await params.onRenewCalendarToken();
              if (freshToken) {
                activeCalToken = freshToken;
                calRes = await syncSessionsToGoogleCalendar({
                  allSessions: workingSessions,
                  targetSessionIds: new Set([rItem.sessionId]),
                  accessToken: activeCalToken,
                  calendarId,
                  forceUpdateSynced: true
                });
              }
            }

            workingSessions = calRes.sessions;
            const syncedSession = workingSessions.find((s) => s.id === rItem.sessionId);

            if (calRes.success && syncedSession?.googleCalendarEventId) {
              rItem.calendarStatus = 'succeeded';
              rItem.newGoogleCalendarEventId = syncedSession.googleCalendarEventId;
              rItem.calendarLastError = undefined;
            } else {
              // Keep the newly created Zoom meeting intact; mark ONLY Calendar as failed
              rItem.calendarStatus = 'failed';
              rItem.calendarLastError =
                calRes.errors[0]?.error || 'Google Calendar event sync failed.';
            }

            await commitWorkspace();
            await emitProgress(`Calendar sync for ${rItem.standardizedTitle}: ${rItem.calendarStatus}`);

            if (calRes.authExpired || calRes.scopeInsufficient) {
              operation.lastError =
                calRes.errors[0]?.error || 'Google Calendar authorization/permission failed during sync.';
              break;
            }

            if (pacingDelayMs > 0) await sleepPacing(pacingDelayMs);
          }
        }
      }
    }

    // ========================================================================
    // PHASE F: Mandatory Final Verification Pass
    // ========================================================================
    await emitProgress('Running final Zoom & Google Calendar verification');
    const verification = await verifyCleanupAndRebuildOutcome({
      operation,
      sessions: workingSessions,
      calendarAccessToken: activeCalToken,
      calendarId,
      retryDelayMs
    });

    operation.verification = verification;
    operation.report = buildReportFromOperation(operation);

    const anyFailedItem = operation.report.failedItemsCount > 0 || operation.report.zoomMeetingsSkippedOrFailed > 0;
    if (verification.passed && !anyFailedItem) {
      operation.state = 'completed';
      operation.completedAtIso = new Date().toISOString();
      operation.lastError = undefined;
      saveZoomUiMeta({ lastMigrationAt: operation.completedAtIso, lastError: null });
    } else {
      operation.state = 'completed_with_errors';
      operation.completedAtIso = new Date().toISOString();
    }

    operation = await saveCleanupRebuildOperation(operation);
    await emitProgress(verification.passed ? 'Completed & verified' : 'Completed with errors');

    return {
      ok: operation.state === 'completed',
      operation,
      snapshot: createdSnapshot,
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory
    };
  } catch (err: any) {
    const safeMsg = redactZoomSecrets(err?.message || 'Unexpected error during Clean & Rebuild.');
    if (operation) {
      operation.state = 'failed';
      operation.lastError = safeMsg;
      operation.report = buildReportFromOperation(operation);
      operation = await saveCleanupRebuildOperation(operation);
    }
    return {
      ok: false,
      operation: operation!,
      snapshot: createdSnapshot,
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory
    };
  } finally {
    activeOperationLockId = null;
  }
}

// ============================================================================
// Step 3: Independent Final Verification Pass
// ============================================================================

async function verifyCleanupAndRebuildOutcome(params: {
  operation: CleanupRebuildOperationRecord;
  sessions: GroupWeeklySession[];
  calendarAccessToken: string | null;
  calendarId: string;
  retryDelayMs?: number;
}): Promise<CleanupRebuildVerificationResult> {
  const issues: string[] = [];
  const { operation, sessions } = params;

  const expectedCreatedIds = new Set(
    operation.rebuilds
      .filter((r) => r.zoomStatus === 'succeeded' && r.newZoomMeetingId)
      .map((r) => r.newZoomMeetingId!)
  );

  // 1. Re-fetch complete scheduled Zoom inventory
  const zoomInv = await listAllZoomScheduledMeetings({
    includeLiveCheck: true,
    retryDelayMs: params.retryDelayMs
  });

  let remainingOldZoomMeetingIds: string[] = [];
  let remainingZoomMeetingsCount = 0;
  let zeroOldZoomMeetingsRemain = false;
  let allRemainingMeetingsCreatedByGluck = false;
  let everyActiveOnlineSessionHasOneMeeting = false;

  if (!zoomInv.ok) {
    issues.push(`Final Zoom inventory verification failed: ${zoomInv.error || 'Unknown Zoom API error'}`);
  } else {
    remainingZoomMeetingsCount = zoomInv.meetings.length;
    const remoteZoomIdSet = new Set(zoomInv.meetings.map((m) => m.id));
    remainingOldZoomMeetingIds = zoomInv.meetings
      .map((m) => m.id)
      .filter((id) => !expectedCreatedIds.has(id));

    zeroOldZoomMeetingsRemain = remainingOldZoomMeetingIds.length === 0;
    allRemainingMeetingsCreatedByGluck = zeroOldZoomMeetingsRemain;

    if (!zeroOldZoomMeetingsRemain) {
      issues.push(
        `Final verification found ${remainingOldZoomMeetingIds.length} unexpected/old Zoom meeting(s) still present (${remainingOldZoomMeetingIds.join(', ')}).`
      );
    }

    if (operation.cleanupOnly) {
      everyActiveOnlineSessionHasOneMeeting = true;
    } else {
      const missingSessionsInZoom = operation.rebuilds.filter(
        (r) => r.zoomStatus !== 'succeeded' || !r.newZoomMeetingId || !remoteZoomIdSet.has(r.newZoomMeetingId)
      );
      everyActiveOnlineSessionHasOneMeeting = missingSessionsInZoom.length === 0;
      if (!everyActiveOnlineSessionHasOneMeeting) {
        issues.push(
          `${missingSessionsInZoom.length} active online session(s) do not have a verified new Zoom meeting in Zoom.`
        );
      }
    }
  }

  // 2. Verify no duplicate meeting IDs or join URLs & all saved in Glück
  const seenZoomIds = new Set<string>();
  const seenJoinUrls = new Set<string>();
  let duplicateFound = false;
  let allNewLinksSavedInGluck = true;

  if (!operation.cleanupOnly) {
    for (const r of operation.rebuilds) {
      const saved = sessions.find((s) => s.id === r.sessionId);
      if (
        r.zoomStatus !== 'succeeded' ||
        !r.newZoomMeetingId ||
        !r.newZoomJoinUrl ||
        !saved ||
        saved.zoomMeetingId !== r.newZoomMeetingId ||
        saved.zoomJoinUrl !== r.newZoomJoinUrl ||
        saved.meetingSource !== 'zoom_api' ||
        saved.syncState !== 'synced'
      ) {
        allNewLinksSavedInGluck = false;
      }
      if (r.newZoomMeetingId) {
        if (seenZoomIds.has(r.newZoomMeetingId)) duplicateFound = true;
        seenZoomIds.add(r.newZoomMeetingId);
      }
      if (r.newZoomJoinUrl) {
        const normUrl = r.newZoomJoinUrl.trim().toLowerCase();
        if (seenJoinUrls.has(normUrl)) duplicateFound = true;
        seenJoinUrls.add(normUrl);
      }
    }
  }

  const noDuplicateMeetingIdsOrUrls = !duplicateFound;
  if (!noDuplicateMeetingIdsOrUrls) {
    issues.push('Duplicate Zoom meeting IDs or join URLs were detected across rebuilt sessions.');
  }
  if (!allNewLinksSavedInGluck) {
    issues.push('Not all newly created Zoom links were saved cleanly to Glück weekly sessions.');
  }

  // 3. Re-fetch Google Calendar inventory & verify Calendar invariants
  let expectedCalendarEventsExistWithExactNewZoomUrl =
    !operation.includeGoogleCalendar || Boolean(operation.cleanupOnly);
  let zeroUnrelatedCalendarEventsDeleted = true;
  let zeroOldLinkedCalendarEventsRemain = !operation.includeGoogleCalendar;
  const missingCalendarSessionIds: string[] = [];
  const unrelatedDeletedCalendarEventIds: string[] = [];
  const remainingOldLinkedCalendarEventIds: string[] = [];

  if (operation.includeGoogleCalendar) {
    if (!params.calendarAccessToken) {
      expectedCalendarEventsExistWithExactNewZoomUrl = Boolean(operation.cleanupOnly);
      zeroOldLinkedCalendarEventsRemain = false;
      issues.push('Google Calendar access token unavailable for final Calendar verification.');
    } else {
      const calInv = await listPrimaryGoogleCalendarEventsForCleanup({
        accessToken: params.calendarAccessToken,
        calendarId: params.calendarId,
        retryDelayMs: params.retryDelayMs
      });

      if (!calInv.ok) {
        expectedCalendarEventsExistWithExactNewZoomUrl = Boolean(operation.cleanupOnly);
        zeroOldLinkedCalendarEventsRemain = false;
        issues.push(`Final Google Calendar verification failed: ${calInv.error || 'Unknown Calendar API error'}`);
      } else {
        const calById = new Map<string, GoogleCalendarCleanupEvent>();
        for (const evt of calInv.events) {
          calById.set(evt.id, evt);
        }

        // Check every rebuilt session has its expected Calendar event containing the exact new Zoom URL
        if (!operation.cleanupOnly) {
          for (const r of operation.rebuilds) {
            const saved = sessions.find((s) => s.id === r.sessionId);
            const expectedEventId =
              r.newGoogleCalendarEventId ||
              saved?.googleCalendarEventId ||
              deriveDeterministicGoogleEventId(r.sessionId);
            const evt = calById.get(expectedEventId);
            const newUrl = r.newZoomJoinUrl || '';
            const containsNewUrl = Boolean(
              evt &&
                newUrl &&
                ((evt.location && evt.location.includes(newUrl)) ||
                  (evt.description && evt.description.includes(newUrl)))
            );
            if (r.calendarStatus !== 'succeeded' || !evt || !containsNewUrl) {
              missingCalendarSessionIds.push(r.sessionId);
            }
          }
          expectedCalendarEventsExistWithExactNewZoomUrl = missingCalendarSessionIds.length === 0;
          if (!expectedCalendarEventsExistWithExactNewZoomUrl) {
            issues.push(
              `${missingCalendarSessionIds.length} active online session(s) are missing a verified Google Calendar event with the exact new Zoom URL.`
            );
          }
        }

        // Check zero unrelated Calendar events were deleted
        for (const untouchedId of operation.calendarUntouchedEventIds || []) {
          if (!calById.has(untouchedId)) {
            unrelatedDeletedCalendarEventIds.push(untouchedId);
          }
        }
        zeroUnrelatedCalendarEventsDeleted = unrelatedDeletedCalendarEventIds.length === 0;
        if (!zeroUnrelatedCalendarEventsDeleted) {
          issues.push(
            `${unrelatedDeletedCalendarEventIds.length} previously untouched Google Calendar event(s) are missing after cleanup.`
          );
        }

        // Check zero old linked Calendar events remain referencing deleted old Zoom IDs
        const newEventIdSet = new Set(
          operation.rebuilds
            .filter((r) => r.calendarStatus === 'succeeded')
            .map((r) => r.newGoogleCalendarEventId || deriveDeterministicGoogleEventId(r.sessionId))
        );
        const deletedOldZoomIdSet = new Set(operation.zoomDeletions.map((z) => z.meetingId));

        for (const oldCalDel of operation.calendarDeletions) {
          const stillPresent = calById.get(oldCalDel.eventId);
          if (!stillPresent) continue;
          // If the same deterministic event ID was freshly recreated with the NEW Zoom URL, confirm it does NOT still hold an old Zoom ID
          if (newEventIdSet.has(oldCalDel.eventId)) {
            const holdsOldZoomId = stillPresent.extractedZoomMeetingIds.some(
              (id) => deletedOldZoomIdSet.has(id) && !expectedCreatedIds.has(id)
            );
            if (holdsOldZoomId) {
              remainingOldLinkedCalendarEventIds.push(oldCalDel.eventId);
            }
          } else {
            remainingOldLinkedCalendarEventIds.push(oldCalDel.eventId);
          }
        }
        zeroOldLinkedCalendarEventsRemain = remainingOldLinkedCalendarEventIds.length === 0;
        if (!zeroOldLinkedCalendarEventsRemain) {
          issues.push(
            `${remainingOldLinkedCalendarEventIds.length} old linked Google Calendar event(s) still remain.`
          );
        }
      }
    }
  }

  const passed =
    zeroOldZoomMeetingsRemain &&
    allRemainingMeetingsCreatedByGluck &&
    everyActiveOnlineSessionHasOneMeeting &&
    noDuplicateMeetingIdsOrUrls &&
    allNewLinksSavedInGluck &&
    expectedCalendarEventsExistWithExactNewZoomUrl &&
    zeroUnrelatedCalendarEventsDeleted &&
    zeroOldLinkedCalendarEventsRemain &&
    issues.length === 0;

  return {
    checkedAtIso: new Date().toISOString(),
    passed,
    zeroOldZoomMeetingsRemain,
    allRemainingMeetingsCreatedByGluck,
    everyActiveOnlineSessionHasOneMeeting,
    noDuplicateMeetingIdsOrUrls,
    allNewLinksSavedInGluck,
    expectedCalendarEventsExistWithExactNewZoomUrl,
    zeroUnrelatedCalendarEventsDeleted,
    zeroOldLinkedCalendarEventsRemain,
    remainingZoomMeetingsCount,
    remainingOldZoomMeetingIds,
    remainingOldLinkedCalendarEventIds,
    missingCalendarSessionIds,
    unrelatedDeletedCalendarEventIds,
    issues
  };
}
