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
  GOOGLE_WEB_CLIENT_ID,
  getResolvedGoogleWebClientId,
  isAndroidNativePlatform,
  invokeNativeGoogleCredentialSignIn,
  invokeNativeGoogleCredentialSignOut,
  getLastAndroidAuthDiagnostic,
  clearLastAndroidAuthDiagnostic,
  getAndroidApkSigningInfo,
  AndroidApkSigningInfo,
  AndroidAuthDiagnostic
} from './googleCredentialAuthPlugin';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
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
  const hasIndexedDb =
    typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

  if (hasIndexedDb) {
    try {
      return initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          }),
          experimentalAutoDetectLongPolling: true
        },
        FIREBASE_CONFIG.firestoreDatabaseId
      );
    } catch {
      // Fall through if IndexedDB persistence is restricted or Firestore instance is already initialized
    }
  }

  try {
    return initializeFirestore(
      app,
      {
        localCache: memoryLocalCache(),
        experimentalAutoDetectLongPolling: true
      },
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
  timeoutMs = 20000
): Promise<T> {
  if (isFirestoreWriteQuotaExhaustedToday()) {
    throw new Error('Quota exceeded: Firestore daily write quota is temporarily on cooldown.');
  }

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

    const timeoutSymbol = Symbol('firestore_write_timeout');
    const timeoutPromise = new Promise<typeof timeoutSymbol>((resolve) => {
      timer = setTimeout(() => {
        resolve(timeoutSymbol);
      }, timeoutMs);
    });

    const res = await Promise.race([currentPromise, timeoutPromise]);
    if (res === timeoutSymbol) {
      // Firestore SDK keeps the write in its internal pending queue when daily free-tier quota is reached or network is slow
      markFirestoreWriteQuotaExhaustedToday();
      throw new Error('Quota exceeded or network slow: Firestore write buffered.');
    }
    return res as T;
  } catch (err: any) {
    const code = err?.code || '';
    const msg = err?.message || String(err);
    if (
      code === 'resource-exhausted' ||
      msg.includes('resource-exhausted') ||
      msg.includes('Quota exceeded')
    ) {
      markFirestoreWriteQuotaExhaustedToday();
      throw new Error('Quota exceeded: ' + msg);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
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
export {
  GOOGLE_WEB_CLIENT_ID,
  isAndroidNativePlatform,
  getLastAndroidAuthDiagnostic,
  clearLastAndroidAuthDiagnostic,
  getAndroidApkSigningInfo
};
export type { AndroidApkSigningInfo, AndroidAuthDiagnostic };

export interface FirebaseAuthTestOverrides {
  signInWithGoogleIdToken?: (idToken: string) => Promise<User | null>;
  signInWithPopup?: () => Promise<User | null>;
  signOutFirebase?: () => Promise<void>;
}

let firebaseAuthTestOverrides: FirebaseAuthTestOverrides | null = null;

export function __setFirebaseAuthTestOverrides(overrides: FirebaseAuthTestOverrides | null): void {
  firebaseAuthTestOverrides = overrides;
}

// Initialize default persistence & handle redirect results on load (Web only)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    setPersistence(auth, browserSessionPersistence).catch(() => {
      setPersistence(auth, inMemoryPersistence).catch(() => {});
    });
  });
  if (!isAndroidNativePlatform()) {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          console.log('Redirect sign-in success:', res.user.email);
        }
      })
      .catch((e) => {
        console.warn('Redirect result notice:', e);
      });
  }
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

let activeGoogleSignInPromise: Promise<User | null> | null = null;

export function isUserCancellationError(err: any): boolean {
  if (!err) return false;
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '').toLowerCase();
  if (
    msg.includes('28444') ||
    msg.includes('developer_error') ||
    msg.includes('developer console') ||
    msg.includes('not set up correctly') ||
    msg.includes('caller not whitelisted')
  ) {
    return false;
  }
  return (
    code === 'user_cancelled' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    msg.includes('getcredentialcancellationexception') ||
    msg.includes('popup-closed-by-user') ||
    msg.includes('cancelled-popup-request')
  );
}

