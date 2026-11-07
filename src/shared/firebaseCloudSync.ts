import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  User
} from 'firebase/auth';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocFromServer,
  setLogLevel
} from 'firebase/firestore';
import { HomeworkAssignment, HomeworkSubmission } from './homeworkTypes';
import { LernstudioSet } from '../types/lernstudio';

// Exact configuration from firebase-applet-config.json so both Root App and lernstudio-web (Vercel) share the same Firestore DB
export const FIREBASE_CONFIG = {
  projectId: 'glueck-c8621',
  appId: '1:874458026984:web:f88ecbf0df451173854a5d',
  apiKey: 'AIzaSyBJVhFLw3NeS1MNHJ9ZnAipuZNwRaoaZ-g',
  authDomain: 'glueck-c8621.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixgluckgerman-fc71e704-09a9-492f-82ad-623b4e7b445e',
  storageBucket: 'glueck-c8621.firebasestorage.app',
  messagingSenderId: '874458026984'
};

const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);

function initFirestoreDb() {
  try {
    return initializeFirestore(
      app,
      { experimentalAutoDetectLongPolling: true },
      FIREBASE_CONFIG.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, FIREBASE_CONFIG.firestoreDatabaseId);
  }
}

export const db = initFirestoreDb();
try {
  // Silence internal @firebase/firestore SDK backoff logs when free-tier daily quota is reached
  setLogLevel('silent');
} catch {
  // Ignore
}
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const LEGACY_QUOTA_EXHAUSTED_DATE_KEY = 'gluck_firestore_write_quota_date';
let quotaCooldownUntilMs = 0;

// Clean up any stale 24-hour localStorage lock from earlier versions immediately on load
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_QUOTA_EXHAUSTED_DATE_KEY);
  } catch {
    // Ignore
  }
}

export function isFirestoreWriteQuotaExhaustedToday(): boolean {
  return Date.now() < quotaCooldownUntilMs;
}

export function markFirestoreWriteQuotaExhaustedToday(): void {
  // Pause background auto-writes for 45 seconds instead of locking out for 24 hours
  quotaCooldownUntilMs = Date.now() + 45 * 1000;
}

export function clearFirestoreWriteQuotaFlag(): void {
  quotaCooldownUntilMs = 0;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LEGACY_QUOTA_EXHAUSTED_DATE_KEY);
    } catch {
      // Ignore
    }
  }
}

export async function executeSafeFirestoreWrite<T>(
  writePromiseOrFn: Promise<T> | (() => Promise<T>),
  timeoutMs = 7000,
  maxRetries = 0
): Promise<T> {
  if (isFirestoreWriteQuotaExhaustedToday()) {
    return undefined as unknown as T;
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    let timer: any = null;
    try {
      const currentPromise =
        typeof writePromiseOrFn === 'function' ? writePromiseOrFn() : writePromiseOrFn;

      // Prevent unhandled rejection if currentPromise settles after timeout
      Promise.resolve(currentPromise).catch((bgErr) => {
        const bgMsg = bgErr?.message || String(bgErr);
        if (bgMsg.includes('resource-exhausted') || bgMsg.includes('Quota')) {
          markFirestoreWriteQuotaExhaustedToday();
        }
      });

      const timeoutSymbol = Symbol('firestore_write_buffered');
      const timeoutPromise = new Promise<typeof timeoutSymbol>((resolve) => {
        timer = setTimeout(() => {
          resolve(timeoutSymbol);
        }, timeoutMs);
      });

      const res = await Promise.race([currentPromise, timeoutPromise]);
      if (res === timeoutSymbol) {
        // Firestore SDK keeps the write in its internal pending queue, but we must NOT report success to the sync engine
        console.warn('Firestore write buffered due to timeout/quota.');
        throw new Error('Firestore write timeout/buffered');
      }
      return res as T;
    } catch (err: any) {
      lastError = err;
      const code = err?.code || '';
      const msg = err?.message || String(err);
      if (code === 'resource-exhausted' || msg.includes('resource-exhausted') || msg.includes('Quota exceeded')) {
        markFirestoreWriteQuotaExhaustedToday();
        throw new Error('Quota exceeded: ' + msg);
      }
      if (code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
        throw err;
      }
      attempt++;
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastError;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota')) {
    markFirestoreWriteQuotaExhaustedToday();
    console.warn('Firestore Free-Tier Daily Write Quota Notice:', path);
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
}

// Validate connection on boot
let connectionTested = false;
export async function testFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return true;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}

// ============================================================================
// VERCEL DOMAIN CONFIGURATION (For sending Parent/Student links from Main App)
// ============================================================================
const VERCEL_DOMAIN_STORAGE_KEY = 'gluck_vercel_public_domain';
export const DEFAULT_VERCEL_DOMAIN = 'https://gluck-froh-und-n-br5l.vercel.app';

export function getVercelPublicDomain(): string {
  if (typeof window === 'undefined') return DEFAULT_VERCEL_DOMAIN;
  try {
    if (window.location.hostname.endsWith('.vercel.app')) {
      return window.location.origin.replace(/\/+$/, '');
    }
    const saved = localStorage.getItem(VERCEL_DOMAIN_STORAGE_KEY);
    if (
      saved &&
      saved.trim().startsWith('http') &&
      !saved.includes('gluck-froh-und-n-ex3u.vercel.app')
    ) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_VERCEL_DOMAIN;
}

export function setVercelPublicDomain(domainUrl: string): string {
  let clean = (domainUrl || '').trim().replace(/\/+$/, '');
  if (!clean) {
    clean = DEFAULT_VERCEL_DOMAIN;
  } else if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(VERCEL_DOMAIN_STORAGE_KEY, clean);
    } catch {
      // Ignore
    }
  }
  return clean;
}

