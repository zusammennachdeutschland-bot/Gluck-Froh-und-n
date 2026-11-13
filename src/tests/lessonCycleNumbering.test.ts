import assert from 'node:assert/strict';
import {
  resolveLessonCycleNumber,
  calculateSequentialSessionNumber,
  resequenceScheduledLessonsAfterChange,
  getGroupCycleInfo,
  computeStartingSessionNumberForTargetLesson,
  compareLessonsChronologically,
  shouldShowLessonPaymentCollection,
} from '../utils/lessonUtils';
import { Group, Lesson, Student } from '../types';

console.log('===============================================================');
console.log('Running Unified Lesson Cycle Numbering Suite (Tests A - P)...');
console.log('===============================================================');

const makeGroup = (overrides?: Partial<Group>): Group => ({
  id: 'grp_cycle_test',
  name: 'Gruppe B1',
  grade: 'Grade 10',
  type: 'online',
  sessionCount: 4,
  startingSessionNumber: 1,
  paymentCycle: 'monthly',
  paymentModel: 'package',
  monthlyPackagePrice: 1200,
  scheduleDays: ['Monday', 'Thursday'],
  scheduleTime: '17:00',
  ...overrides,
} as Group);

const makeLesson = (overrides: Partial<Lesson> & { id: string; date: string }): Lesson => ({
  groupId: 'grp_cycle_test',
  groupName: 'Gruppe B1',
  title: 'Gruppe B1 Lektion',
  time: '17:00',
  durationMinutes: 60,
  type: 'online',
  grade: 'Grade 10',
  sessionNumber: 1,
  totalSessionsInPackage: 4,
  status: 'scheduled',
  paymentStatus: 'pending',
  amountDue: 300,
  amountPaid: 0,
  ...overrides,
} as Lesson);

let passedCount = 0;
const runTest = (name: string, fn: () => void) => {
  fn();
  passedCount += 1;
  console.log(`  ✓ ${name}`);
};

// TEST A: Basic 4-lesson cycle
runTest('TEST A: Basic 4-lesson cycle (1, 2, 3, 4)', () => {
  const group = makeGroup({ sessionCount: 4 });
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'scheduled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 3 }),
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'scheduled', sessionNumber: 4 }),
  ];

  const nums = lessons.map(l => resolveLessonCycleNumber(l, lessons, { group }).sessionNumber);
  assert.deepEqual(nums, [1, 2, 3, 4]);
});

// TEST B: Cancelled lesson in the middle
runTest('TEST B: Cancelled lesson in the middle is excluded and subsequent lessons shift (1, excluded, 2, 3, 4)', () => {
  const group = makeGroup({ sessionCount: 4 });
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'cancelled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 3 }),
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'scheduled', sessionNumber: 4 }),
    makeLesson({ id: 'l5', date: '2026-04-15', status: 'scheduled', sessionNumber: 1 }),
  ];

  const r1 = resolveLessonCycleNumber(lessons[0], lessons, { group });
  const r2 = resolveLessonCycleNumber(lessons[1], lessons, { group });
  const r3 = resolveLessonCycleNumber(lessons[2], lessons, { group });
  const r4 = resolveLessonCycleNumber(lessons[3], lessons, { group });
  const r5 = resolveLessonCycleNumber(lessons[4], lessons, { group });

  assert.equal(r1.sessionNumber, 1);
  assert.equal(r2.isExcluded, true);
  assert.equal(r2.sessionNumber, 0);
  assert.equal(r3.sessionNumber, 2, 'Lesson 3 must be Session 2 after Lesson 2 is cancelled');
  assert.equal(r4.sessionNumber, 3, 'Lesson 4 must be Session 3 after Lesson 2 is cancelled');
  assert.equal(r5.sessionNumber, 4, 'Lesson 5 must be Session 4 after Lesson 2 is cancelled');

  const resequenced = resequenceScheduledLessonsAfterChange(lessons, lessons[1], { group });
  assert.equal(resequenced.find(l => l.id === 'l3')!.sessionNumber, 2);
  assert.equal(resequenced.find(l => l.id === 'l4')!.sessionNumber, 3);
  assert.equal(resequenced.find(l => l.id === 'l5')!.sessionNumber, 4);
});

