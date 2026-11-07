import {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkQuestionType
} from './homeworkTypes';
import {
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN,
  sanitizeDocId,
  saveAssignmentToFirestore,
  fetchAssignmentFromFirestore,
  fetchAllAssignmentsFromFirestore,
  subscribeAssignmentsFromFirestore,
  deleteAssignmentFromFirestore,
  deleteSubmissionsForAssignmentFromFirestore,
  saveSubmissionToFirestore,
  fetchSubmissionsForAssignmentFromFirestore,
  fetchAllSubmissionsFromFirestore,
  subscribeSubmissionsFromFirestore,
  saveLernstudioSetToFirestore,
  fetchLernstudioSetFromFirestore,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth
} from './firebaseCloudSync';

export {
  getVercelPublicDomain,
  setVercelPublicDomain,
  DEFAULT_VERCEL_DOMAIN,
  sanitizeDocId,
  saveAssignmentToFirestore,
  fetchAssignmentFromFirestore,
  fetchAllAssignmentsFromFirestore,
  subscribeAssignmentsFromFirestore,
  deleteAssignmentFromFirestore,
  deleteSubmissionsForAssignmentFromFirestore,
  saveSubmissionToFirestore,
  fetchSubmissionsForAssignmentFromFirestore,
  fetchAllSubmissionsFromFirestore,
  subscribeSubmissionsFromFirestore,
  saveLernstudioSetToFirestore,
  fetchLernstudioSetFromFirestore,
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

function simpleStringHash(input: string): string {
  const clean = (input || '').trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Generates a deterministic submission ID per (assignmentId, student, attemptNumber)
 * so live in-progress updates, retries, and final completion update the exact same document
 * without creating duplicate submissions or attempts.
 */
export function buildDeterministicSubmissionId(
  assignmentId: string,
  studentId: string | undefined,
  studentName: string,
  attemptNumber: number
): string {
  const safeHw = sanitizeDocId(assignmentId).slice(0, 40);
  const rawKey = (studentId && studentId.trim()) ? studentId.trim() : (studentName || 'student').trim().toLowerCase();
  const safeAscii = rawKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const hashPart = simpleStringHash(rawKey);
  const studentToken = safeAscii ? `${safeAscii}_${hashPart}` : `st_${hashPart}`;
  const att = Math.max(1, Number(attemptNumber) || 1);
  return sanitizeDocId(`sub_${safeHw}_${studentToken}_a${att}`);
}

/**
 * Chooses the more complete/newer submission record when merging duplicates.
 */
function pickBetterSubmission(a: HomeworkSubmission, b: HomeworkSubmission): HomeworkSubmission {
  const aCompleted = a.status === 'completed' || (!a.status && Boolean(a.completedAt));
  const bCompleted = b.status === 'completed' || (!b.status && Boolean(b.completedAt));
  if (aCompleted !== bCompleted) {
    const winner = aCompleted ? a : b;
    return {
      ...winner,
      cloudSynced: Boolean(a.cloudSynced || b.cloudSynced)
    };
  }

  const aRespCount = Array.isArray(a.responses) ? a.responses.length : 0;
  const bRespCount = Array.isArray(b.responses) ? b.responses.length : 0;
  if (aRespCount !== bRespCount) {
    const winner = aRespCount > bRespCount ? a : b;
    return {
      ...winner,
      cloudSynced: Boolean(winner.cloudSynced)
    };
  }

  const aTime = new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime();
  const bTime = new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime();
  const winner = bTime >= aTime ? b : a;
  return {
    ...winner,
    cloudSynced: Boolean(a.cloudSynced || b.cloudSynced)
  };
}

/**
 * Deduplicates submissions by ID and by (assignmentId + student identity + attemptNumber)
 * while preserving historical submissions from older versions.
 */
export function deduplicateSubmissions(submissions: HomeworkSubmission[]): HomeworkSubmission[] {
  const byId = new Map<string, HomeworkSubmission>();
  for (const s of submissions) {
    if (!s || !s.id || !s.assignmentId) continue;
    const existing = byId.get(s.id);
    byId.set(s.id, existing ? pickBetterSubmission(existing, s) : s);
  }

  const byAttemptKey = new Map<string, HomeworkSubmission>();
  for (const s of byId.values()) {
    const studentIdentity = (s.studentId || s.studentName || '').trim().toLowerCase();
    const attNum = Number(s.attemptNumber) || 0;
    // If attemptNumber > 0 and studentIdentity is present, deduplicate same attempt number for same student
    if (studentIdentity && attNum > 0) {
      const attemptKey = `${s.assignmentId}::${studentIdentity}::${attNum}`;
      const existing = byAttemptKey.get(attemptKey);
      byAttemptKey.set(attemptKey, existing ? pickBetterSubmission(existing, s) : s);
    } else {
      byAttemptKey.set(`id::${s.id}`, s);
    }
  }

  return Array.from(byAttemptKey.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
      new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
  );
}

function notifyHomeworkSyncStateChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('glueck-homework-sync-updated'));
  }
}

