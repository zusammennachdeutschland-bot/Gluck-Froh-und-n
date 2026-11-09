import assert from 'node:assert/strict';
import expressApp, { resetHomeworkStoresForTesting } from '../api/expressApp';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';
import {
  resolveAssignmentAudienceMode,
  getAuthorizedGroupStudentsForAssignment,
  normalizeHomeworkAssignment,
  getOrCreateOpenParticipantId,
  validateHomeworkSubmissionIdentity,
  buildDeterministicSubmissionId,
  buildHomeworkShareUrl,
  saveLocalAssignment,
  getLocalAssignments,
  deleteLocalAssignment,
  saveLocalSubmission,
  getLocalSubmissions,
  fetchAssignmentDetailsWithSync,
  flushPendingHomeworkCloudWrites,
  getPendingHomeworkSyncCount,
  getHomeworkSummaryStats,
  __setHomeworkSyncTransportForTests
} from '../shared/homeworkStorageSync';

// --- LocalStorage Mock for Node ---
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const mockStorage = new MemoryStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  localStorage: mockStorage,
  location: { origin: 'https://glueck.example.com' },
  dispatchEvent: () => true,
  addEventListener: () => {}
};

function makeAssignment(overrides: Partial<HomeworkAssignment> & { id: string; title: string }): HomeworkAssignment {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    setSnapshot: {
      id: 'set-1',
      nameAr: 'الكلمات الأساسية',
      nameDe: 'Grundwortschatz',
      level: 'A1',
      items: [
        { id: 1, de: 'der Apfel', ar: 'التفاحة', ex: 'Ich esse einen Apfel.', cat: 'Obst' },
        { id: 2, de: 'das Buch', ar: 'الكتاب', ex: 'Das Buch ist interessant.', cat: 'Schule' }
      ]
    },
    allowedGameModes: ['classic'],
    questionCount: 2,
    maxAttempts: 3,
    allowReplay: true,
    createdBy: 'teacher',
    isActive: true,
    ...overrides
  };
}

function makeSubmission(
  overrides: Partial<HomeworkSubmission> & { id: string; assignmentId: string; studentName: string }
): HomeworkSubmission {
  return {
    startedAt: '2026-01-01T00:55:00.000Z',
    completedAt: '2026-01-01T01:00:00.000Z',
    status: 'completed',
    attemptNumber: 1,
    totalQuestions: 2,
    correctAnswersCount: 2,
    scorePercentage: 100,
    accuracy: 100,
    timeSpentSeconds: 45,
    responses: [],
    cloudSynced: true,
    ...overrides
  };
}

function getLocalAssignmentById(id: string): HomeworkAssignment | null {
  return getLocalAssignments().find((a) => a.id === id) || null;
}

function getLocalSubmissionsForAssignment(assignmentId: string): HomeworkSubmission[] {
  return getLocalSubmissions().filter((s) => s.assignmentId === assignmentId);
}

function resetAllState() {
  mockStorage.clear();
  resetHomeworkStoresForTesting();
  __setHomeworkSyncTransportForTests({
    saveAssignment: async () => true,
    saveSubmission: async () => true,
    fetchAssignment: async () => null,
    fetchSubmissionsForAssignment: async () => []
  });
}

