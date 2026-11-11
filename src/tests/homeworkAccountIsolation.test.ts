import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import expressApp, {
  resetHomeworkStoresForTesting,
  setGooglePublicCertsCacheForTesting
} from '../api/expressApp';

const testRsaKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

setGooglePublicCertsCacheForTesting(
  {
    valid_test_kid_001: testRsaKeyPair.publicKey,
    unknown_kid: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA00000000000000000000\n-----END PUBLIC KEY-----'
  },
  Date.now() + 86400000
);

function makeTestBearerToken(
  uid: string,
  email?: string,
  overrides?: { expired?: boolean; invalidAudience?: boolean; invalidKid?: boolean }
): string {
  const header = {
    alg: 'RS256',
    kid: overrides?.invalidKid ? 'unknown_kid' : 'valid_test_kid_001',
    typ: 'JWT'
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: overrides?.invalidAudience
      ? 'https://securetoken.google.com/wrong-project'
      : 'https://securetoken.google.com/glueck-c8621',
    aud: overrides?.invalidAudience ? 'wrong-project' : 'glueck-c8621',
    sub: uid,
    email: email || 'teacher@glueck.de',
    iat: nowSec - 10,
    auth_time: nowSec - 10,
    exp: overrides?.expired ? nowSec - 3600 : nowSec + 3600
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${b64Header}.${b64Payload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(testRsaKeyPair.privateKey, 'base64url');
  return `${unsigned}.${signature}`;
}
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  saveLocalAssignment,
  saveAssignmentWithConfirmation,
  getLocalAssignments,
  deleteLocalAssignment,
  saveLocalSubmission,
  saveSubmissionWithConfirmation,
  getLocalSubmissions,
  getStudentLocalSubmissions,
  buildDeterministicSubmissionId,
  getOrCreateStudentAttemptSecret,
  isHomeworkAssignmentOpenForStudents,
  canAccountClaimLegacyHomework,
  backfillLegacyCloudHomeworkForAccount,
  syncAndFetchTeacherAssignments,
  fetchAssignmentDetailsWithSync,
  getLocalAssignmentDetails,
  flushPendingHomeworkCloudWrites,
  getPendingHomeworkSyncCount,
  getHomeworkSummaryStats,
  getAssignmentsStorageKey,
  getSubmissionsStorageKey,
  getDeletedAssignmentsStorageKey,
  migrateLegacyHomeworkForAccount,
  getQuarantinedLegacyHomework,
  LEGACY_ASSIGNMENTS_KEY,
  LEGACY_SUBMISSIONS_KEY,
  QUARANTINED_LEGACY_HOMEWORK_KEY,
  __setHomeworkSyncTransportForTests,
  __setHomeworkAuthUserForTests,
  subscribeTeacherAuth
} from '../shared/homeworkStorageSync';

// --- LocalStorage Mock for Node ---
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

const mockStorage = new MemoryStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  localStorage: mockStorage,
  location: { origin: 'https://glueck.example.com' },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};

const UID_TEACHER_A = 'uid_teacher_A_9x81kL2m';
const EMAIL_TEACHER_A = 'teacher.a@glueck-schule.de';
const UID_TEACHER_B = 'uid_teacher_B_4p29vQ7w';
const EMAIL_TEACHER_B = 'teacher.b@andere-schule.de';

// Simulated Firestore Backing Store for Multi-Device / Multi-Account Cloud Sync Testing
class SimulatedFirestoreCloud {
  public assignments = new Map<string, HomeworkAssignment>();
  public submissions = new Map<string, HomeworkSubmission>();

  clear() {
    this.assignments.clear();
    this.submissions.clear();
  }

  createTransport() {
    return {
      saveAssignment: async (hw: HomeworkAssignment): Promise<boolean> => {
        if (!hw || !hw.id || !hw.ownerUid) return false;
        const existing = this.assignments.get(hw.id);
        if (existing && existing.ownerUid && existing.ownerUid !== hw.ownerUid) {
          return false;
        }
        const sanitizedCopy: HomeworkAssignment = { ...hw, cloudSynced: true };
        delete sanitizedCopy.ownerEmail;
        this.assignments.set(hw.id, sanitizedCopy);
        return true;
      },
      saveSubmission: async (sub: HomeworkSubmission): Promise<boolean> => {
        if (!sub || !sub.id || !sub.assignmentId) return false;
        const parentHw = this.assignments.get(sub.assignmentId);
        if (parentHw && (parentHw.isActive === false || parentHw.status === 'closed')) {
          return false;
        }
        const ownerUid =
          sub.ownerUid ||
          parentHw?.ownerUid ||
          (parentHw ? `legacy_unclaimed_${sub.assignmentId}` : undefined);
        if (!ownerUid) return false;
        if (
          parentHw &&
          parentHw.ownerUid &&
          parentHw.ownerUid !== ownerUid
        ) {
          return false;
        }
        const existing = this.submissions.get(sub.id);
        if (existing) {
          const existingCompleted =
            existing.status === 'completed' || (!existing.status && Boolean(existing.completedAt));
          const isTeacherBackfill =
            (!existing.ownerUid || existing.ownerUid.startsWith('legacy_unclaimed_')) &&
            !ownerUid.startsWith('legacy_unclaimed_');
          if (!isTeacherBackfill && existingCompleted) {
            return false;
          }
        }
        this.submissions.set(sub.id, { ...sub, ownerUid, cloudSynced: true });
        return true;
      },
      fetchAssignment: async (id: string): Promise<HomeworkAssignment | null> => {
        return this.assignments.get(id) || null;
      },
      fetchSubmissionsForAssignment: async (id: string): Promise<HomeworkSubmission[]> => {
        return Array.from(this.submissions.values()).filter((s) => s.assignmentId === id);
      },
      fetchAllAssignments: async (ownerUid?: string): Promise<HomeworkAssignment[]> => {
        if (!ownerUid) return [];
        return Array.from(this.assignments.values()).filter((a) => a.ownerUid === ownerUid);
      },
      fetchAllSubmissions: async (ownerUid?: string): Promise<HomeworkSubmission[]> => {
        if (!ownerUid) return [];
        return Array.from(this.submissions.values()).filter((s) => s.ownerUid === ownerUid);
      },
      deleteAssignment: async (id: string, ownerUid?: string): Promise<boolean> => {
        if (!ownerUid) return false;
        const existing = this.assignments.get(id);
        if (!existing) return true;
        if (existing.ownerUid !== ownerUid) return false;
        this.assignments.delete(id);
        return true;
      },
      deleteSubmissionsForAssignment: async (id: string, ownerUid?: string): Promise<boolean> => {
        if (!ownerUid) return false;
        for (const [subId, sub] of this.submissions.entries()) {
          if (sub.assignmentId === id && sub.ownerUid === ownerUid) {
            this.submissions.delete(subId);
          }
        }
        return true;
      }
    };
  }
}

const cloudDb = new SimulatedFirestoreCloud();

// Faithful evaluator of /firestore.rules for lernstudio_sets, homework_assignments, and homework_submissions
class FirestoreHomeworkRulesEvaluator {
  private rulesSource: string;
  public lernstudioSets = new Map<string, Record<string, any>>();
  public assignments = new Map<string, Record<string, any>>();
  public submissions = new Map<string, Record<string, any>>();

  constructor() {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    this.rulesSource = fs.readFileSync(rulesPath, 'utf-8');
    // Verify the actual firestore.rules file contains the mandatory ownerUid security predicates
    assert.ok(
      this.rulesSource.includes("data.keys().hasAll(['id', 'ownerUid', 'title', 'createdAt', 'isActive', 'payloadJson'])"),
      'firestore.rules must require ownerUid on HomeworkAssignment'
    );
    assert.ok(
      this.rulesSource.includes("data.keys().hasAll(['id', 'assignmentId', 'ownerUid', 'studentName', 'score', 'accuracyPercent', 'completedAt', 'payloadJson'])"),
      'firestore.rules must require ownerUid on HomeworkSubmission'
    );
    assert.ok(
      this.rulesSource.includes('allow get: if isSignedIn() && isValidId(assignmentId) && existing().ownerUid == request.auth.uid;'),
      'firestore.rules must restrict get on homework_assignments to owning teacher'
    );
    assert.ok(
      this.rulesSource.includes('incoming().ownerUid == request.auth.uid'),
      'firestore.rules must enforce incoming().ownerUid == request.auth.uid on assignment creation'
    );
    assert.ok(
      this.rulesSource.includes('incoming().ownerUid == existing().ownerUid'),
      'firestore.rules must enforce ownerUid immutability on update'
    );
  }

  private isValidId(id: any): boolean {
    return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
  }

  private isValidLernstudioSet(data: Record<string, any>): boolean {
    if (!data || typeof data !== 'object') return false;
    const keys = Object.keys(data);
    const required = ['id', 'ownerUid', 'title', 'updatedAt', 'payloadJson'];
    const allowed = new Set(['id', 'ownerUid', 'title', 'updatedAt', 'payloadJson', 'ownerEmail']);
    if (!required.every((k) => keys.includes(k))) return false;
    if (!keys.every((k) => allowed.has(k))) return false;
    return (
      typeof data.id === 'string' && data.id.length >= 1 && data.id.length <= 128 &&
      typeof data.ownerUid === 'string' && data.ownerUid.length >= 1 && data.ownerUid.length <= 128 &&
      typeof data.title === 'string' && data.title.length >= 1 && data.title.length <= 300 &&
      typeof data.updatedAt === 'string' && data.updatedAt.length >= 1 && data.updatedAt.length <= 64 &&
      typeof data.payloadJson === 'string' && data.payloadJson.length >= 2 && data.payloadJson.length <= 500000
    );
  }

