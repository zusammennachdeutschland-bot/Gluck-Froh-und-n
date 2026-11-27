import { buildVerbListForLevel } from './verbCatalogBuilder.js';
import { VERBS_A1_PART_1 } from './verbsA1_1.js';
import { VERBS_A1_PART_2 } from './verbsA1_2.js';
import { VerbEntry } from './verbTypes.js';

export const VERBS_A1: readonly VerbEntry[] = buildVerbListForLevel(
  [...VERBS_A1_PART_1, ...VERBS_A1_PART_2],
  'A1'
);
