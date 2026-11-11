import assert from 'node:assert/strict';
import {
  findInvalidBiweeklyAutoLessons,
  buildLessonSlotSet,
  makeLessonSlotKey,
  filterBillableReportLessons,
  filterBillableReportPayments
} from '../utils/lessonUtils';
import { getAlternatingWeek } from '../utils/scheduleUtils';
import { isQuotaExceededError, safeLocalStorageSetItem } from '../services/storageService';
import {
  MAX_SCHEDULED_NOTIFICATIONS,
  LESSON_NOTIFICATION_WINDOW_DAYS,
  rebuildAllNotificationSchedules,
  computeSystemNotificationIdentity,
  selectPrioritizedNotificationBatch
} from '../services/notificationService';
import { isBackupFileSizeValid, MAX_BACKUP_FILE_SIZE_BYTES } from '../utils/backupEngine';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../data/initialData';
import { Group, Lesson, PaymentRecord, Student } from '../types';

console.log('Running Batch 3 unit tests (#7, #11, #10, #25, #27)...');

// ---------------------------------------------------------------------------
// 1. Test #7: findInvalidBiweeklyAutoLessons & soft-delete (deleted: true)
// ---------------------------------------------------------------------------
{
  const dateA = '2026-11-02';
  const dateB = '2026-11-09';
  const weekOfDateA = getAlternatingWeek(dateA); // 'A' or 'B'
  const targetRecurrence = weekOfDateA === 'A' ? 'biweekly_a' : 'biweekly_b';

  const biweeklyGroup: Group = {
    id: 'g_bi_1',
    name: 'Gruppe Biweekly',
    grade: 'A1',
    type: 'online',
    color: 'blue',
    scheduleDays: ['Monday'],
    scheduleTime: '17:00',
    scheduleRecurrence: targetRecurrence,
    monthlyPackagePrice: 1200,
    sessionCount: 4
  };

  const lessons: Lesson[] = [
    // Valid biweekly lesson on matching week -> MUST NOT be flagged
    {
      id: `l_auto_g_bi_1_${dateA}_1700`,
      groupId: 'g_bi_1',
      groupName: 'Gruppe Biweekly',
      title: 'Valid Week Lesson',
      date: dateA,
      time: '17:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 300,
      amountPaid: 0
    },
    // Invalid biweekly l_auto_ lesson on wrong week with NO attendance/payment/notes -> MUST be flagged
    {
      id: `l_auto_g_bi_1_${dateB}_1700`,
      groupId: 'g_bi_1',
      groupName: 'Gruppe Biweekly',
      title: 'Wrong Week Empty Lesson',
      date: dateB,
      time: '17:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 2,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 300,
      amountPaid: 0
    },
    // Wrong week l_auto_ lesson WITH payment -> MUST NOT be flagged
    {
      id: `l_auto_g_bi_1_${dateB}_1900`,
      groupId: 'g_bi_1',
      groupName: 'Gruppe Biweekly',
      title: 'Wrong Week Paid Lesson',
      date: dateB,
      time: '19:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 3,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'paid',
      amountDue: 300,
      amountPaid: 300
    },
    // Wrong week l_auto_ lesson WITH teacher notes -> MUST NOT be flagged
    {
      id: `l_auto_g_bi_1_${dateB}_2000`,
      groupId: 'g_bi_1',
      groupName: 'Gruppe Biweekly',
      title: 'Wrong Week Note Lesson',
      date: dateB,
      time: '20:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 4,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 300,
      amountPaid: 0,
      quickNotes: 'Important teacher note'
    },
    // Manual lesson (not l_auto_) on wrong week -> MUST NOT be flagged
    {
      id: `l_manual_${dateB}_2100`,
      groupId: 'g_bi_1',
      groupName: 'Gruppe Biweekly',
      title: 'Manual Lesson',
      date: dateB,
      time: '21:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 300,
      amountPaid: 0
    }
  ];

  const invalid = findInvalidBiweeklyAutoLessons(lessons, [biweeklyGroup]);
  assert.equal(invalid.length, 1, 'Should detect exactly 1 invalid empty l_auto_ biweekly lesson');
  assert.equal(invalid[0].id, `l_auto_g_bi_1_${dateB}_1700`);

  // Verify soft-delete marks deleted: true instead of removing from array
  const targetIds = new Set(invalid.map(i => i.id));
  const afterSoftDelete = lessons.map(l => (targetIds.has(l.id) ? { ...l, deleted: true } : l));
  assert.equal(afterSoftDelete.length, lessons.length, 'Soft delete must preserve array length');
  assert.equal(
    afterSoftDelete.find(l => l.id === `l_auto_g_bi_1_${dateB}_1700`)?.deleted,
    true,
    'Cleaned lesson must have deleted: true'
  );
  assert.equal(
    findInvalidBiweeklyAutoLessons(afterSoftDelete, [biweeklyGroup]).length,
    0,
    'Soft-deleted lesson must not appear in subsequent previews'
  );
  console.log('✓ Test #7 passed: findInvalidBiweeklyAutoLessons & soft-delete (deleted: true)');
}

