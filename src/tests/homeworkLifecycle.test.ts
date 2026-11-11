import assert from 'node:assert/strict';
import {
  InMemoryAdminFirestore,
  setAdminFirestoreOverrideForTesting,
  resetAdminFirestoreForTesting,
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
      title: 'Lifecycle test',
      createdAt: new Date().toISOString(),
      isActive: true,
      status: 'active',
      shareToken: 'test-share-token',
      setSnapshot: { id: 'set_1', items: [{ id: 'word_1', german: 'Haus' }] }
    }, 'teacher_A');

    const loaded = await getAuthoritativeAssignment(assignment.id);
    assert.equal(loaded?.ownerUid, 'teacher_A');
    assert.equal(loaded?.shareToken, 'test-share-token');
    assert.equal(loaded?.setSnapshot?.items?.[0]?.german, 'Haus');

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

    const tombstone = await getAuthoritativeAssignment(assignment.id);
    assert.equal(tombstone?.deleted, true);
    assert.equal(tombstone?.isActive, false);

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
      }, tombstone),
      (error: any) => error?.status === 403
    );
    process.stdout.write('✓ Homework lifecycle, owner isolation, canonical payload and deletion tombstone tests passed\\n');
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
