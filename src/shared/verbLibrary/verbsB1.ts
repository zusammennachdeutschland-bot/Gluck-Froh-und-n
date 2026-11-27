import { buildVerbListForLevel } from './verbCatalogBuilder.js';
import { VERBS_B1_PART_1 } from './verbsB1_1.js';
import { VERBS_B1_PART_2 } from './verbsB1_2.js';
import { VERBS_B1_PART_3 } from './verbsB1_3.js';
import { VERBS_B1_PART_4 } from './verbsB1_4.js';
import { VerbEntry } from './verbTypes.js';

export const VERBS_B1: readonly VerbEntry[] = buildVerbListForLevel(
  [...VERBS_B1_PART_1, ...VERBS_B1_PART_2, ...VERBS_B1_PART_3, ...VERBS_B1_PART_4],
  'B1'
);
