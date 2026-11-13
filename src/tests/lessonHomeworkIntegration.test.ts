import assert from 'node:assert/strict';
import { Group, Lesson, Student, TeacherProfile } from '../types';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  buildSmartDailySummaryHomeworkInsights,
  evaluateOnlineHomeworkFollowUp,
  findLatestEligiblePreviousLesson,
  formatStudentPersonalPreviousHwLines,
  isOnlineHomeworkValid,
  resolveLinkedOnlineHomeworkForLesson,
  resolveStudentPersonalOnlineHomeworkResult
} from '../utils/lessonHomeworkLinkUtils';
import { buildOnlineAwareHomeworkFollowUps } from '../utils/homeworkFollowUpUtils';
import { buildQueueMessageForStudent } from '../utils/whatsappQueueUtils';

console.log('Running Lesson-Homework & Reports Integration Tests...');

const testProfile = {
  id: 'teacher_1',
  name: 'أ. عبد الرحمن',
  englishName: 'Herr Abdul-rahman',
  arabicName: 'أ. عبد الرحمن',
  currency: 'EGP',
  theme: 'dark',
  language: 'ar'
} as unknown as TeacherProfile;

function makeGroup(id: string, name: string): Group {
  return {
    id,
    name,
    schedules: [{ day: 'Monday', time: '16:00' }],
    time: '16:00',
    locationType: 'online',
    studentCount: 3,
    feePerLesson: 300,
    currency: 'EGP',
    sessionCount: 4,
    paymentPlanType: 'cycle'
  } as unknown as Group;
}

function makeStudent(id: string, name: string, groupId?: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    name,
    groupId,
    phone: '01000000001',
    parentPhone: '01000000002',
    grade: 'A1',
    feePerLesson: 300,
    currency: 'EGP',
    ...overrides
  } as unknown as Student;
}

function makeAssignment(overrides: Partial<HomeworkAssignment> = {}): HomeworkAssignment {
  return {
    id: overrides.id || 'hw_alpha_1',
    shortId: overrides.shortId !== undefined ? overrides.shortId : 'Ab3x9Kp',
    shareToken: overrides.shareToken || 'tok_123456',
    ownerUid: overrides.ownerUid !== undefined ? overrides.ownerUid : 'uid_teacher_1',
    title: overrides.title || 'واجب الدرس الثالث - الكلمات',
    setSnapshot: {
      id: 'set_1',
      title: 'A1 Kapitel 3',
      category: 'A1',
      items: [{ id: 'w1', german: 'das Buch', arabic: 'الكتاب' }]
    },
    selectedItemIds: ['w1'],
    flowMode: 'teacher_then_quiz',
    questionTypes: ['true_false', 'choice_2'],
    blooketMode: 'classic_quiz',
    allowedGameModes: ['classic_quiz'],
    questionCount: 10,
    targetQuestionCount: 10,
    audienceMode: overrides.audienceMode || 'group',
    groupId: overrides.groupId !== undefined ? overrides.groupId : 'grp_a1',
    groupName: overrides.groupName || 'مجموعة A1',
    assignedStudents: overrides.assignedStudents || [
      { id: 'st_1', name: 'أحمد علي', groupId: 'grp_a1' },
      { id: 'st_2', name: 'مريم حسن', groupId: 'grp_a1' },
      { id: 'st_3', name: 'سارة محمود', groupId: 'grp_a1' },
      { id: 'st_4', name: 'كريم طارق', groupId: 'grp_a1' }
    ],
    maxAttempts: 3,
    allowReplay: true,
    isActive: overrides.isActive ?? true,
    status: overrides.status || 'active',
    cloudSynced: overrides.cloudSynced ?? true,
    createdAt: '2026-11-01T10:00:00.000Z',
    createdBy: 'Teacher',
    ...overrides
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: overrides.id || 'les_1',
    title: overrides.title || 'حصة A1',
    date: overrides.date || '2026-11-10',
    time: overrides.time || '16:00',
    durationMinutes: 60,
    location: 'online',
    type: overrides.type || 'online',
    groupId: overrides.groupId,
    groupName: overrides.groupName,
    studentId: overrides.studentId,
    studentName: overrides.studentName,
    grade: 'A1',
    status: overrides.status || 'completed',
    paymentStatus: 'paid',
    amountDue: 300,
    amountPaid: 0,
    ...overrides
  } as unknown as Lesson;
}

