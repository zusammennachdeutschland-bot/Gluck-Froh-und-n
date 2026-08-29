export type BuddyMood =
  | 'morning'
  | 'relaxed'
  | 'normal'
  | 'working'
  | 'busy'
  | 'chaos'
  | 'celebration'
  | 'finished'
  | 'sleeping';

export type BuddyBriefMode = 'morning' | 'day' | 'evening';

export type BuddyActivityType =
  | 'lesson_started'
  | 'lesson_completed'
  | 'attendance_recorded'
  | 'homework_added'
  | 'payment_received'
  | 'payment_added'
  | 'message_sent'
  | 'task_completed'
  | 'student_added'
  | 'notification_sent';

export type BuddySkinTone = 'fair' | 'tan' | 'warm' | 'bronze' | 'deep';
export type BuddyGender = 'male' | 'female' | 'neutral';
export type BuddyHairStyle = 'short' | 'fluffy' | 'curly' | 'long' | 'hijab' | 'bald';
export type BuddyHairColor = 'dark' | 'brown' | 'blonde' | 'auburn' | 'gray';
export type BuddyGlasses = 'round' | 'square' | 'none';
export type BuddyOutfitColor = 'blue' | 'emerald' | 'purple' | 'rose' | 'amber' | 'slate';

export interface BuddyCustomization {
  skinTone: BuddySkinTone;
  gender: BuddyGender;
  hairStyle: BuddyHairStyle;
  hairColor: BuddyHairColor;
  glasses: BuddyGlasses;
  outfitColor: BuddyOutfitColor;
}

export const DEFAULT_BUDDY_CUSTOMIZATION: BuddyCustomization = {
  skinTone: 'fair',
  gender: 'male',
  hairStyle: 'fluffy',
  hairColor: 'dark',
  glasses: 'round',
  outfitColor: 'blue'
};

export interface BuddyActivity {
  id: string;
  type: BuddyActivityType;
  timestamp: number;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface BuddyWorkloadResult {
  score: number; // 0-100
  mood: BuddyMood;
  briefMode: BuddyBriefMode;
  totalLessonsToday: number;
  completedLessonsToday: number;
  remainingLessonsToday: number;
  activeLesson: any | null;
  nextLesson: any | null;
  studentsTodayCount: number;
  absentStudentsCount: number;
  pendingHomeworkCount: number;
  overduePaymentsCount: number;
  expectedIncomeToday: number;
  completedIncomeToday: number;
  pendingTasksCount: number;
  urgentTasksCount: number;
  unreadNotificationsCount: number;
  todayStoryText: string;
  greetingText: string;
  statusHeadline: string;
}
