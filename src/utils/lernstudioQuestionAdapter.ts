import { LernstudioSet, LernstudioItem, LernstudioExercise } from '../types/lernstudio';

export interface GameQuestion {
  id: string;
  type: 'multiple_choice' | 'der_die_das' | 'missing_letter' | 'sentence_builder' | 'plural_match' | 'emoji_vocab' | 'scrambled_letters';
  prompt: string;
  subPrompt?: string;
  emoji?: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  itemRef?: LernstudioItem;
  sentencePieces?: string[];
  missingLetterWord?: string;
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

/**
 * Dynamically builds a rich pool of questions from a Lernstudio set,
 * combining any custom exercises defined in the set with dynamically generated
 * questions covering all vocabulary items and question formats.
 */
import { getItemTranslation } from './lernstudioTranslations';

export function buildDynamicQuestionPool(set: LernstudioSet, language: string = 'ar'): GameQuestion[] {
  const pool: GameQuestion[] = [];
  const items = set.items || [];
  if (items.length === 0) return pool;

  const safeLang = (language || 'ar').toLowerCase();

  // 1. Incorporate any custom exercises from set
  if (set.customExercises && set.customExercises.length > 0) {
    set.customExercises.forEach((ex, idx) => {
      pool.push({
        id: ex.id || `custom_${idx}`,
        type: ex.type,
        prompt: ex.question,
        options: ex.options,
        correctAnswer: ex.correctAnswer,
        explanation: ex.explanation
      });
    });
  }

  // 2. Generate questions dynamically for each item
  items.forEach((item, index) => {
    const article = item.article || extractGermanArticle(item.german);
    const nounOnly = cleanGermanNoun(item.german);
    const itemTrans = getItemTranslation(item, safeLang);

    // Multiple Choice: Translation to German
    const otherGerman = items
      .filter((it) => it.id !== item.id)
      .map((it) => it.german)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    const mcOptions = [item.german, ...otherGerman].sort(() => 0.5 - Math.random());

    const promptTransToDe =
      safeLang === 'en'
        ? `What is the German word for "${itemTrans}"?`
        : safeLang === 'de'
        ? `Was ist das deutsche Wort für "${itemTrans}"?`
        : `ما الكلمة الألمانية لمعنى: "${itemTrans}"؟`;

    pool.push({
      id: `dyn_mc_ar_de_${item.id}_${index}`,
      type: 'multiple_choice',
      prompt: promptTransToDe,
      emoji: item.emoji,
      options: mcOptions,
      correctAnswer: item.german,
      explanation: `${item.german} = ${itemTrans}`,
      itemRef: item
    });

    // Multiple Choice: German to Translation
    const otherTrans = items
      .filter((it) => it.id !== item.id)
      .map((it) => getItemTranslation(it, safeLang))
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    const mcOptionsAr = [itemTrans, ...otherTrans].sort(() => 0.5 - Math.random());

    const promptDeToTrans =
      safeLang === 'en'
        ? `What is the meaning of "${item.german}"?`
        : safeLang === 'de'
        ? `Was bedeutet das Wort "${item.german}"?`
        : `ما معنى الكلمة الألمانية "${item.german}"؟`;

    pool.push({
      id: `dyn_mc_de_ar_${item.id}_${index}`,
      type: 'multiple_choice',
      prompt: promptDeToTrans,
      emoji: item.emoji,
      options: mcOptionsAr,
      correctAnswer: itemTrans,
      explanation: `${item.german} = ${itemTrans}`,
      itemRef: item
    });

    // Article Question (der / die / das) if applicable
    if (article) {
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

    // Missing Letter Question
    if (item.missingLetterWord && item.missingLetterWord.includes('_')) {
      const blankIndex = item.missingLetterWord.indexOf('_');
      const cleanTarget = cleanGermanNoun(item.german);
      const missingChar = cleanTarget[blankIndex] || 'e';

      const alphabet = ['a', 'e', 'i', 'o', 'u', 'l', 'r', 's', 't', 'n', 'm'];
      const distractorLetters = alphabet
        .filter((c) => c.toLowerCase() !== missingChar.toLowerCase())
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const letterOptions = [missingChar.toLowerCase(), ...distractorLetters].sort(() => 0.5 - Math.random());

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

    // Sentence Builder Question
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

      pool.push({
        id: `dyn_sent_${item.id}_${index}`,
        type: 'sentence_builder',
        prompt: sentencePrompt,
        subPrompt: item.exampleSentenceArabic || itemTrans,
        emoji: item.emoji,
        sentencePieces: sentencePieces,
        correctAnswer: sentencePieces.join(' '),
        explanation: item.exampleSentenceGerman || sentencePieces.join(' '),
        itemRef: item
      });
    }

    // Plural Form Question
    if (item.plural) {
      const otherPlurals = items
        .filter((it) => it.id !== item.id && it.plural)
        .map((it) => it.plural as string)
        .slice(0, 3);
      const pluralOptions = [item.plural, ...otherPlurals].sort(() => 0.5 - Math.random());

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
  const selectedItems = [...items].sort(() => 0.5 - Math.random()).slice(0, Math.min(pairsCount, items.length));
  const cards: MemoryCard[] = [];

  selectedItems.forEach((item, index) => {
    const pairId = `pair_${item.id || index}`;
    const article = item.article || extractGermanArticle(item.german);
    const trans = getItemTranslation(item, safeLang);

    // Card 1: German word + Emoji
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

    // Card 2: Translation
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
 * Checks whether this set is eligible for the der/die/das article sorting game.
 * Respects AI evaluation and verifies there are actual German nouns with articles.
 */
export function isArticleGameSupported(set: LernstudioSet): boolean {
  if (set.hasArticles === false) return false;
  const items = set.items || [];
  const articleCount = items.filter((it) => {
    const art = it.article || extractGermanArticle(it.german);
    return Boolean(art && ['der', 'die', 'das'].includes(art));
  }).length;
  // Require at least 2 distinct words with articles
  return articleCount >= 2;
}

/**
 * Extracts items that legitimately have articles for the Word Sorting Bins game.
 * Strictly avoids assigning random or invented articles to words without articles!
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
  words: string[];           // Correct ordered words/chunks
  scrambledWords: string[];  // Randomly shuffled for the game
  emoji?: string;
  grammarTip?: string;
}

/**
 * Builds sentence ordering questions from the set's items and custom exercises
 */
export function buildSentenceGameQuestions(set: LernstudioSet, language: string = 'ar'): SentenceGameQuestion[] {
  const safeLang = (language || 'ar').toLowerCase();
  const results: SentenceGameQuestion[] = [];
  const items = set.items || [];

  // 1. From custom exercises of type 'sentence_builder'
  if (set.customExercises && set.customExercises.length > 0) {
    set.customExercises.forEach((ex, idx) => {
      if (ex.type === 'sentence_builder' && ex.correctAnswer) {
        const full = ex.correctAnswer.trim();
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

  // 4. Fallback: Synthesize sentences
  if (results.length === 0 && items.length > 0) {
    items.slice(0, 8).forEach((item, idx) => {
      const art = item.article || extractGermanArticle(item.german);
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