function makeSubmission(overrides: Partial<HomeworkSubmission> = {}): HomeworkSubmission {
  return {
    id: overrides.id || `sub_${Math.random().toString(36).slice(2, 8)}`,
    assignmentId: overrides.assignmentId || 'hw_alpha_1',
    ownerUid: overrides.ownerUid || 'uid_teacher_1',
    audienceMode: overrides.audienceMode || 'group',
    groupId: overrides.groupId || 'grp_a1',
    studentId: overrides.studentId,
    studentName: overrides.studentName || 'أحمد علي',
    attemptNumber: overrides.attemptNumber || 1,
    status: overrides.status || 'completed',
    startedAt: '2026-11-10T18:00:00.000Z',
    completedAt: overrides.status === 'in_progress' ? '' : '2026-11-10T18:10:00.000Z',
    updatedAt: overrides.updatedAt || '2026-11-10T18:10:00.000Z',
    timeSpentSeconds: 120,
    totalQuestions: overrides.totalQuestions ?? 10,
    correctAnswersCount: overrides.correctAnswersCount ?? 8,
    scorePercentage: overrides.scorePercentage ?? 80,
    responses: overrides.responses || [],
    ...overrides
  };
}

// 1. Test findLatestEligiblePreviousLesson (ignores cancelled/deleted, respects group & private isolation, picks chronological latest)
{
  const lessons: Lesson[] = [
    makeLesson({
      id: 'l_old',
      date: '2026-11-01',
      time: '16:00',
      groupId: 'grp_a1',
      status: 'completed',
      report: {
        arabicTopicsExplained: 'الدرس القديم',
        studentAttendance: {},
        onlineHomeworkAssignmentId: 'hw_old'
      }
    }),
    makeLesson({
      id: 'l_latest',
      date: '2026-11-08',
      time: '16:00',
      groupId: 'grp_a1',
      status: 'completed',
      report: {
        arabicTopicsExplained: 'الدرس الأحدث',
        studentAttendance: {},
        onlineHomeworkAssignmentId: 'hw_alpha_1',
        onlineHomeworkShortId: 'Ab3x9Kp',
        onlineHomeworkTitle: 'واجب الدرس الثالث - الكلمات'
      }
    }),
    makeLesson({
      id: 'l_cancelled_newer',
      date: '2026-11-10',
      time: '16:00',
      groupId: 'grp_a1',
      status: 'cancelled',
      report: {
        arabicTopicsExplained: 'ملغاة',
        studentAttendance: {},
        onlineHomeworkAssignmentId: 'hw_cancelled'
      }
    }),
    makeLesson({
      id: 'l_other_group',
      date: '2026-11-11',
      time: '16:00',
      groupId: 'grp_b1',
      status: 'completed',
      report: {
        arabicTopicsExplained: 'مجموعة أخرى',
        studentAttendance: {},
        onlineHomeworkAssignmentId: 'hw_other_group'
      }
    }),
    makeLesson({
      id: 'l_tomorrow',
      date: '2026-11-12',
      time: '16:00',
      groupId: 'grp_a1',
      status: 'scheduled'
    })
  ];

  const targetTomorrow = lessons.find((l) => l.id === 'l_tomorrow')!;
  const foundPrev = findLatestEligiblePreviousLesson(targetTomorrow, lessons, {
    requireCompletedOrReported: true
  });

  assert.ok(foundPrev, 'Should find previous eligible lesson');
  assert.equal(foundPrev!.id, 'l_latest', 'Must return true chronological latest eligible lesson of same group');
  assert.equal(foundPrev!.report?.onlineHomeworkAssignmentId, 'hw_alpha_1');

  // Private student isolation
  const privLessons: Lesson[] = [
    makeLesson({
      id: 'priv_1',
      type: 'online',
      studentId: 'p1',
      studentName: 'عمر خالد',
      date: '2026-11-05',
      status: 'completed',
      report: { studentAttendance: {}, onlineHomeworkAssignmentId: 'hw_priv_1' }
    }),
    makeLesson({
      id: 'priv_2_other',
      type: 'online',
      studentId: 'p2',
      studentName: 'زينب علي',
      date: '2026-11-09',
      status: 'completed',
      report: { studentAttendance: {}, onlineHomeworkAssignmentId: 'hw_priv_2' }
    }),
    makeLesson({
      id: 'priv_tomorrow',
      type: 'online',
      studentId: 'p1',
      studentName: 'عمر خالد',
      date: '2026-11-12',
      status: 'scheduled'
    })
  ];

  const foundPriv = findLatestEligiblePreviousLesson(privLessons[2], privLessons, {
    requireCompletedOrReported: true
  });
  assert.ok(foundPriv);
  assert.equal(foundPriv!.id, 'priv_1', 'Must strictly match private student p1 and never p2');
}

