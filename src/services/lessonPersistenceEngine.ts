import {
  Group,
  Lesson,
  LessonReport,
  LessonStatus,
  PaymentStatus,
  Student,
  StudentPaymentDetail
} from '../types';
import {
  deduplicateLessonList,
  normalizeTime,
  pickAuthoritativeLesson,
  resequenceScheduledLessonsAfterChange,
  resolveLessonCycleNumber,
  shouldRetainLessonInActiveWindow
} from '../utils/lessonUtils';
import { formatLocalDate, normalizeDateToISO } from '../utils/timeUtils';

export type LessonMergeMode = 'react_sync' | 'cloud_sync';

function getLessonStatusRank(status?: LessonStatus | string): number {
  switch (status) {
    case 'completed':
      return 100;
    case 'cancelled':
      return 80;
    case 'in_progress':
      return 60;
    case 'pending_action':
      return 40;
    case 'scheduled':
      return 20;
    default:
      return 0;
  }
}

function getNumericTimestamp(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * Normalizes student payment entries from either LessonReport `{ status, amount }`
 * or canonical `StudentPaymentDetail` into canonical `StudentPaymentDetail` records.
 */
export function normalizeStudentPaymentsForLesson(
  rawPayments: Record<string, any> | undefined,
  students: Student[],
  fallbackAmountDue = 200
): Record<string, StudentPaymentDetail> | undefined {
  if (!rawPayments || typeof rawPayments !== 'object') return undefined;
  const entries = Object.entries(rawPayments);
  if (entries.length === 0) return undefined;

  const result: Record<string, StudentPaymentDetail> = {};
  for (const [stId, raw] of entries) {
    if (!raw || typeof raw !== 'object') continue;
    const stObj = students.find((s) => s.id === stId);
    const paymentStatus: PaymentStatus =
      raw.paymentStatus || raw.status || 'pending';
    const amountPaid = Number(raw.amountPaid ?? raw.amount ?? 0);
    const amountDue = Number(raw.amountDue ?? fallbackAmountDue);
    result[stId] = {
      studentId: raw.studentId || stId,
      studentName: raw.studentName || stObj?.name || 'Schüler',
      paymentStatus,
      amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
      amountDue: Number.isFinite(amountDue) ? amountDue : fallbackAmountDue,
      ...(raw.paidAt ? { paidAt: raw.paidAt } : {})
    };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Merges two versions of the SAME lesson ID monotonically so a stale React state render
 * or stale cloud sync snapshot can NEVER overwrite a newer completion, report, payment,
 * recording link, or timestamp.
 */
export function mergeLessonRecordMonotonically(
  existing: Lesson,
  incoming: Lesson,
  mode: LessonMergeMode
): Lesson {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingTs = getNumericTimestamp(existing.updatedAt);
  const incomingTs = getNumericTimestamp(incoming.updatedAt);
  const existingRank = getLessonStatusRank(existing.status);
  const incomingRank = getLessonStatusRank(incoming.status);

  // Stale React render snapshot guard:
  // If `existing` in fullLessonsRef/storage is strictly newer than `incoming` from a stale
  // React render, NEVER let the stale render revert it.
  if (mode === 'react_sync') {
    if (existingTs > incomingTs) {
      return existing;
    }
    // Even if timestamps are equal (e.g. same millisecond rapid completions A + B),
    // never downgrade a completed/cancelled/deleted lesson back to scheduled!
    if (existingTs === incomingTs) {
      if (existing.deleted && !incoming.deleted) return existing;
      if (existingRank > incomingRank) return existing;
      if (existing.status === 'completed' && !incoming.report && existing.report) {
        return existing;
      }
    }
    return incoming;
  }

  // Cloud sync reconciliation guard:
  // A stale remote `scheduled` record must never overwrite a locally `completed` lesson
  // unless the remote record explicitly carries a strictly newer status timestamp.
  const existingStatusTs = getNumericTimestamp((existing as any).fieldTimestamps?.status) || existingTs;
  const incomingStatusTs = getNumericTimestamp((incoming as any).fieldTimestamps?.status) || incomingTs;

  if (existing.status === 'completed' && incoming.status === 'scheduled' && incomingStatusTs <= existingStatusTs) {
    return existing;
  }

  if (existingTs > incomingTs) {
    const merged: Lesson = {
      ...incoming,
      ...existing,
      report: existing.report || incoming.report,
      recordingLink: existing.recordingLink || incoming.recordingLink,
      recordingLink2: existing.recordingLink2 || incoming.recordingLink2,
      zoomMeetingLink: existing.zoomMeetingLink || incoming.zoomMeetingLink
    };
    return merged;
  }

  // Incoming is newer or equal: keep incoming, but preserve paid/report data if incoming lacked them
  if (incoming.status === 'completed' && existing.status === 'completed') {
    return pickAuthoritativeLesson(incoming, existing).survivor as Lesson;
  }

  return incoming;
}

/**
 * Merges an incoming active/cloud lesson array into the authoritative full lesson list
 * without losing historical lessons and without allowing stale snapshots to revert newer writes.
 */
export function mergeLessonListsMonotonically(
  existingList: Lesson[],
  incomingList: Lesson[],
  prunedIds: Set<string>,
  mode: LessonMergeMode
): Lesson[] {
  const safeExisting = Array.isArray(existingList) ? existingList : [];
  const safeIncoming = Array.isArray(incomingList) ? incomingList : [];

  const incomingMap = new Map<string, Lesson>();
  for (const item of safeIncoming) {
    if (item && item.id && !prunedIds.has(item.id)) {
      const prev = incomingMap.get(item.id);
      incomingMap.set(item.id, prev ? mergeLessonRecordMonotonically(prev, item, mode) : item);
    }
  }

  const seen = new Set<string>();
  const merged: Lesson[] = [];

  for (const existing of safeExisting) {
    if (!existing || !existing.id || prunedIds.has(existing.id)) continue;
    if (seen.has(existing.id)) continue;
    seen.add(existing.id);

    const inc = incomingMap.get(existing.id);
    if (inc) {
      merged.push(mergeLessonRecordMonotonically(existing, inc, mode));
    } else {
      // Preserve historical / off-window / unmentioned lessons in storage
      merged.push(existing);
    }
  }

  for (const [id, inc] of incomingMap.entries()) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(inc);
    }
  }

  return merged;
}

/**
 * Filters lessons to the active RAM window while deduplicating ONLY exact same-slot
 * collisions (normalized groupId + date + non-empty time). Distinct times on the same
 * date are ALWAYS preserved, and `completed` strictly outranks `cancelled`/`scheduled`.
 */
export function filterActiveLessonsList(
  raw: Lesson[],
  students: Student[],
  groups: Group[],
  referenceDate: Date = new Date()
): Lesson[] {
  const sixtyDaysAgo = new Date(referenceDate.getTime());
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const cutoffStr = formatLocalDate(sixtyDaysAgo);

  const oneYearAgo = new Date(referenceDate.getTime());
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const maxCutoffStr = formatLocalDate(oneYearAgo);

  const filtered = (Array.isArray(raw) ? raw : []).filter((l) =>
    shouldRetainLessonInActiveWindow(l, cutoffStr, maxCutoffStr, students, groups)
  );

  const getSlotKey = (lesson: Lesson): string | null => {
    if (!lesson.groupId || lesson.groupId === 'quick_group') return null;
    const normDate = normalizeDateToISO(lesson.date) || (lesson.date || '').trim();
    const normTime = normalizeTime(lesson.time);
    // Only collapse lessons that share the EXACT same group, normalized date, AND non-empty normalized time.
    // Distinct times (or untimed distinct records) must NEVER be collapsed into each other.
    if (!normDate || !normTime) return null;
    return `${lesson.groupId}_${normDate}_${normTime}`;
  };

  const bestBySlot = new Map<string, Lesson>();
  for (const lesson of filtered) {
    if (!lesson || !lesson.id) continue;
    const key = getSlotKey(lesson);
    if (!key) continue;
    const existingBest = bestBySlot.get(key);
    if (!existingBest) {
      bestBySlot.set(key, lesson);
    } else {
      bestBySlot.set(key, pickAuthoritativeLesson(existingBest, lesson).survivor as Lesson);
    }
  }

  const seenIds = new Set<string>();
  const result: Lesson[] = [];
  for (const lesson of filtered) {
    if (!lesson || !lesson.id || seenIds.has(lesson.id)) continue;
    const key = getSlotKey(lesson);
    if (key) {
      const winner = bestBySlot.get(key);
      if (!winner || winner.id !== lesson.id) continue;
      seenIds.add(winner.id);
      result.push(winner);
      continue;
    }
    seenIds.add(lesson.id);
    result.push(lesson);
  }

  return result;
}

export interface LessonStorageAdapter {
  getItem: <T>(key: string) => Promise<T | null>;
  setItem: (key: string, value: any) => Promise<void>;
}

export interface LessonPersistenceControllerDeps {
  storage: LessonStorageAdapter;
  getGroups: () => Group[];
  getStudents: () => Student[];
  getPrunedLessonIds: () => Set<string>;
  wrapMutation: <T extends Record<string, any>>(item: T) => T;
  stampFieldTimestamps: <T extends Record<string, any>>(prev: T | undefined, next: T) => T;
  onActiveLessonsChanged?: (activeLessons: Lesson[], fullLessons: Lesson[]) => void;
}

/**
 * Shared production lesson persistence controller used directly by AppContext (and verified
 * end-to-end by integration tests). Guarantees serialized writes, monotonic merges,
 * zero cross-lesson completion regressions, and full metadata preservation across storage reloads.
 */
export function createLessonPersistenceController(deps: LessonPersistenceControllerDeps) {
  let fullLessons: Lesson[] = [];
  let queue: Promise<any> = Promise.resolve();

  const dedupeStrictById = (list: Lesson[]): Lesson[] => {
    const seen = new Set<string>();
    const deduped: Lesson[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i];
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        deduped.unshift(item);
      }
    }
    return deduped;
  };

  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work, work);
    // Keep queue alive even if a single operation throws so subsequent saves are never blocked
    queue = run.catch(() => {});
    return run;
  };

  const hydrateFromStorage = async (): Promise<{ full: Lesson[]; active: Lesson[] }> => {
    return enqueue(async () => {
      const saved = await deps.storage.getItem<Lesson[]>('dl_lessons');
      const raw = Array.isArray(saved) ? saved : [];
      const prunedIds = deps.getPrunedLessonIds();
      const filtered = raw.filter((l) => l && l.id && !prunedIds.has(l.id));
      const { deduplicated } = deduplicateLessonList(dedupeStrictById(filtered), deps.getStudents());
      fullLessons = deduplicated;
      const active = filterActiveLessonsList(deduplicated, deps.getStudents(), deps.getGroups());
      deps.onActiveLessonsChanged?.(active, deduplicated);
      return { full: deduplicated, active };
    });
  };

  const updateFullLessons = async (
    updater: (allLessons: Lesson[]) => Lesson[],
    fallbackLessons: Lesson[] = []
  ): Promise<Lesson[]> => {
    return enqueue(async () => {
      const base =
        fullLessons.length > 0
          ? fullLessons
          : (await deps.storage.getItem<Lesson[]>('dl_lessons')) || fallbackLessons;
      const rawUpdated = updater(Array.isArray(base) ? base : []);
      const dedupedById = dedupeStrictById(rawUpdated);
      const { deduplicated } = deduplicateLessonList(dedupedById, deps.getStudents());
      fullLessons = deduplicated;
      const active = filterActiveLessonsList(deduplicated, deps.getStudents(), deps.getGroups());
      deps.onActiveLessonsChanged?.(active, deduplicated);
      await deps.storage.setItem('dl_lessons', deduplicated);
      return deduplicated;
    });
  };

  const syncActiveSnapshot = async (activeSnapshot: Lesson[]): Promise<Lesson[]> => {
    return enqueue(async () => {
      const persisted =
        fullLessons.length > 0
          ? fullLessons
          : (await deps.storage.getItem<Lesson[]>('dl_lessons')) || [];
      const merged = mergeLessonListsMonotonically(
        persisted,
        activeSnapshot,
        deps.getPrunedLessonIds(),
        'react_sync'
      );
      const { deduplicated } = deduplicateLessonList(dedupeStrictById(merged), deps.getStudents());
      fullLessons = deduplicated;
      await deps.storage.setItem('dl_lessons', deduplicated);
      return deduplicated;
    });
  };

  const reconcileCloudSnapshot = async (incomingCloudLessons: Lesson[]): Promise<Lesson[]> => {
    return enqueue(async () => {
      const persisted =
        fullLessons.length > 0
          ? fullLessons
          : (await deps.storage.getItem<Lesson[]>('dl_lessons')) || [];
      const merged = mergeLessonListsMonotonically(
        persisted,
        incomingCloudLessons,
        deps.getPrunedLessonIds(),
        'cloud_sync'
      );
      const { deduplicated } = deduplicateLessonList(dedupeStrictById(merged), deps.getStudents());
      fullLessons = deduplicated;
      const active = filterActiveLessonsList(deduplicated, deps.getStudents(), deps.getGroups());
      deps.onActiveLessonsChanged?.(active, deduplicated);
      await deps.storage.setItem('dl_lessons', deduplicated);
      return deduplicated;
    });
  };

  const saveLessonReport = async (params: {
    lessonId: string;
    report: LessonReport;
    packageCount?: number;
    sessionNumber?: number;
    lessonSnapshot?: Lesson;
    extraLessonUpdates?: Partial<Lesson>;
  }): Promise<{ lessons: Lesson[]; completedLesson?: Lesson }> => {
    let completedLesson: Lesson | undefined;
    const nextLessons = await updateFullLessons((allLessons) => {
      const groups = deps.getGroups();
      const students = deps.getStudents();
      const targetLesson =
        allLessons.find((l) => l.id === params.lessonId) || params.lessonSnapshot;
      if (!targetLesson) return allLessons;

      const targetGroup = groups.find(
        (g) =>
          g.id === targetLesson.groupId ||
          (g.name &&
            targetLesson.groupId &&
            g.name.trim().toLowerCase() === targetLesson.groupId.trim().toLowerCase())
      );
      const targetStudentObj = students.find(
        (s) =>
          (targetLesson.studentId && s.id === targetLesson.studentId) ||
          (targetLesson.studentName && s.name === targetLesson.studentName)
      );

      const cycleRes = resolveLessonCycleNumber(targetLesson, allLessons, {
        group: targetGroup,
        student: targetStudentObj,
        students
      });
      const isPerLesson = cycleRes.isPerLesson;
      const finalSessionNumber = isPerLesson
        ? 1
        : params.sessionNumber !== undefined && params.sessionNumber > 0
        ? params.sessionNumber
        : cycleRes.sessionNumber;
      const updatedTotalSessions = isPerLesson
        ? 1
        : targetGroup?.sessionCount || params.packageCount || cycleRes.totalCycleSessions || 4;

      const normalizedPayments = normalizeStudentPaymentsForLesson(
        params.report.studentPayments as any,
        students,
        targetLesson.amountDue || 200
      );

      const extraUpdates = params.extraLessonUpdates || {};
      const safeExtraUpdates: Partial<Lesson> = { ...extraUpdates };
      if (safeExtraUpdates.studentPayments) {
        const normalizedExtra = normalizeStudentPaymentsForLesson(
          safeExtraUpdates.studentPayments as any,
          students,
          targetLesson.amountDue || 200
        );
        if (normalizedExtra) {
          safeExtraUpdates.studentPayments = normalizedExtra;
        } else {
          delete safeExtraUpdates.studentPayments;
        }
      }

      const buildCompleted = (base: Lesson): Lesson => {
        const mutated = deps.wrapMutation({
          ...base,
          ...safeExtraUpdates,
          status: 'completed' as LessonStatus,
          isAutoGenerated: false,
          sessionNumber: finalSessionNumber,
          totalSessionsInPackage: updatedTotalSessions,
          topic: params.report.arabicTopicsExplained || params.report.teacherNotes || (base as any).topic,
          paymentStatus:
            params.report.paymentStatus !== undefined
              ? params.report.paymentStatus
              : base.paymentStatus || 'pending',
          amountPaid:
            params.report.amountPaid !== undefined
              ? params.report.amountPaid
              : base.amountPaid ?? 0,
          recordingLink:
            safeExtraUpdates.recordingLink !== undefined
              ? safeExtraUpdates.recordingLink
              : params.report.recordingLink !== undefined
              ? params.report.recordingLink
              : base.recordingLink,
          recordingLink2:
            safeExtraUpdates.recordingLink2 !== undefined
              ? safeExtraUpdates.recordingLink2
              : params.report.recordingLink2 !== undefined
              ? params.report.recordingLink2
              : base.recordingLink2,
          studentPayments: normalizedPayments || safeExtraUpdates.studentPayments || base.studentPayments,
          report: params.report
        } as Lesson);
        return deps.stampFieldTimestamps(base, mutated);
      };

      let found = false;
      const updated = allLessons.map((l) => {
        if (l.id === params.lessonId) {
          found = true;
          completedLesson = buildCompleted(l);
          return completedLesson;
        }
        return l;
      });

      const withCompleted = !found
        ? (() => {
            completedLesson = buildCompleted(targetLesson);
            return [completedLesson, ...updated];
          })()
        : updated;

      const sequenceChanged =
        !found ||
        targetLesson.sessionNumber !== finalSessionNumber ||
        targetLesson.totalSessionsInPackage !== updatedTotalSessions;

      if (!sequenceChanged) {
        return withCompleted;
      }

      return resequenceScheduledLessonsAfterChange(withCompleted, completedLesson, {
        group: targetGroup,
        student: targetStudentObj,
        students,
        wrapMutation: deps.wrapMutation
      });
    });

    return { lessons: nextLessons, completedLesson };
  };

  const updateLesson = async (params: {
    lessonId: string;
    updates: Partial<Lesson>;
    lessonSnapshot?: Lesson;
  }): Promise<Lesson[]> => {
    return updateFullLessons((allLessons) => {
      const groups = deps.getGroups();
      const students = deps.getStudents();
      const sanitizedUpdates: Partial<Lesson> = { ...params.updates };
      if (sanitizedUpdates.studentPayments) {
        const normalized = normalizeStudentPaymentsForLesson(
          sanitizedUpdates.studentPayments as any,
          students
        );
        if (normalized) {
          sanitizedUpdates.studentPayments = normalized;
        } else {
          delete sanitizedUpdates.studentPayments;
        }
      }

      let found = false;
      let targetItem: Lesson | undefined;
      let previousStatus: LessonStatus | undefined;
      let previousDate: string | undefined;
      let previousTime: string | undefined;
      let previousGroupId: string | undefined;
      let previousGroupName: string | undefined;

      const isExplicitFieldEdit =
        sanitizedUpdates.status !== undefined ||
        sanitizedUpdates.date !== undefined ||
        sanitizedUpdates.time !== undefined ||
        sanitizedUpdates.report !== undefined;

      let updated = allLessons.map((l) => {
        if (l.id === params.lessonId) {
          found = true;
          previousStatus = l.status;
          previousDate = l.date;
          previousTime = l.time;
          previousGroupId = l.groupId;
          previousGroupName = l.groupName;
          const nextRaw = {
            ...l,
            ...sanitizedUpdates,
            ...(isExplicitFieldEdit ? { isAutoGenerated: false } : {})
          } as Lesson;
          const mutated = deps.stampFieldTimestamps(l, deps.wrapMutation(nextRaw));
          targetItem = mutated;
          return mutated;
        }
        return l;
      });

      if (!found && params.lessonSnapshot) {
        const base = params.lessonSnapshot;
        previousStatus = base.status;
        previousDate = base.date;
        previousTime = base.time;
        previousGroupId = base.groupId;
        previousGroupName = base.groupName;
        const nextRaw = {
          ...base,
          ...sanitizedUpdates,
          ...(isExplicitFieldEdit ? { isAutoGenerated: false } : {})
        } as Lesson;
        const mutated = deps.stampFieldTimestamps(base, deps.wrapMutation(nextRaw));
        targetItem = mutated;
        updated = [mutated, ...updated];
      }

      const requiresResequence =
        sanitizedUpdates.status === 'cancelled' ||
        (previousStatus === 'cancelled' && Boolean(sanitizedUpdates.status)) ||
        (sanitizedUpdates.date !== undefined && sanitizedUpdates.date !== previousDate) ||
        (sanitizedUpdates.time !== undefined && sanitizedUpdates.time !== previousTime) ||
        sanitizedUpdates.groupId !== undefined ||
        sanitizedUpdates.studentId !== undefined;

      if (requiresResequence && targetItem) {
        if (sanitizedUpdates.groupId !== undefined && previousGroupId && sanitizedUpdates.groupId !== previousGroupId) {
          const prevGrp = groups.find(
            (g) => g.id === previousGroupId || (previousGroupName && g.name === previousGroupName)
          );
          updated = resequenceScheduledLessonsAfterChange(
            updated,
            { groupId: previousGroupId, groupName: prevGrp?.name || previousGroupName },
            { group: prevGrp, students, wrapMutation: deps.wrapMutation }
          );
        }
        const grp = groups.find(
          (g) =>
            (targetItem?.groupId && g.id === targetItem.groupId) ||
            (targetItem?.groupName && g.name === targetItem.groupName)
        );
        const st = students.find(
          (s) =>
            (targetItem?.studentId && s.id === targetItem.studentId) ||
            (targetItem?.studentName && s.name === targetItem.studentName)
        );
        updated = resequenceScheduledLessonsAfterChange(updated, targetItem, {
          group: grp,
          student: st,
          students,
          wrapMutation: deps.wrapMutation
        });
      }

      return updated;
    });
  };

  return {
    getFullLessons: () => fullLessons,
    setInitialFullLessons: (list: Lesson[]) => {
      fullLessons = Array.isArray(list) ? list : [];
    },
    hydrateFromStorage,
    updateFullLessons,
    syncActiveSnapshot,
    reconcileCloudSnapshot,
    saveLessonReport,
    updateLesson
  };
}
