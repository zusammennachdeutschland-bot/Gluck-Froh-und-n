import {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkQuestionType,
  HomeworkAudienceMode,
  AssignedStudentSnapshot
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
const OPEN_PARTICIPANT_PREFIX = 'glueck_hw_open_pid_';

export interface QuestionTypeMetaItem {
  id: HomeworkQuestionType;
  labelAr: string;
  labelDe: string;
  descAr: string;
  badgeEmoji: string;
}

export const QUESTION_TYPE_META: QuestionTypeMetaItem[] = [
  {
    id: 'true_false',
    labelAr: 'صح أم خطأ (Richtig / Falsch)',
    labelDe: 'Richtig oder Falsch',
    descAr: 'يعرض الكلمة ومعنى مقترح، والطالب يحدد (صح ✔️) أم (غلط ✖️)',
    badgeEmoji: '✔️'
  },
  {
    id: 'choice_2',
    labelAr: 'الاختيار من 2 (Zwei Optionen)',
    labelDe: 'Zwei Optionen',
    descAr: 'يختار الطالب الكلمة الألمانية الصحيحة من بين خيارين اثنين',
    badgeEmoji: '✌️'
  },
  {
    id: 'choice_all',
    labelAr: 'الاختيار من الكل (Alle Wörter)',
    labelDe: 'Alle Wörter',
    descAr: 'يختار الطالب الكلمة الألمانية الصحيحة من بين جميع كلمات المجموعة',
    badgeEmoji: '🎯'
  },
  {
    id: 'syllables',
    labelAr: 'النصين والمقاطع (Silben)',
    labelDe: 'Silben zusammensetzen',
    descAr: 'يركب الطالب نصفي الكلمة أو مقاطعها الصوتية بالترتيب الصحيح',
    badgeEmoji: '🧩'
  },
  {
    id: 'missing_letter',
    labelAr: 'الحرف الناقص (Fehlender Buchstabe)',
    labelDe: 'Fehlender Buchstabe',
    descAr: 'يكمل الطالب الحرف الواحد الناقص من داخل الكلمة الألمانية',
    badgeEmoji: '🔤'
  },
  {
    id: 'missing_two_letters',
    labelAr: 'الحرفين المتتاليين (Buchstabenfolge)',
    labelDe: 'Buchstabenfolge',
    descAr: 'يكمل الطالب حرفين أو حروفاً متتالية ناقصة بالترتيب الصحيح',
    badgeEmoji: '🔡'
  },
  {
    id: 'full_word',
    labelAr: 'الكلمة كلها (Wort vervollständigen)',
    labelDe: 'Wort vervollständigen',
    descAr: 'يرتب الطالب حروف الكلمة الألمانية كاملة من البداية للنهاية',
    badgeEmoji: '✍️'
  }
];

export const LEGACY_QUESTION_TYPE_META: QuestionTypeMetaItem[] = [
  {
    id: 'mc_de_ar',
    labelAr: 'اختيار من متعدد (ألماني ← عربي)',
    labelDe: 'Multiple Choice (DE → AR)',
    descAr: 'يعرض الكلمة الألمانية وينطقها، والطالب يختار المعنى العربي الصحيح',
    badgeEmoji: '🎯'
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
  }
];

export function getQuestionTypeMeta(id: HomeworkQuestionType): QuestionTypeMetaItem {
  return (
    QUESTION_TYPE_META.find((m) => m.id === id) ||
    LEGACY_QUESTION_TYPE_META.find((m) => m.id === id) || {
      id,
      labelAr: 'سؤال تفاعلي',
      labelDe: 'Übung',
      descAr: 'تمرين تفاعلي',
      badgeEmoji: '🎯'
    }
  );
}

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
 * Resolves the authoritative HomeworkAudienceMode ('open' | 'group') for an assignment,
 * including backward-compatible inference for legacy assignments.
 * Legacy assignments without a specific groupId (or with groupId === 'all') resolve to 'open'.
 */
export function resolveAssignmentAudienceMode(
  hw: Partial<HomeworkAssignment> | null | undefined
): HomeworkAudienceMode {
  if (!hw) return 'open';
  if (hw.audienceMode === 'open') return 'open';
  if (hw.audienceMode === 'group') return 'group';
  const gid = (hw.groupId || '').trim();
  if (gid && gid !== 'all') {
    return 'group';
  }
  return 'open';
}

/**
 * Returns the authorized student snapshot list for a group-restricted assignment.
 * Returns an empty array for 'open' assignments so student lists are never exposed.
 */
export function getAuthorizedGroupStudentsForAssignment(
  hw: Partial<HomeworkAssignment> | null | undefined,
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[]
): AssignedStudentSnapshot[] {
  const mode = resolveAssignmentAudienceMode(hw);
  if (mode !== 'group') {
    return [];
  }

  const targetGroupId = (hw?.groupId || '').trim();
  const byId = new Map<string, AssignedStudentSnapshot>();

  if (Array.isArray(hw?.assignedStudents)) {
    for (const raw of hw.assignedStudents) {
      if (!raw) continue;
      const cleanId = (raw.id || '').trim();
      const cleanName = (raw.name || '').trim();
      if (!cleanId || !cleanName) continue;
      if (raw.groupId && targetGroupId && raw.groupId.trim() !== targetGroupId) {
        continue;
      }
      if (!byId.has(cleanId)) {
        byId.set(cleanId, {
          id: cleanId,
          name: cleanName,
          ...(raw.code ? { code: raw.code } : {}),
          ...(raw.groupId || targetGroupId ? { groupId: (raw.groupId || targetGroupId).trim() } : {})
        });
      }
    }
  }

  if (Array.isArray(rosterStudents) && targetGroupId && targetGroupId !== 'all') {
    for (const st of rosterStudents) {
      if (!st || st.deleted || st.status === 'archived') continue;
      if ((st.groupId || '').trim() !== targetGroupId) continue;
      const cleanId = (st.id || '').trim();
      const cleanName = (st.name || '').trim();
      if (!cleanId || !cleanName) continue;
      const existing = byId.get(cleanId);
      byId.set(cleanId, {
        id: cleanId,
        name: cleanName,
        ...(st.code || existing?.code ? { code: st.code || existing?.code } : {}),
        groupId: targetGroupId
      });
    }
  }

  return Array.from(byId.values());
}

/**
 * Normalizes an assignment record so 'open' assignments never retain or leak
 * groupId, groupName, or assignedStudents, and 'group' assignments have a clean,
 * deduplicated student roster strictly for that group.
 */
export function normalizeHomeworkAssignment(hw: HomeworkAssignment): HomeworkAssignment {
  const mode = resolveAssignmentAudienceMode(hw);
  if (mode === 'open') {
    const copy: HomeworkAssignment = {
      ...hw,
      audienceMode: 'open',
      groupId: undefined,
      groupName: undefined,
      assignedStudents: undefined
    };
    delete copy.groupId;
    delete copy.groupName;
    delete copy.assignedStudents;
    return copy;
  }

  const cleanGroupId = (hw.groupId || '').trim();
  const cleanGroupName = (hw.groupName || '').trim();
  const cleanRoster = getAuthorizedGroupStudentsForAssignment(hw);

  return {
    ...hw,
    audienceMode: 'group',
    groupId: cleanGroupId && cleanGroupId !== 'all' ? cleanGroupId : undefined,
    groupName: cleanGroupName || undefined,
    assignedStudents: cleanRoster
  };
}

/**
 * Generates or retrieves a per-device participant ID for an Open Homework participant.
 * Ensures two different people who enter the same name on different devices/sessions
 * remain separate participants while allowing the same person to replay on their device.
 */
export function getOrCreateOpenParticipantId(
  assignmentId: string,
  participantName: string
): string {
  const safeHw = sanitizeDocId(assignmentId || 'hw').slice(0, 40);
  const nameHash = simpleStringHash((participantName || 'participant').trim().toLowerCase());
  const storageKey = `${OPEN_PARTICIPANT_PREFIX}${safeHw}_${nameHash}`;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing && existing.trim()) {
        return existing.trim();
      }
      const generated = `pid_${safeHw.slice(0, 16)}_${nameHash}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      window.localStorage.setItem(storageKey, generated);
      return generated;
    } catch {
      // Fall through to ephemeral ID if storage is blocked
    }
  }

  return `pid_${safeHw.slice(0, 16)}_${nameHash}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export interface SubmissionIdentityValidationResult {
  valid: boolean;
  error?: string;
  audienceMode: HomeworkAudienceMode;
  normalizedStudentId?: string;
  normalizedParticipantId?: string;
  normalizedStudentName?: string;
  normalizedGroupId?: string;
}

/**
 * Validates student/participant identity against the assignment's audienceMode and group roster.
 */
export function validateHomeworkSubmissionIdentity(
  hw: Partial<HomeworkAssignment> | null | undefined,
  submission: Partial<HomeworkSubmission> | null | undefined
): SubmissionIdentityValidationResult {
  if (!hw || !hw.id) {
    return {
      valid: false,
      audienceMode: 'open',
      error: 'بيانات الواجب غير موجودة.'
    };
  }
  if (!submission) {
    return {
      valid: false,
      audienceMode: resolveAssignmentAudienceMode(hw),
      error: 'بيانات الإرسال غير صالحة.'
    };
  }

  const mode = resolveAssignmentAudienceMode(hw);

  if (mode === 'group') {
    const targetGroupId = (hw.groupId || '').trim();
    if (!targetGroupId || targetGroupId === 'all') {
      return {
        valid: false,
        audienceMode: 'group',
        error: 'هذا الواجب مخصص لمجموعة محددة ولكن معرف المجموعة غير صالح.'
      };
    }

    const authorizedStudents = getAuthorizedGroupStudentsForAssignment(hw);
    if (authorizedStudents.length === 0) {
      return {
        valid: false,
        audienceMode: 'group',
        error: 'قائمة طلاب المجموعة غير متاحة حالياً لهذا الواجب.'
      };
    }

    const submittedStudentId = (submission.studentId || '').trim();
    if (!submittedStudentId) {
      return {
        valid: false,
        audienceMode: 'group',
        error: 'يجب اختيار اسم الطالب من قائمة المجموعة المحددة؛ لا يُسمح بكتابة اسم يدوي لهذا الواجب.'
      };
    }

    if (submission.groupId && submission.groupId.trim() !== targetGroupId) {
      return {
        valid: false,
        audienceMode: 'group',
        error: 'معرف المجموعة المرسل لا يطابق المجموعة المخصصة لهذا الواجب.'
      };
    }

    const matchedStudent = authorizedStudents.find((s) => s.id === submittedStudentId);
    if (!matchedStudent) {
      return {
        valid: false,
        audienceMode: 'group',
        error: 'هذا الطالب غير مقيد ضمن المجموعة المخصصة لهذا الواجب.'
      };
    }

    const submittedName = (submission.studentName || '').trim();
    if (!submittedName || submittedName.toLowerCase() !== matchedStudent.name.trim().toLowerCase()) {
      return {
        valid: false,
        audienceMode: 'group',
        error: 'اسم الطالب المرسل لا يطابق السجل الرسمي للطالب في هذه المجموعة.'
      };
    }

    return {
      valid: true,
      audienceMode: 'group',
      normalizedStudentId: matchedStudent.id,
      normalizedParticipantId: undefined,
      normalizedStudentName: matchedStudent.name.trim(),
      normalizedGroupId: targetGroupId
    };
  }

  // Open mode ('open')
  const cleanName = (submission.studentName || '').trim();
  if (!cleanName) {
    return {
      valid: false,
      audienceMode: 'open',
      error: 'يرجى كتابة اسمك قبل بدء الواجب أو إرسال الإجابات.'
    };
  }

  const participantId =
    (submission.participantId || '').trim() ||
    getOrCreateOpenParticipantId(hw.id, cleanName);

  return {
    valid: true,
    audienceMode: 'open',
    normalizedStudentId: undefined,
    normalizedParticipantId: participantId,
    normalizedStudentName: cleanName,
    normalizedGroupId: undefined
  };
}

/**
 * Generates a deterministic submission ID per (assignmentId, studentId/participantId, attemptNumber)
 * so live in-progress updates, retries, and final completion update the exact same document
 * without creating duplicate submissions or merging distinct people who share a name.
 */
export function buildDeterministicSubmissionId(
  assignmentId: string,
  studentId: string | undefined,
  studentName: string,
  attemptNumber: number,
  participantId?: string
): string {
  const safeHw = sanitizeDocId(assignmentId).slice(0, 40);
  const rawKey =
    studentId && studentId.trim()
      ? `sid_${studentId.trim()}`
      : participantId && participantId.trim()
      ? `pid_${participantId.trim()}`
      : (studentName || 'student').trim().toLowerCase();
  const safeAscii = rawKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28);
  const hashPart = simpleStringHash(rawKey);
  const studentToken = safeAscii ? `${safeAscii}_${hashPart}` : `st_${hashPart}`;
  const att = Math.max(1, Number(attemptNumber) || 1);
  return sanitizeDocId(`sub_${safeHw}_${studentToken}_a${att}`);
}