// 2. Test isOnlineHomeworkValid & resolveLinkedOnlineHomeworkForLesson (valid, deleted, revoked, pending_sync, cross-account, cross-group)
{
  const validHw = makeAssignment({ id: 'hw_valid', shortId: 'Ab3x9Kp', groupId: 'grp_a1' });
  const deletedHw = makeAssignment({ id: 'hw_del', shortId: 'Del1234', deleted: true, status: 'deleted' });
  const closedHw = makeAssignment({ id: 'hw_closed', shortId: 'Cls1234', isActive: false, status: 'closed' });
  const pendingHw = makeAssignment({
    id: 'hw_pending',
    shortId: 'Pnd1234',
    cloudSynced: false,
    cloudCreatePending: true
  });
  const otherAccountHw = makeAssignment({
    id: 'hw_other_acc',
    shortId: 'Oth1234',
    ownerUid: 'uid_teacher_2'
  });

  const allAssignments = [validHw, deletedHw, closedHw, pendingHw, otherAccountHw];

  const lessonValid = makeLesson({
    groupId: 'grp_a1',
    report: { studentAttendance: {}, onlineHomeworkAssignmentId: 'hw_valid', onlineHomeworkShortId: 'Ab3x9Kp' }
  });
  const resValid = resolveLinkedOnlineHomeworkForLesson(lessonValid, allAssignments, {
    currentOwnerUid: 'uid_teacher_1',
    overrideDomain: 'https://glueck.app',
    ignoreBrowserLocalFlags: true
  });
  assert.ok(resValid);
  assert.equal(resValid!.isValid, true);
  assert.equal(resValid!.status, 'active');
  assert.equal(resValid!.shareUrl, 'https://glueck.app/Herr-Abdul-rahman/Ab3x9Kp');

  // Revoked short ID cannot expose shareUrl
  const resRevoked = resolveLinkedOnlineHomeworkForLesson(lessonValid, allAssignments, {
    currentOwnerUid: 'uid_teacher_1',
    revokedShortIds: new Set(['Ab3x9Kp']),
    overrideDomain: 'https://glueck.app',
    ignoreBrowserLocalFlags: true
  });
  assert.equal(resRevoked!.isValid, false);
  assert.equal(resRevoked!.status, 'revoked');
  assert.equal(resRevoked!.shareUrl, null);

  // Deleted homework returns deleted & null shareUrl
  const resDeleted = isOnlineHomeworkValid(deletedHw, {
    currentOwnerUid: 'uid_teacher_1',
    overrideDomain: 'https://glueck.app',
    ignoreBrowserLocalFlags: true
  });
  assert.equal(resDeleted.isValid, false);
  assert.equal(resDeleted.status, 'deleted');
  assert.equal(resDeleted.shareUrl, null);

  // Closed homework returns closed & null shareUrl
  const resClosed = isOnlineHomeworkValid(closedHw, {
    currentOwnerUid: 'uid_teacher_1',
    overrideDomain: 'https://glueck.app',
    ignoreBrowserLocalFlags: true
  });
  assert.equal(resClosed.isValid, false);
  assert.equal(resClosed.status, 'closed');
  assert.equal(resClosed.shareUrl, null);

  // Pending cloud sync blocks shareUrl display until Firestore persistence succeeds
  const resPending = isOnlineHomeworkValid(pendingHw, {
    currentOwnerUid: 'uid_teacher_1',
    overrideDomain: 'https://glueck.app',
    ignoreBrowserLocalFlags: true
  });
  assert.equal(resPending.isValid, false);
  assert.equal(resPending.status, 'pending_sync');
  assert.equal(resPending.isPendingSync, true);
  assert.equal(resPending.shareUrl, null);

  // Wrong account UID blocked
  const resUnauthorizedAcc = isOnlineHomeworkValid(otherAccountHw, {
    currentOwnerUid: 'uid_teacher_1',
    overrideDomain: 'https://glueck.app',
    ignoreBrowserLocalFlags: true
  });
  assert.equal(resUnauthorizedAcc.isValid, false);
  assert.equal(resUnauthorizedAcc.status, 'unauthorized');
  assert.equal(resUnauthorizedAcc.shareUrl, null);

  // Cross-group assignment blocked when validated against another group lesson
  const resWrongGroup = isOnlineHomeworkValid(validHw, {
    currentOwnerUid: 'uid_teacher_1',
    lessonGroupId: 'grp_b2',
    overrideDomain: 'https://glueck.app',
    ignoreBrowserLocalFlags: true
  });
  assert.equal(resWrongGroup.isValid, false);
  assert.equal(resWrongGroup.status, 'unauthorized');
  assert.equal(resWrongGroup.shareUrl, null);
}

