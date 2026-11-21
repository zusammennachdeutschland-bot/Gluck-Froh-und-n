import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import type { Lesson, LessonReport } from '../types';
import { storage, __setSimulatePrimaryDbForTests } from '../services/storageService';
import { enqueueLessonSyncTask, waitForLessonSyncQueue } from '../services/lessonSyncQueue';
import { handleHomeQuickLessonCompletion } from '../utils/homeLessonCompletion';
import { formatLocalDate } from '../utils/timeUtils';
import {
  createLessonReportCompletionUpdater,
  filterActiveLessonRows,
  runLessonPersistencePipeline
} from '../services/lessonPersistencePipeline';
import { deduplicateLessonList, deduplicatePaymentsList, resequenceScheduledLessonsAfterChange } from '../utils/lessonUtils';

const makeLesson = (id: string, studentName: string, time: string, status: 'scheduled' | 'completed', groupId?: string): Lesson => ({
  id, studentName, groupId, date: formatLocalDate(), time, durationMinutes: 60, amountDue: 200, status,
  sessionNumber: 1, totalSessionsInPackage: 1, updatedAt: status === 'completed' ? 2 : 1
} as Lesson);

const expectedAfterKinda = {
  'judy-0800': 'completed', 'kinda-0900': 'completed', 'taleen-1000': 'scheduled'
};
const expectedAfterTaleen = {
  'judy-0800': 'completed', 'kinda-0900': 'completed', 'taleen-1000': 'completed'
};

const assertStatuses = (rows: Lesson[], expected: Record<string, string>, boundary: string) => {
  const byId = new Map(rows.map(row => [row.id, row]));
  assert.deepEqual([...byId.keys()].sort(), Object.keys(expected).sort(), `${boundary}: every lesson ID must exist exactly once`);
  for (const [id, status] of Object.entries(expected)) assert.equal(byId.get(id)?.status, status, `${boundary}: ${id}`);
};

const runScenario = async (entryPoint: 'home' | 'modal') => {
  let full: Lesson[] = [
    makeLesson('judy-0800', 'Judy', '08:00', 'completed', 'judy-private'),
    makeLesson('kinda-0900', 'Kinda und Judy', '09:00', 'scheduled', 'kinda-group'),
    makeLesson('taleen-1000', 'Taleen Private', '10:00', 'scheduled', 'taleen-private')
  ];
  let active = [...full];
  const students: any[] = [];
  const groups: any[] = [];
  const pending: Promise<void>[] = [];
  await storage.setItem('dl_lessons', full);
  await waitForLessonSyncQueue();

  const persistReport = (lessonId: string, report: LessonReport, _packageCount?: number, _sessionNumber?: number, fallbackLesson?: Lesson) => {
    const promise = enqueueLessonSyncTask(async () => {
      const persisted = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      const target = full.find(row => row.id === lessonId) || fallbackLesson;
      assert.ok(target, `saveLessonReport target exists: ${lessonId}`);
      const updater = createLessonReportCompletionUpdater({
        lessonId, report, targetLesson: target!, finalSessionNumber: 1, updatedTotalSessions: 1,
        effectiveTargetGroup: null, targetStudent: null, students,
        wrapMutation: <T>(item: T) => item
      });
      full = await runLessonPersistencePipeline({
        persistedBefore: persisted,
        inMemorySnapshot: full,
        updater,
        students,
        filterActiveLessons: rows => filterActiveLessonRows(rows, '0000-01-01', '0000-01-01', students, groups),
        setFullHistory: rows => { full = rows; },
        setActiveLessons: rows => { active = rows; },
        writeStorage: rows => storage.setItem('dl_lessons', rows)
      });
      const expected = lessonId === 'kinda-0900' ? expectedAfterKinda : expectedAfterTaleen;
      assertStatuses(full, expected, `${entryPoint} ${lessonId}: full-history memory after saveLessonReport`);
      assertStatuses(active, expected, `${entryPoint} ${lessonId}: active state after filtering`);
      const written = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      assertStatuses(written, expected, `${entryPoint} ${lessonId}: dl_lessons after write`);
      // Fresh read models an application restart; no in-memory refs are reused.
      const restarted = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      assertStatuses(restarted, expected, `${entryPoint} ${lessonId}: after restart`);
    });
    pending.push(promise);
  };

  if (entryPoint === 'home') {
    const dependencies = {
      groups, students, language: 'en' as const,
      getFullLessonsSnapshot: () => full,
      saveLessonReport: persistReport,
      clearDraft: (_lessonId: string) => {}
    };
    for (const id of ['kinda-0900', 'taleen-1000']) {
      const target = full.find(row => row.id === id)!;
      handleHomeQuickLessonCompletion({ stopPropagation() {} }, target, dependencies);
      await pending.shift();
      await waitForLessonSyncQueue();
      assertStatuses(full, id === 'kinda-0900' ? expectedAfterKinda : expectedAfterTaleen, `Home handler returned for ${id}`);
    }
  } else {
    for (const id of ['kinda-0900', 'taleen-1000']) {
      const target = full.find(row => row.id === id)!;
      persistReport(id, { attendanceStatus: 'present' } as LessonReport, undefined, undefined, target);
      await pending.shift();
      await waitForLessonSyncQueue();
      // LessonControlModal.handleSaveReport also calls updateLesson after saveLessonReport.
      const expected = id === 'kinda-0900' ? expectedAfterKinda : expectedAfterTaleen;
      const patchPromise = enqueueLessonSyncTask(async () => {
        const persisted = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
        const updater = (rows: Lesson[]) => rows.map(row => row.id === id ? {
          ...row, status: 'completed', report: row.report || { attendanceStatus: 'present' }
        } as Lesson : row);
        full = await runLessonPersistencePipeline({
          persistedBefore: persisted, inMemorySnapshot: full, updater, students,
          filterActiveLessons: rows => filterActiveLessonRows(rows, '0000-01-01', '0000-01-01', students, groups),
          setFullHistory: rows => { full = rows; }, setActiveLessons: rows => { active = rows; },
          writeStorage: rows => storage.setItem('dl_lessons', rows)
        });
      });
      await patchPromise;
      await waitForLessonSyncQueue();
      assertStatuses(full, expected, `LessonControlModal.updateLesson path for ${id}`);
      const afterModalWrite = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      assertStatuses(afterModalWrite, expected, `Modal ${id}: storage after follow-up update`);
      const afterModalRestart = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      assertStatuses(afterModalRestart, expected, `Modal ${id}: after restart following updateLesson write`);
    }
  }
  const final = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
  assertStatuses(final, expectedAfterTaleen, `${entryPoint}: final restarted state`);
};


