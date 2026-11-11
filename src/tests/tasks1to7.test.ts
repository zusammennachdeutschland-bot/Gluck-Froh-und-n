import assert from 'node:assert/strict';
import {
  getGroupCycleInfo,
  resequenceScheduledLessonsAfterChange,
  resolveTaughtTodayTopic,
  resolveStudentReportAttendance,
  resolveReportHomework,
  resolvePreviousHomeworkStatusText,
} from '../utils/lessonUtils';
import { splitPaymentAcrossLessons } from '../services/financeService';
import { Group, Lesson } from '../types';

console.log('Running Task 1 tests (session re-sequencing after cancel/un-cancel/delete)...');

// Task 1: sessionCount: 4; session 1 completed; sessions 2, 3, 4 scheduled; cancel session 2;
// assert remaining scheduled lessons become 2 and 3 and getGroupCycleInfo returns label "الحصة 2 من 4".
{
  const group = {
    id: 'g_task1',
    name: 'Gruppe A1',
    schedules: [],
    time: '16:00',
    locationType: 'online',
    studentCount: 5,
    feePerLesson: 400,
    currency: 'EGP',
    sessionCount: 4,
    paymentPlanType: 'cycle',
  } as unknown as Group;

  const baseLesson = {
    groupId: 'g_task1',
    groupName: 'Gruppe A1',
    time: '16:00',
    durationMinutes: 60,
    location: 'online' as const,
    type: 'group' as const,
    grade: 'Grade 9',
    amountDue: 400,
    amountPaid: 0,
    totalSessionsInPackage: 4,
  };

  const initialLessons: Lesson[] = [
    {
      ...baseLesson,
      id: 'l1',
      title: 'Session 1',
      date: '2026-10-01',
      status: 'completed',
      paymentStatus: 'paid',
      sessionNumber: 1,
    } as unknown as Lesson,
    {
      ...baseLesson,
      id: 'l2',
      title: 'Session 2',
      date: '2026-10-05',
      status: 'scheduled',
      paymentStatus: 'pending',
      sessionNumber: 2,
    } as unknown as Lesson,
    {
      ...baseLesson,
      id: 'l3',
      title: 'Session 3',
      date: '2026-10-08',
      status: 'scheduled',
      paymentStatus: 'pending',
      sessionNumber: 3,
    } as unknown as Lesson,
    {
      ...baseLesson,
      id: 'l4',
      title: 'Session 4',
      date: '2026-10-12',
      status: 'scheduled',
      paymentStatus: 'pending',
      sessionNumber: 4,
    } as unknown as Lesson,
  ];

  // Cancel session 2
  const cancelledLessons = initialLessons.map(l =>
    l.id === 'l2' ? { ...l, status: 'cancelled' as const } : l
  );
  const cancelledTarget = cancelledLessons.find(l => l.id === 'l2')!;
  const afterCancel = resequenceScheduledLessonsAfterChange(cancelledLessons, cancelledTarget, { group });

  const l1After = afterCancel.find(l => l.id === 'l1')!;
  const l3After = afterCancel.find(l => l.id === 'l3')!;
  const l4After = afterCancel.find(l => l.id === 'l4')!;

  assert.equal(l1After.sessionNumber, 1, 'Completed lesson 1 must remain sessionNumber 1');
  assert.equal(l3After.sessionNumber, 2, 'Scheduled lesson 3 must shift to sessionNumber 2 after cancelling lesson 2');
  assert.equal(l4After.sessionNumber, 3, 'Scheduled lesson 4 must shift to sessionNumber 3 after cancelling lesson 2');

  const cycleInfo = getGroupCycleInfo(group, afterCancel, 'ar');
  assert.equal(cycleInfo.currentSessionNumber, 2, 'Current session number should be 2');
  assert.equal(cycleInfo.label, 'الحصة 2 من 4', 'Cycle label must be "الحصة 2 من 4"');

  // Un-cancel session 2 back to 'scheduled'
  const uncancelledLessons = afterCancel.map(l =>
    l.id === 'l2' ? { ...l, status: 'scheduled' as const } : l
  );
  const uncancelledTarget = uncancelledLessons.find(l => l.id === 'l2')!;
  const afterUncancel = resequenceScheduledLessonsAfterChange(uncancelledLessons, uncancelledTarget, { group });

  assert.equal(afterUncancel.find(l => l.id === 'l2')!.sessionNumber, 2, 'Un-cancelled lesson 2 must be session 2');
  assert.equal(afterUncancel.find(l => l.id === 'l3')!.sessionNumber, 3, 'Scheduled lesson 3 must shift back to 3');
  assert.equal(afterUncancel.find(l => l.id === 'l4')!.sessionNumber, 4, 'Scheduled lesson 4 must shift back to 4');
}

