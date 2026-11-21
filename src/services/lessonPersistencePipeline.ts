import type { Lesson, Group, Student, LessonReport } from '../types';
import { applyLessonCompletionMutation, deduplicateLessonList, isPendingStatus, resequenceScheduledLessonsAfterChange } from '../utils/lessonUtils';
import { preserveCompletedLessonStatuses } from '../utils/lessonSync';
import { normalizeDateToISO } from '../utils/timeUtils';


export const filterActiveLessonRows = (
  raw: Lesson[],
  cutoffStr: string,
  maxCutoffStr: string,
  students: Student[],
  groups: Group[]
): Lesson[] => {
  const sourceRows = Array.isArray(raw) ? raw : [];
  const cutoffIso = normalizeDateToISO(cutoffStr);
  const maxCutoffIso = normalizeDateToISO(maxCutoffStr);

  const nonDeletedGroupById = new Map<string, Group>();
  const activeGroupById = new Map<string, Group>();
  for (const g of groups || []) {
    if (!g || g.deleted || !g.id) continue;
    if (!nonDeletedGroupById.has(g.id)) nonDeletedGroupById.set(g.id, g);
    if (g.status !== 'archived' && !activeGroupById.has(g.id)) activeGroupById.set(g.id, g);
  }

  const studentById = new Map<string, Student>();
  const studentsByName = new Map<string, Student[]>();
  const studentsByGroupId = new Map<string, Student[]>();
  for (const s of students || []) {
    if (!s || s.deleted || s.status === 'archived') continue;
    if (s.id && !studentById.has(s.id)) studentById.set(s.id, s);
    if (s.name) {
      let arr = studentsByName.get(s.name);
      if (!arr) {
        arr = [];
        studentsByName.set(s.name, arr);
      }
      arr.push(s);
    }
    if (s.groupId) {
      let arr = studentsByGroupId.get(s.groupId);
      if (!arr) {
        arr = [];
        studentsByGroupId.set(s.groupId, arr);
      }
      arr.push(s);
    }
  }

  const isStudentUnpaidObligation = (st: Student, lesson: Lesson, grp: Group | undefined): boolean => {
    if (String(st.paymentStatus || '') === 'exempted' || Boolean((st as any).isExempt)) {
      return false;
    }
    const hasCustomZero = st.customBundlePrice !== undefined && st.customBundlePrice !== null && st.customBundlePrice <= 0;
    const hasPerLessonZero = st.pricePerLesson !== undefined && st.pricePerLesson !== null && st.pricePerLesson <= 0;
    const hasMonthlyZero = st.monthlyFee !== undefined && st.monthlyFee !== null && st.monthlyFee <= 0;
    if (hasCustomZero || (!grp && (hasPerLessonZero || hasMonthlyZero))) {
      return false;
    }
    if (grp) {
      const grpPkg = grp.monthlyPackagePrice ?? 0;
      const grpSess = grp.pricePerSession ?? 0;
      const stCustomPos = (st.customBundlePrice ?? 0) > 0;
      if (grpPkg <= 0 && grpSess <= 0 && !stCustomPos) {
        return false;
      }
    }
    const att = lesson.report?.studentAttendance?.[st.id] || lesson.report?.attendanceStatus || 'present';
    if (att === 'absent') return false;

    const spObj = lesson.studentPayments?.[st.id] as any;
    const repSpObj = lesson.report?.studentPayments?.[st.id] as any;
    const stLessonPayStatus = String(
      spObj?.paymentStatus || spObj?.status || repSpObj?.paymentStatus || repSpObj?.status || ''
    );
    if (stLessonPayStatus === 'paid' || stLessonPayStatus === 'exempted') {
      return false;
    }
    return true;
  };

  const shouldRetain = (lesson: Lesson): boolean => {
    if (!lesson || lesson.deleted) return false;
    if (!lesson.date || typeof lesson.date !== 'string') return true;
    const lessonDateKey = normalizeDateToISO(lesson.date);
    if (!lessonDateKey) return true;
    if (lessonDateKey >= cutoffIso) return true;
    if (lesson.groupId) {
      const anchorGrp = nonDeletedGroupById.get(lesson.groupId);
      if (anchorGrp?.cycleAnchorLessonId && anchorGrp.cycleAnchorLessonId === lesson.id) {
        return true;
      }
    }
    if (lesson.status === 'scheduled' || isPendingStatus(lesson.status)) return true;
    if (lesson.status !== 'completed') return false;
    if (lessonDateKey < maxCutoffIso) return false;

    const lessonPayStatus = String(lesson.paymentStatus || '');
    const reportPayStatus = String(lesson.report?.paymentStatus || '');
    if (
      lessonPayStatus === 'paid' ||
      lessonPayStatus === 'exempted' ||
      reportPayStatus === 'paid' ||
      reportPayStatus === 'exempted'
    ) {
      return false;
    }

    const grp = lesson.groupId ? activeGroupById.get(lesson.groupId) : undefined;
    let hasMatchedStudent = false;

    if (lesson.studentId) {
      const st = studentById.get(lesson.studentId);
      if (st) {
        hasMatchedStudent = true;
        if (isStudentUnpaidObligation(st, lesson, grp)) return true;
      }
    } else if (lesson.studentName) {
      const byName = studentsByName.get(lesson.studentName);
      if (byName && byName.length > 0) {
        hasMatchedStudent = true;
        for (let i = 0; i < byName.length; i++) {
          if (isStudentUnpaidObligation(byName[i], lesson, grp)) return true;
        }
      }
    }

    if (lesson.groupId && lesson.groupId !== 'quick_group') {
      const byGroup = studentsByGroupId.get(lesson.groupId);
      if (byGroup && byGroup.length > 0) {
        hasMatchedStudent = true;
        for (let i = 0; i < byGroup.length; i++) {
          if (isStudentUnpaidObligation(byGroup[i], lesson, grp)) return true;
        }
      }
    }

    if (hasMatchedStudent) return false;

    const due = lesson.amountDue ?? 0;
    const paid = lesson.amountPaid ?? 0;
    return due > 0 && paid < due;
  };

  const filtered: Lesson[] = [];
  for (let i = 0; i < sourceRows.length; i++) {
    const lesson = sourceRows[i];
    if (shouldRetain(lesson)) filtered.push(lesson);
  }

  const bestLessons = new Map<string, Lesson>();
  const score = (lesson: Lesson) => {
    let value = 0;
    if (lesson.status !== 'scheduled') value += 100;
    if (lesson.paymentStatus === 'paid' || lesson.report?.paymentStatus === 'paid') value += 100;
    if ((lesson.amountPaid || 0) > 0) value += 50;
    if (lesson.report && Object.keys(lesson.report).length > 0) value += 50;
    if (lesson.studentPayments && Object.keys(lesson.studentPayments).length > 0) value += 50;
    return value;
  };
  for (let i = 0; i < filtered.length; i++) {
    const lesson = filtered[i];
    if (!lesson.groupId || lesson.groupId === 'quick_group') continue;
    const key = `${lesson.groupId}_${lesson.date}_${lesson.time}`;
    const current = bestLessons.get(key);
    if (!current) bestLessons.set(key, lesson);
    else {
      const candidateScore = score(lesson);
      const currentScore = score(current);
      let winner = candidateScore > currentScore ? lesson : current;
      let loser = winner === lesson ? current : lesson;
      if (candidateScore === currentScore &&
        lesson.updatedAt && (!current.updatedAt || lesson.updatedAt > current.updatedAt)) {
        winner = lesson;
        loser = current;
      }
      const paid = winner.paymentStatus === 'paid' || loser.paymentStatus === 'paid' ||
        winner.report?.paymentStatus === 'paid' || loser.report?.paymentStatus === 'paid';
      if (paid) {
        winner = {
          ...winner, paymentStatus: 'paid',
          amountPaid: Math.max(winner.amountPaid || 0, loser.amountPaid || 0),
          report: winner.report ? { ...winner.report, paymentStatus: 'paid' } : loser.report
        };
      }
      bestLessons.set(key, winner);
    }
  }
  const seenIds = new Set<string>();
  const result: Lesson[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const lesson = filtered[i];
    if (!lesson?.id || seenIds.has(lesson.id)) continue;
    if (lesson.groupId && lesson.groupId !== 'quick_group') {
      const key = `${lesson.groupId}_${lesson.date}_${lesson.time}`;
      if (bestLessons.get(key)?.id !== lesson.id) continue;
    }
    seenIds.add(lesson.id);
    result.push(lesson);
  }
  return result;
};

