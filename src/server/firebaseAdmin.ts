/**
 * Server-only Firebase Admin SDK module for Glueck.
 * Provides authoritative, durable persistence for assignments, short links,
 * published custom learning sets, and student submissions on Vercel Serverless and Node.js environments.
 *
 * NEVER import this file from frontend client code.
 */

import { initializeApp, getApps, getApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { FIREBASE_CONFIG } from '../shared/firebaseConfig.js';
import { DEFAULT_LERNSTUDIO_SETS } from '../data/defaultLernstudioSets.js';
import crypto from 'crypto';

const BUILTIN_CURRICULUM_SET_MAP = new Map<string, any>(
  DEFAULT_LERNSTUDIO_SETS.map((s) => [s.id, s])
);

export function isBuiltinCurriculumSetId(setId: string): boolean {
  const clean = String(setId || '').trim();
  if (!clean) return false;
  return (
    clean.startsWith('curric_') ||
    clean.startsWith('set_def_') ||
    BUILTIN_CURRICULUM_SET_MAP.has(clean)
  );
}

// ============================================================================
// IN-MEMORY FIRESTORE TEST DOUBLE (Explicit test environments only)
// ============================================================================
type QueryFilter = { field: string; op: string; value: any };
type QueryOrder = { field: string; dir: 'asc' | 'desc' };

export class InMemoryAdminFirestore {
  private assignments = new Map<string, any>();
  private submissions = new Map<string, any>();
  private shortLinks = new Map<string, any>();
  private lernstudioSets = new Map<string, any>();
  private docReadCounts = new Map<string, number>();
  private collectionReadCounts = new Map<string, number>();
  private shouldFailWrites = false;
  private failureErrorMessage = 'Simulated Firestore persistence failure';

  public clear(): void {
    this.assignments.clear();
    this.submissions.clear();
    this.shortLinks.clear();
    this.lernstudioSets.clear();
    this.docReadCounts.clear();
    this.collectionReadCounts.clear();
    this.shouldFailWrites = false;
    invalidateServerAssignmentCache();
  }

  public getReadCount(collectionName: string, docId?: string): number {
    if (docId !== undefined) {
      return this.docReadCounts.get(`${collectionName}/${docId}`) || 0;
    }
    return this.collectionReadCounts.get(collectionName) || 0;
  }

  public resetReadCounts(): void {
    this.docReadCounts.clear();
    this.collectionReadCounts.clear();
  }

  public setSimulateFailure(fail: boolean, message?: string): void {
    this.shouldFailWrites = fail;
    if (message) this.failureErrorMessage = message;
  }

  public getAssignmentsMap(): Map<string, any> {
    return this.assignments;
  }

  public getSubmissionsMap(): Map<string, any> {
    return this.submissions;
  }

  public getShortLinksMap(): Map<string, any> {
    return this.shortLinks;
  }

  public getSetsMap(): Map<string, any> {
    return this.lernstudioSets;
  }

  private resolveStore(name: string): Map<string, any> {
    if (name === 'homework_assignments') return this.assignments;
    if (name === 'homework_short_links') return this.shortLinks;
    if (name === 'lernstudio_sets') return this.lernstudioSets;
    return this.submissions;
  }

  private createQueryChain(
    store: Map<string, any>,
    filters: QueryFilter[] = [],
    orders: QueryOrder[] = [],
    cursorVal: any = undefined,
    limitCount?: number
  ) {
    const chain = {
      where: (field: string, op: string, value: any) =>
        this.createQueryChain(
          store,
          [...filters, { field, op, value }],
          orders,
          cursorVal,
          limitCount
        ),
      orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') =>
        this.createQueryChain(
          store,
          filters,
          [...orders, { field, dir }],
          cursorVal,
          limitCount
        ),
      startAfter: (cursor: any) =>
        this.createQueryChain(store, filters, orders, cursor, limitCount),
      limit: (n: number) =>
        this.createQueryChain(store, filters, orders, cursorVal, n),
      get: async () => {
        let rows: { id: string; raw: any }[] = [];
        for (const [id, data] of store.entries()) {
          let matches = true;
          for (const f of filters) {
            if (f.op === '==' && data[f.field] !== f.value) {
              matches = false;
              break;
            }
            if (f.op === '!=' && data[f.field] === f.value) {
              matches = false;
              break;
            }
          }
          if (matches) {
            rows.push({ id, raw: data });
          }
        }

        if (orders.length > 0) {
          rows.sort((a, b) => {
            for (const o of orders) {
              const av = a.raw[o.field] ?? '';
              const bv = b.raw[o.field] ?? '';
              if (av < bv) return o.dir === 'desc' ? 1 : -1;
              if (av > bv) return o.dir === 'desc' ? -1 : 1;
            }
            return a.id.localeCompare(b.id);
          });
        }

        if (cursorVal !== undefined && cursorVal !== null) {
          const cursorId =
            typeof cursorVal === 'object' && typeof cursorVal.id === 'string'
              ? cursorVal.id
              : null;
          if (cursorId) {
            const idx = rows.findIndex((r) => r.id === cursorId);
            if (idx >= 0) {
              rows = rows.slice(idx + 1);
            }
          } else if (orders.length > 0) {
            const primary = orders[0];
            rows = rows.filter((r) => {
              const val = r.raw[primary.field] ?? '';
              return primary.dir === 'desc' ? val < cursorVal : val > cursorVal;
            });
          }
        }

        if (typeof limitCount === 'number' && limitCount >= 0) {
          rows = rows.slice(0, limitCount);
        }

        const docs = rows.map((r) => ({
          exists: true,
          id: r.id,
          ref: { id: r.id },
          data: () => JSON.parse(JSON.stringify(r.raw))
        }));
        return { docs, empty: docs.length === 0, size: docs.length };
      }
    };
    return chain;
  }

  collection(name: string) {
    const store = this.resolveStore(name);
    const parent = this;
    const baseChain = this.createQueryChain(store);

    return {
      doc: (id: string) => ({
        id,
        get: async () => {
          parent.collectionReadCounts.set(name, (parent.collectionReadCounts.get(name) || 0) + 1);
          parent.docReadCounts.set(`${name}/${id}`, (parent.docReadCounts.get(`${name}/${id}`) || 0) + 1);
          const data = store.get(id);
          return {
            exists: !!data,
            id,
            data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
          };
        },
        set: async (data: any, options?: { merge?: boolean }) => {
          if (parent.shouldFailWrites) {
            throw new Error(parent.failureErrorMessage);
          }
          const existing = store.get(id) || {};
          const merged = options?.merge ? { ...existing, ...data } : { ...data };
          store.set(id, JSON.parse(JSON.stringify(merged)));
          if (name === 'homework_assignments') {
            invalidateServerAssignmentCache(id);
          } else if (
            name === 'homework_short_links' &&
            merged &&
            (merged.deleted === true || merged.isActive === false) &&
            merged.assignmentId
          ) {
            invalidateServerAssignmentCache(String(merged.assignmentId));
          }
        },
        delete: async () => {
          if (parent.shouldFailWrites) {
            throw new Error(parent.failureErrorMessage);
          }
          store.delete(id);
          if (name === 'homework_assignments') {
            invalidateServerAssignmentCache(id);
          }
        }
      }),
      where: baseChain.where,
      orderBy: baseChain.orderBy,
      limit: baseChain.limit,
      get: baseChain.get
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    if (this.shouldFailWrites) {
      throw new Error(this.failureErrorMessage);
    }
    const transaction = {
      get: async (target: any) => target.get(),
      set: (docRef: any, data: any, options?: any) => docRef.set(data, options),
      delete: (docRef: any) => docRef.delete()
    };
    return await updateFunction(transaction);
  }
}

let customAdminDbOverride: any = null;
let defaultInMemoryDb: InMemoryAdminFirestore | null = null;

// Short-lived in-memory caches on Vercel warm instances to minimize repeated Admin SDK reads
const SET_CACHE_TTL_MS = 5 * 60 * 1000;
const serverPublishedSetCache = new Map<
  string,
  { set: any; updatedAtIso: string; hash: string; cachedAtMs: number }
>();

/**
 * Process-local server assignment lookup cache (45s TTL, within the 30–60s window).
 * Reduces repeated Firestore `homework_assignments/{id}` reads across student Started events,
 * progress checkpoints, exit beacons, and final submissions on the same warm Vercel instance.
 *
 * Multi-instance Vercel limitation:
 * This Map is strictly process-local per serverless instance. An edit, deactivation, or deletion
 * performed on another instance (or directly from Android to Firestore) will not immediately
 * evict entries in other warm instances until the 45s TTL expires.
 */
export const SERVER_ASSIGNMENT_CACHE_TTL_MS = 45 * 1000;
const serverAssignmentLookupCache = new Map<
  string,
  { assignment: any; cachedAtMs: number }
>();

function isCacheableServerAssignment(assignment: any): boolean {
  if (!assignment || typeof assignment !== 'object' || !assignment.id) return false;
  if (assignment.deleted === true || assignment.revoked === true) return false;
  if (assignment.isActive === false) return false;
  if (assignment.status === 'closed' || assignment.status === 'deleted') return false;
  const nowMs = Date.now();
  const reopenedAt = typeof assignment.manualReopenedAt === 'number' ? assignment.manualReopenedAt : 0;

  if (typeof assignment.dueDate === 'string' && assignment.dueDate.trim()) {
    const rawDue = assignment.dueDate.trim();
    const ymdMatch = rawDue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let dueEndMs = NaN;
    if (ymdMatch) {
      const y = Number(ymdMatch[1]);
      const m = Number(ymdMatch[2]);
      const d = Number(ymdMatch[3]);
      const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
      if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
        dueEndMs = dt.getTime();
      }
    } else {
      dueEndMs = Date.parse(rawDue);
    }
    if (Number.isFinite(dueEndMs)) {
      const autoCloseAtMs = dueEndMs + 14 * 24 * 60 * 60 * 1000;
      if (nowMs >= autoCloseAtMs && reopenedAt < autoCloseAtMs) {
        return false;
      }
    }
  }

  if (typeof assignment.deadline === 'string' && assignment.deadline.trim()) {
    const deadlineMs = Date.parse(assignment.deadline.trim());
    if (Number.isFinite(deadlineMs) && nowMs > deadlineMs && reopenedAt < deadlineMs) {
      return false;
    }
  }
  return true;
}

export function invalidateServerAssignmentCache(assignmentId?: string): void {
  if (!assignmentId) {
    serverAssignmentLookupCache.clear();
    return;
  }
  const cleanId = String(assignmentId || '').trim();
  if (cleanId) {
    serverAssignmentLookupCache.delete(cleanId);
  }
}

export function getServerAssignmentCacheEntryForTesting(
  assignmentId: string
): { assignment: any; cachedAtMs: number } | null {
  const cleanId = String(assignmentId || '').trim();
  const entry = serverAssignmentLookupCache.get(cleanId);
  if (!entry) return null;
  return {
    assignment: JSON.parse(JSON.stringify(entry.assignment)),
    cachedAtMs: entry.cachedAtMs
  };
}

export function isNonTestDeploymentOrVercel(): boolean {
  if (process.env.VERCEL === '1') return true;
  if (process.env.VERCEL_ENV !== undefined && process.env.VERCEL_ENV !== '') return true;
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'staging' || nodeEnv === 'preview') return true;
  return false;
}