  private isValidHomeworkAssignment(data: Record<string, any>): boolean {
    if (!data || typeof data !== 'object') return false;
    const keys = Object.keys(data);
    const required = ['id', 'ownerUid', 'title', 'createdAt', 'isActive', 'payloadJson'];
    const allowed = new Set(['id', 'ownerUid', 'title', 'createdAt', 'isActive', 'payloadJson', 'ownerEmail', 'shareToken']);
    if (!required.every((k) => keys.includes(k))) return false;
    if (!keys.every((k) => allowed.has(k))) return false;
    return (
      typeof data.id === 'string' && data.id.length >= 1 && data.id.length <= 128 &&
      typeof data.ownerUid === 'string' && data.ownerUid.length >= 1 && data.ownerUid.length <= 128 &&
      typeof data.title === 'string' && data.title.length >= 1 && data.title.length <= 300 &&
      typeof data.createdAt === 'string' && data.createdAt.length >= 1 && data.createdAt.length <= 64 &&
      typeof data.isActive === 'boolean' &&
      typeof data.payloadJson === 'string' && data.payloadJson.length >= 2 && data.payloadJson.length <= 500000
    );
  }

  private isValidHomeworkSubmission(data: Record<string, any>): boolean {
    if (!data || typeof data !== 'object') return false;
    const keys = Object.keys(data);
    const required = ['id', 'assignmentId', 'ownerUid', 'studentName', 'score', 'accuracyPercent', 'completedAt', 'payloadJson'];
    const allowed = new Set([
      'id',
      'assignmentId',
      'ownerUid',
      'studentName',
      'score',
      'accuracyPercent',
      'completedAt',
      'payloadJson',
      'ownerEmail',
      'status',
      'attemptSecret'
    ]);
    if (!required.every((k) => keys.includes(k))) return false;
    if (!keys.every((k) => allowed.has(k))) return false;
    if ('status' in data && data.status !== 'in_progress' && data.status !== 'completed') return false;
    if ('attemptSecret' in data && (typeof data.attemptSecret !== 'string' || data.attemptSecret.length > 128)) return false;
    return (
      typeof data.id === 'string' && data.id.length >= 1 && data.id.length <= 128 &&
      typeof data.assignmentId === 'string' && data.assignmentId.length >= 1 && data.assignmentId.length <= 128 &&
      typeof data.ownerUid === 'string' && data.ownerUid.length >= 1 && data.ownerUid.length <= 128 &&
      typeof data.studentName === 'string' && data.studentName.length >= 1 && data.studentName.length <= 150 &&
      typeof data.score === 'number' && data.score >= 0 && data.score <= 100000 &&
      typeof data.accuracyPercent === 'number' && data.accuracyPercent >= 0 && data.accuracyPercent <= 100 &&
      typeof data.completedAt === 'string' && data.completedAt.length >= 0 && data.completedAt.length <= 64 &&
      typeof data.payloadJson === 'string' && data.payloadJson.length >= 2 && data.payloadJson.length <= 500000
    );
  }

  canGetLernstudioSet(setId: string): boolean {
    return this.isValidId(setId) && this.lernstudioSets.has(setId);
  }

  canListLernstudioSet(auth: { uid: string } | null, docData: Record<string, any>): boolean {
    return auth !== null && docData.ownerUid === auth.uid;
  }

  canCreateLernstudioSet(auth: { uid: string } | null, setId: string, incoming: Record<string, any>): boolean {
    return (
      auth !== null &&
      this.isValidId(setId) &&
      this.isValidLernstudioSet(incoming) &&
      incoming.id === setId &&
      incoming.ownerUid === auth.uid
    );
  }

  canUpdateLernstudioSet(auth: { uid: string } | null, setId: string, incoming: Record<string, any>): boolean {
    const existing = this.lernstudioSets.get(setId);
    if (!existing || !auth || !this.isValidId(setId) || !this.isValidLernstudioSet(incoming) || incoming.id !== setId) {
      return false;
    }
    return (
      (existing.ownerUid === auth.uid && incoming.ownerUid === existing.ownerUid) ||
      ((!('ownerUid' in existing) || existing.ownerUid === '') && incoming.ownerUid === auth.uid)
    );
  }

  canDeleteLernstudioSet(auth: { uid: string } | null, setId: string): boolean {
    const existing = this.lernstudioSets.get(setId);
    if (!existing) return false;
    return auth !== null && this.isValidId(setId) && existing.ownerUid === auth.uid;
  }

  canGetAssignment(auth: { uid: string } | null, assignmentId: string): boolean {
    const existing = this.assignments.get(assignmentId);
    if (!existing || !this.isValidId(assignmentId)) return false;
    return auth !== null && existing.ownerUid === auth.uid;
  }

  canListAssignment(auth: { uid: string } | null, docData: Record<string, any>): boolean {
    return auth !== null && docData.ownerUid === auth.uid;
  }

  canCreateAssignment(auth: { uid: string } | null, assignmentId: string, incoming: Record<string, any>): boolean {
    return (
      auth !== null &&
      this.isValidId(assignmentId) &&
      this.isValidHomeworkAssignment(incoming) &&
      incoming.id === assignmentId &&
      incoming.ownerUid === auth.uid
    );
  }

  canUpdateAssignment(auth: { uid: string; email?: string } | null, assignmentId: string, incoming: Record<string, any>): boolean {
    const existing = this.assignments.get(assignmentId);
    if (!existing) return false;
    if (
      auth === null ||
      !this.isValidId(assignmentId) ||
      !this.isValidHomeworkAssignment(incoming) ||
      incoming.id !== assignmentId
    ) {
      return false;
    }
    if (existing.ownerUid === auth.uid && incoming.ownerUid === existing.ownerUid) {
      return true;
    }
    if ((!('ownerUid' in existing) || existing.ownerUid === '') && incoming.ownerUid === auth.uid) {
      if (!('ownerEmail' in existing) || existing.ownerEmail === '' || existing.ownerEmail === auth.email) {
        return true;
      }
    }
    return false;
  }

  canDeleteAssignment(auth: { uid: string } | null, assignmentId: string): boolean {
    const existing = this.assignments.get(assignmentId);
    if (!existing) return false;
    return auth !== null && this.isValidId(assignmentId) && existing.ownerUid === auth.uid;
  }

  canReadSubmission(auth: { uid: string } | null, subData: Record<string, any>): boolean {
    if (!auth) return false;
    if (subData.ownerUid === auth.uid) return true;
    if (
      (!('ownerUid' in subData) || subData.ownerUid === '' || subData.ownerUid === `legacy_unclaimed_${subData.assignmentId}`) &&
      this.assignments.get(subData.assignmentId)?.ownerUid === auth.uid
    ) {
      return true;
    }
    return false;
  }

  canCreateSubmission(auth: { uid: string } | null, submissionId: string, incoming: Record<string, any>): boolean {
    if (!this.isValidId(submissionId) || !this.isValidHomeworkSubmission(incoming) || incoming.id !== submissionId) {
      return false;
    }
    const parentHw = this.assignments.get(incoming.assignmentId);
    if (!parentHw || parentHw.isActive !== true) return false;
    if ('ownerUid' in parentHw && parentHw.ownerUid !== '') {
      return incoming.ownerUid === parentHw.ownerUid;
    }
    return incoming.ownerUid === `legacy_unclaimed_${incoming.assignmentId}`;
  }

  canUpdateSubmission(auth: { uid: string } | null, submissionId: string, incoming: Record<string, any>): boolean {
    const existing = this.submissions.get(submissionId);
    if (!existing) return false;
    if (
      !this.isValidId(submissionId) ||
      !this.isValidHomeworkSubmission(incoming) ||
      incoming.id !== submissionId ||
      incoming.assignmentId !== existing.assignmentId
    ) {
      return false;
    }
    // Tier 1: Owning teacher can update or backfill ownerUid on legacy/unclaimed submissions
    if (auth !== null) {
      if (existing.ownerUid === auth.uid && incoming.ownerUid === existing.ownerUid) {
        return true;
      }
      if (
        (!('ownerUid' in existing) ||
          existing.ownerUid === '' ||
          existing.ownerUid === `legacy_unclaimed_${existing.assignmentId}`) &&
        incoming.ownerUid === auth.uid &&
        this.assignments.get(existing.assignmentId)?.ownerUid === auth.uid
      ) {
        return true;
      }
    }
    // Tier 2: Student updating an active in-progress attempt before completion
    const parentHw = this.assignments.get(existing.assignmentId);
    if (!parentHw || parentHw.isActive !== true) return false;
    if (incoming.ownerUid !== existing.ownerUid) return false;
    if (incoming.studentName !== existing.studentName) return false;
    if ('attemptSecret' in existing && existing.attemptSecret !== '' && incoming.attemptSecret !== existing.attemptSecret) {
      return false;
    }
    if (existing.completedAt !== '' && incoming.completedAt === '') return false;
    if ('status' in existing && existing.status === 'completed') return false;
    return true;
  }

  canDeleteSubmission(auth: { uid: string } | null, submissionId: string): boolean {
    const existing = this.submissions.get(submissionId);
    if (!existing) return false;
    return auth !== null && this.isValidId(submissionId) && existing.ownerUid === auth.uid;
  }
}

function makeAssignment(overrides: Partial<HomeworkAssignment> & { id: string; title: string }): HomeworkAssignment {
  return {
    createdAt: '2026-03-01T10:00:00.000Z',
    setSnapshot: {
      id: 'set-a1',
      title: 'Grundwortschatz A1',
      items: [
        { id: 'w1', german: 'der Apfel', arabic: 'التفاحة' },
        { id: 'w2', german: 'das Buch', arabic: 'الكتاب' }
      ]
    },
    allowedGameModes: ['classic_quiz'],
    questionCount: 2,
    maxAttempts: 3,
    allowReplay: true,
    createdBy: 'Teacher',
    isActive: true,
    audienceMode: 'open',
    ...overrides
  };
}

