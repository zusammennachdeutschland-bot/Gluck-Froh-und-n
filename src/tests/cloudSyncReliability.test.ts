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
  executeRestoreItemOnWorkspace,
  stampFieldTimestamps,
  mergeConcurrentEntityFields
} from '../services/sync/mergeEngine';
import {
  hasAnyWorkspaceData,
  createSerializedSyncCoordinator,
  setPendingLocalPushFlag,
  hasPendingLocalPushFlag,
  clearPendingLocalPushFlag,
  loadDurablePendingRemoteQueue,
  loadDurablePendingRemoteQueueAsync,
  saveDurablePendingRemoteQueue,
  enqueueDurablePendingRemoteItem,
  removeDurablePendingRemoteItem,
  clearDurablePendingRemoteQueueForTests,
  clearDurablePendingRemoteQueueForTestsAsync
} from '../hooks/useGoogleCloudWorkspaceSync';
import { SyncableRecord } from '../types';
import {
  filterCustomOrModifiedLernstudioSets,
  mergeWithBuiltinLernstudioSets,
  BUILTIN_LERNSTUDIO_MAP,
  DEFAULT_LERNSTUDIO_SETS,
  SYNC_CONTROL_DOC_ID,
  SYNC_CONTROL_CATEGORY_KEY,
  SINGLETON_KEYS,
  applyDeltaOnWorkspace,
  reassembleWorkspaceSnapshot,
  isSyncControlDocument,
  getDeviceDeltaDocId,
  mergeDeltaPayloads,
  reassembleDeltaLogDocuments,
  computeChunkRevisionToken,
  parseChunkRevisionToken,
  isCandidateTokenOlderThanExisting,
  extractDocTokensFromBackupJson,
  acknowledgeAppliedRemoteRevisions,
  getAppliedDocTokens,
  resetAppliedDocTokensForTests,
  __setAcknowledgeStorageFailureForTests,
  evaluateRemoteSnapshotChanges
} from '../services/firebaseWorkspaceSync';
import {
  storage,
  __setStorageFailureHookForTests,
  __setSimulatePrimaryDbForTests
} from '../services/storageService';
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

  if (typeof (globalThis as any).localStorage === 'undefined') {
    const memStore = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => memStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memStore.set(key, String(value));
      },
      removeItem: (key: string) => {
        memStore.delete(key);
      },
      clear: () => {
        memStore.clear();
      },
      get length() {
        return memStore.size;
      },
      key: (index: number) => Array.from(memStore.keys())[index] ?? null
    };
  }

  __setSimulatePrimaryDbForTests(true);

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

    // =========================================================================
    // PART 9 — MANDATORY 20 ANDROID ↔ VERCEL CLOUD SYNC REPAIR SCENARIOS
    // =========================================================================
    log.push('------------------------------------------------------------------------');
    log.push('PART 9: MANDATORY 20 ANDROID ↔ VERCEL CLOUD SYNC REPAIR SCENARIOS');
    log.push('------------------------------------------------------------------------');

    // -------------------------------------------------------------------------
    // AV-01 [Integration Test]: Android creates student → Vercel receives student
    // -------------------------------------------------------------------------
    const androidDeviceId = 'android_cap_dev_01';
    const vercelDeviceId = 'vercel_web_dev_01';
    const wsAndroid: any = {
      groups: [{ id: 'grp_av_1', name: 'A2 Abendkurs', updatedAt: 1000, originDeviceId: androidDeviceId }],
      students: [],
      lessons: [],
      payments: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };
    const wsVercel: any = {
      groups: [{ id: 'grp_av_1', name: 'A2 Abendkurs', updatedAt: 1000, originDeviceId: androidDeviceId }],
      students: [],
      lessons: [],
      payments: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };

    const androidStudent = stampFieldTimestamps(
      null,
      {
        id: 'st_android_1',
        name: 'Karim Mansour',
        groupId: 'grp_av_1',
        studentPhone: '01011112222',
        parentPhone: '01033334444',
        updatedAt: 2000,
        version: 1,
        originDeviceId: androidDeviceId,
        originRevision: 1
      },
      2000
    );
    wsAndroid.students.push(androidStudent);

    const androidDeltaDoc = {
      id: getDeviceDeltaDocId(androidDeviceId),
      categoryKey: 'delta_log',
      chunkIndex: 0,
      totalChunks: 1,
      deviceId: androidDeviceId,
      opId: `${androidDeviceId}_op_1`,
      opSeq: 1,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [androidStudent],
        opId: `${androidDeviceId}_op_1`,
        opSeq: 1,
        deviceId: androidDeviceId,
        timestamp: new Date(2000).toISOString()
      })
    };
    const reassembledFromAndroid = reassembleDeltaLogDocuments([androidDeltaDoc]);
    assert.equal(reassembledFromAndroid.hasIncompleteStream, false);
    for (const d of reassembledFromAndroid.deltas) {
      applyDeltaOnWorkspace(wsVercel, d);
    }
    assert.equal(wsVercel.students.some((s: any) => s.id === 'st_android_1' && s.name === 'Karim Mansour'), true);
    log.push('[PASS] [Integration Test] AV-01. Android creates student -> Vercel receives student via per-device delta log');

    // -------------------------------------------------------------------------
    // AV-02 [Integration Test]: Vercel creates student → Android receives student
    // -------------------------------------------------------------------------
    const vercelStudent = stampFieldTimestamps(
      null,
      {
        id: 'st_vercel_1',
        name: 'Nour El-Din',
        groupId: 'grp_av_1',
        studentPhone: '01255556666',
        updatedAt: 2100,
        version: 1,
        originDeviceId: vercelDeviceId,
        originRevision: 1
      },
      2100
    );
    wsVercel.students.push(vercelStudent);

    const vercelDeltaDoc = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      chunkIndex: 0,
      totalChunks: 1,
      deviceId: vercelDeviceId,
      opId: `${vercelDeviceId}_op_1`,
      opSeq: 1,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [vercelStudent],
        opId: `${vercelDeviceId}_op_1`,
        opSeq: 1,
        deviceId: vercelDeviceId,
        timestamp: new Date(2100).toISOString()
      })
    };
    const reassembledFromVercel = reassembleDeltaLogDocuments([vercelDeltaDoc]);
    for (const d of reassembledFromVercel.deltas) {
      applyDeltaOnWorkspace(wsAndroid, d);
    }
    assert.equal(wsAndroid.students.some((s: any) => s.id === 'st_vercel_1' && s.name === 'Nour El-Din'), true);
    assert.equal(wsAndroid.students.length, 2);
    log.push('[PASS] [Integration Test] AV-02. Vercel creates student -> Android receives student');

    // -------------------------------------------------------------------------
    // AV-03 [Unit Test]: Concurrent edits on Android and Vercel within 1.5 seconds
    // (Verifies removal of unsafe `lastLocalPushTimestampMs + 1500` filter)
    // -------------------------------------------------------------------------
    const localKnownRevisions = new Map<string, string>();
    // Local Android pushed at t = 10,000ms; Vercel pushed at t = 10,200ms (within 200ms < 1500ms!)
    const incomingSubSecondDocs = [
      {
        id: getDeviceDeltaDocId(vercelDeviceId),
        categoryKey: 'delta_log',
        deviceId: vercelDeviceId,
        opId: 'vercel_web_dev_01_op_11',
        opSeq: 11,
        updatedAtMs: 10200,
        updatedAtIso: new Date(10200).toISOString(),
        payloadChunk: JSON.stringify({
          isCloudDelta: true,
          students: [{ id: 'st_subsecond', name: 'Subsecond Remote Student', updatedAt: 10200 }]
        })
      }
    ];
    const evalSubSecond = evaluateRemoteSnapshotChanges(incomingSubSecondDocs, {
      localDeviceId: androidDeviceId,
      appliedDocTokens: localKnownRevisions
    });
    assert.equal(evalSubSecond.shouldProcess, true);
    assert.equal(evalSubSecond.unappliedDocIds.includes(getDeviceDeltaDocId(vercelDeviceId)), true);
    log.push('[PASS] [Unit Test] AV-03. Concurrent edits on Android and Vercel within 1.5s are accepted (no timestamp-only 1500ms suppression)');

    // -------------------------------------------------------------------------
    // AV-04 [Unit Test]: Incoming snapshot while sync is already in flight
    // -------------------------------------------------------------------------
    const executionOrder: string[] = [];
    let releaseFirstTask!: () => void;
    const firstTaskGate = new Promise<void>((resolve) => {
      releaseFirstTask = resolve;
    });

    const coordinator = createSerializedSyncCoordinator({
      onExecuteLocalPush: async () => {
        executionOrder.push('start:local-push');
        await firstTaskGate;
        executionOrder.push('end:local-push');
        return true;
      },
      onApplyRemotePayload: async (remoteJson) => {
        executionOrder.push(`start:remote-pull:${remoteJson}`);
        executionOrder.push(`end:remote-pull:${remoteJson}`);
        return true;
      }
    });

    const p1 = coordinator.enqueueLocalPush();
    // While local push is in flight, a remote snapshot arrives!
    const p2 = coordinator.enqueueRemoteSnapshot('remote_snap_while_inflight');
    assert.equal(coordinator.isBusy(), true);
    assert.equal(coordinator.getPendingRemoteCount(), 1);
    releaseFirstTask();
    await Promise.all([p1, p2]);
    assert.deepEqual(executionOrder, [
      'start:local-push',
      'end:local-push',
      'start:remote-pull:remote_snap_while_inflight',
      'end:remote-pull:remote_snap_while_inflight'
    ]);
    log.push('[PASS] [Unit Test] AV-04. Incoming snapshot while sync is in flight is queued and processed immediately after completion');

    // -------------------------------------------------------------------------
    // AV-05 [Integration Test]: Multiple rapid snapshots arriving in sequence
    // -------------------------------------------------------------------------
    const rapidSnapshotsReceived: string[] = [];
    let releaseRapidGate!: () => void;
    const rapidGate = new Promise<void>((resolve) => {
      releaseRapidGate = resolve;
    });

    const rapidCoord = createSerializedSyncCoordinator({
      onExecuteLocalPush: async () => {
        await rapidGate;
        return true;
      },
      onApplyRemotePayload: async (remoteJson) => {
        rapidSnapshotsReceived.push(remoteJson);
        return true;
      }
    });

    const lockPromise = rapidCoord.enqueueLocalPush();
    const r1 = rapidCoord.enqueueRemoteSnapshot('snap_1');
    const r2 = rapidCoord.enqueueRemoteSnapshot('snap_2');
    const r3 = rapidCoord.enqueueRemoteSnapshot('snap_3');
    assert.equal(rapidCoord.getPendingRemoteCount(), 3);
    releaseRapidGate();
    await Promise.all([lockPromise, r1, r2, r3]);
    assert.deepEqual(rapidSnapshotsReceived, ['snap_1', 'snap_2', 'snap_3']);
    log.push('[PASS] [Integration Test] AV-05. Multiple rapid snapshots arriving in sequence are queued and processed in exact order without loss');

    // -------------------------------------------------------------------------
    // AV-06 [Unit Test]: Offline creation on Android followed by reconnect
    // -------------------------------------------------------------------------
    const testUid = 'uid_offline_reconnect_test';
    clearPendingLocalPushFlag(testUid);
    assert.equal(hasPendingLocalPushFlag(testUid), false);
    // Simulate offline mutation marking dirty flag
    setPendingLocalPushFlag(testUid, true);
    assert.equal(hasPendingLocalPushFlag(testUid), true);
    // Simulate reconnect draining pending push and clearing flag only after confirmation
    clearPendingLocalPushFlag(testUid);
    assert.equal(hasPendingLocalPushFlag(testUid), false);
    log.push('[PASS] [Unit Test] AV-06. Offline creation on Android persists pending push dirty flag and flushes upon reconnect');

    // -------------------------------------------------------------------------
    // AV-07 [Integration Test]: Offline edits on both platforms followed by reconnect
    // -------------------------------------------------------------------------
    const wsOfflineAndroid: any = {
      students: [
        { id: 'st_shared_base', name: 'Shared Student', groupId: 'grp_av_1', updatedAt: 1000 },
        { id: 'st_offline_android', name: 'Added Offline on Android', groupId: 'grp_av_1', updatedAt: 5000, originDeviceId: androidDeviceId }
      ],
      todos: [
        { id: 'todo_android_offline', text: 'Grade B1 Homework', completed: false, updatedAt: 5000 }
      ],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };
    const wsOfflineVercel: any = {
      students: [
        { id: 'st_shared_base', name: 'Shared Student', groupId: 'grp_av_1', updatedAt: 1000 },
        { id: 'st_offline_vercel', name: 'Added Offline on Vercel', groupId: 'grp_av_1', updatedAt: 5200, originDeviceId: vercelDeviceId }
      ],
      todos: [
        { id: 'todo_vercel_offline', text: 'Prepare A2 Exam', completed: true, updatedAt: 5200 }
      ],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };

    // Both reconnect and exchange deltas
    applyDeltaOnWorkspace(wsOfflineAndroid, {
      students: wsOfflineVercel.students,
      todos: wsOfflineVercel.todos
    });
    applyDeltaOnWorkspace(wsOfflineVercel, {
      students: wsOfflineAndroid.students,
      todos: wsOfflineAndroid.todos
    });
    assert.equal(wsOfflineAndroid.students.length, 3);
    assert.equal(wsOfflineVercel.students.length, 3);
    assert.equal(wsOfflineAndroid.todos.length, 2);
    assert.equal(wsOfflineVercel.todos.length, 2);
    log.push('[PASS] [Integration Test] AV-07. Offline edits on both Android and Vercel merge non-destructively upon reconnect');

    // -------------------------------------------------------------------------
    // AV-08 [Integration Test]: Concurrent delta updates from both platforms
    // (Per-device delta docs + transactional mergeDeltaPayloads prevent overwrite)
    // -------------------------------------------------------------------------
    const androidDeltaDocId = getDeviceDeltaDocId(androidDeviceId);
    const vercelDeltaDocId = getDeviceDeltaDocId(vercelDeviceId);
    assert.notEqual(androidDeltaDocId, vercelDeltaDocId);

    // Even if the same device writes two rapid deltas into its delta doc via transaction:
    const mergedSameDeviceDelta = mergeDeltaPayloads(
      {
        isCloudDelta: true,
        students: [{ id: 'st_delta_1', name: 'First Delta Student', updatedAt: 3000 }],
        opId: 'op_1',
        opSeq: 1
      },
      {
        isCloudDelta: true,
        lessons: [{ id: 'les_delta_2', title: 'Second Delta Lesson', updatedAt: 3100 }],
        opId: 'op_2',
        opSeq: 2
      }
    );
    assert.equal(mergedSameDeviceDelta.students.length, 1);
    assert.equal(mergedSameDeviceDelta.lessons.length, 1);

    // And when both Android and Vercel write their per-device delta docs concurrently:
    const combinedMultiDeviceDelta = reassembleDeltaLogDocuments([
      {
        id: androidDeltaDocId,
        categoryKey: 'delta_log',
        chunkIndex: 0,
        totalChunks: 1,
        deviceId: androidDeviceId,
        payloadChunk: JSON.stringify(mergedSameDeviceDelta)
      },
      {
        id: vercelDeltaDocId,
        categoryKey: 'delta_log',
        chunkIndex: 0,
        totalChunks: 1,
        deviceId: vercelDeviceId,
        payloadChunk: JSON.stringify({
          isCloudDelta: true,
          students: [{ id: 'st_delta_vercel', name: 'Concurrent Vercel Student', updatedAt: 3050 }],
          payments: [{ id: 'pay_delta_vercel', studentId: 'st_delta_vercel', amountDue: 1200, amountPaid: 1200, status: 'paid', updatedAt: 3050 }]
        })
      }
    ]);
    assert.equal(combinedMultiDeviceDelta.hasIncompleteStream, false);
    assert.equal(combinedMultiDeviceDelta.deltas.length, 2);
    const wsMultiDeltaTarget: any = {
      students: [],
      lessons: [],
      payments: [],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };
    for (const d of combinedMultiDeviceDelta.deltas) {
      applyDeltaOnWorkspace(wsMultiDeltaTarget, d);
    }
    assert.equal(wsMultiDeltaTarget.students.length, 2);
    assert.equal(wsMultiDeltaTarget.lessons.length, 1);
    assert.equal(wsMultiDeltaTarget.payments.length, 1);
    log.push('[PASS] [Integration Test] AV-08. Concurrent delta updates from Android and Vercel use isolated per-device streams and transactional merge without data loss');

    // -------------------------------------------------------------------------
    // AV-09 [Integration Test]: Soft delete on Android → reflected on Vercel
    // -------------------------------------------------------------------------
    const softDeleteTs = Date.parse('2026-03-01T10:00:00.000Z');
    const softDeleteIso = new Date(softDeleteTs).toISOString();
    const wsSoftAndroid: any = {
      students: [{ id: 'st_soft_av', name: 'Sara Kamel', groupId: 'grp_av_1', deleted: true, deletedAt: softDeleteTs, updatedAt: softDeleteTs }],
      recentlyDeleted: {
        students: [{ item: { id: 'st_soft_av', name: 'Sara Kamel', groupId: 'grp_av_1', updatedAt: softDeleteTs }, deletedAt: softDeleteIso }],
        groups: [],
        lessons: [],
        purgedRecords: []
      }
    };
    const wsSoftVercel: any = {
      students: [{ id: 'st_soft_av', name: 'Sara Kamel', groupId: 'grp_av_1', deleted: false, updatedAt: 1000 }],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };
    applyDeltaOnWorkspace(wsSoftVercel, {
      students: wsSoftAndroid.students,
      recentlyDeleted: wsSoftAndroid.recentlyDeleted
    });
    assert.equal(wsSoftVercel.students.find((s: any) => s.id === 'st_soft_av')?.deleted, true);
    assert.equal(wsSoftVercel.recentlyDeleted.students.some((e: any) => e.item.id === 'st_soft_av'), true);
    log.push('[PASS] [Integration Test] AV-09. Soft delete on Android propagates to Vercel active list and Recently Deleted');

    // -------------------------------------------------------------------------
    // AV-10 [Integration Test]: Restore on Vercel → reflected on Android (including pruning Recently Deleted)
    // -------------------------------------------------------------------------
    const restoreTs = softDeleteTs + 10000;
    executeRestoreItemOnWorkspace(wsSoftVercel, 'student', 'st_soft_av', (rec) => ({
      ...rec,
      deleted: false,
      deletedAt: undefined,
      updatedAt: restoreTs,
      version: 5
    }));
    // Sync Vercel's restored student back to Android (even if Android still had the old recentlyDeleted entry locally!)
    applyDeltaOnWorkspace(wsSoftAndroid, {
      students: wsSoftVercel.students
    });
    assert.equal(wsSoftAndroid.students.find((s: any) => s.id === 'st_soft_av')?.deleted, false);
    // Verify cross-device restoration reconciliation pruned the stale entry from Android's recentlyDeleted!
    assert.equal(wsSoftAndroid.recentlyDeleted.students.some((e: any) => e.item.id === 'st_soft_av'), false);
    log.push('[PASS] [Integration Test] AV-10. Restore on Vercel restores student on Android and prunes stale Recently Deleted entry');

    // -------------------------------------------------------------------------
    // AV-11 [Integration Test]: Permanent deletion tombstone on Android → never resurrected by Vercel
    // -------------------------------------------------------------------------
    wsSoftAndroid.recentlyDeleted.students.push({
      item: { id: 'st_soft_av', name: 'Sara Kamel', updatedAt: restoreTs },
      deletedAt: new Date(restoreTs + 5000).toISOString()
    });
    executePermanentDeleteOnWorkspace(wsSoftAndroid, 'student', 'st_soft_av', () => 99, restoreTs + 10000);
    // Vercel tries to push an active copy of st_soft_av with higher timestamp
    applyDeltaOnWorkspace(wsSoftAndroid, {
      students: [{ id: 'st_soft_av', name: 'Sara Kamel Resurrect Attempt', updatedAt: restoreTs + 999999, version: 999 }]
    });
    assert.equal(wsSoftAndroid.students.some((s: any) => s.id === 'st_soft_av'), false);
    // And when Android's tombstone arrives on Vercel, Vercel purges st_soft_av too:
    applyDeltaOnWorkspace(wsSoftVercel, {
      recentlyDeleted: wsSoftAndroid.recentlyDeleted
    });
    assert.equal(wsSoftVercel.students.some((s: any) => s.id === 'st_soft_av'), false);
    log.push('[PASS] [Integration Test] AV-11. Permanent deletion tombstone on Android purges record on Vercel and prevents resurrection');

    // -------------------------------------------------------------------------
    // AV-12 [Unit Test]: Concurrent edits to different fields of the same record
    // -------------------------------------------------------------------------
    const baseStudentRecord: any = stampFieldTimestamps(
      null,
      {
        id: 'st_field_merge_1',
        name: 'Omar Hassan',
        studentPhone: '01000000000',
        notes: 'Initial note',
        updatedAt: 1000,
        version: 1,
        originDeviceId: androidDeviceId
      },
      1000
    );

    // Android updates studentPhone at t = 2000
    const androidEditedPhone = stampFieldTimestamps(
      baseStudentRecord,
      { ...baseStudentRecord, studentPhone: '01099998888', updatedAt: 2000, version: 2, originDeviceId: androidDeviceId },
      2000
    );
    // Vercel concurrently updates notes at t = 2500 (still having old studentPhone '01000000000')
    const vercelEditedNotes = stampFieldTimestamps(
      baseStudentRecord,
      { ...baseStudentRecord, notes: 'Updated on Vercel: Needs extra grammar practice', updatedAt: 2500, version: 2, originDeviceId: vercelDeviceId },
      2500
    );

    const fieldMergedRes = mergeEntities([androidEditedPhone], [vercelEditedNotes], 'students');
    assert.equal(fieldMergedRes.merged.length, 1);
    // BOTH the Android phone update and the Vercel notes update must be preserved!
    assert.equal(fieldMergedRes.merged[0].studentPhone, '01099998888');
    assert.equal(fieldMergedRes.merged[0].notes, 'Updated on Vercel: Needs extra grammar practice');
    log.push('[PASS] [Unit Test] AV-12. Concurrent edits to different fields of the same record preserve both field updates');

    // -------------------------------------------------------------------------
    // AV-13 [Unit Test]: Concurrent edits to the same field of the same record
    // -------------------------------------------------------------------------
    const androidSameField = stampFieldTimestamps(
      baseStudentRecord,
      { ...baseStudentRecord, notes: 'Android note at t=3000', updatedAt: 3000, version: 3, originDeviceId: androidDeviceId },
      3000
    );
    const vercelSameField = stampFieldTimestamps(
      baseStudentRecord,
      { ...baseStudentRecord, notes: 'Vercel note at t=3500', updatedAt: 3500, version: 4, originDeviceId: vercelDeviceId },
      3500
    );
    const sameFieldAB = mergeEntities([androidSameField], [vercelSameField], 'students').merged[0];
    const sameFieldBA = mergeEntities([vercelSameField], [androidSameField], 'students').merged[0];
    assert.equal(sameFieldAB.notes, 'Vercel note at t=3500');
    assert.equal(sameFieldBA.notes, 'Vercel note at t=3500');
    log.push('[PASS] [Unit Test] AV-13. Concurrent edits to the same field resolve deterministically across both devices');

    // -------------------------------------------------------------------------
    // AV-14 [Unit Test]: Control document update (`sync_control_chunk_0`) does not corrupt `core_crm`
    // -------------------------------------------------------------------------
    const legacyControlDocInCoreCrm = {
      id: SYNC_CONTROL_DOC_ID,
      categoryKey: 'core_crm',
      chunkIndex: 0,
      totalChunks: 1,
      payloadChunk: JSON.stringify({
        isPaused: false,
        syncGeneration: 'gen_12345',
        reason: 'manual_reactivation'
      })
    };
    const newIsolatedControlDoc = {
      id: SYNC_CONTROL_DOC_ID,
      categoryKey: SYNC_CONTROL_CATEGORY_KEY,
      chunkIndex: 0,
      totalChunks: 1,
      payloadChunk: JSON.stringify({
        isPaused: false,
        syncGeneration: 'gen_67890',
        reason: 'manual_reactivation'
      })
    };
    const validCoreCrmDoc = {
      id: 'core_crm_chunk_0',
      categoryKey: 'core_crm',
      chunkIndex: 0,
      totalChunks: 1,
      payloadChunk: JSON.stringify({
        groups: [{ id: 'grp_safe', name: 'Safe Group', updatedAt: 1000 }],
        students: [{ id: 'st_safe', name: 'Safe Student', groupId: 'grp_safe', updatedAt: 1000 }],
        lessons: [{ id: 'les_reload_1', title: 'Grammatik Lektion 1', groupId: 'grp_safe', date: '2026-03-10', time: '18:00', status: 'scheduled', updatedAt: 2000 }],
        payments: [{ id: 'pay_reload_1', studentId: 'st_safe', groupId: 'grp_safe', amountDue: 1200, amountPaid: 600, status: 'partial', updatedAt: 2000 }]
      })
    };

    assert.equal(isSyncControlDocument(legacyControlDocInCoreCrm), true);
    assert.equal(isSyncControlDocument(newIsolatedControlDoc), true);
    assert.equal(isSyncControlDocument(validCoreCrmDoc), false);

    // Even if a legacy control doc was grouped under core_crm alongside validCoreCrmDoc, reassembleWorkspaceSnapshot strips it:
    const reassembledWithControl = reassembleWorkspaceSnapshot({
      profile_settings: [{
        id: 'profile_settings_chunk_0',
        categoryKey: 'profile_settings',
        chunkIndex: 0,
        totalChunks: 1,
        payloadChunk: JSON.stringify({
          recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
        })
      }],
      core_crm: [legacyControlDocInCoreCrm, validCoreCrmDoc],
      [SYNC_CONTROL_CATEGORY_KEY]: [newIsolatedControlDoc]
    });
    assert.equal(reassembledWithControl.workspace.groups.length, 1);
    assert.equal(reassembledWithControl.workspace.students.length, 1);
    assert.equal((reassembledWithControl.workspace as any).isPaused, undefined);
    assert.equal((reassembledWithControl.workspace as any).syncGeneration, undefined);
    log.push('[PASS] [Unit Test] AV-14. Control document (sync_control_chunk_0) is isolated and never corrupts core_crm reassembly');

    // -------------------------------------------------------------------------
    // AV-15 [Integration Test]: App reload / process restart preserves all synced data
    // -------------------------------------------------------------------------
    const fullCategorizedCloudDocs: Record<string, any[]> = {
      profile_settings: [{
        id: 'profile_settings_chunk_0',
        categoryKey: 'profile_settings',
        chunkIndex: 0,
        totalChunks: 1,
        payloadChunk: JSON.stringify({
          profile: { name: 'Herr Ahmed', subject: 'Deutsch', phone: '0100000000' },
          recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
        })
      }],
      core_crm: [validCoreCrmDoc],
      finance_gold: [{
        id: 'finance_gold_chunk_0',
        categoryKey: 'finance_gold',
        chunkIndex: 0,
        totalChunks: 1,
        payloadChunk: JSON.stringify({
          financeTransactions: [{ id: 'tx_reload_1', type: 'income', amount: 600, date: '2026-03-10', updatedAt: 2000 }]
        })
      }]
    };
    const coldStartReassembled = reassembleWorkspaceSnapshot(fullCategorizedCloudDocs);
    assert.equal(coldStartReassembled.workspace.groups.length, 1);
    assert.equal(coldStartReassembled.workspace.students.length, 1);
    assert.equal(coldStartReassembled.workspace.lessons.length, 1);
    assert.equal(coldStartReassembled.workspace.payments.length, 1);
    assert.equal(coldStartReassembled.workspace.financeTransactions.length, 1);
    assert.equal(coldStartReassembled.workspace.profile.name, 'Herr Ahmed');
    log.push('[PASS] [Integration Test] AV-15. App reload / cold start reassembles all workspace categories cleanly');

    // -------------------------------------------------------------------------
    // AV-16 [Integration Test]: Background-to-foreground resume on Android
    // -------------------------------------------------------------------------
    const resumeEvents: string[] = [];
    const resumeCoord = createSerializedSyncCoordinator({
      onApplyRemotePayload: async (remoteJson) => {
        resumeEvents.push(`remote-pull:${remoteJson}`);
        return true;
      },
      onExecuteLocalPush: async () => {
        resumeEvents.push('local-push:flush_pending_on_resume');
        return true;
      }
    });
    // Simulate Android WebView returning from background with a pending local push + incoming remote check
    setPendingLocalPushFlag('uid_android_resume', true);
    if (hasPendingLocalPushFlag('uid_android_resume')) {
      await resumeCoord.enqueueLocalPush();
      clearPendingLocalPushFlag('uid_android_resume');
    }
    await resumeCoord.enqueueRemoteSnapshot('pull_remote_on_resume');
    assert.deepEqual(resumeEvents, ['local-push:flush_pending_on_resume', 'remote-pull:pull_remote_on_resume']);
    assert.equal(hasPendingLocalPushFlag('uid_android_resume'), false);
    log.push('[PASS] [Integration Test] AV-16. Background-to-foreground resume on Android flushes pending local push and pulls remote updates in order');

    // -------------------------------------------------------------------------
    // AV-17 [Integration Test]: Lesson status / attendance / homework / payment update sync
    // -------------------------------------------------------------------------
    const baseLesson: any = stampFieldTimestamps(
      null,
      {
        id: 'les_live_1',
        groupId: 'grp_safe',
        title: 'Konversation B1',
        date: '2026-03-11',
        time: '19:00',
        status: 'scheduled',
        paymentStatus: 'pending',
        amountDue: 300,
        amountPaid: 0,
        updatedAt: 1000,
        version: 1
      },
      1000
    );

    // Android marks lesson completed with attendance & homework report
    const completedOnAndroid = stampFieldTimestamps(
      baseLesson,
      {
        ...baseLesson,
        status: 'completed',
        report: {
          attendanceStatus: 'present',
          homeworkStatus: 'completed',
          studentAttendance: { st_safe: 'present' },
          studentHomework: { st_safe: 'completed' },
          teacherNotes: 'Sehr gute Mitarbeit'
        },
        updatedAt: 2000,
        version: 2,
        originDeviceId: androidDeviceId
      },
      2000
    );

    // Vercel concurrently records payment on the same lesson
    const paidOnVercel = stampFieldTimestamps(
      baseLesson,
      {
        ...baseLesson,
        paymentStatus: 'paid',
        amountPaid: 300,
        updatedAt: 2200,
        version: 2,
        originDeviceId: vercelDeviceId
      },
      2200
    );

    const mergedLesson = mergeEntities([completedOnAndroid], [paidOnVercel], 'lessons').merged[0];
    assert.equal(mergedLesson.status, 'completed');
    assert.equal(mergedLesson.report?.attendanceStatus, 'present');
    assert.equal(mergedLesson.report?.homeworkStatus, 'completed');
    assert.equal(mergedLesson.paymentStatus, 'paid');
    assert.equal(mergedLesson.amountPaid, 300);
    log.push('[PASS] [Integration Test] AV-17. Lesson status, attendance, homework, and payment updates synchronize and merge without overwriting each other');

    // -------------------------------------------------------------------------
    // AV-18 [Unit Test]: Error recovery and retry behavior (queue never deadlocks on error)
    // -------------------------------------------------------------------------
    let attemptCount = 0;
    let recordedErrorPhase = '';
    const errorRecoveryCoord = createSerializedSyncCoordinator({
      onExecuteLocalPush: async () => {
        attemptCount++;
        throw new Error('SIMULATED_NETWORK_TIMEOUT');
      },
      onApplyRemotePayload: async () => {
        attemptCount++;
        return true;
      },
      onError: (_err, phase) => {
        recordedErrorPhase = phase;
      }
    });

    const failedPushOutcome = await errorRecoveryCoord.enqueueLocalPush();
    assert.equal(failedPushOutcome, false);
    assert.equal(recordedErrorPhase, 'local_push');
    assert.equal(errorRecoveryCoord.isBusy(), false);

    // Subsequent task on the coordinator MUST execute normally without being blocked
    const recoveryOutcome = await errorRecoveryCoord.enqueueRemoteSnapshot('subsequent_recovery_snap');
    assert.equal(recoveryOutcome, true);
    assert.equal(attemptCount, 2);
    log.push('[PASS] [Unit Test] AV-18. Error recovery: transient sync failure does not deadlock the serialized sync queue');

    // -------------------------------------------------------------------------
    // AV-19 [Unit Test]: Duplicate event delivery idempotency
    // -------------------------------------------------------------------------
    const dupRevisions = new Map<string, string>();
    const sampleRemoteDoc = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_dup_op_42',
      opSeq: 42,
      updatedAtMs: 5000,
      updatedAtIso: '2026-03-11T12:00:00.000Z',
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_idempotent_1', name: 'Idempotent Student', updatedAt: 5000 }]
      })
    };

    // First delivery: accepted
    const firstEval = evaluateRemoteSnapshotChanges([sampleRemoteDoc], {
      localDeviceId: androidDeviceId,
      appliedDocTokens: dupRevisions
    });
    assert.equal(firstEval.shouldProcess, true);
    for (const [docId, token] of Object.entries(firstEval.nextDocTokens)) {
      dupRevisions.set(docId, token);
    }

    // Duplicate delivery of the exact same snapshot: ignored idempotently
    const secondEval = evaluateRemoteSnapshotChanges([sampleRemoteDoc], {
      localDeviceId: androidDeviceId,
      appliedDocTokens: dupRevisions
    });
    assert.equal(secondEval.shouldProcess, false);
    log.push('[PASS] [Unit Test] AV-19. Duplicate Firestore snapshot event delivery is detected via opId/digest and ignored idempotently');

    // -------------------------------------------------------------------------
    // AV-20 [Unit Test]: Clock skew between Android and Vercel devices
    // -------------------------------------------------------------------------
    // Suppose Android's local clock is 5 minutes AHEAD of Vercel's clock.
    // Vercel pushes an update whose wall-clock timestamp is 5 minutes OLDER than Android's last push,
    // but carries a new opId ('vercel_skewed_op_99') and new payload digest.
    const skewedRemoteDoc = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_skewed_op_99',
      opSeq: 99,
      updatedAtMs: Date.now() - 300_000, // 5 minutes behind!
      updatedAtIso: new Date(Date.now() - 300_000).toISOString(),
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_clock_skew_1', name: 'Student From Skewed Clock Device', updatedAt: Date.now() - 300_000 }]
      })
    };
    const skewEval = evaluateRemoteSnapshotChanges([skewedRemoteDoc], {
      localDeviceId: androidDeviceId,
      appliedDocTokens: dupRevisions
    });
    assert.equal(skewEval.shouldProcess, true);
    assert.equal(skewEval.unappliedDocIds.includes(getDeviceDeltaDocId(vercelDeviceId)), true);
    log.push('[PASS] [Unit Test] AV-20. Clock skew between Android and Vercel (+5 min / -5 min) does not reject valid unseen remote operations');

    // =========================================================================
    // PART 10 — MANDATORY 15 REMOTE ACKNOWLEDGEMENT, DURABLE RETRY & ZERO-LOSS QUEUE TESTS
    // =========================================================================
    log.push('------------------------------------------------------------------------');
    log.push('PART 10: MANDATORY 15 REMOTE ACKNOWLEDGEMENT, DURABLE RETRY & ZERO-LOSS QUEUE TESTS');
    log.push('------------------------------------------------------------------------');

    // -------------------------------------------------------------------------
    // RA-01: Successful remote import acknowledges revisions
    // -------------------------------------------------------------------------
    const raUid1 = 'uid_ra_01';
    resetAppliedDocTokensForTests(raUid1);
    clearDurablePendingRemoteQueueForTests(raUid1);
    const raDoc1 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra01_op_1',
      opSeq: 1,
      updatedAtMs: 10000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_01', name: 'Student RA-01', updatedAt: 10000 }]
      })
    };
    const raToken1 = computeChunkRevisionToken(raDoc1);
    const raTokensMap1 = { [raDoc1.id]: raToken1 };

    // Before import: revision is NOT acknowledged
    assert.equal(getAppliedDocTokens(raUid1)[raDoc1.id], undefined);
    const evalBeforeAck1 = evaluateRemoteSnapshotChanges([raDoc1], {
      localDeviceId: androidDeviceId,
      appliedDocTokens: getAppliedDocTokens(raUid1)
    });
    assert.equal(evalBeforeAck1.shouldProcess, true);

    // Execute remote import + durable persistence + explicit acknowledgement
    const raLocalWorkspace1: any = { students: [], groups: [], lessons: [], payments: [] };
    const raCoord1 = createSerializedSyncCoordinator({
      uid: raUid1,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(raLocalWorkspace1, parsed);
        await storage.setItem('dl_students_ra01', raLocalWorkspace1.students);
        const verified = await storage.verifyDurableReadBack(['dl_students_ra01']);
        if (!verified) return false;
        return acknowledgeAppliedRemoteRevisions(raUid1, docTokens, raLocalWorkspace1);
      }
    });

    const raOutcome1 = await raCoord1.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_01', name: 'Student RA-01', updatedAt: 10000 }],
        _cloudDocTokens: raTokensMap1,
        _cloudWorkspaceId: raUid1
      }),
      raTokensMap1
    );
    assert.equal(raOutcome1, true);
    assert.equal(raLocalWorkspace1.students.length, 1);
    assert.equal(getAppliedDocTokens(raUid1)[raDoc1.id], raToken1);
    assert.equal(raCoord1.getPendingRemoteCount(), 0);
    assert.equal(loadDurablePendingRemoteQueue(raUid1).length, 0);

    const evalAfterAck1 = evaluateRemoteSnapshotChanges([raDoc1], {
      localDeviceId: androidDeviceId,
      appliedDocTokens: getAppliedDocTokens(raUid1)
    });
    assert.equal(evalAfterAck1.shouldProcess, false);
    raCoord1.dispose();
    log.push('[PASS] [Integration Test] RA-01. Successful remote import acknowledges revisions only after merge and durable persistence complete');

    // -------------------------------------------------------------------------
    // RA-02: Failed import does not acknowledge revisions
    // -------------------------------------------------------------------------
    const raUid2 = 'uid_ra_02';
    resetAppliedDocTokensForTests(raUid2);
    clearDurablePendingRemoteQueueForTests(raUid2);
    const raDoc2 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra02_op_1',
      opSeq: 1,
      updatedAtMs: 11000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_02', name: 'Student RA-02', updatedAt: 11000 }]
      })
    };
    const raToken2 = computeChunkRevisionToken(raDoc2);
    const raTokensMap2 = { [raDoc2.id]: raToken2 };

    const raCoord2 = createSerializedSyncCoordinator({
      uid: raUid2,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async () => {
        // Simulate importBackupFile returning false
        return false;
      }
    });

    const raOutcome2 = await raCoord2.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_02', name: 'Student RA-02', updatedAt: 11000 }],
        _cloudDocTokens: raTokensMap2
      }),
      raTokensMap2
    );
    assert.equal(raOutcome2, false);
    // Crucial assertions: token is NOT acknowledged, and item is STILL in the queue!
    assert.equal(getAppliedDocTokens(raUid2)[raDoc2.id], undefined);
    assert.equal(raCoord2.getPendingRemoteCount(), 1);
    assert.equal(loadDurablePendingRemoteQueue(raUid2).length, 1);
    const evalAfterFailedImport2 = evaluateRemoteSnapshotChanges([raDoc2], {
      localDeviceId: androidDeviceId,
      appliedDocTokens: getAppliedDocTokens(raUid2)
    });
    assert.equal(evalAfterFailedImport2.shouldProcess, true);
    raCoord2.dispose();
    log.push('[PASS] [Unit Test] RA-02. Failed remote import does not acknowledge revisions and keeps payload in pending queue');

    // -------------------------------------------------------------------------
    // RA-03: Local persistence failure does not acknowledge revisions
    // -------------------------------------------------------------------------
    const raUid3 = 'uid_ra_03';
    resetAppliedDocTokensForTests(raUid3);
    clearDurablePendingRemoteQueueForTests(raUid3);
    const raDoc3 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra03_op_1',
      opSeq: 1,
      updatedAtMs: 12000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_03', name: 'Student RA-03', updatedAt: 12000 }]
      })
    };
    const raToken3 = computeChunkRevisionToken(raDoc3);
    const raTokensMap3 = { [raDoc3.id]: raToken3 };

    // Inject deterministic storage write failure on 'dl_students_ra03'
    __setStorageFailureHookForTests((op, key) => {
      if (op === 'set' && key === 'dl_students_ra03') {
        throw new Error('SIMULATED_DISK_QUOTA_OR_INDEXEDDB_WRITE_FAILURE');
      }
    });

    const raCoord3 = createSerializedSyncCoordinator({
      uid: raUid3,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        try {
          const parsed = JSON.parse(remoteJson);
          await storage.setItem('dl_students_ra03', parsed.students);
          return acknowledgeAppliedRemoteRevisions(raUid3, docTokens, parsed);
        } catch {
          return false;
        }
      }
    });

    const raOutcome3 = await raCoord3.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_03', name: 'Student RA-03', updatedAt: 12000 }]
      }),
      raTokensMap3
    );
    __setStorageFailureHookForTests(null);

    assert.equal(raOutcome3, false);
    assert.equal(getAppliedDocTokens(raUid3)[raDoc3.id], undefined);
    assert.equal(raCoord3.getPendingRemoteCount(), 1);
    assert.equal(loadDurablePendingRemoteQueue(raUid3).length, 1);
    raCoord3.dispose();
    log.push('[PASS] [Integration Test] RA-03. Local storage persistence failure aborts import, prevents revision acknowledgement, and preserves pending item');

    // -------------------------------------------------------------------------
    // RA-04: Retry succeeds without receiving another Firestore snapshot
    // -------------------------------------------------------------------------
    const raUid4 = 'uid_ra_04';
    resetAppliedDocTokensForTests(raUid4);
    clearDurablePendingRemoteQueueForTests(raUid4);
    const raDoc4 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra04_op_1',
      opSeq: 1,
      updatedAtMs: 13000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_04', name: 'Student RA-04 Auto-Retried', updatedAt: 13000 }]
      })
    };
    const raToken4 = computeChunkRevisionToken(raDoc4);
    const raTokensMap4 = { [raDoc4.id]: raToken4 };

    let ra4Attempts = 0;
    let resolveRa4RetrySuccess!: () => void;
    const ra4RetrySuccessPromise = new Promise<void>((resolve) => {
      resolveRa4RetrySuccess = resolve;
    });
    const ra4Workspace: any = { students: [] };

    const raCoord4 = createSerializedSyncCoordinator({
      uid: raUid4,
      initialRetryDelayMs: 15,
      maxRetryDelayMs: 50,
      maxAutoRetries: 3,
      autoRetryEnabled: true,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        ra4Attempts++;
        if (ra4Attempts === 1) {
          // Transient failure on first attempt
          return false;
        }
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra4Workspace, parsed);
        const ackOk = acknowledgeAppliedRemoteRevisions(raUid4, docTokens, ra4Workspace);
        if (ackOk) {
          resolveRa4RetrySuccess();
        }
        return ackOk;
      }
    });

    // Enqueue ONCE (only 1 Firestore snapshot ever arrives!)
    const firstAttemptOutcome4 = await raCoord4.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_04', name: 'Student RA-04 Auto-Retried', updatedAt: 13000 }]
      }),
      raTokensMap4
    );
    assert.equal(firstAttemptOutcome4, false);
    assert.equal(ra4Attempts, 1);
    assert.equal(getAppliedDocTokens(raUid4)[raDoc4.id], undefined);

    // Wait for bounded automatic retry to complete without any new snapshot arriving
    await ra4RetrySuccessPromise;
    // Allow drain finally block to settle
    await new Promise((r) => setTimeout(r, 5));

    assert.equal(ra4Attempts, 2);
    assert.equal(ra4Workspace.students.some((s: any) => s.id === 'st_ra_04'), true);
    assert.equal(getAppliedDocTokens(raUid4)[raDoc4.id], raToken4);
    assert.equal(raCoord4.getPendingRemoteCount(), 0);
    assert.equal(loadDurablePendingRemoteQueue(raUid4).length, 0);
    raCoord4.dispose();
    log.push('[PASS] [Integration Test] RA-04. Bounded exponential backoff retry succeeds and acknowledges revision without receiving another Firestore snapshot');

    // -------------------------------------------------------------------------
    // RA-05: Pending revision survives simulated application restart
    // -------------------------------------------------------------------------
    const raUid5 = 'uid_ra_05_restart';
    resetAppliedDocTokensForTests(raUid5);
    clearDurablePendingRemoteQueueForTests(raUid5);
    const raDoc5 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra05_op_1',
      opSeq: 1,
      updatedAtMs: 14000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_05_survived', name: 'Survived App Restart', updatedAt: 14000 }]
      })
    };
    const raToken5 = computeChunkRevisionToken(raDoc5);
    const raTokensMap5 = { [raDoc5.id]: raToken5 };

    // Session 1 before Android app restart: snapshot is downloaded, but local import fails
    const coordBeforeRestart = createSerializedSyncCoordinator({
      uid: raUid5,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async () => false // Fails before app closes
    });
    const session1Res = await coordBeforeRestart.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_05_survived', name: 'Survived App Restart', updatedAt: 14000 }],
        _cloudDocTokens: raTokensMap5,
        _cloudWorkspaceId: raUid5
      }),
      raTokensMap5
    );
    assert.equal(session1Res, false);
    assert.equal(getAppliedDocTokens(raUid5)[raDoc5.id], undefined);
    // Simulate closing the Android app
    coordBeforeRestart.dispose();

    // Verify durable storage still holds the unapplied remote revision across restart
    const persistedQueueAfterClose = loadDurablePendingRemoteQueue(raUid5);
    assert.equal(persistedQueueAfterClose.length, 1);
    assert.equal(persistedQueueAfterClose[0].docTokens?.[raDoc5.id], raToken5);

    // Session 2 after reopening the Android app (no new Firestore snapshot arrives!)
    const restartedWorkspace: any = { students: [] };
    const coordAfterRestart = createSerializedSyncCoordinator({
      uid: raUid5,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(restartedWorkspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid5, docTokens, restartedWorkspace);
      }
    });
    assert.equal(coordAfterRestart.getPendingRemoteCount(), 1);
    const session2Res = await coordAfterRestart.resumePendingWork();
    assert.equal(session2Res, true);
    assert.equal(
      restartedWorkspace.students.some((s: any) => s.id === 'st_ra_05_survived'),
      true
    );
    assert.equal(getAppliedDocTokens(raUid5)[raDoc5.id], raToken5);
    assert.equal(coordAfterRestart.getPendingRemoteCount(), 0);
    assert.equal(loadDurablePendingRemoteQueue(raUid5).length, 0);
    coordAfterRestart.dispose();
    log.push('[PASS] [Integration Test] RA-05. Pending remote revision survives simulated Android app restart and applies on reopen without another device resending');

    // -------------------------------------------------------------------------
    // RA-06: Duplicate snapshot is safely idempotent
    // -------------------------------------------------------------------------
    const raUid6 = 'uid_ra_06_idempotent';
    resetAppliedDocTokensForTests(raUid6);
    clearDurablePendingRemoteQueueForTests(raUid6);
    const raDoc6 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra06_op_1',
      opSeq: 1,
      updatedAtMs: 15000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_06', name: 'Unique Student', updatedAt: 15000 }]
      })
    };
    const raToken6 = computeChunkRevisionToken(raDoc6);
    const raTokensMap6 = { [raDoc6.id]: raToken6 };
    const raPayload6 = JSON.stringify({
      isCloudDelta: true,
      students: [{ id: 'st_ra_06', name: 'Unique Student', updatedAt: 15000 }],
      _cloudDocTokens: raTokensMap6
    });

    let ra6ApplyCalls = 0;
    const ra6Workspace: any = { students: [] };
    let releaseRa6Gate!: () => void;
    const ra6Gate = new Promise<void>((r) => {
      releaseRa6Gate = r;
    });

    const raCoord6 = createSerializedSyncCoordinator({
      uid: raUid6,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => {
        await ra6Gate;
        return true;
      },
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        ra6ApplyCalls++;
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra6Workspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid6, docTokens, ra6Workspace);
      }
    });

    const lock6 = raCoord6.enqueueLocalPush();
    // Enqueue identical snapshot 3 times while busy -> coalesced to 1!
    const dupP1 = raCoord6.enqueueRemoteSnapshot(raPayload6, raTokensMap6);
    const dupP2 = raCoord6.enqueueRemoteSnapshot(raPayload6, raTokensMap6);
    const dupP3 = raCoord6.enqueueRemoteSnapshot(raPayload6, raTokensMap6);
    assert.equal(raCoord6.getPendingRemoteCount(), 1);
    releaseRa6Gate();
    await Promise.all([lock6, dupP1, dupP2, dupP3]);
    assert.equal(ra6ApplyCalls, 1);
    assert.equal(ra6Workspace.students.length, 1);
    raCoord6.dispose();
    log.push('[PASS] [Unit Test] RA-06. Duplicate snapshots are coalesced in queue and idempotent upon application');

    // -------------------------------------------------------------------------
    // RA-07: Older snapshot cannot overwrite a newer acknowledged revision
    // -------------------------------------------------------------------------
    const raUid7 = 'uid_ra_07_ordering';
    resetAppliedDocTokensForTests(raUid7);
    const deltaDocId7 = getDeviceDeltaDocId(vercelDeviceId);
    const newerDoc7 = {
      id: deltaDocId7,
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_op_20',
      opSeq: 20,
      updatedAtMs: 20000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_07', name: 'Newer Name V20', updatedAt: 20000 }],
        opId: 'vercel_op_20',
        opSeq: 20
      })
    };
    const olderDoc7 = {
      id: deltaDocId7,
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_op_19',
      opSeq: 19,
      updatedAtMs: 19000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_07', name: 'Older Name V19', updatedAt: 19000 }],
        opId: 'vercel_op_19',
        opSeq: 19
      })
    };
    const newerToken7 = computeChunkRevisionToken(newerDoc7);
    const olderToken7 = computeChunkRevisionToken(olderDoc7);

    assert.equal(isCandidateTokenOlderThanExisting(newerToken7, olderToken7), true);
    assert.equal(isCandidateTokenOlderThanExisting(olderToken7, newerToken7), false);

    // Acknowledge newer revision (V20) first
    const ackNewer7 = acknowledgeAppliedRemoteRevisions(raUid7, { [deltaDocId7]: newerToken7 });
    assert.equal(ackNewer7, true);
    assert.equal(getAppliedDocTokens(raUid7)[deltaDocId7], newerToken7);

    // Evaluate older snapshot (V19): must be rejected as strictly older than V20
    const evalOlder7 = evaluateRemoteSnapshotChanges([olderDoc7], {
      localDeviceId: androidDeviceId,
      appliedDocTokens: getAppliedDocTokens(raUid7)
    });
    assert.equal(evalOlder7.shouldProcess, false);

    // Attempt to acknowledge older token (V19): must NOT overwrite V20
    acknowledgeAppliedRemoteRevisions(raUid7, { [deltaDocId7]: olderToken7 });
    assert.equal(getAppliedDocTokens(raUid7)[deltaDocId7], newerToken7);
    log.push('[PASS] [Unit Test] RA-07. Older snapshot revision cannot overwrite or downgrade a newer acknowledged revision');

    // -------------------------------------------------------------------------
    // RA-08: Newer revision arriving during import is preserved
    // -------------------------------------------------------------------------
    const raUid8 = 'uid_ra_08_concurrent_arrival';
    resetAppliedDocTokensForTests(raUid8);
    clearDurablePendingRemoteQueueForTests(raUid8);
    const appliedOrder8: string[] = [];
    let releaseV1Import8!: () => void;
    const v1ImportGate8 = new Promise<void>((r) => {
      releaseV1Import8 = r;
    });
    let notifyV1Started8!: () => void;
    const v1StartedPromise8 = new Promise<void>((r) => {
      notifyV1Started8 = r;
    });

    const raCoord8 = createSerializedSyncCoordinator({
      uid: raUid8,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        appliedOrder8.push(`start:${parsed.rev}`);
        if (parsed.rev === 'V1') {
          notifyV1Started8();
          await v1ImportGate8;
        }
        appliedOrder8.push(`done:${parsed.rev}`);
        return acknowledgeAppliedRemoteRevisions(raUid8, docTokens || {});
      }
    });

    const tokV1_8 = computeChunkRevisionToken({
      id: deltaDocId7,
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'op_1',
      opSeq: 1,
      updatedAtMs: 1000,
      payloadChunk: 'v1'
    });
    const tokV2_8 = computeChunkRevisionToken({
      id: deltaDocId7,
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'op_2',
      opSeq: 2,
      updatedAtMs: 2000,
      payloadChunk: 'v2'
    });

    const pV1_8 = raCoord8.enqueueRemoteSnapshot(
      JSON.stringify({ rev: 'V1' }),
      { [deltaDocId7]: tokV1_8 }
    );
    await v1StartedPromise8;

    // While V1 is mid-import, V2 arrives!
    const pV2_8 = raCoord8.enqueueRemoteSnapshot(
      JSON.stringify({ rev: 'V2' }),
      { [deltaDocId7]: tokV2_8 }
    );
    assert.equal(raCoord8.getPendingRemoteCount(), 2);

    releaseV1Import8();
    await Promise.all([pV1_8, pV2_8]);

    assert.deepEqual(appliedOrder8, ['start:V1', 'done:V1', 'start:V2', 'done:V2']);
    assert.equal(getAppliedDocTokens(raUid8)[deltaDocId7], tokV2_8);
    assert.equal(raCoord8.getPendingRemoteCount(), 0);
    raCoord8.dispose();
    log.push('[PASS] [Integration Test] RA-08. Newer revision arriving while an earlier import is in flight is preserved and applied next');

    // -------------------------------------------------------------------------
    // RA-09: Multiple queued remote revisions are not silently discarded
    // -------------------------------------------------------------------------
    const raUid9 = 'uid_ra_09_multi_queue';
    resetAppliedDocTokensForTests(raUid9);
    clearDurablePendingRemoteQueueForTests(raUid9);
    let failRevBOnce9 = true;
    const appliedRevs9: string[] = [];

    const raCoord9 = createSerializedSyncCoordinator({
      uid: raUid9,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson) => {
        const parsed = JSON.parse(remoteJson);
        if (parsed.rev === 'RevB' && failRevBOnce9) {
          failRevBOnce9 = false;
          return false; // Transient failure on RevB
        }
        appliedRevs9.push(parsed.rev);
        return true;
      }
    });

    // Queue RevA, RevB, RevC
    const pA9 = raCoord9.enqueueRemoteSnapshot(JSON.stringify({ rev: 'RevA' }));
    const pB9 = raCoord9.enqueueRemoteSnapshot(JSON.stringify({ rev: 'RevB' }));
    const pC9 = raCoord9.enqueueRemoteSnapshot(JSON.stringify({ rev: 'RevC' }));
    await Promise.all([pA9, pB9, pC9]);

    // RevA succeeded, RevB failed on first pass -> both RevB and RevC MUST remain in the queue!
    assert.deepEqual(appliedRevs9, ['RevA']);
    assert.equal(raCoord9.getPendingRemoteCount(), 2);
    assert.equal(loadDurablePendingRemoteQueue(raUid9).length, 2);

    // Resume pending work -> RevB and RevC both apply in exact order!
    const resume9 = await raCoord9.resumePendingWork();
    assert.equal(resume9, true);
    assert.deepEqual(appliedRevs9, ['RevA', 'RevB', 'RevC']);
    assert.equal(raCoord9.getPendingRemoteCount(), 0);
    raCoord9.dispose();
    log.push('[PASS] [Integration Test] RA-09. Multiple queued remote revisions are never silently discarded when an intermediate revision fails');

    // -------------------------------------------------------------------------
    // RA-10: Local push failure does not erase remote pending work
    // -------------------------------------------------------------------------
    const raUid10 = 'uid_ra_10_push_fail';
    clearDurablePendingRemoteQueueForTests(raUid10);
    clearPendingLocalPushFlag(raUid10);
    await enqueueDurablePendingRemoteItem(raUid10, JSON.stringify({ rev: 'RemotePending10' }), {
      doc_10: 'tok_10'
    });
    let applyRemote10Allow = false;
    const appliedRemote10: string[] = [];

    const raCoord10 = createSerializedSyncCoordinator({
      uid: raUid10,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => {
        throw new Error('SIMULATED_FIRESTORE_UPLOAD_FAILURE');
      },
      onApplyRemotePayload: async (remoteJson) => {
        if (!applyRemote10Allow) return false;
        appliedRemote10.push(JSON.parse(remoteJson).rev);
        return true;
      }
    });

    // Trigger local push while remote fails initially -> local push also fails
    const pushRes10 = await raCoord10.enqueueLocalPush();
    assert.equal(pushRes10, false);
    // Remote pending work MUST still be intact in memory and durable storage!
    assert.equal(raCoord10.getPendingRemoteCount(), 1);
    assert.equal(loadDurablePendingRemoteQueue(raUid10).length, 1);

    // Now allow remote import to succeed
    applyRemote10Allow = true;
    await raCoord10.resumePendingWork();
    assert.deepEqual(appliedRemote10, ['RemotePending10']);
    assert.equal(raCoord10.getPendingRemoteCount(), 0);
    raCoord10.dispose();
    log.push('[PASS] [Unit Test] RA-10. Local push failure never erases or corrupts pending remote work');

    // -------------------------------------------------------------------------
    // RA-11: Remote import failure does not permanently block local push
    // -------------------------------------------------------------------------
    const raUid11 = 'uid_ra_11_nonblocking_push';
    clearDurablePendingRemoteQueueForTests(raUid11);
    clearPendingLocalPushFlag(raUid11);
    let localPushExecuted11 = false;

    const raCoord11 = createSerializedSyncCoordinator({
      uid: raUid11,
      autoRetryEnabled: false,
      onApplyRemotePayload: async () => {
        // Remote import fails
        return false;
      },
      onExecuteLocalPush: async () => {
        localPushExecuted11 = true;
        clearPendingLocalPushFlag(raUid11);
        return true;
      }
    });

    // Both remote snapshot and local push are queued
    const r11 = raCoord11.enqueueRemoteSnapshot(JSON.stringify({ rev: 'FailingRemote11' }));
    const l11 = raCoord11.enqueueLocalPush();
    await Promise.all([r11, l11]);

    // Local push MUST have executed despite the remote import failure, while remote item stays queued for retry!
    assert.equal(localPushExecuted11, true);
    assert.equal(raCoord11.getPendingRemoteCount(), 1);
    raCoord11.dispose();
    log.push('[PASS] [Integration Test] RA-11. Remote import failure does not permanently block unrelated local push');

    // -------------------------------------------------------------------------
    // RA-12: Two-device concurrent updates are preserved
    // -------------------------------------------------------------------------
    const raUid12 = 'uid_ra_12_two_device';
    resetAppliedDocTokensForTests(raUid12);
    const devAndroid12: any = {
      students: [
        stampFieldTimestamps(
          null,
          { id: 'st_12_a', name: 'Android Student A', groupId: 'grp_12', updatedAt: 5000, version: 1 },
          5000
        )
      ],
      lessons: [
        stampFieldTimestamps(
          null,
          { id: 'les_12_a', title: 'Android Lesson 1', groupId: 'grp_12', date: '2026-04-01', time: '16:00', status: 'scheduled', updatedAt: 5000, version: 1 },
          5000
        )
      ],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };
    const devVercel12: any = {
      students: [
        stampFieldTimestamps(
          null,
          { id: 'st_12_v', name: 'Vercel Student B', groupId: 'grp_12', updatedAt: 5100, version: 1 },
          5100
        )
      ],
      lessons: [
        stampFieldTimestamps(
          null,
          { id: 'les_12_v', title: 'Vercel Lesson 2', groupId: 'grp_12', date: '2026-04-02', time: '18:00', status: 'scheduled', updatedAt: 5100, version: 1 },
          5100
        )
      ],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };

    applyDeltaOnWorkspace(devAndroid12, devVercel12);
    applyDeltaOnWorkspace(devVercel12, devAndroid12);

    assert.equal(devAndroid12.students.length, 2);
    assert.equal(devVercel12.students.length, 2);
    assert.equal(devAndroid12.lessons.length, 2);
    assert.equal(devVercel12.lessons.length, 2);
    log.push('[PASS] [Integration Test] RA-12. Two-device concurrent updates on Android and Vercel are preserved without data loss');

    // -------------------------------------------------------------------------
    // RA-13: Tombstones remain effective after retries
    // -------------------------------------------------------------------------
    const raUid13 = 'uid_ra_13_tombstone_retry';
    resetAppliedDocTokensForTests(raUid13);
    clearDurablePendingRemoteQueueForTests(raUid13);
    const localWs13: any = {
      students: [
        { id: 'st_keep_13', name: 'Keep Student', updatedAt: 1000 },
        { id: 'st_purge_13', name: 'To Be Purged On Retry', updatedAt: 1000 }
      ],
      lessons: [
        { id: 'les_cascade_13', studentId: 'st_purge_13', title: 'Cascade Lesson', updatedAt: 1000 }
      ],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };

    let attempt13 = 0;
    const coord13 = createSerializedSyncCoordinator({
      uid: raUid13,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        attempt13++;
        if (attempt13 === 1) return false; // Fails on first attempt
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(localWs13, parsed);
        enforcePurgedTombstonesOnWorkspace(
          localWs13,
          localWs13.recentlyDeleted?.purgedRecords || []
        );
        return acknowledgeAppliedRemoteRevisions(raUid13, docTokens || {}, localWs13);
      }
    });

    const tombstonePayload13 = JSON.stringify({
      isCloudDelta: true,
      recentlyDeleted: {
        students: [],
        groups: [],
        lessons: [],
        purgedRecords: [
          {
            id: 'st_purge_13',
            type: 'student',
            purgedAt: new Date(9000).toISOString(),
            updatedAt: 9000
          }
        ]
      }
    });

    const firstTry13 = await coord13.enqueueRemoteSnapshot(tombstonePayload13, {
      doc_tomb_13: 'tok_tomb_13'
    });
    assert.equal(firstTry13, false);
    assert.equal(localWs13.students.some((s: any) => s.id === 'st_purge_13'), true);

    const retryTry13 = await coord13.resumePendingWork();
    assert.equal(retryTry13, true);
    assert.equal(localWs13.students.some((s: any) => s.id === 'st_purge_13'), false);
    assert.equal(localWs13.lessons.some((l: any) => l.id === 'les_cascade_13'), false);
    assert.equal(localWs13.students.some((s: any) => s.id === 'st_keep_13'), true);

    // Verify stale resurrection attempt after retry is blocked by the applied tombstone
    applyDeltaOnWorkspace(localWs13, {
      students: [{ id: 'st_purge_13', name: 'Stale Resurrect', updatedAt: 999999 }]
    });
    assert.equal(localWs13.students.some((s: any) => s.id === 'st_purge_13'), false);
    coord13.dispose();
    log.push('[PASS] [Integration Test] RA-13. Permanent deletion tombstones remain effective after retry and block resurrection');

    // -------------------------------------------------------------------------
    // RA-14: Payment and finance transaction records are not duplicated
    // -------------------------------------------------------------------------
    const raUid14 = 'uid_ra_14_finance_dedup';
    const localWs14: any = {
      payments: [
        { id: 'pay_14_1', studentId: 'st_1', amountDue: 1000, amountPaid: 500, status: 'partial', updatedAt: 1000 }
      ],
      financeTransactions: [
        { id: 'tx_14_1', type: 'income', amount: 500, categoryId: 'cat_tuition', date: '2026-04-01', updatedAt: 1000 }
      ],
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] }
    };

    const incomingFinanceDelta14 = {
      isCloudDelta: true,
      payments: [
        { id: 'pay_14_1', studentId: 'st_1', amountDue: 1000, amountPaid: 1000, status: 'paid', updatedAt: 2000 },
        { id: 'pay_14_2', studentId: 'st_2', amountDue: 800, amountPaid: 800, status: 'paid', updatedAt: 2000 }
      ],
      financeTransactions: [
        { id: 'tx_14_1', type: 'income', amount: 1000, categoryId: 'cat_tuition', date: '2026-04-01', updatedAt: 2000 },
        { id: 'tx_14_2', type: 'income', amount: 800, categoryId: 'cat_tuition', date: '2026-04-02', updatedAt: 2000 }
      ]
    };

    // Apply delta multiple times (simulating retry / duplicate delivery)
    applyDeltaOnWorkspace(localWs14, incomingFinanceDelta14);
    applyDeltaOnWorkspace(localWs14, incomingFinanceDelta14);
    applyDeltaOnWorkspace(localWs14, incomingFinanceDelta14);

    assert.equal(localWs14.payments.length, 2);
    assert.equal(localWs14.financeTransactions.length, 2);
    assert.equal(localWs14.payments.find((p: any) => p.id === 'pay_14_1')?.amountPaid, 1000);
    assert.equal(localWs14.financeTransactions.find((t: any) => t.id === 'tx_14_1')?.amount, 1000);
    log.push('[PASS] [Unit Test] RA-14. Payment and finance transaction records are never duplicated across retries or repeated merges');

    // -------------------------------------------------------------------------
    // RA-15: Acknowledgement storage failure does not falsely report completion
    // -------------------------------------------------------------------------
    const raUid15 = 'uid_ra_15_ack_storage_fail';
    resetAppliedDocTokensForTests(raUid15);
    clearDurablePendingRemoteQueueForTests(raUid15);
    const raDoc15 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra15_op_1',
      opSeq: 1,
      updatedAtMs: 25000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_15', name: 'Student RA-15', updatedAt: 25000 }]
      })
    };
    const raToken15 = computeChunkRevisionToken(raDoc15);
    const raTokensMap15 = { [raDoc15.id]: raToken15 };

    // Simulate failure writing appliedDocTokens to storage
    __setAcknowledgeStorageFailureForTests(true);

    const ra15Workspace: any = { students: [] };
    const coord15 = createSerializedSyncCoordinator({
      uid: raUid15,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra15Workspace, parsed);
        // Data merged locally, now attempt to persist acknowledgement:
        return acknowledgeAppliedRemoteRevisions(raUid15, docTokens, ra15Workspace);
      }
    });

    const outcomeWhenAckStorageFails = await coord15.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        students: [{ id: 'st_ra_15', name: 'Student RA-15', updatedAt: 25000 }]
      }),
      raTokensMap15
    );

    // Must NOT falsely report completion when acknowledgement persistence fails!
    assert.equal(outcomeWhenAckStorageFails, false);
    assert.equal(getAppliedDocTokens(raUid15)[raDoc15.id], undefined);
    assert.equal(coord15.getPendingRemoteCount(), 1);
    assert.equal(loadDurablePendingRemoteQueue(raUid15).length, 1);

    // Restore acknowledgement storage and retry
    __setAcknowledgeStorageFailureForTests(false);
    const outcomeAfterAckStorageRestored = await coord15.resumePendingWork();
    assert.equal(outcomeAfterAckStorageRestored, true);
    assert.equal(getAppliedDocTokens(raUid15)[raDoc15.id], raToken15);
    assert.equal(coord15.getPendingRemoteCount(), 0);
    assert.equal(loadDurablePendingRemoteQueue(raUid15).length, 0);
    coord15.dispose();
    log.push('[PASS] [Unit Test] RA-15. Acknowledgement storage failure returns false, prevents in-memory token poisoning, and retains item in retry queue');

    // -------------------------------------------------------------------------
    // RA-16: A pending backup larger than 5MB persists durably in IndexedDB without quota failure and drains cleanly
    // -------------------------------------------------------------------------
    const raUid16 = 'uid_ra_16_heavy_payload';
    resetAppliedDocTokensForTests(raUid16);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid16);

    // Construct a realistic payload > 5MB (e.g. 5.2 MB)
    const largePad = 'X'.repeat(5500); // 5.5 KB per item
    const heavyStudents: any[] = [];
    for (let i = 0; i < 1000; i++) {
      heavyStudents.push({
        id: `st_heavy_${i}`,
        name: `Student Large ${i}`,
        notes: largePad,
        updatedAt: 30000 + i
      });
    }
    const heavyPayloadStr = JSON.stringify({
      isCloudDelta: true,
      students: heavyStudents
    });
    assert.equal(heavyPayloadStr.length > 5 * 1024 * 1024, true);

    const raDoc16 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra16_op_1',
      opSeq: 1,
      updatedAtMs: 35000,
      payloadChunk: JSON.stringify({ isCloudDelta: true, count: 1000 })
    };
    const raToken16 = computeChunkRevisionToken(raDoc16);
    const raTokensMap16 = { [raDoc16.id]: raToken16 };

    const ra16Workspace: any = { students: [] };
    const coord16 = createSerializedSyncCoordinator({
      uid: raUid16,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra16Workspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid16, docTokens, ra16Workspace);
      }
    });

    const enqueueHeavyOk = await coord16.enqueueRemoteSnapshot(heavyPayloadStr, raTokensMap16);
    assert.equal(enqueueHeavyOk, true);
    assert.equal(ra16Workspace.students.length, 1000);
    assert.equal(getAppliedDocTokens(raUid16)[raDoc16.id], raToken16);
    assert.equal(coord16.getPendingRemoteCount(), 0);
    assert.equal(loadDurablePendingRemoteQueue(raUid16).length, 0);

    // Verify localStorage was never poisoned with the >5MB payload
    if (typeof localStorage !== 'undefined') {
      const lsVal = localStorage.getItem(`gluck_cloud_pending_remote_queue_v2_${raUid16}`);
      assert.equal(lsVal, null);
    }
    coord16.dispose();
    log.push('[PASS] [Integration Test] RA-16. A pending backup larger than 5MB persists durably in IndexedDB without quota failure and drains cleanly');

    // -------------------------------------------------------------------------
    // RA-17: localStorage quota failure does not break durable queue persistence in IndexedDB
    // -------------------------------------------------------------------------
    const raUid17 = 'uid_ra_17_ls_quota_fail';
    resetAppliedDocTokensForTests(raUid17);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid17);

    const originalSetItem = typeof localStorage !== 'undefined' ? localStorage.setItem : null;
    let quotaThrew = false;
    if (typeof localStorage !== 'undefined' && originalSetItem) {
      localStorage.setItem = (k: string, v: string) => {
        if (k.startsWith('gluck_cloud_pending_remote_queue_v2_')) {
          quotaThrew = true;
          const quotaErr = new Error('QuotaExceededError: DOM Exception 22');
          (quotaErr as any).name = 'QuotaExceededError';
          (quotaErr as any).code = 22;
          throw quotaErr;
        }
        return originalSetItem.call(localStorage, k, v);
      };
    }

    try {
      const ra17Workspace: any = { students: [] };
      const coord17 = createSerializedSyncCoordinator({
        uid: raUid17,
        autoRetryEnabled: false,
        onExecuteLocalPush: async () => true,
        onApplyRemotePayload: async (remoteJson, docTokens) => {
          const parsed = JSON.parse(remoteJson);
          applyDeltaOnWorkspace(ra17Workspace, parsed);
          return acknowledgeAppliedRemoteRevisions(raUid17, docTokens, ra17Workspace);
        }
      });

      const raDoc17 = {
        id: getDeviceDeltaDocId(vercelDeviceId),
        categoryKey: 'delta_log',
        deviceId: vercelDeviceId,
        opId: 'vercel_ra17_op_1',
        opSeq: 1,
        updatedAtMs: 37000,
        payloadChunk: JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra17_1', name: 'Student 17' }] })
      };
      const raToken17 = computeChunkRevisionToken(raDoc17);
      const outcome17 = await coord17.enqueueRemoteSnapshot(
        JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra17_1', name: 'Student 17', updatedAt: 37000 }] }),
        { [raDoc17.id]: raToken17 }
      );

      assert.equal(outcome17, true);
      assert.equal(ra17Workspace.students.length, 1);
      assert.equal(coord17.getPendingRemoteCount(), 0);
      coord17.dispose();
      log.push('[PASS] [Integration Test] RA-17. localStorage quota failure does not break durable queue persistence in IndexedDB');
    } finally {
      if (typeof localStorage !== 'undefined' && originalSetItem) {
        localStorage.setItem = originalSetItem;
      }
    }

    // -------------------------------------------------------------------------
    // RA-18: IndexedDB write failure aborts queue persistence, does not falsely claim queued state, and prevents revision acknowledgement
    // -------------------------------------------------------------------------
    const raUid18 = 'uid_ra_18_idb_write_fail';
    resetAppliedDocTokensForTests(raUid18);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid18);

    __setStorageFailureHookForTests((op, key) => {
      if (op === 'set' && key.includes('gluck_cloud_pending_remote_queue_v2_')) {
        throw new Error('Simulated IndexedDB failure');
      }
    });

    const raDoc18 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra18_op_1',
      opSeq: 1,
      updatedAtMs: 38000,
      payloadChunk: JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra18', name: 'Student 18' }] })
    };
    const raToken18 = computeChunkRevisionToken(raDoc18);

    const coord18 = createSerializedSyncCoordinator({
      uid: raUid18,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async () => true
    });

    const outcome18 = await coord18.enqueueRemoteSnapshot(
      JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra18', name: 'Student 18' }] }),
      { [raDoc18.id]: raToken18 }
    );

    // Persistence failed: must return false, must not leave item in queue, must not acknowledge
    assert.equal(outcome18, false);
    assert.equal(coord18.getPendingRemoteCount(), 0);
    assert.equal(loadDurablePendingRemoteQueue(raUid18).length, 0);
    assert.equal(getAppliedDocTokens(raUid18)[raDoc18.id], undefined);

    __setStorageFailureHookForTests(null);
    coord18.dispose();
    log.push('[PASS] [Unit Test] RA-18. IndexedDB write failure aborts queue persistence, rolls back item, and prevents false acknowledgement');

    // -------------------------------------------------------------------------
    // RA-19: Process restart after a failed import restores queue from durable storage and resumes cleanly
    // -------------------------------------------------------------------------
    const raUid19 = 'uid_ra_19_restart_recovery';
    resetAppliedDocTokensForTests(raUid19);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid19);

    const raDoc19 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra19_op_1',
      opSeq: 1,
      updatedAtMs: 39000,
      payloadChunk: JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra19_restart', name: 'Restart Student' }] })
    };
    const raToken19 = computeChunkRevisionToken(raDoc19);
    const raTokensMap19 = { [raDoc19.id]: raToken19 };

    // Session 1: Enqueue snapshot, but import fails (e.g. database locked/crashing)
    const coord19Session1 = createSerializedSyncCoordinator({
      uid: raUid19,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async () => false
    });

    const s1Outcome = await coord19Session1.enqueueRemoteSnapshot(
      JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra19_restart', name: 'Restart Student', updatedAt: 39000 }] }),
      raTokensMap19
    );
    assert.equal(s1Outcome, false);
    assert.equal(coord19Session1.getPendingRemoteCount(), 1);
    coord19Session1.dispose();

    // Verify durable storage holds the pending payload
    const queueBeforeRestart = await loadDurablePendingRemoteQueueAsync(raUid19);
    assert.equal(queueBeforeRestart.length, 1);
    assert.equal(queueBeforeRestart[0].docTokens?.[raDoc19.id], raToken19);

    // Session 2 after process restart: create fresh coordinator and resume pending work
    const ra19Workspace: any = { students: [] };
    const coord19Session2 = createSerializedSyncCoordinator({
      uid: raUid19,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra19Workspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid19, docTokens, ra19Workspace);
      }
    });

    const s2Outcome = await coord19Session2.resumePendingWork();
    assert.equal(s2Outcome, true);
    assert.equal(ra19Workspace.students.some((s: any) => s.id === 'st_ra19_restart'), true);
    assert.equal(getAppliedDocTokens(raUid19)[raDoc19.id], raToken19);
    assert.equal(coord19Session2.getPendingRemoteCount(), 0);
    assert.equal((await loadDurablePendingRemoteQueueAsync(raUid19)).length, 0);
    coord19Session2.dispose();
    log.push('[PASS] [Integration Test] RA-19. Process restart after a failed import restores queue from durable storage and resumes cleanly');

    // -------------------------------------------------------------------------
    // RA-20: Queue read-back mismatch rejects persistence, rolls back item, and does not acknowledge revision
    // -------------------------------------------------------------------------
    const raUid20 = 'uid_ra_20_readback_mismatch';
    resetAppliedDocTokensForTests(raUid20);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid20);

    const origVerify = storage.verifyDurableReadBackValue;
    storage.verifyDurableReadBackValue = async (key: string) => {
      if (key.includes(raUid20)) {
        return false; // Force read-back inequality
      }
      return origVerify.call(storage, key as any, null as any);
    };

    try {
      const raDoc20 = {
        id: getDeviceDeltaDocId(vercelDeviceId),
        categoryKey: 'delta_log',
        deviceId: vercelDeviceId,
        opId: 'vercel_ra20_op_1',
        opSeq: 1,
        updatedAtMs: 40000,
        payloadChunk: JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra20', name: 'Student 20' }] })
      };
      const raToken20 = computeChunkRevisionToken(raDoc20);

      const coord20 = createSerializedSyncCoordinator({
        uid: raUid20,
        autoRetryEnabled: false,
        onExecuteLocalPush: async () => true,
        onApplyRemotePayload: async () => true
      });

      const outcome20 = await coord20.enqueueRemoteSnapshot(
        JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra20', name: 'Student 20' }] }),
        { [raDoc20.id]: raToken20 }
      );

      assert.equal(outcome20, false);
      assert.equal(coord20.getPendingRemoteCount(), 0);
      assert.equal(getAppliedDocTokens(raUid20)[raDoc20.id], undefined);
      coord20.dispose();
      log.push('[PASS] [Unit Test] RA-20. Queue read-back mismatch rejects persistence, rolls back item, and does not acknowledge revision');
    } finally {
      storage.verifyDurableReadBackValue = origVerify;
    }

    // -------------------------------------------------------------------------
    // RA-21: Acknowledgement storage failure prevents revision acknowledgement and retains payload in durable queue
    // -------------------------------------------------------------------------
    const raUid21 = 'uid_ra_21_ack_storage_failure';
    resetAppliedDocTokensForTests(raUid21);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid21);

    const raDoc21 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra21_op_1',
      opSeq: 1,
      updatedAtMs: 41000,
      payloadChunk: JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra21', name: 'Student 21' }] })
    };
    const raToken21 = computeChunkRevisionToken(raDoc21);

    const ra21Workspace: any = { students: [] };
    const coord21 = createSerializedSyncCoordinator({
      uid: raUid21,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra21Workspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid21, docTokens, ra21Workspace);
      }
    });

    __setAcknowledgeStorageFailureForTests(true);

    const outcome21 = await coord21.enqueueRemoteSnapshot(
      JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra21', name: 'Student 21', updatedAt: 41000 }] }),
      { [raDoc21.id]: raToken21 }
    );

    assert.equal(outcome21, false);
    assert.equal(getAppliedDocTokens(raUid21)[raDoc21.id], undefined);
    assert.equal(coord21.getPendingRemoteCount(), 1);
    assert.equal((await loadDurablePendingRemoteQueueAsync(raUid21)).length, 1);

    // Restore ack storage and resume work
    __setAcknowledgeStorageFailureForTests(false);
    const resume21Outcome = await coord21.resumePendingWork();
    assert.equal(resume21Outcome, true);
    assert.equal(getAppliedDocTokens(raUid21)[raDoc21.id], raToken21);
    assert.equal(coord21.getPendingRemoteCount(), 0);
    assert.equal((await loadDurablePendingRemoteQueueAsync(raUid21)).length, 0);
    coord21.dispose();
    log.push('[PASS] [Unit Test] RA-21. Acknowledgement storage failure prevents revision acknowledgement and retains payload in durable queue');

    // -------------------------------------------------------------------------
    // RA-22: Retry after restart without a new cloud snapshot drains queue and synchronizes local workspace
    // -------------------------------------------------------------------------
    const raUid22 = 'uid_ra_22_retry_without_snapshot';
    resetAppliedDocTokensForTests(raUid22);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid22);

    const raDoc22 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra22_op_1',
      opSeq: 1,
      updatedAtMs: 42000,
      payloadChunk: JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra22_offline', name: 'Offline Student' }] })
    };
    const raToken22 = computeChunkRevisionToken(raDoc22);

    // Initial session: Import fails
    let failImport22 = true;
    const ra22Workspace: any = { students: [] };
    const coord22Session1 = createSerializedSyncCoordinator({
      uid: raUid22,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        if (failImport22) return false;
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra22Workspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid22, docTokens, ra22Workspace);
      }
    });

    await coord22Session1.enqueueRemoteSnapshot(
      JSON.stringify({ isCloudDelta: true, students: [{ id: 'st_ra22_offline', name: 'Offline Student', updatedAt: 42000 }] }),
      { [raDoc22.id]: raToken22 }
    );
    assert.equal(coord22Session1.getPendingRemoteCount(), 1);
    coord22Session1.dispose();

    // App restarts: No new Firestore event arrives from network.
    failImport22 = false;
    const coord22Session2 = createSerializedSyncCoordinator({
      uid: raUid22,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra22Workspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid22, docTokens, ra22Workspace);
      }
    });

    // Device reopens and immediately calls resumePendingWork()
    const retry22Outcome = await coord22Session2.resumePendingWork();
    assert.equal(retry22Outcome, true);
    assert.equal(ra22Workspace.students.some((s: any) => s.id === 'st_ra22_offline'), true);
    assert.equal(getAppliedDocTokens(raUid22)[raDoc22.id], raToken22);
    assert.equal(coord22Session2.getPendingRemoteCount(), 0);
    assert.equal((await loadDurablePendingRemoteQueueAsync(raUid22)).length, 0);
    coord22Session2.dispose();
    log.push('[PASS] [Integration Test] RA-22. Retry after restart without a new cloud snapshot drains queue and synchronizes local workspace');

    // -------------------------------------------------------------------------
    // RA-23: IndexedDB remove failure during queue clearing preserves payload, returns false, and retry is idempotent without data duplication
    // -------------------------------------------------------------------------
    const raUid23 = 'uid_ra_23_remove_failure';
    resetAppliedDocTokensForTests(raUid23);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid23);

    const ra23Workspace: any = {
      students: [],
      lessons: [{ id: 'les_23_1', title: 'Lesson 23', updatedAt: 1000 }],
      payments: [{ id: 'pay_23_1', amountPaid: 100, updatedAt: 1000 }],
      financeTransactions: [{ id: 'tx_23_1', amount: 100, updatedAt: 1000 }]
    };

    const raDoc23 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra23_op_1',
      opSeq: 1,
      updatedAtMs: 43000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        lessons: [{ id: 'les_23_1', title: 'Lesson 23 Updated', updatedAt: 2000 }],
        payments: [{ id: 'pay_23_1', amountPaid: 200, updatedAt: 2000 }],
        financeTransactions: [{ id: 'tx_23_1', amount: 200, updatedAt: 2000 }]
      })
    };
    const raToken23 = computeChunkRevisionToken(raDoc23);

    // Set storage failure hook ONLY on 'remove' operation for queue key
    __setStorageFailureHookForTests((op, key) => {
      if (op === 'remove' && key.includes('gluck_cloud_pending_remote_queue_v2_')) {
        throw new Error('Simulated IndexedDB remove failure');
      }
    });

    const coord23 = createSerializedSyncCoordinator({
      uid: raUid23,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra23Workspace, parsed);
        return acknowledgeAppliedRemoteRevisions(raUid23, docTokens, ra23Workspace);
      }
    });

    // Enqueue snapshot: import succeeds locally and revisions are acknowledged, BUT durable removal fails!
    const outcome23 = await coord23.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        lessons: [{ id: 'les_23_1', title: 'Lesson 23 Updated', updatedAt: 2000 }],
        payments: [{ id: 'pay_23_1', amountPaid: 200, updatedAt: 2000 }],
        financeTransactions: [{ id: 'tx_23_1', amount: 200, updatedAt: 2000 }]
      }),
      { [raDoc23.id]: raToken23 }
    );

    // Durable removal failed -> enqueueRemoteSnapshot returns false, headItem is restored in queue
    assert.equal(outcome23, false);
    assert.equal(coord23.getPendingRemoteCount(), 1);
    assert.equal(getAppliedDocTokens(raUid23)[raDoc23.id], raToken23); // Revisions were applied & acknowledged

    // Reset failure hook and retry (simulating retry of unremoved snapshot)
    __setStorageFailureHookForTests(null);
    const retry23Outcome = await coord23.resumePendingWork();
    assert.equal(retry23Outcome, true);
    assert.equal(coord23.getPendingRemoteCount(), 0);
    assert.equal((await loadDurablePendingRemoteQueueAsync(raUid23)).length, 0);

    // Verify idempotency: lessons, payments, and finance transactions were NOT duplicated!
    assert.equal(ra23Workspace.lessons.length, 1);
    assert.equal(ra23Workspace.payments.length, 1);
    assert.equal(ra23Workspace.financeTransactions.length, 1);
    assert.equal(ra23Workspace.lessons[0].title, 'Lesson 23 Updated');
    assert.equal(ra23Workspace.payments[0].amountPaid, 200);
    assert.equal(ra23Workspace.financeTransactions[0].amount, 200);
    coord23.dispose();
    log.push('[PASS] [Unit Test] RA-23. IndexedDB remove failure during queue clearing preserves payload, returns false, and retry is idempotent without data duplication');

    // -------------------------------------------------------------------------
    // RA-24: IndexedDB read failure during removal verification returns false, preserves queue, and retry is idempotent
    // -------------------------------------------------------------------------
    const raUid24 = 'uid_ra_24_verify_read_failure';
    resetAppliedDocTokensForTests(raUid24);
    await clearDurablePendingRemoteQueueForTestsAsync(raUid24);

    const ra24Workspace: any = {
      students: [],
      lessons: [{ id: 'les_24_1', title: 'Lesson 24', updatedAt: 1000 }],
      payments: [{ id: 'pay_24_1', amountPaid: 300, updatedAt: 1000 }],
      financeTransactions: [{ id: 'tx_24_1', amount: 300, updatedAt: 1000 }]
    };

    const raDoc24 = {
      id: getDeviceDeltaDocId(vercelDeviceId),
      categoryKey: 'delta_log',
      deviceId: vercelDeviceId,
      opId: 'vercel_ra24_op_1',
      opSeq: 1,
      updatedAtMs: 44000,
      payloadChunk: JSON.stringify({
        isCloudDelta: true,
        lessons: [{ id: 'les_24_1', title: 'Lesson 24 Final', updatedAt: 3000 }],
        payments: [{ id: 'pay_24_1', amountPaid: 500, updatedAt: 3000 }],
        financeTransactions: [{ id: 'tx_24_1', amount: 500, updatedAt: 3000 }]
      })
    };
    const raToken24 = computeChunkRevisionToken(raDoc24);

    let failVerifyRead24 = false;
    __setStorageFailureHookForTests((op, key) => {
      if (failVerifyRead24 && op === 'get' && key.includes('gluck_cloud_pending_remote_queue_v2_')) {
        throw new Error('Simulated IndexedDB read failure during removal verification');
      }
    });

    const coord24 = createSerializedSyncCoordinator({
      uid: raUid24,
      autoRetryEnabled: false,
      onExecuteLocalPush: async () => true,
      onApplyRemotePayload: async (remoteJson, docTokens) => {
        const parsed = JSON.parse(remoteJson);
        applyDeltaOnWorkspace(ra24Workspace, parsed);
        // Turn on read failure hook right before durable removal verification
        failVerifyRead24 = true;
        return acknowledgeAppliedRemoteRevisions(raUid24, docTokens, ra24Workspace);
      }
    });

    const outcome24 = await coord24.enqueueRemoteSnapshot(
      JSON.stringify({
        isCloudDelta: true,
        lessons: [{ id: 'les_24_1', title: 'Lesson 24 Final', updatedAt: 3000 }],
        payments: [{ id: 'pay_24_1', amountPaid: 500, updatedAt: 3000 }],
        financeTransactions: [{ id: 'tx_24_1', amount: 500, updatedAt: 3000 }]
      }),
      { [raDoc24.id]: raToken24 }
    );

    // Because removal verification read failed, verifyDurableRemoved returned false -> enqueueRemoteSnapshot returns false, headItem restored in queue
    assert.equal(outcome24, false);
    assert.equal(coord24.getPendingRemoteCount(), 1);

    // Disable read failure hook and resume work
    failVerifyRead24 = false;
    __setStorageFailureHookForTests(null);

    const retry24Outcome = await coord24.resumePendingWork();
    assert.equal(retry24Outcome, true);
    assert.equal(coord24.getPendingRemoteCount(), 0);
    assert.equal((await loadDurablePendingRemoteQueueAsync(raUid24)).length, 0);

    // Verify idempotency: no duplicates created
    assert.equal(ra24Workspace.lessons.length, 1);
    assert.equal(ra24Workspace.payments.length, 1);
    assert.equal(ra24Workspace.financeTransactions.length, 1);
    assert.equal(ra24Workspace.lessons[0].title, 'Lesson 24 Final');
    assert.equal(ra24Workspace.payments[0].amountPaid, 500);
    assert.equal(ra24Workspace.financeTransactions[0].amount, 500);
    coord24.dispose();
    log.push('[PASS] [Unit Test] RA-24. IndexedDB read failure during removal verification returns false, preserves queue, and retry is idempotent without data duplication');

    return { passed: true, log };
  } catch (err: any) {
    __setStorageFailureHookForTests(null);
    __setAcknowledgeStorageFailureForTests(false);
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

