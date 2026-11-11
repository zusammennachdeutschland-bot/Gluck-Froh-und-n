import {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkQuestionType,
  HomeworkAudienceMode,
  AssignedStudentSnapshot,
  DEFAULT_HOMEWORK_QUESTION_TYPES
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
  subscribeTeacherAuth,
  getCurrentHomeworkOwnerUid,
  getCurrentHomeworkOwnerEmail,
  __setHomeworkAuthUserForTests
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
  subscribeTeacherAuth,
  getCurrentHomeworkOwnerUid,
  getCurrentHomeworkOwnerEmail,
  __setHomeworkAuthUserForTests
};

export const LEGACY_ASSIGNMENTS_KEY = 'glueck_hw_assignments_v2';
export const LEGACY_SUBMISSIONS_KEY = 'glueck_hw_submissions_v2';
export const LEGACY_DELETED_ASSIGNMENTS_KEY = 'glueck_hw_deleted_ids_v2';
export const QUARANTINED_LEGACY_HOMEWORK_KEY = 'glueck_hw_quarantined_legacy_v3';
export const UNAUTHENTICATED_HOMEWORK_SCOPE = 'local_unauthenticated';
const OPEN_PARTICIPANT_PREFIX = 'glueck_hw_open_pid_';
const STUDENT_DEVICE_TOKEN_PREFIX = 'glueck_hw_dev_tok_';
const STUDENT_ATTEMPT_SECRET_PREFIX = 'glueck_hw_att_sec_';

export function isHomeworkAssignmentOpenForStudents(
  hw: Partial<HomeworkAssignment> | null | undefined
): boolean {
  if (!hw || !hw.id) return false;
  if ((hw as any).deleted) return false;
  if (hw.isActive === false) return false;
  if (hw.status === 'closed') return false;
  return true;
}

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
 * Generates or retrieves a per-device student session token for (assignmentId, studentToken)
 * so two different devices cannot collide on the same deterministic submission document ID,
 * while the same student device produces consistent IDs across live progress and retries.
 */
export function getOrCreateStudentDeviceToken(
  assignmentId: string,
  studentToken: string
): string {
  const safeHw = sanitizeDocId(assignmentId || 'hw').slice(0, 32);
  const safeSt = sanitizeDocId(studentToken || 'st').slice(0, 32);
  const storageKey = `${STUDENT_DEVICE_TOKEN_PREFIX}${safeHw}_${safeSt}`;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing && existing.trim()) {
        return existing.trim();
      }
      const generated = `dt${Date.now().toString(36).slice(-4)}${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      window.localStorage.setItem(storageKey, generated);
      return generated;
    } catch {
      // Fall through if localStorage is unavailable
    }
  }
  return `dt${ simpleStringHash(`${safeHw}_${safeSt}`) }`;
}

/**
 * Generates or retrieves a per-attempt secret token stored on the originating student device.
 * Used by Firestore rules and backend endpoints to verify that in-progress updates originate
 * from the same student session that created the submission attempt.
 */
export function getOrCreateStudentAttemptSecret(submissionId: string): string {
  const safeSubId = sanitizeDocId(submissionId || 'sub').slice(0, 80);
  const storageKey = `${STUDENT_ATTEMPT_SECRET_PREFIX}${safeSubId}`;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing && existing.trim()) {
        return existing.trim();
      }
      const generated = `sec_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(storageKey, generated);
      return generated;
    } catch {
      // Fall through if localStorage is unavailable
    }
  }
  return `sec_${simpleStringHash(safeSubId)}_fallback`;
}

/**
 * Generates a deterministic submission ID per (assignmentId, studentId/participantId, deviceToken, attemptNumber)
 * so live in-progress updates, retries, and final completion update the exact same document
 * without creating duplicate submissions or allowing another device to overwrite a student's submission.
 */