// TEST C: Multiple cancelled lessons
runTest('TEST C: Multiple consecutive cancelled lessons never consume cycle numbers', () => {
  const group = makeGroup({ sessionCount: 4 });
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'cancelled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'cancelled', sessionNumber: 3 }),
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'scheduled', sessionNumber: 4 }),
  ];

  assert.equal(resolveLessonCycleNumber(lessons[0], lessons, { group }).sessionNumber, 1);
  assert.equal(resolveLessonCycleNumber(lessons[1], lessons, { group }).isExcluded, true);
  assert.equal(resolveLessonCycleNumber(lessons[2], lessons, { group }).isExcluded, true);
  assert.equal(resolveLessonCycleNumber(lessons[3], lessons, { group }).sessionNumber, 2, 'Lesson 4 must be Session 2');
});

// TEST D: Cancelled first lesson
runTest('TEST D: Cancelled first lesson is excluded; Lesson 2 becomes #1 and Lesson 3 becomes #2', () => {
  const group = makeGroup({ sessionCount: 4 });
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'cancelled', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'scheduled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 3 }),
  ];

  assert.equal(resolveLessonCycleNumber(lessons[0], lessons, { group }).isExcluded, true);
  assert.equal(resolveLessonCycleNumber(lessons[1], lessons, { group }).sessionNumber, 1);
  assert.equal(resolveLessonCycleNumber(lessons[2], lessons, { group }).sessionNumber, 2);
});

// TEST E: Un-cancelling a cancelled lesson
runTest('TEST E: Un-cancelling a cancelled lesson restores its number (#2) and shifts Lesson 3 to #3', () => {
  const group = makeGroup({ sessionCount: 4 });
  const cancelledState: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'cancelled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 2 }),
  ];

  assert.equal(resolveLessonCycleNumber(cancelledState[2], cancelledState, { group }).sessionNumber, 2);

  // Un-cancel l2 back to scheduled
  const uncancelledState = cancelledState.map(l =>
    l.id === 'l2' ? { ...l, status: 'scheduled' as const } : l
  );
  const resequenced = resequenceScheduledLessonsAfterChange(
    uncancelledState,
    uncancelledState.find(l => l.id === 'l2'),
    { group }
  );

  assert.equal(resequenced.find(l => l.id === 'l1')!.sessionNumber, 1);
  assert.equal(resequenced.find(l => l.id === 'l2')!.sessionNumber, 2);
  assert.equal(resequenced.find(l => l.id === 'l3')!.sessionNumber, 3);
});

// TEST F: Deleting a scheduled lesson
runTest('TEST F: Soft-deleting Lesson 2 shifts Lesson 3 to #2 and Lesson 4 to #3', () => {
  const group = makeGroup({ sessionCount: 4 });
  const initial: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'scheduled', sessionNumber: 2, deleted: true }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 3 }),
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'scheduled', sessionNumber: 4 }),
  ];

  const afterDelete = resequenceScheduledLessonsAfterChange(initial, initial[1], { group });
  assert.equal(afterDelete.find(l => l.id === 'l1')!.sessionNumber, 1);
  assert.equal(afterDelete.find(l => l.id === 'l3')!.sessionNumber, 2);
  assert.equal(afterDelete.find(l => l.id === 'l4')!.sessionNumber, 3);
});

// TEST G: Restoring a soft-deleted lesson
runTest('TEST G: Restoring soft-deleted Lesson 2 restores #2 and shifts Lesson 3 to #3 and Lesson 4 to #4', () => {
  const group = makeGroup({ sessionCount: 4 });
  const deletedState: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'scheduled', sessionNumber: 2, deleted: true }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 2 }),
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'scheduled', sessionNumber: 3 }),
  ];

  const restoredState = deletedState.map(l => (l.id === 'l2' ? { ...l, deleted: false } : l));
  const afterRestore = resequenceScheduledLessonsAfterChange(
    restoredState,
    restoredState.find(l => l.id === 'l2'),
    { group }
  );

  assert.equal(afterRestore.find(l => l.id === 'l1')!.sessionNumber, 1);
  assert.equal(afterRestore.find(l => l.id === 'l2')!.sessionNumber, 2);
  assert.equal(afterRestore.find(l => l.id === 'l3')!.sessionNumber, 3);
  assert.equal(afterRestore.find(l => l.id === 'l4')!.sessionNumber, 4);
});

