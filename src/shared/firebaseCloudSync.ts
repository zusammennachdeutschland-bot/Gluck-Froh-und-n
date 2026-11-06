import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
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
  getDocFromServer
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
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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
export const DEFAULT_VERCEL_DOMAIN = 'https://gluck-froh-und-n-ex3u.vercel.app';

export function getVercelPublicDomain(): string {
  if (typeof window === 'undefined') return DEFAULT_VERCEL_DOMAIN;
  try {
    const saved = localStorage.getItem(VERCEL_DOMAIN_STORAGE_KEY);
    if (saved && saved.trim().startsWith('http')) {
      return saved.trim().replace(/\/+$/, '');
    }
    if (window.location.hostname.endsWith('.vercel.app')) {
      return window.location.origin.replace(/\/+$/, '');
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
export async function signInTeacherWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.warn('Google sign-in notice:', err);
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
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out notice:', err);
  }
}

export function subscribeTeacherAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// ============================================================================
// FIRESTORE HOMEWORK ASSIGNMENTS
// ============================================================================
function sanitizeDocId(rawId: string): string {
  return (rawId || 'hw_default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export async function saveAssignmentToFirestore(assignment: HomeworkAssignment): Promise<void> {
  const safeId = sanitizeDocId(assignment.id);
  const path = `homework_assignments/${safeId}`;
  try {
    const payloadJson = JSON.stringify({ ...assignment, id: safeId }).slice(0, 490000);
    await setDoc(doc(db, 'homework_assignments', safeId), {
      id: safeId,
      title: (assignment.title || 'Hausaufgabe').slice(0, 290),
      createdAt: (assignment.createdAt || new Date().toISOString()).slice(0, 60),
      isActive: assignment.isActive !== false,
      payloadJson,
      ...(auth.currentUser?.email ? { ownerEmail: auth.currentUser.email.slice(0, 120) } : {})
    });
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
  const q = query(collection(db, 'homework_assignments'), where('id', '>=', ''));
  return onSnapshot(
    q,
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

// ============================================================================
// FIRESTORE STUDENT SUBMISSIONS
// ============================================================================
export async function saveSubmissionToFirestore(submission: HomeworkSubmission): Promise<void> {
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
    await setDoc(doc(db, 'homework_submissions', safeId), {
      id: safeId,
      assignmentId: safeAssignmentId,
      studentName: (submission.studentName || 'طالب').slice(0, 140),
      score: Math.max(0, Math.min(100000, Number(submission.score) || 0)),
      accuracyPercent: Math.max(0, Math.min(100, Number(submission.accuracyPercent) || 0)),
      completedAt: (submission.completedAt || new Date().toISOString()).slice(0, 60),
      payloadJson
    });
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
    const q = query(collection(db, 'homework_submissions'), where('assignmentId', '>=', ''));
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

export function subscribeSubmissionsFromFirestore(
  assignmentId: string | null,
  onUpdate: (submissions: HomeworkSubmission[]) => void
): () => void {
  const q = assignmentId
    ? query(collection(db, 'homework_submissions'), where('assignmentId', '==', sanitizeDocId(assignmentId)))
    : query(collection(db, 'homework_submissions'), where('assignmentId', '>=', ''));

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
  if (!setItem || !setItem.id) return;
  const safeId = sanitizeDocId(setItem.id);
  const path = `lernstudio_sets/${safeId}`;
  try {
    const payloadJson = JSON.stringify(setItem).slice(0, 490000);
    await setDoc(doc(db, 'lernstudio_sets', safeId), {
      id: safeId,
      title: (setItem.title || 'Set').slice(0, 290),
      category: ((setItem as any).category || (setItem as any).topic || 'general').slice(0, 110),
      payloadJson,
      updatedAtIso: new Date().toISOString(),
      ...(auth.currentUser?.email ? { ownerEmail: auth.currentUser.email.slice(0, 120) } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLernstudioSetFromFirestore(setId: string): Promise<void> {
  const safeId = sanitizeDocId(setId);
  const path = `lernstudio_sets/${safeId}`;
  try {
    await deleteDoc(doc(db, 'lernstudio_sets', safeId));
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
