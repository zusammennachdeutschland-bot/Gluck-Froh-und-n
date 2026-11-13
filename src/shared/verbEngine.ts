import type { LernstudioItem, LernstudioLevel, LernstudioSet } from '../types/lernstudio';
import type {
  HomeworkContentSource,
  HomeworkQuestionType
} from './homeworkTypes';
import {
  ALL_VERBS,
  ALL_VERB_CLASSIFICATIONS,
  ALL_VERB_TOPIC_TAGS,
  BUILTIN_VERB_GROUPS,
  BUILTIN_VERB_GROUPS_BY_ID,
  VERBS_BY_ID,
  VERBS_BY_INFINITIVE,
  type VerbClassification,
  type VerbEntry,
  type VerbGroupDefinition,
  type VerbLevel,
  type VerbPronounSlot,
  type VerbTopicTag
} from './verbLibrary';

export {
  ALL_VERBS,
  VERBS_BY_ID,
  VERBS_BY_INFINITIVE,
  BUILTIN_VERB_GROUPS,
  BUILTIN_VERB_GROUPS_BY_ID,
  ALL_VERB_TOPIC_TAGS,
  ALL_VERB_CLASSIFICATIONS
};

export interface VerbSubjectPrompt {
  id: string;
  labelDe: string;
  hintAr: string;
  displayLabel: string;
  slot: VerbPronounSlot;
  isNamedOrCombined: boolean;
}

/**
 * Disambiguated subject prompts covering all 6 German Präsens slots,
 * distinguishing sie (she) vs. sie (they) vs. Sie (formal), plus named & combined subjects.
 */
export const SUBJECT_PROMPTS: readonly VerbSubjectPrompt[] = [
  {
    id: 'subj_ich',
    labelDe: 'ich',
    hintAr: 'أنا',
    displayLabel: 'ich (أنا)',
    slot: 'ich',
    isNamedOrCombined: false
  },
  {
    id: 'subj_du',
    labelDe: 'du',
    hintAr: 'أنت',
    displayLabel: 'du (أنت)',
    slot: 'du',
    isNamedOrCombined: false
  },
  {
    id: 'subj_er',
    labelDe: 'er',
    hintAr: 'هو',
    displayLabel: 'er (هو)',
    slot: 'er_sie_es',
    isNamedOrCombined: false
  },
  {
    id: 'subj_sie_sg',
    labelDe: 'sie',
    hintAr: 'هي',
    displayLabel: 'sie (هي)',
    slot: 'er_sie_es',
    isNamedOrCombined: false
  },
  {
    id: 'subj_es',
    labelDe: 'es',
    hintAr: 'هو/هي للمحايد',
    displayLabel: 'es (هو/هي للمحايد)',
    slot: 'er_sie_es',
    isNamedOrCombined: false
  },
  {
    id: 'subj_wir',
    labelDe: 'wir',
    hintAr: 'نحن',
    displayLabel: 'wir (نحن)',
    slot: 'wir',
    isNamedOrCombined: false
  },
  {
    id: 'subj_ihr',
    labelDe: 'ihr',
    hintAr: 'أنتم',
    displayLabel: 'ihr (أنتم)',
    slot: 'ihr',
    isNamedOrCombined: false
  },
  {
    id: 'subj_sie_pl',
    labelDe: 'sie',
    hintAr: 'هم / هنّ',
    displayLabel: 'sie (هم / هنّ)',
    slot: 'sie_Sie',
    isNamedOrCombined: false
  },
  {
    id: 'subj_Sie_formal',
    labelDe: 'Sie',
    hintAr: 'حضرتك / حضراتكم',
    displayLabel: 'Sie (حضرتك / حضراتكم)',
    slot: 'sie_Sie',
    isNamedOrCombined: false
  },
  {
    id: 'subj_name_ahmed',
    labelDe: 'Ahmed',
    hintAr: 'أحمد — هو',
    displayLabel: 'Ahmed (هو)',
    slot: 'er_sie_es',
    isNamedOrCombined: true
  },
  {
    id: 'subj_name_mona',
    labelDe: 'Mona',
    hintAr: 'منى — هي',
    displayLabel: 'Mona (هي)',
    slot: 'er_sie_es',
    isNamedOrCombined: true
  },
  {
    id: 'subj_name_lukas',
    labelDe: 'Lukas',
    hintAr: 'لوكاس — هو',
    displayLabel: 'Lukas (هو)',
    slot: 'er_sie_es',
    isNamedOrCombined: true
  },
  {
    id: 'subj_name_sara',
    labelDe: 'Sara',
    hintAr: 'سارة — هي',
    displayLabel: 'Sara (هي)',
    slot: 'er_sie_es',
    isNamedOrCombined: true
  },
  {
    id: 'subj_comb_ahmed_ali',
    labelDe: 'Ahmed und Ali',
    hintAr: 'أحمد وعلي — هم',
    displayLabel: 'Ahmed und Ali (هم)',
    slot: 'sie_Sie',
    isNamedOrCombined: true
  },
  {
    id: 'subj_comb_ahmed_ich',
    labelDe: 'Ahmed und ich',
    hintAr: 'أحمد وأنا — نحن',
    displayLabel: 'Ahmed und ich (نحن)',
    slot: 'wir',
    isNamedOrCombined: true
  },
  {
    id: 'subj_comb_du_ich',
    labelDe: 'du und ich',
    hintAr: 'أنت وأنا — نحن',
    displayLabel: 'du und ich (نحن)',
    slot: 'wir',
    isNamedOrCombined: true
  }
];

