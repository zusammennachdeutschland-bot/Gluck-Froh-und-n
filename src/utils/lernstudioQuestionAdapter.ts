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
export function buildDynamicQuestionPool(set: LernstudioSet): GameQuestion[] {
  const pool: GameQuestion[] = [];
  const items = set.items || [];
  if (items.length === 0) return pool;

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

    // Multiple Choice: Arabic to German
    const otherGerman = items
      .filter((it) => it.id !== item.id)
      .map((it) => it.german)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    const mcOptions = [item.german, ...otherGerman].sort(() => 0.5 - Math.random());

    pool.push({
      id: `dyn_mc_ar_de_${item.id}_${index}`,
      type: 'multiple_choice',
      prompt: `ما الكلمة الألمانية لمعنى: "${item.arabic}"؟`,
      emoji: item.emoji,
      options: mcOptions,
      correctAnswer: item.german,
      explanation: `${item.german} تعني ${item.arabic}`,
      itemRef: item
    });

    // Multiple Choice: German to Arabic
    const otherArabic = items
      .filter((it) => it.id !== item.id)
      .map((it) => it.arabic)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    const mcOptionsAr = [item.arabic, ...otherArabic].sort(() => 0.5 - Math.random());

    pool.push({
      id: `dyn_mc_de_ar_${item.id}_${index}`,
      type: 'multiple_choice',
      prompt: `ما معنى الكلمة الألمانية "${item.german}"؟`,
      emoji: item.emoji,
      options: mcOptionsAr,
      correctAnswer: item.arabic,
      explanation: `${item.german} = ${item.arabic}`,
      itemRef: item
    });

    // Article Question (der / die / das) if applicable
    if (article) {
      pool.push({
        id: `dyn_art_${item.id}_${index}`,
        type: 'der_die_das',
        prompt: `ما أداة التعريف الصحيحة لكلمة: "${nounOnly}"؟`,
        subPrompt: item.arabic,
        emoji: item.emoji,
        options: ['der', 'die', 'das'],
        correctAnswer: article,
        explanation: `الصحيح هو: ${article} ${nounOnly}`,
        itemRef: item
      });
    }

    // Missing Letter Question
    if (item.missingLetterWord && item.missingLetterWord.includes('_')) {
      // Find missing letter
      const blankIndex = item.missingLetterWord.indexOf('_');
      const cleanTarget = cleanGermanNoun(item.german);
      const missingChar = cleanTarget[blankIndex] || 'e';

      const alphabet = ['a', 'e', 'i', 'o', 'u', 'l', 'r', 's', 't', 'n', 'm'];
      const distractorLetters = alphabet
        .filter((c) => c.toLowerCase() !== missingChar.toLowerCase())
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const letterOptions = [missingChar.toLowerCase(), ...distractorLetters].sort(() => 0.5 - Math.random());

      pool.push({
        id: `dyn_miss_${item.id}_${index}`,
        type: 'missing_letter',
        prompt: `ما هو الحرف الناقص في الكلمة: "${item.missingLetterWord}"؟`,
        subPrompt: item.arabic,
        emoji: item.emoji,
        missingLetterWord: item.missingLetterWord,
        options: letterOptions,
        correctAnswer: missingChar.toLowerCase(),
        explanation: `الكلمة الكاملة هي: ${item.german}`,
        itemRef: item
      });
    }

    // Sentence Builder Question if sentence elements exist
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
      pool.push({
        id: `dyn_sent_${item.id}_${index}`,
        type: 'sentence_builder',
        prompt: `رتّب الكلمات لتكوين جملة صحيحة:`,
        subPrompt: item.exampleSentenceArabic || `حول "${item.arabic}"`,
        emoji: item.emoji,
        sentencePieces: sentencePieces,
        correctAnswer: sentencePieces.join(' '),
        explanation: item.exampleSentenceGerman || sentencePieces.join(' '),
        itemRef: item
      });
    }

    // Plural Form Question if plural is given
    if (item.plural) {
      const otherPlurals = items
        .filter((it) => it.id !== item.id && it.plural)
        .map((it) => it.plural as string)
        .slice(0, 3);
      const pluralOptions = [item.plural, ...otherPlurals].sort(() => 0.5 - Math.random());

      if (pluralOptions.length >= 2) {
        pool.push({
          id: `dyn_plur_${item.id}_${index}`,
          type: 'plural_match',
          prompt: `ما صيغة الجمع لكلمة: "${item.german}"؟`,
          subPrompt: item.arabic,
          emoji: item.emoji,
          options: pluralOptions,
          correctAnswer: item.plural,
          explanation: `جمع "${item.german}" هو: "${item.plural}"`,
          itemRef: item
        });
      }
    }
  });

  // Shuffle the pool for varied gameplay
  return pool.sort(() => 0.5 - Math.random());
}

/**
 * Generates cards for Memory Matching game
 */
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

