import { LernstudioSet, LernstudioItem, VerbConjugationForms } from '../types/lernstudio';
import { WorksheetOptions } from './lernstudioPdfUtils';
import { escapeHtml } from './securityUtils';
import {
  DistractorDomain,
  FALLBACK_NOUN_DISTRACTORS,
  FALLBACK_VERB_DISTRACTORS,
  TAGGED_DOMAIN_DISTRACTORS,
  isGermanNumberWord,
  isGreetingOrPoliteTerm
} from './lernstudioDistractors';

// ==========================================
// 0. BUILD STAMP & PAGE CONSTANTS
// ==========================================

export const WORKSHEET_BUILD_ID = 'ws-7';

export const A4_PAGE_WIDTH_PX = 794;
export const A4_PAGE_HEIGHT_PX = 1123;
export const PAGE_PADDING_TOP_PX = 28;
export const PAGE_PADDING_BOTTOM_PX = 52; // Reserves space for footer
export const PAGE_PADDING_X_PX = 36;
export const PAGE_CONTENT_WIDTH_PX = A4_PAGE_WIDTH_PX - PAGE_PADDING_X_PX * 2; // 722px
export const DEFAULT_PAGE_CONTENT_HEIGHT_PX = 990; // Safe height inside 1123px A4 page
export const RUNNING_HEADER_HEIGHT_PX = 40;

// ==========================================
// 1. HELPERS & EMOJI / TEXT NORMALIZATION
// ==========================================

export function stripCopySuffix(title: string | undefined): string {
  if (!title) return '';
  return title
    .replace(/\s*\((Copy|Kopie|نسخة)\)/gi, '')
    .replace(/\s*\(\d+\)$/, '')
    .trim();
}

/**
 * Converts keycap-digit emojis (e.g. "2️⃣0️⃣", "6️⃣0️⃣", "🔟", "💯") into clean plain text ("20", "60", "10", "100")
 * without spaces or variation selector gaps.
 */