/**
 * Computes a collision-free identity key for a submission so two students or
 * two open participants with the exact same name are never merged together.
 */
export function getSubmissionIdentityKey(s: Partial<HomeworkSubmission>): string {
  if (s.studentId && s.studentId.trim()) {
    return `sid::${s.studentId.trim()}`;
  }
  if (s.participantId && s.participantId.trim()) {
    return `pid::${s.participantId.trim()}`;
  }
  if (s.id) {
    const match = s.id.match(/^(sub_.+)_a\d+$/);
    if (match) {
      return `legacy_token::${match[1]}`;
    }
    return `legacy_id::${s.id}`;
  }
  return `legacy_name::${(s.studentName || '').trim().toLowerCase()}`;
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
 * Deduplicates submissions by ID and by (assignmentId + collision-free identity + attemptNumber)
 * while preserving historical submissions and never merging distinct participants with identical names.
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
    const identityKey = getSubmissionIdentityKey(s);
    const attNum = Number(s.attemptNumber) || 0;
    if (
      (s.studentId?.trim() || s.participantId?.trim() || identityKey.startsWith('legacy_token::')) &&
      attNum > 0
    ) {
      const attemptKey = `${s.assignmentId}::${identityKey}::${attNum}`;
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
    window.dispatchEvent(new CustomEvent('gluck-local-data-mutated', { detail: { source: 'homework' } }));
  }
}

