import { getAssignment } from '../_storage';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || url.pathname.split('/').pop();

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing homework ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const assignment = await getAssignment(id);
  if (!assignment) {
    return new Response(JSON.stringify({ error: 'Hausaufgabe nicht gefunden / Homework not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check deadline
  if (assignment.deadline && new Date(assignment.deadline).getTime() < Date.now()) {
    return new Response(
      JSON.stringify({
        error: 'Die Abgabefrist für diese Hausaufgabe ist abgelaufen / Deadline has passed',
        isExpired: true,
        assignment: { id: assignment.id, title: assignment.title, deadline: assignment.deadline }
      }),
      {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Check active status
  if (!assignment.isActive) {
    return new Response(
      JSON.stringify({
        error: 'Diese Hausaufgabe wurde von der Lehrkraft geschlossen / Assignment closed by teacher',
        isClosed: true,
        assignment: { id: assignment.id, title: assignment.title }
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Return public assignment data without sensitive teacher tokens
  return new Response(
    JSON.stringify({
      id: assignment.id,
      title: assignment.title,
      questionCount: assignment.questionCount,
      setSnapshot: assignment.setSnapshot,
      maxAttempts: assignment.maxAttempts,
      allowReplay: assignment.allowReplay,
      deadline: assignment.deadline
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
