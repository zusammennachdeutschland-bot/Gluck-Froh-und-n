export interface StudentPortalData {
  id: string;
  studentCode: string; // e.g. STU-1029 or phone
  name: string;
  avatarUrl?: string;
  gender?: 'male' | 'female';
  gradeLevel?: string; // e.g. A1.1, الصف الثالث الثانوي, A2
  groupName?: string;
  teacherName?: string;
  teacherPhone?: string;
  teacherTitle?: string;
  parentPhone?: string;
  studentPhone?: string;
  
  // High-Level Analytics
  stats: {
    totalSessions: number;
    attendedSessions: number;
    attendanceRate: number; // e.g. 95%
    homeworkRate: number; // e.g. 100%
    averageQuizGrade: number; // e.g. 9.8 / 10
    averageDictationGrade: number; // e.g. 9.5 / 10
    totalCertificates: number;
  };

  // Next Upcoming Lesson
  nextLesson?: {
    id: string;
    title: string;
    date: string;
    dayOfWeek: string;
    time: string; // e.g. "6:00 م"
    isOnline: boolean;
    zoomLink?: string;
    location?: string;
    topic?: string;
  };

  // Lessons History & Reports
  lessons: PortalLessonItem[];

  // Quizzes and Dictations
  quizzes: PortalGradeItem[];

  // Certificates & Honors
  certificates: PortalCertificateItem[];

  // Package & Financial Tracker
  packageInfo?: {
    packageName: string; // e.g. "باقة 8 حصص مكثفة"
    currentSessionInCycle: number; // e.g. 5
    totalCycleSessions: number; // e.g. 8
    isPaid: boolean;
    amount?: number;
    currency?: string;
    renewalDate?: string;
    notes?: string;
  };

  lastUpdated: string;
}

export interface PortalLessonItem {
  id: string;
  date: string;
  dayOfWeek: string;
  time: string;
  sessionNumber?: number;
  totalCycleSessions?: number;
  topic: string;
  attendanceStatus: 'present' | 'late' | 'absent';
  homeworkDone?: 'yes' | 'no' | 'pending';
  dictationGrade?: number;
  examGrade?: number;
  
  // Egyptian feedback from teacher
  teacherFeedback?: string;
  homeworkRequired?: string;
  
  // Recordings
  recordingLink?: string;
  recordingLink2?: string;
}

export interface PortalGradeItem {
  id: string;
  date: string;
  title: string; // e.g. "كويز تصريف الأفعال الشاذة" or "إملاء الكلمات الجديدة"
  type: 'quiz' | 'dictation' | 'monthly_exam';
  score: number;
  maxScore: number;
  percentage: number;
  feedback?: string;
}

export interface PortalCertificateItem {
  id: string;
  title: string; // e.g. "شهادة إتمام المستوى الأول A1.1"
  issueDate: string;
  badge: string; // e.g. "امتياز مع مرتبة الشرف"
  description?: string;
  templateType?: string;
  imageUrl?: string;
  qrCodeData?: string;
}