export const PRONOUN_ONLY_SUBJECT_PROMPTS: readonly VerbSubjectPrompt[] = SUBJECT_PROMPTS.filter(
  (s) => !s.isNamedOrCombined
);

export const CORE_SIX_SLOT_PROMPTS: readonly VerbSubjectPrompt[] = [
  SUBJECT_PROMPTS[0], // ich
  SUBJECT_PROMPTS[1], // du
  SUBJECT_PROMPTS[2], // er
  SUBJECT_PROMPTS[5], // wir
  SUBJECT_PROMPTS[6], // ihr
  SUBJECT_PROMPTS[8]  // Sie
];

export function getVerbById(verbId: string): VerbEntry | undefined {
  if (!verbId) return undefined;
  return VERBS_BY_ID.get(verbId.trim());
}

export function getVerbByInfinitive(infinitive: string): VerbEntry | undefined {
  if (!infinitive) return undefined;
  const cleaned = infinitive.trim().toLowerCase().replace(/\s+/g, ' ');
  const exact = VERBS_BY_INFINITIVE.get(cleaned);
  if (exact) return exact;
  if (cleaned.startsWith('sich ')) {
    return VERBS_BY_INFINITIVE.get(cleaned.slice(5).trim());
  }
  return VERBS_BY_INFINITIVE.get(`sich ${cleaned}`);
}

export function getBuiltinVerbGroups(): readonly VerbGroupDefinition[] {
  return BUILTIN_VERB_GROUPS;
}

export function mergeBuiltinAndCustomVerbGroups(
  customGroups: readonly VerbGroupDefinition[] = []
): {
  builtinGroups: VerbGroupDefinition[];
  customAndOverriddenGroups: VerbGroupDefinition[];
  allGroups: VerbGroupDefinition[];
} {
  const activeCustom = customGroups.filter((g) => !g.deleted);
  const builtinGroups = BUILTIN_VERB_GROUPS.map((g) => ({
    ...g,
    verbIds: [...g.verbIds]
  }));
  return {
    builtinGroups,
    customAndOverriddenGroups: activeCustom.map((g) => ({
      ...g,
      verbIds: [...g.verbIds]
    })),
    allGroups: [
      ...builtinGroups,
      ...activeCustom.map((g) => ({ ...g, verbIds: [...g.verbIds] }))
    ]
  };
}