const LOCAL_DELETED_ASSIGNMENTS_KEY = 'glueck_hw_deleted_ids_v2';

export function getDeletedAssignmentIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_ASSIGNMENTS_KEY);
    const parsed: string[] = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id.length > 0) : []);
  } catch {
    return new Set();
  }
}

export function isAssignmentDeletedLocally(assignmentId?: string | null): boolean {
  if (!assignmentId) return false;
  const deletedSet = getDeletedAssignmentIds();
  if (deletedSet.has(assignmentId)) return true;
  const safeId = sanitizeDocId(assignmentId);
  return deletedSet.has(safeId);
}

export function markAssignmentDeletedLocally(assignmentId: string): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    const deletedSet = getDeletedAssignmentIds();
    deletedSet.add(assignmentId);
    deletedSet.add(sanitizeDocId(assignmentId));
    const list = Array.from(deletedSet).slice(-500);
    localStorage.setItem(LOCAL_DELETED_ASSIGNMENTS_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

export function getLocalAssignments(): HomeworkAssignment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    const parsed: HomeworkAssignment[] = raw ? JSON.parse(raw) : [];
    const deletedSet = getDeletedAssignmentIds();
    return parsed
      .filter(
        (hw) =>
          hw &&
          hw.id &&
          !(hw as any).deleted &&
          !deletedSet.has(hw.id) &&
          !deletedSet.has(sanitizeDocId(hw.id))
      )
      .map((hw) => normalizeHomeworkAssignment(hw));
  } catch {
    return [];
  }
}

