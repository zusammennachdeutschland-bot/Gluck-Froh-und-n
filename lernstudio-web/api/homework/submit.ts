import { getAssignment, getSubmissionsForAssignment, saveSubmission } from '../_storage';
import { HomeworkSubmission, HomeworkQuestionResponse } from '../../shared/homeworkTypes';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assignmentId, studentName, responses, startedAt, completedAt } = body;

    if (!assignmentId || !studentName || !responses || !Array.isArray(responses)) {
      return new Response(JSON.stringify({ error: 'Missing required submission fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanName = studentName.trim();
    if (cleanName.length < 2) {
      return new Response(JSON.stringify({ error: 'Bitte gib deinen Namen ein / Please enter your name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const assignment = await getAssignment(assignmentId);
    if (!assignment) {
      return new Response(JSON.stringify({ error: 'Assignment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Server-side Deadline check
    if (assignment.deadline && new Date(assignment.deadline).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'Deadline expired' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!assignment.isActive) {
      return new Response(JSON.stringify({ error: 'Assignment closed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check student attempt limits
    const existingSubmissions = await getSubmissionsForAssignment(assignmentId);
    const studentAttempts = existingSubmissions.filter(
      (s) => s.studentName.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (assignment.maxAttempts > 0 && studentAttempts.length >= assignment.maxAttempts) {
      return new Response(
        JSON.stringify({
          error: `Maximale Anzahl an Versuchen (${assignment.maxAttempts}) erreicht / Maximum attempts reached`
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // SERVER-SIDE SCORING: Verify student answers against the immutable setSnapshot
    const itemsMap = new Map<string, any>();
    assignment.setSnapshot.items.forEach((item: any) => {
      itemsMap.set(item.id, item);
      itemsMap.set(item.german.toLowerCase().trim(), item);
    });

    let correctCount = 0;
    const verifiedResponses: HomeworkQuestionResponse[] = responses.map((r: any) => {
      const targetItem = itemsMap.get(r.questionId) || itemsMap.get((r.germanWord || '').toLowerCase().trim());
      const expectedGerman = targetItem ? targetItem.german.trim() : (r.correctAnswer || '').trim();
      const studentAns = (r.studentAnswer || '').trim();

      const isCorrect =
        studentAns.toLowerCase() === expectedGerman.toLowerCase() ||
        (targetItem && targetItem.arabic && studentAns === targetItem.arabic.trim());

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
      responses: verifiedResponses
    };

    await saveSubmission(submission);

    return new Response(
      JSON.stringify({
        success: true,
        submission: {
          id: submission.id,
          studentName: submission.studentName,
          scorePercentage,
          correctAnswersCount: correctCount,
          totalQuestions,
          attemptNumber: submission.attemptNumber
        }
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error submitting homework' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
