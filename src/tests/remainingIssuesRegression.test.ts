import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeLessonCleanup,
  executeLessonCleanup,
  getPrunedLessonIds,
  addPrunedLessonIds,
  setPrunedLessonIds,
  repairFutureAutoLessonTombstones,
  FUTURE_TOMBSTONE_REPAIR_FLAG_KEY
} from '../services/lessonCleanupService';
import { getLessonsForDate } from '../utils/dailyLessonUtils';
import { normalizeDateToISO, parseLocalDate, formatLocalDate } from '../utils/timeUtils';
import {
  normalizeTime,
  deduplicatePaymentsList,
  deduplicateLessonList,
  resequenceScheduledLessonsAfterChange,
  isPendingStatus,
  buildBlockedLessonSlotSet,
  makeLessonSlotKey
} from '../utils/lessonUtils';
import {
  shouldSettlePendingCycleRecord,
  calculateStudentDueBannerTotals,
  computeAccountBalance
} from '../services/financeService';
import {
  calculateDuePaymentCycles,
  allocateAdvancePaymentFifo,
  getStudentAdvanceLessonCredits,
  buildMovedStudentRecord,
  getUnresolvedHistoricalLessonDebts,
  recalculatePendingPaymentsForGroupPriceChange
} from '../utils/paymentUtils';
import { mergeEntities } from '../services/sync/mergeEngine';
import {
  isHomeworkAssignmentOpenForStudents,
  isHomeworkAutoClosedAfterDueDate,
  normalizeHomeworkAssignment,
  canAccountClaimLegacyHomework
} from '../shared/homeworkStorageSync';
import {
  resolveNotificationChannelId,
  getNotificationChannelSettingsSignature,
  sendSystemNotification
} from '../services/notificationService';
import {
  HEAVY_EVICTABLE_LOCALSTORAGE_KEYS,
  storage,
  __setStorageFailureHookForTests
} from '../services/storageService';
import { shouldRunAutomatedBackup } from '../hooks/useAutomatedDailyBackup';
import { resolveActiveZoomLinkForLesson } from '../services/zoomSessionStandardizer';
import { getProjectedLessonsForRange } from '../utils/scheduleUtils';
import {
  resolveOfflineLessonDisplayLocation,
  getValidStudentContactsForLesson
} from '../components/TodaysProgressTimeline';
import type { Group, GroupWeeklySession, Lesson, NotificationSettings, PaymentRecord, Student } from '../types';

// Ensure clean browser-like globals for node test runner
const memoryLocalStorage = new Map<string, string>();
const memorySessionStorage = new Map<string, string>();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (memoryLocalStorage.has(k) ? memoryLocalStorage.get(k)! : null),
    setItem: (k: string, v: string) => {
      memoryLocalStorage.set(k, String(v));
    },
    removeItem: (k: string) => {
      memoryLocalStorage.delete(k);
    },
    clear: () => {
      memoryLocalStorage.clear();
    },
    key: (i: number) => Array.from(memoryLocalStorage.keys())[i] ?? null,
    get length() {
      return memoryLocalStorage.size;
    }
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (memorySessionStorage.has(k) ? memorySessionStorage.get(k)! : null),
    setItem: (k: string, v: string) => {
      memorySessionStorage.set(k, String(v));
    },
    removeItem: (k: string) => {
      memorySessionStorage.delete(k);
    },
    clear: () => {
      memorySessionStorage.clear();
    }
  };
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