// 3. Test evaluateOnlineHomeworkFollowUp (accuracy < 50% OR not completed yet, absence handling)
{
  const hw = makeAssignment();
  const roster = [
    makeStudent('st_1', 'أحمد علي', 'grp_a1'), // Solved 80% -> NOT needing follow-up
    makeStudent('st_2', 'مريم حسن', 'grp_a1'), // Solved 40% (< 50%) -> NEEDS follow-up
    makeStudent('st_3', 'سارة محمود', 'grp_a1'), // In progress (incomplete) -> NEEDS follow-up
    makeStudent('st_4', 'كريم طارق', 'grp_a1') // Absent -> excluded from needsFollowUp
  ];

  const prevLesson = makeLesson({
    groupId: 'grp_a1',
    report: {
      onlineHomeworkAssignmentId: 'hw_alpha_1',
      studentAttendance: {
        st_1: 'present',
        st_2: 'present',
        st_3: 'present',
        st_4: 'absent'
      }
    }
  });

  const subs: HomeworkSubmission[] = [
    makeSubmission({ studentId: 'st_1', studentName: 'أحمد علي', scorePercentage: 80, correctAnswersCount: 8, status: 'completed' }),
    makeSubmission({ studentId: 'st_2', studentName: 'مريم حسن', scorePercentage: 40, correctAnswersCount: 4, status: 'completed', attemptNumber: 1 }),
    makeSubmission({ studentId: 'st_2', studentName: 'مريم حسن', scorePercentage: 30, correctAnswersCount: 3, status: 'completed', attemptNumber: 2 }),
    makeSubmission({
      studentId: 'st_3',
      studentName: 'سارة محمود',
      scorePercentage: 50,
      correctAnswersCount: 3,
      status: 'in_progress',
      responses: [{ questionId: 'q1', germanWord: 'das Buch', studentAnswer: 'الكتاب', correctAnswer: 'الكتاب', isCorrect: true, timeSpentSeconds: 4 }]
    })
  ];

  const summary = evaluateOnlineHomeworkFollowUp(hw, subs, roster, prevLesson);

  assert.equal(summary.totalTrackedCount, 3, 'Absent student must not inflate active follow-up denominator');
  assert.equal(summary.absentCount, 1);
  assert.equal(summary.solvedCount, 2, 'st_1 and st_2 completed their attempts');
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.notStartedCount, 0);
  assert.equal(summary.needsFollowUpCount, 2, 'st_2 (<50%) and st_3 (incomplete) both need follow-up');

  const st1Eval = summary.studentResults.find((s) => s.studentId === 'st_1')!;
  const st2Eval = summary.studentResults.find((s) => s.studentId === 'st_2')!;
  const st3Eval = summary.studentResults.find((s) => s.studentId === 'st_3')!;
  const st4Eval = summary.studentResults.find((s) => s.studentId === 'st_4')!;

  assert.equal(st1Eval.needsFollowUp, false);
  assert.equal(st2Eval.bestAccuracy, 40);
  assert.equal(st2Eval.attemptsCount, 2);
  assert.equal(st2Eval.needsFollowUp, true);
  assert.equal(st3Eval.status, 'in_progress');
  assert.equal(st3Eval.answeredCount, 1);
  assert.equal(st3Eval.needsFollowUp, true);
  assert.equal(st4Eval.status, 'absent');
  assert.equal(st4Eval.needsFollowUp, false);
}