function notifyTeacherAuthSubscribers(user: User | null): void {
  if (testHomeworkAuthUser !== undefined) return;
  teacherAuthSubscribers.forEach((cb) => {
    try {
      cb(user);
    } catch {
      // Ignore subscriber callback errors
    }
  });
}

async function executeGoogleSignInInternal(): Promise<User | null> {
  // 1. ANDROID NATIVE: Exclusively use AndroidX Credential Manager dialog over MainActivity.
  // Strictly forbidden: external browser, Custom Tabs, signInWithRedirect, or localhost callbacks.
  if (isAndroidNativePlatform()) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const netErr: any = new Error('لا يوجد اتصال بالإنترنت. يرجى التحقق من الشبكة والمحاولة مرة أخرى.');
      netErr.code = 'auth/network-request-failed';
      throw netErr;
    }

    try {
      const nativeResult = await invokeNativeGoogleCredentialSignIn({
        serverClientId: getResolvedGoogleWebClientId()
      });

      if (!nativeResult || nativeResult.cancelled === true) {
        return null;
      }

      const rawToken = typeof nativeResult.idToken === 'string' ? nativeResult.idToken.trim() : '';
      if (!rawToken || rawToken.split('.').length < 2) {
        const tokenErr: any = new Error('تعذر التحقق من رمز حساب Google المستلم. يرجى المحاولة مرة أخرى.');
        tokenErr.code = 'INVALID_ID_TOKEN';
        throw tokenErr;
      }

      const signedInUser = await signInWithGoogleIdToken(rawToken);
      if (signedInUser) {
        // Ensure native credential profile metadata (displayName, email, photoUrl) is immediately available on user
        try {
          if (!signedInUser.displayName && nativeResult.displayName) {
            Object.defineProperty(signedInUser, 'displayName', {
              value: nativeResult.displayName,
              configurable: true
            });
          }
          if (!signedInUser.email && nativeResult.email) {
            Object.defineProperty(signedInUser, 'email', {
              value: nativeResult.email,
              configurable: true
            });
          }
          if (!signedInUser.photoURL && nativeResult.photoUrl) {
            Object.defineProperty(signedInUser, 'photoURL', {
              value: nativeResult.photoUrl,
              configurable: true
            });
          }
        } catch {
          // Ignore read-only property descriptors in mocked objects
        }
        notifyTeacherAuthSubscribers(signedInUser);
      }
      return signedInUser;
    } catch (err: any) {
      if (isUserCancellationError(err)) {
        return null;
      }

      const code = String(err?.code || '');
      const msg = String(err?.message || err || '');

      if (code === 'NO_GOOGLE_ACCOUNT' || msg.toLowerCase().includes('nocredentialexception')) {
        const noAccErr: any = new Error(
          'لا يوجد حساب Google مسجل على هذا الهاتف حالياً، أو أن شهادة التطبيق (SHA-1) غير مضافة في إعدادات Firebase.'
        );
        noAccErr.code = 'NO_GOOGLE_ACCOUNT';
        throw noAccErr;
      }

      if (
        code === 'NETWORK_OR_INTERRUPTED' ||
        code === 'auth/network-request-failed' ||
        msg.toLowerCase().includes('network')
      ) {
        const netErr: any = new Error('تعذر الاتصال بخدمات Google. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.');
        netErr.code = 'auth/network-request-failed';
        throw netErr;
      }

      throw err;
    }
  }

  // 2. WEB & ELECTRON DESKTOP: Preserve existing supported popup flow
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Ignore persistence fallback errors
  }

  try {
    if (firebaseAuthTestOverrides?.signInWithPopup) {
      return await firebaseAuthTestOverrides.signInWithPopup();
    }
    const result = await signInWithPopup(auth, googleProvider);
    if (result?.user) {
      notifyTeacherAuthSubscribers(result.user);
    }
    return result.user;
  } catch (err: any) {
    if (isUserCancellationError(err)) {
      return null;
    }
    throw err;
  }
}

export async function signInTeacherWithGoogle(): Promise<User | null> {
  if (activeGoogleSignInPromise) {
    return activeGoogleSignInPromise;
  }
  activeGoogleSignInPromise = executeGoogleSignInInternal().finally(() => {
    activeGoogleSignInPromise = null;
  });
  return activeGoogleSignInPromise;
}

