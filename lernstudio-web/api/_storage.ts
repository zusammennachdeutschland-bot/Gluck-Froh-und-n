import fs from 'fs';
import path from 'path';

export type HomeworkQuestionType =
  | 'mc_de_ar'
  | 'true_false'
  | 'listen_choose'
  | 'mc_ar_de'
  | 'article_quiz'
  | 'missing_letter';

export type HomeworkFlowMode = 'teacher_then_quiz' | 'quiz_only';
export type HomeworkBlooketMode = 'gold_quest' | 'tower_energy' | 'classic_quiz';

export interface HomeworkQuestionResponse {
  questionId: string;
  questionType?: HomeworkQuestionType;
  germanWord: string;
  promptText?: string;
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
  goldEarned?: number;
  maxStreak?: number;
  completedStudyPhase?: boolean;
  responses: HomeworkQuestionResponse[];
}

export interface HomeworkAssignment {
  id: string;
  title: string;
  setSnapshot: any;
  selectedItemIds?: string[];
  flowMode?: HomeworkFlowMode;
  questionTypes?: HomeworkQuestionType[];
  blooketMode?: HomeworkBlooketMode;
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

export function readTmpStore(): StoreShape {
  try {
    if (fs.existsSync(TMP_STORE_PATH)) {
      const raw = fs.readFileSync(TMP_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const mergedAssignments = { ...memoryStore.assignments, ...(parsed.assignments || {}) };
      const mergedSubmissions: Record<string, HomeworkSubmission[]> = { ...memoryStore.submissions };
      for (const [hwId, subs] of Object.entries(parsed.submissions || {})) {
        const existing = mergedSubmissions[hwId] || [];
        const byId = new Map<string, HomeworkSubmission>();
        for (const s of [...existing, ...(Array.isArray(subs) ? subs : [])]) {
          if (s && s.id) byId.set(s.id, s);
        }
        mergedSubmissions[hwId] = Array.from(byId.values());
      }
      memoryStore.assignments = mergedAssignments;
      memoryStore.submissions = mergedSubmissions;
      return { assignments: mergedAssignments, submissions: mergedSubmissions };
    }
  } catch {
    // Ignore fs errors
  }
  return memoryStore;
}

export function writeTmpStore(store: StoreShape): void {
  memoryStore.assignments = store.assignments;
  memoryStore.submissions = store.submissions;
  try {
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(store), 'utf-8');
  } catch {
    // Ignore fs errors
  }
}

export function mergeExternalStoreData(
  incomingAssignments?: HomeworkAssignment[],
  incomingSubmissions?: HomeworkSubmission[]
): StoreShape {
  const store = readTmpStore();
  let changed = false;

  if (Array.isArray(incomingAssignments)) {
    for (const hw of incomingAssignments) {
      if (hw && hw.id && !store.assignments[hw.id]) {
        store.assignments[hw.id] = hw;
        changed = true;
      }
    }
  }

  if (Array.isArray(incomingSubmissions)) {
    for (const sub of incomingSubmissions) {
      if (sub && sub.id && sub.assignmentId) {
        const list = store.submissions[sub.assignmentId] || [];
        if (!list.some((x) => x.id === sub.id)) {
          list.push(sub);
          store.submissions[sub.assignmentId] = list;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    writeTmpStore(store);
  }
  return store;
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
  const store = readTmpStore();
  if (store.assignments[id]) {
    return store.assignments[id];
  }

  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const { blobs } = await blobMod.list({ prefix: `assignments/${id}.json` });
      if (blobs && blobs.length > 0) {
        const res = await fetch(blobs[0].url);
        if (res.ok) {
          const hw = (await res.json()) as HomeworkAssignment;
          store.assignments[id] = hw;
          writeTmpStore(store);
          return hw;
        }
      }
    } catch (e) {
      console.warn('Error fetching assignment from blob:', e);
    }
  }
  return store.assignments[id] || null;
}

export async function listAllAssignments(): Promise<HomeworkAssignment[]> {
  const store = readTmpStore();
  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const { blobs } = await blobMod.list({ prefix: 'assignments/' });
      for (const blob of blobs || []) {
        if (!blob.pathname.endsWith('.json')) continue;
        const res = await fetch(blob.url);
        if (res.ok) {
          const hw = (await res.json()) as HomeworkAssignment;
          if (hw && hw.id) {
            store.assignments[hw.id] = hw;
          }
        }
      }
      writeTmpStore(store);
    } catch (e) {
      console.warn('Error listing assignments from blob:', e);
    }
  }
  return Object.values(store.assignments).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function saveSubmission(submission: HomeworkSubmission): Promise<string> {
  const store = readTmpStore();
  const current = store.submissions[submission.assignmentId] || [];
  if (!current.some((s) => s.id === submission.id)) {
    current.push(submission);
  }
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
  const store = readTmpStore();
  const blobMod = await getVercelBlobModule();
  if (blobMod) {
    try {
      const { blobs } = await blobMod.list({ prefix: `submissions/${assignmentId}/` });
      const current = store.submissions[assignmentId] || [];
      const byId = new Map<string, HomeworkSubmission>(current.map((s) => [s.id, s]));
      for (const blob of blobs || []) {
        if (!blob.pathname.endsWith('.json')) continue;
        const res = await fetch(blob.url);
        if (res.ok) {
          const sub = (await res.json()) as HomeworkSubmission;
          if (sub && sub.id) {
            byId.set(sub.id, sub);
          }
        }
      }
      store.submissions[assignmentId] = Array.from(byId.values());
      writeTmpStore(store);
    } catch (e) {
      console.warn('Error fetching submissions from blob:', e);
    }
  }
  return (store.submissions[assignmentId] || []).sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}