// 4. Test resolveStudentPersonalOnlineHomeworkResult & formatStudentPersonalPreviousHwLines (strict single-student privacy)
{
  const hw = makeAssignment();
  const st1 = makeStudent('st_1', 'أحمد علي', 'grp_a1');
  const st2 = makeStudent('st_2', 'مريم حسن', 'grp_a1');
  const stWrongGroup = makeStudent('st_x', 'يوسف', 'grp_other');

  const prevLesson = makeLesson({
    groupId: 'grp_a1',
    report: {
      onlineHomeworkAssignmentId: 'hw_alpha_1',
      studentAttendance: { st_1: 'present', st_2: 'present', st_4: 'absent' }
    }
  });

  const subs: HomeworkSubmission[] = [
    makeSubmission({ studentId: 'st_1', studentName: 'أحمد علي', scorePercentage: 90, correctAnswersCount: 9, totalQuestions: 10 }),
    makeSubmission({ studentId: 'st_2', studentName: 'مريم حسن', scorePercentage: 40, correctAnswersCount: 4, totalQuestions: 10 })
  ];

  const resSt1 = resolveStudentPersonalOnlineHomeworkResult(hw, subs, st1, prevLesson, {
    currentOwnerUid: 'uid_teacher_1'
  });
  assert.ok(resSt1);
  assert.equal(resSt1!.bestAccuracy, 90);
  assert.equal(resSt1!.bestCorrectCount, 9);
  assert.equal(resSt1!.needsFollowUp, false);

  const linesSt1 = formatStudentPersonalPreviousHwLines(resSt1!, 'ar').join('\n');
  assert.ok(linesSt1.includes('90%'), 'Personal report must include student score');
  assert.ok(!linesSt1.includes('مريم'), 'Must NEVER leak peer student name');
  assert.ok(!linesSt1.includes('40%'), 'Must NEVER leak peer student score');

  // Cross-group student blocked
  const resWrongGroup = resolveStudentPersonalOnlineHomeworkResult(hw, subs, stWrongGroup, prevLesson, {
    currentOwnerUid: 'uid_teacher_1'
  });
  assert.equal(resWrongGroup, null);

  // Absent student returns empty formatted lines
  const st4Absent = makeStudent('st_4', 'كريم طارق', 'grp_a1');
  const resAbsent = resolveStudentPersonalOnlineHomeworkResult(hw, subs, st4Absent, prevLesson, {
    currentOwnerUid: 'uid_teacher_1'
  });
  assert.ok(resAbsent);
  assert.equal(resAbsent!.wasAbsent, true);
  assert.deepEqual(formatStudentPersonalPreviousHwLines(resAbsent!, 'ar'), []);

  // Different student st_2 sees strictly own 40% & needs follow-up note
  const resSt2 = resolveStudentPersonalOnlineHomeworkResult(hw, subs, st2, prevLesson);
  const linesSt2 = formatStudentPersonalPreviousHwLines(resSt2!, 'ar').join('\n');
  assert.ok(linesSt2.includes('40%'));
  assert.ok(linesSt2.includes('أقل من 50%'));
  assert.ok(!linesSt2.includes('أحمد'));
}

