import type { Group, GroupWeeklySession, Lesson } from '../types';
import { normalize24HourTime, normalizeWeekdayIndex, parseIsoDateWeekday, resolveActiveWeeklySessionForLesson } from '../services/zoomSessionStandardizer';

export function shouldShowZoomSyncWarning(params: {
  isOnline: boolean;
  resolvedZoomLink?: string | null;
}): boolean {
  return Boolean(params.isOnline && !String(params.resolvedZoomLink || '').trim());
}

export type ZoomReminderIdentityReason = 'LESSON_GROUP_ID_MATCHED' | 'STALE_LESSON_GROUP_ID_USED_KNOWN_PROP_GROUP' | 'GROUP_PROP_MATCHED' | 'NO_TRUSTED_GROUP_OBJECT';

export function resolveReminderGroupIdentity(params: {
  lessonGroupId?: string | null;
  suppliedGroup?: Group | null;
  groups: Group[];
}): { group: Group | null; resolverGroupId?: string; identityReasonCode: ZoomReminderIdentityReason } {
  const lessonGroupId = String(params.lessonGroupId || '').trim();
  const suppliedGroupId = String(params.suppliedGroup?.id || '').trim();
  if (lessonGroupId) {
    const exactGroup = (params.groups || []).find(group => group?.id === lessonGroupId);
    if (exactGroup) return { group: exactGroup, resolverGroupId: exactGroup.id, identityReasonCode: 'LESSON_GROUP_ID_MATCHED' };
  }
  if (suppliedGroupId) {
    const knownSuppliedGroup = (params.groups || []).find(group => group?.id === suppliedGroupId);
    if (knownSuppliedGroup) return {
      group: knownSuppliedGroup,
      resolverGroupId: knownSuppliedGroup.id,
      identityReasonCode: lessonGroupId && lessonGroupId !== suppliedGroupId
        ? 'STALE_LESSON_GROUP_ID_USED_KNOWN_PROP_GROUP'
        : 'GROUP_PROP_MATCHED'
    };
    if (!lessonGroupId || suppliedGroupId === lessonGroupId) {
      return { group: params.suppliedGroup, resolverGroupId: suppliedGroupId, identityReasonCode: 'GROUP_PROP_MATCHED' };
    }
  }
  return { group: null, resolverGroupId: lessonGroupId || undefined, identityReasonCode: 'NO_TRUSTED_GROUP_OBJECT' };
}

export type ZoomReminderResolutionReason =
  | 'RESOLVED_EXACT_SLOT'
  | 'RESOLVED_GROUP_WIDE_FALLBACK'
  | 'NO_GROUP_ID'
  | 'NO_SESSION_COLLECTION'
  | 'INVALID_TARGET_WEEKDAY'
  | 'INVALID_TARGET_TIME'
  | 'NO_ROWS_FOR_GROUP_ID'
  | 'ROWS_NOT_ACTIVE_API_SYNCED'
  | 'ACTIVE_API_ROWS_MISSING_URL'
  | 'NO_MATCHING_GROUP_SESSION';

export interface ZoomReminderResolutionDiagnostics {
  reasonCode: ZoomReminderResolutionReason;
  targetGroupId?: string;
  lessonGroupId?: string;
  effectiveLessonGroupId?: string;
  lessonDate?: string;
  lessonTime?: string;
  normalizedWeekday: number;
  normalizedTime: string;
  matchingGroupRows: Array<{
    id: string;
    groupId: string;
    deleted: boolean;
    meetingSource: string;
    syncState: string;
    hasZoomJoinUrl: boolean;
    weekday: number;
    startTime: string;
  }>;
  resolvedSessionId?: string;
  resolverGroupId?: string;
  identityReasonCode?: ZoomReminderIdentityReason;
}