function writeLocalAssignmentsList(list: HomeworkAssignment[]): void {
  if (typeof window === 'undefined') return;
  try {
    const deletedSet = getDeletedAssignmentIds();
    const normalized = list
      .filter(
        (hw) =>
          hw &&
          hw.id &&
          !(hw as any).deleted &&
          !deletedSet.has(hw.id) &&
          !deletedSet.has(sanitizeDocId(hw.id))
      )
      .slice(0, 150)
      .map((hw) => normalizeHomeworkAssignment(hw));
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors
  }
}

export interface HomeworkCloudTransportOverride {
  saveAssignment?: (hw: HomeworkAssignment) => Promise<boolean>;
  saveSubmission?: (sub: HomeworkSubmission) => Promise<boolean>;
  fetchAssignment?: (id: string) => Promise<HomeworkAssignment | null>;
  fetchSubmissionsForAssignment?: (id: string) => Promise<HomeworkSubmission[]>;
  fetchAllAssignments?: () => Promise<HomeworkAssignment[]>;
  fetchAllSubmissions?: () => Promise<HomeworkSubmission[]>;
}

let testCloudTransport: HomeworkCloudTransportOverride | null = null;

export function __setHomeworkSyncTransportForTests(
  transport: HomeworkCloudTransportOverride | null
): void {
  testCloudTransport = transport;
}

const activeSaveAssignmentToCloud = (hw: HomeworkAssignment) =>
  testCloudTransport?.saveAssignment
    ? testCloudTransport.saveAssignment(hw)
    : saveAssignmentToFirestore(hw);

const activeSaveSubmissionToCloud = (sub: HomeworkSubmission) =>
  testCloudTransport?.saveSubmission
    ? testCloudTransport.saveSubmission(sub)
    : saveSubmissionToFirestore(sub);

const activeFetchAssignmentFromCloud = (id: string) =>
  testCloudTransport?.fetchAssignment
    ? testCloudTransport.fetchAssignment(id)
    : fetchAssignmentFromFirestore(id);

const activeFetchSubmissionsForAssignmentFromCloud = (id: string) =>
  testCloudTransport?.fetchSubmissionsForAssignment
    ? testCloudTransport.fetchSubmissionsForAssignment(id)
    : fetchSubmissionsForAssignmentFromFirestore(id);

export function saveLocalAssignment(hw: HomeworkAssignment, syncCloud = true): void {
  if (typeof window === 'undefined' || !hw || !hw.id) return;
  if (isAssignmentDeletedLocally(hw.id) || (hw as any).deleted) {
    if (!syncCloud) {
      deleteAssignmentFromFirestore(hw.id).catch(() => {});
      deleteSubmissionsForAssignmentFromFirestore(hw.id).catch(() => {});
    }
    return;
  }
  const existing = getLocalAssignments().find((a) => a.id === hw.id);
  const normalizedHw = normalizeHomeworkAssignment({
    ...existing,
    ...hw
  });
  const initialRecord: HomeworkAssignment = {
    ...normalizedHw,
    cloudSynced: syncCloud ? false : (hw.cloudSynced ?? existing?.cloudSynced ?? true)
  };

  const current = getLocalAssignments().filter((a) => a.id !== hw.id);
  current.unshift(initialRecord);
  writeLocalAssignmentsList(current);

  if (syncCloud) {
    activeSaveAssignmentToCloud(initialRecord)
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
  const normalizedHw = normalizeHomeworkAssignment(hw);
  saveLocalAssignment({ ...normalizedHw, cloudSynced: false }, false);
  const cloudOk = await activeSaveAssignmentToCloud(normalizedHw);
  const finalHw: HomeworkAssignment = {
    ...normalizedHw,
    cloudSynced: cloudOk
  };
  saveLocalAssignment(finalHw, false);
  notifyHomeworkSyncStateChanged();
  return { assignment: finalHw, cloudSynced: cloudOk };
}

export function deleteLocalAssignment(assignmentId: string, syncCloud = true): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  const safeId = sanitizeDocId(assignmentId);
  markAssignmentDeletedLocally(assignmentId);
  try {
    const remainingAssignments = getLocalAssignments().filter(
      (a) => a.id !== assignmentId && sanitizeDocId(a.id) !== safeId
    );
    writeLocalAssignmentsList(remainingAssignments);

    const remainingSubmissions = getLocalSubmissions().filter(
      (s) => s.assignmentId !== assignmentId && sanitizeDocId(s.assignmentId) !== safeId
    );
    writeLocalSubmissionsList(remainingSubmissions);

    window.dispatchEvent(
      new CustomEvent('gluck-homework-deleted', {
        detail: { assignmentId, safeId, remainingAssignments, remainingSubmissions }
      })
    );
    notifyHomeworkSyncStateChanged();
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
    const deletedSet = getDeletedAssignmentIds();
    const active = parsed.filter(
      (s) =>
        s &&
        s.assignmentId &&
        !deletedSet.has(s.assignmentId) &&
        !deletedSet.has(sanitizeDocId(s.assignmentId))
    );
    return deduplicateSubmissions(active);
  } catch {
    return [];
  }
}