export function buildDeterministicSubmissionId(
  assignmentId: string,
  studentId: string | undefined,
  studentName: string,
  attemptNumber: number,
  participantId?: string
): string {
  const safeHw = sanitizeDocId(assignmentId).slice(0, 36);
  const rawKey =
    studentId && studentId.trim()
      ? `sid_${studentId.trim()}`
      : participantId && participantId.trim()
      ? `pid_${participantId.trim()}`
      : (studentName || 'student').trim().toLowerCase();
  const safeAscii = rawKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const hashPart = simpleStringHash(rawKey);
  const studentToken = safeAscii ? `${safeAscii}_${hashPart}` : `st_${hashPart}`;
  const devToken = getOrCreateStudentDeviceToken(safeHw, studentToken);
  const att = Math.max(1, Number(attemptNumber) || 1);
  return sanitizeDocId(`sub_${safeHw}_${studentToken}_${devToken}_a${att}`);
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

export function getActiveHomeworkScopeUid(explicitUid?: string | null): string {
  if (explicitUid !== undefined) {
    const clean = explicitUid?.trim() || '';
    return clean.length > 0 ? clean : UNAUTHENTICATED_HOMEWORK_SCOPE;
  }
  const activeUid = getCurrentHomeworkOwnerUid();
  return activeUid || UNAUTHENTICATED_HOMEWORK_SCOPE;
}

export function getAssignmentsStorageKey(explicitUid?: string | null): string {
  const scope = sanitizeDocId(getActiveHomeworkScopeUid(explicitUid));
  return `glueck_hw_assignments_v3_${scope}`;
}

export function getSubmissionsStorageKey(explicitUid?: string | null): string {
  const scope = sanitizeDocId(getActiveHomeworkScopeUid(explicitUid));
  return `glueck_hw_submissions_v3_${scope}`;
}

export function getDeletedAssignmentsStorageKey(explicitUid?: string | null): string {
  const scope = sanitizeDocId(getActiveHomeworkScopeUid(explicitUid));
  return `glueck_hw_deleted_ids_v3_${scope}`;
}

export interface LegacyHomeworkMigrationOptions {
  uid: string;
  email?: string | null;
  ownedGroupIds?: Iterable<string>;
  ownedSetIds?: Iterable<string>;
  ownedStudentIds?: Iterable<string>;
}

export interface QuarantinedLegacyHomeworkEntry {
  assignment: HomeworkAssignment;
  submissions: HomeworkSubmission[];
  reason: string;
  quarantinedAt: string;
}

export function getQuarantinedLegacyHomework(): QuarantinedLegacyHomeworkEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUARANTINED_LEGACY_HOMEWORK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Deterministic ownership evaluator used by local legacy migration, cloud legacy backfill,
 * and backup import verification. Never guesses or claims ownership based on first login.
 */
export function canAccountClaimLegacyHomework(
  hw: Partial<HomeworkAssignment> | null | undefined,
  options: LegacyHomeworkMigrationOptions
): {
  provableForTarget: boolean;
  belongsToDifferentAccount: boolean;
} {
  if (!hw || !hw.id || !options?.uid?.trim()) {
    return { provableForTarget: false, belongsToDifferentAccount: false };
  }
  const targetUid = options.uid.trim();
  const targetEmail = (options.email || '').trim().toLowerCase();
  const groupSet = new Set(Array.from(options.ownedGroupIds || []).map((id) => id.trim()).filter(Boolean));
  const setIds = new Set(Array.from(options.ownedSetIds || []).map((id) => id.trim()).filter(Boolean));
  const studentIds = new Set(Array.from(options.ownedStudentIds || []).map((id) => id.trim()).filter(Boolean));

  const recUid = (hw.ownerUid || '').trim();
  const recEmail = (hw.ownerEmail || '').trim().toLowerCase();

  if (recUid) {
    if (recUid === targetUid) {
      return { provableForTarget: true, belongsToDifferentAccount: false };
    }
    return { provableForTarget: false, belongsToDifferentAccount: true };
  }

  if (recEmail) {
    if (targetEmail && recEmail === targetEmail) {
      return { provableForTarget: true, belongsToDifferentAccount: false };
    }
    return { provableForTarget: false, belongsToDifferentAccount: true };
  }

  const hwGroupId = (hw.groupId || '').trim();
  const hwSetId = (hw.setSnapshot?.id ? String(hw.setSnapshot.id) : '').trim();
  const hwStudents = Array.isArray(hw.assignedStudents) ? hw.assignedStudents : [];

  const matchesGroup = Boolean(hwGroupId && hwGroupId !== 'all' && groupSet.has(hwGroupId));
  const matchesSet = Boolean(hwSetId && setIds.has(hwSetId));
  const matchesStudents =
    hwStudents.length > 0 &&
    hwStudents.every((st) => st?.id && studentIds.has(String(st.id).trim()));

  if (matchesGroup || matchesSet || matchesStudents) {
    return { provableForTarget: true, belongsToDifferentAccount: false };
  }

  return { provableForTarget: false, belongsToDifferentAccount: false };
}

/**
 * Safely inspects legacy unscoped homework keys (`glueck_hw_assignments_v2` / `glueck_hw_submissions_v2`).
 * Never blindly assigns legacy homework to whichever account logs in first.
 * Only migrates a legacy assignment to `options.uid` if ownership can be deterministically proven via:
 * 1. Matching `ownerUid`
 * 2. Matching verified email (`ownerEmail`) when `ownerUid` is absent
 * 3. Matching workspace entity ownership (`groupId`, `setSnapshot.id`, or `assignedStudents`) when both `ownerUid` and `ownerEmail` are absent.
 * Ambiguous records are non-destructively isolated in `glueck_hw_quarantined_legacy_v3` and never exposed or uploaded to another account.
 */
export function migrateLegacyHomeworkForAccount(options: LegacyHomeworkMigrationOptions): {
  migratedAssignments: number;
  migratedSubmissions: number;
  quarantinedAssignments: number;
} {
  if (typeof window === 'undefined' || !options?.uid?.trim()) {
    return { migratedAssignments: 0, migratedSubmissions: 0, quarantinedAssignments: 0 };
  }
  const targetUid = options.uid.trim();
  const targetEmail = (options.email || '').trim().toLowerCase();

  try {
    const rawLegacyHw = localStorage.getItem(LEGACY_ASSIGNMENTS_KEY);
    if (!rawLegacyHw) {
      return { migratedAssignments: 0, migratedSubmissions: 0, quarantinedAssignments: 0 };
    }
    const legacyAssignments: HomeworkAssignment[] = JSON.parse(rawLegacyHw);
    if (!Array.isArray(legacyAssignments) || legacyAssignments.length === 0) {
      return { migratedAssignments: 0, migratedSubmissions: 0, quarantinedAssignments: 0 };
    }

    const rawLegacySubs = localStorage.getItem(LEGACY_SUBMISSIONS_KEY);
    const legacySubmissions: HomeworkSubmission[] = rawLegacySubs ? JSON.parse(rawLegacySubs) : [];
    const safeLegacySubs = Array.isArray(legacySubmissions) ? legacySubmissions : [];

    const existingScopedHw = getLocalAssignments(targetUid);
    const existingScopedHwIds = new Set(existingScopedHw.map((a) => a.id));
    const existingScopedSubs = getLocalSubmissions(targetUid);
    const existingScopedSubIds = new Set(existingScopedSubs.map((s) => s.id));

    const quarantinedList = getQuarantinedLegacyHomework();
    const quarantinedById = new Map<string, QuarantinedLegacyHomeworkEntry>(
      quarantinedList.map((entry) => [entry.assignment.id, entry])
    );

    const remainingLegacyHw: HomeworkAssignment[] = [];
    const migratedHwIds = new Set<string>();
    let migratedAssignments = 0;
    let migratedSubmissions = 0;
    let quarantinedAssignments = 0;

    for (const hw of legacyAssignments) {
      if (!hw || !hw.id) continue;
      const { provableForTarget, belongsToDifferentAccount } = canAccountClaimLegacyHomework(hw, options);

      if (provableForTarget) {
        const neededBackfill = (hw.ownerUid || '').trim() !== targetUid;
        const stampedHw: HomeworkAssignment = normalizeHomeworkAssignment({
          ...hw,
          ownerUid: targetUid,
          ...(targetEmail && !hw.ownerEmail ? { ownerEmail: targetEmail } : {}),
          cloudSynced: neededBackfill ? false : hw.cloudSynced
        });
        if (!existingScopedHwIds.has(stampedHw.id)) {
          existingScopedHw.push(stampedHw);
          existingScopedHwIds.add(stampedHw.id);
          migratedAssignments++;
        }
        migratedHwIds.add(hw.id);
        migratedHwIds.add(sanitizeDocId(hw.id));
        quarantinedById.delete(hw.id);
      } else if (belongsToDifferentAccount) {
        // Keep in legacy store for the actual owner account when they sign in; do NOT expose to targetUid
        remainingLegacyHw.push(hw);
      } else {
        // Ambiguous unowned record: quarantine so it is never blindly claimed or leaked across accounts
        const relatedSubs = safeLegacySubs.filter(
          (s) => s && (s.assignmentId === hw.id || sanitizeDocId(s.assignmentId) === sanitizeDocId(hw.id))
        );
        if (!quarantinedById.has(hw.id)) {
          quarantinedAssignments++;
        }
        quarantinedById.set(hw.id, {
          assignment: hw,
          submissions: relatedSubs,
          reason: 'Ambiguous legacy homework without provable ownerUid, ownerEmail, or workspace entity match',
          quarantinedAt: new Date().toISOString()
        });
      }
    }

    if (migratedHwIds.size > 0) {
      const remainingLegacySubs: HomeworkSubmission[] = [];
      for (const sub of safeLegacySubs) {
        if (!sub || !sub.id || !sub.assignmentId) continue;
        if (
          migratedHwIds.has(sub.assignmentId) ||
          migratedHwIds.has(sanitizeDocId(sub.assignmentId))
        ) {
          const neededSubBackfill = (sub.ownerUid || '').trim() !== targetUid;
          const stampedSub: HomeworkSubmission = {
            ...sub,
            ownerUid: targetUid,
            cloudSynced: neededSubBackfill ? false : sub.cloudSynced
          };
          if (!existingScopedSubIds.has(stampedSub.id)) {
            existingScopedSubs.push(stampedSub);
            existingScopedSubIds.add(stampedSub.id);
            migratedSubmissions++;
          }
        } else {
          remainingLegacySubs.push(sub);
        }
      }
      writeLocalAssignmentsList(existingScopedHw, targetUid);
      writeLocalSubmissionsList(existingScopedSubs, targetUid);
      localStorage.setItem(LEGACY_SUBMISSIONS_KEY, JSON.stringify(remainingLegacySubs));
    }

    localStorage.setItem(LEGACY_ASSIGNMENTS_KEY, JSON.stringify(remainingLegacyHw));
    localStorage.setItem(
      QUARANTINED_LEGACY_HOMEWORK_KEY,
      JSON.stringify(Array.from(quarantinedById.values()))
    );

    return { migratedAssignments, migratedSubmissions, quarantinedAssignments };
  } catch {
    return { migratedAssignments: 0, migratedSubmissions: 0, quarantinedAssignments: 0 };
  }
}

export function getDeletedAssignmentIds(explicitUid?: string | null): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const key = getDeletedAssignmentsStorageKey(explicitUid);
    const raw = localStorage.getItem(key);
    const parsed: string[] = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id.length > 0) : []);
  } catch {
    return new Set();
  }
}

export function isAssignmentDeletedLocally(assignmentId?: string | null, explicitUid?: string | null): boolean {
  if (!assignmentId) return false;
  const deletedSet = getDeletedAssignmentIds(explicitUid);
  if (deletedSet.has(assignmentId)) return true;
  const safeId = sanitizeDocId(assignmentId);
  return deletedSet.has(safeId);
}

