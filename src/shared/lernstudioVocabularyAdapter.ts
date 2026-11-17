import { LernstudioItem, LernstudioSet } from '../types/lernstudio';
import { getItemTranslation } from './lernstudioTranslations';
import { getGrammarLessonExercises } from './grammarEngine';

export interface AdaptedVocabItem {
  id: string;
  german: string;
  translation: string;
  emoji: string;
  imageUrl?: string;
  article?: 'der' | 'die' | 'das';
  plural?: string;
  exampleSentenceGerman?: string;
  exampleSentenceArabic?: string;
  originalItem: LernstudioItem;
}

/**
 * Returns real playable LernstudioItem[] present on a set (vocab, verb_group, or mixed).
 * Pure grammar sets with empty `set.items` return `[]` rather than synthesizing fake vocabulary items.
 */
export function getSetPlayableItems(set?: Partial<LernstudioSet> | null): LernstudioItem[] {
  if (!set || !Array.isArray(set.items)) return [];
  return set.items;
}

/**
 * Ensures vocabulary items (or adapted grammar items for grammar sets) are returned,
 * with fallbacks for missing images, translations, or emojis.
 */
export function getSetVocabularyItems(set: LernstudioSet, language: string = 'ar'): AdaptedVocabItem[] {
  const sourceItems = getSetPlayableItems(set);
  if (sourceItems.length === 0) {
    return [];
  }

  // Take up to 10 items from the selected set
  const rawItems = sourceItems.slice(0, 10);

  return rawItems.map((item, idx) => {
    const translation = getItemTranslation(item, language) || item.arabic || item.english || item.german;
    const emoji = item.emoji || getFallbackEmoji(item.german, idx);

    return {
      id: item.id || `vocab_${idx}`,
      german: item.german.trim(),
      translation: translation.trim(),
      emoji,
      imageUrl: item.imageUrl,
      article: item.article,
      plural: item.plural,
      exampleSentenceGerman: item.exampleSentenceGerman,
      exampleSentenceArabic: item.exampleSentenceArabic,
      originalItem: item
    };
  });
}

/**
 * Gets distractor choices for a target item from the same vocabulary/adapted list.
 */
export function getDistractorChoices(
  targetItem: AdaptedVocabItem,
  allItems: AdaptedVocabItem[],
  count: number = 3
): AdaptedVocabItem[] {
  const distractors = allItems.filter((it) => it.id !== targetItem.id);
  const shuffled = [...distractors].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  return [targetItem, ...selected].sort(() => 0.5 - Math.random());
}

/**
 * Shuffles an array of items randomly
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getFallbackEmoji(german: string, idx: number): string {
  const fallbacks = ['⭐', '🎈', '🎨', '🚀', '🐱', '🍎', '🚗', '📚', '🏆', '💎'];
  const lower = german.toLowerCase();

  if (lower.includes('katze') || lower.includes('hund') || lower.includes('tier')) return '🐾';
  if (lower.includes('apfel') || lower.includes('brot') || lower.includes('wasser')) return '🍎';
  if (lower.includes('auto') || lower.includes('zug') || lower.includes('bus')) return '🚗';
  if (lower.includes('buch') || lower.includes('schule') || lower.includes('stift')) return '📚';
  if (lower.includes('haus') || lower.includes('zimmer') || lower.includes('tisch')) return '🏠';

  return fallbacks[idx % fallbacks.length];
}
