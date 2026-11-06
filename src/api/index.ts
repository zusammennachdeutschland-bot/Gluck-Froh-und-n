import type { Request, Response } from 'express';

// Unified In-Memory Fallback API for Homework & Teacher Assignments
const localAssignmentsStore: any[] = [];
const localSubmissionsStore: any[] = [];

export default async function unifiedApiHandler(req: Request, res: Response) {
  const url = req.url || '';
  const method = req.method || 'GET';

  try {
    if (url.includes('/api/teacher/assignments')) {
      if (method === 'GET') {
        return res.json({ assignments: localAssignmentsStore });
      }
      if (method === 'POST') {
        const body = req.body || {};
        if (body.id) {
          const idx = localAssignmentsStore.findIndex((a) => a.id === body.id);
          if (idx >= 0) {
            localAssignmentsStore[idx] = { ...localAssignmentsStore[idx], ...body };
          } else {
            localAssignmentsStore.unshift(body);
          }
        }
        return res.json({ success: true, assignment: body });
      }
    }

    if (url.includes('/api/homework/submissions')) {
      if (method === 'GET') {
        return res.json({ submissions: localSubmissionsStore });
      }
      if (method === 'POST') {
        const body = req.body || {};
        if (body.id) {
          localSubmissionsStore.unshift(body);
        }
        return res.json({ success: true, submission: body });
      }
    }

    return res.json({ success: true, message: 'API OK' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'API Handler Error' });
  }
}