export function markAssignmentDeletedLocally(assignmentId: string, explicitUid?: string | null): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    const key = getDeletedAssignmentsStorageKey(explicitUid);
    const deletedSet = getDeletedAssignmentIds(explicitUid);
    deletedSet.add(assignmentId);
    deletedSet.add(sanitizeDocId(assignmentId));
    const list = Array.from(deletedSet).slice(-500);
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

export function getLocalAssignments(explicitUid?: string | null): HomeworkAssignment[] {
  if (typeof window === 'undefined') return [];
  try {
    const scopeUid = getActiveHomeworkScopeUid(explicitUid);
    const isAuthenticatedScope = scopeUid !== UNAUTHENTICATED_HOMEWORK_SCOPE;
    const raw = localStorage.getItem(getAssignmentsStorageKey(scopeUid));
    const parsed: HomeworkAssignment[] = raw ? JSON.parse(raw) : [];
    const deletedSet = getDeletedAssignmentIds(scopeUid);
    return parsed
      .filter((hw) => {
        if (!hw || !hw.id || (hw as any).deleted) return false;
        if (deletedSet.has(hw.id) || deletedSet.has(sanitizeDocId(hw.id))) return false;
        const recOwner = hw.ownerUid?.trim() || '';
        // Strict cross-account guard: never return a record belonging to another UID
        if (isAuthenticatedScope) {
          if (recOwner && recOwner !== scopeUid) return false;
        }
        return true;
      })
      .map((hw) =>
        normalizeHomeworkAssignment({
          ...hw,
          ...(isAuthenticatedScope && !hw.ownerUid ? { ownerUid: scopeUid } : {})
        })
      );
  } catch {
    return [];
  }
}

export function writeLocalAssignmentsForScope(
  list: HomeworkAssignment[],
  explicitUid?: string | null
): void {
  writeLocalAssignmentsList(list, explicitUid);
}

function writeLocalAssignmentsList(list: HomeworkAssignment[], explicitUid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const scopeUid = getActiveHomeworkScopeUid(explicitUid);
    const isAuthenticatedScope = scopeUid !== UNAUTHENTICATED_HOMEWORK_SCOPE;
    const deletedSet = getDeletedAssignmentIds(scopeUid);
    const normalized = list
      .filter((hw) => {
        if (!hw || !hw.id || (hw as any).deleted) return false;
        if (deletedSet.has(hw.id) || deletedSet.has(sanitizeDocId(hw.id))) return false;
        const recOwner = hw.ownerUid?.trim() || '';
        if (isAuthenticatedScope && recOwner && recOwner !== scopeUid) {
          return false;
        }
        return true;
      })
      .slice(0, 150)
      .map((hw) =>
        normalizeHomeworkAssignment({
          ...hw,
          ...(isAuthenticatedScope ? { ownerUid: scopeUid } : {})
        })
      );
    localStorage.setItem(getAssignmentsStorageKey(scopeUid), JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors
  }
}

export interface HomeworkCloudTransportOverride {
  saveAssignment?: (hw: HomeworkAssignment) => Promise<boolean>;
  saveSubmission?: (sub: HomeworkSubmission) => Promise<boolean>;
  fetchAssignment?: (id: string) => Promise<HomeworkAssignment | null>;
  fetchSubmissionsForAssignment?: (id: string) => Promise<HomeworkSubmission[]>;
  fetchAllAssignments?: (ownerUid?: string) => Promise<HomeworkAssignment[]>;
  fetchAllSubmissions?: (ownerUid?: string) => Promise<HomeworkSubmission[]>;
  deleteAssignment?: (id: string, ownerUid?: string) => Promise<boolean>;
  deleteSubmissionsForAssignment?: (id: string, ownerUid?: string) => Promise<boolean>;
}

let testCloudTransport: HomeworkCloudTransportOverride | null = null;

export function __setHomeworkSyncTransportForTests(
  transport: HomeworkCloudTransportOverride | null
): void {
  testCloudTransport = transport;
}

const activeSaveAssignmentToCloud = (hw: HomeworkAssignment) => {
  const activeUid = getCurrentHomeworkOwnerUid();
  if (activeUid && hw.ownerUid && hw.ownerUid.trim() !== '' && hw.ownerUid.trim() !== activeUid) {
    return Promise.resolve(false);
  }
  return testCloudTransport?.saveAssignment
    ? testCloudTransport.saveAssignment(hw)
    : saveAssignmentToFirestore(hw);
};

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

const activeFetchAllAssignmentsFromCloud = (ownerUid?: string) =>
  testCloudTransport?.fetchAllAssignments
    ? testCloudTransport.fetchAllAssignments(ownerUid)
    : fetchAllAssignmentsFromFirestore(ownerUid);

const activeFetchAllSubmissionsFromCloud = (ownerUid?: string) =>
  testCloudTransport?.fetchAllSubmissions
    ? testCloudTransport.fetchAllSubmissions(ownerUid)
    : fetchAllSubmissionsFromFirestore(ownerUid);

const activeDeleteAssignmentFromCloud = (id: string, ownerUid?: string) =>
  testCloudTransport?.deleteAssignment
    ? testCloudTransport.deleteAssignment(id, ownerUid)
    : deleteAssignmentFromFirestore(id, ownerUid);

const activeDeleteSubmissionsForAssignmentFromCloud = (id: string, ownerUid?: string) =>
  testCloudTransport?.deleteSubmissionsForAssignment
    ? testCloudTransport.deleteSubmissionsForAssignment(id, ownerUid)
    : deleteSubmissionsForAssignmentFromFirestore(id, ownerUid);

export function saveLocalAssignment(hw: HomeworkAssignment, syncCloud = true): void {
  if (typeof window === 'undefined' || !hw || !hw.id) return;
  const activeUid = getCurrentHomeworkOwnerUid();
  const scopeUid = getActiveHomeworkScopeUid();
  const recordOwnerUid = hw.ownerUid?.trim() || '';

  // Reject cross-account writes: Account B can never save or overwrite an assignment owned by Account A
  if (activeUid && recordOwnerUid && recordOwnerUid !== activeUid) {
    return;
  }

  if ((hw as any).deleted) { deleteLocalAssignment(hw.id, false); return; }
  if (isAssignmentDeletedLocally(hw.id, scopeUid)) return;

  const currentList = getLocalAssignments(scopeUid);
  const existing = currentList.find((a) => a.id === hw.id);
  // Prevent mutating ownerUid on an already-owned assignment
  if (existing?.ownerUid && recordOwnerUid && existing.ownerUid !== recordOwnerUid) {
    return;
  }

  const resolvedOwnerUid = activeUid || recordOwnerUid || existing?.ownerUid || undefined;
  const resolvedOwnerEmail =
    hw.ownerEmail?.trim() || getCurrentHomeworkOwnerEmail() || existing?.ownerEmail || undefined;

  const normalizedHw = normalizeHomeworkAssignment({
    ...existing,
    ...hw,
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    ...(resolvedOwnerEmail ? { ownerEmail: resolvedOwnerEmail } : {})
  });
  const initialRecord: HomeworkAssignment = {
    ...normalizedHw,
    cloudSynced: syncCloud ? false : (hw.cloudSynced ?? existing?.cloudSynced ?? true)
  };

  const current = currentList.filter((a) => a.id !== hw.id);
  current.unshift(initialRecord);
  writeLocalAssignmentsList(current, scopeUid);

  if (syncCloud) {
    const scopeAtStart = scopeUid;
    activeSaveAssignmentToCloud(initialRecord)
      .then((ok) => {
        if (!ok) return;
        // Abort if account switched while cloud write was in flight
        if (getActiveHomeworkScopeUid() !== scopeAtStart) return;
        const updated = getLocalAssignments(scopeAtStart).map((a) =>
          a.id === hw.id ? { ...a, cloudSynced: true } : a
        );
        writeLocalAssignmentsList(updated, scopeAtStart);
        notifyHomeworkSyncStateChanged();
      })
      .catch(() => {});
  }
}

