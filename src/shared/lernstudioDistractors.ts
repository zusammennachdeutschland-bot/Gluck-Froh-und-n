/**
 * Domain-tagged distractor pool and domain classifiers for Lernstudio Worksheet exercises
 */

export type DistractorDomain =
  | 'animals'
  | 'furniture'
  | 'food'
  | 'colors'
  | 'school'
  | 'body'
  | 'clothes'
  | 'transport'
  | 'numbers'
  | 'greetings'
  | 'politeness'
  | 'verbs'
  | 'family'
  | 'nature';

export interface DistractorNoun {
  german: string;
  article: 'der' | 'die' | 'das';
  arabic: string;
  domain: DistractorDomain;
}

export interface DistractorVerb {
  infinitive: string;
  arabic: string;
  domain: DistractorDomain;
}

export interface TaggedDomainWord {
  word: string;
  arabic: string;
  domain: DistractorDomain;
}

export const FALLBACK_NOUN_DISTRACTORS: DistractorNoun[] = [
  // DER Nouns
  { german: 'der Tisch', article: 'der', arabic: 'الطاولة', domain: 'furniture' },
  { german: 'der Stuhl', article: 'der', arabic: 'الكرسي', domain: 'furniture' },
  { german: 'der Hund', article: 'der', arabic: 'الكلب', domain: 'animals' },
  { german: 'der Apfel', article: 'der', arabic: 'التفاحة', domain: 'food' },
  { german: 'der Bleistift', article: 'der', arabic: 'القلم الرصاص', domain: 'school' },
  { german: 'der Schrank', article: 'der', arabic: 'الخزانة', domain: 'furniture' },
  { german: 'der Mantel', article: 'der', arabic: 'المعطف', domain: 'clothes' },
  { german: 'der Garten', article: 'der', arabic: 'الحديقة', domain: 'nature' },
  { german: 'der Vater', article: 'der', arabic: 'الأب', domain: 'family' },
  { german: 'der Bruder', article: 'der', arabic: 'الأخ', domain: 'family' },
  { german: 'der Kopf', article: 'der', arabic: 'الرأس', domain: 'body' },
  { german: 'der Zug', article: 'der', arabic: 'القطار', domain: 'transport' },
  { german: 'der Schuh', article: 'der', arabic: 'الحذاء', domain: 'clothes' },
  { german: 'der Kuli', article: 'der', arabic: 'قلم الحبر', domain: 'school' },
  { german: 'der Vogel', article: 'der', arabic: 'العصفور', domain: 'animals' },

  // DIE Nouns
  { german: 'die Lampe', article: 'die', arabic: 'المصباح', domain: 'furniture' },
  { german: 'die Tür', article: 'die', arabic: 'الباب', domain: 'furniture' },
  { german: 'die Katze', article: 'die', arabic: 'القطة', domain: 'animals' },
  { german: 'die Tasche', article: 'die', arabic: 'الحقيبة', domain: 'school' },
  { german: 'die Schule', article: 'die', arabic: 'المدرسة', domain: 'school' },
  { german: 'die Mutter', article: 'die', arabic: 'الأم', domain: 'family' },
  { german: 'die Schwester', article: 'die', arabic: 'الأخت', domain: 'family' },
  { german: 'die Sonne', article: 'die', arabic: 'الشمس', domain: 'nature' },
  { german: 'die Blume', article: 'die', arabic: 'الزهرة', domain: 'nature' },
  { german: 'dieJacke'.replace('dieJacke', 'die Jacke'), article: 'die', arabic: 'الجاكيت', domain: 'clothes' },
  { german: 'die Tafel', article: 'die', arabic: 'السبورة', domain: 'school' },
  { german: 'die Hand', article: 'die', arabic: 'اليد', domain: 'body' },
  { german: 'die Banane', article: 'die', arabic: 'الموزة', domain: 'food' },
  { german: 'die Milch', article: 'die', arabic: 'الحليب', domain: 'food' },
  { german: 'die Hose', article: 'die', arabic: 'البنطلون', domain: 'clothes' },

  // DAS Nouns
  { german: 'das Buch', article: 'das', arabic: 'الكتاب', domain: 'school' },
  { german: 'das Fenster', article: 'das', arabic: 'النافذة', domain: 'furniture' },
  { german: 'das Bett', article: 'das', arabic: 'السرير', domain: 'furniture' },
  { german: 'das Auto', article: 'das', arabic: 'السيارة', domain: 'transport' },
  { german: 'das Pferd', article: 'das', arabic: 'الحصان', domain: 'animals' },
  { german: 'das Brot', article: 'das', arabic: 'الخبز', domain: 'food' },
  { german: 'das Wasser', article: 'das', arabic: 'الماء', domain: 'food' },
  { german: 'das Hemd', article: 'das', arabic: 'القميص', domain: 'clothes' },
  { german: 'das Auge', article: 'das', arabic: 'العين', domain: 'body' },
  { german: 'das Flugzeug', article: 'das', arabic: 'الطائرة', domain: 'transport' },
  { german: 'das Heft', article: 'das', arabic: 'الكشكول', domain: 'school' },
  { german: 'das Lineal', article: 'das', arabic: 'المسطرة', domain: 'school' },
  { german: 'das Fahrrad', article: 'das', arabic: 'الدراجة', domain: 'transport' },
  { german: 'das Schaf', article: 'das', arabic: 'الخروف', domain: 'animals' },
  { german: 'das Kleid', article: 'das', arabic: 'الفستان', domain: 'clothes' }
];

