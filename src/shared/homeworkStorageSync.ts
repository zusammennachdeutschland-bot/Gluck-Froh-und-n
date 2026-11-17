import {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkQuestionType,
  HomeworkAudienceMode,
  HomeworkShortLinkResolutionResult,
  HomeworkLinkManagementResult,
  AssignedStudentSnapshot,
  DEFAULT_HOMEWORK_QUESTION_TYPES
} from './homeworkTypes';
import { calculateUnifiedHomeworkQuestionCount } from './verbEngine';
import { stripHeavyGrammarMediaForSync } from './grammarEngine';
import {
  getVercelPublicDomain,
  setVercelPublicDomain,
  resolveHomeworkApiUrl,
  DEFAULT_VERCEL_DOMAIN,
  sanitizeDocId,
  saveAssignmentToFirestore,
  fetchAssignmentFromFirestore,
  fetchAllAssignmentsFromFirestore,
  subscribeAssignmentsFromFirestore,
  deleteAssignmentFromFirestore,
  deleteSubmissionsForAssignmentFromFirestore,
  saveShortLinkToFirestore,
  revokeShortLinkInFirestore,
  fetchShortLinkFromFirestore,
  saveSubmissionToFirestore,
  saveSubmissionToFirestoreWithDetails,
  fetchSubmissionsForAssignmentFromFirestore,
  fetchSubmissionsPageFromFirestore,
  fetchAssignmentsPageFromFirestore,
  fetchAllSubmissionsFromFirestore,
  subscribeSubmissionsFromFirestore,
  saveLernstudioSetToFirestore,
  publishCustomLernstudioSetOnce,
  fetchPublishedCustomLernstudioSetsFromFirestore,
  fetchLernstudioSetFromFirestore,
  isBuiltinCurriculumSetId,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth,
  getCurrentHomeworkOwnerUid,
  getCurrentHomeworkOwnerEmail,
  verifyAssignmentPresenceInCloud,
  wasLastAssignmentsFetchAuthoritative,
  waitForHomeworkAuthStateReady,
  isFirestoreReadQuotaExhausted,
  clearFirestoreReadQuotaFlag,
  __setHomeworkAuthUserForTests
} from './firebaseCloudSync';

export {
  getVercelPublicDomain,
  setVercelPublicDomain,
  resolveHomeworkApiUrl,
  DEFAULT_VERCEL_DOMAIN,
  sanitizeDocId,
  saveAssignmentToFirestore,
  fetchAssignmentFromFirestore,
  fetchAllAssignmentsFromFirestore,
  fetchAssignmentsPageFromFirestore,
  subscribeAssignmentsFromFirestore,
  deleteAssignmentFromFirestore,
  deleteSubmissionsForAssignmentFromFirestore,
  saveShortLinkToFirestore,
  revokeShortLinkInFirestore,
  fetchShortLinkFromFirestore,
  saveSubmissionToFirestore,
  saveSubmissionToFirestoreWithDetails,
  fetchSubmissionsForAssignmentFromFirestore,
  fetchSubmissionsPageFromFirestore,
  fetchAllSubmissionsFromFirestore,
  subscribeSubmissionsFromFirestore,
  saveLernstudioSetToFirestore,
  publishCustomLernstudioSetOnce,
  fetchPublishedCustomLernstudioSetsFromFirestore,
  fetchLernstudioSetFromFirestore,
  isBuiltinCurriculumSetId,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth,
  getCurrentHomeworkOwnerUid,
  getCurrentHomeworkOwnerEmail,
  isFirestoreReadQuotaExhausted,
  clearFirestoreReadQuotaFlag,
  __setHomeworkAuthUserForTests
};

export const LEGACY_ASSIGNMENTS_KEY = 'glueck_hw_assignments_v2';
export const LEGACY_SUBMISSIONS_KEY = 'glueck_hw_submissions_v2';
export const LEGACY_DELETED_ASSIGNMENTS_KEY = 'glueck_hw_deleted_ids_v2';
export const QUARANTINED_LEGACY_HOMEWORK_KEY = 'glueck_hw_quarantined_legacy_v3';
export const REVOKED_SHORT_IDS_STORAGE_KEY = 'glueck_hw_revoked_short_ids_v1';
export const UNAUTHENTICATED_HOMEWORK_SCOPE = 'local_unauthenticated';
const OPEN_PARTICIPANT_PREFIX = 'glueck_hw_open_pid_';
const STUDENT_DEVICE_TOKEN_PREFIX = 'glueck_hw_dev_tok_';
const STUDENT_ATTEMPT_SECRET_PREFIX = 'glueck_hw_att_sec_';

export interface ArchivedAssignmentMeta {
  id: string;
  title: string;
  createdAt?: string;
  deletedAt: string;
  audienceMode?: HomeworkAudienceMode;
  groupId?: string;
  groupName?: string;
  questionCount?: number;
  ownerUid?: string;
}

function getArchivedAssignmentsMetaKey(explicitUid?: string | null): string {
  const scope = sanitizeDocId(getActiveHomeworkScopeUid(explicitUid));
  return `glueck_hw_archived_meta_v1_${scope}`;
}

function getLastRefreshStorageKey(explicitUid?: string | null): string {
  const scope = sanitizeDocId(getActiveHomeworkScopeUid(explicitUid));
  return `glueck_hw_last_refresh_v1_${scope}`;
}

export function getArchivedAssignmentsMetadata(explicitUid?: string | null): ArchivedAssignmentMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getArchivedAssignmentsMetaKey(explicitUid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveArchivedAssignmentMetadata(
  hw: Partial<HomeworkAssignment>,
  explicitUid?: string | null
): void {
  if (typeof window === 'undefined' || !hw?.id) return;
  try {
    const safeId = sanitizeDocId(hw.id);
    const current = getArchivedAssignmentsMetadata(explicitUid).filter(
      (item) => item.id !== hw.id && sanitizeDocId(item.id) !== safeId
    );
    current.unshift({
      id: hw.id,
      title: hw.title || 'واجب محذوف',
      createdAt: hw.createdAt,
      deletedAt: new Date().toISOString(),
      audienceMode: hw.audienceMode,
      groupId: hw.groupId,
      groupName: hw.groupName,
      questionCount: hw.questionCount,
      ownerUid: hw.ownerUid
    });
    localStorage.setItem(getArchivedAssignmentsMetaKey(explicitUid), JSON.stringify(current.slice(0, 150)));
  } catch {
    // Ignore storage quota errors
  }
}

export function getHomeworkLastRefreshTimestamp(key: string, explicitUid?: string | null): number {
  if (typeof window === 'undefined' || !key) return 0;
  try {
    const raw = localStorage.getItem(getLastRefreshStorageKey(explicitUid));
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed?.[key] === 'number' ? parsed[key] : 0;
  } catch {
    return 0;
  }
}

export function recordHomeworkLastRefreshTimestamp(
  key: string,
  timestampMs = Date.now(),
  explicitUid?: string | null
): number {
  if (typeof window === 'undefined' || !key) return timestampMs;
  try {
    const storageKey = getLastRefreshStorageKey(explicitUid);
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = { ...(parsed && typeof parsed === 'object' ? parsed : {}), [key]: timestampMs };
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return timestampMs;
}

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

export const VERB_QUESTION_TYPE_META: QuestionTypeMetaItem[] = [
  {
    id: 'verb_conjugation',
    labelAr: 'تصريف الأفعال (Verb Konjugieren)',
    labelDe: 'Verb Konjugieren',
    descAr: 'يصرّف الطالب الفعل في المضارع مع الضمائر الستة أو الأسماء (6 أسئلة لكل فعل)',
    badgeEmoji: '🔤'
  },
  {
    id: 'verb_sentence',
    labelAr: 'إكمال الجملة بالفعل (Verb im Satz)',
    labelDe: 'Verb im Satz',
    descAr: 'يكمل الطالب الجملة الألمانية بالفعل المصرف الصحيح (وموضع المقطع المنفصل)',
    badgeEmoji: '📝'
  }
];

export const GRAMMAR_QUESTION_TYPE_META: QuestionTypeMetaItem[] = [
  {
    id: 'grammar_exercise',
    labelAr: 'تمارين القواعد (Grammatik)',
    labelDe: 'Grammatikübungen',
    descAr: 'أسئلة تفاعلية شاملة على القواعد (اختيار، ملء فراغ، تصحيح، ترتيب جملة، وكتابة)',
    badgeEmoji: '📘'
  }
];

export function getQuestionTypeMeta(id: HomeworkQuestionType): QuestionTypeMetaItem {
  return (
    QUESTION_TYPE_META.find((m) => m.id === id) ||
    VERB_QUESTION_TYPE_META.find((m) => m.id === id) ||
    GRAMMAR_QUESTION_TYPE_META.find((m) => m.id === id) ||
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
  const normalizedHideBranding =
    hw.hideTeacherBranding !== undefined ? { hideTeacherBranding: Boolean(hw.hideTeacherBranding) } : {};
  const cleanOriginalShortId = (hw.originalShortId || hw.shortId || '').trim();
  const normalizedOriginalShortId =
    cleanOriginalShortId && isValidHomeworkShortId(cleanOriginalShortId)
      ? { originalShortId: cleanOriginalShortId }
      : {};
  const normalizedSnapshot =
    hw.setSnapshot && hw.setSnapshot.grammarContent
      ? stripHeavyGrammarMediaForSync(hw.setSnapshot)
      : hw.setSnapshot;

  if (mode === 'open') {
    const copy: HomeworkAssignment = {
      ...hw,
      ...(normalizedSnapshot ? { setSnapshot: normalizedSnapshot } : {}),
      ...normalizedHideBranding,
      ...normalizedOriginalShortId,
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
    ...(normalizedSnapshot ? { setSnapshot: normalizedSnapshot } : {}),
    ...normalizedHideBranding,
    ...normalizedOriginalShortId,
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

function notifyHomeworkSyncStateChanged(detail?: {
  assignmentsChanged?: boolean;
  submissionsChanged?: boolean;
}): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('glueck-homework-sync-updated', detail ? { detail } : undefined)
    );
    if (!detail || detail.assignmentsChanged !== false || detail.submissionsChanged !== false) {
      window.dispatchEvent(
        new CustomEvent('gluck-local-data-mutated', {
          detail: { source: 'homework', ...(detail || {}) }
        })
      );
    }
  }
}

export interface PendingHomeworkDeleteEntry {
  assignmentId: string;
  ownerUid?: string;
  shortId?: string;
  deletedAt: number;
}

function getPendingDeletesStorageKey(explicitUid?: string | null): string {
  const scope = sanitizeDocId(getActiveHomeworkScopeUid(explicitUid));
  return `glueck_hw_pending_deletes_v1_${scope}`;
}

export function getPendingHomeworkDeletes(explicitUid?: string | null): PendingHomeworkDeleteEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getPendingDeletesStorageKey(explicitUid));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingHomeworkDeleteEntry =>
        Boolean(item && typeof item.assignmentId === 'string' && item.assignmentId.trim().length > 0)
    );
  } catch {
    return [];
  }
}

function writePendingHomeworkDeletes(
  entries: PendingHomeworkDeleteEntry[],
  explicitUid?: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getPendingDeletesStorageKey(explicitUid);
    if (entries.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(entries.slice(-300)));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function enqueuePendingHomeworkDelete(
  entry: PendingHomeworkDeleteEntry,
  explicitUid?: string | null
): void {
  if (typeof window === 'undefined' || !entry?.assignmentId) return;
  const safeId = sanitizeDocId(entry.assignmentId);
  const current = getPendingHomeworkDeletes(explicitUid).filter(
    (item) => item.assignmentId !== entry.assignmentId && sanitizeDocId(item.assignmentId) !== safeId
  );
  current.push({
    assignmentId: entry.assignmentId,
    ...(entry.ownerUid ? { ownerUid: entry.ownerUid } : {}),
    ...(entry.shortId ? { shortId: entry.shortId } : {}),
    deletedAt: entry.deletedAt || Date.now()
  });
  writePendingHomeworkDeletes(current, explicitUid);
}

function dequeuePendingHomeworkDelete(
  assignmentId: string,
  explicitUid?: string | null
): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  const safeId = sanitizeDocId(assignmentId);
  const current = getPendingHomeworkDeletes(explicitUid);
  const next = current.filter(
    (item) => item.assignmentId !== assignmentId && sanitizeDocId(item.assignmentId) !== safeId
  );
  if (next.length !== current.length) {
    writePendingHomeworkDeletes(next, explicitUid);
  }
}

function stripVolatileAssignmentFields(hw: HomeworkAssignment): Record<string, any> {
  const copy: Record<string, any> = { ...hw };
  delete copy.cloudSynced;
  delete copy.cloudCreatePending;
  return copy;
}

function areAssignmentRecordsEqual(
  a: HomeworkAssignment | undefined | null,
  b: HomeworkAssignment | undefined | null
): boolean {
  if (!a || !b) return false;
  return (
    JSON.stringify(stripVolatileAssignmentFields(a)) ===
    JSON.stringify(stripVolatileAssignmentFields(b))
  );
}

function stripVolatileSubmissionFields(sub: HomeworkSubmission): Record<string, any> {
  const copy: Record<string, any> = { ...sub };
  delete copy.cloudSynced;
  return copy;
}

function areSubmissionRecordsEqual(
  a: HomeworkSubmission | undefined | null,
  b: HomeworkSubmission | undefined | null
): boolean {
  if (!a || !b) return false;
  return (
    JSON.stringify(stripVolatileSubmissionFields(a)) ===
    JSON.stringify(stripVolatileSubmissionFields(b))
  );
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

export function clearAssignmentDeletedLocally(assignmentId: string, explicitUid?: string | null): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    const key = getDeletedAssignmentsStorageKey(explicitUid);
    const deletedSet = getDeletedAssignmentIds(explicitUid);
    const safeId = sanitizeDocId(assignmentId);
    const hadAny = deletedSet.delete(assignmentId) || deletedSet.delete(safeId);
    if (hadAny) {
      localStorage.setItem(key, JSON.stringify(Array.from(deletedSet).slice(-500)));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function getManualDeletedAssignmentsStorageKey(explicitUid?: string | null): string {
  const scopeUid = getActiveHomeworkScopeUid(explicitUid);
  return `glueck_hw_manual_deleted_ids_v1_${scopeUid}`;
}

export function getManualDeletedAssignmentIds(explicitUid?: string | null): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(getManualDeletedAssignmentsStorageKey(explicitUid));
    const parsed: string[] = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id.length > 0) : []);
  } catch {
    return new Set();
  }
}

export function isAssignmentManuallyDeletedLocally(
  assignmentId?: string | null,
  explicitUid?: string | null
): boolean {
  if (!assignmentId) return false;
  const manualSet = getManualDeletedAssignmentIds(explicitUid);
  return manualSet.has(assignmentId) || manualSet.has(sanitizeDocId(assignmentId));
}