export function getLocalAssignments(): HomeworkAssignment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalAssignmentsList(list: HomeworkAssignment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(list.slice(0, 150)));
  } catch {
    // Ignore storage quota errors
  }
}

export function saveLocalAssignment(hw: HomeworkAssignment, syncCloud = true): void {
  if (typeof window === 'undefined' || !hw || !hw.id) return;
  const existing = getLocalAssignments().find((a) => a.id === hw.id);
  const initialRecord: HomeworkAssignment = {
    ...existing,
    ...hw,
    cloudSynced: syncCloud ? false : (hw.cloudSynced ?? existing?.cloudSynced ?? true)
  };

  const current = getLocalAssignments().filter((a) => a.id !== hw.id);
  current.unshift(initialRecord);
  writeLocalAssignmentsList(current);

  if (syncCloud) {
    saveAssignmentToFirestore(initialRecord)
      .then((ok) => {
        if (ok) {
          const updated = getLocalAssignments().map((a) =>
            a.id === hw.id ? { ...a, cloudSynced: true } : a
          );
          writeLocalAssignmentsList(updated);
          notifyHomeworkSyncStateChanged();
        }
      })
      .catch(() => {});
  }
}

export async function saveAssignmentWithConfirmation(hw: HomeworkAssignment): Promise<{
  assignment: HomeworkAssignment;
  cloudSynced: boolean;
}> {
  saveLocalAssignment({ ...hw, cloudSynced: false }, false);
  const cloudOk = await saveAssignmentToFirestore(hw);
  const finalHw: HomeworkAssignment = {
    ...hw,
    cloudSynced: cloudOk
  };
  saveLocalAssignment(finalHw, false);
  notifyHomeworkSyncStateChanged();
  return { assignment: finalHw, cloudSynced: cloudOk };
}

export function deleteLocalAssignment(assignmentId: string, syncCloud = true): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    const remainingAssignments = getLocalAssignments().filter((a) => a.id !== assignmentId);
    writeLocalAssignmentsList(remainingAssignments);

    const remainingSubmissions = getLocalSubmissions().filter((s) => s.assignmentId !== assignmentId);
    writeLocalSubmissionsList(remainingSubmissions);
  } catch {
    // Ignore storage errors
  }
  if (syncCloud) {
    deleteAssignmentFromFirestore(assignmentId).catch(() => {});
    deleteSubmissionsForAssignmentFromFirestore(assignmentId).catch(() => {});
  }
}

export function getLocalSubmissions(): HomeworkSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    const parsed: HomeworkSubmission[] = raw ? JSON.parse(raw) : [];
    return deduplicateSubmissions(parsed);
  } catch {
    return [];
  }
}