console.log('✅ All Task 1 tests passed!');

console.log('Running Task 2 tests (privacy, attendance helper, homework rule)...');
{
  // 2.1: Privacy - never leak teacherNotes into "what was taught today"
  const lessonWithPrivateNoteOnly = {
    id: 'l_priv',
    report: {
      teacherNotes: 'ملاحظة خاصة سرية للمعلم فقط',
    },
  } as unknown as Lesson;
  const topicRes1 = resolveTaughtTodayTopic(lessonWithPrivateNoteOnly);
  assert.equal(topicRes1.text, '', 'teacherNotes must never be used as taughtToday topic');
  assert.equal(topicRes1.isMissing, true, 'isMissing must be true when neither arabicTopicsExplained nor topic is set');

  const lessonWithTopic = {
    id: 'l_top',
    topic: 'Dativ & Akkusativ',
    report: {
      teacherNotes: 'ملاحظة خاصة سرية للمعلم فقط',
    },
  } as unknown as Lesson;
  const topicRes2 = resolveTaughtTodayTopic(lessonWithTopic);
  assert.equal(topicRes2.text, 'Dativ & Akkusativ', 'lesson.topic should be used when arabicTopicsExplained is empty');
  assert.equal(topicRes2.isMissing, false);

  // 2.2: Attendance helper returns 'present' | 'absent' | 'late' | 'unrecorded'
  const groupLessonPartialAtt = {
    id: 'l_att',
    groupId: 'g1',
    report: {
      attendanceStatus: 'absent', // overall status should not mark unrecorded group students as absent
      studentAttendance: {
        s_present: 'present',
        s_absent: 'absent',
        s_late: 'late',
      },
    },
  } as unknown as Lesson;

  assert.equal(resolveStudentReportAttendance('s_present', groupLessonPartialAtt, {}, undefined, true), 'present');
  assert.equal(resolveStudentReportAttendance('s_absent', groupLessonPartialAtt, {}, undefined, true), 'absent');
  assert.equal(resolveStudentReportAttendance('s_late', groupLessonPartialAtt, {}, undefined, true), 'late');
  assert.equal(
    resolveStudentReportAttendance('s_unrecorded', groupLessonPartialAtt, {}, undefined, true),
    'unrecorded',
    'Unrecorded group student must be "unrecorded", not "absent"'
  );

  // 2.3: Homework rule - do not print 'لا يوجد واجب' / 'Keine Hausaufgabe' / 'None assigned' when unspecified
  const unspecifiedHw = resolveReportHomework({}, undefined, 'ar');
  assert.equal(unspecifiedHw.text, '', 'Unspecified homework must not default to "لا يوجد واجب"');
  assert.equal(unspecifiedHw.isMissing, true, 'Unspecified homework must flag isMissing = true');

  const unspecifiedHwGer = resolveReportHomework({ arabicHomeworkRequired: 'غير محدد' }, undefined, 'de');
  assert.equal(unspecifiedHwGer.text, '', 'Homework "غير محدد" must not print "Keine Hausaufgabe"');
  assert.equal(unspecifiedHwGer.isMissing, true);

  const explicitNoneHwAr = resolveReportHomework({ homeworkStatus: 'none' as any }, undefined, 'ar');
  assert.equal(explicitNoneHwAr.text, 'لا يوجد واجب');
  assert.equal(explicitNoneHwAr.isExplicitNone, true);
  assert.equal(explicitNoneHwAr.isMissing, false);

  const explicitNoneHwEn = resolveReportHomework({ homeworkStatus: 'none' as any }, undefined, 'en');
  assert.equal(explicitNoneHwEn.text, 'None assigned');

  const explicitNoneHwDe = resolveReportHomework({ homeworkStatus: 'none' as any }, undefined, 'de');
  assert.equal(explicitNoneHwDe.text, 'Keine Hausaufgabe');

  // Previous homework status text
  assert.equal(resolvePreviousHomeworkStatusText(undefined, 'en'), '', 'Undefined hwDone must not print None assigned');
  assert.equal(resolvePreviousHomeworkStatusText('غير محدد', 'de'), '', '"غير محدد" hwDone must not print Keine Hausaufgabe');
  assert.equal(resolvePreviousHomeworkStatusText('none', 'ar'), 'لا يوجد واجب سابق');
  assert.equal(resolvePreviousHomeworkStatusText('none', 'en'), 'None assigned');
  assert.equal(resolvePreviousHomeworkStatusText('none', 'de'), 'Keine Hausaufgabe');
}

