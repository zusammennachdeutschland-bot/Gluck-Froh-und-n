import assert from 'node:assert/strict';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  syncAndFetchTeacherAssignments,
  applyCloudAssignmentsSnapshot,
  getLocalAssignments,
  getLocalSubmissions,
  saveLocalAssignment,
  saveLocalSubmission,
  deleteLocalAssignment,
  markAssignmentDeletedLocally,
  markShortIdRevokedLocally,
  isAssignmentDeletedLocally,
  isAssignmentManuallyDeletedLocally,
  isShortIdRevokedLocally,
  __setHomeworkSyncTransportForTests,
  __setHomeworkAuthUserForTests
} from '../shared/homeworkStorageSync';
import { resolveLinkedOnlineHomeworkForLesson } from '../utils/lessonHomeworkLinkUtils';
import { computeWorkspaceDelta, seedWatermarksFromData } from '../services/firebaseWorkspaceSync';
import { mergePurgedTombstones } from '../services/sync/mergeEngine';

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
}

const memStorage = new MemoryStorage();
const dispatchedEvents: { type: string; detail: any }[] = [];

(globalThis as any).localStorage = memStorage;
(globalThis as any).window = {
  localStorage: memStorage,
  location: { origin: 'https://glueck.example.com' },
  dispatchEvent: (evt: any) => {
    dispatchedEvents.push({ type: evt?.type, detail: evt?.detail });
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};
if (typeof CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, opts?: any) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
}

function makeAssignment(id: string, ownerUid: string, shortId: string): HomeworkAssignment {
  return {
    id,
    ownerUid,
    shortId,
    title: 'Adam, Saif, Jahia und Farida — Dialog Zahlen bis 100',
    createdAt: '2026-11-13T08:00:00.000Z',
    isActive: true,
    status: 'active',
    cloudSynced: true,
    audienceMode: 'open',
    setSnapshot: {
      id: 'set_numbers_100',
      nameAr: 'الأرقام حتى 100',
      nameDe: 'Zahlen bis 100',
      level: 'A1',
      items: [{ id: 1, de: 'zwanzig', ar: 'عشرون', cat: 'Zahlen' }]
    },
    allowedGameModes: ['classic_quiz'],
    questionCount: 10,
    maxAttempts: 3
  } as any;
}