export interface LessonPipelineTrace {
  (stage: string, lessons: Lesson[], details?: { removedIds?: Iterable<string>; note?: string; previousLessons?: Lesson[] }): void;
}

export const mergeFullLessonHistory = (
  inMemory: Lesson[],
  persisted: Lesson[],
  fallback: Lesson[] = []
): Lesson[] => {
  const result: Lesson[] = [];
  const byId = new Map<string, number>();
  // In-memory rows win for fields, while persisted-only IDs are never discarded.
  for (const source of [inMemory, persisted, fallback]) {
    for (const lesson of source || []) {
      if (!lesson?.id) continue;
      const existingIndex = byId.get(lesson.id);
      if (existingIndex === undefined) {
        byId.set(lesson.id, result.length);
        result.push(lesson);
      } else if (source === inMemory) {
        result[existingIndex] = lesson;
      }
    }
  }
  return result;
};

export const createLessonReportCompletionUpdater = (args: {
  lessonId: string;
  report: LessonReport;
  targetLesson: Lesson;
  finalSessionNumber: number;
  updatedTotalSessions: number;
  effectiveTargetGroup?: Partial<Group> | null;
  targetStudent?: Partial<Student> | null;
  students: Student[];
  wrapMutation: <T>(item: T) => T;
  stampFieldTimestamps?: (previous: Lesson, next: Lesson) => Lesson;
  trace?: LessonPipelineTrace;
}): ((allLessons: Lesson[]) => Lesson[]) => {
  const { lessonId, report, targetLesson, finalSessionNumber, updatedTotalSessions,
    effectiveTargetGroup, targetStudent, students, wrapMutation, stampFieldTimestamps = (_previous, next) => next, trace } = args;
  const studentById = new Map<string, Student>();
  for (const s of students || []) {
    if (s?.id && !studentById.has(s.id)) studentById.set(s.id, s);
  }
  return (allLessons) => {
    const createCompletedRecord = (lesson: Lesson): Lesson => {
      const mutated = wrapMutation({
      ...lesson,
      status: 'completed',
      isAutoGenerated: false,
      sessionNumber: finalSessionNumber,
      totalSessionsInPackage: updatedTotalSessions,
      topic: report.arabicTopicsExplained || report.teacherNotes || (lesson as any).topic,
      paymentStatus: report.paymentStatus !== undefined ? report.paymentStatus : (lesson.paymentStatus || 'pending'),
      amountPaid: report.amountPaid !== undefined ? report.amountPaid : (lesson.amountPaid ?? targetLesson.amountPaid),
      recordingLink: report.recordingLink !== undefined ? report.recordingLink : lesson.recordingLink,
      recordingLink2: report.recordingLink2 !== undefined ? report.recordingLink2 : lesson.recordingLink2,
      studentPayments: report.studentPayments && Object.keys(report.studentPayments).length > 0 ? Object.fromEntries(
        Object.entries(report.studentPayments).map(([studentId, payment]: [string, any]) => {
          const student = studentById.get(studentId);
          return [studentId, {
            studentId,
            studentName: student?.name || 'Schüler',
            paymentStatus: payment.status,
            amountPaid: payment.amount,
            amountDue: targetLesson.amountDue || 200
          }];
        })
      ) : lesson.studentPayments,
      report
    } as Lesson);
    return stampFieldTimestamps(lesson, mutated);
    };
    const completion = applyLessonCompletionMutation(allLessons, lessonId, createCompletedRecord, targetLesson);
    if (trace) {
      trace('saveLessonReport: after completed status/report mutation', completion.lessons, { previousLessons: allLessons, note: `targetId=${lessonId}; found=${completion.found}` });
    }
    const pivot = completion.lessons.find(lesson => lesson.id === lessonId);
    const resequenced = resequenceScheduledLessonsAfterChange(completion.lessons, pivot, {
      group: effectiveTargetGroup,
      student: targetStudent,
      students,
      wrapMutation
    });
    if (trace) {
      trace('saveLessonReport: after resequence', resequenced, { previousLessons: completion.lessons, note: `targetId=${lessonId}` });
    }
    return resequenced;
  };
};