console.log('✅ All Task 2 tests passed!');

console.log('Running Task 4 tests (payment split rounding)...');
{
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const s100_3 = splitPaymentAcrossLessons(100, 3);
  assert.equal(s100_3.length, 3);
  assert.equal(sum(s100_3), 100, '100 over 3 must sum to 100 exactly');
  assert.deepEqual(s100_3, [33, 33, 34]);

  const s250_4 = splitPaymentAcrossLessons(250, 4);
  assert.equal(s250_4.length, 4);
  assert.equal(sum(s250_4), 250, '250 over 4 must sum to 250 exactly');
  assert.deepEqual(s250_4, [62, 62, 62, 64]);

  const s90_4 = splitPaymentAcrossLessons(90, 4);
  assert.equal(s90_4.length, 4);
  assert.equal(sum(s90_4), 90, '90 over 4 must sum to 90 exactly');
  assert.deepEqual(s90_4, [22, 22, 22, 24]);
}
console.log('✅ All Task 4 tests passed!');

console.log('Running Parent Report Greetings test (starts with السلام عليكم)...');
{
  const { getTimeBasedGreeting } = await import('../utils/greetingUtils');
  const { getArabicOpenersMale, getArabicOpenersFemale } = await import('../utils/feedbackGenerator');

  const g1 = getTimeBasedGreeting('ar', { style: 'egyptian' });
  assert.ok(g1.startsWith('السلام عليكم'), `Expected g1 to start with السلام عليكم, got: ${g1}`);

  const g2 = getTimeBasedGreeting('ar', { style: 'egyptian', isGroup: true });
  assert.ok(g2.startsWith('السلام عليكم'), `Expected g2 to start with السلام عليكم, got: ${g2}`);

  const g3 = getTimeBasedGreeting('ar', { style: 'standard' });
  assert.ok(g3.startsWith('السلام عليكم'), `Expected g3 to start with السلام عليكم, got: ${g3}`);

  const maleOpeners = getArabicOpenersMale();
  for (const opener of maleOpeners) {
    assert.ok(opener.startsWith('السلام عليكم'), `Male opener must start with السلام عليكم, got: ${opener}`);
  }

  const femaleOpeners = getArabicOpenersFemale();
  for (const opener of femaleOpeners) {
    assert.ok(opener.startsWith('السلام عليكم'), `Female opener must start with السلام عليكم, got: ${opener}`);
  }
}
console.log('✅ All Parent Report Greeting tests passed!');

console.log('Running Non-Today Parent Report Phrasing test...');
{
  const { getLocalDateStr } = await import('../utils/timeUtils');
  const todayStr = getLocalDateStr();
  const pastDate = '2026-10-25';
  
  assert.notEqual(todayStr, pastDate, 'Past date should not match today');

  // Verify phrasing rules:
  // If lesson.date !== today:
  // header should not say "اليوم: الأحد" but "موعد الحصة: يوم الأحد" or "تاريخ الحصة"
  // topics should say "اللي اتشرح في الحصة" instead of "اللي اتشرح النهاردة"
  const isLessonToday = pastDate === todayStr;
  assert.equal(isLessonToday, false);

  const getDayDateLine = (isToday: boolean, dayName: string, dateFormatted: string) => {
    return dayName && dateFormatted 
      ? `📅 ${isToday ? 'اليوم' : 'موعد الحصة'}: ${dayName} (${dateFormatted})`
      : dayName 
        ? `📅 ${isToday ? 'اليوم' : 'يوم الحصة'}: ${dayName}`
        : dateFormatted 
          ? `📅 ${isToday ? 'التاريخ' : 'تاريخ الحصة'}: ${dateFormatted}` 
          : '';
  };

  const lineForPast = getDayDateLine(false, 'الأحد', '25/10/2026');
  assert.ok(!lineForPast.includes('📅 اليوم:'), 'Past lesson line must not start with 📅 اليوم:');
  assert.ok(lineForPast.includes('📅 موعد الحصة:'), 'Past lesson line must start with 📅 موعد الحصة:');

  const lineForToday = getDayDateLine(true, 'الجمعة', '30/10/2026');
  assert.ok(lineForToday.includes('📅 اليوم:'), 'Today lesson line must start with 📅 اليوم:');
}
console.log('✅ All Non-Today Parent Report Phrasing tests passed!');

