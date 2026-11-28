import type { LernstudioSet } from '../types/lernstudio.js';
import { matchesGradeFilter } from '../utils/lernstudioTranslations.js';

// Central registry for the book-series folders (Lernstudio library).
// One folder per book series; each folder holds all its stages up to the
// A2 cap. An empty stage is shown as an empty state, never hidden; stages
// above the cap (B1.1/B1.2) get no folders. Sets without a series fall back
// to 'general' (builtin) or 'mine' (teacher-created) via getSetSeriesKey.

export type SeriesId =
  | 'sonnenschein'
  | 'dabei'
  | 'beste_freunde'
  | 'deutsch_profis'
  | 'menschen'
  | 'schritte'
  | 'ping_pong'
  | 'general';

export const SERIES_IDS: SeriesId[] = [
  'sonnenschein',
  'dabei',
  'beste_freunde',
  'deutsch_profis',
  'menschen',
  'schritte',
  'ping_pong',
  'general'
];

/** Pseudo-series for the teacher's own sets ("مجموعاتي"). */
export const MINE_FOLDER_ID = 'mine';

export interface SeriesStage {
  id: string;
  labelAr: string;
  labelDe: string;
}

export interface SeriesMeta {
  id: SeriesId;
  nameAr: string;
  nameDe: string;
  color: string;
  publisher: string;
  ageGroup: string;
  maxLevel: 'A1' | 'A2';
  stages: SeriesStage[];
}

const CEFR_STAGES: SeriesStage[] = [
  { id: 'A1.1', labelAr: 'A1.1', labelDe: 'A1.1' },
  { id: 'A1.2', labelAr: 'A1.2', labelDe: 'A1.2' },
  { id: 'A2.1', labelAr: 'A2.1', labelDe: 'A2.1' },
  { id: 'A2.2', labelAr: 'A2.2', labelDe: 'A2.2' }
];

const SONNENSCHEIN_STAGES: SeriesStage[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `grade${n}`,
  labelAr: `جريد ${n}`,
  labelDe: `Klasse ${n}`
}));

export const SERIES_META: Record<SeriesId, SeriesMeta> = {
  sonnenschein: {
    id: 'sonnenschein',
    nameAr: 'Sonnenschein',
    nameDe: 'Sonnenschein',
    color: '#d97706',
    publisher: 'منهج مدرسي',
    ageGroup: 'جريد 1–6',
    maxLevel: 'A2',
    stages: SONNENSCHEIN_STAGES
  },
  dabei: {
    id: 'dabei',
    nameAr: 'Dabei!',
    nameDe: 'Dabei!',
    color: '#059669',
    publisher: 'Hueber',
    ageGroup: 'مراهقون',
    maxLevel: 'A2',
    stages: CEFR_STAGES
  },
  beste_freunde: {
    id: 'beste_freunde',
    nameAr: 'Beste Freunde',
    nameDe: 'Beste Freunde',
    color: '#2563eb',
    publisher: 'Hueber',
    ageGroup: 'مراهقون',
    maxLevel: 'A2',
    stages: CEFR_STAGES
  },
  deutsch_profis: {
    id: 'deutsch_profis',
    nameAr: 'Deutsch Profis',
    nameDe: 'Deutsch Profis',
    color: '#7c3aed',
    publisher: 'Klett',
    ageGroup: 'أطفال 8–12',
    maxLevel: 'A2',
    stages: CEFR_STAGES
  },
  menschen: {
    id: 'menschen',
    nameAr: 'Menschen',
    nameDe: 'Menschen',
    color: '#dc2626',
    publisher: 'Hueber',
    ageGroup: 'كبار 16+',
    maxLevel: 'A2',
    stages: CEFR_STAGES
  },
  schritte: {
    id: 'schritte',
    nameAr: 'Schritte',
    nameDe: 'Schritte',
    color: '#0d9488',
    publisher: 'كتاب الوزارة (مصر)',
    ageGroup: 'جريد 10',
    maxLevel: 'A2',
    stages: [{ id: 'grade10', labelAr: 'جريد 10', labelDe: 'Klasse 10' }]
  },
  ping_pong: {
    id: 'ping_pong',
    nameAr: 'Ping Pong',
    nameDe: 'Ping Pong',
    color: '#db2777',
    publisher: 'Klett',
    ageGroup: 'أطفال',
    maxLevel: 'A1',
    stages: [
      { id: 'vol1', labelAr: 'الجزء 1', labelDe: 'Band 1' },
      { id: 'vol2', labelAr: 'الجزء 2', labelDe: 'Band 2' },
      { id: 'vol3', labelAr: 'الجزء 3', labelDe: 'Band 3' }
    ]
  },
  general: {
    id: 'general',
    nameAr: 'المنهج العام',
    nameDe: 'Allgemeiner Lehrplan',
    color: '#64748b',
    publisher: '—',
    ageGroup: 'كل الأعمار',
    maxLevel: 'A2',
    stages: []
  }
};

