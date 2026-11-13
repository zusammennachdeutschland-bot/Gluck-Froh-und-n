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
  indexedDBLocalPersistence,
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
  getDocsFromServer,
  setLogLevel
} from 'firebase/firestore';
import {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkShortLinkResolutionResult
} from './homeworkTypes';
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
      {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true
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
async function checkFirestoreRestReachable(): Promise<'ok' | 'config_error' | 'network_error'> {
  if (typeof fetch !== 'function') return 'network_error';
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_CONFIG.projectId
    )}/databases/${encodeURIComponent(
      FIREBASE_CONFIG.firestoreDatabaseId
    )}/documents/test/connection?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller?.signal
      });
      if (res.status === 200 || res.status === 404) {
        return 'ok';
      }
      if (res.status === 400 || res.status === 403) {
        return 'config_error';
      }
      return 'network_error';
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return 'network_error';
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    const isOfflineErr = error instanceof Error && error.message.includes('the client is offline');
    if (isOfflineErr) {
      // Transient WebChannel/proxy warm-up can surface "client is offline" right on boot;
      // verify against the Firestore REST endpoint and retry once before flagging config.
      const restStatus = await checkFirestoreRestReachable();
      if (restStatus === 'ok') {
        return true;
      }
      if (restStatus === 'config_error') {
        console.error('Please check your Firebase configuration.');
        return false;
      }
      // Network error (e.g. sandbox offline or transient disconnect): retry once after brief delay
      await new Promise((r) => setTimeout(r, 800));
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        return true;
      } catch (retryErr) {
        if (
          typeof navigator !== 'undefined' &&
          navigator.onLine !== false &&
          retryErr instanceof Error &&
          retryErr.message.includes('the client is offline')
        ) {
          const restRetry = await checkFirestoreRestReachable();
          if (restRetry === 'ok') return true;
          if (restRetry === 'config_error') {
            console.error('Please check your Firebase configuration.');
          }
        }
        return false;
      }
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
    const saved = localStorage.getItem(VERCEL_DOMAIN_STORAGE_KEY);
    if (
      saved &&
      saved.trim().startsWith('http') &&
      !saved.includes('gluck-froh-und-n-ex3u.vercel.app') &&
      !saved.includes('gluck-froh-und-n-br5l.vercel.app')
    ) {
      return saved.trim().replace(/\/+$/, '');
    }

    let hostname = (window.location?.hostname || '').toLowerCase();
    let protocol = window.location?.protocol || '';
    if ((!hostname || !protocol) && window.location?.origin) {
      try {
        const parsed = new URL(window.location.origin);
        hostname = parsed.hostname.toLowerCase();
        protocol = parsed.protocol;
      } catch {
        // Ignore URL parse error
      }
    }

    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local');

    if (
      !isAndroidNativePlatform() &&
      (protocol === 'https:' || protocol === 'http:') &&
      hostname &&
      !isLocalhost &&
      window.location?.origin
    ) {
      return window.location.origin.replace(/\/+$/, '');
    }

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

