import type { VerbClassification, VerbEntry } from '../shared/verbLibrary/verbTypes.js';

export type LernstudioLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type LernstudioDifficulty = 'easy' | 'medium' | 'hard';

export type LernstudioThemeId = 'pastel' | 'space' | 'dino' | 'neutral';

export type LernstudioWordType = 'noun' | 'verb' | 'adjective' | 'phrase' | 'other';

export interface VerbConjugationForms {
  ich: string;
  du: string;
  er_sie_es: string;
  wir: string;
  ihr: string;
  sie_Sie: string;
}

export interface LernstudioItem {
  id: string;
  german: string;               // German word or term e.g. "die Katze"
  arabic: string;               // Arabic translation e.g. "القطة"
  article?: 'der' | 'die' | 'das'; // Definite article for German nouns
  english?: string;              // English translation (optional)
  plural?: string;               // Plural form e.g. "die Katzen"
  exampleSentenceGerman?: string;// Example sentence in German
  exampleSentenceArabic?: string;// Example sentence translation
  example?: string;
  imageUrl?: string;             // Optional image URL or Base64
  emoji?: string;                // Emoji e.g. "🐱"
  missingLetterWord?: string;    // Word with missing letter e.g. "K_tze"
  sentence4Elements?: [string, string, string, string]; // Exactly 4 elements for Sentence Builder game
  wordType?: LernstudioWordType;
  conjugation?: VerbConjugationForms;
  category?: string;
  syllables?: string[];           // Syllables / word parts e.g. ["Flei", "sch"] or ["Schu", "le"]
  verbId?: string;
  verbEntry?: VerbEntry;
  classifications?: VerbClassification[];
  separablePrefix?: string;
  preposition?: string;
  prepositionCase?: string;
}

export type LernstudioSetKind = 'vocab' | 'verb_group' | 'grammar' | 'mixed';

export type LernstudioContentOrigin = 'builtin' | 'teacher_created';

export type ExerciseSourceOrigin = 'original' | 'generated';

export type GrammarExerciseType =
  | 'multiple_choice'
  | 'fill_blank'
  | 'correct_mistake'
  | 'choose_correct_sentence'
  | 'sentence_ordering'
  | 'short_answer';

export type LernstudioExerciseType =
  | 'multiple_choice'
  | 'missing_letter'
  | 'sentence_builder'
  | 'emoji_vocab'
  | 'scrambled_letters'
  | 'der_die_das'
  | 'plural_match'
  | 'fill_blank'
  | 'correct_mistake'
  | 'choose_correct_sentence'
  | 'sentence_ordering'
  | 'short_answer';

export type LernstudioGameMode =
  | 'hub'
  | 'games_portal'
  | 'game'
  | 'classroom'
  | 'wheel'
  | 'race'
  | 'memory'
  | 'sorting'
  | 'sentence_builder'
  | 'balloon_pop'
  | 'tictactoe'
  | 'ultimate_tictactoe'
  | 'basket_catch'
  | 'space_defense'
  | 'word_detective'
  | 'whack_a_mole'
  | 'tug_of_war'
  | 'word_ninja'
  | 'bridge_builder'
  | 'color_master'
  | 'factory_machine'
  | 'follow_clues'
  | 'island_crossing'
  | 'pit_stop'
  | 'puzzle_masters'
  | 'robot_repair'
  | 'rocket_countdown'
  | 'space_fleet'
  | 'submarine_explore'
  | 'target_attack'
  | 'team_auction'
  | 'tower_architects'
  | 'vending_machine'
  | 'whats_in_box'
  | 'word_rhythm'
  | 'word_wash'
  | 'solo_sentence';

export interface LernstudioExercise {
  id: string;
  type: LernstudioExerciseType;
  prompt?: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanation?: string;
  explanationAr?: string;
  explanationDe?: string;
  explanationEn?: string;
  sentenceWithBlank?: string;
  faultySentence?: string;
  tokens?: string[];
  ruleRef?: string;
  itemRefId?: string; // Reference to associated vocabulary item if derived
  source?: ExerciseSourceOrigin;
  isUncertain?: boolean;
  uncertaintyReason?: string;
}

export interface GrammarRule {
  id: string;
  title: string;
  titleAr?: string;
  titleDe?: string;
  titleEn?: string;
  summaryAr: string;
  summaryDe?: string;
  summaryEn?: string;
  pattern?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
  tipAr?: string;
  tipDe?: string;
  tipEn?: string;
}

export interface GrammarExample {
  id: string;
  german: string;
  arabic: string;
  english?: string;
  highlight?: string;
  noteAr?: string;
  noteDe?: string;
  noteEn?: string;
}

export interface GrammarExercise {
  id: string;
  type: GrammarExerciseType;
  prompt?: string;
  question: string;
  sentenceWithBlank?: string;
  faultySentence?: string;
  tokens?: string[];
  options?: string[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanation?: string;
  explanationAr?: string;
  explanationDe?: string;
  explanationEn?: string;
  ruleRef?: string;
  source: ExerciseSourceOrigin;
  isUncertain?: boolean;
  uncertaintyReason?: string;
}

export interface GrammarPageImageRef {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  pageOrder: number;
  localStorageKey?: string;
  checksum?: string;
}

export interface GrammarContent {
  lessonTitle: string;
  lessonTitleAr?: string;
  lessonTitleDe?: string;
  lessonTitleEn?: string;
  grammarTopic: string;
  grammarTopicAr?: string;
  grammarTopicDe?: string;
  grammarTopicEn?: string;
  explanationAr: string;
  explanationDe?: string;
  explanationEn?: string;
  rules: GrammarRule[];
  examples: GrammarExample[];
  exercises: GrammarExercise[];
  origin: LernstudioContentOrigin;
  pageImageRefs?: GrammarPageImageRef[];
  sourceBookInfo?: string;
  extractionConfidenceNote?: string;
}

export interface LernstudioSet {
  id: string;
  title: string;
  titleTranslations?: { ar?: string; de?: string; en?: string };
  description?: string;
  descriptionTranslations?: { ar?: string; de?: string; en?: string };
  grade?: string;                // e.g. "الصف الأول", "Grade 1", etc.
  level: LernstudioLevel;
  topic: string;
  category?: string;
  topicTranslations?: { ar?: string; de?: string; en?: string };
  difficulty: LernstudioDifficulty;
  hasArticles?: boolean;         // Whether this set contains German nouns with der/die/das articles
  sentenceBuilderSupported?: boolean; // Whether set has sentence builder content
  items: LernstudioItem[];
  customExercises?: LernstudioExercise[];
  grammarContent?: GrammarContent;
  contentOrigin?: LernstudioContentOrigin;
  assignedGroupId?: string;
  createdByTeacherName?: string;
  createdByUid?: string;
  setKind?: LernstudioSetKind;
  verbIds?: string[];
  verbEntriesSnapshot?: VerbEntry[];
  basedOnBuiltinGroupId?: string;
  isArchived?: boolean;
  published?: boolean;
  publishedAt?: string;
  deleted?: boolean;
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