export function isExplicitTestEnvironment(): boolean {
  if ((globalThis as any).__TEST_ENV__ === false) {
    return false;
  }
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.JEST_WORKER_ID !== undefined ||
    process.env.IS_TEST_SUITE === '1' ||
    Boolean((globalThis as any).__TEST_ENV__) ||
    (Array.isArray(process.argv) && process.argv.some((arg) => arg.includes('.test.') || arg.includes('/tests/')))
  );
}

export function setAdminFirestoreOverrideForTesting(db: any): void {
  if (isNonTestDeploymentOrVercel()) {
    throw new Error('Forbidden: Cannot set test database override in production, staging, preview, or Vercel environments.');
  }
  if (!isExplicitTestEnvironment()) {
    throw new Error('Forbidden: Test database override can only be set in an explicit test environment.');
  }
  customAdminDbOverride = db;
  serverPublishedSetCache.clear();
  serverAssignmentLookupCache.clear();
}

export function resetAdminFirestoreForTesting(): void {
  customAdminDbOverride = null;
  serverPublishedSetCache.clear();
  serverAssignmentLookupCache.clear();
  if (defaultInMemoryDb) {
    defaultInMemoryDb.clear();
  }
}

export function getInMemoryAdminFirestore(): InMemoryAdminFirestore {
  if (isNonTestDeploymentOrVercel()) {
    throw new Error('Forbidden: Cannot instantiate InMemoryAdminFirestore in production, staging, preview, or Vercel deployments.');
  }
  if (!isExplicitTestEnvironment()) {
    throw new Error('Forbidden: InMemoryAdminFirestore can only be instantiated in an explicit test environment.');
  }

  if (!defaultInMemoryDb) {
    defaultInMemoryDb = new InMemoryAdminFirestore();
  }
  return defaultInMemoryDb;
}

export function hasFirebaseAdminCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return true;
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return true;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return true;
  }
  return false;
}

let cachedAdminApp: App | null = null;
let cachedAdminFirestore: Firestore | null = null;

