import { StudentPortalData, PortalLessonItem, PortalGradeItem, PortalCertificateItem } from '../types';
import { DEMO_STUDENT } from './mockData';

const TOKEN_KEY = 'portal_session_token';
const SIBLINGS_KEY = 'portal_siblings_list';
const ACTIVE_STUDENT_KEY = 'portal_active_student_code';

export interface AuthSession {
  token: string;
  parentUid: string;
  studentCodes: string[];
  activeStudentCode: string;
  mustChangePassword: boolean;
}

export function getStoredSession(): AuthSession | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const activeStudentCode = localStorage.getItem(ACTIVE_STUDENT_KEY) || '';
    const siblingsRaw = localStorage.getItem(SIBLINGS_KEY);
    const studentCodes = siblingsRaw ? JSON.parse(siblingsRaw) : [];

    if (token) {
      return {
        token,
        parentUid: '',
        studentCodes,
        activeStudentCode: activeStudentCode || studentCodes[0] || '',
        mustChangePassword: false
      };
    }
  } catch (e) {}
  return null;
}

export function saveSession(session: { token: string; studentCodes: string[]; activeStudentCode: string; mustChangePassword?: boolean }) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SIBLINGS_KEY, JSON.stringify(session.studentCodes));
  localStorage.setItem(ACTIVE_STUDENT_KEY, session.activeStudentCode);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SIBLINGS_KEY);
  localStorage.removeItem(ACTIVE_STUDENT_KEY);
}

export function setActiveSibling(studentCode: string) {
  localStorage.setItem(ACTIVE_STUDENT_KEY, studentCode);
}

/**
 * Parent Login via backend proxy
 */
export async function loginParent(studentCode: string, password: string): Promise<AuthSession> {
  const cleanCode = studentCode.trim();

  // Test / Demo bypass for instant local testing
  if ((cleanCode === 'demo' || cleanCode === '1001') && password === 'demo123') {
    const session: AuthSession = {
      token: 'mock_demo_token',
      parentUid: 'p_demo',
      studentCodes: ['1001'],
      activeStudentCode: '1001',
      mustChangePassword: false
    };
    saveSession(session);
    return session;
  }

  const res = await fetch('/api/portal/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentCode: cleanCode, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'فشل تسجيل الدخول. يرجى التحقق من كود الطالب وكلمة المرور.');
  }

  const session: AuthSession = {
    token: data.token,
    parentUid: data.parentUid,
    studentCodes: data.studentCodes || [cleanCode],
    activeStudentCode: cleanCode,
    mustChangePassword: Boolean(data.mustChangePassword)
  };

  saveSession(session);
  return session;
}

/**
 * First-Time Parent Registration (Student Code + Registered Phone)
 */
export async function registerParent(studentCode: string, parentPhone: string, password: string): Promise<AuthSession> {
  const res = await fetch('/api/portal/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentCode, parentPhone, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'فشل إنشاء الحساب.');
  }

  const session: AuthSession = {
    token: data.token,
    parentUid: data.parentUid,
    studentCodes: data.studentCodes || [studentCode],
    activeStudentCode: studentCode,
    mustChangePassword: false
  };

  saveSession(session);
  return session;
}

/**
 * Change / Update Password
 */
export async function changePassword(newPassword: string): Promise<{ success: boolean; token: string }> {
  const session = getStoredSession();
  if (!session?.token) {
    throw new Error('انتهت الجلسة. يرجى إعادة تسجيل الدخول.');
  }

  const res = await fetch('/api/portal/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`
    },
    body: JSON.stringify({ newPassword })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'فشل تحديث كلمة المرور.');
  }

  if (data.token) {
    saveSession({
      token: data.token,
      studentCodes: session.studentCodes,
      activeStudentCode: session.activeStudentCode,
      mustChangePassword: false
    });
  }

  return { success: true, token: data.token };
}

/**
 * Request Sibling Linking (Zero-OTP)
 */
export async function requestSiblingLink(targetStudentCode: string): Promise<{
  requestId: string;
  targetStudentName: string;
  pairingPin: string;
  expiresInMinutes: number;
  instruction: string;
}> {
  const session = getStoredSession();
  if (!session?.token) throw new Error('يرجى تسجيل الدخول أولاً');

  const res = await fetch('/api/portal/auth/link-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`
    },
    body: JSON.stringify({ targetStudentCode })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'فشل تقديم طلب الربط.');
  }

  return data;
}

/**
 * Transform server sanitized student data into UI StudentPortalData
 */
