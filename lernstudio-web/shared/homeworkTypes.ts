export type HomeworkQuestionType =
  | 'mc_de_ar'       // اختيار من متعدد (ألماني ← عربي)
  | 'true_false'     // صح أم خطأ (Richtig / Falsch)
  | 'listen_choose'  // استمع للنطق واختر الكلمة (صوتي)
  | 'mc_ar_de'       // اختيار من متعدد (عربي ← ألماني)
  | 'article_quiz'   // اختيار الأداة (der / die / das)
  | 'missing_letter';// تكملة الحرف الناقص (إملاء)

export type HomeworkFlowMode =
  | 'teacher_then_quiz' // يبدأ بالمعلّم (نطق الكلمات والشرح) ثم الأسئلة المتدرجة ثم التقييم
  | 'quiz_only';        // يبدأ بالأسئلة مباشرة ثم التقييم

export type HomeworkBlooketMode =
  | 'gold_quest'    // صناديق الذهب (Blooket Gold Quest)
  | 'tower_energy'  // طاقة الأبطال (Tower Defense / Energy)
  | 'classic_quiz'; // اختبار مباشر كلاسيكي

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
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  timeSpentSeconds: number;
  totalQuestions: number;
  correctAnswersCount: number;
  scorePercentage: number;
  score?: number;
  accuracy?: number;
  goldEarned?: number;
  maxStreak?: number;
  completedStudyPhase?: boolean;
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
  createdAt: string;
  createdBy: string;
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