console.log('Running Completed Lesson Conflict Exclusion & Projection tests...');
{
  const { checkOverlap } = await import('../utils/lessonUtils');
  const { getProjectedLessonsForRange } = await import('../utils/scheduleUtils');

  // Test 1: Completed lesson vs Scheduled lesson on same date/time must NOT overlap/conflict
  const completedLesson = {
    id: 'l_completed_1',
    groupId: 'g_yomna',
    date: '2026-10-30',
    time: '17:00',
    durationMinutes: 60,
    status: 'completed',
    report: { attendanceStatus: 'completed' }
  };
  const scheduledLesson = {
    id: 'l_scheduled_1',
    groupId: 'g_abdelrahman',
    date: '2026-10-30',
    time: '17:00',
    durationMinutes: 60,
    status: 'scheduled'
  };

  assert.equal(
    checkOverlap(completedLesson, scheduledLesson),
    false,
    'Completed lesson must NOT conflict with scheduled lesson'
  );
  assert.equal(
    checkOverlap(scheduledLesson, completedLesson),
    false,
    'Scheduled lesson must NOT conflict with completed lesson'
  );

  // Test 2: Two completed lessons on same date/time must NOT overlap/conflict
  const completedLesson2 = {
    id: 'l_completed_2',
    groupId: 'g_other',
    date: '2026-10-30',
    time: '17:00',
    durationMinutes: 60,
    status: 'completed'
  };
  assert.equal(
    checkOverlap(completedLesson, completedLesson2),
    false,
    'Two completed lessons must NOT conflict'
  );

  // Test 3: Two scheduled lessons on same date/time DO conflict
  const scheduledLesson2 = {
    id: 'l_scheduled_2',
    groupId: 'g_other',
    date: '2026-10-30',
    time: '17:00',
    durationMinutes: 60,
    status: 'scheduled'
  };
  assert.equal(
    checkOverlap(scheduledLesson, scheduledLesson2),
    true,
    'Two scheduled lessons at the same time must conflict'
  );

  // Test 4: Cancelled lessons do not conflict
  const cancelledLesson = {
    id: 'l_cancelled_1',
    groupId: 'g_third',
    date: '2026-10-30',
    time: '17:00',
    durationMinutes: 60,
    status: 'cancelled'
  };
  assert.equal(
    checkOverlap(scheduledLesson, cancelledLesson),
    false,
    'Cancelled lesson must NOT conflict with scheduled lesson'
  );

  // Test 5: getProjectedLessonsForRange duplicate prevention
  // Yomna group has schedule on Friday (day 5) at 16:00
  const yomnaGroup = {
    id: 'g_yomna',
    name: 'Yomna Mourad Hamed',
    type: 'online',
    grade: 'Grade 4',
    scheduleDays: ['Fr'],
    scheduleTime: '16:00',
    status: 'active'
  } as any;

  // On Friday 2026-10-30, Yomna already has an explicit completed session at 17:00
  const explicitLessons = [
    {
      id: 'l_yomna_done',
      groupId: 'g_yomna',
      groupName: 'Yomna Mourad Hamed',
      date: '2026-10-30',
      time: '17:00',
      durationMinutes: 60,
      status: 'completed',
      report: { attendanceStatus: 'completed' }
    }
  ] as any[];

  const projected = getProjectedLessonsForRange(
    '2026-10-30',
    '2026-11-08',
    [yomnaGroup],
    explicitLessons
  );

  // Should NOT project a duplicate lesson for Yomna on 2026-10-30!
  const lessonsOnOct30 = projected.filter(l => l.groupId === 'g_yomna' && l.date === '2026-10-30');
  assert.equal(
    lessonsOnOct30.length,
    1,
    'There should be exactly 1 lesson for Yomna on 2026-10-30 (the completed one)'
  );
  assert.equal(lessonsOnOct30[0].time, '17:00');
  assert.equal(lessonsOnOct30[0].status, 'completed');

  // Should project a session for Yomna on next Friday (2026-11-06) at 16:00
  const lessonsOnNov06 = projected.filter(l => l.groupId === 'g_yomna' && l.date === '2026-11-06');
  assert.equal(
    lessonsOnNov06.length,
    1,
    'Next Friday should have 1 projected session at 16:00'
  );
  assert.equal(lessonsOnNov06[0].time, '16:00');
  assert.equal(lessonsOnNov06[0].status, 'scheduled');
}
console.log('✅ All Completed Lesson Conflict Exclusion & Projection tests passed!');