// ============================================================================
// FIREBASE AUTHENTICATION (Unified Teacher Login across Main App & Vercel)
// ============================================================================
// Initialize default persistence & handle redirect results on load
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    setPersistence(auth, inMemoryPersistence).catch(() => {});
  });
  getRedirectResult(auth).then((res) => {
    if (res?.user) {
      console.log('Redirect sign-in success:', res.user.email);
    }
  }).catch((e) => {
    console.warn('Redirect result notice:', e);
  });
}

export function emailToWorkspaceId(email: string): string {
  const clean = (email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!clean) {
    throw new Error('Invalid email for workspace identification.');
  }
  return `ws_${clean.slice(0, 90)}`;
}

export function getActiveCloudUser(): User | null {
  return auth.currentUser;
}

export async function signInTeacherWithGoogle(): Promise<User | null> {
  const isCapacitorNative =
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:';

  // 1. On Capacitor Android native, use the Native SDK for a seamless experience
  if (isCapacitorNative) {
    try {
      // Initialize the plugin if not already done (it reads from capacitor.config.ts)
      const googleUser = await GoogleAuth.signIn();
      if (googleUser?.authentication?.idToken) {
        return await signInWithGoogleIdToken(googleUser.authentication.idToken);
      }
      throw new Error('Native Google Sign-In failed to return an ID token.');
    } catch (err: any) {
      console.warn('Capacitor native Google sign-in error:', err);
      // Fallback to standard redirect if native plugin fails
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr) {
        throw err;
      }
    }
  }

  // 2. Set persistence explicitly
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Ignore
  }

  // 3. Primary popup sign-in attempt
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const errCode = err?.code || '';
    const errMsg = err?.message || String(err);
    console.warn('Google sign-in primary attempt notice:', errMsg);

    if (
      errCode === 'auth/unauthorized-domain' ||
      errCode === 'auth/popup-closed-by-user' ||
      errCode === 'auth/cancelled-popup-request'
    ) {
      throw err;
    }

    // 4. Fallback to signInWithRedirect
    try {
      await signInWithRedirect(auth, googleProvider);
      return null;
    } catch (redirectErr: any) {
      console.warn('Redirect fallback sign-in failed:', redirectErr);
    }

    throw err;
  }
}

export async function signInWithGoogleIdToken(idToken: string): Promise<User | null> {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch (err) {
    console.warn('Google ID token sign-in notice:', err);
    throw err;
  }
}

export async function signInTeacherWithEmailPassword(email: string, pass: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();
  const res = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
  return res.user;
}

export async function signOutTeacherFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out notice:', err);
  }
}

export function subscribeTeacherAuth(cb: (user: User | null) => void): () => void {
  cb(auth.currentUser);
  const unsubFirebase = onAuthStateChanged(auth, (u) => {
    cb(u || null);
  });
  return () => {
    unsubFirebase();
  };
}

// ============================================================================
// CONFIRMED FIRESTORE WRITE HELPER (FOR HOMEWORK & SUBMISSIONS)
// Never treats failed or timed-out writes as successful; retries safely.
// ============================================================================
export async function executeConfirmedFirestoreWrite<T>(
  writeFn: () => Promise<T>,
  timeoutMs = 12000,
  maxRetries = 2
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Offline: no internet connection.');
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    let timer: any = null;
    try {
      const writePromise = writeFn();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Firestore write timeout.'));
        }, timeoutMs);
      });

      const res = await Promise.race([writePromise, timeoutPromise]);
      return res;
    } catch (err: any) {
      lastError = err;
      const code = err?.code || '';
      const msg = err?.message || String(err);
      if (
        code === 'permission-denied' ||
        msg.includes('permission-denied') ||
        msg.includes('Missing or insufficient permissions')
      ) {
        throw err;
      }
      attempt++;
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastError || new Error('Firestore write failed.');
}

