import { LernstudioSet, LernstudioItem, LernstudioDifficulty, LernstudioLevel } from '../../types/lernstudio';
import { BATCH_01_SETS } from './batch01_first_words_numbers';
import { BATCH_02_SETS } from './batch02_animals_nature';
import { BATCH_03_SETS } from './batch03_food_drinks';
import { BATCH_04_SETS } from './batch04_family_body_health';
import { BATCH_05_SETS } from './batch05_school_toys_hobbies';
import { BATCH_06_SETS } from './batch06_home_town_transport';
import { BATCH_07_SETS } from './batch07_professions_routine';
import { BATCH_08_SETS } from './batch08_actions_sports';
import { BATCH_09_SETS } from './batch09_adjectives_grammar_shopping';
import { BATCH_10_SETS } from './batch10_culture_tech_stories_expansion';

export interface RawCurriculumSet {
  id: string;
  title: string;
  titleTranslation?: string;
  gradeLevel?: string;
  category?: string;
  description?: string;
  emoji?: string;
  items: Array<{
    id: string;
    german: string;
    arabic: string;
    article?: 'der' | 'die' | 'das';
    plural?: string;
    emoji?: string;
    exampleSentenceGerman?: string;
    exampleSentenceArabic?: string;
  }>;
}

const RAW_ALL_SETS: RawCurriculumSet[] = [
  ...(BATCH_01_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_02_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_03_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_04_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_05_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_06_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_07_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_08_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_09_SETS as unknown as RawCurriculumSet[]),
  ...(BATCH_10_SETS as unknown as RawCurriculumSet[])
];

function mapGrade(rawGrade?: string): { grade: string; level: LernstudioLevel; difficulty: LernstudioDifficulty } {
  switch (rawGrade) {
    case 'preschool':
      return { grade: 'روضة أطفال (Preschool)', level: 'A1', difficulty: 'easy' };
    case 'grade1':
      return { grade: 'جريد 1 (Grade 1)', level: 'A1', difficulty: 'easy' };
    case 'grade2':
      return { grade: 'جريد 2 (Grade 2)', level: 'A1', difficulty: 'easy' };
    case 'grade3':
      return { grade: 'جريد 3 (Grade 3)', level: 'A2', difficulty: 'medium' };
    case 'grade4':
      return { grade: 'جريد 4 (Grade 4)', level: 'A2', difficulty: 'medium' };
    case 'grade5':
      return { grade: 'جريد 5 (Grade 5)', level: 'A2', difficulty: 'hard' };
    case 'grade6':
      return { grade: 'جريد 6 (Grade 6)', level: 'A2', difficulty: 'hard' };
    case 'beginner_a1':
      return { grade: 'مبتدئ A1 (Beginner)', level: 'A1', difficulty: 'easy' };
    case 'elementary_a2':
      return { grade: 'أساسي A2 (Elementary)', level: 'A2', difficulty: 'medium' };
    default:
      return { grade: 'جريد 1 (Grade 1)', level: 'A1', difficulty: 'easy' };
  }
}

function generateMissingLetterWord(word: string): string {
  if (!word || word.length < 3) return word;
  const parts = word.split(' ');
  const mainWord = parts[parts.length - 1]; // mask the noun/verb itself, not the article
  const vowelIndices: number[] = [];
  for (let i = 1; i < mainWord.length - 1; i++) {
    if (/[aeiouäöü]/i.test(mainWord[i])) {
      vowelIndices.push(i);
    }
  }
  const targetIdx = vowelIndices.length > 0 ? vowelIndices[0] : Math.floor(mainWord.length / 2);
  const maskedMain = mainWord.substring(0, targetIdx) + '_' + mainWord.substring(targetIdx + 1);
  if (parts.length > 1) {
    parts[parts.length - 1] = maskedMain;
    return parts.join(' ');
  }
  return maskedMain;
}

function generateSentence4Elements(sentence?: string, germanWord?: string): [string, string, string, string] | undefined {
  if (!sentence) return undefined;
  const tokens = sentence.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 4) {
    return [tokens[0], tokens[1], tokens[2], tokens[3]];
  }
  if (tokens.length > 4) {
    // Group into 4 chunks
    const chunk1 = tokens[0];
    const chunk2 = tokens.slice(1, Math.ceil(tokens.length / 2)).join(' ');
    const chunk3 = tokens.slice(Math.ceil(tokens.length / 2), tokens.length - 1).join(' ');
    const chunk4 = tokens[tokens.length - 1];
    return [chunk1, chunk2, chunk3, chunk4];
  }
  if (tokens.length === 3) {
    return [tokens[0], tokens[1], tokens[2], '✨'];
  }
  if (tokens.length === 2) {
    return ['Hier', tokens[0], tokens[1], '!'];
  }
  return undefined;
}

