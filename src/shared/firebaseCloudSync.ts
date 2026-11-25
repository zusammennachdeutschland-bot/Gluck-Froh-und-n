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
  orderBy,
  limit,
  startAfter,
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
import { DEFAULT_LERNSTUDIO_SETS } from './defaultLernstudioSets';
import { scrambleOrderingTokensDeterministic } from './grammarEngine';

const BUILTIN_CURRICULUM_SET_ID_SET = new Set<string>(DEFAULT_LERNSTUDIO_SETS.map((s) => s.id));

export function isBuiltinCurriculumSetId(setId: string): boolean {
  const clean = String(setId || '').trim();
  if (!clean) return false;
  return (
    clean.startsWith('curric_') ||
    clean.startsWith('set_def_') ||
    BUILTIN_CURRICULUM_SET_ID_SET.has(clean)
  );
}

import { FIREBASE_CONFIG } from './firebaseConfig';
export { FIREBASE_CONFIG };

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
let readQuotaCooldownUntilMs = 0;

// Clean up any stale 24-hour localStorage lock from earlier versions immediately on load
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_QUOTA_EXHAUSTED_DATE_KEY);
  } catch {
    // Ignore
  }
}

export function isQuotaErrorLike(error: unknown): boolean {
  if (!error) return false;
  const code = typeof (error as any)?.code === 'string' ? (error as any).code.toLowerCase() : '';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('free daily read') ||
    msg.includes('429')
  );
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

export function isFirestoreReadQuotaExhausted(): boolean {
  return Date.now() < readQuotaCooldownUntilMs;
}

export function markFirestoreReadQuotaExhausted(durationMs = 120 * 1000): void {
  readQuotaCooldownUntilMs = Math.max(readQuotaCooldownUntilMs, Date.now() + durationMs);
}

export function clearFirestoreReadQuotaFlag(): void {
  readQuotaCooldownUntilMs = 0;
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
      if (isQuotaErrorLike(bgErr)) {
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
    const msg = err?.message || String(err);
    if (isQuotaErrorLike(err)) {
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
  if (isQuotaErrorLike(error)) {
    if (operationType === OperationType.GET || operationType === OperationType.LIST) {
      markFirestoreReadQuotaExhausted();
      console.warn('Firestore Free-Tier Daily Read Quota Notice:', path);
    } else {
      markFirestoreWriteQuotaExhaustedToday();
      console.warn('Firestore Free-Tier Daily Write Quota Notice:', path);
    }
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
  if (isFirestoreReadQuotaExhausted()) {
    return false;
  }
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isQuotaErrorLike(error)) {
      markFirestoreReadQuotaExhausted();
      return false;
    }
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

// Boot-time Firestore reads are intentionally omitted so normal app startup uses 0 Firestore reads.


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

/**
 * Resolves homework API requests to the deployed HTTPS Vercel origin on native Android/Capacitor.
 * Web builds remain same-origin so local development and Vercel rewrites keep working.
 * Ignores accidental HTTP values or saved path/query fragments in local settings.
 */
export function getHomeworkApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') {
    return `${DEFAULT_VERCEL_DOMAIN}${cleanPath}`;
  }
  const protocol = window.location?.protocol || '';
  if (
    isAndroidNativePlatform() ||
    protocol === 'capacitor:' ||
    protocol === 'ionic:' ||
    protocol === 'file:'
  ) {
    try {
      const configuredUrl = new URL(getVercelPublicDomain());
      const safeOrigin =
        configuredUrl.protocol === 'https:' && configuredUrl.hostname
          ? configuredUrl.origin
          : DEFAULT_VERCEL_DOMAIN;
      return `${safeOrigin}${cleanPath}`;
    } catch {
      return `${DEFAULT_VERCEL_DOMAIN}${cleanPath}`;
    }
  }
  return cleanPath;
}

export function resolveHomeworkApiUrl(path: string): string {
  return getHomeworkApiUrl(path);
}

/**
 * Retrieves the teacher's Firebase ID token with a strict timeout so a stalled
 * Android WebView token request never leaves the homework UI stuck indefinitely.
 */
export async function getHomeworkAuthToken(timeoutMs = 15000): Promise<string> {
  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  if (!currentUser || typeof currentUser.getIdToken !== 'function') {
    throw new Error('يجب تسجيل الدخول بحساب المدرس أولاً.');
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await Promise.race([
      currentUser.getIdToken(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('انتهت مهلة التحقق من جلسة المدرس. سجّل الدخول مرة أخرى ثم حاول.')),
          timeoutMs
        );
      })
    ]);
    if (!token) throw new Error('تعذر التحقق من جلسة المدرس. سجّل الدخول مرة أخرى.');
    return token;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Bounded homework API fetch helper for both Android WebView and Web.
 * Keeps the timeout active across BOTH response headers AND response body consumption.
 */
export async function fetchHomeworkApi(
  path: string,
  init: RequestInit = {},
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutMessage = 'انتهت مهلة الاتصال بخادم الواجبات. تحقق من الإنترنت ثم حاول مرة أخرى.';
  const clearRequestTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = undefined;
  };

  timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(getHomeworkApiUrl(path), {
      ...init,
      signal: controller.signal
    });

    const wrapBodyReader = <T extends 'text' | 'json' | 'arrayBuffer' | 'blob' | 'formData'>(method: T) => {
      const original = response[method].bind(response) as (...args: any[]) => Promise<any>;
      return async (...args: any[]) => {
        try {
          return await original(...args);
        } catch (error) {
          if (timedOut) throw new Error(timeoutMessage);
          throw error;
        } finally {
          clearRequestTimeout();
        }
      };
    };

    response.text = wrapBodyReader('text') as typeof response.text;
    response.json = wrapBodyReader('json') as typeof response.json;
    response.arrayBuffer = wrapBodyReader('arrayBuffer') as typeof response.arrayBuffer;
    response.blob = wrapBodyReader('blob') as typeof response.blob;
    response.formData = wrapBodyReader('formData') as typeof response.formData;

    if (!response.body) clearRequestTimeout();
    return response;
  } catch (error: any) {
    clearRequestTimeout();
    if (timedOut || controller.signal.aborted) {
      throw new Error(timeoutMessage);
    }
    throw error;
  }
}

function isCrossOriginApiUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (typeof window === 'undefined' || !window.location?.origin) return true;
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return true;
  }
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
  // Web redirect results are consumed exactly once by consumeFirebaseWebRedirectResultOnce()
  // during app startup so Google Calendar OAuth credentials are never discarded.
}

let cachedWebRedirectResultPromise: Promise<import('firebase/auth').UserCredential | null> | null = null;

/**
 * Consumes Firebase Auth's pending web redirect result at most once per page load.
 * Strictly a no-op on Capacitor Android native platforms (which never use web redirect OAuth).
 */
export function consumeFirebaseWebRedirectResultOnce(): Promise<import('firebase/auth').UserCredential | null> {
  if (typeof window === 'undefined' || isAndroidNativePlatform()) {
    return Promise.resolve(null);
  }
  if (!cachedWebRedirectResultPromise) {
    cachedWebRedirectResultPromise = getRedirectResult(auth).catch((err) => {
      throw err;
    });
  }
  return cachedWebRedirectResultPromise;
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
    resetFirestoreSubscriptionMultiplexers();
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
  getIdToken?: () => Promise<string>;
}

let testHomeworkAuthUser: HomeworkTestAuthUser | null | undefined = undefined;
const teacherAuthSubscribers = new Set<(user: User | null) => void>();

export function isHomeworkAuthTestOverrideActive(): boolean {
  return testHomeworkAuthUser !== undefined;
}

