import type {
  LernstudioExercise,
  LernstudioItem,
  LernstudioLevel,
  LernstudioThemeId
} from '../types/lernstudio';
export * from '../types/lernstudio';

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

export interface GroupScheduleSlot {
  day: string;
  time: string;
}

export interface Group {
  id: string;
  name: string;
  schoolName?: string;
  teacherName?: string;
  grade?: string;
  studentIds?: string[];
  scheduleDays?: string[];
  scheduleTime?: string;
  scheduleDayTimes?: Record<string, string>;
  schedules?: GroupScheduleSlot[];
  lessonDurationMinutes?: number;
  status?: 'active' | 'archived';
}

export interface Student {
  id: string;
  name: string;
  avatar?: string;
  avatarUrl?: string;
  groupId?: string;
  status?: 'active' | 'archived';
}