function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || FIREBASE_CONFIG.projectId;

  const saKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (saKeyJson) {
    try {
      const parsed = JSON.parse(saKeyJson);
      return initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || projectId
      });
    } catch (err: any) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${err?.message || err}`);
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      }),
      projectId
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT) {
    return initializeApp({
      credential: applicationDefault(),
      projectId
    });
  }

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  throw new Error(
    'Firebase Admin credentials missing: Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel environment variables.'
  );
}

export function getAuthoritativeFirestore(): any {
  const isDeployment = isNonTestDeploymentOrVercel();

  if (isDeployment) {
    customAdminDbOverride = null;

    const hasCreds = hasFirebaseAdminCredentials();
    if (!hasCreds) {
      throw new Error(
        'Firebase Admin credentials missing: Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel environment variables.'
      );
    }

    if (cachedAdminFirestore) {
      return cachedAdminFirestore;
    }
    if (!cachedAdminApp) {
      cachedAdminApp = initializeAdminApp();
    }
    const dbId = process.env.FIREBASE_DATABASE_ID || FIREBASE_CONFIG.firestoreDatabaseId;
    const db = getFirestore(cachedAdminApp, dbId);
    db.settings({ ignoreUndefinedProperties: true });
    cachedAdminFirestore = db;
    return cachedAdminFirestore;
  }

  if (customAdminDbOverride) {
    if (!isExplicitTestEnvironment()) {
      customAdminDbOverride = null;
      throw new Error('Forbidden: Test override is only permitted in an explicit test environment.');
    }
    return customAdminDbOverride;
  }

  const hasCreds = hasFirebaseAdminCredentials();
  if (!hasCreds) {
    const isTest = isExplicitTestEnvironment();
    if (!isTest) {
      throw new Error(
        'Firebase Admin credentials missing: Firebase Admin SDK requires credentials in production and non-test environments. ' +
        'Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in environment variables.'
      );
    }
    return getInMemoryAdminFirestore();
  }

  if (cachedAdminFirestore) {
    return cachedAdminFirestore;
  }

  if (!cachedAdminApp) {
    cachedAdminApp = initializeAdminApp();
  }

  const dbId = process.env.FIREBASE_DATABASE_ID || FIREBASE_CONFIG.firestoreDatabaseId;
  const db = getFirestore(cachedAdminApp, dbId);
  db.settings({ ignoreUndefinedProperties: true });
  cachedAdminFirestore = db;
  return cachedAdminFirestore;
}

export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanForFirestore(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result as T;
}

function stableCanonicalStringify(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableCanonicalStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableCanonicalStringify(value[k])}`).join(',')}}`;
}

function decodeAssignmentDocument(raw: any): any {
  if (!raw || typeof raw !== 'object') return null;
  let payload: any = {};
  if (typeof raw.payloadJson === 'string') {
    try { payload = JSON.parse(raw.payloadJson); } catch { payload = {}; }
  }
  const decoded = { ...payload, ...raw };
  decoded.id = String(raw.id || payload.id || '');
  decoded.ownerUid = String(raw.ownerUid || payload.ownerUid || '').trim();
  decoded.isActive = typeof raw.isActive === 'boolean' ? raw.isActive : payload.isActive !== false;
  decoded.deleted = raw.deleted === true || payload.deleted === true;
  if (decoded.deleted) {
    decoded.isActive = false;
    decoded.status = 'deleted';
  }
  delete decoded.payloadJson;
  return decoded;
}

function encodeAssignmentDocument(assignment: any): Record<string, any> {
  return cleanForFirestore({
    id: assignment.id,
    ownerUid: assignment.ownerUid,
    title: String(assignment.title || 'Hausaufgabe').slice(0, 290),
    createdAt: String(assignment.createdAt || new Date().toISOString()).slice(0, 60),
    isActive: assignment.isActive !== false && assignment.deleted !== true,
    ...(assignment.deleted === true ? { deleted: true, deletedAt: assignment.deletedAt || new Date().toISOString() } : {}),
    payloadJson: JSON.stringify(assignment)
  });
}

function decodeSubmissionDocument(raw: any): any {
  if (!raw || typeof raw !== 'object') return null;
  let payload: any = {};
  if (typeof raw.payloadJson === 'string') {
    try { payload = JSON.parse(raw.payloadJson); } catch { payload = {}; }
  }
  const decoded = { ...payload, ...raw };
  decoded.id = String(raw.id || payload.id || '');
  decoded.assignmentId = String(raw.assignmentId || payload.assignmentId || '');
  decoded.ownerUid = String(raw.ownerUid || payload.ownerUid || '').trim();
  delete decoded.payloadJson;
  return decoded;
}

function encodeSubmissionDocument(submission: any): Record<string, any> {
  return cleanForFirestore({
    id: submission.id,
    assignmentId: submission.assignmentId,
    ownerUid: submission.ownerUid,
    studentName: String(submission.studentName || 'طالب').slice(0, 140),
    score: Math.max(0, Math.min(100000, Number(submission.score ?? submission.correctAnswersCount) || 0)),
    accuracyPercent: Math.max(0, Math.min(100, Number(submission.accuracyPercent ?? submission.scorePercentage ?? submission.accuracy) || 0)),
    completedAt: String(submission.completedAt || ''),
    status: String(submission.status || 'in_progress'),
    ...(submission.attemptSecret ? { attemptSecret: String(submission.attemptSecret).slice(0, 120) } : {}),
    payloadJson: JSON.stringify(submission)
  });
}

function encodeShortLinkDocument(assignment: any, verifiedOwnerUid: string): Record<string, any> {
  const shortId = String(assignment.shortId || '').trim();
  const isActive = assignment.isActive !== false && assignment.deleted !== true && assignment.status !== 'closed';
  const nowIso = new Date().toISOString();
  const publicSafeCopy = cleanForFirestore({
    ...assignment,
    ownerUid: verifiedOwnerUid,
    isActive
  });
  delete publicSafeCopy.ownerEmail;
  // The shareToken must NEVER be stored in the public short-link document
  // (homework_short_links/{shortId} is readable without auth): anyone with the
  // link could read it. It lives only on the owner-only homework_assignments
  // document, and the server enforces it from there.
  delete publicSafeCopy.shareToken;
  if (publicSafeCopy.setSnapshot && typeof publicSafeCopy.setSnapshot === 'object') {
    const cleanSet = { ...publicSafeCopy.setSnapshot };
    delete cleanSet.ownerEmail;
    publicSafeCopy.setSnapshot = cleanSet;
  }
  return cleanForFirestore({
    shortId,
    assignmentId: String(assignment.id).trim(),
    ownerUid: verifiedOwnerUid,
    isActive,
    ...(assignment.deleted === true ? { deleted: true } : {}),
    createdAt: String(assignment.createdAt || nowIso).slice(0, 60),
    updatedAt: nowIso.slice(0, 60),
    payloadJson: isActive
      ? JSON.stringify(publicSafeCopy)
      : JSON.stringify({ revoked: true, deleted: Boolean(assignment.deleted) })
  });
}

function sanitizeSetForStorage(rawSet: any, verifiedUid: string): any {
  const cleanId = String(rawSet.id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const copy = cleanForFirestore({
    ...rawSet,
    id: cleanId,
    title: String(rawSet.title || 'Set').trim().slice(0, 290),
    published: rawSet.published !== false,
    createdByUid: String(rawSet.createdByUid || verifiedUid).trim().slice(0, 128)
  });
  delete copy.ownerEmail;
  delete copy.ownerUid;
  delete copy.cloudSynced;
  return copy;
}

function computePublishedSetHash(setObj: any): string {
  const normalized = { ...setObj };
  delete normalized.updatedAtIso;
  delete normalized.cloudSynced;
  delete normalized.ownerEmail;
  return stableCanonicalStringify(normalized);
}

// ============================================================================
// PUBLISHED CUSTOM LEARNING SETS (Shared Across Authenticated Teachers + Vercel)
// Built-in sets are bundled natively and never stored in or read from Firestore.
// ============================================================================

export async function getAuthoritativePublishedSet(
  setId: string,
  options?: { includeUnpublished?: boolean }
): Promise<any | null> {
  const cleanId = String(setId || '').trim();
  if (!cleanId) return null;

  // 1. Built-in curriculum sets are served from bundle with 0 Firestore reads
  const builtin = BUILTIN_CURRICULUM_SET_MAP.get(cleanId);
  if (builtin) {
    return JSON.parse(JSON.stringify(builtin));
  }

  // 2. Warm server cache check
  const cached = serverPublishedSetCache.get(cleanId);
  if (cached && Date.now() - cached.cachedAtMs < SET_CACHE_TTL_MS) {
    if (cached.set?.published === false && !options?.includeUnpublished) {
      return null;
    }
    return JSON.parse(JSON.stringify(cached.set));
  }

  const db = getAuthoritativeFirestore();
  const snap = await db.collection('lernstudio_sets').doc(cleanId).get();
  if (!snap.exists) return null;

  const raw = snap.data() || {};
  if (raw.deleted === true) return null;
  if (raw.published === false && !options?.includeUnpublished) return null;

  let parsed: any = {};
  if (typeof raw.payloadJson === 'string') {
    try { parsed = JSON.parse(raw.payloadJson); } catch { parsed = {}; }
  }
  const merged = cleanForFirestore({
    ...parsed,
    id: String(raw.id || parsed.id || cleanId),
    title: String(raw.title || parsed.title || 'Set'),
    ...(raw.category || parsed.category ? { category: String(raw.category || parsed.category) } : {}),
    published: raw.published !== false && parsed.published !== false,
    ...(raw.createdByUid || parsed.createdByUid ? { createdByUid: String(raw.createdByUid || parsed.createdByUid) } : {}),
    ...(raw.createdByTeacherName || parsed.createdByTeacherName
      ? { createdByTeacherName: String(raw.createdByTeacherName || parsed.createdByTeacherName) }
      : {}),
    updatedAtIso: String(raw.updatedAtIso || parsed.updatedAtIso || '')
  });
  delete merged.ownerEmail;
  if (merged.deleted === true || merged.isArchived === true) {
    return null;
  }
  if (merged.published === false && !options?.includeUnpublished) {
    return null;
  }

  serverPublishedSetCache.set(cleanId, {
    set: merged,
    updatedAtIso: merged.updatedAtIso || '',
    hash: computePublishedSetHash(merged),
    cachedAtMs: Date.now()
  });

  return JSON.parse(JSON.stringify(merged));
}

export async function listAuthoritativePublishedSets(options?: {
  limit?: number;
  cursor?: string;
  requesterUid?: string;
}): Promise<{ sets: any[]; nextCursor: string | null; hasMore: boolean }> {
  const safeLimit = Math.max(1, Math.min(100, Number(options?.limit) || 25));
  const db = getAuthoritativeFirestore();

  let q: any = db.collection('lernstudio_sets').orderBy('updatedAtIso', 'desc');
  if (options?.cursor) {
    const cursorSnap = await db.collection('lernstudio_sets').doc(String(options.cursor).trim()).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }
  q = q.limit(safeLimit + 1);
  const snap = await q.get();

  const docs = snap.docs || [];
  const hasMore = docs.length > safeLimit;
  const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
  const sets: any[] = [];

  for (const d of pageDocs) {
    const raw = d.data() || {};
    if (raw.deleted === true) continue;
    let parsed: any = {};
    if (typeof raw.payloadJson === 'string') {
      try { parsed = JSON.parse(raw.payloadJson); } catch { parsed = {}; }
    }
    if (parsed.deleted === true || parsed.isArchived === true) continue;
    const isPublished = raw.published !== false && parsed.published !== false;
    const creatorUid = String(raw.createdByUid || parsed.createdByUid || '').trim();
    if (!isPublished && (!options?.requesterUid || creatorUid !== options.requesterUid)) {
      continue;
    }
    const clean = cleanForFirestore({
      ...parsed,
      id: String(raw.id || parsed.id || d.id),
      title: String(raw.title || parsed.title || 'Set'),
      published: isPublished,
      ...(creatorUid ? { createdByUid: creatorUid } : {}),
      ...(raw.createdByTeacherName || parsed.createdByTeacherName
        ? { createdByTeacherName: String(raw.createdByTeacherName || parsed.createdByTeacherName) }
        : {}),
      updatedAtIso: String(raw.updatedAtIso || parsed.updatedAtIso || '')
    });
    delete clean.ownerEmail;
    sets.push(clean);
  }

  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
  return {
    sets,
    nextCursor: hasMore && lastDoc ? lastDoc.id : null,
    hasMore
  };
}

export async function saveAuthoritativePublishedSet(
  setItem: any,
  verifiedOwnerUid: string
): Promise<{ set: any; deduplicated: boolean; wrote: boolean }> {
  if (!setItem || !setItem.id) {
    const err: any = new Error('Set must contain a valid id');
    err.status = 400;
    throw err;
  }
  if (!verifiedOwnerUid) {
    const err: any = new Error('Unauthorized: verified user is required');
    err.status = 401;
    throw err;
  }
  const rawId = String(setItem.id).trim();
  if (isBuiltinCurriculumSetId(rawId)) {
    const err: any = new Error('Built-in curriculum sets cannot be written to Firestore');
    err.status = 400;
    throw err;
  }
  if (setItem.isArchived === true) {
    const err: any = new Error('Archived sets cannot be published');
    err.status = 400;
    throw err;
  }

  // The stored set is always owned by the verified caller: a client-supplied
  // createdByUid is never trusted (the /api/homework/sets route already forces
  // it from the Bearer token; this is defence in depth for direct callers).
  const clean = sanitizeSetForStorage(setItem, verifiedOwnerUid);
  clean.createdByUid = verifiedOwnerUid;
  const contentHash = computePublishedSetHash(clean);
  const cached = serverPublishedSetCache.get(clean.id);
  if (cached && cached.hash === contentHash && cached.set?.published === clean.published) {
    return { set: JSON.parse(JSON.stringify(cached.set)), deduplicated: true, wrote: false };
  }

  const db = getAuthoritativeFirestore();
  const docRef = db.collection('lernstudio_sets').doc(clean.id);

  // Owner check + dedup + write run inside one transaction so a concurrent
  // writer cannot slip past the ownership check. An existing document owned
  // by a different teacher is rejected whether it is published or not.
  let dedupedSet: any = null;
  let dedupedUpdatedAtIso = '';
  const nowIso = new Date().toISOString().slice(0, 64);
  const docPayload = cleanForFirestore({
    id: clean.id,
    title: String(clean.title || 'Set').slice(0, 120),
    category: String(clean.category || clean.topic || 'general').slice(0, 45),
    published: clean.published !== false,
    createdByUid: verifiedOwnerUid,
    ...(clean.createdByTeacherName
      ? { createdByTeacherName: String(clean.createdByTeacherName).slice(0, 140) }
      : {}),
    payloadJson: JSON.stringify(clean),
    updatedAtIso: nowIso
  });

  await db.runTransaction(async (transaction: any) => {
    const existingSnap = await transaction.get(docRef);
    if (existingSnap.exists) {
      const existingRaw = existingSnap.data() || {};
      const existingOwner = String(existingRaw.createdByUid || '').trim();
      if (existingRaw.deleted !== true && existingOwner && existingOwner !== verifiedOwnerUid) {
        const err: any = new Error('Forbidden: Cannot overwrite a learning set owned by another teacher');
        err.status = 403;
        throw err;
      }
      if (existingRaw.deleted !== true && typeof existingRaw.payloadJson === 'string') {
        try {
          const existingParsed = JSON.parse(existingRaw.payloadJson);
          const existingNormalized = sanitizeSetForStorage(
            {
              ...existingParsed,
              published: existingRaw.published !== false,
              createdByUid: existingRaw.createdByUid || existingParsed.createdByUid
            },
            existingRaw.createdByUid || verifiedOwnerUid
          );
          if (computePublishedSetHash(existingNormalized) === contentHash) {
            dedupedSet = existingNormalized;
            dedupedUpdatedAtIso = String(existingRaw.updatedAtIso || '');
            return;
          }
        } catch {
          // Proceed with overwrite
        }
      }
    }
    transaction.set(docRef, docPayload);
  });

  if (dedupedSet) {
    serverPublishedSetCache.set(clean.id, {
      set: dedupedSet,
      updatedAtIso: dedupedUpdatedAtIso,
      hash: contentHash,
      cachedAtMs: Date.now()
    });
    return { set: dedupedSet, deduplicated: true, wrote: false };
  }

  const storedSet = { ...clean, updatedAtIso: nowIso };
  serverPublishedSetCache.set(clean.id, {
    set: storedSet,
    updatedAtIso: nowIso,
    hash: contentHash,
    cachedAtMs: Date.now()
  });

  return { set: storedSet, deduplicated: false, wrote: true };
}

// ============================================================================
// AUTHORITATIVE ASSIGNMENT & SHORT LINK OPERATIONS
// ============================================================================

export async function getAuthoritativeAssignment(
  id: string,
  options?: { bypassCache?: boolean }
): Promise<any | null> {
  if (!id || typeof id !== 'string') return null;
  const cleanId = id.trim();
  if (!cleanId) return null;

  if (!options?.bypassCache) {
    const cached = serverAssignmentLookupCache.get(cleanId);
    if (cached) {
      const ageMs = Date.now() - cached.cachedAtMs;
      if (
        ageMs >= 0 &&
        ageMs < SERVER_ASSIGNMENT_CACHE_TTL_MS &&
        isCacheableServerAssignment(cached.assignment)
      ) {
        return JSON.parse(JSON.stringify(cached.assignment));
      }
      serverAssignmentLookupCache.delete(cleanId);
    }
  }

  const db = getAuthoritativeFirestore();
  const snap = await db.collection('homework_assignments').doc(cleanId).get();
  if (!snap.exists) {
    serverAssignmentLookupCache.delete(cleanId);
    return null;
  }
  const decoded = decodeAssignmentDocument(snap.data());
  if (isCacheableServerAssignment(decoded)) {
    serverAssignmentLookupCache.set(cleanId, {
      assignment: JSON.parse(JSON.stringify(decoded)),
      cachedAtMs: Date.now()
    });
  } else {
    serverAssignmentLookupCache.delete(cleanId);
  }
  return decoded;
}

/**
 * Checks whether any revoked short link exists for the given assignmentId.
 * Used when an assignment document has already been canonically deleted so
 * old student links or late submissions still receive a clear closed/revoked rejection.
 */
export async function hasRevokedShortLinkForAssignment(assignmentId: string): Promise<boolean> {
  const cleanId = String(assignmentId || '').trim();
  if (!cleanId) return false;
  const db = getAuthoritativeFirestore();
  try {
    const snap = await db
      .collection('homework_short_links')
      .where('assignmentId', '==', cleanId)
      .limit(5)
      .get();
    for (const docSnap of snap.docs || []) {
      const data = docSnap.data() || {};
      if (data.deleted === true || data.isActive === false) {
        invalidateServerAssignmentCache(cleanId);
        return true;
      }
    }
  } catch {
    // Ignore fallback lookup errors
  }
  return false;
}

export async function getAuthoritativeShortLink(shortId: string): Promise<{
  status: 'resolved' | 'revoked' | 'not_found' | 'invalid_id';
  shortId: string;
  assignmentId?: string;
  assignment?: any;
}> {
  const cleanShortId = String(shortId || '').trim();
  if (!cleanShortId || !/^[A-Za-z0-9]{6,10}$/.test(cleanShortId)) {
    return { status: 'invalid_id', shortId: cleanShortId };
  }
  const db = getAuthoritativeFirestore();
  const shortSnap = await db.collection('homework_short_links').doc(cleanShortId).get();
  if (!shortSnap.exists) {
    return { status: 'not_found', shortId: cleanShortId };
  }

  const rawShort = shortSnap.data() || {};
  const targetAssignmentId = String(rawShort.assignmentId || '').trim();
  if (rawShort.deleted === true || rawShort.isActive === false) {
    if (targetAssignmentId) {
      invalidateServerAssignmentCache(targetAssignmentId);
    }
    return { status: 'revoked', shortId: cleanShortId, assignmentId: targetAssignmentId || undefined };
  }

  // Fast path: 1 Firestore read when homework_short_links/{shortId} already holds an active snapshot.
  // The shareToken is NOT read from the public short-link document (it must
  // never be stored there); it is taken from the owner-only parent assignment
  // document instead, so token enforcement keeps working for shortId lookups.
  if (typeof rawShort.payloadJson === 'string') {
    try {
      const parsed = JSON.parse(rawShort.payloadJson);
      if (parsed?.revoked === true || parsed?.deleted === true || parsed?.isActive === false || parsed?.status === 'closed') {
        const revokedTargetId = targetAssignmentId || parsed?.id;
        if (revokedTargetId) {
          invalidateServerAssignmentCache(String(revokedTargetId));
        }
        return { status: 'revoked', shortId: cleanShortId, assignmentId: revokedTargetId };
      }
      if (parsed && parsed.id && parsed.setSnapshot) {
        let parentShareToken = '';
        if (targetAssignmentId) {
          try {
            const parentHw = await getAuthoritativeAssignment(targetAssignmentId);
            if (parentHw) {
              parentShareToken =
                parentHw.shareToken !== undefined && parentHw.shareToken !== null
                  ? String(parentHw.shareToken).trim()
                  : '';
            }
          } catch {
            // Fall through to the parent lookup below on read errors.
            parentShareToken = '';
          }
        }
        return {
          status: 'resolved',
          shortId: cleanShortId,
          assignmentId: String(parsed.id),
          assignment: {
            ...parsed,
            shortId: cleanShortId,
            ...(rawShort.ownerUid ? { ownerUid: String(rawShort.ownerUid).trim() } : {}),
            ...(parentShareToken ? { shareToken: parentShareToken } : {})
          }
        };
      }
    } catch {
      // Fall through to parent assignment lookup
    }
  }

  if (targetAssignmentId) {
    const parentHw = await getAuthoritativeAssignment(targetAssignmentId);
    if (parentHw) {
      if (
        parentHw.deleted === true ||
        parentHw.isActive === false ||
        parentHw.status === 'closed' ||
        (parentHw.shortId && String(parentHw.shortId).trim() !== cleanShortId)
      ) {
        invalidateServerAssignmentCache(targetAssignmentId);
        return { status: 'revoked', shortId: cleanShortId, assignmentId: targetAssignmentId };
      }
      return {
        status: 'resolved',
        shortId: cleanShortId,
        assignmentId: parentHw.id,
        assignment: { ...parentHw, shortId: cleanShortId }
      };
    }
  }

  return { status: 'not_found', shortId: cleanShortId };
}

export async function listAuthoritativeAssignmentsPage(
  ownerUid: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ assignments: any[]; nextCursor: string | null; hasMore: boolean }> {
  if (!ownerUid || typeof ownerUid !== 'string') {
    return { assignments: [], nextCursor: null, hasMore: false };
  }
  const db = getAuthoritativeFirestore();
  const safeLimit = Math.max(1, Math.min(200, Number(options?.limit) || 50));

  let q: any = db
    .collection('homework_assignments')
    .where('ownerUid', '==', ownerUid.trim())
    .orderBy('createdAt', 'desc');
  if (options?.cursor) {
    const cursorSnap = await db.collection('homework_assignments').doc(String(options.cursor).trim()).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }
  q = q.limit(safeLimit + 1);

  const snap = await q.get();
  const docs = snap.docs || [];
  const hasMore = docs.length > safeLimit;
  const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
  const assignments = pageDocs
    .map((d: any) => decodeAssignmentDocument(d.data()))
    .filter((assignment: any) => assignment && assignment.deleted !== true);

  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
  return {
    assignments,
    nextCursor: hasMore && lastDoc ? lastDoc.id : null,
    hasMore
  };
}

export async function listAuthoritativeAssignments(ownerUid: string): Promise<any[]> {
  if (!ownerUid || typeof ownerUid !== 'string') return [];
  const db = getAuthoritativeFirestore();
  const snap = await db
    .collection('homework_assignments')
    .where('ownerUid', '==', ownerUid.trim())
    .get();
  return snap.docs
    .map((d: any) => decodeAssignmentDocument(d.data()))
    .filter((assignment: any) => assignment && assignment.deleted !== true);
}

export async function saveAuthoritativeAssignment(assignment: any, verifiedOwnerUid: string): Promise<any> {
  if (!assignment || !assignment.id) {
    throw new Error('Assignment must contain a valid id');
  }
  if (!verifiedOwnerUid) {
    throw new Error('Unauthorized: verified ownerUid is required');
  }

  const cleanId = String(assignment.id).trim();
  const cleanShortId = assignment.shortId ? String(assignment.shortId).trim() : '';
  if (cleanShortId && !/^[A-Za-z0-9]{6,10}$/.test(cleanShortId)) {
    const err: any = new Error('Invalid shortId format: must be 6-10 alphanumeric characters');
    err.status = 400;
    throw err;
  }

  invalidateServerAssignmentCache(cleanId);

  const db = getAuthoritativeFirestore();
  const docRef = db.collection('homework_assignments').doc(cleanId);
  const shortRef = cleanShortId ? db.collection('homework_short_links').doc(cleanShortId) : null;
  let cleaned = cleanForFirestore({
    ...assignment,
    id: cleanId,
    ...(cleanShortId ? { shortId: cleanShortId } : {}),
    ...(assignment.originalShortId || cleanShortId
      ? { originalShortId: String(assignment.originalShortId || cleanShortId).trim() }
      : {}),
    ownerUid: verifiedOwnerUid,
    isActive: assignment.isActive !== false && assignment.status !== 'closed' && assignment.deleted !== true,
    updatedAt: new Date().toISOString()
  });
  delete cleaned.ownerEmail;

  await db.runTransaction(async (transaction: any) => {
    const existingSnap = await transaction.get(docRef);
    let previousShortId = '';
    if (existingSnap.exists) {
      const existing = decodeAssignmentDocument(existingSnap.data());
      if (String(existing?.ownerUid || '').trim() !== verifiedOwnerUid) {
        const err: any = new Error('Forbidden: This homework ID belongs to another account or an unclaimed legacy record.');
        err.status = 403;
        throw err;
      }
      if (existing?.deleted === true) {
        const err: any = new Error('This homework was deleted and cannot be reactivated. Create a new homework instead.');
        err.status = 410;
        throw err;
      }
      previousShortId = existing?.shortId ? String(existing.shortId).trim() : '';
      const preservedOriginalShortId = String(
        existing?.originalShortId || previousShortId || cleaned.originalShortId || cleanShortId || ''
      ).trim();
      if (preservedOriginalShortId) {
        cleaned = { ...cleaned, originalShortId: preservedOriginalShortId };
      }
    }
    if (!existingSnap.exists) {
      const revokedSnap = await db
        .collection('homework_short_links')
        .where('assignmentId', '==', cleanId)
        .limit(5)
        .get();
      for (const rDoc of revokedSnap.docs || []) {
        const rData = rDoc.data() || {};
        if (rData.deleted === true) {
          const err: any = new Error('This homework was deleted and cannot be reactivated. Create a new homework instead.');
          err.status = 410;
          throw err;
        }
      }
    }
    if (shortRef) {
      const existingShortSnap = await transaction.get(shortRef);
      if (existingShortSnap.exists) {
        const shortData = existingShortSnap.data() || {};
        if (
          String(shortData.assignmentId || '').trim() !== cleanId ||
          String(shortData.ownerUid || '').trim() !== verifiedOwnerUid
        ) {
          const err: any = new Error('Conflict: Short homework code is already in use by another assignment.');
          err.status = 409;
          err.code = 'SHORT_ID_COLLISION';
          throw err;
        }
        // If this short link was permanently deleted (as opposed to merely closed/paused), never allow recreating a deleted assignment under it
        if (!existingSnap.exists && shortData.deleted === true && String(shortData.assignmentId || '').trim() === cleanId) {
          const err: any = new Error('This homework was deleted and its short link is permanently revoked.');
          err.status = 410;
          throw err;
        }
      }
    }
    const encoded = encodeAssignmentDocument(cleaned);
    transaction.set(docRef, encoded);
    if (shortRef) {
      transaction.set(shortRef, encodeShortLinkDocument(cleaned, verifiedOwnerUid));
    }
    if (previousShortId && previousShortId !== cleanShortId && /^[A-Za-z0-9]{6,10}$/.test(previousShortId)) {
      const oldShortRef = db.collection('homework_short_links').doc(previousShortId);
      const oldShortSnap = await transaction.get(oldShortRef);
      const oldShortData = oldShortSnap.exists ? oldShortSnap.data() || {} : null;
      if (
        !oldShortData ||
        (String(oldShortData.ownerUid || '').trim() === verifiedOwnerUid &&
          String(oldShortData.assignmentId || '').trim() === cleanId)
      ) {
        transaction.set(oldShortRef, {
          shortId: previousShortId,
          assignmentId: cleanId,
          ownerUid: verifiedOwnerUid,
          isActive: false,
          deleted: true,
          createdAt: String(cleaned.createdAt || new Date().toISOString()).slice(0, 60),
          updatedAt: new Date().toISOString().slice(0, 60),
          payloadJson: JSON.stringify({ revoked: true, deleted: true })
        });
      }
    }
  });

  if (isCacheableServerAssignment(cleaned)) {
    serverAssignmentLookupCache.set(cleanId, {
      assignment: JSON.parse(JSON.stringify(cleaned)),
      cachedAtMs: Date.now()
    });
  } else {
    invalidateServerAssignmentCache(cleanId);
  }

  return cleaned;
}

const SERVER_SHORT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateServerUniqueShortId(length = 7, excludedIds?: Iterable<string>): string {
  const excluded = new Set<string>();
  if (excludedIds) {
    for (const id of excludedIds) {
      if (id) excluded.add(String(id).trim());
    }
  }
  const safeLen = Math.min(10, Math.max(6, Math.floor(length || 7)));
  for (let attempt = 0; attempt < 32; attempt++) {
    const bytes = crypto.randomBytes(safeLen);
    let candidate = '';
    for (let i = 0; i < safeLen; i++) {
      candidate += SERVER_SHORT_ID_ALPHABET[bytes[i] % SERVER_SHORT_ID_ALPHABET.length];
    }
    if (!excluded.has(candidate)) {
      return candidate;
    }
  }
  throw new Error('Failed to generate a unique short link code');
}

/**
 * Restores the original short-link ID and record (`homework_short_links/{originalShortId}`)
 * for an existing online assignment without creating a new assignment or resetting student progress.
 * Verifies assignment ownership and ensures the original shortId is not occupied by another assignment.
 */
export async function restoreAuthoritativeHomeworkShortLink(
  assignmentId: string,
  verifiedOwnerUid: string,
  preferredOriginalShortId?: string
): Promise<{
  assignment: any;
  restoredShortId: string;
  previousShortId: string;
}> {
  const cleanId = String(assignmentId || '').trim();
  const cleanOwnerUid = String(verifiedOwnerUid || '').trim();
  if (!cleanId) {
    const err: any = new Error('Assignment id is required');
    err.status = 400;
    throw err;
  }
  if (!cleanOwnerUid) {
    const err: any = new Error('Unauthorized: verified ownerUid is required');
    err.status = 401;
    throw err;
  }

  invalidateServerAssignmentCache(cleanId);
  const db = getAuthoritativeFirestore();
  const docRef = db.collection('homework_assignments').doc(cleanId);

  let restoredAssignment: any = null;
  let restoredShortId = '';
  let previousShortId = '';

  await db.runTransaction(async (transaction: any) => {
    const existingSnap = await transaction.get(docRef);
    if (!existingSnap.exists) {
      const err: any = new Error('Assignment not found');
      err.status = 404;
      throw err;
    }
    const existing = decodeAssignmentDocument(existingSnap.data());
    if (String(existing?.ownerUid || '').trim() !== cleanOwnerUid) {
      const err: any = new Error('Forbidden: You do not own this assignment');
      err.status = 403;
      throw err;
    }
    if (existing?.deleted === true || existing?.status === 'deleted') {
      const err: any = new Error('This homework was deleted and its link cannot be restored');
      err.status = 410;
      throw err;
    }

    previousShortId = existing?.shortId ? String(existing.shortId).trim() : '';
    const storedOriginalShortId = existing?.originalShortId ? String(existing.originalShortId).trim() : '';
    const cleanPreferred = preferredOriginalShortId ? String(preferredOriginalShortId).trim() : '';

    if (
      cleanPreferred &&
      storedOriginalShortId &&
      cleanPreferred !== storedOriginalShortId &&
      cleanPreferred !== previousShortId
    ) {
      const err: any = new Error('Requested shortId does not match the assignment original shortId');
      err.status = 400;
      throw err;
    }

    const targetShortId = storedOriginalShortId || cleanPreferred || previousShortId;
    if (!targetShortId || !/^[A-Za-z0-9]{6,10}$/.test(targetShortId)) {
      const err: any = new Error('Original short-link ID is unavailable or invalid');
      err.status = 400;
      throw err;
    }

    const shortRef = db.collection('homework_short_links').doc(targetShortId);
    const existingShortSnap = await transaction.get(shortRef);
    if (existingShortSnap.exists) {
      const shortData = existingShortSnap.data() || {};
      const shortAssignmentId = String(shortData.assignmentId || '').trim();
      const shortOwnerUid = String(shortData.ownerUid || '').trim();
      if (
        (shortAssignmentId && shortAssignmentId !== cleanId) ||
        (shortOwnerUid && shortOwnerUid !== cleanOwnerUid)
      ) {
        const err: any = new Error('Conflict: Original short-link ID is occupied by another assignment');
        err.status = 409;
        err.code = 'SHORT_ID_COLLISION';
        throw err;
      }
    }

    let oldShortData: any = null;
    const oldShortRef =
      previousShortId && previousShortId !== targetShortId && /^[A-Za-z0-9]{6,10}$/.test(previousShortId)
        ? db.collection('homework_short_links').doc(previousShortId)
        : null;
    if (oldShortRef) {
      const oldShortSnap = await transaction.get(oldShortRef);
      if (oldShortSnap.exists) {
        oldShortData = oldShortSnap.data() || {};
      }
    }

    restoredShortId = targetShortId;
    restoredAssignment = cleanForFirestore({
      ...existing,
      id: cleanId,
      shortId: targetShortId,
      originalShortId: storedOriginalShortId || targetShortId,
      ownerUid: cleanOwnerUid,
      isActive: existing.isActive !== false && existing.status !== 'closed',
      updatedAt: new Date().toISOString()
    });
    delete restoredAssignment.ownerEmail;

    transaction.set(docRef, encodeAssignmentDocument(restoredAssignment));
    transaction.set(shortRef, encodeShortLinkDocument(restoredAssignment, cleanOwnerUid));

    if (
      oldShortRef &&
      (!oldShortData ||
        (String(oldShortData.ownerUid || '').trim() === cleanOwnerUid &&
          String(oldShortData.assignmentId || '').trim() === cleanId))
    ) {
      transaction.set(oldShortRef, {
        shortId: previousShortId,
        assignmentId: cleanId,
        ownerUid: cleanOwnerUid,
        isActive: false,
        deleted: true,
        createdAt: String(restoredAssignment.createdAt || new Date().toISOString()).slice(0, 60),
        updatedAt: new Date().toISOString().slice(0, 60),
        payloadJson: JSON.stringify({ revoked: true, deleted: true })
      });
    }
  });

  if (restoredAssignment && isCacheableServerAssignment(restoredAssignment)) {
    serverAssignmentLookupCache.set(cleanId, {
      assignment: JSON.parse(JSON.stringify(restoredAssignment)),
      cachedAtMs: Date.now()
    });
  } else {
    invalidateServerAssignmentCache(cleanId);
  }

  return {
    assignment: restoredAssignment,
    restoredShortId,
    previousShortId
  };
}

/**
 * Generates a new unique short-link ID for an existing online assignment,
 * makes the new link canonical, and revokes the previous short link atomically
 * while preserving the assignment ID, content, and all student submissions.
 */
export async function regenerateAuthoritativeHomeworkShortLink(
  assignmentId: string,
  verifiedOwnerUid: string,
  requestedNewShortId?: string
): Promise<{
  assignment: any;
  newShortId: string;
  previousShortId: string;
  originalShortId: string;
}> {
  const cleanId = String(assignmentId || '').trim();
  const cleanOwnerUid = String(verifiedOwnerUid || '').trim();
  if (!cleanId) {
    const err: any = new Error('Assignment id is required');
    err.status = 400;
    throw err;
  }
  if (!cleanOwnerUid) {
    const err: any = new Error('Unauthorized: verified ownerUid is required');
    err.status = 401;
    throw err;
  }

  invalidateServerAssignmentCache(cleanId);
  const db = getAuthoritativeFirestore();
  const docRef = db.collection('homework_assignments').doc(cleanId);

  const triedShortIds = new Set<string>();
  let updatedAssignment: any = null;
  let confirmedNewShortId = '';
  let previousShortId = '';
  let originalShortId = '';

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await db.runTransaction(async (transaction: any) => {
        const existingSnap = await transaction.get(docRef);
        if (!existingSnap.exists) {
          const err: any = new Error('Assignment not found');
          err.status = 404;
          throw err;
        }
        const existing = decodeAssignmentDocument(existingSnap.data());
        if (String(existing?.ownerUid || '').trim() !== cleanOwnerUid) {
          const err: any = new Error('Forbidden: You do not own this assignment');
          err.status = 403;
          throw err;
        }
        if (existing?.deleted === true || existing?.status === 'deleted') {
          const err: any = new Error('This homework was deleted and cannot generate a new link');
          err.status = 410;
          throw err;
        }

        previousShortId = existing?.shortId ? String(existing.shortId).trim() : '';
        originalShortId = String(existing?.originalShortId || previousShortId || '').trim();
        if (previousShortId) triedShortIds.add(previousShortId);
        if (originalShortId) triedShortIds.add(originalShortId);

        const cleanRequested =
          attempt === 0 && requestedNewShortId ? String(requestedNewShortId).trim() : '';
        if (cleanRequested && !/^[A-Za-z0-9]{6,10}$/.test(cleanRequested)) {
          const err: any = new Error('Invalid requested shortId format');
          err.status = 400;
          throw err;
        }
        const candidateShortId =
          cleanRequested && !triedShortIds.has(cleanRequested)
            ? cleanRequested
            : generateServerUniqueShortId(7, triedShortIds);
        triedShortIds.add(candidateShortId);

        const newShortRef = db.collection('homework_short_links').doc(candidateShortId);
        const newShortSnap = await transaction.get(newShortRef);
        if (newShortSnap.exists) {
          const err: any = new Error('Conflict: Generated short code is already in use');
          err.status = 409;
          err.code = 'SHORT_ID_COLLISION';
          throw err;
        }

        let oldShortData: any = null;
        const oldShortRef =
          previousShortId && previousShortId !== candidateShortId && /^[A-Za-z0-9]{6,10}$/.test(previousShortId)
            ? db.collection('homework_short_links').doc(previousShortId)
            : null;
        if (oldShortRef) {
          const oldShortSnap = await transaction.get(oldShortRef);
          if (oldShortSnap.exists) {
            oldShortData = oldShortSnap.data() || {};
          }
        }

        confirmedNewShortId = candidateShortId;
        const resolvedOriginalShortId = originalShortId || candidateShortId;
        originalShortId = resolvedOriginalShortId;

        updatedAssignment = cleanForFirestore({
          ...existing,
          id: cleanId,
          shortId: candidateShortId,
          originalShortId: resolvedOriginalShortId,
          ownerUid: cleanOwnerUid,
          isActive: existing.isActive !== false && existing.status !== 'closed',
          updatedAt: new Date().toISOString()
        });
        delete updatedAssignment.ownerEmail;

        transaction.set(docRef, encodeAssignmentDocument(updatedAssignment));
        transaction.set(newShortRef, encodeShortLinkDocument(updatedAssignment, cleanOwnerUid));

        if (
          oldShortRef &&
          (!oldShortData ||
            (String(oldShortData.ownerUid || '').trim() === cleanOwnerUid &&
              String(oldShortData.assignmentId || '').trim() === cleanId))
        ) {
          transaction.set(oldShortRef, {
            shortId: previousShortId,
            assignmentId: cleanId,
            ownerUid: cleanOwnerUid,
            isActive: false,
            deleted: true,
            createdAt: String(updatedAssignment.createdAt || new Date().toISOString()).slice(0, 60),
            updatedAt: new Date().toISOString().slice(0, 60),
            payloadJson: JSON.stringify({ revoked: true, deleted: true })
          });
        }
      });
      break;
    } catch (err: any) {
      if (err?.code === 'SHORT_ID_COLLISION' && !requestedNewShortId && attempt < 5) {
        continue;
      }
      throw err;
    }
  }

  if (updatedAssignment && isCacheableServerAssignment(updatedAssignment)) {
    serverAssignmentLookupCache.set(cleanId, {
      assignment: JSON.parse(JSON.stringify(updatedAssignment)),
      cachedAtMs: Date.now()
    });
  } else {
    invalidateServerAssignmentCache(cleanId);
  }

  return {
    assignment: updatedAssignment,
    newShortId: confirmedNewShortId,
    previousShortId,
    originalShortId
  };
}

/**
 * Canonical Assignment Deletion:
 * 1. Verify ownership on the assignment and any linked homework_short_links.
 * 2. Revoke ALL associated homework_short_links FIRST (fail-closed if revocation fails).
 * 3. Delete the homework_assignments document ONLY AFTER short links are revoked.
 * 4. NEVER delete historical homework_submissions (preserved for teacher reports & audit history).
 * 5. Idempotent on retries if already deleted.
 */
export async function deleteAuthoritativeAssignmentCanonical(id: string, verifiedOwnerUid: string): Promise<{
  id: string;
  deleted: true;
  isActive: false;
  status: 'deleted';
  revokedShortIds: string[];
  alreadyDeleted?: boolean;
}> {
  if (!id || !verifiedOwnerUid) {
    const err: any = new Error('Assignment id and authenticated owner are required');
    err.status = 400;
    throw err;
  }

  const cleanId = String(id).trim();
  const db = getAuthoritativeFirestore();
  const docRef = db.collection('homework_assignments').doc(cleanId);

  const snap = await docRef.get();
  let existing: any = null;
  if (snap.exists) {
    existing = decodeAssignmentDocument(snap.data());
    if (existing.ownerUid !== verifiedOwnerUid) {
      const err: any = new Error('Forbidden: This homework belongs to another teacher account');
      err.status = 403;
      throw err;
    }
  }

  // Discover all short links referencing this assignmentId
  const shortIdsToRevoke = new Set<string>();
  const existingShortId = existing?.shortId ? String(existing.shortId).trim() : '';
  if (existingShortId && /^[A-Za-z0-9]{6,10}$/.test(existingShortId)) {
    shortIdsToRevoke.add(existingShortId);
  }

  const linkedShortSnap = await db
    .collection('homework_short_links')
    .where('assignmentId', '==', cleanId)
    .get();
  for (const sDoc of linkedShortSnap.docs || []) {
    const sData = sDoc.data() || {};
    if (sData.ownerUid && String(sData.ownerUid).trim() !== verifiedOwnerUid) {
      const err: any = new Error('Forbidden: Short link for this assignment belongs to another teacher account');
      err.status = 403;
      throw err;
    }
    if (sDoc.id && /^[A-Za-z0-9]{6,10}$/.test(sDoc.id)) {
      shortIdsToRevoke.add(sDoc.id);
    }
  }

  invalidateServerAssignmentCache(cleanId);

  if (!snap.exists && shortIdsToRevoke.size === 0) {
    // Idempotent when already canonically deleted and no dangling short links remain
    return {
      id: cleanId,
      deleted: true,
      isActive: false,
      status: 'deleted',
      revokedShortIds: [],
      alreadyDeleted: true
    };
  }

  // If the assignment existed without a shortId, synthesize a deterministic 8-char revocation key
  // so link revocation is always recorded in homework_short_links prior to deleting the assignment doc.
  if (snap.exists && shortIdsToRevoke.size === 0) {
    let hash = 2166136261;
    for (let i = 0; i < cleanId.length; i++) {
      hash ^= cleanId.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const syntheticShortId = `Rv${(hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
    shortIdsToRevoke.add(syntheticShortId);
  }

  const nowIso = new Date().toISOString().slice(0, 60);
  const createdAt = String(existing?.createdAt || nowIso).slice(0, 60);
  const revokedShortIds: string[] = [];
  const tombstoneMeta = cleanForFirestore({
    revoked: true,
    deleted: true,
    id: cleanId,
    ...(existing?.title ? { title: String(existing.title).slice(0, 140) } : {}),
    ...(existing?.groupName ? { groupName: String(existing.groupName).slice(0, 120) } : {}),
    ...(existing?.audienceMode ? { audienceMode: existing.audienceMode } : {}),
    ...(typeof existing?.questionCount === 'number' ? { questionCount: existing.questionCount } : {})
  });

  // Step 1: Revoke ALL associated short links FIRST. Abort deletion if any revocation fails.
  for (const sid of shortIdsToRevoke) {
    const shortRef = db.collection('homework_short_links').doc(sid);
    await shortRef.set({
      shortId: sid,
      assignmentId: cleanId,
      ownerUid: verifiedOwnerUid,
      isActive: false,
      deleted: true,
      createdAt,
      updatedAt: nowIso,
      payloadJson: JSON.stringify(tombstoneMeta)
    });
    revokedShortIds.push(sid);
  }

  // Step 2: Only after short links are confirmed revoked, delete homework_assignments/{id}
  if (snap.exists) {
    await docRef.delete();
  }

  invalidateServerAssignmentCache(cleanId);

  // Step 3: Preserve all historical homework_submissions (no deletes emitted here!)
  return {
    id: cleanId,
    deleted: true,
    isActive: false,
    status: 'deleted',
    revokedShortIds,
    alreadyDeleted: !snap.exists
  };
}

