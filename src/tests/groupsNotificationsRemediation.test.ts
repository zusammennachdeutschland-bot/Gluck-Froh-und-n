import assert from 'node:assert/strict';
import {
  hasStudentCustomPricingOverride,
  reconcileStudentForGroupMove,
  resequenceScheduledLessonsAfterChange
} from '../utils/lessonUtils';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import {
  normalizeStudentNameForUniqueness,
  findDuplicateStudentByName
} from '../utils/nameUtils';
import {
  createPersistedStudentDocument,
  resolveStudentDocumentDownloadUrl,
  deletePersistedStudentDocumentPayload,
  getStudentDocumentStorageKey,
  MAX_INLINE_SYNC_DOCUMENT_DATA_URL_LENGTH
} from '../utils/studentDocumentUtils';
import { MAX_PRUNED_ARCHIVE_ITEMS } from '../services/lessonCleanupService';
import {
  sendSystemNotification,
  parseDailySummaryTime,
  countActiveTodayLessonsForSummary,
  resolveChannelForSettings,
  getVersionedChannelId,
  initNotificationChannels
} from '../services/notificationService';
import {
  __setSimulatePrimaryDbForTests,
  __clearMemoryStoreOnlyForTests
} from '../services/storageService';
import { Group, Lesson, NotificationSettings, PaymentRecord, Student } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../data/initialData';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

const memLocal = new MemoryStorage();
const memSession = new MemoryStorage();

(globalThis as any).localStorage = memLocal;
(globalThis as any).sessionStorage = memSession;
(globalThis as any).window = {
  localStorage: memLocal,
  sessionStorage: memSession,
  location: { origin: 'https://glueck.example.com', href: 'https://glueck.example.com/' },
  focus: () => {}
};