// Initialize durable IndexedDB persistence (with localStorage fallback) AFTER initial auth hydration
// so legacy localStorage sessions migrate cleanly without premature logout
if (typeof window !== 'undefined') {
  const readyPromise =
    typeof (auth as any).authStateReady === 'function'
      ? Promise.resolve((auth as any).authStateReady()).catch(() => {})
      : Promise.resolve();
  readyPromise.then(() => {
    setPersistence(auth, indexedDBLocalPersistence).catch(() => {
      setPersistence(auth, browserLocalPersistence).catch(() => {
        setPersistence(auth, browserSessionPersistence).catch(() => {
          setPersistence(auth, inMemoryPersistence).catch(() => {});
        });
      });
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

  // 2. WEB & ELECTRON DESKTOP: Prefer durable IndexedDB persistence (fallback to localStorage)
  try {
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // Ignore persistence fallback errors
    }
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

function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return unescape(encodeURIComponent(str)).length;
}

function stripHeavyMediaFromItems(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    if (typeof copy.imageUrl === 'string' && (copy.imageUrl.startsWith('data:') || copy.imageUrl.length > 500)) {
      delete copy.imageUrl;
    }
    if (typeof copy.audioUrl === 'string' && (copy.audioUrl.startsWith('data:') || copy.audioUrl.length > 500)) {
      delete copy.audioUrl;
    }
    if (typeof copy.image === 'string' && (copy.image.startsWith('data:') || copy.image.length > 500)) {
      delete copy.image;
    }
    if (copy.verbEntry && copy.verbId) {
      delete copy.verbEntry;
    }
    return copy;
  });
}

export function serializeSafeFirestorePayload(record: any, maxUtf8Bytes = 440000): string {
  const initialJson = JSON.stringify(record);
  if (getUtf8ByteLength(initialJson) <= maxUtf8Bytes) {
    return initialJson;
  }

  // Stage 1: Strip inline base64 data URLs and redundant verbEntry/verbEntriesSnapshot duplicates
  const clone: any = { ...record };
  delete clone.verbEntriesSnapshot;
  if (clone.setSnapshot && typeof clone.setSnapshot === 'object') {
    const snapCopy = { ...clone.setSnapshot };
    delete snapCopy.verbEntriesSnapshot;
    if (Array.isArray(snapCopy.items)) {
      snapCopy.items = stripHeavyMediaFromItems(snapCopy.items);
    }
    clone.setSnapshot = snapCopy;
  }
  if (Array.isArray(clone.items)) {
    clone.items = stripHeavyMediaFromItems(clone.items);
  }
  const strippedJson = JSON.stringify(clone);
  if (getUtf8ByteLength(strippedJson) <= maxUtf8Bytes) {
    return strippedJson;
  }

  // Stage 2: If still oversized (e.g. huge custom items list, large verb group, or responses), compact further
  if (clone.setKind === 'verb_group' && Array.isArray(clone.verbIds) && clone.verbIds.length > 0 && Array.isArray(clone.items)) {
    clone.items = clone.items.slice(0, 120).map((it: any) => ({
      id: it.id,
      verbId: it.verbId || it.id,
      german: it.german,
      arabic: it.arabic,
      wordType: 'verb'
    }));
  }
  if (
    clone.setSnapshot &&
    Array.isArray(clone.setSnapshot.items) &&
    Array.isArray(clone.selectedItemIds) &&
    clone.selectedItemIds.length > 0
  ) {
    const selectedSet = new Set(clone.selectedItemIds);
    const filtered = clone.setSnapshot.items.filter((it: any) => it && selectedSet.has(it.id));
    if (filtered.length > 0) {
      clone.setSnapshot = {
        ...clone.setSnapshot,
        items: filtered
      };
    }
  }
  if (Array.isArray(clone.responses) && clone.responses.length > 150) {
    clone.responses = clone.responses.slice(0, 150);
  }
  return JSON.stringify(clone);
}

async function writeFirestoreDocViaRest(
  collectionName: string,
  docId: string,
  fieldsObj: Record<string, string | number | boolean | undefined>,
  idToken?: string | null
): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  try {
    const firestoreFields: Record<string, any> = {};
    for (const [key, val] of Object.entries(fieldsObj)) {
      if (val === undefined) continue;
      if (typeof val === 'string') {
        firestoreFields[key] = { stringValue: val };
      } else if (typeof val === 'boolean') {
        firestoreFields[key] = { booleanValue: val };
      } else if (typeof val === 'number' && Number.isFinite(val)) {
        firestoreFields[key] = Number.isInteger(val)
          ? { integerValue: String(val) }
          : { doubleValue: val };
      }
    }
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_CONFIG.projectId
    )}/databases/${encodeURIComponent(
      FIREBASE_CONFIG.firestoreDatabaseId
    )}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(
      docId
    )}?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: firestoreFields })
    });
    return res.ok;
  } catch {
    return false;
  }
}

function parseFirestoreRestFields(rawFields: Record<string, any> | undefined | null): Record<string, any> | null {
  if (!rawFields || typeof rawFields !== 'object') return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries<any>(rawFields)) {
    if (v && typeof v === 'object') {
      if ('stringValue' in v) out[k] = v.stringValue;
      else if ('booleanValue' in v) out[k] = Boolean(v.booleanValue);
      else if ('integerValue' in v) out[k] = Number(v.integerValue);
      else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
    }
  }
  return out;
}

export type RestDocStatusResult =
  | { status: 'found'; data: Record<string, any> }
  | { status: 'not_found' }
  | { status: 'error' };

