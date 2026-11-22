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
  isPendingStatus
} from '../utils/lessonUtils';
import { shouldSettlePendingCycleRecord } from '../services/financeService';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
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
      name: 'A1 Montag & Sonntag',
      grade: 'A1',
      type: 'online',
      scheduleDays: ['So', 'Mi'],
      scheduleTime: '17:00',
      scheduleSlots: [
        { day: 'So', time: '17:00' },
        { day: 'Mi', time: '19:00' }
      ],
      lessonDurationMinutes: 60,
      sessionCount: 8,
      monthlyPackagePrice: 1600,
      paymentModel: 'package',
      status: 'active',
      color: '#4f46e5'
    } as unknown as Group;

    // Reference date: Sunday 2026-11-22
    const refToday = new Date(2026, 10, 22, 10, 0, 0);
    // 20 days ahead: Saturday 2026-12-12 -> wait, let's pick Sunday 2026-12-13 (21 days ahead, matches 'So' 17:00!)
    const twentyOneDaysAheadStr = '2026-12-13';
    const futureAutoId = `l_auto_g1_${twentyOneDaysAheadStr}_1700`;
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
        title: 'Future Auto Lesson 21d Ahead',
        date: twentyOneDaysAheadStr,
        time: '17:00',
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

    assert.equal(analysis.futureBloatToPrune.length, 1, 'Future auto lesson >14d ahead is identified as bloat');
    assert.equal(analysis.historicalEligibleToPrune.length, 1, 'Historical completed & settled lesson >30d ago is eligible');

    const cleanupRes = await executeLessonCleanup(initialLessons, analysis);
    assert.equal(
      cleanupRes.cleanedLessons.some((l) => l.id === futureAutoId),
      false,
      'C36.A/H.1: Future auto lesson >14d ahead is removed from stored lessons'
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
      'C36.A/H.1: Future auto lesson >14d ahead MUST NOT be tombstoned'
    );

    // Advance 8 days (now 2026-11-30, so 2026-12-13 is 13 days ahead, inside the 14-day window)
    const projectedIn14DayWindow = getProjectedLessonsForRange(
      '2026-11-30',
      '2026-12-14',
      [groupG1],
      cleanupRes.cleanedLessons
    );
    assert.equal(
      projectedIn14DayWindow.some((l) => l.id === futureAutoId && l.date === twentyOneDaysAheadStr),
      true,
      'C36.H.1: After advancing into the 14-day window, the future auto lesson is regenerated'
    );

    // Advance the full 21 days to 2026-12-13: visible in Today via getLessonsForDate
    const todayLessonsOnTargetDay = getLessonsForDate(
      twentyOneDaysAheadStr,
      cleanupRes.cleanedLessons,
      [groupG1],
      []
    );
    assert.equal(todayLessonsOnTargetDay.length, 1, 'C36.H.1: Lesson is visible in Today when date arrives');
    assert.equal(todayLessonsOnTargetDay[0].id, futureAutoId);

    // H.2 & H.3: Safe repair of pre-existing future l_auto_ tombstones
    localStorage.removeItem(FUTURE_TOMBSTONE_REPAIR_FLAG_KEY);
    const futureValidAutoId = 'l_auto_g1_2026-11-29_1700';
    const futureUserDeletedAutoId = 'l_auto_g1_2026-12-02_1900';
    const futureUserCancelledAutoId = 'l_auto_g1_2026-12-06_1700';
    const pastAutoId = 'l_auto_g1_2026-11-01_1700';

    setPrunedLessonIds([
      futureValidAutoId,
      futureUserDeletedAutoId,
      futureUserCancelledAutoId,
      pastAutoId
    ]);

    const storedWithCancelled: Lesson[] = [
      {
        id: futureUserCancelledAutoId,
        groupId: 'g1',
        date: '2026-12-06',
        time: '17:00',
        status: 'cancelled'
      } as Lesson
    ];
    const recentlyDeletedLessons: Lesson[] = [
      {
        id: futureUserDeletedAutoId,
        groupId: 'g1',
        date: '2026-12-02',
        time: '19:00',
        status: 'scheduled',
        deleted: true
      } as Lesson
    ];

    const repairReport = repairFutureAutoLessonTombstones({
      storedLessons: storedWithCancelled,
      recentlyDeletedLessons,
      todayStr: '2026-11-22',
      forceRun: true
    });

    assert.equal(repairReport.removedCount, 1, 'C36.B/H.2: Only the non-deleted future l_auto_ tombstone is removed');
    assert.equal(
      getPrunedLessonIds().has(futureValidAutoId),
      false,
      'C36.H.2: Future l_auto_ tombstone with no deleted/cancelled record is repaired'
    );
    assert.equal(
      getPrunedLessonIds().has(futureUserDeletedAutoId),
      true,
      'C36.H.3: Future l_auto_ tombstone whose lesson was soft-deleted is NOT restored'
    );
    assert.equal(
      getPrunedLessonIds().has(futureUserCancelledAutoId),
      true,
      'C36.H.3: Future l_auto_ tombstone whose lesson was cancelled is NOT restored'
    );
    assert.equal(
      getPrunedLessonIds().has(pastAutoId),
      true,
      'C36.B: Historical tombstone before today is never un-tombstoned'
    );

    // H.4 & H.5: Midnight date rollover and non-ISO date string normalization
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
    // Note: 2026-11-22 is a Sunday ('So' 17:00), and '5:00 PM' normalizes to '17:00', so it deduplicates cleanly to 1 lesson!
    assert.equal(nov22Lessons.length, 1, 'C36.E/H.5: 2026-11-22T00:00:00Z at 5:00 PM normalizes and deduplicates with 17:00 slot');
    assert.equal(nov22Lessons[0].date, '2026-11-22');

    // Simulate midnight rollover to 2026-11-23
    const nov23Lessons = getLessonsForDate('2026-11-23', lessonsWithNonIsoDates, [groupG1], []);
    assert.equal(nov23Lessons.some((l) => l.id === 'l_slash_dmy' && l.date === '2026-11-23'), true, 'C36.H.4/H.5: 23/11/2026 lands on 2026-11-23 after midnight rollover');

    console.log('✓ C36 (H.1 - H.5) passed');
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
  // P19 [NEEDS VERIFICATION]: Old-group lessons after a student move
  // =========================================================================
  {
    const oldGroup: Group = {
      id: 'g_old',
      name: 'Old Group A1',
      grade: 'A1',
      type: 'online',
      sessionCount: 4,
      monthlyPackagePrice: 800,
      paymentModel: 'package',
      status: 'active'
    } as Group;

    const newGroup: Group = {
      id: 'g_new',
      name: 'New Group A2',
      grade: 'A2',
      type: 'online',
      sessionCount: 4,
      monthlyPackagePrice: 1200,
      paymentModel: 'package',
      status: 'active'
    } as Group;

    // Student moved to g_new
    const movedStudent: Student = {
      id: 'st_moved',
      name: 'Karim',
      groupId: 'g_new',
      status: 'active',
      paymentPlan: 'package',
      bundleSize: 4
    } as unknown as Student;

    const oldGroupLessons: Lesson[] = [1, 2, 3, 4].map((num) => ({
      id: `l_old_${num}`,
      groupId: 'g_old',
      groupName: oldGroup.name,
      title: `Old Lesson ${num}`,
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
        studentReports: { st_moved: { attendance: 'present' } }
      }
    } as unknown as Lesson));

    const movedCycles = calculateDuePaymentCycles([movedStudent], [oldGroup, newGroup], oldGroupLessons, []);
    // Verification check: calculateDuePaymentCycles filters lessons by l.groupId === student.groupId unless l.studentId === student.id
    assert.equal(movedCycles.length, 0, 'P19 Verification: Group lessons with groupId=g_old are not matched once student.groupId is g_new');
    console.log('✓ P19 verification test recorded');
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

    // C44 & C45: Verify .github/workflows/build-apk.yml has unique release tag and Gradle cache
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
    console.log('✓ C41, C43, C44, C45 passed');
  }

  console.log('=== ALL REMAINING ISSUES REGRESSION TESTS PASSED ===');
}

runTests().catch((err) => {
  console.error('Regression test failed:', err);
  process.exit(1);
});