export async function softDeleteAuthoritativeAssignment(id: string, verifiedOwnerUid: string): Promise<any> {
  return await deleteAuthoritativeAssignmentCanonical(id, verifiedOwnerUid);
}

// ============================================================================
// AUTHORITATIVE SUBMISSION OPERATIONS & STRICT IMMUTABILITY
// ============================================================================

export async function getAuthoritativeSubmission(id: string): Promise<any | null> {
  if (!id || typeof id !== 'string') return null;
  const db = getAuthoritativeFirestore();
  const snap = await db.collection('homework_submissions').doc(id.trim()).get();
  if (!snap.exists) return null;
  return decodeSubmissionDocument(snap.data());
}

export async function listAuthoritativeSubmissionsPage(
  ownerUid: string,
  assignmentId?: string | null,
  options?: { limit?: number; cursor?: string }
): Promise<{ submissions: any[]; nextCursor: string | null; hasMore: boolean }> {
  if (!ownerUid || typeof ownerUid !== 'string') {
    return { submissions: [], nextCursor: null, hasMore: false };
  }
  const db = getAuthoritativeFirestore();
  const safeLimit = Math.max(1, Math.min(200, Number(options?.limit) || 100));

  let q: any = db
    .collection('homework_submissions')
    .where('ownerUid', '==', ownerUid.trim());
  if (assignmentId) {
    q = q.where('assignmentId', '==', String(assignmentId).trim());
  }
  q = q.orderBy('completedAt', 'desc');
  if (options?.cursor) {
    const cursorSnap = await db.collection('homework_submissions').doc(String(options.cursor).trim()).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }
  q = q.limit(safeLimit + 1);

  const snap = await q.get();
  const docs = snap.docs || [];
  const hasMore = docs.length > safeLimit;
  const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
  const submissions = pageDocs
    .map((d: any) => decodeSubmissionDocument(d.data()))
    .filter(Boolean);

  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
  return {
    submissions,
    nextCursor: hasMore && lastDoc ? lastDoc.id : null,
    hasMore
  };
}