async function readFirestoreDocStatusViaRest(
  collectionName: string,
  docId: string,
  idToken?: string | null
): Promise<RestDocStatusResult> {
  if (typeof fetch !== 'function') return { status: 'error' };
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_CONFIG.projectId
    )}/databases/${encodeURIComponent(
      FIREBASE_CONFIG.firestoreDatabaseId
    )}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(
      docId
    )}?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;

    const headers: Record<string, string> = {};
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
    const res = await fetch(url, { method: 'GET', headers, signal: controller?.signal });
    if (res.status === 404) {
      return { status: 'not_found' };
    }
    if (!res.ok) return { status: 'error' };
    const raw = await res.json().catch(() => null);
    const parsed = parseFirestoreRestFields(raw?.fields);
    if (!parsed) return { status: 'error' };
    return { status: 'found', data: parsed };
  } catch {
    return { status: 'error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readFirestoreDocViaRest(
  collectionName: string,
  docId: string,
  idToken?: string | null
): Promise<Record<string, any> | null> {
  const res = await readFirestoreDocStatusViaRest(collectionName, docId, idToken);
  return res.status === 'found' ? res.data : null;
}

async function queryAssignmentsViaRest(
  ownerUid: string,
  idToken?: string | null
): Promise<{ ok: boolean; items: HomeworkAssignment[] }> {
  if (typeof fetch !== 'function' || !ownerUid) {
    return { ok: false, items: [] };
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_CONFIG.projectId
    )}/databases/${encodeURIComponent(
      FIREBASE_CONFIG.firestoreDatabaseId
    )}/documents:runQuery?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller?.signal,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'homework_assignments' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'ownerUid' },
              op: 'EQUAL',
              value: { stringValue: ownerUid }
            }
          }
        }
      })
    });

    if (!res.ok) {
      return { ok: false, items: [] };
    }
    const rows = await res.json().catch(() => null);
    if (!Array.isArray(rows)) {
      return { ok: false, items: [] };
    }

    const items: HomeworkAssignment[] = [];
    for (const row of rows) {
      const fields = parseFirestoreRestFields(row?.document?.fields);
      if (!fields?.payloadJson) continue;
      try {
        const parsed = JSON.parse(fields.payloadJson) as HomeworkAssignment;
        const docOwnerUid =
          (typeof fields.ownerUid === 'string' ? fields.ownerUid.trim() : '') ||
          (parsed.ownerUid?.trim() || '');
        if (docOwnerUid !== ownerUid) continue;
        items.push({
          ...parsed,
          ownerUid,
          ...(typeof fields.ownerEmail === 'string' && fields.ownerEmail
            ? { ownerEmail: fields.ownerEmail }
            : {}),
          ...(typeof fields.isActive === 'boolean' ? { isActive: fields.isActive } : {}),
          ...(fields.deleted === true || (parsed as any).deleted === true
            ? { deleted: true, isActive: false, status: 'deleted' }
            : {}),
          cloudSynced: true
        });
      } catch {
        // Ignore malformed payloadJson
      }
    }
    return { ok: true, items };
  } catch {
    return { ok: false, items: [] };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sanitizeShortLinkAssignmentSnapshot(hw: HomeworkAssignment, ownerUid: string): HomeworkAssignment {
  const copy: any = {
    ...hw,
    ownerUid
  };
  delete copy.ownerEmail;
  delete copy.cloudCreatePending;
  if (copy.setSnapshot && typeof copy.setSnapshot === 'object') {
    const cleanSnap = { ...copy.setSnapshot };
    delete cleanSnap.ownerEmail;
    if (Array.isArray(cleanSnap.customExercises)) {
      cleanSnap.customExercises = cleanSnap.customExercises.map((ex: any) => {
        if (!ex || typeof ex !== 'object') return ex;
        const cleanEx = { ...ex };
        delete cleanEx.correctAnswer;
        delete cleanEx.explanation;
        delete cleanEx.teacherNotes;
        delete cleanEx.answerKey;
        return cleanEx;
      });
    }
    copy.setSnapshot = cleanSnap;
  }
  if (Array.isArray(copy.assignedStudents)) {
    copy.assignedStudents = copy.assignedStudents.map((st: any) => ({
      id: String(st?.id || ''),
      name: String(st?.name || ''),
      ...(st?.groupId || copy.groupId ? { groupId: String(st?.groupId || copy.groupId || '') } : {})
    }));
  }
  return copy as HomeworkAssignment;
}

export async function saveShortLinkToFirestore(
  assignment: HomeworkAssignment,
  explicitOwnerUid?: string
): Promise<{ saved: boolean; collision?: boolean }> {
  const cleanShortId = (assignment?.shortId || '').trim();
  if (!cleanShortId || !/^[A-Za-z0-9]{6,10}$/.test(cleanShortId) || !assignment?.id) {
    return { saved: false };
  }
  const rawOwnerUid = explicitOwnerUid?.trim() || assignment.ownerUid?.trim() || getCurrentHomeworkOwnerUid() || '';
  if (!rawOwnerUid) {
    return { saved: false };
  }
  const ownerUid = rawOwnerUid.slice(0, 128);
  const safeAssignmentId = sanitizeDocId(assignment.id);
  const isActive =
    assignment.isActive !== false &&
    (assignment as any).deleted !== true &&
    assignment.status !== 'closed' &&
    assignment.status !== 'deleted';
  const nowIso = new Date().toISOString().slice(0, 60);
  const createdAt = (assignment.createdAt || nowIso).slice(0, 60);
  const shareToken = assignment.shareToken?.trim() ? assignment.shareToken.trim().slice(0, 128) : undefined;

  // Collision check: ensure shortId does not already belong to a different assignment
  try {
    const existingSnap = await withFirestoreReadTimeout(
      getDoc(doc(db, 'homework_short_links', cleanShortId)),
      3500
    ).catch(() => null);
    if (existingSnap && existingSnap.exists() && !existingSnap.metadata?.hasPendingWrites) {
      const existingData = existingSnap.data() || {};
      const existingHwId = String(existingData.assignmentId || '').trim();
      const existingOwner = String(existingData.ownerUid || '').trim();
      if (
        (existingHwId && existingHwId !== safeAssignmentId && existingHwId !== assignment.id) ||
        (existingOwner && existingOwner !== ownerUid)
      ) {
        return { saved: false, collision: true };
      }
    }
  } catch {
    // Ignore read check timeout and let Firestore security rules enforce collision prevention
  }

  const publicSafeSnapshot = sanitizeShortLinkAssignmentSnapshot(
    {
      ...assignment,
      id: safeAssignmentId,
      shortId: cleanShortId,
      ownerUid,
      isActive,
      createdAt
    },
    ownerUid
  );
  const payloadJson = isActive
    ? serializeSafeFirestorePayload(publicSafeSnapshot, 440000)
    : JSON.stringify({ revoked: true, deleted: Boolean((assignment as any).deleted) });

  const shortDocPayload: Record<string, any> = {
    shortId: cleanShortId,
    assignmentId: safeAssignmentId,
    ownerUid,
    ...(shareToken ? { shareToken } : {}),
    isActive,
    ...((assignment as any).deleted === true ? { deleted: true } : {}),
    createdAt,
    updatedAt: nowIso,
    payloadJson
  };

  try {
    await executeConfirmedFirestoreWrite(
      () => setDoc(doc(db, 'homework_short_links', cleanShortId), shortDocPayload),
      8000,
      1
    );
    return { saved: true };
  } catch (error) {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === ownerUid) {
      const token = await currentUser.getIdToken().catch(() => null);
      if (token) {
        const restOk = await writeFirestoreDocViaRest(
          'homework_short_links',
          cleanShortId,
          shortDocPayload,
          token
        );
        if (restOk) {
          return { saved: true };
        }
      }
    }
    handleFirestoreError(error, OperationType.WRITE, `homework_short_links/${cleanShortId}`);
    return { saved: false };
  }
}