export const FALLBACK_VERB_DISTRACTORS: DistractorVerb[] = [
  { infinitive: 'gehen', arabic: 'يذهب', domain: 'verbs' },
  { infinitive: 'lernen', arabic: 'يتعلم', domain: 'verbs' },
  { infinitive: 'essen', arabic: 'يأكل', domain: 'verbs' },
  { infinitive: 'trinken', arabic: 'يشرب', domain: 'verbs' },
  { infinitive: 'spielen', arabic: 'يلعب', domain: 'verbs' },
  { infinitive: 'schlafen', arabic: 'ينام', domain: 'verbs' },
  { infinitive: 'fahren', arabic: 'يركب/يسافر', domain: 'verbs' },
  { infinitive: 'arbeiten', arabic: 'يعمل', domain: 'verbs' },
  { infinitive: 'kochen', arabic: 'يطبخ', domain: 'verbs' },
  { infinitive: 'schwimmen', arabic: 'يسبح', domain: 'verbs' },
  { infinitive: 'laufen', arabic: 'يجري', domain: 'verbs' },
  { infinitive: 'schreiben', arabic: 'يكتب', domain: 'verbs' },
  { infinitive: 'lesen', arabic: 'يقرأ', domain: 'verbs' },
  { infinitive: 'sprechen', arabic: 'يتحدث', domain: 'verbs' },
  { infinitive: 'sehen', arabic: 'يرى', domain: 'verbs' },
  { infinitive: 'hören', arabic: 'يسمع', domain: 'verbs' },
  { infinitive: 'wohnen', arabic: 'يسكن', domain: 'verbs' },
  { infinitive: 'kommen', arabic: 'يأتي', domain: 'verbs' },
  { infinitive: 'kaufen', arabic: 'يشتري', domain: 'verbs' },
  { infinitive: 'verstehen', arabic: 'يفهم', domain: 'verbs' },
  { infinitive: 'tanzen', arabic: 'يرقص', domain: 'verbs' },
  { infinitive: 'singen', arabic: 'يغني', domain: 'verbs' },
  { infinitive: 'suchen', arabic: 'يبحث', domain: 'verbs' },
  { infinitive: 'finden', arabic: 'يجد', domain: 'verbs' },
  { infinitive: 'fragen', arabic: 'يسأل', domain: 'verbs' },
  { infinitive: 'antworten', arabic: 'يجيب', domain: 'verbs' },
  { infinitive: 'brauchen', arabic: 'يحتاج', domain: 'verbs' },
  { infinitive: 'bringen', arabic: 'يجلب', domain: 'verbs' },
  { infinitive: 'machen', arabic: 'يفعل/يجعل', domain: 'verbs' },
  { infinitive: 'sagen', arabic: 'يقول', domain: 'verbs' }
];

