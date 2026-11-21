import type { Lesson } from '../types';

export interface LessonPipelineTraceDetails {
  removedIds?: Iterable<string>;
  mergedIds?: Map<string, string> | Record<string, string>;
  note?: string;
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
    if (details.removedIds) console.info('Removed IDs:', Array.from(details.removedIds));
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