export async function revokeShortLinkInFirestore(
  shortId: string,
  assignmentId: string,
  explicitOwnerUid?: string
): Promise<boolean> {
  const cleanShortId = (shortId || '').trim();
  if (!cleanShortId || !/^[A-Za-z0-9]{6,10}$/.test(cleanShortId)) return false;
  const ownerUid = (explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || '').slice(0, 128);
  if (!ownerUid) return false;
  const safeAssignmentId = sanitizeDocId(assignmentId || 'hw_deleted');
  const nowIso = new Date().toISOString().slice(0, 60);
  const tombstonePayload: Record<string, any> = {
    shortId: cleanShortId,
    assignmentId: safeAssignmentId,
    ownerUid,
    isActive: false,
    deleted: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    payloadJson: JSON.stringify({ revoked: true, deleted: true })
  };

  let revoked = false;
  try {
    await executeConfirmedFirestoreWrite(
      () => setDoc(doc(db, 'homework_short_links', cleanShortId), tombstonePayload),
      6000,
      1
    );
    revoked = true;
  } catch {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === ownerUid) {
      const token = await currentUser.getIdToken().catch(() => null);
      if (token) {
        revoked = await writeFirestoreDocViaRest(
          'homework_short_links',
          cleanShortId,
          tombstonePayload,
          token
        );
      }
    }
  }
  return revoked;
}

