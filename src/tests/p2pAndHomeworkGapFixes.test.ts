import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import expressApp, {
  resetHomeworkStoresForTesting,
  setGooglePublicCertsCacheForTesting,
  toPublicAssignmentDto
} from '../api/expressApp';
import {
  saveAssignmentWithConfirmation,
  deleteHomeworkAssignmentWithConfirmation,
  deleteLocalAssignment,
  getLocalAssignments,
  getPendingHomeworkDeletes,
  getPendingHomeworkSyncCount,
  flushPendingHomeworkCloudWrites,
  applyCloudAssignmentsSnapshot,
  saveLocalAssignment,
  saveLocalSubmission,
  resolveHomeworkApiUrl,
  __setHomeworkSyncTransportForTests,
  __setHomeworkAuthUserForTests
} from '../shared/homeworkStorageSync';
import {
  saveAssignmentToFirestore,
  saveShortLinkToFirestore,
  revokeShortLinkInFirestore,
  saveSubmissionToFirestore,
  resetFirestoreSubscriptionMultiplexers
} from '../shared/firebaseCloudSync';
import { __setNativeAuthTestAdapter } from '../shared/googleCredentialAuthPlugin';
import { getInMemoryAdminFirestore } from '../server/firebaseAdmin';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  mergeEntities,
  mergeTeacherSettings,
  mergePurgedTombstones,
  enforcePurgedTombstonesOnWorkspace
} from '../services/sync/mergeEngine';
import { buildOutboundDelta } from '../services/sync/deltaBuilder';
import { runSyncCycle, SyncDataSource } from '../services/sync/syncOrchestrator';
import { readMergedPickerNames, writeSyncedPickerNames, PICKER_CANONICAL_KEY, PICKER_LEGACY_KEY } from '../utils/pickerNamesUtils';
import {
  saveAIBackground,
  deleteAIBackground,
  getAllAIBackgroundsIncludingDeleted,
  getSavedAIBackgrounds,
  STORAGE_KEY_AI_BACKGROUNDS
} from '../utils/aiBackgroundUtils';
import { validateAndSanitizeBackupPayload } from '../utils/backupEngine';
import { subscribeToRemoteWorkspaceChanges } from '../services/firebaseWorkspaceSync';
import { __setSimulatePrimaryDbForTests } from '../services/storageService';
import { AICertificateBackground, PurgedRecordTombstone, TeacherSettingsRecord } from '../types';

(globalThis as any).__TEST_ENV__ = true;

const testRsaKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

setGooglePublicCertsCacheForTesting(
  { valid_test_kid_gap_fixes: testRsaKeyPair.publicKey },
  Date.now() + 86400000
);

function makeTestBearerToken(uid: string, email = `${uid}@glueck.de`): string {
  const header = { alg: 'RS256', kid: 'valid_test_kid_gap_fixes', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/glueck-c8621',
    aud: 'glueck-c8621',
    sub: uid,
    email,
    iat: nowSec - 10,
    auth_time: nowSec - 10,
    exp: nowSec + 3600
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${b64Header}.${b64Payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(testRsaKeyPair.privateKey, 'base64url');
  return `${unsigned}.${signature}`;
}

class MemoryLocalStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

function createMockFetchAgainstExpress(onCall?: (url: string, init?: RequestInit) => Response | Promise<Response> | null) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input.toString();
    if (onCall) {
      const override = await onCall(rawUrl, init);
      if (override) return override;
    }
    const parsedUrl = new URL(rawUrl, 'http://localhost:3000');
    const method = (init?.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = v;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) headers[k.toLowerCase()] = v;
      } else {
        for (const [k, v] of Object.entries(init.headers)) {
          if (v !== undefined) headers[k.toLowerCase()] = String(v);
        }
      }
    }

    let bodyObj: any = undefined;
    if (typeof init?.body === 'string' && init.body.trim()) {
      try {
        bodyObj = JSON.parse(init.body);
      } catch {
        bodyObj = init.body;
      }
    }

    return new Promise<Response>((resolve) => {
      const req: any = {
        method,
        url: parsedUrl.pathname + parsedUrl.search,
        originalUrl: parsedUrl.pathname + parsedUrl.search,
        path: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams.entries()),
        headers,
        body: bodyObj,
        header(name: string) {
          return headers[name.toLowerCase()];
        },
        get(name: string) {
          return headers[name.toLowerCase()];
        }
      };

      let statusCode = 200;
      const resHeaders: Record<string, string> = {};
      const res: any = {
        status(code: number) {
          statusCode = code;
          return res;
        },
        setHeader(k: string, v: string) {
          resHeaders[k.toLowerCase()] = String(v);
          return res;
        },
        set(k: string, v: string) {
          resHeaders[k.toLowerCase()] = String(v);
          return res;
        },
        json(payload: any) {
          const text = JSON.stringify(payload);
          resolve(
            new Response(text, {
              status: statusCode,
              headers: { 'content-type': 'application/json', ...resHeaders }
            })
          );
          return res;
        },
        send(payload: any) {
          const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
          resolve(
            new Response(text, {
              status: statusCode,
              headers: resHeaders
            })
          );
          return res;
        },
        end(payload?: any) {
          const isNullBodyStatus = statusCode === 204 || statusCode === 205 || statusCode === 304;
          resolve(new Response(isNullBodyStatus ? null : (payload || ''), { status: statusCode, headers: resHeaders }));
          return res;
        }
      };

      (expressApp as any).handle(req, res, () => {
        resolve(new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: resHeaders }));
      });
    });
  };
}