export function markAssignmentManuallyDeletedLocally(
  assignmentId: string,
  explicitUid?: string | null
): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  try {
    const key = getManualDeletedAssignmentsStorageKey(explicitUid);
    const manualSet = getManualDeletedAssignmentIds(explicitUid);
    manualSet.add(assignmentId);
    manualSet.add(sanitizeDocId(assignmentId));
    localStorage.setItem(key, JSON.stringify(Array.from(manualSet).slice(-500)));
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
    const combined: HomeworkAssignment[] = [...parsed];

    if (isAuthenticatedScope) {
      try {
        const unauthRaw = localStorage.getItem(getAssignmentsStorageKey(UNAUTHENTICATED_HOMEWORK_SCOPE));
        const unauthParsed: HomeworkAssignment[] = unauthRaw ? JSON.parse(unauthRaw) : [];
        const existingIds = new Set(combined.filter((a) => a && a.id).map((a) => a.id));
        for (const hw of unauthParsed) {
          if (!hw || !hw.id || existingIds.has(hw.id)) continue;
          const recOwner = hw.ownerUid?.trim() || '';
          if (!recOwner || recOwner === scopeUid) {
            combined.push({ ...hw, ownerUid: scopeUid });
            existingIds.add(hw.id);
          }
        }
      } catch {
        // Ignore unauth fallback parse errors
      }
    }

    return combined
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
        if (isAuthenticatedScope && recOwner !== scopeUid) {
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
  fetchShortLink?: (shortId: string) => Promise<any>;
  saveShortLink?: (
    hw: HomeworkAssignment,
    ownerUid?: string,
    options?: { forceVerifyAndWrite?: boolean }
  ) => Promise<{ saved: boolean; collision?: boolean }>;
  revokeShortLink?: (shortId: string, assignmentId: string, ownerUid?: string) => Promise<boolean>;
  fetchSubmissionsForAssignment?: (id: string) => Promise<HomeworkSubmission[]>;
  fetchAllAssignments?: (ownerUid?: string) => Promise<HomeworkAssignment[]>;
  fetchAllSubmissions?: (ownerUid?: string) => Promise<HomeworkSubmission[]>;
  deleteAssignment?: (id: string, ownerUid?: string, shortIdHint?: string) => Promise<boolean>;
  deleteSubmissionsForAssignment?: (id: string, ownerUid?: string) => Promise<boolean>;
}

let testCloudTransport: HomeworkCloudTransportOverride | null = null;

export function __setHomeworkSyncTransportForTests(
  transport: HomeworkCloudTransportOverride | null
): void {
  testCloudTransport = transport;
}

const activeSaveAssignmentToCloud = (hw: HomeworkAssignment, explicitOwnerUid?: string) => {
  const activeUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (activeUid && hw.ownerUid && hw.ownerUid.trim() !== '' && hw.ownerUid.trim() !== activeUid) {
    return Promise.resolve(false);
  }
  return testCloudTransport?.saveAssignment
    ? testCloudTransport.saveAssignment(hw)
    : saveAssignmentToFirestore(hw, activeUid || undefined);
};

const activeSaveShortLinkToCloud = async (
  hw: HomeworkAssignment,
  explicitOwnerUid?: string,
  options?: { forceVerifyAndWrite?: boolean }
): Promise<{ saved: boolean; collision?: boolean }> => {
  const activeUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || '';
  if (activeUid && hw.ownerUid && hw.ownerUid.trim() !== '' && hw.ownerUid.trim() !== activeUid) {
    return { saved: false };
  }
  if (testCloudTransport) {
    if (testCloudTransport.saveShortLink) {
      return await testCloudTransport.saveShortLink(hw, activeUid || undefined, options);
    }
    const cleanShortId = (hw?.shortId || '').trim();
    const safeHwId = sanitizeDocId(hw?.id || '');
    if (testCloudTransport.fetchShortLink && cleanShortId) {
      const existingDoc = await testCloudTransport.fetchShortLink(cleanShortId).catch(() => null);
      if (existingDoc && existingDoc.status !== 'not_found') {
        const docHwId = String(existingDoc.assignmentId || existingDoc.assignment?.id || '').trim();
        const docOwnerUid = String(existingDoc.ownerUid || existingDoc.assignment?.ownerUid || '').trim();
        if (
          (docHwId && docHwId !== hw.id && docHwId !== safeHwId) ||
          (docOwnerUid && activeUid && docOwnerUid !== activeUid)
        ) {
          return { saved: false, collision: true };
        }
      }
    }
    return { saved: true };
  }
  return await saveShortLinkToFirestore(hw, activeUid || undefined, options);
};

const activeRevokeShortLinkInCloud = async (
  shortId: string,
  assignmentId: string,
  explicitOwnerUid?: string
): Promise<boolean> => {
  const activeUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || '';
  if (testCloudTransport) {
    if (testCloudTransport.revokeShortLink) {
      return await testCloudTransport.revokeShortLink(shortId, assignmentId, activeUid || undefined);
    }
    return true;
  }
  return await revokeShortLinkInFirestore(shortId, assignmentId, activeUid || undefined);
};

const activeSaveSubmissionToCloud = (sub: HomeworkSubmission) =>
  testCloudTransport?.saveSubmission
    ? testCloudTransport.saveSubmission(sub)
    : saveSubmissionToFirestore(sub);

const activeFetchAssignmentFromCloud = (id: string) =>
  testCloudTransport?.fetchAssignment
    ? testCloudTransport.fetchAssignment(id)
    : fetchAssignmentFromFirestore(id);

const activeFetchShortLinkFromCloud = (shortId: string) =>
  testCloudTransport?.fetchShortLink
    ? testCloudTransport.fetchShortLink(shortId)
    : fetchShortLinkFromFirestore(shortId);

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

const activeDeleteAssignmentFromCloud = (id: string, ownerUid?: string, shortIdHint?: string) =>
  testCloudTransport?.deleteAssignment
    ? testCloudTransport.deleteAssignment(id, ownerUid, shortIdHint)
    : deleteAssignmentFromFirestore(id, ownerUid, shortIdHint);

const activeDeleteSubmissionsForAssignmentFromCloud = (id: string, ownerUid?: string) =>
  testCloudTransport?.deleteSubmissionsForAssignment
    ? testCloudTransport.deleteSubmissionsForAssignment(id, ownerUid)
    : deleteSubmissionsForAssignmentFromFirestore(id, ownerUid);

export function getRevokedShortIdsLocally(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(REVOKED_SHORT_IDS_STORAGE_KEY);
    const parsed: string[] = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string' && s.length > 0) : []);
  } catch {
    return new Set();
  }
}

export function isShortIdRevokedLocally(shortId?: string | null): boolean {
  const clean = (shortId || '').trim();
  if (!clean) return false;
  return getRevokedShortIdsLocally().has(clean);
}

export function markShortIdRevokedLocally(shortId?: string | null): void {
  const clean = (shortId || '').trim();
  if (typeof window === 'undefined' || !clean) return;
  try {
    const set = getRevokedShortIdsLocally();
    set.add(clean);
    localStorage.setItem(REVOKED_SHORT_IDS_STORAGE_KEY, JSON.stringify(Array.from(set).slice(-1000)));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearShortIdRevokedLocally(shortId?: string | null): void {
  const clean = (shortId || '').trim();
  if (typeof window === 'undefined' || !clean) return;
  try {
    const set = getRevokedShortIdsLocally();
    if (set.delete(clean)) {
      localStorage.setItem(REVOKED_SHORT_IDS_STORAGE_KEY, JSON.stringify(Array.from(set).slice(-1000)));
    }
  } catch {
    // Ignore storage quota errors
  }
}

const inFlightAssignmentSaves = new Set<string>();
const recentlyConfirmedAssignmentSaves = new Map<string, number>();

function markAssignmentRecentlySaved(assignmentId: string, ttlMs = 60000): void {
  if (!assignmentId) return;
  const expiry = Date.now() + ttlMs;
  const safeId = sanitizeDocId(assignmentId);
  recentlyConfirmedAssignmentSaves.set(assignmentId, expiry);
  recentlyConfirmedAssignmentSaves.set(safeId, expiry);
}

function clearAssignmentRecentlySaved(assignmentId: string): void {
  if (!assignmentId) return;
  const safeId = sanitizeDocId(assignmentId);
  recentlyConfirmedAssignmentSaves.delete(assignmentId);
  recentlyConfirmedAssignmentSaves.delete(safeId);
}

function isAssignmentProtectedFromRemotePrune(assignmentId: string): boolean {
  if (!assignmentId) return false;
  const safeId = sanitizeDocId(assignmentId);
  if (inFlightAssignmentSaves.has(assignmentId) || inFlightAssignmentSaves.has(safeId)) {
    return true;
  }
  const now = Date.now();
  const exp1 = recentlyConfirmedAssignmentSaves.get(assignmentId) || 0;
  const exp2 = recentlyConfirmedAssignmentSaves.get(safeId) || 0;
  if (exp1 > now || exp2 > now) {
    return true;
  }
  if (exp1 > 0) recentlyConfirmedAssignmentSaves.delete(assignmentId);
  if (exp2 > 0) recentlyConfirmedAssignmentSaves.delete(safeId);
  return false;
}

export function saveLocalAssignment(hw: HomeworkAssignment, syncCloud = true): boolean {
  if (typeof window === 'undefined' || !hw || !hw.id) return false;
  const activeUid = getCurrentHomeworkOwnerUid();
  const scopeUid = getActiveHomeworkScopeUid();
  const recordOwnerUid = hw.ownerUid?.trim() || '';

  // Reject cross-account writes: Account B can never save or overwrite an assignment owned by Account A
  if (activeUid && recordOwnerUid && recordOwnerUid !== activeUid) {
    return false;
  }

  if ((hw as any).deleted) {
    if (hw.shortId) markShortIdRevokedLocally(hw.shortId);
    deleteLocalAssignment(hw.id, false);
    return true;
  }
  if (isAssignmentDeletedLocally(hw.id, scopeUid)) return false;

  const currentList = getLocalAssignments(scopeUid);
  const existing = currentList.find((a) => a.id === hw.id);
  // Prevent mutating ownerUid on an already-owned assignment
  if (existing?.ownerUid && recordOwnerUid && existing.ownerUid !== recordOwnerUid) {
    return false;
  }

  const resolvedOwnerUid = activeUid || recordOwnerUid || existing?.ownerUid || undefined;
  const resolvedOwnerEmail =
    hw.ownerEmail?.trim() || getCurrentHomeworkOwnerEmail() || existing?.ownerEmail || undefined;
  const resolvedShortId = hw.shortId?.trim() || existing?.shortId?.trim() || undefined;
  const resolvedOriginalShortId =
    existing?.originalShortId?.trim() ||
    hw.originalShortId?.trim() ||
    existing?.shortId?.trim() ||
    resolvedShortId ||
    undefined;

  if ((hw.isActive === false || hw.status === 'closed') && resolvedShortId) {
    markShortIdRevokedLocally(resolvedShortId);
  } else if (hw.isActive === true && hw.status !== 'closed' && resolvedShortId) {
    clearShortIdRevokedLocally(resolvedShortId);
  }

  const normalizedHw = normalizeHomeworkAssignment({
    ...existing,
    ...hw,
    ...(resolvedShortId ? { shortId: resolvedShortId } : {}),
    ...(resolvedOriginalShortId ? { originalShortId: resolvedOriginalShortId } : {}),
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    ...(resolvedOwnerEmail ? { ownerEmail: resolvedOwnerEmail } : {})
  });
  const resolvedCloudSynced = syncCloud
    ? false
    : (hw.cloudSynced ?? existing?.cloudSynced ?? true);
  const resolvedCreatePending =
    (hw as any).cloudCreatePending !== undefined
      ? Boolean((hw as any).cloudCreatePending)
      : resolvedCloudSynced === false && Boolean((existing as any)?.cloudCreatePending);

  const initialRecord: HomeworkAssignment = {
    ...normalizedHw,
    cloudSynced: resolvedCloudSynced,
    ...(resolvedCreatePending ? { cloudCreatePending: true } : { cloudCreatePending: false })
  } as HomeworkAssignment;

  const contentChanged = !existing || !areAssignmentRecordsEqual(existing, initialRecord);
  const metadataChanged =
    !existing ||
    existing.cloudSynced !== initialRecord.cloudSynced ||
    Boolean((existing as any).cloudCreatePending) !== Boolean((initialRecord as any).cloudCreatePending);

  if (contentChanged || metadataChanged) {
    const current = currentList.filter((a) => a.id !== hw.id);
    current.unshift(initialRecord);
    writeLocalAssignmentsList(current, scopeUid);
  }

  if (syncCloud) {
    const scopeAtStart = scopeUid;
    markAssignmentRecentlySaved(hw.id);
    activeSaveAssignmentToCloud(initialRecord)
      .then((ok) => {
        if (!ok) return;
        // Abort if account switched while cloud write was in flight
        if (getActiveHomeworkScopeUid() !== scopeAtStart) return;
        markAssignmentRecentlySaved(hw.id);
        const updated = getLocalAssignments(scopeAtStart).map((a) =>
          a.id === hw.id ? ({ ...a, cloudSynced: true, cloudCreatePending: false } as HomeworkAssignment) : a
        );
        writeLocalAssignmentsList(updated, scopeAtStart);
        notifyHomeworkSyncStateChanged({ assignmentsChanged: false, submissionsChanged: false });
      })
      .catch(() => {});
  }

  return contentChanged;
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

  const localList = getLocalAssignments(scopeAtStart);
  const existing = localList.find((a) => a.id === hw.id);
  if (existing?.ownerUid && recordOwnerUid && existing.ownerUid !== recordOwnerUid) {
    throw new Error('لا يمكن تغيير ملكية الواجب بعد إنشائه.');
  }

  const resolvedOwnerUid = activeUid || recordOwnerUid || existing?.ownerUid || undefined;
  const resolvedOwnerEmail =
    hw.ownerEmail?.trim() || getCurrentHomeworkOwnerEmail() || existing?.ownerEmail || undefined;

  const existingShortIds = new Set(
    localList
      .filter((a) => a.id !== hw.id && a.shortId)
      .map((a) => String(a.shortId).trim())
  );
  let candidateShortId = (hw.shortId || existing?.shortId || '').trim();
  if (!isValidHomeworkShortId(candidateShortId) || existingShortIds.has(candidateShortId)) {
    candidateShortId = createHomeworkShortId(7, existingShortIds);
  }

  let normalizedHw = normalizeHomeworkAssignment({
    ...existing,
    ...hw,
    shortId: candidateShortId,
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    ...(resolvedOwnerEmail ? { ownerEmail: resolvedOwnerEmail } : {})
  });

  const safeId = sanitizeDocId(normalizedHw.id);
  inFlightAssignmentSaves.add(normalizedHw.id);
  inFlightAssignmentSaves.add(safeId);
  markAssignmentRecentlySaved(normalizedHw.id);

  try {
    saveLocalAssignment(
      { ...normalizedHw, cloudSynced: false, cloudCreatePending: true } as HomeworkAssignment,
      false
    );

    let cloudOk = false;
    const triedShortIds = new Set<string>(existingShortIds);
    for (let attempt = 0; attempt < 5; attempt++) {
      triedShortIds.add(normalizedHw.shortId || '');
      try {
        cloudOk = await activeSaveAssignmentToCloud(normalizedHw);
        break;
      } catch (err: any) {
        const isCollision =
          err?.code === 'SHORT_ID_COLLISION' ||
          String(err?.message || '').includes('SHORT_ID_COLLISION') ||
          err?.status === 409;
        if (isCollision && attempt < 4) {
          const freshShortId = createHomeworkShortId(7, triedShortIds);
          normalizedHw = {
            ...normalizedHw,
            shortId: freshShortId
          };
          saveLocalAssignment(
            { ...normalizedHw, cloudSynced: false, cloudCreatePending: true } as HomeworkAssignment,
            false
          );
          continue;
        }
        cloudOk = false;
        break;
      }
    }

    markAssignmentRecentlySaved(normalizedHw.id);
    const finalHw: HomeworkAssignment = {
      ...normalizedHw,
      cloudSynced: cloudOk,
      // Only assignments created through this confirmed save flow are eligible for safe offline retry.
      // Legacy local-only records intentionally remain ineligible to prevent resurrection.
      ...(cloudOk ? { cloudCreatePending: false } : { cloudCreatePending: true })
    };
    if (getActiveHomeworkScopeUid() === scopeAtStart) {
      saveLocalAssignment(finalHw, false);
      notifyHomeworkSyncStateChanged({ assignmentsChanged: true, submissionsChanged: false });
    }
    return { assignment: finalHw, cloudSynced: cloudOk };
  } finally {
    inFlightAssignmentSaves.delete(normalizedHw.id);
    inFlightAssignmentSaves.delete(safeId);
  }
}

/**
 * Closes (`isActive = false`) or reopens (`isActive = true`) a homework assignment directly
 * from Android or Web, updating local state, P2P sync metadata, `homework_assignments`,
 * and `homework_short_links` in Homework Cloud.
 */
export async function setHomeworkAssignmentActiveStatus(
  assignmentId: string,
  isActive: boolean
): Promise<{ assignment: HomeworkAssignment | null; cloudSynced: boolean }> {
  if (!assignmentId) return { assignment: null, cloudSynced: false };
  const scopeUid = getActiveHomeworkScopeUid();
  const safeId = sanitizeDocId(assignmentId);
  const existing = getLocalAssignments(scopeUid).find(
    (a) => a.id === assignmentId || sanitizeDocId(a.id) === safeId
  );
  if (!existing) {
    return { assignment: null, cloudSynced: false };
  }

  if (existing.shortId) {
    if (isActive) {
      clearShortIdRevokedLocally(existing.shortId);
    } else {
      markShortIdRevokedLocally(existing.shortId);
    }
  }

  const updated: HomeworkAssignment = {
    ...existing,
    isActive,
    status: isActive ? 'active' : 'closed',
    updatedAt: Date.now()
  } as HomeworkAssignment;

  return await saveAssignmentWithConfirmation(updated);
}

/**
 * Updates editable homework assignment metadata (title, maxAttempts, allowReplay, hideTeacherBranding)
 * directly on Android or Web and persists the updated snapshot to Homework Cloud & P2P.
 */
export async function updateHomeworkAssignmentMetadata(
  assignmentId: string,
  updates: Partial<Pick<HomeworkAssignment, 'title' | 'maxAttempts' | 'allowReplay' | 'hideTeacherBranding'>>
): Promise<{ assignment: HomeworkAssignment | null; cloudSynced: boolean }> {
  if (!assignmentId) return { assignment: null, cloudSynced: false };
  const scopeUid = getActiveHomeworkScopeUid();
  const safeId = sanitizeDocId(assignmentId);
  const existing = getLocalAssignments(scopeUid).find(
    (a) => a.id === assignmentId || sanitizeDocId(a.id) === safeId
  );
  if (!existing) {
    return { assignment: null, cloudSynced: false };
  }

  const nextTitle = updates.title !== undefined ? updates.title.trim() || existing.title : existing.title;
  const updated: HomeworkAssignment = {
    ...existing,
    ...updates,
    title: nextTitle,
    updatedAt: Date.now()
  } as HomeworkAssignment;

  return await saveAssignmentWithConfirmation(updated);
}

function findAssignmentAcrossLocalScopes(assignmentId: string): HomeworkAssignment | null {
  if (typeof window === 'undefined' || !assignmentId) return null;
  const safeId = sanitizeDocId(assignmentId);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('glueck_hw_assignments_v3_')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const list: HomeworkAssignment[] = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      const found = list.find((a) => a && (a.id === assignmentId || sanitizeDocId(a.id) === safeId));
      if (found) return found;
    }
  } catch {
    // Ignore storage inspection errors
  }
  return null;
}

