import { registerPlugin } from '@capacitor/core';

export const GOOGLE_WEB_CLIENT_ID =
  '874458026984-3ai954q2p8ga6h4b2b15is2gdjbi9768.apps.googleusercontent.com';

export interface GoogleCredentialSignInOptions {
  serverClientId?: string;
}

export interface AndroidApkSigningInfo {
  packageName?: string;
  apkSha1?: string;
  apkSha256?: string;
}

export interface GoogleCredentialSignInResult extends AndroidApkSigningInfo {
  cancelled?: boolean;
  idToken?: string;
  email?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  photoUrl?: string;
  elapsedMs?: number;
  exceptionType?: string;
  reason?: string;
}

export interface GoogleCredentialSignOutResult {
  cleared: boolean;
}

export interface AndroidAuthDiagnostic extends AndroidApkSigningInfo {
  timestampIso: string;
  cancelled: boolean;
  elapsedMs?: number;
  code?: string;
  exceptionType?: string;
  reason?: string;
}

export interface GoogleCredentialAuthPlugin {
  signIn(options?: GoogleCredentialSignInOptions): Promise<GoogleCredentialSignInResult>;
  signOut(): Promise<GoogleCredentialSignOutResult>;
  getSigningInfo?(): Promise<AndroidApkSigningInfo>;
}

const NativeGoogleCredentialAuth = registerPlugin<GoogleCredentialAuthPlugin>('GoogleCredentialAuth');

export interface NativeAuthTestAdapter {
  isAndroidNative?: () => boolean;
  signIn?: (options?: GoogleCredentialSignInOptions) => Promise<GoogleCredentialSignInResult>;
  signOut?: () => Promise<GoogleCredentialSignOutResult>;
  getSigningInfo?: () => Promise<AndroidApkSigningInfo>;
}

let testAdapter: NativeAuthTestAdapter | null = null;
let lastAndroidAuthDiagnostic: AndroidAuthDiagnostic | null = null;

export function __setNativeAuthTestAdapter(adapter: NativeAuthTestAdapter | null): void {
  testAdapter = adapter;
  lastAndroidAuthDiagnostic = null;
}

export function getLastAndroidAuthDiagnostic(): AndroidAuthDiagnostic | null {
  return lastAndroidAuthDiagnostic;
}

export function clearLastAndroidAuthDiagnostic(): void {
  lastAndroidAuthDiagnostic = null;
}

export async function getAndroidApkSigningInfo(): Promise<AndroidApkSigningInfo | null> {
  if (!isAndroidNativePlatform()) return null;
  try {
    if (testAdapter?.getSigningInfo) {
      return await testAdapter.getSigningInfo();
    }
    if (typeof NativeGoogleCredentialAuth.getSigningInfo === 'function') {
      return await NativeGoogleCredentialAuth.getSigningInfo();
    }
  } catch {
    // Fallback to cached diagnostic if available
  }
  if (lastAndroidAuthDiagnostic) {
    return {
      packageName: lastAndroidAuthDiagnostic.packageName || 'com.glueck.teacher',
      apkSha1: lastAndroidAuthDiagnostic.apkSha1,
      apkSha256: lastAndroidAuthDiagnostic.apkSha256
    };
  }
  return { packageName: 'com.glueck.teacher' };
}

export function getResolvedGoogleWebClientId(): string {
  try {
    const envClientId = (import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID;
    if (
      typeof envClientId === 'string' &&
      envClientId.trim().length > 0 &&
      !envClientId.includes('REPLACE_WITH_')
    ) {
      return envClientId.trim();
    }
  } catch {
    // Ignore import.meta access issues in Node test environments
  }
  return GOOGLE_WEB_CLIENT_ID;
}

export function isAndroidNativePlatform(): boolean {
  if (testAdapter?.isAndroidNative) {
    return testAdapter.isAndroidNative();
  }
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap) {
    if (typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android') {
      return true;
    }
    if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      return true;
    }
  }
  const protocol = window.location?.protocol;
  return protocol === 'capacitor:' || protocol === 'file:';
}

export async function invokeNativeGoogleCredentialSignIn(
  options?: GoogleCredentialSignInOptions
): Promise<GoogleCredentialSignInResult> {
  const resolvedOptions: GoogleCredentialSignInOptions = {
    serverClientId: options?.serverClientId || getResolvedGoogleWebClientId()
  };
  try {
    const res = testAdapter?.signIn
      ? await testAdapter.signIn(resolvedOptions)
      : await NativeGoogleCredentialAuth.signIn(resolvedOptions);

    if (res?.cancelled) {
      lastAndroidAuthDiagnostic = {
        timestampIso: new Date().toISOString(),
        cancelled: true,
        elapsedMs: res.elapsedMs,
        exceptionType: res.exceptionType,
        reason: res.reason,
        packageName: res.packageName || 'com.glueck.teacher',
        apkSha1: res.apkSha1,
        apkSha256: res.apkSha256
      };
    } else {
      lastAndroidAuthDiagnostic = null;
    }
    return res;
  } catch (err: any) {
    const errData = err?.data || {};
    lastAndroidAuthDiagnostic = {
      timestampIso: new Date().toISOString(),
      cancelled: false,
      code: String(err?.code || 'CREDENTIAL_ERROR'),
      exceptionType: errData?.exceptionType || err?.exceptionType,
      reason: String(err?.message || err || ''),
      packageName: errData?.packageName || 'com.glueck.teacher',
      apkSha1: errData?.apkSha1,
      apkSha256: errData?.apkSha256
    };
    throw err;
  }
}

export async function invokeNativeGoogleCredentialSignOut(): Promise<GoogleCredentialSignOutResult> {
  if (testAdapter?.signOut) {
    return testAdapter.signOut();
  }
  return NativeGoogleCredentialAuth.signOut();
}
