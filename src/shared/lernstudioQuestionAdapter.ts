import {
  ExerciseSourceOrigin,
  GrammarExercise,
  GrammarExerciseType,
  LernstudioGameMode,
  LernstudioItem,
  LernstudioSet,
  LernstudioSetKind
} from '../types/lernstudio';
import { getItemTranslation } from './lernstudioTranslations';
import {
  evaluateNormalizedGrammarAnswer,
  getGrammarLessonExercises,
  getLocalizedGrammarField,
  inferSetKind
} from './grammarEngine';
import { getSetPlayableItems } from './lernstudioVocabularyAdapter';
import {
  ALL_VERBS,
  buildVerbConjugationExercise,
  buildVerbSentenceGapExercise,
  isItemVerb,
  PRONOUN_ONLY_SUBJECT_PROMPTS,
  resolveVerbFromLernstudioItem,
  SUBJECT_PROMPTS
} from './verbEngine';
import type { VerbEntry } from './verbLibrary/verbTypes';

export type GameQuestionModeFilter =
  | 'mixed'
  | 'de_to_ar'
  | 'ar_to_de'
  | 'article'
  | 'audio'
  | 'verb_conjugation'
  | 'verb_sentence'
  | 'grammar';

export interface GameQuestion {
  id: string;
  type:
    | 'multiple_choice'
    | 'der_die_das'
    | 'missing_letter'
    | 'sentence_builder'
    | 'plural_match'
    | 'emoji_vocab'
    | 'scrambled_letters'
    | 'verb_conjugation'
    | 'verb_sentence'
    | 'grammar_exercise';
  prompt: string;
  subPrompt?: string;
  emoji?: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanation?: string;
  itemRef?: LernstudioItem;
  verbRef?: VerbEntry;
  sentencePieces?: string[];
  missingLetterWord?: string;
  subjectLabel?: string;
  grammarType?: GrammarExerciseType;
  sentenceWithBlank?: string;
  faultySentence?: string;
  tokens?: string[];
  sourceOrigin?: ExerciseSourceOrigin;
  isUncertain?: boolean;
}

export interface BuildDynamicQuestionPoolOptions {
  questionModeFilter?: GameQuestionModeFilter;
  includeVerbExercises?: boolean;
  subjectPoolMode?: 'pronouns_and_names' | 'pronouns_only';
}

export type GameCompatibilityStatus = 'supported' | 'adapted' | 'unsupported';

export interface GameCompatibilityRule {
  status: GameCompatibilityStatus;
  reasonAr: string;
  reasonDe: string;
  reasonEn: string;
}

export interface ResolvedGameCompatibility extends GameCompatibilityRule {
  isPlayable: boolean;
  localizedReason: string;
}

const FULL_NATIVE: GameCompatibilityRule = {
  status: 'supported',
  reasonAr: 'مدعومة بالكامل لهذا النوع من المجموعات',
  reasonDe: 'Für diesen Set-Typ vollständig unterstützt',
  reasonEn: 'Fully supported for this set type'
};

const UNSUPPORTED_GRAMMAR_VOCAB_ONLY: GameCompatibilityRule = {
  status: 'unsupported',
  reasonAr: 'هذه اللعبة مخصصة لمجموعات المفردات والأفعال ولا تدعم دروس القواعد الخالصة بدون مفردات',
  reasonDe: 'Dieses Spiel ist für Wortschatz- und Verbsets gedacht und nicht für reine Grammatiksets geeignet',
  reasonEn: 'This arcade mode is designed for vocabulary/verb sets and is disabled for pure grammar sets'
};

const ARTICLE_UNSUPPORTED_VERBS: GameCompatibilityRule = {
  status: 'unsupported',
  reasonAr: 'لعبة فرز الأدوات (der/die/das) تتطلب أسماء بأدوات تعريف ولا تناسب مجموعات الأفعال فقط',
  reasonDe: 'Artikelsortierung erfordert Nomen mit Artikeln (nicht für reine Verbgruppen)',
  reasonEn: 'Article sorting requires nouns with der/die/das articles'
};

const ARTICLE_UNSUPPORTED_GRAMMAR: GameCompatibilityRule = {
  status: 'unsupported',
  reasonAr: 'فرز الأدوات يتطلب مجموعة مفردات أو مجموعة مختلطة تحتوي على أسماء بأدوات',
  reasonDe: 'Artikelsortierung erfordert mindestens 2 Nomen mit Artikel',
  reasonEn: 'Requires at least 2 German nouns with der/die/das articles'
};

const WORD_SPELLING_UNSUPPORTED_GRAMMAR: GameCompatibilityRule = {
  status: 'unsupported',
  reasonAr: 'تخمين الحروف حرفاً بحرف مخصص لمجموعات الكلمات والأفعال',
  reasonDe: 'Buchstaben-Raten ist für Wort- und Verbsets gedacht',
  reasonEn: 'Letter-by-letter spelling is designed for word and verb sets'
};

const VOCAB_ONLY_GAME_MODES = new Set<LernstudioGameMode>([
  'memory',
  'balloon_pop',
  'tictactoe',
  'ultimate_tictactoe',
  'basket_catch',
  'space_defense',
  'whack_a_mole',
  'tug_of_war',
  'word_ninja',
  'bridge_builder',
  'color_master',
  'factory_machine',
  'follow_clues',
  'island_crossing',
  'pit_stop',
  'puzzle_masters',
  'robot_repair',
  'rocket_countdown',
  'space_fleet',
  'submarine_explore',
  'target_attack',
  'team_auction',
  'tower_architects',
  'vending_machine',
  'whats_in_box',
  'word_rhythm',
  'word_wash'
]);

const VOCAB_KINDS_SUPPORTED: Record<LernstudioSetKind, GameCompatibilityRule> = {
  vocab: FULL_NATIVE,
  verb_group: FULL_NATIVE,
  grammar: UNSUPPORTED_GRAMMAR_VOCAB_ONLY,
  mixed: FULL_NATIVE
};