/**
 * Restores the original short-link ID (`originalShortId` or `shortId`) for an existing online assignment
 * if its Firestore short-link record was accidentally deleted or superseded.
 *
 * Security & Consistency Guarantees:
 * - Verifies teacher ownership (`ownerUid`) and rejects unauthorized callers.
 * - Does not create a duplicate assignment or reset student attempts/submissions.
 * - Verifies the original shortId is not occupied by another assignment or teacher before writing.
 * - Performs cloud restoration before mutating canonical local state so partial failures never corrupt links.
 */
export async function restoreOriginalHomeworkShortLink(
  assignmentId: string,
  options?: {
    explicitOwnerUid?: string;
    preferredOriginalShortId?: string;
  }
): Promise<HomeworkLinkManagementResult> {
  const cleanAssignmentId = (assignmentId || '').trim();
  if (!cleanAssignmentId) {
    return {
      success: false,
      status: 'not_found',
      error: 'معرف الواجب مطلوب لاستعادة الرابط.'
    };
  }

  const activeUid =
    options?.explicitOwnerUid !== undefined
      ? (options.explicitOwnerUid || '').trim()
      : (getCurrentHomeworkOwnerUid() || '').trim();

  if (!activeUid) {
    return {
      success: false,
      status: 'unauthorized',
      error: 'يرجى تسجيل الدخول بحساب المعلم المالك لاستعادة الرابط الأصلي.'
    };
  }

  const safeId = sanitizeDocId(cleanAssignmentId);
  const localScoped = getLocalAssignments(activeUid);
  let existing = localScoped.find(
    (a) => a.id === cleanAssignmentId || sanitizeDocId(a.id) === safeId
  );

  if (!existing) {
    const crossScopeMatch = findAssignmentAcrossLocalScopes(cleanAssignmentId);
    if (crossScopeMatch) {
      const crossOwner = (crossScopeMatch.ownerUid || '').trim();
      if (crossOwner && crossOwner !== activeUid) {
        return {
          success: false,
          status: 'unauthorized',
          error: 'غير مصرح لك باستعادة رابط واجب تابع لمعلم آخر.'
        };
      }
      existing = crossScopeMatch;
    }
  }

  if (!existing) {
    const cloudHw = await activeFetchAssignmentFromCloud(cleanAssignmentId).catch(() => null);
    if (cloudHw) {
      const cloudOwner = (cloudHw.ownerUid || '').trim();
      if (cloudOwner && cloudOwner !== activeUid) {
        return {
          success: false,
          status: 'unauthorized',
          error: 'غير مصرح لك باستعادة رابط واجب تابع لمعلم آخر.'
        };
      }
      existing = cloudHw;
    }
  }

  if (!existing) {
    return {
      success: false,
      status: 'not_found',
      error: 'الواجب غير موجود أو تعذر العثور عليه.'
    };
  }

  const recordOwnerUid = (existing.ownerUid || '').trim();
  if (recordOwnerUid && recordOwnerUid !== activeUid) {
    return {
      success: false,
      status: 'unauthorized',
      error: 'غير مصرح لك باستعادة رابط واجب تابع لمعلم آخر.'
    };
  }

  if (
    (existing as any).deleted === true ||
    existing.status === 'deleted' ||
    isAssignmentDeletedLocally(existing.id, activeUid)
  ) {
    return {
      success: false,
      status: 'deleted',
      error: 'هذا الواجب محذوف ولا يمكن استعادة رابطه.'
    };
  }

  const previousShortId = (existing.shortId || '').trim();
  const storedOriginalShortId = (existing.originalShortId || '').trim();
  const preferredShortId = (options?.preferredOriginalShortId || '').trim();

  if (
    preferredShortId &&
    storedOriginalShortId &&
    preferredShortId !== storedOriginalShortId &&
    preferredShortId !== previousShortId
  ) {
    return {
      success: false,
      status: 'invalid_id',
      error: 'الرابط المطلوب لا يطابق الرابط الأصلي المسجل لهذا الواجب.'
    };
  }

  const targetShortId = storedOriginalShortId || preferredShortId || previousShortId;
  if (!isValidHomeworkShortId(targetShortId)) {
    return {
      success: false,
      status: 'invalid_id',
      error: 'الرابط الأصلي غير متاح أو غير صالح.'
    };
  }

  // Check local assignments for collision with another assignment
  const localCollision = localScoped.some(
    (a) =>
      a.id !== existing!.id &&
      sanitizeDocId(a.id) !== safeId &&
      ((a.shortId || '').trim() === targetShortId ||
        (a.originalShortId || '').trim() === targetShortId)
  );
  if (localCollision) {
    return {
      success: false,
      status: 'collision',
      shortId: targetShortId,
      error: 'الرابط الأصلي مستخدم بالفعل في واجب آخر ولا يمكن استعادته.'
    };
  }

  const restoredHw: HomeworkAssignment = normalizeHomeworkAssignment({
    ...existing,
    shortId: targetShortId,
    originalShortId: storedOriginalShortId || targetShortId,
    ownerUid: activeUid,
    isActive: existing.isActive !== false && existing.status !== 'closed',
    status: existing.isActive === false || existing.status === 'closed' ? 'closed' : 'active',
    updatedAt: Date.now(),
    cloudSynced: true,
    cloudCreatePending: false
  });

  inFlightAssignmentSaves.add(restoredHw.id);
  inFlightAssignmentSaves.add(safeId);
  markAssignmentRecentlySaved(restoredHw.id);

  try {
    // Step 1: Verify & write the restored short link in cloud
    const shortRes = await activeSaveShortLinkToCloud(restoredHw, activeUid, {
      forceVerifyAndWrite: true
    });
    if (shortRes.collision) {
      return {
        success: false,
        status: 'collision',
        shortId: targetShortId,
        error: 'الرابط الأصلي محجوز لواجب آخر في السحابة ولا يمكن الكتابة فوقه.'
      };
    }
    if (!shortRes.saved) {
      return {
        success: false,
        status: 'failed',
        shortId: previousShortId || targetShortId,
        error: 'تعذر استعادة الرابط الأصلي في السحابة. لم يتم تغيير الرابط الحالي.'
      };
    }

    // Step 2: Update the assignment record in cloud
    let hwSaved = false;
    try {
      hwSaved = await activeSaveAssignmentToCloud(restoredHw, activeUid);
    } catch (err: any) {
      if (
        err?.code === 'SHORT_ID_COLLISION' ||
        String(err?.message || '').includes('SHORT_ID_COLLISION') ||
        err?.status === 409
      ) {
        return {
          success: false,
          status: 'collision',
          shortId: targetShortId,
          error: 'الرابط الأصلي محجوز لواجب آخر في السحابة ولا يمكن الكتابة فوقه.'
        };
      }
      hwSaved = false;
    }

    if (!hwSaved) {
      if (previousShortId && previousShortId !== targetShortId) {
        await activeRevokeShortLinkInCloud(targetShortId, existing.id, activeUid).catch(() => false);
      }
      return {
        success: false,
        status: 'failed',
        shortId: previousShortId || targetShortId,
        error: 'تعذر تحديث الواجب في السحابة. تم الحفاظ على الحالة السابقة.'
      };
    }

    // Step 3: If restoring switched away from a different active shortId, revoke that previous shortId
    if (previousShortId && previousShortId !== targetShortId && isValidHomeworkShortId(previousShortId)) {
      const revokedPrev = await activeRevokeShortLinkInCloud(
        previousShortId,
        existing.id,
        activeUid
      ).catch(() => false);
      if (!revokedPrev) {
        // Rollback so canonical state never leaves two links or a broken reference
        await activeSaveAssignmentToCloud(existing, activeUid).catch(() => false);
        await activeRevokeShortLinkInCloud(targetShortId, existing.id, activeUid).catch(() => false);
        return {
          success: false,
          status: 'failed',
          shortId: previousShortId,
          error: 'تعذر إيقاف الرابط السابق بأمان. تم التراجع للحفاظ على سلامة الرابط الحالي.'
        };
      }
      markShortIdRevokedLocally(previousShortId);
    }

    clearShortIdRevokedLocally(targetShortId);
    saveLocalAssignment(restoredHw, false);
    const shareUrl = buildHomeworkShareUrl(restoredHw);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gluck-homework-short-link-updated', {
          detail: {
            action: 'restored',
            assignmentId: restoredHw.id,
            shortId: targetShortId,
            previousShortId,
            originalShortId: restoredHw.originalShortId,
            shareUrl
          }
        })
      );
    }
    notifyHomeworkSyncStateChanged({ assignmentsChanged: true, submissionsChanged: false });

    return {
      success: true,
      status: 'restored',
      assignment: restoredHw,
      shortId: targetShortId,
      previousShortId,
      originalShortId: restoredHw.originalShortId,
      shareUrl
    };
  } finally {
    inFlightAssignmentSaves.delete(restoredHw.id);
    inFlightAssignmentSaves.delete(safeId);
  }
}

/**
 * Generates a new unique short-link ID for an existing online assignment,
 * makes the new link canonical, and revokes the previous link so it stops resolving.
 *
 * Security & Consistency Guarantees:
 * - Verifies teacher ownership (`ownerUid`) and rejects unauthorized callers.
 * - Preserves the assignment ID, questions, settings, students, and all student submissions/progress.
 * - Never leaves the assignment pointing to a missing or invalid canonical link on partial failure.
 */
