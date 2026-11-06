import {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkFlowMode,
  HomeworkQuestionType,
  HomeworkBlooketMode
} from './homeworkTypes';

const LOCAL_ASSIGNMENTS_KEY = 'glueck_hw_assignments_v2';
const LOCAL_SUBMISSIONS_KEY = 'glueck_hw_submissions_v2';

export const QUESTION_TYPE_META: {
  id: HomeworkQuestionType;
  labelAr: string;
  labelDe: string;
  descAr: string;
  badgeEmoji: string;
}[] = [
  {
    id: 'mc_de_ar',
    labelAr: 'اختيار من متعدد (ألماني ← عربي)',
    labelDe: 'Multiple Choice (DE → AR)',
    descAr: 'يعرض الكلمة الألمانية وينطقها، والطالب يختار المعنى العربي الصحيح',
    badgeEmoji: '🎯'
  },
  {
    id: 'true_false',
    labelAr: 'صح أم خطأ (Richtig / Falsch)',
    labelDe: 'Richtig oder Falsch',
    descAr: 'يعرض الكلمة الألمانية مع ترجمة مقترحة، والطالب يحدد (صح ✅) أم (خطأ ❌)',
    badgeEmoji: '⚖️'
  },
  {
    id: 'listen_choose',
    labelAr: 'استمع للنطق واختر الكلمة (صوتي)',
    labelDe: 'Hören & Wählen',
    descAr: 'يستمع الطالب لنطق الكلمة الألمانية ويختار الكلمة الصحيحة ومعناها',
    badgeEmoji: '🔊'
  },
  {
    id: 'mc_ar_de',
    labelAr: 'اختيار من متعدد (عربي ← ألماني)',
    labelDe: 'Multiple Choice (AR → DE)',
    descAr: 'يعرض المعنى بالعربية، والطالب يختار الكلمة الألمانية الصحيحة',
    badgeEmoji: '🔄'
  },
  {
    id: 'article_quiz',
    labelAr: 'اختيار الأداة (der / die / das)',
    labelDe: 'Artikel wählen (der/die/das)',
    descAr: 'يختار الطالب الأداة الصحيحة للكلمة الألمانية (مذكر / مؤنث / محايد)',
    badgeEmoji: '🏷️'
  },
  {
    id: 'missing_letter',
    labelAr: 'تكملة الحرف الناقص (الإملاء)',
    labelDe: 'Buchstaben ergänzen',
    descAr: 'يكمل الطالب الحرف الناقص من الكلمة الألمانية لتثبيت الحفظ والإملاء',
    badgeEmoji: '✍️'
  }
];

export function getLocalAssignments(): HomeworkAssignment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalAssignment(hw: HomeworkAssignment): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalAssignments().filter((a) => a.id !== hw.id);
    current.unshift(hw);
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(current.slice(0, 100)));
  } catch {
    // Ignore storage quota errors
  }
}

export function getLocalSubmissions(): HomeworkSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSubmission(sub: HomeworkSubmission): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalSubmissions().filter((s) => s.id !== sub.id);
    current.unshift(sub);
    localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(current.slice(0, 500)));
  } catch {
    // Ignore storage quota errors
  }
}

export function buildHomeworkShareUrl(hw: HomeworkAssignment): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams();
  if (hw.setSnapshot?.id) params.set('s', hw.setSnapshot.id);
  if (hw.flowMode) params.set('fm', hw.flowMode);
  if (hw.questionTypes && hw.questionTypes.length > 0) {
    params.set('qt', hw.questionTypes.join(','));
  }
  if (hw.blooketMode) params.set('bm', hw.blooketMode);
  if (hw.title) params.set('t', hw.title);
  if (hw.selectedItemIds && hw.selectedItemIds.length > 0) {
    params.set('ids', hw.selectedItemIds.join(','));
  }
  return `${origin}/homework/${hw.id}?${params.toString()}`;
}

export async function syncAndFetchTeacherAssignments(): Promise<any[]> {
  const localAssignments = getLocalAssignments();
  const localSubmissions = getLocalSubmissions();

  try {
    const res = await fetch('/api/teacher/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        assignments: localAssignments,
        submissions: localSubmissions
      })
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (res.ok && Array.isArray(data.assignments)) {
      data.assignments.forEach((hw: HomeworkAssignment) => saveLocalAssignment(hw));
      return data.assignments;
    }
  } catch {
    // Fallback to local
  }

  return localAssignments.map((hw) => {
    const subs = localSubmissions.filter((s) => s.assignmentId === hw.id);
    const avgScore =
      subs.length > 0
        ? Math.round(subs.reduce((acc, c) => acc + (c.scorePercentage ?? c.accuracy ?? 0), 0) / subs.length)
        : 0;
    return {
      ...hw,
      status: hw.status || (hw.isActive !== false ? 'active' : 'closed'),
      submissionCount: subs.length,
      avgAccuracy: avgScore,
      avgScore,
      recentSubmissions: subs
    };
  });
}

export async function fetchAssignmentDetailsWithSync(id: string): Promise<any | null> {
  const localAssignments = getLocalAssignments();
  const localSubmissions = getLocalSubmissions();

  try {
    await fetch('/api/teacher/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        assignments: localAssignments,
        submissions: localSubmissions
      })
    });

    const res = await fetch(`/api/teacher/assignment-details?id=${encodeURIComponent(id)}&direct=1`, {
      credentials: 'include'
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.ok && data && data.assignment) {
      if (Array.isArray(data.submissions)) {
        data.submissions.forEach((s: HomeworkSubmission) => saveLocalSubmission(s));
      }
      return data;
    }
  } catch {
    // Fallback to local computation
  }

  const hw = localAssignments.find((a) => a.id === id);
  if (!hw) return null;
  const subs = localSubmissions
    .filter((s) => s.assignmentId === id)
    .map((s) => ({
      ...s,
      score: s.score ?? s.correctAnswersCount ?? 0,
      accuracy: s.accuracy ?? s.scorePercentage ?? 0,
      goldEarned: s.goldEarned ?? (s.correctAnswersCount || 0) * 100
    }));

  const questionMap = new Map<
    string,
    {
      questionId: string;
      germanWord: string;
      prompt: string;
      correctAnswer: string;
      totalAttempts: number;
      correctCount: number;
    }
  >();

  subs.forEach((sub) => {
    sub.responses?.forEach((r) => {
      const key = r.germanWord || r.questionId;
      const existing = questionMap.get(key) || {
        questionId: r.questionId || key,
        germanWord: r.germanWord,
        prompt: r.promptText || r.germanWord,
        correctAnswer: r.correctAnswer || r.germanWord,
        totalAttempts: 0,
        correctCount: 0
      };
      existing.totalAttempts++;
      if (r.isCorrect) existing.correctCount++;
      questionMap.set(key, existing);
    });
  });

  const questionAccuracy = Array.from(questionMap.values())
    .map((q) => ({
      ...q,
      accuracyPercent: Math.round((q.correctCount / Math.max(1, q.totalAttempts)) * 100)
    }))
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  return {
    assignment: hw,
    submissions: subs,
    questionAccuracy
  };
}