export const runLessonPersistencePipeline = async (args: {
  persistedBefore: Lesson[];
  inMemorySnapshot: Lesson[];
  fallbackLessons?: Lesson[];
  updater: (allLessons: Lesson[]) => Lesson[];
  students: Student[];
  filterActiveLessons: (allLessons: Lesson[]) => Lesson[];
  setFullHistory: (allLessons: Lesson[]) => void;
  setActiveLessons: (allLessons: Lesson[]) => void;
  writeStorage: (allLessons: Lesson[]) => Promise<void>;
  trace?: LessonPipelineTrace;
}): Promise<Lesson[]> => {
  const { persistedBefore, inMemorySnapshot, fallbackLessons = [], updater, students,
    filterActiveLessons, setFullHistory, setActiveLessons, writeStorage, trace } = args;
  const base = mergeFullLessonHistory(inMemorySnapshot, persistedBefore, fallbackLessons);
  if (trace) {
    const baseIds = new Set(base.map(row => row.id));
    trace('updateFullLessonsStorage: merged authoritative base', base, { previousLessons: inMemorySnapshot,
      removedIds: persistedBefore.filter(row => row?.id && !baseIds.has(row.id)).map(row => row.id)
    });
  }
  const rawUpdated = updater(base);
  if (trace) {
    trace('updateFullLessonsStorage: updater output before completion guard', rawUpdated, { previousLessons: base });
  }

  const guarded = preserveCompletedLessonStatuses([persistedBefore, inMemorySnapshot, base], rawUpdated);
  if (trace) {
    trace('updateFullLessonsStorage: completion regression guard', guarded.lessons, { previousLessons: rawUpdated,
      note: guarded.protectedIds.size
        ? `Protected completed IDs: ${Array.from(guarded.protectedIds).join(', ')}`
        : 'No completed status regressions detected'
    });
  }

  // Keep the last occurrence of each stable ID in O(n), preserving its relative order.
  const seen = new Set<string>();
  const reversed: Lesson[] = [];
  const duplicateIds = trace ? new Set<string>() : null;
  for (let index = guarded.lessons.length - 1; index >= 0; index--) {
    const item = guarded.lessons[index];
    if (!item?.id) continue;
    if (seen.has(item.id)) {
      if (duplicateIds) duplicateIds.add(item.id);
    } else {
      seen.add(item.id);
      reversed.push(item);
    }
  }
  const dedupedById = reversed.reverse();
  if (trace) {
    trace('updateFullLessonsStorage: ID deduplication', dedupedById, { removedIds: duplicateIds!, previousLessons: guarded.lessons });
  }

  const semantic = deduplicateLessonList(dedupedById, students);
  const deduped = semantic.deduplicated as Lesson[];
  if (trace) {
    trace('updateFullLessonsStorage: semantic deduplication', deduped, { removedIds: semantic.removedIds, previousLessons: dedupedById });
  }
  setFullHistory(deduped);

  const active = filterActiveLessons(deduped);
  if (trace) {
    const activeIds = new Set(active.map(row => row.id));
    trace('updateFullLessonsStorage: active state before setLessons', active, { previousLessons: deduped,
      removedIds: deduped.filter(row => row?.id && !activeIds.has(row.id)).map(row => row.id)
    });
  }
  setActiveLessons(active);
  if (trace) {
    trace('updateFullLessonsStorage: writing dl_lessons', deduped);
  }
  await writeStorage(deduped);
  if (trace) {
    trace('updateFullLessonsStorage: dl_lessons write complete', deduped, { previousLessons: deduped });
  }
  return deduped;
};
