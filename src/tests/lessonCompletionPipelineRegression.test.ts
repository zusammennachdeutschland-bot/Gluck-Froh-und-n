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
import { deduplicateLessonList, resequenceScheduledLessonsAfterChange } from '../utils/lessonUtils';

const makeLesson = (id: string, studentName: string, time: string, status: 'scheduled' | 'completed', groupId?: string): Lesson => ({
  id, studentName, groupId, date: formatLocalDate(), time, durationMinutes: 60, status,
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

  const persistReport = (lessonId: string, report: LessonReport, fallbackLesson?: Lesson) => {
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
      persistReport(id, { attendanceStatus: 'present' } as LessonReport, target);
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
      assertStatuses((await storage.getItem<Lesson[]>('dl_lessons')) || [], expected, `Modal ${id}: storage after follow-up update`);
    }
  }
  const final = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
  assertStatuses(final, expectedAfterTaleen, `${entryPoint}: final restarted state`);
};

const runScaleTests = () => {
  const dedupRows: Lesson[] = Array.from({ length: 5000 }, (_, index) => makeLesson(
    `scale-${index}`, `Student Unique ${index}`,
    `${String(Math.floor(index / 60) % 24).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
    'scheduled', `group-${index}`
  ));
  const dedupStart = performance.now();
  const deduped = deduplicateLessonList(dedupRows);
  const dedupMs = performance.now() - dedupStart;
  assert.equal(deduped.deduplicated.length, 5000);
  assert.equal(deduped.removedIds.size, 0);
  assert.ok(dedupMs < 3000, `5,000-row indexed dedupe took ${dedupMs.toFixed(1)}ms (limit 3,000ms)`);

  const sequenceRows: Lesson[] = Array.from({ length: 2500 }, (_, index) => ({
    ...makeLesson(`sequence-${index}`, 'Shared Group Student', '08:00', 'scheduled', 'scale-group'),
    date: new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10)
  }));
  const group = { id: 'scale-group', name: 'Scale Group', sessionCount: 4, startingSessionNumber: 1 } as any;
  const sequenceStart = performance.now();
  const sequenced = resequenceScheduledLessonsAfterChange(sequenceRows, sequenceRows[0], { group });
  const sequenceMs = performance.now() - sequenceStart;
  assert.equal(sequenced.length, 2500);
  assert.ok(sequenceMs < 2000, `2,500-row single-sort resequence took ${sequenceMs.toFixed(1)}ms (limit 2,000ms)`);
  console.log(`✓ Lesson scale tests: dedupe 5,000=${dedupMs.toFixed(1)}ms; resequence 2,500=${sequenceMs.toFixed(1)}ms.`);
};

const run = async () => {
  __setSimulatePrimaryDbForTests(true);
  try {
    await runScenario('home');
    await runScenario('modal');
    runScaleTests();
    console.log('✓ Shared production lesson persistence pipeline regression passed for Home and LessonControlModal paths.');
  } finally {
    __setSimulatePrimaryDbForTests(false);
  }
};

run().catch(error => {
  console.error('✗ Lesson completion persistence regression failed:', error);
  process.exitCode = 1;
});