export async function signInWithGoogleIdToken(idToken: string): Promise<User | null> {
  const cleanToken = typeof idToken === 'string' ? idToken.trim() : '';
  if (!cleanToken || cleanToken.split('.').length < 2) {
    const err: any = new Error('Invalid Google ID token format.');
    err.code = 'INVALID_ID_TOKEN';
    throw err;
  }
  if (firebaseAuthTestOverrides?.signInWithGoogleIdToken) {
    return await firebaseAuthTestOverrides.signInWithGoogleIdToken(cleanToken);
  }
  try {
    const credential = GoogleAuthProvider.credential(cleanToken);
    const result = await signInWithCredential(auth, credential);
    if (result?.user) {
      notifyTeacherAuthSubscribers(result.user);
    }
    return result.user;
  } catch (err) {
    console.warn('Google ID token sign-in notice:', err instanceof Error ? err.message : 'Auth error');
    throw err;
  }
}

export async function signInTeacherWithEmailPassword(email: string, pass: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();
  const res = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
  if (res?.user) {
    notifyTeacherAuthSubscribers(res.user);
  }
  return res.user;
}

export async function createTeacherWithEmailPassword(email: string, pass: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();
  const res = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
  if (res?.user) {
    notifyTeacherAuthSubscribers(res.user);
  }
  return res.user;
}

export async function signOutTeacherFirebase(): Promise<void> {
  try {
    if (isAndroidNativePlatform()) {
      try {
        await invokeNativeGoogleCredentialSignOut();
      } catch (logoutErr) {
        console.warn('Native credential state clear notice:', logoutErr);
      }
    }
    if (firebaseAuthTestOverrides?.signOutFirebase) {
      await firebaseAuthTestOverrides.signOutFirebase();
      return;
    }
    await signOut(auth);
    notifyTeacherAuthSubscribers(null);
  } catch (err) {
    console.warn('Sign out notice:', err);
  }
}

export interface HomeworkTestAuthUser {
  uid: string;
  email?: string | null;
}

let testHomeworkAuthUser: HomeworkTestAuthUser | null | undefined = undefined;
const teacherAuthSubscribers = new Set<(user: User | null) => void>();

export function __setHomeworkAuthUserForTests(
  user: HomeworkTestAuthUser | null | undefined
): void {
  testHomeworkAuthUser = user;
  const effectiveUser =
    user === undefined ? auth.currentUser : (user as unknown as User | null);
  teacherAuthSubscribers.forEach((cb) => {
    try {
      cb(effectiveUser);
    } catch {
      // Ignore subscriber callback errors
    }
  });
}

export function getCurrentHomeworkOwnerUid(): string | null {
  if (testHomeworkAuthUser !== undefined) {
    const clean = testHomeworkAuthUser?.uid?.trim() || '';
    return clean.length > 0 ? clean : null;
  }
  const clean = auth.currentUser?.uid?.trim() || '';
  return clean.length > 0 ? clean : null;
}

export function getCurrentHomeworkOwnerEmail(): string | null {
  if (testHomeworkAuthUser !== undefined) {
    const clean = testHomeworkAuthUser?.email?.trim() || '';
    return clean.length > 0 ? clean : null;
  }
  const clean = auth.currentUser?.email?.trim() || '';
  return clean.length > 0 ? clean : null;
}

export function subscribeTeacherAuth(cb: (user: User | null) => void): () => void {
  teacherAuthSubscribers.add(cb);
  const initialUser =
    testHomeworkAuthUser !== undefined
      ? (testHomeworkAuthUser as unknown as User | null)
      : auth.currentUser;
  cb(initialUser);
  const unsubFirebase = onAuthStateChanged(auth, (u) => {
    if (testHomeworkAuthUser !== undefined) return;
    cb(u || null);
  });
  return () => {
    teacherAuthSubscribers.delete(cb);
    unsubFirebase();
  };
}