function writeLocalSubmissionsList(list: HomeworkSubmission[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      LOCAL_SUBMISSIONS_KEY,
      JSON.stringify(deduplicateSubmissions(list).slice(0, 600))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function saveLocalSubmission(sub: HomeworkSubmission, syncCloud = true): void {
  if (typeof window === 'undefined' || !sub || !sub.id) return;
  const currentAll = getLocalSubmissions();
  const existing = currentAll.find((s) => s.id === sub.id);
  const mergedRecord: HomeworkSubmission = existing
    ? pickBetterSubmission(existing, {
        ...sub,
        cloudSynced: syncCloud ? false : (sub.cloudSynced ?? existing.cloudSynced ?? true)
      })
    : {
        ...sub,
        cloudSynced: syncCloud ? false : (sub.cloudSynced ?? true)
      };

  if (syncCloud) {
    mergedRecord.cloudSynced = false;
  }

  const others = currentAll.filter((s) => s.id !== mergedRecord.id);
  others.unshift(mergedRecord);
  writeLocalSubmissionsList(others);

  if (syncCloud) {
    saveSubmissionToFirestore(mergedRecord)
      .then((ok) => {
        if (ok) {
          const updated = getLocalSubmissions().map((s) =>
            s.id === mergedRecord.id ? { ...s, cloudSynced: true } : s
          );
          writeLocalSubmissionsList(updated);
          notifyHomeworkSyncStateChanged();
        }
      })
      .catch(() => {});
  }
}

export async function saveSubmissionWithConfirmation(sub: HomeworkSubmission): Promise<{
  submission: HomeworkSubmission;
  cloudSynced: boolean;
}> {
  saveLocalSubmission({ ...sub, cloudSynced: false }, false);
  const cloudOk = await saveSubmissionToFirestore(sub);
  const finalSub: HomeworkSubmission = {
    ...sub,
    cloudSynced: cloudOk
  };
  saveLocalSubmission(finalSub, false);
  notifyHomeworkSyncStateChanged();
  return { submission: finalSub, cloudSynced: cloudOk };
}

/**
 * Retries any locally saved homework assignments or student submissions
 * whose Firestore write previously failed (e.g. while offline).
 */
let isFlushingPendingHw = false;
export async function flushPendingHomeworkCloudWrites(): Promise<{
  syncedAssignments: number;
  syncedSubmissions: number;
  remainingPending: number;
}> {
  if (isFlushingPendingHw) {
    return { syncedAssignments: 0, syncedSubmissions: 0, remainingPending: getPendingHomeworkSyncCount() };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { syncedAssignments: 0, syncedSubmissions: 0, remainingPending: getPendingHomeworkSyncCount() };
  }

  isFlushingPendingHw = true;
  let syncedAssignments = 0;
  let syncedSubmissions = 0;

  try {
    const localHw = getLocalAssignments();
    for (const hw of localHw) {
      if (hw.cloudSynced === false) {
        const ok = await saveAssignmentToFirestore(hw);
        if (ok) {
          syncedAssignments++;
          saveLocalAssignment({ ...hw, cloudSynced: true }, false);
        }
      }
    }

    const localSubs = getLocalSubmissions();
    for (const sub of localSubs) {
      if (sub.cloudSynced === false) {
        const ok = await saveSubmissionToFirestore(sub);
        if (ok) {
          syncedSubmissions++;
          saveLocalSubmission({ ...sub, cloudSynced: true }, false);
        }
      }
    }
  } finally {
    isFlushingPendingHw = false;
    if (syncedAssignments > 0 || syncedSubmissions > 0) {
      notifyHomeworkSyncStateChanged();
    }
  }

  return {
    syncedAssignments,
    syncedSubmissions,
    remainingPending: getPendingHomeworkSyncCount()
  };
}

export function getPendingHomeworkSyncCount(): number {
  const pendingHw = getLocalAssignments().filter((a) => a.cloudSynced === false).length;
  const pendingSubs = getLocalSubmissions().filter((s) => s.cloudSynced === false).length;
  return pendingHw + pendingSubs;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingHomeworkCloudWrites().catch(() => {});
  });
}

