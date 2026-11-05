export interface HomeworkQuestionResponse {
  questionId: string;
  germanWord: string;
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
  responses: HomeworkQuestionResponse[];
}

export interface HomeworkAssignment {
  id: string; // e.g. "hw_abc123"
  title: string;
  setSnapshot: any; // LernstudioSet snapshot
  allowedGameModes: string[];
  questionCount: number;
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
