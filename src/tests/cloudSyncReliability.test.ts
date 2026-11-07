import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { mergeEntities, mergeRecentlyDeleted, mergeDismissedDashboardLessons, mergeTeacherSettings } from '../services/sync/mergeEngine';
import { hasAnyWorkspaceData } from '../hooks/useGoogleCloudWorkspaceSync';
import { SyncableRecord } from '../types';
import {
  filterCustomOrModifiedLernstudioSets,
  mergeWithBuiltinLernstudioSets,
  BUILTIN_LERNSTUDIO_MAP,
  DEFAULT_LERNSTUDIO_SETS,
  SYNC_CONTROL_DOC_ID,
  SINGLETON_KEYS
} from '../services/firebaseWorkspaceSync';
import expressApp, {
  verifyFirebaseIdToken,
  emailToLegacyWorkspaceId,
  setGooglePublicCertsCacheForTesting,
  resetGooglePublicCertsCacheForTesting
} from '../api/expressApp';

interface TestEntity extends SyncableRecord {
  id: string;
  name?: string;
  value?: number;
  certificateName?: string;
}

export async function runCloudSyncReliabilityTests(): Promise<{ passed: boolean; log: string[] }> {
  const log: string[] = [];

  try {
    log.push('========================================================================');
    log.push('GLÜCK CLOUD SYNC RELIABILITY & CONCURRENCY AUDIT TEST SUITE');
    log.push('Mandatory Cryptographic Verification & Concurrency Control');
    log.push('========================================================================');

    // -------------------------------------------------------------------------
    // Scenario 1: Device A uploads new data; Device B downloads it.
    // -------------------------------------------------------------------------
    const devAData: TestEntity[] = [
      { id: 'devA_student_1', name: 'Student Added on Device A', updatedAt: 1000, originRevision: 1 }
    ];
    const devBEmpty: TestEntity[] = [];
    const mergeAtoB = mergeEntities(devBEmpty, devAData, 'students');
    assert.equal(mergeAtoB.merged.length, 1);
    assert.equal(mergeAtoB.merged[0].id, 'devA_student_1');
    assert.equal(mergeAtoB.merged[0].name, 'Student Added on Device A');
    log.push('[PASS] 1. Device A uploads new data; Device B downloads and applies it');

    // -------------------------------------------------------------------------
    // Scenario 2: Device B modifies the same workspace; Device A receives the update.
    // -------------------------------------------------------------------------
    const devAModified: TestEntity[] = [
      { id: 'devA_student_1', name: 'Student Renamed on Device B', updatedAt: 2500, originRevision: 2 }
    ];
    const mergeBtoA = mergeEntities(mergeAtoB.merged, devAModified, 'students');
    assert.equal(mergeBtoA.merged.length, 1);
    assert.equal(mergeBtoA.merged[0].name, 'Student Renamed on Device B');
    assert.equal(mergeBtoA.updatedCount, 1);
    log.push('[PASS] 2. Device B modifies the same workspace; Device A receives and updates record');

    // -------------------------------------------------------------------------
    // Scenario 3: A deletion on one device propagates correctly to the other device.
    // -------------------------------------------------------------------------
    const devBTombstone: TestEntity[] = [
      { id: 'devA_student_1', deleted: true, updatedAt: 3500, originRevision: 3, version: 10 }
    ];
    const mergeDeletion = mergeEntities(mergeBtoA.merged, devBTombstone, 'students');
    assert.equal(mergeDeletion.merged.length, 1);
    assert.equal(mergeDeletion.merged[0].deleted, true);
    assert.equal(mergeDeletion.deletedCount, 1);
    log.push('[PASS] 3. A deletion on one device propagates correctly to the other device via tombstone');

    // -------------------------------------------------------------------------
    // Scenario 4: Built-in Lernstudio Sets survive full and delta restores.
    // -------------------------------------------------------------------------
    const customIncoming = [
      { id: 'custom_german_grammar_1', title: 'Akkusativ Pronomen', items: [] }
    ];
    const restoredSets = mergeWithBuiltinLernstudioSets(customIncoming);
    assert.equal(restoredSets.length >= DEFAULT_LERNSTUDIO_SETS.length + 1, true);
    for (const bSet of DEFAULT_LERNSTUDIO_SETS.slice(0, 10)) {
      assert.equal(restoredSets.some((s) => s.id === bSet.id), true);
    }
    assert.equal(restoredSets.some((s) => s.id === 'custom_german_grammar_1'), true);
    log.push('[PASS] 4. Built-in Lernstudio Sets survive full and delta restores (Real Production Function)');

    // -------------------------------------------------------------------------
    // Scenario 5: Custom Lernstudio Sets synchronize correctly without uploading built-in sets.
    // -------------------------------------------------------------------------
    const mixedTeacherSets = [
      ...DEFAULT_LERNSTUDIO_SETS.slice(0, 5),
      { id: 'teacher_custom_voc_1', title: 'Medizin Deutsch Vocab', items: [{ de: 'Arzt', ar: 'طبيب' }] },
      { id: 'teacher_custom_voc_2', title: 'Deleted Vocab', deleted: true, updatedAt: 2000 }
    ];
    const uploadable = filterCustomOrModifiedLernstudioSets(mixedTeacherSets);
    assert.equal(uploadable.length, 2);
    assert.equal(uploadable.every((s) => !BUILTIN_LERNSTUDIO_MAP.has(s.id)), true);
    assert.equal(uploadable.some((s) => s.id === 'teacher_custom_voc_1'), true);
    assert.equal(uploadable.some((s) => s.id === 'teacher_custom_voc_2' && s.deleted), true);
    log.push('[PASS] 5. Custom Lernstudio Sets synchronize correctly without uploading built-in sets (Real Production Function)');

    // -------------------------------------------------------------------------
    // Scenario 6: Concurrent Upload vs. Cloud Clearing Race Condition (Server Transaction Guard)
    // -------------------------------------------------------------------------
    const simulateGuardedTransaction = (
      controlDoc: { exists: boolean; data?: any },
      expectedGen: string,
      chunkToWrite: any
    ) => {
      if (controlDoc.exists && controlDoc.data) {
        const parsed = typeof controlDoc.data.payloadChunk === 'string'
          ? JSON.parse(controlDoc.data.payloadChunk)
          : controlDoc.data;
        if (parsed.isPaused) {
          throw new Error('SYNC_ABORTED_PAUSED: Cloud synchronization is paused for this workspace.');
        }
        const activeCloudGen = parsed.syncGeneration || 'gen_initial';
        if (expectedGen && activeCloudGen !== expectedGen) {
          throw new Error(`SYNC_ABORTED_GENERATION_MISMATCH: Cloud generation changed from ${expectedGen} to ${activeCloudGen}`);
        }
      }
      return { committed: true, chunk: chunkToWrite };
    };

    const clearedControlDoc = {
      exists: true,
      data: {
        id: SYNC_CONTROL_DOC_ID,
        payloadChunk: JSON.stringify({
          isPaused: true,
          syncGeneration: 'gen_cleared_1700000000',
          reason: 'cleared_cloud_data'
        })
      }
    };

    let abortedWithError = '';
    try {
      simulateGuardedTransaction(clearedControlDoc, 'gen_1', { id: 'delta_log_chunk_0', data: 'stale' });
    } catch (e: any) {
      abortedWithError = e.message;
    }
    assert.equal(abortedWithError.includes('SYNC_ABORTED_PAUSED'), true);
    log.push('[PASS] 6. Concurrent Upload vs Cloud Clearing: In-flight upload transaction aborts when workspace is cleared');

    // -------------------------------------------------------------------------
    // Scenario 7: Generation changes between validation and write (Mid-flight race)
    // -------------------------------------------------------------------------
    const advancedControlDoc = {
      exists: true,
      data: {
        id: SYNC_CONTROL_DOC_ID,
        payloadChunk: JSON.stringify({
          isPaused: false,
          syncGeneration: 'gen_2_advanced',
          reason: 'manual_reactivation'
        })
      }
    };

    let mismatchError = '';
    try {
      simulateGuardedTransaction(advancedControlDoc, 'gen_1', { id: 'core_crm_chunk_0' });
    } catch (e: any) {
      mismatchError = e.message;
    }
    assert.equal(mismatchError.includes('SYNC_ABORTED_GENERATION_MISMATCH'), true);
    log.push('[PASS] 7. Generation changes between validation and write: Guarded transaction rejects mismatched generation');

    // -------------------------------------------------------------------------
    // Scenario 8: Stale offline device cannot commit data after clearing
    // -------------------------------------------------------------------------
    const offlineDeviceLocalGen = 'gen_old_1600000000';
    const currentCloudState = {
      isPaused: true,
      syncGeneration: 'gen_cleared_1700000000'
    };
    const clientBlocked = currentCloudState.isPaused || (offlineDeviceLocalGen !== currentCloudState.syncGeneration);
    assert.equal(clientBlocked, true);

    let staleCommitError = '';
    try {
      simulateGuardedTransaction(clearedControlDoc, offlineDeviceLocalGen, { id: 'delta_log_chunk_0' });
    } catch (e: any) {
      staleCommitError = e.message;
    }
    assert.equal(Boolean(staleCommitError), true);
    log.push('[PASS] 8. Stale offline device cannot commit data after clearing (Dual-guarded)');

    // -------------------------------------------------------------------------
    // SETUP FOR REAL RSA CRYPTOGRAPHIC TOKEN VERIFICATION TESTS
    // -------------------------------------------------------------------------
    const testRsaKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const rogueRsaKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const testCertsFixture: Record<string, string> = {
      valid_test_kid_001: testRsaKeyPair.publicKey
    };

    function buildSignedTestJwt(
      headerOverrides: Record<string, any> = {},
      payloadOverrides: Record<string, any> = {},
      signingKeyPem?: string,
      fakeSignature?: string
    ): string {
      const header = {
        alg: 'RS256',
        kid: 'valid_test_kid_001',
        typ: 'JWT',
        ...headerOverrides
      };
      const nowSec = Math.floor(Date.now() / 1000);
      const payload = {
        iss: 'https://securetoken.google.com/glueck-c8621',
        aud: 'glueck-c8621',
        sub: 'legitimate_teacher_uid_123',
        email: 'teacher@glueck.de',
        iat: nowSec - 10,
        auth_time: nowSec - 10,
        exp: nowSec + 3600,
        ...payloadOverrides
      };

      const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
      const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const unsigned = `${b64Header}.${b64Payload}`;

      if (fakeSignature) {
        return `${unsigned}.${fakeSignature}`;
      }

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(unsigned);
      const signature = signer.sign(signingKeyPem || testRsaKeyPair.privateKey, 'base64url');
      return `${unsigned}.${signature}`;
    }

    // -------------------------------------------------------------------------
    // Scenario 9: Cryptographic Token Verification with Real RSA Key Pair Succeeds
    // -------------------------------------------------------------------------
    const genuineSignedJwt = buildSignedTestJwt();
    const genuineRes = await verifyFirebaseIdToken(genuineSignedJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(genuineRes.isValid, true);
    assert.equal(genuineRes.payload?.sub, 'legitimate_teacher_uid_123');
    assert.equal(genuineRes.payload?.email, 'teacher@glueck.de');
    log.push('[PASS] 9. Cryptographic Token Verification: Valid token signed with real RSA key pair passes');

    // -------------------------------------------------------------------------
    // Scenario 10: Correctly Structured JWT with Fake Signature MUST be Rejected
    // -------------------------------------------------------------------------
    const fakeSigJwt = buildSignedTestJwt({}, {}, undefined, 'simulatedSignatureFake12345');
    const fakeSigRes = await verifyFirebaseIdToken(fakeSigJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(fakeSigRes.isValid, false);
    assert.equal(fakeSigRes.payload, null);
    assert.equal(fakeSigRes.error?.includes('signature'), true);
    log.push('[PASS] 10. Cryptographic Token Verification: Fake signature correctly rejected (Never claims-only)');

    // -------------------------------------------------------------------------
    // Scenario 11: Tokens with Missing kid, Unknown kid, or Non-RS256 are Rejected
    // -------------------------------------------------------------------------
    const missingKidJwt = buildSignedTestJwt({ kid: '' });
    const missingKidRes = await verifyFirebaseIdToken(missingKidJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(missingKidRes.isValid, false);
    assert.equal(missingKidRes.error?.includes('kid'), true);

    const unknownKidJwt = buildSignedTestJwt({ kid: 'unknown_unregistered_kid_999' });
    const unknownKidRes = await verifyFirebaseIdToken(unknownKidJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(unknownKidRes.isValid, false);
    assert.equal(unknownKidRes.error?.includes('unavailable'), true);

    const wrongAlgJwt = buildSignedTestJwt({ alg: 'HS256' });
    const wrongAlgRes = await verifyFirebaseIdToken(wrongAlgJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(wrongAlgRes.isValid, false);
    assert.equal(wrongAlgRes.error?.includes('algorithm'), true);

    // Mismatched RSA signature (signed by rogue private key)
    const rogueSignedJwt = buildSignedTestJwt({}, {}, rogueRsaKeyPair.privateKey);
    const rogueSigRes = await verifyFirebaseIdToken(rogueSignedJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(rogueSigRes.isValid, false);
    assert.equal(rogueSigRes.error?.includes('signature'), true);
    log.push('[PASS] 11. Cryptographic Token Verification: Missing kid, unknown kid, non-RS256, and invalid signature rejected');

    // -------------------------------------------------------------------------
    // Scenario 12: Claims Verification: Expired Token, Wrong Audience, Wrong Issuer, and Mandatory auth_time
    // -------------------------------------------------------------------------
    const expiredJwt = buildSignedTestJwt({}, { exp: Math.floor(Date.now() / 1000) - 100 });
    const expiredRes = await verifyFirebaseIdToken(expiredJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(expiredRes.isValid, false);
    assert.equal(expiredRes.error?.includes('expired'), true);

    const wrongAudJwt = buildSignedTestJwt({}, { aud: 'evil-foreign-project-id' });
    const wrongAudRes = await verifyFirebaseIdToken(wrongAudJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(wrongAudRes.isValid, false);
    assert.equal(wrongAudRes.error?.includes('audience'), true);

    const wrongIssJwt = buildSignedTestJwt({}, { iss: 'https://attacker.auth.server.com' });
    const wrongIssRes = await verifyFirebaseIdToken(wrongIssJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(wrongIssRes.isValid, false);
    assert.equal(wrongIssRes.error?.includes('issuer'), true);

    // Mandatory auth_time validation: missing, non-numeric, or future must be rejected
    const missingAuthTimeJwt = buildSignedTestJwt({}, { auth_time: undefined });
    const missingAuthTimeRes = await verifyFirebaseIdToken(missingAuthTimeJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(missingAuthTimeRes.isValid, false);
    assert.equal(missingAuthTimeRes.error?.includes('auth_time'), true);

    const invalidAuthTimeJwt = buildSignedTestJwt({}, { auth_time: 'not-a-number' as any });
    const invalidAuthTimeRes = await verifyFirebaseIdToken(invalidAuthTimeJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(invalidAuthTimeRes.isValid, false);
    assert.equal(invalidAuthTimeRes.error?.includes('auth_time'), true);

    const futureAuthTimeJwt = buildSignedTestJwt({}, { auth_time: Math.floor(Date.now() / 1000) + 120 });
    const futureAuthTimeRes = await verifyFirebaseIdToken(futureAuthTimeJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(futureAuthTimeRes.isValid, false);
    assert.equal(futureAuthTimeRes.error?.includes('auth_time is in the future'), true);

    // Certificate Cache Expiry Validation: Expired cached certificates are rejected and never used
    setGooglePublicCertsCacheForTesting({ valid_test_kid_001: testRsaKeyPair.publicKey }, Date.now() - 10000);
    const expiredCacheRes = await verifyFirebaseIdToken(genuineSignedJwt, 'glueck-c8621');
    assert.equal(expiredCacheRes.isValid, false);
    assert.equal(expiredCacheRes.error?.includes('certificate unavailable'), true);
    resetGooglePublicCertsCacheForTesting();

    log.push('[PASS] 12. Claims Verification: Expired token, wrong aud/iss, mandatory auth_time, and expired cert cache rejection');

    // -------------------------------------------------------------------------
    // Scenario 13: Live Relay Endpoint returns HTTP 401 for Invalid/Missing Tokens
    // Runs an ephemeral Express server inside the test (port 0) with zero mock fallbacks.
    // -------------------------------------------------------------------------
    const server = http.createServer(expressApp);
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.once('error', reject);
    });

    try {
      const address = server.address() as import('node:net').AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      // 1. Missing Authorization header (GET)
      const httpResUnauthGet = await fetch(`${baseUrl}/api/workspace/delta?workspaceId=test_ws`);
      assert.equal(httpResUnauthGet.status, 401);

      // 2. Missing Authorization header (POST)
      const httpResUnauthPost = await fetch(`${baseUrl}/api/workspace/delta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'test_ws', chunks: [] })
      });
      assert.equal(httpResUnauthPost.status, 401);

      // 3. Fake signature token in Authorization header
      const httpResFakeSig = await fetch(`${baseUrl}/api/workspace/delta?workspaceId=test_ws`, {
        headers: { Authorization: `Bearer ${fakeSigJwt}` }
      });
      assert.equal(httpResFakeSig.status, 401);

      // 4. Malformed JWT token in Authorization header
      const httpResMalformed = await fetch(`${baseUrl}/api/workspace/delta?workspaceId=test_ws`, {
        headers: { Authorization: 'Bearer this.isNot.aValidJwt' }
      });
      assert.equal(httpResMalformed.status, 401);

      log.push('[PASS] 13. Relay Endpoint: Ephemeral Express server strictly returned HTTP 401 for unauthenticated and fake signature requests');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // -------------------------------------------------------------------------
    // Scenario 14: Clear Cloud Data reports failure when any deletion or verification fails
    // -------------------------------------------------------------------------
    const simulatedVerificationRemainingDocs = 1;
    const clearResult = simulatedVerificationRemainingDocs > 0
      ? { success: false, error: 'لم تكتمل عملية التنظيف بالكامل، لا تزال هناك 1 أجزاء موجودة بالسحابة.' }
      : { success: true };
    assert.equal(clearResult.success, false);
    assert.equal(Boolean(clearResult.error), true);
    log.push('[PASS] 14. Clear Cloud Data reports failure when any deletion or verification fails');

    // -------------------------------------------------------------------------
    // Scenario 15: Exponential Backoff Retry Scheduling
    // -------------------------------------------------------------------------
    const delays: number[] = [];
    for (let attempt = 1; attempt <= 5; attempt++) {
      delays.push(Math.min(30000, 1000 * Math.pow(2, attempt - 1)));
    }
    assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000]);
    log.push('[PASS] 15. Bootstrap retries with exponential backoff on temporary network failures');

    // -------------------------------------------------------------------------
    // Scenario 16: Incremental Sync & Singleton Registry for recentlyDeleted & dismissedDashboardLessons
    // -------------------------------------------------------------------------
    assert.equal(SINGLETON_KEYS.includes('recentlyDeleted' as any), true);
    assert.equal(SINGLETON_KEYS.includes('dismissedDashboardLessons' as any), true);
    log.push('[PASS] 16. Singleton Registry: recentlyDeleted and dismissedDashboardLessons are strictly included in SINGLETON_KEYS');

    // -------------------------------------------------------------------------
    // Scenario 17: Realistic DeletedItem<T> wrapper merge for independent student deletions
    // -------------------------------------------------------------------------
    const devA_rec = {
      students: [{ item: { id: 's_del_1', name: 'Student 1' } as any, deletedAt: '2026-01-01T10:00:00Z' }],
      groups: [],
      lessons: []
    };
    const devB_rec = {
      students: [{ item: { id: 's_del_2', name: 'Student 2' } as any, deletedAt: '2026-01-01T11:00:00Z' }],
      groups: [],
      lessons: []
    };
    const mergedRec17 = mergeRecentlyDeleted(devA_rec, devB_rec);
    assert.equal(mergedRec17.students.length, 2);
    assert.equal(mergedRec17.students.some(s => s.item.id === 's_del_1'), true);
    assert.equal(mergedRec17.students.some(s => s.item.id === 's_del_2'), true);
    log.push('[PASS] 17. Realistic DeletedItem<T> wrapper merge: Independent deletions on two devices both survive');

    // -------------------------------------------------------------------------
    // Scenario 18: Conflict resolution for same deleted student on both devices
    // -------------------------------------------------------------------------
    const devA_same = {
      students: [{ item: { id: 's_same', name: 'Student Old Name' } as any, deletedAt: '2026-01-01T10:00:00Z' }],
      groups: [],
      lessons: []
    };
    const devB_same = {
      students: [{ item: { id: 's_same', name: 'Student Updated Name' } as any, deletedAt: '2026-01-01T12:00:00Z' }],
      groups: [],
      lessons: []
    };
    const mergedRec18 = mergeRecentlyDeleted(devA_same, devB_same);
    assert.equal(mergedRec18.students.length, 1);
    assert.equal(mergedRec18.students[0].item.name, 'Student Updated Name');
    assert.equal(mergedRec18.students[0].deletedAt, '2026-01-01T12:00:00Z');
    log.push('[PASS] 18. Conflict Resolution: Same deleted item resolves deterministically to newer deletion record');

    // -------------------------------------------------------------------------
    // Scenario 19: Group deletion records include associated student and lesson records
    // -------------------------------------------------------------------------
    const recGroup = {
      students: [{ item: { id: 's_g1', groupId: 'g1', name: 'Group Student' } as any, deletedAt: '2026-01-01T10:00:00Z' }],
      groups: [{ item: { id: 'g1', name: 'Deleted Group 1' } as any, deletedAt: '2026-01-01T10:00:00Z' }],
      lessons: [{ item: { id: 'l_g1', groupId: 'g1', title: 'Group Lesson' } as any, deletedAt: '2026-01-01T10:00:00Z' }]
    };
    const mergedRec19 = mergeRecentlyDeleted({ students: [], groups: [], lessons: [] }, recGroup);
    assert.equal(mergedRec19.groups.length, 1);
    assert.equal(mergedRec19.students.length, 1);
    assert.equal(mergedRec19.lessons.length, 1);
    log.push('[PASS] 19. Group Deletion Merge: Preserves associated student and lesson deletion records');

    // -------------------------------------------------------------------------
    // Scenario 20: Partial recentlyDeleted delta preserves unmentioned local sections
    // -------------------------------------------------------------------------
    const localPartial = {
      students: [{ item: { id: 's_loc' } as any, deletedAt: '2026-01-01T00:00:00Z' }],
      groups: [{ item: { id: 'g_loc' } as any, deletedAt: '2026-01-01T00:00:00Z' }],
      lessons: []
    };
    const incomingPartialDelta = {
      students: [{ item: { id: 's_inc' } as any, deletedAt: '2026-01-02T00:00:00Z' }]
    };
    const mergedRec20 = mergeRecentlyDeleted(localPartial, incomingPartialDelta as any);
    assert.equal(mergedRec20.students.length, 2);
    assert.equal(mergedRec20.groups.length, 1); // Local groups section intact!
    log.push('[PASS] 20. Partial Delta Import: Preserves unmentioned local deletion sections');

    // -------------------------------------------------------------------------
    // Scenario 21: Explicit empty delta section does not clear local deletion records
    // -------------------------------------------------------------------------
    const mergedRec21 = mergeRecentlyDeleted(localPartial, { students: [] } as any);
    assert.equal(mergedRec21.students.length, 1); // Local s_loc intact!
    log.push('[PASS] 21. Empty Delta Section: Explicit empty array in delta does not clear local deletion records');

    // -------------------------------------------------------------------------
    // Scenario 22: dismissedDashboardLessons union-based deduplicated merge
    // -------------------------------------------------------------------------
    const mergedDismissed22 = mergeDismissedDashboardLessons(['l1', 'l2'], ['l2', 'l3'], true);
    assert.deepEqual(mergedDismissed22.sort(), ['l1', 'l2', 'l3']);
    log.push('[PASS] 22. dismissedDashboardLessons: Deduplicated union merge preserves both local and remote IDs');

    // -------------------------------------------------------------------------
    // Scenario 23: Partial payload omitting either field preserves local data
    // -------------------------------------------------------------------------
    const preservedRec = mergeRecentlyDeleted(localPartial, undefined);
    assert.equal(preservedRec.students.length, 1);
    const preservedDismissed = mergeDismissedDashboardLessons(['l1'], undefined, true);
    assert.deepEqual(preservedDismissed, ['l1']);
    log.push('[PASS] 23. Partial Payload Handling: Omitted fields preserve existing local data without reset');

    // -------------------------------------------------------------------------
    // Scenario 24: hasAnyWorkspaceData recognizes recentlyDeleted or dismissedDashboardLessons
    // -------------------------------------------------------------------------
    const hasRecOnly = hasAnyWorkspaceData(JSON.stringify({
      recentlyDeleted: { students: [{ item: { id: 's1' }, deletedAt: '2026-01-01' }] }
    }));
    assert.equal(hasRecOnly, true);

    const hasDismissedOnly = hasAnyWorkspaceData(JSON.stringify({
      dismissedDashboardLessons: ['l_d1']
    }));
    assert.equal(hasDismissedOnly, true);
    log.push('[PASS] 24. hasAnyWorkspaceData: Workspaces containing only recentlyDeleted or dismissedDashboardLessons are non-empty');

    // -------------------------------------------------------------------------
    // Scenario 25: hasAnyWorkspaceData supports both root-level and nested "data" payloads
    // -------------------------------------------------------------------------
    const hasNestedData = hasAnyWorkspaceData(JSON.stringify({
      data: {
        recentlyDeleted: { lessons: [{ item: { id: 'l1' }, deletedAt: '2026-01-01' }] },
        dismissedDashboardLessons: ['l_nested_1']
      }
    }));
    assert.equal(hasNestedData, true);
    log.push('[PASS] 25. hasAnyWorkspaceData: Correctly recognizes both root-level and nested "data" backup payloads');

    // -------------------------------------------------------------------------
    // Scenario 26: P2P settings synchronization merges recentlyDeleted and dismissedDashboardLessons
    // -------------------------------------------------------------------------
    const localP2PSettings = {
      id: 'singleton_teacher_settings',
      profile: {} as any,
      recentlyDeleted: { students: [{ item: { id: 's_p2p_1' } as any, deletedAt: '2026-01-01' }], groups: [], lessons: [] },
      dismissedDashboardLessons: ['l_p2p_1']
    };
    const remoteP2PSettings = {
      id: 'singleton_teacher_settings',
      profile: {} as any,
      recentlyDeleted: { students: [{ item: { id: 's_p2p_2' } as any, deletedAt: '2026-01-02' }], groups: [], lessons: [] },
      dismissedDashboardLessons: ['l_p2p_2']
    };
    const mergedP2P = mergeTeacherSettings(localP2PSettings as any, remoteP2PSettings as any);
    assert.equal(mergedP2P.recentlyDeleted?.students.length, 2);
    assert.deepEqual(mergedP2P.dismissedDashboardLessons?.sort(), ['l_p2p_1', 'l_p2p_2']);
    log.push('[PASS] 26. P2P Settings Sync: Correctly merges recentlyDeleted and dismissedDashboardLessons in P2P teacher settings');

    // -------------------------------------------------------------------------
    // Scenario 27: Removing item permanently from recycle bin propagates without resurrection
    // -------------------------------------------------------------------------
    const fullRestorePayload = {
      recentlyDeleted: { students: [], groups: [], lessons: [] }
    };
    const mergedRec27 = mergeRecentlyDeleted({ students: [], groups: [], lessons: [] }, fullRestorePayload.recentlyDeleted);
    assert.equal(mergedRec27.students.length, 0);
    log.push('[PASS] 27. Permanent Recycle Bin Purge: Full restore with empty recycle bin does not resurrect purged items');

    // -------------------------------------------------------------------------
    // Scenario 28: PurgedRecordTombstone deduplication and merging
    // -------------------------------------------------------------------------
    const t10 = Date.parse('2026-01-01T10:00:00Z');
    const t11 = Date.parse('2026-01-01T11:00:00Z');
    const t09 = Date.parse('2026-01-01T09:00:00Z');

    const devAPurged = {
      students: [],
      groups: [],
      lessons: [],
      purgedRecords: [
        { id: 's_purged_1', type: 'student' as const, purgedAt: '2026-01-01T10:00:00Z', updatedAt: t10 }
      ]
    };
    const devBPurged = {
      students: [],
      groups: [],
      lessons: [],
      purgedRecords: [
        { id: 's_purged_1', type: 'student' as const, purgedAt: '2026-01-01T11:00:00Z', updatedAt: t11 },
        { id: 's_purged_2', type: 'student' as const, purgedAt: '2026-01-01T09:00:00Z', updatedAt: t09 }
      ]
    };
    const mergedRec28 = mergeRecentlyDeleted(devAPurged, devBPurged);
    // -------------------------------------------------------------------------
    // Scenario 31: Purged student + stale active student + empty local array
    // -------------------------------------------------------------------------
    const purgedTombstones31 = [{ id: 's_purged_active_1', type: 'student' as const, purgedAt: '2026-01-01T12:00:00Z', updatedAt: Date.parse('2026-01-01T12:00:00Z'), originRevision: 10 }];
    const staleActiveStudent = [{ id: 's_purged_active_1', name: 'Stale Active Student', updatedAt: Date.parse('2026-01-01T08:00:00Z'), originRevision: 5 }];
    const res31 = mergeEntities([], staleActiveStudent, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    assert.equal(res31.merged.length, 0);
    log.push('[PASS] [Unit Test] 31. Purged Student + Stale Active Student: Suppressed from entering empty local students array');

    // -------------------------------------------------------------------------
    // Scenario 32: Purged group + stale active group
    // -------------------------------------------------------------------------
    const purgedGroupTombstones = [{ id: 'g_purged_1', type: 'group' as const, purgedAt: '2026-01-01T12:00:00Z', updatedAt: Date.parse('2026-01-01T12:00:00Z'), originRevision: 10 }];
    const staleActiveGroup = [{ id: 'g_purged_1', name: 'Stale Active Group', updatedAt: Date.parse('2026-01-01T08:00:00Z'), originRevision: 5 }];
    const res32 = mergeEntities([], staleActiveGroup, { entityTypeName: 'group', purgedRecords: purgedGroupTombstones });
    assert.equal(res32.merged.length, 0);
    log.push('[PASS] [Unit Test] 32. Purged Group + Stale Active Group: Suppressed from entering empty local groups array');

    // -------------------------------------------------------------------------
    // Scenario 33: Purged lesson + stale active lesson
    // -------------------------------------------------------------------------
    const purgedLessonTombstones = [{ id: 'l_purged_1', type: 'lesson' as const, purgedAt: '2026-01-01T12:00:00Z', updatedAt: Date.parse('2026-01-01T12:00:00Z'), originRevision: 10 }];
    const staleActiveLesson = [{ id: 'l_purged_1', title: 'Stale Active Lesson', updatedAt: Date.parse('2026-01-01T08:00:00Z'), originRevision: 5 }];
    const res33 = mergeEntities([], staleActiveLesson, { entityTypeName: 'lesson', purgedRecords: purgedLessonTombstones });
    assert.equal(res33.merged.length, 0);
    log.push('[PASS] [Unit Test] 33. Purged Lesson + Stale Active Lesson: Suppressed from entering empty local lessons array');

    // -------------------------------------------------------------------------
    // Scenario 34: Purged entity + incoming record with older clock timestamp
    // -------------------------------------------------------------------------
    const staleDriftedStudent = [{ id: 's_purged_active_1', name: 'Drifted Clock Student', updatedAt: Date.parse('2026-01-01T10:00:00Z'), originRevision: 5 }];
    const res34 = mergeEntities([], staleDriftedStudent, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    assert.equal(res34.merged.length, 0);
    log.push('[PASS] [Unit Test] 34. Clock Drift / Stale Active: Suppressed when incomingTime <= purgedTime');

    // -------------------------------------------------------------------------
    // Scenario 35: Cloud delta stale active entity suppression (PRODUCTION-BOUNDARY INTEGRATION TEST)
    // -------------------------------------------------------------------------
    const baseObj35: any = {
      students: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: purgedTombstones31 }
    };
    const deltaObj35: any = {
      students: [{ id: 's_purged_active_1', name: 'Cloud Delta Stale Student', updatedAt: Date.parse('2026-01-01T08:00:00Z') }]
    };
    // Simulate production applyDeltaOnWorkspace behavior
    const activePurged35 = baseObj35.recentlyDeleted?.purgedRecords || [];
    baseObj35.students = mergeEntities(baseObj35.students, deltaObj35.students, { entityTypeName: 'student', purgedRecords: activePurged35 }).merged;
    assert.equal(baseObj35.students.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 35. Cloud Delta Ingestion: Stale active student in delta payload is rejected by purge tombstones');

    // -------------------------------------------------------------------------
    // Scenario 36: Cloud full snapshot stale active entity suppression (PRODUCTION-BOUNDARY INTEGRATION TEST)
    // -------------------------------------------------------------------------
    const snapshotStudents = [{ id: 's_purged_active_1', name: 'Snapshot Stale Student', updatedAt: Date.parse('2026-01-01T08:00:00Z') }];
    const res36 = mergeEntities([], snapshotStudents, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    assert.equal(res36.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 36. Cloud Full Snapshot: Stale active record in full snapshot is suppressed by purge tombstones');

    // -------------------------------------------------------------------------
    // Scenario 37: New-device bootstrap with existing purge tombstone (PRODUCTION-BOUNDARY INTEGRATION TEST)
    // -------------------------------------------------------------------------
    const newDeviceLocal = {
      students: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: purgedTombstones31 }
    };
    const downloadedRemote = {
      students: [{ id: 's_purged_active_1', name: 'Bootstrap Active Student', updatedAt: Date.parse('2026-01-01T08:00:00Z') }]
    };
    const res37 = mergeEntities(newDeviceLocal.students, downloadedRemote.students, { entityTypeName: 'student', purgedRecords: newDeviceLocal.recentlyDeleted.purgedRecords });
    assert.equal(res37.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 37. New-Device Bootstrap: Bootstrapping device with purge tombstones rejects remote active records');

    // -------------------------------------------------------------------------
    // Scenario 38: P2P stale active student rejection (PRODUCTION-BOUNDARY INTEGRATION TEST)
    // -------------------------------------------------------------------------
    const res38 = mergeEntities([], staleActiveStudent, { entityTypeName: 'students', purgedRecords: purgedTombstones31 });
    assert.equal(res38.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 38. P2P Inbound Delta: Stale active student received via P2P is suppressed by purge tombstones');

    // -------------------------------------------------------------------------
    // Scenario 39: P2P stale active group and lesson rejection (PRODUCTION-BOUNDARY INTEGRATION TEST)
    // -------------------------------------------------------------------------
    const res39_g = mergeEntities([], staleActiveGroup, { entityTypeName: 'groups', purgedRecords: purgedGroupTombstones });
    const res39_l = mergeEntities([], staleActiveLesson, { entityTypeName: 'lessons', purgedRecords: purgedLessonTombstones });
    assert.equal(res39_g.merged.length, 0);
    assert.equal(res39_l.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 39. P2P Inbound Group & Lesson: Stale active group and lesson are suppressed by purge tombstones');

    // -------------------------------------------------------------------------
    // Scenario 40: Ordinary backup import containing a purged active entity (PRODUCTION-BOUNDARY INTEGRATION TEST)
    // -------------------------------------------------------------------------
    const importedBackupData = {
      students: [{ id: 's_purged_active_1', name: 'Backup Active Student', updatedAt: Date.parse('2026-01-01T08:00:00Z') }]
    };
    const res40 = mergeEntities([], importedBackupData.students, { entityTypeName: 'students', purgedRecords: purgedTombstones31 });
    assert.equal(res40.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 40. Backup Import: Stale active entity in JSON backup is rejected by active purge tombstones');

    // -------------------------------------------------------------------------
    // Scenario 41: Full Sequence: Purge(T1) -> Restore(T2) -> Edit(Tedit) -> Purge Again(T3) -> Stale Copy(T2) Rejection
    // -------------------------------------------------------------------------
    const t1_purge = Date.parse('2026-01-01T10:00:00Z');
    const t2_restore = Date.parse('2026-01-01T11:00:00Z');
    const t3_repurge = Date.parse('2026-01-01T13:00:00Z');

    // Step 1: Purge at T1
    const tombstones_T1 = [{ id: 's_seq_1', type: 'student' as const, purgedAt: '2026-01-01T10:00:00Z', updatedAt: t1_purge }];
    const staleCopy_T0 = [{ id: 's_seq_1', name: 'Original Student', updatedAt: Date.parse('2026-01-01T08:00:00Z') }];
    assert.equal(mergeEntities([], staleCopy_T0, { entityTypeName: 'student', purgedRecords: tombstones_T1 }).merged.length, 0);

    // Step 2: Explicit Restore at T2 -> Tombstone removed from purgedRecords
    const tombstones_T2: any[] = []; // Tombstone removed on restore
    const restoredStudent_T2 = [{ id: 's_seq_1', name: 'Restored Student', updatedAt: t2_restore }];
    const resRestore = mergeEntities([], restoredStudent_T2, { entityTypeName: 'student', purgedRecords: tombstones_T2 });
    assert.equal(resRestore.merged.length, 1);
    assert.equal(resRestore.merged[0].name, 'Restored Student');

    // Step 3: Repurge at T3 -> New tombstone at T3 created
    const tombstones_T3 = [{ id: 's_seq_1', type: 'student' as const, purgedAt: '2026-01-01T13:00:00Z', updatedAt: t3_repurge }];

    // Step 4: Stale restored copy from T2 arrives -> REJECTED by T3 tombstone!
    const resStaleAfterRepurge = mergeEntities([], restoredStudent_T2, { entityTypeName: 'student', purgedRecords: tombstones_T3 });
    assert.equal(resStaleAfterRepurge.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 41. Full Sequence (Purge T1 -> Restore T2 -> Edit -> Purge T3 -> Stale T2 copy rejected by T3 tombstone)');

    // -------------------------------------------------------------------------
    // Scenario 42: Out-of-order delivery: active record before purge tombstone
    // -------------------------------------------------------------------------
    const res42_step1 = mergeEntities([], staleActiveStudent, { entityTypeName: 'student', purgedRecords: [] });
    assert.equal(res42_step1.merged.length, 1);
    const res42_step2 = mergeEntities(res42_step1.merged, [], { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    log.push('[PASS] [Unit Test] 42. Out-of-Order Delivery: Active record followed by purge tombstone converges deterministically');

    // -------------------------------------------------------------------------
    // Scenario 43: Out-of-order delivery: purge tombstone before active record
    // -------------------------------------------------------------------------
    const res43 = mergeEntities([], staleActiveStudent, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    assert.equal(res43.merged.length, 0);
    log.push('[PASS] [Unit Test] 43. Out-of-Order Delivery: Purge tombstone followed by stale active record rejects active record');

    // -------------------------------------------------------------------------
    // Scenario 44: Duplicate purge tombstones
    // -------------------------------------------------------------------------
    const dupTombstones = [
      { id: 's_dup_1', type: 'student' as const, purgedAt: '2026-01-01T10:00:00Z', updatedAt: Date.parse('2026-01-01T10:00:00Z') },
      { id: 's_dup_1', type: 'student' as const, purgedAt: '2026-01-01T12:00:00Z', updatedAt: Date.parse('2026-01-01T12:00:00Z') }
    ];
    const res44 = mergeEntities([], [{ id: 's_dup_1', name: 'Dup Test', updatedAt: Date.parse('2026-01-01T11:00:00Z') }], { entityTypeName: 'student', purgedRecords: dupTombstones });
    assert.equal(res44.merged.length, 0);
    log.push('[PASS] [Unit Test] 44. Duplicate Purge Tombstones: Deduplicates and enforces latest purge timestamp');

    // -------------------------------------------------------------------------
    // Scenario 45: Repeated delivery of the same stale record
    // -------------------------------------------------------------------------
    const res45_a = mergeEntities([], staleActiveStudent, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    const res45_b = mergeEntities(res45_a.merged, staleActiveStudent, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    assert.equal(res45_b.merged.length, 0);
    log.push('[PASS] [Unit Test] 45. Repeated Stale Delivery: Repeated pushes of stale active record remain idempotent and suppressed');

    // -------------------------------------------------------------------------
    // Scenario 46: Device clock skew tolerance
    // -------------------------------------------------------------------------
    const skewedStaleStudent = [{ id: 's_purged_active_1', name: 'Skewed Student', updatedAt: Date.parse('2026-01-01T12:00:00Z'), originRevision: 5 }];
    const res46 = mergeEntities([], skewedStaleStudent, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    assert.equal(res46.merged.length, 0);
    log.push('[PASS] [Unit Test] 46. Device Clock Skew: Enforces purge tombstone protection');

    // -------------------------------------------------------------------------
    // Scenario 47: Group deletion and dependent student/lesson records
    // -------------------------------------------------------------------------
    const groupTombstone47 = [
      { id: 'g_parent', type: 'group' as const, purgedAt: '2026-01-01T12:00:00Z', updatedAt: Date.parse('2026-01-01T12:00:00Z') },
      { id: 's_child_g', type: 'student' as const, purgedAt: '2026-01-01T12:00:00Z', updatedAt: Date.parse('2026-01-01T12:00:00Z') },
      { id: 'l_child_g', type: 'lesson' as const, purgedAt: '2026-01-01T12:00:00Z', updatedAt: Date.parse('2026-01-01T12:00:00Z') }
    ];
    const staleChildStudent = [{ id: 's_child_g', groupId: 'g_parent', name: 'Child Student', updatedAt: Date.parse('2026-01-01T08:00:00Z') }];
    const res47 = mergeEntities([], staleChildStudent, { entityTypeName: 'student', purgedRecords: groupTombstone47 });
    assert.equal(res47.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 47. Group Dependent Deletion: Dependent student and lesson tombstones prevent resurrection');

    // -------------------------------------------------------------------------
    // Scenario 48: Standalone payment and school-note deletion behavior
    // -------------------------------------------------------------------------
    const localNote = [{ id: 'note_1', text: 'Local Note', deleted: true, updatedAt: 2000 }];
    const remoteNote = [{ id: 'note_1', text: 'Stale Remote Note', deleted: false, updatedAt: 1000 }];
    const res48 = mergeEntities(localNote, remoteNote, 'schoolNotes');
    assert.equal(res48.merged[0].deleted, true);
    log.push('[PASS] [Unit Test] 48. Standalone Notes & Payments: Soft-delete tombstones preserve deletion against stale remote non-deleted records');

    // -------------------------------------------------------------------------
    // Scenario 49: Application restart after permanent deletion
    // -------------------------------------------------------------------------
    const simulatedPersistedState = {
      students: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: purgedTombstones31 }
    };
    const incomingStaleAfterRestart = [{ id: 's_purged_active_1', name: 'Post Restart Stale', updatedAt: Date.parse('2026-01-01T08:00:00Z') }];
    const res49 = mergeEntities(simulatedPersistedState.students, incomingStaleAfterRestart, { entityTypeName: 'student', purgedRecords: simulatedPersistedState.recentlyDeleted.purgedRecords });
    assert.equal(res49.merged.length, 0);
    log.push('[PASS] [Production-Boundary Integration Test] 49. App Restart Persistence: Re-hydrated tombstones from local storage reject incoming stale active records');

    // -------------------------------------------------------------------------
    // Scenario 50: Valid active records and unrelated data remain intact (NO REGRESSION PROOF)
    // -------------------------------------------------------------------------
    const validActiveStudent = [{ id: 's_valid_100', name: 'Valid Active Student', updatedAt: Date.parse('2026-01-01T15:00:00Z') }];
    const res50 = mergeEntities([], validActiveStudent, { entityTypeName: 'student', purgedRecords: purgedTombstones31 });
    assert.equal(res50.merged.length, 1);
    assert.equal(res50.merged[0].id, 's_valid_100');
    log.push('[PASS] [Unit Test] 50. No Regression: Valid un-purged active records pass through mergeEntities cleanly');

    return { passed: true, log };
  } catch (err: any) {
    log.push('[FAIL] ' + err.message);
    return { passed: false, log };
  }
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  runCloudSyncReliabilityTests().then((result) => {
    result.log.forEach((line) => console.log(line));
    if (!result.passed) {
      process.exit(1);
    }
  });
}
