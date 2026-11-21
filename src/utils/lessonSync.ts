/**
 * Merge the filtered React lesson projection into the authoritative full-history
 * snapshot without allowing an older UI snapshot to overwrite persisted records.
 * Existing IDs always keep the full-store version; active state may only add IDs
 * that are genuinely absent from full storage.
 */
import type { Lesson } from '../types';

export const mergeLessonSyncSnapshot = (
  fullLessons: Lesson[],
  activeLessons: Lesson[],
  prunedIds: Set<string> = new Set()
): Lesson[] => {
  const merged: Lesson[] = [];
  const seenIds = new Set<string>();

  for (const lesson of fullLessons || []) {
    if (!lesson?.id || prunedIds.has(lesson.id) || seenIds.has(lesson.id)) continue;
    seenIds.add(lesson.id);
    merged.push(lesson);
  }

  for (const lesson of activeLessons || []) {
    if (!lesson?.id || prunedIds.has(lesson.id) || seenIds.has(lesson.id)) continue;
    seenIds.add(lesson.id);
    merged.push(lesson);
  }

  return merged;
};
