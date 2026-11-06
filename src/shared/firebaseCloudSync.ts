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
import {
  getFirestore,
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
export const db = getFirestore(app, FIREBASE_CONFIG.firestoreDatabaseId);
try {
  // Silence internal @firebase/firestore SDK backoff logs when free-tier daily quota is reached
  setLogLevel('silent');
} catch {
  // Ignore
}
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const QUOTA_EXHAUSTED_DATE_KEY = 'gluck_firestore_write_quota_date';

function getTodayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isFirestoreWriteQuotaExhaustedToday(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(QUOTA_EXHAUSTED_DATE_KEY) === getTodayUtcDateStr();
  } catch {
    return false;
  }
}

export function markFirestoreWriteQuotaExhaustedToday(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUOTA_EXHAUSTED_DATE_KEY, getTodayUtcDateStr());
  } catch {
    // Ignore
  }
}

export function clearFirestoreWriteQuotaFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUOTA_EXHAUSTED_DATE_KEY);
  } catch {
    // Ignore
  }
}

export async function executeSafeFirestoreWrite<T>(
  writePromiseOrFn: Promise<T> | (() => Promise<T>),
  timeoutMs = 15000,
  maxRetries = 3
): Promise<T> {
  if (isFirestoreWriteQuotaExhaustedToday()) {
    throw new Error('Quota limit exceeded (free tier daily write limit reached for today).');
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    let timer: any = null;
    try {
      const currentPromise =
        typeof writePromiseOrFn === 'function' ? writePromiseOrFn() : writePromiseOrFn;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Firestore write timeout.'));
        }, timeoutMs);
      });

      const res = await Promise.race([currentPromise, timeoutPromise]);
      return res;
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      if (err?.code === 'resource-exhausted' || msg.includes('resource-exhausted') || msg.includes('Quota')) {
        markFirestoreWriteQuotaExhaustedToday();
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
      try {
        localStorage.removeItem(VIRTUAL_CLOUD_USER_STORAGE_KEY);
      } catch {}
      window.dispatchEvent(new CustomEvent('gluck-virtual-auth-changed'));
    }
  }).catch((e) => {
    console.warn('Redirect result notice:', e);
  });
}

const VIRTUAL_CLOUD_USER_STORAGE_KEY = 'gluck_cloud_virtual_teacher_v1';

export interface VirtualCloudUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phoneNumber: string | null;
  isVirtualCloudUser: true;
}

export function emailToWorkspaceId(email: string): string {
  const clean = (email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return clean ? `ws_${clean.slice(0, 90)}` : 'ws_default_teacher';
}

export function getVirtualCloudUser(): VirtualCloudUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VIRTUAL_CLOUD_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && parsed.uid) {
      return parsed as VirtualCloudUser;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function getActiveCloudUser(): User | VirtualCloudUser | null {
  return auth.currentUser || getVirtualCloudUser();
}

export async function signInWithCloudEmailDirect(
  email: string,
  displayName?: string
): Promise<VirtualCloudUser> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('يرجى إدخال بريد Google الإلكتروني بشكل صحيح.');
  }
  const fallbackName = cleanEmail.split('@')[0].replace(/[._-]+/g, ' ');
  const vUser: VirtualCloudUser = {
    uid: emailToWorkspaceId(cleanEmail),
    email: cleanEmail,
    displayName: (displayName || '').trim() || fallbackName,
    photoURL: null,
    phoneNumber: null,
    isVirtualCloudUser: true
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(VIRTUAL_CLOUD_USER_STORAGE_KEY, JSON.stringify(vUser));
      window.dispatchEvent(new CustomEvent('gluck-virtual-auth-changed'));
    } catch {
      // Ignore
    }
  }
  return vUser;
}

export async function signInTeacherWithGoogle(): Promise<User | null> {
  const isCapacitorNative =
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:';

  // 1. On Capacitor Android native, popups are not supported. Use signInWithRedirect.
  if (isCapacitorNative) {
    try {
      await signInWithRedirect(auth, googleProvider);
      return null; // Completes upon redirect return
    } catch (redirectErr) {
      console.warn('Capacitor native redirect sign-in error:', redirectErr);
      throw redirectErr;
    }
  }

  // 2. Set persistence explicitly
  try {
    await setPersistence(auth, browserLocalPersistence).catch(() => {
      return setPersistence(auth, browserSessionPersistence).catch(() => {
        return setPersistence(auth, inMemoryPersistence).catch(() => {});
      });
    });
  } catch {
    // Ignore persistence setup notice
  }

  // 3. Primary popup sign-in attempt
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Clear any virtual fallback if real Firebase Auth succeeded
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(VIRTUAL_CLOUD_USER_STORAGE_KEY);
      } catch {}
    }
    return result.user;
  } catch (err: any) {
    const errCode = err?.code || '';
    const errMsg = err?.message || String(err);
    console.warn('Google sign-in primary attempt notice:', errMsg);

    // Do NOT attempt signInWithRedirect if domain is unauthorized or user closed the popup
    if (
      errCode === 'auth/unauthorized-domain' ||
      errMsg.includes('unauthorized-domain') ||
      errCode === 'auth/popup-closed-by-user' ||
      errCode === 'auth/cancelled-popup-request'
    ) {
      throw err;
    }

    // 4. Fallback to signInWithRedirect only for storage partitioning, missing initial state, or popup blocking
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
  try {
    const res = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    return res.user;
  } catch (err: any) {
    // If user does not exist yet in Firebase Auth, automatically create it for the teacher!
    if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
      try {
        const createRes = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        return createRes.user;
      } catch (createErr) {
        throw createErr;
      }
    }
    throw err;
  }
}