export async function saveAssignmentWithConfirmation(hw: HomeworkAssignment): Promise<{
  assignment: HomeworkAssignment;
  cloudSynced: boolean;
}> {
  const activeUid = getCurrentHomeworkOwnerUid();
  const scopeAtStart = getActiveHomeworkScopeUid();
  const recordOwnerUid = hw.ownerUid?.trim() || '';

  if (activeUid && recordOwnerUid && recordOwnerUid !== activeUid) {
    throw new Error('لا يمكن حفظ أو تعديل واجب تابع لحساب آخر.');
  }

  const existing = getLocalAssignments(scopeAtStart).find((a) => a.id === hw.id);
  if (existing?.ownerUid && recordOwnerUid && existing.ownerUid !== recordOwnerUid) {
    throw new Error('لا يمكن تغيير ملكية الواجب بعد إنشائه.');
  }

  const resolvedOwnerUid = activeUid || recordOwnerUid || existing?.ownerUid || undefined;
  const resolvedOwnerEmail =
    hw.ownerEmail?.trim() || getCurrentHomeworkOwnerEmail() || existing?.ownerEmail || undefined;

  const normalizedHw = normalizeHomeworkAssignment({
    ...existing,
    ...hw,
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    ...(resolvedOwnerEmail ? { ownerEmail: resolvedOwnerEmail } : {})
  });

  saveLocalAssignment({ ...normalizedHw, cloudSynced: false }, false);
  const cloudOk = await activeSaveAssignmentToCloud(normalizedHw);
  const finalHw: HomeworkAssignment = {
    ...normalizedHw,
    cloudSynced: cloudOk
  };
  if (getActiveHomeworkScopeUid() === scopeAtStart) {
    saveLocalAssignment(finalHw, false);
    notifyHomeworkSyncStateChanged();
  }
  return { assignment: finalHw, cloudSynced: cloudOk };
}

export function deleteLocalAssignment(assignmentId: string, syncCloud = true): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  const activeUid = getCurrentHomeworkOwnerUid();
  const scopeUid = getActiveHomeworkScopeUid();
  const safeId = sanitizeDocId(assignmentId);

  const existing = getLocalAssignments(scopeUid).find(
    (a) => a.id === assignmentId || sanitizeDocId(a.id) === safeId
  );
  if (activeUid && existing?.ownerUid && existing.ownerUid !== activeUid) {
    return;
  }

  markAssignmentDeletedLocally(assignmentId, scopeUid);
  try {
    const remainingAssignments = getLocalAssignments(scopeUid).filter(
      (a) => a.id !== assignmentId && sanitizeDocId(a.id) !== safeId
    );
    writeLocalAssignmentsList(remainingAssignments, scopeUid);

    const remainingSubmissions = getLocalSubmissions(scopeUid).filter(
      (s) => s.assignmentId !== assignmentId && sanitizeDocId(s.assignmentId) !== safeId
    );
    writeLocalSubmissionsList(remainingSubmissions, scopeUid);

    window.dispatchEvent(
      new CustomEvent('gluck-homework-deleted', {
        detail: { assignmentId, safeId, remainingAssignments, remainingSubmissions, ownerUid: activeUid }
      })
    );
    notifyHomeworkSyncStateChanged();
  } catch {
    // Ignore storage errors
  }
  if (syncCloud) {
    activeDeleteAssignmentFromCloud(assignmentId, activeUid || undefined).catch(() => {});
    activeDeleteSubmissionsForAssignmentFromCloud(assignmentId, activeUid || undefined).catch(() => {});
  }
}

export function getLocalSubmissions(explicitUid?: string | null): HomeworkSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const scopeUid = getActiveHomeworkScopeUid(explicitUid);
    const isAuthenticatedScope = scopeUid !== UNAUTHENTICATED_HOMEWORK_SCOPE;
    const raw = localStorage.getItem(getSubmissionsStorageKey(scopeUid));
    const parsed: HomeworkSubmission[] = raw ? JSON.parse(raw) : [];
    const deletedSet = getDeletedAssignmentIds(scopeUid);
    const active = parsed.filter((s) => {
      if (!s || !s.assignmentId) return false;
      if (deletedSet.has(s.assignmentId) || deletedSet.has(sanitizeDocId(s.assignmentId))) return false;
      const recOwner = s.ownerUid?.trim() || '';
      if (isAuthenticatedScope && recOwner !== scopeUid) {
        return false;
      }
      return true;
    });
    return deduplicateSubmissions(active);
  } catch {
    return [];
  }
}

export function writeLocalSubmissionsForScope(
  list: HomeworkSubmission[],
  explicitUid?: string | null
): void {
  writeLocalSubmissionsList(list, explicitUid);
}

