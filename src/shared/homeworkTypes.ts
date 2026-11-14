import type { VerbEntry } from './verbLibrary/verbTypes';

export type HomeworkContentSource = 'vocab' | 'verb' | 'mixed';

export type HomeworkQuestionType =
  | 'true_false'          // صح أم خطأ (Richtig / Falsch)
  | 'choice_2'            // الاختيار من 2 (Zwei Optionen)
  | 'choice_all'          // الاختيار من الكل (Alle Wörter)
  | 'syllables'           // النصين / تركيب المقاطع (Silben zusammensetzen)
  | 'missing_letter'      // الحرف الناقص (Fehlender Buchstabe)
  | 'missing_two_letters' // الحرفين المتتاليين (Buchstabenfolge)
  | 'full_word'           // الكلمة كلها (Wort vervollständigen)
  | 'verb_conjugation'    // تصريف الأفعال في المضارع (Verb Konjugieren)
  | 'verb_sentence'       // إكمال الجملة بالفعل المناسب (Verb im Satz)
  // Legacy question types kept for backward compatibility with older assignments
  | 'mc_de_ar'            // اختيار من متعدد (ألماني ← عربي)
  | 'listen_choose'       // استمع للنطق واختر الكلمة (صوتي)
  | 'mc_ar_de'            // اختيار من متعدد (عربي ← ألماني)
  | 'article_quiz';       // اختيار الأداة (der / die / das)

export const DEFAULT_HOMEWORK_QUESTION_TYPES: HomeworkQuestionType[] = [
  'true_false',
  'choice_2',
  'choice_all',
  'syllables',
  'missing_letter',
  'missing_two_letters',
  'full_word'
];

export const VERB_HOMEWORK_QUESTION_TYPES: HomeworkQuestionType[] = [
  ...DEFAULT_HOMEWORK_QUESTION_TYPES,
  'verb_conjugation',
  'verb_sentence'
];

export type HomeworkFlowMode =
  | 'teacher_then_quiz' // يبدأ بالمعلّم (نطق الكلمات والشرح) ثم الأسئلة المتدرجة ثم التقييم
  | 'quiz_only';        // يبدأ بالأسئلة مباشرة ثم التقييم

export type HomeworkBlooketMode =
  | 'gold_quest'    // (Legacy) صناديق الذهب
  | 'tower_energy'  // طاقة الأبطال (Tower Defense / Energy)
  | 'classic_quiz'; // اختبار مباشر كلاسيكي

export type HomeworkAudienceMode =
  | 'open'  // مفتوح لأي اسم
  | 'group'; // جروب معين

export interface AssignedStudentSnapshot {
  id: string;
  name: string;
  code?: string;
  groupId?: string;
}

export interface HomeworkQuestionResponse {
  questionId: string;
  questionType?: HomeworkQuestionType;
  germanWord: string;
  promptText?: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
  verbId?: string;
  infinitive?: string;
  subject?: string;
  sentence?: string;
  isVerbQuestion?: boolean;
}

export type HomeworkBonusCardType =
  | 'gold_bonus'
  | 'lucky_card'
  | 'double_points'
  | 'time_bonus'
  | 'time_freeze'
  | 'slow_motion'
  | 'oops'
  | 'bad_luck';

export interface HomeworkAppliedBonusCard {
  roundId: string;
  cardType: HomeworkBonusCardType;
  titleEn: string;
  titleAr: string;
  effectSummaryAr: string;
  pointsDelta: number;
  timeDeltaSeconds: number;
  appliedAt: string;
  triggerQuestionId: string;
}

export interface HomeworkGamificationSnapshot {
  points: number;
  streak: number;
  maxStreak: number;
  doublePointsActive: boolean;
  timeRemainingSeconds: number;
  initialTimerSeconds: number;
  freezeRemainingSeconds: number;
  slowMotionRemainingSeconds: number;
  slowMotionTickParity?: number;
  processedQuestionIds: string[];
  appliedBonusRoundIds: string[];
  bonusHistory: HomeworkAppliedBonusCard[];
}