export function generateMemoryCards(items: LernstudioItem[], pairsCount: number = 6): MemoryCard[] {
  const selectedItems = [...items].sort(() => 0.5 - Math.random()).slice(0, Math.min(pairsCount, items.length));
  const cards: MemoryCard[] = [];

  selectedItems.forEach((item, index) => {
    const pairId = `pair_${item.id || index}`;
    const article = item.article || extractGermanArticle(item.german);

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

    // Card 2: Arabic meaning + English (if available)
    cards.push({
      id: `card_ar_${item.id}_${index}`,
      pairId,
      type: 'meaning',
      content: item.arabic,
      subContent: item.english,
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
export function buildSentenceGameQuestions(set: LernstudioSet): SentenceGameQuestion[] {
  const results: SentenceGameQuestion[] = [];
  const items = set.items || [];

  // 1. From custom exercises of type 'sentence_builder'
  if (set.customExercises && set.customExercises.length > 0) {
    set.customExercises.forEach((ex, idx) => {
      if (ex.type === 'sentence_builder' && ex.correctAnswer) {
        const full = ex.correctAnswer.trim();
        // Split sentence into words, preserving German syntax
        const words = full.split(/\s+/).filter(Boolean);
        if (words.length >= 3) {
          const shuffled = [...words].sort(() => 0.5 - Math.random());
          results.push({
            id: ex.id || `custom_sb_${idx}`,
            germanFull: full,
            arabicFull: ex.question.replace(/^رتب الكلمات.*?:?\s*/i, '').trim() || 'رتب الكلمات الألمانية بالترتيب الصحيح',
            words,
            scrambledWords: shuffled,
            emoji: '📝',
            grammarTip: ex.explanation || 'في الجملة الخبرية الألمانية، الفعل يأتي دائماً في المركز الثاني (Position 2).'
          });
        }
      }
    });
  }

  // 2. From items with sentence4Elements
  items.forEach((item, idx) => {
    if (item.sentence4Elements && item.sentence4Elements.length === 4) {
      const words = item.sentence4Elements.map(w => w.trim()).filter(Boolean);
      if (words.length >= 3) {
        const full = words.join(' ');
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        results.push({
          id: `item_s4_${item.id}_${idx}`,
          germanFull: full,
          arabicFull: item.exampleSentenceArabic || `جملة على مفردة: ${item.arabic}`,
          words,
          scrambledWords: shuffled,
          emoji: item.emoji || '✨',
          grammarTip: `الجملة مرتبطة بمفردة (${item.german})`
        });
      }
    }
  });

  // 3. From items with exampleSentenceGerman
  items.forEach((item, idx) => {
    if (item.exampleSentenceGerman && item.exampleSentenceGerman.trim()) {
      const full = item.exampleSentenceGerman.trim();
      // Avoid duplicates
      if (results.some(r => r.germanFull.toLowerCase() === full.toLowerCase())) return;

      const words = full.split(/\s+/).filter(Boolean);
      if (words.length >= 3 && words.length <= 12) {
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        // If shuffle ended up identical to original, re-shuffle
        if (shuffled.join(' ') === words.join(' ') && words.length > 1) {
          shuffled.reverse();
        }
        results.push({
          id: `item_ex_${item.id}_${idx}`,
          germanFull: full,
          arabicFull: item.exampleSentenceArabic || `جملة توضيحية لـ ${item.arabic}`,
          words,
          scrambledWords: shuffled,
          emoji: item.emoji || '📖',
          grammarTip: 'انتبه لموقع الفعل (الفعل في المركز الثاني في الجمل الرئيسية).'
        });
      }
    }
  });

  // 4. Fallback: If no sentences existed, synthesize educational sentences for the vocabulary
  if (results.length === 0 && items.length > 0) {
    items.slice(0, 8).forEach((item, idx) => {
      const art = item.article || extractGermanArticle(item.german);
      let sentenceDe = '';
      let sentenceAr = '';

      if (art === 'der') {
        sentenceDe = `Der ${cleanGermanNoun(item.german)} ist sehr schön.`;
        sentenceAr = `${item.arabic} جميل جداً.`;
      } else if (art === 'die') {
        sentenceDe = `Die ${cleanGermanNoun(item.german)} ist sehr nützlich.`;
        sentenceAr = `${item.arabic} مفيدة جداً.`;
      } else if (art === 'das') {
        sentenceDe = `Das ${cleanGermanNoun(item.german)} gefällt mir gut.`;
        sentenceAr = `${item.arabic} يعجبني كثيراً.`;
      } else {
        sentenceDe = `Wir lernen heute ${item.german} zusammen.`;
        sentenceAr = `نحن نتعلم ${item.arabic} اليوم معاً.`;
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
        grammarTip: 'الفعل يأتي دائماً في المركز الثاني في الجملة الألمانية.'
      });
    });
  }

  return results;
}