// ============================================================================
// CONFIRMED FIRESTORE WRITE HELPER (FOR HOMEWORK & SUBMISSIONS)
// Never treats failed or timed-out writes as successful; retries safely.
// ============================================================================
export async function executeConfirmedFirestoreWrite<T>(
  writeFn: () => Promise<T>,
  timeoutMs = 20000,
  maxRetries = 3
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
// FIRESTORE HOMEWORK ASSIGNMENTS (STRICTLY SCOPED BY TEACHER ownerUid)
// ============================================================================
export function sanitizeDocId(rawId: string): string {
  return (rawId || 'hw_default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export async function saveAssignmentToFirestore(
  assignment: HomeworkAssignment,
  explicitOwnerUid?: string
): Promise<boolean> {
  if (!assignment || !assignment.id) return false;
  const rawOwnerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  const recordOwnerUid = assignment.ownerUid?.trim() || '';
  if (!rawOwnerUid || (recordOwnerUid && recordOwnerUid !== rawOwnerUid)) return false;

  const ownerUid = rawOwnerUid.slice(0, 128);
  const safeId = sanitizeDocId(assignment.id);
  const path = `homework_assignments/${safeId}`;
  const isActive = assignment.isActive !== false && (assignment as any).deleted !== true && assignment.status !== 'closed';
  const createdAt = (assignment.createdAt || new Date().toISOString()).slice(0, 60);
  const title = (assignment.title || 'واجب منزلي').slice(0, 290);
  const shareToken = assignment.shareToken?.trim() ? assignment.shareToken.trim().slice(0, 128) : undefined;

  const normalized: HomeworkAssignment = {
    ...assignment,
    id: safeId,
    ownerUid,
    title,
    createdAt,
    isActive,
    ...(shareToken ? { shareToken } : {}),
    cloudSynced: true
  };
  // V-06: Strip teacher ownerEmail from public/Firestore homework assignment document
  delete normalized.ownerEmail;
  delete (normalized as any).cloudCreatePending;
  if (normalized.setSnapshot && typeof normalized.setSnapshot === 'object') {
    const cleanSnap = { ...normalized.setSnapshot };
    delete (cleanSnap as any).ownerEmail;
    normalized.setSnapshot = cleanSnap;
  }

  let firestoreSaved = false;
  try {
    const payloadJson = JSON.stringify(normalized).slice(0, 490000);
    await executeConfirmedFirestoreWrite(
      () =>
        setDoc(doc(db, 'homework_assignments', safeId), {
          id: safeId,
          ownerUid,
          title,
          createdAt,
          isActive,
          ...(shareToken ? { shareToken } : {}),
          payloadJson
        }),
      12000,
      2
    );
    firestoreSaved = true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  let apiSaved = false;
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid === ownerUid) {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        credentials: 'include',
        body: JSON.stringify({ ...normalized, ownerUid })
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        apiSaved = data?.success === true && Boolean(data?.assignment?.id);
      }
    } catch {
      // Ignore server API unavailability (e.g. Android APK or unconfigured Admin SDK)
    }
  }

  return firestoreSaved || apiSaved;
}