// 5. Test buildOnlineAwareHomeworkFollowUps (group + private student, filters deleted entities)
{
  const grpA1 = makeGroup('grp_a1', 'مجموعة A1');
  const grpDeleted = { ...makeGroup('grp_del', 'مجموعة محذوفة'), deleted: true };

  const students = [
    makeStudent('st_1', 'أحمد علي', 'grp_a1'),
    makeStudent('st_2', 'مريم حسن', 'grp_a1'),
    makeStudent('st_priv', 'عمر الفردي')
  ];

  const now = new Date('2026-11-12T10:00:00');
  const lessons: Lesson[] = [
    makeLesson({
      id: 'l_grp_prev',
      groupId: 'grp_a1',
      groupName: 'مجموعة A1',
      date: '2026-11-08',
      status: 'completed',
      report: { studentAttendance: {}, onlineHomeworkAssignmentId: 'hw_grp_1' }
    }),
    makeLesson({
      id: 'l_grp_next',
      groupId: 'grp_a1',
      groupName: 'مجموعة A1',
      date: '2026-11-13',
      time: '16:00',
      status: 'scheduled'
    }),
    makeLesson({
      id: 'l_priv_prev',
      type: 'online',
      studentId: 'st_priv',
      studentName: 'عمر الفردي',
      date: '2026-11-09',
      status: 'completed',
      report: { studentAttendance: {}, onlineHomeworkAssignmentId: 'hw_priv_1' }
    })
  ];

  const assignments = [
    makeAssignment({
      id: 'hw_grp_1',
      shortId: 'Grp1111',
      audienceMode: 'group',
      groupId: 'grp_a1',
      assignedStudents: [
        { id: 'st_1', name: 'أحمد علي', groupId: 'grp_a1' },
        { id: 'st_2', name: 'مريم حسن', groupId: 'grp_a1' }
      ]
    }),
    makeAssignment({
      id: 'hw_priv_1',
      shortId: 'Prv2222',
      audienceMode: 'open',
      groupId: undefined
    })
  ];

  const submissions = [
    makeSubmission({ assignmentId: 'hw_grp_1', studentId: 'st_1', studentName: 'أحمد علي', scorePercentage: 90 })
  ];

  const followUps = buildOnlineAwareHomeworkFollowUps({
    lessons,
    groups: [grpA1, grpDeleted],
    students,
    assignments,
    submissions,
    currentOwnerUid: 'uid_teacher_1',
    ignoreBrowserLocalFlags: true,
    now
  });

  assert.equal(followUps.length, 2, 'Should track active group + active private student and ignore deleted group');
  const grpItem = followUps.find((f) => f.scopeType === 'group' && f.groupId === 'grp_a1');
  const privItem = followUps.find((f) => f.scopeType === 'student' && f.studentId === 'st_priv');
  assert.ok(grpItem);
  assert.ok(privItem);
  assert.equal(grpItem!.needsFollowUpCount, 1, 'st_2 did not solve yet');
  assert.equal(privItem!.needsFollowUpCount, 1, 'st_priv did not solve yet');
}