const runPersistedOnlyLessonRecovery = async () => {
  const persisted: Lesson[] = [
    makeLesson('judy-0800', 'Judy', '08:00', 'completed', 'judy-private'),
    makeLesson('kinda-0900', 'Kinda und Judy', '09:00', 'completed', 'kinda-group'),
    makeLesson('taleen-1000', 'Taleen Private', '10:00', 'scheduled', 'taleen-private')
  ];
  // Reproduce the divergence: the non-empty in-memory ref is stale and has lost
  // two IDs that are still present in durable dl_lessons.
  let memory: Lesson[] = [persisted[2]];
  let active: Lesson[] = [];
  await storage.setItem('dl_lessons', persisted);
  await enqueueLessonSyncTask(async () => {
    const stored = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
    const updater = createLessonReportCompletionUpdater({
      lessonId: 'taleen-1000',
      report: { attendanceStatus: 'present' } as LessonReport,
      targetLesson: persisted[2],
      finalSessionNumber: 1,
      updatedTotalSessions: 1,
      students: [],
      wrapMutation: <T>(item: T) => item
    });
    memory = await runLessonPersistencePipeline({
      persistedBefore: stored,
      inMemorySnapshot: memory,
      updater,
      students: [],
      filterActiveLessons: rows => filterActiveLessonRows(rows, '0000-01-01', '0000-01-01', [], []),
      setFullHistory: rows => { memory = rows; },
      setActiveLessons: rows => { active = rows; },
      writeStorage: rows => storage.setItem('dl_lessons', rows)
    });
  });
  await waitForLessonSyncQueue();
  assertStatuses(memory, expectedAfterTaleen, 'stale memory recovery: authoritative history union');
  assertStatuses(active, expectedAfterTaleen, 'stale memory recovery: active state');
  assertStatuses((await storage.getItem<Lesson[]>('dl_lessons')) || [], expectedAfterTaleen, 'stale memory recovery: durable write and restart');
};

const makeIsoDayOffset = (days: number): string =>
  new Date(Date.UTC(2020, 0, 1 + days)).toISOString().slice(0, 10);