async function runTests(): Promise<void> {
  console.log('Running Groups, Students (#1-#11) & Notifications (#1-#4) Remediation Tests...');
  __setSimulatePrimaryDbForTests(true);
  __clearMemoryStoreOnlyForTests();
  memLocal.clear();
  memSession.clear();

  // -------------------------------------------------------------------------
  // Groups & Students #1, #2, #3, #7: Custom pricing override & student move reconciliation
  // -------------------------------------------------------------------------
  {
    const srcGroup: Group = {
      id: 'g_src',
      name: 'Source A1',
      grade: 'A1',
      type: 'online',
      color: 'blue',
      scheduleDays: ['Monday'],
      scheduleTime: '17:00',
      monthlyPackagePrice: 800,
      sessionCount: 4,
      paymentCycle: 'monthly',
      paymentModel: 'package'
    };
    const destPerLessonGroup: Group = {
      id: 'g_dest_pl',
      name: 'Dest Intensive',
      grade: 'A2',
      type: 'online',
      color: 'green',
      scheduleDays: ['Wednesday'],
      scheduleTime: '19:00',
      monthlyPackagePrice: 300,
      pricePerSession: 300,
      sessionCount: 1,
      paymentCycle: 'per_lesson',
      paymentModel: 'per_session'
    };
    const destPkgGroup: Group = {
      id: 'g_dest_pkg',
      name: 'Dest Monthly',
      grade: 'A2',
      type: 'online',
      color: 'purple',
      scheduleDays: ['Thursday'],
      scheduleTime: '20:00',
      monthlyPackagePrice: 1200,
      sessionCount: 4,
      paymentCycle: 'monthly',
      paymentModel: 'package'
    };

    const stDefault: Student = {
      id: 'st_default',
      name: 'Standard Student',
      groupId: 'g_src',
      grade: 'A1',
      parentName: 'Parent 1',
      parentPhone: '+201000000001',
      studentPhone: '',
      documents: [],
      joinedDate: '2026-01-01',
      paymentPlan: '4_lessons',
      monthlyFee: 800,
      bundleSize: 4
    };
    const stCustom: Student = {
      ...stDefault,
      id: 'st_custom',
      name: 'Custom Student',
      customBundlePrice: 650,
      paymentPlan: '4_lessons'
    };

    assert.equal(hasStudentCustomPricingOverride(stDefault), false);
    assert.equal(hasStudentCustomPricingOverride(stCustom), true);

    // Move standard student -> updates plan, fee, bundleSize to destination group and records previousGroupIds
    const movedDefault = reconcileStudentForGroupMove(stDefault, destPerLessonGroup, '2026-10-10', 'g_dest_pl');
    assert.equal(movedDefault.groupId, 'g_dest_pl');
    assert.equal(movedDefault.paymentPlan, 'per_lesson');
    assert.equal(movedDefault.pricePerLesson, 300);
    assert.equal(movedDefault.customBundlePrice, undefined);
    assert.deepEqual(movedDefault.previousGroupIds, ['g_src']);

    // Move custom-priced student -> updates destination group plan while RETAINING explicit customBundlePrice!
    const movedCustom = reconcileStudentForGroupMove(stCustom, destPkgGroup, '2026-10-10', 'g_dest_pkg');
    assert.equal(movedCustom.groupId, 'g_dest_pkg');
    assert.equal(movedCustom.paymentPlan, '4_lessons');
    assert.equal(movedCustom.bundleSize, 4);
    assert.equal(movedCustom.customBundlePrice, 650, 'Explicit customBundlePrice must be preserved across moves');
    assert.deepEqual(movedCustom.previousGroupIds, ['g_src']);

    // Historical billability after move (#7): Completed unpaid lessons in srcGroup remain billable after move to destPkgGroup
    const movedStudentWithHistory: Student = {
      ...movedDefault,
      groupId: 'g_dest_pkg',
      paymentPlan: '4_lessons',
      monthlyFee: 1200,
      bundleSize: 4,
      previousGroupIds: ['g_src'],
      groupHistory: [{ groupId: 'g_src', leftDate: '2026-10-05' }]
    };
    const oldGroupLessons: Lesson[] = [1, 2, 3, 4].map(n => ({
      id: `l_hist_${n}`,
      groupId: 'g_src',
      groupName: 'Source A1',
      title: `Hist ${n}`,
      date: `2026-10-0${n}`,
      time: '17:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: n,
      totalSessionsInPackage: 4,
      status: 'completed',
      paymentStatus: 'pending',
      amountDue: 200,
      amountPaid: 0,
      report: {
        attendanceStatus: 'present',
        studentAttendance: { st_default: 'present' }
      }
    }));
    const postMoveCycles = calculateDuePaymentCycles([movedStudentWithHistory], [srcGroup, destPkgGroup], oldGroupLessons, []);
    assert.equal(postMoveCycles.length, 1, 'Unpaid historical group lessons before move must remain billable');
    assert.equal(postMoveCycles[0].lessonIds.length, 4);
    console.log('✓ Groups #1, #3, #7 passed: Custom override preservation, move pricing reconciliation, & post-move historical billability');
  }

  // -------------------------------------------------------------------------
  // Groups #6: Dual-scope resequencing on lesson move
  // -------------------------------------------------------------------------
  {
    const grpA: Group = { id: 'ga', name: 'GA', grade: 'A1', type: 'online', color: 'blue', scheduleDays: [], scheduleTime: '16:00', sessionCount: 4, monthlyPackagePrice: 800 };
    const grpB: Group = { id: 'gb', name: 'GB', grade: 'A1', type: 'online', color: 'green', scheduleDays: [], scheduleTime: '18:00', sessionCount: 4, monthlyPackagePrice: 800 };

    const lessons: Lesson[] = [
      { id: 'la1', groupId: 'ga', groupName: 'GA', title: 'A1', date: '2026-10-10', time: '16:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 1, totalSessionsInPackage: 4, status: 'scheduled', paymentStatus: 'pending', amountDue: 200, amountPaid: 0 },
      { id: 'la2', groupId: 'ga', groupName: 'GA', title: 'A2', date: '2026-10-12', time: '16:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 3, totalSessionsInPackage: 4, status: 'scheduled', paymentStatus: 'pending', amountDue: 200, amountPaid: 0 },
      // Suppose 'lb_moved' was moved from GA to GB on 2026-10-11
      { id: 'lb_moved', groupId: 'gb', groupName: 'GB', title: 'Moved', date: '2026-10-11', time: '18:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 9, totalSessionsInPackage: 4, status: 'scheduled', paymentStatus: 'pending', amountDue: 200, amountPaid: 0 },
      { id: 'lb2', groupId: 'gb', groupName: 'GB', title: 'B2', date: '2026-10-15', time: '18:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 1, totalSessionsInPackage: 4, status: 'scheduled', paymentStatus: 'pending', amountDue: 200, amountPaid: 0 }
    ];

    let afterBoth = resequenceScheduledLessonsAfterChange(lessons, { groupId: 'ga' }, { group: grpA });
    afterBoth = resequenceScheduledLessonsAfterChange(afterBoth, { groupId: 'gb' }, { group: grpB });

    assert.equal(afterBoth.find(l => l.id === 'la1')?.sessionNumber, 1);
    assert.equal(afterBoth.find(l => l.id === 'la2')?.sessionNumber, 2, 'Source scope GA resequenced contiguously');
    assert.equal(afterBoth.find(l => l.id === 'lb_moved')?.sessionNumber, 1, 'Moved lesson becomes session 1 in destination scope GB');
    assert.equal(afterBoth.find(l => l.id === 'lb2')?.sessionNumber, 2, 'Destination scope GB resequenced around moved lesson');
    console.log('✓ Groups #6 passed: Both old and new scopes resequenced accurately');
  }

  // -------------------------------------------------------------------------
  // Groups #9, #10, #11: Prune cap 1,000, duplicate student name blocking, & durable student docs
  // -------------------------------------------------------------------------
  {
    assert.equal(MAX_PRUNED_ARCHIVE_ITEMS, 1000, 'Archive cap must be 1,000');

    const existingStudents = [
      { id: 'st_dup_1', name: '  أحمد   محمد  ' },
      { id: 'st_del', name: 'Deleted Student', deleted: true }
    ];
    assert.equal(normalizeStudentNameForUniqueness('  أحمد\u064e   محمد '), normalizeStudentNameForUniqueness('احمد محمد'));
    assert.ok(findDuplicateStudentByName(existingStudents, 'احمد محمد'), 'Normalized duplicate student name must be detected');
    assert.equal(findDuplicateStudentByName(existingStudents, 'Deleted Student'), undefined, 'Soft-deleted student must not block new name');
    assert.equal(findDuplicateStudentByName(existingStudents, 'أحمد محمد', 'st_dup_1'), undefined, 'Self-rename allowed');

    // Durable student document roundtrip & sync payload safety (no blob: URL!)
    const smallBlob = new Blob(['Hello German Certificate'], { type: 'text/plain' });
    const persistedDoc = await createPersistedStudentDocument(smallBlob, 'doc');
    assert.equal(persistedDoc.url.startsWith('blob:'), false, 'Persisted document URL must NEVER be an ephemeral blob: URL');
    assert.equal(persistedDoc.storageKey, getStudentDocumentStorageKey(persistedDoc.id));
    assert.ok((persistedDoc.dataUrl?.length || 0) <= MAX_INLINE_SYNC_DOCUMENT_DATA_URL_LENGTH);

    // Clear in-memory cache and simulate reload via storage lookup
    __clearMemoryStoreOnlyForTests();
    const resolvedUrl = await resolveStudentDocumentDownloadUrl(persistedDoc);
    assert.ok(resolvedUrl && resolvedUrl.startsWith('data:text/plain;base64,'), 'Document must be resolvable cleanly after reload');

    // Cross-device fallback (storage cleared locally, small doc carries synced dataUrl)
    const crossDeviceDoc = { ...persistedDoc, id: 'doc_remote_only', storageKey: 'dl_student_doc_remote_missing' };
    const remoteResolved = await resolveStudentDocumentDownloadUrl(crossDeviceDoc);
    assert.ok(remoteResolved && remoteResolved.startsWith('data:text/plain;base64,'), 'Cross-device small document dataUrl fallback must work');

    await deletePersistedStudentDocumentPayload(persistedDoc);
    console.log('✓ Groups #9, #10, #11 passed: 1k archive cap, duplicate-name detection, & durable student doc persistence');
  }

  // -------------------------------------------------------------------------
  // Notifications #1-#4: Delivery return boolean, 00:xx parser, active-only counts, channel versioning
  // -------------------------------------------------------------------------
  {
    // #1: Without Notification API or permission, sendSystemNotification returns false cleanly
    delete (globalThis as any).Notification;
    delete (globalThis as any).window.Notification;
    const delivered = await sendSystemNotification('Lesson', 'Starts now', 'upcoming-l1', { lessonId: 'l1' });
    assert.equal(delivered, false, 'Undeliverable web notification must return false so reminder key is NOT falsely locked in sessionStorage');

    // Now simulate granted Notification API where notification succeeds
    class MockNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      close() {}
      constructor(_title: string, _opts?: any) {}
    }
    (globalThis as any).Notification = MockNotification;
    (globalThis as any).window.Notification = MockNotification;
    const deliveredOk = await sendSystemNotification('Lesson', 'Starts now', 'upcoming-l1', { lessonId: 'l1' });
    assert.equal(deliveredOk, true, 'Successful Notification constructor delivery must return true');
    delete (globalThis as any).Notification;
    delete (globalThis as any).window.Notification;

    // #2: 00:00–00:59 midnight summary time preserved strictly without hrs || 20 bug
    assert.deepEqual(parseDailySummaryTime('00:00'), { hours: 0, minutes: 0 });
    assert.deepEqual(parseDailySummaryTime('00:45'), { hours: 0, minutes: 45 });
    assert.deepEqual(parseDailySummaryTime('23:59'), { hours: 23, minutes: 59 });
    assert.deepEqual(parseDailySummaryTime('25:99'), { hours: 20, minutes: 0 });
    assert.deepEqual(parseDailySummaryTime(''), { hours: 20, minutes: 0 });

    // #3: Daily summary excludes deleted & cancelled lessons
    const todayLessons: Lesson[] = [
      { id: 'l_ok', groupId: 'g1', groupName: 'G1', title: 'OK', date: '2026-10-10', time: '14:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 1, totalSessionsInPackage: 4, status: 'scheduled', paymentStatus: 'pending', amountDue: 200, amountPaid: 0 },
      { id: 'l_can', groupId: 'g1', groupName: 'G1', title: 'Can', date: '2026-10-10', time: '15:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 2, totalSessionsInPackage: 4, status: 'cancelled', paymentStatus: 'pending', amountDue: 200, amountPaid: 0 },
      { id: 'l_del', groupId: 'g1', groupName: 'G1', title: 'Del', date: '2026-10-10', time: '16:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 3, totalSessionsInPackage: 4, status: 'scheduled', paymentStatus: 'pending', amountDue: 200, amountPaid: 0, deleted: true }
    ];
    assert.equal(countActiveTodayLessonsForSummary(todayLessons, '2026-10-10'), 1, 'Daily summary count must ignore deleted and cancelled lessons');

    // #4: Android channel ID versions deterministically on priority/importance changes and stays stable when unchanged
    const settingsHigh: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      paymentDue: { ...DEFAULT_NOTIFICATION_SETTINGS.paymentDue, priority: 'normal' }
    };
    const settingsMax: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      paymentDue: { ...DEFAULT_NOTIFICATION_SETTINGS.paymentDue, priority: 'max' }
    };
    const chNormal1 = resolveChannelForSettings('payment_due', settingsHigh);
    const chNormal2 = resolveChannelForSettings('payment_due', settingsHigh);
    const chMax = resolveChannelForSettings('payment_due', settingsMax);

    assert.equal(chNormal1.channelId, chNormal2.channelId, 'Unchanged importance must keep same channel ID without churn');
    assert.notEqual(chNormal1.channelId, chMax.channelId, 'Changed importance must produce a distinct versioned channel ID');
    assert.equal(chMax.channelId, getVersionedChannelId('payment_due', 5 as any));
    await initNotificationChannels(settingsMax);
    console.log('✓ Notifications #1-#4 passed: Delivery boolean, 00:xx summary parser, active-only count, & versioned channel IDs');
  }

  console.log('ALL GROUPS, STUDENTS & NOTIFICATIONS REMEDIATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Groups & Notifications remediation test failed:', err);
  process.exit(1);
});
