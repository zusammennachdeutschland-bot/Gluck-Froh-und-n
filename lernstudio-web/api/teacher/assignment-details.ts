import { getQueryParam, isTeacherAuthenticated, parseRequestBody, sendJson } from '../_auth.js';
import { getAssignment, getSubmissionsForAssignment, saveAssignment } from '../_storage.js';

export default async function handler(req: any, res?: any) {
  if (!isTeacherAuthenticated(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const method = (req?.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const id = getQueryParam(req, 'id');
    if (!id) {
      return sendJson(res, 400, { error: 'Missing assignment ID' });
    }

    const assignment = await getAssignment(id);
    if (!assignment) {
      return sendJson(res, 404, { error: 'Assignment not found' });
    }

    const rawSubmissions = await getSubmissionsForAssignment(id);
    const submissions = rawSubmissions.map((s) => ({
      ...s,
      score: s.score ?? s.correctAnswersCount ?? 0,
      accuracy: s.accuracy ?? s.scorePercentage ?? 0
    }));

    const questionMap = new Map<
      string,
      {
        questionId: string;
        germanWord: string;
        prompt: string;
        correctAnswer: string;
        totalAttempts: number;
        correctCount: number;
        incorrectCount: number;
      }
    >();

    submissions.forEach((sub) => {
      sub.responses?.forEach((r) => {
        const key = r.germanWord || r.questionId;
        const existing = questionMap.get(key) || {
          questionId: r.questionId || key,
          germanWord: r.germanWord,
          prompt: r.germanWord,
          correctAnswer: r.correctAnswer || r.germanWord,
          totalAttempts: 0,
          correctCount: 0,
          incorrectCount: 0
        };
        existing.totalAttempts++;
        if (r.isCorrect) {
          existing.correctCount++;
        } else {
          existing.incorrectCount++;
        }
        questionMap.set(key, existing);
      });
    });

    const questionAccuracy = Array.from(questionMap.values())
      .map((q) => {
        const pct = Math.round((q.correctCount / Math.max(1, q.totalAttempts)) * 100);
        return {
          ...q,
          accuracyPercent: pct,
          accuracyPercentage: pct
        };
      })
      .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

    return sendJson(res, 200, {
      assignment: {
        ...assignment,
        status: assignment.status || (assignment.isActive !== false ? 'active' : 'closed')
      },
      submissions,
      questionAccuracy,
      stats: {
        totalSubmissions: submissions.length,
        uniqueStudentsCount: new Set(submissions.map((s) => s.studentName.trim().toLowerCase())).size,
        averageScorePercentage:
          submissions.length > 0
            ? Math.round(submissions.reduce((acc, curr) => acc + curr.accuracy, 0) / submissions.length)
            : 0,
        hardestQuestions: questionAccuracy
      }
    });
  }

  if (method === 'PATCH') {
    const body = await parseRequestBody(req);
    const id = getQueryParam(req, 'id') || body?.id;
    if (!id) {
      return sendJson(res, 400, { error: 'Missing ID' });
    }

    const assignment = await getAssignment(id);
    if (!assignment) {
      return sendJson(res, 404, { error: 'Assignment not found' });
    }

    if (typeof body?.isActive === 'boolean') {
      assignment.isActive = body.isActive;
      assignment.status = body.isActive ? 'active' : 'closed';
    } else if (body?.status === 'active' || body?.status === 'closed') {
      assignment.status = body.status;
      assignment.isActive = body.status === 'active';
    }

    await saveAssignment(assignment);
    return sendJson(res, 200, { success: true, assignment });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

export const GET = (req: Request) => handler(req);
export const PATCH = (req: Request) => handler(req);
