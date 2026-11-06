import { getQueryParam, sendJson } from '../_auth.js';
import { getAssignment } from '../_storage.js';

export default async function handler(req: any, res?: any) {
  const id = getQueryParam(req, 'id');

  if (!id) {
    return sendJson(res, 400, { error: 'Missing homework ID' });
  }

  const assignment = await getAssignment(id);
  if (!assignment) {
    return sendJson(res, 404, { error: 'Hausaufgabe nicht gefunden / Homework not found' });
  }

  if (assignment.deadline && new Date(assignment.deadline).getTime() < Date.now()) {
    return sendJson(res, 410, {
      error: 'Die Abgabefrist für diese Hausaufgabe ist abgelaufen / Deadline has passed',
      isExpired: true,
      assignment: { id: assignment.id, title: assignment.title, deadline: assignment.deadline }
    });
  }

  if (assignment.isActive === false || assignment.status === 'closed') {
    return sendJson(res, 403, {
      error: 'Diese Hausaufgabe wurde von der Lehrkraft geschlossen / Assignment closed by teacher',
      isClosed: true,
      assignment: { id: assignment.id, title: assignment.title }
    });
  }

  return sendJson(res, 200, {
    id: assignment.id,
    title: assignment.title,
    questionCount: assignment.questionCount || assignment.targetQuestionCount || 10,
    setSnapshot: assignment.setSnapshot,
    maxAttempts: assignment.maxAttempts,
    allowReplay: assignment.allowReplay,
    deadline: assignment.deadline
  });
}

export const GET = (req: Request) => handler(req);
