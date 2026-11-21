import type { Lesson } from '../types';

export interface LessonPipelineTraceDetails {
  removedIds?: Iterable<string>;
  mergedIds?: Map<string, string> | Record<string, string>;
  note?: string;\n  previousLessons?: Lesson[];
}

/**
 * Enable with localStorage.setItem('gluck_debug_lesson_pipeline', '1').
 * Every trace includes the identifying fields needed to follow one lesson across
 * completion, resequencing, deduplication, active filtering, persistence and reload.
 */
export const traceLessonPipeline = (
  stage: string,
  lessons: Lesson[] | null | undefined,
  details: LessonPipelineTraceDetails = {}
): void => {
  try {
    if (typeof localStorage === 'undefined' || localStorage.getItem('gluck_debug_lesson_pipeline') !== '1') return;
    const rows = (Array.isArray(lessons) ? lessons : []).map(lesson => ({
      id: lesson?.id || '',
      group: lesson?.groupName || lesson?.groupId || '',
      student: lesson?.studentName || lesson?.studentId || '',
      date: lesson?.date || '',
      time: lesson?.time || '',
      status: lesson?.status || '',
    }));
    console.groupCollapsed(`[Glück lesson pipeline] ${stage} · ${rows.length} records`);
    console.table(rows);
    if (details.removedIds) console.info('Removed IDs:', Array.from(details.removedIds));\n    if (details.previousLessons) {\n      const previousById = new Map(details.previousLessons.filter(row => row?.id).map(row => [row.id, row]));\n      const currentById = new Map((lessons || []).filter(row => row?.id).map(row => [row.id, row]));\n      const removed = [...previousById.keys()].filter(id => !currentById.has(id));\n      const statusChanged = [...currentById.entries()].flatMap(([id, row]) => {\n        const previous = previousById.get(id);\n        return previous && previous.status !== row.status ? [{ id, from: previous.status, to: row.status }] : [];\n      });\n      console.info('Boundary diff:', { removedIds: removed, statusChanged });\n    }
    if (details.mergedIds) {
      const mappings = details.mergedIds instanceof Map
        ? Array.from(details.mergedIds.entries())
        : Object.entries(details.mergedIds);
      console.info('Merged ID mappings:', mappings);
    }
    if (details.note) console.info(details.note);
    console.groupEnd();
  } catch (error) {
    console.warn('[Glück lesson pipeline] trace failed', error);
  }
};