// 6. Test buildSmartDailySummaryHomeworkInsights (real verified counters & alerts only)
{
  const grpA1 = makeGroup('grp_a1', 'مجموعة A1');
  const students = [
    makeStudent('st_1', 'أحمد علي', 'grp_a1'),
    makeStudent('st_2', 'مريم حسن', 'grp_a1')
  ];

  const prevLesson = makeLesson({
    id: 'l_prev_daily',
    groupId: 'grp_a1',
    groupName: 'مجموعة A1',
    date: '2026-11-10',
    status: 'completed',
    report: {
      studentAttendance: {},
      onlineHomeworkAssignmentId: 'hw_daily_1'
    }
  });
  const todayUnreported = makeLesson({
    id: 'l_today_daily',
    groupId: 'grp_a1',
    groupName: 'مجموعة A1',
    date: '2026-11-12',
    status: 'scheduled'
  });

  const assignments = [
    makeAssignment({
      id: 'hw_daily_1',
      shortId: 'Dly1234',
      groupId: 'grp_a1',
      assignedStudents: [
        { id: 'st_1', name: 'أحمد علي', groupId: 'grp_a1' },
        { id: 'st_2', name: 'مريم حسن', groupId: 'grp_a1' }
      ]
    })
  ];

  const submissions = [
    makeSubmission({ assignmentId: 'hw_daily_1', studentId: 'st_1', studentName: 'أحمد علي', scorePercentage: 70 })
  ];

  const insights = buildSmartDailySummaryHomeworkInsights({
    todayStr: '2026-11-12',
    todaysLessons: [todayUnreported],
    allLessons: [prevLesson, todayUnreported],
    students,
    groups: [grpA1],
    assignments,
    submissions,
    currentOwnerUid: 'uid_teacher_1',
    ignoreBrowserLocalFlags: true
  });

  assert.equal(insights.lessonsNeedingReportCount, 1);
  assert.equal(insights.activeLinkedHomeworksCount, 1);
  assert.equal(insights.completedStudentsCount, 1);
  assert.equal(insights.unsubmittedStudentsCount, 1);
  assert.equal(insights.followUpStudentsCount, 1);
  assert.equal(insights.confirmedAverageAccuracy, 70);
  assert.ok(insights.alerts.some((a) => a.type === 'missing_report'));
  assert.ok(insights.alerts.some((a) => a.type === 'unsubmitted_hw'));
}

// 7. Test buildQueueMessageForStudent backward compatibility + Online HW short link + personal prev result
{
  const student = makeStudent('st_1', 'أحمد علي', 'grp_a1');
  const lesson = makeLesson({
    date: '2026-11-12',
    groupId: 'grp_a1',
    report: {
      arabicTopicsExplained: 'أدوات التعريف der die das',
      homeworkDescription: 'حفظ كلمات الدرس الثالث',
      studentAttendance: { st_1: 'present' },
      studentHomeworkDone: { st_1: 'yes' }
    }
  });

  // With valid short link & personal result
  const msgWithOnline = buildQueueMessageForStudent(student, lesson, testProfile, {
    templateType: 'egyptian',
    onlineHomeworkTitle: 'واجب الكلمات',
    onlineHomeworkShareUrl: 'https://glueck.app/Herr-Abdul-rahman/Ab3x9Kp',
    previousOnlineResultLines: ['• الواجب الأونلاين السابق: اختبار 2', '• حالة الحل: تم الحل ✅ — النتيجة: 85%']
  });

  assert.ok(msgWithOnline.includes('https://glueck.app/Herr-Abdul-rahman/Ab3x9Kp'));
  assert.ok(msgWithOnline.includes('حفظ كلمات الدرس الثالث'));
  assert.ok(msgWithOnline.includes('تم الحل ✅ — النتيجة: 85%'));

  // With revoked/invalid link (null shareUrl) — must never print broken URL
  const msgRevoked = buildQueueMessageForStudent(student, lesson, testProfile, {
    templateType: 'egyptian',
    onlineHomeworkTitle: 'واجب الكلمات',
    onlineHomeworkShareUrl: null,
    previousOnlineResultLines: []
  });
  assert.ok(!msgRevoked.includes('Herr-Abdul-rahman'));
  assert.ok(msgRevoked.includes('حفظ كلمات الدرس الثالث'));
}

console.log('✅ All Lesson-Homework & Reports Integration Tests PASSED!');