export const TAGGED_DOMAIN_DISTRACTORS: TaggedDomainWord[] = [
  // Animals (Tiere)
  { word: 'der Hund', arabic: 'الكلب', domain: 'animals' },
  { word: 'die Katze', arabic: 'القطة', domain: 'animals' },
  { word: 'der Elefant', arabic: 'الفيل', domain: 'animals' },
  { word: 'die Giraffe', arabic: 'الزرافة', domain: 'animals' },
  { word: 'der Vogel', arabic: 'العصفور', domain: 'animals' },
  { word: 'das Pferd', arabic: 'الحصان', domain: 'animals' },
  { word: 'der Löwe', arabic: 'الأسد', domain: 'animals' },

  // Furniture (Möbel)
  { word: 'der Tisch', arabic: 'الطاولة', domain: 'furniture' },
  { word: 'der Stuhl', arabic: 'الكرسي', domain: 'furniture' },
  { word: 'der Schrank', arabic: 'الخزانة', domain: 'furniture' },
  { word: 'das Bett', arabic: 'السرير', domain: 'furniture' },
  { word: 'die Lampe', arabic: 'المصباح', domain: 'furniture' },
  { word: 'das Sofa', arabic: 'الأريكة', domain: 'furniture' },

  // Food & Drinks (Essen)
  { word: 'der Apfel', arabic: 'التفاحة', domain: 'food' },
  { word: 'die Banane', arabic: 'الموزة', domain: 'food' },
  { word: 'das Brot', arabic: 'الخبز', domain: 'food' },
  { word: 'die Pizza', arabic: 'البيتزا', domain: 'food' },
  { word: 'die Milch', arabic: 'الحليب', domain: 'food' },
  { word: 'der Käse', arabic: 'الجبن', domain: 'food' },

  // Colors (Farben)
  { word: 'rot', arabic: 'أحمر', domain: 'colors' },
  { word: 'blau', arabic: 'أزرق', domain: 'colors' },
  { word: 'grün', arabic: 'أخضر', domain: 'colors' },
  { word: 'gelb', arabic: 'أصفر', domain: 'colors' },
  { word: 'schwarz', arabic: 'أسود', domain: 'colors' },

  // School (Schule)
  { word: 'der Bleistift', arabic: 'القلم الرصاص', domain: 'school' },
  { word: 'das Lineal', arabic: 'المسطرة', domain: 'school' },
  { word: 'das Heft', arabic: 'الكشكول', domain: 'school' },
  { word: 'die Schere', arabic: 'المقص', domain: 'school' },
  { word: 'die Tafel', arabic: 'السبورة', domain: 'school' },

  // Body (Körper)
  { word: 'der Kopf', arabic: 'الرأس', domain: 'body' },
  { word: 'die Hand', arabic: 'اليد', domain: 'body' },
  { word: 'das Auge', arabic: 'العين', domain: 'body' },
  { word: 'der Fuß', arabic: 'القدم', domain: 'body' },
  { word: 'die Nase', arabic: 'الأنف', domain: 'body' },

  // Clothes (Kleidung)
  { word: 'die Jacke', arabic: 'الجاكيت', domain: 'clothes' },
  { word: 'die Hose', arabic: 'البنطلون', domain: 'clothes' },
  { word: 'das Hemd', arabic: 'القميص', domain: 'clothes' },
  { word: 'der Schuh', arabic: 'الحذاء', domain: 'clothes' },

  // Transport (Verkehr)
  { word: 'das Auto', arabic: 'السيارة', domain: 'transport' },
  { word: 'der Zug', arabic: 'القطار', domain: 'transport' },
  { word: 'das Flugzeug', arabic: 'الطائرة', domain: 'transport' },
  { word: 'das Fahrrad', arabic: 'الدراجة', domain: 'transport' }
];

export const GERMAN_NUMBER_WORDS_SET = new Set<string>([
  'null', 'eins', 'ein', 'eine', 'zwei', 'zwo', 'drei', 'vier', 'fünf', 'sechs',
  'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn',
  'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig',
  'einundzwanzig', 'zweiundzwanzig', 'dreiundzwanzig', 'vierundzwanzig',
  'fünfundzwanzig', 'sechsundzwanzig', 'siebenundzwanzig', 'achtundzwanzig',
  'neunundzwanzig', 'dreißig', 'dreissig', 'vierzig', 'fünfzig', 'sechzig',
  'siebzig', 'achtzig', 'neunzig', 'hundert', 'einhundert', 'zweihundert',
  'dreihundert', 'vierhundert', 'fünfhundert', 'sechshundert', 'siebenhundert',
  'achthundert', 'neunhundert', 'tausend', 'eintausend', 'million', 'milliarde',
  'erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste', 'siebte', 'achte',
  'neunte', 'zehnte', 'plus', 'minus', 'mal', 'geteilt', 'gleich'
]);

export const GREETING_AND_POLITE_TERMS_LIST: string[] = [
  'hallo', 'guten morgen', 'guten tag', 'guten abend', 'gute nacht', 'tschüss',
  'auf wiedersehen', 'bis bald', 'bis später', 'bis morgen', 'servus', 'moin',
  'grüß dich', 'grüß gott', 'danke', 'danke schön', 'dankeschön', 'vielen dank',
  'herzlichen dank', 'bitte', 'bitte schön', 'bitte sehr', 'bitteschön',
  'entschuldigung', 'entschuldigen sie', 'es tut mir leid', 'tut mir leid',
  'kein problem', 'sehr gerne', 'gern geschehen', 'gerne', 'guten appetit',
  'gesundheit', 'herzlich willkommen', 'willkommen', 'schönen tag',
  'schönen tag noch', 'schönes wochenende', 'viel glück', 'viel erfolg',
  'alles gute', 'wie geht es dir', 'wie geht es ihnen', 'wie gehts',
  'mir geht es gut', 'danke gut', 'wie heißt du', 'ich heiße', 'freut mich'
];

export function isGermanNumberWord(raw: string): boolean {
  const clean = raw
    .toLowerCase()
    .replace(/^(der|die|das)\s+/i, '')
    .replace(/[^a-zäöüß0-9]/gi, '')
    .trim();
  if (!clean) return false;
  if (/^\d+$/.test(clean)) return true;
  if (GERMAN_NUMBER_WORDS_SET.has(clean)) return true;
  if (/(zwanzig|dreißig|dreissig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend|zehn)$/.test(clean)) {
    return true;
  }
  return false;
}

export function isGreetingOrPoliteTerm(raw: string): boolean {
  const clean = raw
    .toLowerCase()
    .replace(/[.?!,;:"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return false;
  return GREETING_AND_POLITE_TERMS_LIST.some(
    (term) => clean === term || clean.includes(term) || term.includes(clean)
  );
}