export const SERIES_LIST: SeriesMeta[] = SERIES_IDS.map((id) => SERIES_META[id]);

export function isSeriesId(value: unknown): value is SeriesId {
  return typeof value === 'string' && (SERIES_IDS as string[]).includes(value);
}

/**
 * The folder a set belongs to. Explicit `series` wins; builtin sets without
 * one (older data) fall back to 'general', teacher sets without one to 'mine'.
 */
export function getSetSeriesKey(set: Partial<LernstudioSet> | null | undefined): string {
  if (!set) return 'general';
  if (isSeriesId(set.series)) return set.series;
  const id = String(set.id || '');
  if (set.contentOrigin === 'builtin' || id.startsWith('curric_') || id.startsWith('set_def_')) {
    return 'general';
  }
  return MINE_FOLDER_ID;
}

export function getSetEdition(set: Partial<LernstudioSet> | null | undefined): string | undefined {
  if (!set || typeof set.edition !== 'string') return undefined;
  const ed = set.edition.trim();
  return ed ? ed : undefined;
}

// ---- Grade folders (the "بالجريد" browsing mode) ----

export interface GradeFolder {
  id: string;
  labelAr: string;
  labelDe: string;
}

export const GRADE_FOLDERS: GradeFolder[] = [
  { id: 'grade_1', labelAr: 'جريد 1', labelDe: 'Klasse 1' },
  { id: 'grade_2', labelAr: 'جريد 2', labelDe: 'Klasse 2' },
  { id: 'grade_3', labelAr: 'جريد 3', labelDe: 'Klasse 3' },
  { id: 'grade_4', labelAr: 'جريد 4', labelDe: 'Klasse 4' },
  { id: 'grade_5', labelAr: 'جريد 5', labelDe: 'Klasse 5' },
  { id: 'grade_6', labelAr: 'جريد 6', labelDe: 'Klasse 6' },
  { id: 'grade_10', labelAr: 'جريد 10', labelDe: 'Klasse 10' },
  { id: 'klasse_11', labelAr: 'Klasse 11', labelDe: 'Klasse 11' },
  { id: 'general', labelAr: 'المنهج العام', labelDe: 'Allgemeiner Lehrplan' }
];

function gradeText(set: Partial<LernstudioSet>): string {
  return `${set.grade || ''} ${set.title || ''} ${set.topic || ''}`.toLowerCase();
}

/** Does this set belong in the given grade folder? */
export function matchesGradeFolder(set: Partial<LernstudioSet>, gradeFolderId: string): boolean {
  if (!set || !gradeFolderId) return true;
  if (gradeFolderId === 'general') {
    // Catch-all: sets that match no specific grade folder.
    return !['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6', 'grade_10', 'klasse_11'].some((id) =>
      matchesGradeFolder(set, id)
    );
  }
  if (gradeFolderId === 'grade_10') {
    return getSetSeriesKey(set) === 'schritte' || /جريد 10|grade 10|klasse 10/.test(gradeText(set));
  }
  if (gradeFolderId === 'klasse_11') {
    return /klasse 11/.test(gradeText(set));
  }
  // grade_1 .. grade_6 reuse the existing grade-filter logic.
  return matchesGradeFilter(set, gradeFolderId);
}

/**
 * Stages of a book that are relevant inside a grade folder. Grade-bound
 * series (Sonnenschein, Schritte) show only the matching stage; CEFR series
 * show all their stages (their stages are not grade-bound).
 */
export function stagesForBookInGrade(seriesId: string, gradeFolderId: string): SeriesStage[] {
  const meta = isSeriesId(seriesId) ? SERIES_META[seriesId] : undefined;
  if (!meta) return [];
  if (seriesId === 'sonnenschein') {
    const n = Number(String(gradeFolderId).replace('grade_', ''));
    if (Number.isInteger(n) && n >= 1 && n <= 6) {
      return meta.stages.filter((s) => s.id === `grade${n}`);
    }
    return meta.stages;
  }
  if (seriesId === 'schritte') return meta.stages;
  return meta.stages;
}

/** Series that have at least one stage for the given grade folder. */
export function seriesExpectedInGrade(gradeFolderId: string): string[] {
  if (/^grade_[1-6]$/.test(gradeFolderId)) return ['sonnenschein'];
  if (gradeFolderId === 'grade_10') return ['schritte'];
  if (gradeFolderId === 'klasse_11') return ['dabei'];
  return [];
}

/** Validate a pasted/imported series+edition pair; returns cleaned values. */
export function sanitizeSeriesEdition(
  series: unknown,
  edition: unknown
): { series: SeriesId; edition?: string } {
  const cleanSeries: SeriesId = isSeriesId(series) ? series : 'general';
  const stages = SERIES_META[cleanSeries].stages;
  const cleanEdition =
    typeof edition === 'string' && edition.trim() && stages.some((s) => s.id === edition.trim())
      ? edition.trim()
      : undefined;
  return { series: cleanSeries, ...(cleanEdition ? { edition: cleanEdition } : {}) };
}
