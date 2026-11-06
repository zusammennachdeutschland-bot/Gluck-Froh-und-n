import fs from 'fs';
import path from 'path';

export interface HomeworkQuestionResponse {
  questionId: string;
  germanWord: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface HomeworkSubmission {
  id: string;
  assignmentId: string;
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  timeSpentSeconds: number;
  totalQuestions: number;
  correctAnswersCount: number;
  scorePercentage: number;
  score: number;
  accuracy: number;
  responses: HomeworkQuestionResponse[];
}

export interface HomeworkAssignment {
  id: string;
  title: string;
  setSnapshot: any;
  allowedGameModes: string[];
  questionCount: number;
  targetQuestionCount: number;
  timeLimitMinutes?: number;
  maxAttempts: number;
  allowReplay: boolean;
  deadline?: string;
  isActive: boolean;
  status: 'active' | 'closed';
  createdAt: string;
  createdBy: string;
}

const TMP_STORE_PATH = path.join('/tmp', 'lernstudio_homework_store.json');

interface StoreShape {
  assignments: Record<string, HomeworkAssignment>;
  submissions: Record<string, HomeworkSubmission[]>;
}

const memoryStore: StoreShape = {
  assignments: {},
  submissions: {}
};

function readTmpStore(): StoreShape {
  try {
    if (fs.existsSync(TMP_STORE_PATH)) {
      const raw = fs.readFileSync(TMP_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        assignments: { ...memoryStore.assignments, ...(parsed.assignments || {}) },
        submissions: { ...memoryStore.submissions, ...(parsed.submissions || {}) }
      };
    }
  } catch {
    // Ignore fs errors
  }
  return memoryStore;
}

function writeTmpStore(store: StoreShape): void {
  memoryStore.assignments = store.assignments;
  memoryStore.submissions = store.submissions;
  try {
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(store), 'utf-8');
  } catch {
    // Ignore fs errors
  }
}

async function getVercelBlobModule(): Promise<any | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const pkg = '@vercel/blob';
    return await import(pkg);
  } catch {
    return null;
  }
}

export async function saveAssignment(assignment: HomeworkAssignment): Promise<string> {
  const store = readTmpStore();
  store.assignments[assignment.id] = assignment;
  writeTmpStore(store);

  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const blob = await blobMod.put(`assignments/${assignment.id}.json`, JSON.stringify(assignment), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false
      });
      return blob.url;
    } catch (e) {
      console.warn('Vercel blob put fallback to tmp store:', e);
    }
  }
  return `local://assignments/${assignment.id}.json`;
}

export async function getAssignment(id: string): Promise<HomeworkAssignment | null> {
  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const { blobs } = await blobMod.list({ prefix: `assignments/${id}.json` });
      if (blobs && blobs.length > 0) {
        const res = await fetch(blobs[0].url);
        if (res.ok) {
          return (await res.json()) as HomeworkAssignment;
        }
      }
    } catch (e) {
      console.warn('Error fetching assignment from blob:', e);
    }
  }
  const store = readTmpStore();
  return store.assignments[id] || null;
}

export async function listAllAssignments(): Promise<HomeworkAssignment[]> {
  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const { blobs } = await blobMod.list({ prefix: 'assignments/' });
      const assignments: HomeworkAssignment[] = [];
      for (const blob of blobs || []) {
        if (!blob.pathname.endsWith('.json')) continue;
        const res = await fetch(blob.url);
        if (res.ok) {
          assignments.push((await res.json()) as HomeworkAssignment);
        }
      }
      if (assignments.length > 0) {
        return assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (e) {
      console.warn('Error listing assignments from blob:', e);
    }
  }
  const store = readTmpStore();
  return Object.values(store.assignments).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function saveSubmission(submission: HomeworkSubmission): Promise<string> {
  const store = readTmpStore();
  const current = store.submissions[submission.assignmentId] || [];
  current.push(submission);
  store.submissions[submission.assignmentId] = current;
  writeTmpStore(store);

  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const blob = await blobMod.put(
        `submissions/${submission.assignmentId}/${submission.id}.json`,
        JSON.stringify(submission),
        {
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: false
        }
      );
      return blob.url;
    } catch (e) {
      console.warn('Vercel blob submission put fallback to tmp store:', e);
    }
  }
  return `local://submissions/${submission.assignmentId}/${submission.id}.json`;
}

export async function getSubmissionsForAssignment(assignmentId: string): Promise<HomeworkSubmission[]> {
  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const { blobs } = await blobMod.list({ prefix: `submissions/${assignmentId}/` });
      const subs: HomeworkSubmission[] = [];
      for (const blob of blobs || []) {
        if (!blob.pathname.endsWith('.json')) continue;
        const res = await fetch(blob.url);
        if (res.ok) {
          subs.push((await res.json()) as HomeworkSubmission);
        }
      }
      if (subs.length > 0) {
        return subs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      }
    } catch (e) {
      console.warn('Error fetching submissions from blob:', e);
    }
  }
  const store = readTmpStore();
  return (store.submissions[assignmentId] || []).sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}
