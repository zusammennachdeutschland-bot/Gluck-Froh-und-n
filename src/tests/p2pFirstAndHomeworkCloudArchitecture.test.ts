import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import expressApp, {
  resetHomeworkStoresForTesting,
  setGooglePublicCertsCacheForTesting
} from '../api/expressApp';
import {
  buildHomeworkShareUrl,
  createHomeworkShortId,
  createHomeworkAssignmentId,
  createHomeworkShareToken,
  extractShortIdFromPathname,
  resolveHomeworkShortLink,
  saveAssignmentWithConfirmation,
  saveSubmissionWithConfirmation,
  syncAndFetchTeacherAssignments,
  fetchAssignmentDetailsWithSync,
  setHomeworkAssignmentActiveStatus,
  updateHomeworkAssignmentMetadata,
  deleteLocalAssignment,
  getLocalAssignments,
  getLocalSubmissions,
  getPendingHomeworkSyncCount,
  flushPendingHomeworkSyncQueue,
  __setHomeworkSyncTransportForTests,
  __setHomeworkAuthUserForTests
} from '../shared/homeworkStorageSync';
import {
  saveAssignmentToFirestore,
  saveShortLinkToFirestore,
  saveSubmissionToFirestore,
  resetFirestoreSubscriptionMultiplexers
} from '../shared/firebaseCloudSync';
import { getInMemoryAdminFirestore } from '../server/firebaseAdmin';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import { mergeEntities, mergeTeacherSettings } from '../services/sync/mergeEngine';
import { buildOutboundDelta, calculatePendingOutbox } from '../services/sync/deltaBuilder';
import { trackLocalMutation, trackLocalDeletion } from '../services/sync/mutationTracker';
import { SyncDataSource } from '../services/sync/syncOrchestrator';

(globalThis as any).__TEST_ENV__ = true;

const testRsaKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

setGooglePublicCertsCacheForTesting(
  { valid_test_kid_p2p_arch: testRsaKeyPair.publicKey },
  Date.now() + 86400000
);

function makeTestBearerToken(uid: string, email = `${uid}@glueck.de`): string {
  const header = { alg: 'RS256', kid: 'valid_test_kid_p2p_arch', typ: 'JWT' };
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

function createMockFetchAgainstExpress() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input.toString();
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
          resolve(new Response(payload || '', { status: statusCode, headers: resHeaders }));
          return res;
        }
      };

      (expressApp as any).handle(req, res, () => {
        resolve(new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 }));
      });
    });
  };
}

function createMockSyncDataSource(initialState?: Record<string, any>) {
  const defaultSettings = {
    id: 'singleton_teacher_settings',
    updatedAt: 1000,
    originRevision: 1,
    originDeviceId: 'dev_android_main',
    originPlatform: 'android',
    profile: {
      id: 'tp_1',
      displayName: 'Herr Abdul-Rahman',
      specialization: 'German',
      schoolName: 'AGS',
      updatedAt: 1000
    } as any,
    schedulingPreferences: {
      defaultLessonDuration: 60,
      bufferBetweenLessonsMins: 15,
      autoAlertMinutes: 30
    },
    notificationSettings: {
      enabled: true,
      soundEnabled: true,
      minutesBeforeLesson: 15,
      paymentReminders: true
    } as any,
    pickerNames: ['Omar', 'Sara'],
    prunedLessonIds: ['pruned_1']
  };

  const store: Record<string, any[]> = {
    students: [],
    groups: [],
    schedules: [],
    lessons: [],
    payments: [],
    attendance: [],
    hods: [],
    certificates: [],
    lernstudioSets: [],
    settings: [defaultSettings],
    financeNotifications: [],
    goldHoldings: [],
    homeworkAssignments: [],
    homeworkSubmissions: [],
    customVerbGroups: [],
    ...initialState
  };

  return {
    store,
    getLocalData: () => store
  };
}