async function runTests() {
  console.log('=== Running Remaining Issues Regression Suite (C36, P1-P35, C41-C45) ===');

  // =========================================================================
  // C36 (H.1 - H.5): Today / Tomorrow Disappearing Lessons & Future Tombstones
  // =========================================================================
  {
    localStorage.clear();
    setPrunedLessonIds([]);

    const groupG1: Group = {
      id: 'g1',
      name: 'A1 Samstag & Sonntag',
      grade: 'A1',
      type: 'online',
      scheduleDays: ['So', 'Sa'],
      scheduleTime: '17:00',
      scheduleSlots: [
        { day: 'So', time: '17:00' },
        { day: 'Sa', time: '18:00' }
      ],
      lessonDurationMinutes: 60,
      sessionCount: 8,
      monthlyPackagePrice: 1600,
      paymentModel: 'package',
      status: 'active',
      color: '#4f46e5'
    } as unknown as Group;

    // Reference date: Sunday 2026-11-22 -> 20 days ahead is Saturday 2026-12-12 (matches 'Sa' 18:00)
    const refToday = new Date(2026, 10, 22, 10, 0, 0);
    const twentyDaysAheadStr = '2026-12-12';
    const futureAutoId = `l_auto_g1_${twentyDaysAheadStr}_1800`;
    const historicalOldId = 'l_auto_g1_2026-09-06_1700';

    const initialLessons: Lesson[] = [
      {
        id: historicalOldId,
        groupId: 'g1',
        groupName: groupG1.name,
        title: 'Old Completed Lesson',
        date: '2026-09-06',
        time: '17:00',
        type: 'online',
        sessionNumber: 1,
        totalSessionsInPackage: 8,
        status: 'completed',
        paymentStatus: 'paid',
        amountDue: 200,
        amountPaid: 200
      } as Lesson,
      {
        id: futureAutoId,
        groupId: 'g1',
        groupName: groupG1.name,
        title: 'Future Auto Lesson 20d Ahead',
        date: twentyDaysAheadStr,
        time: '18:00',
        type: 'online',
        sessionNumber: 5,
        totalSessionsInPackage: 8,
        status: 'scheduled',
        paymentStatus: 'pending',
        amountDue: 200,
        amountPaid: 0
      } as Lesson
    ];

    const paidPaymentForHistorical: PaymentRecord = {
      id: 'pay_hist_1',
      studentId: 's1',
      studentName: 'Omar',
      groupId: 'g1',
      groupName: groupG1.name,
      amountDue: 200,
      amountPaid: 200,
      dueDate: '2026-09-06',
      paidDate: '2026-09-06',
      status: 'paid',
      lessonIds: [historicalOldId],
      lessonDates: ['2026-09-06']
    } as PaymentRecord;

    const analysis = analyzeLessonCleanup(
      initialLessons,
      [groupG1],
      [{ id: 's1', name: 'Omar', groupId: 'g1', status: 'active' } as Student],
      [paidPaymentForHistorical],
      [],
      refToday
    );

    assert.equal(analysis.futureBloatToPrune.length, 1, 'Future auto lesson 20d ahead is identified as bloat');
    assert.equal(analysis.historicalEligibleToPrune.length, 1, 'Historical completed & settled lesson >30d ago is eligible');

    const cleanupRes = await executeLessonCleanup(initialLessons, analysis);
    assert.equal(
      cleanupRes.cleanedLessons.some((l) => l.id === futureAutoId),
      false,
      'C36.A/H.1: Future auto lesson 20d ahead is removed from stored lessons'
    );

    const tombstonesAfterCleanup = getPrunedLessonIds();
    assert.equal(
      tombstonesAfterCleanup.has(historicalOldId),
      true,
      'C36.A: Historical pruned lesson IS tombstoned'
    );
    assert.equal(
      tombstonesAfterCleanup.has(futureAutoId),
      false,
      'C36.A/H.1: Future auto lesson 20d ahead MUST NOT be tombstoned'
    );

    // Advance 7 days (now 2026-11-29, so 2026-12-12 is 13 days ahead, inside the 14-day window)
    const projectedIn14DayWindow = getProjectedLessonsForRange(
      '2026-11-29',
      '2026-12-13',
      [groupG1],
      cleanupRes.cleanedLessons
    );
    assert.equal(
      projectedIn14DayWindow.some((l) => l.id === futureAutoId && l.date === twentyDaysAheadStr),
      true,
      'C36.H.1: After advancing into the 14-day window, the 20d-ahead auto lesson is regenerated'
    );

    // Advance the full 20 days to 2026-12-12: visible in Today via getLessonsForDate
    const todayLessonsOnTargetDay = getLessonsForDate(
      twentyDaysAheadStr,
      cleanupRes.cleanedLessons,
      [groupG1],
      []
    );
    assert.equal(todayLessonsOnTargetDay.length, 1, 'C36.H.1: Lesson is visible on its day when 20 days elapse');
    assert.equal(todayLessonsOnTargetDay[0].id, futureAutoId);

    // H.2 & H.3: Authoritative tombstone repair across dl_lessons, recentlyDeleted, purgedRecords, and prunedArchiveLessons
    localStorage.removeItem(FUTURE_TOMBSTONE_REPAIR_FLAG_KEY);
    const futureVerifiedCleanupId = 'l_auto_g1_2026-11-29_1700';
    const futureUncertainProvenanceId = 'l_auto_g1_2026-11-30_1700';
    const futureUserDeletedAutoId = 'l_auto_g1_2026-12-02_1900';
    const futureUserCancelledAutoId = 'l_auto_g1_2026-12-06_1700';
    const futurePurgedAutoId = 'l_auto_g1_2026-12-09_1900';
    const pastAutoId = 'l_auto_g1_2026-11-01_1700';

    setPrunedLessonIds([
      futureVerifiedCleanupId,
      futureUncertainProvenanceId,
      futureUserDeletedAutoId,
      futureUserCancelledAutoId,
      futurePurgedAutoId,
      pastAutoId
    ]);

    const storedWithCancelledDiffFormat: Lesson[] = [
      {
        id: 'manual_cancel_alias',
        groupId: 'g1',
        date: '06/12/2026', // Different date format (DD/MM/YYYY) for same slot as futureUserCancelledAutoId
        time: '5:00 PM', // Different time format (12h) for 17:00
        status: 'cancelled'
      } as Lesson
    ];
    const recentlyDeletedLessons: Array<{ item: Lesson; deletedAt: string }> = [
      {
        deletedAt: '2026-11-22T10:00:00Z',
        item: {
          id: futureUserDeletedAutoId,
          groupId: 'g1',
          date: '2026-12-02T00:00:00Z',
          time: '7:00 PM',
          status: 'scheduled',
          deleted: true
        } as Lesson
      }
    ];
    const purgedRecords = [
      { id: futurePurgedAutoId, type: 'lesson' as const, purgedAt: '2026-11-22T10:00:00Z' }
    ];
    // Positive cleanup archive provenance ONLY for futureVerifiedCleanupId (NOT for futureUncertainProvenanceId)
    const prunedArchiveLessons: Lesson[] = [
      {
        id: futureVerifiedCleanupId,
        groupId: 'g1',
        date: '2026-11-29',
        time: '17:00',
        status: 'scheduled'
      } as Lesson
    ];

    const repairReport = repairFutureAutoLessonTombstones({
      storedLessons: storedWithCancelledDiffFormat,
      recentlyDeletedLessons,
      purgedRecords,
      prunedArchiveLessons,
      todayStr: '2026-11-22',
      forceRun: true
    });

    assert.equal(repairReport.removedCount, 1, 'C36.B: Only future tombstone with positive cleanup archive provenance and no deletion/cancellation is removed');
    assert.equal(getPrunedLessonIds().has(futureVerifiedCleanupId), false, 'Verified cleanup bloat tombstone is repaired');
    assert.equal(getPrunedLessonIds().has(futureUncertainProvenanceId), true, 'Uncertain provenance tombstone MUST be kept');
    assert.deepEqual(repairReport.uncertainReviewIds, [futureUncertainProvenanceId], 'Uncertain tombstone is listed for review');
    assert.equal(getPrunedLessonIds().has(futureUserDeletedAutoId), true, 'Soft-deleted future lesson in recentlyDeleted is NOT restored');
    assert.equal(getPrunedLessonIds().has(futureUserCancelledAutoId), true, 'Cancelled lesson (even with DD/MM/YYYY + 5:00 PM format) is NOT restored');
    assert.equal(getPrunedLessonIds().has(futurePurgedAutoId), true, 'Permanently purged lesson in purgedRecords is NOT restored');
    assert.equal(getPrunedLessonIds().has(pastAutoId), true, 'Historical tombstone before today is never un-tombstoned');

    // Deleted & cancelled lessons with mixed date/time formats MUST NOT return after restart, sync, or projection
    const deletedMixedFormatLesson: Lesson = {
      id: 'l_del_mixed_sun',
      groupId: 'g1',
      groupName: groupG1.name,
      title: 'Deleted Sunday',
      date: '2026-11-22T00:00:00Z',
      time: '5:00 PM',
      type: 'online',
      status: 'scheduled',
      deleted: true,
      updatedAt: 2000
    } as Lesson;
    const cancelledMixedFormatLesson: Lesson = {
      id: 'l_cancel_mixed_sat',
      groupId: 'g1',
      groupName: groupG1.name,
      title: 'Cancelled Saturday',
      date: '28/11/2026',
      time: '6:00 PM',
      type: 'online',
      status: 'cancelled',
      updatedAt: 2000
    } as Lesson;

    // 1) After restart (JSON round-trip) + blocked slot set check
    const restartedLessons: Lesson[] = JSON.parse(JSON.stringify([deletedMixedFormatLesson, cancelledMixedFormatLesson]));
    const blockedSlots = buildBlockedLessonSlotSet(restartedLessons);
    assert.equal(blockedSlots.has(makeLessonSlotKey('g1', '2026-11-22', '17:00')), true, 'Deleted lesson blocks slot across format mismatch after restart');
    assert.equal(blockedSlots.has(makeLessonSlotKey('g1', '2026-11-28', '18:00')), true, 'Cancelled lesson blocks slot across format mismatch after restart');

    // 2) After getProjectedLessonsForRange & getLessonsForDate
    const projectedAfterDeleteCancel = getProjectedLessonsForRange('2026-11-22', '2026-11-28', [groupG1], restartedLessons);
    assert.equal(
      projectedAfterDeleteCancel.some(l => normalizeDateToISO(l.date) === '2026-11-22' && normalizeTime(l.time) === '17:00' && !l.deleted),
      false,
      'Deleted lesson (ISO UTC + 5:00 PM) is NOT resurrected by getProjectedLessonsForRange'
    );
    assert.equal(
      projectedAfterDeleteCancel.some(l => normalizeDateToISO(l.date) === '2026-11-28' && normalizeTime(l.time) === '18:00' && l.status === 'scheduled'),
      false,
      'Cancelled lesson (DD/MM/YYYY + 6:00 PM) is NOT resurrected as scheduled by getProjectedLessonsForRange'
    );
    assert.equal(getLessonsForDate('2026-11-22', restartedLessons, [groupG1], []).length, 0, 'Deleted lesson stays hidden in getLessonsForDate');
    assert.equal(getLessonsForDate('2026-11-28', restartedLessons, [groupG1], []).length, 0, 'Cancelled lesson stays hidden in getLessonsForDate');

    // 3) After sync (mergeEntities) with an incoming active l_auto_ lesson on the same slot in canonical ISO/24h format
    const incomingAutoResurrectAttempt: Lesson[] = [
      {
        id: 'l_auto_g1_2026-11-22_1700',
        groupId: 'g1',
        groupName: groupG1.name,
        title: 'Incoming Auto Sun',
        date: '2026-11-22',
        time: '17:00',
        type: 'online',
        status: 'scheduled',
        isAutoGenerated: true,
        updatedAt: 2500
      } as Lesson,
      {
        id: 'l_auto_g1_2026-11-28_1800',
        groupId: 'g1',
        groupName: groupG1.name,
        title: 'Incoming Auto Sat',
        date: '2026-11-28',
        time: '18:00',
        type: 'online',
        status: 'scheduled',
        isAutoGenerated: true,
        updatedAt: 2500
      } as Lesson
    ];
    const syncMerged = mergeEntities(restartedLessons, incomingAutoResurrectAttempt, { entityTypeName: 'lessons' }).merged;
    assert.equal(
      syncMerged.some(l => !l.deleted && normalizeDateToISO(l.date) === '2026-11-22' && normalizeTime(l.time) === '17:00'),
      false,
      'Sync merge MUST NOT resurrect a soft-deleted slot even when incoming auto lesson has canonical ID/date/time'
    );
    const satAfterSync = syncMerged.filter(l => !l.deleted && normalizeDateToISO(l.date) === '2026-11-28' && normalizeTime(l.time) === '18:00');
    assert.equal(satAfterSync.length, 1, 'Sync merge reconciles duplicate Saturday slot into one record');
    assert.equal(satAfterSync[0].status, 'cancelled', 'Sync merge preserves cancelled status over incoming scheduled auto lesson');

    // H.4 & H.5: Midnight date rollover and non-ISO date string normalization for active lessons
    const lessonsWithNonIsoDates: Lesson[] = [
      {
        id: 'l_iso_utc',
        groupId: 'g1',
        groupName: groupG1.name,
        title: 'ISO UTC Date Lesson',
        date: '2026-11-22T00:00:00Z',
        time: '5:00 PM',
        type: 'online',
        status: 'scheduled',
        sessionNumber: 2,
        totalSessionsInPackage: 8,
        paymentStatus: 'pending',
        amountDue: 200
      } as Lesson,
      {
        id: 'l_slash_dmy',
        groupId: 'g1',
        groupName: groupG1.name,
        title: 'Slash DMY Date Lesson',
        date: '23/11/2026',
        time: '18:30',
        type: 'online',
        status: 'scheduled',
        sessionNumber: 3,
        totalSessionsInPackage: 8,
        paymentStatus: 'pending',
        amountDue: 200
      } as Lesson
    ];

    const nov22Lessons = getLessonsForDate('2026-11-22', lessonsWithNonIsoDates, [groupG1], []);
    assert.equal(nov22Lessons.length, 1, 'C36.E/H.5: 2026-11-22T00:00:00Z at 5:00 PM normalizes and deduplicates with 17:00 slot');
    assert.equal(nov22Lessons[0].date, '2026-11-22');

    const nov23Lessons = getLessonsForDate('2026-11-23', lessonsWithNonIsoDates, [groupG1], []);
    assert.equal(nov23Lessons.some((l) => l.id === 'l_slash_dmy' && l.date === '2026-11-23'), true, 'C36.H.4/H.5: 23/11/2026 lands on 2026-11-23 after midnight rollover');

    console.log('✓ C36 (20-day window, authoritative tombstone repair, format-safe non-resurrection) passed');
  }

  // =========================================================================
  // P1 & P2: Invoice Deduplication & Settlement Matching by Lesson IDs
  // =========================================================================
  {
    const inv1: PaymentRecord = {
      id: 'inv_cycle_1',
      studentId: 's1',
      studentName: 'Omar',
      groupId: 'g1',
      groupName: 'Group 1',
      amountDue: 400,
      amountPaid: 0,
      dueDate: '2026-11-22',
      status: 'pending',
      bundleSize: 2,
      lessonIds: ['l1', 'l2'],
      lessonDates: ['2026-11-15', '2026-11-22']
    } as PaymentRecord;

    const inv2SameDateAndAmountDifferentLessons: PaymentRecord = {
      id: 'inv_cycle_2',
      studentId: 's1',
      studentName: 'Omar',
      groupId: 'g1',
      groupName: 'Group 1',
      amountDue: 400,
      amountPaid: 0,
      dueDate: '2026-11-22',
      status: 'pending',
      bundleSize: 2,
      lessonIds: ['l3', 'l4'],
      lessonDates: ['2026-11-18', '2026-11-22']
    } as PaymentRecord;

    const deduped = deduplicatePaymentsList([inv1, inv2SameDateAndAmountDifferentLessons]);
    assert.equal(deduped.deduplicated.length, 2, 'P1: Invoices with same date, bundleSize, and amountDue but different lessonIds must NOT be merged');

    // P2: shouldSettlePendingCycleRecord matches strictly by lessonIds
    const shouldSettleDifferentLessons = shouldSettlePendingCycleRecord(inv1, {
      studentId: 's1',
      groupId: 'g1',
      lessonIds: ['l3', 'l4'],
      lessonDates: ['2026-11-15', '2026-11-22']
    });
    assert.equal(shouldSettleDifferentLessons, false, 'P2: Pending invoice must not settle when lessonIds do not match even if dates overlap');

    const shouldSettlePartialOverlap = shouldSettlePendingCycleRecord(inv1, {
      studentId: 's1',
      groupId: 'g1',
      lessonIds: ['l1', 'l99'],
      lessonDates: ['2026-11-15']
    });
    assert.equal(shouldSettlePartialOverlap, false, 'P2: Pending invoice must not settle when only one lesson overlaps');

    const shouldSettleExactCover = shouldSettlePendingCycleRecord(inv1, {
      studentId: 's1',
      groupId: 'g1',
      lessonIds: ['l1', 'l2'],
      lessonDates: ['2026-11-15', '2026-11-22']
    });
    assert.equal(shouldSettleExactCover, true, 'P2: Pending invoice settles when all its lessonIds are covered');

    console.log('✓ P1 & P2 passed');
  }

  // =========================================================================
  // P4: O(N) Performance of Dedupe & Resequence (2000 rows)
  // =========================================================================
  {
    const manyLessons: Lesson[] = [];
    for (let i = 0; i < 2000; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      const month = String(((i >> 5) % 12) + 1).padStart(2, '0');
      manyLessons.push({
        id: `l_perf_${i}`,
        groupId: `g_${i % 10}`,
        groupName: `Group ${i % 10}`,
        title: `Lesson ${i}`,
        date: `2026-${month}-${day}`,
        time: `${String(8 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
        type: 'online',
        sessionNumber: (i % 8) + 1,
        totalSessionsInPackage: 8,
        status: i < 500 ? 'completed' : 'scheduled',
        paymentStatus: 'pending',
        amountDue: 200,
        amountPaid: 0
      } as Lesson);
    }

    const startMs = Date.now();
    const dedupedLessons = deduplicateLessonList(manyLessons);
    const resequenced = resequenceScheduledLessonsAfterChange(dedupedLessons.deduplicated, { groupId: 'g_1' });
    const elapsedMs = Date.now() - startMs;

    assert.equal(dedupedLessons.deduplicated.length, 2000);
    assert.equal(resequenced.length, 2000);
    assert.equal(elapsedMs < 500, true, `P4: Dedupe + resequence on 2000 rows should be fast (<500ms), took ${elapsedMs}ms`);
    console.log(`✓ P4 passed (${elapsedMs}ms for 2000 lessons)`);
  }

  // =========================================================================
  // P9 & P10: Two lessons on the same day with same sessionNumber + Time/ID tiebreaker
  // =========================================================================
  {
    const student: Student = {
      id: 'st_p9',
      name: 'Mona',
      groupId: 'g_p9',
      status: 'active',
      paymentPlan: 'package',
      bundleSize: 2,
      monthlyFee: 400
    } as unknown as Student;

    const group: Group = {
      id: 'g_p9',
      name: 'Intensive B1',
      grade: 'B1',
      type: 'online',
      sessionCount: 2,
      monthlyPackagePrice: 400,
      paymentModel: 'package',
      status: 'active'
    } as Group;

    const twoLessonsSameDaySameSessionNum: Lesson[] = [
      {
        id: 'l_same_day_late',
        groupId: 'g_p9',
        groupName: group.name,
        title: 'Evening Session',
        date: '2026-11-20',
        time: '19:00',
        type: 'online',
        sessionNumber: 1,
        totalSessionsInPackage: 2,
        status: 'completed',
        paymentStatus: 'pending',
        amountDue: 200
      } as Lesson,
      {
        id: 'l_same_day_early',
        groupId: 'g_p9',
        groupName: group.name,
        title: 'Morning Session',
        date: '2026-11-20',
        time: '10:00',
        type: 'online',
        sessionNumber: 1,
        totalSessionsInPackage: 2,
        status: 'completed',
        paymentStatus: 'pending',
        amountDue: 200
      } as Lesson
    ];

    const cycles = calculateDuePaymentCycles([student], [group], twoLessonsSameDaySameSessionNum, []);
    assert.equal(cycles.length, 1, 'P9: Two completed lessons on the same day with the same sessionNumber complete a 2-lesson cycle');
    assert.deepEqual(
      cycles[0].lessonIds,
      ['l_same_day_early', 'l_same_day_late'],
      'P10: Lessons on the same date are ordered chronologically by time (10:00 before 19:00)'
    );
    console.log('✓ P9 & P10 passed');
  }

  // =========================================================================
  // P13: Students with similar names are never merged in lesson deduplication
  // =========================================================================
  {
    const lessonAli: Lesson = {
      id: 'l_ali_1',
      studentId: 'st_ali_1',
      studentName: 'Ali',
      title: 'Ali',
      date: '2026-11-22',
      time: '16:00',
      type: 'online',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 200
    } as Lesson;

    const lessonAliHassan: Lesson = {
      id: 'l_ali_2',
      studentId: 'st_ali_2',
      studentName: 'Ali Hassan',
      title: 'Ali Hassan',
      date: '2026-11-22',
      time: '16:00',
      type: 'online',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'scheduled',
      paymentStatus: 'pending',
      amountDue: 200
    } as Lesson;

    const dedupedSimilarNames = deduplicateLessonList([lessonAli, lessonAliHassan]);
    assert.equal(dedupedSimilarNames.deduplicated.length, 2, 'P13: Lessons for "Ali" and "Ali Hassan" at the same time must never merge');
    console.log('✓ P13 passed');
  }

  // =========================================================================
  // P6: FIFO Advance Payment Allocation (Partial < 1 debt, < 2 debts, > all debts)
  // =========================================================================
  {
    const fifoGroup: Group = {
      id: 'g_fifo',
      name: 'FIFO Group',
      grade: 'A1',
      type: 'online',
      sessionCount: 2,
      monthlyPackagePrice: 400,
      pricePerSession: 200,
      paymentModel: 'package',
      status: 'active'
    } as Group;

    const fifoStudent: Student = {
      id: 'st_fifo',
      name: 'Nadia',
      groupId: 'g_fifo',
      status: 'active',
      paymentPlan: 'package',
      bundleSize: 2,
      monthlyFee: 400
    } as unknown as Student;

    const fifoLessons: Lesson[] = [
      { id: 'l_f1', groupId: 'g_fifo', date: '2026-10-01', time: '17:00', status: 'completed', sessionNumber: 1, totalSessionsInPackage: 2, amountDue: 200 } as Lesson,
      { id: 'l_f2', groupId: 'g_fifo', date: '2026-10-05', time: '17:00', status: 'completed', sessionNumber: 2, totalSessionsInPackage: 2, amountDue: 200 } as Lesson,
      { id: 'l_f3', groupId: 'g_fifo', date: '2026-10-15', time: '17:00', status: 'completed', sessionNumber: 1, totalSessionsInPackage: 2, amountDue: 200 } as Lesson,
      { id: 'l_f4', groupId: 'g_fifo', date: '2026-11-22', time: '17:00', status: 'completed', sessionNumber: 2, totalSessionsInPackage: 2, amountDue: 200 } as Lesson
    ];

    const debt1: PaymentRecord = {
      id: 'pay_debt_1',
      studentId: 'st_fifo',
      studentName: 'Nadia',
      groupId: 'g_fifo',
      groupName: 'FIFO Group',
      bundleSize: 2,
      amountDue: 400,
      amountPaid: 0,
      remainingBalance: 400,
      dueDate: '2026-10-05',
      status: 'pending',
      lessonIds: ['l_f1', 'l_f2'],
      lessonDates: ['01/10/2026 (Session 1/2)', '05/10/2026 (Session 2/2)']
    } as PaymentRecord;

    const debt2: PaymentRecord = {
      id: 'pay_debt_2',
      studentId: 'st_fifo',
      studentName: 'Nadia',
      groupId: 'g_fifo',
      groupName: 'FIFO Group',
      bundleSize: 2,
      amountDue: 400,
      amountPaid: 0,
      remainingBalance: 400,
      dueDate: '2026-11-22',
      status: 'pending',
      lessonIds: ['l_f3', 'l_f4'],
      lessonDates: ['15/10/2026 (Session 1/2)', '22/11/2026 (Session 2/2)']
    } as PaymentRecord;

    // Case 1: Payment < 1 debt (150 against 400 + 400)
    const case1 = allocateAdvancePaymentFifo(
      {
        studentId: 'st_fifo',
        studentName: 'Nadia',
        groupId: 'g_fifo',
        groupName: 'FIFO Group',
        numberOfLessons: 1,
        amount: 150,
        todayStr: '2026-11-22',
        paymentId: 'pay_adv_c1'
      },
      [debt1, debt2],
      [fifoStudent],
      [fifoGroup],
      fifoLessons
    );
    const c1Debt1 = case1.updatedPayments.find(p => p.id === 'pay_debt_1')!;
    const c1Debt2 = case1.updatedPayments.find(p => p.id === 'pay_debt_2')!;
    assert.equal(case1.allocatedToDebtAmount, 150);
    assert.equal(case1.excessAdvanceAmount, 0);
    assert.equal(case1.excessAdvanceLessons, 0);
    assert.equal(case1.advancePaymentRecord, null, 'P6 Case 1: No advance credit record when payment < 1 debt');
    assert.equal(c1Debt1.status, 'partial');
    assert.equal(c1Debt1.amountPaid, 150);
    assert.equal(c1Debt1.remainingBalance, 250);
    assert.equal(c1Debt2.status, 'pending');
    assert.equal(c1Debt2.remainingBalance, 400);
    const c1DueAfter = calculateDuePaymentCycles([fifoStudent], [fifoGroup], fifoLessons, case1.updatedPayments);
    assert.equal(c1DueAfter.reduce((s, c) => s + c.amountDue, 0), 650, 'P6 Case 1: Total remaining due is 650 (250 + 400)');
    assert.equal(getStudentAdvanceLessonCredits('st_fifo', case1.updatedPayments, fifoLessons).remainingAdvanceLessons, 0);

    // Case 2: Payment < sum of 2 debts (550 against 400 + 400)
    const case2 = allocateAdvancePaymentFifo(
      {
        studentId: 'st_fifo',
        studentName: 'Nadia',
        groupId: 'g_fifo',
        groupName: 'FIFO Group',
        numberOfLessons: 3,
        amount: 550,
        todayStr: '2026-11-22',
        paymentId: 'pay_adv_c2'
      },
      [debt1, debt2],
      [fifoStudent],
      [fifoGroup],
      fifoLessons
    );
    const c2Debt1 = case2.updatedPayments.find(p => p.id === 'pay_debt_1')!;
    const c2Debt2 = case2.updatedPayments.find(p => p.id === 'pay_debt_2')!;
    assert.equal(case2.allocatedToDebtAmount, 550);
    assert.equal(case2.excessAdvanceAmount, 0);
    assert.equal(case2.excessAdvanceLessons, 0);
    assert.equal(case2.advancePaymentRecord, null, 'P6 Case 2: No advance credit record when payment < sum of 2 debts');
    assert.equal(c2Debt1.status, 'paid');
    assert.equal(c2Debt1.remainingBalance, 0);
    assert.deepEqual(case2.fullySettledLessonIds, ['l_f1', 'l_f2']);
    assert.equal(c2Debt2.status, 'partial');
    assert.equal(c2Debt2.amountPaid, 150);
    assert.equal(c2Debt2.remainingBalance, 250);
    const c2DueAfter = calculateDuePaymentCycles([fifoStudent], [fifoGroup], fifoLessons, case2.updatedPayments);
    assert.equal(c2DueAfter.length, 1);
    assert.equal(c2DueAfter[0].amountDue, 250, 'P6 Case 2: Only remaining 250 on debt2 is due');
    assert.equal(getStudentAdvanceLessonCredits('st_fifo', case2.updatedPayments, fifoLessons).remainingAdvanceLessons, 0);

    // Case 3: Payment > all debts (1200 against 400 + 400 -> 800 settles both debts, 400 excess -> 2 advance lessons)
    const case3 = allocateAdvancePaymentFifo(
      {
        studentId: 'st_fifo',
        studentName: 'Nadia',
        groupId: 'g_fifo',
        groupName: 'FIFO Group',
        numberOfLessons: 6,
        amount: 1200,
        todayStr: '2026-11-22',
        paymentId: 'pay_adv_c3'
      },
      [debt1, debt2],
      [fifoStudent],
      [fifoGroup],
      fifoLessons
    );
    assert.equal(case3.allocatedToDebtAmount, 800);
    assert.equal(case3.excessAdvanceAmount, 400);
    assert.equal(case3.excessAdvanceLessons, 2);
    assert.ok(case3.advancePaymentRecord, 'P6 Case 3: Advance record created strictly for excess cash');
    assert.equal(case3.advancePaymentRecord!.amountPaid, 400);
    assert.equal(case3.advancePaymentRecord!.bundleSize, 2);
    // Verify total recorded amountPaid across all payment records equals 1200 (never double-counted!)
    const totalPaidAcrossRecords = case3.updatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    assert.equal(totalPaidAcrossRecords, 1200, 'P6 Case 3: Total amountPaid across debt + advance records equals 1200 with zero double-counting');
    const c3DueAfter = calculateDuePaymentCycles([fifoStudent], [fifoGroup], fifoLessons, case3.updatedPayments);
    assert.equal(c3DueAfter.length, 0, 'P6 Case 3: Zero debt remains after FIFO settlement');
    const c3Credits = getStudentAdvanceLessonCredits('st_fifo', case3.updatedPayments, fifoLessons);
    assert.equal(c3Credits.remainingAdvanceLessons, 2, 'P6 Case 3: Strictly 2 advance lessons credit remain (same-day settled lessons do not eat credit)');
    // Single treasury income transaction yields exact 1200 balance increase
    const treasuryAfterSingleTx = computeAccountBalance(
      { id: 'acc_cash', name: 'Cash', type: 'cash', initialBalance: 0 } as any,
      [
        {
          id: 'tx_fifo_1',
          type: 'income',
          amount: 1200,
          accountId: 'acc_cash',
          date: '2026-11-22',
          relatedPaymentId: case3.primaryPaymentRecordId
        } as any
      ]
    );
    assert.equal(treasuryAfterSingleTx, 1200, 'P6 Case 3: Treasury receives strictly one income transaction of 1200');
    console.log('✓ P6 (FIFO allocation <1 debt, <2 debts, >all debts, no double-counting) passed');
  }

  // =========================================================================
  // P19: Old-Group Historical Debt Retained After Single & Bulk Student Move
  // =========================================================================
  {
    const oldGroup: Group = {
      id: 'g_old',
      name: 'Old Group A1',
      grade: 'A1',
      type: 'online',
      sessionCount: 4,
      monthlyPackagePrice: 800, // 200 per session
      paymentModel: 'package',
      status: 'active'
    } as Group;

    const newGroup: Group = {
      id: 'g_new',
      name: 'New Group A2',
      grade: 'A2',
      type: 'online',
      sessionCount: 4,
      monthlyPackagePrice: 2000, // 500 per session (must NEVER be used for old group history!)
      paymentModel: 'package',
      status: 'active'
    } as Group;

    const studentBeforeMove: Student = {
      id: 'st_moved_1',
      name: 'Karim',
      groupId: 'g_old',
      grade: 'A1',
      status: 'active',
      joinedDate: '2026-09-01',
      paymentPlan: '4_lessons',
      bundleSize: 4
    } as unknown as Student;

    const secondStudentBeforeMove: Student = {
      id: 'st_moved_2',
      name: 'Salma',
      groupId: 'g_old',
      grade: 'A1',
      status: 'active',
      joinedDate: '2026-09-01',
      paymentPlan: '4_lessons',
      bundleSize: 4
    } as unknown as Student;

    // 4 attended unpaid old-group lessons (= 800 historical debt), PLUS 1 paid, 1 exempted, 1 absent, and 1 post-move lesson
    const oldGroupLessons: Lesson[] = [
      ...[1, 2, 3, 4].map((num) => ({
        id: `l_old_unpaid_${num}`,
        groupId: 'g_old',
        groupName: oldGroup.name,
        title: `Old Unpaid ${num}`,
        date: `2026-10-0${num}`,
        time: '17:00',
        type: 'online',
        sessionNumber: num,
        totalSessionsInPackage: 4,
        status: 'completed',
        paymentStatus: 'pending',
        amountDue: 200,
        report: {
          attendanceStatus: 'present',
          studentAttendance: { st_moved_1: 'present', st_moved_2: 'present' }
        }
      } as unknown as Lesson)),
      {
        id: 'l_old_paid',
        groupId: 'g_old',
        groupName: oldGroup.name,
        date: '2026-10-05',
        time: '17:00',
        status: 'completed',
        paymentStatus: 'paid',
        amountDue: 200,
        studentPayments: {
          st_moved_1: { studentId: 'st_moved_1', studentName: 'Karim', paymentStatus: 'paid', amountDue: 200, amountPaid: 200 },
          st_moved_2: { studentId: 'st_moved_2', studentName: 'Salma', paymentStatus: 'paid', amountDue: 200, amountPaid: 200 }
        },
        report: { studentAttendance: { st_moved_1: 'present', st_moved_2: 'present' } }
      } as unknown as Lesson,
      {
        id: 'l_old_exempt',
        groupId: 'g_old',
        groupName: oldGroup.name,
        date: '2026-10-06',
        time: '17:00',
        status: 'completed',
        paymentStatus: 'exempted',
        amountDue: 200,
        report: { studentAttendance: { st_moved_1: 'present', st_moved_2: 'present' } }
      } as unknown as Lesson,
      {
        id: 'l_old_absent',
        groupId: 'g_old',
        groupName: oldGroup.name,
        date: '2026-10-07',
        time: '17:00',
        status: 'completed',
        paymentStatus: 'pending',
        amountDue: 200,
        report: { studentAttendance: { st_moved_1: 'absent', st_moved_2: 'absent' } }
      } as unknown as Lesson
    ];

    const preMoveDebtSingle = calculateDuePaymentCycles([studentBeforeMove], [oldGroup, newGroup], oldGroupLessons, [])
      .reduce((s, c) => s + c.amountDue, 0);
    assert.equal(preMoveDebtSingle, 800, 'P19 Pre-move debt for Karim is 800 (4 attended unpaid lessons at 200)');

    // Single move on 2026-10-10 via real production helper buildMovedStudentRecord
    const movedSingle = buildMovedStudentRecord(studentBeforeMove, oldGroup, newGroup, '2026-10-10');
    const postMoveOldGroupLesson: Lesson = {
      id: 'l_old_after_move',
      groupId: 'g_old',
      groupName: oldGroup.name,
      date: '2026-10-20', // AFTER leftDate 2026-10-10 -> must NOT be billed to Karim!
      time: '17:00',
      status: 'completed',
      paymentStatus: 'pending',
      amountDue: 200
    } as Lesson;
    const allLessonsAfterMove = [...oldGroupLessons, postMoveOldGroupLesson];

    const postMoveCyclesSingle = calculateDuePaymentCycles([movedSingle], [oldGroup, newGroup], allLessonsAfterMove, []);
    const postMoveDebtSingle = postMoveCyclesSingle.reduce((s, c) => s + c.amountDue, 0);
    assert.equal(postMoveDebtSingle, preMoveDebtSingle, 'P19 Single Move: Total debt after move equals pre-move historical debt (800, NOT 2000 and NOT 0)');
    assert.deepEqual(
      postMoveCyclesSingle[0].lessonIds,
      ['l_old_unpaid_1', 'l_old_unpaid_2', 'l_old_unpaid_3', 'l_old_unpaid_4'],
      'P19 Single Move: Retains exact attended unpaid lesson IDs while excluding paid, exempted, absent, and post-move lessons'
    );

    // After restart (JSON round-trip)
    const restartedSingle: Student = JSON.parse(JSON.stringify(movedSingle));
    const restartedLessonsP19: Lesson[] = JSON.parse(JSON.stringify(allLessonsAfterMove));
    const debtAfterRestartSingle = calculateDuePaymentCycles([restartedSingle], [oldGroup, newGroup], restartedLessonsP19, [])
      .reduce((s, c) => s + c.amountDue, 0);
    assert.equal(debtAfterRestartSingle, preMoveDebtSingle, 'P19 Single Move: Historical debt survives restart unchanged');

    // After sync (mergeEntities with remote stale copy before move)
    const syncedStudentsSingle = mergeEntities(
      [restartedSingle],
      [{ ...studentBeforeMove, updatedAt: restartedSingle.updatedAt! - 5000 }],
      { entityTypeName: 'students' }
    ).merged;
    const debtAfterSyncSingle = calculateDuePaymentCycles(syncedStudentsSingle, [oldGroup, newGroup], restartedLessonsP19, [])
      .reduce((s, c) => s + c.amountDue, 0);
    assert.equal(debtAfterSyncSingle, preMoveDebtSingle, 'P19 Single Move: Historical debt survives sync merge unchanged');

    // Bulk move (both Karim & Salma moved together)
    const preMoveDebtBulk = calculateDuePaymentCycles([studentBeforeMove, secondStudentBeforeMove], [oldGroup, newGroup], oldGroupLessons, [])
      .reduce((s, c) => s + c.amountDue, 0);
    assert.equal(preMoveDebtBulk, 1600, 'P19 Bulk Move: Combined pre-move debt is 1600');

    const movedBulk = [studentBeforeMove, secondStudentBeforeMove].map(s => buildMovedStudentRecord(s, oldGroup, newGroup, '2026-10-10'));
    const postMoveDebtBulk = calculateDuePaymentCycles(movedBulk, [oldGroup, newGroup], allLessonsAfterMove, [])
      .reduce((s, c) => s + c.amountDue, 0);
    assert.equal(postMoveDebtBulk, preMoveDebtBulk, 'P19 Bulk Move: Combined debt after move equals 1600');

    const syncedBulk = mergeEntities(
      JSON.parse(JSON.stringify(movedBulk)),
      [
        { ...studentBeforeMove, updatedAt: movedBulk[0].updatedAt! - 5000 },
        { ...secondStudentBeforeMove, updatedAt: movedBulk[1].updatedAt! - 5000 }
      ],
      { entityTypeName: 'students' }
    ).merged;
    const debtAfterSyncBulk = calculateDuePaymentCycles(syncedBulk, [oldGroup, newGroup], restartedLessonsP19, [])
      .reduce((s, c) => s + c.amountDue, 0);
    assert.equal(debtAfterSyncBulk, preMoveDebtBulk, 'P19 Bulk Move: Combined debt survives restart & sync unchanged');

    // Unknown historical price: MUST flag for review instead of guessing or using new group's price
    const studentWithUnknownHistory: Student = {
      id: 'st_unknown_price',
      name: 'Youssef',
      groupId: 'g_new',
      status: 'active',
      previousGroupIds: ['g_deleted_unpriced']
    } as unknown as Student;
    const unpricedOldLesson: Lesson = {
      id: 'l_unpriced_old',
      groupId: 'g_deleted_unpriced',
      groupName: 'Deleted Old Group',
      date: '2026-09-15',
      time: '16:00',
      status: 'completed',
      paymentStatus: 'pending',
      report: { studentAttendance: { st_unknown_price: 'present' } }
    } as unknown as Lesson;

    const unknownCycles = calculateDuePaymentCycles([studentWithUnknownHistory], [newGroup], [unpricedOldLesson], []);
    assert.equal(unknownCycles.length, 1);
    assert.equal(unknownCycles[0].needsPricingReview, true, 'P19 Unknown Price: Cycle is flagged needsPricingReview=true');
    assert.equal(unknownCycles[0].amountDue, 0, 'P19 Unknown Price: Does not guess or reprice using newGroup');
    const flaggedRecords = getUnresolvedHistoricalLessonDebts();
    assert.equal(flaggedRecords.some(r => r.lessonId === 'l_unpriced_old' && r.studentId === 'st_unknown_price'), true, 'P19 Unknown Price: Exposed in getUnresolvedHistoricalLessonDebts() for manual review');

    console.log('✓ P19 (single & bulk move historical debt retention, restart, sync, unknown-price review flag) passed');
  }

  // =========================================================================
  // Discount Preservation on Group Package Price Edit (no dropping, no double-subtraction)
  // =========================================================================
  {
    const grpDisc: Group = {
      id: 'g_disc',
      name: 'Discount Group',
      grade: 'B1',
      type: 'online',
      sessionCount: 4,
      monthlyPackagePrice: 1200, // Updated from 1000 -> 1200
      paymentModel: 'package',
      status: 'active'
    } as Group;

    const stDisc: Student = {
      id: 'st_disc',
      name: 'Laila',
      groupId: 'g_disc',
      status: 'active',
      paymentPlan: '4_lessons',
      bundleSize: 4
    } as unknown as Student;

    const discLessons: Lesson[] = [1, 2, 3, 4].map(n => ({
      id: `l_disc_${n}`,
      groupId: 'g_disc',
      date: `2026-11-0${n}`,
      time: '17:00',
      status: 'completed',
      sessionNumber: n,
      totalSessionsInPackage: 4,
      amountDue: 250
    } as Lesson));

    const existingPendingWithDiscount: PaymentRecord = {
      id: 'pay_disc_1',
      studentId: 'st_disc',
      studentName: 'Laila',
      groupId: 'g_disc',
      groupName: 'Discount Group',
      bundleSize: 4,
      amountDue: 1000,
      amountPaid: 200,
      discountAmount: 150,
      remainingBalance: 650,
      dueDate: '2026-11-04',
      status: 'partial',
      lessonIds: ['l_disc_1', 'l_disc_2', 'l_disc_3', 'l_disc_4'],
      lessonDates: ['01/11/2026 (Session 1/4)', '02/11/2026 (Session 2/4)', '03/11/2026 (Session 3/4)', '04/11/2026 (Session 4/4)']
    } as PaymentRecord;

    const recalc = recalculatePendingPaymentsForGroupPriceChange(
      [existingPendingWithDiscount],
      'g_disc',
      new Set(['st_disc']),
      1200,
      4
    );
    assert.equal(recalc.changed, true);
    const updatedPay = recalc.updatedPayments[0];
    assert.equal(updatedPay.amountDue, 1200, 'Discount Audit: Package gross amountDue updated to 1200');
    assert.equal(updatedPay.discountAmount, 150, 'Discount Audit: Existing discountAmount (150) is preserved');
    assert.equal(updatedPay.amountPaid, 200, 'Discount Audit: Existing amountPaid (200) is preserved');
    assert.equal(updatedPay.remainingBalance, 850, 'Discount Audit: remainingBalance is 1200 - 200 - 150 = 850');
    assert.equal(updatedPay.status, 'partial');

    const cyclesAfterPriceEdit = calculateDuePaymentCycles([stDisc], [grpDisc], discLessons, recalc.updatedPayments);
    assert.equal(cyclesAfterPriceEdit.length, 1);
    assert.equal(cyclesAfterPriceEdit[0].amountDue, 850, 'Discount Audit: calculateDuePaymentCycles returns net 850 (not 1000 and not 700)');

    const bannerTotals = calculateStudentDueBannerTotals(cyclesAfterPriceEdit, recalc.updatedPayments);
    assert.equal(bannerTotals.totalAmountDueFromStudents, 850, 'Discount Audit: Banner totals return exact 850 with no double-subtraction');
    console.log('✓ Discount preservation on package price edit passed');
  }

  // =========================================================================
  // P20: Moving a lesson resequences session numbers for BOTH source and destination groups
  // =========================================================================
  {
    const lessonsBeforeMove: Lesson[] = [
      {
        id: 'gA_1',
        groupId: 'gA',
        date: '2026-11-01',
        time: '17:00',
        status: 'completed',
        sessionNumber: 1,
        totalSessionsInPackage: 4
      } as Lesson,
      {
        id: 'gA_2_moving',
        groupId: 'gB', // moved from gA to gB
        date: '2026-11-05',
        time: '17:00',
        status: 'scheduled',
        sessionNumber: 2,
        totalSessionsInPackage: 4
      } as Lesson,
      {
        id: 'gA_3',
        groupId: 'gA',
        date: '2026-11-08',
        time: '17:00',
        status: 'scheduled',
        sessionNumber: 3,
        totalSessionsInPackage: 4
      } as Lesson,
      {
        id: 'gB_1',
        groupId: 'gB',
        date: '2026-11-02',
        time: '17:00',
        status: 'completed',
        sessionNumber: 1,
        totalSessionsInPackage: 4
      } as Lesson
    ];

    const afterSourceReseq = resequenceScheduledLessonsAfterChange(lessonsBeforeMove, { groupId: 'gA' });
    const afterBothReseq = resequenceScheduledLessonsAfterChange(afterSourceReseq, { groupId: 'gB' });

    const gA3 = afterBothReseq.find((l) => l.id === 'gA_3')!;
    const gA2Moved = afterBothReseq.find((l) => l.id === 'gA_2_moving')!;
    assert.equal(gA3.sessionNumber, 2, 'P20: Source group gA remaining scheduled lesson resequenced from 3 to 2');
    assert.equal(gA2Moved.sessionNumber, 2, 'P20: Destination group gB moved lesson sequenced to 2 after gB_1');
    console.log('✓ P20 passed');
  }

  // =========================================================================
  // P21: Multiple schedule slots on the same day are all generated
  // =========================================================================
  {
    const twoSlotSameDayGroup: Group = {
      id: 'g_multi_same_day',
      name: 'Double Sunday Group',
      grade: 'A1',
      type: 'online',
      scheduleDays: ['So'],
      scheduleTime: '10:00',
      scheduleSlots: [
        { day: 'So', time: '10:00' },
        { day: 'So', time: '18:00' }
      ],
      sessionCount: 8,
      monthlyPackagePrice: 1600,
      status: 'active',
      color: '#4f46e5'
    } as unknown as Group;

    const sundayLessons = getLessonsForDate('2026-11-22', [], [twoSlotSameDayGroup], []);
    assert.equal(sundayLessons.length, 2, 'P21: Both Sunday slots (10:00 and 18:00) are generated');
    assert.deepEqual(
      sundayLessons.map((l) => l.time),
      ['10:00', '18:00']
    );
    console.log('✓ P21 passed');
  }

  // =========================================================================
  // P23: Homework auto-closes strictly 14 days after dueDate / deadline
  // =========================================================================
  {
    const dueIso = '2026-11-01T12:00:00.000Z';
    const dueMs = Date.parse(dueIso);
    const hwBase: any = {
      id: 'hw_p23',
      title: 'Test Homework',
      deadline: dueIso,
      isActive: true,
      status: 'active',
      audienceMode: 'open',
      allowedGameModes: ['classic_quiz'],
      questionCount: 5,
      maxAttempts: 2,
      allowReplay: true,
      createdAt: '2026-10-25T12:00:00.000Z',
      createdBy: 'Teacher',
      setSnapshot: { id: 's1', title: 'Set 1', items: [] }
    };

    // Exactly 14 days after due date -> still open
    const exactly14DaysMs = dueMs + 14 * 24 * 60 * 60 * 1000;
    assert.equal(isHomeworkAutoClosedAfterDueDate(hwBase, exactly14DaysMs), false);
    assert.equal(isHomeworkAssignmentOpenForStudents(hwBase, exactly14DaysMs), true);

    // 14 days + 1 ms after due date -> auto-closed!
    const after14DaysMs = dueMs + 14 * 24 * 60 * 60 * 1000 + 1;
    assert.equal(isHomeworkAutoClosedAfterDueDate(hwBase, after14DaysMs), true);
    assert.equal(isHomeworkAssignmentOpenForStudents(hwBase, after14DaysMs), false);

    // Past assignment normalized with current Date.now() (2026-11-22 > 2026-11-15) -> auto-closed
    const normalizedExpired = normalizeHomeworkAssignment(hwBase);
    assert.equal(normalizedExpired.isActive, false, 'P23: normalizeHomeworkAssignment marks expired (>14d past deadline) homework as isActive=false');
    assert.equal(normalizedExpired.status, 'closed', 'P23: normalizeHomeworkAssignment marks expired (>14d past deadline) homework as status=closed');
    console.log('✓ P23 passed');
  }

  // =========================================================================
  // P24, P25, P26, P27: Notifications & Pending Counters
  // =========================================================================
  {
    // P24: sendSystemNotification returns false when Notification permission is not granted in non-native environment
    const sentWhenNoNotificationApi = await sendSystemNotification('Test', 'Body', 'general');
    assert.equal(sentWhenNoNotificationApi, false, 'P24: sendSystemNotification returns false when notification cannot be dispatched');

    // P25: 00:00 (12 AM) hour parsing with ??
    const [rawHrs, rawMins] = '00:00'.split(':').map(Number);
    const hrs = Number.isFinite(rawHrs) ? rawHrs : undefined;
    const mins = Number.isFinite(rawMins) ? rawMins : undefined;
    const d = new Date(2026, 10, 22, 15, 30, 0, 0);
    d.setHours(hrs ?? 20, mins ?? 0, 0, 0);
    assert.equal(d.getHours(), 0, 'P25: 00:00 sets hours to 0 (midnight), not 20');

    // P27: Versioned notification channel IDs change when priority or sound changes
    const settingsHighBeep = {
      masterEnabled: true,
      alarmModeEnabled: true,
      lessonReminderMinutesBefore: 15,
      dailySummaryTime: '20:00',
      dailySummaryIncludeLessons: true,
      dailySummaryIncludePendingPayments: true,
      lessonReminder: { enabled: true, priority: 'high', sound: 'beep' },
      lessonStart: { enabled: true, priority: 'high', sound: 'default' },
      paymentDue: { enabled: true, priority: 'default', sound: 'default' },
      dailySummary: { enabled: true, priority: 'low', sound: 'silent' },
      attendanceReminder: { enabled: true, priority: 'default', sound: 'chime' }
    } as unknown as NotificationSettings;

    const settingsLowChime = {
      ...settingsHighBeep,
      paymentDue: { enabled: true, priority: 'high', sound: 'chime' }
    } as unknown as NotificationSettings;

    const chan1 = resolveNotificationChannelId('payment_due', settingsHighBeep);
    const chan2 = resolveNotificationChannelId('payment_due', settingsLowChime);
    assert.notEqual(chan1, chan2, 'P27: Changing priority/sound produces a new versioned Android channel ID');
    assert.notEqual(
      getNotificationChannelSettingsSignature(settingsHighBeep),
      getNotificationChannelSettingsSignature(settingsLowChime),
      'P27: Channel settings signature updates when priority/sound changes'
    );
    console.log('✓ P24, P25, P26, P27 passed');
  }

  // =========================================================================
  // P28 & P29 [NEEDS VERIFICATION]: Cleanup Archive Cap (1000) & Abort on Failure
  // =========================================================================
  {
    const sampleLesson: Lesson = {
      id: 'l_auto_g1_2026-12-25_1700',
      groupId: 'g1',
      groupName: 'Group 1',
      title: 'Future Bloat',
      date: '2026-12-25',
      time: '17:00',
      type: 'online',
      status: 'scheduled',
      sessionNumber: 1,
      totalSessionsInPackage: 8,
      paymentStatus: 'pending',
      amountDue: 200
    } as Lesson;

    const analysis = analyzeLessonCleanup(
      [sampleLesson],
      [{ id: 'g1', name: 'Group 1', status: 'active' } as Group],
      [],
      [],
      [],
      new Date(2026, 10, 22, 10, 0, 0)
    );

    // P29: Simulate storage write failure on PRUNED_LESSONS_BACKUP_KEY ('gluck_pruned_lessons_archive')
    __setStorageFailureHookForTests((op, key) => {
      if (op === 'set' && (key === 'gluck_pruned_lessons_archive' || key === 'dl_pruned_lessons_backup_archive')) {
        throw new Error('Simulated Disk Full');
      }
    });

    let abortedOnStorageError = false;
    try {
      await executeLessonCleanup([sampleLesson], analysis);
    } catch (err: any) {
      abortedOnStorageError = String(err?.message || '').includes('Cleanup aborted');
    } finally {
      __setStorageFailureHookForTests(null);
    }
    assert.equal(abortedOnStorageError, true, 'P29: executeLessonCleanup aborts before deleting lessons if archive write fails');
    console.log('✓ P28 & P29 passed');
  }

  // =========================================================================
  // P31 & P32: Storage Eviction Protection & Automated Monthly/Weekly Backups
  // =========================================================================
  {
    assert.equal(
      HEAVY_EVICTABLE_LOCALSTORAGE_KEYS.includes('dl_lessons'),
      false,
      'P31: dl_lessons must not be in HEAVY_EVICTABLE_LOCALSTORAGE_KEYS'
    );
    assert.equal(
      HEAVY_EVICTABLE_LOCALSTORAGE_KEYS.includes('dl_payments'),
      false,
      'P31: dl_payments must not be in HEAVY_EVICTABLE_LOCALSTORAGE_KEYS'
    );

    // P32: Monthly and Weekly automated backup triggers
    assert.equal(
      shouldRunAutomatedBackup({
        todayStr: '2026-11-22',
        lastAutoBackupDate: '2026-11-20',
        isDailyEnabled: false,
        isWeeklyEnabled: true,
        isMonthlyEnabled: false
      }),
      false,
      'P32: Weekly backup does not run when only 2 days have elapsed'
    );
    assert.equal(
      shouldRunAutomatedBackup({
        todayStr: '2026-11-27',
        lastAutoBackupDate: '2026-11-20',
        isDailyEnabled: false,
        isWeeklyEnabled: true,
        isMonthlyEnabled: false
      }),
      true,
      'P32: Weekly backup runs when 7+ days have elapsed'
    );
    assert.equal(
      shouldRunAutomatedBackup({
        todayStr: '2026-12-01',
        lastAutoBackupDate: '2026-11-20',
        isDailyEnabled: false,
        isWeeklyEnabled: false,
        isMonthlyEnabled: true
      }),
      true,
      'P32: Monthly backup runs when month rolls over or 30+ days have elapsed'
    );
    console.log('✓ P31 & P32 passed');
  }

  // =========================================================================
  // P34 [NEEDS VERIFICATION]: Legacy Homework Claim with Empty groupId/setId
  // =========================================================================
  {
    const emptyClaim = canAccountClaimLegacyHomework(
      { id: 'hw_empty_fields', groupId: '', setSnapshot: { id: '' } },
      { uid: 'teacher_1', ownedGroupIds: [''], ownedSetIds: [''] }
    );
    assert.equal(
      emptyClaim.provableForTarget,
      false,
      'P34: Empty groupId or setId never matches ownedGroupIds or ownedSetIds'
    );
    console.log('✓ P34 passed');
  }

  // =========================================================================
  // C41, C42, C43, C44, C45: Zoom Priority, Dashboard Actions & APK Workflow
  // =========================================================================
  {
    // C41: Active weekly session Zoom link takes priority over group.zoomLink and lesson.meetingLink
    const grp: Group = {
      id: 'g_c41',
      name: 'C41 Online Group',
      type: 'online',
      zoomLink: 'https://zoom.us/j/22222222222',
      scheduleSlots: [{ day: 'So', time: '17:00' }],
      status: 'active'
    } as unknown as Group;

    const session: GroupWeeklySession = {
      id: 'sess_c41',
      groupId: 'g_c41',
      weekday: 0,
      startTime: '17:00',
      durationMinutes: 60,
      timezone: 'Africa/Cairo',
      standardizedTitle: 'Sunday - 17:00 - C41 Online Group',
      readableSessionCode: 'C41-SUN-1700',
      zoomJoinUrl: 'https://zoom.us/j/99999999999?pwd=SESSION_PRIORITY',
      meetingSource: 'zoom_api',
      syncState: 'synced',
      isActive: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: Date.now()
    } as unknown as GroupWeeklySession;

    const staleLesson: Lesson = {
      id: 'l_auto_g_c41_2026-11-22_1700',
      groupId: 'g_c41',
      groupName: grp.name,
      date: '2026-11-22',
      time: '17:00',
      type: 'online',
      status: 'scheduled',
      meetingLink: 'https://zoom.us/j/11111111111?pwd=STALE_LESSON'
    } as Lesson;

    const resolvedUrl = resolveActiveZoomLinkForLesson({
      group: grp,
      lesson: staleLesson,
      groupWeeklySessions: [session],
      defaultZoomLink: 'https://zoom.us/j/00000000000'
    });
    assert.equal(resolvedUrl, 'https://zoom.us/j/99999999999?pwd=SESSION_PRIORITY');

    const dailyLessons = getLessonsForDate('2026-11-22', [staleLesson], [grp], [session]);
    assert.equal(
      dailyLessons[0]?.meetingLink,
      'https://zoom.us/j/99999999999?pwd=SESSION_PRIORITY',
      'C41: getLessonsForDate / getProjectedLessonsForRange refreshes explicit scheduled online lesson meetingLink from active session'
    );

    // C43: Offline location resolution & student contact validation
    const offlineGroup: Group = {
      id: 'g_off',
      name: 'Offline Dokki',
      type: 'offline',
      locationName: 'Dokki Center',
      address: '123 Tahrir St, Dokki',
      googleMapsUrl: 'https://maps.google.com/?q=Dokki+Center',
      status: 'active'
    } as unknown as Group;
    const offlineLesson: Lesson = {
      id: 'l_off_1',
      groupId: 'g_off',
      date: '2026-11-22',
      time: '15:00',
      type: 'offline',
      status: 'scheduled'
    } as Lesson;

    const loc = resolveOfflineLessonDisplayLocation(offlineLesson, offlineGroup);
    assert.equal(loc, '123 Tahrir St, Dokki', 'C43: Offline lesson resolves display location from group address');

    const studentsWithoutPhone: Student[] = [
      { id: 's_no_phone', name: 'No Phone Student', groupId: 'g_off', studentPhone: '', parentPhone: '+201012345678' } as Student
    ];
    const validStudentContactsEmpty = getValidStudentContactsForLesson(offlineLesson, [offlineGroup], studentsWithoutPhone);
    assert.equal(
      validStudentContactsEmpty.length,
      0,
      'C43: Student Message action is hidden when no student in the lesson has a valid studentPhone'
    );

    const studentsWithPhone: Student[] = [
      { id: 's_with_phone', name: 'Has Phone Student', groupId: 'g_off', studentPhone: '+201098765432' } as Student
    ];
    const validStudentContacts = getValidStudentContactsForLesson(offlineLesson, [offlineGroup], studentsWithPhone);
    assert.equal(validStudentContacts.length, 1, 'C43: Student Message action is available when student has a valid studentPhone');

    // C44 & C45: Verify .github/workflows/build-apk.yml has unique release tag, Gradle cache, and parallel Stage-1 jobs
    const workflowPath = path.resolve(process.cwd(), '.github/workflows/build-apk.yml');
    const workflowYaml = fs.readFileSync(workflowPath, 'utf8');
    assert.equal(
      workflowYaml.includes('tag_name: apk-${{ github.run_number }}'),
      true,
      'C44: build-apk.yml uses unique tag_name apk-${{ github.run_number }}'
    );
    assert.equal(
      workflowYaml.includes('./gradlew assembleRelease --build-cache --stacktrace'),
      true,
      'C45: build-apk.yml builds with --build-cache without wiping cache via clean'
    );
    for (const jobKey of ['verify-config:', 'lint-and-typecheck:', 'unit-tests:', 'build-apk:', 'publish-release:']) {
      assert.equal(
        workflowYaml.includes(`  ${jobKey}`),
        true,
        `APK CI parallelization: build-apk.yml defines job ${jobKey}`
      );
    }
    assert.equal(
      workflowYaml.includes('needs: [verify-config, lint-and-typecheck, unit-tests, build-apk]'),
      true,
      'APK CI parallelization: publish-release gates on all parallel Stage-1 jobs'
    );
    assert.equal(
      workflowYaml.includes('node scripts/run_test_shard.cjs --shard=${{ matrix.shard }} --total=3'),
      true,
      'APK CI parallelization: unit-tests runs sharded suites across 3 parallel runners'
    );
    assert.equal(
      workflowYaml.includes('gh release list --repo "${{ github.repository }}"'),
      true,
      'APK CI parallelization: publish-release passes --repo explicitly without checkout'
    );
    assert.equal(
      workflowYaml.includes('META-INF/MANIFEST.MF') && workflowYaml.includes('Main-Class'),
      true,
      'APK CI parallelization: build-apk.yml validates gradle-wrapper.jar Main-Class and regenerates if corrupt'
    );
    const shardRunnerPath = path.resolve(process.cwd(), 'scripts/run_test_shard.cjs');
    const shardRunnerSrc = fs.readFileSync(shardRunnerPath, 'utf8');
    assert.equal(
      shardRunnerSrc.includes("'node_modules', '.bin'") && shardRunnerSrc.includes('path.delimiter'),
      true,
      'APK CI parallelization: run_test_shard.cjs prepends node_modules/.bin to PATH so tsx resolves on CI runners'
    );
    const timelinePath = path.resolve(process.cwd(), 'src/components/TodaysProgressTimeline.tsx');
    const timelineSrc = fs.readFileSync(timelinePath, 'utf8');
    const offlineRenderMatches = timelineSrc.match(/\{offlineLocationText\}/g) || [];
    assert.equal(
      offlineRenderMatches.length,
      1,
      'Today timeline UI: offlineLocationText is rendered only once (in the expanded card) and hidden in the collapsed row'
    );
    const gradlePropsPath = path.resolve(process.cwd(), 'android/gradle.properties');
    const gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
    assert.equal(
      gradleProps.includes('org.gradle.parallel=true') && gradleProps.includes('org.gradle.caching=true'),
      true,
      'APK CI parallelization: android/gradle.properties enables parallel execution and build cache'
    );
    console.log('✓ C41, C43, C44, C45, collapsed address & parallel APK CI checks passed');
  }

  console.log('=== ALL REMAINING ISSUES REGRESSION TESTS PASSED ===');
}

runTests().catch((err) => {
  console.error('Regression test failed:', err);
  process.exit(1);
});
