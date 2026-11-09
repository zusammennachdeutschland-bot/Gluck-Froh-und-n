import { registerPlugin } from '@capacitor/core';

export const GOOGLE_WEB_CLIENT_ID =
  '874458026984-3ai954q2p8ga6h4b2b15is2gdjbi9768.apps.googleusercontent.com';

export interface GoogleCredentialSignInOptions {
  serverClientId?: string;
}

export interface GoogleCredentialSignInResult {
  cancelled?: boolean;
  idToken?: string;
  email?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  photoUrl?: string;
}

export interface GoogleCredentialSignOutResult {
  cleared: boolean;
}

export interface GoogleCredentialAuthPlugin {
  signIn(options?: GoogleCredentialSignInOptions): Promise<GoogleCredentialSignInResult>;
  signOut(): Promise<GoogleCredentialSignOutResult>;
}

const NativeGoogleCredentialAuth = registerPlugin<GoogleCredentialAuthPlugin>('GoogleCredentialAuth');

export interface NativeAuthTestAdapter {
  isAndroidNative?: () => boolean;
  signIn?: (options?: GoogleCredentialSignInOptions) => Promise<GoogleCredentialSignInResult>;
  signOut?: () => Promise<GoogleCredentialSignOutResult>;
}

let testAdapter: NativeAuthTestAdapter | null = null;

export function __setNativeAuthTestAdapter(adapter: NativeAuthTestAdapter | null): void {
  testAdapter = adapter;
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
  if (testAdapter?.signIn) {
    return testAdapter.signIn(resolvedOptions);
  }
  return NativeGoogleCredentialAuth.signIn(resolvedOptions);
}

export async function invokeNativeGoogleCredentialSignOut(): Promise<GoogleCredentialSignOutResult> {
  if (testAdapter?.signOut) {
    return testAdapter.signOut();
  }
  return NativeGoogleCredentialAuth.signOut();
}