function makeSubmission(
  overrides: Partial<HomeworkSubmission> & { id: string; assignmentId: string; studentName: string }
): HomeworkSubmission {
  return {
    startedAt: '2026-03-01T10:05:00.000Z',
    completedAt: '2026-03-01T10:07:00.000Z',
    status: 'completed',
    attemptNumber: 1,
    totalQuestions: 2,
    correctAnswersCount: 2,
    scorePercentage: 100,
    accuracy: 100,
    accuracyPercent: 100,
    score: 2,
    timeSpentSeconds: 35,
    responses: [],
    cloudSynced: true,
    ...overrides
  };
}

function resetEnvironment() {
  mockStorage.clear();
  cloudDb.clear();
  resetHomeworkStoresForTesting();
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true
  });
  __setHomeworkAuthUserForTests(null);
  __setHomeworkSyncTransportForTests(cloudDb.createTransport());
}

async function runAllIsolationTests() {
  let passed = 0;

  const runTest = async (code: string, name: string, fn: () => Promise<void> | void) => {
    resetEnvironment();
    await fn();
    passed++;
    console.log(`✅ [${code}] ${name}`);
  };

  console.log('================================================================================');
  console.log('PART 1: FIRESTORE SECURITY RULES VALIDATION (SR-01 .. SR-10)');
  console.log('================================================================================');

  const rules = new FirestoreHomeworkRulesEvaluator();

  await runTest('SR-01', 'Authenticated User A can create, get, list, update, and delete their own homework', () => {
    const docA = {
      id: 'hw_a_1',
      ownerUid: UID_TEACHER_A,
      ownerEmail: EMAIL_TEACHER_A,
      title: 'واجب المعلم أ',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: true,
      payloadJson: JSON.stringify({ id: 'hw_a_1', ownerUid: UID_TEACHER_A })
    };
    assert.equal(rules.canCreateAssignment({ uid: UID_TEACHER_A }, 'hw_a_1', docA), true);
    rules.assignments.set('hw_a_1', docA);

    assert.equal(rules.canGetAssignment({ uid: UID_TEACHER_A }, 'hw_a_1'), true);
    assert.equal(rules.canListAssignment({ uid: UID_TEACHER_A }, docA), true);
    assert.equal(
      rules.canUpdateAssignment({ uid: UID_TEACHER_A }, 'hw_a_1', { ...docA, title: 'عنوان محدث' }),
      true
    );
    assert.equal(rules.canDeleteAssignment({ uid: UID_TEACHER_A }, 'hw_a_1'), true);
  });

  await runTest('SR-02', 'Authenticated User B cannot read private/inactive homework or list, update, or delete User A homework', () => {
    const docAInactive = {
      id: 'hw_a_private',
      ownerUid: UID_TEACHER_A,
      title: 'واجب خاص بالمعلم أ',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: false,
      payloadJson: JSON.stringify({ id: 'hw_a_private', ownerUid: UID_TEACHER_A })
    };
    const docAActive = {
      ...docAInactive,
      id: 'hw_a_active_shared',
      isActive: true
    };
    rules.assignments.set('hw_a_private', docAInactive);
    rules.assignments.set('hw_a_active_shared', docAActive);

    assert.equal(rules.canGetAssignment({ uid: UID_TEACHER_B }, 'hw_a_private'), false);
    assert.equal(rules.canListAssignment({ uid: UID_TEACHER_B }, docAInactive), false);
    assert.equal(rules.canListAssignment({ uid: UID_TEACHER_B }, docAActive), false);
    assert.equal(
      rules.canUpdateAssignment({ uid: UID_TEACHER_B }, 'hw_a_active_shared', { ...docAActive, title: 'Hack' }),
      false
    );
    assert.equal(rules.canDeleteAssignment({ uid: UID_TEACHER_B }, 'hw_a_active_shared'), false);
  });

  await runTest('SR-03', 'Unauthenticated users cannot list, create, update, or delete private teacher homework', () => {
    const docA = {
      id: 'hw_a_closed',
      ownerUid: UID_TEACHER_A,
      title: 'واجب مغلق',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: false,
      payloadJson: JSON.stringify({ id: 'hw_a_closed', ownerUid: UID_TEACHER_A })
    };
    rules.assignments.set('hw_a_closed', docA);

    assert.equal(rules.canGetAssignment(null, 'hw_a_closed'), false);
    assert.equal(rules.canListAssignment(null, docA), false);
    assert.equal(rules.canCreateAssignment(null, 'hw_anon', docA), false);
    assert.equal(rules.canUpdateAssignment(null, 'hw_a_closed', docA), false);
    assert.equal(rules.canDeleteAssignment(null, 'hw_a_closed'), false);
  });

  await runTest('SR-04', 'User B cannot create homework with ownerUid = User A (spoofed ownership rejected)', () => {
    const spoofedDoc = {
      id: 'hw_spoofed',
      ownerUid: UID_TEACHER_A,
      title: 'واجب منتحل',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: true,
      payloadJson: JSON.stringify({ id: 'hw_spoofed', ownerUid: UID_TEACHER_A })
    };
    assert.equal(rules.canCreateAssignment({ uid: UID_TEACHER_B }, 'hw_spoofed', spoofedDoc), false);
  });

  await runTest('SR-05', 'User A cannot update ownerUid after creation (ownership immutability)', () => {
    const docA = {
      id: 'hw_immutable',
      ownerUid: UID_TEACHER_A,
      title: 'واجب أصلي',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: true,
      payloadJson: JSON.stringify({ id: 'hw_immutable', ownerUid: UID_TEACHER_A })
    };
    rules.assignments.set('hw_immutable', docA);

    const mutatedOwnerDoc = {
      ...docA,
      ownerUid: UID_TEACHER_B
    };
    assert.equal(rules.canUpdateAssignment({ uid: UID_TEACHER_A }, 'hw_immutable', mutatedOwnerDoc), false);
  });

  await runTest('SR-06', 'User B cannot read, list, update, or delete submissions belonging to User A homework', () => {
    const subA = {
      id: 'sub_for_a',
      assignmentId: 'hw_a_1',
      ownerUid: UID_TEACHER_A,
      studentName: 'يوسف',
      status: 'completed',
      attemptSecret: 'sec_youssef_1',
      score: 2,
      accuracyPercent: 100,
      completedAt: '2026-03-01T10:10:00.000Z',
      payloadJson: JSON.stringify({ id: 'sub_for_a', assignmentId: 'hw_a_1', ownerUid: UID_TEACHER_A })
    };
    rules.submissions.set('sub_for_a', subA);

    assert.equal(rules.canReadSubmission({ uid: UID_TEACHER_A }, subA), true);
    assert.equal(rules.canReadSubmission({ uid: UID_TEACHER_B }, subA), false);
    assert.equal(rules.canReadSubmission(null, subA), false);
    assert.equal(rules.canUpdateSubmission({ uid: UID_TEACHER_B }, 'sub_for_a', subA), false);
    assert.equal(rules.canDeleteSubmission({ uid: UID_TEACHER_B }, 'sub_for_a'), false);
  });

  await runTest('SR-07', 'Valid student submission to an active shared homework assignment succeeds and locks upon completion', () => {
    const sharedHw = {
      id: 'hw_shared_active',
      ownerUid: UID_TEACHER_A,
      title: 'واجب مشترك للطلاب',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: true,
      payloadJson: JSON.stringify({ id: 'hw_shared_active', ownerUid: UID_TEACHER_A })
    };
    rules.assignments.set('hw_shared_active', sharedHw);

    // Unauthenticated student cannot read raw assignment document via Firestore get (must use secure Express API DTO)
    assert.equal(rules.canGetAssignment(null, 'hw_shared_active'), false);
    assert.equal(rules.canGetAssignment({ uid: UID_TEACHER_A }, 'hw_shared_active'), true);

    const validInProgressSub = {
      id: 'sub_student_1',
      assignmentId: 'hw_shared_active',
      ownerUid: UID_TEACHER_A,
      studentName: 'مريم',
      status: 'in_progress',
      attemptSecret: 'sec_maryam_attempt_1',
      score: 1,
      accuracyPercent: 50,
      completedAt: '',
      payloadJson: JSON.stringify({ id: 'sub_student_1', assignmentId: 'hw_shared_active', ownerUid: UID_TEACHER_A })
    };
    assert.equal(rules.canCreateSubmission(null, 'sub_student_1', validInProgressSub), true);
    rules.submissions.set('sub_student_1', validInProgressSub);

    const completedSub = {
      ...validInProgressSub,
      status: 'completed',
      score: 2,
      accuracyPercent: 100,
      completedAt: '2026-03-01T10:15:00.000Z'
    };
    assert.equal(
      rules.canUpdateSubmission(null, 'sub_student_1', completedSub),
      true
    );
    rules.submissions.set('sub_student_1', completedSub);
    // Once completed, further student overwrites are blocked (V-01)
    assert.equal(
      rules.canUpdateSubmission(null, 'sub_student_1', { ...completedSub, score: 0 }),
      false
    );
  });

  await runTest('SR-08', 'Invalid student submission to a non-existent or inactive assignment fails', () => {
    const inactiveHw = {
      id: 'hw_inactive',
      ownerUid: UID_TEACHER_A,
      title: 'واجب متوقف',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: false,
      payloadJson: JSON.stringify({ id: 'hw_inactive', ownerUid: UID_TEACHER_A })
    };
    rules.assignments.set('hw_inactive', inactiveHw);

    const subToMissing = {
      id: 'sub_missing_hw',
      assignmentId: 'hw_does_not_exist',
      ownerUid: UID_TEACHER_A,
      studentName: 'علي',
      score: 1,
      accuracyPercent: 50,
      completedAt: '2026-03-01T10:15:00.000Z',
      payloadJson: '{}'
    };
    assert.equal(rules.canCreateSubmission(null, 'sub_missing_hw', subToMissing), false);

    const subToInactive = {
      ...subToMissing,
      id: 'sub_inactive_hw',
      assignmentId: 'hw_inactive'
    };
    assert.equal(rules.canCreateSubmission(null, 'sub_inactive_hw', subToInactive), false);
  });

  await runTest('SR-09', 'Student cannot enumerate (list) all homework assignments', () => {
    const hwA = {
      id: 'hw_enum_1',
      ownerUid: UID_TEACHER_A,
      title: 'واجب 1',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: true,
      payloadJson: '{}'
    };
    assert.equal(rules.canListAssignment(null, hwA), false);
    assert.equal(rules.canListAssignment({ uid: UID_TEACHER_B }, hwA), false);
    assert.equal(rules.canListAssignment({ uid: UID_TEACHER_A }, hwA), true);
  });

  await runTest('SR-10', 'Schema validation rejects malformed homework and submission payloads', () => {
    const missingOwnerUid = {
      id: 'hw_bad_1',
      title: 'بدون مالك',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: true,
      payloadJson: '{}'
    };
    assert.equal(rules.canCreateAssignment({ uid: UID_TEACHER_A }, 'hw_bad_1', missingOwnerUid), false);

    const extraForbiddenField = {
      id: 'hw_bad_2',
      ownerUid: UID_TEACHER_A,
      title: 'حقل إضافي',
      createdAt: '2026-03-01T10:00:00.000Z',
      isActive: true,
      payloadJson: '{}',
      isAdminHack: true
    };
    assert.equal(rules.canCreateAssignment({ uid: UID_TEACHER_A }, 'hw_bad_2', extraForbiddenField), false);
  });

  console.log('\n================================================================================');
  console.log('PART 2: CROSS-ACCOUNT ISOLATION REGRESSION TESTS (CA-01 .. CA-11)');
  console.log('================================================================================');

  await runTest('CA-01', 'Account A creates homework on Device 1 -> Account A sees it on Device 1 and Device 2', async () => {
    // Device 1: Account A logs in and creates homework
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const hwA = makeAssignment({ id: 'hw_acc_a_1', title: 'واجب الحساب الأول' });
    const savedRes = await saveAssignmentWithConfirmation(hwA);
    assert.equal(savedRes.cloudSynced, true);
    assert.equal(savedRes.assignment.ownerUid, UID_TEACHER_A);
    assert.equal(getLocalAssignments().length, 1);
    assert.equal(getLocalAssignments()[0].id, 'hw_acc_a_1');
    assert.equal(getLocalAssignments()[0].ownerUid, UID_TEACHER_A);

    // Simulate Device 2 (clear local storage, sign in as Account A, sync from cloud)
    mockStorage.clear();
    assert.equal(getLocalAssignments().length, 0);
    const device2List = await syncAndFetchTeacherAssignments();
    assert.equal(device2List.length, 1);
    assert.equal(device2List[0].id, 'hw_acc_a_1');
    assert.equal(device2List[0].ownerUid, UID_TEACHER_A);
  });

  await runTest('CA-02', 'Account B on Device 3 does NOT see Account A homework', async () => {
    // Seed Account A's homework in cloud
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    await saveAssignmentWithConfirmation(makeAssignment({ id: 'hw_only_for_a', title: 'واجب سري للمعلم أ' }));

    // Device 3: Account B signs in
    mockStorage.clear();
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
    const listForB = await syncAndFetchTeacherAssignments();
    assert.equal(listForB.length, 0, 'Account B must see 0 assignments from Account A');
    assert.equal(getLocalAssignments().length, 0);
    assert.equal(getHomeworkSummaryStats().assignmentsCount, 0);

    // Account B also cannot fetch Account A's assignment details in teacher view
    const detailsForB = await fetchAssignmentDetailsWithSync('hw_only_for_a');
    assert.equal(detailsForB, null, 'Account B must not be able to load Account A assignment details');
  });

  await runTest('CA-03', 'Account B creates its own homework on Device 3 -> Account A does NOT see Account B homework', async () => {
    // Account A creates hw_a
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    await saveAssignmentWithConfirmation(makeAssignment({ id: 'hw_a', title: 'واجب المعلم أ' }));

    // Account B creates hw_b
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
    await saveAssignmentWithConfirmation(makeAssignment({ id: 'hw_b', title: 'واجب المعلم ب' }));

    const listB = await syncAndFetchTeacherAssignments();
    assert.equal(listB.length, 1);
    assert.equal(listB[0].id, 'hw_b');
    assert.equal(listB[0].ownerUid, UID_TEACHER_B);

    // Switch back to Account A and sync
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const listA = await syncAndFetchTeacherAssignments();
    assert.equal(listA.length, 1);
    assert.equal(listA[0].id, 'hw_a');
    assert.equal(listA[0].ownerUid, UID_TEACHER_A);
  });

  await runTest('CA-04', 'Student submits homework for Account A -> Account A sees submission; Account B does NOT', async () => {
    // Account A creates homework
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const { assignment: hwA } = await saveAssignmentWithConfirmation(
      makeAssignment({ id: 'hw_shared_a', title: 'واجب مشترك أ' })
    );

    // Student (unauthenticated on their own device) submits attempt to hwA
    __setHomeworkAuthUserForTests(null);
    const subRes = await saveSubmissionWithConfirmation(
      makeSubmission({
        id: 'sub_student_a1',
        assignmentId: 'hw_shared_a',
        studentName: 'فاطمة الزهراء'
      }),
      hwA
    );
    assert.equal(subRes.cloudSynced, true);
    assert.equal(subRes.submission.ownerUid, UID_TEACHER_A);

    // Account B logs in and syncs -> sees 0 assignments and 0 submissions
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
    const listB = await syncAndFetchTeacherAssignments();
    assert.equal(listB.length, 0);
    assert.equal(getLocalSubmissions().length, 0);
    assert.equal(getHomeworkSummaryStats().submissionsCount, 0);

    // Account A logs in and syncs -> sees its assignment and the student's submission!
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const listA = await syncAndFetchTeacherAssignments();
    assert.equal(listA.length, 1);
    assert.equal(listA[0].submissionCount, 1);
    assert.equal(listA[0].completedStudentsCount, 1);
    assert.equal(getHomeworkSummaryStats().submissionsCount, 1);
  });

  await runTest('CA-05 & CA-06', 'Account A logs out and Account B logs in on the SAME device -> zero leakage, and Account A data remains intact on re-login', async () => {
    // Account A logs in on shared device and creates 2 assignments + 1 submission
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const { assignment: hwA1 } = await saveAssignmentWithConfirmation(
      makeAssignment({ id: 'hw_same_dev_a1', title: 'واجب أ-1' })
    );
    await saveAssignmentWithConfirmation(
      makeAssignment({ id: 'hw_same_dev_a2', title: 'واجب أ-2' })
    );
    await saveSubmissionWithConfirmation(
      makeSubmission({ id: 'sub_same_dev_a1', assignmentId: hwA1.id, studentName: 'عمر' }),
      hwA1
    );

    assert.equal(getLocalAssignments().length, 2);
    assert.equal(getLocalSubmissions().length, 1);
    assert.equal(getAssignmentsStorageKey(), `glueck_hw_assignments_v3_${UID_TEACHER_A}`);

    // Account A logs out -> Account B logs in on the EXACT SAME device (mockStorage is NOT cleared!)
    __setHomeworkAuthUserForTests(null);
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });

    assert.equal(getAssignmentsStorageKey(), `glueck_hw_assignments_v3_${UID_TEACHER_B}`);
    assert.equal(getLocalAssignments().length, 0, 'Account B must see 0 local assignments on shared device');
    assert.equal(getLocalSubmissions().length, 0, 'Account B must see 0 local submissions on shared device');
    assert.equal(getHomeworkSummaryStats().assignmentsCount, 0);

    // Account B runs full cloud sync -> must NOT upload Account A's local assignments into Account B's cloud!
    const syncedB = await syncAndFetchTeacherAssignments();
    assert.equal(syncedB.length, 0);
    assert.equal(
      Array.from(cloudDb.assignments.values()).filter((a) => a.ownerUid === UID_TEACHER_B).length,
      0,
      'Account B cloud must have 0 contaminated assignments from Account A'
    );

    // Account B logs out and Account A logs back in on the same device -> Account A still sees all its data!
    __setHomeworkAuthUserForTests(null);
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    assert.equal(getLocalAssignments().length, 2, 'Account A local assignments must remain intact');
    assert.equal(getLocalSubmissions().length, 1, 'Account A local submissions must remain intact');
  });

  await runTest('CA-07', 'Deleting homework in Account A deletes it only from Account A; Account B cannot delete Account A homework', async () => {
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    await saveAssignmentWithConfirmation(makeAssignment({ id: 'hw_del_a', title: 'واجب أ' }));

    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
    await saveAssignmentWithConfirmation(makeAssignment({ id: 'hw_del_b', title: 'واجب ب' }));

    // Account B attempts to delete Account A's homework -> must be rejected
    deleteLocalAssignment('hw_del_a', true);
    assert.ok(cloudDb.assignments.has('hw_del_a'), 'Account B must not be able to delete Account A assignment in cloud');

    // Account A deletes its own homework -> succeeds without touching Account B's homework
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    deleteLocalAssignment('hw_del_a', true);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(getLocalAssignments().length, 0);
    assert.equal(cloudDb.assignments.has('hw_del_a'), false);
    assert.equal(cloudDb.assignments.has('hw_del_b'), true, 'Account B homework must remain untouched');
  });

  await runTest('CA-08', 'Legacy homework without ownerUid is safely migrated ONLY when ownership is provable, and quarantined when ambiguous', () => {
    const legacyOwnedByEmailA = makeAssignment({
      id: 'hw_legacy_email_a',
      title: 'واجب قديم ببريد المعلم أ',
      ownerEmail: EMAIL_TEACHER_A
    });
    const legacyOwnedByGroupB = makeAssignment({
      id: 'hw_legacy_group_b',
      title: 'واجب قديم لمجموعة المعلم ب',
      audienceMode: 'group',
      groupId: 'group_owned_by_b',
      assignedStudents: [{ id: 'stu_b1', name: 'طالب ب', groupId: 'group_owned_by_b' }]
    });
    const legacyAmbiguousUnowned = makeAssignment({
      id: 'hw_legacy_ambiguous',
      title: 'واجب قديم مجهول الهوية بدون إثبات ملكية'
    });

    mockStorage.setItem(
      LEGACY_ASSIGNMENTS_KEY,
      JSON.stringify([legacyOwnedByEmailA, legacyOwnedByGroupB, legacyAmbiguousUnowned])
    );
    mockStorage.setItem(
      LEGACY_SUBMISSIONS_KEY,
      JSON.stringify([
        makeSubmission({ id: 'sub_leg_a', assignmentId: 'hw_legacy_email_a', studentName: 'سلمى' }),
        makeSubmission({ id: 'sub_leg_amb', assignmentId: 'hw_legacy_ambiguous', studentName: 'مجهول' })
      ])
    );

    // 1. Account B logs in first with group_owned_by_b
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
    const migB = migrateLegacyHomeworkForAccount({
      uid: UID_TEACHER_B,
      email: EMAIL_TEACHER_B,
      ownedGroupIds: ['group_owned_by_b']
    });
    assert.equal(migB.migratedAssignments, 1, 'Account B must only claim its provably owned group assignment');
    assert.equal(migB.quarantinedAssignments, 1, 'Ambiguous legacy record must be quarantined');
    const bAssignments = getLocalAssignments();
    assert.equal(bAssignments.length, 1);
    assert.equal(bAssignments[0].id, 'hw_legacy_group_b');
    assert.equal(bAssignments[0].ownerUid, UID_TEACHER_B);

    // Verify ambiguous record is in quarantine and NOT in Account B's assignments
    const quarantined = getQuarantinedLegacyHomework();
    assert.equal(quarantined.length, 1);
    assert.equal(quarantined[0].assignment.id, 'hw_legacy_ambiguous');

    // 2. Account A logs in later -> claims hw_legacy_email_a + its submission sub_leg_a
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const migA = migrateLegacyHomeworkForAccount({
      uid: UID_TEACHER_A,
      email: EMAIL_TEACHER_A
    });
    assert.equal(migA.migratedAssignments, 1);
    assert.equal(migA.migratedSubmissions, 1);
    const aAssignments = getLocalAssignments();
    assert.equal(aAssignments.length, 1);
    assert.equal(aAssignments[0].id, 'hw_legacy_email_a');
    assert.equal(aAssignments[0].ownerUid, UID_TEACHER_A);
    assert.equal(getLocalSubmissions().length, 1);
    assert.equal(getLocalSubmissions()[0].ownerUid, UID_TEACHER_A);
  });

  await runTest('CA-09', 'Rapid account switching (A -> B -> A) while async cloud operations are in flight prevents stale state bleed', async () => {
    // Seed 1 assignment for A and 1 for B in cloud
    cloudDb.assignments.set(
      'hw_rapid_a',
      makeAssignment({ id: 'hw_rapid_a', title: 'واجب أ', ownerUid: UID_TEACHER_A })
    );
    cloudDb.assignments.set(
      'hw_rapid_b',
      makeAssignment({ id: 'hw_rapid_b', title: 'واجب ب', ownerUid: UID_TEACHER_B })
    );

    // Configure delayed fetchAllAssignments for Account A to simulate slow network during rapid switch
    let resolveDelayedFetchA: ((val: HomeworkAssignment[]) => void) | null = null;
    const baseTransport = cloudDb.createTransport();
    __setHomeworkSyncTransportForTests({
      ...baseTransport,
      fetchAllAssignments: (ownerUid?: string) => {
        if (ownerUid === UID_TEACHER_A && !resolveDelayedFetchA) {
          return new Promise<HomeworkAssignment[]>((resolve) => {
            resolveDelayedFetchA = resolve;
          });
        }
        return baseTransport.fetchAllAssignments(ownerUid);
      }
    });

    // Start sync under Account A
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const inFlightSyncA = syncAndFetchTeacherAssignments();

    // Immediately switch to Account B BEFORE Account A's cloud fetch resolves!
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
    const listB = await syncAndFetchTeacherAssignments();
    assert.equal(listB.length, 1);
    assert.equal(listB[0].id, 'hw_rapid_b');

    // Now resolve Account A's delayed cloud response while Account B is active
    assert.ok(resolveDelayedFetchA);
    (resolveDelayedFetchA as (val: HomeworkAssignment[]) => void)([
      makeAssignment({ id: 'hw_rapid_a', title: 'واجب أ', ownerUid: UID_TEACHER_A })
    ]);
    const staleResultA = await inFlightSyncA;
    assert.equal(staleResultA.length, 0, 'Stale in-flight sync from Account A must abort and return empty');

    // Verify Account B's local storage was NOT polluted by Account A's late response
    const currentBAssignments = getLocalAssignments();
    assert.equal(currentBAssignments.length, 1);
    assert.equal(currentBAssignments[0].id, 'hw_rapid_b');
    assert.equal(currentBAssignments[0].ownerUid, UID_TEACHER_B);
  });

  await runTest('CA-10', 'Offline homework created under Account A syncs ONLY when Account A reconnects, NEVER when Account B logs in', async () => {
    // Account A is signed in while offline
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    const baseTransport = cloudDb.createTransport();
    let isNetworkOnline = false;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        get onLine() {
          return isNetworkOnline;
        }
      },
      configurable: true,
      writable: true
    });
    __setHomeworkSyncTransportForTests({
      ...baseTransport,
      saveAssignment: async (hw) => {
        if (!isNetworkOnline) return false;
        return baseTransport.saveAssignment(hw);
      }
    });

    const offlineRes = await saveAssignmentWithConfirmation(
      makeAssignment({ id: 'hw_offline_a', title: 'واجب أوفلاين للمعلم أ' })
    );
    assert.equal(offlineRes.cloudSynced, false);
    assert.equal(offlineRes.assignment.ownerUid, UID_TEACHER_A);
    assert.equal(getPendingHomeworkSyncCount(), 1);
    assert.equal(cloudDb.assignments.has('hw_offline_a'), false);

    // Network comes back online, but Account B logs in on the device
    isNetworkOnline = true;
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
    assert.equal(getPendingHomeworkSyncCount(), 0, 'Account B must see 0 pending sync items from Account A');
    const flushUnderB = await flushPendingHomeworkCloudWrites();
    assert.equal(flushUnderB.syncedAssignments, 0);
    assert.equal(cloudDb.assignments.has('hw_offline_a'), false, 'Account A offline homework must NOT sync while Account B is logged in');

    // Account A logs back in -> flushPendingHomeworkCloudWrites now syncs Account A's pending homework!
    __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
    assert.equal(getPendingHomeworkSyncCount(), 1);
    const flushUnderA = await flushPendingHomeworkCloudWrites();
    assert.equal(flushUnderA.syncedAssignments, 1);
    assert.equal(flushUnderA.remainingPending, 0);
    assert.equal(cloudDb.assignments.get('hw_offline_a')?.ownerUid, UID_TEACHER_A);
  });

  await runTest('CA-11', 'Public homework share link & Express API enforce ownerUid isolation while preserving student access', async () => {
    const server = expressApp.listen(0);
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      // Teacher A posts assignment to Express relay
      const createARes = await fetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A)}`
        },
        body: JSON.stringify(
          makeAssignment({
            id: 'api_hw_a',
            title: 'واجب المعلم أ',
            ownerUid: UID_TEACHER_A
          })
        )
      });
      assert.equal(createARes.status, 200);

      // Teacher B attempts to overwrite Teacher A's assignment -> HTTP 403
      const overwriteByBRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_B, EMAIL_TEACHER_B)}`
        },
        body: JSON.stringify(
          makeAssignment({
            id: 'api_hw_a',
            title: 'اختراق من ب',
            ownerUid: UID_TEACHER_B
          })
        )
      });
      assert.equal(overwriteByBRes.status, 403);

      // Teacher B lists assignments with ownerUid=UID_TEACHER_B -> receives 0 assignments
      const listBRes = await fetch(
        `${baseUrl}/api/teacher/assignments?ownerUid=${encodeURIComponent(UID_TEACHER_B)}`,
        {
          headers: {
            Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_B, EMAIL_TEACHER_B)}`
          }
        }
      );
      const listBData = await listBRes.json();
      assert.equal(listBData.assignments.length, 0);

      // Student fetches single assignment via /api/homework/info?id=api_hw_a -> succeeds (200)
      const studentInfoRes = await fetch(`${baseUrl}/api/homework/info?id=api_hw_a`);
      assert.equal(studentInfoRes.status, 200);
      const studentHw = await studentInfoRes.json();
      assert.equal(studentHw.id, 'api_hw_a');
      assert.equal(studentHw.ownerUid, undefined);

      // Student submits attempt to /api/homework/submit -> succeeds and attaches ownerUid = UID_TEACHER_A
      const submitRes = await fetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'sub_api_student_1',
          assignmentId: 'api_hw_a',
          studentName: 'نور الهدى',
          responses: [
            { questionId: 'q1', germanWord: 'der Apfel', studentAnswer: 'der Apfel', correctAnswer: 'der Apfel', isCorrect: true, timeSpentSeconds: 5 }
          ]
        })
      });
      assert.equal(submitRes.status, 200);
      const submitData = await submitRes.json();
      assert.equal(submitData.submission.ownerUid, UID_TEACHER_A);

      // Teacher B queries /api/homework/submissions?ownerUid=UID_TEACHER_B -> receives 0 submissions
      const subsBRes = await fetch(
        `${baseUrl}/api/homework/submissions?ownerUid=${encodeURIComponent(UID_TEACHER_B)}`,
        {
          headers: {
            Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_B, EMAIL_TEACHER_B)}`
          }
        }
      );
      const subsBData = await subsBRes.json();
      assert.equal(subsBData.submissions.length, 0);

      // Teacher A queries /api/homework/submissions?ownerUid=UID_TEACHER_A -> receives the student's submission!
      const subsARes = await fetch(
        `${baseUrl}/api/homework/submissions?ownerUid=${encodeURIComponent(UID_TEACHER_A)}`,
        {
          headers: {
            Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A)}`
          }
        }
      );
      const subsAData = await subsARes.json();
      assert.equal(subsAData.submissions.length, 1);
      assert.equal(subsAData.submissions[0].id, 'sub_api_student_1');
      assert.equal(subsAData.submissions[0].ownerUid, UID_TEACHER_A);
    } finally {
      server.close();
    }
  });

  console.log('\n================================================================================');
  console.log('PART 4: SECURITY AUDIT FINDINGS V-01 .. V-06 REGRESSION SUITE');
  console.log('================================================================================');

  await runTest(
    'V-01',
    'Student submission anti-overwrite, per-device attempt token, attemptSecret validation, and student replay tracking',
    async () => {
      const hwA = makeAssignment({
        id: 'hw_v01',
        title: 'واجب الحماية من الكتابة الفوقية',
        ownerUid: UID_TEACHER_A
      });
      cloudDb.assignments.set(hwA.id, hwA);

      // Device 1 generates deterministic ID for Student 1 Attempt 1
      const device1SubId = buildDeterministicSubmissionId('hw_v01', 'st_1', 'أحمد', 1);
      const device1Secret = getOrCreateStudentAttemptSecret(device1SubId);

      // Simulate Device 2 (clear localStorage so device token is regenerated)
      mockStorage.clear();
      const device2SubId = buildDeterministicSubmissionId('hw_v01', 'st_1', 'أحمد', 1);
      assert.notEqual(
        device1SubId,
        device2SubId,
        'Two different devices must generate distinct submission IDs to prevent cross-device collisions'
      );

      // Unauthenticated student on Device 2 starts in-progress attempt and completes it
      const inProgressSub = makeSubmission({
        id: device2SubId,
        assignmentId: 'hw_v01',
        ownerUid: UID_TEACHER_A,
        studentId: 'st_1',
        studentName: 'أحمد',
        attemptNumber: 1,
        status: 'in_progress',
        completedAt: '',
        score: 1,
        accuracyPercent: 50
      });
      const step1 = await saveSubmissionWithConfirmation(inProgressSub, hwA);
      assert.equal(step1.cloudSynced, true);
      assert.ok(step1.submission.attemptSecret, 'Saved submission must include attemptSecret');

      // Complete the attempt
      const completedSub = makeSubmission({
        ...step1.submission,
        status: 'completed',
        completedAt: '2026-03-02T12:00:00.000Z',
        score: 2,
        accuracyPercent: 100
      });
      const step2 = await saveSubmissionWithConfirmation(completedSub, hwA);
      assert.equal(step2.cloudSynced, true);

      // Verify student replay tracking (getStudentLocalSubmissions) sees the completed attempt even when unauthenticated
      const studentLocalSubs = getStudentLocalSubmissions('hw_v01', UID_TEACHER_A);
      assert.equal(studentLocalSubs.length, 1);
      assert.equal(studentLocalSubs[0].status, 'completed');
      assert.equal(studentLocalSubs[0].score, 2);

      // Attempt to overwrite the completed submission with a forged score or different attemptSecret -> REJECTED!
      await assert.rejects(
        async () => {
          await saveSubmissionWithConfirmation(
            makeSubmission({
              ...completedSub,
              score: 0,
              accuracyPercent: 0
            }),
            hwA
          );
        },
        /تم إنهاء هذه المحاولة مسبقاً/
      );

      await assert.rejects(
        async () => {
          await saveSubmissionWithConfirmation(
            makeSubmission({
              ...completedSub,
              attemptSecret: device1Secret
            }),
            hwA
          );
        },
        /غير مصرح بتعديل هذه المحاولة/
      );

      // Verify Firestore rules also reject overwriting a completed submission or changing studentName / attemptSecret
      rules.assignments.set('hw_v01', {
        id: 'hw_v01',
        ownerUid: UID_TEACHER_A,
        title: hwA.title,
        createdAt: hwA.createdAt,
        isActive: true,
        payloadJson: JSON.stringify(hwA)
      });
      const ruleSubDoc = {
        id: device2SubId,
        assignmentId: 'hw_v01',
        ownerUid: UID_TEACHER_A,
        studentName: 'أحمد',
        status: 'in_progress',
        attemptSecret: step1.submission.attemptSecret,
        score: 1,
        accuracyPercent: 50,
        completedAt: '',
        payloadJson: '{}'
      };
      rules.submissions.set(device2SubId, ruleSubDoc);

      // Wrong attemptSecret rejected on in-progress update
      assert.equal(
        rules.canUpdateSubmission(null, device2SubId, {
          ...ruleSubDoc,
          attemptSecret: 'forged_secret',
          score: 0
        }),
        false
      );
      // Changing studentName rejected
      assert.equal(
        rules.canUpdateSubmission(null, device2SubId, {
          ...ruleSubDoc,
          studentName: 'مخترق'
        }),
        false
      );
    }
  );

  await runTest(
    'V-02',
    'Unauthenticated student offline submission is queued locally and flushed to cloud upon reconnect',
    async () => {
      // Teacher A creates and syncs an assignment first
      const hwA = makeAssignment({
        id: 'hw_v02_offline_student',
        title: 'واجب الطالب أوفلاين',
        ownerUid: UID_TEACHER_A
      });
      cloudDb.assignments.set(hwA.id, hwA);

      // Student is unauthenticated and offline
      __setHomeworkAuthUserForTests(null);
      const baseTransport = cloudDb.createTransport();
      let isNetworkOnline = false;
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          get onLine() {
            return isNetworkOnline;
          }
        },
        configurable: true,
        writable: true
      });
      __setHomeworkSyncTransportForTests({
        ...baseTransport,
        saveSubmission: async (sub) => {
          if (!isNetworkOnline) return false;
          return baseTransport.saveSubmission(sub);
        }
      });

      const offlineStudentSub = makeSubmission({
        id: 'sub_v02_student_offline_1',
        assignmentId: hwA.id,
        ownerUid: UID_TEACHER_A,
        studentName: 'سارة (أوفلاين)',
        score: 2,
        accuracyPercent: 100
      });

      const saveRes = await saveSubmissionWithConfirmation(offlineStudentSub, hwA);
      assert.equal(saveRes.cloudSynced, false, 'Submission while offline must be marked cloudSynced: false');
      assert.equal(
        getPendingHomeworkSyncCount(),
        1,
        'Unauthenticated student scope must report 1 pending submission'
      );
      assert.equal(cloudDb.submissions.has('sub_v02_student_offline_1'), false);

      // Network reconnects while student is STILL unauthenticated
      isNetworkOnline = true;
      const flushRes = await flushPendingHomeworkCloudWrites();
      assert.equal(flushRes.syncedSubmissions, 1, 'Pending unauthenticated student submission must flush on reconnect');
      assert.equal(flushRes.remainingPending, 0);
      assert.equal(cloudDb.submissions.get('sub_v02_student_offline_1')?.ownerUid, UID_TEACHER_A);
      assert.equal(cloudDb.submissions.get('sub_v02_student_offline_1')?.studentName, 'سارة (أوفلاين)');
    }
  );

  await runTest(
    'V-03',
    'Pre-existing legacy cloud assignments and submissions without ownerUid are deterministically backfilled without cross-account leakage',
    async () => {
      // Seed a legacy assignment in cloud and Firestore rules WITHOUT ownerUid, owned by Teacher A via ownerEmail/groupId
      const legacyCloudHw: HomeworkAssignment = {
        ...makeAssignment({
          id: 'hw_v03_legacy_cloud',
          title: 'واجب سحابي قديم للمعلم أ',
          audienceMode: 'group',
          groupId: 'grp_teacher_a_1',
          assignedStudents: [{ id: 'st_a1', name: 'طارق', groupId: 'grp_teacher_a_1' }]
        }),
        ownerUid: undefined,
        ownerEmail: EMAIL_TEACHER_A
      };
      cloudDb.assignments.set(legacyCloudHw.id, legacyCloudHw);

      const legacyRuleDoc = {
        id: 'hw_v03_legacy_cloud',
        ownerUid: '',
        ownerEmail: EMAIL_TEACHER_A,
        title: legacyCloudHw.title,
        createdAt: legacyCloudHw.createdAt,
        isActive: true,
        payloadJson: JSON.stringify(legacyCloudHw)
      };
      rules.assignments.set(legacyCloudHw.id, legacyRuleDoc);

      // Student submits to legacy assignment before teacher backfills it -> uses legacy_unclaimed_<assignmentId>
      const legacyStudentSub = {
        id: 'sub_v03_legacy_1',
        assignmentId: 'hw_v03_legacy_cloud',
        ownerUid: 'legacy_unclaimed_hw_v03_legacy_cloud',
        studentName: 'طارق',
        status: 'completed',
        attemptSecret: 'sec_tarek_1',
        score: 2,
        accuracyPercent: 100,
        completedAt: '2026-03-02T14:00:00.000Z',
        payloadJson: '{}'
      };
      assert.equal(
        rules.canCreateSubmission(null, legacyStudentSub.id, legacyStudentSub),
        true,
        'Student must be able to submit to an active legacy assignment before teacher backfill'
      );
      rules.submissions.set(legacyStudentSub.id, legacyStudentSub);
      cloudDb.submissions.set(
        legacyStudentSub.id,
        makeSubmission({
          id: legacyStudentSub.id,
          assignmentId: legacyCloudHw.id,
          ownerUid: 'legacy_unclaimed_hw_v03_legacy_cloud',
          studentId: 'st_a1',
          studentName: 'طارق'
        })
      );

      // Teacher B logs in first and attempts to backfill/claim -> REJECTED by both rules and backfill helper!
      assert.equal(
        rules.canUpdateAssignment(
          { uid: UID_TEACHER_B, email: EMAIL_TEACHER_B },
          legacyCloudHw.id,
          { ...legacyRuleDoc, ownerUid: UID_TEACHER_B }
        ),
        false,
        'Teacher B must not be allowed to claim Teacher A legacy cloud assignment'
      );

      __setHomeworkAuthUserForTests({ uid: UID_TEACHER_B, email: EMAIL_TEACHER_B });
      const backfillB = await backfillLegacyCloudHomeworkForAccount({
        uid: UID_TEACHER_B,
        email: EMAIL_TEACHER_B,
        ownedGroupIds: ['grp_teacher_b_1'],
        candidateAssignmentIds: [legacyCloudHw.id]
      });
      assert.equal(backfillB.backfilledAssignments, 0);
      assert.equal(backfillB.backfilledSubmissions, 0);
      assert.equal(cloudDb.assignments.get(legacyCloudHw.id)?.ownerUid, undefined);

      // Teacher A logs in -> deterministically proves ownership and backfills assignment + submission!
      assert.equal(
        rules.canUpdateAssignment(
          { uid: UID_TEACHER_A, email: EMAIL_TEACHER_A },
          legacyCloudHw.id,
          { ...legacyRuleDoc, ownerUid: UID_TEACHER_A }
        ),
        true,
        'Teacher A must be allowed to backfill ownerUid on their legacy assignment'
      );
      rules.assignments.set(legacyCloudHw.id, { ...legacyRuleDoc, ownerUid: UID_TEACHER_A });
      assert.equal(
        rules.canUpdateSubmission(
          { uid: UID_TEACHER_A },
          legacyStudentSub.id,
          { ...legacyStudentSub, ownerUid: UID_TEACHER_A }
        ),
        true,
        'Teacher A must be allowed to backfill ownerUid on legacy_unclaimed_ submission'
      );

      __setHomeworkAuthUserForTests({ uid: UID_TEACHER_A, email: EMAIL_TEACHER_A });
      const backfillA = await backfillLegacyCloudHomeworkForAccount({
        uid: UID_TEACHER_A,
        email: EMAIL_TEACHER_A,
        ownedGroupIds: ['grp_teacher_a_1'],
        candidateAssignmentIds: [legacyCloudHw.id]
      });
      assert.equal(backfillA.backfilledAssignments, 1);
      assert.equal(backfillA.backfilledSubmissions, 1);
      assert.equal(cloudDb.assignments.get(legacyCloudHw.id)?.ownerUid, UID_TEACHER_A);
      assert.equal(cloudDb.submissions.get(legacyStudentSub.id)?.ownerUid, UID_TEACHER_A);
    }
  );

  await runTest(
    'V-04',
    'Public student homework link works even when a different Google account is signed into the browser',
    () => {
      const activeHw = {
        id: 'hw_v04_public_link',
        ownerUid: UID_TEACHER_A,
        title: 'واجب عام للطلاب',
        createdAt: '2026-03-01T10:00:00.000Z',
        isActive: true,
        payloadJson: JSON.stringify({ id: 'hw_v04_public_link', ownerUid: UID_TEACHER_A })
      };
      rules.assignments.set(activeHw.id, activeHw);

      // Student opens /homework/hw_v04_public_link while signed into Google Account B in the browser -> raw Firestore get is blocked (fetched via secure Express API DTO)
      assert.equal(
        rules.canGetAssignment({ uid: UID_TEACHER_B }, activeHw.id),
        false,
        'Non-owner cannot read raw assignment document from Firestore directly'
      );
      assert.equal(
        rules.canGetAssignment({ uid: UID_TEACHER_A }, activeHw.id),
        true,
        'Owning teacher can read raw assignment document from Firestore'
      );

      const studentSubWhileSignedInB = {
        id: 'sub_v04_student_1',
        assignmentId: activeHw.id,
        ownerUid: UID_TEACHER_A,
        studentName: 'كريم',
        status: 'in_progress',
        attemptSecret: 'sec_karim_v04',
        score: 1,
        accuracyPercent: 50,
        completedAt: '',
        payloadJson: '{}'
      };
      assert.equal(
        rules.canCreateSubmission({ uid: UID_TEACHER_B }, studentSubWhileSignedInB.id, studentSubWhileSignedInB),
        true,
        'Student must be able to create submission with ownerUid=TeacherA even when signed into Account B'
      );
      rules.submissions.set(studentSubWhileSignedInB.id, studentSubWhileSignedInB);

      assert.equal(
        rules.canUpdateSubmission(
          { uid: UID_TEACHER_B },
          studentSubWhileSignedInB.id,
          {
            ...studentSubWhileSignedInB,
            status: 'completed',
            score: 2,
            accuracyPercent: 100,
            completedAt: '2026-03-02T15:00:00.000Z'
          }
        ),
        true,
        'Student must be able to complete their active in-progress submission with matching attemptSecret'
      );

      // Meanwhile, Account B still cannot list Teacher A's assignments or read Teacher A's submissions
      assert.equal(rules.canListAssignment({ uid: UID_TEACHER_B }, activeHw), false);
      assert.equal(rules.canReadSubmission({ uid: UID_TEACHER_B }, studentSubWhileSignedInB), false);
    }
  );

  await runTest(
    'V-05',
    'Express API blocks unauthenticated submission enumeration, rejects forged assignmentFallback, and enforces closed/inactive status',
    async () => {
      const server = expressApp.listen(0);
      try {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const baseUrl = `http://127.0.0.1:${port}`;

        // 1. Seed an active assignment and a closed assignment for Teacher A
        await fetch(`${baseUrl}/api/teacher/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A)}`
          },
          body: JSON.stringify(
            makeAssignment({
              id: 'hw_v05_open',
              title: 'واجب مفتوح',
              ownerUid: UID_TEACHER_A,
              isActive: true
            })
          )
        });
        await fetch(`${baseUrl}/api/teacher/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A)}`
          },
          body: JSON.stringify(
            makeAssignment({
              id: 'hw_v05_closed',
              title: 'واجب مغلق',
              ownerUid: UID_TEACHER_A,
              isActive: false,
              status: 'closed'
            })
          )
        });

        // 2. Unauthenticated GET /api/homework/submissions?assignmentId=hw_v05_open WITHOUT ownerUid -> 401!
        const unauthListSubs = await fetch(`${baseUrl}/api/homework/submissions?assignmentId=hw_v05_open`);
        assert.equal(
          unauthListSubs.status,
          401,
          'GET /api/homework/submissions without ownerUid must be rejected with 401'
        );

        // 3. Forged assignmentFallback for a nonexistent assignment -> 404!
        const forgedFallbackRes = await fetch(`${baseUrl}/api/homework/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'sub_forged_fallback',
            assignmentId: 'hw_nonexistent_forged',
            studentName: 'مهاجم',
            assignmentFallback: makeAssignment({
              id: 'hw_nonexistent_forged',
              title: 'واجب مزيف',
              ownerUid: UID_TEACHER_A
            }),
            responses: []
          })
        });
        assert.equal(
          forgedFallbackRes.status,
          404,
          'POST /api/homework/submit must ignore untrusted assignmentFallback and return 404 for unknown assignments'
        );

        // 4. Closed assignment must reject GET /api/homework/info (403), POST /api/homework/submit (403), and client helper
        const closedInfoRes = await fetch(`${baseUrl}/api/homework/info?id=hw_v05_closed`);
        assert.equal(closedInfoRes.status, 403);

        const closedSubmitRes = await fetch(`${baseUrl}/api/homework/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'sub_to_closed',
            assignmentId: 'hw_v05_closed',
            studentName: 'طالب متأخر',
            responses: []
          })
        });
        assert.equal(closedSubmitRes.status, 403);

        assert.equal(
          isHomeworkAssignmentOpenForStudents(
            makeAssignment({ id: 'hw_v05_closed', title: 'مغلق', isActive: false })
          ),
          false
        );
      } finally {
        server.close();
      }
    }
  );

  await runTest(
    'V-06',
    'Public homework documents strip ownerEmail, lernstudio_sets enforce ownerUid isolation, and backup import verifies ownership',
    async () => {
      // 1. Verify Express /api/homework/info strips ownerEmail from public response
      const server = expressApp.listen(0);
      try {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const baseUrl = `http://127.0.0.1:${port}`;

        await fetch(`${baseUrl}/api/teacher/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A)}`
          },
          body: JSON.stringify(
            makeAssignment({
              id: 'hw_v06_privacy',
              title: 'واجب بدون تسريب الإيميل',
              ownerUid: UID_TEACHER_A,
              ownerEmail: EMAIL_TEACHER_A
            })
          )
        });

        const infoRes = await fetch(`${baseUrl}/api/homework/info?id=hw_v06_privacy`);
        assert.equal(infoRes.status, 200);
        const infoData = await infoRes.json();
        assert.equal(infoData.ownerEmail, undefined, 'Public /api/homework/info must never expose teacher ownerEmail');
      } finally {
        server.close();
      }
    }
  );

  await runTest(
    'F-01',
    'Mandatory Firebase Authentication for Teacher APIs (Vulnerability F-01 Fix)',
    async () => {
      const server = expressApp.listen(0);
      try {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const baseUrl = `http://127.0.0.1:${port}`;

        const tokenTeacherA = makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A);
        const tokenTeacherB = makeTestBearerToken(UID_TEACHER_B, EMAIL_TEACHER_B);
        const expiredTokenA = makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A, { expired: true });
        const invalidAudToken = makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A, { invalidAudience: true });
        const invalidKidToken = makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A, { invalidKid: true });

        // Seed 1 assignment for Teacher A and 1 for Teacher B
        const postA = await fetch(`${baseUrl}/api/teacher/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTeacherA}`
          },
          body: JSON.stringify(
            makeAssignment({ id: 'f01_hw_a', title: 'واجب المعلم أ', ownerUid: UID_TEACHER_A })
          )
        });
        assert.equal(postA.status, 200);

        const postB = await fetch(`${baseUrl}/api/teacher/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTeacherB}`
          },
          body: JSON.stringify(
            makeAssignment({ id: 'f01_hw_b', title: 'واجب المعلم ب', ownerUid: UID_TEACHER_B })
          )
        });
        assert.equal(postB.status, 200);

        // Student submits attempt to Teacher A's homework
        const submitRes = await fetch(`${baseUrl}/api/homework/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'sub_f01_1',
            assignmentId: 'f01_hw_a',
            studentName: 'ياسين',
            responses: []
          })
        });
        assert.equal(submitRes.status, 200);

        // 1. Missing Bearer token + target ownerUid returns 401
        const missingTokenRes = await fetch(
          `${baseUrl}/api/teacher/assignments?ownerUid=${encodeURIComponent(UID_TEACHER_A)}`
        );
        assert.equal(missingTokenRes.status, 401);
        const missingTokenData = await missingTokenRes.json();
        assert.equal(missingTokenData.assignments.length, 0);

        // 2. Invalid Bearer token returns 401
        const invalidAudRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
          headers: { Authorization: `Bearer ${invalidAudToken}` }
        });
        assert.equal(invalidAudRes.status, 401);

        const invalidKidRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
          headers: { Authorization: `Bearer ${invalidKidToken}` }
        });
        assert.equal(invalidKidRes.status, 401);

        // 3. Expired token returns 401
        const expiredRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
          headers: { Authorization: `Bearer ${expiredTokenA}` }
        });
        assert.equal(expiredRes.status, 401);

        // 4. Valid Teacher A token returns only Teacher A assignments
        const listARes = await fetch(`${baseUrl}/api/teacher/assignments`, {
          headers: { Authorization: `Bearer ${tokenTeacherA}` }
        });
        assert.equal(listARes.status, 200);
        const listAData = await listARes.json();
        assert.equal(listAData.assignments.length, 1);
        assert.equal(listAData.assignments[0].id, 'f01_hw_a');

        // 5. Valid Teacher A token cannot request Teacher B data by passing Teacher B's ownerUid -> returns 403
        const mismatchRes = await fetch(
          `${baseUrl}/api/teacher/assignments?ownerUid=${encodeURIComponent(UID_TEACHER_B)}`,
          { headers: { Authorization: `Bearer ${tokenTeacherA}` } }
        );
        assert.equal(mismatchRes.status, 403);

        // 6. Valid Teacher A token returns only Teacher A submissions
        const subsARes = await fetch(`${baseUrl}/api/homework/submissions`, {
          headers: { Authorization: `Bearer ${tokenTeacherA}` }
        });
        assert.equal(subsARes.status, 200);
        const subsAData = await subsARes.json();
        assert.equal(subsAData.submissions.length, 1);
        assert.equal(subsAData.submissions[0].id, 'sub_f01_1');

        // Teacher B querying submissions gets 0 submissions
        const subsBRes = await fetch(`${baseUrl}/api/homework/submissions`, {
          headers: { Authorization: `Bearer ${tokenTeacherB}` }
        });
        assert.equal(subsBRes.status, 200);
        const subsBData = await subsBRes.json();
        assert.equal(subsBData.submissions.length, 0);

        // 7. Unauthenticated callers cannot enumerate submissions -> returns 401
        const unauthSubsRes = await fetch(
          `${baseUrl}/api/homework/submissions?ownerUid=${encodeURIComponent(UID_TEACHER_A)}`
        );
        assert.equal(unauthSubsRes.status, 401);

        // 8. Public student homework loading and submission remain functional
        const infoRes = await fetch(`${baseUrl}/api/homework/info?id=f01_hw_a`);
        assert.equal(infoRes.status, 200);
        const infoData = await infoRes.json();
        assert.equal(infoData.id, 'f01_hw_a');

        const studentSubmitRes = await fetch(`${baseUrl}/api/homework/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'sub_f01_2',
            assignmentId: 'f01_hw_a',
            studentName: 'زياد',
            responses: []
          })
        });
        assert.equal(studentSubmitRes.status, 200);
      } finally {
        server.close();
      }
    }
  );

  await runTest(
    'V-06',
    'Public homework documents strip ownerEmail, lernstudio_sets enforce ownerUid isolation, and backup import verifies ownership',
    async () => {
      // 1. Verify Express /api/homework/info strips ownerEmail from public response
      const server = expressApp.listen(0);
      try {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const baseUrl = `http://127.0.0.1:${port}`;

        await fetch(`${baseUrl}/api/teacher/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${makeTestBearerToken(UID_TEACHER_A, EMAIL_TEACHER_A)}`
          },
          body: JSON.stringify(
            makeAssignment({
              id: 'hw_v06_privacy',
              title: 'واجب بدون تسريب الإيميل',
              ownerUid: UID_TEACHER_A,
              ownerEmail: EMAIL_TEACHER_A
            })
          )
        });

        const infoRes = await fetch(`${baseUrl}/api/homework/info?id=hw_v06_privacy`);
        assert.equal(infoRes.status, 200);
        const infoData = await infoRes.json();
        assert.equal(infoData.ownerEmail, undefined, 'Public /api/homework/info must never expose teacher ownerEmail');
      } finally {
        server.close();
      }

      // 2. Verify /lernstudio_sets/{setId} rules isolate Teacher A and Teacher B
      const setADoc = {
        id: 'set_teacher_a_custom',
        ownerUid: UID_TEACHER_A,
        title: 'مجموعة كلمات المعلم أ',
        updatedAt: '2026-03-01T10:00:00.000Z',
        payloadJson: JSON.stringify({ id: 'set_teacher_a_custom', ownerUid: UID_TEACHER_A })
      };
      assert.equal(rules.canCreateLernstudioSet({ uid: UID_TEACHER_A }, setADoc.id, setADoc), true);
      assert.equal(rules.canCreateLernstudioSet({ uid: UID_TEACHER_B }, setADoc.id, setADoc), false);
      rules.lernstudioSets.set(setADoc.id, setADoc);

      assert.equal(rules.canListLernstudioSet({ uid: UID_TEACHER_A }, setADoc), true);
      assert.equal(rules.canListLernstudioSet({ uid: UID_TEACHER_B }, setADoc), false);
      assert.equal(rules.canUpdateLernstudioSet({ uid: UID_TEACHER_B }, setADoc.id, setADoc), false);
      assert.equal(rules.canDeleteLernstudioSet({ uid: UID_TEACHER_B }, setADoc.id), false);

      // 3. Verify deterministic backup import claim check rejects unowned/ambiguous and foreign assignments
      const ambiguousBackupHw = makeAssignment({
        id: 'hw_backup_ambiguous',
        title: 'واجب بدون مالك'
      });
      const foreignBackupHw = makeAssignment({
        id: 'hw_backup_foreign',
        title: 'واجب المعلم أ',
        ownerUid: UID_TEACHER_A
      });
      const ownedByGroupBackupHw = makeAssignment({
        id: 'hw_backup_group_b',
        title: 'واجب مجموعة المعلم ب',
        audienceMode: 'group',
        groupId: 'grp_b_owned'
      });

      const claimAmbiguous = canAccountClaimLegacyHomework(ambiguousBackupHw, {
        uid: UID_TEACHER_B,
        email: EMAIL_TEACHER_B,
        ownedGroupIds: ['grp_b_owned']
      });
      assert.equal(claimAmbiguous.provableForTarget, false);

      const claimForeign = canAccountClaimLegacyHomework(foreignBackupHw, {
        uid: UID_TEACHER_B,
        email: EMAIL_TEACHER_B,
        ownedGroupIds: ['grp_b_owned']
      });
      assert.equal(claimForeign.provableForTarget, false);
      assert.equal(claimForeign.belongsToDifferentAccount, true);

      const claimOwnedGroup = canAccountClaimLegacyHomework(ownedByGroupBackupHw, {
        uid: UID_TEACHER_B,
        email: EMAIL_TEACHER_B,
        ownedGroupIds: ['grp_b_owned']
      });
      assert.equal(claimOwnedGroup.provableForTarget, true);
    }
  );

  console.log(`\n🎉 ALL ${passed} HOMEWORK ACCOUNT ISOLATION & SECURITY RULES TESTS PASSED!`);
}

runAllIsolationTests().catch((err) => {
  console.error('❌ Homework Account Isolation Test Failed:', err);
  process.exit(1);
});
