export type LernstudioLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type LernstudioDifficulty = 'easy' | 'medium' | 'hard';

export type LernstudioThemeId = 'pastel' | 'space' | 'dino' | 'neutral';

export interface LernstudioItem {
  id: string;
  german: string;               // German word or term e.g. "die Katze"
  arabic: string;               // Arabic translation e.g. "القطة"
  english?: string;              // English translation (optional)
  plural?: string;               // Plural form e.g. "die Katzen"
  exampleSentenceGerman?: string;// Example sentence in German
  exampleSentenceArabic?: string;// Example sentence translation
  imageUrl?: string;             // Optional image URL or Base64
  emoji?: string;                // Emoji e.g. "🐱"
  missingLetterWord?: string;    // Word with missing letter e.g. "K_tze"
  sentence4Elements?: [string, string, string, string]; // Exactly 4 elements for Sentence Builder game
}

export type LernstudioExerciseType = 
  | 'multiple_choice' 
  | 'missing_letter' 
  | 'sentence_builder' 
  | 'emoji_vocab' 
  | 'scrambled_letters';

export interface LernstudioExercise {
  id: string;
  type: LernstudioExerciseType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  itemRefId?: string; // Reference to associated vocabulary item if derived
}

export interface LernstudioSet {
  id: string;
  title: string;
  description?: string;
  grade?: string;                // e.g. "الصف الأول", "Grade 1", etc.
  level: LernstudioLevel;
  topic: string;
  difficulty: LernstudioDifficulty;
  items: LernstudioItem[];
  customExercises?: LernstudioExercise[];
  assignedGroupId?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: number;
}

export interface TeamScore {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface ClassroomGameTile {
  id: number;
  points: number;
  exercise: LernstudioExercise;
  item?: LernstudioItem;
  isAnswered: boolean;
  answeredByTeamId?: string;
}

export interface LernstudioLibraryArticle {
  id: string;
  title: string;
  titleArabic: string;
  category: 'alphabet' | 'vocabulary' | 'grammar' | 'conversations' | 'reading_writing';
  level: LernstudioLevel;
  summary: string;
  summaryArabic: string;
  contentHtml: string;
  examples?: { german: string; arabic: string; audioHelp?: string }[];
}

export interface LernstudioTheme {
  id: LernstudioThemeId;
  name: string;
  nameArabic: string;
  emoji: string;
  bgGradient: string;
  cardBg: string;
  borderColor: string;
  primaryBg: string;
  primaryText: string;
  accentBadge: string;
  fontFamilyClass?: string;
  decorationIcons: string[];
}
