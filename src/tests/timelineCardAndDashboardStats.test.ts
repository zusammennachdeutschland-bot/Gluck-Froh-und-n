import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Group, Lesson, Student } from '../types';
import {
  buildOfflineMapsUrl,
  resolveLessonCommunicationTargets,
  resolveLessonType,
  resolveOfflineLessonLocation,
} from '../utils/timelineCardUtils';
import {
  computeDashboardPeriodStats,
  countUniqueStudentsForLessons,
  getDashboardLessonsForRange,
  getDashboardTodaySummary,
  getMonthDateRange,
  getWeekDateRangeFridayToThursday,
} from '../utils/dashboardStatsUtils';

const makeGroup = (overrides: Partial<Group> = {}): Group => ({
  id: 'g1',
  name: 'Gruppe A1',
  grade: 'A1',
  type: 'offline',
  monthlyPackagePrice: 1200,
  sessionCount: 8,
  color: '#3b82f6',
  scheduleDays: ['Saturday', 'Tuesday'],
  scheduleTime: '17:00',
  ...overrides,
});

const makeStudent = (overrides: Partial<Student> = {}): Student => ({
  id: 's1',
  name: 'Omar Ali',
  groupId: 'g1',
  grade: 'A1',
  parentName: 'Mr Ali',
  parentPhone: '01011112222',
  studentPhone: '',
  documents: [],
  joinedDate: '2026-01-01',
  status: 'active',
  ...overrides,
});

const makeLesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: 'l1',
  groupId: 'g1',
  groupName: 'Gruppe A1',
  title: 'Gruppe A1 Lektion',
  date: '2026-11-21',
  time: '17:00',
  durationMinutes: 60,
  type: 'offline',
  grade: 'A1',
  sessionNumber: 1,
  totalSessionsInPackage: 8,
  status: 'scheduled',
  paymentStatus: 'pending',
  amountDue: 150,
  amountPaid: 0,
  ...overrides,
});