/**
 * Explicit compatibility matrix covering every LernstudioGameMode across all 4 Set kinds.
 */
export const GAME_COMPATIBILITY_MAP: Record<
  LernstudioGameMode,
  Record<LernstudioSetKind, GameCompatibilityRule>
> = {
  hub: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  games_portal: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  game: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  classroom: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  wheel: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  race: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  sentence_builder: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  solo_sentence: { vocab: FULL_NATIVE, verb_group: FULL_NATIVE, grammar: FULL_NATIVE, mixed: FULL_NATIVE },
  sorting: {
    vocab: FULL_NATIVE,
    verb_group: ARTICLE_UNSUPPORTED_VERBS,
    grammar: ARTICLE_UNSUPPORTED_GRAMMAR,
    mixed: FULL_NATIVE
  },
  word_detective: {
    vocab: FULL_NATIVE,
    verb_group: FULL_NATIVE,
    grammar: WORD_SPELLING_UNSUPPORTED_GRAMMAR,
    mixed: FULL_NATIVE
  },
  memory: VOCAB_KINDS_SUPPORTED,
  balloon_pop: VOCAB_KINDS_SUPPORTED,
  tictactoe: VOCAB_KINDS_SUPPORTED,
  ultimate_tictactoe: VOCAB_KINDS_SUPPORTED,
  basket_catch: VOCAB_KINDS_SUPPORTED,
  space_defense: VOCAB_KINDS_SUPPORTED,
  whack_a_mole: VOCAB_KINDS_SUPPORTED,
  tug_of_war: VOCAB_KINDS_SUPPORTED,
  word_ninja: VOCAB_KINDS_SUPPORTED,
  bridge_builder: VOCAB_KINDS_SUPPORTED,
  color_master: VOCAB_KINDS_SUPPORTED,
  factory_machine: VOCAB_KINDS_SUPPORTED,
  follow_clues: VOCAB_KINDS_SUPPORTED,
  island_crossing: VOCAB_KINDS_SUPPORTED,
  pit_stop: VOCAB_KINDS_SUPPORTED,
  puzzle_masters: VOCAB_KINDS_SUPPORTED,
  robot_repair: VOCAB_KINDS_SUPPORTED,
  rocket_countdown: VOCAB_KINDS_SUPPORTED,
  space_fleet: VOCAB_KINDS_SUPPORTED,
  submarine_explore: VOCAB_KINDS_SUPPORTED,
  target_attack: VOCAB_KINDS_SUPPORTED,
  team_auction: VOCAB_KINDS_SUPPORTED,
  tower_architects: VOCAB_KINDS_SUPPORTED,
  vending_machine: VOCAB_KINDS_SUPPORTED,
  whats_in_box: VOCAB_KINDS_SUPPORTED,
  word_rhythm: VOCAB_KINDS_SUPPORTED,
  word_wash: VOCAB_KINDS_SUPPORTED
};

/**
 * Resolves live game compatibility for a concrete LernstudioSet (including dynamic checks
 * for articles, grammar exercises, sentence-ordering sentences, and playable pair counts).
 */
export function getGameCompatibilityForSet(
  gameId: LernstudioGameMode,
  set?: LernstudioSet | null,
  language: string = 'ar'
): ResolvedGameCompatibility {
  const safeLang = (language || 'ar').toLowerCase();
  const pickReason = (rule: GameCompatibilityRule) =>
    safeLang === 'de' ? rule.reasonDe : safeLang === 'en' ? rule.reasonEn : rule.reasonAr;

  if (!set) {
    const emptyRule: GameCompatibilityRule = {
      status: 'unsupported',
      reasonAr: 'لا توجد مجموعة مختارة',
      reasonDe: 'Kein Set ausgewählt',
      reasonEn: 'No learning set selected'
    };
    return { ...emptyRule, isPlayable: false, localizedReason: pickReason(emptyRule) };
  }

  const kind = inferSetKind(set);
  const baseRule = GAME_COMPATIBILITY_MAP[gameId]?.[kind] || FULL_NATIVE;

  // Dynamic overrides based on actual set contents
  if (gameId === 'sorting') {
    if (!isArticleGameSupported(set)) {
      const rule = kind === 'verb_group' ? ARTICLE_UNSUPPORTED_VERBS : ARTICLE_UNSUPPORTED_GRAMMAR;
      return { ...rule, isPlayable: false, localizedReason: pickReason(rule) };
    }
    return { ...FULL_NATIVE, isPlayable: true, localizedReason: pickReason(FULL_NATIVE) };
  }

  if (gameId === 'word_detective' && kind === 'grammar' && (!set.items || set.items.length === 0)) {
    return {
      ...WORD_SPELLING_UNSUPPORTED_GRAMMAR,
      isPlayable: false,
      localizedReason: pickReason(WORD_SPELLING_UNSUPPORTED_GRAMMAR)
    };
  }

  if (gameId === 'sentence_builder' || gameId === 'solo_sentence') {
    const sQuestions = buildSentenceGameQuestions(set, safeLang);
    if (sQuestions.length === 0) {
      const rule: GameCompatibilityRule = {
        status: 'unsupported',
        reasonAr: 'لا توجد جمل كافية لترتيب الكلمات في هذه المجموعة',
        reasonDe: 'Nicht genügend Sätze für die Satzbau-Übung vorhanden',
        reasonEn: 'Not enough sentences available for sentence ordering'
      };
      return { ...rule, isPlayable: false, localizedReason: pickReason(rule) };
    }
  }

  if (VOCAB_ONLY_GAME_MODES.has(gameId)) {
    const realItemsCount = Array.isArray(set.items) ? set.items.length : 0;
    if (kind === 'grammar' || realItemsCount === 0) {
      return {
        ...UNSUPPORTED_GRAMMAR_VOCAB_ONLY,
        isPlayable: false,
        localizedReason: pickReason(UNSUPPORTED_GRAMMAR_VOCAB_ONLY)
      };
    }
    if (gameId === 'memory') {
      const cards = generateMemoryCardsForSet(set, 4, safeLang);
      if (cards.length < 4) {
        const rule: GameCompatibilityRule = {
          status: 'unsupported',
          reasonAr: 'تتطلب لعبة الذاكرة مفردتين على الأقل للمطابقة',
          reasonDe: 'Memory benötigt mindestens 2 Vokabelpaare',
          reasonEn: 'Memory requires at least 2 vocabulary items'
        };
        return { ...rule, isPlayable: false, localizedReason: pickReason(rule) };
      }
    }
  }

  const playableCount = getSetPlayableItems(set).length + getGrammarLessonExercises(set).length;
  if (playableCount === 0) {
    const emptySetRule: GameCompatibilityRule = {
      status: 'unsupported',
      reasonAr: 'المجموعة لا تحتوي على عناصر أو تمارين كافية بعد',
      reasonDe: 'Dieses Set enthält noch keine spielbaren Inhalte',
      reasonEn: 'This set does not have playable items or exercises yet'
    };
    return { ...emptySetRule, isPlayable: false, localizedReason: pickReason(emptySetRule) };
  }

  return {
    ...baseRule,
    isPlayable: baseRule.status !== 'unsupported',
    localizedReason: pickReason(baseRule)
  };
}