// ============================================================================
// FIRESTORE HOMEWORK ASSIGNMENTS
// ============================================================================
export function sanitizeDocId(rawId: string): string {
  return (rawId || 'hw_default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export async function saveAssignmentToFirestore(assignment: HomeworkAssignment): Promise<boolean> {
  if (!assignment || !assignment.id) return false;
  const safeId = sanitizeDocId(assignment.id);
  const path = `homework_assignments/${safeId}`;
  try {
    const cleanAssignment: HomeworkAssignment = {
      ...assignment,
      id: safeId,
      cloudSynced: true
    };
    const payloadJson = JSON.stringify(cleanAssignment).slice(0, 490000);
    await executeConfirmedFirestoreWrite(
      () =>
        setDoc(doc(db, 'homework_assignments', safeId), {
          id: safeId,
          title: (assignment.title || 'Hausaufgabe').slice(0, 290),
          createdAt: (assignment.createdAt || new Date().toISOString()).slice(0, 60),
          isActive: assignment.isActive !== false,
          payloadJson,
          ...(auth.currentUser?.email ? { ownerEmail: auth.currentUser.email.slice(0, 120) } : {})
        }),
      12000,
      2
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function fetchAssignmentFromFirestore(assignmentId: string): Promise<HomeworkAssignment | null> {
  const safeId = sanitizeDocId(assignmentId);
  const path = `homework_assignments/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'homework_assignments', safeId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.payloadJson) {
      const parsed = JSON.parse(data.payloadJson) as HomeworkAssignment;
      return { ...parsed, cloudSynced: true };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function fetchAllAssignmentsFromFirestore(): Promise<HomeworkAssignment[]> {
  const path = 'homework_assignments';
  try {
    const q = query(collection(db, 'homework_assignments'), where('id', '>=', ''));
    const snap = await getDocs(q);
    const list: HomeworkAssignment[] = [];
    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson);
          list.push({ ...parsed, cloudSynced: true });
        }
      } catch {
        // Ignore malformed doc
      }
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeAssignmentsFromFirestore(
  onUpdate: (assignments: HomeworkAssignment[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'homework_assignments'),
    (snap) => {
      const list: HomeworkAssignment[] = [];
      snap.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          if (data?.payloadJson) {
            const parsed = JSON.parse(data.payloadJson);
            list.push({ ...parsed, cloudSynced: true });
          }
        } catch {
          // Ignore
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'homework_assignments');
    }
  );
}

export async function deleteAssignmentFromFirestore(assignmentId: string): Promise<boolean> {
  if (!assignmentId) return false;
  const safeId = sanitizeDocId(assignmentId);
  const path = `homework_assignments/${safeId}`;
  try {
    await executeConfirmedFirestoreWrite(() => deleteDoc(doc(db, 'homework_assignments', safeId)));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

export async function deleteSubmissionsForAssignmentFromFirestore(assignmentId: string): Promise<boolean> {
  if (!assignmentId) return false;
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const path = 'homework_submissions';
  try {
    const q = query(
      collection(db, 'homework_submissions'),
      where('assignmentId', '==', safeAssignmentId)
    );
    const snap = await getDocs(q);
    const deletePromises: Promise<any>[] = [];
    snap.forEach((docSnap) => {
      deletePromises.push(executeConfirmedFirestoreWrite(() => deleteDoc(docSnap.ref)));
    });
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

// ============================================================================
// FIRESTORE STUDENT SUBMISSIONS
// ============================================================================
export async function saveSubmissionToFirestore(submission: HomeworkSubmission): Promise<boolean> {
  if (!submission || !submission.id || !submission.assignmentId) return false;
  const safeId = sanitizeDocId(submission.id);
  const safeAssignmentId = sanitizeDocId(submission.assignmentId);
  const path = `homework_submissions/${safeId}`;
  try {
    const isCompleted = submission.status === 'completed';
    const nowIso = new Date().toISOString();
    const normalized: HomeworkSubmission = {
      ...submission,
      id: safeId,
      assignmentId: safeAssignmentId,
      completedAt: isCompleted ? (submission.completedAt || nowIso) : '',
      updatedAt: nowIso,
      cloudSynced: true
    };
    const payloadJson = JSON.stringify(normalized).slice(0, 490000);
    await executeConfirmedFirestoreWrite(
      () =>
        setDoc(doc(db, 'homework_submissions', safeId), {
          id: safeId,
          assignmentId: safeAssignmentId,
          studentName: (submission.studentName || 'طالب').slice(0, 140),
          score: Math.max(0, Math.min(100000, Number(submission.score ?? submission.correctAnswersCount) || 0)),
          accuracyPercent: Math.max(
            0,
            Math.min(100, Number(submission.accuracyPercent ?? submission.scorePercentage ?? submission.accuracy) || 0)
          ),
          completedAt: (normalized.completedAt || submission.startedAt || nowIso).slice(0, 60),
          payloadJson
        }),
      12000,
      2
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function fetchSubmissionsForAssignmentFromFirestore(
  assignmentId: string
): Promise<HomeworkSubmission[]> {
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const path = 'homework_submissions';
  try {
    const q = query(
      collection(db, 'homework_submissions'),
      where('assignmentId', '==', safeAssignmentId)
    );
    const snap = await getDocs(q);
    const list: HomeworkSubmission[] = [];
    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson);
          list.push({ ...parsed, cloudSynced: true });
        }
      } catch {
        // Ignore
      }
    });
    return list.sort(
      (a, b) =>
        new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
        new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function fetchAllSubmissionsFromFirestore(): Promise<HomeworkSubmission[]> {
  const path = 'homework_submissions';
  try {
    const snap = await getDocs(collection(db, 'homework_submissions'));
    const list: HomeworkSubmission[] = [];
    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson);
          list.push({ ...parsed, cloudSynced: true });
        }
      } catch {
        // Ignore
      }
    });
    return list.sort(
      (a, b) =>
        new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
        new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function subscribeSubmissionsFromFirestore(
  assignmentId: string | null,
  onUpdate: (submissions: HomeworkSubmission[]) => void
): () => void {
  const q = assignmentId
    ? query(collection(db, 'homework_submissions'), where('assignmentId', '==', sanitizeDocId(assignmentId)))
    : collection(db, 'homework_submissions');

  return onSnapshot(
    q,
    (snap) => {
      const list: HomeworkSubmission[] = [];
      snap.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          if (data?.payloadJson) {
            const parsed = JSON.parse(data.payloadJson);
            list.push({ ...parsed, cloudSynced: true });
          }
        } catch {
          // Ignore
        }
      });
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
          new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
      );
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'homework_submissions');
    }
  );
}

// ============================================================================
// FIRESTORE LERNSTUDIO SETS SYNC (Main App <-> Vercel)
// ============================================================================
export async function saveLernstudioSetToFirestore(setItem: LernstudioSet): Promise<boolean> {
  if (!setItem || !setItem.id) return false;
  const safeId = sanitizeDocId(setItem.id);
  const path = `lernstudio_sets/${safeId}`;
  try {
    const payloadJson = JSON.stringify(setItem).slice(0, 490000);
    await executeConfirmedFirestoreWrite(() =>
      setDoc(doc(db, 'lernstudio_sets', safeId), {
        id: safeId,
        title: (setItem.title || 'Set').slice(0, 290),
        category: ((setItem as any).category || (setItem as any).topic || 'general').slice(0, 110),
        payloadJson,
        updatedAtIso: new Date().toISOString(),
        ...(auth.currentUser?.email ? { ownerEmail: auth.currentUser.email.slice(0, 120) } : {})
      })
    );
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function deleteLernstudioSetFromFirestore(setId: string): Promise<boolean> {
  if (!setId) return false;
  const safeId = sanitizeDocId(setId);
  const path = `lernstudio_sets/${safeId}`;
  try {
    await executeConfirmedFirestoreWrite(() => deleteDoc(doc(db, 'lernstudio_sets', safeId)));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

export async function fetchLernstudioSetFromFirestore(setId: string): Promise<LernstudioSet | null> {
  if (!setId) return null;
  const safeId = sanitizeDocId(setId);
  const path = `lernstudio_sets/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'lernstudio_sets', safeId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.payloadJson) {
      return JSON.parse(data.payloadJson) as LernstudioSet;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export function subscribeLernstudioSetsFromFirestore(
  onUpdate: (sets: LernstudioSet[]) => void
): () => void {
  const q = query(collection(db, 'lernstudio_sets'), where('id', '>=', ''));
  return onSnapshot(
    q,
    (snap) => {
      const list: LernstudioSet[] = [];
      snap.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          if (data?.payloadJson) {
            list.push(JSON.parse(data.payloadJson));
          }
        } catch {
          // Ignore
        }
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lernstudio_sets');
    }
  );
}

