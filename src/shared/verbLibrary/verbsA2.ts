import { buildVerbListForLevel } from './verbCatalogBuilder';
import { VERBS_A2_PART_1 } from './verbsA2_1';
import { VERBS_A2_PART_2 } from './verbsA2_2';
import { VERBS_A2_PART_3 } from './verbsA2_3';
import { VerbEntry } from './verbTypes';

export const VERBS_A2: readonly VerbEntry[] = buildVerbListForLevel(
  [...VERBS_A2_PART_1, ...VERBS_A2_PART_2, ...VERBS_A2_PART_3],
  'A2'
);