// ---------------------------------------------------------------------------
// 2. Test #27: Set-based O(1) slot lookup (buildLessonSlotSet)
// ---------------------------------------------------------------------------
{
  const sampleLessons: Lesson[] = [
    {
      id: 'l_1',
      groupId: 'g1',
      groupName: 'G1',
      date: '2026-11-10',
      time: '16:00',
      title: 'Active',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 200,
      amountPaid: 0
    },
    {
      id: 'l_2',
      groupId: 'g1',
      groupName: 'G1',
      date: '2026-11-17',
      time: '16:00',
      title: 'Deleted',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 2,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 200,
      amountPaid: 0,
      deleted: true
    }
  ];

  const slotSet = buildLessonSlotSet(sampleLessons);
  assert.equal(slotSet.has(makeLessonSlotKey('g1', '2026-11-10', '16:00')), true);
  assert.equal(slotSet.has(makeLessonSlotKey('g1', '2026-11-17', '16:00')), false, 'Deleted lessons must not block slot');
  console.log('✓ Test #27 passed: buildLessonSlotSet O(1) lookup');
}

// ---------------------------------------------------------------------------
// 3. Test #25: QuotaExceededError detection
// ---------------------------------------------------------------------------
{
  const quotaErr = { name: 'QuotaExceededError', code: 22, message: 'The quota has been exceeded.' };
  const otherErr = new Error('Network failure');
  assert.equal(isQuotaExceededError(quotaErr), true);
  assert.equal(isQuotaExceededError(otherErr), false);
  assert.equal(typeof safeLocalStorageSetItem, 'function');
  console.log('✓ Test #25 passed: QuotaExceededError detection');
}