async function withFirestoreReadTimeout<T>(promise: Promise<T>, timeoutMs = 4000): Promise<T> {
  let timer: any = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Firestore read timeout')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchAssignmentFromFirestore(
  assignmentId: string,
  options?: { requireOwnerUid?: string }
): Promise<HomeworkAssignment | null> {
  const safeId = sanitizeDocId(assignmentId);
  const path = `homework_assignments/${safeId}`;
  try {
    const snap = await withFirestoreReadTimeout(getDoc(doc(db, 'homework_assignments', safeId)), 4000);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.payloadJson) {
      const parsed = JSON.parse(data.payloadJson) as HomeworkAssignment;
      const docOwnerUid = (typeof data.ownerUid === 'string' && data.ownerUid.trim()) || parsed.ownerUid?.trim() || undefined;
      const docOwnerEmail = (typeof data.ownerEmail === 'string' && data.ownerEmail.trim()) || parsed.ownerEmail?.trim() || undefined;
      if (options?.requireOwnerUid && docOwnerUid !== options.requireOwnerUid.trim()) {
        return null;
      }
      return {
        ...parsed,
        ...(docOwnerUid ? { ownerUid: docOwnerUid } : {}),
        ...(docOwnerEmail ? { ownerEmail: docOwnerEmail } : {}),
        isActive: typeof data.isActive === 'boolean' ? data.isActive : parsed.isActive !== false,
        cloudSynced: true
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function fetchAllAssignmentsFromFirestore(
  explicitOwnerUid?: string
): Promise<HomeworkAssignment[]> {
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) {
    return [];
  }
  const path = 'homework_assignments';
  try {
    const q = query(collection(db, 'homework_assignments'), where('ownerUid', '==', ownerUid));
    const snap = await withFirestoreReadTimeout(getDocs(q), 5000);
    // Guard against stale async completion after account switch
    if (!explicitOwnerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
      return [];
    }
    const list: HomeworkAssignment[] = [];
    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson) as HomeworkAssignment;
          const docOwnerUid = (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') || (parsed.ownerUid?.trim() || '');
          if (docOwnerUid !== ownerUid) {
            return;
          }
          list.push({
            ...parsed,
            ownerUid,
            ...(typeof data.ownerEmail === 'string' && data.ownerEmail ? { ownerEmail: data.ownerEmail } : {}),
              ...(data.deleted === true || parsed.deleted === true ? { deleted: true, isActive: false, status: 'deleted' } : {}),
            cloudSynced: true
          });
        }
      } catch {
        // Ignore malformed doc
      }
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export function subscribeAssignmentsFromFirestore(
  onUpdate: (assignments: HomeworkAssignment[]) => void,
  explicitOwnerUid?: string
): () => void {
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, 'homework_assignments'), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      if (!explicitOwnerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
        return;
      }
      const list: HomeworkAssignment[] = [];
      snap.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          if (data?.payloadJson) {
            const parsed = JSON.parse(data.payloadJson) as HomeworkAssignment;
            const docOwnerUid = (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') || (parsed.ownerUid?.trim() || '');
            if (docOwnerUid !== ownerUid) {
              return;
            }
            list.push({
              ...parsed,
              ownerUid,
              ...(typeof data.ownerEmail === 'string' && data.ownerEmail ? { ownerEmail: data.ownerEmail } : {}),
              ...(data.deleted === true || parsed.deleted === true ? { deleted: true, isActive: false, status: 'deleted' } : {}),
              cloudSynced: true
            });
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

export async function deleteAssignmentFromFirestore(
  assignmentId: string,
  explicitOwnerUid?: string
): Promise<boolean> {
  if (!assignmentId) return false;
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) return false;
  const safeId = sanitizeDocId(assignmentId);
  const path = `homework_assignments/${safeId}`;

  let firestoreDeleted = false;
  try {
    await executeConfirmedFirestoreWrite(() => deleteDoc(doc(db, 'homework_assignments', safeId)));
    firestoreDeleted = true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }

  let apiDeleted = false;
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid === ownerUid) {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/teacher/assignments?id=${encodeURIComponent(assignmentId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        apiDeleted = data?.success === true && data?.deleted === true;
      }
    } catch {
      // Ignore server API unavailability
    }
  }

  return firestoreDeleted || apiDeleted;
}

export async function deleteSubmissionsForAssignmentFromFirestore(
  assignmentId: string,
  explicitOwnerUid?: string
): Promise<boolean> {
  if (!assignmentId) return false;
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) return false;
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const path = 'homework_submissions';
  try {
    const q = query(
      collection(db, 'homework_submissions'),
      where('assignmentId', '==', safeAssignmentId),
      where('ownerUid', '==', ownerUid)
    );
    const snap = await getDocs(q);
    const deletePromises: Promise<any>[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data?.ownerUid && data.ownerUid !== ownerUid) return;
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
// FIRESTORE STUDENT SUBMISSIONS (LINKED TO PARENT ASSIGNMENT ownerUid)
// ============================================================================
export async function saveSubmissionToFirestore(
  submission: HomeworkSubmission,
  explicitOwnerUid?: string
): Promise<boolean> {
  if (!submission || !submission.id || !submission.assignmentId) return false;
  const safeId = sanitizeDocId(submission.id);
  const safeAssignmentId = sanitizeDocId(submission.assignmentId);
  const path = `homework_submissions/${safeId}`;

  const isCompleted =
    submission.status === 'completed' || (!submission.status && Boolean(submission.completedAt));
  const statusValue = isCompleted ? 'completed' : 'in_progress';
  const nowIso = new Date().toISOString();
  const completedAtValue = isCompleted ? (submission.completedAt || nowIso).slice(0, 60) : '';
  const attemptSecret = submission.attemptSecret?.trim()
    ? submission.attemptSecret.trim().slice(0, 120)
    : undefined;

  let resolvedOwnerUid =
    submission.ownerUid?.trim() ||
    explicitOwnerUid?.trim() ||
    '';

  let apiOk = false;
  try {
    if (typeof fetch === 'function' && typeof window !== 'undefined') {
      const urlToken = new URLSearchParams(window.location.search).get('token')?.trim() || '';
      const urlOwnerUid = new URLSearchParams(window.location.search).get('ou')?.trim() || '';
      if (!resolvedOwnerUid && urlOwnerUid) {
        resolvedOwnerUid = urlOwnerUid;
      }
      const res = await fetch('/api/homework/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...submission,
          id: safeId,
          assignmentId: safeAssignmentId,
          ...(urlToken ? { token: urlToken } : {}),
          ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
          ...(attemptSecret ? { attemptSecret } : {}),
          status: statusValue,
          completedAt: completedAtValue
        })
      }).catch(() => null);

      if (res && res.ok) {
        apiOk = true;
        const data = await res.json().catch(() => null);
        const serverOwnerUid = data?.submission?.ownerUid;
        if (!resolvedOwnerUid && typeof serverOwnerUid === 'string' && serverOwnerUid.trim()) {
          resolvedOwnerUid = serverOwnerUid.trim();
        }
      }
    }
  } catch {
    // Best-effort API sync; continue to Firestore
  }

  try {
    if (!resolvedOwnerUid) {
      const parentHw = await fetchAssignmentFromFirestore(safeAssignmentId).catch(() => null);
      if (parentHw) {
        if (parentHw.isActive === false || parentHw.status === 'closed') {
          return false;
        }
        if (parentHw.ownerUid && parentHw.ownerUid.trim()) {
          resolvedOwnerUid = parentHw.ownerUid.trim();
        } else {
          // V-03: Legacy assignment in Firestore without ownerUid yet; use deterministic legacy sentinel
          resolvedOwnerUid = `legacy_unclaimed_${safeAssignmentId}`;
        }
      } else {
        resolvedOwnerUid = getCurrentHomeworkOwnerUid() || '';
      }
    }

    if (!resolvedOwnerUid) {
      return apiOk;
    }

    const ownerUid = resolvedOwnerUid.slice(0, 128);
    const normalized: HomeworkSubmission = {
      ...submission,
      id: safeId,
      assignmentId: safeAssignmentId,
      ownerUid,
      status: statusValue,
      ...(attemptSecret ? { attemptSecret } : {}),
      completedAt: completedAtValue,
      updatedAt: nowIso,
      cloudSynced: true
    };
    delete normalized.ownerEmail;
    const payloadJson = JSON.stringify(normalized).slice(0, 490000);
    await executeConfirmedFirestoreWrite(
      () =>
        setDoc(doc(db, 'homework_submissions', safeId), {
          id: safeId,
          assignmentId: safeAssignmentId,
          ownerUid,
          studentName: (submission.studentName || 'طالب').slice(0, 140),
          score: Math.max(0, Math.min(100000, Number(submission.score ?? submission.correctAnswersCount) || 0)),
          accuracyPercent: Math.max(
            0,
            Math.min(100, Number(submission.accuracyPercent ?? submission.scorePercentage ?? submission.accuracy) || 0)
          ),
          completedAt: completedAtValue,
          status: statusValue,
          ...(attemptSecret ? { attemptSecret } : {}),
          payloadJson
        }),
      8000,
      1
    );
    return true;
  } catch (error) {
    if (!apiOk) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return apiOk;
  }
}