export const COMPLETE_CURRICULUM_SETS: LernstudioSet[] = RAW_ALL_SETS.map((raw: any, setIndex) => {
  const gradeMapping = mapGrade(raw.gradeLevel);
  const grade = raw.grade || gradeMapping.grade;
  const level: LernstudioLevel = raw.level || gradeMapping.level;
  const difficulty: LernstudioDifficulty = raw.difficulty || gradeMapping.difficulty;
  const topicName = raw.topic || raw.category || 'Wortschatz';
  const hasArticles = raw.hasArticles !== undefined ? raw.hasArticles : (raw.items || []).some((item: any) => !!item.article);

  const transformedItems: LernstudioItem[] = (raw.items || []).map((item: any, itemIdx: number) => {
    return {
      id: item.id || `curric_${setIndex + 1}_item_${itemIdx + 1}`,
      german: item.german,
      arabic: item.arabic,
      article: item.article,
      plural: item.plural,
      emoji: item.emoji || raw.emoji || '📖',
      exampleSentenceGerman: item.exampleSentenceGerman,
      exampleSentenceArabic: item.exampleSentenceArabic,
      missingLetterWord: item.missingLetterWord || generateMissingLetterWord(item.german),
      sentence4Elements: item.sentence4Elements || generateSentence4Elements(item.exampleSentenceGerman, item.german)
    };
  });

  return {
    id: raw.id,
    title: raw.title,
    titleTranslations: raw.titleTranslations || {
      de: raw.title,
      ar: raw.titleTranslation || raw.title,
      en: raw.title
    },
    topic: topicName,
    topicTranslations: raw.topicTranslations || {
      de: topicName,
      ar: topicName,
      en: topicName
    },
    grade,
    level,
    difficulty,
    hasArticles,
    sentenceBuilderSupported: true,
    description: raw.description || `مجموعة تدريبية تفاعلية للأطفال: ${raw.titleTranslation || raw.title}`,
    descriptionTranslations: raw.descriptionTranslations || {
      de: raw.description || raw.title,
      ar: raw.description || raw.titleTranslation || raw.title,
      en: raw.description || raw.title
    },
    items: transformedItems,
    createdAt: raw.createdAt || '2026-01-01T00:00:00.000Z',
    updatedAt: raw.updatedAt || 1767225600000
  };
});

// Category and Grade metadata for rich filtering & curriculum navigation
export const CURRICULUM_GRADES = [
  'روضة أطفال (Preschool)',
  'جريد 1 (Grade 1)',
  'جريد 2 (Grade 2)',
  'جريد 3 (Grade 3)',
  'جريد 4 (Grade 4)',
  'جريد 5 (Grade 5)',
  'جريد 6 (Grade 6)',
  'مبتدئ A1 (Beginner)',
  'أساسي A2 (Elementary)'
];

export const CURRICULUM_DOMAINS = [
  'Erste Wörter & Grundlagen',
  'Zahlen & Mathematik',
  'Farben & Formen',
  'Tiere & Natur',
  'Essen & Trinken',
  'Familie & Menschen',
  'Körper & Gesundheit',
  'Kleidung & Mode',
  'Schule & Lernen',
  'Spielzeug & Hobbys',
  'Zuhause & Möbel',
  'Natur & Umwelt',
  'Wetter & Jahreszeiten',
  'Fahrzeuge & Verkehr',
  'Stadt & Gebäude',
  'Berufe & Arbeit',
  'Zeit & Tagesablauf',
  'Verben & Bewegung',
  'Sport & Fitness',
  'Adjektive & Beschreibungen',
  'Grammatik & Satzbausteine',
  'Präpositionen & Positionen',
  'Einkaufen & Geld',
  'Länder & Kulturen',
  'Musik & Kunst',
  'Digitale Welt & Technik',
  'Gefühle & Sozialkompetenz',
  'Sicherheit & Regeln',
  'Geschichten & Fantasiewelten',
  'Wortschatz-Erweiterung'
];