export async function fetchShortLinkFromFirestore(
  shortId: string
): Promise<HomeworkShortLinkResolutionResult> {
  const cleanShortId = (shortId || '').trim();
  if (!cleanShortId || !/^[A-Za-z0-9]{6,10}$/.test(cleanShortId)) {
    return {
      status: 'invalid_id',
      shortId: cleanShortId,
      errorMessageAr: 'رمز رابط الواجب المختصر غير صالح.'
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      status: 'network_error',
      shortId: cleanShortId,
      errorMessageAr: 'لا يوجد اتصال بالإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مرة أخرى.'
    };
  }

  let rawData: Record<string, any> | null = null;
  let sdkRespondedNotFound = false;
  let hadNetworkError = false;

  try {
    const snap = await withFirestoreReadTimeout(
      getDoc(doc(db, 'homework_short_links', cleanShortId)),
      4500
    );
    if (snap.exists() && !snap.metadata?.hasPendingWrites) {
      rawData = snap.data() || null;
    } else if (!snap.exists()) {
      sdkRespondedNotFound = true;
    }
  } catch {
    hadNetworkError = true;
  }

  if (!rawData) {
    const restData = await readFirestoreDocViaRest('homework_short_links', cleanShortId);
    if (restData) {
      rawData = restData;
      hadNetworkError = false;
    }
  }

  if (!rawData) {
    if (hadNetworkError && !sdkRespondedNotFound) {
      return {
        status: 'network_error',
        shortId: cleanShortId,
        errorMessageAr: 'تعذر الاتصال بالسحابة لتحميل الواجب. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.'
      };
    }
    return {
      status: 'not_found',
      shortId: cleanShortId,
      errorMessageAr: 'رابط الواجب غير موجود أو منتهي الصلاحية.'
    };
  }

  const targetAssignmentId = typeof rawData.assignmentId === 'string' ? rawData.assignmentId.trim() : undefined;
  if (rawData.deleted === true || rawData.isActive === false) {
    return {
      status: 'revoked',
      shortId: cleanShortId,
      assignmentId: targetAssignmentId,
      errorMessageAr: 'هذا الواجب تم حذفه أو إيقاف رابطه من قِبل المعلم.'
    };
  }

  if (typeof rawData.payloadJson === 'string' && rawData.payloadJson.trim()) {
    try {
      const parsed = JSON.parse(rawData.payloadJson);
      if (
        parsed?.revoked === true ||
        parsed?.deleted === true ||
        parsed?.isActive === false ||
        parsed?.status === 'closed' ||
        parsed?.status === 'deleted'
      ) {
        return {
          status: 'revoked',
          shortId: cleanShortId,
          assignmentId: targetAssignmentId || parsed?.id,
          errorMessageAr: 'هذا الواجب تم حذفه أو إيقاف رابطه من قِبل المعلم.'
        };
      }
      if (parsed && (parsed.id || targetAssignmentId) && parsed.setSnapshot) {
        const docOwnerUid =
          (typeof rawData.ownerUid === 'string' && rawData.ownerUid.trim()) ||
          (typeof parsed.ownerUid === 'string' && parsed.ownerUid.trim()) ||
          undefined;
        const docShareToken =
          (typeof rawData.shareToken === 'string' && rawData.shareToken.trim()) ||
          (typeof parsed.shareToken === 'string' && parsed.shareToken.trim()) ||
          undefined;
        const resolvedAssignment: HomeworkAssignment = {
          ...parsed,
          id: String(parsed.id || targetAssignmentId),
          shortId: cleanShortId,
          ...(docOwnerUid ? { ownerUid: docOwnerUid } : {}),
          ...(docShareToken ? { shareToken: docShareToken } : {}),
          isActive: true,
          cloudSynced: true
        };
        delete resolvedAssignment.ownerEmail;
        return {
          status: 'resolved',
          shortId: cleanShortId,
          assignmentId: resolvedAssignment.id,
          assignment: resolvedAssignment
        };
      }
    } catch {
      // Fall through to not_found if payloadJson is corrupted
    }
  }

  return {
    status: 'not_found',
    shortId: cleanShortId,
    assignmentId: targetAssignmentId,
    errorMessageAr: 'بيانات هذا الواجب غير مكتملة أو لم تعد متاحة.'
  };
}

export async function saveAssignmentToFirestore(
  assignment: HomeworkAssignment,
  explicitOwnerUid?: string
): Promise<boolean> {
  if (!assignment || !assignment.id) return false;
  if (
    testHomeworkAuthUser === undefined &&
    !auth.currentUser &&
    typeof (auth as any).authStateReady === 'function'
  ) {
    try {
      await Promise.race([
        (auth as any).authStateReady(),
        new Promise((r) => setTimeout(r, 2500))
      ]);
    } catch {
      // Ignore auth readiness timeout
    }
  }
  const rawOwnerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  const recordOwnerUid = assignment.ownerUid?.trim() || '';
  if (!rawOwnerUid || (recordOwnerUid && recordOwnerUid !== rawOwnerUid)) return false;

  const ownerUid = rawOwnerUid.slice(0, 128);
  const safeId = sanitizeDocId(assignment.id);
  const path = `homework_assignments/${safeId}`;
  const isActive = assignment.isActive !== false && (assignment as any).deleted !== true && assignment.status !== 'closed';
  const createdAt = (assignment.createdAt || new Date().toISOString()).slice(0, 60);
  // Slice to 120 chars so multi-byte Arabic UTF-8 strings never exceed 300 bytes in firestore.rules
  const title = (assignment.title || 'واجب منزلي').slice(0, 120);
  const shareToken = assignment.shareToken?.trim() ? assignment.shareToken.trim().slice(0, 128) : undefined;
  const cleanShortId =
    assignment.shortId && /^[A-Za-z0-9]{6,10}$/.test(assignment.shortId.trim())
      ? assignment.shortId.trim()
      : undefined;

  const normalized: HomeworkAssignment = {
    ...assignment,
    id: safeId,
    ...(cleanShortId ? { shortId: cleanShortId } : {}),
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

  const payloadJson = serializeSafeFirestorePayload(normalized, 440000);
  const docPayload = {
    id: safeId,
    ownerUid,
    title,
    createdAt,
    isActive,
    payloadJson
  };

  let firestoreSaved = false;
  try {
    await executeConfirmedFirestoreWrite(
      () => setDoc(doc(db, 'homework_assignments', safeId), docPayload),
      6000,
      1
    );
    firestoreSaved = true;
  } catch (error) {
    // Fallback to direct HTTPS Firestore REST API with the teacher's ID token
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === ownerUid) {
      const token = await currentUser.getIdToken().catch(() => null);
      if (token) {
        firestoreSaved = await writeFirestoreDocViaRest(
          'homework_assignments',
          safeId,
          docPayload,
          token
        );
      }
    }
    if (!firestoreSaved) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  let shortLinkSaved = true;
  if (cleanShortId) {
    const shortRes = await saveShortLinkToFirestore(normalized, ownerUid);
    if (shortRes.collision) {
      const collisionErr: any = new Error('SHORT_ID_COLLISION');
      collisionErr.code = 'SHORT_ID_COLLISION';
      throw collisionErr;
    }
    shortLinkSaved = shortRes.saved;
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
      } else if (response.status === 409) {
        const collisionErr: any = new Error('SHORT_ID_COLLISION');
        collisionErr.code = 'SHORT_ID_COLLISION';
        throw collisionErr;
      }
    } catch (err: any) {
      if (err?.code === 'SHORT_ID_COLLISION') {
        throw err;
      }
      // Ignore server API unavailability (e.g. Android APK or unconfigured Admin SDK)
    }
  }

  return (firestoreSaved && shortLinkSaved) || apiSaved;
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