export interface VerbFilterOptions {
  levels?: VerbLevel[];
  classifications?: VerbClassification[];
  topics?: VerbTopicTag[];
  groupIds?: string[];
  customGroups?: readonly VerbGroupDefinition[];
  searchQuery?: string;
}

export function getVerbsForGroups(
  groupIds: readonly string[],
  customGroups: readonly VerbGroupDefinition[] = []
): VerbEntry[] {
  if (!groupIds || groupIds.length === 0) return [];
  const customById = new Map<string, VerbGroupDefinition>();
  for (const cg of customGroups) {
    if (!cg.deleted) customById.set(cg.id, cg);
  }

  const seenVerbIds = new Set<string>();
  const collected: VerbEntry[] = [];

  for (const gid of groupIds) {
    const group = customById.get(gid) || BUILTIN_VERB_GROUPS_BY_ID.get(gid);
    if (!group) continue;
    for (const vid of group.verbIds) {
      if (seenVerbIds.has(vid)) continue;
      const entry = VERBS_BY_ID.get(vid);
      if (entry) {
        seenVerbIds.add(vid);
        collected.push(entry);
      }
    }
  }

  return collected;
}

export function resolveVerbsFromSelection(options: {
  groupIds?: readonly string[];
  verbIds?: readonly string[];
  customGroups?: readonly VerbGroupDefinition[];
  fallbackVerbs?: readonly VerbEntry[];
}): VerbEntry[] {
  const seen = new Set<string>();
  const result: VerbEntry[] = [];

  const pushUnique = (v?: VerbEntry) => {
    if (!v || seen.has(v.id)) return;
    seen.add(v.id);
    result.push(v);
  };

  if (options.verbIds && options.verbIds.length > 0) {
    for (const vid of options.verbIds) {
      pushUnique(VERBS_BY_ID.get(vid) || options.fallbackVerbs?.find((fv) => fv.id === vid));
    }
  }

  if (options.groupIds && options.groupIds.length > 0) {
    const fromGroups = getVerbsForGroups(options.groupIds, options.customGroups || []);
    for (const v of fromGroups) pushUnique(v);
  }

  if (result.length === 0 && options.fallbackVerbs && options.fallbackVerbs.length > 0) {
    for (const v of options.fallbackVerbs) pushUnique(v);
  }

  return result;
}

export function searchVerbs(query: string, sourceList: readonly VerbEntry[] = ALL_VERBS): VerbEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...sourceList];
  return sourceList.filter(
    (v) =>
      v.infinitive.toLowerCase().includes(q) ||
      v.arabic.toLowerCase().includes(q) ||
      (v.english && v.english.toLowerCase().includes(q)) ||
      (v.preposition && v.preposition.toLowerCase().includes(q)) ||
      v.exampleGerman.toLowerCase().includes(q)
  );
}

export function filterVerbs(options: VerbFilterOptions): VerbEntry[] {
  let pool: VerbEntry[] =
    options.groupIds && options.groupIds.length > 0
      ? getVerbsForGroups(options.groupIds, options.customGroups || [])
      : [...ALL_VERBS];

  if (options.levels && options.levels.length > 0) {
    const levelSet = new Set(options.levels);
    pool = pool.filter((v) => levelSet.has(v.level));
  }

  if (options.classifications && options.classifications.length > 0) {
    const classSet = new Set(options.classifications);
    pool = pool.filter((v) => v.classifications.some((c) => classSet.has(c)));
  }

  if (options.topics && options.topics.length > 0) {
    const topicSet = new Set(options.topics);
    pool = pool.filter((v) => v.topics.some((t) => topicSet.has(t)));
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    pool = searchVerbs(options.searchQuery, pool);
  }

  return pool;
}

export function resolveVerbPraesensForm(verb: VerbEntry, slot: VerbPronounSlot): string {
  return verb.praesens[slot];
}

