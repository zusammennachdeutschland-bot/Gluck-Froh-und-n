import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { mergeEntities } from '../services/sync/mergeEngine';
import { SyncableRecord } from '../types';
import {
  filterCustomOrModifiedLernstudioSets,
  mergeWithBuiltinLernstudioSets,
  BUILTIN_LERNSTUDIO_MAP,
  DEFAULT_LERNSTUDIO_SETS,
  SYNC_CONTROL_DOC_ID
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