function mergeSubmissionLists(
  primary: HomeworkSubmission[],
  secondary: HomeworkSubmission[]
): HomeworkSubmission[] {
  const byId = new Map<string, HomeworkSubmission>();
  for (const sub of [...secondary, ...primary]) {
    if (!sub || !sub.id) continue;
    const existing = byId.get(sub.id);
    if (!existing) {
      byId.set(sub.id, sub);
      continue;
    }
    const existingCompleted =
      existing.status === 'completed' || (!existing.status && Boolean(existing.completedAt));
    const subCompleted =
      sub.status === 'completed' || (!sub.status && Boolean(sub.completedAt));
    if (subCompleted && !existingCompleted) {
      byId.set(sub.id, sub);
      continue;
    }
    if (existingCompleted && !subCompleted) {
      continue;
    }
    const existingAnswers = Array.isArray(existing.responses) ? existing.responses.length : 0;
    const subAnswers = Array.isArray(sub.responses) ? sub.responses.length : 0;
    if (subAnswers > existingAnswers) {
      byId.set(sub.id, sub);
      continue;
    }
    const existingTime = new Date(existing.updatedAt || existing.completedAt || existing.startedAt || 0).getTime();
    const subTime = new Date(sub.updatedAt || sub.completedAt || sub.startedAt || 0).getTime();
    if (subTime >= existingTime) {
      byId.set(sub.id, sub);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime() -
      new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime()
  );
}

export async function fetchSubmissionsForAssignmentFromFirestore(
  assignmentId: string,
  explicitOwnerUid?: string
): Promise<HomeworkSubmission[]> {
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const requiredOwnerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || undefined;
  const path = 'homework_submissions';

  let apiList: HomeworkSubmission[] = [];
  if (typeof fetch === 'function' && typeof window !== 'undefined' && auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        const res = await fetch(
          `/api/homework/submissions?assignmentId=${encodeURIComponent(safeAssignmentId)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${idToken}` }
          }
        ).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data?.submissions)) {
            apiList = data.submissions.map((s: HomeworkSubmission) => ({
              ...s,
              ...(requiredOwnerUid ? { ownerUid: requiredOwnerUid } : {}),
              cloudSynced: true
            }));
          }
        }
      }
    } catch {
      // Ignore API fetch error and rely on Firestore
    }
  }

  try {
    const q = requiredOwnerUid
      ? query(
          collection(db, 'homework_submissions'),
          where('assignmentId', '==', safeAssignmentId),
          where('ownerUid', '==', requiredOwnerUid)
        )
      : query(
          collection(db, 'homework_submissions'),
          where('assignmentId', '==', safeAssignmentId)
        );
    const snap = await withFirestoreReadTimeout(getDocs(q), 4000);
    const list: HomeworkSubmission[] = [];
    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson) as HomeworkSubmission;
          const docOwnerUid = (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') || (parsed.ownerUid?.trim() || '');
          if (requiredOwnerUid && docOwnerUid && docOwnerUid !== requiredOwnerUid && docOwnerUid !== `legacy_unclaimed_${safeAssignmentId}`) {
            return;
          }
          list.push({
            ...parsed,
            ...(requiredOwnerUid ? { ownerUid: requiredOwnerUid } : docOwnerUid ? { ownerUid: docOwnerUid } : {}),
            cloudSynced: true
          });
        }
      } catch {
        // Ignore
      }
    });
    return mergeSubmissionLists(list, apiList);
  } catch (error) {
    if (apiList.length > 0) {
      return apiList;
    }
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function fetchAllSubmissionsFromFirestore(
  explicitOwnerUid?: string
): Promise<HomeworkSubmission[]> {
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) {
    return [];
  }
  const path = 'homework_submissions';

  let apiList: HomeworkSubmission[] = [];
  if (typeof fetch === 'function' && typeof window !== 'undefined' && auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        const res = await fetch('/api/homework/submissions', {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` }
        }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data?.submissions)) {
            apiList = data.submissions
              .filter((s: HomeworkSubmission) => !s.ownerUid || s.ownerUid === ownerUid)
              .map((s: HomeworkSubmission) => ({
                ...s,
                ownerUid,
                cloudSynced: true
              }));
          }
        }
      }
    } catch {
      // Ignore API fetch error
    }
  }

  try {
    const q = query(collection(db, 'homework_submissions'), where('ownerUid', '==', ownerUid));
    const snap = await withFirestoreReadTimeout(getDocs(q), 5000);
    if (!explicitOwnerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
      return [];
    }
    const list: HomeworkSubmission[] = [];
    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson) as HomeworkSubmission;
          const docOwnerUid = (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') || (parsed.ownerUid?.trim() || '');
          if (docOwnerUid !== ownerUid) {
            return;
          }
          list.push({
            ...parsed,
            ownerUid,
            cloudSynced: true
          });
        }
      } catch {
        // Ignore
      }
    });
    return mergeSubmissionLists(list, apiList);
  } catch (error) {
    if (apiList.length > 0) {
      return apiList;
    }
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export function subscribeSubmissionsFromFirestore(
  assignmentId: string | null,
  onUpdate: (submissions: HomeworkSubmission[]) => void,
  explicitOwnerUid?: string
): () => void {
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) {
    onUpdate([]);
    return () => {};
  }

  const q = assignmentId
    ? query(
        collection(db, 'homework_submissions'),
        where('assignmentId', '==', sanitizeDocId(assignmentId)),
        where('ownerUid', '==', ownerUid)
      )
    : query(collection(db, 'homework_submissions'), where('ownerUid', '==', ownerUid));

  return onSnapshot(
    q,
    (snap) => {
      if (!explicitOwnerUid && ownerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
        return;
      }
      const list: HomeworkSubmission[] = [];
      snap.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          if (data?.payloadJson) {
            const parsed = JSON.parse(data.payloadJson) as HomeworkSubmission;
            const docOwnerUid = (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') || (parsed.ownerUid?.trim() || '');
            if (ownerUid && docOwnerUid !== ownerUid) {
              return;
            }
            list.push({
              ...parsed,
              ...(docOwnerUid ? { ownerUid: docOwnerUid } : {}),
              cloudSynced: true
            });
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
// FIRESTORE LERNSTUDIO SETS SYNC (Shared Library Across Authenticated Teachers)
// ============================================================================
export async function saveLernstudioSetToFirestore(setItem: LernstudioSet): Promise<boolean> {
  if (!setItem || !setItem.id) return false;
  const ownerUid = getCurrentHomeworkOwnerUid() || auth.currentUser?.uid || '';
  if (!ownerUid) return false;
  const safeId = sanitizeDocId(setItem.id);
  const path = `lernstudio_sets/${safeId}`;
  try {
    const cleanSet: any = {
      ...setItem,
      id: safeId,
      ...(setItem.createdByUid || ownerUid ? { createdByUid: setItem.createdByUid || ownerUid } : {})
    };
    delete cleanSet.ownerUid;
    delete cleanSet.ownerEmail;
    const payloadJson = JSON.stringify(cleanSet).slice(0, 490000);
    await executeConfirmedFirestoreWrite(() =>
      setDoc(doc(db, 'lernstudio_sets', safeId), {
        id: safeId,
        title: (setItem.title || 'Set').slice(0, 290),
        category: ((setItem as any).category || (setItem as any).topic || 'general').slice(0, 95),
        payloadJson,
        updatedAtIso: new Date().toISOString()
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
  const ownerUid = getCurrentHomeworkOwnerUid() || auth.currentUser?.uid || '';
  if (!ownerUid) return false;
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
  onUpdate: (sets: LernstudioSet[]) => void,
  explicitOwnerUid?: string
): () => void {
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || auth.currentUser?.uid || '';
  if (!ownerUid) {
    onUpdate([]);
    return () => {};
  }
  const q = collection(db, 'lernstudio_sets');
  return onSnapshot(
    q,
    (snap) => {
      const list: LernstudioSet[] = [];
      snap.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          if (data?.deleted === true) return;
          if (data?.payloadJson) {
            const parsed = JSON.parse(data.payloadJson);
            if (parsed && !parsed.deleted) {
              list.push(parsed);
            }
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