function shuffleArray<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildFallbackConjugationDistractor(verb: VerbEntry, slot: VerbPronounSlot): string {
  const stemRaw = (verb.stemInfinitive || verb.infinitive.replace(/^sich\s+/i, '')).replace(/e?n$/, '');
  const prefixSuffix = verb.isSeparable && verb.separablePrefix ? ` ${verb.separablePrefix}` : '';
  const suffixMap: Record<VerbPronounSlot, string> = {
    ich: `${stemRaw}e${prefixSuffix}`,
    du: `${stemRaw}st${prefixSuffix}`,
    er_sie_es: `${stemRaw}t${prefixSuffix}`,
    wir: `${stemRaw}en${prefixSuffix}`,
    ihr: `${stemRaw}et${prefixSuffix}`,
    sie_Sie: `${stemRaw}en${prefixSuffix}`
  };
  return suffixMap[slot];
}

/**
 * Generates strictly unique MCQ options for a verb conjugation prompt.
 * Never produces duplicate homographs (e.g., er/ihr or wir/sie) and always contains correctAnswer.
 */
export function buildSafeVerbConjugationOptions(
  verb: VerbEntry,
  targetSlot: VerbPronounSlot,
  maxOptions = 4
): { options: string[]; correctAnswer: string } {
  const correctAnswer = verb.praesens[targetSlot];
  const uniqueOtherForms = new Set<string>();

  const slots: VerbPronounSlot[] = ['ich', 'du', 'er_sie_es', 'wir', 'ihr', 'sie_Sie'];
  for (const s of slots) {
    const form = verb.praesens[s];
    if (form && form.toLowerCase() !== correctAnswer.toLowerCase()) {
      uniqueOtherForms.add(form);
    }
  }

  const distractors = shuffleArray(Array.from(uniqueOtherForms));

  // If verb has fewer than (maxOptions - 1) distinct forms (very rare, e.g. modal with extra regularized misses), pad carefully
  if (distractors.length < maxOptions - 1) {
    for (const s of slots) {
      const candidate = buildFallbackConjugationDistractor(verb, s);
      if (
        candidate.toLowerCase() !== correctAnswer.toLowerCase() &&
        !distractors.some((d) => d.toLowerCase() === candidate.toLowerCase())
      ) {
        distractors.push(candidate);
      }
      if (distractors.length >= maxOptions - 1) break;
    }
  }

  const chosenDistractors = distractors.slice(0, Math.max(1, maxOptions - 1));
  const options = shuffleArray([correctAnswer, ...chosenDistractors]);
  return { options, correctAnswer };
}

export interface VerbConjugationExercise {
  verbId: string;
  infinitive: string;
  arabic: string;
  subjectPrompt: VerbSubjectPrompt;
  promptDe: string;
  promptAr: string;
  correctAnswer: string;
  options: string[];
}

export function buildVerbConjugationExercise(
  verb: VerbEntry,
  subjectPrompt: VerbSubjectPrompt,
  maxOptions = 4
): VerbConjugationExercise {
  const { options, correctAnswer } = buildSafeVerbConjugationOptions(
    verb,
    subjectPrompt.slot,
    maxOptions
  );
  return {
    verbId: verb.id,
    infinitive: verb.infinitive,
    arabic: verb.arabic,
    subjectPrompt,
    promptDe: `${subjectPrompt.labelDe} ______ (${verb.infinitive})`,
    promptAr: `صرّف الفعل "${verb.infinitive}" (${verb.arabic}) مع الضمير: ${subjectPrompt.displayLabel}`,
    correctAnswer,
    options
  };
}