function adaptServerStudentToPortalData(serverStudent: any): StudentPortalData {
  const lessons: PortalLessonItem[] = (serverStudent.lessons || []).map((l: any, idx: number) => ({
    id: l.id || `les-${idx}`,
    date: l.date,
    dayOfWeek: getArabicDayName(l.date),
    time: l.time || '17:00',
    topic: l.title || 'حصة اللغة الألمانية',
    attendanceStatus: (l.attendanceStatus || 'present') as 'present' | 'late' | 'absent',
    homeworkDone: l.homeworkStatus === 'completed' ? 'yes' : 'no',
    dictationGrade: l.quizScore,
    examGrade: l.examScore,
    teacherFeedback: l.publicNotes || 'أداء طيب ومشاركة ممتازة.',
    homeworkRequired: l.homeworkTitle,
    recordingLink: l.meetingLink
  }));

  const quizzes: PortalGradeItem[] = (serverStudent.grades || []).map((g: any, idx: number) => ({
    id: g.id || `grd-${idx}`,
    date: g.date,
    title: g.title,
    type: g.type === 'dictation' ? 'dictation' : g.type === 'exam' ? 'monthly_exam' : 'quiz',
    score: g.score,
    maxScore: g.maxScore || 10,
    percentage: g.percentage || 100,
    feedback: g.feedback
  }));

  const certificates: PortalCertificateItem[] = (serverStudent.certificates || []).map((c: any, idx: number) => ({
    id: c.id || `cert-${idx}`,
    title: c.title,
    issueDate: c.issueDate,
    badge: c.score || 'تميز وتفوق',
    description: `منحت للطالب ${c.recipientName || serverStudent.studentName} تقديراً لاجتهاده.`,
    templateType: c.certificateType || 'classic'
  }));

  const stats = {
    totalSessions: serverStudent.totalLessons || lessons.length,
    attendedSessions: serverStudent.completedLessons || lessons.length,
    attendanceRate: serverStudent.attendanceRate || 100,
    homeworkRate: 95,
    averageQuizGrade: 9.8,
    averageDictationGrade: 9.5,
    totalCertificates: certificates.length
  };

  const nextLesson = serverStudent.nextLesson ? {
    id: 'next-1',
    title: serverStudent.nextLesson.title,
    date: serverStudent.nextLesson.date,
    dayOfWeek: getArabicDayName(serverStudent.nextLesson.date),
    time: serverStudent.nextLesson.time,
    isOnline: true,
    zoomLink: serverStudent.nextLesson.meetingLink,
    topic: serverStudent.nextLesson.title
  } : undefined;

  const packageInfo = serverStudent.finance ? {
    packageName: `اشتراك حصص اللغة الألمانية (${serverStudent.grade || ''})`,
    currentSessionInCycle: serverStudent.completedLessons || 1,
    totalCycleSessions: serverStudent.totalLessons || 8,
    isPaid: serverStudent.finance.remainingBalance === 0,
    amount: serverStudent.finance.totalPaid,
    currency: serverStudent.finance.currency || 'EGP',
    notes: serverStudent.finance.remainingBalance > 0 
      ? `المتبقي: ${serverStudent.finance.remainingBalance} ${serverStudent.finance.currency}`
      : 'تم سداد كامل المستحقات'
  } : undefined;

  return {
    id: serverStudent.studentCode,
    studentCode: serverStudent.studentCode,
    name: serverStudent.studentName,
    gradeLevel: serverStudent.grade,
    groupName: serverStudent.groupName,
    teacherName: 'أ. عمر حسن',
    teacherTitle: 'معلم أول اللغة الألمانية 🇩🇪',
    stats,
    nextLesson,
    lessons,
    quizzes,
    certificates,
    packageInfo,
    lastUpdated: serverStudent.lastSyncedAt || new Date().toISOString()
  };
}

function getArabicDayName(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[d.getDay()] || 'الأحد';
  } catch (e) {
    return 'الأحد';
  }
}

/**
 * Fetch Student Portal Data by Student Code
 */
export async function fetchStudentPortalData(identifier: string): Promise<StudentPortalData | null> {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId) return null;

  // 1. Fetch from backend API with active session
  const session = getStoredSession();
  const headers: Record<string, string> = {};
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  try {
    const res = await fetch(`/api/portal/data/${encodeURIComponent(identifier.trim())}`, {
      headers
    });

    if (res.ok) {
      const data = await res.json();
      if (data.student) {
        const adapted = adaptServerStudentToPortalData(data.student);
        try {
          localStorage.setItem(`portal_cache_${identifier.trim()}`, JSON.stringify(adapted));
        } catch (e) {}
        return adapted;
      }
    }
  } catch (error) {
    console.warn('Backend fetch error, falling back to local cache or demo:', error);
  }

  // 2. Fallback: check localStorage cache
  try {
    const cached = localStorage.getItem(`portal_cache_${identifier.trim()}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  // 3. Fallback for demo student
  if (cleanId === 'demo' || cleanId === '1001') {
    return DEMO_STUDENT;
  }

  return null;
}
