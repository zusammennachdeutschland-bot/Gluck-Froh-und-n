import assert from 'node:assert/strict';
import type { Lesson } from '../types';
import { storage, __setSimulatePrimaryDbForTests } from '../services/storageService';
import { enqueueLessonSyncTask, waitForLessonSyncQueue } from '../services/lessonSyncQueue';
import { mergeLessonSyncSnapshot } from '../utils/lessonSync';

const makeLesson = (
  id: string,
  studentName: string,
  time: string,
  status: 'scheduled' | 'completed'
): Lesson => ({
  id,
  studentName,
  date: '2026-11-21',
  time,
  status,
  updatedAt: status === 'completed' ? 2 : 1,
} as Lesson);

const assertStatuses = (lessons: Lesson[], expected: Record<string, string>, boundary: string) => {
  for (const [id, status] of Object.entries(expected)) {
    assert.equal(lessons.find(lesson => lesson.id === id)?.status, status, `${boundary}: ${id} must remain ${status}`);
  }
};

const run = async () => {
  __setSimulatePrimaryDbForTests(true);
  try {
    const initial: Lesson[] = [
      makeLesson('judy-0800', 'Judy', '08:00', 'completed'),
      makeLesson('kinda-0900', 'Kinda und Judy', '09:00', 'scheduled'),
      makeLesson('taleen-1000', 'Taleen Private', '10:00', 'scheduled'),
    ];
    const expectedAfterKinda = {
      'judy-0800': 'completed',
      'kinda-0900': 'completed',
      'taleen-1000': 'scheduled',
    };
    const expectedAfterTaleen = {
      'judy-0800': 'completed',
      'kinda-0900': 'completed',
      'taleen-1000': 'completed',
    };

    let fullState = initial;
    // This models the React state snapshot captured before the first completion
    // render has propagated. It deliberately remains stale across both writes.
    const staleHomeSnapshot = initial;

    await storage.setItem('dl_lessons', initial);
    await waitForLessonSyncQueue();

    const completeAndFlushStaleSnapshot = async (lessonId: string, expected: Record<string, string>) => {
      // Same serialized queue used by AppContext.updateFullLessonsStorage.
      await enqueueLessonSyncTask(async () => {
        fullState = fullState.map(lesson => lesson.id === lessonId
          ? { ...lesson, status: 'completed', updatedAt: Date.now() } as Lesson
          : lesson
        );
        await storage.setItem('dl_lessons', fullState);
      });
      await waitForLessonSyncQueue();

      assertStatuses(fullState, expected, `${lessonId}: full state immediately after updateFullLessonsStorage`);
      let persisted = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      assertStatuses(persisted, expected, `${lessonId}: persisted dl_lessons immediately after storage write`);

      // Same serialized queue and same merge helper used by AppContext.syncLessons.
      await enqueueLessonSyncTask(async () => {
        const merged = mergeLessonSyncSnapshot(persisted, staleHomeSnapshot);
        fullState = merged;
        await storage.setItem('dl_lessons', merged);
      });
      await waitForLessonSyncQueue();

      assertStatuses(fullState, expected, `${lessonId}: full state after syncLessons flush`);
      persisted = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      assertStatuses(persisted, expected, `${lessonId}: persisted dl_lessons after syncLessons flush`);

      // Simulate an app reload: no in-memory ref/state is reused.
      const reloaded = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
      assertStatuses(reloaded, expected, `${lessonId}: state after reload`);
    };

    await completeAndFlushStaleSnapshot('kinda-0900', expectedAfterKinda);
    await completeAndFlushStaleSnapshot('taleen-1000', expectedAfterTaleen);

    const finalReload = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
    assert.equal(finalReload.filter(lesson => lesson.status === 'completed').length, 3);
    console.log('✓ Same-day lesson completion persistence regression passed (Judy, Kinda und Judy, Taleen Private).');
  } finally {
    __setSimulatePrimaryDbForTests(false);
  }
};

run().catch(error => {
  console.error('✗ Same-day lesson completion persistence regression failed:', error);
  process.exitCode = 1;
});