async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('HOMEWORK SYNC RESILIENCE & SELF-HEALING REGRESSION SUITE');
  console.log('================================================================================');

  const ownerUid = 'teacher_sync_resilience_1';
  __setHomeworkAuthUserForTests({ uid: ownerUid, email: 'teacher@glueck.de' });

  // --------------------------------------------------------------------------
  // TEST 1: Omission from list query when single-doc verification returns active -> DO NOT DELETE
  // --------------------------------------------------------------------------
  memStorage.clear();
  dispatchedEvents.length = 0;

  const hw1 = makeAssignment('hw_active_pending_skip', ownerUid, 'AbC1234');
  saveLocalAssignment(hw1, false);

  __setHomeworkSyncTransportForTests({
    // Simulate getDocs(q) omitting hw1 because of hasPendingWrites or incomplete index
    fetchAllAssignments: async () => [],
    // Direct single-doc check confirms hw1 still exists in Firestore
    fetchAssignment: async (id: string) => (id === hw1.id ? hw1 : null),
    fetchAllSubmissions: async () => [],
    fetchSubmissionsForAssignment: async () => [],
    saveAssignment: async () => true,
    saveSubmission: async () => true
  });

  await syncAndFetchTeacherAssignments();
  assert.equal(
    getLocalAssignments(ownerUid).some((a) => a.id === hw1.id),
    true,
    'Active assignment confirmed via single-doc check must NOT be deleted when omitted from list query'
  );
  assert.equal(isShortIdRevokedLocally('AbC1234'), false, 'ShortId must remain un-revoked');
  assert.equal(isAssignmentDeletedLocally(hw1.id, ownerUid), false, 'Assignment must not be marked deleted');
  console.log('✅ [RESILIENCE-01] Preserves active assignment when omitted from list query if single-doc confirms existence');

  // --------------------------------------------------------------------------
  // TEST 2: Omission from list query when single-doc verification throws (uncertain/offline) -> DO NOT DELETE
  // --------------------------------------------------------------------------
  __setHomeworkSyncTransportForTests({
    fetchAllAssignments: async () => [],
    fetchAssignment: async () => {
      throw new Error('Transient network timeout');
    },
    fetchAllSubmissions: async () => [],
    fetchSubmissionsForAssignment: async () => []
  });

  await syncAndFetchTeacherAssignments();
  assert.equal(
    getLocalAssignments(ownerUid).some((a) => a.id === hw1.id),
    true,
    'Assignment must NOT be deleted when server presence check is uncertain/throws'
  );
  assert.equal(isShortIdRevokedLocally('AbC1234'), false, 'ShortId must not be revoked on uncertain check');
  console.log('✅ [RESILIENCE-02] Preserves assignment when single-doc verification errors/uncertain');

  // --------------------------------------------------------------------------
  // TEST 3: False local deletion & revoked shortId self-heals when cloud has active doc (without manual delete)
  // --------------------------------------------------------------------------
  memStorage.clear();
  dispatchedEvents.length = 0;

  const hwHeal = makeAssignment('hw_false_blacklisted', ownerUid, 'HeAl777');
  const subHeal: HomeworkSubmission = {
    id: 'sub_adam_1',
    assignmentId: hwHeal.id,
    ownerUid,
    studentName: 'أدم خالد',
    status: 'in_progress',
    score: 37,
    correctAnswersCount: 37,
    totalQuestions: 63,
    accuracyPercent: 59,
    startedAt: '2026-11-13T10:05:00.000Z',
    updatedAt: '2026-11-13T10:11:00.000Z',
    cloudSynced: true
  } as any;

  // Simulate device in the broken state from the screenshots:
  // locally blacklisted + shortId revoked, even though NOT manually deleted!
  markAssignmentDeletedLocally(hwHeal.id, ownerUid);
  markShortIdRevokedLocally('HeAl777');

  assert.equal(isAssignmentDeletedLocally(hwHeal.id, ownerUid), true);
  assert.equal(isShortIdRevokedLocally('HeAl777'), true);
  assert.equal(isAssignmentManuallyDeletedLocally(hwHeal.id, ownerUid), false);

  __setHomeworkSyncTransportForTests({
    fetchAllAssignments: async () => [hwHeal],
    fetchAssignment: async () => hwHeal,
    fetchAllSubmissions: async () => [subHeal],
    fetchSubmissionsForAssignment: async () => [subHeal]
  });

  await syncAndFetchTeacherAssignments();

  assert.equal(
    isAssignmentDeletedLocally(hwHeal.id, ownerUid),
    false,
    'False local deletion flag must self-heal when cloud returns active assignment'
  );
  assert.equal(
    isShortIdRevokedLocally('HeAl777'),
    false,
    'False shortId revocation must self-heal when active cloud assignment is present'
  );
  assert.equal(
    getLocalAssignments(ownerUid).some((a) => a.id === hwHeal.id),
    true,
    'Restored assignment must be visible in getLocalAssignments'
  );
  assert.equal(
    getLocalSubmissions(ownerUid).some((s) => s.id === 'sub_adam_1'),
    true,
    'Student live submission must be recovered along with the self-healed assignment'
  );
  assert.equal(
    dispatchedEvents.some((e) => e.type === 'gluck-homework-restored' && e.detail?.assignmentId === hwHeal.id),
    true,
    'Self-healing must dispatch gluck-homework-restored'
  );

  // Also verify lessonHomeworkLinkUtils sees it as active again!
  const linkRes = resolveLinkedOnlineHomeworkForLesson(
    {
      id: 'lesson_1',
      report: {
        onlineHomeworkAssignmentId: hwHeal.id,
        onlineHomeworkShortId: 'HeAl777',
        onlineHomeworkTitle: hwHeal.title
      } as any
    },
    getLocalAssignments(ownerUid),
    { currentOwnerUid: ownerUid }
  );
  assert.equal(linkRes?.status, 'active', 'Lesson report link status must recover to active');
  assert.equal(linkRes?.isValid, true, 'Lesson report link must be valid after self-healing');
  console.log('✅ [RESILIENCE-03] Self-heals falsely blacklisted assignment, revoked shortId, and live submissions');

  // --------------------------------------------------------------------------
  // TEST 4: Explicit manual delete stays permanently deleted (never resurrected by cloud snapshot)
  // --------------------------------------------------------------------------
  dispatchedEvents.length = 0;
  let cloudDeletedCalled = false;
  __setHomeworkSyncTransportForTests({
    fetchAllAssignments: async () => [hwHeal],
    fetchAssignment: async () => hwHeal,
    fetchAllSubmissions: async () => [],
    fetchSubmissionsForAssignment: async () => [],
    deleteAssignment: async () => {
      cloudDeletedCalled = true;
      return true;
    },
    deleteSubmissionsForAssignment: async () => true
  });

  deleteLocalAssignment(hwHeal.id, true);
  assert.equal(cloudDeletedCalled, true, 'Manual delete calls cloud delete');
  assert.equal(isAssignmentManuallyDeletedLocally(hwHeal.id, ownerUid), true, 'Manual delete flag set');
  assert.equal(isShortIdRevokedLocally('HeAl777'), true, 'Manual delete revokes shortId');
  const deleteEvt = dispatchedEvents.find((e) => e.type === 'gluck-homework-deleted');
  assert.equal(deleteEvt?.detail?.userInitiated, true, 'Manual delete marks event userInitiated: true');

  // Even if cloud snapshot still temporarily returns hwHeal (e.g. delayed delete), manual delete stays deleted!
  applyCloudAssignmentsSnapshot([hwHeal], ownerUid, ownerUid);
  assert.equal(
    getLocalAssignments(ownerUid).some((a) => a.id === hwHeal.id),
    false,
    'Manually deleted assignment must NOT be resurrected by cloud snapshot'
  );
  console.log('✅ [RESILIENCE-04] Manual deletion stays permanently deleted & marks userInitiated: true');

  // --------------------------------------------------------------------------
  // TEST 5: Remote confirmed deletion (single-doc returns null) removes local & does NOT mark userInitiated
  // --------------------------------------------------------------------------
  memStorage.clear();
  dispatchedEvents.length = 0;
  const hwRemoteDel = makeAssignment('hw_remote_del', ownerUid, 'RemDe12');
  saveLocalAssignment(hwRemoteDel, false);

  __setHomeworkSyncTransportForTests({
    fetchAllAssignments: async () => [],
    fetchAssignment: async () => null, // Confirmed absent from server
    fetchAllSubmissions: async () => [],
    fetchSubmissionsForAssignment: async () => []
  });

  await syncAndFetchTeacherAssignments();
  assert.equal(
    getLocalAssignments(ownerUid).some((a) => a.id === hwRemoteDel.id),
    false,
    'Assignment confirmed absent from Firestore server must be removed locally'
  );
  const remoteDelEvt = dispatchedEvents.find((e) => e.type === 'gluck-homework-deleted');
  assert.equal(remoteDelEvt?.detail?.userInitiated, false, 'Sync-triggered delete must NOT set userInitiated: true');
  console.log('✅ [RESILIENCE-05] Confirmed server deletion prunes local copy without creating user-initiated purge');

  // --------------------------------------------------------------------------
  // TEST 6: computeWorkspaceDelta NEVER synthesizes { deleted: true, version: 999 } for homework collections
  // --------------------------------------------------------------------------
  memStorage.clear();
  const hwWs = makeAssignment('hw_ws_safe_1', ownerUid, 'WsSafe1');
  const subWs: HomeworkSubmission = {
    id: 'sub_ws_safe_1',
    assignmentId: hwWs.id,
    ownerUid,
    studentName: 'Student A',
    status: 'completed',
    score: 10,
    accuracyPercent: 100
  } as any;

  // Step A: Baseline contains hwWs & subWs
  const baselinePayload = {
    groups: [],
    students: [],
    lessons: [],
    payments: [],
    notifications: [],
    certificates: [],
    todos: [],
    homeworkAssignments: [hwWs],
    homeworkSubmissions: [subWs],
    lernstudioSets: [],
    profile: { name: 'Teacher', schoolSettings: {} }
  } as any;
  seedWatermarksFromData(ownerUid, baselinePayload);

  // Step B: Another call runs when homeworkAssignments / homeworkSubmissions are empty (e.g. unhydrated scope or truncation)
  const step2 = computeWorkspaceDelta(ownerUid, {
    groups: [],
    students: [],
    lessons: [],
    payments: [],
    notifications: [],
    certificates: [],
    todos: [],
    homeworkAssignments: [],
    homeworkSubmissions: [],
    lernstudioSets: [],
    profile: { name: 'Teacher', schoolSettings: {} }
  } as any);

  assert.equal(
    (step2.changedEntities.homeworkAssignments || []).some((x: any) => x?.deleted === true && x?.version === 999),
    false,
    'computeWorkspaceDelta must NEVER synthesize deleted:true version:999 tombstones for homeworkAssignments'
  );
  assert.equal(
    (step2.changedEntities.homeworkSubmissions || []).some((x: any) => x?.deleted === true && x?.version === 999),
    false,
    'computeWorkspaceDelta must NEVER synthesize deleted:true version:999 tombstones for homeworkSubmissions'
  );
  console.log('✅ [RESILIENCE-06] Workspace delta never generates synthetic version-999 tombstones for homework');

  // --------------------------------------------------------------------------
  // TEST 7: mergePurgedTombstones preserves type: 'homeworkAssignments'
  // --------------------------------------------------------------------------
  const mergedTombstones = mergePurgedTombstones([], [
    {
      id: 'hw_tomb_1',
      type: 'homeworkAssignments',
      purgedAt: '2026-11-13T10:00:00.000Z',
      updatedAt: 1700000000000
    }
  ]);
  assert.equal(mergedTombstones[0]?.type, 'homeworkAssignments', 'PurgedRecordTombstone must preserve homeworkAssignments type');
  console.log('✅ [RESILIENCE-07] mergePurgedTombstones preserves homeworkAssignments type');

  __setHomeworkAuthUserForTests(undefined);
  __setHomeworkSyncTransportForTests(null);

  console.log('================================================================================');
  console.log('🎉 ALL HOMEWORK SYNC RESILIENCE TESTS PASSED!');
  console.log('================================================================================');
}

runTests().catch((err) => {
  console.error('Homework sync resilience test failed:', err);
  process.exit(1);
});
