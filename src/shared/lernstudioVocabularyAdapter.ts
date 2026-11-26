import { LernstudioItem, LernstudioSet } from '../types/lernstudio';
import { getItemTranslation } from './lernstudioTranslations';
import { createSeededRandom, seededShuffle } from './lernstudioWorksheetBuilder';

export { createSeededRandom, seededShuffle };

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

function normalizeChoiceText(text: string | undefined | null): string {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Builds a deterministic session deck of `count` items using a seeded PRNG.
 * No item is repeated within a pass until all available items have been used.
 */
export function buildSeededSessionDeck<T>(
  items: T[],
  count: number,
  seed: string | number
): T[] {
  if (!Array.isArray(items) || items.length === 0 || count <= 0) return [];
  const baseSeed = String(seed ?? 'lernstudio');
  const result: T[] = [];
  let pass = 0;

  while (result.length < count) {
    const passRng = createSeededRandom(`${baseSeed}::pass_${pass}`);
    const shuffledPass = seededShuffle(items, passRng);
    for (const item of shuffledPass) {
      result.push(item);
      if (result.length >= count) break;
    }
    pass += 1;
  }

  return result;
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
 * Returns adapted vocabulary items from the selected set.
 * Respects caller-specified `maxItems` (no hardcoded 10-item cap) and optional deterministic `seed`.
 */
export function getSetVocabularyItems(
  set: LernstudioSet,
  language: string = 'ar',
  maxItems?: number,
  seed?: string | number
): AdaptedVocabItem[] {
  const sourceItems = getSetPlayableItems(set);
  if (sourceItems.length === 0) {
    return [];
  }

  let selectedRaw: LernstudioItem[];
  if (typeof maxItems === 'number' && maxItems > 0) {
    selectedRaw =
      seed !== undefined
        ? buildSeededSessionDeck(sourceItems, maxItems, seed)
        : sourceItems.slice(0, maxItems);
  } else if (seed !== undefined) {
    selectedRaw = seededShuffle(sourceItems, createSeededRandom(String(seed)));
  } else {
    selectedRaw = sourceItems;
  }

  return selectedRaw.map((item, idx) => {
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
 * Gets deduplicated distractor choices for a target item using an optional PRNG.
 * Ensures no choice shares the same normalized German text or translation as another choice or the target.
 */
export function getDistractorChoices(
  targetItem: AdaptedVocabItem,
  allItems: AdaptedVocabItem[],
  count: number = 3,
  rng: () => number = Math.random
): AdaptedVocabItem[] {
  const targetGermanKey = normalizeChoiceText(targetItem.german);
  const targetTransKey = normalizeChoiceText(targetItem.translation);

  const seenGerman = new Set<string>(targetGermanKey ? [targetGermanKey] : []);
  const seenTrans = new Set<string>(targetTransKey ? [targetTransKey] : []);
  const uniqueCandidates: AdaptedVocabItem[] = [];

  for (const it of seededShuffle(allItems, rng)) {
    if (!it || it.id === targetItem.id) continue;
    const gKey = normalizeChoiceText(it.german);
    const tKey = normalizeChoiceText(it.translation);
    if ((gKey && seenGerman.has(gKey)) || (tKey && seenTrans.has(tKey))) {
      continue;
    }
    if (gKey) seenGerman.add(gKey);
    if (tKey) seenTrans.add(tKey);
    uniqueCandidates.push(it);
    if (uniqueCandidates.length >= count) break;
  }

  return seededShuffle([targetItem, ...uniqueCandidates], rng);
}

/**
 * Shuffles an array of items randomly using Fisher-Yates (or seeded PRNG if supplied).
 */
export function shuffleArray<T>(array: T[], rng: () => number = Math.random): T[] {
  return seededShuffle(array, rng);
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
