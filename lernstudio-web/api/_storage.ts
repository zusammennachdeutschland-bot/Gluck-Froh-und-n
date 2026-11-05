import { put, list, del } from '@vercel/blob';
import { HomeworkAssignment, HomeworkSubmission } from '../shared/homeworkTypes';

const HAS_BLOB_TOKEN = !!process.env.BLOB_READ_WRITE_TOKEN;

// In-memory fallback cache when testing locally or when BLOB_READ_WRITE_TOKEN is not yet provisioned
const memoryStore = {
  assignments: new Map<string, HomeworkAssignment>(),
  submissions: new Map<string, HomeworkSubmission[]>()
};

export async function saveAssignment(assignment: HomeworkAssignment): Promise<string> {
  const path = `assignments/${assignment.id}.json`;
  const data = JSON.stringify(assignment);

  if (HAS_BLOB_TOKEN) {
    const blob = await put(path, data, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });
    return blob.url;
  } else {
    memoryStore.assignments.set(assignment.id, assignment);
    return `local://${path}`;
  }
}

export async function getAssignment(id: string): Promise<HomeworkAssignment | null> {
  if (HAS_BLOB_TOKEN) {
    try {
      const { blobs } = await list({ prefix: `assignments/${id}.json` });
      if (blobs.length === 0) return null;
      const res = await fetch(blobs[0].url);
      if (!res.ok) return null;
      return (await res.json()) as HomeworkAssignment;
    } catch (e) {
      console.warn('Error fetching assignment from blob:', e);
      return memoryStore.assignments.get(id) || null;
    }
  }
  return memoryStore.assignments.get(id) || null;
}

export async function listAllAssignments(): Promise<HomeworkAssignment[]> {
  if (HAS_BLOB_TOKEN) {
    try {
      const { blobs } = await list({ prefix: 'assignments/' });
      const assignments: HomeworkAssignment[] = [];
      for (const blob of blobs) {
        if (!blob.pathname.endsWith('.json')) continue;
        const res = await fetch(blob.url);
        if (res.ok) {
          assignments.push((await res.json()) as HomeworkAssignment);
        }
      }
      return assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.warn('Error listing assignments from blob:', e);
      return Array.from(memoryStore.assignments.values());
    }
  }
  return Array.from(memoryStore.assignments.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function saveSubmission(submission: HomeworkSubmission): Promise<string> {
  const path = `submissions/${submission.assignmentId}/${submission.id}.json`;
  const data = JSON.stringify(submission);

  if (HAS_BLOB_TOKEN) {
    const blob = await put(path, data, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });
    return blob.url;
  } else {
    const current = memoryStore.submissions.get(submission.assignmentId) || [];
    current.push(submission);
    memoryStore.submissions.set(submission.assignmentId, current);
    return `local://${path}`;
  }
}

export async function getSubmissionsForAssignment(assignmentId: string): Promise<HomeworkSubmission[]> {
  if (HAS_BLOB_TOKEN) {
    try {
      const { blobs } = await list({ prefix: `submissions/${assignmentId}/` });
      const subs: HomeworkSubmission[] = [];
      for (const blob of blobs) {
        if (!blob.pathname.endsWith('.json')) continue;
        const res = await fetch(blob.url);
        if (res.ok) {
          subs.push((await res.json()) as HomeworkSubmission);
        }
      }
      return subs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    } catch (e) {
      console.warn('Error fetching submissions from blob:', e);
      return memoryStore.submissions.get(assignmentId) || [];
    }
  }
  return (memoryStore.submissions.get(assignmentId) || []).sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}