function writeLocalSubmissionsList(list: HomeworkSubmission[]): void {
  if (typeof window === 'undefined') return;
  try {
    const deletedSet = getDeletedAssignmentIds();
    const filtered = list.filter(
      (s) =>
        s &&
        s.assignmentId &&
        !deletedSet.has(s.assignmentId) &&
        !deletedSet.has(sanitizeDocId(s.assignmentId))
    );
    localStorage.setItem(
      LOCAL_SUBMISSIONS_KEY,
      JSON.stringify(deduplicateSubmissions(filtered).slice(0, 600))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function saveLocalSubmission(sub: HomeworkSubmission, syncCloud = true): void {
  if (typeof window === 'undefined' || !sub || !sub.id) return;
  if (isAssignmentDeletedLocally(sub.assignmentId)) return;

  // If the assignment exists locally, enforce audienceMode and group membership validation
  const matchingHw = getLocalAssignments().find((a) => a.id === sub.assignmentId);
  let validatedSub: HomeworkSubmission = { ...sub };
  if (matchingHw) {
    const check = validateHomeworkSubmissionIdentity(matchingHw, sub);
    if (!check.valid) {
      // Do not persist invalid/unauthorized submissions against a known assignment
      return;
    }
    validatedSub = {
      ...sub,
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      studentName: check.normalizedStudentName || sub.studentName,
      groupId: check.normalizedGroupId
    };
  }

  const currentAll = getLocalSubmissions();
  const existing = currentAll.find((s) => s.id === validatedSub.id);
  const mergedRecord: HomeworkSubmission = existing
    ? pickBetterSubmission(existing, {
        ...validatedSub,
        cloudSynced: syncCloud ? false : (validatedSub.cloudSynced ?? existing.cloudSynced ?? true)
      })
    : {
        ...validatedSub,
        cloudSynced: syncCloud ? false : (validatedSub.cloudSynced ?? true)
      };

  if (syncCloud) {
    mergedRecord.cloudSynced = false;
  }

  const others = currentAll.filter((s) => s.id !== mergedRecord.id);
  others.unshift(mergedRecord);
  writeLocalSubmissionsList(others);

  if (syncCloud) {
    activeSaveSubmissionToCloud(mergedRecord)
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

export async function saveSubmissionWithConfirmation(
  sub: HomeworkSubmission,
  assignmentContext?: Partial<HomeworkAssignment> | null
): Promise<{
  submission: HomeworkSubmission;
  cloudSynced: boolean;
}> {
  const hw = assignmentContext || getLocalAssignments().find((a) => a.id === sub.assignmentId);
  let normalizedSub: HomeworkSubmission = { ...sub };
  if (hw && hw.id) {
    const validation = validateHomeworkSubmissionIdentity(hw, sub);
    if (!validation.valid) {
      throw new Error(validation.error || 'فشل التحقق من هوية الطالب لهذا الواجب.');
    }
    normalizedSub = {
      ...sub,
      audienceMode: validation.audienceMode,
      studentId: validation.normalizedStudentId,
      participantId: validation.normalizedParticipantId,
      studentName: validation.normalizedStudentName || sub.studentName,
      groupId: validation.normalizedGroupId
    };
  }

  saveLocalSubmission({ ...normalizedSub, cloudSynced: false }, false);
  const cloudOk = await activeSaveSubmissionToCloud(normalizedSub);
  const finalSub: HomeworkSubmission = {
    ...normalizedSub,
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
        const ok = await activeSaveAssignmentToCloud(hw);
        if (ok) {
          syncedAssignments++;
          saveLocalAssignment({ ...hw, cloudSynced: true }, false);
        }
      }
    }

    const localSubs = getLocalSubmissions();
    for (const sub of localSubs) {
      if (sub.cloudSynced === false) {
        const ok = await activeSaveSubmissionToCloud(sub);
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
 * Generates the student/parent homework link using the Vercel public domain.
 * Encodes the audience mode ('am') and group metadata ('gid', 'gn') without exposing student lists.
 */
export function buildHomeworkShareUrl(hw: HomeworkAssignment, overrideDomain?: string): string {
  const baseDomain = (overrideDomain || getVercelPublicDomain()).replace(/\/+$/, '');
  const mode = resolveAssignmentAudienceMode(hw);
  const params = new URLSearchParams();
  params.set('am', mode);
  if (mode === 'group' && hw.groupId) {
    params.set('gid', hw.groupId);
    if (hw.groupName) params.set('gn', hw.groupName);
  }
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
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[]
): Promise<any[]> {
  // 1. Flush any pending local-only writes in the background without blocking UI rendering
  flushPendingHomeworkCloudWrites().catch(() => {});

  // 2. Fetch from Firebase Firestore (Primary Cloud Source of Truth across Main App & Vercel)
  const [cloudAssignments, cloudSubmissions] = await Promise.all([
    fetchAllAssignmentsFromFirestore().catch(() => [] as HomeworkAssignment[]),
    fetchAllSubmissionsFromFirestore().catch(() => [] as HomeworkSubmission[])
  ]);

  cloudAssignments.forEach((hw) => {
    if (isAssignmentDeletedLocally(hw.id) || (hw as any).deleted) {
      deleteAssignmentFromFirestore(hw.id).catch(() => {});
      deleteSubmissionsForAssignmentFromFirestore(hw.id).catch(() => {});
      return;
    }
    saveLocalAssignment({ ...hw, cloudSynced: true }, false);
  });
  cloudSubmissions.forEach((sub) => {
    if (isAssignmentDeletedLocally(sub.assignmentId)) return;
    saveLocalSubmission({ ...sub, cloudSynced: true }, false);
  });

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

  return mergedAssignments.map((rawHw) => {
    const hw = normalizeHomeworkAssignment(rawHw);
    const mode = resolveAssignmentAudienceMode(hw);
    const allHwSubs = mergedSubmissions.filter((s) => s.assignmentId === hw.id);

    if (mode === 'group') {
      const groupRoster = getAuthorizedGroupStudentsForAssignment(hw, rosterStudents);
      const rosterIds = new Set(groupRoster.map((st) => st.id));
      const nameCounts = new Map<string, number>();
      groupRoster.forEach((st) => {
        const key = st.name.trim().toLowerCase();
        nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
      });

      const validGroupSubs = allHwSubs.filter((s) => {
        if (s.studentId && rosterIds.has(s.studentId.trim())) return true;
        if (!s.studentId && !s.participantId) {
          const cleanName = (s.studentName || '').trim().toLowerCase();
          return nameCounts.get(cleanName) === 1;
        }
        return false;
      });

      const resolveSubStudentId = (s: HomeworkSubmission): string => {
        if (s.studentId && rosterIds.has(s.studentId.trim())) return s.studentId.trim();
        const cleanName = (s.studentName || '').trim().toLowerCase();
        const matched = groupRoster.find((st) => st.name.trim().toLowerCase() === cleanName);
        return matched ? matched.id : s.id;
      };

      const completedSubs = validGroupSubs.filter(
        (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
      );
      const inProgressSubs = validGroupSubs.filter((s) => s.status === 'in_progress');

      const uniqueCompletedStudents = new Set(completedSubs.map(resolveSubStudentId));
      const uniqueInProgressStudents = new Set(
        inProgressSubs.map(resolveSubStudentId).filter((id) => !uniqueCompletedStudents.has(id))
      );

      const scoringSubs = completedSubs.length > 0 ? completedSubs : validGroupSubs;
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
        audienceMode: 'group' as HomeworkAudienceMode,
        status: hw.status || (hw.isActive !== false ? 'active' : 'closed'),
        submissionCount: validGroupSubs.length,
        completedStudentsCount: uniqueCompletedStudents.size,
        inProgressStudentsCount: uniqueInProgressStudents.size,
        assignedStudentsCount: groupRoster.length,
        avgAccuracy: avgScore,
        avgScore,
        cloudSynced: hw.cloudSynced !== false,
        recentSubmissions: validGroupSubs
      };
    }

    // Open mode ('open')
    const completedSubs = allHwSubs.filter(
      (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
    );
    const inProgressSubs = allHwSubs.filter((s) => s.status === 'in_progress');

    const uniqueParticipants = new Set(allHwSubs.map((s) => getSubmissionIdentityKey(s)));
    const uniqueCompletedParticipants = new Set(completedSubs.map((s) => getSubmissionIdentityKey(s)));
    const uniqueInProgressParticipants = new Set(
      inProgressSubs
        .map((s) => getSubmissionIdentityKey(s))
        .filter((k) => !uniqueCompletedParticipants.has(k))
    );

    const scoringSubs = completedSubs.length > 0 ? completedSubs : allHwSubs;
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
      audienceMode: 'open' as HomeworkAudienceMode,
      status: hw.status || (hw.isActive !== false ? 'active' : 'closed'),
      submissionCount: allHwSubs.length,
      completedStudentsCount: uniqueCompletedParticipants.size,
      inProgressStudentsCount: uniqueInProgressParticipants.size,
      assignedStudentsCount: uniqueParticipants.size,
      avgAccuracy: avgScore,
      avgScore,
      cloudSynced: hw.cloudSynced !== false,
      recentSubmissions: allHwSubs
    };
  });
}

export function getLocalAssignmentDetails(
  id: string,
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[],
  fallbackHw?: HomeworkAssignment | null
): any | null {
  const safeId = sanitizeDocId(id);
  const rawHw =
    getLocalAssignments().find((a) => a.id === id || sanitizeDocId(a.id) === safeId) ||
    fallbackHw ||
    null;
  if (!rawHw) return null;
  return computeAssignmentDetailsObject(rawHw, rosterStudents);
}

export async function fetchAssignmentDetailsWithSync(
  id: string,
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[],
  fallbackHw?: HomeworkAssignment | null
): Promise<any | null> {
  // 1. Fetch assignment + submissions from Firebase Firestore with fast timeout so UI never hangs
  const withFastTimeout = <T>(p: Promise<T>, fallback: T, ms = 3500): Promise<T> =>
    Promise.race([
      p.catch(() => fallback),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);

  const [cloudHw, cloudSubs] = await Promise.all([
    withFastTimeout(activeFetchAssignmentFromCloud(id), null),
    withFastTimeout(activeFetchSubmissionsForAssignmentFromCloud(id), [] as HomeworkSubmission[])
  ]);

  if (cloudHw && !isAssignmentDeletedLocally(cloudHw.id)) {
    saveLocalAssignment({ ...cloudHw, cloudSynced: true }, false);
  }
  cloudSubs.forEach((sub) => saveLocalSubmission({ ...sub, cloudSynced: true }, false));

  const safeId = sanitizeDocId(id);
  const rawHw =
    cloudHw ||
    getLocalAssignments().find((a) => a.id === id || sanitizeDocId(a.id) === safeId) ||
    fallbackHw ||
    null;
  if (!rawHw) return null;

  return computeAssignmentDetailsObject(rawHw, rosterStudents);
}

function computeAssignmentDetailsObject(
  rawHw: HomeworkAssignment,
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[]
): any {
  const id = rawHw.id;
  const safeId = sanitizeDocId(id);
  const hw = normalizeHomeworkAssignment(rawHw);
  const audienceMode = resolveAssignmentAudienceMode(hw);

  const allDeduplicatedSubs = deduplicateSubmissions(
    getLocalSubmissions().filter(
      (s) => s.assignmentId === id || sanitizeDocId(s.assignmentId) === safeId
    )
  ).map((s) => ({
    ...s,
    score: s.score ?? s.correctAnswersCount ?? 0,
    accuracy: s.accuracy ?? s.scorePercentage ?? s.accuracyPercent ?? 0,
    goldEarned: s.goldEarned ?? (s.correctAnswersCount || s.score || 0) * 100
  }));

  const studentStatusSummary: any[] = [];
  const leaderboardMap = new Map<string, any>();
  let validSubsForStats: HomeworkSubmission[] = [];

  if (audienceMode === 'group') {
    const groupRoster = getAuthorizedGroupStudentsForAssignment(hw, rosterStudents);
    const rosterIds = new Set(groupRoster.map((st) => st.id));
    const nameCounts = new Map<string, number>();
    groupRoster.forEach((st) => {
      const key = st.name.trim().toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    });

    validSubsForStats = allDeduplicatedSubs.filter((s) => {
      if (s.studentId && rosterIds.has(s.studentId.trim())) return true;
      if (!s.studentId && !s.participantId) {
        const cleanName = (s.studentName || '').trim().toLowerCase();
        return nameCounts.get(cleanName) === 1;
      }
      return false;
    });

    for (const st of groupRoster) {
      const stNameLower = st.name.trim().toLowerCase();
      const allowLegacyNameMatch = nameCounts.get(stNameLower) === 1;

      const studentSubs = validSubsForStats
        .filter((s) => {
          if (s.studentId && s.studentId.trim() === st.id) return true;
          if (!s.studentId && !s.participantId && allowLegacyNameMatch) {
            return (s.studentName || '').trim().toLowerCase() === stNameLower;
          }
          return false;
        })
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

      studentStatusSummary.push({
        studentId: st.id,
        studentName: st.name,
        studentCode: st.code,
        groupId: st.groupId || hw.groupId,
        audienceMode: 'group' as HomeworkAudienceMode,
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
      });

      if (bestAttempt && completedAttemptsCount > 0) {
        leaderboardMap.set(`id::${st.id}`, {
          studentId: st.id,
          studentName: st.name,
          bestScore,
          bestAccuracy,
          timeSpentSeconds: bestAttempt.timeSpentSeconds || 0,
          goldEarned: bestAttempt.goldEarned || 0,
          completedAt: bestAttempt.completedAt
        });
      }
    }
  } else {
    // Open mode ('open'): build participant summary strictly from submissions without pulling group rosters
    validSubsForStats = allDeduplicatedSubs;
    const groupedByParticipant = new Map<string, HomeworkSubmission[]>();

    for (const s of validSubsForStats) {
      const pKey = getSubmissionIdentityKey(s);
      const list = groupedByParticipant.get(pKey) || [];
      list.push(s);
      groupedByParticipant.set(pKey, list);
    }

    groupedByParticipant.forEach((participantSubs, pKey) => {
      const sortedSubs = [...participantSubs].sort(
        (a, b) =>
          new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
          new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
      );

      const completedAttempts = sortedSubs.filter(
        (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
      );
      const inProgressAttempts = sortedSubs.filter((s) => s.status === 'in_progress');

      const status: 'not_started' | 'in_progress' | 'completed' =
        completedAttempts.length > 0 ? 'completed' : 'in_progress';

      const attemptsCount = sortedSubs.length;
      const completedAttemptsCount = completedAttempts.length;
      const sortedByBest = [...(completedAttempts.length > 0 ? completedAttempts : sortedSubs)].sort(
        (a, b) =>
          (b.scorePercentage ?? b.accuracy ?? 0) - (a.scorePercentage ?? a.accuracy ?? 0) ||
          (a.timeSpentSeconds || 999999) - (b.timeSpentSeconds || 999999)
      );
      const bestAttempt = sortedByBest[0] || null;
      const latestAttempt = sortedSubs[0] || null;
      const activeInProgressAttempt = inProgressAttempts[0] || null;

      const participantName = (latestAttempt?.studentName || bestAttempt?.studentName || 'مشارك').trim();
      const participantIdentifier =
        latestAttempt?.participantId || latestAttempt?.studentId || pKey;

      const bestScore = bestAttempt ? (bestAttempt.scorePercentage ?? bestAttempt.accuracy ?? 0) : 0;
      const latestScore = latestAttempt ? (latestAttempt.scorePercentage ?? latestAttempt.accuracy ?? 0) : 0;
      const bestCorrectCount = bestAttempt ? (bestAttempt.correctAnswersCount ?? bestAttempt.score ?? 0) : 0;
      const latestCorrectCount = latestAttempt ? (latestAttempt.correctAnswersCount ?? latestAttempt.score ?? 0) : 0;
      const totalQuestions =
        latestAttempt?.totalQuestions || hw.questionCount || hw.targetQuestionCount || 0;
      const answeredCount = latestAttempt?.responses?.length || 0;
      const bestAccuracy = bestAttempt ? (bestAttempt.accuracyPercent ?? bestAttempt.accuracy ?? bestScore) : 0;
      const totalTimeSpent = sortedSubs.reduce((acc, c) => acc + (c.timeSpentSeconds || 0), 0);
      const latestTimeSpent = latestAttempt?.timeSpentSeconds || 0;
      const lastActivity = latestAttempt
        ? latestAttempt.updatedAt || latestAttempt.completedAt || latestAttempt.startedAt
        : null;
      const allSynced = sortedSubs.every((s) => s.cloudSynced !== false);

      studentStatusSummary.push({
        studentId: participantIdentifier,
        participantId: latestAttempt?.participantId,
        studentName: participantName,
        audienceMode: 'open' as HomeworkAudienceMode,
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
        attempts: sortedSubs
      });

      if (bestAttempt && completedAttemptsCount > 0) {
        leaderboardMap.set(pKey, {
          studentId: participantIdentifier,
          studentName: participantName,
          bestScore,
          bestAccuracy,
          timeSpentSeconds: bestAttempt.timeSpentSeconds || 0,
          goldEarned: bestAttempt.goldEarned || 0,
          completedAt: bestAttempt.completedAt
        });
      }
    });
  }

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

  validSubsForStats.forEach((sub) => {
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

  const totalAssigned = studentStatusSummary.length;
  const completedCount = studentStatusSummary.filter((s) => s.status === 'completed').length;
  const inProgressCount = studentStatusSummary.filter((s) => s.status === 'in_progress').length;
  const notStartedCount = studentStatusSummary.filter((s) => s.status === 'not_started').length;
  const completionPercentage =
    totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  const completedSubsList = validSubsForStats.filter(
    (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
  );
  const scoringPool = completedSubsList.length > 0 ? completedSubsList : validSubsForStats;
  const averageScorePercentage =
    scoringPool.length > 0
      ? Math.round(
          scoringPool.reduce((acc, s) => acc + (s.scorePercentage ?? s.accuracy ?? 0), 0) /
            scoringPool.length
        )
      : 0;

  return {
    assignment: hw,
    submissions: validSubsForStats,
    studentStatusSummary,
    officialLeaderboard,
    questionAccuracy,
    metrics: {
      totalAssigned,
      completedCount,
      inProgressCount,
      notStartedCount,
      completionPercentage,
      totalAttemptsCount: validSubsForStats.length,
      averageScorePercentage
    }
  };
}