let lastAssignmentsFetchAuthoritative = false;

export function wasLastAssignmentsFetchAuthoritative(): boolean {
  return lastAssignmentsFetchAuthoritative;
}

export type CloudAssignmentPresenceStatus =
  | 'exists_active'
  | 'deleted_or_revoked'
  | 'not_found'
  | 'uncertain';

function parseAssignmentDocData(
  data: Record<string, any> | null | undefined,
  requiredOwnerUid?: string
): HomeworkAssignment | null {
  if (!data?.payloadJson) return null;
  try {
    const parsed = JSON.parse(data.payloadJson) as HomeworkAssignment;
    const docOwnerUid =
      (typeof data.ownerUid === 'string' && data.ownerUid.trim()) ||
      parsed.ownerUid?.trim() ||
      undefined;
    const docOwnerEmail =
      (typeof data.ownerEmail === 'string' && data.ownerEmail.trim()) ||
      parsed.ownerEmail?.trim() ||
      undefined;
    if (requiredOwnerUid && docOwnerUid !== requiredOwnerUid.trim()) {
      return null;
    }
    const isDeleted = data.deleted === true || (parsed as any).deleted === true || parsed.status === 'deleted';
    return {
      ...parsed,
      ...(docOwnerUid ? { ownerUid: docOwnerUid } : {}),
      ...(docOwnerEmail ? { ownerEmail: docOwnerEmail } : {}),
      isActive: isDeleted
        ? false
        : typeof data.isActive === 'boolean'
        ? data.isActive
        : parsed.isActive !== false,
      ...(isDeleted ? { deleted: true, status: 'deleted' } : {}),
      cloudSynced: true
    };
  } catch {
    return null;
  }
}

export async function fetchAssignmentFromFirestore(
  assignmentId: string,
  options?: { requireOwnerUid?: string }
): Promise<HomeworkAssignment | null> {
  const safeId = sanitizeDocId(assignmentId);
  const path = `homework_assignments/${safeId}`;
  const docRef = doc(db, 'homework_assignments', safeId);

  let sdkNeedsRestFallback = false;
  try {
    let snap;
    try {
      snap = await withFirestoreReadTimeout(getDocFromServer(docRef), 4000);
    } catch {
      snap = await withFirestoreReadTimeout(getDoc(docRef), 4000);
    }
    if (snap.exists() && !snap.metadata?.hasPendingWrites && !snap.metadata?.fromCache) {
      return parseAssignmentDocData(snap.data(), options?.requireOwnerUid);
    }
    if (!snap.exists() && !snap.metadata?.fromCache && !snap.metadata?.hasPendingWrites) {
      return null;
    }
    sdkNeedsRestFallback = true;
  } catch (error) {
    sdkNeedsRestFallback = true;
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (sdkNeedsRestFallback) {
    const currentUser = auth.currentUser;
    const idToken = currentUser ? await currentUser.getIdToken().catch(() => null) : null;
    const restRes = await readFirestoreDocStatusViaRest('homework_assignments', safeId, idToken);
    if (restRes.status === 'found') {
      return parseAssignmentDocData(restRes.data, options?.requireOwnerUid);
    }
  }
  return null;
}

export async function verifyAssignmentPresenceInCloud(
  assignmentId: string,
  explicitOwnerUid?: string,
  shortIdHint?: string
): Promise<CloudAssignmentPresenceStatus> {
  if (!assignmentId) return 'uncertain';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'uncertain';
  }
  const safeId = sanitizeDocId(assignmentId);
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || undefined;
  const docRef = doc(db, 'homework_assignments', safeId);

  let serverNotFoundConfirmed = false;

  try {
    const snap = await withFirestoreReadTimeout(getDocFromServer(docRef), 4500);
    if (!snap.metadata?.fromCache && !snap.metadata?.hasPendingWrites) {
      if (snap.exists()) {
        const data = snap.data() || {};
        const parsed = parseAssignmentDocData(data, ownerUid);
        if (data.deleted === true || (parsed as any)?.deleted === true) {
          return 'deleted_or_revoked';
        }
        return 'exists_active';
      } else {
        serverNotFoundConfirmed = true;
      }
    }
  } catch {
    // Fall back to direct REST check below
  }

  const currentUser = auth.currentUser;
  const idToken =
    currentUser && (!ownerUid || currentUser.uid === ownerUid)
      ? await currentUser.getIdToken().catch(() => null)
      : null;

  const restRes = await readFirestoreDocStatusViaRest('homework_assignments', safeId, idToken);
  if (restRes.status === 'found') {
    const parsed = parseAssignmentDocData(restRes.data, ownerUid);
    if (restRes.data.deleted === true || (parsed as any)?.deleted === true) {
      return 'deleted_or_revoked';
    }
    return 'exists_active';
  }
  if (restRes.status === 'not_found') {
    serverNotFoundConfirmed = true;
  }

  if (serverNotFoundConfirmed) {
    const cleanShortId = (shortIdHint || '').trim();
    if (cleanShortId && /^[A-Za-z0-9]{6,10}$/.test(cleanShortId)) {
      const shortRes = await readFirestoreDocStatusViaRest('homework_short_links', cleanShortId, idToken);
      if (shortRes.status === 'found') {
        if (shortRes.data.deleted === true || shortRes.data.isActive === false) {
          return 'deleted_or_revoked';
        }
      }
    }
    return 'not_found';
  }

  return 'uncertain';
}