export async function signOutTeacherFirebase(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(VIRTUAL_CLOUD_USER_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('gluck-virtual-auth-changed'));
    } catch {
      // Ignore
    }
  }
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out notice:', err);
  }
}

export function subscribeTeacherAuth(cb: (user: User | null) => void): () => void {
  const emitCurrent = () => {
    const active = auth.currentUser || (getVirtualCloudUser() as unknown as User | null);
    cb(active);
  };
  emitCurrent();
  const unsubFirebase = onAuthStateChanged(auth, (u) => {
    if (u) {
      cb(u);
    } else {
      cb(getVirtualCloudUser() as unknown as User | null);
    }
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('gluck-virtual-auth-changed', emitCurrent);
  }
  return () => {
    unsubFirebase();
    if (typeof window !== 'undefined') {
      window.removeEventListener('gluck-virtual-auth-changed', emitCurrent);
    }
  };
}

// ============================================================================
// FIRESTORE HOMEWORK ASSIGNMENTS
// ============================================================================
function sanitizeDocId(rawId: string): string {
  return (rawId || 'hw_default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export async function saveAssignmentToFirestore(assignment: HomeworkAssignment): Promise<void> {
  if (isFirestoreWriteQuotaExhaustedToday()) return;
  const safeId = sanitizeDocId(assignment.id);
  const path = `homework_assignments/${safeId}`;
  try {
    const payloadJson = JSON.stringify({ ...assignment, id: safeId }).slice(0, 490000);
    await executeSafeFirestoreWrite(
      () =>
        setDoc(doc(db, 'homework_assignments', safeId), {
          id: safeId,
          title: (assignment.title || 'Hausaufgabe').slice(0, 290),
          createdAt: (assignment.createdAt || new Date().toISOString()).slice(0, 60),
          isActive: assignment.isActive !== false,
          payloadJson,
          ...(auth.currentUser?.email ? { ownerEmail: auth.currentUser.email.slice(0, 120) } : {})
        }),
      15000,
      3
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
      return JSON.parse(data.payloadJson) as HomeworkAssignment;
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
          list.push(JSON.parse(data.payloadJson));
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
            list.push(JSON.parse(data.payloadJson));
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

export async function deleteAssignmentFromFirestore(assignmentId: string): Promise<void> {
  if (!assignmentId || isFirestoreWriteQuotaExhaustedToday()) return;
  const safeId = sanitizeDocId(assignmentId);
  const path = `homework_assignments/${safeId}`;
  try {
    await executeSafeFirestoreWrite(deleteDoc(doc(db, 'homework_assignments', safeId)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteSubmissionsForAssignmentFromFirestore(assignmentId: string): Promise<void> {
  if (!assignmentId || isFirestoreWriteQuotaExhaustedToday()) return;
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
      deletePromises.push(executeSafeFirestoreWrite(deleteDoc(docSnap.ref)));
    });
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// FIRESTORE STUDENT SUBMISSIONS
// ============================================================================
export async function saveSubmissionToFirestore(submission: HomeworkSubmission): Promise<void> {
  if (isFirestoreWriteQuotaExhaustedToday()) return;
  const safeId = sanitizeDocId(submission.id);
  const safeAssignmentId = sanitizeDocId(submission.assignmentId);
  const path = `homework_submissions/${safeId}`;
  try {
    const normalized: HomeworkSubmission = {
      ...submission,
      id: safeId,
      assignmentId: safeAssignmentId
    };
    const payloadJson = JSON.stringify(normalized).slice(0, 490000);
    await executeSafeFirestoreWrite(
      () =>
        setDoc(doc(db, 'homework_submissions', safeId), {
          id: safeId,
          assignmentId: safeAssignmentId,
          studentName: (submission.studentName || 'طالب').slice(0, 140),
          score: Math.max(0, Math.min(100000, Number(submission.score) || 0)),
          accuracyPercent: Math.max(0, Math.min(100, Number(submission.accuracyPercent) || 0)),
          completedAt: (submission.completedAt || new Date().toISOString()).slice(0, 60),
          payloadJson
        }),
      15000,
      3
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
          list.push(JSON.parse(data.payloadJson));
        }
      } catch {
        // Ignore
      }
    });
    return list.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
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
          list.push(JSON.parse(data.payloadJson));
        }
      } catch {
        // Ignore
      }
    });
    return list.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
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
            list.push(JSON.parse(data.payloadJson));
          }
        } catch {
          // Ignore
        }
      });
      list.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
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
export async function saveLernstudioSetToFirestore(setItem: LernstudioSet): Promise<void> {
  if (!setItem || !setItem.id || isFirestoreWriteQuotaExhaustedToday()) return;
  const safeId = sanitizeDocId(setItem.id);
  const path = `lernstudio_sets/${safeId}`;
  try {
    const payloadJson = JSON.stringify(setItem).slice(0, 490000);
    await executeSafeFirestoreWrite(
      setDoc(doc(db, 'lernstudio_sets', safeId), {
        id: safeId,
        title: (setItem.title || 'Set').slice(0, 290),
        category: ((setItem as any).category || (setItem as any).topic || 'general').slice(0, 110),
        payloadJson,
        updatedAtIso: new Date().toISOString(),
        ...(auth.currentUser?.email ? { ownerEmail: auth.currentUser.email.slice(0, 120) } : {})
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLernstudioSetFromFirestore(setId: string): Promise<void> {
  if (isFirestoreWriteQuotaExhaustedToday()) return;
  const safeId = sanitizeDocId(setId);
  const path = `lernstudio_sets/${safeId}`;
  try {
    await executeSafeFirestoreWrite(deleteDoc(doc(db, 'lernstudio_sets', safeId)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
