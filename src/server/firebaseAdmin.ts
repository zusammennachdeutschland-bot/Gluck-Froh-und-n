/**
 * Server-only Firebase Admin SDK module for Glueck.
 * Provides authoritative, durable persistence for assignments and student submissions
 * on Vercel Serverless and Node.js environments.
 * 
 * NEVER import this file from frontend client code.
 */

import { initializeApp, getApps, getApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { FIREBASE_CONFIG } from '../shared/firebaseCloudSync';

// In-Memory Firestore implementation for local testing when no live GCP credentials exist
export class InMemoryAdminFirestore {
  private assignments = new Map<string, any>();
  private submissions = new Map<string, any>();
  private shouldFailWrites = false;
  private failureErrorMessage = 'Simulated Firestore persistence failure';

  public clear(): void {
    this.assignments.clear();
    this.submissions.clear();
    this.shouldFailWrites = false;
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

  collection(name: string) {
    const isAssignments = name === 'homework_assignments';
    const store = isAssignments ? this.assignments : this.submissions;
    const parent = this;

    return {
      doc: (id: string) => ({
        get: async () => {
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
        },
        delete: async () => {
          if (parent.shouldFailWrites) {
            throw new Error(parent.failureErrorMessage);
          }
          store.delete(id);
        }
      }),
      where: (field: string, op: string, value: any) => ({
        where: (field2: string, op2: string, value2: any) => ({
          get: async () => {
            const docs: any[] = [];
            for (const [id, data] of store.entries()) {
              if (op === '==' && data[field] === value && op2 === '==' && data[field2] === value2) {
                docs.push({
                  id,
                  data: () => JSON.parse(JSON.stringify(data))
                });
              }
            }
            return { docs };
          }
        }),
        get: async () => {
          const docs: any[] = [];
          for (const [id, data] of store.entries()) {
            if (op === '==' && data[field] === value) {
              docs.push({
                id,
                data: () => JSON.parse(JSON.stringify(data))
              });
            }
          }
          return { docs };
        }
      })
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    if (this.shouldFailWrites) {
      throw new Error(this.failureErrorMessage);
    }
    const self = this;
    const transaction = {
      get: async (docRef: any) => docRef.get(),
      set: (docRef: any, data: any, options?: any) => docRef.set(data, options),
      delete: (docRef: any) => docRef.delete()
    };
    return await updateFunction(transaction);
  }
}

let customAdminDbOverride: any = null;
let defaultInMemoryDb: InMemoryAdminFirestore | null = null;

/**
 * Detects whether the current runtime is a Vercel, production, staging, or preview deployment.
 * Returns true if VERCEL is '1', VERCEL_ENV is defined, or NODE_ENV indicates a non-test deployment.
 */
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
}

export function resetAdminFirestoreForTesting(): void {
  customAdminDbOverride = null;
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

/**
 * Checks if Firebase Admin credentials are provided in environment variables.
 */
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

  // 1. JSON Service Account Key
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

  // 2. Individual Environment Variables
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

  // 3. Google Application Credentials / Cloud Run ADC
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT) {
    return initializeApp({
      credential: applicationDefault(),
      projectId
    });
  }

  // 4. Firestore Emulator
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  throw new Error(
    'Firebase Admin credentials missing: Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel environment variables.'
  );
}

/**
 * Retrieves the authoritative Firestore instance.
 * Strictly requires configured Admin SDK credentials in production, preview, staging, and live environments.
 * In ALL Vercel and deployment environments, test overrides are strictly rejected and cannot be returned.
 * Test doubles are strictly isolated to explicitly designated test environments.
 */
export function getAuthoritativeFirestore(): any {
  const isDeployment = isNonTestDeploymentOrVercel();

  // In ALL Vercel environments (VERCEL === '1' or VERCEL_ENV is set) and all production/staging/preview runtimes:
  // Strictly reject and purge any test database override!
  if (isDeployment) {
    // Defense-in-depth: Immediately purge any stale override so failed test cleanup cannot contaminate production
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

  // Non-deployment environments (local development or test runner):
  // Check if an injected test database was provided in an explicit test runner
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
    // Strictly isolate to explicit test runner without GCP credentials
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

/**
 * Removes any undefined properties deeply so Firestore writes never fail on unsupported undefined values.
 */
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

// --- Authoritative Assignment Operations ---

export async function getAuthoritativeAssignment(id: string): Promise<any | null> {
  if (!id || typeof id !== 'string') return null;
  const db = getAuthoritativeFirestore();
  const snap = await db.collection('homework_assignments').doc(id.trim()).get();
  if (!snap.exists) return null;
  return snap.data();
}

export async function listAuthoritativeAssignments(ownerUid: string): Promise<any[]> {
  if (!ownerUid || typeof ownerUid !== 'string') return [];
  const db = getAuthoritativeFirestore();
  const snap = await db.collection('homework_assignments').where('ownerUid', '==', ownerUid.trim()).get();
  return snap.docs.map((d: any) => d.data());
}

export async function saveAuthoritativeAssignment(assignment: any, verifiedOwnerUid: string): Promise<any> {
  if (!assignment || !assignment.id) {
    throw new Error('Assignment must contain a valid id');
  }
  if (!verifiedOwnerUid) {
    throw new Error('Unauthorized: verified ownerUid is required');
  }

  const cleanId = String(assignment.id).trim();
  const db = getAuthoritativeFirestore();
  const docRef = db.collection('homework_assignments').doc(cleanId);

  // Check existing document to enforce owner immutability
  const existingSnap = await docRef.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data();
    const existingOwner = String(existing.ownerUid || '').trim();
    if (existingOwner && existingOwner !== verifiedOwnerUid) {
      const err: any = new Error('Forbidden: Cannot overwrite assignment belonging to another teacher account');
      err.status = 403;
      throw err;
    }
  }

  const cleaned = cleanForFirestore({
    ...assignment,
    id: cleanId,
    ownerUid: verifiedOwnerUid,
    updatedAt: new Date().toISOString()
  });
  delete cleaned.ownerEmail; // Never store teacher email in assignment document

  await docRef.set(cleaned, { merge: true });
  return cleaned;
}

// --- Authoritative Submission Operations ---

export async function getAuthoritativeSubmission(id: string): Promise<any | null> {
  if (!id || typeof id !== 'string') return null;
  const db = getAuthoritativeFirestore();
  const snap = await db.collection('homework_submissions').doc(id.trim()).get();
  if (!snap.exists) return null;
  return snap.data();
}

export async function listAuthoritativeSubmissions(ownerUid: string, assignmentId?: string | null): Promise<any[]> {
  if (!ownerUid || typeof ownerUid !== 'string') return [];
  const db = getAuthoritativeFirestore();
  const snap = await db.collection('homework_submissions').where('ownerUid', '==', ownerUid.trim()).get();
  const all = snap.docs.map((d: any) => d.data());
  if (assignmentId) {
    const cleanAssignmentId = String(assignmentId).trim();
    return all.filter((s: any) => s.assignmentId === cleanAssignmentId);
  }
  return all;
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
  const subId = String(submission.id).trim();
  const db = getAuthoritativeFirestore();
  const docRef = db.collection('homework_submissions').doc(subId);

  const cleaned = cleanForFirestore({
    ...submission,
    id: subId,
    assignmentId: String(parentAssignment.id).trim(),
    ...(assignmentOwnerUid ? { ownerUid: assignmentOwnerUid } : {}),
    updatedAt: new Date().toISOString()
  });
  delete cleaned.assignmentFallback;
  delete cleaned.ownerEmail;

  let isIdempotentRetry = false;

  await db.runTransaction(async (t: any) => {
    const existingSnap = await t.get(docRef);
    if (existingSnap.exists) {
      const existing = existingSnap.data();

      // 1. Verify ownerUid
      const existingOwner = String(existing.ownerUid || '').trim();
      if (existingOwner && assignmentOwnerUid && existingOwner !== assignmentOwnerUid) {
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

      // 4. Completed lock check & Idempotency
      const existingCompleted =
        existing.status === 'completed' || (!existing.status && Boolean(existing.completedAt));
      if (existingCompleted) {
        const isIdentical =
          existing.score === cleaned.score &&
          existing.accuracyPercent === cleaned.accuracyPercent &&
          existing.scorePercentage === cleaned.scorePercentage &&
          existing.studentName === cleaned.studentName;

        if (isIdentical) {
          isIdempotentRetry = true;
          return;
        }

        const err: any = new Error('Conflict: Completed submission is locked and cannot be overwritten');
        err.status = 409;
        throw err;
      }
    }

    t.set(docRef, cleaned, { merge: true });
  });

  return { submission: cleaned, isIdempotentRetry };
}