export function diagnoseZoomReminderResolution(params: {
  targetGroup?: Partial<Group> | null;
  lesson?: Partial<Lesson> | null;
  effectiveLesson?: Partial<Lesson> | null;
  groupWeeklySessions?: GroupWeeklySession[] | null;
  targetDay?: string | number | null;
  targetTime?: string | null;
  resolverGroupId?: string | null;
  identityReasonCode?: ZoomReminderIdentityReason;
}): ZoomReminderResolutionDiagnostics {
  const lesson = params.lesson || params.effectiveLesson;
  const effectiveLesson = params.effectiveLesson || lesson;
  const targetGroupId = params.targetGroup?.id || undefined;
  const lessonGroupId = lesson?.groupId || undefined;
  const effectiveLessonGroupId = effectiveLesson?.groupId || undefined;
  // The effective lesson owns the group identity. The supplied group object is contextual
  // and may be stale when a lesson was opened from an imported/duplicate group record.
  const groupId = params.resolverGroupId || effectiveLessonGroupId || lessonGroupId || targetGroupId;
  const date = effectiveLesson?.date || lesson?.date;
  const time = effectiveLesson?.time || params.targetTime;
  const weekdayFromDate = parseIsoDateWeekday(date);
  const normalizedWeekday = weekdayFromDate >= 0 ? weekdayFromDate : normalizeWeekdayIndex(params.targetDay);
  const normalizedTime = normalize24HourTime(time, '');
  const allRows = Array.isArray(params.groupWeeklySessions) ? params.groupWeeklySessions : [];
  const rows = groupId ? allRows.filter(row => row?.groupId === groupId) : [];
  const resolved = resolveActiveWeeklySessionForLesson({
    groupId,
    lesson: effectiveLesson,
    groupWeeklySessions: allRows,
    targetDay: params.targetDay,
    targetTime: time
  });

  let reasonCode: ZoomReminderResolutionReason;
  if (resolved) {
    const exact = resolved.weekday === normalizedWeekday &&
      normalize24HourTime(resolved.startTime, '') === normalizedTime;
    reasonCode = exact ? 'RESOLVED_EXACT_SLOT' : 'RESOLVED_GROUP_WIDE_FALLBACK';
  } else if (!groupId) reasonCode = 'NO_GROUP_ID';
  else if (!Array.isArray(params.groupWeeklySessions)) reasonCode = 'NO_SESSION_COLLECTION';
  else if (rows.length === 0) reasonCode = 'NO_ROWS_FOR_GROUP_ID';
  else if (!rows.some(row => !row.deleted && row.meetingSource === 'zoom_api' && row.syncState === 'synced')) {
    reasonCode = 'ROWS_NOT_ACTIVE_API_SYNCED';
  } else if (!rows.some(row => !row.deleted && row.meetingSource === 'zoom_api' && row.syncState === 'synced' && Boolean((row.zoomJoinUrl || '').trim()))) {
    reasonCode = 'ACTIVE_API_ROWS_MISSING_URL';
  } else if (normalizedWeekday < 0) reasonCode = 'INVALID_TARGET_WEEKDAY';
  else if (!normalizedTime) reasonCode = 'INVALID_TARGET_TIME';
  else reasonCode = 'NO_MATCHING_GROUP_SESSION';

  return {
    reasonCode,
    targetGroupId,
    lessonGroupId,
    effectiveLessonGroupId,
    lessonDate: date,
    lessonTime: time || undefined,
    normalizedWeekday,
    normalizedTime,
    matchingGroupRows: rows.map(row => ({
      id: String(row.id || ''),
      groupId: String(row.groupId || ''),
      deleted: Boolean(row.deleted),
      meetingSource: String(row.meetingSource || ''),
      syncState: String(row.syncState || ''),
      hasZoomJoinUrl: Boolean((row.zoomJoinUrl || '').trim()),
      weekday: Number(row.weekday),
      startTime: String(row.startTime || '')
    })),
    resolvedSessionId: resolved?.id,
    resolverGroupId: groupId || undefined,
    identityReasonCode: params.identityReasonCode
  };
}

export function logZoomReminderPipeline(stage: string, payload: unknown): void {
  if (typeof console !== 'undefined') {
    console.info('[Zoom Reminder Pipeline]', stage, payload);
  }
}
