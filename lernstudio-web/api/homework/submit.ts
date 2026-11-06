import { parseRequestBody, sendJson } from '../_auth.js';
import {
  getAssignment,
  getSubmissionsForAssignment,
  saveSubmission,
  HomeworkSubmission,
  HomeworkQuestionResponse
} from '../_storage.js';

export default async function handler(req: any, res?: any) {
  try {
    const body = await parseRequestBody(req);
    const { assignmentId, studentName, responses, startedAt, completedAt, assignmentFallback } = body || {};

    if (!assignmentId || !studentName || !responses || !Array.isArray(responses)) {
      return sendJson(res, 400, { error: 'Missing required submission fields' });
    }

    const cleanName = studentName.trim();
    if (cleanName.length < 2) {
      return sendJson(res, 400, { error: 'Bitte gib deinen Namen ein / Please enter your name' });
    }

    const assignment = (await getAssignment(assignmentId)) || assignmentFallback;
    if (!assignment) {
      return sendJson(res, 404, { error: 'Assignment not found' });
    }

    if (assignment.deadline && new Date(assignment.deadline).getTime() < Date.now()) {
      return sendJson(res, 410, { error: 'Deadline expired' });
    }

    if (assignment.isActive === false || assignment.status === 'closed') {
      return sendJson(res, 403, { error: 'Assignment closed' });
    }

    const existingSubmissions = await getSubmissionsForAssignment(assignmentId);
    const studentAttempts = existingSubmissions.filter(
      (s) => s.studentName.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (assignment.maxAttempts > 0 && studentAttempts.length >= assignment.maxAttempts) {
      return sendJson(res, 429, {
        error: `Maximale Anzahl an Versuchen (${assignment.maxAttempts}) erreicht / Maximum attempts reached`
      });
    }

    const itemsMap = new Map<string, any>();
    (assignment.setSnapshot?.items || []).forEach((item: any) => {
      itemsMap.set(item.id, item);
      if (item.german) {
        itemsMap.set(item.german.toLowerCase().trim(), item);
      }
    });

    let correctCount = 0;
    const verifiedResponses: HomeworkQuestionResponse[] = responses.map((r: any) => {
      const targetItem = itemsMap.get(r.questionId) || itemsMap.get((r.germanWord || '').toLowerCase().trim());
      const expectedGerman = targetItem ? targetItem.german.trim() : (r.correctAnswer || '').trim();
      const studentAns = (r.studentAnswer || '').trim();

      const isCorrect =
        studentAns.toLowerCase() === expectedGerman.toLowerCase() ||
        Boolean(targetItem && targetItem.arabic && studentAns === targetItem.arabic.trim());

      if (isCorrect) correctCount++;

      return {
        questionId: r.questionId || 'q_' + Math.random().toString(36).substring(2, 6),
        germanWord: targetItem ? targetItem.german : r.germanWord || 'Unknown',
        studentAnswer: studentAns,
        correctAnswer: expectedGerman,
        isCorrect,
        timeSpentSeconds: Number(r.timeSpentSeconds) || 3
      };
    });

    const totalQuestions = verifiedResponses.length;
    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const startMs = startedAt ? new Date(startedAt).getTime() : Date.now() - totalQuestions * 4000;
    const endMs = completedAt ? new Date(completedAt).getTime() : Date.now();
    const timeSpentSeconds = Math.max(5, Math.round((endMs - startMs) / 1000));

    const submission: HomeworkSubmission = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      assignmentId,
      studentName: cleanName,
      attemptNumber: studentAttempts.length + 1,
      startedAt: new Date(startMs).toISOString(),
      completedAt: new Date(endMs).toISOString(),
      timeSpentSeconds,
      totalQuestions,
      correctAnswersCount: correctCount,
      scorePercentage,
      score: correctCount,
      accuracy: scorePercentage,
      responses: verifiedResponses
    };

    await saveSubmission(submission);

    return sendJson(res, 201, {
      success: true,
      submission: {
        id: submission.id,
        studentName: submission.studentName,
        scorePercentage,
        correctAnswersCount: correctCount,
        score: correctCount,
        accuracy: scorePercentage,
        totalQuestions,
        attemptNumber: submission.attemptNumber
      }
    });
  } catch (err: any) {
    return sendJson(res, 500, { error: err?.message || 'Error submitting homework' });
  }
}

export const POST = (req: Request) => handler(req);