export async function listAuthoritativeSubmissions(
  ownerUid: string,
  assignmentId?: string | null
): Promise<any[]> {
  if (!ownerUid || typeof ownerUid !== 'string') return [];
  const db = getAuthoritativeFirestore();
  let q: any = db
    .collection('homework_submissions')
    .where('ownerUid', '==', ownerUid.trim());
  if (assignmentId) {
    q = q.where('assignmentId', '==', String(assignmentId).trim());
  }
  const snap = await q.get();
  return snap.docs.map((d: any) => decodeSubmissionDocument(d.data())).filter(Boolean);
}

function normalizeResponsesForComparison(responses: any): any[] {
  if (!Array.isArray(responses)) return [];
  return responses.map((r: any) => {
    if (!r || typeof r !== 'object') return r ?? null;
    return {
      questionId: String(r.questionId ?? r.exerciseId ?? r.itemId ?? r.id ?? ''),
      questionType: String(r.questionType ?? r.type ?? ''),
      germanWord: String(r.germanWord ?? ''),
      studentAnswer: String(r.studentAnswer ?? r.selectedAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? ''),
      correctAnswer: String(r.correctAnswer ?? ''),
      isCorrect: Boolean(r.isCorrect),
      timeSpentSeconds: Number(r.timeSpentSeconds ?? 0),
      ...(r.isVerbQuestion ? { isVerbQuestion: true } : {}),
      ...(r.verbId ? { verbId: String(r.verbId) } : {}),
      ...(r.infinitive ? { infinitive: String(r.infinitive) } : {}),
      ...(r.subject ? { subject: String(r.subject) } : {}),
      ...(r.sentence ? { sentence: String(r.sentence) } : {})
    };
  });
}