export async function regenerateHomeworkShortLink(
  assignmentId: string,
  options?: {
    explicitOwnerUid?: string;
    requestedNewShortId?: string;
  }
): Promise<HomeworkLinkManagementResult> {
  const cleanAssignmentId = (assignmentId || '').trim();
  if (!cleanAssignmentId) {
    return {
      success: false,
      status: 'not_found',
      error: 'معرف الواجب مطلوب لتوليد رابط جديد.'
    };
  }

  const activeUid =
    options?.explicitOwnerUid !== undefined
      ? (options.explicitOwnerUid || '').trim()
      : (getCurrentHomeworkOwnerUid() || '').trim();

  if (!activeUid) {
    return {
      success: false,
      status: 'unauthorized',
      error: 'يرجى تسجيل الدخول بحساب المعلم المالك لتوليد رابط جديد.'
    };
  }

  const safeId = sanitizeDocId(cleanAssignmentId);
  const localScoped = getLocalAssignments(activeUid);
  let existing = localScoped.find(
    (a) => a.id === cleanAssignmentId || sanitizeDocId(a.id) === safeId
  );

  if (!existing) {
    const crossScopeMatch = findAssignmentAcrossLocalScopes(cleanAssignmentId);
    if (crossScopeMatch) {
      const crossOwner = (crossScopeMatch.ownerUid || '').trim();
      if (crossOwner && crossOwner !== activeUid) {
        return {
          success: false,
          status: 'unauthorized',
          error: 'غير مصرح لك بتوليد رابط جديد لواجب تابع لمعلم آخر.'
        };
      }
      existing = crossScopeMatch;
    }
  }

  if (!existing) {
    const cloudHw = await activeFetchAssignmentFromCloud(cleanAssignmentId).catch(() => null);
    if (cloudHw) {
      const cloudOwner = (cloudHw.ownerUid || '').trim();
      if (cloudOwner && cloudOwner !== activeUid) {
        return {
          success: false,
          status: 'unauthorized',
          error: 'غير مصرح لك بتوليد رابط جديد لواجب تابع لمعلم آخر.'
        };
      }
      existing = cloudHw;
    }
  }

  if (!existing) {
    return {
      success: false,
      status: 'not_found',
      error: 'الواجب غير موجود أو تعذر العثور عليه.'
    };
  }

  const recordOwnerUid = (existing.ownerUid || '').trim();
  if (recordOwnerUid && recordOwnerUid !== activeUid) {
    return {
      success: false,
      status: 'unauthorized',
      error: 'غير مصرح لك بتوليد رابط جديد لواجب تابع لمعلم آخر.'
    };
  }

  if (
    (existing as any).deleted === true ||
    existing.status === 'deleted' ||
    isAssignmentDeletedLocally(existing.id, activeUid)
  ) {
    return {
      success: false,
      status: 'deleted',
      error: 'هذا الواجب محذوف ولا يمكن توليد رابط جديد له.'
    };
  }

  const previousShortId = (existing.shortId || '').trim();
  const preservedOriginalShortId = (existing.originalShortId || previousShortId || '').trim();

  const excludedShortIds = new Set<string>();
  if (previousShortId) excludedShortIds.add(previousShortId);
  if (preservedOriginalShortId) excludedShortIds.add(preservedOriginalShortId);
  for (const hw of localScoped) {
    if (hw.shortId) excludedShortIds.add(hw.shortId.trim());
    if (hw.originalShortId) excludedShortIds.add(hw.originalShortId.trim());
  }
  for (const revId of getRevokedShortIdsLocally()) {
    if (revId) excludedShortIds.add(revId.trim());
  }

  inFlightAssignmentSaves.add(existing.id);
  inFlightAssignmentSaves.add(safeId);
  markAssignmentRecentlySaved(existing.id);

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const cleanRequested =
        attempt === 0 && options?.requestedNewShortId ? options.requestedNewShortId.trim() : '';
      if (cleanRequested && !isValidHomeworkShortId(cleanRequested)) {
        return {
          success: false,
          status: 'invalid_id',
          error: 'معرف الرابط المختصر المطلوب غير صالح.'
        };
      }
      if (cleanRequested && excludedShortIds.has(cleanRequested)) {
        return {
          success: false,
          status: 'collision',
          shortId: cleanRequested,
          error: 'الرابط المختصر المطلوب مستخدم بالفعل.'
        };
      }

      const candidateShortId = cleanRequested || createHomeworkShortId(7, excludedShortIds);
      excludedShortIds.add(candidateShortId);

      const updatedHw: HomeworkAssignment = normalizeHomeworkAssignment({
        ...existing,
        shortId: candidateShortId,
        originalShortId: preservedOriginalShortId || candidateShortId,
        ownerUid: activeUid,
        isActive: existing.isActive !== false && existing.status !== 'closed',
        status: existing.isActive === false || existing.status === 'closed' ? 'closed' : 'active',
        updatedAt: Date.now(),
        cloudSynced: true,
        cloudCreatePending: false
      });

      // Step 1: Write the new short link record first (verifying no collision)
      const shortSaveRes = await activeSaveShortLinkToCloud(updatedHw, activeUid, {
        forceVerifyAndWrite: true
      });
      if (shortSaveRes.collision) {
        if (!cleanRequested && attempt < 4) {
          continue;
        }
        return {
          success: false,
          status: 'collision',
          shortId: candidateShortId,
          error: 'حدث تعارض في معرف الرابط المختصر الجديد. يرجى المحاولة مرة أخرى.'
        };
      }
      if (!shortSaveRes.saved) {
        return {
          success: false,
          status: 'failed',
          shortId: previousShortId,
          error: 'تعذر إنشاء الرابط الجديد في السحابة. لم يتم تغيير الرابط الحالي.'
        };
      }

      // Step 2: Update the assignment record to point to candidateShortId
      let hwSaved = false;
      try {
        hwSaved = await activeSaveAssignmentToCloud(updatedHw, activeUid);
      } catch (err: any) {
        const isCollision =
          err?.code === 'SHORT_ID_COLLISION' ||
          String(err?.message || '').includes('SHORT_ID_COLLISION') ||
          err?.status === 409;
        if (isCollision) {
          await activeRevokeShortLinkInCloud(candidateShortId, existing.id, activeUid).catch(() => false);
          if (!cleanRequested && attempt < 4) {
            continue;
          }
          return {
            success: false,
            status: 'collision',
            shortId: candidateShortId,
            error: 'حدث تعارض في معرف الرابط المختصر الجديد.'
          };
        }
        hwSaved = false;
      }

      if (!hwSaved) {
        // Rollback Step 1 so candidateShortId does not remain active while assignment points to previousShortId
        await activeRevokeShortLinkInCloud(candidateShortId, existing.id, activeUid).catch(() => false);
        return {
          success: false,
          status: 'failed',
          shortId: previousShortId,
          error: 'تعذر تحديث الواجب بالرابط الجديد في السحابة. تم الحفاظ على الرابط الحالي دون تغيير.'
        };
      }

      // Step 3: Revoke the previous short link so it stops resolving
      if (previousShortId && previousShortId !== candidateShortId && isValidHomeworkShortId(previousShortId)) {
        const oldRevoked = await activeRevokeShortLinkInCloud(
          previousShortId,
          existing.id,
          activeUid
        ).catch(() => false);
        if (!oldRevoked) {
          // Rollback Step 2 and Step 1 so canonical state remains 100% consistent
          await activeSaveAssignmentToCloud(existing, activeUid).catch(() => false);
          await activeRevokeShortLinkInCloud(candidateShortId, existing.id, activeUid).catch(() => false);
          return {
            success: false,
            status: 'failed',
            shortId: previousShortId,
            error: 'تعذر إيقاف الرابط القديم بأمان. تم التراجع والحفاظ على الرابط الأصلي.'
          };
        }
        markShortIdRevokedLocally(previousShortId);
      }

      clearShortIdRevokedLocally(candidateShortId);
      saveLocalAssignment(updatedHw, false);
      const shareUrl = buildHomeworkShareUrl(updatedHw);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gluck-homework-short-link-updated', {
            detail: {
              action: 'regenerated',
              assignmentId: updatedHw.id,
              shortId: candidateShortId,
              previousShortId,
              originalShortId: updatedHw.originalShortId,
              shareUrl
            }
          })
        );
      }
      notifyHomeworkSyncStateChanged({ assignmentsChanged: true, submissionsChanged: false });

      return {
        success: true,
        status: 'regenerated',
        assignment: updatedHw,
        shortId: candidateShortId,
        previousShortId,
        originalShortId: updatedHw.originalShortId,
        shareUrl
      };
    }

    return {
      success: false,
      status: 'collision',
      shortId: previousShortId,
      error: 'تعذر توليد رابط فريد بعد عدة محاولات. لم يتم تغيير الرابط الحالي.'
    };
  } finally {
    inFlightAssignmentSaves.delete(existing.id);
    inFlightAssignmentSaves.delete(safeId);
  }
}

export interface DeleteLocalAssignmentOptions {
  isManualDelete?: boolean;
  markShortIdRevoked?: boolean;
}

export function deleteLocalAssignment(
  assignmentId: string,
  syncCloud = true,
  options?: DeleteLocalAssignmentOptions
): void {
  if (typeof window === 'undefined' || !assignmentId) return;
  const activeUid = getCurrentHomeworkOwnerUid();
  const scopeUid = getActiveHomeworkScopeUid();
  const safeId = sanitizeDocId(assignmentId);
  const isManual = syncCloud === true || options?.isManualDelete === true;
  const shouldRevokeShortId = isManual || options?.markShortIdRevoked === true;

  const existing = getLocalAssignments(scopeUid).find(
    (a) => a.id === assignmentId || sanitizeDocId(a.id) === safeId
  );
  if (activeUid && existing?.ownerUid && existing.ownerUid !== activeUid) {
    return;
  }

  const existingShortId = existing?.shortId?.trim() || undefined;
  const resolvedOwnerUid = activeUid || existing?.ownerUid?.trim() || undefined;
  if (existingShortId && shouldRevokeShortId) {
    markShortIdRevokedLocally(existingShortId);
  }

  clearAssignmentRecentlySaved(assignmentId);
  markAssignmentDeletedLocally(assignmentId, scopeUid);
  if (isManual) {
    markAssignmentManuallyDeletedLocally(assignmentId, scopeUid);
  }
  try {
    if (existing) {
      saveArchivedAssignmentMetadata({ ...existing, ownerUid: resolvedOwnerUid }, scopeUid);
    }

    const remainingAssignments = getLocalAssignments(scopeUid).filter(
      (a) => a.id !== assignmentId && sanitizeDocId(a.id) !== safeId
    );
    writeLocalAssignmentsList(remainingAssignments, scopeUid);

    // Preserve all historical student submissions even after assignment deletion!
    const preservedSubmissions = getLocalSubmissions(scopeUid);

    window.dispatchEvent(
      new CustomEvent('gluck-homework-deleted', {
        detail: {
          assignmentId,
          safeId,
          shortId: existingShortId,
          remainingAssignments,
          remainingSubmissions: preservedSubmissions,
          ownerUid: resolvedOwnerUid,
          userInitiated: isManual
        }
      })
    );
    notifyHomeworkSyncStateChanged({ assignmentsChanged: true, submissionsChanged: false });
  } catch {
    // Ignore storage errors
  }
  if (syncCloud) {
    enqueuePendingHomeworkDelete(
      {
        assignmentId,
        ownerUid: resolvedOwnerUid,
        shortId: existingShortId,
        deletedAt: Date.now()
      },
      scopeUid
    );
    activeDeleteAssignmentFromCloud(assignmentId, resolvedOwnerUid, existingShortId)
      .catch(() => false)
      .then((hwOk) => {
        if (hwOk && getActiveHomeworkScopeUid() === scopeUid) {
          dequeuePendingHomeworkDelete(assignmentId, scopeUid);
          notifyHomeworkSyncStateChanged({ assignmentsChanged: false, submissionsChanged: false });
        }
      })
      .catch(() => {});
  }
}

export async function deleteHomeworkAssignmentWithConfirmation(
  assignmentId: string,
  options?: { shortIdHint?: string; ownerUidHint?: string }
): Promise<{
  deletedLocally: boolean;
  cloudDeleted: boolean;
  queuedForRetry: boolean;
}> {
  if (typeof window === 'undefined' || !assignmentId) {
    return { deletedLocally: false, cloudDeleted: false, queuedForRetry: false };
  }
  const activeUid = getCurrentHomeworkOwnerUid();
  const scopeUid = getActiveHomeworkScopeUid();
  const safeId = sanitizeDocId(assignmentId);
  const existing = getLocalAssignments(scopeUid).find(
    (a) => a.id === assignmentId || sanitizeDocId(a.id) === safeId
  );
  if (activeUid && existing?.ownerUid && existing.ownerUid !== activeUid) {
    return { deletedLocally: false, cloudDeleted: false, queuedForRetry: false };
  }

  const existingShortId = options?.shortIdHint?.trim() || existing?.shortId?.trim() || undefined;
  const resolvedOwnerUid = activeUid || existing?.ownerUid?.trim() || options?.ownerUidHint?.trim() || undefined;

  if (existingShortId) {
    markShortIdRevokedLocally(existingShortId);
  }

  enqueuePendingHomeworkDelete(
    {
      assignmentId,
      ownerUid: resolvedOwnerUid,
      shortId: existingShortId,
      deletedAt: Date.now()
    },
    scopeUid
  );

  deleteLocalAssignment(assignmentId, false, {
    isManualDelete: true,
    markShortIdRevoked: true
  });

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { deletedLocally: true, cloudDeleted: false, queuedForRetry: true };
  }
  if (!resolvedOwnerUid) {
    return { deletedLocally: true, cloudDeleted: false, queuedForRetry: true };
  }

  // Canonical deletion revokes short link(s) first and deletes the assignment doc,
  // while preserving historical homework_submissions for teacher reports.
  const hwOk = await activeDeleteAssignmentFromCloud(
    assignmentId,
    resolvedOwnerUid,
    existingShortId
  ).catch(() => false);

  const cloudDeleted = Boolean(hwOk);
  if (cloudDeleted && getActiveHomeworkScopeUid() === scopeUid) {
    dequeuePendingHomeworkDelete(assignmentId, scopeUid);
    notifyHomeworkSyncStateChanged({ assignmentsChanged: false, submissionsChanged: false });
  }

  return {
    deletedLocally: true,
    cloudDeleted,
    queuedForRetry: !cloudDeleted
  };
}

export function applyCloudAssignmentsSnapshot(
  cloudAssignments: HomeworkAssignment[],
  explicitScopeUid?: string | null,
  explicitAuthUid?: string | null
): number {
  if (!Array.isArray(cloudAssignments) || cloudAssignments.length === 0) return 0;
  const scopeUid = getActiveHomeworkScopeUid(explicitScopeUid);
  const authUid = explicitAuthUid !== undefined ? explicitAuthUid : getCurrentHomeworkOwnerUid();
  let restoredCount = 0;
  let assignmentsChanged = false;

  cloudAssignments.forEach((hw) => {
    if (!hw || !hw.id) return;
    if (authUid && hw.ownerUid && hw.ownerUid !== authUid) {
      return;
    }
    if ((hw as any).deleted) {
      const existedLocally = getLocalAssignments(scopeUid).some(
        (a) => a.id === hw.id || sanitizeDocId(a.id) === sanitizeDocId(hw.id)
      );
      deleteLocalAssignment(hw.id, false, { isManualDelete: false, markShortIdRevoked: true });
      if (existedLocally) {
        assignmentsChanged = true;
      }
      return;
    }
    // Never resurrect an assignment that the teacher explicitly/manually deleted on this device
    if (isAssignmentManuallyDeletedLocally(hw.id, scopeUid)) {
      return;
    }

    const wasFalseDeleted = isAssignmentDeletedLocally(hw.id, scopeUid);
    const cleanShortId = hw.shortId?.trim();
    const shouldRestoreShortId = Boolean(
      cleanShortId &&
        hw.isActive !== false &&
        hw.status !== 'closed' &&
        isShortIdRevokedLocally(cleanShortId)
    );

    if (wasFalseDeleted || shouldRestoreShortId) {
      if (wasFalseDeleted) {
        clearAssignmentDeletedLocally(hw.id, scopeUid);
        restoredCount++;
        assignmentsChanged = true;
      }
      if (shouldRestoreShortId && cleanShortId) {
        clearShortIdRevokedLocally(cleanShortId);
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          window.dispatchEvent(
            new CustomEvent('gluck-homework-restored', {
              detail: {
                assignmentId: hw.id,
                safeId: sanitizeDocId(hw.id),
                shortId: cleanShortId,
                ownerUid: authUid
              }
            })
          );
        } catch {
          // Ignore CustomEvent error
        }
      }
    }

    const changed = saveLocalAssignment(
      { ...hw, ...(authUid ? { ownerUid: authUid } : {}), cloudSynced: true },
      false
    );
    if (changed) {
      assignmentsChanged = true;
    }
  });

  if (restoredCount > 0 || assignmentsChanged) {
    notifyHomeworkSyncStateChanged({ assignmentsChanged: true, submissionsChanged: false });
  }
  return restoredCount;
}

