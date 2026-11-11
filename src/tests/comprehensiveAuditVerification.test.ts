import assert from 'node:assert/strict';
import { generateTermVisitPlan, isMatchingClass } from '../services/termVisitPlannerService';
import { mergeEntities } from '../services/sync/mergeEngine';
import { SchoolSettings, VisitRecord, Teacher, SyncableRecord } from '../types';
import {
  syncAndFetchTeacherAssignments,
  getLocalAssignments,
  saveLocalAssignment,
  deleteLocalAssignment,
  __setHomeworkSyncTransportForTests,
  getActiveHomeworkScopeUid,
  __setHomeworkAuthUserForTests,
  UNAUTHENTICATED_HOMEWORK_SCOPE
} from '../shared/homeworkStorageSync';
import { HomeworkAssignment } from '../shared/homeworkTypes';

// Mock localStorage & window for Node environment
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

const mockStorage = new MemoryStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  localStorage: mockStorage,
  location: { origin: 'https://glueck.example.com' },
  dispatchEvent: () => true,
  addEventListener: () => {}
};

interface AuditTestEntity extends SyncableRecord {
  id: string;
  name?: string;
  version?: number;
  deleted?: boolean;
}

export async function runComprehensiveAuditVerificationTests(): Promise<void> {
  console.log('================================================================================');
  console.log('COMPREHENSIVE AUDIT VERIFICATION REGRESSION SUITE');
  console.log('================================================================================');

  // --------------------------------------------------------------------------
  // PART 1: TERM VISIT PLANNER TERM & DATE RECONCILIATION
  // --------------------------------------------------------------------------
  console.log('Testing [AUDIT-01] Term visit reconciliation excludes out-of-range visits and mismatches...');
  const mockTeachers: Teacher[] = [
    { id: 't1', name: 'Herr Mohamed', isActive: true, isHod: false },
    { id: 't2', name: 'Frau Sarah', isActive: true, isHod: false }
  ];
  const mockSchedules = {
    't1': { '0': [{ periodNumber: 1, className: 'Grade 5 - 5A', subjectName: 'German' }] },
    't2': { '0': [{ periodNumber: 2, className: 'Grade 6 - 6A', subjectName: 'German' }] }
  };
  const mockVisits: VisitRecord[] = [
    // 1. Valid visit in Term 1 (2026-09-20)
    {
      id: 'v_valid_term1',
      teacherId: 't1',
      teacherName: 'Herr Mohamed',
      className: 'Grade 5 - 5A',
      term: 'Term 1',
      visitedDate: '2026-09-20',
      periodNumber: '1',
      overallScore: 85
    },
    // 2. Visit from 2024 (old year, outside date range)
    {
      id: 'v_old_year',
      teacherId: 't2',
      teacherName: 'Frau Sarah',
      className: 'Grade 6 - 6A',
      term: 'Term 2 (Old Year)',
      visitedDate: '2024-02-10',
      periodNumber: '2'
    },
    // 3. Visit marked cancelled
    {
      id: 'v_cancelled',
      teacherId: 't1',
      teacherName: 'Herr Mohamed',
      className: 'Grade 5 - 5A',
      term: 'Term 1',
      visitedDate: '2026-09-25',
      periodNumber: '1',
      status: 'cancelled'
    } as any
  ];

  const mockSettings: SchoolSettings = {
    schedule: {},
    teachers: mockTeachers,
    teacherSchedules: mockSchedules as any,
    visitRecords: mockVisits,
    currentTerm: 'Term 1',
    presence: [],
    periodSettings: []
  } as any;

  const plan = generateTermVisitPlan(mockSettings, [], {
    term: 'Term 1',
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    workingDays: ['0', '1']
  });

  const t1Req = plan.requirements.find(r => r.teacherId === 't1');
  const t2Req = plan.requirements.find(r => r.teacherId === 't2');

  assert.equal(t1Req?.completedVisitsCount, 1, 'Valid Term 1 visit within dates must be counted');
  assert.equal(t1Req?.isSatisfied, true, 't1 requirement must be satisfied');
  assert.equal(t2Req?.completedVisitsCount, 0, 'Old year visit (2024) must NOT be counted for 2026 Term 1');
  assert.equal(t2Req?.isSatisfied, false, 't2 requirement must remain unsatisfied');
  assert.equal(plan.summary.completedCount, 1, 'Summary completed count must be 1');
  console.log('✅ [AUDIT-01] Term visit planner strictly isolates dates and terms');

  // --------------------------------------------------------------------------
  // PART 2: MERGE ENGINE DELETION TOMBSTONE PRESERVATION (CLOCK DRIFT RESILIENCE)
  // --------------------------------------------------------------------------
  console.log('Testing [AUDIT-02] Merge engine preserves local tombstone against drifted same-version remote...');
  const localDeleted: AuditTestEntity[] = [
    { id: 'rec_1', name: 'Deleted Item', deleted: true, updatedAt: 5000, version: 2 }
  ];
  const remoteDriftedSameVer: AuditTestEntity[] = [
    { id: 'rec_1', name: 'Deleted Item', deleted: false, updatedAt: 5500, version: 2 }
  ];
  const mergeRes1 = mergeEntities(localDeleted, remoteDriftedSameVer, 'lesson');
  assert.equal(mergeRes1.merged[0].deleted, true, 'Local deletion tombstone must be preserved against same-ver clock drift');
  assert.equal(mergeRes1.conflicts[0].winner, 'local', 'Local must win against same-ver clock drift');

  // Remote with higher version should win
  const remoteHigherVer: AuditTestEntity[] = [
    { id: 'rec_1', name: 'Recreated Item', deleted: false, updatedAt: 5200, version: 3 }
  ];
  const mergeRes2 = mergeEntities(localDeleted, remoteHigherVer, 'lesson');
  assert.equal(mergeRes2.merged[0].deleted, false, 'Higher remote version must override local tombstone');
  assert.equal(mergeRes2.merged[0].name, 'Recreated Item', 'Remote data must be applied on higher version');
  assert.equal(mergeRes2.conflicts[0].winner, 'remote');
  console.log('✅ [AUDIT-02] Merge engine correctly preserves tombstones and respects logical versions');

  // --------------------------------------------------------------------------
  // PART 3: HOMEWORK ZOMBIE RESURRECTION PREVENTION
  // --------------------------------------------------------------------------
  console.log('Testing [AUDIT-03] Remote homework deletion removes local copy without zombie re-upload...');
  const testOwnerUid = 'teacher_audit_owner_1';
  __setHomeworkAuthUserForTests({ uid: testOwnerUid, email: 'teacher@audit.de' });

  // Mock cloud store
  const mockCloudAssignments = new Map<string, HomeworkAssignment>();
  const mockUploadedAssignments = new Map<string, HomeworkAssignment>();

  __setHomeworkSyncTransportForTests({
    fetchAllAssignments: async (uid?: string) => {
      return Array.from(mockCloudAssignments.values()).filter(a => !uid || a.ownerUid === uid);
    },
    saveAssignment: async (hw: HomeworkAssignment) => {
      mockUploadedAssignments.set(hw.id, hw);
      mockCloudAssignments.set(hw.id, hw);
      return true;
    },
    deleteAssignment: async (id: string) => {
      mockCloudAssignments.delete(id);
      return true;
    },
    fetchAllSubmissions: async () => [],
    fetchSubmissionsForAssignment: async () => [],
    saveSubmission: async () => true,
    deleteSubmissionsForAssignment: async () => true
  });

  // Setup: Device has an assignment that was previously synced to cloud (cloudSynced = true)
  const previouslySyncedHw: HomeworkAssignment = {
    id: 'hw_previously_synced',
    ownerUid: testOwnerUid,
    title: 'Test Homework',
    createdAt: new Date().toISOString(),
    isActive: true,
    cloudSynced: true,
    audienceMode: 'open',
    setSnapshot: { id: 's1', title: 'Set 1', exercises: [] } as any,
    allowedGameModes: ['standard'],
    questionCount: 5,
    maxAttempts: 3
  } as any;
  saveLocalAssignment(previouslySyncedHw, false);

  // Now, in cloud, another device deleted it -> mockCloudAssignments is EMPTY
  mockCloudAssignments.clear();
  mockUploadedAssignments.clear();

  // Run sync
  const syncedList = await syncAndFetchTeacherAssignments();

  // Verify: the previously-synced assignment was deleted locally, NOT re-uploaded to cloud!
  assert.equal(
    mockUploadedAssignments.has('hw_previously_synced'),
    false,
    'Must NOT re-upload previously synced assignment that was deleted from cloud'
  );
  const localAfterSync = getLocalAssignments(testOwnerUid);
  assert.equal(
    localAfterSync.some(a => a.id === 'hw_previously_synced'),
    false,
    'Previously synced assignment deleted from cloud must be removed locally'
  );
  console.log('✅ [AUDIT-03] Prevents zombie resurrection of deleted homework assignments');

  // --------------------------------------------------------------------------
  // PART 4: NEW OFFLINE HOMEWORK UPLOAD
  // --------------------------------------------------------------------------
  console.log('Testing [AUDIT-04] Newly created offline assignment (cloudCreatePending: true) is uploaded...');
  const offlineCreatedHw: HomeworkAssignment = {
    id: 'hw_new_offline',
    ownerUid: testOwnerUid,
    title: 'Offline Created Assignment',
    createdAt: new Date().toISOString(),
    isActive: true,
    cloudSynced: false,
    cloudCreatePending: true,
    audienceMode: 'open',
    setSnapshot: { id: 's1', title: 'Set 1', exercises: [] } as any,
    allowedGameModes: ['standard'],
    questionCount: 5,
    maxAttempts: 3
  } as any;
  saveLocalAssignment(offlineCreatedHw, false);

  // Run sync
  await syncAndFetchTeacherAssignments();

  // Verify: the offline-created assignment IS uploaded to cloud!
  assert.equal(
    mockUploadedAssignments.has('hw_new_offline'),
    true,
    'Newly created offline assignment must be uploaded to cloud on sync'
  );
  console.log('✅ [AUDIT-04] Offline created assignments upload seamlessly on sync recovery');

  // Cleanup
  __setHomeworkAuthUserForTests(undefined);
  __setHomeworkSyncTransportForTests(null);

  console.log('================================================================================');
  console.log('🎉 ALL COMPREHENSIVE AUDIT REGRESSION TESTS PASSED!');
  console.log('================================================================================');
}

runComprehensiveAuditVerificationTests().catch((err) => {
  console.error('Audit verification test failed:', err);
  process.exit(1);
});