const runTimelineCardTests = () => {
  console.log('Running Task A: TodaysProgressTimeline card tests...');

  // 1. Online vs Offline type resolution
  const onlineGrp = makeGroup({ id: 'g_on', type: 'online' });
  const offlineGrp = makeGroup({ id: 'g_off', type: 'offline' });
  assert.equal(resolveLessonType(makeLesson({ type: 'online' }), offlineGrp), 'online');
  assert.equal(resolveLessonType(makeLesson({ type: 'offline' }), onlineGrp), 'offline');
  assert.equal(resolveLessonType({ type: undefined as any }, onlineGrp), 'online');
  assert.equal(resolveLessonType({ type: undefined as any }, offlineGrp), 'offline');

  // 2. Offline location resolution: lesson.location -> ignore generic 'home'/'center' -> group.address -> none
  const specificLessonLoc = resolveOfflineLessonLocation(
    makeLesson({ type: 'offline', location: 'Maadi Degla St 12' }),
    makeGroup({ address: 'Nasr City Address' })
  );
  assert.equal(specificLessonLoc.hasSpecificLocation, true);
  assert.equal(specificLessonLoc.source, 'lesson');
  assert.equal(specificLessonLoc.displayLocation, 'Maadi Degla St 12');

  for (const generic of ['home', 'Home', 'CENTER', 'center', '  ', '']) {
    const fallbackGroupAddr = resolveOfflineLessonLocation(
      makeLesson({ type: 'offline', location: generic }),
      makeGroup({ address: 'Zamalek 26th July' })
    );
    assert.equal(fallbackGroupAddr.hasSpecificLocation, true, `generic "${generic}" must fall back to group.address`);
    assert.equal(fallbackGroupAddr.source, 'group');
    assert.equal(fallbackGroupAddr.displayLocation, 'Zamalek 26th July');
  }

  const missingBothLoc = resolveOfflineLessonLocation(
    makeLesson({ type: 'offline', location: 'center' }),
    makeGroup({ address: 'home' })
  );
  assert.equal(missingBothLoc.hasSpecificLocation, false);
  assert.equal(missingBothLoc.displayLocation, '');

  // Maps URL prioritizes coordinates, then resolved address, never crashes when empty
  assert.equal(
    buildOfflineMapsUrl(
      makeLesson({ location: 'home' }),
      makeGroup({ coordinates: { lat: 30.0444, lng: 31.2357 }, address: 'Downtown' })
    ),
    'https://www.google.com/maps?q=30.0444,31.2357'
  );
  assert.equal(
    buildOfflineMapsUrl(
      makeLesson({ location: 'home' }),
      makeGroup({ address: 'Dokki Square' })
    ),
    'https://www.google.com/maps/search/?api=1&query=Dokki%20Square'
  );

  // 3. Single student communication targets: parent vs registered student vs missing contacts
  const offlineGroupWithAddr = makeGroup({ id: 'g_off1', type: 'offline', address: 'Heliopolis' });
  const studentWithBothPhones = makeStudent({
    id: 'st_both',
    groupId: 'g_off1',
    parentPhone: '01099998888',
    studentPhone: '01234567890',
  });
  const targetsBoth = resolveLessonCommunicationTargets({
    lesson: makeLesson({ groupId: 'g_off1', type: 'offline' }),
    groups: [offlineGroupWithAddr],
    students: [studentWithBothPhones],
  });
  assert.equal(targetsBoth.isMultiStudentGroup, false);
  assert.equal(targetsBoth.parentCall.mode, 'tel');
  assert.equal(targetsBoth.parentCall.telUrl, 'tel:01099998888');
  assert.equal(targetsBoth.parentWhatsApp.mode, 'direct');
  assert.equal(targetsBoth.parentWhatsApp.url, 'https://wa.me/201099998888');
  assert.equal(targetsBoth.studentWhatsApp.canMessageStudent, true);
  assert.equal(targetsBoth.studentWhatsApp.url, 'https://wa.me/201234567890');

  // Student with username instead of phone (online lesson)
  const onlineGrp1 = makeGroup({ id: 'g_on1', type: 'online' });
  const studentWithUsernameOnly = makeStudent({
    id: 'st_user',
    groupId: 'g_on1',
    parentPhone: '01122334455',
    studentPhone: '',
    studentUsername: 'omar.student',
  });
  const targetsOnlineUser = resolveLessonCommunicationTargets({
    lesson: makeLesson({ groupId: 'g_on1', type: 'online' }),
    groups: [onlineGrp1],
    students: [studentWithUsernameOnly],
  });
  assert.equal(targetsOnlineUser.studentWhatsApp.canMessageStudent, true);
  assert.equal(targetsOnlineUser.studentWhatsApp.url, 'https://wa.me/omar.student');
  assert.equal(targetsOnlineUser.parentWhatsApp.url, 'https://wa.me/201122334455');

  // Student WITHOUT registered studentPhone must NOT show student button even when parentPhone exists
  const studentNoStudentNum = makeStudent({
    id: 'st_nopersonal',
    groupId: 'g_on1',
    parentPhone: '01122334455',
    studentPhone: '',
    studentUsername: '',
  });
  const targetsNoStudentNum = resolveLessonCommunicationTargets({
    lesson: makeLesson({ groupId: 'g_on1', type: 'online' }),
    groups: [onlineGrp1],
    students: [studentNoStudentNum],
  });
  assert.equal(targetsNoStudentNum.studentWhatsApp.canMessageStudent, false);
  assert.equal(targetsNoStudentNum.studentWhatsApp.url, null);
  assert.equal(targetsNoStudentNum.parentWhatsApp.canOpen, true);

  // Student WITHOUT parentPhone/parentUsername must NEVER produce empty https://wa.me/
  const studentMissingParent = makeStudent({
    id: 'st_noparent',
    groupId: 'g_on1',
    parentPhone: '',
    parentUsername: '',
    phone: '-',
    studentPhone: '01055556666',
  });
  const targetsMissingParent = resolveLessonCommunicationTargets({
    lesson: makeLesson({ groupId: 'g_on1', type: 'online' }),
    groups: [onlineGrp1],
    students: [studentMissingParent],
  });
  assert.equal(targetsMissingParent.parentWhatsApp.canOpen, false);
  assert.equal(targetsMissingParent.parentWhatsApp.url, null);
  assert.equal(targetsMissingParent.parentCall.mode, 'modal');
  assert.equal(targetsMissingParent.studentWhatsApp.canMessageStudent, true);
  assert.equal(targetsMissingParent.studentWhatsApp.url, 'https://wa.me/201055556666');

  // Lesson with zero students / no contacts must never return https://wa.me/
  const targetsEmpty = resolveLessonCommunicationTargets({
    lesson: makeLesson({ id: 'l_quick_empty', groupId: 'quick_group', studentName: 'Guest' }),
    groups: [],
    students: [],
  });
  assert.equal(targetsEmpty.parentWhatsApp.canOpen, false);
  assert.equal(targetsEmpty.parentWhatsApp.url, null);
  assert.equal(targetsEmpty.studentWhatsApp.canMessageStudent, false);

  // 4. Multi-student group preserves WhatsApp group link / parent selection modal & hides single student button
  const groupWithWaLink = makeGroup({
    id: 'g_multi_wa',
    type: 'online',
    whatsAppGroupLink: 'https://chat.whatsapp.com/ABC123',
  });
  const multiStudents = [
    makeStudent({ id: 'm1', groupId: 'g_multi_wa', studentPhone: '01000000001', parentPhone: '01011111111' }),
    makeStudent({ id: 'm2', groupId: 'g_multi_wa', studentPhone: '01000000002', parentPhone: '01022222222' }),
  ];
  const targetsMultiWa = resolveLessonCommunicationTargets({
    lesson: makeLesson({ groupId: 'g_multi_wa', type: 'online' }),
    groups: [groupWithWaLink],
    students: multiStudents,
  });
  assert.equal(targetsMultiWa.isMultiStudentGroup, true);
  assert.equal(targetsMultiWa.studentWhatsApp.canMessageStudent, false);
  assert.equal(targetsMultiWa.parentCall.mode, 'modal');
  assert.equal(targetsMultiWa.parentWhatsApp.mode, 'group_link');
  assert.equal(targetsMultiWa.parentWhatsApp.url, 'https://chat.whatsapp.com/ABC123');

  const groupNoWaLink = makeGroup({ id: 'g_multi_no_wa', type: 'offline' });
  const multiStudents2 = [
    makeStudent({ id: 'm3', groupId: 'g_multi_no_wa' }),
    makeStudent({ id: 'm4', groupId: 'g_multi_no_wa' }),
  ];
  const targetsMultiNoWa = resolveLessonCommunicationTargets({
    lesson: makeLesson({ groupId: 'g_multi_no_wa', type: 'offline' }),
    groups: [groupNoWaLink],
    students: multiStudents2,
  });
  assert.equal(targetsMultiNoWa.isMultiStudentGroup, true);
  assert.equal(targetsMultiNoWa.parentWhatsApp.mode, 'modal');
  assert.equal(targetsMultiNoWa.parentWhatsApp.url, null);
  assert.equal(targetsMultiNoWa.studentWhatsApp.canMessageStudent, false);

  // 5. Verify TodaysProgressTimeline & SelectParentCallModal integration contracts in source
  const timelineSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/TodaysProgressTimeline.tsx'),
    'utf8'
  );
  assert.ok(timelineSrc.includes('LessonReminderModal'), 'TodaysProgressTimeline must render LessonReminderModal');
  assert.ok(timelineSrc.includes('handleOpenLessonReminder'), 'Online card must trigger reminder modal handler');
  assert.ok(timelineSrc.includes('handleOpenStudentWhatsApp'), 'Card must expose student WhatsApp handler');
  assert.ok(timelineSrc.includes('resolveOfflineLessonDisplayLocation'), 'Card must resolve lesson.location -> group.address');
  assert.ok(timelineSrc.includes("url !== 'https://wa.me/'"), 'TodaysProgressTimeline must never open empty wa.me/ links');
  assert.ok(timelineSrc.includes('e.stopPropagation()'), 'Card controls must call stopPropagation');

  const selectModalSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/SelectParentCallModal.tsx'),
    'utf8'
  );
  assert.ok(selectModalSrc.includes("if (!phone || !phone.trim()) return;"), 'SelectParentCallModal must validate WhatsApp contacts before opening');
};

