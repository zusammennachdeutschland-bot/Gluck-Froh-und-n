/**
 * Shared serialized queue for every full-lesson write and React snapshot flush.
 * A failed operation is reported to its caller but never poisons later writes.
 */
let lessonSyncQueue: Promise<void> = Promise.resolve();

export const enqueueLessonSyncTask = <T>(task: () => Promise<T> | T): Promise<T> => {
  const operation = lessonSyncQueue.then(task);
  lessonSyncQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

export const waitForLessonSyncQueue = (): Promise<void> => lessonSyncQueue;