function writeLocalSubmissionsList(list: HomeworkSubmission[], explicitUid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const scopeUid = getActiveHomeworkScopeUid(explicitUid);
    const isAuthenticatedScope = scopeUid !== UNAUTHENTICATED_HOMEWORK_SCOPE;
    const deletedSet = getDeletedAssignmentIds(scopeUid);
    const filtered = list.filter((s) => {
      if (!s || !s.assignmentId) return false;
      if (deletedSet.has(s.assignmentId) || deletedSet.has(sanitizeDocId(s.assignmentId))) return false;
      const recOwner = s.ownerUid?.trim() || '';
      if (isAuthenticatedScope && recOwner !== scopeUid) {
        return false;
      }
      return true;
    });
    localStorage.setItem(
      getSubmissionsStorageKey(scopeUid),
      JSON.stringify(deduplicateSubmissions(filtered).slice(0, 600))
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Returns local submissions visible to a student on this device for a specific assignment,
 * merging the unauthenticated student scope and any known assignment ownerUid scope.
 */
export function getStudentLocalSubmissions(
  assignmentId?: string,
  ownerUidHint?: string | null
): HomeworkSubmission[] {
  const unauthSubs = getLocalSubmissions(UNAUTHENTICATED_HOMEWORK_SCOPE);
  const activeScope = getActiveHomeworkScopeUid();
  const activeSubs =
    activeScope !== UNAUTHENTICATED_HOMEWORK_SCOPE ? getLocalSubmissions(activeScope) : [];
  const ownerSubs =
    ownerUidHint &&
    ownerUidHint.trim() &&
    ownerUidHint.trim() !== UNAUTHENTICATED_HOMEWORK_SCOPE &&
    ownerUidHint.trim() !== activeScope
      ? getLocalSubmissions(ownerUidHint.trim())
      : [];

  const merged = deduplicateSubmissions([...unauthSubs, ...activeSubs, ...ownerSubs]);
  if (!assignmentId) return merged;
  const safeId = sanitizeDocId(assignmentId);
  return merged.filter(
    (s) => s.assignmentId === assignmentId || sanitizeDocId(s.assignmentId) === safeId
  );
}

export function saveLocalSubmission(sub: HomeworkSubmission, syncCloud = true): void {
  if (typeof window === 'undefined' || !sub || !sub.id) return;
  const activeUid = getCurrentHomeworkOwnerUid();
  const subOwnerUid = sub.ownerUid?.trim() || '';

  // Determine the target storage scope: if submission explicitly belongs to a teacher UID, scope to that UID
  const targetScopeUid = subOwnerUid || getActiveHomeworkScopeUid();
  if (isAssignmentDeletedLocally(sub.assignmentId, targetScopeUid)) return;

  // Look up assignment in the target scope
  const matchingHw = getLocalAssignments(targetScopeUid).find(
    (a) => a.id === sub.assignmentId || sanitizeDocId(a.id) === sanitizeDocId(sub.assignmentId)
  );
  // If we are in an authenticated teacher session and the submission belongs to a different teacher, do NOT pollute activeUid's local store
  if (activeUid && matchingHw?.ownerUid && matchingHw.ownerUid !== activeUid) {
    return;
  }

  // V-05: Reject new/updated student submissions to inactive or closed assignments
  if (matchingHw && !isHomeworkAssignmentOpenForStudents(matchingHw) && syncCloud) {
    return;
  }

  const resolvedOwnerUid =
    subOwnerUid || matchingHw?.ownerUid?.trim() || activeUid || undefined;

  const storageScope = resolvedOwnerUid || targetScopeUid;
  const currentAll = getLocalSubmissions(storageScope);
  const unauthAll = !activeUid ? getLocalSubmissions(UNAUTHENTICATED_HOMEWORK_SCOPE) : [];
  const existing =
    currentAll.find((s) => s.id === sub.id) ||
    unauthAll.find((s) => s.id === sub.id);

  // V-01: Enforce submission immutability & anti-spoofing on existing submission IDs
  if (existing) {
    const existingName = (existing.studentName || '').trim().toLowerCase();
    const incomingName = (sub.studentName || '').trim().toLowerCase();
    if (existingName && incomingName && existingName !== incomingName) {
      return;
    }
    if (existing.attemptSecret && sub.attemptSecret && existing.attemptSecret !== sub.attemptSecret) {
      return;
    }
    const existingIsCompleted =
      existing.status === 'completed' || (!existing.status && Boolean(existing.completedAt));
    if (existingIsCompleted) {
      const incomingIsCompleted =
        sub.status === 'completed' || (!sub.status && Boolean(sub.completedAt));
      // Never allow a completed submission to be downgraded or overwritten with different answers/scores
      if (!incomingIsCompleted) {
        return;
      }
      if (
        existing.score !== sub.score ||
        existing.completedAt !== sub.completedAt ||
        (Array.isArray(existing.responses) ? existing.responses.length : 0) !==
          (Array.isArray(sub.responses) ? sub.responses.length : 0)
      ) {
        return;
      }
    }
  }

  const resolvedAttemptSecret =
    sub.attemptSecret?.trim() ||
    existing?.attemptSecret?.trim() ||
    getOrCreateStudentAttemptSecret(sub.id);

  let validatedSub: HomeworkSubmission = {
    ...sub,
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    attemptSecret: resolvedAttemptSecret
  };
  if (matchingHw) {
    const check = validateHomeworkSubmissionIdentity(matchingHw, sub);
    if (!check.valid) {
      // Do not persist invalid/unauthorized submissions against a known assignment
      return;
    }
    validatedSub = {
      ...validatedSub,
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      studentName: check.normalizedStudentName || sub.studentName,
      groupId: check.normalizedGroupId
    };
  }

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
  writeLocalSubmissionsList(others, storageScope);

  // V-01 & V-02: When unauthenticated (student mode), also persist in UNAUTHENTICATED_HOMEWORK_SCOPE
  // so student replay tracking and unauthenticated offline queue flushing work reliably.
  if (!activeUid && storageScope !== UNAUTHENTICATED_HOMEWORK_SCOPE) {
    const unauthOthers = unauthAll.filter((s) => s.id !== mergedRecord.id);
    unauthOthers.unshift(mergedRecord);
    writeLocalSubmissionsList(unauthOthers, UNAUTHENTICATED_HOMEWORK_SCOPE);
  }

  if (syncCloud) {
    activeSaveSubmissionToCloud(mergedRecord)
      .then((ok) => {
        if (ok) {
          const updated = getLocalSubmissions(storageScope).map((s) =>
            s.id === mergedRecord.id ? { ...s, cloudSynced: true } : s
          );
          writeLocalSubmissionsList(updated, storageScope);
          if (!activeUid && storageScope !== UNAUTHENTICATED_HOMEWORK_SCOPE) {
            const updatedUnauth = getLocalSubmissions(UNAUTHENTICATED_HOMEWORK_SCOPE).map((s) =>
              s.id === mergedRecord.id ? { ...s, cloudSynced: true } : s
            );
            writeLocalSubmissionsList(updatedUnauth, UNAUTHENTICATED_HOMEWORK_SCOPE);
          }
          if (getActiveHomeworkScopeUid() === storageScope || !activeUid) {
            notifyHomeworkSyncStateChanged();
          }
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
  const hw =
    assignmentContext ||
    getLocalAssignments().find(
      (a) => a.id === sub.assignmentId || sanitizeDocId(a.id) === sanitizeDocId(sub.assignmentId)
    );

  // V-05: Reject submissions to closed or inactive assignments
  if (hw && !isHomeworkAssignmentOpenForStudents(hw)) {
    throw new Error('هذا الواجب مغلق أو غير نشط حالياً ولا يقبل إجابات جديدة.');
  }

  const resolvedOwnerUid =
    hw?.ownerUid?.trim() || sub.ownerUid?.trim() || getCurrentHomeworkOwnerUid() || undefined;

  // V-01: Verify against existing local submission with the same ID
  const existing = getStudentLocalSubmissions(sub.assignmentId, resolvedOwnerUid).find(
    (s) => s.id === sub.id
  );
  if (existing) {
    const existingName = (existing.studentName || '').trim().toLowerCase();
    const incomingName = (sub.studentName || '').trim().toLowerCase();
    if (existingName && incomingName && existingName !== incomingName) {
      throw new Error('لا يمكن تعديل اسم الطالب لمحاولة مسجلة مسبقاً.');
    }
    if (existing.attemptSecret && sub.attemptSecret && existing.attemptSecret !== sub.attemptSecret) {
      throw new Error('غير مصرح بتعديل هذه المحاولة من جلسة مختلفة.');
    }
    const existingIsCompleted =
      existing.status === 'completed' || (!existing.status && Boolean(existing.completedAt));
    if (existingIsCompleted) {
      const incomingIsCompleted =
        sub.status === 'completed' || (!sub.status && Boolean(sub.completedAt));
      if (
        !incomingIsCompleted ||
        existing.score !== sub.score ||
        existing.completedAt !== sub.completedAt
      ) {
        throw new Error('تم إنهاء هذه المحاولة مسبقاً ولا يمكن الكتابة فوقها.');
      }
    }
  }

  const resolvedAttemptSecret =
    sub.attemptSecret?.trim() ||
    existing?.attemptSecret?.trim() ||
    getOrCreateStudentAttemptSecret(sub.id);

  let normalizedSub: HomeworkSubmission = {
    ...sub,
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    attemptSecret: resolvedAttemptSecret
  };
  if (hw && hw.id) {
    const validation = validateHomeworkSubmissionIdentity(hw, sub);
    if (!validation.valid) {
      throw new Error(validation.error || 'فشل التحقق من هوية الطالب لهذا الواجب.');
    }
    normalizedSub = {
      ...normalizedSub,
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
 * whose Firestore write previously failed (e.g. while offline), strictly scoped to the active account
 * or to unauthenticated student submissions in student mode (V-02).
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

  const scopeAtStart = getActiveHomeworkScopeUid();
  const authUidAtStart = getCurrentHomeworkOwnerUid();

  isFlushingPendingHw = true;
  let syncedAssignments = 0;
  let syncedSubmissions = 0;

  try {
    // 1. Teacher assignments are only flushed when an authenticated teacher (or test transport) is active
    if (authUidAtStart || testCloudTransport) {
      const localHw = getLocalAssignments(scopeAtStart);
      for (const hw of localHw) {
        if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
          break;
        }
        if (authUidAtStart && hw.ownerUid && hw.ownerUid !== authUidAtStart) {
          continue;
        }
        if (hw.cloudSynced === false) {
          const ok = await activeSaveAssignmentToCloud(hw);
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            break;
          }
          if (ok) {
            syncedAssignments++;
            saveLocalAssignment({ ...hw, cloudSynced: true }, false);
          }
        }
      }
    }

    // 2. Flush pending submissions:
    // - If authenticated as a teacher: flush submissions belonging to active assignments of that teacher.
    // - If unauthenticated (student mode, V-02): flush pending student submissions in UNAUTHENTICATED_HOMEWORK_SCOPE
    //   without requiring teacher authentication or local teacher assignment documents.
    if (getActiveHomeworkScopeUid() === scopeAtStart && getCurrentHomeworkOwnerUid() === authUidAtStart) {
      if (authUidAtStart) {
        const activeIds = new Set(
          getLocalAssignments(scopeAtStart).flatMap((a) => [a.id, sanitizeDocId(a.id)])
        );
        const localSubs = getLocalSubmissions(scopeAtStart).filter(
          (s) => activeIds.has(s.assignmentId) || activeIds.has(sanitizeDocId(s.assignmentId))
        );
        for (const sub of localSubs) {
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            break;
          }
          if (sub.ownerUid && sub.ownerUid !== authUidAtStart) {
            continue;
          }
          if (sub.cloudSynced === false) {
            const ok = await activeSaveSubmissionToCloud(sub);
            if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
              break;
            }
            if (ok) {
              syncedSubmissions++;
              saveLocalSubmission({ ...sub, cloudSynced: true }, false);
            }
          }
        }
      } else {
        const studentPendingSubs = getLocalSubmissions(UNAUTHENTICATED_HOMEWORK_SCOPE).filter(
          (s) => s.cloudSynced === false
        );
        for (const sub of studentPendingSubs) {
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            break;
          }
          const ok = await activeSaveSubmissionToCloud(sub);
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            break;
          }
          if (ok) {
            syncedSubmissions++;
            saveLocalSubmission({ ...sub, cloudSynced: true }, false);
          }
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

export function getPendingHomeworkSyncCount(explicitUid?: string | null): number {
  const scopeUid = getActiveHomeworkScopeUid(explicitUid);
  if (scopeUid === UNAUTHENTICATED_HOMEWORK_SCOPE) {
    const pendingHw = getLocalAssignments(UNAUTHENTICATED_HOMEWORK_SCOPE).filter(
      (a) => a.cloudSynced === false
    ).length;
    const pendingStudentSubs = getLocalSubmissions(UNAUTHENTICATED_HOMEWORK_SCOPE).filter(
      (s) => s.cloudSynced === false
    ).length;
    return pendingHw + pendingStudentSubs;
  }
  const activeAssignments = getLocalAssignments(scopeUid);
  const activeIds = new Set(
    activeAssignments.flatMap((a) => [a.id, sanitizeDocId(a.id)])
  );
  const pendingHw = activeAssignments.filter((a) => a.cloudSynced === false).length;
  const pendingSubs = getLocalSubmissions(scopeUid).filter(
    (s) =>
      s.cloudSynced === false &&
      (activeIds.has(s.assignmentId) || activeIds.has(sanitizeDocId(s.assignmentId)))
  ).length;
  return pendingHw + pendingSubs;
}

export function getHomeworkSummaryStats(
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[]
): {
  assignmentsCount: number;
  submissionsCount: number;
  inProgressCount: number;
} {
  const activeAssignments = getLocalAssignments();
  if (activeAssignments.length === 0) {
    return {
      assignmentsCount: 0,
      submissionsCount: 0,
      inProgressCount: 0
    };
  }

  const allSubs = getLocalSubmissions();
  let totalCompleted = 0;
  let totalInProgress = 0;

  for (const rawHw of activeAssignments) {
    const hw = normalizeHomeworkAssignment(rawHw);
    const safeHwId = sanitizeDocId(hw.id);
    const mode = resolveAssignmentAudienceMode(hw);
    const allHwSubs = allSubs.filter(
      (s) => s.assignmentId === hw.id || sanitizeDocId(s.assignmentId) === safeHwId
    );

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
      const inProgressSubs = validGroupSubs.filter(
        (s) => s.status === 'in_progress' && !s.completedAt
      );

      const uniqueCompletedStudents = new Set(completedSubs.map(resolveSubStudentId));
      const uniqueInProgressStudents = new Set(
        inProgressSubs.map(resolveSubStudentId).filter((id) => !uniqueCompletedStudents.has(id))
      );

      totalCompleted += uniqueCompletedStudents.size;
      totalInProgress += uniqueInProgressStudents.size;
    } else {
      const completedSubs = allHwSubs.filter(
        (s) => s.status === 'completed' || (!s.status && Boolean(s.completedAt))
      );
      const inProgressSubs = allHwSubs.filter(
        (s) => s.status === 'in_progress' && !s.completedAt
      );

      const uniqueCompletedParticipants = new Set(
        completedSubs.map((s) => getSubmissionIdentityKey(s))
      );
      const uniqueInProgressParticipants = new Set(
        inProgressSubs
          .map((s) => getSubmissionIdentityKey(s))
          .filter((k) => !uniqueCompletedParticipants.has(k))
      );

      totalCompleted += uniqueCompletedParticipants.size;
      totalInProgress += uniqueInProgressParticipants.size;
    }
  }

  return {
    assignmentsCount: activeAssignments.length,
    submissionsCount: totalCompleted,
    inProgressCount: totalInProgress
  };
}

let lastTrackedAuthUid: string | null = getCurrentHomeworkOwnerUid();
subscribeTeacherAuth((user) => {
  const nextUid = user?.uid?.trim() || null;
  if (nextUid !== lastTrackedAuthUid) {
    lastTrackedAuthUid = nextUid;
    isFlushingPendingHw = false;
    notifyHomeworkSyncStateChanged();
  }
});

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingHomeworkCloudWrites().catch(() => {});
  });
}

const VALID_HOMEWORK_QUESTION_TYPES = new Set<HomeworkQuestionType>([
  'true_false',
  'choice_2',
  'choice_all',
  'syllables',
  'missing_letter',
  'missing_two_letters',
  'full_word',
  'mc_de_ar',
  'listen_choose',
  'mc_ar_de',
  'article_quiz'
]);

/**
 * Resolves how many questions should be asked for a specific stage (`qType`),
 * clamped between 1 and `maxWordsCount` (or 0 when `maxWordsCount <= 0`).
 * Defaults to `maxWordsCount` (all selected words) when no custom count is set.
 */
export function resolveStageQuestionCount(
  qType: HomeworkQuestionType,
  maxWordsCount: number,
  questionTypeCounts?: Partial<Record<HomeworkQuestionType, number>>
): number {
  const safeMax = Math.max(0, Math.floor(Number(maxWordsCount) || 0));
  if (safeMax <= 0) return 0;
  const raw = questionTypeCounts?.[qType];
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return Math.min(safeMax, Math.max(1, Math.round(raw)));
  }
  return safeMax;
}

/**
 * Calculates the total number of questions across all active homework stages
 * taking into account any per-stage custom question counts (`questionTypeCounts`).
 */
export function calculateTotalHomeworkQuestions(
  wordsCount: number,
  questionTypes?: HomeworkQuestionType[],
  questionTypeCounts?: Partial<Record<HomeworkQuestionType, number>>
): number {
  const safeWords = Math.max(0, Math.floor(Number(wordsCount) || 0));
  if (safeWords <= 0) return 0;
  const activeTypes =
    Array.isArray(questionTypes) && questionTypes.length > 0
      ? questionTypes
      : DEFAULT_HOMEWORK_QUESTION_TYPES;
  return activeTypes.reduce(
    (sum, qt) => sum + resolveStageQuestionCount(qt, safeWords, questionTypeCounts),
    0
  );
}

/**
 * Encodes `questionTypeCounts` into a compact query parameter string (e.g. `true_false:5,choice_2:3`).
 */
export function encodeQuestionTypeCountsParam(
  questionTypes?: HomeworkQuestionType[],
  questionTypeCounts?: Partial<Record<HomeworkQuestionType, number>>,
  maxWordsCount?: number
): string {
  if (!questionTypeCounts || typeof questionTypeCounts !== 'object') return '';
  const activeTypes =
    Array.isArray(questionTypes) && questionTypes.length > 0
      ? questionTypes
      : (Object.keys(questionTypeCounts) as HomeworkQuestionType[]);
  const safeMax =
    typeof maxWordsCount === 'number' && Number.isFinite(maxWordsCount) && maxWordsCount > 0
      ? Math.floor(maxWordsCount)
      : undefined;

  const pairs: string[] = [];
  for (const qt of activeTypes) {
    if (!VALID_HOMEWORK_QUESTION_TYPES.has(qt)) continue;
    const raw = questionTypeCounts[qt];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
      const clamped = safeMax ? Math.min(safeMax, Math.max(1, Math.round(raw))) : Math.max(1, Math.round(raw));
      pairs.push(`${qt}:${clamped}`);
    }
  }
  return pairs.join(',');
}

/**
 * Parses a compact `qtc` query parameter (`true_false:5,choice_2:3`) back into a `questionTypeCounts` map.
 */
export function parseQuestionTypeCountsParam(
  qtcParam: string | null | undefined
): Partial<Record<HomeworkQuestionType, number>> {
  const result: Partial<Record<HomeworkQuestionType, number>> = {};
  if (!qtcParam || typeof qtcParam !== 'string') return result;
  const entries = qtcParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const [rawType, rawCount] = entry.split(':');
    const qt = (rawType || '').trim() as HomeworkQuestionType;
    const parsedCount = Number((rawCount || '').trim());
    if (VALID_HOMEWORK_QUESTION_TYPES.has(qt) && Number.isFinite(parsedCount) && parsedCount >= 1) {
      result[qt] = Math.max(1, Math.round(parsedCount));
    }
  }
  return result;
}

