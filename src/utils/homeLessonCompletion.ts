import type { Group, Student, Lesson, LessonReport, AttendanceStatus, PaymentStatus } from '../types';
import { isGroupPerLesson, resolveLessonCycleNumber } from './lessonUtils';
import { isStudentMatchingLessonWeek } from './scheduleUtils';
import { traceLessonPipeline } from './lessonPipelineDiagnostics';

export interface HomeQuickCompletionDependencies {
  groups: Group[];
  students: Student[];
  language: 'ar' | 'en' | 'de';
  getFullLessonsSnapshot: () => Lesson[];
  saveLessonReport: (
    lessonId: string,
    report: LessonReport,
    packageCount?: number,
    sessionNumber?: number,
    fallbackLesson?: Lesson
  ) => void;
  clearDraft: (lessonId: string) => void;
}

/**
 * The actual Home checkmark handler, extracted without changing its behavior so
 * the production UI and regression test execute exactly the same completion path.
 */
export const handleHomeQuickLessonCompletion = (
  event: { stopPropagation: () => void },
  targetLesson: Lesson,
  dependencies: HomeQuickCompletionDependencies
): void => {
  const { groups, students, language, getFullLessonsSnapshot, saveLessonReport, clearDraft } = dependencies;
  event.stopPropagation();

  const fullSnapshotAtCheckmark = getFullLessonsSnapshot();
  traceLessonPipeline('Home checkmark: handler entered', fullSnapshotAtCheckmark, {
    note: `clicked id=${targetLesson.id}; group=${targetLesson.groupName || targetLesson.groupId || ''}; student=${targetLesson.studentName || targetLesson.studentId || ''}; date=${targetLesson.date}; time=${targetLesson.time}; status=${targetLesson.status}`
  });

  const targetGroup = targetLesson.groupId
    ? (groups.find(g => g.id === targetLesson.groupId) || groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupId!.trim().toLowerCase()))
    : (targetLesson.groupName ? groups.find(g => g.name && g.name.trim().toLowerCase() === targetLesson.groupName!.trim().toLowerCase()) : undefined);

  const targetStudent = students.find(s =>
    !s.deleted && s.status !== 'archived' && (
      (targetLesson.studentId && s.id === targetLesson.studentId) ||
      (targetLesson.studentName && s.name.trim().toLowerCase() === targetLesson.studentName.trim().toLowerCase())
    )
  );

  const groupSts = targetGroup
    ? students.filter(s => !s.deleted && s.status !== 'archived' && s.groupId === targetGroup.id)
    : [];
  const matchingWeekGroupSts = groupSts.filter(s => !targetLesson.date || isStudentMatchingLessonWeek(s.scheduleRecurrence, targetLesson.date));
  const activeLessonStudents = targetGroup
    ? (matchingWeekGroupSts.length > 0 ? matchingWeekGroupSts : groupSts)
    : (targetStudent ? [targetStudent] : []);

  const studentAttendanceMap: Record<string, AttendanceStatus> = { ...(targetLesson.report?.studentAttendance || {}) };
  const studentHomeworkDoneMap: Record<string, 'yes' | 'no' | 'none'> = { ...(targetLesson.report?.studentHomeworkDone || {}) };
  const studentDictationGradeMap: Record<string, number> = { ...(targetLesson.report?.studentDictationGrade || {}) };
  const studentExamGradeMap: Record<string, number> = { ...(targetLesson.report?.studentExamGrade || {}) };
  const studentNotesMap: Record<string, string> = { ...(targetLesson.report?.studentNotes || {}) };
  const studentPaymentsMap: Record<string, { status: PaymentStatus; amount: number }> = {};

  activeLessonStudents.forEach(st => {
    if (!studentAttendanceMap[st.id]) studentAttendanceMap[st.id] = 'present';
    studentHomeworkDoneMap[st.id] = 'none';
    if (studentDictationGradeMap[st.id] === undefined) studentDictationGradeMap[st.id] = -1;
    if (studentExamGradeMap[st.id] === undefined) studentExamGradeMap[st.id] = -1;
    if (studentNotesMap[st.id] === undefined) studentNotesMap[st.id] = '';
    const existingPay = (targetLesson.studentPayments as any)?.[st.id] || (targetLesson.report?.studentPayments as any)?.[st.id];
    studentPaymentsMap[st.id] = {
      status: existingPay?.paymentStatus || existingPay?.status || 'pending',
      amount: existingPay?.amountPaid ?? existingPay?.amount ?? 0
    };
  });

  const isPerLessonGroup = Boolean(
    isGroupPerLesson(targetGroup) ||
    (targetStudent && (targetStudent.paymentPlan === 'per_lesson' || targetStudent.bundleSize === 1)) ||
    targetLesson.totalSessionsInPackage === 1
  );
  const cycleTotalSessions = isPerLessonGroup
    ? 1
    : ((targetGroup?.sessionCount && targetGroup.sessionCount > 1)
        ? targetGroup.sessionCount
        : (targetLesson.totalSessionsInPackage && targetLesson.totalSessionsInPackage > 1 ? targetLesson.totalSessionsInPackage : 4));

  const cycleRes = resolveLessonCycleNumber(targetLesson, fullSnapshotAtCheckmark, {
    group: targetGroup,
    student: targetStudent,
    students
  });
  const finalSessionNumber = isPerLessonGroup
    ? 1
    : (cycleRes.sessionNumber >= 1 ? cycleRes.sessionNumber : 1);

  const noHwLabel = language === 'de' ? 'Keine Hausaufgabe' : language === 'en' ? 'None assigned' : 'لا يوجد واجب';
  const reportData: LessonReport = {
    ...(targetLesson.report || {}),
    attendanceStatus: 'present',
    studentAttendance: studentAttendanceMap,
    homeworkStatus: 'none' as any,
    arabicHomeworkOption: 'none',
    homeworkTitle: noHwLabel,
    homeworkDescription: noHwLabel,
    arabicHomeworkRequired: 'لا يوجد واجب',
    arabicPreviousHomework: 'لا يوجد واجب سابق',
    previousHomeworkDescription: 'لا يوجد واجب سابق',
    teacherNotes: 'wiederholen',
    arabicTopicsExplained: 'wiederholen',
    studentHomeworkDone: studentHomeworkDoneMap,
    studentDictationGrade: studentDictationGradeMap,
    studentExamGrade: studentExamGradeMap,
    studentNotes: studentNotesMap,
    paymentStatus: targetLesson.paymentStatus || 'pending',
    amountPaid: targetLesson.amountPaid || 0,
    ...(activeLessonStudents.length > 1 ? { studentPayments: studentPaymentsMap } : {}),
    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  traceLessonPipeline('Home checkmark: immediately before saveLessonReport', getFullLessonsSnapshot(), {
    note: `completing id=${targetLesson.id}; report status=completed; session=${finalSessionNumber}/${cycleTotalSessions}`
  });
  saveLessonReport(targetLesson.id, reportData, cycleTotalSessions, finalSessionNumber, targetLesson);
  traceLessonPipeline('Home checkmark: saveLessonReport returned (queued persistence may still be running)', getFullLessonsSnapshot(), {
    note: `completed id=${targetLesson.id}`
  });
  clearDraft(targetLesson.id);
};
