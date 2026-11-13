import { buildVerbListForLevel } from './verbCatalogBuilder';
import { VERBS_A1_PART_1 } from './verbsA1_1';
import { VERBS_A1_PART_2 } from './verbsA1_2';
import { VerbEntry } from './verbTypes';

export const VERBS_A1: readonly VerbEntry[] = buildVerbListForLevel(
  [...VERBS_A1_PART_1, ...VERBS_A1_PART_2],
  'A1'
);