const runDashboardStatsTests = () => {
  console.log('Running Task B: Unified dashboard stats & weekly/monthly range tests...');

  // 1. Friday-to-Thursday week boundary checks
  // Saturday 2026-11-21 -> Week starts Fri 2026-11-20, ends Thu 2026-11-26
  const satWeek = getWeekDateRangeFridayToThursday('2026-11-21');
  assert.equal(satWeek.startDateStr, '2026-11-20');
  assert.equal(satWeek.endDateStr, '2026-11-26');

  // Friday 2026-11-20 -> same Fri 2026-11-20 to Thu 2026-11-26
  const friWeek = getWeekDateRangeFridayToThursday('2026-11-20');
  assert.equal(friWeek.startDateStr, '2026-11-20');
  assert.equal(friWeek.endDateStr, '2026-11-26');

  // Thursday 2026-11-26 -> same Fri 2026-11-20 to Thu 2026-11-26
  const thuWeek = getWeekDateRangeFridayToThursday('2026-11-26');
  assert.equal(thuWeek.startDateStr, '2026-11-20');
  assert.equal(thuWeek.endDateStr, '2026-11-26');

  // 2. Month boundary check (February leap year & November)
  const febLeap = getMonthDateRange('2024-02-15');
  assert.equal(febLeap.startDateStr, '2024-02-01');
  assert.equal(febLeap.endDateStr, '2024-02-29');

  const novMonth = getMonthDateRange('2026-11-21');
  assert.equal(novMonth.startDateStr, '2026-11-01');
  assert.equal(novMonth.endDateStr, '2026-11-30');

  // 3. WeeklyOverview / MonthlyOverview unified range query:
  //    - Week Fri 2026-11-20 .. Thu 2026-11-26, with todayStr = '2026-11-22' (Sunday)
  //    - Group has Friday, Sunday, Tuesday, Thursday slots.
  //    - Friday (2026-11-20) is strictly PAST (< todayStr) with NO explicit stored lesson -> MUST NOT fabricate projected lesson!
  //    - Friday (2026-11-20) DOES have explicit completed lesson for gA -> counted in completed.
  //    - Sunday (2026-11-22, today) has explicit cancelled lesson for gB -> overrides projection (cancelled=1, NOT duplicated in remaining).
  //    - Tuesday (2026-11-24) & Thursday (2026-11-26) have NO explicit lessons yet -> MUST project into remaining!
  //    - Explicit `pending_action` lesson on Monday 2026-11-23 -> MUST count in remaining!
  //    - Explicit soft-deleted lesson on Thursday 2026-11-26 at 18:00 -> MUST NOT be re-projected as remaining!
  const todayStr = '2026-11-22';
  const groups: Group[] = [
    makeGroup({
      id: 'gA',
      name: 'Group A',
      scheduleDays: ['Friday', 'Tuesday'],
      scheduleTime: '17:00',
    }),
    makeGroup({
      id: 'gB',
      name: 'Group B',
      scheduleDays: ['Friday', 'Sunday', 'Thursday'],
      scheduleTime: '18:00',
    }),
  ];
  const storedLessons: Lesson[] = [
    // gA completed on Friday 2026-11-20
    makeLesson({
      id: 'l_ga_fri',
      groupId: 'gA',
      date: '2026-11-20',
      time: '17:00',
      status: 'completed',
    }),
    // Note: gB had a Friday 2026-11-20 slot in its schedule, but NO stored lesson on past Friday -> must NOT fabricate a virtual remaining lesson on past 2026-11-20!
    // gB cancelled explicitly on Sunday 2026-11-22 (today)
    makeLesson({
      id: 'l_gb_sun',
      groupId: 'gB',
      date: '2026-11-22',
      time: '18:00',
      status: 'cancelled',
    }),
    // Explicit pending_action lesson on Monday 2026-11-23
    makeLesson({
      id: 'l_mon_pending',
      groupId: 'gA',
      date: '2026-11-23',
      time: '19:00',
      status: 'pending_action',
    }),
    // gB Thursday 2026-11-26 explicitly deleted -> should stay suppressed
    makeLesson({
      id: 'l_gb_thu_del',
      groupId: 'gB',
      date: '2026-11-26',
      time: '18:00',
      status: 'scheduled',
      deleted: true,
    }),
  ];

  const weekRange = getWeekDateRangeFridayToThursday(todayStr);
  const weekLessons = getDashboardLessonsForRange({
    startDateStr: weekRange.startDateStr,
    endDateStr: weekRange.endDateStr,
    todayStr,
    lessons: storedLessons,
    groups,
    groupWeeklySessions: [],
  });
  const weekStats = computeDashboardPeriodStats(weekLessons);

  // Expected weekLessons:
  // 1. l_ga_fri (2026-11-20, completed)
  // 2. l_gb_sun (2026-11-22, cancelled) -> projected gB sun deduped!
  // 3. l_mon_pending (2026-11-23, pending_action) -> remaining
  // 4. projected gA Tuesday (2026-11-24, scheduled) -> remaining
  // Total: completed=1, cancelled=1, remaining=2 (gB past Fri NOT fabricated, gB Thu deleted NOT projected)
  assert.equal(weekStats.completed, 1);
  assert.equal(weekStats.cancelled, 1);
  assert.equal(weekStats.remaining, 2, 'Should include future Tuesday projection + Monday pending_action without past Friday fabrication or deleted Thursday');
  assert.equal(weekStats.total, 4);

  // Explicit completed same-slot overrides projected row cleanly without duplicates
  const withExplicitTueComplete = [
    ...storedLessons,
    makeLesson({
      id: 'l_ga_tue_done',
      groupId: 'gA',
      date: '2026-11-24',
      time: '17:00',
      status: 'completed',
    }),
  ];
  const weekStatsUpdated = computeDashboardPeriodStats(
    getDashboardLessonsForRange({
      startDateStr: weekRange.startDateStr,
      endDateStr: weekRange.endDateStr,
      todayStr,
      lessons: withExplicitTueComplete,
      groups,
      groupWeeklySessions: [],
    })
  );
  assert.equal(weekStatsUpdated.completed, 2);
  assert.equal(weekStatsUpdated.remaining, 1);

  // 4. MonthlyOverview range consistency: Nov 1 .. Nov 30, 2026
  const monthRange = getMonthDateRange(todayStr);
  const monthLessons = getDashboardLessonsForRange({
    startDateStr: monthRange.startDateStr,
    endDateStr: monthRange.endDateStr,
    todayStr,
    lessons: storedLessons,
    groups,
    groupWeeklySessions: [],
  });
  // Verify no projected lesson exists strictly before todayStr ('2026-11-22')
  const fabricatedPast = monthLessons.filter(
    (l) => l.date < todayStr && String(l.id || '').startsWith('l_auto_')
  );
  assert.equal(fabricatedPast.length, 0, 'Must never fabricate projected lessons for past dates < todayStr');
  // Future month dates (Nov 22..30) are included: gA Tue Nov 24 is already covered
  assert.ok(monthLessons.some((l) => l.date === '2026-11-24' && l.groupId === 'gA'));

  // 5. Header & SmartDailySummaryWidget unified today summary:
  //    - dismissedDashboardLessonIds excluded consistently
  //    - cancelled excluded consistently
  //    - unique students deduplicated across lessons + biweekly recurrence filtered + zero fallback when 0 lessons
  const todayDate = '2026-11-22'; // Check biweekly week on this date
  const grp1 = makeGroup({ id: 'g1', scheduleDays: ['Sunday'], scheduleTime: '16:00' });
  const grp2 = makeGroup({ id: 'g2', scheduleDays: ['Sunday'], scheduleTime: '18:00' });
  const grpCancelled = makeGroup({ id: 'g3', scheduleDays: ['Sunday'], scheduleTime: '20:00' });

  // Biweekly check: find which week '2026-11-22' is so test doesn't hardcode parity blindly
  const studentsList: Student[] = [
    makeStudent({ id: 's_a', groupId: 'g1', scheduleRecurrence: 'weekly' }),
    makeStudent({ id: 's_b', groupId: 'g1', scheduleRecurrence: 'biweekly_a' }),
    makeStudent({ id: 's_c', groupId: 'g1', scheduleRecurrence: 'biweekly_b' }),
    makeStudent({ id: 's_d', groupId: 'g2', scheduleRecurrence: 'weekly' }),
    makeStudent({ id: 's_canc', groupId: 'g3', scheduleRecurrence: 'weekly' }),
  ];

  const todayAllLessons: Lesson[] = [
    makeLesson({ id: 'l_t1', groupId: 'g1', date: todayDate, time: '16:00', status: 'completed' }),
    makeLesson({ id: 'l_t2', groupId: 'g2', date: todayDate, time: '18:00', status: 'scheduled' }),
    makeLesson({ id: 'l_tcanc', groupId: 'g3', date: todayDate, time: '20:00', status: 'cancelled' }),
  ];

  // With nothing dismissed: g1 + g2 active (2 lessons), cancelled g3 excluded;
  // In g1: s_a (weekly) + exactly ONE of s_b/s_c (whichever matches today's alternating week) = 2 students
  // In g2: s_d = 1 student -> Total unique active students = 3! (Cancelled s_canc excluded)
  const summaryDefault = getDashboardTodaySummary({
    todayStr: todayDate,
    lessons: todayAllLessons,
    groups: [grp1, grp2, grpCancelled],
    students: studentsList,
    dismissedDashboardLessonIds: [],
  });
  assert.equal(summaryDefault.lessonsCount, 2);
  assert.equal(summaryDefault.cancelledCount, 1);
  assert.equal(summaryDefault.studentsCount, 3, 'Must count weekly + matching biweekly student without cancelled group student');
  assert.equal(summaryDefault.percentDone, 50);

  // Same student attending two separate lessons today must still count once cleanly
  const sameStudentTwiceSummary = getDashboardTodaySummary({
    todayStr: todayDate,
    lessons: [
      makeLesson({ id: 'l_t1', groupId: 'g1', date: todayDate, time: '16:00', status: 'completed' }),
      makeLesson({ id: 'l_t_priv', groupId: 'quick_group', studentId: 's_a', date: todayDate, time: '19:00', status: 'scheduled' }),
    ],
    groups: [grp1],
    students: studentsList,
    dismissedDashboardLessonIds: [],
  });
  assert.equal(sameStudentTwiceSummary.lessonsCount, 2);
  assert.equal(sameStudentTwiceSummary.studentsCount, 2, 'Student in both g1 and private lesson must be counted only once');

  // Dismiss completed lesson l_t1 -> both lessonsCount and studentsCount drop cleanly
  const summaryDismissed = getDashboardTodaySummary({
    todayStr: todayDate,
    lessons: todayAllLessons,
    groups: [grp1, grp2, grpCancelled],
    students: studentsList,
    dismissedDashboardLessonIds: ['l_t1'],
  });
  assert.equal(summaryDismissed.lessonsCount, 1);
  assert.equal(summaryDismissed.studentsCount, 1);
  assert.equal(summaryDismissed.firstLessonTime, '18:00');

  // Zero-lesson day must return 0 students (NOT fallback to total students.length = 5!)
  const summaryZero = getDashboardTodaySummary({
    todayStr: todayDate,
    lessons: [],
    groups: [],
    students: studentsList,
    dismissedDashboardLessonIds: [],
  });
  assert.equal(summaryZero.lessonsCount, 0);
  assert.equal(summaryZero.studentsCount, 0);
  assert.equal(countUniqueStudentsForLessons([], [grp1], studentsList), 0);

  // Verify Header & SmartDailySummaryWidget & WeeklyOverview & MonthlyOverview use the canonical helpers
  const headerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Header.tsx'), 'utf8');
  const smartSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SmartDailySummaryWidget.tsx'), 'utf8');
  const weeklySrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/WeeklyOverviewWidget.tsx'), 'utf8');
  const monthlySrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/MonthlyOverviewWidget.tsx'), 'utf8');

  assert.ok(headerSrc.includes('getDashboardTodaySummary'), 'Header must use getDashboardTodaySummary');
  assert.ok(smartSrc.includes('getDashboardTodaySummary'), 'SmartDailySummaryWidget must use getDashboardTodaySummary');
  assert.ok(smartSrc.includes('dismissedDashboardLessonIds'), 'SmartDailySummaryWidget must respect dismissedDashboardLessonIds');
  assert.ok(weeklySrc.includes('getDashboardLessonsForRange'), 'WeeklyOverviewWidget must use getDashboardLessonsForRange');
  assert.ok(monthlySrc.includes('getDashboardLessonsForRange'), 'MonthlyOverviewWidget must use getDashboardLessonsForRange');
};

runTimelineCardTests();
runDashboardStatsTests();
console.log('✅ All timelineCardAndDashboardStats tests passed!');