export function getLocalSubmissions(explicitUid?: string | null): HomeworkSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const scopeUid = getActiveHomeworkScopeUid(explicitUid);
    const isAuthenticatedScope = scopeUid !== UNAUTHENTICATED_HOMEWORK_SCOPE;
    const raw = localStorage.getItem(getSubmissionsStorageKey(scopeUid));
    const parsed: HomeworkSubmission[] = raw ? JSON.parse(raw) : [];
    const active = parsed.filter((s) => {
      if (!s || !s.assignmentId) return false;
      const recOwner = s.ownerUid?.trim() || '';
      if (isAuthenticatedScope && recOwner !== scopeUid) {
        return false;
      }
      return true;
    });

    if (isAuthenticatedScope) {
      const deletedSet = getDeletedAssignmentIds(scopeUid);
      const ownedAssignmentIds = new Set(
        getLocalAssignments(scopeUid).flatMap((a) => [a.id, sanitizeDocId(a.id)])
      );
      const archivedIds = new Set(
        getArchivedAssignmentsMetadata(scopeUid).flatMap((a) => [a.id, sanitizeDocId(a.id)])
      );
      if (ownedAssignmentIds.size > 0 || archivedIds.size > 0 || deletedSet.size > 0) {
        const unauthRaw = localStorage.getItem(getSubmissionsStorageKey(UNAUTHENTICATED_HOMEWORK_SCOPE));
        const unauthParsed: HomeworkSubmission[] = unauthRaw ? JSON.parse(unauthRaw) : [];
        for (const s of unauthParsed) {
          if (!s || !s.assignmentId) continue;
          const safeSubHwId = sanitizeDocId(s.assignmentId);
          const isOwned =
            ownedAssignmentIds.has(s.assignmentId) ||
            ownedAssignmentIds.has(safeSubHwId) ||
            archivedIds.has(s.assignmentId) ||
            archivedIds.has(safeSubHwId) ||
            deletedSet.has(s.assignmentId) ||
            deletedSet.has(safeSubHwId);
          if (!isOwned) continue;
          const recOwner = s.ownerUid?.trim() || '';
          if (recOwner && recOwner !== scopeUid) continue;
          active.push({ ...s, ownerUid: scopeUid });
        }
      }
    }

    return deduplicateSubmissions(active);
  } catch {
    return [];
  }
}

export function getPreservedSubmissionsForDeletedAssignments(
  explicitUid?: string | null
): { assignmentMeta: ArchivedAssignmentMeta; submissions: HomeworkSubmission[] }[] {
  const scopeUid = getActiveHomeworkScopeUid(explicitUid);
  const activeIds = new Set(
    getLocalAssignments(scopeUid).flatMap((a) => [a.id, sanitizeDocId(a.id)])
  );
  const archivedList = getArchivedAssignmentsMetadata(scopeUid);
  const archivedBySafeId = new Map<string, ArchivedAssignmentMeta>();
  for (const meta of archivedList) {
    archivedBySafeId.set(sanitizeDocId(meta.id), meta);
  }

  const allSubs = getLocalSubmissions(scopeUid);
  const grouped = new Map<string, HomeworkSubmission[]>();
  for (const s of allSubs) {
    const safeHwId = sanitizeDocId(s.assignmentId);
    if (activeIds.has(s.assignmentId) || activeIds.has(safeHwId)) continue;
    const arr = grouped.get(safeHwId) || [];
    arr.push(s);
    grouped.set(safeHwId, arr);
  }

  const results: { assignmentMeta: ArchivedAssignmentMeta; submissions: HomeworkSubmission[] }[] = [];
  for (const [safeHwId, subs] of grouped.entries()) {
    const firstWithTitle = subs.find((s) => typeof s.assignmentTitle === 'string' && s.assignmentTitle.trim().length > 0);
    const firstWithGroup = subs.find((s) => typeof s.groupName === 'string' && s.groupName.trim().length > 0);
    const firstSub = subs[0];
    const existingMeta = archivedBySafeId.get(safeHwId);
    const reconstructedTitle =
      existingMeta?.title && !existingMeta.title.startsWith('واجب محذوف (')
        ? existingMeta.title
        : firstWithTitle?.assignmentTitle?.trim() ||
          existingMeta?.title ||
          `واجب محذوف (${firstSub?.assignmentId || safeHwId})`;

    const meta: ArchivedAssignmentMeta = {
      id: existingMeta?.id || firstSub?.assignmentId || safeHwId,
      title: reconstructedTitle,
      createdAt: existingMeta?.createdAt || firstSub?.startedAt,
      deletedAt:
        existingMeta?.deletedAt ||
        (firstSub?.updatedAt ? String(firstSub.updatedAt) : new Date().toISOString()),
      audienceMode: existingMeta?.audienceMode || firstSub?.audienceMode,
      groupId: existingMeta?.groupId || firstSub?.groupId,
      groupName: existingMeta?.groupName || firstWithGroup?.groupName,
      questionCount: existingMeta?.questionCount || firstSub?.totalQuestions,
      ownerUid: existingMeta?.ownerUid || firstSub?.ownerUid
    };
    if (!existingMeta && firstWithTitle?.assignmentTitle) {
      saveArchivedAssignmentMetadata(
        {
          id: meta.id,
          title: meta.title,
          createdAt: meta.createdAt,
          audienceMode: meta.audienceMode,
          groupId: meta.groupId,
          groupName: meta.groupName,
          questionCount: meta.questionCount,
          ownerUid: meta.ownerUid
        },
        scopeUid
      );
    }
    results.push({ assignmentMeta: meta, submissions: subs });
  }
  return results;
}

/**
 * On-demand manual recovery of historical submissions for deleted assignments
 * (e.g., after reinstalling the app or clearing localStorage).
 */
export async function restoreArchivedSubmissionsFromCloud(
  explicitUid?: string | null
): Promise<{ assignmentMeta: ArchivedAssignmentMeta; submissions: HomeworkSubmission[] }[]> {
  const scopeUid = getActiveHomeworkScopeUid(explicitUid);
  const authUid = getCurrentHomeworkOwnerUid() || (scopeUid !== UNAUTHENTICATED_HOMEWORK_SCOPE ? scopeUid : null);
  const cloudSubs = await activeFetchAllSubmissionsFromCloud(authUid || undefined).catch(() => [] as HomeworkSubmission[]);
  for (const sub of cloudSubs) {
    if (authUid && sub.ownerUid && sub.ownerUid !== authUid) continue;
    saveLocalSubmission({ ...sub, cloudSynced: true }, false);
  }
  return getPreservedSubmissionsForDeletedAssignments(scopeUid);
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
    const filtered = list.filter((s) => {
      if (!s || !s.assignmentId) return false;
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

function stableLocalJson(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableLocalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableLocalJson(value[k])}`).join(',')}}`;
}

function areSubmissionsSemanticallyEqualLocal(
  a: HomeworkSubmission,
  b: HomeworkSubmission
): boolean {
  if (!a || !b) return false;
  if (String(a.status || 'completed') !== String(b.status || 'completed')) return false;
  if (String(a.studentName || '').trim().toLowerCase() !== String(b.studentName || '').trim().toLowerCase()) {
    return false;
  }
  if ((a.studentId || '') !== (b.studentId || '')) return false;
  if ((a.participantId || '') !== (b.participantId || '')) return false;
  if ((a.groupId || '') !== (b.groupId || '')) return false;
  if (Number(a.attemptNumber || 1) !== Number(b.attemptNumber || 1)) return false;
  if (Number(a.score ?? a.correctAnswersCount ?? 0) !== Number(b.score ?? b.correctAnswersCount ?? 0)) {
    return false;
  }
  if (
    Number(a.accuracyPercent ?? a.scorePercentage ?? a.accuracy ?? 0) !==
    Number(b.accuracyPercent ?? b.scorePercentage ?? b.accuracy ?? 0)
  ) {
    return false;
  }
  if (Number(a.goldEarned || 0) !== Number(b.goldEarned || 0)) return false;
  if (Number(a.maxStreak || 0) !== Number(b.maxStreak || 0)) return false;
  if (Number((a as any).xpEarned || 0) !== Number((b as any).xpEarned || 0)) return false;
  if (Boolean(a.completedStudyPhase) !== Boolean(b.completedStudyPhase)) return false;
  if (a.completedAt && b.completedAt && String(a.completedAt) !== String(b.completedAt)) return false;
  if (a.startedAt && b.startedAt && String(a.startedAt) !== String(b.startedAt)) return false;
  if (
    typeof a.timeSpentSeconds === 'number' &&
    typeof b.timeSpentSeconds === 'number' &&
    Math.round(a.timeSpentSeconds) !== Math.round(b.timeSpentSeconds)
  ) {
    return false;
  }
  if (stableLocalJson((a as any).gamification || null) !== stableLocalJson((b as any).gamification || null)) {
    return false;
  }
  const normResp = (list: any) =>
    Array.isArray(list)
      ? list.map((r: any) => ({
          q: r?.questionId || '',
          t: r?.questionType || '',
          w: r?.germanWord || '',
          s: String(r?.studentAnswer ?? ''),
          c: String(r?.correctAnswer ?? ''),
          ok: Boolean(r?.isCorrect)
        }))
      : [];
  return stableLocalJson(normResp(a.responses)) === stableLocalJson(normResp(b.responses));
}

export function saveLocalSubmission(sub: HomeworkSubmission, syncCloud = true): boolean {
  if (typeof window === 'undefined' || !sub || !sub.id) return false;
  const activeUid = getCurrentHomeworkOwnerUid();
  const subOwnerUid = sub.ownerUid?.trim() || '';

  const targetScopeUid = subOwnerUid || getActiveHomeworkScopeUid();
  // Only block NEW live submissions when the assignment was deleted locally; allow preserving/merging historical reads (syncCloud === false)
  if (syncCloud && isAssignmentDeletedLocally(sub.assignmentId, targetScopeUid)) return false;

  const matchingHw = getLocalAssignments(targetScopeUid).find(
    (a) => a.id === sub.assignmentId || sanitizeDocId(a.id) === sanitizeDocId(sub.assignmentId)
  );
  if (activeUid && matchingHw?.ownerUid && matchingHw.ownerUid !== activeUid) {
    return false;
  }

  // V-05: Reject new/updated student submissions to inactive or closed assignments
  if (matchingHw && !isHomeworkAssignmentOpenForStudents(matchingHw) && syncCloud) {
    return false;
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
      return false;
    }
    if (existing.attemptSecret && sub.attemptSecret && existing.attemptSecret !== sub.attemptSecret) {
      return false;
    }
    const existingIsCompleted =
      existing.status === 'completed' || (!existing.status && Boolean(existing.completedAt));
    if (existingIsCompleted) {
      const incomingIsCompleted =
        sub.status === 'completed' || (!sub.status && Boolean(sub.completedAt));
      if (!incomingIsCompleted || !areSubmissionsSemanticallyEqualLocal(existing, sub)) {
        return false;
      }
    }
  }

  const resolvedAttemptSecret =
    sub.attemptSecret?.trim() ||
    existing?.attemptSecret?.trim() ||
    getOrCreateStudentAttemptSecret(sub.id);

  let validatedSub: HomeworkSubmission = {
    ...sub,
    ...(sub.assignmentTitle || matchingHw?.title
      ? { assignmentTitle: String(sub.assignmentTitle || matchingHw?.title).trim() }
      : {}),
    ...(sub.groupName || matchingHw?.groupName
      ? { groupName: String(sub.groupName || matchingHw?.groupName).trim() }
      : {}),
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    attemptSecret: resolvedAttemptSecret
  };
  if (matchingHw) {
    const check = validateHomeworkSubmissionIdentity(matchingHw, sub);
    if (!check.valid) {
      return false;
    }
    validatedSub = {
      ...validatedSub,
      assignmentTitle: validatedSub.assignmentTitle || matchingHw.title,
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      studentName: check.normalizedStudentName || sub.studentName,
      groupId: check.normalizedGroupId,
      ...(check.audienceMode === 'group' && (validatedSub.groupName || matchingHw.groupName)
        ? { groupName: validatedSub.groupName || matchingHw.groupName }
        : {})
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

  const contentChanged = !existing || !areSubmissionRecordsEqual(existing, mergedRecord);
  const metadataChanged = !existing || existing.cloudSynced !== mergedRecord.cloudSynced;

  if (contentChanged || metadataChanged) {
    const others = currentAll.filter((s) => s.id !== mergedRecord.id);
    others.unshift(mergedRecord);
    writeLocalSubmissionsList(others, storageScope);

    if (!activeUid && storageScope !== UNAUTHENTICATED_HOMEWORK_SCOPE) {
      const unauthOthers = unauthAll.filter((s) => s.id !== mergedRecord.id);
      unauthOthers.unshift(mergedRecord);
      writeLocalSubmissionsList(unauthOthers, UNAUTHENTICATED_HOMEWORK_SCOPE);
    }
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
            notifyHomeworkSyncStateChanged({ assignmentsChanged: false, submissionsChanged: false });
          }
        }
      })
      .catch(() => {});
  }

  return contentChanged;
}

export async function saveSubmissionWithConfirmation(
  sub: HomeworkSubmission,
  assignmentContext?: Partial<HomeworkAssignment> | null
): Promise<{
  submission: HomeworkSubmission;
  cloudSynced: boolean;
  isIdempotentRetry?: boolean;
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
      if (!incomingIsCompleted || !areSubmissionsSemanticallyEqualLocal(existing, sub)) {
        const conflictErr: any = new Error('تم إنهاء هذه المحاولة مسبقاً ولا يمكن تعديلها أو الكتابة فوقها.');
        conflictErr.status = 409;
        throw conflictErr;
      }
    }
  }

  const resolvedAttemptSecret =
    sub.attemptSecret?.trim() ||
    existing?.attemptSecret?.trim() ||
    getOrCreateStudentAttemptSecret(sub.id);

  let normalizedSub: HomeworkSubmission = {
    ...sub,
    ...(sub.assignmentTitle || hw?.title
      ? { assignmentTitle: String(sub.assignmentTitle || hw?.title).trim() }
      : {}),
    ...(sub.groupName || hw?.groupName
      ? { groupName: String(sub.groupName || hw?.groupName).trim() }
      : {}),
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
      assignmentTitle: normalizedSub.assignmentTitle || hw.title,
      audienceMode: validation.audienceMode,
      studentId: validation.normalizedStudentId,
      participantId: validation.normalizedParticipantId,
      studentName: validation.normalizedStudentName || sub.studentName,
      groupId: validation.normalizedGroupId,
      ...(validation.audienceMode === 'group' && (normalizedSub.groupName || hw.groupName)
        ? { groupName: normalizedSub.groupName || hw.groupName }
        : {})
    };
  }

  saveLocalSubmission({ ...normalizedSub, cloudSynced: false }, false);

  let cloudOk = false;
  let isIdempotentRetry = false;
  let authoritativeSub: HomeworkSubmission | undefined;

  if (testCloudTransport?.saveSubmission) {
    cloudOk = await testCloudTransport.saveSubmission(normalizedSub);
  } else {
    const res = await saveSubmissionToFirestoreWithDetails(normalizedSub);
    if (res.rejected) {
      const err: any = new Error(res.error || 'تم رفض تسليم الواجب من السيرفر.');
      err.status = res.status || 409;
      err.rejected = true;
      throw err;
    }
    cloudOk = res.synced;
    isIdempotentRetry = Boolean(res.isIdempotentRetry);
    authoritativeSub = res.authoritativeSubmission;
  }

  const finalSub: HomeworkSubmission = {
    ...normalizedSub,
    ...(authoritativeSub || {}),
    cloudSynced: cloudOk
  };
  saveLocalSubmission(finalSub, false);
  notifyHomeworkSyncStateChanged({ assignmentsChanged: false, submissionsChanged: true });
  return { submission: finalSub, cloudSynced: cloudOk, isIdempotentRetry };
}

/**
 * Retries any locally saved homework deletes, assignments, or student submissions
 * whose Firestore write previously failed (e.g. while offline), strictly scoped to the active account
 * or to unauthenticated student submissions in student mode (V-02).
 * Applies exponential backoff and drops non-retryable 403/404/409 server rejections.
 */
const retryBackoffMap = new Map<string, { attempts: number; nextRetryAtMs: number; dropped?: boolean }>();

function shouldSkipDueToBackoff(id: string): boolean {
  const entry = retryBackoffMap.get(id);
  if (!entry) return false;
  if (entry.dropped) return true;
  return Date.now() < entry.nextRetryAtMs;
}