export async function waitForHomeworkAuthStateReady(timeoutMs = 1200): Promise<void> {
  if (testHomeworkAuthUser !== undefined || auth.currentUser) return;
  const authReadyFn = (auth as any)?.authStateReady;
  if (typeof authReadyFn !== 'function') return;
  try {
    await Promise.race([
      authReadyFn.call(auth),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  } catch {
    // Ignore auth readiness timeout
  }
}

export function __setHomeworkAuthUserForTests(
  user: HomeworkTestAuthUser | null | undefined
): void {
  testHomeworkAuthUser = user;
  resetFirestoreSubscriptionMultiplexers();
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
  if (clone.grammarContent && typeof clone.grammarContent === 'object') {
    const gcCopy = { ...clone.grammarContent };
    delete gcCopy.rawImages;
    if (Array.isArray(gcCopy.pageImageRefs)) {
      gcCopy.pageImageRefs = gcCopy.pageImageRefs.map((ref: any) => {
        if (!ref || typeof ref !== 'object') return ref;
        const { base64Data: _b64, dataUrl: _du, ...rest } = ref;
        return rest;
      });
    }
    clone.grammarContent = gcCopy;
  }
  if (clone.setSnapshot && typeof clone.setSnapshot === 'object') {
    const snapCopy = { ...clone.setSnapshot };
    delete snapCopy.verbEntriesSnapshot;
    if (Array.isArray(snapCopy.items)) {
      snapCopy.items = stripHeavyMediaFromItems(snapCopy.items);
    }
    if (snapCopy.grammarContent && typeof snapCopy.grammarContent === 'object') {
      const gcCopy = { ...snapCopy.grammarContent };
      delete gcCopy.rawImages;
      if (Array.isArray(gcCopy.pageImageRefs)) {
        gcCopy.pageImageRefs = gcCopy.pageImageRefs.map((ref: any) => {
          if (!ref || typeof ref !== 'object') return ref;
          const { base64Data: _b64, dataUrl: _du, ...rest } = ref;
          return rest;
        });
      }
      snapCopy.grammarContent = gcCopy;
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

async function deleteFirestoreDocViaRest(
  collectionName: string,
  docId: string,
  idToken?: string | null
): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
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
    const res = await fetch(url, { method: 'DELETE', headers });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function queryDocIdsByAssignmentViaRest(
  collectionName: 'homework_short_links' | 'homework_submissions',
  ownerUid: string,
  safeAssignmentId: string,
  idToken?: string | null
): Promise<{ ok: boolean; docIds: string[] }> {
  if (typeof fetch !== 'function' || !ownerUid || !safeAssignmentId) {
    return { ok: false, docIds: [] };
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_CONFIG.projectId
    )}/databases/${encodeURIComponent(
      FIREBASE_CONFIG.firestoreDatabaseId
    )}/documents:runQuery?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller?.signal,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'ownerUid' },
                    op: 'EQUAL',
                    value: { stringValue: ownerUid }
                  }
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'assignmentId' },
                    op: 'EQUAL',
                    value: { stringValue: safeAssignmentId }
                  }
                }
              ]
            }
          }
        }
      })
    });
    if (!res.ok) return { ok: false, docIds: [] };
    const rows = await res.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, docIds: [] };
    const docIds: string[] = [];
    for (const row of rows) {
      const name: string = row?.document?.name || '';
      const parts = name.split('/');
      const docId = parts[parts.length - 1];
      if (docId) docIds.push(docId);
    }
    return { ok: true, docIds };
  } catch {
    return { ok: false, docIds: [] };
  } finally {
    if (timer) clearTimeout(timer);
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
  | { status: 'quota_exceeded' }
  | { status: 'error' };

export async function readFirestoreDocStatusViaRest(
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
    if (res.status === 429) {
      markFirestoreReadQuotaExhausted();
      return { status: 'quota_exceeded' };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (isQuotaErrorLike(errText)) {
        markFirestoreReadQuotaExhausted();
        return { status: 'quota_exceeded' };
      }
      return { status: 'error' };
    }
    const raw = await res.json().catch(() => null);
    const parsed = parseFirestoreRestFields(raw?.fields);
    if (!parsed) return { status: 'error' };
    return { status: 'found', data: parsed };
  } catch (err) {
    if (isQuotaErrorLike(err)) {
      markFirestoreReadQuotaExhausted();
      return { status: 'quota_exceeded' };
    }
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
): Promise<{ ok: boolean; items: HomeworkAssignment[]; quotaExceeded?: boolean }> {
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

    if (res.status === 429) {
      markFirestoreReadQuotaExhausted();
      return { ok: false, items: [], quotaExceeded: true };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (isQuotaErrorLike(errText)) {
        markFirestoreReadQuotaExhausted();
        return { ok: false, items: [], quotaExceeded: true };
      }
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
        const isDeletedDoc = fields.deleted === true || (parsed as any).deleted === true;
        if (!isDeletedDoc && parsed.shortId && parsed.id) {
          recordVerifiedShortLinkOwnership(parsed.shortId, parsed.id, ownerUid);
        }
        items.push({
          ...parsed,
          ownerUid,
          ...(typeof fields.ownerEmail === 'string' && fields.ownerEmail
            ? { ownerEmail: fields.ownerEmail }
            : {}),
          ...(typeof fields.isActive === 'boolean' ? { isActive: fields.isActive } : {}),
          ...(isDeletedDoc
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

export function sanitizeShortLinkAssignmentSnapshot(hw: HomeworkAssignment, ownerUid: string): HomeworkAssignment {
  const copy: any = {
    ...hw,
    ownerUid
  };
  delete copy.ownerEmail;
  delete copy.cloudCreatePending;
  if (copy.setSnapshot && typeof copy.setSnapshot === 'object') {
    const cleanSnap = { ...copy.setSnapshot };
    delete cleanSnap.ownerEmail;
    delete cleanSnap.ownerUid;
    const sanitizeExerciseItem = (ex: any, idx: number) => {
      if (!ex || typeof ex !== 'object') return ex;
      const cleanEx: any = { ...ex };
      if (cleanEx.type === 'sentence_ordering') {
        const expectedOrder = String(ex.correctAnswer || '').trim().split(/\s+/).filter(Boolean);
        const rawTokens =
          Array.isArray(ex.tokens) && ex.tokens.length >= 2
            ? ex.tokens.map((t: any) => String(t || '').trim()).filter(Boolean)
            : expectedOrder;
        if (rawTokens.length > 0) {
          cleanEx.tokens = scrambleOrderingTokensDeterministic(
            rawTokens,
            String(ex.id || `ex_${idx}`),
            expectedOrder.length >= 2 ? expectedOrder : undefined
          );
        }
      }
      delete cleanEx.correctAnswer;
      delete cleanEx.acceptedAnswers;
      delete cleanEx.explanation;
      delete cleanEx.explanationAr;
      delete cleanEx.explanationDe;
      delete cleanEx.explanationEn;
      delete cleanEx.teacherNotes;
      delete cleanEx.answerKey;
      return cleanEx;
    };
    if (Array.isArray(cleanSnap.customExercises)) {
      cleanSnap.customExercises = cleanSnap.customExercises.map(sanitizeExerciseItem);
    }
    if (cleanSnap.grammarContent && typeof cleanSnap.grammarContent === 'object') {
      const cleanGc: any = {
        ...cleanSnap.grammarContent,
        exercises: Array.isArray(cleanSnap.grammarContent.exercises)
          ? cleanSnap.grammarContent.exercises.map(sanitizeExerciseItem)
          : []
      };
      delete cleanGc.uploadedImagesBase64;
      delete cleanGc.rawImages;
      cleanSnap.grammarContent = cleanGc;
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
  explicitOwnerUid?: string,
  options?: { forceVerifyAndWrite?: boolean }
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

  const forceVerifyAndWrite = Boolean(options?.forceVerifyAndWrite);
  if (forceVerifyAndWrite) {
    lastSavedShortLinkPayloadHashById.delete(cleanShortId);
    lastSavedAssignmentPayloadHashById.delete(safeAssignmentId);
  }

  const shortDedupeSig = `${cleanShortId}::${ownerUid}::${isActive ? '1' : '0'}::${Boolean((assignment as any).deleted) ? '1' : '0'}::${payloadJson}`;
  const ownershipEstablished =
    !forceVerifyAndWrite && isShortLinkOwnershipVerified(cleanShortId, safeAssignmentId, ownerUid);
  if (ownershipEstablished && lastSavedShortLinkPayloadHashById.get(cleanShortId) === shortDedupeSig) {
    return { saved: true };
  }

  // Collision check: only run preliminary getDoc() when ownership for (cleanShortId, safeAssignmentId, ownerUid)
  // is not yet reliably established (or when explicitly forced during Restore Original Link / Generate New Link).
  if (!ownershipEstablished) {
    const knownInMem = verifiedShortLinkOwnershipById.get(cleanShortId);
    let checkedRemoteDoc = false;
    if (!isFirestoreReadQuotaExhausted()) {
      try {
        shortLinkGetDocCheckCountForTests++;
        const existingSnap = shortLinkGetDocOverrideForTests
          ? await shortLinkGetDocOverrideForTests(cleanShortId)
          : await withFirestoreReadTimeout(
              getDoc(doc(db, 'homework_short_links', cleanShortId)),
              3500
            ).catch((err) => {
              if (isQuotaErrorLike(err)) markFirestoreReadQuotaExhausted();
              return null;
            });
        const snapExists = existingSnap
          ? typeof (existingSnap as any).exists === 'function'
            ? (existingSnap as any).exists()
            : Boolean((existingSnap as any).exists)
          : false;
        const hasPendingWrites = Boolean((existingSnap as any)?.metadata?.hasPendingWrites);
        if (existingSnap && snapExists && !hasPendingWrites) {
          checkedRemoteDoc = true;
          const existingData =
            typeof (existingSnap as any).data === 'function'
              ? (existingSnap as any).data() || {}
              : (existingSnap as any).data || {};
          const existingHwId = String(existingData.assignmentId || '').trim();
          const existingOwner = String(existingData.ownerUid || '').trim();
          if (
            (existingHwId && existingHwId !== safeAssignmentId && existingHwId !== assignment.id) ||
            (existingOwner && existingOwner !== ownerUid)
          ) {
            return { saved: false, collision: true };
          }
          if (
            (existingHwId === safeAssignmentId || existingHwId === assignment.id) &&
            existingOwner === ownerUid &&
            existingData.deleted !== true
          ) {
            recordVerifiedShortLinkOwnership(cleanShortId, safeAssignmentId, ownerUid);
          }
        }
      } catch {
        // Ignore read check timeout and let Firestore security rules enforce collision prevention
      }
    }
    if (
      !checkedRemoteDoc &&
      knownInMem &&
      (knownInMem.assignmentId !== safeAssignmentId || knownInMem.ownerUid !== ownerUid)
    ) {
      return { saved: false, collision: true };
    }
  }

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
    lastSavedShortLinkPayloadHashById.set(cleanShortId, shortDedupeSig);
    recordVerifiedShortLinkOwnership(cleanShortId, safeAssignmentId, ownerUid);
    return { saved: true };
  } catch (error: any) {
    const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
    if (currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function') {
      const token = await currentUser.getIdToken().catch(() => null);
      if (token) {
        const restOk = await writeFirestoreDocViaRest(
          'homework_short_links',
          cleanShortId,
          shortDocPayload,
          token
        );
        if (restOk) {
          lastSavedShortLinkPayloadHashById.set(cleanShortId, shortDedupeSig);
          recordVerifiedShortLinkOwnership(cleanShortId, safeAssignmentId, ownerUid);
          return { saved: true };
        }
      }
    }
    lastSavedShortLinkPayloadHashById.delete(cleanShortId);
    const errMsg = String(error?.code || error?.message || error || '').toLowerCase();
    if (errMsg.includes('permission-denied') || errMsg.includes('insufficient permissions')) {
      clearVerifiedShortLinkOwnership(cleanShortId);
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
  // Always invalidate dedupe and ownership caches for both the short link and assignment so reopen/republish writes cleanly
  lastSavedShortLinkPayloadHashById.delete(cleanShortId);
  lastSavedAssignmentPayloadHashById.delete(safeAssignmentId);
  clearVerifiedShortLinkOwnership(cleanShortId);

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
    const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
    if (currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function') {
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
  lastSavedShortLinkPayloadHashById.delete(cleanShortId);
  lastSavedAssignmentPayloadHashById.delete(safeAssignmentId);
  clearVerifiedShortLinkOwnership(cleanShortId);
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
  let hadQuotaError = false;

  if (!isFirestoreReadQuotaExhausted()) {
    try {
      const snap = await withFirestoreReadTimeout(
        getDoc(doc(db, 'homework_short_links', cleanShortId)),
        4500
      );
      const snapFromCache = Boolean(snap.metadata?.fromCache);
      const snapHasPendingWrites = Boolean(snap.metadata?.hasPendingWrites);
      if (snap.exists() && !snapHasPendingWrites) {
        rawData = snap.data() || null;
      } else if (!snap.exists() && !snapFromCache && !snapHasPendingWrites) {
        sdkRespondedNotFound = true;
      } else if (!snap.exists()) {
        hadNetworkError = true;
      }
    } catch (err) {
      if (isQuotaErrorLike(err)) {
        markFirestoreReadQuotaExhausted();
        hadQuotaError = true;
      } else {
        hadNetworkError = true;
      }
    }
  } else {
    hadQuotaError = true;
  }

  if (!rawData && !hadQuotaError) {
    const restRes = await readFirestoreDocStatusViaRest('homework_short_links', cleanShortId);
    if (restRes.status === 'found') {
      rawData = restRes.data;
      hadNetworkError = false;
      hadQuotaError = false;
    } else if (restRes.status === 'quota_exceeded') {
      hadQuotaError = true;
      sdkRespondedNotFound = false;
    } else if (restRes.status === 'error') {
      hadNetworkError = true;
      sdkRespondedNotFound = false;
    } else if (restRes.status === 'not_found') {
      sdkRespondedNotFound = true;
      hadNetworkError = false;
    }
  }

  if (!rawData) {
    if (hadQuotaError) {
      return {
        status: 'quota_exceeded',
        shortId: cleanShortId,
        errorMessageAr:
          'تم الوصول للحد اليومي المجاني لقراءة البيانات في السحابة مؤقتاً. يرجى المحاولة بعد قليل أو فتح الرابط من جهاز المعلم.'
      };
    }
    if (hadNetworkError || !sdkRespondedNotFound) {
      return {
        status: 'network_error',
        shortId: cleanShortId,
        errorMessageAr: 'تعذر الاتصال بالسحابة لتحميل الواجب. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.'
      };
    }
    lastSavedShortLinkPayloadHashById.delete(cleanShortId);
    return {
      status: 'not_found',
      shortId: cleanShortId,
      errorMessageAr: 'رابط الواجب غير موجود أو منتهي الصلاحية.'
    };
  }

  const targetAssignmentId = typeof rawData.assignmentId === 'string' ? rawData.assignmentId.trim() : undefined;
  if (rawData.deleted === true || rawData.isActive === false) {
    lastSavedShortLinkPayloadHashById.delete(cleanShortId);
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
        lastSavedShortLinkPayloadHashById.delete(cleanShortId);
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
  const assignmentDedupeSig = `${safeId}::${ownerUid}::${isActive ? '1' : '0'}::${title}::${payloadJson}`;
  const docPayload = {
    id: safeId,
    ownerUid,
    title,
    createdAt,
    isActive,
    payloadJson
  };

  let firestoreSaved = lastSavedAssignmentPayloadHashById.get(safeId) === assignmentDedupeSig;
  if (!firestoreSaved) {
    try {
      await executeConfirmedFirestoreWrite(
        () => setDoc(doc(db, 'homework_assignments', safeId), docPayload),
        6000,
        1
      );
      firestoreSaved = true;
      lastSavedAssignmentPayloadHashById.set(safeId, assignmentDedupeSig);
    } catch (error) {
      // Fallback to direct HTTPS Firestore REST API with the teacher's ID token
      const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
      if (currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function') {
        const token = await currentUser.getIdToken().catch(() => null);
        if (token) {
          firestoreSaved = await writeFirestoreDocViaRest(
            'homework_assignments',
            safeId,
            docPayload,
            token
          );
          if (firestoreSaved) {
            lastSavedAssignmentPayloadHashById.set(safeId, assignmentDedupeSig);
          }
        }
      }
      if (!firestoreSaved) {
        lastSavedAssignmentPayloadHashById.delete(safeId);
        handleFirestoreError(error, OperationType.WRITE, path);
      }
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

  // Only invoke the HTTP API fallback when direct Firestore writes did not complete (works on Web and Android APK via resolveHomeworkApiUrl)
  let apiSaved = false;
  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  if (!(firestoreSaved && shortLinkSaved) && currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function') {
    try {
      const idToken = await getHomeworkAuthToken();
      const apiUrl = resolveHomeworkApiUrl('/api/teacher/assignments');
      const response = await fetchHomeworkApi('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        ...(isCrossOriginApiUrl(apiUrl) ? {} : { credentials: 'include' as RequestCredentials }),
        body: JSON.stringify({ ...normalized, ownerUid })
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        apiSaved = data?.success === true && Boolean(data?.assignment?.id);
        if (apiSaved) {
          lastSavedAssignmentPayloadHashById.set(safeId, assignmentDedupeSig);
        }
      } else if (response.status === 409) {
        const collisionErr: any = new Error('SHORT_ID_COLLISION');
        collisionErr.code = 'SHORT_ID_COLLISION';
        throw collisionErr;
      }
    } catch (err: any) {
      if (err?.code === 'SHORT_ID_COLLISION') {
        throw err;
      }
      // Ignore server API unavailability
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
    if (!isDeleted && docOwnerUid && parsed.shortId && parsed.id) {
      recordVerifiedShortLinkOwnership(parsed.shortId, parsed.id, docOwnerUid);
    }
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
      const parsed = parseAssignmentDocData(snap.data(), options?.requireOwnerUid);
      if (!parsed || (parsed as any).deleted) {
        lastSavedAssignmentPayloadHashById.delete(safeId);
      }
      return parsed;
    }
    if (!snap.exists() && !snap.metadata?.fromCache && !snap.metadata?.hasPendingWrites) {
      lastSavedAssignmentPayloadHashById.delete(safeId);
      return null;
    }
    sdkNeedsRestFallback = true;
  } catch (error) {
    sdkNeedsRestFallback = true;
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (sdkNeedsRestFallback) {
    const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
    const idToken = currentUser && typeof currentUser.getIdToken === 'function'
      ? await currentUser.getIdToken().catch(() => null)
      : null;
    const restRes = await readFirestoreDocStatusViaRest('homework_assignments', safeId, idToken);
    if (restRes.status === 'found') {
      const parsed = parseAssignmentDocData(restRes.data, options?.requireOwnerUid);
      if (!parsed || (parsed as any).deleted) {
        lastSavedAssignmentPayloadHashById.delete(safeId);
      }
      return parsed;
    }
    if (restRes.status === 'not_found') {
      lastSavedAssignmentPayloadHashById.delete(safeId);
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

export async function fetchAssignmentsPageFromFirestore(options?: {
  limit?: number;
  cursor?: string;
  explicitOwnerUid?: string;
}): Promise<{ assignments: HomeworkAssignment[]; nextCursor: string | null; hasMore: boolean }> {
  lastAssignmentsFetchAuthoritative = false;
  const ownerUid = options?.explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) {
    return { assignments: [], nextCursor: null, hasMore: false };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Offline: cannot fetch authoritative homework assignments.');
  }
  if (isFirestoreReadQuotaExhausted()) {
    throw new Error('Quota exceeded: Firestore daily read quota is temporarily on cooldown.');
  }

  const safeLimit = Math.max(1, Math.min(200, Number(options?.limit) || 50));
  const path = 'homework_assignments';
  let cursorSnap: any = null;
  if (options?.cursor) {
    try {
      cursorSnap = await withFirestoreReadTimeout(
        getDoc(doc(db, 'homework_assignments', sanitizeDocId(options.cursor))),
        3500
      );
    } catch {
      cursorSnap = null;
    }
  }

  const baseConstraints: any[] = [
    where('ownerUid', '==', ownerUid),
    orderBy('createdAt', 'desc')
  ];
  if (cursorSnap && cursorSnap.exists()) {
    baseConstraints.push(startAfter(cursorSnap));
  }
  baseConstraints.push(limit(safeLimit + 1));

  const q = query(collection(db, 'homework_assignments'), ...baseConstraints);

  try {
    let snap;
    try {
      snap = await withFirestoreReadTimeout(getDocsFromServer(q), 5000);
    } catch (serverErr) {
      if (isQuotaErrorLike(serverErr)) {
        markFirestoreReadQuotaExhausted();
        throw serverErr;
      }
      snap = await withFirestoreReadTimeout(getDocs(q), 5000);
    }

    if (!options?.explicitOwnerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
      return { assignments: [], nextCursor: null, hasMore: false };
    }

    if (!snap.metadata?.fromCache) {
      const docs = snap.docs || [];
      const hasMore = docs.length > safeLimit;
      const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
      const list: HomeworkAssignment[] = [];
      for (const docSnap of pageDocs) {
        if (docSnap.metadata?.hasPendingWrites) continue;
        const parsed = parseAssignmentDocData(docSnap.data(), ownerUid);
        if (parsed && !(parsed as any).deleted) {
          list.push(parsed);
        }
      }
      const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
      lastAssignmentsFetchAuthoritative = true;
      return {
        assignments: list,
        nextCursor: hasMore && lastDoc ? lastDoc.id : null,
        hasMore
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  // Fallback to paginated Vercel API only if direct Firestore failed or returned cached-only data
  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  const idToken =
    currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function'
      ? await currentUser.getIdToken().catch(() => null)
      : null;

  if (idToken && typeof fetch === 'function') {
    const qs = new URLSearchParams({ limit: String(safeLimit) });
    if (options?.cursor) qs.set('cursor', options.cursor);
    const apiUrl = resolveHomeworkApiUrl(`/api/teacher/assignments?${qs.toString()}`);
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
      ...(isCrossOriginApiUrl(apiUrl) ? {} : { credentials: 'include' as RequestCredentials })
    }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.assignments)) {
        lastAssignmentsFetchAuthoritative = true;
        return {
          assignments: data.assignments
            .filter((a: HomeworkAssignment) => !a.ownerUid || a.ownerUid === ownerUid)
            .map((a: HomeworkAssignment) => ({
              ...a,
              ownerUid,
              cloudSynced: true
            })),
          nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
          hasMore: Boolean(data.hasMore)
        };
      }
    }
  }

  throw new Error('Unable to verify authoritative assignment list from Firestore server.');
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
  if (isFirestoreReadQuotaExhausted()) {
    throw new Error('Quota exceeded: Firestore daily read quota is temporarily on cooldown.');
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
    } catch (serverErr) {
      if (isQuotaErrorLike(serverErr)) {
        markFirestoreReadQuotaExhausted();
        throw serverErr;
      }
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

  // Only invoke fallback reads when primary SDK query did NOT return an authoritative server snapshot
  const needsServerFallback =
    !sdkSucceeded || sdkIsFromCache || sdkHasPendingWrites;

  if (needsServerFallback && !isFirestoreReadQuotaExhausted()) {
    const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
    const idToken =
      currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function'
        ? await currentUser.getIdToken().catch(() => null)
        : null;

    if (idToken) {
      const restRes = await queryAssignmentsViaRest(ownerUid, idToken);
      restOk = restRes.ok;
      restList = restRes.items;
    }

    if (!restOk && idToken && typeof fetch === 'function') {
      try {
        const apiUrl = resolveHomeworkApiUrl('/api/teacher/assignments');
        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
          ...(isCrossOriginApiUrl(apiUrl) ? {} : { credentials: 'include' as RequestCredentials })
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
        // Ignore server API unavailability
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

const lastSavedAssignmentPayloadHashById = new Map<string, string>();
const lastSavedShortLinkPayloadHashById = new Map<string, string>();
const lastSavedSubmissionPayloadHashById = new Map<string, string>();
const lastPublishedSetHashById = new Map<string, string>();
const PUBLISHED_SET_HASHES_STORAGE_KEY = 'gluck_published_set_hashes_v1';

const verifiedShortLinkOwnershipById = new Map<
  string,
  { assignmentId: string; ownerUid: string }
>();
const VERIFIED_SHORT_LINKS_STORAGE_KEY = 'gluck_verified_short_link_owners_v1';
let shortLinkGetDocCheckCountForTests = 0;
let shortLinkGetDocOverrideForTests:
  | ((shortId: string) => Promise<{ exists: boolean | (() => boolean); data?: any; metadata?: { hasPendingWrites?: boolean } } | null>)
  | null = null;

function loadPersistedShortLinkOwnershipMap(): Record<string, { assignmentId: string; ownerUid: string }> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VERIFIED_SHORT_LINKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePersistedShortLinkOwnershipMap(
  mapObj: Record<string, { assignmentId: string; ownerUid: string }>
): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(VERIFIED_SHORT_LINKS_STORAGE_KEY, JSON.stringify(mapObj));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordVerifiedShortLinkOwnership(
  shortId: string,
  assignmentId: string,
  ownerUid: string
): void {
  const cleanShortId = String(shortId || '').trim();
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const cleanOwnerUid = String(ownerUid || '').trim().slice(0, 128);
  if (!cleanShortId || !/^[A-Za-z0-9]{6,10}$/.test(cleanShortId) || !safeAssignmentId || !cleanOwnerUid) {
    return;
  }
  verifiedShortLinkOwnershipById.set(cleanShortId, {
    assignmentId: safeAssignmentId,
    ownerUid: cleanOwnerUid
  });
  const persisted = loadPersistedShortLinkOwnershipMap();
  persisted[cleanShortId] = { assignmentId: safeAssignmentId, ownerUid: cleanOwnerUid };
  savePersistedShortLinkOwnershipMap(persisted);
}

export function clearVerifiedShortLinkOwnership(shortId?: string): void {
  if (!shortId) {
    verifiedShortLinkOwnershipById.clear();
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(VERIFIED_SHORT_LINKS_STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    return;
  }
  const cleanShortId = String(shortId || '').trim();
  if (!cleanShortId) return;
  verifiedShortLinkOwnershipById.delete(cleanShortId);
  const persisted = loadPersistedShortLinkOwnershipMap();
  if (cleanShortId in persisted) {
    delete persisted[cleanShortId];
    savePersistedShortLinkOwnershipMap(persisted);
  }
}

export function isShortLinkOwnershipVerified(
  shortId: string,
  assignmentId: string,
  ownerUid: string
): boolean {
  const cleanShortId = String(shortId || '').trim();
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const cleanOwnerUid = String(ownerUid || '').trim().slice(0, 128);
  if (!cleanShortId || !safeAssignmentId || !cleanOwnerUid) return false;

  const inMem = verifiedShortLinkOwnershipById.get(cleanShortId);
  if (inMem) {
    return inMem.assignmentId === safeAssignmentId && inMem.ownerUid === cleanOwnerUid;
  }

  const persisted = loadPersistedShortLinkOwnershipMap();
  const entry = persisted[cleanShortId];
  if (entry && entry.assignmentId === safeAssignmentId && entry.ownerUid === cleanOwnerUid) {
    verifiedShortLinkOwnershipById.set(cleanShortId, entry);
    return true;
  }
  return false;
}

export function getShortLinkGetDocCheckCountForTests(): number {
  return shortLinkGetDocCheckCountForTests;
}

export function resetShortLinkGetDocCheckCountForTests(): void {
  shortLinkGetDocCheckCountForTests = 0;
}

export function __setShortLinkGetDocOverrideForTests(
  fn:
    | ((shortId: string) => Promise<{ exists: boolean | (() => boolean); data?: any; metadata?: { hasPendingWrites?: boolean } } | null>)
    | null
): void {
  shortLinkGetDocOverrideForTests = fn;
}

export function resetFirestoreSubscriptionMultiplexers(): void {
  lastSavedAssignmentPayloadHashById.clear();
  lastSavedShortLinkPayloadHashById.clear();
  lastSavedSubmissionPayloadHashById.clear();
  lastPublishedSetHashById.clear();
  clearVerifiedShortLinkOwnership();
  shortLinkGetDocCheckCountForTests = 0;
}

/**
 * Legacy subscription signature preserved as a strict zero-listener no-op.
 * Teacher UI must use manual refresh + local cache instead of realtime onSnapshot listeners.
 */
export function subscribeAssignmentsFromFirestore(
  _onUpdate: (assignments: HomeworkAssignment[]) => void,
  _explicitOwnerUid?: string
): () => void {
  return () => {};
}

/**
 * Canonical Homework Deletion Order:
 * 1. Discover and revoke ALL associated homework_short_links FIRST (fail-closed if revocation fails).
 * 2. Delete homework_assignments/{safeId} SECOND (only after short links are revoked).
 * 3. NEVER delete historical homework_submissions (preserved for teacher reports & audit history).
 */
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

  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  const idToken =
    currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function'
      ? await currentUser.getIdToken().catch(() => null)
      : null;

  // Step 1: Discover all short links referencing this assignmentId
  const shortIdsToRevoke = new Set<string>();
  const hint = shortIdHint?.trim() || '';
  if (hint && /^[A-Za-z0-9]{6,10}$/.test(hint)) {
    shortIdsToRevoke.add(hint);
  } else {
    try {
      const existingHw = await fetchAssignmentFromFirestore(safeId, { requireOwnerUid: ownerUid }).catch(() => null);
      if (existingHw?.shortId && /^[A-Za-z0-9]{6,10}$/.test(existingHw.shortId.trim())) {
        shortIdsToRevoke.add(existingHw.shortId.trim());
      }
    } catch {
      // Ignore fallback discovery errors
    }
  }

  try {
    const shortQuery = query(
      collection(db, 'homework_short_links'),
      where('ownerUid', '==', ownerUid),
      where('assignmentId', '==', safeId)
    );
    const shortSnap = await withFirestoreReadTimeout(getDocs(shortQuery), 3500).catch(() => null);
    if (shortSnap) {
      shortSnap.forEach((docSnap) => {
        if (docSnap?.id && /^[A-Za-z0-9]{6,10}$/.test(docSnap.id)) {
          shortIdsToRevoke.add(docSnap.id);
        }
      });
    }
  } catch {
    // Fall through to REST lookup
  }

  if (shortIdsToRevoke.size === 0 && idToken) {
    const restShort = await queryDocIdsByAssignmentViaRest('homework_short_links', ownerUid, safeId, idToken);
    if (restShort.ok) {
      for (const sid of restShort.docIds) {
        if (/^[A-Za-z0-9]{6,10}$/.test(sid)) shortIdsToRevoke.add(sid);
      }
    }
  }

  lastSavedAssignmentPayloadHashById.delete(safeId);
  for (const sid of shortIdsToRevoke) {
    lastSavedShortLinkPayloadHashById.delete(sid);
    clearVerifiedShortLinkOwnership(sid);
  }

  // Step 1B: Revoke ALL associated short links FIRST. Fail-closed before deleting assignment doc!
  let shortLinksAllRevoked = true;
  if (shortIdsToRevoke.size > 0) {
    const revokeResults = await Promise.all(
      Array.from(shortIdsToRevoke).map((sid) =>
        revokeShortLinkInFirestore(sid, safeId, ownerUid).catch(() => false)
      )
    );
    if (revokeResults.some((ok) => !ok)) {
      shortLinksAllRevoked = false;
    }
  }

  let firestoreDeleted = false;
  if (shortLinksAllRevoked) {
    // Step 2: Only delete homework_assignments/{safeId} after short links are revoked
    try {
      await executeConfirmedFirestoreWrite(() => deleteDoc(doc(db, 'homework_assignments', safeId)), 6000, 1);
      firestoreDeleted = true;
    } catch (error) {
      if (idToken) {
        firestoreDeleted = await deleteFirestoreDocViaRest('homework_assignments', safeId, idToken);
      }
      if (!firestoreDeleted) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  }

  // Fallback to authoritative server DELETE endpoint only if client-side canonical sequence did not complete
  let apiDeleted = false;
  if (!(firestoreDeleted && shortLinksAllRevoked) && typeof fetch === 'function' && idToken) {
    try {
      const deletePath = `/api/teacher/assignments?id=${encodeURIComponent(assignmentId)}`;
      const deleteUrl = resolveHomeworkApiUrl(deletePath);
      const response = await fetchHomeworkApi(deletePath, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
        ...(isCrossOriginApiUrl(deleteUrl) ? {} : { credentials: 'include' as RequestCredentials })
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        apiDeleted = data?.success === true && data?.deleted === true;
      }
    } catch {
      // Ignore server API unavailability
    }
  }

  return (firestoreDeleted && shortLinksAllRevoked) || apiDeleted;
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

  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  const idToken =
    currentUser && currentUser.uid === ownerUid && typeof currentUser.getIdToken === 'function'
      ? await currentUser.getIdToken().catch(() => null)
      : null;

  try {
    const q = query(
      collection(db, 'homework_submissions'),
      where('assignmentId', '==', safeAssignmentId),
      where('ownerUid', '==', ownerUid)
    );
    const snap = await withFirestoreReadTimeout(getDocs(q), 4000);
    const deletePromises: Promise<boolean>[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data?.ownerUid && data.ownerUid !== ownerUid) return;
      lastSavedSubmissionPayloadHashById.delete(docSnap.id);
      deletePromises.push(
        executeConfirmedFirestoreWrite(() => deleteDoc(docSnap.ref), 6000, 1)
          .then(() => true)
          .catch(() => (idToken ? deleteFirestoreDocViaRest('homework_submissions', docSnap.id, idToken) : false))
      );
    });
    if (deletePromises.length > 0) {
      const results = await Promise.all(deletePromises);
      if (results.some((ok) => !ok)) return false;
    }
    return true;
  } catch (error) {
    if (idToken) {
      const restQuery = await queryDocIdsByAssignmentViaRest('homework_submissions', ownerUid, safeAssignmentId, idToken);
      if (restQuery.ok) {
        if (restQuery.docIds.length === 0) return true;
        const restResults = await Promise.all(
          restQuery.docIds.map((docId) => {
            lastSavedSubmissionPayloadHashById.delete(docId);
            return deleteFirestoreDocViaRest('homework_submissions', docId, idToken);
          })
        );
        return restResults.every(Boolean);
      }
    }
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

// ============================================================================
// FIRESTORE STUDENT SUBMISSIONS (LINKED TO PARENT ASSIGNMENT ownerUid)
// ============================================================================
function canonicalJsonValue(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(canonicalJsonValue).join(',')}]`;
  const keys = Object.keys(val).filter((k) => val[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonValue(val[k])}`).join(',')}}`;
}

function buildSubmissionDedupeSignature(
  submission: HomeworkSubmission,
  safeId: string,
  ownerUid: string,
  statusValue: string,
  completedAtValue: string
): string {
  const responsesCanonical = Array.isArray(submission.responses)
    ? submission.responses.map((r) => ({
        q: r?.questionId || '',
        t: r?.questionType || '',
        w: r?.germanWord || '',
        s: r?.studentAnswer ?? '',
        c: r?.correctAnswer ?? '',
        ok: Boolean(r?.isCorrect),
        sec: Number(r?.timeSpentSeconds || 0),
        v: r?.isVerbQuestion ? {
          verbId: r.verbId || '',
          inf: r.infinitive || '',
          sub: r.subject || '',
          sent: r.sentence || ''
        } : null
      }))
    : [];
  const rawGam = (submission as any).gamification;
  return canonicalJsonValue({
    id: safeId,
    assignmentId: sanitizeDocId(submission.assignmentId),
    ownerUid: ownerUid.slice(0, 128),
    status: statusValue,
    startedAt: submission.startedAt || '',
    completedAt: completedAtValue,
    audienceMode: submission.audienceMode || '',
    groupId: submission.groupId || '',
    studentId: submission.studentId || '',
    participantId: submission.participantId || '',
    studentName: (submission.studentName || '').trim(),
    attemptNumber: Number(submission.attemptNumber || 1),
    totalQuestions: Number(submission.totalQuestions || responsesCanonical.length),
    correctAnswersCount: Number(submission.correctAnswersCount ?? submission.score ?? 0),
    score: Math.max(0, Math.min(100000, Number(submission.score ?? submission.correctAnswersCount) || 0)),
    accuracyPercent: Math.max(
      0,
      Math.min(100, Number(submission.accuracyPercent ?? submission.scorePercentage ?? submission.accuracy) || 0)
    ),
    goldEarned: Number(submission.goldEarned || 0),
    maxStreak: Number((submission as any).maxStreak || 0),
    xpEarned: Number((submission as any).xpEarned || 0),
    completedStudyPhase: Boolean(submission.completedStudyPhase),
    timeSpentSeconds: Number(submission.timeSpentSeconds || 0),
    gamification: rawGam && typeof rawGam === 'object' ? rawGam : null,
    responses: responsesCanonical
  });
}

export interface SubmissionSaveResult {
  synced: boolean;
  authoritativeSubmission?: HomeworkSubmission;
  isIdempotentRetry?: boolean;
  rejected?: boolean;
  status?: number;
  error?: string;
}

export async function saveSubmissionToFirestoreWithDetails(
  submission: HomeworkSubmission,
  explicitOwnerUid?: string
): Promise<SubmissionSaveResult> {
  if (!submission || !submission.id || !submission.assignmentId) {
    return { synced: false };
  }
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

  const earlyDedupeSig = resolvedOwnerUid
    ? buildSubmissionDedupeSignature(submission, safeId, resolvedOwnerUid, statusValue, completedAtValue)
    : '';
  if (earlyDedupeSig && lastSavedSubmissionPayloadHashById.get(safeId) === earlyDedupeSig) {
    return { synced: true, isIdempotentRetry: true };
  }

  let apiOk = false;
  try {
    if (typeof fetch === 'function' && typeof window !== 'undefined') {
      const urlToken = new URLSearchParams(window.location?.search || '').get('token')?.trim() || '';
      const urlOwnerUid = new URLSearchParams(window.location?.search || '').get('ou')?.trim() || '';
      const pathMatch = (window.location?.pathname || '').match(/^\/Herr-Abdul-rahman\/([A-Za-z0-9]+)/i);
      const urlShortId = pathMatch?.[1]?.trim() || '';
      if (!resolvedOwnerUid && urlOwnerUid) {
        resolvedOwnerUid = urlOwnerUid;
      }
      const submitUrl = resolveHomeworkApiUrl('/api/homework/submit');
      const res = await fetch(submitUrl, {
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

      if (res) {
        const data = await res.json().catch(() => null);
        if (res.ok) {
          apiOk = true;
          const authSub = data?.submission as HomeworkSubmission | undefined;
          const serverOwnerUid = authSub?.ownerUid;
          if (!resolvedOwnerUid && typeof serverOwnerUid === 'string' && serverOwnerUid.trim()) {
            resolvedOwnerUid = serverOwnerUid.trim();
          }
          if (resolvedOwnerUid) {
            lastSavedSubmissionPayloadHashById.set(
              safeId,
              buildSubmissionDedupeSignature(submission, safeId, resolvedOwnerUid, statusValue, completedAtValue)
            );
          }
          return {
            synced: true,
            authoritativeSubmission: authSub,
            isIdempotentRetry: Boolean(data?.isIdempotentRetry)
          };
        }
        // Fail closed on client authoritative rejections (400, 401, 403, 409 Conflict, 410 Gone):
        // NEVER fall back to client Firestore setDoc!
        if (res.status >= 400 && res.status < 500 && res.status !== 404) {
          return {
            synced: false,
            rejected: true,
            status: res.status,
            error: data?.error || `Submission rejected (${res.status})`
          };
        }
      }
    }
  } catch {
    // Best-effort network transport error; continue to Firestore fallback only when server API was unreachable
  }

  try {
    if (!resolvedOwnerUid) {
      const parentHw = await fetchAssignmentFromFirestore(safeAssignmentId).catch(() => null);
      if (parentHw) {
        if (parentHw.isActive === false || parentHw.status === 'closed' || (parentHw as any).deleted === true) {
          return {
            synced: false,
            rejected: true,
            status: 403,
            error: 'Assignment is closed or deleted'
          };
        }
        if (parentHw.ownerUid && parentHw.ownerUid.trim()) {
          resolvedOwnerUid = parentHw.ownerUid.trim();
        } else {
          resolvedOwnerUid = `legacy_unclaimed_${safeAssignmentId}`;
        }
      } else {
        resolvedOwnerUid = getCurrentHomeworkOwnerUid() || '';
      }
    }

    if (!resolvedOwnerUid) {
      return { synced: apiOk };
    }

    const ownerUid = resolvedOwnerUid.slice(0, 128);
    const submissionDedupeSig = buildSubmissionDedupeSignature(
      submission,
      safeId,
      ownerUid,
      statusValue,
      completedAtValue
    );
    if (lastSavedSubmissionPayloadHashById.get(safeId) === submissionDedupeSig) {
      return { synced: true, isIdempotentRetry: true };
    }

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
      lastSavedSubmissionPayloadHashById.set(safeId, submissionDedupeSig);
      return { synced: true, authoritativeSubmission: normalized };
    } catch (sdkErr: any) {
      const restOk = await writeFirestoreDocViaRest('homework_submissions', safeId, docPayload);
      if (restOk) {
        lastSavedSubmissionPayloadHashById.set(safeId, submissionDedupeSig);
        return { synced: true, authoritativeSubmission: normalized };
      }
      lastSavedSubmissionPayloadHashById.delete(safeId);
      const code = String(sdkErr?.code || '');
      const msg = String(sdkErr?.message || '');
      if (code === 'permission-denied' || msg.includes('permission-denied')) {
        return {
          synced: false,
          rejected: true,
          status: 403,
          error: 'Submission rejected by security rules'
        };
      }
      throw sdkErr;
    }
  } catch (error) {
    if (!apiOk) {
      lastSavedSubmissionPayloadHashById.delete(safeId);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return { synced: apiOk };
  }
}

export async function saveSubmissionToFirestore(
  submission: HomeworkSubmission,
  explicitOwnerUid?: string
): Promise<boolean> {
  const result = await saveSubmissionToFirestoreWithDetails(submission, explicitOwnerUid);
  return result.synced;
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

export async function fetchSubmissionsPageFromFirestore(
  assignmentId: string,
  options?: { limit?: number; cursor?: string; explicitOwnerUid?: string }
): Promise<{ submissions: HomeworkSubmission[]; nextCursor: string | null; hasMore: boolean }> {
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const requiredOwnerUid = options?.explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || undefined;
  const safeLimit = Math.max(1, Math.min(200, Number(options?.limit) || 100));
  const path = 'homework_submissions';

  if (requiredOwnerUid) {
    try {
      let cursorSnap: any = null;
      if (options?.cursor) {
        cursorSnap = await withFirestoreReadTimeout(
          getDoc(doc(db, 'homework_submissions', sanitizeDocId(options.cursor))),
          3500
        ).catch(() => null);
      }

      const constraints: any[] = [
        where('ownerUid', '==', requiredOwnerUid),
        where('assignmentId', '==', safeAssignmentId),
        orderBy('completedAt', 'desc')
      ];
      if (cursorSnap && cursorSnap.exists()) {
        constraints.push(startAfter(cursorSnap));
      }
      constraints.push(limit(safeLimit + 1));

      const q = query(collection(db, 'homework_submissions'), ...constraints);
      const snap = await withFirestoreReadTimeout(getDocsFromServer(q), 5000).catch(() =>
        withFirestoreReadTimeout(getDocs(q), 5000)
      );

      if (!snap.metadata?.fromCache) {
        const docs = snap.docs || [];
        const hasMore = docs.length > safeLimit;
        const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
        const list: HomeworkSubmission[] = [];
        for (const docSnap of pageDocs) {
          const data = docSnap.data();
          if (!data?.payloadJson) continue;
          try {
            const parsed = JSON.parse(data.payloadJson) as HomeworkSubmission;
            const docOwnerUid =
              (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') ||
              (parsed.ownerUid?.trim() || '');
            if (docOwnerUid && docOwnerUid !== requiredOwnerUid) continue;
            list.push({
              ...parsed,
              ownerUid: requiredOwnerUid,
              cloudSynced: true
            });
          } catch {
            // Ignore malformed submission
          }
        }
        const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
        return {
          submissions: list,
          nextCursor: hasMore && lastDoc ? lastDoc.id : null,
          hasMore
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  // Single fallback to Vercel API ONLY when Firestore direct query failed
  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  if (typeof fetch === 'function' && currentUser && typeof currentUser.getIdToken === 'function') {
    const idToken = await currentUser.getIdToken().catch(() => null);
    if (idToken) {
      const qs = new URLSearchParams({
        assignmentId: safeAssignmentId,
        limit: String(safeLimit)
      });
      if (options?.cursor) qs.set('cursor', options.cursor);
      const apiUrl = resolveHomeworkApiUrl(`/api/homework/submissions?${qs.toString()}`);
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
        ...(isCrossOriginApiUrl(apiUrl) ? {} : { credentials: 'include' as RequestCredentials })
      }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.submissions)) {
          return {
            submissions: data.submissions.map((s: HomeworkSubmission) => ({
              ...s,
              ...(requiredOwnerUid ? { ownerUid: requiredOwnerUid } : {}),
              cloudSynced: true
            })),
            nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
            hasMore: Boolean(data.hasMore)
          };
        }
      }
    }
  }

  return { submissions: [], nextCursor: null, hasMore: false };
}

export async function fetchSubmissionsForAssignmentFromFirestore(
  assignmentId: string,
  explicitOwnerUid?: string
): Promise<HomeworkSubmission[]> {
  const safeAssignmentId = sanitizeDocId(assignmentId);
  const requiredOwnerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || undefined;
  const path = 'homework_submissions';

  // Primary source: single direct Firestore query (no automatic double read against Vercel API!)
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
    const snap = await withFirestoreReadTimeout(getDocsFromServer(q), 4000).catch(() =>
      withFirestoreReadTimeout(getDocs(q), 4000)
    );
    const list: HomeworkSubmission[] = [];
    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson) as HomeworkSubmission;
          const docOwnerUid =
            (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') ||
            (parsed.ownerUid?.trim() || '');
          if (
            requiredOwnerUid &&
            docOwnerUid &&
            docOwnerUid !== requiredOwnerUid &&
            docOwnerUid !== `legacy_unclaimed_${safeAssignmentId}`
          ) {
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
    // Empty [] is a valid authoritative result when snap succeeded from server; never trigger fallback reads on empty
    if (!snap.metadata?.fromCache || list.length > 0) {
      return mergeSubmissionLists(list, []);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  // Fallback to Vercel API ONLY on genuine Firestore failure
  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  if (typeof fetch === 'function' && currentUser && typeof currentUser.getIdToken === 'function') {
    try {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        const apiUrl = resolveHomeworkApiUrl(
          `/api/homework/submissions?assignmentId=${encodeURIComponent(safeAssignmentId)}`
        );
        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
          ...(isCrossOriginApiUrl(apiUrl) ? {} : { credentials: 'include' as RequestCredentials })
        }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data?.submissions)) {
            return mergeSubmissionLists(
              data.submissions.map((s: HomeworkSubmission) => ({
                ...s,
                ...(requiredOwnerUid ? { ownerUid: requiredOwnerUid } : {}),
                cloudSynced: true
              })),
              []
            );
          }
        }
      }
    } catch {
      // Ignore API fallback error
    }
  }

  return [];
}

export async function fetchAllSubmissionsFromFirestore(
  explicitOwnerUid?: string
): Promise<HomeworkSubmission[]> {
  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid();
  if (!ownerUid) {
    return [];
  }
  const path = 'homework_submissions';

  if (!isFirestoreReadQuotaExhausted()) {
    try {
      const q = query(collection(db, 'homework_submissions'), where('ownerUid', '==', ownerUid));
      const snap = await withFirestoreReadTimeout(getDocsFromServer(q), 5000).catch(() =>
        withFirestoreReadTimeout(getDocs(q), 5000)
      );
      if (!explicitOwnerUid && getCurrentHomeworkOwnerUid() !== ownerUid) {
        return [];
      }
      if (!snap.metadata?.fromCache) {
        const list: HomeworkSubmission[] = [];
        snap.forEach((docSnap) => {
          try {
            const data = docSnap.data();
            if (data?.payloadJson) {
              const parsed = JSON.parse(data.payloadJson) as HomeworkSubmission;
              const docOwnerUid =
                (typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '') ||
                (parsed.ownerUid?.trim() || '');
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
        return mergeSubmissionLists(list, []);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  // Fallback to Vercel API only if direct Firestore failed
  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  if (typeof fetch === 'function' && currentUser && typeof currentUser.getIdToken === 'function') {
    const idToken = await currentUser.getIdToken().catch(() => null);
    if (idToken) {
      const apiUrl = resolveHomeworkApiUrl('/api/homework/submissions');
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
        ...(isCrossOriginApiUrl(apiUrl) ? {} : { credentials: 'include' as RequestCredentials })
      }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.submissions)) {
          return mergeSubmissionLists(
            data.submissions
              .filter((s: HomeworkSubmission) => !s.ownerUid || s.ownerUid === ownerUid)
              .map((s: HomeworkSubmission) => ({
                ...s,
                ownerUid,
                cloudSynced: true
              })),
            []
          );
        }
      }
    }
  }

  throw new Error('Unable to load authoritative submissions from Firestore server.');
}

/**
 * Legacy subscription signature preserved as a strict zero-listener no-op.
 * Teacher UI must trigger explicit manual report refresh instead of realtime listeners.
 */
export function subscribeSubmissionsFromFirestore(
  _assignmentId: string | null,
  _onUpdate: (submissions: HomeworkSubmission[]) => void,
  _explicitOwnerUid?: string
): () => void {
  return () => {};
}

// ============================================================================
// FIRESTORE LERNSTUDIO SETS SYNC (1-Shot Shared Custom Sets; Built-ins Stay Local)
// ============================================================================
function loadPublishedSetHashesMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PUBLISHED_SET_HASHES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePublishedSetHash(safeId: string, hash: string): void {
  lastPublishedSetHashById.set(safeId, hash);
  if (typeof window === 'undefined') return;
  try {
    const current = loadPublishedSetHashesMap();
    current[safeId] = hash;
    localStorage.setItem(PUBLISHED_SET_HASHES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota issues
  }
}

function computeCustomSetContentHash(setItem: LernstudioSet): string {
  const clone: any = { ...setItem };
  delete clone.updatedAt;
  delete clone.publishedAt;
  delete clone.cloudSynced;
  delete clone.ownerEmail;
  delete clone.ownerUid;
  return canonicalJsonValue(clone);
}

export interface PublishCustomSetResult {
  synced: boolean;
  deduplicated: boolean;
  wrote: boolean;
  skippedBuiltinOrArchived?: boolean;
}

export async function publishCustomLernstudioSetOnce(
  setItem: LernstudioSet,
  explicitOwnerUid?: string
): Promise<PublishCustomSetResult> {
  if (!setItem || !setItem.id) {
    return { synced: false, deduplicated: false, wrote: false };
  }
  if (isBuiltinCurriculumSetId(setItem.id) || setItem.isArchived === true || setItem.deleted === true) {
    return { synced: true, deduplicated: false, wrote: false, skippedBuiltinOrArchived: true };
  }

  const ownerUid = explicitOwnerUid?.trim() || getCurrentHomeworkOwnerUid() || auth.currentUser?.uid || '';
  if (!ownerUid) {
    return { synced: false, deduplicated: false, wrote: false };
  }

  const safeId = sanitizeDocId(setItem.id);
  const path = `lernstudio_sets/${safeId}`;
  const isPublished = setItem.published !== false;
  const cleanSet: any = {
    ...setItem,
    id: safeId,
    published: isPublished,
    createdByUid: setItem.createdByUid || ownerUid
  };
  delete cleanSet.ownerUid;
  delete cleanSet.ownerEmail;

  const contentHash = computeCustomSetContentHash(cleanSet);
  const persistedHashes = loadPublishedSetHashesMap();
  if (
    lastPublishedSetHashById.get(safeId) === contentHash ||
    persistedHashes[safeId] === contentHash
  ) {
    lastPublishedSetHashById.set(safeId, contentHash);
    return { synced: true, deduplicated: true, wrote: false };
  }

  const nowIso = new Date().toISOString();
  const payloadJson = serializeSafeFirestorePayload(cleanSet, 440000);
  const docPayload: Record<string, any> = {
    id: safeId,
    title: (setItem.title || 'Set').slice(0, 120),
    category: ((setItem as any).category || (setItem as any).topic || 'general').slice(0, 45),
    published: isPublished,
    createdByUid: cleanSet.createdByUid,
    ...(setItem.createdByTeacherName
      ? { createdByTeacherName: String(setItem.createdByTeacherName).slice(0, 120) }
      : {}),
    payloadJson,
    updatedAtIso: nowIso
  };

  try {
    await executeConfirmedFirestoreWrite(() =>
      setDoc(doc(db, 'lernstudio_sets', safeId), docPayload)
    );
    savePublishedSetHash(safeId, contentHash);
    return { synced: true, deduplicated: false, wrote: true };
  } catch (error) {
    const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
    const token =
      currentUser && typeof currentUser.getIdToken === 'function'
        ? await currentUser.getIdToken().catch(() => null)
        : null;
    if (token) {
      const restOk = await writeFirestoreDocViaRest('lernstudio_sets', safeId, docPayload, token);
      if (restOk) {
        savePublishedSetHash(safeId, contentHash);
        return { synced: true, deduplicated: false, wrote: true };
      }
      if (typeof fetch === 'function') {
        const apiUrl = resolveHomeworkApiUrl('/api/homework/sets');
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(cleanSet)
        }).catch(() => null);
        if (res && res.ok) {
          savePublishedSetHash(safeId, contentHash);
          const data = await res.json().catch(() => null);
          return {
            synced: true,
            deduplicated: Boolean(data?.deduplicated),
            wrote: data?.wrote !== false
          };
        }
      }
    }
    handleFirestoreError(error, OperationType.WRITE, path);
    return { synced: false, deduplicated: false, wrote: false };
  }
}

export async function saveLernstudioSetToFirestore(setItem: LernstudioSet): Promise<boolean> {
  const res = await publishCustomLernstudioSetOnce(setItem);
  return res.synced && !res.skippedBuiltinOrArchived;
}

export async function deleteLernstudioSetFromFirestore(setId: string): Promise<boolean> {
  if (!setId || isBuiltinCurriculumSetId(setId)) return false;
  const ownerUid = getCurrentHomeworkOwnerUid() || auth.currentUser?.uid || '';
  if (!ownerUid) return false;
  const safeId = sanitizeDocId(setId);
  const path = `lernstudio_sets/${safeId}`;
  lastPublishedSetHashById.delete(safeId);
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
  const cleanId = String(setId).trim();
  if (isBuiltinCurriculumSetId(cleanId)) {
    return DEFAULT_LERNSTUDIO_SETS.find((s) => s.id === cleanId) || null;
  }
  const safeId = sanitizeDocId(cleanId);
  const path = `lernstudio_sets/${safeId}`;
  try {
    const snap = await withFirestoreReadTimeout(getDoc(doc(db, 'lernstudio_sets', safeId)), 4000);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.payloadJson) {
        return JSON.parse(data.payloadJson) as LernstudioSet;
      }
      return null;
    }
    if (!(snap as any).metadata?.fromCache) {
      return null;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
  const restData = await readFirestoreDocViaRest('lernstudio_sets', safeId);
  if (restData?.payloadJson) {
    try {
      return JSON.parse(restData.payloadJson) as LernstudioSet;
    } catch {
      return null;
    }
  }
  return null;
}

export async function fetchPublishedCustomLernstudioSetsFromFirestore(options?: {
  limit?: number;
  cursor?: string;
}): Promise<{ sets: LernstudioSet[]; nextCursor: string | null; hasMore: boolean }> {
  const ownerUid = getCurrentHomeworkOwnerUid() || auth.currentUser?.uid || '';
  if (!ownerUid) {
    return { sets: [], nextCursor: null, hasMore: false };
  }
  const safeLimit = Math.max(1, Math.min(100, Number(options?.limit) || 25));
  try {
    let cursorSnap: any = null;
    if (options?.cursor) {
      cursorSnap = await withFirestoreReadTimeout(
        getDoc(doc(db, 'lernstudio_sets', sanitizeDocId(options.cursor))),
        3500
      ).catch(() => null);
    }
    const constraints: any[] = [
      where('published', '==', true),
      orderBy('updatedAtIso', 'desc')
    ];
    if (cursorSnap && cursorSnap.exists()) {
      constraints.push(startAfter(cursorSnap));
    }
    constraints.push(limit(safeLimit + 1));

    const q = query(collection(db, 'lernstudio_sets'), ...constraints);
    const snap = await withFirestoreReadTimeout(getDocs(q), 5000);
    if (!snap.metadata?.fromCache) {
      const docs = snap.docs || [];
      const hasMore = docs.length > safeLimit;
      const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;
      const list: LernstudioSet[] = [];
      for (const docSnap of pageDocs) {
        const data = docSnap.data();
        if (data?.deleted === true || !data?.payloadJson) continue;
        try {
          const parsed = JSON.parse(data.payloadJson) as LernstudioSet;
          if (parsed && !parsed.deleted && !parsed.isArchived && !isBuiltinCurriculumSetId(parsed.id)) {
            list.push({ ...parsed, published: parsed.published !== false });
          }
        } catch {
          // Ignore malformed doc
        }
      }
      const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
      return {
        sets: list,
        nextCursor: hasMore && lastDoc ? lastDoc.id : null,
        hasMore
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'lernstudio_sets');
  }

  const currentUser = (testHomeworkAuthUser !== undefined ? testHomeworkAuthUser : auth.currentUser) as any;
  const token =
    currentUser && typeof currentUser.getIdToken === 'function'
      ? await currentUser.getIdToken().catch(() => null)
      : null;
  if (token && typeof fetch === 'function') {
    const qs = new URLSearchParams({ limit: String(safeLimit) });
    if (options?.cursor) qs.set('cursor', options.cursor);
    const apiUrl = resolveHomeworkApiUrl(`/api/homework/sets?${qs.toString()}`);
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.sets)) {
        return {
          sets: data.sets,
          nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
          hasMore: Boolean(data.hasMore)
        };
      }
    }
  }

  return { sets: [], nextCursor: null, hasMore: false };
}

/**
 * Legacy subscription signature preserved as a strict zero-listener no-op.
 * Use fetchPublishedCustomLernstudioSetsFromFirestore on explicit user action.
 */
export function subscribeLernstudioSetsFromFirestore(
  _onUpdate: (sets: LernstudioSet[]) => void,
  _explicitOwnerUid?: string
): () => void {
  return () => {};
}