// TEST H: Cycle rollover
runTest('TEST H: 8 active lessons in a 4-session cycle roll over cleanly (1, 2, 3, 4, 1, 2, 3, 4)', () => {
  const group = makeGroup({ sessionCount: 4 });
  const dates = [
    '2026-04-01', '2026-04-04', '2026-04-08', '2026-04-11',
    '2026-04-15', '2026-04-18', '2026-04-22', '2026-04-25',
  ];
  const lessons = dates.map((date, idx) =>
    makeLesson({ id: `l_${idx + 1}`, date, status: idx < 4 ? 'completed' : 'scheduled' })
  );

  const resolutions = lessons.map(l => resolveLessonCycleNumber(l, lessons, { group }));
  assert.deepEqual(
    resolutions.map(r => r.sessionNumber),
    [1, 2, 3, 4, 1, 2, 3, 4]
  );
  assert.deepEqual(
    resolutions.map(r => r.cycleIndex),
    [0, 0, 0, 0, 1, 1, 1, 1]
  );
});

// TEST I: Cycle rollover with cancelled lesson
runTest('TEST I: Cycle rollover with 1 cancelled lesson in Cycle 1 makes the 5th active lesson #1 of Cycle 2', () => {
  const group = makeGroup({ sessionCount: 4 });
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed' }), // active #1 (1/4, cycle 0)
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'cancelled' }), // excluded
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'completed' }), // active #2 (2/4, cycle 0)
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'completed' }), // active #3 (3/4, cycle 0)
    makeLesson({ id: 'l5', date: '2026-04-15', status: 'completed' }), // active #4 (4/4, cycle 0)
    makeLesson({ id: 'l6', date: '2026-04-18', status: 'scheduled' }), // active #5 (1/4, cycle 1)
  ];

  const r5 = resolveLessonCycleNumber(lessons[4], lessons, { group });
  const r6 = resolveLessonCycleNumber(lessons[5], lessons, { group });

  assert.equal(r5.sessionNumber, 4);
  assert.equal(r5.cycleIndex, 0);
  assert.equal(r6.sessionNumber, 1, '5th active lesson (l6) must roll over to Session 1 of Cycle 2');
  assert.equal(r6.cycleIndex, 1);
});

// TEST J: Custom startingSessionNumber
runTest('TEST J: Group with sessionCount = 4 and startingSessionNumber = 3 numbers lessons 3, 4, 1, 2', () => {
  const group = makeGroup({ sessionCount: 4, startingSessionNumber: 3 });
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed' }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'scheduled' }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled' }),
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'scheduled' }),
  ];

  const nums = lessons.map(l => resolveLessonCycleNumber(l, lessons, { group }).sessionNumber);
  assert.deepEqual(nums, [3, 4, 1, 2]);
});

// TEST K: Cross-modal consistency
runTest('TEST K: LessonReminderModal, ArabicParentReportModal, and ParentSummaryModal resolve identical Session 2 of 4', () => {
  const group = makeGroup({ sessionCount: 4, startingSessionNumber: 1 });
  const student: Student = {
    id: 'st_cross_modal',
    name: 'يوسف أحمد',
    groupId: group.id,
    grade: 'Grade 10',
    parentName: 'أحمد',
    parentPhone: '01000000000',
    studentPhone: '01100000000',
    joinedDate: '2026-01-01',
    documents: [],
  };

  // Even if lesson 3 has a corrupted stored sessionNumber (e.g. 3 while l2 was cancelled),
  // all modals use resolveLessonCycleNumber / calculateSequentialSessionNumber
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'cancelled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 3 }),
    makeLesson({ id: 'l4', date: '2026-04-11', status: 'scheduled', sessionNumber: 4 }),
  ];

  const targetLesson = lessons[2]; // l3

  // 1. LessonReminderModal resolution
  const reminderRes = resolveLessonCycleNumber(targetLesson, lessons, {
    group,
    student,
    students: [student],
  });

  // 2. ArabicParentReportModal resolution
  const arabicReportRes = resolveLessonCycleNumber(targetLesson, lessons, {
    group,
    student,
    students: [student],
  });

  // 3. ParentSummaryModal resolution
  const parentSummaryRes = resolveLessonCycleNumber(targetLesson, lessons, {
    group,
    student,
    students: [student],
  });

  // 4. GroupCycleInfo badge resolution
  const groupBadgeRes = getGroupCycleInfo(group, lessons, 'ar');

  assert.equal(reminderRes.sessionNumber, 2);
  assert.equal(reminderRes.totalCycleSessions, 4);
  assert.equal(arabicReportRes.sessionNumber, 2);
  assert.equal(arabicReportRes.totalCycleSessions, 4);
  assert.equal(parentSummaryRes.sessionNumber, 2);
  assert.equal(parentSummaryRes.totalCycleSessions, 4);
  assert.equal(groupBadgeRes.currentSessionNumber, 2);
  assert.equal(groupBadgeRes.label, 'الحصة 2 من 4');
});