function recordTransientRetryFailure(id: string): void {
  const prev = retryBackoffMap.get(id);
  const attempts = (prev?.attempts || 0) + 1;
  const delayMs = testCloudTransport ? 0 : Math.min(60_000, 2000 * Math.pow(2, attempts - 1));
  retryBackoffMap.set(id, { attempts, nextRetryAtMs: Date.now() + delayMs });
}

function clearRetryBackoff(id: string): void {
  retryBackoffMap.delete(id);
}

let isFlushingPendingHw = false;
export async function flushPendingHomeworkCloudWrites(): Promise<{
  syncedAssignments: number;
  syncedSubmissions: number;
  syncedDeletes: number;
  remainingPending: number;
}> {
  if (isFlushingPendingHw) {
    return {
      syncedAssignments: 0,
      syncedSubmissions: 0,
      syncedDeletes: 0,
      remainingPending: getPendingHomeworkSyncCount()
    };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      syncedAssignments: 0,
      syncedSubmissions: 0,
      syncedDeletes: 0,
      remainingPending: getPendingHomeworkSyncCount()
    };
  }

  const scopeAtStart = getActiveHomeworkScopeUid();
  const authUidAtStart = getCurrentHomeworkOwnerUid();

  isFlushingPendingHw = true;
  let syncedAssignments = 0;
  let syncedSubmissions = 0;
  let syncedDeletes = 0;

  try {
    if (getActiveHomeworkScopeUid() === scopeAtStart && getCurrentHomeworkOwnerUid() === authUidAtStart) {
      if (authUidAtStart) {
        // 1. Flush durable pending homework deletions FIRST (short-link revocation -> doc delete; preserve submissions)
        const pendingDeletes = getPendingHomeworkDeletes(scopeAtStart);
        for (const delEntry of pendingDeletes) {
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            break;
          }
          if (delEntry.ownerUid && delEntry.ownerUid !== authUidAtStart) {
            continue;
          }
          const retryKey = `del::${delEntry.assignmentId}`;
          if (shouldSkipDueToBackoff(retryKey)) continue;

          const hwOk = await activeDeleteAssignmentFromCloud(
            delEntry.assignmentId,
            authUidAtStart,
            delEntry.shortId
          ).catch(() => false);
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            break;
          }
          if (hwOk) {
            clearRetryBackoff(retryKey);
            dequeuePendingHomeworkDelete(delEntry.assignmentId, scopeAtStart);
            syncedDeletes++;
          } else {
            recordTransientRetryFailure(retryKey);
          }
        }

        const pendingAssignments = getLocalAssignments(scopeAtStart).filter(
          (assignment) =>
            assignment.cloudSynced === false &&
            (assignment as any).cloudCreatePending === true &&
            assignment.ownerUid === authUidAtStart
        );
        for (const assignment of pendingAssignments) {
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) break;
          const retryKey = `hw::${assignment.id}`;
          if (shouldSkipDueToBackoff(retryKey)) continue;

          const { cloudCreatePending: _cloudCreatePending, ...assignmentForCloud } = assignment as any;
          const ok = await activeSaveAssignmentToCloud(assignmentForCloud as HomeworkAssignment);
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) break;
          if (ok) {
            clearRetryBackoff(retryKey);
            syncedAssignments++;
            saveLocalAssignment({ ...assignment, cloudSynced: true, cloudCreatePending: false } as HomeworkAssignment, false);
          } else {
            recordTransientRetryFailure(retryKey);
          }
        }

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
            const retryKey = `sub::${sub.id}`;
            if (shouldSkipDueToBackoff(retryKey)) continue;

            if (testCloudTransport?.saveSubmission) {
              const ok = await testCloudTransport.saveSubmission(sub);
              if (ok) {
                clearRetryBackoff(retryKey);
                syncedSubmissions++;
                saveLocalSubmission({ ...sub, cloudSynced: true }, false);
              } else {
                recordTransientRetryFailure(retryKey);
              }
            } else {
              const res = await saveSubmissionToFirestoreWithDetails(sub);
              if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
                break;
              }
              if (res.synced) {
                clearRetryBackoff(retryKey);
                syncedSubmissions++;
                saveLocalSubmission({ ...sub, ...(res.authoritativeSubmission || {}), cloudSynced: true }, false);
              } else if (res.rejected && (res.status === 403 || res.status === 404 || res.status === 409)) {
                retryBackoffMap.set(retryKey, { attempts: 99, nextRetryAtMs: Number.MAX_SAFE_INTEGER, dropped: true });
              } else {
                recordTransientRetryFailure(retryKey);
              }
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
          const retryKey = `sub::${sub.id}`;
          if (shouldSkipDueToBackoff(retryKey)) continue;

          if (testCloudTransport?.saveSubmission) {
            const ok = await testCloudTransport.saveSubmission(sub);
            if (ok) {
              clearRetryBackoff(retryKey);
              syncedSubmissions++;
              saveLocalSubmission({ ...sub, cloudSynced: true }, false);
            } else {
              recordTransientRetryFailure(retryKey);
            }
          } else {
            const res = await saveSubmissionToFirestoreWithDetails(sub);
            if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
              break;
            }
            if (res.synced) {
              clearRetryBackoff(retryKey);
              syncedSubmissions++;
              saveLocalSubmission({ ...sub, ...(res.authoritativeSubmission || {}), cloudSynced: true }, false);
            } else if (res.rejected && (res.status === 403 || res.status === 404 || res.status === 409)) {
              retryBackoffMap.set(retryKey, { attempts: 99, nextRetryAtMs: Number.MAX_SAFE_INTEGER, dropped: true });
            } else {
              recordTransientRetryFailure(retryKey);
            }
          }
        }
      }
    }
  } finally {
    isFlushingPendingHw = false;
    if (syncedAssignments > 0 || syncedSubmissions > 0 || syncedDeletes > 0) {
      notifyHomeworkSyncStateChanged({ assignmentsChanged: false, submissionsChanged: false });
    }
  }

  return {
    syncedAssignments,
    syncedSubmissions,
    syncedDeletes,
    remainingPending: getPendingHomeworkSyncCount()
  };
}

export const flushPendingHomeworkSyncQueue = flushPendingHomeworkCloudWrites;

export function getPendingHomeworkSyncCount(explicitUid?: string | null): number {
  const scopeUid = getActiveHomeworkScopeUid(explicitUid);
  const pendingDeletes = getPendingHomeworkDeletes(scopeUid).length;
  if (scopeUid === UNAUTHENTICATED_HOMEWORK_SCOPE) {
    const pendingHw = getLocalAssignments(UNAUTHENTICATED_HOMEWORK_SCOPE).filter(
      (a) => a.cloudSynced === false
    ).length;
    const pendingStudentSubs = getLocalSubmissions(UNAUTHENTICATED_HOMEWORK_SCOPE).filter(
      (s) => s.cloudSynced === false
    ).length;
    return pendingDeletes + pendingHw + pendingStudentSubs;
  }
  const activeAssignments = getLocalAssignments(scopeUid);
  const activeIds = new Set(
    activeAssignments.flatMap((a) => [a.id, sanitizeDocId(a.id)])
  );
  const pendingHw = activeAssignments.filter((a) => a.cloudSynced === false && (a as any).cloudCreatePending === true).length;
  const pendingSubs = getLocalSubmissions(scopeUid).filter(
    (s) =>
      s.cloudSynced === false &&
      (activeIds.has(s.assignmentId) || activeIds.has(sanitizeDocId(s.assignmentId)))
  ).length;
  return pendingDeletes + pendingHw + pendingSubs;
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
  'verb_conjugation',
  'verb_sentence',
  'grammar_exercise',
  'mc_de_ar',
  'listen_choose',
  'mc_ar_de',
  'article_quiz'
]);

/**
 * Resolves how many questions should be asked for a specific stage (`qType`),
 * scaling `verb_conjugation` by 6 slots per verb, `verb_sentence` by 1 per verb,
 * and `grammar_exercise` by selected grammar exercise count.
 */
export function resolveStageQuestionCount(
  qType: HomeworkQuestionType,
  maxWordsCount: number,
  questionTypeCounts?: Partial<Record<HomeworkQuestionType, number>>,
  maxVerbCount?: number,
  maxGrammarCount?: number
): number {
  const safeWords = Math.max(0, Math.floor(Number(maxWordsCount) || 0));
  const safeVerbs =
    typeof maxVerbCount === 'number' && Number.isFinite(maxVerbCount)
      ? Math.max(0, Math.floor(maxVerbCount))
      : safeWords;
  const safeGrammar =
    typeof maxGrammarCount === 'number' && Number.isFinite(maxGrammarCount)
      ? Math.max(0, Math.floor(maxGrammarCount))
      : 0;
  const effectiveWordsOrVerbs = safeWords > 0 ? safeWords : safeVerbs;
  const stageMax =
    qType === 'verb_conjugation'
      ? safeVerbs * 6
      : qType === 'verb_sentence'
      ? safeVerbs
      : qType === 'grammar_exercise'
      ? safeGrammar
      : effectiveWordsOrVerbs;

  if (stageMax <= 0) return 0;
  const raw = questionTypeCounts?.[qType];
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return Math.min(stageMax, Math.max(1, Math.round(raw)));
  }
  return stageMax;
}

/**
 * Calculates the total number of questions across all active homework stages
 * taking into account any per-stage custom question counts (`questionTypeCounts`),
 * unified verb stages (`verb_conjugation` = 6 × verbs, `verb_sentence` = 1 × verbs),
 * and grammar exercise stages (`grammar_exercise`).
 */
export function calculateTotalHomeworkQuestions(
  wordsCount: number,
  questionTypes?: HomeworkQuestionType[],
  questionTypeCounts?: Partial<Record<HomeworkQuestionType, number>>,
  verbCount?: number,
  grammarCount?: number
): number {
  const safeWords = Math.max(0, Math.floor(Number(wordsCount) || 0));
  const safeVerbs =
    typeof verbCount === 'number' && Number.isFinite(verbCount)
      ? Math.max(0, Math.floor(verbCount))
      : safeWords;
  const safeGrammar =
    typeof grammarCount === 'number' && Number.isFinite(grammarCount)
      ? Math.max(0, Math.floor(grammarCount))
      : 0;
  if (safeWords <= 0 && safeVerbs <= 0 && safeGrammar <= 0) return 0;
  const activeTypes =
    Array.isArray(questionTypes) && questionTypes.length > 0
      ? questionTypes
      : DEFAULT_HOMEWORK_QUESTION_TYPES;

  // Clamp any custom counts by stage ceiling before passing to shared engine
  const effectiveWordCap = safeWords > 0 ? safeWords : safeVerbs;
  const clampedCounts: Partial<Record<HomeworkQuestionType, number>> = {};
  for (const qt of activeTypes) {
    const raw = questionTypeCounts?.[qt];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
      const cap =
        qt === 'verb_conjugation'
          ? Math.max(1, safeVerbs * 6)
          : qt === 'verb_sentence'
          ? Math.max(1, safeVerbs)
          : qt === 'grammar_exercise'
          ? Math.max(1, safeGrammar)
          : Math.max(1, effectiveWordCap);
      clampedCounts[qt] = Math.min(cap, Math.round(raw));
    }
  }

  return calculateUnifiedHomeworkQuestionCount({
    questionTypes: activeTypes,
    questionTypeCounts: clampedCounts,
    vocabItemsCount: safeWords,
    verbCount: safeVerbs,
    grammarExercisesCount: safeGrammar
  });
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

export const HOMEWORK_SHORT_LINK_PATH_SEGMENT = 'Herr-Abdul-rahman';
const SHORT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * Validates that a candidate shortId is a 6–10 character alphanumeric URL-safe code.
 */
export function isValidHomeworkShortId(shortId: string | null | undefined): boolean {
  if (!shortId || typeof shortId !== 'string') return false;
  return /^[A-Za-z0-9]{6,10}$/.test(shortId.trim());
}

/**
 * Extracts `{SHORT_ID}` if the pathname/hash matches `/Herr-Abdul-rahman/{SHORT_ID}`.
 * Returns an empty string if the path is not a short homework route.
 */
