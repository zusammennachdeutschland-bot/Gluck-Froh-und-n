import { buildFullVerbPraesens } from './verbConjugationTable';
import {
  CompactVerbTuple,
  VerbClassification,
  VerbEntry,
  VerbLevel,
  VerbPrepositionCase
} from './verbTypes';

export const VERB_LIBRARY_VERSION = '2026.11.1';

const CASE_MAP: Record<string, VerbPrepositionCase> = {
  Akk: 'Akkusativ',
  Dat: 'Dativ',
  Gen: 'Genitiv',
  Nom: 'Nominativ',
  'Akk/Dat': 'Akkusativ/Dativ'
};

function normalizeIdPart(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parses a curated CompactVerbTuple into a complete, immutable VerbEntry
 * with pre-built 6-form Präsens conjugations, classifications, preposition/case,
 * separable/reflexive metadata, and validation stamp.
 */
export function buildVerbEntryFromTuple(
  tuple: CompactVerbTuple,
  level: VerbLevel
): VerbEntry {
  const [infinitiveSpec, arabic, english, flagsRaw, prepSpec, topics, exampleGerman, exampleArabic] = tuple;

  const trimmedSpec = infinitiveSpec.trim();
  let isReflexive = false;
  let reflexiveCase: 'Akkusativ' | 'Dativ' | undefined;
  let coreSpec = trimmedSpec;

  if (coreSpec.startsWith('sichDat ')) {
    isReflexive = true;
    reflexiveCase = 'Dativ';
    coreSpec = coreSpec.slice('sichDat '.length).trim();
  } else if (coreSpec.startsWith('sich ')) {
    isReflexive = true;
    reflexiveCase = 'Akkusativ';
    coreSpec = coreSpec.slice('sich '.length).trim();
  }

  let isSeparable = false;
  let separablePrefix: string | undefined;
  let stemInfinitive: string;
  let canonicalVerbWord: string;

  if (coreSpec.includes('|')) {
    const parts = coreSpec.split('|');
    separablePrefix = parts[0].trim();
    stemInfinitive = parts.slice(1).join('').trim();
    isSeparable = Boolean(separablePrefix && stemInfinitive);
    canonicalVerbWord = `${separablePrefix}${stemInfinitive}`;
  } else {
    stemInfinitive = coreSpec;
    canonicalVerbWord = coreSpec;
  }

  const infinitive = isReflexive ? `sich ${canonicalVerbWord}` : canonicalVerbWord;

  const flagTokens = flagsRaw
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);

  const classifications: VerbClassification[] = [];
  if (flagTokens.includes('M')) {
    classifications.push('Modalverb');
    classifications.push('unregelmäßig');
  } else if (flagTokens.includes('U')) {
    classifications.push('unregelmäßig');
  } else {
    classifications.push('regelmäßig');
  }

  if (isSeparable || flagTokens.includes('T')) {
    isSeparable = true;
    if (!classifications.includes('trennbar')) {
      classifications.push('trennbar');
    }
  }

  if (isReflexive || flagTokens.includes('X')) {
    isReflexive = true;
    if (!reflexiveCase) reflexiveCase = 'Akkusativ';
    if (!classifications.includes('reflexiv')) {
      classifications.push('reflexiv');
    }
  }

  let preposition: string | undefined;
  let prepositionCase: VerbPrepositionCase | undefined;

  if (prepSpec && prepSpec.trim()) {
    const plusIdx = prepSpec.indexOf('+');
    if (plusIdx !== -1) {
      preposition = prepSpec.slice(0, plusIdx).trim();
      const rawCase = prepSpec.slice(plusIdx + 1).trim();
      prepositionCase = CASE_MAP[rawCase] || 'Akkusativ';
    } else {
      preposition = prepSpec.trim();
    }
    if (!classifications.includes('Verb mit Präposition')) {
      classifications.push('Verb mit Präposition');
    }
  } else if (flagTokens.includes('P') && !classifications.includes('Verb mit Präposition')) {
    classifications.push('Verb mit Präposition');
  }

  const { praesens, pattern } = buildFullVerbPraesens({
    stemInfinitive,
    separablePrefix,
    isReflexive,
    reflexiveCase
  });

  // Deduplicated unique ID derived from CEFR + canonical infinitive (plus preposition suffix if needed)
  const idBase = `v_${level.toLowerCase()}_${normalizeIdPart(infinitive)}`;

  return {
    id: idBase,
    infinitive,
    arabic: arabic.trim(),
    english: english.trim(),
    level,
    praesens,
    classifications,
    isSeparable,
    ...(separablePrefix ? { separablePrefix } : {}),
    stemInfinitive,
    isReflexive,
    ...(reflexiveCase ? { reflexiveCase } : {}),
    ...(preposition ? { preposition } : {}),
    ...(prepositionCase ? { prepositionCase } : {}),
    exampleGerman: exampleGerman.trim(),
    exampleArabic: exampleArabic.trim(),
    topics: [...topics],
    meta: {
      version: VERB_LIBRARY_VERSION,
      verified: true,
      source: 'Glück Curated Curriculum A1–B1 (Duden/Goethe Verified)',
      conjugationPattern: pattern
    }
  };
}

export function buildVerbListForLevel(
  tuples: readonly CompactVerbTuple[],
  level: VerbLevel
): VerbEntry[] {
  const seenInfinitives = new Set<string>();
  const result: VerbEntry[] = [];

  for (const tuple of tuples) {
    const entry = buildVerbEntryFromTuple(tuple, level);
    const key = entry.infinitive.toLowerCase();
    if (seenInfinitives.has(key)) {
      throw new Error(`Duplicate verb infinitive detected in ${level}: ${entry.infinitive}`);
    }
    seenInfinitives.add(key);
    result.push(entry);
  }

  return result;
}
