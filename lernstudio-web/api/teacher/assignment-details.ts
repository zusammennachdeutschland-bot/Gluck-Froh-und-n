import { isTeacherAuthenticated } from '../_auth';
import { getAssignment, getSubmissionsForAssignment, saveAssignment } from '../_storage';

export async function GET(req: Request) {
  if (!isTeacherAuthenticated(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id') || url.pathname.split('/').pop();

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing assignment ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const assignment = await getAssignment(id);
  if (!assignment) {
    return new Response(JSON.stringify({ error: 'Assignment not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const submissions = await getSubmissionsForAssignment(id);

  // Question-level statistics analysis
  const questionMap = new Map<
    string,
    { germanWord: string; totalAttempts: number; incorrectCount: number }
  >();

  submissions.forEach((sub) => {
    sub.responses?.forEach((r) => {
      const existing = questionMap.get(r.germanWord) || {
        germanWord: r.germanWord,
        totalAttempts: 0,
        incorrectCount: 0
      };
      existing.totalAttempts++;
      if (!r.isCorrect) existing.incorrectCount++;
      questionMap.set(r.germanWord, existing);
    });
  });

  const hardestQuestions = Array.from(questionMap.values())
    .map((q) => ({
      ...q,
      accuracyPercentage: Math.round(((q.totalAttempts - q.incorrectCount) / q.totalAttempts) * 100)
    }))
    .sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);

  return new Response(
    JSON.stringify({
      assignment,
      submissions,
      stats: {
        totalSubmissions: submissions.length,
        uniqueStudentsCount: new Set(submissions.map((s) => s.studentName.trim().toLowerCase())).size,
        averageScorePercentage:
          submissions.length > 0
            ? Math.round(submissions.reduce((acc, curr) => acc + curr.scorePercentage, 0) / submissions.length)
            : 0,
        hardestQuestions
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export async function PATCH(req: Request) {
  if (!isTeacherAuthenticated(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id') || url.pathname.split('/').pop();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const assignment = await getAssignment(id);
  if (!assignment) {
    return new Response(JSON.stringify({ error: 'Assignment not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json();
  if (typeof body.isActive === 'boolean') {
    assignment.isActive = body.isActive;
  }

  await saveAssignment(assignment);

  return new Response(JSON.stringify({ success: true, assignment }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