async function runTests() {
  let passed = 0;
  const runScenario = async (num: number, title: string, fn: () => Promise<void> | void) => {
    resetAllState();
    await fn();
    passed++;
    console.log(`✅ [Scenario ${num.toString().padStart(2, '0')}] ${title}`);
  };

  const sampleStudents = [
    { id: 'stu-g1-1', name: 'أحمد محمد', groupId: 'grp-1', deleted: false, status: 'active' },
    { id: 'stu-g1-2', name: 'سارة علي', groupId: 'grp-1', deleted: false, status: 'active' },
    { id: 'stu-g1-dup', name: 'أحمد محمد', groupId: 'grp-1', deleted: false, status: 'active' },
    { id: 'stu-g1-del', name: 'طالب محذوف', groupId: 'grp-1', deleted: true, status: 'active' },
    { id: 'stu-g1-arc', name: 'طالب مؤرشف', groupId: 'grp-1', deleted: false, status: 'archived' },
    { id: 'stu-g2-1', name: 'كريم حسن', groupId: 'grp-2', deleted: false, status: 'active' },
    { id: 'stu-g2-2', name: 'منى عادل', groupId: 'grp-2', deleted: false, status: 'active' }
  ];

  // =========================================================================
  // AUDIENCE SELECTION TESTS (1–5)
  // =========================================================================

  await runScenario(1, 'Creating homework with "مفتوح لأي اسم" stores audienceMode = "open"', () => {
    const hw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-1',
        title: 'واجب مفتوح 1',
        audienceMode: 'open',
        cloudSynced: true
      })
    );
    saveLocalAssignment(hw, false);
    const saved = getLocalAssignmentById('hw-open-1');
    assert.ok(saved);
    assert.equal(saved.audienceMode, 'open');
    assert.equal(resolveAssignmentAudienceMode(saved), 'open');
  });

  await runScenario(2, 'Open homework does not store groupId or assignedStudents', () => {
    const hw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-clean',
        title: 'واجب مفتوح نظيف',
        audienceMode: 'open',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: [{ id: 'stu-g1-1', name: 'أحمد محمد', groupId: 'grp-1' }]
      })
    );
    saveLocalAssignment(hw, false);
    const saved = getLocalAssignmentById('hw-open-clean')!;
    assert.equal(saved.audienceMode, 'open');
    assert.equal(saved.groupId, undefined);
    assert.equal(saved.groupName, undefined);
    assert.equal(saved.assignedStudents, undefined);
  });

  await runScenario(3, 'Creating homework with "جروب معين" requires selecting a valid group', () => {
    const invalidGroupHw = makeAssignment({
      id: 'hw-group-invalid',
      title: 'واجب جروب بدون معرف',
      audienceMode: 'group',
      groupId: ''
    });
    const authorized = getAuthorizedGroupStudentsForAssignment(invalidGroupHw, sampleStudents);
    assert.equal(authorized.length, 0);

    const check = validateHomeworkSubmissionIdentity(invalidGroupHw, {
      assignmentId: 'hw-group-invalid',
      studentId: 'stu-g1-1',
      studentName: 'أحمد محمد',
      groupId: 'grp-1'
    });
    assert.equal(check.valid, false);
  });

  await runScenario(4, 'Group homework stores audienceMode = "group", groupId, groupName, and only that group\'s students', () => {
    const authorized = getAuthorizedGroupStudentsForAssignment(
      { audienceMode: 'group', groupId: 'grp-1' },
      sampleStudents
    );
    const hw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-1',
        title: 'واجب مجموعة A1',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة A1',
        assignedStudents: authorized
      })
    );
    saveLocalAssignment(hw, false);
    const saved = getLocalAssignmentById('hw-grp-1')!;
    assert.equal(saved.audienceMode, 'group');
    assert.equal(saved.groupId, 'grp-1');
    assert.equal(saved.groupName, 'مجموعة A1');
    assert.ok(Array.isArray(saved.assignedStudents));
    assert.equal(saved.assignedStudents!.length, 3); // stu-g1-1, stu-g1-2, stu-g1-dup
    assert.ok(saved.assignedStudents!.every((s) => s.groupId === 'grp-1'));
  });

  await runScenario(5, 'Students from other groups, deleted students, and archived students are excluded from assignedStudents', () => {
    const authorized = getAuthorizedGroupStudentsForAssignment(
      {
        audienceMode: 'group',
        groupId: 'grp-1',
        assignedStudents: [
          { id: 'stu-g1-1', name: 'أحمد محمد', groupId: 'grp-1' },
          { id: 'stu-g2-1', name: 'كريم حسن', groupId: 'grp-2' }
        ]
      },
      sampleStudents
    );
    const ids = authorized.map((s) => s.id);
    assert.ok(ids.includes('stu-g1-1'));
    assert.ok(ids.includes('stu-g1-2'));
    assert.ok(!ids.includes('stu-g2-1'), 'Foreign group student must be excluded');
    assert.ok(!ids.includes('stu-g1-del'), 'Deleted student must be excluded');
    assert.ok(!ids.includes('stu-g1-arc'), 'Archived student must be excluded');
  });

  // =========================================================================
  // STUDENT-FACING PAGE TESTS (6–14)
  // =========================================================================

  await runScenario(6, 'Opening an open homework shows only the manual name input (mode = "open", displayStudents = [])', () => {
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-ui',
        title: 'واجب مفتوح',
        audienceMode: 'open'
      })
    );
    const mode = resolveAssignmentAudienceMode(openHw);
    const displayStudents = mode === 'group' ? getAuthorizedGroupStudentsForAssignment(openHw) : [];
    assert.equal(mode, 'open');
    assert.deepEqual(displayStudents, []);
  });

  await runScenario(7, 'Opening an open homework never displays any student list', () => {
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-7',
        title: 'واجب مفتوح 7',
        audienceMode: 'open',
        assignedStudents: [{ id: 'stu-g1-1', name: 'أحمد محمد', groupId: 'grp-1' }]
      })
    );
    const authorized = getAuthorizedGroupStudentsForAssignment(openHw, sampleStudents);
    assert.equal(authorized.length, 0);
    assert.equal(openHw.assignedStudents, undefined);
  });

  await runScenario(8, 'Opening an open homework on a browser containing dl_students in localStorage still does not display any student list', () => {
    mockStorage.setItem('dl_students', JSON.stringify(sampleStudents));
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-8',
        title: 'واجب مفتوح مع dl_students',
        audienceMode: 'open'
      })
    );
    const mode = resolveAssignmentAudienceMode(openHw);
    const displayStudents = mode === 'group' ? getAuthorizedGroupStudentsForAssignment(openHw) : [];
    assert.equal(mode, 'open');
    assert.equal(displayStudents.length, 0);
  });

  await runScenario(9, 'Opening a group homework shows only students belonging to the selected group', () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-9',
        title: 'واجب جروب 1',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents)
      })
    );
    const mode = resolveAssignmentAudienceMode(groupHw);
    const displayStudents = getAuthorizedGroupStudentsForAssignment(groupHw);
    assert.equal(mode, 'group');
    assert.equal(displayStudents.length, 3);
    assert.ok(displayStudents.every((s) => s.groupId === 'grp-1'));
  });

  await runScenario(10, 'Opening a group homework never displays students from other groups', () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-10',
        title: 'واجب جروب 1',
        audienceMode: 'group',
        groupId: 'grp-1',
        assignedStudents: [
          { id: 'stu-g1-1', name: 'أحمد محمد', groupId: 'grp-1' },
          { id: 'stu-g2-1', name: 'كريم حسن', groupId: 'grp-2' }
        ]
      })
    );
    const displayStudents = getAuthorizedGroupStudentsForAssignment(groupHw, sampleStudents);
    assert.equal(displayStudents.some((s) => s.groupId === 'grp-2'), false);
    assert.equal(displayStudents.some((s) => s.id === 'stu-g2-1'), false);
  });

  await runScenario(11, 'Opening a group homework never falls back to dl_students', () => {
    mockStorage.setItem('dl_students', JSON.stringify(sampleStudents));
    const groupHwWithoutSnapshot = makeAssignment({
      id: 'hw-grp-11',
      title: 'واجب جروب بدون قائمة',
      audienceMode: 'group',
      groupId: 'grp-1',
      assignedStudents: []
    });
    const displayStudents = getAuthorizedGroupStudentsForAssignment(groupHwWithoutSnapshot);
    assert.equal(displayStudents.length, 0, 'Must not read dl_students from localStorage');
  });

  await runScenario(12, 'Opening a group homework never falls back to open manual name entry when assignedStudents is missing', () => {
    const groupHwWithoutSnapshot = makeAssignment({
      id: 'hw-grp-12',
      title: 'واجب جروب مغلق',
      audienceMode: 'group',
      groupId: 'grp-1',
      groupName: 'مجموعة 1'
    });
    const shareUrl = buildHomeworkShareUrl(groupHwWithoutSnapshot, 'https://glueck.example.com');
    const parsedUrl = new URL(shareUrl);
    assert.equal(parsedUrl.searchParams.get('am'), 'group');
    assert.equal(parsedUrl.searchParams.get('gid'), 'grp-1');
    assert.equal(resolveAssignmentAudienceMode(groupHwWithoutSnapshot), 'group');
  });

  await runScenario(13, 'If the group student list is unavailable for a group homework, a clear error state is triggered and submission is blocked', () => {
    const groupHwUnavailable = makeAssignment({
      id: 'hw-grp-13',
      title: 'واجب جروب غير متاح',
      audienceMode: 'group',
      groupId: 'grp-1',
      assignedStudents: []
    });
    const isGroupMode = resolveAssignmentAudienceMode(groupHwUnavailable) === 'group';
    const displayStudents = getAuthorizedGroupStudentsForAssignment(groupHwUnavailable);
    const showGroupUnavailableError = isGroupMode && displayStudents.length === 0;
    assert.equal(showGroupUnavailableError, true);

    const validation = validateHomeworkSubmissionIdentity(groupHwUnavailable, {
      assignmentId: 'hw-grp-13',
      studentId: 'stu-g1-1',
      studentName: 'أحمد محمد',
      groupId: 'grp-1'
    });
    assert.equal(validation.valid, false);
    assert.match(validation.error || '', /قائمة طلاب المجموعة غير متاحة/);
  });

  await runScenario(14, 'Selecting a student in a group homework binds studentId = student.id and studentName = student.name', () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-14',
        title: 'واجب جروب',
        audienceMode: 'group',
        groupId: 'grp-1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents)
      })
    );
    const displayStudents = getAuthorizedGroupStudentsForAssignment(groupHw);
    const chosen = displayStudents.find((s) => s.id === 'stu-g1-dup')!;
    assert.ok(chosen);

    const validation = validateHomeworkSubmissionIdentity(groupHw, {
      assignmentId: 'hw-grp-14',
      studentId: chosen.id,
      studentName: chosen.name,
      groupId: groupHw.groupId
    });
    assert.equal(validation.valid, true);
    assert.equal(validation.normalizedStudentId, 'stu-g1-dup');
    assert.equal(validation.normalizedStudentName, 'أحمد محمد');
    assert.equal(validation.normalizedGroupId, 'grp-1');
    assert.equal(validation.audienceMode, 'group');
  });

  // =========================================================================
  // SUBMISSION TESTS (15–20)
  // =========================================================================

  await runScenario(15, 'Open homework submission with a manual name succeeds and saves studentName and audienceMode = "open"', () => {
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-15',
        title: 'واجب مفتوح 15',
        audienceMode: 'open'
      })
    );
    const pid = getOrCreateOpenParticipantId(openHw.id, 'يوسف طارق');
    const validation = validateHomeworkSubmissionIdentity(openHw, {
      assignmentId: openHw.id,
      studentName: '  يوسف طارق  ',
      participantId: pid
    });
    assert.equal(validation.valid, true);
    assert.equal(validation.normalizedStudentName, 'يوسف طارق');
    assert.equal(validation.audienceMode, 'open');
    assert.equal(validation.normalizedStudentId, undefined);
    assert.equal(validation.normalizedGroupId, undefined);
    assert.equal(validation.normalizedParticipantId, pid);
  });

  await runScenario(16, 'Open homework submission with an empty name is rejected', () => {
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-16',
        title: 'واجب مفتوح 16',
        audienceMode: 'open'
      })
    );
    const validation = validateHomeworkSubmissionIdentity(openHw, {
      assignmentId: openHw.id,
      studentName: '   '
    });
    assert.equal(validation.valid, false);
    assert.match(validation.error || '', /يرجى كتابة اسمك/);
  });

  await runScenario(17, 'Group homework submission with a valid group student succeeds and saves studentId, studentName, groupId, and audienceMode = "group"', () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-17',
        title: 'واجب جروب 17',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents)
      })
    );
    const validation = validateHomeworkSubmissionIdentity(groupHw, {
      assignmentId: groupHw.id,
      studentId: 'stu-g1-2',
      studentName: 'سارة علي',
      groupId: 'grp-1'
    });
    assert.equal(validation.valid, true);
    assert.equal(validation.normalizedStudentId, 'stu-g1-2');
    assert.equal(validation.normalizedStudentName, 'سارة علي');
    assert.equal(validation.normalizedGroupId, 'grp-1');
    assert.equal(validation.audienceMode, 'group');
  });

  await runScenario(18, 'Group homework submission without studentId is rejected', () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-18',
        title: 'واجب جروب 18',
        audienceMode: 'group',
        groupId: 'grp-1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents)
      })
    );
    const validation = validateHomeworkSubmissionIdentity(groupHw, {
      assignmentId: groupHw.id,
      studentName: 'أحمد محمد',
      groupId: 'grp-1'
    });
    assert.equal(validation.valid, false);
    assert.match(validation.error || '', /يجب اختيار اسم الطالب من قائمة المجموعة/);
  });

  await runScenario(19, 'Group homework submission with a studentId from another group is rejected', () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-19',
        title: 'واجب جروب 19',
        audienceMode: 'group',
        groupId: 'grp-1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents)
      })
    );
    const validation = validateHomeworkSubmissionIdentity(groupHw, {
      assignmentId: groupHw.id,
      studentId: 'stu-g2-1', // belongs to grp-2
      studentName: 'كريم حسن',
      groupId: 'grp-1'
    });
    assert.equal(validation.valid, false);
    assert.match(validation.error || '', /غير مقيد ضمن المجموعة/);
  });

  await runScenario(20, 'Group homework submission with a forged manual name not matching the registered student record is rejected', () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-20',
        title: 'واجب جروب 20',
        audienceMode: 'group',
        groupId: 'grp-1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents)
      })
    );
    const validation = validateHomeworkSubmissionIdentity(groupHw, {
      assignmentId: groupHw.id,
      studentId: 'stu-g1-1',
      studentName: 'اسم مزيف مختلف',
      groupId: 'grp-1'
    });
    assert.equal(validation.valid, false);
    assert.match(validation.error || '', /لا يطابق السجل الرسمي/);
  });

  // =========================================================================
  // TEACHER FOLLOW-UP DASHBOARD TESTS (21–28)
  // =========================================================================

  await runScenario(21, 'Open homework submission appears in the teacher Follow-up view under that assignment', async () => {
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-21',
        title: 'واجب مفتوح 21',
        audienceMode: 'open',
        cloudSynced: true
      })
    );
    saveLocalAssignment(openHw, false);

    const pid = getOrCreateOpenParticipantId(openHw.id, 'ليلى محمود');
    const sub = makeSubmission({
      id: buildDeterministicSubmissionId(openHw.id, undefined, 'ليلى محمود', 1, pid),
      assignmentId: openHw.id,
      studentName: 'ليلى محمود',
      participantId: pid,
      audienceMode: 'open',
      scorePercentage: 95,
      accuracy: 95,
      totalQuestions: 2,
      correctAnswersCount: 2
    });
    saveLocalSubmission(sub, false);

    const details = await fetchAssignmentDetailsWithSync(openHw.id, sampleStudents);
    assert.ok(details);
    assert.equal(details.studentStatusSummary.length, 1);
    assert.equal(details.studentStatusSummary[0].studentName, 'ليلى محمود');
    assert.equal(details.studentStatusSummary[0].status, 'completed');
    assert.equal(details.studentStatusSummary[0].bestScore, 95);
    assert.equal(details.metrics.completedCount, 1);
    assert.equal(details.metrics.notStartedCount, 0);
  });

  await runScenario(22, 'Multiple open submissions from different names appear as separate participants', async () => {
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-22',
        title: 'واجب مفتوح 22',
        audienceMode: 'open',
        cloudSynced: true
      })
    );
    saveLocalAssignment(openHw, false);

    const pid1 = 'open_dev_1';
    const pid2 = 'open_dev_2';

    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(openHw.id, undefined, 'عمر خالد', 1, pid1),
        assignmentId: openHw.id,
        studentName: 'عمر خالد',
        participantId: pid1,
        audienceMode: 'open',
        scorePercentage: 80,
        accuracy: 80,
        correctAnswersCount: 1
      }),
      false
    );

    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(openHw.id, undefined, 'نور هاني', 1, pid2),
        assignmentId: openHw.id,
        studentName: 'نور هاني',
        participantId: pid2,
        audienceMode: 'open',
        scorePercentage: 100,
        accuracy: 100,
        correctAnswersCount: 2
      }),
      false
    );

    const details = await fetchAssignmentDetailsWithSync(openHw.id, sampleStudents);
    assert.equal(details.studentStatusSummary.length, 2);
    assert.equal(details.metrics.completedCount, 2);
  });

  await runScenario(23, 'Multiple attempts by the same open participant are grouped accurately, while two different open participants with the same name stay separate', async () => {
    const openHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-open-23',
        title: 'واجب مفتوح 23',
        audienceMode: 'open',
        cloudSynced: true
      })
    );
    saveLocalAssignment(openHw, false);

    const deviceA = 'open_device_A';
    const deviceB = 'open_device_B';

    // Device A ("محمد"): Attempt 1 (60%) and Attempt 2 (90%)
    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(openHw.id, undefined, 'محمد', 1, deviceA),
        assignmentId: openHw.id,
        studentName: 'محمد',
        participantId: deviceA,
        audienceMode: 'open',
        scorePercentage: 60,
        accuracy: 60,
        correctAnswersCount: 1,
        attemptNumber: 1,
        completedAt: '2026-01-01T01:00:00.000Z'
      }),
      false
    );

    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(openHw.id, undefined, 'محمد', 2, deviceA),
        assignmentId: openHw.id,
        studentName: 'محمد',
        participantId: deviceA,
        audienceMode: 'open',
        scorePercentage: 90,
        accuracy: 90,
        correctAnswersCount: 2,
        attemptNumber: 2,
        completedAt: '2026-01-01T02:00:00.000Z'
      }),
      false
    );

    // Device B (also typed "محمد"): Attempt 1 (100%)
    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(openHw.id, undefined, 'محمد', 1, deviceB),
        assignmentId: openHw.id,
        studentName: 'محمد',
        participantId: deviceB,
        audienceMode: 'open',
        scorePercentage: 100,
        accuracy: 100,
        correctAnswersCount: 2,
        attemptNumber: 1,
        completedAt: '2026-01-01T01:30:00.000Z'
      }),
      false
    );

    const details = await fetchAssignmentDetailsWithSync(openHw.id, sampleStudents);
    assert.equal(details.studentStatusSummary.length, 2, 'Two devices with the same typed name must stay separate');
    const rowA = details.studentStatusSummary.find((s: any) => s.participantId === deviceA)!;
    const rowB = details.studentStatusSummary.find((s: any) => s.participantId === deviceB)!;
    assert.ok(rowA);
    assert.ok(rowB);
    assert.equal(rowA.attemptsCount, 2);
    assert.equal(rowA.bestScore, 90);
    assert.equal(rowA.latestScore, 90);
    assert.equal(rowB.attemptsCount, 1);
    assert.equal(rowB.bestScore, 100);
  });

  await runScenario(24, 'Group homework Follow-up view shows all students from the selected group', async () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-24',
        title: 'واجب جروب 24',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents),
        cloudSynced: true
      })
    );
    saveLocalAssignment(groupHw, false);

    const details = await fetchAssignmentDetailsWithSync(groupHw.id, sampleStudents);
    assert.equal(details.studentStatusSummary.length, 3); // stu-g1-1, stu-g1-2, stu-g1-dup
    assert.equal(details.metrics.totalAssigned, 3);
  });

  await runScenario(25, 'Group students who submitted appear as completed with accurate score and attempt count', async () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-25',
        title: 'واجب جروب 25',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents),
        cloudSynced: true
      })
    );
    saveLocalAssignment(groupHw, false);

    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(groupHw.id, 'stu-g1-2', 'سارة علي', 1),
        assignmentId: groupHw.id,
        studentId: 'stu-g1-2',
        studentName: 'سارة علي',
        groupId: 'grp-1',
        audienceMode: 'group',
        scorePercentage: 75,
        accuracy: 75,
        totalQuestions: 4,
        correctAnswersCount: 3,
        attemptNumber: 1,
        completedAt: '2026-01-01T01:00:00.000Z'
      }),
      false
    );

    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(groupHw.id, 'stu-g1-2', 'سارة علي', 2),
        assignmentId: groupHw.id,
        studentId: 'stu-g1-2',
        studentName: 'سارة علي',
        groupId: 'grp-1',
        audienceMode: 'group',
        scorePercentage: 100,
        accuracy: 100,
        totalQuestions: 4,
        correctAnswersCount: 4,
        attemptNumber: 2,
        completedAt: '2026-01-01T02:00:00.000Z'
      }),
      false
    );

    const details = await fetchAssignmentDetailsWithSync(groupHw.id, sampleStudents);
    const sara = details.studentStatusSummary.find((s: any) => s.studentId === 'stu-g1-2')!;
    assert.ok(sara);
    assert.equal(sara.status, 'completed');
    assert.equal(sara.attemptsCount, 2);
    assert.equal(sara.bestScore, 100);
    assert.equal(sara.latestScore, 100);
  });

  await runScenario(26, 'Group students who have not submitted appear as pending ("not_started")', async () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-26',
        title: 'واجب جروب 26',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents),
        cloudSynced: true
      })
    );
    saveLocalAssignment(groupHw, false);

    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(groupHw.id, 'stu-g1-2', 'سارة علي', 1),
        assignmentId: groupHw.id,
        studentId: 'stu-g1-2',
        studentName: 'سارة علي',
        groupId: 'grp-1',
        audienceMode: 'group',
        scorePercentage: 90,
        accuracy: 90
      }),
      false
    );

    const details = await fetchAssignmentDetailsWithSync(groupHw.id, sampleStudents);
    const pendingStudents = details.studentStatusSummary.filter((s: any) => s.status === 'not_started');
    assert.equal(pendingStudents.length, 2);
    assert.equal(details.metrics.completedCount, 1);
    assert.equal(details.metrics.notStartedCount, 2);
  });

  await runScenario(27, 'Students from other groups never appear in the group homework Follow-up view', async () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-27',
        title: 'واجب جروب 27',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents),
        cloudSynced: true
      })
    );
    saveLocalAssignment(groupHw, false);

    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(groupHw.id, 'stu-g2-1', 'كريم حسن', 1),
        assignmentId: groupHw.id,
        studentId: 'stu-g2-1',
        studentName: 'كريم حسن',
        groupId: 'grp-2',
        audienceMode: 'group',
        scorePercentage: 100,
        accuracy: 100
      }),
      false
    );

    const details = await fetchAssignmentDetailsWithSync(groupHw.id, sampleStudents);
    assert.equal(details.studentStatusSummary.some((s: any) => s.studentId === 'stu-g2-1'), false);
    assert.equal(details.studentStatusSummary.some((s: any) => s.studentName === 'كريم حسن'), false);
  });

  await runScenario(28, 'Two students with the same name in the same group (different studentIds) are tracked separately without collision', async () => {
    const groupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-grp-28',
        title: 'واجب جروب 28',
        audienceMode: 'group',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ audienceMode: 'group', groupId: 'grp-1' }, sampleStudents),
        cloudSynced: true
      })
    );
    saveLocalAssignment(groupHw, false);

    // First "أحمد محمد" (stu-g1-1) scores 100%
    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(groupHw.id, 'stu-g1-1', 'أحمد محمد', 1),
        assignmentId: groupHw.id,
        studentId: 'stu-g1-1',
        studentName: 'أحمد محمد',
        groupId: 'grp-1',
        audienceMode: 'group',
        scorePercentage: 100,
        accuracy: 100,
        completedAt: '2026-01-01T01:00:00.000Z'
      }),
      false
    );

    // Second "أحمد محمد" (stu-g1-dup) scores 50%
    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId(groupHw.id, 'stu-g1-dup', 'أحمد محمد', 1),
        assignmentId: groupHw.id,
        studentId: 'stu-g1-dup',
        studentName: 'أحمد محمد',
        groupId: 'grp-1',
        audienceMode: 'group',
        scorePercentage: 50,
        accuracy: 50,
        correctAnswersCount: 1,
        completedAt: '2026-01-01T02:00:00.000Z'
      }),
      false
    );

    const details = await fetchAssignmentDetailsWithSync(groupHw.id, sampleStudents);
    const ahmed1 = details.studentStatusSummary.find((s: any) => s.studentId === 'stu-g1-1')!;
    const ahmed2 = details.studentStatusSummary.find((s: any) => s.studentId === 'stu-g1-dup')!;
    assert.ok(ahmed1);
    assert.ok(ahmed2);
    assert.equal(ahmed1.status, 'completed');
    assert.equal(ahmed1.bestScore, 100);
    assert.equal(ahmed1.attemptsCount, 1);
    assert.equal(ahmed2.status, 'completed');
    assert.equal(ahmed2.bestScore, 50);
    assert.equal(ahmed2.attemptsCount, 1);
  });

  // =========================================================================
  // PERSISTENCE & SYNC TESTS (29–33) + EXPRESS API VERIFICATION
  // =========================================================================

  await runScenario(29, 'Confirmed cloud write sets cloudSynced = true', async () => {
    const hw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-sync-29',
        title: 'واجب متزامن',
        audienceMode: 'open',
        cloudSynced: false
      })
    );
    saveLocalAssignment(hw, false);
    assert.equal(getPendingHomeworkSyncCount(), 1);

    const result = await flushPendingHomeworkCloudWrites();
    assert.equal(result.syncedAssignments, 1);
    assert.equal(getPendingHomeworkSyncCount(), 0);
    assert.equal(getLocalAssignmentById('hw-sync-29')?.cloudSynced, true);
  });

  await runScenario(30, 'Failed cloud write keeps cloudSynced = false and queues pending sync', async () => {
    __setHomeworkSyncTransportForTests({
      saveAssignment: async () => false,
      saveSubmission: async () => false,
      fetchAssignment: async () => null,
      fetchSubmissionsForAssignment: async () => []
    });

    const hw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-sync-30',
        title: 'واجب غير متزامن',
        audienceMode: 'open',
        cloudSynced: false
      })
    );
    saveLocalAssignment(hw, false);

    const sub = makeSubmission({
      id: buildDeterministicSubmissionId(hw.id, undefined, 'طارق', 1, 'pid-30'),
      assignmentId: hw.id,
      studentName: 'طارق',
      participantId: 'pid-30',
      audienceMode: 'open',
      scorePercentage: 80,
      accuracy: 80,
      cloudSynced: false
    });
    saveLocalSubmission(sub, false);

    await flushPendingHomeworkCloudWrites();
    assert.equal(getLocalAssignmentById('hw-sync-30')?.cloudSynced, false);
    assert.equal(getLocalSubmissionsForAssignment('hw-sync-30')[0]?.cloudSynced, false);
    assert.equal(getPendingHomeworkSyncCount(), 2);
  });

  await runScenario(31, 'Pending local homework and submissions flush when connection recovers', async () => {
    let online = false;
    __setHomeworkSyncTransportForTests({
      saveAssignment: async () => online,
      saveSubmission: async () => online,
      fetchAssignment: async () => null,
      fetchSubmissionsForAssignment: async () => []
    });

    saveLocalAssignment(
      normalizeHomeworkAssignment(
        makeAssignment({
          id: 'hw-sync-31',
          title: 'واجب أوفلاين',
          audienceMode: 'open',
          cloudSynced: false
        })
      ),
      false
    );
    saveLocalSubmission(
      makeSubmission({
        id: buildDeterministicSubmissionId('hw-sync-31', undefined, 'ريم', 1, 'pid-31'),
        assignmentId: 'hw-sync-31',
        studentName: 'ريم',
        participantId: 'pid-31',
        audienceMode: 'open',
        cloudSynced: false
      }),
      false
    );

    // While offline
    const attempt1 = await flushPendingHomeworkCloudWrites();
    assert.equal(attempt1.remainingPending, 2);

    // Connection recovers
    online = true;
    const attempt2 = await flushPendingHomeworkCloudWrites();
    assert.equal(attempt2.syncedAssignments, 1);
    assert.equal(attempt2.syncedSubmissions, 1);
    assert.equal(attempt2.remainingPending, 0);
    assert.equal(getLocalAssignmentById('hw-sync-31')?.cloudSynced, true);
    assert.equal(getLocalSubmissionsForAssignment('hw-sync-31')[0]?.cloudSynced, true);
  });

  await runScenario(32, 'Existing legacy homework assignments and submissions remain readable and backward-compatible', async () => {
    // 1. Legacy "All Groups" homework without audienceMode or groupId -> resolves to 'open' and strips full-DB assignedStudents
    const legacyAllGroups = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-legacy-all',
        title: 'واجب قديم عام',
        groupId: 'all',
        assignedStudents: sampleStudents.map((s) => ({ id: s.id, name: s.name, groupId: s.groupId }))
      })
    );
    assert.equal(legacyAllGroups.audienceMode, 'open');
    assert.equal(legacyAllGroups.groupId, undefined);
    assert.equal(legacyAllGroups.assignedStudents, undefined);

    // 2. Legacy Group homework with groupId = 'grp-1' but no audienceMode -> resolves to 'group'
    const legacyGroupHw = normalizeHomeworkAssignment(
      makeAssignment({
        id: 'hw-legacy-grp',
        title: 'واجب قديم لمجموعة 1',
        groupId: 'grp-1',
        groupName: 'مجموعة 1',
        assignedStudents: getAuthorizedGroupStudentsForAssignment({ groupId: 'grp-1' }, sampleStudents),
        cloudSynced: true
      })
    );
    assert.equal(legacyGroupHw.audienceMode, 'group');

    mockStorage.setItem(
      'glueck_hw_submissions_v2',
      JSON.stringify([
        makeSubmission({
          id: 'legacy-sub-1',
          assignmentId: legacyGroupHw.id,
          studentName: 'سارة علي',
          scorePercentage: 85,
          accuracy: 85,
          correctAnswersCount: 1
        })
      ])
    );
    saveLocalAssignment(legacyGroupHw, false);

    const details = await fetchAssignmentDetailsWithSync(legacyGroupHw.id, sampleStudents);
    const sara = details.studentStatusSummary.find((s: any) => s.studentId === 'stu-g1-2')!;
    assert.ok(sara, 'Legacy name-only submission should still match unique group student');
    assert.equal(sara.status, 'completed');
    assert.equal(sara.bestScore, 85);
  });

  await runScenario(33, 'Deleting a homework removes its local records and Express backend validates group vs open submissions', async () => {
    saveLocalAssignment(
      normalizeHomeworkAssignment(
        makeAssignment({
          id: 'hw-del-33',
          title: 'واجب للحذف',
          audienceMode: 'open',
          cloudSynced: true
        })
      ),
      false
    );
    saveLocalSubmission(
      makeSubmission({
        id: 'sub-del-33',
        assignmentId: 'hw-del-33',
        studentName: 'طالب',
        audienceMode: 'open'
      }),
      false
    );

    assert.ok(getLocalAssignmentById('hw-del-33'));
    assert.equal(getLocalSubmissionsForAssignment('hw-del-33').length, 1);

    deleteLocalAssignment('hw-del-33', false);
    assert.equal(getLocalAssignmentById('hw-del-33'), null);
    assert.equal(getLocalSubmissionsForAssignment('hw-del-33').length, 0);

    // Also verify Express API endpoints enforce group vs open validation
    const server = expressApp.listen(0);
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      // Create group assignment on Express API
      const createRes = await fetch(`${baseUrl}/api/teacher/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          makeAssignment({
            id: 'api-grp-hw',
            title: 'واجب جروب عبر السيرفر',
            audienceMode: 'group',
            groupId: 'grp-1',
            groupName: 'مجموعة 1',
            assignedStudents: [{ id: 'stu-g1-1', name: 'أحمد محمد', groupId: 'grp-1' }]
          })
        )
      });
      assert.equal(createRes.status, 200);

      // Attempt forged open/foreign submission to group assignment -> must return 403
      const badSubRes = await fetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          makeSubmission({
            id: 'bad-sub',
            assignmentId: 'api-grp-hw',
            studentId: 'stu-g2-1',
            studentName: 'كريم حسن',
            groupId: 'grp-2'
          })
        )
      });
      assert.equal(badSubRes.status, 403);

      // Valid group student submission -> must return 200
      const goodSubRes = await fetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          makeSubmission({
            id: 'good-sub',
            assignmentId: 'api-grp-hw',
            studentId: 'stu-g1-1',
            studentName: 'أحمد محمد',
            groupId: 'grp-1'
          })
        )
      });
      assert.equal(goodSubRes.status, 200);
    } finally {
      server.close();
    }
  });

  await runScenario(34, 'Homework monitoring badge stats return 0 when no active assignments exist even if orphaned submissions are present', async () => {
    // 5 orphaned submissions exist in storage, but 0 active assignments exist
    mockStorage.setItem(
      'glueck_hw_submissions_v2',
      JSON.stringify([
        makeSubmission({ id: 'orphan-1', assignmentId: 'old-deleted-hw-1', studentName: 'طالب 1', status: 'in_progress', completedAt: '' }),
        makeSubmission({ id: 'orphan-2', assignmentId: 'old-deleted-hw-1', studentName: 'طالب 2', status: 'completed' }),
        makeSubmission({ id: 'orphan-3', assignmentId: 'old-deleted-hw-2', studentName: 'طالب 3', status: 'completed' }),
        makeSubmission({ id: 'orphan-4', assignmentId: 'old-deleted-hw-3', studentName: 'طالب 4', status: 'in_progress', completedAt: '' }),
        makeSubmission({ id: 'orphan-5', assignmentId: 'old-deleted-hw-4', studentName: 'طالب 5', status: 'completed' })
      ])
    );

    const emptyStats = getHomeworkSummaryStats(sampleStudents);
    assert.equal(emptyStats.assignmentsCount, 0);
    assert.equal(emptyStats.submissionsCount, 0);
    assert.equal(emptyStats.inProgressCount, 0);
    assert.equal(getPendingHomeworkSyncCount(), 0);

    // Create 1 active assignment and 1 valid submission -> badge reflects only the active assignment
    saveLocalAssignment(
      normalizeHomeworkAssignment(
        makeAssignment({
          id: 'hw-active-34',
          title: 'واجب فعلي',
          audienceMode: 'open',
          cloudSynced: true
        })
      ),
      false
    );
    saveLocalSubmission(
      makeSubmission({
        id: 'valid-sub-34',
        assignmentId: 'hw-active-34',
        participantId: 'pid-34-1',
        studentName: 'يوسف',
        audienceMode: 'open',
        status: 'in_progress',
        completedAt: ''
      }),
      false
    );

    const activeStats = getHomeworkSummaryStats(sampleStudents);
    assert.equal(activeStats.assignmentsCount, 1);
    assert.equal(activeStats.submissionsCount, 0);
    assert.equal(activeStats.inProgressCount, 1);

    // Delete the active assignment -> badge immediately drops back to 0
    deleteLocalAssignment('hw-active-34', false);
    const afterDeleteStats = getHomeworkSummaryStats(sampleStudents);
    assert.equal(afterDeleteStats.assignmentsCount, 0);
    assert.equal(afterDeleteStats.submissionsCount, 0);
    assert.equal(afterDeleteStats.inProgressCount, 0);
  });

  console.log(`\n🎉 All ${passed}/34 Homework System Repair scenarios passed!`);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