const runScaleTests = async () => {
  // 1. 5,000 rows all on the exact same date (worst-case date-bucket test for indexed dedupe)
  const sameDayRows: Lesson[] = Array.from({ length: 5000 }, (_, index) => makeLesson(
    `scale-same-${index}`, `Student Unique ${index}`,
    `${String(Math.floor(index / 60) % 24).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
    'scheduled', `group-${index}`
  ));
  const sameDayStart = performance.now();
  const sameDayDeduped = deduplicateLessonList(sameDayRows);
  const sameDayMs = performance.now() - sameDayStart;
  assert.equal(sameDayDeduped.deduplicated.length, 5000);
  assert.equal(sameDayDeduped.removedIds.size, 0);
  assert.ok(sameDayMs < 1000, `5,000-row same-day indexed dedupe took ${sameDayMs.toFixed(1)}ms (limit 1,000ms)`);

  // 2. 5,000 realistic multi-group/multi-student rows across dates + 250 exact/overlapping duplicates
  const realisticStudents = Array.from({ length: 120 }, (_, i) => ({
    id: `stu-${i}`,
    name: `Schueler ${i}`,
    groupId: `grp-${i % 40}`
  })) as any[];
  const realisticRows: Lesson[] = [];
  for (let i = 0; i < 4750; i++) {
    const stuIdx = i % 120;
    const grpIdx = i % 40;
    const date = makeIsoDayOffset(Math.floor(i / 40));
    realisticRows.push({
      ...makeLesson(
        `real-${i}`,
        `Schueler ${stuIdx}`,
        `${String(8 + (grpIdx % 12)).padStart(2, '0')}:00`,
        i < 4200 ? 'completed' : 'scheduled',
        `grp-${grpIdx}`
      ),
      studentId: `stu-${stuIdx}`,
      date
    });
  }
  for (let d = 0; d < 250; d++) {
    const src = realisticRows[d * 10];
    realisticRows.push({
      ...src,
      id: `dup-${d}`,
      isAutoGenerated: true,
      updatedAt: (src.updatedAt || 1) + 1
    });
  }
  const realisticStart = performance.now();
  const realisticDeduped = deduplicateLessonList(realisticRows, realisticStudents);
  const realisticMs = performance.now() - realisticStart;
  assert.equal(realisticDeduped.deduplicated.length, 4750);
  assert.equal(realisticDeduped.removedIds.size, 250);
  assert.ok(realisticMs < 1000, `5,000-row realistic dedupe took ${realisticMs.toFixed(1)}ms (limit 1,000ms)`);

  // 3. 5,000-row single-group resequencing (already-sorted, unsorted/reversed, and no-op)
  const sequenceRows: Lesson[] = Array.from({ length: 5000 }, (_, index) => ({
    ...makeLesson(`sequence-${index}`, 'Shared Group Student', '08:00', 'scheduled', 'scale-group'),
    status: index === 2 ? 'cancelled' : 'scheduled',
    date: makeIsoDayOffset(index)
  }));
  const group = { id: 'scale-group', name: 'Scale Group', sessionCount: 4, startingSessionNumber: 1 } as any;
  const sequenceStart = performance.now();
  const sequenced = resequenceScheduledLessonsAfterChange(sequenceRows, sequenceRows[2], { group });
  const noopSequenced = resequenceScheduledLessonsAfterChange(sequenced, sequenced[1], { group });
  const sequenceMs = performance.now() - sequenceStart;
  assert.equal(sequenced.length, 5000);
  assert.equal(noopSequenced.length, 5000);
  assert.equal(sequenced[0].sessionNumber, 1);
  assert.equal(sequenced[1].sessionNumber, 2);
  assert.equal(sequenced[3].sessionNumber, 3);
  assert.equal(sequenced[4].sessionNumber, 4);
  assert.equal(sequenced[5].sessionNumber, 1);
  assert.ok(sequenceMs < 1000, `5,000-row one-pass resequence took ${sequenceMs.toFixed(1)}ms (limit 1,000ms)`);

  const reversedSequenceRows = [...sequenceRows].reverse();
  const unsortedSeqStart = performance.now();
  const unsortedSequenced = resequenceScheduledLessonsAfterChange(reversedSequenceRows, sequenceRows[2], { group });
  const unsortedSeqMs = performance.now() - unsortedSeqStart;
  assert.equal(unsortedSequenced.length, 5000);
  assert.ok(unsortedSeqMs < 1000, `5,000-row unsorted resequence took ${unsortedSeqMs.toFixed(1)}ms (limit 1,000ms)`);

  // 4. 5,000-row payment deduplication
  const paymentRows = Array.from({ length: 5000 }, (_, index) => ({
    id: `pay-${index}`,
    studentId: `pay-stu-${index % 250}`,
    studentName: `Pay Student ${index % 250}`,
    month: `${2020 + Math.floor(index / 3000)}-${String(1 + (Math.floor(index / 250) % 12)).padStart(2, '0')}`,
    amount: 200,
    status: 'paid' as const,
    paidAt: `2024-01-${String(1 + (index % 28)).padStart(2, '0')}`,
    lessonIds: [`l-${index}`],
    lessonDates: [`01/01/2024 (Session ${1 + (index % 4)}/4)`],
    updatedAt: 1000 + index
  }));
  const payStart = performance.now();
  const dedupedPayments = deduplicatePaymentsList(paymentRows as any);
  const payMs = performance.now() - payStart;
  assert.equal(dedupedPayments.deduplicated.length, 5000);
  assert.ok(payMs < 1000, `5,000-row payment dedupe took ${payMs.toFixed(1)}ms (limit 1,000ms)`);

  // 5. End-to-end 5,000-row save pipeline (merge + completion updater + guard + dedupe + active window filter + write)
  let pipelineFull: Lesson[] = Array.from({ length: 5000 }, (_, index) => {
    const grpIdx = index % 50;
    const isOld = index < 4800;
    const dayBucket = Math.floor(index / 50); // 0..99 -> unique (group, day) per row!
    return {
      ...makeLesson(
        `pipe-${index}`,
        `Pipeline Student ${index % 150}`,
        `${String(8 + (grpIdx % 12)).padStart(2, '0')}:${String((grpIdx % 4) * 15).padStart(2, '0')}`,
        isOld ? 'completed' : 'scheduled',
        `pipe-grp-${grpIdx}`
      ),
      studentId: `pipe-stu-${index % 150}`,
      date: isOld ? makeIsoDayOffset(dayBucket) : makeIsoDayOffset(2500 + (dayBucket - 96))
    };
  });
  const target = pipelineFull[4999];
  const pipeStudents = Array.from({ length: 150 }, (_, i) => ({
    id: `pipe-stu-${i}`,
    name: `Pipeline Student ${i}`,
    groupId: `pipe-grp-${i % 50}`
  })) as any[];
  const pipeGroups = Array.from({ length: 50 }, (_, i) => ({
    id: `pipe-grp-${i}`,
    name: `Pipe Group ${i}`,
    sessionCount: 4,
    startingSessionNumber: 1
  })) as any[];
  await storage.setItem('dl_lessons', pipelineFull);
  let activeOut: Lesson[] = [];
  const pipeStart = performance.now();
  const updater = createLessonReportCompletionUpdater({
    lessonId: target.id,
    report: { attendanceStatus: 'present' } as LessonReport,
    targetLesson: target,
    finalSessionNumber: target.sessionNumber || 1,
    updatedTotalSessions: 4,
    effectiveTargetGroup: pipeGroups[4999 % 50],
    students: pipeStudents,
    wrapMutation: <T>(item: T) => item
  });
  pipelineFull = await runLessonPersistencePipeline({
    persistedBefore: pipelineFull,
    inMemorySnapshot: pipelineFull,
    updater,
    students: pipeStudents,
    filterActiveLessons: rows => filterActiveLessonRows(rows, '2026-01-01', '2025-01-01', pipeStudents, pipeGroups),
    setFullHistory: rows => { pipelineFull = rows; },
    setActiveLessons: rows => { activeOut = rows; },
    writeStorage: rows => storage.setItem('dl_lessons', rows)
  });
  const pipeMs = performance.now() - pipeStart;
  const updatedTarget = pipelineFull.find(l => l.id === target.id);
  assert.equal(pipelineFull.length, 5000);
  assert.equal(updatedTarget?.status, 'completed');
  assert.equal(activeOut.length, 200);
  assert.ok(pipeMs < 1000, `5,000-row end-to-end save pipeline took ${pipeMs.toFixed(1)}ms (limit 1,000ms)`);

  console.log(
    `✓ Lesson 5,000-row scale tests: same-day dedupe=${sameDayMs.toFixed(1)}ms; realistic dedupe=${realisticMs.toFixed(1)}ms; resequence+noop=${sequenceMs.toFixed(1)}ms; unsorted resequence=${unsortedSeqMs.toFixed(1)}ms; payment dedupe=${payMs.toFixed(1)}ms; full save pipeline=${pipeMs.toFixed(1)}ms.`
  );
};

const run = async () => {
  __setSimulatePrimaryDbForTests(true);
  try {
    await runScenario('home');
    await runScenario('modal');
    await runPersistedOnlyLessonRecovery();
    await runScaleTests();
    console.log('✓ Shared production lesson persistence pipeline regression passed for Home and LessonControlModal paths.');
  } finally {
    __setSimulatePrimaryDbForTests(false);
  }
};

run().catch(error => {
  console.error('✗ Lesson completion persistence regression failed:', error);
  process.exitCode = 1;
});