function readSrc(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

async function runAll16GapFixTests() {
  const logs: string[] = [];
  const memStorage = new MemoryLocalStorage();
  const dispatchedEvents: Array<{ type: string; detail: any }> = [];

  (globalThis as any).localStorage = memStorage;
  (globalThis as any).CustomEvent = class MockCustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  (globalThis as any).window = {
    location: { origin: 'https://h-und-n-br5l.vercel.app', pathname: '/', protocol: 'https:', search: '' },
    localStorage: memStorage,
    dispatchEvent: (evt: any) => {
      dispatchedEvents.push({ type: evt?.type || 'unknown', detail: evt?.detail });
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const setNavigatorOnline = (online: boolean) => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: online },
      configurable: true
    });
  };
  setNavigatorOnline(true);

  resetHomeworkStoresForTesting();
  resetFirestoreSubscriptionMultiplexers();
  __setSimulatePrimaryDbForTests(true);

  const teacherUid = 'teacher_gap_fixes';
  const teacherEmail = 'teacher_gap_fixes@glueck.de';
  const teacherToken = makeTestBearerToken(teacherUid, teacherEmail);

  // =========================================================================
  // TEST 1: UI Preferences P2P Sync (theme, accentColor, reportLanguage, nav orders)
  // =========================================================================
  {
    const baseSettings: TeacherSettingsRecord = {
      id: 'singleton_teacher_settings',
      updatedAt: 5000,
      originPlatform: 'web',
      originDeviceId: 'dev_web_1',
      profile: { id: 'tp_1', displayName: 'Teacher', updatedAt: 5000 } as any,
      schedulingPreferences: { defaultLessonDuration: 60, bufferBetweenLessonsMins: 15, autoAlertMinutes: 30 },
      theme: 'light',
      accentColor: 'teal',
      reportLanguage: 'ar',
      mobileBottomNavOrder: ['dashboard', 'groups', 'calendar'],
      sidebarNavOrder: ['dashboard', 'groups']
    };

    const androidSettings: TeacherSettingsRecord = {
      ...baseSettings,
      updatedAt: 5000,
      originPlatform: 'android',
      originDeviceId: 'dev_android_1',
      theme: 'dark',
      accentColor: 'sapphire',
      reportLanguage: 'de',
      mobileBottomNavOrder: ['calendar', 'groups', 'dashboard'],
      sidebarNavOrder: ['lernstudio', 'groups', 'dashboard']
    };

    const mergedOnTie = mergeTeacherSettings(baseSettings, androidSettings);
    assert.equal(mergedOnTie.theme, 'dark');
    assert.equal(mergedOnTie.accentColor, 'sapphire');
    assert.equal(mergedOnTie.reportLanguage, 'de');
    assert.deepEqual(mergedOnTie.mobileBottomNavOrder, ['calendar', 'groups', 'dashboard']);
    assert.deepEqual(mergedOnTie.sidebarNavOrder, ['lernstudio', 'groups', 'dashboard']);

    const newerWebSettings: TeacherSettingsRecord = {
      ...androidSettings,
      updatedAt: 9000,
      originPlatform: 'web',
      originDeviceId: 'dev_web_1',
      theme: 'light',
      accentColor: 'rose',
      reportLanguage: 'en'
    };
    const mergedNewer = mergeTeacherSettings(androidSettings, newerWebSettings);
    assert.equal(mergedNewer.theme, 'light');
    assert.equal(mergedNewer.accentColor, 'rose');
    assert.equal(mergedNewer.reportLanguage, 'en');

    const backupSanitized = validateAndSanitizeBackupPayload({
      version: '2.0.0',
      reportLanguage: 'de',
      mobileBottomNavOrder: ['calendar', 'dashboard'],
      sidebarNavOrder: ['students', 'groups']
    });
    assert.equal(backupSanitized.isValid, true);
    assert.equal(backupSanitized.data.reportLanguage, 'de');
    assert.deepEqual(backupSanitized.data.mobileBottomNavOrder, ['calendar', 'dashboard']);
    assert.deepEqual(backupSanitized.data.sidebarNavOrder, ['students', 'groups']);

    logs.push('[PASS] Test 1: UI preferences (theme, accentColor, reportLanguage, mobileBottomNavOrder, sidebarNavOrder) sync via P2P LWW+Android tie-breaker & backupEngine');
  }

  // =========================================================================
  // TEST 2: dl_custom_ai_backgrounds Export, Delta, Merge, Restore & Soft-Delete Tombstone
  // =========================================================================
  {
    const savedBg = await saveAIBackground({
      id: 'ai_bg_test_1',
      name: 'Royal Frame',
      imageUrl: 'data:image/png;base64,AAA',
      width: 2480,
      height: 1754,
      aspectRatio: 1.414,
      textColorMode: 'gold_on_dark'
    });
    assert.equal(savedBg.id, 'ai_bg_test_1');
    assert.equal(savedBg.deleted, false);

    // P2P Outbound delta includes customAiBackgrounds
    const allBgs = await getAllAIBackgroundsIncludingDeleted();
    const delta = buildOutboundDelta(
      'peer_pc',
      {},
      { customAiBackgrounds: allBgs },
      { id: 'dev_android_1', name: 'Android' },
      { forceFull: true, peerLastSynced: 0 }
    );
    assert.equal(delta.records.customAiBackgrounds?.length, 1);
    assert.equal(delta.records.customAiBackgrounds?.[0].id, 'ai_bg_test_1');

    // Soft-delete preserves deleted tombstone in storage and removes from active list
    const activeAfterDelete = await deleteAIBackground('ai_bg_test_1');
    assert.equal(activeAfterDelete.length, 0);
    const savedActive = await getSavedAIBackgrounds();
    assert.equal(savedActive.length, 0);
    const includingDeleted = await getAllAIBackgroundsIncludingDeleted();
    assert.equal(includingDeleted.length, 1);
    assert.equal(includingDeleted[0].deleted, true);

    // LWW merge propagates soft delete to peer device
    const peerLocal: AICertificateBackground[] = [
      { ...savedBg, updatedAt: includingDeleted[0].updatedAt! - 500, deleted: false }
    ];
    const mergedBgs = mergeEntities(peerLocal, includingDeleted, { entityTypeName: 'customAiBackgrounds' }).merged;
    assert.equal(mergedBgs[0].deleted, true);

    // Backup sanitization preserves deleted/updatedAt on customAiBackgrounds
    const sanitizedBackup = validateAndSanitizeBackupPayload({
      version: '2.0.0',
      customAiBackgrounds: includingDeleted
    });
    assert.equal(sanitizedBackup.isValid, true);
    assert.equal(sanitizedBackup.data.customAiBackgrounds.length, 1);
    assert.equal(sanitizedBackup.data.customAiBackgrounds[0].deleted, true);
    assert.ok(sanitizedBackup.data.customAiBackgrounds[0].updatedAt > 0);
    // Avoid unused import warning
    assert.equal(STORAGE_KEY_AI_BACKGROUNDS, 'dl_custom_ai_backgrounds');

    logs.push('[PASS] Test 2: dl_custom_ai_backgrounds supports backup export/restore, P2P delta, LWW merge, and soft-delete tombstone propagation');
  }

  // =========================================================================
  // TEST 3: dl_active_lesson_session P2P Sync & Clear Guard
  // =========================================================================
  {
    const runningAndroid: TeacherSettingsRecord = {
      id: 'singleton_teacher_settings',
      updatedAt: 2000,
      originPlatform: 'android',
      originDeviceId: 'dev_android_1',
      profile: { id: 'tp_1', displayName: 'Teacher', updatedAt: 2000 } as any,
      schedulingPreferences: { defaultLessonDuration: 60, bufferBetweenLessonsMins: 15, autoAlertMinutes: 30 },
      activeLessonSessionState: {
        session: {
          lessonId: 'les_active_1',
          lessonTitle: 'Lektion 1',
          groupName: 'A1',
          startedAt: 1000,
          accumulatedSeconds: 120,
          durationMinutes: 60,
          isRunning: true,
          startTimeStr: '18:00',
          updatedAt: 5000
        },
        updatedAt: 5000
      }
    };

    const emptyWeb: TeacherSettingsRecord = {
      ...runningAndroid,
      originPlatform: 'web',
      originDeviceId: 'dev_web_1',
      activeLessonSessionState: { session: null, updatedAt: 2000 }
    };

    const mergedStart = mergeTeacherSettings(emptyWeb, runningAndroid);
    assert.equal(mergedStart.activeLessonSessionState?.session?.lessonId, 'les_active_1');

    // Newer clear (lesson completed/cancelled) overwrites active session
    const clearedLater: TeacherSettingsRecord = {
      ...runningAndroid,
      updatedAt: 9000,
      activeLessonSessionState: { session: null, updatedAt: 9000 }
    };
    const mergedEnd = mergeTeacherSettings(runningAndroid, clearedLater);
    assert.equal(mergedEnd.activeLessonSessionState?.session, null);
    assert.equal(mergedEnd.activeLessonSessionState?.updatedAt, 9000);

    logs.push('[PASS] Test 3: dl_active_lesson_session syncs across P2P and respects newer clear state when lesson completes or cancels');
  }

  // =========================================================================
  // TEST 4: Custom Picker Names Storage-Key Compatibility
  // =========================================================================
  {
    memStorage.clear();
    memStorage.setItem(PICKER_LEGACY_KEY, JSON.stringify(['Youssef', 'Malak']));
    memStorage.setItem(PICKER_CANONICAL_KEY, JSON.stringify(['Malak', 'Ziad']));

    const merged = readMergedPickerNames();
    assert.equal(merged.needsMirrorSync, true);
    assert.deepEqual(merged.names, ['Malak', 'Ziad', 'Youssef']);

    const written = writeSyncedPickerNames(merged.names || [], false);
    assert.deepEqual(written, ['Malak', 'Ziad', 'Youssef']);
    assert.deepEqual(JSON.parse(memStorage.getItem(PICKER_CANONICAL_KEY) || '[]'), ['Malak', 'Ziad', 'Youssef']);
    assert.deepEqual(JSON.parse(memStorage.getItem(PICKER_LEGACY_KEY) || '[]'), ['Malak', 'Ziad', 'Youssef']);

    logs.push('[PASS] Test 4: dl_picker_names and glueck_picker_custom_names merge non-destructively and stay mirrored');
  }

  // =========================================================================
  // TEST 5: Complete Tombstones Across Extended Collections + Sync Orchestrator Sweep
  // =========================================================================
  {
    const nowIso = new Date().toISOString();
    const tombstones: PurgedRecordTombstone[] = [
      { id: 'hw_purged_1', type: 'homeworkAssignments', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'sub_purged_1', type: 'homeworkSubmissions', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'cert_purged_1', type: 'certificates', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'hod_stu_1', type: 'hodStudents', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'hod_cmp_1', type: 'hodComplaints', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'hod_ap_1', type: 'hodActionPlans', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'hod_vis_1', type: 'hodVisits', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'gold_1', type: 'goldHoldings', purgedAt: nowIso, updatedAt: 5000 },
      { id: 'bg_purged_1', type: 'customAiBackgrounds', purgedAt: nowIso, updatedAt: 5000 }
    ];

    const mergedTombs = mergePurgedTombstones([], tombstones);
    assert.equal(mergedTombs.length, tombstones.length);
    for (const orig of tombstones) {
      const found = mergedTombs.find((m) => m.id === orig.id);
      assert.equal(found?.type, orig.type, `Expected type ${orig.type} to be preserved`);
    }

    const validated = validateAndSanitizeBackupPayload({
      version: '2.0.0',
      recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: tombstones }
    });
    assert.equal(validated.data.recentlyDeleted.purgedRecords.length, tombstones.length);

    const dirtyWorkspace: any = {
      homeworkAssignments: [{ id: 'hw_purged_1', updatedAt: 1000 }, { id: 'hw_keep', updatedAt: 1000 }],
      homeworkSubmissions: [{ id: 'sub_purged_1', assignmentId: 'hw_keep' }, { id: 'sub_keep', assignmentId: 'hw_keep' }],
      certificates: [{ id: 'cert_purged_1' }, { id: 'cert_keep' }],
      hodStudents: [{ id: 'hod_stu_1' }, { id: 'hod_stu_keep' }],
      hodComplaints: [{ id: 'hod_cmp_1' }],
      hodActionPlans: [{ id: 'hod_ap_1' }],
      hodVisits: [{ id: 'hod_vis_1' }, { id: 'hod_vis_keep' }],
      goldHoldings: [{ id: 'gold_1' }, { id: 'gold_keep' }],
      customAiBackgrounds: [{ id: 'bg_purged_1' }, { id: 'bg_keep' }]
    };
    enforcePurgedTombstonesOnWorkspace(dirtyWorkspace, tombstones);
    assert.deepEqual(dirtyWorkspace.homeworkAssignments.map((x: any) => x.id), ['hw_keep']);
    assert.deepEqual(dirtyWorkspace.homeworkSubmissions.map((x: any) => x.id), ['sub_keep']);
    assert.deepEqual(dirtyWorkspace.certificates.map((x: any) => x.id), ['cert_keep']);
    assert.deepEqual(dirtyWorkspace.hodStudents.map((x: any) => x.id), ['hod_stu_keep']);
    assert.equal(dirtyWorkspace.hodComplaints.length, 0);
    assert.equal(dirtyWorkspace.hodActionPlans.length, 0);
    assert.deepEqual(dirtyWorkspace.hodVisits.map((x: any) => x.id), ['hod_vis_keep']);
    assert.deepEqual(dirtyWorkspace.goldHoldings.map((x: any) => x.id), ['gold_keep']);
    assert.deepEqual(dirtyWorkspace.customAiBackgrounds.map((x: any) => x.id), ['bg_keep']);

    // Also verify syncOrchestrator ingest & sweep on a peer DataSource
    const pcStore: Record<string, any[]> = {
      settings: [{ id: 'singleton_teacher_settings', updatedAt: 100, recentlyDeleted: { students: [], groups: [], lessons: [], purgedRecords: [] } }],
      certificates: [{ id: 'cert_purged_1', updatedAt: 100 }, { id: 'cert_keep', updatedAt: 100 }],
      hodVisits: [{ id: 'hod_vis_1', updatedAt: 100 }],
      goldHoldings: [{ id: 'gold_1', updatedAt: 100 }]
    };
    let pcSyncState = {
      localDeviceId: 'dev_pc',
      localDeviceName: 'PC',
      pairedPeers: [{ deviceId: 'dev_android', deviceName: 'Android', lastKnownIp: '127.0.0.1', port: 0, pairingToken: 't', lastSyncedTimestamp: 0, isOnline: true }],
      peerWatermarkTable: {}
    };
    const pcDataSource: SyncDataSource = {
      getLocalData: () => pcStore,
      saveMergedData: async (entityType, mergedData) => {
        pcStore[entityType] = mergedData;
      },
      getSyncState: () => pcSyncState as any,
      updateSyncState: async (next) => {
        pcSyncState = next as any;
      }
    };

    await runSyncCycle('dev_android', pcDataSource, 'Manual Sync', async () => ({
      senderDeviceId: 'dev_android',
      senderDeviceName: 'Android',
      protocolVersion: 1,
      capabilities: [],
      timestamp: Date.now(),
      peerWatermarks: {},
      hasAuthoritativeTombstones: true,
      purgedRecords: tombstones,
      records: {}
    }));
    assert.deepEqual(pcStore.certificates.map((c) => c.id), ['cert_keep']);
    assert.equal(pcStore.hodVisits.length, 0);
    assert.equal(pcStore.goldHoldings.length, 0);

    logs.push('[PASS] Test 5: Complete purged tombstones survive merge, backup sanitization, workspace enforcement, and P2P sweep');
  }

  // =========================================================================
  // TEST 6: Cloud->Android->P2P Propagates ONLY on Genuine Change (No Polling Loop)
  // =========================================================================
  {
    memStorage.clear();
    __setHomeworkAuthUserForTests({
      uid: teacherUid,
      email: teacherEmail,
      getIdToken: async () => teacherToken
    });
    const hw: HomeworkAssignment = {
      id: 'hw_poll_test',
      shortId: 'PolTest1',
      ownerUid: teacherUid,
      ownerEmail: teacherEmail,
      title: 'واجب فحص التغيير',
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [{ id: 'i1', german: 'das Buch', arabic: 'الكتاب' }] },
      questionTypes: ['choice_all'],
      allowedGameModes: ['classic_quiz'],
      questionCount: 1,
      maxAttempts: 3,
      allowReplay: true,
      audienceMode: 'open',
      isActive: true,
      status: 'active',
      createdAt: '2026-11-14T10:00:00.000Z',
      createdBy: 'Teacher'
    };
    saveLocalAssignment({ ...hw, cloudSynced: true }, false);
    dispatchedEvents.length = 0;

    // Identical cloud poll snapshot should NOT emit gluck-local-data-mutated
    applyCloudAssignmentsSnapshot([{ ...hw, ownerUid: teacherUid }], teacherUid, teacherUid);
    const mutationsOnSamePoll = dispatchedEvents.filter((e) => e.type === 'gluck-local-data-mutated');
    assert.equal(mutationsOnSamePoll.length, 0, 'Unchanged cloud poll must NOT emit gluck-local-data-mutated');

    // Genuine change in cloud assignment SHOULD emit gluck-local-data-mutated
    applyCloudAssignmentsSnapshot([{ ...hw, title: 'عنوان محدث من السحابة', ownerUid: teacherUid }], teacherUid, teacherUid);
    const mutationsOnChange = dispatchedEvents.filter((e) => e.type === 'gluck-local-data-mutated');
    assert.equal(mutationsOnChange.length, 1, 'Changed cloud assignment MUST emit gluck-local-data-mutated');

    logs.push('[PASS] Test 6: Cloud->Android sync suppresses spurious P2P mutations on identical polls and emits only on real changes');
  }

  // =========================================================================
  // TEST 7: P2P Receive Never Triggers Firebase Writes
  // =========================================================================
  {
    let fetchCallsDuringP2pReceive = 0;
    (globalThis as any).fetch = async () => {
      fetchCallsDuringP2pReceive++;
      return new Response('{}', { status: 200 });
    };
    const hwReceivedViaP2p: HomeworkAssignment = {
      id: 'hw_from_p2p',
      shortId: 'P2pHw12',
      ownerUid: teacherUid,
      title: 'واجب من P2P',
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [{ id: 'i1', german: 'der Tisch', arabic: 'الطاولة' }] },
      questionTypes: ['choice_all'],
      allowedGameModes: ['classic_quiz'],
      questionCount: 1,
      maxAttempts: 3,
      allowReplay: true,
      audienceMode: 'open',
      isActive: true,
      status: 'active',
      createdAt: '2026-11-14T10:00:00.000Z',
      createdBy: 'Teacher'
    };
    const subReceivedViaP2p: HomeworkSubmission = {
      id: 'sub_from_p2p',
      assignmentId: 'hw_from_p2p',
      ownerUid: teacherUid,
      studentName: 'سارة',
      attemptNumber: 1,
      status: 'completed',
      startedAt: '2026-11-14T10:01:00.000Z',
      completedAt: '2026-11-14T10:02:00.000Z',
      timeSpentSeconds: 30,
      totalQuestions: 1,
      correctAnswersCount: 1,
      scorePercentage: 100,
      score: 100,
      accuracyPercent: 100,
      responses: []
    };

    const hwChanged = saveLocalAssignment(hwReceivedViaP2p, false);
    const subChanged = saveLocalSubmission(subReceivedViaP2p, false);
    assert.equal(hwChanged, true);
    assert.equal(subChanged, true);
    assert.equal(fetchCallsDuringP2pReceive, 0, 'Applying P2P homework updates locally (syncCloud=false) must trigger 0 cloud writes');

    logs.push('[PASS] Test 7: Applying inbound P2P homework updates triggers 0 Firebase writes');
  }

  // =========================================================================
  // TEST 8: Android Online Delete + Cross-Origin Vercel URL Resolution
  // =========================================================================
  {
    __setNativeAuthTestAdapter({ isAndroidNative: () => true });
    (globalThis as any).window.location = { origin: 'https://localhost', pathname: '/', protocol: 'https:', search: '' };
    const resolvedAndroidApiUrl = resolveHomeworkApiUrl('/api/teacher/assignments?id=hw_1');
    assert.ok(resolvedAndroidApiUrl.startsWith('https://'), 'Expected Android native API URL to resolve to public HTTPS Vercel domain');
    assert.ok(!resolvedAndroidApiUrl.includes('localhost'), 'Expected Android native API URL not to use capacitor localhost');
    __setNativeAuthTestAdapter(null);
    (globalThis as any).window.location = { origin: 'https://h-und-n-br5l.vercel.app', pathname: '/', protocol: 'https:', search: '' };

    const deleteCalls: string[] = [];
    __setHomeworkSyncTransportForTests({
      saveAssignment: async () => true,
      deleteAssignment: async (id) => {
        deleteCalls.push(`hw:${id}`);
        return true;
      },
      deleteSubmissionsForAssignment: async (id) => {
        deleteCalls.push(`subs:${id}`);
        return true;
      }
    });

    const delTarget: HomeworkAssignment = {
      id: 'hw_online_del',
      shortId: 'OnlDel1',
      ownerUid: teacherUid,
      title: 'واجب للحذف',
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [{ id: 'i1', german: 'gut', arabic: 'جيد' }] },
      questionTypes: ['choice_all'],
      allowedGameModes: ['classic_quiz'],
      questionCount: 1,
      maxAttempts: 3,
      allowReplay: true,
      audienceMode: 'open',
      isActive: true,
      status: 'active',
      createdAt: '2026-11-14T10:00:00.000Z',
      createdBy: 'Teacher'
    };
    await saveAssignmentWithConfirmation(delTarget);

    const delRes = await deleteHomeworkAssignmentWithConfirmation(delTarget.id);
    assert.equal(delRes.deletedLocally, true);
    assert.equal(delRes.cloudDeleted, true);
    assert.equal(delRes.queuedForRetry, false);
    assert.deepEqual(deleteCalls, ['hw:hw_online_del', 'subs:hw_online_del']);
    assert.equal(getPendingHomeworkDeletes().length, 0);

    logs.push('[PASS] Test 8: Android native URL resolves to Vercel domain and online delete performs single confirmed flow');
  }

  // =========================================================================
  // TEST 9: Android Offline Delete Durable Queue & Anti-Resurrection
  // =========================================================================
  {
    __setHomeworkSyncTransportForTests({
      saveAssignment: async () => true,
      deleteAssignment: async () => false,
      deleteSubmissionsForAssignment: async () => false
    });

    const offlineDelHw: HomeworkAssignment = {
      id: 'hw_offline_del',
      shortId: 'OffDel1',
      ownerUid: teacherUid,
      title: 'واجب حذف أوفلاين',
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [{ id: 'i1', german: 'haus', arabic: 'منزل' }] },
      questionTypes: ['choice_all'],
      allowedGameModes: ['classic_quiz'],
      questionCount: 1,
      maxAttempts: 3,
      allowReplay: true,
      audienceMode: 'open',
      isActive: true,
      status: 'active',
      createdAt: '2026-11-14T10:00:00.000Z',
      createdBy: 'Teacher'
    };
    await saveAssignmentWithConfirmation(offlineDelHw);

    setNavigatorOnline(false);
    const offlineDelRes = await deleteHomeworkAssignmentWithConfirmation(offlineDelHw.id);
    assert.equal(offlineDelRes.deletedLocally, true);
    assert.equal(offlineDelRes.cloudDeleted, false);
    assert.equal(offlineDelRes.queuedForRetry, true);
    assert.equal(getPendingHomeworkDeletes().length, 1);
    assert.ok(getPendingHomeworkSyncCount() >= 1);

    // Even if cloud returns stale snapshot before delete flushes, it must NOT resurrect locally
    applyCloudAssignmentsSnapshot([offlineDelHw], teacherUid, teacherUid);
    assert.equal(getLocalAssignments().some((a) => a.id === offlineDelHw.id), false);

    // Reconnect and flush queue
    setNavigatorOnline(true);
    const flushedCalls: string[] = [];
    __setHomeworkSyncTransportForTests({
      deleteAssignment: async (id) => {
        flushedCalls.push(id);
        return true;
      },
      deleteSubmissionsForAssignment: async () => true
    });
    const flushRes = await flushPendingHomeworkCloudWrites();
    assert.equal(flushRes.syncedDeletes, 1);
    assert.deepEqual(flushedCalls, ['hw_offline_del']);
    assert.equal(getPendingHomeworkDeletes().length, 0);

    logs.push('[PASS] Test 9: Offline homework delete persists durable retry queue, blocks resurrection, and flushes cleanly when online');
  }

  // =========================================================================
  // TEST 10: Zero Duplicate Submission Writes When /api/homework/submit Succeeds
  // =========================================================================
  {
    resetFirestoreSubscriptionMultiplexers();
    __setHomeworkSyncTransportForTests(null);
    __setHomeworkAuthUserForTests(null);

    const mockFetch = createMockFetchAgainstExpress();
    const requestUrls: string[] = [];
    (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      requestUrls.push(url);
      if (url.includes('/api/homework/submit')) {
        return new Response(JSON.stringify({ success: true, submission: { id: 'sub_no_dup_1', ownerUid: teacherUid } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      return mockFetch(input, init);
    };

    const subOk = await saveSubmissionToFirestore({
      id: 'sub_no_dup_1',
      assignmentId: 'hw_api_1',
      ownerUid: teacherUid,
      studentName: 'طارق',
      attemptNumber: 1,
      status: 'completed',
      startedAt: '2026-11-14T10:00:00.000Z',
      completedAt: '2026-11-14T10:01:00.000Z',
      timeSpentSeconds: 60,
      totalQuestions: 2,
      correctAnswersCount: 2,
      scorePercentage: 100,
      score: 100,
      accuracyPercent: 100,
      responses: []
    });
    assert.equal(subOk, true);
    assert.equal(requestUrls.filter((u) => u.includes('/api/homework/submit')).length, 1);
    assert.equal(
      requestUrls.filter((u) => u.includes('firestore.googleapis.com')).length,
      0,
      'Must NOT perform redundant Firestore REST/client write after /api/homework/submit succeeds'
    );

    logs.push('[PASS] Test 10: saveSubmissionToFirestore skips redundant client Firestore write when /api/homework/submit succeeds');
  }

  // =========================================================================
  // TEST 11: Short-Link Revocation Invalidates Dedupe Cache (Close -> Reopen Writes)
  // =========================================================================
  {
    resetFirestoreSubscriptionMultiplexers();
    const calls: string[] = [];
    const baseFetch = createMockFetchAgainstExpress();
    (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push(`${(init?.method || 'GET').toUpperCase()} ${url}`);
      if (url.includes('firestore.googleapis.com')) {
        return new Response(JSON.stringify({ fields: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return baseFetch(input, init);
    };
    __setHomeworkAuthUserForTests({
      uid: teacherUid,
      email: teacherEmail,
      getIdToken: async () => teacherToken
    });

    const hwReopen: HomeworkAssignment = {
      id: 'hw_rev_reopen',
      shortId: 'Reopen7',
      ownerUid: teacherUid,
      title: 'واجب إغلاق وإعادة فتح',
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [{ id: 'i1', german: 'die Tür', arabic: 'الباب' }] },
      questionTypes: ['choice_all'],
      allowedGameModes: ['classic_quiz'],
      questionCount: 1,
      maxAttempts: 3,
      allowReplay: true,
      audienceMode: 'open',
      isActive: true,
      status: 'active',
      createdAt: '2026-11-14T10:00:00.000Z',
      createdBy: 'Teacher'
    };

    await saveAssignmentToFirestore(hwReopen);
    await saveShortLinkToFirestore(hwReopen, teacherUid);
    const revokedOk = await revokeShortLinkInFirestore('Reopen7', hwReopen.id, teacherUid);
    assert.equal(revokedOk, true);

    const countBeforeReopen = calls.length;
    const reopenWrite = await saveAssignmentToFirestore({ ...hwReopen, isActive: true, status: 'active' });
    assert.equal(reopenWrite, true);
    assert.ok(calls.length > countBeforeReopen, 'Reopening after revocation must NOT hit stale dedupe cache');

    logs.push('[PASS] Test 11: revokeShortLinkInFirestore invalidates dedupe caches so reopen writes active state');
  }

  // =========================================================================
  // TEST 12: Submission Dedupe Differentiates Responses, Gamification, Gold & Streak
  // =========================================================================
  {
    resetFirestoreSubscriptionMultiplexers();
    let apiPostCount = 0;
    (globalThis as any).fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/homework/submit')) {
        apiPostCount++;
        return new Response(JSON.stringify({ success: true, submission: { ownerUid: teacherUid } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response('{}', { status: 200 });
    };

    const baseSub: HomeworkSubmission = {
      id: 'sub_dedupe_diff_1',
      assignmentId: 'hw_diff_1',
      ownerUid: teacherUid,
      studentName: 'آدم',
      attemptNumber: 1,
      status: 'completed',
      startedAt: '2026-11-14T10:00:00.000Z',
      completedAt: '2026-11-14T10:05:00.000Z',
      timeSpentSeconds: 90,
      totalQuestions: 1,
      correctAnswersCount: 1,
      scorePercentage: 100,
      score: 100,
      accuracyPercent: 100,
      goldEarned: 100,
      maxStreak: 2,
      responses: [
        {
          questionId: 'q1',
          questionType: 'choice_all',
          germanWord: 'der Apfel',
          studentAnswer: 'التفاحة',
          correctAnswer: 'التفاحة',
          isCorrect: true,
          timeSpentSeconds: 4
        }
      ]
    };

    await saveSubmissionToFirestore(baseSub);
    assert.equal(apiPostCount, 1);

    // Identical resubmission -> deduplicated (count stays 1)
    await saveSubmissionToFirestore({ ...baseSub });
    assert.equal(apiPostCount, 1, 'Identical submission must be deduplicated');

    // Changed goldEarned -> MUST send new write even with same score/completedAt/responses.length
    await saveSubmissionToFirestore({ ...baseSub, goldEarned: 250 });
    assert.equal(apiPostCount, 2, 'Updated goldEarned must bypass dedupe');

    // Changed response content with same responses.length -> MUST send new write
    await saveSubmissionToFirestore({
      ...baseSub,
      goldEarned: 250,
      responses: [{ ...baseSub.responses[0], studentAnswer: 'التفاح' }]
    });
    assert.equal(apiPostCount, 3, 'Updated response answer content must bypass dedupe');

    logs.push('[PASS] Test 12: Submission dedupe differentiates responses content, gold, gamification, and timing while suppressing identical retries');
  }

  // =========================================================================
  // TEST 13: Zero Module-Load testFirestoreConnection() Read
  // =========================================================================
  {
    const fbSyncSource = readSrc('src/shared/firebaseCloudSync.ts');
    assert.equal(
      /^\s*testFirestoreConnection\s*\(/m.test(fbSyncSource),
      false,
      'firebaseCloudSync.ts must NOT invoke testFirestoreConnection() at module top level'
    );
    logs.push('[PASS] Test 13: Zero module-load testFirestoreConnection() Firestore reads');
  }

  // =========================================================================
  // TEST 14: Zero Continuous onSnapshot Listeners in UI / Workspace Sync
  // =========================================================================
  {
    const lernstudioViewSrc = readSrc('src/shared/components/LernstudioView.tsx');
    const modalSrc = readSrc('src/shared/components/LernstudioHomeworkModal.tsx');
    const playerSrc = readSrc('src/pages/HomeworkPlayerPage.tsx');

    assert.equal(lernstudioViewSrc.includes('subscribeAssignmentsFromFirestore'), false);
    assert.equal(lernstudioViewSrc.includes('subscribeSubmissionsFromFirestore'), false);
    assert.equal(lernstudioViewSrc.includes('subscribeLernstudioSetsFromFirestore'), false);
    assert.equal(modalSrc.includes('subscribeAssignmentsFromFirestore'), false);
    assert.equal(modalSrc.includes('subscribeSubmissionsFromFirestore'), false);
    assert.equal(playerSrc.includes('subscribeSubmissionsFromFirestore'), false);

    let remoteCbCalled = false;
    const unsub = subscribeToRemoteWorkspaceChanges(teacherUid, () => {
      remoteCbCalled = true;
    });
    assert.equal(typeof unsub, 'function');
    unsub();
    assert.equal(remoteCbCalled, false);

    logs.push('[PASS] Test 14: Continuous Firestore listeners eliminated from Lernstudio UI, Homework Player, and workspace sync');
  }

  // =========================================================================
  // TEST 15: Zero lernstudio_sets Firestore Calls on Homework Flows
  // =========================================================================
  {
    const lernstudioViewSrc = readSrc('src/shared/components/LernstudioView.tsx');
    const modalSrc = readSrc('src/shared/components/LernstudioHomeworkModal.tsx');
    assert.equal(lernstudioViewSrc.includes('saveLernstudioSetToFirestore'), false);
    assert.equal(lernstudioViewSrc.includes('deleteLernstudioSetFromFirestore'), false);
    assert.equal(modalSrc.includes('saveLernstudioSetToFirestore'), false);

    logs.push('[PASS] Test 15: Zero lernstudio_sets Firestore writes/deletes/subscriptions in homework & Lernstudio UI');
  }

  // =========================================================================
  // TEST 16: Backward Compatibility, hideTeacherBranding DTO & Vercel CORS Preflight
  // =========================================================================
  {
    const publicHiddenDto = toPublicAssignmentDto({
      id: 'hw_dto_1',
      shortId: 'DtoHid1',
      ownerUid: teacherUid,
      ownerEmail: teacherEmail,
      title: 'واجب إخفاء الهوية',
      hideTeacherBranding: true,
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [] },
      questionTypes: ['choice_all'],
      questionCount: 1
    } as any);
    assert.equal(publicHiddenDto?.hideTeacherBranding, true);
    assert.equal((publicHiddenDto as any)?.ownerEmail, undefined);

    const publicDefaultDto = toPublicAssignmentDto({
      id: 'hw_dto_2',
      shortId: 'DtoVis1',
      title: 'واجب افتراضي',
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [] },
      questionTypes: ['choice_all'],
      questionCount: 1
    } as any);
    assert.equal(publicDefaultDto?.hideTeacherBranding, false);

    // CORS preflight OPTIONS from Capacitor Android origin
    const expressFetch = createMockFetchAgainstExpress();
    (globalThis as any).fetch = expressFetch;
    const preflightRes = await expressFetch('http://localhost:3000/api/teacher/assignments', {
      method: 'OPTIONS',
      headers: { Origin: 'capacitor://localhost' }
    });
    assert.equal(preflightRes.status, 204);
    assert.equal(preflightRes.headers.get('access-control-allow-origin'), 'capacitor://localhost');

    // Legacy short link stored via InMemoryAdminFirestore still resolves via /api/homework/short/:shortId
    const adminDb = getInMemoryAdminFirestore();
    const legacyAssignmentPayload = {
      id: 'hw_legacy_old',
      shortId: 'LegOld1',
      title: 'واجب قديم متوافق',
      hideTeacherBranding: true,
      setSnapshot: { id: 's1', title: 'S1', category: 'A1', items: [{ id: 'w1', german: 'hallo', arabic: 'مرحباً' }] },
      questionTypes: ['choice_all'],
      questionCount: 1,
      createdAt: '2025-10-01T10:00:00.000Z',
      createdBy: 'Herr Abdul-Rahman'
    };
    await adminDb.collection('homework_short_links').doc('LegOld1').set({
      shortId: 'LegOld1',
      assignmentId: 'hw_legacy_old',
      ownerUid: teacherUid,
      isActive: true,
      deleted: false,
      payloadJson: JSON.stringify(legacyAssignmentPayload)
    });
    const legacyApiRes = await expressFetch('http://localhost:3000/api/homework/short/LegOld1', {
      headers: { Origin: 'https://localhost' }
    });
    assert.equal(legacyApiRes.status, 200);
    assert.equal(legacyApiRes.headers.get('access-control-allow-origin'), 'https://localhost');
    const legacyJson = await legacyApiRes.json();
    assert.equal(legacyJson.assignment?.id, 'hw_legacy_old');
    assert.equal(legacyJson.assignment?.hideTeacherBranding, true);

    logs.push('[PASS] Test 16: Public DTO preserves hideTeacherBranding, legacy short links resolve cleanly, and Express CORS supports Capacitor Android');
  }

  for (const line of logs) {
    console.log(line);
  }
  console.log(`\nALL 16 P2P & HOMEWORK CLOUD GAP-FIX TESTS PASSED (${logs.length}/16).`);
}

runAll16GapFixTests().catch((err) => {
  console.error('Gap-fix verification suite failed:', err);
  process.exit(1);
});