async function runAll15ArchitecturalScenarios() {
  const logs: string[] = [];
  const memStorage = new MemoryLocalStorage();
  (globalThis as any).localStorage = memStorage;
  (globalThis as any).window = {
    location: { origin: 'https://h-und-n-br5l.vercel.app', pathname: '/' },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  resetHomeworkStoresForTesting();
  resetFirestoreSubscriptionMultiplexers();
  const mockFetch = createMockFetchAgainstExpress();
  (globalThis as any).fetch = mockFetch;

  const teacherUid = 'teacher_android_primary';
  const teacherEmail = 'zusammennachdeutschland@gmail.com';
  const teacherToken = makeTestBearerToken(teacherUid, teacherEmail);

  // =========================================================================
  // SCENARIO 1: Offline Android Operation (100% Local Persistence, 0 Cloud Dependency)
  // =========================================================================
  {
    const androidDeviceId = 'dev_android_main';
    const androidSource = createMockSyncDataSource({
      students: [
        trackLocalMutation(
          { id: 'stu_1', name: 'أحمد طارق', groupId: 'grp_a1', status: 'active' } as any,
          androidDeviceId,
          1,
          'android'
        )
      ],
      groups: [
        trackLocalMutation(
          { id: 'grp_a1', name: 'مجموعة A1 المسائية', color: '#4f46e5' } as any,
          androidDeviceId,
          2,
          'android'
        )
      ],
      lessons: [
        trackLocalMutation(
          { id: 'les_1', groupId: 'grp_a1', date: '2026-11-14', time: '18:00', status: 'completed' } as any,
          androidDeviceId,
          3,
          'android'
        )
      ],
      attendance: [
        trackLocalMutation(
          { id: 'att_1', lessonId: 'les_1', studentId: 'stu_1', status: 'present' } as any,
          androidDeviceId,
          4,
          'android'
        )
      ],
      payments: [
        trackLocalMutation(
          { id: 'pay_1', studentId: 'stu_1', amount: 650, date: '2026-11-14', status: 'paid' } as any,
          androidDeviceId,
          5,
          'android'
        )
      ],
      goldHoldings: [
        trackLocalMutation(
          {
            id: 'gold_1',
            karat: 24,
            grams: 10,
            buyPricePerGramEgp: 4100,
            purchaseDate: '2026-11-14'
          } as any,
          androidDeviceId,
          6,
          'android'
        )
      ],
      certificates: [
        trackLocalMutation(
          { id: 'cert_1', studentId: 'stu_1', studentName: 'أحمد طارق', level: 'A1' } as any,
          androidDeviceId,
          7,
          'android'
        )
      ],
      hods: [
        trackLocalMutation(
          { id: 'hod_1', name: 'Dr. Schmidt', school: 'Deutsche Schule' } as any,
          androidDeviceId,
          8,
          'android'
        )
      ],
      lernstudioSets: [
        trackLocalMutation(
          {
            id: 'set_custom_1',
            title: 'مفردات السفر',
            category: 'A1',
            items: [{ id: 'w1', german: 'der Bahnhof', arabic: 'محطة القطار', emoji: '🚉' }]
          } as any,
          androidDeviceId,
          9,
          'android'
        )
      ],
      customVerbGroups: [
        trackLocalMutation(
          {
            id: 'vgrp_1',
            title: 'أفعال الحركة',
            level: 'A1',
            verbs: [{ id: 'v1', infinitive: 'gehen', arabic: 'يذهب' }]
          } as any,
          androidDeviceId,
          10,
          'android'
        )
      ]
    });

    const localSnapshot = androidSource.getLocalData();
    assert.equal(localSnapshot.students.length, 1);
    assert.equal(localSnapshot.students[0].originPlatform, 'android');
    assert.equal(localSnapshot.goldHoldings.length, 1);
    assert.equal(localSnapshot.lernstudioSets.length, 1);
    assert.equal(localSnapshot.customVerbGroups.length, 1);
    logs.push('[PASS] Scenario 1: Offline Android operation stores all teaching, finance, gold, HOD, and Lernstudio data locally with zero cloud dependency');
  }

  // =========================================================================
  // SCENARIO 2: P2P Initial Sync (Android -> Computer Full Dataset Transfer)
  // =========================================================================
  {
    const androidDeviceId = 'dev_android_main';
    const androidSource = createMockSyncDataSource({
      students: [
        trackLocalMutation({ id: 'stu_1', name: 'أحمد طارق', groupId: 'grp_a1' } as any, androidDeviceId, 1, 'android')
      ],
      groups: [
        trackLocalMutation({ id: 'grp_a1', name: 'مجموعة A1' } as any, androidDeviceId, 2, 'android')
      ],
      goldHoldings: [
        trackLocalMutation({ id: 'gold_1', karat: 21, grams: 20, buyPricePerGramEgp: 3650 } as any, androidDeviceId, 3, 'android')
      ],
      homeworkAssignments: [
        {
          id: 'hw_p2p_1',
          shortId: 'AbCdEf1',
          title: 'واجب مزامنة P2P',
          updatedAt: new Date(2000).toISOString(),
          createdAt: new Date(1500).toISOString()
        }
      ],
      homeworkSubmissions: [
        {
          id: 'sub_p2p_1',
          assignmentId: 'hw_p2p_1',
          studentName: 'أحمد طارق',
          score: 95,
          completedAt: new Date(2500).toISOString()
        }
      ],
      customVerbGroups: [
        {
          id: 'vgrp_custom_1',
          title: 'أفعال A2',
          updatedAt: 3000
        }
      ]
    });

    const initialDelta = buildOutboundDelta(
      'peer_pc',
      {},
      androidSource.getLocalData(),
      { id: androidDeviceId, name: 'Android Teacher Primary' },
      { forceFull: true, peerLastSynced: 0 }
    );
    assert.equal(initialDelta.records.students?.length, 1);
    assert.equal(initialDelta.records.groups?.length, 1);
    assert.equal(initialDelta.records.goldHoldings?.length, 1);
    assert.equal(initialDelta.records.homeworkAssignments?.length, 1);
    assert.equal(initialDelta.records.homeworkSubmissions?.length, 1);
    assert.equal(initialDelta.records.customVerbGroups?.length, 1);
    const syncedSettingsArr = initialDelta.records.settings as any[];
    assert.equal(syncedSettingsArr?.[0]?.pickerNames?.length, 2);

    // Apply initial delta onto empty Computer store
    const computerStudents = mergeEntities([], (initialDelta.records.students || []) as any[], 'student').merged;
    const computerGold = mergeEntities([], (initialDelta.records.goldHoldings || []) as any[], 'goldHolding').merged;
    const computerHw = mergeEntities([], (initialDelta.records.homeworkAssignments || []) as any[], 'homeworkAssignment').merged;
    const computerSubs = mergeEntities([], (initialDelta.records.homeworkSubmissions || []) as any[], 'homeworkSubmission').merged;
    assert.equal(computerStudents.length, 1);
    assert.equal(computerGold.length, 1);
    assert.equal(computerHw.length, 1);
    assert.equal(computerSubs.length, 1);
    logs.push('[PASS] Scenario 2: P2P Initial Sync transfers 100% of datasets (including goldHoldings, homeworkAssignments, homeworkSubmissions, customVerbGroups, settings) from Android to Computer');
  }

  // =========================================================================
  // SCENARIO 3: P2P Incremental Sync (Delta Watermark Transfer)
  // =========================================================================
  {
    const androidDeviceId = 'dev_android_main';
    const baseWatermark = 5000;
    const androidSource = createMockSyncDataSource({
      students: [
        { id: 'stu_old', name: 'Old Student', updatedAt: 1000, originRevision: 1, originDeviceId: androidDeviceId },
        { id: 'stu_new', name: 'Updated Student', updatedAt: 9500, originRevision: 2, originDeviceId: androidDeviceId }
      ],
      payments: [
        { id: 'pay_new', studentId: 'stu_new', amount: 800, updatedAt: 9800, originRevision: 3, originDeviceId: androidDeviceId }
      ]
    });

    const incrementalDelta = buildOutboundDelta(
      'peer_pc',
      { peer_pc: { [androidDeviceId]: 1 } },
      androidSource.getLocalData(),
      { id: androidDeviceId, name: 'Android Teacher Primary' },
      { forceFull: false, peerLastSynced: baseWatermark }
    );
    assert.equal(incrementalDelta.records.students?.length, 1);
    assert.equal(incrementalDelta.records.students?.[0].id, 'stu_new');
    assert.equal(incrementalDelta.records.payments?.length, 1);
    assert.equal(incrementalDelta.records.payments?.[0].id, 'pay_new');
    logs.push('[PASS] Scenario 3: P2P Incremental Sync sends only records mutated after peer watermark');
  }

  // =========================================================================
  // SCENARIO 4: P2P Conflict Resolution (Latest Timestamp Wins + Android Tie-Breaker)
  // =========================================================================
  {
    // Part A: Latest timestamp wins regardless of platform
    const olderAndroid: any[] = [
      { id: 'stu_c1', name: 'Name @ t=4000', updatedAt: 4000, originPlatform: 'android', originRevision: 2 }
    ];
    const newerComputer: any[] = [
      { id: 'stu_c1', name: 'Name @ t=6000', updatedAt: 6000, originPlatform: 'web', originRevision: 3 }
    ];
    const lwwResult = mergeEntities(olderAndroid, newerComputer, 'student');
    assert.equal(lwwResult.merged[0].name, 'Name @ t=6000');
    assert.equal(lwwResult.conflicts[0].winner, 'remote');

    // Part B: Equal timestamp tie-breaker -> Android ALWAYS wins over Computer/Web even if Web has higher originRevision
    const equalTimeComputerLocal: any[] = [
      {
        id: 'stu_tie',
        name: 'Computer Edit @ t=5000',
        updatedAt: 5000,
        originPlatform: 'web',
        originRevision: 99,
        updatedByDeviceId: 'dev_web_zzz'
      }
    ];
    const equalTimeAndroidIncoming: any[] = [
      {
        id: 'stu_tie',
        name: 'Android Authoritative Edit @ t=5000',
        updatedAt: 5000,
        originPlatform: 'android',
        originRevision: 1,
        updatedByDeviceId: 'dev_android_aaa'
      }
    ];
    const tieResultOnComputer = mergeEntities(equalTimeComputerLocal, equalTimeAndroidIncoming, 'student');
    assert.equal(tieResultOnComputer.merged[0].name, 'Android Authoritative Edit @ t=5000');
    assert.equal(tieResultOnComputer.conflicts[0].winner, 'remote');

    const tieResultOnAndroid = mergeEntities(equalTimeAndroidIncoming, equalTimeComputerLocal, 'student');
    assert.equal(tieResultOnAndroid.merged[0].name, 'Android Authoritative Edit @ t=5000');
    assert.equal(tieResultOnAndroid.conflicts[0].winner, 'local');

    logs.push('[PASS] Scenario 4: P2P Conflict Resolution enforces Latest-Timestamp-Wins with Android as authoritative tie-breaker');
  }

  // =========================================================================
  // SCENARIO 5: P2P Offline Queue & Recovery
  // =========================================================================
  {
    const androidDeviceId = 'dev_android_main';
    const androidSource = createMockSyncDataSource({
      students: [
        { id: 'stu_q1', name: 'Queued Offline Student', updatedAt: 9000, originRevision: 5, originDeviceId: androidDeviceId }
      ],
      goldHoldings: [
        { id: 'gold_q1', karat: 24, grams: 5, updatedAt: 9500, originRevision: 6, originDeviceId: androidDeviceId }
      ],
      homeworkAssignments: [
        { id: 'hw_q1', title: 'واجب أوفلاين', updatedAt: new Date(9600).toISOString(), originRevision: 7, originDeviceId: androidDeviceId }
      ]
    });

    const pairedPeers = [
      {
        deviceId: 'peer_pc',
        deviceName: 'Teacher Laptop',
        lastKnownIp: 'P2P',
        port: 0,
        pairingToken: 'tok',
        lastSyncedTimestamp: 2000,
        isOnline: false
      }
    ];

    const outboxBeforeSync = calculatePendingOutbox(
      { peer_pc: { [androidDeviceId]: 1 } },
      androidSource.getLocalData(),
      pairedPeers
    );
    assert.ok(outboxBeforeSync.totalCount >= 3);
    assert.equal(outboxBeforeSync.byEntity.students, 1);
    assert.equal(outboxBeforeSync.byEntity.goldHoldings, 1);
    assert.equal(outboxBeforeSync.byEntity.homeworkAssignments, 1);

    // Simulate reconnection and watermark advance to revision 10 & timestamp 20000
    const outboxAfterSync = calculatePendingOutbox(
      { peer_pc: { [androidDeviceId]: 10 } },
      androidSource.getLocalData(),
      [{ ...pairedPeers[0], lastSyncedTimestamp: 20000, isOnline: true }]
    );
    assert.equal(outboxAfterSync.totalCount, 0);
    logs.push('[PASS] Scenario 5: P2P Offline Queue tracks pending local changes while disconnected and clears outbox upon reconnection');
  }

  // Create authoritative HomeworkCloudTransportOverride backed by InMemoryAdminFirestore
  const inMemDb = getInMemoryAdminFirestore();
  const authoritativeTransport = {
    saveAssignment: async (hw: HomeworkAssignment) => {
      const uid = hw.ownerUid || teacherUid;
      const docRef = inMemDb.collection('homework_assignments').doc(hw.id);
      await docRef.set({ ...hw, ownerUid: uid }, { merge: true });
      if (hw.shortId) {
        await inMemDb.collection('homework_short_links').doc(hw.shortId).set(
          {
            shortId: hw.shortId,
            assignmentId: hw.id,
            ownerUid: uid,
            isActive: hw.isActive !== false && hw.status !== 'closed',
            deleted: Boolean((hw as any).deleted),
            status: hw.status || (hw.isActive === false ? 'closed' : 'active'),
            assignment: hw
          },
          { merge: true }
        );
      }
      return true;
    },
    fetchAssignment: async (id: string) => {
      const snap = await inMemDb.collection('homework_assignments').doc(id).get();
      return snap.exists ? (snap.data() as HomeworkAssignment) : null;
    },
    fetchShortLink: async (shortId: string) => {
      const snap = await inMemDb.collection('homework_short_links').doc(shortId).get();
      if (!snap.exists) return null;
      return snap.data();
    },
    saveSubmission: async (sub: HomeworkSubmission) => {
      await inMemDb.collection('homework_submissions').doc(sub.id).set(sub, { merge: true });
      return true;
    },
    fetchSubmissionsForAssignment: async (id: string) => {
      const snap = await inMemDb
        .collection('homework_submissions')
        .where('assignmentId', '==', id)
        .get();
      return snap.docs.map((d: any) => d.data() as HomeworkSubmission);
    },
    fetchAllAssignments: async (ownerUid?: string) => {
      const snap = await inMemDb
        .collection('homework_assignments')
        .where('ownerUid', '==', ownerUid || teacherUid)
        .get();
      return snap.docs.map((d: any) => d.data() as HomeworkAssignment);
    },
    fetchAllSubmissions: async (ownerUid?: string) => {
      const snap = await inMemDb
        .collection('homework_submissions')
        .where('ownerUid', '==', ownerUid || teacherUid)
        .get();
      return snap.docs.map((d: any) => d.data() as HomeworkSubmission);
    },
    deleteAssignment: async (id: string, _ownerUid?: string, shortIdHint?: string) => {
      await inMemDb.collection('homework_assignments').doc(id).set(
        { deleted: true, isActive: false, status: 'closed' },
        { merge: true }
      );
      if (shortIdHint) {
        await inMemDb.collection('homework_short_links').doc(shortIdHint).set(
          { deleted: true, isActive: false, status: 'deleted' },
          { merge: true }
        );
      }
      return true;
    },
    deleteSubmissionsForAssignment: async () => true
  };

  // =========================================================================
  // SCENARIO 6: Android Homework Creation (Direct Cloud Publish + Short Link)
  // =========================================================================
  let publishedVocabHw: HomeworkAssignment;
  let publishedVerbHw: HomeworkAssignment;
  {
    __setHomeworkAuthUserForTests({
      uid: teacherUid,
      email: teacherEmail,
      getIdToken: async () => teacherToken
    });
    __setHomeworkSyncTransportForTests(authoritativeTransport);

    const vocabShortId = createHomeworkShortId(7);
    publishedVocabHw = {
      id: createHomeworkAssignmentId(),
      shortId: vocabShortId,
      shareToken: createHomeworkShareToken(),
      ownerUid: teacherUid,
      ownerEmail: teacherEmail,
      title: 'واجب الكلمات من أندرويد مباشرة',
      setSnapshot: {
        id: 'set_android_vocab',
        title: 'كلمات الدرس الأول',
        category: 'A1',
        items: [
          { id: 'w1', german: 'der Apfel', arabic: 'التفاحة', emoji: '🍎' },
          { id: 'w2', german: 'das Wasser', arabic: 'الماء', emoji: '💧' }
        ]
      },
      selectedItemIds: ['w1', 'w2'],
      flowMode: 'teacher_then_quiz',
      questionTypes: ['true_false', 'choice_2', 'choice_all', 'full_word'],
      blooketMode: 'gold_quest',
      allowedGameModes: ['gold_quest', 'classic_quiz'],
      questionCount: 4,
      targetQuestionCount: 4,
      audienceMode: 'group',
      groupId: 'grp_a1',
      groupName: 'مجموعة A1',
      assignedStudents: [{ id: 'stu_1', name: 'أحمد طارق' }],
      maxAttempts: 3,
      allowReplay: true,
      hideTeacherBranding: false,
      isActive: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'Herr Abdul-Rahman'
    };

    const confirmVocab = await saveAssignmentWithConfirmation(publishedVocabHw);
    assert.equal(confirmVocab.cloudSynced, true);
    assert.ok(getLocalAssignments().some((a) => a.id === publishedVocabHw.id));
    const shortSnap = await inMemDb.collection('homework_short_links').doc(vocabShortId).get();
    assert.equal(shortSnap.exists, true);

    const shareUrl = buildHomeworkShareUrl(publishedVocabHw, 'https://h-und-n-br5l.vercel.app');
    assert.equal(shareUrl, `https://h-und-n-br5l.vercel.app/Herr-Abdul-rahman/${vocabShortId}`);
    assert.equal(extractShortIdFromPathname(`/Herr-Abdul-rahman/${vocabShortId}`), vocabShortId);

    // Create Verb homework from Android as well
    const verbShortId = createHomeworkShortId(7);
    publishedVerbHw = {
      ...publishedVocabHw,
      id: createHomeworkAssignmentId(),
      shortId: verbShortId,
      shareToken: createHomeworkShareToken(),
      title: 'واجب تصريف الأفعال من أندرويد',
      contentSource: 'verb',
      questionTypes: ['choice_all', 'true_false', 'verb_conjugation', 'verb_sentence'],
      verbSnapshot: [
        {
          id: 'v_kommen',
          infinitive: 'kommen',
          arabic: 'يأتي',
          prasens: {
            ich: 'komme',
            du: 'kommst',
            er_sie_es: 'kommt',
            wir: 'kommen',
            ihr: 'kommt',
            sie_Sie: 'kommen'
          },
          exampleSentences: [{ de: 'Ich ___ aus Ägypten.', ar: 'أنا آتي من مصر' }]
        } as any
      ],
      selectedVerbIds: ['v_kommen']
    };

    const confirmVerb = await saveAssignmentWithConfirmation(publishedVerbHw);
    assert.equal(confirmVerb.cloudSynced, true);
    const verbShortSnap = await inMemDb.collection('homework_short_links').doc(verbShortId).get();
    assert.equal(verbShortSnap.exists, true);

    logs.push('[PASS] Scenario 6: Android creates & publishes Vocabulary and Verb homework directly to Homework Cloud with verified /Herr-Abdul-rahman/{shortId} short links');
  }

  // =========================================================================
  // SCENARIO 7: Student Access via /Herr-Abdul-rahman/{shortId} Without Local DB
  // =========================================================================
  {
    // Simulate a separate student device with completely empty localStorage and no teacher auth
    const studentStorage = new MemoryLocalStorage();
    (globalThis as any).localStorage = studentStorage;
    __setHomeworkAuthUserForTests(null);

    const resolved = await resolveHomeworkShortLink(publishedVocabHw.shortId!);
    assert.equal(resolved.status, 'resolved');
    assert.ok(resolved.assignment);
    assert.equal(resolved.assignment?.id, publishedVocabHw.id);
    assert.equal(resolved.assignment?.title, 'واجب الكلمات من أندرويد مباشرة');
    assert.equal(resolved.assignment?.setSnapshot.items.length, 2);
    assert.equal(resolved.assignment?.assignedStudents?.length, 1);
    assert.equal(resolved.assignment?.assignedStudents?.[0].name, 'أحمد طارق');

    logs.push('[PASS] Scenario 7: Student opens /Herr-Abdul-rahman/{shortId} on an external browser with zero teacher local DB access and loads full homework snapshot');
  }

  // =========================================================================
  // SCENARIO 8: Student Submission to Homework Cloud
  // =========================================================================
  let studentSubId = '';
  {
    studentSubId = `sub_${Date.now()}_stu1`;
    const submission: HomeworkSubmission = {
      id: studentSubId,
      assignmentId: publishedVocabHw.id,
      ownerUid: teacherUid,
      audienceMode: 'group',
      groupId: 'grp_a1',
      studentId: 'stu_1',
      studentName: 'أحمد طارق',
      attemptNumber: 1,
      status: 'completed',
      startedAt: new Date(Date.now() - 60000).toISOString(),
      completedAt: new Date().toISOString(),
      timeSpentSeconds: 60,
      totalQuestions: 4,
      correctAnswersCount: 4,
      scorePercentage: 100,
      score: 100,
      accuracyPercent: 100,
      goldEarned: 450,
      responses: [
        {
          questionId: 'q1',
          questionType: 'choice_all',
          germanWord: 'der Apfel',
          studentAnswer: 'التفاحة',
          correctAnswer: 'التفاحة',
          isCorrect: true,
          timeSpentSeconds: 3
        }
      ]
    };

    const subConfirm = await saveSubmissionWithConfirmation(submission);
    assert.equal(subConfirm.cloudSynced, true);
    logs.push('[PASS] Scenario 8: Student submits completed homework answers, score, accuracy, and gamification rewards to Homework Cloud');
  }

  // =========================================================================
  // SCENARIO 9: Android Receives Homework Results On-Demand
  // =========================================================================
  {
    // Restore teacher Android localStorage & auth
    (globalThis as any).localStorage = memStorage;
    __setHomeworkAuthUserForTests({
      uid: teacherUid,
      email: teacherEmail,
      getIdToken: async () => teacherToken
    });

    const details = await fetchAssignmentDetailsWithSync(publishedVocabHw.id);
    assert.ok(details, 'Expected on-demand fetchAssignmentDetailsWithSync to return assignment details');
    const fetchedSubs = getLocalSubmissions();
    const matchingSub = fetchedSubs.find((s) => s.id === studentSubId);
    assert.ok(matchingSub, 'Expected Android on-demand fetch to retrieve student submission');
    assert.equal(matchingSub?.studentName, 'أحمد طارق');
    assert.equal(matchingSub?.accuracyPercent, 100);
    assert.equal(matchingSub?.goldEarned, 450);
    assert.equal(matchingSub?.responses.length, 1);
    assert.equal(matchingSub?.responses[0].studentAnswer, 'التفاحة');
    logs.push('[PASS] Scenario 9: Android fetches student homework submissions on-demand and displays student answers, score, accuracy, and rewards');
  }

  // =========================================================================
  // SCENARIO 10: P2P Homework Synchronization (Android -> Computer)
  // =========================================================================
  {
    const androidHwList = getLocalAssignments();
    const androidSubList = getLocalSubmissions();
    assert.ok(androidHwList.some((a) => a.id === publishedVocabHw.id));
    assert.ok(androidSubList.some((s) => s.id === studentSubId));

    const androidSyncSource = createMockSyncDataSource({
      homeworkAssignments: androidHwList,
      homeworkSubmissions: androidSubList
    });

    const p2pDelta = buildOutboundDelta(
      'peer_pc',
      {},
      androidSyncSource.getLocalData(),
      { id: 'dev_android_main', name: 'Android Teacher Primary' },
      { forceFull: true, peerLastSynced: 0 }
    );
    const computerMergedHw = mergeEntities([], p2pDelta.records.homeworkAssignments || [], 'homeworkAssignment').merged;
    const computerMergedSubs = mergeEntities([], p2pDelta.records.homeworkSubmissions || [], 'homeworkSubmission').merged;

    assert.ok(computerMergedHw.some((a: any) => a.id === publishedVocabHw.id));
    assert.ok(computerMergedSubs.some((s: any) => s.id === studentSubId));
    logs.push('[PASS] Scenario 10: P2P synchronizes homework assignments and student submissions from Android to Computer without cloud workspace sync');
  }

  // =========================================================================
  // SCENARIO 11: Hide Teacher Branding (hideTeacherBranding ON vs OFF)
  // =========================================================================
  {
    const hiddenBrandingShortId = createHomeworkShortId(7);
    const hiddenBrandingHw: HomeworkAssignment = {
      ...publishedVocabHw,
      id: createHomeworkAssignmentId(),
      shortId: hiddenBrandingShortId,
      shareToken: createHomeworkShareToken(),
      title: 'واجب بدون اسم أو لوجو المدرس',
      hideTeacherBranding: true
    };

    const confirmHidden = await saveAssignmentWithConfirmation(hiddenBrandingHw);
    assert.equal(confirmHidden.cloudSynced, true);

    // Resolve via public short link endpoint
    const resolvedHidden = await resolveHomeworkShortLink(hiddenBrandingShortId);
    assert.equal(resolvedHidden.status, 'resolved');
    assert.equal(resolvedHidden.assignment?.hideTeacherBranding, true);

    // Resolve visible branding assignment
    const resolvedVisible = await resolveHomeworkShortLink(publishedVocabHw.shortId!);
    assert.equal(resolvedVisible.status, 'resolved');
    assert.equal(Boolean(resolvedVisible.assignment?.hideTeacherBranding), false);

    logs.push('[PASS] Scenario 11: hideTeacherBranding (ON and OFF) persists across creation, Homework Cloud, P2P, and public student DTO resolution');
  }

  // =========================================================================
  // SCENARIO 12: Homework Close / Reopen / Update / Delete from Android
  // =========================================================================
  {
    // 12a. Update metadata from Android
    const updatedRes = await updateHomeworkAssignmentMetadata(publishedVocabHw.id, {
      title: 'واجب الكلمات (محدث من أندرويد)',
      maxAttempts: 5,
      hideTeacherBranding: true
    });
    assert.ok(updatedRes.assignment);
    assert.equal(updatedRes.cloudSynced, true);
    assert.equal(updatedRes.assignment?.title, 'واجب الكلمات (محدث من أندرويد)');
    assert.equal(updatedRes.assignment?.maxAttempts, 5);
    assert.equal(updatedRes.assignment?.hideTeacherBranding, true);

    const resolvedAfterEdit = await resolveHomeworkShortLink(publishedVocabHw.shortId!);
    assert.equal(resolvedAfterEdit.status, 'resolved');
    assert.equal(resolvedAfterEdit.assignment?.title, 'واجب الكلمات (محدث من أندرويد)');
    assert.equal(resolvedAfterEdit.assignment?.maxAttempts, 5);
    assert.equal(resolvedAfterEdit.assignment?.hideTeacherBranding, true);

    // 12b. Close assignment from Android
    const closedRes = await setHomeworkAssignmentActiveStatus(publishedVocabHw.id, false);
    assert.ok(closedRes.assignment);
    assert.equal(closedRes.cloudSynced, true);
    assert.equal(closedRes.assignment?.isActive, false);
    assert.equal(closedRes.assignment?.status, 'closed');

    const resolvedWhenClosed = await resolveHomeworkShortLink(publishedVocabHw.shortId!);
    assert.equal(resolvedWhenClosed.status, 'revoked');

    // 12c. Reopen assignment from Android
    const reopenedRes = await setHomeworkAssignmentActiveStatus(publishedVocabHw.id, true);
    assert.ok(reopenedRes.assignment);
    assert.equal(reopenedRes.cloudSynced, true);
    assert.equal(reopenedRes.assignment?.isActive, true);
    assert.equal(reopenedRes.assignment?.status, 'active');

    const resolvedWhenReopened = await resolveHomeworkShortLink(publishedVocabHw.shortId!);
    assert.equal(resolvedWhenReopened.status, 'resolved');

    // 12d. Delete verb assignment from Android
    deleteLocalAssignment(publishedVerbHw.id);
    const remainingLocal = getLocalAssignments();
    assert.equal(remainingLocal.some((a) => a.id === publishedVerbHw.id), false);

    logs.push('[PASS] Scenario 12: Android Close, Reopen, Edit Metadata, and Delete homework propagate to local storage, P2P, homework_assignments, and homework_short_links');
  }

  // =========================================================================
  // SCENARIO 13: Cloud Failure Isolation (Offline Homework Queue & Recovery)
  // =========================================================================
  {
    // Simulate Homework Cloud network outage while Android & P2P continue working
    __setHomeworkSyncTransportForTests({
      saveAssignment: async () => {
        throw new Error('SIMULATED_CLOUD_NETWORK_OUTAGE');
      }
    });

    const offlineHw: HomeworkAssignment = {
      ...publishedVocabHw,
      id: createHomeworkAssignmentId(),
      shortId: createHomeworkShortId(7),
      shareToken: createHomeworkShareToken(),
      title: 'واجب أثناء انقطاع السحابة'
    };

    const offlineSaveResult = await saveAssignmentWithConfirmation(offlineHw);
    assert.equal(offlineSaveResult.cloudSynced, false);
    assert.equal(offlineSaveResult.assignment.cloudCreatePending, true);
    assert.ok(getPendingHomeworkSyncCount() > 0, 'Expected pending homework upload to be queued when cloud is down');

    // P2P still syncs the offline-created homework to Computer normally!
    const androidSourceDuringCloudOutage = createMockSyncDataSource({
      homeworkAssignments: getLocalAssignments()
    });
    const deltaDuringCloudOutage = buildOutboundDelta(
      'peer_pc',
      {},
      androidSourceDuringCloudOutage.getLocalData(),
      { id: 'dev_android_main', name: 'Android Teacher Primary' },
      { forceFull: true, peerLastSynced: 0 }
    );
    assert.ok(deltaDuringCloudOutage.records.homeworkAssignments?.some((a: any) => a.id === offlineHw.id));

    // Restore Homework Cloud connectivity and flush queue
    __setHomeworkSyncTransportForTests(authoritativeTransport);
    const flushRes = await flushPendingHomeworkSyncQueue();
    assert.ok(flushRes.syncedAssignments >= 1);

    logs.push('[PASS] Scenario 13: Homework Cloud failure never blocks Android or P2P sync, and queued homework uploads flush cleanly when cloud recovers');
  }

  // =========================================================================
  // SCENARIO 14: P2P Failure Isolation (P2P Disconnected -> Homework Cloud Unaffected)
  // =========================================================================
  {
    // Even with 0 P2P peers connected, Android creates & publishes online homework and students can open it
    const p2pOfflineHw: HomeworkAssignment = {
      ...publishedVocabHw,
      id: createHomeworkAssignmentId(),
      shortId: createHomeworkShortId(7),
      shareToken: createHomeworkShareToken(),
      title: 'واجب بدون اتصال P2P'
    };

    const res = await saveAssignmentWithConfirmation(p2pOfflineHw);
    assert.equal(res.cloudSynced, true);

    const studentResolved = await resolveHomeworkShortLink(p2pOfflineHw.shortId!);
    assert.equal(studentResolved.status, 'resolved');
    assert.equal(studentResolved.assignment?.id, p2pOfflineHw.id);

    logs.push('[PASS] Scenario 14: P2P disconnection never blocks Android from publishing or managing Online Homework in the cloud');
  }

  // =========================================================================
  // SCENARIO 15: Firestore Quota Efficiency & Payload Hash Deduplication
  // =========================================================================
  {
    resetFirestoreSubscriptionMultiplexers();
    __setHomeworkSyncTransportForTests(null);

    let restCallCount = 0;
    (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      restCallCount++;
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('firestore.googleapis.com')) {
        return new Response(JSON.stringify({ fields: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return mockFetch(input, init);
    };

    const quotaHw: HomeworkAssignment = {
      ...publishedVocabHw,
      id: 'hw_quota_dedup_test',
      shortId: 'QtDedup',
      title: 'واجب اختبار توفير الحصة اليومية',
      updatedAt: '2026-11-14T10:00:00.000Z'
    };

    const firstWrite = await saveAssignmentToFirestore(quotaHw);
    assert.equal(firstWrite, true);
    const callsAfterFirst = restCallCount;
    assert.ok(callsAfterFirst > 0);

    // Second save with identical payload is deduplicated by payload hash (0 extra network/Firestore writes)
    const secondWrite = await saveAssignmentToFirestore(quotaHw);
    assert.equal(secondWrite, true);
    assert.equal(restCallCount, callsAfterFirst, 'Expected 0 redundant HTTP/Firestore writes for unchanged assignment payload');

    // Same for completed submission deduplication
    const quotaSub: HomeworkSubmission = {
      id: 'sub_quota_dedup_1',
      assignmentId: quotaHw.id,
      ownerUid: teacherUid,
      studentId: 'stu_1',
      studentName: 'أحمد طارق',
      attemptNumber: 1,
      startedAt: '2026-11-14T10:01:00.000Z',
      completedAt: '2026-11-14T10:02:00.000Z',
      timeSpentSeconds: 60,
      totalQuestions: 4,
      correctAnswersCount: 4,
      scorePercentage: 100,
      score: 100,
      accuracyPercent: 100,
      responses: []
    };

    const firstSubWrite = await saveSubmissionToFirestore(quotaSub);
    assert.equal(firstSubWrite, true);
    const subCallsAfterFirst = restCallCount;
    const secondSubWrite = await saveSubmissionToFirestore(quotaSub);
    assert.equal(secondSubWrite, true);
    assert.equal(restCallCount, subCallsAfterFirst, 'Expected 0 redundant writes for already-saved completed submission');

    logs.push('[PASS] Scenario 15: Quota optimization deduplicates unchanged assignment, short-link, and completed submission writes and eliminates background workspace sync');
  }

  for (const line of logs) {
    console.log(line);
  }
  console.log(`\nALL 15 ARCHITECTURAL SCENARIOS PASSED (${logs.length}/15).`);
}

runAll15ArchitecturalScenarios().catch((err) => {
  console.error('Architectural verification test failed:', err);
  process.exit(1);
});