export interface HomeworkSubmission {
  id: string; // e.g. "sub_abc123"
  assignmentId: string;
  ownerUid?: string; // Teacher Firebase Auth UID who owns the parent assignment
  ownerEmail?: string; // Optional audit/display email (never used as security authority)
  audienceMode?: HomeworkAudienceMode; // 'open' | 'group'
  studentId?: string; // Real student ID from Glück roster (required in 'group' mode)
  participantId?: string; // Stable per-device participant ID for 'open' mode
  groupId?: string; // Group ID when submitted under 'group' mode
  studentName: string;
  attemptNumber: number;
  attemptSecret?: string; // Per-attempt unguessable token preventing cross-student overwrite
  status?: 'in_progress' | 'completed' | string;
  startedAt: string;
  completedAt: string;
  updatedAt?: string | number;
  timeSpentSeconds: number;
  totalQuestions: number;
  correctAnswersCount: number;
  scorePercentage: number;
  score?: number;
  accuracy?: number;
  accuracyPercent?: number;
  goldEarned?: number;
  maxStreak?: number;
  completedStudyPhase?: boolean;
  cloudSynced?: boolean;
  gamification?: HomeworkGamificationSnapshot;
  responses: HomeworkQuestionResponse[];
}

export interface HomeworkAssignment {
  id: string; // e.g. "hw_abc123"
  shortId?: string; // 7-char URL-safe short code for /Herr-Abdul-rahman/{shortId}
  ownerUid?: string; // Teacher Firebase Auth UID (mandatory security authority for cloud sync)
  ownerEmail?: string; // Optional teacher email (display/audit only)
  shareToken?: string; // Public student share token
  title: string;
  setSnapshot: any; // LernstudioSet snapshot
  selectedItemIds?: string[]; // Specific word IDs selected by teacher
  contentSource?: HomeworkContentSource; // 'vocab' | 'verb' | 'mixed'
  selectedVerbGroupIds?: string[]; // Ready-made or custom verb group IDs selected
  selectedVerbIds?: string[]; // Specific verb IDs selected by teacher
  verbSnapshot?: VerbEntry[]; // Immutable verb library records captured when assignment was created
  verbSubjectPoolMode?: 'pronouns_and_names' | 'pronouns_only';
  flowMode?: HomeworkFlowMode; // 'teacher_then_quiz' | 'quiz_only'
  questionTypes?: HomeworkQuestionType[]; // Ordered question types selected by teacher
  questionTypeCounts?: Partial<Record<HomeworkQuestionType, number>>; // Custom question count per selected question type/stage
  blooketMode?: HomeworkBlooketMode; // 'gold_quest' | 'tower_energy' | 'classic_quiz'
  allowedGameModes: string[];
  questionCount: number;
  targetQuestionCount?: number;
  timeLimitMinutes?: number;
  maxAttempts: number;
  allowReplay: boolean;
  deadline?: string;
  isActive: boolean;
  status?: 'active' | 'closed' | 'deleted';
  deleted?: boolean; // Server-authoritative deletion tombstone; never restore a deleted assignment.
  deletedAt?: string;
  audienceMode?: HomeworkAudienceMode; // 'open' | 'group'
  groupId?: string;
  groupName?: string;
  assignedStudents?: AssignedStudentSnapshot[]; // Selected group students snapshot (only in 'group' mode)
  createdAt: string;
  updatedAt?: string | number;
  createdBy: string;
  cloudSynced?: boolean;
  cloudCreatePending?: boolean; // Only true for a new assignment created offline and safe to retry under its owner account.
  hideTeacherBranding?: boolean; // Per-homework option to hide teacher logo, name, and signatures across student screens.
}

export interface HomeworkShortLinkRecord {
  shortId: string;
  assignmentId: string;
  ownerUid: string;
  shareToken?: string;
  isActive: boolean;
  deleted?: boolean;
  createdAt: string;
  updatedAt?: string;
  assignmentSnapshot?: HomeworkAssignment;
}

export type HomeworkShortLinkResolutionStatus =
  | 'resolved'
  | 'revoked'
  | 'not_found'
  | 'invalid_id'
  | 'network_error'
  | 'quota_exceeded';

export interface HomeworkShortLinkResolutionResult {
  status: HomeworkShortLinkResolutionStatus;
  shortId: string;
  assignmentId?: string;
  assignment?: HomeworkAssignment;
  error?: string;
  errorMessageAr?: string;
}

export interface HomeworkSummaryStats {
  assignmentId: string;
  totalSubmissions: number;
  uniqueStudentsCount: number;
  averageScorePercentage: number;
  completedCount: number;
  hardestQuestions: {
    germanWord: string;
    totalAttempts: number;
    incorrectCount: number;
    accuracyPercentage: number;
  }[];
}

