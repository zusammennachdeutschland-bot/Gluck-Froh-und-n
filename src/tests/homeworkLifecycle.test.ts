import assert from 'node:assert/strict';
import {
  InMemoryAdminFirestore,
  setAdminFirestoreOverrideForTesting,
  resetAdminFirestoreForTesting,
  invalidateServerAssignmentCache,
  getServerAssignmentCacheEntryForTesting,
  saveAuthoritativeAssignment,
  getAuthoritativeAssignment,
  softDeleteAuthoritativeAssignment,
  saveAuthoritativeSubmission,
  getAuthoritativeSubmission,
  listAuthoritativeSubmissions
} from '../server/firebaseAdmin';

async function run(): Promise<void> {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const memoryDb = new InMemoryAdminFirestore();
  setAdminFirestoreOverrideForTesting(memoryDb);
  try {
    const assignment = await saveAuthoritativeAssignment({
      id: 'hw_lifecycle_test_01',
      shortId: 'LifeCy1',
      title: 'Lifecycle test',
      createdAt: new Date().toISOString(),
      isActive: true,
      status: 'active',
      shareToken: 'test-share-token',
      setSnapshot: { id: 'set_1', items: [{ id: 'word_1', german: 'Haus' }] }
    }, 'teacher_A');

    // Cache populated on creation; simulate cold instance to test cold-start read + warm cache hits
    invalidateServerAssignmentCache();
    memoryDb.resetReadCounts();

    const loaded1 = await getAuthoritativeAssignment(assignment.id);
    assert.equal(loaded1?.ownerUid, 'teacher_A');
    assert.equal(loaded1?.shareToken, 'test-share-token');
    assert.equal(loaded1?.setSnapshot?.items?.[0]?.german, 'Haus');
    assert.equal(memoryDb.getReadCount('homework_assignments', assignment.id), 1);

    // Subsequent repeated lookups hit process-local cache with 0 additional Firestore reads
    const loaded2 = await getAuthoritativeAssignment(assignment.id);
    const loaded3 = await getAuthoritativeAssignment(assignment.id);
    assert.equal(loaded2?.title, 'Lifecycle test');
    assert.equal(loaded3?.title, 'Lifecycle test');
    assert.equal(
      memoryDb.getReadCount('homework_assignments', assignment.id),
      1,
      'Repeated getAuthoritativeAssignment calls within TTL must not re-read Firestore'
    );

    // Mutating returned object must never corrupt cached entry
    loaded2.title = 'Mutated by caller';
    const loadedAfterCallerMutation = await getAuthoritativeAssignment(assignment.id);
    assert.equal(loadedAfterCallerMutation?.title, 'Lifecycle test');

    // Editing assignment updates cache immediately without stale reads
    await saveAuthoritativeAssignment({
      ...assignment,
      title: 'Lifecycle test updated'
    }, 'teacher_A');
    const loadedAfterEdit = await getAuthoritativeAssignment(assignment.id);
    assert.equal(loadedAfterEdit?.title, 'Lifecycle test updated');

    // Deactivating assignment invalidates cache and never caches inactive assignments
    await saveAuthoritativeAssignment({
      ...assignment,
      title: 'Lifecycle test updated',
      isActive: false,
      status: 'closed'
    }, 'teacher_A');
    assert.equal(getServerAssignmentCacheEntryForTesting(assignment.id), null);

    // Re-activate assignment for remaining lifecycle tests
    await saveAuthoritativeAssignment({
      ...assignment,
      title: 'Lifecycle test',
      isActive: true,
      status: 'active'
    }, 'teacher_A');
    assert.notEqual(getServerAssignmentCacheEntryForTesting(assignment.id), null);

    // Missing lookups are never cached
    const missing = await getAuthoritativeAssignment('hw_non_existent_999');
    assert.equal(missing, null);
    assert.equal(getServerAssignmentCacheEntryForTesting('hw_non_existent_999'), null);

    await assert.rejects(
      () => saveAuthoritativeAssignment({ ...assignment, title: 'Cross-account overwrite' }, 'teacher_B'),
      (error: any) => error?.status === 403
    );

    const submission = await saveAuthoritativeSubmission({
      id: 'sub_lifecycle_test_01',
      assignmentId: assignment.id,
      studentName: 'Student A',
      status: 'completed',
      completedAt: new Date().toISOString(),
      score: 1,
      accuracyPercent: 100,
      attemptSecret: 'attempt-secret',
      responses: [{ questionId: 'q1', answer: 'Haus', isCorrect: true }]
    }, assignment);
    assert.equal(submission.submission.ownerUid, 'teacher_A');

    const loadedSubmission = await getAuthoritativeSubmission('sub_lifecycle_test_01');
    assert.equal(loadedSubmission?.ownerUid, 'teacher_A');
    assert.equal(loadedSubmission?.responses?.length, 1);
    assert.equal((await listAuthoritativeSubmissions('teacher_A', assignment.id)).length, 1);

    await assert.rejects(
      () => softDeleteAuthoritativeAssignment(assignment.id, 'teacher_B'),
      (error: any) => error?.status === 403
    );

    const deleted = await softDeleteAuthoritativeAssignment(assignment.id, 'teacher_A');
    assert.equal(deleted.deleted, true);
    assert.equal(deleted.isActive, false);
    assert.deepEqual(deleted.revokedShortIds, ['LifeCy1']);
    assert.equal(getServerAssignmentCacheEntryForTesting(assignment.id), null);

    // Canonical delete removes assignment doc while preserving historical submissions
    const afterDeleteDoc = await getAuthoritativeAssignment(assignment.id);
    assert.equal(afterDeleteDoc, null);
    assert.equal((await listAuthoritativeSubmissions('teacher_A', assignment.id)).length, 1);

    await assert.rejects(
      () => saveAuthoritativeAssignment({ ...assignment, isActive: true }, 'teacher_A'),
      (error: any) => error?.status === 410
    );

    await assert.rejects(
      () => saveAuthoritativeSubmission({
        id: 'sub_after_delete',
        assignmentId: assignment.id,
        studentName: 'Student B',
        status: 'completed',
        completedAt: new Date().toISOString()
      }, null),
      (error: any) => error?.status === 403 || error?.status === 404
    );
    process.stdout.write('✓ Homework lifecycle, assignment cache, owner isolation, canonical deletion, and preserved historical submissions tests passed\n');
  } finally {
    resetAdminFirestoreForTesting();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