// ---------------------------------------------------------------------------
// 4. Test #11 & #10: Notification cap (100), 14-day window & slot deduplication
// ---------------------------------------------------------------------------
async function testNotifications() {
  assert.equal(MAX_SCHEDULED_NOTIFICATIONS, 100, 'Cap should be raised from 25 to 100');
  assert.equal(LESSON_NOTIFICATION_WINDOW_DAYS, 14, 'Rolling window should be 14 days');

  const now = Date.now();
  const in2Days = new Date(now + 2 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now + 30 * 24 * 60 * 60 * 1000);

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const dateIn2Days = fmtDate(in2Days);
  const dateIn30Days = fmtDate(in30Days);

  // Two duplicate lessons on the exact same group + date + time within 14 days, plus one lesson at 30 days
  const testLessons: Lesson[] = [
    {
      id: 'l_dup_1',
      groupId: 'g_notif',
      groupName: 'Notif Group',
      title: 'Lesson 1',
      date: dateIn2Days,
      time: '18:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 200,
      amountPaid: 0
    },
    {
      id: 'l_dup_2',
      groupId: 'g_notif',
      groupName: 'Notif Group',
      title: 'Lesson 1 Duplicate',
      date: dateIn2Days,
      time: '18:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 200,
      amountPaid: 0
    },
    {
      id: 'l_far_future',
      groupId: 'g_notif',
      groupName: 'Notif Group',
      title: 'Lesson 30 Days Out',
      date: dateIn30Days,
      time: '18:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 2,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 200,
      amountPaid: 0
    }
  ];

  const settings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    masterEnabled: true,
    lessonReminder: { ...DEFAULT_NOTIFICATION_SETTINGS.lessonReminder, enabled: true },
    lessonStart: { ...DEFAULT_NOTIFICATION_SETTINGS.lessonStart, enabled: false },
    attendanceReminder: { ...DEFAULT_NOTIFICATION_SETTINGS.attendanceReminder, enabled: false },
    paymentDue: { ...DEFAULT_NOTIFICATION_SETTINGS.paymentDue, enabled: false },
    dailySummary: { ...DEFAULT_NOTIFICATION_SETTINGS.dailySummary, enabled: false },
    schoolLessonReminder: { enabled: false, sound: 'beep' as const, priority: 'high' as const }
  };

  const res = await rebuildAllNotificationSchedules(settings, testLessons, [], [], []);
  assert.equal(
    res.count,
    1,
    'Should schedule exactly 1 reminder (deduplicating l_dup_2 and ignoring 30-day lesson outside 14-day window)'
  );
  console.log('✓ Test #11 & #10 passed: Notification window, cap (100), and deduplication');

  // ---------------------------------------------------------------------------
  // 5. Follow-up #1: sendSystemNotification identity (tag + lessonId or title/body hash)
  // ---------------------------------------------------------------------------
  const idA = computeSystemNotificationIdentity('lesson_alarm', 'Alarm A', 'Body A', { lessonId: 'l_101' });
  const idB = computeSystemNotificationIdentity('lesson_alarm', 'Alarm B', 'Body B', { lessonId: 'l_202' });
  assert.notEqual(idA.notifId, idB.notifId, 'Different lessonIds with same tag must have distinct notifId');
  assert.notEqual(idA.uniqueTag, idB.uniqueTag, 'Different lessonIds with same tag must have distinct uniqueTag');

  const idText1 = computeSystemNotificationIdentity('payment', 'Payment Due: Ali', 'Amount: 400 EGP');
  const idText2 = computeSystemNotificationIdentity('payment', 'Payment Due: Sara', 'Amount: 600 EGP');
  assert.notEqual(idText1.notifId, idText2.notifId, 'Different title/body with same tag must have distinct notifId');
  assert.notEqual(idText1.uniqueTag, idText2.uniqueTag, 'Different title/body with same tag must have distinct uniqueTag');
  console.log('✓ Follow-up #1 passed: computeSystemNotificationIdentity prevents same-tag collisions');

  // ---------------------------------------------------------------------------
  // 6. Follow-up #2: Reserved slots for dailySummary & paymentDue inside 100 cap
  // ---------------------------------------------------------------------------
  const mockItems = [
    ...Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      epoch: 1000 + i,
      category: 'lessonReminder'
    })),
    { id: 9001, epoch: 50000, category: 'dailySummary' },
    { id: 9002, epoch: 60000, category: 'paymentDue' }
  ];
  const prioritized = selectPrioritizedNotificationBatch(
    mockItems,
    item => item.epoch,
    item => item.category,
    MAX_SCHEDULED_NOTIFICATIONS
  );
  assert.equal(prioritized.length, 100, 'Batch must respect MAX_SCHEDULED_NOTIFICATIONS (100)');
  assert.equal(
    prioritized.some(item => item.category === 'dailySummary'),
    true,
    'dailySummary must retain its reserved slot even when 120 earlier lesson reminders exist'
  );
  assert.equal(
    prioritized.some(item => item.category === 'paymentDue'),
    true,
    'paymentDue must retain its reserved slot even when 120 earlier lesson reminders exist'
  );
  console.log('✓ Follow-up #2 passed: selectPrioritizedNotificationBatch reserves slots for dailySummary & paymentDue');

  // ---------------------------------------------------------------------------
  // 7. Batch 4 (#4): ReportsView excludes deleted and exempted lessons & payments
  // ---------------------------------------------------------------------------
  const repStudents: Student[] = [
    { id: 's_normal', name: 'Normal', groupId: 'g1', grade: 'A1', parentName: '', parentPhone: '', studentPhone: '', documents: [], joinedDate: '2026-01-01', paymentStatus: 'pending' },
    { id: 's_exempt', name: 'Exempt', groupId: 'g1', grade: 'A1', parentName: '', parentPhone: '', studentPhone: '', documents: [], joinedDate: '2026-01-01', paymentStatus: 'exempted' }
  ];
  const repLessons: Lesson[] = [
    { id: 'l_ok', groupId: 'g1', groupName: 'G1', studentId: 's_normal', title: 'OK', date: '2026-10-10', time: '10:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 1, totalSessionsInPackage: 4, status: 'completed', paymentStatus: 'paid', amountDue: 200, amountPaid: 200 },
    { id: 'l_del', groupId: 'g1', groupName: 'G1', studentId: 's_normal', title: 'Del', date: '2026-10-11', time: '10:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 2, totalSessionsInPackage: 4, status: 'completed', paymentStatus: 'paid', amountDue: 200, amountPaid: 200, deleted: true },
    { id: 'l_ex_stu', groupId: '', groupName: 'Private', studentId: 's_exempt', title: 'ExStu', date: '2026-10-12', time: '10:00', durationMinutes: 60, type: 'online', grade: 'A1', sessionNumber: 1, totalSessionsInPackage: 4, status: 'completed', paymentStatus: 'pending', amountDue: 200, amountPaid: 0 }
  ];
  const repPayments: PaymentRecord[] = [
    { id: 'p_ok', studentId: 's_normal', studentName: 'Normal', groupId: 'g1', groupName: 'G1', amountDue: 200, amountPaid: 200, dueDate: '2026-10-10', status: 'paid', lessonsIncluded: ['l_ok'] },
    { id: 'p_del', studentId: 's_normal', studentName: 'Normal', groupId: 'g1', groupName: 'G1', amountDue: 200, amountPaid: 200, dueDate: '2026-10-10', status: 'paid', lessonsIncluded: ['l_del'], deleted: true },
    { id: 'p_ex', studentId: 's_exempt', studentName: 'Exempt', groupId: 'g1', groupName: 'G1', amountDue: 200, amountPaid: 0, dueDate: '2026-10-10', status: 'pending', lessonsIncluded: ['l_ex_stu'] }
  ];
  assert.equal(filterBillableReportLessons(repLessons, repStudents).length, 1);
  assert.equal(filterBillableReportPayments(repPayments, repStudents).length, 1);
  console.log('✓ Test #4 passed: filterBillableReportLessons & filterBillableReportPayments exclude deleted/exempted');

  // ---------------------------------------------------------------------------
  // 8. Batch 4 (#14): Backup file size cap (25 MB)
  // ---------------------------------------------------------------------------
  assert.equal(MAX_BACKUP_FILE_SIZE_BYTES, 25 * 1024 * 1024);
  assert.equal(isBackupFileSizeValid(1024), true);
  assert.equal(isBackupFileSizeValid(25 * 1024 * 1024), true);
  assert.equal(isBackupFileSizeValid(25 * 1024 * 1024 + 1), false);
  console.log('✓ Test #14 passed: 25 MB backup file size limit enforced');
}

testNotifications().then(() => {
  console.log('ALL BATCH 3 & BATCH 4 TESTS PASSED!');
});