function normalizeGamificationForComparison(gam: any): string {
  if (!gam || typeof gam !== 'object') return 'null';
  return stableCanonicalStringify(cleanForFirestore(gam));
}

export function areCompletedSubmissionsIdentical(existing: any, incoming: any): boolean {
  if (!existing || !incoming) return false;
  const incomingIsCompleted =
    incoming.status === 'completed' || (!incoming.status && Boolean(incoming.completedAt));
  if (!incomingIsCompleted) {
    // Downgrading a completed submission back to in_progress is strictly forbidden
    return false;
  }

  if (String(existing.assignmentId || '').trim() !== String(incoming.assignmentId || '').trim()) {
    return false;
  }
  if (
    String(existing.studentName || '').trim().toLowerCase() !==
    String(incoming.studentName || '').trim().toLowerCase()
  ) {
    return false;
  }
  if (String(existing.studentId || '') !== String(incoming.studentId || '')) return false;
  if (String(existing.participantId || '') !== String(incoming.participantId || '')) return false;
  if (String(existing.groupId || '') !== String(incoming.groupId || '')) return false;
  if (String(existing.audienceMode || 'open') !== String(incoming.audienceMode || 'open')) return false;
  if (Number(existing.attemptNumber || 1) !== Number(incoming.attemptNumber || 1)) return false;
  if (Boolean(existing.completedStudyPhase) !== Boolean(incoming.completedStudyPhase)) return false;

  // Scores, accuracy, gold, streak, XP, question counts
  if (Number(existing.score ?? existing.correctAnswersCount ?? 0) !== Number(incoming.score ?? incoming.correctAnswersCount ?? 0)) return false;
  if (Number(existing.correctAnswersCount ?? existing.score ?? 0) !== Number(incoming.correctAnswersCount ?? incoming.score ?? 0)) return false;
  if (Number(existing.accuracyPercent ?? existing.scorePercentage ?? existing.accuracy ?? 0) !== Number(incoming.accuracyPercent ?? incoming.scorePercentage ?? incoming.accuracy ?? 0)) return false;
  if (Number(existing.scorePercentage ?? existing.accuracyPercent ?? existing.accuracy ?? 0) !== Number(incoming.scorePercentage ?? incoming.accuracyPercent ?? incoming.accuracy ?? 0)) return false;
  if (Number(existing.totalQuestions ?? 0) !== Number(incoming.totalQuestions ?? 0)) return false;
  if (Number(existing.goldEarned ?? 0) !== Number(incoming.goldEarned ?? 0)) return false;
  if (Number(existing.maxStreak ?? 0) !== Number(incoming.maxStreak ?? 0)) return false;
  if (Number(existing.xpEarned ?? 0) !== Number(incoming.xpEarned ?? 0)) return false;

  // Explicit timestamps and duration (allow omission when caller did not supply timestamps, but reject mismatched values)
  if (
    incoming.startedAt &&
    !incoming._serverDefaultedStartedAt &&
    existing.startedAt &&
    String(existing.startedAt) !== String(incoming.startedAt)
  ) {
    return false;
  }
  if (
    incoming.completedAt &&
    !incoming._serverDefaultedCompletedAt &&
    existing.completedAt &&
    String(existing.completedAt) !== String(incoming.completedAt)
  ) {
    return false;
  }
  if (
    typeof incoming.timeSpentSeconds === 'number' &&
    !incoming._serverComputedTimeSpent &&
    typeof existing.timeSpentSeconds === 'number' &&
    Math.round(existing.timeSpentSeconds) !== Math.round(incoming.timeSpentSeconds)
  ) {
    return false;
  }

  // Deep comparison of gamification state & bonus card results
  if (
    normalizeGamificationForComparison(existing.gamification) !==
    normalizeGamificationForComparison(incoming.gamification)
  ) {
    return false;
  }

  // Deep comparison of all answer & response content
  const existingResponses = normalizeResponsesForComparison(existing.responses);
  const incomingResponses = normalizeResponsesForComparison(incoming.responses);
  if (stableCanonicalStringify(existingResponses) !== stableCanonicalStringify(incomingResponses)) {
    return false;
  }

  return true;
}