export function extractShortIdFromPathname(pathname?: string): string {
  const candidates: string[] = [];
  if (typeof pathname === 'string') {
    candidates.push(pathname);
  } else if (typeof window !== 'undefined') {
    candidates.push(window.location.pathname || '');
    if (window.location.hash) {
      candidates.push(window.location.hash.replace(/^#/, ''));
    }
  }

  for (const rawPath of candidates) {
    const match = rawPath.match(/(?:^|\/)Herr-Abdul-rahman\/([^/?#]+)\/?/i);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch {
        return match[1].trim();
      }
    }
  }

  if (pathname === undefined && typeof window !== 'undefined' && window.location.search) {
    try {
      const qShort = new URLSearchParams(window.location.search).get('shortId')?.trim() || '';
      if (qShort) return qShort;
    } catch {
      // Ignore URLSearchParams errors
    }
  }

  return '';
}

/**
 * Generates a cryptographically random 7-character URL-safe alphanumeric short ID.
 * Checks against local assignments and any caller-provided set to prevent collisions.
 */
export function createHomeworkShortId(
  length = 7,
  existingShortIds?: Iterable<string>
): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is unavailable; cannot create a homework short ID.');
  }
  const safeLength = Math.min(10, Math.max(6, Math.floor(length || 7)));
  const knownIds = new Set<string>();
  if (existingShortIds) {
    for (const id of existingShortIds) {
      if (id) knownIds.add(String(id).trim());
    }
  }
  for (const localHw of getLocalAssignments()) {
    if (localHw?.shortId) {
      knownIds.add(String(localHw.shortId).trim());
    }
  }
  for (const revokedId of getRevokedShortIdsLocally()) {
    if (revokedId) knownIds.add(String(revokedId).trim());
  }

  for (let attempt = 0; attempt < 32; attempt++) {
    const bytes = new Uint8Array(safeLength);
    cryptoApi.getRandomValues(bytes);
    let candidate = '';
    for (let i = 0; i < safeLength; i++) {
      candidate += SHORT_ID_ALPHABET[bytes[i] % SHORT_ID_ALPHABET.length];
    }
    if (!knownIds.has(candidate)) {
      return candidate;
    }
  }
  throw new Error('Failed to generate a unique homework short ID after multiple attempts.');
}

/**
 * Formats the canonical internal short homework link:
 * `https://YOUR_DOMAIN/Herr-Abdul-rahman/{SHORT_ID}`
 */
export function buildShortHomeworkShareUrl(
  hwOrShortId: HomeworkAssignment | { shortId?: string } | string,
  overrideDomain?: string
): string {
  const baseDomain = (overrideDomain || getVercelPublicDomain()).replace(/\/+$/, '');
  const rawShortId =
    typeof hwOrShortId === 'string'
      ? hwOrShortId.trim()
      : (hwOrShortId?.shortId || '').trim();
  if (!isValidHomeworkShortId(rawShortId)) {
    throw new Error('Cannot build short homework URL without a valid shortId.');
  }
  return `${baseDomain}/${HOMEWORK_SHORT_LINK_PATH_SEGMENT}/${rawShortId}`;
}

/**
 * Builds the legacy long homework link (`/homework/{id}?...`) for backward compatibility.
 */
export function buildLegacyHomeworkShareUrl(hw: HomeworkAssignment, overrideDomain?: string): string {
  const baseDomain = (overrideDomain || getVercelPublicDomain()).replace(/\/+$/, '');
  const mode = resolveAssignmentAudienceMode(hw);
  const params = new URLSearchParams();
  params.set('am', mode);
  if (hw.shareToken?.trim()) params.set('token', hw.shareToken.trim());
  const resolvedOwnerUid = hw.ownerUid?.trim() || getCurrentHomeworkOwnerUid() || '';
  if (resolvedOwnerUid) params.set('ou', resolvedOwnerUid);
  if (mode === 'group' && hw.groupId) {
    params.set('gid', hw.groupId);
    if (hw.groupName) params.set('gn', hw.groupName);
    if (Array.isArray(hw.assignedStudents) && hw.assignedStudents.length > 0) {
      const compactRoster = hw.assignedStudents
        .filter((st) => st && st.id && st.name)
        .map((st) => `${String(st.id).trim().replace(/[|~]/g, '_')}~${String(st.name).trim().replace(/[|~]/g, ' ')}`)
        .join('|');
      if (compactRoster) {
        params.set('st', compactRoster);
      }
    }
  }
  if (hw.setSnapshot?.id) params.set('s', hw.setSnapshot.id);
  if (hw.flowMode) params.set('fm', hw.flowMode);
  if (hw.questionTypes && hw.questionTypes.length > 0) {
    params.set('qt', hw.questionTypes.join(','));
  }
  const verbCeiling = (hw.selectedVerbIds?.length || hw.verbSnapshot?.length || 0) * 6;
  const wordCeiling = hw.selectedItemIds?.length || hw.setSnapshot?.items?.length || 0;
  const grammarCeiling =
    hw.selectedGrammarExerciseIds?.length ||
    hw.setSnapshot?.grammarContent?.exercises?.length ||
    0;
  const encodedQtc = encodeQuestionTypeCountsParam(
    hw.questionTypes,
    hw.questionTypeCounts,
    Math.max(wordCeiling, verbCeiling, grammarCeiling) || undefined
  );
  if (encodedQtc) {
    params.set('qtc', encodedQtc);
  }
  if (hw.blooketMode) params.set('bm', hw.blooketMode);
  if (hw.contentSource) params.set('cs', hw.contentSource);
  if (hw.verbSubjectPoolMode) params.set('vsp', hw.verbSubjectPoolMode);
  if (hw.includeGrammarStudy === false) params.set('igs', '0');
  if (hw.hideTeacherBranding) params.set('htb', '1');
  if (hw.title) params.set('t', hw.title);
  if (hw.selectedItemIds && hw.selectedItemIds.length > 0) {
    params.set('ids', hw.selectedItemIds.join(','));
  }
  if (hw.selectedGrammarExerciseIds && hw.selectedGrammarExerciseIds.length > 0) {
    const joinedGram = hw.selectedGrammarExerciseIds.slice(0, 60).join(',');
    if (joinedGram.length <= 1200) params.set('gids', joinedGram);
  }
  if (hw.selectedVerbIds && hw.selectedVerbIds.length > 0) {
    const joinedVerbs = hw.selectedVerbIds.slice(0, 60).join(',');
    if (joinedVerbs.length <= 1200) params.set('vids', joinedVerbs);
  }
  if (Array.isArray(hw.setSnapshot?.items) && hw.setSnapshot.items.length > 0) {
    const selectedSet =
      Array.isArray(hw.selectedItemIds) && hw.selectedItemIds.length > 0
        ? new Set(hw.selectedItemIds)
        : null;
    const targetItems = selectedSet
      ? hw.setSnapshot.items.filter((it: any) => it && selectedSet.has(it.id))
      : hw.setSnapshot.items;
    const compactWords = (targetItems.length > 0 ? targetItems : hw.setSnapshot.items)
      .slice(0, 40)
      .filter((it: any) => it && it.id && it.german && it.arabic)
      .map((it: any) => {
        const cleanId = String(it.id).trim().replace(/[|~]/g, '_');
        const cleanDe = String(it.german).trim().replace(/[|~]/g, ' ');
        const cleanAr = String(it.arabic).trim().replace(/[|~]/g, ' ');
        const cleanEmoji = String(it.emoji || '📘').trim().replace(/[|~]/g, '');
        return `${cleanId}~${cleanDe}~${cleanAr}~${cleanEmoji}`;
      })
      .join('|');
    if (compactWords && compactWords.length <= 1800) {
      params.set('w', compactWords);
    }
  }
  return `${baseDomain}/homework/${hw.id}?${params.toString()}`;
}

/**
 * Generates the student/parent homework share link using the Vercel public domain.
 * Returns `https://YOUR_DOMAIN/Herr-Abdul-rahman/{SHORT_ID}` when `shortId` is present on the assignment,
 * while preserving backward compatibility for legacy assignments without `shortId`.
 */
export function buildHomeworkShareUrl(hw: HomeworkAssignment, overrideDomain?: string): string {
  if (hw && isValidHomeworkShortId(hw.shortId)) {
    return buildShortHomeworkShareUrl(hw, overrideDomain);
  }
  return buildLegacyHomeworkShareUrl(hw, overrideDomain);
}

/**
 * Resolves a short homework ID (`Herr-Abdul-rahman/{SHORT_ID}`) across:
 * 1. Cloud transport override (when testing) or Express API (`/api/homework/short/:shortId`)
 * 2. Local storage cache (`dl_homework_assignments`)
 * 3. Direct Firebase Firestore lookup (`homework_short_links/{shortId}`)
 */
export async function resolveHomeworkShortLink(
  shortId: string
): Promise<HomeworkShortLinkResolutionResult> {
  const cleanShortId = String(shortId || '').trim();
  if (!isValidHomeworkShortId(cleanShortId)) {
    return {
      status: 'invalid_id',
      shortId: cleanShortId,
      error: 'رابط الواجب غير صالح — يرجى التأكد من نسخ الرابط بالكامل.'
    };
  }

  if (isShortIdRevokedLocally(cleanShortId)) {
    return {
      status: 'revoked',
      shortId: cleanShortId,
      error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
    };
  }

  let encounteredNetworkFailure = false;
  let encounteredQuotaError = false;

  // 1. If a test cloud transport override is registered, query it first
  if (testCloudTransport?.fetchShortLink) {
    try {
      const overrideDoc: any = await testCloudTransport.fetchShortLink(cleanShortId);
      if (overrideDoc) {
        if (overrideDoc.status === 'quota_exceeded') {
          return {
            status: 'quota_exceeded',
            shortId: cleanShortId,
            error:
              overrideDoc.errorMessageAr ||
              overrideDoc.error ||
              'تم الوصول للحد اليومي المجاني لقراءة البيانات في السحابة مؤقتاً. يرجى المحاولة بعد قليل.'
          };
        }
        if (overrideDoc.status === 'network_error') {
          encounteredNetworkFailure = true;
        } else if (overrideDoc.status === 'resolved' && overrideDoc.assignment) {
          return {
            status: 'resolved',
            shortId: cleanShortId,
            assignment: normalizeHomeworkAssignment({
              ...overrideDoc.assignment,
              shortId: cleanShortId
            })
          };
        }
        if (
          overrideDoc.deleted === true ||
          overrideDoc.isActive === false ||
          overrideDoc.revoked === true ||
          overrideDoc.status === 'revoked' ||
          overrideDoc.status === 'deleted' ||
          overrideDoc.status === 'closed'
        ) {
          markShortIdRevokedLocally(cleanShortId);
          return {
            status: 'revoked',
            shortId: cleanShortId,
            error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
          };
        }
        const embeddedHw = overrideDoc.assignment || (overrideDoc.setSnapshot ? overrideDoc : null);
        if (embeddedHw && embeddedHw.setSnapshot) {
          if (
            isAssignmentDeletedLocally(embeddedHw.id, overrideDoc.ownerUid || embeddedHw.ownerUid) ||
            !isHomeworkAssignmentOpenForStudents(embeddedHw)
          ) {
            markShortIdRevokedLocally(cleanShortId);
            return {
              status: 'revoked',
              shortId: cleanShortId,
              error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
            };
          }
          const normalized = normalizeHomeworkAssignment({
            ...embeddedHw,
            shortId: cleanShortId,
            ...(overrideDoc.ownerUid ? { ownerUid: overrideDoc.ownerUid } : {})
          });
          return {
            status: 'resolved',
            shortId: cleanShortId,
            assignment: normalized
          };
        }
      }
    } catch {
      encounteredNetworkFailure = true;
    }
  }

  // 2. Query Express API `/api/homework/short/:shortId` when running in browser/HTTP context
  let apiReturnedQuotaExceeded = false;
  if (!testCloudTransport && typeof fetch === 'function') {
    try {
      const res = await fetch(
        resolveHomeworkApiUrl(`/api/homework/short/${encodeURIComponent(cleanShortId)}`)
      );
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.status === 400) {
        return {
          status: 'invalid_id',
          shortId: cleanShortId,
          error: data?.error || 'رابط الواجب غير صالح.'
        };
      }
      if (res.status === 410 || res.status === 403) {
        markShortIdRevokedLocally(cleanShortId);
        return {
          status: 'revoked',
          shortId: cleanShortId,
          error: data?.error || 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
        };
      }
      if (res.status === 429 || data?.status === 'quota_exceeded') {
        apiReturnedQuotaExceeded = true;
      } else if (res.status >= 500 || data?.status === 'network_error') {
        encounteredNetworkFailure = true;
      }
      if (res.ok && data?.assignment && data.assignment.setSnapshot) {
        const hwData = data.assignment;
        if (!isHomeworkAssignmentOpenForStudents(hwData)) {
          markShortIdRevokedLocally(cleanShortId);
          return {
            status: 'revoked',
            shortId: cleanShortId,
            error: 'هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.'
          };
        }
        const localMatch = getLocalAssignments().find((a) => a.id === hwData.id);
        const normalized = normalizeHomeworkAssignment({
          ...hwData,
          shortId: cleanShortId,
          ...(localMatch?.ownerUid && !hwData.ownerUid ? { ownerUid: localMatch.ownerUid } : {})
        });
        return {
          status: 'resolved',
          shortId: cleanShortId,
          assignment: normalized
        };
      }
    } catch {
      encounteredNetworkFailure = true;
    }
  }

  // 3. Wait briefly for Firebase Auth hydration in same-browser tab before checking scoped localStorage
  if (!testCloudTransport) {
    await waitForHomeworkAuthStateReady(1200);
  }
  const localMatch = getLocalAssignments().find(
    (a) => a && typeof a.shortId === 'string' && a.shortId.trim() === cleanShortId
  );
  if (localMatch) {
    if (
      (localMatch as any).deleted === true ||
      isAssignmentDeletedLocally(localMatch.id, localMatch.ownerUid) ||
      !isHomeworkAssignmentOpenForStudents(localMatch)
    ) {
      markShortIdRevokedLocally(cleanShortId);
      return {
        status: 'revoked',
        shortId: cleanShortId,
        error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
      };
    }
    if (localMatch.setSnapshot) {
      return {
        status: 'resolved',
        shortId: cleanShortId,
        assignment: normalizeHomeworkAssignment({ ...localMatch, shortId: cleanShortId })
      };
    }
  }

  // 4. Query Firestore `homework_short_links/{shortId}` directly (supports serverless / static hosting & cross-device students)
  if (!testCloudTransport) {
    try {
      const cloudShortDoc: any = await fetchShortLinkFromFirestore(cleanShortId);
      if (cloudShortDoc) {
        if (cloudShortDoc.status === 'quota_exceeded') {
          encounteredQuotaError = true;
          return {
            status: 'quota_exceeded',
            shortId: cleanShortId,
            error:
              cloudShortDoc.errorMessageAr ||
              'تم الوصول للحد اليومي المجاني لقراءة البيانات في السحابة مؤقتاً. يرجى المحاولة بعد قليل.'
          };
        }
        if (cloudShortDoc.status === 'network_error') {
          encounteredNetworkFailure = true;
        }
        if (cloudShortDoc.status === 'invalid_id') {
          return {
            status: 'invalid_id',
            shortId: cleanShortId,
            error: cloudShortDoc.errorMessageAr || 'رمز رابط الواجب المختصر غير صالح.'
          };
        }
        if (cloudShortDoc.status === 'resolved' && cloudShortDoc.assignment) {
          if (
            isAssignmentDeletedLocally(
              cloudShortDoc.assignment.id,
              cloudShortDoc.assignment.ownerUid
            ) ||
            !isHomeworkAssignmentOpenForStudents(cloudShortDoc.assignment)
          ) {
            markShortIdRevokedLocally(cleanShortId);
            return {
              status: 'revoked',
              shortId: cleanShortId,
              error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
            };
          }
          return {
            status: 'resolved',
            shortId: cleanShortId,
            assignment: normalizeHomeworkAssignment({
              ...cloudShortDoc.assignment,
              shortId: cleanShortId
            })
          };
        }
        if (
          cloudShortDoc.deleted === true ||
          cloudShortDoc.isActive === false ||
          cloudShortDoc.revoked === true ||
          cloudShortDoc.status === 'revoked' ||
          cloudShortDoc.status === 'deleted' ||
          cloudShortDoc.status === 'closed'
        ) {
          markShortIdRevokedLocally(cleanShortId);
          return {
            status: 'revoked',
            shortId: cleanShortId,
            error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
          };
        }

        const embeddedHw =
          cloudShortDoc.assignment || (cloudShortDoc.setSnapshot ? cloudShortDoc : null);
        if (embeddedHw && embeddedHw.setSnapshot) {
          if (
            isAssignmentDeletedLocally(embeddedHw.id, cloudShortDoc.ownerUid || embeddedHw.ownerUid) ||
            !isHomeworkAssignmentOpenForStudents(embeddedHw)
          ) {
            markShortIdRevokedLocally(cleanShortId);
            return {
              status: 'revoked',
              shortId: cleanShortId,
              error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
            };
          }
          const normalized = normalizeHomeworkAssignment({
            ...embeddedHw,
            shortId: cleanShortId,
            ...(cloudShortDoc.ownerUid ? { ownerUid: cloudShortDoc.ownerUid } : {})
          });
          return {
            status: 'resolved',
            shortId: cleanShortId,
            assignment: normalized
          };
        }

        if (cloudShortDoc.assignmentId) {
          const targetHw = await activeFetchAssignmentFromCloud(cloudShortDoc.assignmentId).catch(() => null);
          if (targetHw && targetHw.setSnapshot) {
            if (
              !isHomeworkAssignmentOpenForStudents(targetHw) ||
              (targetHw.shortId && String(targetHw.shortId).trim() !== cleanShortId)
            ) {
              markShortIdRevokedLocally(cleanShortId);
              return {
                status: 'revoked',
                shortId: cleanShortId,
                error: 'تم حذف هذا الواجب أو إيقاف الرابط من قِبل المعلم.'
              };
            }
            const normalized = normalizeHomeworkAssignment({
              ...targetHw,
              shortId: cleanShortId,
              ...(cloudShortDoc.ownerUid && !targetHw.ownerUid ? { ownerUid: cloudShortDoc.ownerUid } : {})
            });
            return {
              status: 'resolved',
              shortId: cleanShortId,
              assignment: normalized
            };
          }
        }

        if (cloudShortDoc.status === 'not_found') {
          if (apiReturnedQuotaExceeded) {
            encounteredQuotaError = true;
          } else {
            // Confirmed 404 from Firestore server; clear transient API-500 flag so genuine 404 returns not_found
            encounteredNetworkFailure = false;
          }
        }
      }
    } catch {
      encounteredNetworkFailure = true;
    }
  }

  const isBrowserOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  if (!isBrowserOffline && (encounteredQuotaError || apiReturnedQuotaExceeded)) {
    return {
      status: 'quota_exceeded',
      shortId: cleanShortId,
      error:
        'تم الوصول للحد اليومي المجاني لقراءة البيانات في السحابة مؤقتاً. يرجى المحاولة بعد قليل أو فتح الرابط من جهاز المعلم.'
    };
  }
  if (isBrowserOffline || encounteredNetworkFailure) {
    return {
      status: 'network_error',
      shortId: cleanShortId,
      error: 'تعذر الاتصال بالسحابة لتحميل الواجب — يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.'
    };
  }

  return {
    status: 'not_found',
    shortId: cleanShortId,
    error: 'لم يتم العثور على هذا الواجب — قد يكون الرابط غير صحيح أو لم تتم مزامنته بعد.'
  };
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

const SYNC_THROTTLE_TTL_MS = 25_000;
const inFlightHomeworkSyncByKey = new Map<string, Promise<void>>();
const lastCompletedHomeworkSyncMsByKey = new Map<string, number>();

function buildEnrichedTeacherAssignmentsList(
  scopeUid: string,
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[]
): any[] {
  const mergedAssignments = getLocalAssignments(scopeUid);
  const activeAssignmentIds = new Set(
    mergedAssignments.flatMap((a) => [a.id, sanitizeDocId(a.id)])
  );
  const mergedSubmissions = getLocalSubmissions(scopeUid).filter(
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

async function runTeacherAssignmentsCloudSyncCore(
  scopeAtStart: string,
  authUidAtStart: string | null,
  assignmentsOnly = false
): Promise<boolean> {
  const localIdsBeforeCloudFetch = new Set(
    getLocalAssignments(scopeAtStart).flatMap((a) => [a.id, sanitizeDocId(a.id)])
  );

  // Read authoritative cloud state first. A failed read must never be treated as an empty account.
  let cloudAssignments: HomeworkAssignment[] = [];
  let cloudSubmissions: HomeworkSubmission[] = [];
  if (authUidAtStart) {
    try {
      if (assignmentsOnly) {
        cloudAssignments = await activeFetchAllAssignmentsFromCloud(authUidAtStart);
      } else {
        [cloudAssignments, cloudSubmissions] = await Promise.all([
          activeFetchAllAssignmentsFromCloud(authUidAtStart),
          activeFetchAllSubmissionsFromCloud(authUidAtStart)
        ]);
      }
    } catch {
      return false;
    }
  }
  // Guard against stale async completion after account switch or logout
  if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
    return false;
  }

  applyCloudAssignmentsSnapshot(cloudAssignments, scopeAtStart, authUidAtStart);

  // Push any local assignments missing from cloud ONLY if they belong to the currently authenticated UID
  const localAssignments = getLocalAssignments(scopeAtStart);

  let submissionsChanged = false;
  if (!assignmentsOnly) {
    cloudSubmissions.forEach((sub) => {
      if (authUidAtStart && sub.ownerUid && sub.ownerUid !== authUidAtStart) {
        return;
      }
      const subChanged = saveLocalSubmission(
        { ...sub, ...(authUidAtStart ? { ownerUid: authUidAtStart } : {}), cloudSynced: true },
        false
      );
      if (subChanged) {
        submissionsChanged = true;
      }
    });
  }

  let assignmentsChangedDuringSync = false;

  if (authUidAtStart) {
    const cloudAssignmentIds = new Set(cloudAssignments.flatMap((a) => [a.id, sanitizeDocId(a.id)]));
    const isUsingTestTransport = Boolean(testCloudTransport);
    const isListAuthoritative = isUsingTestTransport ? true : wasLastAssignmentsFetchAuthoritative();

    for (const localHw of localAssignments) {
      if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
        return false;
      }
      if (localHw.ownerUid !== authUidAtStart) {
        continue;
      }
      if (
        isAssignmentProtectedFromRemotePrune(localHw.id) ||
        !localIdsBeforeCloudFetch.has(localHw.id)
      ) {
        continue;
      }
      const isMissingFromCloud =
        !cloudAssignmentIds.has(localHw.id) && !cloudAssignmentIds.has(sanitizeDocId(localHw.id));
      if (isMissingFromCloud) {
        if (localHw.cloudSynced === true && !(localHw as any).cloudCreatePending) {
          if (!isListAuthoritative) {
            continue;
          }

          let verifiedMissing = false;
          let verifiedRevoked = false;
          if (isUsingTestTransport) {
            if (testCloudTransport?.fetchAssignment) {
              try {
                const singleDoc = await testCloudTransport.fetchAssignment(localHw.id);
                if (singleDoc && !(singleDoc as any).deleted) {
                  applyCloudAssignmentsSnapshot([singleDoc], scopeAtStart, authUidAtStart);
                  continue;
                }
                verifiedMissing = true;
                verifiedRevoked = Boolean((singleDoc as any)?.deleted);
              } catch {
                continue;
              }
            } else {
              verifiedMissing = true;
              verifiedRevoked = true;
            }
          } else {
            const presence = await verifyAssignmentPresenceInCloud(
              localHw.id,
              authUidAtStart,
              localHw.shortId
            );
            if (presence === 'exists_active' || presence === 'uncertain') {
              if (presence === 'exists_active') {
                clearAssignmentDeletedLocally(localHw.id, scopeAtStart);
                if (localHw.shortId && localHw.isActive !== false && localHw.status !== 'closed') {
                  clearShortIdRevokedLocally(localHw.shortId);
                }
              }
              continue;
            }
            verifiedMissing = true;
            verifiedRevoked = presence === 'deleted_or_revoked' || presence === 'not_found';
          }

          if (verifiedMissing) {
            deleteLocalAssignment(localHw.id, false, {
              isManualDelete: false,
              markShortIdRevoked: verifiedRevoked
            });
            assignmentsChangedDuringSync = true;
            continue;
          }
        } else if ((localHw as any).cloudCreatePending === true || localHw.cloudSynced === false) {
          const { cloudCreatePending: _pending, ...cleanForCloud } = localHw as any;
          const ok = await activeSaveAssignmentToCloud(cleanForCloud as HomeworkAssignment).catch(() => false);
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            return false;
          }
          if (ok) {
            markAssignmentRecentlySaved(localHw.id);
            saveLocalAssignment({ ...localHw, ownerUid: authUidAtStart, cloudSynced: true, cloudCreatePending: false } as HomeworkAssignment, false);
          }
        }
      } else if (localHw.cloudSynced === false || (localHw as any).cloudCreatePending === true) {
        saveLocalAssignment({ ...localHw, ownerUid: authUidAtStart, cloudSynced: true, cloudCreatePending: false } as HomeworkAssignment, false);
      }

      if (!assignmentsOnly && isUsingTestTransport && testCloudTransport?.fetchSubmissionsForAssignment) {
        const assignmentSubs = await activeFetchSubmissionsForAssignmentFromCloud(localHw.id).catch(
          () => [] as HomeworkSubmission[]
        );
        for (const sub of assignmentSubs) {
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            return false;
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
              if (saveLocalSubmission(backfilledSub, false)) {
                submissionsChanged = true;
              }
            }
          } else if (subOwner === authUidAtStart) {
            if (saveLocalSubmission({ ...sub, ownerUid: authUidAtStart, cloudSynced: true }, false)) {
              submissionsChanged = true;
            }
          }
        }
      }
    }

    if (!assignmentsOnly) {
      const localSubs = getLocalSubmissions(scopeAtStart);
      const cloudSubmissionIds = new Set(cloudSubmissions.map((s) => s.id));
      for (const localSub of localSubs) {
        if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
          return false;
        }
        if (localSub.ownerUid && localSub.ownerUid !== authUidAtStart) {
          continue;
        }
        if (!cloudSubmissionIds.has(localSub.id) || localSub.cloudSynced === false) {
          const ok = await activeSaveSubmissionToCloud({ ...localSub, ownerUid: authUidAtStart }).catch(() => false);
          if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
            return false;
          }
          if (ok) {
            saveLocalSubmission({ ...localSub, ownerUid: authUidAtStart, cloudSynced: true }, false);
          }
        }
      }
    }
  }

  recordHomeworkLastRefreshTimestamp('assignments', Date.now(), scopeAtStart);

  if (assignmentsChangedDuringSync || submissionsChanged) {
    notifyHomeworkSyncStateChanged({
      assignmentsChanged: assignmentsChangedDuringSync,
      submissionsChanged
    });
  }

  return true;
}

