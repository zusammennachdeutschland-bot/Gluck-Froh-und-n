export type VerbLevel = 'A1' | 'A2' | 'B1';

export type VerbClassification =
  | 'regelmäßig'
  | 'unregelmäßig'
  | 'trennbar'
  | 'reflexiv'
  | 'Modalverb'
  | 'Verb mit Präposition';

export type VerbTopicTag =
  | 'Alltag'
  | 'Familie'
  | 'Schule'
  | 'Freizeit'
  | 'Essen und Trinken'
  | 'Einkaufen'
  | 'Reisen'
  | 'Gesundheit'
  | 'Beruf und Ausbildung'
  | 'Umwelt und Natur'
  | 'Kommunikation und Medien'
  | 'Beziehungen und Gefühle'
  | 'Gesellschaft'
  | 'Probleme und Lösungen';

export const ALL_VERB_TOPIC_TAGS: VerbTopicTag[] = [
  'Alltag',
  'Familie',
  'Schule',
  'Freizeit',
  'Essen und Trinken',
  'Einkaufen',
  'Reisen',
  'Gesundheit',
  'Beruf und Ausbildung',
  'Umwelt und Natur',
  'Kommunikation und Medien',
  'Beziehungen und Gefühle',
  'Gesellschaft',
  'Probleme und Lösungen'
];

export const ALL_VERB_CLASSIFICATIONS: VerbClassification[] = [
  'regelmäßig',
  'unregelmäßig',
  'trennbar',
  'reflexiv',
  'Modalverb',
  'Verb mit Präposition'
];

export type VerbPrepositionCase = 'Akkusativ' | 'Dativ' | 'Genitiv' | 'Nominativ' | 'Akkusativ/Dativ';

export type VerbPronounSlot =
  | 'ich'
  | 'du'
  | 'er_sie_es'
  | 'wir'
  | 'ihr'
  | 'sie_Sie';

export interface VerbPraesensForms {
  ich: string;
  du: string;
  er_sie_es: string;
  wir: string;
  ihr: string;
  sie_Sie: string;
}

export interface VerbValidationMetadata {
  version: string;
  verified: boolean;
  source: string;
  conjugationPattern: 'regular' | 'epenthetic_e' | 's_coalescence' | 'eln_ern' | 'irregular' | 'modal' | 'sein_haben_werden';
}

export interface VerbEntry {
  id: string;
  infinitive: string;
  arabic: string;
  english?: string;
  level: VerbLevel;
  praesens: VerbPraesensForms;
  classifications: VerbClassification[];
  isSeparable: boolean;
  separablePrefix?: string;
  stemInfinitive?: string;
  isReflexive: boolean;
  reflexiveCase?: 'Akkusativ' | 'Dativ';
  preposition?: string;
  prepositionCase?: VerbPrepositionCase;
  exampleGerman: string;
  exampleArabic: string;
  topics: VerbTopicTag[];
  meta: VerbValidationMetadata;
}

export type VerbGroupCategory = 'cefr' | 'grammar' | 'topic' | 'custom';

export interface VerbGroupDefinition {
  id: string;
  titleDe: string;
  titleAr: string;
  descriptionAr?: string;
  descriptionDe?: string;
  category: VerbGroupCategory;
  verbIds: string[];
  isBuiltin: boolean;
  basedOnBuiltinGroupId?: string;
  createdByTeacherName?: string;
  createdByUid?: string;
  libraryVersion?: string;
  createdAt?: string;
  updatedAt?: number;
  deleted?: boolean;
}

/**
 * Compact curated tuple used inside modular A1/A2/B1 verb banks:
 * [
 *   infinitiveWithMarker, // e.g. "auf|stehen", "sich beeilen", "sichDat vorstellen", "warten", "sein"
 *   arabic,               // accurate Arabic translation(s)
 *   english,              // English translation
 *   flags,                // e.g. "U" (unregelmäßig), "R" (regelmäßig), "M" (Modalverb), "U,T", "R,X" (reflexiv), "U,P"
 *   prepSpec,             // "" or "auf+Akk" or "mit+Dat" or "für+Akk" or "über+Akk" or "nach+Dat" etc.
 *   topics,               // VerbTopicTag[] (1-3 matching topics)
 *   exampleGerman,        // Natural Präsens German example sentence using the verb
 *   exampleArabic         // Accurate Arabic translation of exampleGerman
 * ]
 */
export type CompactVerbTuple = readonly [
  infinitiveSpec: string,
  arabic: string,
  english: string,
  flags: string,
  prepSpec: string,
  topics: readonly VerbTopicTag[],
  exampleGerman: string,
  exampleArabic: string
];