export async function saveAuthoritativeSubmission(
  submission: any,
  parentAssignment: any
): Promise<{ submission: any; isIdempotentRetry?: boolean }> {
  if (!submission || !submission.id) {
    throw new Error('Submission must contain a valid id');
  }
  if (!parentAssignment || !parentAssignment.id) {
    const err: any = new Error('Parent assignment not found');
    err.status = 404;
    throw err;
  }

  const assignmentOwnerUid = String(parentAssignment.ownerUid || '').trim();
  if (!assignmentOwnerUid || parentAssignment.deleted === true || parentAssignment.isActive === false || parentAssignment.status === 'closed') {
    const err: any = new Error('Assignment is unavailable or has no valid teacher owner');
    err.status = 403;
    throw err;
  }

  const subId = String(submission.id).trim();
  const db = getAuthoritativeFirestore();
  const docRef = db.collection('homework_submissions').doc(subId);

  const serverFlags = {
    _serverDefaultedStartedAt: Boolean(submission._serverDefaultedStartedAt),
    _serverDefaultedCompletedAt: Boolean(submission._serverDefaultedCompletedAt),
    _serverComputedTimeSpent: Boolean(submission._serverComputedTimeSpent)
  };

  const parentTitle = String(submission.assignmentTitle || parentAssignment.title || '').trim();
  const parentGroupName = String(submission.groupName || parentAssignment.groupName || '').trim();
  const cleaned = cleanForFirestore({
    ...submission,
    id: subId,
    assignmentId: String(parentAssignment.id).trim(),
    ...(parentTitle ? { assignmentTitle: parentTitle } : {}),
    ...(parentGroupName ? { groupName: parentGroupName } : {}),
    ...(parentAssignment.audienceMode || submission.audienceMode
      ? { audienceMode: parentAssignment.audienceMode || submission.audienceMode }
      : {}),
    ...(assignmentOwnerUid ? { ownerUid: assignmentOwnerUid } : {}),
    updatedAt: new Date().toISOString()
  });
  delete cleaned.assignmentFallback;
  delete cleaned.ownerEmail;
  delete cleaned._serverDefaultedStartedAt;
  delete cleaned._serverDefaultedCompletedAt;
  delete cleaned._serverComputedTimeSpent;

  // Scores and rewards are derived ONLY from the stored responses' isCorrect
  // flags, here at the single write point — a caller can never store a
  // gold/score that disagrees with the answers it stores. The API routes
  // already grade responses server-side before calling here, so for API
  // submissions this is idempotent; for direct callers it keeps rewards
  // consistent with the stored answers. Mirrors the /api/homework/submit
  // route: completed => totalQuestions is the answered count, in-progress
  // keeps the larger declared total; score is the correct-answer COUNT.
  const storedResponses = Array.isArray(cleaned.responses) ? cleaned.responses : [];
  const derivedCorrectCount = storedResponses.filter((r: any) => r && r.isCorrect).length;
  let derivedMaxStreak = 0;
  let derivedRun = 0;
  for (const r of storedResponses) {
    if (r && r.isCorrect) {
      derivedRun += 1;
      if (derivedRun > derivedMaxStreak) derivedMaxStreak = derivedRun;
    } else {
      derivedRun = 0;
    }
  }
  const storedIsCompleted = cleaned.status === 'completed' || (!cleaned.status && Boolean(cleaned.completedAt));
  const derivedTotalQuestions = storedIsCompleted
    ? storedResponses.length
    : Math.max(storedResponses.length, Number(cleaned.totalQuestions) || 0);
  const derivedPct =
    derivedTotalQuestions > 0 ? Math.round((derivedCorrectCount / derivedTotalQuestions) * 100) : 0;
  cleaned.totalQuestions = derivedTotalQuestions;
  cleaned.correctAnswersCount = derivedCorrectCount;
  cleaned.scorePercentage = derivedPct;
  cleaned.accuracyPercent = derivedPct;
  cleaned.accuracy = derivedPct;
  cleaned.score = derivedCorrectCount;
  cleaned.goldEarned = derivedCorrectCount * 10;
  cleaned.xpEarned = derivedCorrectCount * 10;
  cleaned.maxStreak = derivedMaxStreak;

  let isIdempotentRetry = false;
  let storedResult: any = cleaned;

  // Server-side maxAttempts enforcement. The assignment's maxAttempts is the
  // only authority: the client-sent attemptNumber is informational and the
  // client-side count (localStorage) is trivially reset, so neither is trusted.
  // Only completed submissions count; an in-progress doc (or an abandoned one)
  // never consumes an attempt. A new doc for the same student + attempt number
  // is a duplicate and is rejected as well.
  const configuredMaxAttempts =
    typeof parentAssignment.maxAttempts === 'number' && Number.isFinite(parentAssignment.maxAttempts)
      ? Math.floor(parentAssignment.maxAttempts)
      : NaN;
  const maxAttemptsEnforced = Number.isFinite(configuredMaxAttempts) && configuredMaxAttempts >= 1;
  const incomingIsCompleted =
    cleaned.status === 'completed' || (!cleaned.status && Boolean(cleaned.completedAt));
  const incomingStudentKey =
    String(cleaned.studentId || '').trim() || String(cleaned.participantId || '').trim();
  const incomingAttemptNumber = Number(cleaned.attemptNumber || 1);

  await db.runTransaction(async (t: any) => {
    const existingSnap = await t.get(docRef);
    if (!existingSnap.exists && incomingIsCompleted && incomingStudentKey) {
      const priorSnap = await t.get(
        db
          .collection('homework_submissions')
          .where('ownerUid', '==', assignmentOwnerUid)
          .where('assignmentId', '==', String(parentAssignment.id).trim())
      );
      let completedCount = 0;
      for (const priorDoc of priorSnap.docs || []) {
        const prior = decodeSubmissionDocument(priorDoc.data());
        if (!prior) continue;
        const priorCompleted =
          prior.status === 'completed' || (!prior.status && Boolean(prior.completedAt));
        if (!priorCompleted) continue;
        const priorStudentKey =
          String(prior.studentId || '').trim() || String(prior.participantId || '').trim();
        const sameStudent =
          (cleaned.studentId && prior.studentId === cleaned.studentId) ||
          (cleaned.participantId && prior.participantId === cleaned.participantId) ||
          (priorStudentKey && priorStudentKey === incomingStudentKey);
        if (!sameStudent) continue;
        if (Number(prior.attemptNumber || 1) === incomingAttemptNumber) {
          const dupErr: any = new Error(
            'Conflict: A completed submission already exists for this student and attempt number'
          );
          dupErr.status = 409;
          dupErr.code = 'DUPLICATE_ATTEMPT';
          throw dupErr;
        }
        completedCount += 1;
      }
      if (maxAttemptsEnforced && completedCount >= configuredMaxAttempts) {
        const limitErr: any = new Error(
          `Forbidden: Maximum number of attempts (${configuredMaxAttempts}) reached for this homework`
        );
        limitErr.status = 403;
        limitErr.code = 'MAX_ATTEMPTS_REACHED';
        throw limitErr;
      }
    }

    if (existingSnap.exists) {
      const existing = decodeSubmissionDocument(existingSnap.data()) || existingSnap.data();

      // 1. Verify ownerUid
      const existingOwner = String(existing.ownerUid || '').trim();
      if (existingOwner !== assignmentOwnerUid) {
        const err: any = new Error('Forbidden: Cannot overwrite submission belonging to another teacher account');
        err.status = 403;
        throw err;
      }

      // 2. Verify studentName
      const existingName = String(existing.studentName || '').trim().toLowerCase();
      const incomingName = String(cleaned.studentName || '').trim().toLowerCase();
      if (existingName && incomingName && existingName !== incomingName) {
        const err: any = new Error('Forbidden: Cannot change studentName on an existing submission');
        err.status = 403;
        throw err;
      }

      // 3. Verify attemptSecret
      if (
        existing.attemptSecret &&
        String(cleaned.attemptSecret || '').trim() !== String(existing.attemptSecret).trim()
      ) {
        const err: any = new Error('Forbidden: Invalid attemptSecret for existing submission');
        err.status = 403;
        throw err;
      }

      // 4. Strict Completed Immutability & Semantic Idempotency
      const existingCompleted =
        existing.status === 'completed' || (!existing.status && Boolean(existing.completedAt));
      if (existingCompleted) {
        const isIdentical = areCompletedSubmissionsIdentical(existing, {
          ...cleaned,
          ...serverFlags
        });

        if (isIdentical) {
          isIdempotentRetry = true;
          storedResult = existing;
          return;
        }

        const err: any = new Error(
          'Conflict: Completed submission is locked and cannot be modified or overwritten'
        );
        err.status = 409;
        err.code = 'SUBMISSION_ALREADY_COMPLETED';
        throw err;
      }
    }

    t.set(docRef, encodeSubmissionDocument(cleaned));
  });

  return { submission: storedResult, isIdempotentRetry };
}