/**
 * Generates the student/parent homework link using the Vercel public domain
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

export async function syncAndFetchTeacherAssignments(
  rosterStudents?: { id: string; name: string; groupId?: string; deleted?: boolean; status?: string }[]
): Promise<any[]> {
  // 1. Flush any pending local-only writes first
  await flushPendingHomeworkCloudWrites().catch(() => {});

  // 2. Fetch from Firebase Firestore (Primary Cloud Source of Truth across Main App & Vercel)
  const [cloudAssignments, cloudSubmissions] = await Promise.all([
    fetchAllAssignmentsFromFirestore().catch(() => [] as HomeworkAssignment[]),
    fetchAllSubmissionsFromFirestore().catch(() => [] as HomeworkSubmission[])
  ]);

  cloudAssignments.forEach((hw) => saveLocalAssignment({ ...hw, cloudSynced: true }, false));
  cloudSubmissions.forEach((sub) => saveLocalSubmission({ ...sub, cloudSynced: true }, false));

  // Push any local assignments/submissions missing from cloud
  const localAssignments = getLocalAssignments();
  const localSubmissions = getLocalSubmissions();

  const cloudAssignmentIds = new Set(cloudAssignments.map((a) => a.id));
  for (const localHw of localAssignments) {
    if (!cloudAssignmentIds.has(localHw.id)) {
      const ok = await saveAssignmentToFirestore(localHw).catch(() => false);
      if (ok) {
        saveLocalAssignment({ ...localHw, cloudSynced: true }, false);
      }
    }
  }

  const cloudSubmissionIds = new Set(cloudSubmissions.map((s) => s.id));
  for (const localSub of localSubmissions) {
    if (!cloudSubmissionIds.has(localSub.id) || localSub.cloudSynced === false) {
      const ok = await saveSubmissionToFirestore(localSub).catch(() => false);
      if (ok) {
        saveLocalSubmission({ ...localSub, cloudSynced: true }, false);
      }
    }
  }

  const mergedAssignments = getLocalAssignments();
  const mergedSubmissions = getLocalSubmissions();

  return mergedAssignments.map((hw) => {
    const subs = mergedSubmissions.filter((s) => s.assignmentId === hw.id);
    const completedSubs = subs.filter(
      (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
    );
    const inProgressSubs = subs.filter((s) => s.status === 'in_progress');

    // Determine assigned students count
    const assignedRoster = new Map<string, { id: string; name: string }>();
    if (Array.isArray(hw.assignedStudents)) {
      hw.assignedStudents.forEach((st) => {
        if (st && (st.id || st.name)) {
          assignedRoster.set((st.id || st.name).trim().toLowerCase(), st);
        }
      });
    }
    if (Array.isArray(rosterStudents) && hw.groupId) {
      rosterStudents
        .filter((s) => !s.deleted && s.status !== 'archived' && s.groupId === hw.groupId)
        .forEach((st) => {
          const key = (st.id || st.name).trim().toLowerCase();
          if (!assignedRoster.has(key)) {
            assignedRoster.set(key, { id: st.id, name: st.name });
          }
        });
    }
    subs.forEach((s) => {
      const key = (s.studentId || s.studentName || '').trim().toLowerCase();
      if (key && !assignedRoster.has(key)) {
        assignedRoster.set(key, { id: s.studentId || s.studentName, name: s.studentName });
      }
    });

    const uniqueCompletedStudents = new Set(
      completedSubs.map((s) => (s.studentId || s.studentName || '').trim().toLowerCase())
    );
    const uniqueInProgressStudents = new Set(
      inProgressSubs
        .map((s) => (s.studentId || s.studentName || '').trim().toLowerCase())
        .filter((k) => !uniqueCompletedStudents.has(k))
    );

    const scoringSubs = completedSubs.length > 0 ? completedSubs : subs;
    const avgScore =
      scoringSubs.length > 0
        ? Math.round(
            scoringSubs.reduce(
              (acc, c) => acc + (c.scorePercentage ?? c.accuracyPercent ?? c.accuracy ?? 0),
              0
            ) / scoringSubs.length
          )
        : 0;

    return {
      ...hw,
      status: hw.status || (hw.isActive !== false ? 'active' : 'closed'),
      submissionCount: subs.length,
      completedStudentsCount: uniqueCompletedStudents.size,
      inProgressStudentsCount: uniqueInProgressStudents.size,
      assignedStudentsCount: assignedRoster.size,
      avgAccuracy: avgScore,
      avgScore,
      cloudSynced: hw.cloudSynced !== false,
      recentSubmissions: subs
    };
  });
}

export async function fetchAssignmentDetailsWithSync(
  id: string,
  rosterStudents?: { id: string; name: string; groupId?: string; deleted?: boolean; status?: string }[]
): Promise<any | null> {
  // 1. Fetch assignment + submissions from Firebase Firestore
  const [cloudHw, cloudSubs] = await Promise.all([
    fetchAssignmentFromFirestore(id).catch(() => null),
    fetchSubmissionsForAssignmentFromFirestore(id).catch(() => [] as HomeworkSubmission[])
  ]);

  if (cloudHw) {
    saveLocalAssignment({ ...cloudHw, cloudSynced: true }, false);
  }
  cloudSubs.forEach((sub) => saveLocalSubmission({ ...sub, cloudSynced: true }, false));

  const hw = cloudHw || getLocalAssignments().find((a) => a.id === id);
  if (!hw) return null;

  const subs = deduplicateSubmissions(
    getLocalSubmissions().filter((s) => s.assignmentId === id)
  ).map((s) => ({
    ...s,
    score: s.score ?? s.correctAnswersCount ?? 0,
    accuracy: s.accuracy ?? s.scorePercentage ?? s.accuracyPercent ?? 0,
    goldEarned: s.goldEarned ?? (s.correctAnswersCount || s.score || 0) * 100
  }));

  // Build student status summary & attempt history
  const rosterMap = new Map<string, { id: string; name: string }>();
  const addRosterStudent = (st: { id?: string; name?: string }) => {
    const cleanName = (st.name || '').trim();
    if (!cleanName) return;
    const nameKey = cleanName.toLowerCase();
    if (!rosterMap.has(nameKey)) {
      rosterMap.set(nameKey, { id: st.id || cleanName, name: cleanName });
    }
  };

  if (Array.isArray(hw.assignedStudents)) {
    hw.assignedStudents.forEach(addRosterStudent);
  }

  // Enrich with active students from the teacher's Glück group roster
  if (Array.isArray(rosterStudents)) {
    const matchingGroupStudents = hw.groupId
      ? rosterStudents.filter((s) => !s.deleted && s.status !== 'archived' && s.groupId === hw.groupId)
      : [];
    matchingGroupStudents.forEach(addRosterStudent);
  }

  // Also include any students who submitted via link
  subs.forEach((s) => {
    addRosterStudent({ id: s.studentId || s.studentName, name: s.studentName });
  });

  const studentStatusSummary: any[] = [];
  const leaderboardMap = new Map<string, any>();

  rosterMap.forEach((st) => {
    const stNameLower = st.name.trim().toLowerCase();
    const studentSubs = subs
      .filter(
        (s) =>
          (s.studentId && st.id && s.studentId === st.id) ||
          (s.studentName || '').trim().toLowerCase() === stNameLower
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
          new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
      );

    const completedAttempts = studentSubs.filter(
      (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
    );
    const inProgressAttempts = studentSubs.filter((s) => s.status === 'in_progress');

    let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
    if (inProgressAttempts.length > 0 && completedAttempts.length === 0) {
      status = 'in_progress';
    } else if (completedAttempts.length > 0) {
      // If student is currently in the middle of a new replay attempt, show in_progress or completed
      status = 'completed';
    }

    const attemptsCount = studentSubs.length;
    const completedAttemptsCount = completedAttempts.length;
    const sortedByBest = [...(completedAttempts.length > 0 ? completedAttempts : studentSubs)].sort(
      (a, b) =>
        (b.scorePercentage ?? b.accuracy ?? 0) - (a.scorePercentage ?? a.accuracy ?? 0) ||
        (a.timeSpentSeconds || 999999) - (b.timeSpentSeconds || 999999)
    );
    const bestAttempt = sortedByBest[0] || null;
    const latestAttempt = studentSubs[0] || null;
    const activeInProgressAttempt = inProgressAttempts[0] || null;

    const bestScore = bestAttempt ? (bestAttempt.scorePercentage ?? bestAttempt.accuracy ?? 0) : 0;
    const latestScore = latestAttempt ? (latestAttempt.scorePercentage ?? latestAttempt.accuracy ?? 0) : 0;
    const bestCorrectCount = bestAttempt ? (bestAttempt.correctAnswersCount ?? bestAttempt.score ?? 0) : 0;
    const latestCorrectCount = latestAttempt ? (latestAttempt.correctAnswersCount ?? latestAttempt.score ?? 0) : 0;
    const totalQuestions =
      latestAttempt?.totalQuestions || hw.questionCount || hw.targetQuestionCount || 0;
    const answeredCount = latestAttempt?.responses?.length || 0;
    const bestAccuracy = bestAttempt ? (bestAttempt.accuracyPercent ?? bestAttempt.accuracy ?? bestScore) : 0;
    const totalTimeSpent = studentSubs.reduce((acc, c) => acc + (c.timeSpentSeconds || 0), 0);
    const latestTimeSpent = latestAttempt?.timeSpentSeconds || 0;
    const lastActivity = latestAttempt
      ? latestAttempt.updatedAt || latestAttempt.completedAt || latestAttempt.startedAt
      : null;
    const allSynced = studentSubs.every((s) => s.cloudSynced !== false);

    const studentRecord = {
      studentId: st.id,
      studentName: st.name,
      status,
      hasActiveInProgress: Boolean(activeInProgressAttempt),
      attemptsCount,
      completedAttemptsCount,
      bestScore,
      latestScore,
      bestCorrectCount,
      latestCorrectCount,
      totalQuestions,
      answeredCount,
      bestAccuracy,
      totalTimeSpent,
      latestTimeSpent,
      lastActivity,
      cloudSynced: allSynced,
      latestAttempt,
      bestAttempt,
      attempts: studentSubs
    };

    studentStatusSummary.push(studentRecord);

    if (bestAttempt && completedAttemptsCount > 0) {
      leaderboardMap.set(st.id || st.name, {
        studentId: st.id,
        studentName: st.name,
        bestScore,
        bestAccuracy,
        timeSpentSeconds: bestAttempt.timeSpentSeconds || 0,
        goldEarned: bestAttempt.goldEarned || 0,
        completedAt: bestAttempt.completedAt
      });
    }
  });

  // Sort studentStatusSummary: in_progress first, then completed (by bestScore desc), then not_started
  const statusOrder: Record<string, number> = {
    in_progress: 0,
    completed: 1,
    not_started: 2
  };
  studentStatusSummary.sort((a, b) => {
    const orderDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (orderDiff !== 0) return orderDiff;
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    return a.studentName.localeCompare(b.studentName, 'ar');
  });

  const officialLeaderboard = Array.from(leaderboardMap.values()).sort(
    (a, b) =>
      b.bestScore - a.bestScore ||
      b.bestAccuracy - a.bestAccuracy ||
      a.timeSpentSeconds - b.timeSpentSeconds
  );

  const questionMap = new Map<
    string,
    {
      questionId: string;
      germanWord: string;
      prompt: string;
      correctAnswer: string;
      totalAttempts: number;
      correctCount: number;
      incorrectCount: number;
    }
  >();

  subs.forEach((sub) => {
    sub.responses?.forEach((r) => {
      const key = `${r.questionType || 'q'}::${r.germanWord || r.questionId}`;
      const existing = questionMap.get(key) || {
        questionId: r.questionId || key,
        germanWord: r.germanWord,
        prompt: r.promptText || r.germanWord,
        correctAnswer: r.correctAnswer || r.germanWord,
        totalAttempts: 0,
        correctCount: 0,
        incorrectCount: 0
      };
      existing.totalAttempts++;
      if (r.isCorrect) {
        existing.correctCount++;
      } else {
        existing.incorrectCount++;
      }
      questionMap.set(key, existing);
    });
  });

  const questionAccuracy = Array.from(questionMap.values())
    .map((q) => ({
      ...q,
      accuracyPercent: Math.round((q.correctCount / Math.max(1, q.totalAttempts)) * 100)
    }))
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  const totalAssigned = rosterMap.size;
  const completedCount = studentStatusSummary.filter((s) => s.status === 'completed').length;
  const inProgressCount = studentStatusSummary.filter((s) => s.status === 'in_progress').length;
  const notStartedCount = studentStatusSummary.filter((s) => s.status === 'not_started').length;
  const completionPercentage =
    totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  const completedSubsList = subs.filter(
    (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
  );
  const scoringPool = completedSubsList.length > 0 ? completedSubsList : subs;
  const averageScorePercentage =
    scoringPool.length > 0
      ? Math.round(
          scoringPool.reduce((acc, s) => acc + (s.scorePercentage ?? s.accuracy ?? 0), 0) /
            scoringPool.length
        )
      : 0;

  return {
    assignment: hw,
    submissions: subs,
    studentStatusSummary,
    officialLeaderboard,
    questionAccuracy,
    metrics: {
      totalAssigned,
      completedCount,
      inProgressCount,
      notStartedCount,
      completionPercentage,
      totalAttemptsCount: subs.length,
      averageScorePercentage
    }
  };
}