export async function syncAndFetchTeacherAssignments(
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[],
  options?: { force?: boolean; assignmentsOnly?: boolean; localOnly?: boolean }
): Promise<any[]> {
  const scopeAtStart = getActiveHomeworkScopeUid();
  const authUidAtStart = getCurrentHomeworkOwnerUid();
  const assignmentsOnly = Boolean(options?.assignmentsOnly);
  const syncKey = `${scopeAtStart}::${authUidAtStart || 'none'}::${assignmentsOnly ? 'hw' : 'all'}`;
  const isUsingTestTransport = Boolean(testCloudTransport);

  if (options?.localOnly) {
    return buildEnrichedTeacherAssignmentsList(scopeAtStart, rosterStudents);
  }

  if (options?.force) {
    clearFirestoreReadQuotaFlag();
  }

  if (!isUsingTestTransport && !options?.force) {
    const lastSyncAt = lastCompletedHomeworkSyncMsByKey.get(syncKey) || 0;
    if (lastSyncAt > 0 && Date.now() - lastSyncAt < SYNC_THROTTLE_TTL_MS) {
      if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
        return [];
      }
      return buildEnrichedTeacherAssignmentsList(scopeAtStart, rosterStudents);
    }
  }

  const existingInFlight = !isUsingTestTransport ? inFlightHomeworkSyncByKey.get(syncKey) : undefined;
  if (existingInFlight) {
    await existingInFlight.catch(() => {});
  } else {
    const syncPromise = (async () => {
      const succeeded = await runTeacherAssignmentsCloudSyncCore(
        scopeAtStart,
        authUidAtStart,
        assignmentsOnly
      );
      if (succeeded && !isUsingTestTransport) {
        lastCompletedHomeworkSyncMsByKey.set(syncKey, Date.now());
      }
    })().finally(() => {
      if (inFlightHomeworkSyncByKey.get(syncKey) === syncPromise) {
        inFlightHomeworkSyncByKey.delete(syncKey);
      }
    });
    if (!isUsingTestTransport) {
      inFlightHomeworkSyncByKey.set(syncKey, syncPromise);
    }
    await syncPromise;
  }

  if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
    return [];
  }
  return buildEnrichedTeacherAssignmentsList(scopeAtStart, rosterStudents);
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
  return {
    ...computeAssignmentDetailsObject(rawHw, rosterStudents),
    lastRefreshedAtMs: getHomeworkLastRefreshTimestamp(`report:${safeId}`)
  };
}

export async function fetchAssignmentDetailsWithSync(
  id: string,
  rosterStudents?: { id: string; name: string; code?: string; groupId?: string; deleted?: boolean; status?: string }[],
  fallbackHw?: HomeworkAssignment | null,
  options?: { limit?: number; cursor?: string; refreshAssignment?: boolean }
): Promise<any | null> {
  const scopeAtStart = getActiveHomeworkScopeUid();
  const authUidAtStart = getCurrentHomeworkOwnerUid();
  const safeId = sanitizeDocId(id);

  // Fetch ONLY this assignment's paginated submissions when the assignment already exists locally,
  // avoiding an extra assignment document read on every Report Refresh click.
  const withFastTimeout = <T>(p: Promise<T>, fallback: T, ms = 3500): Promise<T> =>
    Promise.race([
      p.catch(() => fallback),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);

  let nextCursor: string | null = null;
  let hasMore = false;

  const existingLocalHw =
    getLocalAssignments(scopeAtStart).find(
      (a) => a.id === id || sanitizeDocId(a.id) === safeId
    ) ||
    fallbackHw ||
    null;
  const shouldFetchAssignmentDoc =
    options?.refreshAssignment === true ||
    !existingLocalHw ||
    Boolean(testCloudTransport?.fetchAssignment);

  const [cloudHw, cloudSubs] = await Promise.all([
    shouldFetchAssignmentDoc
      ? withFastTimeout(activeFetchAssignmentFromCloud(id), null)
      : Promise.resolve(existingLocalHw),
    (async () => {
      if (testCloudTransport?.fetchSubmissionsForAssignment) {
        return await withFastTimeout(
          testCloudTransport.fetchSubmissionsForAssignment(id),
          [] as HomeworkSubmission[]
        );
      }
      if (options?.limit !== undefined || options?.cursor !== undefined) {
        const page = await withFastTimeout(
          fetchSubmissionsPageFromFirestore(id, {
            limit: options?.limit,
            cursor: options?.cursor
          }),
          { submissions: [] as HomeworkSubmission[], nextCursor: null, hasMore: false }
        );
        nextCursor = page.nextCursor;
        hasMore = page.hasMore;
        return page.submissions;
      }
      return await withFastTimeout(
        activeFetchSubmissionsForAssignmentFromCloud(id),
        [] as HomeworkSubmission[]
      );
    })()
  ]);

  if (getActiveHomeworkScopeUid() !== scopeAtStart || getCurrentHomeworkOwnerUid() !== authUidAtStart) {
    return null;
  }

  if (authUidAtStart && cloudHw?.ownerUid && cloudHw.ownerUid !== authUidAtStart) {
    return null;
  }

  let hwChanged = false;
  let subsChanged = false;

  if (cloudHw && !isAssignmentDeletedLocally(cloudHw.id, scopeAtStart)) {
    if (saveLocalAssignment({ ...cloudHw, cloudSynced: true }, false)) {
      hwChanged = true;
    }
  }
  cloudSubs.forEach((sub) => {
    if (authUidAtStart && sub.ownerUid && sub.ownerUid !== authUidAtStart) return;
    if (saveLocalSubmission({ ...sub, cloudSynced: true }, false)) {
      subsChanged = true;
    }
  });

  const lastRefreshedAtMs = recordHomeworkLastRefreshTimestamp(`report:${safeId}`, Date.now(), scopeAtStart);

  if (hwChanged || subsChanged) {
    notifyHomeworkSyncStateChanged({
      assignmentsChanged: hwChanged,
      submissionsChanged: subsChanged
    });
  }

  const rawHw =
    cloudHw ||
    getLocalAssignments(scopeAtStart).find((a) => a.id === id || sanitizeDocId(a.id) === safeId) ||
    fallbackHw ||
    null;
  if (!rawHw) return null;
  if (authUidAtStart && rawHw.ownerUid && rawHw.ownerUid !== authUidAtStart) {
    return null;
  }

  return {
    ...computeAssignmentDetailsObject(rawHw, rosterStudents),
    nextCursor,
    hasMore,
    lastRefreshedAtMs
  };
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

export async function checkHomeworkAnswerRemotely(params: {
  assignmentId?: string;
  shortId?: string;
  token?: string;
  exerciseId?: string;
  questionId?: string;
  itemId?: string;
  questionType?: string;
  grammarType?: string;
  expectedField?: string;
  selectedAnswer: string;
}): Promise<{ checked: boolean; isCorrect?: boolean }> {
  if (typeof fetch !== 'function') {
    return { checked: false };
  }
  const url = resolveHomeworkApiUrl('/api/homework/check-answer');
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 4500) : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      ...(controller ? { signal: controller.signal } : {})
    });
    if (!res.ok) {
      return { checked: false };
    }
    const data = await res.json().catch(() => null);
    if (data && data.success === true && typeof data.isCorrect === 'boolean') {
      return { checked: true, isCorrect: data.isCorrect };
    }
    return { checked: false };
  } catch {
    return { checked: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}


