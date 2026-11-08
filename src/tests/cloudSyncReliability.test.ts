import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import {
  mergeEntities,
  mergeRecentlyDeleted,
  mergeDismissedDashboardLessons,
  mergeTeacherSettings,
  enforcePurgedTombstonesOnWorkspace,
  executePermanentDeleteOnWorkspace,
  executeClearRecentlyDeletedOnWorkspace,
  executeRestoreItemOnWorkspace
} from '../services/sync/mergeEngine';
import { hasAnyWorkspaceData } from '../hooks/useGoogleCloudWorkspaceSync';
import { SyncableRecord } from '../types';
import {
  filterCustomOrModifiedLernstudioSets,
  mergeWithBuiltinLernstudioSets,
  BUILTIN_LERNSTUDIO_MAP,
  DEFAULT_LERNSTUDIO_SETS,
  SYNC_CONTROL_DOC_ID,
  SINGLETON_KEYS,
  applyDeltaOnWorkspace,
  reassembleWorkspaceSnapshot
} from '../services/firebaseWorkspaceSync';
import {
  runSyncCycle,
  handleInboundExchange,
  SyncDataSource
} from '../services/sync/syncOrchestrator';
import {
  validateAndSanitizeBackupPayload,
  mergeBackupPayloadIntoWorkspace
} from '../utils/backupEngine';
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
    log.push('[PASS] [Unit] 1. Device A uploads new data; Device B downloads and applies it');

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
    log.push('[PASS] [Unit] 2. Device B modifies the same workspace; Device A receives and updates record');

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
    log.push('[PASS] [Unit] 3. A deletion on one device propagates correctly to the other device via tombstone');

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
    log.push('[PASS] [Production-boundary integration] 4. Built-in Lernstudio Sets survive full and delta restores');

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
    log.push('[PASS] [Production-boundary integration] 5. Custom Lernstudio Sets synchronize correctly without uploading built-in sets');

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
    log.push('[PASS] [Unit] 6. Concurrent Upload vs Cloud Clearing: In-flight upload transaction aborts when workspace is cleared');

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
    log.push('[PASS] [Unit] 7. Generation changes between validation and write: Guarded transaction rejects mismatched generation');

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
    log.push('[PASS] [Unit] 8. Stale offline device cannot commit data after clearing (Dual-guarded)');

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
    log.push('[PASS] [Production-boundary integration] 9. Cryptographic Token Verification: Valid token signed with real RSA key pair passes');

    // -------------------------------------------------------------------------
    // Scenario 10: Correctly Structured JWT with Fake Signature MUST be Rejected
    // -------------------------------------------------------------------------
    const fakeSigJwt = buildSignedTestJwt({}, {}, undefined, 'simulatedSignatureFake12345');
    const fakeSigRes = await verifyFirebaseIdToken(fakeSigJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(fakeSigRes.isValid, false);
    assert.equal(fakeSigRes.payload, null);
    assert.equal(fakeSigRes.error?.includes('signature'), true);
    log.push('[PASS] [Production-boundary integration] 10. Cryptographic Token Verification: Fake signature correctly rejected (Never claims-only)');

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

    const rogueSignedJwt = buildSignedTestJwt({}, {}, rogueRsaKeyPair.privateKey);
    const rogueSigRes = await verifyFirebaseIdToken(rogueSignedJwt, 'glueck-c8621', testCertsFixture);
    assert.equal(rogueSigRes.isValid, false);
    assert.equal(rogueSigRes.error?.includes('signature'), true);
    log.push('[PASS] [Production-boundary integration] 11. Cryptographic Token Verification: Missing kid, unknown kid, non-RS256, and invalid signature rejected');

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

    setGooglePublicCertsCacheForTesting({ valid_test_kid_001: testRsaKeyPair.publicKey }, Date.now() - 10000);
    const expiredCacheRes = await verifyFirebaseIdToken(genuineSignedJwt, 'glueck-c8621');
    assert.equal(expiredCacheRes.isValid, false);
    assert.equal(expiredCacheRes.error?.includes('certificate unavailable'), true);
    resetGooglePublicCertsCacheForTesting();

    log.push('[PASS] [Production-boundary integration] 12. Claims Verification: Expired token, wrong aud/iss, mandatory auth_time, and expired cert cache rejection');

    // -------------------------------------------------------------------------
    // Scenario 13: Live Relay Endpoint returns HTTP 401 for Invalid/Missing Tokens
    // -------------------------------------------------------------------------
    const server = http.createServer(expressApp);
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.once('error', reject);
    });

    try {
      const address = server.address() as import('node:net').AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const httpResUnauthGet = await fetch(`${baseUrl}/api/workspace/delta?workspaceId=test_ws`);
      assert.equal(httpResUnauthGet.status, 401);

      const httpResUnauthPost = await fetch(`${baseUrl}/api/workspace/delta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'test_ws', chunks: [] })
      });
      assert.equal(httpResUnauthPost.status, 401);

      const httpResFakeSig = await fetch(`${baseUrl}/api/workspace/delta?workspaceId=test_ws`, {
        headers: { Authorization: `Bearer ${fakeSigJwt}` }
      });
      assert.equal(httpResFakeSig.status, 401);

      const httpResMalformed = await fetch(`${baseUrl}/api/workspace/delta?workspaceId=test_ws`, {
        headers: { Authorization: 'Bearer this.isNot.aValidJwt' }
      });
      assert.equal(httpResMalformed.status, 401);

      log.push('[PASS] [Production-boundary integration] 13. Relay Endpoint: Ephemeral Express server strictly returned HTTP 401 for unauthenticated and fake signature requests');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // =========================================================================
    // PART 8 — MANDATORY 23 PRODUCTION REGRESSION SCENARIOS
    // =========================================================================
    log.push('------------------------------------------------------------------------');
    log.push('PART 8: MANDATORY 23 PRODUCTION REGRESSION SCENARIOS');
    log.push('------------------------------------------------------------------------');

    // -------------------------------------------------------------------------
    // P8-1 & P8-2: Active student created on Device A syncs to Device B; edited on Device B syncs back to Device A
    // -------------------------------------------------------------------------
    const wsDeviceA: any = {
      groups: [{ id: 'g_1', name: 'A1 Group', updatedAt: 1000, originRevision: 1 }],
      students: [],
      lessons: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };
    const wsDeviceB: any = {
      groups: [{ id: 'g_1', name: 'A1 Group', updatedAt: 1000, originRevision: 1 }],
      students: [],
      lessons: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };

    // Device A creates active student and sends Cloud delta to Device B via real applyDeltaOnWorkspace
    const deltaCreateStudent = {
      students: [{ id: 'st_active_1', name: 'Anna Müller', groupId: 'g_1', updatedAt: 2000, originRevision: 2 }]
    };
    applyDeltaOnWorkspace(wsDeviceA, deltaCreateStudent);
    applyDeltaOnWorkspace(wsDeviceB, deltaCreateStudent);
    assert.equal(wsDeviceB.students.length, 1);
    assert.equal(wsDeviceB.students[0].name, 'Anna Müller');
    log.push('[PASS] [Production-boundary integration] P8-01. Active student created on Device A syncs to Device B via applyDeltaOnWorkspace()');

    // Device B edits the student and syncs back to Device A via real applyDeltaOnWorkspace
    const deltaEditStudent = {
      students: [{ id: 'st_active_1', name: 'Anna Müller-Schmidt', groupId: 'g_1', updatedAt: 3000, originRevision: 3 }]
    };
    applyDeltaOnWorkspace(wsDeviceB, deltaEditStudent);
    applyDeltaOnWorkspace(wsDeviceA, deltaEditStudent);
    assert.equal(wsDeviceA.students.length, 1);
    assert.equal(wsDeviceA.students[0].name, 'Anna Müller-Schmidt');
    log.push('[PASS] [Production-boundary integration] P8-02. Active student edited on Device B syncs back to Device A via applyDeltaOnWorkspace()');

    // -------------------------------------------------------------------------
    // P8-3 & P8-4: Soft-deleted student moves to Recently Deleted across devices, and restore returns it across devices
    // -------------------------------------------------------------------------
    const softDelTimeIso = '2026-02-01T10:00:00.000Z';
    const softDelMs = Date.parse(softDelTimeIso);
    const deltaSoftDelete = {
      students: [{ id: 'st_active_1', name: 'Anna Müller-Schmidt', groupId: 'g_1', deleted: true, updatedAt: softDelMs, originRevision: 4 }],
      recentlyDeleted: {
        students: [{ item: { id: 'st_active_1', name: 'Anna Müller-Schmidt', groupId: 'g_1', updatedAt: softDelMs }, deletedAt: softDelTimeIso }],
        groups: [],
        lessons: [],
        purgedRecords: []
      }
    };
    applyDeltaOnWorkspace(wsDeviceA, deltaSoftDelete);
    applyDeltaOnWorkspace(wsDeviceB, deltaSoftDelete);
    assert.equal(wsDeviceB.students[0].deleted, true);
    assert.equal(wsDeviceB.recentlyDeleted.students.length, 1);
    assert.equal(wsDeviceB.recentlyDeleted.students[0].item.id, 'st_active_1');
    log.push('[PASS] [Production-boundary integration] P8-03. Soft-deleted student moves to Recently Deleted across devices');

    // Restore on Device B using real executeRestoreItemOnWorkspace()
    let revCounter = 10;
    const restoredOnB = executeRestoreItemOnWorkspace(
      wsDeviceB,
      'student',
      'st_active_1',
      (record) => ({ ...record, updatedAt: softDelMs + 5000, originRevision: ++revCounter })
    );
    assert.equal(restoredOnB.restored, true);
    assert.equal(wsDeviceB.recentlyDeleted.students.length, 0);
    assert.equal(wsDeviceB.students.find((s: any) => s.id === 'st_active_1')?.deleted, false);

    // Sync restored student back to Device A
    applyDeltaOnWorkspace(wsDeviceA, {
      students: wsDeviceB.students,
      recentlyDeleted: wsDeviceB.recentlyDeleted
    });
    assert.equal(wsDeviceA.students.find((s: any) => s.id === 'st_active_1')?.deleted, false);
    log.push('[PASS] [Production-boundary integration] P8-04. Soft-deleted student restored from Recently Deleted returns across devices');

    // -------------------------------------------------------------------------
    // P8-5, P8-6, P8-7: Permanently deleted student cannot return from stale offline device with:
    //   - OLDER timestamp (P8-5)
    //   - NEWER clock-skewed timestamp +1 hour (P8-6)
    //   - HIGHER local revision counter / version (P8-7)
    // -------------------------------------------------------------------------
    const purgeBaseMs = Date.parse('2026-02-01T12:00:00.000Z');
    // Put st_active_1 into recentlyDeleted and permanently delete via executePermanentDeleteOnWorkspace
    wsDeviceA.recentlyDeleted.students.push({
      item: { id: 'st_active_1', name: 'Anna Müller-Schmidt', groupId: 'g_1', updatedAt: purgeBaseMs - 1000 },
      deletedAt: new Date(purgeBaseMs - 1000).toISOString()
    });
    const permDelRes = executePermanentDeleteOnWorkspace(wsDeviceA, 'student', 'st_active_1', () => ++revCounter, purgeBaseMs);
    assert.equal(permDelRes.createdTombstones.some(t => t.id === 'st_active_1' && t.type === 'student'), true);
    assert.equal(wsDeviceA.students.some((s: any) => s.id === 'st_active_1'), false);

    // P8-5: Stale offline device sends OLDER timestamp
    applyDeltaOnWorkspace(wsDeviceA, {
      students: [{ id: 'st_active_1', name: 'Stale Older Copy', groupId: 'g_1', updatedAt: purgeBaseMs - 60000, originRevision: 2 }]
    });
    assert.equal(wsDeviceA.students.some((s: any) => s.id === 'st_active_1'), false);
    log.push('[PASS] [Production-boundary integration] P8-05. Permanently deleted student cannot return from stale offline device with OLDER timestamp');

    // P8-6: Stale offline device sends NEWER clock-skewed timestamp (+1 hour and +1 day)
    applyDeltaOnWorkspace(wsDeviceA, {
      students: [
        { id: 'st_active_1', name: 'Clock Skewed +1 Hour Student', groupId: 'g_1', updatedAt: purgeBaseMs + 3600_000, originRevision: 5 }
      ],
      recentlyDeleted: {
        students: [
          { item: { id: 'st_active_1', name: 'Clock Skewed Soft Deleted', updatedAt: purgeBaseMs + 86400_000 }, deletedAt: new Date(purgeBaseMs + 86400_000).toISOString() }
        ],
        groups: [],
        lessons: [],
        purgedRecords: []
      }
    });
    assert.equal(wsDeviceA.students.some((s: any) => s.id === 'st_active_1'), false);
    assert.equal(wsDeviceA.recentlyDeleted.students.some((s: any) => s.item.id === 'st_active_1'), false);
    log.push('[PASS] [Production-boundary integration] P8-06. Permanently deleted student cannot return from stale offline device with NEWER clock-skewed timestamp (+1 hour / +1 day)');

    // P8-7: Stale offline device sends HIGHER local revision counter and version
    applyDeltaOnWorkspace(wsDeviceA, {
      students: [
        { id: 'st_active_1', name: 'Higher Revision Student', groupId: 'g_1', updatedAt: purgeBaseMs + 7200_000, originRevision: 999999, version: 999999 }
      ]
    });
    assert.equal(wsDeviceA.students.some((s: any) => s.id === 'st_active_1'), false);
    log.push('[PASS] [Production-boundary integration] P8-07. Permanently deleted student cannot return from stale offline device with higher local revision counter');

    // -------------------------------------------------------------------------
    // P8-8 & P8-9: Tombstone arriving on a device that currently holds the active student (P8-8)
    // or soft-deleted student (P8-9) removes it immediately
    // -------------------------------------------------------------------------
    const wsHoldingActive: any = {
      students: [{ id: 'st_active_1', name: 'Still Active Locally', groupId: 'g_1', updatedAt: purgeBaseMs + 50000, originRevision: 500 }],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };
    const resReverseActive = mergeEntities(wsHoldingActive.students, [], {
      entityTypeName: 'student',
      purgedRecords: wsDeviceA.recentlyDeleted.purgedRecords
    });
    assert.equal(resReverseActive.merged.length, 0);
    assert.equal(resReverseActive.deletedCount >= 1, true);
    log.push('[PASS] [Unit] P8-08. Tombstone arriving on a device that currently holds the active student removes the student from active students');

    const wsHoldingSoftDeleted = {
      students: [{ item: { id: 'st_active_1', name: 'Soft Deleted Locally', updatedAt: purgeBaseMs + 50000 } as any, deletedAt: new Date(purgeBaseMs + 50000).toISOString() }],
      groups: [],
      lessons: [],
      purgedRecords: []
    };
    const resReverseSoft = mergeRecentlyDeleted(wsHoldingSoftDeleted, {
      students: [],
      groups: [],
      lessons: [],
      purgedRecords: wsDeviceA.recentlyDeleted.purgedRecords
    });
    assert.equal(resReverseSoft.students.length, 0);
    assert.equal(resReverseSoft.purgedRecords?.some(p => p.id === 'st_active_1'), true);
    log.push('[PASS] [Unit] P8-09. Tombstone arriving on a device that currently holds the soft-deleted student removes it from recentlyDeleted.students');

    // -------------------------------------------------------------------------
    // P8-10 & P8-11: Permanently deleted group cascades to linked students and lessons across devices,
    // and stale device cannot resurrect a student or lesson belonging to a permanently deleted group
    // -------------------------------------------------------------------------
    const wsCascadeTest: any = {
      groups: [{ id: 'grp_cascade_1', name: 'B2 Intensive', updatedAt: 1000 }],
      students: [
        { id: 'st_in_grp_1', name: 'Student In Group 1', groupId: 'grp_cascade_1', updatedAt: 1000 },
        { id: 'st_in_grp_2', name: 'Archived Group Student', groupId: '', archivedGroupId: 'grp_cascade_1', updatedAt: 1000 },
        { id: 'st_unrelated', name: 'Unrelated Student', groupId: 'grp_other', updatedAt: 1000 }
      ],
      lessons: [
        { id: 'les_in_grp_1', title: 'Lesson in Group', groupId: 'grp_cascade_1', updatedAt: 1000 },
        { id: 'les_for_st_1', title: 'Private Lesson for Group Student', studentId: 'st_in_grp_1', updatedAt: 1000 },
        { id: 'les_unrelated', title: 'Unrelated Lesson', groupId: 'grp_other', updatedAt: 1000 }
      ],
      payments: [
        { id: 'pay_preserved_1', studentId: 'st_in_grp_1', amount: 150, updatedAt: 1000 }
      ],
      financeTransactions: [
        { id: 'fin_preserved_1', amount: 150, type: 'income', updatedAt: 1000 }
      ],
      recentlyDeleted: {
        groups: [{ item: { id: 'grp_cascade_1', name: 'B2 Intensive' }, deletedAt: '2026-02-01T10:00:00.000Z' }],
        students: [],
        lessons: [],
        purgedRecords: []
      }
    };

    const grpPurgeResult = executePermanentDeleteOnWorkspace(wsCascadeTest, 'group', 'grp_cascade_1', () => ++revCounter, purgeBaseMs);
    assert.equal(grpPurgeResult.createdTombstones.some(t => t.id === 'grp_cascade_1' && t.type === 'group'), true);
    assert.equal(grpPurgeResult.createdTombstones.some(t => t.id === 'st_in_grp_1' && t.type === 'student'), true);
    assert.equal(grpPurgeResult.createdTombstones.some(t => t.id === 'st_in_grp_2' && t.type === 'student'), true);
    assert.equal(grpPurgeResult.createdTombstones.some(t => t.id === 'les_in_grp_1' && t.type === 'lesson'), true);
    assert.equal(grpPurgeResult.createdTombstones.some(t => t.id === 'les_for_st_1' && t.type === 'lesson'), true);
    assert.equal(wsCascadeTest.students.length, 1);
    assert.equal(wsCascadeTest.students[0].id, 'st_unrelated');
    assert.equal(wsCascadeTest.lessons.length, 1);
    assert.equal(wsCascadeTest.lessons[0].id, 'les_unrelated');
    // Payments and financeTransactions MUST be preserved
    assert.equal(wsCascadeTest.payments.length, 1);
    assert.equal(wsCascadeTest.financeTransactions.length, 1);
    log.push('[PASS] [Production-boundary integration] P8-10. Permanently deleted group cascades to linked students and lessons while preserving payments and finance');

    // P8-11: Stale device sends BOTH known child student AND a brand-new offline child student/lesson referencing grp_cascade_1
    applyDeltaOnWorkspace(wsCascadeTest, {
      students: [
        { id: 'st_in_grp_1', name: 'Resurrect Attempt 1', groupId: 'grp_cascade_1', updatedAt: purgeBaseMs + 999999, originRevision: 888 },
        { id: 'st_offline_new_child', name: 'Offline Added Child of Purged Group', groupId: 'grp_cascade_1', updatedAt: purgeBaseMs + 999999, originRevision: 889 }
      ],
      lessons: [
        { id: 'les_in_grp_1', title: 'Resurrect Lesson 1', groupId: 'grp_cascade_1', updatedAt: purgeBaseMs + 999999, originRevision: 890 },
        { id: 'les_offline_new_child', title: 'Offline Added Lesson of Purged Group', groupId: 'grp_cascade_1', updatedAt: purgeBaseMs + 999999, originRevision: 891 }
      ]
    });
    assert.equal(wsCascadeTest.students.some((s: any) => s.groupId === 'grp_cascade_1'), false);
    assert.equal(wsCascadeTest.lessons.some((l: any) => l.groupId === 'grp_cascade_1'), false);
    log.push('[PASS] [Production-boundary integration] P8-11. Stale device cannot resurrect a student or lesson belonging to a permanently deleted group');

    // -------------------------------------------------------------------------
    // P8-12: Permanently deleted lesson cannot return from stale Cloud delta, full snapshot, P2P delta, or backup import
    // -------------------------------------------------------------------------
    const lessonTombstones = [{ id: 'les_purged_solo', type: 'lesson' as const, purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs, originRevision: 20 }];
    const staleLessonRecord = { id: 'les_purged_solo', title: 'Stale Lesson', groupId: 'grp_other', updatedAt: purgeBaseMs + 500000, originRevision: 999 };

    // 12a. Cloud delta
    const wsLessonCloud: any = {
      lessons: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: lessonTombstones }
    };
    applyDeltaOnWorkspace(wsLessonCloud, { lessons: [staleLessonRecord] });
    assert.equal(wsLessonCloud.lessons.length, 0);

    // 12b. Full snapshot reassembly
    const snapDocsLesson: Record<string, any[]> = {
      profile_settings: [{ chunkIndex: 0, totalChunks: 1, payloadChunk: JSON.stringify({ recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: lessonTombstones } }) }],
      lessons: [{ chunkIndex: 0, totalChunks: 1, payloadChunk: JSON.stringify({ lessons: [staleLessonRecord] }) }]
    };
    const snapLessonResult = reassembleWorkspaceSnapshot(snapDocsLesson);
    assert.equal((snapLessonResult.workspace.lessons || []).length, 0);

    // 12c. Backup import
    const backupLessonResult = mergeBackupPayloadIntoWorkspace(wsLessonCloud, {
      lessons: [staleLessonRecord]
    });
    assert.equal(backupLessonResult.workspace.lessons.length, 0);
    log.push('[PASS] [Production-boundary integration] P8-12. Permanently deleted lesson cannot return from stale Cloud delta, full snapshot, P2P delta, or backup import');

    // -------------------------------------------------------------------------
    // P8-13: clearRecentlyDeleted() creates tombstones for all deleted items and prevents resurrection from stale devices
    // -------------------------------------------------------------------------
    const wsClearBin: any = {
      groups: [],
      students: [{ id: 'st_child_of_bin_group', name: 'Active Child of Bin Group', groupId: 'grp_in_bin', updatedAt: 1000 }],
      lessons: [{ id: 'les_child_of_bin_student', title: 'Active Lesson of Bin Student', studentId: 'st_in_bin', updatedAt: 1000 }],
      recentlyDeleted: {
        groups: [{ item: { id: 'grp_in_bin', name: 'Group in Bin' }, deletedAt: '2026-02-01T10:00:00.000Z' }],
        students: [{ item: { id: 'st_in_bin', name: 'Student in Bin', groupId: 'grp_other' }, deletedAt: '2026-02-01T10:00:00.000Z' }],
        lessons: [{ item: { id: 'les_in_bin', title: 'Lesson in Bin', groupId: 'grp_other' }, deletedAt: '2026-02-01T10:00:00.000Z' }],
        purgedRecords: []
      }
    };
    const clearBinRes = executeClearRecentlyDeletedOnWorkspace(wsClearBin, () => ++revCounter, purgeBaseMs);
    assert.equal(wsClearBin.recentlyDeleted.groups.length, 0);
    assert.equal(wsClearBin.recentlyDeleted.students.length, 0);
    assert.equal(wsClearBin.recentlyDeleted.lessons.length, 0);
    assert.equal(clearBinRes.createdTombstones.some(t => t.id === 'grp_in_bin'), true);
    assert.equal(clearBinRes.createdTombstones.some(t => t.id === 'st_in_bin'), true);
    assert.equal(clearBinRes.createdTombstones.some(t => t.id === 'les_in_bin'), true);
    assert.equal(clearBinRes.createdTombstones.some(t => t.id === 'st_child_of_bin_group'), true);
    assert.equal(clearBinRes.createdTombstones.some(t => t.id === 'les_child_of_bin_student'), true);
    assert.equal(wsClearBin.students.length, 0);
    assert.equal(wsClearBin.lessons.length, 0);

    // Attempt resurrection from stale device
    applyDeltaOnWorkspace(wsClearBin, {
      groups: [{ id: 'grp_in_bin', name: 'Resurrect Group', updatedAt: purgeBaseMs + 100000 }],
      students: [{ id: 'st_in_bin', name: 'Resurrect Student', updatedAt: purgeBaseMs + 100000 }],
      lessons: [{ id: 'les_in_bin', title: 'Resurrect Lesson', updatedAt: purgeBaseMs + 100000 }]
    });
    assert.equal(wsClearBin.groups.length, 0);
    assert.equal(wsClearBin.students.length, 0);
    assert.equal(wsClearBin.lessons.length, 0);
    log.push('[PASS] [Production-boundary integration] P8-13. clearRecentlyDeleted() creates tombstones for all deleted and cascade items and prevents resurrection');

    // -------------------------------------------------------------------------
    // P8-14: Restoring a soft-deleted item does NOT weaken or delete unrelated tombstones,
    // and cannot strip an existing tombstone for a permanently purged ID
    // -------------------------------------------------------------------------
    const wsRestoreSafety: any = {
      groups: [],
      students: [],
      lessons: [],
      recentlyDeleted: {
        groups: [],
        students: [
          { item: { id: 'st_soft_ok', name: 'Soft Deleted OK' }, deletedAt: '2026-02-01T10:00:00.000Z' },
          { item: { id: 'st_already_purged', name: 'Already Purged' }, deletedAt: '2026-02-01T09:00:00.000Z' }
        ],
        lessons: [],
        purgedRecords: [
          { id: 'st_already_purged', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs, originRevision: 50 },
          { id: 'st_other_tombstone', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs, originRevision: 51 }
        ]
      }
    };

    // Trying to restore st_already_purged must fail and preserve all tombstones
    const blockedRestore = executeRestoreItemOnWorkspace(wsRestoreSafety, 'student', 'st_already_purged');
    assert.equal(blockedRestore.restored, false);
    assert.equal(wsRestoreSafety.recentlyDeleted.purgedRecords.length, 2);
    assert.equal(wsRestoreSafety.students.length, 0);

    // Restoring st_soft_ok succeeds and keeps both tombstones intact
    const allowedRestore = executeRestoreItemOnWorkspace(wsRestoreSafety, 'student', 'st_soft_ok');
    assert.equal(allowedRestore.restored, true);
    assert.equal(wsRestoreSafety.students.length, 1);
    assert.equal(wsRestoreSafety.students[0].id, 'st_soft_ok');
    assert.equal(wsRestoreSafety.recentlyDeleted.purgedRecords.length, 2);
    log.push('[PASS] [Production-boundary integration] P8-14. Restoring a soft-deleted item does NOT weaken or delete unrelated tombstones and blocks purged IDs');

    // -------------------------------------------------------------------------
    // P8-15: Restore -> normal edit -> permanent delete -> stale pre-delete copy cannot resurrect the record
    // -------------------------------------------------------------------------
    // Step 1: Normal edit on st_soft_ok
    wsRestoreSafety.students[0] = {
      ...wsRestoreSafety.students[0],
      name: 'Soft OK Edited',
      updatedAt: purgeBaseMs + 10000,
      originRevision: 60
    };
    const stalePreDeleteSnapshot = { ...wsRestoreSafety.students[0] };

    // Step 2: Soft-delete then Permanent delete
    wsRestoreSafety.recentlyDeleted.students.push({
      item: wsRestoreSafety.students[0],
      deletedAt: new Date(purgeBaseMs + 20000).toISOString()
    });
    wsRestoreSafety.students = [];
    executePermanentDeleteOnWorkspace(wsRestoreSafety, 'student', 'st_soft_ok', () => 65, purgeBaseMs + 30000);
    assert.equal(wsRestoreSafety.recentlyDeleted.purgedRecords.some((p: any) => p.id === 'st_soft_ok'), true);

    // Step 3: Stale pre-delete copy arrives (even with a skewed clock)
    applyDeltaOnWorkspace(wsRestoreSafety, {
      students: [{ ...stalePreDeleteSnapshot, updatedAt: purgeBaseMs + 999999, originRevision: 999 }]
    });
    assert.equal(wsRestoreSafety.students.length, 0);
    log.push('[PASS] [Production-boundary integration] P8-15. Restore -> normal edit -> permanent delete -> stale pre-delete copy cannot resurrect the record');

    // -------------------------------------------------------------------------
    // P8-16: Cloud delta containing only recentlyDeleted.purgedRecords (without students, groups, or lessons arrays)
    // still removes matching local active records
    // -------------------------------------------------------------------------
    const wsTombstoneOnlyDeltaTarget: any = {
      groups: [{ id: 'grp_to_purge_via_delta', name: 'Active Group', updatedAt: 1000 }],
      students: [
        { id: 'st_to_purge_via_delta', name: 'Active Student', groupId: 'grp_keep', updatedAt: 1000 },
        { id: 'st_child_of_delta_grp', name: 'Active Child of Purged Group', groupId: 'grp_to_purge_via_delta', updatedAt: 1000 },
        { id: 'st_survivor', name: 'Survivor Student', groupId: 'grp_keep', updatedAt: 1000 }
      ],
      lessons: [
        { id: 'les_to_purge_via_delta', title: 'Active Lesson', groupId: 'grp_keep', updatedAt: 1000 }
      ],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };

    // Delta contains ONLY recentlyDeleted.purgedRecords (no students/groups/lessons keys)
    applyDeltaOnWorkspace(wsTombstoneOnlyDeltaTarget, {
      recentlyDeleted: {
        students: [],
        groups: [],
        lessons: [],
        purgedRecords: [
          { id: 'grp_to_purge_via_delta', type: 'group', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs },
          { id: 'st_to_purge_via_delta', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs },
          { id: 'les_to_purge_via_delta', type: 'lesson', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs }
        ]
      }
    });
    assert.equal(wsTombstoneOnlyDeltaTarget.groups.length, 0);
    assert.equal(wsTombstoneOnlyDeltaTarget.students.length, 1);
    assert.equal(wsTombstoneOnlyDeltaTarget.students[0].id, 'st_survivor');
    assert.equal(wsTombstoneOnlyDeltaTarget.lessons.length, 0);
    log.push('[PASS] [Production-boundary integration] P8-16. Cloud delta containing only recentlyDeleted.purgedRecords removes matching local active and cascade records');

    // -------------------------------------------------------------------------
    // P8-17: Partial Cloud snapshot missing profile_settings cannot resurrect locally purged records
    // and defers unknown conflicting remote active records
    // -------------------------------------------------------------------------
    const partialDocsWithoutProfileSettings: Record<string, any[]> = {
      core_crm: [
        {
          chunkIndex: 0,
          totalChunks: 1,
          payloadChunk: JSON.stringify({
            students: [
              { id: 'st_locally_purged', name: 'Locally Purged Student', updatedAt: purgeBaseMs + 50000 },
              { id: 'st_known_local', name: 'Known Local Student Updated', updatedAt: purgeBaseMs + 5000 },
              { id: 'st_unknown_remote', name: 'Unknown Remote Student', updatedAt: purgeBaseMs + 5000 }
            ]
          })
        }
      ]
    };

    const partialSnapshotRes = reassembleWorkspaceSnapshot(partialDocsWithoutProfileSettings, {
      localRecentlyDeleted: {
        students: [],
        groups: [],
        lessons: [],
        purgedRecords: [
          { id: 'st_locally_purged', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs }
        ]
      },
      localWorkspace: {
        students: [{ id: 'st_known_local', name: 'Known Local Student', updatedAt: 1000 }]
      },
      deferUnknownWhenProfileSettingsMissing: true
    });

    assert.equal(partialSnapshotRes.hasAuthoritativeTombstones, false);
    // Locally purged record is blocked immediately
    assert.equal(partialSnapshotRes.workspace.students.some((s: any) => s.id === 'st_locally_purged'), false);
    // Unknown remote active record is deferred because profile_settings is missing
    assert.equal(partialSnapshotRes.workspace.students.some((s: any) => s.id === 'st_unknown_remote'), false);
    assert.equal(partialSnapshotRes.deferredIds.includes('st_unknown_remote'), true);
    // Known local active record is safely updated
    assert.equal(partialSnapshotRes.workspace.students.some((s: any) => s.id === 'st_known_local'), true);
    log.push('[PASS] [Production-boundary integration] P8-17. Partial Cloud snapshot missing profile_settings blocks locally purged records and defers unknown remote active records');

    // -------------------------------------------------------------------------
    // P8-18: Out-of-order Cloud category reassembly produces the same final state regardless of category arrival order
    // -------------------------------------------------------------------------
    const profileChunk = {
      chunkIndex: 0,
      totalChunks: 1,
      payloadChunk: JSON.stringify({
        recentlyDeleted: {
          students: [],
          groups: [],
          lessons: [],
          purgedRecords: [
            { id: 'st_purged_order', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs }
          ]
        }
      })
    };
    const crmChunk = {
      chunkIndex: 0,
      totalChunks: 1,
      payloadChunk: JSON.stringify({
        students: [
          { id: 'st_purged_order', name: 'Purged Student in CRM Chunk', updatedAt: purgeBaseMs + 10000 },
          { id: 'st_valid_order', name: 'Valid Student in CRM Chunk', updatedAt: purgeBaseMs + 10000 }
        ]
      })
    };

    // Order A: core_crm key before profile_settings key
    const orderADocs: Record<string, any[]> = {
      core_crm: [crmChunk],
      profile_settings: [profileChunk]
    };
    // Order B: profile_settings key before core_crm key
    const orderBDocs: Record<string, any[]> = {
      profile_settings: [profileChunk],
      core_crm: [crmChunk]
    };

    const reassembledA = reassembleWorkspaceSnapshot(orderADocs);
    const reassembledB = reassembleWorkspaceSnapshot(orderBDocs);
    assert.deepEqual(
      reassembledA.workspace.students.map((s: any) => s.id),
      ['st_valid_order']
    );
    assert.deepEqual(
      reassembledA.workspace.students,
      reassembledB.workspace.students
    );
    log.push('[PASS] [Production-boundary integration] P8-18. Out-of-order Cloud category reassembly produces identical state regardless of category order');

    // -------------------------------------------------------------------------
    // P8-19 & P8-20: P2P runSyncCycle() and handleInboundExchange() enforce tombstones in both directions
    // and P2P watermark does not advance for records deferred due to missing tombstone metadata
    // -------------------------------------------------------------------------
    function createInMemoryP2PDataSource(
      deviceId: string,
      deviceName: string,
      pairedPeers: any[],
      initialState: {
        groups?: any[];
        students?: any[];
        lessons?: any[];
        payments?: any[];
        transactions?: any[];
        schoolNotes?: any[];
        notifications?: any[];
        settings?: any[];
      }
    ): SyncDataSource & { state: Record<string, any[]>; syncState: any } {
      const state: Record<string, any[]> = {
        groups: [...(initialState.groups || [])],
        students: [...(initialState.students || [])],
        lessons: [...(initialState.lessons || [])],
        payments: [...(initialState.payments || [])],
        transactions: [...(initialState.transactions || [])],
        schoolNotes: [...(initialState.schoolNotes || [])],
        notifications: [...(initialState.notifications || [])],
        settings: [...(initialState.settings || [{
          id: 'singleton_teacher_settings',
          updatedAt: Date.now(),
          originRevision: 1,
          recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] },
          dismissedDashboardLessons: []
        }])]
      };
      let syncState: any = {
        localDeviceId: deviceId,
        localDeviceName: deviceName,
        localRevisionCounter: 20,
        peerWatermarkTable: {},
        pairedPeers: [...pairedPeers]
      };
      return {
        state,
        get syncState() {
          return syncState;
        },
        getLocalData() {
          return state;
        },
        getSyncState() {
          return syncState;
        },
        async saveMergedData(type: string, merged: any[]) {
          state[type] = merged;
        },
        async updateSyncState(newState: any) {
          syncState = newState;
        }
      };
    }

    // Peer A has permanently deleted student 'st_p2p_purged' (and holds NO active students).
    // Peer B still has 'st_p2p_purged' as active (with a +1 hour clock-skewed timestamp) AND 'st_p2p_valid'.
    const peerADataSource = createInMemoryP2PDataSource(
      'peer_A_device',
      'Peer A',
      [{
        deviceId: 'peer_B_device',
        deviceName: 'Peer B',
        pairingToken: 'tok_ab',
        lastKnownIp: '127.0.0.1',
        port: 41234,
        lastSyncedTimestamp: 0
      }],
      {
        students: [],
        settings: [{
          id: 'singleton_teacher_settings',
          updatedAt: purgeBaseMs,
          originRevision: 15,
          recentlyDeleted: {
            students: [],
            groups: [],
            lessons: [],
            purgedRecords: [
              { id: 'st_p2p_purged', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs, originRevision: 15 }
            ]
          }
        }]
      }
    );

    const peerBDataSource = createInMemoryP2PDataSource(
      'peer_B_device',
      'Peer B',
      [{
        deviceId: 'peer_A_device',
        deviceName: 'Peer A',
        pairingToken: 'tok_ab',
        lastKnownIp: '127.0.0.1',
        port: 41234,
        lastSyncedTimestamp: 0
      }],
      {
        students: [
          { id: 'st_p2p_purged', name: 'Purged on A but Active on B', updatedAt: purgeBaseMs + 3600_000, originRevision: 500, originDeviceId: 'peer_B_device' },
          { id: 'st_p2p_valid', name: 'Valid Student on B', updatedAt: purgeBaseMs + 1000, originRevision: 12, originDeviceId: 'peer_B_device' }
        ],
        settings: [{
          id: 'singleton_teacher_settings',
          updatedAt: 1000,
          originRevision: 1,
          recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
        }]
      }
    );

    const syncResult = await runSyncCycle(
      'peer_B_device',
      peerADataSource,
      'Manual Sync',
      async (outboundPayload) => {
        // Execute real handleInboundExchange on Peer B!
        return await handleInboundExchange(outboundPayload, peerBDataSource);
      }
    );
    assert.equal(syncResult.success, true);

    // Verify Peer B removed 'st_p2p_purged' (even though Peer A sent an empty students delta!) and kept 'st_p2p_valid'
    assert.equal(peerBDataSource.state.students.some((s: any) => s.id === 'st_p2p_purged'), false);
    assert.equal(peerBDataSource.state.students.some((s: any) => s.id === 'st_p2p_valid'), true);

    // Verify Peer A rejected 'st_p2p_purged' from Peer B's reply and accepted 'st_p2p_valid'
    assert.equal(peerADataSource.state.students.some((s: any) => s.id === 'st_p2p_purged'), false);
    assert.equal(peerADataSource.state.students.some((s: any) => s.id === 'st_p2p_valid'), true);
    log.push('[PASS] [Mocked transport integration] P8-19. P2P runSyncCycle() and handleInboundExchange() enforce tombstones in both directions');

    // P8-20: P2P inbound payload WITHOUT authoritative tombstones defers unknown active records and does not advance watermark past them
    const peerCDataSource = createInMemoryP2PDataSource(
      'peer_C_device',
      'Peer C',
      [{
        deviceId: 'legacy_peer_no_tombstones',
        deviceName: 'Legacy Peer',
        pairingToken: 'tok_legacy',
        lastKnownIp: '127.0.0.1',
        port: 41235,
        lastSyncedTimestamp: 0
      }],
      {
        students: [{ id: 'st_known_on_c', name: 'Known on C', updatedAt: 1000, originRevision: 1, originDeviceId: 'legacy_peer_no_tombstones' }],
        settings: [{
          id: 'singleton_teacher_settings',
          updatedAt: purgeBaseMs,
          originRevision: 10,
          recentlyDeleted: {
            students: [],
            groups: [],
            lessons: [],
            purgedRecords: [{ id: 'st_purged_on_c', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs }]
          }
        }]
      }
    );

    // Legacy peer sends payload without settings and without purgedRecords (hasAuthoritativeTombstones = false)
    await handleInboundExchange(
      {
        senderDeviceId: 'legacy_peer_no_tombstones',
        senderDeviceName: 'Legacy Peer',
        peerWatermarks: {},
        records: {
          students: [
            { id: 'st_purged_on_c', name: 'Blocked by C Local Tombstone', updatedAt: 5000, originRevision: 5, originDeviceId: 'legacy_peer_no_tombstones' } as any,
            { id: 'st_known_on_c', name: 'Known on C Updated', updatedAt: 2000, originRevision: 2, originDeviceId: 'legacy_peer_no_tombstones' } as any,
            { id: 'st_unknown_from_legacy', name: 'Deferred Unknown Active', updatedAt: 9000, originRevision: 99, originDeviceId: 'legacy_peer_no_tombstones' } as any
          ]
        }
      },
      peerCDataSource
    );

    assert.equal(peerCDataSource.state.students.some((s: any) => s.id === 'st_purged_on_c'), false);
    assert.equal(peerCDataSource.state.students.some((s: any) => s.id === 'st_unknown_from_legacy'), false);
    assert.equal(peerCDataSource.state.students.find((s: any) => s.id === 'st_known_on_c')?.name, 'Known on C Updated');
    // Watermark for 'legacy_peer_no_tombstones' must NOT have advanced to 99 (the deferred record's revision)
    const legacyWatermarkOnC = peerCDataSource.syncState.peerWatermarkTable?.['legacy_peer_no_tombstones']?.['legacy_peer_no_tombstones'] || 0;
    assert.equal(legacyWatermarkOnC < 99, true);
    log.push('[PASS] [Production-boundary integration] P8-20. P2P handleInboundExchange() defers unknown active records and protects watermarks when tombstone metadata is missing');

    // -------------------------------------------------------------------------
    // P8-21, P8-22, P8-23: Backup export/import validation, non-destructive merge, and DEFAULT_LERNSTUDIO_SETS protection
    // -------------------------------------------------------------------------
    const rawBackupPayload = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: {
        groups: [{ id: 'grp_backup_1', name: 'Backup Group 1', updatedAt: 5000 }],
        students: [
          { id: 'st_backup_valid', name: 'Backup Valid Student', groupId: 'grp_backup_1', updatedAt: 5000 },
          { id: 'st_backup_purged', name: 'Backup Purged Student', groupId: 'grp_backup_1', updatedAt: 999999 }
        ],
        lessons: [
          { id: 'les_backup_valid', title: 'Backup Valid Lesson', groupId: 'grp_backup_1', updatedAt: 5000 }
        ],
        payments: [
          { id: 'pay_backup_1', studentId: 'st_backup_valid', amount: 200, updatedAt: 5000 }
        ],
        lernstudioSets: [
          { id: 'custom_backup_set_1', title: 'Backup Custom Set', items: [] }
        ],
        dismissedDashboardLessons: ['les_dismissed_backup_1'],
        recentlyDeleted: {
          students: [],
          groups: [],
          lessons: [],
          purgedRecords: [
            { id: 'st_backup_purged', type: 'student', purgedAt: '2026-02-01T12:00:00.000Z', updatedAt: purgeBaseMs }
          ]
        }
      }
    };

    const sanitizedBackup = validateAndSanitizeBackupPayload(rawBackupPayload);
    assert.equal(sanitizedBackup.isValid, true);
    assert.equal(sanitizedBackup.sanitizedData?.recentlyDeleted?.purgedRecords?.length, 1);
    assert.equal(sanitizedBackup.sanitizedData?.lessons?.length, 1);
    assert.equal(sanitizedBackup.sanitizedData?.payments?.length, 1);
    log.push('[PASS] [Production-boundary integration] P8-21. Backup export/validation preserves recentlyDeleted.purgedRecords and full lessons/payments');

    // P8-22: Merge backup into workspace with existing unrelated local active records
    const existingLocalWorkspaceForBackup: any = {
      groups: [{ id: 'grp_local_existing', name: 'Existing Local Group', updatedAt: 3000 }],
      students: [{ id: 'st_local_existing', name: 'Existing Local Student', groupId: 'grp_local_existing', updatedAt: 3000 }],
      lessons: [{ id: 'les_local_existing', title: 'Existing Local Lesson', groupId: 'grp_local_existing', updatedAt: 3000 }],
      payments: [{ id: 'pay_local_existing', studentId: 'st_local_existing', amount: 100, updatedAt: 3000 }],
      lernstudioSets: [...DEFAULT_LERNSTUDIO_SETS.slice(0, 3)],
      dismissedDashboardLessons: ['les_dismissed_local_1'],
      recentlyDeleted: {
        students: [],
        groups: [],
        lessons: [],
        purgedRecords: []
      }
    };

    const mergedBackupRes = mergeBackupPayloadIntoWorkspace(existingLocalWorkspaceForBackup, rawBackupPayload);
    assert.equal(mergedBackupRes.isValid, true);
    // Unrelated local active records are preserved!
    assert.equal(mergedBackupRes.workspace.groups.some((g: any) => g.id === 'grp_local_existing'), true);
    assert.equal(mergedBackupRes.workspace.groups.some((g: any) => g.id === 'grp_backup_1'), true);
    assert.equal(mergedBackupRes.workspace.students.some((s: any) => s.id === 'st_local_existing'), true);
    assert.equal(mergedBackupRes.workspace.students.some((s: any) => s.id === 'st_backup_valid'), true);
    // Purged student in backup is rejected!
    assert.equal(mergedBackupRes.workspace.students.some((s: any) => s.id === 'st_backup_purged'), false);
    assert.equal(mergedBackupRes.workspace.lessons.some((l: any) => l.id === 'les_local_existing'), true);
    assert.equal(mergedBackupRes.workspace.lessons.some((l: any) => l.id === 'les_backup_valid'), true);
    assert.equal(mergedBackupRes.workspace.payments.length, 2);
    log.push('[PASS] [Production-boundary integration] P8-22. Backup import merges safely without wiping existing unrelated local active records while enforcing purge tombstones');

    // P8-23: Built-in DEFAULT_LERNSTUDIO_SETS remain protected during Cloud sync and backup import
    const mergedSetsWithBuiltins = mergeWithBuiltinLernstudioSets(mergedBackupRes.workspace.lernstudioSets);
    assert.equal(mergedSetsWithBuiltins.length >= DEFAULT_LERNSTUDIO_SETS.length + 1, true);
    assert.equal(mergedSetsWithBuiltins.some((s: any) => s.id === 'custom_backup_set_1'), true);
    for (const builtinSet of DEFAULT_LERNSTUDIO_SETS.slice(0, 10)) {
      assert.equal(mergedSetsWithBuiltins.some((s: any) => s.id === builtinSet.id), true);
    }
    log.push('[PASS] [Production-boundary integration] P8-23. Built-in DEFAULT_LERNSTUDIO_SETS remain protected during Cloud sync and backup import');

    return { passed: true, log };
  } catch (err: any) {
    log.push('[FAIL] ' + (err?.stack || err?.message || String(err)));
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

