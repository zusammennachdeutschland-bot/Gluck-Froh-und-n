import fs from 'fs';
const content = fs.readFileSync('src/types/index.ts', 'utf8');

const newTypes = `
export type PerformanceLevel = 'needs_support' | 'developing' | 'good' | 'very_good' | 'excellent';
export type ParticipationLevel = 'active' | 'good' | 'quiet' | 'needs_encouragement';
export type UnderstandingLevel = 'excellent' | 'good' | 'developing' | 'needs_review';
export type SpeakingLevel = 'confident' | 'good' | 'improving' | 'needs_practice';
export type FocusLevel = 'excellent' | 'good' | 'sometimes_distracted' | 'needs_more_focus';
export type ProgressLevel = 'improved' | 'stable' | 'needs_attention';

export interface GeneratedFeedback {
  short: string;
  parent: string;
  detailed: string;
}

export interface StudentSessionPerformance {
  level?: PerformanceLevel;
  participation?: ParticipationLevel;
  understanding?: UnderstandingLevel;
  speaking?: SpeakingLevel;
  focus?: FocusLevel;
  progress?: ProgressLevel;
  generatedFeedback?: GeneratedFeedback;
  feedbackLanguage?: 'ar' | 'en' | 'de';
  generatedAt?: string;
  feedbackVariantId?: string;
}

`;

const insertIndex = content.indexOf('export interface LessonReport {');
const updatedContent1 = content.slice(0, insertIndex) + newTypes + content.slice(insertIndex);

const updatedContent2 = updatedContent1.replace(
  '  studentNotes?: Record<string, string>;',
  '  studentNotes?: Record<string, string>;\n  studentPerformance?: Record<string, StudentSessionPerformance>;'
);

fs.writeFileSync('src/types/index.ts', updatedContent2);