/**
 * Creates a cryptographically strong bearer token for a public homework share link.
 * Requires Web Crypto; never falls back to Math.random for an access credential.
 */
export function createHomeworkAssignmentId(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure random generation is unavailable; cannot create a homework ID.');
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return 'hw_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createHomeworkShareToken(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is unavailable in this browser.');
  }
  const bytes = new Uint8Array(32);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
  if (hw.shareToken?.trim()) params.set('token', hw.shareToken.trim());
  if (mode === 'group' && hw.groupId) {
    params.set('gid', hw.groupId);
    if (hw.groupName) params.set('gn', hw.groupName);
  }
  if (hw.setSnapshot?.id) params.set('s', hw.setSnapshot.id);
  if (hw.flowMode) params.set('fm', hw.flowMode);
  if (hw.questionTypes && hw.questionTypes.length > 0) {
    params.set('qt', hw.questionTypes.join(','));
  }
  const encodedQtc = encodeQuestionTypeCountsParam(
    hw.questionTypes,
    hw.questionTypeCounts,
    hw.selectedItemIds?.length || hw.setSnapshot?.items?.length
  );
  if (encodedQtc) {
    params.set('qtc', encodedQtc);
  }
  if (hw.blooketMode) params.set('bm', hw.blooketMode);
  if (hw.title) params.set('t', hw.title);
  if (hw.selectedItemIds && hw.selectedItemIds.length > 0) {
    params.set('ids', hw.selectedItemIds.join(','));
  }
  return `${baseDomain}/homework/${hw.id}?${params.toString()}`;
}