/**
 * Evaluates a student answer against any GameQuestion using normalized German grammar comparison.
 */
export function evaluateGameQuestionAnswer(
  studentAnswer: string | undefined | null,
  question: Pick<GameQuestion, 'correctAnswer' | 'acceptedAnswers'>
): boolean {
  return evaluateNormalizedGrammarAnswer(studentAnswer, {
    correctAnswer: question.correctAnswer,
    acceptedAnswers: question.acceptedAnswers
  });
}

/**
 * Extracts definite article from a German string if present
 */
export function extractGermanArticle(german: string): 'der' | 'die' | 'das' | null {
  const match = german.trim().match(/^(der|die|das)\b/i);
  if (match) {
    return match[1].toLowerCase() as 'der' | 'die' | 'das';
  }
  return null;
}

/**
 * Strips definite article from a German noun
 */
export function cleanGermanNoun(german: string): string {
  return german.replace(/^(der|die|das)\s+/i, '').trim();
}

function buildUniqueDistractors(
  correctValue: string,
  candidatePool: string[],
  fallbackPool: string[] = [],
  limit = 3
): string[] {
  const seen = new Set<string>([correctValue.trim().toLowerCase()]);
  const picked: string[] = [];

  for (const cand of [...candidatePool, ...fallbackPool]) {
    const trimmed = String(cand || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(trimmed);
    if (picked.length >= limit) break;
  }

  return picked;
}

export function buildGrammarExerciseOptions(
  ex: GrammarExercise,
  allGrammarExercises: GrammarExercise[]
): string[] | undefined {
  if (ex.type === 'short_answer' || ex.type === 'sentence_ordering') {
    return undefined;
  }

  if (Array.isArray(ex.options) && ex.options.length >= 2) {
    const deduped = Array.from(new Set(ex.options.map((o) => String(o || '').trim()).filter(Boolean)));
    const hasCorrect = deduped.some(
      (o) => o.trim().toLowerCase() === ex.correctAnswer.trim().toLowerCase()
    );
    return hasCorrect ? deduped : [ex.correctAnswer, ...deduped];
  }

  const sameTypePeerAnswers = allGrammarExercises
    .filter((other) => other.id !== ex.id && other.type === ex.type && other.correctAnswer)
    .map((other) => other.correctAnswer);

  const distractors = buildUniqueDistractors(ex.correctAnswer, sameTypePeerAnswers, [], 3);
  if (distractors.length >= 1) {
    return [ex.correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
  }
  return undefined;
}

/**
 * Dynamically builds a rich pool of questions from a Lernstudio set (vocab, verb group, grammar, or mixed),
 * combining grammar exercises, custom exercises, verb conjugation & verb-in-sentence tasks from the Shared Verb Engine,
 * and vocabulary exercises.
 */
export function buildDynamicQuestionPool(
  set: LernstudioSet,
  language: string = 'ar',
  poolOptions?: BuildDynamicQuestionPoolOptions
): GameQuestion[] {
  const pool: GameQuestion[] = [];
  const items = set.items || [];
  const grammarExercises = getGrammarLessonExercises(set);

  if (
    items.length === 0 &&
    grammarExercises.length === 0 &&
    (!set.customExercises || set.customExercises.length === 0)
  ) {
    return pool;
  }

  const safeLang = (language || 'ar').toLowerCase();
  const modeFilter: GameQuestionModeFilter = poolOptions?.questionModeFilter || 'mixed';
  const subjectPool =
    poolOptions?.subjectPoolMode === 'pronouns_only'
      ? PRONOUN_ONLY_SUBJECT_PROMPTS
      : SUBJECT_PROMPTS;

  // 0. Incorporate unified Grammar Exercises (`grammarContent.exercises` + grammar `customExercises`)
  if (grammarExercises.length > 0 && (modeFilter === 'mixed' || modeFilter === 'grammar')) {
    const grammarIdsSeen = new Set<string>();
    grammarExercises.forEach((ex, idx) => {
      grammarIdsSeen.add(ex.id);
      const options = buildGrammarExerciseOptions(ex, grammarExercises);
      const localizedExplanation =
        getLocalizedGrammarField(ex as any, 'explanation', safeLang) || ex.explanation;

      const sentencePieces =
        ex.type === 'sentence_ordering'
          ? (ex.tokens && ex.tokens.length >= 2
              ? [...ex.tokens]
              : ex.correctAnswer.split(/\s+/).filter(Boolean))
          : undefined;

      pool.push({
        id: ex.id || `gram_q_${idx}`,
        type: 'grammar_exercise',
        grammarType: ex.type,
        prompt: ex.question || ex.sentenceWithBlank || ex.faultySentence || ex.prompt || '',
        subPrompt:
          ex.faultySentence && ex.faultySentence !== ex.question
            ? ex.faultySentence
            : ex.prompt && ex.prompt !== ex.question
            ? ex.prompt
            : undefined,
        emoji: '📘',
        options,
        correctAnswer: ex.correctAnswer,
        acceptedAnswers: ex.acceptedAnswers,
        explanation: localizedExplanation,
        sentencePieces,
        sentenceWithBlank: ex.sentenceWithBlank,
        faultySentence: ex.faultySentence,
        tokens: ex.tokens,
        sourceOrigin: ex.source,
        isUncertain: ex.isUncertain
      });
    });

    // Incorporate any remaining non-grammar customExercises (skip already added)
    if (set.customExercises && set.customExercises.length > 0 && modeFilter !== 'grammar') {
      set.customExercises.forEach((ex, idx) => {
        if (grammarIdsSeen.has(ex.id)) return;
        let options = ex.options;
        if ((!options || options.length === 0) && ex.correctAnswer) {
          const words = ex.correctAnswer.split(' ').filter(Boolean);
          if (words.length >= 2) {
            const correctSent = ex.correctAnswer;
            const perm1 = [...words].sort(() => 0.5 - Math.random()).join(' ');
            const perm2 = [...words].reverse().join(' ');
            const perm3 = [...words].sort(() => Math.random() - 0.5).join(' ');
            options = Array.from(new Set([correctSent, perm1, perm2, perm3]))
              .filter(Boolean)
              .sort(() => 0.5 - Math.random());
          }
        }
        pool.push({
          id: ex.id || `custom_${idx}`,
          type: ex.type as GameQuestion['type'],
          prompt: ex.question,
          options,
          correctAnswer: ex.correctAnswer,
          acceptedAnswers: ex.acceptedAnswers,
          explanation: ex.explanation
        });
      });
    }
  } else if (set.customExercises && set.customExercises.length > 0 && modeFilter !== 'article') {
    // Legacy customExercises handling for vocab/verb sets
    set.customExercises.forEach((ex, idx) => {
      let options = ex.options;
      if ((!options || options.length === 0) && ex.correctAnswer) {
        const words = ex.correctAnswer.split(' ').filter(Boolean);
        if (words.length >= 2) {
          const correctSent = ex.correctAnswer;
          const perm1 = [...words].sort(() => 0.5 - Math.random()).join(' ');
          const perm2 = [...words].reverse().join(' ');
          const perm3 = [...words].sort(() => Math.random() - 0.5).join(' ');
          options = Array.from(new Set([correctSent, perm1, perm2, perm3]))
            .filter(Boolean)
            .sort(() => 0.5 - Math.random());
        }
      }

      pool.push({
        id: ex.id || `custom_${idx}`,
        type: ex.type as GameQuestion['type'],
        prompt: ex.question,
        options,
        correctAnswer: ex.correctAnswer,
        acceptedAnswers: ex.acceptedAnswers,
        explanation: ex.explanation
      });
    });
  }

  // Fallback German/Arabic banks for small sets (< 4 items) so MCQ distractors stay valid
  const fallbackGermanVerbs = ALL_VERBS.slice(0, 20).map((v) => v.infinitive);
  const fallbackArabicVerbs = ALL_VERBS.slice(0, 20).map((v) => v.arabic);

  const verbEntriesInSet: VerbEntry[] = items
    .map((it) => (isItemVerb(it) ? resolveVerbFromLernstudioItem(it) : null))
    .filter((v): v is VerbEntry => Boolean(v));

  // 2. Generate questions dynamically for each vocabulary / verb item
  items.forEach((item, index) => {
    const itemIsVerb = isItemVerb(item) || set.setKind === 'verb_group';
    const verbEntry = itemIsVerb ? resolveVerbFromLernstudioItem(item) : null;
    const article = itemIsVerb ? null : item.article || extractGermanArticle(item.german);
    const nounOnly = cleanGermanNoun(item.german);
    const itemTrans = getItemTranslation(item, safeLang);

    // A) Verb Conjugation exercises via Shared Verb Engine
    if (
      verbEntry &&
      (modeFilter === 'mixed' || modeFilter === 'verb_conjugation') &&
      poolOptions?.includeVerbExercises !== false
    ) {
      const chosenPrompt = subjectPool[(index * 5 + Math.floor(Math.random() * subjectPool.length)) % subjectPool.length];
      const conjEx = buildVerbConjugationExercise(verbEntry, chosenPrompt, 4);
      const promptText =
        safeLang === 'de'
          ? `Konjugiere "${verbEntry.infinitive}" für: ${chosenPrompt.labelDe}`
          : safeLang === 'en'
          ? `Conjugate "${verbEntry.infinitive}" (${verbEntry.arabic}) for: ${chosenPrompt.labelDe}`
          : `صرّف الفعل "${verbEntry.infinitive}" (${verbEntry.arabic}) مع: ${chosenPrompt.displayLabel}`;

      pool.push({
        id: `dyn_vconj_${verbEntry.id}_${index}`,
        type: 'verb_conjugation',
        prompt: promptText,
        subPrompt: `${chosenPrompt.labelDe} ______ (${verbEntry.infinitive})`,
        emoji: item.emoji || '🔤',
        options: conjEx.options,
        correctAnswer: conjEx.correctAnswer,
        explanation: `${chosenPrompt.labelDe} ${conjEx.correctAnswer} — ${verbEntry.arabic}`,
        itemRef: item,
        verbRef: verbEntry,
        subjectLabel: chosenPrompt.displayLabel
      });

      if (modeFilter === 'verb_conjugation') {
        const secondPrompt = subjectPool[(index + 7) % subjectPool.length];
        const conjEx2 = buildVerbConjugationExercise(verbEntry, secondPrompt, 4);
        pool.push({
          id: `dyn_vconj2_${verbEntry.id}_${index}`,
          type: 'verb_conjugation',
          prompt:
            safeLang === 'de'
              ? `Konjugiere "${verbEntry.infinitive}" für: ${secondPrompt.labelDe}`
              : `صرّف الفعل "${verbEntry.infinitive}" (${verbEntry.arabic}) مع: ${secondPrompt.displayLabel}`,
          subPrompt: `${secondPrompt.labelDe} ______ (${verbEntry.infinitive})`,
          emoji: item.emoji || '🔤',
          options: conjEx2.options,
          correctAnswer: conjEx2.correctAnswer,
          explanation: `${secondPrompt.labelDe} ${conjEx2.correctAnswer} — ${verbEntry.arabic}`,
          itemRef: item,
          verbRef: verbEntry,
          subjectLabel: secondPrompt.displayLabel
        });
      }
    }

    // B) Verb in Sentence exercises via Shared Verb Engine
    if (
      verbEntry &&
      verbEntry.exampleGerman &&
      (modeFilter === 'mixed' || modeFilter === 'verb_sentence') &&
      poolOptions?.includeVerbExercises !== false
    ) {
      const gapEx = buildVerbSentenceGapExercise(
        verbEntry,
        verbEntriesInSet.length >= 4 ? verbEntriesInSet : ALL_VERBS
      );
      pool.push({
        id: `dyn_vsent_${verbEntry.id}_${index}`,
        type: 'verb_sentence',
        prompt: gapEx.sentenceWithBlank,
        subPrompt:
          safeLang === 'en'
            ? verbEntry.english || verbEntry.arabic
            : gapEx.sentenceArabic || verbEntry.arabic,
        emoji: item.emoji || '✍️',
        options: gapEx.options,
        correctAnswer: gapEx.correctAnswer,
        explanation: `${gapEx.sentenceOriginal} — ${gapEx.sentenceArabic}`,
        itemRef: item,
        verbRef: verbEntry
      });
    }

    // C) Multiple Choice: Translation to German
    if (modeFilter === 'mixed' || modeFilter === 'ar_to_de') {
      const otherGerman = items
        .filter((it) => it.id !== item.id)
        .map((it) => it.german)
        .sort(() => 0.5 - Math.random());
      const distractors = buildUniqueDistractors(
        item.german,
        otherGerman,
        itemIsVerb ? fallbackGermanVerbs : [],
        3
      );
      const mcOptions = [item.german, ...distractors].sort(() => 0.5 - Math.random());

      const promptTransToDe =
        safeLang === 'en'
          ? `What is the German ${itemIsVerb ? 'verb' : 'word'} for "${itemTrans}"?`
          : safeLang === 'de'
          ? `Was ist das deutsche Wort für "${itemTrans}"?`
          : itemIsVerb
          ? `ما الفعل الألماني لمعنى: "${itemTrans}"؟`
          : `ما الكلمة الألمانية لمعنى: "${itemTrans}"؟`;

      pool.push({
        id: `dyn_mc_ar_de_${item.id}_${index}`,
        type: 'multiple_choice',
        prompt: promptTransToDe,
        emoji: item.emoji,
        options: mcOptions,
        correctAnswer: item.german,
        explanation: `${item.german} = ${itemTrans}`,
        itemRef: item,
        ...(verbEntry ? { verbRef: verbEntry } : {})
      });
    }

    // D) Multiple Choice: German to Translation
    if (modeFilter === 'mixed' || modeFilter === 'de_to_ar' || modeFilter === 'audio') {
      const otherTrans = items
        .filter((it) => it.id !== item.id)
        .map((it) => getItemTranslation(it, safeLang))
        .sort(() => 0.5 - Math.random());
      const distractors = buildUniqueDistractors(
        itemTrans,
        otherTrans,
        itemIsVerb ? fallbackArabicVerbs : [],
        3
      );
      const mcOptionsAr = [itemTrans, ...distractors].sort(() => 0.5 - Math.random());

      const promptDeToTrans =
        safeLang === 'en'
          ? `What is the meaning of "${item.german}"?`
          : safeLang === 'de'
          ? `Was bedeutet das Wort "${item.german}"?`
          : itemIsVerb
          ? `ما معنى الفعل الألماني "${item.german}"؟`
          : `ما معنى الكلمة الألمانية "${item.german}"؟`;

      pool.push({
        id: `dyn_mc_de_ar_${item.id}_${index}`,
        type: 'multiple_choice',
        prompt: promptDeToTrans,
        emoji: item.emoji,
        options: mcOptionsAr,
        correctAnswer: itemTrans,
        explanation: `${item.german} = ${itemTrans}`,
        itemRef: item,
        ...(verbEntry ? { verbRef: verbEntry } : {})
      });
    }

    // E) Article Question (der / die / das) strictly for real nouns, never verbs
    if (article && !itemIsVerb && (modeFilter === 'mixed' || modeFilter === 'article')) {
      const articlePrompt =
        safeLang === 'en'
          ? `What is the correct article for "${nounOnly}"?`
          : safeLang === 'de'
          ? `Welcher Artikel gehört zu "${nounOnly}"?`
          : `ما أداة التعريف الصحيحة لكلمة: "${nounOnly}"؟`;

      pool.push({
        id: `dyn_art_${item.id}_${index}`,
        type: 'der_die_das',
        prompt: articlePrompt,
        subPrompt: itemTrans,
        emoji: item.emoji,
        options: ['der', 'die', 'das'],
        correctAnswer: article,
        explanation: `${article} ${nounOnly}`,
        itemRef: item
      });
    }

    // F) Missing Letter Question
    if (modeFilter === 'mixed' && item.missingLetterWord && item.missingLetterWord.includes('_')) {
      const blankIndex = item.missingLetterWord.indexOf('_');
      const cleanTarget = cleanGermanNoun(item.german);
      const missingChar = cleanTarget[blankIndex] || 'e';

      const alphabet = ['a', 'e', 'i', 'o', 'u', 'l', 'r', 's', 't', 'n', 'm'];
      const distractorLetters = alphabet
        .filter((c) => c.toLowerCase() !== missingChar.toLowerCase())
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const letterOptions = [missingChar.toLowerCase(), ...distractorLetters].sort(
        () => 0.5 - Math.random()
      );

      const missingPrompt =
        safeLang === 'en'
          ? `What is the missing letter in "${item.missingLetterWord}"?`
          : safeLang === 'de'
          ? `Welcher Buchstabe fehlt in "${item.missingLetterWord}"?`
          : `ما هو الحرف الناقص في الكلمة: "${item.missingLetterWord}"؟`;

      pool.push({
        id: `dyn_miss_${item.id}_${index}`,
        type: 'missing_letter',
        prompt: missingPrompt,
        subPrompt: itemTrans,
        emoji: item.emoji,
        missingLetterWord: item.missingLetterWord,
        options: letterOptions,
        correctAnswer: missingChar.toLowerCase(),
        explanation: `${item.german}`,
        itemRef: item
      });
    }

    // G) Sentence Builder Question (vocab items / non-filtered mixed mode)
    if (modeFilter === 'mixed' && !itemIsVerb) {
      let sentencePieces: string[] = [];
      if (item.sentence4Elements && item.sentence4Elements.length === 4) {
        sentencePieces = [...item.sentence4Elements];
      } else if (item.exampleSentenceGerman) {
        const parts = item.exampleSentenceGerman.split(' ').filter(Boolean);
        if (parts.length >= 3) {
          sentencePieces = parts.slice(0, 4);
        }
      }

      if (sentencePieces.length >= 3) {
        const sentencePrompt =
          safeLang === 'en'
            ? `Arrange words to build a correct sentence:`
            : safeLang === 'de'
            ? `Ordne die Wörter zu einem richtigen Satz:`
            : `رتّب الكلمات لتكوين جملة صحيحة:`;

        const correctSentence = sentencePieces.join(' ');
        const perm1 = [...sentencePieces].sort(() => 0.5 - Math.random()).join(' ');
        const perm2 = [...sentencePieces].reverse().join(' ');
        const perm3 = [...sentencePieces].sort(() => Math.random() - 0.5).join(' ');
        const sentOptions = Array.from(new Set([correctSentence, perm1, perm2, perm3]))
          .filter(Boolean)
          .sort(() => 0.5 - Math.random());

        pool.push({
          id: `dyn_sent_${item.id}_${index}`,
          type: 'sentence_builder',
          prompt: sentencePrompt,
          subPrompt:
            safeLang === 'en'
              ? item.english || itemTrans
              : safeLang === 'de'
              ? item.german || itemTrans
              : item.exampleSentenceArabic || itemTrans,
          emoji: item.emoji,
          sentencePieces,
          options: sentOptions,
          correctAnswer: correctSentence,
          explanation: item.exampleSentenceGerman || correctSentence,
          itemRef: item
        });
      }
    }

    // H) Plural Form Question (strictly for nouns)
    if (modeFilter === 'mixed' && !itemIsVerb && item.plural) {
      const otherPlurals = items
        .filter((it) => it.id !== item.id && it.plural)
        .map((it) => it.plural as string)
        .slice(0, 3);
      const pluralOptions = Array.from(new Set([item.plural, ...otherPlurals])).sort(
        () => 0.5 - Math.random()
      );

      if (pluralOptions.length >= 2) {
        const pluralPrompt =
          safeLang === 'en'
            ? `What is the plural form of "${item.german}"?`
            : safeLang === 'de'
            ? `Was ist die Pluralform von "${item.german}"?`
            : `ما صيغة الجمع لكلمة: "${item.german}"؟`;

        pool.push({
          id: `dyn_plur_${item.id}_${index}`,
          type: 'plural_match',
          prompt: pluralPrompt,
          subPrompt: itemTrans,
          emoji: item.emoji,
          options: pluralOptions,
          correctAnswer: item.plural,
          explanation: `${item.german} ➡️ ${item.plural}`,
          itemRef: item
        });
      }
    }
  });

  // Fallback if filtered pool is empty
  if (pool.length === 0 && modeFilter !== 'mixed') {
    return buildDynamicQuestionPool(set, language, {
      ...poolOptions,
      questionModeFilter: 'mixed'
    });
  }

  return pool.sort(() => 0.5 - Math.random());
}

export interface MemoryCard {
  id: string;
  pairId: string;
  type: 'word' | 'meaning';
  content: string;
  subContent?: string;
  emoji?: string;
  article?: 'der' | 'die' | 'das';
  isFlipped: boolean;
  isMatched: boolean;
}

export function generateMemoryCards(
  items: LernstudioItem[],
  pairsCount: number = 6,
  language: string = 'ar'
): MemoryCard[] {
  const safeLang = (language || 'ar').toLowerCase();
  const selectedItems = [...items]
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.min(pairsCount, items.length));
  const cards: MemoryCard[] = [];

  selectedItems.forEach((item, index) => {
    const pairId = `pair_${item.id || index}`;
    const itemIsVerb = isItemVerb(item);
    const article = itemIsVerb ? null : item.article || extractGermanArticle(item.german);
    const trans = getItemTranslation(item, safeLang);

    // Card 1: German word/phrase + Emoji
    cards.push({
      id: `card_de_${item.id}_${index}`,
      pairId,
      type: 'word',
      content: item.german,
      emoji: item.emoji,
      article: article || undefined,
      isFlipped: false,
      isMatched: false
    });

    // Card 2: Translation / Meaning
    cards.push({
      id: `card_trans_${item.id}_${index}`,
      pairId,
      type: 'meaning',
      content: trans,
      subContent: safeLang !== 'ar' ? item.arabic : item.english,
      emoji: item.emoji,
      isFlipped: false,
      isMatched: false
    });
  });

  return cards.sort(() => 0.5 - Math.random());
}

/**
 * Generates Memory cards for any Set (including pure Grammar sets using grammar examples/exercises).
 */
export function generateMemoryCardsForSet(
  set: LernstudioSet,
  pairsCount: number = 6,
  language: string = 'ar'
): MemoryCard[] {
  const playable = getSetPlayableItems(set);
  return generateMemoryCards(playable, pairsCount, language);
}

/**
 * Checks whether this set is eligible for the der/die/das article sorting game.
 * Strictly returns false for verb-only sets and requires >= 2 genuine German nouns with articles.
 */
export function isArticleGameSupported(set: LernstudioSet): boolean {
  if (set.hasArticles === false) return false;
  if (set.setKind === 'verb_group') return false;
  const items = set.items || [];
  const articleCount = items.filter((it) => {
    if (isItemVerb(it)) return false;
    const art = it.article || extractGermanArticle(it.german);
    return Boolean(art && ['der', 'die', 'das'].includes(art));
  }).length;
  return articleCount >= 2;
}

/**
 * Extracts items that legitimately have articles for the Word Sorting Bins game.
 * Strictly avoids assigning random or invented articles to verbs or words without articles!
 */
export interface SortingItem {
  id: string;
  german: string;
  nounOnly: string;
  article: 'der' | 'die' | 'das';
  arabic: string;
  emoji?: string;
}

export function extractSortingItems(items: LernstudioItem[]): SortingItem[] {
  const result: SortingItem[] = [];

  items.forEach((it) => {
    if (isItemVerb(it)) return;
    const article = it.article || extractGermanArticle(it.german);
    if (article && ['der', 'die', 'das'].includes(article)) {
      result.push({
        id: it.id,
        german: it.german,
        nounOnly: cleanGermanNoun(it.german),
        article,
        arabic: it.arabic,
        emoji: it.emoji
      });
    }
  });

  return result.sort(() => 0.5 - Math.random());
}

/**
 * Interface for Sentence Builder (ترتيب الجمل / Satzbau Challenge) questions
 */
export interface SentenceGameQuestion {
  id: string;
  germanFull: string;
  arabicFull: string;
  words: string[];
  scrambledWords: string[];
  emoji?: string;
  grammarTip?: string;
}

/**
 * Builds sentence ordering questions from grammarContent, custom exercises, and set items.
 */
export function buildSentenceGameQuestions(
  set: LernstudioSet,
  language: string = 'ar'
): SentenceGameQuestion[] {
  const safeLang = (language || 'ar').toLowerCase();
  const results: SentenceGameQuestion[] = [];
  const items = set.items || [];

  // 0. From unified Grammar Content (sentence_ordering exercises + grammar examples)
  const grammarExercises = getGrammarLessonExercises(set);
  grammarExercises.forEach((ex, idx) => {
    if (ex.type === 'sentence_ordering' && ex.correctAnswer) {
      const full = ex.correctAnswer.trim();
      const words = (ex.tokens && ex.tokens.length >= 2 ? ex.tokens : full.split(/\s+/)).filter(Boolean);
      if (words.length >= 2) {
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        if (shuffled.join(' ') === words.join(' ') && words.length > 1) {
          shuffled.reverse();
        }
        results.push({
          id: ex.id || `gram_sb_${idx}`,
          germanFull: full,
          arabicFull:
            ex.question.replace(/^رتب.*?:\s*/i, '').trim() ||
            ex.explanationAr ||
            (safeLang === 'de' ? 'Ordne die Wörter richtig an' : 'رتّب الكلمات لتكوين الجملة الصحيحة'),
          words,
          scrambledWords: shuffled,
          emoji: '📘',
          grammarTip:
            getLocalizedGrammarField(ex as any, 'explanation', safeLang) ||
            (safeLang === 'de'
              ? 'Achte auf die Satzstellung im Deutschen.'
              : 'انتبه لترتيب الفعل والفاعل حسب القاعدة النحوية.')
        });
      }
    }
  });

  // Add grammar examples as extra sentence-ordering rounds when helpful
  if (set.grammarContent?.examples && Array.isArray(set.grammarContent.examples)) {
    set.grammarContent.examples.forEach((eg, idx) => {
      const full = (eg.german || '').trim();
      const words = full.split(/\s+/).filter(Boolean);
      if (words.length >= 3 && words.length <= 12) {
        if (results.some((r) => r.germanFull.toLowerCase() === full.toLowerCase())) return;
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        if (shuffled.join(' ') === words.join(' ') && words.length > 1) {
          shuffled.reverse();
        }
        results.push({
          id: `gram_eg_sb_${eg.id || idx}`,
          germanFull: full,
          arabicFull: eg.arabic || eg.english || full,
          words,
          scrambledWords: shuffled,
          emoji: '💬',
          grammarTip: eg.noteAr || set.grammarContent?.explanationAr
        });
      }
    });
  }

  // 1. From custom exercises of type 'sentence_builder'
  if (set.customExercises && set.customExercises.length > 0) {
    set.customExercises.forEach((ex, idx) => {
      if (ex.type === 'sentence_builder' && ex.correctAnswer) {
        const full = ex.correctAnswer.trim();
        if (results.some((r) => r.germanFull.toLowerCase() === full.toLowerCase())) return;
        const words = full.split(/\s+/).filter(Boolean);
        if (words.length >= 3) {
          const shuffled = [...words].sort(() => 0.5 - Math.random());
          const defaultArPrompt = 'رتب الكلمات الألمانية بالترتيب الصحيح';
          const defaultEnPrompt = 'Arrange German words in correct order';
          const defaultDePrompt = 'Ordne die deutschen Wörter richtig an';

          results.push({
            id: ex.id || `custom_sb_${idx}`,
            germanFull: full,
            arabicFull:
              ex.question.replace(/^رتب الكلمات.*?:?\s*/i, '').trim() ||
              (safeLang === 'en'
                ? defaultEnPrompt
                : safeLang === 'de'
                ? defaultDePrompt
                : defaultArPrompt),
            words,
            scrambledWords: shuffled,
            emoji: '📝',
            grammarTip:
              ex.explanation ||
              (safeLang === 'en'
                ? 'In German main clauses, verb is in Position 2.'
                : safeLang === 'de'
                ? 'Im Hauptsatz steht das Verb an Position 2.'
                : 'في الجملة الخبرية الألمانية، الفعل يأتي دائماً في المركز الثاني (Position 2).')
          });
        }
      }
    });
  }

  // 2. From items with sentence4Elements
  items.forEach((item, idx) => {
    if (item.sentence4Elements && item.sentence4Elements.length === 4) {
      const words = item.sentence4Elements.map((w) => w.trim()).filter(Boolean);
      if (words.length >= 3) {
        const full = words.join(' ');
        if (results.some((r) => r.germanFull.toLowerCase() === full.toLowerCase())) return;
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        const trans = getItemTranslation(item, safeLang);
        results.push({
          id: `item_s4_${item.id}_${idx}`,
          germanFull: full,
          arabicFull:
            item.exampleSentenceArabic ||
            `${
              safeLang === 'en'
                ? 'Sentence for:'
                : safeLang === 'de'
                ? 'Satz für:'
                : 'جملة على مفردة:'
            } ${trans}`,
          words,
          scrambledWords: shuffled,
          emoji: item.emoji || '✨',
          grammarTip: `${
            safeLang === 'en'
              ? 'Sentence related to'
              : safeLang === 'de'
              ? 'Satz zu'
              : 'الجملة مرتبطة بمفردة'
          } (${item.german})`
        });
      }
    }
  });

  // 3. From items with exampleSentenceGerman
  items.forEach((item, idx) => {
    if (item.exampleSentenceGerman && item.exampleSentenceGerman.trim()) {
      const full = item.exampleSentenceGerman.trim();
      if (results.some((r) => r.germanFull.toLowerCase() === full.toLowerCase())) return;

      const words = full.split(/\s+/).filter(Boolean);
      if (words.length >= 3 && words.length <= 12) {
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        if (shuffled.join(' ') === words.join(' ') && words.length > 1) {
          shuffled.reverse();
        }
        const trans = getItemTranslation(item, safeLang);
        results.push({
          id: `item_ex_${item.id}_${idx}`,
          germanFull: full,
          arabicFull:
            item.exampleSentenceArabic ||
            `${
              safeLang === 'en'
                ? 'Example for'
                : safeLang === 'de'
                ? 'Beispielsatz für'
                : 'جملة توضيحية لـ'
            } ${trans}`,
          words,
          scrambledWords: shuffled,
          emoji: item.emoji || '📖',
          grammarTip:
            safeLang === 'en'
              ? 'Pay attention to verb position (Position 2 in main clause).'
              : safeLang === 'de'
              ? 'Achte auf die Verbposition (Position 2 im Hauptsatz).'
              : 'انتبه لموقع الفعل (الفعل في المركز الثاني في الجمل الرئيسية).'
        });
      }
    }
  });

  // 4. Fallback: Synthesize sentences from items
  if (results.length === 0 && items.length > 0) {
    items.slice(0, 8).forEach((item, idx) => {
      const art = isItemVerb(item) ? null : item.article || extractGermanArticle(item.german);
      let sentenceDe = '';
      let sentenceAr = '';
      const trans = getItemTranslation(item, safeLang);

      if (art === 'der') {
        sentenceDe = `Der ${cleanGermanNoun(item.german)} ist sehr schön.`;
        sentenceAr =
          safeLang === 'en'
            ? `The ${trans} is very nice.`
            : safeLang === 'de'
            ? `Der ${cleanGermanNoun(item.german)} ist sehr schön.`
            : `${trans} جميل جداً.`;
      } else if (art === 'die') {
        sentenceDe = `Die ${cleanGermanNoun(item.german)} ist sehr nützlich.`;
        sentenceAr =
          safeLang === 'en'
            ? `The ${trans} is very useful.`
            : safeLang === 'de'
            ? `Die ${cleanGermanNoun(item.german)} ist sehr nützlich.`
            : `${trans} مفيدة جداً.`;
      } else if (art === 'das') {
        sentenceDe = `Das ${cleanGermanNoun(item.german)} gefällt mir gut.`;
        sentenceAr =
          safeLang === 'en'
            ? `I really like the ${trans}.`
            : safeLang === 'de'
            ? `Das ${cleanGermanNoun(item.german)} gefällt mir gut.`
            : `${trans} يعجبني كثيراً.`;
      } else {
        sentenceDe = `Wir lernen heute ${item.german} zusammen.`;
        sentenceAr =
          safeLang === 'en'
            ? `We are learning ${trans} together today.`
            : safeLang === 'de'
            ? `Wir lernen heute ${item.german} zusammen.`
            : `نحن نتعلم ${trans} اليوم معاً.`;
      }

      const words = sentenceDe.split(/\s+/).filter(Boolean);
      const shuffled = [...words].sort(() => 0.5 - Math.random());
      results.push({
        id: `synth_${item.id}_${idx}`,
        germanFull: sentenceDe,
        arabicFull: sentenceAr,
        words,
        scrambledWords: shuffled,
        emoji: item.emoji || '⭐',
        grammarTip:
          safeLang === 'en'
            ? 'Verb is always in Position 2 in German sentences.'
            : safeLang === 'de'
            ? 'Das Verb steht immer an Position 2 im deutschen Satz.'
            : 'الفعل يأتي دائماً في المركز الثاني في الجملة الألمانية.'
      });
    });
  }

  return results;
}
