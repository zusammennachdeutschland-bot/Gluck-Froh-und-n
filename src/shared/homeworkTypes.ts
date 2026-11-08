export type HomeworkQuestionType =
  | 'true_false'          // صح أم خطأ (Richtig / Falsch)
  | 'choice_2'            // الاختيار من 2 (Zwei Optionen)
  | 'choice_all'          // الاختيار من الكل (Alle Wörter)
  | 'syllables'           // النصين / تركيب المقاطع (Silben zusammensetzen)
  | 'missing_letter'      // الحرف الناقص (Fehlender Buchstabe)
  | 'missing_two_letters' // الحرفين المتتاليين (Buchstabenfolge)
  | 'full_word'           // الكلمة كلها (Wort vervollständigen)
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
}

export interface HomeworkSubmission {
  id: string; // e.g. "sub_abc123"
  assignmentId: string;
  audienceMode?: HomeworkAudienceMode; // 'open' | 'group'
  studentId?: string; // Real student ID from Glück roster (required in 'group' mode)
  participantId?: string; // Stable per-device participant ID for 'open' mode
  groupId?: string; // Group ID when submitted under 'group' mode
  studentName: string;
  attemptNumber: number;
  status?: 'in_progress' | 'completed' | string;
  startedAt: string;
  completedAt: string;
  updatedAt?: string;
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
  responses: HomeworkQuestionResponse[];
}

export interface HomeworkAssignment {
  id: string; // e.g. "hw_abc123"
  title: string;
  setSnapshot: any; // LernstudioSet snapshot
  selectedItemIds?: string[]; // Specific word IDs selected by teacher
  flowMode?: HomeworkFlowMode; // 'teacher_then_quiz' | 'quiz_only'
  questionTypes?: HomeworkQuestionType[]; // Ordered question types selected by teacher
  blooketMode?: HomeworkBlooketMode; // 'gold_quest' | 'tower_energy' | 'classic_quiz'
  allowedGameModes: string[];
  questionCount: number;
  targetQuestionCount?: number;
  timeLimitMinutes?: number;
  maxAttempts: number;
  allowReplay: boolean;
  deadline?: string;
  isActive: boolean;
  status?: 'active' | 'closed';
  audienceMode?: HomeworkAudienceMode; // 'open' | 'group'
  groupId?: string;
  groupName?: string;
  assignedStudents?: AssignedStudentSnapshot[]; // Selected group students snapshot (only in 'group' mode)
  createdAt: string;
  createdBy: string;
  cloudSynced?: boolean;
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