export function normalizeDisplayEmoji(emoji: string | undefined): { text: string; isNumberBadge: boolean } {
  if (!emoji) return { text: '', isNumberBadge: false };

  let normalized = emoji
    .trim()
    .replace(/🔟/g, '10')
    .replace(/💯/g, '100')
    .replace(/([0-9#*])\uFE0F?\u20E3/g, '$1')
    .replace(/\uFE0F/g, '');

  normalized = normalized.replace(/(\d)\s+(?=\d)/g, '$1').trim();

  const isNumberBadge = /^\d+$/.test(normalized);
  return { text: normalized, isNumberBadge };
}

export function stripEmoji(str: string): string {
  if (!str) return '';
  return str
    .replace(/([0-9#*])\uFE0F?\u20E3/g, '')
    .replace(/🔟|💯/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArabicHint(str: string | undefined): string {
  if (!str) return '';
  let cleaned = str.trim();
  while (cleaned.startsWith('((') && cleaned.endsWith('))')) {
    cleaned = '(' + cleaned.slice(2, -2).trim() + ')';
  }
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    const inner = cleaned.slice(1, -1).trim();
    let balance = 0;
    let ok = true;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '(') balance++;
      if (inner[i] === ')') balance--;
      if (balance < 0) {
        ok = false;
        break;
      }
    }
    if (ok && balance === 0) {
      cleaned = inner;
    }
  }
  return cleaned;
}

const GERMAN_WORD_TO_NUMERAL: Record<string, string> = {
  null: '0',
  eins: '1',
  zwei: '2',
  drei: '3',
  vier: '4',
  fünf: '5',
  sechs: '6',
  sieben: '7',
  acht: '8',
  neun: '9',
  zehn: '10',
  elf: '11',
  zwölf: '12',
  dreizehn: '13',
  vierzehn: '14',
  fünfzehn: '15',
  sechzehn: '16',
  siebzehn: '17',
  achtzehn: '18',
  neunzehn: '19',
  zwanzig: '20',
  dreißig: '30',
  dreissig: '30',
  vierzig: '40',
  fünfzig: '50',
  sechzig: '60',
  siebzig: '70',
  achtzig: '80',
  neunzig: '90',
  hundert: '100',
  einhundert: '100',
  tausend: '1000',
  eintausend: '1000'
};

export function extractNumeralForItem(item: LernstudioItem): string | undefined {
  const normEmoji = normalizeDisplayEmoji(item.emoji);
  if (normEmoji.isNumberBadge && normEmoji.text) {
    return normEmoji.text;
  }
  const cleanGerman = stripEmoji(item.german).toLowerCase().trim();
  if (GERMAN_WORD_TO_NUMERAL[cleanGerman]) {
    return GERMAN_WORD_TO_NUMERAL[cleanGerman];
  }
  const arabicDigitsMatch = item.arabic?.match(/\((\d+)\)/) || item.arabic?.match(/\b(\d+)\b/);
  if (arabicDigitsMatch) {
    return arabicDigitsMatch[1];
  }
  return undefined;
}

// Seeded PRNG for deterministic shuffle
export function createSeededRandom(seedStr: string) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return function random(): number {
    hash = (hash + 0x6D2B79F5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(array: T[], randomFn: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ==========================================
// 2. GERMAN VERB CONJUGATOR & WORD TYPE
// ==========================================

const IRREGULAR_VERBS: Record<string, VerbConjugationForms> = {
  sein: { ich: 'bin', du: 'bist', er_sie_es: 'ist', wir: 'sind', ihr: 'seid', sie_Sie: 'sind' },
  haben: { ich: 'habe', du: 'hast', er_sie_es: 'hat', wir: 'haben', ihr: 'habt', sie_Sie: 'haben' },
  werden: { ich: 'werde', du: 'wirst', er_sie_es: 'wird', wir: 'werden', ihr: 'werdet', sie_Sie: 'werden' },
  können: { ich: 'kann', du: 'kannst', er_sie_es: 'kann', wir: 'können', ihr: 'könnt', sie_Sie: 'können' },
  müssen: { ich: 'muss', du: 'musst', er_sie_es: 'muss', wir: 'müssen', ihr: 'müsst', sie_Sie: 'müssen' },
  wollen: { ich: 'will', du: 'willst', er_sie_es: 'will', wir: 'wollen', ihr: 'wollt', sie_Sie: 'wollen' },
  gehen: { ich: 'gehe', du: 'gehst', er_sie_es: 'geht', wir: 'gehen', ihr: 'geht', sie_Sie: 'gehen' },
  fahren: { ich: 'fahre', du: 'fährst', er_sie_es: 'fährt', wir: 'fahren', ihr: 'fahrt', sie_Sie: 'fahren' },
  essen: { ich: 'esse', du: 'isst', er_sie_es: 'isst', wir: 'essen', ihr: 'esst', sie_Sie: 'essen' },
  sehen: { ich: 'sehe', du: 'siehst', er_sie_es: 'sieht', wir: 'sehen', ihr: 'seht', sie_Sie: 'sehen' },
  lesen: { ich: 'lese', du: 'liest', er_sie_es: 'liest', wir: 'lesen', ihr: 'lest', sie_Sie: 'lesen' },
  sprechen: { ich: 'spreche', du: 'sprichst', er_sie_es: 'spricht', wir: 'sprechen', ihr: 'sprecht', sie_Sie: 'sprechen' },
  nehmen: { ich: 'nehme', du: 'nimmst', er_sie_es: 'nimmt', wir: 'nehmen', ihr: 'nehmt', sie_Sie: 'nehmen' },
  geben: { ich: 'gebe', du: 'gibst', er_sie_es: 'gibt', wir: 'geben', ihr: 'gebt', sie_Sie: 'geben' },
  schlafen: { ich: 'schlafe', du: 'schläfst', er_sie_es: 'schläft', wir: 'schlafen', ihr: 'schlaft', sie_Sie: 'schlafen' },
  laufen: { ich: 'laufe', du: 'läufst', er_sie_es: 'läuft', wir: 'laufen', ihr: 'lauft', sie_Sie: 'laufen' },
  wissen: { ich: 'weiß', du: 'weißt', er_sie_es: 'weiß', wir: 'wissen', ihr: 'wisst', sie_Sie: 'wissen' },
  treffen: { ich: 'treffe', du: 'triffst', er_sie_es: 'trifft', wir: 'treffen', ihr: 'trefft', sie_Sie: 'treffen' },
  helfen: { ich: 'helfe', du: 'hilfst', er_sie_es: 'hilft', wir: 'helfen', ihr: 'helft', sie_Sie: 'helfen' },
  tragen: { ich: 'trage', du: 'trägst', er_sie_es: 'trägt', wir: 'tragen', ihr: 'tragt', sie_Sie: 'tragen' },
  heißen: { ich: 'heiße', du: 'heißt', er_sie_es: 'heißt', wir: 'heißen', ihr: 'heißt', sie_Sie: 'heißen' },
  tanzen: { ich: 'tanze', du: 'tanzt', er_sie_es: 'tanzt', wir: 'tanzen', ihr: 'tanzt', sie_Sie: 'tanzen' }
};

export function conjugateGermanVerb(infinitiveRaw: string): VerbConjugationForms | null {
  const inf = stripEmoji(infinitiveRaw).toLowerCase().trim();
  if (!inf || inf.length < 3) return null;
  if (isGermanNumberWord(inf)) return null;

  if (IRREGULAR_VERBS[inf]) {
    return IRREGULAR_VERBS[inf];
  }

  if (!inf.endsWith('en') && !inf.endsWith('eln') && !inf.endsWith('ern')) {
    return null;
  }

  let stem = '';
  if (inf.endsWith('en')) {
    stem = inf.slice(0, -2);
  } else if (inf.endsWith('eln') || inf.endsWith('ern')) {
    stem = inf.slice(0, -1);
  }

  if (!stem) return null;

  const needsE = /[td]$|ffn$|chn$/.test(stem);
  const isSStem = /[sßxz]$/.test(stem);

  const ich = inf.endsWith('eln') ? stem.slice(0, -2) + 'le' : stem + 'e';
  const du = isSStem ? stem + 't' : needsE ? stem + 'est' : stem + 'st';
  const er_sie_es = needsE ? stem + 'et' : stem + 't';
  const wir = inf;
  const ihr = needsE ? stem + 'et' : stem + 't';
  const sie_Sie = inf;

  return { ich, du, er_sie_es, wir, ihr, sie_Sie };
}

export function detectWordType(item: LernstudioItem): 'noun' | 'verb' | 'adjective' | 'phrase' | 'other' {
  if (item.wordType) return item.wordType;

  const german = stripEmoji(item.german).trim();
  const lower = german.toLowerCase();

  if (isGermanNumberWord(lower)) {
    return 'other';
  }

  if (item.article || /^(der|die|das)\b/i.test(german)) {
    return 'noun';
  }

  const words = german.split(/\s+/);
  if (words.length >= 3 || lower.includes('!') || lower.includes('?')) {
    return 'phrase';
  }

  if (isGreetingOrPoliteTerm(lower)) {
    return 'phrase';
  }

  if (/^[a-zäöüß]+(en|eln|ern)$/.test(lower) || IRREGULAR_VERBS[lower]) {
    return 'verb';
  }

  if (words.length === 2 && /^(guten|gute|vielen|sehr|schönen|kein|es|herzlich|viel|alles)\b/i.test(words[0])) {
    return 'phrase';
  }

  return 'other';
}

// ==========================================
// 3. DOMAIN DETECTION & ODD-ONE-OUT VALIDATION
// ==========================================

export function detectSetDomains(set: LernstudioSet): Set<DistractorDomain> {
  const domains = new Set<DistractorDomain>();

  const metaParts = [
    set.title || '',
    set.topic || '',
    set.titleTranslations?.ar || '',
    set.titleTranslations?.de || '',
    set.titleTranslations?.en || '',
    set.topicTranslations?.ar || '',
    set.topicTranslations?.de || '',
    set.topicTranslations?.en || ''
  ]
    .join(' ')
    .toLowerCase();

  if (/zahl|rechnen|nummer|ziffer|أرقام|ارقام|حساب|العد|عشرات|number|math/i.test(metaParts)) {
    domains.add('numbers');
  }
  if (/höflich|begrüßung|gruß|gruss|تحية|تحيات|تهذيب|آداب|اداب|تعارف|وداع|polite|greeting/i.test(metaParts)) {
    domains.add('greetings');
    domains.add('politeness');
  }
  if (/tier|حيوان|animal/i.test(metaParts)) domains.add('animals');
  if (/möbel|haus|zimmer|أثاث|منزل|غرفة|furniture/i.test(metaParts)) domains.add('furniture');
  if (/essen|trinken|lebensmittel|obst|gemüse|طعام|شراب|أكل|فواكه|food/i.test(metaParts)) domains.add('food');
  if (/farb|لون|ألوان|color/i.test(metaParts)) domains.add('colors');
  if (/schul|مدرسة|أدوات مدرسية|school/i.test(metaParts)) domains.add('school');
  if (/körper|جسم|body/i.test(metaParts)) domains.add('body');
  if (/kleidung|ملابس|clothes/i.test(metaParts)) domains.add('clothes');
  if (/verkehr|fahrzeug|مواصلات|مركبات|transport/i.test(metaParts)) domains.add('transport');
  if (/familie|عائلة|أسرة|family/i.test(metaParts)) domains.add('family');

  const items = set.items || [];
  let numberItemCount = 0;
  let politeItemCount = 0;

  for (const item of items) {
    if (!item || !item.german) continue;
    const cleanG = stripEmoji(item.german).toLowerCase().trim();
    const cat = (item.category || '').toLowerCase();

    if (cat.includes('number') || cat.includes('zahl')) domains.add('numbers');
    if (cat.includes('greet') || cat.includes('polite') || cat.includes('höflich')) {
      domains.add('greetings');
      domains.add('politeness');
    }
    if (cat.includes('animal') || cat.includes('tier')) domains.add('animals');
    if (cat.includes('furniture') || cat.includes('möbel')) domains.add('furniture');
    if (cat.includes('food') || cat.includes('essen')) domains.add('food');
    if (cat.includes('color') || cat.includes('farb')) domains.add('colors');
    if (cat.includes('school') || cat.includes('schul')) domains.add('school');
    if (cat.includes('body') || cat.includes('körper')) domains.add('body');
    if (cat.includes('cloth') || cat.includes('kleid')) domains.add('clothes');
    if (cat.includes('transport') || cat.includes('verkehr')) domains.add('transport');

    if (isGermanNumberWord(cleanG) || normalizeDisplayEmoji(item.emoji).isNumberBadge) {
      numberItemCount++;
    }
    if (isGreetingOrPoliteTerm(cleanG)) {
      politeItemCount++;
    }

    for (const tagged of TAGGED_DOMAIN_DISTRACTORS) {
      if (tagged.word.toLowerCase() === cleanG || tagged.word.toLowerCase().replace(/^(der|die|das)\s+/, '') === cleanG) {
        domains.add(tagged.domain);
      }
    }
  }

  if (numberItemCount >= 2 || (items.length > 0 && numberItemCount === items.length)) {
    domains.add('numbers');
  }
  if (politeItemCount >= 2 || (items.length > 0 && politeItemCount === items.length)) {
    domains.add('greetings');
    domains.add('politeness');
  }

  return domains;
}

export function isValidOddOneOut(
  question: OddOneOutQuestion,
  setOrWords: LernstudioSet | string[]
): boolean {
  if (!question || !question.options || question.options.length !== 4) return false;

  const correctOpts = question.options.filter((o) => o.isCorrect);
  if (correctOpts.length !== 1) return false;

  const optionTextsLower = question.options.map((o) => o.text.toLowerCase().trim());
  if (new Set(optionTextsLower).size !== 4) return false;

  const correctText = correctOpts[0].text.trim();
  const correctTextLower = correctText.toLowerCase();

  const setWordsLower: string[] = Array.isArray(setOrWords)
    ? setOrWords.map((w) => stripEmoji(w).toLowerCase().trim())
    : (setOrWords.items || []).map((i) => stripEmoji(i.german).toLowerCase().trim());

  if (setWordsLower.includes(correctTextLower)) return false;

  const domains: Set<DistractorDomain> = Array.isArray(setOrWords)
    ? detectSetDomains({
        id: 'temp',
        title: '',
        topic: '',
        level: 'A1',
        difficulty: 'easy',
        createdAt: '',
        updatedAt: 0,
        items: setOrWords.map((w, idx) => ({ id: `${idx}`, german: w, arabic: '' }))
      })
    : detectSetDomains(setOrWords);

  if (domains.has('numbers')) {
    if (isGermanNumberWord(correctTextLower) || /\d/.test(correctTextLower)) {
      return false;
    }
  }

  if (domains.has('greetings') || domains.has('politeness')) {
    if (isGreetingOrPoliteTerm(correctTextLower)) {
      return false;
    }
  }

  if (question.promptDe.includes('Artikel')) {
    const articles = question.options.map((o) => {
      const m = o.text.trim().match(/^(der|die|das)\b/i);
      return m ? m[1].toLowerCase() : '';
    });
    if (articles.some((a) => !a)) return false;
    const correctArt = correctOpts[0].text.trim().match(/^(der|die|das)\b/i)?.[1]?.toLowerCase();
    const otherArts = question.options
      .filter((o) => !o.isCorrect)
      .map((o) => o.text.trim().match(/^(der|die|das)\b/i)?.[1]?.toLowerCase());
    if (!correctArt || otherArts.some((a) => a !== otherArts[0]) || correctArt === otherArts[0]) {
      return false;
    }
  }

  if (question.promptDe.includes('Pronomen')) {
    const hasPronoun = (txt: string) => /^(ich|du|er|sie|es|wir|ihr)\s+/i.test(txt.trim());
    if (hasPronoun(correctText)) return false;
    const others = question.options.filter((o) => !o.isCorrect);
    if (others.some((o) => !hasPronoun(o.text))) return false;
  }

  if (question.promptDe.includes('Thema')) {
    const matchedTag = TAGGED_DOMAIN_DISTRACTORS.find(
      (d) => d.word.toLowerCase() === correctTextLower
    );
    if (matchedTag && domains.has(matchedTag.domain)) {
      return false;
    }
  }

  return true;
}

// ==========================================
// 4. SENTENCE BLOCK REBUILDER
// ==========================================

export function rebuildSentence4Elements(
  germanSentence: string
): [string, string, string, string] | null {
  const clean = germanSentence.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ');
  if (words.length < 3) return null;

  if (words.length <= 4) {
    const pad = [...words];
    while (pad.length < 4) pad.push('');
    return [pad[0], pad[1], pad[2], pad[3]];
  }

  const totalWords = words.length;
  const c1Count = Math.floor(totalWords / 4);
  const c2Count = Math.floor((totalWords - c1Count) / 3);
  const c3Count = Math.floor((totalWords - c1Count - c2Count) / 2);

  const chunk1 = words.slice(0, c1Count).join(' ');
  const chunk2 = words.slice(c1Count, c1Count + c2Count).join(' ');
  const chunk3 = words.slice(c1Count + c2Count, c1Count + c2Count + c3Count).join(' ');
  const chunk4 = words.slice(c1Count + c2Count + c3Count).join(' ');

  return [chunk1, chunk2, chunk3, chunk4];
}

export function isSentence4ElementsValid(
  germanSentence: string | undefined,
  blocks: [string, string, string, string] | undefined
): boolean {
  if (!germanSentence || !blocks || blocks.length !== 4) return false;
  const normSent = germanSentence.toLowerCase().trim().replace(/[.?!,;:]/g, '').replace(/\s+/g, ' ');
  const normJoined = blocks.join(' ').toLowerCase().trim().replace(/[.?!,;:]/g, '').replace(/\s+/g, ' ');
  return normSent === normJoined;
}

// ==========================================
// 5. MISSING LETTERS GENERATOR
// ==========================================

export function createMissingLetterWord(word: string, randomFn: () => number): { gappedWord: string; answer: string } {
  const cleanWord = stripEmoji(word).trim();
  if (!cleanWord) return { gappedWord: word, answer: word };

  const parts = cleanWord.split(' ');
  if (parts.length > 1) {
    const gappedParts = parts.map((part) => {
      if (['der', 'die', 'das', 'ein', 'eine', 'und', 'ist', 'im', 'am'].includes(part.toLowerCase()) || part.length <= 3) {
        return part;
      }
      return createSingleWordGap(part, randomFn);
    });
    const joined = gappedParts.join(' ');
    if (!joined.includes('_')) {
      let longestIdx = 0;
      parts.forEach((p, idx) => {
        if (p.length > parts[longestIdx].length) longestIdx = idx;
      });
      parts[longestIdx] = createSingleWordGap(parts[longestIdx], randomFn, true);
      return { gappedWord: parts.join(' '), answer: cleanWord };
    }
    return { gappedWord: joined, answer: cleanWord };
  }

  return { gappedWord: createSingleWordGap(cleanWord, randomFn, true), answer: cleanWord };
}

function createSingleWordGap(word: string, randomFn: () => number, forceAtLeastOne: boolean = false): string {
  if (word.length <= 1) return word;
  if (word.length <= 3 && !forceAtLeastOne) return word;

  const numGaps = word.length > 8 ? 2 : 1;

  const eligibleIndices: number[] = [];
  for (let i = 1; i < word.length; i++) {
    const char = word[i];
    if (/[a-zA-ZäöüÄÖÜß]/.test(char)) {
      eligibleIndices.push(i);
    }
  }

  if (eligibleIndices.length === 0) return word;

  const shuffledIndices = seededShuffle(eligibleIndices, randomFn);
  const gapIndices = new Set(shuffledIndices.slice(0, Math.min(numGaps, shuffledIndices.length)));

  let result = '';
  for (let i = 0; i < word.length; i++) {
    if (gapIndices.has(i)) {
      result += '_';
    } else {
      result += word[i];
    }
  }
  return result;
}

// ==========================================
// 6. BLOCK PAGINATION ENGINE
// ==========================================

export interface WorksheetBlock {
  id: string;
  type: 'header' | 'ex_title' | 'question' | 'pic_row' | 'vocab_table' | 'teacher_key' | 'vocab_row';
  exerciseId?: string;
  height: number;
  html: string;
}

export function paginateBlocks(
  blocks: WorksheetBlock[],
  pageContentHeight: number = DEFAULT_PAGE_CONTENT_HEIGHT_PX,
  runningHeaderHeight: number = RUNNING_HEADER_HEIGHT_PX
): WorksheetBlock[][] {
  const pages: WorksheetBlock[][] = [];
  let currentPage: WorksheetBlock[] = [];
  let currentHeight = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isFirstPage = pages.length === 0;
    const availableHeight = isFirstPage
      ? pageContentHeight
      : pageContentHeight - runningHeaderHeight;

    // Rule 4: Vocabulary table always starts on a new page when transitioning from exercises
    const prevBlock = currentPage[currentPage.length - 1];
    if (
      block.type === 'vocab_table' &&
      currentPage.length > 0 &&
      prevBlock?.type !== 'vocab_table'
    ) {
      pages.push(currentPage);
      currentPage = [block];
      currentHeight = block.height;
      continue;
    }

    // Rule 2 & Whole-Exercise Cohesion:
    if (block.type === 'ex_title') {
      const nextBlock = blocks[i + 1];
      const nextHeight =
        nextBlock && (nextBlock.type === 'question' || nextBlock.type === 'pic_row')
          ? nextBlock.height
          : 0;
      const minRequiredForStart = block.height + nextHeight;

      let totalExerciseHeight = block.height;
      if (block.exerciseId) {
        for (let j = i + 1; j < blocks.length; j++) {
          if (blocks[j].exerciseId === block.exerciseId) {
            totalExerciseHeight += blocks[j].height;
          } else {
            break;
          }
        }
      }

      const pageHasExercisesAlready = currentPage.some((b) => b.type !== 'header');
      const nextPageCap = pageContentHeight - runningHeaderHeight;

      if (currentHeight + minRequiredForStart > availableHeight && currentPage.length > 0) {
        if (pageHasExercisesAlready || minRequiredForStart <= nextPageCap) {
          pages.push(currentPage);
          currentPage = [block];
          currentHeight = block.height;
          continue;
        }
      }

      if (
        pageHasExercisesAlready &&
        currentHeight + totalExerciseHeight > availableHeight &&
        totalExerciseHeight <= nextPageCap
      ) {
        pages.push(currentPage);
        currentPage = [block];
        currentHeight = block.height;
        continue;
      }
    }

    if (currentHeight + block.height <= availableHeight || currentPage.length === 0) {
      currentPage.push(block);
      currentHeight += block.height;
    } else {
      pages.push(currentPage);
      currentPage = [block];
      currentHeight = block.height;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

// ==========================================
// 7. WORKSHEET DATA STRUCTURES & BUILDER
// ==========================================

export interface MatchingQuestionItem {
  number: number;
  german: string;
  correctLetter: string;
}

export interface MatchingChoiceItem {
  letter: string;
  arabic: string;
}

export interface MissingLetterQuestion {
  number: number;
  gappedWord: string;
  arabicHint: string;
  fullWord: string;
}

export interface OddOneOutQuestion {
  number: number;
  promptDe: string;
  promptAr: string;
  hint?: string;
  options: { letter: string; text: string; isCorrect: boolean }[];
  correctLetter: string;
  correctText: string;
}

export interface GrammarQuestion {
  number: number;
  promptDe: string;
  promptAr: string;
  writingPrompt: string;
  correctAnswer: string;
}

export interface PictureQuestion {
  number: number;
  imageUrl?: string;
  emoji?: string;
  numeralBadge?: string;
  correctWord: string;
  arabicHint?: string;
}

export interface SentenceOrderQuestion {
  number: number;
  arabicHint: string;
  shuffledChips: string[];
  correctSentence: string;
}

export interface WorksheetData {
  buildId: string;
  title: string;
  titleArabic: string;
  level: string;
  grade: string;
  topic: string;
  schoolName: string;
  teacherName: string;
  dateStr: string;
  isTeacherKey: boolean;
  isNounSet: boolean;
  isNumberSet: boolean;
  setDomains: DistractorDomain[];
  matching?: {
    questions: MatchingQuestionItem[];
    choices: MatchingChoiceItem[];
  };
  missingLetters?: MissingLetterQuestion[];
  oddOneOut?: OddOneOutQuestion[];
  grammar?: GrammarQuestion[];
  pictures?: {
    instrDe: string;
    instrAr: string;
    items: PictureQuestion[];
    wordBank?: string[];
    isNounSet: boolean;
    isNumberSet: boolean;
  };
  sentenceOrder?: SentenceOrderQuestion[];
  vocabularyTable?: {
    showArticles: boolean;
    showPlural: boolean;
    items: {
      german: string;
      article?: string;
      plural?: string;
      exampleGerman?: string;
      arabic: string;
      emoji?: string;
      isNumberBadge?: boolean;
    }[];
  };
}

export function buildWorksheetData(
  set: LernstudioSet,
  options: WorksheetOptions = {}
): WorksheetData {
  const isTeacherKey = Boolean(options.includeAnswerKey);
  const variant = options.variant && options.variant >= 1 ? options.variant : 1;
  const questionsLimit =
    options.questionsPerExercise && options.questionsPerExercise >= 3
      ? options.questionsPerExercise
      : 8;

  const randomFn = createSeededRandom(`${set.id}_v${variant}`);

  const cleanTitle = stripCopySuffix(set.title || set.topic || 'Arbeitsblatt');
  const cleanTopic = stripCopySuffix(set.topic || set.title || 'Deutsch');

  const rawSchool = (options.schoolName || '').trim();
  const rawTeacher = (options.teacherName || '').trim();
  const validTeacher = rawTeacher && !/^\d+$/.test(rawTeacher) ? rawTeacher : '';

  const safeSchool = rawSchool || validTeacher || 'Glück Lernstudio';
  const safeTeacher =
    validTeacher && validTeacher !== safeSchool ? validTeacher : '';

  let safeGrade = options.gradeName || set.grade || '';
  if (!safeGrade || /جريد/i.test(safeGrade)) {
    safeGrade = '____________';
  }

  const validItems = (set.items || []).filter((item) => item && item.german && item.arabic);
  const setDomainsSet = detectSetDomains(set);
  const isNumberSet = setDomainsSet.has('numbers');
  const isNounSet = !isNumberSet && validItems.filter((i) => detectWordType(i) === 'noun').length >= 3;

  const result: WorksheetData = {
    buildId: WORKSHEET_BUILD_ID,
    title: cleanTitle,
    titleArabic: stripCopySuffix(set.titleTranslations?.ar || set.topicTranslations?.ar || 'ورقة عمل تعليمية'),
    level: set.level || 'A1',
    grade: safeGrade,
    topic: cleanTopic,
    schoolName: safeSchool,
    teacherName: safeTeacher,
    dateStr: options.dateStr || new Date().toLocaleDateString('de-DE'),
    isTeacherKey,
    isNounSet,
    isNumberSet,
    setDomains: Array.from(setDomainsSet)
  };

  const setWordsList = validItems.map((i) => stripEmoji(i.german).trim());
  const setWordsLowerSet = new Set(setWordsList.map((w) => w.toLowerCase()));

  // -------------------------------------------------------------
  // EXERCISE 1: MATCHING (توصيل) - No duplicates
  // -------------------------------------------------------------
  if (options.includeMatching !== false && validItems.length >= 3) {
    const uniqueByGerman: LernstudioItem[] = [];
    const seenG = new Set<string>();
    for (const item of seededShuffle(validItems, randomFn)) {
      const key = stripEmoji(item.german).toLowerCase().trim();
      if (!seenG.has(key)) {
        seenG.add(key);
        uniqueByGerman.push(item);
      }
    }
    const selected = uniqueByGerman.slice(0, questionsLimit);
    const shuffledArabic = seededShuffle(
      selected.map((it) => ({
        id: it.id,
        arabic: normalizeArabicHint(it.arabic)
      })),
      randomFn
    );

    const letterCodes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const choices: MatchingChoiceItem[] = shuffledArabic.map((item, idx) => ({
      letter: letterCodes[idx] || `${idx + 1}`,
      arabic: item.arabic
    }));

    const questions: MatchingQuestionItem[] = selected.map((item, idx) => {
      const art = item.article || item.german.match(/^(der|die|das)\b/i)?.[1]?.toLowerCase();
      const cleanG = stripEmoji(item.german).trim();
      const displayGerman =
        art && !cleanG.toLowerCase().startsWith(art) ? `${art} ${cleanG}` : cleanG;

      const matchedChoice = choices.find((c) => c.arabic === normalizeArabicHint(item.arabic));
      return {
        number: idx + 1,
        german: displayGerman,
        correctLetter: matchedChoice ? matchedChoice.letter : 'A'
      };
    });

    if (questions.length >= 3) {
      result.matching = { questions, choices };
    }
  }

  // -------------------------------------------------------------
  // EXERCISE 2: MISSING LETTERS (حروف ناقصة) - No duplicates
  // -------------------------------------------------------------
  if (options.includeMissingLetters !== false && validItems.length >= 3) {
    const uniqueByGerman: LernstudioItem[] = [];
    const seenG = new Set<string>();
    for (const item of seededShuffle(validItems, randomFn)) {
      const key = stripEmoji(item.german).toLowerCase().trim();
      if (!seenG.has(key)) {
        seenG.add(key);
        uniqueByGerman.push(item);
      }
    }
    const selected = uniqueByGerman.slice(0, questionsLimit);
    const questions: MissingLetterQuestion[] = selected.map((item, idx) => {
      let promptStr = item.missingLetterWord;
      const fullWord = stripEmoji(item.german).trim();

      if (!promptStr || promptStr === fullWord || !promptStr.includes('_') || promptStr.startsWith('_')) {
        const gapRes = createMissingLetterWord(fullWord, randomFn);
        promptStr = gapRes.gappedWord;
      }

      return {
        number: idx + 1,
        gappedWord: promptStr,
        arabicHint: normalizeArabicHint(item.arabic),
        fullWord
      };
    });

    if (questions.length >= 3) {
      result.missingLetters = questions;
    }
  }

  // -------------------------------------------------------------
  // EXERCISE 3: ODD ONE OUT (Strict Domain & Grammar Filtering)
  // -------------------------------------------------------------
  if (options.includeOddOneOut !== false && validItems.length >= 3) {
    const questions: OddOneOutQuestion[] = [];
    const setNouns = validItems.filter((i) => detectWordType(i) === 'noun');
    const setVerbs = validItems.filter((i) => detectWordType(i) === 'verb');

    // Case A: NOUN SET (Article rule)
    if (setNouns.length >= 3 && !isNumberSet) {
      const getArt = (n: LernstudioItem): 'der' | 'die' | 'das' | undefined => {
        if (n.article === 'der' || n.article === 'die' || n.article === 'das') return n.article;
        const m = stripEmoji(n.german).match(/^(der|die|das)\b/i);
        return m ? (m[1].toLowerCase() as 'der' | 'die' | 'das') : undefined;
      };
      const formatNoun = (n: LernstudioItem): string => {
        const art = getArt(n) || 'der';
        const clean = stripEmoji(n.german).replace(/^(der|die|das)\s+/i, '').trim();
        return `${art} ${clean}`;
      };

      const derNouns = setNouns.filter((n) => getArt(n) === 'der').map(formatNoun);
      const dieNouns = setNouns.filter((n) => getArt(n) === 'die').map(formatNoun);
      const dasNouns = setNouns.filter((n) => getArt(n) === 'das').map(formatNoun);

      const pools = [
        {
          art: 'der' as const,
          items: derNouns,
          fallbacks: FALLBACK_NOUN_DISTRACTORS.filter((f) => f.article === 'der').map((f) => f.german)
        },
        {
          art: 'die' as const,
          items: dieNouns,
          fallbacks: FALLBACK_NOUN_DISTRACTORS.filter((f) => f.article === 'die').map((f) => f.german)
        },
        {
          art: 'das' as const,
          items: dasNouns,
          fallbacks: FALLBACK_NOUN_DISTRACTORS.filter((f) => f.article === 'das').map((f) => f.german)
        }
      ];

      const usedCorrectWords = new Set<string>();

      for (let i = 0; i < Math.min(questionsLimit, 12); i++) {
        const targetPoolIdx = i % 3;
        const mainPool = pools[targetPoolIdx];
        const diffPool = pools[(targetPoolIdx + 1) % 3];

        const uniqueSame = Array.from(new Set([...mainPool.items, ...mainPool.fallbacks]));
        const uniqueDiff = Array.from(new Set(diffPool.fallbacks)).filter(
          (x) =>
            !uniqueSame.includes(x) &&
            !setWordsLowerSet.has(x.toLowerCase()) &&
            !setWordsLowerSet.has(x.replace(/^(der|die|das)\s+/i, '').toLowerCase()) &&
            !usedCorrectWords.has(x.toLowerCase())
        );

        if (uniqueSame.length >= 3 && uniqueDiff.length >= 1) {
          const same3 = seededShuffle(uniqueSame, randomFn).slice(0, 3);
          const odd1 = seededShuffle(uniqueDiff, randomFn)[0];

          const optsRaw = [
            ...same3.map((text) => ({ text, isCorrect: false })),
            { text: odd1, isCorrect: true }
          ];
          const shuffledOpts = seededShuffle(optsRaw, randomFn);
          const letterCodes = ['A', 'B', 'C', 'D'];

          const formattedOpts = shuffledOpts.map((opt, idx) => ({
            letter: letterCodes[idx],
            text: opt.text,
            isCorrect: opt.isCorrect
          }));

          const correctOpt = formattedOpts.find((o) => o.isCorrect)!;

          const qObj: OddOneOutQuestion = {
            number: questions.length + 1,
            promptDe: 'Welches Nomen hat einen anderen Artikel?',
            promptAr: 'أي اسم له أرتيكل مختلف؟',
            options: formattedOpts,
            correctLetter: correctOpt.letter,
            correctText: correctOpt.text
          };

          if (isValidOddOneOut(qObj, set)) {
            usedCorrectWords.add(odd1.toLowerCase());
            questions.push(qObj);
          }
        }
      }
    }

    // Case B: VERB SET (Pronoun rule)
    if (questions.length === 0 && setVerbs.length >= 3 && !isNumberSet) {
      const setVerbInfs = setVerbs.map((v) => stripEmoji(v.german).toLowerCase().trim());
      const verbsToUse = Array.from(new Set(setVerbInfs));

      const outsideVerbs = FALLBACK_VERB_DISTRACTORS.map((f) => f.infinitive).filter(
        (inf) => !setVerbInfs.includes(inf.toLowerCase())
      );

      const usedCorrectVerbs = new Set<string>();

      for (let i = 0; i < Math.min(questionsLimit, outsideVerbs.length); i++) {
        const availableOutside = outsideVerbs.filter((v) => !usedCorrectVerbs.has(v.toLowerCase()));
        if (verbsToUse.length >= 3 && availableOutside.length >= 1) {
          const selected3Verbs = seededShuffle(verbsToUse, randomFn).slice(0, 3);
          const odd1Infinitive = seededShuffle(availableOutside, randomFn)[0];

          const conj1 = conjugateGermanVerb(selected3Verbs[0]);
          const conj2 = conjugateGermanVerb(selected3Verbs[1]);
          const conj3 = conjugateGermanVerb(selected3Verbs[2]);

          if (conj1 && conj2 && conj3) {
            const pronounForms = [
              `ich ${conj1.ich}`,
              `du ${conj2.du}`,
              `er ${conj3.er_sie_es}`
            ];
            const odd1 = odd1Infinitive.toLowerCase();

            const optsRaw = [
              ...pronounForms.map((text) => ({ text, isCorrect: false })),
              { text: odd1, isCorrect: true }
            ];
            const shuffledOpts = seededShuffle(optsRaw, randomFn);
            const letterCodes = ['A', 'B', 'C', 'D'];

            const formattedOpts = shuffledOpts.map((opt, idx) => ({
              letter: letterCodes[idx],
              text: opt.text,
              isCorrect: opt.isCorrect
            }));

            const correctOpt = formattedOpts.find((o) => o.isCorrect)!;

            const qObj: OddOneOutQuestion = {
              number: questions.length + 1,
              promptDe: 'Welche Form hat kein Pronomen?',
              promptAr: 'أي كلمة ليست متصرفة مع ضمير؟',
              options: formattedOpts,
              correctLetter: correctOpt.letter,
              correctText: correctOpt.text
            };

            if (isValidOddOneOut(qObj, set)) {
              usedCorrectVerbs.add(odd1);
              questions.push(qObj);
            }
          }
        }
      }
    }

    // Case C: TOPIC / DOMAIN RULE
    if (questions.length === 0) {
      const uniqueSetWords = Array.from(new Set(setWordsList));

      const unrelatedCandidates = TAGGED_DOMAIN_DISTRACTORS.filter((cand) => {
        if (setDomainsSet.has(cand.domain)) return false;
        const wLower = cand.word.toLowerCase();
        if (setWordsLowerSet.has(wLower)) return false;
        if (setDomainsSet.has('numbers') && (isGermanNumberWord(wLower) || /\d/.test(wLower))) {
          return false;
        }
        if (
          (setDomainsSet.has('greetings') || setDomainsSet.has('politeness')) &&
          isGreetingOrPoliteTerm(wLower)
        ) {
          return false;
        }
        return true;
      }).map((c) => c.word);

      const shuffledOutside = seededShuffle(unrelatedCandidates, randomFn);
      const maxQuestions = Math.min(questionsLimit, shuffledOutside.length);

      if (uniqueSetWords.length >= 3) {
        for (let i = 0; i < maxQuestions; i++) {
          const same3 = seededShuffle(uniqueSetWords, randomFn).slice(0, 3);
          const odd1 = shuffledOutside[i];

          if (same3.length === 3 && odd1) {
            const optsRaw = [
              ...same3.map((text) => ({ text, isCorrect: false })),
              { text: odd1, isCorrect: true }
            ];
            const shuffledOpts = seededShuffle(optsRaw, randomFn);
            const letterCodes = ['A', 'B', 'C', 'D'];

            const formattedOpts = shuffledOpts.map((opt, idx) => ({
              letter: letterCodes[idx],
              text: opt.text,
              isCorrect: opt.isCorrect
            }));

            const correctOpt = formattedOpts.find((o) => o.isCorrect)!;

            const qObj: OddOneOutQuestion = {
              number: questions.length + 1,
              promptDe: 'Welches Wort passt nicht zum Thema?',
              promptAr: 'أي كلمة لا تنتمي للموضوع؟',
              options: formattedOpts,
              correctLetter: correctOpt.letter,
              correctText: correctOpt.text
            };

            if (isValidOddOneOut(qObj, set)) {
              questions.push(qObj);
            }
          }
        }
      }
    }

    if (questions.length >= 3) {
      result.oddOneOut = questions.slice(0, questionsLimit);
    }
  }

  // -------------------------------------------------------------
  // EXERCISE 4: GRAMMAR (قواعد)
  // -------------------------------------------------------------
  if (options.includeGrammar !== false && validItems.length >= 3 && !isNumberSet) {
    const grammarQuestions: GrammarQuestion[] = [];
    const verbsInSet = validItems.filter((i) => detectWordType(i) === 'verb');
    const nounsInSet = validItems.filter((i) => detectWordType(i) === 'noun');

    if (verbsInSet.length >= 3) {
      const selectedVerbs = seededShuffle(verbsInSet, randomFn).slice(0, questionsLimit);
      selectedVerbs.forEach((item, idx) => {
        const conj = conjugateGermanVerb(item.german);
        if (conj) {
          grammarQuestions.push({
            number: idx + 1,
            promptDe: `Konjugiere das Verb: (${stripEmoji(item.german)})`,
            promptAr: `صرف الفعل في المضارع: (${normalizeArabicHint(item.arabic)})`,
            writingPrompt: `ich _____, du _____, er/sie/es _____`,
            correctAnswer: `ich ${conj.ich}, du ${conj.du}, er/sie/es ${conj.er_sie_es}`
          });
        }
      });
    } else if (nounsInSet.length >= 3) {
      const nounsWithPlural = nounsInSet.filter(
        (n) => n.plural && n.plural.trim() && n.plural.trim() !== '-'
      );
      if (nounsWithPlural.length >= 4) {
        const selected = seededShuffle(nounsWithPlural, randomFn).slice(0, questionsLimit);
        selected.forEach((item, idx) => {
          const art =
            item.article || item.german.match(/^(der|die|das)\b/i)?.[1]?.toLowerCase() || 'der';
          const cleanG = stripEmoji(item.german).replace(/^(der|die|das)\s+/i, '').trim();
          grammarQuestions.push({
            number: idx + 1,
            promptDe: `Bilde die Pluralform:`,
            promptAr: `اكتب صيغة الجمع للاسم:`,
            writingPrompt: `${art} ${cleanG}  →  ____________________`,
            correctAnswer: item.plural || `die ${cleanG}n`
          });
        });
      } else {
        const selected = seededShuffle(nounsInSet, randomFn).slice(0, questionsLimit);
        selected.forEach((item, idx) => {
          const art =
            item.article || item.german.match(/^(der|die|das)\b/i)?.[1]?.toLowerCase() || 'der';
          const cleanG = stripEmoji(item.german).replace(/^(der|die|das)\s+/i, '').trim();
          grammarQuestions.push({
            number: idx + 1,
            promptDe: `Ergänze den Artikel (der / die / das):`,
            promptAr: `أكمل الأرتيكل المناسب (der / die / das):`,
            writingPrompt: `_____ ${cleanG}  (${normalizeArabicHint(item.arabic)})`,
            correctAnswer: `${art} ${cleanG}`
          });
        });
      }
    }

    if (grammarQuestions.length >= 3) {
      result.grammar = grammarQuestions.slice(0, questionsLimit);
    }
  }

  // -------------------------------------------------------------
  // EXERCISE 5: PICTURES / NUMERAL WORDS
  // -------------------------------------------------------------
  if (options.includePictures !== false && validItems.length >= 3) {
    const picEligible = validItems.filter((i) => {
      if (i.imageUrl && i.imageUrl.startsWith('data:image')) return true;
      if (i.emoji && i.emoji.trim()) return true;
      if (isNumberSet && extractNumeralForItem(i)) return true;
      return false;
    });

    if (picEligible.length >= 3) {
      const selected = seededShuffle(picEligible, randomFn).slice(0, Math.min(questionsLimit, 8));
      const items: PictureQuestion[] = selected.map((item, idx) => {
        const art = item.article || item.german.match(/^(der|die|das)\b/i)?.[1]?.toLowerCase();
        const cleanG = stripEmoji(item.german).trim();
        const correctWord =
          art && !cleanG.toLowerCase().startsWith(art) ? `${art} ${cleanG}` : cleanG;

        const normEmoji = normalizeDisplayEmoji(item.emoji);
        const numeralBadge = isNumberSet
          ? extractNumeralForItem(item) || (normEmoji.isNumberBadge ? normEmoji.text : undefined)
          : normEmoji.isNumberBadge
          ? normEmoji.text
          : undefined;

        return {
          number: idx + 1,
          imageUrl:
            item.imageUrl && item.imageUrl.startsWith('data:image') ? item.imageUrl : undefined,
          emoji: numeralBadge ? undefined : normEmoji.text || undefined,
          numeralBadge,
          correctWord,
          arabicHint: undefined
        };
      });

      const wordBank = seededShuffle(
        items.map((it) => it.correctWord),
        randomFn
      );

      const instrDe = isNumberSet
        ? 'Schreibe die Zahl als Wort.'
        : isNounSet
        ? 'Schreibe das passende Wort unter das Bild.'
        : 'Wähle das passende Wort aus der Wörterbox und schreibe es unter das Symbol.';

      const instrAr = isNumberSet
        ? 'اكتب الرقم بالحروف (بالألمانية):'
        : isNounSet
        ? 'اكتب الكلمة المناسبة تحت كل صورة:'
        : 'اختر الكلمة المناسبة من الصندوق واكتبها تحت كل رمز:';

      result.pictures = {
        instrDe,
        instrAr,
        items,
        wordBank: isNounSet ? undefined : wordBank,
        isNounSet,
        isNumberSet
      };
    }
  }

  // -------------------------------------------------------------
  // EXERCISE 6: SENTENCE ORDER
  // -------------------------------------------------------------
  if (options.includeSentenceBuilder !== false && validItems.length >= 3) {
    const sentenceItems = validItems.filter(
      (i) => i.exampleSentenceGerman && i.exampleSentenceArabic
    );

    if (sentenceItems.length >= 3) {
      const selected = seededShuffle(sentenceItems, randomFn).slice(0, Math.min(questionsLimit, 8));
      const questions: SentenceOrderQuestion[] = [];

      selected.forEach((item) => {
        const exGerman = item.exampleSentenceGerman!.trim();
        const exArabic = item.exampleSentenceArabic!.trim();

        let blocks: [string, string, string, string] | null = null;
        if (isSentence4ElementsValid(exGerman, item.sentence4Elements)) {
          blocks = item.sentence4Elements!;
        } else {
          blocks = rebuildSentence4Elements(exGerman);
        }

        if (blocks && blocks.filter(Boolean).length >= 3) {
          const cleanBlocks = blocks.filter(Boolean);
          let shuffled = seededShuffle(cleanBlocks, randomFn);
          if (shuffled.join(' ') === cleanBlocks.join(' ') && cleanBlocks.length > 1) {
            shuffled = [cleanBlocks[1], cleanBlocks[0], ...cleanBlocks.slice(2)];
          }

          questions.push({
            number: questions.length + 1,
            arabicHint: normalizeArabicHint(exArabic),
            shuffledChips: shuffled,
            correctSentence: exGerman
          });
        }
      });

      if (questions.length >= 3) {
        result.sentenceOrder = questions;
      }
    }
  }

  // -------------------------------------------------------------
  // LAST PAGE: VOCABULARY TABLE (جدول المفردات والمعاني)
  // -------------------------------------------------------------
  if (options.includeVocabularyTable !== false && validItems.length > 0) {
    const showPlural = validItems.some(
      (i) => i.plural && i.plural.trim() && i.plural.trim() !== '-'
    );
    const showArticles = validItems.some(
      (i) => i.article || /^(der|die|das)\b/i.test(i.german)
    );

    const tableItems = validItems.map((i) => {
      const normE = normalizeDisplayEmoji(i.emoji);
      const numForItem = isNumberSet ? extractNumeralForItem(i) : undefined;
      return {
        german: stripEmoji(i.german).trim(),
        article: i.article,
        plural: i.plural && i.plural.trim() !== '-' ? i.plural.trim() : undefined,
        exampleGerman: i.exampleSentenceGerman ? i.exampleSentenceGerman.trim() : undefined,
        arabic: normalizeArabicHint(i.arabic),
        emoji: numForItem || normE.text || undefined,
        isNumberBadge: Boolean(numForItem || normE.isNumberBadge)
      };
    });

    result.vocabularyTable = {
      showArticles,
      showPlural,
      items: tableItems
    };
  }

  return result;
}

// ==========================================
// 8. SHARED STYLES & ATOMIC BLOCK BUILDER (CLEAN BOX-FREE DESIGN)
// ==========================================

export function getWorksheetCss(): string {
  return `
    @page {
      size: A4 portrait;
      margin: 0;
    }

    .ws-root, .ws-root * {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .ws-root {
      font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      background: #ffffff !important;
      color: #111827 !important;
      font-size: 13px !important;
      line-height: 1.45 !important;
      width: 794px !important;
      direction: ltr !important;
      text-align: left !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .page {
      width: 794px !important;
      height: 1123px !important;
      max-height: 1123px !important;
      padding: 28px 36px 52px 36px !important;
      margin: 0 !important;
      background: #ffffff !important;
      position: relative !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      display: block !important;
      direction: ltr !important;
      text-align: left !important;
      break-after: page;
      page-break-after: always;
    }

    .page-content {
      width: 722px !important;
      height: 1035px !important;
      max-height: 1035px !important;
      display: block !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      direction: ltr !important;
    }

    .ws-block {
      width: 100% !important;
      max-width: 722px !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .running-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      border-bottom: 1.5px solid #111827;
      padding-bottom: 6px;
      margin-bottom: 12px;
      font-size: 12px;
      font-weight: 700;
      color: #374151;
      height: 30px;
      width: 100% !important;
    }

    .de-text {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: isolate !important;
    }

    .ar-text {
      direction: rtl !important;
      text-align: right !important;
      unicode-bidi: isolate !important;
      font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif !important;
    }

    /* HEADER STYLING */
    .header-box {
      display: block !important;
      border: 1.5px solid #1f2937;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 12px;
      background: #ffffff;
    }

    .header-top {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }

    .school-title {
      font-size: 15px;
      font-weight: 800;
      color: #111827;
      margin-bottom: 2px;
    }

    .sheet-title-de {
      font-size: 18px;
      font-weight: 900;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .sheet-title-ar {
      font-size: 13px;
      font-weight: 700;
      color: #4b5563;
      margin-top: 2px;
    }

    .level-badge {
      display: inline-block;
      background: #1e40af;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      padding: 2px 10px;
      border-radius: 16px;
      margin-left: 8px;
    }

    .student-fields-grid {
      display: grid !important;
      grid-template-columns: 2fr 1.1fr 1.1fr 1fr !important;
      gap: 10px !important;
      font-size: 12px;
      font-weight: 700;
    }

    .field-line {
      border-bottom: 1.5px dashed #6b7280;
      display: inline-block;
      min-width: 90px;
      height: 18px;
      margin-left: 4px;
    }

    .sub-header-line {
      display: flex !important;
      justify-content: space-between !important;
      font-size: 12px;
      color: #374151;
      font-weight: 600;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dotted #d1d5db;
    }

    /* EXERCISE TITLE BLOCK (Clean bottom border, no gray box) */
    .exercise-header-block {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      background: transparent !important;
      border: none !important;
      border-bottom: 2px solid #1e40af !important;
      padding: 6px 0 6px 0;
      margin-top: 12px;
      margin-bottom: 8px;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    .ex-num-badge {
      width: 24px;
      height: 24px;
      background: #1e40af;
      color: #ffffff;
      border-radius: 50%;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-weight: 800;
      font-size: 13px;
      margin-right: 10px;
      flex-shrink: 0;
    }

    .ex-instructions {
      flex: 1;
    }

    .ex-instr-de {
      font-size: 13px;
      font-weight: 800;
      color: #111827;
    }

    .ex-instr-ar {
      font-size: 12px;
      font-weight: 700;
      color: #374151;
    }

    .ex-points {
      font-size: 12px;
      font-weight: 700;
      color: #374151;
      margin-left: 8px;
      flex-shrink: 0;
    }

    /* MATCHING 2-COLUMN GRID LAYOUT (Clean rows, no gray boxes) */
    .matching-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 32px !important;
      align-items: start !important;
      margin-bottom: 8px;
    }

    .matching-item {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 5px 4px;
      background: transparent !important;
      border: none !important;
      border-bottom: 1px dotted #d1d5db !important;
      margin-bottom: 4px;
      min-height: 34px;
      font-size: 13px;
    }

    .matching-box {
      width: 26px;
      height: 22px;
      border: 1.5px solid #4b5563;
      border-radius: 4px;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-weight: 800;
      font-size: 12px;
      background: #ffffff;
      color: #166534;
      margin-left: 8px;
    }

    .dot-node {
      width: 7px;
      height: 7px;
      background: #374151;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }

    /* MISSING LETTERS ROW (Clean open row, no gray background box) */
    .missing-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 6px 2px;
      background: transparent !important;
      border: none !important;
      border-bottom: 1px dotted #d1d5db !important;
      margin-bottom: 4px;
      min-height: 34px;
    }

    .writing-line-tall {
      display: inline-block;
      min-width: 140px;
      border-bottom: 1.5px solid #374151;
      height: 24px;
      vertical-align: bottom;
      margin-left: 10px;
    }

    /* ODD ONE OUT QUESTION BLOCK (Clean open row, no background boxes) */
    .odd-card {
      display: block !important;
      margin-bottom: 4px;
      padding: 6px 2px;
      background: transparent !important;
      border: none !important;
      border-bottom: 1px dotted #d1d5db !important;
    }

    .options-grid {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 10px !important;
      margin-top: 2px;
    }

    .option-btn {
      padding: 3px 4px;
      border: none !important;
      background: transparent !important;
      font-size: 13px;
      font-weight: 600;
      text-align: left;
      color: #111827;
    }

    .option-correct {
      color: #166534 !important;
      font-weight: 800 !important;
      text-decoration: underline !important;
    }

    /* GRAMMAR QUESTION BLOCK (Clean open row, no background box) */
    .grammar-row {
      display: block !important;
      padding: 6px 2px;
      background: transparent !important;
      border: none !important;
      border-bottom: 1px dotted #d1d5db !important;
      margin-bottom: 4px;
      font-size: 13px;
    }

    /* PICTURES GRID ROW (4 COLUMNS PER ROW, clean open cells) */
    .pictures-row-grid {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 14px !important;
      margin-bottom: 8px;
    }

    .picture-cell {
      border: none !important;
      padding: 8px 4px;
      text-align: center;
      background: transparent !important;
    }

    .picture-display {
      height: 48px;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin-bottom: 4px;
      letter-spacing: 0px !important;
    }

    .numeral-badge {
      display: inline-block !important;
      color: #1e3a8a;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 0px !important;
      font-variant-numeric: tabular-nums;
    }

    .word-bank-box {
      border-bottom: 1px dashed #9ca3af;
      background: transparent !important;
      padding: 4px 0 8px 0;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #1e40af;
      text-align: center;
    }

    /* SENTENCE ORDER ROW (Clean open row, no chip boxes or background boxes!) */
    .sentence-row {
      display: block !important;
      padding: 7px 2px;
      background: transparent !important;
      border: none !important;
      border-bottom: 1px dotted #d1d5db !important;
      margin-bottom: 4px;
    }

    .chip-text {
      display: inline;
      font-weight: 700;
      font-size: 13px;
      color: #111827;
    }

    .chip-sep {
      display: inline;
      font-weight: 800;
      color: #6b7280;
      margin: 0 6px;
    }

    /* VOCABULARY TABLE STYLING */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }

    .data-table th, .data-table td {
      border: 1px solid #9ca3af;
      padding: 7px 10px;
      font-size: 12px;
    }

    .data-table th {
      background: #f3f4f6;
      font-weight: 800;
      color: #111827;
    }

    .table-num-badge {
      display: inline-block;
      color: #1e40af;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0px !important;
      margin-right: 6px;
    }

    /* FOOTER STYLING (MIN 12PX FONT) */
    .footer-bar {
      position: absolute;
      bottom: 16px;
      left: 36px;
      right: 36px;
      height: 26px;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      font-size: 12px !important;
      font-weight: 600;
      color: #4b5563;
      border-top: 1px solid #d1d5db;
      padding-top: 6px;
    }

    .teacher-answer {
      color: #166534 !important;
      font-weight: 800 !important;
      font-size: 12px !important;
    }
  `;
}

export function buildWorksheetBlocks(
  set: LernstudioSet,
  options: WorksheetOptions = {}
): { data: WorksheetData; blocks: WorksheetBlock[] } {
  const data = buildWorksheetData(set, options);
  const isTeacher = data.isTeacherKey;
  const blocks: WorksheetBlock[] = [];
  const answerKeyEntries: { exName: string; answers: string[] }[] = [];

  // 1. HEADER BLOCK
  const subHeaderHtml = data.teacherName
    ? `
      <div class="sub-header-line">
        <span><strong>Lehrer/in:</strong> ${escapeHtml(data.teacherName)}</span>
        <span><strong>Fach:</strong> Deutsch (اللغة الألمانية)</span>
      </div>
    `
    : '';

  const headerHtml = `
    <div class="ws-block header-box" data-block-id="doc_header">
      <div class="header-top">
        <div>
          <div class="school-title">${escapeHtml(data.schoolName)}</div>
          <div style="display: flex; align-items: center;">
            <span class="sheet-title-de">${isTeacher ? 'LÖSUNGSSCHLÜSSEL' : 'ARBEITSBLATT'}</span>
            <span class="level-badge">${escapeHtml(data.level)}</span>
          </div>
          <div class="sheet-title-ar ar-text" dir="rtl">${isTeacher ? 'نموذج إجابة المعلم' : escapeHtml(data.titleArabic)}</div>
        </div>
        <div class="ar-text" dir="rtl" style="padding-left: 8px;">
          <div style="font-size: 12px; font-weight: 700; color: #4b5563;" dir="rtl">Thema / الموضوع:</div>
          <div style="font-size: 14px; font-weight: 800; color: #111827;" dir="rtl">${escapeHtml(data.topic)}</div>
        </div>
      </div>

      <div class="student-fields-grid">
        <div><strong>Name / الاسم:</strong> <span class="field-line"></span></div>
        <div><strong>Klasse:</strong> <span style="color:#111827;">${escapeHtml(data.grade)}</span></div>
        <div><strong>Datum:</strong> <span style="color:#111827;">${escapeHtml(data.dateStr)}</span></div>
        <div><strong>Punkte:</strong> <span style="border-bottom: 1.5px solid #000; min-width: 30px; display: inline-block;"></span></div>
      </div>
      ${subHeaderHtml}
    </div>
  `;
  blocks.push({
    id: 'doc_header',
    type: 'header',
    height: data.teacherName ? 140 : 118,
    html: headerHtml
  });

  let exerciseCounter = 1;

  // -------------------------------------------------------------
  // EXERCISE 1: MATCHING (2-Column Grid Side-by-Side)
  // -------------------------------------------------------------
  if (data.matching && data.matching.questions.length > 0) {
    const exNum = exerciseCounter++;
    const exId = `ex_${exNum}_matching`;
    const answersList: string[] = [];

    blocks.push({
      id: `${exId}_title`,
      type: 'ex_title',
      exerciseId: exId,
      height: 48,
      html: `
        <div class="ws-block exercise-header-block" data-block-id="${exId}_title">
          <div style="display: flex; align-items: center;">
            <span class="ex-num-badge">${exNum}</span>
            <div class="ex-instructions">
              <div class="ex-instr-de de-text" dir="ltr">Verbinde die Wörter mit der richtigen Bedeutung.</div>
              <div class="ex-instr-ar ar-text" dir="rtl">صل الكلمة الألمانية بالمعنى العربي المناسب:</div>
            </div>
          </div>
          <span class="ex-points">(${data.matching.questions.length} Punkte)</span>
        </div>
      `
    });

    let leftColHtml = '';
    data.matching.questions.forEach((q) => {
      answersList.push(`${q.number}) ${q.correctLetter}`);
      leftColHtml += `
        <div class="matching-item">
          <div class="de-text" dir="ltr" style="display: flex; align-items: center;">
            <span style="font-weight: 800; margin-right: 6px;">${q.number}.</span>
            <span style="font-weight: 700; color: #111827;">${escapeHtml(q.german)}</span>
            <span class="matching-box">${isTeacher ? escapeHtml(q.correctLetter) : ''}</span>
          </div>
          <span class="dot-node"></span>
        </div>
      `;
    });

    let rightColHtml = '';
    data.matching.choices.forEach((c) => {
      rightColHtml += `
        <div class="matching-item" style="justify-content: flex-start;">
          <span class="dot-node" style="margin-right: 10px;"></span>
          <span style="font-weight: 800; color: #1e40af; margin-right: 8px;">${escapeHtml(c.letter)}.</span>
          <span class="ar-text" dir="rtl" style="font-weight: 700; color: #1f2937;">${escapeHtml(c.arabic)}</span>
        </div>
      `;
    });

    const matchingGridHeight = data.matching.questions.length * 38 + 8;
    blocks.push({
      id: `${exId}_grid`,
      type: 'question',
      exerciseId: exId,
      height: matchingGridHeight,
      html: `
        <div class="ws-block matching-grid" data-block-id="${exId}_grid">
          <div>${leftColHtml}</div>
          <div>${rightColHtml}</div>
        </div>
      `
    });

    answerKeyEntries.push({ exName: `Übung ${exNum} (Wort-Zuordnung)`, answers: answersList });
  }

  // -------------------------------------------------------------
  // EXERCISE 2: MISSING LETTERS
  // -------------------------------------------------------------
  if (data.missingLetters && data.missingLetters.length > 0) {
    const exNum = exerciseCounter++;
    const exId = `ex_${exNum}_missing`;
    const answersList: string[] = [];

    blocks.push({
      id: `${exId}_title`,
      type: 'ex_title',
      exerciseId: exId,
      height: 48,
      html: `
        <div class="ws-block exercise-header-block" data-block-id="${exId}_title">
          <div style="display: flex; align-items: center;">
            <span class="ex-num-badge">${exNum}</span>
            <div class="ex-instructions">
              <div class="ex-instr-de de-text" dir="ltr">Ergänze die fehlenden Buchstaben.</div>
              <div class="ex-instr-ar ar-text" dir="rtl">أكمل الحروف الناقصة واكتب الكلمة كاملة:</div>
            </div>
          </div>
          <span class="ex-points">(${data.missingLetters.length} Punkte)</span>
        </div>
      `
    });

    data.missingLetters.forEach((q) => {
      answersList.push(`${q.number}) ${q.fullWord}`);
      const qBlockId = `${exId}_q_${q.number}`;
      blocks.push({
        id: qBlockId,
        type: 'question',
        exerciseId: exId,
        height: 38,
        html: `
          <div class="ws-block missing-row" data-block-id="${qBlockId}">
            <div class="de-text" dir="ltr" style="display: flex; align-items: center;">
              <span style="font-weight: 800; min-width: 26px;">${q.number})</span>
              <span style="font-family: monospace; font-size: 15px; font-weight: 800; letter-spacing: 2px; color: #111827; margin-right: 12px;">
                ${escapeHtml(q.gappedWord)}
              </span>
              <span class="writing-line-tall"></span>
              ${isTeacher ? `<span class="teacher-answer" style="margin-left: 10px;">[${escapeHtml(q.fullWord)}]</span>` : ''}
            </div>
            <div class="ar-text" dir="rtl" style="font-weight: 700; color: #374151; font-size: 12px;">
              ${escapeHtml(q.arabicHint)}
            </div>
          </div>
        `
      });
    });

    answerKeyEntries.push({ exName: `Übung ${exNum} (Buchstaben ergänzen)`, answers: answersList });
  }

  // -------------------------------------------------------------
  // EXERCISE 3: ODD ONE OUT
  // -------------------------------------------------------------
  if (data.oddOneOut && data.oddOneOut.length > 0) {
    const exNum = exerciseCounter++;
    const exId = `ex_${exNum}_odd`;
    const answersList: string[] = [];

    blocks.push({
      id: `${exId}_title`,
      type: 'ex_title',
      exerciseId: exId,
      height: 62,
      html: `
        <div class="ws-block exercise-header-block" data-block-id="${exId}_title">
          <div style="display: flex; align-items: center;">
            <span class="ex-num-badge">${exNum}</span>
            <div class="ex-instructions">
              <div class="ex-instr-de de-text" dir="ltr">${escapeHtml(data.oddOneOut[0]?.promptDe || 'Welches Wort passt nicht zum Thema?')}</div>
              <div class="ex-instr-ar ar-text" dir="rtl">${escapeHtml(data.oddOneOut[0]?.promptAr || 'أي كلمة لا تنتمي للموضوع؟')}</div>
              <div style="font-size: 12px; font-weight: 700; color: #1e40af; margin-top: 2px;">(Thema: ${escapeHtml(data.topic)})</div>
            </div>
          </div>
          <span class="ex-points">(${data.oddOneOut.length} Punkte)</span>
        </div>
      `
    });

    data.oddOneOut.forEach((q) => {
      answersList.push(`${q.number}) ${q.correctLetter} (${q.correctText})`);
      const qBlockId = `${exId}_q_${q.number}`;

      const optsHtml = q.options
        .map((opt) => {
          const isOptCorrect = isTeacher && opt.isCorrect;
          return `
            <div class="option-btn de-text ${isOptCorrect ? 'option-correct' : ''}" dir="ltr">
              <strong>${escapeHtml(opt.letter)})</strong> ${escapeHtml(opt.text)}
            </div>
          `;
        })
        .join('');

      blocks.push({
        id: qBlockId,
        type: 'question',
        exerciseId: exId,
        height: 44,
        html: `
          <div class="ws-block odd-card" data-block-id="${qBlockId}">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 13px; font-weight: 800; color: #111827; min-width: 24px;">${q.number}.</span>
              <div class="options-grid" style="flex: 1;">
                ${optsHtml}
              </div>
            </div>
          </div>
        `
      });
    });

    answerKeyEntries.push({ exName: `Übung ${exNum} (Was passt nicht?)`, answers: answersList });
  }

  // -------------------------------------------------------------
  // EXERCISE 4: GRAMMAR
  // -------------------------------------------------------------
  if (data.grammar && data.grammar.length > 0) {
    const exNum = exerciseCounter++;
    const exId = `ex_${exNum}_grammar`;
    const answersList: string[] = [];

    blocks.push({
      id: `${exId}_title`,
      type: 'ex_title',
      exerciseId: exId,
      height: 48,
      html: `
        <div class="ws-block exercise-header-block" data-block-id="${exId}_title">
          <div style="display: flex; align-items: center;">
            <span class="ex-num-badge">${exNum}</span>
            <div class="ex-instructions">
              <div class="ex-instr-de de-text" dir="ltr">Grammatik-Übung</div>
              <div class="ex-instr-ar ar-text" dir="rtl">تمرين القواعد:</div>
            </div>
          </div>
          <span class="ex-points">(${data.grammar.length} Punkte)</span>
        </div>
      `
    });

    data.grammar.forEach((q) => {
      answersList.push(`${q.number}) ${q.correctAnswer}`);
      const qBlockId = `${exId}_q_${q.number}`;

      blocks.push({
        id: qBlockId,
        type: 'question',
        exerciseId: exId,
        height: 54,
        html: `
          <div class="ws-block grammar-row" data-block-id="${qBlockId}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span class="de-text" dir="ltr" style="font-weight: 800; color: #111827;">${q.number}) ${escapeHtml(q.promptDe)}</span>
              <span class="ar-text" dir="rtl" style="font-weight: 700; color: #374151; font-size: 12px;">${escapeHtml(q.promptAr)}</span>
            </div>
            <div class="de-text" dir="ltr" style="font-weight: 700; color: #1f2937; font-family: monospace; font-size: 13px;">
              ${escapeHtml(q.writingPrompt)}
              ${isTeacher ? `<span class="teacher-answer" style="margin-left: 12px;">[Lösung: ${escapeHtml(q.correctAnswer)}]</span>` : ''}
            </div>
          </div>
        `
      });
    });

    answerKeyEntries.push({ exName: `Übung ${exNum} (Grammatik)`, answers: answersList });
  }

  // -------------------------------------------------------------
  // EXERCISE 5: PICTURES / NUMERAL WORDS (4 items per row in 4-column grid, no boxes!)
  // -------------------------------------------------------------
  if (data.pictures && data.pictures.items.length > 0) {
    const exNum = exerciseCounter++;
    const exId = `ex_${exNum}_pictures`;
    const answersList: string[] = [];

    const wordBankHtml =
      data.pictures.wordBank && data.pictures.wordBank.length > 0
        ? `
          <div class="word-bank-box de-text" dir="ltr">
            <strong>Wörterbox:</strong> ${data.pictures.wordBank.map((w) => escapeHtml(w)).join('  •  ')}
          </div>
        `
        : '';

    blocks.push({
      id: `${exId}_title`,
      type: 'ex_title',
      exerciseId: exId,
      height: wordBankHtml ? 82 : 48,
      html: `
        <div class="ws-block" data-block-id="${exId}_title" style="display: block;">
          <div class="exercise-header-block">
            <div style="display: flex; align-items: center;">
              <span class="ex-num-badge">${exNum}</span>
              <div class="ex-instructions">
                <div class="ex-instr-de de-text" dir="ltr">${escapeHtml(data.pictures.instrDe)}</div>
                <div class="ex-instr-ar ar-text" dir="rtl">${escapeHtml(data.pictures.instrAr)}</div>
              </div>
            </div>
            <span class="ex-points">(${data.pictures.items.length} Punkte)</span>
          </div>
          ${wordBankHtml}
        </div>
      `
    });

    for (let i = 0; i < data.pictures.items.length; i += 4) {
      const rowItems = data.pictures.items.slice(i, i + 4);
      const rowBlockId = `${exId}_row_${Math.floor(i / 4) + 1}`;

      const cellsHtml = rowItems
        .map((p) => {
          answersList.push(`${p.number}) ${p.correctWord}`);
          const visualContent = p.imageUrl
            ? `<img src="${p.imageUrl}" alt="picture" style="max-height: 46px; max-width: 100%; object-fit: contain;" />`
            : p.numeralBadge
            ? `<span class="numeral-badge">${escapeHtml(p.numeralBadge)}</span>`
            : `<span style="font-size: 34px; letter-spacing: 0px;">${escapeHtml(p.emoji || '📷')}</span>`;

          return `
            <div class="picture-cell">
              <div class="picture-display">
                ${visualContent}
              </div>
              <div style="margin-top: 4px; display: flex; align-items: flex-end; justify-content: center;">
                <span style="font-weight: 800; font-size: 12px; margin-right: 4px;">${p.number}.</span>
                <span class="writing-line-tall" style="min-width: 105px; margin-left: 0;"></span>
              </div>
              ${isTeacher ? `<div class="teacher-answer" style="margin-top: 4px;">[${escapeHtml(p.correctWord)}]</div>` : ''}
            </div>
          `;
        })
        .join('');

      blocks.push({
        id: rowBlockId,
        type: 'pic_row',
        exerciseId: exId,
        height: isTeacher ? 124 : 104,
        html: `
          <div class="ws-block pictures-row-grid" data-block-id="${rowBlockId}">
            ${cellsHtml}
          </div>
        `
      });
    }

    answerKeyEntries.push({ exName: `Übung ${exNum} (Bilder / Zahlen)`, answers: answersList });
  }

  // -------------------------------------------------------------
  // EXERCISE 6: SENTENCE ORDER (Clean open rows & slash-separated words — ZERO background boxes!)
  // -------------------------------------------------------------
  if (data.sentenceOrder && data.sentenceOrder.length > 0) {
    const exNum = exerciseCounter++;
    const exId = `ex_${exNum}_sentence`;
    const answersList: string[] = [];

    blocks.push({
      id: `${exId}_title`,
      type: 'ex_title',
      exerciseId: exId,
      height: 48,
      html: `
        <div class="ws-block exercise-header-block" data-block-id="${exId}_title">
          <div style="display: flex; align-items: center;">
            <span class="ex-num-badge">${exNum}</span>
            <div class="ex-instructions">
              <div class="ex-instr-de de-text" dir="ltr">Bringe die Satzteile in die richtige Reihenfolge.</div>
              <div class="ex-instr-ar ar-text" dir="rtl">رتب أجزاء الجملة لتكوين جملة ألمانية صحيحة:</div>
            </div>
          </div>
          <span class="ex-points">(${data.sentenceOrder.length} Punkte)</span>
        </div>
      `
    });

    data.sentenceOrder.forEach((q) => {
      answersList.push(`${q.number}) ${q.correctSentence}`);
      const qBlockId = `${exId}_q_${q.number}`;

      const chipsHtml = q.shuffledChips
        .map((chip) => `<span class="chip-text">${escapeHtml(chip)}</span>`)
        .join('<span class="chip-sep">/</span>');

      blocks.push({
        id: qBlockId,
        type: 'question',
        exerciseId: exId,
        height: isTeacher ? 86 : 68,
        html: `
          <div class="ws-block sentence-row" data-block-id="${qBlockId}">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; gap: 12px;">
              <div class="de-text" dir="ltr" style="flex: 1;">
                <span style="font-weight: 800; margin-right: 6px;">${q.number})</span>
                ${chipsHtml}
              </div>
              <div class="ar-text" dir="rtl" style="font-size: 12px; font-weight: 700; color: #374151; flex-shrink: 0;">
                ${escapeHtml(q.arabicHint)}
              </div>
            </div>
            <div style="margin-top: 2px; font-size: 13px; font-weight: 700; color: #1f2937;">
              Antwort: <span class="writing-line-tall" style="min-width: 520px;"></span>
              ${isTeacher ? `<div class="teacher-answer" style="margin-top: 4px;">[Lösung: ${escapeHtml(q.correctSentence)}]</div>` : ''}
            </div>
          </div>
        `
      });
    });

    answerKeyEntries.push({ exName: `Übung ${exNum} (Satzbau)`, answers: answersList });
  }

  // -------------------------------------------------------------
  // VOCABULARY TABLE (chunked into max 14 rows per page block)
  // -------------------------------------------------------------
  if (data.vocabularyTable && data.vocabularyTable.items.length > 0) {
    const tableData = data.vocabularyTable;
    const chunkSize = 14;

    for (let cIdx = 0; cIdx < tableData.items.length; cIdx += chunkSize) {
      const chunkItems = tableData.items.slice(cIdx, cIdx + chunkSize);
      const isFirstChunk = cIdx === 0;
      const blockId = `vocab_table_chunk_${Math.floor(cIdx / chunkSize) + 1}`;

      const rowsHtml = chunkItems
        .map((item, idx) => {
          const rowNumber = cIdx + idx + 1;
          const artDisplay = item.article
            ? `<span style="color: #1e40af; font-weight: 800; margin-right: 4px;">${escapeHtml(item.article)}</span>`
            : '';
          const emojiDisplay = item.emoji
            ? item.isNumberBadge
              ? `<span class="table-num-badge">${escapeHtml(item.emoji)}</span>`
              : `<span style="margin-right: 6px; letter-spacing: 0px;">${escapeHtml(item.emoji)}</span>`
            : '';

          return `
            <tr>
              <td style="text-align: center; font-weight: 800; color: #4b5563;">${rowNumber}</td>
              <td class="de-text" dir="ltr" style="font-weight: 700;">
                ${emojiDisplay}${artDisplay}${escapeHtml(item.german)}
              </td>
              ${tableData.showPlural ? `<td class="de-text" dir="ltr" style="font-weight: 600;">${escapeHtml(item.plural || '–')}</td>` : ''}
              <td class="de-text" dir="ltr" style="color: #374151;">${escapeHtml(item.exampleGerman || '–')}</td>
              <td class="ar-text" dir="rtl" style="font-weight: 700; color: #111827;">${escapeHtml(item.arabic)}</td>
            </tr>
          `;
        })
        .join('');

      const estHeight = 95 + 38 + chunkItems.length * 40;
      blocks.push({
        id: blockId,
        type: 'vocab_table',
        height: estHeight,
        html: `
          <div class="ws-block" data-block-id="${blockId}" style="display: block;">
            <div class="header-box" style="margin-bottom: 10px; padding: 10px 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div class="sheet-title-de" style="font-size: 16px;">WORTSCHATZ-ÜBERSICHT${!isFirstChunk ? ' (Fortsetzung)' : ''}</div>
                  <div class="sheet-title-ar ar-text" dir="rtl">جدول المفردات والمعاني - ${escapeHtml(data.title)}</div>
                </div>
                <span class="level-badge">${escapeHtml(data.level)}</span>
              </div>
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 6%;">#</th>
                  <th style="width: 24%; text-align: left;" class="de-text">Deutsch (Wort)</th>
                  ${tableData.showPlural ? `<th style="width: 18%; text-align: left;" class="de-text">Plural (الجمع)</th>` : ''}
                  <th style="width: 30%; text-align: left;" class="de-text">Beispielsatz</th>
                  <th style="width: 22%; text-align: right;" class="ar-text" dir="rtl">الترجمة العربية</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `
      });
    }
  }

  // -------------------------------------------------------------
  // TEACHER ANSWER KEY BLOCK
  // -------------------------------------------------------------
  if (isTeacher && answerKeyEntries.length > 0) {
    const entriesHtml = answerKeyEntries
      .map(
        (entry) => `
          <div style="break-inside: avoid; page-break-inside: avoid; padding: 6px 8px; border-bottom: 1px dotted #86efac;">
            <strong style="color: #15803d; font-size: 12px;">${escapeHtml(entry.exName)}:</strong>
            <div style="color: #166534; margin-top: 3px; font-weight: 600; font-size: 12px;">
              ${entry.answers.map((a) => escapeHtml(a)).join(' • ')}
            </div>
          </div>
        `
      )
      .join('');

    const estKeyHeight = 65 + Math.ceil(answerKeyEntries.length / 2) * 58;
    blocks.push({
      id: 'teacher_answer_key_summary',
      type: 'teacher_key',
      height: estKeyHeight,
      html: `
        <div class="ws-block" data-block-id="teacher_answer_key_summary" style="display: block; margin-top: 14px; padding: 12px; border: 1.5px dashed #166534; border-radius: 10px;">
          <div style="font-weight: 800; color: #166534; font-size: 13px; margin-bottom: 8px;">
            🔑 LÖSUNGSSCHLÜSSEL FÜR DEN LEHRER (ملخص الإجابات للمعلم)
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
            ${entriesHtml}
          </div>
        </div>
      `
    });
  }

  return { data, blocks };
}

export function renderPaginatedWorksheetHtml(
  data: WorksheetData,
  paginatedPages: WorksheetBlock[][]
): string {
  const isTeacher = data.isTeacherKey;
  const totalPages = Math.max(1, paginatedPages.length);

  const pagesHtml = paginatedPages
    .map((pageBlocks, idx) => {
      const pageNum = idx + 1;
      const runningHeaderHtml =
        pageNum > 1
          ? `
            <div class="running-header">
              <span>Arbeitsblatt: ${escapeHtml(data.title)} (${escapeHtml(data.level)})</span>
              <span>Name: ________________________</span>
            </div>
          `
          : '';

      const blocksInnerHtml = pageBlocks.map((b) => b.html).join('\n');

      return `
        <div class="page" dir="ltr" data-page-number="${pageNum}" data-total-pages="${totalPages}">
          <div class="page-content" dir="ltr">
            ${runningHeaderHtml}
            ${blocksInnerHtml}
          </div>
          <div class="footer-bar" dir="ltr">
            <span>${escapeHtml(data.schoolName)} • ${escapeHtml(data.title)}</span>
            <span>Seite ${pageNum}/${totalPages} • ${WORKSHEET_BUILD_ID}</span>
            <span>Datum: ${escapeHtml(data.dateStr)}</span>
          </div>
        </div>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="de" dir="ltr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.title)} - ${isTeacher ? 'Lehrerversion' : 'Arbeitsblatt'} (${WORKSHEET_BUILD_ID})</title>
  <style>${getWorksheetCss()}</style>
</head>
<body dir="ltr" style="margin:0;padding:0;background:#ffffff;">
<div class="ws-root" dir="ltr">
${pagesHtml}
</div>
</body>
</html>`;
}

export function buildWorksheetHtml(
  set: LernstudioSet,
  options: WorksheetOptions = {},
  customPageContentHeight: number = DEFAULT_PAGE_CONTENT_HEIGHT_PX
): string {
  console.log(`[LernstudioWorksheet] Generating HTML with build stamp: ${WORKSHEET_BUILD_ID}`);
  const { data, blocks } = buildWorksheetBlocks(set, options);
  const paginatedPages = paginateBlocks(blocks, customPageContentHeight, RUNNING_HEADER_HEIGHT_PX);
  return renderPaginatedWorksheetHtml(data, paginatedPages);
}