/**
 * Deterministically backfills legacy cloud homework assignments and their submissions
 * when ownership can be proven for `options.uid` (V-03).
 * Never claims an assignment without deterministic proof (`ownerUid`, `ownerEmail`, or workspace entity match).
 */
export async function backfillLegacyCloudHomeworkForAccount(
  options: LegacyHomeworkMigrationOptions & {
    candidateAssignmentIds?: Iterable<string>;
  }
): Promise<{
  backfilledAssignments: number;
  backfilledSubmissions: number;
}> {
  if (!options?.uid?.trim()) {
    return { backfilledAssignments: 0, backfilledSubmissions: 0 };
  }
  const targetUid = options.uid.trim();
  const activeUid = getCurrentHomeworkOwnerUid();
  if (activeUid && activeUid !== targetUid) {
    return { backfilledAssignments: 0, backfilledSubmissions: 0 };
  }

  let backfilledAssignments = 0;
  let backfilledSubmissions = 0;

  const candidateIds = new Set<string>(
    [
      ...getLocalAssignments(targetUid).map((a) => a.id),
      ...Array.from(options.candidateAssignmentIds || [])
    ]
      .map((id) => (id || '').trim())
      .filter(Boolean)
  );

  for (const hwId of candidateIds) {
    if (getCurrentHomeworkOwnerUid() && getCurrentHomeworkOwnerUid() !== targetUid) {
      break;
    }
    if (isAssignmentDeletedLocally(hwId, targetUid)) continue;

    const localHw = getLocalAssignments(targetUid).find(
      (a) => a.id === hwId || sanitizeDocId(a.id) === sanitizeDocId(hwId)
    );
    const cloudHw = await activeFetchAssignmentFromCloud(hwId).catch(() => null);
    const sourceHw = cloudHw || localHw;
    if (!sourceHw) continue;

    // Verify ownership deterministically using cloudHw (if present) or localHw
    const checkSource = cloudHw && !cloudHw.ownerUid && localHw ? { ...cloudHw, ...localHw, ownerUid: cloudHw.ownerUid } : sourceHw;
    const { provableForTarget, belongsToDifferentAccount } = canAccountClaimLegacyHomework(
      checkSource,
      options
    );
    if (belongsToDifferentAccount || !provableForTarget) {
      continue;
    }

    const cloudNeedsBackfill = !cloudHw || (cloudHw.ownerUid || '').trim() !== targetUid;
    const stampedHw: HomeworkAssignment = normalizeHomeworkAssignment({
      ...localHw,
      ...cloudHw,
      ownerUid: targetUid,
      cloudSynced: true
    });

    if (cloudNeedsBackfill) {
      const ok = await activeSaveAssignmentToCloud(stampedHw).catch(() => false);
      if (ok) {
        backfilledAssignments++;
        saveLocalAssignment({ ...stampedHw, cloudSynced: true }, false);
      }
    } else if (!localHw) {
      saveLocalAssignment({ ...stampedHw, cloudSynced: true }, false);
    }

    // Inspect submissions for this owned assignment (including legacy_unclaimed_<assignmentId>)
    const cloudSubsForHw = await activeFetchSubmissionsForAssignmentFromCloud(stampedHw.id).catch(
      () => [] as HomeworkSubmission[]
    );
    for (const sub of cloudSubsForHw) {
      const subOwner = (sub.ownerUid || '').trim();
      const safeId = sanitizeDocId(stampedHw.id);
      if (
        !subOwner ||
        subOwner === `legacy_unclaimed_${safeId}` ||
        subOwner === `legacy_unclaimed_${stampedHw.id}`
      ) {
        const backfilledSub: HomeworkSubmission = {
          ...sub,
          ownerUid: targetUid,
          cloudSynced: true
        };
        const subOk = await activeSaveSubmissionToCloud(backfilledSub).catch(() => false);
        if (subOk) {
          backfilledSubmissions++;
          saveLocalSubmission(backfilledSub, false);
        }
      } else if (subOwner === targetUid) {
        saveLocalSubmission({ ...sub, ownerUid: targetUid, cloudSynced: true }, false);
      }
    }
  }

  return { backfilledAssignments, backfilledSubmissions };
}

