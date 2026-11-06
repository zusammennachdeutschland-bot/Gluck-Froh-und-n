import { isTeacherAuthenticated, parseRequestBody, sendJson } from '../_auth.js';
import {
  listAllAssignments,
  saveAssignment,
  getSubmissionsForAssignment,
  HomeworkAssignment
} from '../_storage.js';

export default async function handler(req: any, res?: any) {
  const method = (req?.method || 'GET').toUpperCase();

  if (method === 'GET') {
    if (!isTeacherAuthenticated(req)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    try {
      const assignments = await listAllAssignments();

      const enriched = await Promise.all(
        assignments.map(async (hw) => {
          const subs = await getSubmissionsForAssignment(hw.id);
          const uniqueStudents = new Set(subs.map((s) => s.studentName.trim().toLowerCase())).size;
          const avgScore =
            subs.length > 0
              ? Math.round(subs.reduce((acc, curr) => acc + (curr.scorePercentage ?? curr.accuracy ?? 0), 0) / subs.length)
              : 0;

          return {
            ...hw,
            status: hw.status || (hw.isActive !== false ? 'active' : 'closed'),
            questionCount: hw.questionCount || hw.targetQuestionCount || 10,
            targetQuestionCount: hw.targetQuestionCount || hw.questionCount || 10,
            submissionCount: subs.length,
            uniqueStudentsCount: uniqueStudents,
            averageScorePercentage: avgScore,
            avgAccuracy: avgScore,
            avgScore
          };
        })
      );

      return sendJson(res, 200, { assignments: enriched });
    } catch (err: any) {
      return sendJson(res, 500, { error: err?.message || 'Error listing assignments' });
    }
  }

  if (method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const {
        title,
        setSnapshot,
        allowedGameModes,
        questionCount,
        targetQuestionCount,
        maxAttempts,
        allowReplay,
        deadline
      } = body || {};

      if (!title || !setSnapshot || !setSnapshot.items || setSnapshot.items.length === 0) {
        return sendJson(res, 400, { error: 'Invalid assignment or empty set' });
      }

      const shortId = 'hw_' + Math.random().toString(36).substring(2, 8);
      const qCount = Number(questionCount || targetQuestionCount) || Math.min(10, setSnapshot.items.length);

      const assignment: HomeworkAssignment = {
        id: shortId,
        title: title.trim(),
        setSnapshot,
        allowedGameModes: allowedGameModes && allowedGameModes.length > 0 ? allowedGameModes : ['solo_practice'],
        questionCount: qCount,
        targetQuestionCount: qCount,
        maxAttempts: Number(maxAttempts) || 0,
        allowReplay: allowReplay ?? true,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        isActive: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'Teacher'
      };

      await saveAssignment(assignment);

      return sendJson(res, 201, { success: true, assignment });
    } catch (err: any) {
      return sendJson(res, 500, { error: err?.message || 'Error creating assignment' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

export const GET = (req: Request) => handler(req);
export const POST = (req: Request) => handler(req);
