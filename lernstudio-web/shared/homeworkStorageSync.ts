import {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkQuestionType
} from './homeworkTypes';
import {
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN,
  saveAssignmentToFirestore,
  fetchAssignmentFromFirestore,
  fetchAllAssignmentsFromFirestore,
  subscribeAssignmentsFromFirestore,
  saveSubmissionToFirestore,
  fetchSubmissionsForAssignmentFromFirestore,
  fetchAllSubmissionsFromFirestore,
  subscribeSubmissionsFromFirestore,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth
} from './firebaseCloudSync';

export {
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN,
  saveAssignmentToFirestore,
  fetchAssignmentFromFirestore,
  fetchAllAssignmentsFromFirestore,
  subscribeAssignmentsFromFirestore,
  saveSubmissionToFirestore,
  fetchSubmissionsForAssignmentFromFirestore,
  fetchAllSubmissionsFromFirestore,
  subscribeSubmissionsFromFirestore,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth
};

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

export function saveLocalAssignment(hw: HomeworkAssignment, syncCloud = true): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalAssignments().filter((a) => a.id !== hw.id);
    current.unshift(hw);
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(current.slice(0, 100)));
  } catch {
    // Ignore storage quota errors
  }
  if (syncCloud) {
    saveAssignmentToFirestore(hw).catch(() => {});
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

export function saveLocalSubmission(sub: HomeworkSubmission, syncCloud = true): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalSubmissions().filter((s) => s.id !== sub.id);
    current.unshift(sub);
    localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(current.slice(0, 500)));
  } catch {
    // Ignore storage quota errors
  }
  if (syncCloud) {
    saveSubmissionToFirestore(sub).catch(() => {});
  }
}

/**
 * Generates the student/parent homework link using the Vercel public domain
 * (e.g. https://gluck-froh-und-n-ex3u.vercel.app/homework/...) so links created
 * inside the Main Program open directly for parents/students on Vercel!
 */
export function buildHomeworkShareUrl(hw: HomeworkAssignment, overrideDomain?: string): string {
  const baseDomain = (overrideDomain || getVercelPublicDomain()).replace(/\/+$/, '');
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
  return `${baseDomain}/homework/${hw.id}?${params.toString()}`;
}

export async function syncAndFetchTeacherAssignments(): Promise<any[]> {
  // 1. Fetch from Firebase Firestore (Primary Cloud Source of Truth across Main App & Vercel)
  const [cloudAssignments, cloudSubmissions] = await Promise.all([
    fetchAllAssignmentsFromFirestore().catch(() => [] as HomeworkAssignment[]),
    fetchAllSubmissionsFromFirestore().catch(() => [] as HomeworkSubmission[])
  ]);

  cloudAssignments.forEach((hw) => saveLocalAssignment(hw, false));
  cloudSubmissions.forEach((sub) => saveLocalSubmission(sub, false));

  // Push any local-only assignments/submissions to Firestore
  const localAssignments = getLocalAssignments();
  const localSubmissions = getLocalSubmissions();

  const cloudAssignmentIds = new Set(cloudAssignments.map((a) => a.id));
  for (const localHw of localAssignments) {
    if (!cloudAssignmentIds.has(localHw.id)) {
      saveAssignmentToFirestore(localHw).catch(() => {});
    }
  }

  const cloudSubmissionIds = new Set(cloudSubmissions.map((s) => s.id));
  for (const localSub of localSubmissions) {
    if (!cloudSubmissionIds.has(localSub.id)) {
      saveSubmissionToFirestore(localSub).catch(() => {});
    }
  }

  // Also sync with /api/teacher/sync as secondary backup
  try {
    const res = await fetch('/api/teacher/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        assignments: getLocalAssignments(),
        submissions: getLocalSubmissions()
      })
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (res.ok && Array.isArray(data.assignments)) {
      data.assignments.forEach((hw: HomeworkAssignment) => saveLocalAssignment(hw, false));
    }
  } catch {
    // Ignore API fallback error
  }

  const mergedAssignments = getLocalAssignments();
  const mergedSubmissions = getLocalSubmissions();

  return mergedAssignments.map((hw) => {
    const subs = mergedSubmissions.filter((s) => s.assignmentId === hw.id);
    const avgScore =
      subs.length > 0
        ? Math.round(
            subs.reduce((acc, c) => acc + (c.scorePercentage ?? c.accuracyPercent ?? c.accuracy ?? 0), 0) /
              subs.length
          )
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
  // 1. Fetch assignment + submissions from Firebase Firestore
  const [cloudHw, cloudSubs] = await Promise.all([
    fetchAssignmentFromFirestore(id).catch(() => null),
    fetchSubmissionsForAssignmentFromFirestore(id).catch(() => [] as HomeworkSubmission[])
  ]);

  if (cloudHw) {
    saveLocalAssignment(cloudHw, false);
  }
  cloudSubs.forEach((sub) => saveLocalSubmission(sub, false));

  // Secondary API sync
  try {
    const res = await fetch(`/api/teacher/assignment-details?id=${encodeURIComponent(id)}&direct=1`, {
      credentials: 'include'
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.ok && data && data.assignment) {
      saveLocalAssignment(data.assignment, false);
      if (Array.isArray(data.submissions)) {
        data.submissions.forEach((s: HomeworkSubmission) => {
          saveLocalSubmission(s, true);
        });
      }
    }
  } catch {
    // Ignore API fallback error
  }

  const hw = cloudHw || getLocalAssignments().find((a) => a.id === id);
  if (!hw) return null;

  const subs = getLocalSubmissions()
    .filter((s) => s.assignmentId === id)
    .map((s) => ({
      ...s,
      score: s.score ?? s.correctAnswersCount ?? 0,
      accuracy: s.accuracy ?? s.scorePercentage ?? s.accuracyPercent ?? 0,
      goldEarned: s.goldEarned ?? (s.correctAnswersCount || s.score || 0) * 100
    }))
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

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