export async function syncAndFetchTeacherAssignments(
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[]
): Promise<any[]> {
  const scopeAtStart = getActiveHomeworkScopeUid();
  const authUidAtStart = getCurrentHomeworkOwnerUid();

  // Read authoritative cloud state first. A failed read must never be treated as an empty account.
  let cloudAssignments: HomeworkAssignment[] = [];
  let cloudSubmissions: HomeworkSubmission[] = [];
  if (authUidAtStart) {
    try {
      [cloudAssignments, cloudSubmissions] = await Promise.all([
        activeFetchAllAssignmentsFromCloud(authUidAtStart),
        activeFetchAllSubmissionsFromCloud(authUidAtStart)
      ]);
    } catch {
      if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) return [];
      return getLocalAssignments(scopeAtStart).filter((hw) => hw.ownerUid === authUidAtStart && !(hw as any).deleted);
    }
  }
  // Guard against stale async completion after account switch or logout
  if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
    return [];
  }

  cloudAssignments.forEach((hw) => {
    if (authUidAtStart && hw.ownerUid && hw.ownerUid !== authUidAtStart) {
      return;
    }
    if ((hw as any).deleted) { deleteLocalAssignment(hw.id, false); return; }
    if (isAssignmentDeletedLocally(hw.id, scopeAtStart)) return;
    saveLocalAssignment({ ...hw, ...(authUidAtStart ? { ownerUid: authUidAtStart } : {}), cloudSynced: true }, false);
  });

  // A successful owner-scoped cloud read is authoritative. Remove stale local
  // assignments absent from that account's cloud list instead of resurrecting them.
  const cloudAssignmentIdsForOwner = new Set(cloudAssignments.map((hw) => sanitizeDocId(hw.id)));
  for (const localHw of getLocalAssignments(scopeAtStart)) {
    if (localHw.ownerUid === authUidAtStart && !cloudAssignmentIdsForOwner.has(sanitizeDocId(localHw.id))) {
      deleteLocalAssignment(localHw.id, false);
    }
  }

  // Push any local assignments missing from cloud ONLY if they belong to the currently authenticated UID
  const localAssignments = getLocalAssignments(scopeAtStart);
  const activeAssignmentIds = new Set(
    localAssignments.flatMap((a) => [a.id, sanitizeDocId(a.id)])
  );

  cloudSubmissions.forEach((sub) => {
    if (authUidAtStart && sub.ownerUid && sub.ownerUid !== authUidAtStart) {
      return;
    }
    if (isAssignmentDeletedLocally(sub.assignmentId, scopeAtStart)) return;
    if (
      !activeAssignmentIds.has(sub.assignmentId) &&
      !activeAssignmentIds.has(sanitizeDocId(sub.assignmentId))
    ) {
      return;
    }
    saveLocalSubmission({ ...sub, ...(authUidAtStart ? { ownerUid: authUidAtStart } : {}), cloudSynced: true }, false);
  });

  // Prune any orphaned local submissions whose assignment no longer exists
  const validLocalSubmissions = getLocalSubmissions(scopeAtStart).filter(
    (s) =>
      activeAssignmentIds.has(s.assignmentId) ||
      activeAssignmentIds.has(sanitizeDocId(s.assignmentId))
  );
  writeLocalSubmissionsList(validLocalSubmissions, scopeAtStart);

  // All cloud tombstones and stale local records have now been applied.
  flushPendingHomeworkCloudWrites().catch(() => {});

  if (authUidAtStart) {
    const cloudAssignmentIds = new Set(cloudAssignments.map((a) => a.id));
    for (const localHw of localAssignments) {
      if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
        return [];
      }
      // Never upload an assignment unless its ownerUid matches the authenticated account
      if (localHw.ownerUid !== authUidAtStart) {
        continue;
      }
      // Only update an assignment already present in the authoritative cloud list.
      // Missing local-only records are stale cache, not new homework to resurrect.
      if (cloudAssignmentIds.has(localHw.id) && localHw.cloudSynced === false) {
        const ok = await activeSaveAssignmentToCloud(localHw).catch(() => false);
        if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
          return [];
        }
        if (ok) {
          saveLocalAssignment({ ...localHw, ownerUid: authUidAtStart, cloudSynced: true }, false);
        }
      }

      // V-03: Also check if any legacy/unclaimed submissions exist for this owned assignment and backfill them
      const assignmentSubs = await activeFetchSubmissionsForAssignmentFromCloud(localHw.id).catch(
        () => [] as HomeworkSubmission[]
      );
      for (const sub of assignmentSubs) {
        if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
          return [];
        }
        const subOwner = (sub.ownerUid || '').trim();
        const safeId = sanitizeDocId(localHw.id);
        if (
          !subOwner ||
          subOwner === `legacy_unclaimed_${safeId}` ||
          subOwner === `legacy_unclaimed_${localHw.id}`
        ) {
          const backfilledSub: HomeworkSubmission = {
            ...sub,
            ownerUid: authUidAtStart,
            cloudSynced: true
          };
          const subOk = await activeSaveSubmissionToCloud(backfilledSub).catch(() => false);
          if (subOk) {
            saveLocalSubmission(backfilledSub, false);
          }
        } else if (subOwner === authUidAtStart) {
          saveLocalSubmission({ ...sub, ownerUid: authUidAtStart, cloudSynced: true }, false);
        }
      }
    }

    const cloudSubmissionIds = new Set(cloudSubmissions.map((s) => s.id));
    for (const localSub of validLocalSubmissions) {
      if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
        return [];
      }
      if (localSub.ownerUid && localSub.ownerUid !== authUidAtStart) {
        continue;
      }
      if (!cloudSubmissionIds.has(localSub.id) || localSub.cloudSynced === false) {
        const ok = await activeSaveSubmissionToCloud({ ...localSub, ownerUid: authUidAtStart }).catch(() => false);
        if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
          return [];
        }
        if (ok) {
          saveLocalSubmission({ ...localSub, ownerUid: authUidAtStart, cloudSynced: true }, false);
        }
      }
    }
  }

  const mergedAssignments = getLocalAssignments(scopeAtStart);
  const mergedSubmissions = getLocalSubmissions(scopeAtStart).filter(
    (s) =>
      activeAssignmentIds.has(s.assignmentId) ||
      activeAssignmentIds.has(sanitizeDocId(s.assignmentId))
  );

  return mergedAssignments.map((rawHw) => {
    const hw = normalizeHomeworkAssignment(rawHw);
    const safeHwId = sanitizeDocId(hw.id);
    const mode = resolveAssignmentAudienceMode(hw);
    const allHwSubs = mergedSubmissions.filter(
      (s) => s.assignmentId === hw.id || sanitizeDocId(s.assignmentId) === safeHwId
    );

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
  const activeUid = getCurrentHomeworkOwnerUid();
  const safeId = sanitizeDocId(id);
  const rawHw =
    getLocalAssignments().find((a) => a.id === id || sanitizeDocId(a.id) === safeId) ||
    fallbackHw ||
    null;
  if (!rawHw) return null;
  if (activeUid && rawHw.ownerUid && rawHw.ownerUid !== activeUid) {
    return null;
  }
  return computeAssignmentDetailsObject(rawHw, rosterStudents);
}

export async function fetchAssignmentDetailsWithSync(
  id: string,
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[],
  fallbackHw?: HomeworkAssignment | null
): Promise<any | null> {
  const scopeAtStart = getActiveHomeworkScopeUid();
  const authUidAtStart = getCurrentHomeworkOwnerUid();

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

  if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
    return null;
  }

  // Enforce ownership in teacher view: if signed in as authUidAtStart and cloudHw belongs to another teacher, reject it
  if (authUidAtStart && cloudHw?.ownerUid && cloudHw.ownerUid !== authUidAtStart) {
    return null;
  }

  if (cloudHw && !isAssignmentDeletedLocally(cloudHw.id, scopeAtStart)) {
    saveLocalAssignment({ ...cloudHw, cloudSynced: true }, false);
  }
  cloudSubs.forEach((sub) => {
    if (authUidAtStart && sub.ownerUid && sub.ownerUid !== authUidAtStart) return;
    saveLocalSubmission({ ...sub, cloudSynced: true }, false);
  });

  const safeId = sanitizeDocId(id);
  const rawHw =
    cloudHw ||
    getLocalAssignments(scopeAtStart).find((a) => a.id === id || sanitizeDocId(a.id) === safeId) ||
    fallbackHw ||
    null;
  if (!rawHw) return null;
  if (authUidAtStart && rawHw.ownerUid && rawHw.ownerUid !== authUidAtStart) {
    return null;
  }

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