// TEST L: Stale stored sessionNumber repair
runTest('TEST L: Stale stored sessionNumber = 3 on Lesson 3 (after Lesson 2 was cancelled) resolves and repairs to Session 2 of 4', () => {
  const group = makeGroup({ sessionCount: 4 });
  const staleLessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'cancelled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 3 }), // stale!
  ];

  // Direct calculation ignores stale sessionNumber = 3 and returns 2
  assert.equal(calculateSequentialSessionNumber(staleLessons[2], staleLessons, { group }), 2);
  assert.equal(resolveLessonCycleNumber(staleLessons[2], staleLessons, { group }).sessionNumber, 2);

  // Resequencing persists repaired sessionNumber = 2 onto Lesson 3
  const repaired = resequenceScheduledLessonsAfterChange(staleLessons, staleLessons[1], { group });
  assert.equal(repaired.find(l => l.id === 'l3')!.sessionNumber, 2);
});

// TEST M: Per-lesson group
runTest('TEST M: Per-lesson group (isGroupPerLesson) always resolves Session 1 of 1', () => {
  const perLessonGroup = makeGroup({
    sessionCount: 1,
    paymentCycle: 'per_lesson',
    paymentModel: 'per_session',
  });
  const lessons: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1, totalSessionsInPackage: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'scheduled', sessionNumber: 4, totalSessionsInPackage: 4 }),
  ];

  const res = resolveLessonCycleNumber(lessons[1], lessons, { group: perLessonGroup });
  assert.equal(res.isPerLesson, true);
  assert.equal(res.sessionNumber, 1);
  assert.equal(res.totalCycleSessions, 1);
});

// TEST N: Individual student lessons without group
runTest('TEST N: Individual student lessons without a group follow the exact same cycle & cancellation rules', () => {
  const privateStudent = {
    id: 'st_private_1',
    name: 'سارة علي',
    paymentPlan: 'package',
    bundleSize: 4,
  };

  const privateLessons: Lesson[] = [
    makeLesson({ id: 'pl1', groupId: undefined, groupName: undefined, studentId: 'st_private_1', studentName: 'سارة علي', date: '2026-04-01', status: 'completed', sessionNumber: 1, totalSessionsInPackage: 4 }),
    makeLesson({ id: 'pl2', groupId: undefined, groupName: undefined, studentId: 'st_private_1', studentName: 'سارة علي', date: '2026-04-04', status: 'cancelled', sessionNumber: 2, totalSessionsInPackage: 4 }),
    makeLesson({ id: 'pl3', groupId: undefined, groupName: undefined, studentId: 'st_private_1', studentName: 'سارة علي', date: '2026-04-08', status: 'scheduled', sessionNumber: 3, totalSessionsInPackage: 4 }),
    makeLesson({ id: 'pl4', groupId: undefined, groupName: undefined, studentId: 'st_private_1', studentName: 'سارة علي', date: '2026-04-11', status: 'scheduled', sessionNumber: 4, totalSessionsInPackage: 4 }),
  ];

  assert.equal(resolveLessonCycleNumber(privateLessons[0], privateLessons, { student: privateStudent }).sessionNumber, 1);
  assert.equal(resolveLessonCycleNumber(privateLessons[1], privateLessons, { student: privateStudent }).isExcluded, true);
  assert.equal(resolveLessonCycleNumber(privateLessons[2], privateLessons, { student: privateStudent }).sessionNumber, 2);
  assert.equal(resolveLessonCycleNumber(privateLessons[3], privateLessons, { student: privateStudent }).sessionNumber, 3);
});

// TEST O: Rescheduling a lesson date/time
runTest('TEST O: Rescheduling a lesson to a later date reorders and resequences all cycle numbers chronologically', () => {
  const group = makeGroup({ sessionCount: 4 });
  const initial: Lesson[] = [
    makeLesson({ id: 'l1', date: '2026-04-01', status: 'completed', sessionNumber: 1 }),
    makeLesson({ id: 'l2', date: '2026-04-04', status: 'scheduled', sessionNumber: 2 }),
    makeLesson({ id: 'l3', date: '2026-04-08', status: 'scheduled', sessionNumber: 3 }),
  ];

  // Move l2 from 2026-04-04 to 2026-04-15 (after l3)
  const moved = initial.map(l => (l.id === 'l2' ? { ...l, date: '2026-04-15' } : l));
  const resequenced = resequenceScheduledLessonsAfterChange(moved, moved.find(l => l.id === 'l2'), { group });

  assert.equal(resequenced.find(l => l.id === 'l1')!.sessionNumber, 1);
  assert.equal(resequenced.find(l => l.id === 'l3')!.sessionNumber, 2, 'l3 (2026-04-08) is now chronological #2');
  assert.equal(resequenced.find(l => l.id === 'l2')!.sessionNumber, 3, 'Rescheduled l2 (2026-04-15) is now chronological #3');
});