// ============================================================================
// STUDENT DATA DELETION (teacher-requested erasure)
// ============================================================================

/**
 * Deletes every submission of one student for one assignment, as requested by
 * the owning teacher (e.g. a parent asks for their child's homework data to be
 * removed). Only the assignment's owner may call this (enforced by the route);
 * the local-device copies are purged by the client helper
 * deleteStudentHomeworkData() in homeworkStorageSync.ts.
 */
export async function deleteAuthoritativeSubmissionsForStudent(
  ownerUid: string,
  assignmentId: string,
  identifier: { studentId?: string; participantId?: string }
): Promise<{ deletedCount: number; deletedIds: string[] }> {
  const cleanOwner = String(ownerUid || '').trim();
  const cleanAssignmentId = String(assignmentId || '').trim();
  const cleanStudentId = String(identifier?.studentId || '').trim();
  const cleanParticipantId = String(identifier?.participantId || '').trim();
  if (!cleanOwner || !cleanAssignmentId || (!cleanStudentId && !cleanParticipantId)) {
    const err: any = new Error('ownerUid, assignmentId and studentId or participantId are required');
    err.status = 400;
    throw err;
  }
  const parentHw = await getAuthoritativeAssignment(cleanAssignmentId);
  if (!parentHw) {
    const err: any = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  if (String(parentHw.ownerUid || '').trim() !== cleanOwner) {
    const err: any = new Error('Forbidden: Assignment belongs to another teacher account');
    err.status = 403;
    throw err;
  }

  const db = getAuthoritativeFirestore();
  const snap = await db
    .collection('homework_submissions')
    .where('ownerUid', '==', cleanOwner)
    .where('assignmentId', '==', cleanAssignmentId)
    .get();
  const deletedIds: string[] = [];
  for (const docSnap of snap.docs || []) {
    const decoded = decodeSubmissionDocument(docSnap.data());
    if (!decoded) continue;
    const matchesStudent =
      (cleanStudentId && String(decoded.studentId || '').trim() === cleanStudentId) ||
      (cleanParticipantId && String(decoded.participantId || '').trim() === cleanParticipantId);
    if (!matchesStudent) continue;
    await db.collection('homework_submissions').doc(String(decoded.id || docSnap.id)).delete();
    deletedIds.push(String(decoded.id || docSnap.id));
  }
  return { deletedCount: deletedIds.length, deletedIds };
}