export interface VerbSentenceGapExercise {
  verbId: string;
  infinitive: string;
  arabic: string;
  sentenceOriginal: string;
  sentenceArabic: string;
  sentenceWithBlank: string;
  correctAnswer: string;
  finiteVerbCore: string;
  isSeparable: boolean;
  separablePrefix?: string;
  options: string[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFiniteCore(fullForm: string, verb: VerbEntry): string {
  let core = fullForm.trim();
  if (verb.isSeparable && verb.separablePrefix) {
    const suf = ` ${verb.separablePrefix}`;
    if (core.toLowerCase().endsWith(suf.toLowerCase())) {
      core = core.slice(0, core.length - suf.length).trim();
    }
  }
  if (verb.isReflexive) {
    core = core.replace(/\s+(mich|dich|sich|uns|euch|mir|dir)$/i, '').trim();
  }
  return core;
}

function matchCaseLike(sample: string, target: string): string {
  if (!sample || !target) return target;
  const first = sample.charAt(0);
  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target.charAt(0).toLowerCase() + target.slice(1);
}

/**
 * Extracts a clean finite-verb (and separated prefix) gap sentence with bracketed infinitive hint:
 * e.g. "Ich ______ montags um sechs Uhr ______. (aufstehen)"
 */
export function buildVerbSentenceGapExercise(
  verb: VerbEntry,
  distractorVerbPool: readonly VerbEntry[] = ALL_VERBS
): VerbSentenceGapExercise {
  const sentence = verb.exampleGerman.trim();
  const slotForms = (Object.values(verb.praesens) as string[])
    .map((f) => extractFiniteCore(f, verb))
    .filter(Boolean);
  const uniqueCores = Array.from(new Set(slotForms)).sort((a, b) => b.length - a.length);

  let matchedCore = '';
  let matchedIndex = -1;

  for (const core of uniqueCores) {
    const re = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])(${escapeRegex(core)})(?=$|[^A-Za-zÄÖÜäöüß])`, 'i');
    const m = re.exec(sentence);
    if (m) {
      matchedCore = m[2];
      matchedIndex = m.index + m[1].length;
      break;
    }
  }

  if (!matchedCore || matchedIndex === -1) {
    // Graceful fallback using 3rd-person singular form
    const fallbackCore = extractFiniteCore(verb.praesens.er_sie_es, verb);
    const answer =
      verb.isSeparable && verb.separablePrefix
        ? `${fallbackCore} ... ${verb.separablePrefix}`
        : fallbackCore;
    const rawOptions = Array.from(
      new Set(
        (Object.values(verb.praesens) as string[]).map((f) => {
          const c = extractFiniteCore(f, verb);
          return verb.isSeparable && verb.separablePrefix
            ? `${c} ... ${verb.separablePrefix}`
            : c;
        })
      )
    );
    const distractors = rawOptions.filter((o) => o.toLowerCase() !== answer.toLowerCase()).slice(0, 3);
    while (distractors.length < 3) {
      const cand = distractorVerbPool[Math.floor(Math.random() * distractorVerbPool.length)];
      if (cand && cand.id !== verb.id) {
        const cCore = extractFiniteCore(cand.praesens.er_sie_es, cand);
        const opt =
          cand.isSeparable && cand.separablePrefix ? `${cCore} ... ${cand.separablePrefix}` : cCore;
        if (opt.toLowerCase() !== answer.toLowerCase() && !distractors.includes(opt)) {
          distractors.push(opt);
        }
      } else {
        break;
      }
    }
    return {
      verbId: verb.id,
      infinitive: verb.infinitive,
      arabic: verb.arabic,
      sentenceOriginal: sentence,
      sentenceArabic: verb.exampleArabic,
      sentenceWithBlank: `${sentence} — ______ (${verb.infinitive})`,
      correctAnswer: answer,
      finiteVerbCore: fallbackCore,
      isSeparable: verb.isSeparable,
      separablePrefix: verb.separablePrefix,
      options: shuffleArray([answer, ...distractors.slice(0, 3)])
    };
  }

  const beforeCore = sentence.slice(0, matchedIndex);
  const afterCore = sentence.slice(matchedIndex + matchedCore.length);

  let sentenceWithBlank = '';
  let correctAnswer = matchedCore;

  if (verb.isSeparable && verb.separablePrefix) {
    const prefixRe = new RegExp(
      `(^|[^A-Za-zÄÖÜäöüß])(${escapeRegex(verb.separablePrefix)})(?=$|[^A-Za-zÄÖÜäöüß])`,
      'i'
    );
    // Prefer matching the separable prefix after the finite verb; fallback to anywhere
    const afterMatch = prefixRe.exec(afterCore);
    if (afterMatch) {
      const pIdx = afterMatch.index + afterMatch[1].length;
      const matchedPrefix = afterMatch[2];
      const blankedAfter =
        afterCore.slice(0, pIdx) + '______' + afterCore.slice(pIdx + matchedPrefix.length);
      sentenceWithBlank = `${beforeCore}______${blankedAfter} (${verb.infinitive})`;
      correctAnswer = `${matchedCore} ... ${matchedPrefix}`;
    } else {
      const fullMatch = prefixRe.exec(beforeCore);
      if (fullMatch) {
        const pIdx = fullMatch.index + fullMatch[1].length;
        const matchedPrefix = fullMatch[2];
        const blankedBefore =
          beforeCore.slice(0, pIdx) + '______' + beforeCore.slice(pIdx + matchedPrefix.length);
        sentenceWithBlank = `${blankedBefore}______${afterCore} (${verb.infinitive})`;
        correctAnswer = `${matchedCore} ... ${matchedPrefix}`;
      } else {
        sentenceWithBlank = `${beforeCore}______${afterCore} (${verb.infinitive})`;
        correctAnswer = `${matchedCore} ... ${verb.separablePrefix}`;
      }
    }
  } else {
    sentenceWithBlank = `${beforeCore}______${afterCore} (${verb.infinitive})`;
    correctAnswer = matchedCore;
  }

  // Build 4 unique plausible MCQ options (combining other conjugations of same verb + wrong prefix/stem distractors)
  const distractorSet = new Set<string>();
  const addDistractor = (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === correctAnswer.toLowerCase()) return;
    if (
      Array.from(distractorSet).some((existing) => existing.toLowerCase() === trimmed.toLowerCase())
    ) {
      return;
    }
    distractorSet.add(trimmed);
  };

  for (const form of Object.values(verb.praesens) as string[]) {
    const core = matchCaseLike(matchedCore, extractFiniteCore(form, verb));
    if (verb.isSeparable && verb.separablePrefix) {
      addDistractor(`${core} ... ${verb.separablePrefix}`);
    } else {
      addDistractor(core);
    }
  }

  // For separable verbs, also offer 1 plausible wrong prefix distractor with the right stem (e.g. stehe ... ein / stehe ... ab)
  if (verb.isSeparable && verb.separablePrefix) {
    const altPrefixes = ['ab', 'an', 'auf', 'aus', 'ein', 'mit', 'vor', 'zu'].filter(
      (p) => p.toLowerCase() !== verb.separablePrefix?.toLowerCase()
    );
    for (const altP of shuffleArray(altPrefixes).slice(0, 2)) {
      addDistractor(`${matchedCore} ... ${altP}`);
    }
  }

  if (distractorSet.size < 3) {
    for (const altVerb of shuffleArray(distractorVerbPool).slice(0, 12)) {
      if (altVerb.id === verb.id) continue;
      const core = matchCaseLike(matchedCore, extractFiniteCore(altVerb.praesens.er_sie_es, altVerb));
      if (verb.isSeparable && verb.separablePrefix) {
        addDistractor(`${core} ... ${verb.separablePrefix}`);
      } else {
        addDistractor(core);
      }
      if (distractorSet.size >= 4) break;
    }
  }

  const finalDistractors = shuffleArray(Array.from(distractorSet)).slice(0, 3);
  const options = shuffleArray([correctAnswer, ...finalDistractors]);

  return {
    verbId: verb.id,
    infinitive: verb.infinitive,
    arabic: verb.arabic,
    sentenceOriginal: sentence,
    sentenceArabic: verb.exampleArabic,
    sentenceWithBlank,
    correctAnswer,
    finiteVerbCore: matchedCore,
    isSeparable: verb.isSeparable,
    separablePrefix: verb.separablePrefix,
    options
  };
}

export function verbEntryToLernstudioItem(
  verb: VerbEntry,
  options?: { includeVerbEntry?: boolean; compact?: boolean }
): LernstudioItem {
  if (options?.compact) {
    return {
      id: verb.id,
      verbId: verb.id,
      german: verb.infinitive,
      arabic: verb.arabic,
      wordType: 'verb',
      category: verb.topics[0] || 'Alltag'
    };
  }
  return {
    id: verb.id,
    german: verb.infinitive,
    arabic: verb.arabic,
    english: verb.english,
    wordType: 'verb',
    conjugation: { ...verb.praesens },
    exampleSentenceGerman: verb.exampleGerman,
    exampleSentenceArabic: verb.exampleArabic,
    category: verb.topics[0] || 'Alltag',
    verbId: verb.id,
    ...(options?.includeVerbEntry ? { verbEntry: verb } : {}),
    classifications: [...verb.classifications],
    ...(verb.separablePrefix ? { separablePrefix: verb.separablePrefix } : {}),
    ...(verb.preposition ? { preposition: verb.preposition } : {}),
    ...(verb.prepositionCase ? { prepositionCase: verb.prepositionCase } : {})
  };
}

export function buildLernstudioSetFromVerbs(options: {
  id: string;
  title: string;
  titleAr?: string;
  verbs: readonly VerbEntry[];
  level?: LernstudioLevel;
  topic?: string;
  createdByTeacherName?: string;
  createdByUid?: string;
  basedOnBuiltinGroupId?: string;
  extraVocabItems?: readonly LernstudioItem[];
  setKind?: 'verb_group' | 'mixed';
  includeEntriesSnapshot?: boolean;
  compactItems?: boolean;
}): LernstudioSet {
  const useCompact = options.compactItems ?? options.verbs.length > 220;
  const verbItems = options.verbs.map((v) =>
    verbEntryToLernstudioItem(v, {
      compact: useCompact,
      includeVerbEntry: Boolean(options.includeEntriesSnapshot)
    })
  );
  const combinedItems = options.extraVocabItems
    ? [...options.extraVocabItems, ...verbItems]
    : verbItems;

  const inferredLevel: LernstudioLevel =
    options.level ||
    (options.verbs[0]?.level as LernstudioLevel) ||
    'A1';

  const setKind = options.setKind || (options.extraVocabItems?.length ? 'mixed' : 'verb_group');

  return {
    id: options.id,
    title: options.title,
    ...(options.titleAr ? { titleTranslations: { ar: options.titleAr, de: options.title } } : {}),
    level: inferredLevel,
    topic: options.topic || 'Verben',
    difficulty: inferredLevel === 'B1' ? 'hard' : inferredLevel === 'A2' ? 'medium' : 'easy',
    hasArticles: Boolean(options.extraVocabItems?.some((i) => Boolean(i.article))),
    sentenceBuilderSupported: false,
    items: combinedItems,
    setKind,
    verbIds: options.verbs.map((v) => v.id),
    ...(options.includeEntriesSnapshot ? { verbEntriesSnapshot: [...options.verbs] } : {}),
    ...(options.basedOnBuiltinGroupId ? { basedOnBuiltinGroupId: options.basedOnBuiltinGroupId } : {}),
    ...(options.createdByTeacherName ? { createdByTeacherName: options.createdByTeacherName } : {}),
    ...(options.createdByUid ? { createdByUid: options.createdByUid } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
}

export function isItemVerb(item?: Partial<LernstudioItem> | null): boolean {
  if (!item) return false;
  if (item.wordType === 'verb') return true;
  if (item.verbId || item.verbEntry) return true;
  if (item.conjugation && Object.values(item.conjugation).some((v) => String(v || '').trim())) {
    return true;
  }
  return false;
}

export function resolveVerbFromLernstudioItem(item?: Partial<LernstudioItem> | null): VerbEntry | null {
  if (!item) return null;
  if (item.verbEntry) return item.verbEntry;
  if (item.verbId) {
    const byId = getVerbById(item.verbId);
    if (byId) return byId;
  }
  if (item.german) {
    const byInf = getVerbByInfinitive(item.german);
    if (byInf) return byInf;
  }
  if (item.conjugation && item.german) {
    // Synthesize a temporary VerbEntry from custom-edited conjugation table
    return {
      id: item.id || `custom_${item.german.toLowerCase().replace(/\s+/g, '_')}`,
      infinitive: item.german,
      arabic: item.arabic || '',
      english: item.english,
      level: 'A1',
      praesens: { ...item.conjugation },
      classifications: item.classifications && item.classifications.length > 0 ? item.classifications : ['regelmäßig'],
      isSeparable: Boolean(item.separablePrefix),
      ...(item.separablePrefix ? { separablePrefix: item.separablePrefix } : {}),
      isReflexive: item.german.toLowerCase().startsWith('sich '),
      ...(item.preposition ? { preposition: item.preposition } : {}),
      exampleGerman: item.exampleSentenceGerman || '',
      exampleArabic: item.exampleSentenceArabic || '',
      topics: ['Alltag'],
      meta: {
        version: 'custom',
        verified: true,
        source: 'Teacher Custom Entry',
        conjugationPattern: 'regular'
      }
    };
  }
  return null;
}

/**
 * Single authoritative calculation of homework question count across vocab, verb, and mixed assignments.
 * Guarantees 20 verbs × 6 pronouns = 120 for verb_conjugation when no custom per-stage cap is supplied.
 */
export function calculateUnifiedHomeworkQuestionCount(options: {
  questionTypes: readonly HomeworkQuestionType[];
  questionTypeCounts?: Partial<Record<HomeworkQuestionType, number>>;
  vocabItemsCount: number;
  verbCount: number;
  contentSource?: HomeworkContentSource;
}): number {
  const { questionTypes, questionTypeCounts = {}, vocabItemsCount, verbCount } = options;
  if (!questionTypes || questionTypes.length === 0) return 0;

  let total = 0;
  for (const qt of questionTypes) {
    const custom = questionTypeCounts[qt];
    if (typeof custom === 'number' && Number.isFinite(custom) && custom > 0) {
      total += Math.floor(custom);
      continue;
    }

    if (qt === 'verb_conjugation') {
      total += Math.max(0, verbCount) * 6;
    } else if (qt === 'verb_sentence') {
      total += Math.max(0, verbCount);
    } else {
      total += Math.max(0, vocabItemsCount);
    }
  }
  return total;
}

/**
 * Builds the German pronunciation string for Teacher Study & Teacher Mode flashcards.
 * For verbs, reads the infinitive followed by all 6 Präsens conjugations cleanly;
 * for non-verb items, returns the German word/phrase.
 */
export function buildTeacherStudySpeechText(
  item?: Partial<LernstudioItem> | null,
  explicitVerb?: VerbEntry | null
): string {
  if (!item) return '';
  const verb = explicitVerb || resolveVerbFromLernstudioItem(item);
  const conj = verb?.praesens || item.conjugation;
  const infinitive = (verb?.infinitive || item.german || '').trim();

  if (conj && infinitive) {
    const parts: string[] = [infinitive];
    const ich = conj.ich?.trim();
    const du = conj.du?.trim();
    const er = conj.er_sie_es?.trim();
    const wir = conj.wir?.trim();
    const ihr = conj.ihr?.trim();
    const sie = conj.sie_Sie?.trim();

    if (ich) parts.push(`ich ${ich}`);
    if (du) parts.push(`du ${du}`);
    if (er) parts.push(`er, sie, es ${er}`);
    if (wir) parts.push(`wir ${wir}`);
    if (ihr) parts.push(`ihr ${ihr}`);
    if (sie) parts.push(`sie ${sie}`);

    if (parts.length > 1) {
      return `${parts.join('. ')}.`;
    }
  }

  return (item.german || '').trim();
}

