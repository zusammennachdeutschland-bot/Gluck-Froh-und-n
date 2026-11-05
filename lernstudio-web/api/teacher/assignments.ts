import { isTeacherAuthenticated } from '../_auth';
import { listAllAssignments, saveAssignment, getSubmissionsForAssignment } from '../_storage';
import { HomeworkAssignment } from '../../shared/homeworkTypes';

export async function GET(req: Request) {
  if (!isTeacherAuthenticated(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const assignments = await listAllAssignments();

    // Attach participation counts to each assignment
    const enriched = await Promise.all(
      assignments.map(async (hw) => {
        const subs = await getSubmissionsForAssignment(hw.id);
        const uniqueStudents = new Set(subs.map((s) => s.studentName.trim().toLowerCase())).size;
        const avgScore =
          subs.length > 0
            ? Math.round(subs.reduce((acc, curr) => acc + curr.scorePercentage, 0) / subs.length)
            : 0;

        return {
          ...hw,
          submissionCount: subs.length,
          uniqueStudentsCount: uniqueStudents,
          averageScorePercentage: avgScore
        };
      })
    );

    return new Response(JSON.stringify({ assignments: enriched }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error listing assignments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(req: Request) {
  if (!isTeacherAuthenticated(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { title, setSnapshot, allowedGameModes, questionCount, maxAttempts, allowReplay, deadline } = body;

    if (!title || !setSnapshot || !setSnapshot.items || setSnapshot.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid assignment or empty set' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate random short ID for clean URLs (e.g. "hw_9k3x7p")
    const shortId = 'hw_' + Math.random().toString(36).substring(2, 8);

    const assignment: HomeworkAssignment = {
      id: shortId,
      title: title.trim(),
      setSnapshot,
      allowedGameModes: allowedGameModes && allowedGameModes.length > 0 ? allowedGameModes : ['solo_practice'],
      questionCount: Number(questionCount) || Math.min(10, setSnapshot.items.length),
      maxAttempts: Number(maxAttempts) || 0,
      allowReplay: allowReplay ?? true,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'Teacher'
    };

    await saveAssignment(assignment);

    return new Response(JSON.stringify({ success: true, assignment }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error creating assignment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
