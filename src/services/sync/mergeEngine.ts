import { SyncableRecord, SyncConflictRecord, SyncEntityDiff, TeacherSettingsRecord, DeletedItem, RecentlyDeletedData, PurgedRecordTombstone, Student, Group, Lesson, SchoolNote, NotificationItem } from '../../types';

export interface MergeResult<T extends SyncableRecord> {
  merged: T[];
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  conflicts: SyncConflictRecord[];
  diff: SyncEntityDiff;
  deferredIds?: string[];
}

export function parseTimestampMs(val: any): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Type-safe merge for DeletedItem<T>[] wrapper objects (e.g. RecentlyDeletedData).
 * Identifies records by entry.item.id, preserves original item and deletedAt, deduplicates,
 * and uses deterministic conflict resolution based on deletion timestamps and item metadata.
 */
export function mergeDeletedItems<T extends { id: string }>(
  localItems: DeletedItem<T>[] | undefined | null,
  incomingItems: DeletedItem<T>[] | undefined | null
): DeletedItem<T>[] {
  const localArr = Array.isArray(localItems) ? localItems : [];
  const incomingArr = Array.isArray(incomingItems) ? incomingItems : [];

  if (localArr.length === 0 && incomingArr.length === 0) return [];

  const map = new Map<string, DeletedItem<T>>();

  for (const entry of localArr) {
    if (!entry || !entry.item || typeof entry.item.id !== 'string' || !entry.item.id.trim()) {
      continue;
    }
    map.set(entry.item.id.trim(), entry);
  }

  for (const incomingEntry of incomingArr) {
    if (!incomingEntry || !incomingEntry.item || typeof incomingEntry.item.id !== 'string' || !incomingEntry.item.id.trim()) {
      continue;
    }

    const id = incomingEntry.item.id.trim();
    const existingEntry = map.get(id);

    if (!existingEntry) {
      map.set(id, incomingEntry);
    } else {
      const existingTime = parseTimestampMs(existingEntry.deletedAt || (existingEntry.item as any)?.updatedAt);
      const incomingTime = parseTimestampMs(incomingEntry.deletedAt || (incomingEntry.item as any)?.updatedAt);

      if (incomingTime > existingTime) {
        map.set(id, {
          deletedAt: incomingEntry.deletedAt || existingEntry.deletedAt || new Date().toISOString(),
          item: {
            ...existingEntry.item,
            ...incomingEntry.item
          }
        });
      } else if (existingTime > incomingTime) {
        map.set(id, {
          deletedAt: existingEntry.deletedAt || incomingEntry.deletedAt || new Date().toISOString(),
          item: {
            ...incomingEntry.item,
            ...existingEntry.item
          }
        });
      } else {
        map.set(id, {
          deletedAt: incomingEntry.deletedAt || existingEntry.deletedAt || new Date().toISOString(),
          item: {
            ...existingEntry.item,
            ...incomingEntry.item
          }
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Merge and deduplicate PurgedRecordTombstone records by item ID.
 * Preserves valid tombstones even when timestamps are missing or clock-skewed.
 */
export function mergePurgedTombstones(
  localPurged: PurgedRecordTombstone[] | undefined | null,
  incomingPurged: PurgedRecordTombstone[] | undefined | null
): PurgedRecordTombstone[] {
  const localArr = Array.isArray(localPurged) ? localPurged : [];
  const incomingArr = Array.isArray(incomingPurged) ? incomingPurged : [];
  if (localArr.length === 0 && incomingArr.length === 0) return [];

  const map = new Map<string, PurgedRecordTombstone>();
  for (const t of [...localArr, ...incomingArr]) {
    if (!t || !t.id || typeof t.id !== 'string' || !t.id.trim()) continue;
    const id = t.id.trim();
    const validType: 'student' | 'group' | 'lesson' =
      t.type === 'group' || t.type === 'lesson' || t.type === 'student' ? t.type : 'student';
    const rawTime = Math.max(parseTimestampMs(t.updatedAt), parseTimestampMs(t.purgedAt), 1);
    const normalized: PurgedRecordTombstone = {
      id,
      type: validType,
      purgedAt: typeof t.purgedAt === 'string' && t.purgedAt.trim() ? t.purgedAt : new Date(rawTime).toISOString(),
      updatedAt: rawTime,
      originRevision: typeof t.originRevision === 'number' ? t.originRevision : 1
    };

    const existing = map.get(id);
    if (!existing) {
      map.set(id, normalized);
    } else {
      const existingTime = Math.max(parseTimestampMs(existing.updatedAt), parseTimestampMs(existing.purgedAt), 1);
      const maxTime = Math.max(existingTime, rawTime);
      const maxRev = Math.max(existing.originRevision || 1, normalized.originRevision || 1);
      map.set(id, {
        id,
        type: normalized.type || existing.type,
        purgedAt: rawTime >= existingTime ? normalized.purgedAt : existing.purgedAt,
        updatedAt: maxTime,
        originRevision: maxRev
      });
    }
  }
  return Array.from(map.values());
}

/**
 * Dedicated, type-safe merge for RecentlyDeletedData containing wrapper objects and purged tombstones.
 * Permanent purge tombstones are terminal for their IDs regardless of device clock differences.
 */
export function mergeRecentlyDeleted(
  localRec: RecentlyDeletedData | undefined | null,
  incomingRec: RecentlyDeletedData | undefined | null
): RecentlyDeletedData {
  const local = localRec || { students: [], groups: [], lessons: [], purgedRecords: [] };
  const incoming = incomingRec || { students: [], groups: [], lessons: [], purgedRecords: [] };

  const mergedPurged = mergePurgedTombstones(local.purgedRecords, incoming.purgedRecords);
  const mergedStudents = mergeDeletedItems(local.students, incoming.students);
  const mergedGroups = mergeDeletedItems(local.groups, incoming.groups);
  const mergedLessons = mergeDeletedItems(local.lessons, incoming.lessons);

  const purgedIds = new Set<string>();
  const purgedGroupIds = new Set<string>();
  const purgedStudentIds = new Set<string>();

  for (const p of mergedPurged) {
    if (p && p.id && typeof p.id === 'string') {
      const pid = p.id.trim();
      if (pid) {
        purgedIds.add(pid);
        if (p.type === 'group') purgedGroupIds.add(pid);
        if (p.type === 'student') purgedStudentIds.add(pid);
      }
    }
  }

  // Cascade: any soft-deleted student belonging to a purged group is also considered purged
  for (const entry of mergedStudents) {
    if (entry && entry.item && entry.item.id) {
      const grpId = (entry.item.groupId || entry.item.archivedGroupId || '').trim();
      if (grpId && purgedGroupIds.has(grpId)) {
        purgedIds.add(entry.item.id.trim());
        purgedStudentIds.add(entry.item.id.trim());
      }
    }
  }

  // Cascade: any soft-deleted lesson belonging to a purged group or purged student is also considered purged
  for (const entry of mergedLessons) {
    if (entry && entry.item && entry.item.id) {
      const grpId = (entry.item.groupId || '').trim();
      const stId = (entry.item.studentId || '').trim();
      if ((grpId && purgedGroupIds.has(grpId)) || (stId && purgedStudentIds.has(stId))) {
        purgedIds.add(entry.item.id.trim());
      }
    }
  }

  const filterSoftDeleted = <T extends { id: string }>(items: DeletedItem<T>[]): DeletedItem<T>[] => {
    return items.filter(entry => {
      if (!entry || !entry.item || !entry.item.id) return false;
      const id = entry.item.id.trim();
      // Terminal tombstone precedence: once an ID is in purgedIds, it never re-enters soft-deleted trash regardless of timestamps
      return !purgedIds.has(id);
    });
  };

  return {
    students: filterSoftDeleted(mergedStudents),
    groups: filterSoftDeleted(mergedGroups),
    lessons: filterSoftDeleted(mergedLessons),
    purgedRecords: mergedPurged
  };
}

/**
 * Deduplicated union-based merge for dismissedDashboardLessons string IDs.
 */
export function mergeDismissedDashboardLessons(
  localDismissed: string[] | undefined | null,
  incomingDismissed: string[] | undefined | null,
  isDelta: boolean = true
): string[] {
  const localArr = Array.isArray(localDismissed)
    ? localDismissed.filter(id => typeof id === 'string' && id.trim())
    : [];

  if (!Array.isArray(incomingDismissed)) {
    return localArr;
  }

  const incomingArr = incomingDismissed.filter(id => typeof id === 'string' && id.trim());

  if (isDelta) {
    return Array.from(new Set([...localArr, ...incomingArr]));
  } else {
    return Array.from(new Set([...localArr, ...incomingArr]));
  }
}

export interface MergeEntitiesOptions<T extends SyncableRecord = any> {
  entityTypeName?: string;
  purgedRecords?: PurgedRecordTombstone[];
  recentlyDeleted?: RecentlyDeletedData;
  deferUnknownActiveIds?: boolean;
  knownLocalIds?: Set<string>;
  baseArray?: T[];
}

const METADATA_KEYS = new Set<string>([
  'id',
  'updatedAt',
  'createdAt',
  'version',
  'originRevision',
  'originDeviceId',
  'updatedByDeviceId',
  'syncedAt',
  'deleted',
  '_fieldUpdatedAt',
  '_baseSnapshot'
]);

function isPlainObject(val: unknown): val is Record<string, any> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function isDeepValueEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Stamps per-field modification timestamps by comparing `prevItem` and `nextItem`.
 * Allows field-level conflict resolution when two devices concurrently modify different fields of the same record.
 */
export function stampFieldTimestamps<T extends Record<string, any>>(
  prevItem: T | undefined | null,
  nextItem: T,
  timestampMs?: number
): T {
  if (!nextItem || typeof nextItem !== 'object') return nextItem;
  const nowMs =
    parseTimestampMs((nextItem as any).updatedAt) ||
    (typeof timestampMs === 'number' && timestampMs > 0 ? timestampMs : Date.now());
  const prevFields: Record<string, number> = isPlainObject((prevItem as any)?._fieldUpdatedAt)
    ? { ...(prevItem as any)._fieldUpdatedAt }
    : {};
  const nextFields: Record<string, number> = isPlainObject((nextItem as any)._fieldUpdatedAt)
    ? { ...prevFields, ...(nextItem as any)._fieldUpdatedAt }
    : { ...prevFields };

  if (prevItem && typeof prevItem === 'object') {
    const allKeys = new Set<string>([...Object.keys(prevItem), ...Object.keys(nextItem)]);
    for (const key of allKeys) {
      if (METADATA_KEYS.has(key)) continue;
      if (!isDeepValueEqual((prevItem as any)[key], (nextItem as any)[key])) {
        nextFields[key] = nowMs;
      }
    }
  } else {
    for (const key of Object.keys(nextItem)) {
      if (METADATA_KEYS.has(key)) continue;
      if ((nextItem as any)[key] !== undefined && nextFields[key] === undefined) {
        nextFields[key] = nowMs;
      }
    }
  }

  return {
    ...nextItem,
    _fieldUpdatedAt: nextFields
  };
}

export function mergeConcurrentEntityFields<T extends SyncableRecord>(
  localItem: T,
  incomingItem: T,
  winner: 'local' | 'remote',
  baseItem?: T
): { merged: T; usedFieldMerge: boolean } {
  const primary = (winner === 'remote' ? incomingItem : localItem) as Record<string, any>;
  const secondary = (winner === 'remote' ? localItem : incomingItem) as Record<string, any>;
  const effectiveBase: Record<string, any> | undefined =
    (baseItem as any) ||
    (isPlainObject((localItem as any)._baseSnapshot) ? (localItem as any)._baseSnapshot : undefined) ||
    (isPlainObject((incomingItem as any)._baseSnapshot) ? (incomingItem as any)._baseSnapshot : undefined);

  const localFieldTimes: Record<string, number> = isPlainObject((localItem as any)._fieldUpdatedAt)
    ? (localItem as any)._fieldUpdatedAt
    : {};
  const incomingFieldTimes: Record<string, number> = isPlainObject((incomingItem as any)._fieldUpdatedAt)
    ? (incomingItem as any)._fieldUpdatedAt
    : {};
  const hasFieldTimestamps =
    Object.keys(localFieldTimes).length > 0 || Object.keys(incomingFieldTimes).length > 0;

  const result: Record<string, any> = {
    ...secondary,
    ...primary
  };
  let usedFieldMerge = false;

  const domainKeys = new Set<string>([
    ...Object.keys(localItem as any),
    ...Object.keys(incomingItem as any)
  ]);

  for (const key of domainKeys) {
    if (METADATA_KEYS.has(key)) continue;
    const localVal = (localItem as any)[key];
    const incomingVal = (incomingItem as any)[key];

    if (isDeepValueEqual(localVal, incomingVal)) {
      result[key] = primary[key] !== undefined ? primary[key] : secondary[key];
      continue;
    }

    // 1. Explicit per-field timestamp comparison
    const localFieldTs = typeof localFieldTimes[key] === 'number' ? localFieldTimes[key] : 0;
    const incomingFieldTs = typeof incomingFieldTimes[key] === 'number' ? incomingFieldTimes[key] : 0;
    if (localFieldTs > 0 || incomingFieldTs > 0) {
      if (localFieldTs > incomingFieldTs) {
        result[key] = localVal;
        if (winner === 'remote') usedFieldMerge = true;
        continue;
      } else if (incomingFieldTs > localFieldTs) {
        result[key] = incomingVal;
        if (winner === 'local') usedFieldMerge = true;
        continue;
      }
    }

    // 2. Three-way base comparison when baseItem or _baseSnapshot is available
    if (effectiveBase && key in effectiveBase) {
      const baseVal = effectiveBase[key];
      const localChanged = !isDeepValueEqual(localVal, baseVal);
      const incomingChanged = !isDeepValueEqual(incomingVal, baseVal);
      if (localChanged && !incomingChanged) {
        result[key] = localVal;
        if (winner === 'remote') usedFieldMerge = true;
        continue;
      } else if (incomingChanged && !localChanged) {
        result[key] = incomingVal;
        if (winner === 'local') usedFieldMerge = true;
        continue;
      } else if (localChanged && incomingChanged && isPlainObject(localVal) && isPlainObject(incomingVal)) {
        const baseObj = isPlainObject(baseVal) ? baseVal : {};
        const mergedNested: Record<string, any> = { ...secondary[key], ...primary[key] };
        const subKeys = new Set<string>([...Object.keys(localVal), ...Object.keys(incomingVal)]);
        for (const sk of subKeys) {
          const lSubChanged = !isDeepValueEqual(localVal[sk], baseObj[sk]);
          const rSubChanged = !isDeepValueEqual(incomingVal[sk], baseObj[sk]);
          if (lSubChanged && !rSubChanged) {
            mergedNested[sk] = localVal[sk];
            if (winner === 'remote') usedFieldMerge = true;
          } else if (rSubChanged && !lSubChanged) {
            mergedNested[sk] = incomingVal[sk];
            if (winner === 'local') usedFieldMerge = true;
          }
        }
        result[key] = mergedNested;
        continue;
      }
    }

    // 3. Nested plain object merge (e.g. lesson.report) & non-empty field preservation
    if (isPlainObject(localVal) && isPlainObject(incomingVal)) {
      const mergedNested: Record<string, any> = {
        ...(winner === 'remote' ? localVal : incomingVal),
        ...(winner === 'remote' ? incomingVal : localVal)
      };
      const subKeys = new Set<string>([...Object.keys(localVal), ...Object.keys(incomingVal)]);
      for (const sk of subKeys) {
        const pSub = (winner === 'remote' ? incomingVal : localVal)[sk];
        const sSub = (winner === 'remote' ? localVal : incomingVal)[sk];
        if ((pSub === undefined || pSub === null || pSub === '') && sSub !== undefined && sSub !== null && sSub !== '') {
          mergedNested[sk] = sSub;
          usedFieldMerge = true;
        }
      }
      result[key] = mergedNested;
      continue;
    }

    const pVal = primary[key];
    const sVal = secondary[key];
    if ((pVal === undefined || pVal === null || pVal === '') && sVal !== undefined && sVal !== null && sVal !== '') {
      result[key] = sVal;
      usedFieldMerge = true;
    }
  }

  // Ensure incoming or local active status progression takes precedence over 'scheduled'
  const localStatus = (localItem as any).status;
  const incomingStatus = (incomingItem as any).status;
  if (
    (incomingStatus === 'completed' || incomingStatus === 'cancelled' || incomingStatus === 'in_progress') &&
    (localStatus === 'scheduled' || !localStatus)
  ) {
    result.status = incomingStatus;
  } else if (
    (localStatus === 'completed' || localStatus === 'cancelled' || localStatus === 'in_progress') &&
    (incomingStatus === 'scheduled' || !incomingStatus)
  ) {
    result.status = localStatus;
  }

  if (result.certificateName === undefined || result.certificateName === '') {
    result.certificateName = (localItem as any).certificateName || (incomingItem as any).certificateName || '';
  }
  if (!Array.isArray(result.documents) || result.documents.length === 0) {
    const fallbackDocs =
      Array.isArray((localItem as any).documents) && (localItem as any).documents.length > 0
        ? (localItem as any).documents
        : Array.isArray((incomingItem as any).documents)
        ? (incomingItem as any).documents
        : [];
    if (result.documents !== undefined || fallbackDocs.length > 0) {
      result.documents = fallbackDocs;
    }
  }
  if (localStatus === 'archived' && !incomingStatus) {
    result.status = 'archived';
  }

  if (hasFieldTimestamps) {
    const mergedFieldTimes: Record<string, number> = { ...localFieldTimes };
    for (const [k, ts] of Object.entries(incomingFieldTimes)) {
      if (typeof ts === 'number' && ts > (mergedFieldTimes[k] || 0)) {
        mergedFieldTimes[k] = ts;
      }
    }
    result._fieldUpdatedAt = mergedFieldTimes;
  }

  return { merged: result as T, usedFieldMerge };
}

function isEntityCascadePurged(
  item: any,
  entityTypeName: string,
  purgedGroupIds: Set<string>,
  purgedStudentIds: Set<string>,
  purgedLessonIds: Set<string>
): boolean {
  if (!item || typeof item !== 'object') return false;
  const normType = (entityTypeName || '').toLowerCase();
  const groupId = typeof item.groupId === 'string' ? item.groupId.trim() : '';
  const archivedGroupId = typeof item.archivedGroupId === 'string' ? item.archivedGroupId.trim() : '';
  const studentId = typeof item.studentId === 'string' ? item.studentId.trim() : '';
  const lessonId = typeof item.lessonId === 'string' ? item.lessonId.trim() : '';

  if (normType === 'student' || normType === 'students') {
    if ((groupId && purgedGroupIds.has(groupId)) || (archivedGroupId && purgedGroupIds.has(archivedGroupId))) {
      return true;
    }
  } else if (normType === 'lesson' || normType === 'lessons') {
    if ((groupId && purgedGroupIds.has(groupId)) || (studentId && purgedStudentIds.has(studentId))) {
      return true;
    }
  } else if (normType === 'schoolnotes' || normType === 'schoolnote') {
    if ((studentId && purgedStudentIds.has(studentId)) || (lessonId && purgedLessonIds.has(lessonId))) {
      return true;
    }
  } else if (normType === 'homeworkassignments' || normType === 'homeworksubmissions') {
    if (
      (groupId && purgedGroupIds.has(groupId)) ||
      (studentId && purgedStudentIds.has(studentId)) ||
      (lessonId && purgedLessonIds.has(lessonId))
    ) {
      return true;
    }
  } else if (normType === 'notifications' || normType === 'notification') {
    if (lessonId && purgedLessonIds.has(lessonId)) {
      return true;
    }
  }
  return false;
}

export function mergeEntities<T extends SyncableRecord>(
  localArray: T[],
  incomingArray: T[],
  entityTypeNameOrOptions?: string | MergeEntitiesOptions<T>
): MergeResult<T> {
  const options: MergeEntitiesOptions<T> = typeof entityTypeNameOrOptions === 'string'
    ? { entityTypeName: entityTypeNameOrOptions }
    : (entityTypeNameOrOptions || {});

  const entityTypeName = options.entityTypeName || 'entity';
  const purgedList = mergePurgedTombstones(options.purgedRecords, options.recentlyDeleted?.purgedRecords);

  const baseMap = new Map<string, T>();
  if (Array.isArray(options.baseArray)) {
    for (const b of options.baseArray) {
      if (b && b.id) baseMap.set(b.id.trim(), b);
    }
  }

  const purgedMap = new Map<string, { purgedTime: number; tombstoneRev: number; type: string }>();
  const purgedGroupIds = new Set<string>();
  const purgedStudentIds = new Set<string>();
  const purgedLessonIds = new Set<string>();

  for (const p of purgedList) {
    if (p && p.id && typeof p.id === 'string') {
      const pid = p.id.trim();
      if (!pid) continue;
      const pTime = Math.max(parseTimestampMs(p.purgedAt), parseTimestampMs(p.updatedAt), 1);
      const existing = purgedMap.get(pid);
      const maxTime = Math.max(existing?.purgedTime || 0, pTime);
      const maxRev = Math.max(existing?.tombstoneRev || 0, p.originRevision || 1);
      purgedMap.set(pid, { purgedTime: maxTime, tombstoneRev: maxRev, type: p.type });
      if (p.type === 'group') purgedGroupIds.add(pid);
      if (p.type === 'student') purgedStudentIds.add(pid);
      if (p.type === 'lesson') purgedLessonIds.add(pid);
    }
  }

  const entityMap = new Map<string, T>();
  let deletedCount = 0;

  // Populate initial map with local entities, sweeping any local record that matches a purge tombstone or cascade parent!
  const safeLocalArray = Array.isArray(localArray) ? localArray : [];
  for (const localItem of safeLocalArray) {
    if (localItem && localItem.id) {
      const lid = localItem.id.trim();
      if (
        purgedMap.has(lid) ||
        isEntityCascadePurged(localItem, entityTypeName, purgedGroupIds, purgedStudentIds, purgedLessonIds)
      ) {
        deletedCount++;
        continue;
      }
      entityMap.set(lid, localItem);
    }
  }

  // If incoming is empty or not an array, return local state (with any newly purged local items removed)
  if (!Array.isArray(incomingArray) || incomingArray.length === 0) {
    return {
      merged: Array.from(entityMap.values()),
      createdCount: 0,
      updatedCount: 0,
      deletedCount,
      conflicts: [],
      diff: { created: 0, updated: 0, deleted: deletedCount, conflicts: 0 },
      deferredIds: []
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  const conflicts: SyncConflictRecord[] = [];
  const deferredIds: string[] = [];

  for (const incomingItem of incomingArray) {
    if (!incomingItem || !incomingItem.id) continue;
    const id = incomingItem.id.trim();
    const localItem = entityMap.get(id);

    // 1. Authoritative Purge Tombstone & Cascade Suppression Check (Clock-Independent, Terminal)
    const purgedInfo = purgedMap.get(id);
    const isCascadePurged = isEntityCascadePurged(incomingItem, entityTypeName, purgedGroupIds, purgedStudentIds, purgedLessonIds);
    if (purgedInfo || isCascadePurged) {
      const incomingTime = parseTimestampMs(incomingItem.updatedAt);
      const localPurgeTime = purgedInfo?.purgedTime || Date.now();
      conflicts.push({
        entityType: entityTypeName,
        entityId: id,
        localUpdatedAt: localPurgeTime,
        remoteUpdatedAt: incomingTime,
        winner: 'local',
        resolutionStrategy: 'LWW',
        timestamp: Date.now()
      });
      continue;
    }

    // 2. Partial Snapshot / Missing Tombstone Metadata Guard:
    // If deletion metadata is incomplete/unknown, do not insert unknown remote active records until tombstone state is known
    if (!localItem) {
      const isKnownLocally = options.knownLocalIds ? options.knownLocalIds.has(id) : false;
      if (options.deferUnknownActiveIds && !incomingItem.deleted && !isKnownLocally) {
        deferredIds.push(id);
        continue;
      }

      // Incoming record does not exist locally and is allowed -> insert it
      entityMap.set(id, incomingItem);
      if (incomingItem.deleted) {
        deletedCount++;
      } else {
        createdCount++;
      }
    } else {
      // Conflict resolution based on Last-Write-Wins (LWW) + Field-Level Merge
      const incomingTime = parseTimestampMs(incomingItem.updatedAt);
      const localTime = parseTimestampMs(localItem.updatedAt);
      const incomingRev = incomingItem.originRevision || 0;
      const localRev = localItem.originRevision || 0;

      // Check if this is a specialized TeacherSettingsRecord
      if (incomingItem.id === 'singleton_teacher_settings') {
        const mergedSettings = mergeTeacherSettings(
          localItem as unknown as TeacherSettingsRecord,
          incomingItem as unknown as TeacherSettingsRecord
        );
        entityMap.set(incomingItem.id, mergedSettings as unknown as T);
        updatedCount++;
        conflicts.push({
          entityType: 'settings',
          entityId: incomingItem.id,
          localUpdatedAt: localTime,
          remoteUpdatedAt: incomingTime,
          winner: incomingTime >= localTime ? 'remote' : 'local',
          resolutionStrategy: 'FIELD_MERGE',
          timestamp: Date.now()
        });
        continue;
      }

      // Conflict logic
      let shouldAcceptIncoming = false;
      let resolutionStrategy: 'LWW' | 'TIE_BREAKER' | 'FIELD_MERGE' = 'LWW';

      const incomingVer = (incomingItem as any).version || 0;
      const localVer = (localItem as any).version || 0;

      if (incomingTime > localTime) {
        shouldAcceptIncoming = true;
      } else if (incomingTime === localTime) {
        // Higher version wins, then higher originRevision, then deterministic device ID tie-breaker
        if (incomingVer > localVer) {
          shouldAcceptIncoming = true;
          resolutionStrategy = 'TIE_BREAKER';
        } else if (incomingRev > localRev) {
          shouldAcceptIncoming = true;
          resolutionStrategy = 'TIE_BREAKER';
        } else if (incomingRev === localRev) {
          const incomingDeviceId = incomingItem.updatedByDeviceId || incomingItem.originDeviceId || '';
          const localDeviceId = localItem.updatedByDeviceId || localItem.originDeviceId || '';

          if (incomingDeviceId > localDeviceId) {
            shouldAcceptIncoming = true;
            resolutionStrategy = 'TIE_BREAKER';
          }
        }
      } else if (incomingVer > localVer && (incomingTime >= localTime - 5000)) {
        // Higher logical version with minor clock drift
        shouldAcceptIncoming = true;
        resolutionStrategy = 'TIE_BREAKER';
      } else if (
        (incomingItem.deleted && !localItem.deleted) ||
        (
          ((incomingItem as any).status === 'cancelled' || (incomingItem as any).status === 'completed' || (incomingItem as any).status === 'in_progress') &&
          ((localItem as any).status === 'scheduled' || !(localItem as any).status)
        )
      ) {
        // Intentional deletion or active progress status update: honor incoming status update unless local has strictly newer version AND timestamp
        if (!(localTime > incomingTime && localVer > incomingVer)) {
          shouldAcceptIncoming = true;
          resolutionStrategy = 'TIE_BREAKER';
        }
      }

      // Preserve local soft-deletion tombstones against stale remote non-deleted items unless remote has strictly newer timestamp
      if (
        localItem.deleted &&
        !incomingItem.deleted &&
        !(incomingTime > localTime && (incomingVer >= localVer || incomingRev > localRev))
      ) {
        shouldAcceptIncoming = false;
      }

      const baseItem = baseMap.get(id);

      if (shouldAcceptIncoming) {
        let finalItem = incomingItem;
        if (!incomingItem.deleted && !localItem.deleted) {
          const fieldMergeRes = mergeConcurrentEntityFields(localItem, incomingItem, 'remote', baseItem);
          finalItem = fieldMergeRes.merged;
          if (fieldMergeRes.usedFieldMerge) {
            resolutionStrategy = 'FIELD_MERGE';
          }
        }

        entityMap.set(incomingItem.id, finalItem);
        if (incomingItem.deleted && !localItem.deleted) {
          deletedCount++;
        } else {
          updatedCount++;
        }

        conflicts.push({
          entityType: entityTypeName,
          entityId: incomingItem.id,
          localUpdatedAt: localTime,
          remoteUpdatedAt: incomingTime,
          winner: 'remote',
          resolutionStrategy,
          timestamp: Date.now()
        });
      } else {
        // Local won primary envelope; apply non-conflicting field merge if neither record is deleted
        if (!localItem.deleted && !incomingItem.deleted) {
          const fieldMergeRes = mergeConcurrentEntityFields(localItem, incomingItem, 'local', baseItem);
          entityMap.set(localItem.id, fieldMergeRes.merged);
          if (fieldMergeRes.usedFieldMerge) {
            resolutionStrategy = 'FIELD_MERGE';
            updatedCount++;
          }
        }

        if (incomingTime !== localTime || incomingRev !== localRev || resolutionStrategy === 'FIELD_MERGE') {
          conflicts.push({
            entityType: entityTypeName,
            entityId: incomingItem.id,
            localUpdatedAt: localTime,
            remoteUpdatedAt: incomingTime,
            winner: 'local',
            resolutionStrategy,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  return {
    merged: Array.from(entityMap.values()),
    createdCount,
    updatedCount,
    deletedCount,
    conflicts,
    diff: {
      created: createdCount,
      updated: updatedCount,
      deleted: deletedCount,
      conflicts: conflicts.length
    },
    deferredIds
  };
}

function mergeArrayById<T extends { id?: string }>(base: T[] = [], fallback: T[] = []): T[] {
  const map = new Map<string, T>();
  if (Array.isArray(fallback)) {
    for (const item of fallback) {
      if (item && item.id) map.set(item.id, item);
    }
  }
  if (Array.isArray(base)) {
    for (const item of base) {
      if (item && item.id) {
        const existing = map.get(item.id);
        map.set(item.id, existing ? { ...existing, ...item } : item);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Merges teacher settings with field-level fallbacks so partial remote edits do not wipe local fields.
 */
export function mergeTeacherSettings(
  local: TeacherSettingsRecord,
  incoming: TeacherSettingsRecord
): TeacherSettingsRecord {
  const localTime = local?.updatedAt || 0;
  const incomingTime = incoming?.updatedAt || 0;

  const isIncomingNewer = incomingTime >= localTime;
  const baseRecord = isIncomingNewer ? incoming : local;
  const fallbackRecord = isIncomingNewer ? local : incoming;

  const mergedProfile = {
    ...fallbackRecord?.profile,
    ...baseRecord?.profile,
    displayNameEn: baseRecord?.profile?.displayNameEn ?? fallbackRecord?.profile?.displayNameEn,
    displayNameAr: baseRecord?.profile?.displayNameAr ?? fallbackRecord?.profile?.displayNameAr,
    workingHours: {
      ...fallbackRecord?.profile?.workingHours,
      ...baseRecord?.profile?.workingHours
    },
    weeklyWorkingHours: baseRecord?.profile?.weeklyWorkingHours || fallbackRecord?.profile?.weeklyWorkingHours,
    parentMessageTemplates: {
      ...fallbackRecord?.profile?.parentMessageTemplates,
      ...baseRecord?.profile?.parentMessageTemplates
    },
    schoolSettings: baseRecord?.profile?.schoolSettings || fallbackRecord?.profile?.schoolSettings ? {
      ...fallbackRecord?.profile?.schoolSettings,
      ...baseRecord?.profile?.schoolSettings,
      presence: {
        ...fallbackRecord?.profile?.schoolSettings?.presence,
        ...baseRecord?.profile?.schoolSettings?.presence
      },
      periodSettings: {
        ...fallbackRecord?.profile?.schoolSettings?.periodSettings,
        ...baseRecord?.profile?.schoolSettings?.periodSettings,
        customDurations: {
          ...fallbackRecord?.profile?.schoolSettings?.periodSettings?.customDurations,
          ...baseRecord?.profile?.schoolSettings?.periodSettings?.customDurations
        }
      },
      schedule: {
        ...fallbackRecord?.profile?.schoolSettings?.schedule,
        ...baseRecord?.profile?.schoolSettings?.schedule
      },
      teacherSchedules: {
        ...fallbackRecord?.profile?.schoolSettings?.teacherSchedules,
        ...baseRecord?.profile?.schoolSettings?.teacherSchedules
      },
      stageManagers: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageManagers, fallbackRecord?.profile?.schoolSettings?.stageManagers),
      stageSecretaries: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageSecretaries, fallbackRecord?.profile?.schoolSettings?.stageSecretaries),
      visitRecords: mergeArrayById(baseRecord?.profile?.schoolSettings?.visitRecords, fallbackRecord?.profile?.schoolSettings?.visitRecords),
      bookletObservations: mergeArrayById(baseRecord?.profile?.schoolSettings?.bookletObservations, fallbackRecord?.profile?.schoolSettings?.bookletObservations),
      weeklyPlanStatuses: mergeArrayById(baseRecord?.profile?.schoolSettings?.weeklyPlanStatuses, fallbackRecord?.profile?.schoolSettings?.weeklyPlanStatuses),
      stageReports: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageReports, fallbackRecord?.profile?.schoolSettings?.stageReports),
      stageFollowUps: mergeArrayById(baseRecord?.profile?.schoolSettings?.stageFollowUps, fallbackRecord?.profile?.schoolSettings?.stageFollowUps),
      teachers: mergeArrayById(baseRecord?.profile?.schoolSettings?.teachers, fallbackRecord?.profile?.schoolSettings?.teachers),
      complaints: mergeArrayById(baseRecord?.profile?.schoolSettings?.complaints, fallbackRecord?.profile?.schoolSettings?.complaints),
      actionPlans: mergeArrayById(baseRecord?.profile?.schoolSettings?.actionPlans, fallbackRecord?.profile?.schoolSettings?.actionPlans),
      parentComplaints: mergeArrayById(baseRecord?.profile?.schoolSettings?.parentComplaints, fallbackRecord?.profile?.schoolSettings?.parentComplaints),
      staffAttendanceRecords: mergeArrayById(baseRecord?.profile?.schoolSettings?.staffAttendanceRecords, fallbackRecord?.profile?.schoolSettings?.staffAttendanceRecords)
    } : undefined
  };

  return {
    id: 'singleton_teacher_settings',
    profile: mergedProfile,
    schedulingPreferences: {
      ...fallbackRecord?.schedulingPreferences,
      ...baseRecord?.schedulingPreferences
    },
    recentlyDeleted: mergeRecentlyDeleted(local?.recentlyDeleted, incoming?.recentlyDeleted),
    dismissedDashboardLessons: mergeDismissedDashboardLessons(local?.dismissedDashboardLessons, incoming?.dismissedDashboardLessons, true),
    updatedAt: Math.max(localTime, incomingTime, Date.now()),
    updatedByDeviceId: isIncomingNewer ? incoming?.updatedByDeviceId : local?.updatedByDeviceId,
    originDeviceId: isIncomingNewer ? incoming?.originDeviceId : local?.originDeviceId,
    originRevision: Math.max(local?.originRevision || 1, incoming?.originRevision || 1),
    deleted: false,
    syncedAt: Date.now()
  };
}

export interface WorkspaceMutableState {
  groups?: Group[];
  students?: Student[];
  lessons?: Lesson[];
  payments?: any[];
  financeTransactions?: any[];
  schoolNotes?: SchoolNote[];
  homeworkAssignments?: any[];
  homeworkSubmissions?: any[];
  notifications?: NotificationItem[];
  recentlyDeleted?: RecentlyDeletedData;
  settings?: TeacherSettingsRecord[];
  [key: string]: any;
}

/**
 * Centralized reverse-direction tombstone enforcement across an entire workspace object.
 * - Merges all available tombstones from `workspace.recentlyDeleted`, `workspace.settings[0].recentlyDeleted`, and `extraPurgedRecords`.
 * - Sweeps existing active and soft-deleted records in `groups`, `students`, `lessons`, `recentlyDeleted`, `schoolNotes`, `homeworkAssignments`, `homeworkSubmissions`, and `notifications`.
 * - Propagates cascade purge tombstones for any dependent students/lessons referencing a purged group or student.
 * - Preserves `payments` and `financeTransactions` intact for financial audit integrity.
 */
export function enforcePurgedTombstonesOnWorkspace<T extends WorkspaceMutableState>(
  workspace: T,
  extraPurgedRecords?: PurgedRecordTombstone[]
): T {
  if (!workspace || typeof workspace !== 'object') return workspace;

  const settingsRec = Array.isArray(workspace.settings)
    ? workspace.settings.find(s => s && s.id === 'singleton_teacher_settings')
    : undefined;

  let mergedRec = mergeRecentlyDeleted(workspace.recentlyDeleted, settingsRec?.recentlyDeleted);
  if (Array.isArray(extraPurgedRecords) && extraPurgedRecords.length > 0) {
    mergedRec = mergeRecentlyDeleted(mergedRec, {
      students: [],
      groups: [],
      lessons: [],
      purgedRecords: extraPurgedRecords
    });
  }

  const nowStr = new Date().toISOString();
  const nowMs = Date.now();
  const initialPurged = mergedRec.purgedRecords || [];

  const purgedGroupIds = new Set<string>();
  const purgedStudentIds = new Set<string>();
  const purgedLessonIds = new Set<string>();
  let maxRev = 1;

  for (const p of initialPurged) {
    if (!p || !p.id) continue;
    const pid = p.id.trim();
    if (p.type === 'group') purgedGroupIds.add(pid);
    if (p.type === 'student') purgedStudentIds.add(pid);
    if (p.type === 'lesson') purgedLessonIds.add(pid);
    if (typeof p.originRevision === 'number' && p.originRevision > maxRev) {
      maxRev = p.originRevision;
    }
  }

  const derivedTombstones: PurgedRecordTombstone[] = [];

  // Discover any active/soft-deleted students belonging to a purged group so they also get explicit tombstones
  const allStudentsToInspect: Student[] = [
    ...(Array.isArray(workspace.students) ? workspace.students : []),
    ...(Array.isArray(mergedRec.students) ? mergedRec.students.map(d => d.item) : [])
  ];
  for (const st of allStudentsToInspect) {
    if (!st || !st.id) continue;
    const sid = st.id.trim();
    const grpId = (st.groupId || st.archivedGroupId || '').trim();
    if (grpId && purgedGroupIds.has(grpId) && !purgedStudentIds.has(sid)) {
      purgedStudentIds.add(sid);
      derivedTombstones.push({
        id: sid,
        type: 'student',
        purgedAt: nowStr,
        updatedAt: nowMs,
        originRevision: maxRev
      });
    }
  }

  // Discover any active/soft-deleted lessons belonging to a purged group or purged student so they also get explicit tombstones
  const allLessonsToInspect: Lesson[] = [
    ...(Array.isArray(workspace.lessons) ? workspace.lessons : []),
    ...(Array.isArray(mergedRec.lessons) ? mergedRec.lessons.map(d => d.item) : [])
  ];
  for (const les of allLessonsToInspect) {
    if (!les || !les.id) continue;
    const lid = les.id.trim();
    const grpId = (les.groupId || '').trim();
    const stId = (les.studentId || '').trim();
    if (((grpId && purgedGroupIds.has(grpId)) || (stId && purgedStudentIds.has(stId))) && !purgedLessonIds.has(lid)) {
      purgedLessonIds.add(lid);
      derivedTombstones.push({
        id: lid,
        type: 'lesson',
        purgedAt: nowStr,
        updatedAt: nowMs,
        originRevision: maxRev
      });
    }
  }

  if (derivedTombstones.length > 0) {
    mergedRec = mergeRecentlyDeleted(mergedRec, {
      students: [],
      groups: [],
      lessons: [],
      purgedRecords: derivedTombstones
    });
  }

  const finalPurged = mergedRec.purgedRecords || [];
  const allPurgedIds = new Set<string>(finalPurged.map(p => p.id.trim()));

  if (Array.isArray(workspace.groups)) {
    workspace.groups = workspace.groups.filter(g => g && g.id && !allPurgedIds.has(g.id.trim()) && !purgedGroupIds.has(g.id.trim()));
  }

  if (Array.isArray(workspace.students)) {
    workspace.students = workspace.students.filter(s => {
      if (!s || !s.id) return false;
      const sid = s.id.trim();
      const grpId = (s.groupId || s.archivedGroupId || '').trim();
      return !allPurgedIds.has(sid) && !purgedStudentIds.has(sid) && (!grpId || !purgedGroupIds.has(grpId));
    });
  }

  if (Array.isArray(workspace.lessons)) {
    workspace.lessons = workspace.lessons.filter(l => {
      if (!l || !l.id) return false;
      const lid = l.id.trim();
      const grpId = (l.groupId || '').trim();
      const stId = (l.studentId || '').trim();
      return (
        !allPurgedIds.has(lid) &&
        !purgedLessonIds.has(lid) &&
        (!grpId || !purgedGroupIds.has(grpId)) &&
        (!stId || !purgedStudentIds.has(stId))
      );
    });
  }

  if (Array.isArray(workspace.schoolNotes)) {
    workspace.schoolNotes = workspace.schoolNotes.filter(n => {
      if (!n || !n.id) return false;
      const stId = (n.studentId || '').trim();
      const lesId = (n.lessonId || '').trim();
      return (!stId || !purgedStudentIds.has(stId)) && (!lesId || !purgedLessonIds.has(lesId));
    });
  }

  if (Array.isArray(workspace.homeworkAssignments)) {
    workspace.homeworkAssignments = workspace.homeworkAssignments.filter((hw: any) => {
      if (!hw || !hw.id) return false;
      const grpId = (hw.groupId || '').trim();
      const stId = (hw.studentId || '').trim();
      const lesId = (hw.lessonId || '').trim();
      return (
        (!grpId || !purgedGroupIds.has(grpId)) &&
        (!stId || !purgedStudentIds.has(stId)) &&
        (!lesId || !purgedLessonIds.has(lesId))
      );
    });
  }

  if (Array.isArray(workspace.homeworkSubmissions)) {
    workspace.homeworkSubmissions = workspace.homeworkSubmissions.filter((sub: any) => {
      if (!sub || !sub.id) return false;
      const grpId = (sub.groupId || '').trim();
      const stId = (sub.studentId || '').trim();
      const lesId = (sub.lessonId || '').trim();
      return (
        (!grpId || !purgedGroupIds.has(grpId)) &&
        (!stId || !purgedStudentIds.has(stId)) &&
        (!lesId || !purgedLessonIds.has(lesId))
      );
    });
  }

  if (Array.isArray(workspace.notifications)) {
    workspace.notifications = workspace.notifications.filter(notif => {
      if (!notif || !notif.id) return false;
      const lesId = (notif.lessonId || '').trim();
      return !lesId || !purgedLessonIds.has(lesId);
    });
  }

  // Reconcile cross-device restorations: if an item in workspace.{students,groups,lessons} is active (!deleted)
  // and has an updatedAt strictly newer than its soft-deletion timestamp in mergedRec, remove the stale trash entry.
  const activeStudentTimes = new Map<string, number>();
  if (Array.isArray(workspace.students)) {
    for (const s of workspace.students) {
      if (s && s.id && !s.deleted) {
        activeStudentTimes.set(s.id.trim(), parseTimestampMs(s.updatedAt));
      }
    }
  }
  const activeGroupTimes = new Map<string, number>();
  if (Array.isArray(workspace.groups)) {
    for (const g of workspace.groups) {
      if (g && g.id && !g.deleted) {
        activeGroupTimes.set(g.id.trim(), parseTimestampMs(g.updatedAt));
      }
    }
  }
  const activeLessonTimes = new Map<string, number>();
  if (Array.isArray(workspace.lessons)) {
    for (const l of workspace.lessons) {
      if (l && l.id && !l.deleted) {
        activeLessonTimes.set(l.id.trim(), parseTimestampMs(l.updatedAt));
      }
    }
  }

  mergedRec = {
    ...mergedRec,
    students: (mergedRec.students || []).filter(entry => {
      if (!entry?.item?.id) return false;
      const activeTs = activeStudentTimes.get(entry.item.id.trim());
      const deletedTs = Math.max(parseTimestampMs(entry.deletedAt), parseTimestampMs((entry.item as any)?.updatedAt));
      return activeTs === undefined || activeTs <= deletedTs;
    }),
    groups: (mergedRec.groups || []).filter(entry => {
      if (!entry?.item?.id) return false;
      const activeTs = activeGroupTimes.get(entry.item.id.trim());
      const deletedTs = Math.max(parseTimestampMs(entry.deletedAt), parseTimestampMs((entry.item as any)?.updatedAt));
      return activeTs === undefined || activeTs <= deletedTs;
    }),
    lessons: (mergedRec.lessons || []).filter(entry => {
      if (!entry?.item?.id) return false;
      const activeTs = activeLessonTimes.get(entry.item.id.trim());
      const deletedTs = Math.max(parseTimestampMs(entry.deletedAt), parseTimestampMs((entry.item as any)?.updatedAt));
      return activeTs === undefined || activeTs <= deletedTs;
    })
  };

  workspace.recentlyDeleted = mergedRec;

  if (Array.isArray(workspace.settings) && workspace.settings.length > 0) {
    workspace.settings = workspace.settings.map(s =>
      s && s.id === 'singleton_teacher_settings'
        ? { ...s, recentlyDeleted: mergedRec }
        : s
    );
  }

  return workspace;
}

/**
 * Executes an authoritative permanent deletion on a workspace state object with full cascade integrity.
 * - Creates terminal PurgedRecordTombstone entries for the target item and all dependent students/lessons.
 * - Sweeps active and soft-deleted collections (`groups`, `students`, `lessons`, `recentlyDeleted`, `schoolNotes`, `homeworkAssignments`, `homeworkSubmissions`, `notifications`).
 * - Preserves `payments` and `financeTransactions` intact.
 */
export function executePermanentDeleteOnWorkspace<T extends WorkspaceMutableState>(
  workspace: T,
  type: 'student' | 'group' | 'lesson',
  id: string,
  nextRevision?: number | (() => number),
  nowMsOverride?: number
): { workspace: T; addedTombstones: PurgedRecordTombstone[]; createdTombstones: PurgedRecordTombstone[] } {
  const targetId = (id || '').trim();
  const nowMs = typeof nowMsOverride === 'number' ? nowMsOverride : Date.now();
  const nowStr = new Date(nowMs).toISOString();
  const resolvedRev = typeof nextRevision === 'function' ? nextRevision() : nextRevision;
  const rev = typeof resolvedRev === 'number' && resolvedRev > 0 ? resolvedRev : 1;

  const newTombstones: PurgedRecordTombstone[] = [
    { id: targetId, type, purgedAt: nowStr, updatedAt: nowMs, originRevision: rev }
  ];

  const currentRec = workspace.recentlyDeleted || { students: [], groups: [], lessons: [], purgedRecords: [] };
  const allStudents: Student[] = [
    ...(Array.isArray(workspace.students) ? workspace.students : []),
    ...(Array.isArray(currentRec.students) ? currentRec.students.map(d => d.item) : [])
  ];
  const allLessons: Lesson[] = [
    ...(Array.isArray(workspace.lessons) ? workspace.lessons : []),
    ...(Array.isArray(currentRec.lessons) ? currentRec.lessons.map(d => d.item) : [])
  ];

  if (type === 'group') {
    const cascadedStudentIds = new Set<string>();
    for (const s of allStudents) {
      if (!s || !s.id) continue;
      if (s.groupId === targetId || s.archivedGroupId === targetId) {
        cascadedStudentIds.add(s.id.trim());
        newTombstones.push({
          id: s.id.trim(),
          type: 'student',
          purgedAt: nowStr,
          updatedAt: nowMs,
          originRevision: rev
        });
      }
    }
    for (const l of allLessons) {
      if (!l || !l.id) continue;
      if (l.groupId === targetId || (l.studentId && cascadedStudentIds.has(l.studentId.trim()))) {
        newTombstones.push({
          id: l.id.trim(),
          type: 'lesson',
          purgedAt: nowStr,
          updatedAt: nowMs,
          originRevision: rev
        });
      }
    }
  } else if (type === 'student') {
    for (const l of allLessons) {
      if (!l || !l.id) continue;
      if (l.studentId === targetId) {
        newTombstones.push({
          id: l.id.trim(),
          type: 'lesson',
          purgedAt: nowStr,
          updatedAt: nowMs,
          originRevision: rev
        });
      }
    }
  }

  enforcePurgedTombstonesOnWorkspace(workspace, newTombstones);
  return { workspace, addedTombstones: newTombstones, createdTombstones: newTombstones };
}

/**
 * Executes `clearRecentlyDeleted` across a workspace state object, creating terminal tombstones
 * for all items in `recentlyDeleted` plus any cascade children, and sweeping all active/soft-deleted collections.
 */
export function executeClearRecentlyDeletedOnWorkspace<T extends WorkspaceMutableState>(
  workspace: T,
  nextRevision?: number | (() => number),
  nowMsOverride?: number
): { workspace: T; addedTombstones: PurgedRecordTombstone[]; createdTombstones: PurgedRecordTombstone[] } {
  const nowMs = typeof nowMsOverride === 'number' ? nowMsOverride : Date.now();
  const nowStr = new Date(nowMs).toISOString();
  const resolvedRev = typeof nextRevision === 'function' ? nextRevision() : nextRevision;
  const rev = typeof resolvedRev === 'number' && resolvedRev > 0 ? resolvedRev : 1;
  const currentRec = workspace.recentlyDeleted || { students: [], groups: [], lessons: [], purgedRecords: [] };

  const purgedGroupIds = new Set<string>(
    Array.isArray(currentRec.groups) ? currentRec.groups.filter(g => g?.item?.id).map(g => g.item.id.trim()) : []
  );
  const purgedStudentIds = new Set<string>(
    Array.isArray(currentRec.students) ? currentRec.students.filter(s => s?.item?.id).map(s => s.item.id.trim()) : []
  );

  const allStudents: Student[] = [
    ...(Array.isArray(workspace.students) ? workspace.students : []),
    ...(Array.isArray(currentRec.students) ? currentRec.students.map(d => d.item) : [])
  ];
  for (const s of allStudents) {
    if (!s || !s.id) continue;
    const grpId = (s.groupId || s.archivedGroupId || '').trim();
    if (grpId && purgedGroupIds.has(grpId)) {
      purgedStudentIds.add(s.id.trim());
    }
  }

  const purgedLessonIds = new Set<string>(
    Array.isArray(currentRec.lessons) ? currentRec.lessons.filter(l => l?.item?.id).map(l => l.item.id.trim()) : []
  );
  const allLessons: Lesson[] = [
    ...(Array.isArray(workspace.lessons) ? workspace.lessons : []),
    ...(Array.isArray(currentRec.lessons) ? currentRec.lessons.map(d => d.item) : [])
  ];
  for (const l of allLessons) {
    if (!l || !l.id) continue;
    const grpId = (l.groupId || '').trim();
    const stId = (l.studentId || '').trim();
    if ((grpId && purgedGroupIds.has(grpId)) || (stId && purgedStudentIds.has(stId))) {
      purgedLessonIds.add(l.id.trim());
    }
  }

  const newTombstones: PurgedRecordTombstone[] = [
    ...Array.from(purgedGroupIds).map(gid => ({
      id: gid,
      type: 'group' as const,
      purgedAt: nowStr,
      updatedAt: nowMs,
      originRevision: rev
    })),
    ...Array.from(purgedStudentIds).map(sid => ({
      id: sid,
      type: 'student' as const,
      purgedAt: nowStr,
      updatedAt: nowMs,
      originRevision: rev
    })),
    ...Array.from(purgedLessonIds).map(lid => ({
      id: lid,
      type: 'lesson' as const,
      purgedAt: nowStr,
      updatedAt: nowMs,
      originRevision: rev
    }))
  ];

  workspace.recentlyDeleted = {
    students: [],
    groups: [],
    lessons: [],
    purgedRecords: mergePurgedTombstones(currentRec.purgedRecords, newTombstones)
  };

  enforcePurgedTombstonesOnWorkspace(workspace, newTombstones);
  return { workspace, addedTombstones: newTombstones, createdTombstones: newTombstones };
}

/**
 * Executes safe restoration of a soft-deleted item from `recentlyDeleted` on a workspace state object.
 * - Strictly refuses to restore any item whose ID (or parent group/student ID) exists in `recentlyDeleted.purgedRecords`.
 * - NEVER removes any tombstone from `purgedRecords`.
 */
export function executeRestoreItemOnWorkspace<T extends WorkspaceMutableState>(
  workspace: T,
  type: 'student' | 'group' | 'lesson',
  id: string,
  wrapMutationFn?: <R extends SyncableRecord>(item: R) => R
): { workspace: T; restored: boolean } {
  const targetId = (id || '').trim();
  const currentRec = workspace.recentlyDeleted || { students: [], groups: [], lessons: [], purgedRecords: [] };
  const purgedList = Array.isArray(currentRec.purgedRecords) ? currentRec.purgedRecords : [];
  const purgedIds = new Set<string>(purgedList.filter(p => p && p.id).map(p => p.id.trim()));
  const purgedGroupIds = new Set<string>(purgedList.filter(p => p && p.id && p.type === 'group').map(p => p.id.trim()));
  const purgedStudentIds = new Set<string>(purgedList.filter(p => p && p.id && p.type === 'student').map(p => p.id.trim()));

  // Terminal Purge Rule: if the item itself is permanently purged, restoration is strictly forbidden
  if (purgedIds.has(targetId)) {
    enforcePurgedTombstonesOnWorkspace(workspace);
    return { workspace, restored: false };
  }

  const mutate = <R extends SyncableRecord>(item: R): R => {
    if (wrapMutationFn) return wrapMutationFn(item);
    return {
      ...item,
      deleted: false,
      updatedAt: Date.now(),
      version: ((item as any).version || 1) + 1,
      originRevision: (item.originRevision || 1) + 1
    };
  };

  if (type === 'student') {
    const target = (currentRec.students || []).find(d => d?.item?.id === targetId);
    if (!target) return { workspace, restored: false };
    const parentGrp = (target.item.groupId || target.item.archivedGroupId || '').trim();
    if (parentGrp && purgedGroupIds.has(parentGrp)) {
      return { workspace, restored: false };
    }

    const restoredStudent = mutate({ ...target.item, deleted: false } as Student);
    const prevStudents = Array.isArray(workspace.students) ? workspace.students : [];
    const exists = prevStudents.some(s => s.id === targetId);
    workspace.students = exists
      ? prevStudents.map(s => (s.id === targetId ? restoredStudent : s))
      : [...prevStudents, restoredStudent];

    workspace.recentlyDeleted = {
      ...currentRec,
      students: (currentRec.students || []).filter(d => d?.item?.id !== targetId),
      purgedRecords: purgedList // NEVER remove tombstones from purgedRecords
    };
    return { workspace, restored: true };
  } else if (type === 'group') {
    const target = (currentRec.groups || []).find(d => d?.item?.id === targetId);
    if (!target) return { workspace, restored: false };

    const restoredGroup = mutate({ ...target.item, deleted: false } as Group);
    const prevGroups = Array.isArray(workspace.groups) ? workspace.groups : [];
    const exists = prevGroups.some(g => g.id === targetId);
    workspace.groups = exists
      ? prevGroups.map(g => (g.id === targetId ? restoredGroup : g))
      : [...prevGroups, restoredGroup];

    // Restore linked non-purged soft-deleted students belonging to this group
    const linkedStudents = (currentRec.students || []).filter(
      d => d?.item && (d.item.groupId === targetId || d.item.archivedGroupId === targetId) && !purgedIds.has(d.item.id.trim())
    );
    const linkedStudentIds = new Set(linkedStudents.map(d => d.item.id));
    if (linkedStudents.length > 0) {
      const prevStudents = Array.isArray(workspace.students) ? workspace.students : [];
      const existingIds = new Set(prevStudents.map(s => s.id));
      const newlyRestored = linkedStudents
        .filter(d => !existingIds.has(d.item.id))
        .map(d => mutate({ ...d.item, groupId: targetId, deleted: false } as Student));
      workspace.students = [
        ...prevStudents.map(s =>
          linkedStudentIds.has(s.id) ? mutate({ ...s, groupId: targetId, deleted: false } as Student) : s
        ),
        ...newlyRestored
      ];
    }

    // Restore linked non-purged soft-deleted lessons belonging to this group
    const linkedLessons = (currentRec.lessons || []).filter(
      d =>
        d?.item &&
        d.item.groupId === targetId &&
        !purgedIds.has(d.item.id.trim()) &&
        (!d.item.studentId || !purgedStudentIds.has(d.item.studentId.trim()))
    );
    const linkedLessonIds = new Set(linkedLessons.map(d => d.item.id));
    if (linkedLessons.length > 0) {
      const prevLessons = Array.isArray(workspace.lessons) ? workspace.lessons : [];
      const existingIds = new Set(prevLessons.map(l => l.id));
      const newlyRestored = linkedLessons
        .filter(d => !existingIds.has(d.item.id))
        .map(d => mutate({ ...d.item, deleted: false } as Lesson));
      workspace.lessons = [
        ...prevLessons.map(l => (linkedLessonIds.has(l.id) ? mutate({ ...l, deleted: false } as Lesson) : l)),
        ...newlyRestored
      ];
    }

    workspace.recentlyDeleted = {
      ...currentRec,
      groups: (currentRec.groups || []).filter(d => d?.item?.id !== targetId),
      students: (currentRec.students || []).filter(d => !linkedStudentIds.has(d?.item?.id)),
      lessons: (currentRec.lessons || []).filter(d => !linkedLessonIds.has(d?.item?.id)),
      purgedRecords: purgedList // NEVER remove tombstones from purgedRecords
    };
    return { workspace, restored: true };
  } else if (type === 'lesson') {
    const target = (currentRec.lessons || []).find(d => d?.item?.id === targetId);
    if (!target) return { workspace, restored: false };
    const parentGrp = (target.item.groupId || '').trim();
    const parentSt = (target.item.studentId || '').trim();
    if ((parentGrp && purgedGroupIds.has(parentGrp)) || (parentSt && purgedStudentIds.has(parentSt))) {
      return { workspace, restored: false };
    }

    const restoredLesson = mutate({ ...target.item, deleted: false } as Lesson);
    const prevLessons = Array.isArray(workspace.lessons) ? workspace.lessons : [];
    const exists = prevLessons.some(l => l.id === targetId);
    workspace.lessons = exists
      ? prevLessons.map(l => (l.id === targetId ? restoredLesson : l))
      : [...prevLessons, restoredLesson];

    workspace.recentlyDeleted = {
      ...currentRec,
      lessons: (currentRec.lessons || []).filter(d => d?.item?.id !== targetId),
      purgedRecords: purgedList // NEVER remove tombstones from purgedRecords
    };
    return { workspace, restored: true };
  }

  return { workspace, restored: false };
}