// TEST P: Two lessons on the same date (different times + identical time tie-breaking)
runTest('TEST P: Two lessons on the same date (10:00 and 18:00, plus identical time tie-breaker) are ordered deterministically', () => {
  const group = makeGroup({ sessionCount: 4 });
  const sameDayLessons: Lesson[] = [
    makeLesson({ id: 'l_evening', date: '2026-04-10', time: '18:00', status: 'scheduled' }),
    makeLesson({ id: 'l_morning', date: '2026-04-10', time: '10:00', status: 'completed' }),
    makeLesson({ id: 'l_tie_b', date: '2026-04-12', time: '15:00', status: 'scheduled' }),
    makeLesson({ id: 'l_tie_a', date: '2026-04-12', time: '15:00', status: 'scheduled' }),
  ];

  assert.equal(resolveLessonCycleNumber(sameDayLessons[1], sameDayLessons, { group }).sessionNumber, 1, '10:00 lesson must be #1');
  assert.equal(resolveLessonCycleNumber(sameDayLessons[0], sameDayLessons, { group }).sessionNumber, 2, '18:00 lesson must be #2');
  assert.equal(resolveLessonCycleNumber(sameDayLessons[3], sameDayLessons, { group }).sessionNumber, 3, 'l_tie_a must be #3 deterministically');
  assert.equal(resolveLessonCycleNumber(sameDayLessons[2], sameDayLessons, { group }).sessionNumber, 4, 'l_tie_b must be #4 deterministically');

  // Verify manual adjustment anchoring helper (computeStartingSessionNumberForTargetLesson)
  const newStart = computeStartingSessionNumberForTargetLesson(sameDayLessons[0], 4, sameDayLessons, { group });
  const updatedGroup = { ...group, startingSessionNumber: newStart };
  assert.equal(
    resolveLessonCycleNumber(sameDayLessons[0], sameDayLessons, { group: updatedGroup }).sessionNumber,
    4,
    'Manual session override on 2nd lesson to 4 must anchor group startingSessionNumber so it resolves to 4'
  );
  assert.equal(
    resolveLessonCycleNumber(sameDayLessons[3], sameDayLessons, { group: updatedGroup }).sessionNumber,
    1,
    'Subsequent 3rd lesson must roll over to 1 after manual override'
  );
  assert.ok(compareLessonsChronologically(sameDayLessons[1], sameDayLessons[0]) < 0);
});

// TEST Q: LessonControlModal payment collection visibility rules
runTest('TEST Q: Payment collection is hidden mid-cycle (Sessions 1-3 of 4) and shown only for per-session or completed cycle (Session 4 of 4)', () => {
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: false, isPerLessonGroup: false, currentSessionNumber: 1, cycleTotalSessions: 4 }),
    false
  );
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: false, isPerLessonGroup: false, currentSessionNumber: 2, cycleTotalSessions: 4 }),
    false
  );
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: false, isPerLessonGroup: false, currentSessionNumber: 3, cycleTotalSessions: 4 }),
    false
  );
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: false, isPerLessonGroup: false, currentSessionNumber: 4, cycleTotalSessions: 4 }),
    true
  );
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: false, isPerLessonGroup: true, currentSessionNumber: 1, cycleTotalSessions: 1 }),
    true
  );
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: false, isPerLessonGroup: false, currentSessionNumber: 4, cycleTotalSessions: 8 }),
    false
  );
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: false, isPerLessonGroup: false, currentSessionNumber: 8, cycleTotalSessions: 8 }),
    true
  );
  assert.equal(
    shouldShowLessonPaymentCollection({ isQuick: true, isPerLessonGroup: false, currentSessionNumber: 1, cycleTotalSessions: 4 }),
    true
  );
});

console.log('===============================================================');
console.log(`✅ All ${passedCount}/17 Unified Lesson Cycle Numbering Tests Passed!`);
console.log('===============================================================');