export async function fetchAllAssignmentsFromFirestore(
  explicitOwnerUid?: string
): Promise<HomeworkAssignment[]> {
  lastAssignmentsFetchAuthoritative = false;
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) {
    return [];
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Offline: cannot fetch authoritative homework assignments.');
  }

  const path = 'homework_assignments';
  const q = query(collection(db, 'homework_assignments'), where('ownerUid', '==', ownerUid));

  const sdkList: HomeworkAssignment[] = [];
  let sdkSucceeded = false;
  let sdkIsFromCache = false;
  let sdkHasPendingWrites = false;
  let sdkError: unknown = null;

  try {
    let snap;
    try {
      snap = await withFirestoreReadTimeout(getDocsFromServer(q), 5000);
    } catch {
      snap = await withFirestoreReadTimeout(getDocs(q), 5000);
    }
    if (!explicitOwnerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
      return [];
    }
    sdkSucceeded = true;
    sdkIsFromCache = Boolean(snap.metadata?.fromCache);
    snap.forEach((docSnap) => {
      try {
        if (docSnap.metadata?.hasPendingWrites) {
          sdkHasPendingWrites = true;
          return;
        }
        const parsed = parseAssignmentDocData(docSnap.data(), ownerUid);
        if (parsed) {
          sdkList.push(parsed);
        }
      } catch {
        // Ignore malformed doc
      }
    });
  } catch (error) {
    sdkError = error;
    handleFirestoreError(error, OperationType.LIST, path);
  }

  let restOk = false;
  let restList: HomeworkAssignment[] = [];
  let apiOk = false;
  let apiList: HomeworkAssignment[] = [];

  const needsServerCrossCheck =
    !sdkSucceeded || sdkIsFromCache || sdkHasPendingWrites || sdkList.length === 0;

  if (needsServerCrossCheck) {
    const currentUser = auth.currentUser;
    const idToken =
      currentUser && currentUser.uid === ownerUid
        ? await currentUser.getIdToken().catch(() => null)
        : null;

    if (idToken) {
      const restRes = await queryAssignmentsViaRest(ownerUid, idToken);
      restOk = restRes.ok;
      restList = restRes.items;
    }

    if (!restOk && idToken && typeof fetch === 'function' && typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/teacher/assignments', {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
          credentials: 'include'
        }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data?.assignments)) {
            apiOk = true;
            apiList = data.assignments
              .filter((a: HomeworkAssignment) => !a.ownerUid || a.ownerUid === ownerUid)
              .map((a: HomeworkAssignment) => ({
                ...a,
                ownerUid,
                cloudSynced: true
              }));
          }
        }
      } catch {
        // Ignore server API unavailability (e.g. Capacitor Android APK)
      }
    }
  }

  if (!explicitOwnerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
    return [];
  }

  const sdkAuthoritative = sdkSucceeded && !sdkIsFromCache && !sdkHasPendingWrites;
  const serverConfirmed = sdkAuthoritative || restOk || apiOk;

  if (!serverConfirmed) {
    throw (
      (sdkError instanceof Error ? sdkError : null) ||
      new Error('Unable to verify authoritative assignment list from Firestore server.')
    );
  }

  lastAssignmentsFetchAuthoritative = true;

  // Merge confirmed server results so any doc present in REST, API, or clean SDK snapshot is preserved
  const mergedById = new Map<string, HomeworkAssignment>();
  const ingest = (items: HomeworkAssignment[]) => {
    for (const item of items) {
      if (!item || !item.id) continue;
      mergedById.set(sanitizeDocId(item.id), item);
    }
  };
  if (sdkAuthoritative || (!restOk && !apiOk)) {
    ingest(sdkList);
  }
  if (apiOk) {
    ingest(apiList);
  }
  if (restOk) {
    ingest(restList);
  }

  return Array.from(mergedById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
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
          if (docSnap.metadata?.hasPendingWrites) {
            return;
          }
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
  explicitOwnerUid?: string,
  shortIdHint?: string
): Promise<boolean> {
  if (!assignmentId) return false;
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) return false;
  const safeId = sanitizeDocId(assignmentId);
  const path = `homework_assignments/${safeId}`;

  let detectedShortId = shortIdHint?.trim() || '';
  if (!detectedShortId) {
    try {
      const existingHw = await fetchAssignmentFromFirestore(safeId, { requireOwnerUid: ownerUid }).catch(() => null);
      if (existingHw?.shortId) {
        detectedShortId = existingHw.shortId.trim();
      }
    } catch {
      // Ignore
    }
  }

  let firestoreDeleted = false;
  try {
    await executeConfirmedFirestoreWrite(() => deleteDoc(doc(db, 'homework_assignments', safeId)));
    firestoreDeleted = true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }

  if (detectedShortId && /^[A-Za-z0-9]{6,10}$/.test(detectedShortId)) {
    await revokeShortLinkInFirestore(detectedShortId, safeId, ownerUid).catch(() => false);
  } else {
    try {
      const shortQuery = query(
        collection(db, 'homework_short_links'),
        where('ownerUid', '==', ownerUid),
        where('assignmentId', '==', safeId)
      );
      const shortSnap = await withFirestoreReadTimeout(getDocs(shortQuery), 3500).catch(() => null);
      if (shortSnap) {
        const revokePromises: Promise<any>[] = [];
        shortSnap.forEach((docSnap) => {
          revokePromises.push(revokeShortLinkInFirestore(docSnap.id, safeId, ownerUid));
        });
        if (revokePromises.length > 0) {
          await Promise.all(revokePromises).catch(() => {});
        }
      }
    } catch {
      // Ignore
    }
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
      const pathMatch = window.location.pathname.match(/^\/Herr-Abdul-rahman\/([A-Za-z0-9]+)/i);
      const urlShortId = pathMatch?.[1]?.trim() || '';
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
          ...(urlShortId ? { shortId: urlShortId } : {}),
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
    const payloadJson = serializeSafeFirestorePayload(normalized, 440000);
    const docPayload = {
      id: safeId,
      assignmentId: safeAssignmentId,
      ownerUid,
      studentName: (submission.studentName || 'طالب').slice(0, 80),
      score: Math.max(0, Math.min(100000, Number(submission.score ?? submission.correctAnswersCount) || 0)),
      accuracyPercent: Math.max(
        0,
        Math.min(100, Number(submission.accuracyPercent ?? submission.scorePercentage ?? submission.accuracy) || 0)
      ),
      completedAt: completedAtValue,
      status: statusValue,
      ...(attemptSecret ? { attemptSecret } : {}),
      payloadJson
    };

    try {
      await executeConfirmedFirestoreWrite(
        () => setDoc(doc(db, 'homework_submissions', safeId), docPayload),
        8000,
        1
      );
      return true;
    } catch (sdkErr) {
      const restOk = await writeFirestoreDocViaRest('homework_submissions', safeId, docPayload);
      if (restOk) {
        return true;
      }
      throw sdkErr;
    }
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
  const cleanSet: any = {
    ...setItem,
    id: safeId,
    ...(setItem.createdByUid || ownerUid ? { createdByUid: setItem.createdByUid || ownerUid } : {})
  };
  delete cleanSet.ownerUid;
  delete cleanSet.ownerEmail;
  const payloadJson = serializeSafeFirestorePayload(cleanSet, 440000);
  const docPayload = {
    id: safeId,
    title: (setItem.title || 'Set').slice(0, 120),
    category: ((setItem as any).category || (setItem as any).topic || 'general').slice(0, 45),
    payloadJson,
    updatedAtIso: new Date().toISOString()
  };

  try {
    await executeConfirmedFirestoreWrite(() =>
      setDoc(doc(db, 'lernstudio_sets', safeId), docPayload)
    );
    return true;
  } catch (error) {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken().catch(() => null);
      if (token) {
        const restOk = await writeFirestoreDocViaRest('lernstudio_sets', safeId, docPayload, token);
        if (restOk) return true;
      }
    }
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
    const snap = await withFirestoreReadTimeout(getDoc(doc(db, 'lernstudio_sets', safeId)), 4000);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.payloadJson) {
        return JSON.parse(data.payloadJson) as LernstudioSet;
      }
    }
    const restData = await readFirestoreDocViaRest('lernstudio_sets', safeId);
    if (restData?.payloadJson) {
      return JSON.parse(restData.payloadJson) as LernstudioSet;
    }
    return null;
  } catch (error) {
    const restData = await readFirestoreDocViaRest('lernstudio_sets', safeId);
    if (restData?.payloadJson) {
      try {
        return JSON.parse(restData.payloadJson) as LernstudioSet;
      } catch {
        // Ignore
      }
    }
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

